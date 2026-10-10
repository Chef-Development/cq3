// Original pixel art, generated at boot (see docs/art-style.md). Sprites are character maps (or
// procedural shapes) with an automatic 1px ink outline. Light comes from the top left; ramps are
// hue-shifted. The hero is composed per pose from a body, legs, a cape and a pre-drawn sword at
// clean 8-way pixel slopes; the slimes are shaded from their shape; HUD icons are native-size maps.
import type Phaser from 'phaser';
import { buildCampArt } from './art-camp';
import { buildChestArt } from './art-chests';
import { buildCompanionArt } from './art-companions';
import { CURRENCY_ICONS } from './art-currency';
import { buildFoeArt } from './art-foes';
import { buildGearArt } from './art-gear';
import { buildHeroArt } from './art-heroes';
import { buildRarityArt } from './art-rarity';
import { buildRelicArt } from './art-relics';
import { buildAshRelicArt } from './art-relics-ash';
import { buildSableArt } from './art-sable';
import { buildShrineArt } from './art-shrine';
import { buildDummyArt } from './art-dummy';
import { buildStoryArt } from './art-story';
import { regionPacks } from './region-art';

export const OUTLINE = '#140c1c';
export type Grid = (string | null)[][];
export type Pal = Record<string, string>;

export function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

export function stamp(g: Grid, rows: string[], pal: Pal, ox: number, oy: number): void {
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const gy = oy + y;
      const gx = ox + x;
      if (gy >= 0 && gy < g.length && gx >= 0 && gx < g[0].length) g[gy][gx] = pal[ch] ?? '#ff00ff';
    }),
  );
}

export function put(g: Grid, x: number, y: number, c: string): void {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c;
}

/** Render a grid to a canvas with a 1px outline around every filled pixel. */
export function toCanvas(g: Grid): HTMLCanvasElement {
  const h = g.length;
  const w = g[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const filled = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && g[y][x] !== null;
  ctx.fillStyle = OUTLINE;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) ctx.fillRect(x, y, 1, 1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const col = g[y][x];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  return c;
}

export const whiteOut = (pal: Pal): Pal => Object.fromEntries(Object.keys(pal).map((k) => [k, '#ffffff']));

/**
 * A material shaded from its own shape (light from the top left): each list gives the ramp index
 * for pixels 1, 2, ... px in from that edge of the form; everything else gets `mid`.
 */
export interface Shade {
  ramp: string[]; // dark to light
  same?: string; // other map letters that belong to the same form (details drawn on it)
  top?: number[];
  left?: number[];
  right?: number[];
  bottom?: number[];
  mid?: number;
}

function shadeTone(rows: string[], x: number, y: number, ch: string, s: Shade): string {
  const inForm = (xx: number, yy: number) => {
    const c = rows[yy]?.[xx];
    return c !== undefined && (c === ch || (s.same ?? '').includes(c));
  };
  const depth = (dx: number, dy: number, max: number) => {
    for (let d = 1; d <= max; d++) if (!inForm(x + dx * d, y + dy * d)) return d;
    return 0;
  };
  const bottom = s.bottom ?? [0, 1];
  const right = s.right ?? [1];
  const top = s.top ?? [3, 3];
  const left = s.left ?? [3];
  let d = depth(0, 1, bottom.length);
  if (d) return s.ramp[bottom[d - 1]];
  d = depth(1, 0, right.length);
  if (d) return s.ramp[right[d - 1]];
  d = depth(0, -1, top.length);
  if (d) return s.ramp[top[d - 1]];
  d = depth(-1, 0, left.length);
  if (d) return s.ramp[left[d - 1]];
  return s.ramp[s.mid ?? 2];
}

/** Stamp a map, shading the letters listed in `shades` automatically. */
export function stampShaded(g: Grid, rows: string[], pal: Pal, shades: Record<string, Shade>, ox: number, oy: number, flash = false): void {
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const col = flash ? '#ffffff' : shades[ch] ? shadeTone(rows, x, y, ch, shades[ch]) : (pal[ch] ?? '#ff00ff');
      put(g, ox + x, oy + y, col);
    }),
  );
}

// ------------------------------------------------------------------ hero (Rowan, an armored blade knight)

export const HERO_W = 54;
export const HERO_H = 42;
export const HERO_FEET_X = 23; // x of the feet center inside the frame

// Rowan's frames are drawn on the shared rig: art-hero-rowan.ts (his sword: art-sword.ts).

// ------------------------------------------------------------------ slime (procedural glossy jelly)

// teal jelly ramp, hue-shifted: shadows lean blue, highlights lean yellow-green
const SLIME_RAMP = ['#14284a', '#1b5464', '#25866e', '#3fb47e', '#7cdc8e', '#d4fac0'];
const SLIME_RIM = '#74ecd0';
const SLIME_INK = '#140c1c';

type Face = 'idle' | 'angry' | 'attack' | 'hurt';

