// Part 6's Yara (Summoner, Mythic) and Dell (Marksman, Rare): their kits (core/kit-fx.ts, the spirits in
// core/styles.ts), a with/without test for every rule node and capstone of their trees (core/skill-fx-heroes.ts),
// their chests and tips. The helpers are hero-skills.test.ts's.
import { describe, expect, it } from 'vitest';
import { HEROES, HERO_IDS, type HeroId } from '../../src/data/heroes';
import { TIPS } from '../../src/data/tips';
import { STORY } from '../../src/data/story';
import { MASTERY } from '../../src/data/meta';
import { Combat, isRed, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { kitText, skillN } from '../../src/core/heroes';
import { KIT_HOOKS, stagOut } from '../../src/core/kit-fx';
import { CHEST_HEROES, rollChest } from '../../src/core/chests';
import { newProfile } from '../../src/core/profile';
import { Rng } from '../../src/core/rng';
import { allyPower, callAlly, focusCap, focusOf } from '../../src/core/styles';
import { cloneTuning, type Tuning } from '../../src/core/tuning';
import { setup } from './helpers';

// ---------------------------------------------------------------- helpers (as hero-skills.test.ts)

/** A fight as `hero` knowing `skills`, the cursor mid-bar moving right (no spawns, no crits; reds crawl unless the
 *  test speeds them up: t.blocks.redTravelSec). */
function fight(hero: HeroId, skills: string[], o: { enemies?: string[]; tune?: (t: Tuning) => void; stars?: number } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills, stars: o.stars ?? 1 });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], seed: 42, spawning: false });
  c.drainEvents();
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

/** A red that reaches the hero now (it starts at the left end; reds must be moving). */
function letRedThrough(c: Combat): void {
  c.spawnBlock('red', 0.05);
  go(c, c.time + 0.5);
}

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
const acts = (events: CombatEvent[], kind: string) => evs(events, 'ally').filter((e) => e.kind === kind && e.action === 'act').length;
const kinds = (c: Combat, kind: BlockKind) => c.blocks.filter((b) => b.kind === kind);
/** Damage dealt to each foe since the last drain, by perk id. */
const hurtBy = (events: CombatEvent[], perk: string) => evs(events, 'enemyHurt').filter((e) => e.perk === perk);

// ---------------------------------------------------------------- Yara's kit

