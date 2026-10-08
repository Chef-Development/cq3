// Part 6's Fizz (Bomber, Legendary: flasks in three brews) and Brann (Guardian, Epic: the bell monk): their kits as
// fight hooks (core/kit-fizz-brann.ts), each part with and without what it does.
import { describe, expect, it } from 'vitest';
import { HEROES } from '../../src/data/heroes';
import { Combat, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { kitText } from '../../src/core/heroes';
import { emptyLoadout } from '../../src/core/gear';
import { BREWS, brewOf, nextBrew, tollMax, tollOf } from '../../src/core/kit-fizz-brann';
import { guardOf } from '../../src/core/styles';
import type { HeroId } from '../../src/data/heroes';
import type { Tuning } from '../../src/core/tuning';
import { setup } from './helpers';

/** A test fight as `hero` (reds crawl unless the test speeds them up). */
function fight(hero: HeroId, o: { enemies?: string[]; stars?: number; tune?: (t: Tuning) => void; pets?: string[] } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills: [], stars: o.stars ?? 1, pets: o.pets?.map((id) => ({ id: id as never, level: 1, stars: 1 })) });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], seed: 42, spawning: false });
  c.advanceTo(0.5);
  c.drainEvents();
  return { c, t };
}

/** Step the fight to time t (advanceTo stops after 5 s a call). */
function go(c: Combat, t: number): void {
  for (let k = 0; k < 100 && c.time < t - 1e-9; k++) c.advanceTo(Math.min(t, c.time + 4));
}

/** Put a block under the cursor and tap it now: dead centre is a Perfect, a little off is not. */
function tapNew(c: Combat, kind: BlockKind, perfect = true, owner?: number): Block {
  const b = c.spawnBlock(kind, c.cursorPosAt(c.time) + (perfect ? 0 : 0.03), owner);
  c.tap(c.time);
  return b;
}

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
const atkOf = (t: Tuning, hero: 'fizz' | 'brann') => t.hero.atk * t.kits[hero].atk;

describe('Fizz and Brann as data', () => {
  it('Fizz is a Legendary Bomber, Brann an Epic Guardian; both come from hero chests with a meet scene; their texts fill in', () => {
    expect(HEROES.fizz).toMatchObject({ style: 'bomber', rarity: 'legendary', joins: 'chest', meetScene: 'meetFizz', art: 'fizz' });
    expect(HEROES.brann).toMatchObject({ style: 'guardian', rarity: 'epic', joins: 'chest', meetScene: 'meetBrann', art: 'brann' });
    const { t } = setup();
    for (const id of ['fizz', 'brann'] as const)
      for (const w of ['signature', 'ability', 'passive', 'finisher'] as const) {
        expect(kitText(t, id, w), `${id} ${w}`).not.toContain('{n}');
        expect(HEROES[id][w].short).not.toMatch(/\d/);
      }
    expect(kitText(t, 'fizz', 'passive')).toContain('50%');
    expect(kitText(t, 'brann', 'signature')).toContain('25%');
  });
});