// [left eye, right eye, mouth]; k ink, W shine, r tongue, d dark jelly
const SLIME_FACE: Record<Face, string[][]> = {
  idle: [['Wk', 'kk', 'kk'], ['Wk', 'kk', 'kk'], ['d.d', '.d.']],
  angry: [['k..', '.kk', '.Wk', '.kk'], ['..k', 'kk.', 'Wk.', 'kk.'], ['.kk.', 'k..k']],
  attack: [['Wk', 'kk', 'kk'], ['Wk', 'kk', 'kk'], ['kkkk', 'krrk', '.kk.']],
  hurt: [['k.', '.k', 'k.'], ['.k', 'k.', '.k'], ['.d.', 'd.d']],
};
const SLIME_FACE_BIG: Record<Face, string[][]> = {
  idle: [
    ['WWk', 'Wkk', 'kkk', 'kkk', '.k.'],
    ['WWk', 'Wkk', 'kkk', 'kkk', '.k.'],
    ['d..d', '.dd.'],
  ],
  angry: [
    ['kk...', '..kk.', '.WWkk', '.Wkkk', '.kkkk', '..kk.'],
    ['...kk', '.kk..', 'WWkk.', 'Wkkk.', 'kkkk.', '.kk..'],
    ['.kkkk.', 'k....k'],
  ],
  attack: [
    ['WWk', 'Wkk', 'kkk', 'kkk', '.k.'],
    ['WWk', 'Wkk', 'kkk', 'kkk', '.k.'],
    ['.kkkk.', 'kkrrkk', 'krrrrk', '.kkkk.'],
  ],
  hurt: [
    ['k..', '.kk', '..k', '.kk', 'k..'],
    ['..k', 'kk.', 'k..', 'kk.', '..k'],
    ['.dd.', 'd..d'],
  ],
};

export interface SlimeOpts {
  squash: number; // + wider/shorter, - taller/narrower
  lean: number; // top shifts by this fraction (+ right, - left)
  face: Face;
  flash?: boolean;
  crown?: boolean;
  /** About to split: a notch at the top and a crease running down between the eyes. */
  crease?: boolean;
}

