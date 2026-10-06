// Region 3's enemies (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: this table is not merged into
// ENEMIES (src/data/enemies.ts) until the core implements the region's two bar rules, drifting blocks and linked
// pairs. Each foe's special changes how the bar plays with them: yellows that start drifting (or drift faster, or
// turn back), yellows chained into pairs (hit one, then its partner within a beat), embers that land as still reds,
// basalt crusts, glass panes (mirror shards), anvils that need three taps.
// Specials marked "needs core" use the Region 3 actions typed in src/data/types.ts (toDrift, toLink, driftShift,
// barRule driftEvery/linkEvery, formation entries with `drift`/`link`) that src/core/specials.ts doesn't run yet.
// Numbers are first guesses for the balance bot (npm run balance), a step above the Frostpeaks' foes.

import type { EnemyDef, FormationEntry } from './types';

/** `n` embers: each spot is marked on the bar, then a still red lands there and strikes after `fuse` s unless tapped. */
const embers = (n: number, fuse: number, delay: number): FormationEntry[] => Array.from({ length: n }, () => ({ kind: 'red' as const, still: true, fuse, spot: 'random' as const, delay }));

/** Two reds in a row, far enough apart that the cursor meets one at a time (tests/unit/ashfell-data.test.ts). */
const lash = (speed: number, width: number, delay: number): FormationEntry[] => [
  { kind: 'red', speed, width },
  { kind: 'red', speed, width, delay },
];

/** A heavy thing dropped where the cursor is heading: a still shield that strikes unless broken with 3 taps. */
const slab = (width: number): FormationEntry[] => [{ kind: 'shield', still: true, fuse: 3.2, taps: 3, width, spot: 'ahead' }];

/** The telegraph sounds Region 3 adds (engine/audio.ts TellSound doesn't have them yet; each needs its own wind-up). */
export const ASH_NEW_SOUNDS = ['sizzle', 'embers', 'crust', 'stampede', 'quake', 'glass', 'snip', 'kiln', 'chain', 'bark', 'lava', 'anvil', 'bellows', 'eruption'] as const;

