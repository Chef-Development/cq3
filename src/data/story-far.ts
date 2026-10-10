// Region 10's KEY scenes, drafted ahead of its data (SPOILERS: docs/story-bible.md section 8, "Farlight"): only the
// victory and the scene in Meridian after it; the region's other scenes are outlined in the bible. NOT IN PLAY. Ids:
// the region's `victoryScene` farVictory, then hallWakes (Meridian comes back; Hesper wakes; she tells the oldest law
// and no more). Same rules as story.ts (tests/unit/data.test.ts).
//
// Farlight was a beacon isle whose lighthouse guided ships home. His draft: the beacon turned inward, the lamp over his
// drawing table, its Flame burning the ink he scraped from Meridian. Breaking the Flame sends that ink home (rule 7):
// Meridian comes back, and the High Keeper wakes.

import type { StoryBox } from './types';

export const FAR_STORY: Record<string, StoryBox[]> = {
  // victory: the Flame goes out; the beacon turns back to sea; Meridian's ink runs home
  farVictory: [
    { who: 'narrator', text: 'The Flame gutters out. The beacon swings\nback out to sea, to light the ships home.' },
    { who: 'narrator', text: 'Far to the west, line by line, Meridian\ncomes back onto the map.' },
    { who: 'mapmaker', text: 'You have put out my lamp, knight. Go home.\nShe will be waking. Ask her your question.' },
    { who: 'mapmaker', text: 'No matter. The Fair Copy is nearly done.\nThen the old Atlas burns, and every grief in it.' },
    { who: 'pip', text: "Rowan. Let's go home." },
  ],
  // Meridian: the Atlas Hall wakes; Hesper tells the oldest law and no more; Pip's anger (he raises his voice)
  hallWakes: [
    { who: 'narrator', text: 'The Atlas Hall. On the gallery, the High\nKeeper wakes, her key still in her hand.' },
    { who: 'keeper', text: 'Rowan. You came back. ...How long was I\nasleep?' },
    { who: 'rowan', text: 'Long enough. Hesper, he showed me the\nriver. Did you know?' },
    { who: 'keeper', text: 'He broke the oldest law: never the living.\nThe night after the funeral. That is all.' },
    { who: 'pip', text: "That's NOT all. He has a right to know,\nHesper. You know he does." },
    { who: 'keeper', text: 'Not today.' },
  ],
};
