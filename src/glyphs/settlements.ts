/*
  Settlement & landmark icons (CLAUDE.md §6 step 9). Small illustrated symbols drawn
  in ink with a cream fill: clustered roofs for cities, a walled keep for fortresses,
  a single tower, a broken arch for ruins, a columned temple. Each draws with its base
  centred on (cx, baseY) so it sits on the map point. Kept as direct vector draws
  (settlements are few) so names and harbour accents can compose around them.
*/

import type { FeatureKind } from '@/model/world';

export interface SettlementColors {
  ink: string;
  fill: string;
  roof: string;
  accent: string;
}

export function drawSettlement(
  ctx: CanvasRenderingContext2D,
  kind: FeatureKind,
  cx: number,
  baseY: number,
  size: number,
  c: SettlementColors,
): void {
  const lw = Math.max(0.8, size * 0.06);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;

  switch (kind) {
    case 'village':
      house(ctx, cx + size * 0.24, baseY - size * 0.04, size * 0.42, size * 0.5, c);
      house(ctx, cx - size * 0.2, baseY, size * 0.52, size * 0.66, c);
      break;
    case 'town':
      house(ctx, cx + size * 0.34, baseY - size * 0.05, size * 0.4, size * 0.5, c);
      house(ctx, cx - size * 0.34, baseY - size * 0.02, size * 0.42, size * 0.54, c);
      house(ctx, cx, baseY, size * 0.5, size * 0.64, c);
      break;
    case 'city':
      cityCluster(ctx, cx, baseY, size, c, false);
      break;
    case 'capital':
      cityCluster(ctx, cx, baseY, size, c, true);
      break;
    case 'tower':
      tower(ctx, cx, baseY, size * 0.5, size, c);
      break;
    case 'fortress':
      fortress(ctx, cx, baseY, size, c);
      break;
    case 'ruin':
      ruin(ctx, cx, baseY, size, c);
      break;
    case 'temple':
      temple(ctx, cx, baseY, size, c);
      break;
    default:
      break;
  }
}

/** Small anchor accent for ports, drawn beside a settlement. */
export function drawHarbour(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  c: SettlementColors,
): void {
  const s = size;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(0.8, s * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.55, s * 0.18, 0, Math.PI * 2); // ring
  ctx.moveTo(cx, cy - s * 0.4);
  ctx.lineTo(cx, cy + s * 0.5); // shank
  ctx.moveTo(cx - s * 0.42, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.42, cy - s * 0.05); // stock
  ctx.moveTo(cx - s * 0.45, cy + s * 0.25); // left fluke
  ctx.quadraticCurveTo(cx - s * 0.45, cy + s * 0.55, cx, cy + s * 0.55);
  ctx.quadraticCurveTo(cx + s * 0.45, cy + s * 0.55, cx + s * 0.45, cy + s * 0.25);
  ctx.stroke();
}

