// The Mapmaker's Edits (data/edits.ts, core/run.ts editedFight): opt-in hardships for the next act once a region is
// restored. Each one, with and without: what it changes in the act's fights, that it pays (XP, first-clear gems once),
// that it survives a save, and (the bot at 75%) that it measurably makes the act harder.
import { describe, expect, it } from 'vitest';
import { EDITS, EDIT_IDS, EDIT_LINE_W, type EditId } from '../../src/data/edits';
import { textWidth } from '../../src/engine/font';
import { botRun, fight, playAct } from '../../src/core/bot';
import { heroMaxHp } from '../../src/core/combat';
import { newProfile, type Profile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { editedFight, Run } from '../../src/core/run';
import { migrateSave, readSave, restoreRun, snapshotRun, SAVE_VERSION } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS } from '../../src/core/tuning';

const T = cloneTuning();
const viaJson = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

/** A profile that has restored Greenmarch (the Edits open), with `on` drawn into the next act. */
function restored(on: EditId[] = []): Profile {
  const p = newProfile();
  p.actsCleared = 3;
  p.weights = 1;
  p.edits.on = on.slice();
  return p;
}

/** A run on act `act`'s map (a replay: its starting picks made), the Edits as the profile has them. */
function onAct(p: Profile, act = 2, seed = 7): Run {
  const r = botRun(T, seed, p, act);
  while (r.phase === 'boost') r.pickBoost(0);
  return r;
}

/** The first fight of the act's first row, fought by the bot at `acc` from full HP. */
function firstFight(p: Profile, seed: number, acc = 0.75) {
  const r = onAct(p, 2, seed);
  r.hero.hp = heroMaxHp(r.tuning, r.hero);
  r.chooseNode(r.map.rows[0][seed % r.map.rows[0].length]);
  return { r, st: fight(r, r.combat!, new Rng(seed * 31 + 7), { accuracy: acc, seed }) };
}

