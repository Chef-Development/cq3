// The revised bosses (SPOILERS: docs/content-bible.md section 9; src/data/remixes.ts). Each is the boss you beat, with
// the same moves, and one more phase: the Mapmaker's edit, a later region's bar rule turned on him. Their base stats
// match the originals'; a remix fights at the numbers of the furthest act reached (times tuning.remix).

import type { EnemyDef } from './types';

export const REMIX_ENEMIES: Record<string, EnemyDef> = {
  // The Boar King, revised: his three phases as before (Charges; piglets at 66% and half damage while they live; the
  // enrage at 40%), then at 20% the Mapmaker inks out the light: the lantern burns low for good, every 2nd yellow he
  // sends comes dark, and his Charges come in pairs out of the dark.
  boarKingRevised: {
    name: 'Boar King, Revised',
    tags: ['beast', 'brute'],
    hp: 4800,
    atk: 15,
    special: 20,
    interval: 0.55,
    pattern: 'YRYSRYGYFRYY',
    icon: 'crown',
    sprite: 'boarking',
    coins: 200,
    boss: true,
    specials: [
      { id: 'charge', name: 'Charge!', tell: 0.8, sound: 'charge', first: 2.5, every: 5, phases: [1, 2], actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.6, width: 1.25 }] }] },
      {
        id: 'piglets',
        name: 'To me, piglets!',
        tell: 1,
        sound: 'phase',
        hpBelow: 0.66,
        gate: true,
        actions: [{ type: 'phase', phase: 2 }, { type: 'summon', enemies: ['piglet', 'piglet'], link: true }, { type: 'protect', mult: 0.5 }],
      },
      { id: 'enrage', name: 'ENRAGED!', tell: 1, sound: 'enrage', hpBelow: 0.4, gate: true, actions: [{ type: 'phase', phase: 3 }, { type: 'cursor', minSpeed: 1.2 }] },
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
      // phase 4 at 20% (gate): the Mapmaker's edit, the light inked out
      {
        id: 'inkedOut',
        name: 'Inked Out!',
        tell: 1,
        sound: 'enrage',
        hpBelow: 0.2,
        gate: true,
        actions: [{ type: 'phase', phase: 4 }, { type: 'snuff', mult: 0.7, sec: 0 }, { type: 'darken', count: 0 }, { type: 'barRule', holdEvery: 0, darkEvery: 2 }],
      },
      {
        id: 'darkCharge',
        name: 'Charge from the Dark!',
        tell: 0.8,
        sound: 'charge',
        first: 2,
        every: 5,
        phases: [4],
        actions: [{ type: 'formation', blocks: [{ kind: 'red', speed: 1.6, width: 1.25 }, { kind: 'yellow', dark: true }, { kind: 'purple', dark: true }, { kind: 'red', speed: 1.6, width: 1.25, delay: 0.6 }] }],
      },
    ],
  },
};
