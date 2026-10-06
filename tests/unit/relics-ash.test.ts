// The third region's relics: each one's rule in a fight, with and without it (Drift: blocks that slide along the
// bar; Link: linked pairs, hit one half then the other within the beat).
import { describe, expect, it } from 'vitest';
import type { RelicId } from '../../src/data/relics';
import { relicById } from '../../src/data/relics';
import { Combat, newHero, type Block, type CombatEvent } from '../../src/core/combat';
import { RELIC_HOOKS } from '../../src/core/relic-fx';
import { emptyLoadout, type Loadout } from '../../src/core/gear';
import { setup, timeAt } from './helpers';

type SetupOpts = NonNullable<Parameters<typeof setup>[0]>;

function fight(relics: RelicId[], o: SetupOpts = {}) {
  const base = setup(o);
  const hero = newHero(base.t);
  hero.relics = relics;
  const c = new Combat({ tuning: base.t, settings: base.s, hero, enemies: o.enemies ?? ['bandit'], seed: 42, spawning: false, specials: false });
  c.perk.resolve = 1; // Rowan's Knight's Resolve already spent: these tests are about the relics
  return { c, t: base.t };
}
const both = (id: RelicId, o: SetupOpts = {}) => ({ on: fight([id], o), off: fight([], o) });
const perks = (ev: CombatEvent[], id: string) => ev.filter((e) => e.type === 'perk' && e.id === id);
const n = (c: Combat, id: RelicId) => c.tuning.relics.n[id];

/** A drifting yellow at p0 (drift v), tapped where the cursor (left to right from 0) meets it. */
function hitDrifting(c: Combat, p0: number, v: number, perfect = true): Block {
  const b = c.spawnBlock('yellow', p0, c.enemies[0].id, 0.1, { drift: v });
  const meet = p0 / (1 / c.tuning.cursor.basePassSec - v);
  c.advanceTo(meet);
  c.tap(perfect ? meet : meet + 0.02);
  return b;
}

/** A pair at p and q, both halves hit as the cursor meets them. */
function pairAt(c: Combat, p = 0.4, q = 0.6): [Block, Block] {
  const a = c.spawnBlock('yellow', p);
  const b = c.spawnBlock('yellow', q);
  a.link = b.id;
  b.link = a.id;
  return [a, b];
}
/** When the cursor next crosses bar position `pos` (sim time), at its speed right now. */
function nextAt(c: Combat, pos: number): number {
  const ph = c.cursorPhase;
  const k = Math.floor(ph / 2) * 2;
  const at = [k + pos, k + 2 - pos, k + 2 + pos].filter((x) => x >= ph - 1e-9);
  return c.time + (Math.min(...at) - ph) / c.cursorSpeed();
}
function tapNext(c: Combat, pos: number): void {
  const t = nextAt(c, pos);
  c.advanceTo(t);
  c.tap(t);
}
function finishPair(c: Combat, p = 0.4, q = 0.6): void {
  // from the left end, moving right: both halves ahead
  if (c.cursorPhase > 1e-6) c.advanceTo(c.time + (Math.floor(c.cursorPhase / 2) * 2 + 2 - c.cursorPhase) / c.cursorSpeed());
  pairAt(c, p, q);
  tapNext(c, p);
  tapNext(c, q);
}
function breakPair(c: Combat): void {
  const dir = c.cursorDirAt(c.time);
  pairAt(c, dir > 0 ? 0.2 : 0.8, dir > 0 ? 0.95 : 0.05);
  tapNext(c, dir > 0 ? 0.2 : 0.8);
  c.advanceTo(c.linkLit!.until + 0.02);
}

describe("the third region's relics: data", () => {
  it('every one is offered from its first act, has hooks, and fits a card', () => {
    const ids: RelicId[] = ['tailwind', 'weathervane', 'warmSprings', 'rebound', 'anchorStone', 'slipstream', 'flotsam', 'moltenCore', 'forgedBond', 'slowMatch', 'hammerTongs', 'spareLink', 'coupling', 'goldRivets', 'snapBack', 'hairTrigger'];
    for (const id of ids) {
      expect(relicById(id)?.from, id).toBe(6);
      expect(RELIC_HOOKS[id], id).toBeDefined();
    }
  });
});

