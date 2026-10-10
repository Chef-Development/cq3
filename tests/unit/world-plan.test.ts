import { describe, expect, it } from 'vitest';
import { newProfile, WEIGHTS_TOTAL } from '../../src/core/profile';
import { FAR_PLAN, fogOf, FOG_THIN, landOpen, markRestored, markUnveiled, planName, planRegion, regionOpen, regionRestored, restoreKey, restorePending, revealed, unveilKey, unveilPending, WORLD_PLAN } from '../../src/core/world-plan';
import { REGIONS } from '../../src/data/regions';

describe('world plan', () => {
  it('twelve regions, one per weight, in order, with unique ids; the playable ones first, the far ones last', () => {
    expect(WORLD_PLAN).toHaveLength(WEIGHTS_TOTAL);
    expect(WORLD_PLAN.map((r) => r.n)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(WORLD_PLAN.map((r) => r.id)).size).toBe(12);
    expect(WORLD_PLAN.slice(0, 5).map((r) => r.id)).toEqual(['greenmarch', 'frostpeaks', 'ashfell', 'duskmire', 'noonspire']);
    expect(FAR_PLAN.map((r) => r.n)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    REGIONS.forEach((r, i) => expect(WORLD_PLAN[i].id).toBe(r.id));
    for (const r of WORLD_PLAN) expect(r.thin).toBeLessThanOrEqual(r.lift);
  });

  it("a far land's fog thins with the weight two regions before it, and lifts with the one just before", () => {
    for (const r of FAR_PLAN) {
      expect(r.thin).toBe(r.n - 2);
      expect(r.lift).toBe(r.n - 1);
      expect(fogOf(r.thin - 1, r)).toBe(1);
      expect(fogOf(r.thin, r)).toBe(FOG_THIN);
      expect(fogOf(r.lift, r)).toBe(0);
      expect(revealed(r.lift - 1, r)).toBe(false);
      expect(revealed(r.lift, r)).toBe(true);
    }
    // the more weights home, the thinner every fog (never thicker)
    for (const r of WORLD_PLAN) for (let w = 0; w < WEIGHTS_TOTAL; w++) expect(fogOf(w + 1, r)).toBeLessThanOrEqual(fogOf(w, r));
  });

  it('with the weights there are today (0-2), every far land stays fogged and unnamed', () => {
    for (const w of [0, 1, 2]) for (const r of FAR_PLAN) expect([fogOf(w, r), revealed(w, r), planName(w, r)]).toEqual([1, false, '?']);
    // every far land has its name (the story bible's), shown only once its fog lifts
    for (const r of FAR_PLAN) expect([planName(r.lift - 1, r), planName(r.lift, r) === r.name, !!r.name]).toEqual(['?', true, true]);
    expect(planName(WEIGHTS_TOTAL, { ...FAR_PLAN[0], name: undefined })).toBe('?'); // revealed, but nameless
    expect(planRegion('far9')?.n).toBe(9);
  });

  it('the second region opens once the first is cleared (its acts reached); lands with no acts stay shut', () => {
    expect(regionOpen({ actsCleared: 0 }, 0)).toBe(true);
    expect(regionOpen({ actsCleared: 2 }, 1)).toBe(false);
    expect(regionOpen({ actsCleared: 3 }, 1)).toBe(true);
    expect(landOpen({ actsCleared: 2 }, 'frostpeaks')).toBe(false);
    expect(landOpen({ actsCleared: 3 }, 'frostpeaks')).toBe(true);
    // the third region opens once the second is won
    expect(landOpen({ actsCleared: 5 }, 'ashfell')).toBe(false);
    expect(landOpen({ actsCleared: 6 }, 'ashfell')).toBe(true);
    // the fourth once the third is won
    expect(landOpen({ actsCleared: 8 }, 'duskmire')).toBe(false);
    expect(landOpen({ actsCleared: 9 }, 'duskmire')).toBe(true);
    expect(landOpen({ actsCleared: 99 }, 'noonspire')).toBe(false);
    expect(landOpen({ actsCleared: 99 }, 'far6')).toBe(false);
  });

  it("a land's first reveal plays once: pending when it opens, remembered in the profile", () => {
    const p = newProfile();
    expect(unveilPending(p)).toBe(null);
    p.actsCleared = 3;
    expect(unveilPending(p)).toBe('frostpeaks');
    markUnveiled(p, 'frostpeaks');
    markUnveiled(p, 'frostpeaks');
    expect(p.seen).toEqual([unveilKey('frostpeaks')]);
    expect(unveilPending(p)).toBe(null);
  });

  it("a land's restoring (its colour back on the Atlas) plays once per region won, in order, remembered in the profile", () => {
    const p = newProfile();
    expect(restorePending(p)).toBe(null);
    expect(regionRestored(p, 0)).toBe(false);
    p.weights = 2;
    expect(regionRestored(p, 0) && regionRestored(p, 1) && !regionRestored(p, 2)).toBe(true);
    expect(restorePending(p)).toBe(REGIONS[0].id);
    markRestored(p, REGIONS[0].id);
    markRestored(p, REGIONS[0].id);
    expect(p.seen.filter((s) => s === restoreKey(REGIONS[0].id))).toHaveLength(1);
    expect(restorePending(p)).toBe(REGIONS[1].id);
    markRestored(p, REGIONS[1].id);
    expect(restorePending(p)).toBe(null);
  });
});
