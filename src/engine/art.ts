// Original placeholder pixel art, generated at boot. Sprites are pixel grids with an automatic
// 1px dark outline; the hero's sword is drawn per pose so one body gives many animation frames.
import type Phaser from 'phaser';

const OUTLINE = '#1a1020';
type Grid = (string | null)[][];
type Pal = Record<string, string>;

function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

function stamp(g: Grid, rows: string[], pal: Pal, ox: number, oy: number): void {
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

const whiteOut = (pal: Pal): Pal => Object.fromEntries(Object.keys(pal).map((k) => [k, '#ffffff']));

// ------------------------------------------------------------------ hero (Rowan, an armored blade knight)

export const HERO_W = 50;
export const HERO_H = 38;
export const HERO_FEET_X = 17; // x of the feet center inside the frame

const HERO_PAL: Pal = {
  r: '#e8443a', // plume
  R: '#a82228',
  q: '#ff8a6a',
  g: '#f2c230', // gold trim
  G: '#b07e18',
  s: '#eef2f8', // steel
  m: '#b4bccc',
  M: '#737b94',
  v: '#1a1020', // visor slit
  e: '#8ef0ff', // glowing eyes
  b: '#3a6bd0', // tabard
  B: '#26468e',
  l: '#6a9af0',
  d: '#5a361c', // boots
  D: '#36200e',
};

// 24x28, facing right: big crested great-helm, steel pauldrons, blue tabard, sturdy legs.
// The sword hand is at (18, 18).
const HERO_BODY = [
  '.......qrr..............',
  '.....qrrrRr.............',
  '...qrrRRrrrr............',
  '..rrR...ggggg...........',
  '.rR....gssssmgg.........',
  '.R....gsssssssmg........',
  '.....gssssssssmmg.......',
  '.....gsssssssssmmg......',
  '....gsssssssssssmM......',
  '....gGGGGGGGGGGGGG......',
  '....smssvvvvvvvvvM......',
  '....smssvveevveevM......',
  '....smsssvvvvvvvmM......',
  '....mmsssssssssssM......',
  '.....MmsssssssmmM.......',
  '...sssMMmmmmmmMMsss.....',
  '..ssmmsbblllbbbsmmss....',
  '..smmMsbbgbbbbbsmmMs....',
  '..MMMMsbbgbbbbbsMMMM....',
  '...MM.bbbgbbbbbb.MM.....',
  '......ggggggggggg.......',
  '......bbbbbBbbbbb.......',
  '......bbbbb.bbbbb.......',
  '......mmmms.mmmms.......',
  '......MmmmM.MmmmM.......',
  '.....dddddd.dddddd......',
  '.....DDDDDD.DDDDDD......',
];

interface Pose {
  angle: number; // sword angle in degrees, 0 = right, -90 = up
  bodyDx?: number;
  bodyDy?: number;
  handDx?: number;
  handDy?: number;
  len?: number;
  behind?: boolean; // draw the sword behind the body
}

export const HERO_POSES: Record<string, Pose> = {
  idle0: { angle: -14 },
  idle1: { angle: -12, bodyDy: 1 },
  dash: { angle: 172, bodyDx: 1, handDx: -4, handDy: 1, behind: true },
  slashA: { angle: 28, handDx: 2, len: 21 },
  slashB: { angle: -4, handDx: 3, len: 21 },
  windup: { angle: -140, handDx: -4, handDy: -2, behind: true },
  parry: { angle: -95, handDx: 2, handDy: -3 },
  hurt: { angle: 140, bodyDx: -1, bodyDy: 1, handDx: -3, handDy: 1, behind: true },
  leap: { angle: -86, bodyDy: -1, handDy: -5, len: 21 },
};

function heroFrame(p: Pose): HTMLCanvasElement {
  const g = grid(HERO_W, HERO_H);
  const bx = HERO_FEET_X - 11 + (p.bodyDx ?? 0);
  const by = HERO_H - HERO_BODY.length + (p.bodyDy ?? 0);
  if (!p.behind) stamp(g, HERO_BODY, HERO_PAL, bx, by);
  const hx = bx + 18.5 + (p.handDx ?? 0);
  const hy = by + 18.5 + (p.handDy ?? 0);
  const a = (p.angle * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const len = p.len ?? 19;
  // broadsword: grip, wide crossguard, 3px blade with a bright edge and a blue fuller
  for (let i = -3; i <= 0; i++) put(g, hx + dx * i, hy + dy * i, i === -3 ? '#f2c230' : '#5a361c');
  for (let i = 2; i <= len; i++) {
    const tip = i >= len - 1;
    put(g, hx + dx * i - px, hy + dy * i - py, tip ? '#ffffff' : '#ffffff');
    put(g, hx + dx * i, hy + dy * i, tip ? '#ffffff' : '#7ec8ff');
    if (i < len - 1) put(g, hx + dx * i + px, hy + dy * i + py, '#9098b0');
  }
  for (let k = -3; k <= 3; k++) put(g, hx + dx + px * k, hy + dy + py * k, k === 0 ? '#e8443a' : '#f2c230');
  if (p.behind) stamp(g, HERO_BODY, HERO_PAL, bx, by);
  // gauntlet over the grip
  put(g, hx, hy, '#eef2f8');
  put(g, hx - dx, hy - dy, '#b4bccc');
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
  const body = flash ? '#ffffff' : '#5ed0a8';
  const dark = flash ? '#ffffff' : '#34967a';
  const deep = flash ? '#ffffff' : '#20664f';
  const light = flash ? '#ffffff' : '#a8f6d8';
  for (let y = 0; y < H; y++) {
    const v = (base - y) / RY;
    if (v < 0 || v > 1) continue;
    const half = RX * Math.sqrt(1 - v * v) * (v < 0.15 ? 0.92 + v * 0.5 : 1);
    const shift = lean * v * rx * 0.35;
    for (let x = Math.floor(cx - half + shift); x <= Math.ceil(cx + half + shift); x++) {
      const u = (x - (cx + shift)) / RX;
      if (Math.abs(u) > Math.sqrt(1 - v * v) + 0.02) continue;
      let col = body;
      if (v < 0.2 || u > 0.55) col = dark;
      if (v < 0.08) col = deep;
      if (u < -0.15 && u > -0.5 && v > 0.55 && v < 0.82) col = light;
      put(g, x, y, col);
    }
  }
  if (!flash) {
    const ey = Math.round(base - RY * 0.55);
    const ex = Math.round(cx - RX * 0.38 + lean * rx * 0.2);
    const eh = Math.max(2, Math.round(ry / 4));
    const gap = Math.max(3, Math.round(rx / 3));
    for (let k = 0; k < eh; k++) {
      put(g, ex, ey + k, '#1a1020');
      put(g, ex + gap, ey + k, '#1a1020');
    }
    put(g, ex, ey, '#ffffff');
    put(g, ex + gap, ey, '#ffffff');
    put(g, ex + Math.round(gap / 2), ey + eh + 1, '#20664f'); // little mouth
  }
  return toCanvas(g);
}

// ------------------------------------------------------------------ boar and bandit (maps, facing left)

const BOAR_PAL: Pal = { b: '#9a6238', l: '#be8450', B: '#6a3e1e', k: '#3e2412', p: '#f0a8a8', P: '#c87878', t: '#fff6e0', e: '#1a1020', d: '#2a180a' };
const BOAR_TOP = [
  '..........kk.kk..kkk..........',
  '........kkbbkkbbbkkbkk........',
  '......kbbbbbbbbbbbbbbbkk......',
  '.....bbbllllllllllllbbbbk.....',
  '....bblllllllllllllllbbbbk....',
  '...bbelbbbbbbbbbbbbbbbbbbbk...',
  '..bbbbbbbbbbbbbbbbbbbbbbbbbb..',
  '.ppbbbbbbbbbbbbbbbbbbbbbbbbbk.',
  'pPpPbbbbbbbbbbbbbbbbbbbbbbbbbk',
  'pppPbbbbbbbbbbbbbbbbbbbbbbbbk.',
  'tppbbbBbbbbbbbbbbbbbbbbbbbbb..',
  't.tbBBBbbbbbbbbbbbbbbbbbbbbb..',
  '.t..BBBBBBBBBBBBBBBBBBBBBBB...',
];
const BOAR_LEGS_IDLE = ['....BBB.BBB.........BBB.BBB...', '....BBB.BBB.........BBB.BBB...', '....ddd.ddd.........ddd.ddd...'];
const BOAR_LEGS_RUN = ['...BBB...BBB.......BBB...BBB..', '..BBB.....BBB.....BBB.....BBB.', '..ddd......ddd...ddd......ddd.'];

const BANDIT_PAL: Pal = { c: '#5e4e70', C: '#3e304e', s: '#e0b088', m: '#d23c3c', e: '#1a1020', w: '#8a6a3a', k: '#2a2030', d: '#eef3fa', D: '#9098b0' };
const BANDIT = [
  '.......cccccc.......',
  '......cccccccc......',
  '.....ccCCCCCCcc.....',
  '....ccCsssssCccc....',
  '....cCsssssssCcc....',
  '....cmmmmmmmmmcc....',
  '....mmemmmemmmcc....',
  '....cmmmmmmmmmcc....',
  '....cCsssssssCc.....',
  '.....cCssssCcc......',
  '....ccccccccccc.....',
  '...ccccccCccccccc...',
  '..ccccccCcccccccccc.',
  '.sscccccCcccccccccc.',
  'dsscccccCccccccccc..',
  'D..cccccCccccccccc..',
  '...cwwwwwwwwwwwc....',
  '...cccccccCcccccc...',
  '...cccccc..cccccc...',
  '...CCCCC....CCCCC...',
  '...CCCC......CCCC...',
  '...kkkk......kkkk...',
  '..kkkkk......kkkkk..',
];
const BANDIT_ATTACK_ARM = ['..ccccccCcccccccccc.', 'Ddsss.ccCcccccccccc.', '...ccccCccccccccc...', '...cccccCccccccccc..'];

function mapFrame(rows: string[], pal: Pal, flash = false): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const g = grid(w, rows.length + 2);
  stamp(g, rows, flash ? whiteOut(pal) : pal, 1, 1);
  return toCanvas(g);
}

// ------------------------------------------------------------------ icons

/** Single-color 5x5 icons drawn on blocks. */
export const ICONS: Record<string, string[]> = {
  drop: ['..#..', '.###.', '#####', '#####', '.###.'],
  tusk: ['#....', '#....', '.#...', '..##.', '....#'],
  mask: ['#####', '#.#.#', '#####', '.###.', '.....'],
  shield: ['#####', '#...#', '#...#', '.#.#.', '..#..'],
  bomb: ['...#.', '..#..', '.###.', '#####', '.###.'],
  speed: ['..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'],
};

/** Multi-color HUD icons (k = outline). */
export const HUD_ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  heart: {
    rows: ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'],
    pal: { k: 0x1a1020, r: 0xe23a3a, w: 0xffb0b0 },
  },
  crown: {
    rows: ['k.k.k.k', 'kykykyk', 'kyyyyyk', 'kgkgkgk', 'kkkkkkk'],
    pal: { k: 0x1a1020, y: 0xf2c230, g: 0xe8443a },
  },
  skull: {
    rows: ['.kkkkk.', 'kwwwwwk', 'kwkwkwk', 'kwkwkwk', 'kwwkwwk', '.kwwwk.', '.kwkwk.', '..kkk..'],
    pal: { k: 0x1a1020, w: 0xf2ecdc },
  },
  sword: {
    rows: ['.....kk', '....kwk', '...kwk.', 'k.kwk..', 'kkwk...', '.kyk...', 'kk.kk..'],
    pal: { k: 0x1a1020, w: 0xe2e8f2, y: 0xf2c230 },
  },
  crit: {
    rows: ['.kkk.', '.kgk.', '.kgk.', '.kgk.', '.kkk.', '.kgk.', '.kkk.'],
    pal: { k: 0x1a1020, g: 0x6ae05a },
  },
  bolt: {
    rows: ['..kkk', '.kyk.', 'kyykk', 'kkyyk', '.kyk.', 'kyk..', 'kk...'],
    pal: { k: 0x1a1020, y: 0x6ac8ff },
  },
  potion: {
    rows: ['.kkk.', '..k..', '.kpk.', 'kpppk', 'kpwpk', 'kpppk', '.kkk.'],
    pal: { k: 0x1a1020, p: 0xe05ab0, w: 0xffc0e8 },
  },
};

