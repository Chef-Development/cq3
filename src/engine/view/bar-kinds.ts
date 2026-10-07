// The timing bar's newer pieces, as plain painters on the bar's Graphics (view/bar.ts places them): patches (ice,
// snowdrifts, slow runes), the block kinds the heroes and the second region brought (a Bomber's keg, a frozen block, a
// hold with its start and end notches, an iced yellow's coat and its cracks), a still red's fuse ring, a chilled red's
// frost (vines for Moss, an arrow for a Volley pin), the Rampart wall at the left end and Overgrowth's vines along the
// bar. Every piece reads at a glance at 8x and none of them needs a sound to be understood.
import type Phaser from 'phaser';
import { brick, rows } from './pixels';
import { clamp01, INK, mix, pulse, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Ramps [hi, base, lo, deep]. */
export const ICE_RAMP = [0xe0faff, 0x8ae0f6, 0x4aa4d0, 0x1e5a80] as const;
export const HOLD_RAMP = [0xb8e8ff, 0x5ab4ec, 0x2a78c0, 0x14407a] as const;
const SOOT = [0x6a6276, 0x3a3444, 0x26222e, 0x15111a] as const;
const COPPER = [0xf0c070, 0xc08040, 0x7a4a20] as const;
const LEAF = [0x1e3c2a, 0x2e5a32, 0x4a7e36, 0x78a83c, 0xb4d058] as const;
/** Blockers that take a red at the bar's left end, by perk id: their slab's colours [hi, base, lo] (the slab that pops
 *  up when one blocks, and its smaller twin standing there while it's ready). */
export const BLOCKER_FACE: Record<string, readonly [number, number, number]> = {
  barkback: [0xd09a5e, 0x8e5a2e, 0x4e2c16],
  rockWall: [0xd8d0c0, 0x9a9080, 0x5a5448],
  afterimage: [0xe0c0ff, 0x9a52d8, 0x4a2470],
};

/** A little six-pointed snowflake centred on (x, y) (never a "+": that's a green's mark). */
export function flake(g: G, x: number, y: number, alpha = 1): void {
  g.fillStyle(WHITE, alpha);
  g.fillRect(x, y - 2, 1, 5);
  g.fillRect(x - 2, y - 1, 1, 1);
  g.fillRect(x + 2, y - 1, 1, 1);
  g.fillRect(x - 2, y + 1, 1, 1);
  g.fillRect(x + 2, y + 1, 1, 1);
  g.fillRect(x - 1, y, 3, 1);
}

/** A small integer hash (stable sparkles and speckles from ids and positions). */
const hash = (a: number, b = 0): number => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** A 4-point sparkle of radius r (0 = a dot) centred on (x, y). */
export function sparkle(g: G, x: number, y: number, r: number, color = WHITE, alpha = 1): void {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(color, alpha);
  g.fillRect(x - r, y, r * 2 + 1, 1);
  g.fillRect(x, y - r, 1, r * 2 + 1);
  if (r >= 2) g.fillRect(x - 1, y - 1, 3, 3);
}

// ------------------------------------------------------------------ patches

export interface PatchLook {
  id: number;
  kind: string;
  lo: number;
  hi: number;
  slide: number;
  vel: number;
}

/**
 * A patch on the bar's track (the trough, `B`): ice is a pale cyan glassy strip with slanted glints and a sparkle
 * that comes and goes, a snowdrift a soft white drift with a scalloped top and flakes, a slow patch a frost-blue
 * strip of pulsing runes. A sliding patch shows chevrons the way it slides. `a`: its fade (in, out).
 */
export function drawPatch(g: G, z: PatchLook, B: Rect, bx: number, now: number, a: number): void {
  if (a <= 0) return;
  const x0 = Math.round(B.x + z.lo * B.w) + bx;
  const x1 = Math.round(B.x + z.hi * B.w) + bx;
  const w = x1 - x0;
  if (w < 2) return;
  const top = B.y + 1;
  const h = B.h - 2;
  if (z.kind === 'ice') {
    g.fillStyle(0x7ad8f4, 0.62 * a);
    g.fillRect(x0, top, w, h);
    g.fillStyle(0xbff0ff, 0.5 * a);
    g.fillRect(x0, top + 2, w, 3);
    g.fillStyle(0xe0faff, 0.85 * a);
    g.fillRect(x0, top, w, 2);
    g.fillStyle(0x2a7ab0, 0.7 * a);
    g.fillRect(x0, top + h - 1, w, 1);
    // glassy glints: slanted 2 px streaks drifting slowly along
    const step = 11;
    const off = Math.floor(now / 140) % step;
    g.fillStyle(WHITE, 0.55 * a);
    for (let sx = x0 - h + off; sx < x1; sx += step)
      for (let r = 0; r < h; r++) {
        const px = sx + (h - r);
        if (px >= x0 && px < x1 - 1) g.fillRect(px, top + r, 2, 1);
      }
    // bright edges
    g.fillStyle(0xe8fcff, a);
    g.fillRect(x0, B.y - 1, 1, B.h + 2);
    g.fillRect(x1 - 1, B.y - 1, 1, B.h + 2);
    g.fillRect(x0, B.y - 1, w, 1);
    // a sparkle that pops up somewhere new every 0.7 s
    const cyc = Math.floor((now + z.id * 211) / 700);
    const k = ((now + z.id * 211) % 700) / 700;
    if (k < 0.55) {
      const sx = x0 + 2 + Math.floor(hash(z.id, cyc) * Math.max(1, w - 4));
      const sy = top + 1 + Math.floor(hash(cyc, z.id) * (h - 2));
      const r = k < 0.2 ? 1 : k < 0.4 ? 2 : 1;
      sparkle(g, sx, sy, r, WHITE, a);
    }
  } else if (z.kind === 'snow') {
    // a soft drift: white with a scalloped top and a cool shadow at its foot
    g.fillStyle(0xe4ecf8, 0.78 * a);
    g.fillRect(x0, top + 3, w, h - 3);
    for (let x = x0; x < x1; x++) {
      // soft mounds along its top, lit white, a cool shade under each crest
      const bump = Math.max(0, Math.min(3, Math.round(1.5 + 1.5 * Math.sin((x - x0) / 3.1 + z.id) + hash(x >> 2, z.id) - 0.5)));
      g.fillStyle(WHITE, 0.95 * a);
      g.fillRect(x, top + 3 - bump, 1, 1 + bump);
      g.fillStyle(0xc8d4ec, 0.8 * a);
      g.fillRect(x, top + 4, 1, 1);
    }
    g.fillStyle(0x98acd0, 0.85 * a);
    g.fillRect(x0, top + h - 2, w, 2);
    // flakes drifting down through it (a steady pattern, no randomness)
    g.fillStyle(WHITE, 0.95 * a);
    for (let i = 0; i < Math.max(2, Math.floor(w / 5)); i++) {
      const fx = x0 + Math.floor(hash(i, z.id) * w);
      const fy = top + Math.floor(((now / 90 + hash(z.id, i) * 40) % (h + 2)));
      if (fy < top + h) g.fillRect(fx, fy, 1, 1);
    }
    // soft ends: a dither instead of a hard edge
    g.fillStyle(0xe4ecf8, 0.5 * a);
    for (let r = 2; r < h; r += 2) {
      g.fillRect(x0 - 1, top + r, 1, 1);
      g.fillRect(x1, top + r + 1, 1, 1);
    }
  } else if (z.kind !== 'dash') {
    // a slow patch (and any patch kind this view doesn't know yet): a rune strip, frost-blue, or violet where a Shadow
    // Dash landed ('slowDash'); dashed rims, bright ends, glyphs that pulse one after another (one in the middle of a
    // narrow one)
    const dash = z.kind === 'slowDash';
    const [fill, rim, dim, lit] = dash ? [0x5a2a90, 0xdab0ff, 0x9a6ae0, 0xf0e0ff] : [0x3a5ad0, 0x9ad8ff, 0x6a9af0, 0xe0f6ff];
    g.fillStyle(fill, (dash ? 0.65 : 0.55) * a);
    g.fillRect(x0, top, w, h);
    g.fillStyle(rim, 0.7 * a);
    for (let x = x0; x < x1; x += 3) {
      g.fillRect(x, B.y - 1, 2, 1);
      g.fillRect(x, B.y + B.h, 2, 1);
    }
    if (dash || w < 11) {
      // bright ends, so a short one reads as a patch
      g.fillStyle(rim, 0.9 * a);
      g.fillRect(x0, B.y - 1, 1, B.h + 2);
      g.fillRect(x1 - 1, B.y - 1, 1, B.h + 2);
    }
    // frost runes: an hourglass, a snow star, a crystal, a snow star
    const RUNES = [
      ['###', '#.#', '.#.', '#.#', '###'],
      ['#.#', '.#.', '###', '.#.', '#.#'],
      ['.#.', '#.#', '#.#', '#.#', '.#.'],
      ['#.#', '.#.', '###', '.#.', '#.#'],
    ];
    const glyphAt = (x: number, i: number) => {
      const glyph = RUNES[(i + z.id) % RUNES.length];
      const p = pulse(now, dash ? 700 : 1100, i * 180);
      g.fillStyle(mix(dim, lit, p), (0.55 + 0.45 * p) * a);
      glyph.forEach((row, yy) => {
        for (let xx = 0; xx < 3; xx++) if (row[xx] === '#') g.fillRect(x + xx, top + 2 + yy, 1, 1);
      });
    };
    if (w < 11) {
      if (w >= 5) glyphAt(Math.round(x0 + w / 2 - 1.5), 0);
    } else for (let i = 0, x = x0 + 3; x + 3 <= x1 - 2; i++, x += 8) glyphAt(x, i);
  }
  // sliding: chevrons pointing the way it slides
  if (z.slide > 0 && z.vel !== 0 && w >= 14) {
    const dir = z.vel > 0 ? 1 : -1;
    const k = Math.floor((now % 450) / 150);
    const my = Math.round(B.y + B.h / 2);
    for (let j = 0; j < 3; j++) {
      const cx = Math.round(x0 + w / 2 + dir * (j - 1) * 5);
      // the one at the front of the run is brightest, stepping along
      const lit = j === k;
      for (let r = -3; r <= 3; r++) {
        const px = cx + dir * (3 - Math.abs(r));
        g.fillStyle(0x1e5a80, 0.8 * a);
        g.fillRect(px - dir, my + r, 1, 1);
        g.fillStyle(lit ? WHITE : 0xc8f4ff, (lit ? 1 : 0.7) * a);
        g.fillRect(px, my + r, 1, 1);
      }
    }
  }
}

// ------------------------------------------------------------------ block kinds

/**
 * A Bomber's keg: a round black keg with a copper band on a warm glow (it's yours to hit), a short fuse curling out of
 * its top and a bright spark fizzing on its tip.
 */
export function drawKeg(g: G, X: number, Y: number, W: number, H: number, now: number, alpha = 1): void {
  const cx = X + W / 2;
  const r = Math.max(5, Math.min(8, Math.floor(Math.min(W, H - 6) / 2)));
  const cy = Y + H - r - 2;
  // a warm halo behind it: it's one of yours
  g.fillStyle(0xff9a3a, (0.22 + 0.12 * pulse(now, 400)) * alpha);
  g.fillCircle(Math.round(cx), Math.round(cy), r + 3);
  // the round body: ink rim, soot shading lit from the top left, a copper band round its middle
  g.fillStyle(INK, alpha);
  g.fillCircle(Math.round(cx), Math.round(cy), r + 1);
  g.fillStyle(SOOT[2], alpha);
  g.fillCircle(Math.round(cx), Math.round(cy), r);
  g.fillStyle(SOOT[1], alpha);
  g.fillCircle(Math.round(cx - 1), Math.round(cy - 1), r - 1);
  g.fillStyle(SOOT[0], alpha);
  g.fillCircle(Math.round(cx - 2), Math.round(cy - 2), Math.max(1, r - 4));
  const by = Math.round(cy + 1);
  const half = Math.round(Math.sqrt(Math.max(0, r * r - 1)));
  g.fillStyle(COPPER[1], alpha);
  g.fillRect(Math.round(cx - half), by, half * 2, 2);
  g.fillStyle(COPPER[0], alpha);
  g.fillRect(Math.round(cx - half) + 1, by, 3, 1);
  g.fillStyle(COPPER[2], alpha);
  g.fillRect(Math.round(cx - half), by + 2, half * 2, 1);
  // a shine on its top left
  g.fillStyle(WHITE, 0.9 * alpha);
  g.fillRect(Math.round(cx - r + 2), Math.round(cy - r + 3), 2, 1);
  g.fillRect(Math.round(cx - r + 2), Math.round(cy - r + 4), 1, 1);
  // the cap and the fuse, curling up and over
  const top = Math.round(cy - r);
  const fx = Math.round(cx + 1);
  g.fillStyle(INK, alpha);
  g.fillRect(fx - 2, top - 2, 5, 3);
  g.fillStyle(COPPER[1], alpha);
  g.fillRect(fx - 1, top - 1, 3, 1);
  g.fillStyle(INK, alpha);
  g.fillRect(fx, top - 6, 3, 5);
  g.fillRect(fx + 2, top - 7, 3, 3);
  g.fillStyle(0xd8b080, alpha);
  g.fillRect(fx + 1, top - 5, 1, 3);
  g.fillRect(fx + 2, top - 6, 2, 1);
  // the spark: a flickering star with an orange glow
  const f = Math.floor(now / 70) % 3;
  const sx = fx + 4;
  const sy = top - 7;
  g.fillStyle(0xff8a2a, 0.55 * alpha);
  g.fillCircle(sx, sy, 3);
  g.fillStyle([0xffe680, WHITE, 0xffb040][f], alpha);
  g.fillRect(sx - 1, sy, 3, 1);
  g.fillRect(sx, sy - 1, 1, 3);
  if (f !== 2) {
    g.fillStyle(0xffe680, alpha);
    g.fillRect(sx - 2 + f * 4, sy - 2, 1, 1);
  }
  g.fillStyle(WHITE, alpha);
  g.fillRect(sx, sy, 1, 1);
}

/**
 * A frozen block (a red frozen in place: hit it, it shatters): an ice-blue crystal brick with facets, glints and a
 * snowflake. Melting (its last 1.5 s): it blinks and drips.
 */
export function drawFrozen(g: G, X: number, Y: number, W: number, H: number, now: number, lifeLeft: number, seed: number): void {
  const melting = lifeLeft < 1.5;
  if (melting && lifeLeft < 0.6 && Math.floor(now / 80) % 2 === 0) return;
  brick(g, X, Y, W, H, ICE_RAMP);
  // facets: a lit diagonal plane and the crystal's inner contour
  g.fillStyle(0xc8f4ff, 0.9);
  for (let i = 2; i < H - 3; i++) {
    const px = X + 2 + Math.round((H - i) * 0.35);
    if (px < X + W - 3) g.fillRect(px, Y + i, 2, 1);
  }
  g.fillStyle(0x2a7ab0, 1);
  for (let i = 4; i < H - 2; i++) {
    const px = X + W - 4 - Math.round(i * 0.25);
    if (px > X + 2) g.fillRect(px, Y + i, 1, 1);
  }
  // a snowflake in the middle
  const cx = Math.round(X + W / 2);
  const cy = Math.round(Y + H / 2);
  g.fillStyle(0x1e5a80, 1);
  g.fillRect(cx - 3, cy, 7, 1);
  g.fillRect(cx, cy - 3, 1, 7);
  g.fillStyle(WHITE, 1);
  g.fillRect(cx - 2, cy - 2, 1, 1);
  g.fillRect(cx + 2, cy - 2, 1, 1);
  g.fillRect(cx - 2, cy + 2, 1, 1);
  g.fillRect(cx + 2, cy + 2, 1, 1);
  g.fillRect(cx - 1, cy - 1, 3, 3);
  // a glint that travels round now and then
  const k = ((now + seed * 97) % 1600) / 1600;
  if (k < 0.2) sparkle(g, X + 3 + Math.round((W - 6) * (k / 0.2)), Y + 3, k < 0.1 ? 1 : 2);
  if (melting) {
    // drips falling off its foot
    g.fillStyle(0x8ae0f6, 0.9);
    for (let i = 0; i < 2; i++) {
      const dx = X + 3 + Math.round(hash(seed, i) * (W - 6));
      const dy = (now / 6 + i * 9) % 10;
      g.fillRect(dx, Y + H + Math.round(dy), 1, 2);
    }
  }
}

/**
 * A hold: a long frozen bar with a groove down its middle, ice ridges, a gold start notch on the side the cursor
 * enters from (with an arrow pointing in: press here) and a white end notch on the far side (let go here). While it's
 * held the groove fills from the start notch to the cursor (gold for a Perfect press).
 */
export function drawHold(g: G, X: number, Y: number, W: number, H: number, entry: number, fillX: number | null, perfect: boolean, now: number, alpha = 1): void {
  // held: a glow round the whole bar (behind it)
  if (fillX !== null) rows(g, X - 3, Y, W + 6, H, 3, perfect ? 0xffe680 : 0x9ad8ff, (0.35 + 0.15 * pulse(now, 300)) * alpha);
  brick(g, X, Y + 2, W, H - 4, HOLD_RAMP, alpha);
  // ice ridges across it
  g.fillStyle(0x9ad8ff, 0.7 * alpha);
  for (let x = X + 4; x < X + W - 3; x += 5) g.fillRect(x, Y + 4, 1, 2);
  // the groove
  const gy = Y + Math.round(H / 2) - 2;
  g.fillStyle(INK, alpha);
  g.fillRect(X + 3, gy - 1, W - 6, 6);
  g.fillStyle(0x0e2a52, alpha);
  g.fillRect(X + 3, gy, W - 6, 4);
  if (fillX !== null) {
    const a0 = entry > 0 ? X + 3 : Math.round(fillX);
    const a1 = entry > 0 ? Math.round(fillX) : X + W - 3;
    const lo = Math.max(X + 3, Math.min(a0, a1));
    const hi = Math.min(X + W - 3, Math.max(a0, a1));
    if (hi > lo) {
      const [c0, c1] = perfect ? [0xfff0a0, 0xf2c230] : [0xe0faff, 0x7ad8ff];
      g.fillStyle(c1, alpha);
      g.fillRect(lo, gy, hi - lo, 4);
      g.fillStyle(c0, alpha);
      g.fillRect(lo, gy, hi - lo, 2);
      // the head: a hot white edge, pulsing
      g.fillStyle(WHITE, (0.7 + 0.3 * pulse(now, 160)) * alpha);
      g.fillRect(entry > 0 ? hi - 1 : lo, gy - 1, 1, 6);
    }
  } else {
    // waiting: a shimmer runs along the groove toward the far end
    const k = ((now % 900) / 900) * (W - 8);
    const sx = entry > 0 ? X + 4 + k : X + W - 5 - k;
    g.fillStyle(0x5ab4ec, 0.8 * alpha);
    g.fillRect(Math.round(sx), gy + 1, 3, 2);
  }
  // the start notch (gold, an arrow into the bar) and the end notch (white)
  const sx = entry > 0 ? X : X + W - 1;
  const ex = entry > 0 ? X + W - 1 : X;
  g.fillStyle(INK, alpha);
  g.fillRect(sx - 2, Y - 3, 5, H + 6);
  g.fillStyle(0xf2c230, alpha);
  g.fillRect(sx - 1, Y - 2, 3, H + 4);
  g.fillStyle(0xfff0a0, alpha);
  g.fillRect(sx - 1, Y - 2, 1, H + 4);
  g.fillStyle(0x9a5a14, alpha);
  g.fillRect(sx + 1, Y - 2, 1, H + 4);
  const ay = Y + Math.round(H / 2);
  for (let r = 0; r < 3; r++) {
    g.fillStyle(INK, alpha);
    g.fillRect(sx + entry * (3 + r) - (entry > 0 ? 0 : 0), ay - 3 + r, 1, 7 - r * 2);
  }
  g.fillStyle(0xfff0a0, alpha);
  g.fillRect(sx + entry * 3, ay - 1, 1, 3);
  g.fillRect(sx + entry * 4, ay, 1, 1);
  g.fillStyle(INK, alpha);
  g.fillRect(ex - 1, Y - 2, 3, H + 4);
  g.fillStyle(WHITE, alpha);
  g.fillRect(ex, Y - 1, 1, H + 2);
}

/**
 * An iced yellow (it needs `taps` more taps): a translucent ice coat over it with a frosty rim and a pip per tap
 * left; each crack it took shows as a jagged line.
 */
export function drawIceCoat(g: G, X: number, Y: number, W: number, H: number, taps: number, cracks: number, now: number): void {
  rows(g, X - 1, Y - 1, W + 2, H + 2, 3, 0xbff0ff, 0.42);
  g.fillStyle(WHITE, 0.85);
  g.fillRect(X + 1, Y - 1, W - 2, 1);
  g.fillRect(X - 1, Y + 2, 1, H - 6);
  g.fillStyle(0x4aa4d0, 0.9);
  g.fillRect(X + 1, Y + H, W - 2, 1);
  // frost glints
  g.fillStyle(WHITE, 0.9);
  g.fillRect(X + 2, Y + 2, 2, 1);
  g.fillRect(X + 2, Y + 3, 1, 1);
  if (Math.floor(now / 500) % 3 === 0) sparkle(g, X + W - 3, Y + 4, 1);
  // cracks
  for (let c = 0; c < cracks; c++) {
    const sx = X + Math.round(W * (0.35 + 0.3 * c));
    g.fillStyle(INK, 0.8);
    let x = sx;
    for (let y = Y + 1; y < Y + H - 1; y++) {
      g.fillRect(x, y, 1, 1);
      if (y % 3 === c % 3) x += (y >> 1) % 2 ? 1 : -1;
    }
    g.fillStyle(WHITE, 0.8);
    g.fillRect(sx + 1, Y + 2, 1, 3);
  }
  // pips: one per tap still needed
  const pw = taps * 3 - 1;
  const px = Math.round(X + W / 2 - pw / 2);
  for (let i = 0; i < taps; i++) {
    g.fillStyle(INK, 1);
    g.fillRect(px + i * 3 - 1, Y - 5, 4, 4);
    g.fillStyle(i < taps ? 0xe0faff : 0x4aa4d0, 1);
    g.fillRect(px + i * 3, Y - 4, 2, 2);
  }
}

/**
 * A still red's fuse (an icicle, an ice wall): a ring closing in on it as its time runs out (yellow, then orange,
 * then a blinking red), and an icicle's spike on its face.
 */
export function drawFuse(g: G, X: number, Y: number, W: number, H: number, frac: number, now: number, icicle: boolean): void {
  const f = clamp01(frac);
  const cx = X + W / 2;
  const cy = Y + H / 2;
  if (icicle) {
    // a downward spike: it fell from above and stuck
    const ix = Math.round(cx);
    g.fillStyle(INK, 1);
    g.fillRect(ix - 3, Y + 3, 7, 3);
    g.fillRect(ix - 2, Y + 6, 5, 3);
    g.fillRect(ix - 1, Y + 9, 3, 3);
    g.fillStyle(0xe0faff, 1);
    g.fillRect(ix - 2, Y + 4, 5, 1);
    g.fillRect(ix - 1, Y + 5, 3, 3);
    g.fillRect(ix, Y + 8, 1, 3);
    g.fillStyle(0x8ae0f6, 1);
    g.fillRect(ix + 1, Y + 5, 1, 2);
  }
  const blink = f < 0.3 && Math.floor(now / 70) % 2 === 0;
  const col = f > 0.6 ? 0xfff07a : f > 0.3 ? 0xff9a3a : blink ? WHITE : 0xff3a3a;
  const rx = W / 2 + 2 + 12 * f;
  const ry = H / 2 + 1 + 7 * f;
  const n = Math.max(28, Math.round((rx + ry) * 2.2));
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * rx);
    const y = Math.round(cy + Math.sin(t) * ry);
    g.fillStyle(INK, 0.55);
    g.fillRect(x, y + 1, 1, 1);
    g.fillStyle(col, 0.95);
    g.fillRect(x, y, 1, 1);
  }
}

