// The accuracy readout measures the player the way the balance bot is defined (the share of plain yellows hit at the
// starting speed): bots of known accuracy must read back as that accuracy.
import { describe, expect, it } from 'vitest';
import { addSamples, estimateAccuracy, newAccuracyLog, recordActAccuracy, RECENT_MAX, readAccuracyLog, yellowHalfMs } from '../../src/core/accuracy';
import { botRun, playAct } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { cloneTuning } from '../../src/core/tuning';

const T = cloneTuning();

/** Timing samples from a bot playing Acts 1 and 2 a few times (other seeds than the calibration's). */
function samples(accuracy: number, runs: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < runs; r++) {
    const run = botRun(T, 100 + r);
    const rng = new Rng(7 + r);
    for (let a = 0; a < 2; a++) {
      playAct(run, rng, { accuracy, seed: 100 + r });
      out.push(...run.actAims);
      if (run.phase !== 'actClear') break;
      run.nextAct();
      run.skipScenes();
    }
  }
  return out;
}

describe('accuracy readout', () => {
  for (const acc of [0.55, 0.7, 0.85]) {
    it(`a ${Math.round(acc * 100)}% bot reads back as ${Math.round(acc * 100)}% (+/- 4)`, () => {
      const xs = samples(acc, 12);
      const e = estimateAccuracy(T, xs)!;
      expect(e.n).toBeGreaterThan(600);
      expect(Math.abs(e.acc - acc), `read ${e.acc.toFixed(3)}`).toBeLessThan(0.04);
      expect(Math.abs(e.bias)).toBeLessThan(8);
    });
  }

  it('a late tapper reads lower than an on-time one with the same spread', () => {
    const rng = new Rng(3);
    const g = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
    const onTime = Array.from({ length: 400 }, () => g() * 40);
    const late = onTime.map((x) => x + 40);
    expect(estimateAccuracy(T, late)!.acc).toBeLessThan(estimateAccuracy(T, onTime)!.acc - 0.1);
    expect(estimateAccuracy(T, late)!.bias).toBeCloseTo(40, -1);
    expect(yellowHalfMs(T)).toBeGreaterThan(20);
  });

  it('needs enough taps; keeps a window of recent ones and a history per act clear', () => {
    expect(estimateAccuracy(T, [1, 2, 3])).toBeNull();
    const log = newAccuracyLog();
    addSamples(log, Array.from({ length: RECENT_MAX + 50 }, (_, i) => (i % 21) - 10));
    expect(log.recent).toHaveLength(RECENT_MAX);
    const e = recordActAccuracy(T, log, 1, log.recent, 1234)!;
    expect(e).toMatchObject({ act: 1, at: 1234 });
    expect(log.history).toEqual([e]);
    expect(readAccuracyLog(JSON.parse(JSON.stringify(log)))).toEqual(log);
    expect(readAccuracyLog({ recent: ['x', 3], history: [{ at: 'no' }] })).toEqual({ recent: [3], history: [] });
  });
});
