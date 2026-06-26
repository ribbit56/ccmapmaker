/*
  Lore generation (CLAUDE.md §1 — the marginalia of a fantasy-hardback map).

  Gives every named place a scrap of invented history: an epithet plus 1–3 sentences
  woven from what the world already knows about it — its kind and rank, the biome it
  sits in, whether it's coastal or river-mouthed, and the region that surrounds it.

  Deterministic like everything else (CLAUDE.md §13): each entry's lore is built from
  a sub-stream seeded by the world seed + the entry id, so the same world always reads
  the same way, and one entry can be re-rolled without disturbing its neighbours. An
  entry whose `lore.edited` flag is set has been hand-written and is left untouched.
*/

import { makeRng, type Rng } from '../rng';
import { nearestCell } from '../grid';
import {
  Biome,
  type BiomeId,
  type Feature,
  type FeatureKind,
  type Label,
  type Lore,
  type World,
} from '@/model/world';

// Which features earn lore — settlements and standalone landmarks, not decorations
// or the bare mountain-peak markers.
const LORE_KINDS = new Set<FeatureKind>([
  'capital', 'city', 'town', 'village', 'fortress', 'ruin', 'temple', 'tower', 'port',
]);

// --- Climate / terrain flavour ---------------------------------------------

/** A loose terrain family used to flavour location phrases. */
type Terrain = 'forest' | 'plains' | 'desert' | 'cold' | 'marsh' | 'hills' | 'mountain' | 'coast';

function terrainOf(b: BiomeId): Terrain {
  switch (b) {
    case Biome.forest:
    case Biome.rainforest:
    case Biome.taiga:
      return 'forest';
    case Biome.desert:
      return 'desert';
    case Biome.tundra:
    case Biome.snow:
    case Biome.glacier:
      return 'cold';
    case Biome.marsh:
      return 'marsh';
    case Biome.hills:
      return 'hills';
    case Biome.mountain:
      return 'mountain';
    case Biome.beach:
      return 'coast';
    default:
      return 'plains';
  }
}

// "set {phrase}" — a clause placing the settlement in its landscape.
const TERRAIN_SETTING: Record<Terrain, string[]> = {
  forest: ['among the old pinewoods', 'beneath a canopy of ancient oaks', 'in a clearing of the deep forest', 'where the woods grow close and dark'],
  plains: ['on the open grasslands', 'amid wide windswept fields', 'on the rolling downs', 'where the long grass runs to the horizon'],
  desert: ['at the edge of the burning sands', 'around a stubborn desert spring', 'where the dunes give way to stone', 'on the bleached desert flats'],
  cold: ['on the frozen steppe', 'in the shadow of the great ice', 'where the snow seldom melts', 'on the windward side of the tundra'],
  marsh: ['on the salt marshes', 'among the reed-beds and black water', 'where the ground is never quite dry', 'on stilts above the fen'],
  hills: ['among the green hills', 'on a high terraced slope', 'in a fold of the highlands', 'where the hills break into dales'],
  mountain: ['in a high mountain pass', 'beneath the grey peaks', 'on a ledge above the cloud line', 'where the road climbs to the summit'],
  coast: ['on a sheltered stretch of coast', 'above a shingle strand', 'where cliffs meet the tide', 'on the windward shore'],
};

// Noun phrases naming the terrain itself — for "a wild country of {X}" region prose.
// (Distinct from TERRAIN_SETTING, which are locative clauses for settlements.)
const TERRAIN_NOUN: Record<Terrain, string[]> = {
  forest: ['deep forest', 'ancient woodland', 'tangled wildwood', 'dark pine and shadow'],
  plains: ['open grassland', 'windswept fields', 'rolling downs', 'wide grazing country'],
  desert: ['burning sand', 'bone-dry waste', 'dune and stone', 'scrubland and salt-flat'],
  cold: ['frozen steppe', 'snow and black rock', 'tundra and ice', 'the long white silence'],
  marsh: ['reed and black water', 'trackless fen', 'salt marsh', 'bog and slow river'],
  hills: ['green hills', 'terraced highland', 'fold upon fold of upland', 'dale and ridge'],
  mountain: ['grey peaks', 'crag and high pass', 'stone and snow', 'the roof of the world'],
  coast: ['cliff and tideline', 'salt-worn shore', 'cove and headland', 'wind and breaking sea'],
};

