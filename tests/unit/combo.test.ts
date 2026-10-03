import { describe, expect, it } from 'vitest';
import { setup, timeAt } from './helpers';

describe('combo and speed rules', () => {
  it('+1 combo per hit or block; speed rises with combo', () => {
    const { c, t } = setup({ tune: (t) => (t.blocks.redTravelSec = 10000) });
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('red', 0.5);
    c.advanceTo(0.35);
    c.tap(timeAt(t, 0.2));
    expect(c.combo).toBe(1);
    expect(c.speedMult()).toBeCloseTo(1.02);
    c.advanceTo(0.72);
    c.tap(c.time); // cursor ~0.51: on the red block
    expect(c.combo).toBe(2);
    c.advanceTo(0.9);
    c.tap(c.time); // cursor ~0.64: empty -> miss
    expect(c.combo).toBe(0);
  });

  it('taking damage resets combo and speed (combo and speed-block stacks)', () => {
    const { c, t } = setup();
    c.combo = 20;
    c.speedStacks = 2;
    expect(c.speedMult()).toBeGreaterThan(1.5);
    c.spawnBlock('red', 0.05);
    c.advanceTo(0.5);
    expect(c.hero.hp).toBe(100 - t.enemies.slime.atk);
    expect(c.combo).toBe(0);
    expect(c.speedStacks).toBe(0);
    expect(c.speedMult()).toBe(1);
  });

  it('combo tiers multiply hit damage at 10/25/50 when enabled', () => {
    for (const [prev, mult] of [
      [8, 1],
      [9, 1.5],
      [24, 2],
      [49, 3],
    ] as const) {
      const { c, t } = setup({ settings: { comboTiers: true }, tune: (t) => ((t.enemies.slime.hp = 1000), (t.cursor.speedPerHit = 0)) });
      c.combo = prev;
      c.spawnBlock('yellow', 0.5);
      c.advanceTo(1);
      c.tap(timeAt(t, 0.53));
      expect(c.enemies[0].hp, `combo ${prev + 1}`).toBe(1000 - t.hero.atk * mult);
    }
    const off = setup({ tune: (t) => ((t.enemies.slime.hp = 1000), (t.cursor.speedPerHit = 0)) });
    off.c.combo = 49;
    off.c.spawnBlock('yellow', 0.5);
    off.c.advanceTo(1);
    off.c.tap(timeAt(off.t, 0.53));
    expect(off.c.enemies[0].hp).toBe(1000 - off.t.hero.atk);
  });

  it('god mode takes no HP but still breaks the combo', () => {
    const { c } = setup({ settings: { godMode: true } });
    c.combo = 3;
    c.advanceTo(0.5);
    c.tap(0.5);
    expect(c.hero.hp).toBe(100);
    expect(c.combo).toBe(0);
  });
});

describe('finisher', () => {
  it('needs a full meter', () => {
    const { c } = setup();
    c.meter = 0.99;
    expect(c.finisher()).toBe(false);
  });

  it('meter fills per hit and reports when full', () => {
    const { c, t } = setup({ tune: (t) => (t.meter.perHit = 0.5) });
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.35);
    c.tap(timeAt(t, 0.23));
    c.advanceTo(0.8);
    c.tap(timeAt(t, 0.53));
    expect(c.meter).toBe(1);
    expect(c.finisherReady).toBe(true);
    expect(c.drainEvents().some((e) => e.type === 'meterFull')).toBe(true);
  });

  it('deals combo x combo power, pushes reds back 40%, resets speed, consumes combo', () => {
    const { c, t } = setup({ tune: (t) => (t.blocks.redTravelSec = 10000) });
    const r1 = c.spawnBlock('red', 0.3);
    const r2 = c.spawnBlock('red', 0.8);
    c.meter = 1;
    c.combo = 10;
    c.speedStacks = 1;
    expect(c.finisher()).toBe(true);
    expect(c.enemies[0].hp).toBe(80 - 10 * t.hero.comboPower);
    expect(r1.pos).toBeCloseTo(0.7);
    expect(r2.pos).toBeCloseTo(1 - r2.width / 2);
    expect(c.combo).toBe(0);
    expect(c.meter).toBe(0);
    expect(c.speedMult()).toBe(1);
  });

  it('uses boosted combo power and combo tiers', () => {
    const { c, t } = setup({ settings: { comboTiers: true }, tune: (t) => (t.enemies.slime.hp = 1000) });
    c.hero.bonusComboPower = 1;
    c.meter = 1;
    c.combo = 25;
    c.finisher();
    expect(c.enemies[0].hp).toBe(1000 - 25 * (t.hero.comboPower + 1) * t.tiers.m2);
  });

  it('hits every enemy and triggers hit-stop', () => {
    const { c } = setup({ enemies: ['slime', 'slime', 'bandit'], tune: (t) => (t.juice.hitStopMs = 50) });
    c.meter = 1;
    c.combo = 5;
    c.finisher();
    expect(c.enemies.map((e) => e.hp)).toEqual([70, 70, 130]);
    expect(c.hitStop).toBeCloseTo(0.05);
  });
});
