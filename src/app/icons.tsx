/*
  Minimal inline line-icons for the editor chrome. Kept local (no icon dependency,
  CLAUDE.md §3 "keep dependencies lean"). All stroke `currentColor`, 24×24.
*/
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SelectIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3l6 16 2-6 6-2z" />
  </Svg>
);
export const CoastlineIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
  </Svg>
);
export const BiomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3c4 5 5 8 5 11a5 5 0 01-10 0c0-3 1-6 5-11z" />
  </Svg>
);
export const MountainIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 19l6-11 4 6 2-3 6 8z" />
  </Svg>
);
export const ForestIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l5 8h-3l3 5H7l3-5H7z" />
    <path d="M12 16v5" />
  </Svg>
);
export const RiverIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3c0 4 8 5 8 9s-6 5-6 9" />
  </Svg>
);
export const RoadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 21L11 3" />
    <path d="M16 21L13 3" />
    <path d="M12 7v2M12 12v2M12 17v2" />
  </Svg>
);
export const FeatureIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
);
export const LabelIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 7V5h14v2" />
    <path d="M12 5v14M9 19h6" />
  </Svg>
);
export const DecorationIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
  </Svg>
);

export const DiceIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);
export const UndoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 010 10h-1" />
  </Svg>
);
export const RedoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 7l5 5-5 5" />
    <path d="M20 12H9a5 5 0 000 10h1" />
  </Svg>
);
export const ExportIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="M8 11l4 4 4-4" />
    <path d="M5 21h14" />
  </Svg>
);
export const SaveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v5h7V3" />
    <rect x="8" y="13" width="8" height="5" />
  </Svg>
);
export const LockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Svg>
);
export const UnlockIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 017-2.6" />
  </Svg>
);
export const PanelIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16" />
  </Svg>
);
