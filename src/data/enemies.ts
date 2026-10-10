// Greenmarch's enemies: base stats, a base block pattern, and 0-2 special moves each. A special is a telegraph
// (a wind-up pose and its own sound, 0.6-1.0 s, so the player can glance up and read it) followed by actions
// (src/core/specials.ts). Every enemy changes how the bar plays, not just the block mix.
// The numbers were balanced with the bot (npm run balance, docs/balance.md); the tuning panel edits a live copy.

import { FROST_ENEMIES } from './enemies-frost';
import { ASH_ENEMIES } from './enemies-ash';
import { DUSK_ENEMIES } from './enemies-dusk';
import type { EnemyDef } from './types';

// Fair to a thumb (tests/unit/data.test.ts checks every red formation): a red is never thinner than normal, a fast
// one is wider, and reds in a wave are spaced so each can be blocked on its own, even with the cursor at 1.5x.
const wave = (n: number, delayStep: number, speed: number, width: number) =>
  Array.from({ length: n }, (_, i) => ({ kind: 'red' as const, width, speed, delay: i * delayStep }));

export const ENEMIES: Record<string, EnemyDef> = {
  // ---------------------------------------------------------------- Act 1, Meadow Road
  slime: {
    name: 'Slime',
    tags: ['swarm'],
    hp: 110,
    atk: 8,
    special: 10,
    interval: 0.75,
    pattern: 'YYRYGYYRYY',
    icon: 'drop',
    sprite: 'slime',
    coins: 4,
    specials: [
      // once, below half HP: two small slimes (a big enough hit kills it before it can)
      { id: 'split', name: 'Split!', tell: 0.7, sound: 'split', hpBelow: 0.5, actions: [{ type: 'split', into: 'slimelet', count: 2, hpFrac: 0.55 }] },
    ],
  },
  slimelet: {
    name: 'Slimelet',
    tags: ['swarm'],
    hp: 35,
    atk: 5,
    special: 7,
    interval: 0.9,
    pattern: 'YRYY',
    icon: 'drop',
    sprite: 'slimelet',
    coins: 1,
    specials: [],
  },
  crow: {
    name: 'Crow',
    tags: ['flyer', 'beast'],
    hp: 90,
    atk: 7,
    special: 9,
    interval: 0.7,
    pattern: 'YRYYGRY',
    icon: 'wing',
    sprite: 'crow',
    coins: 4,
    fly: 14,
    specials: [
      // three swooping reds, one after another (a little quicker than usual, and wider for it)
      { id: 'dive', name: 'Dive!', tell: 0.8, sound: 'dive', first: 4, every: 8, actions: [{ type: 'formation', blocks: wave(3, 0.75, 1.2, 1.15) }] },
    ],
  },
  boar: {
    name: 'Boar',
    tags: ['beast', 'brute'],
    hp: 150,
    atk: 10,
    special: 12,
    interval: 0.65,
    pattern: 'YRYSGYYRYY',
    icon: 'tusk',
    sprite: 'boar',
    coins: 6,
    specials: [
      // paws the ground, then one fast, wide red
      { id: 'charge', name: 'Charge!', tell: 0.9, sound: 'charge', first: 4.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.4, width: 1.2 }] }] },
    ],
  },
  bandit: {
    name: 'Bandit',
    tags: ['folk'],
    hp: 190,
    atk: 11,
    special: 12,
    interval: 0.6,
    pattern: 'YRPYGYYRYY',
    icon: 'mask',
    sprite: 'bandit',
    coins: 7,
    specials: [
      // two purple traps dropped right beside yellow blocks
      {
        id: 'smoke',
        name: 'Smoke!',
        tell: 0.7,
        sound: 'smoke',
        first: 4,
        every: 8,
        actions: [{ type: 'formation', blocks: [{ kind: 'purple', beside: 'yellow' }, { kind: 'purple', beside: 'yellow' }] }],
      },
    ],
  },
  knight: {
    name: 'Hedge Knight',
    tags: ['folk', 'armored'],
    hp: 700,
    atk: 13,
    special: 14,
    interval: 0.6,
    pattern: 'YSYRGYYSYR',
    icon: 'leaf',
    sprite: 'knight',
    coins: 35,
    elite: true,
    specials: [
      // shield raised for 2 s: a yellow tap is countered like a purple trap (greens and blocks are safe)
      { id: 'guard', name: 'Guard!', tell: 0.9, sound: 'guard', first: 4, every: 8, actions: [{ type: 'guard', sec: 1.6 }] },
    ],
  },
  bigSlime: {
    name: 'Big Slime',
    tags: ['swarm', 'brute'],
    hp: 750,
    atk: 13,
    special: 14,
    interval: 0.55,
    pattern: 'YRSGYPYFBYRGYP',
    icon: 'drop',
    sprite: 'bigslime',
    coins: 35,
    elite: true,
    specials: [
      { id: 'split', name: 'Split!', tell: 0.8, sound: 'split', hpBelow: 0.5, actions: [{ type: 'split', into: 'slime', count: 2, hpFrac: 0.4 }] },
      {
        id: 'spores',
        name: 'Spores!',
        tell: 0.8,
        sound: 'spores',
        first: 4,
        every: 8,
        actions: [{ type: 'formation', blocks: [{ kind: 'spore', life: 3.5, heal: 0.06 }, { kind: 'spore', life: 3.5, heal: 0.06 }] }],
      },
    ],
  },
  captain: {
    name: 'Bandit Captain',
    tags: ['folk'],
    hp: 1800,
    atk: 15,
    special: 16,
    interval: 0.6,
    pattern: 'YRBYGYYRPY',
    icon: 'crown',
    sprite: 'captain',
    coins: 60,
    boss: true,
    specials: [
      // throws a pair of bombs; at half HP whistles for two Bandits (damage can't skip it)
      { id: 'bombs', name: 'Bombs away!', tell: 0.8, sound: 'bombs', first: 4, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'bomb' }, { kind: 'bomb', delay: 0.85 }] }] },
      { id: 'call', name: 'Lads, help!', tell: 1, sound: 'call', hpBelow: 0.5, gate: true, actions: [{ type: 'summon', enemies: ['bandit', 'bandit'] }] },
    ],
  },

  // ---------------------------------------------------------------- Act 2, Old Ruins
  archer: {
    name: 'Goblin Archer',
    tags: ['folk'],
    hp: 160,
    atk: 9,
    special: 11,
    interval: 0.7,
    pattern: 'YYRYGYRY',
    icon: 'arrow',
    sprite: 'archer',
    coins: 6,
    specials: [
      // three reds at once, spread across the bar's right side
      {
        id: 'volley',
        name: 'Volley!',
        tell: 0.9,
        sound: 'volley',
        first: 4,
        every: 7.5,
        actions: [{ type: 'formation', blocks: [{ kind: 'red', at: 0.38 }, { kind: 'red', at: 0.66 }, { kind: 'red', at: 0.94 }] }],
      },
    ],
  },
  shaman: {
    name: 'Mushroom Shaman',
    tags: ['caster'],
    hp: 170,
    atk: 8,
    special: 10,
    interval: 0.75,
    pattern: 'YYGYRYPY',
    icon: 'spore',
    sprite: 'shaman',
    coins: 7,
    specials: [
      // heal blocks: tap them to pop them; the ones left unbroken heal it and its allies
      {
        id: 'spores',
        name: 'Spores!',
        tell: 0.8,
        sound: 'spores',
        first: 3,
        every: 7,
        actions: [{ type: 'formation', blocks: [{ kind: 'spore', life: 3.5, heal: 0.1 }, { kind: 'spore', life: 3.5, heal: 0.1 }] }],
      },
    ],
  },
  beetle: {
    name: 'Shell Beetle',
    tags: ['armored', 'beast'],
    hp: 210,
    atk: 10,
    special: 12,
    interval: 0.75,
    pattern: 'YSYGYYRY',
    icon: 'shell',
    sprite: 'beetle',
    coins: 7,
    specials: [
      // yellow (and green) hits deal half until both shell blocks are broken
      { id: 'shell', name: 'Shell Up!', tell: 0.8, sound: 'shell', first: 2.5, every: 9, actions: [{ type: 'shell', target: 'self', mult: 0.5, blocks: 2 }] },
    ],
  },
  golem: {
    name: 'Ruin Golem',
    tags: ['construct', 'armored'],
    hp: 2300,
    atk: 16,
    special: 18,
    interval: 0.7,
    pattern: 'YSYGYYRYSY',
    icon: 'rune',
    sprite: 'golem',
    coins: 70,
    boss: true,
    specials: [
      // a huge shield block (three taps), Stomp (the cursor freezes for half a second), and Fortify at half HP
      { id: 'hugeShield', name: 'Wall of Stone!', tell: 0.9, sound: 'hugeShield', first: 3, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'shield', width: 2.2, taps: 3 }] }] },
      { id: 'stomp', name: 'Stomp!', tell: 1, sound: 'stomp', first: 6.5, every: 8, actions: [{ type: 'cursor', freeze: 0.5 }] },
      // once, at half HP (damage can't skip it): stone plates close over its core; yellow hits deal half until both
      // plate blocks are broken
      { id: 'fortify', name: 'Fortify!', tell: 1, sound: 'hugeShield', hpBelow: 0.5, gate: true, actions: [{ type: 'shell', target: 'self', mult: 0.5, blocks: 2 }] },
    ],
  },

  // ---------------------------------------------------------------- Act 3, Boar King's Hollow
  wolf: {
    name: 'Wolf',
    tags: ['beast'],
    hp: 140,
    atk: 8,
    special: 10,
    interval: 0.75,
    pattern: 'YRYYGRY',
    icon: 'fang',
    sprite: 'wolf',
    coins: 5,
    specials: [
      // the pack attacks as one: a red from each wolf, one right after the other
      { id: 'howl', name: 'Howl!', tell: 0.9, sound: 'howl', first: 4, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red' }, { kind: 'red', partner: true, delay: 0.85 }] }] },
    ],
  },
  boarKing: {
    name: 'Boar King',
    tags: ['beast', 'brute'],
    hp: 4800,
    atk: 15,
    special: 20,
    interval: 0.55,
    pattern: 'YRYSRYGYFRYY',
    icon: 'crown',
    sprite: 'boarking',
    coins: 150,
    boss: true,
    phaseScenes: { 2: 'boarKing2', 3: 'boarKing3' },
    specials: [
      // phase 1 (and 2): frequent Charges
      { id: 'charge', name: 'Charge!', tell: 0.8, sound: 'charge', first: 2.5, every: 5, phases: [1, 2], actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.6, width: 1.25 }] }] },
      // phase 2 at 66%: two Piglets; he takes half damage while they live
      {
        id: 'piglets',
        name: 'To me, piglets!',
        tell: 1,
        sound: 'phase',
        hpBelow: 0.66,
        gate: true,
        actions: [{ type: 'phase', phase: 2 }, { type: 'summon', enemies: ['piglet', 'piglet'], link: true }, { type: 'protect', mult: 0.5 }],
      },
      // phase 3 at 33%: enraged, the cursor never drops below 1.2x, Charges come two at a time
      { id: 'enrage', name: 'ENRAGED!', tell: 1, sound: 'enrage', hpBelow: 0.33, gate: true, actions: [{ type: 'phase', phase: 3 }, { type: 'cursor', minSpeed: 1.2 }] },
      {
        id: 'doubleCharge',
        name: 'Double Charge!',
        tell: 0.8,
        sound: 'charge',
        first: 2,
        every: 4.5,
        phases: [3],
        actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.6, width: 1.25 }, { kind: 'red', speed: 1.6, width: 1.25, delay: 0.6 }] }],
      },
    ],
  },
  piglet: {
    name: 'Piglet',
    tags: ['beast', 'swarm'],
    hp: 180,
    atk: 6,
    special: 8,
    interval: 0.9,
    pattern: 'YRYY',
    icon: 'tusk',
    sprite: 'piglet',
    coins: 2,
    specials: [],
  },
  // ---------------------------------------------------------------- Coin Rush (the mini-game stop on the act map)
  // A coin sack that never fights back: yellows only, coming fast. It can't be emptied (a Coin Rush keeps it above
  // 0 HP): the rush ends on the clock (tuning.rush), and every hit knocks coins out of it.
  coinSack: {
    name: 'Coin Sack',
    hp: 9000,
    atk: 0,
    special: 0,
    interval: 0.4,
    pattern: 'Y',
    icon: 'sack',
    sprite: 'coinsack',
    coins: 0,
    specials: [],
  },
  // the camp's Training Dummy (practice fights): a gentle mix of everything, never dangerous
  dummy: {
    name: 'Training Dummy',
    hp: 2400,
    atk: 4,
    special: 4,
    interval: 0.7,
    pattern: 'YYRYGYYRYP',
    icon: 'sack',
    sprite: 'dummy',
    coins: 0,
    specials: [],
  },
  // Region 2 (src/data/enemies-frost.ts)
  ...FROST_ENEMIES,
  // Region 3 (src/data/enemies-ash.ts)
  ...ASH_ENEMIES,
  // Region 4 (src/data/enemies-dusk.ts)
  ...DUSK_ENEMIES,
};
