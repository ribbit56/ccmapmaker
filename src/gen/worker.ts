/*
  World-generation Web Worker (CLAUDE.md §3, §14 Phase 12).

  Generation is the one genuinely heavy thing the app does — a full "roll" builds a
  Voronoi grid, sums noise octaves, floods hydrology and runs A* roads, easily tens
  to hundreds of milliseconds. Running it here keeps the main thread (and therefore
  pan/zoom and every input) perfectly smooth during a roll.

  The worker is stateless: each call takes plain inputs and returns a fresh (or
  caller-supplied, mutated) World. The World is pure structured-cloneable data, so it
  crosses the boundary cleanly; we transfer its typed-array buffers back out so the
  large fields move without a copy. Partial re-rolls receive the current world by
  clone (NOT transfer) so the main thread keeps its live copy intact until the new
  one arrives.
*/

import * as Comlink from 'comlink';
import {
  generateWorld,
  regenerateFeatures,
  regenerateLabels,
  type GenerateOptions,
} from './generate';
import type { World } from '@/model/world';

/** Every typed-array buffer in a World, for zero-copy transfer back to the main thread. */
function transferables(world: World): Transferable[] {
  const c = world.cells;
  const buffers: ArrayBufferLike[] = [
    world.grid.points.buffer,
    c.height.buffer,
    c.moisture.buffer,
    c.temperature.buffer,
    c.isWater.buffer,
    c.water.buffer,
    c.oceanDist.buffer,
    c.biome.buffer,
    c.flux.buffer,
  ];
  for (const poly of world.grid.polygons) buffers.push(poly.buffer);
  // Dedupe: some views may share a buffer; transferring one twice throws.
  return [...new Set(buffers)] as Transferable[];
}

const api = {
  generate(opts: GenerateOptions): World {
    const world = generateWorld(opts);
    return Comlink.transfer(world, transferables(world));
  },

  /** Re-place settlements + roads on the supplied world (mutated and returned). */
  rerollFeatures(world: World, featureSeed: string): World {
    regenerateFeatures(world, featureSeed);
    return Comlink.transfer(world, transferables(world));
  },

  /** Re-roll region/range/water labels on the supplied world (mutated and returned). */
  rerollLabels(world: World, labelSeed: string): World {
    regenerateLabels(world, labelSeed);
    return Comlink.transfer(world, transferables(world));
  },
};

export type GenApi = typeof api;

Comlink.expose(api);
