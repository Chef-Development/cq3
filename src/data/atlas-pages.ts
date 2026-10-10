// Atlas pages (plain data): one short page of lore per act, found in that act's hidden treasure (the secret cache)
// and read in the story view the first time (run.ts plays it after the cache's pick); found pages are kept in the
// profile (`pages`) and read again from the region card (tap a treasure seal). Each page is what the land was before
// he redrew it: a ledger, a letter, a keeper's note. 2-4 lines of at most one story box's width; no spoilers past the
// act's own region, and nothing that names a later region. Acts are global (Greenmarch 0-2 ... the Duskmire 9-11).

import type { StoryBox } from './types';

export interface AtlasPage {
  act: number;
  /** What the page is, for the region card's list ("A farm ledger"). */
  title: string;
  /** Its text: 2-4 lines (two story boxes at most). */
  lines: string[];
}

export const ATLAS_PAGES: readonly AtlasPage[] = [
  // Greenmarch
  { act: 0, title: 'A farm ledger', lines: ["'Barley in the low field, beans by the oak.", "Rain due Thursday.' Below, in a child's hand:", "'The lane goes round the oak because the", "oak was here first.'"] },
  { act: 1, title: "A keeper's note", lines: ["Three hundred years old: 'The fortress has", "fallen. Let it lie. Draw the ivy in.'", "In the margin, newer ink: 'Something", "sleeps in the rubble. Do not wake it.'"] },
  { act: 2, title: "A hunter's letter", lines: ["'The hollow wood has no king. Nothing in it", "owes anyone anything. That is why I love it.", "Come in the spring. Bring bread for the", "boars. They are not as fierce as they look.'"] },
  // the Frostpeaks
  { act: 3, title: "A crew's orders", lines: ["Pinned to a post, frozen stiff: 'Thaw in", "nine days. Small slides first, so the big", "ones never come.' The orders stop there.", 'The last date on them is three weeks old.'] },
  { act: 4, title: "A child's map", lines: ["The caves in crayon, and a note: 'The ice", "sings when you touch it. Then it lets go.'", "Under it, in another hand, much later:", "'It does not let go now.'"] },
  { act: 5, title: 'An observatory log', lines: ["'Aurora at dusk. Forty days to spring.", "Good.' Then, a week later, the last entry:", "'The light has stopped moving. I am going", "up to the glacier to see why.'"] },
  // Ashfell
  { act: 6, title: "A forge-family's letter", lines: ["'The river moved again. We move the forge", "on Sunday. Your sister's side is cut off", "till the spring. We will find a way across.", "We always do. That is what feet are for.'"] },
  { act: 7, title: "A glassblower's note", lines: ["'Glass remembers the heat that made it.", "Be careful what shape you bend it into.'", 'The rest of the page has melted.'] },
  { act: 8, title: 'A chalk tally', lines: ["On a forge wall, in a big square hand:", "'Hammers down at sunset. All of you.'", "And under it, smaller: 'Even me. B.'"] },
  // the Duskmire
  { act: 9, title: 'A tide table', lines: ["Water-stained: 'Night tide, half past two.", "Lanterns lit on every post by dusk.", "A light on the crossing has saved more", "than one fool. Keep it lit.'"] },
  { act: 10, title: "A keeper's survey", lines: ["Very old: 'Causeway village. Forty souls.", "The river comes down from the north.'", "Beside it, in newer ink, one word:", "'Amended.' Nothing says who amended it."] },
  { act: 11, title: "A ferryman's note", lines: ["'No light on the mere at night. Row by", "the stars. The stars move, and so do you.", "That is how you get home.'"] },
];

/** The story scene that reads act `act`'s page (the narrator, two lines a box). */
export const pageSceneId = (act: number): string => `atlasPage${act}`;

/** An act's page, if it has one. */
export const pageOfAct = (act: number): AtlasPage | undefined => ATLAS_PAGES.find((p) => p.act === act);

/** Every page as a story scene (merged into STORY by story.ts), so the story view reads it. */
export const PAGE_STORY: Record<string, StoryBox[]> = Object.fromEntries(
  ATLAS_PAGES.map((p) => {
    const boxes: StoryBox[] = [];
    for (let i = 0; i < p.lines.length; i += 2) boxes.push({ who: 'narrator', text: p.lines.slice(i, i + 2).join('\n') });
    return [pageSceneId(p.act), boxes];
  }),
);
