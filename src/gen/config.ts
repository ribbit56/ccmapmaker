/*
  Generation knobs (CLAUDE.md §7). The full set is defined now so the data model is
  stable; Phase 1 only reads `shape`, `detail`, `seaLevel`, and `mountainDensity`.
  The Generate panel (Phase 9) will edit these — for now they use tasteful defaults.
*/

export type WorldShape = 'continent' | 'archipelago' | 'pangaea' | 'islands' | 'coast' | 'inland';
export type NamingStyle = 'classic' | 'harsh' | 'elvish';

export interface GenConfig {
  shape: WorldShape;
  /** 0..1 — cell count / fidelity. Maps to a Poisson minimum spacing. */
  detail: number;
  /** 0..1 — height below which a cell is water. */
  seaLevel: number;
  mountainDensity: number;
  forestCoverage: number;
  riverDensity: number;
  /** 0 = icy … 1 = tropical. */
  temperatureBias: number;
  /** 0 = arid … 1 = lush. */
  moistureBias: number;
  settlementCount: number;
  roadDensity: number;
  labelDensity: number;
  namingStyle: NamingStyle;
}

export const DEFAULT_CONFIG: GenConfig = {
  shape: 'continent',
  detail: 0.5,
  seaLevel: 0.38,
  mountainDensity: 0.5,
  forestCoverage: 0.5,
  riverDensity: 0.5,
  temperatureBias: 0.5,
  moistureBias: 0.5,
  settlementCount: 0.5,
  roadDensity: 0.5,
  labelDensity: 0.5,
  namingStyle: 'classic',
};
