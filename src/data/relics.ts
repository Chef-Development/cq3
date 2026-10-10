// Relics (plain data, no logic): run picks that change a rule or a decision, never a flat stat bump. Each has 1-2
// synergy tags, a rarity (the boost cards' common / rare / epic), at most one number (`n`; the live value is
// tuning.relics.n[id], and '{n}' in the text shows it), and how it is unlocked (none = from the start).
// src/core/relic-fx.ts makes them work in fights, src/core/relics.ts rolls the offers and names the build.

import { ASH_PAIR_NAME, ASH_RELICS, type AshRelicId } from './relics-ash';
import { DUSK_PAIR_NAME, DUSK_RELICS, type DuskRelicId } from './relics-dusk';

export type RelicTag = 'bomb' | 'crit' | 'block' | 'combo' | 'finisher' | 'green' | 'pip' | 'sustain' | 'coins' | 'risk' | 'ice' | 'hold' | 'drift' | 'link' | 'light' | 'tide';
export const RELIC_TAGS: RelicTag[] = ['bomb', 'crit', 'block', 'combo', 'finisher', 'green', 'pip', 'sustain', 'coins', 'risk', 'ice', 'hold', 'drift', 'link', 'light', 'tide'];
export const TAG_NAME: Record<RelicTag, string> = {
  bomb: 'Bomb',
  crit: 'Crit',
  block: 'Block',
  combo: 'Combo',
  finisher: 'Finisher',
  green: 'Green',
  pip: 'Pip',
  sustain: 'Sustain',
  coins: 'Coins',
  risk: 'Risk',
  ice: 'Ice',
  hold: 'Hold',
  drift: 'Drift',
  link: 'Link',
  light: 'Light',
  tide: 'Tide',
};

export type RelicRarity = 'common' | 'rare' | 'epic';

/** How a locked relic is unlocked: the first clear of an act, the first elite won in an act, a choice at an event, or a
 *  hero's mastery milestone (src/data/meta.ts). */
export type RelicUnlock = { kind: 'act'; act: number } | { kind: 'elite'; act: number } | { kind: 'event'; event: string; choice: number } | { kind: 'mastery' };

export type RelicId =
  | 'powderKeg'
  | 'shortFuse'
  | 'sapper'
  | 'blastWave'
  | 'partingGift'
  | 'sharpshooter'
  | 'glassEdge'
  | 'lastStand'
  | 'weakSpot'
  | 'ricochet'
  | 'huntingOwl'
  | 'luckyPenny'
  | 'ironRhythm'
  | 'mirrorGuard'
  | 'turtleShell'
  | 'shieldbearer'
  | 'nightWatch'
  | 'chainReaction'
  | 'momentum'
  | 'crescendo'
  | 'clutch'
  | 'overdrive'
  | 'goldFever'
  | 'sweeper'
  | 'hoarder'
  | 'overcharge'
  | 'quickDraw'
  | 'echoStrike'
  | 'bloodPrice'
  | 'purplePact'
  | 'greenhouse'
  | 'verdantSurge'
  | 'evergreen'
  | 'photosynthesis'
  | 'treasureNose'
  | 'wingman'
  | 'vampiricFang'
  | 'fieldRations'
  | 'tithe'
  | 'haggler'
  // Region 2: Ice and Hold
  | 'skateBlades'
  | 'frostRune'
  | 'hotCocoa'
  | 'icebreaker'
  | 'snowplow'
  | 'glacierHeart'
  | 'frostbite'
  | 'melt'
  | 'steadyGrip'
  | 'longNote'
  | 'holdFast'
  | 'releaseValve'
  | 'tether'
  | 'luckyMitten'
  | 'crampons'
  // the third region's (src/data/relics-ash.ts)
  | AshRelicId
  // the fourth region's (src/data/relics-dusk.ts)
  | DuskRelicId;

export interface RelicDef {
  id: RelicId;
  name: string;
  tags: RelicTag[]; // 1-2, the first is its main one
  rarity: RelicRarity;
  /** What it does, one short sentence (two lines on a card). '{n}' is its number. */
  text: string;
  n?: number;
  unlock?: RelicUnlock;
  /** Only offered from this (global) act on: the Ice and Hold relics wait for the region that has ice and holds. */
  from?: number;
}

