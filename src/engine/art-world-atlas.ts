// The world map as a page of the Great Atlas (docs/story-bible.md: the kingdom is a living map; docs/art-style.md
// sections 2 and 5: parchment, atlas ink, fog). art-world.ts paints the land as before, then this pass prints it on
// the Atlas: the open sea becomes parchment with a watercolour wash along the coasts and engraved water lines
// following them, every coast and lake shore is inked, the regions' borders are dashed in ink, and the sheet gets a
// burnt edge and a double neatline. It also makes, per land, the two looks the story needs on top of the printed
// colour: his DRAFT (an ink drawing on bare paper, no colour: the land as the Mapmaker redrew it, until its region is
// restored and the colour floods back; `wm_draft_<id>`) and the BLANK (erased land: white-grey vellum keeping only
// the faint impression of its old lines; the veils, `wm_veil_<id>`). Pure pixel work on Int32 RGB buffers, hard pixels
// only, in steps (generators) so the world's painting can keep running in idle slices.
import { col, hash, mix, noise, rgba32, wordCanvas, type Col } from './backdrop';

type Box = { x: number; y: number; w: number; h: number };

/** Parchment (dark to light), the atlas ink (line, wash, faded line, a pale faded line) and the fog (erased land). */
export const PARCH: readonly Col[] = ['#3a2416', '#6e4a2a', '#a8804e', '#d2b07a', '#ead2a0', '#f8ecc8'].map(col);
/** The Atlas's own sheet: aged parchment, a step darker than the bible's ramp (L7). */
const AGED: readonly Col[] = ['#4a3020', '#6a4a2c', '#86623a', '#9c7848', '#ae8a56'].map(col);
export const ATLAS_INK: readonly Col[] = ['#1a1026', '#2e2240', '#4a3a5e', '#7a6a78', '#a8947e'].map(col);
/** The blank (erased land): a dim warm-grey vellum (L7: no large cream fills), its impression a shade darker. */
export const FOG: readonly Col[] = ['#4e4644', '#6e645e', '#8c8078', '#a09488', '#ac9f92'].map(col);
/** The blank's torn edge: its rim catching the light, the row inside it. */
const TORN: readonly Col[] = ['#f0dcb0', '#cec2b8'].map(col);
/** The sea's watercolour wash on the parchment (deep tint at the coast to bare paper offshore). */
const WASH: readonly Col[] = ['#2a4e5e', '#36606c', '#4a7276', '#6a8478', '#8a8a6c'].map(col);

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered dither: whether a pixel at (x, y) takes the next step up for a fractional part `f`. */
const dith = (x: number, y: number, f: number) => f * 16 > BAYER4[(y & 3) * 4 + (x & 3)] + 0.5;
/** The mood's shadow colour (L7: deep, cool). */
const MOOD = col('#141a30');
const luma = (c: Col) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;
/** A tone from a ramp for v in 0..1, dithered between its two nearest steps. */
function rampAt(r: readonly Col[], v: number, x: number, y: number): Col {
  const t = Math.max(0, Math.min(r.length - 1, v * (r.length - 1)));
  const lo = Math.floor(t);
  return r[Math.min(r.length - 1, dith(x, y, t - lo) ? lo + 1 : lo)];
}

/** The parchment's own tone at a world point: the paper's slow mottling in two dithered steps, darker toward the
 *  sheet's edges (a burnt edge in stepped bands). `W`/`H`: the whole sheet (continent and far sea). */
export function paperAt(x: number, y: number, W: number, H: number): Col {
  const m = noise(x * 0.025, y * 0.04, 71) * 0.7 + noise(x * 0.09, y * 0.11, 72) * 0.3;
  const e = Math.min(x, y, W - 1 - x, H - 1 - y);
  if (e <= 1) return PARCH[0];
  if (e <= 3) return AGED[0];
  // aged paper (L7: darker, no cream), browning toward the burnt edge in stepped bands
  const burn = e < 16 ? (16 - e) / 16 : 0;
  const v = 0.62 + (m - 0.5) * 0.4 - burn * 0.55;
  return rampAt(AGED, v, x, y);
}

