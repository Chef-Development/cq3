// Gorm and Tess (Part 6): their kits (core/kit-fx.ts) and every rule node and capstone of their trees
// (core/skill-fx-gorm-tess.ts), each with and without it, plus their soft strengths and a whole tree on a busy bar.
import { describe, expect, it } from 'vitest';
import { Combat, isRed, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { kitText, skillN, treeOf } from '../../src/core/heroes';
import { rockEvery, rubbleWidth, stopEvery } from '../../src/core/kit-fx';
import type { Tuning } from '../../src/core/tuning';
import type { HeroId } from '../../src/data/heroes';
import { setup } from './helpers';

// ---------------------------------------------------------------- helpers (like hero-skills.test.ts)

/** A fight as `hero` knowing `skills`, the cursor a little way in moving right (no spawns, no crits; reds crawl unless
 *  the test speeds them up). */
function fight(hero: HeroId, skills: string[] = [], o: { enemies?: string[]; waves?: string[][]; tune?: (t: Tuning) => void; stars?: number } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), (t.enemies.slime.hp = 5000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills, stars: o.stars ?? 1 });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], waves: o.waves, seed: 42, spawning: false });
  c.advanceTo(0.2);
  c.drainEvents();
  return { c, t };
}
const both = (hero: HeroId, skills: string[], o: Parameters<typeof fight>[2] = {}) => ({ on: fight(hero, skills, o), off: fight(hero, [], o) });

/** Put a block under the cursor and tap it now: dead centre is a Perfect, a little off is not. */
function tapNew(c: Combat, kind: BlockKind, perfect = false, owner?: number): Block {
  const b = c.spawnBlock(kind, c.cursorPosAt(c.time) + (perfect ? 0 : 0.03), owner);
  c.tap(c.time);
  return b;
}

/** Step the fight to time t (advanceTo stops after 5 s a call). */
function go(c: Combat, t: number): void {
  for (let k = 0; k < 100 && c.time < t - 1e-9; k++) c.advanceTo(Math.min(t, c.time + 4));
}

/** Keep the cursor away from the walls: put it back at 0.2 moving right. */
const recentre = (c: Combat) => c.setCursor(0.2, 1);

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
const lastHit = (events: CombatEvent[]) => evs(events, 'hit').at(-1)!;
const P = (t: Tuning, id: string) => skillN(t, id) / 100;
/** A Brute's plain hit on a foe with no strengths: attack x the style's x1.6. */
const heavy = (c: Combat) => c.stats().atk * c.tuning.styles.heavyMult;

/** Hit plain yellows until the next one is Gorm's Rockfall (the counter one short of it). */
function toRockfall(c: Combat): void {
  for (let k = 0; k < 20 && (c.perk.rockfall ?? 0) < rockEvery(c) - 1; k++) {
    recentre(c);
    tapNew(c, 'yellow');
  }
  c.drainEvents();
}

/** Hit plain yellows until one more sets off Tess's Stopwatch. */
function toStopwatch(c: Combat): void {
  for (let k = 0; k < 40 && (c.perk.tick ?? 0) < stopEvery(c) - 1; k++) {
    recentre(c);
    tapNew(c, 'yellow');
  }
  c.drainEvents();
}

// ---------------------------------------------------------------- Gorm's kit

