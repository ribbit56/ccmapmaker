/*
  Biome classification (CLAUDE.md §5 step 9). Whittaker-style: each land cell is read
  from temperature × moisture, with altitude overrides (mountain/snow/glacier up
  high), a beach ring next to the ocean, and marsh in warm wet lowlands. Water cells
  carry ocean/lake straight through.

  Pure: mutates world.cells.biome.
*/

import { Biome, Water, type BiomeId, type World } from '@/model/world';
import type { GenConfig } from '../config';

export function classifyBiomes(world: World, config: GenConfig): World {
  const { grid, cells } = world;
  const sea = config.seaLevel;
  const span = 1 - sea || 1;

  for (let i = 0; i < grid.count; i++) {
    const wk = cells.water[i];
    if (wk === Water.ocean) {
      cells.biome[i] = Biome.ocean;
      continue;
    }
    if (wk === Water.lake) {
      cells.biome[i] = Biome.lake;
      continue;
    }
    const hNorm = (cells.height[i]! - sea) / span; // 0 at shore … 1 at the peak
    cells.biome[i] = landBiome(cells.temperature[i]!, cells.moisture[i]!, hNorm, cells.oceanDist[i]!);
  }
  return world;
}

function landBiome(t: number, m: number, hNorm: number, oceanDist: number): BiomeId {
  // Altitude overrides first.
  if (hNorm > 0.8) return t < 0.3 ? Biome.glacier : Biome.mountain;
  if (hNorm > 0.6) return t < 0.22 ? Biome.snow : Biome.mountain;

  // Coastal sand and warm wet lowland marsh.
  if (oceanDist === 1 && hNorm < 0.06) return Biome.beach;
  if (m > 0.72 && hNorm < 0.12 && t > 0.35) return Biome.marsh;

  // Whittaker climate table.
  let b: BiomeId;
  if (t < 0.2) {
    b = t < 0.1 ? Biome.snow : m < 0.4 ? Biome.tundra : Biome.taiga;
  } else if (t < 0.4) {
    b = m < 0.3 ? Biome.grassland : Biome.forest;
  } else if (t < 0.68) {
    b = m < 0.2 ? Biome.plains : m < 0.42 ? Biome.grassland : Biome.forest;
  } else {
    b = m < 0.2 ? Biome.desert : m < 0.45 ? Biome.savanna : m < 0.7 ? Biome.grassland : Biome.rainforest;
  }

  // Upper-mid elevation open land reads as rolling hills.
  if (hNorm > 0.42 && (b === Biome.plains || b === Biome.grassland || b === Biome.savanna)) {
    return Biome.hills;
  }
  return b;
}
