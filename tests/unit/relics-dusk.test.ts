// The fourth region's relics (not in play yet; SPOILERS: docs/content-bible.md section 7): each one's rule in a
// fight, with and without it (Light: dark blocks and the cursor's lantern; Tide: the water at the bar's ends), and
// the data's shape. Until they're merged into RELIC_HOOKS, a test hands a relic's hooks to the fight directly.
import { describe, expect, it } from 'vitest';
import { DUSK_PAIR_NAME, DUSK_RELICS, DUSK_RELIC_TAGS, duskN, type DuskRelicId } from '../../src/data/relics-dusk';
import { DUSK_RELIC_HOOKS } from '../../src/core/relic-fx-dusk';
import { RELICS, RELIC_TAGS } from '../../src/data/relics';
import type { Combat, CombatEvent } from '../../src/core/combat';
import type { BarRules } from '../../src/data/types';
import { textWidth } from '../../src/engine/font';
import { setup, timeAt } from './helpers';

/** A test fight (a bandit, no spawns), carrying the relic's hooks when `id` is given. */
function fight(id?: DuskRelicId, bar?: BarRules) {
  const s = setup({ enemies: ['bandit'], bar });
  s.c.perk.resolve = 1;
  if (id) s.c.hooks.push(DUSK_RELIC_HOOKS[id]);
  return s;
}
const both = (id: DuskRelicId, bar?: BarRules) => ({ on: fight(id, bar), off: fight(undefined, bar) });
const perks = (ev: CombatEvent[], id: string) => ev.filter((e) => e.type === 'perk' && e.id === id);
const dmg = (c: Combat, hp0: number) => hp0 - c.enemies[0].hp;

/** Hit a dark yellow at p as the cursor crosses it (from the left end), Perfect unless `late` (ms). */
function hitDark(c: Combat, p: number, late = 0): number {
  const hp0 = c.enemies[0].hp;
  c.spawnBlock('yellow', p, c.enemies[0].id, undefined, { dark: true });
  const at = timeAt(c.tuning, p) + late / 1000;
  c.advanceTo(at);
  c.tap(at);
  return dmg(c, hp0);
}

/** Water held at `r` from the right end for the whole test (no swell). */
const still = (r: number): BarRules => ({ tide: { fromRow: 0, low: r, high: r, period: 100, from: 'right' } });

describe("the fourth region's relics: the data", () => {
  const sub = (text: string, n?: number) => text.replace('{n}', String(n ?? ''));
  it('fourteen Light and Tide relics: unique ids and names, new to the game, one number at most, each fits a card', () => {
    const ids = DUSK_RELICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const old = RELICS.filter((r) => (r.from ?? 0) < 9);
    const oldIds = new Set<string>(old.map((r) => r.id));
    const oldNames = new Set(old.map((r) => r.name));
    const widest = Math.max(...RELICS.map((r) => textWidth(sub(r.text, r.n), 1, false)));
    for (const r of DUSK_RELICS) {
      expect(oldIds.has(r.id), r.id).toBe(false);
      expect(oldNames.has(r.name), r.name).toBe(false);
      expect((DUSK_RELIC_TAGS as string[]).includes(r.tags[0]), r.id).toBe(true);
      for (const t of r.tags.slice(1)) expect([...RELIC_TAGS, ...DUSK_RELIC_TAGS] as string[]).toContain(t);
      expect(r.tags.length).toBeLessThanOrEqual(2);
      expect(r.text.includes('{n}'), r.id).toBe(r.n !== undefined);
      expect(r.from).toBe(9);
      expect(textWidth(sub(r.text, r.n), 1, false), `${r.id}: fits a card like the others`).toBeLessThanOrEqual(widest);
      expect(DUSK_RELIC_HOOKS[r.id], r.id).toBeDefined();
    }
    for (const tag of DUSK_RELIC_TAGS) expect(DUSK_RELICS.filter((r) => r.tags.includes(tag)).length, tag).toBeGreaterThanOrEqual(6);
    for (const [a, b] of DUSK_PAIR_NAME) expect([a, b].some((t) => (DUSK_RELIC_TAGS as string[]).includes(t))).toBe(true);
  });
});

