// The fourth region's bar rules, drawn on the bar (view/bar.ts calls these): the lantern and the dark blocks, and
// the tide. Everything is a picture (nothing depends on sound):
// - the lantern: outside its light the track lies in dusk; round the cursor a warm glow as wide as the light reaches
//   (it widens as the cursor speeds up; a dimmed one burns low, cooler and flickering), with amber ticks where the
//   light ends. An unlit dark block is a shape with a dim violet rim and two faint glints: what it is can't be seen.
//   When the light reaches it, its colour floods in with a warm flash (bar.ts).
// - the tide: a band of dark water over that end of the bar (and over the blocks standing in it: they lie dim and
//   wavering under the surface), its surface a bright moving line with foam; a small mark on the frame shows how far
//   this act's tide comes; a red wading through it leaves a wake.
import type Phaser from 'phaser';
import { isRed, type Combat } from '../../core/combat';
import type { BarBox } from './bar-links';

type G = Phaser.GameObjects.Graphics;

const DUSK = 0x07060d;
const GLOW = 0xffc870;
const GLOW_HOT = 0xffe6a8;
const GLOW_LOW = 0xc8a0e0; // a dimmed lantern burns low and cool
const SHAPE = 0x231c35;
const SHAPE_RIM = 0x8070b0;
const SHAPE_GLINT = 0xd8ccff;
const WATER = 0x1b4f6e;
const WATER_DEEP = 0x0f2f48;
const SURF = 0x9fe0f0;
const FOAM = 0xe8fbff;

/** Whether the fight has anything to do with the lantern (an act with dark blocks, a dark block on the bar, a dimmed
 *  lantern). */
export function lanternOn(c: Combat): boolean {
  return !!c.bar?.dark || c.lightMult < 1 || c.blocks.some((b) => b.dark);
}

/** Under the blocks: the track lies in dusk outside the lantern's light; round the cursor, a warm glow. */
export function drawLantern(g: G, c: Combat, t: number, now: number, B: BarBox, bx: number): void {
  if (!lanternOn(c)) return;
  const reach = c.lightReach() * B.w;
  const cx = B.x + c.cursorPosAt(t) * B.w + bx;
  const lo = Math.max(B.x + bx, Math.round(cx - reach));
  const hi = Math.min(B.x + B.w + bx, Math.round(cx + reach));
  const y = B.y + 1;
  const h = B.h - 2;
  // dusk on either side of the light
  g.fillStyle(DUSK, 0.55);
  if (lo > B.x + bx) g.fillRect(B.x + bx, y, lo - (B.x + bx), h);
  if (hi < B.x + B.w + bx) g.fillRect(hi, y, B.x + B.w + bx - hi, h);
  // the glow: three bands, brightest at the cursor (a dimmed lantern flickers)
  const low = c.lightMult < 1;
  const flick = low ? 0.75 + 0.25 * Math.sin(now / 47) * Math.sin(now / 131) : 1;
  const col = low ? GLOW_LOW : GLOW;
  for (const [k, a] of [
    [1, 0.1],
    [0.66, 0.1],
    [0.33, 0.12],
  ] as const) {
    const r = Math.round(reach * k);
    const x0 = Math.max(B.x + bx, Math.round(cx - r));
    const x1 = Math.min(B.x + B.w + bx, Math.round(cx + r));
    if (x1 <= x0) continue;
    g.fillStyle(k < 0.5 && !low ? GLOW_HOT : col, a * flick);
    g.fillRect(x0, y, x1 - x0, h);
  }
  // where the light ends: amber ticks above and below the track
  g.fillStyle(col, 0.85 * flick);
  for (const x of [lo, hi - 1]) {
    if (x <= B.x + bx || x >= B.x + B.w + bx - 1) continue;
    g.fillRect(x, B.y - 2, 1, 2);
    g.fillRect(x, B.y + B.h, 1, 2);
  }
}