// ------------------------------------------------------------------ background (bright forest clearing, framed)

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function drawBackground(w: number, h: number, ground: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  let seed = 23;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };
  const horizon = ground - 30;

  // sky
  const stops = ['#58aee8', '#6ebcee', '#86caf2', '#9ed6f4', '#b8e2f6', '#d2eef8'];
  const bands = stops.length - 1;
  for (let y = 0; y < horizon; y++) {
    const f = (y / horizon) * bands;
    const i = Math.min(bands - 1, Math.floor(f));
    const t = f - i;
    for (let x = 0; x < w; x++) px(x, y, t * 16 > BAYER[y % 4][x % 4] ? stops[i + 1] : stops[i]);
  }
  // sun beams from the top left
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#ffffff';
  for (const [x0, wd] of [
    [40, 14],
    [90, 8],
    [150, 18],
    [230, 10],
  ])
    for (let y = 0; y < horizon; y++) ctx.fillRect(Math.round(x0 + y * 0.55), y, wd, 1);
  ctx.globalAlpha = 1;

  // puffy clouds along the horizon
  const puff = (cx: number, cy: number, r: number) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        px(cx + x, cy + y, y > r * 0.35 ? '#d6ecf6' : '#ffffff');
      }
  };
  for (let x = -10; x < w + 10; x += 9) puff(x, horizon - 26 + Math.round(Math.sin(x / 23) * 4), 6 + Math.round(rnd() * 5));

  // far mountains, sunlit on their left-facing slopes
  const ridgeY = (x: number, base: number, amp: number, f1: number, f2: number, ph: number) =>
    Math.round(base - amp * (0.6 * Math.abs(Math.sin(x / f1 + ph)) + 0.4 * Math.sin(x / f2 + ph * 2)));
  const ridge = (base: number, amp: number, f1: number, f2: number, col: string, hi: string, ph: number) => {
    for (let x = 0; x < w; x++) {
      const y = ridgeY(x, base, amp, f1, f2, ph);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, horizon - y + 1);
      if (ridgeY(x - 1, base, amp, f1, f2, ph) > y) px(x, y, hi);
    }
  };
  ridge(horizon - 16, 22, 41, 15, '#8cc4b0', '#b4e0cc', 0.4);
  ridge(horizon - 6, 12, 27, 11, '#6aac84', '#8ccaa0', 1.9);

  // distant stone tower (generic ruin)
  const tx = Math.round(w * 0.68);
  const ty = horizon - 30;
  ctx.fillStyle = '#c8c4b4';
  ctx.fillRect(tx, ty, 9, 26);
  ctx.fillStyle = '#a8a494';
  ctx.fillRect(tx + 6, ty, 3, 26);
  for (let k = 0; k < 9; k += 3) ctx.fillRect(tx + k, ty - 2, 2, 2);
  ctx.fillStyle = '#5a6a8a';
  ctx.fillRect(tx + 3, ty + 6, 2, 3);
  ctx.fillRect(tx + 3, ty + 14, 2, 3);

  // tree line: round canopies
  const canopy = (cx: number, cy: number, r: number, dark: string, mid: string, light: string) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        px(cx + x, cy + y, x + y < -r * 0.5 ? light : x + y > r * 0.5 ? dark : mid);
      }
  };
  for (let x = -6; x < w + 6; x += 7 + Math.floor(rnd() * 6)) canopy(x, horizon - 2 - Math.floor(rnd() * 6), 6 + Math.floor(rnd() * 4), '#2e6e3e', '#3e8a4a', '#5aa85a');
  for (let x = -6; x < w + 6; x += 9 + Math.floor(rnd() * 6)) canopy(x, horizon + 3, 5 + Math.floor(rnd() * 3), '#2a6438', '#367c44', '#4e9a54');

  // meadow
  for (let y = horizon + 6; y < ground - 8; y++) {
    const t = (y - horizon) / Math.max(1, ground - 8 - horizon);
    for (let x = 0; x < w; x++) px(x, y, t * 16 > BAYER[y % 4][x % 4] ? '#5ea844' : '#78bc50');
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w);
    const y = horizon + 8 + Math.floor(rnd() * Math.max(1, ground - 18 - horizon));
    px(x, y, rnd() < 0.5 ? '#ffffff' : '#a8d0ff');
  }

  // dirt path the fight happens on
  for (let y = ground - 8; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = y < ground - 6;
      px(x, y, edge ? '#5a9a3a' : (x * 7 + y * 13) % 29 === 0 ? '#8a6a40' : y > ground + 2 ? '#a07a4c' : '#b48c5a');
    }
  for (let x = 0; x < w; x += 2) if (rnd() < 0.7) px(x, ground - 9, '#4a8a30');
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = '#c8a070';
    ctx.fillRect(Math.floor(rnd() * w), ground - 4 + Math.floor(rnd() * Math.max(1, h - ground + 4)), 2, 1);
  }

  // framing trees on both edges, leaves over the top corners
  const trunk = (x0: number, width: number) => {
    for (let x = x0; x < x0 + width; x++)
      for (let y = 0; y < h; y++) {
        const k = x - x0;
        px(x, y, k === 0 || k === width - 1 ? '#22160c' : (k + Math.floor(y / 5)) % 6 === 0 ? '#5e4228' : k < width / 3 ? '#4a321e' : '#3a2616');
      }
  };
  trunk(-2, 18);
  trunk(w - 16, 18);
  for (let i = 0; i < 26; i++) {
    const left = i % 2 === 0;
    const cx = left ? Math.floor(rnd() * 60) - 6 : w - Math.floor(rnd() * 60) + 6;
    canopy(cx, Math.floor(rnd() * 14) - 4, 7 + Math.floor(rnd() * 5), '#1e4a26', '#2a6232', '#3a7a3e');
  }
  return c;
}

