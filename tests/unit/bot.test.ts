import { describe, expect, it } from 'vitest';
import { balance, playLevel } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';

describe('balance bot', () => {
  it('is deterministic for a seed', () => {
    const t = cloneTuning();
    expect(playLevel(t, 0, { accuracy: 0.85, seed: 11 })).toEqual(playLevel(t, 0, { accuracy: 0.85, seed: 11 }));
  });

  it('a near-perfect player clears Level 1; a very sloppy one does not', () => {
    const t = cloneTuning();
    for (const seed of [1, 2, 3]) expect(playLevel(t, 0, { accuracy: 1, seed }).won).toBe(true);
    const sloppy = [1, 2, 3, 4, 5].filter((seed) => playLevel(t, 0, { accuracy: 0.3, seed }).won).length;
    expect(sloppy).toBeLessThanOrEqual(1);
  });

  it('plays the whole level: every stage, finishers, kills', () => {
    const res = playLevel(cloneTuning(), 0, { accuracy: 0.95, seed: 4 });
    expect(res.stages.map((s) => s.enemies[0])).toEqual(['slime', 'boar', 'bandit', 'bigSlime']);
    expect(res.stages.every((s) => s.won)).toBe(true);
    expect(res.stages.reduce((n, s) => n + s.finishers, 0)).toBeGreaterThan(0);
    expect(res.stages[3].boss).toBe(true);
    expect(res.stages[3].bossVsMaxFinisher).toBeGreaterThan(1);
  });

  it('better accuracy misses less and wins more', () => {
    const [lo, hi] = balance(cloneTuning(), [0], [0.7, 0.95], 30, 5);
    expect(hi.missRate).toBeLessThan(lo.missRate);
    expect(hi.winRate).toBeGreaterThanOrEqual(lo.winRate);
  });
});

describe('balance targets (guards the defaults; the full report is npm run balance)', () => {
  const [row] = balance(cloneTuning(), [0], [0.85], 80, 9);

  it('an 85% player wins Level 1 most of the time, but not always', () => {
    expect(row.winRate).toBeGreaterThanOrEqual(0.7);
    expect(row.winRate).toBeLessThanOrEqual(0.98);
  });

  it('fights last about 20-60 s, the boss longest (no snowball)', () => {
    expect(Math.min(...row.stageSec)).toBeGreaterThanOrEqual(17);
    expect(Math.max(...row.stageSec)).toBeLessThanOrEqual(60);
    expect(row.stageSec[3]).toBe(Math.max(...row.stageSec));
  });

  it('the boss takes at least two max-stack finishers', () => {
    expect(row.bossVsMaxFinisher).toBeGreaterThan(1.5);
    expect(row.bossOneShotRate).toBe(0);
  });
});