describe("Gorm's kit", () => {
  it('Rockfall: every 4th hit lands heavy (x rockMult) and shoves the nearest red back (not the far one); 3 stars: every 3rd', () => {
    const { c, t } = fight('gorm', [], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    const near = c.spawnBlock('red', 0.55);
    const far = c.spawnBlock('red', 0.8);
    const k = t.kits.gorm;
    for (let i = 0; i < k.rockEvery - 1; i++) {
      recentre(c);
      tapNew(c, 'yellow');
      expect(lastHit(c.drainEvents()).damage, `hit ${i + 1}`).toBe(Math.round(heavy(c)));
    }
    expect(c.perk.rockfall).toBe(k.rockEvery - 1);
    const p0 = near.pos;
    const f0 = far.pos;
    recentre(c);
    tapNew(c, 'yellow');
    const ev = c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(heavy(c) * k.rockMult));
    expect(perks(ev, 'rockfall')).toHaveLength(1);
    expect(c.perk.rockfall).toBe(0);
    expect(c.perk.rockRed).toBe(near.id);
    go(c, c.time + 0.4);
    expect(near.pos).toBeGreaterThan(p0 + k.shove * 0.5);
    expect(far.pos).toBeCloseTo(f0, 2);
    // the next hit is a plain one again
    recentre(c);
    tapNew(c, 'yellow');
    expect(lastHit(c.drainEvents()).damage).toBe(Math.round(heavy(c)));
    // 3 stars: every 3rd hit
    const s3 = fight('gorm', [], { stars: 3 });
    expect(rockEvery(s3.c)).toBe(k.rockEvery3);
    for (let i = 0; i < k.rockEvery3; i++) {
      recentre(s3.c);
      tapNew(s3.c, 'yellow');
    }
    expect(perks(s3.c.drainEvents(), 'rockfall')).toHaveLength(1);
  });

  it('Rockfall leaves a red already striking at the left end alone (a push would start its strike over): it shoves the nearest one still on its way', () => {
    const { c } = fight('gorm', [], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    toRockfall(c);
    const striking = c.spawnBlock('red', 0.05);
    striking.impactTimer = 0.1;
    const coming = c.spawnBlock('red', 0.6);
    const p0 = coming.pos;
    recentre(c);
    tapNew(c, 'yellow');
    expect(perks(c.drainEvents(), 'rockfall')).toHaveLength(1);
    expect(c.perk.rockRed).toBe(coming.id);
    expect(striking.impactTimer).toBeCloseTo(0.1, 5);
    expect(striking.push).toBe(0);
    go(c, c.time + 0.3);
    expect(coming.pos).toBeGreaterThan(p0);
  });

  it('Roar: a green hit slows every red on the bar (to roarMult, for the ability) and the foes flinch; a yellow does not', () => {
    const { c, t } = fight('gorm');
    const a = c.spawnBlock('red', 0.7);
    const b = c.spawnBlock('red', 0.9);
    tapNew(c, 'yellow');
    expect(a.chill).toBe(0);
    recentre(c);
    tapNew(c, 'green');
    const ev = c.drainEvents();
    expect(perks(ev, 'roar')).toMatchObject([{ amount: 2 }]);
    for (const r of [a, b]) {
      expect(r.chill).toBeCloseTo(t.kits.gorm.abilitySec, 2);
      expect(r.chillMult).toBeCloseTo(t.kits.gorm.roarMult);
    }
    expect(kitText(t, 'gorm', 'ability')).toContain(`${t.kits.gorm.abilitySec} s`);
  });

  it("Thick Skin: the first hit taken each wave deals skin% less; the next one in full; a new wave's first one less again", () => {
    const { c, t } = fight('gorm', [], { waves: [['slime'], ['slime']], enemies: [], tune: (t) => ((t.blocks.redTravelSec = 0.5), (t.blocks.impactGraceMs = 0)) });
    const hit = () => {
      const hp = c.hero.hp;
      c.spawnBlock('red', 0.05);
      go(c, c.time + 0.3);
      return hp - c.hero.hp;
    };
    const atk = c.enemies[0].atk;
    const first = hit();
    const second = hit();
    expect(second).toBeGreaterThan(0);
    expect(first).toBe(Math.round(second * (1 - t.kits.gorm.skin)));
    expect(perks(c.drainEvents(), 'stoneSkin')).toHaveLength(1);
    // the next wave
    c.enemies[0].hp = 1;
    c.stacks = 1;
    c.finisher();
    go(c, c.time + 3);
    expect(c.waveIndex).toBe(1);
    c.hero.hp = c.maxHp();
    expect(hit()).toBe(first);
    void atk;
  });

  it("Landslide: hits every foe and smashes every red; rubble lies over the bar's right end and slows reds crossing it; then it's gone (5 stars: twice as long)", () => {
    const { c, t } = fight('gorm', [], { enemies: ['bandit', 'bandit'], tune: (t) => ((t.enemies.bandit.hp = 5000), (t.blocks.redTravelSec = 3)) });
    const k = t.kits.gorm;
    c.spawnBlock('red', 0.4);
    c.spawnBlock('red', 0.6);
    c.stacks = 1;
    c.finisher();
    const ev = c.drainEvents();
    expect(c.blocks.filter((b) => isRed(b.kind))).toHaveLength(0);
    expect(evs(ev, 'enemyHurt').filter((e) => e.source === 'finisher')).toHaveLength(2);
    expect(perks(ev, 'rubble')).toHaveLength(1);
    expect(c.perk.rubble).toBeCloseTo(k.rubbleSec);
    // a red coming in at the right end slows while it crosses the rubble
    const r = c.spawnBlock('red', 0.96);
    go(c, c.time + 0.05);
    expect(r.chill).toBeGreaterThan(0);
    expect(r.chillMult).toBeCloseTo(k.rubbleMult);
    expect(perks(c.drainEvents(), 'rubbleSlow').length).toBeGreaterThan(0);
    // ...and moves on at its own speed once it's through
    go(c, c.time + r.chill + 0.05);
    expect(r.pos).toBeLessThan(1 - rubbleWidth(c));
    // when the rubble is gone, a new red runs at full speed
    go(c, c.time + k.rubbleSec);
    expect(c.perk.rubble).toBe(0);
    const r2 = c.spawnBlock('red', 0.96);
    go(c, c.time + 0.05);
    expect(r2.chill).toBe(0);
    // 5 stars: the rubble stays twice as long
    const s5 = fight('gorm', [], { stars: 5 });
    s5.c.stacks = 1;
    s5.c.finisher();
    expect(s5.c.perk.rubble).toBeCloseTo(k.rubbleSec * 2);
  });

  it('his soft strength: +20% damage to Armored foes (a Shell Beetle), not to a Slime', () => {
    const dmg = (enemy: string) => {
      const { c } = fight('gorm', [], { enemies: [enemy], tune: (t) => ((t.hero.strengthScale = 1), (t.enemies[enemy].hp = 900)) });
      tapNew(c, 'yellow');
      return lastHit(c.drainEvents()).damage;
    };
    const { c } = fight('gorm');
    expect(dmg('beetle')).toBe(Math.round(heavy(c)));
    // (the strength is on what the foe takes: its hurt event)
    const b = fight('gorm', [], { enemies: ['beetle'], tune: (t) => ((t.hero.strengthScale = 1), (t.enemies.beetle.hp = 900)) });
    tapNew(b.c, 'yellow');
    const s = fight('gorm', [], { enemies: ['slime'], tune: (t) => ((t.hero.strengthScale = 1), (t.enemies.slime.hp = 900)) });
    tapNew(s.c, 'yellow');
    expect(900 - b.c.enemies[0].hp).toBe(Math.round(Math.round(heavy(b.c)) * 1.2));
    expect(900 - s.c.enemies[0].hp).toBe(Math.round(heavy(s.c)));
    void dmg;
  });
});

// ---------------------------------------------------------------- Tess's kit

describe("Tess's kit", () => {
  it('the Stopwatch: every 12 hits, every red holds still for stopSec while the cursor moves (one that comes in too); then they go on; 3 stars: sooner', () => {
    const { c, t } = fight('tess', [], { tune: (t) => (t.blocks.redTravelSec = 4) });
    const k = t.kits.tess;
    const r = c.spawnBlock('red', 0.8);
    toStopwatch(c);
    expect(r.chill).toBe(0);
    recentre(c);
    tapNew(c, 'yellow');
    const ev = c.drainEvents();
    expect(perks(ev, 'stopwatch')).toHaveLength(1);
    expect(c.perk.stop).toBeCloseTo(k.stopSec);
    const p0 = r.pos;
    const cur = c.cursorPos();
    const late = c.spawnBlock('red', 0.95);
    const l0 = late.pos;
    go(c, c.time + k.stopSec * 0.8);
    expect(r.pos).toBeCloseTo(p0, 5);
    expect(late.pos).toBeCloseTo(l0, 5);
    expect(c.cursorPos()).not.toBeCloseTo(cur, 2);
    go(c, c.time + k.stopSec * 0.4);
    expect(c.perk.stop).toBe(0);
    go(c, c.time + 0.3);
    expect(r.pos).toBeLessThan(p0 - 0.01);
    expect(late.pos).toBeLessThan(l0 - 0.01);
    expect(stopEvery(fight('tess', [], { stars: 3 }).c)).toBe(k.stopEvery3);
  });

  it('Slow Time: a green hit slows every red (and the ones that come) to slowMult while the ability lasts; then full speed', () => {
    const { c, t } = fight('tess', [], { tune: (t) => (t.blocks.redTravelSec = 4) });
    const k = t.kits.tess;
    const a = c.spawnBlock('red', 0.8);
    tapNew(c, 'green');
    expect(perks(c.drainEvents(), 'slowTime')).toHaveLength(1);
    expect(a.chillMult).toBeCloseTo(k.slowMult);
    const b = c.spawnBlock('red', 0.95);
    go(c, c.time + 0.1);
    expect(b.chill).toBeGreaterThan(0);
    expect(b.chillMult).toBeCloseTo(k.slowMult);
    expect(b.vel).toBeCloseTo(c.redVel(b.width, b.speed) * k.slowMult, 5);
    go(c, c.time + k.abilitySec);
    const n = c.spawnBlock('red', 0.95);
    go(c, c.time + 0.1);
    expect(n.chill).toBe(0);
  });

  it("Steady Hands: on ice and snow her cursor keeps only `steady` of the patch's pull (other patches as usual); the text says how much less", () => {
    const { c, t } = fight('tess');
    const r = fight('rowan');
    for (const kind of ['ice', 'snow'] as const) {
      const z = c.addZone(kind, 0.5, 0.2, 0);
      const zr = r.c.addZone(kind, 0.5, 0.2, 0);
      expect(c.zoneMult(z)).toBeCloseTo(1 + (r.c.zoneMult(zr) - 1) * t.kits.tess.steady);
    }
    const slow = c.addZone('slow', 0.5, 0.2, 0);
    expect(c.zoneMult(slow)).toBeCloseTo(t.bar.slowMult);
    expect(kitText(t, 'tess', 'passive')).toContain(`${Math.round((1 - t.kits.tess.steady) * 100)}% less`);
  });

  it('Rewind: hits every foe; every red winds back to where it came on (the far ones queue up), an icicle to a full fuse; 5 stars: then time stops', () => {
    const { c, t } = fight('tess', [], { enemies: ['bandit', 'bandit'], tune: (t) => ((t.enemies.bandit.hp = 5000), (t.blocks.redTravelSec = 6)) });
    const a = c.spawnBlock('red', 0.92);
    const b = c.spawnBlock('red', 0.95);
    const ice = c.spawnBlock('red', 0.5, undefined, undefined, { still: true, fuse: 3 });
    go(c, c.time + 1.6);
    expect(a.pos).toBeLessThan(0.72);
    expect(ice.impactTimer).toBeLessThan(1.5);
    c.stacks = 1;
    c.finisher();
    const ev = c.drainEvents();
    expect(evs(ev, 'enemyHurt').filter((e) => e.source === 'finisher')).toHaveLength(2);
    expect(perks(ev, 'rewind')).toMatchObject([{ amount: 3 }]);
    expect(ice.impactTimer).toBeCloseTo(3, 1);
    go(c, c.time + t.kits.tess.rewindSec + 0.02);
    // the one further right goes back to its start; the other lines up behind it
    expect(b.pos).toBeGreaterThan(0.9);
    expect(a.pos).toBeGreaterThan(0.75);
    expect(c.blocks.filter((x) => isRed(x.kind))).toHaveLength(3);
    const s5 = fight('tess', [], { stars: 5 });
    s5.c.spawnBlock('red', 0.5);
    s5.c.stacks = 1;
    s5.c.finisher();
    expect(perks(s5.c.drainEvents(), 'secondHand')).toHaveLength(1);
    expect(s5.c.perk.stop).toBeGreaterThan(0);
  });

  it('her soft strength: +20% damage to Constructs (the Ruin Golem)', () => {
    const g = fight('tess', [], { enemies: ['golem'], tune: (t) => ((t.hero.strengthScale = 1), (t.enemies.golem.hp = 900)) });
    tapNew(g.c, 'yellow');
    expect(900 - g.c.enemies[0].hp).toBe(Math.round(Math.round(g.c.stats().atk) * 1.2));
  });
});

// ---------------------------------------------------------------- Gorm's tree

describe("Gorm's tree", () => {
  it('Big Shove: Rockfall shoves its red n% further', () => {
    const { on, off } = both('gorm', ['bigShove']);
    const moved = (c: Combat) => {
      const r = c.spawnBlock('red', 0.5);
      toRockfall(c);
      recentre(c);
      const p0 = r.pos;
      tapNew(c, 'yellow');
      const ev = c.drainEvents();
      go(c, c.time + 0.5);
      return { d: r.pos - p0, ev };
    };
    const a = moved(on.c);
    const b = moved(off.c);
    expect(a.d).toBeCloseTo(b.d * (1 + P(on.t, 'bigShove')), 2);
    expect(perks(a.ev, 'bigShove')).toHaveLength(1);
    expect(perks(b.ev, 'bigShove')).toHaveLength(0);
  });

  it('Split Rock: a Rockfall also hits every other foe for n% of its blow', () => {
    const { on, off } = both('gorm', ['splitRock'], { enemies: ['bandit', 'bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    for (const { c } of [on, off]) toRockfall(c);
    for (const { c } of [on, off]) tapNew(c, 'yellow');
    const blow = lastHit(on.c.drainEvents()).damage;
    off.c.drainEvents();
    expect(5000 - on.c.enemies[1].hp).toBe(Math.round(blow * P(on.t, 'splitRock')));
    expect(5000 - off.c.enemies[1].hp).toBe(0);
  });

  it('Stone Rain: a Rockfall shoves every red on the bar back, not just the nearest', () => {
    const { on, off } = both('gorm', ['stoneRain']);
    const far = (c: Combat) => {
      c.spawnBlock('red', 0.5);
      const f = c.spawnBlock('red', 0.75);
      toRockfall(c);
      const p0 = f.pos;
      recentre(c);
      tapNew(c, 'yellow');
      go(c, c.time + 0.5);
      return f.pos - p0;
    };
    expect(far(on.c)).toBeGreaterThan(0.05);
    expect(far(off.c)).toBeLessThan(0.01);
  });

  it('Long Roar: a Roar slows the reds n s longer', () => {
    const { on, off } = both('gorm', ['longRoar']);
    const chill = (c: Combat) => {
      const r = c.spawnBlock('red', 0.8);
      tapNew(c, 'green');
      return r.chill;
    };
    expect(chill(on.c)).toBeCloseTo(chill(off.c) + skillN(on.t, 'longRoar'), 2);
    expect(perks(on.c.drainEvents(), 'longRoar')).toHaveLength(1);
  });

  it('Ear Ringer: a Roar stuns every foe for n s', () => {
    const { on, off } = both('gorm', ['earRinger'], { enemies: ['slime', 'slime'] });
    for (const { c } of [on, off]) tapNew(c, 'green');
    for (const e of on.c.enemies) expect(e.stun).toBeCloseTo(skillN(on.t, 'earRinger'));
    for (const e of off.c.enemies) expect(e.stun).toBe(0);
  });

  it('War Cry: every n-th red blocked lets out a Roar (the reds on the bar slow)', () => {
    const { on, off } = both('gorm', ['warCry']);
    const run = (c: Combat) => {
      const r = c.spawnBlock('red', 0.95);
      for (let i = 0; i < skillN(on.t, 'warCry'); i++) {
        recentre(c);
        tapNew(c, 'red');
      }
      return { r, ev: c.drainEvents() };
    };
    const a = run(on.c);
    const b = run(off.c);
    expect(perks(a.ev, 'warCry')).toHaveLength(1);
    expect(perks(a.ev, 'roar')).toHaveLength(1);
    expect(a.r.chillMult).toBeCloseTo(on.t.kits.gorm.roarMult);
    expect(perks(b.ev, 'roar')).toHaveLength(0);
    expect(b.r.chill).toBe(0);
  });

  it('Second Skin: Thick Skin covers the first n hits each wave', () => {
    const { on, off } = both('gorm', ['secondSkin'], { tune: (t) => ((t.blocks.redTravelSec = 0.5), (t.blocks.impactGraceMs = 0)) });
    const hits = (c: Combat) =>
      [0, 1, 2].map(() => {
        const hp = c.hero.hp;
        c.spawnBlock('red', 0.05);
        go(c, c.time + 0.3);
        return hp - c.hero.hp;
      });
    const a = hits(on.c);
    const b = hits(off.c);
    expect(a[1]).toBe(a[0]);
    expect(a[2]).toBeGreaterThan(a[1]);
    expect(b[1]).toBeGreaterThan(b[0]);
    expect(perks(on.c.drainEvents(), 'secondSkin')).toHaveLength(1);
  });

  it("Shrug It Off: a hit Thick Skin covers doesn't break the combo (the next one does)", () => {
    const { on, off } = both('gorm', ['shrugOff'], { tune: (t) => ((t.blocks.redTravelSec = 0.5), (t.blocks.impactGraceMs = 0)) });
    for (const { c } of [on, off]) {
      c.combo = 12;
      c.spawnBlock('red', 0.05);
      go(c, c.time + 0.3);
    }
    expect(on.c.combo).toBe(12);
    expect(off.c.combo).toBe(0);
    expect(perks(on.c.drainEvents(), 'shrugOff')).toHaveLength(1);
    on.c.spawnBlock('red', 0.05);
    go(on.c, on.c.time + 0.3);
    expect(on.c.combo).toBe(0);
  });

  it('Bedrock: while Thick Skin is unused, hits deal n% more; once it covered a hit, as usual', () => {
    const { on, off } = both('gorm', ['bedrock'], { enemies: ['bandit'], tune: (t) => ((t.enemies.bandit.hp = 5000), (t.blocks.redTravelSec = 0.5), (t.blocks.impactGraceMs = 0)) });
    for (const { c } of [on, off]) tapNew(c, 'yellow');
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(heavy(on.c) * (1 + P(on.t, 'bedrock'))));
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(heavy(off.c)));
    on.c.spawnBlock('red', 0.05);
    go(on.c, on.c.time + 0.3);
    recentre(on.c);
    tapNew(on.c, 'yellow');
    const ev = on.c.drainEvents();
    expect(lastHit(ev).damage).toBe(Math.round(heavy(on.c)));
    expect(perks(ev, 'bedrock')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- Tess's tree

describe("Tess's tree", () => {
  it('Long Pause: the Stopwatch holds the reds n s longer', () => {
    const { on, off } = both('tess', ['longPause']);
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.9);
      toStopwatch(c);
      recentre(c);
      tapNew(c, 'yellow');
      go(c, c.time + 0.02);
    }
    expect(on.c.perk.stop).toBeCloseTo(off.c.perk.stop + skillN(on.t, 'longPause'), 1);
    expect(perks(on.c.drainEvents(), 'longPause')).toHaveLength(1);
  });

  it('Quick Tick: while time is stopped, hits deal n% more', () => {
    const { on, off } = both('tess', ['quickTick'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 5000) });
    tapNew(on.c, 'yellow');
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(on.c.stats().atk));
    for (const { c } of [on, off]) {
      c.perk.stop = 1;
      recentre(c);
      tapNew(c, 'yellow');
    }
    expect(lastHit(on.c.drainEvents()).damage).toBe(Math.round(on.c.stats().atk * (1 + P(on.t, 'quickTick'))));
    expect(lastHit(off.c.drainEvents()).damage).toBe(Math.round(off.c.stats().atk));
  });

  it('Perfect Time: a Perfect hit counts twice toward the Stopwatch', () => {
    const { on, off } = both('tess', ['perfectTime']);
    for (const { c } of [on, off]) tapNew(c, 'yellow', true);
    expect(on.c.perk.tick).toBe(2);
    expect(off.c.perk.tick).toBe(1);
    // and it can be the one that sets it off
    on.c.perk.tick = stopEvery(on.c) - 2;
    recentre(on.c);
    tapNew(on.c, 'yellow', true);
    expect(perks(on.c.drainEvents(), 'stopwatch')).toHaveLength(1);
  });

  it('Lingering: Slow Time lasts n s longer (its reds stay slowed)', () => {
    const { on, off } = both('tess', ['lingering']);
    const rs = [on, off].map(({ c }) => {
      const r = c.spawnBlock('red', 0.8);
      tapNew(c, 'green');
      return r;
    });
    expect(on.c.hero.abilityTimer).toBeCloseTo(off.c.hero.abilityTimer + skillN(on.t, 'lingering'));
    expect(rs[0].chill).toBeCloseTo(rs[1].chill + skillN(on.t, 'lingering'));
  });

  it('Spare Time: blocking a slowed red puts n s back on Slow Time (up to its full length)', () => {
    const { on, off } = both('tess', ['borrowedTime']);
    for (const { c } of [on, off]) {
      tapNew(c, 'green');
      go(c, c.time + 1);
      const r = c.spawnBlock('red', c.cursorPosAt(c.time) + 0.2);
      go(c, c.time + 0.05);
      expect(r.chillMult).toBeLessThan(1);
      c.drainEvents();
      c.blocks.splice(c.blocks.indexOf(r), 1);
      c.blocks.push(r);
      r.pos = c.cursorPosAt(c.time);
      c.tap(c.time);
    }
    const n = skillN(on.t, 'borrowedTime');
    expect(on.c.hero.abilityTimer).toBeCloseTo(off.c.hero.abilityTimer + n, 1);
    expect(perks(on.c.drainEvents(), 'borrowedTime')).toHaveLength(1);
    // never past the full length
    on.c.hero.abilityTimer = on.c.abilitySec() - 0.1;
    const r = on.c.spawnBlock('red', on.c.cursorPosAt(on.c.time));
    go(on.c, on.c.time + 1 / 120);
    r.pos = on.c.cursorPosAt(on.c.time);
    on.c.tap(on.c.time);
    expect(on.c.hero.abilityTimer).toBeLessThanOrEqual(on.c.abilitySec() + 1e-9);
  });

  it('Standstill: a green hit stops time as well as slowing it', () => {
    const { on, off } = both('tess', ['standstill']);
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.8);
      tapNew(c, 'green');
    }
    expect(perks(on.c.drainEvents(), 'standstill')).toHaveLength(1);
    expect(on.c.perk.stop).toBeGreaterThan(0);
    expect(off.c.perk.stop ?? 0).toBe(0);
    expect(on.c.blocks.find((b) => isRed(b.kind))!.chillMult).toBe(0);
  });

  it('Wind Back: Rewind deals n% more for every red it winds back', () => {
    const { on, off } = both('tess', ['windBack'], { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 9000) });
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.5);
      c.spawnBlock('red', 0.7);
      c.stacks = 1;
      c.finisher();
    }
    const d = (c: Combat) => 9000 - c.enemies[0].hp;
    expect(d(on.c)).toBe(Math.round(d(off.c) * (1 + 2 * P(on.t, 'windBack'))));
    expect(perks(on.c.drainEvents(), 'windBack')).toMatchObject([{ amount: 2 }]);
  });

  it('Backspin: a Perfect block winds the nearest red left on the bar back (a plain block: no)', () => {
    const { on, off } = both('tess', ['backspin'], { tune: (t) => (t.styles.bendSec = 0) });
    const run = (c: Combat, perfect: boolean) => {
      const r = c.spawnBlock('red', 0.45);
      r.from = 0.95; // (it came on at the right end, like every red)
      recentre(c);
      tapNew(c, 'red', perfect);
      go(c, c.time + c.tuning.kits.tess.rewindSec + 0.05);
      const d = r.pos - 0.45;
      c.removeBlock(r, 'perk');
      return d;
    };
    expect(run(on.c, true)).toBeGreaterThan(0.3);
    expect(run(on.c, false)).toBeLessThan(0.01);
    expect(run(off.c, true)).toBeLessThan(0.01);
  });

  it('Time Loop: every n-th Stopwatch also winds every red back', () => {
    const { on, off } = both('tess', ['timeLoop'], { tune: (t) => (t.kits.tess.stopEvery = 2) });
    const run = (c: Combat) => {
      const r = c.spawnBlock('red', 0.6);
      r.from = 0.95;
      for (let i = 0; i < 2 * skillN(on.t, 'timeLoop'); i++) {
        recentre(c);
        tapNew(c, 'yellow');
      }
      go(c, c.time + 0.05);
      return { r, ev: c.drainEvents() };
    };
    const a = run(on.c);
    const b = run(off.c);
    expect(perks(a.ev, 'stopwatch')).toHaveLength(skillN(on.t, 'timeLoop'));
    expect(perks(a.ev, 'timeLoop')).toHaveLength(1);
    expect(a.r.push).toBeGreaterThan(0);
    expect(perks(b.ev, 'timeLoop')).toHaveLength(0);
    expect(b.r.push).toBe(0);
  });
});

