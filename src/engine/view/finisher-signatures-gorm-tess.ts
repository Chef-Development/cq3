// Gorm's and Tess's signature moments in their finisher shows (Part 6), on top of their styles' kits (the Brute's
// dust storm, cracks and rock pillars; the Controller's aurora, ice spikes and crystals: view/finisher-kits.ts):
//   Gorm   boulderRoll   he leaps in and pounds the ground with both gauntlets; the slam sets boulders rolling, one
//                      after another, bouncing through every foe; last, a great boulder drops out of the sky onto
//                      them and bursts, and a heap of rubble settles where they stand
//   Tess   clockRewind   a great brass clock rises behind the foes; its hands spin backwards, faster and faster, as
//                      rewind arrows wheel round each foe; at the last blow the hands snap to twelve and it chimes: a
//                      ring of brass and teal sweeps out and gears burst from it
// Everything is drawn from the show's clock and deterministic noise (the screenshot tests stay exact).
import { GAME_W } from '../layout';
import { clamp01, ease, INK, WHITE, type EnemyView } from './shared';
import { centerOf, chest, hash, hitFoe, line, outQuad, poly, spanOf, twinkle, type G, type ShowCtx } from './finisher-fx';
import type { HeroMotion, SignatureDraw } from './finisher-signatures';

/** 0..1 between two points of the show. */
const between = (k: number, a: number, b: number): number => clamp01((k - a) / Math.max(1e-6, b - a));

// ================================================================== Gorm: the landslide

/** Gorm's granite [deep, dark, mid, light, lit] and his moss. */
const GRANITE = [0x24232f, 0x3c3a48, 0x5c5864, 0x837e7e, 0xaba396, 0xd6cdb8] as const;
const MOSS = [0x447436, 0x6e9c3c, 0xa2c84e] as const;
const DUST = 0xc8b494;

/** A round boulder at (x, y), radius r, rolled `spin` radians: an ink rim, the stone lit from the top left, a crack and
 *  a patch of moss that turn with it. */
function boulder(g: G, x: number, y: number, r: number, spin: number, a = 1): void {
  if (r < 1.5 || a <= 0) return;
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(INK, a);
  g.fillCircle(x, y, r + 1);
  g.fillStyle(GRANITE[2], a);
  g.fillCircle(x, y, r);
  g.fillStyle(GRANITE[3], a);
  g.fillCircle(x - Math.round(r * 0.18), y - Math.round(r * 0.18), Math.max(1, Math.round(r * 0.78)));
  g.fillStyle(GRANITE[4], a);
  g.fillCircle(x - Math.round(r * 0.36), y - Math.round(r * 0.36), Math.max(1, Math.round(r * 0.42)));
  g.fillStyle(GRANITE[5], a);
  g.fillRect(x - Math.round(r * 0.5), y - Math.round(r * 0.55), Math.max(1, Math.round(r * 0.3)), 1);
  // the shade on its lower right
  g.fillStyle(GRANITE[1], a);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 0.5;
    g.fillRect(Math.round(x + Math.cos(t) * (r - 1)) - 1, Math.round(y + Math.sin(t) * (r - 1)) - 1, 2, 2);
  }
  // a crack and a patch of moss turning as it rolls
  const cx = Math.cos(spin);
  const cy = Math.sin(spin);
  line(g, x + cx * r * 0.1, y + cy * r * 0.1, x + cx * r * 0.8, y + cy * r * 0.8, 1, GRANITE[1], a);
  line(g, x + cx * r * 0.45, y + cy * r * 0.45, x + cx * r * 0.45 - cy * r * 0.3, y + cy * r * 0.45 + cx * r * 0.3, 1, GRANITE[1], a);
  const mx = Math.round(x - cx * r * 0.55);
  const my = Math.round(y - cy * r * 0.55);
  g.fillStyle(MOSS[1], a);
  g.fillRect(mx - 1, my - 1, 3, 2);
  g.fillStyle(MOSS[2], a);
  g.fillRect(mx - 1, my - 1, 1, 1);
}

