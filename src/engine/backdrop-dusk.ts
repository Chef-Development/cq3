// The Duskmire's fight backdrops, painted with backdrop.ts's toolkit (see there and docs/art-style.md): Lanternfen
// (reed beds and black pools under a violet dusk: willows far off, stilt houses with lit windows, lantern poles, a
// sunken boat), the Drowned Causeway (tidal flats under a teal-violet dusk: a half-sunk stone road running off to the
// horizon, stilt houses, the tide clock tower with its painted hand, a sluice gate) and the Gloaming Mere (a wide black
// lake under a sky stuck at sunset: the lighthouse wading far out, its beam on the water, the mapmaker's drafting
// stilts). The light is the dusk's (rose and violet, from the top left and the low sky) and the lanterns' (warm pools);
// the water mirrors both in broken horizontal strokes. Same contract as backdrop.ts (`bg_`, `frame_`, `fg_`/`fgo_` per
// sway frame); painted the first time an act needs one (Stage.ensure), never at boot.
import type Phaser from 'phaser';
import {
  backlight,
  blade,
  changed,
  clamp01,
  col,
  cornerness,
  fade,
  fbm,
  FG_FRAMES,
  FG_OVERLAP,
  hash,
  haze,
  lambert,
  mass,
  mix,
  noise,
  pebble,
  pick,
  Pix,
  ramp,
  rng,
  SWAY,
  torchLight,
  type Backdrop,
  type Blob,
  type Col,
  type FgLook,
  type Ramp,
  type Theme,
} from './backdrop';

export type DuskTheme = 'fen' | 'causeway' | 'mere';
export const DUSK_BACKDROP_THEMES: DuskTheme[] = ['fen', 'causeway', 'mere'];
export const isDusk = (t: Theme): t is DuskTheme => t === 'fen' || t === 'causeway' || t === 'mere';

// ------------------------------------------------------------------ shared ramps (dark -> light, hue-shifted)

/** The dusk sky: ink-indigo overhead, through violet and plum, to a muted rose glow low on the horizon (L7: darker,
 *  cooler; the warm light is the lanterns'). */
const SKY = ramp('#0a0a1c', '#0e0e24', '#13112c', '#191434', '#20183e', '#2a1c46', '#36224e', '#442856', '#54305c', '#663860', '#784264', '#8a4c66');
/** Black water: blue-black, a cold violet where it catches the sky. */
const WATER = ramp('#0a0a18', '#100f22', '#16162c', '#1e1e38', '#282646', '#343056', '#463c66');
/** Peat banks and mud: violet-black shadow, warm brown tops. */
const PEAT = ramp('#0e0a12', '#16101a', '#1e1620', '#281c26', '#34242c', '#422e32', '#523a38', '#644a40');
/** Reeds (far ones get hazed toward the sky). */
const REED = ramp('#0c1214', '#121c1a', '#18261e', '#203224', '#2a3e28', '#384c2c', '#4a5c30', '#5e6c36');
/** Weathered planks and stilts. */
const PLANK = ramp('#100a10', '#1a1218', '#261a1c', '#342420', '#442e24', '#583a2a', '#6e4a32');
/** Stone of the causeway: violet-grey. */
const STONE = ramp('#121020', '#1a1828', '#242032', '#2e2a3e', '#3a344a', '#484058', '#584e66', '#6a5e76');
const LAMP = col('#ffcc52');
const LAMP_HOT = col('#fff4c4');
const LAMP_LOW = col('#f09428');
const INK = col('#140c1c');

// ------------------------------------------------------------------ painters

/** The dusk sky in stepped bands (dithered at the joins), `glow` lifting it toward the horizon at `gx`. */
function sky(p: Pix, w: number, bottom: number, gx: number, lift: number, seed: number): void {
  for (let y = 0; y < bottom; y++)
    for (let x = 0; x < w; x++) {
      const t = y / bottom;
      const g = Math.max(0, 1 - Math.hypot((x - gx) * 0.008, (bottom - y) * 0.03));
      const v = t * 0.78 + g * lift + (fbm(x * 0.015, y * 0.05, seed) - 0.5) * 0.1;
      p.set(x, y, pick(SKY, v, x, y, 0.4));
    }
}

/** A bank of cloud lying across the dusk in short clumps (at least 3 px tall, open sky between them: one long 1 px
 *  streak read as a scanline glitch at phone size), lit rose underneath from the low sky, a softer lit top edge. */
function cloudBand(p: Pix, x0: number, y0: number, len: number, thick: number, seed: number): void {
  const r2 = rng(seed);
  const bl: Blob[] = [];
  for (let x = x0 + r2() * 6; x < x0 + len; ) {
    const t = Math.sin(Math.min(1, Math.max(0, (x - x0) / len)) * Math.PI);
    const cl = 8 + r2() * 12 * (0.5 + t); // the clump's length
    const dy = (r2() - 0.5) * 3;
    const k = Math.max(2, Math.round(cl / 5));
    for (let i = 0; i < k; i++) {
      const g = i / (k - 1);
      const sw = Math.sin(g * Math.PI);
      bl.push({ x: x + g * cl, y: y0 + dy - t * thick * 0.3 - sw * 0.8, rx: 3 + sw * cl * 0.22, ry: 1.4 + sw * thick * (0.3 + r2() * 0.25) });
    }
    x += cl + 6 + r2() * 12; // a gap of open sky
  }
  const inside = (x: number, y: number) => bl.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1);
  const cr = ramp('#16122e', '#20163a', '#2e1c46', '#44264e', '#5e3256', '#7a4060');
  for (let y = Math.floor(y0 - thick * 2); y <= y0 + thick + 2; y++)
    for (let x = Math.floor(x0 - 10); x <= x0 + len + 10; x++) {
      if (!inside(x, y)) continue;
      const below = inside(x, y + 1) ? (inside(x, y + 2) ? 0 : 1) : 2;
      const above = inside(x, y - 1) ? 0 : 1;
      const v = below === 2 ? 0.95 : below === 1 ? 0.72 : above ? 0.6 : 0.4;
      p.set(x, y, pick(cr, v + (noise(x * 0.2, y, seed) - 0.5) * 0.15, x, y));
    }
}

