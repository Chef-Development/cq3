import { describe, expect, it } from 'vitest';
import { swipeAllowed } from '../../src/core/swipe';
import { setup, timeAt } from './helpers';
import type { Combat } from '../../src/core/combat';

/** Step the fight until time t. */
const go = (c: Combat, t: number) => c.advanceTo(t);

describe('patches on the bar (ice, snowdrifts, slow patches)', () => {
  it('ice speeds the cursor up inside it, a snowdrift slows it, and they multiply where they overlap', () => {
    const { c, t } = setup();
    c.addZone('ice', 0.5, 0.2, 0);
    expect(c.zoneMultAt(0.5)).toBeCloseTo(t.bar.iceMult);
    expect(c.zoneMultAt(0.2)).toBe(1);
    c.addZone('snow', 0.55, 0.2, 0);
    expect(c.zoneMultAt(0.5)).toBeCloseTo(t.bar.iceMult * t.bar.snowMult);
  });

  it('the cursor crosses an ice patch faster, so a block past it is reached earlier (travelTime agrees with the sim)', () => {
    const plain = setup().c;
    const { c, t } = setup();
    c.addZone('ice', 0.4, 0.2, 0);
    const want = c.travelTime(0, 0.7, 1);
    expect(want).toBeLessThan(plain.travelTime(0, 0.7, 1));
    expect(want).toBeCloseTo(0.5 * t.cursor.basePassSec + (0.2 * t.cursor.basePassSec) / t.bar.iceMult, 5);
    go(c, want);
    expect(c.cursorPos()).toBeCloseTo(0.7, 2);
  });

  it('a tap on a yellow inside an ice patch is judged against the faster cursor (it lands earlier)', () => {
    const { c } = setup();
    c.addZone('ice', 0.5, 0.3, 0);
    c.spawnBlock('yellow', 0.55);
    const at = c.travelTime(0, 0.55, 1);
    go(c, at);
    expect(c.tap(at).outcome).toBe('hit');
  });

  it('patches run out, and an Aurora makes them slide (bouncing off the ends)', () => {
    const { c } = setup();
    const z = c.addZone('ice', 0.3, 0.2, 1);
    c.shiftZones(0.5, 0.5);
    go(c, 0.4);
    expect(z.lo).not.toBeCloseTo(0.2, 2);
    go(c, 1.05);
    expect(c.zones).toHaveLength(0);
    expect(c.drainEvents().some((e) => e.type === 'zoneOff')).toBe(true);
  });

  it('a red with a trail leaves an ice patch over the stretch it crossed', () => {
    const { c } = setup();
    const r = c.spawnBlock('red', 0.9, undefined, undefined, { trail: 'ice' });
    go(c, 1);
    c.removeBlock(r, 'hit');
    expect(c.zones).toHaveLength(1);
    expect(c.zones[0].kind).toBe('ice');
    expect(c.zones[0].hi).toBeCloseTo(0.9, 1);
  });

  it('the act bar rules lay patches from their map row on, never more than their max at once', () => {
    const bar = { ice: { every: 1, width: 0.2, life: 10, fromRow: 2, max: 2 } };
    const early = setup({ bar, row: 1 }).c;
    go(early, 5);
    expect(early.zones).toHaveLength(0);
    const late = setup({ bar, row: 2 }).c;
    go(late, 5);
    expect(late.zones).toHaveLength(2);
  });
});

