// Story and map art (see docs/art-style.md): dialogue portraits and the node icons (`mapicon_*`, the act map's
// fallback when an enemy has no mini sprite; the act map's own art is in art-map.ts).
// Portraits are 40x40 busts on a transparent background (the scene draws the frame): forms are painted as
// lit volumes (light from the top left, hue-shifted ramps), details are stamped from small character maps,
// and toCanvas adds the 1px ink outline. Rowan, Sable and Pip face right; the villains face left. The HUD badge's
// 18x18 face window sits at (12, 6) for Rowan and at (14, 8) for Sable (both eyes and the top of the mask).
import { grid, put, stamp, toCanvas, type Grid, type Pal } from './art';
import { buildAtlasPortraits } from './art-portraits-atlas';
import { portraitMood } from './art-paint';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Portrait textures: `portrait_${name}`. */
export const PORTRAITS = ['rowan', 'sable', 'pip', 'captain', 'golem', 'boarking', 'narrator', 'smith', 'mapmaker', 'keeper'] as const;
/** Map node icons: `mapicon_${type}`. */
export const MAP_ICONS = ['fight', 'elite', 'treasure', 'rest', 'shop', 'event', 'boss'] as const;
/** A representative colour per map icon (for glows and highlights). */
export const MAP_ICON_COL: Record<string, number> = {
  fight: 0xb8c2d8,
  elite: 0xf05a48,
  treasure: 0xf2c230,
  rest: 0xff8a2a,
  shop: 0x6ac850,
  event: 0x6aaef0,
  boss: 0xb070ff,
};
export const PORTRAIT_SIZE = 40;

// ------------------------------------------------------------------ ramps (dark -> light)

const INK = '#140c1c';
const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const RED = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
const BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'];
const SKIN = ['#5a2e22', '#a0583a', '#d88a5a', '#f2b888', '#ffd8b0'];
const PURPLE = ['#1e1430', '#36244e', '#523a72', '#7a5a9a', '#a888c8'];
const FUR = ['#2e1622', '#5a2e26', '#8a4a2c', '#b06a36', '#d8964e'];
const IVORY = ['#6a5a4a', '#a8967a', '#d8c8a8', '#f4ead4', '#fffcf0'];
const STONE = ['#1c1c2c', '#34344a', '#545264', '#78747c', '#a09a96', '#c8c0b2'];
const MOSS = ['#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850'];
const TEAL = ['#14524e', '#22a098', '#62e4d4', '#d8fff6'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];

// ------------------------------------------------------------------ painting toolkit

const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.46];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n);
})();

/** Lambert light (0..1) on a sphere at normalised position (nx, ny). */
function lambert(nx: number, ny: number): number {
  const r2 = nx * nx + ny * ny;
  const s = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  return Math.max(0, nx * s * LIGHT[0] + ny * s * LIGHT[1] + nz * LIGHT[2]);
}

const tone = (r: string[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))];

type Shader = (x: number, y: number) => string | null;
type Inside = (x: number, y: number) => boolean;

/** A volume lit as one sphere (centre, radii); `bias` brightens or darkens the whole form. */
const sphere =
  (r: string[], cx: number, cy: number, rx: number, ry: number, bias = 0, amb = 0.1): Shader =>
  (x, y) =>
    tone(r, amb + 0.95 * lambert((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + bias);

const ell =
  (cx: number, cy: number, rx: number, ry: number): Inside =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const or =
  (...f: Inside[]): Inside =>
  (x, y) =>
    f.some((k) => k(x, y));
const and =
  (...f: Inside[]): Inside =>
  (x, y) =>
    f.every((k) => k(x, y));
const not =
  (f: Inside): Inside =>
  (x, y) =>
    !f(x, y);

/** Fill the pixels `inside` reports with the shader's colour. */
function fill(g: Grid, inside: Inside, shade: Shader): void {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      if (!inside(x, y)) continue;
      const c = shade(x, y);
      if (c) g[y][x] = c;
    }
}

/** Darken the pixels of a form that sit on its lower/right edge (`k` px in), toward a ramp's dark end. */
function rimShade(g: Grid, inside: Inside, dark: string, k = 1): void {
  const out: Array<[number, number]> = [];
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      if (!inside(x, y)) continue;
      for (let d = 1; d <= k; d++) if (!inside(x + d, y + d) && !inside(x, y + d)) out.push([x, y]);
    }
  for (const [x, y] of out) g[y][x] = dark;
}

/** Thick polyline with round ends (stroke) - shading by the caller's shader. */
function stroke(g: Grid, pts: Array<[number, number]>, r: number | ((t: number) => number), shade: Shader): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const rr = typeof r === 'number' ? r : r((i + t) / n);
      for (let yy = Math.floor(y - rr); yy <= y + rr; yy++)
        for (let xx = Math.floor(x - rr); xx <= x + rr; xx++)
          if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= rr * rr) {
            const c = shade(xx, yy);
            if (c) put(g, xx, yy, c);
          }
    }
  }
}

