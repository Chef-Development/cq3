import { describe, expect, it } from 'vitest';
import { balance, botRun, playAct, playRun } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { cloneTuning } from '../../src/core/tuning';

describe('balance bot', () => {
  it('is deterministic for a seed', () => {
    const t = cloneTuning();
    expect(playRun(t, { accuracy: 0.85, seed: 11 }, 2, 1)).toEqual(playRun(t, { accuracy: 0.85, seed: 11 }, 2, 1));
  });

  it('a near-perfect player clears Act 1; a very sloppy one does not', () => {
    const t = cloneTuning();
    for (const seed of [1, 2, 3]) expect(playAct(botRun(t, seed), new Rng(seed), { accuracy: 1, seed }).won).toBe(true);
    const sloppy = [1, 2, 3, 4, 5].filter((seed) => playAct(botRun(t, seed), new Rng(seed), { accuracy: 0.3, seed }).won).length;
    expect(sloppy).toBeLessThanOrEqual(1);
  });

  it('walks a path through the act to its boss: fights, specials, finishers', () => {
    const t = cloneTuning();
    const res = playAct(botRun(t, 4), new Rng(4), { accuracy: 0.95, seed: 4 });
    expect(res.won).toBe(true);
    expect(res.nodes).toHaveLength(t.acts.length ? 8 : 0);
    expect(res.nodes[res.nodes.length - 1]).toBe('boss');
    expect(res.reachedBoss).toBe(true);
    const boss = res.fights[res.fights.length - 1];
    expect(boss.enemies).toEqual(['captain']);
    expect(boss.won).toBe(true);
    expect(res.fights.reduce((n, f) => n + f.finishers, 0)).toBeGreaterThan(0);
    expect(res.fights.reduce((n, f) => n + f.specials, 0)).toBeGreaterThan(0);
    expect(boss.bossVsMaxFinisher).toBeGreaterThan(1);
  });

  it('plays the whole region: every act, retrying from the act start after a defeat', () => {
    const res = playRun(cloneTuning(), { accuracy: 0.95, seed: 6 });
    expect(res.acts.map((a) => a.act)).toEqual([0, 1, 2]);
    expect(res.acts.every((a) => a.cleared)).toBe(true);
    expect(res.acts[2].attempts[res.acts[2].attempts.length - 1].fights.at(-1)!.enemies[0]).toBe('boarKing');
  });

  it('better accuracy misses less and wins more', () => {
    const [lo, hi] = balance(cloneTuning(), [0.7, 0.95], 30, 5, 6, 1);
    expect(hi.missRate).toBeLessThan(lo.missRate);
    expect(hi.firstTry).toBeGreaterThanOrEqual(lo.firstTry);
  });
});

describe('balance targets (guards the defaults; the full report is npm run balance)', () => {
  // 150 runs at 85% accuracy (about 4 s); the bands are a little wider than the targets to allow for sampling
  const [a1, a2, a3] = balance(cloneTuning(), [0.85], 150, 9);

  it('an 85% player clears Acts 1 and 2 first try about 70-85% of the time', () => {
    for (const r of [a1, a2]) {
      expect(r.firstTry, `act ${r.act + 1}`).toBeGreaterThanOrEqual(0.62);
      expect(r.firstTry, `act ${r.act + 1}`).toBeLessThanOrEqual(0.9);
    }
  });

  it('the Boar King wins his first fight against an 85% player about half the time (40-60%)', () => {
    expect(a3.bossFirstTry).toBeGreaterThanOrEqual(0.36);
    expect(a3.bossFirstTry).toBeLessThanOrEqual(0.66);
    expect(a3.clearRate).toBeGreaterThan(0.85); // but retries get there
  });

  it('every boss takes at least two max-stack finishers; none can be one-shot', () => {
    for (const r of [a1, a2, a3]) {
      expect(r.bossVsMaxFinisher, `act ${r.act + 1}`).toBeGreaterThan(2);
      expect(r.bossOneShotRate).toBe(0);
    }
  });

  it('fights grow longer: normal < elite < boss, and the Boar King is the longest', () => {
    for (const r of [a1, a2, a3]) {
      expect(r.fightSec).toBeLessThan(r.eliteSec);
      expect(r.eliteSec).toBeLessThan(r.bossSec);
      expect(r.fightSec).toBeGreaterThan(8);
    }
    expect(a3.bossSec).toBeGreaterThan(a1.bossSec);
  });

  it('the specials keep coming: several per minute in every act', () => {
    for (const r of [a1, a2, a3]) expect(r.specialsPerMin).toBeGreaterThan(6);
  });
});
