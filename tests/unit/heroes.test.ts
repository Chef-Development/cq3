// Hero levels (core/heroes.ts): the XP curve, XP from kills and act clears going to the hero who fights, a level-up
// taking effect at the next fight, the profile's heroes (v2 -> v3 migration, v3 round trip) and the skill screen's
// stat previews.
import { describe, expect, it } from 'vitest';
import type { NodeType } from '../../src/data/types';
import { SKILL_NODES, skillById, skillHero } from '../../src/data/skills';
import { heroMaxHp, newHero } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { actXp, addXp, killXp, levelFromXp, levelProgress, maxLevel, skillN, skillPreview, xpForLevel, xpToNext, type HeroId } from '../../src/core/heroes';
import { heroProgress, meetSable, newProfile, profileBuild, readProfile, selectHero, type Profile } from '../../src/core/profile';
import { unlocksFor } from '../../src/core/relics';
import { Run, skillStatPreview } from '../../src/core/run';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';
import { toLastWave } from './helpers';

const viaJson = <X>(x: X): X => JSON.parse(JSON.stringify(x)) as X;

/** Tuning with a round XP curve: 10 x L^2 to go from level L to L+1 (10, 40, 90...). */
function curve(): Tuning {
  const t = cloneTuning();
  Object.assign(t.levels, { xpBase: 10, xpExp: 2, max: 30 });
  return t;
}

describe('XP and levels', () => {
  it('xpToNext follows xpBase x L ^ xpExp; xpForLevel adds them up', () => {
    const t = curve();
    expect([1, 2, 3, 10].map((l) => xpToNext(t, l))).toEqual([10, 40, 90, 1000]);
    expect(xpToNext(t, 0)).toBe(10);
    expect([1, 2, 3, 4].map((l) => xpForLevel(t, l))).toEqual([0, 10, 50, 140]);
  });

  it('levelFromXp and levelProgress at the boundaries', () => {
    const t = curve();
    expect(levelFromXp(t, 0)).toBe(1);
    for (const l of [2, 3, 10, 30]) {
      expect(levelFromXp(t, xpForLevel(t, l) - 1), `just below ${l}`).toBe(l - 1);
      expect(levelFromXp(t, xpForLevel(t, l)), `at ${l}`).toBe(l);
    }
    expect(levelProgress(t, 0)).toEqual({ level: 1, into: 0, need: 10 });
    expect(levelProgress(t, 49)).toEqual({ level: 2, into: 39, need: 40 });
    expect(levelProgress(t, 50)).toEqual({ level: 3, into: 0, need: 90 });
  });

  it('levels stop at the max: no more XP needed there', () => {
    const t = curve();
    expect(maxLevel(t)).toBe(30);
    expect(levelFromXp(t, 1e9)).toBe(30);
    expect(levelProgress(t, 1e9)).toEqual({ level: 30, into: 0, need: 0 });
    expect(levelProgress(t, xpForLevel(t, 30))).toEqual({ level: 30, into: 0, need: 0 });
    t.levels.max = 5;
    expect(levelFromXp(t, 1e9)).toBe(5);
    expect(levelProgress(t, xpForLevel(t, 5) - 1).level).toBe(4);
  });

  it('addXp returns the levels gained (and ignores negative XP)', () => {
    const t = curve();
    const p = newProfile().heroes.rowan;
    expect(addXp(t, p, 9)).toBe(0);
    expect(addXp(t, p, 41)).toBe(2);
    expect(p.xp).toBe(50);
    expect(addXp(t, p, -100)).toBe(0);
    expect(p.xp).toBe(50);
  });

  it('a kill gives xpKill (elites xpElite, bosses xpBoss) x (1 + act)', () => {
    const t = cloneTuning();
    const L = t.levels;
    expect(t.enemies.knight.elite && t.enemies.captain.boss && t.enemies.boarKing.boss).toBe(true);
    for (const act of [0, 1, 2]) {
      expect(killXp(t, 'slime', act)).toBe(Math.round(L.xpKill * (1 + act)));
      expect(killXp(t, 'knight', act)).toBe(Math.round(L.xpElite * (1 + act)));
      expect(killXp(t, 'captain', act)).toBe(Math.round(L.xpBoss * (1 + act)));
    }
    expect(killXp(t, 'slime', 2)).toBe(3 * killXp(t, 'slime', 0));
    expect(killXp(t, 'nobody', 0)).toBe(0);
  });

  it('an act clear gives xpAct x (act + 1), double the first time', () => {
    const t = cloneTuning();
    expect(actXp(t, 0, false)).toBe(t.levels.xpAct);
    expect(actXp(t, 0, true)).toBe(2 * t.levels.xpAct);
    expect(actXp(t, 2, false)).toBe(3 * t.levels.xpAct);
    expect(actXp(t, 2, true)).toBe(6 * t.levels.xpAct);
  });

  it('a level adds a little max HP and base attack', () => {
    const t = cloneTuning();
    const at = (level: number) => newHero(t, emptyLoadout(), { id: 'rowan', level, skills: [] });
    expect(heroMaxHp(t, at(10))).toBe(t.hero.maxHp + 9 * t.levels.hpPer);
    expect(heroMaxHp(t, at(99))).toBe(t.hero.maxHp + (maxLevel(t) - 1) * t.levels.hpPer); // capped
  });
});

