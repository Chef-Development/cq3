// The anti-spam rules (playtest round 7: "late fights become spam, spam, finisher x5, spam"), each with and without:
// the bar's crowding limit, each finisher stack costing more than the last, Meter Gain's and meter relics'
// diminishing returns, the heal cap per fight and heal effects stacking with diminishing returns, the cap on misses
// forgiven (a forgiven miss still costs the meter's fill), and a Classic-mode miss costing a share of max HP.
// (The masher who taps without aiming losing every region's Act 3 and boss is tests/unit/bot-masher.test.ts.)
import { describe, expect, it } from 'vitest';
import { Combat, newHero, type CombatEvent } from '../../src/core/combat';
import type { RelicId } from '../../src/data/relics';
import { setup, timeAt } from './helpers';

type Opts = NonNullable<Parameters<typeof setup>[0]>;

const perks = (ev: CombatEvent[], id: string) => ev.filter((e) => e.type === 'perk' && e.id === id);

/** helpers.setup's fight with these relics. */
function withRelics(relics: RelicId[], o: Opts = {}) {
  const base = setup(o);
  const hero = newHero(base.t);
  hero.relics = relics;
  const c = new Combat({ tuning: base.t, settings: base.s, hero, enemies: o.enemies ?? ['slime'], seed: 42, spawning: o.spawning ?? false });
  c.perk.resolve = 1;
  return { c, t: base.t };
}

/** Run the fight for `sec`, watching the share of the bar its blocks cover; nothing is tapped. */
function watch(c: Combat, sec: number): { peak: number; spawned: Record<string, number> } {
  let peak = 0;
  const spawned: Record<string, number> = {};
  for (let k = 1; k <= sec * 120; k++) {
    c.advanceTo(k / 120);
    peak = Math.max(peak, c.covered());
    for (const e of c.drainEvents()) if (e.type === 'spawn') spawned[e.kind] = (spawned[e.kind] ?? 0) + 1;
  }
  return { peak, spawned };
}

describe('the bar never fills up (tuning.spam.cover)', () => {
  // a foe that only sends yellows, fast, left untouched: the bar fills up to the limit and stops taking statics
  const busy = (cover: number) =>
    setup({
      spawning: true,
      enemies: ['slime'],
      settings: { godMode: true },
      tune: (t) => {
        t.spam.cover = cover;
        t.enemies.slime.hp = 1e6;
        t.enemies.slime.pattern = 'Y';
        t.enemies.slime.specials = [];
        t.enemies.slime.interval = 0.2;
        t.blocks.maxStatic = 12;
        t.blocks.minGap = 0;
      },
    });

  it('statics stop at the limit; without it the bar fills far past it', () => {
    const on = busy(0.45);
    const off = busy(1);
    const a = watch(on.c, 15);
    const b = watch(off.c, 15);
    expect(a.peak).toBeLessThanOrEqual(0.45 + 1e-9);
    expect(b.peak).toBeGreaterThan(0.6);
    expect(on.c.tally.refused).toBeGreaterThan(5);
    expect(off.c.tally.refused).toBe(0);
  });

  it("reds always come: a crowded bar doesn't hold back a foe's attacks, and the pattern goes on at its pace", () => {
    const run = (cover: number) => {
      const { c } = setup({
        spawning: true,
        enemies: ['slime'],
        settings: { godMode: true },
        tune: (t) => {
          t.spam.cover = cover;
          t.enemies.slime.hp = 1e6;
          t.enemies.slime.pattern = 'YYR';
          t.enemies.slime.specials = [];
          t.enemies.slime.interval = 0.5;
        },
      });
      // the bar already crowded with statics the player isn't tapping
      for (const p of [0.1, 0.25, 0.4, 0.55, 0.7]) c.spawnBlock('yellow', p);
      c.drainEvents();
      return watch(c, 6).spawned;
    };
    const on = run(0.3);
    const off = run(1);
    expect(on.yellow ?? 0).toBe(0); // no room for the yellows...
    expect(off.yellow).toBeGreaterThan(0);
    // ...but the reds came all the same, on time: the pattern YYR every 0.5 s is a red every 1.5 s
    expect(on.red).toBeGreaterThanOrEqual(3);
    expect(on.red).toBeLessThanOrEqual(5);
  });

  it('a bar with nothing to hit always takes a yellow (the refill), however crowded with reds', () => {
    const { c } = setup({ spawning: true, enemies: ['slime'], settings: { godMode: true }, tune: (t) => ((t.spam.cover = 0.2), (t.enemies.slime.pattern = 'R'), (t.enemies.slime.specials = []), (t.blocks.redTravelSec = 10000)) });
    for (const p of [0.5, 0.65, 0.8]) c.spawnBlock('red', p);
    expect(c.covered()).toBeGreaterThan(0.2);
    c.advanceTo(0.5);
    expect(c.blocks.filter((b) => b.kind === 'yellow').length).toBeGreaterThanOrEqual(1);
  });

  it("the hero's own blocks and the foes' formations aren't held back", () => {
    const { c } = setup({ tune: (t) => (t.spam.cover = 0.1) });
    c.spawnBlock('yellow', 0.3);
    c.spawnBlock('yellow', 0.6);
    expect(c.trySpawn('green', c.enemies[0].id)).toBe(true); // a perk's green (Starlight, a Seedling)
    expect(c.trySpawn('yellow', c.enemies[0].id, true)).toBe(false); // a foe's pattern: no room
    expect(c.crowded).toBe(true);
  });
});