/** An unlit dark block (bar.ts draws it here instead of its colours): a shape with a dim rim and two faint glints. */
export function drawDarkShape(g: G, x: number, y: number, w: number, h: number, now: number, id: number): void {
  g.fillStyle(SHAPE, 0.96);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(SHAPE_RIM, 1);
  g.fillRect(x + 1, y, w - 2, 1);
  g.fillRect(x + 1, y + h - 1, w - 2, 1);
  g.fillRect(x, y + 1, 1, h - 2);
  g.fillRect(x + w - 1, y + 1, 1, h - 2);
  // two glints, slowly breathing (each shape on its own beat)
  const k = 0.55 + 0.35 * Math.sin(now / 420 + id * 1.7);
  g.fillStyle(SHAPE_GLINT, k);
  g.fillRect(x + Math.max(1, Math.round(w * 0.3)), y + Math.round(h * 0.38), 1, 1);
  g.fillRect(x + Math.max(2, Math.round(w * 0.65)), y + Math.round(h * 0.38), 1, 1);
}

/** Over the still blocks, under the reds: the water at either end, the high-water mark, wakes behind wading reds. */
export function drawWater(g: G, c: Combat, t: number, now: number, B: BarBox, bx: number): void {
  const T = c.bar?.tide && c.row >= c.bar.tide.fromRow ? c.bar.tide : null;
  const { l, r } = c.waterAt(t);
  // how far this act's tide comes: a small blue mark on the frame (at each end it comes from)
  if (T) {
    g.fillStyle(SURF, 0.9);
    for (const at of [T.from !== 'right' ? T.high : -1, T.from !== 'left' ? 1 - T.high : -1]) {
      if (at < 0) continue;
      const x = Math.round(B.x + at * B.w) + bx;
      g.fillRect(x - 1, B.y - 9, 3, 1);
      g.fillRect(x, B.y - 8, 1, 2);
    }
  }
  if (l <= 0 && r <= 0) return;
  const top = B.y - 4;
  const bot = B.y + B.h + 4;
  const band = (x0: number, x1: number, edge: number, dir: number) => {
    if (x1 - x0 < 1) return;
    g.fillStyle(WATER, 0.58);
    g.fillRect(x0, top + 1, x1 - x0, bot - top - 1);
    g.fillStyle(WATER_DEEP, 0.3);
    g.fillRect(x0, B.y + B.h - 2, x1 - x0, bot - (B.y + B.h - 2));
    // slow ripples across it
    for (let i = 0; i < 3; i++) {
      const ry = B.y + 2 + i * 4;
      const off = Math.round((now / (380 + i * 90)) % 8);
      g.fillStyle(SURF, 0.22);
      for (let x = x0 + ((off + i * 3) % 8); x < x1 - 2; x += 8) g.fillRect(x, ry, 3, 1);
    }
    // the surface: a bright line that wobbles, foam breaking on the dry side
    for (let yy = top; yy < bot; yy++) {
      const wob = Math.round(Math.sin(now / 160 + yy * 0.9)) * dir;
      g.fillStyle(SURF, 0.9);
      g.fillRect(edge + wob, yy, 1, 1);
      if ((yy + Math.floor(now / 140)) % 4 === 0) {
        g.fillStyle(FOAM, 0.7);
        g.fillRect(edge + wob - dir, yy, 1, 1);
      }
    }
  };
  if (l > 0) {
    const e = Math.round(B.x + l * B.w) + bx;
    band(B.x + bx, e, e, 1);
  }
  if (r > 0) {
    const e = Math.round(B.x + (1 - r) * B.w) + bx;
    band(e, B.x + B.w + bx, e, -1);
  }
  // reds wading through: a wake of foam behind them (they travel left: the wake trails to the right)
  for (const b of c.blocks) {
    if (!isRed(b.kind) || b.still || !c.wet(b.pos, t)) continue;
    const x = Math.round(B.x + (c.blockPosAt(b, t) + b.width / 2) * B.w) + bx;
    const k = Math.floor(now / 90) % 3;
    g.fillStyle(FOAM, 0.75);
    g.fillRect(x + 1 + k, B.y + 1, 2, 1);
    g.fillRect(x + 3 + k, B.y + B.h - 2, 2, 1);
    g.fillStyle(FOAM, 0.4);
    g.fillRect(x + 5 + k, B.y + 3, 2, 1);
  }
}
