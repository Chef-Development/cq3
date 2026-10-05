// Relics (plain data, no logic): run picks that change a rule or a decision, never a flat stat bump. Each has 1-2
// synergy tags, a rarity (the boost cards' common / rare / epic), at most one number (`n`; the live value is
// tuning.relics.n[id], and '{n}' in the text shows it), and how it is unlocked (none = from the start).
// src/core/relic-fx.ts makes them work in fights, src/core/relics.ts rolls the offers and names the build.

export type RelicTag = 'bomb' | 'crit' | 'block' | 'combo' | 'finisher' | 'green' | 'pip' | 'sustain' | 'coins' | 'risk';
export const RELIC_TAGS: RelicTag[] = ['bomb', 'crit', 'block', 'combo', 'finisher', 'green', 'pip', 'sustain', 'coins', 'risk'];
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
};

export type RelicRarity = 'common' | 'rare' | 'epic';

/** How a locked relic is unlocked: the first clear of an act, the first elite won in an act, or a choice at an event. */
export type RelicUnlock = { kind: 'act'; act: number } | { kind: 'elite'; act: number } | { kind: 'event'; event: string; choice: number };

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
  | 'haggler';

export interface RelicDef {
  id: RelicId;
  name: string;
  tags: RelicTag[]; // 1-2, the first is its main one
  rarity: RelicRarity;
  /** What it does, one short sentence (two lines on a card). '{n}' is its number. */
  text: string;
  n?: number;
  unlock?: RelicUnlock;
}

const R = (id: RelicId, name: string, tags: RelicTag[], rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): RelicDef => ({ id, name, tags, rarity, text, n, unlock });

export const RELICS: RelicDef[] = [
  // Bomb: bombs are red attacks; tapping one blasts every foe (and the blocks near it)
  R('powderKeg', 'Powder Keg', ['bomb', 'finisher'], 'common', 'Tapping a bomb also banks a finisher stack.'),
  R('shortFuse', 'Short Fuse', ['bomb', 'risk'], 'rare', 'Bombs that reach you blow up on the enemies instead.', undefined, { kind: 'act', act: 0 }),
  R('sapper', "Sapper's Fuse", ['bomb'], 'common', 'Every {n}th enemy red comes as a bomb.', 4),
  R('blastWave', 'Blast Wave', ['bomb', 'combo'], 'rare', 'Yellows a bomb blast clears count as your hits.'),
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
  R('ironRhythm', 'Iron Rhythm', ['block'], 'rare', 'Every 3rd block in a row counterattacks for {n}x attack.', 2),
  R('mirrorGuard', 'Mirror Guard', ['block'], 'epic', 'Perfect blocks throw the attack back at its owner.', undefined, { kind: 'elite', act: 0 }),
  R('turtleShell', 'Turtle Shell', ['block'], 'common', 'Shield reds need one tap less.'),
  R('shieldbearer', 'Shieldbearer', ['block', 'finisher'], 'rare', 'Only blocks fill the meter, but {n}x as much.', 3),
  R('nightWatch', 'Night Watch', ['pip', 'block'], 'rare', 'Every {n}th peck, Pip blocks the nearest red.', 4),
  // Combo
  R('chainReaction', 'Chain Reaction', ['combo', 'green'], 'rare', 'Every {n} combo, all yellows on the bar turn green.', 15, { kind: 'act', act: 0 }),
  R('momentum', 'Momentum', ['combo'], 'common', 'Damage grows with cursor speed: +{n}% at max.', 40),
  R('crescendo', 'Crescendo', ['combo', 'finisher'], 'rare', 'Your finisher deals +{n}% per combo.', 1, { kind: 'act', act: 1 }),
  R('clutch', 'Clutch', ['combo', 'risk'], 'common', 'A miss no longer breaks your combo, but costs {n}% HP.', 4),
  R('overdrive', 'Overdrive', ['combo', 'risk'], 'epic', 'At {n}+ combo you deal double damage and take double.', 30, { kind: 'act', act: 2 }),
  R('goldFever', 'Gold Fever', ['coins', 'combo'], 'common', '+1 coin per 10 combo; shops cost {n}% more.', 20),
  // Finisher
  R('sweeper', 'Sweeper', ['finisher', 'combo'], 'common', 'Your finisher no longer resets your combo.'),
  R('hoarder', 'Hoarder', ['finisher'], 'common', 'A miss or hit costs 1 stack instead of all of them.'),
  R('overcharge', 'Overcharge', ['finisher', 'risk'], 'rare', '+2 max stacks, but you lose a stack after {n} s without a hit.', 8),
  R('quickDraw', 'Quick Draw', ['finisher'], 'common', 'A 1-stack finisher deals {n}x damage.', 3),
  R('echoStrike', 'Echo Strike', ['finisher'], 'epic', 'Your finisher strikes again a moment later for {n}%.', 50, { kind: 'act', act: 2 }),
  R('bloodPrice', 'Blood Price', ['finisher', 'risk'], 'rare', 'Your finisher deals double, but costs {n}% of your HP.', 10, { kind: 'event', event: 'dummy', choice: 0 }),
  R('purplePact', 'Purple Pact', ['risk', 'finisher'], 'rare', 'Traps no longer trigger: you take {n} damage and gain a stack.', 5),
  // Green
  R('greenhouse', 'Greenhouse', ['green'], 'common', 'Green blocks come twice as often; yellows deal {n}% less.', 20),
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
];

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
];
