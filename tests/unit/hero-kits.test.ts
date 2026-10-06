import { describe, expect, it } from 'vitest';
import { HERO_IDS, HEROES, STYLE_IDS } from '../../src/data/heroes';
import { STYLES } from '../../src/data/styles';
import { STYLE_HOOKS, guardOf, focusOf, chainOf } from '../../src/core/styles';
import { KIT_HOOKS, nextBlockAhead } from '../../src/core/kit-fx';
import { kitText, styleText } from '../../src/core/heroes';
import type { Combat } from '../../src/core/combat';
import { setup, timeAt } from './helpers';
import type { HeroId } from '../../src/data/heroes';
import type { Tuning } from '../../src/core/tuning';

/** Step the fight to time t (advanceTo stops after 5 s a call). */
function go(c: Combat, t: number): void {
  for (let k = 0; k < 100 && c.time < t - 1e-9; k++) c.advanceTo(Math.min(t, c.time + 4));
}

/** When the cursor next crosses bar position p from now (turning at a wall if it has to), at today's speed. */
function nextCross(c: Combat, p: number): number {
  const at = c.cursorPos();
  const dir = c.cursorDirAt(c.time);
  if ((p - at) * dir >= 0) return c.time + c.travelTime(at, p, dir);
  const wall = dir > 0 ? 1 : 0;
  return c.time + c.travelTime(at, wall, dir) + c.travelTime(wall, p, -dir);
}

/** Tap a fresh block of `kind` at bar position p as the cursor crosses its centre (reds in these tests barely move). */
function tapNew(c: Combat, _t: Tuning, kind: Parameters<Combat['spawnBlock']>[0], p: number, offMs = 0) {
  const b = c.spawnBlock(kind, p);
  const at = nextCross(c, p) + offMs / 1000;
  go(c, at);
  return { b, r: c.tap(at) };
}

/** A test fight as `hero` (Rowan's Resolve spent; reds crawl unless the test speeds them up). */
const fight = (hero: HeroId, o: Parameters<typeof setup>[0] = {}) => {
  const s = setup({ hero, ...o, tune: (t) => ((t.blocks.redTravelSec = 10000), o.tune?.(t)) });
  s.c.perk.resolve = 1;
  return s;
};

describe('the heroes as data', () => {
  it('8 heroes, one per style, Rare to Legendary, each with a signature, ability, passive, finisher and strengths', () => {
    expect(HERO_IDS).toHaveLength(8);
    expect(new Set(HERO_IDS.map((id) => HEROES[id].style)).size).toBe(8);
    expect(STYLE_IDS.every((s) => !!STYLES[s] && !!STYLE_HOOKS[s])).toBe(true);
    const tiers = new Set(HERO_IDS.map((id) => HEROES[id].rarity));
    expect([...tiers].sort()).toEqual(['epic', 'legendary', 'rare']);
    for (const id of HERO_IDS) {
      const h = HEROES[id];
      for (const p of [h.signature, h.ability, h.passive, h.finisher]) expect(p.name.length * p.text.length * p.short.length, `${id} ${p.name}`).toBeGreaterThan(0);
      expect(h.strengths.length).toBeGreaterThan(0);
      for (const s of h.strengths) expect(s.n).toBeGreaterThanOrEqual(0.15), expect(s.n).toBeLessThanOrEqual(0.25);
      expect(h.stars).toHaveLength(2);
      expect(KIT_HOOKS[id]).toBeDefined();
    }
    expect(HEROES.rowan.joins).toBe('start');
    expect(HEROES.sable.joins).toBe('story');
    expect(HEROES.neve.joins).toBe('story');
  });

  it('kit and style texts fill in their numbers (no stray {n})', () => {
    const { t } = setup();
    for (const id of HERO_IDS) {
      for (const w of ['signature', 'ability', 'passive', 'finisher'] as const) expect(kitText(t, id, w), `${id} ${w}`).not.toContain('{n}');
      expect(styleText(t, id)).not.toContain('{n}');
    }
  });
});

