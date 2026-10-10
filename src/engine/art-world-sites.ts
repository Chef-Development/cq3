// The kingdom's world map, part two: what stands on the land (see art-world.ts for the land itself and
// docs/art-style.md for the rules). Trees are painted once as small lit sprites (a few variants per kind) and
// stamped densely, back to front, so forests read as canopies of separate crowns; buildings are character maps
// with a 1px ink outline; the big landmarks (the Bandit Captain's camp, the Old Ruins and the Golem's hall, the
// Boar King's hollow tree, the capital round the Great Pendulum, the mountain keep, the volcano, the stilt village)
// are painted from shapes lit from the top left. Painters claim the pixels they cover (`taken`), so the scatter
// that comes after (bushes, flowers, rocks) never lands on a roof or a road.
import { conifer, crown, hash, mass, mix, noise, pick, Pix, ramp, rng, col, type Blob, type Col, type Ramp } from './backdrop';

export type Pt = [number, number];

/** What the painters share: the base picture and the masks they read and claim. */
export interface WCtx {
  p: Pix;
  W: number;
  H: number;
  land: Uint8Array; // 1: land (and cliffs)
  reg: Uint8Array; // R_* per pixel
  water: Uint8Array; // inland water (1 river, 2 lake, 3 frozen, 4 lava, 5 marsh pool)
  road: Uint8Array;
  taken: Uint8Array; // a structure, tree or road is here: no scatter
  cover: Uint8Array; // something stands over the sea here: no waves or surf
  hot: Uint8Array; // lit up on the lava layer (1 fissure, 2 lava)
  rnd: () => number;
  /** Lit windows and chimney tops (the view twinkles and smokes them). */
  windows: Pt[];
  chimneys: Pt[];
}

export const R_SEA = 0;
export const R_GREEN = 1;
export const R_HEART = 2;
export const R_FROST = 3;
export const R_ASH = 4;
export const R_DUSK = 5;

export const INK = col('#140c1c');
const LEAF_INK = col('#0c1c16');

export const P = (o: Record<string, string>): Record<string, Col> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, col(v)]));

// ------------------------------------------------------------------ stamping

/** Stamp a character map with a 1px outline (`outline` null: none); its pixels are claimed. */
export function spr(c: WCtx | Pix, rows: string[], pal: Record<string, Col>, x: number, y: number, outline: Col | null = INK): void {
  const p = c instanceof Pix ? c : c.p;
  const claim = c instanceof Pix ? null : c;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const on = (i: number, j: number) => j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== '.';
  const set = (X: number, Y: number, v: Col) => {
    if (X < 0 || Y < 0 || X >= p.w || Y >= p.h) return;
    p.buf[Y * p.w + X] = v;
    if (claim) claim.taken[Y * p.w + X] = 1;
  };
  if (outline !== null)
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) set(x + i, y + j, outline);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch !== '.' && pal[ch] !== undefined) set(x + i, y + j, pal[ch]);
    }
}

/** Copy a sprite buffer's opaque pixels onto the map (claimed unless `claim` is false). */
export function blit(c: WCtx, s: Pix, x: number, y: number, claim = true): void {
  const { p, W, H } = c;
  for (let j = 0; j < s.h; j++) {
    const Y = y + j;
    if (Y < 0 || Y >= H) continue;
    for (let i = 0; i < s.w; i++) {
      const v = s.buf[j * s.w + i];
      const X = x + i;
      if (v < 0 || X < 0 || X >= W) continue;
      p.buf[Y * W + X] = v;
      if (claim) c.taken[Y * W + X] = 1;
    }
  }
}

/** Darken an elliptical patch (a cast shadow on the ground). */
export function shade(p: Pix, cx: number, cy: number, rx: number, ry: number, k: number, to = SHADE): void {
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(p.h - 1, cy + ry); y++)
    for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(p.w - 1, cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const i = y * p.w + x;
      if (dx * dx + dy * dy <= 1 && p.buf[i] >= 0) p.buf[i] = mix(p.buf[i], to, k);
    }
}
const SHADE = col('#10101e');

/** A free spot: land of one of `regs`, nothing claimed, no road or water, over the whole w x h box. */
export function free(c: WCtx, x: number, y: number, w: number, h: number, regs: number[]): boolean {
  const { W, H } = c;
  if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) {
      const k = j * W + i;
      if (!c.land[k] || c.taken[k] || c.road[k] || c.water[k] || !regs.includes(c.reg[k])) return false;
    }
  return true;
}

export function claimBox(c: WCtx, x: number, y: number, w: number, h: number): void {
  for (let j = Math.max(0, y); j < Math.min(c.H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(c.W, x + w); i++) c.taken[j * c.W + i] = 1;
}

// ------------------------------------------------------------------ trees (sprites painted once, stamped many times)

export const LEAF = ramp('#10241c', '#1a3a26', '#285430', '#3e7432', '#5e9836', '#8cbc44', '#c0dc5c');
const LEAF_DEEP = ramp('#0c1e1c', '#14301f', '#1e4628', '#2e602c', '#468032', '#6ea23c');
const AUTUMN = ramp('#3e1418', '#6a1c1e', '#9e2e22', '#d0502a', '#ee8236', '#ffbe58');
const AUTUMN_DARK = ramp('#1e0c18', '#341020', '#561a26', '#80262a', '#ac3c2c', '#d0602e');
const GOLDEN = ramp('#4a3010', '#7a5418', '#b08224', '#dcae3a', '#f6d662');
const PINE = ramp('#0c1a1c', '#132a28', '#1c3e34', '#2a5640', '#3e704a');
const PINE_SNOW = ramp('#1a2a34', '#2a4248', '#3e6058', '#c8d8ec', '#f4f8ff');
const WILLOW = ramp('#141e14', '#1e2e1c', '#2c4026', '#40562e', '#5a6e38', '#7a8a48');
const BARK = ramp('#2a1810', '#4a2c18', '#6e4426');

export interface TreeSet {
  oak: Pix[];
  small: Pix[];
  deep: Pix[];
  autumn: Pix[];
  dark: Pix[];
  golden: Pix[];
  fruit: Pix[];
  pine: Pix[];
  snowpine: Pix[];
  willow: Pix[];
  dead: Pix[];
  ash: Pix[];
}

/** A round broadleaf: a scalloped crown lit as one volume over a short trunk. */
function broadleaf(seed: number, r: number, leaf: Ramp, outline: Col, fruit?: Col[]): Pix {
  const w = Math.ceil(r * 2 + 4);
  const h = Math.ceil(r * 2 + 4);
  const p = new Pix(w, h, -1);
  const cx = w / 2;
  const cy = r + 1.5;
  // trunk
  for (let y = Math.round(cy + r * 0.5); y < h - 1; y++) {
    p.set(Math.floor(cx) - 1, y, BARK[1]);
    p.set(Math.floor(cx), y, BARK[2]);
  }
  const blobs = r < 2.6 ? [{ x: cx, y: cy, rx: r, ry: r * 0.9 }] : crown(rng(seed), cx, cy, r, r * 0.88, Math.max(1.4, r * 0.48));
  mass(p, blobs, { ramp: leaf, seed, bump: 0.22, tex: 0.22, vgrad: 0.16, light: 0.05, shadow: 0.28, outline, form: { x: cx - r * 0.2, y: cy - r * 0.1, rx: r * 1.15, ry: r * 1.05 }, formMix: 0.55 });
  if (fruit)
    for (let k = 0; k < 3; k++) {
      const fx = Math.round(cx - r * 0.5 + hash(k, seed, 5) * r);
      const fy = Math.round(cy - r * 0.3 + hash(k, seed, 6) * r * 0.7);
      if (p.get(fx, fy) >= 0 && p.get(fx, fy) !== outline) p.set(fx, fy, fruit[k % fruit.length]);
    }
  return p;
}

function pineSprite(seed: number, hgt: number, wid: number, r: Ramp, outline: Col): Pix {
  const w = wid + 4;
  const h = hgt + 3;
  const p = new Pix(w, h, -1);
  p.set(Math.floor(w / 2), h - 2, BARK[1]);
  p.set(Math.floor(w / 2), h - 1, BARK[0]);
  conifer(p, rng(seed), w / 2, h - 2, hgt, wid, { ramp: r, seed, bump: 0.12, tex: 0.12, shadow: 0.25, outline });
  return p;
}

/** A crooked dead tree: a grey trunk with bare forked branches. */
function deadSprite(seed: number, hgt: number, light: Col, dark: Col): Pix {
  const p = new Pix(9, hgt + 2, -1);
  const cx = 4;
  for (let k = 0; k < hgt; k++) {
    const x = cx + (k > hgt * 0.6 ? (seed % 2 ? 1 : -1) : 0);
    p.set(x, hgt - k, k % 3 === 2 ? dark : light);
    p.set(x + 1, hgt - k, dark);
  }
  const arms: Pt[] = seed % 2 ? [[-1, -4], [-2, -5], [-3, -6], [2, -5], [3, -6], [3, -7], [-1, -7]] : [[1, -4], [2, -5], [3, -5], [-2, -6], [-3, -7], [-2, -7], [1, -7]];
  for (const [dx, dy] of arms) p.set(cx + dx, hgt + dy + 1, dx < 0 ? light : dark);
  // a 1px ink outline round it
  const out = new Pix(p.w, p.h, -1);
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (p.get(x, y) >= 0) out.set(x, y, p.get(x, y));
      else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => p.get(x + dx, y + dy) >= 0)) out.set(x, y, INK);
    }
  return out;
}

