/*
  Editing tools (CLAUDE.md §9). Each tool reacts to pointer events (in world coords)
  routed from the canvas, and edits through the store's edit actions so undo/redo and
  local re-render are handled uniformly. Kept in one module for cohesion; the registry
  maps a ToolId to its handlers.
*/

import { useAppStore, type ToolId } from '@/state/store';
import { makeNamer } from '@/gen/steps/naming';
import { makeRng, randomSeedString } from '@/gen/rng';
import { nearestCell } from '@/gen/grid';
import { routeBetweenCells } from '@/gen/steps/roads';
import { applySeaLevel } from '@/gen/steps/sealevel';
import { classifyBiomes } from '@/gen/steps/biomes';
import {
  Biome,
  Water,
  type BiomeId,
  type Feature,
  type FeatureKind,
  type River,
  type Road,
  type World,
} from '@/model/world';

export interface ToolEvent {
  x: number;
  y: number;
  shiftKey: boolean;
}

export interface Tool {
  cursor: string;
  /** Return `false` to decline the event and let the canvas fall through to pan. */
  onDown?(e: ToolEvent): boolean | void;
  onMove?(e: ToolEvent): void;
  onUp?(e: ToolEvent): void;
}

// --- Hit-testing -----------------------------------------------------------

const ICON_HIT: Partial<Record<FeatureKind, number>> = {
  capital: 18,
  city: 15,
  town: 12,
  village: 10,
  tower: 13,
  fortress: 15,
  ruin: 12,
  temple: 13,
};

