// Gear: stat math, drop rolls, bad-luck protection on signature drops, the forge's prices, the bag.
import { describe, expect, it } from 'vitest';
import { BASE_BY_ID, BASE_ITEMS, GEAR_RARITIES, SETS, SIGNATURES, STAT_IDS, type GearRarity } from '../../src/data/gear';
import { afterDefense, Combat, heroMaxHp, heroStats, killCoins, newHero } from '../../src/core/combat';
import {
  baseStats,
  bonusValue,
  fmtStat,
  fmtStatShort,
  fmtTotal,
  itemLevel,
  itemPower,
  itemStats,
  loadoutOf,
  makeItem,
  rarityWeights,
  rerollCost,
  rollDrops,
  rollItem,
  rollRarity,
  rollSignatures,
  salvageValue,
  signatureChance,
  statShows,
  upgradeCost,
  type Item,
} from '../../src/core/gear';
import { addItem, compareStats, equip, equippedItems, newProfile, profileLoadout, reroll, salvage, salvageAll, sortItems, toggleLock, upgrade } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';

const T = cloneTuning();
const item = (base: string, rarity: GearRarity = 'common', ilvl = 0, extra: Partial<Item> = {}): Item => ({
  ...makeItem(new Rng(1), BASE_BY_ID[base], rarity, ilvl),
  bonus: [],
  ...extra,
});

describe('gear content', () => {
  it('has about 25 base items across the six slots, with original names and an icon each', () => {
    expect(BASE_ITEMS.length).toBeGreaterThanOrEqual(24);
    for (const slot of ['weapon', 'helm', 'armor', 'boots', 'trinket']) expect(BASE_ITEMS.filter((b) => b.slot === slot).length).toBeGreaterThanOrEqual(4);
    expect(new Set(BASE_ITEMS.map((b) => b.id)).size).toBe(BASE_ITEMS.length);
    expect(new Set(BASE_ITEMS.map((b) => b.name)).size).toBe(BASE_ITEMS.length);
    for (const b of BASE_ITEMS) expect(b.icon.length).toBeGreaterThan(0);
  });

  it('every slot has its base stat: weapons Attack, armor HP and Defense', () => {
    for (const b of BASE_ITEMS.filter((x) => x.slot === 'weapon')) expect(b.base[0].stat).toBe('atk');
    for (const b of BASE_ITEMS.filter((x) => x.slot === 'armor')) expect(b.base.map((s) => s.stat)).toEqual(['hp', 'def']);
  });

  it('the signature drops and the two sets are as designed', () => {
    expect(BASE_BY_ID.captainsCutlass.signature).toMatchObject({ boss: 'captain', rarity: 'legendary', effect: 'cutlass' });
    expect(BASE_BY_ID.golemheartPlate.signature).toMatchObject({ boss: 'golem', rarity: 'legendary', effect: 'golemheart' });
    expect(BASE_BY_ID.tuskCrown.signature).toMatchObject({ boss: 'boarKing', rarity: 'legendary', effect: 'tuskCrown' });
    expect(BASE_BY_ID.pendulumShard.signature).toMatchObject({ boss: 'boarKing', rarity: 'mythic', effect: 'pendulum' });
    expect(SETS.greenwarden.pieces.map((p) => BASE_BY_ID[p].slot).sort()).toEqual(['armor', 'boots', 'helm', 'trinket']);
    expect(SETS.footpad.pieces.map((p) => BASE_BY_ID[p].slot).sort()).toEqual(['trinket', 'weapon']);
  });
});

