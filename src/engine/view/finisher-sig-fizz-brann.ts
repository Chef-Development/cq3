// Part 6's signature moments in the finisher show (core/finisher-show.ts HERO_SIGNATURE; the framework is
// view/finishers.ts, the shared style kits view/finisher-kits.ts):
//   Fizz   grandReaction  three flasks lobbed high over the foes, one of each brew, hang there spinning; each strike
//                         pours one down (fire flames, frost shards, spark lightning); at the last blow they smash
//                         together into a great bubble of mixed brew that swells over the foes and bursts in all three
//                         colours
//   Brann  greatBell      a giant bronze temple bell fades in high over the target, swings and rings with each
//                         strike (sound rings off its mouth), then drops over the target on the last blow: a boom, a
//                         ring of dust, sound waves rolling across the stage; it lifts away and fades
import type { Brew } from '../../core/kit-fizz-brann';
import { clamp01, ease, INK, rand, WHITE, type EnemyView } from './shared';
import { centerOf, chest, ellipseLine, hash, hitFoe, line, mark, spanOf, topOf, twinkle, type MarkDraw, type ShowCtx } from './finisher-fx';
import type { SignatureDraw } from './finisher-signatures';
import { BREW_COL, BRONZE_COL, paintBell, paintFlask } from './fizz-brann-paint';

const between = (k: number, a: number, b: number): number => clamp01((k - a) / Math.max(1e-6, b - a));
const nearest = (c: ShowCtx): EnemyView | undefined => c.views.slice().sort((a, b) => a.homeX - b.homeX)[0];
const BREWS: Brew[] = ['fire', 'frost', 'spark'];

// ================================================================== Fizz: the grand reaction

/** Where each of the three flasks hangs over the foes (a shallow arc), and the point they smash together at. */
function hangAt(c: ShowCtx, i: number): { x: number; y: number } {
  const [lo, hi] = spanOf(c);
  const mid = (lo + hi) / 2;
  const spread = Math.max(22, (hi - lo) / 2 + 10);
  const top = c.views.length ? Math.min(...c.views.map((v) => topOf(v))) : c.s.ground - 40;
  return { x: mid + (i - 1) * spread, y: Math.max(52, top - 12) + (i === 1 ? -5 : 0) };
}
const meetAt = (c: ShowCtx): { x: number; y: number } => ({ x: centerOf(c), y: c.s.ground - 40 });

