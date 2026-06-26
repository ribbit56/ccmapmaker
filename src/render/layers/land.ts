/*
  Landmass layer (CLAUDE.md §6 step 3) — the land silhouette over the ocean.

  A barely-there drop shadow seats the land on the paper, then the silhouette is
  filled with the warm base land tone. This base is the "wet paper" the biome washes
  are painted onto (the biome layer sits directly above), and it backs the smoothed
  coastline so no gaps show at the shore. Colours come from the active theme.
*/

import { getCoastline, buildLandPath } from '../coastline';
import type { LayerContext } from '../layer';

export function drawLand(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world) return;
  const { fill, shadow } = lc.theme.land;

  const { loops } = getCoastline(world);
  const landPath = buildLandPath(loops);

  // Fill + soft drop shadow in one pass so land sits *on* the sheet. One shadowBlur
  // op on the whole silhouette is cheap (unlike per-loop).
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = fill;
  ctx.fill(landPath, 'nonzero');
  ctx.restore();
}
