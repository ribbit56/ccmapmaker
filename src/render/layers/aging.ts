/*
  Aging pass (CLAUDE.md §6 step 12) — the final overlay: fine grain, a soft vignette,
  and a few coffee-stain blotches, all scaled by the aging strength (0 = clean,
  1 = ancient). Cheap to redraw so the strength slider stays smooth.

  Layers composite source-over, so effects are translucent dark/light overlays rather
  than true blend modes (which would only blend within this layer's own canvas). The
  grain tile is seed-derived and cached, so it reproduces and re-renders instantly.
*/

import { makeRng } from '@/gen/rng';
import { hexToRgb, rgbaStr } from '@/lib/color';
import type { LayerContext } from '../layer';

const TILE = 128;
const grainCache = new Map<string, HTMLCanvasElement>();

export function drawAging(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { aging, width: w, height: h } = lc;
  if (aging <= 0.001) return;

  // Fine grain (seed-derived tile, alpha scaled by strength).
  const tile = getGrainTile(lc.seed);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, aging) * 0.9;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Vignette / edge darkening.
  const tone = hexToRgb(lc.theme.paper.vignette);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  g.addColorStop(0, rgbaStr(tone, 0));
  g.addColorStop(1, rgbaStr(tone, aging * 0.42));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Coffee stains — sparse ragged blotches.
  const rng = makeRng(lc.seed, 'aging-stains');
  const stain = hexToRgb(lc.theme.paper.stain);
  const count = Math.round(aging * 4);
  for (let i = 0; i < count; i++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const radius = rng.float(34, 130);
    const a = aging * rng.float(0.05, 0.12);
    const lobes = rng.int(2, 4);
    for (let j = 0; j < lobes; j++) {
      const ox = x + rng.jitter(radius * 0.6);
      const oy = y + rng.jitter(radius * 0.6);
      const rr = radius * rng.float(0.5, 1);
      const blot = ctx.createRadialGradient(ox, oy, rr * 0.3, ox, oy, rr);
      blot.addColorStop(0, rgbaStr(stain, a));
      blot.addColorStop(1, rgbaStr(stain, 0));
      ctx.fillStyle = blot;
      ctx.fillRect(0, 0, w, h);
    }
    // Faint darker rim, like a dried coffee ring.
    ctx.strokeStyle = rgbaStr(stain, a * 1.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** A seed-derived translucent grain tile (both light and dark specks). */
function getGrainTile(seed: string): HTMLCanvasElement {
  const cached = grainCache.get(seed);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const tctx = canvas.getContext('2d')!;
  const img = tctx.createImageData(TILE, TILE);
  const data = img.data;
  const rng = makeRng(seed, 'aging-grain');
  const maxA = 30;
  for (let i = 0; i < TILE * TILE; i++) {
    const v = rng.next();
    const dark = v < 0.5;
    const alpha = Math.abs(v - 0.5) * 2 * maxA;
    const o = i * 4;
    if (dark) {
      data[o] = 50;
      data[o + 1] = 38;
      data[o + 2] = 24;
    } else {
      data[o] = 255;
      data[o + 1] = 248;
      data[o + 2] = 230;
    }
    data[o + 3] = alpha;
  }
  tctx.putImageData(img, 0, 0);
  grainCache.set(seed, canvas);
  return canvas;
}
