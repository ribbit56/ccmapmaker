/*
  Right inspector panel (CLAUDE.md §10) — collapsible, context-sensitive. Hosts the
  live Generate controls (§7), layer list, decoration toggles, aging, and inspector.
*/
import { useAppStore } from '@/state/store';
import type { GenConfig, WorldShape, NamingStyle } from '@/gen/config';
import { Biome, type BiomeId, type Feature, type FeatureKind, type Label } from '@/model/world';

export function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);
  if (!open) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-desk-700 bg-desk-900 p-4 text-sm">
      <Section title="Generate">
        <GenerateControls />
      </Section>

      <Section title="Layers">
        <LayerRow name="Paper" on />
        <LayerRow name="Ocean" on />
        <LayerRow name="Land" on />
        <LayerRow name="Biomes" on />
        <LayerRow name="Relief" on />
        <LayerRow name="Forests" on />
        <LayerRow name="Rivers" on />
        <LayerRow name="Roads" on />
        <LayerRow name="Settlements" on />
        <LayerRow name="Labels" on />
      </Section>

      <Section title="Decoration">
        <DecorToggle name="Compass rose" k="compass" />
        <DecorToggle name="Scale bar" k="scaleBar" />
        <DecorToggle name="Sea creatures" k="creatures" />
        <DecorToggle name="Border frame" k="frame" />
      </Section>

      <Section title="Aging">
        <AgingSlider />
      </Section>

      <Section title="Tool">
        <ToolOptions />
      </Section>

      <Section title="Inspector">
        <Inspector />
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

type NumericConfigKey =
  | 'detail'
  | 'seaLevel'
  | 'mountainDensity'
  | 'forestCoverage'
  | 'riverDensity'
  | 'temperatureBias'
  | 'moistureBias'
  | 'settlementCount'
  | 'roadDensity'
  | 'labelDensity';

const SHAPES: { value: WorldShape; label: string }[] = [
  { value: 'continent', label: 'Continent' },
  { value: 'pangaea', label: 'Pangaea' },
  { value: 'archipelago', label: 'Archipelago' },
  { value: 'islands', label: 'Scattered isles' },
  { value: 'coast', label: 'Coastal region' },
  { value: 'inland', label: 'Inland region' },
];
const STYLES: { value: NamingStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'harsh', label: 'Harsh' },
  { value: 'elvish', label: 'Elvish' },
];

function GenerateControls() {
  const shape = useAppStore((s) => s.config.shape);
  const namingStyle = useAppStore((s) => s.config.namingStyle);
  const setConfig = useAppStore((s) => s.setConfig);
  const regenerate = useAppStore((s) => s.regenerate);

  return (
    <div className="flex flex-col gap-2.5">
      <Dropdown label="World shape" value={shape} options={SHAPES} onChange={(v) => setConfig({ shape: v })} />
      <ConfigSlider label="Detail" k="detail" />
      <ConfigSlider label="Sea level" k="seaLevel" />
      <ConfigSlider label="Mountains" k="mountainDensity" />
      <ConfigSlider label="Forests" k="forestCoverage" />
      <ConfigSlider label="Rivers" k="riverDensity" />
      <ConfigSlider label="Temperature" k="temperatureBias" lo="icy" hi="tropical" />
      <ConfigSlider label="Moisture" k="moistureBias" lo="arid" hi="lush" />
      <ConfigSlider label="Settlements" k="settlementCount" />
      <ConfigSlider label="Roads" k="roadDensity" />
      <ConfigSlider label="Labels" k="labelDensity" />
      <Dropdown
        label="Naming"
        value={namingStyle}
        options={STYLES}
        onChange={(v) => setConfig({ namingStyle: v })}
      />

      <div className="flex flex-col gap-1 pt-1">
        <span className="text-[11px] uppercase tracking-wider text-ink-400">Re-roll just…</span>
        <div className="grid grid-cols-3 gap-1">
          <RegenButton label="Terrain" onClick={() => regenerate('terrain')} />
          <RegenButton label="Towns" onClick={() => regenerate('features')} />
          <RegenButton label="Names" onClick={() => regenerate('labels')} />
        </div>
      </div>
    </div>
  );
}

