// Relics: every relic's rule in a fight (with and without it), the run-level relics (map, rests, shops), the 1-of-3
// offers, build names, unlocks, saving the relics and a replay's starting picks, and the bot's relic decisions.
import { describe, expect, it } from 'vitest';
import type { RelicId } from '../../src/data/relics';
import { RELICS } from '../../src/data/relics';
import type { NodeType } from '../../src/data/types';
import { offerScore, wantsBlock } from '../../src/core/bot';
import { Combat, newHero, type CombatEvent, type TapResult } from '../../src/core/combat';
import { newProfile, unlockedRelics } from '../../src/core/profile';
import { relicN, RELIC_HOOKS } from '../../src/core/relic-fx';
import { buildName, isSynergy, relicNumber, relicText, sharedTags, unlocksFor } from '../../src/core/relics';
import { Rng } from '../../src/core/rng';
import { isRelicOffer, rollPick, Run } from '../../src/core/run';
import { restoreRun, snapshotRun } from '../../src/core/save';
import { cloneTuning, DEFAULT_SETTINGS, type Tuning } from '../../src/core/tuning';
import { setup, toLastWave } from './helpers';

type SetupOpts = NonNullable<Parameters<typeof setup>[0]>;

/** helpers.setup's test fight (no spawns, no crits, no hit-stop, pinned numbers), with these relics. */
function fight(relics: RelicId[], o: SetupOpts = {}) {
  const base = setup(o);
  const hero = newHero(base.t);
  hero.relics = relics;
  const c = new Combat({ tuning: base.t, settings: base.s, hero, enemies: o.enemies ?? ['slime'], seed: 42, spawning: o.spawning ?? false, specials: o.specials });
  return { c, t: base.t };
}

/** The same fight with and without a relic. */
const both = (id: RelicId, o: SetupOpts = {}) => ({ on: fight([id], o), off: fight([], o) });

const slowReds = (t: Tuning) => (t.blocks.redTravelSec = 10000);
const tune =
  (...fs: Array<(t: Tuning) => void>) =>
  (t: Tuning) => {
    for (const f of fs) f(t);
  };
const alwaysCrit = (t: Tuning) => (t.hero.critChance = 1);
const peckEveryHit = (t: Tuning) => (t.companion.everyHits = 1);

/** Let the fight run for `sec` seconds (to the last whole tick). */
function wait(c: Combat, sec: number): void {
  const end = c.time + sec;
  for (let k = 0; k < 1000; k++) {
    const tick = c.tick;
    c.advanceTo(Math.min(end, c.time + 4));
    if (c.tick === tick) break;
  }
}

/** Tap the next time the cursor crosses bar position `pos` (+ `off`: that far past it), at its speed right now. */
function tapAt(c: Combat, pos: number, off = 0): TapResult {
  const ph = c.cursorPhase;
  const k = Math.floor(ph / 2) * 2;
  const at = [k + pos, k + 2 - pos, k + 2 + pos].filter((p) => p >= ph - 1e-9);
  // `off` along the cursor's way: a little late
  const t = c.time + (Math.min(...at) - ph + off) / c.cursorSpeed();
  wait(c, t - c.time);
  return c.tap(t);
}

const perks = (ev: CombatEvent[], id: string) => ev.filter((e): e is Extract<CombatEvent, { type: 'perk' }> => e.type === 'perk' && e.id === id);
const finisherDmg = (ev: CombatEvent[]) => ev.find((e): e is Extract<CombatEvent, { type: 'finisher' }> => e.type === 'finisher')!.damage;

describe('every relic has a rule', () => {
  it('every relic but the run-level ones has fight hooks; every {n} relic has a live number', () => {
    const runLevel: RelicId[] = ['fieldRations', 'tithe', 'haggler'];
    for (const r of RELICS) {
      if (!runLevel.includes(r.id)) expect(RELIC_HOOKS[r.id], r.id).toBeDefined();
      if (r.text.includes('{n}')) expect(relicN(cloneTuning(), r.id), r.id).toBe(r.n);
    }
    expect(relicText(cloneTuning(), 'glassEdge')).toBe('Crits deal double, but a miss costs 5 HP.');
  });
});

