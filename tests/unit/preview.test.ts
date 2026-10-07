import { describe, expect, it } from 'vitest';
import { heroStats, newHero } from '../../src/core/combat';
import { loadoutOf, makeItem } from '../../src/core/gear';
import { Rng } from '../../src/core/rng';
import { applyBoost, BOOST_IDS, boostPreview, RARITIES } from '../../src/core/run';
import { cloneTuning } from '../../src/core/tuning';
import { BASE_BY_ID } from '../../src/data/gear';

describe('boost preview (what a card shows)', () => {
  it('shows the real stat before and after the card, from the hero as it stands', () => {
    const t = cloneTuning();
    const h = newHero(t);
    const base = heroStats(t, h);
    const atk = boostPreview(t, h, { id: 'damage', rarity: 'common' });
    expect(atk.stat).toBe('ATK');
    expect(atk.before).toBe(`${Math.round(base.atk)}`);
    expect(Number(atk.after)).toBe(Math.round(base.atk * (1 + t.boosts.damage)));
    expect(boostPreview(t, h, { id: 'crit', rarity: 'common' })).toEqual({ stat: 'Crit', before: '5%', after: '10%' });
    expect(boostPreview(t, h, { id: 'crit', rarity: 'epic' }).after).toBe('20%');
    expect(boostPreview(t, h, { id: 'maxHp', rarity: 'rare' })).toEqual({ stat: 'Max HP', before: `${base.hp}`, after: `${base.hp + t.boosts.maxHp * 2}` });
    expect(boostPreview(t, h, { id: 'critDmg', rarity: 'common' })).toEqual({ stat: 'Crit dmg', before: 'x2.0', after: 'x2.5' });
    expect(boostPreview(t, h, { id: 'comboPower', rarity: 'common' })).toEqual({ stat: 'Combo', before: '5', after: '5.5' });
    expect(boostPreview(t, h, { id: 'pet', rarity: 'common' })).toEqual({ stat: 'Companion', before: '6', after: '10' });
  });

  it('Full Heal shows HP now and after (it heals to the new max)', () => {
    const t = cloneTuning();
    const h = newHero(t);
    h.hp = 60;
    expect(boostPreview(t, h, { id: 'heal', rarity: 'common' })).toEqual({ stat: 'HP', before: '60', after: '100' });
    const epic = boostPreview(t, h, { id: 'heal', rarity: 'epic' });
    expect(Number(epic.after)).toBeGreaterThan(100);
  });

  it('counts the gear the hero wears', () => {
    const t = cloneTuning();
    const sword = makeItem(new Rng(1), BASE_BY_ID.logAxe, 'epic', 20);
    const h = newHero(t, loadoutOf(t, [sword]));
    const geared = heroStats(t, h).atk;
    expect(geared).toBeGreaterThan(t.hero.atk);
    expect(boostPreview(t, h, { id: 'damage', rarity: 'common' }).before).toBe(`${Math.round(geared)}`);
  });

  it('never changes the hero, and agrees with applyBoost for every card', () => {
    const t = cloneTuning();
    for (const id of BOOST_IDS)
      for (const rarity of RARITIES) {
        const h = newHero(t);
        h.hp = 50;
        const snap = JSON.stringify(h);
        const p = boostPreview(t, h, { id, rarity });
        expect(JSON.stringify(h)).toBe(snap);
        expect(p.before).not.toBe(p.after);
        const after = { ...h };
        applyBoost(t, after, { id, rarity });
        if (id === 'heal') expect(p.after).toBe(`${after.hp}`);
      }
  });

  it('a tiny change still shows (one decimal instead of equal whole numbers)', () => {
    const t = cloneTuning();
    t.boosts.damage = 0.01;
    const p = boostPreview(t, newHero(t), { id: 'damage', rarity: 'common' });
    expect(p.before).not.toBe(p.after);
    expect(p).toEqual({ stat: 'ATK', before: '10', after: '10.1' });
  });
});
