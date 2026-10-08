import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTextViolations,
  compact,
  fillN,
  guardText,
  hpNow,
  hpOf,
  LONG_DECIMAL,
  mult,
  odds,
  one,
  onTextViolation,
  pct,
  pctOf,
  roundTo,
  secs,
  signed,
  signedPct,
  textViolations,
  whole,
} from '../../src/core/format';
import { fmtStat, fmtStatShort, fmtTotal } from '../../src/core/gear';
import { STAT_IDS } from '../../src/data/gear';

describe('the shared number formatter', () => {
  it('whole numbers: rounding edges, negatives, never -0', () => {
    expect(whole(12.5)).toBe('13');
    expect(whole(12.4999)).toBe('12');
    expect(whole(-12.5)).toBe('-13');
    expect(whole(-0.4)).toBe('0');
    expect(whole(-0)).toBe('0');
    expect(whole(61.0004)).toBe('61');
    expect(whole(137.35000000000002)).toBe('137');
    expect(whole(0)).toBe('0');
  });

  it('huge values stay short and never print an exponent', () => {
    expect(whole(999999)).toBe('999999');
    expect(whole(999999.6)).toBe('1M');
    expect(whole(1234567)).toBe('1.2M');
    expect(whole(-2500000)).toBe('-2.5M');
    expect(whole(3.4e9)).toBe('3.4B');
    expect(whole(1e21)).toBe('999T+');
    expect(one(1e21)).toBe('999T+');
    for (const v of [1e21, 1e300, Number.MAX_VALUE]) expect(whole(v)).not.toMatch(/e[+-]/);
  });

  it('NaN and Infinity never reach the screen', () => {
    for (const f of [whole, one, mult, secs, pct, pctOf, odds, hpNow, compact]) {
      expect(f(NaN)).not.toMatch(/NaN|Infinity/);
      expect(f(Infinity)).not.toMatch(/NaN|Infinity/);
      expect(f(-Infinity)).not.toMatch(/NaN|Infinity/);
    }
    expect(whole(NaN)).toBe('0');
    expect(hpOf(NaN, NaN)).toBe('0/0');
  });

  it('at most one decimal, a trailing .0 dropped, no float noise', () => {
    expect(one(1.25)).toBe('1.3');
    expect(one(1.15)).toBe('1.2'); // 1.15 * 10 is 11.499999999999998 in floats
    expect(one(2.04)).toBe('2');
    expect(one(2)).toBe('2');
    expect(one(0.05)).toBe('0.1');
    expect(one(0.04)).toBe('0');
    expect(one(-0.04)).toBe('0');
    expect(one(-1.25)).toBe('-1.3');
    expect(one(137.35)).toBe('137.4');
    expect(roundTo(1.005, 2)).toBe(1.01);
  });

  it('multipliers, seconds, percentages', () => {
    expect(mult(1.15 * 1.3)).toBe('x1.5');
    expect(mult(2)).toBe('x2');
    expect(mult(2.25)).toBe('x2.3');
    expect(secs(1.5)).toBe('1.5 s');
    expect(secs(4)).toBe('4 s');
    expect(pct(0.153)).toBe('15%');
    expect(pct(0.155)).toBe('16%');
    expect(pct(1 / 3)).toBe('33%');
    expect(pctOf(15.3)).toBe('15%');
    expect(pctOf(12.5)).toBe('13%');
  });

  it('odds keep a decimal where it matters, never 0% for a real chance', () => {
    expect(odds(0.25)).toBe('25%');
    expect(odds(0.025)).toBe('2.5%');
    expect(odds(0.0042)).toBe('0.4%');
    expect(odds(0.0001)).toBe('<0.1%');
    expect(odds(0.0005)).toBe('<0.1%'); // the shrine's Divine odds printed "0.05%"
    expect(odds(0.0025)).toBe('0.3%'); // ...and its Celestial "0.25%"
    expect(odds(0.001)).toBe('0.1%');
    expect(odds(0)).toBe('0%');
  });

  it('signed forms follow what is printed', () => {
    expect(signed(12)).toBe('+12');
    expect(signed(-3)).toBe('-3');
    expect(signed(0.2)).toBe('+0');
    expect(signed(-0.2)).toBe('+0');
    expect(signed(1.25, one)).toBe('+1.3');
    expect(signedPct(0.04)).toBe('+4%');
    expect(signedPct(-0.04)).toBe('-4%');
  });

  it('HP: whole, a sliver reads 1, never above the max', () => {
    expect(hpNow(61.0004)).toBe('62');
    expect(hpNow(61.0000001)).toBe('61');
    expect(hpNow(0.2)).toBe('1');
    expect(hpNow(0)).toBe('0');
    expect(hpNow(-3)).toBe('0');
    expect(hpOf(136.6, 137)).toBe('137/137');
    expect(hpOf(140, 137.35)).toBe('137/137');
    expect(hpOf(61.0000001, 137.35)).toBe('61/137');
  });

  it('compact plates', () => {
    expect(compact(9999)).toBe('9999');
    expect(compact(12345.6)).toBe('12.4k');
    expect(compact(123456)).toBe('124k');
    expect(compact(2.5e6)).toBe('2.5M');
  });

  it("fills a data text's number by what it counts", () => {
    expect(fillN('Green hits heal {n}% HP.', 3.456)).toBe('Green hits heal 3% HP.');
    expect(fillN('Every hit heals {n} HP.', 1.4)).toBe('Every hit heals 1 HP.');
    expect(fillN('Every crit drops {n} coin.', 1.6)).toBe('Every crit drops 2 coin.');
    expect(fillN('It lasts {n} s longer.', 1.55)).toBe('It lasts 1.6 s longer.');
    expect(fillN('hits back for {n}x attack.', 2.345)).toBe('hits back for 2.3x attack.');
    expect(fillN('smashes for x{n}.', 1.15 * 1.3)).toBe('smashes for x1.5.');
    expect(fillN('+{n} combo power.', 1.5)).toBe('+1.5 combo power.');
    expect(fillN('{n} and {n}%', 2.25)).toBe('2.3 and 2%');
  });

  it("gear stats print through it: no stat's text has a long decimal", () => {
    const awkward = [0, 0.004, 0.0456, 0.15, 0.333333, 1.15 * 1.3, 2.16, 16.1, 137.35000000000002, -8.456, 1e7];
    for (const id of STAT_IDS)
      for (const v of awkward)
        for (const s of [fmtStat(id, v), fmtStat(id, v, false), fmtStatShort(id, v), fmtTotal(id, v)]) {
          LONG_DECIMAL.lastIndex = 0;
          expect(LONG_DECIMAL.test(s), `${id} ${v}: ${s}`).toBe(false);
          expect(s, `${id} ${v}`).not.toMatch(/NaN|Infinity|e[+-]\d/);
        }
  });
});

