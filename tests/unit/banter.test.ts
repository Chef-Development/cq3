// Camp banter (core/banter.ts): which lines can be said by the fire. The story's lines wait for their scene: never
// before it, never for a region not in play yet (they'd spoil it), always once it has played.
import { describe, expect, it } from 'vitest';
import { campBanter, GATED_BANTER, SCENE_ACT, storyReached } from '../../src/core/banter';
import { newProfile } from '../../src/core/profile';
import { BANTER, HERO_BANTER } from '../../src/data/banter';
import { DUSK_BANTER } from '../../src/data/banter-dusk';
import { STORY_BANTER } from '../../src/data/banter-story';
import type { CampSpeaker } from '../../src/data/banter';
import { STORY } from '../../src/data/story';

const camp = (...who: CampSpeaker[]) => new Set<CampSpeaker>(['rowan', 'pip', 'smith', ...who]);
const prof = (actsCleared: number, seen: string[] = []) => ({ ...newProfile(), actsCleared, seen });

describe('camp banter', () => {
  it('every gated line waits for a scene with a place in the story (its act in a SCENE_ACT table)', () => {
    for (const l of GATED_BANTER) expect(SCENE_ACT[l.after], `${l.text}: ${l.after}`).toBeDefined();
  });

  it("a story line shows once its scene's acts are cleared, not before (with/without)", () => {
    const line = STORY_BANTER.find((l) => l.after === 'victory' && l.who === 'pip')!;
    expect(campBanter(prof(SCENE_ACT.victory - 1), camp()).some((l) => l.text === line.text)).toBe(false);
    expect(campBanter(prof(SCENE_ACT.victory), camp()).some((l) => l.text === line.text)).toBe(true);
  });

  it('a scene the camp recorded as played counts too (the camp tale), whatever the acts', () => {
    expect(storyReached(prof(0), 'magsTale')).toBe(false);
    expect(storyReached(prof(0, ['magsTale']), 'magsTale')).toBe(true);
  });

  it("a region not in play never counts, so its lines never show early (the fourth region's)", () => {
    const scene = DUSK_BANTER[0].after;
    if (STORY[scene]) return; // wired in: then it gates like the rest
    expect(storyReached(prof(99, [scene]), scene)).toBe(false);
    expect(campBanter(prof(99), camp('neve', 'tam', 'moss', 'vesper', 'hollis', 'torva', 'sable')).some((l) => DUSK_BANTER.some((d) => d.text === l.text))).toBe(false);
  });

  it("a line needs its speaker at the camp: Sable's wait for Sable, a hero's for the hero", () => {
    const sable = STORY_BANTER.find((l) => l.who === 'sable')!;
    expect(campBanter(prof(9), camp()).some((l) => l.text === sable.text)).toBe(false);
    expect(campBanter(prof(9), camp('sable')).some((l) => l.text === sable.text)).toBe(true);
    const tam = STORY_BANTER.find((l) => l.who === 'tam')!;
    expect(campBanter(prof(9), camp()).some((l) => l.text === tam.text)).toBe(false);
    expect(campBanter(prof(9), camp('tam')).some((l) => l.text === tam.text)).toBe(true);
  });

  it("a line that stops being true stops once the story reaches its 'until' scene (Brann's slate, until his bell rings)", () => {
    const slate = HERO_BANTER.filter((l) => l.until);
    expect(slate.length).toBeGreaterThan(0);
    for (const l of slate) expect(SCENE_ACT[l.until!], l.text).toBeDefined();
    const here = camp('brann', 'hollis');
    const shows = (p: ReturnType<typeof prof>) => campBanter(p, here).some((x) => x.text === slate[0].text);
    expect(shows(prof(0))).toBe(true);
    // the scene isn't in play yet, so the line keeps showing whatever the acts; once it is, it stops after the scene
    if (!STORY[slate[0].until!]) expect(shows(prof(99, [slate[0].until!]))).toBe(true);
    else expect(shows(prof(SCENE_ACT[slate[0].until!]))).toBe(false);
  });

  it("a fresh camp has the camp's own lines and none of the story's", () => {
    const lines = campBanter(prof(0), camp());
    expect(lines.length).toBeGreaterThanOrEqual(BANTER.filter((l) => l.who !== 'sable' && !l.sable).length);
    expect(lines.some((l) => GATED_BANTER.some((g) => g.text === l.text && SCENE_ACT[g.after] > 0))).toBe(false);
  });
});
