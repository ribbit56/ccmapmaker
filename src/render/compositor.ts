/*
  The layered canvas compositor (CLAUDE.md §6).

  Owns the visible canvas, an ordered stack of cached {@link Layer}s, and the view
  transform (pan + zoom). Static layers render into their own offscreen canvases
  once; compositing just blits each cached bitmap under the current camera, so
  pan/zoom stay cheap regardless of how painterly the layers get.

  Camera model: screen = world * scale + translate. `scale` is zoom; `tx`/`ty` are
  the screen-space pixel offset of the world origin. Pan adjusts the translation;
  zoom adjusts scale about a screen anchor so the point under the cursor stays put.
*/

import { Layer, type LayerContext, type DecorOptions } from './layer';
import type { World } from '@/model/world';
import { DEFAULT_THEME, type Theme } from '@/themes';

export interface Camera {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

export class Compositor {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layers: Layer[] = [];

  /** World (map artifact) dimensions in pixels — fixed; the viewport pans over it. */
  private worldW: number;
  private worldH: number;
  private seed: string;
  private world: World | null = null;
  private theme: Theme = DEFAULT_THEME;
  private aging = 0.35;
  private decor: DecorOptions = { compass: true, scaleBar: true, creatures: true, frame: true };

  /** Layers whose cached bitmap depends on the World data (repaint on setWorld). */
  private static readonly WORLD_LAYERS = [
    'ocean',
    'land',
    'biomes',
    'relief',
    'forests',
    'rivers',
    'roads',
    'settlements',
    'labels',
    'decoration',
  ];

  private dpr = 1;
  private viewW = 0;
  private viewH = 0;
  private camera: Camera = { scale: 1, tx: 0, ty: 0 };
  private renderScheduled = false;
  private rafId = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Optional hook fired after each composite with the elapsed milliseconds. */
  onRender: ((ms: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, worldW: number, worldH: number, seed: string) {
    this.canvas = canvas;
    this.worldW = worldW;
    this.worldH = worldH;
    this.seed = seed;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Compositor: could not acquire 2D context');
    this.ctx = ctx;
  }

  addLayer(layer: Layer): void {
    this.layers.push(layer);
  }

  getLayer(name: string): Layer | undefined {
    return this.layers.find((l) => l.name === name);
  }

  /** Invalidate one layer (by name) or all layers, then schedule a redraw. */
  invalidate(name?: string): void {
    if (name) this.getLayer(name)?.invalidate();
    else for (const l of this.layers) l.invalidate();
    this.requestRender();
  }

  /** Change the seed; all layers that derive texture from it must repaint. */
  setSeed(seed: string): void {
    if (seed === this.seed) return;
    this.seed = seed;
    this.invalidate();
  }

  getSeed(): string {
    return this.seed;
  }

  /** Swap in a freshly generated world; repaint only the world-dependent layers. */
  setWorld(world: World | null): void {
    this.world = world;
    for (const name of Compositor.WORLD_LAYERS) this.getLayer(name)?.invalidate();
    this.requestRender();
  }

  /**
   * Swap the world reference WITHOUT invalidating any layer. For partial re-rolls,
   * where a fresh world object arrives from the worker but only a few layers changed —
   * the caller invalidates exactly those, avoiding a needless full repaint.
   */
  updateWorld(world: World | null): void {
    this.world = world;
  }

  /** Change the active theme; every layer's colors derive from it, so repaint all. */
  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.invalidate();
  }

  /** Set aging strength (0..1); repaints the aging pass only. */
  setAging(aging: number): void {
    if (aging === this.aging) return;
    this.aging = aging;
    this.invalidate('aging');
  }

  /** Toggle decorations; repaints the decoration layer. */
  setDecor(decor: DecorOptions): void {
    this.decor = decor;
    this.invalidate('decoration');
  }

  getCamera(): Readonly<Camera> {
    return this.camera;
  }

  /** Resize the visible canvas to the viewport, accounting for device pixel ratio. */
  resize(viewW: number, viewH: number, dpr: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(viewW * dpr));
    this.canvas.height = Math.max(1, Math.round(viewH * dpr));
    this.canvas.style.width = `${viewW}px`;
    this.canvas.style.height = `${viewH}px`;
    this.clampCamera();
    this.requestRender();
  }

