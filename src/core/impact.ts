// Impact weight model (pure; no DOM). Every impact has a weight from 0 (lightest) to 1 (heaviest), set per
// tier in tuning.impact. The weight drives both the visuals (hit-stop, shake, knockback, flashes, music duck)
// and the layered sound (crack, body, tail, sub), so sound and picture always agree on how heavy a hit is.

import type { Tuning } from './tuning';

/** Lightest to heaviest. A finisher's weight also grows with the stacks spent. 'slam': a Guardian's Shield Slam (a
 *  block that hits back, a little heavier than a block); 'bulwark': full Guard unleashed on every foe (heavier than a
 *  5-stack finisher, under a kill). */
export type ImpactTier = 'hit' | 'perfect' | 'block' | 'slam' | 'crit' | 'bomb' | 'finisher' | 'bulwark' | 'kill' | 'bossKill';
export const IMPACT_TIERS: ImpactTier[] = ['hit', 'perfect', 'block', 'slam', 'crit', 'bomb', 'finisher', 'bulwark', 'kill', 'bossKill'];

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/** The finisher show's length (ms) grows with the stacks spent; its flurry and last blow are timed inside it. */
export const finisherShowMs = (stacks: number) => 560 + 170 * Math.min(5, Math.max(1, stacks));
/** The flurry: 1 + 2n strikes between 30% and 70% of the show; the last blow lands at 80%. */
export const finisherStrikes = (stacks: number) => 1 + 2 * Math.min(5, Math.max(1, stacks));
export const finisherStrikeAt = (i: number, strikes: number) => 0.3 + (0.4 * i) / Math.max(1, strikes - 1);
export const FINISHER_BLOW_AT = 0.8;

/** Taking a hit is not a tier (it has its own visuals) but its sound uses the same layers at this weight. */
export const hurtWeight = (t: Tuning) => clamp01(t.impact.hurt);

export function impactWeight(t: Tuning, tier: ImpactTier, stacks = 1): number {
  const I = t.impact;
  if (tier === 'finisher') return clamp01(I.finisher + I.finisherStack * (Math.max(1, Math.min(5, stacks)) - 1));
  return clamp01(I[tier]);
}

export interface ImpactFeel {
  hitStopMs: number; // scene freeze
  shakePx: number;
  shakeMs: number;
  knockPx: number; // enemy knockback
  flashMs: number; // enemy white flash
  frames: number; // full-scene white impact frames (0, 1 or 2)
  duck: number; // how far the music dips (0 = not at all, 1 = silent)
  duckMs: number;
}

/** Visual side of an impact of weight w. Ramps follow w ^ curve, so light hits stay subtle. */
export function impactFeel(t: Tuning, w: number): ImpactFeel {
  const I = t.impact;
  w = clamp01(w);
  const k = Math.pow(w, Math.max(0.1, I.curve));
  const lerp = (a: number, b: number) => a + (b - a) * k;
  const duckK = w >= I.duckFrom ? (I.duckFrom >= 1 ? 1 : (w - I.duckFrom) / (1 - I.duckFrom)) : -1;
  return {
    hitStopMs: lerp(I.hitStopLight, I.hitStopHeavy),
    shakePx: lerp(I.shakeLight, I.shakeHeavy),
    shakeMs: lerp(I.shakeMsLight, I.shakeMsHeavy),
    knockPx: lerp(I.knockLight, I.knockHeavy),
    flashMs: lerp(I.flashLight, I.flashHeavy),
    frames: w >= I.frameFlash2 ? 2 : w >= I.frameFlash1 ? 1 : 0,
    duck: duckK < 0 ? 0 : clamp01(I.duckDepth * (0.55 + 0.45 * duckK)),
    duckMs: I.duckMs * (0.6 + 0.6 * w),
  };
}

/** Timbre family: what is being hit. */
export type ImpactColor = 'flesh' | 'metal' | 'blast' | 'hurt';

export interface ImpactVoice {
  crack: { gain: number; hz: number; ms: number };
  body: { gain: number; hz0: number; hz1: number; ms: number; drive: number };
  thud: { gain: number; hz: number; ms: number };
  tail: { gain: number; hz0: number; hz1: number; ms: number; grit: number; rev: number };
  sub: { gain: number; hz: number; ms: number };
  debris: number; // little grit ticks scattered over the tail
  jitterMs: number; // start offset of the tail and debris
}

/**
 * Sound side of an impact of weight w: a 0-5 ms crack, a saturated 120-600 Hz body (its harmonics carry the
 * weight on small phone speakers), a noise/debris tail, and a sub sine that only adds on headphones.
 * `rand` (0..1) adds the +/- variation so repeats never sound identical.
 */
export function impactVoice(t: Tuning, w: number, color: ImpactColor = 'flesh', rand: () => number = Math.random): ImpactVoice {
  const I = t.impact;
  w = clamp01(w);
  const vary = () => 1 + I.variation * (2 * rand() - 1);
  const pitch = vary();
  const time = vary();
  const lerp = (a: number, b: number) => a + (b - a) * w;
  const bodyHz = lerp(I.bodyHzLight, I.bodyHzHeavy) * pitch;
  const v: ImpactVoice = {
    crack: { gain: I.crack * lerp(0.35, 0.7), hz: lerp(5200, 2800) * pitch, ms: Math.min(5, lerp(2.5, 4.8) * time) },
    body: { gain: I.body * lerp(0.22, 0.46), hz0: bodyHz * lerp(2.2, 2.8), hz1: bodyHz, ms: lerp(I.bodyMsLight, I.bodyMsHeavy) * time, drive: I.drive * lerp(2, 10) },
    thud: { gain: I.body * lerp(0.15, 0.42), hz: lerp(950, 520) * pitch, ms: lerp(25, 150) * time },
    tail: {
      gain: I.tail * lerp(0.12, 0.36),
      hz0: lerp(3200, 2400) * pitch,
      hz1: lerp(700, 330) * pitch, // the deep rumble is the sub's job: the tail stays where phone speakers play
      ms: lerp(I.tailMsLight, I.tailMsHeavy) * vary(),
      grit: clamp01((w - 0.3) / 0.7),
      rev: 0.4 * clamp01((w - 0.45) / 0.55),
    },
    sub: { gain: I.sub * lerp(0.2, 0.55), hz: lerp(72, 44) * pitch, ms: lerp(90, 510) * time },
    debris: Math.round(Math.max(0, w - 0.35) * 16),
    jitterMs: 100 * I.variation * rand(),
  };
  if (color === 'metal') {
    // a parry: brighter, ringing, less drop and less tail
    v.body.hz1 *= 1.6;
    v.body.hz0 = v.body.hz1 * 1.25;
    v.body.drive *= 0.6;
    v.tail.ms *= 0.9;
    v.tail.hz0 *= 1.3;
    v.tail.hz1 *= 2;
    v.sub.gain *= 0.8;
  } else if (color === 'blast') {
    // an explosion: noisier, longer, grittier tail
    v.thud.gain *= 1.2;
    v.thud.ms *= 1.5;
    v.tail.gain *= 1.25;
    v.tail.ms *= 1.2;
    v.tail.grit = Math.max(v.tail.grit, 0.6);
    v.sub.ms *= 1.2;
  } else if (color === 'hurt') {
    // taking a hit: darker and crunchier
    v.body.hz0 *= 0.8;
    v.body.hz1 *= 0.8;
    v.crack.hz *= 0.6;
    v.tail.hz0 *= 0.7;
    v.tail.grit = Math.max(v.tail.grit, 0.5);
  }
  return v;
}
