// The seven heroes' skill trees (src/data/skills-heroes.ts, core/skill-fx-heroes.ts): every tree's shape, ids and
// numbers, that the words fit like Rowan's, a with/without test for every rule node and capstone, and that every
// hero's whole tree plays a fight on a bar with ice patches and holds.
import { describe, expect, it } from 'vitest';
import { HERO_IDS, type HeroId } from '../../src/data/heroes';
import { RELICS } from '../../src/data/relics';
import { SKILL_NODES, SKILL_TREES, skillHero } from '../../src/data/skills';
import { Combat, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { learn, newHeroProgress, pointsLeft, skillN, skillText, treeOf, xpForLevel } from '../../src/core/heroes';
import { SKILL_HOOKS } from '../../src/core/skill-fx';
import { callAlly, focusCap, focusOf, guardMax, guardOf } from '../../src/core/styles';
import { cloneTuning, DEFAULT_TUNING, type Tuning } from '../../src/core/tuning';
import type { BarRules } from '../../src/data/types';
import { textWidth } from '../../src/engine/font';
import { setup } from './helpers';

// ---------------------------------------------------------------- helpers

/** A fight as `hero` knowing `skills`, the cursor mid-bar moving right (no spawns, no crits; reds crawl unless the
 *  test speeds them up: t.blocks.redTravelSec). */
function fight(hero: HeroId, skills: string[], o: { enemies?: string[]; waves?: string[][]; tune?: (t: Tuning) => void; stars?: number } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills, stars: o.stars ?? 1 });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], waves: o.waves, seed: 42, spawning: false });
  const start = c.drainEvents();
  c.advanceTo(0.7);
  const early = [...start, ...c.drainEvents()];
  return { c, t, early };
}

/** Both versions of a fight: with the node(s) and without. */
const both = (hero: HeroId, skills: string[], o: Parameters<typeof fight>[2] = {}) => ({ on: fight(hero, skills, o), off: fight(hero, [], o) });

/** Put a block under the cursor and tap it now: dead centre is a Perfect, a little off is not. */
function tapNew(c: Combat, kind: BlockKind, perfect: boolean, owner?: number): Block {
  const b = c.spawnBlock(kind, c.cursorPosAt(c.time) + (perfect ? 0 : 0.03), owner);
  c.tap(c.time);
  return b;
}

/** Step the fight to time t (advanceTo stops after 5 s a call). */
function go(c: Combat, t: number): void {
  for (let k = 0; k < 100 && c.time < t - 1e-9; k++) c.advanceTo(Math.min(t, c.time + 4));
}

/** Tap block b as the cursor next crosses its centre (it's ahead of the cursor), `offMs` late. */
function tapWhenThere(c: Combat, b: Block, offMs = 0) {
  const at = c.time + c.travelTime(c.cursorPos(), b.pos, c.cursorDirAt(c.time)) + offMs / 1000;
  go(c, at);
  return c.tap(at);
}

/** A red that reaches the hero now (it starts at the left end; reds must be moving). */
function letRedThrough(c: Combat, kind: BlockKind = 'red'): void {
  c.spawnBlock(kind, 0.05);
  go(c, c.time + 0.5);
}

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
const lastHit = (events: CombatEvent[]) => evs(events, 'hit').at(-1)!;
const kinds = (c: Combat, kind: BlockKind) => c.blocks.filter((b) => b.kind === kind);

const ALL_HEROES = HERO_IDS;
const OTHERS = HERO_IDS.filter((h) => h !== 'rowan');

// ---------------------------------------------------------------- the trees as data

describe('every hero has a tree', () => {
  it('3 branches x 5 nodes each: stat, stat, rule, rule, capstone', () => {
    for (const hero of ALL_HEROES) {
      const tree = SKILL_TREES[hero];
      expect(tree, hero).toHaveLength(3);
      for (const b of tree) {
        expect(b.nodes.map((n) => n.kind), `${hero} ${b.name}`).toEqual(['stat', 'stat', 'rule', 'rule', 'capstone']);
        for (const n of b.nodes.slice(0, 2)) expect(n.stat && n.n !== undefined, n.id).toBeTruthy();
        for (const n of b.nodes.slice(2)) expect(!!n.before && !!n.after && !n.stat, n.id).toBe(true);
      }
      expect(new Set(tree.map((b) => b.name)).size).toBe(3);
    }
  });

  it('node ids are unique across every tree, and never a relic or a kit part', () => {
    const ids = SKILL_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(HERO_IDS.length * 15);
    const taken = new Set<string>([...RELICS.map((r) => r.id), 'chain', 'guard', 'focus', 'rally', 'seedling', 'barkback', 'glowmoth', 'thornling', 'fuseUp', 'bigBang', 'smokeVeil', 'afterimage', 'twinFang', 'fangAndClaw', 'windUp', 'quake', 'secondSwing', 'volley', 'bend', 'resolve', 'wideSweep', 'powerShot', 'pierce', 'shieldSlam', 'shadowStep', 'battleFocus', 'whirlwind', 'ambidextrous']);
    for (const id of ids) expect(taken.has(id), id).toBe(false);
    for (const hero of ALL_HEROES) for (const b of SKILL_TREES[hero]) for (const n of b.nodes) expect(skillHero(n.id)).toBe(hero);
  });

  it("every '{n}' has a number (in tuning.skills.n), every number shows, and the texts fill in", () => {
    const t = cloneTuning();
    for (const n of SKILL_NODES) {
      const words = [n.text, n.before ?? '', n.after ?? ''];
      const wants = words.some((w) => w.includes('{n}'));
      expect(n.n !== undefined, n.id).toBe(wants);
      if (n.n !== undefined) {
        expect(DEFAULT_TUNING.skills.n[n.id], n.id).toBe(n.n);
        expect(n.text, n.id).toContain('{n}');
      }
      for (const w of words) expect(skillText(t, n, w), n.id).not.toContain('{n}');
    }
  });

  it('every rule node and capstone is a fight hook; stat nodes are not', () => {
    for (const n of SKILL_NODES) expect(!!SKILL_HOOKS[n.id], n.id).toBe(n.kind !== 'stat');
    for (const id of Object.keys(SKILL_HOOKS)) expect(SKILL_NODES.some((n) => n.id === id), id).toBe(true);
  });

  it("the words fit like Rowan's (names, texts, before/after, branch names and themes)", () => {
    const t = cloneTuning();
    const w = (s: string, bold = false) => textWidth(s, 1, bold);
    const rowan = SKILL_TREES.rowan;
    const rn = rowan.flatMap((b) => b.nodes);
    const max = {
      name: Math.max(...rn.map((n) => w(n.name, true))),
      text: Math.max(...rn.map((n) => w(skillText(t, n)))),
      before: Math.max(...rn.map((n) => w(skillText(t, n, n.before ?? '')))),
      after: Math.max(...rn.map((n) => w(skillText(t, n, n.after ?? '')))),
      branch: Math.max(...rowan.map((b) => w(b.name, true))),
      theme: Math.max(...rowan.map((b) => w(b.theme))),
    };
    for (const hero of OTHERS)
      for (const b of SKILL_TREES[hero]) {
        expect(w(b.name, true), b.name).toBeLessThanOrEqual(max.branch);
        expect(w(b.theme), b.theme).toBeLessThanOrEqual(max.theme);
        for (const n of b.nodes) {
          expect(w(n.name, true), n.name).toBeLessThanOrEqual(max.name);
          expect(w(skillText(t, n)), n.text).toBeLessThanOrEqual(max.text);
          if (n.before) expect(w(skillText(t, n, n.before)), n.before).toBeLessThanOrEqual(max.before);
          if (n.after) expect(w(skillText(t, n, n.after)), n.after).toBeLessThanOrEqual(max.after);
        }
      }
  });

  it('a level-30 hero learns the whole tree, branch by branch, with every point', () => {
    const t = cloneTuning();
    for (const hero of ALL_HEROES) {
      const p = { ...newHeroProgress(true), xp: xpForLevel(t, 30) };
      for (const n of treeOf(hero).flatMap((b) => b.nodes)) expect(learn(t, hero, p, n.id), `${hero} ${n.id}`).toBe(true);
      expect(p.skills).toHaveLength(15);
      expect(pointsLeft(t, p)).toBe(0);
    }
  });
});

