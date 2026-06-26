/*
  App state (CLAUDE.md §3 — Zustand, lightweight, no boilerplate).

  Phase 0 holds only chrome/UI state and the active seed. The serialized World data
  model (CLAUDE.md §4) and undo/redo land in later phases; this file is the seam
  they'll plug into.
*/

import { create } from 'zustand';
import { randomSeedString } from '@/gen/rng';
import { DEFAULT_CONFIG, type GenConfig } from '@/gen/config';
import { Biome, type World, type FeatureKind, type BiomeId } from '@/model/world';
import { capture, apply, type EditField } from './history';

/** Which generation stage a regenerate request covers (CLAUDE.md §7). */
export type RegenScope = 'all' | 'terrain' | 'features' | 'labels';

/** Render layers to repaint after an edit; 'all' repaints the world stack. */
export type DirtyLayers = string[] | 'all';

/** The currently selected editable object (CLAUDE.md §9). */
export type Selection = { kind: 'feature' | 'label'; id: string } | null;

// Undo/redo stacks live outside React (they hold large snapshots); the store mirrors
// their depth as numbers so the toolbar can react.
const undoStack: import('./history').Snapshot[] = [];
const redoStack: import('./history').Snapshot[] = [];
const HISTORY_LIMIT = 60;

/** Tools in the left rail (CLAUDE.md §9). Inert in Phase 0 — used for selection UI. */
export type ToolId =
  | 'select'
  | 'coastline'
  | 'biome'
  | 'mountain'
  | 'river'
  | 'road'
  | 'feature';

interface AppState {
  mapName: string;
  seed: string;
  /** Placeholder until the theme token system lands (CLAUDE.md §8). */
  themeId: string;
  activeTool: ToolId;
  rightPanelOpen: boolean;
  /** Show the hover lore card over named places (CLAUDE.md §1). Off = inspector-only. */
  showLore: boolean;

  /** Generation knobs (CLAUDE.md §7). */
  config: GenConfig;
  /** When true the dice won't reseed — protect a seed you like (CLAUDE.md §7). */
  lockSeed: boolean;
  /** Independent sub-seeds so one stage can be re-rolled (CLAUDE.md §5, §7). */
  terrainSeed: string;
  featureSeed: string;
  labelSeed: string;
  /** Regenerate signal: scope + a bumped nonce the canvas watches. */
  regenScope: RegenScope;
  regenNonce: number;
  setConfig: (partial: Partial<GenConfig>) => void;
  toggleLockSeed: () => void;
  /** Re-roll one stage (or terrain = a fresh map keeping config). */
  regenerate: (scope: RegenScope) => void;

  /** Aging strength 0 (clean) … 1 (ancient) — drives the aging pass (CLAUDE.md §6.12). */
  aging: number;
  /** Toggleable map decorations (CLAUDE.md §6.11). */
  decor: { compass: boolean; scaleBar: boolean; creatures: boolean; frame: boolean };

  setAging: (n: number) => void;
  setDecor: (partial: Partial<AppState['decor']>) => void;

  /** Status-bar readouts, written by the canvas (CLAUDE.md §10). */
  cursorWorld: { x: number; y: number } | null;
  lastRenderMs: number;
  cellCount: number;
  /** True while a roll is running in the worker (drives the canvas loading state). */
  generating: boolean;
  setCursorWorld: (p: { x: number; y: number } | null) => void;
  setLastRenderMs: (ms: number) => void;
  setCellCount: (n: number) => void;
  setGenerating: (b: boolean) => void;

  setMapName: (name: string) => void;
  setSeed: (seed: string) => void;
  /** Dice button: mint a fresh random seed (CLAUDE.md §7). */
  reseed: () => void;
  setThemeId: (id: string) => void;
  setActiveTool: (tool: ToolId) => void;
  toggleRightPanel: () => void;
  toggleLore: () => void;