/** The rolling boulders: how many (more stacks, more stone), and where boulder i is at k. */
const rollers = (c: ShowCtx): number => Math.min(6, 2 + c.n + (c.scale.layers >= 3 ? 1 : 0));
function rollerAt(c: ShowCtx, i: number, k: number): { x: number; y: number; r: number; spin: number; q: number } | null {
  const tl = c.tl;
  const n = rollers(c);
  const t0 = tl.build + (i / n) * (0.7 - tl.build) * 0.8;
  const q = (k - t0) / 0.24;
  if (q < 0 || q >= 1) return null;
  const r = (7 + hash(i, 211) * 4) | 0;
  const x0 = c.toX + 12;
  const x1 = Math.max(spanOf(c)[1] + 50, GAME_W + 14);
  const x = x0 + (x1 - x0) * q;
  const bounce = Math.abs(Math.sin(q * Math.PI * 3 + hash(i, 212))) * 9 * (1 - q * 0.6);
  return { x, y: c.s.ground - r - bounce, r, spin: (x - x0) / r, q };
}

/** The great boulder's drop at the last blow: from the sky onto the middle of the foes. */
const DROP = 0.07;
const bigR = (c: ShowCtx): number => 11 + c.n;

const LANDSLIDE: SignatureDraw = {
  motion(c, k, def: HeroMotion) {
    // a heavy leap, then both gauntlets up for the slam and the drop
    if (k < c.tl.build) return { ...def, lift: def.lift * 1.15 };
    if (k >= c.tl.blow - DROP && k < c.tl.back) return { ...def, pose: 'fin' };
    return def;
  },
  start(c) {
    const s = c.s;
    // the slam on landing: both gauntlets into the ground
    s.later(c.tl.ms * c.tl.build, () => {
      const x = c.toX + 16;
      s.fx.shock(x, s.ground, 64, 0xe8d8b8);
      s.fx.rubble(x, s.ground, 12, 1.3);
      s.fx.dust(x, s.ground, 8, 1, 1.3);
      s.fx.shake(4, 240);
    });
  },
  back(g, c, k) {
    const tl = c.tl;
    // after the drop: a heap of rubble settles where the foes stand, then sinks away
    if (k < tl.blow) return;
    const [lo, hi] = spanOf(c);
    const settle = ease(between(k, tl.blow, tl.blow + 0.05));
    const sink = between(k, tl.blow + 0.1, 1);
    const ground = c.s.ground;
    const h = (8 + c.n) * settle * (1 - sink);
    if (h < 1) return;
    const x0 = lo - 26;
    const x1 = hi + 26;
    const pts: Array<[number, number]> = [[x0, ground + 1]];
    for (let i = 0; i <= 10; i++) {
      const q = i / 10;
      pts.push([x0 + (x1 - x0) * q, ground - h * Math.sin(q * Math.PI) * (0.75 + 0.25 * hash(i, 221))]);
    }
    pts.push([x1, ground + 1]);
    poly(g, pts.map(([x, y]) => [x, y - 1] as [number, number]), INK, 1 - sink);
    poly(g, pts, GRANITE[2], 1 - sink);
    // the stones in it, lit from the top left
    for (let i = 0; i < 14 + c.n * 2; i++) {
      const x = x0 + 4 + hash(i, 223) * (x1 - x0 - 8);
      const q = (x - x0) / (x1 - x0);
      const top = ground - h * Math.sin(q * Math.PI) * 0.85;
      const y = top + hash(i, 224) * (ground - top);
      const r = 1 + Math.round(hash(i, 225) * 2);
      g.fillStyle(GRANITE[1], 1 - sink);
      g.fillRect(Math.round(x), Math.round(y), r + 1, r);
      g.fillStyle(GRANITE[4], 1 - sink);
      g.fillRect(Math.round(x), Math.round(y), r, 1);
    }
  },
  front(g, c, k) {
    const tl = c.tl;
    const ground = c.s.ground;
    // the boulders rolling through the foes, dust kicked up behind them
    for (let i = 0; i < rollers(c); i++) {
      const b = rollerAt(c, i, k);
      if (!b) continue;
      for (let d = 1; d <= 3; d++) {
        g.fillStyle(DUST, 0.5 * (1 - d / 4));
        g.fillRect(Math.round(b.x - b.r - d * 4), ground - 2 - d, 3, 2);
      }
      boulder(g, b.x, b.y, b.r, b.spin, 1 - Math.max(0, b.q - 0.85) / 0.15);
    }
    // the great boulder dropping out of the sky onto the middle of the foes
    if (k >= tl.blow - DROP && k < tl.blow) {
      const q = between(k, tl.blow - DROP, tl.blow);
      const cx = centerOf(c);
      const R = bigR(c);
      const y = -R + (ground - R + R) * q * q;
      // its shadow on the ground, growing as it falls
      g.fillStyle(INK, 0.25 * q);
      g.fillEllipse(Math.round(cx), ground, Math.round(R * 2 * q + 4), 4);
      boulder(g, cx, y, R, q * 2.5);
    }
  },
  strike(c, v: EnemyView) {
    const s = c.s;
    // a boulder bowls through it
    hitFoe(c, v, 7, 50);
    s.fx.rubble(v.x, s.ground, 3, 0.9);
    s.fx.chips(v.x, chest(v), 8, [GRANITE[5], GRANITE[3], GRANITE[1]], 6, 0);
  },
  blow(c) {
    const s = c.s;
    const cx = centerOf(c);
    // the great boulder bursts on them
    s.fx.shock(cx, s.ground, 90 + c.n * 6, 0xe8d8b8);
    s.fx.rubble(cx, s.ground, 18 + c.n * 2, 1.7);
    s.fx.dust(cx, s.ground, 14, 0, 1.6);
    s.fx.chips(cx, s.ground - 10, 40, [GRANITE[5], GRANITE[4], GRANITE[2], DUST], 22, -1);
    s.fx.flashes.push({ x: cx, y: s.ground - bigR(c), r: 18 + c.n * 2, at: s.anim });
    for (const v of c.views) hitFoe(c, v, 8, 60);
    s.fx.shake(6, 360);
  },
};

