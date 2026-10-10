import { describe, expect, it } from 'vitest';
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

describe('kill rewards and companion', () => {
  it('every kill permanently raises attack, max HP and combo power', () => {
    const { c, t } = setup({ enemies: ['slime', 'slime'], tune: (t) => ((t.kill.atk = 1), (t.kill.maxHp = 5), (t.kill.comboPower = 0.5)) });
    c.enemies[0].hp = 1;
    c.spawnBlock('yellow', 0.3);
    c.spawnBlock('yellow', 0.7);
    c.advanceTo(timeAt(t, 0.3));
    c.tap(timeAt(t, 0.3));
    expect(c.hero.bonusAtk).toBe(1);
    expect(c.hero.bonusMaxHp).toBe(5);
    expect(c.hero.hp).toBe(105);
    expect(c.hero.bonusComboPower).toBe(0.5);
    expect(c.drainEvents().find((e) => e.type === 'statGain')).toMatchObject({ atk: 1, maxHp: 5, comboPower: 0.5 });
    // and the next hit uses the new attack (the cursor sped up a little with the combo)
    const at = c.time + (0.7 - c.cursorPosAt(c.time)) / c.cursorSpeed();
    c.advanceTo(at);
    c.tap(at);
    expect(c.enemies[1].hp).toBe(80 - (t.hero.atk + 1));
  });

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
});
