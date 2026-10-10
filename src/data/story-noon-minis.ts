// Region 5's mini-bosses' scenes used to wait here as placeholders; the story team has written them into
// src/data/story-noon.ts (`sphinx`, `brassLion`, with the region's other scenes). Nothing is left to write: this stays
// empty (tests/unit/noonspire-data.test.ts still reads it, and a placeholder here must never clash with a real scene).

import type { StoryBox } from './types';

export const NOON_MINI_STORY: Record<string, StoryBox[]> = {};
