/*
  Map decorations (CLAUDE.md §6 step 11): compass rose, scale bar, ships and sea
  serpents for empty ocean, and an ornamental border frame. Drawn in ink with a cream
  fill, consistent upper-left lighting. Each is a pure draw; the decoration layer
  places them.
*/

export interface DecorColors {
  ink: string;
  light: string;
  shade: string;
  halo: string;
}

const SERIF = 'Georgia, "Times New Roman", serif';

/** An eight-point compass rose with cardinal letters. */
export function drawCompass(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: DecorColors): void {
  const lw = Math.max(0.8, r * 0.025);
  ctx.lineJoin = 'round';

  // Rings.
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lw;
  for (const rr of [r, r * 0.82]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Degree ticks around the inner ring.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const long = i % 8 === 0;
    const r1 = r * 0.82;
    const r2 = r * (long ? 0.7 : 0.76);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Eight points: long cardinals, short diagonals.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2; // start at North
    const cardinal = i % 2 === 0;
    ray(ctx, cx, cy, a, r * (cardinal ? 0.7 : 0.4), r * 0.1, c);
  }

  // Hub.
  ctx.fillStyle = c.light;
  ctx.strokeStyle = c.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cardinal letters.
  ctx.font = `${Math.round(r * 0.22)}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letters: [string, number, number][] = [
    ['N', 0, -1],
    ['E', 1, 0],
    ['S', 0, 1],
    ['W', -1, 0],
  ];
  for (const [ch, dx, dy] of letters) {
    const lx = cx + dx * r * 1.04;
    const ly = cy + dy * r * 1.04;
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.halo;
    ctx.strokeText(ch, lx, ly);
    ctx.fillStyle = c.ink;
    ctx.fillText(ch, lx, ly);
  }
}

/** One compass point as a kite, lit on the left, shaded on the right. */
function ray(ctx: CanvasRenderingContext2D, cx: number, cy: number, a: number, len: number, half: number, c: DecorColors): void {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const tipX = cx + dx * len;
  const tipY = cy + dy * len;
  const midX = cx + dx * len * 0.28;
  const midY = cy + dy * len * 0.28;
  const lX = midX + px * half;
  const lY = midY + py * half;
  const rX = midX - px * half;
  const rY = midY - py * half;

  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(0.6, len * 0.04);
  // Left (lit) half.
  ctx.fillStyle = c.light;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(lX, lY);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Right (shaded) half.
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(rX, rY);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A segmented scale bar with a unit label, on a faint paper backing. */
export function drawScaleBar(ctx: CanvasRenderingContext2D, x: number, y: number, totalW: number, c: DecorColors, label: string): void {
  const segs = 4;
  const segW = totalW / segs;
  const h = Math.max(5, totalW * 0.03);

  // Backing for legibility over any terrain.
  ctx.fillStyle = c.halo;
  ctx.fillRect(x - 6, y - 16, totalW + 12, h + 30);

  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 1;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 === 0 ? c.ink : c.light;
    ctx.beginPath();
    ctx.rect(x + i * segW, y, segW, h);
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = `${Math.round(h * 1.6)}px ${SERIF}`;
  ctx.fillStyle = c.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillText('0', x, y - 4);
  ctx.fillText(label, x + totalW, y - 4);
}

/** A little sailing ship for empty seas. */
export function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, c: DecorColors): void {
  ctx.strokeStyle = c.ink;
  ctx.fillStyle = c.light;
  ctx.lineWidth = Math.max(0.7, s * 0.05);
  ctx.lineJoin = 'round';

  // Hull.
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy);
  ctx.quadraticCurveTo(cx, cy + s * 0.45, cx + s * 0.6, cy);
  ctx.lineTo(cx + s * 0.42, cy);
  ctx.quadraticCurveTo(cx, cy + s * 0.22, cx - s * 0.42, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mast + sail.
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - s * 0.85);
  ctx.stroke();
  ctx.fillStyle = c.light;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.08);
  ctx.quadraticCurveTo(cx + s * 0.5, cy - s * 0.35, cx + s * 0.1, cy - s * 0.78);
  ctx.lineTo(cx, cy - s * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** A humped sea serpent cresting the waves. */
export function drawSeaSerpent(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, c: DecorColors): void {
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = Math.max(0.8, s * 0.07);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Three humps cresting the surface.
  const humps = 3;
  const span = s * 1.6;
  const x0 = cx - span / 2;
  ctx.beginPath();
  for (let i = 0; i < humps; i++) {
    const hx = x0 + (span / humps) * i;
    ctx.moveTo(hx, cy);
    ctx.quadraticCurveTo(hx + span / humps / 2, cy - s * 0.45, hx + span / humps, cy);
  }
  ctx.stroke();

  // Head with an eye.
  const headX = x0 + span;
  ctx.fillStyle = c.light;
  ctx.beginPath();
  ctx.moveTo(headX, cy);
  ctx.quadraticCurveTo(headX + s * 0.45, cy - s * 0.35, headX + s * 0.55, cy - s * 0.05);
  ctx.quadraticCurveTo(headX + s * 0.4, cy + s * 0.1, headX, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.ink;
  ctx.beginPath();
  ctx.arc(headX + s * 0.32, cy - s * 0.08, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

/** An ornamental double border with corner diamonds. */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, c: DecorColors, inset: number): void {
  ctx.strokeStyle = c.ink;
  ctx.lineJoin = 'miter';

  const gap = Math.max(4, inset * 0.35);
  ctx.lineWidth = 2.2;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.lineWidth = 0.9;
  ctx.strokeRect(inset + gap, inset + gap, w - (inset + gap) * 2, h - (inset + gap) * 2);

  // Corner diamonds straddling the outer line.
  const d = gap * 1.1;
  ctx.fillStyle = c.light;
  ctx.lineWidth = 1.2;
  for (const [px, py] of [
    [inset, inset],
    [w - inset, inset],
    [w - inset, h - inset],
    [inset, h - inset],
  ]) {
    ctx.beginPath();
    ctx.moveTo(px, py - d);
    ctx.lineTo(px + d, py);
    ctx.lineTo(px, py + d);
    ctx.lineTo(px - d, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
