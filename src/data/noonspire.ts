// Region 5, Noonspire (id `noonspire`; SPOILERS: docs/content-bible.md section 8, docs/story-bible.md). NOT IN PLAY
// YET: not in REGIONS until Region 4 is in and this region has its art and sounds. A high desert plateau of white
// towers and great sundials, where the Mapmaker nailed the sun at noon: no night, no cold, no shadows. Its bar rules:
// **mirages** (yellows that hop to a ghost spot shown first) and **heat** (blazing yellows hit harder but burn the
// hero; a green cools). Mirages from Act 1's third row, heat from Act 2's second row (a few mirages late in it), both
// from the start of Act 3, where the Gnomon's phases are the Mapmaker's edits (the glare; the sun drawn down). Once
// wired in, global acts 12-14. The scenes are the story team's (`story-noon.ts`: noon1-3, the mini-bosses' sphinx and
// brassLion, noonBoss, noonBoss2-3, noonVictory). Act scaling: a step above
// Lanternfen's (its Act 1 dips below Lanternfen's last act: a region starts a fresh run).

import type { RegionDef, Theme } from './types';

/** Region 5's act looks (a white desert road, the spire steps, the great sundial). Not in the `Theme` union yet: each
 *  act stands in an earlier look until its own is painted. */
export type NoonTheme = 'whiteRoad' | 'spireSteps' | 'sundial';
export const NOON_THEMES: NoonTheme[] = ['whiteRoad', 'spireSteps', 'sundial'];
export const NOON_STAND_IN: Record<NoonTheme, Theme> = { whiteRoad: 'pass', spireSteps: 'ruins', sundial: 'cinder' };
const look = (t: NoonTheme): Theme => NOON_STAND_IN[t];

/** The global number of Region 5's first act once it's wired in. */
export const NOON_FIRST_ACT = 12;

export const NOONSPIRE: RegionDef = {
  id: 'noonspire',
  name: 'Noonspire',
  introScene: '',
  victoryScene: 'noonVictory',
  acts: [
    {
      name: 'The White Road',
      theme: look('whiteRoad'),
      hpMult: 8.2,
      atkMult: 21,
      pace: 0.78,
      redSpeed: 1.32,
      rows: 7,
      waves: { first: 2, last: 5, eliteEscort: 1 },
      fights: {
        early: [['duneSkink'], ['glareHawk'], ['duneBandit']],
        late: [['duneSkink', 'duneBandit'], ['glareHawk', 'glareHawk'], ['duneBandit', 'glareHawk'], ['duneSkink', 'glareHawk']],
      },
      elites: [['duneColossus'], ['duneColossus', 'duneSkink']],
      boss: ['sphinx'],
      startScene: 'noon1',
      bossScene: 'sphinx',
      packs: [
        [['duneBandit'], ['duneSkink', 'glareHawk']],
        [['glareHawk', 'glareHawk'], ['duneBandit', 'duneSkink']],
      ],
      bar: { mirage: { share: 0.25, fromRow: 2, every: 2.8 } },
      weights: { fight: 0.46, elite: 0.1, treasure: 0.1, rest: 0.1, shop: 0.1, event: 0.14 },
    },
    {
      name: 'The Spire Steps',
      theme: look('spireSteps'),
      hpMult: 8.8,
      atkMult: 25,
      pace: 0.74,
      redSpeed: 1.44,
      rows: 7,
      waves: { first: 3, last: 5, eliteEscort: 2 },
      fights: {
        early: [['emberScarab'], ['brassSentry'], ['sandSalamander', 'duneSkink']],
        late: [['emberScarab', 'brassSentry'], ['sandSalamander', 'glareHawk'], ['brassSentry', 'duneBandit'], ['emberScarab', 'sandSalamander']],
      },
      elites: [['sunforgedGolem'], ['sunforgedGolem', 'emberScarab']],
      boss: ['brassLion'],
      startScene: 'noon2',
      bossScene: 'brassLion',
      packs: [
        [['brassSentry'], ['emberScarab', 'sandSalamander']],
        [['sandSalamander', 'glareHawk'], ['brassSentry', 'duneSkink']],
      ],
      bar: { heat: { share: 0.2, fromRow: 1 }, mirage: { share: 0.1, fromRow: 3, every: 2.8 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
    {
      name: 'The Great Sundial',
      theme: look('sundial'),
      hpMult: 10.2,
      atkMult: 26.5,
      pace: 0.7,
      redSpeed: 1.44,
      rows: 7,
      waves: { first: 3, last: 6, eliteEscort: 2 },
      fights: {
        early: [['dialWarden'], ['heatDjinn', 'emberScarab'], ['sunVulture']],
        late: [['dialWarden', 'heatDjinn'], ['sunVulture', 'brassSentry'], ['heatDjinn', 'sandSalamander'], ['dialWarden', 'sunVulture', 'duneSkink']],
      },
      elites: [['noonKnight'], ['noonKnight', 'heatDjinn']],
      boss: ['gnomon'],
      startScene: 'noon3',
      bossScene: 'noonBoss',
      packs: [
        [['dialWarden'], ['heatDjinn', 'emberScarab']],
        [['sunVulture', 'glareHawk'], ['dialWarden', 'heatDjinn']],
      ],
      bar: { mirage: { share: 0.2, fromRow: 0, every: 2.5 }, heat: { share: 0.2, fromRow: 0 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
  ],
};
