// Region 3 foes (see docs/art-style.md and docs/content-bible.md section 6), drawn with art-frost.ts's helpers:
// character maps and shaded masks with an automatic ink outline, facing left. Every sprite has the frames the fighters
// view uses (idle0, idle1, windup, attack, hurt, flash, tell); the road-roller curls into a ball when his shell is up
// (`shell`), the two-headed hound bristles while the heads squabble (`guard`), and the boss has a look per phase
// (`bellows2_*`, `bellows3_*`, the same size as `bellows_*`). Ashfell is black and grey with glowing cracks, so every
// foe carries something hot (ember eyes, a molten seam, a furnace) or bright (brass, coloured glass) to read against
// the ash.
//
// Textures (keyed by the enemy's `sprite`, as data/enemies-ash.ts names them): `${sprite}_${pose}`, the three
// speakers' portraits (`portrait_rumbleback`, `portrait_hobnob`, `portrait_bellows`) and two bar pieces (`ember_mark`,
// `glass_pane`). Painted in idle slices after boot (paintAshFoeSlice, like the world map) and added once done; a fight
// or scene that needs them sooner draws the rest at once (buildAshFoeArt(add, true)).
import { grid, put, type Pal } from './art';
import {
  anyOf,
  bezier,
  capsule,
  digits,
  dots,
  ell,
  fitFrames,
  hash2,
  limb,
  line,
  paint,
  poly,
  render,
  shag,
  sweep,
  vol,
  type Add,
  type Mask,
  type Part,
  type PartOpts,
  type SpriteDef,
} from './art-frost';

/** Sprite names this file draws (each gets `${name}_${pose}` textures): data/enemies-ash.ts's `sprite` fields. */
export const ASH_SPRITES = [
  'cinderling',
  'cinderkite',
  'cragcrab',
  'obsidianox',
  'rumbleback',
  'glassblower',
  'prismbat',
  'glassmantis',
  'kilnwarden',
  'hobnob',
  'stokerimp',
  'magmaeel',
  'forgehand',
  'chainsentinel',
  'bellows',
] as const;
export const ASH_POSES = ['idle0', 'idle1', 'windup', 'attack', 'hurt', 'flash', 'tell'] as const;
/** The boss's phase looks: full frame sets the same size as `bellows_*` (phase 2 the chain, phase 3 the eruption).
 *  The road-roller has one too (`rumbleback2_*`: past half HP his plates crack and glow, his hat sits askew). */
export const BELLOWS_PHASES = ['bellows2', 'bellows3'] as const;

/** Each sprite's main body colour (death-burst and hit chips), like FROST_COL. */
export const ASH_COL: Record<string, number> = {
  cinderling: 0xe0501c,
  cinderkite: 0x3e3446,
  cragcrab: 0x5e5c66,
  obsidianox: 0x2e2a48,
  rumbleback: 0x6a6670,
  rumbleback2: 0x6a6670,
  glassblower: 0x6aa84a,
  prismbat: 0xd04a3a,
  glassmantis: 0x4aa868,
  kilnwarden: 0xa04a2e,
  hobnob: 0x2c2228,
  stokerimp: 0xc4302a,
  magmaeel: 0xff8a24,
  forgehand: 0x7a4a2e,
  chainsentinel: 0x8a8ea6,
  bellows: 0x44444f,
  bellows2: 0x44444f,
  bellows3: 0xe0501c,
};

// ------------------------------------------------------------------ shared ramps (dark to light, hue-shifted)

const INK = '#140c1c';
// coal and crust: violet-black in shadow, warm brown-grey where the light catches it
const COAL = ['#0e0a14', '#1c1620', '#2c2228', '#40302e', '#5a4236', '#7a5a42'];
// the glow under the crust: deep red, orange, gold, a white-hot core
const EMBER = ['#5a0e0e', '#a0221a', '#e0501c', '#ff8a24', '#ffc84a', '#fff4b8'];
const BRASS = ['#4a2a0c', '#8a5a14', '#c8901c', '#f2c230', '#fff0a0'];
const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const LEATHER = ['#2a1810', '#4a2c18', '#6e4426', '#98663a', '#c0905a', '#e0bc84'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
/** Glow letters every palette here shares: cracks, eyes, flames, sparks, smoke. */
const HOT: Pal = {
  k: INK,
  Z: EMBER[5], // white-hot
  X: EMBER[4], // gold
  x: EMBER[3], // orange
  q: EMBER[2], // red-orange
  Q: EMBER[1], // deep red
  W: '#ffffff',
  s: '#d8d0dc', // smoke and steam
  S: '#a49aac',
  u: '#6e6476',
};

// ------------------------------------------------------------------ helpers

/**
 * Glowing cracks through a shaded part (cooling lava, a furnace showing through): Voronoi seams on a jittered grid of
 * `cell` px, the seam itself gold ('X'), red-orange beside it on the shaded side ('q'). Only tone digits >= `min` crack.
 */
function crackle(p: Part, cell: number, seed: number, min = 1, amt = 1, keep?: Mask): Part {
  const [rows, ox, oy] = p;
  const feat = (cx: number, cy: number): [number, number] => [(cx + 0.2 + hash2(cx * 7 + seed, cy * 13) * 0.6) * cell, (cy + 0.2 + hash2(cx * 11, cy * 5 + seed) * 0.6) * cell];
  /** The gap between the nearest two features, and which edge (the pair of cells) the pixel is next to. */
  const seam = (gx: number, gy: number): [number, number] => {
    const cx = Math.floor(gx / cell);
    const cy = Math.floor(gy / cell);
    let d1 = 1e9;
    let d2 = 1e9;
    let k1 = 0;
    let k2 = 0;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const [fx, fy] = feat(cx + i, cy + j);
        const d = Math.hypot(gx + 0.5 - fx, gy + 0.5 - fy);
        const k = (cx + i) * 131 + (cy + j) * 977;
        if (d < d1) {
          d2 = d1;
          k2 = k1;
          d1 = d;
          k1 = k;
        } else if (d < d2) {
          d2 = d;
          k2 = k;
        }
      }
    return [d2 - d1, Math.min(k1, k2) * 7 + Math.max(k1, k2)];
  };
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c) || +c < min) return c;
        const gx = x + ox;
        const gy = y + oy;
        if (keep?.(gx, gy)) return c;
        const [s, edge] = seam(gx, gy);
        // only some plate edges glow: the cracks break off and branch instead of caging the whole form
        if (hash2(edge, seed) > amt) return c;
        if (s < 0.75) return 'X';
        if (s < 1.4 && +c <= 2) return 'q';
        return c;
      })
      .join(''),
  );
  return [out, ox, oy, { ...p[3], pal: { ...HOT, ...(p[3]?.pal ?? {}) } }];
}

/**
 * A tongue of flame rising from (cx, base), `h` tall and `w` wide, flickering by `f` (0-3): red at the rim, orange,
 * gold, a white-hot heart. Drawn late (no ink outline).
 */
function flame(cx: number, base: number, h: number, w: number, f: number, lean = 0): Part {
  const pts: Record<string, [number, number][]> = { Q: [], q: [], x: [], X: [], Z: [] };
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1); // 0 at the base, 1 at the tip
    const sway = Math.sin(t * 3.2 + f * 1.7) * t * 1.4 + lean * t * t * h * 0.3;
    const half = (w / 2) * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI * 0.5) * (t < 0.15 ? 0.8 + t : 1);
    const cx2 = cx + sway;
    for (let x = Math.floor(cx2 - half - 0.5); x <= cx2 + half + 0.5; x++) {
      const u = Math.abs(x + 0.5 - cx2) / Math.max(0.6, half);
      if (u > 1.05) continue;
      const k = (1 - u) * (1 - t * 0.7);
      const ch = k > 0.62 && t < 0.55 ? 'Z' : k > 0.42 ? 'X' : k > 0.22 ? 'x' : t > 0.75 || u > 0.85 ? 'Q' : 'q';
      pts[ch].push([x, base - y]);
    }
  }
  // a licking tip that breaks off as the flame flickers
  if (f % 2) pts.q.push([Math.round(cx + lean * h * 0.3 + (f > 1 ? 1 : -1)), base - h - 1]);
  return dots(
    Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][],
    { pal: HOT, late: true },
  );
}

/** A puff of smoke or steam (r 1-3), lit on its upper left. Drawn late. */
function puff(x: number, y: number, r: number, dark = false): Part {
  const pts: Record<string, [number, number][]> = { s: [], S: [], u: [] };
  for (let yy = -r; yy <= r; yy++)
    for (let xx = -r - 1; xx <= r + 1; xx++) {
      const d = ((xx + 0.5) / (r + 1)) ** 2 + ((yy + 0.5) / (r + 0.4)) ** 2;
      if (d > 1) continue;
      const lit = xx + yy < -r * 0.4;
      pts[dark ? (lit ? 'S' : 'u') : lit ? 's' : d > 0.55 ? 'S' : 's'].push([x + xx, y + yy]);
    }
  return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: HOT, late: true });
}

/** A few sparks (late single pixels in gold and orange). */
const sparks = (pts: [number, number][]): Part =>
  dots(
    [
      ['X', pts.filter((_, i) => i % 2 === 0)],
      ['x', pts.filter((_, i) => i % 2 === 1)],
    ].filter(([, p]) => (p as [number, number][]).length) as [string, [number, number][]][],
    { pal: HOT, late: true },
  );

/** Ember eyes: a 2x2 gold eye with a white-hot pupil (or a shut slit when hurt). */
const emberEye = (x: number, y: number, shut = false): Part => (shut ? [['qq'], x, y + 1, { pal: HOT }] : [['XZ', 'xX'], x, y, { pal: HOT }]);

/** Glassy facets: hard light planes and a few bright specular streaks on a dark ramp (obsidian, bottle glass). */
function glassy(p: Part, seed: number, streak = 'W'): Part {
  const [rows, ox, oy] = p;
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        // planar facets: the tone snaps to bands along two diagonal directions
        const f1 = Math.floor((gx + gy * 0.6 + seed) / 5);
        const f2 = Math.floor((gx * 0.5 - gy + seed * 2) / 6);
        let t = +c + (hash2(f1 + seed, f2) > 0.62 ? 1 : hash2(f2 + seed, f1) > 0.78 ? -1 : 0);
        t = Math.max(1, Math.min(5, t));
        // a specular streak running down-left across the lit facets
        if (+c >= 4 && (gx + gy) % 9 === seed % 9 && hash2(f1, f2 + seed) > 0.3) return streak;
        return String(t);
      })
      .join(''),
  );
  return [out, ox, oy, p[3]];
}

/** Hexagonal basalt columns standing side by side: [x, top, width][] from a common base; lit faces left, hex caps. */
function columns(cols: [number, number, number][], base: number, ramp: string[], o: PartOpts = {}): Part[] {
  const out: Part[] = [];
  // back to front: the tallest at the back
  for (const [x, top, w] of cols.slice().sort((a, b) => a[1] - b[1])) {
    const pts: Record<string, [number, number][]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (let y = top; y <= base; y++)
      for (let xx = 0; xx < w; xx++) {
        const cap = y < top + 2;
        let t: number;
        if (cap) t = y === top ? (xx === 0 || xx === w - 1 ? 3 : 5) : xx < w - 1 ? 4 : 3;
        else t = xx < Math.ceil(w * 0.4) ? 3 : xx < w - 1 ? 2 : 1;
        if (!cap && (y - top) % 5 === 4 && xx > 0) t = Math.max(1, t - 1); // cooling joints across the column
        pts[t].push([x + xx, y]);
      }
    out.push(dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: digits(ramp), edge: ramp[0], ...o }));
  }
  return out;
}

// ------------------------------------------------------------------ cinderling (a walking lump of glowing coal)

const CINDER_PAL: Pal = { ...HOT, f: COAL[1], F: COAL[3] };

function cinderParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let squash = 0;
  let feet: [number, number, number, number] = [8, 21, 15, 21]; // near foot x, y; far foot x, y
  let fl = 0; // flame frame
  let flH = 7;
  let eyes = true;
  let mouth: string[] = ['x.x.x', '.xXx.'];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      squash = 1;
      fl = 1;
      flH = 6;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      squash = 1;
      fl = 2;
      flH = 9;
      mouth = ['xxxxx', '.qqq.'];
      break;
    case 'attack':
      // a hop forward and a spat gob of fire
      bx = -3;
      by = -1;
      feet = [5, 21, 13, 20];
      fl = 3;
      mouth = ['ZXXXZ', 'XxqxX'];
      extra.push(flame(-1, 16, 5, 4, 1, -0.6), sparks([[-3, 12], [-4, 15], [0, 11]]));
      break;
    case 'hurt':
      bx = 2;
      eyes = false;
      fl = 2;
      flH = 4;
      mouth = ['.qqq.', 'q...q'];
      extra.push(sparks([[22, 6], [3, 4], [20, 10], [6, 3]]));
      break;
    case 'tell':
      // Hot Foot!: hopping from foot to foot on the hot ground, flames licking up round its feet
      by = -3;
      feet = [8, 19, 15, 18];
      fl = 1;
      flH = 10;
      mouth = ['ZXXXZ', '.XxX.'];
      extra.push(flame(7, 22, 4, 3, 0), flame(16, 22, 5, 3, 2), flame(11, 23, 3, 3, 3));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const body = anyOf(ell(X(12), Y(13) + squash * 0.5, 8.5, 6.5 - squash * 0.5), ell(X(9), Y(10) + squash, 5, 4.5), ell(X(15), Y(10) + squash, 5.5, 4.5));
  const lump = crackle(vol(body, [X(2), Y(3), X(22), Y(21)], [X(9), Y(8), 11, 9], COAL, { edge: COAL[0] }), 5, 3, 2, 0.55, ell(X(9), Y(12) + squash, 6, 5));
  return [
    flame(X(12), Y(6) + squash, flH, 6, fl, 0.3),
    [['FF', 'ff'], feet[2], feet[3] - 1],
    lump,
    [['FF', 'ff', 'ff'], feet[0], feet[1] - 2],
    // big ember eyes, pupils toward the hero
    ...(eyes
      ? [[['ZX', 'kX', 'xq'], X(5), Y(8) + squash, { pal: HOT }] as Part, [['ZX', 'kX', 'xq'], X(10), Y(8) + squash, { pal: HOT }] as Part]
      : [emberEye(X(5), Y(9) + squash, true), emberEye(X(10), Y(9) + squash, true)]),
    [mouth, X(5), Y(13) + squash, { pal: HOT }],
    ...extra,
  ];
}

// ------------------------------------------------------------------ cinder kite (a ragged kite of soot-black feathers)

const SOOT = ['#0c0a12', '#1e1826', '#2e2636', '#443a4e', '#625468', '#86748a'];
const KITE_PAL: Pal = { ...HOT, b: '#2a1a14', B: '#5a3a26' };

/** The kite's tail streamer: a wavy smoking ribbon from (x, y) trailing right, little bows of smoke along it. */
function streamer(x: number, y: number, len: number, ph: number): Part[] {
  const path = (t: number): [number, number] => [x + t * len, y + Math.sin(t * 5 + ph) * 2.2 + t * 3];
  const rib = sweep(path, (t) => 1.3 - t * 0.5, (t, side) => (t > 0.88 ? 'x' : t > 0.78 ? 'q' : side < 0 ? '4' : '2'), 60, { pal: { ...digits(SOOT), ...HOT } });
  const [ex, ey] = path(1);
  const [mx, my] = path(0.5);
  return [rib, puff(Math.round(mx), Math.round(my - 2), 1, true), puff(Math.round(ex + 2), Math.round(ey - 1), 1, true), puff(Math.round(ex + 5), Math.round(ey - 3), 1, true)];
}

/**
 * One wing of the kite: a triangle from the body (root a..b) out to a tip, soot feathers lit by the shape, feather
 * shafts radiating from the root's middle, a ragged trailing edge whose feather ends glow like a coal's rim.
 */
function kiteWing(a: [number, number], tip: [number, number], b: [number, number], far: boolean, seed: number): Part {
  const m = poly([a, tip, b]);
  const xs = [a[0], tip[0], b[0]];
  const ys = [a[1], tip[1], b[1]];
  const box: [number, number, number, number] = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1];
  const ramp = far ? SOOT.map((_, i) => SOOT[Math.max(0, i - 1)]) : SOOT;
  const p = vol(m, box, [box[0] + (box[2] - box[0]) * 0.3, box[1] + 2, (box[2] - box[0]) * 0.7, (box[3] - box[1]) * 0.9], ramp, { edge: ramp[0] });
  const root: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const up = tip[1] < root[1];
  const rows = p[0].map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c === '.') return c;
        const gx = x + box[0];
        const gy = y + box[1];
        // the outer edges: the leading edge (toward the head) stays whole, the trailing edge is ragged and glows
        const out = !m(gx, gy + (up ? -1 : 1)) || !m(gx - 1, gy) || !m(gx + 1, gy);
        const trailing = gx > tip[0] - 1;
        if (out && trailing) {
          if ((gx + gy + seed) % 3 === 0) return '.';
          return far ? 'q' : (gx + gy) % 3 === 1 ? 'x' : 'X';
        }
        if (out && !far) return '5';
        // feather shafts fanning out from the root
        const ang = Math.atan2(gy + 0.5 - root[1], gx + 0.5 - root[0]);
        if (Math.abs(Math.sin(ang * 7 + seed)) < 0.16 && Math.hypot(gx - root[0], gy - root[1]) > 3) return String(Math.max(1, +c - 2));
        return c;
      })
      .join(''),
  );
  return [rows, box[0], box[1], { pal: { ...digits(ramp), ...HOT }, edge: ramp[0] }];
}

