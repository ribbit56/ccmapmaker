# CLAUDE.md — Cartographer's Table

> A painterly fantasy map generator for the web. Roll a whole world with one click, then
> hand-edit every coastline, mountain, river, city, and label until it feels like it was
> drawn by hand and pressed into the front of an old novel.

This file is the project's source of truth. Read it fully before writing code, and keep it
updated as the design evolves. Build in the **phases** described at the bottom — do not try
to implement everything at once.

---

## 1. The vision (read this twice)

The output is a **piece of art**, not a data dashboard. A finished map should make someone
quietly say "oh, that's lovely." The feeling we're chasing: **warm, hand-illustrated, a little
nostalgic** — the painted maps in the endpapers of a beloved fantasy hardback, soft watercolor
washes, ink-drawn mountains, a compass rose in the corner, the faint stain of age on the paper.

Two truths to hold in tension:

- **Simple graphics, extremely polished.** We are *not* doing photorealism, height-shaded
  satellite relief, or busy detail. We are doing a small, restrained visual vocabulary
  (washes + glyphs + ink lines) executed with obsessive care for texture, edges, and color.
- **Generated, but editable.** The procedural engine produces a beautiful starting point in
  seconds. Every generated thing is then editable by hand. Generation and manual editing are
  the same surface, not two modes.

### Anti-goals (do not build these)
- No grid/hex overlays, fog of war, or VTT features. This is for *fun and art*, not TTRPG play.
- No political-simulation, economy, or worldbuilding-database features.
- No 3D, no globe view (flat map only).
- No accounts, no backend, no telemetry. It's a static client-side web app.

---

## 2. Two distinct aesthetics — keep them separate

There are **two** visual layers in this product and they must not bleed into each other:

1. **The map artifact** — parchment, watercolor, ink, aged. Warm and old. This is the canvas.
2. **The editor chrome** — the app shell around the canvas (toolbars, panels, sliders). This
   must have its own quiet, modern, confident identity. **Do not** make the chrome look like
   the map. A common failure is wrapping the whole UI in cream + serif + terracotta — that's a
   generic "AI-made warm app" default. Avoid it.

**Chrome direction:** a calm, slightly dark "drafting desk" feel — think the wood-and-brass
table the map sits on, not the map itself. Muted desaturated surface tones, one restrained
metallic/ink accent, a crisp modern UI typeface for controls. The chrome should recede so the
map is the hero. Pick deliberate tokens (below) rather than defaults.

---

## 3. Tech stack (decided — don't relitigate)

- **Vite + React + TypeScript** — project owner already works fluently in React + Vite + Tailwind.
- **Tailwind CSS** for the editor chrome only (not used to style the map).
- **Canvas 2D** for all map rendering, via a layered offscreen-canvas compositor (see §6).
  Rationale: the painterly look is about texture, blend modes, and jittered organic edges —
  all of which Canvas 2D does well, with far less complexity than WebGL for a solo build.
  *Upgrade path:* if large maps get slow, the static layers can move to PixiJS/WebGL later
  without changing the data model. Do not start there.
- **Zustand** for app state (lightweight, ergonomic, no boilerplate).
- **Web Worker + Comlink** for world generation, so the UI never blocks during a "roll."
- Generation libraries:
  - `simplex-noise` — heightmap / moisture noise.
  - `d3-delaunay` — Voronoi/Delaunay cell structure.
  - `poisson-disk-sampling` — evenly-spaced cell seeds and feature placement.
  - A small seeded PRNG (`mulberry32` inline, seeded from a hashed string) — **all randomness
    must flow through the seed** so a seed reproduces a world exactly.
- Deploy target: static build on Vercel. No server.

Keep dependencies lean. Prefer a 40-line local utility over a heavy library.

---

## 4. The world data model

The world is **pure serializable data**. Rendering and editing are functions of this data.
Generation writes it; tools mutate it; the renderer reads it; export serializes it. This
separation is the backbone of the whole app — respect it everywhere.