describe('Drift relics', () => {
  it('Tailwind: hits on drifting blocks deal more (still ones the same)', () => {
    const { on, off } = both('tailwind');
    const dmg = (c: Combat) => {
      const hp = c.enemies[0].hp;
      hitDrifting(c, 0.5, 0.05);
      return hp - c.enemies[0].hp;
    };
    expect(dmg(on.c)).toBe(Math.round(dmg(off.c) * (1 + n(on.c, 'tailwind') / 100)));
  });

  it('Weathervane: a Perfect hit on a drifting block always crits', () => {
    const { on, off } = both('weathervane');
    for (const { c } of [on, off]) hitDrifting(c, 0.5, 0.05);
    expect(perks(on.c.drainEvents(), 'weathervane')).toHaveLength(1);
    expect(off.c.drainEvents().some((e) => e.type === 'hit' && e.crit)).toBe(false);
  });

  it('Warm Springs: a drifting block turning at an end heals', () => {
    const { on, off } = both('warmSprings');
    for (const { c } of [on, off]) {
      c.hero.hp = 50;
      c.spawnBlock('yellow', 0.85, c.enemies[0].id, 0.1, { drift: 0.2 });
      c.advanceTo(1);
    }
    expect(on.c.hero.hp).toBe(50 + n(on.c, 'warmSprings'));
    expect(off.c.hero.hp).toBe(50);
  });

  it('Rebound: a drifting yellow that turns at an end turns green', () => {
    const { on, off } = both('rebound');
    const kinds = [on, off].map(({ c }) => {
      const b = c.spawnBlock('yellow', 0.85, c.enemies[0].id, 0.1, { drift: 0.2 });
      c.advanceTo(1);
      return b.kind;
    });
    expect(kinds).toEqual(['green', 'yellow']);
  });

  it('Anchor Stone: blocking a red stops every drifting block for a while', () => {
    const { on, off } = both('anchorStone', { tune: (t) => (t.blocks.redTravelSec = 10000) });
    const moved = [on, off].map(({ c }) => {
      const d = c.spawnBlock('yellow', 0.7, c.enemies[0].id, 0.1, { drift: 0.05 });
      c.spawnBlock('red', 0.3);
      c.advanceTo(timeAt(c.tuning, 0.3));
      c.tap(timeAt(c.tuning, 0.3));
      const p = d.pos;
      c.advanceTo(c.time + 1);
      return Math.abs(d.pos - p);
    });
    expect(moved[0]).toBe(0);
    expect(moved[1]).toBeGreaterThan(0.03);
  });

  it('Slipstream: hitting a drifting block fills the meter like n hits', () => {
    const { on, off } = both('slipstream');
    for (const { c } of [on, off]) hitDrifting(c, 0.5, 0.05);
    expect(on.c.meter + on.c.stacks).toBeGreaterThan(off.c.meter + off.c.stacks);
  });

  it('Flotsam: each drifting block hit drops coins', () => {
    const { on, off } = both('flotsam');
    for (const { c } of [on, off]) hitDrifting(c, 0.5, 0.05);
    expect(on.c.coinsEarned - off.c.coinsEarned).toBe(n(on.c, 'flotsam'));
  });

  it('Molten Core: drifting blocks go faster, and hits on them deal double', () => {
    const { on, off } = both('moltenCore');
    const speed = [on, off].map(({ c }) => c.velOf(c.spawnBlock('yellow', 0.3, c.enemies[0].id, 0.1, { drift: 0.05 })));
    expect(speed[0]).toBeCloseTo(0.05 * (1 + n(on.c, 'moltenCore') / 100));
    expect(speed[1]).toBeCloseTo(0.05);
  });
});

