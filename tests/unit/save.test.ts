import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toLastWave } from './helpers';
import { Run } from '../../src/core/run';
import { readSave, restoreRun, saveLabel, snapshotRun, validSave, type RunSave } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';

const fresh = (t: Tuning = cloneTuning(), seed = 5) => new Run(t, { ...DEFAULT_SETTINGS }, seed);
/** JSON round trip, the way it goes through localStorage. */
const viaJson = (s: RunSave | null): unknown => JSON.parse(JSON.stringify(s));

/** Act 1's map, scenes skipped. */
function onMap(seed = 5): Run {
  const r = fresh(cloneTuning(), seed);
  r.newRun();
  r.skipScenes();
  return r;
}

function goTo(r: Run, type: string): void {
  const m = r.map;
  const target = m.nodes.find((n) => n.type === type)!;
  const path = [target.id];
  while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((p) => p.next.includes(path[0]))!.id);
  r.path = path.slice(0, -1);
  r.phase = 'map';
  r.chooseNode(target.id);
}

/** A copy of the run restored from its save (through JSON), on the same profile (it's saved on its own). */
function reload(r: Run): Run {
  const back = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 99, r.profile);
  expect(restoreRun(back, viaJson(snapshotRun(r, 1000)))).toBe(true);
  return back;
}

