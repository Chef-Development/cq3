// Pixel-art drawing primitives on a Phaser Graphics: rounded rows, bevelled bars and buttons, glossy bricks, icons.
import type Phaser from 'phaser';
import { HUD_ICONS } from '../art';
import { cornerInset } from '../chrome';
import { clamp01, INK, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Rounded rectangle drawn row by row (pixel-art corners). */
export function rows(g: G, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  for (let i = 0; i < h; i++) {
    const k = cornerInset(i, h, r);
    if (w - k * 2 > 0) g.fillRect(x + k, y + i, w - k * 2, 1);
  }
}

/**
 * Reference-style meter: ink outline, a light metal bevel (lit top/left, dark bottom/right), a dark trough and a
 * 3-tone fill with a white "ghost" for recent loss. `mirror` drains from the left (enemy bars).
 */
export function hudBar(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  ghost: number,
  o: { fill?: number; hi?: number; lo?: number; bg?: number; bgHi?: number; bgLo?: number; mirror?: boolean; frame?: boolean } = {},
): void {
  const framed = o.frame !== false;
  if (framed) {
    rows(g, x - 3, y - 3, w + 6, h + 6, 2, INK);
    rows(g, x - 2, y - 2, w + 4, h + 4, 1, 0xa8aec2);
    g.fillStyle(0xeef3fa, 1);
    g.fillRect(x - 1, y - 2, w + 2, 1);
    g.fillRect(x - 2, y - 1, 1, h + 2);
    g.fillStyle(0x6a7088, 1);
    g.fillRect(x - 1, y + h + 1, w + 2, 1);
    g.fillRect(x + w + 1, y - 1, 1, h + 2);
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
  } else rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK);
  const bg = o.bg ?? 0xc8303a;
  g.fillStyle(bg, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(o.bgHi ?? 0xf05a48, 1);
  g.fillRect(x, y, w, 1);
  g.fillStyle(o.bgLo ?? 0x8a1a22, 1);
  g.fillRect(x, y + h - 2, w, 2);
  const gw = Math.round(w * clamp01(ghost));
  const fw = Math.round(w * clamp01(frac));
  const at = (len: number) => (o.mirror ? x + w - len : x);
  g.fillStyle(0xfff6d8, 1);
  g.fillRect(at(gw), y, gw, h);
  if (fw > 0) {
    g.fillStyle(o.fill ?? 0x6ad040, 1);
    g.fillRect(at(fw), y, fw, h);
    g.fillStyle(o.hi ?? 0xb4f070, 1);
    g.fillRect(at(fw), y, fw, Math.max(1, Math.floor(h / 3)));
    g.fillStyle(o.lo ?? 0x3e9228, 1);
    g.fillRect(at(fw), y + h - 2, fw, 2);
    // a soft gloss line under the highlight
    g.fillStyle(WHITE, 0.35);
    g.fillRect(at(fw), y, fw, 1);
  }
}

/** Small rounded HP bar over an enemy in a group fight. */
export function hpBar(g: G, x: number, y: number, w: number, h: number, frac: number, ghost: number, color: number): void {
  rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK);
  g.fillStyle(0x3a2030, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xfff0c0, 1);
  g.fillRect(x, y, Math.round(w * clamp01(ghost)), h);
  const fw = Math.round(w * clamp01(frac));
  g.fillStyle(color, 1);
  g.fillRect(x, y, fw, h);
  g.fillStyle(WHITE, 0.45);
  g.fillRect(x, y, fw, 1);
}

/**
 * A chunky reference-style button: ink outline, 1 px light rim (white top/left, grey bottom/right), a face that
 * is lighter on top and darker at the bottom, and a drop shadow.
 */
