// The three hero chests re-painted on the sharper reveal's finer grid (view/chest-hd.ts; docs/art-style.md still holds
// for every pixel): 4x the detail of the big chest the old reveal shows at 2x (art-chests.ts), the same footprint (98
// x 92 game px = 196 x 184 fine px at k = 2). Planks with grain, knots and joints; gold bands with domed rivets; a
// heraldic crest with a silver sword; lacquer with a gloss streak, faceted crystals and gems; violet scales, laurel and
// rubies. Light from the top left, hue-shifted ramps, interior lines in each material's darkest tone, a 1 fine-px ink
// outline round each part. Painted once, on the first reveal that needs them (a few ms), never at boot.
//
//   hdChest(kind)  { base, lid, gap, leakL[0..2], leakB[0..2] }: canvases HD_CHEST.w x HD_CHEST.h, all lined up (draw
//                  each with its bottom centre at the chest's foot). The base has the open mouth painted where the lid
//                  sits; the gap and leaks are white masks (no outline: tint them, draw them additively): the light in
//                  the mouth, and light leaking from the seam, then cracks spreading over the lid (L) and the box (B).
import type { HeroChestKind } from './art-chests';

/** The big chest on the fine grid: its canvas, the seam (the base's top rim), the lid's centre (to spin it), the
 *  mouth's top. (BIG_CHEST x 4.) */
export const HD_CHEST = { w: 196, h: 184, seam: 108, lidCy: 76, mouth: 92 } as const;

const W = HD_CHEST.w;
const H = HD_CHEST.h;
const X0 = 12;
const X1 = 183;
const BT = HD_CHEST.seam;
const BB = H - 2;
const LT = 48;
const MOUTH = 16;
const CX = (X0 + X1) / 2;

const INK = '#140c1c';

// ------------------------------------------------------------------ ramps (dark -> light, hue-shifted)

const OAK = ['#1c0c0c', '#341810', '#4e2616', '#6a361c', '#884a24', '#a6602e', '#c27c3e', '#da9c58', '#eebc7c'];
const GOLD = ['#3e2210', '#6e3c12', '#a4621a', '#d08c24', '#eeb63a', '#ffd866', '#fff0a8', '#fffbe0'];
const BLUE = ['#0c1840', '#14306e', '#1e4ea8', '#2c74d8', '#4aa0f0', '#8ccaff', '#d0ecff'];
const STEEL = ['#1e2236', '#363e5c', '#58628a', '#8a96b8', '#bcc6dc', '#e6edf7', '#ffffff'];
const LEATHER = ['#2a1210', '#4a2218', '#6e3a24', '#8e5434'];
const LACQ = ['#060a1c', '#0c1432', '#14204e', '#1c306e', '#26448e', '#3260b4', '#4a80d8', '#76a6f0'];
const CRYSTAL = ['#0a2260', '#1446a8', '#2478e0', '#4ab0ff', '#94dcff', '#d2f4ff', '#ffffff'];
const VIOLET = ['#120824', '#22103e', '#361a5e', '#4e2682', '#6834a8', '#844ccc', '#a46ce6', '#c698f8', '#e2c4ff'];
const RUBY = ['#2e0620', '#5a0e3c', '#901c5e', '#c8327e', '#ec5ea6', '#ff9ccc', '#ffe0f0'];
const LEAF = ['#123018', '#1e4a1e', '#2e6a26', '#4a8e30', '#78b440', '#b0d868'];

// ------------------------------------------------------------------ a small raster

class Pix {
  readonly c: Array<string | null>;
  constructor(
    readonly w = W,
    readonly h = H,
  ) {
    this.c = new Array<string | null>(w * h).fill(null);
  }
  set(x: number, y: number, col: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col;
  }
  get(x: number, y: number): string | null {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null;
  }
  has(x: number, y: number): boolean {
    return this.get(x, y) !== null;
  }
  /** Paint the pixels `on` reports with `col(x, y)` (inside the rect x0..x1, y0..y1). */
  fill(x0: number, y0: number, x1: number, y1: number, on: (x: number, y: number) => boolean, col: (x: number, y: number) => string | null): void {
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(this.w - 1, Math.ceil(x1)); x++) {
        if (!on(x, y)) continue;
        const c = col(x, y);
        if (c) this.c[y * this.w + x] = c;
      }
  }
}

const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  let v = rgbCache.get(c);
  if (!v) {
    const n = parseInt(c.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(c, v);
  }
  return v;
}

/** A raster to a canvas, with a 1 px ink outline round its filled pixels (4-neighbourhood). */
function toCanvas(p: Pix, outline = true): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = p.w;
  c.height = p.h;
  const ctx = c.getContext('2d')!;
  const im = ctx.createImageData(p.w, p.h);
  const ink = rgb(INK);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const col = p.get(x, y);
      let v: [number, number, number] | null = col ? rgb(col) : null;
      if (!v && outline && (p.has(x - 1, y) || p.has(x + 1, y) || p.has(x, y - 1) || p.has(x, y + 1))) v = ink;
      if (!v) continue;
      const i = (y * p.w + x) * 4;
      im.data[i] = v[0];
      im.data[i + 1] = v[1];
      im.data[i + 2] = v[2];
      im.data[i + 3] = 255;
    }
  ctx.putImageData(im, 0, 0);
  return c;
}

/** A white mask: alpha from `on` (true = 1). */
function maskCanvas(on: (x: number, y: number) => number | boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const im = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = on(x, y);
      if (!v) continue;
      const i = (y * W + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
      im.data[i + 3] = Math.round((v === true ? 1 : v) * 255);
    }
  ctx.putImageData(im, 0, 0);
  return c;
}

// ------------------------------------------------------------------ tone helpers

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** A deterministic hash in [0, 1). */
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const clampI = (v: number, n: number) => Math.max(0, Math.min(n - 1, v));
/** The ramp's tone at v with an ordered dither between neighbouring tones (big soft gradients only). */
const dtone = (r: readonly string[], v: number, x: number, y: number, amt = 0.8) => r[clampI(Math.floor(v * r.length + (bayer(x, y) - 0.5) * amt), r.length)];

/** Stamp rows of a pattern (`.` = none) with a palette. */
function stamp(p: Pix, rows: string[], pal: Record<string, string>, ox: number, oy: number): void {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (col) p.set(ox + x, oy + y, col);
    }
  });
}

/** A domed rivet (r 2..3): a highlight top-left, a dark rim bottom-right. */
function rivet(p: Pix, cx: number, cy: number, ramp: readonly string[], r = 2.6): void {
  const n = ramp.length;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const lit = (-dx - dy) / (r * 1.6);
      let v = 0.55 + lit * 0.4;
      if (d > r - 1) v -= 0.25; // its rim
      p.set(x, y, ramp[clampI(Math.floor(v * n), n)]);
    }
  p.set(Math.round(cx - r * 0.4), Math.round(cy - r * 0.45), ramp[n - 1]);
}

