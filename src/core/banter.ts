// Camp banter: which lines can be said by the fire now (pure; no DOM). The camp's own lines (BANTER: Sable's once
// they're here), the heroes' (HERO_BANTER, once the speaker and everyone the line is to are at the camp), and the lines
// that follow the story (src/data/banter-story.ts, banter-ash.ts, banter-dusk.ts, banter-noon.ts): each waits for its scene (`after`),
// because it would spoil the scene before then. A scene counts as reached once it's in the game's STORY (a region not
// in play yet never counts, so its lines never show early) and the profile has played it (`seen`, for the scenes the
// camp records) or cleared the acts it comes after (the SCENE_ACT tables).

import { BANTER, HERO_BANTER, type CampSpeaker, type HeroBanterLine } from '../data/banter';
import { ASH_BANTER, ASH_SCENE_ACT } from '../data/banter-ash';
import { DUSK_BANTER, DUSK_SCENE_ACT } from '../data/banter-dusk';
import { NOON_BANTER, NOON_SCENE_ACT } from '../data/banter-noon';
import { STORY_BANTER, STORY_SCENE_ACT } from '../data/banter-story';
import { STORY } from '../data/story';
import type { Profile } from './profile';

/** A line that waits for a story scene. */
export interface GatedBanterLine extends HeroBanterLine {
  after: string;
}

/** The acts cleared by the time each scene has played, every region's together. */
export const SCENE_ACT: Readonly<Record<string, number>> = { ...STORY_SCENE_ACT, ...ASH_SCENE_ACT, ...DUSK_SCENE_ACT, ...NOON_SCENE_ACT };

/** Every line that waits for a scene. */
export const GATED_BANTER: readonly GatedBanterLine[] = [...STORY_BANTER, ...ASH_BANTER, ...DUSK_BANTER, ...NOON_BANTER];

/** Whether the story has reached `scene` for this profile (it must be a scene in play). */
export function storyReached(p: Pick<Profile, 'seen' | 'actsCleared'>, scene: string): boolean {
  if (!STORY[scene]) return false;
  return p.seen.includes(scene) || p.actsCleared >= (SCENE_ACT[scene] ?? Infinity);
}

/** The lines that can be said now, given who is at the camp (`here`) and how far the story has come. */
export function campBanter(p: Pick<Profile, 'seen' | 'actsCleared'>, here: ReadonlySet<CampSpeaker>): Array<{ who: CampSpeaker; text: string }> {
  const sable = here.has('sable');
  const present = (l: HeroBanterLine) => here.has(l.who) && (l.with ?? []).every((w) => here.has(w));
  const base = BANTER.filter((l) => (l.who !== 'sable' && !l.sable) || sable);
  const heroes = HERO_BANTER.filter(present);
  const story = GATED_BANTER.filter((l) => present(l) && storyReached(p, l.after));
  return [...base, ...heroes, ...story];
}
