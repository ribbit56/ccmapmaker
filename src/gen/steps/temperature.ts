/*
  Temperature (CLAUDE.md §5 step 7). Warm at the equator (vertical centre of the
  sheet), cold toward the poles (top/bottom edges), minus an altitude lapse so high
  ground is colder. A global bias shifts the whole world icy↔tropical, and a little
  noise breaks up the latitude bands.

  Pure: mutates world.cells.temperature (0..1).
*/

import { makeFbm } from '../noise';
import type { Rng } from '../rng';
import type { GenConfig } from '../config';
import type { World } from '@/model/world';

export function generateTemperature(world: World, config: GenConfig, rng: Rng): World {
  const { grid, cells } = world;
  const { points, count, height: H } = grid;
  const noise = makeFbm(rng, { octaves: 3, frequency: 2.6, gain: 0.5 });
  const biasShift = (config.temperatureBias - 0.5) * 0.7;

  for (let i = 0; i < count; i++) {
    const ny = points[i * 2 + 1]! / H;
    const latitude = 1 - Math.abs(ny - 0.5) * 2; // 1 equator → 0 poles
    const altitude = Math.max(0, cells.height[i]! - config.seaLevel);

    let t = latitude - altitude * 1.15 + biasShift;
    t += (noise(points[i * 2]! / grid.width, ny) - 0.5) * 0.12;
    cells.temperature[i] = clamp01(t);
  }
  return world;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