/** A faceted gem as a rhombus: four facets (lit top-left), a table, a dark girdle line. */
function rhombusGem(p: Pix, cx: number, cy: number, rx: number, ry: number, ramp: readonly string[], rim?: string): void {
  const n = ramp.length;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.abs(dx) / rx + Math.abs(dy) / ry;
      if (d > 1) continue;
      let i: number;
      if (d > 1 - 1.6 / Math.min(rx, ry)) i = 0;
      else if (d < 0.38) i = n - 2;
      else if (dx <= 0 && dy <= 0) i = n - 3;
      else if (dx > 0 && dy <= 0) i = n - 4;
      else if (dx <= 0) i = n - 5;
      else i = 1;
      p.set(x, y, i === 0 && rim ? rim : ramp[clampI(i, n)]);
    }
  p.set(Math.round(cx - rx * 0.35), Math.round(cy - ry * 0.4), ramp[n - 1]);
}

/** A round cabochon (a polished dome): lit top-left, a bright spark, a dark rim. */
function cabochon(p: Pix, cx: number, cy: number, rx: number, ry: number, ramp: readonly string[]): void {
  const n = ramp.length;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      let v = 0.5 + (-dx * 0.5 - dy * 0.6) * 0.45 + (1 - d) * 0.15;
      if (d > 0.82) v = 0.12; // the rim in shadow
      p.set(x, y, ramp[clampI(Math.floor(v * n), n)]);
    }
  p.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.45), ramp[n - 1]);
  p.set(Math.round(cx - rx * 0.4) + 1, Math.round(cy - ry * 0.45), ramp[n - 2]);
}

/** A horizontal rim (a moulding): `profile` = ramp indices from its top row down, darker toward the right. */
function rim(p: Pix, x0: number, x1: number, y0: number, profile: number[], ramp: readonly string[], inside?: (x: number, y: number) => boolean): void {
  profile.forEach((ti, i) => {
    const y = y0 + i;
    for (let x = x0; x <= x1; x++) {
      if (inside && !inside(x, y)) continue;
      const right = (x - x0) / Math.max(1, x1 - x0);
      let t = ti - (right > 0.86 ? 1 : 0) + (x - x0 < 2 ? 1 : 0);
      // a specular dash on the bright rows, toward the left
      if (i <= 1 && right < 0.5 && (x + i * 3) % 23 < 9 && ti >= ramp.length - 3) t = ramp.length - 1;
      p.set(x, y, ramp[clampI(t, ramp.length)]);
    }
  });
}

/** A vertical metal band (strap): ramp indices across its width (lit left edge, shaded right). */
function band(p: Pix, bx: number, profile: number[], y0: number, y1: number, ramp: readonly string[], inside: (x: number, y: number) => boolean): void {
  for (let y = y0; y <= y1; y++)
    profile.forEach((ti, i) => {
      const x = bx + i;
      if (!inside(x, y)) return;
      const down = (y - y0) / Math.max(1, y1 - y0);
      p.set(x, y, ramp[clampI(ti - (down > 0.85 ? 1 : 0), ramp.length)]);
    });
}

/** The cast shadow a raised band leaves on the face beside it (its right side), darkening what's there. */
function castShadow(p: Pix, x: number, y0: number, y1: number, darker: (c: string) => string): void {
  for (let y = y0; y <= y1; y++) {
    const c = p.get(x, y);
    if (c) p.set(x, y, darker(c));
  }
}
/** The next darker tone of whichever ramp `c` belongs to. */
function darkerIn(...ramps: Array<readonly string[]>): (c: string) => string {
  return (c) => {
    for (const r of ramps) {
      const i = r.indexOf(c);
      if (i >= 0) return r[Math.max(0, i - 1)];
    }
    return c;
  };
}

// ------------------------------------------------------------------ wood

/** Wood grain: a few long wavy streaks per plank (darker, the odd lighter one), deterministic. */
function grainAt(x: number, y: number, top: number, ph: number, seed: number): number {
  for (let j = 0; j < 4; j++) {
    const h0 = hash(j, top, seed);
    const yy = top + 2 + h0 * (ph - 5) + 1.3 * Math.sin(x / (15 + j * 6) + h0 * 9) + 0.8 * Math.sin(x / 7.3 + j);
    if (Math.round(yy) !== y) continue;
    const xs = X0 + hash(j, top, seed + 1) * 90;
    const len = 50 + hash(j, top, seed + 2) * 110;
    if (x < xs || x > xs + len) continue;
    return j === 3 ? 0.05 : -0.09;
  }
  return 0;
}

/** Horizontal planks over a face: a lit top row, grain, a shadow row and a dark seam; board ends (joints); knots. */
function planks(p: Pix, x0: number, x1: number, y0: number, y1: number, ph: number, seed: number, inside: (x: number, y: number) => boolean, light: (x: number, y: number) => number): void {
  const n = OAK.length;
  for (let y = y0; y <= y1; y++) {
    const j = Math.floor((y - y0) / ph);
    const r = (y - y0) % ph;
    const top = y0 + j * ph;
    const jx = Math.round(x0 + 20 + hash(j, 3, seed) * (x1 - x0 - 40));
    const knotX = x0 + 24 + hash(j, 5, seed) * (x1 - x0 - 48);
    const knot = hash(j, 7, seed) < 0.45;
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      let v = light(x, y) - (r / ph) * 0.05;
      if (r === ph - 1) v = 0.08;
      else if (r === 0) v += 0.12;
      else if (r === ph - 2) v -= 0.1;
      else {
        v += grainAt(x, y, top, ph, seed);
        if (knot) {
          const kd = Math.hypot((x - knotX) / 4.5, (y - (top + ph / 2)) / 2.4);
          if (kd < 1) v = kd < 0.45 ? v + 0.04 : v - 0.2;
          else if (kd < 1.5) v -= 0.06;
        }
      }
      // a board's end: a dark joint and its lit far edge
      if (r !== ph - 1) {
        if (x === jx) v = 0.1;
        else if (x === jx + 1) v += 0.1;
      }
      p.set(x, y, OAK[clampI(Math.floor(v * n), n)]);
    }
  }
}

// ------------------------------------------------------------------ parts every chest shares

interface Parts {
  base: Pix;
  lid: Pix;
  /** Where light leaks first (the keyhole's middle). */
  key: [number, number];
}

const inBox = (x: number, y: number) => x >= X0 && x <= X1 && y >= BT && y <= BB;

/** The open mouth over the base's rim (seen a little from above): the back rim, the back wall, the floor in shadow. */
function paintMouth(p: Pix, rimRamp: readonly string[], wall: readonly string[], dark: string, x0 = X0, x1 = X1): void {
  const top = BT - MOUTH;
  rim(p, x0, x1, top, [rimRamp.length - 2, rimRamp.length - 4, 1], rimRamp);
  const n = wall.length;
  for (let y = top + 3; y < BT; y++)
    for (let x = x0; x <= x1; x++) {
      const k = (y - top - 3) / (BT - top - 3);
      let v = 0.42 - k * 0.38 - ((x - x0) / (x1 - x0)) * 0.1;
      if ((y - top) % 6 === 2) v -= 0.08; // boards on the back wall
      let c = wall[clampI(Math.floor(v * n), n)];
      if (y >= BT - 3) c = dark;
      if (x <= x0 + 2) c = wall[clampI(3, n)];
      else if (x <= x0 + 5) c = wall[2];
      else if (x >= x1 - 2) c = wall[1];
      else if (x >= x1 - 5) c = wall[0];
      p.set(x, y, c);
    }
}

