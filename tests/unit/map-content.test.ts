// The act map's extras in a run (core/run.ts with core/roam.ts, quests.ts, skirmish.ts): ambushes, the travelling
// merchant, Coin Rush, bounties, the secret cache, the world map's skirmish, and saving all of it (v7, and a v6 save
// going on without them).
import { describe, expect, it } from 'vitest';
import { setup, timeAt, toLastWave } from './helpers';
import { RELICS } from '../../src/data/relics';
import type { NodeType } from '../../src/data/types';
import { Combat, newHero } from '../../src/core/combat';
import { rarityIndex } from '../../src/core/gear';
import { buildActMap } from '../../src/core/map';
import { newProfile, relicUnlocked } from '../../src/core/profile';
import { questFor } from '../../src/core/quests';
import { roamerAt, type RoamerKind } from '../../src/core/roam';
import { cardPrice, isRelicOffer, Run } from '../../src/core/run';
import { migrateSave, restoreRun, snapshotRun, SAVE_VERSION } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';

function fresh(tune?: (t: Tuning) => void, seed = 7): Run {
  const t = cloneTuning();
  t.hero.critChance = 0;
  t.juice.hitStopMs = 0;
  tune?.(t);
  const r = new Run(t, { ...DEFAULT_SETTINGS }, seed);
  r.profile.seen.push('scene:road'); // (Act 1's first win brings Pip's road scene once: not what these test)
  return r;
}

/** A run on act `act`'s map (scenes skipped). */
function onMap(seed = 7, tune?: (t: Tuning) => void, act = 0): Run {
  const r = fresh(tune, seed);
  r.newRun();
  r.skipScenes();
  if (act > 0) {
    r.enterAct(act);
    r.skipScenes();
  }
  return r;
}

/** The first step (over every path from the start) that meets a roamer of `kind`, on a node of `type` if given. */
function findMeet(r: Run, kind: RoamerKind, type?: NodeType): { prefix: number[]; node: number } | null {
  const m = r.map;
  const walk = (prefix: number[]): { prefix: number[]; node: number } | null => {
    const s = r.roamFor(prefix);
    const here = prefix.length ? m.nodes[prefix[prefix.length - 1]] : null;
    for (const id of here ? here.next : m.rows[0]) {
      const who = roamerAt(s, id);
      if (who?.kind === kind && (!type || m.nodes[id].type === type)) return { prefix, node: id };
      if (who) continue;
      const deeper = walk([...prefix, id]);
      if (deeper) return deeper;
    }
    return null;
  };
  return walk([]);
}

/** A run (any of a few seeds) whose map has that meeting; walked to just before it. */
function meetRun(kind: RoamerKind, type?: NodeType, tune?: (t: Tuning) => void, act = 0): { r: Run; node: number } {
  for (let seed = 1; seed < 200; seed++) {
    const r = onMap(seed, tune, act);
    const m = findMeet(r, kind, type);
    if (!m) continue;
    r.path = m.prefix;
    r.phase = 'map';
    return { r, node: m.node };
  }
  throw new Error(`no ${kind} meeting on a ${type ?? 'node'}`);
}

/** Walk (along any links, roamers aside) to the first node of `type` and enter it. */
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

/** Win the fight on screen at once (the loot goes in the bag). */
function win(r: Run): void {
  const c = r.combat!;
  toLastWave(c);
  for (const e of c.enemies) {
    e.uses = e.uses.map(() => 1);
    e.hp = Math.min(e.hp, 5);
  }
  c.stacks = 1;
  c.finisher();
  r.sync();
}

const noRoamers = (t: Tuning) => {
  t.roam.packsFirst = t.roam.packsLast = 0;
  t.roam.merchant = 0;
};

