import { describe, expect, it } from 'vitest';
import { balanceCampaign, TYPICAL_ACCURACY } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';

// The third region, from a typical end-of-second-region hero (the story from a fresh profile through both regions,
// camp between them). Targets for the playtester (75%) with Rowan: Act 1 about 85% first try, Act 2 about 70%,
// Act 3 about 55%, its boss's first fight about 50-60%. 60 runs: the bands allow for sampling.
describe('balance targets: the third region', () => {
  const rows = balanceCampaign(cloneTuning(), [TYPICAL_ACCURACY], 60, 5, 'rowan', 3);
  const [a7, a8, a9] = rows.slice(6);

  it('most runs that start it come from won earlier regions', () => {
    expect(a7.reached / a7.runs).toBeGreaterThan(0.8);
  });

  it('Act 1 about 85% first try, Act 2 about 70%, Act 3 about 55%', () => {
    expect(a7.firstTry).toBeGreaterThanOrEqual(0.7);
    expect(a7.firstTry).toBeLessThanOrEqual(0.98);
    expect(a8.firstTry).toBeGreaterThanOrEqual(0.52);
    expect(a8.firstTry).toBeLessThanOrEqual(0.86);
    expect(a9.firstTry).toBeGreaterThanOrEqual(0.38);
    expect(a9.firstTry).toBeLessThanOrEqual(0.72);
    expect(a9.firstTry).toBeLessThan(a7.firstTry);
  });

  it("its boss's first fight is won about half the time, and retries get there", () => {
    expect(a9.bossFirstTry).toBeGreaterThanOrEqual(0.35);
    expect(a9.bossFirstTry).toBeLessThanOrEqual(0.72);
    expect(a9.clearRate).toBeGreaterThan(0.8);
  });

  it('fights stay fights, and no boss can be one-shot', () => {
    for (const r of [a7, a8, a9]) {
      expect(r.fightSec, `act ${r.act + 1}`).toBeGreaterThan(12);
      expect(r.fightSec, `act ${r.act + 1}`).toBeLessThan(30);
      expect(r.bossOneShotRate, `act ${r.act + 1}`).toBe(0);
    }
  });
});