// ------------------------------------------------------------------ the hero chest: oak, gold bands, a crest

const BANDS_HERO: Array<[number, number]> = [
  [X0 + 28, 16],
  [X1 - 43, 16],
];
const BAND_PROFILE = [5, 6, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2, 1, 0];

function heroChest(): Parts {
  const base = new Pix();
  const lid = new Pix();
  const light = (x: number, y: number, y0: number, y1: number, b: number) => b - ((x - X0) / (X1 - X0)) * 0.24 - ((y - y0) / (y1 - y0)) * 0.08 + (x <= X0 + 1 ? 0.14 : 0) - (x >= X1 - 2 ? 0.16 : 0);
  // ---- the base: planks between gold rims, two gold bands, corner caps, a lock plate
  planks(base, X0, X1, BT + 7, BB - 9, 16, 11, inBox, (x, y) => light(x, y, BT, BB, 0.66));
  rim(base, X0, X1, BT, [6, 5, 4, 4, 3, 2, 1], GOLD);
  rim(base, X0, X1, BB - 8, [5, 4, 4, 3, 3, 3, 2, 1, 1], GOLD);
  const darker = darkerIn(OAK, GOLD);
  for (const [bx, bw] of BANDS_HERO) {
    band(base, bx, BAND_PROFILE, BT + 7, BB - 9, GOLD, inBox);
    castShadow(base, bx + bw, BT + 7, BB - 9, darker);
    castShadow(base, bx + bw + 1, BT + 7, BB - 9, darker);
    for (let y = BT + 13; y < BB - 12; y += 13) rivet(base, bx + bw / 2, y, GOLD, 2.8);
  }
  // corner caps: gold gussets on the bottom corners, a rivet in each
  for (const side of [-1, 1]) {
    const cx0 = side < 0 ? X0 : X1;
    base.fill(X0, BB - 26, X1, BB, (x, y) => {
      const d = Math.abs(x - cx0) + (BB - y);
      return d <= 24 && (side < 0 ? x <= X0 + 24 : x >= X1 - 24);
    }, (x, y) => {
      const d = Math.abs(x - cx0) + (BB - y);
      if (d >= 23) return GOLD[1];
      if (d >= 21) return GOLD[side < 0 ? 5 : 3];
      return GOLD[side < 0 ? (y > BB - 2 ? 2 : 4) : y > BB - 2 ? 1 : 3];
    });
    rivet(base, cx0 + side * -7, BB - 7, GOLD, 2.6);
  }
  // the lock plate the hasp closes over: bevelled, a recessed face, a keyhole
  const lx = Math.round(CX - 14);
  const ly = BT + 10;
  base.fill(lx, ly, lx + 28, ly + 24, (x, y) => {
    const dx = Math.min(x - lx, lx + 28 - x);
    const dy = Math.min(y - ly, ly + 24 - y);
    return dx + dy >= 3;
  }, (x, y) => {
    const dx0 = x - lx;
    const dx1 = lx + 28 - x;
    const dy0 = y - ly;
    const dy1 = ly + 24 - y;
    const m = Math.min(dx0, dx1, dy0, dy1);
    if (m === 0 || dx0 + dy0 === 3 || dx1 + dy1 === 3 || dx0 + dy1 === 3 || dx1 + dy0 === 3) return GOLD[0];
    if (m <= 2) return dx0 <= 2 || dy0 <= 2 ? GOLD[m === 1 ? 6 : 5] : GOLD[m === 1 ? 1 : 2];
    if (m === 3) return dx0 === 3 || dy0 === 3 ? GOLD[2] : GOLD[5];
    return GOLD[4 - (dy0 > 14 ? 1 : 0)];
  });
  const kx = Math.round(CX);
  const ky = ly + 10;
  base.fill(kx - 5, ky - 5, kx + 5, ky + 10, (x, y) => Math.hypot(x + 0.5 - kx, y + 0.5 - ky) <= 3.6 || (Math.abs(x + 0.5 - kx) <= 1.6 && y >= ky && y <= ky + 8), () => '#1e0e08');
  base.set(kx + 2, ky + 2, GOLD[6]);
  base.set(kx + 1, ky + 8, GOLD[6]);
  paintMouth(base, GOLD, OAK, '#120606');
  // ---- the lid: a barrel top of curved planks, the bands over it, a gold rim along its front edge
  const rad = 28;
  const inLid = (x: number, y: number) => {
    if (x < X0 || x > X1 || y < LT || y >= BT) return false;
    if (y >= LT + rad) return true;
    const ccx = x < X0 + rad ? X0 + rad : x > X1 - rad ? X1 - rad : x;
    return (x + 0.5 - ccx) ** 2 + (y + 0.5 - (LT + rad)) ** 2 <= rad * rad;
  };
  for (let y = LT; y < BT; y++)
    for (let x = X0; x <= X1; x++) {
      if (!inLid(x, y)) continue;
      const k = (y - LT) / (BT - 1 - LT);
      // the barrel: the crown catches the light, the front face drops into shade; lit left, shaded right
      let v = 0.92 - Math.pow(k, 0.85) * 0.46 - ((x - X0) / (X1 - X0)) * 0.26;
      if (!inLid(x - 1, y) || !inLid(x - 2, y)) v += 0.14;
      else if (!inLid(x, y - 1) || !inLid(x, y - 2)) v += 0.12;
      if (!inLid(x + 1, y) || !inLid(x + 2, y) || !inLid(x + 3, y)) v -= 0.18;
      const r = (y - LT) % 15;
      if (r === 14) v = 0.1;
      else if (r === 0 && inLid(x, y - 1)) v += 0.1;
      else v += grainAt(x, y, LT + Math.floor((y - LT) / 15) * 15, 15, 23);
      lid.set(x, y, dtone(OAK, v, x, y, 0.55));
    }
  // the crown's shine: dashes along the top, toward the light
  for (let x = X0 + 18; x < CX - 6; x++) if ((x * 7) % 31 < 19) for (const dy of [4, 5]) if (inLid(x, LT + dy) && lid.get(x, LT + dy) !== OAK[0]) lid.set(x, LT + dy, dy === 4 ? OAK[8] : OAK[7]);
  for (const [bx, bw] of BANDS_HERO) {
    band(lid, bx, BAND_PROFILE, LT, BT - 1, GOLD, inLid);
    castShadow(lid, bx + bw, LT, BT - 10, darker);
    castShadow(lid, bx + bw + 1, LT, BT - 10, darker);
    for (let y = LT + 10; y < BT - 12; y += 13) if (inLid(bx + bw / 2, y - 3)) rivet(lid, bx + bw / 2, y, GOLD, 2.8);
  }
  rim(lid, X0, X1, BT - 9, [6, 5, 4, 4, 3, 3, 2, 1, 0], GOLD, inLid);
  for (let x = X0 + 10; x <= X1 - 10; x += 19) if (!BANDS_HERO.some(([b, w]) => x >= b - 3 && x < b + w + 3)) rivet(lid, x, BT - 5, GOLD, 2);
  // the crest: a blue heater shield in a gold rim, a silver sword down its middle
  crest(lid, Math.round(CX), LT + 7);
  // the hasp hangs from the lid's rim over the lock plate
  const hx = Math.round(CX - 11);
  const hy = BT - 9;
  lid.fill(hx, hy, hx + 22, hy + 24, (x, y) => {
    const dx = Math.min(x - hx, hx + 22 - x);
    const dy = hy + 24 - y;
    return dx >= 0 && dy >= 0 && dx + dy >= 4 && y >= hy;
  }, (x, y) => {
    const dx0 = x - hx;
    const dx1 = hx + 22 - x;
    const dy1 = hy + 24 - y;
    if (y < hy + 5) return GOLD[[6, 5, 4, 3, 1][y - hy]]; // the hinge's knuckle
    if (dx0 === 0 || dx1 === 0 || dy1 === 0 || dx0 + dy1 === 4 || dx1 + dy1 === 4) return GOLD[0];
    if (dx0 <= 2) return GOLD[5];
    if (dx1 <= 2 || dy1 <= 2) return GOLD[2];
    return GOLD[y > hy + 16 ? 3 : 4];
  });
  lid.fill(Math.round(CX) - 2, hy + 11, Math.round(CX) + 2, hy + 19, () => true, (x, y) => (x === Math.round(CX) + 2 || y === hy + 19 ? GOLD[5] : '#1e0e08'));
  return { base, lid, key: [kx, ky + 3] };
}

