/*
  Coastline geometry for rendering (CLAUDE.md §6 steps 2–3).

  The Voronoi cells give a blocky land/water boundary; a raw polygon coast would
  scream "generated". So we extract every land↔water cell edge, stitch them into
  closed loops oriented with land always on the left, then Chaikin-smooth and lightly
  jitter them into organic, hand-drawn coastlines. The same loops drive both the land
  silhouette fill and the ocean's coastal contour rings, so they're computed once and
  memoised per World.
*/

import { makeRng } from '@/gen/rng';
import type { World } from '@/model/world';

export interface Coastline {
  /** Smoothed closed loops; each is flat [x0,y0,x1,y1,…]. Land is on the left. */
  loops: number[][];
}

const cache = new WeakMap<World, { rev: number; value: Coastline }>();

export function getCoastline(world: World): Coastline {
  const cached = cache.get(world);
  if (cached && cached.rev === world.geomRev) return cached.value;
  const value = buildCoastline(world);
  cache.set(world, { rev: world.geomRev, value });
  return value;
}

/** A filled Path2D of the land silhouette (lakes become holes via nonzero winding). */
export function buildLandPath(loops: number[][]): Path2D {
  const path = new Path2D();
  for (const loop of loops) {
    const n = loop.length / 2;
    if (n < 3) continue;
    path.moveTo(loop[0]!, loop[1]!);
    for (let k = 1; k < n; k++) path.lineTo(loop[k * 2]!, loop[k * 2 + 1]!);
    path.closePath();
  }
  return path;
}

interface CoastEdge {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

function buildCoastline(world: World): Coastline {
  const edges = extractCoastEdges(world);
  const rawLoops = stitchLoops(edges);
  const rng = makeRng(world.meta.seed, 'coast');
  const loops = rawLoops
    .filter((l) => l.length >= 8) // drop trivial 1–3 vertex scraps
    .map((l) => jitter(chaikin(chaikin(l)), rng, 0.5));
  return { loops };
}

/** Round a coordinate to stitch shared endpoints reliably. */
function key(x: number, y: number): string {
  return `${Math.round(x * 100)},${Math.round(y * 100)}`;
}

/**
 * Collect polygon edges that separate land from water, oriented so the land cell is
 * on the left of a→b. Map-edge segments of land cells are included so coastlines
 * that touch the border still close.
 */
function extractCoastEdges(world: World): CoastEdge[] {
  const { grid, cells } = world;
  const { count, polygons, points } = grid;
  const isWater = cells.isWater;

  // Map each undirected polygon edge to the cell ids that share it.
  const owners = new Map<string, number[]>();
  for (let i = 0; i < count; i++) {
    const poly = polygons[i]!;
    const n = poly.length / 2;
    for (let k = 0; k < n; k++) {
      const x1 = poly[k * 2]!;
      const y1 = poly[k * 2 + 1]!;
      const j = (k + 1) % n;
      const x2 = poly[j * 2]!;
      const y2 = poly[j * 2 + 1]!;
      const k1 = key(x1, y1);
      const k2 = key(x2, y2);
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      const list = owners.get(ek);
      if (list) list.push(i);
      else owners.set(ek, [i]);
    }
  }

  // Walk edges again, emitting the ones that are land↔water boundaries.
  const edges: CoastEdge[] = [];
  const emitted = new Set<string>();
  for (let i = 0; i < count; i++) {
    const poly = polygons[i]!;
    const n = poly.length / 2;
    for (let k = 0; k < n; k++) {
      const x1 = poly[k * 2]!;
      const y1 = poly[k * 2 + 1]!;
      const j = (k + 1) % n;
      const x2 = poly[j * 2]!;
      const y2 = poly[j * 2 + 1]!;
      const k1 = key(x1, y1);
      const k2 = key(x2, y2);
      const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
      if (emitted.has(ek)) continue;

      const list = owners.get(ek)!;
      const land = isWater[i] === 0;
      let isCoast = false;
      if (list.length === 1) {
        isCoast = land; // map-edge segment of a land cell
      } else {
        const other = list[0] === i ? list[1]! : list[0]!;
        isCoast = isWater[i] !== isWater[other]; // one land, one water
      }
      if (!isCoast || !land) continue; // emit from the land side only
      emitted.add(ek);

      // Orient so the land site is on the left of a→b.
      const sx = points[i * 2]!;
      const sy = points[i * 2 + 1]!;
      if (cross(x1, y1, x2, y2, sx, sy) < 0) {
        edges.push({ ax: x2, ay: y2, bx: x1, by: y1 });
      } else {
        edges.push({ ax: x1, ay: y1, bx: x2, by: y2 });
      }
    }
  }
  return edges;
}

/** Cross product of (b-a) × (p-a); >0 means p is left of a→b in screen coords. */
function cross(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** Stitch oriented edges into closed loops by matching endpoints. */
function stitchLoops(edges: CoastEdge[]): number[][] {
  const starts = new Map<string, number[]>(); // start key → edge indices
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i]!;
    const sk = key(e.ax, e.ay);
    const list = starts.get(sk);
    if (list) list.push(i);
    else starts.set(sk, [i]);
  }

