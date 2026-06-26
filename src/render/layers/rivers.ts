/*
  Rivers layer (CLAUDE.md §6 step 7) — tapered ink strokes with a faint glint.

  River polylines come from the hydrology step as cell-site chains; here they're
  Chaikin-smoothed (points and widths together) into flowing curves and drawn as
  variable-width ink ribbons that taper from a thin source to a thick mouth. Lakes
  already read as water from the ocean wash + coastal rings (they're water cells the
  land/biome layers leave untouched), so this layer focuses on rivers.

  River colours derive from the theme's ocean palette so water stays cohesive.
*/

import { inkStroke } from '../paint';
import { hexToRgb, rgbStr, rgbaStr, shade } from '@/lib/color';
import type { LayerContext } from '../layer';

export function drawRivers(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world || world.rivers.length === 0) return;

  const deep = hexToRgb(lc.theme.ocean.deep);
  const shallow = hexToRgb(lc.theme.ocean.shallow);
  const color = rgbStr(shade(deep, -0.22));
  const highlight = rgbaStr(shade(shallow, 0.25), 0.5);

  for (const river of world.rivers) {
    const { pts, widths } = chaikin(river.points, river.widthByPoint, 2);
    inkStroke(ctx, pts, widths, { color, highlight });
  }
}

/** Open-polyline Chaikin smoothing, carrying per-vertex widths along with points. */
function chaikin(
  points: [number, number][],
  widthByPoint: number[],
  iters: number,
): { pts: number[]; widths: number[] } {
  let pts = points.map((p) => [p[0], p[1]] as [number, number]);
  let widths = widthByPoint.slice();

  for (let it = 0; it < iters; it++) {
    const np: [number, number][] = [pts[0]!];
    const nw: number[] = [widths[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const wa = widths[i]!;
      const wb = widths[i + 1]!;
      np.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      np.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      nw.push(wa * 0.75 + wb * 0.25, wa * 0.25 + wb * 0.75);
    }
    np.push(pts[pts.length - 1]!);
    nw.push(widths[widths.length - 1]!);
    pts = np;
    widths = nw;
  }

  const flat: number[] = [];
  for (const p of pts) flat.push(p[0], p[1]);
  return { pts: flat, widths };
}
