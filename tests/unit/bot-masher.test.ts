import { describe, expect, it } from 'vitest';
import { MASH_GAP_MS, playCampaign, TYPICAL_ACCURACY, type FightStats } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';
import { REGIONS, regionStart } from '../../src/data/regions';

// The masher (playtest round 7: "spam, spam, finisher x5, spam"): a player who stops aiming and taps as fast as two
// thumbs can (core/bot.ts mashFrom: a tap every MASH_GAP_MS wherever the cursor is; the judge decides what each lands
// on; a hold it happens to catch it keeps pressing; it swipes the finisher like the aiming bot) must lose every
// region's Act 3 and its boss, from the hero a typical (TYPICAL_ACCURACY) player brings there: the bar never fills up
// (tuning.spam.cover), a miss costs a share of max HP and a miss right after a miss more (judge.missHpShare,
// missStreakSec), and heals per fight are capped (spam.healCap). The full numbers are in docs/balance-spam.md
// (npm run spam).
describe('the masher loses every Act 3 and boss', () => {
  const N = 5;
  const t = cloneTuning();
  const seed = (k: number) => (7919 + k * 104729 + 750) >>> 0;
  const rows = REGIONS.map((_, r) => {
    const act = regionStart(r) + REGIONS[r].acts.length - 1;
    // the act mashed from its start (each try; up to 6), and its boss alone (the act's other fights aimed)
    const whole = Array.from({ length: N }, (_, k) => playCampaign(t, { accuracy: TYPICAL_ACCURACY, seed: seed(k), mashFrom: act }, r + 1).acts.find((a) => a.act === act));
    const boss = Array.from({ length: N }, (_, k) => playCampaign(t, { accuracy: TYPICAL_ACCURACY, seed: seed(k), mashFrom: act, mashBoss: true }, r + 1).acts.find((a) => a.act === act));
    const mashed = (a: (typeof whole)[number]): FightStats[] => a?.attempts.flatMap((x) => x.fights).filter((f) => f.mashed) ?? [];
    return { r, act, whole, boss, mashed };
  });

  it('taps about 10 times a second, without aim', () => {
    expect(MASH_GAP_MS).toBeLessThanOrEqual(110);
    const fs = rows.flatMap((x) => x.whole.flatMap((a) => x.mashed(a)));
    const taps = fs.reduce((n, f) => n + f.taps, 0);
    const secs = fs.reduce((n, f) => n + f.seconds, 0);
    expect(taps / secs).toBeGreaterThan(8);
    expect(fs.reduce((n, f) => n + f.misses, 0) / taps).toBeGreaterThan(0.35); // most of the bar is empty
  });

  for (const r of REGIONS.keys())
    it(`region ${r + 1}: the masher never clears its Act 3 first try, and never wins its first boss fight`, () => {
      const x = rows[r];
      const reached = x.whole.filter((a) => !!a);
      expect(reached.length, 'runs that got to the act').toBeGreaterThanOrEqual(Math.ceil(N / 2));
      expect(reached.filter((a) => a!.attempts[0]?.won).length, 'Act 3 first try').toBe(0);
      expect(x.whole.flatMap((a) => x.mashed(a)).filter((f) => f.type === 'boss' && f.won).length, 'its boss, mashing the whole act').toBe(0);
      // the boss alone (the act's other fights aimed): its first fight in every run is lost...
      const first = x.boss.map((a) => a?.attempts.flatMap((t) => t.fights).find((f) => f.type === 'boss' && f.mashed)).filter((f) => !!f);
      expect(first.length, 'boss fights mashed').toBeGreaterThanOrEqual(Math.ceil(N / 2));
      expect(first.filter((f) => f!.won).length, 'its boss alone, first fight').toBe(0);
      // ...and retrying it (up to 6 tries) hardly ever pays (a lucky stack-banking relic build can, once in a while)
      const all = x.boss.flatMap((a) => x.mashed(a)).filter((f) => f.type === 'boss');
      expect(all.filter((f) => f.won).length / all.length, 'its boss alone, every try').toBeLessThanOrEqual(0.1);
    });
});