describe('bomb relics', () => {
  it('Powder Keg: tapping a bomb banks a stack', () => {
    const { on, off } = both('powderKeg', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('bomb', 0.5);
      expect(tapAt(c, 0.5).outcome).toBe('block');
    }
    expect(on.c.stacks).toBe(1);
    expect(off.c.stacks).toBe(0);
  });

  it('Short Fuse: a bomb that reaches you blows up on the enemies (no damage, no combo break)', () => {
    const { on, off } = both('shortFuse');
    for (const { c } of [on, off]) {
      c.combo = 6;
      c.spawnBlock('bomb', 0.05);
      c.spawnBlock('yellow', 0.15);
      wait(c, 0.5);
    }
    expect(off.c.hero.hp).toBe(100 - Math.round(off.t.enemies.slime.atk * off.t.blocks.bombHitMult));
    expect(off.c.combo).toBe(0);
    expect(on.c.hero.hp).toBe(100);
    expect(on.c.combo).toBe(6);
    expect(on.c.enemies[0].hp).toBe(80 - on.t.blocks.bombDamage);
    expect(on.c.blocks).toHaveLength(0); // the blast cleared the yellow by it
    const ev = on.c.drainEvents();
    expect(ev.some((e) => e.type === 'explode')).toBe(true);
    expect(perks(ev, 'shortFuse')).toHaveLength(1);
    // a red still hurts
    on.c.spawnBlock('red', 0.05);
    wait(on.c, 0.5);
    expect(on.c.hero.hp).toBe(100 - on.t.enemies.slime.atk);
  });

  it("Sapper's Fuse: every n-th red an enemy's pattern sends comes as a bomb (a red the spawn point turned away counts once)", () => {
    const kinds = (relics: RelicId[]) => {
      const { c } = fight(relics);
      const e = c.enemies[0];
      const out: string[] = [];
      for (let seq = 0; seq < 8; seq++) {
        e.seq = seq;
        if (seq === 3) {
          // the spawn point is busy: the 4th red waits, then comes
          const blocker = c.spawnBlock('red', 0.96);
          expect(c.trySpawn('red', e.id)).toBe(false);
          c.removeBlock(blocker, 'expire');
        }
        expect(c.trySpawn('red', e.id)).toBe(true);
        const b = c.blocks.find((x) => x.kind !== 'yellow')!;
        out.push(b.kind);
        c.removeBlock(b, 'expire');
      }
      return out;
    };
    expect(relicN(cloneTuning(), 'sapper')).toBe(4);
    expect(kinds(['sapper'])).toEqual(['red', 'red', 'red', 'bomb', 'red', 'red', 'red', 'bomb']);
    expect(kinds([])).toEqual(Array(8).fill('red'));
    // other kinds aren't counted or changed
    const { c } = fight(['sapper']);
    for (let i = 0; i < 6; i++) {
      c.enemies[0].seq = i;
      c.trySpawn('shield', c.enemies[0].id);
      const b = c.blocks[0];
      expect(b.kind).toBe('shield');
      c.removeBlock(b, 'expire');
    }
  });

  it("Blast Wave: the yellows a tapped bomb's blast clears count as your hits (damage, combo, meter)", () => {
    const { on, off } = both('blastWave', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.38);
      c.spawnBlock('bomb', 0.5);
      c.spawnBlock('green', 0.64);
      c.spawnBlock('yellow', 0.9); // out of the blast
      tapAt(c, 0.5);
    }
    const T = on.t;
    expect(off.c.combo).toBe(1);
    expect(off.c.enemies[0].hp).toBe(80 - T.blocks.bombDamage);
    expect(on.c.combo).toBe(3);
    expect(on.c.enemies[0].hp).toBe(80 - T.blocks.bombDamage - T.hero.atk - T.hero.atk * T.hero.greenMult);
    expect(on.c.meter).toBeCloseTo(off.c.meter + T.meter.perHit + T.meter.perGreen);
    expect(on.c.hero.abilityTimer).toBeGreaterThan(0); // the green's ability too
    expect(on.c.blocks.map((b) => b.pos)).toEqual([0.9]);
    const ev = on.c.drainEvents();
    expect(ev.filter((e) => e.type === 'hit' && e.echo)).toHaveLength(2);
    expect(perks(ev, 'blastWave')[0].amount).toBe(2);
  });

  it('Parting Gift: after a finisher, a bomb rolls onto the bar', () => {
    const { on, off } = both('partingGift');
    for (const { c } of [on, off]) {
      c.stacks = 1;
      c.finisher();
    }
    expect(on.c.blocks.map((b) => b.kind)).toEqual(['bomb']);
    expect(on.c.blocks[0].pos).toBeGreaterThan(0.9);
    expect(off.c.blocks).toHaveLength(0);
    // nothing left to throw it: no bomb
    const last = fight(['partingGift']);
    last.c.enemies[0].hp = 10;
    last.c.stacks = 1;
    last.c.finisher();
    expect(last.c.blocks).toHaveLength(0);
  });
});

