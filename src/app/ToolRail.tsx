/*
  Left tool rail (CLAUDE.md §9, §10). Icon buttons with tooltips + keyboard-shortcut
  hints. The tools are inert in Phase 0 — selecting one only sets `activeTool`; the
  behaviours land in the editing-tools phase.
*/
import { useAppStore, type ToolId } from '@/state/store';
import {
  SelectIcon,
  CoastlineIcon,
  BiomeIcon,
  MountainIcon,
  RiverIcon,
  RoadIcon,
  FeatureIcon,
} from './icons';
import type { ComponentType, SVGProps } from 'react';

interface ToolDef {
  id: ToolId;
  label: string;
  shortcut: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select / Move', shortcut: 'V', Icon: SelectIcon },
  { id: 'coastline', label: 'Coastline brush', shortcut: 'C', Icon: CoastlineIcon },
  { id: 'biome', label: 'Biome brush', shortcut: 'B', Icon: BiomeIcon },
  { id: 'mountain', label: 'Mountain stamp', shortcut: 'M', Icon: MountainIcon },
  { id: 'river', label: 'River tool', shortcut: 'R', Icon: RiverIcon },
  { id: 'road', label: 'Road tool', shortcut: 'D', Icon: RoadIcon },
  { id: 'feature', label: 'Place feature', shortcut: 'P', Icon: FeatureIcon },
];

export function ToolRail() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setActiveTool = useAppStore((s) => s.setActiveTool);

  return (
    <nav
      aria-label="Tools"
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-desk-700 bg-desk-900 py-2"
    >
      {TOOLS.map(({ id, label, shortcut, Icon }) => {
        const active = id === activeTool;
        return (
          <button
            key={id}
            type="button"
            title={`${label} (${shortcut})`}
            aria-label={label}
            aria-pressed={active}
            onClick={() => setActiveTool(id)}
            className={
              'grid h-9 w-9 place-items-center rounded-md border transition-colors ' +
              (active
                ? 'border-brass-600 bg-desk-700 text-brass-300'
                : 'border-transparent text-ink-300 hover:bg-desk-800 hover:text-ink-100')
            }
          >
            <Icon />
          </button>
        );
      })}
    </nav>
  );
}
