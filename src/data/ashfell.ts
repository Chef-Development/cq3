// Region 3 (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: not in REGIONS (src/data/regions.ts) until
// the core implements its two bar rules (drifting blocks, linked pairs) and its enemies join ENEMIES. Three acts like
// the Frostpeaks', each a branching node map ending in a mini-boss (acts 1 and 2) or the boss (act 3), with the bar
// rules brought in gradually: drifting yellows from Act 1's third row, linked pairs from Act 2's second row (and a
// little drift late in it), both from the start of Act 3, where the boss's phases rewrite the bar. Once wired in,
// these are global acts 6-8.
// The act scaling is a first guess for the balance bot: each act a step above the matching Frostpeaks act (Act 1
// dips below the Frostpeaks' last act, as theirs did below Greenmarch's: a region starts a fresh run).

import type { RegionDef, Theme } from './types';

/** Region 3's act looks (ash plains, glass caves, the forge): their backdrops, stage lights, map kits, lairs and
 *  critters are in the engine (backdrop-ash.ts and the theme tables). */
export type AshTheme = Extract<Theme, 'cinder' | 'glass' | 'forge'>;
export const ASH_THEMES: AshTheme[] = ['cinder', 'glass', 'forge'];

export const ASHFELL: RegionDef = {
  id: 'ashfell',
  name: 'Ashfell',
  introScene: '',
  victoryScene: 'ashVictory',
  acts: [
    {
      name: 'Cinder Flats',
      theme: 'cinder',
      hpMult: 8.6,
      atkMult: 16.5,
      pace: 0.82,
      redSpeed: 1.16,
      rows: 7,
      waves: { first: 2, last: 5, eliteEscort: 1 },
      fights: {
        early: [['cinderling'], ['cinderKite'], ['cragCrab']],
        late: [['cinderling', 'cragCrab'], ['cinderKite', 'cinderKite'], ['cragCrab', 'cinderKite'], ['cinderling', 'cinderKite']],
      },
      elites: [['obsidianOx'], ['obsidianOx', 'cinderKite']],
      boss: ['rumbleback'],
      startScene: 'ash1',
      bossScene: 'rumbleback',
      packs: [
        [['cragCrab'], ['cinderling', 'cinderKite']],
        [['cinderKite', 'cinderKite'], ['cragCrab', 'cinderling']],
      ],
      bar: { drift: { share: 0.15, fromRow: 2, speed: 0.05 } },
      weights: { fight: 0.46, elite: 0.1, treasure: 0.1, rest: 0.1, shop: 0.1, event: 0.14 },
    },
    {
      name: 'Glass Warrens',
      theme: 'glass',
      hpMult: 8.8,
      atkMult: 17,
      pace: 0.78,
      redSpeed: 1.18,
      rows: 7,
      waves: { first: 3, last: 5, eliteEscort: 2 },
      fights: {
        early: [['glassblower'], ['prismBat'], ['glassMantis', 'cinderling']],
        late: [['glassblower', 'prismBat'], ['glassMantis', 'cinderKite'], ['prismBat', 'cragCrab'], ['glassblower', 'glassMantis']],
      },
      elites: [['kilnWarden'], ['kilnWarden', 'prismBat']],
      boss: ['hobnob'],
      startScene: 'ash2',
      bossScene: 'hobnob',
      packs: [
        [['glassMantis'], ['glassblower', 'prismBat']],
        [['prismBat', 'cinderKite'], ['glassMantis', 'cragCrab']],
      ],
      bar: { links: { share: 0.14, fromRow: 1 }, drift: { share: 0.08, fromRow: 3, speed: 0.05 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
    {
      name: 'The Black Forge',
      theme: 'forge',
      hpMult: 10.5,
      atkMult: 24,
      pace: 0.74,
      redSpeed: 1.2,
      rows: 7,
      waves: { first: 3, last: 6, eliteEscort: 2 },
      fights: {
        early: [['stokerImp'], ['magmaEel', 'cinderling'], ['forgeHand']],
        late: [['stokerImp', 'forgeHand'], ['magmaEel', 'glassblower'], ['forgeHand', 'prismBat'], ['stokerImp', 'magmaEel', 'cinderKite']],
      },
      elites: [['chainSentinel'], ['chainSentinel', 'stokerImp']],
      boss: ['bellows'],
      startScene: 'ash3',
      bossScene: 'bellows',
      packs: [
        [['forgeHand'], ['stokerImp', 'glassMantis']],
        [['magmaEel', 'prismBat'], ['forgeHand', 'stokerImp']],
      ],
      bar: { drift: { share: 0.15, fromRow: 0, speed: 0.07 }, links: { share: 0.15, fromRow: 0 } },
      weights: { fight: 0.46, elite: 0.12, treasure: 0.09, rest: 0.1, shop: 0.09, event: 0.14 },
    },
  ],
};