  // --- Editing (CLAUDE.md §9, §10) ------------------------------------------
  /** The live world; tools mutate it in place, then bump worldRev. */
  world: World | null;
  worldRev: number;
  /** Layers the canvas should repaint after the latest edit. */
  dirtyLayers: DirtyLayers;
  selection: Selection;
  undoDepth: number;
  redoDepth: number;

  /** Tool options shown in the inspector. */
  placeKind: FeatureKind;
  brushBiome: BiomeId;
  brushSize: number;
  setPlaceKind: (k: FeatureKind) => void;
  setBrushBiome: (b: BiomeId) => void;
  setBrushSize: (n: number) => void;

  /** Replace the whole world (full regen) — clears history + selection. */
  setWorld: (world: World) => void;
  /** Signal a render after a partial regen, swapping in the worker's fresh world. */
  commitRegen: (dirty: DirtyLayers, world: World) => void;
  selectObject: (sel: Selection) => void;

  /** Snapshot before a multi-step edit (e.g. a drag); clears redo. */
  beginEdit: (fields: EditField[]) => void;
  /** Signal a repaint mid/after a drag (no new snapshot). */
  touchWorld: (dirty: DirtyLayers, geom?: boolean) => void;
  /** Atomic edit: snapshot, mutate, repaint. */
  applyEdit: (fields: EditField[], mutate: (w: World) => void, dirty: DirtyLayers, geom?: boolean) => void;

  deleteSelected: () => void;
  toggleLockSelected: () => void;
  undo: () => void;
  redo: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  mapName: 'Untitled Map',
  seed: 'cartographer',
  themeId: 'old-atlas',
  activeTool: 'select',
  rightPanelOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  showLore: true,

  config: { ...DEFAULT_CONFIG },
  lockSeed: false,
  terrainSeed: 'cartographer',
  featureSeed: 'cartographer',
  labelSeed: 'cartographer',
  regenScope: 'all',
  regenNonce: 0,
  setConfig: (partial) =>
    set((s) => ({
      config: { ...s.config, ...partial },
      regenScope: 'all',
      regenNonce: s.regenNonce + 1,
    })),
  toggleLockSeed: () => set((s) => ({ lockSeed: !s.lockSeed })),
  regenerate: (scope) =>
    set((s) => {
      const next: Partial<AppState> = { regenScope: scope, regenNonce: s.regenNonce + 1 };
      if (scope === 'terrain' || scope === 'all') next.terrainSeed = randomSeedString();
      if (scope === 'features') next.featureSeed = randomSeedString();
      if (scope === 'labels') next.labelSeed = randomSeedString();
      return next;
    }),

  aging: 0.35,
  decor: { compass: true, scaleBar: true, creatures: true, frame: true },
  setAging: (aging) => set({ aging }),
  setDecor: (partial) => set((s) => ({ decor: { ...s.decor, ...partial } })),

  cursorWorld: null,
  lastRenderMs: 0,
  cellCount: 0,
  generating: false,
  setCursorWorld: (cursorWorld) => set({ cursorWorld }),
  setLastRenderMs: (lastRenderMs) => set({ lastRenderMs }),
  setCellCount: (cellCount) => set({ cellCount }),
  setGenerating: (generating) => set({ generating }),

