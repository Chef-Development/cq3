// Progress across runs: Greenmarch's acts cleared and the pendulum weights home (the world map shows them).
import { describe, expect, it } from 'vitest';
import { newProgress, readProgress, recordAct, recordRegion, WEIGHTS_TOTAL } from '../../src/core/progress';
import { Run } from '../../src/core/run';
import { snapshotRun } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';

describe('progress', () => {
  it('starts empty and reads back what was saved (or starts over on junk)', () => {
    expect(newProgress()).toEqual({ v: 1, actsCleared: 0, weights: 0 });
    expect(readProgress(JSON.parse(JSON.stringify({ v: 1, actsCleared: 2, weights: 1 })))).toEqual({ v: 1, actsCleared: 2, weights: 1 });
    for (const bad of [null, 'x', { v: 2 }, {}]) expect(readProgress(bad)).toEqual(newProgress());
    expect(readProgress({ v: 1, actsCleared: 99, weights: -3 })).toEqual({ v: 1, actsCleared: 3, weights: 0 });
    expect(WEIGHTS_TOTAL).toBe(12);
  });

  it('remembers the furthest act cleared, and the region weight once', () => {
    const p = newProgress();
    expect(recordAct(p, 0)).toBe(true);
    expect(recordAct(p, 0)).toBe(false);
    expect(recordAct(p, 2)).toBe(true);
    expect(recordAct(p, 1)).toBe(false);
    expect(p.actsCleared).toBe(3);
    expect(recordRegion(p)).toBe(true);
    expect(recordRegion(p)).toBe(false);
    expect(p.weights).toBe(1);
  });
});

describe('the world map', () => {
  it('sits between runs: nothing to save there, and a run starts from it', () => {
    const r = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 3);
    r.toWorld();
    expect(r.phase).toBe('world');
    expect(r.combat).toBeNull();
    expect(snapshotRun(r)).toBeNull();
    r.newRun();
    expect(r.phase).toBe('scene');
  });
});
