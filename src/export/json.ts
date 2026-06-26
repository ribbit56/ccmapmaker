/*
  World JSON serialisation / deserialisation (CLAUDE.md §11).

  Typed arrays can't round-trip through JSON as-is; we store them as base64 strings
  with a type tag so we can restore them exactly (no float precision loss). The grid's
  polygon array-of-typed-arrays gets the same treatment. Everything else is plain JSON.
*/

import type { World, VoronoiGrid, CellFields } from '@/model/world';
import { SCHEMA_VERSION } from '@/model/schema';
import { migrate } from './migrate';

// ---- typed-array ↔ base64 -------------------------------------------------

type TypedArrayTag = 'f32' | 'f64' | 'u8' | 'i16';

interface EncodedArray {
  __ta: TypedArrayTag;
  data: string;
}

function encodeTypedArray(arr: Float32Array | Float64Array | Uint8Array | Int16Array): EncodedArray {
  const tag: TypedArrayTag =
    arr instanceof Float32Array ? 'f32'
    : arr instanceof Float64Array ? 'f64'
    : arr instanceof Int16Array ? 'i16'
    : 'u8';
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return { __ta: tag, data: btoa(bin) };
}

function decodeTypedArray(enc: EncodedArray): Float32Array | Float64Array | Uint8Array | Int16Array {
  const bin = atob(enc.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const buf = bytes.buffer;
  switch (enc.__ta) {
    case 'f32': return new Float32Array(buf);
    case 'f64': return new Float64Array(buf);
    case 'i16': return new Int16Array(buf);
    default:    return new Uint8Array(buf);
  }
}

// ---- grid -----------------------------------------------------------------

interface SerialGrid {
  count: number;
  width: number;
  height: number;
  points: EncodedArray;
  neighbors: number[][];
  polygons: EncodedArray[];
}

function encodeGrid(g: VoronoiGrid): SerialGrid {
  return {
    count: g.count,
    width: g.width,
    height: g.height,
    points: encodeTypedArray(g.points),
    neighbors: g.neighbors,
    polygons: g.polygons.map(encodeTypedArray),
  };
}

function decodeGrid(s: SerialGrid): VoronoiGrid {
  return {
    count: s.count,
    width: s.width,
    height: s.height,
    points: decodeTypedArray(s.points) as Float64Array,
    neighbors: s.neighbors,
    polygons: s.polygons.map((p) => decodeTypedArray(p) as Float64Array),
  };
}

// ---- cell fields ----------------------------------------------------------

interface SerialCells {
  height: EncodedArray;
  moisture: EncodedArray;
  temperature: EncodedArray;
  isWater: EncodedArray;
  water: EncodedArray;
  oceanDist: EncodedArray;
  biome: EncodedArray;
  flux: EncodedArray;
}

function encodeCells(c: CellFields): SerialCells {
  return {
    height:      encodeTypedArray(c.height),
    moisture:    encodeTypedArray(c.moisture),
    temperature: encodeTypedArray(c.temperature),
    isWater:     encodeTypedArray(c.isWater),
    water:       encodeTypedArray(c.water),
    oceanDist:   encodeTypedArray(c.oceanDist),
    biome:       encodeTypedArray(c.biome),
    flux:        encodeTypedArray(c.flux),
  };
}

function decodeCells(s: SerialCells): CellFields {
  return {
    height:      decodeTypedArray(s.height) as Float32Array,
    moisture:    decodeTypedArray(s.moisture) as Float32Array,
    temperature: decodeTypedArray(s.temperature) as Float32Array,
    isWater:     decodeTypedArray(s.isWater) as Uint8Array,
    water:       decodeTypedArray(s.water) as Uint8Array,
    oceanDist:   decodeTypedArray(s.oceanDist) as Int16Array,
    biome:       decodeTypedArray(s.biome) as Uint8Array,
    flux:        decodeTypedArray(s.flux) as Float32Array,
  };
}

// ---- public API -----------------------------------------------------------

/** Serialise a World to a JSON string (for download or localStorage). */
export function worldToJson(world: World): string {
  const payload = {
    __schema: world.meta.schemaVersion,
    meta: world.meta,
    config: world.config,
    themeId: world.themeId,
    grid: encodeGrid(world.grid),
    cells: encodeCells(world.cells),
    rivers: world.rivers,
    lakes: world.lakes,
    roads: world.roads,
    features: world.features,
    labels: world.labels,
  };
  return JSON.stringify(payload);
}

/** Deserialise a JSON string back to a World, running migrations as needed. */
export function worldFromJson(json: string): World {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any = JSON.parse(json);
  const fileVersion: number = raw.__schema ?? 0;
  if (fileVersion < SCHEMA_VERSION) {
    raw = migrate(raw, fileVersion);
  }
  const grid = decodeGrid(raw.grid);
  return {
    meta: raw.meta,
    config: raw.config,
    themeId: raw.themeId ?? 'old-atlas',
    grid,
    cells: decodeCells(raw.cells),
    rivers: raw.rivers ?? [],
    lakes: raw.lakes ?? [],
    roads: raw.roads ?? [],
    features: raw.features ?? [],
    labels: raw.labels ?? [],
    geomRev: 0,
  };
}

/** Trigger a browser download of the world as a .world.json file. */
export function downloadWorld(world: World): void {
  const json = worldToJson(world);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${world.meta.name.replace(/\s+/g, '_')}.world.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Open a file picker and return the parsed World, or null on cancel. */
export async function importWorld(): Promise<World | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.world.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(worldFromJson(reader.result as string));
        } catch {
          alert('Could not load this file — it may be corrupt or from an incompatible version.');
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