function kiteParts(pose: string): Part[] {
  let up = 0; // the wingtips' spread: + wider (raised), - narrower (beating down)
  let bx = 0;
  let by = 0;
  let ph = 0;
  let beak = ['44.', '.32'];
  let eyeShut = false;
  let sweepBack = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      up = -4;
      by = 1;
      ph = 1.6;
      sweepBack = 2;
      break;
    case 'windup':
      up = 2;
      bx = 2;
      by = -1;
      ph = 3;
      sweepBack = -1;
      break;
    case 'attack':
      // a dive, wings swept back
      up = -3;
      bx = -4;
      by = 3;
      ph = 4.5;
      sweepBack = 5;
      beak = ['444', '.32'];
      break;
    case 'hurt':
      up = -5;
      bx = 2;
      ph = 2.2;
      sweepBack = 3;
      eyeShut = true;
      extra.push(dots([['S', [[26, 3], [9, 3], [22, 23]]]], { pal: HOT, late: true }));
      break;
    case 'tell':
      // Ember Drop!: wings flung wide and shaken, embers falling off the glowing edges
      up = 3;
      by = -1;
      ph = 0.8;
      extra.push(sparks([[14, 25], [18, 27], [22, 25], [16, 29], [21, 30], [25, 27]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const C = Y(13); // the body's line
  const body = anyOf(ell(X(15), C + 0.5, 9, 2.6), ell(X(6), C, 3.6, 3.2));
  return [
    ...streamer(X(24), C + 1, 12, ph),
    kiteWing([X(10), C + 1], [X(17) + sweepBack, C + 11 + up], [X(24), C + 1], true, 3),
    crackle(vol(body, [X(1), C - 4, X(25), C + 4], [X(9), C - 2, 10, 4], SOOT, { edge: SOOT[0] }), 5, 9, 3, 0.4),
    kiteWing([X(9), C - 1], [X(17) + sweepBack, C - 12 - up], [X(25), C - 1], false, 5),
    // a hooked bone beak and an ember eye
    [beak, X(0), C - 1, { pal: digits(BONE) }],
    emberEye(X(4), C - 2, eyeShut),
    // talons tucked under
    [['bB.bB', '.b..b'], X(12), C + 3, { pal: KITE_PAL }],
    ...extra,
  ];
}

// ------------------------------------------------------------------ crag crab (a squat crab under basalt columns)

const SHELL = ['#2a0c10', '#5a1a16', '#8e2e1c', '#c04a26', '#e07a3a', '#f8b070'];
// the columns: a lighter basalt so the hexagonal caps read against the backdrop's ash
const COLUMN = ['#16161e', '#2a2a36', '#3e3e4c', '#5a5866', '#7c7884', '#a8a2aa'];
const CRAB_PAL: Pal = { ...HOT, e: '#140c1c', E: '#ffd040' };

/** A crab leg: from the hip up to the knee and down to a pointed tip. */
function crabLeg(hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, far: boolean): Part[] {
  const r = far ? SHELL.map((_, i) => SHELL[Math.max(0, i - 1)]) : SHELL;
  const out = fx > kx ? 1 : -1;
  return [limb(hx, hy, kx, ky, '3', { pal: digits(r), edge: r[0] }), line(kx, ky, fx, fy, '2', { pal: digits(r) }), line(kx + out, ky, fx, fy - 1, '3', { pal: digits(r) })];
}

function crabParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let claw: [number, number] = [5, 11]; // the big claw's palm
  let open = 1; // pincer gap
  let steamPh = 0;
  let step = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      claw = [5, 12];
      steamPh = 1;
      break;
    case 'windup':
      bx = 2;
      claw = [7, 6];
      open = 3;
      steamPh = 2;
      step = 1;
      break;
    case 'attack':
      // the claw snaps shut out in front
      bx = -2;
      by = 1;
      claw = [-1, 13];
      open = 0;
      steamPh = 1;
      step = -1;
      break;
    case 'hurt':
      bx = 2;
      claw = [7, 14];
      steamPh = 2;
      extra.push(puff(31, 9, 2), puff(10, 9, 1));
      break;
    case 'tell':
      // Basalt Crust!: the claw raised high, flicking hot grit
      by = -1;
      claw = [6, 3];
      open = 3;
      extra.push(dots([['5', [[1, 1], [3, -1], [-1, 4], [7, 0]]], ['3', [[2, 1], [4, -1], [0, 4]]]], { pal: digits(COLUMN), late: true }), sparks([[2, 3], [0, 0], [-2, 2]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const F = 23;
  const body = ell(X(19), Y(16), 10, 4.2);
  const pincer = (cx: number, cy: number): Part[] => {
    // a heavy palm, the hooked upper finger and the fixed lower one, a dark gap between them
    const finger = (pts: [number, number][], w0: number, lit: boolean): Part =>
      sweep(bezier(pts), (t) => w0 - t * (w0 - 0.5), (t, side) => (t > 0.85 ? (lit ? '5' : '4') : side < -0.2 ? (lit ? '4' : '3') : side > 0.45 ? '1' : lit ? '3' : '2'), 40, { pal: digits(SHELL), edge: SHELL[0] });
    return [
      finger([[cx, cy + 1.5], [cx - 3, cy + 2.2 + open * 0.3], [cx - 5, cy + 1.8 + open * 0.4], [cx - 6.5, cy + 0.6 + open * 0.2]], 1.6, false),
      vol(ell(cx + 2.5, cy, 4.2, 3.8), [cx - 3, cy - 5, cx + 8, cy + 5], [cx + 1, cy - 2, 5, 5], SHELL, { edge: SHELL[0] }),
      finger([[cx, cy - 2.4], [cx - 3, cy - 4.2 - open * 0.5], [cx - 6, cy - 3.2 - open * 0.6], [cx - 7.5, cy - 0.6 - open * 0.4]], 2, true),
      dots([['X', [[Math.round(cx - 7.5), Math.round(cy - 0.6 - open * 0.4)]]]], { pal: HOT }), // a hot glint on the tip
    ];
  };
  // the steam that hisses at the joints
  const steam: [number, number][] = [
    [X(12), Y(12)],
    [X(30), Y(13)],
  ];
  return [
    // far legs, splayed behind
    ...crabLeg(X(22), Y(17), X(27), Y(13), X(31) + step, F, true),
    ...crabLeg(X(17), Y(17), X(20), Y(14), X(23) - step, F, true),
    vol(body, [X(8), Y(11), X(30), Y(21)], [X(15), Y(14), 12, 5], SHELL, { edge: SHELL[0] }),
    // the shell: a cluster of basalt columns standing up off its back, glowing where they meet the body
    ...columns(
      [
        [X(11), Y(6), 4],
        [X(14), Y(2), 5],
        [X(18), Y(0), 5],
        [X(22), Y(3), 4],
        [X(25), Y(7), 4],
      ],
      Y(13),
      COLUMN,
    ),
    dots([['q', [[X(12), Y(13)], [X(15), Y(13)], [X(16), Y(13)], [X(20), Y(13)], [X(24), Y(13)], [X(27), Y(13)]]], ['x', [[X(18), Y(13)], [X(23), Y(13)]]]], { pal: HOT }),
    // near legs
    ...crabLeg(X(25), Y(18), X(29), Y(15), X(33) - step, F, false),
    ...crabLeg(X(14), Y(18), X(15), Y(15), X(13) + step, F, false),
    // eyes on stalks
    line(X(9), Y(12), X(8), Y(8), '3', { pal: digits(SHELL) }),
    line(X(12), Y(12), X(12), Y(8), '2', { pal: digits(SHELL) }),
    [['EE', 'ek'], X(7), Y(6), { pal: CRAB_PAL }],
    [['E', 'k'], X(12), Y(6), { pal: CRAB_PAL }],
    // the big claw on its arm
    limb(X(10), Y(16), claw[0] + 4, claw[1] + 2, '3', { pal: digits(SHELL), edge: SHELL[0] }),
    ...pincer(claw[0], claw[1]),
    ...steam.map(([x, y], i) => puff(x + ((steamPh + i) % 3) - 1, y - 2 - ((steamPh + i) % 2), 1)),
    ...extra,
  ];
}

// ------------------------------------------------------------------ obsidian ox (elite: an ox of black volcanic glass)

// black glass: deep violet-black, a cold blue-violet sheen where the light lies on it
const OBSIDIAN = ['#06050c', '#120f1e', '#201c34', '#322e50', '#504c7e', '#8c8ac0'];
const BONE = ['#3a2a20', '#6a5440', '#9a8466', '#c8b48e', '#ece0c0', '#fffbea'];
const OX_PAL: Pal = { ...HOT, W: '#e4e4ff', h: '#0a0810', H: '#2a2438', n: '#000000' };

/** A capsule mask from (x0, y0) radius r0 to (x1, y1) radius r1. */
function capMask(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): Mask {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L2 = dx * dx + dy * dy || 1;
  return (x, y) => {
    const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2));
    const r = r0 + (r1 - r0) * t;
    return (x + 0.5 - x0 - dx * t) ** 2 + (y + 0.5 - y0 - dy * t) ** 2 <= r * r;
  };
}

/** A shaded limb (a capsule lit from the top left). */
function shadedLimb(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, ramp: string[], o: PartOpts = {}): Part {
  const R = Math.max(r0, r1) + 1;
  const box: [number, number, number, number] = [Math.floor(Math.min(x0, x1) - R), Math.floor(Math.min(y0, y1) - R), Math.ceil(Math.max(x0, x1) + R), Math.ceil(Math.max(y0, y1) + R)];
  return vol(capMask(x0, y0, x1, y1, r0, r1), box, [Math.min(x0, x1) - r0 * 0.3, Math.min(y0, y1), Math.max(r0, r1) * 1.6, Math.abs(y1 - y0) + 4], ramp, { edge: ramp[0], ...o });
}

/** A horn from (x, y) rising and curving forward (dir -1 = toward the left), `s` its size. */
function oxHorn(x: number, y: number, dir: number, s = 1, dark = false): Part {
  const path = bezier([
    [x, y],
    [x - dir * 2 * s, y - 5 * s],
    [x + dir * 3 * s, y - 9 * s],
    [x + dir * 7 * s, y - 8 * s],
  ]);
  return sweep(path, (t) => (2.3 - t * 1.8) * s, (t, side) => String(Math.max(1, Math.min(5, (side * dir > 0.2 ? 4 : side * dir < -0.4 ? 2 : 3) + (t > 0.8 ? 1 : 0) - (dark ? 1 : 0) - (Math.floor(t * 9) % 2 && t < 0.45 ? 1 : 0)))), 60, {
    pal: digits(BONE),
    edge: BONE[0],
  });
}

function oxParts(pose: string): Part[] {
  const F = 39;
  let bx = 0;
  let by = 0;
  let hx = 0;
  let hy = 0;
  let front: [number, number] = [0, 0]; // front legs' lift and reach
  let back = 0;
  let eye = ['XZ'];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hy = 1;
      break;
    case 'windup':
      // scraping a hoof, head swung up
      bx = 2;
      hx = 3;
      hy = -3;
      front = [3, 3];
      break;
    case 'attack':
      // the charge: head down, horns first
      bx = -4;
      by = 1;
      hx = -7;
      hy = 5;
      front = [0, -4];
      back = 3;
      break;
    case 'hurt':
      bx = 2;
      hx = 3;
      eye = ['qq'];
      extra.push(dots([['W', [[32, 9], [38, 13], [22, 10]]]], { pal: OX_PAL, late: true }));
      break;
    case 'tell':
      // rearing: forehooves up, the cracks blazing
      by = -3;
      hx = 2;
      hy = -8;
      front = [10, 3];
      eye = ['ZX'];
      extra.push(sparks([[14, 37], [8, 38], [24, 38], [30, 37], [18, 36]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const HX = (x: number) => x + hx;
  const HY = (y: number) => y + hy;
  const rear = pose === 'tell';
  const body = rear ? anyOf(ell(X(31), Y(22), 14, 10), ell(X(20), Y(15), 9, 9.5), ell(X(24), Y(11), 6, 5)) : anyOf(ell(X(31), Y(21), 15, 10.5), ell(X(19), Y(19), 9.5, 10.5), ell(X(23), Y(11), 7.5, 5));
  const leg = (x: number, top: number, footX: number, footY: number, far: boolean): Part[] => [
    shadedLimb(x, top, footX, footY - 3, far ? 2.8 : 3.3, far ? 2.2 : 2.6, far ? OBSIDIAN.map((_, i) => OBSIDIAN[Math.max(0, i - 1)]) : OBSIDIAN),
    [['.hHh.', 'hhhhh'], Math.round(footX) - 2, Math.round(footY) - 1, { pal: OX_PAL }],
  ];
  // a broad blunt head, the muzzle low
  const head = anyOf(
    poly([
      [HX(2), HY(26)],
      [HX(3), HY(19)],
      [HX(8), HY(14)],
      [HX(15), HY(13)],
      [HX(18), HY(17)],
      [HX(17), HY(24)],
      [HX(12), HY(29)],
      [HX(4), HY(31)],
    ]),
    ell(HX(5), HY(27), 4, 3.5),
  );
  return [
    oxHorn(HX(13), HY(14), -1, 0.7, true), // the far horn, behind the head
    ...leg(X(26), Y(27), X(26) - front[1] * 0.3, F - (rear ? front[0] * 0.4 : 0), true),
    ...leg(X(41), Y(26), X(42) + back, F, true),
    glassy(crackle(vol(body, [X(8), Y(5), X(47), Y(33)], [X(22), Y(10), 22, 14], OBSIDIAN, { edge: OBSIDIAN[0] }), 7, 5, 2, 0.32), 3),
    ...leg(X(20), Y(27), X(18) + front[1], F - front[0], false),
    ...leg(X(37), Y(27), X(38) + back, F, false),
    // a short tail with a smouldering tuft
    line(X(46), Y(14), X(49), Y(22), '2', { pal: digits(OBSIDIAN) }),
    [['qx', 'Xq', '.Q'], X(48), Y(22), { pal: HOT }],
    glassy(crackle(vol(head, [HX(0), HY(12), HX(19), HY(32)], [HX(7), HY(15), 11, 10], OBSIDIAN, { edge: OBSIDIAN[0] }), 6, 8, 2, 0.4), 7),
    // the eye, nostrils and the brass nose ring
    [eye, HX(8), HY(19), { pal: HOT }],
    dots([['n', [[HX(2), HY(27)], [HX(3), HY(28)]]]], { pal: OX_PAL }),
    [['.gg.', 'G..g', 'g..y', '.yy.'], HX(1), HY(28), { pal: { g: BRASS[3], G: BRASS[4], y: BRASS[2] } }],
    oxHorn(HX(9), HY(15), -1, 0.85),
    ...extra,
  ];
}

// ------------------------------------------------------------------ rumbleback (mini-boss: a colossal road-rolling armadillo)

// banded basalt plates: cool shadows, a warm grey on the lit rims
const PLATE = ['#16161c', '#2c2a32', '#423f48', '#5e5a64', '#827c86', '#aca4ac'];
// leathery hide (face, legs): mauve in shadow, warm pink-tan in the light
const HIDE = ['#2a161c', '#4e2c30', '#7a4a46', '#a46c5c', '#cc9478', '#ecc0a0'];
// the cauldron worn as a hard hat: black iron, a cold steel glint
const IRON = ['#0c0a10', '#201e26', '#34323c', '#504e58', '#76747e', '#b0aeb8'];
const RUMBLE_PAL: Pal = { ...HOT, o: '#f27a1c', O: '#ffb05a', w: '#e8e0d8', y: '#a8a098', c: '#f2c230', C: '#9a5a14' };

/**
 * Armadillo bands over a shaded dome: seams curving with the shell (`cx`, `cy` its centre), each band's front rim
 * catching the light, a row of small scutes along every band. `hot` sets glowing cracks in the seams (phase 2).
 */
function banded(p: Part, cx: number, cy: number, bw: number, seed: number, hot: number): Part {
  const [rows, ox, oy] = p;
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        const u = gx + ((gy - cy) * (gy - cy)) / 40 - cx; // seams bow round the dome
        const k = Math.floor(u / bw);
        const f = u - k * bw;
        let t = +c;
        if (f < 1) {
          if (hot && hash2(k + seed, Math.floor(gy / 3)) < hot) return gy % 4 === 0 ? 'X' : 'x';
          return '1'; // the seam
        }
        if (f < 2) t = Math.min(5, t + 1); // the band's rim
        else if (f > bw - 1.5) t = Math.max(1, t - 1);
        // scutes: little plates in a row along the band
        if (Math.floor(gy + (k % 2) * 2) % 4 === 0 && f > 2 && f < bw - 1) t = Math.max(1, t - 1);
        return String(t);
      })
      .join(''),
  );
  return [out, ox, oy, { ...p[3], pal: { ...HOT, ...(p[3]?.pal ?? {}) } }];
}

/** The dented cauldron he wears as a hard hat, its handle up (rim at row y+5), tilted by `tilt` px. */
function cauldronHat(x: number, y: number, tilt: number, dents: number): Part[] {
  const dome = (gx: number, gy: number) => ell(x + 6, y + 6, 6.5, 5.5)(gx, gy - Math.round(((gx - x) * tilt) / 12)) && gy - Math.round(((gx - x) * tilt) / 12) <= y + 5;
  const pot = vol(dome, [x - 1, y - 1, x + 14, y + 8 + Math.abs(tilt)], [x + 3, y + 2, 7, 5], IRON, { edge: IRON[0] });
  // dents: shadowed notches in the dome
  const dentPts: [number, number][] = [];
  for (let i = 0; i < dents; i++) {
    const dx = x + 4 + i * 4;
    dentPts.push([dx, y + 2 + (i % 2) + Math.round(((dx - x) * tilt) / 12)], [dx + 1, y + 3 + (i % 2) + Math.round(((dx + 1 - x) * tilt) / 12)]);
  }
  const rim: [number, number][] = [];
  for (let gx = x - 1; gx <= x + 13; gx++) rim.push([gx, y + 6 + Math.round(((gx - x) * tilt) / 12)]);
  return [
    // the handle: an iron hoop over the top
    sweep((t) => [x + 3 + t * 7, y + 1 - Math.sin(t * Math.PI) * 4 + ((t * 7 + 3) * tilt) / 12], () => 0.6, () => '4', 30, { pal: digits(IRON) }),
    pot,
    dots([['2', dentPts]], { pal: digits(IRON) }),
    dots([['5', rim.slice(0, 5)], ['4', rim.slice(5, 11)], ['3', rim.slice(11)]], { pal: digits(IRON), edge: IRON[0] }),
  ];
}

/** The road-worker's sash: orange and white stripes along a band from (x0, y0) to (x1, y1). */
function sash(x0: number, y0: number, x1: number, y1: number, w: number): Part {
  const pts: Record<string, [number, number][]> = { o: [], O: [], w: [], y: [] };
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  for (let gy = Math.floor(Math.min(y0, y1) - w); gy <= Math.max(y0, y1) + w; gy++)
    for (let gx = Math.floor(Math.min(x0, x1) - w); gx <= Math.max(x0, x1) + w; gx++) {
      const t = ((gx + 0.5 - x0) * dx + (gy + 0.5 - y0) * dy) / (L * L);
      if (t < 0 || t > 1) continue;
      const d = ((gx + 0.5 - x0) * dy - (gy + 0.5 - y0) * dx) / L;
      if (Math.abs(d) > w / 2) continue;
      const stripe = Math.floor(t * L * 0.5) % 2 === 0;
      const lit = d < 0;
      pts[stripe ? (lit ? 'O' : 'o') : lit ? 'w' : 'y'].push([gx, gy]);
    }
  return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: RUMBLE_PAL, edge: '#5a2a14' });
}

function rumbleParts(pose: string, phase: number): Part[] {
  const F = 45;
  const hot = phase >= 2 ? 0.45 : 0;
  // curled into a ball: Roll Out! (rolling at the hero, dust behind) and the shell he hides in (Curl Up!)
  if (pose === 'attack' || pose === 'shell') {
    const roll = pose === 'attack';
    const cx = roll ? 24 : 32;
    const cy = 28;
    const R = 16;
    const ball = ell(cx, cy, R, R - 0.5);
    const shell = banded(vol(ball, [cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1], [cx - 5, cy - 6, R * 1.3, R * 1.3], PLATE, { edge: PLATE[0] }), cx - 30 + (roll ? 3 : 0), cy, 6, 7, hot);
    const parts: Part[] = [shell];
    // the tail wrapped round the front, the cauldron jammed on top, the sash round the middle
    parts.push(sweep((t) => [cx - R * 0.7 * Math.cos(t * 2.2 - 0.4), cy + R * 0.75 * Math.sin(t * 2.2 - 0.4)], (t) => 2.6 - t * 1.4, (t, side) => (Math.floor(t * 8) % 2 ? (side < 0 ? '4' : '2') : side < 0 ? '3' : '1'), 40, { pal: digits(PLATE), edge: PLATE[0] }));
    parts.push(sash(cx - 10, cy - 12, cx + 12, cy + 10, 3));
    parts.push(...cauldronHat(cx - 7, cy - R - 4, roll ? -3 : 1, phase >= 2 ? 3 : 2));
    if (roll) parts.push(puff(cx + R + 3, F - 3, 3), puff(cx + R + 8, F - 6, 2), puff(cx + R + 11, F - 2, 2), dots([['S', [[cx + R + 2, cy - 6], [cx + R + 5, cy - 2], [cx + R + 4, cy + 3]]]], { pal: HOT, late: true }));
    else parts.push(dots([['k', [[cx - 13, cy + 2], [cx - 12, cy + 2]]], ['X', [[cx - 13, cy + 1]]]], { pal: HOT })); // an eye peeking out of the shell
    return parts;
  }
  let bx = 0;
  let by = 0;
  let hx = 0;
  let hy = 0;
  let paw = 0; // the near forepaw raised
  let eye = ['kk', 'kW'];
  let mouth = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hy = 1;
      break;
    case 'windup':
      // rocking back on his haunches
      bx = 3;
      by = -1;
      hx = 4;
      hy = -3;
      paw = 3;
      break;
    case 'hurt':
      bx = 3;
      hx = 4;
      hy = 1;
      eye = ['..', 'kk'];
      mouth = true;
      extra.push(dots([['S', [[30, 4], [44, 8]]]], { pal: HOT, late: true }));
      break;
    case 'tell':
      // hunkered down, claws dug in, the road shaking: dust rising, the hat rattling
      by = 2;
      hx = -2;
      hy = 3;
      paw = 0;
      mouth = true;
      eye = ['kk', 'XZ'];
      extra.push(puff(8, F - 2, 2), puff(52, F - 2, 2), puff(30, F - 1, 2), dots([['S', [[16, F - 6], [44, F - 7], [4, F - 5]]]], { pal: HOT, late: true }));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const HX = (x: number) => x + hx;
  const HY = (y: number) => y + hy;
  const dome = (gx: number, gy: number) => ell(X(35), Y(31), 22, 21)(gx, gy) && gy <= Y(37);
  const leg = (x: number, footX: number, lift: number, far: boolean): Part[] => [
    shadedLimb(x, Y(33), footX, F - 3 - lift, far ? 3 : 3.6, far ? 2.6 : 3, far ? HIDE.map((_, i) => HIDE[Math.max(0, i - 1)]) : HIDE),
    [['k.k.k', 'yyyyyy'], Math.round(footX) - 3, F - 1 - lift, { pal: { ...RUMBLE_PAL, y: far ? '#5a5250' : '#a8a098' } }],
  ];
  const head = anyOf(ell(HX(17), HY(25), 7, 6), poly([[HX(1), HY(31)], [HX(3), HY(28)], [HX(12), HY(22)], [HX(18), HY(26)], [HX(15), HY(31)], [HX(6), HY(33)]]));
  return [
    // the armoured tail behind, banded
    sweep((t) => [X(55) + t * 4, Y(30) + t * 13], (t) => 3.2 - t * 2, (t, side) => (Math.floor(t * 6) % 2 ? (side < 0 ? '4' : '2') : side < 0 ? '3' : '1'), 40, { pal: digits(PLATE), edge: PLATE[0] }),
    ...leg(X(24), X(23), 0, true),
    ...leg(X(46), X(47), 0, true),
    banded(vol(dome, [X(12), Y(9), X(58), Y(38)], [X(28), Y(16), 26, 22], PLATE, { edge: PLATE[0] }), X(13), Y(31), 7, 3, hot),
    // the skirt of the shell, a lighter lip along its bottom
    dots([['5', Array.from({ length: 40 }, (_, i): [number, number] => [X(15) + i, Y(37) + (i % 7 === 3 ? 1 : 0)])]], { pal: digits(PLATE), edge: PLATE[0] }),
    sash(X(18), Y(14), X(36), Y(37), 4),
    ...leg(X(19), X(17) - paw, paw, false),
    ...leg(X(40), X(41), 0, false),
    // the head: a long snout, a little ear, a sleepy look, the head plate and the cauldron on top
    vol(head, [HX(0), HY(17), HX(25), HY(34)], [HX(9), HY(22), 12, 9], HIDE, { edge: HIDE[0] }),
    banded(vol(ell(HX(16), HY(21), 6, 3.4), [HX(9), HY(17), HX(23), HY(25)], [HX(13), HY(19), 6, 4], PLATE, { edge: PLATE[0] }), HX(9), HY(21), 3, 5, 0),
    [['.33', '322', '21.'], HX(19), HY(17), { pal: digits(HIDE) }],
    [eye, HX(9), HY(24), { pal: RUMBLE_PAL }],
    dots([['k', [[HX(1), HY(30)], [HX(2), HY(30)]]]], { pal: RUMBLE_PAL }),
    ...(mouth ? [dots([['k', [[HX(3), HY(32)], [HX(4), HY(32)], [HX(5), HY(32)], [HX(6), HY(32)]]], ['w', [[HX(4), HY(31)]]]], { pal: RUMBLE_PAL })] : []),
    ...cauldronHat(HX(9), HY(10), pose === 'hurt' ? 3 : phase >= 2 ? 2 : 0, phase >= 2 ? 3 : 2),
    ...extra,
  ];
}

// ------------------------------------------------------------------ glassblower (a goblin glassblower, cheeks puffed)

// goblin green: shadows lean teal, highlights lean yellow
const GOB = ['#10241c', '#1c3e2a', '#2c6234', '#488a3e', '#74b44e', '#b0dc74'];
const SHIRT = ['#2a0e1a', '#4e1a26', '#7a2a30', '#a8443a', '#d0684a'];
const GLASSB_PAL: Pal = { ...HOT, g: BRASS[3], G: BRASS[4], y: BRASS[2], l: '#5ad8e8', L: '#d8fbff', n: '#1a3a2a', e: '#ffd8a0' };

/** A gob of molten glass (r 2-5): white-hot heart, gold, orange, a red skin; a glint on its upper left. */
function glassBubble(cx: number, cy: number, r: number): Part {
  const pts: Record<string, [number, number][]> = { Q: [], q: [], x: [], X: [], Z: [], W: [] };
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d > 1) continue;
      const lit = (x + 0.5 - cx) * -0.6 + (y + 0.5 - cy) * -0.8;
      const ch = d < 0.35 ? 'Z' : d < 0.62 ? 'X' : d < 0.86 ? 'x' : lit > 0 ? 'q' : 'Q';
      pts[ch].push([x, y]);
    }
  pts.W.push([Math.round(cx - r * 0.45), Math.round(cy - r * 0.5)]);
  return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: HOT, edge: EMBER[0] });
}

function blowerParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let puffK = 0.5; // cheeks: 0 flat, 1 hugely puffed
  let ang = (128 * Math.PI) / 180; // the blowpipe from the mouth
  let len = 13;
  let bub = 2.5;
  let flung = false;
  let eyes = ['GLlg', 'glLg'];
  let hurt = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      puffK = 0.8;
      bub = 3;
      break;
    case 'windup':
      // the pipe hauled up over his shoulder like a club, the gob dangling behind
      bx = 2;
      ang = (-40 * Math.PI) / 180;
      len = 12;
      puffK = 0.2;
      bub = 3;
      break;
    case 'attack':
      // swung forward: the gob of glass flies off the end
      bx = -2;
      by = 1;
      ang = (160 * Math.PI) / 180;
      len = 12;
      puffK = 0.2;
      flung = true;
      break;
    case 'hurt':
      bx = 2;
      puffK = 0;
      ang = (110 * Math.PI) / 180;
      bub = 2;
      hurt = true;
      eyes = ['g.Lg', 'gLlg'];
      break;
    case 'tell':
      // Blow Glass!: cheeks like balloons, eyes squeezed shut, a great glowing bubble swelling on the pipe
      by = -1;
      puffK = 1.3;
      ang = (135 * Math.PI) / 180;
      bub = 5;
      eyes = ['gnng', 'gggg'];
      extra.push(sparks([[-8, 18], [-1, 16], [-6, 27]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const mx = X(7);
  const my = Y(13);
  const ex = mx + Math.cos(ang) * len;
  const ey = my + Math.sin(ang) * len;
  const raised = pose === 'windup';
  const pipe: Part[] = [
    line(Math.round(mx), Math.round(my), Math.round(ex), Math.round(ey), '3', { pal: digits(STEEL) }),
    line(Math.round(mx), Math.round(my) + 1, Math.round(ex), Math.round(ey) + 1, '1', { pal: digits(STEEL) }),
    ...(flung ? [glassBubble(ex - 5, ey - 1, 3), dots([['q', [[Math.round(ex - 1), Math.round(ey - 1)], [Math.round(ex), Math.round(ey - 1)]]]], { pal: HOT, late: true })] : [glassBubble(ex + Math.cos(ang) * bub * 0.8, ey + Math.sin(ang) * bub * 0.8, bub)]),
  ];
  // hands on the pipe: one near the mouth, one further down
  const hand = (t: number): Part => [['.hh', 'hhh'], Math.round(mx + Math.cos(ang) * len * t) - 1, Math.round(my + Math.sin(ang) * len * t) - 1, { pal: { h: GOB[3] } }];
  const head = anyOf(ell(X(14), Y(10), 7, 6.2), ell(X(9), Y(13), 2.8 + puffK * 1.8, 2.4 + puffK * 1.3));
  return [
    ...(raised ? pipe : []),
    // the far ear
    [['..55', '.44.', '33..'], X(20), Y(3), { pal: digits(GOB) }],
    capsule(X(13), Y(24), X(12), Y(28), 1.6, 1.5, '2', { pal: digits(LEATHER) }),
    capsule(X(18), Y(24), X(19), Y(28), 1.6, 1.5, '2', { pal: digits(LEATHER) }),
    [['1111', '2222'], X(10), Y(28), { pal: digits(LEATHER) }],
    [['1111', '2222'], X(18), Y(28), { pal: digits(LEATHER) }],
    vol(ell(X(16), Y(21), 5.5, 5), [X(9), Y(15), X(23), Y(27)], [X(13), Y(18), 7, 6], SHIRT, { edge: SHIRT[0] }),
    // the leather apron, scorched at the hem
    vol(poly([[X(12), Y(17)], [X(19), Y(17)], [X(21), Y(27)], [X(11), Y(27)]]), [X(10), Y(16), X(22), Y(28)], [X(13), Y(18), 7, 8], LEATHER, { edge: LEATHER[0] }),
    dots([['Q', [[X(11), Y(26)], [X(14), Y(26)], [X(15), Y(26)], [X(19), Y(26)]]]], { pal: HOT }),
    vol(head, [X(4), Y(3), X(22), Y(17)], [X(11), Y(6), 9, 8], GOB, { edge: GOB[0] }),
    // a big warty nose, the near ear swept back, the goggles' strap and brass-rimmed lenses
    [['.44', '453', '332'], X(4), Y(9), { pal: digits(GOB) }],
    [['...55', '..454', '.43..', '32...'], X(17), Y(5), { pal: digits(GOB) }],
    line(X(12), Y(8), X(20), Y(9), '1', { pal: digits(LEATHER) }),
    [eyes, X(8), Y(7), { pal: GLASSB_PAL }],
    ...(hurt ? [dots([['S', [[X(15), Y(2)], [X(6), Y(3)]]]], { pal: HOT, late: true })] : []),
    ...(raised ? [] : pipe),
    hand(0.3),
    hand(0.62),
    ...extra,
  ];
}

// ------------------------------------------------------------------ prism bat (a bat with stained-glass wings)

const BATBODY = ['#100c16', '#1e1828', '#30283c', '#463a54', '#62546e', '#84748e'];
const PANES = ['#d03a30', '#f0a020', '#3aa84a', '#3a7ad0'];
const PANES_LIT = ['#ff8a70', '#ffe070', '#9ae87a', '#9ad0ff'];
const PRISM_PAL: Pal = { ...HOT, L: '#1a1420', r: PANES[0], R: PANES_LIT[0], a: PANES[1], A: PANES_LIT[1], g: PANES[2], G: PANES_LIT[2], b: PANES[3], B: PANES_LIT[3], E: '#ffd8f0', e: '#c03a8a' };

/** A stained-glass wing: a fan from the shoulder through finger tips (`tips`), panes of colour in black leading. */
function glassWing(sx: number, sy: number, tips: [number, number][], seed: number, bright: boolean, cracked: boolean): Part {
  const pts: Record<string, [number, number][]> = {};
  const add = (ch: string, x: number, y: number) => (pts[ch] ??= []).push([x, y]);
  // the membrane between each pair of finger tips, scalloped between them
  for (let i = 0; i < tips.length - 1; i++) {
    const a = tips[i];
    const b = tips[i + 1];
    const m = poly([[sx, sy], a, [(a[0] + b[0]) / 2 * 0.75 + sx * 0.25, (a[1] + b[1]) / 2 * 0.75 + sy * 0.25], b]); // scalloped toward the body
    const x0 = Math.floor(Math.min(sx, a[0], b[0])) - 1;
    const x1 = Math.ceil(Math.max(sx, a[0], b[0])) + 1;
    const y0 = Math.floor(Math.min(sy, a[1], b[1])) - 1;
    const y1 = Math.ceil(Math.max(sy, a[1], b[1])) + 2;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (!m(x, y)) continue;
        // leading: the finger bones and one ring of lead across the panes: big clean panes of colour
        const r = Math.hypot(x + 0.5 - sx, y + 0.5 - sy);
        if (Math.abs(r - 7.5) < 0.6) {
          add('L', x, y);
          continue;
        }
        const band = r < 7.5 ? 0 : 1;
        const c = (i * 3 + band * 2 + seed) % 4;
        // each pane lit along the edge nearest the light, the rest of it in its own colour
        const lit = bright ? (x + y) % 3 !== 0 : Math.abs(r - 8.4) < 0.5 || r < 3;
        if (cracked && (x - y + 40) % 6 === 0 && band === 1) add('W', x, y);
        else add(lit ? 'RAGB'[c] : 'ragb'[c], x, y);
      }
  }
  const out: Part[] = [dots(Object.entries(pts) as [string, [number, number][]][], { pal: PRISM_PAL, edge: INK })];
  for (const t of tips) out.push(line(sx, sy, Math.round(t[0]), Math.round(t[1]), 'L', { pal: PRISM_PAL }));
  return out.length === 1 ? out[0] : mergeParts(out);
}

/** Several parts as one (drawn in order). */
function mergeParts(parts: Part[]): Part {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [rows, x, y] of parts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + Math.max(...rows.map((r) => r.length)) - 1);
    y1 = Math.max(y1, y + rows.length - 1);
  }
  const g = Array.from({ length: y1 - y0 + 1 }, () => Array<string>(x1 - x0 + 1).fill('.'));
  const pal: Pal = {};
  for (const [rows, x, y, o] of parts) {
    Object.assign(pal, o?.pal ?? {});
    rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && ch !== ' ' && (g[y - y0 + j][x - x0 + i] = ch)));
  }
  return [g.map((r) => r.join('')), x0, y0, { ...parts[0][3], pal }];
}

function prismBatParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let wing: 'up' | 'down' | 'spread' | 'back' = 'up';
  let bright = false;
  let cracked = false;
  let eye = ['EE'];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      wing = 'down';
      by = 1;
      break;
    case 'windup':
      wing = 'up';
      bx = 2;
      by = -1;
      break;
    case 'attack':
      wing = 'back';
      bx = -4;
      by = 3;
      break;
    case 'hurt':
      wing = 'down';
      bx = 2;
      cracked = true;
      eye = ['ee'];
      break;
    case 'tell':
      // Prism Flash!: wings flung wide, every pane lit, coloured light thrown off them
      wing = 'spread';
      bright = true;
      extra.push(dots([['R', [[2, 2], [4, 1]]], ['A', [[33, 1], [35, 3]]], ['G', [[1, 18], [34, 18]]], ['B', [[17, -3], [19, -4]]]], { pal: PRISM_PAL, late: true }));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const sx = X(18);
  const sy = Y(11);
  const TIPS: Record<string, { near: [number, number][]; far: [number, number][] }> = {
    up: { near: [[-16, -3], [-14, -10], [-8, -14], [-2, -12]], far: [[3, -12], [9, -14], [15, -11], [17, -4]] },
    down: { near: [[-17, 3], [-14, 9], [-8, 11], [-2, 8]], far: [[3, 8], [9, 11], [14, 9], [16, 3]] },
    spread: { near: [[-18, -1], [-16, -9], [-10, -14], [-3, -14]], far: [[3, -14], [10, -15], [17, -10], [19, -2]] },
    back: { near: [[-5, -13], [0, -15], [6, -14], [11, -10]], far: [[8, -11], [13, -12], [17, -8], [19, -3]] },
  };
  const T = TIPS[wing];
  const pts = (l: [number, number][]) => l.map(([x, y]): [number, number] => [sx + x, sy + y]);
  const body = anyOf(ell(X(18), Y(13), 4, 4.5), ell(X(18), Y(8), 3.4, 3));
  return [
    glassWing(sx + 1, sy, pts(T.far), 2, bright, false),
    vol(body, [X(13), Y(3), X(23), Y(19)], [X(16), Y(7), 5, 6], BATBODY, { edge: BATBODY[0] }),
    // little feet tucked under
    [['1.1'], X(17), Y(18), { pal: digits(BATBODY) }],
    glassWing(sx - 1, sy, pts(T.near), 0, bright, cracked),
    // the head in front of the wings: big ears, a snub nose, small pink eyes
    vol(ell(X(17), Y(8), 3.6, 3.2), [X(13), Y(4), X(22), Y(12)], [X(16), Y(6), 4, 4], BATBODY, { edge: BATBODY[0] }),
    [['3..3', '43.4', '4..4'], X(15), Y(3), { pal: digits(BATBODY) }],
    [eye, X(15), Y(7), { pal: PRISM_PAL }],
    [['2', '1'], X(14), Y(9), { pal: digits(BATBODY) }],
    ...extra,
  ];
}

// ------------------------------------------------------------------ glass mantis (a praying mantis of green bottle glass)

// bottle glass: deep green shadows leaning blue, the lit side leaning yellow-green, a white glare
const BOTTLE = ['#0a2418', '#124a2a', '#1e7038', '#3a9a4a', '#72c46a', '#c4f0a8'];
// the see-through scythes: pale glass, a darker inner line, the edge glaring white
const CLEAR = ['#2a6a48', '#4a9a70', '#7ec8a0', '#b4ead0', '#e4fff0', '#ffffff'];
const MANTIS_PAL: Pal = { ...HOT, E: '#e8ff70', e: '#8ab820' };

/** A see-through scythe arm: the upper arm from the shoulder to the elbow, the blade folding back from the elbow. */
function scythe(sx: number, sy: number, ex: number, ey: number, tx: number, ty: number): Part[] {
  const upper = sweep((t) => [sx + (ex - sx) * t, sy + (ey - sy) * t], (t) => 1.6 - t * 0.3, (_, side) => (side < -0.3 ? '4' : side > 0.5 ? '1' : '3'), 40, { pal: digits(CLEAR), edge: CLEAR[0] });
  const blade = sweep(
    bezier([
      [ex, ey],
      [ex + (tx - ex) * 0.3, ey + (ty - ey) * 0.1 - 2],
      [ex + (tx - ex) * 0.8, ey + (ty - ey) * 0.6 - 1],
      [tx, ty],
    ]),
    (t) => 2 - t * 1.5,
    (t, side) => (side < -0.35 ? '5' : side > 0.55 ? '1' : Math.floor(t * 10) % 3 === 0 && side > 0 ? '0' : '3'),
    50,
    { pal: { ...digits(CLEAR), 0: BOTTLE[2] }, edge: CLEAR[0] },
  );
  return [upper, blade];
}

function mantisParts(pose: string): Part[] {
  const F = 35;
  let bx = 0;
  let by = 0;
  let near: [number, number, number, number] = [6, 18, 9, 24]; // elbow x, y; blade tip x, y
  let far: [number, number, number, number] = [9, 17, 12, 23];
  let eye = ['EE', 'Ee'];
  let lean = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      near = [6, 19, 9, 25];
      far = [9, 18, 12, 24];
      break;
    case 'windup':
      bx = 2;
      lean = 1;
      near = [8, 9, 4, 3];
      far = [11, 9, 9, 2];
      break;
    case 'attack':
      // the strike: both blades slashed out and down
      bx = -3;
      lean = -2;
      near = [0, 17, -7, 26];
      far = [3, 16, -4, 25];
      extra.push(dots([['W', [[-8, 20], [-9, 23], [-6, 17]]]], { pal: HOT, late: true }));
      break;
    case 'hurt':
      bx = 2;
      lean = 1;
      eye = ['ee', 'ee'];
      near = [8, 19, 11, 25];
      far = [11, 18, 14, 24];
      extra.push(dots([['W', [[22, 14], [16, 6]]]], { pal: HOT, late: true }));
      break;
    case 'tell':
      // Scissor Snap!: both scythes thrown open high, like shears about to close
      by = -1;
      near = [2, 9, -4, 2];
      far = [13, 6, 20, 0];
      eye = ['EE', 'XE'];
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const LX = (x: number, y: number) => x + bx + Math.round(lean * (1 - y / F));
  const leg = (hx: number, hy: number, kx: number, ky: number, fx: number, farLeg: boolean): Part[] => [
    line(hx, hy, kx, ky, farLeg ? '2' : '3', { pal: digits(BOTTLE) }),
    line(kx, ky, fx, F, farLeg ? '1' : '2', { pal: digits(BOTTLE) }),
  ];
  return [
    ...scythe(LX(13, 14), Y(15), X(far[0]), Y(far[1]), X(far[2]), Y(far[3])),
    ...leg(X(18), Y(26), X(13), Y(23), X(10), true),
    ...leg(X(22), Y(27), X(27), Y(24), X(29), true),
    // the abdomen, long and tilted back, ribbed
    glassy(vol(ell(X(25), Y(25), 7, 3.6), [X(17), Y(20), X(33), Y(30)], [X(22), Y(22), 8, 4], BOTTLE, { edge: BOTTLE[0] }), 4),
    // the thorax, a tall stalk
    glassy(vol(capMask(X(19), Y(25), LX(14, 12), Y(13), 2.4, 1.8), [X(10), Y(9), X(23), Y(29)], [X(14), Y(14), 5, 10], BOTTLE, { edge: BOTTLE[0] }), 2),
    ...leg(X(20), Y(27), X(16), Y(24), X(14), false),
    ...leg(X(23), Y(27), X(28), Y(23), X(31), false),
    // the head: a triangle with big bulging eyes, antennae
    vol(poly([[LX(8, 6), Y(7)], [LX(16, 6), Y(5)], [LX(13, 10), Y(12)]]), [LX(7, 6), Y(4), LX(17, 6), Y(13)], [LX(11, 6), Y(6), 5, 4], BOTTLE, { edge: BOTTLE[0] }),
    [eye, LX(8, 6), Y(6), { pal: MANTIS_PAL }],
    [['EE', 'eE'], LX(14, 6), Y(5), { pal: MANTIS_PAL }],
    line(LX(11, 4), Y(5), LX(7, 0), Y(-1), '4', { pal: digits(BOTTLE) }),
    line(LX(13, 4), Y(5), LX(13, 0), Y(-2), '3', { pal: digits(BOTTLE) }),
    ...scythe(LX(14, 14), Y(15), X(near[0]), Y(near[1]), X(near[2]), Y(near[3])),
    ...extra,
  ];
}

// ------------------------------------------------------------------ kiln warden (elite: a walking brick kiln)

// fired brick: plum shadows, a warm terracotta in the light
const BRICK = ['#2a1012', '#4e1c18', '#783022', '#a04a2e', '#c4704a', '#e4a070'];
const KILN_PAL: Pal = { ...HOT, m: '#3a2420', M: '#b89a86', g: '#3aa84a', G: '#a8f0a0', b: '#3a7ad0', B: '#a8d8ff', c: '#c8a070', C: '#8a6040' };

/** Bricks laid in a running bond over a shaded form: mortar joints every 3 rows, staggered every 5 px. */
function bricked(p: Part): Part {
  const [rows, ox, oy] = p;
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        const row = Math.floor(gy / 3);
        const joint = gy % 3 === 0 || (gx + (row % 2) * 3) % 6 === 0;
        if (joint) return +c >= 4 ? 'M' : 'm';
        // each brick a shade of its own
        return String(Math.max(1, Math.min(5, +c + (hash2(Math.floor((gx + (row % 2) * 3) / 6), row) > 0.72 ? -1 : 0))));
      })
      .join(''),
  );
  return [out, ox, oy, { ...p[3], pal: { ...KILN_PAL, ...(p[3]?.pal ?? {}) } }];
}

/** A glass bottle lying on its side (a pauldron): body, neck toward `dir`, a cork; `c` / `C` its glass. */
function bottle(x: number, y: number, dir: number, c: string, C: string): Part {
  const rows = ['.CCCCCC....', 'CccccCCCC..', 'cccccccccrr', 'cccccccccr.', '.cccccc....'];
  return [dir < 0 ? rows.map((r) => [...r].reverse().join('')) : rows, x, y, { pal: { c: KILN_PAL[c], C: KILN_PAL[C], r: '#a87a4a' }, edge: INK }];
}

function kilnParts(pose: string): Part[] {
  const F = 45;
  let bx = 0;
  let by = 0;
  let fist: [number, number] = [6, 33]; // near fist
  let open = 0; // the furnace door: 0 a glowing grille, 1 thrown open
  let glow = 1;
  let smoke = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      fist = [6, 34];
      smoke = 1;
      break;
    case 'windup':
      bx = 2;
      fist = [10, 14];
      smoke = 2;
      break;
    case 'attack':
      // a lumbering punch: the brick fist thrown out
      bx = -3;
      by = 1;
      fist = [-6, 24];
      smoke = 1;
      break;
    case 'hurt':
      bx = 2;
      glow = 0;
      fist = [8, 33];
      smoke = 2;
      extra.push(dots([['4', [[36, 8], [6, 12], [38, 20]]]], { pal: digits(BRICK), late: true }));
      break;
    case 'tell':
      // Kiln Door! / Firing!: the furnace door thrown open, white-hot, flames licking out
      by = -1;
      open = 1;
      fist = [3, 30];
      smoke = 3;
      extra.push(flame(10, 31, 7, 5, 1, -1), flame(15, 31, 5, 4, 2, -1.2), sparks([[2, 22], [5, 18], [0, 27], [7, 15]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const dome = (gx: number, gy: number) => (ell(X(22), Y(27), 14, 17)(gx, gy) && gy <= Y(39)) || (gy > Y(30) && gy <= Y(39) && gx >= X(8) && gx <= X(36));
  // the furnace mouth: an arch in the front
  const arch = (gx: number, gy: number) => gx >= X(9) && gx <= X(21) && gy >= Y(22) && gy <= Y(35) && (gy >= Y(27) || ell(X(15), Y(27), 6.5, 5.5)(gx, gy));
  const inner = (gx: number, gy: number) => gx >= X(11) && gx <= X(19) && gy >= Y(24) && gy <= Y(34) && (gy >= Y(27) || ell(X(15), Y(27), 4.5, 3.6)(gx, gy));
  const mouth: Part = (() => {
    const pts: Record<string, [number, number][]> = { 1: [], 2: [], 3: [], 4: [], Q: [], q: [], x: [], X: [], Z: [] };
    for (let gy = Y(21); gy <= Y(35); gy++)
      for (let gx = X(8); gx <= X(22); gx++) {
        if (!arch(gx, gy)) continue;
        if (!inner(gx, gy)) {
          pts[gx < X(12) || gy < Y(24) ? '4' : '2'].push([gx, gy]); // the iron frame
          continue;
        }
        const d = Math.hypot((gx + 0.5 - X(15)) / 4.5, (gy + 0.5 - Y(30)) / 5);
        const heat = open ? 1.3 - d * 0.6 : glow ? 1 - d * 0.75 : 0.4 - d * 0.3;
        const bar = !open && (gx - X(11)) % 3 === 1; // the grille
        if (bar) pts[gy % 4 === 0 ? '3' : '1'].push([gx, gy]);
        else pts[heat > 0.85 ? 'Z' : heat > 0.6 ? 'X' : heat > 0.35 ? 'x' : heat > 0.12 ? 'q' : 'Q'].push([gx, gy]);
      }
    return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: { ...digits(IRON), ...HOT } });
  })();
  const smokeAt = (i: number): [number, number] => [X(29) + ((smoke + i) % 3) - 1 + i, Y(1) - i * 3 - ((smoke + i) % 2)];
  return [
    // the far arm behind
    shadedLimb(X(34), Y(22), X(37), Y(32), 3, 3, BRICK.map((_, i) => BRICK[Math.max(0, i - 1)])),
    // brick legs
    bricked(vol((gx) => (gx >= X(13) && gx <= X(19)) || (gx >= X(25) && gx <= X(31)), [X(13), Y(38), X(31), F - 1], [X(16), Y(38), 10, 8], BRICK, { edge: BRICK[0] })),
    [['1111111', '2222222'], X(12), F - 1, { pal: digits(IRON) }],
    [['1111111', '2222222'], X(25), F - 1, { pal: digits(IRON) }],
    // the chimney with its soot cap, then the dome
    bricked(vol((gx, gy) => gx >= X(26) && gx <= X(31) && gy >= Y(3), [X(26), Y(3), X(31), Y(13)], [X(27), Y(4), 3, 6], BRICK, { edge: BRICK[0] })),
    [['111111', '.1111.'], X(26), Y(2), { pal: digits(IRON) }],
    bricked(vol(dome, [X(7), Y(9), X(37), Y(40)], [X(17), Y(15), 16, 18], BRICK, { edge: BRICK[0] })),
    mouth,
    // two glowing vents for eyes
    [glow ? ['XZ'] : ['qq'], X(11), Y(18), { pal: HOT }],
    [glow ? ['ZX'] : ['qq'], X(17), Y(17), { pal: HOT }],
    // the bottle pauldrons: green on the near shoulder, blue on the far one
    bottle(X(28), Y(12), 1, 'b', 'B'),
    bottle(X(3), Y(15), -1, 'g', 'G'),
    // the near arm, a brick fist
    shadedLimb(X(10), Y(22), fist[0] + bx, fist[1] + by, 3.4, 3, BRICK),
    bricked(vol(ell(fist[0] + bx, fist[1] + by + 1, 3.2, 3), [fist[0] + bx - 4, fist[1] + by - 3, fist[0] + bx + 4, fist[1] + by + 5], [fist[0] + bx - 1, fist[1] + by - 1, 4, 4], BRICK, { edge: BRICK[0] })),
    ...[0, 1, 2].map((i) => puff(...smokeAt(i), i === 2 ? 2 : 1, true)),
    ...extra,
  ];
}

// ------------------------------------------------------------------ hob & nob (mini-boss: the forge's two-headed lava hound)

// coal-black fur: violet shadows, a warm brown-grey on the lit tips
const HOUND = ['#0e0a12', '#1e1820', '#302628', '#46383a', '#625048', '#86705c'];
const HOUND_PAL: Pal = { ...HOT, t: '#f4ead8', T: '#b8a890', r: '#c04a5a', R: '#801a2a', m: '#1a0a10', w: WOOD[4], v: WOOD[2], V: WOOD[1] };

interface DogHead {
  open?: number; // jaw drop (px)
  scowl?: boolean; // Hob: heavy brows, narrow eyes, a spiked collar
  stick?: boolean; // Nob: a stick held in his teeth
  shut?: boolean; // wincing
  ear?: number; // ear flap (px up)
}

/** One of the hound's heads facing left, its skull centred near (cx, cy). */
function dogHead(cx: number, cy: number, o: DogHead): Part[] {
  const open = o.open ?? 0;
  const parts: Part[] = [];
  // the far ear, then the skull and snout, the lower jaw
  parts.push([['.33', '332', '22.'], cx + 3, cy - 6 - (o.ear ?? 0), { pal: digits(HOUND), edge: HOUND[0] }]);
  const skull = anyOf(ell(cx + 2, cy, 5.5, 4.6), poly([[cx - 8, cy + 0], [cx - 7, cy - 2], [cx - 1, cy - 3], [cx + 1, cy + 3], [cx - 7, cy + 3]]));
  const jaw = poly([[cx - 7, cy + 2 + open * 0.6], [cx + 1, cy + 2], [cx + 2, cy + 5], [cx - 6, cy + 4 + open]]);
  if (open) {
    const gape: [number, number][] = [];
    for (let x = cx - 7; x <= cx; x++) for (let y = cy + 2; y <= cy + 2 + Math.round(open * 0.8 * ((x - cx + 8) / 8)); y++) gape.push([x, y]);
    parts.push(dots([['m', gape]], { pal: HOUND_PAL }));
  }
  parts.push(crackle(vol(jaw, [cx - 8, cy + 1, cx + 3, cy + 6 + open], [cx - 4, cy + 2, 6, 3], HOUND, { edge: HOUND[0] }), 4, cx, 3, 0.3));
  parts.push(crackle(vol(skull, [cx - 9, cy - 5, cx + 8, cy + 5], [cx - 1, cy - 3, 8, 6], HOUND, { edge: HOUND[0] }), 4, cy + 3, 3, 0.4, ell(cx - 2, cy - 1, 4, 2.5)));
  // the nose, teeth, eye and brow
  parts.push(dots([['k', [[cx - 8, cy - 1], [cx - 8, cy], [cx - 7, cy - 1]]], ['W', [[cx - 7, cy - 2]]]], { pal: HOUND_PAL }));
  if (open) parts.push(dots([['t', [[cx - 6, cy + 2], [cx - 3, cy + 2], [cx - 5, cy + 2 + open]]], ['r', [[cx - 4, cy + 3 + Math.floor(open / 2)], [cx - 3, cy + 3 + Math.floor(open / 2)]]]], { pal: HOUND_PAL }));
  else if (!o.stick) parts.push(dots([['t', [[cx - 5, cy + 3]]], ['k', [[cx - 6, cy + 2], [cx - 4, cy + 2], [cx - 3, cy + 2], [cx - 2, cy + 3]]]], { pal: HOUND_PAL }));
  if (o.shut) parts.push([['qqq'], cx - 3, cy - 1, { pal: HOT }]);
  else if (o.scowl) parts.push([['kkkk', '.XZk'], cx - 4, cy - 3, { pal: HOT }]);
  else parts.push([['.k.', 'XZX'], cx - 4, cy - 2, { pal: HOT }]); // Nob's happy look
  // the near ear: Hob's pricked up, Nob's flopping
  parts.push(o.scowl ? [['..44', '.443', '432.'], cx + 3, cy - 8 - (o.ear ?? 0), { pal: digits(HOUND), edge: HOUND[0] }] : [['4433.', '.3332', '..22.'], cx + 3, cy - 4 - (o.ear ?? 0), { pal: digits(HOUND), edge: HOUND[0] }]);
  if (o.stick) parts.push([['vwwwwwwwwwv', 'VvvvvvvvvvV'], cx - 10, cy + 2, { pal: HOUND_PAL, edge: WOOD[0] }]);
  return parts;
}

/** A collar of glowing chain round a neck (an arc of links from (x0, y0) to (x1, y1), sagging `sag`). */
function chainCollar(x0: number, y0: number, x1: number, y1: number, sag: number, spiked: boolean): Part[] {
  const pts: Record<string, [number, number][]> = { X: [], x: [], q: [], 3: [], 5: [] };
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
    const link = i % 3;
    pts[link === 0 ? 'X' : link === 1 ? 'x' : 'q'].push([x, y]);
    if (link === 1) pts.x.push([x, y + 1]);
    if (spiked && i % 3 === 0 && i > 0 && i < n) {
      pts['5'].push([x, y - 1]);
      pts['3'].push([x, y - 2]);
    }
  }
  return [dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: { ...HOT, ...digits(STEEL) } })];
}