describe('stat math', () => {
  it('a base stat grows with item level, rarity and forge level (+8% per level)', () => {
    const a = item('shortsword', 'common', 0);
    const atk0 = baseStats(T, a)[0].value;
    expect(atk0).toBeCloseTo(T.gear.atk);
    expect(baseStats(T, { ...a, ilvl: 10 })[0].value).toBeCloseTo(T.gear.atk * (1 + 10 * T.gear.levelScale));
    expect(baseStats(T, { ...a, rarity: 'mythic' })[0].value).toBeCloseTo(T.gear.atk * T.gear.rMythic);
    expect(baseStats(T, { ...a, plus: 5 })[0].value).toBeCloseTo(atk0 * 1.4);
  });

  it('bonus stats roll within their range, scaled by item level and rarity', () => {
    const a = item('shortsword', 'rare', 12);
    const lo = bonusValue(T, a, { stat: 'hp', q: 0 });
    const hi = bonusValue(T, a, { stat: 'hp', q: 1 });
    const k = (1 + 12 * T.gear.levelScale) * T.gear.rRare;
    expect(lo).toBeCloseTo(T.gear.hp * T.gear.bonusLo * k);
    expect(hi).toBeCloseTo(T.gear.hp * T.gear.bonusHi * k);
  });

  it("rarities give 0/1/2/3/3/4 bonus stats, all different and never the item's base stat", () => {
    const rng = new Rng(7);
    GEAR_RARITIES.forEach((r, i) => {
      for (let k = 0; k < 20; k++) {
        const it = makeItem(rng, BASE_BY_ID.paddedVest, r, 5);
        expect(it.bonus).toHaveLength([0, 1, 2, 3, 3, 4][i]);
        expect(new Set(it.bonus.map((b) => b.stat)).size).toBe(it.bonus.length);
        expect(it.bonus.some((b) => b.stat === 'hp' || b.stat === 'def')).toBe(false);
        expect(it.effect !== null).toBe(r === 'legendary' || r === 'mythic');
      }
    });
  });

  it('gear feeds all 10 hero stats; Defense cuts unblocked reds; Steady slows the speed-up', () => {
    const p = newProfile();
    const w = addItem(p, T, item('shortsword', 'rare', 10)).item;
    const arm = addItem(p, T, item('paddedVest', 'epic', 10)).item;
    const boots = addItem(p, T, item('wornBoots', 'common', 0)).item;
    for (const it of [w, arm, boots]) equip(p, it.uid);
    const h = newHero(T, profileLoadout(p, T));
    const bare = heroStats(T, newHero(T));
    const s = heroStats(T, h);
    expect(STAT_IDS.every((id) => typeof s[id] === 'number')).toBe(true);
    expect(s.atk).toBeCloseTo(bare.atk + itemStats(T, w).atk);
    expect(s.hp).toBe(Math.round(bare.hp + itemStats(T, arm).hp));
    expect(s.def).toBeCloseTo(itemStats(T, arm).def + itemStats(T, boots).def);
    expect(afterDefense(T, 100, 0)).toBe(100);
    expect(afterDefense(T, 100, T.gear.defScale)).toBeCloseTo(50);
    // a red getting through hurts less with Defense
    const hit = (hero: typeof h) => {
      const c = new Combat({ tuning: T, settings: { ...DEFAULT_SETTINGS }, hero, enemies: ['boar'], seed: 1, spawning: false });
      const hp = hero.hp;
      c.spawnBlock('red', 0.5);
      c.advanceTo(5);
      return hp - hero.hp;
    };
    expect(hit({ ...h, hp: 500 })).toBeLessThan(hit({ ...newHero(T), hp: 500 }));
    // Steady: the same combo, a slower cursor
    const c1 = new Combat({ tuning: T, settings: { ...DEFAULT_SETTINGS }, hero: newHero(T), enemies: ['slime'], seed: 1, spawning: false });
    const c2 = new Combat({ tuning: T, settings: { ...DEFAULT_SETTINGS }, hero: h, enemies: ['slime'], seed: 1, spawning: false });
    c1.combo = c2.combo = 20;
    expect(c2.speedMult()).toBeLessThan(c1.speedMult());
  });

  it('Luck brings more coins; the Greenwarden 2-piece adds 10% max HP', () => {
    const p = newProfile();
    const clover = addItem(p, T, item('clover', 'epic', 20)).item;
    equip(p, clover.uid);
    const h = newHero(T, profileLoadout(p, T));
    expect(killCoins(T, h, 'captain')).toBeGreaterThan(killCoins(T, newHero(T), 'captain'));
    const g = newProfile();
    for (const id of ['wardenHood', 'wardenMail']) equip(g, addItem(g, T, item(id, 'rare', 0)).item.uid);
    const L = profileLoadout(g, T);
    expect(L.sets.greenwarden).toBe(2);
    const raw = T.hero.maxHp + L.stats.hp;
    expect(heroMaxHp(T, newHero(T, L))).toBe(Math.round(raw * 1.1));
  });

  it('item power ranks better items higher', () => {
    expect(itemPower(T, item('shortsword', 'epic', 20))).toBeGreaterThan(itemPower(T, item('shortsword', 'common', 2)));
    expect(itemPower(T, item('shortsword', 'common', 2, { plus: 5 }))).toBeGreaterThan(itemPower(T, item('shortsword', 'common', 2)));
  });

  it('prints stats the way the UI shows them', () => {
    expect(fmtStat('hp', 12.4)).toBe('+12');
    expect(fmtStat('atk', 2.34)).toBe('+2.3');
    expect(fmtStat('critChance', 0.045)).toBe('+4.5%');
    expect(fmtStat('luck', 0.12)).toBe('+12%');
    expect(fmtStat('critDmg', 0.15)).toBe('+0.15x');
    expect(fmtStat('def', -3)).toBe('-3');
  });

  it('prints stats short for lists: whole numbers in plain units, never "+0"', () => {
    expect(fmtStatShort('atk', 3.8)).toBe('+4');
    expect(fmtStatShort('atk', 0.25)).toBe('+0.3');
    expect(fmtStatShort('atk', 0.01)).toBe('+0.1');
    expect(fmtStatShort('hp', -8.4)).toBe('-8');
    expect(fmtStatShort('critChance', 0.052)).toBe('+5%');
    expect(fmtStatShort('luck', 0.003)).toBe('+1%');
    expect(fmtStatShort('critDmg', 0.16)).toBe('+16%');
    expect(fmtStatShort('steady', 0.091, false)).toBe('9%');
    expect(fmtStatShort('def', 0, false)).toBe('0');
    expect(fmtTotal('critDmg', 2.16)).toBe('x2.2');
    expect(fmtTotal('atk', 16.1)).toBe('16');
    expect(fmtTotal('critChance', 0.077)).toBe('8%');
    expect(statShows('atk', 0.04)).toBe(false);
    expect(statShows('atk', 0.06)).toBe(true);
    expect(statShows('critChance', 0.001)).toBe(true);
  });
});

