// The title's art: the key art itself is painted in art-title-key.ts (registered here); this file makes the logo, generated from GAME_NAME (src/data/brand.ts) so a rename just works: the bold font's letters scaled
// 3x with Scale3x rounding, a gold face with a horizon band, a cream rim light on the top-left edges, a deep extrusion
// toward the bottom right, a 2 px ink outline; a leading article ("The") set small above, flanked by ink flourishes.
//
// Textures: the key art's ('title_key', 'title_quill', 'title_cloud<i>'), 'title_logo' and 'title_logo_shine_<i>' (a
// gleam crossing the letters). Hard pixels only; everything from a seed.
import type Phaser from 'phaser';
import { GAME_NAME } from '../data/brand';
import { glyphMask } from './font';
import { scale2x } from './font-hd';
import { paintKeyArt } from './art-title-key';

export const TITLE_W = 327;
export const TITLE_H = 150;

// ------------------------------------------------------------------ ramps (docs/art-style.md section 2)

const INK = 0x140c1c;
const GOLD = [0x5a3410, 0x9a5a14, 0xd8901c, 0xf2c230, 0xfff0a0];

// ------------------------------------------------------------------ a tiny pixel grid

class Px {
  readonly c: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new Int32Array(w * h).fill(-1);
  }
  in(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): number {
    return this.in(x, y) ? this.c[y * this.w + x] : -1;
  }
  set(x: number, y: number, col: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (this.in(x, y)) this.c[y * this.w + x] = col;
  }
  rect(x: number, y: number, w: number, h: number, col: number): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, col);
  }
  /** To a canvas; `alpha(x, y, col)` gives each pixel's opacity (default opaque). */
  canvas(alpha?: (x: number, y: number, col: number) => number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const col = this.c[y * this.w + x];
        if (col < 0) continue;
        const i = (y * this.w + x) * 4;
        img.data[i] = (col >> 16) & 255;
        img.data[i + 1] = (col >> 8) & 255;
        img.data[i + 2] = col & 255;
        img.data[i + 3] = Math.round(255 * (alpha ? alpha(x, y, col) : 1));
      }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// ------------------------------------------------------------------ seeded noise

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}





// ------------------------------------------------------------------ the logo

interface Mask {
  w: number;
  h: number;
  on: (x: number, y: number) => boolean;
}

/** Scale3x (AdvMAME3x) on a 1-bit mask: 3x, with diagonals rounded instead of stair-stepped blocks. */
function scale3x(m: Mask): Mask {
  const w = m.w * 3;
  const h = m.h * 3;
  const out = new Uint8Array(w * h);
  const g = (x: number, y: number) => (m.on(x, y) ? 1 : 0);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const A = g(x - 1, y - 1);
      const B = g(x, y - 1);
      const C = g(x + 1, y - 1);
      const D = g(x - 1, y);
      const E = g(x, y);
      const F = g(x + 1, y);
      const G = g(x - 1, y + 1);
      const Hh = g(x, y + 1);
      const I = g(x + 1, y + 1);
      let e = [E, E, E, E, E, E, E, E, E];
      if (B !== Hh && D !== F) {
        e = [
          D === B ? D : E,
          (D === B && E !== C) || (B === F && E !== A) ? B : E,
          B === F ? F : E,
          (D === B && E !== G) || (D === Hh && E !== A) ? D : E,
          E,
          (B === F && E !== I) || (Hh === F && E !== C) ? F : E,
          D === Hh ? D : E,
          (D === Hh && E !== I) || (Hh === F && E !== G) ? Hh : E,
          Hh === F ? F : E,
        ];
      }
      for (let k = 0; k < 9; k++) out[(y * 3 + Math.floor(k / 3)) * w + x * 3 + (k % 3)] = e[k];
    }
  return { w, h, on: (x, y) => x >= 0 && y >= 0 && x < w && y < h && out[y * w + x] === 1 };
}

const ARTICLES = ['the', 'a', 'an'];
/** The widest a row of the logo may be (game px) before it steps down a size or splits in two. */
const LOGO_MAX_W = 236;

/** One row of the logo: its text, its scale (3 = the big lettering), and what it is. */
export interface LogoRow {
  text: string;
  scale: 1 | 2 | 3;
  kind: 'article' | 'main' | 'sub';
}

const rowW = (t: string, k: number) => glyphMask(t).w * k;

/**
 * How the name is set: a short leading article ("The") small above; the main words as big as they fit (3x, else
 * 2x, else two even lines at 2x); whatever follows a colon or a dash as a subtitle under them.
 */
