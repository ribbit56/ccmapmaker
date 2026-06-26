/*
  The hover lore card (CLAUDE.md §1) — a small quiet card that surfaces a place's
  invented history when the cursor rests on it. Deliberately styled in the dark
  "drafting desk" chrome idiom (CLAUDE.md §2), NOT the parchment of the map, so the
  two aesthetics stay separate and the map remains the hero. Read-only and
  pointer-events-none, so it never intercepts clicks or drags.

  Anchored to the object's screen position (computed by MapCanvas from the camera);
  `placeLeft`/`placeAbove` flip it away from the nearest viewport edge so it can't
  spill off-canvas.
*/

export interface HoverLore {
  /** Object's anchor in canvas/CSS pixels. */
  sx: number;
  sy: number;
  placeLeft: boolean;
  placeAbove: boolean;
  title: string;
  /** Small caps line — settlement kind or label role. */
  sub: string;
  epithet?: string;
  text: string;
}

const GAP = 14; // px between the anchor point and the card

export function LoreCard({ hover }: { hover: HoverLore }) {
  const tx = hover.placeLeft ? `calc(-100% - ${GAP}px)` : `${GAP}px`;
  const ty = hover.placeAbove ? `calc(-100% - ${GAP}px)` : `${GAP}px`;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-[clamp(180px,60vw,260px)] rounded-md border border-desk-700 bg-desk-900/95 p-3 shadow-xl shadow-black/40 backdrop-blur-[1px]"
      style={{ left: hover.sx, top: hover.sy, transform: `translate(${tx}, ${ty})` }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {hover.sub}
      </div>
      <div className="mt-0.5 text-sm font-semibold leading-tight text-ink-100">{hover.title}</div>
      {hover.epithet && (
        <div className="text-xs italic leading-snug text-brass-300">{hover.epithet}</div>
      )}
      <p className="mt-1.5 text-xs leading-relaxed text-ink-300">{hover.text}</p>
    </div>
  );
}