/** What the atlas pass reads from the painting (art-world.ts's Stage). */
export interface AtlasIn {
  W: number;
  H: number;
  /** The painted world (RGB), printed on the Atlas in place. */
  buf: Int32Array;
  /** 1 on the land plate (with its cliffs). */
  land: Uint8Array;
  /** The region under each pixel (art-world-sites R_*), 0 at sea. */
  reg: Uint8Array;
  /** Water on the land: 1 river, 2 lake. */
  water: Uint8Array;
  /** Distance from the land over the sea (0 on land). */
  dist: Float32Array;
  /** The whole sheet's width (continent and far sea), for the burnt edge. */
  sheetW: number;
}

/** The ink line (the coast, a shore) and a darker pressure dot now and then where the stroke turns. */
const lineInk = (x: number, y: number, n: number) => (n >= 3 || hash(x, y, 81) < 0.08 ? ATLAS_INK[0] : ATLAS_INK[1]);

/** Print the painted world on the Atlas, in place (a few steps). */
export function* atlasPrint(A: AtlasIn, sameRegion: (a: number, b: number) => boolean): Generator<void, void> {
  const { W, H, buf, land, reg, water, dist } = A;
  const src = buf.slice();
  // the sea: bare parchment offshore, a watercolour wash along the coast in stepped bands, engraved water lines
  // (in slices of 30 rows: each a few ms on a phone)
  for (let y0 = 0; y0 < H; y0 += 30) {
    yield;
    for (let y = y0; y < Math.min(H, y0 + 30); y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (land[i]) continue;
        const d = dist[i];
        let c = paperAt(x, y, A.sheetW, H);
        if (d < 16) {
          // the wash: deepest at the coast, gone by about 16 px out (ragged a little, like a brush)
          const k = Math.max(0, 1 - (d + (noise(x * 0.2, y * 0.2, 73) - 0.5) * 3) / 16);
          if (k > 0) c = mix(c, rampAt(WASH, 1 - k, x, y), Math.min(1, k * 1.25));
        }
        // the engraved water lines: contours at set distances from the coast, broken further out
        for (const [ld, keep, k] of [
          [2.6, 1, 0.7],
          [5.4, 0.86, 0.5],
          [9, 0.62, 0.4],
          [14, 0.38, 0.3],
        ] as const)
          if (Math.abs(d - ld) < 0.5 && noise(x * 0.12, y * 0.12, 74 + ld) < keep + 0.12) c = mix(c, ATLAS_INK[1], k);
        buf[i] = c;
      }
  }
  yield;
  // the land in the Atlas's dusk (L7): about a fifth darker, the midtones cooled toward indigo, the lights kept warm
  for (let i = 0; i < W * H; i++)
    if (land[i]) {
      const c = src[i];
      const l = luma(c);
      buf[i] = mix(c, MOOD, 0.24 - Math.max(0, l - 0.6) * 0.3);
    }
  // the coast in ink (land touching the sea), the lakes' shores, and the regions' borders as dashed ink
  for (let y = 1; y < H - 1; y++) {
    if (y % 100 === 0) yield;
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const sea = (land[i - 1] ? 0 : 1) + (land[i + 1] ? 0 : 1) + (land[i - W] ? 0 : 1) + (land[i + W] ? 0 : 1);
      if (sea > 0) {
        buf[i] = lineInk(x, y, sea);
        continue;
      }
      if (water[i]) continue;
      if (water[i - 1] === 2 || water[i + 1] === 2 || water[i - W] === 2 || water[i + W] === 2) {
        buf[i] = mix(buf[i], ATLAS_INK[1], 0.7);
        continue;
      }
      // a border between two regions (drawn on one side of it only), dashed
      if ((x + y) % 5 >= 3 || !reg[i]) continue;
      const r = reg[i];
      const j1 = i + 1;
      const j2 = i + W;
      if ((land[j1] && reg[j1] && !sameRegion(r, reg[j1])) || (land[j2] && reg[j2] && !sameRegion(r, reg[j2]))) buf[i] = mix(buf[i], ATLAS_INK[2], 0.85);
    }
  }
  yield;
  // the sheet's neatline: a double ink rule a few px in from the edge (over the sea only: the land stops short of it)
  neatline(buf, W, H, 0, A.sheetW);
}

