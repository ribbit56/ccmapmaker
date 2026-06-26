/*
  The visible map canvas plus all view interaction (CLAUDE.md §10).

  Creates the {@link Compositor} once, registers the layers, and wires:
    - pan   : middle-drag, or hold Space + left-drag,
    - zoom  : mouse wheel, and two-finger pinch (pointer events),
    - resize: a ResizeObserver that keeps the backing store DPR-correct.

  React owns nothing about pixels here — it just hands DOM events to the imperative
  compositor, which keeps render state out of the React tree (no re-render per frame).
*/

import { useEffect, useRef, useState } from 'react';
import { Compositor } from '@/render/compositor';
import { Layer } from '@/render/layer';
import { drawPaper } from '@/render/layers/paper';
import { drawOcean } from '@/render/layers/ocean';
import { drawLand } from '@/render/layers/land';
import { drawBiomes } from '@/render/layers/biomes';
import { drawRelief } from '@/render/layers/relief';
import { drawForests } from '@/render/layers/forests';
import { drawRivers } from '@/render/layers/rivers';
import { drawRoads } from '@/render/layers/roads';
import { drawSettlements } from '@/render/layers/settlements';
import { drawLabels } from '@/render/layers/labels';
import { drawDecoration } from '@/render/layers/decoration';
import { drawAging } from '@/render/layers/aging';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@/render/constants';
import { generate, rerollFeatures, rerollLabels } from '@/gen/genClient';
import { getTheme } from '@/themes';
import { useAppStore, type ToolId } from '@/state/store';
import { getTool, type Tool } from '@/tools';
import { autosave, loadAutosave } from '@/export/storage';

/** Module-level compositor ref so TopBar can trigger PNG export without prop drilling. */
let _comp: Compositor | null = null;
export function getCompositor(): Compositor | null { return _comp; }