describe('ambushes', () => {
  it('on a fight node: the pack joins the fight as extra waves', () => {
    const { r, node } = meetRun('pack', 'fight');
    const pack = roamerAt(r.roamFor(), node)!;
    const own = r.map.nodes[node].waves;
    expect(r.chooseNode(node)).toBe(true);
    expect(r.phase).toBe('fight');
    expect(r.ambush).toMatchObject({ roamer: pack.id, then: 'map' });
    expect(r.combat!.waves).toEqual([...own, ...pack.waves]);
    // ...and it's gone from the map
    expect(r.roamFor().roamers.some((x) => x.id === pack.id)).toBe(false);
  });

  it('pays better: coins, an extra Uncommon+ item, a rare pick; then the map', () => {
    const { r, node } = meetRun('pack', 'fight', (t) => {
      t.roam.ambushItems = 2;
      t.gear.fightChance = 0;
    });
    r.chooseNode(node);
    const coins = r.coins;
    win(r);
    expect(r.coins).toBeGreaterThanOrEqual(coins + r.tuning.roam.ambushCoins);
    expect(r.phase).toBe('loot');
    expect(r.loot).toHaveLength(2);
    for (const it of r.loot) expect(rarityIndex(it.rarity)).toBeGreaterThanOrEqual(1);
    r.collectLoot();
    expect(r.phase).toBe('boost');
    expect(r.boostMin).toBe('rare');
    expect(r.boostChoices.some((o) => o.rarity !== 'common')).toBe(true);
    r.pickBoost(0);
    expect(r.phase).toBe('map');
    expect(r.ambush).toBeNull();
  });

  it("anywhere else the pack is fought first, then the node's own stop opens", () => {
    for (const type of ['treasure', 'event', 'shop'] as NodeType[]) {
      let r: Run;
      let node: number;
      try {
        ({ r, node } = meetRun('pack', type));
      } catch {
        continue;
      }
      const pack = roamerAt(r.roamFor(), node)!;
      r.chooseNode(node);
      expect(r.phase).toBe('fight');
      expect(r.combat!.waves).toEqual(pack.waves);
      win(r);
      if (r.phase === 'loot') r.collectLoot();
      expect(r.phase).toBe('boost');
      expect(r.boostThen).toBe('node');
      r.pickBoost(0);
      expect(r.phase, type).toBe(type);
      return;
    }
    throw new Error('no ambush off a fight node in 200 maps');
  });

  it('losing one is a defeat like any other: the act starts over, the pack back where it began', () => {
    const { r, node } = meetRun('pack', 'fight');
    const before = r.roamFor([]);
    r.chooseNode(node);
    r.hero.hp = 1;
    r.hero.revives = 0;
    r.combat!.hero.hp = 0;
    r.combat!.result = 'lost';
    r.sync();
    expect(r.phase).toBe('defeat');
    r.retry();
    expect(r.ambush).toBeNull();
    expect(r.roamFor()).toEqual(before);
  });
});

describe('the travelling merchant', () => {
  it("meeting her opens her small shop: a rare-or-better relic and a potion, a little cheaper; then the node's stop", () => {
    const { r, node } = meetRun('merchant', undefined, (t) => (t.roam.merchantRelics = 2));
    const type = r.map.nodes[node].type;
    r.coins = 1000;
    r.chooseNode(node);
    expect(r.phase).toBe('shop');
    expect(r.merchant).toBe(true);
    expect(r.shop.map((i) => i.kind)).toEqual(['boost', 'boost', 'potion']);
    for (const i of r.shop.slice(0, 2)) {
      expect(i.offer && isRelicOffer(i.offer)).toBe(true);
      expect(i.offer!.rarity).not.toBe('common');
    }
    const T = r.tuning;
    for (const i of r.shop.slice(0, 2)) expect(i.price).toBe(Math.round(cardPrice(T, i.offer!.rarity) * T.relics.price * T.roam.merchantPrice));
    expect(r.shop[2].price).toBe(Math.round(T.map.pricePotion * T.roam.merchantPrice));
    expect(r.buy(0)).toBe(true);
    r.leaveShop();
    expect(r.merchant).toBe(false);
    const stop: Record<string, string> = { fight: 'fight', treasure: 'treasure', event: 'event', shop: 'shop', rush: 'fight', bounty: 'bounty' };
    expect(r.phase).toBe(stop[type]);
    expect(r.roamFor().roamers.some((x) => x.kind === 'merchant')).toBe(false);
  });
});

