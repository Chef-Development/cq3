// Region 5's story scenes that aren't written yet (SPOILERS: docs/content-bible.md section 8). The story team's
// scenes for the region are in src/data/story-noon.ts (noon1-3, noonBoss, noonBoss2-3, noonVictory); these are one-line
// PLACEHOLDERS for the two mini-bosses' intros (the ids the region's data uses). Not merged into STORY yet.

import type { StoryBox } from './types';

const todo = (what: string): StoryBox[] => [{ who: 'narrator', text: what }];

export const NOON_MINI_STORY: Record<string, StoryBox[]> = {
  sphinx: todo('(Scene to come) The Noon Sphinx\nguards the road with riddles of light.'),
  brassLion: todo('(Scene to come) A brass lion guards\nthe spire stairs. Its mane is too hot.'),
};
