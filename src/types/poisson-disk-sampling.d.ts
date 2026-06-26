/*
  Minimal type declaration for poisson-disk-sampling (ships without types). Only the
  surface we use (CLAUDE.md §5 step 1).
*/
declare module 'poisson-disk-sampling' {
  export interface PoissonOptions {
    shape: number[];
    minDistance: number;
    maxDistance?: number;
    tries?: number;
    distanceFunction?: (point: number[]) => number;
    bias?: number;
  }

  export default class PoissonDiskSampling {
    constructor(options: PoissonOptions, rng?: () => number);
    fill(): number[][];
    getAllPoints(): number[][];
    addPoint(point: number[]): number[] | null;
    next(): number[] | null;
    reset(): void;
  }
}