export function slimeFrame(rx: number, ry: number, o: SlimeOpts): HTMLCanvasElement {
  const big = rx > 16;
  const W = Math.ceil(rx * 2.5) + 4;
  // tight frames (the scene places hit effects and numbers from the frame size): room for the
  // tallest pose (windup stretch) plus the boss crown
  const H = Math.ceil(ry * 1.144) + (o.crown ? 7 : 3);
  const g = grid(W, H);
  const RX = rx * (1 + 0.2 * o.squash);
  const RY = ry * (1 - 0.24 * o.squash);
  const cx = W / 2;
  const base = H - 1; // bottom outline row stays free
  const shiftAt = (v: number) => o.lean * Math.pow(Math.max(0, v), 1.4) * rx * 0.35;
  const width = (v: number) => {
    // plump dome with a soft peak
    const ell = Math.pow(Math.max(0, 1 - Math.pow(v, 2.4)), 0.5);
    if (v < 0.7) return ell;
    const cone = ((1 - v) / 0.3) * Math.pow(1 - Math.pow(0.7, 2.4), 0.5);
    const k = (v - 0.7) / 0.3;
    return ell * (1 - k * 0.6) + cone * k * 0.6;
  };
  // the crease sits between the eyes (see the face below)
  const creaseX = cx + ((big ? 0.08 : 0.14) - 0.36) / 2 * RX;
  const notch = (x: number, v: number) => {
    if (!o.crease) return false;
    if (v > 0.9) return true; // flattened lobe tops
    const k = (v - 0.72) / 0.28;
    return k > 0 && Math.abs(x + 0.5 - creaseX - shiftAt(v)) < k * (big ? 4.5 : 3.2);
  };
  const inside = (x: number, y: number) => {
    if (y < 0 || y >= base) return false;
    const v = (base - (y + 0.5)) / RY;
    if (v < 0 || v > 1) return false;
    if (notch(x, v)) return false;
    const u = (x + 0.5 - cx - shiftAt(v)) / RX;
    return Math.abs(u) * RX <= width(v) * RX - (y === base - 1 ? 1 : 0);
  };
  const R = SLIME_RAMP;
  const off = (x: number, y: number, dx: number, dy: number) => !inside(x + dx, y + dy);
  const L = [-0.5, 0.7, 0.52];
  const ln = Math.hypot(L[0], L[1], L[2]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (o.flash) {
        put(g, x, y, '#ffffff');
        continue;
      }
      const v = (base - (y + 0.5)) / RY;
      const u = (x + 0.5 - cx - shiftAt(v)) / RX / Math.max(0.2, width(v) * 0.6 + 0.4);
      const nz = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      const lam = (u * L[0] + v * L[1] + nz * L[2]) / ln;
      // the boss is big enough for a checker dither across each terminator
      const jit = big ? (((x + y) & 1) * 2 - 1) * 0.025 : 0;
      let t = lam + jit > 0.84 ? 4 : lam + jit > 0.45 ? 3 : 2;
      // darker translucent core, low in the jelly behind the face
      if (t === 3) {
        const cu = (u - 0.12) / (big ? 0.3 : 0.26);
        const cv = (v - (big ? 0.26 : 0.22)) / (big ? 0.17 : 0.14);
        if (cu * cu + cv * cv < 1) t = 2;
      }
      // crescents that follow the silhouette
      const kk = big ? 3 : 2;
      if (t === 3 && (off(x, y, -kk, -kk) || off(x, y, 0, -kk))) t = 4;
      if (off(x, y, kk, kk) || off(x, y, kk + 1, 0)) t = Math.min(t, 2);
      if (off(x, y, 1, 1) && u > -0.2) t = 1;
      if (off(x, y, 0, 1)) t = 1;
      let col = R[t];
      // bounce light on the lower right rim
      if (off(x, y, 1, 0) && !off(x, y, 0, 1) && base - y < RY * 0.65 && u > 0.2) col = SLIME_RIM;
      put(g, x, y, col);
    }
  if (o.crease && !o.flash) {
    // the groove: its left wall faces away from the light, its right wall catches it
    for (let y = 0; y < base; y++) {
      const v = (base - (y + 0.5)) / RY;
      const xc = Math.floor(creaseX + shiftAt(v));
      if (v < 0.6 && v > 0.16) continue;
      if (!inside(xc, y) || !inside(xc, y - 1) && !inside(xc + 1, y - 1) && v < 0.6) continue;
      put(g, xc, y, R[1]);
      if (inside(xc + 1, y) && v > 0.6) put(g, xc + 1, y, R[4]);
    }
  }
  if (!o.flash) {
    const P = (u: number, v: number, dx: number, dy: number, col: string) => {
      const yy = base - v * RY;
      put(g, cx + shiftAt(v) + u * RX + dx, yy + dy, col);
    };
    // specular: a soft blob on the upper left plus a small glint
    const hu = -0.5;
    const hv = 0.7;
    const blob = big
      ? ['.ww.', 'wWWw', 'wWw.', '.w..']
      : ['ww.', 'wW.', '.w.'];
    blob.forEach((r, yy) =>
      [...r].forEach((ch, xx) => {
        if (ch !== '.') P(hu, hv, xx - 1, yy - 1, ch === 'W' ? '#ffffff' : R[5]);
      }),
    );
    P(-0.72, 0.4, 0, 0, R[4]);
    if (big) P(-0.72, 0.4, 0, 1, R[4]);
    if (o.crease) {
      // the right half is becoming its own blob: it gets its own glint
      const gx = Math.round(creaseX) + (big ? 4 : 2);
      let gy = 0;
      while (gy < base && !inside(gx, gy)) gy++;
      gy += big ? 3 : 2;
      put(g, gx, gy, R[5]);
      put(g, gx + 1, gy, R[4]);
      put(g, gx, gy + 1, R[4]);
    }
    // bubbles in the jelly: a 1px speck or a 2x2 bubble with a glint
    const bub = (u: number, v: number, r: number) => {
      P(u, v, 0, 0, r > 1 ? R[5] : R[4]);
      if (r <= 1) return;
      P(u, v, 1, 0, R[4]);
      P(u, v, 0, 1, R[4]);
      P(u, v, 1, 1, R[3]);
    };
    bub(0.5, 0.36, 2);
    if (big) {
      bub(0.28, 0.22, 1);
      bub(-0.55, 0.22, 2);
    }
    // face (looking left, toward the hero), stamped from little maps
    const F = big ? SLIME_FACE_BIG : SLIME_FACE;
    const fp: Pal = { k: SLIME_INK, W: '#ffffff', r: '#d0405a', p: '#f08aa0', d: R[0] };
    const at = (u: number, v: number, rows: string[], ax: number, ay: number) => {
      const x0 = Math.round(cx + shiftAt(v) + u * RX) - ax;
      const y0 = Math.round(base - v * RY) - ay;
      stamp(g, rows, fp, x0, y0);
    };
    const ev = 0.52;
    const eL = -0.36;
    const eR = big ? 0.08 : 0.14;
    const e = F[o.face];
    at(eL, ev, e[0], 0, e[0].length - (big ? 4 : 2));
    at(eR, ev, e[1], 0, e[1].length - (big ? 4 : 2));
    at((eL + eR) / 2, ev - (big ? 0.2 : 0.23), e[2], 1, 0);
    if (big) {
      at(eL, ev, ['pp'], 3, -4);
      at(eR, ev, ['pp'], -4, -4);
    }
  }
  if (o.crown) {
    // little gold crown on the boss, riding the top of the jelly
    const C: Pal = { G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', r: '#e8443a', b: '#4aa0f0' };
    const rows = ['g...g...g', 'gG.ggg.gy', 'gGgrgbgyy', 'ggGgggyyY', 'YyyyyyyYY'];
    let x0 = Math.round(cx + shiftAt(1) - 5);
    let y0 = Math.round(base - RY) - 3;
    if (o.crease) {
      // it slides onto the right half, riding that lobe's top
      x0 = Math.round(creaseX) + 3;
      let top = 0;
      while (top < base && !inside(x0 + 4, top)) top++;
      y0 = top - 3;
    }
    stamp(g, rows, o.flash ? whiteOut(C) : C, x0, y0);
  }
  return toCanvas(g);
}

// ------------------------------------------------------------------ boar and bandit (maps, facing left)

// fur ramp, hue-shifted: shadows lean purple, highlights lean orange
const FUR = ['#2e1622', '#5a2e26', '#8a4a2c', '#b06a36', '#d8964e'];
const BOAR_SHADES: Record<string, Shade> = {
  b: { ramp: FUR, same: 'fxhHLlcdeptT', top: [4, 3, 3], left: [3], right: [1, 1], bottom: [0, 1] },
  p: { ramp: ['#5a2430', '#a85458', '#d88078', '#f4a898', '#ffd0c0'], same: 'o', top: [3], left: [4], right: [1], bottom: [0] },
};
const BOAR_PAL: Pal = {
  L: FUR[4], l: FUR[3], c: FUR[2], d: FUR[1], // head, shaded by hand
  f: '#6e3a28', x: '#4a2226', // fur strokes, jowl line
  n: '#1e1018', N: '#3a1e26', // bristly mane
  o: '#5a2430', t: '#fff8e8', T: '#c8b490', // nostril, tusk
  e: '#140c1c', r: '#ff5a3a', // eye with an angry glint
  h: '#2a1c24', H: '#5a4650', // hooves
  w: '#ffffff', W: '#c8d8e8', // snort steam
};
// 32 wide; the legs are separate so they can trot
// The head is shaded by hand (L l c d), the body and legs automatically (b).
const BOAR_BODY = [
  '...............n..n..n..........',
  '.........l...nnNnnNnnNn.........',
  '........Ll..nNNNNNNNNNNn........',
  '.......Llx.nNNbbbbbbbbNNNn......',
  '......Lllx.Nbbbbbbbbbbbbbbn.....',
  '.....LlllcxNbbbbbbbbbbbbbbNn....',
  '....LllllcxbbbbbbbbbbbbbbbbNn...',
  '...LlllllccxbbbbbbbbbbbbbbbbbNnn',
  '..Lllcerlccxbbbbbbfbbbbbbbbbbbn.',
  '.ppllceeccccxbbbbbbfbbbbbbbbbb..',
  'pppLlcccccccxbbbbbbbbbbbbbfbbbb.',
  'poplctcccccxbbbbfbbbbbbbbbbfbbb.',
  'ppppdtccccxbbbbbbfbbbbbbbbbbbbb.',
  '.ppTtddddxbbbbbbbbbbbbbbbbbbbb..',
  '...xxdddxbbbbbbbbbbbbbbbbbbbbb..',
  '.....xxbbbbbbbbbbbbbbbbbbbbbb...',
];
const BOAR_LEGS: Record<string, string[]> = {
  stand: [
    '.....bbb.bbb.........bbb.bbb....',
    '.....bbb.bbb.........bbb.bbb....',
    '.....hHh.hHh.........hHh.hHh....',
  ],
  trot: [
    '....bbb...bbb........bbb..bbb...',
    '...bbb.....bbb......bbb....bbb..',
    '..hHh.......hHh....hHh......hHh.',
  ],
};

const BANDIT_PAL: Pal = {
  // hood and cloak (purple ramp)
  1: '#1e1430', 2: '#36244e', 3: '#523a72', 4: '#7a5a9a', 5: '#a888c8',
  // face in the hood's shadow
  f: '#2a1830', s: '#b0683e', S: '#e0a070', k: '#140c1c',
  // scarf
  R: '#7a1424', r: '#c82e34', q: '#f05a48',
  // leather strap, belt, gold
  d: '#4e2e1a', h: '#7a4a28', g: '#f2c230', y: '#b07e18',
  // trousers, boots
  t: '#262438', T: '#3c3a56', b: '#2a1810', B: '#5a3a24',
  // dagger
  m: '#8a94b4', w: '#d8e2f0', W: '#ffffff', G: '#f2c230', Y: '#b07e18',
};
// 26 wide, facing left
const BANDIT_TOP = [
  '...........4554...........',
  '.........445554433........',
  '........44555444333.......',
  '.......4455444443332......',
  '.......44fffffff33322.....',
  '......44ffssssfff333222...',
  '......4fsSkSSkSf3332222...',
  '......4fsSSSSSSf3322222...',
  '......4rqqrrrrrRR3222.rR..',
  '......4rrrrrrrrRR322..rR..',
  '.......RRRRRRRRR2222.rR...',
  '.....333RRrrR33333222.....',
];
const BANDIT_ARM: Record<string, string[]> = {
  // dagger held up in front, ready
  ready: [
    '..W.34444dd333333222......',
    '..w.344344dd333333322.....',
    '..m.334433hhgyhhh3322.....',
    '.GGY.333333dddddddd22.....',
    '..SSs3333333333333322.....',
    '......3343.3333.3332......',
  ],
  // dagger thrust forward
  stab: [
    '....34444dd333333222......',
    '...344344dd333333322......',
    '...334433hhgyhhh3322......',
    'Wwwm.sSs3333dddddddd22....',
    '...G...33333333333322.....',
    '......3343.3333.3332......',
  ],
};
const BANDIT_LEGS: Record<string, string[]> = {
  stand: [
    '........TTtt..TTttt.......',
    '........Ttt....Tttt.......',
    '.......BBbb....BBbbb......',
    '.......bbbb....bbbbb......',
  ],
  lunge: [
    '......TTtt......TTttt.....',
    '.....TTtt........Tttt.....',
    '....BBbb..........BBbbb...',
    '....bbbb..........bbbbb...',
  ],
};

export function mapFrame(rows: string[], pal: Pal, flash = false, shades: Record<string, Shade> = {}): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const g = grid(w, rows.length + 2);
  stampShaded(g, rows, pal, shades, 1, 1, flash);
  return toCanvas(g);
}

