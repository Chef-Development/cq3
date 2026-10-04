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
  it('needs at least one banked stack', () => {
    const { c } = setup();
    c.meter = 0.99;
    expect(c.finisher()).toBe(false);
  });

  it('a full meter banks a stack and starts filling the next one', () => {
    const { c, t } = setup({ tune: (t) => (t.meter.perHit = 0.6) });
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.35);
    c.tap(timeAt(t, 0.23));
    c.advanceTo(0.8);
    c.tap(timeAt(t, 0.53));
    expect(c.stacks).toBe(1);
    expect(c.meter).toBeCloseTo(0.2);
    expect(c.finisherReady).toBe(true);
    expect(c.drainEvents().filter((e) => e.type === 'meterFull')).toEqual([{ type: 'meterFull', stacks: 1 }]);
  });

  it('stacks cap at maxStacks with the meter held full', () => {
    const { c, t } = setup({ tune: (t) => ((t.meter.perHit = 1), (t.meter.maxStacks = 2)) });
    for (const p of [0.15, 0.4, 0.65]) c.spawnBlock('yellow', p);
    for (const p of [0.15, 0.4, 0.65]) {
      c.advanceTo(timeAt(t, p));
      c.tap(timeAt(t, p));
    }
    expect(c.stacks).toBe(2);
    expect(c.meter).toBe(1);
  });

  it('damage grows as stacks ^ stackExp (exponent 1.9: 2 stacks ~ 3.7x one, 3 stacks ~ 8x)', () => {
    const { c, t } = setup({ tune: (t) => (t.meter.stackExp = 1.9) });
    const one = c.finisherDamage(1);
    expect(one).toBe(t.hero.atk * t.hero.comboPower);
    expect(c.finisherDamage(2) / one).toBeCloseTo(Math.pow(2, t.meter.stackExp), 1);
    expect(c.finisherDamage(3)).toBeGreaterThan(8 * one - 1);
  });

  it('a combo break loses every banked stack and the meter', () => {
    const { c } = setup({ settings: { mode: 'relaxed' } });
    c.stacks = 3;
    c.meter = 0.5;
    c.combo = 20;
    c.advanceTo(0.1);
    c.tap(0.1); // empty bar
    expect(c.stacks).toBe(0);
    expect(c.meter).toBe(0);
    expect(c.finisherReady).toBe(false);
    expect(c.drainEvents().find((e) => e.type === 'comboBreak')).toMatchObject({ lost: 20, lostStacks: 3 });
  });

  it('taking a hit also loses the stacks', () => {
    const { c, t } = setup();
    c.stacks = 2;
    c.spawnBlock('red', 0.05);
    c.advanceTo(1);
    expect(c.hero.hp).toBe(100 - t.enemies.slime.atk);
    expect(c.stacks).toBe(0);
  });

  it('uses every stack, knocks every red off the bar, resets speed, consumes combo', () => {
    const { c } = setup({ tune: (t) => ((t.blocks.redTravelSec = 10000), (t.enemies.slime.hp = 1000)) });
    c.spawnBlock('red', 0.3);
    c.spawnBlock('shield', 0.8);
    const y = c.spawnBlock('yellow', 0.5);
    c.stacks = 2;
    c.combo = 10;
    c.speedStacks = 1;
    const dmg = c.finisherDamage();
    expect(c.finisher()).toBe(true);
    expect(c.enemies[0].hp).toBe(1000 - dmg);
    const ev = c.drainEvents();
    expect(ev.find((e) => e.type === 'finisher')).toMatchObject({ damage: dmg, combo: 10, stacks: 2 });
    expect(ev.filter((e) => e.type === 'remove' && e.reason === 'finisher')).toHaveLength(2);
    expect(c.blocks).toEqual([y]);
    expect(c.combo).toBe(0);
    expect(c.stacks).toBe(0);
    expect(c.meter).toBe(0);
    expect(c.speedMult()).toBe(1);
  });

  it('enemies keep attacking on schedule after a finisher', () => {
    const { c } = setup({ spawning: true, tune: (t) => ((t.enemies.slime.hp = 5000), (t.enemies.slime.pattern = 'R'), (t.enemies.slime.interval = 0.5)) });
    c.advanceTo(1.2);
    expect(c.blocks.some((b) => b.kind === 'red')).toBe(true);
    c.stacks = 1;
    c.finisher();
    expect(c.blocks.some((b) => b.kind === 'red')).toBe(false);
    c.advanceTo(1.8);
    expect(c.blocks.some((b) => b.kind === 'red')).toBe(true);
  });

  it('uses boosted combo power and combo tiers', () => {
    const { c, t } = setup({ settings: { comboTiers: true }, tune: (t) => (t.enemies.slime.hp = 1000) });
    c.hero.bonusComboPower = 1;
    c.stacks = 1;
    c.combo = 25;
    c.finisher();
    expect(c.enemies[0].hp).toBe(1000 - t.hero.atk * (t.hero.comboPower + 1) * t.tiers.m2);
  });

  it('hits every enemy and triggers hit-stop', () => {
    const { c, t } = setup({ enemies: ['slime', 'slime', 'bandit'], tune: (t) => ((t.juice.hitStopMs = 50), (t.hero.comboPower = 1)) });
    c.stacks = 1;
    c.finisher();
    expect(c.enemies.map((e) => e.hp)).toEqual([80 - t.hero.atk, 80 - t.hero.atk, 140 - t.hero.atk]);
    expect(c.hitStop).toBeCloseTo(0.05);
  });
});
