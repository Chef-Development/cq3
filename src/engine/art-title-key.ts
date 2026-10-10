// The title's key art (playtest round 8: "too simplistic and drained" -> an epic first look). A dusk over the kingdom,
// in deep saturated layers: a sky banded from indigo to molten gold round a low sun, two hazy mountain ranges rim-lit
// by it, green hills with a river of reflected gold winding down from the sun, the capital's dome on a far hill, and a
// dark cliff in the foreground where the hero stands looking out. On the right the world is being ERASED (the premise,
// spoiler-free): the land and the sky drain into an ink drawing, then into blank vellum keeping only the impression of
// their lines; an ink-dark ragged front claws into the colour, and a giant owl-feather quill hangs over the blank, its
// gold nib on the front. The page's corner curls at the bottom right: the world is a map.
//
// Textures: 'title_key' (327 x 150, the scene), 'title_quill' (the quill, drawn bobbing), 'title_cloud0..1' (wisps
// drifting). The view (view/title.ts) adds the light rays, the front's crawling ink and the flecks peeling off it,
// motes, the hero and Pip. Hard pixels only, ordered dither for the big gradients, everything from a seed.

export const KEY_W = 327;
export const KEY_H = 150;
/** The low sun (centre). */
export const KEY_SUN = { x: 64, y: 71 };
/** Where the quill's texture sits (top-left) and its nib (the texture's px) when at rest. */
export const KEY_QUILL = { x: 231, y: -8, nibX: 7, nibY: 100 };

// ------------------------------------------------------------------ ramps (docs/art-style.md section 2, pushed)

const SKY = [0x120a26, 0x1e1038, 0x30164c, 0x4a1c5a, 0x6c2462, 0x963060, 0xbe4458, 0xe0644c, 0xf48a4a, 0xffb45a, 0xffd67e, 0xfff0bc];
const FAR_A = [0x4a2e6a, 0x5c3a78, 0x6e4884, 0x825890];
const FAR_B = [0x2a1a46, 0x34204e, 0x3e2658, 0x4a2e62];
const RIM = [0xa8505a, 0xe0785a, 0xffa868, 0xffd890];
const LAND = [0x0e1a22, 0x14262a, 0x1c3430, 0x284634, 0x365a38, 0x4a7038];
const CLIFF = [0x0c0612, 0x140a1c, 0x1e1028, 0x2a1634];
const RIVER = [0x8a3a4a, 0xd8644a, 0xffa858, 0xffd890, 0xfff6d0];
/** The blank: a warm grey vellum, kept dimmer than the logo's gold (the eye goes to the logo and the hero first). */
const PAPER = [0xa49ca4, 0xb8b0b4, 0xc8c0c0, 0xd4ccc8];
const INKS = [0x140c1c, 0x1a1026, 0x2e2240, 0x4a3a5e];
const PARCH = [0x6e4a2a, 0xa8804e, 0xd2b07a, 0xead2a0];
const GOLD = [0x5a3410, 0x9a5a14, 0xd8901c, 0xf2c230, 0xfff0a0];

// ------------------------------------------------------------------ helpers

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
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
const fbm = (x: number, y: number, s: number, seed: number) => vnoise(x, y, s, seed) * 0.6 + vnoise(x, y, s / 2.2, seed + 7) * 0.28 + vnoise(x, y, s / 5, seed + 13) * 0.12;
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number, f: number) => f * 16 > BAYER4[(y & 3) * 4 + (x & 3)] + 0.5;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** A tone from a ramp for v in 0..1, dithered between its two nearest steps (stepped bands, dithered joins). */
function rampAt(r: readonly number[], v: number, x: number, y: number): number {
  const t = Math.max(0, Math.min(r.length - 1, v * (r.length - 1)));
  const lo = Math.floor(t);
  return r[Math.min(r.length - 1, dith(x, y, t - lo) ? lo + 1 : lo)];
}
function mixC(a: number, b: number, k: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  return (Math.round(ar + (((b >> 16) & 255) - ar) * k) << 16) | (Math.round(ag + (((b >> 8) & 255) - ag) * k) << 8) | Math.round(ab + ((b & 255) - ab) * k);
}
const luma = (c: number) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;

function toCanvas(w: number, h: number, px: Int32Array): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const c = px[i];
    if (c < 0) continue;
    img.data[i * 4] = (c >> 16) & 255;
    img.data[i * 4 + 1] = (c >> 8) & 255;
    img.data[i * 4 + 2] = c & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ------------------------------------------------------------------ the geography

