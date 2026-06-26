/*
  Heightmap (CLAUDE.md §5 step 3). Sum fBm simplex octaves per cell, then shape the
  landmass with a mask so land tends inward and the sheet gets an ocean margin
  (config.shape). mountainDensity redistributes heights — more density lifts more
  terrain above the eventual sea-level cut into highlands.

  Three mask strategies:
  - pangaea / continent: radial edge-sink + optional frag noise.
  - archipelago / islands: multi-peak bump mask — guarantees N distinct island centers.
  - coast: directional edge-sink on one side only; orientation picked from seed so the
    map feels like a portion of a larger landmass viewed from the coast. The other three
    edges bleed off the canvas as full terrain — no ocean there.
  - inland: no edge sink at all; fBm terrain stands freely. Border cells stay above sea
    level, so the ocean flood-fill finds no seed cells and all low areas become lakes.

  Pure: (world, config, rng) → mutates world.cells.height.
*/

import { makeFbm } from '../noise';
import type { Rng } from '../rng';
import type { GenConfig, WorldShape } from '../config';
import type { World } from '@/model/world';

interface ShapeParams {
  // --- Edge-sink mode (pangaea, continent) ---
  inner: number;
  sink: number;
  frag: number;
  // --- Multi-peak mode (archipelago, islands) ---
  peaks: number;
  peakR: number;
  // --- Directional coast mode ---
  coastMode: boolean;
  // --- Inland mode (no ocean) ---
  inlandMode: boolean;
}

const SHAPES: Record<WorldShape, ShapeParams> = {
  pangaea:     { inner: 0.55, sink: 0.75, frag: 0,    peaks: 0,  peakR: 0,    coastMode: false, inlandMode: false },
  continent:   { inner: 0.34, sink: 0.95, frag: 0.12, peaks: 0,  peakR: 0,    coastMode: false, inlandMode: false },
  archipelago: { inner: 0,    sink: 0,    frag: 0,    peaks: 7,  peakR: 0.22, coastMode: false, inlandMode: false },
  islands:     { inner: 0,    sink: 0,    frag: 0,    peaks: 14, peakR: 0.13, coastMode: false, inlandMode: false },
  // Coast: ocean on one edge (direction randomised from seed), land fills the other three.
  coast:       { inner: 0,    sink: 0,    frag: 0,    peaks: 0,  peakR: 0,    coastMode: true,  inlandMode: false },
  // Inland: fBm terrain with no ocean. Low areas become lakes via sealevel flood-fill.
  inland:      { inner: 0,    sink: 0,    frag: 0,    peaks: 0,  peakR: 0,    coastMode: false, inlandMode: true  },
};

export function generateHeightmap(world: World, config: GenConfig, rng: Rng): World {
  const { grid, cells } = world;
  const { points, count, width, height } = grid;
  const sp = SHAPES[config.shape];
  const aspect = width / height;

  const base = makeFbm(rng, { octaves: 5, frequency: 2.2, gain: 0.52 });
  // Frag noise only consumed by continent; always advance rng so other shapes don't shift.
  const fragNoise = makeFbm(rng, { octaves: 2, frequency: 3.4, gain: 0.5 });

  const exponent = 1.5 - config.mountainDensity * 0.85;

  // --- Multi-peak: build island centers -----------------------------------------
  let peakCenters: [number, number][] = [];
  if (sp.peaks > 0) {
    const minSep = sp.peakR * 0.75;
    let tries = 0;
    while (peakCenters.length < sp.peaks && tries < sp.peaks * 60) {
      tries++;
      const cx = 0.14 + rng.next() * 0.72;
      const cy = 0.14 + rng.next() * 0.72;
      const tooClose = peakCenters.some(([ex, ey]) => {
        const ddx = (cx - ex) * aspect;
        const ddy = cy - ey;
        return Math.hypot(ddx, ddy) < minSep;
      });
      if (!tooClose) peakCenters.push([cx, cy]);
    }
  }

  // --- Coast: pick which edge faces the ocean (0=south 1=west 2=north 3=east) ----
  // Consume rng here so the orientation is part of the terrain seed and reproducible,
  // but only for 'coast' so other shapes' sequences are unaffected.
  const coastSide = sp.coastMode ? rng.int(0, 3) : 0;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = points[i * 2]!;
    const y = points[i * 2 + 1]!;
    const nx = x / width;
    const ny = y / height;

    let h = base(nx, ny);

    if (sp.peaks > 0) {
      // Multi-peak: suppress height outside island bumps.
      let bump = 0;
      for (const [cx, cy] of peakCenters) {
        const ddx = (nx - cx) * aspect;
        const ddy = ny - cy;
        const d = Math.hypot(ddx, ddy) / sp.peakR;
        if (d < 1) {
          const t = 1 - d;
          bump = Math.max(bump, t * t * (3 - 2 * t));
        }
      }
      h *= bump;
    } else if (sp.coastMode) {
      // Directional sink: map each orientation to a 0-1 "depth toward ocean" value.
      // nyDir = 1 at the ocean edge, 0 at the opposite inland edge.
      let nyDir: number;
      switch (coastSide) {
        case 1:  nyDir = 1 - nx; break; // west edge is ocean
        case 2:  nyDir = 1 - ny; break; // north edge is ocean
        case 3:  nyDir = nx;     break; // east edge is ocean
        default: nyDir = ny;     break; // south edge is ocean (default)
      }
      // Strong gradient: near the ocean edge (nyDir→1) terrain sinks well below sea
      // level; the other three edges stay at full fBm height.
      h -= smoothstep(0.52, 1.0, nyDir) * 1.35;
    } else if (!sp.inlandMode) {
      // Radial edge-sink for pangaea / continent.
      const dx = (nx - 0.5) * 2;
      const dy = (ny - 0.5) * 2;
      const d = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2 / 0.85);
      h -= smoothstep(sp.inner, 1, d) * sp.sink;
      if (sp.frag > 0) h -= (1 - fragNoise(nx, ny)) * sp.frag;
    }
    // inlandMode: no modification — raw fBm terrain, all edges stay high.

    h = clamp01(h);
    cells.height[i] = h;
    if (h < min) min = h;
    if (h > max) max = h;
  }

  const span = max - min || 1;
  for (let i = 0; i < count; i++) {
    const n = (cells.height[i]! - min) / span;
    cells.height[i] = Math.pow(n, exponent);
  }

  return world;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
