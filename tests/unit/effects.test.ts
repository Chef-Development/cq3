// Gear in a fight: the stats (Defense, Steady, Meter gain, Companion power), the four signature effects, the
// general Legendary effects and the two sets.
import { describe, expect, it } from 'vitest';
import type { EffectId, SetId, StatId } from '../../src/data/gear';
import { killCoins, newHero } from '../../src/core/combat';
import { zeroStats, type Loadout } from '../../src/core/gear';
import { setup, timeAt } from './helpers';
import type { Tuning } from '../../src/core/tuning';

const slowReds = (t: Tuning) => (t.blocks.redTravelSec = 10000);

function gear(effects: EffectId[] = [], sets: Partial<Record<SetId, number>> = {}, stats: Partial<Record<StatId, number>> = {}): Loadout {
  return { stats: { ...zeroStats(), ...stats }, effects, sets };
}

describe('gear stats in a fight', () => {
  it('Defense cuts the damage of a red that gets through (not traps)', () => {
    const { c, t } = setup();
    c.hero.gear = gear([], {}, { def: t.gear.defScale });
    c.spawnBlock('red', 0.05);
    c.advanceTo(0.5);
    expect(c.hero.hp).toBe(100 - Math.round(t.enemies.slime.atk / 2));
  });

  it('Meter gain fills the finisher meter faster', () => {
    const a = setup();
    const b = setup();
    b.c.hero.gear = gear([], {}, { meterGain: 0.5 });
    for (const { c, t } of [a, b]) {
      c.spawnBlock('yellow', 0.3);
      c.advanceTo(timeAt(t, 0.3) + 0.01);
      c.tap(timeAt(t, 0.3));
    }
    // +50% Meter Gain: in full up to tuning.spam.meterKnee, the rest with diminishing returns (tests/unit/spam.test.ts)
    expect(b.c.meter).toBeCloseTo(a.c.meter * (1 + b.c.meterGain()));
    expect(b.c.meter).toBeGreaterThan(a.c.meter * 1.3);
  });

  it('Companion power adds to every peck', () => {
    const { c, t } = setup({ tune: (t) => (t.companion.everyHits = 1) });
    c.hero.gear = gear([], {}, { companion: 10 });
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(timeAt(t, 0.3) + 0.01);
    c.tap(timeAt(t, 0.3));
    const pet = c.drainEvents().find((e) => e.type === 'pet');
    expect(pet && pet.type === 'pet' && pet.damage).toBe(t.companion.damage + 10);
  });
});

describe('signature effects', () => {
  it("Captain's Cutlass: a bomb you tap always crits", () => {
    const { c, t } = setup({ tune: slowReds });
    c.hero.gear = gear(['cutlass']);
    c.spawnBlock('bomb', 0.5);
    c.advanceTo(1);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('block');
    const dmg = Math.round(t.blocks.bombDamage * t.hero.critDmg);
    expect(c.enemies[0].hp).toBe(80 - dmg);
    expect(c.drainEvents().some((e) => e.type === 'enemyHurt' && e.crit && e.source === 'bomb')).toBe(true);
  });

  it('Golemheart Plate: blocking a red heals 1 HP', () => {
    const { c, t } = setup({ tune: slowReds });
    c.hero.gear = gear(['golemheart']);
    c.hero.hp = 50;
    c.spawnBlock('red', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.5));
    expect(c.hero.hp).toBe(51);
  });

  it('Tusk Crown: each finisher stack spent gives +5% crit for 5 s', () => {
    const { c, t } = setup();
    c.hero.gear = gear(['tuskCrown']);
    c.enemies[0].hp = c.enemies[0].maxHp = 5000; // the fight goes on (the clock stops when it's won)
    c.stacks = 3;
    c.finisher();
    expect(c.tuskCrit).toBeCloseTo(0.15);
    c.advanceTo(c.time + t.effects.tuskSec - 0.5);
    expect(c.tuskCrit).toBeCloseTo(0.15);
    c.advanceTo(c.time + 1);
    expect(c.tuskCrit).toBe(0);
  });

  it('Keystone Shard: every 10th combo hit spawns a green block', () => {
    const { c, t } = setup();
    c.hero.gear = gear(['pendulum']);
    c.combo = 9;
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(timeAt(t, 0.3) + 0.01);
    c.tap(timeAt(t, 0.3));
    expect(c.combo).toBe(10);
    expect(c.blocks.filter((b) => b.kind === 'green')).toHaveLength(1);
    c.spawnBlock('yellow', 0.7);
    c.advanceTo(timeAt(t, 0.7) + 0.01);
    c.tap(timeAt(t, 0.7));
    expect(c.blocks.filter((b) => b.kind === 'green')).toHaveLength(1); // the 11th hit spawns nothing
  });
});