describe('each finisher stack costs more than the last (tuning.spam.stackStep)', () => {
  const fills = (step: number) => {
    const { c } = setup({ tune: (t) => ((t.spam.stackStep = step), (t.meter.maxStacks = 5)) });
    const per: number[] = [];
    let n = 0;
    while (c.stacks < 5 && n < 200) {
      const before = c.stacks;
      c.fillMeter(0.1, 'hit');
      n++;
      if (c.stacks > before) per.push(n), (n = 0);
    }
    return per;
  };

  it('6 / 8 / 10 / 12 / 14 hits at the defaults; 6 each without', () => {
    const { t } = setup();
    expect(t.spam.stackStep).toBeCloseTo(0.32);
    const hits = (step: number) => {
      const { c } = setup({ tune: (tt) => (tt.spam.stackStep = step) });
      const out: number[] = [];
      for (let k = 0; k < 5; k++) {
        out.push(Math.round(c.hitsToStack()));
        c.stacks++;
        c.meter = 0;
      }
      return out;
    };
    expect(hits(t.spam.stackStep)).toEqual([6, 8, 10, 12, 14]);
    expect(hits(0)).toEqual([6, 6, 6, 6, 6]);
  });

  it('the meter banks stack after stack, each taking longer', () => {
    expect(fills(0)).toEqual([10, 10, 10, 10, 10]);
    expect(fills(0.5)).toEqual([10, 15, 20, 25, 30]);
  });

  it('the meter shows the fill toward the next stack (0..1)', () => {
    const { c } = setup({ tune: (t) => (t.spam.stackStep = 1) });
    c.fillMeter(1, 'hit'); // the first stack
    c.fillMeter(1, 'hit'); // half of the second (it costs 2)
    expect(c.stacks).toBe(1);
    expect(c.meter).toBeCloseTo(0.5);
  });
});

describe('Meter Gain and meter relics stack with diminishing returns', () => {
  it('Meter Gain counts in full up to the knee, then less and less, never past knee + soft', () => {
    const at = (g: number, soft = 0.5) => {
      const { c } = setup({ tune: (t) => ((t.spam.meterKnee = 0.25), (t.spam.meterSoft = soft)) });
      c.hero.gear = { ...c.hero.gear, stats: { ...c.hero.gear.stats, meterGain: g } };
      return c.meterGain();
    };
    expect(at(0.2)).toBeCloseTo(0.2);
    expect(at(0.5)).toBeLessThan(0.5);
    expect(at(0.5)).toBeGreaterThan(0.3);
    expect(at(1)).toBeGreaterThan(at(0.5));
    expect(at(5)).toBeLessThan(0.75);
    expect(at(1, 0)).toBeCloseTo(0.25);
  });

  it('the second relic to add meter in a fight adds less (its fill and its stacks); without the rule both count in full', () => {
    const run = (step: number) => {
      const { c } = setup({ tune: (t) => (t.spam.meterStack = step) });
      c.fillMeter(0.1, 'peck', 'wingman');
      const first = c.meter;
      c.fillMeter(0.1, 'hit', 'slipstream');
      const second = c.meter - first;
      c.meter = 0;
      const banked = c.bankStacks(1, 'powderKeg'); // a third relic's stack
      return { first, second, banked, meter: c.meter };
    };
    const on = run(0.5);
    const off = run(0);
    expect(on.first).toBeCloseTo(0.1);
    expect(on.second).toBeCloseTo(0.1 / 1.5);
    expect(on.banked).toBe(0); // half a stack's meter (1 / (1 + 2 x 0.5))
    expect(on.meter).toBeCloseTo(0.5);
    expect(off.second).toBeCloseTo(0.1);
    expect(off.banked).toBe(1);
  });

  it("a kit's or skill's stacks are never cut (only relics stack this way)", () => {
    const { c } = setup({ tune: (t) => (t.spam.meterStack = 1) });
    c.fillMeter(0.1, 'peck', 'wingman');
    expect(c.bankStacks(1, 'chargedUp')).toBe(1);
  });
});