function hobnobParts(pose: string): Part[] {
  const F = 47;
  let bx = 0;
  let by = 0;
  let hob: [number, number] = [21, 13]; // Hob's head (behind, higher)
  let nob: [number, number] = [11, 25]; // Nob's head (in front, lower)
  let hobO: DogHead = { scowl: true };
  let nobO: DogHead = { stick: true };
  let paw = 0;
  let tail = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hob = [21, 14];
      nob = [11, 26];
      tail = 1;
      break;
    case 'windup':
      bx = 3;
      hob = [25, 10];
      nob = [15, 22];
      hobO = { scowl: true, ear: 1 };
      nobO = { stick: true, ear: 1 };
      paw = 2;
      tail = 2;
      break;
    case 'attack':
      // Double Bite!: both heads lunge, jaws wide (the stick goes flying)
      bx = -4;
      by = 1;
      hob = [14, 15];
      nob = [5, 28];
      hobO = { scowl: true, open: 4 };
      nobO = { open: 4 };
      extra.push([['vwwwwv'], 0, 14, { pal: HOUND_PAL, edge: WOOD[0] }]);
      tail = 1;
      break;
    case 'hurt':
      bx = 3;
      hob = [24, 13];
      nob = [14, 25];
      hobO = { scowl: true, shut: true };
      nobO = { shut: true, stick: true };
      extra.push(dots([['S', [[40, 8], [52, 14], [30, 6]]]], { pal: HOT, late: true }));
      break;
    case 'tell':
      // Fetch! / Two Heads!: both heads up, barking
      by = -1;
      hob = [21, 9];
      nob = [10, 21];
      hobO = { scowl: true, open: 3, ear: 1 };
      nobO = { open: 3, ear: 2 };
      tail = 2;
      extra.push(dots([['W', [[2, 14], [0, 16], [8, 4], [6, 2]]]], { pal: HOT, late: true }));
      break;
    case 'guard':
      // Squabble!: the heads snarl at everything, hackles up, the cracks blazing
      hob = [20, 12];
      nob = [9, 26];
      hobO = { scowl: true, open: 2 };
      nobO = { scowl: true, open: 2 };
      paw = 0;
      extra.push(sparks([[40, 10], [46, 12], [34, 9], [52, 15], [28, 11]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const hot = pose === 'guard' ? 0.75 : 0.4;
  const body = anyOf(ell(X(40), Y(28), 17, 9.5), ell(X(26), Y(28), 9, 10.5));
  const leg = (x: number, footX: number, lift: number, far: boolean): Part[] => [
    shadedLimb(x, Y(33), footX, F - 3 - lift, far ? 2.6 : 3.2, far ? 2.2 : 2.6, far ? HOUND.map((_, i) => HOUND[Math.max(0, i - 1)]) : HOUND),
    [['.kk.k', 'kkkkk'], Math.round(footX) - 3, F - 1 - lift, { pal: { k: far ? HOUND[1] : HOUND[2] } }],
  ];
  const H = (p: [number, number]): [number, number] => [X(p[0]), Y(p[1])];
  const [hx, hy] = H(hob);
  const [nx, ny] = H(nob);
  return [
    // the tail: up and curling, a flame on its tip
    sweep((t) => [X(56) + t * 6, Y(24) - t * 10 + Math.sin(t * 3) * 2 - tail * t * 2], (t) => 2.4 - t * 1.4, (_, side) => (side < 0 ? '3' : '2'), 30, { pal: digits(HOUND), edge: HOUND[0] }),
    flame(X(62), Y(14) - tail * 2, 6, 4, tail),
    ...leg(X(30), X(30), 0, true),
    ...leg(X(52), X(53), 0, true),
    // Hob's neck (behind) and head
    shadedLimb(X(28), Y(24), hx + 2, hy + 3, 5, 4, HOUND.map((_, i) => HOUND[Math.max(0, i - 1)])),
    ...dogHead(hx, hy, hobO),
    ...chainCollar(hx - 1, hy + 5, hx + 7, hy + 5, 2, true),
    crackle(shag(body, [X(16), Y(17), X(58), Y(38)], [X(32), Y(21), 22, 14], HOUND, 13, { edge: HOUND[0] }), 6, 11, 3, hot),
    ...leg(X(24), X(22) - paw, paw, false),
    ...leg(X(47), X(48), 0, false),
    // Nob's neck and head (in front)
    shadedLimb(X(24), Y(25), nx + 2, ny + 2, 5, 4.4, HOUND),
    ...dogHead(nx, ny, nobO),
    ...chainCollar(nx - 1, ny + 5, nx + 8, ny + 4, 2, false),
    ...extra,
  ];
}

// ------------------------------------------------------------------ stoker imp (a little ember-red imp with a coal shovel)

// ember-red skin: wine shadows, a hot coral in the light
const IMPRED = ['#2a0a12', '#5a1420', '#8e2226', '#c4342c', '#ea5e3a', '#ff9e6a'];
const HORN = ['#0e0a10', '#1e1820', '#34282c', '#4e3c38'];
const STOKER_PAL: Pal = { ...HOT, t: '#fff4dc', m: '#2a0610', y: '#ffd040' };

/** The coal shovel: a long wooden haft from the grip at (hx, hy) toward `ang`, an iron blade heaped with coals. */
function coalShovel(hx: number, hy: number, ang: number, heap: number): Part[] {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const vx = -uy;
  const vy = ux;
  const P = (u: number, v: number): [number, number] => [Math.round(hx + ux * u + vx * v), Math.round(hy + uy * u + vy * v)];
  const blade: Record<string, [number, number][]> = { 1: [], 2: [], 3: [], 4: [] };
  const coals: Record<string, [number, number][]> = { Q: [], q: [], x: [], X: [], 1: [] };
  for (let u = 15; u <= 23; u += 0.5)
    for (let v = -4; v <= 4; v += 0.5) {
      const half = 4 - Math.max(0, u - 21) * 1.4;
      if (Math.abs(v) > half) continue;
      blade[u < 15.6 ? 1 : Math.abs(v) > half - 0.6 ? (v < 0 ? 4 : 1) : v < 0 ? 3 : 2].push(P(u, v));
    }
  // coals heaped on the blade's upper face (the side facing up)
  const up = vx * -0.3 + vy * -1 > 0 ? 1 : -1;
  for (let u = 16; u <= 22; u += 0.5)
    for (let w = -1; w <= heap; w += 0.5) {
      if (w > heap - Math.abs(u - 19) * 0.6) continue;
      const [cx, cy] = P(u, up * (3 + w));
      const k = hash2(cx * 3, cy * 5);
      coals[k > 0.75 ? 'X' : k > 0.45 ? 'x' : k > 0.2 ? 'q' : '1'].push([cx, cy]);
    }
  return [
    line(...P(-5, 0), ...P(15, 0), '3', { pal: digits(WOOD) }),
    line(...P(-5, 0.8), ...P(15, 0.8), '1', { pal: digits(WOOD) }),
    dots(Object.entries(blade).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: digits(STEEL), edge: STEEL[0] }),
    ...(heap ? [dots(Object.entries(coals).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: { ...HOT, 1: COAL[2] } })] : []),
  ];
}

function stokerParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let hand: [number, number] = [9, 18];
  let ang = (-70 * Math.PI) / 180; // the shovel from the hand: blade up over the shoulder
  let heap = 2;
  let eyes = ['XyXy'];
  let mouth = ['mtmtm'];
  let smokeH = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hand = [9, 19];
      smokeH = 1;
      break;
    case 'windup':
      // the shovel hauled back, coals and all
      bx = 2;
      hand = [16, 12];
      ang = (-25 * Math.PI) / 180;
      smokeH = 2;
      break;
    case 'attack':
      // swung forward: the coals fly at the hero
      bx = -3;
      by = 1;
      hand = [8, 15];
      ang = (-138 * Math.PI) / 180;
      heap = 0;
      mouth = ['mmmmm'];
      extra.push(sparks([[-10, 4], [-9, 8], [-7, 1], [-10, 0]]), dots([['x', [[-8, 5], [-6, 3]]], ['X', [[-9, 2]]]], { pal: HOT, late: true }));
      break;
    case 'hurt':
      bx = 2;
      eyes = ['qq.qq'];
      mouth = ['.mmm.'];
      hand = [11, 19];
      ang = (-60 * Math.PI) / 180;
      heap = 1;
      break;
    case 'tell':
      // Stoke!: the shovel held high, the coals roaring, horns smoking hard
      by = -1;
      hand = [10, 12];
      ang = (-95 * Math.PI) / 180;
      heap = 3;
      smokeH = 3;
      eyes = ['ZXZX'];
      extra.push(flame(10, -4, 7, 5, 1), flame(7, -2, 5, 3, 2));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const body = anyOf(ell(X(15), Y(20), 5.5, 5.5), ell(X(14), Y(11), 5.5, 5));
  const back = pose === 'windup';
  const shov = coalShovel(hand[0] + bx, hand[1] + by, ang, heap);
  return [
    ...(back ? shov : []),
    // the tail with its spade tip
    sweep((t) => [X(20) + t * 7, Y(24) - Math.sin(t * 3) * 4], () => 0.7, () => '3', 30, { pal: digits(IMPRED) }),
    [['.4.', '434', '.3.'], X(26), Y(18), { pal: digits(IMPRED) }],
    // legs, hooves
    capsule(X(13), Y(24), X(12), Y(28), 1.5, 1.4, '2', { pal: digits(IMPRED) }),
    capsule(X(17), Y(24), X(18), Y(28), 1.5, 1.4, '2', { pal: digits(IMPRED) }),
    [['111', '222'], X(10), Y(28), { pal: digits(HORN) }],
    [['111', '222'], X(17), Y(28), { pal: digits(HORN) }],
    vol(body, [X(8), Y(5), X(21), Y(26)], [X(12), Y(9), 7, 8], IMPRED, { edge: IMPRED[0] }),
    // curled black horns, smoke curling off their tips
    sweep((t) => [X(10) - Math.sin(t * 2) * 3, Y(7) - t * 5], (t) => 1.3 - t * 0.9, (_, side) => (side < 0 ? '3' : '1'), 20, { pal: digits(HORN), edge: HORN[0] }),
    sweep((t) => [X(16) + Math.sin(t * 2) * 2, Y(6) - t * 5], (t) => 1.3 - t * 0.9, (_, side) => (side < 0 ? '2' : '1'), 20, { pal: digits(HORN), edge: HORN[0] }),
    puff(X(7), Y(0) - smokeH, 1, true),
    puff(X(18) + (smokeH % 2), Y(-1) - smokeH, 1, true),
    // a pointed ear, eyes, a toothy grin
    [['.55', '43.'], X(18), Y(9), { pal: digits(IMPRED) }],
    [eyes, X(9), Y(10), { pal: STOKER_PAL }],
    [mouth, X(9), Y(13), { pal: STOKER_PAL }],
    ...(back ? [] : shov),
    [['44', '33'], hand[0] + bx - 1, hand[1] + by - 1, { pal: digits(IMPRED) }],
    ...extra,
  ];
}

// ------------------------------------------------------------------ magma eel (a long eel of cooling lava rising from a channel)

const CRUST = ['#0c0810', '#1e1418', '#30201e', '#463024', '#62442c', '#80603a'];
const EEL_PAL: Pal = { ...HOT };

