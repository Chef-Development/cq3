// The region card's art (docs/ui-style.md "Completion tracker"): each region as a small hand-drawn map on parchment
// (watercolour washes under brown ink: coasts, rivers, meadows, woods, ranges, a volcano; the three act sites as ink
// landmarks joined by a dashed road; a compass rose), a fogged blank sheet for a region not reached yet (its map would
// spoil it), the carved wooden frame round the map, the stone pedestal the 100% chest stands on, and a study backdrop
// registered as the screen's stage theme ('atlas': a plank wall, map racks, a lantern). All painted the first time
// the screen opens (`ensureRegionArt`), never at boot.
//
// The map is bigger than its frame (region-sites.ts: the sheet in the middle holds the sites and the seals; the
// landscape carries on into a margin round it, which the card pans to). Each region is painted in sheet coordinates
// on a Paper whose origin sits REGION_PAD_X / REGION_PAD_Y in, so the coasts, washes and rivers run on past the
// sheet's edges.
//
// Textures:
//   rmap_<regionId> / rmap_fog   REGION_MAP_W x REGION_MAP_H, the map itself (REGION_SITES: the act sites on its sheet)
//   rmap_frame                   the frame, FRAME_W x FRAME_H, its window (REGION_VIEW_W x REGION_VIEW_H) FRAME_IN in
//   rmap_pedestal                PEDESTAL_W x PEDESTAL_H, a carved stone plinth (the chest's feet on its top: y 3)
import type Phaser from 'phaser';
import { fbm, hash, noise } from './backdrop';
import { registerStageTheme, type StageSpec } from './art-ui-stage';
import { REGION_MAP_H, REGION_MAP_W, REGION_PAD_X, REGION_PAD_Y, REGION_SITES, REGION_VIEW_H, REGION_VIEW_W } from './region-sites';

export { REGION_MAP_H, REGION_MAP_W, REGION_SITES } from './region-sites';
export const FRAME_IN = 5;
export const FRAME_W = REGION_VIEW_W + FRAME_IN * 2;
export const FRAME_H = REGION_VIEW_H + FRAME_IN * 2;
export const PEDESTAL_W = 46;
export const PEDESTAL_H = 18;
export const ATLAS_THEME = 'atlas';

type Pt = [number, number];

// ------------------------------------------------------------------ a little pixel buffer

class Paper {
  readonly d: Uint8ClampedArray;
  /** What the painters draw in: coordinates from (x0, y0) to (x1, y1) (the origin sits ox, oy into the canvas). */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  constructor(
    readonly w: number,
    readonly h: number,
    readonly ox = 0,
    readonly oy = 0,
  ) {
    this.d = new Uint8ClampedArray(w * h * 4);
    this.x0 = -ox;
    this.y0 = -oy;
    this.x1 = w - ox;
    this.y1 = h - oy;
  }
  in(x: number, y: number): boolean {
    return x >= this.x0 && y >= this.y0 && x < this.x1 && y < this.y1;
  }
  private at(x: number, y: number): number {
    return ((y + this.oy) * this.w + x + this.ox) * 4;
  }
  get(x: number, y: number): number {
    const i = this.at(x, y);
    return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2];
  }
  set(x: number, y: number, c: number, a = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.in(x, y)) return;
    const i = this.at(x, y);
    this.d[i] = c >> 16;
    this.d[i + 1] = (c >> 8) & 255;
    this.d[i + 2] = c & 255;
    this.d[i + 3] = a;
  }
  /** Move a pixel toward `c` by k (0..1), keeping its alpha. */
  tint(x: number, y: number, c: number, k: number): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.in(x, y) || k <= 0) return;
    const i = this.at(x, y);
    if (!this.d[i + 3]) return;
    const kk = Math.min(1, k);
    this.d[i] += ((c >> 16) - this.d[i]) * kk;
    this.d[i + 1] += (((c >> 8) & 255) - this.d[i + 1]) * kk;
    this.d[i + 2] += ((c & 255) - this.d[i + 2]) * kk;
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const im = ctx.createImageData(this.w, this.h);
    im.data.set(this.d);
    ctx.putImageData(im, 0, 0);
    return c;
  }
}

