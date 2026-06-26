/*
  Dusk (CLAUDE.md §8) — a tea-stained, candle-lit map read by lamplight. The paper
  is deeper and browner than Old Atlas, with a warm amber glow at the light source
  falling off to a smoky umber edge. Inks are darker and redder (oak-gall ink gone
  brown with age); biomes are pushed warm and a touch darker so greens read as olive
  and sands as toasted ochre. Aging runs high — this sheet has seen candles and years.
*/

import { Biome } from '@/model/world';
import type { Theme } from './types';

export const DUSK: Theme = {
  id: 'dusk',
  name: 'Dusk',

  paper: {
    center: '#e3c795',
    edge: '#a07e4f',
    accentWarm: '#f6e1ab',
    accentCool: '#7c5e38',
    stain: '#5e421f',
    vignette: '#3c2912',
  },

  ocean: {
    shallow: '#8a9483',
    deep: '#4f6360',
    halo: 'rgba(214, 196, 150, 0.20)',
    ringInk: '54, 58, 52',
    washAlpha: 0.66,
  },

  land: {
    fill: '#c2a877',
    shadow: 'rgba(34, 22, 8, 0.34)',
  },

  ink: 'rgba(58, 38, 18, 0.66)',

  glyph: {
    ink: '#412c15',
    light: '#d6bd86',
    shade: '#876237',
    cap: '#e6d6a8',
    trunk: '#5a3f20',
  },

  biomes: {
    [Biome.ocean]: '#4f6360', // unused by biome layer (water handled by ocean)
    [Biome.lake]: '#5e716a', // unused
    [Biome.beach]: '#dcc183',
    [Biome.plains]: '#c0ac70',
    [Biome.grassland]: '#aaa363',
    [Biome.forest]: '#858951',
    [Biome.rainforest]: '#6c7846',
    [Biome.taiga]: '#7c8568',
    [Biome.tundra]: '#b3a87f',
    [Biome.snow]: '#ddd4bb',
    [Biome.desert]: '#d4b772',
    [Biome.savanna]: '#cbac64',
    [Biome.marsh]: '#8e8a59',
    [Biome.hills]: '#b09c65',
    [Biome.mountain]: '#a4946d',
    [Biome.glacier]: '#d3d2bf',
  },

  aging: { grain: 0.62, vignette: 0.68 },

};