describe('drop rolls', () => {
  it('rarity follows 55/28/12/4/0.9/0.1, and Luck shifts it toward the rare end', () => {
    const rng = new Rng(3);
    const n = 40000;
    const count = (luck: number) => {
      const c: Record<string, number> = {};
      for (let i = 0; i < n; i++) {
        const r = rollRarity(rng, T, luck);
        c[r] = (c[r] ?? 0) + 1;
      }
      return c;
    };
    const c = count(0);
    expect(c.common / n).toBeCloseTo(0.55, 1);
    expect(c.uncommon / n).toBeCloseTo(0.28, 1);
    expect(c.rare / n).toBeCloseTo(0.12, 1);
    expect(c.epic / n).toBeGreaterThan(0.03);
    expect(c.epic / n).toBeLessThan(0.05);
    const lucky = count(0.5);
    expect(lucky.common / n).toBeLessThan(c.common / n);
    expect((lucky.epic + (lucky.legendary ?? 0)) / n).toBeGreaterThan((c.epic + (c.legendary ?? 0)) / n);
    expect(rarityWeights(T, 0.2)[5]).toBeCloseTo(T.gear.wMythic * 2);
    for (let i = 0; i < 200; i++) expect(rollRarity(rng, T, 0, 'uncommon')).not.toBe('common');
  });

  it('item level comes from the act (Act 1 low, Act 3 high) and creeps up along the map', () => {
    expect(itemLevel(T, 0, 0)).toBeLessThan(itemLevel(T, 1, 0));
    expect(itemLevel(T, 1, 0)).toBeLessThan(itemLevel(T, 2, 0));
    expect(itemLevel(T, 2, 7)).toBeGreaterThan(itemLevel(T, 2, 0));
  });

  it('drops only bases that can drop in the act, never a signature item; sets only at Rare or Epic', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(rng, T, 0, 3, 0.3);
      const b = BASE_BY_ID[it.base];
      expect(b.signature).toBeUndefined();
      expect(b.act).toBe(0);
      if (b.set) expect(['rare', 'epic']).toContain(it.rarity);
    }
  });

  it('per node: a fight about half the time, an elite always (Uncommon+), treasure 1-2, a mini-boss 2+, the boss 3+', () => {
    const rng = new Rng(5);
    const blp: Record<string, number> = {};
    const avg = (type: 'fight' | 'elite' | 'treasure', k = 2000) => {
      let n = 0;
      for (let i = 0; i < k; i++) n += rollDrops(rng, T, { act: 0, row: 2, type, luck: 0 }, blp).length;
      return n / k;
    };
    expect(avg('fight')).toBeCloseTo(0.5, 1);
    expect(avg('elite')).toBe(1);
    const t = avg('treasure');
    expect(t).toBeGreaterThan(1.3);
    expect(t).toBeLessThan(1.7);
    for (let i = 0; i < 100; i++) for (const it of rollDrops(rng, T, { act: 0, row: 3, type: 'elite', luck: 0 }, blp)) expect(it.rarity).not.toBe('common');
    const mini = rollDrops(rng, T, { act: 0, row: 7, type: 'boss', boss: 'captain', luck: 0 }, blp);
    expect(mini.filter((i) => !BASE_BY_ID[i.base].signature)).toHaveLength(2);
    const boss = rollDrops(rng, T, { act: 2, row: 7, type: 'boss', boss: 'boarKing', finalBoss: true, luck: 0 }, blp);
    expect(boss.filter((i) => !BASE_BY_ID[i.base].signature)).toHaveLength(3);
  });

  it("signature drops only come from their own boss, at their rarity and with their effect", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 300; i++) {
      const blp: Record<string, number> = {};
      for (const it of rollDrops(rng, T, { act: 2, row: 7, type: 'boss', boss: 'boarKing', finalBoss: true, luck: 0 }, blp)) {
        const b = BASE_BY_ID[it.base];
        if (!b.signature) continue;
        expect(SIGNATURES.boarKing).toContain(b.id);
        expect(it.rarity).toBe(b.signature.rarity);
        expect(it.effect).toBe(b.signature.effect);
      }
      for (const it of rollDrops(rng, T, { act: 2, row: 6, type: 'elite', luck: 0 }, blp)) expect(BASE_BY_ID[it.base].signature).toBeUndefined();
    }
  });
});