// ---------------------------------------------------------------- Sable

describe('Sable', () => {
  it('Sure Chain: a hit that is not Perfect no longer ends the chain (it adds no link); a miss still does', () => {
    for (const on of [true, false]) {
      const { c } = fight('sable', on ? ['sureChain'] : []);
      c.perk.chain = 4;
      tapNew(c, 'yellow', false);
      const ev = c.drainEvents();
      expect(c.perk.chain).toBe(on ? 4 : 0);
      expect(perks(ev, 'sureChain')).toHaveLength(on ? 1 : 0);
      c.perk.chain = 4;
      c.tap(c.time); // nothing there
      expect(c.perk.chain).toBe(0);
    }
  });

  it('Deep Cuts: at n+ links, Perfect hits always crit (not plain hits, not shorter chains)', () => {
    const { on, off } = both('sable', ['deepCuts']);
    const n = skillN(on.t, 'deepCuts');
    for (const [{ c }, want] of [
      [on, true],
      [off, false],
    ] as const) {
      c.perk.chain = n;
      tapNew(c, 'yellow', true);
      const ev = c.drainEvents();
      expect(lastHit(ev).crit).toBe(want);
      expect(perks(ev, 'deepCuts')).toHaveLength(want ? 1 : 0);
    }
    on.c.perk.chain = n - 1;
    tapNew(on.c, 'yellow', true);
    expect(lastHit(on.c.drainEvents()).crit).toBe(false);
    on.c.perk.chain = n;
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).crit).toBe(false);
  });

  it('Death Mark: Twin Fang deals n% more per chain link', () => {
    const { on, off } = both('sable', ['deathMark']);
    const dmg = (c: Combat) => {
      c.perk.chain = 3;
      c.stacks = 2;
      c.finisher();
      return evs(c.drainEvents(), 'finisher')[0].damage;
    };
    const base = dmg(off.c);
    expect(dmg(on.c)).toBe(Math.round(base * (1 + (3 * skillN(on.t, 'deathMark')) / 100)));
    // no chain: no bonus
    const z = fight('sable', ['deathMark']);
    z.c.stacks = 2;
    z.c.finisher();
    expect(evs(z.c.drainEvents(), 'finisher')[0].damage).toBe(base);
  });

  it('Lunge: after a Perfect hit (a dash or not), the next hit deals n% more; a miss in between wastes it', () => {
    const second = (skills: string[], o: { miss?: boolean; dash?: boolean; block?: boolean } = {}) => {
      const { c, t } = fight('sable', skills);
      const ahead = c.spawnBlock('yellow', 0.85);
      if (o.block) tapNew(c, 'red', true);
      else tapNew(c, 'yellow', true); // a Perfect: Shadow Dash to just before the yellow ahead
      if (!o.block) expect(c.drainEvents().some((e) => e.type === 'dash')).toBe(true);
      if (o.miss) c.tap(c.time);
      if (o.dash === false) tapNew(c, 'yellow', false);
      else tapWhenThere(c, ahead, 25); // not Perfect
      const ev = c.drainEvents();
      return { dmg: lastHit(ev).damage, fx: perks(ev, 'lunge').length, t, c };
    };
    const off = second([]);
    const on = second(['lunge']);
    const chained = on.c.stats().atk * (1 + on.t.styles.chainStep); // the Perfect made a 1-link chain
    expect(off.dmg).toBe(Math.round(chained));
    expect(on.dmg).toBe(Math.round(chained * (1 + skillN(on.t, 'lunge') / 100)));
    expect(on.fx).toBe(1);
    expect(second(['lunge'], { miss: true }).dmg).toBe(second([], { miss: true }).dmg);
    expect(second(['lunge'], { block: true }).dmg).toBe(second([], { block: true }).dmg); // a Perfect block doesn't lunge
  });

  it('Night Step: a Perfect block dashes too (not a plain block)', () => {
    for (const [skills, perfect, dash] of [
      [['nightStep'], true, true],
      [['nightStep'], false, false],
      [[], true, false],
    ] as const) {
      const { c } = fight('sable', [...skills]);
      c.spawnBlock('yellow', 0.85);
      tapNew(c, 'red', perfect);
      const ev = c.drainEvents();
      expect(ev.some((e) => e.type === 'dash'), `${skills} ${perfect}`).toBe(dash);
      expect(perks(ev, 'nightStep')).toHaveLength(dash ? 1 : 0);
    }
  });

  it('Phantom Rush: a Perfect hit cuts down the red closest to her (wherever it is), once every n s', () => {
    const run = (skills: string[]) => {
      const { c, t } = fight('sable', skills, { enemies: ['bandit'] });
      c.addZone('ice', 0.8, 0.12, 0);
      const near = c.spawnBlock('red', 0.25); // behind the cursor, closest to her
      const far = c.spawnBlock('shield', 0.8);
      c.spawnBlock('yellow', 0.94);
      const combo = c.combo;
      tapNew(c, 'yellow', true);
      return { c, t, near, far, combo, ev: c.drainEvents() };
    };
    const on = run(['phantomRush']);
    expect(on.c.blocks).not.toContain(on.near);
    expect(on.c.blocks).toContain(on.far);
    expect(on.c.combo).toBe(on.combo + 2); // the hit and the red it cut down
    expect(perks(on.ev, 'phantomRush')).toHaveLength(1);
    // Shadow Dash still burst toward its lead-in before the shield ahead
    expect(evs(on.ev, 'dash')).toHaveLength(1);
    // ...once every n s: the next Perfect doesn't cut; once it's ready, it does (a shield takes all its taps)
    tapNew(on.c, 'yellow', true);
    expect(on.c.blocks).toContain(on.far);
    expect(on.c.perk.phantomAt).toBeCloseTo(on.c.time + skillN(on.t, 'phantomRush'));
    on.c.perk.phantomAt = on.c.time;
    tapNew(on.c, 'yellow', true);
    expect(on.c.blocks).not.toContain(on.far);
    // without it, the red stays
    const off = run([]);
    expect(off.c.blocks).toContain(off.near);
    // a plain hit doesn't
    const plain = fight('sable', ['phantomRush']);
    const r2 = plain.c.spawnBlock('red', 0.6);
    tapNew(plain.c, 'yellow', false);
    expect(plain.c.blocks).toContain(r2);
  });

  it('Thick Smoke: Smoke Veil lasts n s longer', () => {
    const { on, off } = both('sable', ['thickSmoke']);
    tapNew(on.c, 'green', false);
    tapNew(off.c, 'green', false);
    expect(on.c.hero.abilityTimer).toBeCloseTo(off.c.hero.abilityTimer + skillN(on.t, 'thickSmoke'));
    expect(perks(on.c.drainEvents(), 'thickSmoke')).toHaveLength(1);
  });

  it('Vanish: in the smoke, the first red to reach her misses (one per smoke); without it, it hurts', () => {
    const { on, off } = both('sable', ['vanish'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    letRedThrough(on.c);
    letRedThrough(off.c);
    expect(on.c.hero.hp).toBe(on.c.maxHp());
    expect(off.c.hero.hp).toBeLessThan(off.c.maxHp());
    expect(perks(on.c.drainEvents(), 'vanish')).toHaveLength(1);
    letRedThrough(on.c); // the second one hits
    expect(on.c.hero.hp).toBeLessThan(on.c.maxHp());
    // a new smoke, a new dodge
    go(on.c, on.c.time + 4);
    const hp = on.c.hero.hp;
    tapNew(on.c, 'green', false);
    letRedThrough(on.c);
    expect(on.c.hero.hp).toBe(hp);
    // no smoke: no dodge
    const plain = fight('sable', ['vanish'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    letRedThrough(plain.c);
    expect(plain.c.hero.hp).toBeLessThan(plain.c.maxHp());
  });

  it('Night Cloak: in the smoke, hits crit n% more often', () => {
    const { on, off } = both('sable', ['nightCloak'], { tune: (t) => (t.skills.n.nightCloak = 100) });
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).crit).toBe(false); // no smoke yet
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    tapNew(on.c, 'yellow', false);
    tapNew(off.c, 'yellow', false);
    const ev = on.c.drainEvents();
    expect(lastHit(ev).crit).toBe(true);
    expect(perks(ev, 'nightCloak')).toHaveLength(1);
    expect(lastHit(off.c.drainEvents()).crit).toBe(false);
  });
});