const mixc = (a: number, b: number, t: number): number => {
  const k = Math.max(0, Math.min(1, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

// ink and parchment
const INK = 0x3a2614;
const INK_SOFT = 0x6a4a2c;
const PAPER_HI = 0xf2e4bf;
const PAPER = 0xe2cc9a;
const PAPER_LO = 0xc8a874;
const BURN = 0x7a5430;

/** Parchment: mottled, warmer and darker toward the rim, a couple of stains and two folds. */
function parchment(p: Paper, seed: number): void {
  const { w, h, ox, oy } = p;
  for (let Y = 0; Y < h; Y++)
    for (let X = 0; X < w; X++) {
      const x = X - ox;
      const y = Y - oy;
      const n = fbm(x * 0.06, y * 0.08, seed);
      let c = mixc(PAPER_HI, PAPER, n * 1.3 - 0.15);
      const ex = Math.min(X, w - 1 - X) / (w * 0.5);
      const ey = Math.min(Y, h - 1 - Y) / (h * 0.5);
      const e = Math.min(ex * 1.4, ey * 1.4, 1);
      c = mixc(PAPER_LO, c, 0.35 + e * 0.65 + (hash(x, y, seed) - 0.5) * 0.08);
      p.set(x, y, c);
    }
  // stains: a cup ring and a blot
  for (const [cx, cy, r] of [
    [w * 0.78, h * 0.72, 9],
    [w * 0.2, h * 0.24, 6],
  ])
    for (let y = -r - 2; y <= r + 2; y++)
      for (let x = -r - 2; x <= r + 2; x++) {
        const d = Math.hypot(x, y * 1.1);
        if (Math.abs(d - r) < 0.9 && hash(x, y, seed + 3) > 0.25) p.tint(cx + x - ox, cy + y - oy, PAPER_LO, 0.35);
        else if (d < r) p.tint(cx + x - ox, cy + y - oy, PAPER_LO, 0.08);
      }
  // folds: a light ridge and its shadow
  const fx = Math.round(w / 2) - ox;
  const fy = Math.round(h / 2) - oy;
  for (let y = p.y0; y < p.y1; y++) {
    p.tint(fx, y, 0xfff4d8, 0.35);
    p.tint(fx + 1, y, PAPER_LO, 0.25);
  }
  for (let x = p.x0; x < p.x1; x++) {
    p.tint(x, fy, 0xfff4d8, 0.3);
    p.tint(x, fy + 1, PAPER_LO, 0.22);
  }
  // a burnt, ragged rim
  for (let Y = 0; Y < h; Y++)
    for (let X = 0; X < w; X++) {
      const d = Math.min(X, Y, w - 1 - X, h - 1 - Y);
      const rag = noise(X * 0.3 + Y * 0.3, 0, seed + 5) * 2.4;
      if (d < rag) p.tint(X - ox, Y - oy, BURN, 0.75 - d * 0.2);
    }
}

/** A watercolour wash over `inside`: the paper tinted toward `col`, pooling darker along the shape's edge. */
function wash(p: Paper, inside: (x: number, y: number) => boolean, col: number, k: number, seed: number): void {
  for (let y = p.y0; y < p.y1; y++)
    for (let x = p.x0; x < p.x1; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const edge2 = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2);
      const n = noise(x * 0.25, y * 0.25, seed) * 0.25;
      p.tint(x, y, col, k + n + (edge ? 0.2 : edge2 ? 0.08 : 0));
    }
}

/** An ink outline round `inside` (its outer edge), broken here and there like a pen line. */
function inkEdge(p: Paper, inside: (x: number, y: number) => boolean, seed: number, col = INK_SOFT, gaps = 0.12): void {
  for (let y = p.y0; y < p.y1; y++)
    for (let x = p.x0; x < p.x1; x++) {
      if (!inside(x, y)) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      if (hash(x >> 1, y >> 1, seed) < gaps) continue;
      p.set(x, y, col);
    }
}

/** A blob from a centre and radii, its edge wobbled by noise (a lake, a wood, a meadow). */
const blob =
  (cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.28) =>
  (x: number, y: number): boolean => {
    const a = Math.atan2(y - cy, x - cx);
    const r = 1 + (noise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, seed) - 0.5) * wob * 2;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r;
  };

/** A band along a polyline (a river, a lava flow): within `wd` of it. */
function band(pts: Pt[], wd: (t: number) => number): (x: number, y: number) => boolean {
  return (x, y) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const vx = bx - ax;
      const vy = by - ay;
      const l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
      const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
      if (d <= wd((i + t) / (pts.length - 1))) return true;
    }
    return false;
  };
}