function ConfigSlider({ label, k, lo, hi }: { label: string; k: NumericConfigKey; lo?: string; hi?: string }) {
  const value = useAppStore((s) => s.config[k]);
  const setConfig = useAppStore((s) => s.setConfig);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-ink-300">
        <span>{label}</span>
        <span className="text-ink-400">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => setConfig({ [k]: Number(e.target.value) } as Partial<GenConfig>)}
        className="accent-brass-500"
      />
      {lo && hi && (
        <span className="flex justify-between text-[10px] text-ink-500">
          <span>{lo}</span>
          <span>{hi}</span>
        </span>
      )}
    </label>
  );
}

function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const numeric = typeof value === 'number';
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-300">{label}</span>
      <select
        value={String(value)}
        onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
        className="rounded border border-desk-700 bg-desk-850 px-2 py-1 text-xs text-ink-200 outline-none focus:border-brass-500"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RegenButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-desk-700 bg-desk-850 px-1.5 py-1 text-[11px] text-ink-200 transition-colors hover:border-brass-500 hover:text-ink-100"
    >
      {label}
    </button>
  );
}

function AgingSlider() {
  const aging = useAppStore((s) => s.aging);
  const setAging = useAppStore((s) => s.setAging);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-ink-300">
        <span>Wear</span>
        <span className="text-ink-400">{Math.round(aging * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={aging}
        onChange={(e) => setAging(Number(e.target.value))}
        className="accent-brass-500"
      />
    </label>
  );
}

type DecorKey = 'compass' | 'scaleBar' | 'creatures' | 'frame';

function DecorToggle({ name, k }: { name: string; k: DecorKey }) {
  const value = useAppStore((s) => s.decor[k]);
  const setDecor = useAppStore((s) => s.setDecor);
  return (
    <label className="flex cursor-pointer items-center justify-between rounded bg-desk-850 px-2 py-1.5">
      <span className="text-xs text-ink-200">{name}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => setDecor({ [k]: e.target.checked })}
        className="accent-brass-500"
      />
    </label>
  );
}

function LayerRow({ name, on, muted }: { name: string; on?: boolean; muted?: boolean }) {
  return (
    <div
      className={
        'flex items-center justify-between rounded px-2 py-1.5 ' +
        (muted ? 'opacity-45' : 'bg-desk-850')
      }
    >
      <span className="text-xs text-ink-200">{name}</span>
      <span
        className={
          'h-2 w-2 rounded-full ' + (on ? 'bg-brass-400' : 'bg-desk-500')
        }
        aria-hidden="true"
      />
    </div>
  );
}

// --- Tool options + Inspector (CLAUDE.md §9, §10) ---------------------------

const FEATURE_KINDS: { value: FeatureKind; label: string }[] = [
  { value: 'capital', label: 'Capital' },
  { value: 'city', label: 'City' },
  { value: 'town', label: 'Town' },
  { value: 'village', label: 'Village' },
  { value: 'tower', label: 'Tower' },
  { value: 'fortress', label: 'Fortress' },
  { value: 'ruin', label: 'Ruin' },
  { value: 'temple', label: 'Temple' },
];
const PAINT_BIOMES: { value: BiomeId; label: string }[] = [
  { value: Biome.plains, label: 'Plains' },
  { value: Biome.grassland, label: 'Grassland' },
  { value: Biome.forest, label: 'Forest' },
  { value: Biome.rainforest, label: 'Rainforest' },
  { value: Biome.taiga, label: 'Taiga' },
  { value: Biome.tundra, label: 'Tundra' },
  { value: Biome.snow, label: 'Snow' },
  { value: Biome.desert, label: 'Desert' },
  { value: Biome.savanna, label: 'Savanna' },
  { value: Biome.marsh, label: 'Marsh' },
  { value: Biome.hills, label: 'Hills' },
  { value: Biome.beach, label: 'Beach' },
];
const LABEL_ROLES: { value: NonNullable<Label['role']>; label: string }[] = [
  { value: 'region', label: 'Region' },
  { value: 'range', label: 'Range' },
  { value: 'water', label: 'Water' },
  { value: 'settlement', label: 'Settlement' },
];
const DECOR_KINDS: { value: 'compass' | 'shipDecor' | 'monsterDecor'; label: string }[] = [
  { value: 'compass', label: 'Compass rose' },
  { value: 'shipDecor', label: 'Ship' },
  { value: 'monsterDecor', label: 'Sea monster' },
];

