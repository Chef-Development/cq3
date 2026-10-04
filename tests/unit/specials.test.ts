// Special moves: the telegraph scheduling and every action (src/core/specials.ts), on each enemy that uses it.
import { describe, expect, it } from 'vitest';
import { isRed, type Combat, type CombatEvent, type Enemy } from '../../src/core/combat';
import { runAction } from '../../src/core/specials';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { setup, timeAt } from './helpers';

/** Index of a special by id. */
const sp = (c: Combat, e: Enemy, id: string) => c.specialsOf(e).findIndex((s) => s.id === id);
const fire = (c: Combat, e: Enemy, id: string) => c.useSpecial(e, sp(c, e, id));
const reds = (c: Combat) => c.blocks.filter((b) => isRed(b.kind));
const of = (events: CombatEvent[], type: CombatEvent['type']) => events.filter((e) => e.type === type);
/** Step until an event of `type` shows up (or `max` seconds pass); returns the events so far. */
function until(c: Combat, type: CombatEvent['type'], max = 30): CombatEvent[] {
  const out: CombatEvent[] = [];
  for (let i = 0; i < max * 120; i++) {
    c.step();
    const ev = c.drainEvents();
    out.push(...ev);
    if (ev.some((e) => e.type === type)) return out;
  }
  return out;
}

describe('telegraphs', () => {
  it('a timed special winds up for its telegraph time, then fires (the enemy holds its pattern meanwhile)', () => {
    const { c, t } = setup({ enemies: ['boar'], specials: true, tune: (t) => (t.blocks.redTravelSec = 100) });
    const boar = c.enemies[0];
    const def = t.enemies.boar.specials[0];
    const ev = until(c, 'telegraph');
    const tg = of(ev, 'telegraph')[0];
    expect(tg).toMatchObject({ enemyId: boar.id, special: 'charge', name: 'Charge!', sound: 'charge', sec: def.tell });
    expect(c.time).toBeCloseTo(def.first!, 1);
    expect(c.telegraph?.enemyId).toBe(boar.id);
    expect(reds(c)).toHaveLength(0);
    const after = until(c, 'special');
    expect(c.time).toBeCloseTo(def.first! + def.tell, 1);
    expect(of(after, 'special')[0]).toMatchObject({ special: 'charge' });
    expect(of(after, 'spawn').some((e) => e.type === 'spawn' && e.special)).toBe(true);
    expect(boar.uses[0]).toBe(1);
  });

  it('one telegraph at a time: the next waits for the gap after the last special', () => {
    const { c, t } = setup({ enemies: ['boar', 'boar'], specials: true, tune: (t) => (t.blocks.redTravelSec = 100) });
    const ev = until(c, 'special');
    expect(of(ev, 'telegraph')).toHaveLength(1);
    const firstAt = c.time;
    const next = until(c, 'telegraph');
    expect(of(next, 'telegraph')[0]).toMatchObject({ enemyId: c.enemies[1].id });
    expect(c.time - firstAt).toBeGreaterThanOrEqual(t.specials.tellGap - 0.01);
  });

  it('a telegraph is called off if its enemy dies first', () => {
    const { c } = setup({ enemies: ['boar', 'slime'], specials: true });
    until(c, 'telegraph');
    c.enemies[0].hp = 1;
    c.spawnBlock('yellow', c.cursorPosAt(c.time));
    c.tap(c.time);
    expect(c.enemies[0].alive).toBe(false);
    expect(c.telegraph).toBeNull();
    expect(of(c.drainEvents(), 'tellCancel')).toHaveLength(1);
  });

  it('an HP special fires once, when HP drops below its threshold', () => {
    const { c } = setup({ enemies: ['slime'], specials: true });
    const slime = c.enemies[0];
    c.step();
    expect(c.telegraph).toBeNull();
    slime.hp = Math.floor(slime.maxHp * 0.5) - 1;
    const ev = until(c, 'split', 3);
    expect(of(ev, 'telegraph')[0]).toMatchObject({ special: 'split' });
    expect(of(ev, 'split')).toHaveLength(1);
    // the slimelets don't split again
    until(c, 'telegraph', 3);
    expect(c.telegraph).toBeNull();
  });

  it('every special has a 0.6-1.0 s telegraph, a name, a sound and something to do', () => {
    for (const [key, e] of Object.entries(DEFAULT_TUNING.enemies)) {
      // 0-2 moves; a boss's phase changes (HP-gated specials) come on top
      expect(e.specials.filter((s) => !(e.boss && s.gate)).length, key).toBeLessThanOrEqual(2);
      for (const s of e.specials) {
        expect(s.tell, `${key}.${s.id}`).toBeGreaterThanOrEqual(0.6);
        expect(s.tell, `${key}.${s.id}`).toBeLessThanOrEqual(1.0);
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.sound.length).toBeGreaterThan(0);
        expect(s.actions.length).toBeGreaterThan(0);
        expect(s.every !== undefined || s.hpBelow !== undefined, `${key}.${s.id} is timed or HP-triggered`).toBe(true);
      }
    }
  });

  it('every enemy except the summoned ones has a special that changes how the bar plays', () => {
    for (const [key, e] of Object.entries(DEFAULT_TUNING.enemies)) if (key !== 'slimelet' && key !== 'piglet') expect(e.specials.length, key).toBeGreaterThan(0);
  });
});

