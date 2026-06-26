/*
  Biome washes layer (CLAUDE.md §6 step 4) — the watercolour colouring of the land,
  drawn over the warm land base.

  Each land cell is filled twice: once with its exact polygon (a seamless coverage
  base) and once with a midpoint-jittered polygon, so biome boundaries read as
  organic bleeds rather than Voronoi facets. A per-cell tonal offset keeps fills from
  going flat. A soft low-frequency multiply pass then adds uneven watercolour density
  (the "stacked low-opacity" depth), and finally the crisp coastline ink is laid on
  top so it stays sharp over the washes. Colours come from the theme's biome ramp.
*/

import { getBiomeCells } from '../biomeCells';
import { getCoastline, buildLandPath } from '../coastline';
import { traceLoop } from '../paint';
import { makeRng } from '@/gen/rng';
import { hexToRgb, rgbStr, rgbaStr, shade } from '@/lib/color';
import type { LayerContext } from '../layer';

export function drawBiomes(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world) return;
  const ramp = lc.theme.biomes;

  const biomeCells = getBiomeCells(world);

  // Precompute each cell's tonal colour once (theme ramp + per-cell shade).
  const colors = biomeCells.map((c) => rgbStr(shade(hexToRgb(ramp[c.biome]), c.shade)));

  // Pass 1: exact polygons → seamless coverage (no cracks between cells).
  for (let i = 0; i < biomeCells.length; i++) {
    ctx.fillStyle = colors[i]!;
    traceLoop(ctx, biomeCells[i]!.orig);
    ctx.fill();
  }
  // Pass 2: jittered polygons → organic, bleeding biome edges.
  for (let i = 0; i < biomeCells.length; i++) {
    ctx.fillStyle = colors[i]!;
    traceLoop(ctx, biomeCells[i]!.jit);
    ctx.fill();
  }

  depthWash(ctx, lc);

  // Crisp coastline ink, kept above the washes so the shore stays sharp.
  const { loops } = getCoastline(world);
  ctx.save();
  ctx.strokeStyle = lc.theme.ink;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  for (const loop of loops) {
    traceLoop(ctx, loop);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A few big, soft multiply blobs over the land give the washes uneven density, like
 * pooled watercolour. Clipped to the painted biome cells so it never touches ocean.
 */
function depthWash(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world, width: w, height: h } = lc;
  if (!world) return;
  const rng = makeRng(world.meta.seed, 'biome-depth');
  const tone = hexToRgb(lc.theme.paper.vignette);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  // Clip to the land silhouette so the blobs (full-canvas gradients) only darken land.
  ctx.clip(buildLandPath(getCoastline(world).loops), 'nonzero');

  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const x = rng.float(0, w);
    const y = rng.float(0, h);
    const r = rng.float(0.12, 0.3) * Math.min(w, h);
    const a = rng.float(0.05, 0.12);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgbaStr(tone, a));
    g.addColorStop(1, rgbaStr(tone, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