describe('Coin Rush', () => {
  it('a rush node is a fight against the coin sack, on the clock', () => {
    const r = onMap(7, noRoamers);
    expect(goTo(r, 'rush')).toBe(true);
    expect(r.phase).toBe('fight');
    expect(r.rushing).toBe(true);
    const c = r.combat!;
    expect(c.rush).toBe(r.tuning.rush.sec);
    expect(c.enemies.map((e) => e.key)).toEqual(['coinSack']);
    expect(r.tuning.enemies.coinSack.pattern).not.toMatch(/[RSBFP]/); // it never attacks
    expect(c.hooks.length).toBeLessThanOrEqual(3); // the style and kit only (with strengths): no relics or skills
  });

  it('every hit knocks coins out (more on a long combo, a little more for a perfect); misses never hurt', () => {
    const t = cloneTuning();
    t.juice.hitStopMs = 0;
    t.hero.critChance = 0;
    const c = new Combat({ tuning: t, settings: { ...DEFAULT_SETTINGS }, hero: newHero(t), enemies: ['coinSack'], seed: 1, spawning: false, rush: 12 });
    c.spawnBlock('yellow', 0.3);
    c.advanceTo(0.5);
    const hp = c.hero.hp;
    c.tap(timeAt(t, 0.3));
    expect(c.rushCoins).toBeGreaterThanOrEqual(t.rush.perHit);
    const one = c.rushCoins;
    c.combo = t.rush.comboStep * 2;
    expect(c.rushHitCoins(false)).toBe(t.rush.perHit + 2);
    expect(c.rushHitCoins(true)).toBe(t.rush.perHit + 2 + t.rush.perfect);
    c.advanceTo(1.0);
    c.tap(c.time); // nothing there: a miss
    expect(c.hero.hp).toBe(hp);
    expect(c.combo).toBe(0);
    expect(c.rushCoins).toBe(one);
    // a finisher pays per stack, and the sack can't be emptied
    c.stacks = 3;
    c.finisher();
    expect(c.rushCoins).toBe(one + 3 * t.rush.perStack);
    expect(c.enemies[0].alive).toBe(true);
  });

  it("time's up: won, and back to the map with the coins in the purse (no loot, no pick)", () => {
    const r = onMap(7, noRoamers);
    goTo(r, 'rush');
    const coins = r.coins;
    const c = r.combat!;
    c.awardCoins(9, 'rush');
    for (let k = 0; k < 40 && !c.result; k++) c.advanceTo(c.time + 1); // (5 s at most per call)
    expect(c.result).toBe('won');
    r.sync();
    expect(r.phase).toBe('map');
    expect(r.coins).toBe(coins + 9);
  });
});

describe('bounties', () => {
  it('the board posts a quest; taking it puts it on the map; passing leaves it', () => {
    const r = onMap(7, noRoamers);
    expect(goTo(r, 'bounty')).toBe(true);
    expect(r.phase).toBe('bounty');
    const id = r.bountyOffer!;
    expect(id).toBe(questFor(r.map, r.node!.id, r.extras!.seed));
    expect(r.takeQuest()).toBe(true);
    expect(r.phase).toBe('map');
    expect(r.quest).toMatchObject({ id, n: 0, done: false });
    const p = onMap(7, noRoamers);
    goTo(p, 'bounty');
    p.passQuest();
    expect(p.phase).toBe('map');
    expect(p.quest).toBeNull();
  });

  it('counts the fights won, and pays when met: coins at once, an item with the drops, or a relic pick after the pick', () => {
    for (const [id, reward] of [
      ['kills', 'coins'],
      ['blocks', 'gear'],
      ['combo', 'relic'],
    ] as const) {
      const r = onMap(7, (t) => {
        noRoamers(t);
        t.gear.fightChance = 0;
        t.quests.blocks = 2;
      });
      r.quest = { id, n: 0, goal: id === 'blocks' ? 2 : 1, done: false };
      r.chooseNode(r.choices()[0]);
      const c = r.combat!;
      c.log.blocks = 3;
      c.log.bestCombo = 5;
      const coins = r.coins;
      win(r);
      expect(r.quest!.done, id).toBe(true);
      expect(r.questDone).toBe(id);
      if (reward === 'coins') expect(r.coins).toBeGreaterThanOrEqual(coins + r.tuning.quests.coins);
      if (reward === 'gear') {
        expect(r.phase).toBe('loot');
        expect(r.loot.some((i) => rarityIndex(i.rarity) >= 2)).toBe(true);
      }
      if (r.phase === 'loot') r.collectLoot();
      expect(r.phase).toBe('boost');
      r.pickBoost(0);
      if (reward === 'relic') {
        // the bounty's pick: relics only, rare or better
        expect(r.phase).toBe('boost');
        expect(r.pickKind).toBe('bounty');
        expect(r.boostChoices.every(isRelicOffer)).toBe(true);
        r.pickBoost(0);
      }
      expect(r.phase).toBe('map');
    }
  });

  it('a Coin Rush does not count toward it', () => {
    const r = onMap(7, noRoamers);
    r.quest = { id: 'combo', n: 0, goal: 1, done: false };
    goTo(r, 'rush');
    const c = r.combat!;
    c.log.bestCombo = 50;
    for (let k = 0; k < 40 && !c.result; k++) c.advanceTo(c.time + 1); // (5 s at most per call)
    r.sync();
    expect(r.quest.done).toBe(false);
  });
});