const GRAND_REACTION: SignatureDraw = {
  motion(c, k, def) {
    // three quick throws in the build-up, then the follow-through
    return { ...def, pose: k < c.tl.build * 0.7 ? (Math.floor(k * 30) % 2 ? 'cast' : 'slashA') : def.pose };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const h = c.heroAt();
    const from = { x: h.x + 10, y: c.s.ground - 26 - h.lift };
    const meet = meetAt(c);
    BREWS.forEach((brew, i) => {
      const t0 = 0.02 + i * tl.build * 0.22;
      const t1 = t0 + tl.build * 0.42;
      if (k < t0 || k >= tl.blow) return;
      const to = hangAt(c, i);
      let x: number;
      let y: number;
      let spin = 0;
      if (k < t1) {
        // lobbed up, spinning
        const q = between(k, t0, t1);
        x = from.x + (to.x - from.x) * q;
        y = from.y + (to.y - from.y) * q - Math.sin(q * Math.PI) * 28;
        spin = q * Math.PI * 4;
      } else if (k < tl.blow - 0.05) {
        // hanging, bobbing, glowing; each pours on its strikes
        x = to.x;
        y = to.y + Math.sin(now / 160 + i * 2) * 1.5;
        spin = Math.sin(now / 200 + i) * 0.4;
        const pour = c.tl.strikes.some((s, j) => j % 3 === i && k >= s - 0.01 && k < s + 0.05);
        if (pour) spin = Math.PI;
      } else {
        // smashing together
        const q = ease(between(k, tl.blow - 0.05, tl.blow));
        x = to.x + (meet.x - to.x) * q;
        y = to.y + (meet.y - to.y) * q;
        spin = q * Math.PI * 2;
      }
      paintFlask(g, x, y, 6 + Math.min(2, c.scale.layers - 2), brew, now, { spin, glow: 1 });
    });
  },
  strike(c, v, i) {
    // one flask pours its brew on the foe (in turn: fire, frost, spark)
    const s = c.s;
    const brew = BREWS[i % 3];
    const src = hangAt(c, i % 3);
    const cy = chest(v);
    const [, base, light, glint] = BREW_COL[brew];
    hitFoe(c, v, 4);
    if (brew === 'fire') {
      mark(c, 'brewFlame', { x: v.x + rand(-4, 4), y: c.s.ground, r: v.img.displayHeight * 0.9, life: 360, seed: i * 7 + v.id });
      s.fx.burst(v.x, cy, light, 7, true, 1.1);
    } else if (brew === 'frost') {
      mark(c, 'brewFrost', { x: v.x, y: cy, r: 10 + c.n, life: 320, seed: i * 7 + v.id });
      s.fx.chips(v.x, cy, 10, [WHITE, glint, light], 7, 0);
    } else {
      mark(c, 'brewBolt', { x: src.x, y: src.y + 6, x1: v.x + rand(-3, 3), y1: cy, life: 180, seed: i * 7 + v.id });
      s.fx.sparks.push({ x: v.x, y: cy, at: s.anim, size: 9, color: glint });
    }
    s.fx.glow(v.x, cy, 10, base, 140);
  },
  blow(c) {
    const s = c.s;
    const m = meetAt(c);
    mark(c, 'brewBubble', { x: m.x, y: m.y, r: 30 + c.n * 4 + c.scale.layers * 2, life: 680, seed: 3 });
    for (const [i, brew] of BREWS.entries()) {
      const [, base, light] = BREW_COL[brew];
      s.later(i * 50, () => s.fx.ring(m.x, m.y, 30 + i * 12, i % 2 ? light : base, true));
    }
    s.fx.shock(m.x, s.ground, 80, 0xf0ffb0);
  },
};

// ================================================================== Brann: the great bell

const BELL_W = 30;
const BELL_H = 34;

/** The target the bell drops on (the nearest foe), and where it hangs over it. */
const bellX = (c: ShowCtx): number => nearest(c)?.homeX ?? c.heroX + 90;
const bellTop = (c: ShowCtx, k: number): number => {
  const tl = c.tl;
  const ground = c.s.ground;
  const t = nearest(c);
  const hang = Math.max(40, (t ? topOf(t) : ground - 30) - BELL_H - 4);
  // it comes down out of the sky to hang over the target, eases lower with the strikes, drops onto it at the last blow,
  // sits a moment, then lifts away
  if (k < tl.build) return -BELL_H - 4 + (hang + BELL_H + 4) * ease(between(k, 0.04, tl.build));
  if (k < tl.blow - 0.06) return hang + between(k, tl.build, tl.blow - 0.06) * 4;
  if (k < tl.blow) return hang + 4 + (ground - BELL_H - hang - 4) * ease(between(k, tl.blow - 0.06, tl.blow)) ** 2;
  return ground - BELL_H - between(k, tl.blow + 0.08, 1) * 70;
};