/** Points along a cubic Bezier. */
function bez(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

const P = PORTRAIT_SIZE;

// ------------------------------------------------------------------ Rowan (faces right)

function rowan(): HTMLCanvasElement {
  const g = grid(P, P);
  // plume: scalloped tufts streaming back from the crest (tail first, so the crest overlaps)
  const plume = bez([21, 6], [15, -4], [2, 2], [3, 19], 14);
  for (let i = plume.length - 1; i >= 0; i--) {
    const [x, y] = plume[i];
    const r = 4.8 - (i / plume.length) * 2.8;
    fill(g, ell(x, y, r, r * 0.9), sphere(RED, x - 0.5, y - 0.8, r * 1.15, r * 1.1, -0.04));
  }
  // torso: tabard, gorget, pauldrons
  const tabard = ell(20.5, 41, 15.5, 10);
  fill(g, tabard, sphere(BLUE, 16, 35, 20, 13, 0.05));
  fill(g, and(tabard, (x) => x === 13 || x === 14), (x) => (x === 13 ? GOLD[3] : GOLD[2]));
  fill(g, and(tabard, (x) => x === 27 || x === 28), (x) => (x === 27 ? GOLD[2] : GOLD[1]));
  stamp(g, ['..G..', '..y..', '.gGg.', '.gyY.', '..Y..'], { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1] }, 18, 33);
  const gorget = and(ell(21, 29.5, 8, 3.5), (_x, y) => y >= 27);
  fill(g, gorget, (x, y) => (y === 29 ? STEEL[1] : sphere(STEEL, 18, 28, 9, 4)(x, y)));
  for (const [cx, rx] of [
    [7, 7.5],
    [34, 6.5],
  ]) {
    const pad = ell(cx, 35, rx, 5.5);
    fill(g, pad, sphere(STEEL, cx - 2, 33, rx + 1, 6.5, 0.04));
    fill(g, and(pad, not(ell(cx, 34.2, rx, 5.5))), (x) => (x < cx ? GOLD[3] : GOLD[2]));
  }
  // helmet: one rounded volume with a slightly jutting face plate
  const helm = or(ell(20.5, 17, 11.5, 12.5), ell(25, 21.5, 8.5, 7.5));
  fill(g, helm, sphere(STEEL, 19, 15, 13, 14.5, 0.02));
  rimShade(g, helm, STEEL[0]);
  stamp(g, ['.WW', 'WWS', 'WS.'], { W: '#ffffff', S: STEEL[4] }, 13, 7);
  // gold brow band wrapping round the dome
  for (let x = 9; x < 34; x++) {
    const yb = Math.round(11.5 + ((x - 23) / 12) ** 2 * 2.2);
    if (!helm(x, yb)) continue;
    const v = 0.95 - ((x - 9) / 25) * 0.65;
    put(g, x, yb, tone(GOLD, v));
    put(g, x, yb + 1, tone(GOLD, v - 0.3));
    if (helm(x, yb + 2)) put(g, x, yb + 2, STEEL[1]);
  }
  put(g, 21, 6, GOLD[3]);
  put(g, 20, 6, GOLD[4]);
  put(g, 22, 6, GOLD[2]);
  // visor slit with glowing eyes (the near eye larger), and breathing holes set in a grin
  for (let x = 17; x < 34; x++) {
    const yb = Math.round(11.5 + ((x - 23) / 12) ** 2 * 2.2) + 4;
    if (!helm(x, yb + 2)) continue;
    if (x === 17) {
      put(g, x, yb + 1, '#1c1430');
      continue;
    }
    for (let k = 0; k < 3; k++) put(g, x, yb + k, '#1c1430');
    put(g, x, yb - 1, STEEL[1]);
    if (helm(x, yb + 3)) put(g, x, yb + 3, STEEL[3]);
  }
  const eye: Pal = { e: '#4ad8ff', E: '#e0fcff', c: '#1e6a8a', W: '#ffffff' };
  stamp(g, ['cEEc', 'eEEe', 'ceec'], eye, 20, 15);
  stamp(g, ['cEc', 'eEe', 'cec'], eye, 27, 15);
  for (const [x, y] of [
    [22, 22],
    [24, 23],
    [26, 23],
    [28, 22],
  ]) {
    put(g, x, y, STEEL[0]);
    put(g, x, y + 1, STEEL[3]);
  }
  return toCanvas(g);
}

// ------------------------------------------------------------------ Sable (faces right)

// Sable's plum cloth and teal scarf (the fight sprite's ramps, art-sable.ts)
const PLUM = ['#1c1632', '#2c2250', '#41306a', '#5a3e84', '#7a5498', '#a274b0', '#c69ac4'];
const SCARF_T = ['#0c2c3c', '#135a62', '#1c8a80', '#34b496', '#74dcb0', '#c8f8d4'];

