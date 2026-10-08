// Fizz's and Brann's skill trees (src/data/skills-heroes.ts, core/skill-fx-fizz-brann.ts): a with/without test for
// every rule node and capstone. (The trees' shape, ids, numbers and words are checked with every hero's in
// hero-skills.test.ts.)
import { describe, expect, it } from 'vitest';
import type { HeroId } from '../../src/data/heroes';
import { Combat, newHero, type Block, type BlockKind, type CombatEvent } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import { skillN } from '../../src/core/heroes';
import { BREWS, brewOf, nextBrew, tollOf } from '../../src/core/kit-fizz-brann';
import { guardOf } from '../../src/core/styles';
import type { Tuning } from '../../src/core/tuning';
import { setup } from './helpers';

/** A fight as `hero` knowing `skills` (no spawns, no crits; reds crawl unless the test speeds them up). */
function fight(hero: HeroId, skills: string[], o: { enemies?: string[]; tune?: (t: Tuning) => void; stars?: number } = {}) {
  const { t, s } = setup({ hero, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  const h = newHero(t, emptyLoadout(), { id: hero, level: 1, skills, stars: o.stars ?? 1 });
  const c = new Combat({ tuning: t, settings: s, hero: h, enemies: o.enemies ?? ['slime'], seed: 42, spawning: false });
  c.advanceTo(0.5);
  c.drainEvents();
  return { c, t };
}

/** Both versions of a fight: with the node(s) and without. */
const both = (hero: HeroId, skills: string[], o: Parameters<typeof fight>[2] = {}) => ({ on: fight(hero, skills, o), off: fight(hero, [], o) });

function go(c: Combat, t: number): void {
  for (let k = 0; k < 100 && c.time < t - 1e-9; k++) c.advanceTo(Math.min(t, c.time + 4));
}

/** Put a block under the cursor and tap it now: dead centre is a Perfect, a little off is not. */
function tapNew(c: Combat, kind: BlockKind, perfect: boolean, owner?: number): Block {
  const b = c.spawnBlock(kind, c.cursorPosAt(c.time) + (perfect ? 0 : 0.03), owner);
  c.tap(c.time);
  return b;
}

type Ev<K extends CombatEvent['type']> = Extract<CombatEvent, { type: K }>;
const evs = <K extends CombatEvent['type']>(events: CombatEvent[], type: K): Ev<K>[] => events.filter((e): e is Ev<K> => e.type === type);
const perks = (events: CombatEvent[], id: string) => evs(events, 'perk').filter((e) => e.id === id);
const HP = (t: Tuning) => (t.enemies.slime.hp = 5000);

// ---------------------------------------------------------------- Fizz

describe('Fizz', () => {
  it('Slow Burn: fire brews burn n s longer', () => {
    const { on, off } = both('fizz', ['slowBurn'], { tune: HP });
    for (const { c } of [on, off]) tapNew(c, 'keg', false);
    expect(on.c.enemies[0].burn - off.c.enemies[0].burn).toBeCloseTo(skillN(on.t, 'slowBurn'), 1);
    expect(perks(on.c.drainEvents(), 'slowBurn')).toHaveLength(1);
    expect(perks(off.c.drainEvents(), 'slowBurn')).toHaveLength(0);
  });

  it('Hard Frost: after a frost brew, the reds that come in the next n s are slowed too', () => {
    const { on, off } = both('fizz', ['hardFrost']);
    for (const { c } of [on, off]) {
      c.perk.brew = BREWS.indexOf('frost');
      tapNew(c, 'keg', false);
      go(c, c.time + 0.5);
    }
    const late = (c: Combat) => c.spawnBlock('red', 0.95);
    expect(late(on.c).chill).toBeGreaterThan(0);
    expect(late(off.c).chill).toBe(0);
    expect(perks(on.c.drainEvents(), 'hardFrost')).toHaveLength(1);
    // ...but not after n s
    go(on.c, on.c.time + skillN(on.t, 'hardFrost') + 0.1);
    expect(late(on.c).chill).toBe(0);
  });

  it('Wildfire: burning foes take n% more from her flasks (a blast), not from plain hits', () => {
    const { on, off } = both('fizz', ['wildfire'], { enemies: ['slime', 'slime'], tune: HP });
    for (const { c } of [on, off]) {
      c.enemies[1].burn = 3;
      c.enemies[1].burnDps = 1;
      c.perk.brew = BREWS.indexOf('frost'); // (a frost flask: it adds no burn of its own)
    }
    const blast = (c: Combat) => {
      const hp = c.enemies[1].hp;
      tapNew(c, 'keg', false);
      return hp - c.enemies[1].hp;
    };
    expect(blast(on.c)).toBe(Math.round(blast(off.c) * (1 + skillN(on.t, 'wildfire') / 100)));
    expect(perks(on.c.drainEvents(), 'wildfire').length).toBeGreaterThan(0);
    // a plain hit on a burning foe: no more
    on.c.enemies[0].burn = 3;
    const hp = on.c.enemies[0].hp;
    tapNew(on.c, 'yellow', false);
    expect(hp - on.c.enemies[0].hp).toBe(Math.round(on.t.hero.atk * on.t.kits.fizz.atk));
  });

  it('Long Arm: tosses hit n% harder', () => {
    const { on, off } = both('fizz', ['longArm'], { tune: HP });
    const toss = (c: Combat) => {
      tapNew(c, 'green', false);
      return perks(c.drainEvents(), 'toss')[0].amount;
    };
    const raw = off.c.stats().atk * off.t.kits.fizz.tossMult;
    expect(toss(off.c)).toBe(Math.round(raw));
    expect(toss(on.c)).toBe(Math.round((raw * (100 + skillN(on.t, 'longArm'))) / 100));
  });

  it('Splash: a toss also splashes every other foe for n% of its blow', () => {
    const { on, off } = both('fizz', ['splash'], { enemies: ['slime', 'slime', 'slime'], tune: HP });
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    const ev = on.c.drainEvents();
    const toss = perks(ev, 'toss')[0];
    expect(perks(ev, 'splash').map((e) => e.amount)).toEqual([0, 0].map(() => Math.round((on.c.perk.tossDmg * skillN(on.t, 'splash')) / 100)));
    expect(perks(ev, 'splash').every((e) => e.enemyId !== toss.enemyId)).toBe(true);
    expect(perks(off.c.drainEvents(), 'splash')).toHaveLength(0);
  });

  it('Double Toss: every nth toss throws the next flask too', () => {
    const { on, off } = both('fizz', ['doubleToss'], { tune: HP });
    const n = skillN(on.t, 'doubleToss');
    const tosses = (c: Combat) => {
      for (let i = 0; i < n; i++) tapNew(c, 'green', false);
      return perks(c.drainEvents(), 'toss').length;
    };
    expect(tosses(on.c)).toBe(n + 1);
    expect(tosses(off.c)).toBe(n);
    expect(nextBrew(on.c)).toBe(BREWS[(n + 1) % 3]);
  });

  it('Meltdown: a fire flask melts the ice patches its blast reaches (not one far away)', () => {
    const { on, off } = both('fizz', ['meltdown']);
    for (const { c } of [on, off]) {
      const at = c.cursorPosAt(c.time);
      c.addZone('ice', at + 0.05, 0.08, 10);
      c.addZone('ice', at > 0.5 ? 0.08 : 0.92, 0.08, 10);
      tapNew(c, 'keg', false);
    }
    expect(on.c.zones.filter((z) => z.kind === 'ice')).toHaveLength(1);
    expect(off.c.zones.filter((z) => z.kind === 'ice')).toHaveLength(2);
    expect(perks(on.c.drainEvents(), 'meltdown')).toHaveLength(1);
  });

  it('Fume Hood: a trap no longer breaks the combo or loses the stacks (a red still does)', () => {
    const { on, off } = both('fizz', ['fumeHood'], { tune: (t) => (t.enemies.slime.special = 5) });
    for (const { c } of [on, off]) {
      c.combo = 12;
      c.stacks = 2;
      c.meter = 0.5;
      tapNew(c, 'purple', false);
    }
    expect([on.c.combo, on.c.stacks, on.c.meter]).toEqual([12, 2, 0]);
    expect([off.c.combo, off.c.stacks]).toEqual([0, 0]);
    expect(perks(on.c.drainEvents(), 'fumeHood')).toHaveLength(1);
    // a red that gets through still breaks it
    on.t.blocks.redTravelSec = 1;
    on.c.spawnBlock('red', 0.05);
    go(on.c, on.c.time + 0.5);
    expect(on.c.combo).toBe(0);
  });

  it('Catalyst: a Perfect hit sets off the flasks within a blast of it (not far ones; a plain hit, none)', () => {
    const { on, off } = both('fizz', ['catalyst'], { tune: HP });
    const run = (c: Combat, perfect: boolean) => {
      const at = c.cursorPosAt(c.time);
      const near = c.spawnBlock('keg', at + 0.11);
      const far = c.spawnBlock('keg', at > 0.5 ? 0.06 : 0.94);
      tapNew(c, 'yellow', perfect);
      return { near: c.blocks.includes(near), far: c.blocks.includes(far) };
    };
    expect(run(on.c, true)).toEqual({ near: false, far: true });
    expect(perks(on.c.drainEvents(), 'catalyst')).toEqual([expect.objectContaining({ amount: 1 })]);
    expect(run(off.c, true)).toEqual({ near: true, far: true });
    const plain = fight('fizz', ['catalyst']);
    expect(run(plain.c, false)).toEqual({ near: true, far: true });
    // (the flask goes off with its brew: the first one is fire)
    expect(brewOf(on.c.spawnBlock('keg', 0.5))).toBeDefined();
  });
});

// ---------------------------------------------------------------- Brann

describe('Brann', () => {
  it('Loud Toll: each toll adds n% more', () => {
    const { on, off } = both('brann', ['loudToll'], { tune: HP });
    const hit = (c: Combat) => {
      tapNew(c, 'red', false);
      tapNew(c, 'red', false);
      const hp = c.enemies[0].hp;
      tapNew(c, 'yellow', false);
      return hp - c.enemies[0].hp;
    };
    const atk = on.t.hero.atk * on.t.kits.brann.atk;
    const per = on.t.kits.brann.tollPer;
    expect(hit(off.c)).toBe(Math.round(atk * (1 + 2 * per)));
    expect(hit(on.c)).toBe(Math.round(atk * (1 + 2 * per * (1 + skillN(on.t, 'loudToll') / 100))));
    expect(perks(on.c.drainEvents(), 'loudToll')).toHaveLength(1);
  });

  it('Double Toll: a Perfect block rings two tolls (a plain block one)', () => {
    const { on, off } = both('brann', ['doubleToll']);
    tapNew(on.c, 'red', true);
    tapNew(off.c, 'red', true);
    expect([tollOf(on.c), tollOf(off.c)]).toEqual([2, 1]);
    tapNew(on.c, 'red', false);
    expect(tollOf(on.c)).toBe(3);
  });

  it('Resound: a hit spending n+ tolls rings out at every other foe (for what the tolls added); fewer tolls, no', () => {
    const { on, off } = both('brann', ['resound'], { enemies: ['slime', 'slime'], tune: HP });
    const n = skillN(on.t, 'resound');
    for (const { c } of [on, off]) {
      for (let i = 0; i < n; i++) tapNew(c, 'red', false, c.enemies[0].id);
      tapNew(c, 'yellow', false);
    }
    const bonus = on.t.kits.brann.tollPer * n;
    const hit = Math.round(on.t.hero.atk * on.t.kits.brann.atk * (1 + bonus));
    expect(5000 - on.c.enemies[1].hp).toBe(Math.round((hit * bonus) / (1 + bonus)));
    expect(off.c.enemies[1].hp).toBe(5000);
    // fewer tolls: nothing rings out
    const few = fight('brann', ['resound'], { enemies: ['slime', 'slime'], tune: HP });
    tapNew(few.c, 'red', false, few.c.enemies[0].id);
    tapNew(few.c, 'yellow', false);
    expect(few.c.enemies[1].hp).toBe(5000);
  });

  it('Long Peal: Peal rings n s longer', () => {
    const { on, off } = both('brann', ['longPeal']);
    for (const { c } of [on, off]) tapNew(c, 'green', false);
    expect(on.c.hero.abilityTimer - off.c.hero.abilityTimer).toBeCloseTo(skillN(on.t, 'longPeal'), 5);
  });

  it('Resonance: during Peal, each block stores n more Guard (outside it, 1)', () => {
    const { on, off } = both('brann', ['resonance']);
    for (const { c } of [on, off]) {
      tapNew(c, 'green', false);
      tapNew(c, 'red', false);
    }
    expect(guardOf(on.c)).toBe(1 + skillN(on.t, 'resonance'));
    expect(guardOf(off.c)).toBe(1);
    go(on.c, on.c.time + 5);
    tapNew(on.c, 'red', false);
    expect(guardOf(on.c)).toBe(2 + skillN(on.t, 'resonance'));
  });

  it('Bell Ward: during Peal, the first red to reach him is rung away (one per Peal); without it, it hurts', () => {
    const { on, off } = both('brann', ['bellWard'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    for (const { c } of [on, off]) {
      tapNew(c, 'green', false);
      c.spawnBlock('red', 0.05);
      go(c, c.time + 0.3);
    }
    expect(on.c.hero.hp).toBe(on.c.maxHp());
    expect(off.c.hero.hp).toBeLessThan(off.c.maxHp());
    expect(perks(on.c.drainEvents(), 'bellWard')).toHaveLength(1);
    on.c.spawnBlock('red', 0.05);
    go(on.c, on.c.time + 0.3);
    expect(on.c.hero.hp).toBeLessThan(on.c.maxHp());
  });

  it('Unshaken: a red that hits him still rings the bell', () => {
    const { on, off } = both('brann', ['unshaken'], { tune: (t) => (t.blocks.redTravelSec = 1) });
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.05);
      go(c, c.time + 0.3);
    }
    expect([tollOf(on.c), tollOf(off.c)]).toEqual([1, 0]);
    expect(perks(on.c.drainEvents(), 'unshaken')).toHaveLength(1);
  });

  it('Stunning Toll: a Perfect block stuns its foe for n s (a plain block does not; a boss: its reds wait)', () => {
    const { on, off } = both('brann', ['stunningToll']);
    tapNew(on.c, 'red', false, on.c.enemies[0].id);
    expect(on.c.enemies[0].stun).toBe(0);
    for (const { c } of [on, off]) tapNew(c, 'red', true, c.enemies[0].id);
    expect(on.c.enemies[0].stun).toBeCloseTo(skillN(on.t, 'stunningToll'), 1);
    expect(off.c.enemies[0].stun).toBe(0);
    // a boss shrugs it off (a stun would cancel the special it is telling): only its reds wait
    const boss = fight('brann', ['stunningToll'], { enemies: ['boarKing'] });
    tapNew(boss.c, 'red', true, boss.c.enemies[0].id);
    expect(boss.c.enemies[0].stun).toBe(0);
    expect(boss.c.enemies[0].spawnTimer).toBeGreaterThanOrEqual(skillN(boss.t, 'stunningToll') - 1e-9);
    expect(perks(boss.c.drainEvents(), 'stunningToll')).toHaveLength(1);
  });

  it('Inner Bell: every nth Perfect block sets off a Bulwark with the Guard stored, at once', () => {
    // (Guard never fills here: only Inner Bell sets one off)
    const { on, off } = both('brann', ['innerBell'], { enemies: ['slime', 'slime'], tune: (t) => (HP(t), (t.styles.guardMax = 50)) });
    const n = skillN(on.t, 'innerBell');
    for (const { c } of [on, off]) for (let i = 0; i < n; i++) tapNew(c, 'red', true);
    const on1 = on.c.drainEvents();
    expect(perks(on1, 'innerBell')).toHaveLength(1);
    expect(perks(on1, 'bulwark')).toHaveLength(1);
    expect(on.c.enemies[1].hp).toBeLessThan(5000);
    expect(perks(off.c.drainEvents(), 'bulwark')).toHaveLength(0);
  });
});
