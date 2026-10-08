// Round 7's Solenne (Blade, Mythic) and Wren (Shadow, Rare): their kits (core/kit-fx.ts) and a with/without test for
// every rule node and capstone of their trees (core/skill-fx-heroes.ts), plus the chest odds a Mythic hero drops at.
import { describe, expect, it } from 'vitest';
import { HEROES, type HeroId } from '../../src/data/heroes';
import { Combat, isRed, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { kitText, skillN } from '../../src/core/heroes';
import { isGilded, sunEvery } from '../../src/core/kit-fx';
import { chainOf } from '../../src/core/styles';
import { CHEST_HEROES, chestOdds, rollChest } from '../../src/core/chests';
import { newProfile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { tierIndex } from '../../src/data/rarity';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { LAB_NEW } from '../../src/data/lab';
import { GREENMARCH } from '../../src/data/greenmarch';
import { TIPS } from '../../src/data/tips';
import { labFight } from '../../src/core/lab';
import { MASTERY } from '../../src/data/meta';
import { relicById } from '../../src/data/relics';
import { STORY } from '../../src/data/story';
import { HERO_TREES } from '../../src/data/skills-heroes';
import { setup } from './helpers';

// ---------------------------------------------------------------- helpers (as tests/unit/hero-skills.test.ts)

/** A fight as `hero` knowing `skills`, the cursor mid-bar moving right (no spawns, no crits; reds crawl unless the
 *  test speeds them up: t.blocks.redTravelSec). */
function fight(hero: HeroId, skills: string[], o: { enemies?: string[]; tune?: (t: Tuning) => void; stars?: number } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills, stars: o.stars ?? 1 });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], seed: 42, spawning: false });
  c.advanceTo(0.7);
  c.drainEvents();
  return { c, t };
}

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
const missNow = (c: Combat) => c.tap(c.time); // nothing under the cursor

/** Run the combo up to `to` with plain (Good) hits on yellows. */
function comboTo(c: Combat, to: number): void {
  for (let k = 0; k < 400 && c.combo < to; k++) {
    // (the foe it hits never falls: the fight would end)
    const e = c.currentTarget();
    if (e) e.hp = Math.max(e.hp, e.maxHp);
    tapNew(c, 'yellow', false);
  }
  expect(c.combo).toBeGreaterThanOrEqual(to);
}

// ---------------------------------------------------------------- the data

describe('Solenne and Wren as data', () => {
  it('a Mythic Blade with a gift and a Rare Shadow, both from hero chests, with their meet scenes', () => {
    expect(HEROES.solenne).toMatchObject({ style: 'blade', rarity: 'mythic', joins: 'chest', meetScene: 'meetSolenne', art: 'solenne' });
    expect(HEROES.wren).toMatchObject({ style: 'shadow', rarity: 'rare', joins: 'chest', meetScene: 'meetWren', art: 'wren' });
    expect(HEROES.solenne.gift?.name).toBe('Radiance');
    expect(HEROES.wren.gift).toBeUndefined();
    const t = cloneTuning();
    expect(kitText(t, 'solenne', 'signature')).toContain(String(t.kits.solenne.sunEvery));
    expect(kitText(t, 'solenne', 'gift')).toContain(`${Math.round((1 - t.kits.solenne.radiance) * 100)}%`);
    expect(kitText(t, 'wren', 'ability')).toContain(`${Math.round(t.kits.wren.smokeCut * 100)}%`);
    expect(kitText(t, 'wren', 'gift')).toBe('');
    // the hero select's short lines carry no numbers
    for (const id of ['solenne', 'wren'] as const) {
      const h = HEROES[id];
      for (const p of [h.signature, h.ability, h.passive, h.finisher, ...(h.gift ? [h.gift] : []), ...h.stars]) expect(p.short, p.name).not.toMatch(/\d/);
    }
  });

  it('both are in the hero chests; a Mythic hero drops at tiny odds, and more often within the shrine pity', () => {
    expect(CHEST_HEROES).toContain('solenne');
    expect(CHEST_HEROES).toContain('wren');
    const t = cloneTuning();
    // a hero chest's Mythic-or-better tiers (a Celestial or Divine roll falls back to the best tier with a hero: Mythic)
    const odds = chestOdds(t, 'hero');
    const mythicUp = odds.slice(tierIndex('mythic')).reduce((a, b) => a + b, 0) * t.chests.heroShare;
    expect(mythicUp).toBeGreaterThan(0);
    expect(mythicUp).toBeLessThan(0.005);
    const roll = (kind: 'hero' | 'rare', n: number, pity = 0) => {
      const rng = new Rng(11);
      let got = 0;
      for (let i = 0; i < n; i++) {
        const p = newProfile();
        p.pity.rare = pity;
        const prize = rollChest(rng, t, p, kind);
        if (prize.kind === 'hero' && prize.id === 'solenne') got++;
      }
      return got / n;
    };
    expect(roll('hero', 20000)).toBeGreaterThan(0);
    expect(roll('hero', 20000)).toBeLessThan(0.005);
    // the shrine's pity forces a Legendary or better: a Mythic hero is then far likelier
    expect(roll('rare', 4000, Math.round(t.chests.pity) - 1)).toBeGreaterThan(0.03);
  });
});

