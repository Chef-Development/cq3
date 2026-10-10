// Noonspire's fight backdrops (Region 5), painted with backdrop.ts's toolkit: the White Road (a bleached road across a
// salt plateau, standing stones that cast no shadow, a mirage of a lake on the horizon), the Spire Steps (white towers
// and stairs, brass gates, a sun-hot plaza) and the Great Sundial (the dial's rim and hour lines running off under the
// sun nailed at noon). Decisions L7/L8: a noon can be moody: the zenith deep slate, the horizon bleached but not bright,
// the shadows short, deep and cool (indigo), heat haze over everything; the only blaze is the sun itself. Same contract
// as backdrop.ts (`bg_`, `frame_`, `fg_`/`fgo_` per sway frame); imported only by pack-noon.ts.
import type Phaser from 'phaser';
import {
  backlight,
  blade,
  changed,
  col,
  cornerness,
  fade,
  fbm,
  FG_FRAMES,
  FG_OVERLAP,
  hash,
  lambert,
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
  type Col,
  type FgLook,
  type Ramp,
} from './backdrop';

export type NoonTheme = 'whiteRoad' | 'spireSteps' | 'sundial';

/** The noon sky: a deep slate zenith, down through steel to a bleached, hazy horizon (never bright white). */
const SKY = ramp('#0e1222', '#141a2e', '#1a2238', '#222b44', '#2c3650', '#38425a', '#465064', '#565e6e', '#686e78', '#7c7e82', '#8e8c88', '#9e9a90');
/** Sand and salt crust: violet-black shadow, a dull bleached ochre top. */
const SAND = ramp('#12101a', '#1c1822', '#28202a', '#362a30', '#463836', '#58483e', '#6c5a48', '#827054', '#988562');
/** White stone (the towers, the dial): blue-grey shadow, a pale chalk top. */
const CHALK = ramp('#141828', '#1e2436', '#2a3044', '#383e54', '#4a4e62', '#5e6072', '#747482', '#8c8a94', '#a6a2a6');
const BRASSR = ramp('#1a100c', '#3a2410', '#5e3c14', '#86581c', '#ae7a28', '#d09c3c');
const SUN = col('#fff4c8');
const SUN2 = col('#ffd86a');
const INK = col('#140c1c');

// ------------------------------------------------------------------ painters

function sky(p: Pix, w: number, bottom: number, seed: number): void {
  for (let y = 0; y < bottom; y++)
    for (let x = 0; x < w; x++) {
      const t = y / bottom;
      const v = t * 0.92 + (fbm(x * 0.012, y * 0.05, seed) - 0.5) * 0.08;
      p.set(x, y, pick(SKY, v, x, y, 0.45));
    }
}

/** Heat haze: thin wavering bands near the horizon (a lighter, cooler stroke every few rows). */
function haze(p: Pix, w: number, y0: number, y1: number, seed: number): void {
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++) {
      const n = noise(x * 0.07 + Math.sin(y * 1.3) * 2, y * 0.8, seed);
      if (n > 0.72) p.tint(x, y, (c) => mix(c, col('#8a90a8'), 0.22));
      else if (n < 0.18) p.tint(x, y, (c) => mix(c, col('#1a1e30'), 0.12));
    }
}

/** The sun nailed at noon: a small fierce disc high up, a dark nail through it, a hard halo stepped round it. */
function nailedSun(p: Pix, cx: number, cy: number, r: number, glints: NonNullable<Backdrop['glints']>): void {
  for (let y = cy - r * 3; y <= cy + r * 3; y++)
    for (let x = cx - r * 3; x <= cx + r * 3; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) p.set(x, y, d < r * 0.55 ? SUN : SUN2);
      else if (d <= r * 3) p.tint(x, y, (c) => fade(c, col('#c8c0a0'), ((r * 3 - d) / (r * 2)) ** 1.5 * 0.55, x, y, 3, 0.5));
    }
  // the nail: driven down through it at a slant
  for (let k = -r - 3; k <= r + 2; k++) {
    p.set(cx + Math.round(k * 0.35), cy + k, INK);
    if (k < -r) p.set(cx + Math.round(k * 0.35) + 1, cy + k, col('#3a3448'));
  }
  for (let x = -2; x <= 2; x++) p.set(cx + Math.round((-r - 3) * 0.35) + x, cy - r - 3, col('#2a2436'));
  glints.push({ x: cx, y: cy, c: 0xfff4c8 });
}

