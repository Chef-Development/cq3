// Region 2 foes (see docs/art-style.md and docs/content-bible.md section 5): character maps and shaded masks with an
// automatic ink outline, facing left, built like art-foes.ts. Every sprite has the frames the fighters view uses:
// idle0, idle1, windup, attack, hurt, flash, tell. Each one carries a warm accent (amber eyes, a scarf, wood, gold)
// so it never melts into a blue-white backdrop.
import { grid, OUTLINE, put, stampShaded, type Grid, type Pal, type Shade } from './art';

export type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Sprite names this file draws (each gets `${name}_${pose}` textures). */
export const FROST_SPRITES = [
  'rimeimp',
  'iciclebat',
  'yeticub',
  'snowogre',
  'frostweaver',
  'icewraith',
  'hailcaller',
  'glaciertortoise',
  'drifttroll',
  'aurorawisp',
  'frostknight',
  'rimehorn',
  'matron',
  'glacia',
] as const;
export const FROST_POSES = ['idle0', 'idle1', 'windup', 'attack', 'hurt', 'flash', 'tell'] as const;
/**
 * The boss's phase looks: full frame sets (`glacia2_${pose}`, `glacia3_${pose}`) the same size as `glacia_*`. Phase 2
 * turns her scales mirror-bright and narrows her eyes; phase 3 darkens and cracks them and her glare goes red.
 */
export const GLACIA_PHASES = ['glacia2', 'glacia3'] as const;

/** Each sprite's main body colour (death-burst and hit chips), like FOE_COL. */
export const FROST_COL: Record<string, number> = {
  rimeimp: 0x4a6aca,
  iciclebat: 0x9a94c0,
  yeticub: 0xdae2f2,
  snowogre: 0x7084a8,
  frostweaver: 0xdae2f2,
  icewraith: 0x354686,
  hailcaller: 0xc0602a,
  glaciertortoise: 0x68b2dc,
  drifttroll: 0xa6aecc,
  aurorawisp: 0x6ae890,
  frostknight: 0x4e5c7c,
  rimehorn: 0xd0a05a,
  matron: 0x74509a,
  glacia: 0x4e9ad4,
  glacia2: 0x8ccbe8,
  glacia3: 0x2c5ea0,
};

// ------------------------------------------------------------------ helpers (as in art-foes.ts; art-ash.ts draws with them too)

export interface PartOpts {
  pal?: Pal;
  shades?: Record<string, Shade>;
  /** Interior contour (the local darkest tone) drawn where this part overlaps what is already there. */
  edge?: string;
  /** Drawn after the outline pass, so it gets no ink outline (glows, thin threads). */
  late?: boolean;
}
export type Part = [rows: string[], x: number, y: number, opts?: PartOpts];

export interface Frame {
  g: Grid;
  /** Pixels drawn after the outline pass (no outline of their own). */
  late: Grid;
}

/** Compose parts back to front into a W x H frame (1px kept free on every side for the outline). */
export function compose(W: number, H: number, pal: Pal, shades: Record<string, Shade>, parts: Part[], flash = false): Frame {
  const g = grid(W, H);
  const late = grid(W, H);
  for (const [rows, ox, oy, o = {}] of parts) {
    if (o.late) {
      stampShaded(late, rows, o.pal ?? pal, o.shades ?? shades, ox, oy, flash);
      continue;
    }
    if (o.edge) {
      // interior contour: where this part's outline would fall on pixels already drawn
      const h = rows.length;
      const w = Math.max(...rows.map((r) => r.length));
      const W2 = w + 2;
      const on = new Uint8Array(W2 * (h + 2));
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) if (r[x] !== '.' && r[x] !== ' ') on[(y + 1) * W2 + x + 1] = 1;
      });
      for (let y = -1; y <= h; y++)
        for (let x = -1; x <= w; x++) {
          const i = (y + 1) * W2 + x + 1;
          if (on[i] || !((x > -1 && on[i - 1]) || (x < w && on[i + 1]) || (y > -1 && on[i - W2]) || (y < h && on[i + W2]))) continue;
          const gx = ox + x;
          const gy = oy + y;
          if (g[gy]?.[gx]) g[gy][gx] = o.edge;
        }
    }
    stampShaded(g, rows, o.pal ?? pal, o.shades ?? shades, ox, oy);
  }
  if (flash) for (const r of g) for (let x = 0; x < r.length; x++) if (r[x]) r[x] = '#ffffff';
  return { g, late };
}

/** Compose and paint a whole W x H frame. */
export function render(W: number, H: number, pal: Pal, shades: Record<string, Shade>, parts: Part[], flash = false): HTMLCanvasElement {
  const f = compose(W, H, pal, shades, parts, flash);
  return paint(f.g, f.late);
}

const RGB = new Map<string, number>();
const rgbOf = (hex: string): number => {
  let v = RGB.get(hex);
  if (v === undefined) RGB.set(hex, (v = parseInt(hex.slice(1, 7), 16)));
  return v;
};

/**
 * A grid to a canvas as toCanvas does (a 1px ink outline round every filled pixel), then the outline-free `late`
 * pixels on top; written as one ImageData (these frames are big and many, so no per-pixel fillRect). Optionally just
 * the w x h window at (x0, y0).
 */
export function paint(g: Grid, late?: Grid, x0 = 0, y0 = 0, w = g[0].length, h = g.length): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const ink = rgbOf(OUTLINE);
  const GW = g[0].length;
  for (let y = 0; y < h; y++) {
    const gy = y + y0;
    const row = g[gy];
    const up = g[gy - 1];
    const down = g[gy + 1];
    const lrow = late?.[gy];
    for (let x = 0; x < w; x++) {
      const gx = x + x0;
      const col = lrow?.[gx] ?? row[gx];
      let v: number;
      if (col) v = rgbOf(col);
      else if ((gx > 0 && row[gx - 1]) || (gx < GW - 1 && row[gx + 1]) || up?.[gx] || down?.[gx]) v = ink;
      else continue;
      const i = (y * w + x) * 4;
      d[i] = v >> 16;
      d[i + 1] = (v >> 8) & 255;
      d[i + 2] = v & 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Replace characters: pairs like ['E', 'k'] applied to every row. */
export const swap = (rows: string[], pairs: [string, string][]) => rows.map((r) => pairs.reduce((s, [a, b]) => s.split(a).join(b), r));
export const flip = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

/** A part from loose points in frame coordinates: [letter, [[x, y], ...]] pairs, later ones on top. */
export function dots(spec: [string, [number, number][]][], opts?: PartOpts): Part {
  const all = spec.flatMap(([, p]) => p);
  const minx = Math.min(...all.map((p) => p[0]));
  const miny = Math.min(...all.map((p) => p[1]));
  const w = Math.max(...all.map((p) => p[0])) - minx + 1;
  const h = Math.max(...all.map((p) => p[1])) - miny + 1;
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [ch, pts] of spec) for (const [x, y] of pts) g[y - miny][x - minx] = ch;
  return [g.map((r) => r.join('')), minx, miny, opts];
}

/** A 1px line from (x0, y0) to (x1, y1) in frame coordinates. */
export function line(x0: number, y0: number, x1: number, y1: number, ch: string, opts?: PartOpts): Part {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1))]);
  return dots([[ch, pts]], opts);
}

/** A 2px thick limb from (x0, y0) to (x1, y1) in frame coordinates. */
export function limb(x0: number, y0: number, x1: number, y1: number, ch: string, opts?: PartOpts): Part {
  const minx = Math.min(x0, x1);
  const miny = Math.min(y0, y1);
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  const g = Array.from({ length: Math.abs(y1 - y0) + 2 }, () => Array<string>(Math.abs(x1 - x0) + 2).fill('.'));
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const x = Math.round(x0 + (x1 - x0) * t) - minx;
    const y = Math.round(y0 + (y1 - y0) * t) - miny;
    g[y][x] = ch;
    if (steep) g[y][x + 1] = ch;
    else g[y + 1][x] = ch;
  }
  return [g.map((r) => r.join('')), minx, miny, opts];
}

/** Cheap deterministic hash in [0, 1). */
export function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type Mask = (x: number, y: number) => boolean;
export const ell =
  (cx: number, cy: number, rx: number, ry: number): Mask =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
export const anyOf =
  (...m: Mask[]): Mask =>
  (x, y) => {
    for (const f of m) if (f(x, y)) return true;
    return false;
  };
export function poly(pts: [number, number][]): Mask {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const n = pts.length;
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = ys[i];
      const yj = ys[j];
      if (yi > py !== yj > py && px < ((xs[j] - xs[i]) * (py - yi)) / (yj - yi) + xs[i]) inside = !inside;
    }
    return inside;
  };
}

/** Tone digits (0-5) for a rounded form: lit from the top left around (cx, cy), a dark rim underneath. */
export function roundTones(w: number, h: number, mask: Mask, cx: number, cy: number, rx: number, ry: number): string[] {
  // the mask sampled once (with a margin for the neighbour tests below)
  const W2 = w + 2;
  const inside = new Uint8Array(W2 * (h + 3));
  for (let y = -1; y <= h + 1; y++) for (let x = -1; x <= w; x++) inside[(y + 1) * W2 + x + 1] = mask(x, y) ? 1 : 0;
  const m = (x: number, y: number) => inside[(y + 1) * W2 + x + 1] === 1;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      if (!m(x, y)) {
        r += '.';
        continue;
      }
      const nx = Math.max(-1, Math.min(1, (x + 0.5 - cx) / rx));
      const ny = Math.max(-1, Math.min(1, (y + 0.5 - cy) / ry));
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = (-0.45 * nx - 0.7 * ny + 0.55 * nz) / 0.94;
      let t = lam > 0.8 ? 5 : lam > 0.52 ? 4 : lam > 0.18 ? 3 : lam > -0.25 ? 2 : 1;
      if (!m(x, y + 1)) t = Math.min(t, 1);
      else if (!m(x, y + 2)) t = Math.min(t, 2);
      else if (!m(x + 1, y)) t = Math.max(1, t - 1);
      else if (!m(x, y - 1) && lam > 0) t = Math.max(t, 4);
      r += String(t);
    }
    rows.push(r);
  }
  return rows;
}

/** A tapered capsule of letter `ch` from (x0, y0) (radius r0) to (x1, y1) (radius r1), in frame coordinates. */
export function capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, ch: string, opts?: PartOpts): Part {
  const pts: [number, number][] = [];
  const R = Math.max(r0, r1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y0, y1) - R - 1); y <= Math.max(y0, y1) + R + 1; y++)
    for (let x = Math.floor(Math.min(x0, x1) - R - 1); x <= Math.max(x0, x1) + R + 1; x++) {
      const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2));
      const r = r0 + (r1 - r0) * t;
      if ((x + 0.5 - x0 - dx * t) ** 2 + (y + 0.5 - y0 - dy * t) ** 2 <= r * r) pts.push([x, y]);
    }
  return dots([[ch, pts]], opts);
}

/**
 * A faceted ice crystal along a direction (angle in radians, 0 = right, -PI/2 = up), from (x, y): `len` long, `w`
 * wide at its widest, pointed at the far end. Tone digits on the ICE ramp: the face toward the light is pale, the
 * other deep, a bright ridge down the middle.
 */
export function crystal(x: number, y: number, ang: number, len: number, w: number, o: PartOpts = {}): Part {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const vx = -uy;
  const vy = ux;
  // which side faces the light (top left)
  const litSide = vx * -0.6 + vy * -0.8 > 0 ? 1 : -1;
  const spec: Record<string, [number, number][]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const R = len + w;
  for (let py = Math.floor(y - R); py <= y + R; py++)
    for (let px = Math.floor(x - R); px <= x + R; px++) {
      const rx = px + 0.5 - x;
      const ry = py + 0.5 - y;
      const u = rx * ux + ry * uy;
      const v = rx * vx + ry * vy;
      if (u < 0 || u > len) continue;
      const k = u / len;
      const half = (w / 2) * (k < 0.35 ? 0.55 + (k / 0.35) * 0.45 : 1 - ((k - 0.35) / 0.65) ** 1.3);
      if (Math.abs(v) > half) continue;
      const side = v * litSide;
      let t = Math.abs(v) < 0.6 ? 5 : side > 0 ? 4 : 2;
      if (side < 0 && Math.abs(v) > half - 1) t = 1;
      if (side > 0 && Math.abs(v) > half - 1) t = 3;
      if (u < 1.2) t = Math.min(t, 2);
      spec[t].push([px, py]);
    }
  return dots(
    Object.entries(spec).filter(([, p]) => p.length) as [string, [number, number][]][],
    { pal: digits(ICE), ...o },
  );
}

/** A rounded volume from a mask in frame coordinates, inside `box` (x0, y0, x1, y1), lit around light (cx, cy, rx, ry). */
export function vol(m: Mask, box: [number, number, number, number], light: [number, number, number, number], ramp: string[], o: PartOpts = {}): Part {
  const [x0, y0, x1, y1] = box;
  const local: Mask = (x, y) => m(x + x0, y + y0);
  return [roundTones(x1 - x0 + 1, y1 - y0 + 1, local, light[0] - x0, light[1] - y0, light[2], light[3]), x0, y0, { pal: digits(ramp), ...o }];
}

/** A palette mapping the tone digits 0-5 to a ramp (dark to light; a 5-tone ramp repeats its top for 5). */
export const digits = (ramp: string[]): Pal => Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [String(i), ramp[Math.min(i, ramp.length - 1)]]));

export interface SpriteDef {
  /** Design canvas the parts are laid out on (feet near the bottom); the textures are cropped to fit. */
  W: number;
  H: number;
  pal: Pal;
  shades: Record<string, Shade>;
  parts: (pose: string) => Part[];
  extras?: string[];
}

/** Room around the design canvas, so a pose that strays past it is never clipped. */
const PAD = 10;

/**
 * Render every pose of a sprite (or of a group of sprites sharing a canvas), then crop them all to the union of their
 * pixels (outline included): every frame is the same size, as tight as the widest pose allows, with nothing clipped.
 * Returns [`${name}_${pose}`, canvas] pairs.
 */
export function fitFrames(frames: [name: string, d: SpriteDef, pose: string][]): [string, HTMLCanvasElement][] {
  const full = frames.map(([name, d, pose]): [string, Frame] => {
    const parts = d.parts(pose === 'flash' ? 'hurt' : pose).map(([rows, x, y, o]): Part => [rows, x + PAD, y + PAD, o]);
    return [`${name}_${pose}`, compose(d.W + PAD * 2, d.H + PAD * 2, d.pal, d.shades, parts, pose === 'flash')];
  });
  // the union of every frame's pixels, the outline (1px round the outlined ones) included
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const [, f] of full)
    for (let y = 0; y < f.g.length; y++) {
      const row = f.g[y];
      const lrow = f.late[y];
      for (let x = 0; x < row.length; x++) {
        if (!row[x] && !lrow[x]) continue;
        const m = row[x] ? 1 : 0;
        if (x - m < x0) x0 = x - m;
        if (y - m < y0) y0 = y - m;
        if (x + m > x1) x1 = x + m;
        if (y + m > y1) y1 = y + m;
      }
    }
  const W = full[0][1].g[0].length;
  const H = full[0][1].g.length;
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W - 1, x1);
  y1 = Math.min(H - 1, y1);
  return full.map(([key, f]) => [key, paint(f.g, f.late, x0, y0, x1 - x0 + 1, y1 - y0 + 1)]);
}