function sable(): HTMLCanvasElement {
  const g = grid(P, P);
  // the scarf's two tails rippling back from the knot behind the neck (a shaded ribbon with a lit upper edge)
  for (const [y0, y1, w, ph] of [
    [25, 16, 3, 0],
    [28, 26, 2, 1.8],
  ]) {
    // one column at a time from the knot to the frame's edge: lit top, mid body, shaded underside
    for (let x = 11; x >= 0; x--) {
      const t = (11 - x) / 11;
      const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * 5 + ph) * 1.2);
      put(g, x, y, t < 0.5 ? SCARF_T[4] : SCARF_T[3]);
      for (let k = 1; k < w; k++) put(g, x, y + k, SCARF_T[2]);
      put(g, x, y + w, SCARF_T[1]);
    }
  }
  stamp(g, ['.dd.', 'deec', 'dcbb', '.bb.'], { e: SCARF_T[4], d: SCARF_T[3], c: SCARF_T[2], b: SCARF_T[1] }, 9, 25);
  // shoulders: the gi, a leather strap across the chest with a brass buckle
  const torso = ell(21, 41, 16, 9.5);
  fill(g, torso, sphere(PLUM.slice(1), 14, 33, 20, 12, 0.06));
  rimShade(g, torso, PLUM[1]);
  for (let x = 9; x <= 30; x++) {
    const y = Math.round(31 + (x - 9) * 0.45);
    if (!torso(x, y)) continue;
    put(g, x, y, '#6e3a44');
    put(g, x, y + 1, '#3e2030');
  }
  stamp(g, ['GgY', 'gkY', 'YYz'], { G: GOLD[4], g: GOLD[3], Y: GOLD[1], z: GOLD[0], k: '#3e2030' }, 18, 35);
  // the hood: one rounded volume, its peak flopping back
  const hood = or(ell(20.5, 17.5, 12.5, 12.5), ell(14, 9, 5.5, 4.5));
  fill(g, hood, sphere(PLUM.slice(1), 15, 11, 16, 16, 0.07));
  rimShade(g, hood, PLUM[1]);
  stamp(g, ['..77', '.776', '766.'], { 7: PLUM[6], 6: PLUM[5] }, 12, 5);
  // a seam running back over the crown
  for (const [x, y] of bez([25, 6], [20, 5.5], [14, 9], [11, 17], 12)) put(g, Math.round(x), Math.round(y), PLUM[3]);
  // the face opening: a lit rim on the near side, deep shadow inside, then the face
  const open = ell(27, 19.5, 7.6, 7);
  fill(g, and(hood, ell(26.5, 19.5, 9, 8.4), not(open)), (x) => (x < 25 ? PLUM[5] : PLUM[4]));
  fill(g, and(hood, open), () => PLUM[0]);
  const face = and(ell(28, 20.5, 6.6, 5.6), (_x, y) => y >= 15);
  fill(g, face, (x, y) => (y <= 15 ? SKIN[1] : sphere(SKIN, 25, 17, 9, 8, 0.14)(x, y)));
  // eyes: amber irises under heavy lids, glints toward the light (the near eye larger)
  const eye: Pal = { k: INK, W: '#ffffff', w: '#e8dcd0', a: '#f0a838', A: '#b0601a', s: SKIN[1] };
  stamp(g, ['kkkkk', 'WwaAk', 'wwAkk', '.kkk.'], eye, 21, 16);
  stamp(g, ['kkkk', 'WaAk', 'wAkk'], eye, 28, 16);
  // the mask: the scarf wrapped over the nose and mouth and round the neck
  const mask = and(or(ell(26, 26, 10, 5.6), ell(18, 29, 8, 3.4), ell(33, 22.5, 2, 1.6)), (_x, y) => y >= 21);
  fill(g, mask, sphere(SCARF_T.slice(1), 21, 21, 15, 8, 0.06));
  rimShade(g, mask, SCARF_T[0]);
  for (let x = 19; x <= 29; x++) if (mask(x, 21)) put(g, x, 21, SCARF_T[5]);
  // folds: a dark crease under the nose and one where it wraps the neck
  for (const [x, y] of bez([23, 25], [26, 24], [29, 25], [31, 26.5], 8)) put(g, Math.round(x), Math.round(y), SCARF_T[1]);
  for (const [x, y] of bez([13, 29], [17, 31], [22, 31], [26, 30], 10)) if (mask(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), SCARF_T[1]);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Pip (faces right)