/**
 * A chilled red: frost (a cool coat, a white rim, a snowflake), stronger when it's pinned in place; for Moss, vines
 * wrapped round it; for a Volley pin, an arrow stuck through it.
 */
export function drawChill(g: G, X: number, Y: number, W: number, H: number, style: 'frost' | 'pin' | 'vine' | 'arrow', now: number): void {
  if (style === 'vine') {
    // two vines spiralling round it, with leaves
    for (let i = 0; i < H; i++) {
      const x1 = X + Math.round((W - 1) * (0.5 + 0.5 * Math.sin(i / 2.2)));
      const x2 = X + Math.round((W - 1) * (0.5 + 0.5 * Math.sin(i / 2.2 + Math.PI)));
      g.fillStyle(LEAF[1], 1);
      g.fillRect(x1, Y + i, 2, 1);
      g.fillStyle(LEAF[3], 1);
      g.fillRect(x2, Y + i, 2, 1);
    }
    for (let i = 3; i < H; i += 6) {
      g.fillStyle(LEAF[4], 1);
      g.fillRect(X - 1, Y + i, 2, 2);
      g.fillRect(X + W - 1, Y + i + 3, 2, 2);
    }
    return;
  }
  const pinned = style === 'pin' || style === 'arrow';
  rows(g, X, Y, W, H, 2, 0x9ae8ff, pinned ? 0.55 : 0.32);
  g.fillStyle(WHITE, 0.9);
  g.fillRect(X + 2, Y, W - 4, 1);
  // frost creeping in from the corners
  g.fillStyle(0xe0faff, 0.9);
  g.fillRect(X + 1, Y + 1, 2, 1);
  g.fillRect(X + 1, Y + 2, 1, 1);
  g.fillRect(X + W - 3, Y + H - 2, 2, 1);
  if (pinned) {
    // icicles hanging off it
    g.fillStyle(0xe0faff, 1);
    for (let x = X + 2; x < X + W - 2; x += 4) g.fillRect(x, Y + H, 1, 2 + ((x >> 2) % 2));
  }
  if (style === 'arrow') {
    // a white-fletched arrow stuck through it from above
    const ax = Math.round(X + W / 2 + 2);
    g.fillStyle(INK, 1);
    g.fillRect(ax - 1, Y - 9, 3, 14);
    g.fillStyle(0xd8dce8, 1);
    g.fillRect(ax, Y - 8, 1, 12);
    g.fillStyle(WHITE, 1);
    g.fillRect(ax - 1, Y - 8, 1, 3);
    g.fillRect(ax + 1, Y - 8, 1, 3);
    g.fillStyle(0xf2c230, 1);
    g.fillRect(ax, Y - 4, 1, 1);
  } else {
    const k = Math.floor(now / 600) % 2;
    flake(g, Math.round(X + W / 2), Y + 6 + k);
  }
}

