/*
  Undo/redo snapshots (CLAUDE.md §10 — "snapshot the relevant slice of the data
  model"). Each snapshot captures deep copies of only the World slices a command
  touches, so an object move copies the small features/labels arrays while a brush
  copies the cell fields — never the whole world.
*/

import type { World, Feature, Label, River, Road } from '@/model/world';

export type EditField =
  | 'features'
  | 'labels'
  | 'rivers'
  | 'roads'
  | 'biome'
  | 'height'
  | 'water'
  | 'isWater'
  | 'oceanDist';

export interface Snapshot {
  fields: EditField[];
  features?: Feature[];
  labels?: Label[];
  rivers?: River[];
  roads?: Road[];
  biome?: Uint8Array;
  height?: Float32Array;
  water?: Uint8Array;
  isWater?: Uint8Array;
  oceanDist?: Int16Array;
}

const cloneFeature = (f: Feature): Feature => ({ ...f });
const cloneLabel = (l: Label): Label => ({
  ...l,
  curve: l.curve ? l.curve.map((p) => [p[0], p[1]] as [number, number]) : undefined,
});
const cloneRiver = (r: River): River => ({
  ...r,
  points: r.points.map((p) => [p[0], p[1]] as [number, number]),
  widthByPoint: r.widthByPoint.slice(),
});
const cloneRoad = (r: Road): Road => ({
  ...r,
  points: r.points.map((p) => [p[0], p[1]] as [number, number]),
});

/** Copy the given slices out of the world. */
export function capture(world: World, fields: EditField[]): Snapshot {
  const snap: Snapshot = { fields };
  if (fields.includes('features')) snap.features = world.features.map(cloneFeature);
  if (fields.includes('labels')) snap.labels = world.labels.map(cloneLabel);
  if (fields.includes('rivers')) snap.rivers = world.rivers.map(cloneRiver);
  if (fields.includes('roads')) snap.roads = world.roads.map(cloneRoad);
  if (fields.includes('biome')) snap.biome = world.cells.biome.slice();
  if (fields.includes('height')) snap.height = world.cells.height.slice();
  if (fields.includes('water')) snap.water = world.cells.water.slice();
  if (fields.includes('isWater')) snap.isWater = world.cells.isWater.slice();
  if (fields.includes('oceanDist')) snap.oceanDist = world.cells.oceanDist.slice();
  return snap;
}

/** Restore a snapshot's slices into the world (in place). */
export function apply(world: World, snap: Snapshot): void {
  if (snap.features) world.features = snap.features.map(cloneFeature);
  if (snap.labels) world.labels = snap.labels.map(cloneLabel);
  if (snap.rivers) world.rivers = snap.rivers.map(cloneRiver);
  if (snap.roads) world.roads = snap.roads.map(cloneRoad);
  if (snap.biome) world.cells.biome.set(snap.biome);
  if (snap.height) world.cells.height.set(snap.height);
  if (snap.water) world.cells.water.set(snap.water);
  if (snap.isWater) world.cells.isWater.set(snap.isWater);
  if (snap.oceanDist) world.cells.oceanDist.set(snap.oceanDist);
}