// ---------------------------------------------------------------- Neve

describe('Neve', () => {
  const noChance = (t: Tuning) => (t.kits.neve.freeze = 0); // Flash Freeze only on Perfect blocks

  it('Brittle: frozen blocks shatter for n% more', () => {
    const { on, off } = both('neve', ['brittle']);
    const hit = (c: Combat) => (tapNew(c, 'frozen', false), lastHit(c.drainEvents()).damage);
    const base = hit(off.c);
    expect(base).toBe(Math.round(off.c.stats().atk * off.t.blocks.frozenMult));
    expect(hit(on.c)).toBe(Math.round(on.c.stats().atk * on.t.blocks.frozenMult * (1 + skillN(on.t, 'brittle') / 100)));
    // a yellow is unchanged
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(on.c.stats().atk));
  });

  it('Shatterburst: a shatter also hits every other foe for n% of its damage (a yellow does not)', () => {
    const { on, off } = both('neve', ['shatterburst'], { enemies: ['slime', 'slime', 'slime'] });
    tapNew(on.c, 'yellow', false);
    expect(on.c.enemies[1].hp).toBe(80);
    for (const { c } of [on, off]) tapNew(c, 'frozen', false);
    const shatter = Math.round(on.c.stats().atk * on.t.blocks.frozenMult);
    const burst = Math.round((shatter * skillN(on.t, 'shatterburst')) / 100);
    expect(on.c.enemies.slice(1).map((e) => e.hp)).toEqual([80 - burst, 80 - burst]);
    expect(off.c.enemies.slice(1).map((e) => e.hp)).toEqual([80, 80]);
    expect(perks(on.c.drainEvents(), 'shatterburst')).toHaveLength(2);
  });

  it('Ice Age: every block freezes its red (once: a Perfect block that Flash Freeze took is not frozen twice)', () => {
    const { on, off } = both('neve', ['iceAge'], { tune: noChance });
    tapNew(on.c, 'red', false);
    tapNew(off.c, 'red', false);
    expect(kinds(on.c, 'frozen')).toHaveLength(1);
    expect(kinds(off.c, 'frozen')).toHaveLength(0);
    expect(perks(on.c.drainEvents(), 'iceAge')).toHaveLength(1);
    tapNew(on.c, 'red', true);
    expect(kinds(on.c, 'frozen')).toHaveLength(2);
    expect(perks(on.c.drainEvents(), 'iceAge')).toHaveLength(0);
  });

  it('Long Bend: Bend slows the reds n s longer', () => {
    const { on, off } = both('neve', ['longBend'], { tune: noChance });
    const other = (c: Combat) => {
      const r = c.spawnBlock('red', 0.9);
      tapNew(c, 'red', true);
      return r;
    };
    const a = other(on.c);
    const b = other(off.c);
    expect(b.chill).toBeCloseTo(off.t.styles.bendSec);
    expect(a.chill).toBeCloseTo(on.t.styles.bendSec + skillN(on.t, 'longBend'));
    expect(a.chillMult).toBeCloseTo(on.t.styles.bendMult);
  });

  it('Frost Aura: while Chill is on, reds move n% slower; then they speed back up', () => {
    const { on, off } = both('neve', ['frostAura']);
    const ra = on.c.spawnBlock('red', 0.9);
    const rb = off.c.spawnBlock('red', 0.9);
    for (const { c } of [on, off]) {
      tapNew(c, 'green', false);
      go(c, c.time + 0.1);
    }
    expect(ra.chill).toBeGreaterThan(0);
    expect(ra.chillMult).toBeCloseTo(1 - skillN(on.t, 'frostAura') / 100);
    expect(rb.chill).toBe(0);
    expect(perks(on.c.drainEvents(), 'frostAura')).toHaveLength(1);
    go(on.c, on.c.time + on.c.abilitySec() + 0.1);
    expect(ra.chill).toBe(0);
  });

  it('Cold Shoulder: a slowed red bounces off the wall instead of hitting, once every n s', () => {
    const run = (skills: string[]) => {
      const { c } = fight('neve', skills, { tune: (t) => (t.blocks.redTravelSec = 1) });
      const r = c.spawnBlock('red', 0.06);
      c.chillRed(r, 5, 0.5);
      go(c, c.time + 0.3);
      return { c, r, ev: c.drainEvents() };
    };
    const on = run(['coldShoulder']);
    expect(on.c.hero.hp).toBe(on.c.maxHp());
    expect(on.c.blocks).toContain(on.r);
    expect(evs(on.ev, 'deflect')).toHaveLength(1);
    expect(perks(on.ev, 'coldShoulder')).toHaveLength(1);
    // ...once every n s: the next slowed red hits
    const r2 = on.c.spawnBlock('red', 0.06);
    on.c.chillRed(r2, 5, 0.5);
    go(on.c, on.c.time + 0.3);
    expect(on.c.hero.hp).toBeLessThan(on.c.maxHp());
    const off = run([]);
    expect(off.c.hero.hp).toBeLessThan(off.c.maxHp());
    // a red that isn't slowed hits
    const plain = fight('neve', ['coldShoulder'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    letRedThrough(plain.c);
    expect(plain.c.hero.hp).toBeLessThan(plain.c.maxHp());
  });

  it('Skater: hits on a block inside a patch (ice or slow) deal n% more', () => {
    for (const kind of ['ice', 'slow'] as const) {
      const { on, off } = both('neve', ['skater']);
      for (const { c } of [on, off]) c.addZone(kind, c.cursorPos(), 0.2, 0);
      tapNew(on.c, 'yellow', false);
      tapNew(off.c, 'yellow', false);
      const base = lastHit(off.c.drainEvents()).damage;
      const ev = on.c.drainEvents();
      expect(lastHit(ev).damage, kind).toBe(Math.round(on.c.stats().atk * (1 + skillN(on.t, 'skater') / 100)));
      expect(base).toBe(Math.round(off.c.stats().atk));
      expect(perks(ev, 'skater')).toHaveLength(1);
    }
    // off the patch: as usual
    const { c } = fight('neve', ['skater']);
    c.addZone('ice', 0.1, 0.1, 0);
    tapNew(c, 'yellow', false);
    expect(lastHit(c.drainEvents()).damage).toBe(Math.round(c.stats().atk));
  });

  it('Frost Trail: a shatter leaves an ice patch there for n s', () => {
    const { on, off } = both('neve', ['frostTrail']);
    const f = tapNew(on.c, 'frozen', false);
    tapNew(off.c, 'frozen', false);
    expect(off.c.zones).toHaveLength(0);
    expect(on.c.zones).toHaveLength(1);
    const z = on.c.zones[0];
    expect(z.kind).toBe('ice');
    expect((z.lo + z.hi) / 2).toBeCloseTo(f.pos);
    expect(z.life).toBeCloseTo(skillN(on.t, 'frostTrail'));
    go(on.c, on.c.time + skillN(on.t, 'frostTrail') + 0.1);
    expect(on.c.zones).toHaveLength(0);
  });

  it('Black Ice: every n s an ice patch forms ahead of the cursor (it bothers her half as much)', () => {
    const { on, off } = both('neve', ['blackIce']);
    const n = skillN(on.t, 'blackIce');
    go(on.c, n - 0.1);
    expect(on.c.zones).toHaveLength(0);
    const ahead = on.c.aheadPos();
    go(on.c, n + 0.05);
    go(off.c, n + 0.05);
    expect(off.c.zones).toHaveLength(0);
    expect(on.c.zones).toHaveLength(1);
    const z = on.c.zones[0];
    expect(z.kind).toBe('ice');
    expect(z.hi - z.lo).toBeCloseTo(on.t.kits.neve.slowWidth / 2);
    expect(Math.abs((z.lo + z.hi) / 2 - ahead)).toBeLessThan(0.1);
    expect(on.c.zoneMult(z)).toBeCloseTo(1 + (on.t.bar.iceMult - 1) * on.t.kits.neve.iceResist);
    expect(perks(on.c.drainEvents(), 'blackIce')).toHaveLength(1);
    go(on.c, 2 * n + 0.05);
    expect(perks(on.c.drainEvents(), 'blackIce')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- Moss

describe('Moss', () => {
  const acts = (events: CombatEvent[], kind: string) => evs(events, 'ally').filter((e) => e.kind === kind && e.action === 'act').length;

  it('Quick Thorns: Thornlings jab n% faster', () => {
    const { on, off } = both('moss', ['quickThorns'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 1000) });
    for (const { c } of [on, off]) {
      callAlly(c);
      go(c, c.time + 6);
    }
    const a = acts(on.c.drainEvents(), 'thornling');
    const b = acts(off.c.drainEvents(), 'thornling');
    expect(b).toBe(4); // 0.75 s, then every 1.5 s
    expect(a).toBe(6); // 50% faster: every 1 s
  });

  it('Thorn Rush: each Thornling jab fills the meter (n% of a hit)', () => {
    const { on, off } = both('moss', ['thornRush'], { enemies: ['bandit'] });
    for (const { c } of [on, off]) {
      callAlly(c);
      go(c, c.time + 1); // one jab
    }
    expect(off.c.meter).toBe(0);
    expect(on.c.meter).toBeCloseTo((on.t.meter.perHit * skillN(on.t, 'thornRush')) / 100);
    expect(perks(on.c.drainEvents(), 'thornRush')).toHaveLength(1);
  });

  it('Rooted: a Thornling never leaves (other allies still do)', () => {
    const { on, off } = both('moss', ['rooted'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    for (const { c } of [on, off]) {
      callAlly(c);
      callAlly(c);
      go(c, c.time + c.tuning.kits.moss.allySec + 5);
    }
    expect(on.c.allies.map((a) => a.kind)).toEqual(['thornling']);
    expect(off.c.allies).toHaveLength(0);
  });

  it('Quick Brace: Barkbacks brace n% faster', () => {
    const { on, off } = both('moss', ['quickBrace']);
    // a Barkback first braces after half its time; n% faster with Quick Brace
    const half = on.t.kits.moss.barkEvery / 2;
    const quick = half / (1 + skillN(on.t, 'quickBrace') / 100);
    for (const { c } of [on, off]) {
      callAlly(c);
      callAlly(c);
      go(c, c.time + (quick + half) / 2);
    }
    expect(on.c.allies.find((a) => a.kind === 'barkback')!.braced).toBe(true);
    expect(off.c.allies.find((a) => a.kind === 'barkback')!.braced).toBe(false);
  });

  it("Splinters: a Barkback's block hits every foe for n% attack", () => {
    const { on, off } = both('moss', ['splinters'], { enemies: ['slime', 'slime'], tune: (t) => (t.blocks.redTravelSec = 1) });
    for (const { c } of [on, off]) {
      callAlly(c);
      callAlly(c);
      c.allies.find((a) => a.kind === 'barkback')!.braced = true;
      c.allies.find((a) => a.kind === 'thornling')!.timer = 99; // no jabs
      letRedThrough(c);
      expect(c.hero.hp).toBe(c.maxHp()); // the Barkback stopped it
    }
    const dmg = Math.round(on.c.stats().atk * (skillN(on.t, 'splinters') / 100));
    expect(on.c.enemies.map((e) => e.hp)).toEqual([80 - dmg, 80 - dmg]);
    expect(off.c.enemies.map((e) => e.hp)).toEqual([80, 80]);
  });

  it('Root Call: every n reds blocked call the next ally (a Rally with all out)', () => {
    const { on, off } = both('moss', ['rootCall']);
    const n = skillN(on.t, 'rootCall');
    for (const { c } of [on, off]) for (let i = 0; i < n - 1; i++) tapNew(c, 'red', false);
    expect(on.c.allies).toHaveLength(0);
    tapNew(on.c, 'red', false);
    tapNew(off.c, 'red', false);
    expect(on.c.allies.map((a) => a.kind)).toEqual(['thornling']);
    expect(off.c.allies).toHaveLength(0);
    expect(perks(on.c.drainEvents(), 'rootCall')).toHaveLength(1);
    // a cracked shield doesn't count until it breaks
    tapNew(on.c, 'shield', false);
    expect(on.c.perk.rootCall).toBe(0);
  });

  it('Bright Moth: Glowmoths heal n% more', () => {
    const { on, off } = both('moss', ['brightMoth']);
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) callAlly(c);
      c.hero.hp = 40;
      go(c, c.time + 1.6); // the moth's first light: half of its 3 s
    }
    const heal = (c: Combat) => c.maxHp() * c.tuning.kits.moss.mothHeal;
    expect(off.c.hero.hp).toBe(40 + Math.round(heal(off.c)));
    expect(on.c.hero.hp).toBe(40 + Math.round(heal(on.c)) + Math.round((heal(on.c) * skillN(on.t, 'brightMoth')) / 100));
  });

  it("Moonglow: a Glowmoth's light slows every red for n s", () => {
    const { on, off } = both('moss', ['moonglow']);
    const ra = on.c.spawnBlock('red', 0.9);
    const rb = off.c.spawnBlock('red', 0.9);
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) callAlly(c);
      go(c, c.time + 1.55);
    }
    expect(ra.chill).toBeGreaterThan(0.9);
    expect(ra.chillMult).toBeCloseTo(on.t.kits.moss.vineMult);
    expect(rb.chill).toBe(0);
    expect(perks(on.c.drainEvents(), 'moonglow')).toHaveLength(1);
  });

  it('Pollen Burst: a Rally bursts on every foe for n% attack per ally (from a green, or from Root Call)', () => {
    const { on, off } = both('moss', ['pollenBurst'], { enemies: ['slime', 'slime'] });
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) callAlly(c);
      tapNew(c, 'green', false); // all three out: a Rally
    }
    const burst = Math.round((on.c.stats().atk * 3 * skillN(on.t, 'pollenBurst')) / 100);
    expect(off.c.enemies[1].hp).toBe(80);
    expect(on.c.enemies[1].hp).toBe(80 - burst);
    expect(perks(on.c.drainEvents(), 'pollenBurst')).toHaveLength(2);
    // Root Call's Rally bursts too
    const rc = fight('moss', ['rootCall', 'pollenBurst'], { enemies: ['slime', 'slime'] });
    for (let i = 0; i < 3; i++) callAlly(rc.c);
    for (let i = 0; i < skillN(rc.t, 'rootCall'); i++) tapNew(rc.c, 'red', false);
    expect(rc.c.enemies[1].hp).toBe(80 - burst);
  });
});

// ---------------------------------------------------------------- Tam

describe('Tam', () => {
  const kegDmg = (c: Combat) => Math.round(c.stats().atk * c.tuning.styles.kegMult);

  it('Stockpile: each wave starts with n kegs on the bar', () => {
    const waves = [['slime'], ['slime']];
    const { on, off } = both('tam', ['stockpile'], { waves });
    expect(kinds(on.c, 'keg')).toHaveLength(skillN(on.t, 'stockpile'));
    expect(kinds(off.c, 'keg')).toHaveLength(0);
    expect(perks(on.early, 'stockpile')).toHaveLength(1);
    for (const k of kinds(on.c, 'keg')) on.c.removeBlock(k, 'hit');
    on.c.enemies[0].hp = 1;
    on.c.stacks = 1;
    on.c.finisher();
    go(on.c, on.c.time + on.t.waves.gapSec + 0.1);
    expect(on.c.waveIndex).toBe(1);
    expect(kinds(on.c, 'keg')).toHaveLength(skillN(on.t, 'stockpile'));
  });

  it('Restock: a Perfect hit on a keg drops a new keg (not a plain one)', () => {
    for (const [skills, perfect, want] of [
      [['restock'], true, 1],
      [['restock'], false, 0],
      [[], true, 0],
    ] as const) {
      const { c } = fight('tam', [...skills], { enemies: ['bandit'] });
      tapNew(c, 'keg', perfect);
      expect(kinds(c, 'keg').length, `${skills} ${perfect}`).toBe(want);
      expect(perks(c.drainEvents(), 'restock')).toHaveLength(want);
    }
  });

  it('Minefield: a red that runs into a keg sets it off (it blasts every foe and takes the red)', () => {
    const { on, off } = both('tam', ['minefield'], { enemies: ['bandit'], tune: (t) => (t.blocks.redTravelSec = 2) });
    const run = (c: Combat) => {
      const keg = c.spawnBlock('keg', 0.3);
      const red = c.spawnBlock('red', 0.6);
      go(c, c.time + 0.6);
      return { keg, red };
    };
    const a = run(on.c);
    const b = run(off.c);
    expect(on.c.blocks).not.toContain(a.keg);
    expect(on.c.blocks).not.toContain(a.red);
    expect(on.c.enemies[0].hp).toBe(140 - kegDmg(on.c));
    expect(perks(on.c.drainEvents(), 'minefield')).toHaveLength(1);
    expect(off.c.blocks).toContain(b.keg);
    expect(off.c.enemies[0].hp).toBe(140);
  });

  it('Packed Powder: keg blasts reach n% wider', () => {
    const { on, off } = both('tam', ['packedPowder'], { enemies: ['bandit'] });
    const red = (c: Combat) => c.spawnBlock('red', c.cursorPos() + c.tuning.styles.kegRadius * 1.3);
    const ra = red(on.c);
    const rb = red(off.c);
    tapNew(on.c, 'keg', true);
    tapNew(off.c, 'keg', true);
    expect(on.c.blocks).not.toContain(ra);
    expect(off.c.blocks).toContain(rb);
  });

  it('Shrapnel: a keg blast also hits the yellows it reaches (never a hold)', () => {
    const { on, off } = both('tam', ['shrapnel'], { enemies: ['bandit'] });
    const set = (c: Combat) => ({ y: c.spawnBlock('yellow', c.cursorPos() - 0.1), h: c.spawnBlock('hold', c.cursorPos() + 0.2) });
    const a = set(on.c);
    const b = set(off.c);
    on.c.tuning.styles.kegRadius = 0.3;
    off.c.tuning.styles.kegRadius = 0.3;
    tapNew(on.c, 'keg', false);
    tapNew(off.c, 'keg', false);
    expect(on.c.blocks).not.toContain(a.y);
    expect(on.c.blocks).toContain(a.h);
    expect(off.c.blocks).toContain(b.y);
    const atk = Math.round(on.c.stats().atk);
    expect(off.c.enemies[0].hp).toBe(140 - atk - kegDmg(off.c)); // the keg's own hit, its blast
    expect(on.c.enemies[0].hp).toBe(140 - atk - kegDmg(on.c) - atk); // ...and the yellow
    expect(perks(on.c.drainEvents(), 'shrapnel')).toEqual([expect.objectContaining({ amount: 1 })]);
  });

  it('Powder Line: hitting a keg sets off every keg on the bar, however far', () => {
    const { on, off } = both('tam', ['powderLine'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 500) });
    for (const { c } of [on, off]) {
      c.spawnBlock('keg', 0.1);
      c.spawnBlock('keg', 0.92);
      tapNew(c, 'keg', false);
    }
    expect(kinds(on.c, 'keg')).toHaveLength(0);
    expect(kinds(off.c, 'keg')).toHaveLength(2);
    const atk = Math.round(on.c.stats().atk); // the keg's own hit
    expect(on.c.enemies[0].hp).toBe(500 - atk - 3 * kegDmg(on.c));
    expect(off.c.enemies[0].hp).toBe(500 - atk - kegDmg(off.c));
  });

  it("Heavy Powder: keg blasts deal n% more (an enemy bomb's blast doesn't)", () => {
    const { on, off } = both('tam', ['heavyPowder'], { enemies: ['bandit'] });
    tapNew(on.c, 'keg', false);
    tapNew(off.c, 'keg', false);
    expect(140 - off.c.enemies[0].hp).toBe(kegDmg(off.c) + Math.round(off.c.stats().atk));
    expect(140 - on.c.enemies[0].hp).toBe(Math.round(kegDmg(on.c) * (1 + skillN(on.t, 'heavyPowder') / 100)) + Math.round(on.c.stats().atk));
    const hp = on.c.enemies[0].hp;
    tapNew(on.c, 'bomb', false);
    expect(hp - on.c.enemies[0].hp).toBe(on.t.blocks.bombDamage);
  });

  it('Shockwave: a keg blast knocks every red on the bar back n% of the bar', () => {
    const { on, off } = both('tam', ['shockwave'], { enemies: ['bandit'] });
    const ra = on.c.spawnBlock('red', 0.8);
    const rb = off.c.spawnBlock('red', 0.8);
    tapNew(on.c, 'keg', false);
    tapNew(off.c, 'keg', false);
    expect(ra.push).toBeCloseTo(skillN(on.t, 'shockwave') / 100);
    expect(rb.push).toBe(0);
    expect(perks(on.c.drainEvents(), 'shockwave')).toHaveLength(1);
  });

  it('Kaboom: every keg blast fills n% of the meter (a chained keg is a blast too)', () => {
    const { on, off } = both('tam', ['kaboom'], { enemies: ['bandit'] });
    for (const { c } of [on, off]) {
      c.spawnBlock('keg', c.cursorPos() + 0.08); // close enough to go off with it (Chain Fuse)
      tapNew(c, 'keg', false);
    }
    expect(on.c.meter - off.c.meter).toBeCloseTo((2 * skillN(on.t, 'kaboom')) / 100);
    expect(perks(on.c.drainEvents(), 'kaboom')).toEqual([expect.objectContaining({ amount: 2 })]);
  });

  it('the keg perks work in any order they were learned in, and once per hit', () => {
    const a = fight('tam', ['kaboom', 'powderLine', 'shrapnel'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 500) });
    const b = fight('tam', ['shrapnel', 'powderLine', 'kaboom'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 500) });
    for (const { c } of [a, b]) {
      c.spawnBlock('keg', 0.1);
      c.spawnBlock('yellow', 0.16);
      tapNew(c, 'keg', false);
    }
    expect(a.c.meter).toBeCloseTo(b.c.meter);
    expect(a.c.enemies[0].hp).toBe(b.c.enemies[0].hp);
    expect(kinds(a.c, 'yellow')).toHaveLength(0);
    expect(a.c.meter).toBeGreaterThan(0.3); // 2 blasts' worth, plus the hits
  });
});

