// Sparkles on the maps (core/sparkle.ts): a rare glint pays a coin or two. Tiny and not farmable: at most one per
// act-map step (never the act's first), one per world-map visit (new only once you've played), the same one after a
// reload (deterministic from its key), and never paid twice (the profile keeps the claimed keys, through a reload,
// a retry and a replay). Every number is in tuning.life, with a slider.
import { describe, expect, it } from 'vitest';
import { newProfile, readProfile } from '../../src/core/profile';
import { Run } from '../../src/core/run';
import { restoreRun, snapshotRun } from '../../src/core/save';
import {
  claimSparkle,
  mapSparkle,
  mapSparkleKey,
  MAX_KEPT,
  openSparkle,
  readSparkles,
  rollSparkle,
  sparkleClaimed,
  worldSparkle,
  worldSparkleKey,
} from '../../src/core/sparkle';
import { cloneTuning, DEFAULT_SETTINGS, getPath, sliderGroups } from '../../src/core/tuning';

const T = cloneTuning();
const L = T.life;
const viaJson = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

describe('sparkle rolls', () => {
  it('are deterministic: the same step (or visit) always holds the same sparkle', () => {
    for (let step = 1; step < 30; step++) expect(mapSparkle(1234, step, L)).toEqual(mapSparkle(1234, step, L));
    const p = newProfile();
    expect(worldSparkle(p, L)).toEqual(worldSparkle(viaJson(p), L));
  });

  it("never on an act's first step; otherwise about life.mapChance of the steps", () => {
    let n = 0;
    let shown = 0;
    for (let seed = 1; seed <= 400; seed++) {
      expect(mapSparkle(seed * 7919, 0, { ...L, mapChance: 1 })).toBeNull();
      for (let step = 1; step <= 8; step++) {
        n++;
        if (mapSparkle(seed * 7919, step, L)) shown++;
      }
    }
    expect(shown / n).toBeGreaterThan(L.mapChance - 0.04);
    expect(shown / n).toBeLessThan(L.mapChance + 0.04);
    expect(mapSparkle(99, 3, { ...L, mapChance: 0 })).toBeNull();
    expect(mapSparkle(99, 3, { ...L, mapChance: 1 })).not.toBeNull();
  });

  it('pay a coin or two, glint after a short while, and spread their spots', () => {
    const coins = new Set<number>();
    const spots: number[] = [];
    for (let k = 0; k < 500; k++) {
      const s = rollSparkle(mapSparkleKey(k, 3), 1, L)!;
      coins.add(s.coins);
      spots.push(s.spot);
      expect(s.delayMs).toBeGreaterThanOrEqual(L.delayMin * 1000);
      expect(s.delayMs).toBeLessThanOrEqual(L.delayMax * 1000);
      expect(s.spot).toBeGreaterThanOrEqual(0);
      expect(s.spot).toBeLessThan(1);
    }
    expect([...coins].sort()).toEqual([L.coinsMin, L.coinsMax]);
    expect(Math.min(...spots)).toBeLessThan(0.05);
    expect(Math.max(...spots)).toBeGreaterThan(0.95);
    // the sliders can't break it (min above max, zero)
    expect(rollSparkle(5, 1, { ...L, coinsMin: 3, coinsMax: 1 })!.coins).toBeGreaterThanOrEqual(1);
    expect(rollSparkle(5, 1, { ...L, coinsMin: 0, coinsMax: 0 })!.coins).toBe(0);
  });

  it('a map step, another step and another map are different keys', () => {
    const keys = new Set<number>();
    for (let seed = 1; seed <= 50; seed++) for (let step = 0; step < 10; step++) keys.add(mapSparkleKey(seed * 31337, step));
    expect(keys.size).toBe(500);
  });
});

