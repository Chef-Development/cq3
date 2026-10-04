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
    const [lo, hi] = balance(cloneTuning(), [0.7, 0.95], 30, 5).filter((r) => r.level === 0);
    expect(hi.missRate).toBeLessThan(lo.missRate);
    expect(hi.winRate).toBeGreaterThanOrEqual(lo.winRate);
  });
});

describe('balance targets (guards the defaults; the full report is npm run balance)', () => {
  const [l1, l2] = balance(cloneTuning(), [0.85], 150, 9);

  it('an 85% player clears Level 1 first try most of the time, but not always', () => {
    expect(l1.winRate).toBeGreaterThanOrEqual(0.7);
    expect(l1.winRate).toBeLessThanOrEqual(0.98);
  });

  it('enemies ramp up through each level: a short first fight, the boss longest', () => {
    for (const r of [l1, l2]) {
      const s = r.stageSec;
      expect(s[0]).toBeLessThanOrEqual(20);
      expect(s[s.length - 1]).toBe(Math.max(...s));
      expect(s[s.length - 1]).toBeGreaterThanOrEqual(20);
      expect(s[s.length - 1]).toBeLessThanOrEqual(60);
      for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1] * 0.9);
    }
  });

  it('Level 2 is a step up, even with the upgrades carried in', () => {
    expect(l2.heroAtk).toBeGreaterThan(l1.heroAtk);
    expect(l2.winRate).toBeLessThan(l1.winRate);
    expect(l2.winRate).toBeGreaterThanOrEqual(0.45);
  });

  it('every boss takes at least two max-stack finishers', () => {
    for (const r of [l1, l2]) {
      expect(r.bossVsMaxFinisher).toBeGreaterThan(1.5);
      expect(r.bossOneShotRate).toBe(0);
    }
  });
});