/** A weeping willow: a low drooping crown with hanging strands. */
function willowSprite(seed: number): Pix {
  const p = new Pix(13, 12, -1);
  const blobs: Blob[] = [
    { x: 6.5, y: 4, rx: 4.6, ry: 3.2 },
    { x: 4, y: 6, rx: 3, ry: 2.6 },
    { x: 9, y: 6, rx: 3, ry: 2.6 },
  ];
  p.set(6, 10, BARK[1]);
  p.set(6, 9, BARK[2]);
  p.set(7, 10, BARK[0]);
  mass(p, blobs, { ramp: WILLOW, seed, bump: 0.18, tex: 0.25, vgrad: 0.2, shadow: 0.3, outline: col('#0a120c') });
  for (let k = 0; k < 6; k++) {
    const x = 2 + Math.round(hash(k, seed, 3) * 8);
    for (let j = 7; j < 10 + (k % 2); j++) if (p.get(x, j) < 0 || j > 8) p.set(x, j, j > 8 ? WILLOW[2] : WILLOW[3]);
  }
  return p;
}

let TREES: TreeSet | null = null;

/** The tree sprites (painted once). */
export function trees(): TreeSet {
  if (TREES) return TREES;
  const fruitCols = [col('#ff5a4a'), col('#ffd060'), col('#ff8ac0')];
  const ashGrey = col('#6a5e5c');
  const ashDark = col('#3a3032');
  TREES = {
    oak: [0, 1, 2, 3].map((i) => broadleaf(11 + i, 3.1 + (i % 2) * 0.6, LEAF, LEAF_INK)),
    small: [0, 1, 2].map((i) => broadleaf(31 + i, 2.3 + (i % 2) * 0.3, LEAF, LEAF_INK)),
    deep: [0, 1, 2, 3].map((i) => broadleaf(41 + i, 3.2 + (i % 2) * 0.7, LEAF_DEEP, col('#08140f'))),
    autumn: [0, 1, 2].map((i) => broadleaf(51 + i, 3 + (i % 2) * 0.7, AUTUMN, col('#2a0c10'))),
    dark: [0, 1, 2, 3].map((i) => broadleaf(61 + i, 3.2 + (i % 2) * 0.8, AUTUMN_DARK, col('#12060c'))),
    golden: [0, 1].map((i) => broadleaf(71 + i, 3 + i * 0.5, GOLDEN, col('#2a1a08'))),
    fruit: [0, 1, 2].map((i) => broadleaf(81 + i, 2.4, LEAF, LEAF_INK, [fruitCols[i], fruitCols[(i + 1) % 3]])),
    pine: [0, 1, 2].map((i) => pineSprite(91 + i, 8 + i, 5 + (i % 2), PINE, col('#081214'))),
    snowpine: [0, 1, 2].map((i) => pineSprite(101 + i, 6 + i, 4 + (i % 2), PINE_SNOW, col('#0c1620'))),
    willow: [0, 1].map((i) => willowSprite(111 + i)),
    dead: [0, 1].map((i) => deadSprite(121 + i, 7 + i, col('#8a8078'), col('#4e4644'))),
    ash: [0, 1].map((i) => deadSprite(131 + i, 6 + i, ashGrey, ashDark)),
  };
  return TREES;
}

/** Stamp a tree with its feet (trunk foot) at (x, y), with a soft shadow on the ground to its lower right. */
export function tree(c: WCtx, s: Pix, x: number, y: number, shadowK = 0.32): void {
  const left = Math.round(x - s.w / 2);
  const top = Math.round(y - s.h + 1);
  if (shadowK > 0) shade(c.p, x + 1.5, y, s.w * 0.42, 1.3, shadowK);
  blit(c, s, left, top);
}

/**
 * A forest: tree sprites packed on a jittered grid inside `inside`, stamped back to front so every crown overlaps
 * the one behind it. `pickTree` chooses the sprite per spot (null: a clearing).
 */
export function forest(c: WCtx, x0: number, y0: number, x1: number, y1: number, step: number, inside: (x: number, y: number) => boolean, pickTree: (x: number, y: number, r: number) => Pix | null, shadowK = 0.22): void {
  const spots: Array<[number, number, Pix]> = [];
  let row = 0;
  for (let y = y0; y < y1; y += step * 0.72, row++)
    for (let x = x0 + (row % 2) * step * 0.5; x < x1; x += step) {
      const jx = Math.round(x + (hash(Math.round(x), Math.round(y), 401) - 0.5) * step * 0.7);
      const jy = Math.round(y + (hash(Math.round(x), Math.round(y), 402) - 0.5) * step * 0.4);
      if (jx < 2 || jy < 2 || jx >= c.W - 2 || jy >= c.H - 2) continue;
      const k = jy * c.W + jx;
      if (!c.land[k] || c.road[k] || c.water[k] || c.taken[k] || !inside(jx, jy)) continue;
      // keep trunks off the road and the water just below
      if (c.road[k + c.W] || c.water[k + c.W] || c.road[k + 2 * c.W] || c.water[k + 2 * c.W] || !c.land[k + 2 * c.W]) continue;
      const s = pickTree(jx, jy, hash(jx, jy, 403));
      if (s) spots.push([jx, jy, s]);
    }
  spots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, s] of spots) tree(c, s, x, y, shadowK);
}

// ------------------------------------------------------------------ buildings