export const shiftRow = (r: string, d: number) => (d > 0 ? '.'.repeat(d) + r.slice(0, r.length - d) : r.slice(-d) + '.'.repeat(-d));

interface FoeOpts {
  dx?: number; // shift the body (not the legs) left/right
  bob?: number; // body sits lower by this many rows
  hurt?: boolean;
  angry?: boolean;
}

function boarRows(legs: string[], o: FoeOpts = {}): string[] {
  let body = BOAR_BODY.map((r) => shiftRow(r, o.dx ?? 0));
  // hurt: the eye squeezes shut
  if (o.hurt) body = body.map((r) => r.replace('Lllcerlcc', 'Lllccelcc').replace('ppllceecc', 'pplleeccc'));
  const blank = '.'.repeat(32);
  const bob = o.bob ?? 0;
  const rows = [...Array(1 + bob).fill(blank), ...body, ...legs.slice(bob)];
  if (o.angry) {
    // snort: puffs of steam at the snout
    rows[10] = 'W' + rows[10].slice(1);
    rows[11] = 'wW' + rows[11].slice(2);
  }
  return rows;
}

/** Paint the non-'.' pixels of `piece` over `rows` at (x, y). */
export function overlay(rows: string[], piece: string[], x: number, y: number): string[] {
  const out = [...rows];
  piece.forEach((pr, j) => {
    const r = out[y + j];
    if (r === undefined) return;
    const cells = [...r];
    [...pr].forEach((ch, i) => {
      if (ch !== '.' && x + i >= 0 && x + i < cells.length) cells[x + i] = ch;
    });
    out[y + j] = cells.join('');
  });
  return out;
}