/** A band of water from y0 to y1: the sky above mirrored in broken horizontal strokes, darker toward the viewer. */
function water(p: Pix, w: number, y0: number, y1: number, seed: number, glints: NonNullable<Backdrop['glints']>, mirror = true): void {
  const src = p.buf.slice();
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    for (let x = 0; x < w; x++) {
      // the reflection of whatever is just above the waterline (flipped), broken up by the ripples
      const my = Math.round(y0 - 1 - (y - y0) * 1.6 + Math.sin(x * 0.8 + y * 1.7) * 1.2);
      const refl = mirror && my >= 0 ? src[my * w + x] : -1;
      let c = pick(WATER, 0.62 - t * 0.5 + (noise(x * 0.04, y * 0.6, seed) - 0.5) * 0.2, x, y, 0.3);
      const stroke = noise(x * 0.09, y * 1.4, seed + 5);
      if (refl >= 0 && stroke > 0.42) c = mix(c, refl, (0.55 - t * 0.35) * clamp01((stroke - 0.42) * 4));
      if (stroke > 0.84 && t < 0.7) c = mix(c, col('#7a5a80'), 0.25);
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash(i, 1, seed) * w);
    const y = y0 + 1 + Math.floor(hash(i, 2, seed) * Math.max(1, (y1 - y0) * 0.6));
    glints.push({ x, y, c: 0xb8a0c8 });
  }
}

/** A lantern's reflection: a wavering column of warm strokes under it on the water. */
function lampReflection(p: Pix, x: number, y0: number, len: number, seed: number): void {
  for (let k = 0; k < len; k++) {
    const y = y0 + k;
    const wob = Math.round(Math.sin(k * 1.3 + seed) * 1.2);
    const wd = k < 2 ? 1 : 1 + (k % 3 === 0 ? 1 : 0);
    if (k > 1 && hash(k, 3, seed) < 0.25) continue;
    for (let d = 0; d < wd; d++) p.set(x + wob + d, y, mix(p.get(x + wob + d, y), k < len * 0.4 ? LAMP : LAMP_LOW, 0.75 - (k / len) * 0.45));
  }
}

/** A lantern on a pole: a dark post, an arm, the lantern (glass lit), its glow on the air. Returns the glass's spot. */
function lanternPole(p: Pix, x: number, base: number, hgt: number, dir: number, r: Ramp): [number, number] {
  for (let y = base - hgt; y <= base; y++) {
    p.set(x, y, r[3]);
    p.set(x + 1, y, r[1]);
  }
  const ax = x + dir * 3;
  for (let i = 0; i <= 3; i++) p.set(x + dir * i, base - hgt, r[2]);
  // the lantern hanging off the arm
  const ly = base - hgt + 2;
  p.set(ax, ly - 1, r[1]);
  for (let yy = 0; yy < 3; yy++)
    for (let xx = -1; xx <= 1; xx++) p.set(ax + xx, ly + yy, xx === 0 && yy === 1 ? LAMP_HOT : xx === 1 || yy === 2 ? LAMP_LOW : LAMP);
  p.set(ax, ly + 3, r[1]);
  torchLight(p, ax + 0.5, ly + 1.5, 10, 8, col('#ff9a40'), 0.35);
  return [ax, ly + 1];
}

/** A stilt house: a little hut on poles over the water, a sloping roof, a lit window or two. */
function stiltHouse(p: Pix, x: number, base: number, wd: number, ht: number, legs: number, r: Ramp, roof: Ramp, lit: boolean, glints: NonNullable<Backdrop['glints']>): void {
  const floor = base - legs;
  // stilts
  for (let i = 0; i < 3; i++) {
    const sx = x + 1 + Math.round(((wd - 3) * i) / 2);
    for (let y = floor; y <= base; y++) p.set(sx, y, r[i === 0 ? 2 : 1]);
  }
  // the walls, lit on the left
  for (let y = floor - ht; y <= floor; y++)
    for (let xx = 0; xx < wd; xx++) p.set(x + xx, y, pick(r, xx < wd * 0.35 ? 0.62 : xx < wd - 1 ? 0.42 : 0.2, x + xx, y) + 0);
  // planks along the floor edge, a porch rail
  for (let xx = -2; xx < wd + 2; xx++) p.set(x + xx, floor + 1, r[2]);
  // the roof: thatch sloping down both sides, its lit face rose from the sky
  const peak = floor - ht - Math.round(wd * 0.45);
  for (let y = peak; y <= floor - ht + 1; y++) {
    const k = (y - peak) / Math.max(1, floor - ht + 1 - peak);
    const hw = 1 + k * (wd / 2 + 2);
    const cx = x + wd / 2;
    for (let xx = Math.floor(cx - hw); xx <= cx + hw; xx++) p.set(xx, y, pick(roof, xx < cx ? 0.72 - k * 0.2 : 0.35 - k * 0.1, xx, y));
  }
  // a window, warm with lamplight (or dark)
  const wx = x + Math.round(wd * 0.3);
  const wy = floor - Math.round(ht * 0.65);
  for (let yy = 0; yy < 2; yy++)
    for (let xx = 0; xx < 2; xx++) p.set(wx + xx, wy + yy, lit ? (yy === 0 ? LAMP : LAMP_LOW) : r[0]);
  if (lit) {
    torchLight(p, wx + 1, wy + 1, 6, 4, col('#ff9a40'), 0.2);
    glints.push({ x: wx, y: wy, c: 0xffcc52 });
  }
}

