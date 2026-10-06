import { describe, expect, it } from 'vitest';
import { DT, phaseToPos } from '../../src/core/combat';
import { setup } from './helpers';

describe('cursor motion', () => {
  it('ping-pongs as a triangle wave', () => {
    expect(phaseToPos(0)).toBe(0);
    expect(phaseToPos(0.25)).toBeCloseTo(0.25);
    expect(phaseToPos(1)).toBeCloseTo(1);
    expect(phaseToPos(1.25)).toBeCloseTo(0.75);
    expect(phaseToPos(2)).toBeCloseTo(0);
    expect(phaseToPos(3.5)).toBeCloseTo(0.5);
  });

  it('crosses the bar in the base pass time and comes back', () => {
    const { c } = setup();
    c.advanceTo(0.7);
    expect(c.cursorPosAt(c.time)).toBeCloseTo(0.5, 5);
    c.advanceTo(1.4);
    expect(c.cursorPosAt(c.time)).toBeCloseTo(1, 5);
    c.advanceTo(2.1);
    expect(c.cursorPosAt(c.time)).toBeCloseTo(0.5, 5);
    c.advanceTo(2.8);
    expect(c.cursorPosAt(c.time)).toBeCloseTo(0, 5);
  });

  it('steps at a fixed 120 Hz regardless of how time is fed', () => {
    const a = setup().c;
    const b = setup().c;
    a.advanceTo(1.0);
    for (let t = 0; t <= 1.0 + 1e-9; t += 0.0137) b.advanceTo(t);
    b.advanceTo(1.0);
    expect(a.tick).toBe(120);
    expect(b.tick).toBe(120);
    expect(b.cursorPhase).toBeCloseTo(a.cursorPhase, 10);
  });

  it('extrapolates within a tick and rewinds through history', () => {
    const { c } = setup();
    c.advanceTo(1.0);
    const speed = 1 / 1.4;
    expect(c.phaseAt(1.0 + DT / 2)).toBeCloseTo((1.0 + DT / 2) * speed, 6);
    expect(c.phaseAt(0.5)).toBeCloseTo(0.5 * speed, 6);
    expect(c.phaseAt(0.5 + DT / 3)).toBeCloseTo((0.5 + DT / 3) * speed, 6);
  });

  it('speeds up 2% per combo hit, capped at 2.5x', () => {
    const { c } = setup();
    expect(c.speedMult()).toBe(1);
    c.combo = 10;
    expect(c.speedMult()).toBeCloseTo(1.2);
    c.combo = 75;
    expect(c.speedMult()).toBeCloseTo(2.5);
    c.combo = 500;
    expect(c.speedMult()).toBe(2.5);
  });

  it('freezes during hit-stop', () => {
    const { c, t } = setup({ tune: (t) => (t.juice.hitStopMs = 50) });
    c.advanceTo(0.5);
    const before = c.cursorPhase;
    c.hitStop = t.juice.hitStopMs / 1000;
    c.advanceTo(0.5 + 0.05);
    expect(c.cursorPhase).toBeCloseTo(before, 9);
    c.advanceTo(0.7);
    expect(c.cursorPhase).toBeGreaterThan(before);
    // rewinding into the frozen window returns the frozen position
    expect(c.phaseAt(0.52)).toBeCloseTo(before, 6);
  });
});
