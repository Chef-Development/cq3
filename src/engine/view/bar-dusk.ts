// The fourth region's bar rules, drawn on the bar (view/bar.ts calls these): the lantern and the dark blocks, and
// the tide. Everything is a picture (nothing depends on sound):
// - the lantern: outside its light the track lies in a cool dusk; round the cursor a pool of lamplight as wide as the
//   light reaches, in steps that brighten toward the cursor and spill over the frame above and below (it widens as the
//   cursor speeds up; a dimmed one burns low, cooler and flickering), with amber ticks where the light ends; blocks
//   in the light catch it on their top edge. An unlit dark block is an ink-grey shape with a faint "?" (never violet:
//   that's the trap's colour): what it is can't be seen. When the light reaches it, its colour floods in with a warm
//   flash (bar.ts).
// - the tide: a band of dark water over that end of the bar, its top a moving crest of light, its front a bright
//   wobbling line with foam; the blocks standing in it keep their own colour under a thin blue veil with ripples
//   running over them (out of reach, but you can see what they are); the cursor wading in rings the water; a small
//   mark on the frame shows how far this act's tide comes; a red wading through it leaves a wake.
import type Phaser from 'phaser';
import { isRed, type Combat } from '../../core/combat';
import type { BarBox } from './bar-links';

type G = Phaser.GameObjects.Graphics;

const DUSK = 0x090a1c; // a cool indigo dusk (L7: shadows deep and cool), so the lamplight reads warm against it
const GLOW = 0xff9a3c; // a saturated amber (a pale one over the violet track read as brown dirt)
const GLOW_HOT = 0xffd27a;
const RAIL = 0xffe8b0; // the track's rails catching the light
const GLOW_LOW = 0xc8a0e0; // a dimmed lantern burns low and cool
const SHAPE = 0x1c1c22; // an unlit shape: ink-grey, never the trap's violet
const SHAPE_RIM = 0x4c4c56;
const SHAPE_MARK = 0x9a9aa6;
const WATER = 0x1b4f6e;
const WATER_DEEP = 0x0f2f48;
const VEIL = 0x2a72a8; // the thin water over a sunk block (a blue that keeps the block's own colour)
const SURF = 0x9fe0f0;
const FOAM = 0xe8fbff;

/** The "?" on an unlit shape (4 x 7). */
const ASK = ['.##.', '#..#', '...#', '..#.', '..#.', '....', '..#.'];

/** Whether the fight has anything to do with the lantern (an act with dark blocks, a dark block on the bar, a dimmed
 *  lantern). */
export function lanternOn(c: Combat): boolean {
  return !!c.bar?.dark || c.lightMult < 1 || c.blocks.some((b) => b.dark);
}

