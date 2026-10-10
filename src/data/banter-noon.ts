// Region 5's camp banter (SPOILERS: docs/story-bible.md section 8, "Noonspire"). Like banter-dusk.ts: a line plays
// only once its speaker and everyone in `with` are at the camp, and only once the story has reached `after` (a scene
// in src/data/story-noon.ts); a region not in play never counts (core/banter.ts), so none shows before the region is
// wired in. Comedy and charm only: the plot's answers stay in the scenes. Each line fits the camp's bubble in two short
// lines (tests/unit/data.test.ts).

import type { HeroBanterLine } from './banter';

export interface NoonBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

/** The acts cleared by the time each of the region's scenes has played (global acts 12-14; a mini-boss's scene counts
 *  from its act's clear, as Region 4's do). */
export const NOON_SCENE_ACT: Record<string, number> = { noon1: 12, sphinx: 13, noonCamp: 13, noon2: 13, brassLion: 14, noon3: 14, noonBoss: 15, noonBoss2: 15, noonBoss3: 15, noonVictory: 15 };

export const NOON_BANTER: NoonBanterLine[] = [
  { who: 'rowan', text: 'Still no shadow. I keep checking.', after: 'noon1' },
  { who: 'neve', text: 'I am NOT melting. I am glistening.', after: 'noon1' },
  { who: 'sable', text: 'Lakes on the road. None of them wet.', after: 'noon1' },
  { who: 'rowan', text: 'I got a riddle right. First time ever.', after: 'sphinx' },
  { who: 'sable', text: 'Touched the mane. Pip was right.', after: 'brassLion' },
  { who: 'torva', text: "Brass lion. I'd have kept the mane.", after: 'brassLion' },
  { who: 'solenne', text: 'We greeted the dawn. I wept.', after: 'noonVictory' },
  { who: 'rowan', text: 'A sunset. I forgot how long they take.', after: 'noonVictory' },
  { who: 'rowan', text: 'The Order sang at dawn. All of them.', after: 'noonVictory' },
  { who: 'pip', text: 'Still your owl, Rowan. Hoo.', after: 'noonVictory' },
  { who: 'smith', text: 'A feather pen? Bah. Use a hammer.', after: 'noonVictory' },
];