describe('bad-luck protection', () => {
  it('each kill without the drop raises its odds, and a drop resets them', () => {
    expect(signatureChance(T, 'captainsCutlass', 0)).toBeCloseTo(T.gear.sigChance);
    expect(signatureChance(T, 'captainsCutlass', 3)).toBeCloseTo(T.gear.sigChance + 3 * T.gear.sigStep);
    expect(signatureChance(T, 'captainsCutlass', 100)).toBe(1);
    expect(signatureChance(T, 'pendulumShard', 0)).toBeCloseTo(T.gear.mythicChance);
    const rng = new Rng(21);
    const blp: Record<string, number> = {};
    let misses = 0;
    for (let k = 0; k < 400; k++) {
      const got = rollSignatures(rng, T, 'captain', 5, blp).length > 0;
      if (got) {
        expect(blp.captainsCutlass).toBe(0);
        misses = 0;
      } else {
        misses++;
        expect(blp.captainsCutlass).toBe(misses);
      }
    }
  });

  it('guarantees the drop within a bounded number of kills (the Cutlass by its 9th kill)', () => {
    const worst = Math.ceil((1 - T.gear.sigChance) / T.gear.sigStep) + 1;
    for (let seed = 1; seed < 300; seed++) {
      const rng = new Rng(seed);
      const blp: Record<string, number> = {};
      let kills = 0;
      while (!rollSignatures(rng, T, 'captain', 5, blp).length) kills++;
      expect(kills + 1).toBeLessThanOrEqual(worst);
    }
  });

  it('the Mythic shard is rare: averages well over 5 Boar King kills', () => {
    let total = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rng = new Rng(seed * 31);
      const blp: Record<string, number> = {};
      let kills = 1;
      while (!rollSignatures(rng, T, 'boarKing', 25, blp).some((i) => i.base === 'pendulumShard')) kills++;
      total += kills;
    }
    expect(total / 400).toBeGreaterThan(5);
    expect(total / 400).toBeLessThan(12);
  });
});