/** A standing stone: a dark menhir, lit hard on its top and left face, no shadow on the ground (noon). */
function menhir(p: Pix, x: number, base: number, hgt: number, wd: number, r: Ramp, seed: number): void {
  for (let k = 0; k < hgt; k++) {
    const t = k / hgt;
    const half = (wd / 2) * (1 - t * 0.35) + (noise(k * 0.3, 1, seed) - 0.5) * 0.8;
    for (let xx = Math.floor(x - half); xx <= x + half; xx++) {
      const u = (xx + 0.5 - x) / Math.max(1, half);
      p.set(xx, base - k, pick(r, k >= hgt - 2 ? 0.85 : u < -0.3 ? 0.62 : u < 0.4 ? 0.4 : 0.18, xx, base - k));
    }
  }
}

/** A white tower: a tall block, lit on the left, a slit window or two, a low dome or a flat crenellated top. */
function tower(p: Pix, x: number, base: number, wd: number, hgt: number, r: Ramp, dome: boolean, windows: number): void {
  for (let y = base - hgt; y <= base; y++)
    for (let xx = x; xx < x + wd; xx++) {
      const u = (xx - x) / wd;
      p.set(xx, y, pick(r, u < 0.3 ? 0.62 : u < 0.85 ? 0.4 : 0.2, xx, y));
    }
  if (dome) {
    const cx = x + wd / 2;
    const rr = wd / 2;
    for (let y = Math.floor(base - hgt - rr * 0.8); y < base - hgt; y++)
      for (let xx = Math.floor(cx - rr); xx <= cx + rr; xx++) {
        const dx = (xx + 0.5 - cx) / rr;
        const dy = (y + 0.5 - (base - hgt)) / (rr * 0.8);
        if (dx * dx + dy * dy > 1) continue;
        p.set(xx, y, pick(BRASSR, 0.25 + 0.6 * lambert(dx, dy), xx, y));
      }
  } else for (let xx = x; xx < x + wd; xx += 3) p.set(xx, base - hgt - 1, r[4]);
  for (let i = 0; i < windows; i++) {
    const wx = x + Math.round(wd * 0.4);
    const wy = base - hgt + 4 + i * 7;
    p.set(wx, wy, INK);
    p.set(wx, wy + 1, INK);
  }
}

function vignette(p: Pix, w: number, h: number, to: Col): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      const k = Math.max(e < 56 ? ((56 - e) / 56) ** 1.5 * 0.7 : 0, y < 20 ? ((20 - y) / 20) * 0.35 : 0);
      if (k > 0) p.tint(x, y, (c) => fade(c, to, k, x, y, 3, 0.5));
    }
}

function boulderFrame(p: Pix, cx: number, base: number, rx: number, ry: number, r: Ramp, seed: number): void {
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.3, y * 0.3, seed) - 0.5) * 0.3) continue;
      p.set(x, y, pick(r, 0.3 + 0.55 * lambert(dx, dy) + (noise(x * 0.4, y * 0.4, seed + 1) - 0.5) * 0.15, x, y));
    }
}

/** The ground the fighters stand on: packed sand, calm, a step darker toward the camera. */
function ground(p: Pix, w: number, h: number, top: number, r: Ramp, seed: number): void {
  for (let y = top; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - top) / (h - top);
      let v = 0.5 - t * 0.28 + (fbm(x * 0.05, y * 0.25, seed) - 0.5) * 0.16;
      if (y === top) v += 0.16;
      p.set(x, y, pick(r, v, x, y, 0.25));
    }
}

// ------------------------------------------------------------------ the White Road