```ts
type Seed = string;
type CellId = number;

interface World {
  meta:   { name: string; seed: Seed; createdAt: string; schemaVersion: number };
  config: GenConfig;            // the knobs used to generate (see §7)
  themeId: ThemeId;            // active palette/aesthetic (see §8)
  grid:   VoronoiGrid;          // points, neighbors, polygons (geometry only)
  cells:  CellFields;           // typed-array-backed per-cell scalar fields
  rivers: River[];
  lakes:  Lake[];
  roads:  Road[];
  features: Feature[];          // settlements, fortresses, POIs, decorations
  labels: Label[];
}

// Per-cell fields stored as parallel typed arrays indexed by CellId (fast, compact)
interface CellFields {
  height:      Float32Array;    // 0..1, sea level is a config cut
  moisture:    Float32Array;    // 0..1
  temperature: Float32Array;    // 0..1 (from latitude + altitude)
  isWater:     Uint8Array;       // ocean or lake
  oceanDist:   Int16Array;       // graph distance to nearest ocean cell
  biome:       Uint8Array;       // index into Biome enum
  flux:        Float32Array;     // accumulated water flow (for rivers)
}

type FeatureKind =
  | 'capital' | 'city' | 'town' | 'village'
  | 'fortress' | 'ruin' | 'temple' | 'tower' | 'port'
  | 'mountainPeak' | 'compass' | 'shipDecor' | 'monsterDecor';

interface Feature {
  id: string; kind: FeatureKind;
  x: number; y: number;          // world coords
  rank?: number;                  // drives icon size for settlements
  name?: string; locked?: boolean;
}

interface River { id: string; points: [number, number][]; widthByPoint: number[]; }
interface Road  { id: string; points: [number, number][]; kind: 'road' | 'trail'; }
interface Label {
  id: string; text: string; x: number; y: number;
  role: 'region' | 'settlement' | 'water' | 'range' | 'title';
  rotation?: number; curve?: [number, number][]; locked?: boolean;
}
```

Biomes (Whittaker-style, classified from temperature × moisture, with altitude overrides):
`ocean, lake, beach, plains, grassland, forest, rainforest, taiga, tundra, snow, desert,
savanna, marsh, hills, mountain, glacier`.

**`locked`** on a feature/label means generation won't touch it on re-roll — critical for the
"generate, then protect what I like, re-roll the rest" workflow.

---

## 5. Generation pipeline (the "roll a world" engine)

Runs in a Web Worker. Each step is a **pure function** `(World, GenConfig, rng) => World`, so
any single step can be re-run independently ("regenerate rivers only" without touching land).

1. **Seed points** — Poisson-disc sample N points across the canvas (N from `config.detail`).
2. **Build grid** — Delaunay → Voronoi via `d3-delaunay`; cache neighbor lists and polygons.
3. **Heightmap** — sum 3–5 octaves of simplex noise; optionally multiply by a radial island
   mask (`config.shape`: `continent | archipelago | pangaea | islands`) so land tends inward.
4. **Sea level** — cut at `config.seaLevel`; mark ocean cells; flood-fill from edges so inland
   low areas can become lakes, not ocean.
5. **Smooth coast** — relax coastal cell heights so coastlines read as organic, not noisy.
6. **Ocean distance** — BFS from ocean cells (drives moisture + coastal halo rendering).
7. **Temperature** — from latitude band (top/bottom = cold) minus an altitude lapse.
8. **Moisture** — base from proximity to water, plus a simplified prevailing-wind rain-shadow
   pass (wet on windward side of mountains, dry leeward), plus noise.
9. **Biomes** — classify each land cell from temperature × moisture; override to
   `mountain/glacier/snow` above altitude thresholds, `beach` adjacent to ocean.
10. **Hydrology** — sort land cells by height desc; route flow downhill cell→lowest-neighbor;
    accumulate `flux`; emit a **River** where flux crosses a threshold; create **Lakes** at
    sinks/depressions. River width tapers from source (thin) to mouth (thick).
