/*
  Relief glyph layer (CLAUDE.md §6 step 5) — small hand-drawn mountains, hills, dunes
  and marsh tufts.

  Mountains get special care so a range reads as a range, not a wall of pasted-on
  triangles:
    - placement is height-prioritised and spaced (greedy: tallest peaks claim their
      ground first, smaller ones fill the gaps), so glyphs overlap a little rather
      than piling up one-per-cell;
    - size scales with altitude (the highest cells become the biggest peaks);
    - atmospheric perspective fades smaller/background peaks toward the paper tone, so
      the range recedes with depth instead of looking stacked.
  Hills/dunes/marsh stay one-per-cell (sparse already). Depth sorting (drawGlyphs)
  makes nearer glyphs overlap farther ones. Randomness flows through the seed.
*/

import { makeRng } from '@/gen/rng';
import { getGlyphSprite, type GlyphKind } from '@/glyphs/spriteCache';
import type { GlyphColors } from '@/glyphs/draw';
import { drawGlyphs, type GlyphInstance } from '../paint';
import { polygonArea, radiusFromArea } from '@/lib/geometry';
import { hexToRgb, mix, rgbStr, shade } from '@/lib/color';
import { Biome, type World } from '@/model/world';
import type { LayerContext } from '../layer';

export function drawRelief(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world) return;
  const { grid, cells } = world;
  const rng = makeRng(world.meta.seed, 'relief');
  const g = lc.theme.glyph;

  const base: GlyphColors = { ...g, canopy: g.shade, trunk: g.trunk };
  const marshColors: GlyphColors = {
    ...base,
    canopy: rgbStr(shade(hexToRgb(lc.theme.biomes[Biome.marsh]), -0.25)),
  };

  const glyphs: GlyphInstance[] = [];
  const mountainCells: number[] = [];

  // Hills/dunes/marsh in the main pass; collect mountain candidates for spacing.
  for (let i = 0; i < grid.count; i++) {
    if (cells.isWater[i]) continue;
    const biome = cells.biome[i];

    if (biome === Biome.mountain || biome === Biome.glacier) {
      mountainCells.push(i);
      continue;
    }

    let kind: GlyphKind;
    let size: number;
    let variant = 0;
    let flip = false;
    let colors = base;
    if (biome === Biome.hills) {
      if (!rng.bool(0.7)) continue;
      kind = 'hill';
      size = rng.float(10, 14);
      variant = rng.int(0, 1);
    } else if (biome === Biome.desert) {
      if (!rng.bool(0.4)) continue;
      kind = 'dune';
      size = rng.float(10, 13);
      flip = rng.bool();
    } else if (biome === Biome.marsh) {
      if (!rng.bool(0.7)) continue;
      kind = 'marsh';
      size = rng.float(8, 11);
      flip = rng.bool();
      colors = marshColors;
    } else {
      continue;
    }

    const r = radiusFromArea(polygonArea(grid.polygons[i]!));
    glyphs.push({
      sprite: getGlyphSprite(kind, size, colors, variant, false),
      x: grid.points[i * 2]! + rng.jitter(r * 0.4),
      y: grid.points[i * 2 + 1]! + rng.jitter(r * 0.4),
      scale: rng.float(0.9, 1.1),
      flip,
    });
  }

  placeMountains(glyphs, world, mountainCells, rng, lc);
  drawGlyphs(ctx, glyphs);
}

/** Three depth tiers: near peaks crisp, far peaks faded toward the paper (haze). */
function mountainTiers(lc: LayerContext): GlyphColors[] {
  const g = lc.theme.glyph;
  const paper = hexToRgb(lc.theme.paper.center);
  const edge = hexToRgb(lc.theme.paper.edge);
  const light = hexToRgb(g.light);
  const shadeC = hexToRgb(g.shade);
  const ink = hexToRgb(g.ink);
  const recede = [0, 0.42, 0.74];
  return recede.map((t) => ({
    ink: rgbStr(mix(ink, edge, t * 0.5)),
    light: rgbStr(mix(light, paper, t * 0.4)),
    shade: rgbStr(mix(shadeC, paper, t * 0.55)),
    cap: g.cap,
    canopy: g.shade,
    trunk: g.trunk,
  }));
}

function placeMountains(
  out: GlyphInstance[],
  world: World,
  cellIds: number[],
  rng: ReturnType<typeof makeRng>,
  lc: LayerContext,
): void {
  if (cellIds.length === 0) return;
  const { points } = world.grid;
  const { height, temperature, biome } = world.cells;
  const tiers = mountainTiers(lc);

  // Normalise altitude across mountain cells to drive size.
  let minH = Infinity;
  let maxH = -Infinity;
  for (const i of cellIds) {
    const h = height[i]!;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  const span = maxH - minH || 1;

  // Tallest first so big peaks claim space; smaller ones fill the gaps.
  cellIds.sort((a, b) => height[b]! - height[a]!);

  // Spatial hash for spacing checks.
  const cellSize = 28;
  const grid = new Map<string, [number, number][]>();
  const key = (x: number, y: number) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
  const tooClose = (x: number, y: number, minDist: number): boolean => {
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    const d2 = minDist * minDist;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid.get(`${gx + ox},${gy + oy}`);
        if (!bucket) continue;
        for (const [px, py] of bucket) {
          const dx = px - x;
          const dy = py - y;
          if (dx * dx + dy * dy < d2) return true;
        }
      }
    }
    return false;
  };

  for (const i of cellIds) {
    const sizeNorm = (height[i]! - minH) / span;
    const size = 16 + sizeNorm * 18; // 16 … 34
    const x = points[i * 2]! + rng.jitter(3);
    const y = points[i * 2 + 1]! + rng.jitter(3);
    if (tooClose(x, y, size * 0.55)) continue;

    const k = key(x, y);
    const bucket = grid.get(k);
    if (bucket) bucket.push([x, y]);
    else grid.set(k, [[x, y]]);

    const tier = sizeNorm > 0.66 ? 0 : sizeNorm > 0.33 ? 1 : 2;
    const snow = biome[i] === Biome.glacier || temperature[i]! < 0.32 || height[i]! > 0.9;
    out.push({
      sprite: getGlyphSprite('mountain', size, tiers[tier]!, rng.int(0, 2), snow),
      x,
      y,
      scale: rng.float(0.94, 1.06),
      flip: false,
    });
  }
}