describe('the forge', () => {
  it('upgrades cost scrap and coins, rising with each level and the rarity, up to +10', () => {
    const a = item('shortsword', 'common', 5);
    const c0 = upgradeCost(T, a)!;
    const c5 = upgradeCost(T, { ...a, plus: 5 })!;
    expect(c0).toEqual({ scrap: T.forge.upgradeScrap, coins: T.forge.upgradeCoins });
    expect(c5.scrap).toBeGreaterThan(c0.scrap);
    expect(c5.coins).toBeGreaterThan(c0.coins);
    expect(upgradeCost(T, { ...a, rarity: 'epic' })!.coins).toBeGreaterThan(c0.coins);
    expect(upgradeCost(T, { ...a, plus: 10 })).toBeNull();
  });

  it('upgrading pays and raises the base stat; it refuses when you are short', () => {
    const p = newProfile();
    const a = addItem(p, T, item('shortsword', 'rare', 5)).item;
    const before = baseStats(T, a)[0].value;
    expect(upgrade(p, T, a.uid)).toBe('scrap');
    p.scrap = 100;
    expect(upgrade(p, T, a.uid)).toBe('coins');
    p.coins = 1000;
    const cost = upgradeCost(T, a)!;
    expect(upgrade(p, T, a.uid)).toBe('ok');
    expect(a.plus).toBe(1);
    expect(p.scrap).toBe(100 - cost.scrap);
    expect(p.coins).toBe(1000 - cost.coins);
    expect(baseStats(T, a)[0].value).toBeCloseTo(before * (1 + T.forge.upgradeStep));
  });

  it('a reroll costs coins, doubling each time on that item, and gives a different stat', () => {
    const p = newProfile();
    p.coins = 10000;
    const a = addItem(p, T, makeItem(new Rng(4), BASE_BY_ID.shortsword, 'epic', 10)).item;
    expect(rerollCost(T, a)).toBe(T.forge.rerollCoins);
    const rng = new Rng(8);
    for (let k = 0; k < 4; k++) {
      const old = a.bonus[0].stat;
      const others = a.bonus.slice(1).map((b) => b.stat);
      const cost = rerollCost(T, a);
      const coins = p.coins;
      expect(reroll(p, T, a.uid, 0, rng)).toBe('ok');
      expect(p.coins).toBe(coins - cost);
      expect(a.bonus[0].stat).not.toBe(old);
      expect(others).not.toContain(a.bonus[0].stat);
      expect(a.bonus[0].stat).not.toBe('atk');
      expect(rerollCost(T, a)).toBe(cost * 2);
    }
  });

  it('salvage turns items into scrap; "salvage all" skips locked and equipped items', () => {
    const p = newProfile();
    const keep = addItem(p, T, item('shortsword', 'common')).item;
    const worn = addItem(p, T, item('paddedVest', 'uncommon')).item;
    const junk = addItem(p, T, item('wornBoots', 'common')).item;
    const rare = addItem(p, T, item('clover', 'rare')).item;
    toggleLock(p, keep.uid);
    equip(p, worn.uid);
    expect(salvage(p, T, keep.uid)).toBe(0);
    const res = salvageAll(p, T, ['common', 'uncommon']);
    expect(res.count).toBe(1);
    expect(res.scrap).toBe(salvageValue(T, junk));
    expect(p.items.map((i) => i.uid).sort()).toEqual([keep.uid, worn.uid, rare.uid].sort());
    expect(salvageValue(T, item('shortsword', 'epic', 20))).toBeGreaterThan(salvageValue(T, item('shortsword', 'common', 20)));
    // an upgraded item gives back half the scrap its upgrades cost
    const up = item('shortsword', 'common', 0, { plus: 4 });
    let spent = 0;
    for (let k = 0; k < 4; k++) spent += upgradeCost(T, { ...up, plus: k })!.scrap;
    expect(salvageValue(T, up)).toBe(salvageValue(T, { ...up, plus: 0 }) + Math.floor(spent / 2));
  });
});

describe('the bag', () => {
  it('holds 60 items; past that, drops are salvaged into scrap', () => {
    const p = newProfile();
    for (let i = 0; i < 60; i++) expect(addItem(p, T, item('shortsword')).salvaged).toBe(0);
    const over = addItem(p, T, item('shortsword', 'rare', 10));
    expect(over.salvaged).toBeGreaterThan(0);
    expect(p.items).toHaveLength(60);
    expect(p.scrap).toBe(over.salvaged);
  });

  it('equips by slot (two trinkets), compares against what is worn, and sorts', () => {
    const p = newProfile();
    const a = addItem(p, T, item('clover', 'common', 1)).item;
    const b = addItem(p, T, item('owlCharm', 'rare', 1)).item;
    const c = addItem(p, T, item('emberLocket', 'epic', 1)).item;
    expect(equip(p, a.uid)).toBe('trinket1');
    expect(equip(p, b.uid)).toBe('trinket2');
    expect(equip(p, c.uid, 'trinket1')).toBe('trinket1');
    expect(equippedItems(p).map((i) => i.uid)).toEqual([c.uid, b.uid]);
    expect(equip(p, a.uid, 'weapon')).toBeNull();
    const sw = addItem(p, T, item('shortsword', 'common', 1)).item;
    const better = addItem(p, T, item('hedgeSaber', 'rare', 10)).item;
    equip(p, sw.uid);
    const d = compareStats(p, T, better);
    expect(d.find((x) => x.stat === 'atk')!.delta).toBeGreaterThan(0);
    expect(sortItems(T, p.items, 'rarity')[0].rarity).toBe('epic');
    expect(BASE_BY_ID[sortItems(T, p.items, 'slot')[0].base].slot).toBe('weapon');
    expect(sortItems(T, p.items, 'new')[0].uid).toBe(better.uid);
    expect(loadoutOf(T, equippedItems(p)).stats.atk).toBeGreaterThan(0);
  });
});