describe('Solenne and Wren in the Test lab, the story and mastery', () => {
  it("each has a hero fight in New: six waves of Region 1 foes at Act 2's numbers, an elite last, the finisher banked, the how-to first", () => {
    const r1 = new Set(GREENMARCH.acts.flatMap((a) => [...a.fights.early.flat(), ...a.fights.late.flat(), ...a.elites.flat()]));
    const elites = new Set(GREENMARCH.acts.flatMap((a) => a.elites.flat()));
    for (const id of ['solenne', 'wren'] as const) {
      const s = LAB_NEW.find((x) => x.id === id && x.group === 'heroes')!;
      expect(s, id).toBeDefined();
      expect(s.label).toBe(HEROES[id].name);
      const f = labFight(s)!;
      expect(f.act, id).toBe(1);
      expect(f.waves.length, id).toBeGreaterThanOrEqual(6);
      expect(f.waves.at(-1)!.some((e) => elites.has(e)), id).toBe(true);
      for (const k of f.waves.flat()) expect(r1.has(k), `${id}: ${k}`).toBe(true);
      expect(f.stacks, id).toBeGreaterThanOrEqual(1);
      const tip = TIPS.find((d) => d.hero === id)!;
      expect(tip.after).toEqual(['tapYellow']);
      expect(s.profile?.tips, id).toEqual([tip.id]);
    }
  });

  it('each has a meet scene in their own voice, four mastery milestones (lv 5, 3 acts, lv 10, a boss) with real rewards', () => {
    for (const id of ['solenne', 'wren'] as const) {
      const scene = STORY[HEROES[id].meetScene!];
      expect(scene.some((b) => b.who === id), id).toBe(true);
      const m = MASTERY.filter((x) => x.hero === id);
      expect(m.map((x) => x.goal)).toEqual([{ level: 5 }, { acts: 3 }, { level: 10 }, { boss: true }]);
      for (const x of m) if (x.reward.kind === 'relic') expect(relicById(x.reward.relic), x.id).toBeDefined();
      expect(m.at(-1)!.reward).toMatchObject({ kind: 'cosmetic' });
    }
  });
});

// ---------------------------------------------------------------- Solenne's kit