11. **Settlements** — score every land cell for suitability (coastal +, river-adjacent +,
    flat +, temperate +, not-marsh −, not-snow −); Poisson-select winners so they're spaced;
    assign ranks → `capital/city/town/village`; flag coastal ones as `port`. Scatter a few
    `fortress/ruin/tower` in dramatic spots (passes, peaks, peninsulas).
12. **Roads** — connect settlements with a least-cost path (A*) over a terrain cost field
    (mountains/water expensive, plains cheap); merge shared segments into a road network;
    short spurs become `trail`s.
13. **Naming** — syllable-based fantasy name generator (seeded), with light per-biome flavor
    (coastal names feel different from mountain names). Name settlements, major rivers,
    regions, and ranges.
14. **Labels** — place labels with simple collision avoidance; region labels follow the
    centroid of a biome cluster; water labels sit in open sea; range labels curve along the
    spine of a mountain cluster.

Re-roll respects `locked` features/labels and any hand-edited cells (track a `dirty` mask so
manual edits survive a partial regenerate).

---

## 6. Rendering pipeline (where the beauty lives)

The renderer composites **independent offscreen canvas layers** bottom-to-top, then draws the
composite to the visible canvas. Static layers are cached and only redrawn when their data
changes; pan/zoom just re-blits. This is the single most important part of the app — spend
the most care here.

**Layer order (bottom → top):**

1. **Paper** — warm parchment base: a soft radial warm-to-cooler gradient + fine fiber noise +
   faint blotches. This is the foundation of the whole mood.
2. **Ocean** — soft wash with a gentle gradient by depth; add hand-drawn-feeling **coastal
   contour lines** (concentric offset lines hugging the coast, 3–5 rings fading out) — the
   single most "old map" signal. Light stippling near shores.
3. **Landmass** — fill the land silhouette; add a subtle warm inner glow at the coast and a
   barely-there drop shadow so land sits *on* the paper.
4. **Biome washes** — fill biome regions with **2–3 stacked low-opacity passes** using
   `multiply` blend for depth. Edges are **not** the raw Voronoi polygon — they're jittered
   via recursive midpoint displacement so every fill has an organic watercolor bleed.
5. **Relief glyphs** — scatter small hand-drawn **mountain** and **hill** glyphs on high cells
   (denser/larger with altitude), **dune** glyphs on desert, **marsh tufts** on marsh. Glyphs
   are pre-rendered sprites drawn with slight per-instance rotation/scale/flip + tiny position
   jitter so no two read identically.
6. **Forests** — clustered tiny tree glyphs scaled by forest density; vary species glyph by
   biome (round for broadleaf, spiky for taiga).
7. **Rivers & lakes** — tapered ink strokes, width from `widthByPoint`, with a faint lighter
   centerline; lakes get the same wash + contour treatment as ocean, smaller.
8. **Roads** — fine dashed/dotted ink paths; trails lighter and more broken than roads.
9. **Settlements** — illustrated icons (a clustered-roofs city, a walled town, a single tower,
   a star-fort fortress, a broken arch for ruins), sized by rank, with a tiny cast shadow.
10. **Labels** — calligraphic/serif lettering: region names in faded wide tracking caps,
    settlements in a small serif beside their icon, water in italic, ranges curved along the
    range. Give labels a faint paper-colored halo so they stay legible over washes.
11. **Decoration** — compass rose, scale bar, optional ships/sea-monsters in empty ocean, and
    an ornamental **border frame**. All optional/toggleable.
12. **Aging (final pass)** — global grain, a soft vignette, optional coffee-stain blotches and
    edge darkening. Strength is a slider (0 = clean, 1 = ancient).