/** The hero chest's crest: a heater shield (gold rim, blue field split light and dark) with a silver sword. */
function crest(p: Pix, cx: number, top: number): void {
  const SW = 50;
  const SH = 54;
  const half = (r: number) => {
    const t = r / SH;
    if (t < 0.46) return SW / 2;
    const u = (t - 0.46) / 0.54;
    return (SW / 2) * Math.pow(Math.max(0, 1 - u * u), 0.62);
  };
  const inS = (x: number, y: number, inset: number) => {
    const r = y - top;
    if (r < inset || r > SH - inset * 1.4) return false;
    return Math.abs(x + 0.5 - cx) <= half(r) - inset;
  };
  for (let y = top - 1; y <= top + SH + 1; y++)
    for (let x = cx - SW / 2 - 2; x <= cx + SW / 2 + 2; x++) {
      if (!inS(x, y, 0)) continue;
      const left = x < cx;
      let c: string;
      if (!inS(x, y, 1)) c = OAK[0]; // the dark line where it meets the wood
      else if (!inS(x, y, 4)) {
        // the gold rim, lit on its upper left
        const up = !inS(x, y - 2, 1);
        c = up || left ? GOLD[!inS(x, y, 2) ? 6 : 5] : GOLD[!inS(x, y, 3) ? 1 : 2];
        if (!up && !left && y - top > SH * 0.6) c = GOLD[1];
      } else if (!inS(x, y, 5)) c = BLUE[0];
      else {
        // the field: per pale, the left half lit; a soft diagonal light across it
        const d = (x - cx) / SW + (y - top) / SH;
        let v = left ? 0.68 - d * 0.35 : 0.45 - d * 0.3;
        if (y - top < 9 && left) v += 0.1;
        c = dtone(BLUE, v, x, y, 0.5);
      }
      p.set(x, y, c);
    }
  // the sword, hilt up: a pommel, the grip, a crossguard, then the blade to a point
  const sx = cx;
  const by0 = top + 15;
  const by1 = top + SH - 12;
  // blade (6 px): an edge in the light, the fuller, the shaded edge; it narrows to a point
  for (let y = by0; y <= by1 + 6; y++) {
    const w = y > by1 ? Math.max(1, 3 - Math.floor((y - by1) / 2)) : 3;
    for (let dx = -w; dx < w; dx++) {
      const i = dx + w;
      const span = w * 2;
      const c = i === 0 ? STEEL[6] : i === 1 ? STEEL[5] : i === span - 1 ? STEEL[2] : i === Math.floor(span / 2) ? STEEL[3] : STEEL[4];
      p.set(sx + dx, y, c);
    }
    p.set(sx - w - 1, y, BLUE[0]);
    p.set(sx + w, y, BLUE[0]);
  }
  p.set(sx - 1, by1 + 8, BLUE[0]);
  p.set(sx, by1 + 8, BLUE[0]);
  // crossguard
  for (let y = by0 - 5; y < by0; y++)
    for (let x = sx - 14; x <= sx + 13; x++) {
      const r = y - (by0 - 5);
      const edge = x === sx - 14 || x === sx + 13 || r === 4;
      p.set(x, y, edge ? GOLD[0] : r === 0 ? GOLD[6] : x < sx ? GOLD[5 - (r > 2 ? 1 : 0)] : GOLD[3 - (r > 2 ? 1 : 0)]);
    }
  for (const ex of [sx - 15, sx + 14]) for (let y = by0 - 6; y <= by0; y++) p.set(ex, y, BLUE[0]);
  for (let x = sx - 15; x <= sx + 14; x++) p.set(x, by0 - 6, BLUE[0]);
  // grip with leather wraps
  for (let y = by0 - 12; y < by0 - 5; y++)
    for (let x = sx - 2; x <= sx + 1; x++) p.set(x, y, (y + x) % 3 === 0 ? LEATHER[0] : x < sx ? LEATHER[3] : LEATHER[2]);
  // pommel
  cabochon(p, sx - 0.5, by0 - 15, 3.4, 3.2, GOLD);
}

// ------------------------------------------------------------------ the Rare chest: navy lacquer, silver, crystals

const STRAPS_RARE: Array<[number, number]> = [
  [X0 + 32, 12],
  [X1 - 43, 12],
];
const STRAP_PROFILE = [5, 6, 5, 4, 4, 4, 3, 3, 3, 2, 1, 0];

