/*
  Forest glyph layer (CLAUDE.md §6 step 6) — clusters of tiny tree glyphs over wooded
  cells, scaled by forest coverage. Species varies by biome: spiky conifers in taiga,
  round broadleaves elsewhere. Several jittered trees per cell read as a wood; canopy
  tone is bucketed into a few shades (per-instance variety without exploding the
  sprite cache), and the batch is depth-sorted so nearer trees overlap farther ones.
*/

import { makeRng } from '@/gen/rng';
import { getGlyphSprite, type GlyphKind } from '@/glyphs/spriteCache';
import type { GlyphColors } from '@/glyphs/draw';
import { drawGlyphs, type GlyphInstance } from '../paint';
import { polygonArea, radiusFromArea } from '@/lib/geometry';
import { hexToRgb, rgbStr, shade } from '@/lib/color';
import { Biome, type BiomeId } from '@/model/world';
import type { LayerContext } from '../layer';

// Three canopy tones per biome so a wood mottles rather than reads flat.
const TONES = [-0.07, 0, 0.07];

export function drawForests(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world) return;
  const { grid, cells } = world;
  const rng = makeRng(world.meta.seed, 'forests');
  const g = lc.theme.glyph;
  const coverage = world.config.forestCoverage;

  const glyphs: GlyphInstance[] = [];

  for (let i = 0; i < grid.count; i++) {
    if (cells.isWater[i]) continue;
    const biome = cells.biome[i] as BiomeId;
    const spec = species(biome);
    if (!spec) continue;

    const r = radiusFromArea(polygonArea(grid.polygons[i]!));
    const area = Math.PI * r * r;
    let count = Math.round((area / 44) * (0.5 + coverage * 1.4) * spec.density);
    count = Math.max(1, Math.min(7, count));

    const x0 = grid.points[i * 2]!;
    const y0 = grid.points[i * 2 + 1]!;
    const baseColor = hexToRgb(lc.theme.biomes[biome]);

    for (let t = 0; t < count; t++) {
      const tone = TONES[rng.int(0, TONES.length - 1)]!;
      const colors: GlyphColors = {
        ...g,
        canopy: rgbStr(shade(baseColor, tone)),
        trunk: g.trunk,
      };
      glyphs.push({
        sprite: getGlyphSprite(spec.kind, rng.float(spec.min, spec.max), colors),
        x: x0 + rng.jitter(r * 0.75),
        y: y0 + rng.jitter(r * 0.75),
        scale: rng.float(0.85, 1.12),
        flip: rng.bool(),
      });
    }
  }

  drawGlyphs(ctx, glyphs);
}

interface Species {
  kind: GlyphKind;
  min: number;
  max: number;
  density: number; // multiplier on tree count
}

function species(biome: BiomeId): Species | null {
  switch (biome) {
    case Biome.taiga:
      return { kind: 'conifer', min: 8, max: 12, density: 1 };
    case Biome.forest:
      return { kind: 'broadleaf', min: 8, max: 11, density: 1 };
    case Biome.rainforest:
      return { kind: 'broadleaf', min: 9, max: 13, density: 1.25 };
    case Biome.savanna:
      return { kind: 'broadleaf', min: 8, max: 10, density: 0.3 }; // sparse acacia-ish dots
    default:
      return null;
  }
}
