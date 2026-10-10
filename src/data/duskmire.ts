// Region 4 (SPOILERS: docs/content-bible.md section 7). In play (REGIONS, global acts 9-11); until its own art lands
// (foe sprites, backdrops, the act themes) its acts wear earlier looks (DUSK_STAND_IN). Three acts like
// Ashfell's, each a branching node map ending in a mini-boss (acts 1 and 2) or the boss (act 3), with the bar rules
// brought in gradually: dark blocks from Act 1's third row, the tide from Act 2's second row (and a little dark late
// in it), both from the start of Act 3, where the boss's phases are the mapmaker's edits to the bar. The act scaling
// is tuned with the bot from a typical end-of-Ashfell hero (tests/unit/bot-region4.test.ts).

import type { RegionDef, Theme } from './types';

/** Region 4's act looks (a lantern-lit fen, a drowned causeway, a black mere under a stuck sunset), in the `Theme`
 *  union with their art (backdrop-dusk.ts, the stage lights, map kits, lairs and critters). */
export type DuskTheme = 'fen' | 'causeway' | 'mere';
export const DUSK_THEMES: DuskTheme[] = ['fen', 'causeway', 'mere'];
/** The look each act shows: its own, now that it's painted (it borrowed an earlier one until then). */
export const DUSK_STAND_IN: Record<DuskTheme, Theme> = { fen: 'fen', causeway: 'causeway', mere: 'mere' };
const look = (t: DuskTheme): Theme => DUSK_STAND_IN[t];

/** The global number of Region 4's first act once it's wired in. */
export const DUSK_FIRST_ACT = 9;

export const DUSKMIRE: RegionDef = {
  id: 'duskmire',
  name: 'Duskmire',
  introScene: '',
  victoryScene: 'duskVictory',
  acts: [
    {
      name: 'Lanternfen',
      theme: look('fen'),
      hpMult: 7.4,
      atkMult: 20,
      pace: 0.8,
      redSpeed: 1.3,
      rows: 7,
      waves: { first: 2, last: 5, eliteEscort: 1 },
      fights: {
        early: [['bogWisp'], ['mireToad'], ['reedling']],
        late: [['bogWisp', 'reedling'], ['mireToad', 'mireToad'], ['reedling', 'mireToad'], ['bogWisp', 'mireToad']],
      },
      elites: [['peatGolem'], ['peatGolem', 'bogWisp']],
      boss: ['bellybog'],
      startScene: 'dusk1',
      bossScene: 'bellybog',
      packs: [
        [['reedling'], ['bogWisp', 'mireToad']],
        [['mireToad', 'mireToad'], ['reedling', 'bogWisp']],
      ],
      bar: { dark: { share: 0.3, fromRow: 2, traps: 0.12 } },
      weights: { fight: 0.46, elite: 0.1, treasure: 0.1, rest: 0.1, shop: 0.1, event: 0.14 },
    },
    {
      name: 'The Drowned Causeway',
      theme: look('causeway'),
      hpMult: 8,
      atkMult: 24,
      pace: 0.76,
      redSpeed: 1.42,
      rows: 7,
      waves: { first: 3, last: 5, eliteEscort: 2 },
      fights: {
        early: [['mudskipper'], ['stiltHeron'], ['lamplighter', 'mireToad']],
        late: [['mudskipper', 'stiltHeron'], ['lamplighter', 'bogWisp'], ['stiltHeron', 'reedling'], ['mudskipper', 'lamplighter']],
      },
      elites: [['oldSnapper'], ['oldSnapper', 'stiltHeron']],
      boss: ['sluiceKeeper'],
      startScene: 'dusk2',
      bossScene: 'sluiceKeeper',
      packs: [
        [['lamplighter'], ['mudskipper', 'stiltHeron']],
        [['stiltHeron', 'bogWisp'], ['lamplighter', 'reedling']],
      ],
      bar: { tide: { fromRow: 1, low: 0.06, high: 0.36, period: 10, from: 'right' }, dark: { share: 0.15, fromRow: 3, traps: 0.12 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
    {
      name: 'The Gloaming Mere',
      theme: look('mere'),
      hpMult: 9.8,
      atkMult: 25,
      pace: 0.72,
      redSpeed: 1.42,
      rows: 7,
      waves: { first: 3, last: 6, eliteEscort: 2 },
      fights: {
        early: [['inkEel'], ['duskMoths', 'mireToad'], ['bogHag']],
        late: [['inkEel', 'bogHag'], ['duskMoths', 'lamplighter'], ['bogHag', 'stiltHeron'], ['inkEel', 'duskMoths', 'bogWisp']],
      },
      elites: [['sunkenSentinel'], ['sunkenSentinel', 'duskMoths']],
      boss: ['lighthouse'],
      startScene: 'dusk3',
      bossScene: 'lighthouse',
      packs: [
        [['bogHag'], ['inkEel', 'mudskipper']],
        [['duskMoths', 'stiltHeron'], ['bogHag', 'inkEel']],
      ],
      bar: { dark: { share: 0.3, fromRow: 0, traps: 0.15 }, tide: { fromRow: 0, low: 0.08, high: 0.4, period: 10.5, from: 'right' } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
  ],
};
