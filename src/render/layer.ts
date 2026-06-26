import type { World } from '@/model/world';
import type { Theme } from '@/themes';

/*
  A single cached render layer (CLAUDE.md §6).

  Each layer owns an offscreen canvas sized to the *world* (the map artifact's
  intrinsic pixel size, independent of the viewport). A layer redraws into its own
  canvas only when marked dirty; pan/zoom never touch it — the compositor simply
  re-blits the cached bitmap under a new view transform. This is the backbone that
  keeps the painterly, expensive layers cheap to move around.
*/

/** Everything a layer's draw function needs about the world it's painting. */
export interface LayerContext {
  /** World width in pixels (the map artifact's intrinsic size). */
  readonly width: number;
  /** World height in pixels. */
  readonly height: number;
  /** Active seed — layers derive their randomness from it (never Math.random). */
  readonly seed: string;
  /** The generated world, or null before the first roll. */
  readonly world: World | null;
  /** Active theme tokens (CLAUDE.md §8). */
  readonly theme: Theme;
  /** Aging strength 0..1 (CLAUDE.md §6.12). */
  readonly aging: number;
  /** Decoration toggles (CLAUDE.md §6.11). */
  readonly decor: DecorOptions;
}

export interface DecorOptions {
  compass: boolean;
  scaleBar: boolean;
  creatures: boolean;
  frame: boolean;
}

export type LayerDraw = (ctx: CanvasRenderingContext2D, lc: LayerContext) => void;

export class Layer {
  readonly name: string;
  visible = true;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly drawFn: LayerDraw;
  private dirty = true;
  private renderedW = -1;
  private renderedH = -1;

  constructor(name: string, draw: LayerDraw) {
    this.name = name;
    this.drawFn = draw;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error(`Layer "${name}": could not acquire 2D context`);
    this.ctx = ctx;
  }

  /** Mark the layer so it repaints on the next composite. */
  invalidate(): void {
    this.dirty = true;
  }

  /** Repaint into the cache if dirty or if world dimensions changed. */
  ensureRendered(lc: LayerContext): void {
    const sizeChanged = lc.width !== this.renderedW || lc.height !== this.renderedH;
    if (!this.dirty && !sizeChanged) return;

    if (sizeChanged) {
      this.canvas.width = lc.width;
      this.canvas.height = lc.height;
      this.renderedW = lc.width;
      this.renderedH = lc.height;
    }

    this.ctx.clearRect(0, 0, lc.width, lc.height);
    this.drawFn(this.ctx, lc);
    this.dirty = false;
  }

  /** The cached bitmap, for the compositor to blit. */
  get bitmap(): CanvasImageSource {
    return this.canvas;
  }
}
