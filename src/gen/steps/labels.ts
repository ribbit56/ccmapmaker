/*
  Label generation (CLAUDE.md §5 step 14). Produces the map's geographic labels:

    - region labels at the centroid of a large biome cluster ("Aelmor Forest"),
    - range labels with a spine curve fitted along a mountain cluster ("Thal Peaks"),
    - water labels in open sea and on lakes ("The Vorn Sea", "Lake Esk").

  Settlement names are rendered straight from the features by the labels layer, so
  they aren't duplicated here. Placement positions are computed; the layer does the
  final collision avoidance. Pure: mutates world.labels.
*/

import { makeNamer, type NameFlavor } from './naming';
import { Biome, Water, type BiomeId, type Label, type World } from '@/model/world';
import type { GenConfig } from '../config';
import type { Rng } from '../rng';

type RegionGroup = 'forest' | 'plains' | 'desert' | 'cold' | 'marsh' | 'hills';

const GROUP_DESCRIPTORS: Record<RegionGroup, string[]> = {
  forest: ['Forest', 'Wood', 'Woods', 'Wilds'],
  plains: ['Plains', 'Vale', 'Downs', 'Fields', 'Reach', 'Meadows'],
  desert: ['Desert', 'Waste', 'Sands', 'Barrens'],
  cold: ['Tundra', 'Reach', 'Wastes', 'Steppe'],
  marsh: ['Marsh', 'Fen', 'Mire', 'Moor'],
  hills: ['Hills', 'Highlands', 'Downs'],
};
const GROUP_FLAVOR: Record<RegionGroup, NameFlavor> = {
  forest: 'forest',
  plains: 'plain',
  desert: 'plain',
  cold: 'mountain',
  marsh: 'plain',
  hills: 'mountain',
};
const RANGE_DESCRIPTORS = ['Mountains', 'Range', 'Peaks', 'Heights', 'Spires'];

const MIN_REGION = 55;
const MAX_REGIONS = 9;
const MIN_RANGE = 22;
const MAX_RANGES = 6;
const MIN_LAKE = 10;

export function generateLabels(world: World, config: GenConfig, rng: Rng): World {
  const namer = makeNamer(rng, config.namingStyle);
  const locked = world.labels.filter((l) => l.locked);
  const labels: Label[] = [];

  regionLabels(world, rng, namer, labels);
  rangeLabels(world, namer, labels);
  waterLabels(world, namer, labels);

  world.labels = [...locked, ...labels];
  return world;
}

function regionGroup(b: BiomeId): RegionGroup | null {
  switch (b) {
    case Biome.forest:
    case Biome.rainforest:
    case Biome.taiga:
      return 'forest';
    case Biome.plains:
    case Biome.grassland:
    case Biome.savanna:
      return 'plains';
    case Biome.desert:
      return 'desert';
    case Biome.tundra:
    case Biome.snow:
      return 'cold';
    case Biome.marsh:
      return 'marsh';
    case Biome.hills:
      return 'hills';
    default:
      return null;
  }
}

function regionLabels(world: World, rng: Rng, namer: ReturnType<typeof makeNamer>, out: Label[]): void {
  const { grid, cells } = world;
  const comps = components(world, (i) => {
    const g = regionGroup(cells.biome[i] as BiomeId);
    return g === null ? null : g;
  });
  comps
    .filter((c) => c.cells.length >= MIN_REGION)
    .sort((a, b) => b.cells.length - a.cells.length)
    .slice(0, MAX_REGIONS)
    .forEach((c, i) => {
      const [cx, cy] = centroidCell(grid, c.cells);
      const group = c.key as RegionGroup;
      out.push({
        id: `rg${i}`,
        role: 'region',
        text: `${namer(GROUP_FLAVOR[group])} ${rng.pick(GROUP_DESCRIPTORS[group])}`,
        x: cx,
        y: cy,
      });
    });
}

function rangeLabels(world: World, namer: ReturnType<typeof makeNamer>, out: Label[]): void {
  const { grid, cells } = world;
  const comps = components(world, (i) =>
    cells.biome[i] === Biome.mountain || cells.biome[i] === Biome.glacier ? 'mtn' : null,
  );
  comps
    .filter((c) => c.cells.length >= MIN_RANGE)
    .sort((a, b) => b.cells.length - a.cells.length)
    .slice(0, MAX_RANGES)
    .forEach((c, i) => {
      const spine = fitSpine(grid, c.cells);
      const mid = spine[Math.floor(spine.length / 2)]!;
      out.push({
        id: `rng${i}`,
        role: 'range',
        text: `${namer('mountain')} ${RANGE_DESCRIPTORS[i % RANGE_DESCRIPTORS.length]}`,
        x: mid[0],
        y: mid[1],
        curve: spine,
        rotation: Math.atan2(spine[spine.length - 1]![1] - spine[0]![1], spine[spine.length - 1]![0] - spine[0]![0]),
      });
    });
}

