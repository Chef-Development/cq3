// Region flow: scenes, the act map, fights and rewards, treasure, rest, shop, events, dying and the next act.
import { describe, expect, it } from 'vitest';
import type { NodeType } from '../../src/data/types';
import { heroMaxHp } from '../../src/core/combat';
import { Run, rarityMult } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';

function fresh(tune?: (t: Tuning) => void, seed = 7): Run {
  const t = cloneTuning();
  t.hero.critChance = 0;
  t.juice.hitStopMs = 0;
  tune?.(t);
  return new Run(t, { ...DEFAULT_SETTINGS }, seed);
}

/** A run on Act 1's map (scenes skipped). */
function onMap(tune?: (t: Tuning) => void, seed = 7): Run {
  const r = fresh(tune, seed);
  r.newRun();
  r.skipScenes();
  return r;
}

/** Walk to the first node of `type` in the current act (by any path) and enter it. Returns false if none. */
function goTo(r: Run, type: NodeType): boolean {
  const m = r.map;
  const target = m.nodes.find((n) => n.type === type);
  if (!target) return false;
  const path = [target.id];
  while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((p) => p.next.includes(path[0]))!.id);
  r.path = path.slice(0, -1);
  r.phase = 'map';
  return r.chooseNode(target.id);
}

/** Win the current fight at once. */
function win(r: Run): void {
  const c = r.combat!;
  for (const e of c.enemies) {
    e.uses = e.uses.map(() => 1); // past any boss phase gates
    e.hp = Math.min(e.hp, 5);
  }
  c.stacks = 1;
  c.finisher();
  r.sync();
}

describe('a new run', () => {
  it('plays the intro and Pip joining, then shows the first row of Act 1', () => {
    const r = fresh();
    r.newRun();
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['intro', 'act1']);
    r.advanceScene();
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['act1']);
    r.advanceScene();
    expect(r.phase).toBe('map');
    expect(r.actIndex).toBe(0);
    expect(r.theme).toBe('forest');
    expect(r.choices()).toEqual(r.map.rows[0]);
  });

  it('Skip goes straight to the map', () => {
    const r = fresh();
    r.newRun();
    r.skipScenes();
    expect(r.phase).toBe('map');
  });
});

describe('the map', () => {
  it('only a linked node in the next row can be chosen', () => {
    const r = onMap();
    const m = r.map;
    expect(r.chooseNode(m.rows[1][0])).toBe(false);
    expect(r.chooseNode(m.rows[0][0])).toBe(true);
    expect(r.path).toEqual([m.rows[0][0]]);
    expect(r.phase).toBe('fight');
  });

  it("a fight uses the node's enemies, scaled by the act and the row", () => {
    const r = onMap();
    goTo(r, 'elite');
    const n = r.node!;
    const c = r.combat!;
    expect(c.enemies.map((e) => e.key)).toEqual(n.enemies);
    const k = n.enemies[0];
    const mult = r.tuning.acts[0].hpMult * (1 + r.tuning.map.rowHp * n.row);
    expect(c.enemies[0].maxHp).toBe(Math.round(r.tuning.enemies[k].hp * mult));
    expect(c.enemies[0].atk).toBe(Math.round(r.tuning.enemies[k].atk * r.tuning.acts[0].atkMult));
  });

  it('winning a fight offers one boost pick, then the map again; an elite guarantees a rare', () => {
    const r = onMap((t) => ((t.boosts.rareChance = 0), (t.boosts.epicChance = 0)));
    r.chooseNode(r.map.rows[0][0]);
    win(r);
    expect(r.phase).toBe('boost');
    expect(r.boostChoices).toHaveLength(3);
    expect(r.boostChoices.every((o) => o.rarity === 'common')).toBe(true);
    const i = r.boostChoices.findIndex((b) => b.id === 'damage');
    r.pickBoost(Math.max(0, i));
    expect(r.phase).toBe('map');
    if (i >= 0) expect(r.hero.bonusDmg).toBeCloseTo(r.tuning.boosts.damage * rarityMult(r.tuning, 'common'));
    goTo(r, 'elite');
    win(r);
    expect(r.boostChoices.filter((o) => o.rarity === 'rare')).toHaveLength(1);
  });

  it('collects coins for every kill', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    const keys = r.combat!.enemies.map((e) => e.key);
    win(r);
    expect(r.coins).toBe(keys.reduce((n, k) => n + r.tuning.enemies[k].coins, 0));
  });
});

