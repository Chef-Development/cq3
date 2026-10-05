import { describe, expect, it } from 'vitest';
import { isRed, type CombatEvent } from '../../src/core/combat';
import { setup, timeAt } from './helpers';
import { setupTwin, tapOver, twinTimeAt } from './twin-helpers';

const ofType = <K extends CombatEvent['type']>(ev: CombatEvent[], type: K) => ev.filter((e): e is Extract<CombatEvent, { type: K }> => e.type === type);

describe('Sable: two cursors, one per half of the bar', () => {
  it('A sweeps [0, 0.5] and B [0.5, 1], side by side at the normal pass time, bouncing at their half ends', () => {
    const { c, t } = setupTwin();
    expect(c.hands).toBe(2);
    expect(c.handRange(0)).toEqual([0, 0.5]);
    expect(c.handRange(1)).toEqual([0.5, 1]);
    expect(c.handOf(0.2)).toBe(0);
    expect(c.handOf(0.8)).toBe(1);
    const P = t.cursor.basePassSec;
    const at = (sec: number) => {
      c.advanceTo(sec);
      return [c.cursorPosAt(c.time, 0), c.cursorPosAt(c.time, 1)];
    };
    expect(at(0)).toEqual([0, 0.5]);
    const [a1, b1] = at(P / 2);
    expect(a1).toBeCloseTo(0.25, 5);
    expect(b1).toBeCloseTo(0.75, 5);
    const [a2, b2] = at(P);
    expect(a2).toBeCloseTo(0.5, 5);
    expect(b2).toBeCloseTo(1, 5);
    const [a3, b3] = at(1.5 * P); // and back
    expect(a3).toBeCloseTo(0.25, 5);
    expect(b3).toBeCloseTo(0.75, 5);
    expect(c.cursorDirAt(c.time)).toBe(-1);
    const [a4, b4] = at(2 * P);
    expect(a4).toBeCloseTo(0, 5);
    expect(b4).toBeCloseTo(0.5, 5);
    // each cursor covers half a bar per pass
    expect(c.barSpeed(0)).toBeCloseTo(0.5 / P);
    expect(c.barSpeed(1)).toBeCloseTo(0.5 / P);
  });

  it('a left-hand tap judges A only; a right-hand tap judges B only', () => {
    const { c, t } = setupTwin();
    const y = c.spawnBlock('yellow', 0.75); // B's half
    c.advanceTo(twinTimeAt(t, 1, 0.75));
    // at this moment A is at 0.25 (nothing there): the left hand misses
    expect(c.tap(c.time, 0)).toMatchObject({ outcome: 'miss', hand: 0 });
    expect(c.blocks).toContain(y);
    const { c: c2, t: t2 } = setupTwin();
    c2.spawnBlock('yellow', 0.75);
    c2.advanceTo(twinTimeAt(t2, 1, 0.75));
    const r = c2.tap(c2.time, 1);
    expect(r).toMatchObject({ outcome: 'hit', perfect: true, hand: 1 });
    expect(r.cursorPos).toBeCloseTo(0.75, 3);
    // and the other way round
    const { c: c3, t: t3 } = setupTwin();
    c3.spawnBlock('yellow', 0.25);
    c3.advanceTo(twinTimeAt(t3, 0, 0.25));
    expect(c3.tap(c3.time, 1).outcome).toBe('miss');
    expect(c3.tap(c3.time, 0).outcome).toBe('hit');
  });

  it('a cursor never takes a static block of the other half, even right by the middle', () => {
    const { c, t } = setupTwin();
    const y = c.spawnBlock('yellow', 0.53); // B's half, close to where A turns
    expect(y.pos - y.width / 2).toBeGreaterThanOrEqual(0.5);
    c.advanceTo(twinTimeAt(t, 0, 0.5)); // A at the middle
    expect(c.tap(c.time, 0).outcome).toBe('miss');
    expect(c.blocks).toContain(y);
  });

  it('a red crosses B’s half first, then A’s: B can block it, then A once it has crossed', () => {
    const run = (hand: number) => {
      const { c } = setupTwin({ tune: (t) => (t.blocks.redTravelSec = 4) });
      const red = c.spawnBlock('red', 1, c.enemies[0].id);
      // step until this hand's cursor is over the red (B meets it first; A only once it is well into A's half)
      for (let k = 0; k < 120 * 6; k++) {
        c.step();
        if (!c.blocks.includes(red)) break;
        const mine = hand ? red.pos > 0.52 : red.pos < 0.48;
        if (mine && Math.abs(c.cursorPosAt(c.time, hand) - red.pos) < 0.004) return { c, red, pos: red.pos, res: c.tap(c.time, hand) };
      }
      throw new Error('never met');
    };
    const b = run(1);
    expect(b.res).toMatchObject({ outcome: 'block', hand: 1 });
    expect(b.pos).toBeGreaterThan(0.5);
    const a = run(0);
    expect(a.res).toMatchObject({ outcome: 'block', hand: 0 });
    expect(a.pos).toBeLessThan(0.5);
    // a red in B's half is out of A's reach
    const { c, t } = setupTwin({ tune: (t) => (t.blocks.redTravelSec = 1000) });
    c.spawnBlock('red', 0.75, c.enemies[0].id);
    c.advanceTo(twinTimeAt(t, 1, 0.75));
    expect(c.tap(c.time, 0).outcome).toBe('miss');
    expect(c.tap(c.time, 1).outcome).toBe('block');
  });

  it('static blocks spawn in both halves, never straddling the middle, at Sable’s widths', () => {
    const { c, t } = setupTwin({ spawning: true, specials: true, enemies: ['bandit', 'knight'], seed: 7 });
    expect(c.widthFor('yellow')).toBeCloseTo(t.blocks.attackWidth * t.sable.widthMult);
    expect(c.widthFor('purple')).toBeCloseTo(t.blocks.trapWidth * t.sable.widthMult);
    expect(c.widthFor('red')).toBeCloseTo(t.blocks.redWidth * t.sable.redWidthMult);
    const halves = [0, 0];
    const seen = new Set<number>();
    for (let k = 0; k < 120 * 40 && !c.result; k++) {
      c.step();
      for (const b of c.blocks) {
        if (isRed(b.kind) || seen.has(b.id)) continue;
        seen.add(b.id);
        const inA = b.pos + b.width / 2 <= 0.5 + 1e-9;
        const inB = b.pos - b.width / 2 >= 0.5 - 1e-9;
        expect(inA || inB, `${b.kind} at ${b.pos.toFixed(3)} w ${b.width.toFixed(3)}`).toBe(true);
        halves[inA ? 0 : 1]++;
      }
      c.drainEvents();
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(Math.min(...halves)).toBeGreaterThan(seen.size * 0.3); // both thumbs get work
    // free spots too
    for (let k = 0; k < 200; k++) {
      const p = c.freeSpot(0.06);
      if (p === null) continue;
      expect(p + 0.03 <= 0.5 + 1e-9 || p - 0.03 >= 0.5 - 1e-9).toBe(true);
    }
  });

  it('one shared combo: hits with either cursor build it, a miss with either breaks it', () => {
    const { c } = setupTwin();
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('yellow', 0.8);
    expect(tapOver(c, 0, 0.2).outcome).toBe('hit');
    expect(c.combo).toBe(1);
    expect(tapOver(c, 1, 0.8).outcome).toBe('hit');
    expect(c.combo).toBe(2);
    expect(c.tap(c.time, 1).outcome).toBe('miss');
    expect(c.combo).toBe(0);
  });

  it('the finisher stops both cursors while it plays, then restarts them: A from the left end, B from the middle, moving right', () => {
    const { c } = setupTwin({ enemies: ['bandit'], tune: (t) => (t.meter.finisherHold = 1) });
    c.enemies[0].hp = c.enemies[0].maxHp = 100000;
    c.advanceTo(0.9);
    const a0 = c.cursorPosAt(c.time, 0);
    const b0 = c.cursorPosAt(c.time, 1);
    c.stacks = 2;
    expect(c.finisher()).toBe(true);
    expect(c.cursorHold).toBeGreaterThan(0.2);
    const hold = c.cursorHold;
    c.advanceTo(c.time + hold / 2);
    expect(c.cursorPosAt(c.time, 0)).toBeCloseTo(a0, 6);
    expect(c.cursorPosAt(c.time, 1)).toBeCloseTo(b0, 6);
    expect(c.tap(c.time, 0).outcome).toBe('none'); // taps don't count while they're stopped
    expect(c.tap(c.time, 1).outcome).toBe('none');
    c.advanceTo(c.time + hold / 2 + 0.02);
    expect(c.cursorHold).toBe(0);
    expect(c.drainEvents().some((e) => e.type === 'cursorReset')).toBe(true);
    const a1 = c.cursorPosAt(c.time, 0);
    const b1 = c.cursorPosAt(c.time, 1);
    expect(a1).toBeLessThan(0.02);
    expect(b1).toBeGreaterThanOrEqual(0.5);
    expect(b1).toBeLessThan(0.52);
    c.advanceTo(c.time + 0.2);
    expect(c.cursorPosAt(c.time, 0)).toBeGreaterThan(a1);
    expect(c.cursorPosAt(c.time, 1)).toBeGreaterThan(b1);
  });

  it('a Stomp freezes both cursors; an enraged floor speeds both up', () => {
    const { c, t } = setupTwin();
    c.advanceTo(0.5);
    const a = c.cursorPosAt(c.time, 0);
    const b = c.cursorPosAt(c.time, 1);
    c.freeze = 0.4;
    c.advanceTo(0.8);
    expect(c.cursorPosAt(c.time, 0)).toBeCloseTo(a, 6);
    expect(c.cursorPosAt(c.time, 1)).toBeCloseTo(b, 6);
    // a tap while frozen is judged where each cursor stands
    const y = c.spawnBlock('yellow', b);
    expect(c.tap(c.time, 1).outcome).toBe('hit');
    expect(c.blocks).not.toContain(y);
    c.advanceTo(1.0);
    c.minSpeed = 1.5;
    expect(c.speedMult()).toBeCloseTo(1.5);
    expect(c.barSpeed(0)).toBeCloseTo((1.5 * 0.5) / t.cursor.basePassSec);
    expect(c.barSpeed(1)).toBeCloseTo(c.barSpeed(0));
    const a1 = c.cursorPosAt(c.time, 0);
    const b1 = c.cursorPosAt(c.time, 1);
    c.advanceTo(1.1);
    expect(c.cursorPosAt(c.time, 1) - b1).toBeCloseTo(c.cursorPosAt(c.time, 0) - a1, 6);
  });

  it('rewinds per hand: a late-processed tap is judged at its own timestamp against its own cursor', () => {
    const { c, t } = setupTwin();
    c.spawnBlock('yellow', 0.75);
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(0.95); // both cursors are past their blocks
    const rb = c.tap(twinTimeAt(t, 1, 0.75), 1);
    expect(rb).toMatchObject({ outcome: 'hit', perfect: true, hand: 1 });
    expect(rb.cursorPos).toBeCloseTo(0.75, 4);
    const ra = c.tap(twinTimeAt(t, 0, 0.3), 0);
    expect(ra).toMatchObject({ outcome: 'hit', perfect: true, hand: 0 });
    expect(ra.cursorPos).toBeCloseTo(0.3, 4);
    // judged at the processing time instead, they would have missed
    const { c: c2 } = setupTwin();
    c2.spawnBlock('yellow', 0.75);
    c2.advanceTo(0.95);
    expect(c2.tap(0.95, 1).outcome).toBe('miss');
    // the rewind is still clamped to maxRewindMs
    const { c: c3, t: t3 } = setupTwin();
    c3.spawnBlock('yellow', 0.6);
    c3.advanceTo(1.0);
    expect(c3.tap(twinTimeAt(t3, 1, 0.6), 1).outcome).toBe('miss'); // 720 ms ago
  });

  it('the grace is still a time window: a yellow crossed at half the bar speed gets the same milliseconds', () => {
    const { t } = setupTwin();
    const half = (t.blocks.attackWidth * t.sable.widthMult) / 2;
    const v = 0.5 / t.cursor.basePassSec;
    const edgeMs = ((half + (t.cursor.widthFrac * 0.5) / 2) / v) * 1000;
    for (const [ms, outcome] of [
      [edgeMs + t.judge.graceMs - 4, 'hit'],
      [edgeMs + t.judge.graceMs + 4, 'miss'],
    ] as const) {
      const { c } = setupTwin();
      c.spawnBlock('yellow', 0.75);
      c.advanceTo(0.85);
      expect(c.tap(twinTimeAt(t, 1, 0.75) + ms / 1000, 1).outcome, `${ms.toFixed(1)} ms late`).toBe(outcome);
    }
  });

  it('the accuracy readout measures an isolated yellow against the cursor of the hand that tapped it', () => {
    const { c, t } = setupTwin();
    c.spawnBlock('yellow', 0.62);
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(0.5);
    c.tap(twinTimeAt(t, 1, 0.62) + 0.012, 1); // 12 ms late with B
    expect(c.aims).toEqual([12]);
    const { c: ca } = setupTwin();
    ca.spawnBlock('yellow', 0.62);
    ca.spawnBlock('yellow', 0.3);
    ca.advanceTo(1.0);
    ca.tap(twinTimeAt(t, 0, 0.3) - 0.008, 0); // 8 ms early with A
    expect(ca.aims).toEqual([-8]);
    // the cursors run side by side: a yellow under the other cursor at the same moment makes it a busy moment, not
    // a clear-cut sample (as a second yellow that close would on Rowan's bar)
    const { c: c1, t: t1 } = setupTwin();
    c1.spawnBlock('yellow', 0.75);
    c1.spawnBlock('yellow', 0.27);
    c1.advanceTo(0.8);
    c1.tap(twinTimeAt(t1, 1, 0.75), 1);
    expect(c1.aims).toEqual([]);
    // a yellow near its half's end isn't clear-cut (the cursor turns there)
    const { c: c2, t: t2 } = setupTwin();
    c2.spawnBlock('yellow', 0.54);
    c2.advanceTo(0.4);
    c2.tap(twinTimeAt(t2, 1, 0.54), 1);
    expect(c2.aims).toEqual([]);
  });

  it('hits deal tuning.sable.atkMult of Rowan’s', () => {
    const { c: rowan, t } = setup();
    rowan.spawnBlock('yellow', 0.5);
    rowan.advanceTo(timeAt(t, 0.5));
    rowan.tap(rowan.time);
    const rd = ofType(rowan.drainEvents(), 'hit')[0].damage;
    const { c, t: ts } = setupTwin();
    c.spawnBlock('yellow', 0.25);
    tapOver(c, 0, 0.25);
    const sd = ofType(c.drainEvents(), 'hit')[0].damage;
    expect(sd).toBe(Math.round(rd * ts.sable.atkMult));
  });
});

describe('Sable kit', () => {
  it('Ambidextrous: a hit with the other hand than the last fills the meter faster', () => {
    const meterAfter = (hands: [number, number]) => {
      const { c } = setupTwin();
      const p = [0.2, 0.7];
      c.spawnBlock('yellow', hands[0] ? 0.7 : 0.2);
      tapOver(c, hands[0], hands[0] ? 0.7 : 0.2);
      const m0 = c.meter;
      const second = hands[1] === hands[0] ? p[hands[1]] + 0.15 : p[hands[1]];
      c.spawnBlock('yellow', second);
      tapOver(c, hands[1], second);
      return c.meter - m0;
    };
    const same = meterAfter([0, 0]);
    const alt = meterAfter([0, 1]);
    expect(alt).toBeCloseTo(same * 1.25, 6);
    expect(meterAfter([1, 0])).toBeCloseTo(alt, 6);
    expect(meterAfter([1, 1])).toBeCloseTo(same, 6);
  });

  it('Shadow Step: for shadowSec after a green, a hit with one cursor also hits the yellow under the other', () => {
    const { c, t } = setupTwin();
    c.spawnBlock('green', 0.1);
    tapOver(c, 0, 0.1);
    expect(c.hero.abilityTimer).toBeCloseTo(t.sable.shadowSec, 6);
    const y = c.spawnBlock('yellow', 0.3);
    const twin = c.spawnBlock('yellow', 0.8); // where B is when A crosses 0.3
    c.drainEvents();
    tapOver(c, 0, 0.3);
    expect(c.blocks).not.toContain(y);
    expect(c.blocks).not.toContain(twin);
    const ev = c.drainEvents();
    const hits = ofType(ev, 'hit');
    expect(hits.map((h) => [h.hand, h.echo])).toEqual([
      [0, false],
      [1, true],
    ]);
    expect(ofType(ev, 'perk').map((p) => p.id)).toContain('shadowStep');
    expect(c.combo).toBe(3);
  });

  it('Shadow Step blocks a red under the other cursor, never springs a trap, and ends after shadowSec', () => {
    const { c, t } = setupTwin({ tune: (t) => (t.blocks.redTravelSec = 1000) });
    c.spawnBlock('green', 0.1);
    tapOver(c, 0, 0.1);
    c.spawnBlock('yellow', 0.25);
    const red = c.spawnBlock('red', 0.75, c.enemies[0].id);
    c.drainEvents();
    tapOver(c, 0, 0.25);
    expect(c.blocks).not.toContain(red);
    expect(ofType(c.drainEvents(), 'block')).toMatchObject([{ hand: 1, echo: true }]);
    // a trap under the other cursor stays put
    c.spawnBlock('yellow', 0.4);
    const trap = c.spawnBlock('purple', 0.9);
    tapOver(c, 0, 0.4);
    expect(c.blocks).toContain(trap);
    expect(ofType(c.drainEvents(), 'trap')).toHaveLength(0);
    c.removeBlock(trap, 'expire');
    // after shadowSec the other cursor is on its own again
    c.advanceTo(c.time + t.sable.shadowSec);
    expect(c.hero.abilityTimer).toBe(0);
    const a = c.spawnBlock('yellow', 0.3);
    const b = c.spawnBlock('yellow', 0.8);
    tapOver(c, 0, 0.3);
    expect(c.blocks).not.toContain(a);
    expect(c.blocks).toContain(b);
  });

  it('Twin Fang: the finisher hits the target alone, x fangMult, and a kill keeps a stack', () => {
    const { c, t } = setupTwin({ enemies: ['bandit', 'bandit'] });
    const [front, back] = c.enemies;
    c.stacks = 1;
    const base = c.finisherDamage();
    c.finisher();
    const fin = ofType(c.drainEvents(), 'finisher')[0];
    expect(fin.targets).toEqual([front.id]);
    expect(fin.damage).toBe(Math.round(base * t.sable.fangMult));
    expect(back.hp).toBe(back.maxHp);
    expect(c.stacks).toBe(0); // no kill: nothing kept
    // a kill keeps fangKeep stacks for the foe still standing
    const { c: c2, t: t2 } = setupTwin({ enemies: ['bandit', 'bandit'] });
    c2.enemies[0].hp = 1;
    c2.stacks = 3;
    c2.finisher();
    expect(c2.enemies[0].alive).toBe(false);
    expect(c2.enemies[1].hp).toBe(c2.enemies[1].maxHp);
    expect(c2.stacks).toBe(t2.sable.fangKeep);
    expect(ofType(c2.drainEvents(), 'perk').map((p) => p.id)).toContain('twinFang');
  });

  it('Twin Fang keeps its stack for the next wave too, but not after the last foe falls', () => {
    const { c, t } = setupTwin({ waves: [['slimelet'], ['slimelet']] });
    c.enemies[0].hp = 1;
    c.stacks = 2;
    c.finisher();
    expect(c.nextWaveIn).toBeGreaterThanOrEqual(0);
    expect(c.stacks).toBe(t.sable.fangKeep);
    c.advanceTo(c.time + t.waves.gapSec + 0.05);
    expect(c.waveIndex).toBe(1);
    c.enemies.find((e) => e.alive)!.hp = 1;
    c.stacks = 2;
    c.finisher();
    expect(c.result).toBe('won');
    expect(c.stacks).toBe(0);
  });
});

describe('Rowan is unchanged', () => {
  it('one cursor over the whole bar: a hand is ignored, widths are the tuning’s', () => {
    const { c, t } = setup();
    expect(c.hands).toBe(1);
    expect(c.handRange(1)).toEqual([0, 1]);
    expect(c.handSpan(1)).toBe(1);
    expect(c.widthFor('yellow')).toBe(t.blocks.attackWidth);
    expect(c.widthFor('red')).toBe(t.blocks.redWidth);
    c.advanceTo(0.5);
    expect(c.cursorPosAt(c.time, 1)).toBe(c.cursorPosAt(c.time, 0));
    expect(c.barSpeed()).toBe(c.cursorSpeed());
    expect(c.tap(c.time, 1).hand).toBe(0);
  });
});