/** A clump of reeds and cattails standing in the water: thin stalks, a brown head on some. */
function reedClump(p: Pix, cx: number, base: number, wd: number, hgt: number, r: Ramp, seed: number, heads = true): void {
  const n = Math.round(wd * 1.2);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx - wd / 2 + hash(i, 1, seed) * wd);
    const h = Math.round(hgt * (0.55 + hash(i, 2, seed) * 0.45));
    const lean = (hash(i, 3, seed) - 0.5) * 0.25;
    for (let k = 0; k < h; k++) {
      const xx = Math.round(x + lean * k);
      p.set(xx, base - k, pick(r, 0.2 + (k / h) * 0.6 + (i % 2 ? 0.1 : 0), xx, base - k));
    }
    if (heads && hash(i, 4, seed) > 0.6 && h > hgt * 0.7) {
      const hx = Math.round(x + lean * h);
      const ct = ramp('#1e0e10', '#3a1a16', '#5a2c1c', '#7e4224');
      for (let k = 2; k < 5; k++) p.set(hx, base - h + k, ct[k === 2 ? 3 : 1 + (k % 2)]);
    }
  }
}

/** A low far shore: willows and alders in soft clumps, hazed toward the sky. */
function farShore(p: Pix, w: number, top: number, base: number, r: Ramp, seed: number): void {
  const bl: Blob[] = [];
  const r2 = rng(seed);
  for (let x = -10; x < w + 20; x += 9 + Math.floor(r2() * 8)) {
    const tall = r2() < 0.35;
    bl.push({ x, y: base - (tall ? (base - top) * 0.7 : (base - top) * 0.35), rx: 6 + r2() * 6, ry: tall ? (base - top) * 0.6 : (base - top) * 0.35 });
  }
  mass(p, bl, { ramp: r, seed, bump: 0.22, tex: 0.2, vgrad: 0.25, shadow: 0.1, floor: base, band: 0.3 });
}

// ------------------------------------------------------------------ Lanternfen

function fen(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const hz = col('#8a4a6c'); // the haze the dusk lays over everything far
  const horizon = G - 30;
  sky(p, w, horizon + 2, w * 0.3, 0.22, 11);
  cloudBand(p, -20, 16, 140, 4, 13);
  cloudBand(p, 170, 26, 120, 3, 17);
  cloudBand(p, 90, 9, 70, 2.4, 19);
  // the far shore: willows in the haze, then a nearer, darker line of alders
  farShore(p, w, horizon - 18, horizon + 1, haze(REED, hz, 0.5), 21);
  farShore(p, w, horizon - 10, horizon + 3, haze(REED, hz, 0.3), 23);
  // the black pools spread over the middle distance, mirroring the sky
  water(p, w, horizon + 3, G - 9, 29, glints);
  // reed beds standing in the water, the far ones hazed
  for (const [cx, wd, hgt, s] of [
    [30, 26, 12, 31],
    [96, 18, 9, 33],
    [210, 30, 13, 35],
    [290, 22, 10, 37],
  ] as const)
    reedClump(p, cx, horizon + 6 + (s % 3), wd, hgt, haze(REED, hz, 0.25), s);
  // stilt houses on the far side, a window lit in each
  stiltHouse(p, 236, horizon + 6, 13, 7, 6, haze(PLANK, hz, 0.25), haze(ramp('#1a1018', '#2e1c22', '#4a2e2c', '#6a4434', '#8a5c40'), hz, 0.2), true, glints);
  stiltHouse(p, 258, horizon + 5, 9, 5, 5, haze(PLANK, hz, 0.35), haze(ramp('#1a1018', '#2e1c22', '#4a2e2c', '#6a4434', '#8a5c40'), hz, 0.3), false, glints);
  stiltHouse(p, 58, horizon + 5, 10, 6, 6, haze(PLANK, hz, 0.35), haze(ramp('#1a1018', '#2e1c22', '#4a2e2c', '#6a4434', '#8a5c40'), hz, 0.3), true, glints);
  // a sunken boat in the shallows: its prow up out of the water, half its hull under
  const bx = 150;
  const by = G - 14;
  for (let i = 0; i < 16; i++) {
    const top = by - Math.round(Math.max(0, 6 - i * 0.5) + (i < 3 ? 2 - i : 0));
    for (let y = top; y <= by; y++) p.set(bx + i, y, pick(PLANK, y === top ? 0.75 : 0.35 - (y - top) * 0.04, bx + i, y));
  }
  for (let i = 0; i < 16; i += 3) p.set(bx + i, by - 1, PLANK[1]);
  lampReflection(p, bx + 3, by + 1, 4, 3);
  // lantern poles along the boardwalk at the back, each lamp's light wavering on the water under it
  const poleR = haze(PLANK, hz, 0.1);
  for (const [x, hgt, dir] of [
    [84, 22, 1],
    [196, 24, -1],
    [270, 19, 1],
  ] as const) {
    const base = G - 11;
    const [lx, ly] = lanternPole(p, x, base, hgt, dir, poleR);
    lampReflection(p, lx, base + 1, 7, x);
    glints.push({ x: lx, y: ly, c: 0xffd070 });
  }
  // the near bank: a low boardwalk of old planks laid along the peat (calm under the fighters' feet)
  const bank = G - 9;
  for (let y = bank; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - bank) / (h - bank);
      let v = 0.42 - t * 0.2 + (fbm(x * 0.05, y * 0.2, 41) - 0.5) * 0.2;
      if (y === bank) v += 0.22; // the bank's lip catching the dusk
      p.set(x, y, pick(PEAT, v, x, y, 0.25));
    }
  // planks: long boards, lit on top, a seam between each (only in the strip behind the fighters' line)
  for (let y = bank + 1; y < G - 2; y++)
    for (let x = 0; x < w; x++) {
      const board = Math.floor((x + (y % 2) * 13) / 26);
      const seam = (x + (y % 2) * 13) % 26 === 0;
      if (hash(board, y, 43) < 0.15) continue; // a missing board
      p.set(x, y, seam ? PLANK[1] : pick(PLANK, y === bank + 1 ? 0.6 : 0.4 + (noise(x * 0.1, y, 47) - 0.5) * 0.12, x, y));
    }
  // moss tufts and pebbles along the front, kept off the line the fighters stand on
  const rnd = rng(51);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(rnd() * w);
    const y = G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    pebble(p, x, y, 1, 0, PEAT, PEAT[0]);
  }
  // the edges sink into the dusk
  vignette(p, w, h, col('#0e0818'));

  // framing: a tall willow on the left hanging its fronds over the top; cattails tall in the right corner
  const before = p.buf.slice();
  const willow = ramp('#06060c', '#0a0c12', '#0e1216', '#14181a', '#1c221e', '#262c22');
  for (let y = 0; y < G + 2; y++) {
    const half = 4 + Math.max(0, (y - (G - 16)) * 0.3);
    for (let x = 0; x <= 5 + half; x++) p.set(x, y, x === Math.floor(5 + half) ? INK : pick(willow, 0.5 - (x / (5 + half)) * 0.35 + (noise(x * 0.5, y * 0.2, 61) - 0.5) * 0.25, x, y));
  }
  // the hanging fronds: long thin strands falling from the canopy over the top-left
  for (let i = 0; i < 26; i++) {
    const x0 = Math.round(hash(i, 1, 63) * 92);
    const len = Math.round(8 + hash(i, 2, 63) * (x0 < 40 ? 34 : 18));
    for (let k = 0; k < len; k++) {
      const x = Math.round(x0 + Math.sin(k * 0.18 + i) * 1.2);
      p.set(x, k, pick(willow, 0.25 + (1 - k / len) * 0.5, x, k));
    }
  }
  mass(p, [{ x: 18, y: -4, rx: 30, ry: 9 }, { x: 52, y: -6, rx: 24, ry: 7 }, { x: 80, y: -7, rx: 16, ry: 5 }], { ramp: willow, seed: 65, bump: 0.25, tex: 0.3, vgrad: 0.2, shadow: 0.15 });
  reedClump(p, w - 12, G + 2, 26, 44, ramp('#04060a', '#080c0e', '#0c1210', '#121a14', '#1a2418', '#24301c'), 67);
  const frame = changed(p, before);
  return [p, frame, { torches, glints }];
}