describe('crit relics', () => {
  it('Sharpshooter: a Perfect always crits', () => {
    const { on, off } = both('sharpshooter');
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      expect(tapAt(c, 0.3).perfect).toBe(true);
      c.spawnBlock('yellow', 0.6);
      expect(tapAt(c, 0.6, 0.04).perfect).toBe(false);
    }
    expect(on.c.enemies[0].hp).toBe(80 - 20 - 10);
    expect(off.c.enemies[0].hp).toBe(80 - 10 - 10);
  });

  it('Glass Edge: crits deal double, but a miss costs n HP more', () => {
    const { on, off } = both('glassEdge', { tune: alwaysCrit });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
      expect(tapAt(c, 0.6).outcome).toBe('miss');
    }
    const T = on.t;
    expect(off.c.enemies[0].hp).toBe(80 - T.hero.atk * T.hero.critDmg);
    expect(on.c.enemies[0].hp).toBe(80 - T.hero.atk * T.hero.critDmg * 2);
    expect(off.c.hero.hp).toBe(100 - T.judge.missSelfDamage);
    expect(on.c.hero.hp).toBe(100 - T.judge.missSelfDamage - relicN(T, 'glassEdge'));
  });

  it('Last Stand: below n% HP every hit crits', () => {
    const low = both('lastStand');
    const high = fight(['lastStand']);
    low.on.c.hero.hp = low.off.c.hero.hp = 29;
    high.c.hero.hp = 31;
    for (const { c } of [low.on, low.off, high]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3, 0.03);
    }
    expect(low.on.c.enemies[0].hp).toBe(80 - 20);
    expect(low.off.c.enemies[0].hp).toBe(80 - 10);
    expect(high.c.enemies[0].hp).toBe(80 - 10);
    expect(perks(low.on.c.drainEvents(), 'lastStand')).toHaveLength(1);
  });

  it('Weak Spot: the first hit after a block always crits (a cracked shield counts)', () => {
    const { on, off } = both('weakSpot', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('shield', 0.25);
      c.spawnBlock('yellow', 0.5);
      c.spawnBlock('yellow', 0.75);
      expect(tapAt(c, 0.25).outcome).toBe('crack');
      tapAt(c, 0.5, 0.03);
      tapAt(c, 0.75, 0.03);
    }
    expect(on.c.enemies[0].hp).toBe(80 - 20 - 10);
    expect(off.c.enemies[0].hp).toBe(80 - 10 - 10);
  });

  it('Ricochet: a crit also hits the next foe for the same damage (but not off an echo hit)', () => {
    const { on, off } = both('ricochet', { enemies: ['slime', 'slime'], tune: alwaysCrit });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
    }
    expect(on.c.enemies.map((e) => e.hp)).toEqual([60, 60]);
    expect(off.c.enemies.map((e) => e.hp)).toEqual([60, 80]);
    // a Blast Wave hit is an echo: no ricochet off it
    const echo = fight(['blastWave', 'ricochet'], { enemies: ['slime', 'slime'], tune: tune(alwaysCrit, slowReds) });
    echo.c.spawnBlock('bomb', 0.5);
    echo.c.spawnBlock('yellow', 0.62);
    tapAt(echo.c, 0.5);
    const bomb = echo.t.blocks.bombDamage;
    expect(echo.c.enemies.map((e) => e.hp)).toEqual([80 - bomb - 20, 80 - bomb]);
  });

  it("Hunting Owl: Pip's pecks roll your crit chance and deal your crit damage", () => {
    const { on, off } = both('huntingOwl', { tune: tune(alwaysCrit, peckEveryHit) });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
    }
    const pet = (c: Combat) => c.drainEvents().find((e): e is Extract<CombatEvent, { type: 'pet' }> => e.type === 'pet')!;
    const T = on.t;
    expect(pet(off.c)).toMatchObject({ crit: false, damage: T.companion.damage });
    expect(pet(on.c)).toMatchObject({ crit: true, damage: T.companion.damage * T.hero.critDmg });
    // no crit chance, no crit
    const never = fight(['huntingOwl'], { tune: peckEveryHit });
    never.c.spawnBlock('yellow', 0.3);
    tapAt(never.c, 0.3);
    expect(pet(never.c)).toMatchObject({ crit: false, damage: T.companion.damage });
  });

  it('Lucky Penny: every crit drops n coin (a peck crit too)', () => {
    const { on, off } = both('luckyPenny', { tune: alwaysCrit });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('yellow', 0.6);
      tapAt(c, 0.3);
      tapAt(c, 0.6);
    }
    expect(on.c.coinsEarned).toBe(2 * relicN(on.t, 'luckyPenny'));
    expect(off.c.coinsEarned).toBe(0);
    expect(on.c.drainEvents().filter((e) => e.type === 'coins' && e.id === 'luckyPenny')).toHaveLength(2);
    const owl = fight(['luckyPenny', 'huntingOwl'], { tune: tune(alwaysCrit, peckEveryHit) });
    owl.c.spawnBlock('yellow', 0.3);
    tapAt(owl.c, 0.3);
    expect(owl.c.coinsEarned).toBe(2);
  });
});

