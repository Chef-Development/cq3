// The fifth region's relics (not in play yet; SPOILERS: docs/content-bible.md section 8): each one's rule in a
// fight, with and without it (Mirage: yellows that hop to a spot shown first; Heat: blazing yellows that hit hard and
// burn, a green cools). The region is out of RELICS until its art exists, so a test hands a relic's hooks to the fight
// directly (they are in RELIC_HOOKS already).
import { describe, expect, it } from 'vitest';
import { NOON_RELICS, type NoonRelicId } from '../../src/data/relics-noon';
import { NOON_RELIC_HOOKS } from '../../src/core/relic-fx-noon';
import { RELIC_HOOKS } from '../../src/core/relic-fx';
import type { Combat, CombatEvent } from '../../src/core/combat';
import type { BarRules } from '../../src/data/types';
import { setup, timeAt } from './helpers';

const nOf = (id: NoonRelicId): number => NOON_RELICS.find((r) => r.id === id)?.n ?? 0;

/** A test fight (a sturdy bandit, no spawns), carrying the relic's hooks when `id` is given. */
function fight(id?: NoonRelicId, bar?: BarRules) {
  // (a hotter Heat than the game's, so a burn's rounding doesn't hide a slower one)
  const s = setup({ enemies: ['bandit'], bar, tune: (t) => ((t.enemies.bandit.hp = 5000), (t.heat.dps = 0.05)) });
  s.c.perk.resolve = 1;
  if (id) s.c.hooks.push(NOON_RELIC_HOOKS[id]);
  return s;
}
const both = (id: NoonRelicId, bar?: BarRules) => ({ on: fight(id, bar), off: fight(undefined, bar) });
const perks = (ev: CombatEvent[], id: string) => ev.filter((e) => e.type === 'perk' && e.id === id);
const hitEv = (ev: CombatEvent[]) => ev.find((e) => e.type === 'hit') as Extract<CombatEvent, { type: 'hit' }> | undefined;

/** Hit a yellow at p as the cursor crosses it from the left end (Perfect unless `late` ms): a mirage (that last
 *  hopped `hopped` s before the tap; no hop due during the test), a blazing one, or a plain one. Returns the damage. */
function hit(c: Combat, p: number, o: { mirage?: boolean; blaze?: boolean; hopped?: number; late?: number } = {}): number {
  const hp0 = c.enemies[0].hp;
  const b = c.spawnBlock('yellow', p, c.enemies[0].id, undefined, { mirage: o.mirage, blaze: o.blaze });
  if (o.mirage) b.hopAt = 1e9; // a mirage whose next hop is far off
  const at = timeAt(c.tuning, p) + (o.late ?? 0) / 1000;
  if (o.hopped !== undefined) b.hoppedAt = at - o.hopped;
  c.advanceTo(at);
  c.tap(at);
  return hp0 - c.enemies[0].hp;
}

describe("the fifth region's relics: wired as fight hooks", () => {
  it('every relic has its hooks, in RELIC_HOOKS too', () => {
    for (const r of NOON_RELICS) {
      expect(NOON_RELIC_HOOKS[r.id], r.id).toBeDefined();
      expect(RELIC_HOOKS[r.id], r.id).toBe(NOON_RELIC_HOOKS[r.id]);
    }
  });
});