// ------------------------------------------------------------------ the Drowned Causeway

function causeway(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const hz = col('#5a5a80'); // a cooler haze over the flats
  const horizon = G - 34;
  sky(p, w, horizon + 2, w * 0.7, 0.18, 71);
  cloudBand(p, 10, 12, 110, 3.4, 73);
  cloudBand(p, 200, 20, 140, 4, 77);
  // the far flats meet the sky: a thin dark line of land with the tide clock tower on it
  for (let x = 0; x < w; x++) {
    const top = horizon - Math.round(fbm(x * 0.03, 1, 79) * 3);
    for (let y = top; y <= horizon + 1; y++) p.set(x, y, pick(haze(PEAT, hz, 0.45), 0.45, x, y));
  }
  // the tide clock tower: a tall square tower, a big clock face with one painted hand
  const tx = 238;
  const tTop = horizon - 34;
  const towerR = haze(STONE, hz, 0.25);
  for (let y = tTop; y <= horizon; y++) {
    const hw = 5 + (y - tTop) * 0.04;
    for (let x = Math.floor(tx - hw); x <= tx + hw; x++) p.set(x, y, pick(towerR, x < tx - 1 ? 0.62 : x < tx + hw - 1 ? 0.42 : 0.2, x, y));
  }
  // its pointed cap
  for (let y = tTop - 8; y < tTop; y++) {
    const hw = ((y - (tTop - 8)) / 8) * 6.5;
    for (let x = Math.floor(tx - hw); x <= tx + hw; x++) p.set(x, y, pick(haze(ramp('#2a0c1a', '#521424', '#86202a', '#b43a34'), hz, 0.25), x < tx ? 0.8 : 0.35, x, y));
  }
  // the clock face: a pale disc, ticks, the one painted hand (it points where he says the tide is)
  const cy = tTop + 8;
  for (let y = -4; y <= 4; y++)
    for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y);
      if (d > 4.3) continue;
      p.set(tx + x, cy + y, d > 3.4 ? col('#3a3448') : mix(col('#e8d6c0'), col('#c4a890'), (x + y + 8) / 16));
    }
  for (let k = 0; k <= 3; k++) p.set(tx + k, cy - Math.round(k * 0.7), col('#521424'));
  p.set(tx, cy, INK);
  glints.push({ x: tx - 2, y: cy - 2, c: 0xfff0d0 });
  // a lit window low on the tower
  p.set(tx - 1, horizon - 10, LAMP);
  p.set(tx - 1, horizon - 9, LAMP_LOW);
  // the flats: shallow water over sand, mirroring the sky; sandbars showing in stripes
  water(p, w, horizon + 2, G - 8, 83, glints);
  for (let i = 0; i < 5; i++) {
    const y = horizon + 5 + i * 4 + Math.floor(hash(i, 1, 85) * 2);
    const x0 = Math.floor(hash(i, 2, 85) * w);
    const len = 20 + Math.floor(hash(i, 3, 85) * 40);
    for (let x = x0; x < x0 + len; x++) {
      const thick = Math.sin(((x - x0) / len) * Math.PI) > 0.4 ? 2 : 1;
      for (let k = 0; k < thick; k++) p.set(x % w, y + k, pick(haze(PEAT, hz, 0.3 - i * 0.05), k ? 0.4 : 0.62, x, y + k));
    }
  }
  // the old stone road running off to the horizon, half under the tide: kerbstones showing, the middle drowned
  const vx = 150; // its vanishing point
  for (let y = horizon + 2; y < G - 8; y++) {
    const t = (y - horizon) / (G - 8 - horizon);
    const hw = 2 + t * 30;
    const cxr = vx - t * 40;
    for (const side of [-1, 1]) {
      const x = Math.round(cxr + side * hw);
      const wdt = Math.max(1, Math.round(t * 3));
      for (let k = 0; k < wdt; k++) p.set(x + side * k, y, pick(haze(STONE, hz, 0.4 - t * 0.35), side < 0 ? 0.7 : 0.45, x, y));
    }
    // a drowned slab glinting through the water here and there
    if (Math.floor(y * 0.7) % 3 === 0 && t > 0.3) for (let x = Math.round(cxr - hw * 0.6); x < cxr + hw * 0.6; x += 7) p.set(x, y, mix(p.get(x, y), STONE[5], 0.3));
  }
  // stilt houses along the causeway, one with its lamp lit
  stiltHouse(p, 46, horizon + 9, 14, 7, 7, haze(PLANK, hz, 0.25), haze(ramp('#18141e', '#2a2230', '#423444', '#5e4a56', '#7a6070'), hz, 0.2), true, glints);
  stiltHouse(p, 72, horizon + 6, 9, 5, 5, haze(PLANK, hz, 0.4), haze(ramp('#18141e', '#2a2230', '#423444', '#5e4a56', '#7a6070'), hz, 0.35), false, glints);
  stiltHouse(p, 282, horizon + 10, 12, 7, 8, haze(PLANK, hz, 0.25), haze(ramp('#18141e', '#2a2230', '#423444', '#5e4a56', '#7a6070'), hz, 0.2), true, glints);
  // a sluice gate on the right: two stone piers and a timber gate between them, water spilling under it
  const gx = 186;
  const gb = G - 12;
  for (let y = gb - 16; y <= gb; y++)
    for (const px of [gx, gx + 18])
      for (let x = px; x < px + 4; x++) p.set(x, y, pick(STONE, x === px ? 0.7 : x === px + 3 ? 0.25 : 0.5, x, y));
  for (let y = gb - 12; y <= gb - 3; y++)
    for (let x = gx + 4; x < gx + 18; x++) p.set(x, y, (x - gx) % 4 === 0 ? PLANK[1] : pick(PLANK, y === gb - 12 ? 0.8 : 0.5, x, y));
  // the winding wheel on top
  for (const [dx, dy] of [
    [0, 0],
    [1, -1],
    [2, 0],
    [1, 1],
    [1, 0],
  ])
    p.set(gx + 10 + dx, gb - 15 + dy, dx === 1 && dy === 0 ? PLANK[1] : STONE[6]);
  for (let x = gx + 4; x < gx + 18; x++) {
    p.set(x, gb - 2, col('#d4eeea'));
    if (x % 2) p.set(x, gb - 1, col('#7aaab0'));
  }
  // lantern poles along the road
  for (const [x, hgt, dir] of [
    [112, 20, 1],
    [262, 22, -1],
  ] as const) {
    const base = G - 10;
    const [lx, ly] = lanternPole(p, x, base, hgt, dir, haze(PLANK, hz, 0.1));
    lampReflection(p, lx, base + 1, 6, x);
    glints.push({ x: lx, y: ly, c: 0xffd070 });
  }
  // the near ground: the causeway's own flagstones, wet, worn smooth (calm under the fighters' feet)
  const road = G - 8;
  for (let y = road; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - road) / (h - road);
      const row = Math.floor((y - road) / 4);
      const joint = (y - road) % 4 === 0 || (x + row * 9) % 18 === 0;
      let v = 0.44 - t * 0.2 + (fbm(x * 0.06, y * 0.3, 87) - 0.5) * 0.14;
      if (y === road) v += 0.2;
      if (joint && y < G - 1) v -= 0.16;
      p.set(x, y, pick(STONE, v, x, y, 0.2));
    }
  // puddles on the flags, the sky caught in them
  for (const [x, y, wd] of [
    [38, G + 4, 9],
    [250, G + 6, 12],
    [120, G + 8, 7],
  ] as const)
    for (let k = 0; k < wd; k++) {
      p.set(x + k, y, mix(col('#3a2a52'), col('#7a5a80'), k / wd));
      if (k > 1 && k < wd - 1) p.set(x + k, y + 1, col('#3a2a4c'));
    }
  vignette(p, w, h, col('#0a0a1a'));

  // framing: mooring posts on the left with a coil of rope, a hanging lantern; old pilings on the right
  const before = p.buf.slice();
  const postR = ramp('#06040a', '#0c080e', '#140e14', '#1e1418', '#2a1c1e', '#36241e');
  for (const [px, top, wd] of [
    [2, -2, 9],
    [14, 30, 6],
    [w - 9, 10, 8],
    [w - 20, 40, 5],
  ] as const)
    for (let y = top; y < G + 2; y++)
      for (let x = px; x < px + wd; x++) {
        const u = (x - px) / wd;
        p.set(x, y, x === px + wd - 1 ? INK : pick(postR, 0.6 - u * 0.4 + (noise(x * 0.5, y * 0.2, 91) - 0.5) * 0.25, x, y));
      }
  // rope wound round the near post
  for (let k = 0; k < 4; k++) for (let x = 2; x < 11; x++) p.set(x, 52 + k * 2, pick(ramp('#2a1e18', '#4a3626', '#6e5236', '#8e6c44'), x < 5 ? 0.85 : 0.4, x, 52 + k * 2));
  // a lantern hung on the near-left post
  const fx = 13;
  const fy = 22;
  for (let yy = 0; yy < 4; yy++)
    for (let xx = -1; xx <= 1; xx++) p.set(fx + xx, fy + yy, yy === 0 || yy === 3 ? postR[2] : xx === 0 && yy === 1 ? LAMP_HOT : LAMP);
  torches.push({ x: fx, y: fy + 2 });
  const frame = changed(p, before);
  return [p, frame, { torches, glints }];
}