function pip(): HTMLCanvasElement {
  const g = grid(P, P);
  const PB = ['#14204a', '#1e3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'];
  // ear tufts, their bases buried in the head
  stamp(g, ['l......', 'bl.....', 'bbl....', 'Bbbl...', 'BBbbl..', '.BBbbl.', '..BBbbl'], { l: PB[4], b: PB[3], B: PB[2] }, 6, 3);
  stamp(g, ['......b', '.....bB', '....bBB', '...bBBn', '..bBBnn', '.bBBnn.', 'bBBnn..'], { b: PB[3], B: PB[2], n: PB[1] }, 26, 3);
  const body = ell(20, 23.5, 17, 16);
  fill(g, body, sphere(PB, 16, 18, 20, 19, 0.04));
  rimShade(g, body, PB[0]);
  // folded wing on the left, raised wing on the right (making a point)
  const wingL = and(ell(5.5, 29, 4.5, 9), body);
  fill(g, wingL, (x, y) => (y % 3 === 0 ? '#1a2e70' : x < 4 ? '#6aaef0' : '#3a78d8'));
  // belly with chevrons
  const belly = and(ell(21, 36, 9.5, 7), body);
  fill(g, belly, (x, y) => {
    const c = sphere(['#c8b496', '#efe2c4', '#fff8e6', '#ffffff'], 18, 33, 11, 8)(x, y);
    return (x + y) % 4 === 0 && y > 31 && y % 2 === 0 ? '#c8b496' : c;
  });
  // facial disc: two overlapping pale rings round the eyes
  const DISC = ['#4a84d0', '#8ac4f6', '#b8dcfa', '#e0f2ff'];
  const disc = or(ell(14.5, 19.5, 8, 7.5), ell(27, 19.5, 7, 7));
  fill(g, disc, sphere(DISC, 18, 16, 14, 10, 0.05));
  rimShade(g, disc, '#2a5aaa');
  // big eyes, smug half-lidded, looking right
  const eyeL = ell(15, 20, 5, 5);
  const eyeR = ell(27, 20, 4.5, 4.7);
  const eyes = or(eyeL, eyeR);
  fill(g, eyes, () => INK);
  fill(g, or(ell(15, 20, 4, 4), ell(27, 20, 3.5, 3.7)), (_x, y) => (y <= 19 ? '#ffd84a' : y <= 21 ? '#f6b830' : '#e89a20'));
  fill(g, or(ell(16.5, 20.5, 2, 2.2), ell(28.3, 20.5, 1.7, 2)), () => INK);
  put(g, 15, 19, '#ffffff');
  put(g, 16, 19, '#ffffff');
  put(g, 16, 18, '#ffd84a'); // no pupil nub above the glint (it read as a heart)
  put(g, 27, 19, '#ffffff');
  // lids: flat and heavy (unimpressed), the far brow cocked up
  for (let x = 10; x <= 32; x++)
    for (let y = 14; y <= 18; y++) {
      const lidY = x < 21 ? 18 : 17;
      if (eyes(x, y) && y < lidY) put(g, x, y, y === lidY - 1 ? '#1a2e70' : PB[2]);
    }
  stamp(g, ['....ll', '..lbb.', 'lbB...'], { l: PB[4], b: PB[3], B: PB[2] }, 24, 11);
  stamp(g, ['lllbb', '.BBBn'], { l: PB[4], b: PB[3], B: PB[2], n: PB[1] }, 11, 13);
  // beak
  stamp(g, ['GgY', '.gY', '.Y.'], { G: '#ffe070', g: '#f2a020', Y: '#b0601a' }, 20, 23);
  // the raised wing: feather "fingers" up beside the face, as if making a point
  const wing = [
    '....LN.',
    '...LNnB',
    '..LNnnB',
    '.LNnnB.',
    'LNnnB..',
    'NnnB...',
    'NnB....',
    'nB.....',
  ];
  stamp(g, wing, { L: '#9ad8ff', N: '#6aaef0', n: '#3a78d8', B: '#1a2e70' }, 32, 22);
  return toCanvas(g);
}

// ------------------------------------------------------------------ the Bandit Captain (faces left)

