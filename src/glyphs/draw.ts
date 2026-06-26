/*
  Glyph drawing functions (CLAUDE.md §6 steps 5–6, §12).

  Each draws a single hand-illustrated map symbol into a box [0..w, 0..h] in canvas
  coords, with its visual base resting on the bottom-centre (so instances can be
  anchored to a ground point). These are pure vector draws; the sprite cache renders
  each once and the layers blit the cached bitmap many times with per-instance
  variation. Lighting is consistent (sun upper-left) so mountains/hills are never
  horizontally flipped — variety comes from `variant`, scale, and position jitter.
*/

export interface GlyphColors {
  ink: string;
  light: string;
  shade: string;
  cap: string;
  canopy: string;
  trunk: string;
}

const lwFor = (h: number) => Math.max(0.8, h * 0.05);

/** A little mountain: lit left face, shaded right face, optional snow cap. */
export function drawMountain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: GlyphColors,
  variant: number,
  snow: boolean,
): void {
  const lw = lwFor(h);
  const baseY = h - lw;
  const v = ((variant % 3) + 3) % 3;
  // Each variant has its own ridge silhouette and main-peak x (for shading/cap).
  const peakX = w * (v === 0 ? 0.5 : v === 1 ? 0.34 : 0.55);

  const sil =
    v === 0
      ? [
          [w * 0.08, baseY],
          [w * 0.36, h * 0.4],
          [peakX, h * 0.08],
          [w * 0.62, h * 0.46],
          [w * 0.92, baseY],
        ]
      : v === 1
        ? [
            [w * 0.06, baseY],
            [peakX, h * 0.16],
            [w * 0.48, h * 0.46],
            [w * 0.66, h * 0.3],
            [w * 0.94, baseY],
          ]
        : [
            // craggy, asymmetric ridge
            [w * 0.07, baseY],
            [w * 0.24, h * 0.52],
            [w * 0.38, h * 0.6],
            [peakX, h * 0.12],
            [w * 0.68, h * 0.5],
            [w * 0.82, h * 0.42],
            [w * 0.94, baseY],
          ];

  const path = new Path2D();
  path.moveTo(sil[0]![0]!, sil[0]![1]!);
  for (let i = 1; i < sil.length; i++) path.lineTo(sil[i]![0]!, sil[i]![1]!);
  path.closePath();

  // Lit base fill.
  ctx.fillStyle = c.light;
  ctx.fill(path);

  // Shaded right slope + hatching, clipped to the silhouette.
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = withAlpha(c.shade, 0.5);
  ctx.fillRect(peakX, 0, w, h);
  ctx.strokeStyle = withAlpha(c.ink, 0.35);
  ctx.lineWidth = lw * 0.7;
  for (let i = 0; i < 3; i++) {
    const sx = peakX + w * (0.08 + i * 0.13);
    ctx.beginPath();
    ctx.moveTo(sx, h * 0.42);
    ctx.lineTo(sx - w * 0.1, baseY);
    ctx.stroke();
  }
  if (snow) {
    const px = peakX;
    const py = h * (v === 0 ? 0.08 : v === 1 ? 0.16 : 0.12);
    ctx.fillStyle = c.cap;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + w * 0.12, py + h * 0.16);
    ctx.lineTo(px + w * 0.03, py + h * 0.13);
    ctx.lineTo(px - w * 0.05, py + h * 0.18);
    ctx.lineTo(px - w * 0.12, py + h * 0.14);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Ink outline.
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
}

/** A small rounded hill (one or two bumps), lit with a faint underside hatch. */
export function drawHill(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: GlyphColors,
  variant: number,
): void {
  const lw = lwFor(h);
  const baseY = h - lw;
  const dome = new Path2D();
  if (variant % 2 === 0) {
    dome.moveTo(w * 0.1, baseY);
    dome.quadraticCurveTo(w * 0.3, h * 0.18, w * 0.5, h * 0.22);
    dome.quadraticCurveTo(w * 0.72, h * 0.18, w * 0.9, baseY);
  } else {
    dome.moveTo(w * 0.08, baseY);
    dome.quadraticCurveTo(w * 0.24, h * 0.3, w * 0.4, h * 0.34);
    dome.quadraticCurveTo(w * 0.52, h * 0.16, w * 0.66, h * 0.3);
    dome.quadraticCurveTo(w * 0.8, h * 0.4, w * 0.92, baseY);
  }

  const filled = new Path2D(dome);
  filled.lineTo(w * 0.1, baseY);
  filled.closePath();
  ctx.fillStyle = c.light;
  ctx.fill(filled);

  ctx.save();
  ctx.clip(filled);
  ctx.fillStyle = withAlpha(c.shade, 0.4);
  ctx.fillRect(w * 0.5, 0, w, h);
  ctx.restore();

  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(dome);
}

