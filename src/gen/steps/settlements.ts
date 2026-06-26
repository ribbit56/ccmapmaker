/*
  Settlements & landmarks (CLAUDE.md §5 steps 11 & 13).

  Every land cell is scored for habitability (coastal +, on/near a river +, flat +,
  temperate +, fresh-water +; harsh biomes and steep/high ground −). The best cells
  are selected with spacing so settlements never clump, ranked into
  capital/city/town/village by score, and coastal ones flagged as ports. A few
  dramatic landmarks (towers, fortresses, ruins, temples) are then scattered in
  fitting spots away from the towns. Finally everything is given a seeded fantasy
  name with a flavour matching its setting.

  Pure: mutates world.features.
*/

import { makeNamer, type NameFlavor } from './naming';
import { Biome, Water, type Feature, type FeatureKind, type World } from '@/model/world';
import type { GenConfig } from '../config';
import type { Rng } from '../rng';

export function placeSettlements(world: World, config: GenConfig, rng: Rng): World {
  const { grid, cells } = world;
  const { count, points } = grid;
  const W = grid.width;
  const H = grid.height;

  // Score every land cell; collect the habitable ones.
  const score = new Float32Array(count);
  const habitable: number[] = [];
  let landCount = 0;
  for (let i = 0; i < count; i++) {
    if (cells.water[i] !== Water.land) continue;
    landCount++;
    const s = habitability(world, i, rng);
    score[i] = s;
    if (s > -1) habitable.push(i);
  }
  habitable.sort((a, b) => score[b]! - score[a]!);

  // Locked features survive a re-roll; keep them and place around them.
  const locked = world.features.filter((f) => f.locked);
  const features: Feature[] = [];
  const placed: [number, number][] = locked.map((f) => [f.x, f.y]);

  // --- Settlements -----------------------------------------------------------
  const target = clampInt(Math.round((landCount / 165) * (0.45 + config.settlementCount * 1.3)), 5, 64);
  const minDist = Math.sqrt((W * H * (landCount / count)) / Math.max(1, target)) * 0.72;

  const chosen: number[] = [];
  for (const i of habitable) {
    if (chosen.length >= target) break;
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    if (farEnough(placed, x, y, minDist)) {
      chosen.push(i);
      placed.push([x, y]);
    }
  }

  // Rank by score order: 1 capital, then cities, towns, villages.
  const namer = makeNamer(rng, config.namingStyle);
  const nCity = Math.round(chosen.length * 0.12);
  const nTown = Math.round(chosen.length * 0.28);
  chosen.forEach((i, idx) => {
    let kind: FeatureKind;
    let rank: number;
    if (idx === 0) {
      kind = 'capital';
      rank = 4;
    } else if (idx <= nCity) {
      kind = 'city';
      rank = 3;
    } else if (idx <= nCity + nTown) {
      kind = 'town';
      rank = 2;
    } else {
      kind = 'village';
      rank = 1;
    }
    const port = cells.oceanDist[i] === 1;
    features.push({
      id: `s${idx}`,
      kind,
      x: points[i * 2]!,
      y: points[i * 2 + 1]!,
      rank,
      port,
      name: namer(flavorOf(world, i)),
    });
  });

  // --- Scattered landmarks ---------------------------------------------------
  scatterLandmarks(world, config, rng, features, placed, namer);

  world.features = [...locked, ...features];
  return world;
}

/** Habitability score; returns ≤ −1 for unusable cells. */
function habitability(world: World, i: number, rng: Rng): number {
  const { cells, grid } = world;
  const b = cells.biome[i];
  if (
    b === Biome.mountain ||
    b === Biome.glacier ||
    b === Biome.snow ||
    b === Biome.marsh ||
    b === Biome.desert
  ) {
    return -2;
  }

  let s = 0;
  s += 1 - Math.abs(cells.temperature[i]! - 0.55) * 1.6; // temperate
  s += 0.8 - Math.abs(cells.moisture[i]! - 0.5) * 1.2; // not too wet/dry

  const od = cells.oceanDist[i]!;
  if (od === 1) s += 1.6; // on the coast → great for a port
  else if (od <= 3) s += 0.6;

  s += Math.min(1.2, Math.sqrt(cells.flux[i]!) / 5); // on/near a river

  // Slope: settlements like flat ground.
  let slope = 0;
  const nbs = grid.neighbors[i]!;
  for (const nb of nbs) {
    slope += Math.abs(cells.height[i]! - cells.height[nb]!);
    if (cells.water[nb] === Water.lake) s += 0.7; // fresh water nearby
  }
  slope /= Math.max(1, nbs.length);
  s += 0.6 - slope * 7;

  s -= Math.max(0, cells.height[i]! - 0.6) * 3; // avoid the heights
  if (b === Biome.forest || b === Biome.grassland || b === Biome.plains) s += 0.4;

  return s + rng.jitter(0.25);
}

function flavorOf(world: World, i: number): NameFlavor {
  const { cells } = world;
  if (cells.oceanDist[i] === 1) return 'coast';
  const b = cells.biome[i];
  if (b === Biome.hills) return 'mountain';
  if (b === Biome.forest || b === Biome.rainforest || b === Biome.taiga) return 'forest';
  return 'plain';
}

/** Place a handful of towers/fortresses/ruins/temples in fitting, spaced spots. */
function scatterLandmarks(
  world: World,
  config: GenConfig,
  rng: Rng,
  features: Feature[],
  placed: [number, number][],
  namer: ReturnType<typeof makeNamer>,
): void {
  const { grid, cells } = world;
  const { count, points } = grid;
  const n = features.length;

  // Candidate cells by terrain character.
  const high: number[] = []; // hills / mountain fringe → towers, fortresses
  const remote: number[] = []; // ordinary land away from coast → ruins, temples
  for (let i = 0; i < count; i++) {
    if (cells.water[i] !== Water.land) continue;
    const b = cells.biome[i];
    if (b === Biome.hills || (b === Biome.mountain && cells.height[i]! < 0.78)) high.push(i);
    else if (b !== Biome.marsh && b !== Biome.glacier && cells.oceanDist[i]! > 2) remote.push(i);
  }
  shuffle(high, rng);
  shuffle(remote, rng);

  const scale = 0.5 + config.settlementCount;
  const want: [FeatureKind, number[], number][] = [
    ['tower', high, clampInt(Math.round(n * 0.16 * scale), 1, 6)],
    ['fortress', high, clampInt(Math.round(n * 0.1 * scale), 1, 4)],
    ['ruin', remote, clampInt(Math.round(n * 0.18 * scale), 1, 8)],
    ['temple', remote, clampInt(Math.round(n * 0.08 * scale), 0, 3)],
  ];

  for (const [kind, pool, k] of want) {
    let added = 0;
    for (const i of pool) {
      if (added >= k) break;
      const x = points[i * 2]!;
      const y = points[i * 2 + 1]!;
      if (!farEnough(placed, x, y, 44)) continue;
      placed.push([x, y]);
      features.push({
        id: `${kind}${added}`,
        kind,
        x,
        y,
        name: namer(flavorOf(world, i)),
      });
      added++;
    }
  }
}

function farEnough(placed: [number, number][], x: number, y: number, minDist: number): boolean {
  const d2 = minDist * minDist;
  for (const [px, py] of placed) {
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy < d2) return false;
  }
  return true;
}

function shuffle<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