const ROOF_RED = P({ q: '#f6684e', r: '#d23a30', R: '#8e2026' });
const ROOF_BLUE = P({ q: '#6aa0f0', r: '#3a6ad0', R: '#22408a' });
const ROOF_THATCH = P({ q: '#f2d878', r: '#d0a848', R: '#8a6a2a' });
const ROOF_SLATE = P({ q: '#8a94b4', r: '#5e6688', R: '#383e5a' });
const ROOF_GREEN = P({ q: '#8ad070', r: '#4a9a48', R: '#2a5a30' });
export const WINDOW = col('#3a2a48');
const WALLS = P({ w: '#f4e6c0', W: '#c4a47a', k: '#3a2a48', d: '#6e4020', s: '#d8ccb0', S: '#a8987c' });
const WALLS_STONE = P({ w: '#d8d4cc', W: '#9a948c', k: '#3a2a48', d: '#4e3420', s: '#d8ccb0', S: '#a8987c' });
export const ROOFS = { red: ROOF_RED, blue: ROOF_BLUE, thatch: ROOF_THATCH, slate: ROOF_SLATE, green: ROOF_GREEN };
export type RoofKind = keyof typeof ROOFS;

const HOUSES: Array<{ rows: string[]; chimney: Pt }> = [
  { rows: ['..qR..', '.qqrR.', 'qqqrRR', 'wwwwWW', 'wkwdWW'], chimney: [4, -1] },
  { rows: ['.qqrR..', 'qqqqrR.', 'qqqqrRR', 'wwkwwWW', 'wwwdwWW'], chimney: [5, -1] },
  { rows: ['...qR...', '..qqrR..', '.qqqrRR.', 'qqqqrRRR', 'wkwwdwWW', 'wwwwdwWW'], chimney: [6, 0] },
  { rows: ['.qR..', 'qqrR.', 'qqrRR', 'wkwWW'], chimney: [3, -1] },
];

/** A house (variant `v`, roof `roof`) with its top-left at (x, y); its windows and chimney are recorded. */
export function house(c: WCtx, x: number, y: number, v: number, roof: RoofKind, stone = false, smoke = true): void {
  const h = HOUSES[v % HOUSES.length];
  shade(c.p, x + h.rows[0].length / 2 + 1.5, y + h.rows.length, h.rows[0].length / 2 + 0.8, 1.2, 0.35);
  spr(c, h.rows, { ...(stone ? WALLS_STONE : WALLS), ...ROOFS[roof] }, x, y);
  h.rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === 'k') c.windows.push([x + i, y + j]);
  });
  if (smoke) c.chimneys.push([x + h.chimney[0], y + h.chimney[1]]);
}

/** Houses scattered round (cx, cy) inside an ellipse, on free land, back to front. Returns how many stand. */
export function village(c: WCtx, cx: number, cy: number, rx: number, ry: number, n: number, seed: number, roofs: RoofKind[], regs: number[], stone = false): number {
  const spots: Array<[number, number, number]> = [];
  for (let k = 0; k < n * 14 && spots.length < n; k++) {
    const a = hash(k, seed, 1) * Math.PI * 2;
    const d = Math.sqrt(hash(k, seed, 2));
    const x = Math.round(cx + Math.cos(a) * rx * d - 3);
    const y = Math.round(cy + Math.sin(a) * ry * d - 3);
    const v = Math.floor(hash(k, seed, 3) * HOUSES.length);
    const w = HOUSES[v].rows[0].length + 2;
    const h = HOUSES[v].rows.length + 2;
    if (!free(c, x - 1, y - 1, w, h + 1, regs)) continue;
    if (spots.some(([sx, sy]) => Math.abs(sx - x) < 7 && Math.abs(sy - y) < 5)) continue;
    spots.push([x, y, v]);
    claimBox(c, x - 1, y - 1, w, h);
  }
  spots.sort((a, b) => a[1] - b[1]);
  spots.forEach(([x, y, v], i) => house(c, x, y, v, roofs[Math.floor(hash(i, seed, 4) * roofs.length)], stone, hash(i, seed, 5) < 0.6));
  return spots.length;
}

// ------------------------------------------------------------------ fields, orchards, paddocks

const CROPS = {
  wheat: [col('#e8c860'), col('#d8b048'), col('#f2dc84')],
  green: [col('#8cc44c'), col('#a8d458'), col('#78b040')],
  ploughed: [col('#8a5a34'), col('#6e4426'), col('#a06a3c')],
  lavender: [col('#a07ad8'), col('#c09cf0'), col('#7a5ab0')],
  pasture: [col('#6aa840'), col('#88bc48'), col('#5a9a3c')],
  vine: [col('#4a7e36'), col('#2e5a32'), col('#9a6a3e')],
  flax: [col('#7ab8e0'), col('#9ad0f0'), col('#5a98c0')],
};
export type Crop = keyof typeof CROPS;

/**
 * Patchwork fields inside an ellipse: skewed parcels of crops with hedgerows between them, some left as meadow.
 * Only on free land of `regs` (roads, rivers and buildings stay as they are).
 */
export function fields(c: WCtx, cx: number, cy: number, rx: number, ry: number, seed: number, crops: Crop[], regs: number[], cell = 9, rowH = 5): void {
  const { p, W } = c;
  const hedge = [col('#2e5a32'), col('#1e3c2a')];
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= c.H - 1) continue;
      const k = y * W + x;
      if (!c.land[k] || c.taken[k] || c.road[k] || c.water[k] || !regs.includes(c.reg[k])) continue;
      if (!c.land[k + W] || !c.land[k - 1] || !c.land[k + 1]) continue;
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e > 1 - (noise(x * 0.2, y * 0.2, seed) - 0.5) * 0.3) continue;
      const row = Math.floor((y - cy + ry) / rowH);
      const sx = x + row * 3 - (y - cy) * 0.35;
      const ci = Math.floor(sx / cell);
      const fy = Math.floor(y - cy + ry) % rowH;
      const fx = ((Math.floor(sx) % cell) + cell) % cell;
      if (hash(ci, row, seed) < 0.18) continue; // some meadow left wild
      const crop = crops[Math.floor(hash(ci, row, seed + 1) * crops.length)];
      const pal = CROPS[crop];
      let v = pal[0];
      if (crop === 'ploughed' || crop === 'vine') v = x % 2 === 0 ? pal[1] : pal[0];
      else if (crop === 'wheat' || crop === 'lavender' || crop === 'flax') v = fy === 1 ? pal[2] : fy === 3 ? pal[1] : pal[0];
      else if (hash(x, y, seed + 2) < 0.15) v = pal[1];
      if (crop === 'vine' && fy % 2 === 0) v = pal[1];
      // the parcel's lit top edge
      if (fy === 0) v = mix(v, col('#fff4c8'), 0.18);
      if (fy === rowH - 1 || fx === 0) v = hedge[(x + y) % 3 === 0 ? 1 : 0];
      p.buf[k] = v;
      c.taken[k] = 1;
    }
}

/** An orchard: rows of small fruit trees. */
export function orchard(c: WCtx, x0: number, y0: number, cols: number, rowsN: number, regs: number[]): void {
  const T = trees();
  for (let j = 0; j < rowsN; j++)
    for (let i = 0; i < cols; i++) {
      const x = x0 + i * 6 + (j % 2) * 3;
      const y = y0 + j * 5;
      if (!free(c, x - 1, y - 1, 3, 2, regs)) continue;
      tree(c, T.fruit[(i + j) % T.fruit.length], x, y, 0.3);
    }
}