/** Soft sand ripples — a couple of thin crescent lines. */
export function drawDune(ctx: CanvasRenderingContext2D, w: number, h: number, c: GlyphColors): void {
  ctx.strokeStyle = withAlpha(c.shade, 0.85);
  ctx.lineWidth = lwFor(h) * 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.72);
  ctx.quadraticCurveTo(w * 0.5, h * 0.42, w * 0.9, h * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.52);
  ctx.quadraticCurveTo(w * 0.54, h * 0.34, w * 0.72, h * 0.52);
  ctx.stroke();
}

/** Marsh tuft — a fan of reeds over a short waterline. */
export function drawMarsh(ctx: CanvasRenderingContext2D, w: number, h: number, c: GlyphColors): void {
  const baseY = h * 0.82;
  ctx.strokeStyle = c.canopy;
  ctx.lineWidth = lwFor(h) * 0.9;
  ctx.lineCap = 'round';
  const reeds = [-0.18, -0.06, 0.06, 0.18];
  for (const off of reeds) {
    ctx.beginPath();
    ctx.moveTo(w * 0.5 + off * w * 0.5, baseY);
    ctx.lineTo(w * 0.5 + off * w * 1.1, h * 0.18);
    ctx.stroke();
  }
  ctx.strokeStyle = withAlpha(c.ink, 0.5);
  ctx.lineWidth = lwFor(h) * 0.8;
  ctx.beginPath();
  ctx.moveTo(w * 0.2, baseY + lwFor(h));
  ctx.lineTo(w * 0.8, baseY + lwFor(h));
  ctx.stroke();
}

/** Round broadleaf tree — bumpy canopy on a short trunk. */
export function drawBroadleaf(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: GlyphColors,
): void {
  const lw = lwFor(h) * 0.9;
  const cxp = w * 0.5;
  // trunk
  ctx.strokeStyle = c.trunk;
  ctx.lineWidth = Math.max(1, w * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cxp, h - lw);
  ctx.lineTo(cxp, h * 0.55);
  ctx.stroke();

  // canopy: a scalloped blob
  const cy = h * 0.38;
  const r = w * 0.3;
  const canopy = new Path2D();
  const bumps = 7;
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (i % 2 === 0 ? 1 : 0.82);
    const x = cxp + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.95;
    if (i === 0) canopy.moveTo(x, y);
    else canopy.lineTo(x, y);
  }
  canopy.closePath();
  ctx.fillStyle = c.canopy;
  ctx.fill(canopy);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.stroke(canopy);
}

/** Spiky conifer — stacked triangular tiers on a short trunk. */
export function drawConifer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  c: GlyphColors,
): void {
  const lw = lwFor(h) * 0.9;
  const cxp = w * 0.5;
  ctx.strokeStyle = c.trunk;
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cxp, h - lw);
  ctx.lineTo(cxp, h * 0.72);
  ctx.stroke();

  ctx.fillStyle = c.canopy;
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  const tiers = [
    [0.78, 0.42], // [baseY frac, halfWidth frac]
    [0.56, 0.34],
    [0.34, 0.24],
  ];
  let topY = h * 0.1;
  for (const [by, hw] of tiers) {
    const baseY = h * by!;
    const tri = new Path2D();
    tri.moveTo(cxp - w * hw!, baseY);
    tri.lineTo(cxp + w * hw!, baseY);
    tri.lineTo(cxp, topY);
    tri.closePath();
    ctx.fill(tri);
    ctx.stroke(tri);
    topY = baseY - h * 0.22;
  }
}

/** Apply an alpha to a hex color for translucent fills/hatching. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