/** The erasing front: blank vellum east of this x (it wanders as it climbs). */
export function keyEdge(y: number): number {
  return Math.round(226 + Math.sin(y * 0.06 + 1.2) * 8 + (fbm(5, y, 16, 301) - 0.5) * 22 - Math.max(0, 40 - y) * 0.35);
}
/** The far range's ridge (y of its top at column x) and the nearer range's. */
const ridgeA = (x: number) => 66 - Math.abs(Math.sin(x * 0.045 + 0.4)) * 14 - fbm(x, 0, 9, 311) * 10 + Math.max(0, 16 - Math.abs(x - KEY_SUN.x) * 0.7);
const ridgeB = (x: number) => 84 - Math.abs(Math.sin(x * 0.07 + 2.1)) * 9 - fbm(x, 3, 7, 313) * 7 + Math.max(0, 9 - Math.abs(x - KEY_SUN.x) * 0.3);
/** The rolling hills' tops: a far row and a near row. */
const hills1 = (x: number) => 91 + Math.sin(x * 0.05 + 0.3) * 3 + fbm(x, 7, 12, 317) * 4;
const hills2 = (x: number) => 104 + Math.sin(x * 0.034 + 1.4) * 6 + fbm(x, 9, 10, 319) * 4;
/** The foreground cliff's top (y) at column x, or 999 where there's no cliff. */
function cliffTop(x: number): number {
  if (x > 132) return 999;
  const bump = fbm(x, 11, 5, 321) * 3;
  if (x < 14) return 108 + x * 0.35 + bump;
  if (x < 100) return 116 + Math.sin(x * 0.12) * 1 + bump - (x > 60 && x < 82 ? 1.5 : 0);
  return 116 + ((x - 100) / 32) ** 1.6 * 36 + bump;
}
/** Where the hero stands (feet), on the cliff's top (left of the start prompt's plate and the title's buttons). */
export const KEY_HERO = { x: 34, y: Math.round(cliffTop(34)) };

/** The river's centre (x) at row y, and its width, from the sun's foot down to the bottom edge. */
const riverX = (y: number) => KEY_SUN.x + 8 + (y - 92) * 1.9 + Math.sin(y * 0.16) * 7;
const riverW = (y: number) => 0.6 + (y - 92) * 0.11;

// ------------------------------------------------------------------ painting