export function logoRows(name: string): LogoRow[] {
  let main = name.trim().replace(/\s+/g, ' ');
  let sub: string | null = null;
  const cut = main.search(/:|\s[-\u2013\u2014]\s/);
  if (cut > 0) {
    sub = main.slice(cut + 1).replace(/^[\s:\-\u2013\u2014]+/, '').trim() || null;
    main = main.slice(0, cut).trim();
  }
  const words = main.split(' ');
  let article: string | null = null;
  if (words.length > 1 && ARTICLES.includes(words[0].toLowerCase())) article = words.shift()!;
  main = words.join(' ');
  const rows: LogoRow[] = [];
  let bigScale: 1 | 2 | 3 = 3;
  if (rowW(main, 3) <= LOGO_MAX_W) rows.push({ text: main, scale: 3, kind: 'main' });
  else if (rowW(main, 2) <= LOGO_MAX_W || words.length < 2) {
    bigScale = 2;
    rows.push({ text: main, scale: 2, kind: 'main' });
  } else {
    // two lines, as even as they can be
    bigScale = 2;
    let best = [main, ''];
    let bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const w = Math.max(rowW(a, 1), rowW(b, 1));
      if (w < bestW) {
        bestW = w;
        best = [a, b];
      }
    }
    const k: 1 | 2 = bestW * 2 <= LOGO_MAX_W + 20 ? 2 : 1;
    bigScale = k;
    for (const t of best) rows.push({ text: t, scale: k, kind: 'main' });
  }
  if (article) rows.unshift({ text: article, scale: bigScale === 3 ? 2 : 1, kind: 'article' });
  if (sub) rows.push({ text: sub, scale: rowW(sub, 2) <= LOGO_MAX_W && bigScale === 3 ? 2 : 1, kind: 'sub' });
  return rows;
}

/**
 * Paint the logo for `name` (rows from logoRows). Each row in turn, top to bottom (a lower row stands in front of the
 * one above's extrusion): the extrusion (deep red-brown toward the bottom right, ink at its far end), a 2 px ink
 * outline (1 px at 1x), the gold face with a darker horizon band, a cream rim on the top-left edges, a deep lip on the
 * bottom-right ones. The article and the subtitle get ink rules either side ending in a gold diamond.
 */
