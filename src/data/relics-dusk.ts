// Region 4's relics (SPOILERS: docs/content-bible.md section 7), merged into RELICS (src/data/relics.ts: the tags,
// ids, build names; tag chips in engine/view/relic-ui.ts and relic-log.ts; numbers in tuning.relics.n; perk places in
// view/perk-at.ts). Icons fall back to a tag tile until painted ones exist. Same shape as RELICS entries
// (one rule each, at most one number, 1-2 tags, an unlock, `from` the region's first act), with two new tags: Light
// (dark blocks and the cursor's lantern) and Tide (the water at the bar's ends). Their hooks: core/relic-fx-dusk.ts.

import type { RelicDef, RelicRarity, RelicTag, RelicUnlock } from './relics';

export type DuskRelicTag = 'light' | 'tide';
export const DUSK_RELIC_TAGS: DuskRelicTag[] = ['light', 'tide'];
export const DUSK_TAG_NAME: Record<DuskRelicTag, string> = { light: 'Light', tide: 'Tide' };

export type DuskRelicId =
  | 'mothWing'
  | 'wickTrimmer'
  | 'nightOwl'
  | 'lanternOil'
  | 'glowWorms'
  | 'emberJar'
  | 'blindfold'
  | 'wadingBoots'
  | 'driftwood'
  | 'undertowCharm'
  | 'lowWater'
  | 'tidepool'
  | 'springTide'
  | 'moonpull';

/** A RELICS entry, with Region 4's ids and tags (merged into RelicId / RelicTag when the region is wired in). */
export interface DuskRelicDef extends Omit<RelicDef, 'id' | 'tags'> {
  id: DuskRelicId;
  tags: Array<RelicTag | DuskRelicTag>;
}

/** Region 4's first act, as a global act index (Greenmarch 0-2, the Frostpeaks 3-5, Ashfell 6-8). */
const FIRST = 9;

const D = (id: DuskRelicId, name: string, tags: Array<RelicTag | DuskRelicTag>, rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): DuskRelicDef => ({ id, name, tags, rarity, text, n, unlock, from: FIRST });

export const DUSK_RELICS: DuskRelicDef[] = [
  // Light: dark blocks show what they are once the cursor's lantern reaches them
  D('mothWing', 'Moth Wing', ['light'], 'common', 'Hits on dark blocks deal +{n}%.', 40),
  D('wickTrimmer', 'Wick Trimmer', ['light', 'crit'], 'rare', 'Perfect hits on dark blocks always crit.', undefined, { kind: 'act', act: 9 }),
  D('nightOwl', 'Night Owl', ['light'], 'common', 'Your light reaches {n}% further.', 30),
  D('lanternOil', 'Lantern Oil', ['light', 'finisher'], 'rare', "Lighting a dark block fills {n}% of a hit's meter.", 50, { kind: 'elite', act: 9 }),
  D('glowWorms', 'Glow Worms', ['light', 'coins'], 'common', 'Each dark block you hit drops {n} coin.', 1),
  D('emberJar', 'Ember Jar', ['light', 'sustain'], 'rare', 'Your light burns dark traps away before they can bite.', undefined, { kind: 'act', act: 10 }),
  D('blindfold', 'Blindfold', ['light', 'risk'], 'epic', 'Your light reaches {n}% less; hits on dark blocks deal x3.', 40, { kind: 'elite', act: 11 }),
  // Tide: water covers an end of the bar; what's under it can't be hit, reds wade through it
  D('wadingBoots', 'Wading Boots', ['tide', 'sustain'], 'common', 'Blocking a red in the water heals {n} HP.', 2),
  D('driftwood', 'Driftwood', ['tide', 'crit'], 'rare', 'A block that just came up out of the water crits.', undefined, { kind: 'act', act: 10 }),
  D('undertowCharm', 'Undertow Charm', ['tide', 'block'], 'common', 'Reds wade {n}% slower in the water.', 25),
  D('lowWater', 'Low Water', ['tide'], 'rare', 'The water comes {n}% less far.', 25, { kind: 'elite', act: 10 }),
  D('tidepool', 'Tidepool', ['tide', 'coins'], 'common', 'Each block that comes up out of the water drops {n} coin.', 1),
  D('springTide', 'Spring Tide', ['tide', 'combo'], 'rare', 'Hits right by the water deal +{n}%.', 50, { kind: 'act', act: 11 }),
  D('moonpull', 'Moonpull', ['tide', 'risk'], 'epic', 'Blocking in water knocks the next red back. Tide +{n}%.', 25, { kind: 'elite', act: 11 }),
];

/** The build the act-clear screen names (merged into BUILD_NAME / PAIR_NAME). */
export const DUSK_BUILD_NAME: Record<DuskRelicTag, string> = {
  light: 'Lamplighter',
  tide: 'Tidewalker',
};

export const DUSK_PAIR_NAME: Array<[RelicTag | DuskRelicTag, RelicTag | DuskRelicTag, string]> = [
  ['light', 'tide', 'Marshlord'],
  ['light', 'crit', 'Moonlit'],
  ['tide', 'block', 'Breakwater'],
];

/** A Region 4 relic's number (until they're merged into tuning.relics.n). */
export const duskN = (id: DuskRelicId): number => DUSK_RELICS.find((r) => r.id === id)?.n ?? 0;
