/*
  Hydrology (CLAUDE.md §5 step 10). Route water downhill, accumulate flow, and emit
  rivers where it gathers; group inland water into lakes.

  1. Priority-flood from the outlets (ocean + lakes): fills depressions so every land
     cell has a monotonic downhill path to water, and records each cell's receiver
     (the cell it drains into) — a drainage tree rooted at the sea.
  2. Flux accumulation: each land cell starts with rainfall (wetter cells contribute
     more) and pushes its flux to its receiver, processed high→low.
  3. River extraction: cells whose flux crosses a density-driven threshold become
     river cells; trace them from headwaters down to the sea/lake into polylines,
     with width tapering from source (thin) to mouth (thick).

  Pure: mutates world.rivers and world.lakes.
*/

import { MinHeap } from '@/lib/heap';
import { Water, type World, type River, type Lake } from '@/model/world';
import type { GenConfig } from '../config';

export function generateHydrology(world: World, config: GenConfig): World {
  const { grid, cells } = world;
  const { count } = grid;

  const { filled, receiver } = priorityFlood(world);
  const flux = accumulateFlux(world, filled, receiver);

  // Flux threshold for a visible river — higher riverDensity → lower threshold.
  const threshold = 34 - config.riverDensity * 24; // density 0→34, 1→10

  const isRiver = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (cells.water[i] === Water.land && flux[i]! > threshold) isRiver[i] = 1;
  }

  world.rivers = traceRivers(world, receiver, flux, isRiver, threshold);
  world.lakes = groupLakes(world);

  // Record flux on the cell field for later phases (settlement scoring, etc.).
  cells.flux.set(flux);
  return world;
}

/** Barnes priority-flood: fill pits and build the drainage tree toward the outlets. */
function priorityFlood(world: World): { filled: Float32Array; receiver: Int32Array } {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const h = cells.height;
  const filled = new Float32Array(count);
  const receiver = new Int32Array(count).fill(-1);
  const visited = new Uint8Array(count);
  const heap = new MinHeap();
  const EPS = 1e-5;

  // Seed every outlet (ocean + lake) at its own height.
  for (let i = 0; i < count; i++) {
    if (cells.water[i] !== Water.land) {
      filled[i] = h[i]!;
      visited[i] = 1;
      heap.push(i, filled[i]!);
    }
  }

  while (heap.size > 0) {
    const c = heap.pop();
    for (const n of neighbors[c]!) {
      if (visited[n]) continue;
      visited[n] = 1;
      filled[n] = Math.max(h[n]!, filled[c]! + EPS);
      receiver[n] = c; // n drains into c
      heap.push(n, filled[n]!);
    }
  }
  return { filled, receiver };
}

/** Accumulate rainfall downstream along the drainage tree (process high→low). */
function accumulateFlux(world: World, filled: Float32Array, receiver: Int32Array): Float32Array {
  const { grid, cells } = world;
  const { count } = grid;
  const flux = new Float32Array(count);

  const land: number[] = [];
  for (let i = 0; i < count; i++) {
    if (cells.water[i] === Water.land) {
      flux[i] = 0.8 + cells.moisture[i]! * 1.4; // wetter ground sheds more water
      land.push(i);
    }
  }
  land.sort((a, b) => filled[b]! - filled[a]!); // upstream (high) first
  for (const i of land) {
    const r = receiver[i]!;
    if (r >= 0) flux[r]! += flux[i]!;
  }
  return flux;
}

/** Trace river cells from headwaters to the sea/lake; no segment is drawn twice. */
function traceRivers(
  world: World,
  receiver: Int32Array,
  flux: Float32Array,
  isRiver: Uint8Array,
  threshold: number,
): River[] {
  const { grid, cells } = world;
  const { count, points } = grid;

  // In-degree among river cells → headwaters are river cells nothing flows into.
  const inDeg = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    if (!isRiver[i]) continue;
    const r = receiver[i]!;
    if (r >= 0 && isRiver[r]) inDeg[r]!++;
  }

  const width = (f: number) => {
    const w = 0.7 + Math.sqrt(Math.max(0, f - threshold) + 1) * 0.42;
    return Math.min(8, w);
  };
  const sx = (i: number) => points[i * 2]!;
  const sy = (i: number) => points[i * 2 + 1]!;

  const visited = new Uint8Array(count);
  const rivers: River[] = [];

  for (let head = 0; head < count; head++) {
    if (!isRiver[head] || inDeg[head] !== 0 || visited[head]) continue;

    const pts: [number, number][] = [];
    const widths: number[] = [];
    let cur = head;
    for (;;) {
      pts.push([sx(cur), sy(cur)]);
      widths.push(width(flux[cur]!));
      visited[cur] = 1;
      const r = receiver[cur]!;
      if (r < 0) break;
      if (cells.water[r] !== Water.land) {
        // Reached the sea or a lake — run the mouth a touch into the water.
        pts.push([sx(r), sy(r)]);
        widths.push(widths[widths.length - 1]! * 1.15);
        break;
      }
      if (visited[r] || !isRiver[r]) {
        // Merge into an existing trunk (or a sub-threshold cell): connect & stop.
        pts.push([sx(r), sy(r)]);
        widths.push(width(flux[r]!));
        break;
      }
      cur = r;
    }

    if (pts.length >= 3 && pathLength(pts) > 22) {
      rivers.push({ id: `r${rivers.length}`, points: pts, widthByPoint: widths });
    }
  }
  return rivers;
}

/** Group connected lake water cells into Lake records. */
function groupLakes(world: World): Lake[] {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const seen = new Uint8Array(count);
  const lakes: Lake[] = [];

  for (let i = 0; i < count; i++) {
    if (seen[i] || cells.water[i] !== Water.lake) continue;
    const comp: number[] = [i];
    seen[i] = 1;
    for (let head = 0; head < comp.length; head++) {
      for (const n of neighbors[comp[head]!]!) {
        if (!seen[n] && cells.water[n] === Water.lake) {
          seen[n] = 1;
          comp.push(n);
        }
      }
    }
    lakes.push({ id: `l${lakes.length}`, cells: comp });
  }
  return lakes;
}

function pathLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  }
  return len;
}