// ---------------------------------------------------------------- in a run

function onMap(p: Profile = newProfile(), tune?: (t: Tuning) => void): Run {
  const t = cloneTuning();
  t.hero.critChance = 0;
  t.juice.hitStopMs = 0;
  tune?.(t);
  const r = new Run(t, { ...DEFAULT_SETTINGS }, 7, p);
  r.newRun();
  r.skipScenes();
  return r;
}

/** Walk to the first node of `type` in the current act (from row `row` on) and enter it. */
function goTo(r: Run, type: NodeType, row = 0): void {
  const m = r.map;
  const target = m.nodes.find((n) => n.type === type && n.row >= row)!;
  const path = [target.id];
  while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((p) => p.next.includes(path[0]))!.id);
  r.path = path.slice(0, -1);
  r.phase = 'map';
  r.chooseNode(target.id);
  r.skipScenes();
}

/** Win the current fight at once; returns the XP its kills are worth. */
function win(r: Run): number {
  const c = r.combat!;
  toLastWave(c);
  for (const e of c.enemies) {
    e.uses = e.uses.map(() => 1);
    e.hp = Math.min(e.hp, 5);
  }
  c.stacks = 1;
  c.finisher();
  const xp = c.enemies.filter((e) => !e.alive && !e.fled && !e.split).reduce((n, e) => n + killXp(r.tuning, e.key, r.actIndex), 0);
  r.sync();
  if (r.phase === 'loot') r.collectLoot();
  return xp;
}