/** Points along a smooth path through `pts` (Catmull-Rom), about one per px. */
function smooth(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A dashed road along a smooth path (2 on, 2 off), skipping `avoid` (the sites' marks). */
function road(p: Paper, pts: Pt[], avoid: Pt[], col = 0x8a5a2c): void {
  const path = smooth(pts);
  let run = 0;
  let last: Pt | null = null;
  for (const [x, y] of path) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (last && last[0] === rx && last[1] === ry) continue;
    last = [rx, ry];
    run++;
    if (avoid.some(([ax, ay]) => Math.hypot(rx - ax, ry - ay) < 9)) continue;
    if (run % 4 < 2) {
      p.set(rx, ry, col);
      p.tint(rx, ry + 1, PAPER_LO, 0.4);
    }
  }
}

/** Little ink marks: a tree (a lollipop with a coloured crown), a pine, a hill, a wave, a tuft. */
function tree(p: Paper, x: number, y: number, crown: number): void {
  for (const [dx, dy] of [
    [0, -3],
    [-1, -2],
    [0, -2],
    [1, -2],
    [-1, -1],
    [0, -1],
    [1, -1],
  ])
    p.set(x + dx, y + dy, dy === -3 || dx === -1 ? mixc(crown, 0xffffff, 0.2) : crown);
  p.set(x - 2, y - 2, INK_SOFT);
  p.set(x + 2, y - 2, INK_SOFT);
  p.set(x - 1, y - 4, INK_SOFT);
  p.set(x, y - 4, INK_SOFT);
  p.set(x + 1, y - 4, INK_SOFT);
  p.set(x, y, INK);
}
function pine(p: Paper, x: number, y: number, col: number): void {
  for (let k = 0; k < 4; k++) {
    for (let dx = -Math.floor(k / 2) - 1; dx <= Math.floor(k / 2) + 1; dx++) p.set(x + dx, y - 4 + k, dx < 0 ? mixc(col, 0xffffff, 0.15) : col);
  }
  p.set(x, y - 5, INK_SOFT);
  p.set(x, y, INK);
}
function hill(p: Paper, x: number, y: number, wd: number): void {
  for (let dx = -wd; dx <= wd; dx++) {
    const yy = y - Math.round(Math.sqrt(Math.max(0, 1 - (dx / wd) ** 2)) * (wd * 0.55));
    p.set(x + dx, yy, INK_SOFT);
    if (dx > 0 && dx % 2 === 0) p.set(x + dx, yy + 2, INK_SOFT);
  }
}
function wave(p: Paper, x: number, y: number, col = 0x3a6a88): void {
  p.set(x, y, col);
  p.set(x + 1, y - 1, col);
  p.set(x + 2, y, col);
  p.set(x + 3, y - 1, col);
}
/** A mountain: an ink peak, its right flank hatched, a snow cap. */
function mountain(p: Paper, x: number, y: number, hgt: number, snow: boolean, body = 0x8a8a94): void {
  // the ridge line wanders a little off centre; the lit west face, the shaded east face with a few hatch strokes
  // parallel to its slope, a ragged snow cap
  const capAt = (dx: number) => hgt * 0.32 + (Math.abs(dx) % 3 === 1 ? 1.5 : 0);
  for (let k = 0; k <= hgt; k++) {
    const half = Math.round(k * 0.9);
    const yy = y - hgt + k;
    for (let dx = -half; dx <= half; dx++) {
      const east = dx > Math.round(k * 0.12);
      let c = east ? mixc(body, 0x3a3448, 0.32) : mixc(body, 0xfff4e0, 0.22);
      if (snow && k < capAt(dx)) c = east ? 0xc8d8e8 : 0xfcfeff;
      p.tint(x + dx, yy, c, 0.9);
      // hatching on the east face: strokes parallel to the right flank, every 3 px
      if (east && !(snow && k < capAt(dx)) && (half - dx) % 3 === 1 && k % 4 !== 0) p.set(x + dx, yy, mixc(body, INK, 0.45));
    }
    p.set(x - half - 1, yy, INK);
    p.set(x + half + 1, yy, INK);
  }
  p.set(x, y - hgt - 1, INK);
}
/** A compass rose: an eight-point star in ink, the north arm red. */
function compass(p: Paper, x: number, y: number): void {
  for (let k = 1; k <= 7; k++) {
    p.set(x, y - k, k < 4 ? 0xb03020 : 0x8a2018);
    p.set(x, y + k, INK);
    p.set(x - k, y, INK);
    p.set(x + k, y, INK);
    if (k <= 3) {
      p.set(x - k, y - k, INK_SOFT);
      p.set(x + k, y - k, INK_SOFT);
      p.set(x - k, y + k, INK_SOFT);
      p.set(x + k, y + k, INK_SOFT);
    }
  }
  for (const [dx, dy] of [
    [-1, -2],
    [1, -2],
    [-1, 2],
    [1, 2],
    [-2, -1],
    [-2, 1],
    [2, -1],
    [2, 1],
  ])
    p.set(x + dx, y + dy, INK_SOFT);
  p.set(x, y, 0xf2e4bf);
  // a ring
  for (let a = 0; a < 40; a++) {
    const ang = (a / 40) * Math.PI * 2;
    if (a % 3) p.set(x + Math.cos(ang) * 5, y + Math.sin(ang) * 5, INK_SOFT);
  }
  // "N"
  for (let k = 0; k < 4; k++) {
    p.set(x - 1, y - 12 + k, INK);
    p.set(x + 1, y - 12 + k, INK);
  }
  p.set(x, y - 11, INK);
  p.set(x, y - 10, INK);
}

/** Stamp a little character map (an act site's landmark) centred on (x, y)'s foot. */
function mark(p: Paper, rows: string[], pal: Record<string, number>, x: number, y: number): void {
  const w = Math.max(...rows.map((r) => r.length));
  const x0 = Math.round(x - w / 2);
  const y0 = Math.round(y - rows.length + 1);
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      const c = pal[ch];
      if (c !== undefined) p.set(x0 + i, y0 + j, c);
    }),
  );
}