// ------------------------------------------------------------------ shared ramps (dark to light, hue-shifted)

const INK = '#140c1c';
// pale glacier ice: shadows lean indigo, the glare leans cyan-white
const ICE = ['#1c2a5a', '#2a4c8c', '#3c7cbc', '#68b2dc', '#a8e0f2', '#e8fbff'];
// snow fur: shadows lean lavender, highlights pure white
const SNOWFUR = ['#34345a', '#5a5e8a', '#878eb6', '#b2bcd8', '#dae2f2', '#ffffff'];
// warm accents: knit red, wood
const KNIT = ['#3e0c18', '#7a1622', '#c42a2e', '#ee5440', '#ff9a78'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
const EYE: Pal = { k: INK, O: '#ffb02a', o: '#d8661a', W: '#ffffff' };

// ------------------------------------------------------------------ rime imp (a small blue imp with frosted horns)

// cobalt skin: shadows lean violet, highlights lean cyan
const IMP = ['#16123a', '#24266c', '#34449e', '#4a6aca', '#7a9ce8', '#b4d0ff'];
const IMP_PAL: Pal = {
  ...EYE,
  0: '#ffb02a', d: IMP[1],
  m: '#2a0c24', t: '#f4f0e8', r: '#e04a5a', // mouth, fangs, tongue
  a: ICE[1], b: ICE[3], c: ICE[4], H: ICE[5], // frosted horns
  y: '#f4e8d0', // knit stripe
  f: IMP[0], // claws
  C: '#ffffff', D: '#cfe8f6', E: '#8ab8dc', // breath
};
const IMP_SHADES: Record<string, Shade> = {
  s: { ramp: IMP, same: 'kOoW0dmtr', top: [5, 4], left: [4], right: [2, 2], bottom: [1, 2], mid: 3 },
  b: { ramp: IMP, same: 'u', top: [4], left: [4], right: [2], bottom: [1, 2], mid: 3 },
  u: { ramp: ['#3a4a8a', '#5a7cc4', '#8ab4e6', '#bcdcf6', '#e8f6ff'], same: 'b', top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
  w: { ramp: ['#100c2a', '#1c1a4a', '#2c2c6e', '#40449a', '#5c66be'], same: 'v', top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
  v: { ramp: IMP, top: [3], left: [3], right: [2], bottom: [2], mid: 3 },
  q: { ramp: KNIT, same: 'y', top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
};
// head, 12 wide, facing left: big amber eyes under cheeky brows (pupils toward the hero), a fanged grin
const IMP_HEAD = [
  '....ssss....',
  '..ssssssss..',
  '.ssssssssss.',
  'sddsdddsssss',
  'sOOsWOOsssss',
  'skosk0osssss',
  'ssssssssssss',
  'mmmmmmssssss',
  'tmrrtmssssss',
  '.mmmmsssssss',
  '..sssssssss.',
  '....sssss...',
];
const IMP_HORN = ['......HH', '....HcH.', '...bcc..', '..abc...', '.aab....', 'aab.....'];
const IMP_BODY = ['..bbbbb..', '.bbbbbbbb', 'buuubbbbb', 'buuuubbbb', 'buuuubbbb', '.uuubbbb.', '..bbbbb..'];
const IMP_LEGS: Record<string, string[]> = {
  stand: ['.bb...bb', '.bb...bb', 'fbb..fbb'],
  step: ['bb....bb', 'bb.....bb', 'fbb....fbb'],
};
const IMP_WING: Record<string, string[]> = {
  up: ['.....vv', '...vvww', '.vvwwww', 'vwwwww.', '.wwww..', '..w.w..'],
  down: ['vvvvv...', '.wwwwvv.', '..wwwwwv', '...wwww.', '....w.w.'],
};
const IMP_SCARF = ['.qqqqqqqq.....', 'qqqqqqqqqqqyqy', 'qqqqqqqqq.qyqy', '.qq......qqyq.', '.yy.......y...'];
const IMP_PUFF = ['..CCC...', '.CDDDCC.', 'CDDDDDDC', 'CDEEDDEC', '.CEECCE.'];
const IMP_PUFF_SM = ['.CC.', 'CDDC', '.CE.'];

function impParts(pose: string): Part[] {
  let hx = 1; // head
  let hy = 5;
  let bx = 4; // body
  let by = 17;
  let legs = IMP_LEGS.stand;
  let lx = 5;
  let head = IMP_HEAD;
  let wing = IMP_WING.up;
  let arm: [number, number] = [5, 22]; // the near hand
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      hy = 6;
      by = 18;
      wing = IMP_WING.down;
      arm = [5, 23];
      break;
    case 'windup':
      hx = 3;
      hy = 6;
      bx = 5;
      by = 18;
      arm = [12, 14];
      break;
    case 'attack':
      // a clawed swipe and a puff of frost
      hx = 0;
      hy = 6;
      bx = 3;
      by = 18;
      lx = 3;
      legs = IMP_LEGS.step;
      wing = IMP_WING.down;
      arm = [0, 18];
      extra.push([IMP_PUFF_SM, -4, 12]);
      break;
    case 'hurt':
      hx = 3;
      hy = 5;
      bx = 5;
      head = swap(IMP_HEAD, [['sOOsWOO', 'sddsddd'], ['skosk0o', 'sssssss'], ['tmrrtm', 'mmmmmm']]);
      arm = [8, 22];
      break;
    case 'tell':
      // Frost Breath!: rears back, cheeks puffed, a cold cloud rolling out of the grin
      hx = 2;
      hy = 4;
      bx = 5;
      by = 17;
      wing = IMP_WING.up;
      head = swap(IMP_HEAD, [['mmmmmm', 'CDDDmm'], ['tmrrtm', 'CDEDtm']]);
      arm = [12, 13];
      extra.push([IMP_PUFF, -6, 10]);
      break;
  }
  const F = 26;
  return [
    [wing, bx + 5, by - 5],
    [IMP_HORN.map((r) => r.replace(/[abcH]/g, (c) => ({ a: 'a', b: 'a', c: 'b', H: 'c' })[c]!)), hx + 7, hy - 5],
    line(bx + 8, by + 4, bx + 12, by + 1, 'v'),
    dots([['v', [[bx + 13, by]]], ['c', [[bx + 13, by - 1], [bx + 14, by]]]]),
    [legs, lx, F - legs.length + 1],
    [IMP_BODY, bx, by],
    [head, hx, hy],
    [IMP_SCARF, bx - 1, by - 2],
    [IMP_HORN, hx + 2, hy - 5],
    limb(bx + 2, by + 2, arm[0] + 1, arm[1] - 1, 'v', { edge: IMP[1] }),
    [['ff', 'f.'], arm[0], arm[1]],
    ...extra,
  ];
}

// ------------------------------------------------------------------ icicle bat (a pale bat, icicles hanging off its wings)

// pale lilac fur with deep violet shadows (so it holds its shape on snow)
const BATFUR = ['#262040', '#463e6c', '#6e6696', '#9a94c0', '#c8c6e2', '#f2f2fc'];
const BAT_PAL: Pal = {
  ...EYE,
  E: '#e2768a', n: '#f09aa8', // inner ears, nose
  m: '#2a0c24', t: '#f4f0e8', // mouth, fangs
  i: ICE[4], I: ICE[5], j: ICE[3], // icicles
};
const BAT_SHADES: Record<string, Shade> = {
  f: { ramp: BATFUR, same: 'EnkOoWmtu', top: [5, 4], left: [4], right: [2], bottom: [1, 2], mid: 3 },
  u: { ramp: BATFUR, same: 'f', top: [5], left: [5], right: [3], bottom: [2], mid: 4 },
  w: { ramp: ICE, same: 'v', top: [3], left: [3], right: [1], bottom: [2], mid: 2 },
  v: { ramp: ['#141634', '#24285a', '#3a4282', '#5260a8', '#7a8cc8'], top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
};
// seen from the front, peering left: tall ears, big amber eyes, a fanged grin
const BAT_BODY = [
  '.f......f.',
  '.ff....ff.',
  '.fEf..fEf.',
  '.fEffffEf.',
  'ffffffffff',
  'fOOffOOfff',
  'fkOffkOfff',
  'ffffnfffff',
  'fftmmtffff',
  '.ffffffff.',
  '..fuuuuf..',
  '...uuuf...',
  '...f..f...',
];
// the left wing (the right one is its mirror); the shoulder joins the body at its right edge
const BAT_WING: Record<string, string[]> = {
  up: [
    'v..........',
    'wv.........',
    'wwv........',
    'wwwvv......',
    'wwwwwvv....',
    'wwwwwwwvv..',
    'wwwwwwwwwvv',
    '.wwwwwwwwww',
    '.vw.wwwvwww',
    '.i..vw..vww',
    '.I...i...v.',
    '.....I.....',
  ],
  down: [
    '........vvv',
    '......vvwww',
    '....vvwwwww',
    '..vvwwwwwww',
    'vvwwwwwwwww',
    'vwwwwwwvwww',
    '.wwvwwvwwvw',
    '.vi.vwi.vw.',
    '..I..vI..v.',
  ],
  spread: [
    'vvvv.........',
    'wwwwvvvv.....',
    'wwwwwwwwvvvvv',
    'wwwwwwwwwwwww',
    'wwwvwwwwvwwww',
    '.ww.wwwv.wwvw',
    '.ji.vwj..vwj.',
    '.ii..i...vi..',
    '.I...I.....I.',
  ],
  back: ['......vv', '....vvww', '..vvwwww', 'vvwwwwww', '.wwwwwvw', '..wvwwvw', '...vwiw.', '....vI..'],
};

function batParts(pose: string): Part[] {
  let bx = 11; // body
  let by = 5;
  let wing = BAT_WING.up;
  let wy = -4; // wing top, from the body's top
  let body = BAT_BODY;
  let tilt = 0; // the right wing sits this much lower (a lean)
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 6;
      wing = BAT_WING.down;
      wy = 3;
      break;
    case 'windup':
      bx = 13;
      by = 4;
      wy = -5;
      tilt = -1;
      body = swap(BAT_BODY, [['fftmmtffff', 'ftmmmmtfff']]);
      break;
    case 'attack':
      // the dive: wings swept back, fangs out
      bx = 8;
      by = 8;
      wing = BAT_WING.back;
      wy = -1;
      tilt = 1;
      body = swap(BAT_BODY, [['fftmmtffff', 'ftmmmmtfff']]);
      break;
    case 'hurt':
      bx = 13;
      by = 6;
      wing = BAT_WING.down;
      wy = 2;
      tilt = 1;
      body = swap(BAT_BODY, [['fOOffOOfff', 'fkfffkffff'], ['fkOffkOfff', 'ffkfffkfff']]);
      break;
    case 'tell':
      // Icicles!: wings flung out flat, the icicles grown long and glinting, a screech
      bx = 12;
      by = 4;
      wing = BAT_WING.spread;
      wy = 0;
      body = swap(BAT_BODY, [['fOOffOOfff', 'fOWffOWfff'], ['fftmmtffff', 'ftmmmmtfff']]);
      break;
  }
  const ww = wing[0].length;
  return [
    [wing, bx - ww + 1, by + wy, { edge: '#141634' }],
    [flip(wing), bx + body[0].length - 1, by + wy + tilt, { edge: '#141634' }],
    [body, bx, by],
    ...extra,
  ];
}

// ------------------------------------------------------------------ yeti cub (a round white yeti kid with a snowball)

const SNOWBALL = ['#3a4a7a', '#6a84b4', '#a0bce0', '#d0e4f6', '#ffffff'];
const PEACH = ['#5e2e34', '#a0584e', '#d48a6c', '#f0b890', '#ffdcbc'];
const YETI_PAL: Pal = {
  k: INK, W: '#ffffff',
  m: '#3a1020', t: '#fff8f0', r: '#e05a6a', // mouth, teeth, tongue
  c: '#f08a8a', // rosy cheek
  F: '#4a4a78', // soles
};
const YETI_SHADES: Record<string, Shade> = {
  s: { ramp: SNOWFUR, same: 'pkWmtrc', top: [5, 5], left: [5], right: [2, 3], bottom: [1, 2], mid: 4 },
  a: { ramp: SNOWFUR, top: [5], left: [5], right: [2], bottom: [2], mid: 4 }, // arms
  p: { ramp: PEACH, same: 'kWmtrc', top: [4], left: [4], right: [2], bottom: [2], mid: 3 },
  b: { ramp: SNOWBALL, top: [4, 4], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  h: { ramp: PEACH, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // paws
};
// one round ball of shaggy fur, facing left: a warm face, big glinting eyes, a gappy grin
const YETI_BODY = [
  '.....s.s.s........',
  '....sssssssss.....',
  '..ssssssssssss....',
  '..sssssssssssss.s.',
  '.ssspppppppsssss..',
  '.sspppppppppsssss.',
  'sspWkppWkpppsssss.',
  'sspkkppkkpppssssss',
  'sscpppppppcpssssss',
  'ssspmmmmmmppssssss',
  'ssspmtrrtpppsssss.',
  '.ssspppppsssssssss',
  '.sssssssssssssssss',
  's.ssssssssssssss.s',
  '..sssssssssssss...',
  '...ss.ssss.sss....',
];
const YETI_EAR = ['.ss', 'ssp', 'ss.'];
const YETI_FEET = ['FFF....FFF'];
const BALL = ['.bbb.', 'bbbbb', 'bbbbb', 'bbbbb', '.bbb.'];
const BIG_BALL = ['..bbbb..', '.bbbbbb.', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', 'bbbbbbbb', '.bbbbbb.', '..bbbb..'];

function yetiParts(pose: string): Part[] {
  let x = 3; // body
  let y = 6;
  let body = YETI_BODY;
  let hand: [number, number] | null = [0, 19]; // near paw (holding the ball)
  let ball: [number, number] | null = [-2, 16];
  let back = false; // the throwing arm raised behind the body
  let far: [number, number] = [18, 16]; // far paw
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      y = 7;
      hand = [0, 20];
      ball = [-2, 17];
      far = [18, 17];
      break;
    case 'windup':
      // the snowball cocked back over the shoulder
      x = 4;
      y = 7;
      hand = [19, 3];
      ball = [18, -1];
      back = true;
      break;
    case 'attack':
      // the throw: leaning in, paw flung forward
      x = 2;
      y = 7;
      hand = [-4, 14];
      ball = null;
      body = swap(YETI_BODY, [['ssspmtrrtpppsssss.', 'ssspmmrrmpppsssss.']]);
      break;
    case 'hurt':
      x = 5;
      body = swap(YETI_BODY, [['sspWkppWkpppsssss.', 'sspkpppkppppsssss.'], ['sspkkppkkpppssssss', 'ssppkppppkppssssss']]);
      hand = [2, 20];
      ball = [0, 18];
      break;
    case 'tell':
      // Snowball!: a huge snowball hoisted overhead in both paws, grinning
      y = 7;
      hand = null;
      ball = null;
      body = swap(YETI_BODY, [['ssspmtrrtpppsssss.', 'ssspmttttpppsssss.']]);
      extra.push(
        limb(x + 3, y + 7, x + 4, y - 4, 'a', { edge: SNOWFUR[1] }),
        limb(x + 13, y + 6, x + 12, y - 4, 'a', { edge: SNOWFUR[1] }),
        [BIG_BALL, x + 4, y - 12],
        [['hh', 'hh'], x + 3, y - 5],
        [['hh', 'hh'], x + 12, y - 5],
      );
      break;
  }
  const parts: Part[] = [];
  const arm: Part[] = [];
  if (hand) {
    const sh: [number, number] = back ? [x + 14, y + 6] : [x + 1, y + 11];
    arm.push(limb(sh[0], sh[1], hand[0] + 1, hand[1], 'a', { edge: SNOWFUR[1] }));
    if (ball) arm.push([BALL, ball[0], ball[1]]);
    arm.push([['hh', 'hh'], hand[0], hand[1]]);
  }
  parts.push([['aa', 'hh'], far[0], far[1]]);
  if (back) parts.push(...arm);
  parts.push([YETI_FEET, x + 3, 22], [YETI_EAR, x + 13, y + 1], [body, x, y]);
  if (!back) parts.push(...arm);
  return [...parts, ...extra];
}

// ------------------------------------------------------------------ snow ogre (elite: a hulking blue-grey ogre with an ice club)

// blue-grey hide: shadows lean indigo, highlights lean warm grey
const OGRE = ['#1c2040', '#323c62', '#4e5e88', '#7084a8', '#98aec8', '#c8d8e6'];
const PELT = ['#2a1418', '#52281e', '#7e4426', '#a86a36', '#d0985a'];
const OGRE_PAL: Pal = {
  ...EYE,
  w: '#f4f6fa', W: '#ffffff', // hair tuft
  t: '#fff4dc', T: '#c8b48c', // tusks
  m: '#2a1020', // mouth
  b: OGRE[1], // brow shadow
  r: '#6e4426', R: '#a0703e', // rope belt, wrist wraps
  i: ICE[5], j: ICE[4], // frost sparkles
};
const OGRE_SHADES: Record<string, Shade> = {
  g: { ramp: OGRE, same: 'kOoWtTmbNE', top: [5, 4], left: [4], right: [2, 2], bottom: [1, 2], mid: 3 },
  G: { ramp: OGRE, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // far limbs
  N: { ramp: OGRE, same: 'g', top: [5], left: [5], right: [3], bottom: [2], mid: 4 }, // nose
  a: { ramp: OGRE, top: [5], left: [5], right: [2], bottom: [2], mid: 4 }, // near arm
  u: { ramp: PELT, same: 'rR', top: [4, 3], left: [3], right: [1], bottom: [0, 1], mid: 2 },
  f: { ramp: PELT, top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // foot wraps
  h: { ramp: WOOD, top: [5], left: [4], right: [2], bottom: [1], mid: 3 }, // club handle
};
// a small head sunk between the shoulders: a white tuft, a heavy brow, a big nose, tusks jutting from an underbite
const OGRE_HEAD = [
  '...wWww....',
  '..wwwwwww..',
  '.gggggwwgg.',
  'gggggggggg.',
  'bbbbbggggg.',
  'gOkbOkgggg.',
  'NNgggggggg.',
  'NNNggggggg.',
  'tgggggtggg.',
  'tmmmmmtgg..',
  '.ggggggg...',
];
// a pelt slung over the far shoulder, across the chest
const OGRE_PELT = [
  '.......uuuuuu',
  '....uuuuuuuuu',
  '..uuuuuuuuuuu',
  'uuuuuuuuuuuu.',
  'uuuuuuuuuu...',
  '.u.uuuuu.....',
  '...uuu.......',
  '....u........',
];
const OGRE_LOIN = ['uuuuuuuuuuuuuu', 'rrRrrrrrrrrRrr', 'uuuuuuuuuuuuuu', 'uuuuu.uuuuuuu.', '.uuu...uuu.uu.', '..u.....u..u..'];

function ogreParts(pose: string): Part[] {
  let bx = 0; // upper body
  let by = 0;
  let head = OGRE_HEAD;
  let hand: [number, number] = [7, 27]; // near hand
  let ang = (110 * Math.PI) / 180; // the club, from the hand
  let farHand: [number, number] = [31, 30];
  let legs: [number, number, number, number] = [14, 37, 25, 37]; // near foot x, y; far foot x, y
  let twoHands = false;
  let glow = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hand = [7, 28];
      farHand = [31, 31];
      break;
    case 'windup':
      // the club hauled up over the shoulder
      bx = 2;
      by = 1;
      hand = [17, 9];
      ang = (-60 * Math.PI) / 180;
      farHand = [33, 29];
      break;
    case 'attack':
      // the swing: lunging, the club smashed down in front
      bx = -3;
      by = 2;
      hand = [3, 26];
      ang = (140 * Math.PI) / 180;
      legs = [11, 37, 27, 37];
      farHand = [30, 31];
      break;
    case 'hurt':
      bx = 2;
      head = swap(OGRE_HEAD, [['gOkbOk', 'gbbbbb'], ['tmmmmmt', 'tmmmmmt']]);
      hand = [10, 28];
      ang = (100 * Math.PI) / 180;
      farHand = [33, 30];
      break;
    case 'tell':
      // the ice club hoisted overhead in both fists, frost crackling off it
      by = -1;
      hand = [18, 4];
      ang = (-55 * Math.PI) / 180;
      twoHands = true;
      glow = true;
      head = swap(OGRE_HEAD, [['tmmmmmt', 'tmmmmmt'], ['gOkbOk', 'gOWbOW']]);
      extra.push(dots([['i', [[16, -3], [29, 2], [12, 1]]], ['j', [[17, -3], [16, -2], [29, 3], [12, 2]]]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const torso = anyOf(ell(X(17), Y(24), 9.5, 7.5), ell(X(22), Y(16), 9, 6.5), ell(X(15), Y(18), 7, 6), ell(X(25), Y(23), 6, 7));
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const clubFrom: [number, number] = [hand[0] + 1 + ux * 3, hand[1] + 1 + uy * 3];
  const club: Part[] = [
    line(Math.round(hand[0] + 1 - ux * 2), Math.round(hand[1] + 1 - uy * 2), Math.round(clubFrom[0]), Math.round(clubFrom[1]), 'h'),
    crystal(clubFrom[0], clubFrom[1], ang, 13, 9, glow ? { pal: digits(ICE.map((c, i) => (i < 2 ? ICE[i + 1] : c))) } : {}),
  ];
  const far: Part[] = twoHands
    ? [capsule(X(27), Y(16), hand[0] + 4, hand[1] + 3, 2.6, 2.2, 'G'), [['GG', 'GG'], hand[0] + 3, hand[1] + 1]]
    : [capsule(X(28), Y(17), farHand[0], farHand[1] - 2, 2.8, 2.4, 'G'), [['.GG.', 'GGGG', 'GGGG', '.RR.'], farHand[0] - 1, farHand[1] - 2]];
  return [
    ...(pose === 'windup' ? club : []),
    ...far,
    capsule(X(25), 31, legs[2], legs[3] - 1, 3, 2.6, 'G'),
    capsule(X(15), 31, legs[0], legs[1] - 1, 3.2, 2.8, 'g'),
    [['ffffff', 'ffffff'], legs[2] - 3, legs[3] - 1],
    [['fffffff', 'fffffff'], legs[0] - 4, legs[1] - 1],
    vol(torso, [X(5), Y(9), X(32), Y(32)], [X(18), Y(17), 12, 12], OGRE, { edge: OGRE[0] }),
    vol(ell(X(15), Y(25), 6, 5), [X(9), Y(20), X(21), Y(30)], [X(13), Y(22), 7, 6], OGRE.map((_, i) => OGRE[Math.min(5, i + 1)])),
    [OGRE_PELT, X(15), Y(9)],
    [OGRE_LOIN, X(11), Y(27)],
    [head, X(5), Y(7)],
    ...(pose === 'windup' ? [] : club),
    capsule(X(12), Y(18), hand[0] + 1, hand[1] + 1, 3, 2.4, 'a', { edge: OGRE[0] }),
    [['.gg.', 'gggg', 'gggg', 'RRRR'], hand[0] - 1, hand[1] - 1],
    ...extra,
  ];
}

// ------------------------------------------------------------------ frost weaver (a crystal-backed white spider)

// dark violet legs with pale knees, a snow-white body, amber eyes
const LEGS = ['#120e26', '#231c44', '#3a2e66', '#56488c', '#7a6aae'];
const WEAVER_PAL: Pal = {
  k: INK, W: '#ffffff', O: '#ff9a2a', o: '#d8461a', e: '#ffd060', // eyes
  M: '#8a4a22', n: '#c87a3a', // mandibles
  x: '#463a78', X: '#6a5ca0', // markings on the abdomen
  K: LEGS[2], // knee bands
  s: '#f4fbff', // silk
};
const WEAVER_SHADES: Record<string, Shade> = {
  l: { ramp: ['#2a2848', '#4a4a74', '#7a7ea8', '#a8b0d0', '#d4dcee'], same: 'K', top: [4], left: [4], right: [3], bottom: [3], mid: 3 },
  L: { ramp: LEGS, top: [3], left: [3], right: [2], bottom: [2], mid: 3 },
  c: { ramp: SNOWFUR, same: 'kWOoeMn', top: [5, 5], left: [5], right: [2, 3], bottom: [1, 2], mid: 4 },
};
// the head and thorax, facing left: a cluster of amber eyes, hooked mandibles
const WEAVER_HEAD = [
  '....ccccccc...',
  '..ccoccoccccc.',
  '.cOOcWOccccccc',
  'cOocOOoccccccc',
  'cccccccccccccc',
  '.nMccccccccccc',
  'nM.ncccccccc..',
  'M...cccccc....',
];

/** A jointed leg: hip, knee, foot (frame coordinates), 1px thin, with a pale band at the knee. */
function spiderLeg(h: [number, number], k: [number, number], f: [number, number], ch: string, band = true): Part[] {
  return [line(h[0], h[1], k[0], k[1], ch), line(k[0], k[1], f[0], f[1], ch), ...(band ? [dots([['K', [[k[0], k[1]]]]])] : [])];
}

function weaverParts(pose: string): Part[] {
  let bx = 0; // body
  let by = 0;
  let head = WEAVER_HEAD;
  let lift = [0, 0]; // the front pair raised (silk) / thrust (attack): knee and foot offsets
  let abdY = 0;
  let silk = false;
  switch (pose) {
    case 'idle1':
      by = 1;
      abdY = 1;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      abdY = -1;
      lift = [-3, -6];
      break;
    case 'attack':
      bx = -2;
      by = 1;
      lift = [-2, -2];
      head = swap(WEAVER_HEAD, [['.nMccc', 'nMMccc'], ['nM..', 'M...']]);
      break;
    case 'hurt':
      bx = 2;
      head = swap(WEAVER_HEAD, [['.ceOcOc', '.ckkckc'], ['cOWcoOc', 'ckkckkc']]);
      break;
    case 'tell':
      // Silk!: rears up, front legs held high with silk strung between them, the crystals flaring
      bx = 1;
      by = -1;
      abdY = -2;
      lift = [-6, -12];
      silk = true;
      head = swap(WEAVER_HEAD, [['cOWcoOc', 'cWWcWOc'], ['.ceOcOc', '.ceWcWc']]);
      break;
  }
  const F = 21;
  const legs = (far: boolean): Part[] => {
    const out: Part[] = [];
    // knees arch high above the body, feet splay wide (front pair forward, back pairs back)
    const kx = far ? [-4, 5] : [-8, -3, 5, 11];
    const ky = far ? [5, 5] : [6, 3, 3, 7];
    const fx = far ? [-3, 2] : [-6, -3, 3, 5];
    for (let i = 0; i < kx.length; i++) {
      const hip: [number, number] = [bx + (far ? 15 + i * 4 : 12 + i * 3), by + 14];
      let knee: [number, number] = [hip[0] + kx[i], by + ky[i]];
      let foot: [number, number] = [knee[0] + fx[i], F];
      if (i === 0 && !far) {
        knee = [knee[0] + lift[0], knee[1] + Math.round(lift[1] / 2)];
        foot = [foot[0] + lift[0], foot[1] + lift[1]];
      }
      out.push(...spiderLeg(hip, knee, foot, far ? 'L' : 'l', !far));
    }
    return out;
  };
  const abd = ell(bx + 26, by + abdY + 11, 8.5, 6.5);
  const parts: Part[] = [
    ...legs(true),
    crystal(bx + 22, by + abdY + 7, (-105 * Math.PI) / 180, 7, 5),
    crystal(bx + 26, by + abdY + 6, (-75 * Math.PI) / 180, 11, 6),
    crystal(bx + 31, by + abdY + 8, (-40 * Math.PI) / 180, 7, 4),
    vol(abd, [bx + 16, by + abdY + 3, bx + 36, by + abdY + 19], [bx + 23, by + abdY + 8, 9, 7], SNOWFUR, { edge: SNOWFUR[1] }),
    dots([['x', [[bx + 26, by + abdY + 12], [bx + 27, by + abdY + 13], [bx + 28, by + abdY + 12], [bx + 27, by + abdY + 15]]], ['X', [[bx + 27, by + abdY + 12], [bx + 27, by + abdY + 14]]]]),
    [head, bx + 6, by + 9, { edge: SNOWFUR[1] }],
    ...legs(false),
  ];
  if (silk) {
    // silk strung from the raised front foot to the next knee, and a strand trailing from the spinnerets
    const fx = bx - 7;
    const fy = F - 12;
    const kx = bx + 11;
    const ky = by + 3;
    parts.push(
      line(fx + 1, fy, kx - 1, ky, 's', { late: true }),
      line(fx + 1, fy + 2, kx - 1, ky + 3, 's', { late: true }),
      line(fx + 4, fy - 1, fx + 6, fy + 3, 's', { late: true }),
      line(fx + 10, fy - 2, fx + 11, fy + 2, 's', { late: true }),
      line(bx + 35, by + abdY + 14, bx + 37, F, 's', { late: true }),
    );
  }
  return parts;
}

// ------------------------------------------------------------------ ice wraith (a floating hooded wisp of frost, a mirror for a face)

// deep night-blue cloak: shadows lean violet, highlights lean teal
const CLOAK = ['#0e0c26', '#1a1a44', '#262c64', '#354686', '#4a66a8', '#6a8cc8'];
const MIRROR = ['#4a5a7a', '#7a8cac', '#a8b8d4', '#d4e0f0', '#ffffff'];
const WRAITH_PAL: Pal = {
  d: '#0a0818', // the hood's dark recess
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', // the mirror's gold rim
  W: '#ffffff', m: MIRROR[2], M: MIRROR[1], n: MIRROR[3], p: '#f4c0a8', // mirror glass, a warm glint
  k: '#2a2440', // crack
  r: '#ff7a2a', R: '#c43a1a', // the amber clasp
  i: ICE[5], j: ICE[4], J: ICE[3], // frost wisps
};
const WRAITH_SHADES: Record<string, Shade> = {
  c: { ramp: CLOAK, same: 'f', top: [5, 4], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  f: { ramp: ICE, same: 'c', top: [5], left: [5], right: [3], bottom: [3], mid: 4 }, // frost trim
  h: { ramp: ['#3a4a8a', '#6a84c0', '#a0c0e8', '#d0e8fa', '#f4fcff'], top: [4], left: [4], right: [2], bottom: [1], mid: 3 }, // ghost hands
  w: { ramp: ICE, same: 'c', top: [4], left: [4], right: [2], bottom: [3], mid: 3 }, // frost wisps of the hem
};
// the hood and cloak, the face opening on the left; trimmed in frost
const WRAITH_CLOAK = [
  '............cc......',
  '..........cccc......',
  '.......ccccccc......',
  '.....cccccccccc.....',
  '...ccccccccccccc....',
  '..cffffffcccccccc...',
  '..fdddddddfcccccccc.',
  '.cfdddddddfcccccccc.',
  '.cfdddddddfcccccccc.',
  '.cfdddddddfccccccccc',
  '.cfdddddddfccccccccc',
  '..cfdddddfcccccccccc',
  '..ccfffffccccccccccc',
  '..ccrRcccccccccccccc',
  '...ccccccccccccccccc',
  '...cccccccccccccccc.',
  '....wcccccwccccccc..',
  '....wwcccwwcccwccc..',
  '.....wwcwww.ccwwc...',
  '.....ww..ww..cww....',
  '......w...w...w.....',
];
// the mirror face in its gold rim: two streaks of glare across the glass
const WRAITH_FACE = ['.gGGy.', 'gnnWnY', 'GnWnpY', 'gWnWmY', 'gnWmMY', '.yYYY.'];
const WRAITH_TAIL: Record<string, string[]> = {
  a: ['jjJJJj..', '.jJJjj..', '..jJj...', '...jJ...', '....jj..', '.....ji.', '......i.'],
  b: ['jjJJJj..', '.jJJjj..', '..jJj...', '..jJ....', '..jj....', '.ij.....', '.i......'],
};

function wraithParts(pose: string): Part[] {
  let x = 2;
  let y = 2;
  let face = WRAITH_FACE;
  let tail = WRAITH_TAIL.a;
  let near: [number, number] = [2, 17]; // ghost hands
  let farH: [number, number] = [20, 15];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      y = 3;
      tail = WRAITH_TAIL.b;
      near = [2, 18];
      farH = [20, 16];
      break;
    case 'windup':
      x = 4;
      y = 1;
      near = [9, 18];
      farH = [22, 9];
      break;
    case 'attack':
      x = 0;
      y = 3;
      tail = WRAITH_TAIL.b;
      near = [-3, 12];
      farH = [16, 13];
      face = swap(WRAITH_FACE, [['n', 'W'], ['m', 'n']]);
      break;
    case 'hurt':
      x = 4;
      y = 2;
      face = ['.gGGy.', 'gnnkWY', 'GnkWpY', 'gkWkmY', 'gnWmkY', '.yYYY.'];
      near = [5, 18];
      farH = [21, 17];
      break;
    case 'tell':
      // Mirror!: arms flung wide, the mirror face blazing
      y = 1;
      near = [-3, 9];
      farH = [24, 8];
      face = ['.gGGy.', 'gWWWWY', 'GWWWWY', 'gWWWnY', 'gnWnnY', '.yYYY.'];
      extra.push(
        dots([['i', [[x - 3, y + 7], [x - 4, y + 7], [x + 3, y - 3], [x + 3, y - 4], [x - 2, y + 1], [x - 3, y]]], ['j', [[x - 2, y + 7], [x + 3, y - 2], [x - 1, y + 2]]]], { late: true }),
      );
      break;
  }
  const hand = (p: [number, number]): Part => [['.hh', 'hhh', 'hh.'], p[0], p[1]];
  return [
    limb(x + 15, y + 12, farH[0] + 1, farH[1] + 1, 'c', { edge: CLOAK[0] }),
    hand(farH),
    [tail, x + 9, y + 19],
    [WRAITH_CLOAK, x, y],
    [face, x + 3, y + 6],
    limb(x + 8, y + 13, near[0] + 2, near[1] + 1, 'c', { edge: CLOAK[0] }),
    hand(near),
    ...extra,
  ];
}

// ------------------------------------------------------------------ hailcaller (a hooded goblin with a hail-orb staff)

// goblin teal-green: shadows lean blue, highlights lean yellow
const GOBF = ['#10262a', '#1c4638', '#2e6e48', '#4e9a52', '#86c45e', '#c4e480'];
// a rust-orange parka (the warm half of the picture), white fur trim
const PARKA = ['#2a1210', '#5a2418', '#8e3c1e', '#c0602a', '#e08a44'];
const HAIL_PAL: Pal = {
  ...EYE,
  F: GOBF[1], m: '#2a1020', T: '#fff4dc', // brow, mouth, tooth
  y: '#f2c230', Y: '#9a5a14', // toggles
  b: '#2a1810', B: '#4a3024', // boots
  i: ICE[5], j: ICE[4], J: ICE[3], I: ICE[2], // the orb and hail
  W: '#ffffff',
};
const HAIL_SHADES: Record<string, Shade> = {
  g: { ramp: GOBF, same: 'kOoWFmT', top: [4], left: [4], right: [2], bottom: [2], mid: 3 },
  N: { ramp: GOBF, same: 'g', top: [5], left: [5], right: [3], bottom: [3], mid: 4 }, // long nose
  h: { ramp: PARKA, same: 'yY', top: [4, 3], left: [3], right: [1, 1], bottom: [1], mid: 2 },
  v: { ramp: PARKA, top: [4], left: [4], right: [2], bottom: [2], mid: 3 }, // sleeve
  t: { ramp: SNOWFUR, top: [5], left: [5], right: [3], bottom: [3], mid: 4 }, // fur trim
  w: { ramp: WOOD, top: [5], left: [4], right: [2], bottom: [1], mid: 3 },
};
// hooded head, 15 wide, facing left: fur-trimmed hood, a long nose, a sly grin; an ear pokes out behind
const HAIL_HEAD = [
  '.....hhhhh.....',
  '...hhhhhhhhh...',
  '..hhhhhhhhhhh..',
  '.htttttthhhhhh.',
  '.tggggggthhhhgg',
  'tgFFgggggthhgg.',
  'tgOkggggggthh..',
  'NNggggggggthh..',
  'tgmmTgggggthh..',
  '.tgggggggthhh..',
  '..ttttttthhh...',
];
const HAIL_BODY = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhhyhhhhhhh',
  '.hhhhhhhhhhh',
  'hhhhyhhhhhhh',
  'hhhhhhhhhhhh',
  'tttttttttttt',
  '.ttttttttttt',
];
const HAIL_LEGS: Record<string, string[]> = {
  stand: ['..bB..bB.', '.bbB.bbB.'],
  lunge: ['.bB....bB', 'bbB...bbB'],
};
const ORB = ['.jjj.', 'jiijJ', 'jiWjJ', 'jjjJI', '.JJI.'];
const ORB_BIG = ['..jjj..', '.jiiijJ', 'jiiWijJ', 'jiWiijJ', 'jijijJI', '.jjjJI.', '..JJI..'];

/** The staff from its foot (x0, y0) to its top (x1, y1), a three-pronged claw at the top holding the orb. */
function hailStaff(x0: number, y0: number, x1: number, y1: number, big = false): Part[] {
  const orb = big ? ORB_BIG : ORB;
  const r = (orb.length - 1) / 2;
  return [
    line(x0, y0, x1, y1, 'w'),
    [orb, Math.round(x1 - r), Math.round(y1 - orb.length + 1)],
    dots([['w', [[x1 - 2, y1 - 1], [x1 + 2, y1 - 1], [x1 - 2, y1 - 2], [x1 + 2, y1 - 2]]]]),
  ];
}

function hailParts(pose: string): Part[] {
  const F = 27;
  let hx = 5; // head
  let hy = 3;
  let bx = 7; // body
  let by = 13;
  let legs = HAIL_LEGS.stand;
  let head = HAIL_HEAD;
  let st: [number, number, number, number] = [4, 27, 4, 8]; // staff foot, top
  let hand: [number, number] = [3, 16];
  let big = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      hy = 4;
      by = 14;
      hand = [3, 17];
      break;
    case 'windup':
      hx = 7;
      bx = 8;
      st = [10, 24, 6, 5];
      hand = [7, 13];
      break;
    case 'attack':
      // the staff thrust out, hail spitting from the orb
      hx = 4;
      bx = 6;
      legs = HAIL_LEGS.lunge;
      st = [8, 22, 1, 11];
      hand = [3, 15];
      extra.push(dots([['i', [[-5, 9], [-7, 12], [-4, 14]]], ['J', [[-4, 9], [-6, 12], [-3, 14]]]]));
      break;
    case 'hurt':
      hx = 7;
      hy = 4;
      bx = 8;
      by = 14;
      head = swap(HAIL_HEAD, [['tgOkgg', 'tgkkgg'], ['tgFFgg', 'tgggFF']]);
      st = [6, 27, 8, 9];
      hand = [5, 17];
      break;
    case 'tell':
      // Hail Armor!: the staff thrust up high, the orb blazing, hailstones whirling round it
      hy = 3;
      st = [5, 22, 5, 2];
      hand = [4, 10];
      big = true;
      head = swap(HAIL_HEAD, [['tgOkgg', 'tgOWgg'], ['tgmmTg', 'tgmTTg']]);
      extra.push(dots([['i', [[-1, -6], [10, -3], [-1, 2], [11, 3]]], ['J', [[0, -6], [10, -2], [0, 2], [11, 4]]]]));
      break;
  }
  // the poses above are laid out 4 rows high: the upper body comes down to meet the boots
  const U = 4;
  return [
    [legs, bx + 1, F - legs.length + 1],
    [HAIL_BODY, bx, by + U],
    [head, hx, hy + U],
    ...hailStaff(st[0], Math.max(st[1], F - 4), st[2], st[3] + U, big),
    limb(bx + 3, by + 3 + U, hand[0] + 1, hand[1] + U, 'v', { edge: PARKA[1] }),
    [['tt', 'gg', 'gg'], hand[0], hand[1] - 1 + U],
    ...extra.map(([r, x, y, o]): Part => [r, x, y + U, o]),
  ];
}

// ------------------------------------------------------------------ glacier tortoise (elite: its shell is a glacier)

// warm leathery hide (the warm half against the ice): shadows lean plum, highlights lean khaki
const HIDE = ['#2a1820', '#503026', '#7a5032', '#a67a46', '#cca868', '#ecd49a'];
const TORT_PAL: Pal = {
  ...EYE,
  m: '#2a1020', // mouth
  B: '#3a2a22', b: '#6a5040', // beak
  n: '#f4ecd8', // toenails
  P: '#1e3a2e', p: '#2e5a3a', q: '#4a7e46', // a little pine on the glacier
  T: '#4e2c16', // its trunk
  S: '#ffffff', s: '#dfeaf6', // snow
  i: ICE[5], // glints
};
const TORT_SHADES: Record<string, Shade> = {
  h: { ramp: HIDE, same: 'kOoWmBb', top: [4, 4], left: [4], right: [2], bottom: [1, 2], mid: 3 },
  H: { ramp: HIDE, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // far legs
};
const TORT_HEAD = [
  '....hhhhh...',
  '..hhhhhhhhh.',
  '.hhOkhhhhhhh',
  'bhhhhhhhhhhh',
  'Bbmmmhhhhhhh',
  '.Bhhhhhhhhh.',
  '..hhhhhhh...',
];
const TORT_FOOT = ['.hhhh.', 'hhhhhh', 'hhhhhh', 'hhhhhh', 'hhhhhhh', 'nhnhnhh'];

function tortParts(pose: string): Part[] {
  let sx = 0; // shell
  let sy = 0;
  let head = TORT_HEAD;
  let hx = 0;
  let hy = 13;
  let lift = 0; // front foot raised
  let glow = false;
  switch (pose) {
    case 'idle1':
      sy = 1;
      hy = 14;
      break;
    case 'windup':
      sx = 1;
      hx = 4;
      hy = 14;
      break;
    case 'attack':
      // a lunging snap
      sx = -1;
      sy = 1;
      hx = -4;
      hy = 15;
      head = swap(TORT_HEAD, [['Bbmmmhhhhhhh', 'Bmmmmmhhhhhh'], ['.Bhhhhhhhhh.', 'Bbmmhhhhhhh.']]);
      break;
    case 'hurt':
      sx = 1;
      hx = 3;
      hy = 12;
      head = swap(TORT_HEAD, [['.hhOkhhhhhhh', '.hhkkhhhhhhh']]);
      break;
    case 'tell':
      // Brr-icade!: rears up on its hind legs, front foot raised to stamp, the glacier flaring
      sy = -1;
      hx = 1;
      hy = 8;
      lift = 3;
      glow = true;
      head = swap(TORT_HEAD, [['.hhOkhhhhhhh', '.hhOWhhhhhhh'], ['Bbmmmhhhhhhh', 'Bmmmmmhhhhhh']]);
      break;
  }
  const F = 31;
  const X = (x: number) => x + sx;
  const Y = (y: number) => y + sy;
  const shell = (x: number, y: number) => ell(X(27), Y(20), 17, 13)(x, y) && y <= Y(24);
  const iceRamp = glow ? ICE.map((_, i) => ICE[Math.min(5, i + 1)]) : ICE;
  // a snow cap along the top of the dome, drips here and there; a dark band where the ice meets the ground
  const snow: [string, [number, number][]][] = [['S', []], ['s', []]];
  const band: [string, [number, number][]][] = [['0', []], ['1', []]];
  for (let x = X(11); x <= X(43); x++) {
    let top = Y(6);
    while (top <= Y(24) && !shell(x, top)) top++;
    if (top > Y(24)) continue;
    snow[0][1].push([x, top]);
    snow[1][1].push([x, top + 1]);
    if (hash2(x, 3) > 0.62) snow[1][1].push([x, top + 2]);
    band[1][1].push([x, Y(23)]);
    if (shell(x, Y(24))) band[0][1].push([x, Y(24)]);
  }
  const parts: Part[] = [
    // far legs, tail
    [TORT_FOOT, X(18), F - 5, { shades: { h: TORT_SHADES.H } }],
    [TORT_FOOT, X(39), F - 5, { shades: { h: TORT_SHADES.H } }],
    [['hhh.', '.hhh', '..hh'], X(42), Y(21)],
    // neck and head
    capsule(X(11), Y(19), hx + 8, hy + 3, 3.4, 2.6, 'h'),
    [head, hx, hy],
    // the glacier: a deep rim, the ice dome, spires, a snow cap and a little pine
    vol(shell, [X(9), Y(6), X(45), Y(24)], [X(20), Y(10), 16, 11], iceRamp, { edge: ICE[0] }),
    dots(band, { pal: digits(ICE) }),
    dots(snow),
    crystal(X(17), Y(11), (-115 * Math.PI) / 180, 8, 5, { pal: digits(iceRamp) }),
    crystal(X(30), Y(8), (-80 * Math.PI) / 180, 11, 6, { pal: digits(iceRamp) }),
    crystal(X(38), Y(12), (-45 * Math.PI) / 180, 8, 5, { pal: digits(iceRamp) }),
    [['..q..', '.pqp.', '.pqp.', 'Ppqpp', 'PPpPp', '..T..'], X(23), Y(1)],
    // crevasses: dark cracks with a lit lip
    dots([['1', [[X(20), Y(14)], [X(21), Y(15)], [X(21), Y(16)], [X(22), Y(17)], [X(33), Y(13)], [X(33), Y(14)], [X(34), Y(15)], [X(27), Y(18)], [X(28), Y(19)]]], ['5', [[X(19), Y(14)], [X(20), Y(15)], [X(32), Y(13)], [X(26), Y(18)]]]], { pal: digits(ICE) }),
    // near legs
    [TORT_FOOT, X(12), F - 5 - lift],
    [TORT_FOOT, X(34), F - 5],
  ];
  if (glow) parts.push(dots([['i', [[X(16), Y(1)], [X(31), Y(-5)], [X(44), Y(5)]]]], { late: true }));
  return parts;
}

// ------------------------------------------------------------------ drift troll (a shaggy snow troll with a shovel)

// shaggy grey-white fur, a shade darker than the yeti's so it holds its shape on snow
const SHAG = ['#2c2a4c', '#4e4e78', '#7a7ea6', '#a6aecc', '#d0d8ec', '#f4f8ff'];
const TSKIN = ['#1e2238', '#343c5a', '#56627e', '#7c8aa2', '#a8b4c4'];
const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const TROLL_PAL: Pal = {
  k: INK, O: '#ffb02a', W: '#ffffff', m: '#2a1020', t: '#fff4dc',
  S: '#ffffff', s: '#dfeaf6', // snow on the shovel
};
const TROLL_SHADES: Record<string, Shade> = {
  N: { ramp: ['#5a1e2a', '#a03a40', '#d8605a', '#f48a78', '#ffbca8'], top: [4], left: [4], right: [2], bottom: [1], mid: 3 }, // the big red nose
  a: { ramp: SHAG, top: [5], left: [4], right: [2], bottom: [2], mid: 3 }, // arms
  A: { ramp: SHAG, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // far arm
  l: { ramp: TSKIN, top: [4], left: [3], right: [1], bottom: [1], mid: 2 }, // legs and feet
  h: { ramp: TSKIN, top: [4], left: [4], right: [2], bottom: [1], mid: 3 }, // hands
  w: { ramp: WOOD, top: [5], left: [4], right: [2], bottom: [1], mid: 3 },
};

/** A shaggy mass: a rounded volume with short dark strands raked down it and a ragged fringe at the bottom. */
export function shag(m: Mask, box: [number, number, number, number], light: [number, number, number, number], ramp: string[], seed: number, o: PartOpts = {}): Part {
  const [x0, y0] = box;
  const ragged: Mask = (x, y) => {
    if (!m(x, y)) return false;
    // the fringe: drop 0-4 px off the bottom of each column
    const cut = Math.floor(hash2(x, seed) * 4.6);
    for (let d = 1; d <= cut; d++) if (!m(x, y + d)) return false;
    return true;
  };
  const p = vol(ragged, box, light, ramp, o);
  p[0] = p[0].map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c === '.' || +c < 2) return c;
        const gx = x + x0;
        const gy = y + y0;
        return hash2(gx, Math.floor((gy + (gx % 3)) / 3) + seed) < 0.2 ? String(+c - 1) : c;
      })
      .join(''),
  );
  return p;
}

/** A shovel held at (hx, hy), its blade toward `ang`; a heap of snow on it when `snowy`. */
function shovel(hx: number, hy: number, ang: number, snowy = false): Part[] {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const vx = -uy;
  const vy = ux;
  const P = (u: number, v: number): [number, number] => [Math.round(hx + ux * u + vx * v), Math.round(hy + uy * u + vy * v)];
  const blade: Record<string, [number, number][]> = { 1: [], 2: [], 3: [], 4: [] };
  const heap: [number, number][] = [];
  const heapLit: [number, number][] = [];
  for (let u = 9; u <= 16; u += 0.5)
    for (let v = -3; v <= 3; v += 0.5) {
      const half = 3 - Math.max(0, u - 14) * 1.2;
      if (Math.abs(v) > half) continue;
      const t = u < 9.6 ? 1 : Math.abs(v) > half - 0.6 ? (v < 0 ? 4 : 1) : v < 0 ? 3 : 2;
      blade[t].push(P(u, v));
    }
  if (snowy)
    for (let u = 10; u <= 15; u += 0.5)
      for (let w = 0.5; w <= 3; w += 0.5) {
        const side = vx * -0.6 + vy * -0.8 > 0 ? -1 : 1; // pile on the side facing up
        if (w > 2.5 - Math.abs(u - 12.5) * 0.5) continue;
        (w > 1.6 ? heapLit : heap).push(P(u, side * (2.5 + w)));
      }
  return [
    line(Math.round(hx - ux * 3), Math.round(hy - uy * 3), Math.round(hx + ux * 9), Math.round(hy + uy * 9), 'w'),
    dots([['w', [P(-3, -1.5), P(-3, 1.5), P(-3, -1), P(-3, 1)]]]),
    dots(Object.entries(blade).filter(([, p]) => p.length) as [string, [number, number][]][], { pal: digits(STEEL) }),
    ...(snowy ? [dots([['s', heap], ['S', heapLit]])] : []),
  ];
}

function trollParts(pose: string): Part[] {
  let bx = 0; // upper body
  let by = 0;
  let hand: [number, number] = [5, 22]; // near hand
  let ang = (100 * Math.PI) / 180; // the shovel from the hand
  let snowy = false;
  let eyes: [string, string] = ['kO', 'kO'];
  let mouth = ['mmmm', 'tmmt'];
  let farHand: [number, number] = [29, 27];
  switch (pose) {
    case 'idle1':
      by = 1;
      hand = [5, 23];
      farHand = [29, 28];
      break;
    case 'windup':
      // the shovel hauled back over the shoulder
      bx = 2;
      by = 1;
      hand = [25, 10];
      ang = (-55 * Math.PI) / 180;
      snowy = true;
      break;
    case 'attack':
      // flung forward, snow and all
      bx = -2;
      by = 2;
      hand = [3, 20];
      ang = (155 * Math.PI) / 180;
      mouth = ['mmmm', 'mmmm'];
      break;
    case 'hurt':
      bx = 2;
      eyes = ['kk', 'kk'];
      hand = [8, 23];
      ang = (95 * Math.PI) / 180;
      farHand = [31, 27];
      break;
    case 'tell':
      // Snowdrift!: a heaped shovelful hoisted high, about to be flung
      by = -1;
      hand = [22, 5];
      ang = (-40 * Math.PI) / 180;
      snowy = true;
      eyes = ['WO', 'WO'];
      mouth = ['mmmm', 'mttm'];
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const body = anyOf(ell(X(18), Y(21), 10.5, 9.5), ell(X(14), Y(12), 7.5, 7), ell(X(21), Y(13), 8.5, 7.5));
  const shov = shovel(hand[0] + 1, hand[1] + 1, ang, snowy);
  const back = pose === 'windup' || pose === 'tell';
  // raised high, the shovel arm swings up behind the body
  const arm: Part[] = [
    capsule(back ? X(20) : X(11), back ? Y(12) : Y(17), hand[0] + 1, hand[1] + 1, 2.8, 2.4, 'a', { edge: SHAG[1] }),
    [['.hh.', 'hhhh', 'hhhh'], hand[0] - 1, hand[1]],
  ];
  return [
    ...(back ? [...shov, ...arm] : []),
    capsule(X(26), Y(16), farHand[0], farHand[1], 2.8, 2.4, 'A'),
    [['.hh.', 'hhhh', 'h.h.'], farHand[0] - 1, farHand[1]],
    capsule(X(14), 30, X(13), 33, 2.6, 2.6, 'l'),
    capsule(X(22), 30, X(23), 33, 2.6, 2.6, 'l'),
    [['lllllll', 'lllllll'], X(9), 34],
    [['lllllll', 'lllllll'], X(21), 34],
    shag(body, [X(6), Y(4), X(30), Y(31)], [X(15), Y(11), 15, 16], SHAG, 7, { edge: SHAG[1] }),
    // the face in the fur: eyes peeking under the fringe, a big red nose, a snaggle-toothed grin
    [[eyes[0] + '..' + eyes[1]], X(8), Y(10)],
    [['.NNN', 'NNNNN', 'NNNNN', '.NNN.'], X(5), Y(12)],
    [mouth, X(9), Y(16)],
    ...(back ? [] : [...shov, ...arm]),
  ];
}

// ------------------------------------------------------------------ aurora wisp (a ribbon of aurora light round a small bright core)

const WISP_PAL: Pal = {
  // the ribbon: green near the core, through teal, to magenta at the tips; each with a lit and a shaded tone
  a: '#2a9a62', A: '#6ae890', b: '#1a8aa0', B: '#5ad8e8', c: '#8a2a9a', C: '#e070c8', d: '#5a1a6a', D: '#f8a8e0',
  W: '#ffffff', Y: '#fff0a0', y: '#f2c230', o: '#ff9a3a', O: '#d8661a', // the core
  k: INK, h: '#fff8d0', // eyes, halo
};

/** One aurora ribbon: a path (t from 0 at the core to 1 at the tip) swept with a width, lit along its upper edge. */
function ribbon(path: (t: number) => [number, number], w: (t: number) => number): Part {
  const cells = new Map<string, [number, number, number, number]>(); // x,y -> t, lit
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const [x, y] = path(t);
    const r = w(t);
    for (let yy = Math.floor(y - r); yy <= y + r; yy++)
      for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const dy = yy + 0.5 - y;
        const dx = xx + 0.5 - x;
        if (dx * dx + dy * dy > r * r) continue;
        const key = `${xx},${yy}`;
        const lit = dy - dx * 0.3 < -r * 0.15 ? 1 : 0;
        if (!cells.has(key)) cells.set(key, [xx, yy, t, lit]);
      }
  }
  const spec: Record<string, [number, number][]> = {};
  for (const [x, y, t, lit] of cells.values()) {
    const band = t < 0.3 ? 'a' : t < 0.55 ? 'b' : t < 0.82 ? 'c' : 'd';
    const ch = lit ? band.toUpperCase() : band;
    (spec[ch] ??= []).push([x, y]);
  }
  return dots(Object.entries(spec));
}

function wispParts(pose: string): Part[] {
  let cx = 13; // the core
  let cy = 11;
  let ph = 0; // wave phase
  let spread = 1; // how far the ribbons reach
  let lash = 0; // ribbons swept forward (to the left)
  let core = ['.yYy.', 'yYWWy', 'YWWWo', 'yWWoO', '.ooO.'];
  let halo = true;
  switch (pose) {
    case 'idle1':
      cy = 12;
      ph = 1.6;
      break;
    case 'windup':
      cx = 15;
      ph = 0.8;
      spread = 0.85;
      break;
    case 'attack':
      cx = 10;
      cy = 12;
      ph = 2.4;
      lash = 1;
      break;
    case 'hurt':
      cx = 15;
      ph = 3.2;
      spread = 0.75;
      core = ['.oOo.', 'oyYyO', 'OkyyO', 'oyykO', '.OOO.'];
      halo = false;
      break;
    case 'tell':
      // Shimmer!: the ribbons fling out into a wide ring, the core blazing
      ph = 0.4;
      spread = 1.35;
      core = ['.YWY.', 'YWWWY', 'WWWWW', 'YWWWy', '.YWy.'];
      break;
  }
  const sp = spread;
  // aurora curtains hanging from the core and waving (they stream back when it darts), a thin arc over the top
  const hang = (dx: number, len: number, fan: number, k: number) => (t: number): [number, number] => {
    const wave = Math.sin(t * 6 + ph + k) * 2.2 * (0.25 + t);
    return [cx + dx + t * fan * sp + wave + lash * t * 11, cy + 1 + t * len * (1 - lash * 0.35) * Math.min(1.1, sp)];
  };
  const ribbons: Part[] = [
    ribbon(hang(3, 14, 5, 4), (t) => 1.8 - t * 1.1),
    ribbon(hang(-2, 15, -4, 0), (t) => 1.8 - t * 1.1),
    ribbon(hang(0.5, 19, 1, 2), (t) => 2.1 - t * 1.3),
    ribbon(
      (t) => {
        const a = Math.PI * (1.05 + t * 0.9);
        return [cx + Math.cos(a) * 6.5 * sp + lash * 3, cy - 1 + Math.sin(a) * 4.5 * sp];
      },
      () => 0.9,
    ),
  ];
  for (const r of ribbons.slice(1)) r[3] = { edge: '#1a1030' };
  const parts: Part[] = [...ribbons, [core, cx - 2, cy - 2]];
  if (halo)
    parts.push(dots([['h', [[cx - 4, cy - 4], [cx + 4, cy - 4], [cx - 4, cy + 4], [cx + 4, cy + 4], [cx, cy - 5], [cx - 5, cy]]]], { late: true }));
  return parts;
}

// ------------------------------------------------------------------ frostbound knight (elite: an armoured knight sealed in ice)

// blackened steel: shadows lean indigo, highlights lean cold
const DARKSTEEL = ['#121626', '#20283e', '#343f5c', '#4e5c7c', '#76869e', '#a8b8c8'];
const FK_PAL: Pal = {
  k: '#0a0814', E: '#ffd06a', e: '#ff6a1a', // the visor slit and the ember eyes behind it
  K: DARKSTEEL[1],
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', // gold trim
  i: ICE[4], I: ICE[5], j: ICE[3], // icicles and frost
  A: ICE[5], L: ICE[4], C: ICE[2], T: '#ffffff', h: '#3a2418', // the ice-sheathed greatsword
};
const FK_SHADES: Record<string, Shade> = {
  a: { ramp: DARKSTEEL, same: 'kEeKgGyY', top: [5, 4], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  v: { ramp: DARKSTEEL, top: [4], left: [4], right: [2], bottom: [1], mid: 3 }, // arms
  r: { ramp: KNIT, same: 'gy', top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // the frozen tabard
  f: { ramp: ICE, top: [5], left: [5], right: [3], bottom: [2], mid: 4 }, // frost crust
};
// a rounded great helm: ember eyes behind the slit, breathing holes, a gold brow band
const FK_HELM = [
  '...aaaaa...',
  '..aaaaaaaa.',
  '.aaaaaaaaaa',
  '.aaaaaaaaaa',
  'kkEkEkkaaaa',
  'aaaaaaaaaaa',
  '.aKaKaaaaaa',
  '.aaaaaaaaa.',
  '..aaaaaaa..',
];
const FK_BODY = [
  '...aaaaaaaa...',
  '..aaaaaaaaaaa.',
  '.aaarrrraaaaaa',
  '.aaarrrraaaaaa',
  '.aaarrrraaaaaa',
  '..aarrrraaaaa.',
  '..aarrrraaaaa.',
  '..ggrgrgygggy.',
  '.aaarrrraaaaaa',
  '.aaarrrraaaaa.',
  '..aarrrraaaa..',
  '...rrrrr......',
  '...r.rr.r.....',
  '...i..i.......',
];
// a pauldron crusted with frost
const FK_PAULDRON = ['..aaaa..', '.aaaaaa.', 'affffaaa', 'affffaaa', '.aaaaaa.'];
const FK_LEGS: Record<string, string[]> = {
  stand: ['..aaa..aaa.', '..aaa..aaa.', '..aaa..aaa.', '..aaa..aaa.', '..aaa..aaa.', '.aaaa.aaaa.', 'aaaaa.aaaa.'],
  lunge: ['.aaa....aaa', '.aaa....aaa', 'aaa......aaa', 'aaa......aaa', 'aaa.......aaa', 'aaaa......aaaa', 'aaaa......aaaa'],
};

/** A greatsword sheathed in ice: hands at (hx, hy), blade toward (dx, dy) (8-way), `len` px. */
function frostSword(hx: number, hy: number, dx: number, dy: number, len: number): Part {
  const A: [number, number][] = [];
  const C: [number, number][] = [];
  const L: [number, number][] = [];
  const diag = dx !== 0 && dy !== 0;
  for (let i = 2; i < len + 2; i++) {
    const x = hx + dx * i;
    const y = hy + dy * i;
    L.push([x, y]);
    if (i < len + 1) {
      C.push(diag ? [x + (dx < 0 ? 1 : -1), y] : dy === 0 ? [x, y + 1] : [x + 1, y]);
      A.push(diag ? [x, y + (dy < 0 ? 1 : -1)] : dy === 0 ? [x, y - 1] : [x - 1, y]);
    }
  }
  const px = -dy;
  const py = dx;
  const guard: [number, number][] = [];
  for (let k = -3; k <= 3; k++) guard.push([hx + dx + px * k, hy + dy + py * k]);
  return dots([
    ['C', C],
    ['A', A],
    ['L', L],
    ['g', guard],
    ['T', [L[L.length - 1]]],
    ['h', [[hx, hy], [hx - dx, hy - dy]]],
    ['y', [[hx - dx * 2, hy - dy * 2]]],
  ]);
}

function fknightParts(pose: string): Part[] {
  const F = 39;
  let x = 0;
  let y = 0;
  let legs = FK_LEGS.stand;
  let lx = 10;
  let helm = FK_HELM;
  let hand: [number, number] = [9, 22]; // both hands on the hilt (laid out 6 rows high, see U below)
  let sw: [number, number, number] = [0, 1, 9]; // planted point down
  let frost = false;
  switch (pose) {
    case 'idle1':
      y = 1;
      hand = [9, 23];
      sw = [0, 1, 8];
      break;
    case 'windup':
      // the greatsword hauled up over the shoulder
      x = 1;
      y = 1;
      hand = [17, 14];
      sw = [1, -1, 13];
      break;
    case 'attack':
      x = -2;
      y = 2;
      legs = FK_LEGS.lunge;
      lx = 8;
      hand = [8, 20];
      sw = [-1, 0, 15];
      break;
    case 'hurt':
      x = 2;
      helm = swap(FK_HELM, [['E', 'k']]);
      hand = [12, 24];
      sw = [-1, 1, 11];
      break;
    case 'tell':
      // the greatsword raised high, frost bursting off the armour, the embers blazing
      y = -1;
      hand = [12, 12];
      sw = [0, -1, 14];
      frost = true;
      helm = swap(FK_HELM, [['kkEkEkk', 'kEEkEEk']]);
      break;
  }
  const U = 6; // the upper body comes down to meet the legs
  y += U;
  hand = [hand[0], hand[1] + U];
  const by = 13 + y;
  const parts: Part[] = [
    [legs, lx, F - legs.length + 1],
    [FK_BODY, 8 + x, by],
    [FK_PAULDRON, 18 + x, by - 1],
    [helm, 10 + x, 4 + y],
    crystal(13 + x, 5 + y, (-100 * Math.PI) / 180, 6, 4),
    crystal(16 + x, 5 + y, (-70 * Math.PI) / 180, 8, 4),
    crystal(19 + x, 7 + y, (-35 * Math.PI) / 180, 6, 4),
    crystal(23 + x, by + 1, (-30 * Math.PI) / 180, 6, 4),
    limb(21 + x, by + 3, hand[0] + 2, hand[1], 'v', { edge: DARKSTEEL[0] }),
    frostSword(hand[0], hand[1], ...sw),
    limb(11 + x, by + 3, hand[0], hand[1], 'v', { edge: DARKSTEEL[0] }),
    [['vvv', 'vvv'], hand[0] - 1, hand[1] - 1],
    [FK_PAULDRON, 6 + x, by - 1],
  ];
  if (frost) parts.push(dots([['I', [[4, 2 + U], [26, U], [3, 18 + U], [28, 16 + U]]], ['i', [[5, 2 + U], [4, 3 + U], [26, 1 + U], [3, 19 + U], [28, 17 + U]]]], { late: true }));
  return parts;
}

// ------------------------------------------------------------------ rimehorn (mini-boss: a colossal mountain ram who collects the toll)

const FLEECE = ['#363456', '#5c5e88', '#8a8eb4', '#b6bcd8', '#dce2f2', '#ffffff'];
const SLATE = ['#12101c', '#242236', '#3a3852', '#56566e', '#7c7a94', '#a4a2ba'];
// ram's horn: warm amber-ivory, the warm half of the picture
const HORN = ['#4a2a1a', '#7a4a26', '#a87436', '#d0a05a', '#ecc88a', '#fff0c8'];
const RAM_PAL: Pal = {
  k: INK, O: '#ffb02a', o: '#d8661a', // eye, a goat's bar pupil
  n: '#0c0a14', // nostril
  R: '#a01e24', r: '#d0342e', // the toll collar
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', // the brass toll bell
  h: '#1a141e', H: '#3a3040', // hooves
  w: '#ffffff', W: '#cfe4f4', // breath steam
  b: '#e8f0fa', B: '#a8b8d4', // frosty beard
};
const RAM_SHADES: Record<string, Shade> = {
  l: { ramp: SLATE, top: [5], left: [5], right: [3], bottom: [3], mid: 4 },
  L: { ramp: SLATE, top: [3], left: [3], right: [2], bottom: [2], mid: 3 },
};

/**
 * A swept stroke: a path (t from 0 to 1) with a width; `col(t, side, lit)` names each pixel: `side` runs -1..1 across
 * the stroke, `lit` (-1..1) is how much that spot of a round tube faces the light (top left).
 */
export function sweep(
  path: (t: number) => [number, number],
  w: (t: number) => number,
  col: (t: number, side: number, lit: number) => string,
  steps = 120,
  o?: PartOpts,
): Part {
  // the path's extent and length, to size the grid and pick a step (about one sample per pixel of length)
  let len = 0;
  let [px, py] = path(0);
  let x0 = px;
  let y0 = py;
  let x1 = px;
  let y1 = py;
  let rmax = 0;
  for (let i = 1; i <= 24; i++) {
    const [x, y] = path(i / 24);
    len += Math.hypot(x - px, y - py);
    [px, py] = [x, y];
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  for (let i = 0; i <= 8; i++) rmax = Math.max(rmax, w(i / 8));
  const gx0 = Math.floor(x0 - rmax - 2);
  const gy0 = Math.floor(y0 - rmax - 2);
  const gw = Math.ceil(x1 + rmax + 2) - gx0 + 1;
  const gh = Math.ceil(y1 + rmax + 2) - gy0 + 1;
  const cells: string[][] = Array.from({ length: gh }, () => Array<string>(gw).fill('.'));
  const n = Math.min(steps, Math.max(8, Math.ceil(len * 1.4)));
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const [x, y] = path(t);
    const [xa, ya] = path(Math.min(1, t + 0.01));
    const [xb, yb] = path(Math.max(0, t - 0.01));
    let nx = -(ya - yb);
    let ny = xa - xb;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    const r = w(t);
    for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy++)
      for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx++) {
        const dx = xx + 0.5 - x;
        const dy = yy + 0.5 - y;
        if (dx * dx + dy * dy > r * r) continue;
        const row = cells[yy - gy0];
        if (!row || xx - gx0 < 0 || xx - gx0 >= gw) continue;
        const side = (dx * nx + dy * ny) / r;
        row[xx - gx0] = col(t, side, side * (nx * -0.6 + ny * -0.8));
      }
  }
  return [cells.map((r) => r.join('')), gx0, gy0, o];
}

/** The great curled horn round (cx, cy): up from the skull, back, down and curling forward round the ear. */
function ramHorn(cx: number, cy: number, scale = 1, dark = false): Part {
  const a0 = (-125 * Math.PI) / 180;
  const a1 = (215 * Math.PI) / 180;
  return sweep(
    (t) => {
      const a = a0 + (a1 - a0) * t;
      const r = (9.5 - t * 6) * scale;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92];
    },
    (t) => (3.6 - t * 2.2) * scale,
    (t, side) => {
      // ridges across the horn, lit on its outer (upper left) side
      const ridge = Math.floor(t * 17) % 2 === 0;
      let tone = side < -0.35 ? 2 : side > 0.4 ? 4 : 3;
      if (ridge) tone -= 1;
      if (t > 0.9) tone += 1;
      if (dark) tone -= 1;
      return String(Math.max(0, Math.min(5, tone)));
    },
    140,
    { pal: digits(HORN), edge: HORN[0] },
  );
}

function ramParts(pose: string): Part[] {
  const F = 45;
  let bx = 0; // body
  let by = 0;
  let hx = 0; // head and horns
  let hy = 0;
  let eye = ['.kkk', 'OkkO', '.oo.'];
  let legs: [number, number][] = [[20, 0], [26, 0], [37, 0], [43, 0]]; // near front, far front, far back, near back: x, slant
  let lift = 0; // near front hoof raised (pawing)
  let steam = false;
  switch (pose) {
    case 'idle1':
      by = 1;
      hy = 1;
      break;
    case 'windup':
      bx = 2;
      by = -1;
      hx = 4;
      hy = -3;
      break;
    case 'attack':
      // Headlong: the lunge, horns first
      bx = -4;
      by = 1;
      hx = -6;
      hy = 4;
      legs = [[15, -4], [23, -2], [39, 3], [46, 4]];
      break;
    case 'hurt':
      bx = 2;
      hx = 4;
      hy = -1;
      eye = ['.kkk', 'kkkk', '....'];
      break;
    case 'tell':
      // head dropped low, horns levelled, steam snorting, a fore hoof scraping the ice
      bx = 1;
      hx = 2;
      hy = 5;
      lift = 4;
      steam = true;
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const HX = (x: number) => x + hx;
  const HY = (y: number) => y + hy;
  const body = anyOf(ell(X(33), Y(24), 16.5, 11.5), ell(X(22), Y(22), 10, 11));
  const leg = ([x, sl]: [number, number], far: boolean, up = 0): Part[] => {
    const top = Y(30);
    return [
      capsule(X(x), top, X(x) + sl, F - 3 - up, far ? 2.2 : 2.6, far ? 1.8 : 2.1, far ? 'L' : 'l'),
      [['hHhh', 'hhhh'], X(x) + sl - 2, F - 2 - up],
    ];
  };
  // the head: a long dark wedge of a face down to the muzzle
  const head = poly([
    [HX(3), HY(27)], [HX(5), HY(22)], [HX(10), HY(15)], [HX(16), HY(11)], [HX(21), HY(12)], [HX(23), HY(17)], [HX(21), HY(24)], [HX(14), HY(29)], [HX(8), HY(31)], [HX(4), HY(30)],
  ]);
  const parts: Part[] = [
    ramHorn(HX(22), HY(15), 0.8, true), // the far horn, peeking out behind
    ...leg(legs[1], true),
    ...leg(legs[2], true),
    shag(body, [X(11), Y(9), X(51), Y(37)], [X(26), Y(17), 20, 16], [...FLEECE.slice(1), '#ffffff'], 11, { edge: FLEECE[1] }),
    ...leg(legs[0], false, lift),
    ...leg(legs[3], false),
    // a stubby woolly tail
    [['.55', '544', '43.'], X(48), Y(16), { pal: digits(FLEECE) }],
    vol(head, [HX(2), HY(10), HX(24), HY(32)], [HX(9), HY(15), 14, 14], SLATE, { edge: SLATE[0] }),
    // the frosty beard, the collar and its bell
    [['bbbb', 'bBbb', '.bB.', '.b..'], HX(9), HY(29)],
    line(HX(15), HY(27), HX(22), HY(25), 'R'),
    line(HX(15), HY(26), HX(22), HY(24), 'r'),
    [['.gG.', 'gGgy', 'gggy', 'yyyY', '.kk.'], HX(16), HY(27)],
    [eye, HX(8), HY(19)],
    dots([['n', [[HX(4), HY(26)], [HX(5), HY(26)]]]]),
    dots([['5', [[HX(6), HY(22)], [HX(7), HY(21)], [HX(8), HY(20)], [HX(9), HY(19)]]]], { pal: digits(SLATE) }), // lit ridge of the nose
    ramHorn(HX(20), HY(15)),
  ];
  if (steam) parts.push([['.ww.', 'wWWw', '.WW.'], HX(-2), HY(24)], [['ww', 'W.'], HX(-4), HY(28)]);
  return parts;
}

// ------------------------------------------------------------------ the loom matron (mini-boss: a giant frost spider who weaves the hoard)

// a regal plum body laced with frost, lavender head, spectacles and a gold-threaded tapestry for warmth
const PLUM = ['#1c1030', '#34204e', '#523474', '#74509a', '#9a78c0', '#c8a8e0'];
const LAV = ['#3a3058', '#5e5486', '#8a82b2', '#b4aed4', '#dcd8ee', '#ffffff'];
const MATRON_PAL: Pal = {
  k: INK, O: '#ff9a2a', o: '#c84a1a', W: '#ffffff', // eyes
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', // spectacles, gold thread, coins
  M: '#5a2a3a', // mandibles
  s: '#f4fbff', // silk
  c: '#e8e4d4', C: '#c4bca4', t: '#6a5a9a', // the tapestry: linen, its shade, a woven border
  i: ICE[5], j: ICE[4], // lace and frost
};
const MATRON_SHADES: Record<string, Shade> = {
  l: { ramp: PLUM, top: [4], left: [4], right: [2], bottom: [2], mid: 3 },
  L: { ramp: PLUM, top: [2], left: [2], right: [1], bottom: [1], mid: 2 },
};
// the tapestry she is weaving: the hoard in gold thread on linen, a violet border
const TAPESTRY = [
  'tttttttttt',
  'tccccccCct',
  'tccgcccCct',
  'tcgGgccgCt',
  'tgGggcgGgt',
  'tgggggggyt',
  'tttttttttt',
  '.s.s..s.s.',
];

function matronParts(pose: string): Part[] {
  const F = 45;
  let bx = 0;
  let by = 0;
  let hx = 0; // head
  let hy = 0;
  let front: [number, number, number, number] = [6, 18, 2, 30]; // near front leg: knee, foot (holding the tapestry)
  let second: [number, number, number, number] = [12, 14, 6, 44];
  let eyes = ['.ggg.ggg.', 'gWOgggWOg', 'gOogkgOog', '.ggg.ggg.'];
  let tap = true;
  let silk = false;
  switch (pose) {
    case 'idle1':
      by = 1;
      hy = 1;
      front = [6, 19, 2, 31];
      break;
    case 'windup':
      bx = 2;
      by = -1;
      hx = 2;
      hy = -1;
      front = [8, 10, 3, 4];
      second = [13, 12, 7, 44];
      tap = false;
      break;
    case 'attack':
      bx = -3;
      by = 1;
      hx = -3;
      hy = 2;
      front = [4, 20, -6, 29];
      second = [9, 18, 0, 41];
      tap = false;
      break;
    case 'hurt':
      bx = 2;
      hx = 3;
      eyes = ['.ggg.....', 'gkkg.ggg.', 'gggggkkg.', '.....ggg.'];
      front = [8, 20, 5, 33];
      break;
    case 'tell':
      // rears up, the front legs flung wide with silk strung between them, the spectacles flashing
      by = -1;
      hx = 1;
      hy = -3;
      front = [3, 6, -3, 1];
      second = [9, 3, 4, 12];
      eyes = ['.GGG.GGG.', 'GWWGGGWWG', 'GWWGkGWWG', '.GGG.GGG.'];
      tap = false;
      silk = true;
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const HX = (x: number) => x + hx;
  const HY = (y: number) => y + hy;
  const leg = (hip: [number, number], knee: [number, number], foot: [number, number], far: boolean): Part[] => [
    capsule(hip[0], hip[1], knee[0], knee[1], far ? 1.3 : 1.6, far ? 1.2 : 1.5, far ? 'L' : 'l', { edge: PLUM[0] }),
    capsule(knee[0], knee[1], foot[0], foot[1], far ? 1.2 : 1.5, 0.8, far ? 'L' : 'l', { edge: PLUM[0] }),
    dots([['j', [[knee[0], knee[1]], [knee[0] + 1, knee[1]]]]]),
  ];
  const abd = ell(X(42), Y(20), 15, 13);
  // frost lace laid over the abdomen: a lattice of diamonds
  const lace: [number, number][] = [];
  for (let y = Y(8); y <= Y(32); y++)
    for (let x = X(28); x <= X(57); x++) {
      if (!ell(X(42), Y(20), 13.5, 11.5)(x, y)) continue;
      const u = x - X(42) + (y - Y(20));
      const v = x - X(42) - (y - Y(20));
      if (((u % 6) + 6) % 6 === 0 || ((v % 6) + 6) % 6 === 0) lace.push([x, y]);
    }
  const parts: Part[] = [
    // a far leg
    ...leg([X(27), Y(28)], [X(33), Y(13)], [X(35), F], true),
    vol(abd, [X(26), Y(6), X(58), Y(34)], [X(37), Y(13), 15, 13], PLUM, { edge: PLUM[0] }),
    dots([['j', lace]]),
    vol(ell(X(25), Y(27), 9, 7), [X(15), Y(19), X(35), Y(35)], [X(21), Y(23), 9, 8], LAV, { edge: LAV[0] }),
    // back near legs
    ...leg([X(30), Y(30)], [X(43), Y(17)], [X(49), F], false),
    ...leg([X(27), Y(31)], [X(36), Y(21)], [X(40), F], false),
    // front legs, from under the head
    ...leg([X(22), Y(29)], [second[0] + bx, second[1] + by], [second[2] + bx, second[3]], false),
    ...leg([X(19), Y(29)], [front[0] + bx, front[1] + by], [front[2] + bx, front[3] + by], false),
    // the head: lavender, a frilled lace cap, gold spectacles over big amber eyes, small eyes above, mandibles
    vol(ell(HX(16), HY(23), 8, 7.5), [HX(7), HY(15), HX(25), HY(31)], [HX(13), HY(19), 9, 8], LAV, { edge: LAV[0] }),
    [['...iiiiii..', '.iijiijiii.', 'ijiijiijiij', 'i.i.i.i.i.i'], HX(10), HY(12)],
    dots([['O', [[HX(13), HY(17)], [HX(16), HY(17)], [HX(19), HY(17)]]]]),
    [eyes, HX(9), HY(20)],
    [['M.M', 'MM.'], HX(10), HY(28)],
  ];
  if (tap) parts.push([TAPESTRY, front[2] + bx - 4, front[3] + by - 1], line(front[2] + bx, front[3] + by - 4, front[2] + bx, front[3] + by - 1, 's', { late: true }));
  if (silk) {
    const fx = front[2] + bx;
    const fy = front[3] + by;
    const sx = second[0] + bx;
    const sy = second[1] + by;
    parts.push(
      line(fx + 1, fy + 1, sx - 1, sy + 1, 's', { late: true }),
      line(fx + 1, fy + 4, sx - 1, sy + 5, 's', { late: true }),
      line(fx + 2, fy + 1, fx + 4, fy + 6, 's', { late: true }),
      line(fx + 7, fy + 1, fx + 8, fy + 7, 's', { late: true }),
      line(X(57), Y(26), X(58), F, 's', { late: true }),
    );
  }
  return parts;
}

// ------------------------------------------------------------------ glacia (the boss: a vain ice wyrm coiled on her hoard)

// sapphire scales: shadows lean indigo, highlights lean cyan-white
const WYRM = ['#0c1434', '#162a5a', '#22468a', '#306eb4', '#4e9ad4', '#8acaec', '#d8f4ff'];
const BELLY = ['#4a4a6a', '#8a8aa6', '#c4c8da', '#e8ecf4', '#ffffff'];
const COIN = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0', '#fffbe0'];
const GLACIA_PAL: Pal = {
  k: INK, O: '#ffc040', o: '#e07a1a', L: '#140c1c', // eye, lashes
  W: '#ffffff', n: '#0a0a1c', v: '#b47ae8', // glint, nostril, eyeshadow
  m: '#2a0c2a', r: '#c04a6a', t: '#f4fbff', // mouth, tongue, fangs
  R: '#e02a4a', q: '#8a1030', E: '#3ac87a', e: '#1a7a4a', V: '#a050e0', // gems: ruby, emerald, amethyst
  i: ICE[5], j: ICE[4], // frost
};

/** A point on a cubic Bezier through four control points. */
export function bezier(p: [number, number][]): (t: number) => [number, number] {
  return (t) => {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [p[0][0] * a + p[1][0] * b + p[2][0] * c + p[3][0] * d, p[0][1] * a + p[1][1] * b + p[2][1] * c + p[3][1] * d];
  };
}

/** Scale texture on tone digits: a staggered pattern of small arcs a tone darker (skipping the darkest tones). */
export function scaled(rows: string[], ox: number, oy: number, glint = 0): string[] {
  return rows.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (!/[2-6]/.test(c)) return c;
        const gx = x + ox;
        const gy = y + oy;
        const row = Math.floor(gy / 3);
        const sx = (gx + (row % 2) * 2) % 4;
        if (gy % 3 === 2 && sx !== 0) return String(+c - 1);
        if (gy % 3 === 0 && sx === 0) return String(+c - 1);
        if (glint && gy % 3 === 0 && sx === 2 && hash2(gx, gy) < glint) return '6';
        return c;
      })
      .join(''),
  );
}

/** Glacia's shapes per pose (rows and place), shared by her three phase looks. */
const GLACIA_GEO = new Map<string, Part>();

function glaciaParts(pose: string, phase: number): Part[] {
  const F = 65;
  let hx = 4; // head origin
  let hy = 10;
  let open = 0; // jaw drop
  let eyeShut = false;
  let wings: 'fold' | 'half' | 'spread' = 'fold';
  let neckBend = 0;
  let by = 0; // body breathing
  switch (pose) {
    case 'idle1':
      hy = 11;
      by = 1;
      neckBend = 1;
      break;
    case 'windup':
      hx = 9;
      hy = 7;
      neckBend = -2;
      wings = 'half';
      break;
    case 'attack':
      // the strike: neck snapped forward and down, jaws wide
      hx = -3;
      hy = 18;
      open = 4;
      neckBend = 3;
      break;
    case 'hurt':
      hx = 9;
      hy = 11;
      eyeShut = true;
      neckBend = -1;
      break;
    case 'tell':
      // wings flung wide, head thrown up, a roar of frost
      hx = 5;
      hy = 5;
      open = 4;
      wings = 'spread';
      neckBend = -1;
      break;
  }
  // phase 2: the scales polished mirror-bright; phase 3: darkened, cracked, a red glare
  const ramp =
    phase >= 3
      ? ['#0a0c26', '#141e48', '#203a78', '#2c5ea0', '#4888c4', '#7cb8e0', '#c8ecff']
      : phase === 2
        ? ['#14204a', '#24467a', '#3a72a8', '#5aa0d0', '#8ccbe8', '#c4ecfa', '#ffffff']
        : WYRM;
  const glint = phase === 2 ? 0.55 : 0.03;
  const scalePal = { ...digits(ramp), 6: '#ffffff' };
  const parts: Part[] = [];
  // the shapes depend only on the pose: the three phase looks share them (only the colours differ)
  const geo = (k: string, f: () => Part, o: PartOpts): Part => {
    const key = `${pose}:${k}`;
    let p = GLACIA_GEO.get(key);
    if (!p) GLACIA_GEO.set(key, (p = f()));
    return [p[0], p[1], p[2], o];
  };

  // --- wings (behind everything): crystal membranes stretched between ice-bone ribs
  const shoulder: [number, number] = [56, 36 + by];
  const wingPts: Record<string, [number, number][]> = {
    fold: [[0, 0], [5, -17], [12, -26], [17, -21], [17, -12], [13, -4]],
    half: [[0, 0], [2, -19], [10, -29], [22, -26], [23, -15], [14, -4]],
    spread: [[0, 0], [-6, -22], [2, -32], [22, -34], [33, -24], [28, -13], [16, -4]],
  };
  const wp = wingPts[wings].map(([x, y]): [number, number] => [shoulder[0] + x, shoulder[1] + y]);
  const wmask = poly(wp);
  const wx0 = Math.min(...wp.map((p) => p[0])) - 1;
  const wy0 = Math.min(...wp.map((p) => p[1])) - 1;
  const wx1 = Math.max(...wp.map((p) => p[0])) + 1;
  const wy1 = Math.max(...wp.map((p) => p[1])) + 1;
  const wingRamp = [ICE[1], ICE[2], ICE[3], ICE[4], ICE[4], ICE[5]];
  parts.push(geo('wing', () => vol(wmask, [wx0, wy0, wx1, wy1], [wx0 + 4, wy0 + 4, (wx1 - wx0) * 0.9, (wy1 - wy0) * 0.9], wingRamp), { pal: digits(wingRamp), edge: ICE[1] }));
  // ribs from the shoulder to each outer point
  for (const p of wp.slice(1, -1)) parts.push(line(shoulder[0], shoulder[1], p[0], p[1], '1', { pal: digits(ICE) }));
  for (const p of wp.slice(1, -1)) parts.push(dots([['5', [p]]], { pal: digits(ICE) }));

  // --- the hoard: a broad mound of gold coins under her coils
  const hoard = (x: number, y: number) => (ell(48, 75, 42, 17)(x, y) || ell(62, 62, 20, 23)(x, y)) && y <= F;
  const coins = geo(
    'coins',
    () => {
      const c = vol(hoard, [5, 38, 91, F], [44, 48, 50, 26], COIN);
      c[0] = c[0].map((r, y) =>
        [...r]
          .map((ch, x) => {
            if (ch === '.') return ch;
            // heaped coins: staggered little discs, a lit rim on top and a shadowed edge underneath
            const gx = x + 5;
            const gy = y + 38;
            const off = Math.floor(gy / 2) % 2 ? 2 : 0;
            const u = (gx + off) % 4;
            const t = +ch;
            const v = gy % 2 === 0 ? (u === 1 || u === 2 ? t + 1 : t) : u === 0 ? t - 2 : t - 1;
            return String(Math.max(1, Math.min(5, v)));
          })
          .join(''),
      );
      return c;
    },
    { pal: digits(COIN), edge: COIN[0] },
  );
  parts.push(coins);

  // the serpent's body as tubes: scales lit by how each spot faces the light, pale belly plates on one side
  const bellyPal = { ...scalePal, b: BELLY[2], B: BELLY[3], c: BELLY[1] };
  const tube = (bellySide: number) => (t: number, side: number, lit: number) => {
    if (side * bellySide > 0.45) return Math.floor(t * 22) % 2 ? (lit < -0.2 ? 'c' : 'b') : 'B';
    if (Math.abs(side) > 0.88 && lit < 0) return '1';
    return lit > 0.45 ? '5' : lit > 0.05 ? '4' : lit > -0.35 ? '3' : '2';
  };
  const scaledPart = (p: Part): Part => [scaled(p[0], p[1], p[2], glint), p[1], p[2], p[3]];

  // --- the great coil: up over her back and round, resting on the gold
  const coil = bezier([[44, 47 + by], [58, 22 + by], [96, 36 + by], [66, 57 + by]]);
  parts.push(scaledPart(geo('coil', () => sweep(coil, (t) => 8 - t * 1.2, tube(1)), { pal: bellyPal, edge: ramp[0] })));
  // ice spines down the back of the coil
  for (const t of [0.32, 0.45, 0.58, 0.7]) {
    const [x, y] = coil(t);
    const [x2, y2] = coil(t + 0.01);
    const a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
    parts.push(crystal(x + Math.cos(a) * 6, y + Math.sin(a) * 6, a - 0.35, phase >= 3 ? 9 : 6, phase >= 3 ? 5 : 4));
  }

  // --- the tail: from under the coil along the front of the hoard, to a crystal tip
  const tail = bezier([[68, 57 + by], [46, 66], [26, 61], [16, 52]]);
  parts.push(scaledPart(geo('tail', () => sweep(tail, (t) => 6.6 - t * 5, tube(-1)), { pal: bellyPal, edge: ramp[0] })));
  parts.push(crystal(16, 53, (-115 * Math.PI) / 180, 8, 5));

  // --- the neck, an S curving up from the coils to the head; belly plates down its front
  const neckTop: [number, number] = [hx + 19, hy + 12];
  const neckPath = bezier([[46, 48 + by], [30 + neckBend, 44], [neckTop[0] + 12 - neckBend, neckTop[1] + 10], neckTop]);
  parts.push(scaledPart(geo('neck', () => sweep(neckPath, (t) => 6.8 - t * 2.4, tube(-1)), { pal: bellyPal, edge: ramp[0] })));
  // spines along the back of the neck
  for (const t of [0.35, 0.55, 0.75]) {
    const [x, y] = neckPath(t);
    parts.push(crystal(x + 4, y - 2, (-40 * Math.PI) / 180, 5, 3));
  }
  // a gold chain with a ruby at the base of the neck: she likes to look her best
  const [cx0, cy0] = neckPath(0.2);
  parts.push(
    line(Math.round(cx0 - 6), Math.round(cy0 - 2), Math.round(cx0 + 5), Math.round(cy0 + 3), 'g', { pal: { g: COIN[3] } }),
    [['.y.', 'yRy', 'qRq', '.q.'], Math.round(cx0 - 2), Math.round(cy0), { pal: { y: COIN[2], R: '#e02a4a', q: '#8a1030' } }],
  );

  // --- the head (faces left): a long elegant snout, a vain heavy-lidded eye, swept crystal horns, a circlet
  const H = (x: number, y: number): [number, number] => [hx + x, hy + y];
  parts.push(crystal(...H(17, 3), (-12 * Math.PI) / 180, 15, 5)); // far horn
  const skull = anyOf(ell(hx + 16, hy + 8, 8, 6.5), poly([H(0, 9), H(3, 5), H(10, 3.5), H(17, 4), H(17, 12), H(8, 12.5), H(1, 11.5)]));
  const jaw = poly([H(2, 11 + open * 0.3), H(10, 12), H(19, 12), H(19, 16), H(9, 16 + open * 0.5), H(3, 13 + open)]);
  if (open) {
    // the open mouth: dark gape, a tongue, fangs
    parts.push(dots([['m', Array.from({ length: 15 }, (_, i): [number, number] => H(3 + i, 12)).concat(Array.from({ length: 12 }, (_, i): [number, number] => H(4 + i, 13)), Array.from({ length: 6 }, (_, i): [number, number] => H(5 + i, 14)))]]));
  }
  const headPal = { ...digits(ramp.slice(1)), 6: '#ffffff' };
  parts.push(geo('jaw', () => vol(jaw, [hx, hy + 9, hx + 20, hy + 18 + open], [hx + 6, hy + 11, 12, 6], ramp), { pal: headPal, edge: ramp[0] }));
  const head = geo('head', () => vol(skull, [hx, hy, hx + 25, hy + 15], [hx + 10, hy + 5, 15, 11], ramp), { pal: headPal, edge: ramp[0] });
  parts.push([scaled(head[0], hx, hy, glint * 0.5), head[1], head[2], head[3]]);
  if (open) parts.push(dots([['t', [H(4, 12), H(7, 12), H(10, 12), H(5, 14 + open - 1)]]]));
  // cheek frill and the near horn, swept back
  parts.push(crystal(...H(20, 9), (15 * Math.PI) / 180, 7, 4));
  parts.push(crystal(...H(19, 2), (-25 * Math.PI) / 180, 17, 6));
  // the eye: heavy-lidded, long lashes flicking back (phase 3: a furious red glare)
  // (violet eyeshadow over the lid: she is vain)
  const eyeRows = eyeShut
    ? ['.......LL', '..vvvvLL.', '.LLLLLL..', '..LLL....']
    : phase >= 3
      ? ['.......LL', '..LLLLLL.', '.LRRWRL..', '..LqqqL..']
      : phase === 2
        ? ['.......LL', '..vvvvLL.', '.LLLLLL..', '..LOWOL..']
        : ['.......LL', '..vvvvLL.', '.LLLLLL..', '.LOOWOL..', '..LooL...'];
  parts.push([eyeRows, hx + 9, hy + 2]);
  parts.push(dots([['n', [H(2, 8), H(3, 8)]]]));
  // a gold circlet set with an emerald, worn just so
  parts.push(
    line(hx + 9, hy + 3, hx + 20, hy + 1, 'g', { pal: { g: COIN[3] } }),
    dots([['G', [H(9, 3), H(10, 3)]], ['E', [H(14, 1)]], ['e', [H(14, 2)]]], { pal: { G: COIN[4], E: '#3ac87a', e: '#1a7a4a' } }),
  );

  // --- hoard treasures in front: a crown, a goblet, gems; and glints that wink off the gold
  parts.push(
    [['g.g.g', 'gRgEg', 'yyyyy'], 33, 58, { pal: { g: COIN[4], y: COIN[2], R: '#e02a4a', E: '#3ac87a' } }],
    [['ggg', '.y.', '.y.', 'yyy'], 66, 59, { pal: { g: COIN[4], y: COIN[2] } }],
    dots([['R', [[50, 63]]], ['V', [[58, 64]]], ['E', [[16, 63]]]]),
  );
  const glints: [number, number][] = phase === 2 ? [[20, 57], [40, 56], [62, 57], [76, 60], [50, 40], [64, 44], [57, 51]] : [[24, 58], [44, 57], [70, 58]];
  parts.push(dots([['W', glints]], { late: true }));
  if (pose === 'tell' || phase >= 3) {
    const frost: [number, number][] = pose === 'tell' ? [[hx - 4, hy + 12], [hx - 7, hy + 9], [hx - 5, hy + 16], [hx - 9, hy + 13]] : [];
    if (phase >= 3) frost.push([12, 30], [84, 24], [30, 20], [88, 44]);
    parts.push(dots([['i', frost]], { late: true }));
  }
  if (phase >= 3) {
    // cracks through the scales of the coils
    parts.push(dots([['0', [[54, 40 + by], [55, 41 + by], [55, 42 + by], [56, 43 + by], [63, 47 + by], [64, 48 + by], [64, 49 + by]]], ['6', [[53, 40 + by], [54, 41 + by], [62, 47 + by]]]], { pal: scalePal }));
  }
  return parts;
}

// ------------------------------------------------------------------ portraits (40x40 busts facing left, like the villains)

/** Portrait textures this file draws: `portrait_${name}`. */
export const FROST_PORTRAITS = ['rimehorn', 'matron', 'glacia'] as const;
const P = 40;

function rimehornPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  // the woolly ruff, the far horn behind, then the long dark face
  parts.push(shag(ell(24, 41, 20, 10), [3, 30, 39, 39], [16, 33, 18, 9], [...FLEECE.slice(1), '#ffffff'], 5, { edge: FLEECE[1] }));
  parts.push(ramHorn(31, 13, 1.05, true));
  const face = poly([[1, 29], [3, 23], [9, 15], [17, 9], [24, 9], [28, 15], [27, 25], [20, 32], [11, 35], [4, 34]]);
  parts.push(vol(face, [0, 8, 29, 36], [9, 14, 18, 18], SLATE.slice(1), { edge: SLATE[0] }));
  // a lit ridge down the nose, nostrils, a smug half-lidded eye with a goat's bar pupil
  parts.push(dots([['5', [[4, 26], [5, 25], [6, 24], [7, 23], [8, 22], [9, 21], [10, 20]]], ['4', [[5, 26], [6, 25], [7, 24], [8, 23]]]], { pal: digits(SLATE) }));
  parts.push(dots([['n', [[2, 30], [3, 30], [3, 29]]]]));
  parts.push([['.kkkkkk', 'kkOOOOk', 'kOkkkkO', '.kOooOk', '..kkkk.'], 9, 17]);
  parts.push(dots([['k', [[6, 33], [7, 33], [8, 34], [9, 34], [10, 34]]]]));
  // the frosty beard, the collar and the toll bell
  parts.push([['bbbbbb', 'bBbbBb', '.bbBb.', '..bB..', '..b...'], 7, 33]);
  parts.push(line(14, 34, 30, 30, 'r'), line(14, 35, 30, 31, 'R'));
  parts.push([['..gG..', '.gGggy', 'ggGggy', 'gggggy', 'yyyyyY', '..kk..'], 20, 33]);
  // the great curled horn, filling the top right
  parts.push(ramHorn(26, 15, 1.25));
  return render(P, P, RAM_PAL, RAM_SHADES, parts);
}

function matronPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  // her plum shoulders laced with frost, a raised foreleg holding a knitting needle
  const body = ell(26, 42, 17, 11);
  parts.push(vol(body, [7, 30, 39, 39], [20, 33, 18, 10], PLUM, { edge: PLUM[0] }));
  const lace: [number, number][] = [];
  for (let y = 32; y < 40; y++)
    for (let x = 10; x < 40; x++) if (ell(26, 42, 15.5, 9.5)(x, y) && ((((x + y) % 5) + 5) % 5 === 0 || (((x - y) % 5) + 5) % 5 === 0)) lace.push([x, y]);
  parts.push(dots([['j', lace]]));
  // the head: lavender, big and round
  parts.push(vol(ell(20, 22, 13, 12), [6, 9, 34, 35], [15, 15, 15, 14], LAV, { edge: LAV[0] }));
  // the lace cap with its frilled edge
  parts.push([
    [
      '.....iiiiiiii.....',
      '...iijiiiijiiii...',
      '..ijiiijiiiijiij..',
      '.iiiijiiijiiiijiii',
      'ijiiiiiiiiiiiiiiij',
      'i.i.i.i.i.i.i.i.i.',
    ],
    11,
    5,
  ]);
  // a row of small eyes, then gold spectacles over two big amber eyes, mandibles below
  parts.push(dots([['O', [[13, 13], [17, 12], [21, 12], [25, 13]]], ['o', [[13, 14], [17, 13], [21, 13], [25, 14]]]]));
  parts.push([
    [
      '.gggg...gggg.',
      'gWOOOg.gWOOOg',
      'gOOkOgggOOkOg',
      'gOkkOg.gOkkOg',
      'goOOog.goOOog',
      '.gggg...gggg.',
    ],
    7,
    17,
  ]);
  parts.push([['M..M', 'MM.MM', '.M..M'], 11, 26]);
  // a knitting needle with a strand of gold thread
  parts.push(line(1, 38, 9, 26, 's'), dots([['g', [[2, 34], [3, 33], [4, 33], [5, 32], [6, 32], [7, 31]]], ['W', [[9, 26]]]]));
  return render(P, P, MATRON_PAL, MATRON_SHADES, parts);
}

function glaciaPortrait(): HTMLCanvasElement {
  const parts: Part[] = [];
  const scalePal = { ...digits(WYRM), 6: '#ffffff' };
  // the far horn, swept back
  parts.push(crystal(26, 9, (-18 * Math.PI) / 180, 15, 5));
  // the neck curving down to the bottom right, a gold chain and a ruby
  const neck = bezier([[26, 22], [32, 28], [33, 34], [36, 42]]);
  parts.push(
    sweep(neck, () => 8.5, (t, side, lit) => (side < -0.45 ? (Math.floor(t * 12) % 2 ? 'b' : 'B') : lit > 0.3 ? '5' : lit > -0.2 ? '4' : '3'), 120, {
      pal: { ...scalePal, b: BELLY[2], B: BELLY[3] },
      edge: WYRM[0],
    }),
  );
  parts.push(line(24, 35, 39, 30, 'g', { pal: { g: COIN[3] } }), [['.y.', 'yRy', 'qRq', '.q.'], 28, 34, { pal: { y: COIN[2], R: '#e02a4a', q: '#8a1030' } }]);
  // the head: a long elegant snout to the left, the jaw, scales
  const skull = anyOf(ell(22, 18, 10.5, 9), poly([[0, 21], [4, 15], [12, 12], [22, 12], [22, 26], [10, 27], [2, 25]]));
  const head = vol(skull, [0, 8, 33, 28], [13, 13, 18, 14], WYRM.slice(1), { edge: WYRM[0] });
  head[0] = scaled(head[0], 0, 8);
  head[3] = { ...head[3], pal: { ...digits(WYRM.slice(1)), 6: '#ffffff' } };
  parts.push(head);
  // a smug closed-mouth smile, a nostril
  parts.push(dots([['k', [[2, 24], [3, 24], [4, 24], [5, 25], [6, 25], [7, 25], [8, 25], [9, 25], [10, 25], [11, 24], [12, 23]]], ['n', [[3, 18], [4, 18]]]]));
  // the cheek frill and the near horn
  parts.push(crystal(29, 20, (12 * Math.PI) / 180, 9, 5));
  parts.push(crystal(25, 9, (-28 * Math.PI) / 180, 17, 6));
  // the eye: violet eyeshadow, long lashes, a heavy-lidded amber look
  parts.push([
    [
      '..........LL',
      '.......LLL..',
      '..vvvvvvL...',
      '.vvvvvvvL...',
      'LLLLLLLLL...',
      '.LOOOWOL....',
      '..LooOL.....',
    ],
    10,
    10,
  ]);
  // the gold circlet with its emerald
  parts.push(line(10, 13, 28, 7, 'g', { pal: { g: COIN[3] } }), dots([['E', [[19, 9]]], ['e', [[19, 10]]], ['G', [[10, 13], [11, 13]]]], { pal: { E: '#3ac87a', e: '#1a7a4a', G: COIN[4] } }));
  return render(P, P, { ...GLACIA_PAL, v: '#b47ae8' }, {}, parts);
}

// ------------------------------------------------------------------ bar pieces for the region's specials

/** Where an icicle will land: a red-orange target bracket round a falling icicle's point (9x7 with its outline). */
function icicleMark(): HTMLCanvasElement {
  const g = grid(9, 7);
  const rows = ['.r.....r.', 'rRr.i.rRr', '.rR.I.Rr.', '..rRIRr..', '...rRr...'];
  const pal: Pal = { r: '#ff7a2a', R: '#d03a1a', i: ICE[4], I: '#ffffff' };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && put(g, x, y + 1, pal[ch])));
  return paint(g);
}