describe('style rules', () => {
  it('Blade (Edge): at 20+ combo the meter fills faster', () => {
    for (const fill of [0, 0.2]) {
      const { c, t } = fight('rowan', { tune: (t) => (t.styles.bladeFill = fill) });
      c.combo = 25;
      tapNew(c, t, 'yellow', 0.3);
      expect(c.meter).toBeCloseTo((t.meter.perHit + t.meter.perfectBonus) * (1 + fill), 5);
    }
  });

  it('Shadow (Chain): Perfect hits in a row add damage to the next hit; a non-Perfect starts over', () => {
    const { c, t } = fight('sable', { tune: (t) => (t.kits.sable.dashLead = 99) }); // no dashes in this test
    tapNew(c, t, 'yellow', 0.2);
    tapNew(c, t, 'yellow', 0.35);
    expect(chainOf(c)).toBe(2);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'yellow', 0.5);
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * (1 + 2 * t.styles.chainStep)));
    tapNew(c, t, 'yellow', 0.7, 25); // off-centre: not Perfect
    expect(chainOf(c)).toBe(0);
  });

  it('Guardian (Guard): blocks store Guard, and the next hit unleashes it', () => {
    const { c, t } = fight('hollis', { tune: (t) => (t.kits.hollis.slam = 0) });
    tapNew(c, t, 'red', 0.2, 30);
    tapNew(c, t, 'red', 0.35, 30);
    expect(guardOf(c)).toBe(2);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'yellow', 0.6);
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.kits.hollis.atk * (1 + 2 * t.styles.guardPer)));
    expect(guardOf(c)).toBe(0);
  });

  it('Marksman (Focus): hits deal less and store Focus; a green hit fires it all as a Power Shot', () => {
    const { c, t } = fight('vesper', { enemies: ['bandit'] });
    const hp0 = c.enemies[0].hp;
    tapNew(c, t, 'yellow', 0.2, 25);
    expect(hp0 - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.styles.focusShare));
    expect(focusOf(c)).toBeGreaterThan(0);
    const f = focusOf(c);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'green', 0.5, 25);
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.hero.greenMult) + Math.max(1, Math.round(f)));
    expect(focusOf(c)).toBe(0);
  });

  it('Brute (Heavy): every hit lands x1.6; yellows are wider and come further apart; the refill keeps fewer', () => {
    const { c, t } = fight('torva', { tune: (t) => (t.kits.torva.atk = 1) });
    tapNew(c, t, 'yellow', 0.3, 25);
    expect(80 - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.styles.heavyMult));
    expect(STYLE_HOOKS.brute.staticGap!(c, 1)).toBeCloseTo(t.styles.heavyGap);
    expect(STYLE_HOOKS.brute.minAttack!(c, 2)).toBe(1);
    c.trySpawn('yellow', c.enemies[0].id);
    expect(c.blocks.at(-1)!.width).toBeCloseTo(t.blocks.attackWidth * t.styles.heavyWidth);
  });

  it('Controller (Bend): a Perfect block slows every red on the bar for a moment', () => {
    const { c, t } = fight('neve', { tune: (t) => (t.kits.neve.freeze = 0) });
    const other = c.spawnBlock('red', 0.9);
    tapNew(c, t, 'red', 0.3);
    expect(other.chill).toBeGreaterThan(0);
    expect(other.chillMult).toBeCloseTo(t.styles.bendMult);
  });

  it('Summoner (Call): green hits call allies in order; a Thornling strikes, a Barkback stops a red, a Glowmoth heals; a 4th call is a Rally', () => {
    const { c, t } = fight('moss', { tune: (t) => (t.blocks.redTravelSec = 1) });
    tapNew(c, t, 'green', 0.2);
    expect(c.allies.map((a) => a.kind)).toEqual(['thornling']);
    const hp = c.enemies[0].hp;
    go(c, c.time + t.kits.moss.thornEvery + 0.05);
    expect(c.enemies[0].hp).toBeLessThan(hp);
    tapNew(c, t, 'green', 0.6);
    tapNew(c, t, 'green', 0.9);
    expect(c.allies.map((a) => a.kind)).toEqual(['thornling', 'barkback', 'glowmoth']);
    // the Barkback braces, then eats a red that reaches the hero
    go(c, c.time + t.kits.moss.barkEvery);
    expect(c.allies.find((a) => a.kind === 'barkback')!.braced).toBe(true);
    c.hero.hp = 50;
    c.spawnBlock('red', 0.06);
    go(c, c.time + 0.3);
    expect(c.hero.hp).toBeGreaterThanOrEqual(50);
    c.drainEvents();
    c.hitNow = null;
    tapNew(c, t, 'green', c.cursorDirAt(c.time) > 0 ? Math.min(0.9, c.cursorPos() + 0.1) : Math.max(0.1, c.cursorPos() - 0.1));
    expect(c.drainEvents().some((e) => e.type === 'ally' && e.action === 'rally')).toBe(true);
  });

  it('allies leave after their time', () => {
    const { c, t } = fight('moss');
    tapNew(c, t, 'green', 0.2);
    go(c, c.time + t.kits.moss.allySec + 0.1);
    expect(c.allies).toHaveLength(0);
  });

  it('Bomber (Powder): every Nth yellow comes as a keg; hitting a keg blasts every foe and knocks nearby reds off', () => {
    const { c, t } = fight('tam', { enemies: ['slime', 'slime'] });
    const kinds: string[] = [];
    for (let i = 0; i < t.styles.kegEvery * 2; i++) kinds.push(STYLE_HOOKS.bomber.spawnKind!(c, 'yellow', c.enemies[0].id));
    expect(kinds.filter((k) => k === 'keg')).toHaveLength(2);
    const red = c.spawnBlock('red', 0.38);
    c.blocks.splice(c.blocks.indexOf(red), 1);
    c.blocks.push(Object.assign(red, { vel: 0 }));
    const before = c.enemies.map((e) => e.hp);
    tapNew(c, t, 'keg', 0.3);
    const blast = Math.round(t.hero.atk * t.kits.tam.atk * t.styles.kegMult);
    expect(before[1] - c.enemies[1].hp).toBe(blast);
    expect(c.blocks.includes(red)).toBe(false);
  });
});