// ================================================================== Tess: the rewind

const BRASS = [0x4a2a10, 0x8a5414, 0xc88a1c, 0xecbc34, 0xfff0a0] as const;
const TEAL = [0x1e6c68, 0x309686, 0x62c4aa, 0xa8ecd0] as const;
const FACE = 0xf6eed8;

/** The clock's middle and radius (behind the foes, over their heads). */
function clockAt(c: ShowCtx): { x: number; y: number; r: number } {
  const r = 17 + c.n * 2 + (c.scale.layers >= 2 ? 2 : 0);
  return { x: Math.round(centerOf(c) + 4), y: Math.round(Math.max(r + 10, c.s.ground - 33)), r };
}

/** How far round the hands have spun (radians, negative: backwards): slowly at first, faster and faster through the
 *  flurry, snapping to twelve at the last blow. */
function handSpin(c: ShowCtx, k: number): number {
  const tl = c.tl;
  if (k >= tl.blow) return 0;
  const q = between(k, 0.04, tl.blow);
  return -Math.PI * 2 * (q * q * (3 + c.n));
}

/** A small gear at (x, y), radius r, turned `ang`: eight teeth, a hub. */
function gear(g: G, x: number, y: number, r: number, ang: number, a = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(INK, a);
  g.fillCircle(x, y, r + 2);
  for (let i = 0; i < 8; i++) {
    const t = ang + (i / 8) * Math.PI * 2;
    g.fillStyle(i < 4 ? BRASS[3] : BRASS[2], a);
    g.fillRect(Math.round(x + Math.cos(t) * (r + 1)) - 1, Math.round(y + Math.sin(t) * (r + 1)) - 1, 2, 2);
  }
  g.fillStyle(BRASS[2], a);
  g.fillCircle(x, y, r);
  g.fillStyle(BRASS[3], a);
  g.fillCircle(x - 1, y - 1, Math.max(1, r - 1));
  g.fillStyle(BRASS[0], a);
  g.fillRect(x - 1, y - 1, 2, 2);
}