describe("Fizz's kit", () => {
  it('Mixed Brew: her kegs are flasks that take the next brew in turn (fire, frost, spark, fire...)', () => {
    const { c } = fight('fizz');
    expect(nextBrew(c)).toBe('fire');
    const got = [0, 1, 2, 3, 4].map((i) => brewOf(c.spawnBlock('keg', 0.1 + i * 0.15))!);
    expect(got).toEqual(['fire', 'frost', 'spark', 'fire', 'frost']);
    // another hero's kegs are plain kegs
    const tam = fight('tam');
    expect(brewOf(tam.c.spawnBlock('keg', 0.4))).toBeUndefined();
  });

  it('a fire flask blasts every foe and sets them all burning: fireDps x attack a second for fireSec (ticked once a second)', () => {
    const { c, t } = fight('fizz', { enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 900) });
    const k = t.kits.fizz;
    tapNew(c, 'keg');
    const blast = Math.round(atkOf(t, 'fizz') * t.styles.kegMult);
    const ev = c.drainEvents();
    expect(perks(ev, 'fireBrew')).toEqual([expect.objectContaining({ amount: 2 })]);
    expect(900 - c.enemies[1].hp).toBe(blast);
    for (const e of c.enemies) expect(e.burn).toBeCloseTo(k.fireSec, 1);
    go(c, c.time + k.fireSec + 0.2);
    const ticks = perks(c.drainEvents(), 'brewBurn');
    expect(ticks).toHaveLength(Math.round(k.fireSec) * 2);
    expect(ticks[0].amount).toBe(Math.round(atkOf(t, 'fizz') * k.fireDps));
    for (const e of c.enemies) expect(e.burn).toBe(0);
    // without a flask nothing burns
    const plain = fight('fizz', { enemies: ['slime', 'slime'] });
    tapNew(plain.c, 'yellow');
    expect(plain.c.enemies.every((e) => e.burn === 0)).toBe(true);
  });

  it("with Newt along, his Ember Bite ticks the burns (not twice)", () => {
    const { c, t } = fight('fizz', { pets: ['newt'], tune: (t) => ((t.enemies.slime.hp = 900), (t.companion.everyHits = 0)) });
    tapNew(c, 'keg');
    c.drainEvents();
    go(c, c.time + t.kits.fizz.fireSec + 0.2);
    const ev = c.drainEvents();
    expect(perks(ev, 'brewBurn')).toHaveLength(0);
    expect(perks(ev, 'emberBite')).toHaveLength(Math.round(t.kits.fizz.fireSec));
  });

  it('a frost flask slows every red on the bar (frostMult for frostSec); a fire one does not', () => {
    for (const brew of ['frost', 'fire'] as const) {
      const { c, t } = fight('fizz');
      c.perk.brew = BREWS.indexOf(brew);
      const reds = [c.spawnBlock('red', 0.85), c.spawnBlock('red', 0.95)];
      tapNew(c, 'keg');
      for (const r of reds) {
        expect(r.chill > 0, brew).toBe(brew === 'frost');
        if (brew === 'frost') expect(r.chillMult).toBeCloseTo(t.kits.fizz.frostMult);
      }
      expect(perks(c.drainEvents(), 'frostBrew')).toHaveLength(brew === 'frost' ? 1 : 0);
    }
  });

  it('a spark flask blasts wider (a red past a plain blast is knocked off) and harder (x sparkMult)', () => {
    const run = (brew: 'spark' | 'fire') => {
      const { c, t } = fight('fizz', { enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 900) });
      c.perk.brew = BREWS.indexOf(brew);
      const at = c.cursorPosAt(c.time);
      const red = c.spawnBlock('red', at + t.styles.kegRadius * 1.3);
      tapNew(c, 'keg');
      return { gone: !c.blocks.includes(red), dmg: 900 - c.enemies[1].hp, t };
    };
    const spark = run('spark');
    const fire = run('fire');
    expect(spark.gone).toBe(true);
    expect(fire.gone).toBe(false);
    const blast = atkOf(spark.t, 'fizz') * spark.t.styles.kegMult;
    expect(fire.dmg).toBe(Math.round(blast));
    expect(spark.dmg).toBe(Math.round(Math.round(blast) * spark.t.kits.fizz.sparkMult));
  });

  it('Toss: a green hit throws the next flask at the target (x tossMult attack, with its brew); the bandolier moves on', () => {
    const { c, t } = fight('fizz', { enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 900) });
    tapNew(c, 'green', false);
    const ev = c.drainEvents();
    const toss = perks(ev, 'toss')[0];
    expect(toss).toMatchObject({ amount: Math.round(atkOf(t, 'fizz') * t.kits.fizz.tossMult), enemyId: c.enemies[0].id });
    expect(c.enemies[0].burn).toBeGreaterThan(0); // a fire flask: the target burns...
    expect(c.enemies[1].burn).toBe(0); // ...alone
    expect(nextBrew(c)).toBe('frost');
    // a yellow throws nothing
    tapNew(c, 'yellow', false);
    expect(perks(c.drainEvents(), 'toss')).toHaveLength(0);
    expect(nextBrew(c)).toBe('frost');
  });

  it('Fume Mask: traps hurt her fumeMask less (Tam takes the full hit)', () => {
    const hurt = (hero: HeroId) => {
      const { c } = fight(hero, { tune: (t) => (t.enemies.slime.special = 20) });
      c.drainEvents();
      tapNew(c, 'purple');
      return evs(c.drainEvents(), 'heroHurt')[0]?.damage ?? 0;
    };
    const { t } = setup();
    expect(hurt('tam')).toBe(20);
    expect(hurt('fizz')).toBe(Math.round(20 * (1 - t.kits.fizz.fumeMask)));
  });

  it('Grand Reaction: hits every foe, sets off every flask on the bar (each with its brew), then two new flasks land', () => {
    const { c, t } = fight('fizz', { enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 5000) });
    const fire = c.spawnBlock('keg', 0.2);
    const frost = c.spawnBlock('keg', 0.5);
    expect([brewOf(fire), brewOf(frost)]).toEqual(['fire', 'frost']);
    c.stacks = 1;
    c.finisher();
    const ev = c.drainEvents();
    expect(evs(ev, 'explode').filter((e) => e.own)).toHaveLength(2);
    expect(c.enemies.every((e) => e.burn > 0)).toBe(true);
    const kegs = c.blocks.filter((b) => b.kind === 'keg');
    expect(kegs).toHaveLength(Math.round(t.kits.fizz.bangFlasks));
    expect(kegs.includes(fire) || kegs.includes(frost)).toBe(false);
    expect(perks(ev, 'grandReaction')).toEqual([expect.objectContaining({ amount: 2 + kegs.length })]);
    // 5 stars: a flask of every brew lands
    const five = fight('fizz', { stars: 5 });
    five.c.stacks = 1;
    five.c.finisher();
    expect(five.c.blocks.filter((b) => b.kind === 'keg').map((b) => brewOf(b)).sort()).toEqual(['fire', 'frost', 'spark']);
  });

  it('Potent Brews (3 stars): fire burns half again as hot', () => {
    for (const stars of [1, 3]) {
      const { c, t } = fight('fizz', { stars, tune: (t) => (t.enemies.slime.hp = 900) });
      tapNew(c, 'keg');
      expect(c.enemies[0].burnDps, `${stars} stars`).toBeCloseTo(c.stats().atk * t.kits.fizz.fireDps * (stars >= 3 ? t.kits.fizz.potent : 1), 5);
    }
  });
});

