/*
  Seeded pseudo-random number generator.

  CLAUDE.md §13: ALL randomness in the app must flow through a seed so that a given
  seed reproduces a world (and its paper texture) exactly. Never call Math.random().

  We hash an arbitrary seed string into a 32-bit integer (xmur3) and feed it to
  mulberry32 — a tiny, fast, well-distributed PRNG that is plenty for procedural
  art. Both are standard public-domain algorithms.
*/

/** A deterministic stream of randomness. Construct via {@link makeRng}. */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** true with the given probability (default 0.5). */
  bool(probability?: number): number extends never ? never : boolean;
  /** Random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Symmetric jitter in [-amount, +amount). */
  jitter(amount: number): number;
  /** A fresh independent stream, deterministically derived from this one. */
  fork(): Rng;
}

/** xmur3 string hash → seed function producing 32-bit integers. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32: 32-bit-state PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build an {@link Rng} from a seed string. The same string always yields the same
 * sequence. An optional `salt` lets one seed drive several independent streams
 * (e.g. terrain vs. paper texture) without them correlating.
 */
export function makeRng(seed: string, salt = ''): Rng {
  const seedFn = xmur3(salt ? `${seed}::${salt}` : seed);
  const next = mulberry32(seedFn());

  const rng: Rng = {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    bool: (probability = 0.5) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    jitter: (amount) => (next() * 2 - 1) * amount,
    fork: () => makeRng(seed, `${salt}/${(next() * 0xffffffff) >>> 0}`),
  };
  return rng;
}

/** A short, pronounceable random seed string for the dice button. */
export function randomSeedString(): string {
  // Uses Math.random ONLY to mint a brand-new seed at the user's request — the
  // resulting string then deterministically drives everything else.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