/** The great clock: a brass case lit from the top left, a cream face with twelve ticks, the hands, a teal glow. */
function clock(g: G, c: ShowCtx, k: number, scale: number, a: number, now: number): void {
  const { x, y, r: R0 } = clockAt(c);
  const r = Math.round(R0 * scale);
  if (r < 3 || a <= 0) return;
  // the glow of turned-back time behind it
  g.fillStyle(TEAL[2], 0.16 * a * (0.85 + 0.15 * Math.sin(now / 90)));
  g.fillCircle(x, y, r + 7);
  g.fillStyle(TEAL[3], 0.1 * a);
  g.fillCircle(x, y, r + 12);
  // the case
  g.fillStyle(INK, a);
  g.fillCircle(x, y, r + 3);
  g.fillStyle(BRASS[1], a);
  g.fillCircle(x, y, r + 2);
  g.fillStyle(BRASS[3], a);
  g.fillCircle(x - 1, y - 1, r + 1);
  g.fillStyle(BRASS[2], a);
  g.fillCircle(x, y, r);
  // the face
  g.fillStyle(FACE, 0.92 * a);
  g.fillCircle(x, y, r - 2);
  g.fillStyle(0xdcd0b4, 0.9 * a);
  for (let i = 0; i < 8; i++) {
    const t = Math.PI * 0.1 + (i / 8) * Math.PI * 0.6;
    g.fillRect(Math.round(x + Math.cos(t) * (r - 3)) - 1, Math.round(y + Math.sin(t) * (r - 3)) - 1, 2, 2);
  }
  // twelve ticks (the quarters long)
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const long = i % 3 === 0;
    line(g, x + Math.cos(t) * (r - 3), y + Math.sin(t) * (r - 3), x + Math.cos(t) * (r - (long ? 7 : 5)), y + Math.sin(t) * (r - (long ? 7 : 5)), long ? 2 : 1, BRASS[0], a);
  }
  // the hands, spinning back (a trail of where the minute hand just was)
  const spin = handSpin(c, k);
  const m = spin - Math.PI / 2;
  const h = spin / 12 - Math.PI / 2 + Math.PI * 0.66;
  if (k < c.tl.blow)
    for (let j = 1; j <= 3; j++) {
      const t = m + j * 0.18;
      line(g, x, y, x + Math.cos(t) * (r - 6), y + Math.sin(t) * (r - 6), 1, TEAL[2], a * (0.6 - j * 0.15));
    }
  line(g, x, y, x + Math.cos(h) * (r * 0.5), y + Math.sin(h) * (r * 0.5), 3, INK, a);
  line(g, x, y, x + Math.cos(m) * (r - 6), y + Math.sin(m) * (r - 6), 2, INK, a);
  g.fillStyle(BRASS[3], a);
  g.fillCircle(x, y, 2);
  g.fillStyle(BRASS[4], a);
  g.fillRect(x - 1, y - 1, 1, 1);
  // the crown and ring on top
  g.fillStyle(INK, a);
  g.fillRect(x - 3, y - r - 7, 7, 6);
  g.fillStyle(BRASS[3], a);
  g.fillRect(x - 2, y - r - 6, 5, 4);
  g.fillStyle(BRASS[4], a);
  g.fillRect(x - 2, y - r - 6, 2, 1);
}