describe('block relics', () => {
  it('Iron Rhythm: every 3rd block in a row counterattacks its owner for n x attack (a hit starts the count over)', () => {
    const { on, off } = both('ironRhythm', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.3);
      c.spawnBlock('shield', 0.5);
      c.spawnBlock('red', 0.75);
      tapAt(c, 0.3);
      expect(tapAt(c, 0.5).outcome).toBe('crack');
      tapAt(c, 0.75);
    }
    expect(on.c.enemies[0].hp).toBe(80 - relicN(on.t, 'ironRhythm') * on.t.hero.atk);
    expect(off.c.enemies[0].hp).toBe(80);
    expect(perks(on.c.drainEvents(), 'ironRhythm')[0].amount).toBe(20);
    // block, block, hit, block: no counter
    const broken = fight(['ironRhythm'], { tune: slowReds });
    broken.c.spawnBlock('red', 0.2);
    broken.c.spawnBlock('red', 0.4);
    broken.c.spawnBlock('yellow', 0.6);
    broken.c.spawnBlock('red', 0.8);
    for (const p of [0.2, 0.4, 0.6, 0.8]) tapAt(broken.c, p);
    expect(broken.c.enemies[0].hp).toBe(80 - 10);
  });

  it('Mirror Guard: a Perfect block throws the attack back at its owner (a bomb harder); a plain block does not', () => {
    const { on, off } = both('mirrorGuard', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.3);
      c.spawnBlock('red', 0.6);
      expect(tapAt(c, 0.3).perfect).toBe(true);
      const plain = tapAt(c, 0.6, 0.03);
      expect(plain.outcome).toBe('block');
      expect(plain.perfect).toBe(false);
    }
    const atk = on.t.enemies.slime.atk;
    expect(on.c.enemies[0].hp).toBe(80 - atk);
    expect(off.c.enemies[0].hp).toBe(80);
    const bomb = fight(['mirrorGuard'], { tune: slowReds });
    bomb.c.spawnBlock('bomb', 0.5);
    tapAt(bomb.c, 0.5);
    expect(bomb.c.enemies[0].hp).toBe(80 - bomb.t.blocks.bombDamage - Math.round(atk * bomb.t.blocks.bombHitMult));
  });

  it("Turtle Shell: shield reds need one tap less (the Golem's 3-tap wall too)", () => {
    const { on, off } = both('turtleShell', { tune: slowReds });
    for (const { c } of [on, off]) c.spawnBlock('shield', 0.5);
    expect(tapAt(on.c, 0.5).outcome).toBe('block');
    expect(tapAt(off.c, 0.5).outcome).toBe('crack');
    expect(perks(on.c.drainEvents(), 'turtleShell')).toHaveLength(1);
    const wall = fight(['turtleShell']);
    expect(wall.c.spawnBlock('shield', 0.5, wall.c.enemies[0].id, 0.2, { taps: 3 }).taps).toBe(2);
    expect(wall.c.spawnBlock('red', 0.8).taps).toBe(1);
  });

  it('Shieldbearer: only blocks fill the meter, but n x as much', () => {
    const { on, off } = both('shieldbearer', { tune: slowReds });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
    }
    expect(off.c.meter).toBeGreaterThan(0);
    expect(on.c.meter).toBe(0);
    const before = { on: on.c.meter, off: off.c.meter };
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.6);
      tapAt(c, 0.6);
    }
    expect(on.c.meter - before.on).toBeCloseTo((off.c.meter - before.off) * relicN(on.t, 'shieldbearer'));
  });

  it('Night Watch: every n-th peck, Pip also blocks the red closest to you', () => {
    const { on, off } = both('nightWatch', { tune: tune(slowReds, peckEveryHit, (t) => (t.relics.n.nightWatch = 2)) });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.15);
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('red', 0.6);
      c.spawnBlock('red', 0.85);
      tapAt(c, 0.15); // peck 1
      expect(c.blocks.filter((b) => b.kind === 'red')).toHaveLength(2);
      tapAt(c, 0.3); // peck 2: Pip blocks the red at 0.6
    }
    expect(on.c.blocks).toHaveLength(1);
    expect(on.c.blocks[0].pos).toBeCloseTo(0.85, 3);
    expect(on.c.combo).toBe(3);
    expect(off.c.blocks).toHaveLength(2);
    expect(off.c.combo).toBe(2);
    expect(on.c.drainEvents().some((e) => e.type === 'block' && e.echo)).toBe(true);
  });
});