describe('save at every node', () => {
  it('nothing to save on the title screen or after the victory', () => {
    const r = fresh();
    expect(snapshotRun(r)).toBeNull();
    r.phase = 'victory';
    expect(snapshotRun(r)).toBeNull();
  });

  it('the map round-trips: act, path, hero, coins, the act-start checkpoint', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    r.phase = 'map';
    Object.assign(r.hero, { hp: 61, bonusAtk: 3, bonusMaxHp: 10, bonusDmg: 0.2 });
    r.coins = 45;
    r.rerolls = 1;
    const back = reload(r);
    expect(back.phase).toBe('map');
    expect(back.actIndex).toBe(0);
    expect(back.map).toEqual(r.map);
    expect(back.path).toEqual(r.path);
    expect(back.choices()).toEqual(r.choices());
    expect(back.hero).toEqual({ ...r.hero, abilityTimer: 0 });
    expect(back.actHero).toEqual({ ...r.actHero, abilityTimer: 0 });
    expect(back.coins).toBe(45);
    expect(back.rerolls).toBe(1);
    expect(back.randomState).toEqual(r.randomState);
    expect(snapshotRun(back, 1000)).toEqual(snapshotRun(r, 1000));
  });

  it('a later act keeps its own map', () => {
    const r = onMap();
    r.enterAct(2);
    r.skipScenes();
    r.chooseNode(r.map.rows[0][1]);
    const back = reload(r);
    expect(back.actIndex).toBe(2);
    expect(back.theme).toBe('hollow');
    expect(back.map).toEqual(r.map);
    expect(back.node?.id).toBe(r.node?.id);
  });

  it('a story scene round-trips (and leads where it should)', () => {
    const r = fresh();
    r.newRun();
    r.advanceScene();
    const back = reload(r);
    expect(back.phase).toBe('scene');
    expect(back.sceneQueue).toEqual(['act1']);
    back.advanceScene();
    expect(back.phase).toBe('map');
  });

  it('a fight round-trips with its summons, boss phase and used specials', () => {
    const r = onMap();
    r.enterAct(2);
    r.skipScenes();
    goTo(r, 'boss');
    r.skipScenes();
    const c = r.combat!;
    const king = c.enemies[0];
    king.hp = 3000;
    king.phase = 2;
    king.uses[1] = 1;
    king.protect = 0.5;
    c.addEnemy('piglet', { summoner: king.id });
    c.addEnemy('piglet', { summoner: king.id });
    c.enemies[2].hp = 0;
    c.enemies[2].alive = false;
    r.hero.hp = 77;
    const back = reload(r);
    const e = back.combat!.enemies;
    expect(back.phase).toBe('fight');
    expect(e.map((x) => x.key)).toEqual(['boarKing', 'piglet', 'piglet']);
    expect(e.map((x) => x.alive)).toEqual([true, true, false]);
    expect(e[0]).toMatchObject({ hp: 3000, phase: 2, protect: 0.5 });
    expect(e[0].uses).toEqual(king.uses);
    expect(e[1].summoner).toBe(e[0].id);
    expect(back.combat!.summonsAlive(e[0].id)).toBe(true);
    expect(back.combat!.hero).toBe(back.hero);
    expect(back.hero.hp).toBe(77);
    expect(back.fightSeed).toBe(r.fightSeed);
    expect(back.bossFight).toBe(true);
  });

  it('a split slime stays split', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0].find((id) => r.map.nodes[id].enemies[0] === 'slime') ?? r.map.rows[0][0]);
    const c = r.combat!;
    if (c.enemies[0].key !== 'slime') return;
    c.useSpecial(c.enemies[0], 0);
    const back = reload(r);
    expect(back.combat!.enemies.map((x) => [x.key, x.alive])).toEqual(c.enemies.map((x) => [x.key, x.alive]));
  });

  it('a kill still waiting on its animation keeps its coins (in the purse), and the reward comes up', () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    const c = r.combat!;
    toLastWave(c);
    r.sync();
    const before = r.coins;
    for (const e of c.enemies) e.hp = 1;
    c.stacks = 1;
    c.finisher(); // no r.sync(): the view holds the phase change while the enemy bursts
    const coins = before + c.enemies.filter((e) => e.wave === c.waveIndex).reduce((n, e) => n + r.tuning.enemies[e.key].coins, 0);
    const save = snapshotRun(r)!;
    expect(r.coins).toBe(coins); // banked into the profile's purse
    const back = new Run(r.tuning, { ...DEFAULT_SETTINGS }, 99, r.profile);
    restoreRun(back, viaJson(save));
    expect(['loot', 'boost']).toContain(back.phase); // a fight drops an item half the time
    back.collectLoot();
    expect(back.phase).toBe('boost');
    expect(back.coins).toBe(coins);
    expect(back.boostChoices).toHaveLength(3);
  });

  it('a boost pick round-trips, and the boss reward still leads to the act clear', () => {
    const r = onMap();
    goTo(r, 'boss');
    r.skipScenes();
    const c = r.combat!;
    c.enemies[0].uses = c.enemies[0].uses.map(() => 1);
    c.enemies[0].hp = 1;
    c.stacks = 1;
    c.finisher();
    r.sync();
    expect(r.phase).toBe('loot'); // a mini-boss drops two items (and its signature roll)
    expect(r.loot.length).toBeGreaterThanOrEqual(2);
    const looted = reload(r);
    expect(looted.phase).toBe('loot');
    expect(looted.loot).toEqual(r.loot);
    r.collectLoot();
    expect(r.phase).toBe('boost');
    const back = reload(r);
    expect(back.phase).toBe('boost');
    expect(back.boostChoices).toEqual(r.boostChoices);
    back.actAims = Array.from({ length: 60 }, (_, i) => (i % 7) * 12 - 36);
    back.pickBoost(0);
    expect(back.phase).toBe('actClear');
    expect(back.actAccuracy).not.toBeNull();
    const again = reload(back);
    expect(again.phase).toBe('actClear');
    expect(again.actAccuracy).toEqual(back.actAccuracy); // this act's accuracy, not an older entry
    again.nextAct();
    expect(again.actIndex).toBe(1);
  });

  it('shop, event, treasure and rest round-trip', () => {
    for (const type of ['shop', 'event', 'treasure', 'rest']) {
      const r = onMap();
      goTo(r, type);
      if (type === 'shop') {
        r.coins = 500;
        r.buy(3);
      }
      const back = reload(r);
      expect(back.phase).toBe(type);
      if (type === 'shop') expect(back.shop).toEqual(r.shop);
      if (type === 'event') expect(back.event).toEqual(r.event);
      if (type === 'treasure') expect(back.treasure).toEqual(r.treasure);
      expect(back.node?.id).toBe(r.node?.id);
    }
  });

  it("a save from the defeat screen starts the act over (the purse is kept)", () => {
    const r = onMap();
    r.coins = 30;
    r.chooseNode(r.map.rows[0][0]);
    r.phase = 'defeat';
    const back = reload(r);
    expect(back.phase).toBe('map');
    expect(back.path).toEqual([]);
    expect(back.coins).toBe(30);
    expect(back.hero.hp).toBe(back.tuning.hero.maxHp);
  });

  it("rejects saves it can't resume, and leaves the run alone", () => {
    const r = onMap();
    r.chooseNode(r.map.rows[0][0]);
    const good = viaJson(snapshotRun(r)) as RunSave;
    const n = r.map.nodes[r.path[0]];
    const bad: unknown[] = [
      null,
      'nope',
      { ...good, v: 2 }, // the old levels
      { ...good, act: 7 },
      { ...good, path: [n.next[0]] }, // not a path from row 0
      { ...good, phase: 'title' },
      { ...good, hero: { ...good.hero, hp: 'x' } },
      { ...good, fight: { ...good.fight!, foes: [{ ...good.fight!.foes[0], key: 'dragon' }] } },
      { ...good, phase: 'boost', boost: { choices: [{ id: 'laser', rarity: 'common' }], min: false, then: 'map' } },
      { ...good, phase: 'event', event: { id: 'nope', choice: -1, outcome: -1, boost: null } },
    ];
    for (const b of bad) {
      const back = fresh();
      expect(restoreRun(back, b)).toBe(false);
      expect(back.phase).toBe('title');
    }
    expect(validSave(good, r)).toBe(true);
    expect(readSave(good, r.tuning)).not.toBeNull();
  });

  it('labels the Continue button', () => {
    const r = onMap();
    expect(saveLabel(snapshotRun(r)!, r)).toBe('Act 1 - 1/8');
    r.chooseNode(r.map.rows[0][0]);
    r.phase = 'map';
    r.chooseNode(r.choices()[0]);
    expect(saveLabel(snapshotRun(r)!, r)).toBe('Act 1 - 2/8');
    r.phase = 'actClear';
    expect(saveLabel(snapshotRun(r)!, r)).toBe('Act 1 clear');
  });
});