// Biome-flavoured traits its people / place are known for.
const TERRAIN_TRAIT: Record<Terrain, string[]> = {
  forest: ['its woodcarvers and charcoal-burners', 'a guild of master fletchers', 'honey-mead pressed from forest blossom', 'green-cloaked rangers who answer to no lord'],
  plains: ['its horse-fairs and cattle-drives', 'fields of barley that feed three counties', 'long-riders who carry word between the holds', 'a famous autumn harvest-feast'],
  desert: ['caravan-masters who know every hidden well', 'glasswork fired in the dune-kilns', 'a market that never fully closes', 'star-readers and keepers of old maps'],
  cold: ['furs traded as far as the southern courts', 'ice-fishers and seal-hunters', 'a hardy people slow to trust and slower to forget', 'mead-halls lit against the long dark'],
  marsh: ['eel-catchers and reed-cutters', 'physicians who prize its bog-herbs', 'a people half-rumoured to be webbed of foot', 'lanterns that float the channels at dusk'],
  hills: ['terraced vineyards and hill-pasture', 'stone masons of uncommon skill', 'a flock of bells that can be heard for miles', 'shepherds who sing the old counting-songs'],
  mountain: ['miners who follow the silver veins', 'forge-smiths whose work never rusts', 'a pass that armies have died to hold', 'goat-herds and the keepers of the high road'],
  coast: ['its fishing fleet and net-menders', 'shipwrights and salt-boilers', 'pearl-divers working the cold shallows', 'a lighthouse older than the town itself'],
};

// --- Eras and events (history flavour) -------------------------------------

const ERAS = [
  'the Age of Ash', 'the Last Reckoning', 'the years before the Sundering', 'the Old Kingdom',
  'the Long Winter', 'the Reign of the Twin Kings', 'the time of the first ships', 'the Green Age',
  'the War of the Three Banners', 'an age now half-forgotten',
];

const FOUNDING_EVENTS = [
  'grew rich on the trade that passed its gates',
  'was raised by exiles who would answer to no crown',
  'rose around a shrine that drew pilgrims from afar',
  'was a waystation that simply refused to die',
  'changed hands so often its walls bear a dozen crests',
  'was founded on a vow that its people still keep',
  'minted its own coin and answered to its own council',
  'endured a famous siege and was never taken again',
];

const RUIN_CAUSES = [
  'a plague that left the streets to the crows',
  'a fire no one could explain',
  'the war that emptied half the coast',
  'a flood the sea-walls could not hold',
  'a curse the chroniclers refuse to name',
  'the slow death of the trade that fed it',
  'a winter so hard the wells froze solid',
];

const RUMOURS = [
  'a bell that rings with no hand to ring it',
  'lights seen moving where no one should walk',
  'a road that is longer leaving than coming',
  'a debt the town has never quite repaid',
  'treasure walled up against a return that never came',
  'a stranger who is always seen but never met',
];

// --- Sentence assembly -----------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Size word from settlement rank (4 = capital … 1 = village). */
function sizeWord(rank: number | undefined): string {
  switch (rank) {
    case 4: return 'great';
    case 3: return 'prosperous';
    case 2: return 'modest';
    default: return 'small';
  }
}

function kindNoun(f: Feature): string {
  switch (f.kind) {
    case 'capital': return 'city';
    case 'city': return 'city';
    case 'town': return f.port ? 'harbour town' : 'town';
    case 'village': return f.port ? 'fishing village' : 'village';
    case 'port': return 'port';
    case 'fortress': return 'fortress';
    case 'ruin': return 'ruin';
    case 'temple': return 'temple';
    case 'tower': return 'watchtower';
    default: return 'place';
  }
}

/** Is any river point within `dist` of (x, y)? (Cheap proximity scan.) */
function nearRiver(world: World, x: number, y: number, dist = 28): boolean {
  const d2 = dist * dist;
  for (const r of world.rivers) {
    for (const [px, py] of r.points) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy < d2) return true;
    }
  }
  return false;
}

