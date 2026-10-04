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
