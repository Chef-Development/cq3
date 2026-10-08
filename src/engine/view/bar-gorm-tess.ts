// Gorm's and Tess's marks on the timing bar (Part 6), drawn by view/bar.ts:
// - a red Gorm slowed (his Roar, Landslide's rubble) is dusted over, pebbles on its top edge, instead of frosted;
//   Landslide's rubble lies piled along the bar's top and bottom edges over its right end while it lasts, settling
//   and fading as it runs out;
// - a red Tess holds still (the Stopwatch) goes grey under a white clock face whose hand sweeps round as the stop runs
//   out; a red her Slow Time slows takes a teal wash and a small hourglass; while time is stopped, the bar's frame
//   ticks like a clock's rim; a red she winds back (Rewind, Backspin, Time Loop) shows two teal rewind arrows.
// Everything animates from `now` and block ids (screenshots stay exact). Values come from the fight (c.perk).
import type Phaser from 'phaser';
import { isRed, type Block, type Combat } from '../../core/combat';
import { rubbleWidth } from '../../core/kit-fx';
import { rows } from './pixels';
import { clamp01, INK, mix, pulse, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Gorm's stone [light, mid, dark, deep] and the dust; Tess's brass [light, mid, dark], teal, the held reds' grey. */
const STONE = [0xc4bcae, 0x96908e, 0x6e6a74, 0x4a4858] as const;
const DUST = 0xc8b494;
const BRASS = [0xffe08a, 0xd8a83a, 0x9a6a1a] as const;
const TEAL = [0x9af0e0, 0x3ab0a0, 0x1e6a64] as const;
const SEPIA = 0x8a7a6a;

/** A red drawn the Part 6 heroes' way while it's slowed or held (true: drawn; false: the usual frost). */
export function drawKitChill(g: G, c: Combat, b: Block, X: number, Y: number, W: number, H: number, now: number, left: number): boolean {
  if (c.heroId === 'gorm' && b.chillMult > 0) {
    dusted(g, X, Y, W, H, b.id);
    return true;
  }
  if (c.heroId !== 'tess') return false;
  if (b.chillMult <= 0) held(g, X, Y, W, H, now, left, b.chill);
  else slowedTess(g, X, Y, W, H, now);
  return true;
}

/** Dust over a red Gorm slowed: speckled bands, pebbles along its top edge. */
function dusted(g: G, X: number, Y: number, W: number, H: number, seed: number): void {
  rows(g, X, Y, W, H, 2, DUST, 0.28);
  for (let y = Y + 2; y < Y + H - 1; y += 3)
    for (let x = X + 1 + ((y + seed) % 3); x < X + W - 1; x += 4) {
      g.fillStyle(STONE[(x + y + seed) % 3], 0.9);
      g.fillRect(x, y, 1, 1);
    }
  // pebbles sitting on its top edge
  for (let x = X + 1 + (seed % 2); x < X + W - 2; x += 4) {
    g.fillStyle(INK, 0.8);
    g.fillRect(x - 1, Y - 2, 4, 3);
    g.fillStyle(STONE[1], 1);
    g.fillRect(x, Y - 2, 2, 2);
    g.fillStyle(STONE[0], 1);
    g.fillRect(x, Y - 2, 1, 1);
  }
}

/** A red held still by the Stopwatch: grey, a white clock face whose hand sweeps round as the stop runs out, blinking
 *  in its last moments. */
function held(g: G, X: number, Y: number, W: number, H: number, now: number, left: number, sec: number): void {
  rows(g, X, Y, W, H, 2, SEPIA, 0.6);
  g.fillStyle(WHITE, 0.5);
  g.fillRect(X + 1, Y, W - 2, 1);
  if (sec < 0.3 && Math.floor(now / 70) % 2 === 0) return;
  const cx = Math.round(X + W / 2);
  const cy = Math.round(Y + H / 2);
  // the face: 7 px round, brass rim
  g.fillStyle(INK, 0.9);
  g.fillRect(cx - 3, cy - 4, 7, 9);
  g.fillRect(cx - 4, cy - 3, 9, 7);
  g.fillStyle(BRASS[1], 1);
  g.fillRect(cx - 2, cy - 3, 5, 7);
  g.fillRect(cx - 3, cy - 2, 7, 5);
  g.fillStyle(0xfff8e8, 1);
  g.fillRect(cx - 2, cy - 2, 5, 5);
  // the hand: from the centre toward the share of the stop gone (12 o'clock, then clockwise)
  const a = (1 - clamp01(left)) * Math.PI * 2 - Math.PI / 2;
  g.fillStyle(INK, 1);
  g.fillRect(cx, cy, 1, 1);
  g.fillRect(cx + Math.round(Math.cos(a) * 2), cy + Math.round(Math.sin(a) * 2), 1, 1);
  g.fillStyle(BRASS[2], 1);
  g.fillRect(cx + Math.round(Math.cos(a) * 1), cy + Math.round(Math.sin(a) * 1), 1, 1);
}

/** A red Slow Time slows: a teal wash and a small hourglass whose sand runs. */
function slowedTess(g: G, X: number, Y: number, W: number, H: number, now: number): void {
  rows(g, X, Y, W, H, 2, TEAL[1], 0.3);
  g.fillStyle(TEAL[0], 0.9);
  g.fillRect(X + 2, Y, W - 4, 1);
  const cx = Math.round(X + W / 2);
  const cy = Math.round(Y + H / 2);
  g.fillStyle(INK, 0.9);
  g.fillRect(cx - 3, cy - 4, 7, 9);
  g.fillStyle(BRASS[1], 1);
  g.fillRect(cx - 2, cy - 3, 5, 1);
  g.fillRect(cx - 2, cy + 3, 5, 1);
  g.fillStyle(0xe8fff8, 1);
  g.fillRect(cx - 1, cy - 2, 3, 2);
  g.fillRect(cx, cy, 1, 1);
  g.fillRect(cx - 1, cy + 1, 3, 2);
  // the sand: falling grains, a pile growing at the bottom
  const k = Math.floor(now / 160) % 4;
  g.fillStyle(BRASS[0], 1);
  g.fillRect(cx - 1, cy - 2 + (k >> 1), 3 - (k >> 1), 1);
  g.fillRect(cx, cy + (k % 2), 1, 1);
  g.fillRect(cx - 1, cy + 2, 3, 1);
}

/** The bar's own marks: Landslide's rubble (Gorm), the clock rim while time is stopped and the rewind arrows (Tess). */
export function drawKitBar(g: G, c: Combat, B: Rect, bx: number, xOf: (pos: number) => number, now: number): void {
  if (c.heroId === 'gorm' && c.perk.rubble > 0) rubble(g, c, B, bx, xOf, now);
  if (c.heroId !== 'tess') return;
  if (c.perk.stop > 0) clockRim(g, B, bx, c.perk.stop, now);
  for (const b of c.blocks) if (isRed(b.kind) && b.push > 0) rewindMark(g, B, Math.round(xOf(b.pos)) + bx, now);
}

/** Landslide's rubble over the bar's right end: rocks piled along the top and bottom edges, a dusty wash over the
 *  track; it settles (sinks) and fades as it runs out. */
function rubble(g: G, c: Combat, B: Rect, bx: number, xOf: (pos: number) => number, now: number): void {
  const max = Math.max(0.1, c.perk.rubbleMax || c.perk.rubble);
  const a = clamp01(c.perk.rubble / 0.6);
  const x0 = Math.round(xOf(1 - rubbleWidth(c))) + bx;
  const x1 = Math.round(xOf(1)) + bx;
  if (x1 - x0 < 4 || a <= 0) return;
  const sink = c.perk.rubble < max * 0.2 ? 1 : 0;
  rows(g, x0, B.y + 1, x1 - x0, B.h - 2, 2, DUST, 0.22 * a);
  // a dashed edge where the rubble starts (reds slow from there on)
  for (let y = B.y - 6; y < B.y + B.h + 6; y += 3) {
    g.fillStyle(DUST, 0.7 * a);
    g.fillRect(x0, y, 1, 2);
  }
  for (const [y0, flip] of [
    [B.y - 7 + sink, 0],
    [B.y + B.h + 5 - sink, 1],
  ] as const) {
    for (let x = x0 + 1, i = 0; x < x1 - 2; i++) {
      const w = 3 + ((i * 7 + flip) % 3);
      const h = 2 + ((i * 5 + flip) % 2);
      const y = flip ? y0 : y0 + (3 - h);
      g.fillStyle(INK, 0.85 * a);
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle(STONE[2], a);
      g.fillRect(x, y, w, h);
      g.fillStyle(STONE[1], a);
      g.fillRect(x, y, w - 1, h - 1);
      g.fillStyle(STONE[0], a);
      g.fillRect(x, y, Math.max(1, w - 2), 1);
      x += w + 1;
    }
  }
  // dust drifting up off it now and then
  if (Math.floor(now / 180) % 3 === 0) {
    const dx = x0 + 3 + (Math.floor(now / 180) % Math.max(1, x1 - x0 - 6));
    g.fillStyle(DUST, 0.6 * a);
    g.fillRect(dx, B.y - 10 - (Math.floor(now / 60) % 3), 1, 1);
  }
}

/** While time is stopped: the bar's frame ticks like a clock's rim (twelve brass ticks along its top and bottom, the
 *  lit one stepping round), fading in its last moments. */
function clockRim(g: G, B: Rect, bx: number, left: number, now: number): void {
  const a = clamp01(left / 0.25);
  const n = 12;
  const lit = Math.floor(now / 100) % n;
  for (let i = 0; i < n; i++) {
    const x = Math.round(B.x + bx + ((i + 0.5) * B.w) / n);
    const col = i === lit ? WHITE : mix(BRASS[1], BRASS[0], pulse(now, 400));
    for (const y of [B.y - 9, B.y + B.h + 7]) {
      g.fillStyle(INK, 0.8 * a);
      g.fillRect(x - 1, y - 1, 3, 4);
      g.fillStyle(col, a);
      g.fillRect(x, y, 1, 2);
    }
  }
}

/** Two teal arrows pointing right over a red being wound back. */
function rewindMark(g: G, B: Rect, x: number, now: number): void {
  const y = B.y + Math.round(B.h / 2);
  const off = Math.floor(now / 70) % 3;
  for (const dx of [-5, 0]) {
    const ax = x + dx + off;
    g.fillStyle(INK, 0.9);
    g.fillRect(ax - 1, y - 4, 4, 9);
    g.fillStyle(TEAL[0], 1);
    g.fillRect(ax, y - 3, 1, 7);
    g.fillRect(ax + 1, y - 2, 1, 5);
    g.fillRect(ax + 2, y - 1, 1, 3);
  }
}