describe('formation action', () => {
  const quiet = (t: typeof DEFAULT_TUNING) => (t.blocks.redTravelSec = 50);

  it('Boar: Charge sends one fast, wide red', () => {
    const { c, t } = setup({ enemies: ['boar'], tune: quiet });
    fire(c, c.enemies[0], 'charge');
    const [r] = reds(c);
    expect(r.speed).toBe(1.4);
    expect(r.width).toBeCloseTo(t.blocks.redWidth * 1.2, 6);
    expect(r.vel).toBeCloseTo(1.4 * c.redVel(r.width), 6);
    expect(r.pos).toBeCloseTo(1 - r.width / 2, 6);
  });

  it('Crow: Dive sends three quick, wide reds one after another', () => {
    const { c, t } = setup({ enemies: ['crow'] });
    fire(c, c.enemies[0], 'dive');
    expect(reds(c)).toHaveLength(1);
    c.advanceTo(0.76);
    expect(reds(c)).toHaveLength(2);
    c.advanceTo(1.51);
    const rs = reds(c);
    expect(rs).toHaveLength(3);
    for (const r of rs) {
      expect(r.width).toBeCloseTo(t.blocks.redWidth * 1.15, 6);
      expect(r.speed).toBe(1.2);
    }
    expect(rs[0].pos).toBeLessThan(rs[1].pos);
    expect(rs[1].pos).toBeLessThan(rs[2].pos);
  });

  it("Goblin Archer: Volley puts three reds across the bar's right side at once", () => {
    const { c } = setup({ enemies: ['archer'], tune: quiet });
    fire(c, c.enemies[0], 'volley');
    const pos = reds(c)
      .map((r) => r.pos)
      .sort();
    expect(pos).toHaveLength(3);
    expect(pos[0]).toBeCloseTo(0.38, 2);
    expect(pos[1]).toBeCloseTo(0.66, 2);
    expect(pos[2]).toBeLessThanOrEqual(1);
  });

  it('a volley shifts a red over when another red is already there', () => {
    const { c } = setup({ enemies: ['archer'], tune: quiet });
    c.spawnBlock('red', 0.66, c.enemies[0].id);
    fire(c, c.enemies[0], 'volley');
    const rs = reds(c);
    expect(rs).toHaveLength(4);
    for (const a of rs) for (const b of rs) if (a !== b) expect(Math.abs(a.pos - b.pos)).toBeGreaterThanOrEqual((a.width + b.width) / 2 - 1e-6);
  });

  it('Bandit: Smoke drops two purple traps right beside yellow blocks', () => {
    const { c } = setup({ enemies: ['bandit'] });
    c.spawnBlock('yellow', 0.3);
    c.spawnBlock('yellow', 0.7);
    fire(c, c.enemies[0], 'smoke');
    const traps = c.blocks.filter((b) => b.kind === 'purple');
    const yellows = c.blocks.filter((b) => b.kind === 'yellow');
    expect(traps).toHaveLength(2);
    for (const p of traps) expect(yellows.some((y) => Math.abs(Math.abs(y.pos - p.pos) - (y.width + p.width) / 2) < 1e-6)).toBe(true);
  });

  it('Smoke with no yellow on the bar adds one to hide beside', () => {
    const { c } = setup({ enemies: ['bandit'] });
    fire(c, c.enemies[0], 'smoke');
    const traps = c.blocks.filter((b) => b.kind === 'purple');
    const yellows = c.blocks.filter((b) => b.kind === 'yellow');
    expect(traps).toHaveLength(2);
    expect(yellows.length).toBeGreaterThanOrEqual(1);
    for (const p of traps) expect(yellows.some((y) => Math.abs(Math.abs(y.pos - p.pos) - (y.width + p.width) / 2) < 1e-6)).toBe(true);
  });

  it('Wolf: Howl sends a red from each wolf, one right after the other', () => {
    const { c } = setup({ enemies: ['wolf', 'wolf'] });
    const [a, b] = c.enemies;
    fire(c, a, 'howl');
    expect(reds(c)).toHaveLength(1);
    c.advanceTo(0.9);
    const rs = reds(c).sort((x, y) => x.pos - y.pos);
    expect(rs).toHaveLength(2);
    expect(new Set(rs.map((r) => r.ownerId))).toEqual(new Set([a.id, b.id]));
    expect(rs[0].vel).toBeCloseTo(rs[1].vel, 6);
    // a lone wolf howls both reds itself
    b.alive = false;
    c.blocks.length = 0;
    fire(c, a, 'howl');
    c.advanceTo(c.time + 0.9);
    expect(reds(c).every((r) => r.ownerId === a.id)).toBe(true);
  });

  it('a pair entry lands touching the block before it (both from the partner when one is named)', () => {
    const { c } = setup({ enemies: ['wolf', 'wolf'], tune: quiet });
    const [a, b] = c.enemies;
    runAction(c, a, { type: 'formation', blocks: [{ kind: 'red' }, { kind: 'red', pair: true, partner: true }] });
    const rs = reds(c).sort((x, y) => x.pos - y.pos);
    expect(rs).toHaveLength(2);
    expect(new Set(rs.map((r) => r.ownerId))).toEqual(new Set([a.id, b.id]));
    expect(rs[1].pos - rs[0].pos).toBeCloseTo((rs[0].width + rs[1].width) / 2, 6); // touching
    expect(rs[0].vel).toBeCloseTo(rs[1].vel, 6);
  });

  it('Ruin Golem: a huge shield block that takes three taps', () => {
    const { c, t } = setup({ enemies: ['golem'], tune: quiet });
    fire(c, c.enemies[0], 'hugeShield');
    const [s] = reds(c);
    expect(s.kind).toBe('shield');
    expect(s.width).toBeCloseTo(t.blocks.redWidth * 2.2, 6);
    expect(s.taps).toBe(3);
  });

  it('Bandit Captain: throws two bombs, the second a moment later', () => {
    const { c } = setup({ enemies: ['captain'] });
    fire(c, c.enemies[0], 'bombs');
    expect(reds(c).map((r) => r.kind)).toEqual(['bomb']);
    c.advanceTo(0.9);
    expect(reds(c).map((r) => r.kind)).toEqual(['bomb', 'bomb']);
  });

  it('a red waits for room at the right end', () => {
    const { c } = setup({ enemies: ['boar'], tune: quiet });
    const blocker = c.spawnBlock('red', 0.97, c.enemies[0].id);
    fire(c, c.enemies[0], 'charge');
    expect(reds(c)).toEqual([blocker]);
    expect(c.queue).toHaveLength(1);
    blocker.pos = 0.5;
    c.advanceTo(0.2);
    expect(reds(c)).toHaveLength(2);
  });
});