function house(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  c: SettlementColors,
): void {
  const wallH = h * 0.62;
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.rect(cx - w / 2, baseY - wallH, w, wallH);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.roof;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.62, baseY - wallH);
  ctx.lineTo(cx, baseY - h);
  ctx.lineTo(cx + w * 0.62, baseY - wallH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function cityCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  c: SettlementColors,
  capital: boolean,
): void {
  house(ctx, cx - size * 0.4, baseY - size * 0.02, size * 0.38, size * 0.5, c);
  house(ctx, cx + size * 0.42, baseY - size * 0.04, size * 0.4, size * 0.52, c);
  house(ctx, cx - size * 0.06, baseY, size * 0.46, size * 0.6, c);
  // Central tower / keep.
  const tw = size * 0.34;
  const th = size * (capital ? 1.05 : 0.85);
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.rect(cx + size * 0.18, baseY - th, tw, th);
  ctx.fill();
  ctx.stroke();
  crenellate(ctx, cx + size * 0.18, baseY - th, tw, size * 0.12, c);
  if (capital) {
    // Pennant flag atop the keep.
    const px = cx + size * 0.18 + tw / 2;
    const py = baseY - th - size * 0.12;
    ctx.strokeStyle = c.ink;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - size * 0.34);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(px, py - size * 0.34);
    ctx.lineTo(px + size * 0.26, py - size * 0.26);
    ctx.lineTo(px, py - size * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function tower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  c: SettlementColors,
): void {
  const bh = h * 0.88;
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.rect(cx - w / 2, baseY - bh, w, bh);
  ctx.fill();
  ctx.stroke();
  crenellate(ctx, cx - w / 2, baseY - bh, w, h * 0.14, c);
  // window slit
  ctx.fillStyle = c.ink;
  ctx.fillRect(cx - w * 0.1, baseY - bh * 0.7, w * 0.2, bh * 0.22);
}

function fortress(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  c: SettlementColors,
): void {
  const keepW = size * 0.6;
  const keepH = size * 0.78;
  // corner towers
  tower(ctx, cx - size * 0.42, baseY, size * 0.26, size * 0.95, c);
  tower(ctx, cx + size * 0.42, baseY, size * 0.26, size * 0.95, c);
  // central keep
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.rect(cx - keepW / 2, baseY - keepH, keepW, keepH);
  ctx.fill();
  ctx.stroke();
  crenellate(ctx, cx - keepW / 2, baseY - keepH, keepW, size * 0.13, c);
  // gate
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.1, baseY);
  ctx.lineTo(cx - size * 0.1, baseY - keepH * 0.4);
  ctx.quadraticCurveTo(cx, baseY - keepH * 0.55, cx + size * 0.1, baseY - keepH * 0.4);
  ctx.lineTo(cx + size * 0.1, baseY);
  ctx.closePath();
  ctx.fill();
}

function ruin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  c: SettlementColors,
): void {
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  const colW = size * 0.16;
  // left column, tall; right column, broken short
  ctx.beginPath();
  ctx.rect(cx - size * 0.4, baseY - size * 0.85, colW, size * 0.85);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx + size * 0.24, baseY - size * 0.5, colW, size * 0.5);
  ctx.fill();
  ctx.stroke();
  // broken arch springing from the left column, cut off mid-air
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.4 + colW, baseY - size * 0.85);
  ctx.quadraticCurveTo(cx - size * 0.02, baseY - size * 1.15, cx + size * 0.16, baseY - size * 0.7);
  ctx.stroke();
  // a fallen block
  ctx.beginPath();
  ctx.rect(cx - size * 0.05, baseY - size * 0.16, size * 0.22, size * 0.16);
  ctx.fill();
  ctx.stroke();
}

function temple(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  c: SettlementColors,
): void {
  const w = size * 0.9;
  const colTop = baseY - size * 0.62;
  // base
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.rect(cx - w / 2, baseY - size * 0.1, w, size * 0.1);
  ctx.fill();
  ctx.stroke();
  // columns
  const cols = 4;
  for (let k = 0; k < cols; k++) {
    const x = cx - w / 2 + (w / (cols - 1)) * k;
    ctx.beginPath();
    ctx.moveTo(x, baseY - size * 0.1);
    ctx.lineTo(x, colTop);
    ctx.stroke();
  }
  // architrave
  ctx.beginPath();
  ctx.rect(cx - w * 0.56, colTop - size * 0.08, w * 1.12, size * 0.08);
  ctx.fill();
  ctx.stroke();
  // pediment
  ctx.fillStyle = c.roof;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.56, colTop - size * 0.08);
  ctx.lineTo(cx, colTop - size * 0.34);
  ctx.lineTo(cx + w * 0.56, colTop - size * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Crenellated parapet along the top edge of a rectangle. */
function crenellate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  notch: number,
  c: SettlementColors,
): void {
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.ink;
  const merlons = 3;
  const mw = w / (merlons * 2 - 1);
  for (let k = 0; k < merlons; k++) {
    const mx = x + k * mw * 2;
    ctx.beginPath();
    ctx.rect(mx, y - notch, mw, notch);
    ctx.fill();
    ctx.stroke();
  }
}