const BOAR_TELL_PAL: Pal = { ...BOAR_PAL, u: '#b49a70', U: '#e8d4a8' }; // kicked-up dust
// The Charge tell: head dropped low, hackles up, steam snorting from the snout, the far legs planted.
// The near front hoof is lifted, scraping back and kicking up dust. Same 32x20 map size as the other frames.
const BOAR_TELL_ROWS = [
  '...............n..n..n..........',
  '...............nn.nn.nn.........',
  '.............nnNnnNnnNn.........',
  '...........nnNNNNNNNNNNn........',
  '.........lnNNNbbbbbbbbNNNn......',
  '........LlnNbbbbbbbbbbbbbbn.....',
  '.ww....LlxNbbbbbbbbbbbbbbbNn....',
  'wwWw..LllxNbbbbbbbbbbbbbbbbNn...',
  '.WW..LlllcxNbbbbbbbbbbbbbbbbbNnn',
  '....LllllcxNbbbbbbfbbbbbbbbbbbn.',
  'ww.Llllllccxbbbbbbbfbbbbbbbbbb..',
  'W.Lllcerlccxbbbbbbbbbbbbbbfbbbb.',
  '.ppllceeccccxbbbfbbbbbbbbbbfbbb.',
  'pppLlcccccccxbbbbfbbbbbbbbbbbbb.',
  'poplctcccccxbbbbbbbbbbbbbbbbbb..',
  'ppppdtccccxbbbbbbbbbbbbbbbbbbb..',
  '.ppTtddddxbbbbbbbbbbbbbbbbbbbb..',
  '...xxdddxbbb.lcd.....bbb.bbb....',
  '.....xx..bbb..hHhUu..bbb.bbb....',
  '.........hHh....uUUu.hHh.hHh....',
];

// the dagger raised high for a stab (windup), replacing the low dagger
const BANDIT_RAISED = ['.W..', '.w..', '.m..', 'GGY.', '.Ss.', '..43', '...4'];
// the Smoke tell: a clay smoke bomb held up, its fuse lit and spitting sparks
const BANDIT_BOMB = [
  '.z.z...',
  '..Wz...',
  '.z.u...',
  '...ue..',
  '..eeAA.',
  '.eeAAAa',
  '.eAAAaa',
  '.AAAaaa',
  '..SsSa.',
  '...Ss..',
  '....43.',
  '....43.',
  '.....4.',
];
const BANDIT_TELL_PAL: Pal = { ...BANDIT_PAL, e: '#c8c4d8', A: '#8a84a6', a: '#4e4868', u: '#e8d0a0', z: '#ffb02a' };

function banditRows(arm: string[], legs: string[], o: FoeOpts & { raise?: boolean; bomb?: boolean } = {}): string[] {
  let top = BANDIT_TOP.map((r) => shiftRow(r, o.dx ?? 0));
  if (o.hurt) top = top.map((r) => r.replace('sSkSSkS', 'skkSkkS'));
  let armRows = arm.map((r) => shiftRow(r, o.dx ?? 0));
  const cut = 5 + (o.dx ?? 0);
  if (o.raise || o.bomb) armRows = armRows.map((r) => '.'.repeat(cut) + r.slice(cut));
  const blank = '.'.repeat(26);
  const bob = o.bob ?? 0;
  let body = [...top, ...armRows];
  if (o.raise) body = overlay(body, BANDIT_RAISED, 1 + (o.dx ?? 0), 5);
  if (o.bomb) body = overlay(body, BANDIT_BOMB, o.dx ?? 0, 0);
  return [...Array(bob).fill(blank), ...body, ...legs.slice(bob)];
}

// ------------------------------------------------------------------ Pip, the companion owl (round, big-eyed)

export const PIP_W = 36;
export const PIP_H = 24;

const PIP_SHADES: Record<string, Shade> = {
  b: { ramp: ['#14204a', '#1e3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'], same: 'kwWgyYf', top: [4, 3], left: [3], right: [1, 1], bottom: [0, 1] },
  c: { ramp: ['#7a6a6a', '#c8b496', '#efe2c4', '#fff8e6', '#ffffff'], same: 'v', top: [3], left: [3], right: [1], bottom: [1] },
};
const PIP_PAL: Pal = {
  k: '#140c1c', i: '#ffd84a', I: '#e89a20', W: '#ffffff', // eyes
  f: '#8ac4f6', // facial disc
  g: '#ffe070', y: '#f2a020', Y: '#b0601a', // beak and feet
  v: '#c8b496', // belly chevrons
  B: '#1a2e70', n: '#3a78d8', N: '#6aaef0', // wing feathers
};
// 22 wide, egg-shaped with ear tufts
const PIP_BODY = [
  '...bb............bb...',
  '...bbb..........bbb...',
  '....bbbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbbbb...',
  '..bbbbbbbbbbbbbbbbbb..',
  '..bbbbbbbbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbb.',
  '..bbbbbbbbbbbbbbbbbb..',
  '...bbbbbbbbbbbbbbbb...',
  '.....bbbbbbbbbbbb.....',
];
// big yellow eyes looking right, set in a pale facial disc
const PIP_FACE = [
  '..fffff..fffff..',
  '.ffkkkf..fkkkff.',
  'ffkiiikffkiiikff',
  'fkiiWkikkiiWkikf',
  'fkiikkikkiikkikf',
  'fkIIIIIkkIIIIIkf',
  'ffkIIIkffkIIIkff',
  '.ffkkkfgyfkkkff.',
  '...ffffyYffff...',
];
const PIP_BELLY = [
  '..cccccc..',
  '.cccccccc.',
  'ccvcvcvcvc',
  'cccvcccvcc',
  'ccccvcvccc',
  '.ccccvccc.',
  '..cccccc..',
];
const PIP_FEET = ['yYy..yYy', 'y.y..y.y'];
const PIP_WING: Record<'down' | 'up' | 'back', { rows: string[]; x: number; y: number }> = {
  down: { rows: ['.BB', 'BNB', 'BnB', 'BNB', 'BnB', 'BnB', '.BB'], x: 0, y: 7 },
  up: { rows: ['B.....', 'BB....', 'BNB...', 'BNnB..', '.BNnB.', '.BnnBB', '..BnnB', '...BBB'], x: -5, y: 0 },
  back: { rows: ['BBBB...', 'BNNnBB.', '.BBnnnB', '...BBBB'], x: -6, y: 8 },
};