function rareChest(): Parts {
  const base = new Pix();
  const lid = new Pix();
  const gloss = (x: number, y: number, y0: number) => {
    const d = x - X0 - (y - y0) * 0.8;
    if (d >= 16 && d < 23) return 0.2;
    if (d >= 23 && d < 30) return 0.09;
    if (d >= 40 && d < 43) return 0.1;
    return 0;
  };
  const flat = (x: number, y: number, y0: number, y1: number, b: number) => b - ((x - X0) / (X1 - X0)) * 0.28 - ((y - y0) / Math.max(1, y1 - y0)) * 0.12;
  // ---- the base: lacquer in a silver frame, straps, crystal studs, a crystal lock
  base.fill(X0, BT, X1, BB, inBox, (x, y) => dtone(LACQ, flat(x, y, BT, BB, 0.62) + gloss(x, y, BT), x, y, 0.5));
  const sideTrim = (p: Pix, inside: (x: number, y: number) => boolean, y0: number, y1: number, l: (y: number) => number, r: (y: number) => number) => {
    for (let y = y0; y <= y1; y++) {
      const a = l(y);
      const b = r(y);
      [5, 4, 4, 2].forEach((t, i) => inside(a + i, y) && p.set(a + i, y, STEEL[t]));
      [3, 2, 1, 1].forEach((t, i) => inside(b - 3 + i, y) && p.set(b - 3 + i, y, STEEL[t]));
    }
  };
  sideTrim(base, inBox, BT, BB, () => X0, () => X1);
  const darker = darkerIn(LACQ, STEEL);
  for (const [sx, sw] of STRAPS_RARE) {
    band(base, sx, STRAP_PROFILE, BT, BB, STEEL, inBox);
    castShadow(base, sx + sw, BT + 6, BB - 6, darker);
  }
  rim(base, X0, X1, BT, [6, 5, 4, 3, 2, 1], STEEL);
  rim(base, X0, X1, BB - 6, [4, 4, 3, 3, 2, 1, 0], STEEL);
  // crystal studs where the straps cross the rims, and on the corners
  for (const [sx, sw] of STRAPS_RARE) {
    rhombusGem(base, sx + sw / 2, BT + 3, 5, 5, CRYSTAL, CRYSTAL[0]);
    rhombusGem(base, sx + sw / 2, BB - 3, 5, 5, CRYSTAL, CRYSTAL[0]);
  }
  rhombusGem(base, X0 + 4, BB - 3, 4.5, 4.5, CRYSTAL, CRYSTAL[0]);
  rhombusGem(base, X1 - 4, BB - 3, 4.5, 4.5, CRYSTAL, CRYSTAL[0]);
  // the lock: a bevelled silver plate, a crystal keyhole
  const lx = Math.round(CX - 13);
  const ly = BT + 9;
  base.fill(lx, ly, lx + 26, ly + 28, (x, y) => Math.min(x - lx, lx + 26 - x) + Math.min(y - ly, ly + 28 - y) >= 3, (x, y) => {
    const m = Math.min(x - lx, lx + 26 - x, y - ly, ly + 28 - y);
    const lit = x - lx <= 2 || y - ly <= 2;
    if (m === 0 || Math.min(x - lx, lx + 26 - x) + Math.min(y - ly, ly + 28 - y) === 3) return STEEL[0];
    if (m <= 2) return lit ? STEEL[m === 1 ? 6 : 5] : STEEL[m === 1 ? 1 : 2];
    return STEEL[y - ly > 18 ? 3 : 4];
  });
  rhombusGem(base, CX, ly + 11, 6, 7, CRYSTAL, CRYSTAL[0]);
  base.fill(Math.round(CX) - 1, ly + 18, Math.round(CX) + 1, ly + 24, () => true, () => '#040818');
  paintMouth(base, STEEL, LACQ, '#03050c');
  // ---- the lid: bevelled toward its flat top, the top face catching the light, silver edges, a gem, crystals
  const bev = 16;
  const topRows = 12;
  const inset = (y: number) => Math.round(((BT - 1 - y) / (BT - 1 - LT)) * bev);
  const inLid = (x: number, y: number) => y >= LT && y < BT && x >= X0 + inset(y) && x <= X1 - inset(y);
  for (let y = LT; y < BT; y++)
    for (let x = X0; x <= X1; x++) {
      if (!inLid(x, y)) continue;
      let c: string;
      if (y < LT + topRows) c = dtone(LACQ, 0.95 - ((x - X0) / (X1 - X0)) * 0.32 - (y - LT) * 0.012, x, y, 0.6);
      else c = dtone(LACQ, flat(x, y, LT + topRows, BT - 1, 0.62) + gloss(x, y, LT + topRows), x, y, 0.5);
      // the bevelled sides: silver edges, lit left
      if (!inLid(x - 1, y)) c = STEEL[5];
      else if (!inLid(x - 2, y)) c = STEEL[4];
      else if (!inLid(x - 3, y)) c = STEEL[2];
      else if (!inLid(x + 1, y)) c = STEEL[1];
      else if (!inLid(x + 2, y)) c = STEEL[2];
      lid.set(x, y, c);
    }
  for (let x = X0; x <= X1; x++) {
    if (inLid(x, LT)) lid.set(x, LT, STEEL[x < CX + 20 ? 6 : 4]);
    if (inLid(x, LT + 1)) lid.set(x, LT + 1, STEEL[x < CX + 20 ? 5 : 3]);
    for (const [dy, t] of [
      [0, 4],
      [1, 3],
      [2, 1],
    ] as const)
      if (inLid(x, LT + topRows + dy) && lid.get(x, LT + topRows + dy) !== STEEL[5]) lid.set(x, LT + topRows + dy, STEEL[x > X1 - 20 ? t - 1 : t]);
  }
  for (const [sx, sw] of STRAPS_RARE) {
    band(lid, sx, STRAP_PROFILE, LT + topRows + 3, BT - 1, STEEL, inLid);
    castShadow(lid, sx + sw, LT + topRows + 3, BT - 8, darker);
  }
  rim(lid, X0, X1, BT - 8, [6, 5, 4, 3, 3, 2, 1, 0], STEEL, inLid);
  // silver brackets on the lid's lower corners
  for (const side of [-1, 1]) {
    const ex = side < 0 ? X0 : X1;
    lid.fill(X0, BT - 24, X1, BT - 9, (x, y) => {
      const dx = side < 0 ? x - X0 : X1 - x;
      return inLid(x, y) && ((dx < 18 && y >= BT - 14) || (dx < 7 && y >= BT - 24));
    }, (x, y) => {
      const dx = side < 0 ? x - X0 : X1 - x;
      const edge = (dx === 17 && y >= BT - 14) || (dx === 6 && y < BT - 14) || y === BT - 24 || (y === BT - 14 && dx >= 6);
      if (edge) return STEEL[0];
      return side < 0 ? STEEL[dx < 3 ? 6 : y < BT - 12 ? 5 : 4] : STEEL[dx < 3 ? 2 : 3];
    });
    rivet(lid, ex - side * 3.5, BT - 18, STEEL, 2);
    rivet(lid, ex - side * 12, BT - 11, STEEL, 2);
  }
  // the gem on the lid's face: faceted, in a silver bezel with four prongs
  gemFacets(lid, Math.round(CX), LT + topRows + 18, 15, 11);
  // the crystal cluster growing out of the top
  crystal(lid, Math.round(CX) - 30, LT + 6, 15, 30, -9);
  crystal(lid, Math.round(CX) + 16, LT + 6, 15, 26, 9);
  crystal(lid, Math.round(CX) - 10, LT + 7, 20, 46, 0);
  crystal(lid, Math.round(CX) - 46, LT + 9, 8, 12, -5);
  crystal(lid, Math.round(CX) + 33, LT + 9, 8, 10, 4);
  return { base, lid, key: [Math.round(CX), ly + 13] };
}