// the sites' landmarks, inked with a touch of colour (k ink, then the region's colours)
const TENTS = ['....k.....k...', '...kRk...kYk..', '..kRRrk.kYYyk.', '.kRRRrrkYYYyyk', 'kkkkkkkkkkkkkk'];
const RUINS = ['.k.k.......k.k.', '.kkk.......kkk.', '.kSk..k.k..kSk.', '.kSkk.kkk.kkSk.', '.kSSk.kSk.kSSk.', '.kSSkkkSkkkSSk.', 'kkkkkkkkkkkkkkk'];
const HOLLOW = ['...kOOOk.k..', '..kOoOOokOk.', '.kOoOkkOOok.', '..kOkddkOk..', '...kkddkk...', '....kddk....', '..kkkddkkk..', '.k..k..k..k.'];
const FLAGS = ['k.....k.....k', 'kRY.B.kG.R..k', 'k..kkkkkk...k', 'k...........k', 'kk.........kk'];
const CAVE = ['....kkkk....', '..kkSSSSkk..', '.kSSkkkkSSk.', 'kSSk....kSSk', 'kSk......kSk', 'kkk......kkk'];
const KEEP = ['.k.k.k.', '.kkkkk.', '.kSSSk.', '.kSkSk.', 'kkSSSkk', 'kSSkSSk', 'kkkkkkk'];
const BARRIER = ['k...k...k', 'kRWRWRWRk', 'k...k...k', 'k...k...k'];
const FORGE = ['..kk....', '..kk.kk.', '.kkkkkkk', 'kSSkOSSk', 'kSkOOkSk', 'kkkkkkkk'];

