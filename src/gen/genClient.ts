/*
  Main-thread client for the generation worker (CLAUDE.md §3, §14 Phase 12).

  Owns a single long-lived worker and a Comlink proxy to it. The three calls mirror
  the synchronous pipeline (`generateWorld` / `regenerateFeatures` / `regenerateLabels`)
  but return promises — the work happens off-thread. Falls back to running the pipeline
  inline if Worker construction fails (e.g. an exotic environment), so the app still
  works without a worker.

  Partial re-rolls send the current world by clone (Comlink's default), so the caller's
  live world stays intact until the freshly mutated copy returns.
*/

import * as Comlink from 'comlink';
import type { GenApi } from './worker';
import type { GenerateOptions } from './generate';
import type { World } from '@/model/world';

let proxy: Comlink.Remote<GenApi> | null = null;
let worker: Worker | null = null;

function getProxy(): Comlink.Remote<GenApi> | null {
  if (proxy) return proxy;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    proxy = Comlink.wrap<GenApi>(worker);
    return proxy;
  } catch {
    return null; // fall back to inline generation below
  }
}

export async function generate(opts: GenerateOptions): Promise<World> {
  const p = getProxy();
  if (!p) {
    const { generateWorld } = await import('./generate');
    return generateWorld(opts);
  }
  return p.generate(opts);
}

export async function rerollFeatures(world: World, featureSeed: string): Promise<World> {
  const p = getProxy();
  if (!p) {
    const { regenerateFeatures } = await import('./generate');
    return regenerateFeatures(world, featureSeed);
  }
  return p.rerollFeatures(world, featureSeed);
}

export async function rerollLabels(world: World, labelSeed: string): Promise<World> {
  const p = getProxy();
  if (!p) {
    const { regenerateLabels } = await import('./generate');
    return regenerateLabels(world, labelSeed);
  }
  return p.rerollLabels(world, labelSeed);
}

/** Tear down the worker (HMR / unmount). */
export function disposeGenClient(): void {
  worker?.terminate();
  worker = null;
  proxy = null;
}