describe("the Mapmaker's Edits", () => {
  it('five of them, each with a name, a short line and a weight; off by default; closed until a region is restored', () => {
    expect(EDITS.length).toBeGreaterThanOrEqual(4);
    expect(EDITS.length).toBeLessThanOrEqual(6);
    for (const e of EDITS) {
      expect(e.name.length, e.id).toBeLessThanOrEqual(14);
      expect(e.line.length, e.id).toBeLessThanOrEqual(36);
      expect(textWidth(e.line, 1, false), e.id).toBeLessThanOrEqual(EDIT_LINE_W); // (one row of the chooser)
      expect(e.weight, e.id).toBeGreaterThanOrEqual(1);
    }
    expect(newProfile().edits).toEqual({ on: [], cleared: {} });
    // a newcomer (no region restored) never fights under one, whatever the profile says
    const p = newProfile();
    p.edits.on = ['swiftReds', 'lastLife'];
    const r = new Run(T, { ...DEFAULT_SETTINGS }, 7, p);
    r.newRun();
    expect(r.editsOpen).toBe(false);
    expect(r.edits).toEqual([]);
    expect(r.hero.revives).toBe(T.hero.revivesPerAct);
    // once Greenmarch is restored they're drawn into the next act started
    const q = onAct(restored(['swiftReds', 'lastLife']));
    expect(q.edits).toEqual(['swiftReds', 'lastLife']);
  });

  it('each changes its one thing in the act\'s fights (with / without)', () => {
    const base = editedFight(T, []);
    expect(base.tuning).toBe(T);
    expect([base.hpMult, base.redSpeed]).toEqual([1, 1]);
    const on = (id: EditId) => editedFight(T, [id]);
    expect(on('swiftReds').redSpeed).toBeCloseTo(T.edits.redSpeed);
    expect(on('ironHides').hpMult).toBeCloseTo(T.edits.hpMult);
    expect(on('thinMercy').tuning.spam.healCap).toBeCloseTo(T.edits.healCap);
    expect(on('thinMercy').tuning.spam.healCap).toBeLessThan(T.spam.healCap);
    expect(on('sharpEdges').tuning.judge.missHpShare).toBeCloseTo(T.judge.missHpShare * T.edits.missMult);
    expect(on('lastLife').tuning.spam.forgiveMax).toBe(0);
    // ...and nothing else (the run's tuning is never changed)
    for (const id of EDIT_IDS) {
      const e = on(id);
      if (id !== 'swiftReds') expect(e.redSpeed, id).toBe(1);
      if (id !== 'ironHides') expect(e.hpMult, id).toBe(1);
      if (id !== 'thinMercy') expect(e.tuning.spam.healCap, id).toBe(T.spam.healCap);
    }
    expect(T.spam.healCap).toBe(cloneTuning().spam.healCap);
    // in a fight: the foes' HP, the reds' speed, Last Life's revives
    const plain = onAct(restored([]));
    plain.chooseNode(plain.map.rows[0][0]);
    const hard = onAct(restored(['ironHides', 'swiftReds', 'lastLife']));
    hard.chooseNode(hard.map.rows[0][0]);
    expect(hard.combat!.enemies[0].maxHp).toBe(Math.round(plain.combat!.enemies[0].maxHp * T.edits.hpMult));
    expect(hard.combat!.redSpeed).toBeCloseTo(plain.combat!.redSpeed * T.edits.redSpeed);
    expect(plain.hero.revives).toBe(T.hero.revivesPerAct);
    expect(hard.hero.revives).toBe(0);
    expect(hard.actHero.revives).toBe(0); // (a retry keeps it)
  });

  it('they pay: more XP from the act, and gems the first time the act is cleared under each (once)', () => {
    const xpOf = (on: EditId[]) => {
      const p = restored(on);
      firstFight(p, 3, 0.95);
      return p.heroes.rowan.xp;
    };
    expect(xpOf(['swiftReds', 'thinMercy'])).toBeGreaterThan(xpOf([]));
    // the act clear: gems for each Edit new to this act, then never again
    const p = restored(['ironHides', 'thinMercy']);
    const r = onAct(p, 2);
    const clear = () => {
      r.phase = 'actClear';
      (r as unknown as { clearAct(): void }).clearAct();
    };
    const g0 = p.gems;
    clear();
    expect(p.edits.cleared['2'].sort()).toEqual(['ironHides', 'thinMercy']);
    const paid = p.gems - g0;
    expect(paid).toBeGreaterThanOrEqual(3 * T.edits.gemsPer);
    const g1 = p.gems;
    clear();
    expect(p.gems - g1).toBeLessThan(3 * T.edits.gemsPer); // (the Edits' gems once; a first clear's own gems aside)
  });

  it('the act\'s Edits survive a save (v8); a v7 save goes on with none', () => {
    const p = restored(['sharpEdges']);
    const r = onAct(p);
    r.chooseNode(r.map.rows[0][0]);
    const s = viaJson(snapshotRun(r)!);
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.edits).toEqual(['sharpEdges']);
    p.edits.on = []; // (taken off at camp since: the act in progress keeps its own)
    const back = new Run(T, { ...DEFAULT_SETTINGS }, 99, p);
    restoreRun(back, readSave(s, T)!);
    expect(back.edits).toEqual(['sharpEdges']);
    const old = migrateSave({ ...s, v: 7, edits: undefined }, p) as { v: number; edits: string[] };
    expect(old.v).toBe(8);
    expect(old.edits).toEqual([]);
  });

  it('the bot at 75%: each Edit measurably raises what an act costs or how often it falls', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const cost = (on: EditId[], extra?: (p: Profile) => void) =>
      seeds.reduce((sum, s) => {
        const p = restored(on);
        extra?.(p);
        const { r, st } = firstFight(p, s);
        return sum + st.hpLost / heroMaxHp(r.tuning, r.hero) + (st.won ? 0 : 1);
      }, 0);
    const base = cost([]);
    for (const id of ['swiftReds', 'ironHides', 'sharpEdges'] as EditId[]) expect(cost([id]), id).toBeGreaterThan(base * 1.05);
    // Thin Mercy: only felt with heals (a relic that heals every hit)
    const healer = (p: Profile) => p.relics.push('vampiricFang');
    const healBase = (on: EditId[]) =>
      seeds.reduce((sum, s) => {
        const p = restored(on);
        healer(p);
        const r = onAct(p, 2, s);
        r.hero.relics = ['vampiricFang'];
        r.hero.hp = heroMaxHp(r.tuning, r.hero) * 0.4;
        r.chooseNode(r.map.rows[0][s % r.map.rows[0].length]);
        const st = fight(r, r.combat!, new Rng(s * 31 + 7), { accuracy: 0.75, seed: s });
        return sum + Object.values(st.healBy).reduce((a, b) => a + b, 0);
      }, 0);
    expect(healBase(['thinMercy'])).toBeLessThan(healBase([]) * 0.8);
    // Last Life: the act's revives are gone (every act's safety net): over whole acts at 75%, more are lost
    expect(onAct(restored(['lastLife'])).hero.revives).toBeLessThan(onAct(restored([])).hero.revives);
    // (Act 2 replayed by a hero with nothing: it dies now and then; measured 5 of 16 lost, 10 under Last Life)
    const lost = (on: EditId[]) =>
      seeds.filter((s) => {
        const r = onAct(restored(on), 1, s);
        return !playAct(r, new Rng(s * 13 + 5), { accuracy: 0.75, seed: s }).won;
      }).length;
    expect(lost(['lastLife'])).toBeGreaterThanOrEqual(lost([]) + 2);
  });
});