export const ASH_ENEMIES: Record<string, EnemyDef> = {
  // ---------------------------------------------------------------- Act 1, Cinder Flats: drifting blocks
  cinderling: {
    name: 'Cinderling',
    tags: ['swarm', 'fire'],
    hp: 130,
    atk: 10,
    special: 11,
    interval: 0.7,
    pattern: 'YYRYGYRY',
    icon: 'drop',
    sprite: 'cinderling',
    coins: 6,
    specials: [
      // hops about on hot feet: two yellows start drifting for a while (needs core: toDrift)
      { id: 'hotFoot', name: 'Hot Foot!', tell: 0.8, sound: 'sizzle', first: 3, every: 8, actions: [{ type: 'toDrift', count: 2, speed: 0.07, sec: 6 }] },
    ],
  },
  cinderKite: {
    name: 'Cinder Kite',
    tags: ['flyer', 'fire'],
    hp: 105,
    atk: 9,
    special: 11,
    interval: 0.65,
    pattern: 'YRYYGYRY',
    icon: 'wing',
    sprite: 'cinderkite',
    coins: 6,
    fly: 14,
    specials: [
      // shakes embers off its wings: each spot is marked, then an ember lands there and strikes unless tapped
      { id: 'emberDrop', name: 'Ember Drop!', tell: 0.8, sound: 'embers', first: 4, every: 8, actions: [{ type: 'formation', blocks: embers(2, 1.8, 0.9) }] },
    ],
  },
  cragCrab: {
    name: 'Crag Crab',
    tags: ['armored', 'beast'],
    hp: 170,
    atk: 11,
    special: 12,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'shell',
    sprite: 'cragcrab',
    coins: 7,
    specials: [
      // flicks hot grit over two yellows: they set into basalt and take two taps (a drifting one too)
      { id: 'basaltCrust', name: 'Basalt Crust!', tell: 0.8, sound: 'crust', first: 3.5, every: 8, actions: [{ type: 'armor', count: 2, taps: 2 }] },
    ],
  },
  obsidianOx: {
    name: 'Obsidian Ox',
    tags: ['brute', 'beast'],
    hp: 600,
    atk: 14,
    special: 15,
    interval: 0.65,
    pattern: 'YRYSGYRYY',
    icon: 'tusk',
    sprite: 'obsidianox',
    coins: 24,
    elite: true,
    specials: [
      { id: 'stampede', name: 'Stampede!', tell: 0.9, sound: 'stampede', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.3, speed: 1.3 }] }] },
      // stamps the ground: every yellow on the bar slides for 4 s (needs core: toDrift)
      { id: 'quake', name: 'Quake!', tell: 0.9, sound: 'quake', first: 7, every: 9, actions: [{ type: 'toDrift', count: 0, speed: 0.08, sec: 4 }] },
    ],
  },
  rumbleback: {
    name: 'Rumbleback',
    tags: ['brute', 'armored'],
    hp: 2800,
    atk: 16,
    special: 16,
    interval: 0.6,
    pattern: 'YRYSGYRYYR',
    icon: 'shell',
    sprite: 'rumbleback',
    coins: 65,
    boss: true,
    specials: [
      // curled up and rolling: a wide red that grows as it comes
      { id: 'rollOut', name: 'Roll Out!', tell: 0.9, sound: 'stampede', first: 3, every: 6.5, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.2, speed: 1.1, grow: 0.5 }] }] },
      // his rolling shakes the road: every yellow on the bar drifts for 5 s (needs core: toDrift)
      { id: 'rumble', name: 'Rumble!', tell: 0.9, sound: 'quake', first: 6, every: 9, phases: [1], actions: [{ type: 'toDrift', count: 0, speed: 0.07, sec: 5 }] },
      // at half HP (gate): he curls into his shell (hits deal half until 3 plates break), and from now on every 2nd
      // yellow he sends drifts (needs core: barRule driftEvery)
      {
        id: 'curlUp',
        name: 'Curl Up!',
        tell: 1,
        sound: 'crust',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'shell', target: 'self', mult: 0.5, blocks: 3 },
          { type: 'barRule', holdEvery: 0, driftEvery: 2 },
        ],
      },
      // phase 2: fresh paving: three yellows crusted over (two taps each)
      { id: 'gravel', name: 'Gravel!', tell: 0.8, sound: 'crust', first: 5, every: 9, phases: [2], actions: [{ type: 'armor', count: 3, taps: 2 }] },
    ],
  },

  // ---------------------------------------------------------------- Act 2, Glass Warrens: linked pairs (some drift)
  glassblower: {
    name: 'Glassblower',
    tags: ['folk', 'caster'],
    hp: 175,
    atk: 11,
    special: 12,
    interval: 0.7,
    pattern: 'YYRYGYRYY',
    icon: 'mask',
    sprite: 'glassblower',
    coins: 7,
    specials: [
      // blows a glowing glass chain: two pairs of yellows are linked (needs core: toLink)
      { id: 'blowGlass', name: 'Blow Glass!', tell: 0.8, sound: 'glass', first: 3, every: 8, actions: [{ type: 'toLink', count: 2 }] },
    ],
  },
  prismBat: {
    name: 'Prism Bat',
    tags: ['flyer', 'beast'],
    hp: 150,
    atk: 10,
    special: 12,
    interval: 0.65,
    pattern: 'YRYYGYRY',
    icon: 'wing',
    sprite: 'prismbat',
    coins: 7,
    fly: 12,
    specials: [
      // a pane of glass where the cursor is heading (it bounces back off it), and one pair linked: the pane can
      // help finish the pair or spoil it (needs core: toLink)
      {
        id: 'prismFlash',
        name: 'Prism Flash!',
        tell: 0.9,
        sound: 'mirror',
        first: 4,
        every: 9,
        actions: [
          { type: 'mirror', at: 'ahead', life: 4 },
          { type: 'toLink', count: 1 },
        ],
      },
    ],
  },
  glassMantis: {
    name: 'Glass Mantis',
    tags: ['beast', 'armored'],
    hp: 185,
    atk: 12,
    special: 13,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'fang',
    sprite: 'glassmantis',
    coins: 7,
    specials: [
      // a linked pair, and a red right behind it: finish the pair or block the red first? (needs core: `link` entries)
      {
        id: 'scissorSnap',
        name: 'Scissor Snap!',
        tell: 0.8,
        sound: 'snip',
        first: 4,
        every: 8,
        actions: [{ type: 'formation', blocks: [{ kind: 'yellow', link: true }, { kind: 'yellow', link: true }, { kind: 'red', delay: 0.5 }] }],
      },
    ],
  },
  kilnWarden: {
    name: 'Kiln Warden',
    tags: ['construct', 'fire'],
    hp: 680,
    atk: 15,
    special: 15,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'rune',
    sprite: 'kilnwarden',
    coins: 25,
    elite: true,
    specials: [
      // its door swings open: a slab of hot glass lands where the cursor is heading (three taps before it falls)
      { id: 'kilnDoor', name: 'Kiln Door!', tell: 0.9, sound: 'kiln', first: 3, every: 9, actions: [{ type: 'formation', blocks: slab(1.2) }] },
      // three pairs of yellows fired together (needs core: toLink)
      { id: 'firing', name: 'Firing!', tell: 0.9, sound: 'glass', first: 6.5, every: 9, actions: [{ type: 'toLink', count: 3 }] },
    ],
  },
  hobnob: {
    name: 'Hob & Nob',
    tags: ['beast', 'fire'],
    hp: 3400,
    atk: 17,
    special: 17,
    interval: 0.6,
    pattern: 'YRYGYSYRYY',
    icon: 'fang',
    sprite: 'hobnob',
    coins: 75,
    boss: true,
    specials: [
      // one bite from each head, one after the other
      { id: 'doubleBite', name: 'Double Bite!', tell: 0.8, sound: 'bark', first: 3, every: 7, actions: [{ type: 'formation', blocks: lash(1.2, 1.2, 0.8) }] },
      // Nob fetches a chain: two pairs of yellows linked (needs core: toLink)
      { id: 'fetch', name: 'Fetch!', tell: 0.9, sound: 'chain', first: 6, every: 9, phases: [1], actions: [{ type: 'toLink', count: 2 }] },
      // at half HP (gate): both heads join in: from now on every 3rd yellow they send comes as a pair (needs core:
      // barRule linkEvery)
      {
        id: 'twoHeads',
        name: 'Two Heads!',
        tell: 1,
        sound: 'bark',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'barRule', holdEvery: 0, linkEvery: 3 },
        ],
      },
      // phase 2: the heads squabble and snap at anything: tapping a yellow is countered for a moment
      { id: 'squabble', name: 'Squabble!', tell: 0.9, sound: 'guard', first: 5, every: 9, phases: [2], actions: [{ type: 'guard', sec: 1.4 }] },
    ],
  },

  // ---------------------------------------------------------------- Act 3, The Black Forge: drift and pairs together
  stokerImp: {
    name: 'Stoker Imp',
    tags: ['caster', 'swarm'],
    hp: 190,
    atk: 12,
    special: 13,
    interval: 0.7,
    pattern: 'YYRYGYRY',
    icon: 'rune',
    sprite: 'stokerimp',
    coins: 8,
    specials: [
      // shovels on coal: two more yellows drift, and every drifting block speeds up for 4 s (needs core)
      {
        id: 'stoke',
        name: 'Stoke!',
        tell: 0.8,
        sound: 'sizzle',
        first: 3,
        every: 8,
        actions: [
          { type: 'toDrift', count: 2, speed: 0.06 },
          { type: 'driftShift', mult: 1.6, sec: 4 },
        ],
      },
    ],
  },
  magmaEel: {
    name: 'Magma Eel',
    tags: ['beast', 'fire'],
    hp: 230,
    atk: 13,
    special: 14,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'fang',
    sprite: 'magmaeel',
    coins: 8,
    specials: [
      // a lava wave: a yellow starts drifting, then every drifting block turns back, a little faster (needs core)
      {
        id: 'undertow',
        name: 'Undertow!',
        tell: 0.9,
        sound: 'lava',
        first: 4,
        every: 8,
        actions: [
          { type: 'toDrift', count: 1, speed: 0.07 },
          { type: 'driftShift', flip: true, mult: 1.4, sec: 3 },
        ],
      },
    ],
  },
  forgeHand: {
    name: 'Forge Hand',
    tags: ['folk', 'brute'],
    hp: 240,
    atk: 14,
    special: 14,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'mask',
    sprite: 'forgehand',
    coins: 8,
    specials: [
      // welds a pair of yellows together and sets it drifting (needs core: `link` and `drift` entries)
      { id: 'weld', name: 'Weld!', tell: 0.8, sound: 'anvil', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'yellow', link: true, drift: 0.06 }, { kind: 'yellow', link: true, drift: 0.06 }] }] },
    ],
  },
  chainSentinel: {
    name: 'Chain Sentinel',
    tags: ['construct', 'armored'],
    hp: 760,
    atk: 16,
    special: 16,
    interval: 0.65,
    pattern: 'YSYRGYYRY',
    icon: 'crown',
    sprite: 'chainsentinel',
    coins: 27,
    elite: true,
    specials: [
      { id: 'chainLash', name: 'Chain Lash!', tell: 0.9, sound: 'chain', first: 3, every: 8, actions: [{ type: 'formation', blocks: lash(1.15, 1.15, 0.85) }] },
      // two pairs of yellows shackled together, drifting as one (needs core: toLink with drift)
      { id: 'shackle', name: 'Shackle!', tell: 0.9, sound: 'chain', first: 6.5, every: 9, actions: [{ type: 'toLink', count: 2, drift: 0.06 }] },
    ],
  },
  bellows: {
    name: 'Bellows',
    tags: ['brute', 'fire'],
    hp: 6400,
    atk: 17,
    special: 17,
    interval: 0.55,
    pattern: 'YRYSRYGYRYY',
    icon: 'crown',
    sprite: 'bellows',
    coins: 170,
    boss: true,
    phaseScenes: { 2: 'bellows2', 3: 'bellows3' },
    specials: [
      // phase 1, the forge: his bellows breathe on the bar: every yellow on it drifts, and every 2nd one he sends
      // (needs core: toDrift for good, barRule driftEvery)
      {
        id: 'bellowsBlast',
        name: 'Bellows Blast!',
        tell: 0.9,
        sound: 'bellows',
        first: 0.8,
        every: 30,
        phases: [1],
        actions: [
          { type: 'toDrift', count: 0, speed: 0.06 },
          { type: 'barRule', holdEvery: 0, driftEvery: 2 },
        ],
      },
      // an anvil dropped where the cursor is heading: three taps before it lands
      { id: 'hammerfall', name: 'Hammerfall!', tell: 0.9, sound: 'anvil', first: 5, every: 9, phases: [1, 2], actions: [{ type: 'formation', blocks: slab(1.3) }] },
      // phase 2 (66%, gate), the chain: the drifting stops, and the bar turns to chains: two pairs at once, then every
      // 3rd yellow he sends (needs core: driftShift to a stop, barRule linkEvery, toLink)
      {
        id: 'chainwork',
        name: 'Chainwork!',
        tell: 1,
        sound: 'chain',
        hpBelow: 0.66,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'driftShift', mult: 0 },
          { type: 'barRule', holdEvery: 0, driftEvery: 0, linkEvery: 3 },
          { type: 'toLink', count: 2 },
        ],
      },
      { id: 'chainLash', name: 'Chain Lash!', tell: 0.8, sound: 'chain', first: 3, every: 7, phases: [2, 3], actions: [{ type: 'formation', blocks: lash(1.15, 1.15, 0.85) }] },
      // phase 3 (33%, gate), the eruption: everything drifts again, pairs too, faster, and the cursor never slows
      // below 1.3x (needs core: toDrift, barRule driftEvery + linkEvery)
      {
        id: 'eruption',
        name: 'ERUPTION!',
        tell: 1,
        sound: 'eruption',
        hpBelow: 0.33,
        gate: true,
        actions: [
          { type: 'phase', phase: 3 },
          { type: 'barRule', holdEvery: 0, driftEvery: 2, linkEvery: 3 },
          { type: 'toDrift', count: 0, speed: 0.08 },
          { type: 'cursor', minSpeed: 1.3 },
        ],
      },
      { id: 'lavaRain', name: 'Lava Rain!', tell: 0.9, sound: 'embers', first: 4, every: 8, phases: [3], actions: [{ type: 'formation', blocks: embers(3, 1.8, 0.8) }] },
    ],
  },
};