/** Under the blocks: the track lies in dusk outside the lantern's light; round the cursor, a pool of lamplight. */
export function drawLantern(g: G, c: Combat, t: number, now: number, B: BarBox, bx: number): void {
  if (!lanternOn(c)) return;
  const reach = c.lightReach() * B.w;
  const cx = B.x + c.cursorPosAt(t) * B.w + bx;
  const L = B.x + bx;
  const R = B.x + B.w + bx;
  const lo = Math.max(L, Math.round(cx - reach));
  const hi = Math.min(R, Math.round(cx + reach));
  const y = B.y + 1;
  const h = B.h - 2;
  // dusk on either side of the light (a dithered step at its edge, so the light falls off rather than stops)
  g.fillStyle(DUSK, 0.62);
  if (lo > L) g.fillRect(L, y, lo - L, h);
  if (hi < R) g.fillRect(hi, y, R - hi, h);
  g.fillStyle(DUSK, 0.3);
  for (let yy = y; yy < y + h; yy++) {
    if (lo > L + 1) g.fillRect(lo + (yy % 2), yy, 1, 1);
    if (hi < R - 1) g.fillRect(hi - 1 - (yy % 2), yy, 1, 1);
  }
  // the pool: four steps, brightest at the cursor, and a halo over the frame above and below the track that fades
  // row by row (light, not a different floor); a dimmed lantern flickers
  const low = c.lightMult < 1;
  const flick = low ? 0.75 + 0.25 * Math.sin(now / 47) * Math.sin(now / 131) : 1;
  const col = low ? GLOW_LOW : GLOW;
  for (const [k, a] of [
    [1, 0.08],
    [0.72, 0.1],
    [0.46, 0.13],
    [0.22, 0.16],
  ] as const) {
    const r = Math.round(reach * k);
    const x0 = Math.max(L, Math.round(cx - r));
    const x1 = Math.min(R, Math.round(cx + r));
    if (x1 <= x0) continue;
    g.fillStyle(k < 0.5 && !low ? GLOW_HOT : col, a * flick);
    g.fillRect(x0, y, x1 - x0, h);
    if (k > 0.9) continue;
    for (let d = 1; d <= 3; d++) {
      g.fillStyle(col, a * flick * (0.9 - d * 0.22));
      g.fillRect(x0, y - d, x1 - x0, 1);
      g.fillRect(x0, y + h - 1 + d, x1 - x0, 1);
    }
  }
  // the rails catch it: bright along the track's top and bottom edges near the cursor, fading out in steps
  for (const [k, a] of [
    [1, 0.18],
    [0.6, 0.22],
    [0.3, 0.3],
  ] as const) {
    const r = Math.round(reach * k);
    const x0 = Math.max(L, Math.round(cx - r));
    const x1 = Math.min(R, Math.round(cx + r));
    if (x1 <= x0) continue;
    g.fillStyle(low ? GLOW_LOW : RAIL, a * flick);
    g.fillRect(x0, y, x1 - x0, 1);
    g.fillRect(x0, y + h - 1, x1 - x0, 1);
  }
  // where the light ends: amber ticks above and below the track
  g.fillStyle(col, 0.85 * flick);
  for (const x of [lo, hi - 1]) {
    if (x <= L || x >= R - 1) continue;
    g.fillRect(x, B.y - 2, 1, 2);
    g.fillRect(x, B.y + B.h, 1, 2);
  }
}

/** A block in the lantern's light catches it on its top edge (brighter the nearer the cursor; bar.ts, after the
 *  block). */
export function lanternRim(g: G, c: Combat, t: number, pos: number, x: number, y: number, w: number): void {
  if (!lanternOn(c) || w < 3) return;
  const reach = c.lightReach();
  if (reach <= 0) return;
  const d = Math.abs(pos - c.cursorPosAt(t)) / reach;
  if (d >= 1) return;
  const low = c.lightMult < 1;
  g.fillStyle(low ? GLOW_LOW : GLOW_HOT, (low ? 0.45 : 0.7) * (1 - d * 0.8));
  g.fillRect(x + 1, y, w - 2, 1);
  if (d < 0.5) g.fillRect(x + 1, y + 1, 1, 2);
}

/** An unlit dark block (bar.ts draws it here instead of its colours): an ink-grey shape with a faint "?", slowly
 *  breathing (no violet: that's the trap's colour, and some dark blocks are traps). */