/** A fenced paddock (the view grazes animals inside). */
export function paddock(c: WCtx, x: number, y: number, w: number, h: number): void {
  const { p } = c;
  const wood = col('#d0a46a');
  const post = col('#8e5a2e');
  const dark = col('#3a2a1a');
  for (let i = x; i <= x + w; i++)
    for (const j of [y, y + h]) {
      const isPost = (i - x) % 4 === 0;
      if (isPost) p.set(i, j - 1, wood);
      p.set(i, j, isPost ? post : wood);
      p.set(i, j + 1, dark);
    }
  for (let j = y + 1; j < y + h; j++)
    for (const i of [x, x + w]) {
      p.set(i, j, (j - y) % 3 === 0 ? post : wood);
      p.set(i + 1, j, i === x ? mix(p.get(i + 1, j), col('#10241c'), 0.3) : dark);
    }
  claimBox(c, x, y - 1, w + 2, h + 3);
}

// ------------------------------------------------------------------ small props

export const MILL = ['.rrR.', 'rrrRR', '.wwW.', '.wkW.', '.wwW.', 'wwwWW', 'wwdWW'];
export const MILL_PAL = P({ r: '#d23a30', R: '#8e2026', w: '#f4e6c0', W: '#c4a47a', k: '#3a2a48', d: '#6e4020' });

/** A windmill's body with its sail hub at (x, y) (the view turns the sails). */
export function windmill(c: WCtx, x: number, y: number): void {
  shade(c.p, x + 2, y + 7, 3.5, 1.2, 0.35);
  spr(c, MILL, MILL_PAL, x - 2, y - 1);
  claimBox(c, x - 6, y - 6, 13, 14);
}

const STONES = ['.sS.', 'sSSm', 'sSSm', 'sSmm', 'sSmm'];
const STONE_PAL = P({ s: '#d8d2c8', S: '#a8a29a', m: '#6e6a74' });

/** A ring of standing stones on a hill, one fallen. */
export function standingStones(c: WCtx, cx: number, cy: number): void {
  shade(c.p, cx, cy + 1, 11, 4, 0.18);
  const n = 7;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.sin((a / n) * Math.PI * 2) - Math.sin((b / n) * Math.PI * 2));
  for (const i of order) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 9 - 2);
    const y = Math.round(cy + Math.sin(a) * 3.6 - 5);
    if (i === 2) spr(c, ['sSSSm', 'mmmmm'], STONE_PAL, x - 1, y + 4);
    else spr(c, STONES, STONE_PAL, x, y);
  }
  // the altar stone in the middle
  spr(c, ['sSSSm', 'smmmm'], STONE_PAL, cx - 2, cy - 2);
}

/** A campsite: a little tent and a fire ring (the view flickers the fire and lifts its smoke). */
export function campsite(c: WCtx, x: number, y: number, fires: Pt[], tentCol = '#d8a040'): void {
  shade(c.p, x + 3, y + 4, 5, 1.2, 0.3);
  spr(c, ['..t..', '.tTd.', 'tTkTd', 'TTkdd'], P({ t: tentCol, T: '#b07a30', d: '#7a4e20', k: '#2a1c14' }), x - 2, y);
  spr(c, ['s.s', '.k.', 's.s'], P({ s: '#8a8278', k: '#3a2418' }), x + 5, y + 2, null);
  fires.push([x + 6, y + 3]);
}

/** A wooden bridge across water, spanning (x0..x1, y) (horizontal) with rails. */
export function bridgeAt(c: WCtx, x: number, y: number, vertical: boolean, len: number): void {
  const plank = [col('#c08a50'), col('#a06c3a')];
  const rail = col('#6e4020');
  if (!vertical)
    for (let i = 0; i < len; i++) {
      c.p.set(x + i, y - 1, rail);
      c.p.set(x + i, y, plank[i % 2]);
      c.p.set(x + i, y + 1, plank[(i + 1) % 2]);
      c.p.set(x + i, y + 2, rail);
      c.p.set(x + i, y + 3, col('#2a1a10'));
    }
  else
    for (let j = 0; j < len; j++) {
      c.p.set(x - 1, y + j, rail);
      c.p.set(x, y + j, plank[j % 2]);
      c.p.set(x + 1, y + j, plank[j % 2]);
      c.p.set(x + 2, y + j, rail);
    }
}

// ------------------------------------------------------------------ Act 1: the Bandit Captain's camp

/** The Bandit Captain's camp: a palisade ring round striped tents, a skull banner, a fire, crates. */
export function banditCamp(c: WCtx, cx: number, cy: number, fires: Pt[]): void {
  const { p } = c;
  const rx = 15;
  const ry = 8;
  const dirt = ramp('#6e4a2a', '#8a603a', '#a87a4a', '#c0905a');
  shade(p, cx + 2, cy + 2, rx + 3, ry + 2, 0.25);
  // trodden ground inside
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e > 1) continue;
      p.set(x, y, pick(dirt, 0.65 - e * 0.35 + (hash(x, y, 7) - 0.5) * 0.3, x, y));
    }
  claimBox(c, cx - rx - 2, cy - ry - 4, rx * 2 + 5, ry * 2 + 7);
  const stake = (x: number, y: number, front: boolean) => {
    const hgt = front ? 3 : 4;
    for (let k = 0; k < hgt; k++) p.set(x, y - k, k === hgt - 1 ? col('#d09a5e') : x % 2 ? col('#8e5a2e') : col('#b07a44'));
    p.set(x, y - hgt, INK);
    p.set(x, y + 1, col('#2a1810'));
  };
  // the back of the palisade
  for (let x = cx - rx; x <= cx + rx; x++) {
    const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
    stake(x, y, false);
  }
  // tents: striped red and purple, a dark doorway
  const tent = (tx: number, ty: number, s: number) => {
    const purple = ramp('#36244e', '#523a72', '#7a5a9a', '#a888c8');
    const red = ramp('#4a0f1a', '#8a1a22', '#d03030', '#f05a48');
    for (let y = 0; y <= s; y++) {
      const half = y * 0.75 + 0.5;
      for (let x = Math.round(tx - half); x <= Math.round(tx + half); x++) {
        const u = (x + 0.5 - tx) / (y + 1.5);
        const r = Math.floor((u + 1) * 2.5) % 2 ? red : purple;
        let v = x < tx ? 0.85 : 0.45;
        if (y === s) v -= 0.3;
        p.set(x, ty + y, pick(r, v, x, ty + y));
      }
    }
    for (let y = Math.round(s * 0.45); y <= s; y++) p.set(tx, ty + y, col('#140a18'));
    for (let y = -1; y <= s; y++) {
      const half = y * 0.75 + 0.5;
      p.set(Math.round(tx - half) - 1, ty + y, INK);
      p.set(Math.round(tx + half) + 1, ty + y, INK);
    }
    p.set(tx, ty - 1, INK);
  };
  tent(cx - 7, cy - 6, 6);
  tent(cx + 7, cy - 5, 6);
  tent(cx, cy - 3, 8);
  // the skull banner on its pole
  for (let y = cy - 16; y < cy - 3; y++) p.set(cx + 12, y, col('#6e4020'));
  spr(c, ['kkkkk', 'keekk', 'kekek', 'keeek', 'kkkk.'], P({ k: '#1c1430', e: '#f4ead4' }), cx + 13, cy - 16, null);
  p.set(cx + 12, cy - 17, col('#f2c230'));
  // crates and a barrel by the fire
  spr(c, ['jjH', 'jdH', 'ddd'], P({ j: '#d09a5e', H: '#b07a44', d: '#6e4020' }), cx - 12, cy + 1);
  spr(c, ['.hh', 'hHd', 'yyY', 'hHd'], P({ h: '#8e5a2e', H: '#b07a44', d: '#4e2c16', y: '#7c86a6', Y: '#4a5272' }), cx + 9, cy + 1);
  spr(c, ['s.s', '.k.', 's.s'], P({ s: '#8a8278', k: '#3a2418' }), cx - 3, cy + 4, null);
  fires.push([cx - 2, cy + 5]);
  // the front of the palisade, the gate gap on the north-west (the road comes in there)
  for (let x = cx - rx; x <= cx + rx; x++) {
    const y = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
    if (x > cx - 4 && x < cx + 1) continue;
    stake(x, y, true);
  }
  for (let y = cy - ry + 2; y <= cy + ry - 2; y++)
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * rx * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / ry) ** 2)));
      stake(x, y, false);
    }
}

