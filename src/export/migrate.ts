/*
  Schema migration shim (CLAUDE.md §11). Each version bump gets one entry.
  Runs when loading a .world.json whose __schema < current SCHEMA_VERSION.
  Keep old migrations forever — someone may load an ancient save.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any, fromVersion: number): any {
  // Version 0 → 1: geomRev field added (just ignore it on load; worldFromJson
  // always inits it to 0). No structural change needed.
  if (fromVersion < 1) {
    raw.__schema = 1;
  }
  return raw;
}
