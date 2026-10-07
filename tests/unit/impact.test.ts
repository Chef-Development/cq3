import { describe, expect, it } from 'vitest';
import { finisherShowMs, finisherStrikeAt, finisherStrikes, IMPACT_TIERS, impactFeel, impactVoice, impactWeight, type ImpactTier } from '../../src/core/impact';
import { cloneTuning } from '../../src/core/tuning';

const t = cloneTuning();
/** Every impact, lightest first: hit < perfect < block < slam < crit < bomb < finisher x1..x5 < bulwark < kill < boss kill. */
const ladder: Array<[string, number]> = [
  ...(['hit', 'perfect', 'block', 'slam', 'crit', 'bomb'] as ImpactTier[]).map((k): [string, number] => [k, impactWeight(t, k)]),
  ...[1, 2, 3, 4, 5].map((n): [string, number] => [`finisher x${n}`, impactWeight(t, 'finisher', n)]),
  ['bulwark', impactWeight(t, 'bulwark')],
  ['kill', impactWeight(t, 'kill')],
  ['bossKill', impactWeight(t, 'bossKill')],
];

describe('impact tiers', () => {
  it('every tier is heavier than the last, and the finisher grows with stacks', () => {
    for (let i = 1; i < ladder.length; i++) expect(ladder[i][1], `${ladder[i][0]} > ${ladder[i - 1][0]}`).toBeGreaterThan(ladder[i - 1][1]);
    expect(IMPACT_TIERS).toHaveLength(10);
    expect(impactWeight(t, 'finisher', 9)).toBe(impactWeight(t, 'finisher', 5)); // capped at 5 stacks
  });

  it('hit-stop: about 30 ms on a normal hit, over 100 ms on a 5-stack finisher', () => {
    expect(impactFeel(t, impactWeight(t, 'hit')).hitStopMs).toBeGreaterThanOrEqual(25);
    expect(impactFeel(t, impactWeight(t, 'hit')).hitStopMs).toBeLessThanOrEqual(40);
    expect(impactFeel(t, impactWeight(t, 'finisher', 5)).hitStopMs).toBeGreaterThan(100);
  });

  it('hit-stop, shake, knockback, flash and music duck all scale with weight', () => {
    const feels = ladder.map(([, w]) => impactFeel(t, w));
    for (let i = 1; i < feels.length; i++) {
      const a = feels[i - 1];
      const b = feels[i];
      expect(b.hitStopMs).toBeGreaterThan(a.hitStopMs);
      expect(b.shakePx).toBeGreaterThan(a.shakePx);
      expect(b.shakeMs).toBeGreaterThan(a.shakeMs);
      expect(b.knockPx).toBeGreaterThan(a.knockPx);
      expect(b.flashMs).toBeGreaterThan(a.flashMs);
      expect(b.duck).toBeGreaterThanOrEqual(a.duck);
      expect(b.frames).toBeGreaterThanOrEqual(a.frames);
    }
  });

  it('impact frames and the music duck only on heavy hits', () => {
    const f = (tier: ImpactTier, n = 1) => impactFeel(t, impactWeight(t, tier, n));
    expect(f('hit').frames).toBe(0);
    expect(f('block').frames).toBe(0);
    expect(f('slam').frames).toBe(0);
    expect(f('bulwark').frames).toBe(2); // a Bulwark lands like a full finisher
    expect(f('crit').frames).toBe(1);
    expect(f('finisher', 5).frames).toBe(2);
    expect(f('bossKill').frames).toBe(2);
    expect(f('hit').duck).toBe(0);
    expect(f('crit').duck).toBeGreaterThan(0);
    expect(f('bossKill').duck).toBeLessThanOrEqual(1);
  });

  it('tuning edits apply live', () => {
    const t2 = cloneTuning();
    t2.impact.hitStopHeavy = 300;
    t2.impact.crit = 0.9;
    expect(impactFeel(t2, impactWeight(t2, 'crit')).hitStopMs).toBeGreaterThan(impactFeel(t, impactWeight(t, 'crit')).hitStopMs);
  });
});

describe('impact voice', () => {
  it('layers sit where they should: 0-5 ms crack, 120-600 Hz body, deep sub', () => {
    for (const [name, w] of ladder)
      for (const r of [0, 0.5, 0.999]) {
        const v = impactVoice(t, w, 'flesh', () => r);
        expect(v.crack.ms, name).toBeLessThanOrEqual(5);
        expect(v.crack.ms, name).toBeGreaterThan(0);
        expect(v.body.hz1, name).toBeGreaterThanOrEqual(120);
        expect(v.body.hz0, name).toBeLessThanOrEqual(1000);
        expect(Math.min(v.body.hz0, v.body.hz1), name).toBeLessThanOrEqual(600);
        expect(v.sub.hz, name).toBeLessThan(80);
      }
  });

  it('heavier impacts are longer, lower and more driven', () => {
    const light = impactVoice(t, 0.1, 'flesh', () => 0.5);
    const heavy = impactVoice(t, 1, 'flesh', () => 0.5);
    expect(heavy.body.ms).toBeGreaterThan(light.body.ms);
    expect(heavy.tail.ms).toBeGreaterThan(light.tail.ms);
    expect(heavy.body.hz1).toBeLessThan(light.body.hz1);
    expect(heavy.body.drive).toBeGreaterThan(light.body.drive);
    expect(heavy.debris).toBeGreaterThan(light.debris);
    expect(heavy.sub.gain).toBeGreaterThan(light.sub.gain);
  });

  it('adds +/- 3-5% random pitch and timing so repeats differ', () => {
    const lo = impactVoice(t, 0.4, 'flesh', () => 0);
    const mid = impactVoice(t, 0.4, 'flesh', () => 0.5);
    const hi = impactVoice(t, 0.4, 'flesh', () => 0.999999);
    const spread = (a: number, b: number) => b / a - 1;
    expect(spread(mid.body.hz1, hi.body.hz1)).toBeGreaterThanOrEqual(0.03);
    expect(spread(mid.body.hz1, hi.body.hz1)).toBeLessThanOrEqual(0.05);
    expect(spread(lo.body.hz1, mid.body.hz1)).toBeGreaterThanOrEqual(0.03);
    expect(spread(mid.body.ms, hi.body.ms)).toBeGreaterThanOrEqual(0.03);
    const flat = cloneTuning();
    flat.impact.variation = 0;
    expect(impactVoice(flat, 0.4, 'flesh', () => 0).body.hz1).toBe(impactVoice(flat, 0.4, 'flesh', () => 1).body.hz1);
  });

  it('layer levels scale each layer', () => {
    const t2 = cloneTuning();
    t2.impact.body = 0;
    t2.impact.sub = 2;
    const v = impactVoice(t2, 0.5, 'flesh', () => 0.5);
    expect(v.body.gain).toBe(0);
    expect(v.thud.gain).toBe(0);
    expect(v.sub.gain).toBeGreaterThan(impactVoice(t, 0.5, 'flesh', () => 0.5).sub.gain);
  });
});

describe('finisher timing', () => {
  it('the show grows with stacks; strikes fill 30-70%, the last blow lands after them', () => {
    expect(finisherShowMs(5)).toBeGreaterThan(finisherShowMs(1));
    expect(finisherStrikes(1)).toBe(3);
    expect(finisherStrikes(5)).toBe(11);
    const n = finisherStrikes(3);
    expect(finisherStrikeAt(0, n)).toBeCloseTo(0.3);
    expect(finisherStrikeAt(n - 1, n)).toBeCloseTo(0.7);
  });
});