function greenmarch(p: Paper): void {
  const S = REGION_SITES.greenmarch.acts;
  // the sea down the left and along the bottom-left, with a beach line
  const sea = (x: number, y: number) => x + noise(y * 0.08, 1, 21) * 14 < 16 + Math.max(0, (y - 78) * 0.9);
  wash(p, sea, 0x6aa0b8, 0.55, 3);
  inkEdge(p, (x, y) => !sea(x, y) && (sea(x - 1, y) || sea(x, y + 1) || sea(x + 1, y)), 4, INK_SOFT, 0.05);
  for (const [x, y] of [
    [5, 20],
    [8, 40],
    [4, 60],
    [10, 84],
    [20, 100],
    [6, 104],
  ])
    wave(p, x, y);
  // meadows: soft greens over most of the land
  wash(p, (x, y) => !sea(x, y) && fbm(x * 0.05, y * 0.06, 7) > 0.45, 0x9ab868, 0.35, 8);
  wash(p, blob(70, 86, 30, 18, 9), 0xb8c878, 0.3, 10);
  // a river from the hills in the north down to the sea
  const river: Pt[] = [
    [130, -26],
    [124, -2],
    [118, 18],
    [126, 40],
    [112, 60],
    [86, 76],
    [60, 92],
    [30, 108],
    [8, 130],
  ];
  const riv = band(smooth(river), (t) => 1 + t * 1.6);
  wash(p, riv, 0x5a90b0, 0.7, 11);
  inkEdge(p, band(smooth(river), (t) => 2 + t * 1.6), 12, 0x4a6a80, 0.3);
  // the dark autumn wood round the Boar King's Hollow (east), and a green wood up north
  const wood = blob(162, 62, 30, 30, 13, 0.32);
  wash(p, wood, 0x9a6a38, 0.45, 14);
  inkEdge(p, wood, 15, INK_SOFT, 0.25);
  for (let i = 0; i < 26; i++) {
    const x = 140 + Math.floor(hash(i, 1, 16) * 50);
    const y = 38 + Math.floor(hash(i, 2, 16) * 52);
    if (wood(x, y) && Math.hypot(x - S[2][0], y - S[2][1]) > 12) tree(p, x, y, hash(i, 3, 16) < 0.5 ? 0xc0702c : 0xa04a24);
  }
  const north = blob(52, 22, 24, 12, 17);
  wash(p, north, 0x5a8a48, 0.4, 18);
  for (let i = 0; i < 12; i++) {
    const x = 32 + Math.floor(hash(i, 1, 19) * 40);
    const y = 14 + Math.floor(hash(i, 2, 19) * 18);
    if (north(x, y)) tree(p, x, y, 0x3e7a3a);
  }
  // hills up north and east
  for (const [x, y, wd] of [
    [140, 18, 7],
    [156, 14, 6],
    [172, 22, 8],
    [86, 50, 6],
    // (the margins: more hills north and east, past the sheet)
    [96, -8, 7],
    [150, -10, 8],
    [188, -4, 6],
    [206, 28, 7],
    [212, 100, 6],
    [196, 124, 7],
    [120, 124, 6],
  ])
    hill(p, x, y, wd);
  // the margins' woods: a wood up north-east and one far east
  for (let i = 0; i < 14; i++) {
    const x = 60 + Math.floor(hash(i, 4, 19) * 150);
    const y = -16 + Math.floor(hash(i, 5, 19) * 12);
    tree(p, x, y, i % 3 ? 0x3e7a3a : 0x5a8a48);
  }
  for (let i = 0; i < 10; i++) {
    const x = 194 + Math.floor(hash(i, 6, 19) * 22);
    const y = 40 + Math.floor(hash(i, 7, 19) * 50);
    tree(p, x, y, i % 2 ? 0xc0702c : 0x3e7a3a);
  }
  // the village fields by the Meadow Road
  for (let i = 0; i < 6; i++) {
    const x = 60 + (i % 3) * 7;
    const y = 74 + Math.floor(i / 3) * 5;
    wash(p, (xx, yy) => xx >= x && xx < x + 6 && yy >= y && yy < y + 4, i % 2 ? 0xd8b860 : 0x8ab05a, 0.45, 20 + i);
  }
  // the road: from the coast past each act's site
  road(p, [[14, 76], S[0], [72, 52], S[1], [128, 40], S[2], [192, 70], [218, 82]], S);
  // the sites
  mark(p, TENTS, { k: INK, R: 0xc04030, r: 0x8a2a20, Y: 0xd8a040, y: 0x9a6a20 }, S[0][0], S[0][1] + 2);
  mark(p, RUINS, { k: INK, S: 0xa8a49a }, S[1][0], S[1][1] + 2);
  mark(p, HOLLOW, { k: INK, O: 0xd07a2a, o: 0x9a4a1c, d: 0x2a1a10 }, S[2][0], S[2][1] + 2);
  compass(p, 177, 96);
}

function frostpeaks(p: Paper): void {
  const S = REGION_SITES.frostpeaks.acts;
  // snowfields over everything, a frozen lake, the glacier tongue
  wash(p, (x, y) => fbm(x * 0.05, y * 0.05, 31) > 0.52, 0xd8e8f0, 0.4, 32);
  const lake = blob(104, 92, 34, 12, 33);
  wash(p, lake, 0x9ac8e0, 0.6, 34);
  inkEdge(p, lake, 35, 0x4a6a80, 0.15);
  for (let i = 0; i < 9; i++) {
    const x = 78 + Math.floor(hash(i, 1, 36) * 52);
    const y = 86 + Math.floor(hash(i, 2, 36) * 12);
    if (lake(x, y)) for (let k = 0; k < 4; k++) p.set(x + k, y + (k % 2), 0x5a8aa8);
  }
  const glacier = blob(166, 46, 22, 30, 37);
  wash(p, glacier, 0xb0d8f0, 0.55, 38);
  inkEdge(p, glacier, 39, 0x4a6a80, 0.2);
  // the range: peaks back to front
  for (const [x, y, hgt, snow] of [
    [20, 34, 14, true],
    [60, 30, 16, true],
    [80, 40, 12, true],
    [128, 30, 18, true],
    [146, 52, 10, false],
    [24, 92, 10, false],
    [176, 96, 12, true],
    [150, 104, 9, false],
    // (the margins: the range runs on north, west and east)
    [-14, 46, 13, true],
    [-8, 104, 11, true],
    [40, 4, 12, true],
    [100, 2, 14, true],
    [170, 0, 12, true],
    [206, 56, 15, true],
    [204, 124, 11, false],
    [96, 128, 9, false],
  ] as const)
    mountain(p, x, y, hgt, snow);
  // pines in the valleys
  for (let i = 0; i < 26; i++) {
    const x = 6 + Math.floor(hash(i, 1, 40) * 182);
    const y = 50 + Math.floor(hash(i, 2, 40) * 58);
    if (!lake(x, y) && !glacier(x, y) && S.every(([sx, sy]) => Math.hypot(x - sx, y - sy) > 12)) pine(p, x, y, 0x3a6a5a);
  }
  road(p, [[-28, 52], [2, 58], S[0], [70, 70], S[1], [136, 50], S[2], [196, 14]], S, 0x6a5a6a);
  mark(p, FLAGS, { k: INK, R: 0xc04030, Y: 0xe0b040, B: 0x3a7ac0, G: 0x4a9a4a }, S[0][0], S[0][1] + 2);
  mark(p, CAVE, { k: INK, S: 0x8a94a8 }, S[1][0], S[1][1] + 2);
  mark(p, KEEP, { k: INK, S: 0xb8c0d0 }, S[2][0], S[2][1] + 2);
  compass(p, 177, 16);
}

