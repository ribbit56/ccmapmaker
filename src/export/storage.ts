/*
  localStorage persistence (CLAUDE.md §11): autosave + named saves.

  Keys:
    cartographer:autosave        — latest world (written on every worldRev change, debounced)
    cartographer:saves           — JSON array of SaveEntry (index of named saves)
    cartographer:save:<id>       — individual named save payload
*/

import { worldToJson, worldFromJson } from './json';
import type { World } from '@/model/world';

const NS = 'cartographer';
const KEY_AUTOSAVE = `${NS}:autosave`;
const KEY_INDEX = `${NS}:saves`;

export interface SaveEntry {
  id: string;
  name: string;
  seed: string;
  savedAt: string;
}

function saveKey(id: string): string {
  return `${NS}:save:${id}`;
}

function readIndex(): SaveEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_INDEX) ?? '[]') as SaveEntry[];
  } catch {
    return [];
  }
}

function writeIndex(entries: SaveEntry[]): void {
  localStorage.setItem(KEY_INDEX, JSON.stringify(entries));
}

// ---- autosave -------------------------------------------------------------

export function autosave(world: World): void {
  try {
    localStorage.setItem(KEY_AUTOSAVE, worldToJson(world));
  } catch {
    // Storage quota exceeded — silently ignore.
  }
}

export function loadAutosave(): World | null {
  const raw = localStorage.getItem(KEY_AUTOSAVE);
  if (!raw) return null;
  try {
    return worldFromJson(raw);
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(KEY_AUTOSAVE);
}

// ---- named saves ----------------------------------------------------------

export function saveNamed(world: World, name?: string): SaveEntry {
  const id = `${Date.now().toString(36)}`;
  const entry: SaveEntry = {
    id,
    name: name ?? world.meta.name,
    seed: world.meta.seed,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(saveKey(id), worldToJson(world));
    const entries = readIndex();
    entries.unshift(entry);
    // Cap at 20 named saves to avoid quota issues.
    const trimmed = entries.slice(0, 20);
    if (entries.length > 20) {
      entries.slice(20).forEach((e) => localStorage.removeItem(saveKey(e.id)));
    }
    writeIndex(trimmed);
  } catch {
    // Quota — skip silently.
  }
  return entry;
}

export function loadNamed(id: string): World | null {
  const raw = localStorage.getItem(saveKey(id));
  if (!raw) return null;
  try {
    return worldFromJson(raw);
  } catch {
    return null;
  }
}

export function deleteSave(id: string): void {
  localStorage.removeItem(saveKey(id));
  writeIndex(readIndex().filter((e) => e.id !== id));
}

export function listSaves(): SaveEntry[] {
  return readIndex();
}