describe('Yara: spirits, Kinship, Spirit Stampede, the Great Spirit', () => {
  it('is a Mythic Summoner from hero chests, with a gift; her texts fill in', () => {
    const t = cloneTuning();
    const y = HEROES.yara;
    expect([y.style, y.rarity, y.joins, y.meetScene]).toEqual(['summoner', 'mythic', 'chest', 'meetYara']);
    expect(y.gift?.name).toBe('Great Spirit');
    expect(y.allies).toEqual(['spiritWolf', 'spiritTortoise', 'wispSwarm']);
    for (const w of ['signature', 'ability', 'passive', 'finisher'] as const) expect(kitText(t, 'yara', w)).not.toContain('{n}');
    expect(kitText(t, 'yara', 'passive')).toContain(`${Math.round(t.kits.yara.kinship * 100)}%`);
    expect(HERO_IDS).toContain('yara');
  });

  it('green hits call the spirits in order (Wolf, Tortoise, Wisps); a call with all three out is a Rally', () => {
    const { c } = fight('yara', [], { tune: (t) => (t.kits.yara.allySec = 30) });
    tapNew(c, 'green', false);
    expect(c.allies.map((a) => a.kind)).toEqual(['spiritWolf']);
    tapNew(c, 'green', false);
    tapNew(c, 'green', false);
    expect(c.allies.map((a) => a.kind)).toEqual(['spiritWolf', 'spiritTortoise', 'wispSwarm']);
    c.drainEvents();
    tapNew(c, 'green', false);
    const ev = c.drainEvents();
    expect(perks(ev, 'rally')).toHaveLength(1);
    expect(c.perk.rallies).toBe(1);
    expect(c.allies).toHaveLength(3);
  });

  it('the Wolf bites the target (its share of attack, first at half its time, then every wolfEvery s)', () => {
    const { c, t } = fight('yara', [], { enemies: ['bandit'], tune: (t) => ((t.kits.yara.allySec = 30), (t.enemies.bandit.hp = 5000)) });
    callAlly(c);
    c.drainEvents();
    go(c, c.time + t.kits.yara.wolfEvery * 0.5 + 0.02);
    const ev = c.drainEvents();
    const bite = Math.round(c.stats().atk * t.kits.yara.wolfDmg);
    expect(hurtBy(ev, 'spiritWolf').map((e) => e.damage)).toEqual([bite]);
    go(c, c.time + t.kits.yara.wolfEvery);
    expect(acts(c.drainEvents(), 'spiritWolf')).toBe(1);
    expect(allyPower(c)).toBe(1);
  });

  it("the Tortoise's shell comes up after shellFirst s and stops the next red that reaches her; then it rests (3 stars: two reds)", () => {
    for (const stars of [1, 3]) {
      const { c, t } = fight('yara', [], { stars, tune: (t) => ((t.kits.yara.allySec = 60), (t.blocks.redTravelSec = 1)) });
      callAlly(c);
      callAlly(c);
      const shell = c.allies.find((a) => a.kind === 'spiritTortoise')!;
      expect(shell.braced).toBe(false);
      go(c, c.time + t.kits.yara.shellFirst + 0.02);
      expect(shell.braced).toBe(true);
      const hp = c.hero.hp;
      letRedThrough(c);
      expect(c.hero.hp, `${stars}`).toBe(hp);
      expect(perks(c.drainEvents(), 'spiritTortoise')).toHaveLength(1);
      expect(shell.braced).toBe(stars >= 3);
      if (stars >= 3) {
        letRedThrough(c);
        expect(c.hero.hp).toBe(hp);
        expect(shell.braced).toBe(false);
      }
      letRedThrough(c);
      expect(c.hero.hp).toBeLessThan(hp);
      expect(shell.timer).toBeGreaterThan(t.kits.yara.shellRest - 1);
    }
  });

  it("a Tortoise called after one rested off keeps its rest (a new call doesn't skip it); with no rest left, shellFirst s", () => {
    const { c, t } = fight('yara', [], { tune: (t) => ((t.kits.yara.allySec = 6), (t.blocks.redTravelSec = 1)) });
    callAlly(c);
    callAlly(c);
    go(c, c.time + t.kits.yara.shellFirst + 0.02);
    letRedThrough(c);
    const blockedAt = c.time;
    go(c, c.time + 8); // the spirits leave (6 s)
    expect(c.allies).toHaveLength(0);
    callAlly(c);
    callAlly(c);
    const again = c.allies.find((a) => a.kind === 'spiritTortoise')!;
    const since = c.time - blockedAt; // (the red reached her within the last 0.5 s before blockedAt)
    expect(again.timer).toBeGreaterThan(t.kits.yara.shellRest - since - 0.5);
    expect(again.timer).toBeLessThanOrEqual(t.kits.yara.shellRest - since);
    // ...and once the rest is over, a new one comes up shellFirst s after it's called
    go(c, blockedAt + t.kits.yara.shellRest + 1);
    c.allies.length = 0;
    callAlly(c);
    callAlly(c);
    expect(c.allies.find((a) => a.kind === 'spiritTortoise')!.timer).toBe(t.kits.yara.shellFirst);
  });

  it('the Wisps fill the meter a little every wispEvery s, and never heal', () => {
    const { c, t } = fight('yara', [], { tune: (t) => (t.kits.yara.allySec = 30) });
    for (let i = 0; i < 3; i++) callAlly(c);
    c.allies.find((a) => a.kind === 'spiritWolf')!.timer = 99;
    c.hero.hp = 30;
    c.drainEvents();
    go(c, c.time + t.kits.yara.wispEvery * 0.5 + 0.02);
    expect(c.meter).toBeCloseTo(t.meter.perHit * t.kits.yara.wispMeter, 5);
    expect(c.hero.hp).toBe(30);
    expect(perks(c.drainEvents(), 'wispSwarm')).toHaveLength(1);
  });

  it('Kinship: each spirit out adds crit chance (no spirits: none)', () => {
    const { c, t } = fight('yara', [], { tune: (t) => (t.kits.yara.allySec = 30) });
    const crit = (n: number) => {
      while (c.allies.length < n) callAlly(c);
      const b = c.spawnBlock('yellow', 0.9);
      return KIT_HOOKS.yara.critChance!(c, { block: b, perfect: false, green: false, target: c.enemies[0], crit: false, damage: 0, echo: false }, 0);
    };
    expect(crit(0)).toBe(0);
    expect(crit(1)).toBeCloseTo(t.kits.yara.kinship);
    expect(crit(3)).toBeCloseTo(t.kits.yara.kinship * 3);
    // a crit with spirits out names it
    c.hero.bonusCrit = 1;
    tapNew(c, 'yellow', false);
    expect(perks(c.drainEvents(), 'kinship')).toHaveLength(1);
  });

  it('Spirit Stampede: hits every foe, more per spirit out; the reds and the traps go', () => {
    const dmg = (n: number) => {
      const { c } = fight('yara', [], { enemies: ['bandit', 'bandit'], tune: (t) => ((t.kits.yara.allySec = 30), (t.enemies.bandit.hp = 5000)) });
      for (let i = 0; i < n; i++) callAlly(c);
      for (const a of c.allies) a.timer = 99;
      c.spawnBlock('red', 0.85);
      c.spawnBlock('purple', 0.3);
      c.spawnBlock('yellow', 0.6);
      c.stacks = 2;
      c.drainEvents();
      c.finisher();
      const ev = c.drainEvents();
      expect(c.blocks.filter((b) => isRed(b.kind) || b.kind === 'purple')).toHaveLength(0);
      expect(kinds(c, 'yellow')).toHaveLength(1);
      expect(perks(ev, 'spiritStampede')).toEqual([expect.objectContaining({ amount: 1 })]);
      return evs(ev, 'finisher')[0];
    };
    const zero = dmg(0);
    const three = dmg(3);
    const t = cloneTuning();
    expect(three.targets).toHaveLength(2);
    expect(Math.abs(three.damage - zero.damage * (1 + 3 * t.kits.yara.stampede))).toBeLessThanOrEqual(1);
  });

  it('Great Spirit: a Rally calls the stag, which strikes every foe every stagEvery s for stagSec, then goes (5 stars: twice as long)', () => {
    for (const stars of [1, 5]) {
      const { c, t } = fight('yara', [], { stars, enemies: ['bandit', 'bandit'], tune: (t) => ((t.kits.yara.allySec = 60), (t.enemies.bandit.hp = 50000)) });
      for (let i = 0; i < 3; i++) callAlly(c);
      for (const a of c.allies) a.timer = 999;
      c.drainEvents();
      expect(stagOut(c)).toBe(false);
      tapNew(c, 'green', false); // a Rally
      const ev = c.drainEvents();
      expect(evs(ev, 'ally').filter((e) => e.kind === 'spiritStag' && e.action === 'call')).toHaveLength(1);
      expect(perks(ev, 'greatSpirit')).toHaveLength(1);
      expect(stagOut(c)).toBe(true);
      for (const a of c.allies) a.timer = 999;
      const sec = t.kits.yara.stagSec * (stars >= 5 ? 2 : 1);
      go(c, c.time + sec - 0.05);
      const mid = c.drainEvents();
      const strikes = Math.floor((sec - Math.min(0.3, t.kits.yara.stagEvery)) / t.kits.yara.stagEvery) + 1;
      expect(acts(mid, 'spiritStag'), `${stars}`).toBe(strikes);
      // every foe, each time
      expect(hurtBy(mid, 'spiritStag')).toHaveLength(strikes * 2);
      expect(hurtBy(mid, 'spiritStag')[0].damage).toBe(Math.round(c.stats().atk * t.kits.yara.stagDmg));
      go(c, c.time + 0.2);
      expect(evs(c.drainEvents(), 'ally').some((e) => e.kind === 'spiritStag' && e.action === 'leave')).toBe(true);
      expect(stagOut(c)).toBe(false);
    }
    // no Rally, no stag
    const { c } = fight('yara', []);
    tapNew(c, 'green', false);
    go(c, c.time + 2);
    expect(evs(c.drainEvents(), 'ally').some((e) => e.kind === 'spiritStag')).toBe(false);
  });

  it("is a Summoner like Moss: her spirits are never Moss's allies, and Moss still calls his own", () => {
    const { c } = fight('moss', []);
    for (let i = 0; i < 3; i++) callAlly(c);
    expect(c.allies.map((a) => a.kind)).toEqual(['thornling', 'barkback', 'glowmoth']);
  });
});