export const flipRows = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

/** wing: 'down' (folded), 'up' (flap), 'back' (swept for a dive). */
function owlFrame(wing: 'down' | 'up' | 'back', flash = false): HTMLCanvasElement {
  const g = grid(PIP_W, PIP_H);
  const ox = 7; // room for the spread wings; the body stays centered in the frame
  const oy = 3;
  const pal = flash ? whiteOut(PIP_PAL) : PIP_PAL;
  const W = PIP_WING[wing];
  const bodyW = PIP_BODY[0].length;
  const wings = () => {
    stamp(g, W.rows, pal, ox + W.x, oy + W.y);
    if (wing !== 'back') stamp(g, flipRows(W.rows), pal, ox + bodyW - W.rows[0].length - W.x, oy + W.y);
  };
  if (wing !== 'down') wings();
  stampShaded(g, PIP_BODY, pal, PIP_SHADES, ox, oy, flash);
  if (wing === 'down') wings();
  if (!flash) {
    stampShaded(g, PIP_BELLY, pal, PIP_SHADES, ox + 6, oy + 9);
    stamp(g, PIP_FACE, pal, ox + 3, oy + 2);
  }
  stamp(g, PIP_FEET, pal, ox + 7, oy + PIP_BODY.length);
  if (wing === 'back') stamp(g, ['BB', 'BnB', '.BB'], pal, ox + bodyW - 3, oy + 8);
  return toCanvas(g);
}

// ------------------------------------------------------------------ treasure chest (level clear, drawn at 2x)

const CHEST_PAL: Pal = {
  // wood (warm, shadows lean red-purple)
  W: '#e0a462', w: '#b87a42', o: '#8e522c', O: '#6a3822', d: '#4a2420', D: '#2e1620',
  // gold bands, lock plate, coins
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', z: '#5a3410',
  k: '#140c1c', S: '#ffffff',
};
// 18 wide: a domed lid with two gold bands and a gold lock plate
const CHEST_RIM = '.gGggggggggggggyY.';
const CHEST_BASE = [
  '.wwgywwGggYwwgywO.',
  '.oogyoogkgYoogyoO.',
  '.oogyooykyYoogyOO.',
  '.OOgyOOOYYOOOgyOd.',
  '.ddgyddddddddgydd.',
  '.DDzzDDDDDDDDzzDD.',
];
const CHEST_CLOSED = [
  '...gyWWWWWWWWgy...',
  '..wgyWwwwwwwwgyo..',
  '.wwgywwwwwwwwgyoO.',
  '.oogyoooooooogyOO.',
  '.OOgyOOOOOOOOgyOd.',
  CHEST_RIM,
  ...CHEST_BASE,
];
const CHEST_OPEN = [
  '..DDDDDDDDDDDDDD..',
  '.DddzYddddddzYddD.',
  '.DOOzYOOOOOOzYOOD.',
  '.....S....S.......',
  '....yGgy.yGgy.....',
  '..ygGgGgyGgGgGy...',
  '.yGgGgyGgGgygGgGy.',
  CHEST_RIM,
  ...CHEST_BASE,
];

// ------------------------------------------------------------------ icons

/** Single-color 7x7 icons stamped on red blocks ('#' = filled). */
export const ICONS: Record<string, string[]> = {
  drop: ['...#...', '..###..', '.#####.', '.#.###.', '#######', '#######', '.#####.'],
  tusk: ['......#', '.....##', '.....##', '....###', '#..####', '######.', '.####..'],
  mask: ['.......', '.#####.', '#######', '#..#..#', '#######', '.##.##.', '.......'],
  shield: ['#######', '###.###', '##...##', '###.###', '.#####.', '..###..', '...#...'],
  bomb: ['.....#.', '....#..', '..###..', '.#####.', '##.####', '#######', '.#####.'],
  speed: ['#..#...', '##.##..', '.##.##.', '..##.##', '.##.##.', '##.##..', '#..#...'],
};

/** Add a 1px ink outline ('k') around the filled pixels of an icon. */
function outlined(rows: string[]): string[] {
  const h = rows.length + 2;
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => {
    const c = rows[y - 1]?.[x - 1];
    return c !== undefined && c !== '.' ? c : null;
  };
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const c = at(x, y);
      r += c ?? (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'k' : '.');
    }
    out.push(r);
  }
  return out;
}

const INK_N = 0x140c1c;

