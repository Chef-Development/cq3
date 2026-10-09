// Region 4's story scenes that aren't written yet (SPOILERS: docs/content-bible.md section 7). The story team's
// scenes for the region are in src/data/story-fen.ts (on their branch: fen1-3, fenBoss, fenBoss2-3, fenVictory);
// these are one-line PLACEHOLDERS for the two mini-bosses' intros, which wait for their foes (the ids the region's
// data uses), so the region can be played end to end before then. Not merged into STORY yet.

import type { StoryBox } from './types';

/** A scene still to be written: one narrator box saying what happens there. */
const todo = (what: string): StoryBox[] => [{ who: 'narrator', text: what }];

/** The story team's scene ids for the region (src/data/story-fen.ts on their branch). */
export const FEN_SCENE_IDS = ['fen1', 'fen2', 'fen3', 'fenBoss', 'fenBoss2', 'fenBoss3', 'fenVictory'] as const;

export const DUSK_STORY: Record<string, StoryBox[]> = {
  motherMoth: todo('(Scene to come) A moth the size of a sail,\nstarving since the lanterns went out.'),
  sluiceKeeper: todo('(Scene to come) The Sluice Keeper keeps the\ntide on its leash, right on schedule.'),
};
