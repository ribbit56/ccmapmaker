/*
  Paper layer (CLAUDE.md §6.1) — the warm parchment base of the map artifact.

  Built up in passes rather than flat-filled:
    1. a soft warm-to-cooler radial wash (light falling from the upper-left),
    2. large low-frequency mottling so the tone is never uniform,
    3. a few faint age blotches / stains,
    4. crossing paper fibres + fine grain (laid-paper feel),
    5. a gentle vignette so the sheet sits on the desk.

  Every random choice flows through the seed (CLAUDE.md §13), so a seed reproduces
  the exact same sheet. Colours come from the active theme (CLAUDE.md §8).
*/

import { makeRng, type Rng } from '@/gen/rng';
import { hexToRgb, mix, rgbStr, rgbaStr, type Rgb } from '@/lib/color';
import type { LayerContext } from '../layer';

export function drawPaper(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { width: w, height: h } = lc;
  const rng = makeRng(lc.seed, 'paper');
  const p = lc.theme.paper;
  const center = hexToRgb(p.center);
  const edge = hexToRgb(p.edge);

  baseWash(ctx, w, h, center, edge);
  mottle(ctx, w, h, rng, hexToRgb(p.accentWarm), hexToRgb(p.accentCool));
  blotches(ctx, w, h, rng, hexToRgb(p.stain));
  fibresAndGrain(ctx, w, h, rng);
  vignette(ctx, w, h, hexToRgb(p.vignette));
}

/** Soft radial gradient, light source nudged toward the upper-left. */
function baseWash(ctx: CanvasRenderingContext2D, w: number, h: number, center: Rgb, edge: Rgb): void {
  const cx = w * 0.42;
  const cy = h * 0.38;
  const r = Math.hypot(w, h) * 0.7;
  const g = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  g.addColorStop(0, rgbStr(center));
  g.addColorStop(0.6, rgbStr(mix(center, edge, 0.45)));
  g.addColorStop(1, rgbStr(edge));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A handful of big, very soft blobs to break up the gradient's smoothness. */
function mottle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rng: Rng,
  warm: Rgb,
  cool: Rgb,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const blobs = 14;
  for (let i = 0; i < blobs; i++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const radius = rng.float(0.18, 0.42) * Math.min(w, h);
    const tint = rng.bool() ? warm : cool; // half lighten, half darken
    const alpha = rng.float(0.04, 0.1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgbaStr(tint, alpha));
    g.addColorStop(1, rgbaStr(tint, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** Faint, irregular age stains — sparse and low-contrast. */
function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, stain: Rgb): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const count = rng.int(5, 9);
  for (let i = 0; i < count; i++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const radius = rng.float(20, 110);
    const alpha = rng.float(0.03, 0.08);
    // Build each stain from a few overlapping offset lobes so the edge is ragged.
    const lobes = rng.int(2, 4);
    for (let j = 0; j < lobes; j++) {
      const ox = x + rng.jitter(radius * 0.6);
      const oy = y + rng.jitter(radius * 0.6);
      const rr = radius * rng.float(0.5, 1);
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
      g.addColorStop(0, rgbaStr(stain, alpha));
      g.addColorStop(0.7, rgbaStr(stain, alpha * 0.4));
      g.addColorStop(1, rgbaStr(stain, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.restore();
}

/**
 * Crossing paper fibres + fine grain, applied per pixel in one ImageData pass over
 * the whole sheet — heavy once, but this layer is cached so it only runs on a
 * reseed/resize/theme change. The per-pixel PRNG step is inlined (1.6M iterations)
 * to avoid closure-call overhead; still fully seed-driven (CLAUDE.md §13).
 */
function fibresAndGrain(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  const rowNoise = smoothNoise1d(h, rng, 3);
  const colNoise = smoothNoise1d(w, rng, 3);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const fibreStrength = 7;
  const grainStrength = 5;

  let a = (rng.next() * 0xffffffff) >>> 0;
  for (let y = 0; y < h; y++) {
    const rowBase = (rowNoise[y]! - 0.5) * fibreStrength;
    const rowOffset = y * w * 4;
    for (let x = 0; x < w; x++) {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      const delta = rowBase + (colNoise[x]! - 0.5) * fibreStrength + (unit - 0.5) * grainStrength;
      const i = rowOffset + x * 4;
      data[i]! += delta;
      data[i + 1]! += delta;
      data[i + 2]! += delta;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Soft darkening toward the edges so the sheet feels lit and grounded. */
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, tone: Rgb): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.hypot(w, h) * 0.62;
  const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  g.addColorStop(0, rgbaStr(tone, 0));
  g.addColorStop(1, rgbaStr(tone, 0.22));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** A length-`n` array in [0,1], random then box-blurred `passes` times for softness. */
function smoothNoise1d(n: number, rng: Rng, passes: number): Float32Array {
  let a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = rng.next();
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const l = a[Math.max(0, i - 1)]!;
      const c = a[i]!;
      const r = a[Math.min(n - 1, i + 1)]!;
      b[i] = (l + c + r) / 3;
    }
    a = b;
  }
  return a;
}
