/*
  Labels layer (CLAUDE.md §6 step 10) — calligraphic lettering with greedy collision
  avoidance. Region names in faded wide-tracked caps; water in italic; ranges curved
  along their spine; settlements in a small serif beside their icon. Every label gets
  a paper-coloured halo so it stays legible over the washes.

  Placement is greedy by importance: capitals and big geographic labels claim space
  first, lesser settlements fill what's left (and are dropped rather than overlap).
  Icon boxes are reserved up front so no label sits on top of an icon.
*/

import { SETTLEMENT_SIZE } from './settlements';
import { hexToRgb, rgbaStr, shade } from '@/lib/color';
import type { FeatureKind } from '@/model/world';
import type { LayerContext } from '../layer';

const SERIF = 'Georgia, "Times New Roman", serif';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Task {
  imp: number;
  type: 'settlement' | 'region' | 'water' | 'range';
  text: string;
  x: number;
  y: number;
  iconSize?: number;
  curve?: [number, number][];
}

const SETTLEMENT_IMP: Partial<Record<FeatureKind, number>> = {
  capital: 100,
  city: 70,
  fortress: 50,
  town: 45,
  tower: 35,
  temple: 32,
  ruin: 28,
  village: 20,
};

export function drawLabels(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world) return;

  const inkRgb = hexToRgb(lc.theme.glyph.ink);
  const halo = rgbaStr(hexToRgb(lc.theme.paper.center), 0.88);
  const settlementInk = rgbaStr(inkRgb, 0.95);
  const regionInk = rgbaStr(inkRgb, 0.5);
  const rangeInk = rgbaStr(inkRgb, 0.7);
  const waterInk = rgbaStr(shade(hexToRgb(lc.theme.ocean.deep), -0.2), 0.85);

  const placed: Box[] = [];
  const tasks: Task[] = [];

  // Reserve icon footprints so labels never cover an icon.
  for (const f of world.features) {
    const size = SETTLEMENT_SIZE[f.kind];
    if (size === undefined) continue;
    placed.push({ x: f.x - size * 0.7, y: f.y - size, w: size * 1.4, h: size * 1.1 });
    if (f.name) {
      tasks.push({
        imp: SETTLEMENT_IMP[f.kind] ?? 20,
        type: 'settlement',
        text: f.name,
        x: f.x,
        y: f.y,
        iconSize: size,
      });
    }
  }
  for (const l of world.labels) {
    if (l.role === 'region') tasks.push({ imp: 80, type: 'region', text: l.text, x: l.x, y: l.y });
    else if (l.role === 'range')
      tasks.push({ imp: 90, type: 'range', text: l.text, x: l.x, y: l.y, curve: l.curve });
    else if (l.role === 'water') tasks.push({ imp: 60, type: 'water', text: l.text, x: l.x, y: l.y });
  }

  tasks.sort((a, b) => b.imp - a.imp);

  for (const t of tasks) {
    if (t.type === 'settlement') placeSettlement(ctx, t, placed, halo, settlementInk);
    else if (t.type === 'region') placeCentered(ctx, t, placed, halo, regionInk, true);
    else if (t.type === 'water') placeCentered(ctx, t, placed, halo, waterInk, false, true);
    else if (t.type === 'range') placeRange(ctx, t, placed, halo, rangeInk);
  }
}

function placeSettlement(
  ctx: CanvasRenderingContext2D,
  t: Task,
  placed: Box[],
  halo: string,
  ink: string,
): void {
  const size = t.iconSize!;
  const px = Math.round(9 + size * 0.42);
  ctx.font = `${px}px ${SERIF}`;
  const w = ctx.measureText(t.text).width;
  const h = px * 1.15;
  const gap = size * 0.55 + 3;

  // Candidate anchors: right, left, above, below the icon.
  const candidates: { box: Box; tx: number; ty: number; align: CanvasTextAlign }[] = [
    { box: { x: t.x + gap, y: t.y - size * 0.45 - h / 2, w, h }, tx: t.x + gap, ty: t.y - size * 0.45, align: 'left' },
    { box: { x: t.x - gap - w, y: t.y - size * 0.45 - h / 2, w, h }, tx: t.x - gap, ty: t.y - size * 0.45, align: 'right' },
    { box: { x: t.x - w / 2, y: t.y - size - h, w, h }, tx: t.x, ty: t.y - size - h / 2, align: 'center' },
    { box: { x: t.x - w / 2, y: t.y + 2, w, h }, tx: t.x, ty: t.y + 2 + h / 2, align: 'center' },
  ];

  const pick = candidates.find((c) => !collides(c.box, placed));
  if (!pick) return;
  placed.push(pick.box);
  drawText(ctx, t.text, pick.tx, pick.ty, { align: pick.align, baseline: 'middle', halo, ink });
}

