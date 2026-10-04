import { describe, expect, it } from 'vitest';
import { setup, timeAt } from './helpers';

// Make red blocks effectively static so tests can aim at them by position.
const slowReds = (t: { blocks: { redTravelSec: number } }) => (t.blocks.redTravelSec = 10000);

describe('block types', () => {
  it('yellow: attack for hero atk, +1 combo, fills meter', () => {
    const { c, t } = setup();
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.53)); // not perfect
    expect(c.enemies[0].hp).toBe(80 - t.hero.atk);
    expect(c.combo).toBe(1);
    expect(c.meter).toBeCloseTo(t.meter.perHit);
    expect(c.blocks).toHaveLength(0);
  });

  it('perfect adds extra meter and crit chance', () => {
    const { c, t } = setup({ tune: (t) => (t.hero.perfectCritBonus = 1) });
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1);
    const r = c.tap(timeAt(t, 0.5));
    expect(r.perfect).toBe(true);
    expect(c.meter).toBeCloseTo(t.meter.perHit + t.meter.perfectBonus);
    expect(c.enemies[0].hp).toBe(80 - t.hero.atk * t.hero.critDmg);
  });

  it('green: 1.5x attack and triggers the +crit ability for 3 s', () => {
    const { c, t } = setup({ tune: (t) => (t.hero.abilityCritBonus = 1) });
    c.spawnBlock('green', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.53));
    expect(c.enemies[0].hp).toBe(80 - 15);
    expect(c.meter).toBeCloseTo(t.meter.perGreen);
    expect(c.hero.abilityTimer).toBeCloseTo(t.hero.abilitySec);
  });

  it('ability crit applies while active and stops after it expires', () => {
    const { c, t } = setup({ tune: (t) => (t.hero.abilityCritBonus = 1) });
    c.hero.abilityTimer = t.hero.abilitySec;
    c.spawnBlock('yellow', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.53));
    expect(c.enemies[0].hp).toBe(80 - 20);
    const { c: c2, t: t2 } = setup({ tune: (t) => (t.hero.abilityCritBonus = 1) });
    c2.hero.abilityTimer = 0.2;
    c2.spawnBlock('yellow', 0.5);
    c2.advanceTo(1);
    c2.tap(timeAt(t2, 0.53));
    expect(c2.enemies[0].hp).toBe(80 - 10);
  });

  it('red: slides left over redTravelSec and hits the hero at the left end', () => {
    const { c, t } = setup();
    const red = c.spawnBlock('red', 1);
    const travel = t.blocks.redTravelSec;
    c.advanceTo(travel - 0.05);
    expect(c.blocks).toContain(red);
    expect(c.hero.hp).toBe(100);
    c.advanceTo(travel + t.blocks.impactGraceMs / 1000 + 0.02);
    expect(c.blocks).not.toContain(red);
    expect(c.hero.hp).toBe(100 - t.enemies.slime.atk);
  });

  it('red: tapping it blocks (+1 combo, meter) and it can still be blocked during the impact grace', () => {
    const { c } = setup();
    c.spawnBlock('red', 0.05); // reaches the end almost immediately
    c.advanceTo(0.05);
    expect(c.tap(0.05).outcome).toBe('block');
    expect(c.combo).toBe(1);
    c.advanceTo(1);
    expect(c.hero.hp).toBe(100);
  });

  it('shield: needs 2 taps, and the first one knocks it back', () => {
    const { c, t } = setup({ tune: slowReds });
    const b = c.spawnBlock('shield', 0.5);
    c.advanceTo(1);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('crack');
    expect(c.blocks).toContain(b);
    expect(c.combo).toBe(1);
    // it slides right over knockbackSec instead of carrying on at the same pace
    c.advanceTo(1 + t.blocks.knockbackSec / 2);
    expect(b.pos).toBeGreaterThan(0.55);
    c.advanceTo(1 + t.blocks.knockbackSec + 0.02);
    expect(b.pos).toBeCloseTo(0.5 + t.blocks.shieldKnockback, 2);
    expect(b.vel).toBeLessThan(0);
    // the cursor is back over it on the way back (second pass)
    const p = b.pos;
    const t2 = (2 - p) * t.cursor.basePassSec;
    c.advanceTo(t2 - 0.01);
    expect(c.tap(t2).outcome).toBe('block');
    expect(c.blocks).not.toContain(b);
    expect(c.combo).toBe(2);
  });

  it('shield knockback stops short of the red block behind it and resets the impact timer', () => {
    const { c, t } = setup({ tune: slowReds });
    const s = c.spawnBlock('shield', 0.04);
    const r = c.spawnBlock('red', 0.2);
    s.impactTimer = 0.03; // sitting at the left end, about to land
    c.advanceTo(0.02);
    expect(c.tap(timeAt(t, 0.04)).outcome).toBe('crack');
    expect(s.impactTimer).toBe(-1);
    c.advanceTo(0.5);
    expect(s.pos).toBeLessThanOrEqual(r.pos - (r.width + s.width) / 2 - t.blocks.minGap + 1e-3);
    expect(s.pos).toBeGreaterThan(0.08);
    expect(c.hero.hp).toBe(100);
  });

  it('bomb: destroys every block in radius (yours too) and damages every enemy', () => {
    const { c, t } = setup({ enemies: ['slime', 'bandit'], tune: slowReds });
    const y1 = c.spawnBlock('yellow', 0.32);
    const y2 = c.spawnBlock('yellow', 0.65);
    const r2 = c.spawnBlock('red', 0.6);
    const far = c.spawnBlock('purple', 0.85);
    c.spawnBlock('bomb', 0.5);
    c.advanceTo(1);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('block');
    expect(c.blocks).not.toContain(y1);
    expect(c.blocks).not.toContain(y2);
    expect(c.blocks).not.toContain(r2);
    expect(c.blocks).toEqual([far]);
    expect(c.enemies[0].hp).toBe(80 - t.blocks.bombDamage);
    expect(c.enemies[1].hp).toBe(140 - t.blocks.bombDamage);
  });

  it('bomb that reaches you hits harder', () => {
    const { c, t } = setup();
    c.spawnBlock('bomb', 0.05);
    c.advanceTo(0.5);
    expect(c.hero.hp).toBe(100 - Math.round(t.enemies.slime.atk * t.blocks.bombHitMult));
  });

  it('speed: blocking it speeds the cursor up 15% until you take damage', () => {
    const { c, t } = setup({ tune: slowReds });
    c.spawnBlock('speed', 0.5);
    c.advanceTo(1);
    c.tap(timeAt(t, 0.5));
    expect(c.speedStacks).toBe(1);
    expect(c.speedMult()).toBeCloseTo(1.02 * 1.15);
    c.tap(c.time); // empty bar in Classic = self-damage
    expect(c.speedStacks).toBe(0);
    expect(c.speedMult()).toBe(1);
  });

  it('purple: tapping it triggers the enemy special', () => {
    const { c, t } = setup();
    c.spawnBlock('purple', 0.5);
    c.combo = 7;
    c.advanceTo(1);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('trap');
    expect(c.hero.hp).toBe(100 - t.enemies.slime.special);
    expect(c.combo).toBe(0);
  });

  it('purple: expires after trapLifeSec', () => {
    const { c, t } = setup();
    const p = c.spawnBlock('purple', 0.5);
    c.advanceTo(t.blocks.trapLifeSec - 0.05);
    expect(c.blocks).toContain(p);
    c.advanceTo(t.blocks.trapLifeSec + 0.05);
    expect(c.blocks).not.toContain(p);
    expect(c.hero.hp).toBe(100);
  });

  it('purple is ignored when another block is also under the cursor', () => {
    const { c, t } = setup({ tune: slowReds });
    const p = c.spawnBlock('purple', 0.5);
    c.spawnBlock('red', 0.53);
    c.advanceTo(1);
    expect(c.tap(timeAt(t, 0.5)).outcome).toBe('block');
    expect(c.blocks).toContain(p);
    expect(c.hero.hp).toBe(100);
  });

  it('empty tap: Classic = small self-damage + combo break, Relaxed = combo break only', () => {
    const classic = setup();
    classic.c.combo = 5;
    classic.c.advanceTo(0.5);
    expect(classic.c.tap(0.5).outcome).toBe('miss');
    expect(classic.c.combo).toBe(0);
    expect(classic.c.hero.hp).toBe(100 - classic.t.judge.missSelfDamage);

    const relaxed = setup({ settings: { mode: 'relaxed' } });
    relaxed.c.combo = 5;
    relaxed.c.speedStacks = 1;
    relaxed.c.advanceTo(0.5);
    expect(relaxed.c.tap(0.5).outcome).toBe('miss');
    expect(relaxed.c.combo).toBe(0);
    expect(relaxed.c.speedStacks).toBe(1);
    expect(relaxed.c.hero.hp).toBe(100);
  });

  it('refills the bar when fewer than minAttack attack blocks are left', () => {
    const { c, t } = setup({ spawning: true, tune: (t) => (t.enemies.slime.interval = 100) });
    expect(c.blocks.filter((b) => b.kind === 'yellow').length).toBe(0);
    c.advanceTo(0.5);
    expect(c.blocks.filter((b) => b.kind === 'yellow' || b.kind === 'green').length).toBe(t.blocks.minAttack);
  });

  it('spawned blocks come in varied widths, for every kind', () => {
    const { c, t } = setup({
      spawning: true,
      enemies: ['bigSlime'],
      settings: { godMode: true },
      tune: (t) => {
        t.blocks.attackLifeSec = 0.5; // short-lived blocks keep the bar churning
        t.blocks.trapLifeSec = 0.5;
        t.blocks.widthMin = 0.6;
        t.blocks.widthMax = 1.5;
        t.blocks.redWidthMin = 0.9;
        t.blocks.redWidthMax = 1.25;
        t.enemies.bigSlime.hp = 1e6;
        t.enemies.bigSlime.interval = 0.2;
        t.blocks.maxStatic = 8;
        t.blocks.maxRed = 6;
      },
    });
    const widths = new Map<string, number[]>();
    for (let i = 1; i <= 2400; i++) {
      c.advanceTo(i / 120);
      for (const b of c.blocks) {
        const list = widths.get(b.kind) ?? [];
        if (!list.includes(b.width)) list.push(b.width);
        widths.set(b.kind, list);
      }
    }
    for (const kind of ['yellow', 'green', 'red', 'purple'] as const) {
      const list = widths.get(kind) ?? [];
      const base = c.widthFor(kind);
      const red = kind === 'red';
      const [lo, hi] = red ? [t.blocks.redWidthMin, t.blocks.redWidthMax] : [t.blocks.widthMin, t.blocks.widthMax];
      expect(list.length, kind).toBeGreaterThan(2);
      for (const w of list) {
        expect(w, kind).toBeGreaterThanOrEqual(base * lo - 1e-9);
        expect(w, kind).toBeLessThanOrEqual(base * hi + 1e-9);
      }
      const spread = Math.max(...list) / Math.min(...list);
      expect(spread, `${kind} widths should vary`).toBeGreaterThan(red ? 1.15 : 1.4);
    }
    // red attacks never get thin: always at least 90% of their (wider) base
    expect(Math.min(...(widths.get('red') ?? [1]))).toBeGreaterThanOrEqual(c.widthFor('red') * 0.9 - 1e-9);
  });

  it('pattern spawns are deterministic for a seed', () => {
    const run = () => {
      const { c } = setup({ spawning: true, enemies: ['bigSlime'] });
      const seen: string[] = [];
      for (let i = 1; i <= 600; i++) {
        c.advanceTo(i / 120);
        for (const e of c.drainEvents()) if (e.type === 'spawn') seen.push(`${e.kind}@${c.tick}`);
      }
      return seen.join(',');
    };
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(run()).toBe(a);
  });
});