function captain(): HTMLCanvasElement {
  const g = grid(P, P);
  const COAT = ['#140e22', '#22163a', '#36244e', '#4a3466'];
  // coat, then the hood framing the head and falling over the shoulders
  const coat = ell(22, 43, 18, 11.5);
  fill(g, coat, sphere(COAT, 14, 34, 22, 14, 0.08));
  for (const y of [35, 38]) put(g, 19, y, GOLD[3]);
  const hood = or(ell(22.5, 21, 10, 12), ell(25.5, 30, 11, 7));
  fill(g, hood, sphere(PURPLE, 17, 14, 15, 16, 0.04));
  rimShade(g, hood, PURPLE[0]);
  fill(g, ell(20, 22, 6.5, 9.5), (_x, y) => (y < 16 ? PURPLE[1] : PURPLE[0])); // the hood's shadowed inside
  // red scarf knotted at the throat, tails hanging
  fill(g, ell(17.5, 31.5, 7.5, 3), sphere(RED, 14, 30, 9, 4, 0.08));
  stamp(g, ['qr.', 'rRR', 'rR.', '.R.'], { r: RED[2], q: RED[3], R: RED[1] }, 11, 32);
  // face, nose to the left; the chin juts a little
  const face = or(ell(15.5, 21, 6.8, 7.8), ell(9.5, 21.5, 3, 2.4), ell(14.5, 26.5, 5, 3));
  fill(g, face, sphere(SKIN, 10, 16, 12, 12, 0.2));
  rimShade(g, face, SKIN[1]);
  // ear and a lock of hair in the hood's shadow
  stamp(g, ['.23', '232', '22.', '.1.'], { 1: SKIN[0], 2: SKIN[1], 3: SKIN[2] }, 20, 19);
  stamp(g, ['hH', 'hh', '.h'], { h: '#2a1810', H: '#4a2c18' }, 23, 17);
  // nose: lit bridge, shaded underside, nostril
  stamp(g, ['5..', '54.', '443', '2222', '.1.'], { 1: SKIN[0], 2: SKIN[1], 3: SKIN[2], 4: SKIN[3], 5: SKIN[4] }, 7, 19);
  // the near eye under a patch, its strap running up into the hood
  const pp: Pal = { p: '#1c1430', P: '#4e3e62', s: '#2a1830' };
  stamp(g, ['.pp.', 'pPpp', 'pppp', '.pp.'], pp, 14, 17);
  for (const [x, y] of [
    [18, 16],
    [19, 16],
    [20, 15],
    [13, 16],
    [12, 15],
  ])
    put(g, x, y, pp.s);
  // the other eye: narrowed, sly, under a cocked brow
  stamp(g, ['.kk.', 'k..k', '....', '.kkk', 'kkw.'], { k: '#2a1810', w: '#fff4e0' }, 8, 14);
  put(g, 9, 18, INK);
  // handlebar moustache and a crooked grin with one gold tooth
  stamp(g, ['m..........m', 'mm.mmmmmmm.m', '.mmMMMMMMmm.'], { m: '#2a1810', M: '#5a3420' }, 5, 22);
  stamp(g, ['rrrrrrrr', 'rtttgtrr', '.rtttrr.', '..rrr...'], { r: '#4a1020', t: '#fff4e0', g: GOLD[3] }, 9, 25);
  stamp(g, ['mm', '.m'], { m: '#2a1810' }, 12, 29);
  // tricorn hat: the front corner points down-left; gold trim on the upturned brim
  const hat = [
    '..............bbbbbb..........',
    '...........bbbBBBBBBbb........',
    '.........bbBBBBBBBBBBBbb......',
    '.......bbBBBBBBBBBBBBBBBn.....',
    '......bBBBBBBBBBBBBBBBBBnn....',
    '.....GbBBBBBBBBBBBBBBBBnnnn...',
    '....GgyyyyyyyyyyyyyyynnnnnnG..',
    '...GgbbbBBBBBBBBBBBBBBnnnnnGg.',
    '..GgbBBBBBBBBBBBBBBBBBBnnnggY.',
    '.GgbBBBBBBBnnnnnnnnnnnnnggYY..',
    'GgbBBBBnnnnggggggggggggYYY....',
    'gbBBnnngggYYYYYYYYYYYY........',
    'gyyggYYY......................',
    '.YYY..........................',
  ];
  stamp(g, hat, { b: PURPLE[4], B: PURPLE[3], n: PURPLE[2], G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1] }, 3, 2);
  // a big white plume tucked in the band, sweeping back
  const plume = bez([24, 8], [28, -1], [34, -2], [38, 5], 12);
  stroke(g, plume.map(([x, y]) => [x + 0.5, y + 1] as [number, number]), (t) => 2.2 - t * 1.5, () => '#a898c8');
  stroke(g, plume, (t) => 2.2 - t * 1.6, (_x, y) => (y < 3 ? '#ffffff' : '#ece6f8'));
  // a fat purse of loot from the sleeping road, held up in a gloved fist, a gold coin peeking from its neck
  const purse = or(ell(5.5, 31.5, 4.2, 3.8), ell(5.5, 27.5, 1.8, 1.4));
  fill(g, purse, sphere(['#2e1a10', '#4e2e1a', '#74482a', '#9a6a3e', '#b88a58'], 3.8, 29.5, 5, 5, 0.06));
  stamp(g, ['ttt'], { t: '#2a1810' }, 4, 28);
  stamp(g, ['gG', 'yg'], { G: GOLD[4], g: GOLD[3], y: GOLD[2] }, 5, 25);
  stamp(g, ['.LLL.', 'LllLL', 'LllLL', '.LLL.'], { L: '#2a1810', l: '#5a3a24' }, 3, 34);
  return toCanvas(g);
}

// ------------------------------------------------------------------ the Ruin Golem (faces left)

