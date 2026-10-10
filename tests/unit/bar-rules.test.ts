import { describe, expect, it } from 'vitest';
import { swipeAllowed } from '../../src/core/swipe';
import { setup, timeAt } from './helpers';
import { HERO_IDS } from '../../src/data/heroes';
import { isRed, unlit, type Combat } from '../../src/core/combat';
import { runAction } from '../../src/core/specials';
import type { BarRules } from '../../src/data/types';

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

describe('the third region: drifting blocks and linked pairs', () => {
  it('a drifting yellow slides along the bar and turns back at the end (and at a block beside it)', () => {
    const { c, t } = setup();
    const b = c.spawnBlock('yellow', 0.8, c.enemies[0].id, 0.1, { drift: 0.2 });
    expect(b.vel).toBe(0.2);
    go(c, 0.5);
    expect(b.pos).toBeGreaterThan(0.8);
    go(c, 2);
    // it reached the right end and came back
    expect(b.vel).toBeLessThan(0);
    expect(b.pos).toBeLessThanOrEqual(1 - t.blocks.edgeMargin - 0.05 + 1e-9);
    // a still block in its way turns it back too
    const { c: c2 } = setup();
    const wall = c2.spawnBlock('yellow', 0.3);
    const d = c2.spawnBlock('yellow', 0.6, c2.enemies[0].id, 0.1, { drift: -0.2 });
    go(c2, 2);
    expect(d.pos).toBeGreaterThan(wall.pos + (wall.width + d.width) / 2);
  });

  it('a tap lands on a drifting yellow where it is at the tap (the judge follows it)', () => {
    const { c, t } = setup();
    const b = c.spawnBlock('yellow', 0.5, c.enemies[0].id, 0.1, { drift: 0.1 });
    // the cursor (left to right) meets it a little right of where it started
    const meet = 0.5 / (1 / t.cursor.basePassSec - 0.1);
    go(c, meet);
    expect(c.tap(meet).outcome).toBe('hit');
    expect(c.blocks.includes(b)).toBe(false);
  });

  it("an act's drift share makes spawned yellows drift (and none in an act without it)", () => {
    const { c } = setup({ bar: { drift: { share: 1, fromRow: 0, speed: 0.06 } } });
    expect(c.trySpawn('yellow', c.enemies[0].id)).toBe(true);
    expect(Math.abs(c.blocks[0].vel)).toBeCloseTo(0.06);
    const { c: plain } = setup();
    plain.trySpawn('yellow', plain.enemies[0].id);
    expect(plain.blocks[0].vel).toBe(0);
    // from its row on only
    const { c: early } = setup({ bar: { drift: { share: 1, fromRow: 3, speed: 0.06 } }, row: 1 });
    early.trySpawn('yellow', early.enemies[0].id);
    expect(early.blocks[0].vel).toBe(0);
  });

  const pair = (c: Combat, p = 0.4, q = 0.6) => {
    const a = c.spawnBlock('yellow', p);
    const b = c.spawnBlock('yellow', q);
    a.link = b.id;
    b.link = a.id;
    return [a, b];
  };

  it('a linked pair: the first tap lights it (nothing lands yet), the partner in time lands both, harder', () => {
    const { c, t } = setup({ enemies: ['bandit'] });
    const [a, b] = pair(c);
    const hp = c.enemies[0].hp;
    go(c, timeAt(t, 0.4));
    expect(c.tap(timeAt(t, 0.4)).outcome).toBe('link');
    expect(c.enemies[0].hp).toBe(hp);
    expect(c.linkLit).toMatchObject({ id: a.id, partner: b.id });
    expect(c.drainEvents().some((e) => e.type === 'linkStart')).toBe(true);
    go(c, timeAt(t, 0.6));
    expect(c.tap(timeAt(t, 0.6)).outcome).toBe('hit');
    expect(c.blocks.includes(a) || c.blocks.includes(b)).toBe(false);
    expect(c.linkLit).toBeNull();
    // two hits, each x links.bonus
    expect(hp - c.enemies[0].hp).toBe(2 * Math.round(t.hero.atk * t.links.bonus));
    expect(c.combo).toBe(2);
    expect(c.drainEvents().some((e) => e.type === 'linkDone')).toBe(true);
  });

  it('...and if the beat runs out, both break: a miss (the combo goes)', () => {
    const { c, t } = setup({ enemies: ['bandit'] });
    const [a, b] = pair(c, 0.2, 0.9);
    c.combo = 5;
    go(c, timeAt(t, 0.2));
    c.tap(timeAt(t, 0.2));
    go(c, timeAt(t, 0.2) + t.links.beatSec + 0.02);
    expect(c.blocks.includes(a) || c.blocks.includes(b)).toBe(false);
    expect(c.linkLit).toBeNull();
    expect(c.combo).toBe(0);
    const ev = c.drainEvents();
    expect(ev.some((e) => e.type === 'linkBroken')).toBe(true);
    expect(ev.some((e) => e.type === 'miss')).toBe(true);
  });

  it('a linked block taken off the bar some other way leaves its partner a plain yellow; perks never hit half a pair', () => {
    const { c, t } = setup({ enemies: ['bandit'] });
    const [a, b] = pair(c);
    c.removeBlock(a, 'perk');
    expect(b.link).toBe(0);
    go(c, timeAt(t, 0.6));
    expect(c.tap(timeAt(t, 0.6)).outcome).toBe('hit');
    const { c: c2 } = setup({ enemies: ['bandit'] });
    const [x] = pair(c2);
    c2.perkHit(x);
    expect(c2.blocks.includes(x)).toBe(true);
  });

  it("an act's link share spawns pairs (two chained yellows a little apart)", () => {
    const { c } = setup({ bar: { links: { share: 1, fromRow: 0 } } });
    expect(c.trySpawn('yellow', c.enemies[0].id)).toBe(true);
    expect(c.blocks).toHaveLength(2);
    const [a, b] = c.blocks;
    expect(a.link).toBe(b.id);
    expect(b.link).toBe(a.id);
    expect(Math.abs(a.pos - b.pos)).toBeGreaterThan(a.width);
  });

  it('every hero can finish a linked pair and hit a drifting block', () => {
    for (const hero of HERO_IDS) {
      const { c, t } = setup({ enemies: ['bandit'], hero });
      pair(c);
      go(c, timeAt(t, 0.4));
      expect(c.tap(timeAt(t, 0.4)).outcome, hero).toBe('link');
      go(c, timeAt(t, 0.6));
      expect(['hit'], hero).toContain(c.tap(timeAt(t, 0.6)).outcome);
      expect(c.linkLit, hero).toBeNull();
    }
  });
});