function featureAt(world: World, x: number, y: number): Feature | null {
  let best: Feature | null = null;
  let bestD = Infinity;
  for (const f of world.features) {
    const r = ICON_HIT[f.kind] ?? 12;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < r && d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function labelAt(world: World, x: number, y: number): Label | null {
  let best: Label | null = null;
  let bestD = Infinity;
  for (const l of world.labels) {
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < 60 && d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// --- Select / Move ---------------------------------------------------------

const selectTool: Tool = (() => {
  let drag: { kind: 'feature' | 'label'; id: string; dx: number; dy: number; moved: boolean } | null = null;

  return {
    cursor: 'default',
    onDown(e) {
      const st = useAppStore.getState();
      const world = st.world;
      if (!world) return;
      const f = featureAt(world, e.x, e.y);
      const l = f ? null : labelAt(world, e.x, e.y);
      if (f) {
        st.selectObject({ kind: 'feature', id: f.id });
        drag = { kind: 'feature', id: f.id, dx: e.x - f.x, dy: e.y - f.y, moved: false };
      } else if (l) {
        st.selectObject({ kind: 'label', id: l.id });
        drag = { kind: 'label', id: l.id, dx: e.x - l.x, dy: e.y - l.y, moved: false };
      } else {
        st.selectObject(null);
        drag = null;
        return false; // nothing hit → let the canvas fall through to pan
      }
    },
    onMove(e) {
      if (!drag) return;
      const st = useAppStore.getState();
      const world = st.world;
      if (!world) return;
      const obj =
        drag.kind === 'feature'
          ? world.features.find((f) => f.id === drag!.id)
          : world.labels.find((l) => l.id === drag!.id);
      if (!obj || obj.locked) return;
      if (!drag.moved) {
        st.beginEdit([drag.kind === 'feature' ? 'features' : 'labels']);
        drag.moved = true;
      }
      obj.x = e.x - drag.dx;
      obj.y = e.y - drag.dy;
      st.touchWorld(drag.kind === 'feature' ? ['settlements', 'labels', 'decoration'] : ['labels']);
    },
    onUp() {
      drag = null;
    },
  };
})();

// --- Place feature ---------------------------------------------------------

const placeTool: Tool = {
  cursor: 'crosshair',
  onDown(e) {
    const st = useAppStore.getState();
    if (!st.world) return;
    const kind = st.placeKind;
    const rank = kind === 'capital' ? 4 : kind === 'city' ? 3 : kind === 'town' ? 2 : 1;
    const namer = makeNamer(makeRng(randomSeedString()), st.config.namingStyle);
    const feature: Feature = {
      id: `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
      kind,
      x: e.x,
      y: e.y,
      rank,
      name: namer('generic'),
    };
    st.applyEdit(['features'], (w) => w.features.push(feature), ['settlements', 'labels']);
    st.selectObject({ kind: 'feature', id: feature.id });
  },
};

// --- Brushes (biome / mountain) --------------------------------------------

function paint(world: World, cx: number, cy: number, radius: number, biome: BiomeId, raise: boolean): void {
  const { grid, cells } = world;
  const r2 = radius * radius;
  for (let i = 0; i < grid.count; i++) {
    if (cells.water[i] !== Water.land) continue; // brushes don't reshape coastlines
    const dx = grid.points[i * 2]! - cx;
    const dy = grid.points[i * 2 + 1]! - cy;
    if (dx * dx + dy * dy > r2) continue;
    cells.biome[i] = biome;
    if (raise) cells.height[i] = Math.max(cells.height[i]!, 0.72);
  }
}

function makeBrush(biomeFor: () => BiomeId, raise: boolean): Tool {
  let painting = false;
  let lastCommit = 0;
  const stroke = (e: ToolEvent) => {
    const st = useAppStore.getState();
    if (!st.world) return;
    paint(st.world, e.x, e.y, st.brushSize, biomeFor(), raise);
    const now = performance.now();
    if (now - lastCommit > 140) {
      lastCommit = now;
      st.touchWorld(['biomes', 'relief', 'forests'], true);
    }
  };
  return {
    cursor: 'crosshair',
    onDown(e) {
      const st = useAppStore.getState();
      if (!st.world) return;
      st.beginEdit(['biome', 'height']);
      painting = true;
      lastCommit = 0;
      stroke(e);
    },
    onMove(e) {
      if (painting) stroke(e);
    },
    onUp() {
      if (!painting) return;
      painting = false;
      useAppStore.getState().touchWorld(['biomes', 'relief', 'forests'], true);
    },
  };
}

const biomeBrush = makeBrush(() => useAppStore.getState().brushBiome, false);
const mountainBrush = makeBrush(() => Biome.mountain, true);

// --- Coastline brush (CLAUDE.md §9) ----------------------------------------
//
// Raise land (or lower it to sea with Shift) by painting the height field, then
// re-derive land/ocean classification and biomes so the coastline redraws. The
// reclassification is global but rng-free and O(cells), so it's fast; this keeps
// water connectivity (ocean vs enclosed lake) and the beach ring correct.

function reshapeCoast(world: World, cx: number, cy: number, radius: number, lower: boolean): void {
  const { grid, cells } = world;
  const sea = world.config.seaLevel;
  const r2 = radius * radius;
  for (let i = 0; i < grid.count; i++) {
    const dx = grid.points[i * 2]! - cx;
    const dy = grid.points[i * 2 + 1]! - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    // Gentle radial falloff so edits dome up / dish down rather than sit flat.
    const t = 1 - Math.sqrt(d2) / radius;
    if (lower) {
      cells.height[i] = Math.min(cells.height[i]!, sea - 0.06 - 0.1 * t);
    } else {
      cells.height[i] = Math.max(cells.height[i]!, sea + 0.06 + 0.14 * t);
    }
    if (cells.height[i]! < 0) cells.height[i] = 0;
    if (cells.height[i]! > 1) cells.height[i] = 1;
  }
}

const COAST_DIRTY = ['ocean', 'land', 'biomes', 'relief', 'forests', 'decoration'];

const coastlineBrush: Tool = (() => {
  let painting = false;
  let lastCommit = 0;
  const recompute = (world: World) => {
    applySeaLevel(world, world.config);
    classifyBiomes(world, world.config);
  };
  const stroke = (e: ToolEvent) => {
    const st = useAppStore.getState();
    const world = st.world;
    if (!world) return;
    reshapeCoast(world, e.x, e.y, st.brushSize, e.shiftKey);
    const now = performance.now();
    if (now - lastCommit > 140) {
      lastCommit = now;
      recompute(world);
      st.touchWorld(COAST_DIRTY, true);
    }
  };
  return {
    cursor: 'crosshair',
    onDown(e) {
      const st = useAppStore.getState();
      if (!st.world) return;
      st.beginEdit(['height', 'biome', 'water', 'isWater', 'oceanDist']);
      painting = true;
      lastCommit = 0;
      stroke(e);
    },
    onMove(e) {
      if (painting) stroke(e);
    },
    onUp() {
      if (!painting) return;
      painting = false;
      const st = useAppStore.getState();
      if (st.world) recompute(st.world);
      st.touchWorld(COAST_DIRTY, true);
    },
  };
})();

// --- Road tool (CLAUDE.md §9) ----------------------------------------------
//
// Click a settlement, then another; route a least-cost path over the terrain cost
// field and add it. A road if both endpoints are town-or-larger, else a trail.

const SETTLEMENT_KINDS: ReadonlySet<FeatureKind> = new Set(['capital', 'city', 'town', 'village']);

// Generous 40-world-px radius (~12 screen px at fit zoom ~0.3) so clicks on small icons land.
const ROAD_HIT = 40;
function settlementNear(world: World, x: number, y: number): Feature | null {
  let best: Feature | null = null;
  let bestD = ROAD_HIT;
  for (const f of world.features) {
    if (!SETTLEMENT_KINDS.has(f.kind)) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

const roadTool: Tool = (() => {
  let startId: string | null = null;

  return {
    cursor: 'crosshair',
    onDown(e) {
      const st = useAppStore.getState();
      const world = st.world;
      if (!world) return;
      const f = settlementNear(world, e.x, e.y);
      if (!f) {
        startId = null;
        st.selectObject(null);
        return false; // no settlement hit → fall through to pan
      }
      if (startId === null || startId === f.id) {
        startId = f.id;
        st.selectObject({ kind: 'feature', id: f.id });
        return;
      }
      const start = world.features.find((x) => x.id === startId);
      if (!start) {
        startId = f.id;
        return;
      }
      const a = nearestCell(world.grid, start.x, start.y);
      const b = nearestCell(world.grid, f.x, f.y);
      const path = routeBetweenCells(world, a, b);
      if (path) {
        const isRoad = (start.rank ?? 1) >= 2 && (f.rank ?? 1) >= 2;
        const road: Road = {
          id: `rd-m${Date.now().toString(36)}`,
          points: path,
          kind: isRoad ? 'road' : 'trail',
        };
        st.applyEdit(['roads'], (w) => w.roads.push(road), ['roads']);
      }
      startId = null;
      st.selectObject(null);
    },
  };
})();

// --- River tool (CLAUDE.md §9) ---------------------------------------------
//
// Drag to free-draw a river that tapers from a thin source to a thick mouth. A
// click without dragging deletes the nearest river instead.

const RIVER_SAMPLE = 7; // min px between captured points
const RIVER_DELETE_DIST = 16;

function riverNear(world: World, x: number, y: number): string | null {
  let best: string | null = null;
  let bestD = RIVER_DELETE_DIST;
  for (const r of world.rivers) {
    for (const [px, py] of r.points) {
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) {
        bestD = d;
        best = r.id;
      }
    }
  }
  return best;
}

const riverTool: Tool = (() => {
  let pts: [number, number][] = [];
  let down: { x: number; y: number } | null = null;

  return {
    cursor: 'crosshair',
    onDown(e) {
      const world = useAppStore.getState().world;
      if (!world) return;
      // Don't allow starting a river on open ocean or lake.
      const ci = nearestCell(world.grid, e.x, e.y);
      if (world.cells.water[ci] !== Water.land) return false;
      down = { x: e.x, y: e.y };
      pts = [[e.x, e.y]];
    },
    onMove(e) {
      if (!down) return;
      const world = useAppStore.getState().world;
      if (!world) return;
      // Skip points that cross over water cells mid-stroke.
      const ci = nearestCell(world.grid, e.x, e.y);
      if (world.cells.water[ci] !== Water.land) return;
      const last = pts[pts.length - 1]!;
      if (Math.hypot(e.x - last[0], e.y - last[1]) >= RIVER_SAMPLE) pts.push([e.x, e.y]);
    },
    onUp(e) {
      if (!down) return;
      const dragged = Math.hypot(e.x - down.x, e.y - down.y);
      const st = useAppStore.getState();
      const world = st.world;
      down = null;
      if (!world) return;

      if (pts.length < 3 || dragged < 12) {
        // Treated as a click → delete the nearest river, if any.
        const id = riverNear(world, e.x, e.y);
        if (id) st.applyEdit(['rivers'], (w) => (w.rivers = w.rivers.filter((r) => r.id !== id)), ['rivers']);
        pts = [];
        return;
      }
      // Taper width thin (source) → thick (mouth) along the drawn path.
      const n = pts.length;
      const widths = pts.map((_, i) => 1.3 + (i / (n - 1)) * 4.4);
      const river: River = { id: `rv-m${Date.now().toString(36)}`, points: pts.slice(), widthByPoint: widths };
      st.applyEdit(['rivers'], (w) => w.rivers.push(river), ['rivers']);
      pts = [];
    },
  };
})();

// --- Registry --------------------------------------------------------------

const TOOLS: Partial<Record<ToolId, Tool>> = {
  select: selectTool,
  feature: placeTool,
  biome: biomeBrush,
  mountain: mountainBrush,
  coastline: coastlineBrush,
  road: roadTool,
  river: riverTool,
};

/** The active tool's handlers, or null for not-yet-implemented tools. */
export function getTool(id: ToolId): Tool | null {
  return TOOLS[id] ?? null;
}

/** Tools that are interactive (vs. inert/coming-soon). */
export function isToolImplemented(id: ToolId): boolean {
  return id in TOOLS;
}