describe('the secret cache', () => {
  it('shows beside its node while the hero stands there; a richer chest; a pick of every relic, locked ones too', () => {
    const r = onMap(7, (t) => {
      noRoamers(t);
      t.secret.items = 2;
    });
    const host = r.extras!.secret;
    expect(host).toBeGreaterThanOrEqual(0);
    const path = [host];
    while (r.map.nodes[path[0]].row > 0) path.unshift(r.map.nodes.find((p) => p.next.includes(path[0]))!.id);
    r.path = path.slice(0, -1);
    r.phase = 'map';
    expect(r.secretHere).toBe(false);
    r.path = path;
    expect(r.secretHere).toBe(true);
    const coins = r.coins;
    expect(r.openSecret()).toBe(true);
    expect(r.phase).toBe('treasure');
    expect(r.treasure).toMatchObject({ secret: true, opened: false });
    expect(r.treasure!.coins).toBeGreaterThan(r.tuning.map.treasureCoins);
    r.openTreasure();
    expect(r.coins).toBeGreaterThan(coins);
    expect(r.loot).toHaveLength(2);
    for (const it of r.loot) expect(rarityIndex(it.rarity)).toBeGreaterThanOrEqual(2);
    r.collectLoot();
    expect(r.pickKind).toBe('secret');
    expect(r.boostChoices.every(isRelicOffer)).toBe(true);
    // its offers can be relics still locked; picking one unlocks it
    const locked = new Set(RELICS.filter((x) => !relicUnlocked(r.profile, x.id)).map((x) => x.id));
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) seen = r.rollChoices().some((o) => isRelicOffer(o) && locked.has(o.relic));
    expect(seen).toBe(true);
    r.boostChoices = [{ id: 'relic', rarity: 'epic', relic: [...locked][0] }];
    r.pickBoost(0);
    expect(relicUnlocked(r.profile, [...locked][0])).toBe(true);
    expect(r.phase).toBe('map');
    expect(r.secretHere).toBe(false); // once
    expect(r.openSecret()).toBe(false);
  });
});

describe('the world map skirmish', () => {
  function world(fights: number, cleared = 1): Run {
    const p = newProfile();
    p.actsCleared = cleared;
    p.wander.fights = fights;
    const r = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 3, p);
    r.toWorld();
    return r;
  }

  it('a wandering foe comes out once enough fights were won since the last one (Act 1 cleared)', () => {
    const every = cloneTuning().wander.every;
    expect(world(every - 1).wanderer).toBeNull();
    expect(world(every, 0).wanderer).toBeNull();
    const r = world(every);
    expect(r.wanderer).not.toBeNull();
    expect(r.profile.wander.up).toBe(true);
    expect(r.wanderer!.act).toBe(0);
    expect(r.wanderer!.waves).toHaveLength(2);
  });

  it('one skirmish: used up when it starts (a reload brings no new one); won, gear and XP, then the world map', () => {
    const r = world(99, 2);
    const foe = r.wanderer!;
    const hero = r.hero;
    const xp = r.profile.heroes.rowan.xp;
    expect(r.startSkirmish()).toBe(true);
    expect(r.phase).toBe('fight');
    expect(r.combat!.waves).toEqual(foe.waves);
    expect(r.actIndex).toBe(foe.act);
    expect(r.profile.wander).toMatchObject({ up: false, fights: 0, n: 1 });
    expect(snapshotRun(r)).toBeNull(); // not saved: the world map's
    const again = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 4, r.profile);
    again.toWorld();
    expect(again.wanderer).toBeNull();
    win(r);
    expect(r.phase).toBe('loot');
    expect(r.loot.length).toBe(Math.round(r.tuning.wander.items));
    expect(r.profile.heroes.rowan.xp).toBeGreaterThanOrEqual(xp + r.tuning.wander.xp * (foe.act + 1));
    r.collectLoot();
    expect(r.phase).toBe('world');
    expect(r.hero).toBe(hero);
    expect(r.skirmish).toBeNull();
  });

  it('lost: straight back to the world map', () => {
    const r = world(99);
    r.startSkirmish();
    r.combat!.result = 'lost';
    r.sync();
    expect(r.phase).toBe('world');
    expect(r.wanderer).toBeNull();
  });
});