function placeCentered(
  ctx: CanvasRenderingContext2D,
  t: Task,
  placed: Box[],
  halo: string,
  ink: string,
  wideCaps = false,
  italic = false,
): void {
  const px = wideCaps ? 20 : 19;
  const text = wideCaps ? t.text.toUpperCase().split('').join(' ') : t.text;
  ctx.font = `${italic ? 'italic ' : ''}${px}px ${SERIF}`;
  const w = ctx.measureText(text).width;
  const h = px * 1.2;
  const box: Box = { x: t.x - w / 2, y: t.y - h / 2, w, h };
  if (collides(box, placed)) return;
  placed.push(box);
  drawText(ctx, text, t.x, t.y, { align: 'center', baseline: 'middle', halo, ink });
}

function placeRange(
  ctx: CanvasRenderingContext2D,
  t: Task,
  placed: Box[],
  halo: string,
  ink: string,
): void {
  if (!t.curve || t.curve.length < 2) return;
  const px = 18;
  // Approximate footprint: the spine's bounding box, padded by the cap height.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of t.curve) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const pad = px;
  const box: Box = { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  if (collides(box, placed)) return;
  placed.push(box);
  drawTextOnCurve(ctx, t.text.toUpperCase(), t.curve, px, halo, ink);
}

function collides(box: Box, placed: Box[]): boolean {
  for (const p of placed) {
    if (box.x < p.x + p.w && box.x + box.w > p.x && box.y < p.y + p.h && box.y + box.h > p.y) {
      return true;
    }
  }
  return false;
}

interface TextOpts {
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  halo: string;
  ink: string;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts): void {
  ctx.textAlign = o.align;
  ctx.textBaseline = o.baseline;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = o.halo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = o.ink;
  ctx.fillText(text, x, y);
}

/** Distribute characters along a polyline spine (centred), each rotated to the path. */
function drawTextOnCurve(
  ctx: CanvasRenderingContext2D,
  text: string,
  spine: [number, number][],
  px: number,
  halo: string,
  ink: string,
): void {
  ctx.font = `${px}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;

  // Cumulative arc lengths along the spine.
  const seg: number[] = [0];
  for (let i = 1; i < spine.length; i++) {
    seg.push(seg[i - 1]! + Math.hypot(spine[i]![0] - spine[i - 1]![0], spine[i]![1] - spine[i - 1]![1]));
  }
  const total = seg[seg.length - 1]!;
  const spacing = px * 0.18;
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const textLen = widths.reduce((a, w) => a + w, 0) + spacing * (chars.length - 1);
  let dist = Math.max(0, (total - textLen) / 2);

  const at = (d: number): { x: number; y: number; a: number } => {
    let i = 1;
    while (i < seg.length && seg[i]! < d) i++;
    i = Math.min(i, seg.length - 1);
    const segLen = seg[i]! - seg[i - 1]! || 1;
    const f = (d - seg[i - 1]!) / segLen;
    const ax = spine[i - 1]![0];
    const ay = spine[i - 1]![1];
    const bx = spine[i]![0];
    const by = spine[i]![1];
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, a: Math.atan2(by - ay, bx - ax) };
  };

  for (let k = 0; k < chars.length; k++) {
    const cw = widths[k]!;
    const p = at(dist + cw / 2);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.strokeStyle = halo;
    ctx.strokeText(chars[k]!, 0, 0);
    ctx.fillStyle = ink;
    ctx.fillText(chars[k]!, 0, 0);
    ctx.restore();
    dist += cw + spacing;
  }
}
