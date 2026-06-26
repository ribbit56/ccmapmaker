/*
  Top bar (CLAUDE.md §10): map name, seed + dice, theme picker, undo/redo, export,
  save, and the right-panel toggle.
*/
import { useState } from 'react';
import { useAppStore } from '@/state/store';
import { getCompositor } from './MapCanvas';
import { downloadWorld, importWorld } from '@/export/json';
import { saveNamed } from '@/export/storage';
import { ALL_THEMES } from '@/themes';
import {
  DiceIcon,
  UndoIcon,
  RedoIcon,
  ExportIcon,
  SaveIcon,
  PanelIcon,
  LockIcon,
  UnlockIcon,
} from './icons';

export function TopBar() {
  const mapName = useAppStore((s) => s.mapName);
  const setMapName = useAppStore((s) => s.setMapName);
  const seed = useAppStore((s) => s.seed);
  const setSeed = useAppStore((s) => s.setSeed);
  const reseed = useAppStore((s) => s.reseed);
  const lockSeed = useAppStore((s) => s.lockSeed);
  const toggleLockSeed = useAppStore((s) => s.toggleLockSeed);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const undoDepth = useAppStore((s) => s.undoDepth);
  const redoDepth = useAppStore((s) => s.redoDepth);
  const themeId = useAppStore((s) => s.themeId);
  const setThemeId = useAppStore((s) => s.setThemeId);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const world = useAppStore((s) => s.world);

  // Tiny micro-interaction (CLAUDE.md §14): the dice tumbles when you roll.
  const [rolling, setRolling] = useState(false);
  const handleReseed = () => {
    reseed();
    setRolling(true);
  };

  const handleExportPng = async (scale: 1 | 2 | 4 = 2) => {
    const comp = getCompositor();
    if (!comp) return;
    const blob = await comp.exportPng(scale);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(world?.meta.name ?? 'map').replace(/\s+/g, '_')}_${scale}x.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleSaveJson = () => {
    if (world) downloadWorld(world);
  };

  const handleLoadJson = async () => {
    const loaded = await importWorld();
    if (loaded) useAppStore.getState().setWorld(loaded);
  };

  const handleNamedSave = () => {
    if (world) saveNamed(world);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-desk-700 bg-desk-900 px-3">
      <div className="flex items-center gap-2 pr-1">
        <CompassMark />
        <input
          aria-label="Map name"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          className="w-44 rounded bg-transparent px-1.5 py-1 text-sm font-medium text-ink-100 outline-none hover:bg-desk-800 focus:bg-desk-800"
        />
      </div>

      <div className="h-6 w-px bg-desk-700" />

      <label className="flex items-center gap-2" title="World seed">
        <span className="text-[11px] uppercase tracking-wider text-ink-400">Seed</span>
        <input
          aria-label="World seed"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          className="w-40 rounded border border-desk-700 bg-desk-850 px-2 py-1 font-mono text-xs text-ink-200 outline-none focus:border-brass-500"
        />
      </label>
      <IconButton label="Roll a new seed" onClick={handleReseed} disabled={lockSeed}>
        <span
          className={rolling ? 'inline-block motion-safe:animate-[dice-roll_0.5s_ease-out]' : 'inline-block'}
          onAnimationEnd={() => setRolling(false)}
        >
          <DiceIcon />
        </span>
      </IconButton>
      <IconButton
        label={lockSeed ? 'Seed locked — click to unlock' : 'Lock seed'}
        onClick={toggleLockSeed}
      >
        <span className={lockSeed ? 'text-brass-400' : undefined}>
          {lockSeed ? <LockIcon /> : <UnlockIcon />}
        </span>
      </IconButton>

      <div className="h-6 w-px bg-desk-700" />

      <label className="flex items-center gap-2" title="Theme">
        <span className="text-[11px] uppercase tracking-wider text-ink-400">Theme</span>
        <select
          aria-label="Theme"
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          className="rounded border border-desk-700 bg-desk-850 px-2 py-1 text-xs text-ink-200 outline-none focus:border-brass-500"
        >
          {ALL_THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={undoDepth === 0}>
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={redoDepth === 0}>
          <RedoIcon />
        </IconButton>
        <div className="mx-1 h-6 w-px bg-desk-700" />
        <ExportMenu onExport={handleExportPng} disabled={!world} />
        <SaveMenu onSaveJson={handleSaveJson} onLoadJson={handleLoadJson} onNamedSave={handleNamedSave} disabled={!world} />
        <div className="mx-1 h-6 w-px bg-desk-700" />
        <IconButton label="Toggle panel" onClick={toggleRightPanel}>
          <PanelIcon />
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded text-ink-300 transition-colors hover:bg-desk-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function ExportMenu({ onExport, disabled }: { onExport: (s: 1 | 2 | 4) => void; disabled?: boolean }) {
  return (
    <div className="relative group">
      <IconButton label="Export PNG" disabled={disabled}>
        <ExportIcon />
      </IconButton>
      <div className="absolute right-0 top-full z-50 hidden group-hover:flex flex-col gap-px mt-0.5 rounded border border-desk-700 bg-desk-900 py-1 shadow-lg min-w-[110px]">
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onExport(s)}
            className="px-3 py-1.5 text-left text-xs text-ink-200 hover:bg-desk-700"
          >
            Export {s}× PNG
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveMenu({
  onSaveJson,
  onLoadJson,
  onNamedSave,
  disabled,
}: {
  onSaveJson: () => void;
  onLoadJson: () => void;
  onNamedSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative group">
      <IconButton label="Save / Load" disabled={disabled}>
        <SaveIcon />
      </IconButton>
      <div className="absolute right-0 top-full z-50 hidden group-hover:flex flex-col gap-px mt-0.5 rounded border border-desk-700 bg-desk-900 py-1 shadow-lg min-w-[140px]">
        <button type="button" onClick={onSaveJson} className="px-3 py-1.5 text-left text-xs text-ink-200 hover:bg-desk-700">
          Download .world.json
        </button>
        <button type="button" onClick={onLoadJson} className="px-3 py-1.5 text-left text-xs text-ink-200 hover:bg-desk-700">
          Open .world.json…
        </button>
        <div className="my-0.5 mx-2 h-px bg-desk-700" />
        <button type="button" onClick={onNamedSave} className="px-3 py-1.5 text-left text-xs text-ink-200 hover:bg-desk-700">
          Quick save
        </button>
      </div>
    </div>
  );
}

/** A tiny brass compass mark — the app's wordless logo. */
function CompassMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="var(--color-brass-500)" strokeWidth="1.4" />
      <path d="M12 4l2 8-2 8-2-8z" fill="var(--color-brass-400)" />
      <path d="M4 12l8-2 8 2-8 2z" fill="var(--color-brass-600)" />
    </svg>
  );
}