// ------------------------------------------------------------------ the Gloaming Mere

function mere(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const hz = col('#a04a5a');
  const horizon = G - 32;
  // a sky stuck at sunset: deeper, redder at the horizon than the fen's, a long bar of cloud across it
  sky(p, w, horizon + 2, w * 0.5, 0.3, 101);
  cloudBand(p, -10, 22, 160, 4.5, 103);
  cloudBand(p, 180, 12, 160, 3.4, 107);
  // the far rim of the mere: low hills, faint
  for (let x = 0; x < w; x++) {
    const top = horizon - Math.round(4 + fbm(x * 0.02, 2, 109) * 7);
    for (let y = top; y <= horizon + 1; y++) p.set(x, y, pick(haze(PEAT, hz, 0.55), 0.38 + (y === top ? 0.15 : 0), x, y));
  }
  // the lake: wide and black, mirroring the burning sky
  water(p, w, horizon + 2, G - 8, 111, glints);
  // the lighthouse wading far out on its two stone legs, the lamp blazing, its beam laid across the water
  const lx = 214;
  const lb = horizon + 8;
  const towerR = haze(ramp('#1c1626', '#2e2638', '#463a4e', '#5e5064', '#7a687a'), hz, 0.35);
  for (const dx of [-3, 3])
    for (let y = lb - 7; y <= lb; y++) for (let x = lx + dx - 1; x <= lx + dx + 1; x++) p.set(x, y, pick(towerR, x < lx + dx ? 0.55 : 0.3, x, y));
  for (let y = lb - 34; y < lb - 7; y++) {
    const hw = 3 + ((y - (lb - 34)) / 27) * 2.5;
    for (let x = Math.floor(lx - hw); x <= lx + hw; x++) {
      const band = Math.floor((y - (lb - 34)) / 5) % 2 === 1;
      p.set(x, y, band ? mix(pick(towerR, x < lx ? 0.6 : 0.3, x, y), col('#86202a'), 0.45) : pick(towerR, x < lx - 1 ? 0.75 : x < lx + hw - 1 ? 0.5 : 0.25, x, y));
    }
  }
  // the gallery and the lamp
  for (let x = lx - 5; x <= lx + 5; x++) p.set(x, lb - 35, towerR[1]);
  for (let y = lb - 40; y < lb - 35; y++) for (let x = lx - 2; x <= lx + 2; x++) p.set(x, y, Math.abs(x - lx) < 2 ? LAMP_HOT : LAMP);
  for (let x = lx - 3; x <= lx + 3; x++) p.set(x, lb - 41, col('#521424'));
  p.set(lx, lb - 42, col('#521424'));
  torchLight(p, lx + 0.5, lb - 38, 26, 18, col('#ffb050'), 0.4);
  glints.push({ x: lx, y: lb - 38, c: 0xfff4c4 });
  // its beam: a long pale wedge swept off to the left across the water, broken up toward its end
  for (let i = 4; i < 150; i++) {
    const spread = 0.6 + i * 0.05;
    for (let s = -spread * 0.7; s <= spread * 0.7; s++) {
      const x = lx - 4 - i;
      const y = Math.round(lb - 38 + i * 0.16 + s);
      if (y < 0 || y >= horizon + 2) continue;
      if (i > 90 && (x + y) % 2) continue;
      if (i > 120 && (x + y * 2) % 3) continue;
      if (Math.abs(s) > spread - 1 && i > 30) continue; // its edges fall away: a beam, not a wash
      p.set(x, y, mix(p.get(x, y), col('#ffd890'), Math.max(0.1, 0.42 - i * 0.0026)));
    }
  }
  // the lamp's light laid on the water under it, a long column
  lampReflection(p, lx, horizon + 3, Math.min(14, G - 9 - horizon - 3), 5);
  // the mapmaker's drafting stilts: tall thin legs, a drafting table on top, a pen standing up in its pot
  const dx = 70;
  const db = horizon + 10;
  const stilt = haze(PLANK, hz, 0.3);
  for (let y = db - 30; y <= db; y++) {
    const spread = ((db - y) / 30) * 2;
    p.set(Math.round(dx - 4 + spread), y, stilt[2]);
    p.set(Math.round(dx + 4 - spread), y, stilt[1]);
    if ((db - y) % 8 === 0) for (let x = Math.round(dx - 4 + spread); x <= dx + 4 - spread; x++) p.set(x, y, stilt[1]);
  }
  for (let x = dx - 7; x <= dx + 6; x++) {
    p.set(x, db - 31, col('#d8c4a8'));
    p.set(x, db - 30, stilt[3]);
  }
  for (let y = db - 36; y < db - 31; y++) p.set(dx + 4, y, INK);
  p.set(dx + 4, db - 37, col('#4a3a5e'));
  // dead snags standing in the shallows near the shore
  for (const [x, hgt] of [
    [24, 18],
    [140, 12],
    [300, 15],
  ] as const) {
    for (let k = 0; k < hgt; k++) p.set(x + Math.round(Math.sin(k * 0.3) * 0.8), G - 10 - k, pick(haze(PLANK, hz, 0.15), 0.3 + (k / hgt) * 0.3, x, G - 10 - k));
    for (let k = 1; k < hgt * 0.4; k++) p.set(x + k, G - 10 - Math.round(hgt * 0.6) - Math.round(k * 0.6), PLANK[2]);
  }
  // the near shore: black shingle and flat wet stones (calm under the fighters' feet)
  const shore = G - 8;
  for (let y = shore; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - shore) / (h - shore);
      let v = 0.38 - t * 0.2 + (fbm(x * 0.07, y * 0.3, 113) - 0.5) * 0.18;
      if (y === shore) v += 0.24;
      p.set(x, y, pick(STONE, v, x, y, 0.25));
    }
  // a line of foam where the lake laps the shingle
  for (let x = 0; x < w; x++) if (noise(x * 0.2, 1, 117) > 0.45) p.set(x, shore, col('#7a8a98'));
  const rnd = rng(119);
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rnd() * w);
    const y = G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    pebble(p, x, y, 1 + (i % 3 === 0 ? 1 : 0), 0, STONE, STONE[0]);
  }
  vignette(p, w, h, col('#120818'));

  // framing: rocks and a drowned tree on the left; a tall rock with a cairn and a lantern on the right
  const before = p.buf.slice();
  const rockR = ramp('#06040a', '#0c0810', '#120e18', '#1a1420', '#241c2a', '#302434');
  boulderFrame(p, 8, G + 2, 18, 28, rockR, 121);
  boulderFrame(p, w - 10, G + 2, 16, 40, rockR, 123);
  boulderFrame(p, w - 30, G + 2, 9, 12, rockR, 125);
  // a drowned tree's bare limbs reaching in over the top-left
  const limbR = ramp('#040306', '#08060a', '#0e0a10', '#161016');
  const limbTo = (x0: number, y0: number, ang: number, len: number, th: number, depth: number, seed: number) => {
    const r2 = rng(seed);
    let x = x0;
    let y = y0;
    let a = ang;
    for (let i = 0; i < len; i++) {
      const wd = Math.max(1, th * (1 - i / len));
      for (let d = 0; d < wd; d++) p.set(Math.round(x), Math.round(y + d), d === 0 ? limbR[3] : limbR[1]);
      x += Math.cos(a);
      y += Math.sin(a);
      a += (r2() - 0.5) * 0.3;
      if (depth > 0 && i > 4 && r2() < 0.1) limbTo(x, y, a + (r2() < 0.5 ? -0.6 : 0.5), len * 0.35, wd * 0.6, depth - 1, seed + i);
    }
  };
  for (let y = 0; y < G - 20; y++) for (let x = 0; x < 6 - Math.floor(y / 30); x++) p.set(x, y, pick(limbR, 0.5 - x * 0.08, x, y));
  limbTo(4, 10, -0.2, 60, 3, 2, 127);
  limbTo(3, 26, 0.1, 34, 2, 1, 129);
  // a little cairn on the right rock with a lantern left burning on it
  const cx = w - 12;
  const cy = G - 39;
  for (const [ox, oy, rw] of [
    [0, 0, 3],
    [1, -3, 2],
    [0, -5, 1],
  ] as const)
    for (let yy = -1; yy <= 1; yy++) for (let xx = -rw; xx <= rw; xx++) p.set(cx + ox + xx, cy + oy + yy, pick(rockR, yy < 0 ? 0.8 : 0.4, cx + xx, cy + yy));
  for (let yy = 0; yy < 3; yy++) for (let xx = -1; xx <= 1; xx++) p.set(cx - 7 + xx, cy - 1 + yy, yy === 1 && xx === 0 ? LAMP_HOT : LAMP);
  torches.push({ x: cx - 7, y: cy });
  const frame = changed(p, before);
  return [p, frame, { torches, glints }];
}

