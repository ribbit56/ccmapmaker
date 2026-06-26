/*
  Roads (CLAUDE.md §5 step 12). Connect settlements with least-cost paths over a
  terrain cost field (mountains/marsh/steep ground expensive, plains cheap, open water
  impassable), then weave them into a network.

  1. Cost field per cell.
  2. Candidate edges between each settlement and its nearest neighbours; A* each.
  3. Kruskal MST over those edges so the whole network connects with least total cost,
     plus a few cheap extra edges (roadDensity) for loops.
  4. Merge every path into one undirected edge graph (shared segments collapse), then
     trace it into polyline chains. Town+ connections are roads; anything touching a
     village is a trail.

  Pure: mutates world.roads.
*/

import { MinHeap } from '@/lib/heap';
import { Water, type Road, type World } from '@/model/world';
import type { GenConfig } from '../config';

const NEAREST_K = 4;

export function generateRoads(world: World, config: GenConfig): World {
  const { grid } = world;
  const { count, points } = grid;

  // Settlement nodes (not landmarks) → their cell ids.
  const siteToCell = new Map<string, number>();
  for (let i = 0; i < count; i++) siteToCell.set(`${points[i * 2]},${points[i * 2 + 1]}`, i);

  const nodes: { cell: number; rank: number }[] = [];
  for (const f of world.features) {
    if (f.kind === 'capital' || f.kind === 'city' || f.kind === 'town' || f.kind === 'village') {
      const cell = siteToCell.get(`${f.x},${f.y}`);
      if (cell !== undefined) nodes.push({ cell, rank: f.rank ?? 1 });
    }
  }
  if (nodes.length < 2) {
    world.roads = [];
    return world;
  }

  const cost = buildCostField(world);

  // Candidate edges: each node to its K nearest neighbours (Euclidean).
  const cand = new Set<string>();
  for (let a = 0; a < nodes.length; a++) {
    const order = nodes
      .map((_, b) => b)
      .filter((b) => b !== a)
      .sort((b1, b2) => dist2(points, nodes[a]!.cell, nodes[b1]!.cell) - dist2(points, nodes[a]!.cell, nodes[b2]!.cell));
    for (let k = 0; k < Math.min(NEAREST_K, order.length); k++) {
      const b = order[k]!;
      cand.add(a < b ? `${a},${b}` : `${b},${a}`);
    }
  }

  // A* each candidate edge.
  const buf = {
    g: new Float32Array(count),
    from: new Int32Array(count),
    closed: new Uint8Array(count),
  };
  interface Edge {
    a: number;
    b: number;
    cost: number;
    path: number[];
  }
  const edges: Edge[] = [];
  for (const key of cand) {
    const [a, b] = key.split(',').map(Number) as [number, number];
    const res = aStar(grid, cost, nodes[a]!.cell, nodes[b]!.cell, buf);
    if (res) edges.push({ a, b, cost: res.cost, path: res.path });
  }
  edges.sort((e1, e2) => e1.cost - e2.cost);

  // Kruskal MST + a few cheap extras for loops.
  const parent = nodes.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const selected: Edge[] = [];
  const leftover: Edge[] = [];
  for (const e of edges) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) {
      parent[ra] = rb;
      selected.push(e);
    } else {
      leftover.push(e);
    }
  }
  const extra = Math.round(config.roadDensity * nodes.length * 0.35);
  for (let i = 0; i < Math.min(extra, leftover.length); i++) selected.push(leftover[i]!);

  // Merge paths into an undirected edge graph; road beats trail on shared segments.
  const ROAD = 2;
  const TRAIL = 1;
  const edgeKind = new Map<string, number>();
  for (const e of selected) {
    const kind = Math.min(nodes[e.a]!.rank, nodes[e.b]!.rank) >= 2 ? ROAD : TRAIL;
    for (let i = 0; i + 1 < e.path.length; i++) {
      const u = e.path[i]!;
      const v = e.path[i + 1]!;
      const ek = u < v ? `${u},${v}` : `${v},${u}`;
      edgeKind.set(ek, Math.max(edgeKind.get(ek) ?? 0, kind));
    }
  }

  world.roads = traceChains(world, edgeKind, ROAD);
  return world;
}

/**
 * Route a single least-cost path between two cells over the terrain cost field,
 * returned as world-coordinate points. Used by the manual Road tool (CLAUDE.md §9).
 * Returns null if no land path exists (e.g. the cells are on separate landmasses).
 */
export function routeBetweenCells(
  world: World,
  startCell: number,
  goalCell: number,
): [number, number][] | null {
  const { grid } = world;
  const cost = buildCostField(world);
  const buf = {
    g: new Float32Array(grid.count),
    from: new Int32Array(grid.count),
    closed: new Uint8Array(grid.count),
  };
  const res = aStar(grid, cost, startCell, goalCell, buf);
  if (!res || res.path.length < 2) return null;
  return res.path.map((c) => [grid.points[c * 2]!, grid.points[c * 2 + 1]!] as [number, number]);
}

function dist2(pts: Float64Array, c1: number, c2: number): number {
  const dx = pts[c1 * 2]! - pts[c2 * 2]!;
  const dy = pts[c1 * 2 + 1]! - pts[c2 * 2 + 1]!;
  return dx * dx + dy * dy;
}

