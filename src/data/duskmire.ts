// Region 4 (SPOILERS: docs/content-bible.md section 7). NOT IN PLAY YET: not in REGIONS (src/data/regions.ts) until
// it plays end to end with its art (foe sprites, map minis, backdrops, the act themes) and its sounds. Three acts like
// Ashfell's, each a branching node map ending in a mini-boss (acts 1 and 2) or the boss (act 3), with the bar rules
// brought in gradually: dark blocks from Act 1's third row, the tide from Act 2's second row (and a little dark late
// in it), both from the start of Act 3, where the boss's phases are the mapmaker's edits to the bar. Once wired in,
// these are global acts 9-11. Names are working names until the story team fixes them (docs/story-bible.md).
// The act scaling is a first guess for the balance bot: each act a step above the matching Ashfell act (Act 1 dips
// below Ashfell's last act, as each region's first did: a region starts a fresh run).

import type { RegionDef, Theme } from './types';

/** Region 4's act looks (a lantern-lit fen, a drowned causeway, a black mere under a stuck sunset). They aren't in
 *  the `Theme` union yet (the engine's backdrops, stage lights, map kits, lairs and critters are records over every
 *  theme): until their art exists each act stands in an earlier look (`DUSK_STAND_IN`). */
export type DuskTheme = 'fen' | 'causeway' | 'mere';
export const DUSK_THEMES: DuskTheme[] = ['fen', 'causeway', 'mere'];
/** The earlier look each act borrows until its own is painted. */
export const DUSK_STAND_IN: Record<DuskTheme, Theme> = { fen: 'hollow', causeway: 'caves', mere: 'glass' };
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
      hpMult: 7.2,
      atkMult: 15.5,
      pace: 0.8,
      redSpeed: 1.2,
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
      hpMult: 7.6,
      atkMult: 16,
      pace: 0.76,
      redSpeed: 1.22,
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
      hpMult: 8.4,
      atkMult: 17.5,
      pace: 0.72,
      redSpeed: 1.28,
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
