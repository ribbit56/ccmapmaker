/*
  Settlements layer (CLAUDE.md §6 step 9). Illustrated icons sized by rank, each with
  a faint cast shadow so it sits on the map and a small harbour anchor for ports.
  Icons are depth-sorted (south over north). Names are drawn by the labels layer
  (Phase 7) so collision avoidance can manage all text together.
*/

import { drawSettlement, drawHarbour, type SettlementColors } from '@/glyphs/settlements';
import { hexToRgb, rgbStr, rgbaStr, shade } from '@/lib/color';
import type { FeatureKind } from '@/model/world';
import type { LayerContext } from '../layer';

/** Icon size per feature kind; shared with the labels layer for name placement. */
export const SETTLEMENT_SIZE: Partial<Record<FeatureKind, number>> = {
  capital: 24,
  city: 19,
  town: 15,
  village: 12,
  tower: 17,
  fortress: 20,
  ruin: 15,
  temple: 17,
};

export function drawSettlements(ctx: CanvasRenderingContext2D, lc: LayerContext): void {
  const { world } = lc;
  if (!world || world.features.length === 0) return;
  const g = lc.theme.glyph;

  const colors: SettlementColors = {
    ink: g.ink,
    fill: g.light,
    roof: g.shade,
    accent: rgbStr(shade(hexToRgb(g.shade), -0.12)),
  };
  const shadow = rgbaStr(hexToRgb(g.ink), 0.16);

  // Depth order: southern (lower) icons draw over northern ones.
  const items = world.features
    .filter((f) => SETTLEMENT_SIZE[f.kind] !== undefined)
    .slice()
    .sort((a, b) => a.y - b.y);

  for (const f of items) {
    const size = SETTLEMENT_SIZE[f.kind]!;
    const baseY = f.y;

    // Cast shadow.
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(f.x, baseY, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    drawSettlement(ctx, f.kind, f.x, baseY, size, colors);
    if (f.port) drawHarbour(ctx, f.x - size * 0.85, baseY - size * 0.2, size * 0.32, colors);
  }
}
