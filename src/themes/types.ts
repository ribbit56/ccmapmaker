/*
  Theme token type (CLAUDE.md §8). A Theme is pure data — a named set of colors and
  aging defaults that changes the entire mood without touching geometry. Adding a
  theme is adding one object (see oldAtlas.ts).

  All colors are hex strings; the renderer converts to rgb where it needs to mix or
  apply alpha (src/lib/color.ts).
*/

import type { BiomeId } from '@/model/world';

export type ThemeId = string;

export interface Theme {
  id: ThemeId;
  name: string;

  paper: {
    center: string; // warm highlight at the light source
    edge: string; // cooler/darker toward the edges
    accentWarm: string; // mottle + blotch warm tone
    accentCool: string; // mottle cool tone
    stain: string; // age blotches
    vignette: string; // edge darkening tone
  };

  ocean: {
    shallow: string;
    deep: string;
    halo: string; // shallow-water band hugging the shore
    ringInk: string; // coastal contour rings
    washAlpha: number; // translucency of the depth wash over paper
  };

  land: {
    fill: string; // base land tone under the biome washes
    shadow: string; // drop shadow seating land on the paper
  };

  ink: string; // coastline / general line ink

  /** Relief & forest glyph strokes/fills (CLAUDE.md §6 steps 5–6). */
  glyph: {
    ink: string; // outline / hatching
    light: string; // sun-lit fill (mountains, hills)
    shade: string; // shadowed face / hatch
    cap: string; // snow cap on high peaks
    trunk: string; // tree trunks
  };

  /** Biome color ramp, indexed by BiomeId. ocean/lake are unused by the biome layer. */
  biomes: Record<BiomeId, string>;

  aging: {
    grain: number; // 0..1 default grain strength (Phase 8)
    vignette: number; // 0..1 default vignette strength (Phase 8)
  };

}