describe('save storage', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('writes, reads back, validates and clears', async () => {
    const { clearRunSave, loadRunSave, writeRunSave } = await import('../../src/engine/storage');
    const run = onMap();
    run.chooseNode(run.map.rows[0][0]);
    const save = snapshotRun(run)!;
    const p = run.profile;
    writeRunSave(save);
    expect(loadRunSave(run.tuning, p)).toEqual(save);
    store.set('cq3.run.v3', '{broken');
    expect(loadRunSave(run.tuning, p)).toBeNull();
    store.set('cq3.run.v3', JSON.stringify({ ...save, act: 9 }));
    expect(loadRunSave(run.tuning, p)).toBeNull();
    writeRunSave(save);
    clearRunSave();
    expect(loadRunSave(run.tuning, p)).toBeNull();
  });
});

describe('boss music cue', () => {
  it('is on while a mini-boss or the boss is alive in a fight, and off otherwise', () => {
    const run = onMap();
    expect(run.bossFight).toBe(false);
    run.chooseNode(run.map.rows[0][0]);
    expect(run.bossFight).toBe(false);
    goTo(run, 'boss');
    run.skipScenes();
    expect(run.bossFight).toBe(true);
    const c = run.combat!;
    c.enemies[0].uses = c.enemies[0].uses.map(() => 1);
    c.enemies[0].hp = 1;
    c.stacks = 1;
    c.finisher();
    expect(run.bossFight).toBe(false);
  });
});