const GREAT_BELL: SignatureDraw = {
  motion(c, k, def) {
    // hands raised to the bell overhead while it hangs, then the blow
    return { ...def, pose: k >= c.tl.build * 0.4 && k < c.tl.blow - 0.02 ? 'fin' : def.pose };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    if (k < 0.04) return;
    const x = bellX(c);
    const a = k > tl.blow + 0.1 ? 1 - between(k, tl.blow + 0.1, 0.98) : 1;
    if (a <= 0) return;
    const ringing = c.tl.strikes.some((s) => k >= s && k < s + 0.05);
    const swing = k < tl.blow - 0.06 ? Math.sin(now / 180) * 2 : 0;
    const top = bellTop(c, k);
    // a shaft of light from above while it hangs
    if (k < tl.blow) {
      g.fillStyle(BRONZE_COL[5], 0.12 * a);
      g.fillRect(Math.round(x - BELL_W / 2 - 4), 0, BELL_W + 8, Math.round(top + BELL_H));
    }
    paintBell(g, x + swing, top, BELL_W, BELL_H, { a, glow: ringing ? 1 : k >= tl.blow && k < tl.blow + 0.06 ? 1 : 0.2, deep: true });
  },
  strike(c, v, i, of) {
    // the bell rings (once per strike, not per foe): sound rings off its mouth; the foes shudder
    const s = c.s;
    hitFoe(c, v, 3);
    if (v !== nearest(c) && c.views.length > 1) return;
    const k = c.tl.strikes[i] ?? c.tl.build;
    const x = bellX(c);
    const y = bellTop(c, k) + BELL_H;
    mark(c, 'bellRing', { x, y, r: 20 + (i / Math.max(1, of)) * 12, life: 300, seed: i });
    s.fx.shake(1, 60);
  },
  blow(c) {
    const s = c.s;
    const x = bellX(c);
    // the boom: dust, a shockwave, sound waves rolling out across the stage both ways
    s.fx.dust(x, s.ground, 14, 0, 1.6);
    s.fx.shock(x, s.ground, 100, BRONZE_COL[4]);
    s.later(80, () => s.fx.shock(x, s.ground, 70, BRONZE_COL[5]));
    for (let j = 0; j < 3; j++) mark(c, 'soundWave', { x, y: s.ground - BELL_H / 2, r: 160, at: s.anim + j * 90, life: 520, seed: j });
    for (const v of c.views) s.fx.stars.push({ x: v.x, y: topOf(v) - 4, at: s.anim, r: 10, color: BRONZE_COL[4] });
  },
};

// ------------------------------------------------------------------ their marks