// ---------------------------------------------------------------- Dell's kit

describe('Dell: Lucky Shot, Ricochet, Pocketful, Pebble Storm', () => {
  it('is a Rare Marksman from hero chests; his texts fill in', () => {
    const t = cloneTuning();
    const d = HEROES.dell;
    expect([d.style, d.rarity, d.joins, d.meetScene, d.gift]).toEqual(['marksman', 'rare', 'chest', 'meetDell', undefined]);
    for (const w of ['signature', 'ability', 'passive', 'finisher'] as const) expect(kitText(t, 'dell', w)).not.toContain('{n}');
    expect(kitText(t, 'dell', 'signature')).toContain(`${Math.round(t.kits.dell.ricochet * 100)}%`);
  });

  it('Lucky Shot: a Perfect green crits and so does its Power Shot (a plain green: no crit)', () => {
    for (const perfect of [true, false]) {
      const { c } = fight('dell', [], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
      c.perk.focus = 50;
      tapNew(c, 'green', perfect);
      const ev = c.drainEvents();
      expect(evs(ev, 'hit').at(-1)!.crit, `${perfect}`).toBe(perfect);
      expect(hurtBy(ev, 'powerShot')[0].crit, `${perfect}`).toBe(perfect);
      expect(perks(ev, 'luckyShot')).toHaveLength(perfect ? 1 : 0);
    }
  });

  it('Ricochet: the Power Shot bounces to the weakest other foe for its share (one foe: no bounce; 3 stars: one more)', () => {
    const run = (stars: number, enemies: string[]) => {
      const { c } = fight('dell', [], { stars, enemies, tune: (t) => ((t.enemies.bandit.hp = 5000), (t.enemies.slime.hp = 3000)) });
      c.perk.focus = 100;
      tapNew(c, 'green', false);
      return { c, ev: c.drainEvents() };
    };
    const t = cloneTuning();
    const { c, ev } = run(1, ['bandit', 'bandit', 'slime']);
    const shot = perks(ev, 'powerShot')[0];
    const bounce = perks(ev, 'ricochetShot');
    expect(bounce).toHaveLength(1);
    expect(c.enemyById(bounce[0].enemyId)!.key).toBe('slime'); // the weakest
    expect(bounce[0].amount).toBe(Math.round(shot.amount * t.kits.dell.ricochet));
    expect(perks(run(1, ['bandit']).ev, 'ricochetShot')).toHaveLength(0);
    expect(perks(run(3, ['bandit', 'bandit', 'slime']).ev, 'ricochetShot')).toHaveLength(2);
    // (a plain hit fires no shot: no bounce)
    const p = fight('dell', [], { enemies: ['bandit', 'slime'] });
    tapNew(p.c, 'yellow', true);
    expect(perks(p.c.drainEvents(), 'ricochetShot')).toHaveLength(0);
  });

  it("Pocketful: a miss keeps the meter's fill (the combo and the stacks still go); Rowan's empties", () => {
    for (const hero of ['dell', 'rowan'] as const) {
      const { c } = fight(hero, []);
      c.perk.resolve = 1;
      c.combo = 12;
      c.stacks = 1;
      c.meter = 0.4;
      c.tap(c.time); // nothing there: a miss
      expect(c.combo, hero).toBe(0);
      expect(c.stacks, hero).toBe(0);
      expect(c.meter, hero).toBeCloseTo(hero === 'dell' ? 0.4 : 0);
      expect(perks(c.drainEvents(), 'pocketful')).toHaveLength(hero === 'dell' ? 1 : 0);
    }
    // a hit taken still empties it
    const { c } = fight('dell', [], { tune: (t) => (t.blocks.redTravelSec = 1) });
    c.meter = 0.4;
    letRedThrough(c);
    expect(c.meter).toBe(0);
  });

  it('Pebble Storm: hits every foe; the reds stay on the bar and are knocked back, one knocked past the far end goes off it (an icicle shatters)', () => {
    const { c, t } = fight('dell', [], { enemies: ['bandit', 'bandit'], tune: (t) => ((t.enemies.bandit.hp = 5000), (t.kits.dell.stormKnock = 0.3)) });
    const a = c.spawnBlock('red', 0.3);
    const b = c.spawnBlock('red', 0.5);
    const far = c.spawnBlock('red', 0.8);
    const ice = c.spawnBlock('red', 0.2);
    ice.still = true;
    c.stacks = 1;
    c.finisher();
    const ev = c.drainEvents();
    expect(evs(ev, 'finisher')[0].targets).toHaveLength(2);
    expect(c.blocks.includes(a) && c.blocks.includes(b)).toBe(true);
    expect(c.blocks.includes(far)).toBe(false);
    expect(c.blocks.includes(ice)).toBe(false);
    expect(a.push).toBeCloseTo(t.kits.dell.stormKnock);
    expect(b.push).toBeCloseTo(t.kits.dell.stormKnock);
    expect(perks(ev, 'pebbleStorm')).toEqual([expect.objectContaining({ amount: 4 })]);
  });

  it('5 stars: a Lucky Shot stuns its foe (a plain green, or fewer stars: no)', () => {
    for (const [stars, perfect, want] of [
      [5, true, true],
      [5, false, false],
      [1, true, false],
    ] as const) {
      const { c } = fight('dell', [], { stars, enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
      c.perk.focus = 50;
      tapNew(c, 'green', perfect);
      expect(c.enemies[0].stun > 0, `${stars} ${perfect}`).toBe(want);
    }
  });
});

// ---------------------------------------------------------------- Yara's tree

describe("Yara's tree", () => {
  const long = (t: Tuning) => ((t.kits.yara.allySec = 60), (t.enemies.bandit.hp = 50000), (t.enemies.slime.hp = 50000));

  it('Long Fang: Wolf bites hit n% harder', () => {
    const { on, off } = both('yara', ['longFang'], { enemies: ['bandit'], tune: long });
    const bite = (c: Combat) => {
      callAlly(c);
      go(c, c.time + c.tuning.kits.yara.wolfEvery * 0.5 + 0.02);
      return hurtBy(c.drainEvents(), 'spiritWolf')[0].damage;
    };
    const base = bite(off.c);
    expect(bite(on.c)).toBe(Math.round(on.c.stats().atk * on.t.kits.yara.wolfDmg * (1 + skillN(on.t, 'longFang') / 100)));
    expect(base).toBe(Math.round(off.c.stats().atk * off.t.kits.yara.wolfDmg));
    go(on.c, on.c.time + on.t.kits.yara.wolfEvery);
    expect(perks(on.c.drainEvents(), 'longFang')).toHaveLength(1);
  });

  it('Twin Bite: a wolf bite also hits another foe for n% (one foe alone: nothing more)', () => {
    const { on, off } = both('yara', ['twinBite'], { enemies: ['bandit', 'slime'], tune: long });
    for (const { c } of [on, off]) {
      callAlly(c);
      go(c, c.time + c.tuning.kits.yara.wolfEvery * 0.5 + 0.05);
    }
    const bite = on.c.stats().atk * on.t.kits.yara.wolfDmg;
    expect(hurtBy(on.c.drainEvents(), 'twinBite').map((e) => e.damage)).toEqual([Math.round((bite * skillN(on.t, 'twinBite')) / 100)]);
    expect(hurtBy(off.c.drainEvents(), 'twinBite')).toHaveLength(0);
  });

  it('Hunting Call: every n-th Perfect hit sends the Wolf in to bite at once', () => {
    const { on, off } = both('yara', ['huntingCall'], { enemies: ['bandit'], tune: long });
    const n = skillN(on.t, 'huntingCall');
    for (const { c } of [on, off]) {
      callAlly(c);
      c.allies[0].timer = 99;
      c.drainEvents();
      for (let i = 0; i < n; i++) tapNew(c, 'yellow', true);
    }
    expect(acts(on.c.drainEvents(), 'spiritWolf')).toBe(1);
    expect(acts(off.c.drainEvents(), 'spiritWolf')).toBe(0);
    expect(on.c.allies[0].timer).toBeCloseTo(on.t.kits.yara.wolfEvery, 1);
  });

  it('Quick Shell: the shell comes up n% sooner', () => {
    const { on, off } = both('yara', ['quickShell'], { tune: long });
    const first = on.t.kits.yara.shellFirst;
    const quick = first / (1 + skillN(on.t, 'quickShell') / 100);
    for (const { c } of [on, off]) {
      callAlly(c);
      callAlly(c);
      go(c, c.time + (quick + first) / 2);
    }
    expect(on.c.allies.find((a) => a.kind === 'spiritTortoise')!.braced).toBe(true);
    expect(off.c.allies.find((a) => a.kind === 'spiritTortoise')!.braced).toBe(false);
  });

  it("Spiked Shell: a shell block hits the red's owner for n% attack", () => {
    const { on, off } = both('yara', ['spikedShell'], { enemies: ['slime', 'bandit'], tune: (t) => (long(t), (t.blocks.redTravelSec = 1)) });
    for (const { c } of [on, off]) {
      callAlly(c);
      callAlly(c);
      for (const a of c.allies) a.timer = 99;
      c.allies.find((a) => a.kind === 'spiritTortoise')!.braced = true;
      c.drainEvents();
      c.spawnBlock('red', 0.05, c.enemies[1].id);
      go(c, c.time + 0.5);
    }
    const dmg = Math.round((on.c.stats().atk * skillN(on.t, 'spikedShell')) / 100);
    expect(hurtBy(on.c.drainEvents(), 'spikedShell')).toEqual([expect.objectContaining({ enemyId: on.c.enemies[1].id, damage: dmg })]);
    expect(hurtBy(off.c.drainEvents(), 'spikedShell')).toHaveLength(0);
  });

  it('Stone Ward: with the shell up, a Perfect block hits every foe for n% (shell down, or a plain block: no)', () => {
    for (const [skills, up, perfect, want] of [
      [['stoneWard'], true, true, true],
      [['stoneWard'], false, true, false],
      [['stoneWard'], true, false, false],
      [[], true, true, false],
    ] as const) {
      const { c, t } = fight('yara', [...skills], { enemies: ['bandit', 'bandit'], tune: long });
      callAlly(c);
      callAlly(c);
      for (const a of c.allies) a.timer = 99;
      c.allies.find((a) => a.kind === 'spiritTortoise')!.braced = up;
      c.drainEvents();
      tapNew(c, 'red', perfect);
      const hits = hurtBy(c.drainEvents(), 'stoneWard');
      expect(hits.length, `${skills} ${up} ${perfect}`).toBe(want ? 2 : 0);
      if (want) expect(hits[0].damage).toBe(Math.round((c.stats().atk * skillN(t, 'stoneWard')) / 100));
    }
  });

  it('Bright Wisps: the Wisps fill n% more meter', () => {
    const { on, off } = both('yara', ['brightWisps'], { tune: long });
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) callAlly(c);
      c.allies[0].timer = 99;
      go(c, c.time + c.tuning.kits.yara.wispEvery * 0.5 + 0.02);
    }
    const fill = on.t.meter.perHit * on.t.kits.yara.wispMeter;
    expect(off.c.meter).toBeCloseTo(fill, 5);
    expect(on.c.meter).toBeCloseTo(fill * (1 + skillN(on.t, 'brightWisps') / 100), 5);
    expect(perks(on.c.drainEvents(), 'brightWisps')).toHaveLength(1);
  });

  it('Long Bond: spirits stay n s longer (called, and rallied)', () => {
    const { on, off } = both('yara', ['longBond'], { tune: (t) => ((t.kits.yara.allySec = 5), (t.enemies.slime.hp = 50000)) });
    for (const { c } of [on, off]) {
      callAlly(c);
      go(c, c.time + 5.2);
    }
    expect(off.c.allies).toHaveLength(0);
    expect(on.c.allies).toHaveLength(1);
    go(on.c, on.c.time + skillN(on.t, 'longBond'));
    expect(on.c.allies).toHaveLength(0);
    expect(perks(on.c.drainEvents(), 'longBond')).toHaveLength(1);
  });

  it('Thunderhoof: each Great Spirit strike knocks every red back n% of the bar', () => {
    const { on, off } = both('yara', ['thunderhoof'], { enemies: ['bandit'], tune: long });
    const reds: Block[] = [];
    for (const { c } of [on, off]) {
      for (let i = 0; i < 3; i++) callAlly(c);
      for (const a of c.allies) a.timer = 999;
      tapNew(c, 'green', false); // a Rally: the stag comes
      for (const a of c.allies) a.timer = 999;
      reds.push(c.spawnBlock('red', 0.5));
      go(c, c.time + 0.4); // its first strike
    }
    // (knocked back: where it is plus the push still to go)
    expect(reds[0].pos + reds[0].push).toBeCloseTo(0.5 + skillN(on.t, 'thunderhoof') / 100, 2);
    expect(reds[1].push).toBe(0);
    expect(perks(on.c.drainEvents(), 'thunderhoof')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- Dell's tree

describe("Dell's tree", () => {
  const tough = (t: Tuning) => ((t.enemies.bandit.hp = 50000), (t.enemies.slime.hp = 30000));
  const shoot = (c: Combat, perfect = false, focus = 100) => {
    c.perk.focus = focus;
    c.drainEvents();
    tapNew(c, 'green', perfect);
    return c.drainEvents();
  };

  it('Hard Bounce: Ricochet bounces for n% of the shot (not its share)', () => {
    const { on, off } = both('dell', ['hardBounce'], { enemies: ['bandit', 'slime'], tune: tough });
    const a = shoot(on.c);
    const b = shoot(off.c);
    const shot = perks(a, 'powerShot')[0].amount;
    expect(perks(a, 'ricochetShot')[0].amount).toBe(Math.round((shot * skillN(on.t, 'hardBounce')) / 100));
    expect(perks(b, 'ricochetShot')[0].amount).toBe(Math.round(shot * off.t.kits.dell.ricochet));
    expect(perks(a, 'hardBounce')).toHaveLength(1);
  });

  it("Lucky Bounce: a crit shot's bounces crit too", () => {
    const { on, off } = both('dell', ['luckyBounce'], { enemies: ['bandit', 'slime'], tune: tough });
    expect(hurtBy(shoot(on.c, true), 'ricochetShot')[0].crit).toBe(true);
    expect(hurtBy(shoot(off.c, true), 'ricochetShot')[0].crit).toBe(false);
    // a plain shot's bounce never crits
    expect(hurtBy(shoot(on.c, false), 'ricochetShot')[0].crit).toBe(false);
  });

  it('Pinball: Ricochet bounces on to every other foe', () => {
    const { on, off } = both('dell', ['pinball'], { enemies: ['bandit', 'slime', 'slime', 'bandit'], tune: tough });
    expect(perks(shoot(on.c), 'ricochetShot')).toHaveLength(3);
    expect(perks(shoot(off.c), 'ricochetShot')).toHaveLength(1);
  });

  it('Full Pouch: Focus holds n% more', () => {
    const { on, off } = both('dell', ['fullPouch'], { enemies: ['bandit'], tune: tough });
    expect(focusCap(on.c)).toBeCloseTo(focusCap(off.c) * (1 + skillN(on.t, 'fullPouch') / 100));
    for (const { c } of [on, off]) {
      c.perk.focus = focusCap(off.c);
      tapNew(c, 'yellow', false);
    }
    expect(focusOf(on.c)).toBeGreaterThan(focusOf(off.c));
    expect(perks(on.c.drainEvents(), 'fullPouch')).toHaveLength(1);
  });

  it('Four Leaf: Perfect hits store n% more Focus (a plain hit: as usual)', () => {
    const { on, off } = both('dell', ['fourLeaf'], { enemies: ['bandit'], tune: tough });
    for (const { c } of [on, off]) tapNew(c, 'yellow', true);
    const store = on.c.stats().atk * on.t.styles.focusStore;
    expect(focusOf(off.c)).toBeCloseTo(store);
    expect(focusOf(on.c)).toBeCloseTo(store * (1 + skillN(on.t, 'fourLeaf') / 100));
    const plain = fight('dell', ['fourLeaf'], { enemies: ['bandit'], tune: tough });
    tapNew(plain.c, 'yellow', false);
    expect(focusOf(plain.c)).toBeCloseTo(store);
  });

  it('Lucky Streak: after a Lucky Shot, the next n hits crit (a miss ends it)', () => {
    const { on, off } = both('dell', ['luckyStreak'], { enemies: ['bandit'], tune: tough });
    const n = skillN(on.t, 'luckyStreak');
    for (const [{ c }, want] of [
      [on, true],
      [off, false],
    ] as const) {
      shoot(c, true);
      for (let i = 0; i < n; i++) {
        tapNew(c, 'yellow', false);
        expect(evs(c.drainEvents(), 'hit')[0].crit, `${want} ${i}`).toBe(want);
      }
      tapNew(c, 'yellow', false);
      expect(evs(c.drainEvents(), 'hit')[0].crit).toBe(false);
    }
    shoot(on.c, true);
    on.c.tap(on.c.time); // a miss
    tapNew(on.c, 'yellow', false);
    expect(evs(on.c.drainEvents(), 'hit')[0].crit).toBe(false);
  });

  it('Hailstones: Pebble Storm hits n% harder', () => {
    const { on, off } = both('dell', ['hailstones'], { enemies: ['bandit'], tune: tough });
    const dmg = (c: Combat) => {
      c.stacks = 2;
      c.finisher();
      return evs(c.drainEvents(), 'finisher')[0].damage;
    };
    const base = dmg(off.c);
    expect(Math.abs(dmg(on.c) - base * (1 + skillN(on.t, 'hailstones') / 100))).toBeLessThanOrEqual(1);
  });

  it('Big Knock: Pebble Storm knocks the reds n% further', () => {
    const { on, off } = both('dell', ['bigKnock'], { enemies: ['bandit'], tune: (t) => (tough(t), (t.kits.dell.stormKnock = 0.3)) });
    const reds = [on, off].map(({ c }) => {
      const r = c.spawnBlock('red', 0.2);
      c.stacks = 1;
      c.finisher();
      return r;
    });
    expect(reds[1].push).toBeCloseTo(off.t.kits.dell.stormKnock);
    expect(reds[0].push).toBeCloseTo(on.t.kits.dell.stormKnock * (1 + skillN(on.t, 'bigKnock') / 100));
  });

  it("Pelt: a Power Shot knocks its foe's reds back (not another foe's)", () => {
    const { on, off } = both('dell', ['pelt'], { enemies: ['bandit', 'slime'], tune: tough });
    const out = [on, off].map(({ c }) => {
      const mine = c.spawnBlock('red', 0.3, c.enemies[0].id);
      const theirs = c.spawnBlock('red', 0.15, c.enemies[1].id);
      shoot(c);
      return { mine, theirs, c };
    });
    expect(out[0].mine.push).toBeCloseTo(on.t.kits.dell.stormKnock / 2);
    expect(out[0].theirs.push).toBe(0);
    expect(out[1].mine.push).toBe(0);
  });
});

// ---------------------------------------------------------------- chests, words, the camp

describe('Yara and Dell come from chests (a Mythic at tiny odds, and the shrine pity)', () => {
  it('both are in the hero chest pool', () => {
    expect(CHEST_HEROES).toContain('yara');
    expect(CHEST_HEROES).toContain('dell');
  });

  it("a Mythic hero chest roll can bring Yara; the shrine's top pity (a Celestial or better) brings a Mythic hero when no Celestial hero exists", () => {
    const t = cloneTuning();
    // only Mythic and up in the hero chest, a hero every time
    t.chests.hero = [0, 0, 0, 0, 0, 1, 0, 0];
    t.chests.heroShare = 1;
    t.chests.shardChance = 0;
    const rng = new Rng(9);
    const got = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const prize = rollChest(rng, t, newProfile(), 'hero');
      if (prize.kind === 'hero') got.add(prize.id);
    }
    expect(got.has('yara')).toBe(true);
    for (const id of got) expect(HEROES[id as HeroId].rarity).toBe('mythic');
    // the shrine's top pity forces a Celestial: no Celestial hero yet, so it falls to a Mythic one
    const u = cloneTuning();
    u.chests.heroShare = 1;
    const p = newProfile();
    p.pity.top = u.chests.topPity - 1;
    const prize = rollChest(new Rng(4), u, p, 'rare');
    expect(prize.kind).toBe('hero');
    expect(HEROES[prize.id as HeroId].rarity).toBe('mythic');
  });

  it('a how-to card each (before their first fight), a meet scene in their own voice, four mastery milestones', () => {
    for (const [id, tip, scene] of [
      ['yara', 'kitYara', 'meetYara'],
      ['dell', 'kitDell', 'meetDell'],
    ] as const) {
      const d = TIPS.find((x) => x.id === tip);
      expect(d?.hero, id).toBe(id);
      expect(d?.after).toEqual(['tapYellow']);
      expect(STORY[scene].some((b) => b.who === id), scene).toBe(true);
      expect(MASTERY.filter((m) => m.hero === id)).toHaveLength(4);
    }
  });
});