/** A faceted oval gem in a silver bezel with four prongs. */
function gemFacets(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  // the bezel
  for (let y = cy - ry - 3; y <= cy + ry + 3; y++)
    for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (rx + 3), (y + 0.5 - cy) / (ry + 3));
      if (d > 1) continue;
      const lit = x + 0.5 < cx || y + 0.5 < cy - ry * 0.5;
      p.set(x, y, d > 0.9 ? STEEL[0] : lit ? STEEL[5] : STEEL[2]);
    }
  // the stone: a table, crown facets lit from the top left, a dark pavilion
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1) continue;
      let i: number;
      if (d > 0.88) i = 0;
      else if (Math.abs(dx) < 0.42 && Math.abs(dy) < 0.36) i = dy < 0 ? 5 : 4; // the table
      else if (dy < -0.3) i = dx < 0 ? 5 : 4;
      else if (dy > 0.3) i = dx < 0 ? 2 : 1;
      else i = dx < 0 ? 4 : 2;
      // facet edges: a line where the table meets the crown
      if (Math.abs(Math.abs(dx) - 0.42) < 0.07 && Math.abs(dy) < 0.36) i = Math.max(1, i - 2);
      p.set(x, y, CRYSTAL[i]);
    }
  p.set(cx - Math.round(rx * 0.5), cy - Math.round(ry * 0.55), CRYSTAL[6]);
  p.set(cx - Math.round(rx * 0.5) + 1, cy - Math.round(ry * 0.55), CRYSTAL[6]);
  p.set(cx - Math.round(rx * 0.5), cy - Math.round(ry * 0.55) + 1, CRYSTAL[5]);
  // prongs at the diagonals
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const px = Math.round(cx + sx * rx * 0.78);
    const py = Math.round(cy + sy * ry * 0.78);
    stamp(p, ['.ab.', 'abbc', 'bbcd', '.cd.'], { a: STEEL[6], b: STEEL[4], c: STEEL[2], d: STEEL[0] }, px - 2, py - 2);
  }
}

/** A crystal: a hexagonal prism (a lit left face, the front, a dark right face) rising to a faceted point, leaning. */
function crystal(p: Pix, x0: number, baseY: number, w: number, h: number, lean: number): void {
  const tipH = Math.round(h * 0.32);
  for (let k = 0; k < h; k++) {
    const y = baseY - k;
    const off = Math.round((k / h) * lean);
    // the prism's width, narrowing to the tip
    const tk = k - (h - tipH);
    const ww = tk > 0 ? Math.max(1, Math.round(w * (1 - tk / tipH))) : w;
    const xs = x0 + off + Math.round((w - ww) / 2);
    const lf = Math.max(1, Math.round(ww * 0.3));
    const rf = Math.max(1, Math.round(ww * 0.25));
    for (let i = 0; i < ww; i++) {
      let t: number;
      if (i === 0) t = 0;
      else if (i === ww - 1) t = 0;
      else if (i < lf) t = 4;
      else if (i === lf) t = 6; // the bright ridge
      else if (i >= ww - rf) t = 1;
      else t = tk > 0 ? 3 : k % 9 === 4 && i < ww / 2 ? 4 : 3; // the front, a glint band now and then
      // the tip's facets: lighter on the left
      if (tk > 0 && i > 0 && i < ww - 1) t = i < ww / 2 ? 5 : 2;
      p.set(xs + i, y, CRYSTAL[t]);
    }
    if (k === h - 1 || ww <= 1) p.set(xs, y, CRYSTAL[6]);
  }
  // a gleam at its heart
  const gx = x0 + Math.round(w * 0.38) + Math.round(0.4 * lean);
  const gy = baseY - Math.round(h * 0.45);
  p.set(gx, gy, CRYSTAL[6]);
  p.set(gx, gy - 1, CRYSTAL[5]);
  p.set(gx, gy + 1, CRYSTAL[5]);
}

// ------------------------------------------------------------------ the region chest: a violet reliquary

