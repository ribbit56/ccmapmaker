/*
  Noise helpers (CLAUDE.md §5 step 3). Fractal (fBm) simplex noise for the heightmap
  and, later, moisture. Seeded through src/gen/rng.ts so a seed reproduces terrain.
*/

import { createNoise2D } from 'simplex-noise';
import type { Rng } from './rng';

export interface FbmOptions {
  octaves: number;
  /** Base feature frequency (cycles across one world unit). */
  frequency: number;
  /** Per-octave frequency multiplier. */
  lacunarity: number;
  /** Per-octave amplitude multiplier. */
  gain: number;
}

export const DEFAULT_FBM: FbmOptions = {
  octaves: 5,
  frequency: 1,
  lacunarity: 2,
  gain: 0.5,
};

/**
 * Build a fractal-Brownian-motion sampler over 2-D space. Each octave uses an
 * independent seeded simplex field. Returns values normalised to roughly [0, 1].
 */
export function makeFbm(rng: Rng, opts: Partial<FbmOptions> = {}): (x: number, y: number) => number {
  const o = { ...DEFAULT_FBM, ...opts };
  const noises = Array.from({ length: o.octaves }, () => {
    const r = rng.fork();
    return createNoise2D(() => r.next());
  });
  // Normalisation constant: the maximum possible summed amplitude.
  let maxAmp = 0;
  let amp = 1;
  for (let i = 0; i < o.octaves; i++) {
    maxAmp += amp;
    amp *= o.gain;
  }

  return (x: number, y: number): number => {
    let sum = 0;
    let a = 1;
    let f = o.frequency;
    for (let i = 0; i < o.octaves; i++) {
      sum += noises[i]!(x * f, y * f) * a;
      f *= o.lacunarity;
      a *= o.gain;
    }
    // simplex returns [-1, 1]; fold to [0, 1].
    return (sum / maxAmp) * 0.5 + 0.5;
  };
}