describe('combo relics', () => {
  it('Chain Reaction: every n combo, every yellow on the bar turns green', () => {
    const { on, off } = both('chainReaction');
    for (const { c } of [on, off]) {
      c.combo = relicN(on.t, 'chainReaction') - 1;
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('yellow', 0.6);
      c.spawnBlock('yellow', 0.8);
      tapAt(c, 0.3);
    }
    expect(on.c.blocks.map((b) => b.kind)).toEqual(['green', 'green']);
    expect(off.c.blocks.map((b) => b.kind)).toEqual(['yellow', 'yellow']);
    expect(on.c.drainEvents().filter((e) => e.type === 'morph')).toHaveLength(2);
  });

  it('Momentum: hit damage grows with the cursor speed, +n% at its max', () => {
    const { on, off } = both('momentum');
    for (const { c } of [on, off]) {
      c.combo = 80; // the cursor at its top speed
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
    }
    expect(on.c.speedMult()).toBe(on.t.cursor.maxSpeedMult);
    expect(on.c.enemies[0].hp).toBe(80 - 10 * (1 + relicN(on.t, 'momentum') / 100));
    expect(off.c.enemies[0].hp).toBe(80 - 10);
    // at the starting speed: nothing extra
    const slow = fight(['momentum'], { tune: (t) => (t.cursor.speedPerHit = 0) });
    slow.c.spawnBlock('yellow', 0.3);
    tapAt(slow.c, 0.3);
    expect(slow.c.enemies[0].hp).toBe(80 - 10);
  });

  it('Crescendo: the finisher deals +n% per combo it was fired at', () => {
    const { on, off } = both('crescendo', { enemies: ['bandit'] });
    for (const { c } of [on, off]) {
      c.combo = 20;
      c.stacks = 1;
      c.finisher();
    }
    const base = finisherDmg(off.c.drainEvents());
    expect(finisherDmg(on.c.drainEvents())).toBe(Math.round(base * (1 + (relicN(on.t, 'crescendo') * 20) / 100)));
  });

  it('Clutch: a miss no longer breaks the combo, but costs n HP', () => {
    const { on, off } = both('clutch');
    for (const { c } of [on, off]) {
      c.combo = 7;
      c.stacks = 2;
      expect(tapAt(c, 0.5).outcome).toBe('miss');
    }
    expect(on.c.combo).toBe(7);
    expect(on.c.stacks).toBe(2);
    expect(on.c.hero.hp).toBe(100 - relicN(on.t, 'clutch'));
    expect(off.c.combo).toBe(0);
    expect(off.c.stacks).toBe(0);
    expect(off.c.hero.hp).toBe(100 - off.t.judge.missSelfDamage);
  });

  it('Overdrive: at n+ combo you deal double damage and take double', () => {
    const { on, off } = both('overdrive');
    const at = relicN(on.t, 'overdrive');
    for (const { c } of [on, off]) {
      c.combo = at - 1;
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3); // this hit reaches n
    }
    expect(on.c.enemies[0].hp).toBe(80 - 20);
    expect(off.c.enemies[0].hp).toBe(80 - 10);
    expect(perks(on.c.drainEvents(), 'overdrive')).toHaveLength(1);
    for (const { c } of [on, off]) {
      c.spawnBlock('red', 0.05);
      wait(c, 0.4);
    }
    const atk = on.t.enemies.slime.atk;
    expect(on.c.hero.hp).toBe(100 - 2 * atk);
    expect(off.c.hero.hp).toBe(100 - atk);
    expect(on.c.combo).toBe(0);
    // below n: normal damage
    on.c.spawnBlock('red', 0.05);
    wait(on.c, 0.4);
    expect(on.c.hero.hp).toBe(100 - 3 * atk);
  });

  it('Gold Fever: +1 coin every 10 combo', () => {
    const { on, off } = both('goldFever');
    for (const { c } of [on, off]) {
      c.combo = 9;
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('yellow', 0.6);
      tapAt(c, 0.3); // 10
      tapAt(c, 0.6); // 11
    }
    expect(on.c.coinsEarned).toBe(1);
    expect(off.c.coinsEarned).toBe(0);
  });
});