// ---------------------------------------------------------------- Hollis

describe('Hollis', () => {
  it('Sure Guard: a Perfect block stores n more Guard (a plain block 1)', () => {
    const { on, off } = both('hollis', ['sureGuard']);
    tapNew(on.c, 'red', true);
    tapNew(off.c, 'red', true);
    expect(guardOf(on.c)).toBe(1 + skillN(on.t, 'sureGuard'));
    expect(guardOf(off.c)).toBe(1);
    tapNew(on.c, 'red', false);
    expect(guardOf(on.c)).toBe(2 + skillN(on.t, 'sureGuard'));
  });

  it('Deep Guard: each Guard charge a hit unleashes adds n% more', () => {
    const { on, off } = both('hollis', ['deepGuard']);
    for (const { c } of [on, off]) {
      tapNew(c, 'red', false);
      tapNew(c, 'red', false);
      tapNew(c, 'yellow', false);
    }
    const atk = on.c.stats().atk;
    const g = on.t.styles.guardPer;
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(atk * (1 + 2 * g)));
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(atk * (1 + 2 * g * (1 + skillN(on.t, 'deepGuard') / 100))));
    expect(perks(ev, 'deepGuard')).toHaveLength(1);
  });

  it('Avalanche: a hit at full Guard strikes every other foe for as much', () => {
    const { on, off } = both('hollis', ['avalanche'], { enemies: ['slime', 'slime'] });
    for (const { c } of [on, off]) {
      c.perk.guard = guardMax(c);
      tapNew(c, 'yellow', false);
    }
    const hit = 80 - on.c.enemies[0].hp;
    expect(on.c.enemies[1].hp).toBe(80 - hit);
    expect(off.c.enemies[1].hp).toBe(80);
    // short of full: one hit
    const s = fight('hollis', ['avalanche'], { enemies: ['slime', 'slime'] });
    s.c.perk.guard = guardMax(s.c) - 1;
    tapNew(s.c, 'yellow', false);
    expect(s.c.enemies[1].hp).toBe(80);
  });

  it('Heavy Slam: Shield Slam hits n% harder', () => {
    const { on, off } = both('hollis', ['heavySlam'], { enemies: ['bandit'] });
    tapNew(on.c, 'red', true);
    tapNew(off.c, 'red', true);
    const slam = Math.round(off.c.stats().atk * off.t.kits.hollis.slam);
    expect(140 - off.c.enemies[0].hp).toBe(slam);
    expect(140 - on.c.enemies[0].hp).toBe(Math.round(slam * (1 + skillN(on.t, 'heavySlam') / 100)));
    expect(perks(on.c.drainEvents(), 'heavySlam')).toHaveLength(1);
  });

  it("Wide Slam: Shield Slam also hits every other foe for n% (a plain block doesn't slam)", () => {
    const { on, off } = both('hollis', ['wideSlam'], { enemies: ['bandit', 'bandit'] });
    tapNew(on.c, 'red', false, on.c.enemies[0].id);
    expect(on.c.enemies[1].hp).toBe(140);
    for (const { c } of [on, off]) tapNew(c, 'red', true, c.enemies[0].id);
    const slam = on.c.stats().atk * on.t.kits.hollis.slam;
    expect(on.c.enemies.map((e) => e.hp)).toEqual([140 - Math.round(slam), 140 - Math.round((slam * skillN(on.t, 'wideSlam')) / 100)]);
    expect(off.c.enemies.map((e) => e.hp)).toEqual([140 - Math.round(slam), 140]);
  });

  it('Retaliate: a plain block slams back too, for n% of a Shield Slam (Wide Slam spreads it)', () => {
    const { on, off } = both('hollis', ['retaliate'], { enemies: ['bandit'] });
    tapNew(on.c, 'red', false);
    tapNew(off.c, 'red', false);
    const slam = on.c.stats().atk * on.t.kits.hollis.slam;
    expect(140 - on.c.enemies[0].hp).toBe(Math.round((slam * skillN(on.t, 'retaliate')) / 100));
    expect(off.c.enemies[0].hp).toBe(140);
    expect(perks(on.c.drainEvents(), 'retaliate')).toHaveLength(1);
    // a Perfect block slams as before (no extra)
    on.c.enemies[0].hp = 140;
    tapNew(on.c, 'red', true);
    expect(140 - on.c.enemies[0].hp).toBe(Math.round(slam));
    const w = fight('hollis', ['wideSlam', 'retaliate'], { enemies: ['bandit', 'bandit'] });
    tapNew(w.c, 'red', false, w.c.enemies[0].id);
    expect(140 - w.c.enemies[1].hp).toBe(Math.round((((slam * skillN(w.t, 'retaliate')) / 100) * skillN(w.t, 'wideSlam')) / 100));
  });

  it("Long Rampart: Rampart's wall stands n s longer", () => {
    const { on, off } = both('hollis', ['longRampart']);
    for (const { c } of [on, off]) {
      c.stacks = 1;
      c.finisher();
    }
    expect(off.c.perk.rampart).toBeCloseTo(off.t.kits.hollis.rampartSec);
    expect(on.c.perk.rampart).toBeCloseTo(on.t.kits.hollis.rampartSec + skillN(on.t, 'longRampart'));
  });

  it('Wall Up: a green hit raises the wall for n s (reds bounce off the left end)', () => {
    const { on, off } = both('hollis', ['wallUp'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    for (const { c } of [on, off]) {
      tapNew(c, 'green', false);
      letRedThrough(c);
    }
    expect(on.c.perk.rampart).toBeGreaterThan(0);
    expect(on.c.hero.hp).toBe(on.c.maxHp());
    expect(on.c.drainEvents().some((e) => e.type === 'deflect')).toBe(true);
    expect(off.c.hero.hp).toBeLessThan(off.c.maxHp());
    // it falls after n s
    go(on.c, on.c.time + skillN(on.t, 'wallUp'));
    letRedThrough(on.c);
    expect(on.c.hero.hp).toBeLessThan(on.c.maxHp());
  });

  it('Echo Wall: every n reds that bounce off the wall bank a finisher stack', () => {
    const { on, off } = both('hollis', ['echoWall'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    const n = skillN(on.t, 'echoWall');
    for (const { c } of [on, off]) {
      c.perk.rampart = 60;
      for (let i = 0; i < n; i++) {
        c.spawnBlock('red', 0.05);
        go(c, c.time + 0.12);
      }
    }
    expect(evs(off.c.drainEvents(), 'deflect').length).toBeGreaterThanOrEqual(n);
    expect(off.c.stacks).toBe(0);
    expect(on.c.stacks).toBe(1);
    expect(perks(on.c.drainEvents(), 'echoWall')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- Vesper

describe('Vesper', () => {
  it('Full Draw: hits store n% more Focus', () => {
    const { on, off } = both('vesper', ['fullDraw'], { enemies: ['bandit'] });
    tapNew(on.c, 'yellow', false);
    tapNew(off.c, 'yellow', false);
    const base = off.c.stats().atk * off.t.styles.focusStore;
    expect(focusOf(off.c)).toBeCloseTo(base);
    expect(focusOf(on.c)).toBeCloseTo(base * (1 + skillN(on.t, 'fullDraw') / 100));
  });

  it('Steady Hand: at n% Focus or more, every hit crits', () => {
    const { on, off } = both('vesper', ['steadyHand'], { enemies: ['bandit'] });
    const at = (c: Combat) => (focusCap(c) * skillN(on.t, 'steadyHand')) / 100;
    on.c.perk.focus = at(on.c) - 1;
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).crit).toBe(false);
    for (const { c } of [on, off]) {
      c.perk.focus = at(c);
      tapNew(c, 'yellow', false);
    }
    const ev = on.c.drainEvents();
    expect(lastHit(ev).crit).toBe(true);
    expect(perks(ev, 'steadyHand')).toHaveLength(1);
    expect(lastHit(off.c.drainEvents()).crit).toBe(false);
  });

  it('Full Quiver: when a hit fills Focus up, it fires itself as a critical Power Shot and fills n% of the meter', () => {
    const { on, off } = both('vesper', ['fullQuiver'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    for (const { c } of [on, off]) {
      c.perk.focus = focusCap(c) - 1;
      tapNew(c, 'yellow', false); // stores more than 1: full
    }
    expect(focusOf(off.c)).toBeCloseTo(focusCap(off.c));
    expect(focusOf(on.c)).toBe(0);
    const ev = on.c.drainEvents();
    expect(perks(ev, 'fullQuiver')).toEqual([expect.objectContaining({ amount: Math.round(focusCap(on.c) * on.c.stats().critDmg) })]);
    expect(on.c.meter - off.c.meter).toBeCloseTo(skillN(on.t, 'fullQuiver') / 100);
    expect(900 - on.c.enemies[0].hp).toBe(900 - off.c.enemies[0].hp + Math.round(focusCap(on.c) * on.c.stats().critDmg));
    // short of full: nothing
    const s = fight('vesper', ['fullQuiver'], { enemies: ['bandit'] });
    tapNew(s.c, 'yellow', false);
    expect(focusOf(s.c)).toBeGreaterThan(0);
  });

  it("Clean Shot: Perfect hits aren't held back by Focus", () => {
    const { on, off } = both('vesper', ['cleanShot'], { enemies: ['bandit'] });
    tapNew(on.c, 'yellow', true);
    tapNew(off.c, 'yellow', true);
    const atk = on.c.stats().atk;
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(atk));
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(atk * off.t.styles.focusShare));
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(atk * on.t.styles.focusShare));
  });

  it('Watchful: a Perfect block stores Focus like a Perfect hit', () => {
    const { on, off } = both('vesper', ['watchful'], { enemies: ['bandit'] });
    tapNew(on.c, 'red', true);
    tapNew(off.c, 'red', true);
    expect(focusOf(off.c)).toBe(0);
    expect(focusOf(on.c)).toBeCloseTo(on.c.stats().atk * on.t.styles.focusStore * 2);
    tapNew(on.c, 'red', false);
    expect(focusOf(on.c)).toBeCloseTo(on.c.stats().atk * on.t.styles.focusStore * 2);
  });

  it('Trick Shot: every n-th Perfect hit fires the Focus as a Power Shot', () => {
    const { on, off } = both('vesper', ['trickShot'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 1000) });
    const n = skillN(on.t, 'trickShot');
    for (const { c } of [on, off]) for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    expect(focusOf(on.c)).toBeCloseTo(focusOf(off.c));
    const f = focusOf(on.c) + on.c.stats().atk * on.t.styles.focusStore * 2;
    tapNew(on.c, 'yellow', true);
    tapNew(off.c, 'yellow', true);
    expect(focusOf(on.c)).toBe(0);
    expect(focusOf(off.c)).toBeCloseTo(f);
    expect(perks(on.c.drainEvents(), 'trickShot')).toEqual([expect.objectContaining({ amount: Math.round(f * on.c.stats().critDmg) })]);
  });

  it('Pinning Shot: a green hit pins every red for n s', () => {
    const { on, off } = both('vesper', ['pinningShot']);
    const ra = on.c.spawnBlock('red', 0.9);
    const rb = off.c.spawnBlock('red', 0.9);
    tapNew(on.c, 'green', false);
    tapNew(off.c, 'green', false);
    expect(ra.chill).toBeCloseTo(skillN(on.t, 'pinningShot'));
    expect(ra.chillMult).toBe(0);
    expect(rb.chill).toBe(0);
  });

  it('Exposed: a foe with a pinned red on the bar takes n% more damage', () => {
    const { on, off } = both('vesper', ['exposed'], { enemies: ['bandit'] });
    const hit = (c: Combat) => {
      const hp = c.enemies[0].hp;
      tapNew(c, 'yellow', false);
      return hp - c.enemies[0].hp;
    };
    const plain = hit(on.c);
    expect(plain).toBe(hit(off.c));
    for (const { c } of [on, off]) c.chillRed(c.spawnBlock('red', 0.9), 5, 0);
    expect(hit(off.c)).toBe(plain);
    expect(hit(on.c)).toBe(Math.round(plain * (1 + skillN(on.t, 'exposed') / 100)));
  });

  it('Deadfall: blocking a pinned red hits every foe for n% attack', () => {
    const { on, off } = both('vesper', ['deadfall'], { enemies: ['bandit', 'bandit'] });
    for (const { c } of [on, off]) {
      const r = c.spawnBlock('red', c.cursorPos());
      c.chillRed(r, 5, 0);
      c.tap(c.time);
    }
    const dmg = Math.round((on.c.stats().atk * skillN(on.t, 'deadfall')) / 100);
    expect(on.c.enemies.map((e) => e.hp)).toEqual([140 - dmg, 140 - dmg]);
    expect(off.c.enemies.map((e) => e.hp)).toEqual([140, 140]);
    // an unpinned red: nothing
    tapNew(on.c, 'red', false);
    expect(on.c.enemies[1].hp).toBe(140 - dmg);
  });
});

// ---------------------------------------------------------------- Torva

describe('Torva', () => {
  const heavy = (c: Combat) => c.stats().atk * c.tuning.styles.heavyMult;

  it('Pulverize: stunned foes take n% more from her', () => {
    const { on, off } = both('torva', ['pulverize'], { enemies: ['bandit'] });
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c)));
    for (const { c } of [on, off]) {
      c.stun(c.enemies[0], 3);
      c.enemies[0].hp = 140;
      tapNew(c, 'yellow', false);
    }
    expect(140 - off.c.enemies[0].hp).toBe(Math.round(heavy(off.c)));
    expect(140 - on.c.enemies[0].hp).toBe(Math.round(Math.round(heavy(on.c)) * (1 + skillN(on.t, 'pulverize') / 100)));
  });

  it('Haymaker: a Wound-Up hit deals n% more', () => {
    const { on, off } = both('torva', ['haymaker'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 500) });
    for (const { c } of [on, off]) {
      tapNew(c, 'green', false);
      tapNew(c, 'yellow', false);
    }
    const base = heavy(off.c) * off.t.kits.torva.windUp;
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(base));
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(base * (1 + skillN(on.t, 'haymaker') / 100)));
    expect(perks(ev, 'haymaker')).toHaveLength(1);
    // the next one is a plain hit
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c)));
  });

  it('Wrecking Ball: every n-th Perfect hit winds up the next one', () => {
    const { on, off } = both('torva', ['wreckingBall'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    const n = skillN(on.t, 'wreckingBall');
    for (const { c } of [on, off]) for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    expect(on.c.perk.windUp ?? 0).toBe(0);
    for (const { c } of [on, off]) tapNew(c, 'yellow', true);
    expect(on.c.perk.windUp).toBe(1);
    expect(off.c.perk.windUp ?? 0).toBe(0);
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c) * on.t.kits.torva.windUp));
    expect(on.c.enemies[0].stun).toBeGreaterThan(0);
  });

  it('Fault Line: Quakes knock reds n% further', () => {
    const { on, off } = both('torva', ['faultLine']);
    const ra = on.c.spawnBlock('red', 0.65);
    const rb = off.c.spawnBlock('red', 0.65);
    tapNew(on.c, 'yellow', true);
    tapNew(off.c, 'yellow', true);
    const q = on.t.kits.torva.quake;
    expect(rb.push).toBeCloseTo(q);
    expect(ra.push).toBeCloseTo(q * (1 + skillN(on.t, 'faultLine') / 100));
  });

  it('Rupture: a Quake also hits every foe for n% attack (a plain hit does not quake)', () => {
    const { on, off } = both('torva', ['rupture'], { enemies: ['slime', 'slime'] });
    tapNew(on.c, 'yellow', false);
    expect(on.c.enemies[1].hp).toBe(80);
    tapNew(on.c, 'yellow', true);
    tapNew(off.c, 'yellow', true);
    expect(on.c.enemies[1].hp).toBe(80 - Math.round((on.c.stats().atk * skillN(on.t, 'rupture')) / 100));
    expect(off.c.enemies[1].hp).toBe(80);
  });

  it('Landslide: every n-th Quake clears every red off the bar', () => {
    const { on, off } = both('torva', ['landslide'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    const n = skillN(on.t, 'landslide');
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.9);
      c.spawnBlock('shield', 0.75);
      for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    }
    expect(on.c.blocks.filter((b) => b.kind === 'red' || b.kind === 'shield')).toHaveLength(2);
    tapNew(on.c, 'yellow', true);
    tapNew(off.c, 'yellow', true);
    expect(on.c.blocks.filter((b) => b.kind === 'red' || b.kind === 'shield')).toHaveLength(0);
    expect(off.c.blocks.filter((b) => b.kind === 'red' || b.kind === 'shield')).toHaveLength(2);
    expect(perks(on.c.drainEvents(), 'landslide')).toEqual([expect.objectContaining({ amount: 2 })]);
  });

  it('Seething: each hit she takes adds n Unstoppable stacks (up to its limit)', () => {
    const { on, off } = both('torva', ['seething'], { enemies: ['bandit'], tune: (t) => ((t.blocks.redTravelSec = 1), (t.kits.torva.hp = 400)) });
    const n = skillN(on.t, 'seething');
    const max = on.t.kits.torva.unstoppableMax;
    for (const { c } of [on, off]) letRedThrough(c);
    expect(on.c.perk.unstoppable).toBe(n);
    expect(off.c.perk.unstoppable).toBe(1);
    expect(perks(on.c.drainEvents(), 'seething')).toHaveLength(1);
    for (let i = 0; i < max; i++) letRedThrough(on.c);
    expect(on.c.perk.unstoppable).toBe(max);
    // a miss doesn't count
    const m = fight('torva', ['seething']);
    m.c.tap(m.c.time);
    expect(m.c.perk.unstoppable ?? 0).toBe(0);
  });

  it('Payback: a red that hits her winds up her next hit (x2.5 and a stun)', () => {
    const { on, off } = both('torva', ['payback'], { enemies: ['bandit'], tune: (t) => ((t.blocks.redTravelSec = 1), (t.enemies.bandit.hp = 500)) });
    for (const { c } of [on, off]) {
      letRedThrough(c);
      tapNew(c, 'yellow', false);
    }
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(heavy(off.c)));
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(heavy(on.c) * on.t.kits.torva.windUp));
    expect(on.c.enemies[0].stun).toBeGreaterThan(0);
    expect(perks(ev, 'payback')).toHaveLength(1);
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c)));
  });

  it('Berserk: under half HP, her hits deal n% more', () => {
    const { on, off } = both('torva', ['berserk'], { enemies: ['bandit'] });
    on.c.hero.hp = Math.ceil(on.c.maxHp() / 2);
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c)));
    for (const { c } of [on, off]) {
      c.hero.hp = Math.floor(c.maxHp() / 2) - 1;
      tapNew(c, 'yellow', false);
    }
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(heavy(off.c)));
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c) * (1 + skillN(on.t, 'berserk') / 100)));
  });
});

