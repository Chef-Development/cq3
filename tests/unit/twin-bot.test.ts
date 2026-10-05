import { describe, expect, it } from 'vitest';
import { estimateAccuracy } from '../../src/core/accuracy';
import { balance, botRun, fight, playAct, playRun } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { newProfile } from '../../src/core/profile';
import { cloneTuning } from '../../src/core/tuning';

describe('the bot plays Sable with two thumbs', () => {
  it('BotOptions.hero picks Sable; she fights with both cursors, is deterministic for a seed', () => {
    const t = cloneTuning();
    const a = playRun(t, { accuracy: 0.85, seed: 3, hero: 'sable' }, 2, 1);
    expect(a).toEqual(playRun(t, { accuracy: 0.85, seed: 3, hero: 'sable' }, 2, 1));
    expect(a.acts[0].attempts[0].fights.length).toBeGreaterThan(0);
  });

  it('taps with both hands, each at its own cursor', () => {
    const t = cloneTuning();
    const p = newProfile();
    p.heroes.sable.unlocked = true;
    p.hero = 'sable';
    const run = botRun(t, 5, p);
    run.chooseNode(run.choices()[0]);
    const c = run.combat!;
    expect(c.hands).toBe(2);
    const taps: Array<{ hand: number; pos: number }> = [];
    const tap = c.tap.bind(c);
    c.tap = (at: number, hand = 0) => {
      const r = tap(at, hand);
      taps.push({ hand: r.hand, pos: r.cursorPos });
      return r;
    };
    fight(run, c, new Rng(5), { accuracy: 0.85, seed: 5 });
    const left = taps.filter((x) => x.hand === 0);
    const right = taps.filter((x) => x.hand === 1);
    expect(left.length).toBeGreaterThan(5);
    expect(right.length).toBeGreaterThan(5);
    expect(left.every((x) => x.pos <= 0.5 + 1e-9)).toBe(true);
    expect(right.every((x) => x.pos >= 0.5 - 1e-9)).toBe(true);
  });
});

describe('the accuracy readout reads Sable right', () => {
  it('a 70% Sable bot reads back as 70% (+/- 4): each tap measured against its own cursor', () => {
    const t = cloneTuning();
    const xs: number[] = [];
    for (let r = 0; r < 12; r++) {
      const p = newProfile();
      p.heroes.sable.unlocked = true;
      p.hero = 'sable';
      const run = botRun(t, 100 + r, p);
      const rng = new Rng(7 + r);
      for (let a = 0; a < 2; a++) {
        playAct(run, rng, { accuracy: 0.7, seed: 100 + r });
        xs.push(...run.actAims);
        if (run.phase !== 'actClear') break;
        run.nextAct();
        run.skipScenes();
      }
    }
    const e = estimateAccuracy(t, xs)!;
    expect(e.n).toBeGreaterThan(600);
    expect(Math.abs(e.acc - 0.7), `read ${e.acc.toFixed(3)}`).toBeLessThan(0.04);
    expect(Math.abs(e.bias)).toBeLessThan(8);
  });
});

describe('Sable is as strong as Rowan (guards tuning.sable; the full comparison is tests/balance/twin.run.ts)', () => {
  // The same 100 seeds for both (paired runs), a typical 70% player, Acts 1-2: within 10 points per act.
  const t = cloneTuning();
  const rowan = balance(t, [0.7], 100, 21, 6, 2);
  const sable = balance(t, [0.7], 100, 21, 6, 2, 'sable');

  it('first-try clears within +/-10 points of Rowan’s', () => {
    for (const [i, r] of rowan.entries()) expect(Math.abs(sable[i].firstTry - r.firstTry), `act ${r.act + 1}: Rowan ${r.firstTry}, Sable ${sable[i].firstTry}`).toBeLessThanOrEqual(0.1);
  });

  it('the act boss’s first fight won within +/-10 points of Rowan’s', () => {
    for (const [i, r] of rowan.entries()) expect(Math.abs(sable[i].bossFirstTry - r.bossFirstTry), `act ${r.act + 1}: Rowan ${r.bossFirstTry}, Sable ${sable[i].bossFirstTry}`).toBeLessThanOrEqual(0.1);
  });
});