/** Multi-color HUD icons at native resolution, drawn at scale 1 (rows include the 'k' outline). */
export const HUD_ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  // 15x13
  heart: {
    rows: outlined([
      '.lWWl...lrrr.',
      'lWWWll.lrrrrd',
      'lWWllrrrrrrrd',
      'lWlllrrrrrrrd',
      'llllrrrrrrrdd',
      'lllrrrrrrrrdd',
      '.lrrrrrrrrdd.',
      '..rrrrrrrdd..',
      '...rrrrrdd...',
      '....rrrdD....',
      '.....rdD.....',
      '......D......',
    ]),
    pal: { k: INK_N, W: 0xffe4dc, l: 0xff7a62, r: 0xe2333c, d: 0xa01830, D: 0x6a0f28 },
  },
  // 9x9
  coin: {
    rows: outlined([
      '..GGg..',
      '.GGggy.',
      'GGgYgyy',
      'GggYgyY',
      'gggYgyY',
      '.ggyyY.',
      '..yYY..',
    ]),
    pal: { k: INK_N, G: 0xfff4b0, g: 0xf2c230, y: 0xd8901c, Y: 0x9a5a14 },
  },
  // 13x7
  crown: {
    rows: outlined([
      'G....G....g',
      'GG..GGg..gy',
      'GgGgGrgyggy',
      'gGgrgggbgyy',
      'yyyyyyyyyyY',
    ]),
    pal: { k: INK_N, G: 0xfff0a0, g: 0xf2c230, y: 0xd8901c, Y: 0x9a5a14, r: 0xe8443a, b: 0x4aa0f0 },
  },
  // 13x14
  skull: {
    rows: outlined([
      '..WWwwwww..',
      '.WWwwwwwws.',
      'WWwwwwwwwss',
      'Wwwwwwwwwss',
      'wwKKKwKKKss',
      'wwKKKwKKKss',
      'wwKKwwwKKss',
      'swwwwKwwsss',
      '.sswwwwsss.',
      '..wKwKwKs..',
      '..wKwKwKs..',
      '..sssssss..',
    ]),
    pal: { k: INK_N, W: 0xffffff, w: 0xf2ecd8, s: 0xc8b898, K: 0x3a2a3e },
  },
  // 12x12, tip up-right
  sword: {
    rows: outlined([
      '........SW',
      '.......SLs',
      '......SLm.',
      '.....SLm..',
      '.g..SLm...',
      '..gSLm....',
      '..ygm.....',
      '.d.yy.....',
      'd....y....',
      'p.........',
    ]),
    pal: { k: INK_N, W: 0xffffff, S: 0xeef3fa, L: 0xb8c2d8, s: 0x9aa4c0, m: 0x6a7496, g: 0xf2c230, y: 0xb07e18, d: 0x6e4426, p: 0xd8901c },
  },
  // 7x12
  crit: {
    rows: outlined(['lGGg', 'lGgd', 'lggd', '.lgd', '.lgd', '.gd.', '....', '.lg.', '.gd.']),
    pal: { k: INK_N, G: 0xd8ff9a, l: 0x9af06a, g: 0x5ad04a, d: 0x2a8a3a },
  },
  // 9x12
  bolt: {
    rows: outlined([
      '...WLl.',
      '..WLl..',
      '.WLl...',
      'WLLLLl.',
      '..WLlb.',
      '..Llb..',
      '.Llb...',
      '.lb....',
      'lb.....',
      'b......',
    ]),
    pal: { k: INK_N, W: 0xe0f6ff, L: 0x9ad8ff, l: 0x4aa0f0, b: 0x2a6ad8 },
  },
  // 9x12
  potion: {
    rows: outlined([
      '..hHh..',
      '..aAa..',
      '...a...',
      '.aaWaa.',
      'aWpPppa',
      'aWpppPa',
      'appppPa',
      'apppPPa',
      '.aPPPa.',
      '..aaa..',
    ]),
    pal: { k: INK_N, h: 0x98663a, H: 0x6e4426, a: 0x8a6ab0, A: 0xc8b0e8, W: 0xffffff, p: 0xff7ac8, P: 0xd03a98 },
  },
  // 9x12: one of Pip's blue feathers (Companion Power)
  feather: {
    rows: outlined([
      '....WNn',
      '...WNnB',
      '..WNnnB',
      '.WNnnB.',
      '.NnnB..',
      'WnnB...',
      'NnB....',
      'qB.....',
      'q......',
      'q......',
    ]),
    pal: { k: INK_N, W: 0xe0f2ff, N: 0x6aaef0, n: 0x3a78d8, B: 0x1a2e70, q: 0xf2ecd8 },
  },
  // gem, shard, star_on, star_off, badge_region (art-currency.ts)
  ...CURRENCY_ICONS,
};

