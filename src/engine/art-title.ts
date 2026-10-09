// The title's key art (docs/art-style.md, "The Atlas"): the Great Atlas spread open under lamplight. A parchment map
// drawn in ink (a coast with ripple lines, a river, forests, mountains, villages, a castle, a compass rose, a double
// neatline), with colour bleeding out like watercolour round the spot where the hero stands (the drawing come alive)
// and fog at the right and top edges where the land was erased (the lines fade and break into it; in the blank only
// their impression is left, pale dents in the vellum).
// Also the logo, generated from GAME_NAME (src/data/brand.ts) so a rename just works: the bold font's letters scaled
// 3x with Scale3x rounding, a gold face with a horizon band, a cream rim light on the top-left edges, a deep extrusion
// toward the bottom right, a 2 px ink outline; a leading article ("The") set small above, flanked by ink flourishes.
//
// Textures: 'title_atlas' (327x150), 'title_fog_r' / 'title_fog_t' (the fog banks, drawn drifting), 'title_logo' and
// 'title_logo_shine_<i>' (a gleam crossing the letters). Hard pixels only; everything from a seed.
import type Phaser from 'phaser';
import { GAME_NAME } from '../data/brand';
import { glyphMask } from './font';
import { scale2x } from './font-hd';

export const TITLE_W = 327;
export const TITLE_H = 150;

/** Where the hero stands on the title's map (feet, game px) and the route he will walk, east into the fog. */
export const TITLE_HERO = { x: 52, y: 88 };
export const TITLE_ROUTE: Array<[number, number]> = [
  [60, 87],
  [74, 83],
  [86, 80],
  [98, 82],
  [110, 86],
  [124, 87],
  [138, 84],
  [150, 80],
  [164, 79],
  [178, 82],
  [192, 85],
  [206, 84],
  [220, 80],
  [234, 77],
  [248, 78],
  [262, 76],
  [276, 72],
  [290, 68],
];

// ------------------------------------------------------------------ ramps (docs/art-style.md section 2)

const INK = 0x140c1c;
const PARCH = [0x3a2416, 0x6e4a2a, 0xa8804e, 0xd2b07a, 0xead2a0, 0xf8ecc8];
const AINK = [0x1a1026, 0x2e2240, 0x4a3a5e];
const FOG = [0x6a6478, 0x9a94a8, 0xc8c2d2, 0xece8f0];
const LEAF = [0x12261e, 0x1e3c2a, 0x2e5a32, 0x4a7e36, 0x78a83c, 0xb4d058];
const SEA = [0x1a3c8a, 0x2a6ad8, 0x4aa0f0, 0x86c8f2, 0xb8e2f6];
const GOLD = [0x5a3410, 0x9a5a14, 0xd8901c, 0xf2c230, 0xfff0a0];
const RED = [0x4a0f1a, 0x8a1a22, 0xd03030, 0xf05a48];
const EARTH = [0x4a2c18, 0x6e4426, 0x98663a, 0xc0905a];

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