// ---------------------------------------------------------------- a whole fight

describe('Gorm and Tess on a busy bar (ice, snow, holds, drifting and linked blocks)', () => {
  it('each whole tree, 5 stars, plays a long fight without breaking, and their kit shows itself', () => {
    for (const hero of ['gorm', 'tess'] as const) {
      const { t, s } = setup({ hero, tune: (t) => ((t.blocks.openingSpawns = 3), (t.enemies.slime.hp = 500), (t.enemies.bandit.hp = 500)) });
      const skills = treeOf(hero).flatMap((b) => b.nodes.map((n) => n.id));
      const h = newHero(t, emptyLoadout(), { id: hero, level: 30, skills, stars: 5 });
      const bar = { ice: { every: 2, width: 0.2, life: 4, fromRow: 0, max: 1 }, snow: { every: 3, width: 0.2, life: 4, fromRow: 0, max: 1 }, holds: { share: 0.25, fromRow: 0, width: 0.16 }, drift: { share: 0.2, fromRow: 0, speed: 0.1 }, links: { share: 0.15, fromRow: 0 } };
      const c = new Combat({ tuning: t, settings: s, hero: h, waves: [['slime', 'bandit'], ['wolf', 'bandit']], enemies: [], seed: 11, spawning: true, bar, row: 3 });
      let r = 3;
      const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
      const seen = new Set<string>();
      for (let k = 0; k < 120 * 30 && !c.result; k++) {
        c.step();
        if (c.holding) {
          if (rand() < 0.02) c.release(c.time);
        } else if (rand() < 0.07) {
          const u = c.underCursor(c.time);
          if (u.red || u.attack || rand() < 0.2) c.tap(c.time);
        }
        if (c.stacks >= 2 && rand() < 0.01) c.finisher();
        for (const e of c.drainEvents()) if (e.type === 'perk') seen.add(e.id);
        expect(Number.isFinite(c.hero.hp), hero).toBe(true);
        for (const b of c.blocks) expect(Number.isFinite(b.pos) && b.pos >= 0 && b.pos <= 1 && b.chill >= 0, `${hero} ${b.kind}`).toBe(true);
      }
      const kit = hero === 'gorm' ? ['rockfall', 'roar'] : ['stopwatch', 'slowTime'];
      for (const id of kit) expect(seen.has(id), `${hero}: ${id} (${[...seen].join(' ')})`).toBe(true);
    }
  });
});