function waterLabels(world: World, namer: ReturnType<typeof makeNamer>, out: Label[]): void {
  const { grid, cells } = world;
  const { count, neighbors, points } = grid;

  // Sea depth: BFS distance from land into the ocean → open sea is deepest.
  const depth = new Int32Array(count).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < count; i++) {
    if (cells.water[i] === Water.land) {
      depth[i] = 0;
      queue.push(i);
    }
  }
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!;
    for (const nb of neighbors[c]!) {
      if (cells.water[nb] === Water.ocean && depth[nb] === -1) {
        depth[nb] = depth[c]! + 1;
        queue.push(nb);
      }
    }
  }
  // Pick up to two deep, well-separated open-sea cells.
  const deep = [];
  for (let i = 0; i < count; i++) if (depth[i]! > 6) deep.push(i);
  deep.sort((a, b) => depth[b]! - depth[a]!);
  const seaSpots: number[] = [];
  for (const i of deep) {
    if (seaSpots.length >= 2) break;
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    if (seaSpots.every((s) => Math.hypot(points[s * 2]! - x, points[s * 2 + 1]! - y) > grid.width * 0.3)) {
      seaSpots.push(i);
    }
  }
  seaSpots.forEach((i, k) => {
    out.push({
      id: `sea${k}`,
      role: 'water',
      text: k === 0 ? `The ${namer('coast')} Sea` : `${namer('coast')} Ocean`,
      x: points[i * 2]!,
      y: points[i * 2 + 1]!,
    });
  });

  // Lakes.
  world.lakes
    .filter((l) => l.cells.length >= MIN_LAKE)
    .forEach((l, k) => {
      const [cx, cy] = centroidCell(grid, l.cells);
      out.push({ id: `lake${k}`, role: 'water', text: `Lake ${namer('coast')}`, x: cx, y: cy });
    });
}

// --- helpers ---------------------------------------------------------------

interface Component {
  key: string;
  cells: number[];
}

/** Connected components of land cells sharing the same group key (null = excluded). */
function components(world: World, groupOf: (i: number) => string | null): Component[] {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const seen = new Uint8Array(count);
  const result: Component[] = [];
  for (let i = 0; i < count; i++) {
    if (seen[i] || cells.water[i] !== Water.land) continue;
    const key = groupOf(i);
    if (key === null) {
      seen[i] = 1;
      continue;
    }
    const comp: number[] = [i];
    seen[i] = 1;
    for (let h = 0; h < comp.length; h++) {
      for (const nb of neighbors[comp[h]!]!) {
        if (!seen[nb] && cells.water[nb] === Water.land && groupOf(nb) === key) {
          seen[nb] = 1;
          comp.push(nb);
        }
      }
    }
    result.push({ key, cells: comp });
  }
  return result;
}

/** Cell site nearest the cluster centroid (keeps the label inside the cluster). */
function centroidCell(grid: World['grid'], cellIds: number[]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const i of cellIds) {
    sx += grid.points[i * 2]!;
    sy += grid.points[i * 2 + 1]!;
  }
  const cx = sx / cellIds.length;
  const cy = sy / cellIds.length;
  let best = cellIds[0]!;
  let bestD = Infinity;
  for (const i of cellIds) {
    const d = (grid.points[i * 2]! - cx) ** 2 + (grid.points[i * 2 + 1]! - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [grid.points[best * 2]!, grid.points[best * 2 + 1]!];
}

/** Fit a gentle spine curve along a cluster's principal axis (for curved labels). */
function fitSpine(grid: World['grid'], cellIds: number[]): [number, number][] {
  let cx = 0;
  let cy = 0;
  for (const i of cellIds) {
    cx += grid.points[i * 2]!;
    cy += grid.points[i * 2 + 1]!;
  }
  cx /= cellIds.length;
  cy /= cellIds.length;

  // 2×2 covariance → principal axis angle.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const i of cellIds) {
    const dx = grid.points[i * 2]! - cx;
    const dy = grid.points[i * 2 + 1]! - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const px = -dy;
  const py = dx;

  // Bucket cells by projection along the axis; average perpendicular offset per
  // bucket → a spine that follows the range's bend.
  const BINS = 5;
  let tmin = Infinity;
  let tmax = -Infinity;
  for (const i of cellIds) {
    const t = (grid.points[i * 2]! - cx) * dx + (grid.points[i * 2 + 1]! - cy) * dy;
    if (t < tmin) tmin = t;
    if (t > tmax) tmax = t;
  }
  const span = tmax - tmin || 1;
  const sums = new Array(BINS).fill(0);
  const counts = new Array(BINS).fill(0);
  for (const i of cellIds) {
    const ddx = grid.points[i * 2]! - cx;
    const ddy = grid.points[i * 2 + 1]! - cy;
    const t = ddx * dx + ddy * dy;
    const s = ddx * px + ddy * py;
    const bin = Math.min(BINS - 1, Math.floor(((t - tmin) / span) * BINS));
    sums[bin] += s;
    counts[bin] += 1;
  }
  const spine: [number, number][] = [];
  for (let b = 0; b < BINS; b++) {
    if (counts[b] === 0) continue;
    const t = tmin + (span * (b + 0.5)) / BINS;
    const s = sums[b] / counts[b];
    spine.push([cx + dx * t + px * s, cy + dy * t + py * s]);
  }
  if (spine.length < 2) spine.push([cx + dx * tmax, cy + dy * tmax]);
  // Read left → right.
  if (spine[0]![0] > spine[spine.length - 1]![0]) spine.reverse();
  return spine;
}
