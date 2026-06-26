/*
  Decoration layer (CLAUDE.md §6 step 11) — compass rose, scale bar, ships & sea
  serpents in empty ocean, and an ornamental border frame. Each piece is toggleable.
  Placement uses the land silhouette to keep the compass and creatures out at sea;
  positions are seeded so they reproduce.
*/

import { getCoastline, buildLandPath } from '../coastline';
import { drawCompass, drawScaleBar, drawShip, drawSeaSerpent, drawFrame, type DecorColors } from '@/glyphs/decor';
import { makeRng } from '@/gen/rng';
import { hexToRgb, rgbaStr } from '@/lib/color';
import type { LayerContext } from '../layer';

const FRAME_INSET = 26;

export function drawDecoration(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world, width: w, height: h, decor } = lc;
  if (!world) return;

  const g = lc.theme.glyph;
  const colors: DecorColors = {
    ink: g.ink,
    light: g.light,
    shade: g.shade,
    halo: rgbaStr(hexToRgb(lc.theme.paper.center), 0.82),
  };
  const rng = makeRng(lc.seed, 'decor');
  const landPath = buildLandPath(getCoastline(world).loops);
  const atSea = (x: number, y: number, r: number): boolean => {
    if (x < FRAME_INSET + r || y < FRAME_INSET + r || x > w - FRAME_INSET - r || y > h - FRAME_INSET - r) {
      return false;
    }
    if (ctx.isPointInPath(landPath, x, y)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (ctx.isPointInPath(landPath, x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
    }
    return true;
  };

  const taken: [number, number, number][] = []; // x, y, radius

  // Compass — first ocean corner that fits.
  if (decor.compass) {
    const r = 64;
    const m = FRAME_INSET + r + 16;
    const corners: [number, number][] = [
      [w - m, h - m],
      [w - m, m],
      [m, m],
      [m, h - m],
    ];
    const spot = corners.find(([x, y]) => atSea(x, y, r));
    if (spot) {
      drawCompass(ctx, spot[0], spot[1], r, colors);
      taken.push([spot[0], spot[1], r + 20]);
    }
  }

  // Scale bar — bottom-left, just inside the frame (has its own backing).
  if (decor.scaleBar) {
    const bw = 190;
    const x = FRAME_INSET + 22;
    const y = h - FRAME_INSET - 34;
    drawScaleBar(ctx, x, y, bw, colors, '100 leagues');
    taken.push([x + bw / 2, y, bw / 2 + 30]);
  }

  // Ships & a serpent in open water, away from the other decorations.
  if (decor.creatures) {
    placeCreatures(ctx, rng, w, h, atSea, taken, colors);
  }

  // Hand-placed ornaments (Decoration tool, CLAUDE.md §9) — always drawn, regardless
  // of the procedural toggles above, since the user put them there deliberately.
  for (const f of world.features) {
    if (f.kind === 'compass') drawCompass(ctx, f.x, f.y, 54, colors);
    else if (f.kind === 'shipDecor') drawShip(ctx, f.x, f.y, 18, colors);
    else if (f.kind === 'monsterDecor') drawSeaSerpent(ctx, f.x, f.y, 26, colors);
  }

  // Border frame on top of everything.
  if (decor.frame) {
    drawFrame(ctx, w, h, colors, FRAME_INSET);
  }
}

function placeCreatures(
  ctx: CanvasRenderingContext2D,
  rng: ReturnType<typeof makeRng>,
  w: number,
  h: number,
  atSea: (x: number, y: number, r: number) => boolean,
  taken: [number, number, number][],
  colors: DecorColors,
): void {
  const wanted: ('ship' | 'ship' | 'serpent')[] = ['ship', 'ship', 'serpent'];
  for (const kind of wanted) {
    const r = kind === 'serpent' ? 26 : 18;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = rng.float(60, w - 60);
      const y = rng.float(60, h - 60);
      if (!atSea(x, y, r)) continue;
      if (taken.some(([tx, ty, tr]) => Math.hypot(tx - x, ty - y) < tr + r + 30)) continue;
      if (kind === 'serpent') drawSeaSerpent(ctx, x, y, r, colors);
      else drawShip(ctx, x, y, r, colors);
      taken.push([x, y, r]);
      break;
    }
  }
}