/** A dark boulder rising in a corner of the frame (rx wide, ry tall from its base). */
function boulderFrame(p: Pix, cx: number, base: number, rx: number, ry: number, r: Ramp, seed: number): void {
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.3, y * 0.3, seed) - 0.5) * 0.3) continue;
      p.set(x, y, pick(r, 0.3 + 0.55 * lambert(dx, dy) + (noise(x * 0.4, y * 0.4, seed + 1) - 0.5) * 0.15, x, y));
    }
}

/** The edges of the stage sinking into the dusk (dithered steps toward `to`). */
function vignette(p: Pix, w: number, h: number, to: Col): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      const k = Math.max(e < 56 ? ((56 - e) / 56) ** 1.5 * 0.72 : 0, y < 18 ? ((18 - y) / 18) * 0.35 : 0);
      if (k > 0) p.tint(x, y, (c) => fade(c, to, k, x, y, 3, 0.5));
    }
}

// ------------------------------------------------------------------ foregrounds

/** The near ground's dark lip along the bottom edge, rising in the corners. */
function lip(p: Pix, w: number, h: number, L: FgLook, seed: number, cl = 90, cr = 46, lift = 6): void {
  const H = h + FG_OVERLAP;
  for (let x = 0; x < w; x++) {
    const c = cornerness(x, w, cl, cr);
    const top = Math.round(h - 1 - c * lift - noise(x * 0.12, 1, seed) * 2.4);
    for (let y = top; y < H; y++) p.set(x, y, y === top ? L.rim : pick(L.bush, 0.3 - (y - top) * 0.05 + (noise(x * 0.3, y * 0.3, seed + 1) - 0.5) * 0.2, x, y));
  }
}