function ashfell(p: Paper): void {
  const S = REGION_SITES.ashfell.acts;
  // ash plains (grey), basalt (dark), the volcano and its lava rivers
  wash(p, (x, y) => fbm(x * 0.05, y * 0.06, 51) > 0.4, 0xa09888, 0.45, 52);
  const basalt = blob(40, 30, 28, 16, 53);
  wash(p, basalt, 0x5a5452, 0.45, 54);
  for (let x = 18; x < 64; x += 3) for (let y = 20; y < 44; y++) if (basalt(x, y) && (y + x) % 5 === 0) p.set(x, y, 0x3a3432);
  // (the margins: more basalt east and south-west)
  for (const [bx, by, brx, bry, seed] of [
    [204, 34, 16, 22, 58],
    [-6, 118, 22, 12, 59],
    [150, -10, 26, 10, 60],
  ] as const) {
    const b2 = blob(bx, by, brx, bry, seed);
    wash(p, b2, 0x5a5452, 0.45, seed + 10);
    for (let x = bx - brx; x < bx + brx; x += 3) for (let y = by - bry; y < by + bry; y++) if (b2(x, y) && (y + x) % 5 === 0) p.set(x, y, 0x3a3432);
  }
  // the volcano: a broad cone with a glowing crater
  const vx = 112;
  const vy = 46;
  for (let k = 0; k < 34; k++) {
    const half = 6 + Math.round(k * 1.3);
    for (let dx = -half; dx <= half; dx++) {
      const y = vy - 26 + k;
      p.tint(vx + dx, y, dx > 0 ? 0x5a4a48 : 0x8a7a72, 0.7);
      if (dx > 0 && (dx + k) % 4 === 0) p.set(vx + dx, y, 0x4a3a38);
    }
    p.set(vx - half - 1, vy - 26 + k, INK);
    p.set(vx + half + 1, vy - 26 + k, INK);
  }
  for (let dx = -6; dx <= 6; dx++) {
    p.set(vx + dx, vy - 27, INK);
    p.set(vx + dx, vy - 26, Math.abs(dx) < 4 ? 0xffb030 : 0xe06020);
  }
  // lava rivers down the flanks and across the plain
  for (const flow of [
    [
      [vx - 2, vy - 24],
      [vx - 10, vy - 4],
      [86, 66],
      [60, 84],
      [30, 104],
      [6, 126],
    ],
    [
      [vx + 3, vy - 24],
      [vx + 14, vy],
      [150, 70],
      [176, 96],
      [204, 122],
    ],
  ] as Pt[][]) {
    const b = band(smooth(flow), (t) => 1 + t * 1.4);
    wash(p, b, 0xe0702a, 0.75, 55);
    inkEdge(p, band(smooth(flow), (t) => 2 + t * 1.4), 56, 0x8a2a14, 0.2);
  }
  // glass shards glinting near the warrens
  for (let i = 0; i < 14; i++) {
    const x = 84 + Math.floor(hash(i, 1, 57) * 34);
    const y = 66 + Math.floor(hash(i, 2, 57) * 18);
    p.set(x, y, i % 2 ? 0x6ae0e8 : 0xe06ad8);
    p.set(x, y - 1, 0xffffff);
  }
  road(p, [[-28, 94], [2, 88], S[0], [70, 76], S[1], [130, 44], S[2], [178, 4]], S, 0x5a3a2a);
  mark(p, BARRIER, { k: INK, R: 0xc04030, W: 0xf0e8d8 }, S[0][0], S[0][1] + 2);
  mark(p, CAVE, { k: INK, S: 0x6a6070 }, S[1][0], S[1][1] + 2);
  mark(p, FORGE, { k: INK, S: 0x4a4048, O: 0xff8a2a }, S[2][0], S[2][1] + 2);
  compass(p, 177, 96);
}