describe('treasure, rest, shop and events', () => {
  it('treasure: coins, then a rare-or-better boost pick', () => {
    const r = onMap((t) => ((t.boosts.rareChance = 0), (t.boosts.epicChance = 0)));
    expect(goTo(r, 'treasure')).toBe(true);
    expect(r.phase).toBe('treasure');
    const coins = r.treasure!.coins;
    expect(coins).toBeGreaterThan(0);
    r.openTreasure();
    expect(r.coins).toBe(coins);
    expect(r.phase).toBe('boost');
    expect(r.boostChoices.some((o) => o.rarity === 'rare')).toBe(true);
    r.pickBoost(0);
    expect(r.phase).toBe('map');
  });

  it('rest heals 30% of max HP', () => {
    const r = onMap();
    goTo(r, 'rest');
    r.hero.hp = 20;
    expect(r.rest()).toBe(Math.round(heroMaxHp(r.tuning, r.hero) * 0.3));
    expect(r.hero.hp).toBe(50);
    expect(r.phase).toBe('map');
  });

  it("shop: cards, a potion and a reroll; you can't overspend and each sells once", () => {
    const r = onMap();
    goTo(r, 'shop');
    expect(r.phase).toBe('shop');
    expect(r.shop.map((i) => i.kind)).toEqual(['boost', 'boost', 'boost', 'potion', 'reroll']);
    r.coins = 0;
    expect(r.buy(0)).toBe(false);
    r.coins = 1000;
    r.hero.hp = 10;
    expect(r.buy(3)).toBe(true);
    expect(r.hero.hp).toBe(10 + Math.round(heroMaxHp(r.tuning, r.hero) * r.tuning.map.potionHeal));
    expect(r.buy(3)).toBe(false);
    expect(r.buy(4)).toBe(true);
    expect(r.rerolls).toBe(1);
    const before = r.hero.bonusMaxHp + r.hero.bonusDmg + r.hero.bonusCrit + r.hero.bonusCritDmg + r.hero.bonusComboPower + r.hero.bonusPet;
    r.buy(0);
    r.buy(1);
    r.buy(2);
    expect(r.coins).toBe(1000 - r.shop.reduce((n, i) => n + i.price, 0));
    const after = r.hero.bonusMaxHp + r.hero.bonusDmg + r.hero.bonusCrit + r.hero.bonusCritDmg + r.hero.bonusComboPower + r.hero.bonusPet;
    expect(after).toBeGreaterThanOrEqual(before);
    r.leaveShop();
    expect(r.phase).toBe('map');
    // the reroll is spent on the next pick
    r.chooseNode(r.choices()[0]);
    if (r.phase === 'fight') {
      win(r);
      const first = r.boostChoices.map((o) => o.id).join();
      expect(r.rerollBoosts()).toBe(true);
      expect(r.rerolls).toBe(0);
      expect(r.rerollBoosts()).toBe(false);
      expect(r.boostChoices).toHaveLength(3);
      expect(typeof first).toBe('string');
    }
  });

  it('an event choice applies its outcome; a choice that costs coins needs them', () => {
    const r = onMap();
    goTo(r, 'event');
    expect(r.phase).toBe('event');
    r.event = { id: 'shrine', choice: -1, outcome: -1, boost: null };
    r.coins = 5;
    expect(r.chooseEvent(0)).toBe(false); // offering 20 coins
    r.coins = 25;
    expect(r.chooseEvent(0)).toBe(true);
    expect(r.coins).toBe(5);
    expect(r.event!.boost).toBe('rare');
    r.endEvent();
    expect(r.phase).toBe('boost');
    expect(r.boostChoices.some((o) => o.rarity !== 'common')).toBe(true);
  });

  it('an event outcome without a boost goes back to the map', () => {
    const r = onMap();
    goTo(r, 'event');
    r.event = { id: 'dummy', choice: -1, outcome: -1, boost: null };
    const atk = r.hero.bonusAtk;
    const hp = r.hero.hp;
    r.chooseEvent(0); // practice: +1 attack, -8 HP
    expect(r.hero.bonusAtk).toBe(atk + 1);
    expect(r.hero.hp).toBe(hp - 8);
    r.endEvent();
    expect(r.phase).toBe('map');
  });

  it('an event never takes the hero below 1 HP', () => {
    const r = onMap();
    goTo(r, 'event');
    r.event = { id: 'dummy', choice: -1, outcome: -1, boost: null };
    r.hero.hp = 3;
    r.chooseEvent(0);
    expect(r.hero.hp).toBe(1);
  });
});

