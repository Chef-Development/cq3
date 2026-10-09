// Region 4's camp banter (SPOILERS: docs/content-bible.md section 7). NOT IN PLAY YET: not merged into HERO_BANTER
// (src/data/banter.ts). Like Ashfell's, a line plays only once its speaker and everyone in `with` are at the camp, and
// only once the story has reached `after` (a Region 4 scene id from src/data/story-dusk.ts). Each line fits the
// camp's bubble in two short lines (tests/unit/duskmire-data.test.ts). They name no one the story team hasn't
// named yet (no mapmaker lines until docs/story-bible.md gives him his name and voice).

import type { HeroBanterLine } from './banter';

export interface DuskBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

/** The acts cleared by the time each of the region's scenes has played (a line waiting for it shows from then). */
export const DUSK_SCENE_ACT: Record<string, number> = { dusk1: 9, bellybog: 10, duskCamp: 10, dusk2: 10, sluiceKeeper: 11, dusk3: 11, lighthouse: 12, lighthouse2: 12, lighthouse3: 12, duskVictory: 12 };

export const DUSK_BANTER: DuskBanterLine[] = [
  { who: 'rowan', text: 'My lantern is my best friend now.', after: 'dusk1' },
  { who: 'pip', text: 'Hoo. Finally, an owl-shaped hour.', after: 'dusk1' },
  { who: 'neve', text: 'Damp. Everything is damp. Ugh.', after: 'dusk1' },
  { who: 'tam', text: 'Wet powder. My worst nightmare.', after: 'dusk1' },
  { who: 'moss', text: 'The reeds whisper. Mostly gossip.', after: 'dusk1' },
  { who: 'vesper', text: 'Dusk all day. My favourite hour.', after: 'dusk1' },
  { who: 'hollis', text: 'Toads ate my lamp. Rude toads.', after: 'bellybog' },
  { who: 'sable', text: 'A tide with a timetable? Fishy.', after: 'dusk2' },
  { who: 'torva', text: 'A beaver with a clipboard. Respect.', after: 'sluiceKeeper' },
  { who: 'rowan', text: 'Morning! I missed you, morning.', after: 'duskVictory' },
];
