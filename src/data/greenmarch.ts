// Region 1, Greenmarch: three acts, each a branching node map (src/core/map.ts builds it from these rules)
// that ends in a mini-boss (acts 1 and 2) or the boss (act 3). Enemy HP and attack scale per act (the tuning
// panel edits a live copy of hpMult / atkMult under "Act").

import type { RegionDef } from './types';

export const GREENMARCH: RegionDef = {
  name: 'Greenmarch',
  introScene: 'intro',
  victoryScene: 'victory',
  acts: [
    {
      name: 'Meadow Road',
      theme: 'forest',
      hpMult: 1,
      atkMult: 1,
      pace: 1.1,
      rows: 7,
      waves: { first: 2, last: 4, eliteEscort: 1 },
      fights: {
        early: [['slime'], ['crow'], ['boar']],
        late: [['bandit'], ['slime', 'crow'], ['boar', 'slime'], ['bandit', 'crow']],
      },
      elites: [['bigSlime'], ['knight']],
      boss: ['captain'],
      startScene: 'act1',
      bossScene: 'captain',
      weights: { fight: 0.46, elite: 0.1, treasure: 0.1, rest: 0.1, shop: 0.1, event: 0.14 },
    },
    {
      name: 'Old Ruins',
      theme: 'ruins',
      hpMult: 2.07,
      atkMult: 4.6,
      pace: 0.85,
      rows: 7,
      waves: { first: 3, last: 5, eliteEscort: 2 },
      fights: {
        early: [['archer'], ['beetle'], ['shaman', 'slime']],
        late: [['beetle', 'archer'], ['shaman', 'bandit'], ['crow', 'archer'], ['beetle', 'shaman']],
      },
      elites: [['knight', 'archer'], ['bigSlime', 'shaman']],
      boss: ['golem'],
      startScene: 'act2',
      bossScene: 'golem',
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
    {
      name: "Boar King's Hollow",
      theme: 'hollow',
      hpMult: 3.1,
      atkMult: 8.9,
      pace: 0.75,
      rows: 7,
      waves: { first: 3, last: 6, eliteEscort: 2 },
      fights: {
        early: [['wolf', 'wolf'], ['boar', 'crow'], ['shaman', 'boar']],
        late: [['wolf', 'wolf', 'archer'], ['beetle', 'boar'], ['boar', 'bandit'], ['wolf', 'wolf', 'shaman']],
      },
      elites: [['knight', 'wolf'], ['bigSlime', 'boar']],
      boss: ['boarKing'],
      startScene: 'act3',
      bossScene: 'boarKing',
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
  ],
};