const R = (id: RelicId, name: string, tags: RelicTag[], rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): RelicDef => ({ id, name, tags, rarity, text, n, unlock });
/** A Region 2 relic (offered from its first act on). */
const F = (id: RelicId, name: string, tags: RelicTag[], rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): RelicDef => ({ ...R(id, name, tags, rarity, text, n, unlock), from: 3 });

export const RELICS: RelicDef[] = [
  // Bomb: bombs are red attacks; tapping one blasts every foe (and the blocks near it)
  R('powderKeg', 'Powder Keg', ['bomb', 'finisher'], 'common', 'Tapping a bomb also banks a finisher stack.'),
  R('shortFuse', 'Short Fuse', ['bomb', 'risk'], 'rare', 'Bombs that reach you blow up on the foes instead.', undefined, { kind: 'act', act: 0 }),
  R('sapper', "Sapper's Fuse", ['bomb'], 'common', 'Every {n}th red comes as a bomb.', 4),
  R('blastWave', 'Blast Wave', ['bomb', 'combo'], 'rare', 'Yellows cleared by a bomb blast count as hits.'),
  R('partingGift', 'Parting Gift', ['bomb', 'finisher'], 'rare', 'After a finisher, a bomb rolls onto the bar.', undefined, { kind: 'elite', act: 1 }),
  // Crit
  R('sharpshooter', 'Sharpshooter', ['crit'], 'common', 'Perfects always crit.'),
  R('glassEdge', 'Glass Edge', ['crit', 'risk'], 'rare', 'Crits deal double, but a miss costs {n} HP.', 5),
  R('lastStand', 'Last Stand', ['crit', 'risk'], 'rare', 'Below {n}% HP, every hit crits.', 30),
  R('weakSpot', 'Weak Spot', ['crit', 'block'], 'common', 'Your first hit after a block always crits.'),
  R('ricochet', 'Ricochet', ['crit'], 'rare', 'A crit also hits the next foe for the same damage.', undefined, { kind: 'act', act: 1 }),
  R('huntingOwl', 'Hunting Owl', ['pip', 'crit'], 'rare', "Pip's pecks can crit, with your crit chance and damage.", undefined, { kind: 'event', event: 'shiny', choice: 0 }),
  R('luckyPenny', 'Lucky Penny', ['coins', 'crit'], 'common', 'Every crit drops {n} coin.', 1, { kind: 'event', event: 'merchant', choice: 0 }),
  // Block
  R('ironRhythm', 'Iron Rhythm', ['block'], 'rare', 'Every 3rd block in a row hits back for {n}x attack.', 2),
  R('mirrorGuard', 'Mirror Guard', ['block'], 'epic', 'Perfect blocks throw the attack back at its owner.', undefined, { kind: 'elite', act: 0 }),
  R('turtleShell', 'Turtle Shell', ['block'], 'common', 'Shield reds need one fewer tap.'),
  R('shieldbearer', 'Shieldbearer', ['block', 'finisher'], 'rare', 'Only blocks fill the meter, but {n}x as much.', 3),
  R('nightWatch', 'Night Watch', ['pip', 'block'], 'rare', 'Every {n}th peck, Pip blocks the nearest red.', 4),
  // Combo
  R('chainReaction', 'Chain Reaction', ['combo', 'green'], 'rare', 'Every {n} combo, all yellows on the bar turn green.', 15, { kind: 'act', act: 0 }),
  R('momentum', 'Momentum', ['combo'], 'common', 'Damage grows with cursor speed: +{n}% at max.', 40),
  R('crescendo', 'Crescendo', ['combo', 'finisher'], 'rare', 'Your finisher deals +{n}% per combo.', 1, { kind: 'act', act: 1 }),
  R('clutch', 'Clutch', ['combo', 'risk'], 'common', 'A miss no longer breaks your combo, but costs {n}% HP.', 2),
  R('overdrive', 'Overdrive', ['combo', 'risk'], 'epic', 'At {n}+ combo, deal and take double damage.', 30, { kind: 'act', act: 2 }),
  R('goldFever', 'Gold Fever', ['coins', 'combo'], 'common', '+1 coin per 10 combo; shops cost {n}% more.', 20),
  // Finisher
  R('sweeper', 'Sweeper', ['finisher', 'combo'], 'common', 'Your finisher no longer resets your combo.'),
  R('hoarder', 'Hoarder', ['finisher'], 'common', 'A miss or a hit taken costs 1 stack, not all.'),
  R('overcharge', 'Overcharge', ['finisher', 'risk'], 'rare', '+2 max stacks, but lose one after {n} s without a hit.', 8),
  R('quickDraw', 'Quick Draw', ['finisher'], 'common', 'A 1-stack finisher deals {n}x damage.', 3),
  R('echoStrike', 'Echo Strike', ['finisher'], 'epic', 'Your finisher strikes again a moment later for {n}%.', 50, { kind: 'act', act: 2 }),
  R('bloodPrice', 'Blood Price', ['finisher', 'risk'], 'rare', 'Your finisher deals double but costs {n}% HP.', 6, { kind: 'event', event: 'dummy', choice: 0 }),
  R('purplePact', 'Purple Pact', ['risk', 'finisher'], 'rare', 'Tapped traps just cost {n} HP and give a stack.', 5),
  // Green
  R('greenhouse', 'Greenhouse', ['green'], 'common', 'Greens come twice as often; yellows deal {n}% less.', 20),
  R('verdantSurge', 'Verdant Surge', ['green', 'finisher'], 'epic', 'Green hits bank a whole finisher stack.', undefined, { kind: 'elite', act: 2 }),
  R('evergreen', 'Evergreen', ['green'], 'rare', 'While your green ability is on, Perfects restart it.', undefined, { kind: 'event', event: 'shrine', choice: 0 }),
  R('photosynthesis', 'Photosynthesis', ['green', 'sustain'], 'common', 'Green hits heal {n}% HP.', 3),
  // Pip
  R('treasureNose', 'Treasure Nose', ['pip', 'coins'], 'common', "Pip's pecks steal {n} coin.", 1),
  R('wingman', 'Wingman', ['pip', 'finisher'], 'common', "Pip's pecks fill the meter like a hit."),
  // Sustain and coins
  R('vampiricFang', 'Vampiric Fang', ['sustain', 'risk'], 'rare', 'Every hit heals {n} HP, but rests heal nothing.', 1, { kind: 'event', event: 'mushroom', choice: 0 }),
  R('fieldRations', 'Field Rations', ['sustain'], 'common', 'Every step on the map heals {n}% HP.', 4),
  R('tithe', 'Tithe', ['sustain', 'coins'], 'common', 'Rests cost {n} coins but heal you fully.', 20, { kind: 'event', event: 'well', choice: 0 }),
  R('haggler', 'Haggler', ['coins'], 'common', 'The first thing you buy in each shop is free.'),
  // Ice (Region 2): patches of ice on the bar speed the cursor up
  F('skateBlades', 'Skate Blades', ['ice'], 'common', 'Hits on ice deal +{n}%.', 40, { kind: 'mastery' }),
  F('frostRune', 'Frost Rune', ['ice', 'crit'], 'rare', 'Perfect hits on ice always crit.', undefined, { kind: 'act', act: 3 }),
  F('hotCocoa', 'Hot Cocoa', ['ice', 'sustain'], 'common', 'When an ice patch melts, heal {n} HP.', 3, { kind: 'mastery' }),
  F('icebreaker', 'Icebreaker', ['ice', 'block'], 'rare', 'Blocking a red on ice knocks it back to the far end.', undefined, { kind: 'mastery' }),
  F('snowplow', 'Snowplow', ['ice', 'finisher'], 'rare', 'Your finisher clears every patch, +{n}% per patch.', 15, { kind: 'mastery' }),
  F('glacierHeart', 'Glacier Heart', ['ice', 'block'], 'rare', 'Reds on ice move {n}% slower.', 30, { kind: 'mastery' }),
  F('frostbite', 'Frostbite', ['ice', 'risk'], 'epic', 'Ice speeds you {n}% more, but hits on ice deal double.', 30, { kind: 'elite', act: 3 }),
  F('melt', 'Melt', ['ice', 'green'], 'common', 'Yellows that land on ice turn green.'),
  // Hold (Region 2): hold blocks are held from their start to their end
  F('steadyGrip', 'Steady Grip', ['hold', 'finisher'], 'common', 'A finished hold fills the meter like {n} hits.', 2),
  F('longNote', 'Long Note', ['hold', 'combo'], 'common', 'A finished hold counts {n} extra combo.', 3, { kind: 'mastery' }),
  F('holdFast', 'Hold Fast', ['hold', 'block'], 'rare', 'While you hold, reds that reach you deal half.', undefined, { kind: 'mastery' }),
  F('releaseValve', 'Release Valve', ['hold', 'finisher'], 'rare', 'Every {n}rd finished hold banks a finisher stack.', 3, { kind: 'act', act: 4 }),
  F('tether', 'Tether', ['hold', 'crit'], 'rare', 'A Perfect hold always crits.', undefined, { kind: 'mastery' }),
  F('luckyMitten', 'Lucky Mitten', ['hold', 'coins'], 'common', 'Each finished hold drops {n} coin.', 1),
  F('crampons', 'Crampons', ['hold', 'sustain'], 'rare', "Once a fight, a slipped hold doesn't break your combo.", undefined, { kind: 'elite', act: 4 }),
];