function drawClouds(w: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 26;
  const ctx = c.getContext('2d')!;
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(rnd() * w);
    const cy = 6 + Math.floor(rnd() * 12);
    const len = 22 + Math.floor(rnd() * 26);
    for (let k = 0; k < 5; k++) {
      const inset = Math.abs(k - 1.5) * 3;
      ctx.fillStyle = k >= 3 ? '#d6ecf6' : '#ffffff';
      for (let x = Math.round(cx + inset); x < cx + len - inset; x++) ctx.fillRect(((x % w) + w) % w, cy + k, 1, 1);
    }
  }
  return c;
}

// ------------------------------------------------------------------ build

export function buildArt(scene: Phaser.Scene, w: number, h: number, ground: number): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  for (const [name, pose] of Object.entries(HERO_POSES)) add(`hero_${name}`, heroFrame(pose));
  const slimes: Array<[string, number, number]> = [
    ['slime', 13, 11],
    ['bigslime', 25, 21],
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
  add('boar_idle1', mapFrame(['.'.repeat(30), ...BOAR_TOP, BOAR_LEGS_IDLE[1], BOAR_LEGS_IDLE[2]], BOAR_PAL));
  add('boar_windup', mapFrame(boarRun, BOAR_PAL));
  add('boar_attack', mapFrame(boarRun, BOAR_PAL));
  add('boar_hurt', mapFrame(boarIdle, BOAR_PAL));
  add('boar_flash', mapFrame(boarIdle, BOAR_PAL, true));
  const banditAttack = [...BANDIT.slice(0, 12), ...BANDIT_ATTACK_ARM, ...BANDIT.slice(16)];
  add('bandit_idle0', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_idle1', mapFrame(['.'.repeat(20), ...BANDIT.slice(0, 10), ...BANDIT.slice(11)], BANDIT_PAL));
  add('bandit_windup', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_attack', mapFrame(banditAttack, BANDIT_PAL));
  add('bandit_hurt', mapFrame(BANDIT, BANDIT_PAL));
  add('bandit_flash', mapFrame(BANDIT, BANDIT_PAL, true));
  add('bg', drawBackground(w, h, ground));
  add('clouds', drawClouds(w));
}

/** Bottom panel: a wooden band holding the bar, over a stone strip (CQ2-style composition, original art). */
export function buildPanel(scene: Phaser.Scene, w: number, h: number, bandH: number): void {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const fill = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, ww, hh);
  };
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // wood planks
  fill(0, 0, w, bandH, '#7a4a28');
  const plankH = Math.ceil(bandH / 3);
  for (let p = 0; p < 3; p++) {
    const y0 = p * plankH;
    fill(0, y0, w, 1, '#94603a');
    fill(0, y0 + plankH - 1, w, 1, '#4e2c14');
    for (let i = 0; i < 40; i++) fill(Math.floor(rnd() * w), y0 + 2 + Math.floor(rnd() * (plankH - 4)), 3 + Math.floor(rnd() * 8), 1, '#6a3e20');
    for (let x = (p * 37) % 70; x < w; x += 70) {
      fill(x, y0, 1, plankH, '#4e2c14');
      fill(x + 3, y0 + 3, 1, 1, '#3a200e');
      fill(x - 4, y0 + plankH - 4, 1, 1, '#3a200e');
    }
  }
  fill(0, 0, w, 2, '#2e1a0c');
  fill(0, 2, w, 1, '#b07a48');
  // stone strip
  fill(0, bandH, w, h - bandH, '#5c5c68');
  fill(0, bandH, w, 2, '#2a2a32');
  fill(0, bandH + 2, w, 1, '#8a8a96');
  for (let row = 0; bandH + 3 + row * 9 < h; row++) {
    const y0 = bandH + 3 + row * 9;
    fill(0, y0 + 8, w, 1, '#44444e');
    for (let x = (row % 2) * 9; x < w; x += 18) {
      fill(x, y0, 1, 8, '#44444e');
      fill(x + 1, y0, 16, 1, '#6c6c78');
    }
  }
  if (scene.textures.exists('panel')) scene.textures.remove('panel');
  scene.textures.addCanvas('panel', c);
}
