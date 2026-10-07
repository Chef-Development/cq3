// A fight's foes come in waves, one after another ("foe 3/7"): the next wave walks in a moment after one falls,
// and the fight is won when the last wave is beaten. Mid-fight saves keep the wave.
import { describe, expect, it } from 'vitest';
import { Combat, type CombatEvent } from '../../src/core/combat';
import { Run } from '../../src/core/run';
import { restoreRun, snapshotRun } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';
import { setup } from './helpers';

const types = (ev: CombatEvent[]) => ev.map((e) => e.type);
/** Kill everything on screen with one finisher. */
function clear(c: Combat): void {
  for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 1);
  c.stacks = 1;
  expect(c.finisher()).toBe(true);
}

describe('waves of foes', () => {
  it('the next wave walks in a moment after one falls; the fight is won after the last', () => {
    const { c, t } = setup({ tune: (t) => (t.waves.gapSec = 0.5) });
    const w = new Combat({ tuning: t, settings: c.settings, hero: c.hero, enemies: [], waves: [['slime'], ['crow', 'boar'], ['bandit']], seed: 1, spawning: false });
    expect(w.enemies.map((e) => e.key)).toEqual(['slime']);
    expect([w.foesBeaten, w.foesTotal]).toEqual([0, 4]);
    clear(w);
    expect(w.result).toBeNull();
    expect(types(w.drainEvents())).toContain('waveClear');
    expect(w.finisherReady).toBe(false); // nobody to hit between waves
    w.advanceTo(w.time + 0.45);
    expect(w.enemies.filter((e) => e.alive)).toHaveLength(0);
    w.advanceTo(w.time + 0.1);
    const ev = w.drainEvents().find((e) => e.type === 'wave');
    expect(ev).toMatchObject({ type: 'wave', index: 1, total: 3 });
    const alive = w.enemies.filter((e) => e.alive);
    expect(alive.map((e) => [e.key, e.slot])).toEqual([
      ['crow', 0],
      ['boar', 1],
    ]);
    expect(w.groupFight).toBe(true);
    expect(w.foesBeaten).toBe(1);
    clear(w);
    w.advanceTo(w.time + 0.6);
    expect(w.foesBeaten).toBe(3);
    expect(w.enemies.filter((e) => e.alive).map((e) => e.key)).toEqual(['bandit']);
    clear(w);
    expect(w.result).toBe('won');
    expect(w.foesBeaten).toBe(4);
  });

  it("a split foe counts as beaten only when all its pieces are; summons don't count", () => {
    const { c } = setup({ enemies: ['slime'] });
    const slime = c.enemies[0];
    c.useSpecial(slime, 0); // Split!
    expect(c.enemies.filter((e) => e.alive).map((e) => e.key)).toEqual(['slimelet', 'slimelet']);
    expect([c.foesBeaten, c.foesTotal]).toEqual([0, 1]);
    const [a, b] = c.enemies.filter((e) => e.alive);
    a.alive = false;
    expect(c.foesBeaten).toBe(0);
    b.alive = false;
    expect(c.foesBeaten).toBe(1);
  });

  it('a mid-fight save resumes in the same wave, with the foes beaten so far', () => {
    const r = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 5);
    r.newRun();
    r.skipScenes();
    r.chooseNode(r.map.rows[0][0]);
    const c = r.combat!;
    expect(c.waves.length).toBeGreaterThan(1);
    clear(c);
    r.sync();
    c.advanceTo(c.time + r.tuning.waves.gapSec + 0.05);
    expect(c.waveIndex).toBe(1);
    c.enemies.filter((e) => e.alive)[0].hp = 7;
    const save = JSON.parse(JSON.stringify(snapshotRun(r)));
    expect(save.fight.wave).toBe(1);
    const back = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 9);
    expect(restoreRun(back, save)).toBe(true);
    const b = back.combat!;
    expect(b.waveIndex).toBe(1);
    expect(b.enemies.map((e) => e.key)).toEqual(r.node!.waves[1]);
    expect(b.enemies[0].hp).toBe(7);
    expect([b.foesBeaten, b.foesTotal]).toEqual([c.foesBeaten, c.foesTotal]);
  });

  it('a save between two waves brings the next one straight in', () => {
    const r = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 5);
    r.newRun();
    r.skipScenes();
    r.chooseNode(r.map.rows[0][0]);
    clear(r.combat!);
    r.sync();
    const back = new Run(cloneTuning(), { ...DEFAULT_SETTINGS }, 9);
    expect(restoreRun(back, JSON.parse(JSON.stringify(snapshotRun(r))))).toBe(true);
    const b = back.combat!;
    expect(b.result).toBeNull();
    b.step();
    expect(b.waveIndex).toBe(1);
    expect(b.enemies.some((e) => e.alive)).toBe(true);
  });
});