describe('heals per fight are capped, and heal effects stack with diminishing returns', () => {
  it('a fight heals at most healCap of max HP (kills included); the view says so once', () => {
    const run = (cap: number) => {
      const { c } = setup({ tune: (t) => (t.spam.healCap = cap) });
      c.hero.hp = 10;
      let healed = 0;
      for (let k = 0; k < 20; k++) healed += c.healPerk(5, 'vampiricFang');
      return { c, healed };
    };
    const on = run(0.35);
    const off = run(2);
    expect(on.healed).toBe(35); // max HP 100
    expect(off.healed).toBe(90); // up to full
    expect(on.c.tally.healCut).toBeGreaterThan(0);
    expect(perks(on.c.drainEvents(), 'healCap')).toHaveLength(1);
    expect(perks(off.c.drainEvents(), 'healCap')).toHaveLength(0);
  });

  it('a revive is not a heal (the cap never stops one)', () => {
    const { c } = setup({ tune: (t) => (t.spam.healCap = 0) });
    c.hero.revives = 1;
    c.hurtHero(500, 'bloodPrice');
    expect(c.hero.hp).toBeGreaterThan(0);
    expect(c.result).toBe(null);
  });

  it('the second heal source to heal in a fight heals less, the third less again; without the rule each heals in full', () => {
    const run = (step: number) => {
      const { c } = setup({ tune: (t) => ((t.spam.healStack = step), (t.spam.healCap = 2)) });
      c.hero.hp = 10;
      return ['photosynthesis', 'vampiricFang', 'mend', 'photosynthesis'].map((id) => c.healPerk(12, id));
    };
    expect(run(0.5)).toEqual([12, 8, 6, 12]);
    expect(run(0)).toEqual([12, 12, 12, 12]);
  });
});

describe('a miss always costs something', () => {
  it('Classic mode: a miss costs a share of max HP (a flat 1 HP was nothing to a late hero)', () => {
    const run = (share: number) => {
      const { c, t } = setup({ tune: (tt) => (tt.judge.missHpShare = share) });
      c.hero.bonusMaxHp = 400; // 500 max HP
      c.hero.hp = 500;
      c.advanceTo(0.5);
      expect(c.tap(timeAt(t, 0.3)).outcome).toBe('miss');
      return 500 - c.hero.hp;
    };
    expect(run(0.006)).toBe(3);
    expect(run(0)).toBe(1); // judge.missSelfDamage
  });

  it('a miss right after a miss costs more (a flailing thumb), up to missStreakMax times; misses apart cost the same', () => {
    const run = (gap: number, streakSec: number) => {
      const { c } = setup({ tune: (t) => ((t.judge.missStreakSec = streakSec), (t.judge.missStreakMax = 4)) });
      c.hero.bonusMaxHp = 400; // 500 max HP: a miss is 3
      c.hero.hp = 500;
      const costs: number[] = [];
      for (let k = 0; k < 5; k++) {
        c.advanceTo(c.time + gap);
        const hp = c.hero.hp;
        c.tap(c.time - 0.001);
        costs.push(hp - c.hero.hp);
      }
      return costs;
    };
    expect(run(0.2, 0.5)).toEqual([3, 6, 9, 12, 12]);
    expect(run(0.8, 0.5)).toEqual([3, 3, 3, 3, 3]);
    expect(run(0.2, 0)).toEqual([3, 3, 3, 3, 3]); // without the rule
  });

  it('every effect together forgives only forgiveMax misses a fight; after that a miss breaks the combo', () => {
    const run = (max: number) => {
      const { c, t } = withRelics(['clutch'], { tune: (tt) => (tt.spam.forgiveMax = max) });
      const combos: number[] = [];
      for (let k = 0; k < 5; k++) {
        c.combo = 10;
        c.advanceTo(c.time + 0.3);
        c.tap(c.time - 0.001); // nothing under the cursor: a miss
        combos.push(c.combo);
      }
      void t;
      return { c, combos };
    };
    const on = run(3);
    const off = run(99);
    expect(on.combos).toEqual([10, 10, 10, 0, 0]);
    expect(off.combos).toEqual([10, 10, 10, 10, 10]);
    expect(perks(on.c.drainEvents(), 'missCap')).toHaveLength(1);
    expect(on.c.tally.forgiven).toBe(3);
  });

  it("a forgiven miss still loses the meter's fill toward the next stack (stacks kept); without the rule it keeps it", () => {
    const run = (loss: number) => {
      const { c } = withRelics(['clutch'], { tune: (t) => (t.spam.forgiveMeter = loss) });
      c.combo = 10;
      c.stacks = 2;
      c.meter = 0.6;
      c.advanceTo(0.3);
      c.tap(c.time - 0.001);
      return c;
    };
    const on = run(1);
    const off = run(0);
    expect(on.combo).toBe(10);
    expect(on.stacks).toBe(2);
    expect(on.meter).toBe(0);
    expect(off.meter).toBeCloseTo(0.6);
  });

  it('Spare Link and Footpad count toward the same cap', () => {
    const { c } = withRelics(['spareLink'], { tune: (t) => (t.spam.forgiveMax = 0) });
    expect(c.canForgive()).toBe(false);
    expect(c.forgiveLeft()).toBe(0);
  });
});
