import { describe, expect, it } from 'vitest';
import { HERO_IDS, HEROES, STYLE_IDS } from '../../src/data/heroes';
import { STYLES } from '../../src/data/styles';
import { STYLE_HOOKS, allyEvery, allyPower, callAlly, guardOf, focusCap, focusOf, chainOf, powerShot } from '../../src/core/styles';
import { KIT_HOOKS, nextBlockAhead, windUpMult } from '../../src/core/kit-fx';
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
  it('a hero (or two: round 7) for each of the 8 styles, Rare to Mythic, each with a signature, ability, passive, finisher and strengths', () => {
    expect(HERO_IDS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(HERO_IDS.map((id) => HEROES[id].style)).size).toBe(8);
    for (const st of STYLE_IDS) expect(HERO_IDS.filter((id) => HEROES[id].style === st).length, st).toBeLessThanOrEqual(2);
    expect(STYLE_IDS.every((s) => !!STYLES[s] && !!STYLE_HOOKS[s])).toBe(true);
    const tiers = new Set(HERO_IDS.map((id) => HEROES[id].rarity));
    for (const tier of ['rare', 'epic', 'legendary']) expect(tiers.has(tier as never), tier).toBe(true);
    for (const tier of tiers) expect(['rare', 'epic', 'legendary', 'mythic'], tier).toContain(tier);
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
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * t.kits.sable.atk * (1 + 2 * t.styles.chainStep)));
    tapNew(c, t, 'yellow', 0.7, 25); // off-centre: not Perfect
    expect(chainOf(c)).toBe(0);
  });

  it('Guardian (Guard): blocks store Guard; hits leave it; at full, the next hit (or block) sets off a Bulwark on every foe', () => {
    const { c, t } = fight('hollis', { enemies: ['bandit', 'bandit'], tune: (t) => ((t.kits.hollis.slam = t.kits.hollis.slamPerfect = 0), (t.enemies.bandit.hp = 900), (t.styles.guardMax = 3)) });
    const atk = t.hero.atk * t.kits.hollis.atk;
    tapNew(c, t, 'red', 0.2, 30);
    tapNew(c, t, 'red', 0.35, 30);
    expect(guardOf(c)).toBe(2);
    // a hit short of full Guard is a plain hit, and the Guard stays
    tapNew(c, t, 'yellow', 0.5);
    expect(900 - c.enemies[0].hp).toBe(Math.round(atk));
    expect(guardOf(c)).toBe(2);
    tapNew(c, t, 'red', 0.62, 30);
    expect(guardOf(c)).toBe(3);
    c.drainEvents();
    const before = c.enemies.map((e) => e.hp);
    tapNew(c, t, 'yellow', 0.8);
    const blow = Math.round(atk * t.styles.bulwarkPer * 3);
    expect(c.enemies.map((e, i) => before[i] - e.hp)).toEqual([Math.round(atk) + blow, blow]);
    expect(guardOf(c)).toBe(0);
    const ev = c.drainEvents();
    expect(ev.filter((e) => e.type === 'perk' && e.id === 'bulwark')).toEqual([expect.objectContaining({ amount: 3 })]);
    expect(ev.filter((e) => e.type === 'enemyHurt' && e.perk === 'bulwarkBlow')).toHaveLength(2);
    // a block at full Guard sets it off too (and then stores its own charge)
    c.perk.guard = 3;
    const b2 = c.enemies.map((e) => e.hp);
    tapNew(c, t, 'red', c.cursorDirAt(c.time) > 0 ? Math.min(0.9, c.cursorPos() + 0.1) : Math.max(0.1, c.cursorPos() - 0.1), 30);
    expect(c.enemies.map((e, i) => b2[i] - e.hp)).toEqual([blow, blow]);
    expect(guardOf(c)).toBe(1);
  });

  it('Guardian: a Bulwark freezes the bar for its own hit-stop (and a Shield Slam for a short one)', () => {
    const { c, t } = fight('hollis', { tune: (t) => ((t.juice.bulwarkStopMs = 110), (t.juice.slamStopMs = 35)) });
    tapNew(c, t, 'red', 0.3, 30);
    expect(c.drainEvents().filter((e) => e.type === 'hitStop')).toEqual([{ type: 'hitStop', ms: 35 }]);
    go(c, c.time + 0.1);
    c.perk.guard = 5;
    tapNew(c, t, 'yellow', c.cursorDirAt(c.time) > 0 ? Math.min(0.9, c.cursorPos() + 0.1) : Math.max(0.1, c.cursorPos() - 0.1));
    expect(c.drainEvents().filter((e) => e.type === 'hitStop')).toEqual([{ type: 'hitStop', ms: 110 }]);
    expect(c.hitStop).toBeGreaterThan(0.1);
  });

  it('Marksman (Focus): hits deal less and store Focus; a green hit fires it all as a Power Shot', () => {
    const { c, t } = fight('vesper', { enemies: ['bandit'] });
    const atk = t.hero.atk * t.kits.vesper.atk; // her share of Rowan's attack
    const hp0 = c.enemies[0].hp;
    tapNew(c, t, 'yellow', 0.2, 25);
    expect(hp0 - c.enemies[0].hp).toBe(Math.round(atk * t.styles.focusShare));
    expect(focusOf(c)).toBeGreaterThan(0);
    const f = focusOf(c);
    const hp = c.enemies[0].hp;
    tapNew(c, t, 'green', 0.5, 25);
    expect(hp - c.enemies[0].hp).toBe(Math.round(atk * t.hero.greenMult) + Math.max(1, Math.round(f)));
    expect(focusOf(c)).toBe(0);
  });

  it("Marksman (Focus): a Power Shot keeps the Focus the foe didn't need (with and without HP to spare)", () => {
    // a foe with plenty of HP left: the whole Focus is spent
    const big = fight('vesper', { enemies: ['bandit'] });
    big.c.perk.focus = 20;
    big.c.enemies[0].hp = 140;
    powerShot(big.c);
    expect(focusOf(big.c)).toBe(0);
    expect(140 - big.c.enemies[0].hp).toBe(20);
    // a foe with 5 HP left: 5 of the 20 is used, 15 stays stored (the next foe gets it)
    const low = fight('vesper', { enemies: ['bandit', 'bandit'] });
    low.c.perk.focus = 20;
    low.c.enemies[0].hp = 5;
    powerShot(low.c);
    expect(low.c.enemies[0].alive).toBe(false);
    expect(focusOf(low.c)).toBeCloseTo(15, 5);
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
    // (allies stay the whole test: their stay is the next test's)
    const { c, t } = fight('moss', { tune: (t) => ((t.blocks.redTravelSec = 1), (t.kits.moss.allySec = 30)) });
    tapNew(c, t, 'green', 0.2);
    expect(c.allies.map((a) => a.kind)).toEqual(['thornling']);
    const hp = c.enemies[0].hp;
    go(c, c.time + t.kits.moss.thornEvery + 0.05);
    expect(c.enemies[0].hp).toBeLessThan(hp);
    tapNew(c, t, 'green', 0.6);
    tapNew(c, t, 'green', 0.9);
    expect(c.allies.map((a) => a.kind)).toEqual(['thornling', 'barkback', 'glowmoth']);
    // the Barkback braces (first after half its time), then eats a red that reaches the hero
    go(c, c.time + t.kits.moss.barkEvery / 2 + 0.05);
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

  it('Summoner (Call): every Nth yellow comes as a green, so the calls keep coming (with and without the style)', () => {
    const { c, t } = fight('moss');
    const kinds = Array.from({ length: t.styles.callEvery * 3 }, () => STYLE_HOOKS.summoner.spawnKind!(c, 'yellow', c.enemies[0].id));
    expect(kinds.filter((k) => k === 'green')).toHaveLength(3);
    expect(STYLE_HOOKS.summoner.spawnKind!(c, 'red', c.enemies[0].id)).toBe('red');
    // the same foes, untouched for 20 s: a Summoner sees well over the greens another hero does
    const greens = (hero: HeroId) => {
      const { c: f } = fight(hero, { enemies: ['slime', 'bandit'], spawning: true });
      let n = 0;
      for (let k = 0; k < 20; k++) {
        go(f, f.time + 1);
        n += f.drainEvents().filter((e) => e.type === 'spawn' && e.kind === 'green').length;
      }
      return n;
    };
    expect(greens('moss')).toBeGreaterThan(greens('rowan') * 1.5);
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
    // it gets there sooner (the burst is much faster; its landing slow-down gives a little of that back)
    expect(c.travelTime(c.cursorPos(), edge, 1)).toBeLessThan(plain.travelTime(c.cursorPos(), edge, 1) * 0.85);
    const land = c.zones.find((x) => x.kind === 'land')!;
    c.removeZone(land);
    expect(c.travelTime(c.cursorPos(), edge, 1)).toBeLessThan(plain.travelTime(c.cursorPos(), edge, 1) * 0.7);
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
    // from the burst's end, `dashLead` s of normal travel (through the ice) are left to press the hold (more with the
    // landing's slow-down: it ends at the hold's edge)
    const z = c.zones.find((x) => x.kind === 'dash')!;
    const land = c.zones.find((x) => x.kind === 'land')!;
    expect(land.hi).toBeLessThanOrEqual(edge + 1e-9);
    c.removeZone(z);
    expect(c.travelTime(to, edge, 1)).toBeGreaterThan(t.kits.sable.dashLead);
    c.removeZone(land);
    expect(c.travelTime(to, edge, 1)).toBeCloseTo(t.kits.sable.dashLead, 1);
    c.addZone('dash', (z.lo + z.hi) / 2, z.hi - z.lo, z.life);
    const l2 = c.addZone('land', (land.lo + land.hi) / 2, land.hi - land.lo, land.life);
    Object.assign(l2, { lo: land.lo, hi: land.hi });
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

  it("Neve's Glacier: hits every foe, freezes every red on the bar solid (one at the wall and an icicle too), slows the whole bar, then its middle; ice bothers her half as much", () => {
    const { c, t } = fight('neve', { enemies: ['bandit', 'bandit'], tune: (t) => (t.blocks.redTravelSec = 2) });
    const k = t.kits.neve;
    const moving = c.spawnBlock('red', 0.8);
    const icicle = c.spawnBlock('red', 0.55, c.enemies[1].id, undefined, { still: true, fuse: 0.5 });
    const wall = c.spawnBlock('red', 0.05);
    go(c, c.time + 0.05); // the one at the left end is waiting to strike now
    expect(wall.impactTimer).toBeGreaterThanOrEqual(0);
    c.stacks = 2;
    c.finisher();
    expect(c.enemies.every((e) => e.hp < 140)).toBe(true);
    const ev = c.drainEvents();
    expect(ev.filter((e) => e.type === 'perk' && e.id === 'glacier')).toEqual([expect.objectContaining({ amount: 3 })]);
    expect(c.blocks.filter((b) => b.kind === 'frozen')).toHaveLength(0); // held, still reds (Big Freeze makes ice)
    for (const b of [moving, icicle, wall]) expect(b.chill > 0 && b.chillMult === 0, `${b.pos}`).toBe(true);
    // the whole bar is slowed for a moment, the middle for longer
    const slows = () => c.zones.filter((z) => z.kind === 'slow');
    expect(Math.min(...slows().map((z) => z.lo))).toBeCloseTo(0);
    expect(Math.max(...slows().map((z) => z.hi))).toBeCloseTo(1);
    for (const p of [0.05, 0.5, 0.95]) expect(c.zoneMultAt(p), `${p}`).toBeCloseTo(t.bar.slowMult);
    const hp = c.hero.hp;
    const p = moving.pos;
    go(c, c.time + Math.min(k.glacierSec, k.glacierBarSec) - 0.1);
    expect(moving.pos).toBeCloseTo(p, 5); // frozen in place
    expect(c.blocks.includes(wall) && c.blocks.includes(icicle)).toBe(true); // nothing struck
    expect(c.hero.hp).toBe(hp);
    go(c, c.time + 0.2);
    expect(c.zoneMultAt(0.05)).toBeCloseTo(1); // the ends are back to normal...
    expect(c.zoneMultAt(0.5)).toBeCloseTo(t.bar.slowMult); // ...the middle still slow
    go(c, c.time + k.glacierSec + 0.6); // then they thaw: the one at the wall and the icicle strike
    expect(c.hero.hp).toBeLessThan(hp);
    const z = c.addZone('ice', 0.2, 0.1, 0);
    expect(c.zoneMult(z)).toBeCloseTo(1 + (t.bar.iceMult - 1) * k.iceResist);
  });

  it("Neve's Cold Snap: shattered ice fills only part of a hit's meter (it used to fill a green's); a yellow fills a hit's", () => {
    const { c, t } = fight('neve');
    c.meter = 0;
    tapNew(c, t, 'frozen', 0.4, 25);
    expect(c.meter).toBeCloseTo(t.meter.perHit * t.kits.neve.iceMeter, 5);
    expect(t.kits.neve.iceMeter).toBeLessThan(1);
    c.meter = 0;
    tapNew(c, t, 'yellow', 0.7, 25);
    expect(c.meter).toBeCloseTo(t.meter.perHit, 5);
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
    expect(KIT_HOOKS.tam.hurt!(c, 10, 'bomb', 0)).toBeCloseTo(10 * (1 - t.kits.tam.blastShield));
  });

  it("Hollis: every block slams the red's owner (a Perfect one harder); Iron Hide trims reds; Rampart bounces reds off the left end", () => {
    const { c, t } = fight('hollis', { tune: (t) => (t.enemies.slime.hp = 400) }); // (Rampart mustn't kill it)
    const atk = t.hero.atk * t.kits.hollis.atk;
    tapNew(c, t, 'red', 0.2, 30); // a plain block
    expect(c.enemies[0].hp).toBe(400 - Math.round(atk * t.kits.hollis.slam));
    const slam = c.drainEvents().filter((e) => e.type === 'enemyHurt' && e.perk === 'shieldSlam');
    expect(slam).toHaveLength(1);
    c.enemies[0].hp = 400;
    tapNew(c, t, 'red', 0.4); // a Perfect one
    t.blocks.redTravelSec = 1; // now let reds reach the left end
    expect(c.enemies[0].hp).toBe(400 - Math.round(atk * t.kits.hollis.slamPerfect));
    expect(t.kits.hollis.slamPerfect).toBeGreaterThan(t.kits.hollis.slam);
    expect(KIT_HOOKS.hollis.hurt!(c, 100, 'red', 0)).toBeCloseTo(100 * (1 - t.kits.hollis.ironHide));
    c.stacks = 1;
    c.finisher();
    const r = c.spawnBlock('red', 0.06);
    go(c, c.time + 0.3);
    expect(c.hero.hp).toBe(c.maxHp());
    expect(c.blocks.includes(r)).toBe(true);
    expect(c.drainEvents().some((e) => e.type === 'deflect')).toBe(true);
  });

  it("Vesper's Volley pins every red in place for a moment (an icicle's fuse waits too)", () => {
    const { c, t } = fight('vesper', { tune: (t) => (t.blocks.redTravelSec = 2) });
    const r = c.spawnBlock('red', 0.8);
    const icicle = c.spawnBlock('red', 0.5, undefined, undefined, { still: true, fuse: 0.3 });
    c.stacks = 1;
    c.finisher();
    expect(c.blocks.includes(r)).toBe(true);
    const p = r.pos;
    go(c, c.time + 0.5);
    expect(r.pos).toBeCloseTo(p, 5);
    expect(c.blocks.includes(icicle)).toBe(true); // its 0.3 s fuse waits out the pin
    go(c, c.time + t.kits.vesper.pinSec);
    expect(c.blocks.includes(icicle)).toBe(false); // then it strikes
  });

  it("Torva: Quake knocks reds back on a Perfect; Wind-Up's next hit smashes (x base + a step per combo) and stuns; Earthsplitter clears the bar", () => {
    const { c, t } = fight('torva', { tune: (t) => (t.blocks.redTravelSec = 20) });
    const k = t.kits.torva;
    const r = c.spawnBlock('red', 0.8);
    const p0 = r.pos;
    tapNew(c, t, 'yellow', 0.2);
    go(c, c.time + 0.3);
    expect(r.pos).toBeGreaterThan(p0 - 0.02);
    tapNew(c, t, 'green', 0.35, 25);
    const hp = c.enemies[0].hp;
    c.drainEvents();
    tapNew(c, t, 'yellow', 0.5, 25); // the third hit: combo 3
    const mult = k.windUpBase + 3 * k.windUpStep;
    expect(windUpMult(c)).toBeCloseTo(mult);
    expect(hp - c.enemies[0].hp).toBe(Math.round(t.hero.atk * k.atk * t.styles.heavyMult * mult));
    expect(c.enemies[0].stun).toBeGreaterThan(0);
    // the view sees the multiplier (x100) on the Wind-Up's perk event
    expect(c.drainEvents().find((e) => e.type === 'perk' && e.id === 'windUp')).toMatchObject({ amount: Math.round(mult * 100) });
    c.spawnBlock('yellow', 0.9);
    c.stacks = 1;
    c.finisher();
    expect(c.blocks).toHaveLength(0);
  });

  it("Sable's Shadow Dash lands slow: the cursor runs at landMult up to the block it dashed to (about landSec), then it's gone", () => {
    const { c, t } = fight('sable');
    const S = t.kits.sable;
    const next = c.spawnBlock('yellow', 0.75);
    tapNew(c, t, 'yellow', 0.2);
    const dash = c.zones.find((z) => z.kind === 'dash')!;
    const land = c.zones.find((z) => z.kind === 'land')!;
    expect(land).toBeDefined();
    const edge = next.pos - next.width / 2;
    expect(land.lo).toBeCloseTo(dash.hi, 5);
    expect(land.hi).toBeLessThanOrEqual(edge + 1e-9);
    expect(land.mult).toBeCloseTo(S.landMult);
    expect(c.zoneMultAt((land.lo + land.hi) / 2)).toBeCloseTo(S.landMult);
    // from the landing to the block takes longer than the dash's lead alone (about landSec), so it can be hit
    const t0 = c.travelTime(land.lo, edge, 1);
    expect(t0).toBeGreaterThan(S.dashLead * 1.5);
    expect(t0).toBeLessThan(S.landSec + S.dashLead);
    // the cursor goes through it, and it's gone
    go(c, c.time + 0.9);
    expect(c.zones.some((z) => z.kind === 'land')).toBe(false);
    // with the landing turned off (landMult 1), no patch
    const off = fight('sable', { tune: (t) => (t.kits.sable.landMult = 1) });
    off.c.spawnBlock('yellow', 0.75);
    tapNew(off.c, off.t, 'yellow', 0.2);
    expect(off.c.zones.some((z) => z.kind === 'dash')).toBe(true);
    expect(off.c.zones.some((z) => z.kind === 'land')).toBe(false);
  });

  it("Vesper's greens are targets: they come wider and carry `target` (another hero's greens don't)", () => {
    const { c, t } = fight('vesper');
    c.trySpawn('green', c.enemies[0].id);
    const g = c.blocks.at(-1)!;
    expect(g.kind).toBe('green');
    expect(g.target).toBe(true);
    expect(g.width).toBeCloseTo(t.blocks.greenWidth * t.styles.targetWidth);
    c.trySpawn('yellow', c.enemies[0].id);
    expect(c.blocks.at(-1)!.target).toBe(false);
    const r = fight('rowan');
    r.c.trySpawn('green', r.c.enemies[0].id);
    expect(r.c.blocks.at(-1)!.target).toBe(false);
    expect(r.c.blocks.at(-1)!.width).toBeCloseTo(r.t.blocks.greenWidth);
  });

  it("Vesper's Patience: at full Focus with no green out, a Perfect hit fires it as a critical Power Shot (a plain hit, or a green out: no)", () => {
    const { c, t } = fight('vesper', { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 3000) });
    c.perk.focus = focusCap(c);
    tapNew(c, t, 'yellow', 0.2, 25); // not Perfect
    expect(focusOf(c)).toBeCloseTo(focusCap(c));
    const g = c.spawnBlock('green', 0.9);
    tapNew(c, t, 'yellow', 0.4); // Perfect, but a green is out to fire it
    expect(focusOf(c)).toBeCloseTo(focusCap(c));
    c.removeBlock(g, 'expire');
    c.drainEvents();
    tapNew(c, t, 'yellow', 0.6); // Perfect, no green: it fires
    expect(focusOf(c)).toBe(0);
    const ev = c.drainEvents();
    expect(ev.find((e) => e.type === 'perk' && e.id === 'patience')).toBeDefined();
    expect(ev.find((e) => e.type === 'enemyHurt' && e.perk === 'powerShot')).toMatchObject({ crit: true });
    // a green the cursor can't get to (behind a mirror shard) doesn't count as out
    const m = fight('vesper', { enemies: ['bandit'], tune: (t) => (t.enemies.bandit.hp = 3000) });
    m.c.perk.focus = focusCap(m.c);
    m.c.spawnBlock('mirror', 0.6);
    m.c.spawnBlock('green', 0.85);
    tapNew(m.c, m.t, 'yellow', 0.3);
    expect(focusOf(m.c)).toBe(0);
  });

  it("Moss's allies grow with the Companion stat: a Thornling jabs harder, a Glowmoth heals more; the ally events say what they did and how strong", () => {
    const jab = (bonus: number) => {
      const { c, t } = fight('moss', { tune: (t) => ((t.kits.moss.allySec = 30), (t.kits.moss.atk = 5), (t.enemies.slime.hp = 900)) });
      c.hero.bonusPet = bonus;
      tapNew(c, t, 'green', 0.2);
      go(c, c.time + t.kits.moss.thornEvery * 0.5 + 0.05);
      return { act: c.drainEvents().find((e) => e.type === 'ally' && e.action === 'act'), c, t };
    };
    const base = jab(0);
    const big = jab(base.t.companion.damage * 2); // the stat tripled
    expect(allyPower(base.c)).toBe(1);
    expect(allyPower(big.c)).toBeCloseTo(1 + 2 * big.t.kits.moss.allyComp);
    const k = base.t.kits.moss;
    expect(base.act).toMatchObject({ kind: 'thornling', amount: Math.round(base.c.stats().atk * k.thornDmg), power: 1 });
    expect(big.act).toMatchObject({ kind: 'thornling', amount: Math.round(big.c.stats().atk * k.thornDmg * allyPower(big.c)) });
    expect((big.act as { amount: number }).amount).toBeGreaterThan((base.act as { amount: number }).amount);
    // a Glowmoth (the third call) heals max HP x mothHeal x power; a Barkback still braces on its own clock
    const heal = (bonus: number) => {
      const { c, t } = fight('moss', { tune: (t) => ((t.kits.moss.allySec = 30), (t.kits.moss.mothHeal = 0.05)) });
      c.hero.bonusPet = bonus;
      c.hero.hp = 10;
      callAlly(c);
      callAlly(c);
      callAlly(c);
      c.drainEvents();
      go(c, c.time + t.kits.moss.mothEvery * 0.5 + 0.05);
      return { act: c.drainEvents().find((e) => e.type === 'ally' && e.action === 'act' && e.kind === 'glowmoth'), c };
    };
    const h0 = heal(0);
    const h1 = heal(base.t.companion.damage * 2);
    expect(h0.act).toMatchObject({ amount: Math.round(h0.c.maxHp() * 0.05) });
    expect(h1.act).toMatchObject({ amount: Math.round(h1.c.maxHp() * 0.05 * allyPower(h1.c)) });
    expect(allyEvery(big.c, 'barkback')).toBeCloseTo(k.barkEvery);
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