describe('acts, dying and the end', () => {
  it("the boss plays its scene first; beating it clears the act; the next act opens with its scene and its own map", () => {
    const r = onMap();
    r.hero.bonusAtk = 4;
    goTo(r, 'boss');
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['captain']);
    r.skipScenes();
    expect(r.phase).toBe('fight');
    expect(r.bossFight).toBe(true);
    win(r);
    expect(r.phase).toBe('boost');
    r.pickBoost(0);
    expect(r.phase).toBe('actClear');
    r.hero.hp = 3;
    const atk = r.hero.bonusAtk; // 4 plus the boss kill's gain
    expect(atk).toBe(4 + r.tuning.kill.atk);
    const map1 = r.map;
    r.nextAct();
    expect(r.actIndex).toBe(1);
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['act2']);
    expect(r.theme).toBe('ruins');
    expect(r.map).not.toEqual(map1);
    expect(r.hero.bonusAtk).toBe(atk);
    expect(r.hero.hp).toBe(heroMaxHp(r.tuning, r.hero));
    expect(r.path).toEqual([]);
  });

  it("dying sends you back to the act's start: same map, the hero and coins as you entered; one revive per act", () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    win(r);
    r.pickBoost(0);
    r.coins = 99;
    r.hero.bonusAtk = 7;
    r.chooseNode(r.choices()[0]);
    while (r.phase !== 'fight') {
      // walk on until a fight
      if (r.phase === 'boost') r.pickBoost(0);
      else if (r.phase === 'treasure') r.openTreasure();
      else if (r.phase === 'rest') r.rest();
      else if (r.phase === 'shop') r.leaveShop();
      else if (r.phase === 'event') (r.chooseEvent(1), r.endEvent());
      else if (r.phase === 'scene') r.skipScenes();
      if (r.phase === 'map') r.chooseNode(r.choices()[0]);
    }
    const c = r.combat!;
    c.spawning = false;
    c.specialsOn = false;
    r.hero.hp = 1;
    c.spawnBlock('red', 0.05);
    c.advanceTo(c.time + 0.5);
    r.sync();
    expect(r.phase).toBe('fight'); // the revive
    expect(r.hero.revives).toBe(0);
    r.hero.hp = 1;
    c.spawnBlock('red', 0.05);
    c.advanceTo(c.time + 0.5);
    r.sync();
    expect(r.phase).toBe('defeat');
    const map = r.map;
    r.retry();
    expect(r.phase).toBe('map');
    expect(r.map).toBe(map);
    expect(r.path).toEqual([]);
    expect(r.coins).toBe(0);
    expect(r.hero.bonusAtk).toBe(0);
    expect(r.hero.hp).toBe(r.tuning.hero.maxHp);
    expect(r.hero.revives).toBe(r.tuning.hero.revivesPerAct);
  });

  it('after the Boar King: the victory scene, then the victory screen', () => {
    const r = onMap();
    r.enterAct(2);
    goTo(r, 'boss');
    expect(r.sceneQueue).toEqual(['boarKing']);
    r.skipScenes();
    expect(r.combat!.enemies[0].key).toBe('boarKing');
    win(r);
    r.pickBoost(0);
    r.nextAct();
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['victory']);
    r.advanceScene();
    expect(r.phase).toBe('victory');
  });
});
