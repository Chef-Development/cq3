// Camp banter for Regions 6-9, the isles beyond the sea (SPOILERS: docs/story-bible.md section 8), on the scenes
// drafted ahead of their data (story-hush.ts, story-reach.ts, story-wick.ts, story-salt.ts). Like banter-dusk.ts: a line plays only
// once its speaker and everyone in `with` are at the camp, and only once the story has reached `after`; a region not in
// play never counts (core/banter.ts), so none of these shows before its region is built and wired in. This is where
// the isles' heroes (Yara, Wren, Tess, Hollis, Brann) meet their homes; Brann speaks his first words here. Each line fits the camp's bubble in two short lines
// (tests/unit/data.test.ts).

import type { HeroBanterLine } from './banter';

export interface IslesBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

/** The acts cleared by the time each scene has played, if the regions take global acts 15-17, 18-20, 21-23, 24-26 (a
 *  mini-boss's scene counts from its act's clear, as Region 4's do). Correct these when the regions are built. */
export const ISLES_SCENE_ACT: Record<string, number> = {
  hush1: 15, shears: 16, hushCamp: 16, hush2: 16, slowcoach: 17, hush3: 17, yew: 18, yew2: 18, yew3: 18, hushVictory: 18,
  reach1: 18, ropewright: 19, reachCamp: 19, reach2: 19, squall: 20, reach3: 20, kestrel: 21, kestrel2: 21, kestrel3: 21, reachVictory: 21,
  wick1: 21, polisher: 22, wickCamp: 22, wick2: 22, press: 23, wick3: 23, mender: 24, mender2: 24, mender3: 24, wickVictory: 24,
  salt1: 24, saltworks: 25, saltCamp: 25, salt2: 25, gale: 26, salt3: 26, brine: 27, brine2: 27, brine3: 27, saltVictory: 27,
};

export const ISLES_BANTER: IslesBanterLine[] = [
  // Hushwood
  { who: 'moss', text: "The trees here don't even whisper.", after: 'hush1' },
  { who: 'yara', text: 'My village. Asleep. I sang to them.', after: 'hush2' },
  { who: 'sable', text: 'I still think about that lettuce.', after: 'slowcoach' },
  { who: 'yara', text: 'They woke up arguing. Home!', after: 'hushVictory' },
  { who: 'rowan', text: 'Birds! Loud ones! I missed loud.', after: 'hushVictory' },
  // Kestrel Reach
  { who: 'wren', text: 'My cliffs, floating. Show-offs.', after: 'reach1' },
  { who: 'sable', text: 'Rowan walks on air now. Normal.', after: 'reach1' },
  { who: 'pip', text: 'Hoo. Nobody falls on my watch.', after: 'reachCamp' },
  { who: 'neve', text: 'Those chicks flew. I did NOT cry.', after: 'reachVictory' },
  { who: 'wren', text: 'Ma climbed down. FURIOUS.', after: 'reachVictory' },
  // Thimblewick
  { who: 'tess', text: 'No clock wears out there. Disgusting.', after: 'wick1' },
  { who: 'torva', text: 'It polished my HAMMER. Why?!', after: 'polisher' },
  { who: 'rowan', text: 'Did Hesper know? I keep asking.', after: 'wick2' },
  { who: 'tess', text: 'A squeaky hinge! Music.', after: 'wickVictory' },
  { who: 'smith', text: 'Squeaky hinges. Finally, work!', after: 'wickVictory' },
  // Saltmarrow (Brann's vow ends when his bell rings: his first spoken words, no slate)
  { who: 'hollis', text: 'My wall, holding back nothing.', after: 'salt2' },
  { who: 'brann', text: '...The bell rang. So. Hello.', after: 'saltVictory' },
  { who: 'hollis', text: 'Brann talks now. ...Say more.', after: 'saltVictory', with: ['brann'] },
];
