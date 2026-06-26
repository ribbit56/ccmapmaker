/*
  Verdant (CLAUDE.md §8) — a fresh, storybook map: brighter cream paper with a faint
  green cast, livelier greens, and a clear blue-green sea. Still painterly and soft
  (no pure white, no harsh saturation), but younger and sunnier than Old Atlas —
  the map at the front of a children's fantasy hardback rather than a dusty atlas.
  Aging is light so the colors stay clean.
*/

import { Biome } from '@/model/world';
import type { Theme } from './types';

export const VERDANT: Theme = {
  id: 'verdant',
  name: 'Verdant',

  paper: {
    center: '#f6f0d8',
    edge: '#d9d2ac',
    accentWarm: '#fffbe8',
    accentCool: '#bac190',
    stain: '#9aa063',
    vignette: '#8a8a52',
  },

  ocean: {
    shallow: '#a9cfc6',
    deep: '#5f9aa0',
    halo: 'rgba(222, 238, 222, 0.24)',
    ringInk: '58, 104, 104',
    washAlpha: 0.56,
  },

  land: {
    fill: '#dad9ad',
    shadow: 'rgba(40, 52, 24, 0.24)',
  },

  ink: 'rgba(60, 78, 44, 0.58)',

  glyph: {
    ink: '#4a5a30',
    light: '#e8e6b8',
    shade: '#8aa05c',
    cap: '#f4f1da',
    trunk: '#6a5a34',
  },

  biomes: {
    [Biome.ocean]: '#5f9aa0', // unused by biome layer (water handled by ocean)
    [Biome.lake]: '#6fb0ac', // unused
    [Biome.beach]: '#eee0ac',
    [Biome.plains]: '#cdd488',
    [Biome.grassland]: '#a8c46f',
    [Biome.forest]: '#7eaf5e',
    [Biome.rainforest]: '#5d9a52',
    [Biome.taiga]: '#82ab8e',
    [Biome.tundra]: '#c6cfa0',
    [Biome.snow]: '#ecefe0',
    [Biome.desert]: '#e3d391',
    [Biome.savanna]: '#d8cc77',
    [Biome.marsh]: '#9bb070',
    [Biome.hills]: '#bcc680',
    [Biome.mountain]: '#b6bb96',
    [Biome.glacier]: '#e2ece4',
  },

  aging: { grain: 0.3, vignette: 0.32 },

};
