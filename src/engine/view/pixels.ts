// Pixel-art drawing primitives on a Phaser Graphics: rounded rows, bevelled bars and buttons, glossy bricks, icons.
import type Phaser from 'phaser';
import { HUD_ICONS } from '../art';
import { cornerInset } from '../chrome';
import { MINI_ICONS } from './icons';
import { clamp01, INK, mix, WHITE, type Rect } from './shared';

/** UI ramps, dark to light: the navy of every panel, and the gold of their trims. */
/** The plates' ink (L7/L8: deep ink, a step darker and less purple than the round-6 navy). */
export const NAVY = [0x07060c, 0x0d0b16, 0x13101f, 0x191529, 0x211c34, 0x2e2746, 0x4a4166, 0x72698e] as const;
/** Trim gold (L8: antique brass, not candy gold; reward text keeps its own 0xffe680). */
export const GOLD = [0x4a2c10, 0x7e5018, 0xb47e2a, 0xd8aa4c, 0xf0d896] as const;

/** L8 (docs/art-style.md section 0): a colour worn, as a material that has been used: `desat` of the way to its own
 *  grey, then `k` of the way to the mood's deep cool ink. For the overlays' rarity faces, rays and blooms (candy
 *  rarity colours read as plastic at full strength). */
export function worn(c: number, k = 0.2, desat = 0.3): number {
  const r = (c >> 16) & 255;
  const gr = (c >> 8) & 255;
  const b = c & 255;
  const l = 0.299 * r + 0.587 * gr + 0.114 * b;
  const ch = (v: number, ink: number) => Math.round((v + (l - v) * desat) * (1 - k) + ink * k);
  return (ch(r, 0x16) << 16) | (ch(gr, 0x14) << 8) | ch(b, 0x26);
}

/** A face [hi, base, lo, deep] worn (worn()). */
export const wornFace = <F extends readonly number[]>(f: F, k = 0.2, desat = 0.3): [number, number, number, number] =>
  [worn(f[0], k, desat), worn(f[1], k, desat), worn(f[2], k, desat), worn(f[3], k, desat)];
/** Gauge fills [hi, base, lo, deep]. */
export const RAMP = {
  hp: [0xc8ff8a, 0x62d444, 0x2e9a34, 0x1a6a2a],
  hpLow: [0xffd0a0, 0xff6a3a, 0xc02a2a, 0x7a1220],
  foe: [0xffb0a0, 0xf0503c, 0xb0242c, 0x6a0f1e],
  boss: [0xffd0ff, 0xc060f0, 0x7a2ab8, 0x4a1478],
  gold: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14],
} as const;

type G = Phaser.GameObjects.Graphics;