  const used = new Uint8Array(edges.length);
  const loops: number[][] = [];

  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    const loop: number[] = [];
    let cur = i;
    // Follow the chain until we return to the start or run dry.
    for (let guard = 0; guard < edges.length + 1; guard++) {
      if (cur < 0 || used[cur]) break;
      used[cur] = 1;
      const e = edges[cur]!;
      loop.push(e.ax, e.ay);
      const nextKey = key(e.bx, e.by);
      const candidates = starts.get(nextKey);
      cur = -1;
      if (candidates) {
        for (const ci of candidates) {
          if (!used[ci]) {
            cur = ci;
            break;
          }
        }
      }
    }
    if (loop.length >= 6) loops.push(loop);
  }
  return loops;
}

/** Chaikin corner-cutting on a closed loop → smoother, flowing edge. */
function chaikin(loop: number[]): number[] {
  const n = loop.length / 2;
  if (n < 3) return loop;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    const px = loop[k * 2]!;
    const py = loop[k * 2 + 1]!;
    const qx = loop[j * 2]!;
    const qy = loop[j * 2 + 1]!;
    out.push(px * 0.75 + qx * 0.25, py * 0.75 + qy * 0.25);
    out.push(px * 0.25 + qx * 0.75, py * 0.25 + qy * 0.75);
  }
  return out;
}

/** Tiny per-vertex jitter so the ink line wobbles like it was drawn by hand. */
function jitter(loop: number[], rng: ReturnType<typeof makeRng>, amount: number): number[] {
  const out = loop.slice();
  for (let k = 0; k < out.length; k += 2) {
    out[k] += rng.jitter(amount);
    out[k + 1] += rng.jitter(amount);
  }
  return out;
}

/**
 * Offset a coast loop toward the water side (right of travel) by `dist`, for the
 * concentric contour rings. Uses averaged per-vertex right normals; for the small
 * offsets used here, occasional self-intersection just reads as hand-drawn.
 */
export function offsetLoopToWater(loop: number[], dist: number): number[] {
  const n = loop.length / 2;
  const out = new Array<number>(loop.length);
  for (let k = 0; k < n; k++) {
    const prev = (k - 1 + n) % n;
    const next = (k + 1) % n;
    // Average of incoming and outgoing right normals. Right of dir (dx,dy) = (dy,-dx).
    const inX = loop[k * 2]! - loop[prev * 2]!;
    const inY = loop[k * 2 + 1]! - loop[prev * 2 + 1]!;
    const outX = loop[next * 2]! - loop[k * 2]!;
    const outY = loop[next * 2 + 1]! - loop[k * 2 + 1]!;
    let nx = inY + outY;
    let ny = -(inX + outX);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    out[k * 2] = loop[k * 2]! + nx * dist;
    out[k * 2 + 1] = loop[k * 2 + 1]! + ny * dist;
  }
  return out;
}