describe("Brann's kit", () => {
  it('Toll: every block rings the bell (up to 3); his next hit deals +tollPer per toll and spends them', () => {
    const { c, t } = fight('brann', { tune: (t) => (t.enemies.slime.hp = 900) });
    for (let i = 0; i < 4; i++) tapNew(c, 'red', false);
    expect(tollOf(c)).toBe(3);
    expect(tollMax(c)).toBe(3);
    const hp = c.enemies[0].hp;
    tapNew(c, 'yellow', false);
    expect(hp - c.enemies[0].hp).toBe(Math.round(atkOf(t, 'brann') * (1 + 3 * t.kits.brann.tollPer)));
    expect(tollOf(c)).toBe(0);
    expect(perks(c.drainEvents(), 'tollHit')).toEqual([expect.objectContaining({ amount: 3 })]);
    // with no tolls rung, a plain hit
    const h2 = c.enemies[0].hp;
    tapNew(c, 'yellow', false);
    expect(h2 - c.enemies[0].hp).toBe(Math.round(atkOf(t, 'brann')));
  });

  it('Deep Toll (3 stars): the bell holds 5 tolls', () => {
    const { c } = fight('brann', { stars: 3 });
    for (let i = 0; i < 6; i++) tapNew(c, 'red', false);
    expect(tollOf(c)).toBe(5);
  });

  it("Peal: after a green hit, a blocked red's blow echoes (pealShare of it) at every foe; outside it, no echo", () => {
    const { c, t } = fight('brann', { enemies: ['slime', 'slime'], tune: (t) => ((t.enemies.slime.hp = 900), (t.enemies.slime.atk = 40)) });
    tapNew(c, 'red', false, c.enemies[0].id);
    expect(perks(c.drainEvents(), 'peal')).toHaveLength(0);
    tapNew(c, 'green', false);
    c.drainEvents();
    const before = c.enemies.map((e) => e.hp);
    tapNew(c, 'red', false, c.enemies[0].id);
    const ev = c.drainEvents();
    const echo = Math.round(40 * t.kits.brann.pealShare);
    expect(perks(ev, 'peal').map((e) => e.amount)).toEqual([echo, echo]);
    expect(c.enemies.map((e, i) => before[i] - e.hp)).toEqual([echo, echo]);
  });

  it('Still Mind: a Perfect block stores stillMind more Guard (a plain block 1)', () => {
    const { c, t } = fight('brann');
    tapNew(c, 'red', false);
    expect(guardOf(c)).toBe(1);
    tapNew(c, 'red', true);
    expect(guardOf(c)).toBe(2 + t.kits.brann.stillMind);
    expect(perks(c.drainEvents(), 'stillMind')).toHaveLength(1);
  });

  it('Great Bell: the target alone, with all the Guard (x(1 + Guard x guardPer x bellGuard)); every foe is stunned', () => {
    const { c, t } = fight('brann', { enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 5000) });
    c.perk.guard = 3;
    c.stacks = 1;
    const base = c.finisherDamage();
    c.finisher();
    const k = t.kits.brann;
    expect(5000 - c.enemies[0].hp).toBe(Math.round(base * (1 + 3 * t.styles.guardPer * k.bellGuard)));
    expect(c.enemies[1].hp).toBe(5000);
    expect(guardOf(c)).toBe(0);
    for (const e of c.enemies) expect(e.stun).toBeCloseTo(k.bellStun, 1);
    // stunned foes send nothing (their spawn clocks wait)
    expect(perks(c.drainEvents(), 'greatBell')).toHaveLength(1);
    // 5 stars: the others take half the blow
    const five = fight('brann', { stars: 5, enemies: ['slime', 'slime'], tune: (t) => (t.enemies.slime.hp = 5000) });
    five.c.stacks = 1;
    five.c.finisher();
    const hit = 5000 - five.c.enemies[0].hp;
    expect(5000 - five.c.enemies[1].hp).toBe(Math.round(hit * five.t.kits.brann.echo5));
  });

  it('soft strengths: Brann takes 20% less from Casters; Fizz deals 20% more to Frost foes', () => {
    const { t } = setup();
    expect(HEROES.brann.strengths).toEqual([{ tag: 'caster', kind: 'guard', n: 0.2 }]);
    expect(HEROES.fizz.strengths).toEqual([{ tag: 'frost', kind: 'dmg', n: 0.2 }]);
    expect(t.enemies.shaman.tags).toContain('caster');
  });
});
