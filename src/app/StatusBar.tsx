/*
  Bottom status bar (CLAUDE.md §10): seed, cursor world-coords + biome under the
  cursor, cell count, and render time. Reads the live readouts the canvas writes to
  the store; the biome is resolved from the cursor position against the live world.
*/
import { useMemo } from 'react';
import { useAppStore } from '@/state/store';
import { Biome, type BiomeId, Water } from '@/model/world';
import { nearestCell } from '@/gen/grid';

/** Display names indexed by BiomeId (inverse of the Biome enum). */
const BIOME_NAMES: string[] = (() => {
  const names: string[] = [];
  for (const [name, id] of Object.entries(Biome)) names[id] = name;
  return names;
})();

export function StatusBar() {
  const seed = useAppStore((s) => s.seed);
  const cursor = useAppStore((s) => s.cursorWorld);
  const renderMs = useAppStore((s) => s.lastRenderMs);
  const cellCount = useAppStore((s) => s.cellCount);
  const world = useAppStore((s) => s.world);

  const biome = useMemo(() => {
    if (!cursor || !world) return null;
    const { cells } = world;
    const best = nearestCell(world.grid, cursor.x, cursor.y);
    if (best < 0) return null;
    if (cells.water[best] === Water.ocean) return 'ocean';
    if (cells.water[best] === Water.lake) return 'lake';
    return BIOME_NAMES[cells.biome[best] as BiomeId] ?? null;
  }, [cursor, world]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-desk-700 bg-desk-900 px-3 font-mono text-[11px] text-ink-400">
      <span>
        seed <span className="text-ink-200">{seed}</span>
      </span>
      <Sep />
      <span>{cursor ? `x ${cursor.x.toFixed(0)}  y ${cursor.y.toFixed(0)}` : 'x —  y —'}</span>
      <Sep />
      <span>biome {biome ? <span className="text-ink-200">{biome}</span> : '—'}</span>
      <Sep />
      <span>cells {cellCount ? cellCount.toLocaleString() : '—'}</span>
      <span className="ml-auto">render {renderMs.toFixed(1)} ms</span>
    </footer>
  );
}

function Sep() {
  return <span className="text-desk-500">|</span>;
}