describe('finisher relics', () => {
  it('Sweeper: the finisher no longer resets the combo', () => {
    const { on, off } = both('sweeper', { enemies: ['bandit'] });
    for (const { c } of [on, off]) {
      c.combo = 12;
      c.stacks = 1;
      c.finisher();
    }
    expect(on.c.combo).toBe(12);
    expect(off.c.combo).toBe(0);
  });

  it('Hoarder: a miss costs 1 stack instead of all of them', () => {
    const { on, off } = both('hoarder');
    for (const { c } of [on, off]) {
      c.combo = 5;
      c.stacks = 3;
      tapAt(c, 0.5);
    }
    expect(on.c.stacks).toBe(2);
    expect(off.c.stacks).toBe(0);
  });

  it('Overcharge: +2 max stacks, but n s without a hit while holding stacks loses one (a hit restarts the wait)', () => {
    const { on, off } = both('overcharge');
    expect(on.c.maxStacks()).toBe(off.c.maxStacks() + 2);
    const n = relicN(on.t, 'overcharge');
    for (const { c } of [on, off]) {
      c.stacks = 3;
      wait(c, n - 0.1);
    }
    expect(on.c.stacks).toBe(3);
    wait(on.c, 0.2);
    wait(off.c, 0.2);
    expect(on.c.stacks).toBe(2);
    expect(off.c.stacks).toBe(3);
    wait(on.c, n);
    expect(on.c.stacks).toBe(1);
    // a hit restarts the wait
    on.c.spawnBlock('yellow', 0.5);
    wait(on.c, n - 1);
    tapAt(on.c, 0.5);
    wait(on.c, n - 1);
    expect(on.c.stacks).toBe(1);
    // the meter can bank up to 7
    const full = fight(['overcharge']);
    full.c.stacks = 6;
    full.c.meter = 0.99;
    full.c.spawnBlock('yellow', 0.5);
    tapAt(full.c, 0.5);
    expect(full.c.stacks).toBe(7);
  });

  it('Quick Draw: a 1-stack finisher deals n x damage (more stacks: as usual)', () => {
    const one = both('quickDraw', { enemies: ['bandit'] });
    const two = both('quickDraw', { enemies: ['bandit'] });
    for (const { c } of [one.on, one.off]) c.stacks = 1;
    for (const { c } of [two.on, two.off]) c.stacks = 2;
    for (const { c } of [one.on, one.off, two.on, two.off]) c.finisher();
    expect(finisherDmg(one.on.c.drainEvents())).toBe(finisherDmg(one.off.c.drainEvents()) * relicN(one.on.t, 'quickDraw'));
    expect(finisherDmg(two.on.c.drainEvents())).toBe(finisherDmg(two.off.c.drainEvents()));
  });

  it('Echo Strike: n% of the finisher hits the same foes again a moment later (the dead ones skipped)', () => {
    const { on, off } = both('echoStrike', { enemies: ['slime', 'bandit'] });
    for (const { c } of [on, off]) {
      c.enemies[0].hp = 30; // the finisher kills the slime
      c.stacks = 1;
      c.finisher();
    }
    const fin = finisherDmg(on.c.drainEvents());
    const after = 140 - fin;
    expect(on.c.enemies[1].hp).toBe(after);
    wait(on.c, on.t.relics.echoDelay - 0.1);
    expect(on.c.enemies[1].hp).toBe(after);
    wait(on.c, 0.2);
    wait(off.c, on.t.relics.echoDelay + 0.1);
    const echo = Math.round((fin * relicN(on.t, 'echoStrike')) / 100);
    expect(on.c.enemies[1].hp).toBe(after - echo);
    expect(off.c.enemies[1].hp).toBe(after);
    const ev = perks(on.c.drainEvents(), 'echoStrike');
    expect(ev.map((e) => e.enemyId)).toEqual([on.c.enemies[1].id]);
  });

  it('Blood Price: the finisher deals double but costs n% of your HP (never the last one)', () => {
    const { on, off } = both('bloodPrice', { enemies: ['bandit'] });
    for (const { c } of [on, off]) {
      c.stacks = 1;
      c.finisher();
    }
    expect(finisherDmg(on.c.drainEvents())).toBe(2 * finisherDmg(off.c.drainEvents()));
    expect(on.c.hero.hp).toBe(100 - relicN(on.t, 'bloodPrice'));
    expect(off.c.hero.hp).toBe(100);
    const low = fight(['bloodPrice'], { enemies: ['bandit'] });
    low.c.hero.hp = 4;
    low.c.stacks = 1;
    low.c.finisher();
    expect(low.c.hero.hp).toBe(1);
    expect(low.c.result).toBeNull();
  });

  it("Purple Pact: a tapped trap doesn't trigger: you take n damage, keep the combo and bank a stack", () => {
    const { on, off } = both('purplePact');
    for (const { c } of [on, off]) {
      c.combo = 5;
      c.spawnBlock('purple', 0.5);
      expect(tapAt(c, 0.5).outcome).toBe('trap');
    }
    expect(on.c.hero.hp).toBe(100 - relicN(on.t, 'purplePact'));
    expect(on.c.combo).toBe(5);
    expect(on.c.stacks).toBe(1);
    expect(off.c.hero.hp).toBe(100 - off.t.enemies.slime.special);
    expect(off.c.combo).toBe(0);
    expect(off.c.stacks).toBe(0);
    expect(on.c.drainEvents().some((e) => e.type === 'trap')).toBe(false);
  });
});