/** Reeds and rushes along the bottom, dense and tall in the corners, swaying with the frame; a cattail on some. */
function rushes(p: Pix, w: number, h: number, frame: number, L: FgLook, seed: number, tall = 1): void {
  for (let x = 1; x < w - 1; ) {
    const c = cornerness(x, w, 80, 46);
    const hgt = Math.round((2 + c * 14 + hash(x, 1, seed) * 3) * tall);
    const sway = hgt >= 5 ? SWAY[(frame + Math.floor(hash(x, 3, seed) * 2 + x / 40)) % 4] : 0;
    const lean = (hash(x, 4, seed) - 0.5) * 1.2;
    if (c > 0.15 || hash(x, 6, seed) > 0.8) {
      blade(p, x, h + (c > 0.3 ? FG_OVERLAP - 1 : 0), hgt, lean, sway, L, c > 0.5);
      if (hgt > 10 && hash(x, 7, seed) > 0.55) {
        const tx = x + Math.round(lean * hgt * 0.35 + sway);
        const ty = h + (c > 0.3 ? FG_OVERLAP - 1 : 0) - hgt;
        for (let k = 0; k < 3; k++) p.set(tx, ty + 1 + k, k === 0 ? col('#4a2418') : col('#2a1410'));
      }
    }
    x += c > 0.3 ? 2 + Math.floor(hash(x, 5, seed) * 2) : 5 + Math.floor(hash(x, 5, seed) * 6);
  }
}