// ------------------------------------------------------------------ Act 2: the Old Ruins and the Golem's hall

const STONE = ramp('#24232e', '#3a3848', '#565466', '#78747e', '#a09a98', '#c8c0b2', '#e2dace');
const MOSS = ramp('#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850');
const RUNE = ramp('#14524e', '#22a098', '#62e4d4', '#d8fff6');

/** Masonry block: courses of stone lit from the left, moss creeping over the top. */
function masonry(c: WCtx, x0: number, y0: number, w: number, h: number, seed: number, mossy = true): void {
  const { p } = c;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const u = (x - x0) / Math.max(1, w - 1);
      let v = 0.8 - u * 0.5 + (hash(x, y, seed) - 0.5) * 0.18;
      if (y === y0) v += 0.15;
      const course = (y - y0) % 3 === 2 || ((x - x0 + (((y - y0) / 3) | 0) * 2) % 5 === 4 && (y - y0) % 3 !== 2);
      if (course) v -= 0.3;
      p.set(x, y, pick(STONE, v, x, y));
      if (mossy && y - y0 < 2 && noise(x * 0.5, y, seed) > 0.5) p.set(x, y, pick(MOSS, 0.75 - u * 0.4, x, y));
    }
  claimBox(c, x0, y0, w, h);
}

/** A broken round tower: a lit cylinder with a jagged top, a dark window slit. */
function brokenTower(c: WCtx, cx: number, base: number, r: number, hgt: number, seed: number): void {
  const { p } = c;
  shade(p, cx + r + 1, base + 1, r + 3, 1.5, 0.3);
  const top: number[] = [];
  for (let x = -r; x <= r; x++) top.push(base - hgt + Math.round(Math.abs(noise(x * 0.9, 1, seed) - 0.5) * 8 + (x > 0 ? x * 0.6 : 0)));
  for (let x = -r; x <= r; x++) {
    const t = top[x + r];
    for (let y = t; y <= base; y++) {
      const u = (x + r) / (2 * r);
      let v = 0.92 - u * 0.75 + (hash(x, y, seed) - 0.5) * 0.12;
      if ((y - t) % 3 === 2) v -= 0.18;
      if (y === t) v += 0.25;
      p.set(cx + x, y, pick(STONE, v, cx + x, y));
      if (y - t < 1 && noise(x, y * 0.5, seed) > 0.45) p.set(cx + x, y, MOSS[3]);
    }
    p.set(cx + x, top[x + r] - 1, INK);
  }
  for (let y = Math.min(...top); y <= base; y++) {
    p.set(cx - r - 1, y, INK);
    p.set(cx + r + 1, y, INK);
  }
  // a window slit and an arched door
  const wy = base - Math.round(hgt * 0.6);
  if (wy > Math.max(...top) + 1) {
    p.set(cx - 1, wy, col('#140c1c'));
    p.set(cx - 1, wy + 1, col('#140c1c'));
  }
  for (let y = base - 3; y <= base; y++) for (let x = cx - 1; x <= cx; x++) p.set(x, y, y === base - 3 && x === cx ? STONE[2] : col('#120c18'));
  claimBox(c, cx - r - 1, base - hgt - 2, 2 * r + 3, hgt + 3);
}

/** The Old Ruins: broken towers either side of the Golem's hall (a pillared front under a fallen roof, its runes
 *  glowing teal), rubble and fallen columns about. (cx, base) = the hall's doorstep. */
export function oldRuins(c: WCtx, cx: number, base: number, glows: Pt[]): void {
  const { p } = c;
  // a paved terrace
  for (let y = base - 1; y <= base + 3; y++)
    for (let x = cx - 18; x <= cx + 18; x++) {
      if (Math.abs(x - cx) > 18 - (y - base + 1)) continue;
      p.set(x, y, pick(STONE, 0.62 + (hash(x, y, 3) - 0.5) * 0.3 - (y - base) * 0.05 - ((x + y) % 4 === 0 ? 0.2 : 0), x, y));
    }
  shade(p, cx + 4, base + 1, 16, 2, 0.25);
  brokenTower(c, cx - 19, base + 1, 3, 16, 5);
  // the hall: back wall, columns, the fallen roof's pediment
  masonry(c, cx - 12, base - 13, 24, 13, 7);
  // the dark doorway, tall, with runes round it
  for (let y = base - 9; y <= base; y++)
    for (let x = cx - 3; x <= cx + 3; x++) {
      const arch = y < base - 7 && Math.abs(x + 0.5 - cx) > (y - (base - 10)) * 1.4;
      if (!arch) p.set(x, y, y > base - 2 ? col('#1a1424') : col('#0c0a12'));
    }
  for (const [x, y] of [
    [cx - 5, base - 8],
    [cx + 5, base - 8],
    [cx - 5, base - 4],
    [cx + 5, base - 4],
    [cx, base - 11],
  ] as Pt[]) {
    p.set(x, y, RUNE[2]);
    p.set(x, y - 1, RUNE[1]);
    glows.push([x, y]);
  }
  // columns in front of the wall (one broken)
  const column = (x: number, hgt: number) => {
    for (let y = base - hgt; y <= base; y++) {
      p.set(x - 1, y, INK);
      p.set(x, y, STONE[6]);
      p.set(x + 1, y, STONE[4]);
      p.set(x + 2, y, STONE[2]);
      p.set(x + 3, y, INK);
    }
    for (let x2 = x - 1; x2 <= x + 3; x2++) {
      p.set(x2, base - hgt - 1, x2 === x - 1 || x2 === x + 3 ? INK : STONE[5]);
      p.set(x2, base - hgt - 2, INK);
    }
  };
  column(cx - 11, 14);
  column(cx - 8, 12);
  column(cx + 6, 13);
  column(cx + 9, 6);
  // the pediment, cracked through on the right
  for (let k = 0; k < 6; k++) {
    const y = base - 19 + k;
    const half = 3 + k * 2.4;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (x > cx + 6 && k < 4) continue;
      p.set(x, y, pick(STONE, (k === 0 ? 0.95 : 0.7) - (x - cx + half) / (half * 2) * 0.4, x, y));
    }
    p.set(Math.round(cx - half) - 1, y, INK);
    if (!(k < 4)) p.set(Math.round(cx + half) + 1, y, INK);
  }
  for (let x = cx - 4; x <= cx + 4; x++) p.set(x, base - 20, INK);
  p.set(cx, base - 17, RUNE[3]);
  glows.push([cx, base - 17]);
  claimBox(c, cx - 18, base - 21, 37, 22);
  // the second, taller tower behind on the right, and a stump
  brokenTower(c, cx + 18, base, 4, 22, 9);
  brokenTower(c, cx + 25, base + 3, 2, 6, 11);
  // a fallen column and rubble
  for (let x = cx - 26; x < cx - 19; x++) {
    p.set(x, base + 4, STONE[5]);
    p.set(x, base + 5, STONE[3]);
    p.set(x, base + 6, INK);
  }
  p.set(cx - 27, base + 4, INK);
  p.set(cx - 27, base + 5, INK);
  for (const [x, y] of [
    [cx + 13, base + 2],
    [cx - 15, base + 3],
    [cx + 22, base + 5],
  ] as Pt[]) {
    p.set(x, y, STONE[5]);
    p.set(x + 1, y, STONE[3]);
    p.set(x, y + 1, STONE[2]);
    p.set(x + 1, y + 1, INK);
  }
  claimBox(c, cx - 28, base - 24, 56, 31);
}

