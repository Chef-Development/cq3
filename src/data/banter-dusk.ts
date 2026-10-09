// Region 4's camp banter (SPOILERS: docs/content-bible.md section 7). NOT IN PLAY YET: not merged into HERO_BANTER
// (src/data/banter.ts). Like Ashfell's, a line plays only once its speaker and everyone in `with` are at the camp, and
// only once the story has reached `after` (a Region 4 scene id: the story team's story-fen.ts, or story-dusk.ts). Each line fits the
// camp's bubble in two short lines (tests/unit/duskmire-data.test.ts). They name no one the story team hasn't
// named yet (no mapmaker lines until docs/story-bible.md gives him his name and voice).

import type { HeroBanterLine } from './banter';

export interface DuskBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

/** The acts cleared by the time each of the region's scenes has played (a line waiting for it shows from then). */
export const DUSK_SCENE_ACT: Record<string, number> = { fen1: 9, motherMoth: 10, fen2: 10, sluiceKeeper: 11, fen3: 11, fenBoss: 12, fenBoss2: 12, fenBoss3: 12, fenVictory: 12 };

export const DUSK_BANTER: DuskBanterLine[] = [
  { who: 'rowan', text: 'My lantern is my best friend now.', after: 'fen1' },
  { who: 'pip', text: 'Hoo. Dusk all month. My kind of hour.', after: 'fen1' },
  { who: 'neve', text: 'Damp. Everything is damp. Ugh.', after: 'fen1' },
  { who: 'tam', text: 'Wet powder. My worst nightmare.', after: 'fen1' },
  { who: 'moss', text: 'The reeds whisper. Mostly gossip.', after: 'fen1' },
  { who: 'vesper', text: 'My fen, and not one lantern lit.', after: 'fen2' },
  { who: 'hollis', text: 'A moth ate my lamp. A big moth.', after: 'motherMoth' },
  { who: 'sable', text: 'A tide with a timetable? Fishy.', after: 'fen2' },
  { who: 'torva', text: 'A beaver with a clipboard. Respect.', after: 'sluiceKeeper' },
  { who: 'rowan', text: 'Stars! I forgot how many there are.', after: 'fenVictory' },
];
