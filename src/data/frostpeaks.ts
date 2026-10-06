// Region 2 (SPOILERS: docs/content-bible.md): three acts like Greenmarch's, each a branching node map ending in a
// mini-boss (acts 1 and 2) or the boss (act 3), with the region's bar rules brought in gradually: ice patches from
// Act 1's second row, holds from Act 2, and in Act 3 both plus snowdrifts. Acts are numbered globally: these are acts
// 3-5 (core/regions in src/data/regions.ts).

import type { RegionDef } from './types';

export const FROSTPEAKS: RegionDef = {
  id: 'frostpeaks',
  name: 'Frostpeaks',
  introScene: '',
  victoryScene: 'frostVictory',
  acts: [
    {
      name: 'Frostbite Pass',
      theme: 'pass',
      hpMult: 2.6,
      atkMult: 7,
      pace: 0.85,
      redSpeed: 1.1,
      rows: 7,
      waves: { first: 2, last: 5, eliteEscort: 1 },
      fights: {
        early: [['rimeImp'], ['yetiCub'], ['icicleBat']],
        late: [['rimeImp', 'yetiCub'], ['icicleBat', 'icicleBat'], ['yetiCub', 'icicleBat'], ['rimeImp', 'icicleBat']],
      },
      elites: [['snowOgre'], ['snowOgre', 'icicleBat']],
      boss: ['rimehorn'],
      startScene: 'frost1',
      bossScene: 'rimehorn',
      packs: [
        [['yetiCub'], ['rimeImp', 'icicleBat']],
        [['icicleBat', 'icicleBat'], ['yetiCub', 'rimeImp']],
      ],
      bar: { ice: { every: 7, width: 0.2, life: 6, fromRow: 2, max: 1 } },
      weights: { fight: 0.46, elite: 0.1, treasure: 0.1, rest: 0.1, shop: 0.1, event: 0.14 },
    },
    {
      name: 'Glimmer Caves',
      theme: 'caves',
      hpMult: 3.4,
      atkMult: 8.5,
      pace: 0.8,
      redSpeed: 1.12,
      rows: 7,
      waves: { first: 3, last: 5, eliteEscort: 2 },
      fights: {
        early: [['frostWeaver'], ['iceWraith'], ['hailcaller', 'rimeImp']],
        late: [['frostWeaver', 'iceWraith'], ['hailcaller', 'yetiCub'], ['iceWraith', 'icicleBat'], ['frostWeaver', 'hailcaller']],
      },
      elites: [['glacierTortoise'], ['glacierTortoise', 'iceWraith']],
      boss: ['matron'],
      startScene: 'frost2',
      bossScene: 'matron',
      packs: [
        [['frostWeaver'], ['hailcaller', 'iceWraith']],
        [['iceWraith', 'icicleBat'], ['frostWeaver', 'yetiCub']],
      ],
      bar: { ice: { every: 10, width: 0.18, life: 6, fromRow: 0, max: 1 }, holds: { share: 0.12, fromRow: 1, width: 1 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
    {
      name: "Wyrm's Glacier",
      theme: 'glacier',
      hpMult: 4.4,
      atkMult: 10,
      pace: 0.75,
      redSpeed: 1.15,
      rows: 7,
      waves: { first: 3, last: 6, eliteEscort: 2 },
      fights: {
        early: [['driftTroll'], ['auroraWisp', 'rimeImp'], ['frostWeaver', 'driftTroll']],
        late: [['driftTroll', 'auroraWisp'], ['hailcaller', 'driftTroll'], ['auroraWisp', 'iceWraith'], ['driftTroll', 'frostWeaver', 'icicleBat']],
      },
      elites: [['frostKnight'], ['frostKnight', 'auroraWisp']],
      boss: ['glacia'],
      startScene: 'frost3',
      bossScene: 'glacia',
      packs: [
        [['driftTroll'], ['auroraWisp', 'hailcaller']],
        [['auroraWisp', 'iceWraith'], ['driftTroll', 'frostWeaver']],
      ],
      bar: {
        ice: { every: 8, width: 0.2, life: 6, fromRow: 0, max: 2 },
        snow: { every: 9, width: 0.2, life: 6, fromRow: 1, max: 1 },
        holds: { share: 0.15, fromRow: 0, width: 1 },
      },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
  ],
};