function ToolOptions() {
  const tool = useAppStore((s) => s.activeTool);
  const placeKind = useAppStore((s) => s.placeKind);
  const brushBiome = useAppStore((s) => s.brushBiome);
  const brushSize = useAppStore((s) => s.brushSize);
  const labelRole = useAppStore((s) => s.labelRole);
  const decorKind = useAppStore((s) => s.decorKind);
  const st = useAppStore;

  switch (tool) {
    case 'select':
      return <Hint>Click a town or label to select; drag to move; Delete removes it.</Hint>;
    case 'coastline':
      return (
        <>
          <Hint>Drag to raise land; hold Shift to sink it back to sea.</Hint>
          <BrushSize value={brushSize} />
        </>
      );
    case 'road':
      return <Hint>Click one settlement, then another, to lay a road or trail between them.</Hint>;
    case 'river':
      return <Hint>Drag from source to mouth to draw a river. Click a river to delete it.</Hint>;
    case 'decoration':
      return (
        <>
          <Dropdown
            label="Place ornament"
            value={decorKind}
            options={DECOR_KINDS}
            onChange={(v) => st.getState().setDecorKind(v)}
          />
          <Hint>Click open sea to drop it; drag with Select to reposition.</Hint>
        </>
      );
    case 'feature':
      return (
        <Dropdown
          label="Place"
          value={placeKind}
          options={FEATURE_KINDS}
          onChange={(v) => st.getState().setPlaceKind(v)}
        />
      );
    case 'biome':
      return (
        <>
          <Dropdown label="Paint biome" value={brushBiome} options={PAINT_BIOMES} onChange={(v) => st.getState().setBrushBiome(v)} />
          <BrushSize value={brushSize} />
        </>
      );
    case 'mountain':
      return (
        <>
          <Hint>Paints mountains (raises the land).</Hint>
          <BrushSize value={brushSize} />
        </>
      );
    case 'forest':
      return (
        <>
          <Hint>Paints forest.</Hint>
          <BrushSize value={brushSize} />
        </>
      );
    case 'label':
      return (
        <Dropdown
          label="New label"
          value={labelRole}
          options={LABEL_ROLES}
          onChange={(v) => st.getState().setLabelRole(v)}
        />
      );
    default:
      return <Hint>This tool isn’t wired up yet — coming in a later pass.</Hint>;
  }
}

function BrushSize({ value }: { value: number }) {
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-ink-300">
        <span>Brush size</span>
        <span className="text-ink-400">{Math.round(value)}</span>
      </span>
      <input
        type="range"
        min={12}
        max={120}
        step={1}
        value={value}
        onChange={(e) => setBrushSize(Number(e.target.value))}
        className="accent-brass-500"
      />
    </label>
  );
}