describe('hero kits', () => {
  it("Rowan's Resolve: the first hit taken each fight keeps the combo; the next one breaks it", () => {
    const { c, t } = setup();
    t.blocks.redTravelSec = 1;
    c.combo = 8;
    c.spawnBlock('red', 0.06);
    go(c, 0.3);
    expect(c.combo).toBe(8);
    c.spawnBlock('red', 0.06);
    go(c, 0.6);
    expect(c.combo).toBe(0);
  });

  it("Sable's Shadow Dash: a Perfect hit sends the cursor bursting toward the next block, slowing back just before it; it stops before a red and skips traps", () => {
    const { c, t } = fight('sable');
    c.spawnBlock('purple', 0.5);
    const next = c.spawnBlock('yellow', 0.7);
    tapNew(c, t, 'yellow', 0.2);
    const ev = c.drainEvents();
    const dash = ev.find((e) => e.type === 'dash');
    expect(dash).toBeDefined();
    const edge = next.pos - next.width / 2;
    // the burst runs from the hit to `dashLead` s of normal travel before the next block (the trap is skipped)
    expect(dash && dash.type === 'dash' && dash.to).toBeGreaterThan(0.5);
    const z = c.zones.find((x) => x.kind === 'dash')!;
    expect(z.mult).toBeCloseTo(t.kits.sable.dashMult);
    const plain = fight('sable').c;
    plain.spawnBlock('yellow', 0.7);
    expect(c.travelTime(c.cursorPos(), edge, 1)).toBeLessThan(plain.travelTime(c.cursorPos(), edge, 1) * 0.7); // it gets there much sooner
    // a red ahead stops the dash before it
    const b = fight('sable');
    const red = b.c.spawnBlock('red', 0.6);
    b.c.spawnBlock('yellow', 0.85);
    expect(nextBlockAhead(b.c)).toBe(red);
    // a non-Perfect hit doesn't dash
    const d = fight('sable');
    d.c.spawnBlock('yellow', 0.8);
    tapNew(d.c, d.t, 'yellow', 0.2, 25);
    expect(d.c.drainEvents().some((e) => e.type === 'dash')).toBe(false);
  });

  it("Shadow Dash ends before a hold's near edge (so it can be pressed), counting an ice patch on the way", () => {
    const { c, t } = fight('sable');
    c.addZone('ice', 0.6, 0.3, 0);
    const h = c.spawnBlock('hold', 0.75);
    tapNew(c, t, 'yellow', 0.2);
    const edge = h.pos - h.width / 2;
    const ev = c.drainEvents().find((e) => e.type === 'dash');
    const to = ev && ev.type === 'dash' ? ev.to : 0;
    expect(to).toBeLessThan(edge);
    // from the burst's end, `dashLead` s of normal travel (through the ice) are left to press the hold
    const z = c.zones.find((x) => x.kind === 'dash')!;
    c.removeZone(z);
    expect(c.travelTime(to, edge, 1)).toBeCloseTo(t.kits.sable.dashLead, 1);
    c.addZone('dash', (z.lo + z.hi) / 2, z.hi - z.lo, z.life);
    const at = c.time + c.travelTime(c.cursorPos(), edge, 1);
    go(c, at);
    expect(c.tap(at).outcome).toBe('hold');
  });

  it("Sable's Smoke Veil: during the green ability a miss doesn't break the combo", () => {
    const { c, t } = fight('sable');
    tapNew(c, t, 'green', 0.2, 25);
    c.combo = 6;
    c.tap(c.time);
    expect(c.combo).toBe(6);
  });

  it("Neve's Flash Freeze: a Perfect block freezes the red in place; hitting the frozen block shatters it for x2", () => {
    const { c, t } = fight('neve');
    tapNew(c, t, 'red', 0.4);
    const f = c.blocks.find((b) => b.kind === 'frozen')!;
    expect(f).toBeDefined();
    const at = nextCross(c, f.pos);
    const hp = c.enemies[0].hp;
    go(c, at);
    expect(c.tap(at).outcome).toBe('hit');
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.kits.neve.atk * t.blocks.frozenMult));
  });

  it("Neve's Glacier: hits every foe, freezes the reds on the bar, lays a slow patch; ice bothers her half as much", () => {
    const { c, t } = fight('neve', { enemies: ['bandit', 'bandit'] });
    c.spawnBlock('red', 0.8);
    c.stacks = 2;
    c.finisher();
    expect(c.blocks.filter((b) => b.kind === 'frozen')).toHaveLength(1);
    expect(c.zones.some((z) => z.kind === 'slow')).toBe(true);
    expect(c.enemies.every((e) => e.hp < 140)).toBe(true);
    const z = c.addZone('ice', 0.2, 0.1, 0);
    expect(c.zoneMult(z)).toBeCloseTo(1 + (t.bar.iceMult - 1) * t.kits.neve.iceResist);
  });

  it("Tam's Chain Fuse sets off kegs near each other; Big Bang drops kegs; Blast Shield halves bombs", () => {
    const { c, t } = fight('tam', { enemies: ['bandit'] });
    const k2 = c.spawnBlock('keg', 0.38);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'keg', 0.3);
    expect(c.blocks.includes(k2)).toBe(false);
    expect(hp - c.enemies[0].hp).toBeGreaterThanOrEqual(2 * Math.round(t.hero.atk * t.kits.tam.atk * t.styles.kegMult));
    c.stacks = 1;
    c.finisher();
    expect(c.blocks.filter((b) => b.kind === 'keg').length).toBe(t.kits.tam.bangKegs);
    expect(KIT_HOOKS.tam.hurt!(c, 10, 'bomb', 0)).toBe(5);
  });

  it("Hollis: Shield Slam hits back on a Perfect block; Iron Hide trims reds; Rampart bounces reds off the left end", () => {
    const { c, t } = fight('hollis');
    tapNew(c, t, 'red', 0.4);
    t.blocks.redTravelSec = 1; // now let reds reach the left end
    expect(c.enemies[0].hp).toBe(80 - Math.round(t.hero.atk * t.kits.hollis.atk * t.kits.hollis.slam));
    expect(KIT_HOOKS.hollis.hurt!(c, 100, 'red', 0)).toBeCloseTo(100 * (1 - t.kits.hollis.ironHide));
    c.stacks = 1;
    c.finisher();
    const r = c.spawnBlock('red', 0.06);
    go(c, c.time + 0.3);
    expect(c.hero.hp).toBe(c.maxHp());
    expect(c.blocks.includes(r)).toBe(true);
    expect(c.drainEvents().some((e) => e.type === 'deflect')).toBe(true);
  });

  it("Vesper's Volley pins every red in place for a moment", () => {
    const { c } = fight('vesper');
    const r = c.spawnBlock('red', 0.8);
    c.stacks = 1;
    c.finisher();
    expect(c.blocks.includes(r)).toBe(true);
    const p = r.pos;
    go(c, c.time + 0.5);
    expect(r.pos).toBeCloseTo(p, 5);
  });

  it("Torva: Quake knocks reds back on a Perfect; Wind-Up's next hit is x2.5 and stuns; Earthsplitter clears the bar", () => {
    const { c, t } = fight('torva', { tune: (t) => (t.blocks.redTravelSec = 20) });
    const r = c.spawnBlock('red', 0.8);
    const p0 = r.pos;
    tapNew(c, t, 'yellow', 0.2);
    go(c, c.time + 0.3);
    expect(r.pos).toBeGreaterThan(p0 - 0.02);
    tapNew(c, t, 'green', 0.35, 25);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'yellow', 0.5, 25);
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.kits.torva.atk * t.styles.heavyMult * t.kits.torva.windUp));
    expect(c.enemies[0].stun).toBeGreaterThan(0);
    c.spawnBlock('yellow', 0.9);
    c.stacks = 1;
    c.finisher();
    expect(c.blocks).toHaveLength(0);
  });

  it('soft strengths: Rowan deals +20% to Folk (a Bandit), not to a Slime', () => {
    const a = fight('rowan', { enemies: ['bandit'], tune: (t) => (t.hero.strengthScale = 1) });
    tapNew(a.c, a.t, 'yellow', 0.3, 25);
    expect(140 - a.c.enemies[0].hp).toBe(Math.round(a.t.hero.atk * 1.2));
    const b = fight('rowan', { tune: (t) => (t.hero.strengthScale = 1) });
    tapNew(b.c, b.t, 'yellow', 0.3, 25);
    expect(80 - b.c.enemies[0].hp).toBe(b.t.hero.atk);
  });

  it('stars: 2 stars add attack; Sable at 3 stars leaves an afterimage that stops a red', () => {
    const one = fight('rowan');
    const two = fight('rowan', { stars: 2 });
    expect(two.c.stats().atk).toBeCloseTo(one.c.stats().atk * (1 + two.t.levels.star2Atk));
    const s = fight('sable', { stars: 3, tune: (t) => (t.blocks.redTravelSec = 1) });
    s.c.spawnBlock('yellow', 0.8);
    tapNew(s.c, s.t, 'yellow', 0.2);
    expect(s.c.perk.afterimage).toBe(1);
    s.c.spawnBlock('red', 0.06);
    go(s.c, s.c.time + 0.3);
    expect(s.c.hero.hp).toBe(s.c.maxHp());
  });
});

describe('every hero plays one cursor, with ice and holds', () => {
  it('every hero can press and complete a hold on ice', () => {
    for (const id of HERO_IDS) {
      const { c } = fight(id);
      c.addZone('ice', 0.5, 0.3, 0);
      const h = c.spawnBlock('hold', 0.5);
      const at = c.travelTime(0, h.pos - h.width / 2, 1);
      go(c, at);
      expect(c.tap(at).outcome, id).toBe('hold');
      go(c, c.travelTime(0, h.pos + h.width / 2, 1) + 0.05);
      expect(c.holding, id).toBeNull();
      expect(c.drainEvents().some((e) => e.type === 'holdEnd' && e.ok), id).toBe(true);
    }
  });

  it('a timeAt helper still holds for the base speed', () => {
    const { c, t } = setup();
    go(c, timeAt(t, 0.25));
    expect(c.cursorPos()).toBeCloseTo(0.25, 2);
  });
});
