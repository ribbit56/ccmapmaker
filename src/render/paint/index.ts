/*
  Reusable painterly helpers (CLAUDE.md §6): jitterPolygon, layeredWash, inkStroke,
  scatterGlyphs, and the per-theme/zoom sprite cache. Filled in as the visual layers
  are built. traceLoop (Phase 1) and jitterPolygon (Phase 2) live here so far.
*/

import type { Rng } from '@/gen/rng';
import type { Sprite } from '@/glyphs/spriteCache';

/** One placed glyph, in world coords. Collected then depth-sorted before blitting. */
export interface GlyphInstance {
  sprite: Sprite;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

/** Blit a glyph sprite so its anchor lands on (x, y), with per-instance scale/flip. */
export function blitSprite(ctx: CanvasRenderingContext2D, g: GlyphInstance): void {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.flip ? -g.scale : g.scale, g.scale);
  ctx.drawImage(g.sprite.canvas, -g.sprite.ax, -g.sprite.ay);
  ctx.restore();
}

/**
 * Draw a batch of glyph instances back-to-front (higher on the sheet first) so
 * nearer glyphs overlap farther ones — the painterly depth that makes a mountain
 * range or a wood read as layered rather than flat (CLAUDE.md §6).
 */
export function drawGlyphs(ctx: CanvasRenderingContext2D, glyphs: GlyphInstance[]): void {
  glyphs.sort((a, b) => a.y - b.y);
  for (const g of glyphs) blitSprite(ctx, g);
}

/** Trace a flat [x0,y0,x1,y1,…] loop as a closed sub-path (caller fills/strokes). */
export function traceLoop(ctx: CanvasRenderingContext2D, loop: number[]): void {
  const n = loop.length / 2;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(loop[0]!, loop[1]!);
  for (let k = 1; k < n; k++) ctx.lineTo(loop[k * 2]!, loop[k * 2 + 1]!);
  ctx.closePath();
}

/**
 * Recursive midpoint displacement on a closed polygon (CLAUDE.md §6). Each pass
 * inserts a perpendicular-displaced midpoint on every edge, halving the amplitude
 * each level, turning straight Voronoi edges into organic watercolour bleeds. Pure
 * given (points, rng).
 */
export function jitterPolygon(points: number[], depth: number, amount: number, rng: Rng): number[] {
  let pts = points;
  let amp = amount;
  for (let d = 0; d < depth; d++) {
    pts = subdivideOnce(pts, amp, rng);
    amp *= 0.5;
  }
  return pts;
}

export interface InkStrokeOptions {
  color: string;
  /** Optional faint lighter centerline (e.g. a river's glint). */
  highlight?: string;
}

/**
 * Tapered variable-width ink stroke (CLAUDE.md §6). Builds a filled ribbon by
 * offsetting each vertex along its averaged normal by half the local width, so the
 * stroke can taper from a thin source to a thick mouth. `pts` is flat [x,y,…];
 * `widths` is the full width at each vertex.
 */
export function inkStroke(
  ctx: CanvasRenderingContext2D,
  pts: number[],
  widths: number[],
  opts: InkStrokeOptions,
): void {
  const n = pts.length / 2;
  if (n < 2) return;

  const left: number[] = [];
  const right: number[] = [];
  for (let k = 0; k < n; k++) {
    const px = pts[k * 2]!;
    const py = pts[k * 2 + 1]!;
    // Tangent from neighbouring vertices.
    const ax = pts[Math.max(0, k - 1) * 2]!;
    const ay = pts[Math.max(0, k - 1) * 2 + 1]!;
    const bx = pts[Math.min(n - 1, k + 1) * 2]!;
    const by = pts[Math.min(n - 1, k + 1) * 2 + 1]!;
    let tx = bx - ax;
    let ty = by - ay;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const hw = widths[k]! / 2;
    left.push(px - ty * hw, py + tx * hw);
    right.push(px + ty * hw, py - tx * hw);
  }

  ctx.beginPath();
  ctx.moveTo(left[0]!, left[1]!);
  for (let k = 1; k < n; k++) ctx.lineTo(left[k * 2]!, left[k * 2 + 1]!);
  for (let k = n - 1; k >= 0; k--) ctx.lineTo(right[k * 2]!, right[k * 2 + 1]!);
  ctx.closePath();
  ctx.fillStyle = opts.color;
  ctx.fill();

  if (opts.highlight) {
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let k = 1; k < n; k++) ctx.lineTo(pts[k * 2]!, pts[k * 2 + 1]!);
    ctx.strokeStyle = opts.highlight;
    ctx.lineWidth = 0.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function subdivideOnce(pts: number[], amount: number, rng: Rng): number[] {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const ax = pts[k * 2]!;
    const ay = pts[k * 2 + 1]!;
    const j = (k + 1) % n;
    const bx = pts[j * 2]!;
    const by = pts[j * 2 + 1]!;
    out.push(ax, ay);
    // Displace the edge midpoint along the edge normal.
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    let nx = -(by - ay);
    let ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const d = rng.jitter(amount);
    out.push(mx + nx * d, my + ny * d);
  }
  return out;
}
