// Original placeholder pixel art, generated at boot. Sprites are pixel grids with an automatic
// 1px dark outline; the hero's sword is drawn per pose so one body gives many animation frames.
import type Phaser from 'phaser';

const OUTLINE = '#140c1c';
type Grid = (string | null)[][];

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function stamp(g: Grid, rows: string[], pal: Record<string, string>, ox: number, oy: number): void {
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return;
      const gy = oy + y;
      const gx = ox + x;
      if (gy >= 0 && gy < g.length && gx >= 0 && gx < g[0].length) g[gy][gx] = pal[ch] ?? '#ff00ff';
    }),
  );
}

function put(g: Grid, x: number, y: number, c: string): void {
  x = Math.round(x);
  y = Math.round(y);
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c;
}

/** Render a grid to a canvas with a 1px outline around every filled pixel. */
function toCanvas(g: Grid): HTMLCanvasElement {
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

// ------------------------------------------------------------------ hero (Rowan, a blade hero)

export const HERO_W = 46;
export const HERO_H = 42;
export const HERO_FEET_X = 17; // x of the feet center inside the frame

const HERO_PAL = {
  h: '#9a3e1e',
  H: '#6a2814',
  s: '#f2c8a0',
  S: '#d09a78',
  e: '#140c1c',
  b: '#3a6bc8',
  B: '#26468a',
  l: '#5a8ae0',
  r: '#d8343a',
  R: '#9a2026',
  y: '#f2c230',
  w: '#5a3a20',
  d: '#3a2414',
};

// 16x21, facing right. The front hand is at (12, 12).
const HERO_BODY = [
  '......hhhhh.....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hHhhhhsshh...',
  '..hHhhsssssh....',
  '..hHhssssess....',
  '...hhsssssSs....',
  '....hSssss......',
  '.....rrrrss.....',
  '...rrRbbbbrr....',
  '..rrblllbbbbb...',
  '..rRblbbbBbbb...',
  '.rrbbbbbbBbbss..',
  '.rR.bbbbbBbbss..',
  '.R..yyyywyyy....',
  '....bbbbbbbb....',
  '....BBBB.BBB....',
  '....BBB...BB....',
  '....BBB...BB....',
  '....ddd...dd....',
  '...dddd..ddd....',
];

interface Pose {
  angle: number; // sword angle in degrees, 0 = right, -90 = up
  bodyDx?: number;
  bodyDy?: number;
  handDx?: number;
  handDy?: number;
  len?: number;
}

export const HERO_POSES: Record<string, Pose> = {
  idle0: { angle: -58 },
  idle1: { angle: -55, bodyDy: 1 },
  dash: { angle: 165, bodyDx: 1, handDx: -3, handDy: 1 },
  slashA: { angle: 18, handDx: 2, len: 17 },
  slashB: { angle: -12, handDx: 2, handDy: -1, len: 17 },
  windup: { angle: -125, handDx: -2, handDy: -2 },
  parry: { angle: -95, handDx: 2, handDy: -2 },
  hurt: { angle: 115, bodyDx: -1, bodyDy: 1, handDx: -1, handDy: 2 },
  leap: { angle: -88, bodyDy: -1, handDx: 0, handDy: -4, len: 18 },
};

function heroFrame(p: Pose): HTMLCanvasElement {
  const g = grid(HERO_W, HERO_H);
  const bx = HERO_FEET_X - 8 + (p.bodyDx ?? 0);
  const by = HERO_H - HERO_BODY.length + (p.bodyDy ?? 0);
  stamp(g, HERO_BODY, HERO_PAL, bx, by);
  const hx = bx + 12.5 + (p.handDx ?? 0);
  const hy = by + 12.5 + (p.handDy ?? 0);
  const a = (p.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const len = p.len ?? 15;
  // grip
  for (let i = -2; i <= 0; i++) put(g, hx + dx * i, hy + dy * i, '#5a3a20');
  // blade: bright edge + shaded edge
  for (let i = 2; i <= len; i++) {
    put(g, hx + dx * i, hy + dy * i, i === len ? '#ffffff' : '#e8eef8');
    if (i < len) put(g, hx + dx * i + px, hy + dy * i + py, '#8890a8');
  }
  // crossguard
  for (let k = -2; k <= 2; k++) put(g, hx + dx * 1 + px * k, hy + dy * 1 + py * k, '#f2c230');
  // hand on top
  put(g, hx, hy, '#f2c8a0');
  return toCanvas(g);
}

// ------------------------------------------------------------------ slime (procedural, squishy)

function slimeFrame(rx: number, ry: number, squash: number, lean: number, flash = false): HTMLCanvasElement {
  const W = Math.ceil(rx * 2.6) + 4;
  const H = Math.ceil(ry * 1.5) + 4;
  const g = grid(W, H);
  const RX = rx * (1 + 0.18 * squash);
  const RY = ry * (1 - 0.2 * squash);
  const cx = W / 2;
  const base = H - 2;
  const body = flash ? '#ffffff' : '#4fc4a0';
  const dark = flash ? '#ffffff' : '#2e8a6e';
  const deep = flash ? '#ffffff' : '#1e6450';
  const light = flash ? '#ffffff' : '#8ff0cc';
  for (let y = 0; y < H; y++) {
    const v = (base - y) / RY; // 0 at the bottom, 1 at the top
    if (v < 0 || v > 1) continue;
    const half = RX * Math.sqrt(1 - v * v) * (v < 0.15 ? 0.92 + v * 0.5 : 1);
    const shift = lean * v * rx * 0.35;
    for (let x = Math.floor(cx - half + shift); x <= Math.ceil(cx + half + shift); x++) {
      const u = (x - (cx + shift)) / RX;
      if (Math.abs(u) > Math.sqrt(1 - v * v) + 0.02) continue;
      let col = body;
      if (v < 0.18 || u > 0.55) col = dark;
      if (v < 0.07) col = deep;
      if (u < -0.15 && u > -0.5 && v > 0.55 && v < 0.8) col = light;
      put(g, x, y, col);
    }
  }
  if (!flash) {
    // eyes look left, toward the hero
    const ey = Math.round(base - RY * 0.55);
    const ex = Math.round(cx - RX * 0.35 + lean * rx * 0.2);
    const eh = Math.max(2, Math.round(ry / 4));
    for (let k = 0; k < eh; k++) {
      put(g, ex, ey + k, '#140c1c');
      put(g, ex + Math.max(3, Math.round(rx / 3)), ey + k, '#140c1c');
    }
    put(g, ex, ey, '#ffffff');
  }
  return toCanvas(g);
}

// ------------------------------------------------------------------ boar and bandit (maps, facing left)

const BOAR_PAL = { b: '#8a5a34', l: '#a8784a', B: '#5e3a20', k: '#3a2414', p: '#e8a0a0', t: '#f4f0e0', e: '#140c1c', d: '#2a1a0e' };
const BOAR_TOP = [
  '......kk..kkkkkk........',
  '.....kbbkkllllllkkk.....',
  '....kbbblllllllllbbkk...',
  '...bbbbbbbbbbbbbbbbbbb..',
  '..bbebbbbbbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbbbbbbbbbb.',
  'ppbbbbbbbbbbbbbbbbbbbbbk',
  'ppbbbbbbbbbbbbbbbbbbbbk.',
  'tpbBbbbbbbbbbbbbbbbbbb..',
  '.tBBbbbbbbbbbbbbbbbbbb..',
  '...BBBBBBBBBBBBBBBBBBB..',
];
const BOAR_LEGS_IDLE = ['...BB.BB.......BB.BB....', '...BB.BB.......BB.BB....', '...dd.dd.......dd.dd....'];
const BOAR_LEGS_RUN = ['..BB...BB.....BB...BB...', '.BB.....BB...BB.....BB..', '.dd......dd.dd.......dd.'];

const BANDIT_PAL = { c: '#5a4a6a', C: '#3a2e48', s: '#d8a880', m: '#c83a3a', e: '#140c1c', w: '#8a6a3a', k: '#2a2030', d: '#e8eef8', D: '#8890a8' };
const BANDIT = [
  '......ccccc.......',
  '.....ccccccc......',
  '....ccccccccc.....',
  '....cCsssssCc.....',
  '....cmmmmmmmc.....',
  '....memmemmmc.....',
  '....csssssscc.....',
  '.....cssssc.......',
  '....ccccccccc.....',
  '...cccccccccccc...',
  '..scccccCccccccc..',
  '.DsccccCcccccccc..',
  'd..cccccCcccccc...',
  '...ccwwwwwwwcc....',
  '...cccccCcccccc...',
  '...ccccc.ccccc....',
  '...CCCC...CCCC....',
  '...CCC.....CCC....',
  '...kkk.....kkk....',
  '..kkkk.....kkkk...',
];
const BANDIT_ATTACK_ARM = ['...cccccCccccccc..', 'dDsscccCcccccccc..', '...cccccCcccccc...'];

function mapFrame(rows: string[], pal: Record<string, string>, flash = false): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const g = grid(w, rows.length + 2);
  stamp(g, rows, flash ? Object.fromEntries(Object.keys(pal).map((k) => [k, '#ffffff'])) : pal, 1, 1);
  return toCanvas(g);
}

// ------------------------------------------------------------------ icons for blocks

export const ICONS: Record<string, string[]> = {
  drop: ['..#..', '.###.', '#####', '#####', '.###.'],
  tusk: ['#....', '#....', '.#...', '..##.', '....#'],
  mask: ['#####', '#.#.#', '#####', '.###.', '.....'],
  shield: ['#####', '#...#', '#...#', '.#.#.', '..#..'],
  bomb: ['...#.', '..#..', '.###.', '#####', '.###.'],
  speed: ['..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'],
};

// ------------------------------------------------------------------ background (dusk, layered)

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function drawBackground(w: number, h: number, horizon: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  // sky: dithered bands from deep violet to warm horizon
  const stops = ['#1a1238', '#2e1f52', '#4a2a66', '#7a3a6e', '#b85a62', '#e88a5a'];
  const bands = stops.length - 1;
  for (let y = 0; y < horizon; y++) {
    const f = (y / horizon) * bands;
    const i = Math.min(bands - 1, Math.floor(f));
    const t = f - i;
    for (let x = 0; x < w; x++) {
      const pick = t * 16 > BAYER[y % 4][x % 4] ? stops[i + 1] : stops[i];
      ctx.fillStyle = pick;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = '#f0e8ff';
  for (let i = 0; i < 50; i++) ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * horizon * 0.35), 1, 1);
  // setting sun
  const sx = Math.round(w * 0.62);
  const sy = horizon - 30;
  for (let y = -12; y <= 12; y++)
    for (let x = -12; x <= 12; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > 12) continue;
      if ((y + 12) % 4 === 3 && y > 0) continue; // retro sun stripes
      ctx.fillStyle = d > 10 ? '#ffb86a' : '#ffe0a0';
      ctx.fillRect(sx + x, sy + y, 1, 1);
    }
  // far mountains
  const ridge = (base: number, amp: number, f1: number, f2: number, col: string, ph: number) => {
    ctx.fillStyle = col;
    for (let x = 0; x < w; x++) {
      const y = Math.round(base - amp * (0.6 * Math.abs(Math.sin(x / f1 + ph)) + 0.4 * Math.sin(x / f2 + ph * 2)));
      ctx.fillRect(x, y, 1, horizon - y + 1);
    }
  };
  ridge(horizon - 14, 26, 37, 13, '#5a3a72', 0.3);
  ridge(horizon - 6, 14, 23, 9, '#3e2c5c', 1.7);
  // pine forest silhouette
  ctx.fillStyle = '#22203e';
  for (let x = -4; x < w; x += 7 + Math.floor(rnd() * 5)) {
    const th = 12 + Math.floor(rnd() * 12);
    for (let k = 0; k < th; k++) {
      const half = Math.floor((k / th) * 5) + 1;
      ctx.fillRect(x - half + 3, horizon - th + k, half * 2, 1);
    }
  }
  ctx.fillRect(0, horizon - 3, w, 3);
  // ground
  ctx.fillStyle = '#3e6a3a';
  ctx.fillRect(0, horizon, w, 2);
  ctx.fillStyle = '#2e4e2e';
  ctx.fillRect(0, horizon + 2, w, h - horizon - 2);
  ctx.fillStyle = '#5a8a46';
  for (let x = 0; x < w; x += 2) if (rnd() < 0.6) ctx.fillRect(x, horizon - 1, 1, 1 + (rnd() < 0.3 ? 1 : 0));
  // dirt path where the fight happens
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(0, horizon + 4, w, Math.max(3, h - horizon - 8));
  ctx.fillStyle = '#6e563a';
  for (let i = 0; i < 90; i++) ctx.fillRect(Math.floor(rnd() * w), horizon + 5 + Math.floor(rnd() * Math.max(1, h - horizon - 10)), 2, 1);
  ctx.fillStyle = '#243c26';
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(rnd() * w), horizon + 2 + Math.floor(rnd() * 2), 1, 1);
  return c;
}