function whiteRoad(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const glints: NonNullable<Backdrop['glints']> = [];
  const horizon = G - 30;
  sky(p, w, horizon + 2, 7);
  nailedSun(p, Math.round(w * 0.22), 14, 4, glints);
  // the far rim of the plateau, low and flat
  for (let x = 0; x < w; x++) {
    const top = horizon - Math.round(2 + fbm(x * 0.03, 3, 9) * 4);
    for (let y = top; y <= horizon + 1; y++) p.set(x, y, pick(CHALK, 0.36 + (y === top ? 0.12 : 0), x, y));
  }
  // the mirage of a lake on the horizon: pale violet-blue bands that aren't there
  for (let y = horizon - 1; y <= horizon + 3; y++)
    for (let x = Math.round(w * 0.45); x < w * 0.86; x++) if (noise(x * 0.08, y * 1.4, 11) > 0.45) p.tint(x, y, (c) => mix(c, col('#7a84b8'), 0.4));
  // the plateau: salt pans (pale, cracked) in the sand
  for (let y = horizon + 2; y < G - 8; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - horizon) / (G - 8 - horizon);
      const pan = fbm(x * 0.02, y * 0.12, 13) > 0.56;
      let v = 0.44 + t * 0.08 + (fbm(x * 0.04, y * 0.3, 15) - 0.5) * 0.18;
      let r = SAND;
      if (pan) {
        r = CHALK;
        v = 0.55;
        if (Math.abs(noise(x * 0.25, y * 0.9, 17) - 0.5) < 0.04) v = 0.25; // cracks in the crust
      }
      p.set(x, y, pick(r, v, x, y, 0.3));
    }
  // the white road running off to the horizon
  const vx = Math.round(w * 0.6);
  for (let y = horizon + 2; y < G - 8; y++) {
    const t = (y - horizon) / (G - 8 - horizon);
    const half = 1 + t * 26;
    const cx = vx - t * 30;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) p.set(x, y, pick(CHALK, 0.58 + t * 0.1 + (noise(x * 0.3, y, 19) - 0.5) * 0.1, x, y));
  }
  // standing stones along the road, casting no shadow
  for (const [x, base, hgt, wd] of [
    [42, G - 13, 18, 5],
    [64, G - 15, 11, 4],
    [238, G - 14, 16, 5],
    [272, G - 13, 20, 6],
    [300, G - 18, 9, 3],
  ] as const)
    menhir(p, x, base, hgt, wd, SAND, x);
  haze(p, w, horizon - 4, G - 10, 21);
  ground(p, w, h, G - 8, SAND, 23);
  // the road's own flagstones under the fighters, worn smooth
  for (let x = 0; x < w; x++) if (x % 23 === 0) for (let y = G - 7; y < G - 2; y++) p.set(x, y, SAND[2]);
  const rnd = rng(25);
  for (let i = 0; i < 16; i++) pebble(p, Math.floor(rnd() * w), G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4)), 1, 0, SAND, SAND[0]);
  vignette(p, w, h, col('#0a0c18'));

  // framing: a great standing stone on the right, a dead thorn tree on the left
  const before = p.buf.slice();
  const dark = ramp('#06060c', '#0c0c14', '#14121c', '#1c1a24', '#26222c', '#322c34');
  menhir(p, w - 14, G + 2, 70, 16, dark, 31);
  for (let y = 10; y < G + 2; y++) for (let x = 0; x < 5 - Math.floor(y / 40); x++) p.set(x, y, pick(dark, 0.4 - x * 0.06, x, y));
  const r2 = rng(33);
  const limb = (x0: number, y0: number, a0: number, len: number, depth: number) => {
    let x = x0;
    let y = y0;
    let a = a0;
    for (let i = 0; i < len; i++) {
      p.set(Math.round(x), Math.round(y), dark[3]);
      p.set(Math.round(x), Math.round(y) + 1, dark[1]);
      x += Math.cos(a);
      y += Math.sin(a);
      a += (r2() - 0.5) * 0.35;
      if (depth > 0 && i > 3 && r2() < 0.14) limb(x, y, a + (r2() < 0.5 ? -0.7 : 0.6), len * 0.4, depth - 1);
    }
  };
  limb(3, 18, -0.3, 42, 2);
  limb(3, 34, 0.05, 26, 1);
  const frame = changed(p, before);
  return [p, frame, { torches: [], glints }];
}

// ------------------------------------------------------------------ the Spire Steps