describe('heal, spores and shell', () => {
  it('heal: self, allies or everyone, never above max HP', () => {
    const { c } = setup({ enemies: ['slime', 'slime', 'bandit'] });
    const [a, b, d] = c.enemies;
    for (const e of c.enemies) e.hp = Math.round(e.maxHp / 2);
    runAction(c, a, { type: 'heal', target: 'self', frac: 0.25 });
    expect([a.hp, b.hp, d.hp]).toEqual([60, 40, 70]);
    runAction(c, a, { type: 'heal', target: 'allies', frac: 0.25 });
    expect([a.hp, b.hp, d.hp]).toEqual([60, 60, 105]);
    runAction(c, a, { type: 'heal', target: 'all', frac: 0.5 });
    expect([a.hp, b.hp, d.hp]).toEqual([80, 80, 140]);
    expect(of(c.drainEvents(), 'enemyHeal').length).toBeGreaterThan(0);
  });

  it('Mushroom Shaman: unbroken spores heal it and its allies; a popped spore heals nobody', () => {
    const { c } = setup({ enemies: ['shaman', 'slime'] });
    const [sham, slime] = c.enemies;
    sham.hp = 100;
    slime.hp = 10;
    fire(c, sham, 'spores');
    const spores = c.blocks.filter((b) => b.kind === 'spore');
    expect(spores).toHaveLength(2);
    // pop one spore
    const t0 = 0.05;
    c.advanceTo(t0);
    const target = spores[0];
    const at = c.time + 1e-4;
    target.pos = c.cursorPosAt(at);
    expect(c.tap(at).outcome).toBe('hit');
    c.advanceTo(4);
    const heal = Math.round(sham.maxHp * 0.1);
    expect(of(c.drainEvents(), 'sporeHeal')).toHaveLength(1);
    expect(sham.hp).toBe(100 - 10 + heal); // popping the spore was a normal hit on the shaman (the front enemy)
    expect(slime.hp).toBe(Math.min(slime.maxHp, 10 + Math.round(slime.maxHp * 0.1)));
  });

  it('Shell Beetle: yellow hits deal half until both shell blocks are broken; bombs ignore the shell', () => {
    const { c, t } = setup({ enemies: ['beetle'], tune: (t) => ((t.enemies.beetle.hp = 500), (t.cursor.speedPerHit = 0)) });
    const beetle = c.enemies[0];
    fire(c, beetle, 'shell');
    expect(beetle.shell).toBe(0.5);
    const wards = c.blocks.filter((b) => b.kind === 'ward');
    expect(wards).toHaveLength(2);
    expect(of(c.drainEvents(), 'shellOn')).toHaveLength(1);
    // a yellow hit deals half
    c.spawnBlock('yellow', 0.5);
    for (const w of wards) w.pos = w.pos < 0.5 ? 0.15 : 0.85;
    c.advanceTo(timeAt(t, 0.5) - 0.05);
    c.tap(timeAt(t, 0.5));
    expect(beetle.hp).toBe(500 - t.hero.atk / 2);
    // break both wards
    c.advanceTo(timeAt(t, 0.85) - 0.05);
    expect(c.tap(timeAt(t, 0.85)).outcome).toBe('ward');
    expect(beetle.shell).toBe(0.5);
    c.advanceTo(2 * t.cursor.basePassSec - timeAt(t, 0.15) - 0.05);
    expect(c.tap(2 * t.cursor.basePassSec - timeAt(t, 0.15)).outcome).toBe('ward');
    expect(beetle.shell).toBe(1);
    const ev = c.drainEvents();
    expect(of(ev, 'wardBreak').map((e) => e.type === 'wardBreak' && e.left)).toEqual([1, 0]);
    expect(of(ev, 'shellOff')).toHaveLength(1);
    expect(c.combo).toBe(3); // ward breaks count toward the combo
  });

  it('the shell only softens attack hits: a bomb deals full damage', () => {
    const { c, t } = setup({ enemies: ['beetle'], tune: (t) => (t.enemies.beetle.hp = 500) });
    const beetle = c.enemies[0];
    fire(c, beetle, 'shell');
    expect(c.damageTaken(beetle, 40, 'bomb')).toBe(40);
    expect(c.damageTaken(beetle, 40, 'finisher')).toBe(40);
    expect(c.damageTaken(beetle, 40, 'hit')).toBe(20);
    expect(t.enemies.beetle.specials[0].actions[0]).toMatchObject({ type: 'shell', mult: 0.5, blocks: 2 });
  });

  it('a shell can go on an ally (the one lowest on HP)', () => {
    const { c } = setup({ enemies: ['beetle', 'slime', 'bandit'] });
    const [beetle, slime, bandit] = c.enemies;
    slime.hp = 10;
    runAction(c, beetle, { type: 'shell', target: 'ally', mult: 0.5, blocks: 1 });
    expect(slime.shell).toBe(0.5);
    expect(beetle.shell).toBe(1);
    expect(bandit.shell).toBe(1);
    expect(c.blocks.filter((b) => b.kind === 'ward').map((b) => b.ownerId)).toEqual([slime.id]);
  });
});

