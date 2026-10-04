import { describe, expect, it } from 'vitest';
import { newHero } from '../../src/core/combat';
import { Rng } from '../../src/core/rng';
import { applyBoost, boostLabel, heroFor, rollBoosts, Run } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { setup } from './helpers';

describe('boost rarity', () => {
  it('cards roll common, rare (about 15%) or epic (about 4%), three different boosts at a time', () => {
    const t = cloneTuning();
    const rng = new Rng(3);
    const count = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 3000; i++) {
      const offers = rollBoosts(rng, t);
      expect(offers).toHaveLength(3);
      expect(new Set(offers.map((o) => o.id)).size).toBe(3);
      for (const o of offers) count[o.rarity]++;
    }
    const n = 9000;
    expect(count.rare / n).toBeGreaterThan(0.13);
    expect(count.rare / n).toBeLessThan(0.17);
    expect(count.epic / n).toBeGreaterThan(0.03);
    expect(count.epic / n).toBeLessThan(0.05);
  });

  it('a boss kill always offers at least one rare card', () => {
    const t = cloneTuning();
    t.boosts.rareChance = 0;
    t.boosts.epicChance = 0;
    expect(rollBoosts(new Rng(1), t, true).some((o) => o.rarity === 'rare')).toBe(true);
    const run = new Run(t, { ...DEFAULT_SETTINGS }, 2);
    run.startLevel(0, 3);
    const c = run.combat!;
    c.enemies[0].hp = 10;
    c.stacks = 1;
    c.finisher();
    run.sync();
    expect(run.phase).toBe('boost');
    expect(run.boostChoices.filter((o) => o.rarity !== 'common')).toHaveLength(1);
  });

  it('rare is 2x and epic 3x a common card', () => {
    const t = cloneTuning();
    const dmg = (rarity: 'common' | 'rare' | 'epic') => {
      const h = newHero(t);
      applyBoost(t, h, { id: 'damage', rarity });
      return h.bonusDmg;
    };
    expect(dmg('rare')).toBeCloseTo(2 * dmg('common'));
    expect(dmg('epic')).toBeCloseTo(3 * dmg('common'));
    t.boosts.damage = 0.2;
    expect(boostLabel(t, { id: 'damage', rarity: 'common' })).toEqual(['Damage', '+20%']);
    expect(boostLabel(t, { id: 'damage', rarity: 'rare' })).toEqual(['Damage', '+40%']);
    expect(boostLabel(t, { id: 'maxHp', rarity: 'epic' })).toEqual(['Max HP', '+60']);
  });

  it('a rare Full Heal also raises max HP', () => {
    const t = cloneTuning();
    const h = newHero(t);
    h.hp = 10;
    applyBoost(t, h, { id: 'heal', rarity: 'rare' });
    expect(h.bonusMaxHp).toBe(10);
    expect(h.hp).toBe(110);
    expect(boostLabel(t, { id: 'heal', rarity: 'common' })[1]).toBe('HP to max');
    expect(boostLabel(t, { id: 'heal', rarity: 'epic' })[1]).toBe('+20 max HP');
  });

  it('jumping ahead (debug) brings the upgrades a player would have earned', () => {
    const t = cloneTuning();
    const kills = t.levels[0].stages.reduce((n, st) => n + st.length, 0);
    const h = heroFor(t, 1, 0);
    expect(h.bonusAtk).toBe(kills * t.kill.atk);
    expect(h.bonusMaxHp).toBeGreaterThanOrEqual(kills * t.kill.maxHp);
    expect(h.hp).toBe(t.hero.maxHp + h.bonusMaxHp);
    expect(heroFor(t, 0, 0)).toEqual(newHero(t));
  });

  it('Companion Power makes Pip peck harder', () => {
    const { c, t } = setup({ tune: (t) => ((t.companion.everyHits = 1), (t.enemies.slime.hp = 500)) });
    applyBoost(t, c.hero, { id: 'pet', rarity: 'rare' });
    expect(c.hero.bonusPet).toBe(8);
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.69);
    c.tap(0.7);
    const pet = c.drainEvents().find((e) => e.type === 'pet');
    expect(pet && pet.type === 'pet' && pet.damage).toBe(t.companion.damage + 8);
    expect(boostLabel(t, { id: 'pet', rarity: 'common' })).toEqual(['Companion Power', 'Pip +4 dmg']);
  });
});