function paintScene(): Int32Array {
  const W = KEY_W;
  const H = KEY_H;
  const px = new Int32Array(W * H);
  const sun = KEY_SUN;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // ---- the sky: banded from the top down, brighter toward the sun
      const d = Math.hypot((x - sun.x) / 1.6, y - sun.y);
      const glow = Math.max(0, 1 - d / 120) ** 1.6;
      let v = (y / 92) ** 1.25 * 0.72 + glow * 0.42;
      if (d < 10) v = 1;
      let c = rampAt(SKY, Math.min(1, v), x, y);
      // the sun's disc and its halo
      if (d < 7.5) c = d < 5.5 ? 0xfffbe8 : 0xfff0bc;
      // long streaks of cloud, lit from below by the sun
      const cl = fbm(x * 0.35, y * 4, 40, 331);
      if (y > 24 && y < 76 && cl > 0.64) {
        const under = fbm(x * 0.35, (y + 1) * 4, 40, 331) <= 0.64;
        c = under ? mixC(rampAt(SKY, Math.min(1, v + 0.35), x, y), 0xffe0a0, 0.3) : mixC(c, SKY[3], 0.45);
      }
      // ---- the far range: hazy, rim-lit on the slopes facing the sun
      const ra = ridgeA(x);
      if (y >= ra) {
        const toward = x < sun.x ? 1 : -1;
        const lit = ridgeA(x + toward) > ra + 0.2;
        const k = (y - ra) / 24;
        c = rampAt(FAR_A, clamp01(0.85 - k * 0.6 + glow * 0.4), x, y);
        c = mixC(c, SKY[8], glow * 0.35 + clamp01(k - 0.4) * 0.25);
        if (y - ra < 1.2) c = lit ? RIM[2] : RIM[0];
        else if (lit && y - ra < 2.4) c = RIM[1];
      }
      // ---- the nearer range
      const rb = ridgeB(x);
      if (y >= rb) {
        const toward = x < sun.x ? 1 : -1;
        const lit = ridgeB(x + toward) > rb + 0.2;
        c = rampAt(FAR_B, clamp01(0.6 + glow * 0.5 - (y - rb) / 30), x, y);
        if (y - rb < 1.2) c = lit ? RIM[3] : RIM[1];
        else if (lit && y - rb < 2.5) c = RIM[2];
        else if (lit && y - rb < 4) c = mixC(c, RIM[0], 0.5);
      }
      // ---- the hills: two rows of green, backlit (dark bodies, warm crests)
      for (const [top, base] of [
        [hills1(x), 0.75],
        [hills2(x), 0.5],
      ] as const) {
        if (y < top) continue;
        const k = (y - top) / 22;
        c = rampAt(LAND, clamp01(base - k * 0.5 + glow * 0.3 + (fbm(x, y, 6, 337) - 0.5) * 0.35), x, y);
        // (the crests catch the sun where it's near or where they turn to it; elsewhere a cool lit edge)
        const sunny = fbm(x, top, 9, 339) > 0.5 - glow * 0.4;
        if (y - top < 1.2) c = sunny ? (glow > 0.3 ? RIM[3] : RIM[2]) : LAND[4];
        else if (y - top < 2.4) c = sunny ? mixC(LAND[5], RIM[1], 0.5) : LAND[3];
      }
      // woods on the hills: dark round clumps with a warm rim toward the sun
      const wood = fbm(x, y * 1.6, 7, 341);
      if (y > hills1(x) + 3 && y < 128 && wood > 0.62) {
        c = wood > 0.7 ? LAND[0] : LAND[1];
        if (fbm(x + (x < sun.x ? 1 : -1), (y - 1) * 1.6, 7, 341) <= 0.62) c = mixC(LAND[4], RIM[1], 0.45);
      }
      // ---- the river, carrying the sun's gold down to the foreground
      if (y > 92) {
        const rx = riverX(y);
        const rw = riverW(y);
        if (Math.abs(x - rx) <= rw) {
          const e = Math.abs(x - rx) / Math.max(1, rw);
          c = rampAt(RIVER, clamp01(0.95 - e * 0.5 - (y - 92) / 120), x, y);
          if (hash(x >> 1, y, 343) < 0.06) c = RIVER[4];
        }
      }
      px[i] = c;
    }
  // ---- the capital on a far hill: walls, towers, the Atlas Hall's dome lit gold at its rim, its windows lit
  const cx = 178;
  const cy = Math.round(hills1(cx)) + 1;
  const sil = (x: number, y: number) => px[y * W + x];
  const set = (x: number, y: number, col: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = col;
  };
  void sil;
  for (let x = -14; x <= 14; x++) for (let y = cy - 5; y <= cy; y++) set(cx + x, y, x === -14 ? RIM[1] : FAR_B[0]);
  for (const [tx, th] of [
    [-13, 9],
    [-6, 7],
    [7, 8],
    [13, 10],
  ]) {
    for (let y = cy - th; y <= cy - 5; y++) {
      set(cx + tx, y, FAR_B[0]);
      set(cx + tx + 1, y, FAR_B[0]);
      set(cx + tx - 1, y, y === cy - th ? FAR_B[0] : RIM[0]);
    }
    set(cx + tx, cy - th - 1, FAR_B[0]);
    set(cx + tx, cy - th - 2, RIM[1]);
  }
  for (let dy = 0; dy <= 6; dy++) {
    const hw = Math.round(Math.sqrt(36 - dy * dy) * 1.1);
    for (let dx = -hw; dx <= hw; dx++) set(cx + dx, cy - 6 - dy, dx === -hw || dy === 6 ? RIM[2] : FAR_B[1]);
  }
  set(cx, cy - 14, GOLD[4]);
  set(cx, cy - 13, GOLD[3]);
  for (const [wx, wy] of [
    [-9, -3],
    [-3, -2],
    [3, -3],
    [10, -2],
    [-1, -8],
    [2, -8],
  ])
    set(cx + wx, cy + wy, hash(wx, wy, 7) < 0.5 ? GOLD[4] : GOLD[3]);
  // ---- the foreground cliff: near-black rock, a hot rim along its top, its sunward face warm
  for (let x = 0; x < W; x++) {
    const top = cliffTop(x);
    if (top >= 999) continue;
    for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
      const k = y - top;
      let c = rampAt(CLIFF, clamp01(0.75 - k / 40 + (fbm(x, y, 5, 347) - 0.5) * 0.6), x, y);
      if (k < 1) c = RIM[3];
      else if (k < 2) c = RIM[1];
      else if (k < 3.5) c = mixC(CLIFF[3], RIM[0], 0.45);
      // the face turned to the sun catches it in streaks
      if (x > 100 && k > 2 && cliffTop(x + 1) > top + 0.6 && hash(x, y >> 2, 349) < 0.5) c = mixC(c, RIM[0], 0.55);
      set(x, y, c);
    }
    // grass tufts on the top, silhouetted, their tips catching the light
    if (x < 100 && hash(x, 0, 351) < 0.3) {
      const h = 1 + Math.floor(hash(x, 1, 351) * 3);
      for (let k = 1; k <= h; k++) set(x, Math.floor(top) - k, k === h ? RIM[2] : CLIFF[1]);
    }
  }
  return px;
}