describe('summon and split', () => {
  it('Bandit Captain: at half HP whistles for two Bandits', () => {
    const { c } = setup({ enemies: ['captain'], specials: true });
    const cap = c.enemies[0];
    cap.hp = Math.floor(cap.maxHp / 2) - 1;
    const ev = until(c, 'summon', 3);
    const s = of(ev, 'summon')[0];
    expect(s && s.type === 'summon' && s.ids).toHaveLength(2);
    expect(c.enemies.filter((e) => e.alive).map((e) => e.key)).toEqual(['captain', 'bandit', 'bandit']);
    expect(new Set(c.enemies.map((e) => e.slot)).size).toBe(3);
  });

  it('summons stop at the most enemies the screen holds', () => {
    const { c, t } = setup({ enemies: ['captain', 'slime', 'slime'] });
    runAction(c, c.enemies[0], { type: 'summon', enemies: ['bandit', 'bandit'] });
    expect(c.enemies.filter((e) => e.alive)).toHaveLength(t.specials.maxEnemies);
  });

  it('linked summons flee when their summoner falls; the fight is won', () => {
    const { c } = setup({ enemies: ['boarKing'] });
    const king = c.enemies[0];
    king.uses = king.uses.map(() => 1); // past his phase changes (they keep him alive until they fire)
    runAction(c, king, { type: 'summon', enemies: ['piglet', 'piglet'], link: true });
    expect(c.summonsAlive(king.id)).toBe(true);
    king.hp = 1;
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(0.6);
    c.tap(timeAt(c.tuning, 0.5));
    expect(king.alive).toBe(false);
    expect(c.enemies.filter((e) => e.key === 'piglet').every((p) => p.fled && !p.alive)).toBe(true);
    expect(c.result).toBe('won');
    expect(c.killQueue).toEqual([king.id]); // fled piglets are not kills
  });

  it('Slime: Split replaces it with two small slimes (no kill reward); its pending reds pass on', () => {
    const { c, t } = setup({ enemies: ['slime'], tune: (t) => (t.kill.atk = 1) });
    const slime = c.enemies[0];
    slime.hp = 30;
    const red = c.spawnBlock('red', 0.8, slime.id);
    fire(c, slime, 'split');
    const kids = c.enemies.filter((e) => e.key === 'slimelet');
    expect(kids).toHaveLength(2);
    expect(kids.every((k) => k.alive && k.hp === Math.round(30 * 0.55))).toBe(true);
    expect(slime.alive).toBe(false);
    expect(slime.split).toBe(true);
    expect(c.killQueue).toEqual([]);
    expect(c.hero.bonusAtk).toBe(0);
    expect(red.ownerId).toBe(kids[0].id);
    expect(kids[0].slot).toBe(slime.slot);
    expect(c.result).toBeNull();
    expect(t.enemies.slimelet.specials).toHaveLength(0);
  });

  it('a hit big enough kills the slime before it can split', () => {
    const { c } = setup({ enemies: ['slime'], specials: true });
    c.stacks = 5;
    c.finisher();
    expect(c.result).toBe('won');
    expect(c.enemies).toHaveLength(1);
  });

  it('Big Slime (elite): splits into two Slimes and spreads spores', () => {
    const { c } = setup({ enemies: ['bigSlime'] });
    const big = c.enemies[0];
    fire(c, big, 'spores');
    expect(c.blocks.filter((b) => b.kind === 'spore')).toHaveLength(2);
    big.hp = 200;
    fire(c, big, 'split');
    expect(c.enemies.filter((e) => e.alive).map((e) => e.key)).toEqual(['slime', 'slime']);
    expect(c.enemies.filter((e) => e.alive).every((e) => e.hp === Math.round(200 * 0.4))).toBe(true);
  });
});

