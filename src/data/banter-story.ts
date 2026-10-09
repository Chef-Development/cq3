// Camp banter that follows the story (SPOILERS: docs/story-bible.md). NOT IN PLAY YET: camp.ts plays BANTER and
// HERO_BANTER only; these wait, like banter-ash.ts and banter-dusk.ts, for a camp that knows which scenes have played.
// Like HERO_BANTER, a line plays only once its speaker and everyone in `with` are at the camp, and only once the story
// has reached `after` (a scene id in STORY): before then it would spoil the scene. Each line fits the camp's bubble in
// two short lines (tests/unit/data.test.ts). Comedy and quiet seeds, never the plot's answers.

import type { HeroBanterLine } from './banter';

export interface StoryBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

/** The acts cleared by the time each of Regions 1-2's scenes has played (Ashfell's: ASH_SCENE_ACT in banter-ash.ts). */
export const STORY_SCENE_ACT: Record<string, number> = {
  intro: 0, act1: 0, road: 0, captain: 1, sableJoin: 1, act2: 1, golem: 2, act3: 2, boarKing: 3, victory: 3,
  frost1: 3, rimehorn: 4, neveJoin: 4, frost2: 4, matron: 5, frost3: 5, glacia: 6, frostVictory: 6,
};

export const STORY_BANTER: StoryBanterLine[] = [
  { who: 'rowan', text: 'Robbing sleepers. Not on my road.', after: 'captain' },
  { who: 'pip', text: "The golem kept a dead king's orders.", after: 'golem' },
  { who: 'rowan', text: 'A boar in a crown. Now just a boar.', after: 'victory' },
  { who: 'rowan', text: 'Who drew me? Nobody. ...Right?', after: 'victory' },
  { who: 'pip', text: 'Hesper never looks at that lake.', after: 'victory' },
  { who: 'sable', text: 'Crooked alleys again. Bliss.', after: 'victory' },
  { who: 'neve', text: 'A ram cracked me out. I owe a ram.', after: 'neveJoin' },
  { who: 'neve', text: 'Snow that FALLS. Finally.', after: 'frostVictory' },
  { who: 'tam', text: "Avalanche season's back! So's my job!", after: 'frostVictory' },
  { who: 'torva', text: 'My quarry stays put now! SMASH!', after: 'ashVictory' },
];