describe('hold blocks', () => {
  /** A hold centred at 0.5 (near edge 0.42, far edge 0.58 for a 0.16 hold), the cursor heading right. */
  const holdFight = () => {
    const s = setup();
    const h = s.c.spawnBlock('hold', 0.5);
    return { ...s, h, near: timeAt(s.t, 0.5 - h.width / 2), far: timeAt(s.t, 0.5 + h.width / 2) };
  };

  it('pressed at its near edge it starts a hold; held past its far end it lands as a hit, harder than a yellow', () => {
    const { c, t, near, far, h } = holdFight();
    go(c, near);
    const r = c.tap(near);
    expect(r.outcome).toBe('hold');
    expect(r.perfect).toBe(true);
    expect(c.holding?.id).toBe(h.id);
    go(c, far + 0.02);
    expect(c.holding).toBeNull();
    const ev = c.drainEvents();
    expect(ev.some((e) => e.type === 'holdEnd' && e.ok)).toBe(true);
    const hit = ev.find((e) => e.type === 'hit');
    expect(hit && hit.type === 'hit' && hit.kind).toBe('hold');
    expect(c.enemies[0].hp).toBe(80 - Math.round(t.hero.atk * t.hold.mult));
    expect(c.combo).toBe(1);
  });

  it('letting go early is a miss (the combo breaks, the hold is gone); a release just before the end still counts', () => {
    const early = holdFight();
    go(early.c, early.near);
    early.c.tap(early.near);
    early.c.combo = 5;
    go(early.c, (early.near + early.far) / 2);
    early.c.release((early.near + early.far) / 2);
    expect(early.c.combo).toBe(0);
    expect(early.c.blocks).toHaveLength(0);
    expect(early.c.enemies[0].hp).toBe(80);
    const close = holdFight();
    go(close.c, close.near);
    close.c.tap(close.near);
    const at = close.far - (close.t.hold.releaseGraceMs / 1000) * 0.5;
    go(close.c, at);
    close.c.release(at);
    expect(close.c.combo).toBe(1);
    expect(close.c.enemies[0].hp).toBeLessThan(80);
  });

  it('a press far inside the hold (late) is a miss', () => {
    const { c, t, near } = holdFight();
    const late = near + (t.hold.lateMs / 1000) * 1.5;
    go(c, late);
    expect(c.tap(late).outcome).toBe('miss');
    expect(c.holding).toBeNull();
  });

  it('a hold never triggers the finisher swipe: no finisher while holding, and a press that starts a hold is not a swipe', () => {
    const { c, near } = holdFight();
    c.stacks = 2;
    expect(c.finisherReady).toBe(true);
    go(c, near);
    const r = c.tap(near);
    expect(r.outcome).toBe('hold');
    expect(c.finisherReady).toBe(false);
    expect(c.finisher()).toBe(false);
    expect(c.stacks).toBe(2);
    expect(swipeAllowed(!!c.holding, r.outcome)).toBe(false);
    expect(swipeAllowed(false, 'hold')).toBe(false);
    expect(swipeAllowed(true, 'hit')).toBe(false);
    expect(swipeAllowed(false, 'hit')).toBe(true);
    expect(swipeAllowed(false, undefined)).toBe(true);
  });

  it('a hold on ice ends sooner (the cursor crosses it faster)', () => {
    const { c, near } = holdFight();
    c.addZone('ice', 0.5, 0.3, 0);
    const at = c.travelTime(0, 0.42, 1);
    go(c, at);
    expect(c.tap(at).outcome).toBe('hold');
    const end = c.travelTime(0, 0.58, 1) + 0.02;
    expect(end).toBeLessThan(near + 0.16 * 1.4);
    go(c, end);
    expect(c.holding).toBeNull();
    expect(c.combo).toBe(1);
  });

  it("while a hold is held a second finger can still block a red, and the held block can't be tapped again", () => {
    const { c, near } = holdFight();
    go(c, near);
    c.tap(near);
    const r = c.spawnBlock('red', c.cursorPos() + 0.01);
    expect(c.tap(c.time).outcome).toBe('block');
    expect(c.blocks.includes(r)).toBe(false);
    expect(c.holding).not.toBeNull();
  });

  it("the act's hold share turns some spawned yellows into holds from its row on", () => {
    const { c } = setup({ bar: { holds: { share: 1, fromRow: 0, width: 0.16 } } });
    expect(c.trySpawn('yellow', c.enemies[0].id)).toBe(true);
    expect(c.blocks[0].kind).toBe('hold');
  });
});

describe('mirrors, icicles, growing reds, iced yellows', () => {
  it('a mirror shard bounces the cursor back when it reaches it', () => {
    const { c, t } = setup();
    c.spawnBlock('mirror', 0.5);
    go(c, timeAt(t, 0.5) + 0.1);
    expect(c.cursorPos()).toBeLessThan(0.5);
    expect(c.cursorDirAt(c.time)).toBe(-1);
    expect(c.drainEvents().some((e) => e.type === 'mirror')).toBe(true);
  });

  it('a mirror is never tapped', () => {
    const { c, t } = setup();
    c.spawnBlock('mirror', 0.3);
    const at = timeAt(t, 0.3);
    go(c, at - 0.01);
    expect(c.wouldMiss(at - 0.01)).toBe(true);
  });

  it('an icicle (a still red) sits where it landed and strikes when its fuse runs out, unless blocked', () => {
    const { c, t } = setup();
    c.perk.resolve = 1;
    const r = c.spawnBlock('red', 0.8, undefined, undefined, { still: true, fuse: 1 });
    go(c, 0.5);
    expect(r.pos).toBeCloseTo(0.8);
    go(c, 1.05);
    expect(c.hero.hp).toBe(100 - t.enemies.slime.atk);
    const b = setup();
    const r2 = b.c.spawnBlock('red', 0.3, undefined, undefined, { still: true, fuse: 3 });
    const at = timeAt(b.t, 0.3);
    go(b.c, at);
    expect(b.c.tap(at).outcome).toBe('block');
    expect(b.c.blocks.includes(r2)).toBe(false);
  });

  it('a snowball red grows wider as it travels (up to double)', () => {
    const { c } = setup();
    const r = c.spawnBlock('red', 0.9, undefined, undefined, { grow: 0.5 });
    const w0 = r.width;
    go(c, 1);
    expect(r.width).toBeGreaterThan(w0 * 1.3);
    go(c, 5);
    expect(r.width).toBeLessThanOrEqual(w0 * 2 + 1e-9);
  });

  it('an iced yellow takes two taps: the first cracks the ice (no damage, combo kept), the second hits', () => {
    const { c, t } = setup();
    const y = c.spawnBlock('yellow', 0.3, undefined, undefined, { taps: 2 });
    const at = timeAt(t, 0.3);
    go(c, at);
    expect(c.tap(at).outcome).toBe('chip');
    expect(c.blocks.includes(y)).toBe(true);
    expect(c.enemies[0].hp).toBe(80);
    const at2 = timeAt(t, 1.7); // on the way back
    go(c, at2);
    expect(c.tap(at2).outcome).toBe('hit');
  });
});