function spireSteps(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const glints: NonNullable<Backdrop['glints']> = [];
  const horizon = G - 26;
  sky(p, w, horizon + 2, 41);
  nailedSun(p, Math.round(w * 0.74), 10, 3, glints);
  // far towers in the haze, then nearer ones, white with deep cool shadow faces
  const far = CHALK.map((c) => mix(c, col('#4a5068'), 0.4));
  for (const [x, wd, hgt, dome] of [
    [20, 10, 44, 1],
    [52, 8, 30, 0],
    [88, 12, 54, 1],
    [196, 9, 36, 0],
    [230, 13, 58, 1],
    [276, 10, 40, 0],
  ] as const)
    tower(p, x, horizon + 2, wd, hgt, far, !!dome, 2);
  // the Dawn Order's spire in the middle distance: taller than all of them, a brass cap
  tower(p, 150, horizon + 4, 14, 66, CHALK, false, 4);
  for (let y = horizon - 70; y < horizon - 62; y++) {
    const half = ((y - (horizon - 70)) / 8) * 7;
    for (let x = Math.floor(157 - half); x <= 157 + half; x++) p.set(x, y, pick(BRASSR, x < 157 ? 0.85 : 0.35, x, y));
  }
  glints.push({ x: 154, y: horizon - 68, c: 0xffe080 });
  // the stairs climbing between them: broad white steps, each lit on its top edge, shadowed on its riser
  for (let i = 0; i < 9; i++) {
    const y = G - 10 - i * 2;
    const x0 = 110 + i * 3;
    const x1 = 214 - i * 3;
    for (let x = x0; x <= x1; x++) {
      p.set(x, y, pick(CHALK, 0.72, x, y));
      p.set(x, y + 1, pick(CHALK, 0.3, x, y + 1));
    }
  }
  // brass gates at the stair foot: two posts and a grille, catching the sun
  for (const gx of [104, 218])
    for (let y = G - 26; y <= G - 9; y++) for (let x = gx; x < gx + 3; x++) p.set(x, y, pick(BRASSR, x === gx ? 0.85 : 0.45, x, y));
  for (let x = 107; x < 218; x += 4) for (let y = G - 24; y <= G - 22; y++) p.set(x, y, BRASSR[2]);
  // the plaza: sun-hot flagstones, a calm strip under the fighters
  ground(p, w, h, G - 8, SAND, 43);
  for (let y = G - 8; y < G - 1; y += 3) for (let x = 0; x < w; x++) if ((x + Math.floor(y / 3) * 7) % 14 === 0) p.set(x, y, SAND[2]);
  haze(p, w, horizon - 30, G - 9, 45);
  vignette(p, w, h, col('#0a0c1a'));

  // framing: a column on each side, white, its fluting in shadow
  const before = p.buf.slice();
  const colR = ramp('#0a0c16', '#12141e', '#1a1c28', '#242634', '#2e3040', '#3a3c4c');
  for (const [x0, wd] of [
    [0, 14],
    [w - 16, 16],
  ] as const)
    for (let y = 0; y < G + 2; y++)
      for (let x = x0; x < x0 + wd; x++) {
        const u = (x - x0) / wd;
        const flute = (x - x0) % 4 === 3;
        p.set(x, y, flute ? colR[0] : pick(colR, u < 0.35 ? 0.7 : 0.3, x, y));
      }
  const frame = changed(p, before);
  return [p, frame, { torches: [], glints }];
}

// ------------------------------------------------------------------ the Great Sundial

function sundial(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const glints: NonNullable<Backdrop['glints']> = [];
  const horizon = G - 32;
  sky(p, w, horizon + 2, 61);
  // the sun drawn down, nailed: larger here, high over the dial
  nailedSun(p, Math.round(w * 0.55), 18, 6, glints);
  // the dial's far rim: a low wall of white stone with hour pillars along it
  for (let x = 0; x < w; x++) for (let y = horizon - 3; y <= horizon + 1; y++) p.set(x, y, pick(CHALK, y === horizon - 3 ? 0.7 : 0.35, x, y));
  for (let x = 8; x < w; x += 26) for (let y = horizon - 12; y < horizon - 3; y++) for (let xx = x; xx < x + 3; xx++) p.set(xx, y, pick(CHALK, xx === x ? 0.7 : 0.3, xx, y));
  // the dial face running toward us: pale stone, its hour lines fanning out from a point far off
  const cx = Math.round(w * 0.55);
  for (let y = horizon + 2; y < G - 8; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - horizon) / (G - 8 - horizon);
      const a = Math.atan2(y - (horizon - 6), x - cx);
      const line = Math.abs(((a * 12) / Math.PI) % 1) < 0.06;
      let v = 0.46 + t * 0.12 + (fbm(x * 0.05, y * 0.3, 63) - 0.5) * 0.1;
      if (line) v = 0.2;
      p.set(x, y, pick(CHALK, v, x, y, 0.3));
    }
  // brass numerals inlaid where the lines meet the near edge
  for (let x = 12; x < w; x += 30) {
    const y = G - 10;
    for (let k = 0; k < 3; k++) p.set(x + k, y, BRASSR[4 - (k % 2)]);
  }
  haze(p, w, horizon - 6, G - 9, 65);
  ground(p, w, h, G - 8, CHALK, 67);
  vignette(p, w, h, col('#08091a'));

  // framing: broken hour pillars at the edges, black against the glare
  const before = p.buf.slice();
  const darkR = ramp('#06060e', '#0c0c16', '#14141e', '#1c1c28', '#262634', '#303040');
  boulderFrame(p, 8, G + 2, 14, 24, darkR, 71);
  for (let y = 4; y < G - 10; y++) for (let x = w - 18; x < w - 6; x++) p.set(x, y, pick(darkR, x < w - 14 ? 0.65 : 0.3, x, y));
  for (let x = w - 21; x < w - 3; x++) for (let y = 2; y < 6; y++) p.set(x, y, pick(darkR, y === 2 ? 0.8 : 0.4, x, y));
  boulderFrame(p, w - 10, G + 2, 12, 12, darkR, 73);
  const frame = changed(p, before);
  void torchLight;
  return [p, frame, { torches: [], glints }];
}