// ------------------------------------------------------------------ Act 3: the Boar King's hollow tree

/** The great hollow tree: a vast gnarled trunk flaring into roots round a black den (two red eyes glint inside),
 *  under a wide dark-autumn crown; torches either side. (cx, base) = the den's threshold. */
export function hollowTree(c: WCtx, cx: number, base: number, fires: Pt[], eyes: Pt[]): void {
  const { p } = c;
  const bark = ramp('#1a0e1c', '#281424', '#3a1c2a', '#4e262e', '#663232', '#7e4236', '#9a5a3e');
  const crownR = ramp('#2c1024', '#4a1a2c', '#741e2e', '#a0302e', '#c84e30', '#e67a36', '#f8aa46');
  const hole = ramp('#0a050c', '#140812', '#220c16', '#381218');
  shade(p, cx + 6, base + 1, 22, 3.5, 0.4);
  // trunk
  const top = base - 22;
  for (let y = top; y <= base; y++) {
    const t = (y - top) / (base - top);
    const half = 5 + t * t * 8 + (noise(y * 0.3, 1, 5) - 0.5) * 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - (cx - half)) / (half * 2);
      let v = 0.85 - u * 0.78;
      const g = noise(x * 0.6, y * 0.14, 9);
      if (g > 0.62) v -= 0.3;
      else if (g < 0.3) v += 0.1;
      p.set(x, y, pick(bark, v, x, y, 0.15));
    }
    p.set(Math.round(cx - half) - 1, y, INK);
    p.set(Math.round(cx + half) + 1, y, INK);
  }
  // roots curling out over the ground
  for (const [x, dir, len] of [
    [cx - 13, -1, 7],
    [cx + 13, 1, 8],
    [cx - 8, -1, 5],
    [cx + 9, 1, 6],
  ] as Array<[number, number, number]>)
    for (let i = 0; i < len; i++) {
      const y = base + Math.round((i / len) * 2);
      p.set(x + dir * i, y - 1, bark[i < len / 2 ? 4 : 3]);
      p.set(x + dir * i, y, bark[1]);
      p.set(x + dir * i, y + 1, INK);
    }
  // the den: an arched black opening
  for (let y = base - 11; y <= base; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const dx = (x + 0.5 - cx) / 6;
      const dy = (y + 0.5 - (base - 5)) / 6.5;
      if (y > base - 5 ? Math.abs(dx) <= 1 : dx * dx + dy * dy <= 1) {
        const edge = Math.abs(dx) > 0.75 || (y < base - 5 && dx * dx + dy * dy > 0.6);
        p.set(x, y, edge ? hole[3] : hole[(y + x) % 7 === 0 ? 1 : 0]);
      }
    }
  p.set(cx - 2, base - 5, col('#ff4a2a'));
  p.set(cx + 2, base - 5, col('#ff4a2a'));
  eyes.push([cx - 2, base - 5], [cx + 2, base - 5]);
  // bones at the threshold
  spr(c, ['e...e', 'eeeee'], P({ e: '#e6d4bc' }), cx - 12, base - 1, null);
  spr(c, ['.ee.', 'ekke'], P({ e: '#fff4e0', k: '#2a140c' }), cx + 8, base - 1, null);
  // the crown: wide, dark autumn, lit warm from the top left
  const blobs = crown(rng(143), cx - 1, top - 6, 25, 13, 4.4);
  mass(p, blobs, { ramp: crownR, seed: 145, bump: 0.22, tex: 0.26, vgrad: 0.2, light: 0.04, shadow: 0.3, outline: col('#1a0610'), form: { x: cx - 5, y: top - 9, rx: 27, ry: 15 }, formMix: 0.5 });
  // torches on poles either side of the den
  for (const x of [cx - 10, cx + 10]) {
    for (let y = base - 8; y <= base; y++) p.set(x, y, col('#6e3e20'));
    p.set(x - 1, base - 9, col('#2a2224'));
    p.set(x + 1, base - 9, col('#2a2224'));
    p.set(x, base - 9, col('#4a3a34'));
    fires.push([x, base - 10]);
  }
  claimBox(c, cx - 27, top - 20, 55, base - top + 24);
}

// ------------------------------------------------------------------ the capital round the Atlas Hall