/** Smooth value noise at cell size `s`, 0..1. */
function vnoise(x: number, y: number, s: number, seed: number): number {
  const fx = x / s;
  const fy = y / s;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const fbm = (x: number, y: number, s: number, seed: number) => vnoise(x, y, s, seed) * 0.65 + vnoise(x, y, s / 2.3, seed + 7) * 0.35;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered 4x4 dither: true when a value 0..1 passes at (x, y). */
const dither = (x: number, y: number, v: number) => v * 16 > BAYER4[(y & 3) * 4 + (x & 3)] + 0.5;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ the map's geography

/** How erased the land is here (0 = drawn, 1 = gone in the fog): the east edge, the top edge, the corners. */
export function fogness(x: number, y: number): number {
  const n = fbm(x, y, 18, 41) - 0.5;
  const east = smooth(250, 318, x + n * 34);
  const top = smooth(16, 0, y + n * 10) * 0.75;
  const ne = smooth(150, 40, Math.hypot(TITLE_W - x, y * 1.6) + n * 30);
  const se = smooth(70, 20, Math.hypot(TITLE_W - x, (TITLE_H - y) * 1.4) + n * 20);
  return clamp01(Math.max(east, top, ne * 0.95, se));
}

/** How alive (coloured) the drawing is here: a watercolour bloom round the hero, its edge ragged. */
function aliveness(x: number, y: number): number {
  const n = fbm(x, y, 9, 77) - 0.5;
  const d = Math.hypot((x - 48) / 74, (y - 84) / 52) + n * 0.32;
  return 1 - smooth(0.82, 1.0, d);
}

/** The west coast: sea west of this x. A bay bites in at the bottom left. */
function coastX(y: number): number {
  const n = fbm(3, y, 14, 5) - 0.5;
  const bay = 22 * Math.exp(-(((y - 122) / 18) ** 2));
  const cove = 8 * Math.exp(-(((y - 38) / 10) ** 2));
  return 15 + n * 14 + bay + cove;
}

const isSea = (x: number, y: number) => x < coastX(y);

// ------------------------------------------------------------------ painting the atlas

function paintAtlas(): HTMLCanvasElement {
  const p = new Px(TITLE_W, TITLE_H);
  const W = TITLE_W;
  const H = TITLE_H;
  // ink goes through here: lines fade, then break, then vanish as the fog thickens (erased land)
  const ink = (x: number, y: number, col = AINK[1]) => {
    x = Math.round(x);
    y = Math.round(y);
    const f = fogness(x, y);
    // erased land keeps the impression: the dent of every line once pressed into the vellum, pale, lit from the
    // top left (story-bible section 2, rule 5)
    if (f > 0.72 || (f > 0.42 && hash(x, y, 9) < (f - 0.42) * 2.6)) {
      if (f > 0.5) {
        p.set(x, y, FOG[2]);
        if (p.get(x - 1, y - 1) === FOG[3] || p.get(x - 1, y - 1) === FOG[2]) p.set(x - 1, y - 1, 0xf8f6fa);
      }
      return;
    }
    p.set(x, y, f > 0.3 ? AINK[2] : col);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, col = AINK[1], dash = 0) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      if (dash && Math.floor(i / dash) % 2 === 1) continue;
      ink(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, col);
    }
  };

  // 1. the paper: lamplight from the top left, mottled in clusters, a burnt edge
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const lamp = 1 - Math.hypot(x / W, (y / H) * 0.8) * 0.55;
      const mott = fbm(x, y, 11, 3) - 0.5;
      const v = lamp + mott * 0.28;
      let col = v > 0.86 ? PARCH[5] : v > 0.6 ? PARCH[4] : PARCH[3];
      if (v > 0.6 && v < 0.64 && !dither(x, y, 0.5)) col = PARCH[3];
      if (v > 0.84 && v < 0.88 && dither(x, y, 0.5)) col = PARCH[4];
      // the edge: darker bands toward the rim, dithered between
      const e = Math.min(x, y, W - 1 - x, H - 1 - y) + (fbm(x, y, 5, 13) - 0.5) * 3;
      const corner = Math.min(Math.hypot(x, H - y), Math.hypot(W - x, H - y), Math.hypot(x, y) + 30, Math.hypot(W - x, y) + 10);
      if (corner < 26 + (fbm(x, y, 6, 17) - 0.5) * 8) col = corner < 14 ? PARCH[2] : dither(x, y, 0.5) ? PARCH[2] : PARCH[3];
      if (e < 1.5) col = PARCH[1];
      else if (e < 3) col = PARCH[2];
      else if (e < 5 && dither(x, y, 0.5)) col = PARCH[3];
      // the erased land: the paper bleaches toward the fog's grey
      const f = fogness(x, y);
      if (f > 0.55) col = dither(x, y, smooth(0.55, 0.9, f)) ? FOG[3] : FOG[2];
      else if (f > 0.35 && dither(x, y, smooth(0.35, 0.55, f))) col = FOG[3];
      p.set(x, y, col);
    }
  // a few long fibres in the paper
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 21) * W);
    const y = Math.floor(hash(i, 2, 21) * H);
    const len = 4 + Math.floor(hash(i, 3, 21) * 6);
    for (let k = 0; k < len; k++) if (fogness(x + k, y) < 0.4 && p.get(x + k, y) !== PARCH[1]) p.set(x + k, y, PARCH[3]);
  }

  // 2. the sea (west): watercolour where it is alive, ripple lines parallel to the coast
  for (let y = 4; y < H - 4; y++) {
    const cx = coastX(y);
    for (let x = 4; x < Math.ceil(cx); x++) {
      const a = aliveness(x, y);
      const d = cx - x;
      if (a > 0.5) {
        const depth = d + (fbm(x, y, 6, 2) - 0.5) * 4;
        p.set(x, y, depth < 3 ? SEA[4] : depth < 8 ? SEA[3] : SEA[2]);
      } else if (a > 0.35 && dither(x, y, (a - 0.35) / 0.15)) p.set(x, y, SEA[4]);
    }
  }
  for (let y = 4; y < H - 4; y++) {
    const cx = coastX(y);
    const alive = aliveness(cx - 3, y) > 0.5;
    for (const off of [3, 6, 10]) {
      const x = Math.round(cx - off);
      if (x < 5) continue;
      // dashes that follow the coast, broken every few rows
      if ((y + off * 3) % 7 < 4) {
        if (alive) p.set(x, y, off === 10 ? SEA[1] : SEA[4] === p.get(x, y) ? SEA[2] : 0xe0f6ff);
        else ink(x, y, AINK[2]);
      }
    }
    // the coastline itself (ink), and a light lip on the land side where it is alive
    ink(Math.round(cx), y);
    if (Math.abs(coastX(y + 1) - cx) >= 1) for (let x = Math.round(Math.min(cx, coastX(y + 1))); x <= Math.round(Math.max(cx, coastX(y + 1))); x++) ink(x, y);
  }

  // 3. the land come alive round the hero: a green wash in tones, its edge darkened like a watercolour bloom
  for (let y = 4; y < H - 4; y++)
    for (let x = 4; x < W - 4; x++) {
      if (isSea(x, y) || Math.abs(x - coastX(y)) < 1) continue;
      const a = aliveness(x, y);
      if (a <= 0.3) continue;
      const n = fbm(x, y, 7, 31);
      const light = n + (1 - Math.hypot(x - 30, y - 50) / 120) * 0.25;
      let col = light > 0.78 ? LEAF[5] : light > 0.52 ? LEAF[4] : LEAF[3];
      if (a < 0.5) {
        // the ragged bloom edge: a darker ring of pigment, then speckled thinning into the paper
        if (a > 0.42) col = LEAF[3];
        else if (!dither(x, y, (a - 0.3) / 0.12)) continue;
        else col = LEAF[4];
      }
      p.set(x, y, col);
    }

  // 4. the river: from the mountains (behind the logo) down past the hero to the bay; blue where alive
  const river: Array<[number, number]> = [];
  const RIV: Array<[number, number]> = [
    [126, 30],
    [118, 44],
    [124, 56],
    [110, 66],
    [96, 64],
    [84, 74],
    [92, 90],
    [78, 102],
    [60, 104],
    [50, 116],
    [40, 124],
    [30, 126],
  ];
  // a Catmull-Rom curve through the bends, sampled finely
  for (let i = 0; i < RIV.length - 1; i++) {
    const p0 = RIV[Math.max(0, i - 1)];
    const p1 = RIV[i];
    const p2 = RIV[i + 1];
    const p3 = RIV[Math.min(RIV.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.02) {
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      river.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  const wet = new Set<number>();
  river.forEach(([x, y], i) => {
    const w = i < river.length * 0.35 ? 1 : 2;
    for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) if (dx * dx + dy * dy <= w * w + 1) wet.add(Math.round(y + dy) * W + Math.round(x + dx));
  });
  for (const k of wet) {
    const x = k % W;
    const y = Math.floor(k / W);
    if (isSea(x, y)) continue;
    const edge = !wet.has(k - 1) || !wet.has(k + 1) || !wet.has(k - W) || !wet.has(k + W);
    if (edge) ink(x, y);
    else if (aliveness(x, y) > 0.5) p.set(x, y, wet.has(k - W - 1) && wet.has(k - 2 * W) ? SEA[3] : SEA[4]);
  }

  // 5. mountains: a range in ink (lit left slope, hatched right slope), rising toward the north east
  const peak = (cx: number, by: number, h: number, alive: boolean) => {
    // a map mountain: the lit west slope pale, the east slope in shade with hatching, an ink outline, a crest line
    const top = by - h;
    for (let y = top; y <= by; y++) {
      const hw = Math.round((y - top) * 0.95);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const east = x > cx;
        const f = fogness(x, y);
        if (f > 0.72) continue;
        const snow = alive && y < top + 3;
        let col = east ? (alive ? EARTH[1] : PARCH[3]) : alive ? EARTH[3] : PARCH[5];
        if (snow) col = east ? FOG[2] : 0xf8f8ff;
        if (!alive && east && (x - cx) % 2 === 0 && y > top + 1) col = AINK[2];
        if (f > 0.45 && hash(x, y, 4) < (f - 0.45) * 3) continue;
        p.set(x, y, col);
      }
      ink(cx - hw, y);
      ink(cx + hw, y);
    }
    // the crest runs down from the peak, a little east of the middle
    for (let k = 1; k < Math.round(h * 0.6); k++) ink(cx + Math.floor(k / 3), top + k, alive ? EARTH[0] : PARCH[2]);
    for (let x = cx - h; x <= cx + h; x++) if (p.get(x, by + 1) !== -1 && fogness(x, by + 1) < 0.5) ink(x, by + 1, AINK[2]);
    ink(cx, top);
  };
  const peaks: Array<[number, number, number]> = [
    [200, 76, 9],
    [214, 74, 12],
    [230, 76, 10],
    [246, 73, 14],
    [262, 75, 11],
    [276, 70, 15],
    [290, 72, 11],
    [262, 46, 15],
    [282, 42, 18],
    [300, 46, 13],
    [244, 38, 10],
    [58, 34, 10],
    [74, 30, 13],
    [90, 34, 9],
    [138, 36, 10],
    [154, 32, 13],
    [172, 36, 9],
  ];
  peaks.sort((a, b) => a[1] - b[1]);
  for (const [x, y, h] of peaks) peak(x, y, h, aliveness(x, y) > 0.5);

  // 6. forests: little round trees; green and lit where alive, ink loops with a hatched side elsewhere
  const tree = (x: number, y: number) => {
    const alive = aliveness(x, y) > 0.55;
    if (isSea(x, y) || isSea(x + 4, y + 4)) return;
    const shape = ['.###.', '#####', '#####', '.###.'];
    shape.forEach((r, yy) =>
      [...r].forEach((c, xx) => {
        if (c !== '#') return;
        if (alive) p.set(x + xx, y + yy, yy === 0 || xx === 0 ? LEAF[5] : xx >= 3 || yy === 3 ? LEAF[2] : LEAF[4]);
      }),
    );
    // the outline (ink) and the trunk
    const ol = [
      [1, -1],
      [2, -1],
      [3, -1],
      [0, 0],
      [4, 0],
      [-1, 1],
      [5, 1],
      [-1, 2],
      [5, 2],
      [0, 3],
      [4, 3],
      [1, 4],
      [3, 4],
    ];
    for (const [dx, dy] of ol) ink(x + dx, y + dy);
    if (!alive) {
      ink(x + 3, y + 1, AINK[2]);
      ink(x + 3, y + 3, AINK[2]);
    }
    ink(x + 2, y + 4);
    ink(x + 2, y + 5);
  };
  const grove = (cx: number, cy: number, n: number, r: number, seed: number) => {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n * 4 && pts.length < n; i++) {
      const x = Math.round(cx + (hash(i, 0, seed) - 0.5) * 2 * r);
      const y = Math.round(cy + (hash(i, 1, seed) - 0.5) * r);
      if (pts.some(([px, py]) => Math.abs(px - x) < 6 && Math.abs(py - y) < 5)) continue;
      pts.push([x, y]);
    }
    pts.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => tree(x, y));
  };
  grove(34, 52, 9, 16, 1);
  grove(84, 64, 6, 13, 2);
  grove(28, 100, 5, 10, 3);
  grove(94, 104, 7, 16, 4);
  grove(150, 100, 7, 18, 5);
  grove(206, 102, 6, 16, 6);
  grove(104, 26, 6, 14, 7);
  grove(256, 98, 5, 12, 8);

  // 7. villages and a castle; roads between them in dotted ink
  const house = (x: number, y: number) => {
    const alive = aliveness(x, y) > 0.55;
    const rows = ['..k..', '.krk.', 'krrrk', '.wwwk', '.wdwk', '.kkkk'];
    rows.forEach((r, yy) =>
      [...r].forEach((c, xx) => {
        if (c === 'k') ink(x + xx, y + yy);
        else if (alive && c === 'r') p.set(x + xx, y + yy, xx < 2 ? RED[3] : RED[2]);
        else if (alive && c === 'w') p.set(x + xx, y + yy, PARCH[5]);
        else if (c === 'd') ink(x + xx, y + yy, alive ? EARTH[0] : AINK[2]);
      }),
    );
  };
  house(70, 70);
  house(76, 73);
  house(118, 74);
  house(178, 90);
  house(180, 70);
  // the castle on the hill (ink): two towers and a keep
  const castle = ['k.k...k.k', 'kkk.k.kkk', 'k.kkkkk.k', 'k.k.k.k.k', 'k.kk.kk.k', 'k.k...k.k', 'kkkkkkkkk'];
  castle.forEach((r, yy) => [...r].forEach((c, xx) => c === 'k' && ink(150 + xx, 70 + yy)));
  ink(154, 67);
  ink(154, 68);
  ink(155, 67, RED[2]);
  line(80, 77, 117, 78, AINK[2], 2);
  line(124, 79, 149, 77, AINK[2], 2);
  line(160, 77, 179, 76, AINK[2], 2);
  line(160, 78, 178, 92, AINK[2], 2);

  // 8. a little ship on the bay, and a sea serpent's coils further out (ink doodles)
  const ship = ['...k...', '..kkk..', '.kkkkk.', '...k...', 'kkkkkkk', '.kkkkk.'];
  ship.forEach((r, yy) => [...r].forEach((c, xx) => c === 'k' && ink(14 + xx, 112 + yy, xx === 3 || yy >= 4 ? AINK[0] : AINK[1])));
  if (aliveness(16, 114) > 0.5) {
    p.set(15, 114, PARCH[5]);
    p.set(16, 114, PARCH[5]);
    p.set(17, 114, PARCH[5]);
    p.set(16, 113, PARCH[5]);
  }

  // 9. the compass rose (east, half erased): a gold star in ink
  const rose = (cx: number, cy: number, r: number) => {
    for (let k = -r; k <= r; k++) {
      const t = 1 - Math.abs(k) / r;
      const w = Math.round(t * 2);
      for (let j = -w; j <= w; j++) {
        // north-south and east-west points: the lit half gold, the other half ink
        ink(cx + j, cy + k, j < 0 || (j === 0 && k < 0) ? GOLD[3] : GOLD[1]);
        ink(cx + k, cy + j, j < 0 ? GOLD[3] : GOLD[1]);
      }
    }
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2;
      ink(cx + Math.round(Math.cos(t) * (r - 3)), cy + Math.round(Math.sin(t) * (r - 3)), AINK[2]);
    }
    ink(cx, cy - r - 2);
    ink(cx - 1, cy - r - 3);
    ink(cx + 1, cy - r - 3);
    ink(cx, cy - r - 4);
  };
  rose(298, 100, 9);

  // 10. the neatline: a double ink frame (with corner knots), gone where the fog took the edge
  for (let x = 6; x < W - 6; x++) {
    ink(x, 6, AINK[1]);
    ink(x, 8, AINK[2]);
    ink(x, H - 7, AINK[1]);
    ink(x, H - 9, AINK[2]);
  }
  for (let y = 6; y < H - 6; y++) {
    ink(6, y, AINK[1]);
    ink(8, y, AINK[2]);
    ink(W - 7, y, AINK[1]);
    ink(W - 9, y, AINK[2]);
  }
  for (const [cx, cy] of [
    [7, 7],
    [7, H - 8],
    [W - 8, 7],
    [W - 8, H - 8],
  ]) {
    for (let k = -2; k <= 2; k++) {
      ink(cx + k, cy, GOLD[1]);
      ink(cx, cy + k, GOLD[1]);
    }
  }
  return p.canvas();
}

