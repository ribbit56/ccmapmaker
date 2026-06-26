/*
  Fantasy name generator (CLAUDE.md §5 step 13). Syllable-based and fully seeded, so
  a seed reproduces the same names. A light per-place flavour gives coastal, mountain,
  forest and plains names their own feel via flavoured suffixes (e.g. "-haven",
  "-crag", "-wood", "-ford"). Used for settlements now; rivers/regions/ranges reuse it
  when labels arrive (Phase 7).
*/

import type { Rng } from '../rng';
import type { NamingStyle } from '../config';

export type NameFlavor = 'coast' | 'mountain' | 'forest' | 'plain' | 'generic';

// Per-style syllable pools give each naming preset its own feel.
const SYLLABLE_SETS: Record<NamingStyle, string[]> = {
  // Tolkien-ish blended with old-English roots.
  classic: [
    'ael', 'an', 'ar', 'as', 'bal', 'bran', 'cael', 'cor', 'dun', 'el', 'en', 'esk',
    'fal', 'fen', 'gal', 'gorm', 'hal', 'il', 'ith', 'kor', 'lin', 'lor', 'mar', 'mor',
    'nar', 'nen', 'or', 'oss', 'pel', 'quor', 'ran', 'rim', 'sel', 'syl', 'tarn', 'thal',
    'tor', 'ul', 'vor', 'wyn', 'yr', 'aeg', 'dren', 'gleam', 'hollow', 'frost',
  ],
  // Hard, consonant-heavy — dwarvish / northern.
  harsh: [
    'brak', 'drog', 'grim', 'kar', 'thrun', 'gorm', 'dur', 'kazh', 'mok', 'narg',
    'orz', 'rukh', 'skol', 'thar', 'urg', 'vrak', 'zud', 'grond', 'khaz', 'brum',
    'dronn', 'gulk', 'harn', 'krenn', 'molk', 'stryg', 'thurm', 'vorn',
  ],
  // Flowing, vowel-heavy — elvish.
  elvish: [
    'ae', 'ia', 'el', 'lor', 'ith', 'ael', 'sil', 'wen', 'eth', 'ya', 'mir', 'las',
    'rie', 'naeth', 'olwe', 'aer', 'uin', 'ela', 'thae', 'lian', 'eru', 'ria', 'wei',
    'lae', 'nim', 'cael', 'aria', 'oth',
  ],
};

const PREFIXES = [
  'Black', 'Grey', 'White', 'Red', 'Green', 'Storm', 'Stone', 'Iron', 'Gold', 'Raven',
  'Frost', 'Oak', 'Ash', 'Moon', 'Sun', 'High', 'Far', 'Old',
];

const SUFFIXES: Record<NameFlavor, string[]> = {
  coast: ['haven', 'port', 'bay', 'mouth', 'cove', 'strand', 'wharf', 'tide'],
  mountain: ['hold', 'peak', 'crag', 'fell', 'spire', 'gate', 'deep', 'forge'],
  forest: ['wood', 'vale', 'grove', 'shaw', 'hollow', 'thicket', 'glade'],
  plain: ['field', 'moor', 'ham', 'ton', 'stead', 'march', 'ford', 'reach'],
  generic: ['burg', 'gard', 'holm', 'dale', 'mere', 'wick', 'by'],
};

export interface Namer {
  (flavor?: NameFlavor): string;
}

export function makeNamer(rng: Rng, style: NamingStyle = 'classic'): Namer {
  const used = new Set<string>();
  const syllables = SYLLABLE_SETS[style];
  const apostrophe = style === 'elvish'; // elvish occasionally uses an apostrophe

  const root = (): string => {
    const n = rng.int(2, 3);
    let s = '';
    for (let i = 0; i < n; i++) {
      if (i > 0 && apostrophe && rng.bool(0.18)) s += "'";
      s += rng.pick(syllables);
    }
    // Collapse triple letters / awkward doubles for readability.
    s = s.replace(/(.)\1\1+/g, '$1$1').replace(/(.)\1/g, (m, ch) => (rng.bool() ? ch : m));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const build = (flavor: NameFlavor): string => {
    const r = rng.next();
    if (r < 0.32) {
      // Compound: "Black + wood", attached or spaced.
      const suf = rng.pick(SUFFIXES[flavor]);
      const pre = rng.pick(PREFIXES);
      return rng.bool() ? `${pre}${suf}` : `${pre} ${cap(suf)}`;
    }
    if (r < 0.7) {
      // Root + flavoured suffix.
      const suf = rng.pick(SUFFIXES[flavor]);
      return rng.bool() ? `${root()}${suf}` : `${root()} ${cap(suf)}`;
    }
    // Bare root, occasionally two words.
    return rng.bool(0.25) ? `${root()} ${root()}` : root();
  };

  return (flavor: NameFlavor = 'generic'): string => {
    for (let attempt = 0; attempt < 24; attempt++) {
      const name = build(flavor);
      if (name.length >= 4 && name.length <= 16 && !used.has(name)) {
        used.add(name);
        return name;
      }
    }
    // Fallback: guarantee uniqueness.
    let name = root();
    let i = 2;
    while (used.has(name)) name = `${root()} ${i++}`;
    used.add(name);
    return name;
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
