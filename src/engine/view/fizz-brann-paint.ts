// Fizz's flasks and Brann's bell painted live with Phaser Graphics (the bar's flasks, a toss in flight, the finisher's
// giant flasks and great bell): pixel shapes with a 1 px ink rim, lit from the top left, like the sprites. Plain
// drawing helpers; no state.
import type Phaser from 'phaser';
import type { Brew } from '../../core/kit-fizz-brann';
import { INK, pulse, WHITE } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Each brew's glass [deep, base, light, glint] (the sprites' BREW_GLASS as numbers). */
export const BREW_COL: Record<Brew, readonly [number, number, number, number]> = {
  fire: [0x5a0e1e, 0xc02a2e, 0xff6a4a, 0xffd0a0],
  frost: [0x10286a, 0x2a62d8, 0x62b0ff, 0xd8f4ff],
  spark: [0x0e4a22, 0x26a03a, 0x7ae25a, 0xf0ffb0],
};
/** The bell's bronze, dark to light. */
export const BRONZE_COL = [0x2e160c, 0x5e3214, 0x9a5a24, 0xcc8c40, 0xeec070, 0xfff0b8] as const;

/** A filled disc of radius r (pixel rows, no smoothing). */
function disc(g: G, cx: number, cy: number, r: number, col: number, a: number): void {
  g.fillStyle(col, a);
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.fillRect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1);
  }
}

/**
 * A round-bottomed flask, its body centred on (cx, cy) with radius r: an ink rim, the brew's liquid lit from the top
 * left filling the lower part, clear glass above it, a neck, a cork, a glint; `spin` (radians) tips it (a toss in the
 * air); `bubbles` (0..1, from the clock) rise inside.
 */
export function paintFlask(g: G, cx: number, cy: number, r: number, brew: Brew, now: number, o: { a?: number; spin?: number; glow?: number } = {}): void {
  const a = o.a ?? 1;
  const [deep, base, light, glint] = BREW_COL[brew];
  const tip = Math.sin(o.spin ?? 0);
  const nx = Math.round(cx + tip * (r + 1));
  const ny = Math.round(cy - Math.cos(o.spin ?? 0) * (r + 1));
  if (o.glow) disc(g, cx, cy, r + 3, light, 0.22 * o.glow * a);
  // the neck and cork (under the body's rim so it joins cleanly)
  g.fillStyle(INK, a);
  g.fillRect(nx - 2, ny - 4, 4, 5);
  g.fillStyle(0xc8d8e0, a);
  g.fillRect(nx - 1, ny - 2, 2, 3);
  g.fillStyle(0xd8b080, a);
  g.fillRect(nx - 1, ny - 3, 2, 1);
  // the body
  disc(g, cx, cy, r + 1, INK, a);
  disc(g, cx, cy, r, 0xdce8ee, a);
  // the liquid: the lower part, darker to the bottom right
  const top = Math.round(cy - r * 0.2);
  for (let dy = 0; dy <= Math.floor(r); dy++) {
    const y = top + dy;
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - (y - cy) ** 2)));
    if (w <= 0) continue;
    g.fillStyle(base, a);
    g.fillRect(Math.round(cx) - w, y, w * 2 + 1, 1);
    g.fillStyle(deep, a);
    g.fillRect(Math.round(cx) + Math.max(0, w - 1), y, 1, 1);
    if (dy === 0) {
      g.fillStyle(light, a);
      g.fillRect(Math.round(cx) - w, y, w * 2 + 1, 1);
    }
  }
  // bubbles rising in it
  const b = (now / 380) % 1;
  g.fillStyle(glint, a);
  g.fillRect(Math.round(cx + r * 0.25), Math.round(cy + r * 0.6 - b * r * 0.8), 1, 1);
  // the glint on the glass
  g.fillStyle(WHITE, a);
  g.fillRect(Math.round(cx - r * 0.5), Math.round(cy - r * 0.5), 1, Math.max(1, Math.round(r * 0.4)));
}

/** A flask standing on the bar in a block's box (X, Y, W, H): its halo in the brew's colour, the flask on the box's
 *  floor, a wisp out of its neck (fire: a flame; frost: a cold mist; spark: a crackle). */
export function paintBarFlask(g: G, X: number, Y: number, W: number, H: number, brew: Brew, now: number, alpha = 1): void {
  const cx = X + W / 2;
  const r = Math.max(4, Math.min(7, Math.floor(Math.min(W, H - 8) / 2)));
  const cy = Y + H - r - 2;
  const [, base, light, glint] = BREW_COL[brew];
  // a halo behind it: one of hers
  disc(g, cx, cy - 1, r + 3, light, (0.2 + 0.12 * pulse(now, 420)) * alpha);
  paintFlask(g, cx, cy, r, brew, now, { a: alpha });
  // the wisp over the cork
  const top = Math.round(cy - r - 5);
  const f = Math.floor(now / 90) % 3;
  if (brew === 'fire') {
    g.fillStyle(0xff8a2a, alpha);
    g.fillRect(Math.round(cx) - 1, top - 2 - f, 2, 2 + f);
    g.fillStyle(0xffe080, alpha);
    g.fillRect(Math.round(cx), top - 1 - f, 1, 1 + f);
  } else if (brew === 'frost') {
    g.fillStyle(glint, 0.85 * alpha);
    g.fillRect(Math.round(cx) - 2 + f, top - 2, 2, 1);
    g.fillRect(Math.round(cx) + 1 - f, top - 4, 2, 1);
    g.fillStyle(WHITE, alpha);
    g.fillRect(Math.round(cx) + 2, top - 1 - f, 1, 1);
  } else {
    // a little green zigzag of a spark
    g.fillStyle(glint, alpha);
    const zz = f === 1 ? 1 : 0;
    g.fillRect(Math.round(cx) - 1 + zz, top - 1, 1, 1);
    g.fillRect(Math.round(cx) + zz, top - 2, 1, 1);
    g.fillRect(Math.round(cx) - 1 + zz, top - 3, 1, 1);
    g.fillStyle(base, alpha);
    g.fillRect(Math.round(cx) + 1 - zz, top - 4, 1, 1);
  }
}