// ------------------------------------------------------------------ the fog banks (drawn drifting over the atlas)

/** A bank of lit fog puffs: `f(x, y)` says how thick it wants to be; puffs are scalloped, lit from the top left. */
function paintFog(w: number, h: number, f: (x: number, y: number) => number, seed: number): HTMLCanvasElement {
  const p = new Px(w, h);
  const A = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // puffs: bumps of noise at two sizes, raised by the bank's thickness
      const lump = fbm(x, y, 15, seed) * 0.75 + vnoise(x, y, 7, seed + 3) * 0.25;
      A[y * w + x] = f(x, y) * 1.25 + (lump - 0.55) * 0.9;
    }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : A[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = at(x, y);
      if (v < 0.42) continue;
      if (v < 0.48 && !dither(x, y, (v - 0.42) / 0.06)) continue;
      // light: brighter where the puff rises toward the top left, shadowed toward the bottom right
      const slope = at(x - 2, y - 2) - at(x + 2, y + 2);
      let col = v > 0.9 ? FOG[3] : FOG[2];
      if (slope > 0.12) col = FOG[3];
      else if (slope < -0.3 && v < 0.8) col = FOG[1];
      else if (slope < -0.12) col = FOG[2];
      p.set(x, y, col);
    }
  return p.canvas((x, y, col) => (col === FOG[1] ? 0.75 : clamp01(0.55 + at(x, y) * 0.5)));
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
  const H = y + PAD;
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
  return { cv: p.canvas(), face: (x, y) => x >= 0 && y >= 0 && x < W && y < H && face[y * W + x] === 1, w: W, h: H };
}

// ------------------------------------------------------------------ build

const SHINE_N = 14;

function addCanvas(scene: Phaser.Scene, key: string, cv: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

/** Paint the title's textures once (the atlas, the fog banks, the logo and its gleam). Returns the gleam's frame count. */
export function buildTitleArt(scene: Phaser.Scene, name = GAME_NAME): number {
  if (!scene.textures.exists('title_atlas')) {
    addCanvas(scene, 'title_atlas', paintAtlas());
    // the east bank (wider than its place: it drifts) and a thinner top bank
    addCanvas(scene, 'title_fog_r', paintFog(96, TITLE_H, (x, y) => smooth(10, 80, x) * 0.9 + smooth(60, 0, y) * 0.3 + smooth(110, 150, y) * 0.3, 51));
    addCanvas(scene, 'title_fog_t', paintFog(TITLE_W + 40, 26, (x, y) => smooth(20, 0, y) * (0.35 + smooth(120, 330, x) * 0.6), 61));
  }
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