  setMapName: (mapName) => set({ mapName }),
  setSeed: (seed) =>
    set((s) => ({
      seed,
      terrainSeed: seed,
      featureSeed: seed,
      labelSeed: seed,
      regenScope: 'all',
      regenNonce: s.regenNonce + 1,
    })),
  reseed: () => {
    const s = useAppStore.getState();
    if (s.lockSeed) return;
    s.setSeed(randomSeedString());
  },
  setThemeId: (themeId) => set({ themeId }),
  setActiveTool: (activeTool) => set({ activeTool }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleLore: () => set((s) => ({ showLore: !s.showLore })),

  // --- Editing --------------------------------------------------------------
  world: null,
  worldRev: 0,
  dirtyLayers: 'all',
  selection: null,
  undoDepth: 0,
  redoDepth: 0,

  placeKind: 'town',
  brushBiome: Biome.forest,
  brushSize: 36,
  setPlaceKind: (placeKind) => set({ placeKind }),
  setBrushBiome: (brushBiome) => set({ brushBiome }),
  setBrushSize: (brushSize) => set({ brushSize }),

  setWorld: (world) => {
    undoStack.length = 0;
    redoStack.length = 0;
    set((s) => ({
      world,
      worldRev: s.worldRev + 1,
      dirtyLayers: 'all',
      selection: null,
      undoDepth: 0,
      redoDepth: 0,
    }));
  },

  commitRegen: (dirtyLayers, world) => {
    undoStack.length = 0;
    redoStack.length = 0;
    set((s) => ({ world, worldRev: s.worldRev + 1, dirtyLayers, selection: null, undoDepth: 0, redoDepth: 0 }));
  },

  selectObject: (selection) => set({ selection }),

  beginEdit: (fields) => {
    const w = useAppStore.getState().world;
    if (!w) return;
    undoStack.push(capture(w, fields));
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    set({ undoDepth: undoStack.length, redoDepth: 0 });
  },

  touchWorld: (dirtyLayers, geom = false) =>
    set((s) => {
      if (geom && s.world) s.world.geomRev++;
      return { worldRev: s.worldRev + 1, dirtyLayers };
    }),

  applyEdit: (fields, mutate, dirtyLayers, geom = false) =>
    set((s) => {
      const w = s.world;
      if (!w) return {};
      undoStack.push(capture(w, fields));
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack.length = 0;
      mutate(w);
      if (geom) w.geomRev++;
      return { worldRev: s.worldRev + 1, dirtyLayers, undoDepth: undoStack.length, redoDepth: 0 };
    }),

  deleteSelected: () => {
    const s = useAppStore.getState();
    const sel = s.selection;
    if (!sel || !s.world) return;
    const fields: EditField[] = sel.kind === 'feature' ? ['features'] : ['labels'];
    s.applyEdit(
      fields,
      (w) => {
        if (sel.kind === 'feature') w.features = w.features.filter((f) => f.id !== sel.id);
        else w.labels = w.labels.filter((l) => l.id !== sel.id);
      },
      sel.kind === 'feature' ? ['settlements', 'labels', 'decoration'] : ['labels'],
    );
    set({ selection: null });
  },

  toggleLockSelected: () => {
    const s = useAppStore.getState();
    const sel = s.selection;
    if (!sel || !s.world) return;
    const fields: EditField[] = sel.kind === 'feature' ? ['features'] : ['labels'];
    s.applyEdit(
      fields,
      (w) => {
        const obj =
          sel.kind === 'feature'
            ? w.features.find((f) => f.id === sel.id)
            : w.labels.find((l) => l.id === sel.id);
        if (obj) obj.locked = !obj.locked;
      },
      [],
    );
  },

  undo: () => {
    const s = useAppStore.getState();
    const w = s.world;
    if (!w || undoStack.length === 0) return;
    const snap = undoStack.pop()!;
    redoStack.push(capture(w, snap.fields));
    apply(w, snap);
    if (snap.fields.some((f) => f === 'biome' || f === 'height' || f === 'water')) w.geomRev++;
    set((st) => ({
      worldRev: st.worldRev + 1,
      dirtyLayers: 'all',
      selection: null,
      undoDepth: undoStack.length,
      redoDepth: redoStack.length,
    }));
  },

  redo: () => {
    const s = useAppStore.getState();
    const w = s.world;
    if (!w || redoStack.length === 0) return;
    const snap = redoStack.pop()!;
    undoStack.push(capture(w, snap.fields));
    apply(w, snap);
    if (snap.fields.some((f) => f === 'biome' || f === 'height' || f === 'water')) w.geomRev++;
    set((st) => ({
      worldRev: st.worldRev + 1,
      dirtyLayers: 'all',
      selection: null,
      undoDepth: undoStack.length,
      redoDepth: redoStack.length,
    }));
  },
}));
