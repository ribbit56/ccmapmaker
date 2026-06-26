/*
  Small geometry helpers (CLAUDE.md §12).
*/

/** Signed-area magnitude of a flat [x0,y0,x1,y1,…] polygon (shoelace). */
export function polygonArea(flat: ArrayLike<number>): number {
  const n = flat.length / 2;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += flat[i * 2]! * flat[j * 2 + 1]! - flat[j * 2]! * flat[i * 2 + 1]!;
  }
  return Math.abs(a) / 2;
}

/** Approximate radius of a polygon from its area (area of equivalent disc). */
export function radiusFromArea(area: number): number {
  return Math.sqrt(area / Math.PI);
}