describe('Link relics', () => {
  it('Forged Bond: a finished pair counts extra combo', () => {
    const { on, off } = both('forgedBond');
    for (const { c } of [on, off]) finishPair(c);
    expect(on.c.combo - off.c.combo).toBe(n(on.c, 'forgedBond'));
  });

  it("Slow Match: a pair's beat is longer", () => {
    const { on, off } = both('slowMatch');
    const beat = [on, off].map(({ c }) => {
      pairAt(c);
      c.advanceTo(timeAt(c.tuning, 0.4));
      c.tap(timeAt(c.tuning, 0.4));
      return c.linkLit!.until - c.time;
    });
    expect(beat[0]).toBeCloseTo(beat[1] * (1 + n(on.c, 'slowMatch') / 100), 1);
  });

  it("Hammer & Tongs: a pair's second half always crits", () => {
    const { on, off } = both('hammerTongs');
    for (const { c } of [on, off]) finishPair(c);
    expect(perks(on.c.drainEvents(), 'hammerTongs')).toHaveLength(1);
    expect(off.c.drainEvents().some((e) => e.type === 'hit' && e.crit)).toBe(false);
  });

  it("Spare Link: once a fight, a broken pair doesn't break the combo", () => {
    const { on, off } = both('spareLink');
    for (const { c } of [on, off]) {
      c.combo = 8;
      breakPair(c);
    }
    expect(on.c.combo).toBe(8);
    expect(off.c.combo).toBe(0);
    breakPair(on.c);
    expect(on.c.combo).toBe(0); // only once
  });

  it('Coupling: every nth finished pair banks a finisher stack', () => {
    const { on, off } = both('coupling');
    for (const { c } of [on, off]) for (let i = 0; i < n(on.c, 'coupling'); i++) finishPair(c, 0.4, 0.6);
    expect(on.c.stacks).toBeGreaterThan(off.c.stacks);
  });

  it('Gold Rivets: each finished pair drops coins', () => {
    const { on, off } = both('goldRivets');
    for (const { c } of [on, off]) finishPair(c);
    expect(on.c.coinsEarned - off.c.coinsEarned).toBe(n(on.c, 'goldRivets'));
  });

  it('Snap Back: a finished pair knocks the nearest red back toward the far end', () => {
    const { on, off } = both('snapBack', { tune: (t) => (t.blocks.redTravelSec = 10000) });
    const pos = [on, off].map(({ c }) => {
      const r = c.spawnBlock('red', 0.8);
      finishPair(c);
      c.advanceTo(c.time + 1);
      return r.pos;
    });
    expect(pos[0]).toBeGreaterThan(pos[1] + 0.05);
  });

  it('Hair Trigger: finished pairs deal triple, a broken one costs HP', () => {
    const { on, off } = both('hairTrigger');
    const dmg = [on, off].map(({ c }) => {
      const hp = c.enemies[0].hp;
      finishPair(c);
      return hp - c.enemies[0].hp;
    });
    expect(dmg[0]).toBeGreaterThan(dmg[1] * 2.5);
    const hp = [on, off].map(({ c }) => {
      c.hero.hp = c.maxHp();
      c.settings.mode = 'arcade' as never;
      breakPair(c);
      return c.hero.hp;
    });
    expect(hp[0]).toBeLessThan(hp[1]);
  });
});

describe("the third region's gear", () => {
  /** A fight wearing a loadout with these effects / set pieces. */
  function geared(o: Partial<Loadout>) {
    const base = setup({ enemies: ['bandit', 'bandit'] });
    const hero = newHero(base.t, { ...emptyLoadout(), ...o });
    const c = new Combat({ tuning: base.t, settings: base.s, hero, enemies: ['bandit', 'bandit'], seed: 42, spawning: false, specials: false });
    c.perk.resolve = 1;
    return c;
  }
  const plain = () => geared({});

  it('Emberwright, 2 pieces: hits on drifting blocks deal more; 4 pieces: a finished pair heals', () => {
    const dmg = (c: Combat) => {
      const hp = c.enemies[0].hp;
      hitDrifting(c, 0.5, 0.05);
      return hp - c.enemies[0].hp;
    };
    const on = geared({ sets: { emberwright: 2 } });
    expect(dmg(on)).toBe(Math.round(dmg(plain()) * (1 + on.tuning.effects.emberDrift)));
    const four = geared({ sets: { emberwright: 4 } });
    four.hero.hp = 50;
    finishPair(four);
    expect(four.hero.hp).toBeGreaterThan(50);
  });

  it("Titan's Maul: a finished pair's hits strike every foe", () => {
    const on = geared({ effects: ['titanMaul'] });
    const off = plain();
    for (const c of [on, off]) finishPair(c);
    expect(on.enemies[1].hp).toBeLessThan(on.enemies[1].maxHp);
    expect(off.enemies[1].hp).toBe(off.enemies[1].maxHp);
  });

  it('Bellows Heart: drifting blocks you hit fill more meter', () => {
    const on = geared({ effects: ['bellowsHeart'] });
    const off = plain();
    for (const c of [on, off]) hitDrifting(c, 0.5, 0.05);
    expect(on.meter + on.stacks).toBeGreaterThan(off.meter + off.stacks);
  });
});
