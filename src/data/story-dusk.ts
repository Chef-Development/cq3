// Region 4's story scenes (SPOILERS: docs/content-bible.md section 7). PLACEHOLDERS: the story team writes these
// (docs/story-bible.md: the exiled mapmaker, the Great Atlas); each id here is one the region's data needs, with a
// one-line stand-in so the region can be played end to end before then. Not merged into STORY yet.

import type { StoryBox } from './types';

/** A scene still to be written: one narrator box saying what happens there. */
const todo = (what: string): StoryBox[] => [{ who: 'narrator', text: what }];

export const DUSK_STORY: Record<string, StoryBox[]> = {
  dusk1: todo('(Scene to come) A marsh stuck at dusk.\nOnly what your light reaches is drawn in.'),
  bellybog: todo('(Scene to come) A toad the size of a hut,\nglowing with every lantern he swallowed.'),
  duskCamp: todo('(Scene to come) At the camp: who redrew\nthe marsh, and why it never gets dark.'),
  dusk2: todo('(Scene to come) The drowned causeway.\nThe tide keeps to a timetable here.'),
  sluiceKeeper: todo('(Scene to come) The Sluice Keeper opens\nthe floodgates, right on schedule.'),
  dusk3: todo('(Scene to come) The black mere. A lighthouse\nwades in it, the sun shut in its lamp.'),
  lighthouse: todo('(Scene to come) The lighthouse turns its beam.\nThe mapmaker watches from its gallery.'),
  lighthouse2: todo('(Scene to come) The mapmaker redraws\nthe shoreline, mid-fight.'),
  lighthouse3: todo('(Scene to come) The mapmaker rubs out\nthe sky. Only your light is left.'),
  duskVictory: todo('(Scene to come) The lamp cracks; the sun\nrolls out and up. Night, then morning.'),
};