**Painterly techniques to implement as reusable helpers:**
- `jitterPolygon(points, depth)` — recursive midpoint displacement for organic edges.
- `layeredWash(ctx, region, color, passes)` — stacked low-opacity `multiply` fills.
- `inkStroke(ctx, points, widthFn)` — tapered, slightly wobbly variable-width stroke.
- `scatterGlyphs(cells, sprite, densityFn, rng)` — jittered sprite placement.
- A small **sprite cache** that pre-renders glyphs once per theme/zoom bucket.

Everything is tinted toward the active theme's paper color so the palette stays cohesive — no
pure black, no pure white anywhere on the map.

---

## 7. Generation controls (customization)

Expose these as the **Generate** panel. All feed `GenConfig`; changing one and hitting
regenerate (or a specific layer's regenerate) updates the world.

- **Seed** (text field + dice button) and a **lock-seed** toggle.
- **World shape**: continent / archipelago / pangaea / scattered islands.
- **Detail** (cell count — affects fidelity and performance).
- **Sea level**, **mountain density**, **forest coverage**, **river density**,
  **temperature bias** (icy ↔ tropical), **moisture bias** (arid ↔ lush).
- **Settlement count** and **road density**.
- **Label density** and **naming style** (a few flavor presets).
- Per-layer **"regenerate just this"** buttons (terrain / rivers / settlements / roads /
  names / labels) so the user can roll until one part is perfect and lock the rest.

---

## 8. Theming

A **Theme** is a named token set: paper color, ocean palette, the biome color ramp, ink color,
label color, glyph stroke color, and aging defaults. Themes change the entire mood without
touching geometry. Ship at least:

- **Old Atlas** — warm cream paper, sepia ink, muted sage/ochre/dusty-blue biomes (the default).
- **Dusk** — darker tea-stained paper, deeper inks, candle-lit warmth.
- **Verdant** — fresher, slightly brighter, storybook feel.
- **Moonlit** — cool blue-grey paper for a nighttime/elven map.

Themes are data, not code — make adding a theme a matter of adding one token object.

---

## 9. Editing tools

The left tool rail. Generation and editing share the same canvas; selecting a tool changes
what clicks/drags do. The right inspector shows the active tool's options + the selected
object's properties.

- **Select/Move** — pick and reposition features/labels; lock/unlock; delete.
- **Coastline brush** — raise/lower land (paints `height`, re-runs land/ocean + coast locally).
- **Biome brush** — paint a biome onto cells.
- **Mountain / forest stamp** — add or erase relief and forest density.
- **River tool** — draw or reroute a river by dragging; delete a river.
- **Road tool** — click two settlements (or free-draw) to lay a road/trail.
- **Place feature** — drop a city/town/fortress/tower/ruin/port; set rank; rename.
- **Label tool** — add/edit/move/rotate/curve text; pick role.
- **Decoration** — place compass, ships, sea monsters; toggle the border frame.

Local edits should re-render only affected layers/regions, never the whole world from scratch.
Provide **undo/redo** (snapshot the relevant slice of the data model).

---

## 10. App shell & UX

- **Top bar:** map name, seed display + dice, theme picker, undo/redo, Export, Save/Load.
- **Left rail:** tool palette (icon buttons with tooltips + keyboard shortcuts).
- **Right panel:** context-sensitive — Generate controls, layer visibility toggles, aging
  slider, and the selected object's inspector. Collapsible.
- **Canvas:** smooth pan (space-drag / middle-drag) and zoom (wheel, pinch); cursor reflects
  the active tool.
- **Status bar:** seed, cursor coords/biome, cell count, render time.
- Keyboard shortcuts for tools (V move, B biome, M mountain, R river, etc.), undo/redo,
  and a `G` to re-roll.

Quality floor: responsive layout (panels collapse on narrow screens), visible keyboard focus,
`prefers-reduced-motion` respected, no layout shift while generating (show a tasteful loading
state in the canvas).

---

## 11. Export & persistence

- **Export PNG** at selectable resolution (1×/2×/4×), with options: include border frame,
  include labels, include aging. Render export off the visible canvas at full res.
- **Save/Load `.world.json`** — the serialized `World` (download + file import). This is the
  project file; a seed alone won't preserve hand-edits, so save the full model.
- **Autosave** the current world to `localStorage` (last session restore). Named saves also in
  `localStorage`. No backend.
- Keep `schemaVersion` in `meta` and write a tiny migration shim so old saves still load.

---

## 12. Directory structure

```
src/
  app/                 # React shell, layout, panels, toolbar
  state/               # Zustand store, undo/redo, selection
  model/               # World types, schema, migrations, serialization
  gen/                 # generation pipeline (pure fns) + worker entry
    steps/             # heightmap, biomes, hydrology, settlements, roads, naming, labels
    noise.ts  rng.ts   grid.ts
  render/              # canvas compositor + one module per layer
    layers/            # paper, ocean, land, washes, relief, forest, rivers, roads,
                       # settlements, labels, decoration, aging
    paint/             # jitterPolygon, layeredWash, inkStroke, scatterGlyphs, spriteCache
  themes/              # theme token objects
  glyphs/              # sprite definitions / drawing fns for mountains, trees, icons
  tools/               # editing tools (one module per tool)
  export/              # png + json export
  lib/                 # small shared utilities
```

---

## 13. Conventions & quality bar

- TypeScript strict mode; no `any` in the data model or render core.
- Generation steps and paint helpers are **pure and deterministic** given `(input, rng)`.
- All randomness goes through the seeded PRNG — never `Math.random()`.
- Per-cell data lives in **typed arrays**, not arrays of objects.
- Render layers are independent and individually cacheable; never redraw everything for a
  local edit.
- Comment the *why* (especially the geography/art reasoning), not the obvious *what*.
- Definition of done for any visual layer: it looks hand-made, edges are organic (no visible
  Voronoi polygons or hard noise), colors stay within the theme, and it composites cleanly
  over the layers below.

---

## 14. Build phases (do these in order)

Build and visually verify each phase before moving on. Each phase should end with something
on screen worth looking at.

- **Phase 0 — Scaffold.** Vite + React + TS + Tailwind + Zustand. App shell with top bar,
  rails, and a canvas that renders the **paper** layer with working pan/zoom.
- **Phase 1 — Terrain.** Seeded PRNG, Voronoi grid, heightmap, sea-level cut, land/ocean
  render with the coastal contour rings. "Roll" button reseeds. *(This is the moment it
  starts to feel real — make the coastline beautiful here.)*
- **Phase 2 — Biomes.** Temperature/moisture, biome classification, layered watercolor washes
  with jittered edges. Add the **Old Atlas** theme.
- **Phase 3 — Relief & forests.** Mountain/hill/dune/marsh glyphs and forest clusters.
- **Phase 4 — Hydrology.** Rivers (tapered ink) and lakes.
- **Phase 5 — Settlements & naming.** Suitability placement, illustrated icons, fantasy names.
- **Phase 6 — Roads.** Least-cost road network + trails.
- **Phase 7 — Labels.** Calligraphic labels with halos and collision avoidance.
- **Phase 8 — Decoration & aging.** Compass, scale bar, ships/monsters, border frame, the
  aging/vignette final pass with its slider.
- **Phase 9 — Generation controls.** Full Generate panel + per-layer regenerate + locking.
- **Phase 10 — Editing tools.** The tool rail, inspector, undo/redo, local re-render.
- **Phase 11 — Themes, export, persistence.** Remaining themes, PNG/JSON export, save/load,
  autosave.
- **Phase 12 — Polish.** Move generation to a Web Worker if not already; performance pass;
  micro-interactions; the final aesthetic critique against §1.

---

## 15. When in doubt

Optimize for **how the finished map feels**, not for feature count or simulation accuracy.
If a geographically "correct" choice and a prettier choice conflict, pick prettier — this is
art. Show, don't ask: when a default would do, pick a tasteful one and move on. Keep the
editor chrome quiet so the map is always the hero.
