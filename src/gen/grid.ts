/*
  Voronoi/Delaunay grid construction (CLAUDE.md §5 steps 1–2).

  Poisson-disc sampling gives evenly-spaced, non-gridded cell sites (so terrain
  never looks like a lattice); d3-delaunay turns them into a Delaunay triangulation
  + clipped Voronoi polygons. We cache neighbour lists and polygons up front since
  every later step (flow, BFS, rendering) reads them repeatedly.
*/

import { Delaunay } from 'd3-delaunay';
import PoissonDiskSampling from 'poisson-disk-sampling';
import type { Rng } from './rng';
import type { GenConfig } from './config';
import type { VoronoiGrid } from '@/model/world';

/**
 * The grid cell whose site is nearest to (x, y) — a linear scan, which is sub-ms
 * for our cell counts and avoids retaining the Delaunay instance. Used by editing
 * tools and the status bar to map a click/cursor to a cell.
 */
export function nearestCell(grid: VoronoiGrid, x: number, y: number): number {
  const { points, count } = grid;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < count; i++) {
    const dx = points[i * 2]! - x;
    const dy = points[i * 2 + 1]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Map detail (0..1) to a Poisson minimum spacing — lower spacing = more cells. */
function spacingForDetail(detail: number): number {
  const t = Math.max(0, Math.min(1, detail));
  return 20 - t * 11; // detail 0 → 20px (~3.7k cells), 1 → 9px (~18k cells)
}

export function buildGrid(
  width: number,
  height: number,
  config: GenConfig,
  rng: Rng,
): VoronoiGrid {
  const minDistance = spacingForDetail(config.detail);
  const pds = new PoissonDiskSampling(
    { shape: [width, height], minDistance, maxDistance: minDistance * 1.8, tries: 18 },
    () => rng.next(),
  );
  const raw = pds.fill();
  const count = raw.length;

  const points = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    points[i * 2] = raw[i]![0];
    points[i * 2 + 1] = raw[i]![1];
  }

  const delaunay = new Delaunay(points);
  const voronoi = delaunay.voronoi([0, 0, width, height]);

  const neighbors: number[][] = new Array(count);
  const polygons: Float64Array[] = new Array(count);
  for (let i = 0; i < count; i++) {
    neighbors[i] = Array.from(delaunay.neighbors(i));
    const poly = voronoi.cellPolygon(i);
    // cellPolygon returns a closed ring ([…, first] repeated); drop the closer.
    if (poly && poly.length > 1) {
      const n = poly.length - 1;
      const flat = new Float64Array(n * 2);
      for (let k = 0; k < n; k++) {
        flat[k * 2] = poly[k]![0];
        flat[k * 2 + 1] = poly[k]![1];
      }
      polygons[i] = flat;
    } else {
      polygons[i] = new Float64Array(0);
    }
  }

  return { count, width, height, points, neighbors, polygons };
}
