/*
  The World data model (CLAUDE.md §4) — the pure, serializable source of truth.
  Generation writes it; tools mutate it; the renderer reads it; export serializes it.

  Per-cell scalar fields live in parallel typed arrays indexed by CellId (compact,
  fast). Phase 1 populates `height`, `isWater`, and the ocean/lake split; the
  remaining fields are allocated (zeroed) so the model shape stays stable and later
  phases just fill them in.
*/

import { SCHEMA_VERSION } from './schema';
import type { GenConfig } from '@/gen/config';

export type Seed = string;
export type CellId = number;

/** Biome classification (CLAUDE.md §4). Index = value stored in CellFields.biome. */
export const Biome = {
  ocean: 0,
  lake: 1,
  beach: 2,
  plains: 3,
  grassland: 4,
  forest: 5,
  rainforest: 6,
  taiga: 7,
  tundra: 8,
  snow: 9,
  desert: 10,
  savanna: 11,
  marsh: 12,
  hills: 13,
  mountain: 14,
  glacier: 15,
} as const;
export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** Water classification stored in CellFields.water. */
export const Water = { land: 0, ocean: 1, lake: 2 } as const;
export type WaterKind = (typeof Water)[keyof typeof Water];

/** Geometry only — points, neighbour lists, and clipped Voronoi polygons. */
export interface VoronoiGrid {
  count: number;
  width: number;
  height: number;
  /** Cell site coordinates, packed [x0, y0, x1, y1, …]. */
  points: Float64Array;
  /** Per-cell neighbour cell ids. */
  neighbors: number[][];
  /** Per-cell clipped polygon, packed [x0, y0, x1, y1, …]. */
  polygons: Float64Array[];
}

/** Per-cell scalar fields, all indexed by CellId (CLAUDE.md §4). */
export interface CellFields {
  height: Float32Array; // 0..1, sea level is a config cut
  moisture: Float32Array; // 0..1
  temperature: Float32Array; // 0..1
  isWater: Uint8Array; // 1 if ocean or lake
  water: Uint8Array; // WaterKind: land / ocean / lake
  oceanDist: Int16Array; // graph distance to nearest ocean cell (−1 = land sink/unset)
  biome: Uint8Array; // BiomeId
  flux: Float32Array; // accumulated water flow (rivers)
}

export interface River {
  id: string;
  points: [number, number][];
  widthByPoint: number[];
}
export interface Lake {
  id: string;
  cells: number[];
}
export interface Road {
  id: string;
  points: [number, number][];
  kind: 'road' | 'trail';
}

export type FeatureKind =
  | 'capital'
  | 'city'
  | 'town'
  | 'village'
  | 'fortress'
  | 'ruin'
  | 'temple'
  | 'tower'
  | 'port'
  | 'mountainPeak'
  | 'compass'
  | 'shipDecor'
  | 'monsterDecor';

export interface Feature {
  id: string;
  kind: FeatureKind;
  x: number;
  y: number;
  rank?: number;
  name?: string;
  /** Coastal settlement (drives a small harbour accent). */
  port?: boolean;
  locked?: boolean;
}

export interface Label {
  id: string;
  text: string;
  x: number;
  y: number;
  role: 'region' | 'settlement' | 'water' | 'range' | 'title';
  rotation?: number;
  curve?: [number, number][];
  locked?: boolean;
}

export interface World {
  meta: { name: string; seed: Seed; createdAt: string; schemaVersion: number };
  config: GenConfig;
  themeId: string;
  grid: VoronoiGrid;
  cells: CellFields;
  rivers: River[];
  lakes: Lake[];
  roads: Road[];
  features: Feature[];
  labels: Label[];
  /** Bumped whenever terrain geometry changes (brush edits) so render caches
      (coastline, biome cells) recompute even though the World ref is reused. */
  geomRev: number;
}

/** Allocate zeroed per-cell fields for a grid of `count` cells. */
export function makeCellFields(count: number): CellFields {
  return {
    height: new Float32Array(count),
    moisture: new Float32Array(count),
    temperature: new Float32Array(count),
    isWater: new Uint8Array(count),
    water: new Uint8Array(count),
    oceanDist: new Int16Array(count),
    biome: new Uint8Array(count),
    flux: new Float32Array(count),
  };
}

/** A fresh, empty World skeleton with the given grid (fields zeroed). */
export function emptyWorld(
  seed: Seed,
  name: string,
  config: GenConfig,
  themeId: string,
  grid: VoronoiGrid,
): World {
  return {
    meta: { name, seed, createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION },
    config,
    themeId,
    grid,
    cells: makeCellFields(grid.count),
    rivers: [],
    lakes: [],
    roads: [],
    features: [],
    labels: [],
    geomRev: 0,
  };
}
