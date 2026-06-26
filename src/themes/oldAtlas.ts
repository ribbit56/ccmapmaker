/*
  Old Atlas (CLAUDE.md §8, the default) — warm cream paper, sepia ink, muted
  sage/ochre/dusty-blue biomes. The colors are deliberately desaturated and warm so
  the whole sheet reads like the endpapers of an old novel. Biome tones are mid-value
  fills painted over the warm land base.
*/

import { Biome } from '@/model/world';
import type { Theme } from './types';

export const OLD_ATLAS: Theme = {
  id: 'old-atlas',
  name: 'Old Atlas',

  paper: {
    center: '#f3e9d1',
    edge: '#d6c39e',
    accentWarm: '#fff6de',
    accentCool: '#b0966e',
    stain: '#96784e',
    vignette: '#78603c',
  },

  ocean: {
    shallow: '#aec4c1',
    deep: '#6f93a0',
    halo: 'rgba(214, 224, 211, 0.22)',
    ringInk: '74, 92, 102',
    washAlpha: 0.62,
  },

  land: {
    fill: '#d5c9a5',
    shadow: 'rgba(48, 36, 20, 0.28)',
  },

  ink: 'rgba(82, 64, 42, 0.6)',

  glyph: {
    ink: '#5c4630',
    light: '#e7dbb6',
    shade: '#9c8059',
    cap: '#f1ead7',
    trunk: '#6f5536',
  },

  biomes: {
    [Biome.ocean]: '#6f93a0', // unused by biome layer (water handled by ocean)
    [Biome.lake]: '#7ca0ac', // unused
    [Biome.beach]: '#e6d6ab',
    [Biome.plains]: '#cdc796',
    [Biome.grassland]: '#bcc28d',
    [Biome.forest]: '#9aa977',
    [Biome.rainforest]: '#7f9568',
    [Biome.taiga]: '#90a290',
    [Biome.tundra]: '#c3bfa4',
    [Biome.snow]: '#e7e5d9',
    [Biome.desert]: '#ddc896',
    [Biome.savanna]: '#d2bf88',
    [Biome.marsh]: '#a4a87c',
    [Biome.hills]: '#bcb487',
    [Biome.mountain]: '#b3aa8f',
    [Biome.glacier]: '#dfe3df',
  },

  aging: { grain: 0.5, vignette: 0.5 },

};