/** The erasure, over the painted scene: colour drains into an ink drawing, then into blank vellum keeping the
 *  impression of its lines; the ink-dark front claws into the colour; the page's corner curls up. */
function erase(px: Int32Array): void {
  const W = KEY_W;
  const H = KEY_H;
  const src = px.slice();
  const edgeAt = (x: number, y: number) => {
    const l = luma(src[y * W + x]);
    let m = 0;
    if (x > 0) m = Math.max(m, Math.abs(l - luma(src[y * W + x - 1])));
    if (x < W - 1) m = Math.max(m, Math.abs(l - luma(src[y * W + x + 1])));
    if (y > 0) m = Math.max(m, Math.abs(l - luma(src[(y - 1) * W + x])));
    if (y < H - 1) m = Math.max(m, Math.abs(l - luma(src[(y + 1) * W + x])));
    return m;
  };
  for (let y = 0; y < H; y++) {
    const ex = keyEdge(y);
    for (let x = Math.max(0, ex - 34); x < W; x++) {
      const i = y * W + x;
      const e = edgeAt(x, y);
      const paper = rampAt(PAPER.slice(1), 0.5 + (fbm(x, y, 14, 361) - 0.5) * 0.8, x, y);
      if (x >= ex) {
        // the blank: vellum with the impression of the lines that were here, and the sheet's own neatline (a map page)
        const nl = Math.min(W - 1 - x, H - 1 - y);
        px[i] = nl === 6 ? INKS[3] : nl === 8 ? PAPER[0] : e > 0.09 ? PAPER[0] : paper;
        continue;
      }
      // the drain: colour into an ink drawing on bare paper, in torn patches (more drawing the closer to the front)
      const q = (x - (ex - 34)) / 34;
      const patch = q + (fbm(x, y, 5, 371) - 0.5) * 0.9;
      if (patch < 0.45) continue;
      const washed = patch < 0.62;
      px[i] = e > 0.11 ? (patch < 0.8 ? INKS[2] : INKS[3]) : washed ? mixC(paper, src[i], 0.45) : paper;
    }
    // the front: ink clawing into the colour (a ragged band and streaks running back into the land)
    for (let k = 0; k < 4; k++) {
      const x = ex - 1 - k;
      if (x < 0) continue;
      if (k < 2 || hash(x, y, 363) < 0.55 - k * 0.12) px[y * W + x] = k === 0 ? INKS[0] : INKS[1];
    }
    if (hash(0, y, 365) < 0.22) {
      const len = 4 + Math.floor(hash(1, y, 365) * 12);
      for (let k = 0; k < len; k++) {
        const x = ex - 4 - k;
        if (x >= 0 && hash(x, y, 367) < 0.9 - k / len) px[y * W + x] = k < len / 2 ? INKS[1] : INKS[2];
      }
    }
    // flecks of the blank already in the colour: torn bits of paper
    if (hash(2, y, 369) < 0.12) {
      const x = ex - 6 - Math.floor(hash(3, y, 369) * 22);
      if (x >= 0) {
        px[y * W + x] = PAPER[3];
        if (x + 1 < W) px[y * W + x + 1] = PAPER[1];
      }
    }
  }
  // the quill's shadow on the blank (soft, down and to the right of where it hangs)
  const q = KEY_QUILL;
  for (let t = 0; t < 1; t += 0.01) {
    const sx = Math.round(q.x + q.nibX + 14 + t * 30);
    const sy = Math.round(q.y + q.nibY + 6 - t * 70);
    for (let k = -3; k <= 3; k++) {
      const x = sx + k;
      if (x >= 0 && x < W && sy >= 0 && sy < H && x >= keyEdge(sy) + 2 && (Math.abs(k) < 2 || dith(x, sy, 0.5))) px[sy * W + x] = PAPER[0];
    }
  }
  // the page's corner, curling up at the bottom right: the folded-back sheet (parchment) and its shadow
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const f = W - 1 - x + (H - 1 - y);
      if (f < 34) px[y * W + x] = f > 31 ? INKS[3] : rampAt(PARCH, 0.35 + (f / 34) * 0.65, x, y);
      else if (f < 38 && x > 200) px[y * W + x] = mixC(px[y * W + x], INKS[3], 0.35);
    }
}

