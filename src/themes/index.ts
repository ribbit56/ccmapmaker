/*
  Theme registry (CLAUDE.md §8). Themes are data, not code — register one object here
  and it's selectable.
*/

import { OLD_ATLAS } from './oldAtlas';
import { DUSK } from './dusk';
import { VERDANT } from './verdant';
import { MOONLIT } from './moonlit';
import type { Theme, ThemeId } from './types';

export type { Theme, ThemeId } from './types';

const THEMES: Record<ThemeId, Theme> = {
  [OLD_ATLAS.id]: OLD_ATLAS,
  [DUSK.id]: DUSK,
  [VERDANT.id]: VERDANT,
  [MOONLIT.id]: MOONLIT,
};

/** All registered themes in display order (for the theme picker). */
export const ALL_THEMES: Theme[] = [OLD_ATLAS, DUSK, VERDANT, MOONLIT];

export const DEFAULT_THEME = OLD_ATLAS;

export function getTheme(id: ThemeId): Theme {
  return THEMES[id] ?? DEFAULT_THEME;
}
