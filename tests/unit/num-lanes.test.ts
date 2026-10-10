import { describe, expect, it } from 'vitest';
import { countSteps, foeHpText, overlaps, placeBox, runningTotals, type Box } from '../../src/engine/view/num-lanes';
import { textWidth } from '../../src/engine/font';

const AREA: Box = { x: 0, y: 0, w: 327, h: 130 };
const opts = { area: AREA, up: 48, down: 24, side: 40, step: 2 };

describe('number lanes (review round 8: numbers piled into "1844")', () => {
  it('a number with nothing in the way pops where it wants', () => {
    const want = { x: 200, y: 60, w: 20, h: 18 };
    expect(placeBox(want, [], opts)).toEqual(want);
  });

  it('a second number on the same spot never overlaps the first: it goes up first', () => {
    const first = { x: 200, y: 60, w: 20, h: 18 };
    const b = placeBox({ ...first }, [first], opts);
    expect(overlaps(b, first, 1)).toBe(false);
    expect(b.y).toBeLessThan(first.y);
    expect(b.x).toBe(first.x);
  });

  it('three blows at once (two foes side by side and a pet peck) all get boxes of their own', () => {
    const placed: Box[] = [];
    for (const want of [
      { x: 190, y: 60, w: 26, h: 18 },
      { x: 204, y: 60, w: 26, h: 18 },
      { x: 196, y: 62, w: 14, h: 18 },
    ])
      placed.push(placeBox(want, placed, opts));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
  });

  it('keeps off the HUD: a number under the act plate goes aside or down, not into it', () => {
    const plate = { x: 127, y: 0, w: 72, h: 43 };
    const b = placeBox({ x: 150, y: 30, w: 20, h: 18 }, [plate], opts);
    expect(overlaps(b, plate, 1)).toBe(false);
  });

  it('stays inside the area', () => {
    const b = placeBox({ x: 320, y: -10, w: 30, h: 18 }, [], opts);
    expect(b.x + b.w).toBeLessThanOrEqual(AREA.x + AREA.w);
    expect(b.y).toBeGreaterThanOrEqual(AREA.y);
  });

  it('a shout prefers to slide aside off the wave pips (side cheaper than down)', () => {
    const pips = { x: 127, y: 0, w: 72, h: 43 };
    const b = placeBox({ x: 140, y: 34, w: 60, h: 12 }, [pips], { area: AREA, up: 12, down: 28, side: 120, costUp: 1.5, costDown: 1.2, costSide: 1, step: 1 });
    expect(overlaps(b, pips, 1)).toBe(false);
  });

  it('when nothing within reach is free it takes the least covered spot', () => {
    const wall = { x: 0, y: 0, w: 327, h: 130 };
    const b = placeBox({ x: 100, y: 50, w: 20, h: 18 }, [wall], opts);
    expect(b.w).toBe(20);
  });
});

describe("a finisher's blows summed into one number", () => {
  it('running totals per foe hit', () => {
    expect(runningTotals([367, 367, 367])).toEqual([367, 734, 1101]);
    expect(runningTotals([])).toEqual([]);
  });

  it('counts up a step per blow and ends on the total', () => {
    const steps = [367, 734, 1101];
    expect(countSteps(steps, 0).value).toBe(0);
    expect(countSteps(steps, 1)).toEqual({ value: 1101, step: 2 });
    // inside the second step it lies between the first total and the second
    const mid = countSteps(steps, 0.5);
    expect(mid.step).toBe(1);
    expect(mid.value).toBeGreaterThanOrEqual(367);
    expect(mid.value).toBeLessThanOrEqual(734);
    // never goes down
    let last = -1;
    for (let k = 0; k <= 1; k += 0.01) {
      const v = countSteps(steps, k).value;
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe("a foe plate's HP readout keeps one format the whole fight", () => {
  it('small foes read in full', () => {
    expect(foeHpText(71, 90)).toBe('71/90');
  });

  it('a boss too big for the gauge reads compact from full HP to the last sliver', () => {
    const max = 12288;
    const at = [max, 7619, 1200, 12].map((hp) => foeHpText(hp, max));
    for (const t of at) expect(t).toMatch(/k$/);
    expect(at[0]).toBe('12.3k/12.3k');
    expect(at[1]).toBe('7.7k/12.3k');
    expect(at[3]).toBe('12/12.3k');
    for (const t of at) expect(textWidth(t, 1, true)).toBeLessThanOrEqual(76);
  });
});