function paintLogo(name: string): { cv: HTMLCanvasElement; face: (x: number, y: number) => boolean; w: number; h: number } {
  const rows = logoRows(name).map((r) => {
    const m = glyphMask(r.text);
    const mask = r.scale === 3 ? scale3x(m) : r.scale === 2 ? scale2x(m) : m;
    return { ...r, m: mask, ext: r.scale === 3 ? 5 : r.scale === 2 ? 3 : 2, ol: r.scale === 1 ? 1 : 2 };
  });
  const PAD = 3;
  const FL = 22; // room for the flourishes either side of the article and the subtitle
  const W = Math.max(...rows.map((r) => r.m.w + r.ext + (r.kind === 'main' ? 0 : FL * 2))) + PAD * 2;
  // rows stacked: each one's caps start a little above the last one's extrusion ends (descenders tuck in)
  const places: Array<(typeof rows)[number] & { x: number; y: number }> = [];
  let y = PAD;
  rows.forEach((r, i) => {
    const capH = 7 * r.scale;
    places.push({ ...r, x: Math.round((W - r.ext - r.m.w) / 2), y });
    const next = rows[i + 1];
    y += capH + r.ol + (next ? Math.max(2, next.ol + 1) : r.m.h - capH + r.ext);
  });
  // (room under the lettering for the ink drips)
  const H = y + PAD + 7;
  const p = new Px(W, H);
  const face = new Uint8Array(W * H);
  const EXTC = [0x3a1c18, 0x5a2414, 0x6e2a18, 0x8a3a1c];
  for (const pl of places) {
    const on = (x: number, yy: number) => pl.m.on(x - pl.x, yy - pl.y);
    const near = (x: number, yy: number) => {
      const r = pl.ol;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) <= r + (r > 1 ? 1 : 0) && on(x + dx, yy + dy)) return true;
      return false;
    };
    const x0 = pl.x - 3;
    const y0 = pl.y - 3;
    const x1 = pl.x + pl.m.w + 3;
    const y1 = pl.y + pl.m.h + 3;
    const outline: Array<[number, number]> = [];
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (near(xx, yy)) outline.push([xx, yy]);
    // the flourishes: ink rules either side, a gold diamond at their outer end
    if (pl.kind !== 'main' && pl.m.w + FL * 2 <= W) {
      const cy = pl.y + Math.round((7 * pl.scale) / 2) - 1;
      for (const side of [-1, 1]) {
        const xs = side < 0 ? pl.x - 4 : pl.x + pl.m.w + 3;
        for (let k = 0; k < 16; k++) {
          const xx = xs + side * k;
          p.set(xx, cy, INK);
          p.set(xx, cy + 1, k < 12 ? GOLD[1] : INK);
          p.set(xx, cy + 2, INK);
        }
        const dx = xs + side * 17;
        for (const [ax, ay, c] of [
          [0, -2, INK],
          [-1, -1, INK],
          [0, -1, GOLD[4]],
          [1, -1, INK],
          [-2, 0, INK],
          [-1, 0, GOLD[3]],
          [0, 0, GOLD[3]],
          [1, 0, GOLD[2]],
          [2, 0, INK],
          [-1, 1, INK],
          [0, 1, GOLD[1]],
          [1, 1, INK],
          [0, 2, INK],
        ] as const)
          p.set(dx + ax, cy + 1 + ay, c);
      }
    }
    for (let d = pl.ext + 1; d >= 1; d--)
      for (const [xx, yy] of outline) p.set(xx + Math.round(d * 0.6), yy + d, d >= pl.ext ? INK : EXTC[Math.min(EXTC.length - 1, d - 1)]);
    for (const [xx, yy] of outline) p.set(xx, yy, INK);
    const capH = 7 * pl.scale;
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) {
        if (!on(xx, yy)) continue;
        const v = (yy - pl.y) / capH;
        let col = v < 0.18 ? GOLD[4] : v < 0.5 ? GOLD[3] : v < 0.58 ? GOLD[2] : v < 0.8 ? GOLD[3] : v < 1.02 ? GOLD[2] : GOLD[1];
        if (pl.scale === 1) col = v < 0.4 ? GOLD[4] : v < 1 ? GOLD[3] : GOLD[2];
        if (!on(xx, yy - 1) || !on(xx - 1, yy)) col = v < 0.55 ? 0xfffbe0 : GOLD[4];
        else if (!on(xx, yy + 1) || !on(xx + 1, yy)) col = v < 0.55 ? GOLD[2] : GOLD[1];
        else if (!on(xx - 1, yy - 1)) col = GOLD[4];
        p.set(xx, yy, col);
        if (p.in(xx, yy)) face[yy * W + xx] = 1;
      }
  }
  // ink drips running off the bottom of the main lettering: the Atlas's ink, still wet
  for (const pl of places) {
    if (pl.kind !== 'main') continue;
    for (let k = 0; k < 8; k++) {
      const xx = pl.x + Math.round(((k + 0.5) / 8) * pl.m.w + (hash(k, 1, 701) - 0.5) * 8);
      let yb = -1;
      for (let yy = H - 1; yy >= 0; yy--)
        if (p.get(xx, yy) === INK && p.get(xx + 1, yy) === INK) {
          yb = yy;
          break;
        }
      if (yb < 0 || hash(k, 2, 701) < 0.35) continue;
      const len = 2 + Math.floor(hash(k, 3, 701) * 4);
      for (let d = 1; d <= len; d++) p.set(xx, yb + d, INK);
      p.rect(xx, yb + len, 2, 2, INK);
      p.set(xx, yb + len, 0x4a3a5e);
    }
  }
  return { cv: p.canvas(), face: (x, y) => x >= 0 && y >= 0 && x < W && y < H && face[y * W + x] === 1, w: W, h: H };
}

// ------------------------------------------------------------------ build

const SHINE_N = 14;

function addCanvas(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

/** Paint the title's textures once (the key art, the logo and its gleam). Returns the gleam's frame count. */
export function buildTitleArt(scene: Phaser.Scene, name = GAME_NAME): number {
  // the key art (art-title-key.ts): painted once
  if (!scene.textures.exists('title_key')) for (const [k, cv] of Object.entries(paintKeyArt())) addCanvas(scene, k, cv);
  const logo = paintLogo(name);
  addCanvas(scene, 'title_logo', logo.cv);
  for (let i = 0; i < SHINE_N; i++) {
    const p = new Px(logo.w, logo.h);
    const pos = -20 + ((logo.w + 30) * i) / (SHINE_N - 1);
    for (let y = 0; y < logo.h; y++)
      for (let x = 0; x < logo.w; x++) {
        if (!logo.face(x, y)) continue;
        const u = x + y * 0.6 - pos;
        if (u >= 0 && u < 7) p.set(x, y, 0xffffff);
      }
    addCanvas(scene, `title_logo_shine_${i}`, p.canvas((x, y) => {
      const u = x + y * 0.6 - pos;
      return u < 2 || u >= 5 ? 0.5 : 0.9;
    }));
  }
  return SHINE_N;
}