/** A vertical sliver of mirror standing on the bar, a glint across it (5x12 with its outline). */
function mirrorShard(): HTMLCanvasElement {
  const g = grid(5, 12);
  const rows = ['.W.', 'wWm', 'wWm', 'Wnm', 'Wnm', 'nWm', 'nWm', 'nnW', 'nmW', 'mnm'];
  const pal: Pal = { W: '#ffffff', w: '#e8f6ff', n: MIRROR[3], m: MIRROR[1] };
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && put(g, x + 1, y + 1, pal[ch])));
  return paint(g);
}

// ------------------------------------------------------------------ build

/** Every texture this file draws, as [key, canvas], drawn once (see buildFrostFoeArt). */
function drawAll(): [string, HTMLCanvasElement][] {
  const defs: Record<string, SpriteDef> = {
    rimeimp: { W: 26, H: 26, pal: IMP_PAL, shades: IMP_SHADES, parts: impParts },
    iciclebat: { W: 34, H: 22, pal: BAT_PAL, shades: BAT_SHADES, parts: batParts },
    yeticub: { W: 24, H: 24, pal: YETI_PAL, shades: YETI_SHADES, parts: yetiParts },
    snowogre: { W: 38, H: 40, pal: OGRE_PAL, shades: OGRE_SHADES, parts: ogreParts },
    frostweaver: { W: 38, H: 22, pal: WEAVER_PAL, shades: WEAVER_SHADES, parts: weaverParts },
    icewraith: { W: 26, H: 30, pal: WRAITH_PAL, shades: WRAITH_SHADES, parts: wraithParts },
    hailcaller: { W: 26, H: 28, pal: HAIL_PAL, shades: HAIL_SHADES, parts: hailParts },
    glaciertortoise: { W: 48, H: 32, pal: TORT_PAL, shades: TORT_SHADES, parts: tortParts },
    drifttroll: { W: 34, H: 36, pal: TROLL_PAL, shades: TROLL_SHADES, parts: trollParts },
    aurorawisp: { W: 28, H: 30, pal: WISP_PAL, shades: {}, parts: wispParts },
    frostknight: { W: 34, H: 40, pal: FK_PAL, shades: FK_SHADES, parts: fknightParts },
    rimehorn: { W: 54, H: 46, pal: RAM_PAL, shades: RAM_SHADES, parts: ramParts },
    matron: { W: 60, H: 46, pal: MATRON_PAL, shades: MATRON_SHADES, parts: matronParts },
    glacia: { W: 92, H: 66, pal: GLACIA_PAL, shades: {}, parts: (p) => glaciaParts(p, 1) },
    glacia2: { W: 92, H: 66, pal: GLACIA_PAL, shades: {}, parts: (p) => glaciaParts(p, 2) },
    glacia3: { W: 92, H: 66, pal: GLACIA_PAL, shades: {}, parts: (p) => glaciaParts(p, 3) },
  };
  const out: [string, HTMLCanvasElement][] = [];
  for (const name of FROST_SPRITES) {
    // the boss's phase looks share her frame size, so swapping between them never jumps
    const group = name === 'glacia' ? [name, ...GLACIA_PHASES] : [name];
    out.push(...fitFrames(group.flatMap((n) => [...FROST_POSES, ...(defs[n].extras ?? [])].map((pose): [string, SpriteDef, string] => [n, defs[n], pose]))));
  }
  GLACIA_GEO.clear();
  out.push(
    ['portrait_rimehorn', rimehornPortrait()],
    ['portrait_matron', matronPortrait()],
    ['portrait_glacia', glaciaPortrait()],
    ['icicle_mark', icicleMark()],
    ['mirror_shard', mirrorShard()],
  );
  return out;
}

let drawn: [string, HTMLCanvasElement][] | null = null;

/**
 * Add the Region 2 foes, portraits and bar pieces. They are drawn the first time only (about as long as Region 1's foes
 * take); every call (a relayout rebuilds every texture) adds fresh copies of those canvases.
 */
export function buildFrostFoeArt(add: Add): void {
  drawn ??= drawAll();
  for (const [key, c] of drawn) {
    // the textures get copies, so the drawn canvases stay pristine for the next relayout
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext('2d')!.drawImage(c, 0, 0);
    add(key, copy);
  }
}
