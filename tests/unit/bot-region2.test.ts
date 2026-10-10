import { describe, expect, it } from 'vitest';
import { balanceCampaign, TYPICAL_ACCURACY } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';

// The second region, from a typical end-of-Greenmarch hero (core/bot.ts playCampaign: the story from a fresh profile,
// then camp, then the region's fresh run). Targets for the playtester (75%) with Rowan: Act 1 about 90% first try,
// Act 2 about 75%, Act 3 about 60%, its boss's first fight about 55-65%. 80 runs: the bands allow for sampling. The
// full per-hero report (every hero within +/-10 points of Rowan) is npm run campaign.
describe('balance targets: the second region', () => {
  const rows = balanceCampaign(cloneTuning(), [TYPICAL_ACCURACY], 80, 3, 'rowan', 2);
  const [, , , a4, a5, a6] = rows;

  it('most runs that start it come from a won Greenmarch', () => {
    expect(a4.reached / a4.runs).toBeGreaterThan(0.9);
  });

  it('Act 1 is a gentle step up: about 90% first try', () => {
    expect(a4.firstTry).toBeGreaterThanOrEqual(0.78);
    expect(a4.firstTry).toBeLessThanOrEqual(0.98);
  });

  it('Act 2 ramps: about 75% first try', () => {
    expect(a5.firstTry).toBeGreaterThanOrEqual(0.6);
    expect(a5.firstTry).toBeLessThanOrEqual(0.88);
    expect(a5.firstTry).toBeLessThanOrEqual(a4.firstTry + 0.05);
  });

  it("Act 3 is the region's real test: about 60% first try, the boss's first fight about 55-65%", () => {
    expect(a6.firstTry).toBeGreaterThanOrEqual(0.45);
    expect(a6.firstTry).toBeLessThanOrEqual(0.75);
    expect(a6.bossFirstTry).toBeGreaterThanOrEqual(0.45);
    expect(a6.bossFirstTry).toBeLessThanOrEqual(0.78);
    expect(a6.firstTry).toBeLessThan(a4.firstTry);
    expect(a6.clearRate).toBeGreaterThan(0.85); // and retries get there
  });

  it('fights stay fights: normal fights 12-30 s, the boss the longest', () => {
    for (const r of [a4, a5, a6]) {
      expect(r.fightSec, `act ${r.act + 1}`).toBeGreaterThan(12);
      expect(r.fightSec, `act ${r.act + 1}`).toBeLessThan(30);
      expect(r.fightSec, `act ${r.act + 1}`).toBeLessThan(r.bossSec);
    }
  });

  it('no boss can be one-shot by a max-stack finisher', () => {
    for (const r of [a4, a5, a6]) expect(r.bossOneShotRate, `act ${r.act + 1}`).toBe(0);
  });
});
