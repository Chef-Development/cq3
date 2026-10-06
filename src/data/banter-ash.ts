// Region 3's camp banter (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: not merged into HERO_BANTER
// (src/data/banter.ts). Like HERO_BANTER, a line plays only once its speaker and everyone in `with` are at the camp,
// and also only once the story has reached `after` (a Region 3 scene id from src/data/story-ash.ts: the line would
// spoil it before then). Each line fits the camp's bubble in two short lines (tests/unit/ashfell-data.test.ts).

import type { HeroBanterLine } from './banter';

export interface AshBanterLine extends HeroBanterLine {
  /** The scene the story must have reached (played) before the line can show. */
  after: string;
}

export const ASH_BANTER: AshBanterLine[] = [
  { who: 'rowan', text: 'The ground slid my bedroll away again.', after: 'ash1' },
  { who: 'pip', text: 'Hoo. Even my perch drifts here.', after: 'ash1' },
  { who: 'neve', text: 'Ashfell. I am melting. Literally.', after: 'ash1' },
  { who: 'tam', text: 'A whole volcano! Biggest BOOM ever!', after: 'ash1' },
  { who: 'hollis', text: 'Hot shield. Do not lean on it.', after: 'ash1' },
  { who: 'moss', text: 'The ash ferns are very warm. Hello!', after: 'ash1' },
  { who: 'vesper', text: 'Ash on my bow. I am not amused.', after: 'ash1' },
  { who: 'smith', text: 'Bellows. Still banging. The fool.', after: 'magsTale' },
  { who: 'smith', text: "His tongs? Mine now. Don't tell.", after: 'magsTale' },
  { who: 'sable', text: 'I took a little glass wall. Shh.', after: 'ash2' },
  { who: 'torva', text: 'A forge titan? Arm wrestle! HA!', after: 'ash3' },
  { who: 'rowan', text: 'Taught a titan to nap. Proudest day.', after: 'ashVictory' },
  { who: 'smith', text: 'Bellows, snoring? Ha! About time.', after: 'ashVictory' },
];