function Inspector() {
  const selection = useAppStore((s) => s.selection);
  const world = useAppStore((s) => s.world);
  useAppStore((s) => s.worldRev); // re-read object fields after edits

  if (!selection || !world) {
    return <Hint>Nothing selected. Use Select (V) to pick a town or label.</Hint>;
  }
  if (selection.kind === 'feature') {
    const f = world.features.find((x) => x.id === selection.id);
    return f ? <FeatureInspector f={f} /> : <Hint>Nothing selected.</Hint>;
  }
  const l = world.labels.find((x) => x.id === selection.id);
  return l ? <LabelInspector l={l} /> : <Hint>Nothing selected.</Hint>;
}

function FeatureInspector({ f }: { f: Feature }) {
  const id = f.id;
  const patch = (p: Partial<Feature>) =>
    useAppStore.getState().applyEdit(
      ['features'],
      (w) => {
        const t = w.features.find((x) => x.id === id);
        if (t) Object.assign(t, p);
      },
      ['settlements', 'labels'],
    );
  const rankFor = (k: FeatureKind) => (k === 'capital' ? 4 : k === 'city' ? 3 : k === 'town' ? 2 : 1);
  return (
    <div className="flex flex-col gap-2.5">
      <TextField label="Name" value={f.name ?? ''} onCommit={(name) => patch({ name })} />
      <Dropdown
        label="Kind"
        value={f.kind}
        options={FEATURE_KINDS}
        onChange={(kind) => patch({ kind, rank: rankFor(kind) })}
      />
      <Check label="Port (harbour)" checked={!!f.port} onChange={(port) => patch({ port })} />
      <ObjectActions locked={!!f.locked} />
    </div>
  );
}

function LabelInspector({ l }: { l: Label }) {
  const id = l.id;
  const patch = (p: Partial<Label>) =>
    useAppStore.getState().applyEdit(
      ['labels'],
      (w) => {
        const t = w.labels.find((x) => x.id === id);
        if (t) Object.assign(t, p);
      },
      ['labels'],
    );
  return (
    <div className="flex flex-col gap-2.5">
      <TextField label="Text" value={l.text} onCommit={(text) => patch({ text })} />
      <Dropdown label="Role" value={l.role} options={LABEL_ROLES} onChange={(role) => patch({ role })} />
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs text-ink-300">
          <span>Rotation</span>
          <span className="text-ink-400">{Math.round(((l.rotation ?? 0) * 180) / Math.PI)}°</span>
        </span>
        <input
          type="range"
          min={-Math.PI / 2}
          max={Math.PI / 2}
          step={0.02}
          value={l.rotation ?? 0}
          onChange={(e) => patch({ rotation: Number(e.target.value) })}
          className="accent-brass-500"
        />
      </label>
      <ObjectActions locked={!!l.locked} />
    </div>
  );
}

function ObjectActions({ locked }: { locked: boolean }) {
  const toggleLock = useAppStore((s) => s.toggleLockSelected);
  const del = useAppStore((s) => s.deleteSelected);
  return (
    <div className="flex gap-1 pt-1">
      <button
        type="button"
        onClick={toggleLock}
        className={
          'flex-1 rounded border px-2 py-1 text-[11px] transition-colors ' +
          (locked
            ? 'border-brass-600 bg-desk-700 text-brass-300'
            : 'border-desk-700 bg-desk-850 text-ink-200 hover:border-brass-500')
        }
      >
        {locked ? 'Locked' : 'Lock'}
      </button>
      <button
        type="button"
        onClick={del}
        className="flex-1 rounded border border-desk-700 bg-desk-850 px-2 py-1 text-[11px] text-ink-200 transition-colors hover:border-red-500/60 hover:text-red-300"
      >
        Delete
      </button>
    </div>
  );
}

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink-300">{label}</span>
      <input
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        className="rounded border border-desk-700 bg-desk-850 px-2 py-1 text-xs text-ink-100 outline-none focus:border-brass-500"
      />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded bg-desk-850 px-2 py-1.5">
      <span className="text-xs text-ink-200">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-brass-500" />
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-500">{children}</p>;
}
