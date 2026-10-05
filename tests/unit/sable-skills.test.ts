import { describe, expect, it } from 'vitest';
import type { Combat, CombatEvent } from '../../src/core/combat';
import { skillN } from '../../src/core/heroes';
import type { Tuning } from '../../src/core/tuning';
import { SKILL_HOOKS } from '../../src/core/skill-fx';
import { SKILL_TREES } from '../../src/data/skills';
import { setupTwin, tapOver } from './twin-helpers';

const ofType = <K extends CombatEvent['type']>(ev: CombatEvent[], type: K) => ev.filter((e): e is Extract<CombatEvent, { type: K }> => e.type === type);
const perks = (ev: CombatEvent[], id: string) => ofType(ev, 'perk').filter((p) => p.id === id);

/** Put a yellow at each spot and hit them in order, each with its own hand; returns each tap's hit event. */
function hitSeq(c: Combat, seq: Array<[number, number]>) {
  const out: Array<Extract<CombatEvent, { type: 'hit' }>> = [];
  for (const [hand, pos] of seq) {
    c.spawnBlock('yellow', pos);
    const r = tapOver(c, hand, pos);
    expect(r.outcome, `${hand}@${pos}`).toBe('hit');
    const ev = c.drainEvents();
    out.push(ofType(ev, 'hit').find((h) => !h.echo)!);
  }
  return out;
}

// alternating hands, each spot ahead of both cursors as they sweep right (B is always half a bar ahead of A)
const ALT: Array<[number, number]> = [
  [0, 0.05],
  [1, 0.6],
  [0, 0.15],
  [1, 0.7],
  [0, 0.25],
  [1, 0.8],
];