describe('the safety net (guardText)', () => {
  beforeEach(() => clearTextViolations());

  it('rounds long decimals to one and records the raw string', () => {
    expect(guardText('HP 61.0004/137.35')).toBe('HP 61/137.4');
    expect(guardText('+12.3456')).toBe('+12.3');
    expect(guardText('x0.15 crit')).toBe('x0.2 crit');
    expect(guardText('-8.456 DEF')).toBe('-8.5 DEF');
    expect(textViolations).toEqual(['HP 61.0004/137.35', '+12.3456', 'x0.15 crit', '-8.456 DEF']);
  });

  it('leaves alone what is fine: one decimal, versions, times, dates, sentences', () => {
    for (const s of ['x1.5', '1.5 s', '61/137', 'Version a6bab32 Oct 6 03:01 UTC', 'v1.2.10', '1.10.0', '08.10.2026', '1:05', '2026-10-08', 'Done. Next: 12.', 'Act 3. 25%', '...', ''])
      expect(guardText(s), s).toBe(s);
    expect(textViolations).toEqual([]);
  });

  it('records broken numbers (NaN, Infinity, exponents) without rewriting them', () => {
    expect(guardText('HP NaN/100')).toBe('HP NaN/100');
    expect(guardText('x Infinity')).toBe('x Infinity');
    expect(guardText('1e+21 coins')).toBe('1e+21 coins');
    expect(textViolations).toHaveLength(3);
    expect(guardText('Nantes')).toBe('Nantes'); // a word is not a number
    expect(guardText('one-off, free-for-all')).toBe('one-off, free-for-all');
    expect(textViolations).toHaveLength(3);
  });

  it('records each raw string once and tells its listeners', () => {
    const heard: string[] = [];
    onTextViolation((s) => heard.push(s));
    guardText('12.345');
    guardText('12.345');
    guardText('0.25%');
    expect(textViolations).toEqual(['12.345', '0.25%']);
    expect(heard).toEqual(['12.345', '0.25%']);
  });
});
