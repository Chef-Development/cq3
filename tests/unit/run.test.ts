// Region flow: scenes, the act map, fights and rewards, treasure, rest, shop, events, dying and the next act.
import { describe, expect, it } from 'vitest';
import { toLastWave } from './helpers';
import type { NodeType } from '../../src/data/types';
import { BASE_BY_ID } from '../../src/data/gear';
import { heroAtk, heroMaxHp } from '../../src/core/combat';
import { makeItem } from '../../src/core/gear';
import { addItem, equip } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { Run, rarityMult } from '../../src/core/run';
import { restoreRun, snapshotRun } from '../../src/core/save';
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
  toLastWave(c);
  for (const e of c.enemies) {
    e.uses = e.uses.map(() => 1); // past any boss phase gates
    e.hp = Math.min(e.hp, 5);
  }
  c.stacks = 1;
  c.finisher();
  r.sync();
  if (r.phase === 'loot') r.collectLoot(); // the items found go straight in the bag
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

  it("a fight uses the node's waves of enemies, scaled by the act and the row", () => {
    const r = onMap();
    goTo(r, 'elite');
    const n = r.node!;
    const c = r.combat!;
    expect(c.waves).toEqual(n.waves);
    expect(c.enemies.map((e) => e.key)).toEqual(n.waves[0]);
    expect(c.foesTotal).toBe(n.enemies.length);
    const k = n.waves[0][0];
    const mult = r.tuning.acts[0].hpMult * (1 + r.tuning.map.rowHp * n.row);
    expect(c.enemies[0].maxHp).toBe(Math.round(r.tuning.enemies[k].hp * mult));
    expect(c.enemies[0].atk).toBe(Math.round(r.tuning.enemies[k].atk * r.tuning.acts[0].atkMult));
  });

  it("Act 1's first fight won brings Pip's road scene after its loot and pick, before the map: once per profile (winScene)", () => {
    const r = onMap();
    expect(r.act.winScene).toBe('road');
    r.chooseNode(r.map.rows[0][0]);
    win(r);
    r.pickBoost(0);
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['road']);
    r.advanceScene();
    expect(r.phase).toBe('map');
    // the next fight won goes straight back to the map; so does a new run on the same profile
    expect(goTo(r, 'fight')).toBe(true);
    win(r);
    r.pickBoost(0);
    expect(r.phase).toBe('map');
    const again = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 8, r.profile);
    again.newRun();
    again.skipScenes();
    again.chooseNode(again.map.rows[0][0]);
    win(again);
    again.pickBoost(0);
    expect(again.phase).toBe('map');
    // a replay of Act 1 once it's cleared never brings it (a returning player's profile has never seen it)
    const replay = fresh(undefined, 9);
    replay.profile.actsCleared = 1;
    replay.newRun();
    replay.skipScenes();
    replay.chooseNode(replay.map.rows[0][0]);
    win(replay);
    replay.pickBoost(0);
    expect(replay.phase).toBe('map');
    expect(replay.profile.seen).not.toContain('scene:road');
  });

  it('winning a fight offers one pick (mostly relics, at most one stat card), then the map again; an elite guarantees a rare', () => {
    const r = onMap((t) => ((t.boosts.rareChance = 0), (t.boosts.epicChance = 0), (t.relics.rareW = 0), (t.relics.epicW = 0), (t.relics.statCard = 1)));
    r.chooseNode(r.map.rows[0][0]);
    win(r);
    expect(r.phase).toBe('boost');
    expect(r.boostChoices).toHaveLength(3);
    expect(r.boostChoices.every((o) => o.rarity === 'common')).toBe(true);
    expect(r.boostChoices.filter((o) => o.id === 'relic')).toHaveLength(2);
    const i = r.boostChoices.findIndex((b) => b.id === 'damage');
    r.pickBoost(Math.max(0, i));
    // (Act 1's first win brings Pip's road scene first, once per profile: winScene)
    expect(r.phase).toBe('scene');
    expect(r.sceneQueue).toEqual(['road']);
    r.skipScenes();
    expect(r.phase).toBe('map');
    if (i >= 0) expect(r.hero.bonusDmg).toBeCloseTo(r.tuning.boosts.damage * rarityMult(r.tuning, 'common'));
    goTo(r, 'elite');
    win(r);
    expect(r.boostChoices.filter((o) => o.rarity !== 'common').length).toBeGreaterThanOrEqual(1);
  });

  it('collects coins for every kill, in every wave', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    const keys = r.node!.enemies;
    expect(r.node!.waves.length).toBeGreaterThan(1);
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
    expect(r.phase).toBe('loot'); // 1-2 items
    expect(r.loot.length).toBeGreaterThanOrEqual(1);
    expect(r.profile.items.map((i) => i.uid)).toEqual(r.loot.map((i) => i.uid));
    r.collectLoot();
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
    expect(r.sceneQueue).toEqual(['sableJoin', 'act2']); // after Act 1, Sable's night at the camp
    expect(r.profile.heroes.sable.unlocked).toBe(true);
    expect(r.theme).toBe('ruins');
    expect(r.map).not.toEqual(map1);
    expect(r.hero.bonusAtk).toBe(atk);
    expect(r.hero.hp).toBe(heroMaxHp(r.tuning, r.hero));
    expect(r.path).toEqual([]);
  });

  it("dying sends you back to the act's start: same map, the hero as you entered (coins and gear kept); one revive per act", () => {
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
      else if (r.phase === 'loot') r.collectLoot();
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
    const coins = r.coins;
    const items = r.profile.items.length;
    r.retry();
    expect(r.phase).toBe('map');
    expect(r.map).toBe(map);
    expect(r.path).toEqual([]);
    expect(r.coins).toBe(coins);
    expect(coins).toBeGreaterThanOrEqual(99);
    expect(r.profile.items).toHaveLength(items);
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

describe('the camp, replaying acts, the purse', () => {
  it('the world map sits between runs (nothing to save there); the camp goes back where it was opened', () => {
    const r = fresh();
    r.toWorld();
    expect(snapshotRun(r)).toBeNull();
    r.toCamp();
    expect(r.phase).toBe('camp');
    expect(r.campFrom).toBe('world');
    expect(snapshotRun(r)).toBeNull();
    r.leaveCamp();
    expect(r.phase).toBe('world');
    // from an act clear (the save keeps the act clear)
    const m = onMap();
    goTo(m, 'boss');
    m.skipScenes();
    win(m);
    m.pickBoost(0);
    expect(m.phase).toBe('actClear');
    m.toCamp();
    expect(m.campFrom).toBe('actClear');
    expect(snapshotRun(m)!.phase).toBe('actClear');
    m.leaveCamp();
    expect(m.phase).toBe('actClear');
  });

  it('the act map opens the camp mid-act: the hero, path and relics wait; a save there resumes on the map', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    win(r);
    r.pickBoost(0);
    r.skipScenes(); // (Act 1's first win: the road scene)
    expect(r.phase).toBe('map');
    const path = r.path.slice();
    const relics = r.hero.relics.slice();
    r.hero.hp = 33;
    r.toCamp();
    expect(r.phase).toBe('camp');
    expect(r.campFrom).toBe('map');
    // switching heroes at the camp: the run's hero fights as Sable when it goes back
    r.profile.heroes.sable.unlocked = true;
    r.profile.hero = 'sable';
    const save = snapshotRun(r)!;
    expect(save.phase).toBe('map');
    r.leaveCamp();
    expect(r.phase).toBe('map');
    expect(r.path).toEqual(path);
    expect(r.hero.relics).toEqual(relics);
    expect(r.hero.hp).toBe(33);
    expect(r.hero.build.id).toBe('sable');
    // the save made at the camp puts the run back on the same map spot
    const back = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 99, r.profile);
    expect(restoreRun(back, save)).toBe(true);
    expect(back.phase).toBe('map');
    expect(back.path).toEqual(path);
    expect(back.hero.relics).toEqual(relics);
  });

  it('gear equipped at the camp is worn when you go back', () => {
    const r = onMap();
    r.phase = 'actClear';
    r.toCamp();
    const it = addItem(r.profile, r.tuning, makeItem(new Rng(1), BASE_BY_ID.hedgeSaber, 'rare', 10)).item;
    equip(r.profile, it.uid);
    const atk = heroAtk(r.tuning, r.hero);
    r.leaveCamp();
    expect(heroAtk(r.tuning, r.hero)).toBeGreaterThan(atk);
  });

  it('cleared acts (and the next one) can be played from the world map, with a seasoned Rowan', () => {
    const r = fresh();
    expect(r.playableActs).toBe(1);
    r.profile.actsCleared = 2;
    expect(r.playableActs).toBe(3);
    r.startAct(2);
    expect(r.actIndex).toBe(2);
    expect(r.sceneQueue).toEqual(['act3']);
    expect(r.hero.bonusAtk).toBeCloseTo(r.tuning.kit.atk * 2);
    expect(r.hero.hp).toBe(heroMaxHp(r.tuning, r.hero));
    r.profile.actsCleared = 0;
    r.startAct(2); // not unlocked: Act 1 instead
    expect(r.actIndex).toBe(0);
  });

  it('coins carry over between runs (the purse is in the profile)', () => {
    const r = onMap();
    r.coins = 120;
    r.toWorld();
    r.newRun();
    expect(r.coins).toBe(120);
    const other = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 3, r.profile);
    expect(other.coins).toBe(120);
  });

  it('clearing an act records it, with its accuracy', () => {
    const r = onMap();
    r.actAims = Array.from({ length: 80 }, (_, i) => (i % 9) * 10 - 40);
    goTo(r, 'boss');
    r.skipScenes();
    win(r);
    r.pickBoost(0);
    expect(r.profile.actsCleared).toBe(1);
    expect(r.actAccuracy).not.toBeNull();
    expect(r.profile.acc.history.at(-1)).toEqual(r.actAccuracy);
  });

  it('the Greenwarden 4-piece makes rests heal 50%', () => {
    const r = onMap();
    for (const id of ['wardenHood', 'wardenMail', 'wardenTreads', 'wardenSprig']) equip(r.profile, addItem(r.profile, r.tuning, makeItem(new Rng(2), BASE_BY_ID[id], 'rare', 1)).item.uid);
    r.refreshGear();
    expect(r.restShare).toBe(r.tuning.effects.greenwardenRest);
    expect(goTo(r, 'rest')).toBe(true);
    r.hero.hp = 1;
    expect(r.rest()).toBe(Math.round(heroMaxHp(r.tuning, r.hero) * 0.5));
  });
});

describe('a defeat refunds what the retry undoes', () => {
  it('coins spent at shops and events in the act come back; coins found are kept', () => {
    const setUp = () => {
      const r = onMap();
      r.coins = 200;
      expect(goTo(r, 'shop')).toBe(true);
      const price = r.shop[0].price;
      expect(r.buy(0)).toBe(true);
      expect(r.coins).toBe(200 - price);
      r.leaveShop();
      r.coins += 15; // found on the way
      r.phase = 'defeat';
      return r;
    };
    const r = setUp();
    r.retry();
    expect(r.coins).toBe(215);
    r.retry(); // nothing left to refund
    expect(r.coins).toBe(215);
    // the same after a reload on the defeat screen (the save keeps what the act spent)
    const s = setUp();
    const back = new Run(s.tuning, { ...DEFAULT_SETTINGS }, 99, s.profile);
    expect(restoreRun(back, JSON.parse(JSON.stringify(snapshotRun(s)!)))).toBe(true);
    expect(back.phase).toBe('map');
    expect(back.coins).toBe(215);
  });
});