describe("Solenne's kit", () => {
  it('Sunrise: every 15 combo her blade burns for a few seconds; while it does, hits cut every other foe', () => {
    const { c, t } = fight('solenne', [], { enemies: ['bandit', 'slime'], tune: (t) => (t.enemies.bandit.hp = 900) });
    comboTo(c, sunEvery(c) - 2);
    tapNew(c, 'yellow', false);
    expect(c.perk.sunrise ?? 0).toBe(0);
    expect(c.enemies[1].hp).toBe(80);
    c.drainEvents();
    tapNew(c, 'yellow', false); // the 25th
    const ev = c.drainEvents();
    expect(perks(ev, 'sunrise')).toHaveLength(1);
    expect(c.perk.sunrise).toBeCloseTo(t.kits.solenne.sunSec, 5);
    // that hit already burned: the other foe is cut for a share of it
    const dmg = lastHit(ev).damage;
    expect(c.enemies[1].hp).toBe(80 - Math.round(dmg * t.kits.solenne.sunCut));
    expect(perks(ev, 'sunCut')).toEqual([expect.objectContaining({ enemyId: c.enemies[1].id })]);
    // it burns out
    go(c, c.time + t.kits.solenne.sunSec + 0.1);
    expect(c.perk.sunrise).toBe(0);
    const hp = c.enemies[1].hp;
    tapNew(c, 'yellow', false);
    expect(c.enemies[1].hp).toBe(hp);
  });

  it('Radiance (her gift): reds on the bar, and reds that come while it burns, move slower', () => {
    const { c, t } = fight('solenne', []);
    const r1 = c.spawnBlock('red', 0.9);
    comboTo(c, sunEvery(c));
    expect(r1.chill).toBeGreaterThan(0);
    expect(r1.chillMult).toBeCloseTo(t.kits.solenne.radiance);
    const r2 = c.spawnBlock('red', 0.95);
    expect(r2.chill).toBeGreaterThan(0);
    expect(r2.chillMult).toBeCloseTo(t.kits.solenne.radiance);
    go(c, c.time + t.kits.solenne.sunSec + 0.2);
    const r3 = c.spawnBlock('red', 0.95);
    expect(r3.chill).toBe(0);
  });

  it('Gleam: a green gilds the next yellow ahead; hitting it adds combo and meter', () => {
    const { c, t } = fight('solenne', []);
    const ahead = c.spawnBlock('yellow', 0.85);
    const behind = c.spawnBlock('yellow', 0.2);
    tapNew(c, 'green', false);
    expect(isGilded(ahead)).toBe(true);
    expect(isGilded(behind)).toBe(false);
    expect(perks(c.drainEvents(), 'gleam')).toHaveLength(1);
    const combo0 = c.combo;
    const meter0 = c.meter;
    tapWhenThere(c, ahead, 25); // not Perfect
    expect(c.combo - combo0).toBe(1 + t.kits.solenne.gleamCombo);
    expect(c.meter - meter0).toBeCloseTo(t.meter.perHit + t.kits.solenne.gleamMeter, 5);
    expect(perks(c.drainEvents(), 'gilded')).toHaveLength(1);
    // a plain yellow after it: plain again
    const combo1 = c.combo;
    tapNew(c, 'yellow', false);
    expect(c.combo - combo1).toBe(1);
  });

  it('Gleam with no yellow on the bar gilds the next one to come', () => {
    const { c } = fight('solenne', []);
    tapNew(c, 'green', false);
    const y = c.spawnBlock('yellow', 0.8);
    expect(isGilded(y)).toBe(true);
    expect(isGilded(c.spawnBlock('yellow', 0.3))).toBe(false);
  });

  it('Dawn Oath: at 30+ combo a miss keeps half the combo (the stacks still go); below it, or a hit taken, all goes', () => {
    const { c, t } = fight('solenne', [], { tune: (t) => (t.kits.solenne.hp = 400) });
    c.combo = 60;
    c.stacks = 2;
    missNow(c);
    expect(c.combo).toBe(30);
    expect(c.stacks).toBe(0);
    expect(perks(c.drainEvents(), 'dawnOath')).toEqual([expect.objectContaining({ amount: 30 })]);
    c.combo = t.kits.solenne.oathAt;
    missNow(c);
    expect(c.combo).toBe(Math.floor(t.kits.solenne.oathAt / 2));
    c.combo = t.kits.solenne.oathAt - 1;
    missNow(c);
    expect(c.combo).toBe(0);
    const r = fight('solenne', [], { tune: (t) => ((t.blocks.redTravelSec = 1), (t.kits.solenne.hp = 400)) });
    r.c.combo = 60;
    letRedThrough(r.c);
    expect(r.c.combo).toBe(0);
  });

  it('Sunfall: hits every foe, bigger with the combo (up to a cap), clears the reds, then gilds the yellows nearest the left', () => {
    const at = (combo: number, stars = 1) => {
      const { c } = fight('solenne', [], { enemies: ['bandit', 'bandit'], stars, tune: (t) => (t.enemies.bandit.hp = 5000) });
      const ys = [0.85, 0.6, 0.3].map((p) => c.spawnBlock('yellow', p));
      c.spawnBlock('red', 0.95);
      c.combo = combo;
      c.stacks = 2;
      c.finisher();
      const f = evs(c.drainEvents(), 'finisher')[0];
      return { f, ys, c };
    };
    const base = at(0);
    expect(base.f.targets).toHaveLength(2);
    expect(base.c.blocks.some((b) => isRed(b.kind))).toBe(false);
    const t = cloneTuning();
    const k = t.kits.solenne;
    expect(Math.abs(at(30).f.damage - base.f.damage * (1 + 30 * k.sunfallStep))).toBeLessThanOrEqual(1);
    expect(Math.abs(at(200).f.damage - base.f.damage * (1 + k.sunfallMax))).toBeLessThanOrEqual(1);
    // the two nearest the left end are gilded; 5 stars: every one
    expect(base.ys.map(isGilded)).toEqual([false, true, true]);
    expect(at(0, 5).ys.map(isGilded)).toEqual([true, true, true]);
  });

  it('3 stars: Sunrise burns longer', () => {
    const { c, t } = fight('solenne', [], { stars: 3 });
    comboTo(c, sunEvery(c));
    expect(c.perk.sunrise).toBeCloseTo(t.kits.solenne.sunSec3, 5);
  });
});