/** The quill: a barred owl's feather (dark, banded, a gold rim from the sun on its left), a silver nib, the tip of the
 *  nib gold with ink. Its nib at (KEY_QUILL.nibX, nibY). */
function paintQuill(): HTMLCanvasElement {
  const w = 50;
  const h = 106;
  const px = new Int32Array(w * h).fill(-1);
  const set = (x: number, y: number, c: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c;
  };
  const FEATHER = [0x1a1220, 0x2e2230, 0x4a3a44, 0x6e5a5c, 0x9a8476, 0xc8b49a];
  const nx = KEY_QUILL.nibX;
  const ny = KEY_QUILL.nibY;
  // the spine: from the nib up and to the right, curving
  const spine = (t: number): [number, number] => [nx + 4 + t * 32 + Math.sin(t * 2.4) * 4, ny - 12 - t * 92];
  for (let t = 0; t <= 1; t += 0.004) {
    const [sx, sy] = spine(t);
    const wv = t < 0.08 ? 0 : Math.sin(Math.min(1, (t - 0.08) / 0.92) * Math.PI) ** 0.6 * 9;
    // the vane, both sides of the spine (perpendicular to it, roughly horizontal)
    for (let s = -wv; s <= wv; s += 0.5) {
      const x = sx + s;
      const y = sy + s * 0.35;
      const bar = Math.floor((t * 92 + (s < 0 ? 0 : 1.5) + s * 0.4) / 5) % 2 === 0;
      const side = s < 0 ? 1 : 0;
      let c = FEATHER[bar ? 2 + side : 1 + side];
      if (Math.abs(s) > wv - 1) c = s < 0 ? GOLD[3] : FEATHER[0];
      if (s < 0 && Math.abs(s) > wv - 2 && bar) c = GOLD[2];
      set(x, y, c);
    }
    set(sx, sy, FEATHER[5]);
  }
  // the barbs fraying at the bottom of the vane
  for (let k = 0; k < 4; k++) {
    const [sx, sy] = spine(0.08 + k * 0.02);
    set(sx - 3 - k, sy + 2, FEATHER[2]);
    set(sx + 3 + k, sy + 3, FEATHER[1]);
  }
  // the shaft down to the nib, and the nib: silver, its point gold and wet with ink
  for (let k = 0; k <= 12; k++) {
    set(nx + Math.round((k * 4) / 12), ny - k, k < 4 ? 0xeef3fa : 0xb8c2d8);
    set(nx + 1 + Math.round((k * 4) / 12), ny - k, 0x7c86a6);
  }
  set(nx, ny, GOLD[4]);
  set(nx, ny + 1, INKS[1]);
  // the outline
  const out = px.slice();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (px[y * w + x] >= 0) continue;
      const on = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && px[yy * w + xx] >= 0;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) out[y * w + x] = INKS[0];
    }
  return toCanvas(w, h, out);
}

/** A long cloud wisp lit from below (drifting across the upper sky). */
function paintCloud(seed: number, w: number, h: number): HTMLCanvasElement {
  const px = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2);
      const dy = (y + 0.5 - h / 2) / (h / 2);
      const v = 1 - (dx * dx + dy * dy * 1.2) + (fbm(x, y * 2, 6, seed) - 0.5) * 0.9;
      if (v < 0.25) continue;
      const below = 1 - (dx * dx + ((y + 1.5 - h / 2) / (h / 2)) ** 2 * 1.2) + (fbm(x, (y + 1) * 2, 6, seed) - 0.5) * 0.9 < 0.25;
      px[y * w + x] = below ? 0xffb46a : y < h * 0.4 ? SKY[3] : SKY[4];
    }
  return toCanvas(w, h, px);
}

/** All the key art's canvases. */
export function paintKeyArt(): Record<string, HTMLCanvasElement> {
  const px = paintScene();
  erase(px);
  return {
    title_key: toCanvas(KEY_W, KEY_H, px),
    title_quill: paintQuill(),
    title_cloud0: paintCloud(381, 52, 6),
    title_cloud1: paintCloud(383, 38, 5),
  };
}