describe('saving the map extras (v7)', () => {
  const via = (r: Run) => JSON.parse(JSON.stringify(snapshotRun(r, 1000)));
  const reload = (r: Run): Run => {
    const back = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 99, r.profile);
    expect(restoreRun(back, via(r))).toBe(true);
    return back;
  };

  it('the quest, its progress and the secret found round-trip; the roamers replay from the path', () => {
    const r = onMap(7);
    r.chooseNode(r.choices()[0]);
    win(r);
    if (r.phase === 'loot') r.collectLoot();
    r.pickBoost(0);
    r.quest = { id: 'blocks', n: 7, goal: r.tuning.quests.blocks, done: false };
    r.secretFound = true;
    const back = reload(r);
    expect(back.quest).toEqual(r.quest);
    expect(back.secretFound).toBe(true);
    expect(back.roamFor()).toEqual(r.roamFor());
    expect(back.map).toEqual(r.map);
  });

  it('an ambush fight resumes with its pack', () => {
    const { r, node } = meetRun('pack', 'fight');
    r.chooseNode(node);
    const back = reload(r);
    expect(back.phase).toBe('fight');
    expect(back.ambush).toEqual(r.ambush);
    expect(back.combat!.waves).toEqual(r.combat!.waves);
  });

  it("the merchant's shop resumes as hers; the bounty board resumes", () => {
    const { r, node } = meetRun('merchant');
    r.chooseNode(node);
    const back = reload(r);
    expect(back.phase).toBe('shop');
    expect(back.merchant).toBe(true);
    expect(back.shop).toEqual(r.shop);
    const b = onMap(7, noRoamers);
    goTo(b, 'bounty');
    expect(reload(b).phase).toBe('bounty');
  });

  it('a Coin Rush interrupted is over: it resumes on the map with the coins so far', () => {
    const r = onMap(7, noRoamers);
    goTo(r, 'rush');
    r.combat!.awardCoins(6, 'rush');
    const coins = r.coins;
    const back = reload(r);
    expect(back.phase).toBe('map');
    expect(back.path).toEqual(r.path);
    expect(back.coins).toBe(coins + 6);
  });

  it('a v6 save (before the extras) migrates: its act goes on without them, the next act has them', () => {
    const r = onMap(5);
    r.chooseNode(r.choices()[0]);
    r.phase = 'map';
    const s = via(r);
    for (const k of ['extras', 'quest', 'secret', 'ambush', 'merchant', 'bonusPicks', 'pickKind']) delete s[k];
    s.v = 6;
    const p = r.profile;
    const m = migrateSave(s, p) as Record<string, unknown>;
    expect(m.v).toBe(SAVE_VERSION);
    expect(m.extras).toBe(false);
    const back = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 9, p);
    expect(restoreRun(back, m)).toBe(true);
    expect(back.phase).toBe('map');
    expect(back.extras).toBeNull();
    expect(back.quest).toBeNull();
    expect(back.roamFor().roamers).toEqual([]);
    expect(back.map).toEqual(buildActMap(back.act, back.mapSeedFor(0)));
    expect(back.map.nodes.some((n) => n.type === 'rush' || n.type === 'bounty')).toBe(false);
    // the save it writes now keeps saying so
    expect(via(back).extras).toBe(false);
    back.phase = 'actClear';
    back.nextAct();
    back.skipScenes();
    expect(back.extras).not.toBeNull();
    expect(back.map.nodes.some((n) => n.type === 'rush')).toBe(true);
  });
});

it('a fight log helper sanity check (the setup helper still works with the rush option off)', () => {
  const { c } = setup();
  expect(c.rush).toBe(0);
});
