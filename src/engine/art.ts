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

// ------------------------------------------------------------------ Pip, the companion owl (round, big-eyed)

const PIP_PAL: Pal = { b: '#4a8ad8', B: '#2e5aa0', d: '#22467e', c: '#e6f2ff', C: '#a8c4e8', w: '#ffffff', e: '#1a1020', y: '#f2c230', Y: '#b07e18', t: '#7ab8ff' };
export const PIP_W = 26;
export const PIP_H = 24;

/** wing: 'down' (folded), 'up' (flap), 'back' (swept for a dive). */
function owlFrame(wing: 'down' | 'up' | 'back', flash = false): HTMLCanvasElement {
  const g = grid(PIP_W, PIP_H);
  const pal = flash ? whiteOut(PIP_PAL) : PIP_PAL;
  const P = (x: number, y: number, k: string) => put(g, x, y, pal[k]);
  const cx = 13;
  const cy = 12;
  // body: a plump egg, darker on the lower right
  for (let y = -10; y <= 10; y++)
    for (let x = -9; x <= 9; x++) {
      if ((x * x) / 81 + (y * y) / 100 > 1) continue;
      P(cx + x, cy + y, x * 0.6 + y > 7 ? 'B' : 'b');
    }
  // ear tufts
  for (const s of [-1, 1]) {
    P(cx + s * 6, cy - 10, 't');
    P(cx + s * 7, cy - 11, 't');
    P(cx + s * 7, cy - 10, 'b');
    P(cx + s * 5, cy - 10, 'b');
  }
  // belly with chevrons
  for (let y = -4; y <= 6; y++)
    for (let x = -6; x <= 6; x++) {
      if ((x * x) / 36 + (y * y) / 36 > 1) continue;
      P(cx + x, cy + 3 + y, (y + 6) % 3 === 0 && Math.abs(x) % 3 === 1 ? 'C' : 'c');
    }
  // big eyes looking right
  for (const ex of [cx - 4, cx + 4]) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) P(ex + x, cy - 4 + y, 'w');
    P(ex + 1, cy - 5, 'e');
    P(ex + 2, cy - 5, 'e');
    P(ex + 1, cy - 4, 'e');
    P(ex + 2, cy - 4, 'e');
    P(ex + 1, cy - 3, 'e');
  }
  P(cx - 1, cy - 1, 'y');
  P(cx, cy - 1, 'y');
  P(cx, cy, 'Y');
  // feet
  for (const fx of [cx - 3, cx + 3]) {
    P(fx - 1, cy + 10, 'y');
    P(fx, cy + 10, 'y');
    P(fx + 1, cy + 10, 'Y');
  }
  // wings
  for (const s of [-1, 1]) {
    const wx = cx + s * 9;
    if (wing === 'down')
      for (let y = 0; y < 9; y++) {
        P(wx, cy - 1 + y, 'd');
        P(wx - s, cy - 1 + y, 'B');
        if (y > 2 && y < 7) P(wx + s, cy + y, 'd');
      }
    else if (wing === 'up')
      for (let i = 0; i < 9; i++) {
        P(wx + s * Math.floor(i / 2), cy - 1 - i, 'd');
        P(wx + s * Math.floor(i / 2) - s, cy - i, 'B');
        P(wx + s * Math.floor(i / 2) + s, cy - 2 - i, 'b');
      }
    else if (s > 0)
      for (let y = 0; y < 7; y++) {
        P(wx, cy + 1 + y, 'd');
        P(wx - 1, cy + 1 + y, 'B');
      }
    else
      for (let i = 0; i < 4; i++) {
        P(wx - i, cy - 5 + i * 2, 'b');
        P(wx - i, cy - 4 + i * 2, 'B');
        P(wx - i, cy - 3 + i * 2, 'd');
      }
  }
  return toCanvas(g);
}

// ------------------------------------------------------------------ treasure chest (level clear)

const CHEST_PAL: Pal = { l: '#d08a4c', b: '#a0622e', d: '#6a3e1c', y: '#f2c230', Y: '#b07e18', e: '#5ae070', c: '#fff0a0', C: '#f2c230' };
const CHEST_BODY = [
  'yyyyyyyyyyyyyyyyyy',
  'bbbbYbbbyybbbYbbbb',
  'bbbbYbbyeeybbYbbbb',
  'bbbbYbbbyybbbYbbbb',
  'bbbbYbbbbbbbbYbbbb',
  'ddddYddddddddYdddd',
];
const CHEST_CLOSED = [
  '...llllllllllll...',
  '.llbbYbbbbbbbYbbl.',
  'lbbbbYbbbbbbbYbbbl',
  'bbbbbYbbbbbbbYbbbb',
  'ddddddddddddddddddd'.slice(0, 18),
  ...CHEST_BODY,
];
const CHEST_OPEN = [
  '..llllllllllllll..',
  '.dbbbYbbbbbbbYbbd.',
  '.dddddddddddddddd.',
  'cCcCccCcCcCccCcCcC',
  'CcccCcCccCcCccCccc',
  ...CHEST_BODY,
];

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
  coin: {
    rows: ['.kkkkk.', 'kyyyyyk', 'kywyyYk', 'kywyyYk', 'kyyyyYk', 'kYYYYYk', '.kkkkk.'],
    pal: { k: 0x1a1020, y: 0xf2c230, Y: 0xb07e18, w: 0xfff6c0 },
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

export function buildArt(scene: Phaser.Scene, w: number): void {
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
  add('pip_idle0', owlFrame('down'));
  add('pip_idle1', owlFrame('up'));
  add('pip_dive', owlFrame('back'));
  add('chest_closed', mapFrame(CHEST_CLOSED, CHEST_PAL));
  add('chest_open', mapFrame(CHEST_OPEN, CHEST_PAL));
  add('clouds', drawClouds(w));
}