export function drawDarkShape(g: G, x: number, y: number, w: number, h: number, now: number, id: number): void {
  g.fillStyle(SHAPE, 0.96);
  g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle(SHAPE_RIM, 1);
  g.fillRect(x + 1, y, w - 2, 1);
  g.fillRect(x + 1, y + h - 1, w - 2, 1);
  g.fillRect(x, y + 1, 1, h - 2);
  g.fillRect(x + w - 1, y + 1, 1, h - 2);
  // the mark, each shape on its own beat
  const k = 0.45 + 0.3 * Math.sin(now / 420 + id * 1.7);
  g.fillStyle(SHAPE_MARK, k);
  const ox = x + Math.round((w - 4) / 2);
  const oy = y + Math.round((h - 7) / 2);
  if (w >= 6) for (let r = 0; r < ASK.length; r++) for (let q = 0; q < 4; q++) if (ASK[r][q] === '#') g.fillRect(ox + q, oy + r, 1, 1);
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
  // the blocks lying in the water: they keep their own colour under a thin veil (out of reach, but readable)
  const sunk: [number, number][] = [];
  for (const b of c.blocks) {
    if (!c.sunk(b, t)) continue;
    const p = c.blockPosAt(b, t);
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const x = Math.round(B.x + p * B.w - w / 2) + bx;
    sunk.push([x, x + w]);
  }
  sunk.sort((a, b) => a[0] - b[0]);
  /** Fill [x0, x1) x [y0, y1) with the water, thinly over the sunk blocks. */
  const fill = (x0: number, x1: number, y0: number, y1: number, col: number, a: number, over: number) => {
    let x = x0;
    for (const [s0, s1] of sunk) {
      if (s1 <= x || s0 >= x1) continue;
      if (s0 > x) {
        g.fillStyle(col, a);
        g.fillRect(x, y0, s0 - x, y1 - y0);
      }
      const e = Math.min(x1, s1);
      g.fillStyle(col === WATER ? VEIL : col, over);
      g.fillRect(Math.max(x, s0), y0, e - Math.max(x, s0), y1 - y0);
      x = e;
    }
    if (x < x1) {
      g.fillStyle(col, a);
      g.fillRect(x, y0, x1 - x, y1 - y0);
    }
  };
  const band = (x0: number, x1: number, edge: number, dir: number) => {
    if (x1 - x0 < 1) return;
    fill(x0, x1, top + 1, bot, WATER, 0.58, 0.3);
    fill(x0, x1, B.y + B.h - 2, bot, WATER_DEEP, 0.3, 0.12);
    // slow ripples across it (brighter where they run over a sunk block, so it reads as under water)
    for (let i = 0; i < 3; i++) {
      const ry = B.y + 2 + i * 4;
      const off = Math.round((now / (380 + i * 90)) % 8);
      for (let x = x0 + ((off + i * 3) % 8); x < x1 - 2; x += 8) {
        const over = sunk.some(([s0, s1]) => x + 3 > s0 && x < s1);
        g.fillStyle(over ? FOAM : SURF, over ? 0.42 : 0.22);
        g.fillRect(x, ry, 3, 1);
      }
    }
    // the crest along its top: a lit line with swells rolling along it toward the dry side
    for (let x = x0; x < x1; x++) {
      const sw = Math.sin((x * 0.55 - (now / 120) * dir) * 0.9);
      g.fillStyle(SURF, 0.55 + 0.25 * sw);
      g.fillRect(x, top + (sw > 0.55 ? 0 : 1), 1, 1);
      if (sw > 0.85) {
        g.fillStyle(FOAM, 0.8);
        g.fillRect(x, top, 1, 1);
      }
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
  // the cursor wading: rings spreading from it across the water
  const cp = c.cursorPosAt(t);
  if (c.wet(cp, t)) {
    const cx = Math.round(B.x + cp * B.w) + bx;
    for (const ph of [0, 0.5]) {
      const k = ((now / 640 + ph) % 1 + 1) % 1;
      const r = 2 + Math.round(k * 7);
      g.fillStyle(FOAM, 0.75 * (1 - k));
      for (const sx of [-1, 1]) {
        const x = cx + sx * r;
        if (!c.wet((x - bx - B.x) / B.w, t)) continue;
        g.fillRect(x, B.y + 1, 1, 2);
        g.fillRect(x, B.y + B.h - 3, 1, 2);
        g.fillRect(x - sx, B.y, 1, 1);
        g.fillRect(x - sx, B.y + B.h - 1, 1, 1);
      }
    }
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

/** A block just come up out of the water (k: 0..1 of its moment): drips running off its foot, a glint on its top. */
export function glisten(g: G, x: number, y: number, w: number, h: number, k: number): void {
  const a = 1 - k;
  g.fillStyle(FOAM, 0.9 * a);
  g.fillRect(x + 1, y + 1, Math.max(1, w - 2), 1);
  g.fillStyle(SURF, 0.85 * a);
  const drop = Math.round(k * 4);
  for (const dx of [1, Math.round(w / 2), w - 2]) g.fillRect(x + dx, y + h + drop - 1, 1, 1);
}
