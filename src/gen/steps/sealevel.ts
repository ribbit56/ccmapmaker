/*
  Sea level + water classification (CLAUDE.md §5 steps 4 & 6).

  Cut land/water at config.seaLevel, despeckle tiny islands and puddles so the
  coastline reads clean, then flood-fill from the map border to tell ocean (reaches
  the edge) from lake (enclosed inland water). Finally a BFS records each cell's
  graph distance to the nearest ocean cell — used later for moisture and coastal
  rendering.

  Pure: mutates world.cells.{isWater, water, oceanDist}.
*/

import type { GenConfig } from '../config';
import { Water, type World } from '@/model/world';

const MIN_LAND_CELLS = 5; // islands smaller than this get drowned
const MIN_LAKE_CELLS = 4; // puddles smaller than this get filled in

export function applySeaLevel(world: World, config: GenConfig): World {
  const { grid, cells } = world;
  const { count, neighbors, points, width, height } = grid;
  const sea = config.seaLevel;

  // 1. Initial land/water by height.
  const water = new Uint8Array(count); // 1 = water (temp), classified below
  for (let i = 0; i < count; i++) water[i] = cells.height[i]! < sea ? 1 : 0;

  // 2. Despeckle: drop tiny land islands, fill tiny enclosed puddles.
  removeSmallComponents(count, neighbors, water, 0, MIN_LAND_CELLS, 1); // land → water
  removeSmallComponents(count, neighbors, water, 1, MIN_LAKE_CELLS, 0); // water → land

  // 3. Ocean vs lake: flood water connectivity from border water cells.
  const isBorder = markBorderCells(points, count, width, height);
  const kind = cells.water;
  kind.fill(Water.land);
  for (let i = 0; i < count; i++) {
    cells.isWater[i] = water[i]!;
    if (water[i]) kind[i] = Water.lake; // assume lake until ocean flood proves otherwise
  }

  const queue: number[] = [];
  for (let i = 0; i < count; i++) {
    if (water[i] && isBorder[i]) {
      kind[i] = Water.ocean;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    for (const nb of neighbors[c]!) {
      if (water[nb] && kind[nb] === Water.lake) {
        kind[nb] = Water.ocean;
        queue.push(nb);
      }
    }
  }

  // 4. Ocean distance BFS (0 at ocean, increasing inland; lakes counted as land).
  computeOceanDist(world);
  return world;
}

/** Mark cells near the canvas edge — these own the outer rim of the sheet. */
function markBorderCells(
  points: Float64Array,
  count: number,
  width: number,
  height: number,
): Uint8Array {
  const border = new Uint8Array(count);
  const margin = Math.max(width, height) * 0.02;
  for (let i = 0; i < count; i++) {
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    if (x < margin || y < margin || x > width - margin || y > height - margin) border[i] = 1;
  }
  return border;
}

/**
 * Flip connected components of `value` that are smaller than `minSize` to `to`.
 * Used to remove specks of land and puddles of water.
 */
function removeSmallComponents(
  count: number,
  neighbors: number[][],
  field: Uint8Array,
  value: number,
  minSize: number,
  to: number,
): void {
  const seen = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (seen[i] || field[i] !== value) continue;
    const comp: number[] = [i];
    seen[i] = 1;
    for (let head = 0; head < comp.length; head++) {
      const c = comp[head]!;
      for (const nb of neighbors[c]!) {
        if (!seen[nb] && field[nb] === value) {
          seen[nb] = 1;
          comp.push(nb);
        }
      }
    }
    if (comp.length < minSize) for (const c of comp) field[c] = to;
  }
}

function computeOceanDist(world: World): void {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const dist = cells.oceanDist;
  dist.fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < count; i++) {
    if (cells.water[i] === Water.ocean) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    const d = dist[c]! + 1;
    for (const nb of neighbors[c]!) {
      if (dist[nb] === -1) {
        dist[nb] = d > 32767 ? 32767 : d;
        queue.push(nb);
      }
    }
  }
}