// the third region's relics (offered from its first act on)
RELICS.push(...(ASH_RELICS as RelicDef[]));
// the fourth region's relics (offered from its first act on)
RELICS.push(...(DUSK_RELICS as RelicDef[]));

export const RELIC_IDS: RelicId[] = RELICS.map((r) => r.id);
export const relicById = (id: string): RelicDef | undefined => RELICS.find((r) => r.id === id);
export const isRelicId = (id: unknown): id is RelicId => typeof id === 'string' && RELIC_IDS.includes(id as RelicId);

/** The build the act-clear screen names from your top tags: one tag, or a pair when two lead together. */
export const BUILD_NAME: Record<RelicTag, string> = {
  bomb: 'Bomber',
  crit: 'Crit Fiend',
  block: 'Iron Wall',
  combo: 'Combo Artist',
  finisher: 'Showstopper',
  green: 'Green Thumb',
  pip: 'Owl Whisperer',
  sustain: 'Survivor',
  coins: 'Treasure Hunter',
  risk: 'Daredevil',
  ice: 'Frostwalker',
  hold: 'Steady Hand',
  drift: 'Firewalker',
  link: 'Chainsmith',
  light: 'Lamplighter',
  tide: 'Tidewalker',
};

/** Two-tag builds (either order). */
export const PAIR_NAME: Array<[RelicTag, RelicTag, string]> = [
  ['bomb', 'risk', 'Mad Bomber'],
  ['bomb', 'finisher', 'Demolisher'],
  ['bomb', 'combo', 'Chain Blaster'],
  ['crit', 'risk', 'Glass Cannon'],
  ['crit', 'block', 'Duelist'],
  ['crit', 'combo', 'Blade Dancer'],
  ['crit', 'pip', 'Falconer'],
  ['crit', 'coins', 'Lucky Shot'],
  ['block', 'finisher', 'Counterpuncher'],
  ['block', 'pip', 'Owl Guard'],
  ['block', 'sustain', 'Bastion'],
  ['combo', 'finisher', 'Maestro'],
  ['combo', 'risk', 'Thrill Seeker'],
  ['combo', 'green', 'Gardener'],
  ['combo', 'coins', 'Gold Rusher'],
  ['finisher', 'risk', 'Berserker'],
  ['finisher', 'green', 'Overgrowth'],
  ['finisher', 'pip', 'Wing Commander'],
  ['green', 'sustain', 'Druid'],
  ['sustain', 'risk', 'Blood Knight'],
  ['sustain', 'coins', 'Innkeeper'],
  ['pip', 'coins', 'Magpie'],
  ['ice', 'hold', 'Glacier Dancer'],
  ['ice', 'crit', 'Ice Pick'],
  ['hold', 'finisher', 'Slow Burn'],
  ...(ASH_PAIR_NAME as Array<[RelicTag, RelicTag, string]>),
  ...(DUSK_PAIR_NAME as Array<[RelicTag, RelicTag, string]>),
];

/** A new player's first relic pick (core/run.ts rollFirstPick) draws from these when it can: plain rules felt in the
 *  first fights (crits, blocks, greens, the finisher, healing), none that needs a bar piece Act 1 hasn't shown yet
 *  (bombs), a trade-off or a shop. The chest's rare one comes from the rares among them. */
export const STARTER_RELICS: readonly RelicId[] = ['sharpshooter', 'weakSpot', 'ironRhythm', 'nightWatch', 'photosynthesis', 'chainReaction', 'quickDraw', 'sweeper', 'hoarder', 'fieldRations'];