function eelParts(pose: string): Part[] {
  let head: [number, number] = [9, 9];
  let mid: [number, number] = [24, 18]; // where the body bends
  let open = 1;
  let eye = 'XZ';
  let splash = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      head = [10, 10];
      mid = [25, 19];
      splash = 1;
      break;
    case 'windup':
      // drawn back, coiled to strike
      head = [17, 5];
      mid = [28, 15];
      open = 2;
      splash = 1;
      break;
    case 'attack':
      // the strike: lunging forward and down, jaws wide
      head = [1, 17];
      mid = [18, 22];
      open = 4;
      splash = 2;
      break;
    case 'hurt':
      head = [14, 9];
      mid = [26, 18];
      open = 0;
      eye = 'qq';
      break;
    case 'tell':
      // Undertow!: reared up high, the lava under it churning and turning back
      head = [11, 2];
      mid = [26, 14];
      open = 3;
      splash = 3;
      extra.push(sparks([[4, 36], [26, 33], [8, 33], [30, 37], [16, 31]]));
      break;
  }
  const F = 41;
  const [hx, hy] = head;
  // the body: from the lava channel up through a bend to the head
  const path = bezier([
    [20, F - 3],
    [mid[0] + 6, mid[1] + 6],
    [mid[0] - 4, mid[1] - 4],
    [hx + 6, hy + 2],
  ]);
  const body = sweep(
    path,
    (t) => 4.2 - t * 1.4,
    (t, side, lit) => {
      // the glowing belly on the underside, crust plates on the back with hot seams between them
      if (side > 0.55) return t % 0.12 < 0.03 ? 'x' : 'X';
      if (side > 0.3) return 'q';
      const plate = Math.floor(t * 16) % 2;
      if (Math.abs((t * 16) % 1) < 0.12 && side > -0.7) return 'x';
      return lit > 0.45 ? '4' : lit > 0 ? (plate ? '3' : '4') : lit > -0.4 ? '2' : '1';
    },
    120,
    { pal: { ...digits(CRUST), ...HOT }, edge: CRUST[0] },
  );
  // spines of crust along its back
  const spines: Part[] = [];
  for (const t of [0.35, 0.5, 0.65, 0.8]) {
    const [x, y] = path(t);
    const [x2, y2] = path(t + 0.01);
    const a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
    const px = Math.round(x + Math.cos(a) * 4);
    const py = Math.round(y + Math.sin(a) * 4);
    spines.push(dots([['3', [[px, py]]], ['2', [[px + Math.round(Math.cos(a)), py + Math.round(Math.sin(a))]]]], { pal: digits(CRUST), edge: CRUST[0] }));
  }
  // the head: blunt, a gaping jaw glowing inside
  const skull = anyOf(ell(hx + 4, hy + 2, 5, 3.6), poly([[hx - 2, hy + 1], [hx + 2, hy - 1], [hx + 6, hy + 1], [hx + 4, hy + 4], [hx - 1, hy + 3]]));
  const jaw = poly([[hx - 1, hy + 3 + open * 0.5], [hx + 5, hy + 3], [hx + 7, hy + 6], [hx, hy + 5 + open]]);
  const gape: [number, number][] = [];
  for (let x = hx - 1; x <= hx + 5; x++) for (let y = hy + 3; y <= hy + 3 + Math.round(open * ((x - hx + 2) / 7)); y++) gape.push([x, y]);
  // the lava channel it rises from: a molten pool with a crusted rim
  const pool: Part = (() => {
    const pts: Record<string, [number, number][]> = { 1: [], 3: [], Q: [], q: [], x: [], X: [], Z: [] };
    for (let y = F - 5; y <= F; y++)
      for (let x = 1; x <= 31; x++) {
        const d = ((x + 0.5 - 16) / 15) ** 2 + ((y + 0.5 - (F - 2)) / 3.4) ** 2;
        if (d > 1) continue;
        if (d > 0.72) pts[y < F - 2 ? '3' : '1'].push([x, y]);
        else {
          const w = Math.sin(x * 0.7 + y * 1.3 + splash * 1.7);
          pts[w > 0.6 ? 'Z' : w > 0 ? 'X' : w > -0.6 ? 'x' : 'q'].push([x, y]);
        }
      }
    return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: { ...digits(CRUST), ...HOT }, edge: CRUST[0] });
  })();
  return [
    pool,
    body,
    ...spines,
    dots([['Q', gape]], { pal: HOT }),
    crackle(vol(jaw, [hx - 2, hy + 2, hx + 8, hy + 7 + open], [hx + 2, hy + 3, 5, 3], CRUST, { edge: CRUST[0] }), 3, 4, 3, 0.4),
    crackle(vol(skull, [hx - 3, hy - 3, hx + 10, hy + 6], [hx + 2, hy - 1, 7, 5], CRUST, { edge: CRUST[0] }), 3, 2, 3, 0.45, ell(hx + 1, hy + 1, 2.5, 2)),
    [[eye], hx + 1, hy, { pal: HOT }],
    ...(open ? [dots([['x', [[hx + 1, hy + 4], [hx + 2, hy + 4]]], ['X', [[hx + 1, hy + 3 + open - 1]]]], { pal: HOT })] : []),
    // drops of lava flung up round it
    ...(splash ? [dots([['x', [[6, F - 6 - splash], [27, F - 7 - splash]]], ['X', [[9, F - 8 - splash * 2]]]], { pal: HOT, late: true })] : []),
    ...extra,
  ];
}

// ------------------------------------------------------------------ forge hand (a stocky soot-faced forge worker)

const SKIN = ['#3a1a16', '#6a3426', '#9e5a3c', '#c88058', '#e8a878'];
const SOOTY = ['#1a1416', '#2e2628', '#46383a'];
const FORGEHAND_PAL: Pal = { ...HOT, k: INK, h: SOOTY[1], H: SOOTY[2], e: '#fff4dc', b: '#4a2c20' };

/** The welding mask: pushed up on the forehead (`down` false) or flipped down over the face. */
function weldMask(x: number, y: number, down: boolean): Part {
  return down ? [['.2222.', '233332', '2kkkk2', '2kXXk2', '233332', '.2222.'], x, y, { pal: { ...digits(STEEL), ...HOT }, edge: STEEL[0] }] : [['.2222.', '233442', '2kkkk2', '.2222.'], x, y, { pal: { ...digits(STEEL), ...HOT }, edge: STEEL[0] }];
}

function forgeHandParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let hammer: [number, number] = [5, 21]; // near fist
  let hAng = (95 * Math.PI) / 180; // the hammer's haft from the fist
  let tongs: [number, number] = [25, 21]; // far fist
  let mask = false;
  let eyes = ['ek.ek'];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hammer = [5, 22];
      tongs = [25, 22];
      break;
    case 'windup':
      bx = 2;
      hammer = [13, 6];
      hAng = (-60 * Math.PI) / 180;
      break;
    case 'attack':
      // the hammer brought down: sparks off the hot bar
      bx = -2;
      by = 1;
      hammer = [2, 18];
      hAng = (170 * Math.PI) / 180;
      tongs = [16, 22];
      extra.push(sparks([[-4, 14], [-6, 18], [-2, 12], [-7, 15], [0, 11]]));
      break;
    case 'hurt':
      bx = 2;
      eyes = ['kk.kk'];
      hammer = [7, 22];
      break;
    case 'tell':
      // Weld!: the mask flipped down, the bar held up in the tongs, the hammer raised over it, sparks spitting
      by = -1;
      mask = true;
      hammer = [12, 4];
      hAng = (-80 * Math.PI) / 180;
      tongs = [8, 14];
      extra.push(sparks([[3, 9], [1, 12], [6, 8], [0, 7]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const torso = anyOf(ell(X(16), Y(20), 8, 7), ell(X(16), Y(15), 7, 4));
  const head = ell(X(13), Y(8), 5, 5);
  const ux = Math.cos(hAng);
  const uy = Math.sin(hAng);
  const hamX = hammer[0] + bx;
  const hamY = hammer[1] + by;
  const hammerParts: Part[] = [
    line(Math.round(hamX - ux * 2), Math.round(hamY - uy * 2), Math.round(hamX + ux * 9), Math.round(hamY + uy * 9), '3', { pal: digits(WOOD) }),
    // the head of the hammer across the haft's end
    shadedLimb(hamX + ux * 9 - uy * 3, hamY + uy * 9 + ux * 3, hamX + ux * 9 + uy * 3, hamY + uy * 9 - ux * 3, 1.8, 1.8, STEEL),
  ];
  const tx = tongs[0] + bx;
  const ty = tongs[1] + by;
  const back = pose === 'windup' || pose === 'tell';
  return [
    ...(back ? hammerParts : []),
    // the tongs and the glowing bar they hold
    line(tx, ty, tx - 6, ty + 3, '3', { pal: digits(STEEL) }),
    line(tx, ty + 1, tx - 6, ty + 4, '2', { pal: digits(STEEL) }),
    [['ZXXxq'], tx - 11, ty + 3, { pal: HOT }],
    shadedLimb(X(22), Y(15), tx, ty, 2.6, 2.2, SKIN.map((_, i) => SKIN[Math.max(0, i - 1)])),
    // stocky legs in boots
    capsule(X(13), Y(26), X(12), Y(31), 2.2, 2, '2', { pal: digits(LEATHER) }),
    capsule(X(19), Y(26), X(20), Y(31), 2.2, 2, '1', { pal: digits(LEATHER) }),
    [['11111', '22222'], X(9), Y(31), { pal: digits(SOOTY) }],
    [['11111', '22222'], X(18), Y(31), { pal: digits(SOOTY) }],
    vol(torso, [X(7), Y(10), X(25), Y(28)], [X(13), Y(14), 9, 9], SKIN, { edge: SKIN[0] }),
    // the scorched leather apron
    vol(poly([[X(10), Y(14)], [X(21), Y(14)], [X(23), Y(28)], [X(9), Y(28)]]), [X(8), Y(13), X(24), Y(29)], [X(13), Y(15), 8, 10], LEATHER, { edge: LEATHER[0] }),
    dots([['Q', [[X(11), Y(27)], [X(16), Y(27)], [X(20), Y(27)]]], ['h', [[X(12), Y(20)], [X(13), Y(21)], [X(19), Y(18)]]]], { pal: FORGEHAND_PAL }),
    vol(head, [X(7), Y(2), X(19), Y(14)], [X(11), Y(5), 6, 6], SKIN, { edge: SKIN[0] }),
    // soot smudges, a bristly jaw, the eyes (white in the grime)
    dots([['h', [[X(10), Y(11)], [X(11), Y(12)], [X(12), Y(12)], [X(13), Y(12)], [X(14), Y(12)], [X(9), Y(10)]]], ['H', [[X(16), Y(6)], [X(9), Y(6)]]]], { pal: FORGEHAND_PAL }),
    // cropped dark hair, an ear, a short beard, a broad nose
    [['..hhhh', '.hhhhhh', 'hhhhhhh', '...hhhh', '....hhh'], X(12), Y(3), { pal: FORGEHAND_PAL }],
    [['32', '21'], X(15), Y(8), { pal: digits(SKIN) }],
    [eyes, X(8), Y(7), { pal: FORGEHAND_PAL }],
    [['4', '3'], X(8), Y(8), { pal: digits(SKIN) }],
    [['bbbbbbb', '.bbbbb.', '..bbb..'], X(8), Y(11), { pal: FORGEHAND_PAL }],
    [['QQQQ'], X(9), Y(11), { pal: { Q: '#3a1e14' } }],
    weldMask(mask ? X(7) : X(9), mask ? Y(5) : Y(1), mask),
    ...(back ? [] : hammerParts),
    shadedLimb(X(10), Y(15), hamX, hamY, 2.8, 2.4, SKIN),
    [['.44', '433', '33.'], hamX - 1, hamY - 1, { pal: digits(SKIN) }],
    ...extra,
  ];
}

// ------------------------------------------------------------------ chain sentinel (elite: an empty suit of chain, a glowing eye slit)

const MAIL = ['#1a1c28', '#2e3244', '#4a5068', '#727a94', '#a4acc4', '#dce2f0'];
const SENTINEL_PAL: Pal = { ...HOT, v: '#06040a' };

/** Mail rings over a shaded form: a staggered grid of little loops, a dark gap in each ring. */
function ringed(p: Part): Part {
  const [rows, ox, oy] = p;
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        const rx = (gx + (Math.floor(gy / 2) % 2)) % 2;
        if (gy % 2 === 0 && rx === 0) return String(Math.max(1, +c - 2)); // the hole in the ring
        if (gy % 2 === 1 && rx === 1) return String(Math.min(5, +c + 1)); // the lit rim
        return c;
      })
      .join(''),
  );
  return [out, ox, oy, p[3]];
}

/** A chain from (x0, y0) along a path, links alternating face-on and edge-on; a spiked iron ball at its end. */
function flail(path: (t: number) => [number, number], ball: boolean, hot: boolean): Part[] {
  const pts: Record<string, [number, number][]> = { 2: [], 4: [], 5: [] };
  const [ex, ey] = path(1);
  for (let i = 0; i <= 14; i++) {
    const [x, y] = path(i / 14);
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (i % 2) {
      pts['4'].push([rx, ry]);
      pts['2'].push([rx + 1, ry]);
    } else pts['5'].push([rx, ry]);
  }
  const out: Part[] = [dots(Object.entries(pts) as [string, [number, number][]][], { pal: digits(MAIL), edge: MAIL[0] })];
  if (ball) {
    out.push(vol(ell(ex, ey, 3.2, 3.2), [Math.floor(ex) - 4, Math.floor(ey) - 4, Math.ceil(ex) + 4, Math.ceil(ey) + 4], [ex - 1, ey - 1, 4, 4], IRON, { edge: IRON[0] }));
    out.push(dots([['4', [[Math.round(ex), Math.round(ey) - 4], [Math.round(ex) - 4, Math.round(ey)], [Math.round(ex) + 4, Math.round(ey)], [Math.round(ex), Math.round(ey) + 4]]]], { pal: digits(IRON), edge: IRON[0] }));
    if (hot) out.push(dots([['X', [[Math.round(ex) - 1, Math.round(ey) - 1]]], ['x', [[Math.round(ex), Math.round(ey) - 1], [Math.round(ex) - 1, Math.round(ey)]]]], { pal: HOT }));
  }
  return out;
}

