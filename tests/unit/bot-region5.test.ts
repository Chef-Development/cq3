import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { balanceCampaign, TYPICAL_ACCURACY } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';

// The fifth region, from a typical end-of-fourth-region hero (the story from a fresh profile through the four regions
// before it, camp between them). Targets for the playtester (75%) with Rowan, a little harder than the fourth: Act 1
// about 80% first try, Act 2 about 65%, Act 3 about 50%, its boss's first fight about 45-55%. 30 runs (it plays five
// regions a run, and CI runs it): the bands allow for sampling (a 30-run first-try rate swings about 15 points).
describe('balance targets: the fifth region', () => {
  const rows = balanceCampaign(cloneTuning(), [TYPICAL_ACCURACY], 30, Number(process.env.CQ3_SEED ?? 7), 'rowan', 5);
  const [a13, a14, a15] = rows.slice(12);

  it('(prints its rows when asked)', () => {
    const out = process.env.CQ3_PRINT;
    if (out) writeFileSync(out, [a13, a14, a15].map((r) => JSON.stringify({ act: r.act + 1, reached: r.reached, runs: r.runs, firstTry: r.firstTry, bossFirstTry: r.bossFirstTry, clearRate: r.clearRate, fightSec: r.fightSec, oneShot: r.bossOneShotRate })).join('\n'));
  });

  it('most runs that start it come from won earlier regions', () => {
    expect(a13.reached / a13.runs).toBeGreaterThan(0.6);
  });

  it('Act 1 about 80% first try, Act 2 about 65%, Act 3 about 50%', () => {
    expect(a13.firstTry).toBeGreaterThanOrEqual(0.6);
    expect(a13.firstTry).toBeLessThanOrEqual(0.97);
    expect(a14.firstTry).toBeGreaterThanOrEqual(0.42);
    expect(a14.firstTry).toBeLessThanOrEqual(0.85);
    expect(a15.firstTry).toBeGreaterThanOrEqual(0.28);
    expect(a15.firstTry).toBeLessThanOrEqual(0.72);
    expect(a15.firstTry).toBeLessThan(a13.firstTry);
  });

  it("its boss's first fight is won about half the time, and retries get there", () => {
    expect(a15.bossFirstTry).toBeGreaterThanOrEqual(0.25);
    expect(a15.bossFirstTry).toBeLessThanOrEqual(0.72);
    expect(a15.clearRate).toBeGreaterThan(0.7);
  });

  it('fights stay fights, and no boss can be one-shot', () => {
    for (const r of [a13, a14, a15]) {
      expect(r.fightSec, `act ${r.act + 1}`).toBeGreaterThan(9);
      expect(r.fightSec, `act ${r.act + 1}`).toBeLessThan(32);
      expect(r.bossOneShotRate, `act ${r.act + 1}`).toBe(0);
    }
  });
});
