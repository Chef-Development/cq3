// Region 5's enemies (SPOILERS: docs/content-bible.md section 8; the story: docs/story-bible.md, "Noonspire"). NOT IN
// PLAY YET: not merged into ENEMIES until the region has its art and its telegraph sounds. Each foe's special changes
// how the bar plays with them: yellows that turn to mirages (they hop to a ghost spot shown first), yellows that
// blaze (they hit harder but give the hero Heat), and the boss, the Gnomon, whose phases are the Mapmaker's edits (the
// glare turned on the fight; the sun drawn down, low and huge). Numbers are first guesses for the balance bot, a step
// above Lanternfen's foes.

import type { EnemyDef, FormationEntry } from './types';

/** Two reds in a row, far enough apart that the cursor meets one at a time. */
const lash = (speed: number, width: number, delay: number): FormationEntry[] => [
  { kind: 'red', speed, width },
  { kind: 'red', speed, width, delay },
];

/** The telegraph sounds Region 5 adds (engine/audio.ts TellSound doesn't have them yet). */
export const NOON_NEW_SOUNDS = ['skitter', 'shimmer2', 'sunflash', 'scorch', 'roar', 'needle', 'glare', 'heatwave'] as const;

export const NOON_ENEMIES: Record<string, EnemyDef> = {
  // ---------------------------------------------------------------- Act 1, the White Road: mirages
  duneSkink: {
    name: 'Dune Skink',
    tags: ['beast', 'swarm'],
    hp: 135,
    atk: 11,
    special: 13,
    interval: 0.65,
    pattern: 'YYRYGYRY',
    icon: 'fang',
    sprite: 'duneskink',
    coins: 8,
    specials: [
      // skitters across the hot sand: two yellows turn to mirages (their ghost spots show first)
      { id: 'skitter', name: 'Skitter!', tell: 0.8, sound: 'skitter', first: 3.5, every: 8, actions: [{ type: 'hop', count: 2 }] },
    ],
  },
  glareHawk: {
    name: 'Glare Hawk',
    tags: ['flyer', 'beast'],
    hp: 125,
    atk: 11,
    special: 12,
    interval: 0.65,
    pattern: 'YRYYGYRY',
    icon: 'wing',
    sprite: 'glarehawk',
    coins: 8,
    fly: 14,
    specials: [{ id: 'sunDive', name: 'Sun Dive!', tell: 0.8, sound: 'dive', first: 4, every: 8, actions: [{ type: 'formation', blocks: lash(1.25, 1.1, 0.8) }] }],
  },
  duneBandit: {
    name: 'Dune Bandit',
    tags: ['folk', 'caster'],
    hp: 200,
    atk: 13,
    special: 13,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'mask',
    sprite: 'dunebandit',
    coins: 9,
    specials: [
      // a mirror-glass trick: two mirage yellows land beside the real ones
      { id: 'mirrorTrick', name: 'Mirror Trick!', tell: 0.8, sound: 'shimmer2', first: 3, every: 9, actions: [{ type: 'formation', blocks: [{ kind: 'yellow', mirage: true }, { kind: 'yellow', mirage: true }] }] },
    ],
  },
  duneColossus: {
    name: 'Dune Colossus',
    tags: ['construct', 'brute'],
    hp: 720,
    atk: 16,
    special: 17,
    interval: 0.65,
    pattern: 'YRYSGYRYY',
    icon: 'shell',
    sprite: 'dunecolossus',
    coins: 28,
    elite: true,
    specials: [
      { id: 'sandslide', name: 'Sandslide!', tell: 0.9, sound: 'stomp', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.4, speed: 0.85 }] }] },
      // the heat haze off its back: every yellow on the bar turns to a mirage
      { id: 'haze', name: 'Haze!', tell: 0.9, sound: 'shimmer2', first: 7, every: 10, actions: [{ type: 'hop', count: 0 }] },
    ],
  },
  sphinx: {
    name: 'The Noon Sphinx',
    tags: ['beast', 'caster'],
    hp: 3800,
    atk: 21,
    special: 18,
    interval: 0.6,
    pattern: 'YRYSGYRYYR',
    icon: 'crown',
    sprite: 'sphinx',
    coins: 75,
    boss: true,
    specials: [
      // she guards the road with riddles of light: every yellow turns to a mirage
      { id: 'riddle', name: 'Riddle!', tell: 0.9, sound: 'shimmer2', first: 4, every: 9, phases: [1], actions: [{ type: 'hop', count: 0 }] },
      { id: 'pounce', name: 'Pounce!', tell: 0.8, sound: 'charge', first: 6, every: 7, actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.5, width: 1.2 }] }] },
      // at half HP (gate): her eyes catch the sun: from then on every 2nd yellow she sends blazes
      {
        id: 'sunEyes',
        name: 'Sun Eyes!',
        tell: 1,
        sound: 'sunflash',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'barRule', holdEvery: 0, blazeEvery: 2 },
        ],
      },
      // phase 2: mirages that blaze
      { id: 'lastRiddle', name: 'Last Riddle!', tell: 0.9, sound: 'shimmer2', first: 4, every: 9, phases: [2], actions: [{ type: 'formation', blocks: [{ kind: 'yellow', mirage: true, blaze: true }, { kind: 'yellow', mirage: true }] }] },
    ],
  },

  // ---------------------------------------------------------------- Act 2, the Spire Steps: heat (a few mirages)
  emberScarab: {
    name: 'Ember Scarab',
    tags: ['swarm', 'beast'],
    hp: 180,
    atk: 12,
    special: 13,
    interval: 0.7,
    pattern: 'YYRYGYRYY',
    icon: 'shell',
    sprite: 'emberscarab',
    coins: 9,
    specials: [
      // rolls a ball of sun-hot dung across two yellows: they blaze
      { id: 'scorch', name: 'Scorch!', tell: 0.8, sound: 'scorch', first: 3.5, every: 8, actions: [{ type: 'blaze', count: 2 }] },
    ],
  },
  brassSentry: {
    name: 'Brass Sentry',
    tags: ['construct', 'armored'],
    hp: 230,
    atk: 13,
    special: 14,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'rune',
    sprite: 'brasssentry',
    coins: 10,
    specials: [
      // flashes the sun off its brass: three yellows blaze, and a red comes in behind the glare
      {
        id: 'sunflash',
        name: 'Sunflash!',
        tell: 0.9,
        sound: 'sunflash',
        first: 4,
        every: 9,
        actions: [
          { type: 'blaze', count: 3 },
          { type: 'formation', blocks: [{ kind: 'red', delay: 0.6 }] },
        ],
      },
    ],
  },
  sandSalamander: {
    name: 'Sand Salamander',
    tags: ['beast', 'fire'],
    hp: 190,
    atk: 13,
    special: 13,
    interval: 0.7,
    pattern: 'YRYYGYRY',
    icon: 'drop',
    sprite: 'sandsalamander',
    coins: 9,
    specials: [
      // basking: from now on every 3rd yellow it sends blazes
      { id: 'bask', name: 'Bask!', tell: 0.8, sound: 'scorch', first: 2.5, every: 30, actions: [{ type: 'barRule', holdEvery: 0, blazeEvery: 3 }] },
    ],
  },
  sunforgedGolem: {
    name: 'Sunforged Golem',
    tags: ['construct', 'brute'],
    hp: 820,
    atk: 17,
    special: 18,
    interval: 0.65,
    pattern: 'YRYSGYYRY',
    icon: 'shell',
    sprite: 'sunforgedgolem',
    coins: 30,
    elite: true,
    specials: [
      { id: 'searingSlam', name: 'Searing Slam!', tell: 0.9, sound: 'stomp', first: 3.5, every: 8, actions: [{ type: 'formation', blocks: [{ kind: 'red', width: 1.3, speed: 1.3 }] }] },
      // its kiln-heart roars: every yellow on the bar blazes
      { id: 'kilnHeart', name: 'Kiln Heart!', tell: 0.9, sound: 'heatwave', first: 7, every: 10, actions: [{ type: 'blaze', count: 0 }] },
    ],
  },
  brassLion: {
    name: 'The Brass Lion',
    tags: ['construct', 'beast'],
    hp: 3400,
    atk: 20,
    special: 18,
    interval: 0.6,
    pattern: 'YRYGYSYRYY',
    icon: 'crown',
    sprite: 'brasslion',
    coins: 75,
    boss: true,
    specials: [
      // the lion that guards the spire stairs, its mane hot brass: a roar sets three yellows blazing
      { id: 'roar', name: 'Roar!', tell: 0.9, sound: 'roar', first: 4, every: 9, phases: [1], actions: [{ type: 'blaze', count: 3 }] },
      { id: 'maul', name: 'Maul!', tell: 0.8, sound: 'charge', first: 6, every: 7, actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.3, width: 1.2 }] }] },
      // at half HP (gate): it overheats: every 2nd yellow it sends blazes, and the shimmer off it makes mirages
      {
        id: 'overheat',
        name: 'Overheat!',
        tell: 1,
        sound: 'heatwave',
        hpBelow: 0.5,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'barRule', holdEvery: 0, blazeEvery: 2 },
        ],
      },
      { id: 'shimmerOff', name: 'Shimmer!', tell: 0.9, sound: 'shimmer2', first: 4, every: 9, phases: [2], actions: [{ type: 'hop', count: 3 }] },
    ],
  },

  // ---------------------------------------------------------------- Act 3, the Great Sundial: mirages and heat
  dialWarden: {
    name: 'Dial Warden',
    tags: ['folk', 'armored'],
    hp: 255,
    atk: 15,
    special: 15,
    interval: 0.7,
    pattern: 'YSYRGYYRY',
    icon: 'mask',
    sprite: 'dialwarden',
    coins: 10,
    specials: [
      // turns a hand-mirror on the bar: two yellows blaze and turn to mirages
      {
        id: 'handMirror',
        name: 'Hand Mirror!',
        tell: 0.9,
        sound: 'glare',
        first: 4,
        every: 9,
        actions: [
          { type: 'blaze', count: 2 },
          { type: 'hop', count: 2 },
        ],
      },
    ],
  },
  heatDjinn: {
    name: 'Heat Djinn',
    tags: ['caster', 'flyer'],
    hp: 230,
    atk: 14,
    special: 15,
    interval: 0.7,
    pattern: 'YRYYGYRYY',
    icon: 'spore',
    sprite: 'heatdjinn',
    coins: 10,
    fly: 12,
    specials: [{ id: 'haze', name: 'Haze!', tell: 0.8, sound: 'shimmer2', first: 3.5, every: 8, actions: [{ type: 'hop', count: 0 }] }],
  },
  sunVulture: {
    name: 'Sun Vulture',
    tags: ['flyer', 'swarm'],
    hp: 245,
    atk: 15,
    special: 15,
    interval: 0.65,
    pattern: 'YRYSGYRY',
    icon: 'wing',
    sprite: 'sunvulture',
    coins: 10,
    fly: 16,
    specials: [{ id: 'circle', name: 'Circle!', tell: 0.8, sound: 'dive', first: 4, every: 8, actions: [{ type: 'formation', blocks: lash(1.2, 1.1, 0.85) }] }],
  },
  noonKnight: {
    name: 'Noon Knight',
    tags: ['construct', 'armored'],
    hp: 900,
    atk: 18,
    special: 18,
    interval: 0.65,
    pattern: 'YSYRGYYRY',
    icon: 'crown',
    sprite: 'noonknight',
    coins: 32,
    elite: true,
    specials: [
      { id: 'noonBlade', name: 'Noon Blade!', tell: 0.9, sound: 'chain', first: 3, every: 8, actions: [{ type: 'formation', blocks: lash(1.15, 1.15, 0.85) }] },
      // its polished shield: every yellow on the bar blazes and two turn to mirages
      {
        id: 'mirrorShield',
        name: 'Mirror Shield!',
        tell: 0.9,
        sound: 'glare',
        first: 6.5,
        every: 10,
        actions: [
          { type: 'blaze', count: 0 },
          { type: 'hop', count: 2 },
        ],
      },
    ],
  },
  gnomon: {
    name: 'The Gnomon',
    tags: ['construct', 'armored'],
    hp: 9400,
    atk: 21,
    special: 19,
    interval: 0.55,
    pattern: 'YRYSRYGYRYY',
    icon: 'crown',
    sprite: 'gnomon',
    coins: 200,
    boss: true,
    phaseScenes: { 2: 'noonBoss2', 3: 'noonBoss3' },
    specials: [
      // phase 1, the needle: its point comes down where the cursor is heading (a still shield, 3 taps), and its
      // brass face throws mirages across the bar
      { id: 'noonStrike', name: 'Noon Strike!', tell: 0.9, sound: 'needle', first: 5, every: 9, phases: [1, 2], actions: [{ type: 'formation', blocks: [{ kind: 'shield', still: true, fuse: 3.2, taps: 3, width: 1.3, spot: 'ahead' }] }] },
      { id: 'brassFace', name: 'Brass Face!', tell: 0.9, sound: 'shimmer2', first: 3, every: 9, phases: [1], actions: [{ type: 'hop', count: 3 }] },
      // phase 2 (66%, gate), the Mapmaker's first edit, "Too bright to see?": the glare turned on the fight: every
      // yellow blazes, and every 2nd yellow it sends
      {
        id: 'glare',
        name: 'Glare!',
        tell: 1,
        sound: 'glare',
        hpBelow: 0.66,
        gate: true,
        actions: [
          { type: 'phase', phase: 2 },
          { type: 'blaze', count: 0 },
          { type: 'barRule', holdEvery: 0, blazeEvery: 2 },
        ],
      },
      { id: 'sunLance', name: 'Sun Lance!', tell: 0.8, sound: 'charge', first: 4, every: 7, phases: [2, 3], actions: [{ type: 'formation', blocks: lash(1.2, 1.15, 0.85) }] },
      // phase 3 (33%, gate), the second edit, "Closer, then.": the sun drawn down, low and huge: everything shimmers
      // (every yellow a mirage), the blaze stays, and the cursor never slows below 1.3x
      {
        id: 'sunDown',
        name: 'Sun Drawn Down!',
        tell: 1,
        sound: 'heatwave',
        hpBelow: 0.33,
        gate: true,
        actions: [
          { type: 'phase', phase: 3 },
          { type: 'hop', count: 0 },
          { type: 'cursor', minSpeed: 1.3 },
        ],
      },
      { id: 'heatwave', name: 'Heatwave!', tell: 0.9, sound: 'heatwave', first: 4, every: 8, phases: [3], actions: [{ type: 'hop', count: 0 }, { type: 'blaze', count: 3 }] },
    ],
  },
};