function regionChest(): Parts {
  const base = new Pix();
  const lid = new Pix();
  const bb = BB - 8; // the box stands on ball feet
  const inB = (x: number, y: number) => x >= X0 && x <= X1 && y >= BT && y <= bb;
  const pil = 12;
  const strip = 5;
  const cx = Math.round(CX);
  const goldCol = (x: number): string | null => {
    if (x < X0 + pil) return GOLD[[6, 5, 5, 4, 4, 4, 4, 3, 3, 2, 1, 0][x - X0]];
    if (x > X1 - pil) return GOLD[[0, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2, 1][x - (X1 - pil + 1)] ?? 2];
    if (Math.abs(x - cx) <= strip) return GOLD[[0, 5, 5, 4, 4, 4, 3, 3, 2, 1, 0][x - cx + strip]];
    return null;
  };
  // ---- the base: violet panels in gold mouldings, each with an inset frame and a ruby lozenge
  const panels: Array<[number, number]> = [
    [X0 + pil, cx - strip - 1],
    [cx + strip + 1, X1 - pil],
  ];
  base.fill(X0, BT, X1, bb, inB, (x, y) => {
    const g = goldCol(x);
    if (g) return g;
    const v = 0.6 - ((x - X0) / (X1 - X0)) * 0.26 - ((y - BT) / (bb - BT)) * 0.12;
    return dtone(VIOLET, v, x, y, 0.5);
  });
  for (const [pl, pr] of panels) {
    // the inset frame: a gold line and its shadow inside, 6 px in from the panel's edges
    const fl = pl + 6;
    const fr = pr - 6;
    const ft = BT + 13;
    const fb = bb - 10;
    for (let y = ft; y <= fb; y++)
      for (let x = fl; x <= fr; x++) {
        const onEdge = x === fl || x === fr || y === ft || y === fb;
        const inner = x === fl + 1 || y === ft + 1;
        if (onEdge) base.set(x, y, x === fr || y === fb ? GOLD[2] : GOLD[5]);
        else if (inner) base.set(x, y, VIOLET[1]);
      }
    // the lozenge and its ruby, studs in the frame's corners
    const mx = Math.round((pl + pr) / 2);
    const my = Math.round((ft + fb) / 2);
    base.fill(mx - 13, my - 13, mx + 13, my + 13, (x, y) => {
      const d = Math.abs(x + 0.5 - mx) + Math.abs(y + 0.5 - my);
      return d <= 13 && d >= 9.5;
    }, (x, y) => {
      const d = Math.abs(x + 0.5 - mx) + Math.abs(y + 0.5 - my);
      const lit = y + 0.5 < my || (x + 0.5 < mx && Math.abs(y + 0.5 - my) < 2);
      return d > 12.2 || d < 10.2 ? GOLD[1] : lit ? GOLD[5] : GOLD[3];
    });
    cabochon(base, mx, my, 5, 5, RUBY);
    for (const [sx, sy] of [
      [fl + 4, ft + 4],
      [fr - 4, ft + 4],
      [fl + 4, fb - 4],
      [fr - 4, fb - 4],
    ])
      rivet(base, sx, sy, GOLD, 1.8);
  }
  rim(base, X0, X1, BT, [6, 5, 4, 4, 3, 2, 1], GOLD);
  rim(base, X0, X1, bb - 6, [5, 4, 4, 3, 2, 1, 0], GOLD);
  // the lock: a big faceted ruby in a gold mount on the middle strip
  const ly = BT + 9;
  base.fill(cx - 11, ly, cx + 11, ly + 26, (x, y) => Math.min(x - (cx - 11), cx + 11 - x) + Math.min(y - ly, ly + 26 - y) >= 4, (x, y) => {
    const m = Math.min(x - (cx - 11), cx + 11 - x, y - ly, ly + 26 - y);
    if (m === 0 || Math.min(x - (cx - 11), cx + 11 - x) + Math.min(y - ly, ly + 26 - y) === 4) return GOLD[0];
    return x < cx || y < ly + 4 ? GOLD[m <= 2 ? 6 : 5] : GOLD[m <= 2 ? 2 : 3];
  });
  rhombusGem(base, cx, ly + 12, 7.5, 9, RUBY, RUBY[0]);
  // ball feet under the pilasters
  for (const fx of [X0 + pil / 2, X1 - pil / 2]) {
    for (let y = bb + 1; y <= BB; y++)
      for (let x = Math.floor(fx - 9); x <= Math.ceil(fx + 9); x++) {
        const dx = (x + 0.5 - fx) / 9;
        const dy = (y + 0.5 - (bb + 1)) / 8;
        if (dx * dx + dy * dy > 1) continue;
        const v = 0.62 - dx * 0.3 - dy * 0.35;
        base.set(x, y, GOLD[clampI(Math.floor(v * GOLD.length), GOLD.length)]);
      }
    base.set(Math.round(fx - 4), bb + 2, GOLD[7]);
  }
  paintMouth(base, GOLD, VIOLET, '#0a0414');
  // ---- the lid: an arched roof of violet scales under a gold trim, a frieze with beads, a star and a crest
  const half = (X1 - X0) / 2;
  const peak = LT - 8;
  const wall = 20;
  const drop = BT - 1 - wall - peak;
  const topAt = (x: number) => peak + Math.round(drop * Math.pow(Math.abs(x + 0.5 - (X0 + X1 + 1) / 2) / (half + 0.5), 1.7));
  const inLid = (x: number, y: number) => x >= X0 && x <= X1 && y >= topAt(x) && y < BT;
  const VN = VIOLET.length;
  for (let y = peak; y < BT; y++)
    for (let x = X0; x <= X1; x++) {
      if (!inLid(x, y)) continue;
      const t = topAt(x);
      const lx = (x - X0) / (X1 - X0);
      let c: string;
      if (y - t <= 4) c = GOLD[[x < cx + 20 ? 6 : 5, 5, 4, 2, 0][y - t]]; // the gold trim along the roof's edge
      else if (y >= BT - 9) c = GOLD[[6, 5, 4, 4, 3, 3, 2, 1, 0][y - (BT - 9)]]; // the lid's gold foot
      else if (y >= BT - wall) {
        // the frieze: fluted violet with a row of gold beads
        const fy = y - (BT - wall);
        let v = 0.42 - lx * 0.2 + ((x % 6) === 1 ? 0.1 : (x % 6) === 4 ? -0.08 : 0);
        if (fy === 0) v = 0.1;
        c = VIOLET[clampI(Math.floor(v * VN), VN)];
        if (fy >= 3 && fy <= 7) {
          const bx = (x - X0) % 9;
          const by = fy - 3;
          if (bx >= 2 && bx <= 6) {
            const d = Math.hypot(bx - 4, by - 2);
            if (d <= 2.4) c = GOLD[d < 1 ? 6 : bx < 4 || by < 2 ? 5 : 2];
          }
        }
      } else {
        // the scales: rows of rounded tongues, each lit on its upper left with a dark lower edge
        const sy = y - peak;
        const row = Math.floor(sy / 8);
        const u = (x + (row % 2) * 6) % 12;
        const vv = sy % 8;
        const edge = 8 - ((u - 5.5) / 6) ** 2 * 5;
        let v = 0.74 - (sy / (BT - peak)) * 0.3 - lx * 0.28;
        if (vv >= edge - 1) v -= 0.24; // the scale's lower edge
        else if (vv < 2 && u < 6) v += 0.12; // its lit top-left
        else if (u >= 10) v -= 0.08;
        c = dtone(VIOLET, v, x, y, 0.4);
      }
      lid.set(x, y, c);
    }
  // the star medallion on the roof
  const sy0 = peak + 24;
  lid.fill(cx - 14, sy0 - 14, cx + 14, sy0 + 14, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - sy0;
    const a = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy);
    const k = 0.5 + 0.5 * Math.cos(a * 4);
    return r <= 6 + 7.5 * k ** 3;
  }, (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - sy0;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const k = 0.5 + 0.5 * Math.cos(a * 4);
    if (r > 5 + 7.5 * k ** 3) return GOLD[0];
    // each arm split into a lit and a shaded half
    const arm = Math.round(a / (Math.PI / 2));
    const side = a - (arm * Math.PI) / 2;
    const lit = (dx < 0 || dy < 0) !== side > 0;
    return lit ? GOLD[5] : GOLD[3];
  });
  cabochon(lid, cx, sy0, 3.5, 3.5, RUBY);
  // the crest on the peak: a ruby on a gold ball between two laurel sprigs
  for (let y = peak - 6; y < peak + 1; y++)
    for (let x = cx - 5; x <= cx + 5; x++) {
      const d = Math.hypot((x + 0.5 - cx) / 5, (y + 0.5 - (peak - 2)) / 3.6);
      if (d <= 1) lid.set(x, y, d > 0.8 ? GOLD[1] : x < cx ? GOLD[5] : GOLD[3]);
    }
  rhombusGem(lid, cx, peak - 13, 6, 8, RUBY, RUBY[0]);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const lx = cx + side * (8 + t * 16);
      const ly = peak - 2 - Math.sin(t * Math.PI * 0.8) * 9 + t * 4;
      // the stem
      lid.set(Math.round(lx), Math.round(ly + 2), LEAF[1]);
      // a leaf: a small tilted oval, lit on top
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const rx = dx * 0.85 - dy * 0.5 * side;
          const ry = dy * 0.85 + dx * 0.5 * side;
          if ((rx / 3.2) ** 2 + (ry / 1.7) ** 2 > 1) continue;
          lid.set(Math.round(lx + dx), Math.round(ly + dy), ry < -0.4 ? LEAF[5] : ry < 0.6 ? LEAF[3] : LEAF[2]);
        }
    }
  return { base, lid, key: [cx, ly + 12] };
}