function drawClouds(w: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 30;
  const ctx = c.getContext('2d')!;
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6; i++) {
    const cx = Math.floor(rnd() * w);
    const cy = 6 + Math.floor(rnd() * 18);
    const len = 20 + Math.floor(rnd() * 30);
    for (let k = 0; k < 4; k++) {
      const yy = cy + k;
      const inset = Math.abs(k - 1) * 4;
      ctx.fillStyle = k === 0 ? '#c88aa0' : k === 3 ? '#6a3a6a' : '#9a5a82';
      for (let x = cx + inset; x < cx + len - inset; x++) ctx.fillRect(((x % w) + w) % w, yy, 1, 1);
    }
  }
  return c;
}

// ------------------------------------------------------------------ build

export function buildArt(scene: Phaser.Scene, w: number, h: number, horizon: number): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  for (const [name, pose] of Object.entries(HERO_POSES)) add(`hero_${name}`, heroFrame(pose));
  // slimes: idle0/1 squish, windup (tall), attack (lean left), hurt (squashed), flash
  const slimes: Array<[string, number, number]> = [
    ['slime', 9, 8],
    ['bigslime', 17, 14],
  ];
  for (const [key, rx, ry] of slimes) {
    add(`${key}_idle0`, slimeFrame(rx, ry, 0, 0));
    add(`${key}_idle1`, slimeFrame(rx, ry, 0.45, 0));
    add(`${key}_windup`, slimeFrame(rx, ry, -0.6, 0.2));
    add(`${key}_attack`, slimeFrame(rx, ry, 0.2, -1));
    add(`${key}_hurt`, slimeFrame(rx, ry, 0.9, 0.3));
    add(`${key}_flash`, slimeFrame(rx, ry, 0.9, 0.3, true));
  }
  const boarIdle = [...BOAR_TOP, ...BOAR_LEGS_IDLE];
  const boarRun = [...BOAR_TOP, ...BOAR_LEGS_RUN];
  add('boar_idle0', mapFrame(boarIdle, BOAR_PAL));
  add('boar_idle1', mapFrame(['.'.repeat(24), ...BOAR_TOP, BOAR_LEGS_IDLE[1], BOAR_LEGS_IDLE[2]], BOAR_PAL));
  add('boar_windup', mapFrame(boarRun, BOAR_PAL));
  add('boar_attack', mapFrame(boarRun, BOAR_PAL));
  add('boar_hurt', mapFrame(boarIdle, BOAR_PAL));
  add('boar_flash', mapFrame(boarIdle, BOAR_PAL, true));
  const banditAttack = [...BANDIT.slice(0, 10), ...BANDIT_ATTACK_ARM, ...BANDIT.slice(13)];
  add('bandit_idle0', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_idle1', mapFrame(['.'.repeat(18), ...BANDIT.slice(0, 8), ...BANDIT.slice(9)], BANDIT_PAL));
  add('bandit_windup', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_attack', mapFrame(banditAttack, BANDIT_PAL));
  add('bandit_hurt', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_flash', mapFrame(BANDIT, BANDIT_PAL, true));
  add('bg', drawBackground(w, h, horizon));
  add('clouds', drawClouds(w));
}