function sentinelParts(pose: string): Part[] {
  const F = 43;
  let bx = 0;
  let by = 0;
  let fist: [number, number] = [7, 27];
  let chain: (fx: number, fy: number) => (t: number) => [number, number] = (fx, fy) => (t) => [fx - 1 - t * 3, fy + 2 + t * 9];
  let slit = 'XZXZX';
  let hot = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      fist = [7, 28];
      chain = (fx, fy) => (t) => [fx - 1 - t * 2, fy + 2 + t * 9];
      slit = 'xXZXx';
      break;
    case 'windup':
      // the flail swung back over the shoulder
      bx = 2;
      fist = [14, 12];
      chain = (fx, fy) => (t) => [fx + 2 + t * 12, fy - 2 - Math.sin(t * Math.PI) * 4 + t * 2];
      break;
    case 'attack':
      // Chain Lash!: the chain lashes straight out at the hero
      bx = -3;
      by = 1;
      fist = [4, 22];
      chain = (fx, fy) => (t) => [fx - 1 - t * 17, fy + Math.sin(t * Math.PI) * -2 + t * 3];
      hot = true;
      break;
    case 'hurt':
      bx = 2;
      fist = [9, 28];
      slit = 'qQqQq';
      extra.push(dots([['5', [[30, 14], [8, 10], [27, 30]]]], { pal: digits(MAIL), late: true }));
      break;
    case 'tell':
      // Shackle!: the flail whirled overhead in a glowing ring
      by = -1;
      fist = [12, 5];
      chain = (fx, fy) => (t) => [fx + Math.cos(t * Math.PI * 1.6 + 2) * 9, fy - 4 + Math.sin(t * Math.PI * 1.6 + 2) * 4];
      hot = true;
      slit = 'ZZZZZ';
      extra.push(sparks([[2, 0], [22, -2], [6, -6], [18, 4]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const torso = anyOf(ell(X(18), Y(22), 9, 8), ell(X(18), Y(16), 10, 5));
  const fx = fist[0] + bx;
  const fy = fist[1] + by;
  const back = pose === 'windup' || pose === 'tell';
  const fl = flail(chain(fx, fy), true, hot);
  return [
    ...(back ? fl : []),
    // the far arm, legs
    ringed(shadedLimb(X(26), Y(16), X(30), Y(28), 2.8, 2.4, MAIL.map((_, i) => MAIL[Math.max(0, i - 1)]))),
    [['.22.', '2332', '2222'], X(28), Y(28), { pal: digits(IRON) }],
    ringed(shadedLimb(X(21), Y(29), X(23), F - 3, 3, 2.6, MAIL.map((_, i) => MAIL[Math.max(0, i - 1)]))),
    ringed(shadedLimb(X(14), Y(29), X(13), F - 3, 3.2, 2.8, MAIL)),
    [['2222222', '1111111'], X(9), F - 2, { pal: digits(IRON) }],
    [['222222', '111111'], X(20), F - 2, { pal: digits(IRON) }],
    // the hauberk, a dark gap at the waist showing it's empty inside
    ringed(vol(torso, [X(7), Y(10), X(29), Y(31)], [X(14), Y(14), 11, 10], MAIL, { edge: MAIL[0] })),
    dots([['v', [[X(12), Y(30)], [X(13), Y(30)], [X(16), Y(31)], [X(17), Y(31)], [X(20), Y(30)], [X(23), Y(30)]]]], { pal: SENTINEL_PAL }),
    // iron pauldrons, the great helm with its glowing slit
    vol(ell(X(26), Y(13), 4.5, 3.4), [X(21), Y(9), X(31), Y(17)], [X(24), Y(11), 5, 4], IRON, { edge: IRON[0] }),
    vol(poly([[X(10), Y(2)], [X(20), Y(2)], [X(21), Y(12)], [X(9), Y(12)]]), [X(8), Y(1), X(22), Y(13)], [X(12), Y(3), 7, 7], IRON, { edge: IRON[0] }),
    [['44444444444', '.3.......2.'], X(9), Y(1), { pal: digits(IRON) }],
    [['vvvvvvv', 'v' + slit + 'v', 'vvvvvvv'], X(9), Y(5), { pal: SENTINEL_PAL }],
    dots([['3', [[X(14), Y(9)], [X(14), Y(10)], [X(12), Y(9)], [X(16), Y(9)]]]], { pal: digits(IRON) }),
    vol(ell(X(11), Y(14), 4.5, 3.4), [X(6), Y(10), X(16), Y(18)], [X(9), Y(12), 5, 4], IRON, { edge: IRON[0] }),
    // the near arm and its fist round the flail's haft
    ringed(shadedLimb(X(11), Y(16), fx, fy, 3, 2.6, MAIL)),
    [['.33.', '3443', '3333'], fx - 2, fy - 1, { pal: digits(IRON), edge: IRON[0] }],
    ...(back ? [] : fl),
    ...extra,
  ];
}

// ------------------------------------------------------------------ bellows (the boss: a giant old smith of basalt and fire)

// his basalt hide: cool violet-grey shadows, warm grey where the forge light falls
const TITAN = ['#141218', '#26222c', '#3a3540', '#524c58', '#6e6672', '#958c96'];
// a beard of grey ash: blue-grey shadows, near-white tips
const ASHBEARD = ['#2a2630', '#46424c', '#6a666e', '#928e96', '#bcb8be', '#e6e2e4'];
// the soot-black apron
const APRON = ['#0c0a0e', '#18141a', '#241e24', '#342a2e', '#4a3c3c'];
const BELLOWS_PAL: Pal = { ...HOT, n: '#0a080c', c: BRASS[2], C: BRASS[4], b: BRASS[1], y: BRASS[3] };

/**
 * A run of chain links along a path (t 0..1), `n` links: face-on rings (a dark eye in the middle) and edge-on bars in
 * turn, `r` the rings' size. `heat` 0 cold iron with a glint, 1 glowing orange, 2 yellow-hot.
 */
function chainLinks(path: (t: number) => [number, number], n: number, heat: number, r = 1): Part {
  const pts: Record<string, [number, number][]> = {};
  const add = (ch: string, x: number, y: number) => (pts[ch] ??= []).push([Math.round(x), Math.round(y)]);
  const [lit, mid, dim] = heat >= 2 ? ['Z', 'X', 'x'] : heat >= 1 ? ['X', 'x', 'q'] : ['5', '3', '2'];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const [x, y] = path(t);
    const [x2, y2] = path(Math.min(1, t + 0.01));
    const [x1, y1] = path(Math.max(0, t - 0.01));
    const a = Math.atan2(y2 - y1, x2 - x1);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    if (i % 2 === 0) {
      // a ring seen face on: an oval along the chain, its middle dark
      const k = Math.round(8 * r);
      for (let j = 0; j < k; j++) {
        const th = (j / k) * Math.PI * 2;
        const px = x + Math.cos(th) * 1.8 * r * ux - Math.sin(th) * 1.2 * r * uy;
        const py = y + Math.cos(th) * 1.8 * r * uy + Math.sin(th) * 1.2 * r * ux;
        add(py < y - 0.3 || px < x - 0.8 ? lit : py > y + 0.3 ? dim : mid, px, py);
      }
      add('n', x, y);
      if (r > 1.2) add('n', x + ux, y + uy);
    } else {
      // a ring edge on: a short bar across the gap
      for (let d = -r; d <= r; d += 1) add(d < 0 ? lit : mid, x + ux * d, y + uy * d);
    }
  }
  return dots(Object.entries(pts) as [string, [number, number][]][], { pal: { ...BELLOWS_PAL, ...digits(IRON) }, edge: INK });
}

/** The great hammer: a haft from the fist (hx, hy) toward `ang`, a block of a head the size of a door at its end. */
function titanHammer(hx: number, hy: number, ang: number, len: number, phase: number): Part[] {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const vx = -uy;
  const vy = ux;
  const ex = hx + ux * len;
  const ey = hy + uy * len;
  const HW = 8; // half the head's width (across the haft)
  const HL = 11; // the head's depth (along the haft)
  const head = poly([
    [ex + vx * HW - ux, ey + vy * HW - uy],
    [ex + vx * HW + ux * HL, ey + vy * HW + uy * HL],
    [ex - vx * HW + ux * HL, ey - vy * HW + uy * HL],
    [ex - vx * HW - ux, ey - vy * HW - uy],
  ]);
  const xs = [ex + vx * (HW + 1), ex - vx * (HW + 1), ex + vx * (HW + 1) + ux * (HL + 1), ex - vx * (HW + 1) + ux * (HL + 1)];
  const ys = [ey + vy * (HW + 1), ey - vy * (HW + 1), ey + vy * (HW + 1) + uy * (HL + 1), ey - vy * (HW + 1) + uy * (HL + 1)];
  const box: [number, number, number, number] = [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))];
  const h = vol(head, box, [box[0] + 4, box[1] + 3, 12, 12], IRON, { edge: IRON[0] });
  // bands of brass round the head; in the eruption its striking faces glow
  const rows = h[0].map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c === '.') return c;
        const gx = x + box[0] + 0.5 - ex;
        const gy = y + box[1] + 0.5 - ey;
        const u = gx * ux + gy * uy;
        const v = Math.abs(gx * vx + gy * vy);
        if ((u > 1.5 && u < 3.2) || (u > 7.5 && u < 9.2)) return c >= '4' ? 'y' : c >= '3' ? 'c' : 'b';
        if (phase >= 3 && v > HW - 1.6) return v > HW - 0.8 ? 'X' : 'x';
        return c;
      })
      .join(''),
  );
  return [
    shadedLimb(hx - ux * 5, hy - uy * 5, ex + ux, ey + uy, 1.8, 1.8, WOOD),
    [rows, box[0], box[1], { pal: { ...digits(IRON), ...BELLOWS_PAL }, edge: IRON[0] }],
  ];
}

/** Coarse mail-like texture for the heap of chain: a staggered grid of rings, each with a dark eye. */
function chainHeap(p: Part, heat: number): Part {
  const [rows, ox, oy] = p;
  const [lit, mid, dim] = heat >= 2 ? ['Z', 'X', 'x'] : heat >= 1 ? ['X', 'x', 'q'] : ['', '', ''];
  const out = rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[0-9]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        const row = Math.floor(gy / 3);
        const cx = (gx + (row % 2) * 2) % 4;
        const cy = gy % 3;
        if (cx === 1 && cy === 1) return 'n'; // a ring's eye
        if (cy === 0 && cx !== 3) return heat ? (+c >= 4 ? lit : mid) : String(Math.min(5, +c + 1)); // its lit top
        if (cx === 3) return heat ? dim : String(Math.max(1, +c - 1));
        return heat ? (+c >= 3 ? mid : dim) : c;
      })
      .join(''),
  );
  return [out, ox, oy, { ...p[3], pal: { ...digits(IRON), ...BELLOWS_PAL } }];
}

function bellowsParts(pose: string, phase: number): Part[] {
  const F = 69;
  let bx = 0;
  let by = 0;
  let hx = 0; // head
  let hy = 0;
  let fist: [number, number] = [22, 44]; // near fist (the hammer)
  let ang = (118 * Math.PI) / 180; // the hammer from the fist: resting head down beside the anvil
  let farFist: [number, number] = [72, 47];
  let glow = 1; // the chest furnace: 0 dim, 1 burning, 2 roaring open
  let eyes = 'open';
  let mouth = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      // the bellows huff: the chest sinks, the furnace dims
      by = 1;
      hy = 1;
      glow = 0;
      fist = [22, 45];
      farFist = [72, 48];
      break;
    case 'windup':
      // the hammer heaved back over his shoulder
      bx = 2;
      hx = 3;
      hy = -1;
      fist = [44, 14];
      ang = (-25 * Math.PI) / 180;
      break;
    case 'attack':
      // Hammerfall!: brought down on the anvil, sparks and a crack of light
      bx = -2;
      by = 2;
      hx = -3;
      hy = 3;
      fist = [26, 34];
      ang = (168 * Math.PI) / 180;
      mouth = true;
      extra.push(sparks([[1, 36], [-1, 40], [5, 32], [-3, 44], [9, 31], [3, 29], [-4, 38]]));
      break;
    case 'hurt':
      bx = 3;
      hx = 4;
      hy = 1;
      eyes = 'shut';
      fist = [25, 45];
      ang = (108 * Math.PI) / 180;
      glow = 0;
      extra.push(dots([['S', [[60, 8], [72, 14], [50, 4]]]], { pal: HOT, late: true }));
      break;
    case 'tell':
      // Bellows Blast! / Chainwork! / ERUPTION!: chest thrown out, the furnace door blasting, a roar
      by = -1;
      hx = 1;
      hy = -2;
      fist = [20, 40];
      ang = (125 * Math.PI) / 180;
      glow = 2;
      mouth = true;
      eyes = 'blaze';
      extra.push(flame(51, 33, 9, 7, 1, -1.6), flame(47, 36, 7, 5, 2, -1.8), sparks([[38, 26], [34, 31], [41, 22], [30, 35]]));
      break;
  }
  if (phase >= 3 && eyes === 'open') eyes = 'blaze';
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const HX = (x: number) => x + hx + bx;
  const HY = (y: number) => y + hy + by;
  const cracks = phase >= 3 ? 0.7 : 0.22;
  const heat = phase >= 3 ? 2 : phase === 2 ? 1 : 0;
  const parts: Part[] = [];
  const far = TITAN.map((_, i) => TITAN[Math.max(0, i - 1)]);

  // --- behind: the endless chain, heaped at his back, a loop of it slung over the heap
  parts.push(chainHeap(vol(anyOf(ell(X(82), F - 6, 14, 7.5), ell(X(78), F - 11, 9, 5)), [X(66), F - 17, X(97), F], [X(76), F - 13, 14, 8], IRON, { edge: IRON[0] }), heat));
  parts.push(chainLinks((t) => [X(70) + t * 24, F - 14 - Math.sin(t * Math.PI) * 9], 9, heat, 1.4));
  // the far arm hauling on the chain (the strand runs from his fist down to the heap)
  parts.push(chainLinks((t) => [X(farFist[0]) + 1 + t * 5, Y(farFist[1]) + 3 + t * 9], 5, heat, 1.3));
  parts.push(shadedLimb(X(65), Y(24), X(farFist[0]), Y(farFist[1]), 5.8, 5, far));
  parts.push(vol(ell(X(farFist[0]), Y(farFist[1]) + 1, 4.8, 4.2), [X(farFist[0]) - 6, Y(farFist[1]) - 4, X(farFist[0]) + 6, Y(farFist[1]) + 6], [X(farFist[0]) - 1, Y(farFist[1]) - 1, 5, 5], far, { edge: TITAN[0] }));

  // --- the hammer when it's up behind him
  const back = pose === 'windup';
  const hammer = titanHammer(X(fist[0]), Y(fist[1]), ang, back ? 16 : 15, phase);
  if (back) parts.push(...hammer);

  // --- legs like pillars, iron-shod boots
  parts.push(shadedLimb(X(57), Y(54), X(58), F - 4, 5.6, 5.2, far));
  parts.push(shadedLimb(X(42), Y(54), X(41), F - 4, 6.2, 5.6, TITAN));
  parts.push([['.22222222222.', '2333333333332', '1111111111111'], X(51), F - 2, { pal: digits(IRON), edge: IRON[0] }]);
  parts.push([['.3444444444443.', '233333333333332', '111111111111111'], X(34), F - 2, { pal: digits(IRON), edge: IRON[0] }]);

  // --- the torso: shoulders like a mountain ridge, basalt with molten seams
  const torso = anyOf(ell(X(51), Y(41), 18, 15), ell(X(51), Y(28), 19, 10), ell(X(40), Y(31), 9, 9), ell(X(64), Y(27), 7, 7));
  parts.push(crackle(vol(torso, [X(30), Y(16), X(72), Y(57)], [X(44), Y(22), 26, 22], TITAN, { edge: TITAN[0] }), 7, 21 + phase, 2, cracks));
  // the furnace in his chest: an iron grate, the fire behind it breathing
  const fx = X(48);
  const fy = Y(26);
  const furnace: Record<string, [number, number][]> = {};
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 13; x++) {
      const corner = (x === 0 || x === 12) && (y === 0 || y === 11);
      if (corner) continue;
      const frame = x === 0 || x === 12 || y === 0 || y === 11;
      const ch = (() => {
        if (frame) return x === 0 || y === 0 ? '4' : '2';
        const d = Math.hypot((x - 6) / 5.5, (y - 6.5) / 5);
        const h = glow === 2 || phase >= 3 ? 1.3 - d * 0.5 : glow === 1 ? 1.05 - d * 0.7 : 0.72 - d * 0.6;
        if (glow < 2 && x % 3 === 0) return y % 3 === 0 ? '3' : '1'; // the grate's bars
        return h > 0.85 ? 'Z' : h > 0.6 ? 'X' : h > 0.38 ? 'x' : h > 0.15 ? 'q' : 'Q';
      })();
      (furnace[ch] ??= []).push([fx + x, fy + y]);
    }
  parts.push(dots(Object.entries(furnace) as [string, [number, number][]][], { pal: { ...digits(IRON), ...HOT }, edge: IRON[0] }));
  // the soot-black apron, scorched, a pocket of tools
  parts.push(vol(poly([[X(35), Y(41)], [X(67), Y(41)], [X(69), Y(58)], [X(32), Y(58)]]), [X(31), Y(40), X(70), Y(59)], [X(42), Y(43), 20, 12], APRON, { edge: APRON[0] }));
  parts.push(dots([['Q', [[X(37), Y(57)], [X(38), Y(57)], [X(46), Y(57)], [X(53), Y(57)], [X(54), Y(57)], [X(63), Y(57)]]], ['q', [[X(45), Y(57)], [X(62), Y(57)]]]], { pal: HOT }));
  parts.push([['3333', '3223', '3223', '2222'], X(57), Y(46), { pal: digits(APRON) }]);
  parts.push(line(X(58), Y(45), X(58), Y(43), '3', { pal: digits(STEEL) }));
  parts.push(line(X(59), Y(45), X(60), Y(42), '2', { pal: digits(WOOD) }));
  // phase 2 on: chains wound across his chest, heated
  if (phase >= 2) parts.push(chainLinks((t) => [X(68) - t * 24, Y(19) + t * 22], 11, heat, 1.3));

  // --- the near arm's upper half (the beard hangs over it)
  parts.push(shadedLimb(X(37), Y(24), X(fist[0]), Y(fist[1]), 6.4, 5.4, TITAN));
  if (phase >= 2) parts.push(chainLinks((t) => [X(37) + (X(fist[0]) - X(37)) * (0.3 + t * 0.5), Y(24) + (Y(fist[1]) - Y(24)) * (0.3 + t * 0.5) + Math.sin(t * 9) * 2], 7, heat, 1.2));

  // --- the head: a great bald basalt dome, the eyes of a forge that never cools
  const head = anyOf(ell(HX(40), HY(13), 10, 9.5), poly([[HX(29), HY(14)], [HX(33), HY(7)], [HX(39), HY(16)], [HX(31), HY(21)]]));
  parts.push(crackle(vol(head, [HX(28), HY(2), HX(51), HY(24)], [HX(37), HY(7), 12, 11], TITAN, { edge: TITAN[0] }), 4, 13 + phase, 3, phase >= 3 ? 0.7 : 0.25, ell(HX(35), HY(13), 6, 5)));
  // the ear
  parts.push([['.334', '3442', '332.', '.2..'], HX(46), HY(10), { pal: digits(TITAN), edge: TITAN[0] }]);
  // the beard of ash, long and flowing down over his chest
  const beard = poly([[HX(30), HY(18)], [HX(36), HY(16)], [HX(44), HY(18)], [HX(47), HY(25)], [HX(46), HY(35)], [HX(42), HY(44)], [HX(38), HY(49)], [HX(35), HY(43)], [HX(31), HY(34)], [HX(28), HY(25)]]);
  const bp = shag(beard, [HX(26), HY(15), HX(49), HY(51)], [HX(34), HY(20), 11, 16], ASHBEARD, 3, { edge: ASHBEARD[0] });
  // smouldering strands in the eruption
  if (phase >= 3) bp[0] = bp[0].map((r, y) => [...r].map((c, x) => (c !== '.' && hash2(x + 3, y * 5) < 0.12 && y > 14 ? (hash2(x, y) < 0.5 ? 'x' : 'q') : c)).join(''));
  bp[3] = { ...bp[3], pal: { ...digits(ASHBEARD), ...HOT } };
  parts.push(bp);
  // the big nose, a moustache over the mouth (an open roar when he bellows)
  parts.push([['..44', '.455', '4553', '3332'], HX(28), HY(12), { pal: digits(TITAN), edge: TITAN[0] }]);
  if (mouth) parts.push([['.QQQQQ.', 'QxXZXxQ', '.QQQQQ.'], HX(30), HY(18), { pal: HOT }]);
  parts.push([['..55444..', '.5544444.', '544433332', '44.....32'], HX(29), HY(15), { pal: digits(ASHBEARD), edge: ASHBEARD[0] }]);
  // eyes under bushy ash brows
  const eyeRows = eyes === 'shut' ? ['qqq..qqq'] : eyes === 'blaze' ? ['ZWZ..ZWZ'] : ['XZX..xXX'];
  parts.push([eyeRows, HX(32), HY(10), { pal: HOT }]);
  parts.push([['55544.55544', '.4433..4433'], HX(31), HY(7), { pal: digits(ASHBEARD), edge: ASHBEARD[0] }]);
  if (phase >= 3) parts.push(flame(HX(42), HY(4), 7, 7, 1), flame(X(66), Y(19), 7, 6, 2), flame(X(36), Y(20), 5, 5, 3));

  // --- the anvil, with the brass pendulum weight glowing on it
  const anvil: Record<string, [number, number][]> = {};
  const A = (ch: string, x: number, y: number) => (anvil[ch] ??= []).push([x, y]);
  for (let x = 0; x <= 22; x++) {
    // the face and the horn
    const horn = x < 7;
    const top = horn ? 51 + Math.round((7 - x) * 0.25) : 50;
    const bot = horn ? 52 : 54;
    for (let y = top; y <= bot; y++) A(y === top ? '5' : y === bot ? '2' : x < 4 ? '3' : '4', x, y);
  }
  for (let y = 55; y <= 61; y++) for (let x = 9 - Math.floor((61 - y) / 4); x <= 17 + Math.floor((61 - y) / 4); x++) A(x < 11 ? '4' : x > 15 ? '2' : '3', x, y);
  for (let y = 62; y <= F; y++) for (let x = 5; x <= 21; x++) A(y === 62 ? '4' : x < 8 ? '3' : x > 18 ? '1' : '2', x, y);
  parts.push(dots(Object.entries(anvil) as [string, [number, number][]][], { pal: digits(IRON), edge: IRON[0] }));
  // the pendulum's weight: a glowing brass bob with its ring
  parts.push([['.cc.', 'c..c', '.cc.'], 11, 39, { pal: BELLOWS_PAL }]);
  parts.push(vol(ell(13, 46, 4.6, 4.4), [8, 41, 18, 51], [11, 44, 5, 4], BRASS, { edge: BRASS[0] }));
  parts.push(dots([['C', [[11, 43], [12, 43]]], ['X', [[13, 47]]]], { pal: BELLOWS_PAL }));
  parts.push(dots([['X', [[6, 42], [20, 44], [8, 38], [18, 39]]]], { pal: HOT, late: true }));

  // --- the hammer and the near fist in front
  if (!back) parts.push(...hammer);
  parts.push(vol(ell(X(fist[0]), Y(fist[1]) + 1, 5.2, 4.6), [X(fist[0]) - 6, Y(fist[1]) - 4, X(fist[0]) + 6, Y(fist[1]) + 7], [X(fist[0]) - 2, Y(fist[1]) - 1, 6, 5], TITAN, { edge: TITAN[0] }));
  parts.push(...extra);
  return parts;
}

