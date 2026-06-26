/*
  Moisture (CLAUDE.md §5 step 8). Two contributions, blended:

    - coastal proximity: wetter near the ocean (from the oceanDist BFS),
    - a simplified prevailing-wind rain-shadow: humidity picked up over the sea is
      carried downwind and rained out as it climbs terrain, so windward mountain
      slopes are lush and leeward interiors fall dry.

  Plus a little noise and the global moisture bias. Pure: mutates cells.moisture.
*/

import { makeFbm } from '../noise';
import { Water, type World } from '@/model/world';
import type { Rng } from '../rng';
import type { GenConfig } from '../config';

export function generateMoisture(world: World, config: GenConfig, rng: Rng): World {
  const { grid, cells } = world;
  const { points, count, neighbors, width, height } = grid;

  // Prevailing wind: mostly westerly, with a seeded tilt for variety.
  const angle = rng.float(-0.5, 0.5);
  const wx = Math.cos(angle);
  const wy = Math.sin(angle);
  const proj = (i: number) => points[i * 2]! * wx + points[i * 2 + 1]! * wy;

  // Sweep cells from upwind to downwind, carrying humidity that rains out on climbs.
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => proj(a) - proj(b));
  const humidity = new Float32Array(count);
  const rain = new Float32Array(count);

  for (const i of order) {
    if (cells.water[i] !== Water.land) {
      humidity[i] = 1; // open water replenishes the air
      continue;
    }
    const pc = proj(i);
    let hin = 0;
    let srcHeight = cells.height[i]!;
    for (const nb of neighbors[i]!) {
      if (proj(nb) < pc && humidity[nb]! > hin) {
        hin = humidity[nb]!;
        srcHeight = cells.height[nb]!;
      }
    }
    if (hin === 0) hin = 0.3; // landlocked-from-windward fallback
    const climb = Math.max(0, cells.height[i]! - srcHeight);
    const fall = Math.min(hin, hin * (0.25 + climb * 3.5)); // rains more on the climb
    rain[i] = fall;
    humidity[i] = Math.max(0, hin - fall) + 0.02;
  }

  // Coastal proximity from the ocean-distance BFS.
  const reach = 16;
  const noise = makeFbm(rng, { octaves: 3, frequency: 3.2, gain: 0.5 });
  const biasShift = (config.moistureBias - 0.5) * 0.5;

  for (let i = 0; i < count; i++) {
    const od = cells.oceanDist[i]!;
    const coastal = od < 0 ? 0.2 : clamp01(1 - od / reach);
    let m = 0.45 * coastal + 0.45 * rain[i]! + biasShift;
    m += (noise(points[i * 2]! / width, points[i * 2 + 1]! / height) - 0.5) * 0.18;
    cells.moisture[i] = clamp01(m);
  }
  return world;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