  /** Scale-to-fit the whole world centred in the viewport, with a small margin. */
  fit(margin = 0.92): void {
    if (this.viewW === 0 || this.viewH === 0) return;
    const scale = Math.min(this.viewW / this.worldW, this.viewH / this.worldH) * margin;
    this.camera.scale = clamp(scale, MIN_SCALE, MAX_SCALE);
    this.camera.tx = (this.viewW - this.worldW * this.camera.scale) / 2;
    this.camera.ty = (this.viewH - this.worldH * this.camera.scale) / 2;
    this.requestRender();
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.camera.tx += dxScreen;
    this.camera.ty += dyScreen;
    this.clampCamera();
    this.requestRender();
  }

  /** Zoom by `factor` about a screen-space anchor (keeps that point stationary). */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const next = clamp(this.camera.scale * factor, MIN_SCALE, MAX_SCALE);
    const applied = next / this.camera.scale;
    // Keep the world point under (screenX, screenY) fixed across the zoom.
    this.camera.tx = screenX - (screenX - this.camera.tx) * applied;
    this.camera.ty = screenY - (screenY - this.camera.ty) * applied;
    this.camera.scale = next;
    this.clampCamera();
    this.requestRender();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.camera.tx) / this.camera.scale,
      y: (sy - this.camera.ty) / this.camera.scale,
    };
  }

  /** Keep at least a sliver of the map on screen so it can't be lost off-canvas. */
  private clampCamera(): void {
    const keep = 80; // px of world edge that must remain visible
    const w = this.worldW * this.camera.scale;
    const h = this.worldH * this.camera.scale;
    this.camera.tx = clamp(this.camera.tx, keep - w, this.viewW - keep);
    this.camera.ty = clamp(this.camera.ty, keep - h, this.viewH - keep);
  }

  /**
   * Coalesce render requests into one paint on the next animation frame. A short
   * setTimeout runs as a fallback so a throttled/starved rAF (e.g. a backgrounded
   * or headless tab) can't wedge rendering — whichever fires first paints and
   * cancels the other. In an active foreground tab rAF (~16ms) always beats it.
   */
  private requestRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    const flush = () => {
      if (!this.renderScheduled) return;
      this.renderScheduled = false;
      cancelAnimationFrame(this.rafId);
      if (this.timeoutId !== null) clearTimeout(this.timeoutId);
      this.render();
    };
    this.rafId = requestAnimationFrame(flush);
    this.timeoutId = setTimeout(flush, 32);
  }

  /**
   * Render all layers at `scale` × the world resolution into an offscreen canvas
   * and return a PNG blob. Doesn't touch the visible canvas or camera.
   */
  async exportPng(scale: 1 | 2 | 4 = 1): Promise<Blob> {
    const w = Math.round(this.worldW * scale);
    const h = Math.round(this.worldH * scale);
    const off = new OffscreenCanvas(w, h);
    const ctx = off.getContext('2d')!;
    const lc: LayerContext = {
      width: this.worldW,
      height: this.worldH,
      seed: this.seed,
      world: this.world,
      theme: this.theme,
      aging: this.aging,
      decor: this.decor,
    };
    // Ensure all layers are rendered into their normal-res caches first.
    for (const layer of this.layers) {
      if (layer.visible) layer.ensureRendered(lc);
    }
    // Scale them up into the export canvas.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (const layer of this.layers) {
      if (layer.visible) ctx.drawImage(layer.bitmap, 0, 0);
    }
    return off.convertToBlob({ type: 'image/png' });
  }

  /** Cancel any pending frame; call on teardown. */
  dispose(): void {
    this.renderScheduled = false;
    cancelAnimationFrame(this.rafId);
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
  }

  /** Repaint dirty layers into their caches, then blit the stack to the screen. */
  render(): void {
    const t0 = performance.now();
    const lc: LayerContext = {
      width: this.worldW,
      height: this.worldH,
      seed: this.seed,
      world: this.world,
      theme: this.theme,
      aging: this.aging,
      decor: this.decor,
    };
    for (const layer of this.layers) {
      if (layer.visible) layer.ensureRendered(lc);
    }

    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // Apply the camera once; every cached layer shares the same world transform.
    const { scale, tx, ty } = this.camera;
    ctx.setTransform(scale * this.dpr, 0, 0, scale * this.dpr, tx * this.dpr, ty * this.dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    for (const layer of this.layers) {
      if (layer.visible) ctx.drawImage(layer.bitmap, 0, 0);
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.onRender?.(performance.now() - t0);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