/** A region not reached yet: blank parchment under drifting grey fog (its map would spoil it). */
function fog(p: Paper): void {
  wash(p, (x, y) => fbm(x * 0.04, y * 0.05, 71) > 0.35, 0x8a8a96, 0.35, 72);
  wash(p, (x, y) => fbm(x * 0.07 + 3, y * 0.06, 73) > 0.55, 0x6a6a7a, 0.3, 74);
}

function regionMap(id: string): HTMLCanvasElement {
  const p = new Paper(REGION_MAP_W, REGION_MAP_H, REGION_PAD_X, REGION_PAD_Y);
  parchment(p, id.length * 13 + 1);
  if (id === 'greenmarch') greenmarch(p);
  else if (id === 'frostpeaks') frostpeaks(p);
  else if (id === 'ashfell') ashfell(p);
  else fog(p);
  return p.canvas();
}

// ------------------------------------------------------------------ the frame and the pedestal

const WOOD = [0x2e1a0e, 0x4e2c16, 0x6e4020, 0x8e5a2e, 0xb07a44, 0xd09a5e];

/** A carved wooden frame: bevelled (lit top-left), grain along each side, brass corner plates. */
function frame(): HTMLCanvasElement {
  const p = new Paper(FRAME_W, FRAME_H);
  const W = FRAME_W;
  const H = FRAME_H;
  const t = FRAME_IN;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d >= t) continue;
      if (d === 0) {
        p.set(x, y, 0x140c1c);
        continue;
      }
      const top = y < t && y <= x && y <= W - 1 - x;
      const left = x < t && x < y && x <= H - 1 - y;
      const lit = top || left;
      const grain = (top || y >= H - t ? noise(x * 0.3, y * 2, 81) : noise(x * 2, y * 0.3, 82)) * 0.3;
      let idx = (lit ? 3.4 : 1.8) + grain * 3 + (d === 1 ? (lit ? 1.2 : -0.6) : d === t - 1 ? -0.9 : 0);
      idx = Math.max(0, Math.min(5, idx));
      p.set(x, y, WOOD[Math.floor(idx)]);
    }
  // an ink line round the window, and a shadow just inside it on the map
  for (let x = t - 1; x <= W - t; x++) {
    p.set(x, t - 1, 0x140c1c);
    p.set(x, H - t, 0x140c1c);
  }
  for (let y = t - 1; y <= H - t; y++) {
    p.set(t - 1, y, 0x140c1c);
    p.set(W - t, y, 0x140c1c);
  }
  // brass corner plates with a rivet
  const brass = [0x5a3410, 0x9a5a14, 0xd8901c, 0xf2c230, 0xfff0a0];
  for (const [cx, cy] of [
    [0, 0],
    [W - 9, 0],
    [0, H - 9],
    [W - 9, H - 9],
  ])
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) {
        const lx = cx === 0 ? x : 8 - x;
        const ly = cy === 0 ? y : 8 - y;
        if (lx + ly > 9) continue;
        const edge = lx === 0 || ly === 0 || lx + ly === 9;
        p.set(cx + x, cy + y, edge ? 0x140c1c : brass[Math.min(4, 1 + Math.floor(((8 - lx - ly) / 8) * 3 + (lx < ly ? 0.5 : 0)))]);
        if (lx === 3 && ly === 3) p.set(cx + x, cy + y, brass[4]);
      }
  return p.canvas();
}