/** Name of the nearest region label, if one is reasonably close. */
function nearestRegionName(world: World, x: number, y: number, max = 380): string | null {
  let best: string | null = null;
  let bestD = max * max;
  for (const l of world.labels) {
    if (l.role !== 'region') continue;
    const dx = l.x - x;
    const dy = l.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = l.text;
    }
  }
  return best;
}

/** Name of the nearest sea/ocean water label, if close. */
function nearestSeaName(world: World, x: number, y: number, max = 420): string | null {
  let best: string | null = null;
  let bestD = max * max;
  for (const l of world.labels) {
    if (l.role !== 'water') continue;
    const dx = l.x - x;
    const dy = l.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = l.text;
    }
  }
  return best;
}

/** Build the location clause: coast/river phrasing wins over bare terrain. */
function settingClause(world: World, f: Feature, terrain: Terrain, rng: Rng): string {
  const region = nearestRegionName(world, f.x, f.y);
  if (f.port || terrain === 'coast') {
    const sea = nearestSeaName(world, f.x, f.y);
    if (sea && rng.bool(0.6)) return `on the shores of ${sea}`;
    return rng.pick(['on a sheltered harbour', 'above a busy quay', 'where the river meets the sea', 'on the windward coast']);
  }
  if (nearRiver(world, f.x, f.y) && rng.bool(0.7)) {
    return rng.pick(['at a crossing of the river', 'where two rivers meet', 'on the green river-banks', 'astride an old ford']);
  }
  const base = rng.pick(TERRAIN_SETTING[terrain]);
  return region && rng.bool(0.5) ? `${base} of ${region}` : base;
}

/** Lore for a single feature, from the given (already entry-specific) stream. */
export function loreForFeature(world: World, f: Feature, rng: Rng): Lore {
  const ci = nearestCell(world.grid, f.x, f.y);
  const terrain = terrainOf(world.cells.biome[ci] as BiomeId);
  const name = f.name ?? 'This place';

  if (f.kind === 'ruin') {
    const epithet = rng.pick(['the Fallen', 'the Hollow Halls', 'what the years left', 'the Silent Stones', 'the Abandoned']);
    const opening = `${name} is a ruin ${settingClause(world, f, terrain, rng)}.`;
    const fall = `Once a ${rng.pick(['proud keep', 'thriving town', 'holy house', 'wealthy port'])}, it was undone in ${rng.pick(ERAS)} by ${rng.pick(RUIN_CAUSES)}.`;
    const close = rng.bool(0.7) ? ` Travellers still speak of ${rng.pick(RUMOURS)}.` : '';
    return { epithet, text: `${opening} ${fall}${close}` };
  }

  if (f.kind === 'tower') {
    const epithet = rng.pick(['the Lonely Spire', 'the Grey Watch', 'the Far Eye', 'the Last Lamp']);
    const opening = `${name} stands ${settingClause(world, f, terrain, rng)}, a watchtower raised in ${rng.pick(ERAS)}.`;
    const purpose = rng.pick([
      'It was built to guard the road below, and its beacon has not gone dark since.',
      'From its top a rider can be seen a full day off.',
      'Its keeper trades letters and lamp-oil with all who pass.',
      'It has changed hands in war but never fallen by storm.',
    ]);
    return { epithet, text: `${opening} ${purpose}` };
  }

  if (f.kind === 'temple') {
    const epithet = rng.pick(['the Quiet Sanctum', 'Seat of the Old Faith', 'the Hallowed', 'the Pilgrim’s Rest']);
    const opening = `${name} is a temple ${settingClause(world, f, terrain, rng)}, founded in ${rng.pick(ERAS)}.`;
    const faith = rng.pick([
      'Pilgrims come a long way to keep its feast.',
      'Its bells are said to turn back ill weather.',
      'The order that tends it has outlasted three kingdoms.',
      'Its library holds books found nowhere else.',
    ]);
    return { epithet, text: `${opening} ${faith}` };
  }

  if (f.kind === 'fortress') {
    const epithet = rng.pick(['the Iron Gate', 'the Bastion', 'the Shieldwall', 'the Unyielding']);
    const opening = `${name} is a fortress ${settingClause(world, f, terrain, rng)}.`;
    const war = `Raised in ${rng.pick(ERAS)}, it ${rng.pick(['has withstood every siege laid to it', 'holds the only pass for fifty miles', 'commands the river and the road both', 'was thought impregnable, and proved it once'])}.`;
    return { epithet, text: `${opening} ${war}` };
  }

  // Settlements: capital / city / town / village / port.
  const size = sizeWord(f.kind === 'capital' ? 4 : f.rank);
  const noun = kindNoun(f);
  const region = nearestRegionName(world, f.x, f.y);
  const epithet =
    f.kind === 'capital'
      ? (region ? `Seat of ${region}` : rng.pick(['the King’s Seat', 'the Crowned City', 'the First City']))
      : rng.bool(0.55)
        ? rng.pick(['the ' + cap(rng.pick(['bright', 'old', 'free', 'walled', 'golden', 'storm-worn'])) + ' ' + cap(noun), 'Jewel of the coast', 'the Market Town', 'the Crossroads'])
        : undefined;

  const opening = `${name} is a ${size} ${noun} ${settingClause(world, f, terrain, rng)}.`;
  const history = `Founded in ${rng.pick(ERAS)}, it ${rng.pick(FOUNDING_EVENTS)}.`;
  const trait = rng.bool(0.8) ? ` Today it is known for ${rng.pick(TERRAIN_TRAIT[terrain])}.` : '';
  return { epithet, text: `${opening} ${history}${trait}` };
}