export function MapCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compRef = useRef<Compositor | null>(null);
  /** Monotonic token so a superseded async roll's result is discarded on arrival. */
  const genTokenRef = useRef(0);

  const seed = useAppStore((s) => s.seed);
  const regenNonce = useAppStore((s) => s.regenNonce);
  const worldRev = useAppStore((s) => s.worldRev);
  const generating = useAppStore((s) => s.generating);
  const activeTool = useAppStore((s) => s.activeTool);
  const themeId = useAppStore((s) => s.themeId);
  const aging = useAppStore((s) => s.aging);
  const decor = useAppStore((s) => s.decor);
  const setCursorWorld = useAppStore((s) => s.setCursorWorld);
  const setLastRenderMs = useAppStore((s) => s.setLastRenderMs);
  const setCellCount = useAppStore((s) => s.setCellCount);

  // One-time setup: build the compositor, layers, interaction, and resizing.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const comp = new Compositor(canvas, WORLD_WIDTH, WORLD_HEIGHT, useAppStore.getState().seed);
    // Layer order, bottom → top (CLAUDE.md §6).
    comp.addLayer(new Layer('paper', drawPaper));
    comp.addLayer(new Layer('ocean', drawOcean));
    comp.addLayer(new Layer('land', drawLand));
    comp.addLayer(new Layer('biomes', drawBiomes));
    comp.addLayer(new Layer('relief', drawRelief));
    comp.addLayer(new Layer('forests', drawForests));
    comp.addLayer(new Layer('rivers', drawRivers));
    comp.addLayer(new Layer('roads', drawRoads));
    comp.addLayer(new Layer('settlements', drawSettlements));
    comp.addLayer(new Layer('labels', drawLabels));
    comp.addLayer(new Layer('decoration', drawDecoration));
    comp.addLayer(new Layer('aging', drawAging));
    comp.setTheme(getTheme(useAppStore.getState().themeId));
    comp.setAging(useAppStore.getState().aging);
    comp.setDecor(useAppStore.getState().decor);
    comp.onRender = (ms) => setLastRenderMs(ms);
    compRef.current = comp;
    _comp = comp;

    // --- Resize (DPR-correct), auto-fit only on the first measurement ---------
    // Size once up front (don't rely on the observer's initial delivery, which is
    // unreliable in some embedded/headless contexts), then keep it live.
    let fitted = false;
    const syncSize = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      comp.resize(clientWidth, clientHeight, window.devicePixelRatio || 1);
      if (!fitted) {
        comp.fit();
        fitted = true;
      }
    };
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);

    // --- Keyboard: Space-pan, tool shortcuts, undo/redo, delete (CLAUDE.md §10) -
    let spaceDown = false;
    const SHORTCUTS: Record<string, ToolId> = {
      v: 'select',
      c: 'coastline',
      b: 'biome',
      m: 'mountain',
      f: 'forest',
      r: 'river',
      d: 'road',
      p: 'feature',
      t: 'label',
      o: 'decoration',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      if (e.code === 'Space') {
        spaceDown = true;
        canvas.style.cursor = 'grab';
        e.preventDefault();
        return;
      }
      const st = useAppStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod) return; // leave other Ctrl/Cmd combos to the browser
      if (e.key === 'Delete' || e.key === 'Backspace') {
        st.deleteSelected();
        e.preventDefault();
        return;
      }
      const k = e.key.toLowerCase();
      if (SHORTCUTS[k]) {
        st.setActiveTool(SHORTCUTS[k]);
      } else if (k === 'g') {
        st.reseed();
      } else if (k === 'f') {
        comp.fit();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown = false;
        canvas.style.cursor = 'default';
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- Pointer pan + pinch zoom --------------------------------------------
    const pointers = new Map<number, { x: number; y: number }>();
    let panning = false;
    let pinchDist = 0;
    let toolActive = false;
    let toolHandler: Tool | null = null;

    const localPos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      const p = localPos(e);
      pointers.set(e.pointerId, p);
      const wantsPan = e.button === 1 || (e.button === 0 && spaceDown);
      if (wantsPan) {
        panning = true;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
      } else if (e.button === 0 && pointers.size === 1) {
        toolHandler = getTool(useAppStore.getState().activeTool);
        if (toolHandler) {
          const w = comp.screenToWorld(p.x, p.y);
          const consumed = toolHandler.onDown?.({ x: w.x, y: w.y, shiftKey: e.shiftKey });
          if (consumed === false) {
            // Tool declined (e.g. select on empty canvas) → fall through to pan.
            toolHandler = null;
            panning = true;
            canvas.setPointerCapture(e.pointerId);
            canvas.style.cursor = 'grabbing';
          } else {
            toolActive = true;
            // Pointer capture is best-effort — never let it abort the tool action.
            try {
              canvas.setPointerCapture(e.pointerId);
            } catch {
              /* ignore (e.g. synthetic pointers) */
            }
          }
          e.preventDefault();
        }
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        panning = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      const p = localPos(e);

      if (pointers.size === 2 && prev) {
        // Pinch: zoom about the midpoint by the change in finger distance.
        pointers.set(e.pointerId, p);
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 };
        if (pinchDist > 0) comp.zoomAt(mid.x, mid.y, dist / pinchDist);
        pinchDist = dist;
        return;
      }

      if (panning && prev) {
        comp.panBy(p.x - prev.x, p.y - prev.y);
      } else if (toolActive && toolHandler && prev) {
        const w = comp.screenToWorld(p.x, p.y);
        toolHandler.onMove?.({ x: w.x, y: w.y, shiftKey: e.shiftKey });
      }
      if (prev) pointers.set(e.pointerId, p);

      const wp = comp.screenToWorld(p.x, p.y);
      setCursorWorld(wp);
    };

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (toolActive && toolHandler) {
        const p = localPos(e);
        const w = comp.screenToWorld(p.x, p.y);
        toolHandler.onUp?.({ x: w.x, y: w.y, shiftKey: e.shiftKey });
        toolActive = false;
        toolHandler = null;
      }
      if (pointers.size === 0) {
        panning = false;
        const toolCursor = getTool(useAppStore.getState().activeTool)?.cursor ?? 'default';
        canvas.style.cursor = spaceDown ? 'grab' : toolCursor;
      }
    };

    const onPointerLeave = () => setCursorWorld(null);

    // Native wheel listener so we can preventDefault (React's is passive).
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      comp.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    // Middle-click auto-scroll would hijack panning; suppress it.
    const onAux = (e: MouseEvent) => e.button === 1 && e.preventDefault();
    canvas.addEventListener('auxclick', onAux);

    return () => {
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('auxclick', onAux);
      comp.dispose();
      compRef.current = null;
      _comp = null;
    };
  }, [setCursorWorld, setLastRenderMs]);

  // Seed drives the paper texture + aging grain (master seed, not terrain).
  useEffect(() => {
    compRef.current?.setSeed(seed);
  }, [seed]);

  // Regenerate signal (CLAUDE.md §7): full rebuild for terrain/config, cheap partial
  // re-roll for features/labels (reuses the existing grid + terrain). Runs in the
  // generation Web Worker (CLAUDE.md §3) so the UI never blocks during a roll.
  // Debounced so a slider drag coalesces into one regeneration; a `token` guard drops
  // any result that a newer roll has already superseded. On the very first nonce (0)
  // we try restoring from autosave before falling through to a fresh generate.
  useEffect(() => {
    let cancelled = false;
    const token = ++genTokenRef.current;
    const id = setTimeout(async () => {
      const s = useAppStore.getState();
      const world = s.world;

      // First load: restore autosave synchronously, skipping the worker entirely.
      if (regenNonce === 0 && s.regenScope !== 'features' && s.regenScope !== 'labels') {
        const saved = loadAutosave();
        if (saved) { s.setWorld(saved); return; }
      }

      s.setGenerating(true);
      try {
        if (s.regenScope === 'features' && world) {
          const next = await rerollFeatures(world, s.featureSeed);
          if (cancelled || token !== genTokenRef.current) return;
          s.commitRegen(['settlements', 'roads', 'labels'], next);
        } else if (s.regenScope === 'labels' && world) {
          const next = await rerollLabels(world, s.labelSeed);
          if (cancelled || token !== genTokenRef.current) return;
          s.commitRegen(['labels'], next);
        } else {
          const next = await generate({
            seed: s.seed,
            terrainSeed: s.terrainSeed,
            featureSeed: s.featureSeed,
            labelSeed: s.labelSeed,
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            config: s.config,
          });
          if (cancelled || token !== genTokenRef.current) return;
          s.setWorld(next);
        }
      } catch (err) {
        if (!cancelled) console.error('World generation failed:', err);
      } finally {
        if (!cancelled && token === genTokenRef.current) s.setGenerating(false);
      }
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [regenNonce]);

  // Apply world changes (regen or edits) to the compositor: full swap for 'all',
  // otherwise swap the world reference (partial re-rolls return a fresh object from
  // the worker; in-place edits return the same one) and repaint just the dirty layers.
  useEffect(() => {
    const comp = compRef.current;
    const s = useAppStore.getState();
    if (!comp || !s.world) return;
    if (s.dirtyLayers === 'all') {
      comp.setWorld(s.world);
      setCellCount(s.world.grid.count);
    } else {
      comp.updateWorld(s.world);
      for (const layer of s.dirtyLayers) comp.invalidate(layer);
    }
  }, [worldRev, setCellCount]);

  // React to theme changes: every layer's colours derive from the active theme.
  useEffect(() => {
    compRef.current?.setTheme(getTheme(themeId));
  }, [themeId]);

  // Aging strength and decoration toggles.
  useEffect(() => {
    compRef.current?.setAging(aging);
  }, [aging]);
  useEffect(() => {
    compRef.current?.setDecor(decor);
  }, [decor]);

  // Autosave (CLAUDE.md §11): debounced write to localStorage on every world change.
  useEffect(() => {
    const id = setTimeout(() => {
      const w = useAppStore.getState().world;
      if (w) autosave(w);
    }, 2000);
    return () => clearTimeout(id);
  }, [worldRev]);

  // Cursor reflects the active tool (CLAUDE.md §10).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = getTool(activeTool)?.cursor ?? 'default';
  }, [activeTool]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-desk-950">
      <canvas ref={canvasRef} className="block touch-none select-none" />
      <GeneratingOverlay show={generating} />
    </div>
  );
}