function golem(): HTMLCanvasElement {
  const g = grid(P, P);
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // blocky stone: front faces lit, side faces in shade, lit top/left edges, worn into big chips
  const block = (x0: number, y0: number, x1: number, y1: number, side: number, cut = 2) => {
    const inside: Inside = (x, y) =>
      x >= x0 && x <= x1 && y >= y0 && y <= y1 && x - x0 + (y - y0) >= cut && x1 - x + (y - y0) >= cut && x1 - x + (y1 - y) >= cut - 1;
    fill(g, inside, (x, y) => {
      const sideFace = x > side;
      let v = sideFace ? 0.3 : 0.62 - ((y - y0) / (y1 - y0)) * 0.18;
      if (!inside(x, y - 1)) v = sideFace ? 0.55 : 0.95;
      else if (!inside(x - 1, y)) v = sideFace ? 0.45 : 0.85;
      else if (!inside(x + 1, y) || !inside(x, y + 1)) v = 0.12;
      else if (x === side + 1) v = 0.16;
      v += (hash(Math.floor(x / 4), Math.floor(y / 3)) - 0.5) * 0.14;
      return tone(STONE, v);
    });
    return inside;
  };
  block(1, 27, 13, 41, 10, 3); // near shoulder
  block(27, 24, 38, 41, 34, 3); // far shoulder
  block(9, 28, 31, 41, 25, 2); // chest
  // the old king's crown, carved in the chest and still faintly glowing
  stamp(g, ['a.a.a', 'abcba', 'bbbbb', 'aaaaa'], { a: TEAL[0], b: TEAL[1], c: TEAL[2] }, 14, 32);
  // the head
  block(6, 5, 31, 28, 24, 3);
  // a squared nose jutting from the front face, with its cast shadow
  stamp(g, ['54', '542', '5422', '4321', '.111'], { 1: STONE[0], 2: STONE[1], 3: STONE[2], 4: STONE[3], 5: STONE[4] }, 12, 16);
  // heavy brow ledge, raised over the middle (earnest, a little worried), shadow beneath
  for (let x = 7; x <= 24; x++) {
    const yb = x >= 13 && x <= 15 ? 12 : x === 12 || x === 16 ? 12.5 : 13;
    const y = Math.floor(yb);
    put(g, x, y, STONE[5]);
    put(g, x, y + 1, STONE[3]);
    put(g, x, y + 2, STONE[0]);
    if (yb % 1) put(g, x, y + 3, STONE[1]);
  }
  for (let x = 25; x <= 30; x++) {
    put(g, x, 13, STONE[3]);
    put(g, x, 14, STONE[1]);
  }
  // glowing rune eyes, their light spilling onto the stone
  const eyeP: Pal = { s: '#3a6066', a: TEAL[0], b: TEAL[1], c: TEAL[2], d: TEAL[3] };
  stamp(g, ['sabbs', 'abcdb', 'sabas'], eyeP, 7, 16);
  stamp(g, ['sbbas', 'bdcba', 'sabas'], eyeP, 17, 16);
  // forehead rune: an old ward, a little star of the Atlas's compass
  stamp(g, ['.b.', 'bcb', '.b.'], eyeP, 13, 8);
  // mouth: a carved slot with stubby teeth
  stamp(g, ['11111111', '13131311', '.2222222'], { 1: STONE[0], 2: STONE[2], 3: STONE[3] }, 9, 23);
  // cracks (a dark seam with a lit lip below)
  for (const pts of [
    [
      [27, 16],
      [27, 17],
      [28, 18],
      [28, 19],
      [29, 20],
    ],
    [
      [8, 24],
      [9, 25],
      [9, 26],
    ],
    [
      [5, 31],
      [6, 32],
      [6, 33],
      [7, 34],
    ],
    [
      [22, 29],
      [23, 30],
      [23, 31],
    ],
  ])
    for (const [x, y] of pts) {
      put(g, x, y, STONE[0]);
      put(g, x - 1, y, STONE[4]);
    }
  // moss over the crown of the head and on the shoulders, with a little flower
  const mossTop = (x: number, y: number) => y >= 5 && y <= 8 + Math.round(Math.sin(x * 1.1) * 1 + (x % 5 === 1 ? 2 : 0)) && x >= 7 && x <= 30 && !(x - 6 + (y - 5) < 3) && !(31 - x + (y - 5) < 3);
  fill(g, mossTop, (x, y) => tone(MOSS, 0.95 - (y - 5) * 0.16 - (x > 24 ? 0.25 : 0)));
  for (const [x, len] of [
    [8, 3],
    [11, 2],
    [21, 4],
    [26, 2],
    [29, 3],
  ])
    for (let k = 0; k < len; k++) put(g, x, 9 + k + (x % 5 === 1 ? 2 : 0), k === len - 1 ? MOSS[3] : MOSS[1]);
  for (const [x0, x1, y0] of [
    [3, 11, 27],
    [29, 37, 24],
  ])
    for (let x = x0; x <= x1; x++) {
      const d = 1 + ((x * 7) % 3 === 0 ? 1 : 0);
      for (let k = 0; k < d; k++) put(g, x, y0 + k, tone(MOSS, 0.85 - k * 0.35 - (x > 33 ? 0.2 : 0)));
    }
  stamp(g, ['.p.', 'pyp', '.p.', '.m.'], { p: '#ff8ac0', y: '#ffe070', m: MOSS[1] }, 23, 2);
  stamp(g, ['l.', 'lm'], { l: MOSS[4], m: MOSS[2] }, 17, 3);
  return toCanvas(g);
}

// ------------------------------------------------------------------ the Boar King (faces left)

