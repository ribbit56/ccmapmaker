/*
  Schema version + migration shim (CLAUDE.md §4, §11) so old `.world.json` saves
  keep loading. Placeholder until persistence (Phase 11).
*/
// v2: added optional `lore` to Feature/Label (CLAUDE.md §1). Additive — pre-v2 saves
// load unchanged (the field is simply absent), so no migration transform is needed.
export const SCHEMA_VERSION = 2;