export function button3d(g: G, r: Rect, face: readonly [number, number, number, number], pressed = false, rim = true): void {
  const y = r.y + (pressed ? 1 : 0);
  if (!pressed) rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 2, 3, INK, 0.45);
  rows(g, r.x - 1, y - 1, r.w + 2, r.h + 2, 3, INK);
  if (rim) {
    rows(g, r.x, y, r.w, r.h, 2, 0xc8d0dc);
    g.fillStyle(WHITE, 1);
    g.fillRect(r.x + 2, y, r.w - 4, 1);
    g.fillRect(r.x, y + 2, 1, r.h - 4);
    g.fillRect(r.x + 1, y + 1, 1, 1);
  }
  const ix = r.x + (rim ? 1 : 0);
  const iy = y + (rim ? 1 : 0);
  const iw = r.w - (rim ? 2 : 0);
  const ih = r.h - (rim ? 2 : 0);
  const [hi, base, lo, deep] = face;
  rows(g, ix, iy, iw, ih, rim ? 1 : 2, base);
  g.fillStyle(hi, 1);
  g.fillRect(ix + 1, iy, iw - 2, Math.max(1, Math.floor(ih * 0.4)));
  g.fillStyle(lo, 1);
  g.fillRect(ix + 1, iy + ih - 3, iw - 2, 2);
  g.fillStyle(deep, 1);
  g.fillRect(ix + 1, iy + ih - 1, iw - 2, 1);
  g.fillStyle(WHITE, 0.9);
  g.fillRect(ix + iw - 5, iy + 1, 3, 1);
  g.fillRect(ix + 2, iy + ih - 3, 2, 1);
}

/**
 * A glossy timing block like the reference's: ink outline with rounded corners, lit top rows and left edge,
 * darker bottom and right edge (a slightly cylindrical look), and specular dashes in two corners.
 */
export function brick(g: G, X: number, Y: number, W: number, H: number, ramp: readonly [number, number, number, number], alpha = 1): void {
  const [hi, base, lo, deep] = ramp;
  rows(g, X - 1, Y - 1, W + 2, H + 2, 3, INK, alpha);
  rows(g, X, Y, W, H, 2, base, alpha);
  // vertical light: two lit rows on top, two shaded + one deep row at the bottom
  for (let i = 0; i < H; i++) {
    const k = cornerInset(i, H, 2);
    const col = i < 2 ? hi : i >= H - 1 ? deep : i >= H - 3 ? lo : -1;
    if (col < 0) continue;
    g.fillStyle(col, alpha);
    g.fillRect(X + k, Y + i, W - k * 2, 1);
  }
  if (W >= 6) {
    // lit left edge, shaded right edge
    g.fillStyle(hi, alpha);
    g.fillRect(X + 1, Y + 2, 1, H - 5);
    g.fillStyle(lo, alpha);
    g.fillRect(X + W - 2, Y + 2, 2, H - 5);
    // specular dashes
    g.fillStyle(WHITE, alpha);
    g.fillRect(X + W - 5, Y + 1, 3, 1);
    g.fillRect(X + 2, Y + H - 3, 3, 1);
  }
}

/** A beveled brick with an ink outline, centered on cx. */
export function slab(g: G, cx: number, y: number, w: number, h: number, fill: number, hi: number, lo: number, alpha = 1): void {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  if (W < 4 || H < 6) {
    g.fillStyle(INK, alpha);
    g.fillRect(Math.round(cx - W / 2) - 1, Math.round(y) - 1, W + 2, H + 2);
    g.fillStyle(fill, alpha);
    g.fillRect(Math.round(cx - W / 2), Math.round(y), W, H);
    return;
  }
  brick(g, Math.round(cx - W / 2), Math.round(y), W, H, [hi, fill, lo, lo], alpha);
}

/** Pixel ellipse ring (an aura around a popping block). */
export function ellipse(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number, thick: number): void {
  g.fillStyle(color, alpha);
  const n = Math.max(24, Math.round(rx * 5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * rx - thick / 2), Math.round(cy + Math.sin(a) * ry - thick / 2), thick, thick);
  }
}

/** One-color icon from '#' rows. */
export function icon(g: G, iconRows: string[], x: number, y: number, color: number): void {
  g.fillStyle(color, 1);
  iconRows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; xx++) if (r[xx] === '#') g.fillRect(x + xx, y + yy, 1, 1);
  });
}

export function iconSize(key: string): [number, number] {
  const r = HUD_ICONS[key].rows;
  return [Math.max(...r.map((s) => s.length)), r.length];
}

/** Multi-color HUD icon (see art.ts HUD_ICONS). */
export function hudIcon(g: G, key: string, x: number, y: number, scale = 1): void {
  const ic = HUD_ICONS[key];
  ic.rows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; xx++) {
      const col = ic.pal[r[xx]];
      if (col === undefined) continue;
      g.fillStyle(col, 1);
      g.fillRect(x + xx * scale, y + yy * scale, scale, scale);
    }
  });
}