function boarKing(): HTMLCanvasElement {
  const g = grid(P, P);
  const MANE = ['#120a14', '#1e1018', '#2e1622', '#46222e', '#66323a'];
  const VELVET = ['#3a0c1c', '#6a1424', '#a02430', '#d03c3c', '#f06a5a'];
  // royal cape with an ermine collar
  const cape = ell(22, 46, 21, 13);
  fill(g, cape, sphere(VELVET, 12, 38, 24, 13, 0.06));
  const collar = and(cape, not(ell(22, 49, 21, 13)));
  fill(g, collar, (x, y) => ((x * 5 + y * 3) % 11 === 0 ? INK : y === Math.round(33 + ((x - 22) / 21) ** 2 * 13) ? '#ffffff' : (x + y) % 3 ? '#f4ece6' : '#d8ccd0'));
  // bristly mane sweeping back from the neck, lit at the tips
  for (let i = 0; i < 17; i++) {
    const a = -2.1 + i * 0.19;
    const len = 13 + (i % 2) * 4 - Math.max(0, i - 12);
    const tip: [number, number] = [25 + Math.cos(a) * len, 21 + Math.sin(a) * len];
    stroke(g, [[25, 21], tip], (t) => 3.2 - t * 2.8, (x, y) => {
      const d = Math.hypot(x - 25, y - 21) / len;
      return tone(MANE, 0.15 + d * 0.55 + lambert((x - 25) / 16, (y - 21) / 16) * 0.35);
    });
  }
  // ears: the far one behind, the near one pricked up
  stamp(g, ['...m', '..mm', '.mmm', 'mmmm'], { m: FUR[1] }, 28, 8);
  stamp(g, ['....l', '...lc', '..lpc', '.lppc', 'lpppc', 'cccc.'], { l: FUR[3], c: FUR[2], p: '#c06a78' }, 23, 5);
  // the head: a heavy cranium and jowls tapering to the snout
  const snout = ell(9.5, 25.5, 7.5, 4.8);
  const head = or(ell(21, 20, 10, 10), ell(20, 26.5, 9.5, 6.5), snout);
  fill(g, head, sphere(FUR, 13, 15, 15, 13, 0.1));
  rimShade(g, head, FUR[0]);
  // a lit ridge along the top of the snout and a few fur strokes
  for (let x = 6; x <= 14; x++) put(g, x, Math.round(21.2 + (x < 9 ? (9 - x) * 0.15 : 0)), FUR[4]);
  for (const [x, y] of [
    [24, 15],
    [25, 16],
    [27, 21],
    [27, 22],
    [22, 29],
    [23, 30],
    [18, 13],
  ])
    put(g, x, y, FUR[1]);
  // snout disc with nostrils
  fill(g, ell(3, 25.5, 2.4, 4), sphere(['#5a2430', '#a85458', '#d88078', '#f4a898', '#ffd0c0'], 2.5, 23.5, 3, 5, 0.08));
  put(g, 3, 24, '#3a1420');
  put(g, 3, 27, '#3a1420');
  // snarling mouth
  for (let x = 5; x <= 15; x++) put(g, x, 29 + (x > 11 ? 1 : 0) - (x > 14 ? 1 : 0), FUR[0]);
  put(g, 16, 28, FUR[0]);
  // tusks curling up past the snout: the far one behind the snout, the near one big, each with a dark edge
  const farTusk = bez([12, 27], [10, 27], [8, 24], [9, 19], 8);
  stroke(g, farTusk, (t) => 1.6 - t * 0.9, (x, y) => (snout(x, y) && y > 22 ? null : FUR[0]));
  stroke(g, farTusk, (t) => 1.0 - t * 0.6, (x, y) => (snout(x, y) && y > 22 ? null : IVORY[2]));
  const tusk = bez([14, 31], [9, 32.5], [4.5, 28], [5.5, 17.5], 12);
  stroke(g, tusk, (t) => 2.3 - t * 1.5, () => FUR[0]);
  stroke(g, tusk, (t) => 1.6 - t * 1.2, (x, y) => (x + y < 32 ? IVORY[4] : x + y < 36 ? IVORY[3] : IVORY[2]));
  // fierce little eye under a scowling brow (low toward the snout)
  stamp(g, ['....kk', '..kkk.', 'kkk...', '.krW..', '.kkk..'], { k: '#1a0c12', r: '#ff5a3a', W: '#ffe0a0' }, 13, 15);
  // crown: a red velvet cap in a gold band with a point either side. The first pendulum weight (the story's
  // MacGuffin, a round brass bob) is its centrepiece, hung from the middle point in a dark bezel so it reads
  // as a separate object at 1x; brass is yellower than the crown's gold.
  const BRASS = ['#6e4a14', '#b07c22', '#e0b040', '#f8dc70', '#fffad0'];
  fill(g, and(ell(18, 9.5, 7.5, 6.5), (_x, y) => y <= 9), sphere(VELVET, 14, 5, 9, 7, -0.12));
  stamp(
    g,
    [
      'G.............g',
      'G.............y',
      'Gg...........gy',
      'Gg...........yY',
      'Ggy.........gyY',
      'Ggy.........yyY',
      'Ggyy.......gyYY',
      'GgggggggggggyyY',
      'yryyyyyyyyyyrYz',
      'YYYYYYYYYYYYYzz',
    ],
    { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], z: GOLD[0], r: '#e8443a' },
    11,
    2,
  );
  fill(g, ell(18.5, 5.5, 4.5, 4.5), () => '#2a140c');
  stamp(
    g,
    ['..443..', '.4WW32.', '4WW3322', '4333221', '3332211', '.32110.', '..121..'],
    { W: '#ffffff', 4: BRASS[4], 3: BRASS[3], 2: BRASS[2], 1: BRASS[1], 0: BRASS[0] },
    15,
    2,
  );
  stamp(g, ['gGy'], { G: GOLD[4], g: GOLD[3], y: GOLD[2] }, 17, 0); // the lug it hangs from
  return toCanvas(g);
}