describe('the fourth region: dark blocks (the lantern) and the tide', () => {
  it("a dark yellow far from the cursor stays unlit; the lantern lights it well before the cursor gets there, and it's hit like any yellow", () => {
    const { c, t } = setup();
    const b = c.spawnBlock('yellow', 0.8, c.enemies[0].id, undefined, { dark: true });
    expect(b.dark).toBe(true);
    expect(unlit(b)).toBe(true);
    go(c, 0.2);
    expect(unlit(b)).toBe(true);
    const arrive = timeAt(t, 0.8);
    go(c, arrive);
    expect(unlit(b)).toBe(false);
    // lit at least the lantern's reach (in time) before the cursor reached its centre, less a tick and its half-width
    expect(arrive - b.litAt).toBeGreaterThanOrEqual(t.dark.lightSec - 0.02);
    expect(c.drainEvents().some((e) => e.type === 'lit' && e.id === b.id && e.kind === 'yellow')).toBe(true);
    expect(c.tap(arrive).outcome).toBe('hit');
  });

  it('a trap that came dark bites for dark.trapMult of a trap (it was hard to read)', () => {
    const { c, t } = setup({ enemies: ['bandit'] });
    const hp = c.hero.hp;
    const p = c.spawnBlock('purple', 0.3, c.enemies[0].id, undefined, { dark: true });
    go(c, timeAt(t, 0.3));
    expect(unlit(p)).toBe(false);
    expect(c.tap(timeAt(t, 0.3)).outcome).toBe('trap');
    expect(hp - c.hero.hp).toBe(Math.round(c.enemies[0].special * t.dark.trapMult));
  });

  it("the lantern's reach is a time: it widens as the cursor speeds up, and never drops below its minimum", () => {
    const { c, t } = setup();
    const slow = c.lightReach();
    expect(slow).toBeCloseTo(t.dark.lightSec / t.cursor.basePassSec, 5);
    c.combo = 40;
    expect(c.lightReach()).toBeGreaterThan(slow * 1.5);
    c.combo = 0;
    t.dark.lightSec = 0.01;
    t.dark.floorSec = 0.01;
    expect(c.lightReach()).toBeCloseTo(t.dark.lightMin, 5);
  });

  it("an act's dark share makes spawned yellows, greens and traps dark, and some dark yellows are traps in disguise (a yellow's width); none in an act without it", () => {
    const { c, t } = setup({ bar: { dark: { share: 1, fromRow: 0, traps: 0 } } });
    expect(c.trySpawn('yellow', c.enemies[0].id)).toBe(true);
    expect(c.blocks[0]).toMatchObject({ kind: 'yellow', dark: true, litAt: Infinity });
    const { c: tr } = setup({ bar: { dark: { share: 1, fromRow: 0, traps: 1 } } });
    tr.trySpawn('yellow', tr.enemies[0].id);
    expect(tr.blocks[0]).toMatchObject({ kind: 'purple', dark: true });
    expect(tr.blocks[0].width).toBeCloseTo(t.blocks.attackWidth, 5);
    const { c: plain } = setup();
    plain.trySpawn('yellow', plain.enemies[0].id);
    expect(plain.blocks[0].dark).toBe(false);
    const { c: early } = setup({ bar: { dark: { share: 1, fromRow: 3, traps: 0 } }, row: 1 });
    early.trySpawn('yellow', early.enemies[0].id);
    expect(early.blocks[0].dark).toBe(false);
  });

  it('an act without the new rules plays exactly as before (no extra random draws)', () => {
    const run = (bar?: BarRules) => {
      const { c } = setup({ spawning: true, specials: true, enemies: ['bandit'], bar });
      go(c, 6);
      return c.blocks.map((b) => `${b.kind}@${b.pos.toFixed(4)}`).join(',');
    };
    expect(run({})).toBe(run(undefined));
    expect(run({ dark: { share: 0.5, fromRow: 0, traps: 0.5 } })).not.toBe(run(undefined));
  });

  it('a snuff dims the lantern (never below its floor), lit blocks outside it go dark again, and it burns bright again after', () => {
    const { c, t } = setup();
    const near = c.spawnBlock('yellow', 0.05, c.enemies[0].id, undefined, { dark: true });
    const far = c.spawnBlock('yellow', 0.6, c.enemies[0].id, undefined, { dark: true });
    far.litAt = 0; // lit earlier
    go(c, 0.05);
    expect(unlit(near)).toBe(false);
    const full = c.lightReach();
    runAction(c, c.enemies[0], { type: 'snuff', mult: 0.5, sec: 2 });
    expect(c.lightReach()).toBeCloseTo((full * Math.max(t.dark.floorSec, 0.5 * t.dark.lightSec)) / t.dark.lightSec, 5);
    expect(unlit(far)).toBe(true);
    expect(unlit(near)).toBe(false);
    go(c, 2.2);
    expect(c.lightMult).toBe(1);
    expect(c.drainEvents().some((e) => e.type === 'lightBack')).toBe(true);
    // a snuff with no time is for good
    runAction(c, c.enemies[0], { type: 'snuff', mult: 0.7, sec: 0 });
    go(c, 10);
    expect(c.lightMult).toBe(0.7);
  });

  it('darken: yellows outside the light go dark, the farthest first (they keep their kind); a formation can place dark blocks; barRule darkEvery', () => {
    const { c } = setup();
    const a = c.spawnBlock('yellow', 0.5);
    const b = c.spawnBlock('yellow', 0.9);
    const n = c.spawnBlock('yellow', 0.04);
    runAction(c, c.enemies[0], { type: 'darken', count: 1 });
    expect([unlit(a), unlit(b), unlit(n)]).toEqual([false, true, false]);
    expect(b.kind).toBe('yellow');
    runAction(c, c.enemies[0], { type: 'darken', count: 0 });
    expect([unlit(a), unlit(n)]).toEqual([true, false]);
    runAction(c, c.enemies[0], { type: 'formation', blocks: [{ kind: 'purple', at: 0.7, dark: true }] });
    expect(c.blocks.find((x) => x.kind === 'purple')).toMatchObject({ dark: true, litAt: Infinity });
    const { c: r } = setup();
    runAction(r, r.enemies[0], { type: 'barRule', holdEvery: 0, darkEvery: 2 });
    r.trySpawn('yellow', r.enemies[0].id);
    r.trySpawn('yellow', r.enemies[0].id);
    expect(r.blocks.map((x) => x.dark)).toEqual([false, true]);
  });

  const tide = { fromRow: 0, low: 0.1, high: 0.4, period: 8, from: 'right' as const };

  it('the tide starts at low water at its end, swells to its high mark at half its period and falls back', () => {
    const { c } = setup({ bar: { tide } });
    expect(c.waterR).toBeCloseTo(0.1, 5);
    expect(c.waterL).toBe(0);
    go(c, 4);
    expect(c.waterR).toBeCloseTo(0.4, 2);
    go(c, 8);
    expect(c.waterR).toBeCloseTo(0.1, 2);
    // not before its row
    const { c: early } = setup({ bar: { tide: { ...tide, fromRow: 2 } }, row: 1 });
    go(early, 4);
    expect(early.waterR).toBe(0);
  });

  it('a block whose centre is under water is sunk: a tap there is a miss; it surfaces as the water falls and is hit again', () => {
    const { c, t } = setup({ bar: { tide: { ...tide, period: 6 } } });
    const y = c.spawnBlock('yellow', 0.75);
    go(c, 2.9); // high water (0.4 from the right): 0.75 is under
    expect(c.sunk(y)).toBe(true);
    // the cursor's next pass over 0.75
    const at = timeAt(t, 2) + timeAt(t, 1 - 0.75); // left->right, then back to 0.75
    go(c, at);
    expect(c.sunk(y)).toBe(true);
    expect(c.tap(at).outcome).toBe('miss');
    expect(c.blocks.includes(y)).toBe(true);
    go(c, 5.8); // low water again
    expect(c.sunk(y)).toBe(false);
    const back = 4 * t.cursor.basePassSec + timeAt(t, 0.75); // two round trips on, near low water
    go(c, back);
    expect(c.tap(back).outcome).toBe('hit');
  });

  it('ice floats: a frozen block in the water is never sunk and can be hit (Neve shatters what she froze in the shallows)', () => {
    const { c, t } = setup({ bar: { tide: { ...tide, low: 0.4, high: 0.4 } } });
    const f = c.spawnBlock('frozen', 0.8);
    const y = c.spawnBlock('yellow', 0.9);
    go(c, timeAt(t, 0.8));
    expect(c.wet(0.8)).toBe(true);
    expect(c.sunk(f)).toBe(false);
    expect(c.sunk(y)).toBe(true);
    expect(c.tap(timeAt(t, 0.8)).outcome).toBe('hit');
  });

  it("a Marksman's target stands above the tide on its post and lights itself: never sunk, never dark (another hero's green: both)", () => {
    for (const hero of ['vesper', 'rowan'] as const) {
      const { c, t } = setup({ hero, bar: { tide: { ...tide, low: 0.4, high: 0.4 }, dark: { share: 1, fromRow: 0, traps: 0 } } });
      const g = c.spawnBlock('green', 0.8, c.enemies[0].id, undefined, { dark: true });
      go(c, timeAt(t, 0.8));
      expect(c.sunk(g), hero).toBe(hero === 'rowan');
      expect(g.dark, hero).toBe(hero === 'rowan');
      expect(c.tap(timeAt(t, 0.8)).outcome, hero).toBe(hero === 'rowan' ? 'miss' : 'hit');
      // a darkening leaves targets alone
      const g2 = c.spawnBlock('green', 0.3);
      c.darken(0);
      expect(g2.dark, hero).toBe(hero === 'rowan');
    }
  });

  it('reds wade through the water (slower), and new blocks only come on dry ground', () => {
    const wet = setup({ bar: { tide: { ...tide, low: 0.4 } } }).c;
    const dry = setup().c;
    const rw = wet.spawnBlock('red', 0.9);
    const rd = dry.spawnBlock('red', 0.9);
    go(wet, 0.5);
    go(dry, 0.5);
    expect(0.9 - rw.pos).toBeCloseTo((0.9 - rd.pos) * wet.tuning.tide.drag, 2);
    for (let k = 0; k < 6; k++) wet.trySpawn('yellow', wet.enemies[0].id);
    for (const b of wet.blocks) if (!isRed(b.kind)) expect(b.pos + b.width / 2).toBeLessThanOrEqual(1 - wet.waterR);
  });

  it('a surge: the water rushes up to its level and holds, then ebbs; with no time it floods for good; both ends; never over 0.6 of the bar', () => {
    const { c, t } = setup();
    runAction(c, c.enemies[0], { type: 'tide', level: 0.4, sec: 2 });
    go(c, 0.4 / t.tide.surgeSpeed + 0.05);
    expect(c.waterR).toBeCloseTo(0.4, 5);
    expect(c.waterL).toBe(0);
    go(c, 2.05);
    expect(c.drainEvents().some((e) => e.type === 'ebb')).toBe(true);
    go(c, 4.5);
    expect(c.waterR).toBe(0);
    runAction(c, c.enemies[0], { type: 'tide', level: 0.5, sec: 0, from: 'both' });
    go(c, 20);
    expect(c.waterL + c.waterR).toBeCloseTo(0.6, 5);
    expect(c.waterL).toBeCloseTo(c.waterR, 5);
  });

  it('every hero can hit a dark yellow once lit, and is stopped by the water like anyone (one cursor each)', () => {
    for (const hero of HERO_IDS) {
      const { c, t } = setup({ enemies: ['bandit'], hero, bar: { tide: { ...tide, low: 0.3, high: 0.3 } } });
      const d = c.spawnBlock('yellow', 0.4, c.enemies[0].id, undefined, { dark: true });
      const s = c.spawnBlock('yellow', 0.85);
      go(c, timeAt(t, 0.4));
      expect(unlit(d), hero).toBe(false);
      expect(c.tap(timeAt(t, 0.4)).outcome, hero).toBe('hit');
      go(c, timeAt(t, 0.85));
      expect(c.tap(timeAt(t, 0.85)).outcome, hero).toBe('miss');
      expect(c.blocks.includes(s), hero).toBe(true);
    }
  });
});