describe('green relics', () => {
  it('Greenhouse: greens come twice as often (some yellows come green); yellows deal n% less', () => {
    const spawns = (relics: RelicId[]) => {
      const { c } = fight(relics);
      const kinds: string[] = [];
      for (let i = 0; i < 70; i++) {
        expect(c.trySpawn('yellow', c.enemies[0].id)).toBe(true);
        kinds.push(c.blocks[0].kind);
        c.removeBlock(c.blocks[0], 'expire');
      }
      return kinds;
    };
    // the slime's pattern has one green per 7 yellows: one in 7 of its yellows now comes green
    expect(spawns(['greenhouse']).filter((k) => k === 'green')).toHaveLength(10);
    expect(spawns([]).filter((k) => k === 'green')).toHaveLength(0);
    const { on, off } = both('greenhouse');
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('green', 0.6);
      tapAt(c, 0.3);
    }
    expect(on.c.enemies[0].hp).toBe(80 - 10 * (1 - relicN(on.t, 'greenhouse') / 100));
    expect(off.c.enemies[0].hp).toBe(80 - 10);
    for (const { c } of [on, off]) tapAt(c, 0.6);
    expect(80 - 8 - on.c.enemies[0].hp).toBe(80 - 10 - off.c.enemies[0].hp); // greens as usual
  });

  it('Greenhouse: an enemy whose pattern has no greens gets the average share', () => {
    const { c } = fight(['greenhouse'], { enemies: ['slimelet'] });
    let greens = 0;
    for (let i = 0; i < 200; i++) {
      c.trySpawn('yellow', c.enemies[0].id);
      if (c.blocks[0].kind === 'green') greens++;
      c.removeBlock(c.blocks[0], 'expire');
    }
    expect(greens).toBeGreaterThan(20);
    expect(greens).toBeLessThan(60);
  });

  it('Verdant Surge: a green hit banks a whole finisher stack', () => {
    const { on, off } = both('verdantSurge');
    for (const { c } of [on, off]) {
      c.spawnBlock('green', 0.3);
      tapAt(c, 0.3);
    }
    expect(on.c.stacks).toBe(1);
    expect(off.c.stacks).toBe(0);
  });

  it('Evergreen: while the green ability is on, a Perfect restarts it', () => {
    const { on, off } = both('evergreen');
    for (const { c } of [on, off]) {
      c.spawnBlock('green', 0.2);
      c.spawnBlock('yellow', 0.9);
      tapAt(c, 0.2);
      expect(c.hero.abilityTimer).toBeCloseTo(c.abilitySec());
      expect(tapAt(c, 0.9).perfect).toBe(true);
    }
    expect(on.c.hero.abilityTimer).toBeCloseTo(on.c.abilitySec());
    expect(off.c.hero.abilityTimer).toBeLessThan(off.c.abilitySec() - 0.5);
    // with the ability off, a Perfect does nothing
    const idle = fight(['evergreen']);
    idle.c.spawnBlock('yellow', 0.3);
    tapAt(idle.c, 0.3);
    expect(idle.c.hero.abilityTimer).toBe(0);
  });

  it('Photosynthesis: a green hit heals n% of max HP', () => {
    const { on, off } = both('photosynthesis');
    for (const { c } of [on, off]) {
      c.hero.hp = 50;
      c.spawnBlock('green', 0.3);
      c.spawnBlock('yellow', 0.6);
      tapAt(c, 0.3);
      tapAt(c, 0.6);
    }
    expect(on.c.hero.hp).toBe(50 + relicN(on.t, 'photosynthesis'));
    expect(off.c.hero.hp).toBe(50);
  });
});