// ------------------------------------------------------------------ map icons (13x13 + outline)

const ICON_PAL: Pal = {
  // steel, gold, wood
  W: '#ffffff', S: STEEL[4], s: STEEL[3], m: STEEL[2], M: STEEL[1],
  G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], z: GOLD[0],
  d: WOOD[1], h: WOOD[3], H: WOOD[4], D: WOOD[0],
  // bone, red, fire
  B: '#fffcf0', b: '#e6dcc4', c: '#b0a088', k: '#2a1830',
  r: RED[2], R: RED[1], q: RED[3], x: RED[0],
  f: '#ffe680', F: '#ff9a2a', o: '#e8441a',
  // green cloth, parchment, blue ink, purple
  n: '#2a6a34', N: '#4a9a40', l: '#7ac850',
  p: '#f4e4bc', P: '#d8c08a', a: '#a8875a',
  i: '#2a6ad8', I: '#4aa0f0', u: '#10204a',
  v: '#a86ae0', V: '#5a2a90',
};

const ICON_MAPS: Record<string, string[]> = {
  fight: [
    'S...........S',
    'sS.........Ss',
    '.sS.......Ss.',
    '..sS.....Ss..',
    '...sS...Ss...',
    '....sS.Ss....',
    '.....sSs.....',
    '....SsSsS....',
    '...Ss...sS...',
    '.gy.......gy.',
    '..yh.....hy..',
    '.y..d...d..y.',
    'G...........G',
  ],
  elite: [
    'q...........q',
    'rq.........qr',
    'Rr.bBBBBBb.rR',
    '.RrBBBBBBbbR.',
    '..BBBBBBBbbc.',
    '..BkkBBBkkbc.',
    '..kqrkBkrqkc.',
    '..bkkbBbkkbc.',
    '...bbbkbbcc..',
    '....bbbbcc...',
    '....BkBkBc...',
    '....bkbkbc...',
    '.....ccc.....',
  ],
  treasure: [
    '.............',
    '..HHHHHHHHH..',
    '.HhhhgGhhhhd.',
    '.hhhhgyhhhdd.',
    '.ddddgydddDD.',
    'gGggggggggggy',
    'yHhhhgGghhhdY',
    '.hhhhgkghhhd.',
    '.hhhhyyyhhhd.',
    '.ddddddddddD.',
    '.DDDDDDDDDDD.',
    '.............',
    '.............',
  ],
  rest: [
    '......f......',
    '.....ff......',
    '....fFf.f....',
    '....FfFff....',
    '...FffFfF....',
    '...FfffffF...',
    '..oFfffffFo..',
    '..oFFfffFFo..',
    '...ooFFFoo...',
    'Hhd..ooo..hdD',
    '.HhhdD.Hhhd..',
    '..dDHhhhdD...',
    '.HhhdD.dHhhd.',
  ],
  shop: [
    '.....yy......',
    '....nNNn.....',
    '.....gy......',
    '....NNNn.....',
    '...NlNNNn....',
    '..NlNNNNnn...',
    '.NlNNNNNNnn..',
    '.NlNNNNNnnn..',
    '.NNNNNNGgyn..',
    '..NNNNGgggyY.',
    '...nnngGgyyY.',
    '......gyyyY..',
    '.......YYY...',
  ],
  event: [
    '..PpppppppP..',
    '.aPPPPPPPPPa.',
    '..ppppppppP..',
    '..pppiiuppP..',
    '..ppiuppiuP..',
    '..pppppiupP..',
    '..ppppiuppP..',
    '..ppppiuppP..',
    '..ppppppppP..',
    '..ppppiuppP..',
    '..ppppppppP..',
    '.aPPPPPPPPPa.',
    '..PpppppppP..',
  ],
  boss: [
    '..G...g...g..',
    '..Gg.gvg.gy..',
    '..GgGgggggy..',
    '..yyyyyyyyY..',
    '..BBBBBBBbb..',
    '.BBBBBBBBbbc.',
    '.BkkkBBkkkbc.',
    '.BkkkBBkkkbc.',
    '.bBkbBkbkbbc.',
    '..bbbbkbbbc..',
    '...BkBkBkc...',
    '...bkbkbkc...',
    '....cccc.....',
  ],
};

export function buildStoryArt(add: Add): void {
  add('portrait_rowan', rowan());
  add('portrait_sable', sable());
  add('portrait_pip', portraitMood(pip(), 0.26));
  add('portrait_captain', captain());
  add('portrait_golem', golem());
  add('portrait_boarking', boarKing());
  // (the narrator, the Mapmaker and Hesper: art-portraits-atlas.ts)
  buildAtlasPortraits(add);
  for (const m of MAP_ICONS) {
    const g = grid(15, 15);
    stamp(g, ICON_MAPS[m], ICON_PAL, 1, 1);
    add(`mapicon_${m}`, toCanvas(g));
  }
}
