/*
  Roads layer (CLAUDE.md §6 step 8) — fine dashed ink for roads, lighter and more
  broken (dotted) for trails. Cell-site chains from the roads step are Chaikin-smoothed
  into flowing lines. Drawn under settlements so icons sit on top of the network.
  Colours derive from the theme ink.
*/

import { hexToRgb, rgbaStr } from '@/lib/color';
import type { LayerContext } from '../layer';

export function drawRoads(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world || world.roads.length === 0) return;

  const ink = hexToRgb(lc.theme.glyph.ink);
  const roadColor = rgbaStr(ink, 0.72);
  const trailColor = rgbaStr(ink, 0.5);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const road of world.roads) {
    const pts = chaikin(road.points, 2);
    const isRoad = road.kind === 'road';
    ctx.strokeStyle = isRoad ? roadColor : trailColor;
    ctx.lineWidth = isRoad ? 1.5 : 1.0;
    ctx.setLineDash(isRoad ? [5, 3.5] : [1.4, 3]);
    ctx.beginPath();
    ctx.moveTo(pts[0]!, pts[1]!);
    for (let k = 1; k < pts.length / 2; k++) ctx.lineTo(pts[k * 2]!, pts[k * 2 + 1]!);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/** Open-polyline Chaikin smoothing → flat [x,y,…]. */
function chaikin(points: [number, number][], iters: number): number[] {
  let pts = points.map((p) => [p[0], p[1]] as [number, number]);
  for (let it = 0; it < iters; it++) {
    const np: [number, number][] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      np.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      np.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    np.push(pts[pts.length - 1]!);
    pts = np;
  }
  const flat: number[] = [];
  for (const p of pts) flat.push(p[0], p[1]);
  return flat;
}