/** Rounded rectangle drawn row by row (pixel-art corners). */
export function rows(g: G, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  for (let i = 0; i < h; i++) {
    const k = cornerInset(i, h, r);
    if (k === 0) {
      // the straight middle in one rect (same pixels, far fewer draw commands)
      let j = i + 1;
      while (j < h && cornerInset(j, h, r) === 0) j++;
      if (w > 0) g.fillRect(x, y + i, w, j - i);
      i = j - 1;
    } else if (w - k * 2 > 0) g.fillRect(x + k, y + i, w - k * 2, 1);
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

/** Fill rows i0..i1-1 of a rounded w x h box (corner insets respected). */
export function band(g: G, x: number, y: number, w: number, h: number, r: number, i0: number, i1: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  const end = Math.min(h, i1);
  for (let i = Math.max(0, i0); i < end; i++) {
    const k = cornerInset(i, h, r);
    if (k === 0) {
      let j = i + 1;
      while (j < end && cornerInset(j, h, r) === 0) j++;
      if (w > 0) g.fillRect(x, y + i, w, j - i);
      i = j - 1;
    } else if (w - k * 2 > 0) g.fillRect(x + k, y + i, w - k * 2, 1);
  }
}

export interface PanelOpts {
  alpha?: number;
  r?: number;
  /** A gold line just inside the top edge (true) or all round ('full'). */
  trim?: boolean | 'full';
  shadow?: boolean;
  /** Body tones, top to bottom, and the bevel (light top/left edge). */
  tones?: readonly [number, number, number];
  bevel?: number;
  /** Outline color (ink by default; a colored rim for highlighted panels). */
  rim?: number;
}

/**
 * The game's panel: drop shadow, ink outline, a body that is lighter on top and darker at the bottom, a 1 px
 * light bevel on the top and left edges, a dark bottom edge and (optionally) a gold trim line.
 */
export function panel(g: G, r: Rect, o: PanelOpts = {}): void {
  const a = o.alpha ?? 1;
  const rad = o.r ?? 3;
  const { x, y, w, h } = r;
  const [top, mid, bot] = o.tones ?? [NAVY[4], NAVY[3], NAVY[2]];
  if (o.shadow !== false) rows(g, x - 1, y + 2, w + 2, h + 1, rad, INK, 0.5 * a);
  rows(g, x - 1, y - 1, w + 2, h + 2, rad, o.rim ?? INK, a);
  const ir = Math.max(1, rad - 1);
  rows(g, x, y, w, h, ir, mid, a);
  const th = Math.max(2, Math.round(h * 0.4));
  band(g, x, y, w, h, ir, 0, th, top, a);
  band(g, x, y, w, h, ir, h - Math.max(2, Math.round(h * 0.25)), h, bot, a);
  // bevel: light top row and left column, dark bottom row and right column
  const bev = o.bevel ?? NAVY[6];
  band(g, x, y, w, h, ir, 0, 1, bev, a);
  g.fillStyle(mix(bev, top, 0.45), a);
  g.fillRect(x, y + ir + 1, 1, h - ir * 2 - 2);
  band(g, x, y, w, h, ir, h - 1, h, NAVY[0], a);
  g.fillStyle(NAVY[1], a);
  g.fillRect(x + w - 1, y + ir + 1, 1, h - ir * 2 - 2);
  if (o.trim) {
    g.fillStyle(GOLD[2], a);
    g.fillRect(x + 3, y + 2, w - 6, 1);
    if (o.trim === 'full') {
      g.fillRect(x + 3, y + h - 3, w - 6, 1);
      g.fillRect(x + 2, y + 3, 1, h - 6);
      g.fillRect(x + w - 3, y + 3, 1, h - 6);
      g.fillStyle(GOLD[4], a);
      for (const [px, py] of [
        [x + 2, y + 2],
        [x + w - 3, y + 2],
        [x + 2, y + h - 3],
        [x + w - 3, y + h - 3],
      ])
        g.fillRect(px, py, 1, 1);
    }
  }
}

/** A dark inset well (holds a gauge, a value, an icon): inner shadow on top, a faint light lip at the bottom. */
export function well(g: G, x: number, y: number, w: number, h: number, r = 2, fill: number = NAVY[0], alpha = 1): void {
  rows(g, x, y, w, h, r, fill, alpha);
  band(g, x, y, w, h, r, 0, 1, INK, alpha);
  band(g, x, y, w, h, r, h - 1, h, NAVY[3], alpha * 0.9);
}

export interface GaugeOpts {
  ramp?: readonly [number, number, number, number];
  /** Drains toward the left end (enemy bars fill from the right). */
  mirror?: boolean;
  /** Pixels between segment notches (0 = none). */
  seg?: number;
  /** 0..1: the fill brightens (low HP pulse, a full meter). */
  glow?: number;
  ghostCol?: number;
  trough?: number;
}

/**
 * A chunky gauge (HP, meters): ink outline, dark trough with an inner shadow, a lagging "ghost" of recent loss,
 * a 4-tone fill with a shine line, segment notches and a bright cap at the fill's end. x, y, w, h = the trough.
 */
export function gauge(g: G, x: number, y: number, w: number, h: number, frac: number, ghost: number, o: GaugeOpts = {}): void {
  rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK);
  g.fillStyle(o.trough ?? 0x1c1228, 1);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x0c0614, 1);
  g.fillRect(x, y, w, 1);
  g.fillStyle(0x2e2040, 1);
  g.fillRect(x, y + h - 1, w, 1);
  const fw = Math.round(w * clamp01(frac));
  const gw = Math.round(w * clamp01(ghost));
  const at = (len: number) => (o.mirror ? x + w - len : x);
  if (gw > fw) {
    g.fillStyle(o.ghostCol ?? 0xfff2c8, 1);
    g.fillRect(o.mirror ? at(gw) : x + fw, y, gw - fw, h);
  }
  if (fw <= 0) return;
  const [hi, base, lo, deep] = o.ramp ?? RAMP.hp;
  const fx = at(fw);
  g.fillStyle(base, 1);
  g.fillRect(fx, y, fw, h);
  g.fillStyle(hi, 1);
  g.fillRect(fx, y, fw, Math.max(1, Math.floor(h * 0.3)));
  if (h >= 5) {
    g.fillStyle(lo, 1);
    g.fillRect(fx, y + h - 2, fw, 1);
  }
  g.fillStyle(deep, 1);
  g.fillRect(fx, y + h - 1, fw, 1);
  // shine: a bright line along the top, broken near the ends
  if (fw > 4) {
    g.fillStyle(WHITE, 0.55);
    g.fillRect(fx + 1, y + 1, fw - 3, 1);
  }
  if (o.seg && o.seg >= 3) {
    g.fillStyle(deep, 0.6);
    for (let sx = o.seg; sx < w; sx += o.seg) {
      const px = o.mirror ? x + w - sx : x + sx;
      if (px > fx && px < fx + fw - 1) g.fillRect(px, y + 2, 1, h - 3);
    }
  }
  // bright cap at the moving end
  g.fillStyle(WHITE, 0.75);
  g.fillRect(o.mirror ? fx : fx + fw - 1, y, 1, h - 1);
  if (o.glow && o.glow > 0) {
    g.fillStyle(WHITE, 0.45 * clamp01(o.glow));
    g.fillRect(fx, y, fw, h);
  }
}

