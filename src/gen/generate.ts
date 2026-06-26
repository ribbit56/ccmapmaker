/*
  World-generation pipeline orchestrator (CLAUDE.md §5).

  Each step is a pure function of (world, config, rng); this composes them into a
  full "roll". Three independent sub-seed streams (terrain / features / labels) let
  one stage be re-rolled without disturbing the others (CLAUDE.md §5, §7): re-roll the
  features seed for new towns over the same land, or the labels seed for new names.
  The partial helpers reuse an existing world's grid + terrain, so they're cheap.

  Runs synchronously on the main thread for now; CLAUDE.md §14 moves it to a Web
  Worker in Phase 12 without changing these signatures.
*/

import { makeRng } from './rng';
import { buildGrid } from './grid';
import { DEFAULT_CONFIG, type GenConfig } from './config';
import { generateHeightmap } from './steps/heightmap';
import { relaxCoast } from './steps/coast';
import { applySeaLevel } from './steps/sealevel';
import { generateTemperature } from './steps/temperature';
import { generateMoisture } from './steps/moisture';
import { classifyBiomes } from './steps/biomes';
import { generateHydrology } from './steps/hydrology';
import { placeSettlements } from './steps/settlements';
import { generateRoads } from './steps/roads';
import { generateLabels } from './steps/labels';
import { emptyWorld, type World } from '@/model/world';

export interface GenerateOptions {
  seed: string;
  name?: string;
  themeId?: string;
  width: number;
  height: number;
  config?: Partial<GenConfig>;
  /** Independent sub-seeds; default to the master seed. */
  terrainSeed?: string;
  featureSeed?: string;
  labelSeed?: string;
}

export function generateWorld(opts: GenerateOptions): World {
  const config: GenConfig = { ...DEFAULT_CONFIG, ...opts.config };
  const terrainRng = makeRng(opts.terrainSeed ?? opts.seed, 'terrain');

  const grid = buildGrid(opts.width, opts.height, config, terrainRng);
  const world = emptyWorld(
    opts.seed,
    opts.name ?? 'Untitled Map',
    config,
    opts.themeId ?? 'old-atlas',
    grid,
  );

  // Terrain.
  generateHeightmap(world, config, terrainRng);
  relaxCoast(world, config);
  applySeaLevel(world, config);
  generateTemperature(world, config, terrainRng);
  generateMoisture(world, config, terrainRng);
  classifyBiomes(world, config);
  generateHydrology(world, config);

  // Features (settlements + roads) and labels, on their own seeds.
  regenerateFeatures(world, opts.featureSeed ?? opts.seed);
  regenerateLabels(world, opts.labelSeed ?? opts.seed);

  return world;
}

/** Re-place settlements (respecting locks) and rebuild roads, in place. */
export function regenerateFeatures(world: World, featureSeed: string): World {
  const rng = makeRng(featureSeed, 'features');
  placeSettlements(world, world.config, rng);
  generateRoads(world, world.config);
  return world;
}

/** Re-roll region/range/water labels (respecting locks), in place. */
export function regenerateLabels(world: World, labelSeed: string): World {
  const rng = makeRng(labelSeed, 'labels');
  generateLabels(world, world.config, rng);
  return world;
}
