import { describe, expect, it } from 'vitest';
import { computeCalibration, tapOffsets } from '../../src/core/calibration';
import { isSwipeUp } from '../../src/core/swipe';
import { cloneTuning, DEFAULT_TUNING, getPath, mergeKnown, setPath, sliderGroups } from '../../src/core/tuning';

describe('calibration', () => {
  it('averages tap lateness against the nearest beat', () => {
    const beats = Array.from({ length: 12 }, (_, i) => 1000 + i * 600);
    const taps = beats.slice(2).map((b, i) => b + 40 + (i % 2 ? 6 : -6));
    const offs = tapOffsets(taps, beats, 250);
    expect(offs).toHaveLength(10);
    const r = computeCalibration(offs);
    expect(r.ok).toBe(true);
    expect(r.offsetMs).toBe(40);
  });

  it('ignores stray taps and needs 8+', () => {
    const beats = [0, 600, 1200, 1800];
    expect(tapOffsets([20, 900, 1190], beats, 200)).toEqual([20, -10]);
    expect(computeCalibration([10, 20, 30]).ok).toBe(false);
  });
});

describe('swipe', () => {
  it('needs enough upward distance within the time limit', () => {
    expect(isSwipeUp(0, -50, 120, 40, 300)).toBe(true);
    expect(isSwipeUp(0, -30, 120, 40, 300)).toBe(false);
    expect(isSwipeUp(0, -60, 400, 40, 300)).toBe(false);
    expect(isSwipeUp(80, -50, 120, 40, 300)).toBe(false); // mostly sideways
    expect(isSwipeUp(0, 60, 120, 40, 300)).toBe(false); // down
  });
});

describe('tuning data', () => {
  it('every slider points at an existing number', () => {
    const t = cloneTuning();
    for (const g of sliderGroups(t))
      for (const s of g.sliders) {
        const v = getPath(t, s.path);
        expect(typeof v, s.path).toBe('number');
        expect(v, s.path).toBeGreaterThanOrEqual(s.min);
        expect(v, s.path).toBeLessThanOrEqual(s.max);
      }
  });

  it('merges saved tuning onto defaults, ignoring unknown or mistyped keys', () => {
    const t = cloneTuning();
    mergeKnown(t, { cursor: { basePassSec: 1.1, bogus: 3 }, hero: { atk: 'x' }, enemies: { slime: { hp: 5 }, ghost: { hp: 1 } } });
    expect(t.cursor.basePassSec).toBe(1.1);
    expect(t.hero.atk).toBe(DEFAULT_TUNING.hero.atk);
    expect(t.enemies.slime.hp).toBe(5);
    expect('ghost' in t.enemies).toBe(false);
    setPath(t, 'enemies.boar.atk', 33);
    expect(t.enemies.boar.atk).toBe(33);
  });

  it('enemy patterns only use the blocks each enemy is meant to have', () => {
    const t = DEFAULT_TUNING.enemies;
    expect(new Set(t.slime.pattern)).toEqual(new Set(['Y', 'G', 'R']));
    expect(new Set(t.boar.pattern)).toEqual(new Set(['Y', 'G', 'R', 'S', 'F']));
    expect(new Set(t.bandit.pattern)).toEqual(new Set(['Y', 'G', 'R', 'P', 'B']));
    expect(new Set(t.bigSlime.pattern)).toEqual(new Set(['Y', 'G', 'R', 'S', 'B', 'F', 'P']));
  });
});