describe('general Legendary effects', () => {
  it('Opening Blow: the first hit on each foe crits', () => {
    const { c, t } = setup();
    c.hero.gear = gear(['opener']);
    for (const p of [0.3, 0.6]) {
      c.spawnBlock('yellow', p);
      c.advanceTo(timeAt(t, p) + 0.01);
      c.tap(timeAt(t, p));
    }
    const hits = c.drainEvents().filter((e) => e.type === 'hit');
    expect(hits.map((h) => h.type === 'hit' && h.crit)).toEqual([true, false]);
  });

  it('Leech: crits heal 2 HP', () => {
    const { c, t } = setup({ tune: (t) => (t.hero.critChance = 1) });
    c.hero.gear = gear(['leech']);
    c.hero.hp = 50;
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(timeAt(t, 0.3) + 0.01);
    c.tap(timeAt(t, 0.3));
    expect(c.hero.hp).toBe(50 + t.effects.leechHp);
  });

  it('Riposte: a blocked red hits its owner for half your attack', () => {
    const { c, t } = setup({ tune: slowReds });
    c.hero.gear = gear(['riposte']);
    c.spawnBlock('red', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.5));
    expect(c.enemies[0].hp).toBe(80 - Math.round(t.hero.atk * t.effects.riposte));
  });

  it('Golden Touch: kills drop 50% more coins', () => {
    const { t } = setup();
    const h = newHero(t, gear(['goldTouch']));
    expect(killCoins(t, h, 'captain')).toBe(Math.round(t.enemies.captain.coins * 1.5));
  });

  it('Owl Eye: Pip pecks every 3 hits', () => {
    const { c, t } = setup({ tune: (t) => (t.companion.everyHits = 4) });
    c.hero.gear = gear(['owlEye']);
    for (const p of [0.2, 0.4, 0.6]) {
      c.spawnBlock('yellow', p);
      c.advanceTo(timeAt(t, p) + 0.01);
      c.tap(timeAt(t, p));
    }
    expect(c.drainEvents().filter((e) => e.type === 'pet')).toHaveLength(1);
  });

  it('Second Wind: once a fight, dropping under 30% HP heals 20%', () => {
    const { c, t } = setup();
    c.hero.gear = gear(['secondWind']);
    c.hero.hp = 29 + t.enemies.slime.atk;
    c.spawnBlock('red', 0.05);
    c.advanceTo(0.5);
    expect(c.hero.hp).toBe(29 + 20);
    c.hero.hp = 20;
    c.spawnBlock('red', 0.05);
    c.advanceTo(1);
    expect(c.hero.hp).toBe(20 - t.enemies.slime.atk); // only once
  });
});

describe('sets', () => {
  it("Footpad 2-piece: the fight's first miss doesn't break the combo (or hurt); the second does", () => {
    const { c } = setup();
    c.hero.gear = gear([], { footpad: 2 });
    c.combo = 7;
    c.stacks = 1;
    c.advanceTo(0.5);
    expect(c.tap(c.time).outcome).toBe('miss');
    expect(c.combo).toBe(7);
    expect(c.stacks).toBe(1);
    expect(c.hero.hp).toBe(100);
    c.advanceTo(0.7);
    c.tap(c.time);
    expect(c.combo).toBe(0);
    const one = setup();
    one.c.hero.gear = gear([], { footpad: 1 });
    one.c.combo = 7;
    one.c.advanceTo(0.5);
    one.c.tap(one.c.time);
    expect(one.c.combo).toBe(0);
  });

  it('Greenwarden 4-piece: kills heal 3%', () => {
    const { c, t } = setup();
    c.hero.gear = gear([], { greenwarden: 4 });
    c.hero.hp = 50;
    c.enemies[0].hp = 1;
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(timeAt(t, 0.3) + 0.01);
    c.tap(timeAt(t, 0.3));
    expect(c.hero.hp).toBe(50 + Math.round(110 * 0.03)); // 2-piece too: 110 max HP
  });
});

describe('timing samples (the accuracy readout)', () => {
  it('records how late or early a tap on a yellow was, hit or miss', () => {
    const { c, t } = setup();
    c.spawnBlock('yellow', 0.3);
    c.spawnBlock('yellow', 0.7);
    c.advanceTo(timeAt(t, 0.3) + 0.03);
    c.tap(timeAt(t, 0.3) + 0.02); // 20 ms late: a hit
    c.advanceTo(timeAt(t, 0.7) + 0.2);
    c.tap(timeAt(t, 0.7) - 0.09); // 90 ms early: a miss, but aimed at the yellow
    expect(c.aims).toHaveLength(2);
    expect(c.aims[0]).toBeCloseTo(20, -1);
    expect(c.aims[1]).toBeLessThan(-60); // (the combo sped the cursor up a little, so it crossed sooner)
    expect(c.aims[1]).toBeGreaterThan(-100);
  });

  it('ignores taps aimed at reds', () => {
    const { c, t } = setup({ tune: slowReds });
    c.spawnBlock('red', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.5));
    expect(c.aims).toHaveLength(0);
  });
});
