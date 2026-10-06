// Skill trees: Rowan's rule nodes and capstones in a fight (core/skill-fx.ts), what stat nodes add (heroStats), and
// learning: a point every 2 levels, nodes in branch order, the free reset.
import { describe, expect, it } from 'vitest';
import { SKILL_NODES, skillHero, type SkillStat } from '../../src/data/skills';
import { Combat, heroStats, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { canLearn, learn, newHeroProgress, pointsLeft, resetSkills, skillN, skillPoints, treeOf, xpForLevel, type HeroId } from '../../src/core/heroes';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { setup } from './helpers';

/** A fight with Rowan knowing `skills`, the cursor mid-bar (no spawns, no crits: see helpers.setup). */
function fight(skills: string[], o: { enemies?: string[]; tune?: (t: Tuning) => void; spawning?: boolean } = {}) {
  const { t, s } = setup({ tune: o.tune });
  const hero = newHero(t, emptyLoadout(), { id: 'rowan', level: 1, skills });
  const c = new Combat({ tuning: t, settings: s, hero, enemies: o.enemies ?? ['slime'], seed: 42, spawning: o.spawning ?? false });
  const start = c.drainEvents();
  c.advanceTo(0.7); // the cursor is mid-bar, moving right
  c.drainEvents();
  return { c, t, start };
}

/** Put a block under the cursor and tap it now: dead center is a Perfect, a little off is not. */
function tapNew(c: Combat, kind: BlockKind, perfect: boolean, owner?: number): Block {
  const b = c.spawnBlock(kind, c.cursorPosAt(c.time) + (perfect ? 0 : 0.03), owner);
  c.tap(c.time);
  return b;
}

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
/** The last hit's event. */
const lastHit = (events: CombatEvent[]) => evs(events, 'hit').at(-1)!;

/** A red that reaches the hero now (it starts at the left end). */
function letRedThrough(c: Combat, kind: BlockKind = 'red'): void {
  c.spawnBlock(kind, 0.05);
  c.advanceTo(c.time + 0.5);
}

describe('stat nodes', () => {
  const t = cloneTuning();
  const statOf = (s: SkillStat): keyof ReturnType<typeof heroStats> => (s === 'atkPct' ? 'atk' : s === 'hpPct' ? 'hp' : s);
  for (const node of SKILL_NODES.filter((n) => n.kind === 'stat')) {
    it(`${node.name} (${skillHero(node.id)}) adds its number to heroStats`, () => {
      const id = skillHero(node.id) as HeroId;
      const s0 = heroStats(t, newHero(t, emptyLoadout(), { id, level: 1, skills: [] }));
      const s1 = heroStats(t, newHero(t, emptyLoadout(), { id, level: 1, skills: [node.id] }));
      const n = skillN(t, node.id);
      const k = statOf(node.stat!);
      const want: Record<SkillStat, number> = {
        atkPct: s0.atk * (1 + n / 100),
        hpPct: Math.round(s0.hp * (1 + n / 100)),
        critChance: s0.critChance + n / 100,
        def: s0.def + n,
        meterGain: s0.meterGain + n / 100,
        comboPower: s0.comboPower + n,
      };
      expect(s1[k]).toBeCloseTo(want[node.stat!], 6);
      // nothing else moves
      for (const other of Object.keys(s0) as (keyof typeof s0)[]) if (other !== k) expect(s1[other], other).toBe(s0[other]);
    });
  }

  it('the live number (tuning.skills.n) is what counts', () => {
    const t2 = cloneTuning();
    t2.skills.n.keenEdge = 50;
    expect(heroStats(t2, newHero(t2, emptyLoadout(), { id: 'rowan', level: 1, skills: ['keenEdge'] })).atk).toBeCloseTo(t2.hero.atk * 1.5);
  });
});

describe('Blade', () => {
  it("Follow-Through: a kill's leftover damage hits the next foe", () => {
    for (const on of [true, false]) {
      const { c } = fight(on ? ['followThrough'] : [], { enemies: ['slime', 'slime'] });
      const [a, b] = c.enemies;
      a.hp = 4;
      tapNew(c, 'yellow', false); // 10 damage: 6 past the kill
      const ev = c.drainEvents();
      expect(a.alive).toBe(false);
      expect(b.hp).toBe(on ? 80 - 6 : 80);
      expect(perks(ev, 'followThrough')).toEqual(on ? [expect.objectContaining({ amount: 6, enemyId: b.id })] : []);
    }
  });

  it("Follow-Through: carries once (a carry that kills doesn't carry on), and never from the finisher", () => {
    const { c } = fight(['followThrough'], { enemies: ['slime', 'slime', 'slime'] });
    const [a, b, x] = c.enemies;
    a.hp = 5;
    b.hp = 2;
    tapNew(c, 'yellow', false); // 5 past a's kill kills b, 3 past that are lost
    expect(b.alive).toBe(false);
    expect(x.hp).toBe(80);
    // the finisher hits every foe already: its overkill is lost
    const { c: f } = fight(['followThrough'], { enemies: ['slime', 'slime'] });
    f.enemies[0].hp = 1;
    f.stacks = 1;
    const dmg = f.finisherDamage();
    f.finisher();
    expect(f.enemies[1].hp).toBe(80 - dmg);
    expect(perks(f.drainEvents(), 'followThrough')).toEqual([]);
  });

  it('Whetstone: the hit that makes the combo a multiple of n always crits', () => {
    const { c, t } = fight(['whetstone']);
    const n = skillN(t, 'whetstone');
    c.combo = n - 1;
    tapNew(c, 'yellow', false);
    let ev = c.drainEvents();
    expect(lastHit(ev)).toMatchObject({ crit: true, damage: t.hero.atk * t.hero.critDmg, combo: n });
    expect(perks(ev, 'whetstone')).toHaveLength(1);
    tapNew(c, 'yellow', false);
    ev = c.drainEvents();
    expect(lastHit(ev)).toMatchObject({ crit: false, damage: t.hero.atk });
    // a block that lands on the multiple doesn't save the crit for the next hit
    c.combo = 2 * n - 1;
    tapNew(c, 'red', true);
    tapNew(c, 'yellow', false);
    expect(lastHit(c.drainEvents()).crit).toBe(false);
    // without it: no crit
    const { c: off } = fight([]);
    off.combo = n - 1;
    tapNew(off, 'yellow', false);
    expect(lastHit(off.drainEvents()).crit).toBe(false);
  });

  it('Whetstone: uses the live number, and a Perfect worth 2 combo (Double Time) that steps over the multiple still crits', () => {
    const { c } = fight(['whetstone'], { tune: (t) => (t.skills.n.whetstone = 3) });
    const crits = [1, 2, 3, 4, 5, 6].map(() => (tapNew(c, 'yellow', false), lastHit(c.drainEvents()).crit));
    expect(crits).toEqual([false, false, true, false, false, true]);
    const { c: dt } = fight(['whetstone', 'doubleTime'], { tune: (t) => (t.skills.n.whetstone = 8) });
    dt.combo = 7;
    tapNew(dt, 'yellow', true); // 7 -> 9
    expect(dt.combo).toBe(9);
    expect(lastHit(dt.drainEvents()).crit).toBe(true);
  });

  it('Executioner: foes under n% HP take double damage from yellows, not greens', () => {
    const { c, t } = fight(['executioner'], { enemies: ['bandit'], tune: (t) => (t.skills.n.executioner = 20) });
    const e = c.enemies[0];
    const line = (skillN(t, 'executioner') / 100) * e.maxHp; // 28 of 140
    e.hp = Math.ceil(line); // not under it yet
    tapNew(c, 'yellow', false);
    expect(lastHit(c.drainEvents()).damage).toBe(t.hero.atk);
    expect(line).toBe(28);
    e.hp = 27; // under it now
    tapNew(c, 'yellow', false);
    const ev = c.drainEvents();
    expect(lastHit(ev).damage).toBe(2 * t.hero.atk);
    expect(perks(ev, 'executioner')).toEqual([expect.objectContaining({ amount: 2 * t.hero.atk, enemyId: e.id })]);
    expect(e.hp).toBe(27 - 2 * t.hero.atk);
    // greens hit as usual
    e.hp = 27;
    tapNew(c, 'green', false);
    expect(lastHit(c.drainEvents()).damage).toBe(t.hero.atk * t.hero.greenMult);
    // without it
    const { c: off } = fight([], { enemies: ['bandit'] });
    off.enemies[0].hp = 27;
    tapNew(off, 'yellow', false);
    expect(lastHit(off.drainEvents()).damage).toBe(t.hero.atk);
  });
});

describe('Bulwark', () => {
  const slowReds = (t: Tuning) => (t.blocks.redTravelSec = 10000);

  it('Parry: a Perfect block knocks every other red on the bar back', () => {
    for (const [skills, perfect, pushed] of [
      [['parry'], true, true],
      [['parry'], false, false],
      [[], true, false],
    ] as const) {
      const { c } = fight([...skills], { tune: slowReds });
      const far = c.spawnBlock('red', 0.9);
      const near = c.spawnBlock('shield', 0.75);
      tapNew(c, 'red', perfect);
      const ev = c.drainEvents();
      expect(far.push > 0, `far ${skills} ${perfect}`).toBe(pushed);
      expect(near.push > 0, `near ${skills} ${perfect}`).toBe(pushed);
      expect(perks(ev, 'parry')).toHaveLength(pushed ? 1 : 0);
      if (pushed) {
        c.advanceTo(c.time + 0.5);
        expect(near.pos).toBeGreaterThan(0.75 + 0.05);
        expect(near.pos + near.width / 2).toBeLessThan(far.pos - far.width / 2); // they don't overlap
      }
    }
  });

  it('Shield Bash: breaking a shield red (its last tap) stuns its owner: its spawns and timed specials wait n s', () => {
    const { c, t } = fight(['shieldBash'], { enemies: ['boarKing'] });
    const e = c.enemies[0];
    const n = skillN(t, 'shieldBash');
    const spawn = e.spawnTimer;
    const timers = e.timers.slice();
    const timed = c.specialsOf(e).map((sp) => sp.every !== undefined);
    expect(timed.some((x) => x) && timed.some((x) => !x)).toBe(true);
    const shield = tapNew(c, 'shield', true); // a crack: no stun yet
    expect(e.spawnTimer).toBe(spawn);
    c.tap(c.time); // it breaks
    expect(c.blocks).not.toContain(shield);
    const ev = c.drainEvents();
    expect(e.spawnTimer).toBeCloseTo(spawn + n);
    e.timers.forEach((v, i) => expect(v).toBeCloseTo(timed[i] ? timers[i] + n : timers[i]));
    expect(perks(ev, 'shieldBash')).toEqual([expect.objectContaining({ amount: n, enemyId: e.id })]);
    // a plain red doesn't stun
    tapNew(c, 'red', true);
    expect(e.spawnTimer).toBeCloseTo(spawn + n);
  });

  it('Shield Bash: the stunned foe really stops spawning for n s', () => {
    const seqAfter = (skills: string[]) => {
      const { c, t } = fight(skills, { spawning: true, tune: (t) => (t.skills.n.shieldBash = 2) });
      const e = c.enemies[0];
      tapNew(c, 'shield', true);
      c.tap(c.time);
      const seq = e.seq;
      c.advanceTo(c.time + skillN(t, 'shieldBash') - 0.1);
      return e.seq - seq;
    };
    expect(seqAfter(['shieldBash'])).toBe(0);
    expect(seqAfter([])).toBeGreaterThan(1);
  });

  it('Shield Wall: every n reds blocked charge a bubble that eats the next red to get through', () => {
    const { c, t } = fight(['shieldWall']);
    c.perk.resolve = 1; // Knight's Resolve already spent (this is about a hit breaking the combo)
    const n = skillN(t, 'shieldWall');
    expect(c.perk).toMatchObject({ shieldWall: 0, shieldWallCharge: 0 });
    for (let i = 1; i < n; i++) tapNew(c, i % 2 ? 'red' : 'speed', i % 3 === 0);
    expect(c.perk).toMatchObject({ shieldWall: 0, shieldWallCharge: n - 1 });
    tapNew(c, 'red', false);
    let ev = c.drainEvents();
    expect(c.perk).toMatchObject({ shieldWall: 1, shieldWallCharge: 0 });
    expect(perks(ev, 'shieldWall')).toEqual([expect.objectContaining({ amount: 1 })]);
    // one bubble at a time: blocks while it's up don't count toward the next
    tapNew(c, 'red', true);
    expect(c.perk).toMatchObject({ shieldWall: 1, shieldWallCharge: 0 });
    // it eats a red: no damage, no combo break
    c.combo = 10;
    letRedThrough(c);
    ev = c.drainEvents();
    expect(c.hero.hp).toBe(100);
    expect(c.combo).toBe(10);
    expect(evs(ev, 'heroHurt')).toEqual([]);
    expect(perks(ev, 'shieldWall')).toEqual([expect.objectContaining({ amount: 0, enemyId: c.enemies[0].id })]);
    expect(c.perk.shieldWall).toBe(0);
    // ...once
    letRedThrough(c);
    expect(c.hero.hp).toBe(100 - t.enemies.slime.atk);
    expect(c.combo).toBe(0);
    // and once a fight: blocks don't charge another bubble
    for (let i = 0; i < n + 1; i++) tapNew(c, 'red', false);
    expect(c.perk).toMatchObject({ shieldWall: 0, shieldWallCharge: 0, shieldWallUsed: 1 });
  });

  it("Shield Wall: a shield counts once (when it breaks), and a bomb that gets through is eaten too", () => {
    const { c, t } = fight(['shieldWall'], { tune: (t) => (t.skills.n.shieldWall = 2) });
    c.perk.resolve = 1; // Knight's Resolve already spent (this is about a hit breaking the combo)
    const s = tapNew(c, 'shield', true);
    expect(c.blocks).toContain(s);
    expect(c.perk.shieldWallCharge).toBe(0);
    c.tap(c.time);
    expect(c.perk.shieldWallCharge).toBe(1);
    tapNew(c, 'bomb', false);
    expect(c.perk.shieldWall).toBe(1);
    letRedThrough(c, 'bomb');
    expect(c.hero.hp).toBe(100);
    expect(c.perk.shieldWall).toBe(0);
    // without it, a red hurts and breaks the combo
    const { c: off } = fight([]);
    off.perk.resolve = 1; // Knight's Resolve already spent (this is about a hit breaking the combo)
    off.combo = 10;
    letRedThrough(off);
    expect(off.hero.hp).toBe(100 - t.enemies.slime.atk);
    expect(off.combo).toBe(0);
  });
});

describe('Momentum', () => {
  it('Double Time: a Perfect hit counts as 2 combo (not a plain hit, not a block)', () => {
    const { c } = fight(['doubleTime']);
    tapNew(c, 'yellow', true);
    expect(c.combo).toBe(2);
    expect(perks(c.drainEvents(), 'doubleTime')).toEqual([expect.objectContaining({ amount: 2 })]);
    tapNew(c, 'yellow', false);
    expect(c.combo).toBe(3);
    tapNew(c, 'red', true);
    expect(c.combo).toBe(4);
    tapNew(c, 'green', true);
    expect(c.combo).toBe(6);
    const { c: off } = fight([]);
    tapNew(off, 'yellow', true);
    expect(off.combo).toBe(1);
  });

  it('Charged Up: every fight starts with n finisher stacks banked', () => {
    const on = fight(['chargedUp']);
    expect(on.c.stacks).toBe(skillN(on.t, 'chargedUp'));
    expect(on.c.finisherReady).toBe(true);
    expect(perks(on.start, 'chargedUp')).toEqual([expect.objectContaining({ amount: 1 })]);
    expect(fight(['chargedUp'], { tune: (t) => (t.skills.n.chargedUp = 2) }).c.stacks).toBe(2);
    expect(fight([]).c.stacks).toBe(0);
  });

  it('Unbroken: a combo break halves the combo and the stacks instead of zeroing them', () => {
    for (const on of [true, false]) {
      const { c } = fight(on ? ['unbroken'] : []);
      c.perk.resolve = 1; // Knight's Resolve already spent (this is about a hit breaking the combo)
      c.combo = 9;
      c.stacks = 3;
      c.tap(c.time); // nothing there: a miss breaks the combo
      expect(c.combo).toBe(on ? 4 : 0);
      expect(c.stacks).toBe(on ? 1 : 0);
      expect(perks(c.drainEvents(), 'unbroken')).toHaveLength(on ? 1 : 0);
      // a red that gets through, too
      c.combo = 6;
      letRedThrough(c);
      expect(c.combo).toBe(on ? 3 : 0);
    }
  });
});

describe('learning skills', () => {
  const t = cloneTuning();
  const at = (level: number, skills: string[] = []) => ({ ...newHeroProgress(true), xp: xpForLevel(t, level), skills });

  it('a skill point every 2 levels: 15 at level 30, a whole tree', () => {
    for (let level = 1; level <= 30; level++) expect(skillPoints(t, level), `level ${level}`).toBe(Math.floor(level / 2));
    expect(skillPoints(t, 30)).toBe(15);
    for (const hero of (['rowan', 'sable', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva'] as HeroId[]).filter((h) => treeOf(h).length)) {
      const nodes = treeOf(hero).flatMap((b) => b.nodes);
      expect(nodes).toHaveLength(15);
      const p = at(30);
      for (const n of nodes) expect(learn(t, hero, p, n.id), n.id).toBe(true);
      expect(pointsLeft(t, p)).toBe(0);
    }
  });

  it('nodes are learned top to bottom within a branch, a point each; canLearn says why not', () => {
    const p = at(4); // 2 points
    expect(pointsLeft(t, p)).toBe(2);
    expect(canLearn(t, 'rowan', p, 'steadyAim')).toBe('order');
    expect(learn(t, 'rowan', p, 'steadyAim')).toBe(false);
    expect(canLearn(t, 'rowan', p, 'nope')).toBe('none');
    expect(canLearn(t, 'rowan', p, 'quickHands')).toBe('none'); // Sable's
    expect(learn(t, 'rowan', p, 'keenEdge')).toBe(true);
    expect(canLearn(t, 'rowan', p, 'keenEdge')).toBe('learned');
    expect(learn(t, 'rowan', p, 'stout')).toBe(true); // another branch's first node
    expect(canLearn(t, 'rowan', p, 'steadyAim')).toBe('points');
    expect(p.skills).toEqual(['keenEdge', 'stout']);
    expect(pointsLeft(t, p)).toBe(0);
    expect(canLearn(t, 'rowan', at(1), 'keenEdge')).toBe('points');
  });

  it('the free reset gives every point back', () => {
    const p = at(10);
    for (const id of ['keenEdge', 'steadyAim', 'followThrough', 'rhythm', 'powerStance']) expect(learn(t, 'rowan', p, id)).toBe(true);
    expect(pointsLeft(t, p)).toBe(0);
    expect(resetSkills(p)).toBe(5);
    expect(p.skills).toEqual([]);
    expect(pointsLeft(t, p)).toBe(5);
    expect(learn(t, 'rowan', p, 'stout')).toBe(true);
  });
});