// ---------------------------------------------------------------- one cursor, ice patches and holds

describe('every tree on a bar with ice patches and holds (one cursor)', () => {
  const bar: BarRules = { ice: { every: 2, width: 0.2, life: 4, fromRow: 0, max: 2 }, holds: { share: 0.35, fromRow: 0, width: 0.16 } };

  it("a whole tree learned plays a busy fight without breaking: taps, holds, kegs, allies, the finisher", () => {
    for (const hero of OTHERS) {
      const { t, s } = setup({ hero, tune: (t) => ((t.blocks.openingSpawns = 3), (t.enemies.slime.hp = 400)) });
      const skills = treeOf(hero).flatMap((b) => b.nodes.map((n) => n.id));
      const h = newHero(t, emptyLoadout(), { id: hero, level: 30, skills, stars: 5 });
      const c = new Combat({ tuning: t, settings: s, hero: h, waves: [['slime', 'bandit'], ['wolf', 'slime']], enemies: [], seed: 7, spawning: true, bar, row: 3 });
      let r = 1;
      const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const seen = new Set<string>();
      for (let k = 0; k < 120 * 25 && !c.result; k++) {
        c.step();
        if (c.holding) {
          if (rand() < 0.02) c.release(c.time);
        } else if (rand() < 0.06) {
          // tap what's under the cursor (or near it), like a player
          const u = c.underCursor(c.time);
          if (u.red || u.attack || rand() < 0.3) c.tap(c.time);
        }
        if (c.stacks >= 2 && rand() < 0.01) c.finisher();
        for (const e of c.drainEvents()) if (e.type === 'perk') seen.add(e.id);
        expect(Number.isFinite(c.hero.hp), hero).toBe(true);
        for (const e of c.enemies) expect(Number.isFinite(e.hp), `${hero} ${e.key}`).toBe(true);
        for (const b of c.blocks) expect(Number.isFinite(b.pos) && b.pos >= 0 && b.pos <= 1, `${hero} ${b.kind}`).toBe(true);
        expect(c.cursorPos() >= 0 && c.cursorPos() <= 1, hero).toBe(true);
      }
      // the tree did something
      expect([...seen].filter((id) => skills.includes(id)).length, `${hero}: ${[...seen].join(' ')}`).toBeGreaterThan(2);
      expect(c.zones.length + c.tick).toBeGreaterThan(0);
    }
  });

  it('nodes that count Perfect hits count a completed Perfect hold (Deep Cuts, Wrecking Ball, Clean Shot)', () => {
    const hold = (c: Combat) => {
      const h = c.spawnBlock('hold', 0.75);
      const edge = h.pos - h.width / 2;
      const at = c.time + c.travelTime(c.cursorPos(), edge, 1);
      go(c, at);
      expect(c.tap(at).outcome).toBe('hold');
      go(c, c.time + c.travelTime(c.cursorPos(), h.pos + h.width / 2, 1) + 0.05);
      return c.drainEvents();
    };
    const s = fight('sable', ['deepCuts'], { tune: (t) => (t.skills.n.deepCuts = 1) });
    s.c.perk.chain = 1;
    expect(lastHit(hold(s.c))).toMatchObject({ kind: 'hold', perfect: true, crit: true });
    const tv = fight('torva', ['wreckingBall'], { tune: (t) => (t.skills.n.wreckingBall = 1) });
    hold(tv.c);
    expect(tv.c.perk.windUp).toBe(1);
    const v = fight('vesper', ['cleanShot'], { enemies: ['bandit'] });
    const ev = hold(v.c);
    expect(lastHit(ev).damage).toBe(Math.round(v.c.stats().atk * v.t.hold.mult));
  });
});
