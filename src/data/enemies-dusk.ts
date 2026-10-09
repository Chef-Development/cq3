// Region 4's enemies (SPOILERS: docs/content-bible.md section 7). NOT IN PLAY YET: this table is not merged into
// ENEMIES (src/data/enemies.ts) until the region has its art (sprites, telegraph poses, map minis) and its telegraph
// sounds. Each foe's special changes how the bar plays with them: dark shapes that land (some of them traps), yellows
// put in the dark, the lantern dimmed, the water sent rushing up (or in from the other end, or from both).
// The boss and the scene ids follow docs/story-bible.md (Lanternfen; the keystone is the last lantern, the Mirelight,
// on Mirewick's lure); the other foes' names are Team 3's. Numbers are first guesses for the balance bot, about a
// tenth above Ashfell's foes.

import type { EnemyDef, FormationEntry } from './types';

/** Two reds in a row, far enough apart that the cursor meets one at a time (as Ashfell's lash). */
const lash = (speed: number, width: number, delay: number): FormationEntry[] => [
  { kind: 'red', speed, width },
  { kind: 'red', speed, width, delay },
];

/** Dark shapes that land on free spots: `yellows` yellows and `traps` traps, none of them showing what it is until
 *  the lantern reaches it. */
const shapes = (yellows: number, traps: number): FormationEntry[] => [
  ...Array.from({ length: yellows }, () => ({ kind: 'yellow' as const, dark: true })),
  ...Array.from({ length: traps }, () => ({ kind: 'purple' as const, dark: true })),
];

/** Something heavy dropped where the cursor is heading: a still shield that strikes unless broken with 3 taps. */
const dam = (width: number): FormationEntry[] => [{ kind: 'shield', still: true, fuse: 3.2, taps: 3, width, spot: 'ahead' }];

/** The telegraph sounds Region 4 adds (engine/audio.ts TellSound doesn't have them yet; each needs its own wind-up). */
export const DUSK_NEW_SOUNDS = ['lure', 'gulp', 'rustle', 'splash', 'snuff', 'undertow', 'flutter', 'fog', 'floodgate', 'sluice', 'redraw'] as const;