export const FIZZ_BRANN_MARKS: Record<string, MarkDraw> = {
  // a fire flask's flames licking up a foe
  brewFlame(g, m, k) {
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    const rise = ease(clamp01(k / 0.3));
    const [, base, light, glint] = BREW_COL.fire;
    for (let i = 0; i < 5; i++) {
      const fx = m.x - 10 + i * 5;
      const fh = m.r * rise * (0.5 + 0.5 * hash(i, m.seed)) * (1 - Math.abs(i - 2) * 0.15);
      const sway = Math.sin(k * 20 + i) * 1.5;
      g.fillStyle(INK, a);
      g.fillRect(Math.round(fx - 2 + sway), Math.round(m.y - fh), 5, Math.round(fh));
      g.fillStyle(base, a);
      g.fillRect(Math.round(fx - 1 + sway), Math.round(m.y - fh + 1), 3, Math.round(fh - 1));
      g.fillStyle(light, a);
      g.fillRect(Math.round(fx + sway), Math.round(m.y - fh * 0.75), 1, Math.round(fh * 0.6));
      g.fillStyle(glint, a);
      g.fillRect(Math.round(fx + sway), Math.round(m.y - fh * 0.3), 1, Math.round(fh * 0.25));
    }
  },
  // a frost flask's shards bursting on a foe, a frost ring
  brewFrost(g, m, k) {
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const r = m.r * ease(clamp01(k / 0.4));
    const [, base, light, glint] = BREW_COL.frost;
    ellipseLine(g, m.x, m.y, r + 4, (r + 4) * 0.6, 1, glint, a * 0.8);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + m.seed;
      const x = m.x + Math.cos(ang) * r;
      const y = m.y + Math.sin(ang) * r * 0.7;
      g.fillStyle(INK, a);
      g.fillRect(Math.round(x) - 2, Math.round(y) - 3, 5, 7);
      g.fillStyle(i % 2 ? base : light, a);
      g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 3, 5);
      g.fillStyle(WHITE, a);
      g.fillRect(Math.round(x) - 1, Math.round(y) - 2, 1, 2);
    }
  },
  // a spark flask's green lightning from the flask to the foe
  brewBolt(g, m, k) {
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const [, base, light, glint] = BREW_COL.spark;
    let px = m.x;
    let py = m.y;
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = m.x + (m.x1 - m.x) * t + (i < n ? (hash(i, m.seed + Math.floor(k * 6)) - 0.5) * 10 : 0);
      const y = m.y + (m.y1 - m.y) * t;
      line(g, px, py, x, y, 3, INK, a);
      line(g, px, py, x, y, 1, i % 2 ? light : glint, a);
      px = x;
      py = y;
    }
    twinkle(g, m.x1, m.y1, 4, base, a);
  },
  // the three brews smashed together: a great bubble swells over the foes, swirling in three colours, then bursts
  brewBubble(g, m, k) {
    const R = m.r;
    const cols = BREWS.map((b) => BREW_COL[b]);
    if (k < 0.32) {
      const q = ease(k / 0.32);
      const r = Math.max(2, R * q);
      g.fillStyle(INK, 0.9);
      g.fillCircle(Math.round(m.x), Math.round(m.y), Math.round(r + 1));
      // three swirling bands of brew inside a pale skin
      g.fillStyle(0xe8f4f0, 0.55);
      g.fillCircle(Math.round(m.x), Math.round(m.y), Math.round(r));
      for (let i = 0; i < 3; i++) {
        const ang = k * 14 + (i / 3) * Math.PI * 2;
        g.fillStyle(cols[i][1], 0.75);
        g.fillCircle(Math.round(m.x + Math.cos(ang) * r * 0.4), Math.round(m.y + Math.sin(ang) * r * 0.4), Math.round(r * 0.45));
        g.fillStyle(cols[i][2], 0.8);
        g.fillCircle(Math.round(m.x + Math.cos(ang) * r * 0.45), Math.round(m.y + Math.sin(ang) * r * 0.45), Math.round(r * 0.22));
      }
      g.fillStyle(WHITE, 0.9);
      g.fillRect(Math.round(m.x - r * 0.55), Math.round(m.y - r * 0.6), 3, 2);
      g.fillRect(Math.round(m.x - r * 0.6), Math.round(m.y - r * 0.45), 2, 3);
    } else {
      // the burst: a three-colour starburst, droplets raining out
      const q = (k - 0.32) / 0.68;
      const a = 1 - q;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const r0 = R * (0.6 + q * 0.8);
        const r1 = r0 + 8 + (i % 2) * 6;
        line(g, m.x + Math.cos(ang) * r0, m.y + Math.sin(ang) * r0 * 0.8, m.x + Math.cos(ang) * r1, m.y + Math.sin(ang) * r1 * 0.8, 3, cols[i % 3][2], a);
        line(g, m.x + Math.cos(ang) * r0, m.y + Math.sin(ang) * r0 * 0.8, m.x + Math.cos(ang) * (r0 + 3), m.y + Math.sin(ang) * (r0 + 3) * 0.8, 1, WHITE, a);
      }
      for (let i = 0; i < 18; i++) {
        const t = q * 0.8;
        const vx = (hash(i, m.seed) - 0.5) * 220;
        const vy = -120 - hash(i + 5, m.seed) * 80;
        const x = m.x + vx * t;
        const y = m.y + vy * t + 0.5 * 600 * t * t;
        g.fillStyle(cols[i % 3][i % 2 ? 2 : 3], a);
        g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
  },
  // sound rings rolling off the bell's mouth
  bellRing(g, m, k) {
    const a = 1 - k;
    for (let j = 0; j < 2; j++) {
      const r = m.r * (0.3 + k * 0.9) + j * 5;
      ellipseLine(g, m.x, m.y, r, r * 0.35, 2, j ? BRONZE_COL[4] : BRONZE_COL[5], a * (j ? 0.7 : 1));
    }
  },
  // the great bell's boom: arcs of sound rolling out across the stage both ways from where it landed
  soundWave(g, m, k) {
    const a = (1 - k) * 0.9;
    const r = 10 + m.r * ease(k);
    for (const dir of [-1, 1])
      for (let t = -0.7; t <= 0.7; t += 0.07) {
        const x = m.x + dir * Math.cos(t) * r;
        const y = m.y - Math.sin(t) * r * 0.6;
        g.fillStyle(t > -0.08 && t < 0.08 ? WHITE : BRONZE_COL[4], a);
        g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
  },
};

export { GRAND_REACTION, GREAT_BELL };