/** A rewind arrow wheeling backwards round a foe: an arc of teal ticks and its arrowhead. */
function rewindArrow(g: G, v: EnemyView, ang: number, a: number): void {
  const x = v.x;
  const y = chest(v);
  const rx = v.img.displayWidth / 2 + 7;
  const ry = v.img.displayHeight / 2 + 4;
  for (let j = 0; j < 9; j++) {
    const t = ang + j * 0.22;
    g.fillStyle(j < 3 ? TEAL[3] : TEAL[2], a * (1 - j * 0.07));
    g.fillRect(Math.round(x + Math.cos(t) * rx) - 1, Math.round(y + Math.sin(t) * ry) - 1, 2, 2);
  }
  // the head at the leading end (it moves anticlockwise: the head is at the smallest angle)
  const hx = Math.round(x + Math.cos(ang) * rx);
  const hy = Math.round(y + Math.sin(ang) * ry);
  g.fillStyle(INK, a);
  g.fillRect(hx - 2, hy - 2, 5, 5);
  g.fillStyle(WHITE, a);
  g.fillRect(hx - 1, hy - 1, 3, 3);
}

const REWIND: SignatureDraw = {
  back(g, c, k, now) {
    const tl = c.tl;
    // the clock rises behind the foes, then fades after its chime
    const grow = outQuad(between(k, 0.04, tl.build));
    const fade = 1 - between(k, tl.blow + 0.06, 1);
    if (grow > 0 && fade > 0) clock(g, c, k, 0.4 + 0.6 * grow, Math.min(1, grow * 1.5) * fade, now);
  },
  front(g, c, k, now) {
    const tl = c.tl;
    // rewind arrows wheeling backwards round every foe through the flurry
    if (k >= tl.build && k < tl.blow) {
      const a = Math.min(1, between(k, tl.build, tl.build + 0.05) * 1.2);
      c.views.forEach((v, i) => rewindArrow(g, v, -now / 110 - i * 1.7, a));
    }
    // little gears spinning in the air round the clock as it builds
    if (k > 0.06 && k < tl.blow) {
      const { x, y, r } = clockAt(c);
      for (let i = 0; i < 2 + c.scale.layers; i++) {
        const t = -now / 400 + (i / (2 + c.scale.layers)) * Math.PI * 2;
        gear(g, x + Math.cos(t) * (r + 12), y + Math.sin(t) * (r * 0.7 + 8), 2, -now / 90, 0.9 * between(k, 0.06, 0.16));
      }
    }
    // the chime: a ring of brass and teal sweeping out from the clock
    if (k >= tl.blow && k < tl.blow + 0.12) {
      const q = between(k, tl.blow, tl.blow + 0.12);
      const { x, y, r } = clockAt(c);
      const rr = r + 6 + q * 70;
      g.lineStyle(3, TEAL[3], 1 - q);
      g.strokeCircle(x, y, Math.round(rr));
      g.lineStyle(1, BRASS[4], 1 - q);
      g.strokeCircle(x, y, Math.round(rr - 4));
      twinkle(g, x, y - r - 9, 4, BRASS[4], 1 - q);
    }
  },
  strike(c, v: EnemyView, i) {
    const s = c.s;
    hitFoe(c, v, 4, 40);
    s.fx.chips(v.x, chest(v), 10, [BRASS[4], BRASS[3], TEAL[2]], 6, 0);
    if (i % 2 === 0) s.fx.ring(v.x, chest(v), 9, TEAL[3], true);
  },
  blow(c) {
    const s = c.s;
    const { x, y, r } = clockAt(c);
    // the hands snap to twelve and it chimes: gears burst out of it, every foe is struck
    s.fx.flashes.push({ x, y, r: r + 6, at: s.anim });
    s.fx.chips(x, y, r * 2, [BRASS[4], BRASS[3], BRASS[2], TEAL[3]], 26, 0);
    s.fx.burst(x, y, BRASS[3], 14, true, 1.4, true);
    for (const v of c.views) {
      hitFoe(c, v, 6, 60);
      s.fx.ring(v.x, chest(v), 16, TEAL[3], true);
    }
    s.fx.shake(3, 220);
  },
};

/** Gorm's and Tess's signature moments (finisher-signatures.ts adds them to SIGNATURE_DRAW). */
export const GORM_TESS_SIGNATURES = { boulderRoll: LANDSLIDE, clockRewind: REWIND };
