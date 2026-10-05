// The profile, kept across runs: progress (acts cleared, weights home), the bag and gear, the purse and scrap, the
// signature drops' bad-luck counters and the accuracy log. Saves from older builds are migrated.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BASE_BY_ID } from '../../src/data/gear';
import { makeItem } from '../../src/core/gear';
import { addItem, equip, newProfile, PROFILE_VERSION, readProfile, recordAct, recordRegion, WEIGHTS_TOTAL } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { Run } from '../../src/core/run';
import { migrateSave, readSave, restoreRun, SAVE_VERSION, snapshotRun } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';

const T = cloneTuning();
const viaJson = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

/** A profile with some gear on, a full purse and a bad-luck count. */
function stocked() {
  const p = newProfile();
  const rng = new Rng(3);
  const sword = addItem(p, T, makeItem(rng, BASE_BY_ID.hedgeSaber, 'epic', 12)).item;
  const charm = addItem(p, T, makeItem(rng, BASE_BY_ID.owlCharm, 'rare', 4)).item;
  addItem(p, T, makeItem(rng, BASE_BY_ID.tuskCrown, 'legendary', 24));
  equip(p, sword.uid);
  equip(p, charm.uid);
  sword.locked = true;
  sword.plus = 3;
  Object.assign(p, { coins: 420, scrap: 37, actsCleared: 2, smithMet: true });
  p.blp.tuskCrown = 4;
  p.acc.recent.push(-12, 30, 5);
  p.acc.history.push({ at: 1, act: 0, acc: 0.71, n: 120, sd: 58, bias: 9 });
  return { p, sword, charm };
}

describe('profile', () => {
  it('starts empty, and reads back everything it saved', () => {
    const p = newProfile();
    expect(p).toMatchObject({ v: PROFILE_VERSION, actsCleared: 0, weights: 0, coins: 0, scrap: 0, items: [], smithMet: false });
    const { p: full } = stocked();
    const back = readProfile(viaJson(full));
    expect(back).toEqual(full);
    expect(WEIGHTS_TOTAL).toBe(12);
  });

  it('migrates a v1 save (progress only): progress kept, the gear starts empty, the cleared acts\' relics unlocked', () => {
    const back = readProfile(viaJson({ v: 1, actsCleared: 2, weights: 1 }));
    expect(back).toEqual({ ...newProfile(), actsCleared: 2, weights: 1, relics: ['shortFuse', 'ricochet', 'chainReaction', 'crescendo'] });
    expect(readProfile({ v: 1, actsCleared: 99, weights: -3 })).toMatchObject({ actsCleared: 3, weights: 0 });
  });

  it('starts over on junk, and drops what does not fit (broken items, gear in the wrong slot)', () => {
    for (const bad of [null, 'x', { v: 7 }, {}]) expect(readProfile(bad)).toEqual(newProfile());
    const { p, sword } = stocked();
    const data = viaJson(p) as unknown as Record<string, unknown>;
    (data.items as unknown[]).push({ uid: 99, base: 'laserSword' }, 'junk');
    (data.equipped as Record<string, number>).helm = sword.uid; // a sword on the head
    (data.equipped as Record<string, number>).boots = 12345; // not in the bag
    data.coins = -50;
    const back = readProfile(data);
    expect(back.items).toHaveLength(3);
    expect(back.equipped.helm).toBe(0);
    expect(back.equipped.boots).toBe(0);
    expect(back.equipped.weapon).toBe(sword.uid);
    expect(back.coins).toBe(0);
    expect(back.nextUid).toBeGreaterThan(Math.max(...back.items.map((i) => i.uid)));
  });

  it('remembers the furthest act cleared, and the region weight once', () => {
    const p = newProfile();
    expect(recordAct(p, 0)).toBe(true);
    expect(recordAct(p, 0)).toBe(false);
    expect(recordAct(p, 2)).toBe(true);
    expect(recordAct(p, 1)).toBe(false);
    expect(p.actsCleared).toBe(3);
    expect(recordRegion(p)).toBe(true);
    expect(recordRegion(p)).toBe(false);
    expect(p.weights).toBe(1);
  });
});

describe('run save v4 -> v5', () => {
  /** A v4 save (before gear): coins lived in the run. */
  function v4Save(): Record<string, unknown> {
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 5);
    r.newRun();
    r.skipScenes();
    r.chooseNode(r.map.rows[0][0]);
    r.phase = 'map';
    const s = viaJson(snapshotRun(r)!) as unknown as Record<string, unknown>;
    delete s.loot;
    delete s.aims;
    return { ...s, v: 4, coins: 75, actCoins: 40 };
  }

  it("moves the run's coins into the profile's purse and resumes the run", () => {
    const p = newProfile();
    p.coins = 10;
    const old = v4Save();
    expect(readSave(old, T)).toBeNull(); // not readable as it is
    const s = migrateSave(old, p) as Record<string, unknown>;
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.coins).toBeUndefined();
    expect(s.actCoins).toBeUndefined();
    expect(p.coins).toBe(85);
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 9, p);
    expect(restoreRun(r, s)).toBe(true);
    expect(r.phase).toBe('map');
    expect(r.path).toEqual(old.path);
    expect(r.coins).toBe(85);
  });

  it('leaves current and unknown saves alone', () => {
    const p = newProfile();
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 5, p);
    r.newRun();
    r.skipScenes();
    const cur = viaJson(snapshotRun(r)!);
    expect(migrateSave(cur, p)).toBe(cur);
    expect(migrateSave(null, p)).toBeNull();
    expect(migrateSave({ v: 3 }, p)).toEqual({ v: 3 });
    expect(p.coins).toBe(0);
  });

  it('a resumed run wears the gear equipped now (gear is not saved with the run)', () => {
    const { p, sword } = stocked();
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 5, p);
    r.newRun();
    r.skipScenes();
    const s = viaJson(snapshotRun(r)!);
    expect('gear' in s.hero).toBe(false);
    const back = new Run(T, { ...DEFAULT_SETTINGS }, 6, p);
    p.equipped.weapon = 0;
    restoreRun(back, s);
    expect(back.hero.gear.stats.atk).toBe(0);
    p.equipped.weapon = sword.uid;
    back.refreshGear();
    expect(back.hero.gear.stats.atk).toBeGreaterThan(0);
  });
});

describe('profile storage', () => {
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

  it('migrates the old progress key to the profile, and the v4 run save once', async () => {
    const { loadProfile, loadRunSave, writeProfile } = await import('../../src/engine/storage');
    store.set('cq3.progress.v1', JSON.stringify({ v: 1, actsCleared: 1, weights: 0 }));
    const p = loadProfile();
    expect(p.actsCleared).toBe(1);
    writeProfile(p);
    expect(store.has('cq3.progress.v1')).toBe(false);
    expect(JSON.parse(store.get('cq3.profile.v2')!).v).toBe(3);
    // a v4 run save: its coins land in the purse once, and both are written back
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 5, p);
    r.newRun();
    r.skipScenes();
    const s = viaJson(snapshotRun(r)!) as unknown as Record<string, unknown>;
    store.set('cq3.run.v3', JSON.stringify({ ...s, v: 4, coins: 60, actCoins: 0, loot: undefined, aims: undefined }));
    expect(loadRunSave(T, p)).not.toBeNull();
    expect(p.coins).toBe(60);
    expect(loadProfile().coins).toBe(60);
    expect(loadRunSave(T, p)).not.toBeNull();
    expect(p.coins).toBe(60); // not twice
  });
});
