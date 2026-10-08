// Companions (plain data, no logic): each fights beside the hero (an attack every N of your hits) and adds a bar perk;
// higher rarity = more functions. Pip was the first. Equip one (a camp upgrade unlocks a second). They level up with
// the XP your hero earns while they're equipped and gain stars from duplicates (core/roster.ts); their perks are fight
// hooks (core/companion-fx.ts). Numbers: tuning.pets.

import type { Tier } from './rarity';

export type CompanionId =
  | 'bun' | 'pip' | 'newt' | 'sprocket' | 'brick' | 'flurry' | 'mote' | 'sunny'
  // part6:E (round 7: four more companions)
  | 'burr' | 'lark' | 'gloam' | 'nimbus'
  ;
export const COMPANION_IDS: CompanionId[] = [
  'bun', 'pip', 'newt', 'sprocket', 'brick', 'flurry', 'mote', 'sunny',
  // part6:E
  'burr', 'lark', 'gloam', 'nimbus',
];

export interface CompanionPerk {
  name: string;
  text: string; // one short line
}

export interface CompanionDef {
  id: CompanionId;
  name: string;
  rarity: Tier;
  kind: string; // "Owl", "Snow fox"
  bio: string; // a one-line joke
  role: string; // a one-word role tag ("Damage", "Guard", "Helper")
  /** Its attack: every this many of your hits... */
  every: number;
  /** ...for this x Pip's peck damage... */
  dmg: number;
  /** ...on every foe (Sunny's breath) instead of the target. */
  allFoes?: boolean;
  attack: string; // the attack's name ("Peck", "Bite")
  perks: CompanionPerk[];
  /** Hovers like Pip (else it stands on the ground). */
  flies: boolean;
}

export const COMPANIONS: Record<CompanionId, CompanionDef> = {
  bun: {
    id: 'bun',
    name: 'Bun',
    rarity: 'common',
    kind: 'Rabbit',
    bio: "Carries a satchel. Nobody knows what's in it.",
    role: 'Coins',
    every: 5,
    dmg: 0.7,
    attack: 'Kick',
    perks: [{ name: 'Lucky Foot', text: 'Every 10th hit finds a coin.' }],
    flies: false,
  },
  pip: {
    id: 'pip',
    name: 'Pip',
    rarity: 'uncommon',
    kind: 'Owl',
    bio: 'A consultant. Bills by the hoot.',
    role: 'Damage',
    every: 4,
    dmg: 1,
    attack: 'Peck',
    perks: [{ name: 'Owl Watch', text: 'The first trap each fight is pecked away.' }],
    flies: true,
  },
  newt: {
    id: 'newt',
    name: 'Newt',
    rarity: 'uncommon',
    kind: 'Salamander',
    bio: 'Warm to the touch. Do not touch.',
    role: 'Burn',
    every: 4,
    dmg: 0.8,
    attack: 'Bite',
    perks: [{ name: 'Ember Bite', text: 'Bites burn foes for 4 s: half a bite each second.' }],
    flies: false,
  },
  sprocket: {
    id: 'sprocket',
    name: 'Sprocket',
    rarity: 'rare',
    kind: 'Clockwork',
    bio: 'Needs winding. Gets grumpy if you forget.',
    role: 'Timing',
    every: 5,
    dmg: 1.3,
    attack: 'Zap',
    perks: [{ name: 'Oil Can', text: 'Every 8 s, the next block has a wider Perfect zone.' }],
    flies: false,
  },
  brick: {
    id: 'brick',
    name: 'Brick',
    rarity: 'rare',
    kind: 'Rock pup',
    bio: 'Fetches boulders. Brings them back. Every time.',
    role: 'Guard',
    every: 6,
    dmg: 1.5,
    attack: 'Headbutt',
    perks: [{ name: 'Rock Wall', text: 'Every 15 s, blocks a red that reaches you.' }],
    flies: false,
  },
  flurry: {
    id: 'flurry',
    name: 'Flurry',
    rarity: 'epic',
    kind: 'Snow fox',
    bio: 'Leaves tiny pawprints of frost everywhere.',
    role: 'Control',
    every: 4,
    dmg: 1.3,
    attack: 'Bite',
    perks: [
      { name: 'Chill Bite', text: "Bites slow the target's reds." },
      { name: 'Snow Dash', text: 'After a block, the next red slows for 1 s.' },
    ],
    flies: false,
  },
  mote: {
    id: 'mote',
    name: 'Mote',
    rarity: 'epic',
    kind: 'Star wisp',
    bio: 'Fell from the sky. Decided to stay.',
    role: 'Helper',
    every: 5,
    dmg: 1.1,
    attack: 'Twinkle',
    perks: [
      { name: 'Starlight', text: 'Every 15 combo, a green appears.' },
      { name: 'Mend', text: 'At 10+ combo, heals 1% every 5 s.' },
    ],
    flies: true,
  },
  sunny: {
    id: 'sunny',
    name: 'Sunny',
    rarity: 'legendary',
    kind: 'Drake whelp',
    bio: 'Hoards shiny things. Including your coins.',
    role: 'Damage',
    every: 6,
    dmg: 1.4,
    allFoes: true,
    attack: 'Breath',
    perks: [
      { name: 'Gold Hoard', text: 'Kills drop 15% more coins.' },
      { name: 'Fire Breath', text: 'At 25+ combo, its breath burns away traps.' },
      { name: 'Warm Glow', text: 'Ice patches under you melt twice as fast.' },
    ],
    flies: true,
  },
  // ---- Part 6 companions (round 7): one per rarity from Common to Mythic, each with an effect you can see
  burr: {
    id: 'burr',
    name: 'Burr',
    rarity: 'common',
    kind: 'Hedgehog',
    bio: 'Loves hugs. Nobody is brave enough.',
    role: 'Thorns',
    every: 6,
    dmg: 0.9,
    attack: 'Roll',
    perks: [{ name: 'Prickly', text: 'When a red hits you, spines fly back at its foe.' }],
    flies: false,
  },
  lark: {
    id: 'lark',
    name: 'Lark',
    rarity: 'rare',
    kind: 'Songbird',
    bio: 'Sings at dawn. Every dawn. Loudly.',
    role: 'Combo',
    every: 4,
    dmg: 1.1,
    attack: 'Peck',
    perks: [{ name: 'Wake-up Song', text: 'Every 10 combo, a yellow sings: hit it for 3 more combo.' }],
    flies: true,
  },
  gloam: {
    id: 'gloam',
    name: 'Gloam',
    rarity: 'epic',
    kind: 'Night cat',
    bio: 'Knocks things off tables. Traps included.',
    role: 'Traps',
    every: 5,
    dmg: 1.4,
    attack: 'Swipe',
    perks: [{ name: 'Night Eyes', text: 'Every 12 s, the next trap is swatted into a yellow.' }],
    flies: false,
  },
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus',
    rarity: 'mythic',
    kind: 'Sky whale',
    bio: 'Too small for the sea. Just right for the sky.',
    role: 'Tides',
    every: 7,
    dmg: 1.7,
    allFoes: true,
    attack: 'Spray',
    perks: [
      { name: 'Tide', text: 'Every 20 s, a wave pushes every red back.' },
      { name: 'Calm Seas', text: 'At 30+ combo, your hits deal 15% more.' },
    ],
    flies: true,
  },
};

export const isCompanionId = (v: unknown): v is CompanionId => typeof v === 'string' && COMPANION_IDS.includes(v as CompanionId);