describe('cursor and guard', () => {
  it('Ruin Golem: Stomp freezes the cursor for half a second; taps count where it stands', () => {
    const { c, t } = setup({ enemies: ['golem'] });
    c.advanceTo(0.3);
    const p0 = c.cursorPosAt(c.time);
    fire(c, c.enemies[0], 'stomp');
    expect(c.freeze).toBe(0.5);
    c.advanceTo(0.6);
    expect(c.cursorPosAt(c.time)).toBeCloseTo(p0, 6);
    c.spawnBlock('yellow', p0);
    expect(c.tap(c.time).outcome).toBe('hit');
    c.advanceTo(0.9);
    expect(c.freeze).toBe(0);
    expect(c.cursorPosAt(c.time)).toBeGreaterThan(p0);
    const ev = c.drainEvents();
    expect(of(ev, 'freeze')).toHaveLength(1);
    expect(of(ev, 'thaw')).toHaveLength(1);
    expect(t.enemies.golem.specials.find((s) => s.id === 'stomp')!.tell).toBeGreaterThanOrEqual(0.6);
  });

  it('a cursor floor keeps the speed from dropping below it (an enraged boss)', () => {
    const { c } = setup({ enemies: ['boarKing'] });
    expect(c.speedMult()).toBe(1);
    runAction(c, c.enemies[0], { type: 'cursor', minSpeed: 1.2 });
    expect(c.speedMult()).toBe(1.2);
    c.combo = 30;
    expect(c.speedMult()).toBeCloseTo(Math.max(1.2, Math.min(c.tuning.cursor.maxSpeedMult, 1 + c.tuning.cursor.speedPerHit * 30)), 6);
  });

  it('Hedge Knight: while its shield is raised a yellow tap is countered like a trap; greens and blocks are safe', () => {
    const { c, t } = setup({ enemies: ['knight'], tune: (t) => (t.cursor.speedPerHit = 0) });
    const knight = c.enemies[0];
    fire(c, knight, 'guard');
    expect(knight.guard).toBe(1.6);
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('green', 0.45);
    c.advanceTo(timeAt(t, 0.2) - 0.02);
    c.combo = 5;
    const r = c.tap(timeAt(t, 0.2));
    expect(r.outcome).toBe('counter');
    expect(c.hero.hp).toBe(100 - knight.special);
    expect(c.combo).toBe(0);
    expect(knight.hp).toBe(knight.maxHp);
    c.advanceTo(timeAt(t, 0.45) - 0.02);
    expect(c.tap(timeAt(t, 0.45)).outcome).toBe('hit');
    expect(knight.hp).toBeLessThan(knight.maxHp);
    // the shield drops after 1.6 s; yellow hits again
    c.advanceTo(2.1);
    expect(knight.guard).toBe(0);
    expect(of(c.drainEvents(), 'guardOff')).toHaveLength(1);
    const p = c.cursorPosAt(c.time + 0.001);
    c.spawnBlock('yellow', p);
    expect(c.tap(c.time + 0.001).outcome).toBe('hit');
  });
});