/**
 * Brann's temple bell drawn live, `w` wide and `h` tall, its top centred on (cx, top): an ink silhouette (a rounded
 * shoulder, a body flaring a little to a thick lip, the crown's loop), the bronze lit from the left, two bands, rows of
 * bosses, the striking pad; `glow` (0..1) lights it up (ringing).
 */
export function paintBell(g: G, cx: number, top: number, w: number, h: number, o: { a?: number; glow?: number; deep?: boolean } = {}): void {
  const a = o.a ?? 1;
  const glow = o.glow ?? 0;
  const half = w / 2;
  const hw = (v: number): number => {
    const sh = Math.max(3, h * 0.2);
    if (v < sh) return (half - 1) * Math.sqrt(Math.max(0, 1 - ((sh - v) / (sh + 0.6)) ** 2));
    if (v > h - Math.max(2, h * 0.1)) return half;
    return half - 1 + ((v - sh) / Math.max(1, h - sh)) * Math.max(1, w * 0.07);
  };
  const X = Math.round(cx);
  const T = Math.round(top);
  if (glow > 0) {
    g.fillStyle(BRONZE_COL[5], 0.18 * glow * a);
    g.fillEllipse(X, T + h / 2, w + 14, h + 14);
  }
  // the crown's loop
  const lr = Math.max(2, Math.round(w * 0.12));
  g.fillStyle(INK, a);
  g.fillRect(X - lr - 1, T - lr - 2, lr * 2 + 3, lr + 3);
  g.fillStyle(BRONZE_COL[3], a);
  g.fillRect(X - lr, T - lr - 1, lr * 2 + 1, 2);
  g.fillRect(X - lr, T - lr, 2, lr);
  g.fillRect(X + lr - 1, T - lr, 2, lr);
  g.fillStyle(BRONZE_COL[5], a);
  g.fillRect(X - lr, T - lr - 1, lr, 1);
  // the body, row by row: an ink rim, then the bronze in vertical bands lit from the left
  const bands = [Math.round(h * 0.28), Math.round(h * 0.62)];
  for (let v = 0; v <= h; v++) {
    const half2 = Math.round(hw(v));
    if (half2 <= 0) continue;
    const y = T + v;
    g.fillStyle(INK, a);
    g.fillRect(X - half2 - 1, y - (v === 0 ? 1 : 0), half2 * 2 + 3, v === h ? 2 : 1);
    if (v === h) continue;
    const lip = v > h - Math.max(2, h * 0.1);
    const band = bands.some((b) => v === b);
    const bandHi = bands.some((b) => v === b - 1);
    const shoulder = v < Math.max(3, h * 0.2) * 0.7;
    const wFull = half2 * 2 + 1;
    // (a deep bell, against a bright sky: a tone darker, its highlights kept)
    const cols: number[] = o.deep ? [BRONZE_COL[4], BRONZE_COL[2], BRONZE_COL[1], BRONZE_COL[0]] : [BRONZE_COL[4], BRONZE_COL[3], BRONZE_COL[2], BRONZE_COL[1]];
    const shares = [0.18, 0.3, 0.32, 0.2];
    let x = X - half2;
    shares.forEach((sh, i) => {
      const ww = i === shares.length - 1 ? X + half2 + 1 - x : Math.max(1, Math.round(wFull * sh));
      let col = cols[i];
      if (band) col = BRONZE_COL[Math.max(0, i - 0) === 0 ? 2 : 1];
      else if (bandHi || lip || shoulder) col = BRONZE_COL[Math.min(5, [5, 4, 3, 2][i])];
      g.fillStyle(col, a);
      g.fillRect(x, y, ww, 1);
      x += ww;
    });
    if (lip && v === h - 1) {
      g.fillStyle(BRONZE_COL[0], a);
      g.fillRect(X - half2 + 1, y, half2 * 2 - 1, 1);
    }
  }
  // the bosses: rows of studs on the upper panel
  const rows = Math.max(1, Math.floor((bands[1] - bands[0] - 3) / 3));
  const per = Math.max(2, Math.floor((w - 6) / 4));
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < per; i++) {
      const bx = X - Math.floor(((per - 1) * 4) / 2) + i * 4;
      const by = T + bands[0] + 2 + r * 3;
      g.fillStyle(BRONZE_COL[1], a);
      g.fillRect(bx, by + 1, 2, 1);
      g.fillStyle(i < per / 2 ? BRONZE_COL[5] : BRONZE_COL[4], a);
      g.fillRect(bx, by, 2, 1);
    }
  // the striking pad, low on the body
  const py = T + bands[1] + Math.round((h - bands[1]) * 0.45);
  const pr = Math.max(2, Math.round(w * 0.12));
  disc(g, X - Math.round(w * 0.1), py, pr + 1, BRONZE_COL[1], a);
  disc(g, X - Math.round(w * 0.1), py, pr, BRONZE_COL[4], a);
  g.fillStyle(BRONZE_COL[5], a);
  g.fillRect(X - Math.round(w * 0.1) - 1, py - 1, 1, 1);
  if (glow > 0) {
    // ringing: a white sheen down its lit side
    g.fillStyle(WHITE, 0.45 * glow * a);
    g.fillRect(X - Math.round(half) + 1, T + 2, 2, h - 4);
  }
}