/** Lore for a region / sea / range label, from the given stream. */
export function loreForLabel(world: World, l: Label, rng: Rng): Lore {
  const name = l.text;
  if (l.role === 'region') {
    const ci = nearestCell(world.grid, l.x, l.y);
    const terrain = terrainOf(world.cells.biome[ci] as BiomeId);
    const adj = rng.pick(['wide', 'wild', 'storied', 'half-tamed', 'fertile', 'hard-bitten', 'lonely']);
    const noun = rng.pick(TERRAIN_NOUN[terrain]);
    const character = rng.pick([
      'It has been a contested march for generations.',
      'Out here the king’s law thins toward the edges.',
      'It keeps to itself and its own old ways.',
      'Few outsiders cross it, and fewer settle.',
    ]);
    const legend = rng.pick([
      'Its people reckon the years by their own old calendar.',
      'Older maps mark borders that no longer hold.',
      'Songs out of this country are sung as far as the sea.',
      'What rules it now is not always what claims to.',
    ]);
    return { epithet: undefined, text: `${name} is a ${adj} country of ${noun}. ${character} ${legend}` };
  }
  if (l.role === 'water') {
    const mood = rng.pick(['cold and deep', 'grey and restless', 'calm but treacherous', 'fog-bound for half the year']);
    const tale = rng.pick([
      'Sailors who cross it leave an offering and say little.',
      'It has swallowed more ships than the charts admit.',
      'Its currents carry strange things to shore.',
      'Whalers and traders alike give its far side a wide berth.',
    ]);
    return { epithet: undefined, text: `${name} runs ${mood}. ${tale}` };
  }
  // range
  const bearing = rng.pick(['north to south', 'along the spine of the land', 'across the high country', 'between two kingdoms']);
  const tale = rng.pick([
    'Only a handful of passes cross it, and each has a toll and a tale.',
    'The first to map it never came back down.',
    'Its peaks hold snow that has never once melted.',
    'Something old is said to keep the high passes.',
  ]);
  return { epithet: undefined, text: `${name} runs ${bearing}. ${tale}` };
}

// --- Batch assignment (pipeline entry points) ------------------------------

/** Deterministic per-entry stream: stable across rolls, unique per id. */
function entryRng(world: World, id: string): Rng {
  return makeRng(world.meta.seed, `lore:${id}`);
}

/** Assign lore to every eligible feature, skipping hand-edited ones. */
export function assignFeatureLore(world: World): World {
  for (const f of world.features) {
    if (!LORE_KINDS.has(f.kind)) continue;
    if (f.lore?.edited) continue;
    f.lore = loreForFeature(world, f, entryRng(world, f.id));
  }
  return world;
}

/** Assign lore to every region/sea/range label, skipping hand-edited ones. */
export function assignLabelLore(world: World): World {
  for (const l of world.labels) {
    if (l.role !== 'region' && l.role !== 'water' && l.role !== 'range') continue;
    if (l.lore?.edited) continue;
    l.lore = loreForLabel(world, l, entryRng(world, l.id));
  }
  return world;
}
