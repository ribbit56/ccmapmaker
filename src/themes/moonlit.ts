/*
  Moonlit (CLAUDE.md §8) — a cool, nighttime/elven chart drawn in silver and slate.
  The paper is a desaturated blue-grey rather than cream, lit by a faint cool glow.
  Inks are a deep indigo-slate; biomes shed their warmth and slide toward blue-green,
  teal and frost so the whole sheet feels lit by moon rather than sun. Sands become
  cool grey-tan; snow and glacier go faintly blue. Aging is moderate.
*/

import { Biome } from '@/model/world';
import type { Theme } from './types';

export const MOONLIT: Theme = {
  id: 'moonlit',
  name: 'Moonlit',

  paper: {
    center: '#d2d9de',
    edge: '#9aa6b2',
    accentWarm: '#e6ecef',
    accentCool: '#7d8a99',
    stain: '#5d6878',
    vignette: '#2f3946',
  },

  ocean: {
    shallow: '#7e93a8',
    deep: '#3f5066',
    halo: 'rgba(198, 214, 228, 0.20)',
    ringInk: '40, 52, 70',
    washAlpha: 0.64,
  },

  land: {
    fill: '#aeb6b8',
    shadow: 'rgba(18, 26, 40, 0.34)',
  },

  ink: 'rgba(40, 50, 70, 0.62)',

  glyph: {
    ink: '#2c3848',
    light: '#c3ccce',
    shade: '#74808f',
    cap: '#e2e8ec',
    trunk: '#48505c',
  },

  biomes: {
    [Biome.ocean]: '#3f5066', // unused by biome layer (water handled by ocean)
    [Biome.lake]: '#4d6072', // unused
    [Biome.beach]: '#c2c3b4',
    [Biome.plains]: '#a6b09e',
    [Biome.grassland]: '#94a896',
    [Biome.forest]: '#74927f',
    [Biome.rainforest]: '#5f8275',
    [Biome.taiga]: '#7c9293',
    [Biome.tundra]: '#aeb6b0',
    [Biome.snow]: '#dde4e6',
    [Biome.desert]: '#bdbca2',
    [Biome.savanna]: '#b3b496',
    [Biome.marsh]: '#85978a',
    [Biome.hills]: '#a3aa9a',
    [Biome.mountain]: '#9aa3a6',
    [Biome.glacier]: '#d6e0e6',
  },

  aging: { grain: 0.42, vignette: 0.54 },

};