describe("the fifth region's relics: Mirage", () => {
  it('Oasis Map: hits on mirages deal more (a plain yellow, the same)', () => {
    const { on, off } = both('oasisMap');
    const a = hit(on.c, 0.4, { mirage: true });
    const b = hit(off.c, 0.4, { mirage: true });
    expect(Math.abs(a - b * (1 + nOf('oasisMap') / 100))).toBeLessThanOrEqual(1);
    const p = both('oasisMap');
    expect(hit(p.on.c, 0.4)).toBe(hit(p.off.c, 0.4));
  });

  it('Haze Lens: a mirage hit right after its hop crits, even a late one; one that hopped long ago, no', () => {
    const { on, off } = both('hazeLens');
    hit(on.c, 0.4, { mirage: true, hopped: 0.3, late: 30 });
    hit(off.c, 0.4, { mirage: true, hopped: 0.3, late: 30 });
    const ev = on.c.drainEvents();
    expect(hitEv(ev)?.crit).toBe(true);
    expect(perks(ev, 'hazeLens')).toHaveLength(1);
    expect(hitEv(off.c.drainEvents())?.crit).toBe(false);
    const old = fight('hazeLens');
    hit(old.c, 0.4, { mirage: true, hopped: 5, late: 30 });
    expect(perks(old.c.drainEvents(), 'hazeLens')).toHaveLength(0);
  });

  it('Sand Glass: mirages hop less often', () => {
    const bar: BarRules = { mirage: { share: 0.5, fromRow: 0, every: 2.5 } };
    const { on, off } = both('sandGlass', bar);
    expect(off.c.mirageEvery()).toBeCloseTo(2.5);
    expect(on.c.mirageEvery()).toBeCloseTo(2.5 / (1 - nOf('sandGlass') / 100));
  });

  it('Ghost Step: a mirage hit fills the meter like 2 hits (a plain yellow, like one)', () => {
    const { on, off } = both('ghostStep');
    hit(on.c, 0.4, { mirage: true });
    hit(off.c, 0.4, { mirage: true });
    expect(on.c.meter).toBeGreaterThan(off.c.meter * 1.5);
    expect(perks(on.c.drainEvents(), 'ghostStep')).toHaveLength(1);
    const p = both('ghostStep');
    hit(p.on.c, 0.4);
    hit(p.off.c, 0.4);
    expect(p.on.c.meter).toBeCloseTo(p.off.c.meter);
  });

  it('Sand Dollar: each mirage hit drops a coin (a plain yellow, none)', () => {
    const { on, off } = both('sandDollar');
    hit(on.c, 0.4, { mirage: true });
    hit(off.c, 0.4, { mirage: true });
    expect(on.c.coinsEarned).toBe(nOf('sandDollar'));
    expect(off.c.coinsEarned).toBe(0);
    const p = fight('sandDollar');
    hit(p.c, 0.4);
    expect(p.c.coinsEarned).toBe(0);
  });

  it('Dust Devil: a mirage hit counts extra combo', () => {
    const { on, off } = both('dustDevil');
    hit(on.c, 0.4, { mirage: true });
    hit(off.c, 0.4, { mirage: true });
    expect(on.c.combo - off.c.combo).toBe(nOf('dustDevil'));
  });

  it('Fata Morgana: mirages hop twice as often, and hits on them deal triple', () => {
    const bar: BarRules = { mirage: { share: 0.5, fromRow: 0, every: 2.5 } };
    const { on, off } = both('fataMorgana', bar);
    expect(on.c.mirageEvery()).toBeCloseTo(off.c.mirageEvery() / 2);
    const a = hit(on.c, 0.4, { mirage: true });
    const b = hit(off.c, 0.4, { mirage: true });
    expect(Math.abs(a - b * nOf('fataMorgana'))).toBeLessThanOrEqual(1);
  });
});