// ------------------------------------------------------------------ portraits (40x40 busts facing left, like the villains)

/** Portrait textures this file draws: `portrait_${name}`. */
export const ASH_PORTRAITS = ['rumbleback', 'hobnob', 'bellows'] as const;
const PS = 40;

function rumblebackPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  // banded shoulder plates behind, the sash across them
  const shoulders = ell(28, 42, 17, 13);
  parts.push(banded(vol(shoulders, [10, 28, 39, 39], [22, 32, 16, 10], PLATE, { edge: PLATE[0] }), 11, 40, 6, 3, 0));
  parts.push(sash(16, 30, 38, 39, 5));
  // the head: small and wedge-shaped, a long snout tapering to a point, a big ear standing up behind
  parts.push([['....44', '...454', '..4543', '.45432', '44432.', '3332..', '322...'], 29, 7, { pal: digits(HIDE), edge: HIDE[0] }]);
  const head = anyOf(ell(25, 21, 8, 7.5), poly([[0, 27], [2, 25.5], [13, 17], [21, 18], [22, 25], [12, 29], [3, 29]]));
  parts.push(vol(head, [0, 12, 34, 30], [13, 17, 14, 10], HIDE, { edge: HIDE[0] }));
  // the armoured head shield: little banded plates over the brow, back to the ear
  parts.push(banded(vol(poly([[12, 18], [17, 14], [27, 13], [31, 16], [30, 21], [20, 20]]), [11, 12, 32, 22], [18, 14, 9, 5], PLATE, { edge: PLATE[0] }), 12, 17, 3, 5, 0));
  // a sleepy, stubborn little eye, a nostril at the snout's tip, a flat line of a mouth
  parts.push([['kkk', 'kWk'], 13, 21, { pal: RUMBLE_PAL }]);
  parts.push(dots([['k', [[0, 27], [1, 27]]]], { pal: RUMBLE_PAL }));
  parts.push(dots([['k', [[4, 28], [5, 28], [6, 28], [7, 28], [8, 28], [9, 28]]]], { pal: RUMBLE_PAL }));
  // the dented cauldron jammed on as a hard hat
  parts.push(...cauldronHat(16, 4, 1, 3));
  return render(PS, PS, RUMBLE_PAL, {}, parts);
}

function hobnobPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  /** A big hound head in profile facing left (skull centre (cx, cy)); Hob scowls, Nob grins round a stick. */
  const LIT = ['#1a1420', '#2e2430', '#443638', '#5e4c4a', '#7e6658', '#a4886e'];
  const head = (cx: number, cy: number, hob: boolean, dim: boolean): Part[] => {
    const ramp = dim ? HOUND.map((_, i) => LIT[Math.max(0, i - 1)]) : LIT;
    const out: Part[] = [];
    // ears: Hob's pricked, Nob's flopping
    out.push(hob ? [['...44', '..443', '.4432', '4432.', '332..'], cx + 3, cy - 12, { pal: digits(ramp), edge: ramp[0] }] : [['.4433..', '4433322', '.33222.', '..22...'], cx + 4, cy - 8, { pal: digits(ramp), edge: ramp[0] }]);
    const skull = anyOf(ell(cx + 3, cy, 8, 7), poly([[cx - 12, cy], [cx - 11, cy - 3], [cx - 2, cy - 5], [cx + 1, cy + 4], [cx - 11, cy + 4]]));
    const jaw = poly([[cx - 11, cy + 3], [cx + 1, cy + 3], [cx + 3, cy + 8], [cx - 9, cy + 6]]);
    out.push(crackle(vol(jaw, [cx - 12, cy + 2, cx + 5, cy + 9], [cx - 5, cy + 3, 8, 4], ramp, { edge: ramp[0] }), 5, cx + 1, 3, 0.4));
    out.push(crackle(vol(skull, [cx - 13, cy - 8, cx + 12, cy + 7], [cx - 1, cy - 4, 12, 9], ramp, { edge: ramp[0] }), 5, cy + 7, 3, 0.5, ell(cx - 3, cy - 1, 6, 3.5)));
    // nose, eye, mouth
    out.push(dots([['k', [[cx - 12, cy - 1], [cx - 12, cy], [cx - 11, cy - 1], [cx - 11, cy]]], ['W', [[cx - 11, cy - 2]]]], { pal: HOUND_PAL }));
    if (hob) {
      out.push([['kkkkk.', '.kXZk', '..kk.'], cx - 5, cy - 4, { pal: HOT }]);
      out.push(dots([['t', [[cx - 9, cy + 3], [cx - 6, cy + 3], [cx - 3, cy + 3]]], ['k', [[cx - 10, cy + 3], [cx - 8, cy + 3], [cx - 7, cy + 3], [cx - 5, cy + 3], [cx - 4, cy + 3], [cx - 2, cy + 3]]]], { pal: HOUND_PAL }));
    } else {
      out.push([['.k.', 'XZX'], cx - 5, cy - 3, { pal: HOT }]);
      out.push(dots([['k', [[cx - 10, cy + 3], [cx - 9, cy + 4], [cx - 8, cy + 4], [cx - 7, cy + 4], [cx - 6, cy + 4], [cx - 5, cy + 3]]], ['r', [[cx - 8, cy + 5], [cx - 7, cy + 5], [cx - 7, cy + 6]]]], { pal: HOUND_PAL }));
      out.push([['vwwwwwwwwwwwwv', 'VvvvvvvvvvvvvV'], cx - 15, cy + 3, { pal: HOUND_PAL, edge: WOOD[0] }]);
    }
    return out;
  };
  // the shared body at the bottom, Hob's head behind and above, Nob's in front; collars of glowing chain
  parts.push(crackle(shag(ell(26, 44, 18, 12), [7, 30, 39, 39], [20, 34, 16, 8], HOUND, 5, { edge: HOUND[0] }), 6, 9, 3, 0.5));
  parts.push(shadedLimb(30, 32, 27, 16, 6, 5, HOUND.map((_, i) => HOUND[Math.max(0, i - 1)])));
  parts.push(...head(26, 11, true, true));
  parts.push(...chainCollar(23, 19, 34, 19, 2, true));
  parts.push(shadedLimb(22, 36, 17, 28, 6.5, 5.5, HOUND));
  parts.push(...head(15, 26, false, false));
  parts.push(...chainCollar(11, 34, 23, 33, 2, false));
  return render(PS, PS, HOUND_PAL, {}, parts);
}

function bellowsPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  // basalt shoulders, the furnace's glow showing at the bottom right
  parts.push(crackle(vol(ell(30, 44, 16, 12), [12, 30, 39, 39], [24, 34, 14, 8], TITAN, { edge: TITAN[0] }), 6, 4, 2, 0.4));
  parts.push([['.4444444', '4QqxXxqQ', '4qxXZXxq', '4QqxXxqQ'], 30, 35, { pal: { ...digits(IRON), ...HOT }, edge: IRON[0] }]);
  // the great bald dome of a head, cracked with seams of fire
  const head = anyOf(ell(22, 16, 13, 13), poly([[6, 18], [10, 9], [18, 20], [9, 26]]));
  parts.push(crackle(vol(head, [5, 2, 36, 30], [17, 9, 16, 15], TITAN, { edge: TITAN[0] }), 5, 13, 3, 0.35, ell(15, 17, 7, 6)));
  parts.push([['.344', '3442', '332.', '.2..'], 31, 15, { pal: digits(TITAN), edge: TITAN[0] }]);
  // the beard of ash flowing down off the bottom
  const beard = poly([[7, 24], [15, 21], [24, 23], [28, 30], [27, 39], [12, 39], [8, 33]]);
  parts.push(shag(beard, [5, 20, 30, 39], [13, 25, 12, 12], ASHBEARD, 7, { edge: ASHBEARD[0] }));
  // a big nose, the moustache, eyes like a forge under bushy brows
  parts.push([['..445', '.4553', '45532', '33321'], 3, 15, { pal: digits(TITAN), edge: TITAN[0] }]);
  parts.push([['...55544...', '.55544444..', '5544433332.', '44.....332.'], 4, 21, { pal: digits(ASHBEARD), edge: ASHBEARD[0] }]);
  parts.push([['XZX...XZX'], 8, 13, { pal: HOT }]);
  parts.push([['55544..55544', '.44433..4433'], 7, 10, { pal: digits(ASHBEARD), edge: ASHBEARD[0] }]);
  return render(PS, PS, BELLOWS_PAL, {}, parts);
}

// ------------------------------------------------------------------ bar pieces for the region's specials

/** Where an ember will land: a red-orange target bracket round a falling coal (9x7 with its outline). */
function emberMark(): HTMLCanvasElement {
  const g = grid(9, 7);
  const rows = ['.r.....r.', 'rRr.x.rRr', '.rR.X.Rr.', '..rRZRr..', '...rRr...'];
  const pal: Pal = { r: '#ff7a2a', R: '#d03a1a', x: EMBER[2], X: EMBER[4], Z: EMBER[5] };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && put(g, x, y + 1, pal[ch])));
  return paint(g);
}

/** A pane of coloured glass standing on the bar (Prism Flash!), leaded, a glint across it (5x12 with its outline). */
function glassPane(): HTMLCanvasElement {
  const g = grid(5, 12);
  const rows = ['.W.', 'rWa', 'rRa', 'LLL', 'gGb', 'gWb', 'GgB', 'LLL', 'aAr', 'AaR'];
  const pal: Pal = { W: '#ffffff', L: '#1a1420', r: PANES[0], R: PANES_LIT[0], a: PANES[1], A: PANES_LIT[1], g: PANES[2], G: PANES_LIT[2], b: PANES[3], B: PANES_LIT[3] };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && put(g, x + 1, y + 1, pal[ch])));
  return paint(g);
}

// ------------------------------------------------------------------ build

/** The jobs that draw every texture this file makes: one sprite (with its phase looks) per job, then the rest. */
function jobs(): Array<() => Array<[string, HTMLCanvasElement]>> {
  const defs: Partial<Record<string, SpriteDef>> = {
    cinderling: { W: 24, H: 23, pal: CINDER_PAL, shades: {}, parts: cinderParts },
    cinderkite: { W: 38, H: 28, pal: KITE_PAL, shades: {}, parts: kiteParts },
    cragcrab: { W: 34, H: 24, pal: CRAB_PAL, shades: {}, parts: crabParts },
    obsidianox: { W: 50, H: 40, pal: OX_PAL, shades: {}, parts: oxParts },
    rumbleback: { W: 60, H: 46, pal: RUMBLE_PAL, shades: {}, parts: (p) => rumbleParts(p, 1), extras: ['shell'] },
    rumbleback2: { W: 60, H: 46, pal: RUMBLE_PAL, shades: {}, parts: (p) => rumbleParts(p, 2), extras: ['shell'] },
    glassblower: { W: 30, H: 30, pal: GLASSB_PAL, shades: {}, parts: blowerParts },
    prismbat: { W: 36, H: 24, pal: PRISM_PAL, shades: {}, parts: prismBatParts },
    glassmantis: { W: 32, H: 36, pal: MANTIS_PAL, shades: {}, parts: mantisParts },
    kilnwarden: { W: 42, H: 46, pal: KILN_PAL, shades: {}, parts: kilnParts },
    hobnob: { W: 66, H: 48, pal: HOUND_PAL, shades: {}, parts: hobnobParts, extras: ['guard'] },
    stokerimp: { W: 30, H: 30, pal: STOKER_PAL, shades: {}, parts: stokerParts },
    magmaeel: { W: 32, H: 42, pal: EEL_PAL, shades: {}, parts: eelParts },
    forgehand: { W: 30, H: 34, pal: FORGEHAND_PAL, shades: {}, parts: forgeHandParts },
    chainsentinel: { W: 36, H: 44, pal: SENTINEL_PAL, shades: {}, parts: sentinelParts },
    bellows: { W: 96, H: 70, pal: BELLOWS_PAL, shades: {}, parts: (p) => bellowsParts(p, 1) },
    bellows2: { W: 96, H: 70, pal: BELLOWS_PAL, shades: {}, parts: (p) => bellowsParts(p, 2) },
    bellows3: { W: 96, H: 70, pal: BELLOWS_PAL, shades: {}, parts: (p) => bellowsParts(p, 3) },
  };
  const out: Array<() => Array<[string, HTMLCanvasElement]>> = ASH_SPRITES.map((name) => () => {
    // a boss's phase looks share its frame size, so swapping between them never jumps
    const group: string[] = name === 'bellows' ? [name, ...BELLOWS_PHASES] : name === 'rumbleback' ? [name, 'rumbleback2'] : [name];
    return fitFrames(group.flatMap((n) => [...ASH_POSES, ...(defs[n]!.extras ?? [])].map((pose): [string, SpriteDef, string] => [n, defs[n]!, pose])));
  });
  out.push(() => [
    ['portrait_rumbleback', rumblebackPortrait()],
    ['portrait_hobnob', hobnobPortrait()],
    ['portrait_bellows', bellowsPortrait()],
    ['ember_mark', emberMark()],
    ['glass_pane', glassPane()],
  ]);
  return out;
}

const drawn: Array<[string, HTMLCanvasElement]> = [];
let queue: Array<() => Array<[string, HTMLCanvasElement]>> | null = null;

/**
 * Draw some of Region 3's foe art (whole sprites, until `ms` have gone by): the scene paints it in idle time after
 * boot, like the world map, so a player who never reaches the region never waits for it. True once it's all drawn.
 */
export function paintAshFoeSlice(ms = 8): boolean {
  queue ??= jobs();
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < ms) drawn.push(...queue.shift()!());
  return queue.length === 0;
}

/** Whether all of it has been drawn. */
export const ashFoeArtReady = (): boolean => queue !== null && queue.length === 0;

/**
 * Add Region 3's foes, portraits and bar pieces once they're drawn (every call after that, as on a relayout, adds
 * fresh copies of the drawn canvases). `now`: draw whatever is left first (a fight or a scene needs them).
 */
export function buildAshFoeArt(add: Add, now = false): void {
  if (now) while (!paintAshFoeSlice(1e9));
  if (!ashFoeArtReady()) return;
  for (const [key, c] of drawn) {
    // the textures get copies, so the drawn canvases stay pristine for the next relayout
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext('2d')!.drawImage(c, 0, 0);
    add(key, copy);
  }
}

const ASH_PORTRAIT_KEYS = ASH_PORTRAITS.map((n) => 'portrait_' + n);
/** Whether a texture is one this file draws (a foe's frame, a phase look's, a portrait): asking for one draws the lot. */
export const isAshArtKey = (key: string): boolean => ASH_PORTRAIT_KEYS.includes(key) || ASH_SPRITES.some((n) => key.startsWith(n + '_') || key.startsWith(n + '2_') || key.startsWith(n + '3_'));