/** A lily pad or two floating at the bottom edge. */
function lily(p: Pix, cx: number, y: number, rw: number, r: Ramp): void {
  for (let xx = -rw; xx <= rw; xx++)
    for (let yy = -1; yy <= 1; yy++) {
      if ((xx * xx) / (rw * rw) + yy * yy > 1.1) continue;
      if (xx > 0 && xx < rw * 0.6 && yy === -1) continue; // the notch
      p.set(cx + xx, y + yy, pick(r, yy < 0 ? 0.7 : 0.35, cx + xx, y + yy));
    }
}

function foregroundDusk(theme: DuskTheme, w: number, h: number, frame: number): Pix {
  const H = h + FG_OVERLAP;
  const p = new Pix(w, H, -1);
  const ink = col('#04030a');
  let rim = col('#a0587a');
  let mid = col('#3a1e3a');
  if (theme === 'fen') {
    const L: FgLook = { blade: ramp('#04070a', '#080e0e', '#0e1612', '#142016'), rim: col('#6a7a4a'), bush: ramp('#020304', '#05070a', '#090c0e', '#0e1212', '#141a16', '#1c221a'), ink };
    lip(p, w, h, L, 131, 96, 50, 7);
    rushes(p, w, h, frame, L, 133, 1.1);
    lily(p, 44, H - 2, 4, L.bush);
    lily(p, w - 52, H - 2, 3, L.bush);
  } else if (theme === 'causeway') {
    const L: FgLook = { blade: ramp('#040508', '#080a0e', '#0e1014', '#14161a'), rim: col('#7a7a9a'), bush: ramp('#020206', '#05050a', '#0a0a10', '#101016', '#16161e', '#1e1e28'), ink };
    // the causeway's broken kerb along the bottom, sea grass in the corners, a mooring ring
    lip(p, w, h, L, 137, 90, 50, 6);
    rushes(p, w, h, frame, L, 139, 0.7);
    for (let i = 0; i < 5; i++) pebble(p, 60 + Math.floor(hash(i, 4, 141) * (w - 120)), h - 1 + (i % 2 ? 2 : 0), 1 + (i % 2), 1, L.bush, ink);
    rim = col('#8a86b0');
    mid = col('#2a2a44');
  } else {
    const L: FgLook = { blade: ramp('#050308', '#0a060c', '#100a12', '#160e18'), rim: col('#a05a6a'), bush: ramp('#020104', '#050308', '#0a060c', '#100a12', '#160e18', '#1e1420'), ink };
    // black shingle, a few dead rushes, a drift of foam caught on the stones
    lip(p, w, h, L, 143, 96, 50, 8);
    rushes(p, w, h, frame, L, 145, 0.6);
    for (const [x, y] of [
      [20, H - 6],
      [w - 18, H - 5],
      [34, H - 3],
    ])
      p.set(x, y, frame % 2 ? col('#b4c4cc') : col('#7a8a98'));
    rim = col('#c46a6a');
    mid = col('#4a1e2a');
  }
  backlight(p, rim, mid, theme.length + 7);
  return p;
}

// ------------------------------------------------------------------ build

const PAINT: Record<DuskTheme, (w: number, h: number, G: number) => [Pix, Pix, Backdrop]> = { fen, causeway, mere };

/** Paint one Duskmire theme's backdrop textures for the current layout (stage height h, feet line `ground`). */
export function buildDuskBackdrop(scene: Phaser.Scene, theme: DuskTheme, w: number, h: number, ground: number): Backdrop {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const [bg, frame, info] = PAINT[theme](w, h, ground);
  add(`bg_${theme}`, bg.canvas());
  add(`frame_${theme}`, frame.canvas());
  for (let f = 0; f < FG_FRAMES; f++) {
    const fg = foregroundDusk(theme, w, h, f);
    const top = new Pix(w, h, -1);
    top.buf.set(fg.buf.subarray(0, w * h));
    const over = new Pix(w, FG_OVERLAP, -1);
    over.buf.set(fg.buf.subarray(w * h));
    add(`fg_${theme}_${f}`, top.canvas());
    add(`fgo_${theme}_${f}`, over.canvas());
  }
  return info;
}

/** For tests and the art sheet: paint a theme's backdrop into plain pixel buffers (no scene). */
export function paintDuskBackdrop(theme: DuskTheme, w: number, h: number, ground: number): { bg: Pix; frame: Pix; fg: Pix; info: Backdrop } {
  const [bg, frame, info] = PAINT[theme](w, h, ground);
  return { bg, frame, fg: foregroundDusk(theme, w, h, 0), info };
}