describe('Boar King', () => {
  const king = () => {
    const s = setup({ enemies: ['boarKing'], specials: true, tune: (t) => (t.blocks.redTravelSec = 100) });
    return { ...s, k: s.c.enemies[0] };
  };

  it('phase 1: frequent Charges', () => {
    const { c, k } = king();
    const ev = until(c, 'special', 10);
    expect(of(ev, 'special')[0]).toMatchObject({ special: 'charge' });
    expect(k.phase).toBe(1);
  });

  it("phase 2 at 66%: two Piglets join and he takes half damage while they live; damage can't skip the phase", () => {
    const { c, k } = king();
    // one huge hit can't take him past 66% before the phase change
    c.stacks = 5;
    c.hero.bonusAtk = 500;
    c.finisher();
    expect(k.hp).toBe(Math.ceil(0.66 * k.maxHp) - 1);
    c.cursorHold = 0;
    const ev = until(c, 'phase', 3);
    expect(of(ev, 'telegraph')[0]).toMatchObject({ special: 'piglets' });
    expect(k.phase).toBe(2);
    c.advanceTo(c.time + 0.1);
    expect(c.enemies.filter((e) => e.key === 'piglet' && e.alive)).toHaveLength(2);
    expect(k.protect).toBe(0.5);
    expect(c.damageTaken(k, 100, 'hit')).toBe(50);
    expect(c.damageTaken(k, 100, 'finisher')).toBe(50);
    // the piglets fall: full damage again
    for (const p of c.enemies.filter((e) => e.key === 'piglet')) (p.alive = false), (p.hp = 0);
    c.advanceTo(c.time + 0.05);
    expect(k.protect).toBe(1);
    expect(c.damageTaken(k, 100, 'hit')).toBe(100);
  });

  it('phase 3 at 33%: enraged (the cursor never drops below 1.2x) and Charges come two at a time', () => {
    const { c, k } = king();
    k.phase = 2;
    k.uses[sp(c, k, 'piglets')] = 1;
    k.hp = Math.floor(k.maxHp * 0.33) - 1;
    until(c, 'phase', 3);
    expect(k.phase).toBe(3);
    expect(c.minSpeed).toBe(1.2);
    expect(c.speedMult()).toBeGreaterThanOrEqual(1.2);
    // the single Charge is phase 1-2 only; the Double Charge takes over
    c.blocks.length = 0;
    c.tuning.blocks.redTravelSec = 2.8;
    const ev = until(c, 'special', 10);
    expect(of(ev, 'special')[0]).toMatchObject({ special: 'doubleCharge' });
    c.advanceTo(c.time + 0.65);
    const rs = reds(c);
    expect(rs).toHaveLength(2);
    expect(rs.every((r) => r.speed === 1.6)).toBe(true);
  });

  it('the phase scenes are named in the data', () => {
    expect(DEFAULT_TUNING.enemies.boarKing.phaseScenes).toEqual({ 2: 'boarKing2', 3: 'boarKing3' });
  });
});