/** A growing red (a snowball): snow speckles on it and arrows out of its sides while it widens. */
export function drawGrow(g: G, X: number, Y: number, W: number, H: number, growing: boolean, seed: number): void {
  g.fillStyle(WHITE, 0.85);
  for (let i = 0; i < Math.max(3, Math.floor(W / 4)); i++) g.fillRect(X + 2 + Math.floor(hash(seed, i) * (W - 4)), Y + 3 + Math.floor(hash(i, seed) * (H - 6)), 1 + (i % 2), 1);
  if (!growing) return;
  const my = Math.round(Y + H / 2);
  for (const [x, d] of [
    [X - 3, -1],
    [X + W + 2, 1],
  ] as const) {
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, my - 3, 3, 7);
    g.fillStyle(WHITE, 1);
    g.fillRect(x, my - 1, 1, 3);
    g.fillRect(x + d, my, 1, 1);
  }
}

/**
 * Rampart: a tower-shield wall at the bar's left end (reds that reach it bounce back), its glow thinning as its time
 * runs out and blinking at the end; `flash` (0..1) when a red just bounced off it.
 */
export function drawWall(g: G, B: Rect, bx: number, left: number, total: number, flash: number, now: number): void {
  const k = clamp01(left / Math.max(0.01, total));
  if (left < 0.6 && Math.floor(now / 90) % 2 === 0) return;
  const x = B.x - 4 + bx;
  const y = B.y - 9;
  const h = B.h + 18;
  g.fillStyle(0x6ab4ff, (0.25 + 0.2 * pulse(now, 500)) * (0.4 + 0.6 * k));
  g.fillRect(x - 3, y - 2, 14, h + 4);
  g.fillStyle(INK, 1);
  g.fillRect(x - 1, y - 1, 10, h + 2);
  g.fillStyle(0xb8c2d8, 1);
  g.fillRect(x, y, 8, h);
  g.fillStyle(0x2a5ac0, 1);
  g.fillRect(x + 1, y + 2, 6, h - 4);
  g.fillStyle(0x4a8ae8, 1);
  g.fillRect(x + 1, y + 2, 2, h - 4);
  // the white tower on it
  g.fillStyle(WHITE, 1);
  g.fillRect(x + 3, y + 8, 2, h - 16);
  g.fillRect(x + 2, y + 7, 4, 2);
  g.fillRect(x + 2, y + 6, 1, 1);
  g.fillRect(x + 5, y + 6, 1, 1);
  g.fillStyle(0xeef3fa, 1);
  g.fillRect(x, y, 8, 1);
  // its time: a light draining down its rim
  g.fillStyle(0x9ad8ff, 1);
  g.fillRect(x + 7, y + h - Math.round(h * k), 1, Math.round(h * k));
  if (flash > 0) {
    g.fillStyle(WHITE, flash);
    g.fillRect(x - 1, y - 1, 10, h + 2);
  }
}

