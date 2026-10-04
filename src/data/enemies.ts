// Greenmarch's enemies: base stats, a base block pattern, and 0-2 special moves each. A special is a telegraph
// (a wind-up pose and its own sound, 0.6-1.0 s, so the player can glance up and read it) followed by actions
// (src/core/specials.ts). Every enemy changes how the bar plays, not just the block mix.
// The numbers were balanced with the bot (npm run balance, docs/balance.md); the tuning panel edits a live copy.

import type { EnemyDef } from './types';

const fast = (n: number, delayStep: number) =>
  Array.from({ length: n }, (_, i) => ({ kind: 'red' as const, width: 0.65, speed: 1.7, delay: i * delayStep }));

export const ENEMIES: Record<string, EnemyDef> = {
  // ---------------------------------------------------------------- Act 1, Meadow Road
  slime: {
    name: 'Slime',
    hp: 300,
    atk: 12,
    special: 16,
    interval: 0.75,
    pattern: 'YYRYGYYRYY',
    icon: 'drop',
    sprite: 'slime',
    coins: 8,
    specials: [
      // once, below half HP: two small slimes (a big enough hit kills it before it can)
      { id: 'split', name: 'Split!', tell: 0.7, sound: 'split', hpBelow: 0.5, actions: [{ type: 'split', into: 'slimelet', count: 2, hpFrac: 0.55 }] },
    ],
  },
  slimelet: {
    name: 'Slimelet',
    hp: 90,
    atk: 7,
    special: 10,
    interval: 0.9,
    pattern: 'YRYY',
    icon: 'drop',
    sprite: 'slimelet',
    coins: 3,
    specials: [],
  },
  crow: {
    name: 'Crow',
    hp: 240,
    atk: 9,
    special: 14,
    interval: 0.7,
    pattern: 'YRYYGRY',
    icon: 'wing',
    sprite: 'crow',
    coins: 8,
    fly: 14,
    specials: [
      // three small, fast reds in quick succession
      { id: 'dive', name: 'Dive!', tell: 0.7, sound: 'dive', first: 3, every: 6, actions: [{ type: 'formation', blocks: fast(3, 0.22) }] },
    ],
  },
  boar: {
    name: 'Boar',
    hp: 480,
    atk: 16,
    special: 20,
    interval: 0.65,
    pattern: 'YRYSGYYRYY',
    icon: 'tusk',
    sprite: 'boar',
    coins: 12,
    specials: [
      // paws the ground, then one red at double speed
      { id: 'charge', name: 'Charge!', tell: 0.8, sound: 'charge', first: 4, every: 7, actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 2 }] }] },
    ],
  },
  bandit: {
    name: 'Bandit',
    hp: 620,
    atk: 17,
    special: 22,
    interval: 0.6,
    pattern: 'YRPYGYYRYY',
    icon: 'mask',
    sprite: 'bandit',
    coins: 15,
    specials: [
      // two purple traps dropped right beside yellow blocks
      {
        id: 'smoke',
        name: 'Smoke!',
        tell: 0.7,
        sound: 'smoke',
        first: 3.5,
        every: 6.5,
        actions: [{ type: 'formation', blocks: [{ kind: 'purple', beside: 'yellow' }, { kind: 'purple', beside: 'yellow' }] }],
      },
    ],
  },
  knight: {
    name: 'Hedge Knight',
    hp: 1500,
    atk: 20,
    special: 26,
    interval: 0.6,
    pattern: 'YSYRGYYSYR',
    icon: 'leaf',
    sprite: 'knight',
    coins: 35,
    elite: true,
    specials: [
      // shield raised for 2 s: a yellow tap is countered like a purple trap (greens and blocks are safe)
      { id: 'guard', name: 'Guard!', tell: 0.8, sound: 'guard', first: 3, every: 7, actions: [{ type: 'guard', sec: 2 }] },
    ],
  },
  bigSlime: {
    name: 'Big Slime',
    hp: 1700,
    atk: 20,
    special: 26,
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
    hp: 2600,
    atk: 20,
    special: 26,
    interval: 0.6,
    pattern: 'YRBYGYYRPY',
    icon: 'crown',
    sprite: 'captain',
    coins: 60,
    boss: true,
    specials: [
      // throws a pair of bombs; at half HP whistles for two Bandits
      { id: 'bombs', name: 'Bombs away!', tell: 0.8, sound: 'bombs', first: 3, every: 7, actions: [{ type: 'formation', blocks: [{ kind: 'bomb' }, { kind: 'bomb', delay: 0.4 }] }] },
      { id: 'call', name: 'Lads, help!', tell: 1, sound: 'call', hpBelow: 0.5, actions: [{ type: 'summon', enemies: ['bandit', 'bandit'] }] },
    ],
  },

  // ---------------------------------------------------------------- Act 2, Old Ruins
  archer: {
    name: 'Goblin Archer',
    hp: 420,
    atk: 13,
    special: 18,
    interval: 0.7,
    pattern: 'YYRYGYRY',
    icon: 'arrow',
    sprite: 'archer',
    coins: 12,
    specials: [
      // three reds at once, spaced across the right half of the bar
      {
        id: 'volley',
        name: 'Volley!',
        tell: 0.9,
        sound: 'volley',
        first: 4,
        every: 7.5,
        actions: [{ type: 'formation', blocks: [{ kind: 'red', at: 0.62 }, { kind: 'red', at: 0.79 }, { kind: 'red', at: 0.96 }] }],
      },
    ],
  },
  shaman: {
    name: 'Mushroom Shaman',
    hp: 460,
    atk: 12,
    special: 18,
    interval: 0.75,
    pattern: 'YYGYRYPY',
    icon: 'spore',
    sprite: 'shaman',
    coins: 14,
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
    hp: 560,
    atk: 15,
    special: 20,
    interval: 0.75,
    pattern: 'YSYGYYRY',
    icon: 'shell',
    sprite: 'beetle',
    coins: 14,
    specials: [
      // yellow (and green) hits deal half until both shell blocks are broken
      { id: 'shell', name: 'Shell Up!', tell: 0.8, sound: 'shell', first: 2.5, every: 9, actions: [{ type: 'shell', target: 'self', mult: 0.5, blocks: 2 }] },
    ],
  },
  golem: {
    name: 'Ruin Golem',
    hp: 3400,
    atk: 24,
    special: 30,
    interval: 0.7,
    pattern: 'YSYGYYRYSY',
    icon: 'rune',
    sprite: 'golem',
    coins: 70,
    boss: true,
    specials: [
      // a huge shield block (three taps), and Stomp: the cursor freezes for half a second
      { id: 'hugeShield', name: 'Wall of Stone!', tell: 0.9, sound: 'hugeShield', first: 3, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'shield', width: 2.2, taps: 3 }] }] },
      { id: 'stomp', name: 'Stomp!', tell: 1, sound: 'stomp', first: 6.5, every: 8, actions: [{ type: 'cursor', freeze: 0.5 }] },
    ],
  },

  // ---------------------------------------------------------------- Act 3, Boar King's Hollow
  wolf: {
    name: 'Wolf',
    hp: 380,
    atk: 11,
    special: 16,
    interval: 0.75,
    pattern: 'YRYYGRY',
    icon: 'fang',
    sprite: 'wolf',
    coins: 10,
    specials: [
      // the pack's next reds come together: a pair, one from each wolf
      { id: 'howl', name: 'Howl!', tell: 0.9, sound: 'howl', first: 4, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red' }, { kind: 'red', pair: true, partner: true }] }] },
    ],
  },
  boarKing: {
    name: 'Boar King',
    hp: 5600,
    atk: 24,
    special: 30,
    interval: 0.55,
    pattern: 'YRYSRYGYFRYY',
    icon: 'crown',
    sprite: 'boarking',
    coins: 150,
    boss: true,
    phaseScenes: { 2: 'boarKing2', 3: 'boarKing3' },
    specials: [
      // phase 1 (and 2): frequent Charges
      { id: 'charge', name: 'Charge!', tell: 0.8, sound: 'charge', first: 2.5, every: 4.5, phases: [1, 2], actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 2 }] }] },
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
      // phase 3 at 33%: enraged, the cursor never drops below 1.2x, Charges come in pairs
      { id: 'enrage', name: 'ENRAGED!', tell: 1, sound: 'enrage', hpBelow: 0.33, gate: true, actions: [{ type: 'phase', phase: 3 }, { type: 'cursor', minSpeed: 1.2 }] },
      {
        id: 'doubleCharge',
        name: 'Double Charge!',
        tell: 0.8,
        sound: 'charge',
        first: 2,
        every: 4.5,
        phases: [3],
        actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 2 }, { kind: 'red', speed: 2, delay: 0.3 }] }],
      },
    ],
  },
  piglet: {
    name: 'Piglet',
    hp: 260,
    atk: 8,
    special: 12,
    interval: 0.9,
    pattern: 'YRYY',
    icon: 'tusk',
    sprite: 'piglet',
    coins: 4,
    specials: [],
  },
};