// ------------------------------------------------------------------ foregrounds

function lip(p: Pix, w: number, h: number, L: FgLook, seed: number, cl = 90, cr = 46, lift = 6): void {
  const H = h + FG_OVERLAP;
  for (let x = 0; x < w; x++) {
    const c = cornerness(x, w, cl, cr);
    const top = Math.round(h - 1 - c * lift - noise(x * 0.12, 1, seed) * 2.4);
    for (let y = top; y < H; y++) p.set(x, y, y === top ? L.rim : pick(L.bush, 0.3 - (y - top) * 0.05 + (noise(x * 0.3, y * 0.3, seed + 1) - 0.5) * 0.2, x, y));
  }
}

/** Dry desert grass along the bottom, swaying in the hot wind (thin in the middle, heavy in the corners). */
function dryGrass(p: Pix, w: number, h: number, frame: number, L: FgLook, seed: number): void {
  for (let x = 1; x < w - 1; ) {
    const c = cornerness(x, w, 80, 46);
    const hgt = Math.round(2 + c * 8 + hash(x, 1, seed) * 3);
    const sway = hgt >= 5 ? SWAY[(frame + Math.floor(hash(x, 3, seed) * 2 + x / 40)) % 4] : 0;
    if (c > 0.15 || hash(x, 6, seed) > 0.8) blade(p, x, h + (c > 0.3 ? FG_OVERLAP - 1 : 0), hgt, (hash(x, 4, seed) - 0.5) * 1.6, sway, L, false);
    x += c > 0.3 ? 2 + Math.floor(hash(x, 5, seed) * 2) : 5 + Math.floor(hash(x, 5, seed) * 6);
  }
}

function foregroundNoon(theme: NoonTheme, w: number, h: number, frame: number): Pix {
  const H = h + FG_OVERLAP;
  const p = new Pix(w, H, -1);
  const ink = col('#04040a');
  const L: FgLook = { blade: ramp('#06060a', '#0e0c10', '#18141a', '#221c22'), rim: col('#8a7a64'), bush: ramp('#020206', '#06060c', '#0c0a12', '#121018', '#1a1620', '#221c28'), ink };
  lip(p, w, h, L, theme.length * 7, 96, 50, theme === 'spireSteps' ? 4 : 7);
  if (theme !== 'spireSteps') dryGrass(p, w, h, frame, L, theme.length * 11);
  for (let i = 0; i < 5; i++) pebble(p, 50 + Math.floor(hash(i, 4, theme.length) * (w - 100)), h - 1 + (i % 2 ? 2 : 0), 1 + (i % 2), 1, L.bush, ink);
  backlight(p, theme === 'sundial' ? col('#b8a878') : col('#9a8a70'), col('#2a2430'), theme.length + 3);
  return p;
}

// ------------------------------------------------------------------ build

const PAINT: Record<NoonTheme, (w: number, h: number, G: number) => [Pix, Pix, Backdrop]> = { whiteRoad, spireSteps, sundial };

export function buildNoonBackdrop(scene: Phaser.Scene, theme: NoonTheme, w: number, h: number, groundY: number): Backdrop {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const [bg, frame, info] = PAINT[theme](w, h, groundY);
  add(`bg_${theme}`, bg.canvas());
  add(`frame_${theme}`, frame.canvas());
  for (let f = 0; f < FG_FRAMES; f++) {
    const fg = foregroundNoon(theme, w, h, f);
    const top = new Pix(w, h, -1);
    top.buf.set(fg.buf.subarray(0, w * h));
    const over = new Pix(w, FG_OVERLAP, -1);
    over.buf.set(fg.buf.subarray(w * h));
    add(`fg_${theme}_${f}`, top.canvas());
    add(`fgo_${theme}_${f}`, over.canvas());
  }
  return info;
}
