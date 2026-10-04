import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Run } from '../../src/core/run';
import { restoreRun, saveLabel, snapshotRun, validSave, type RunSave } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';

const fresh = (t: Tuning = cloneTuning()) => new Run(t, { ...DEFAULT_SETTINGS }, 5);
/** JSON round trip, the way it goes through localStorage. */
const viaJson = (s: RunSave | null): unknown => JSON.parse(JSON.stringify(s));

/** Kill the whole current stage with one big finisher. */
function killStage(run: Run): void {
  const c = run.combat!;
  c.stacks = 5;
  for (const e of c.enemies) e.hp = Math.min(e.hp, 10);
  c.finisher();
}

describe('mid-run save', () => {
  it('nothing to save on the title screen', () => {
    expect(snapshotRun(fresh())).toBeNull();
  });

  it('a fight round-trips: level, stage, hero, coins, enemy HP and combo', () => {
    const run = fresh();
    run.startLevel(0);
    run.startStage(2);
    const c = run.combat!;
    Object.assign(run.hero, { hp: 61, bonusAtk: 3, bonusMaxHp: 10, bonusDmg: 0.2, bonusCrit: 0.05, bonusCritDmg: 0.5, bonusComboPower: 1.5, revives: 0 });
    run.coins = 45;
    c.enemies[0].hp = 123;
    c.combo = 7;
    c.meter = 0.5;
    c.stacks = 2;
    const save = snapshotRun(run, 1000)!;
    expect(save.phase).toBe('fight');

    const back = fresh();
    expect(restoreRun(back, viaJson(save))).toBe(true);
    expect(back.phase).toBe('fight');
    expect(back.levelIndex).toBe(0);
    expect(back.stageIndex).toBe(2);
    expect(back.hero).toEqual({ ...run.hero, abilityTimer: 0 });
    expect(back.coins).toBe(45);
    expect(back.combat!.enemies[0].key).toBe('bandit');
    expect(back.combat!.enemies[0].hp).toBe(123);
    expect(back.combat!.combo).toBe(7);
    expect(back.combat!.meter).toBe(0.5);
    expect(back.combat!.stacks).toBe(2);
    expect(back.combat!.result).toBeNull();
    expect(back.randomState).toEqual(run.randomState);
    // and it saves the same again
    expect(snapshotRun(back, 1000)).toEqual(save);
  });

  it('the restored hero is the run hero the fight uses (damage lands on it)', () => {
    const run = fresh();
    run.startLevel(0);
    run.hero.hp = 50;
    const back = fresh();
    restoreRun(back, viaJson(snapshotRun(run)));
    expect(back.combat!.hero).toBe(back.hero);
  });

  it('a boost choice round-trips and moves on to the next stage', () => {
    const run = fresh();
    run.startLevel(0);
    killStage(run);
    run.sync();
    expect(run.phase).toBe('boost');
    const save = snapshotRun(run)!;
    const back = fresh();
    expect(restoreRun(back, viaJson(save))).toBe(true);
    expect(back.phase).toBe('boost');
    expect(back.boostChoices).toEqual(run.boostChoices);
    expect(back.pendingBoosts).toBe(1);
    expect(back.coins).toBe(run.coins);
    back.pickBoost(0);
    expect(back.phase).toBe('fight');
    expect(back.stageIndex).toBe(1);
  });

  it('a kill still waiting on its animation keeps its coins and boost', () => {
    const run = fresh();
    run.startLevel(0);
    killStage(run); // no run.sync(): the view holds the phase change while the enemy bursts
    const save = snapshotRun(run)!;
    expect(save.phase).toBe('boost');
    expect(save.pendingBoosts).toBe(1);
    expect(save.coins).toBe(run.tuning.enemies.slime.coins);
    const back = fresh();
    restoreRun(back, viaJson(save));
    expect(back.phase).toBe('boost');
    expect(back.boostChoices).toHaveLength(3);
    back.pickBoost(1);
    expect(back.stageIndex).toBe(1);
  });

  it('a group fight keeps who is already dead', () => {
    const run = fresh();
    run.startLevel(1);
    const c = run.combat!;
    c.enemies[1].hp = 0;
    c.enemies[1].alive = false;
    c.enemies[2].hp = 77;
    const back = fresh();
    restoreRun(back, viaJson(snapshotRun(run)));
    const e = back.combat!.enemies;
    expect(e.map((x) => x.alive)).toEqual([true, false, true]);
    expect(e[2].hp).toBe(77);
    expect(back.combat!.frontEnemy()?.id).toBe(e[0].id);
  });

  it('the level-clear chest round-trips, then the next level starts', () => {
    const run = fresh();
    run.startLevel(0, 3);
    killStage(run);
    run.sync();
    run.pickBoost(0);
    expect(run.phase).toBe('levelClear');
    const back = fresh();
    restoreRun(back, viaJson(snapshotRun(run)));
    expect(back.phase).toBe('levelClear');
    back.nextLevel();
    expect(back.levelIndex).toBe(1);
    expect(back.phase).toBe('fight');
  });

  it('a save from the defeat screen retries the level', () => {
    const run = fresh();
    run.startLevel(1);
    run.phase = 'defeat';
    run.coins = 30;
    const back = fresh();
    restoreRun(back, viaJson(snapshotRun(run)));
    expect(back.phase).toBe('fight');
    expect(back.levelIndex).toBe(1);
    expect(back.stageIndex).toBe(0);
    expect(back.hero.hp).toBe(back.tuning.hero.maxHp);
    expect(back.coins).toBe(30);
  });

  it('rejects saves it cannot resume, and leaves the run alone', () => {
    const run = fresh();
    run.startLevel(0, 2);
    const good = viaJson(snapshotRun(run)) as RunSave;
    const bad: unknown[] = [
      null,
      'nope',
      { ...good, v: 99 },
      { ...good, levelIndex: 7 },
      { ...good, stageIndex: 9 },
      { ...good, enemyHp: [1, 2] },
      { ...good, phase: 'title' },
      { ...good, hero: { ...good.hero, hp: 'x' } },
      { ...good, boostChoices: ['laser'] },
    ];
    for (const b of bad) {
      const back = fresh();
      expect(restoreRun(back, b)).toBe(false);
      expect(back.phase).toBe('title');
    }
    // a save from before the levels were edited no longer fits
    const t = cloneTuning();
    t.levels = [{ name: 'Only', stages: [['slime']] }];
    expect(validSave(good, t)).toBe(false);
    expect(validSave(good, cloneTuning())).toBe(true);
  });

  it('labels the Continue button', () => {
    const run = fresh();
    run.startLevel(0, 2);
    expect(saveLabel(snapshotRun(run)!, run.tuning)).toBe('Level 1 - 3/4');
    run.startLevel(1);
    expect(saveLabel(snapshotRun(run)!, run.tuning)).toBe('Level 2');
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
    const run = fresh();
    run.startLevel(0, 1);
    const save = snapshotRun(run)!;
    writeRunSave(save);
    expect(loadRunSave(run.tuning)).toEqual(save);
    store.set('cq3.run.v1', '{broken');
    expect(loadRunSave(run.tuning)).toBeNull();
    store.set('cq3.run.v1', JSON.stringify({ ...save, levelIndex: 9 }));
    expect(loadRunSave(run.tuning)).toBeNull();
    writeRunSave(save);
    clearRunSave();
    expect(loadRunSave(run.tuning)).toBeNull();
  });
});