/** Traversal cost per cell: low on open lowland, high on rough ground, ∞ on water. */
function buildCostField(world: World): Float32Array {
  const { grid, cells } = world;
  const { count, neighbors } = grid;
  const cost = new Float32Array(count);

  const BIOME_PEN: Record<number, number> = {
    14: 12, // mountain
    15: 22, // glacier
    9: 8, // snow
    12: 9, // marsh
    6: 3, // rainforest
    10: 2.5, // desert
    13: 2, // hills
    5: 1.5, // forest
    7: 2, // taiga
    8: 3, // tundra
  };

  for (let i = 0; i < count; i++) {
    if (cells.water[i] !== Water.land) {
      cost[i] = Infinity;
      continue;
    }
    let c = 1 + (BIOME_PEN[cells.biome[i]!] ?? 0);
    // Slope penalty (roads avoid climbing).
    let slope = 0;
    const nbs = neighbors[i]!;
    for (const nb of nbs) slope += Math.abs(cells.height[i]! - cells.height[nb]!);
    slope /= Math.max(1, nbs.length);
    c += slope * 40;
    c += Math.max(0, cells.height[i]! - 0.5) * 6; // prefer lowlands
    cost[i] = c;
  }
  return cost;
}

interface AStarBuf {
  g: Float32Array;
  from: Int32Array;
  closed: Uint8Array;
}

function aStar(
  grid: World['grid'],
  cost: Float32Array,
  start: number,
  goal: number,
  buf: AStarBuf,
): { path: number[]; cost: number } | null {
  const { neighbors, points } = grid;
  const { g, from, closed } = buf;
  g.fill(Infinity);
  from.fill(-1);
  closed.fill(0);

  const gx = points[goal * 2]!;
  const gy = points[goal * 2 + 1]!;
  const heur = (c: number) => Math.hypot(points[c * 2]! - gx, points[c * 2 + 1]! - gy);

  g[start] = 0;
  const open = new MinHeap();
  open.push(start, heur(start));

  while (open.size > 0) {
    const cur = open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = points[cur * 2]!;
    const cy = points[cur * 2 + 1]!;
    for (const nb of neighbors[cur]!) {
      if (closed[nb] || !isFinite(cost[nb]!)) continue;
      const d = Math.hypot(points[nb * 2]! - cx, points[nb * 2 + 1]! - cy);
      const tentative = g[cur]! + ((cost[cur]! + cost[nb]!) * 0.5) * d;
      if (tentative < g[nb]!) {
        g[nb] = tentative;
        from[nb] = cur;
        open.push(nb, tentative + heur(nb));
      }
    }
  }

  if (from[goal] === -1 && goal !== start) return null;
  const path: number[] = [];
  let c = goal;
  while (c !== -1) {
    path.push(c);
    if (c === start) break;
    c = from[c]!;
  }
  path.reverse();
  return { path, cost: g[goal]! };
}

/** Trace the merged edge graph into polyline chains between junctions/endpoints. */
function traceChains(world: World, edgeKind: Map<string, number>, ROAD: number): Road[] {
  const { points } = world.grid;
  const adj = new Map<number, { to: number; kind: number; ek: string }[]>();
  const addAdj = (u: number, to: number, kind: number, ek: string) => {
    const list = adj.get(u);
    if (list) list.push({ to, kind, ek });
    else adj.set(u, [{ to, kind, ek }]);
  };
  for (const [ek, kind] of edgeKind) {
    const [u, v] = ek.split(',').map(Number) as [number, number];
    addAdj(u, v, kind, ek);
    addAdj(v, u, kind, ek);
  }

  const used = new Set<string>();
  const roads: Road[] = [];

  const emit = (cellPath: number[], road: boolean) => {
    if (cellPath.length < 2) return;
    const pts: [number, number][] = cellPath.map((c) => [points[c * 2]!, points[c * 2 + 1]!]);
    roads.push({ id: `rd${roads.length}`, points: pts, kind: road ? 'road' : 'trail' });
  };

  // Chains starting at junctions/endpoints (degree ≠ 2).
  for (const [node, list] of adj) {
    if (list.length === 2) continue;
    for (const start of list) {
      if (used.has(start.ek)) continue;
      const chain = [node];
      let kinds = start.kind;
      let prevEk = start.ek;
      let cur = start.to;
      used.add(start.ek);
      chain.push(cur);
      // Walk through degree-2 cells.
      for (;;) {
        const next = adj.get(cur)!;
        if (next.length !== 2) break;
        const onward = next.find((e) => e.ek !== prevEk && !used.has(e.ek));
        if (!onward) break;
        used.add(onward.ek);
        kinds = Math.max(kinds, onward.kind);
        prevEk = onward.ek;
        cur = onward.to;
        chain.push(cur);
      }
      emit(chain, kinds >= ROAD);
    }
  }

  // Any remaining edges form pure loops.
  for (const [node, list] of adj) {
    for (const start of list) {
      if (used.has(start.ek)) continue;
      const chain = [node];
      let kinds = start.kind;
      let prevEk = start.ek;
      let cur = start.to;
      used.add(start.ek);
      chain.push(cur);
      for (;;) {
        const next = adj.get(cur)!;
        const onward = next.find((e) => e.ek !== prevEk && !used.has(e.ek));
        if (!onward) break;
        used.add(onward.ek);
        kinds = Math.max(kinds, onward.kind);
        prevEk = onward.ek;
        cur = onward.to;
        chain.push(cur);
        if (cur === node) break;
      }
      emit(chain, kinds >= ROAD);
    }
  }

  return roads;
}