/** A blocker at the bar's left end for a moment (a Barkback, Brick's rock wall, an afterimage): a slab that took
 *  the blow, in its colour, fading. */
export function drawBlocker(g: G, B: Rect, bx: number, k: number, face: readonly [number, number, number]): void {
  if (k >= 1) return;
  const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
  const pop = k < 0.15 ? Math.round((1 - k / 0.15) * 3) : 0;
  const x = B.x - 5 + bx - pop;
  const y = B.y - 7 - pop;
  const h = B.h + 14 + pop * 2;
  g.fillStyle(INK, a);
  g.fillRect(x - 1, y - 1, 9, h + 2);
  g.fillStyle(face[1], a);
  g.fillRect(x, y, 7, h);
  g.fillStyle(face[0], a);
  g.fillRect(x, y, 7, 2);
  g.fillRect(x, y, 2, h);
  g.fillStyle(face[2], a);
  g.fillRect(x + 5, y + 2, 2, h - 2);
  if (k < 0.2) {
    g.fillStyle(WHITE, 0.8 * (1 - k / 0.2));
    g.fillRect(x - 1, y - 1, 9, h + 2);
  }
}

/** Overgrowth's vines along the bar's top and bottom edges while they slow the reds that come in. */
export function drawVines(g: G, B: Rect, bx: number, left: number, now: number): void {
  const a = clamp01(left / 0.5);
  if (a <= 0) return;
  const x0 = B.x - 6 + bx;
  const w = B.w + 12;
  for (const [y0, ph] of [
    [B.y - 6, 0],
    [B.y + B.h + 5, 2],
  ] as const) {
    for (let x = 0; x < w; x++) {
      const y = Math.round(y0 + 1.5 * Math.sin(x / 5 + ph + now / 900));
      g.fillStyle(LEAF[1], a);
      g.fillRect(x0 + x, y, 1, 2);
      g.fillStyle(LEAF[3], a);
      g.fillRect(x0 + x, y, 1, 1);
      if (x % 14 === 4) {
        g.fillStyle(LEAF[4], a);
        g.fillRect(x0 + x, y - 2, 2, 2);
        g.fillStyle(LEAF[2], a);
        g.fillRect(x0 + x + 1, y - 1, 2, 1);
      }
    }
  }
}

/**
 * A Shadow Dash's afterimage of the cursor at `x`: the cursor's own shape (the blade and its star caps) in Sable's
 * violets [light, base, deep, dark], see-through, fading with `a`.
 */
export function cursorGhost(g: G, x: number, B: Rect, a: number, col: readonly [number, number, number, number]): void {
  if (a <= 0) return;
  x = Math.round(x);
  const top = B.y - 7;
  const len = B.h + 14;
  g.fillStyle(col[3], 0.7 * a);
  g.fillRect(x - 2, top, 5, len);
  g.fillStyle(col[2], 0.9 * a);
  g.fillRect(x - 1, top + 1, 3, len - 2);
  g.fillStyle(col[0], a);
  g.fillRect(x, top + 2, 1, len - 4);
  for (const sy of [top - 1, top + len]) {
    g.fillStyle(col[3], 0.7 * a);
    g.fillRect(x - 3, sy - 1, 7, 3);
    g.fillRect(x - 1, sy - 3, 3, 7);
    g.fillStyle(col[0], a);
    g.fillRect(x - 2, sy, 5, 1);
    g.fillRect(x, sy - 2, 1, 5);
  }
}
