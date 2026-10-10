import { describe, expect, it } from 'vitest';
import { balanceCampaign, TYPICAL_ACCURACY } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';

// The fourth region, from a typical end-of-third-region hero (the story from a fresh profile through the three regions
// before it, camp between them). Targets for the playtester (75%) with Rowan: Act 1 about 85% first try, Act 2 about
// 68%, Act 3 about 55%, its boss's first fight about 50-60%. 40 runs (it plays four regions a run): the bands allow
// for sampling.
describe('balance targets: the fourth region', () => {
  const rows = balanceCampaign(cloneTuning(), [TYPICAL_ACCURACY], 40, 7, 'rowan', 4);
  const [a10, a11, a12] = rows.slice(9);

  it('most runs that start it come from won earlier regions', () => {
    expect(a10.reached / a10.runs).toBeGreaterThan(0.7);
  });

  it('Act 1 about 85% first try, Act 2 about 68%, Act 3 about 55%', () => {
    expect(a10.firstTry).toBeGreaterThanOrEqual(0.66);
    expect(a10.firstTry).toBeLessThanOrEqual(0.99);
    expect(a11.firstTry).toBeGreaterThanOrEqual(0.48);
    expect(a11.firstTry).toBeLessThanOrEqual(0.86);
    expect(a12.firstTry).toBeGreaterThanOrEqual(0.35);
    expect(a12.firstTry).toBeLessThanOrEqual(0.75);
    expect(a12.firstTry).toBeLessThan(a10.firstTry);
  });

  it("its boss's first fight is won about half the time, and retries get there", () => {
    expect(a12.bossFirstTry).toBeGreaterThanOrEqual(0.32);
    expect(a12.bossFirstTry).toBeLessThanOrEqual(0.75);
    expect(a12.clearRate).toBeGreaterThan(0.75);
  });

  it('fights stay fights, and no boss can be one-shot', () => {
    for (const r of [a10, a11, a12]) {
      expect(r.fightSec, `act ${r.act + 1}`).toBeGreaterThan(12);
      expect(r.fightSec, `act ${r.act + 1}`).toBeLessThan(32);
      expect(r.bossOneShotRate, `act ${r.act + 1}`).toBe(0);
    }
  });
});