describe("the fourth region's relics: Light", () => {
  it('Moth Wing: hits on dark blocks deal more (a plain yellow, the same)', () => {
    const { on, off } = both('mothWing');
    expect(hitDark(on.c, 0.4)).toBe(Math.round(hitDark(off.c, 0.4) * (1 + duskN('mothWing') / 100)));
  });

  it('Wick Trimmer: a Perfect hit on a dark block always crits; a late one, no', () => {
    const { on, off } = both('wickTrimmer');
    const a = hitDark(on.c, 0.4);
    const b = hitDark(off.c, 0.4);
    expect(a).toBeGreaterThan(b);
    expect(perks(on.c.drainEvents(), 'wickTrimmer')).toHaveLength(1);
    const late = fight('wickTrimmer');
    expect(hitDark(late.c, 0.4, 25)).toBe(b);
  });

  it('Night Owl: the light reaches further; Blindfold: less far, but hits on dark blocks deal triple', () => {
    const { on, off } = both('nightOwl');
    expect(on.c.lightReach()).toBeCloseTo(off.c.lightReach() * (1 + duskN('nightOwl') / 100), 6);
    const bf = both('blindfold');
    expect(bf.on.c.lightReach()).toBeCloseTo(bf.off.c.lightReach() * (1 - duskN('blindfold') / 100), 6);
    expect(hitDark(bf.on.c, 0.5)).toBe(3 * hitDark(bf.off.c, 0.5));
  });

  it('Lantern Oil: each dark block the light reaches fills a little meter', () => {
    const { on, off } = both('lanternOil');
    for (const c of [on.c, off.c]) {
      c.spawnBlock('yellow', 0.7, c.enemies[0].id, undefined, { dark: true });
      c.advanceTo(0.6);
    }
    expect(on.c.meter).toBeGreaterThan(0);
    expect(off.c.meter).toBe(0);
    expect(perks(on.c.drainEvents(), 'lanternOil')).toHaveLength(1);
  });

  it('Glow Worms: each dark block hit drops a coin (a plain yellow, none)', () => {
    const { on, off } = both('glowWorms');
    hitDark(on.c, 0.4);
    hitDark(off.c, 0.4);
    expect(on.c.coinsEarned).toBe(duskN('glowWorms'));
    expect(off.c.coinsEarned).toBe(0);
  });

  it('Ember Jar: the light burns a dark trap away before it can bite; a dark yellow stays', () => {
    const { on, off } = both('emberJar');
    for (const c of [on.c, off.c]) {
      c.spawnBlock('purple', 0.6, c.enemies[0].id, undefined, { dark: true });
      c.spawnBlock('yellow', 0.8, c.enemies[0].id, undefined, { dark: true });
      c.advanceTo(timeAt(c.tuning, 0.8));
    }
    expect(on.c.blocks.map((b) => b.kind)).toEqual(['yellow']);
    expect(off.c.blocks.map((b) => b.kind).sort()).toEqual(['purple', 'yellow']);
  });
});