describe('Pip and sustain relics', () => {
  it("Treasure Nose: each of Pip's pecks steals n coin", () => {
    const { on, off } = both('treasureNose', { tune: peckEveryHit });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('yellow', 0.6);
      tapAt(c, 0.3);
      tapAt(c, 0.6);
    }
    expect(on.c.coinsEarned).toBe(2 * relicN(on.t, 'treasureNose'));
    expect(off.c.coinsEarned).toBe(0);
  });

  it("Wingman: Pip's pecks fill the meter like a hit", () => {
    const { on, off } = both('wingman', { tune: peckEveryHit });
    for (const { c } of [on, off]) {
      c.spawnBlock('yellow', 0.3);
      tapAt(c, 0.3);
    }
    expect(on.c.meter - off.c.meter).toBeCloseTo(on.t.meter.perHit);
  });

  it('Vampiric Fang: every attack hit heals n HP', () => {
    const { on, off } = both('vampiricFang');
    for (const { c } of [on, off]) {
      c.hero.hp = 50;
      c.spawnBlock('yellow', 0.3);
      c.spawnBlock('green', 0.6);
      tapAt(c, 0.3);
      tapAt(c, 0.6);
    }
    expect(on.c.hero.hp).toBe(50 + 2 * relicN(on.t, 'vampiricFang'));
    expect(off.c.hero.hp).toBe(50);
  });
});
