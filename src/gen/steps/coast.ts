/*
  Coast relaxation (CLAUDE.md §5 step 5). Smooth only the cells whose height sits in
  a band around sea level, so the eventual coastline reads as organic rather than
  noisy — without flattening inland mountains. Runs before the sea-level cut.

  Pure: mutates world.cells.height.
*/

import type { GenConfig } from '../config';
import type { World } from '@/model/world';

export function relaxCoast(world: World, config: GenConfig, passes = 2): World {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const h = cells.height;
  const band = 0.08; // how far from sea level a cell counts as "coastal"
  const sea = config.seaLevel;

  for (let p = 0; p < passes; p++) {
    const next = h.slice();
    for (let i = 0; i < count; i++) {
      if (Math.abs(h[i]! - sea) > band) continue;
      const nbs = neighbors[i]!;
      if (nbs.length === 0) continue;
      let sum = 0;
      for (const nb of nbs) sum += h[nb]!;
      const avg = sum / nbs.length;
      next[i] = h[i]! * 0.4 + avg * 0.6;
    }
    h.set(next);
  }
  return world;
}
