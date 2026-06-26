/*
  Glyph sprite cache (CLAUDE.md §6). Vector glyphs are expensive to draw and there
  are thousands of instances per map, so each (kind, size, variant, colors) combo is
  rendered once into an offscreen canvas and then blitted. Sizes are integer-bucketed
  so the cache can't explode. Sprites carry their anchor — the ground point the glyph
  should sit on (bottom-centre).
*/

import {
  drawMountain,
  drawHill,
  drawDune,
  drawMarsh,
  drawBroadleaf,
  drawConifer,
  type GlyphColors,
} from './draw';

export type GlyphKind = 'mountain' | 'hill' | 'dune' | 'marsh' | 'broadleaf' | 'conifer';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Anchor in sprite pixels — placed onto the world ground point when blitting. */
  ax: number;
  ay: number;
}

const ASPECT: Record<GlyphKind, number> = {
  mountain: 1.15,
  hill: 1.35,
  dune: 1.25,
  marsh: 0.95,
  broadleaf: 0.8,
  conifer: 0.75,
};

const cache = new Map<string, Sprite>();

export function getGlyphSprite(
  kind: GlyphKind,
  size: number,
  c: GlyphColors,
  variant = 0,
  snow = false,
): Sprite {
  const h = Math.max(4, Math.round(size));
  const w = Math.round(h * ASPECT[kind]);
  const key = `${kind}|${h}|${variant}|${snow ? 1 : 0}|${c.ink}|${c.light}|${c.shade}|${c.cap}|${c.canopy}|${c.trunk}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pad = Math.ceil(h * 0.1) + 2;
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(pad, pad);

  switch (kind) {
    case 'mountain':
      drawMountain(ctx, w, h, c, variant, snow);
      break;
    case 'hill':
      drawHill(ctx, w, h, c, variant);
      break;
    case 'dune':
      drawDune(ctx, w, h, c);
      break;
    case 'marsh':
      drawMarsh(ctx, w, h, c);
      break;
    case 'broadleaf':
      drawBroadleaf(ctx, w, h, c);
      break;
    case 'conifer':
      drawConifer(ctx, w, h, c);
      break;
  }

  const sprite: Sprite = { canvas, ax: pad + w / 2, ay: pad + h };
  cache.set(key, sprite);
  return sprite;
}
