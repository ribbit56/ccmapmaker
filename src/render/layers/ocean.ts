/*
  Ocean layer (CLAUDE.md §6 step 2) — drawn over paper, under land.

  A soft translucent depth wash (paper grain still reads through), a gentle shallow
  halo hugging the shore, and the concentric hand-drawn coastal contour rings — the
  single strongest "old map" signal. Everything on the land side is then punched away
  so the wash, halo, and rings only appear over water; the smoothed land silhouette
  is the exact same geometry the land layer fills, so they register perfectly.

  Colours are an inline Old-Atlas palette for now; they move to the theme tokens in
  Phase 2.
*/

import { getCoastline, buildLandPath, offsetLoopToWater } from '../coastline';
import { traceLoop } from '../paint';
import type { LayerContext } from '../layer';

// Concentric ring distances from the coast (px) and the rings' fading alphas.
const RING_DISTS = [5, 11, 18, 26, 35];
const RING_ALPHAS = [0.4, 0.3, 0.22, 0.15, 0.09];

export function drawOcean(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world, width: w, height: h } = lc;
  if (!world) return;
  const oc = lc.theme.ocean;

  const { loops } = getCoastline(world);
  const landPath = buildLandPath(loops);

  // Depth wash — translucent so the parchment beneath stays warm.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, oc.shallow);
  g.addColorStop(1, oc.deep);
  ctx.save();
  ctx.globalAlpha = oc.washAlpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Shallow halo: a soft band hugging the shore, built from a few translucent
  // strokes of decreasing width (cheaper than shadowBlur, which is very slow when
  // applied per loop). The land half is punched away later.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = oc.halo;
  for (const width of [26, 18, 10]) {
    ctx.lineWidth = width;
    for (const loop of loops) {
      traceLoop(ctx, loop);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Concentric contour rings, fading outward into deep water.
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.1;
  for (let r = 0; r < RING_DISTS.length; r++) {
    ctx.strokeStyle = `rgba(${oc.ringInk}, ${RING_ALPHAS[r]})`;
    for (const loop of loops) {
      traceLoop(ctx, offsetLoopToWater(loop, RING_DISTS[r]!));
      ctx.stroke();
    }
  }
  ctx.restore();

  // Punch out the land side so ocean ink never bleeds onto the landmass.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fill(landPath, 'nonzero');
  ctx.restore();
}