/** Drifting cumulus band (w x 26), seamless when tiled horizontally. No outline: it is backdrop. */
function drawClouds(w: number): HTMLCanvasElement {
  const H = 26;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = H;
  const ctx = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  type Puff = { x: number; y: number; r: number };
  const clouds: Array<{ base: number; puffs: Puff[] }> = [];
  const n = Math.max(3, Math.round(w / 80));
  for (let i = 0; i < n; i++) {
    const cx = ((i + 0.25 + rnd() * 0.5) * w) / n;
    const base = 19 + Math.floor(rnd() * 6);
    const len = 22 + Math.floor(rnd() * 20);
    const puffs: Puff[] = [];
    // back row: a few big domes; front row: small puffs along the flat base (drawn last, in front)
    const kb = 2 + Math.floor(rnd() * 2);
    for (let j = 0; j < kb; j++) {
      const t = kb === 1 ? 0.5 : j / (kb - 1);
      const r = 6 + Math.round(rnd() * 3 + (1 - Math.abs(t - 0.5) * 2) * 2);
      puffs.push({ x: cx - len * 0.3 + t * len * 0.6, y: base - r * 0.7, r });
    }
    const kf = 3 + Math.floor(len / 14);
    for (let j = 0; j < kf; j++) {
      const t = j / (kf - 1);
      const r = 3 + Math.round(rnd() * 2 + (1 - Math.abs(t - 0.5) * 2) * 1.5);
      puffs.push({ x: cx - len / 2 + t * len, y: base - r * 0.45, r });
    }
    clouds.push({ base, puffs });
  }
  const wrapDx = (dx: number) => ((((dx + w / 2) % w) + w) % w) - w / 2;
  const inPuff = (p: Puff, x: number, y: number) => {
    const dx = wrapDx(x + 0.5 - p.x);
    const dy = y + 0.5 - p.y;
    return dx * dx + dy * dy <= p.r * p.r;
  };
  /** The frontmost puff covering a pixel, as [cloud, puff]. */
  const owner = (x: number, y: number): [number, number] | null => {
    for (let ci = 0; ci < clouds.length; ci++) {
      const cl = clouds[ci];
      if (y >= cl.base) continue;
      for (let pi = cl.puffs.length - 1; pi >= 0; pi--) if (inPuff(cl.puffs[pi], x, y)) return [ci, pi];
    }
    return null;
  };
  const wx = (x: number) => ((x % w) + w) % w;
  const inCloud = (x: number, y: number) => y >= 0 && y < H && owner(wx(x), y) !== null;
  const T = { hi: '#ffffff', body: '#eef7fc', mid: '#dcecf7', shade: '#c2daee', deep: '#a6c4e0' };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < w; x++) {
      const o = owner(x, y);
      if (!o) continue;
      const cl = clouds[o[0]];
      const p = cl.puffs[o[1]];
      const dx = wrapDx(x + 0.5 - p.x) / p.r;
      const dy = (y + 0.5 - p.y) / p.r;
      // each puff: lit cap on the upper left, shaded on the lower right
      let col = dx + dy * 1.3 < -0.35 ? T.hi : dx + dy * 1.3 > 0.55 ? T.mid : T.body;
      if (!inCloud(x, y - 1)) col = T.hi;
      // fold line where this puff's rim sits in front of another puff
      else if (!inPuff(p, x, y - 1) && owner(x, y - 1)?.[1] !== o[1]) col = T.mid;
      if (y >= cl.base - 2) {
        // flat, shaded underside with rounded ends
        if (y === cl.base - 1 && (!inCloud(x - 2, y) || !inCloud(x + 2, y))) continue;
        col = y === cl.base - 1 ? T.deep : T.shade;
      }
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

// ------------------------------------------------------------------ build

export function buildArt(scene: Phaser.Scene, w: number): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const slimes: Array<[string, number, number, boolean]> = [
    ['slime', 12, 15, false],
    ['bigslime', 23, 28, true],
  ];
  for (const [key, rx, ry, crown] of slimes) {
    add(`${key}_idle0`, slimeFrame(rx, ry, { squash: 0, lean: 0, face: 'idle', crown }));
    add(`${key}_idle1`, slimeFrame(rx, ry, { squash: 0.4, lean: 0, face: 'idle', crown }));
    add(`${key}_windup`, slimeFrame(rx, ry, { squash: -0.55, lean: 0.35, face: 'angry', crown }));
    add(`${key}_attack`, slimeFrame(rx, ry, { squash: 0.25, lean: -1, face: 'attack', crown }));
    add(`${key}_hurt`, slimeFrame(rx, ry, { squash: 0.8, lean: 0.4, face: 'hurt', crown }));
    add(`${key}_flash`, slimeFrame(rx, ry, { squash: 0.8, lean: 0.4, face: 'hurt', crown, flash: true }));
    add(`${key}_tell`, slimeFrame(rx, ry, { squash: 1, lean: 0, face: 'angry', crown, crease: true }));
  }
  const BL = BOAR_LEGS;
  const boar = (rows: string[], flash = false) => mapFrame(rows, BOAR_TELL_PAL, flash, BOAR_SHADES);
  add('boar_idle0', boar(boarRows(BL.stand)));
  add('boar_idle1', boar(boarRows(BL.stand, { bob: 1 })));
  add('boar_windup', boar(boarRows(BL.trot, { dx: 1, bob: 1, angry: true })));
  add('boar_attack', boar(boarRows(BL.trot, { dx: -1 })));
  add('boar_hurt', boar(boarRows(BL.stand, { dx: 1, hurt: true })));
  add('boar_flash', boar(boarRows(BL.stand, { dx: 1, hurt: true }), true));
  add('boar_tell', boar(BOAR_TELL_ROWS));
  const BA = BANDIT_ARM;
  const BG = BANDIT_LEGS;
  add('bandit_idle0', mapFrame(banditRows(BA.ready, BG.stand), BANDIT_PAL));
  add('bandit_idle1', mapFrame(banditRows(BA.ready, BG.stand, { bob: 1 }), BANDIT_PAL));
  add('bandit_windup', mapFrame(banditRows(BA.ready, BG.stand, { dx: 1, bob: 1, raise: true }), BANDIT_PAL));
  add('bandit_attack', mapFrame(banditRows(BA.stab, BG.lunge, { dx: -1 }), BANDIT_PAL));
  add('bandit_hurt', mapFrame(banditRows(BA.ready, BG.stand, { dx: 1, hurt: true }), BANDIT_PAL));
  add('bandit_flash', mapFrame(banditRows(BA.ready, BG.stand, { dx: 1, hurt: true }), BANDIT_PAL, true));
  add('bandit_tell', mapFrame(banditRows(BA.ready, BG.stand, { dx: 1, bomb: true }), BANDIT_TELL_PAL));
  add('pip_idle0', owlFrame('down'));
  add('pip_idle1', owlFrame('up'));
  add('pip_dive', owlFrame('back'));
  add('chest_closed', mapFrame(CHEST_CLOSED, CHEST_PAL));
  add('chest_open', mapFrame(CHEST_OPEN, CHEST_PAL));
  add('clouds', drawClouds(w));
  buildFoeArt(add);
  // the later regions' foes come in their own chunks (region-art.ts): a relayout adds again those already drawn
  for (const p of regionPacks()) p.addArt(add, false);
  buildStoryArt(add);
  buildGearArt(add);
  buildSableArt(add);
  buildHeroArt(add);
  buildRelicArt(add);
  buildAshRelicArt(add);
  buildCampArt(add, w, 150);
  buildCompanionArt(add, owlFrame('down'));
  buildChestArt(add);
  buildRarityArt(add);
  buildShrineArt(add);
  buildDummyArt(add);
}