/** The chest's pedestal: a carved stone plinth, its top lit, a gold band, its foot a step wider. */
function pedestal(): HTMLCanvasElement {
  const p = new Paper(PEDESTAL_W, PEDESTAL_H);
  const STONE = [0x1c1c2c, 0x34344a, 0x545264, 0x78747c, 0xa09a96, 0xc8c0b2];
  const W = PEDESTAL_W;
  const H = PEDESTAL_H;
  const shape = (x: number, y: number) => {
    if (y < 1) return false;
    if (y < 6) return x >= 2 && x < W - 2; // the top slab
    if (y < H - 4) return x >= 6 && x < W - 6; // the waist
    return x >= 1 && x < W - 1; // the foot
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!shape(x, y)) continue;
      const out = !shape(x - 1, y) || !shape(x + 1, y) || !shape(x, y - 1) || !shape(x, y + 1);
      if (out) {
        p.set(x, y, 0x140c1c);
        continue;
      }
      let v = 2.4 - (x / W) * 1.4 + (noise(x * 0.5, y * 0.5, 91) - 0.5) * 0.8;
      if (y === 2 || y === H - 3) v += 1.6; // lit tops of the slab and the foot
      if (y === 5 || y === H - 5) v -= 1;
      p.set(x, y, STONE[Math.max(0, Math.min(5, Math.round(v)))]);
    }
  // a gold band round the waist, with a gem
  for (let x = 7; x < W - 7; x++) {
    p.set(x, 9, x < W / 2 ? 0xf2c230 : 0xd8901c);
    p.set(x, 10, 0x9a5a14);
  }
  p.set(W / 2 - 1, 9, 0xb06ae0);
  p.set(W / 2, 9, 0xdab0ff);
  p.set(W / 2 - 1, 10, 0x6e30a8);
  p.set(W / 2, 10, 0x9a52d8);
  return p.canvas();
}

// ------------------------------------------------------------------ the study (the screen's stage)

const ATLAS: StageSpec = {
  sky: ['#140e0c', '#1a1210', '#201614', '#261a16', '#2c1e18', '#30221a'],
  far: ['#22160f', '#3a281a'],
  near: ['#120c08', '#3a2616'],
  floor: ['#3a2818', '#46301c', '#523a22', '#3e2c1a', '#2a1c10'],
  floorY: 118,
  motif: 'study',
  light: 0xffd89a,
  disc: [0xc0905a, 0x6e4426, 0x4a2c18],
  accent: 0xffd890,
  twinkle: '#ffb040',
};

/** A plank wall: a picture rail, a small rack of rolled maps at the left, a lantern at the right; a desk below. */
function paintStudy(ctx: CanvasRenderingContext2D, w: number, sp: StageSpec, r: () => number): void {
  const fy = sp.floorY;
  const px = (x: number, y: number, c: string, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  // planks: seams, knots and grain
  for (let x = 0; x < w; x += 14) {
    px(x, 0, '#0e0806', 1, fy);
    px(x + 1, 0, '#2e2016', 1, fy);
    for (let y = 4 + Math.floor(r() * 30); y < fy; y += 30 + Math.floor(r() * 30)) px(x + 4 + Math.floor(r() * 6), y, '#140c08', 2, 1);
  }
  // a rack of rolled maps on the right: scroll ends in cubbyholes
  const rack = (x0: number, y0: number, cols: number, rowsN: number) => {
    px(x0 - 2, y0 - 2, '#120c08', cols * 9 + 3, rowsN * 9 + 3);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rowsN; j++) {
        const x = x0 + i * 9;
        const y = y0 + j * 9;
        px(x, y, '#0a0604', 8, 8);
        if (r() < 0.8) {
          px(x + 1, y + 2, '#c8a874', 6, 5);
          px(x + 2, y + 3, '#e8d4a8', 4, 3);
          px(x + 3, y + 4, '#8a6a44', 2, 1);
        }
      }
  };
  rack(2, 40, 2, 6);
  // a picture rail along the wall, and a lantern on a bracket at the right (its glow lights the pedestal)
  px(0, 15, '#120c08', w, 3);
  px(0, 15, '#5a3c22', w, 1);
  px(0, 17, '#2a1a10', w, 1);
  px(316, 22, '#2a1a10', 6, 2);
  px(318, 24, '#2a1a10', 1, 6);
  px(315, 30, '#2a1a10', 7, 2);
  px(316, 32, '#ffd890', 5, 7);
  px(317, 33, '#fff4c8', 3, 5);
  px(315, 39, '#2a1a10', 7, 2);
}

let painted = false;

/** Paint the region maps, the frame, the pedestal and register the study theme (once). */
export function ensureRegionArt(scene: Phaser.Scene, regionIds: string[]): void {
  if (!painted) {
    registerStageTheme(ATLAS_THEME, ATLAS, paintStudy);
    painted = true;
  }
  const add = (key: string, make: () => HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  };
  for (const id of regionIds) add(`rmap_${id}`, () => regionMap(id));
  add('rmap_fog', () => regionMap('?fog'));
  add('rmap_frame', frame);
  add('rmap_pedestal', pedestal);
}