describe('XP in a run', () => {
  it('kills give XP to the hero who fights (Rowan, or Sable once picked)', () => {
    for (const hero of ['rowan', 'sable'] as HeroId[]) {
      const p = newProfile();
      if (hero === 'sable') {
        meetSable(p);
        expect(selectHero(p, 'sable')).toBe(true);
      }
      const r = onMap(p);
      expect(r.hero.build.id).toBe(hero);
      goTo(r, 'fight');
      const xp = win(r);
      expect(xp).toBeGreaterThan(0);
      expect(p.heroes[hero].xp).toBe(xp);
      expect(p.heroes[hero === 'rowan' ? 'sable' : 'rowan'].xp).toBe(0);
      expect(r.actXpGained).toBe(xp);
    }
  });

  it('clearing an act gives its XP, double the first time; a replay gives the plain amount', () => {
    const p = newProfile();
    const r = onMap(p);
    goTo(r, 'boss');
    win(r);
    const before = p.heroes.rowan.xp;
    r.pickBoost(0);
    expect(r.phase).toBe('actClear');
    expect(p.heroes.rowan.xp - before).toBe(actXp(r.tuning, 0, true));
    const again = onMap(p);
    goTo(again, 'boss');
    win(again);
    const before2 = p.heroes.rowan.xp;
    again.pickBoost(0);
    expect(p.heroes.rowan.xp - before2).toBe(actXp(r.tuning, 0, false));
  });

  it('a level-up mid-act takes effect at the next fight (refreshGear), and is shown once', () => {
    const p = newProfile();
    const r = onMap(p);
    const t = r.tuning;
    goTo(r, 'fight');
    const c = r.combat!;
    // the fight's kills level Rowan up...
    p.heroes.rowan.xp = xpForLevel(t, 4) - 1;
    win(r);
    expect(profileBuild(p, t).level).toBeGreaterThanOrEqual(4);
    expect(r.takeLevelUps()).toBeGreaterThanOrEqual(1);
    expect(r.takeLevelUps()).toBe(0);
    // ...but the fight (and the map after it) still has the hero as they started it
    expect(c.hero.build.level).toBe(1);
    expect(r.hero.build.level).toBe(1);
    r.pickBoost(0);
    const hpBefore = heroMaxHp(t, r.hero);
    goTo(r, 'fight', r.node!.row + 1); // the next fight
    expect(r.phase).toBe('fight');
    const level = profileBuild(p, t).level;
    expect(r.hero.build.level).toBe(level);
    expect(r.combat!.hero.build.level).toBe(level);
    expect(heroMaxHp(t, r.hero) - hpBefore).toBe((level - 1) * t.levels.hpPer);
  });

  it('XP survives a defeat (like the gear): the retry keeps the levels earned', () => {
    const p = newProfile();
    const r = onMap(p);
    goTo(r, 'fight');
    win(r);
    const xp = p.heroes.rowan.xp;
    r.retry();
    expect(p.heroes.rowan.xp).toBe(xp);
    expect(r.hero.build).toEqual(profileBuild(p, r.tuning));
  });
});

// ---------------------------------------------------------------- the profile's heroes

describe('profile v3: heroes', () => {
  const t = cloneTuning();

  it('migrates a v2 profile: Rowan gets the cleared acts\' first-clear XP, their relics unlock, Sable waits', () => {
    const v2 = { v: 2, actsCleared: 2, weights: 0, coins: 50, scrap: 3, items: [], equipped: {}, nextUid: 1, found: 0, blp: {}, smithMet: true };
    const p = readProfile(viaJson(v2), t);
    expect(p.v).toBe(4);
    expect(p.heroes.rowan.xp).toBe(actXp(t, 0, true) + actXp(t, 1, true));
    expect(p.heroes.rowan.skills).toEqual([]);
    expect(p.heroes.sable).toEqual({ unlocked: false, xp: 0, skills: [], stars: 1, shards: 0, acts: 0 });
    expect(p.hero).toBe('rowan');
    expect(p.relics.slice().sort()).toEqual([...unlocksFor('act', 0), ...unlocksFor('act', 1)].sort());
    expect(p).toMatchObject({ coins: 50, scrap: 3, smithMet: true, sableMet: false });
    // all three acts cleared: the level that buys
    const all = readProfile(viaJson({ ...v2, actsCleared: 3 }), t);
    expect(all.heroes.rowan.xp).toBe(actXp(t, 0, true) + actXp(t, 1, true) + actXp(t, 2, true));
    expect(levelFromXp(t, all.heroes.rowan.xp)).toBeGreaterThan(1);
    // no tuning to price it with: no XP (the relics still unlock)
    expect(readProfile(viaJson(v2)).heroes.rowan.xp).toBe(0);
  });

  it('reads back heroes, XP, skills (in the order learned) and the pick', () => {
    const p = newProfile();
    meetSable(p);
    selectHero(p, 'sable');
    Object.assign(p.heroes.rowan, { xp: 900, skills: ['stout', 'keenEdge', 'plateTraining', 'steadyAim'] });
    Object.assign(p.heroes.sable, { xp: 120, skills: [], stars: 3, shards: 4, acts: 2 });
    p.relics = ['ricochet'];
    expect(readProfile(viaJson(p), t)).toEqual(p);
  });

  it('drops skills that do not fit: out of order, unknown, or from the other tree', () => {
    const p = newProfile();
    meetSable(p);
    p.heroes.rowan.skills = ['keenEdge', 'followThrough', 'bogus', 'stout', 'quickHands', 'plateTraining', 'rhythm'];
    p.heroes.sable.skills = ['keenEdge', 'stout'];
    const back = readProfile(viaJson(p), t);
    expect(back.heroes.rowan.skills).toEqual(['keenEdge', 'stout', 'plateTraining', 'rhythm']);
    expect(back.heroes.sable.skills).toEqual([]); // Rowan's nodes are not Sable's
    const junk = viaJson(p) as unknown as { heroes: Record<string, unknown> };
    junk.heroes.rowan = { xp: -40, skills: 'keenEdge', unlocked: false };
    const fixed = readProfile(junk, t);
    expect(fixed.heroes.rowan).toEqual({ unlocked: true, xp: 0, skills: [], stars: 1, shards: 0, acts: 0 });
  });

  it('Sable can only be picked once unlocked', () => {
    const p = newProfile();
    expect(selectHero(p, 'sable')).toBe(false);
    expect(p.hero).toBe('rowan');
    const data = viaJson({ ...p, hero: 'sable' });
    expect(readProfile(data, t).hero).toBe('rowan'); // a save that picks a locked Sable
    meetSable(p);
    expect(selectHero(p, 'sable')).toBe(true);
    expect(readProfile(viaJson(p), t).hero).toBe('sable');
    expect(readProfile(viaJson({ ...p, hero: 'nobody' }), t).hero).toBe('rowan');
    expect(heroProgress(p)).toBe(p.heroes.sable);
    expect(profileBuild(p, t)).toEqual({ id: 'sable', level: 1, skills: [], stars: 1 });
  });
});