const PAINTERS: Record<HeroChestKind, () => Parts> = { hero: heroChest, rare: rareChest, region: regionChest };

// ------------------------------------------------------------------ light: the gap and the cracks

interface Crack {
  pts: Array<[number, number]>;
  lid: boolean;
  stage: number;
}

/** Jagged cracks running from the seam over the lid (up) and the box (down): zigzags of short straight segments,
 *  leaning one way then the other, with a branch off the longer ones. Deterministic per kind. */
function cracks(p: Parts, seed: number): Crack[] {
  const out: Crack[] = [];
  const onPart = (lid: boolean, x: number, y: number) => (lid ? p.lid.has(x, y) && y < BT - 9 : p.base.has(x, y) && y > BT + 6 && y < BB - 8);
  const zig = (x0: number, y0: number, lid: boolean, segs: number, sd: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    let x = x0;
    let y = y0;
    let lean = hash(sd, 0, seed) < 0.5 ? -1 : 1;
    for (let k = 0; k < segs; k++) {
      const len = 4 + Math.floor(hash(sd, k + 1, seed) * 6);
      const ang = lean * (0.3 + hash(sd, k + 20, seed) * 0.65); // from straight away from the seam
      const ex = Math.round(x + Math.sin(ang) * len);
      const ey = Math.round(y + (lid ? -1 : 1) * Math.cos(ang) * len);
      // a straight line (Bresenham) to the segment's end
      const dx = Math.abs(ex - x);
      const dy = Math.abs(ey - y);
      const sx = ex > x ? 1 : -1;
      const sy = ey > y ? 1 : -1;
      let err = dx - dy;
      for (;;) {
        if (!onPart(lid, x, y)) return pts;
        if (!pts.length || pts[pts.length - 1][0] !== x || pts[pts.length - 1][1] !== y) pts.push([x, y]);
        if (x === ex && y === ey) break;
        const e2 = err * 2;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }
      lean = hash(sd, k + 40, seed) < 0.8 ? -lean : lean;
    }
    return pts;
  };
  const starts = [0.27, 0.66, 0.46, 0.15, 0.82, 0.36, 0.92, 0.57, 0.07];
  starts.forEach((f, i) => {
    const lid = i % 2 === 0;
    const stage = i < 3 ? 1 : 2;
    const x = Math.round(X0 + 8 + f * (X1 - X0 - 16));
    const pts = zig(x, lid ? BT - 10 : BT + 7, lid, stage === 1 ? 2 + (i % 2) : 3 + (i % 2), i * 13 + 1);
    out.push({ pts, lid, stage });
    if (pts.length > 9) {
      const [bx, by] = pts[Math.floor(pts.length * 0.55)];
      out.push({ pts: zig(bx, by, lid, 2, i * 13 + 7), lid, stage: 2 });
    }
  });
  return out;
}

interface Leaks {
  gap: HTMLCanvasElement;
  lid: HTMLCanvasElement[];
  base: HTMLCanvasElement[];
}

function leakMasks(p: Parts, seed: number): Leaks {
  const cr = cracks(p, seed);
  const at = new Map<number, number>(); // y * W + x -> the earliest stage a crack lights it (lid +1000)
  for (const c of cr)
    for (const [x, y] of c.pts) {
      const k = y * W + x + (c.lid ? 1e6 : 0);
      at.set(k, Math.min(at.get(k) ?? 9, c.stage));
    }
  const crackAt = (x: number, y: number, isLid: boolean, n: number): number => {
    const st = at.get(y * W + x + (isLid ? 1e6 : 0));
    if (st !== undefined && st <= n) return 1;
    // a soft halo beside a lit crack
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const s2 = at.get((y + dy) * W + x + dx + (isLid ? 1e6 : 0));
      if (s2 !== undefined && s2 <= n) return 0.38;
    }
    return 0;
  };
  const lid: HTMLCanvasElement[] = [];
  const base: HTMLCanvasElement[] = [];
  const [kx, ky] = p.key;
  for (let n = 0; n < 3; n++) {
    const reach = n === 0 ? 30 : 999;
    const seam = (x: number) => x > X0 + 1 && x < X1 - 1 && Math.abs(x - CX) <= reach;
    lid.push(
      maskCanvas((x, y) => {
        if (!p.lid.has(x, y)) return 0;
        // the seam: a bright line with light bleeding up the lid's rim (wider as it builds)
        if (seam(x)) {
          const d = BT - 1 - y;
          const rows = n === 0 ? [0.9, 0.45] : n === 1 ? [1, 0.75, 0.4] : [1, 0.85, 0.55, 0.3];
          if (d >= 0 && d < rows.length) return rows[d];
        }
        return crackAt(x, y, true, n);
      }),
    );
    base.push(
      maskCanvas((x, y) => {
        if (!p.base.has(x, y)) return 0;
        if (seam(x)) {
          const d = y - BT;
          const rows = n === 0 ? [0.9, 0.45] : n === 1 ? [1, 0.75, 0.4] : [1, 0.85, 0.55, 0.3];
          if (d >= 0 && d < rows.length) return rows[d];
        }
        // the keyhole glows from the start, a halo round it as it builds
        const kd = Math.hypot(x + 0.5 - kx, y + 0.5 - ky);
        if (kd <= 3.2) return 1;
        if (kd <= 4.6 && n >= 1) return 0.45;
        return crackAt(x, y, false, n);
      }),
    );
  }
  const gap = maskCanvas((x, y) => {
    if (y < BT - MOUTH + 3 || y >= BT || x <= X0 + 1 || x >= X1 - 1) return 0;
    const d = Math.abs(x + 0.5 - (X0 + X1 + 1) / 2) / ((X1 - X0) / 2);
    const k = 1 - d * 0.7 - ((BT - 1 - y) / MOUTH) * 0.25;
    // stepped, not smooth: four levels
    return Math.max(0.25, Math.round(Math.min(1, k) * 4) / 4);
  });
  return { gap, lid, base };
}

// ------------------------------------------------------------------ build (once, on first use)

export interface HdChestArt {
  base: HTMLCanvasElement;
  lid: HTMLCanvasElement;
  gap: HTMLCanvasElement;
  leakL: HTMLCanvasElement[];
  leakB: HTMLCanvasElement[];
}

const built = new Map<HeroChestKind, HdChestArt>();

/** A chest's parts on the fine grid (painted the first time they're asked for). */
export function hdChest(kind: HeroChestKind): HdChestArt {
  let a = built.get(kind);
  if (!a) {
    const p = PAINTERS[kind]();
    const lk = leakMasks(p, 31 + ['hero', 'rare', 'region'].indexOf(kind) * 7);
    a = { base: toCanvas(p.base), lid: toCanvas(p.lid), gap: lk.gap, leakL: lk.lid, leakB: lk.base };
    built.set(kind, a);
  }
  return a;
}