export const DUSK_ENEMIES: Record<string, EnemyDef> = {
  // ---------------------------------------------------------------- Act 1, Lanternfen: dark blocks
  bogWisp: {
    name: 'Bog Wisp',
    tags: ['flyer', 'caster'],
    hp: 120,
    atk: 10,
    special: 13,
    interval: 0.65,
    pattern: 'YRYYGYRY',
    icon: 'spore',
    sprite: 'bogwisp',
    coins: 7,
    fly: 14,
    specials: [
      // a light bobbing over the water, and something that looks like a yellow under it: one is, one is a trap
      { id: 'lure', name: 'Lure!', tell: 0.8, sound: 'lure', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: shapes(1, 1) }] },
    ],
  },
  mireToad: {
    name: 'Mire Toad',
    tags: ['beast', 'swarm'],
    hp: 150,
    atk: 11,
    special: 12,
    interval: 0.7,
    pattern: 'YYRYGYRY',
    icon: 'drop',
    sprite: 'miretoad',
    coins: 7,
    specials: [
      // swallows the light: the lantern burns low for a while (and what it lit beyond its glow goes dark again)
      { id: 'gulp', name: 'Gulp!', tell: 0.8, sound: 'gulp', first: 4, every: 9, actions: [{ type: 'snuff', mult: 0.65, sec: 4 }] },
    ],
  },
  reedling: {
    name: 'Reedling',
    tags: ['folk', 'swarm'],
    hp: 185,
    atk: 12,
    special: 12,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'leaf',
    sprite: 'reedling',
    coins: 8,
    specials: [
      // rustles the reeds over the far yellows: three of them go dark (they stay yellows)
      { id: 'rustle', name: 'Rustle!', tell: 0.8, sound: 'rustle', first: 3, every: 8, actions: [{ type: 'darken', count: 3 }] },
    ],
  },
  peatGolem: {
    name: 'Peat Golem',
    tags: ['construct', 'brute'],
    hp: 660,
    atk: 15,
    special: 16,
    interval: 0.65,
    pattern: 'YRYSGYRYY',
    icon: 'shell',
    sprite: 'peatgolem',
    coins: 26,
    elite: true,
    specials: [
      { id: 'peatSlam', name: 'Peat Slam!', tell: 0.9, sound: 'stomp', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.4, speed: 0.85 }] }] },
      // its caged heart gutters: the lantern burns low, and two traps land in the dark
      {
        id: 'smother',
        name: 'Smother!',
        tell: 0.9,
        sound: 'snuff',
        first: 7,
        every: 10,
        actions: [
          { type: 'snuff', mult: 0.6, sec: 5 },
          { type: 'formation', blocks: shapes(0, 2) },
        ],
      },
    ],
  },
  motherMoth: {
    name: 'Mother Moth',
    tags: ['beast', 'flyer'],
    hp: 3500,
    atk: 20,
    special: 17,
    interval: 0.6,
    pattern: 'YRYSGYRYYR',
    icon: 'wing',
    sprite: 'mothermoth',
    coins: 70,
    boss: true,
    fly: 10,
    specials: [
      // a moth the size of a sail, starving since the lanterns went out: she beats her wings at your light
      { id: 'wingbeat', name: 'Wingbeat!', tell: 0.9, sound: 'flutter', first: 4, every: 9, phases: [1], actions: [{ type: 'snuff', mult: 0.6, sec: 4 }] },
      { id: 'dive', name: 'Moth Dive!', tell: 0.8, sound: 'dive', first: 6, every: 7, actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.5, width: 1.2 }] }] },
      // at half HP (gate): her brood comes for the light, and from now on every 2nd yellow she sends is dark
      {
        id: 'brood',
        name: 'Brood!',
        tell: 1,
        sound: 'flutter',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'barRule', holdEvery: 0, darkEvery: 2 },
          { type: 'summon', enemies: ['duskMoths'], link: true },
        ],
      },
      // phase 2: wing dust: three dark shapes, one a trap
      { id: 'wingDust', name: 'Wing Dust!', tell: 0.9, sound: 'fog', first: 4, every: 9, phases: [2], actions: [{ type: 'formation', blocks: shapes(2, 1) }] },
    ],
  },

  // ---------------------------------------------------------------- Act 2, the Drowned Causeway: tides (a little dark)
  mudskipper: {
    name: 'Mudskipper',
    tags: ['beast', 'swarm'],
    hp: 165,
    atk: 11,
    special: 12,
    interval: 0.7,
    pattern: 'YYRYGYRYY',
    icon: 'fang',
    sprite: 'mudskipper',
    coins: 8,
    specials: [
      // a belly-flop into the shallows: the water rushes up the bar for a few seconds
      { id: 'splash', name: 'Splash!', tell: 0.8, sound: 'splash', first: 4, every: 9, actions: [{ type: 'tide', level: 0.45, sec: 3 }] },
    ],
  },
  stiltHeron: {
    name: 'Stilt Heron',
    tags: ['flyer', 'folk'],
    hp: 170,
    atk: 12,
    special: 12,
    interval: 0.65,
    pattern: 'YRYYGYRY',
    icon: 'arrow',
    sprite: 'stiltheron',
    coins: 8,
    specials: [
      // two jabs of the punt-pole, one behind the other (the first wades in through the water)
      { id: 'spearDive', name: 'Spear Dive!', tell: 0.8, sound: 'dive', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: lash(1.25, 1.1, 0.8) }] },
    ],
  },
  lamplighter: {
    name: 'Lamplighter',
    tags: ['folk', 'caster'],
    hp: 205,
    atk: 13,
    special: 13,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'mask',
    sprite: 'lamplighter',
    coins: 9,
    specials: [
      // snuffs the street lamps: every yellow beyond your light goes dark, and two more land in the dark
      {
        id: 'snuffOut',
        name: 'Snuff Out!',
        tell: 0.9,
        sound: 'snuff',
        first: 4,
        every: 9,
        actions: [
          { type: 'darken', count: 0 },
          { type: 'formation', blocks: shapes(2, 0) },
        ],
      },
    ],
  },
  oldSnapper: {
    name: 'Old Snapper',
    tags: ['armored', 'beast'],
    hp: 750,
    atk: 16,
    special: 16,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'shell',
    sprite: 'oldsnapper',
    coins: 28,
    elite: true,
    specials: [
      // it surfaces like an island: the water comes in from both ends at once
      { id: 'highTide', name: 'High Tide!', tell: 0.9, sound: 'floodgate', first: 4, every: 10, actions: [{ type: 'tide', level: 0.25, sec: 4, from: 'both' }] },
      { id: 'snap', name: 'Snap!', tell: 0.8, sound: 'charge', first: 7, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.3, speed: 1.4 }] }] },
    ],
  },
  sluiceKeeper: {
    name: 'The Sluice Keeper',
    tags: ['construct', 'folk'],
    hp: 3100,
    atk: 18,
    special: 17,
    interval: 0.6,
    pattern: 'YRYGYSYRYY',
    icon: 'rune',
    sprite: 'sluicekeeper',
    coins: 70,
    boss: true,
    specials: [
      // on the timetable: the floodgates open, the water rushes up the bar
      { id: 'openGates', name: 'Open the Gates!', tell: 0.9, sound: 'sluice', first: 4, every: 9, phases: [1], actions: [{ type: 'tide', level: 0.5, sec: 4 }] },
      // a dam where the cursor is heading: three taps before it bursts
      { id: 'damUp', name: 'Dam Up!', tell: 0.9, sound: 'anvil', first: 6.5, every: 9, actions: [{ type: 'formation', blocks: dam(1.3) }] },
      // at half HP (gate): the spillway: water from both ends, for good
      {
        id: 'spillway',
        name: 'Spillway!',
        tell: 1,
        sound: 'sluice',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'tide', level: 0.25, sec: 0, from: 'both' },
        ],
      },
      // phase 2: overtime: two reds, one after the other
      { id: 'overtime', name: 'Overtime!', tell: 0.8, sound: 'chain', first: 3, every: 7, phases: [2], actions: [{ type: 'formation', blocks: lash(1.15, 1.1, 0.85) }] },
    ],
  },

  // ---------------------------------------------------------------- Act 3, the Gloaming Mere: dark and tides
  inkEel: {
    name: 'Ink Eel',
    tags: ['beast', 'caster'],
    hp: 210,
    atk: 13,
    special: 14,
    interval: 0.7,
    pattern: 'YYRYGYRYY',
    icon: 'fang',
    sprite: 'inkeel',
    coins: 9,
    specials: [
      // pulls the water round: it floods in from the other end for a while
      { id: 'undertow', name: 'Undertow!', tell: 0.8, sound: 'undertow', first: 4, every: 9, actions: [{ type: 'tide', level: 0.4, sec: 4, from: 'left' }] },
    ],
  },
  duskMoths: {
    name: 'Dusk Moths',
    tags: ['swarm', 'flyer'],
    hp: 240,
    atk: 14,
    special: 14,
    interval: 0.7,
    pattern: 'YRYSGYYRY',
    icon: 'wing',
    sprite: 'duskmoths',
    coins: 10,
    fly: 12,
    specials: [
      // they mob your lantern: it burns low, and two traps land in the dark
      {
        id: 'flutter',
        name: 'Flutter!',
        tell: 0.8,
        sound: 'flutter',
        first: 3.5,
        every: 9,
        actions: [
          { type: 'snuff', mult: 0.6, sec: 4 },
          { type: 'formation', blocks: shapes(0, 2) },
        ],
      },
    ],
  },
  bogHag: {
    name: 'Bog Hag',
    tags: ['caster', 'folk'],
    hp: 265,
    atk: 15,
    special: 15,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'mask',
    sprite: 'boghag',
    coins: 10,
    specials: [
      // a fog off her kettle: three dark shapes (one a trap), and the lantern burns a little low
      {
        id: 'fogBank',
        name: 'Fog Bank!',
        tell: 0.9,
        sound: 'fog',
        first: 4,
        every: 9,
        actions: [
          { type: 'formation', blocks: shapes(2, 1) },
          { type: 'snuff', mult: 0.7, sec: 3 },
        ],
      },
    ],
  },
  sunkenSentinel: {
    name: 'Sunken Sentinel',
    tags: ['construct', 'armored'],
    hp: 840,
    atk: 17,
    special: 17,
    interval: 0.65,
    pattern: 'YSYRGYYRY',
    icon: 'crown',
    sprite: 'sunkensentinel',
    coins: 30,
    elite: true,
    specials: [
      { id: 'floodgate', name: 'Floodgate!', tell: 0.9, sound: 'floodgate', first: 3.5, every: 9, actions: [{ type: 'tide', level: 0.5, sec: 4 }] },
      // black water: two traps in the dark, and a still red marked where it will land
      {
        id: 'blackwater',
        name: 'Blackwater!',
        tell: 0.9,
        sound: 'fog',
        first: 7,
        every: 10,
        actions: [{ type: 'formation', blocks: [...shapes(0, 2), { kind: 'red', still: true, fuse: 1.8, spot: 'random', delay: 0.9 }] }],
      },
    ],
  },
  mirewick: {
    name: 'Mirewick',
    tags: ['beast', 'armored'],
    hp: 8400,
    atk: 20,
    special: 18,
    interval: 0.55,
    pattern: 'YRYSRYGYRYY',
    icon: 'crown',
    sprite: 'mirewick',
    coins: 185,
    boss: true,
    phaseScenes: { 2: 'fenBoss2', 3: 'fenBoss3' },
    specials: [
      // phase 1: the Mirelight sways on its lure: shapes in the dark below it, one a trap
      { id: 'lure', name: 'Lure!', tell: 0.9, sound: 'lure', first: 3, every: 9, phases: [1], actions: [{ type: 'formation', blocks: shapes(1, 2) }] },
      { id: 'snapJaws', name: 'Snap Jaws!', tell: 0.8, sound: 'charge', first: 6, every: 7, actions: [{ type: 'formation', blocks: lash(1.2, 1.1, 0.85) }] },
      // phase 2 (66%, gate), the Mapmaker's first edit, "The tide comes in.": water from both ends for good, and the
      // tide surging on top of it
      {
        id: 'tideIn',
        name: 'Tide Comes In!',
        tell: 1,
        sound: 'redraw',
        hpBelow: 0.66,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'tide', level: 0.22, sec: 0, from: 'both' },
        ],
      },
      { id: 'surge', name: 'Surge!', tell: 0.9, sound: 'splash', first: 4, every: 7, phases: [2], actions: [{ type: 'tide', level: 0.45, sec: 3 }] },
      // phase 3 (33%, gate), the second edit, "Lights out.": he snuffs the lure: every yellow beyond your light goes
      // dark, the lantern burns low for good, every yellow it sends comes dark, and the cursor never slows below 1.3x
      {
        id: 'lightsOut',
        name: 'Lights Out!',
        tell: 1,
        sound: 'redraw',
        hpBelow: 0.33,
        gate: true,
        actions: [
          { type: 'phase', phase: 3 },
          { type: 'darken', count: 0 },
          { type: 'snuff', mult: 0.7, sec: 0 },
          { type: 'barRule', holdEvery: 0, darkEvery: 1 },
          { type: 'cursor', minSpeed: 1.3 },
        ],
      },
      { id: 'blackwater', name: 'Blackwater!', tell: 0.9, sound: 'fog', first: 4, every: 9, phases: [3], actions: [{ type: 'formation', blocks: [...shapes(0, 2), { kind: 'red', still: true, fuse: 1.8, spot: 'random', delay: 0.9 }] }] },
    ],
  },
};