describe("the fifth region's relics: Heat", () => {
  /** A blazing hit, then `sec` s of burning: HP lost to the Heat. */
  const burn = (c: Combat, sec: number) => {
    hit(c, 0.3, { blaze: true });
    const hp = c.hero.hp;
    c.advanceTo(c.time + sec);
    return hp - c.hero.hp;
  };

  it('Sunshade: the Heat burns slower', () => {
    const { on, off } = both('sunshade');
    const a = burn(on.c, 3);
    const b = burn(off.c, 3);
    expect(b).toBeGreaterThan(0);
    expect(a).toBeLessThan(b);
  });

  it('Cool Spring: a green that cools the Heat heals; a green with no Heat to cool, no', () => {
    const { on, off } = both('coolSpring');
    for (const c of [on.c, off.c]) {
      hit(c, 0.3, { blaze: true });
      c.hero.hp -= 40;
    }
    const hp = [on.c.hero.hp, off.c.hero.hp];
    for (const c of [on.c, off.c]) {
      c.spawnBlock('green', 0.7);
      const at = c.time + (0.7 - c.cursorPos()) / c.cursorSpeed();
      c.advanceTo(at);
      c.tap(at);
      expect(c.heat).toBe(0);
    }
    expect(on.c.hero.hp - hp[0] - (off.c.hero.hp - hp[1])).toBe(nOf('coolSpring'));
    const dry = fight('coolSpring');
    dry.c.hero.hp -= 40;
    const h0 = dry.c.hero.hp;
    hit(dry.c, 0.3);
    dry.c.spawnBlock('green', 0.7);
    const at = dry.c.time + (0.7 - dry.c.cursorPos()) / dry.c.cursorSpeed();
    dry.c.advanceTo(at);
    dry.c.tap(at);
    expect(perks(dry.c.drainEvents(), 'coolSpring')).toHaveLength(0);
    expect(dry.c.hero.hp).toBeLessThanOrEqual(h0 + 1);
  });

  it('Kindling: blazing hits fill more meter (a plain yellow, the same)', () => {
    const { on, off } = both('kindling');
    hit(on.c, 0.3, { blaze: true });
    hit(off.c, 0.3, { blaze: true });
    expect(on.c.meter).toBeGreaterThan(off.c.meter);
    const p = both('kindling');
    hit(p.on.c, 0.3);
    hit(p.off.c, 0.3);
    expect(p.on.c.meter).toBeCloseTo(p.off.c.meter);
  });

  it('Sun Shard: at full Heat every hit crits, even a late one; below it, no', () => {
    const { on, off } = both('sunShard');
    for (const c of [on.c, off.c]) {
      c.heat = Math.round(c.tuning.heat.max);
      c.heatLeft = 10;
    }
    hit(on.c, 0.4, { late: 30 });
    hit(off.c, 0.4, { late: 30 });
    const ev = on.c.drainEvents();
    expect(hitEv(ev)?.crit).toBe(true);
    expect(perks(ev, 'sunShard')).toHaveLength(1);
    expect(hitEv(off.c.drainEvents())?.crit).toBe(false);
    const low = fight('sunShard');
    hit(low.c, 0.4, { late: 30 });
    expect(hitEv(low.c.drainEvents())?.crit).toBe(false);
  });

  it('Sun Purse: each blazing hit drops a coin (a plain yellow, none)', () => {
    const { on, off } = both('sunPurse');
    hit(on.c, 0.3, { blaze: true });
    hit(off.c, 0.3, { blaze: true });
    expect(on.c.coinsEarned).toBe(nOf('sunPurse'));
    expect(off.c.coinsEarned).toBe(0);
  });

  it('Shade Tree: blocking a red cools a stack of Heat', () => {
    const { on, off } = both('shadeTree');
    for (const c of [on.c, off.c]) {
      c.heat = 2;
      c.heatLeft = 10;
      c.spawnBlock('red', 0.12);
      c.advanceTo(0.05);
      c.tap(0.05);
    }
    expect(off.c.heat).toBe(2);
    expect(on.c.heat).toBe(2 - nOf('shadeTree'));
    expect(perks(on.c.drainEvents(), 'shadeTree')).toHaveLength(1);
  });

  it('Noonday: the Heat never burns, and blazing hits land x1.2 instead of the usual blaze', () => {
    const { on, off } = both('noonday');
    expect(burn(on.c, 3)).toBe(0);
    expect(burn(off.c, 3)).toBeGreaterThan(0);
    const p = both('noonday');
    const a = hit(p.on.c, 0.6, { blaze: true });
    const plain = fight();
    const b = hit(plain.c, 0.6);
    expect(Math.abs(a - b * nOf('noonday'))).toBeLessThanOrEqual(1);
    expect(hit(p.off.c, 0.6, { blaze: true })).toBeGreaterThan(a);
  });
});
