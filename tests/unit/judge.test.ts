import { describe, expect, it } from 'vitest';
import { SimClock, tapSimTime } from '../../src/core/clock';
import type { Tuning } from '../../src/core/tuning';
import { setup, timeAt } from './helpers';

describe('timestamp hit judgment', () => {
  it('judges a late-processed tap at its own timestamp (rewind)', () => {
    const { c, t } = setup();
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.9); // cursor has already moved past the block
    const r = c.tap(timeAt(t, 0.5));
    expect(r.outcome).toBe('hit');
    expect(r.perfect).toBe(true);
    expect(r.cursorPos).toBeCloseTo(0.5, 5);
  });

  it('misses when judged at the processing time instead', () => {
    const { c } = setup();
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.9);
    expect(c.tap(0.9).outcome).toBe('miss');
  });

  it('perfect = central 30% of the block; the rest of the block still hits; grace widens the edge', () => {
    const cases: Array<[number, string, boolean]> = [
      [0.51, 'hit', true],
      [0.53, 'hit', false],
      [0.555, 'hit', false], // inside half-width + cursor + grace
      [0.58, 'miss', false],
    ];
    for (const [pos, outcome, perfect] of cases) {
      const { c, t } = setup();
      c.spawnBlock('yellow', 0.5);
      c.advanceTo(1.0);
      const r = c.tap(timeAt(t, pos));
      expect(r.outcome, `pos ${pos}`).toBe(outcome);
      expect(r.perfect, `pos ${pos}`).toBe(perfect);
    }
  });

  it('applies the calibration offset to the event timestamp', () => {
    const clock = new SimClock();
    clock.resume(1000); // wall 1000 ms = sim 0
    const late = 1820; // player tapped 120 ms after the cursor crossed the block
    {
      const { c } = setup();
      c.spawnBlock('yellow', 0.5);
      c.advanceTo(1.0);
      expect(c.tap(tapSimTime(clock, late, 0)).outcome).toBe('miss');
    }
    {
      const { c } = setup();
      c.spawnBlock('yellow', 0.5);
      c.advanceTo(1.0);
      const r = c.tap(tapSimTime(clock, late, 120));
      expect(r.outcome).toBe('hit');
      expect(r.perfect).toBe(true);
    }
  });

  it('clamps rewind to maxRewindMs', () => {
    const { c, t } = setup();
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1.2);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('miss'); // 500 ms ago > 300 ms limit
  });

  it('rewinds moving red blocks too', () => {
    const { c, t } = setup();
    const red = c.spawnBlock('red', 1); // clamps to the right end
    const v = (1 - red.width) / t.blocks.redTravelSec;
    const start = red.pos;
    // cursor x = time/1.4 meets red x = start - v*time
    const meet = start / (1 / t.cursor.basePassSec + v);
    c.advanceTo(meet + 0.1);
    expect(c.tap(meet + 0.1).outcome).toBe('miss');
    const { c: c2 } = setup();
    c2.spawnBlock('red', 1);
    c2.advanceTo(meet + 0.1);
    const r = c2.tap(meet);
    expect(r.outcome).toBe('block');
    expect(r.perfect).toBe(true);
  });

  it('an attack under the cursor always takes the tap first, even over a nearer yellow or a trap', () => {
    const still = (t: Tuning) => (t.blocks.redTravelSec = 1000);
    const { c, t } = setup({ tune: still });
    const y = c.spawnBlock('yellow', 0.5);
    const r = c.spawnBlock('red', 0.56, c.enemies[0].id); // overlaps the yellow's right edge
    c.advanceTo(timeAt(t, 0.5) - 0.01);
    const res = c.tap(timeAt(t, 0.5)); // dead center of the yellow
    expect(res.outcome).toBe('block');
    expect(res.blockId).toBe(r.id);
    expect(c.blocks.some((b) => b.id === y.id)).toBe(true); // the yellow is still there for the next tap
    // over a purple trap too
    const { c: c2, t: t2 } = setup({ tune: still });
    c2.spawnBlock('purple', 0.5);
    c2.spawnBlock('red', 0.56, c2.enemies[0].id);
    c2.advanceTo(timeAt(t2, 0.5) - 0.01);
    expect(c2.tap(timeAt(t2, 0.5)).outcome).toBe('block');
  });

  it('the grace is time, not distance: a red racing at the cursor gets its full red grace', () => {
    // a fast red closing on the cursor: tap 35 ms after the cursor has left it (inside the 40 ms red grace)
    const { c, t } = setup({ tune: (t) => (t.blocks.redTravelSec = 0.8) });
    const red = c.spawnBlock('red', 1, c.enemies[0].id);
    const vc = 1 / t.cursor.basePassSec;
    const vr = (1 - red.width) / t.blocks.redTravelSec;
    const start = red.pos;
    const edge = (start + red.width / 2 + t.cursor.widthFrac / 2) / (vc + vr); // the cursor clears the red's far edge
    c.advanceTo(edge + 0.035 + 0.01);
    expect(c.tap(edge + 0.035).outcome).toBe('block');
    const { c: c2 } = setup({ tune: (t) => (t.blocks.redTravelSec = 0.8) });
    c2.spawnBlock('red', 1, c2.enemies[0].id);
    c2.advanceTo(edge + 0.06);
    expect(c2.tap(edge + 0.05).outcome).toBe('miss'); // 50 ms past: outside it
  });

  it('ignores blocks that did not exist yet at the tap time', () => {
    const { c, t } = setup();
    c.advanceTo(0.75);
    c.spawnBlock('yellow', 0.5);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('miss');
  });
});

describe('SimClock', () => {
  it('maps wall time to sim time and stops while paused', () => {
    const k = new SimClock();
    expect(k.now(500)).toBe(0);
    k.resume(1000);
    expect(k.now(1500)).toBe(500);
    k.pause(2000);
    expect(k.now(5000)).toBe(1000);
    k.resume(6000);
    expect(k.now(6250)).toBe(1250);
    expect(k.toSim(5900)).toBe(1000); // taps from before the resume clamp
    k.rebase(7000, 1300);
    expect(k.now(7100)).toBe(1400);
  });
});