// ---------------------------------------------------------------- Wren's kit

describe("Wren's kit", () => {
  it('Slip: slipEvery Perfect hits in a row ready a dodge; the next red that reaches her misses (no hurt, the combo kept)', () => {
    const { c, t } = fight('wren', [], { tune: (t) => ((t.blocks.redTravelSec = 1), (t.enemies.slime.hp = 900)) });
    const n = t.kits.wren.slipEvery;
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    expect(c.perk.slip ?? 0).toBe(0);
    tapNew(c, 'yellow', true);
    expect(c.perk.slip).toBe(1);
    expect(perks(c.drainEvents(), 'slipReady')).toHaveLength(1);
    // another run doesn't stack a second dodge
    for (let i = 0; i < n; i++) tapNew(c, 'yellow', true);
    expect(c.perk.slip).toBe(1);
    const combo = c.combo;
    letRedThrough(c);
    expect(c.hero.hp).toBe(c.maxHp());
    expect(c.combo).toBe(combo);
    expect(c.perk.slip).toBe(0);
    expect(perks(c.drainEvents(), 'slip')).toHaveLength(1);
    // the next one hurts
    letRedThrough(c);
    expect(c.hero.hp).toBeLessThan(c.maxHp());
  });

  it('Slip: a Good hit (past Light Feet) or a miss starts the run over', () => {
    const { c, t } = fight('wren', [], { tune: (t) => (t.enemies.slime.hp = 900) });
    const n = t.kits.wren.slipEvery;
    for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    missNow(c);
    tapNew(c, 'yellow', true);
    expect(c.perk.slip ?? 0).toBe(0);
    tapNew(c, 'yellow', false); // Light Feet keeps it
    tapNew(c, 'yellow', false); // not twice
    for (let i = 0; i < n - 1; i++) tapNew(c, 'yellow', true);
    expect(c.perk.slip ?? 0).toBe(0);
    tapNew(c, 'yellow', true);
    expect(c.perk.slip).toBe(1);
  });

  it('Light Feet: the Chain survives one Good hit between Perfects (no link added); a second one ends it', () => {
    const { c } = fight('wren', [], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    for (let i = 0; i < 3; i++) tapNew(c, 'yellow', true);
    expect(chainOf(c)).toBe(3);
    tapNew(c, 'yellow', false);
    expect(chainOf(c)).toBe(3);
    expect(perks(c.drainEvents(), 'lightFeet')).toHaveLength(1);
    tapNew(c, 'yellow', false);
    expect(chainOf(c)).toBe(0);
    // a Perfect in between earns it back
    for (let i = 0; i < 2; i++) tapNew(c, 'yellow', true);
    tapNew(c, 'yellow', false);
    tapNew(c, 'yellow', true);
    tapNew(c, 'yellow', false);
    expect(chainOf(c)).toBe(3);
    // Sable (the same style) has no such thing
    const s = fight('sable', [], { enemies: ['bandit'], tune: (t) => ((t.kits.sable.dashLead = 99), (t.enemies.bandit.hp = 900)) });
    for (let i = 0; i < 3; i++) tapNew(s.c, 'yellow', true);
    tapNew(s.c, 'yellow', false);
    expect(chainOf(s.c)).toBe(0);
  });

  it('Smoke Pop: for a moment after a green, reds that reach her deal smokeCut less', () => {
    let cut = 0;
    const hurt = (green: boolean) => {
      const { c, t } = fight('wren', [], { tune: (t) => ((t.blocks.redTravelSec = 1), (t.kits.wren.hp = 400)) });
      cut = t.kits.wren.smokeCut;
      if (green) tapNew(c, 'green', false);
      const ev = c.drainEvents();
      if (green) expect(perks(ev, 'smokePop')).toHaveLength(1);
      letRedThrough(c);
      return { lost: c.maxHp() - c.hero.hp, ev: c.drainEvents() };
    };
    const plain = hurt(false);
    const smoke = hurt(true);
    expect(cut).toBeGreaterThan(0);
    expect(smoke.lost).toBe(Math.round(plain.lost * (1 - cut)));
    expect(perks(smoke.ev, 'smokeFade')).toHaveLength(1);
  });

  it('Rooftop Drop: the target alone, harder; then a knife per Chain link at every foe; clears the reds', () => {
    const drop = (chain: number) => {
      const { c } = fight('wren', [], { enemies: ['bandit', 'bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
      c.spawnBlock('red', 0.95);
      c.perk.chain = chain;
      c.stacks = 2;
      c.finisher();
      const ev = c.drainEvents();
      return { f: evs(ev, 'finisher')[0], c, ev };
    };
    const t = cloneTuning();
    const a = drop(0);
    expect(a.f.targets).toHaveLength(1);
    expect(a.c.enemies[1].hp).toBe(5000);
    expect(a.c.blocks.some((b) => isRed(b.kind))).toBe(false);
    const r = fight('rowan', [], { enemies: ['bandit', 'bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    r.c.stacks = 2;
    const plain = r.c.finisherDamage() * t.kits.wren.atk;
    expect(Math.abs(a.f.damage - plain * t.kits.wren.dropMult)).toBeLessThanOrEqual(2);
    // five links: the target takes the drop and five knives' worth, the other foe the knives alone
    const five = drop(5);
    const knives = Math.round((five.f.damage / t.kits.wren.dropMult) * t.kits.wren.dropLink * 5);
    expect(Math.abs(5000 - five.c.enemies[0].hp - (five.f.damage + knives))).toBeLessThanOrEqual(1);
    expect(Math.abs(5000 - five.c.enemies[1].hp - knives)).toBeLessThanOrEqual(1);
    expect(perks(five.ev, 'dropHit')).toHaveLength(2);
  });

  it('3 stars (Grapple): after a dodge her next hit crits; 5 stars (Roof Hop): the drop readies a dodge', () => {
    const { c } = fight('wren', [], { stars: 3, tune: (t) => (t.blocks.redTravelSec = 1) });
    c.perk.slip = 1;
    letRedThrough(c);
    tapNew(c, 'yellow', false);
    const ev = c.drainEvents();
    expect(lastHit(ev).crit).toBe(true);
    expect(perks(ev, 'grapple')).toHaveLength(1);
    tapNew(c, 'yellow', false);
    expect(lastHit(c.drainEvents()).crit).toBe(false);
    const f = fight('wren', [], { stars: 5 });
    f.c.stacks = 1;
    f.c.finisher();
    expect(f.c.perk.slip).toBe(1);
    const g = fight('wren', [], { stars: 4 });
    g.c.stacks = 1;
    g.c.finisher();
    expect(g.c.perk.slip ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------- Solenne's tree

describe("Solenne's tree", () => {
  it('Early Light: Sunrise comes every n combo', () => {
    const { on, off } = both('solenne', ['earlyLight']);
    const n = skillN(on.t, 'earlyLight');
    for (const { c } of [on, off]) comboTo(c, n);
    expect(on.c.perk.sunrise).toBeGreaterThan(0);
    expect(off.c.perk.sunrise ?? 0).toBe(0);
    expect(perks(on.c.drainEvents(), 'earlyLight')).toHaveLength(1);
  });

  it('Long Morning: Sunrise burns n s longer', () => {
    const { on, off } = both('solenne', ['longMorning']);
    for (const { c } of [on, off]) comboTo(c, sunEvery(c));
    expect(on.c.perk.sunrise - off.c.perk.sunrise).toBeCloseTo(skillN(on.t, 'longMorning'), 5);
    go(on.c, on.c.time + 0.05);
    expect(perks(on.c.drainEvents(), 'longMorning')).toHaveLength(1);
  });

  it('Solar Flare: as Sunrise lights, a flare hits every foe for n% attack (once per lighting)', () => {
    const { on, off } = both('solenne', ['solarFlare'], { enemies: ['bandit', 'bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    for (const { c } of [on, off]) comboTo(c, sunEvery(c) - 1);
    const hp = on.c.enemies[1].hp;
    for (const { c } of [on, off]) tapNew(c, 'yellow', false);
    const flare = Math.round((on.c.stats().atk * skillN(on.t, 'solarFlare')) / 100);
    const cut = (c: Combat) => perks(c.events, 'sunCut').reduce((a, e) => a + e.amount, 0);
    expect(hp - on.c.enemies[1].hp).toBe(flare + cut(on.c));
    expect(perks(on.c.drainEvents(), 'solarFlare')).toHaveLength(2);
    expect(perks(off.c.drainEvents(), 'solarFlare')).toHaveLength(0);
    // the next hits while it burns: no second flare
    tapNew(on.c, 'yellow', false);
    go(on.c, on.c.time + 0.05);
    expect(perks(on.c.drainEvents(), 'solarFlare')).toHaveLength(0);
  });

  it('Twin Gleam: a green gilds n yellows', () => {
    const { on, off } = both('solenne', ['twinGleam']);
    const ys = (c: Combat) => [0.7, 0.85, 0.95].map((p) => c.spawnBlock('yellow', p));
    const a = ys(on.c);
    const b = ys(off.c);
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    expect(a.filter(isGilded)).toHaveLength(skillN(on.t, 'twinGleam'));
    expect(b.filter(isGilded)).toHaveLength(1);
    expect(perks(on.c.drainEvents(), 'twinGleam')).toHaveLength(1);
  });

  it('Gilt Strike: gilded hits deal n% more (plain ones as usual)', () => {
    const { on, off } = both('solenne', ['giltStrike'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    const ahead = [on, off].map(({ c }) => c.spawnBlock('yellow', 0.85));
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    for (const [i, { c }] of [on, off].entries()) tapWhenThere(c, ahead[i], 25);
    const atk = on.c.stats().atk;
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(atk));
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(atk * (1 + skillN(on.t, 'giltStrike') / 100)));
    expect(perks(ev, 'giltStrike')).toHaveLength(1);
    tapNew(on.c, 'yellow', false);
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(atk));
  });

  it('Midas Touch: a Perfect on a gilded yellow gilds the next one (a Good hit does not)', () => {
    const run = (skills: string[], offMs: number) => {
      const { c } = fight('solenne', skills);
      const first = c.spawnBlock('yellow', 0.7);
      const next = c.spawnBlock('yellow', 0.9);
      tapNew(c, 'green', false);
      expect(isGilded(first)).toBe(true);
      tapWhenThere(c, first, offMs);
      return { next, ev: c.drainEvents() };
    };
    const on = run(['midasTouch'], 0);
    expect(isGilded(on.next)).toBe(true);
    expect(perks(on.ev, 'midasTouch')).toHaveLength(1);
    expect(isGilded(run([], 0).next)).toBe(false);
    expect(isGilded(run(['midasTouch'], 25).next)).toBe(false);
  });

  it('Firm Oath: Dawn Oath holds from n combo', () => {
    const { on, off } = both('solenne', ['firmOath'], { tune: (t) => (t.kits.solenne.hp = 400) });
    const n = skillN(on.t, 'firmOath');
    for (const { c } of [on, off]) {
      c.combo = n + 5;
      missNow(c);
    }
    expect(n + 5).toBeLessThan(on.t.kits.solenne.oathAt);
    expect(on.c.combo).toBe(Math.floor((n + 5) / 2));
    expect(off.c.combo).toBe(0);
    expect(perks(on.c.drainEvents(), 'firmOath')).toHaveLength(1);
  });

  it('Sun Ward: while Sunrise burns, reds that reach her deal n% less', () => {
    const lost = (skills: string[], burn: boolean) => {
      const { c } = fight('solenne', skills, { tune: (t) => ((t.blocks.redTravelSec = 1), (t.kits.solenne.hp = 400)) });
      if (burn) c.perk.sunrise = 5;
      letRedThrough(c);
      return { lost: c.maxHp() - c.hero.hp, ev: c.drainEvents() };
    };
    const base = lost([], true).lost;
    const on = lost(['sunWard'], true);
    expect(on.lost).toBe(Math.round(base * (1 - skillN(cloneTuning(), 'sunWard') / 100)));
    expect(perks(on.ev, 'sunWard')).toHaveLength(1);
    expect(lost(['sunWard'], false).lost).toBe(base);
  });

  it('Rekindle: a combo break lights Sunrise for n s', () => {
    const { on, off } = both('solenne', ['rekindle'], { tune: (t) => (t.kits.solenne.hp = 400) });
    for (const { c } of [on, off]) {
      c.combo = 12;
      missNow(c);
    }
    expect(on.c.perk.sunrise).toBeCloseTo(skillN(on.t, 'rekindle'), 5);
    expect(off.c.perk.sunrise ?? 0).toBe(0);
    expect(perks(on.c.drainEvents(), 'rekindle')).toHaveLength(1);
  });

  it('Rekindle: a short combo lost lights nothing (tapping wild earns no Sunrise)', () => {
    const { on } = both('solenne', ['rekindle'], { tune: (t) => (t.kits.solenne.hp = 400) });
    const at = on.t.kits.solenne.rekindleAt;
    const node = HERO_TREES.solenne.flatMap((b) => b.nodes).find((n) => n.id === 'rekindle');
    expect(node?.text).toContain(`${at}+`);
    expect(node?.after).toContain(`${at}+`);
    on.c.combo = at - 1;
    missNow(on.c);
    expect(on.c.perk.sunrise ?? 0).toBe(0);
    expect(perks(on.c.drainEvents(), 'rekindle')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- Wren's tree

describe("Wren's tree", () => {
  it('Nimble: the Chain survives n Good hits between Perfects', () => {
    const { on, off } = both('wren', ['nimble']);
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) tapNew(c, 'yellow', true);
      tapNew(c, 'yellow', false);
      tapNew(c, 'yellow', false);
    }
    expect(chainOf(on.c)).toBe(3);
    expect(chainOf(off.c)).toBe(0);
    expect(perks(on.c.drainEvents(), 'nimble')).toHaveLength(1);
  });

  it('Backstab: at full Chain, her hits deal n% more', () => {
    const { on, off } = both('wren', ['backstab'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    const full = Math.round(on.t.styles.chainMax);
    for (const { c } of [on, off]) {
      c.perk.chain = full;
      tapNew(c, 'yellow', false);
    }
    const base = on.c.stats().atk * (1 + on.t.styles.chainStep * full);
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(base));
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(base * (1 + skillN(on.t, 'backstab') / 100)));
    expect(perks(ev, 'backstab')).toHaveLength(1);
    on.c.perk.chain = full - 1;
    tapNew(on.c, 'yellow', false);
    expect(perks(on.c.drainEvents(), 'backstab')).toHaveLength(0);
  });

  it('Knife Storm: a Perfect at full Chain also hits every foe for n% attack', () => {
    const { on, off } = both('wren', ['knifeStorm'], { enemies: ['bandit', 'bandit'], tune: (t) => (t.enemies.bandit.hp = 900) });
    const full = Math.round(on.t.styles.chainMax);
    for (const { c } of [on, off]) {
      c.perk.chain = full;
      tapNew(c, 'yellow', true);
    }
    expect(900 - on.c.enemies[1].hp).toBe(Math.round((on.c.stats().atk * skillN(on.t, 'knifeStorm')) / 100));
    expect(off.c.enemies[1].hp).toBe(900);
    on.c.perk.chain = full - 1;
    const hp = on.c.enemies[1].hp;
    tapNew(on.c, 'yellow', true);
    expect(on.c.enemies[1].hp).toBe(hp);
  });

  it('Quick Slip: Slip readies after n Perfects in a row', () => {
    const { on, off } = both('wren', ['quickSlip']);
    const n = skillN(on.t, 'quickSlip');
    for (const { c } of [on, off]) for (let i = 0; i < n; i++) tapNew(c, 'yellow', true);
    expect(on.c.perk.slip).toBe(1);
    expect(off.c.perk.slip ?? 0).toBe(0);
    expect(perks(on.c.drainEvents(), 'quickSlip')).toHaveLength(1);
  });

  it("Tumble: a dodge hits the red's owner for n% attack", () => {
    const { on, off } = both('wren', ['tumble'], { enemies: ['bandit'], tune: (t) => ((t.blocks.redTravelSec = 1), (t.enemies.bandit.hp = 900)) });
    for (const { c } of [on, off]) {
      c.perk.slip = 1;
      letRedThrough(c);
    }
    expect(900 - on.c.enemies[0].hp).toBe(Math.round((on.c.stats().atk * skillN(on.t, 'tumble')) / 100));
    expect(off.c.enemies[0].hp).toBe(900);
    expect(perks(on.c.drainEvents(), 'tumble')).toHaveLength(1);
  });

  it('Untouchable: Slip holds up to n dodges', () => {
    const { on, off } = both('wren', ['untouchable'], { tune: (t) => ((t.blocks.redTravelSec = 1), (t.enemies.slime.hp = 900)) });
    const n = skillN(on.t, 'untouchable');
    for (const { c } of [on, off]) for (let i = 0; i < on.t.kits.wren.slipEvery * n; i++) tapNew(c, 'yellow', true);
    expect(on.c.perk.slip).toBe(n);
    expect(off.c.perk.slip).toBe(1);
    expect(perks(on.c.drainEvents(), 'untouchable').length).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) letRedThrough(on.c);
    expect(on.c.hero.hp).toBe(on.c.maxHp());
  });

  it('Long Haze: Smoke Pop lasts n s longer', () => {
    const { on, off } = both('wren', ['longHaze']);
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    expect(on.c.hero.abilityTimer - off.c.hero.abilityTimer).toBeCloseTo(skillN(on.t, 'longHaze'), 5);
    expect(perks(on.c.drainEvents(), 'longHaze')).toHaveLength(1);
  });

  it('Choking Smoke: reds in the smoke move n% slower (on the bar and coming in)', () => {
    const { on, off } = both('wren', ['chokingSmoke']);
    const ra = on.c.spawnBlock('red', 0.9);
    const rb = off.c.spawnBlock('red', 0.9);
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    expect(ra.chill).toBeGreaterThan(0);
    expect(ra.chillMult).toBeCloseTo(1 - skillN(on.t, 'chokingSmoke') / 100);
    expect(rb.chill).toBe(0);
    expect(on.c.spawnBlock('red', 0.95).chill).toBeGreaterThan(0);
    expect(perks(on.c.drainEvents(), 'chokingSmoke')).toHaveLength(1);
  });

  it('Blinding Smoke: a green blinds every foe (no reds) for n s', () => {
    const { on, off } = both('wren', ['blindingSmoke'], { enemies: ['bandit', 'slime'] });
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    for (const e of on.c.enemies) expect(e.stun).toBeCloseTo(skillN(on.t, 'blindingSmoke'), 5);
    for (const e of off.c.enemies) expect(e.stun).toBe(0);
    expect(perks(on.c.drainEvents(), 'blindingSmoke')).toHaveLength(1);
  });
});