describe('picking one up', () => {
  it('pays into the purse once; a second tap (or a reload) pays nothing', () => {
    const p = newProfile();
    p.coins = 10;
    const s = rollSparkle(mapSparkleKey(42, 2), 1, L)!;
    expect(claimSparkle(p, s, L)).toBe(s.coins);
    expect(p.coins).toBe(10 + s.coins);
    expect(sparkleClaimed(p, s.key)).toBe(true);
    expect(claimSparkle(p, s, L)).toBe(0);
    expect(p.coins).toBe(10 + s.coins);
    // the profile is saved and read back (a reload): the step's sparkle is gone
    const back = readProfile(viaJson(p), T);
    expect(back.sparkles).toEqual([s.key]);
    expect(openSparkle(back, s)).toBeNull();
    expect(openSparkle(newProfile(), s)).toEqual(s);
  });

  it('a reload mid-act puts the same map and step back: the claimed sparkle stays claimed', () => {
    const run = new Run(T, { ...DEFAULT_SETTINGS }, 77, newProfile());
    run.newRun();
    run.skipScenes();
    run.chooseNode(run.choices()[0]);
    run.phase = 'map';
    const at = () => mapSparkle(run.mapSeedFor(run.actIndex), run.path.length, { ...L, mapChance: 1 })!;
    const s = at();
    expect(claimSparkle(run.profile, s, L)).toBeGreaterThan(0);
    const save = viaJson(snapshotRun(run));
    const again = new Run(T, { ...DEFAULT_SETTINGS }, 99, readProfile(viaJson(run.profile), T));
    expect(restoreRun(again, save)).toBe(true);
    const s2 = mapSparkle(again.mapSeedFor(again.actIndex), again.path.length, { ...L, mapChance: 1 })!;
    expect(s2).toEqual(s);
    expect(openSparkle(again.profile, s2)).toBeNull();
  });

  it('a retry (back to the act start) walks the same steps: their claimed sparkles stay claimed', () => {
    const p = newProfile();
    const seed = 555;
    const claimed = [1, 2, 3].map((step) => {
      const s = mapSparkle(seed, step, { ...L, mapChance: 1 })!;
      claimSparkle(p, s, L);
      return s;
    });
    for (const s of claimed) expect(openSparkle(p, mapSparkle(seed, claimed.indexOf(s) + 1, { ...L, mapChance: 1 }))).toBeNull();
  });

  it('remembers the last life.keep keys (and reads junk as none)', () => {
    const p = newProfile();
    for (let k = 0; k < 40; k++) claimSparkle(p, rollSparkle(mapSparkleKey(k, 1), 1, L)!, { ...L, keep: 5 });
    expect(p.sparkles).toHaveLength(5);
    expect(p.sparkles[4]).toBe(mapSparkleKey(39, 1));
    expect(readSparkles(undefined)).toEqual([]);
    expect(readSparkles([1, -2, 'x', 3.5, 2 ** 33, 7])).toEqual([1, 7]);
    expect(readSparkles(Array.from({ length: 200 }, (_, i) => i))).toHaveLength(MAX_KEPT);
    // a profile from before the sparkles: none claimed
    const old = viaJson(newProfile()) as unknown as Record<string, unknown>;
    delete old.sparkles;
    expect(readProfile(old).sparkles).toEqual([]);
  });
});

describe('the world map visit', () => {
  it('is the same visit until you have played (a reload, the title, the camp, a sparkle picked up)', () => {
    const p = newProfile();
    const key = worldSparkleKey(p);
    expect(worldSparkleKey(readProfile(viaJson(p)))).toBe(key);
    p.coins += 2; // the sparkle's own coins don't make a new visit
    p.scrap += 5;
    expect(worldSparkleKey(p)).toBe(key);
    const s = rollSparkle(key, 1, L)!;
    claimSparkle(p, s, L);
    expect(openSparkle(p, rollSparkle(worldSparkleKey(p), 1, L))).toBeNull();
  });

  it('is a new one once you have found gear, earned XP or cleared an act', () => {
    const base = newProfile();
    const key = worldSparkleKey(base);
    expect(worldSparkleKey({ ...base, found: 1 })).not.toBe(key);
    expect(worldSparkleKey({ ...base, actsCleared: 1 })).not.toBe(key);
    expect(worldSparkleKey({ ...base, heroes: { ...base.heroes, rowan: { ...base.heroes.rowan, xp: 40 } } })).not.toBe(key);
    expect(worldSparkleKey({ ...base, weights: 1 })).not.toBe(key);
    // map and world keys never collide in practice (one list holds both)
    const keys = new Set<number>();
    for (let f = 0; f < 300; f++) keys.add(worldSparkleKey({ ...base, found: f }));
    for (let s = 0; s < 300; s++) keys.add(mapSparkleKey(s, 1));
    expect(keys.size).toBe(600);
  });
});

describe('tuning', () => {
  it('every sparkle and critter number has a slider', () => {
    const paths = sliderGroups(T).flatMap((g) => g.sliders.map((s) => s.path));
    for (const k of Object.keys(T.life)) {
      expect(paths, `life.${k}`).toContain(`life.${k}`);
      expect(typeof getPath(T, `life.${k}`)).toBe('number');
    }
  });

  it('keeps them tiny: a coin or two, a minority of steps', () => {
    expect(L.coinsMax).toBeLessThanOrEqual(2);
    expect(L.mapChance).toBeLessThanOrEqual(0.35);
    expect(L.worldChance).toBeLessThanOrEqual(0.6);
  });
});