// the Atlas Hall (docs/story-bible.md section 3): a domed hall, its slate-blue dome ribbed in gold under a gilt
// lantern, a drum of tall arched windows (the view lights them: the Atlas's glow under the dome, brighter as regions
// are restored), a colonnaded front and its great door
const TOWER = [
  '......G......',
  '.....gGy.....',
  '......y......',
  '.....bBn.....',
  '....bbBnn....',
  '...bbBgBnn...',
  '..bbBgBgBnn..',
  '..bBgBBBgBn..',
  '.bbBgBBBgBnn.',
  '.bBgBBBBBgBn.',
  'bbBgBBBBBgBnn',
  'GgggggggggyyY',
  '.sSSSSSSSSSm.',
  '.sSKSSKSSKSm.',
  '.sSkSSkSSkSm.',
  '.sSkSSkSSkSm.',
  '.sSkSSkSSkSm.',
  '.sSSSSSSSSSm.',
  'GgggggggggyyY',
  'sSSSSSSSSSmmM',
  'sWSmSWSmSWmmM',
  'sWSmSWSmSWmmM',
  'sWSmSWSmSWmmM',
  'sWSmSWSmSWmmM',
  'sWSmSWSmSWmmM',
  'GgggggggggyyY',
  'sSSSSKKKSSmmM',
  'sSSSKkkkKSmmM',
  'sSSSkkkkkSmmM',
  'sSSSkkkkkSmmM',
  'sSSSkkykkSmmM',
  'sSSSkkkkkSmmM',
  'sSSSkkkkkSmmM',
];
const TOWER_PAL = P({ G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', b: '#6a92e0', B: '#3a62c0', n: '#22387a', s: '#f4ecd8', S: '#d4c6a8', m: '#a49478', M: '#746450', W: '#ffffff', w: '#c8d0e0', k: '#2a1c34', K: '#3e2c48' });
const TURRET = ['..b..', '.bBn.', 'bbBnn', 'sSSmm', 'sSkmm', 'sSSmm', 'sSSmm', 'sSSmm'];
/** The middle window of the Atlas Hall's drum (where the view lights the Atlas's glow), relative to the sprite's
 *  top-left. (Kept under its old name: the world spot is still `pendulum`.) */
export const PENDULUM_AT: Pt = [6, 13];

/**
 * The capital: an oval curtain wall with turrets and a gatehouse on the south, packed roofs inside round a
 * market square, and the domed Atlas Hall rising from the middle. Returns the turret tops (pennants) and the
 * tower's top-left.
 */
export function capital(c: WCtx, cx: number, cy: number, rx: number, ry: number): { turrets: Pt[]; tower: Pt } {
  const { p } = c;
  const cobble = [col('#cdb894'), col('#c2ac88'), col('#a89474')];
  shade(p, cx + 5, cy + ry + 2, rx + 4, 4, 0.3);
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.set(x, y, (x * 3 + y * 5) % 7 === 0 ? cobble[2] : (x + y) % 2 ? cobble[0] : cobble[1]);
  claimBox(c, cx - rx - 3, cy - ry - 8, rx * 2 + 7, ry * 2 + 12);
  const wallY = (x: number, s: number) => Math.round(cy + s * ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
  // the back wall
  for (let x = cx - rx + 1; x <= cx + rx - 1; x++) {
    const y = wallY(x, -1);
    p.set(x, y - 3, x % 2 ? col('#e6dac0') : INK);
    p.set(x, y - 2, col('#e6dac0'));
    p.set(x, y - 1, col('#d4c6a8'));
    p.set(x, y, col('#a49478'));
    p.set(x, y + 1, col('#746450'));
    if (x % 2 === 0) p.set(x, y - 4, INK);
  }
  // houses, back rows first, leaving the square round the tower
  const turrets: Pt[] = [];
  const spots: Array<[number, number, number, RoofKind]> = [];
  const roofs: RoofKind[] = ['red', 'blue', 'red', 'slate', 'red'];
  for (let y = cy - ry + 2; y < cy + ry - 6; y += 5)
    for (let x = cx - rx + 3; x < cx + rx - 6; x += 7) {
      const jx = x + ((y / 5) % 2) * 3 + Math.round((hash(x, y, 9) - 0.5) * 2);
      const e = ((jx + 3 - cx) / (rx - 4)) ** 2 + ((y + 3 - cy) / (ry - 3)) ** 2;
      if (e > 1) continue;
      if (Math.abs(jx + 3 - cx) < 11 && Math.abs(y + 3 - cy) < 7) continue; // the square
      spots.push([jx, y, Math.floor(hash(x, y, 10) * 3), roofs[Math.floor(hash(x, y, 11) * roofs.length)]]);
    }
  spots.sort((a, b) => a[1] - b[1]);
  for (const [x, y, v, r] of spots) house(c, x, y, v, r, true, hash(x, y, 12) < 0.5);
  // the square: a fountain
  spr(c, ['.ww.', 'wWWw', '.mm.'], P({ w: '#9ad8ff', W: '#e0f6ff', m: '#a49478' }), cx - 12, cy + 2);
  // the tower itself
  const tx = cx - 6;
  const ty = cy - 30;
  shade(p, cx + 8, cy + 3, 6, 1.4, 0.3);
  spr(c, TOWER, TOWER_PAL, tx, ty);
  // the front wall, crenellated, with the gate
  for (let x = cx - rx; x <= cx + rx; x++) {
    const y = wallY(x, 1) - 1;
    const lit = x < cx + rx * 0.3;
    if (Math.abs(x - cx) <= 3) continue;
    p.set(x, y - 3, x % 2 ? (lit ? col('#f4ecd8') : col('#d4c6a8')) : INK);
    p.set(x, y - 2, lit ? col('#f4ecd8') : col('#d4c6a8'));
    p.set(x, y - 1, lit ? col('#e6dac0') : col('#bcae92'));
    p.set(x, y, lit ? col('#c8b898') : col('#a49478'));
    p.set(x, y + 1, col('#746450'));
    p.set(x, y + 2, INK);
    if (x % 2 === 0) p.set(x, y - 4, INK);
  }
  // the side walls (the oval's ends)
  for (let y = cy - ry + 2; y <= cy + ry - 2; y++)
    for (const s of [-1, 1]) {
      const x = Math.round(cx + s * rx * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / ry) ** 2)));
      p.set(x, y, s < 0 ? col('#e6dac0') : col('#a49478'));
      p.set(x + s, y, INK);
    }
  // turrets round the wall
  for (const a of [0.12, 0.38, 0.62, 0.88, 1.12, 1.88]) {
    const ang = a * Math.PI;
    const x = Math.round(cx + Math.cos(ang) * rx) - 2;
    const y = Math.round(cy - Math.sin(ang) * ry) - 5;
    if (Math.sin(ang) < 0) continue;
    spr(c, TURRET, TOWER_PAL, x, y);
    turrets.push([x + 2, y]);
  }
  for (const s of [-1, 1]) {
    const x = Math.round(cx + s * rx) - 2;
    spr(c, TURRET, TOWER_PAL, x, cy - 5);
    turrets.push([x + 2, cy - 5]);
  }
  // the gatehouse: two turrets either side of a dark arch
  const gy = wallY(cx, 1);
  for (let y = gy - 5; y <= gy + 1; y++) for (let x = cx - 3; x <= cx + 3; x++) p.set(x, y, y === gy - 5 || Math.abs(x - cx) === 3 ? col('#d4c6a8') : col('#2a1c34'));
  for (let x = cx - 1; x <= cx + 1; x++) p.set(x, gy - 4, col('#d4c6a8'));
  p.set(cx, gy - 3, col('#d4c6a8'));
  for (const s of [-1, 1]) {
    spr(c, TURRET, TOWER_PAL, cx + s * 6 - 2, gy - 9);
    turrets.push([cx + s * 6, gy - 9]);
  }
  for (const s of [-1, 1]) {
    const x = Math.round(cx + s * rx * 0.62) - 2;
    spr(c, TURRET, TOWER_PAL, x, wallY(x + 2, 1) - 8);
    turrets.push([x + 2, wallY(x + 2, 1) - 8]);
  }
  return { turrets, tower: [tx, ty] };
}

// ------------------------------------------------------------------ the coast: lighthouse, docks, boats

export const LIGHTHOUSE = ['.rR.', 'kffk', 'sSSm', '.wW.', '.wW.', '.rR.', '.rR.', '.wW.', '.wW.', '.rR.', 'sSSm'];
export const LIGHTHOUSE_PAL = P({ r: '#d23a30', R: '#8e2026', k: '#2a1c34', f: '#ffe680', s: '#c8c0b2', S: '#a09a96', m: '#78747c', w: '#f4ecd8', W: '#c8bca4' });

/** A pier of planks from (x, y) running `len` px along (dx, dy) over the water, on dark piles. */
export function pier(c: WCtx, x: number, y: number, dx: number, dy: number, len: number): void {
  const { p } = c;
  for (let k = 0; k < len; k++) {
    const X = x + dx * k;
    const Y = y + dy * k;
    if (dx) {
      p.set(X, Y, k % 2 ? col('#c08a50') : col('#d09a5e'));
      p.set(X, Y + 1, col('#6e4020'));
      if (k % 3 === 0) p.set(X, Y + 2, col('#2a1810'));
      for (const j of [0, 1, 2]) c.cover[(Y + j) * c.W + X] = 1;
    } else {
      p.set(X, Y, col('#c08a50'));
      p.set(X + 1, Y, col('#a06c3a'));
      p.set(X + 2, Y, col('#3a2418'));
      for (const j of [0, 1, 2]) c.cover[Y * c.W + X + j] = 1;
    }
  }
}

// ------------------------------------------------------------------ the Frostpeaks: peaks and the mountain keep

const ROCK = ramp('#262a40', '#3a4060', '#555e80', '#76809e', '#98a2bc');

const ROCK_LIT = ramp('#3a3e5c', '#585c7e', '#7a7c9c', '#9c9cb6', '#c0bed0');
const ROCK_SHADE = ramp('#1c2036', '#282e4a', '#363e5e', '#4a5474', '#5e6a8a');
const SNOW_LIT = ramp('#c8d6ee', '#e4ecf8', '#f6f8fe', '#ffffff');
const SNOW_SHADE = ramp('#7c90bc', '#9aaed4', '#b6c8e6', '#cad8f0');