describe('Sable skill tree: every rule node and capstone works in fights', () => {
  it('every Sable rule node and capstone has fight hooks', () => {
    for (const b of SKILL_TREES.sable) for (const n of b.nodes) if (n.kind !== 'stat') expect(SKILL_HOOKS[n.id], n.id).toBeDefined();
  });

  it('Flurry: every n-th alternating hit in a row crits', () => {
    const { c, t } = setupTwin({ skills: ['flurry'] });
    expect(skillN(t, 'flurry')).toBe(4);
    const hits = hitSeq(c, ALT.slice(0, 5));
    expect(hits.map((h) => h.crit)).toEqual([false, false, false, true, false]);
    expect(c.altStreak).toBe(5);
    // a hit with the same hand starts the chain over
    const { c: c2 } = setupTwin({ skills: ['flurry'] });
    const h2 = hitSeq(c2, [
      [0, 0.05],
      [0, 0.12],
      [1, 0.65],
      [0, 0.2],
      [1, 0.75],
    ]);
    expect(h2.map((h) => h.crit)).toEqual([false, false, false, false, true]);
    // a miss ends the chain
    const { c: c3 } = setupTwin({ skills: ['flurry'] });
    hitSeq(c3, ALT.slice(0, 3));
    c3.tap(c3.time, 1);
    expect(c3.altStreak).toBe(0);
    c3.drainEvents();
    const { c: shown } = setupTwin({ skills: ['flurry'] });
    for (const [hand, pos] of ALT.slice(0, 4)) {
      shown.spawnBlock('yellow', pos);
      tapOver(shown, hand, pos);
    }
    expect(perks(shown.drainEvents(), 'flurry')).toHaveLength(1);
  });

  it('Twin Rhythm: an alternating hit counts as 2 combo', () => {
    const { c } = setupTwin({ skills: ['twinRhythm'] });
    c.spawnBlock('yellow', 0.05);
    tapOver(c, 0, 0.05);
    expect(c.combo).toBe(1);
    c.spawnBlock('yellow', 0.6);
    tapOver(c, 1, 0.6);
    expect(c.combo).toBe(3);
    expect(perks(c.drainEvents(), 'twinRhythm')).toHaveLength(1);
    c.spawnBlock('yellow', 0.7);
    tapOver(c, 1, 0.7); // same hand: 1
    expect(c.combo).toBe(4);
    // without it, every hit is 1
    const { c: plain } = setupTwin();
    hitSeq(plain, ALT.slice(0, 2));
    expect(plain.combo).toBe(2);
  });

  it('Whirling Blades: n alternating hits in a row start Shadow Step', () => {
    const { c, t } = setupTwin({ skills: ['whirlingBlades'] });
    expect(skillN(t, 'whirlingBlades')).toBe(6);
    hitSeq(c, ALT.slice(0, 5));
    expect(c.hero.abilityTimer).toBe(0);
    const [hand, pos] = ALT[5];
    c.spawnBlock('yellow', pos);
    tapOver(c, hand, pos);
    expect(c.hero.abilityTimer).toBeCloseTo(t.sable.shadowSec, 6);
    const ev = c.drainEvents();
    expect(ev.some((e) => e.type === 'ability')).toBe(true);
    expect(perks(ev, 'whirlingBlades')).toHaveLength(1);
    // and Shadow Step works: the next hit echoes under the other cursor
    const a = c.spawnBlock('yellow', 0.35);
    const b = c.spawnBlock('yellow', 0.85);
    tapOver(c, 0, 0.35);
    expect(c.blocks).not.toContain(a);
    expect(c.blocks).not.toContain(b);
  });

  it('Cross Guard: a block with one cursor also blocks a red under the other', () => {
    const still = (t: Tuning) => (t.blocks.redTravelSec = 1000);
    const { c } = setupTwin({ skills: ['crossGuard'], tune: still });
    const rb = c.spawnBlock('red', 0.75, c.enemies[0].id);
    const ra = c.spawnBlock('red', 0.25, c.enemies[0].id);
    expect(tapOver(c, 1, 0.75).outcome).toBe('block');
    expect(c.blocks).not.toContain(rb);
    expect(c.blocks).not.toContain(ra);
    const ev = c.drainEvents();
    expect(ofType(ev, 'block').map((b) => [b.hand, b.echo])).toEqual([
      [1, false],
      [0, true],
    ]);
    expect(perks(ev, 'crossGuard')).toHaveLength(1);
    // without it, the other red stays
    const { c: plain } = setupTwin({ tune: still });
    plain.spawnBlock('red', 0.75, plain.enemies[0].id);
    const other = plain.spawnBlock('red', 0.25, plain.enemies[0].id);
    tapOver(plain, 1, 0.75);
    expect(plain.blocks).toContain(other);
  });

  it('Counter Slash: blocks with the left cursor hit back for n x attack; the right cursor’s don’t', () => {
    const { c, t } = setupTwin({ skills: ['counterSlash'], tune: (t) => (t.blocks.redTravelSec = 1000) });
    const foe = c.enemies[0];
    c.spawnBlock('red', 0.75, foe.id);
    tapOver(c, 1, 0.75);
    expect(foe.hp).toBe(foe.maxHp);
    expect(perks(c.drainEvents(), 'counterSlash')).toHaveLength(0);
    c.spawnBlock('red', 0.3, foe.id);
    expect(tapOver(c, 0, 0.3).outcome).toBe('block');
    const dmg = Math.round(t.hero.atk * t.sable.atkMult * skillN(t, 'counterSlash'));
    expect(foe.maxHp - foe.hp).toBe(dmg);
    expect(perks(c.drainEvents(), 'counterSlash')).toMatchObject([{ amount: dmg, enemyId: foe.id }]);
  });

  it('Afterimage: a block leaves one charge in its half; the next red to reach the hero is blocked for free', () => {
    const { c } = setupTwin({ skills: ['afterimage'], tune: (t) => (t.blocks.redTravelSec = 1000) });
    const foe = c.enemies[0];
    c.spawnBlock('red', 0.3, foe.id);
    tapOver(c, 0, 0.3);
    c.spawnBlock('red', 0.4, foe.id);
    tapOver(c, 0, 0.4); // a second block in the same half: still one charge
    expect(c.perk.afterimage0).toBe(1);
    expect(c.perk.afterimage1 ?? 0).toBe(0);
    c.drainEvents();
    const hp = c.hero.hp;
    const combo = c.combo;
    c.spawnBlock('red', 0, foe.id); // at the hero's end: it lands in 60 ms
    c.advanceTo(c.time + 0.15);
    let ev = c.drainEvents();
    expect(perks(ev, 'afterimage')).toHaveLength(1);
    expect(ofType(ev, 'heroHurt')).toHaveLength(0);
    expect(c.hero.hp).toBe(hp);
    expect(c.combo).toBe(combo);
    expect(c.perk.afterimage0).toBe(0);
    // spent: the next one hurts
    c.spawnBlock('red', 0, foe.id);
    c.advanceTo(c.time + 0.15);
    ev = c.drainEvents();
    expect(ofType(ev, 'heroHurt')).toHaveLength(1);
    expect(c.hero.hp).toBeLessThan(hp);
    // a block in each half: two charges, two free blocks
    const { c: c2 } = setupTwin({ skills: ['afterimage'], tune: (t) => (t.blocks.redTravelSec = 1000) });
    const f2 = c2.enemies[0];
    c2.spawnBlock('red', 0.3, f2.id);
    tapOver(c2, 0, 0.3);
    c2.spawnBlock('red', 0.9, f2.id);
    tapOver(c2, 1, 0.9);
    c2.drainEvents();
    for (let k = 0; k < 2; k++) {
      c2.spawnBlock('red', 0, f2.id);
      c2.advanceTo(c2.time + 0.15);
    }
    ev = c2.drainEvents();
    expect(perks(ev, 'afterimage')).toHaveLength(2);
    expect(ofType(ev, 'heroHurt')).toHaveLength(0);
  });

  it('Blur: from n x cursor speed up, every hit crits (shown as it kicks in)', () => {
    const { c, t } = setupTwin({ skills: ['blur'] });
    const n = skillN(t, 'blur');
    expect(n).toBe(1.6);
    const per = t.cursor.speedPerHit;
    c.combo = Math.round((n - 1) / per) - 2; // the hit makes it one short
    let [h] = hitSeq(c, [[0, 0.1]]);
    expect(c.speedMult()).toBeLessThan(n);
    expect(h.crit).toBe(false);
    [h] = hitSeq(c, [[0, 0.2]]);
    expect(c.speedMult()).toBeGreaterThanOrEqual(n - 1e-9);
    expect(h.crit).toBe(true);
    c.spawnBlock('yellow', 0.3);
    tapOver(c, 0, 0.3);
    const ev = c.drainEvents();
    expect(ofType(ev, 'hit')[0].crit).toBe(true);
    expect(perks(ev, 'blur')).toHaveLength(0); // shown once, when it kicked in
  });

  it('Double Down: a hit within n ms of a hit with the other cursor deals double', () => {
    const { c, t } = setupTwin({ skills: ['doubleDown'] });
    expect(skillN(t, 'doubleDown')).toBe(120);
    c.spawnBlock('yellow', 0.2);
    c.spawnBlock('yellow', 0.7); // B is there when A is at 0.2
    tapOver(c, 0, 0.2);
    const first = ofType(c.drainEvents(), 'hit')[0].damage;
    c.advanceTo(c.time + 0.05);
    expect(c.tap(c.time - 0.05, 1).outcome).toBe('hit'); // the same moment, 50 ms later on screen
    let ev = c.drainEvents();
    const double = Math.round(t.hero.atk * t.sable.atkMult * 2);
    expect(first).toBe(Math.round(t.hero.atk * t.sable.atkMult));
    expect(ofType(ev, 'hit')[0].damage).toBe(double);
    expect(perks(ev, 'doubleDown')).toMatchObject([{ amount: double }]);
    // the pair is spent: a third hit right after is a normal one
    c.spawnBlock('yellow', c.cursorPosAt(c.time, 0));
    c.tap(c.time, 0);
    ev = c.drainEvents();
    expect(ofType(ev, 'hit')[0].damage).toBe(first);
    // too far apart: nothing
    const { c: c2 } = setupTwin({ skills: ['doubleDown'] });
    const h = hitSeq(c2, [
      [0, 0.1],
      [1, 0.9],
    ]);
    expect(h[1].damage).toBe(h[0].damage);
  });

  it('Quickening: every n combo banks a finisher stack', () => {
    const { c, t } = setupTwin({ skills: ['quickening'] });
    const n = skillN(t, 'quickening');
    c.combo = n - 2;
    hitSeq(c, [[0, 0.1]]);
    expect(c.stacks).toBe(0);
    c.spawnBlock('yellow', 0.2);
    tapOver(c, 0, 0.2);
    expect(c.combo).toBe(n);
    expect(c.stacks).toBe(1);
    expect(perks(c.drainEvents(), 'quickening')).toMatchObject([{ amount: 1 }]);
    hitSeq(c, [[0, 0.3]]);
    expect(c.stacks).toBe(1);
  });
});
