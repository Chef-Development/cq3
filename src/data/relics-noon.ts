// Region 5's relics (SPOILERS: docs/content-bible.md section 8). NOT IN PLAY YET: data only, not merged into RELICS
// (src/data/relics.ts) and with no hooks yet (core/relic-fx-noon.ts, each with a with/without test, comes with the
// region's wiring, as Region 4's did: the tags and ids into the unions in relics.ts, tag chips in relic-ui.ts and
// relic-log.ts, numbers in tuning.relics.n, perk places in view/perk-at.ts). Same shape as RELICS entries (one rule
// each, at most one number, 1-2 tags, an unlock, `from` the region's first act), with two new tags: Mirage (yellows
// that hop to a spot shown first) and Heat (blazing yellows that hit hard and burn; a green cools).

import type { RelicDef, RelicRarity, RelicTag, RelicUnlock } from './relics';

export type NoonRelicTag = 'mirage' | 'heat';
export const NOON_RELIC_TAGS: NoonRelicTag[] = ['mirage', 'heat'];
export const NOON_TAG_NAME: Record<NoonRelicTag, string> = { mirage: 'Mirage', heat: 'Heat' };

export type NoonRelicId =
  | 'oasisMap'
  | 'hazeLens'
  | 'sandGlass'
  | 'ghostStep'
  | 'sandDollar'
  | 'dustDevil'
  | 'fataMorgana'
  | 'sunshade'
  | 'coolSpring'
  | 'kindling'
  | 'sunShard'
  | 'sunPurse'
  | 'shadeTree'
  | 'noonday';

/** A RELICS entry, with Region 5's ids and tags (merged into RelicId / RelicTag when the region is wired in). */
export interface NoonRelicDef extends Omit<RelicDef, 'id' | 'tags'> {
  id: NoonRelicId;
  tags: Array<RelicTag | NoonRelicTag>;
}

/** Region 5's first act, as a global act index (Duskmire is 9-11). */
const FIRST = 12;

const N = (id: NoonRelicId, name: string, tags: Array<RelicTag | NoonRelicTag>, rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): NoonRelicDef => ({ id, name, tags, rarity, text, n, unlock, from: FIRST });

export const NOON_RELICS: NoonRelicDef[] = [
  // Mirage: a yellow that hops now and then, its landing spot shown first
  N('oasisMap', 'Oasis Map', ['mirage'], 'common', 'Hits on mirages deal +{n}%.', 40),
  N('hazeLens', 'Haze Lens', ['mirage', 'crit'], 'rare', 'A mirage hit right after its hop crits.', undefined, { kind: 'act', act: 12 }),
  N('sandGlass', 'Sand Glass', ['mirage'], 'common', 'Mirages hop {n}% less often.', 30),
  N('ghostStep', 'Ghost Step', ['mirage', 'finisher'], 'rare', 'Hitting a mirage fills the meter like {n} hits.', 2, { kind: 'elite', act: 12 }),
  N('sandDollar', 'Sand Dollar', ['mirage', 'coins'], 'common', 'Each mirage you hit drops {n} coin.', 1),
  N('dustDevil', 'Dust Devil', ['mirage', 'combo'], 'rare', 'A mirage hit counts {n} extra combo.', 2, { kind: 'act', act: 13 }),
  N('fataMorgana', 'Fata Morgana', ['mirage', 'risk'], 'epic', 'Mirages hop twice as often; hits on them x{n}.', 3, { kind: 'elite', act: 14 }),
  // Heat: a blazing yellow hits hard and adds Heat, which burns; a green cools it
  N('sunshade', 'Sunshade', ['heat', 'sustain'], 'common', 'Your Heat burns {n}% slower.', 30),
  N('coolSpring', 'Cool Spring', ['heat', 'green'], 'common', 'A green that cools you heals {n} HP.', 3),
  N('kindling', 'Kindling', ['heat', 'finisher'], 'rare', 'Blazing hits fill {n}% more meter.', 50, { kind: 'elite', act: 13 }),
  N('sunShard', 'Sun Shard', ['heat', 'crit'], 'rare', 'At full Heat, every hit crits.', undefined, { kind: 'act', act: 13 }),
  N('sunPurse', 'Sun Purse', ['heat', 'coins'], 'common', 'Each blazing hit drops {n} coin.', 1),
  N('shadeTree', 'Shade Tree', ['heat', 'block'], 'rare', 'Blocking a red cools {n} Heat.', 1, { kind: 'act', act: 14 }),
  N('noonday', 'Noonday', ['heat', 'risk'], 'epic', "Your Heat never burns; blazing hits deal x{n}.", 1.2, { kind: 'elite', act: 14 }),
];

/** The build the act-clear screen names (merged into BUILD_NAME / PAIR_NAME). */
export const NOON_BUILD_NAME: Record<NoonRelicTag, string> = {
  mirage: 'Wayfinder',
  heat: 'Sunborn',
};

export const NOON_PAIR_NAME: Array<[RelicTag | NoonRelicTag, RelicTag | NoonRelicTag, string]> = [
  ['mirage', 'heat', 'High Noon'],
  ['mirage', 'crit', 'Haze Hunter'],
  ['heat', 'risk', 'Sunstruck'],
];