/** The double neatline on a strip of the sheet starting at world x `x0` (the continent at 0, the far sea after it). */
export function neatline(buf: Int32Array, w: number, h: number, x0: number, sheetW: number): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = x0 + x;
      const e = Math.min(gx, y, sheetW - 1 - gx, h - 1 - y);
      const i = y * w + x;
      if (e === 5) buf[i] = ATLAS_INK[1];
      else if (e === 7) buf[i] = mix(buf[i], ATLAS_INK[2], 0.8);
    }
}

/** The bounding box of the pixels `on` reports (padded by `pad`, clamped to the sheet). */
function boxOf(W: number, H: number, on: (i: number) => boolean, pad = 1): Box {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (on(y * W + x)) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** How strongly a pixel stands out from its neighbours (0..1): the edges a pen would draw. */
function edgeAt(buf: Int32Array, W: number, H: number, x: number, y: number): number {
  const i = y * W + x;
  const l = luma(buf[i]);
  let m = 0;
  if (x > 0) m = Math.max(m, Math.abs(l - luma(buf[i - 1])));
  if (x < W - 1) m = Math.max(m, Math.abs(l - luma(buf[i + 1])));
  if (y > 0) m = Math.max(m, Math.abs(l - luma(buf[i - W])));
  if (y < H - 1) m = Math.max(m, Math.abs(l - luma(buf[i + W])));
  return m;
}

/**
 * His version of one land (the pixels `on` reports), shown until its region is restored: the painted land itself, a
 * touch drained (lead's call L6, playtest round 8: the open lands keep the painted look the playtester liked; an ink
 * sketch read as dirt at the map's zoom). Each colour moves a third of the way toward its own grey, warmed a little
 * toward the paper; the inked coast stays. The full colour floods back when the region is restored.
 * Returns the box and the canvas (transparent off the land).
 */
export function draftOf(buf: Int32Array, W: number, H: number, on: (i: number) => boolean): { box: Box; canvas: HTMLCanvasElement } {
  const box = boxOf(W, H, on, 0);
  const canvas = wordCanvas(box.w, box.h, (u) => {
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const i = (box.y + y) * W + box.x + x;
        if (!on(i)) continue;
        const c = buf[i];
        if (c === ATLAS_INK[0] || c === ATLAS_INK[1]) {
          u[y * box.w + x] = rgba32(c);
          continue;
        }
        const l = Math.round(luma(c) * 255);
        const grey = (l << 16) | (l << 8) | l;
        u[y * box.w + x] = rgba32(mix(mix(c, grey, 0.36), PARCH[4], 0.08));
      }
  });
  return { box, canvas };
}

/**
 * The blank over one land (erased: warm white vellum, docs/story-bible.md section 9): opaque paper over the land that
 * keeps only the impression of its old lines (the coast and the strong edges, pressed a shade darker than the paper).
 * Its frontier with the painted land is a clear torn edge, as on the title: the paper's edge catches the light (a
 * bright warm rim) and throws a thin ink-dark shadow onto the land beside it. `soft(x, y)` is how far into the
 * unknown a point lies (0..1), `on` the land to blank (the shadow may fall on any land in the box).
 */