/**
 * A mountain: summit (mx, top), its foot at `base`, half-widths hwL / hwR (asymmetric). The silhouette has noisy
 * shoulders; a main ridge runs from the summit down to the right, splitting a sunlit face (left) from a cool shaded
 * one; gullies run down each face (they hold snow below the snow line); the foot dithers away into the ground.
 */
export function mountain(c: WCtx, mx: number, top: number, base: number, hwL: number, hwR: number, seed: number, snowDepth: number): void {
  const { p, W } = c;
  const H = base - top;
  const xl: number[] = [];
  const xr: number[] = [];
  for (let y = top; y <= base; y++) {
    const t = (y - top) / H;
    const f = Math.pow(t, 0.82);
    xl.push(Math.round(mx - hwL * f * (0.82 + 0.36 * noise(y * 0.13, 1, seed))));
    xr.push(Math.round(mx + hwR * f * (0.82 + 0.36 * noise(y * 0.13, 2, seed))));
  }
  const inside = (x: number, y: number) => y >= top && y <= base && x >= xl[y - top] && x <= xr[y - top];
  for (let y = Math.max(0, top); y <= base; y++) {
    const t = (y - top) / H;
    const ridge = mx + (y - top) * 0.3 + (noise(y * 0.18, 3, seed) - 0.5) * 5 * t;
    const x0 = xl[y - top];
    const x1 = xr[y - top];
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= W) continue;
      // the foot fades into the ground
      if (t > 0.86 && hash(x, y, seed) < (t - 0.86) * 7) continue;
      const lit = x < ridge;
      const u = lit ? x - mx + (y - top) * 0.7 : x - mx - (y - top) * 0.45;
      const gully = noise(u * 0.32, y * 0.04, seed + 3) > 0.62;
      const snowY = top + snowDepth * (0.75 + 0.5 * noise(x * 0.22, 4, seed)) + (lit ? 3 : 0);
      const edgeT = (x - x0) / Math.max(1, x1 - x0);
      let v: Col;
      if (y < snowY || (gully && y < snowY + 7 && t < 0.7)) {
        const r = lit ? SNOW_LIT : SNOW_SHADE;
        v = pick(r, (lit ? 0.85 - edgeT * 0.5 : 0.75 - edgeT * 0.4) - (gully ? 0.35 : 0) - t * 0.2, x, y, 0.12);
      } else {
        const r = lit ? ROCK_LIT : ROCK_SHADE;
        v = pick(r, (lit ? 0.9 - edgeT * 0.6 : 0.8 - edgeT * 0.5) - (gully ? 0.3 : 0) - t * 0.35 + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.15, x, y, 0.1);
      }
      // the silhouette: a dark rim along the top edges (not down at the foot)
      if (t < 0.8 && (!inside(x, y - 1) || !inside(x - 1, y) || !inside(x + 1, y))) v = lit ? ROCK_SHADE[1] : ROCK_SHADE[0];
      p.buf[y * W + x] = v;
      c.taken[y * W + x] = 1;
    }
  }
}

/** The mountain keep on its crag: curtain walls, three towers with blue cone roofs, banners. (cx, base) = gate. */
export function keep(c: WCtx, cx: number, base: number): void {
  const { p } = c;
  // the crag
  for (let y = base; y <= base + 12; y++) {
    const half = 14 + (y - base) * 0.9;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - cx + half) / (half * 2);
      p.set(x, y, pick(ROCK, 0.85 - u * 0.7 - (y - base) * 0.03 + (hash(x, y, 3) - 0.5) * 0.2, x, y));
    }
    p.set(Math.round(cx - half) - 1, y, INK);
    p.set(Math.round(cx + half) + 1, y, INK);
  }
  const wall = P({ s: '#e2e6f0', S: '#b4bccc', m: '#7c86a6', M: '#4a5272', k: '#1a1c2c', b: '#6a92e0', B: '#3a62c0', n: '#22387a', y: '#f2c230' });
  // the curtain wall
  for (let x = cx - 13; x <= cx + 13; x++) {
    const lit = x < cx + 4;
    for (let y = base - 6; y <= base; y++) p.set(x, y, y === base - 6 ? (x % 2 ? wall.s : INK) : lit ? (y < base - 3 ? wall.s : wall.S) : y < base - 3 ? wall.S : wall.m);
  }
  for (let y = base - 6; y <= base; y++) {
    p.set(cx - 14, y, INK);
    p.set(cx + 14, y, INK);
  }
  // the gate
  for (let y = base - 3; y <= base; y++) for (let x = cx - 1; x <= cx + 1; x++) p.set(x, y, wall.k);
  // towers
  const towerRows = (h: number) => ['..b..', '.bBn.', '.bBn.', 'bbBnn', 'bBBnn', ...Array.from({ length: h }, (_, i) => (i === 2 ? 'sSkmM' : 'sSSmM'))];
  spr(c, towerRows(9), wall, cx - 13, base - 18);
  spr(c, towerRows(9), wall, cx + 9, base - 17);
  spr(c, ['...b...', '..bBn..', '..bBn..', '.bbBnn.', '.bBBnn.', 'bbBBBnn', 'sSSSSmM', 'sSkSkmM', 'sSSSSmM', 'sSSSSmM', 'sSkkSmM', 'sSSSSmM', 'sSSSSmM', 'sSSSSmM', 'sSSSSmM'], wall, cx - 3, base - 21);
  // banners on the towers
  for (const [x, y] of [
    [cx - 11, base - 19],
    [cx + 11, base - 18],
    [cx, base - 22],
  ] as Pt[]) {
    p.set(x, y, wall.M);
    p.set(x, y - 1, wall.M);
    p.set(x, y - 2, wall.M);
    p.set(x + 1, y - 2, col('#3a6ad0'));
    p.set(x + 2, y - 2, col('#3a6ad0'));
    p.set(x + 1, y - 1, col('#22408a'));
  }
  claimBox(c, cx - 16, base - 24, 33, 38);
}

// ------------------------------------------------------------------ Duskmire: the stilt village and the Mirelight

const STILT_HUT = ['..qqR..', '.qqqrR.', 'qqqqrRR', '.wkwdW.', '.wwwdW.', '.h...h.', '.h...h.'];
const STILT_PAL = P({ q: '#8a8a5a', r: '#6a6a42', R: '#45452c', w: '#7a6248', W: '#54402e', k: '#ffd860', d: '#3a2a1e', h: '#3a2a1e' });

export function stiltHut(c: WCtx, x: number, y: number): void {
  shade(c.p, x + 4, y + 7, 4, 1, 0.3);
  spr(c, STILT_HUT, STILT_PAL, x, y);
  c.windows.push([x + 2, y + 3]);
  c.chimneys.push([x + 5, y - 1]);
}

// the Mirelight: a lantern beacon on stilts guiding travellers through the fens
export const BEACON = ['...q...', '..qrR..', '.qrrRR.', '.kfFfk.', '.kfffk.', 'sSSSSmm', '.wwwWW.', '.wwwWW.', '.rrrRR.', '.rrrRR.', '.wwwWW.', '.wwwWW.', '.rrrRR.', '.rrrRR.', 'sSSSSmm', '.h...h.', 'h.h.h.h'];
export const BEACON_PAL = P({ q: '#f6684e', r: '#d23a30', R: '#8e2026', k: '#2a1c34', f: '#ffe680', F: '#ffffff', s: '#c8c0b2', S: '#a09a96', m: '#78747c', w: '#f4ecd8', W: '#c8bca4', h: '#5a4630' });