describe("the fourth region's relics: Tide", () => {
  /** Block a red that reaches the cursor at the left end (in the water when it's on that side). */
  const blockAt = (c: Combat) => {
    const r = c.spawnBlock('red', 0.12);
    const at = 0.05;
    c.advanceTo(at);
    c.tap(at);
    return r;
  };
  const left = (l: number): BarRules => ({ tide: { fromRow: 0, low: l, high: l, period: 100, from: 'left' } });

  it('Wading Boots: blocking a red in the water heals (on dry ground, no)', () => {
    const { on } = both('wadingBoots', left(0.3));
    on.c.hero.hp -= 50;
    const hp = on.c.hero.hp;
    blockAt(on.c);
    expect(on.c.hero.hp - hp).toBe(duskN('wadingBoots'));
    const dry = fight('wadingBoots');
    dry.c.hero.hp -= 50;
    const hp2 = dry.c.hero.hp;
    blockAt(dry.c);
    expect(dry.c.hero.hp).toBe(hp2);
  });

  it('Driftwood: a block that just came up out of the water crits; one that has been dry a while, no', () => {
    const { on, off } = both('driftwood');
    for (const c of [on.c, off.c]) {
      c.spawnBlock('yellow', 0.75);
      c.surgeTide(0.3, 1.3); // the water comes over it and goes again
      c.advanceTo(1.6);
      c.drainEvents();
    }
    const hp = [on.c.enemies[0].hp, off.c.enemies[0].hp];
    const b = on.c.blocks[0];
    expect(b.surfacedAt).toBeGreaterThan(0);
    // the cursor's next crossing of 0.75 (right to left, the first pass back): within 1.5 s of coming up
    const at = 2 * on.c.tuning.cursor.basePassSec - timeAt(on.c.tuning, 0.75);
    for (const c of [on.c, off.c]) {
      c.advanceTo(at);
      c.tap(at);
    }
    expect(at - b.surfacedAt).toBeLessThanOrEqual(1.5);
    expect(hp[0] - on.c.enemies[0].hp).toBeGreaterThan(hp[1] - off.c.enemies[0].hp);
    expect(perks(on.c.drainEvents(), 'driftwood')).toHaveLength(1);
  });

  it('Undertow Charm: reds wade slower; Low Water: the water comes less far; Moonpull: further', () => {
    const { on, off } = both('undertowCharm', still(0.5));
    const a = on.c.spawnBlock('red', 0.9);
    const b = off.c.spawnBlock('red', 0.9);
    on.c.advanceTo(0.5);
    off.c.advanceTo(0.5);
    expect(0.9 - a.pos).toBeCloseTo((0.9 - b.pos) * (1 - duskN('undertowCharm') / 100), 3);
    const swell: BarRules = { tide: { fromRow: 0, low: 0.2, high: 0.2, period: 100, from: 'right' } };
    const lw = both('lowWater', swell);
    const mp = both('moonpull', swell);
    for (const c of [lw.on.c, lw.off.c, mp.on.c]) c.advanceTo(2);
    expect(lw.on.c.waterR).toBeCloseTo(0.2 * (1 - duskN('lowWater') / 100), 3);
    expect(lw.off.c.waterR).toBeCloseTo(0.2, 3);
    expect(mp.on.c.waterR).toBeCloseTo(0.2 * (1 + duskN('moonpull') / 100), 3);
  });

  it('Tidepool: each block that comes up out of the water drops a coin', () => {
    const { on, off } = both('tidepool');
    for (const c of [on.c, off.c]) {
      c.spawnBlock('yellow', 0.75);
      c.surgeTide(0.3, 1.3);
      c.advanceTo(2.5);
    }
    expect(on.c.coinsEarned).toBe(duskN('tidepool'));
    expect(off.c.coinsEarned).toBe(0);
  });

  it('Spring Tide: hits right by the water deal more (far from it, the same)', () => {
    const { on, off } = both('springTide', still(0.4));
    for (const c of [on.c, off.c]) c.spawnBlock('yellow', 0.55);
    const at = timeAt(on.c.tuning, 0.55);
    const hp = [on.c.enemies[0].hp, off.c.enemies[0].hp];
    for (const c of [on.c, off.c]) {
      c.advanceTo(at);
      c.tap(at);
    }
    expect(hp[0] - on.c.enemies[0].hp).toBe(Math.round((hp[1] - off.c.enemies[0].hp) * (1 + duskN('springTide') / 100)));
    const far = both('springTide', still(0.4));
    expect(hitDark(far.on.c, 0.2)).toBe(hitDark(far.off.c, 0.2));
  });

  it('Moonpull: blocking a red in the water knocks the next red back', () => {
    const { on, off } = both('moonpull', left(0.3));
    const nx = [on.c, off.c].map((c) => c.spawnBlock('red', 0.7));
    blockAt(on.c);
    blockAt(off.c);
    on.c.advanceTo(0.4);
    off.c.advanceTo(0.4);
    expect(nx[0].pos).toBeGreaterThan(nx[1].pos + 0.05);
    expect(perks(on.c.drainEvents(), 'moonpull')).toHaveLength(1);
  });
});