/**
 * Tasteful in-canvas loading state during a roll (CLAUDE.md §10): a slow-spinning
 * brass compass needle over a faint scrim, sitting in the drafting-desk chrome
 * idiom — not the map's parchment look. The spin is disabled under prefers-reduced-
 * motion. Covers the canvas so no edits land mid-generation.
 *
 * Shown only after a short delay (SHOW_DELAY): generation in the worker is usually
 * faster than the eye, so a quick roll flashes nothing — the overlay appears only for
 * genuinely slow rolls (high detail), where feedback is actually wanted.
 */
const SHOW_DELAY = 220;
function GeneratingOverlay({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const id = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(id);
  }, [show]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-desk-950/30 backdrop-blur-[1px]" />
      <div className="relative flex flex-col items-center gap-3">
        <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-desk-700)" strokeWidth="2" />
          <g className="origin-center motion-safe:animate-[spin_2.4s_linear_infinite]">
            <path d="M24 7l3.2 13.2L24 24l-3.2-3.8z" fill="var(--color-brass-400)" />
            <path d="M24 41l-3.2-13.2L24 24l3.2 3.8z" fill="var(--color-brass-600)" />
          </g>
          <circle cx="24" cy="24" r="2.4" fill="var(--color-brass-500)" />
        </svg>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-ink-300">
          Drawing the world
        </span>
      </div>
    </div>
  );
}

/** Don't swallow Space when the user is typing in a field. */
function isTextTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}