describe('the fifth region: mirages and heat', () => {
  it('a mirage shows where it will land (at least warnSec before), then hops there; the tap is judged where it is now', () => {
    const { c, t } = setup();
    // the cursor starts at the left end heading right: a mirage far to the right, due to hop soon
    const b = c.spawnBlock('yellow', 0.85, c.enemies[0].id, undefined, { mirage: true });
    b.hopAt = c.motionTime + t.mirage.warnSec;
    go(c, 0.05);
    const warn = c.drainEvents().find((e) => e.type === 'hopWarn');
    expect(warn).toBeDefined();
    const to = b.hopTo;
    expect(Math.abs(to - 0.85)).toBeGreaterThanOrEqual(t.mirage.minHop);
    const shownAt = c.time;
    // it waits while the cursor is near either spot; once it hops, it's at the spot it showed
    for (let k = 0; k < 600 && b.pos === 0.85; k++) c.step();
    expect(b.pos).toBe(to);
    expect(c.time - shownAt).toBeGreaterThanOrEqual(t.mirage.warnSec - 0.06);
    expect(c.drainEvents().some((e) => e.type === 'hop' && e.id === b.id)).toBe(true);
  });

  it('a mirage never hops while the cursor is close to it or to where it would land', () => {
    const { c, t } = setup();
    for (let k = 0; k < 6000; k++) {
      if (!c.blocks.some((x) => x.hopAt !== Infinity)) c.spawnBlock('yellow', 0.2 + (k % 7) * 0.1, c.enemies[0].id, undefined, { mirage: true });
      const before = c.blocks.map((x) => [x.id, x.pos] as const);
      c.step();
      for (const e of c.drainEvents())
        if (e.type === 'hop') {
          const reach = t.mirage.safeSec * c.cursorSpeed();
          expect(Math.abs(e.from - c.cursorPos())).toBeGreaterThan(reach - 0.02);
          expect(Math.abs(e.to - c.cursorPos())).toBeGreaterThan(reach - 0.02);
          expect(before.some(([id]) => id === e.id)).toBe(true);
        }
    }
  });

  it("an act's mirage and heat shares make spawned yellows mirages and blazing (and none in an act without them)", () => {
    const { c } = setup({ bar: { mirage: { share: 1, fromRow: 0, every: 2.5 }, heat: { share: 1, fromRow: 0 } } });
    c.trySpawn('yellow', c.enemies[0].id);
    expect(c.blocks[0].hopAt).toBeLessThan(Infinity);
    expect(c.blocks[0].blaze).toBe(true);
    const { c: plain } = setup();
    plain.trySpawn('yellow', plain.enemies[0].id);
    expect(plain.blocks[0]).toMatchObject({ hopAt: Infinity, blaze: false });
  });

  it('a blazing yellow hits harder and gives Heat: it burns HP a little at a time (the combo holds), stacks to a max, and a green cools it', () => {
    const { c, t } = setup({ enemies: ['bandit'] });
    const plain = setup({ enemies: ['bandit'] }).c;
    for (const x of [c, plain]) x.spawnBlock('yellow', 0.3, x.enemies[0].id, undefined, { blaze: x === c });
    const at = timeAt(t, 0.3);
    for (const x of [c, plain]) {
      x.advanceTo(at);
      x.tap(at);
    }
    expect(140 - c.enemies[0].hp).toBe(Math.round((140 - plain.enemies[0].hp) * t.heat.mult));
    expect(c.heat).toBe(1);
    const hp = c.hero.hp;
    c.advanceTo(at + 2);
    expect(c.hero.hp).toBeLessThan(hp);
    expect(c.combo).toBe(1);
    // more stacks, never past the max
    for (let k = 0; k < 5; k++) (c as unknown as { addHeat(): void }).addHeat();
    expect(c.heat).toBe(t.heat.max);
    // a green cools it all
    c.spawnBlock('green', 0.7);
    const g = 2 * t.cursor.basePassSec - timeAt(t, 0.7) + 2 * t.cursor.basePassSec;
    c.advanceTo(g);
    c.tap(g);
    expect(c.heat).toBe(0);
    expect(c.drainEvents().some((e) => e.type === 'cool')).toBe(true);
    // ...and with no green it burns out after heat.sec
    const { c: d } = setup({ enemies: ['bandit'] });
    (d as unknown as { addHeat(): void }).addHeat();
    d.advanceTo(t.heat.sec + 0.05);
    expect(d.heat).toBe(0);
  });

  it('every hero can hit a mirage after it hops and a blazing yellow (one cursor each)', () => {
    for (const hero of HERO_IDS) {
      const { c, t } = setup({ enemies: ['bandit'], hero });
      const m = c.spawnBlock('yellow', 0.8, c.enemies[0].id, undefined, { mirage: true });
      m.hopAt = 0;
      for (let k = 0; k < 400 && m.pos === 0.8; k++) c.step();
      expect(m.pos, hero).not.toBe(0.8);
      m.hopAt = Infinity; // (no second hop in this test)
      // the next time the cursor crosses it
      const ph = c.cursorPhase;
      const base = Math.floor(ph / 2) * 2;
      const at = [base + m.pos, base + 2 - m.pos, base + 2 + m.pos].filter((x) => x > ph + 1e-6).map((x) => c.time + (x - ph) / c.cursorSpeed())[0];
      c.advanceTo(at);
      expect(['hit'], hero).toContain(c.tap(at).outcome);
      const { c: b } = setup({ enemies: ['bandit'], hero });
      b.spawnBlock('yellow', 0.4, b.enemies[0].id, undefined, { blaze: true });
      b.advanceTo(timeAt(t, 0.4));
      expect(b.tap(timeAt(t, 0.4)).outcome, hero).toBe('hit');
      expect(b.heat, hero).toBe(1);
    }
  });
});