// ---------------------------------------------------------------- the skill screen

describe('skill previews', () => {
  const t = cloneTuning();
  const want: Record<string, string> = {
    keenEdge: 'ATK 10 -> 11',
    steadyAim: 'Crit 5% -> 13%',
    stout: 'Max HP 100 -> 108',
    plateTraining: 'DEF 0 -> 5',
    rhythm: 'Meter +0% -> +15%',
    powerStance: 'Combo 5 -> 6.5',
  };
  const show = (p: { stat: string; before: string; after: string } | null) => (p ? `${p.stat} ${p.before} -> ${p.after}` : null);

  it('every stat node shows the stat it changes, before -> after, from the real stats', () => {
    const stats = SKILL_NODES.filter((n) => n.kind === 'stat');
    expect(stats.map((n) => n.id).sort()).toEqual(Object.keys(want).sort());
    for (const node of stats) {
      const hero = newHero(t, emptyLoadout(), { id: skillHero(node.id)!, level: 1, skills: [] });
      expect(show(skillStatPreview(t, hero, node.id)), node.id).toBe(want[node.id]);
      // the same once learned (the screen shows what it adds)
      const learned = newHero(t, emptyLoadout(), { id: skillHero(node.id)!, level: 1, skills: [node.id] });
      expect(show(skillStatPreview(t, learned, node.id)), node.id).toBe(want[node.id]);
    }
  });

  it('from where the hero stands: a level-10 Rowan with other nodes learned', () => {
    const t = cloneTuning();
    t.skills.n.keenEdge = 8;
    t.skills.n.stout = 10;
    const hero = newHero(t, emptyLoadout(), { id: 'rowan', level: 10, skills: ['stout'] });
    expect(show(skillStatPreview(t, hero, 'keenEdge'))).toBe('ATK 11 -> 12'); // 11.35 -> 12.26
    expect(show(skillStatPreview(t, hero, 'stout'))).toBe(`Max HP ${100 + 18} -> ${Math.round(118 * 1.1)}`);
  });

  it('rule nodes have no stat preview: they show their before and after text, with the number in it', () => {
    for (const node of SKILL_NODES.filter((n) => n.kind !== 'stat')) expect(skillStatPreview(t, newHero(t), node.id), node.id).toBeNull();
    expect(skillPreview(t, skillById('whetstone')!)).toEqual({ before: 'Crits come by chance.', after: `Every ${skillN(t, 'whetstone')}th combo hit crits.` });
    expect(skillPreview(t, skillById('keenEdge')!)).toEqual({ stat: 'ATK', delta: `+${skillN(t, 'keenEdge')}%` });
  });
});