/** A soft rectangular glow (stacked translucent rounded rects) around r. */
export function glow(g: G, r: Rect, color: number, alpha: number, spread = 3): void {
  for (let i = spread; i >= 1; i--) rows(g, r.x - i, r.y - i, r.w + i * 2, r.h + i * 2, Math.min(4, i + 1), color, (alpha * (spread + 1 - i)) / (spread + 1) / 2);
}

/** Chevron pointing right (dir 1) or left (-1), h rows tall, 2 px thick, with an optional ink rim. */
export function chevron(g: G, x: number, y: number, h: number, color: number, alpha = 1, dir = 1, ink = true): void {
  const half = Math.floor(h / 2);
  if (ink) {
    g.fillStyle(INK, alpha);
    for (let i = 0; i < h; i++) {
      const d = half - Math.abs(i - half);
      g.fillRect((dir > 0 ? x + d : x - d) - 1, y + i - 1, 4, 3);
    }
  }
  g.fillStyle(color, alpha);
  for (let i = 0; i < h; i++) {
    const d = half - Math.abs(i - half);
    g.fillRect(dir > 0 ? x + d : x - d, y + i, 2, 1);
  }
}

/** A faceted gem (banked finisher stacks): 7 x 7 inside a 1 px ink rim; lit, or an empty socket. */
export function gem(g: G, x: number, y: number, lit: boolean, col: readonly [number, number, number], alpha = 1): void {
  const span = [
    [2, 4],
    [1, 5],
    [0, 6],
    [0, 6],
    [0, 6],
    [1, 5],
    [2, 4],
  ];
  g.fillStyle(INK, alpha);
  g.fillRect(x + 2, y - 1, 3, 1);
  g.fillRect(x + 2, y + 7, 3, 1);
  span.forEach(([a, b], i) => g.fillRect(x + a - 1, y + i, b - a + 3, 1));
  const [c, hi, lo] = col;
  span.forEach(([a, b], i) => {
    g.fillStyle(lit ? (i < 3 ? c : lo) : i < 2 ? 0x06040c : NAVY[2], alpha);
    g.fillRect(x + a, y + i, b - a + 1, 1);
  });
  if (lit) {
    g.fillStyle(hi, alpha);
    g.fillRect(x + 1, y + 2, 2, 1);
    g.fillRect(x + 2, y + 1, 2, 1);
    g.fillStyle(WHITE, alpha);
    g.fillRect(x + 2, y + 2, 1, 1);
    g.fillStyle(mix(lo, INK, 0.35), alpha);
    g.fillRect(x + 3, y + 5, 2, 1);
  } else {
    g.fillStyle(NAVY[4], alpha);
    g.fillRect(x + 1, y + 5, 5, 1);
    g.fillRect(x + 2, y + 6, 3, 1);
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
 * A chunky button: ink outline, a 2 px slab of its deep color under the face (it reads as a physical key that
 * sinks when pressed), 1 px light rim (white top/left, grey bottom/right), a face that is lighter on top and
 * darker at the bottom, specular dashes and a drop shadow.
 */
export function button3d(g: G, r: Rect, face: readonly [number, number, number, number], pressed = false, rim = true): void {
  const depth = pressed ? 0 : 2;
  const y = r.y + (pressed ? 2 : 0);
  rows(g, r.x - 1, r.y + 3, r.w + 2, r.h + 1, 3, INK, 0.4);
  rows(g, r.x - 1, y - 1, r.w + 2, r.h + 2 + depth, 3, INK);
  if (depth) {
    rows(g, r.x, y + 2, r.w, r.h - 2 + depth, 2, mix(face[3], INK, 0.35));
    g.fillStyle(face[3], 1);
    g.fillRect(r.x + 2, y + r.h, r.w - 4, 1);
  }
  if (rim) {
    // (L8: a worn iron rim, lit on its top and left, not a bright silver one)
    rows(g, r.x, y, r.w, r.h, 2, 0x5e5a66);
    g.fillStyle(0x9c96a0, 1);
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
  // (L8: a narrow lit lip, not a glossy band; one dull glint)
  g.fillStyle(mix(hi, base, 0.45), 1);
  g.fillRect(ix + 1, iy, iw - 2, Math.max(1, Math.min(2, Math.floor(ih * 0.2))));
  g.fillStyle(lo, 1);
  g.fillRect(ix + 1, iy + ih - 3, iw - 2, 2);
  g.fillStyle(deep, 1);
  g.fillRect(ix + 1, iy + ih - 1, iw - 2, 1);
  g.fillStyle(hi, 0.55);
  g.fillRect(ix + iw - 5, iy + 1, 2, 1);
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

const iconDef = (key: string) => HUD_ICONS[key] ?? MINI_ICONS[key];

export function iconSize(key: string): [number, number] {
  const r = iconDef(key).rows;
  return [Math.max(...r.map((s) => s.length)), r.length];
}

/** Each icon as horizontal runs of one color, grouped by color: [color, x, y, w] (built once per icon). */
const iconRuns = new Map<string, Array<[number, number, number, number]>>();
function runsOf(key: string): Array<[number, number, number, number]> {
  let runs = iconRuns.get(key);
  if (runs) return runs;
  const ic = iconDef(key);
  runs = [];
  ic.rows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; ) {
      const col = ic.pal[r[xx]];
      let n = 1;
      while (xx + n < r.length && r[xx + n] === r[xx]) n++;
      if (col !== undefined) runs!.push([col, xx, yy, n]);
      xx += n;
    }
  });
  runs.sort((a, b) => a[0] - b[0]);
  iconRuns.set(key, runs);
  return runs;
}

/** Multi-color HUD icon (see art.ts HUD_ICONS, and the small ones in icons.ts MINI_ICONS). */
export function hudIcon(g: G, key: string, x: number, y: number, scale = 1, alpha = 1): void {
  let cur = -1;
  for (const [col, rx, ry, rw] of runsOf(key)) {
    if (col !== cur) {
      g.fillStyle(col, alpha);
      cur = col;
    }
    g.fillRect(x + rx * scale, y + ry * scale, rw * scale, scale);
  }
}
