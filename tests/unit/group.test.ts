import { describe, expect, it } from 'vitest';
import { Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { setup, timeAt } from './helpers';

const group = ['slime', 'slime', 'bandit'];

describe('group targeting', () => {
  it('Auto targets the front enemy', () => {
    const { c, t } = setup({ enemies: group });
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.53));
    expect(c.enemies.map((e) => e.hp)).toEqual([70, 80, 140]);
  });

  it('Tap-to-target hits the selected enemy; Auto ignores a selection', () => {
    const tap = setup({ enemies: group, settings: { targeting: 'tap' } });
    expect(tap.c.setTarget(tap.c.enemies[2].id)).toBe(true);
    tap.c.spawnBlock('yellow', 0.5);
    tap.c.advanceTo(1);
    tap.c.tap(timeAt(tap.t, 0.53));
    expect(tap.c.enemies.map((e) => e.hp)).toEqual([80, 80, 130]);

    const auto = setup({ enemies: group });
    auto.c.setTarget(auto.c.enemies[2].id);
    expect(auto.c.currentTarget()?.id).toBe(auto.c.enemies[0].id);
  });

  it('falls back to the front enemy when the target dies', () => {
    const { c } = setup({ enemies: group, settings: { targeting: 'tap' } });
    c.setTarget(c.enemies[1].id);
    c.enemies[1].hp = 0;
    c.enemies[1].alive = false;
    expect(c.currentTarget()?.id).toBe(c.enemies[0].id);
    expect(c.setTarget(c.enemies[1].id)).toBe(false);
  });

  it('a dead enemy takes its red/purple blocks with it; yellow stays', () => {
    const { c, t } = setup({ enemies: group, tune: (t) => (t.blocks.redTravelSec = 10000) });
    const front = c.enemies[0];
    front.hp = 5;
    const red = c.spawnBlock('red', 0.8, front.id);
    const trap = c.spawnBlock('purple', 0.2, front.id);
    const other = c.spawnBlock('red', 0.65, c.enemies[2].id);
    const yellow = c.spawnBlock('yellow', 0.4, front.id);
    const y2 = c.spawnBlock('yellow', 0.5, front.id);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.5));
    expect(front.alive).toBe(false);
    expect(c.killQueue).toEqual([front.id]);
    expect(c.blocks).not.toContain(red);
    expect(c.blocks).not.toContain(trap);
    expect(c.blocks).not.toContain(y2);
    expect(c.blocks).toContain(other);
    expect(c.blocks).toContain(yellow);
    expect(c.currentTarget()?.id).toBe(c.enemies[1].id);
  });

  it("each red block hits with its owner's attack", () => {
    const { c, t } = setup({ enemies: group });
    c.spawnBlock('red', 0.05, c.enemies[2].id);
    c.advanceTo(0.5);
    expect(c.hero.hp).toBe(100 - t.enemies.bandit.atk);
  });

  it('winning requires every enemy dead', () => {
    const { c } = setup({ enemies: group });
    c.stacks = 5;
    c.finisher();
    expect(c.result).toBe('won');
  });
});

describe('run flow: boosts, stages, revive', () => {
  const make = () => {
    const t = cloneTuning();
    t.hero.critChance = 0;
    t.juice.hitStopMs = 0;
    return new Run(t, { ...DEFAULT_SETTINGS }, 7);
  };

  it('kill -> pick 1 of 3 boosts -> next enemy, boosts persist', () => {
    const r = make();
    r.startLevel(0);
    const c = r.combat!;
    c.stacks = 5;
    c.finisher();
    r.sync();
    expect(r.phase).toBe('boost');
    expect(r.boostChoices).toHaveLength(3);
    expect(new Set(r.boostChoices).size).toBe(3);
    const i = r.boostChoices.indexOf('damage');
    r.pickBoost(i >= 0 ? i : 0);
    expect(r.phase).toBe('fight');
    expect(r.stageIndex).toBe(1);
    expect(r.combat!.enemies[0].key).toBe('boar');
    if (i >= 0) expect(r.hero.bonusDmg).toBeCloseTo(0.2);
  });

  it('group: a kill shows boosts then resumes the same fight', () => {
    const r = make();
    r.startLevel(1);
    const c = r.combat!;
    expect(c.enemies).toHaveLength(3);
    c.enemies[0].hp = 1;
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1);
    c.tap(0.7);
    r.sync();
    expect(r.phase).toBe('boost');
    r.pickBoost(0);
    expect(r.phase).toBe('fight');
    expect(r.combat).toBe(c);
  });

  it('boost effects', () => {
    const r = make();
    r.startLevel(0);
    r.hero.hp = 10;
    r.phase = 'boost';
    r.pendingBoosts = 2;
    r.boostChoices = ['heal', 'maxHp', 'crit'];
    r.pickBoost(0);
    expect(r.hero.hp).toBe(100);
    r.boostChoices = ['maxHp', 'crit', 'critDmg'];
    r.pickBoost(0);
    expect(r.hero.hp).toBe(120);
  });

  it('one revive per level, then defeat', () => {
    const r = make();
    r.startLevel(0);
    const c = r.combat!;
    c.spawning = false;
    r.hero.hp = 1;
    c.spawnBlock('red', 0.05);
    c.advanceTo(0.5);
    r.sync();
    expect(r.phase).toBe('fight');
    expect(r.hero.hp).toBe(50);
    expect(r.hero.revives).toBe(0);
    r.hero.hp = 1;
    c.spawnBlock('red', 0.05);
    c.advanceTo(1);
    r.sync();
    expect(r.phase).toBe('defeat');
    r.retry();
    expect(r.phase).toBe('fight');
    expect(r.hero.revives).toBe(1);
    expect(r.hero.hp).toBe(100);
  });
});

describe('kill rewards and companion', () => {
  it('heals a fraction of max HP on every kill, capped at max', () => {
    const { c, t } = setup({ enemies: ['slime', 'slime'], tune: (t) => ((t.hero.healOnKill = 0.15), (t.cursor.speedPerHit = 0)) });
    c.hero.hp = 50;
    c.enemies[0].hp = 1;
    c.spawnBlock('yellow', 0.5);
    c.spawnBlock('yellow', 0.65);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.53));
    expect(c.hero.hp).toBe(65);
    expect(c.drainEvents().some((e) => e.type === 'heal' && e.amount === 15)).toBe(true);
    c.hero.hp = 95;
    c.enemies[1].hp = 1;
    c.advanceTo(1.1);
    c.tap(timeAt(t, 0.66));
    expect(c.hero.hp).toBe(100);
  });

  it('the companion pecks the target after every N attack hits', () => {
    const { c, t } = setup({ tune: (t) => ((t.companion.everyHits = 2), (t.companion.damage = 6), (t.cursor.speedPerHit = 0)) });
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.35);
    c.tap(timeAt(t, 0.23));
    expect(c.enemies[0].hp).toBe(70);
    c.advanceTo(0.8);
    c.tap(timeAt(t, 0.53));
    expect(c.enemies[0].hp).toBe(80 - 10 - 10 - 6);
    expect(c.drainEvents().filter((e) => e.type === 'pet')).toHaveLength(1);
  });

  it('collects coins for every kill across the run', () => {
    const t = cloneTuning();
    t.juice.hitStopMs = 0;
    const r = new Run(t, { ...DEFAULT_SETTINGS }, 3);
    r.startLevel(0);
    const c = r.combat!;
    c.stacks = 5;
    c.finisher();
    r.sync();
    expect(r.coins).toBe(t.enemies.slime.coins);
  });
});