export function blankOf(
  buf: Int32Array,
  W: number,
  H: number,
  box: Box,
  on: (i: number) => boolean,
  soft: (x: number, y: number) => number,
): HTMLCanvasElement {
  const bw = box.w;
  const bh = box.h;
  const paper = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const gx = box.x + x;
      const gy = box.y + y;
      if (gx >= W || gy >= H || !on(gy * W + gx)) continue;
      const p = soft(gx, gy) + (noise(gx * 0.22, gy * 0.22, 92) - 0.5) * 0.3 + (noise(gx * 0.8, gy * 0.8, 94) - 0.5) * 0.1;
      if (p > 0.47) paper[y * bw + x] = 1;
    }
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < bw && y < bh && paper[y * bw + x] === 1;
  return wordCanvas(bw, bh, (u) => {
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const gx = box.x + x;
        const gy = box.y + y;
        if (gx >= W || gy >= H) continue;
        const i = gy * W + gx;
        const k = y * bw + x;
        if (!paper[k]) {
          // the torn edge's shadow on the land beside it (any land under the box, not the sea)
          const n1 = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
          if (n1 && (on(i) || buf[i] !== -1)) u[k] = rgba32(ATLAS_INK[1], 210);
          else if (at(x - 2, y) || at(x, y - 2) || at(x - 1, y - 1)) u[k] = rgba32(ATLAS_INK[1], 90);
          continue;
        }
        // the paper itself: a warm vellum with a slow mottle
        const m = noise(gx * 0.05, gy * 0.07, 91);
        let c = rampAt(FOG.slice(2), 0.55 + (m - 0.5) * 0.6, gx, gy);
        // the impression: the old lines pressed into it
        const coast = buf[i] === ATLAS_INK[0] || buf[i] === ATLAS_INK[1];
        const e = coast ? 1 : edgeAt(buf, W, H, gx, gy);
        if (e > 0.16) c = coast ? FOG[1] : FOG[2];
        // the torn edge: the paper's rim lit warm, a second row a little less
        const rim = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        if (rim) c = TORN[0];
        else if (!at(x - 2, y) || !at(x + 2, y) || !at(x, y - 2) || !at(x, y + 2)) c = TORN[1];
        u[k] = rgba32(c);
      }
  });
}

/** The compass rose drawn in the sea (31 x 31): four long gold-and-ink points, four short ones, a ring, the N. */
export function compassRose(): HTMLCanvasElement {
  const S = 31;
  const cx = 15;
  const cy = 15;
  const gold = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'].map(col);
  const px = new Int32Array(S * S).fill(-1);
  const set = (x: number, y: number, c: Col) => {
    if (x >= 0 && y >= 0 && x < S && y < S) px[y * S + x] = c;
  };
  // the ring (two inked circles with a faded wash between)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const r = Math.hypot(x - cx, y - cy);
      if (Math.abs(r - 10.5) < 0.5) set(x, y, ATLAS_INK[1]);
      else if (Math.abs(r - 8.6) < 0.45) set(x, y, ATLAS_INK[3]);
      else if (r < 10 && r > 8.9 && (x + y) % 2 === 0) set(x, y, PARCH[3]);
    }
  // the points: each a long diamond split into a lit half and a shaded half (light from the top left)
  const point = (dx: number, dy: number, len: number, wid: number, lit: Col, dark: Col) => {
    for (let t = 0; t <= len; t++) {
      const w = Math.round(wid * (1 - t / len));
      for (let s = -w; s <= w; s++) {
        const x = Math.round(cx + dx * t - dy * s);
        const y = Math.round(cy + dy * t + dx * s);
        set(x, y, s < 0 ? lit : s > 0 ? dark : ATLAS_INK[1]);
      }
    }
  };
  point(1, 1, 8, 1, PARCH[5], ATLAS_INK[2]);
  point(-1, 1, 8, 1, PARCH[5], ATLAS_INK[2]);
  point(1, -1, 8, 1, PARCH[5], ATLAS_INK[2]);
  point(-1, -1, 8, 1, PARCH[5], ATLAS_INK[2]);
  point(0, -1, 14, 3, gold[4], gold[2]);
  point(0, 1, 14, 3, gold[3], gold[1]);
  point(1, 0, 14, 3, gold[3], gold[1]);
  point(-1, 0, 14, 3, gold[4], gold[2]);
  set(cx, cy, gold[4]);
  // the N above the north point
  return wordCanvas(S + 2, S + 8, (u) => {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const c = px[y * S + x];
        if (c >= 0) u[(y + 7) * (S + 2) + x + 1] = rgba32(c);
      }
    const N = ['k...k', 'kk..k', 'k.k.k', 'k..kk', 'k...k'];
    N.forEach((r, yy) => [...r].forEach((ch, xx) => ch === 'k' && (u[yy * (S + 2) + cx - 1 + xx] = rgba32(ATLAS_INK[1]))));
  });
}
