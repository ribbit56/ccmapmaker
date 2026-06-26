/*
  Per-cell geometry for the biome washes (CLAUDE.md §6 step 4), memoised per World.

  For every land cell we keep its original Voronoi polygon (exact tiling — drawn
  first so there are no cracks between cells) and a midpoint-jittered version (drawn
  on top for organic watercolour edges). A small per-cell tonal offset is stored too
  so fills mottle rather than read flat. Geometry is theme-independent; the layer
  applies the theme's biome colours at draw time.
*/

import { makeRng } from '@/gen/rng';
import { jitterPolygon } from './paint';
import type { World, BiomeId } from '@/model/world';

export interface BiomeCell {
  biome: BiomeId;
  /** Per-cell brightness offset (−1..1) for tonal mottling. */
  shade: number;
  orig: number[]; // original polygon, flat coords
  jit: number[]; // jittered polygon, flat coords
}

const cache = new WeakMap<World, { rev: number; value: BiomeCell[] }>();

export function getBiomeCells(world: World): BiomeCell[] {
  const cached = cache.get(world);
  if (cached && cached.rev === world.geomRev) return cached.value;

  const { grid, cells } = world;
  const rng = makeRng(world.meta.seed, 'biomes');
  const result: BiomeCell[] = [];

  for (let i = 0; i < grid.count; i++) {
    if (cells.isWater[i]) continue; // water is the ocean layer's job
    const poly = grid.polygons[i]!;
    if (poly.length < 6) continue;
    const orig = Array.from(poly);
    result.push({
      biome: cells.biome[i] as BiomeId,
      shade: rng.jitter(0.06),
      orig,
      jit: jitterPolygon(orig, 2, 1.8, rng),
    });
  }

  cache.set(world, { rev: world.geomRev, value: result });
  return result;
}
