/*
  Tiny color utilities (CLAUDE.md §12 — prefer a small local helper). Themes store
  colors as hex strings; rendering needs rgb tuples for mixing, tonal jitter, and
  alpha. Kept dependency-free.
*/

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbStr(c: Rgb): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function rgbaStr(c: Rgb, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** Linear interpolation between two colors, t in [0,1]. */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Shift a color's brightness by `amt` (−1..1) — used for per-cell tonal jitter. */
export function shade(c: Rgb, amt: number): Rgb {
  const f = (v: number) =>
    amt >= 0 ? Math.round(v + (255 - v) * amt) : Math.round(v * (1 + amt));
  return [clamp8(f(c[0])), clamp8(f(c[1])), clamp8(f(c[2]))];
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
