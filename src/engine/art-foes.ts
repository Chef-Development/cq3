// Greenmarch enemies (see docs/art-style.md): character maps with an automatic ink outline, facing left.
// Every sprite has the frames the fighters view uses: idle0, idle1, windup, attack, hurt, flash, tell
// (the special's telegraph wind-up), plus a few extras (knight_guard, beetle_shell).
import { grid, slimeFrame, stampShaded, toCanvas, type Pal, type Shade } from './art';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Sprite names this file draws (each gets `${name}_${pose}` textures). */
export const FOE_SPRITES = ['slimelet', 'crow', 'archer', 'shaman', 'beetle', 'wolf', 'knight', 'captain', 'golem', 'boarking', 'piglet'] as const;
export const FOE_POSES = ['idle0', 'idle1', 'windup', 'attack', 'hurt', 'flash', 'tell'] as const;

/** Each sprite's main body color (death-burst and hit chips). */
export const FOE_COL: Record<string, number> = {
  slimelet: 0x4fc4a0,
  crow: 0x3a4270,
  archer: 0x6e8a3a,
  shaman: 0xa02a7a,
  beetle: 0x2e8e86,
  wolf: 0x6e7e9e,
  knight: 0x4a7e36,
  captain: 0x523a72,
  golem: 0x7a7a8a,
  boarking: 0x5e3030,
  piglet: 0xc08048,
};

// ------------------------------------------------------------------ helpers

interface PartOpts {
  pal?: Pal;
  shades?: Record<string, Shade>;
  /** Interior contour (the local darkest tone) drawn where this part overlaps what is already there. */
  edge?: string;
  /** Drawn after the outline pass, so it gets no ink outline (bowstrings, thin shafts, glows). */
  late?: boolean;
}
type Part = [rows: string[], x: number, y: number, opts?: PartOpts];

/** Compose parts back to front into a W x H frame (1px kept free on every side for the outline). */
function render(W: number, H: number, pal: Pal, shades: Record<string, Shade>, parts: Part[], flash = false): HTMLCanvasElement {
  const g = grid(W, H);
  const late = grid(W, H);
  for (const [rows, ox, oy, o = {}] of parts) {
    if (o.late) {
      stampShaded(late, rows, o.pal ?? pal, o.shades ?? shades, ox, oy, flash);
      continue;
    }
    if (o.edge) {
      const on = (x: number, y: number) => {
        const c = rows[y]?.[x];
        return c !== undefined && c !== '.' && c !== ' ';
      };
      const h = rows.length;
      const w = Math.max(...rows.map((r) => r.length));
      for (let y = -1; y <= h; y++)
        for (let x = -1; x <= w; x++) {
          if (on(x, y) || !(on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) continue;
          const gx = ox + x;
          const gy = oy + y;
          if (g[gy]?.[gx]) g[gy][gx] = o.edge;
        }
    }
    stampShaded(g, rows, o.pal ?? pal, o.shades ?? shades, ox, oy);
  }
  if (flash) for (const r of g) for (let x = 0; x < r.length; x++) if (r[x]) r[x] = '#ffffff';
  const c = toCanvas(g);
  const ctx = c.getContext('2d')!;
  late.forEach((r, y) =>
    r.forEach((col, x) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

/** Replace characters: pairs like ['E', 'k'] applied to every row. */
const swap = (rows: string[], pairs: [string, string][]) =>
  rows.map((r) => pairs.reduce((s, [a, b]) => s.split(a).join(b), r));

const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

/** A part from loose points in frame coordinates: [letter, [[x, y], ...]] pairs, later ones on top. */
function dots(spec: [string, [number, number][]][], opts?: PartOpts): Part {
  const all = spec.flatMap(([, p]) => p);
  const minx = Math.min(...all.map((p) => p[0]));
  const miny = Math.min(...all.map((p) => p[1]));
  const w = Math.max(...all.map((p) => p[0])) - minx + 1;
  const h = Math.max(...all.map((p) => p[1])) - miny + 1;
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [ch, pts] of spec) for (const [x, y] of pts) g[y - miny][x - minx] = ch;
  return [g.map((r) => r.join('')), minx, miny, opts];
}

/** A 2px thick limb from (x0, y0) to (x1, y1) in frame coordinates. */
function limb(x0: number, y0: number, x1: number, y1: number, ch: string, opts?: PartOpts): Part {
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

// ------------------------------------------------------------------ crow (glossy blue-black, hovering)

// blue-black, hue-shifted: shadows lean purple, the gloss leans cyan
const CROW = ['#100c20', '#1e1e3c', '#2e3460', '#42548a', '#6488bc', '#9ccce0'];
const CROW_PAL: Pal = {
  f: CROW[0], F: CROW[1], h: CROW[5], j: CROW[4],
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14',
  E: '#ff4a3a', e: '#b01828', k: '#140c1c', W: '#ffffff',
  r: '#d03040', // open beak inside
  0: CROW[0], 1: CROW[1], 2: CROW[2], 3: CROW[3], 4: CROW[4], 5: CROW[5],
};
const CROW_SHADES: Record<string, Shade> = {
  b: { ramp: CROW, same: 'hjEekfF', top: [4, 3], left: [3], right: [1], bottom: [0, 1], mid: 2 },
  w: { ramp: CROW, same: 'fFhj', top: [4, 3], left: [3], right: [1], bottom: [1, 1], mid: 2 },
};
// 19 wide, facing left: thick beak, round head, plump body tilted down to a fan tail
const CROW_BODY = [
  '....bhhb............',
  '...bhjjbbb..........',
  '..bhjbbbbbb.........',
  'ggbbkEbbbbbb........',
  'GyYbbebbbbbbbb......',
  '.YYYbbbbbbbbbbbb....',
  '...bbbbbbbbbbbbbb32.',
  '....bbbbbbbbbbb22221',
  '......bbbbbbbb12121.',
  '.........bbb..1.1...',
];
// the head with the beak open (caw / dive)
const CROW_OPEN = [
  '...bbbb....',
  '..bhhjbb...',
  'g.bhjbbbbb.',
  'Gg.kEbbbbbb',
  '.rrbebbbbbb',
  'YYYbbbbbbbb',
];
const crowOpen = (rows: string[]) => [...CROW_OPEN.map((r, i) => r + rows[i].slice(11)), ...rows.slice(6)];
// wings in explicit tones (0-5 = CROW ramp); the fringe of primaries ends in separate feather tips
const CROW_WING: Record<string, string[]> = {
  up: [
    '.......4.4.3',
    '......44.4.3',
    '.....454.432',
    '....45433322',
    '...45433221.',
    '..4433222.1.',
    '.4433221....',
    '443321......',
    '4321........',
  ],
  down: [
    '45444443.....',
    '.4433332221..',
    '..332222121..',
    '...2221.21.1.',
    '....21.21.1..',
    '.....1.1.....',
  ],
  spread: [
    '.........4.4.3',
    '........44.4.3',
    '.......454.432',
    '......45433322',
    '.....45433221.',
    '....4433222.1.',
    '...4433221....',
    '..443321......',
    '.44321........',
    '4432..........',
    '432...........',
  ],
  back: [
    '...444444.....',
    '445455543332..',
    '4433332222221.',
    '.32221212.2.2.',
    '..2.2.2.......',
  ],
};
const CROW_FEET = ['yY.yY', 'Y..Y.'];

/** Lean back: the rows above `from` slide right, one more pixel every `step` rows. */
const leanBack = (rows: string[], from: number, step: number) =>
  rows.map((r, i) => (i < from ? '.'.repeat(Math.ceil((from - i) / step)) + r : r));

function crowParts(pose: string): Part[] {
  const W = CROW_WING;
  let bx = 1;
  let by = 8;
  let wing = W.up;
  let body = CROW_BODY;
  let farDx = 10;
  let farDy = -1;
  let far = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 9;
      wing = W.down;
      break;
    case 'windup':
      // a quick flinch back, wings cocked
      bx = 3;
      by = 8;
      body = leanBack(CROW_BODY, 4, 2);
      break;
    case 'attack':
      bx = 0;
      by = 9;
      wing = W.back;
      far = false;
      body = crowOpen(CROW_BODY);
      break;
    case 'hurt':
      bx = 3;
      by = 9;
      wing = W.down;
      body = leanBack(CROW_BODY, 5, 2).map((r) => r.replace('kE', 'kk').replace('be', 'kb'));
      // loose feathers knocked off
      extra.push([['..3', '32.'], 20, 4], [['43', '2.'], 22, 9]);
      break;
    case 'tell':
      // rears up, wings thrown high in a V, beak open, eye blazing
      bx = 2;
      by = 7;
      wing = W.spread;
      farDx = 12;
      farDy = 0;
      body = crowOpen(CROW_BODY).map((r) => r.replace('kE', 'EW').replace('be', 'EE'));
      break;
  }
  const down = wing === W.down || wing === W.back;
  const wy = down ? by + 4 : by - wing.length + 6;
  const parts: Part[] = [];
  // the far wing: the same shape a step darker, peeking out behind
  if (far) parts.push([wing.map((r) => r.replace(/[1-5]/g, (c) => String(Math.max(1, +c - 1)))), bx + farDx, wy + farDy]);
  parts.push([CROW_FEET, bx + 8, by + body.length - 1]);
  parts.push([body, bx, by]);
  parts.push([wing, bx + 6, wy, { edge: CROW[0] }]);
  return [...parts, ...extra];
}

// ------------------------------------------------------------------ piglet (striped boarlet)

const PIG = ['#4a2424', '#7a4430', '#a8683e', '#d08e52', '#f0b870'];
const PIG_CREAM = ['#8a5a3a', '#b88a5a', '#e0bc84', '#f4daa4', '#fff0c8'];
const PIG_PAL: Pal = {
  L: PIG[4], l: PIG[3], c: PIG[2], d: PIG[1], x: PIG[0], q: PIG[1],
  e: '#140c1c', r: '#ff5a3a', o: '#5a2430', t: '#f4e4c0',
  h: '#2a1c24', H: '#5a4650', w: '#ffffff', W: '#c8d8e8',
};
const PIG_SHADES: Record<string, Shade> = {
  b: { ramp: PIG, same: 'sLlcdxertwq', top: [4, 3], left: [3], right: [1], bottom: [0, 1] },
  s: { ramp: PIG_CREAM, same: 'b', top: [4], left: [3], right: [1], bottom: [0, 1] },
  p: { ramp: ['#5a2430', '#a85458', '#d88078', '#f4a898', '#ffd0c0'], same: 'o', top: [3], left: [4], right: [1], bottom: [0] },
};
// 15 wide, facing left: pink snout, floppy ear, striped barrel body, curly tail
const PIG_BODY = [
  '...Ld..........',
  '..Llld..bbbbb..',
  '..Lllld.bbbbbbq',
  '.Llleldbsssssbq',
  'pLllllcbbbbbbbb',
  'ppLlccxsssssssb',
  'potdcxbbbbbbbbb',
  '...xxbsssssbbb.',
  '....bbbbbbbbb..',
];
const PIG_LEGS: Record<string, string[]> = {
  stand: ['...bb.b...bb.b.', '...hH.h...hH.h.'],
  trot: ['..bb...b.bb..b.', '.hH....hHhH...h'],
  paw: ['.bb...b...bb.b.', 'hH....h...hH.h.'],
};

function pigParts(pose: string): Part[] {
  let dx = 0;
  let bob = 0;
  let legs = PIG_LEGS.stand;
  let body = PIG_BODY;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      bob = 1;
      break;
    case 'windup':
      dx = 1;
      bob = 1;
      body = body.map((r) => r.replace('lel', 'lrl'));
      break;
    case 'attack':
      dx = -1;
      legs = PIG_LEGS.trot;
      break;
    case 'hurt':
      dx = 1;
      body = body.map((r) => r.replace('leld', 'eeed'));
      break;
    case 'tell':
      // head down, pawing, a snort of steam
      dx = 2;
      bob = 1;
      legs = PIG_LEGS.paw;
      body = body.map((r) => r.replace('lel', 'lrl'));
      extra.push([['.w', 'wW', 'W.'], 0, 8]);
      break;
  }
  return [[legs, 1, 10], [body, 1 + dx, 1 + bob], ...extra];
}

// ------------------------------------------------------------------ wolf (lean, grey-blue)

// grey-blue fur, hue-shifted: shadows lean indigo, highlights lean warm grey
const WOLF = ['#161628', '#28304c', '#404c6e', '#5e6e92', '#8a9cb8', '#c0ccd8'];
const WOLF_PALE = ['#4a4c66', '#7e86a0', '#b4bccc', '#e0e2e6', '#f6f4ee'];
const WOLF_PAL: Pal = {
  F: WOLF[0], i: '#6a3a50', n: '#140c1c', N: '#3a3450', p: WOLF[2],
  E: '#ffd84a', e: '#140c1c', m: WOLF[0], r: '#b02838', R: '#e8505a', t: '#ffffff', T: '#c8ccd8',
  w: '#ffffff', W: '#c8d8e8',
};
const WOLF_SHADES: Record<string, Shade> = {
  b: { ramp: WOLF, same: 'sFiEenNmrRtTu', top: [4, 4], left: [4], right: [2], bottom: [1, 2], mid: 3 },
  s: { ramp: WOLF, same: 'bFiEenNmrRtTu', top: [4, 3], left: [3], right: [1], bottom: [2], mid: 2 },
  u: { ramp: WOLF_PALE, same: 'bs', top: [3], left: [3], right: [1], bottom: [1, 2], mid: 2 },
  l: { ramp: WOLF, same: 'p', top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
};
// heads, 13 wide, facing left: dark saddle over the crown, pale cheeks and jaw
const WOLF_HEAD: Record<string, string[]> = {
  idle: [
    '......sb.sb..',
    '......sisbis.',
    '.....sssssss.',
    '...bbFFsssssss',
    '.bbbbbEesssss',
    'Nbbbbbbbbbsss',
    'nbbbbbbuubbss',
    '.mmuuuuuubbbs',
    '...uuuuuubb..',
  ],
  bite: [
    '......sb.sb..',
    '......sisbis.',
    '.....sssssss.',
    'NbbbbFFsssssss',
    'nbbbbbEesssss',
    '.tbtbbbbbbsss',
    '..rrrrrbbbbss',
    '.TrRrrrubbbbs',
    'uuutuuuuubb..',
  ],
  howl: [
    '..n..........',
    '..bb.........',
    'r.bbb........',
    'brrbbb.sb....',
    'bbrrbbbsib...',
    '.bbrrbFsssss.',
    '..bbubsssssss',
    '...uubbbsssss',
    '....uubbbssss',
    '.....uubbbsss',
  ],
};
// body and neck ruff, 17 wide
const WOLF_BODY = [
  '.ssssssssssss....',
  'sssssssssssssss..',
  'bsssssssssssssss.',
  'bbbssssssbbbsssb.',
  'ubbbbbbbbbbbbbbbb',
  'uubbbbbbbbbbbbbbb',
  '.uubbbbbbbbbbbbb.',
  '..ubbb.......bbb.',
];
const WOLF_TAIL: Record<string, string[]> = {
  down: ['bb...', 'bbbb.', '.bbbb', '..bbb', '..bbb', '..bbu', '..uu.'],
  up: ['...bb', '..bbb', '.bbbb', 'bbbb.', 'bbb..', 'bb...'],
};
// legs, 22 wide (front pair at the left)
const WOLF_LEGS: Record<string, string[]> = {
  stand: [
    '.ll.ll........ll.ll...',
    '.ll.ll.......ll..ll...',
    '.ll.ll.......ll..ll...',
    '.ll.ll......ll...ll...',
    'pp.pp.......pp..pp....',
  ],
  lunge: [
    'll...ll......ll..ll...',
    'll....ll....ll....ll..',
    'll.....ll..ll......ll.',
    'pp......pp.pp.......pp',
    '......................',
  ],
  crouch: [
    '.ll.ll.......lll.ll...',
    '.ll.ll......ll..ll....',
    'pp.pp.......pp..pp....',
    '......................',
    '......................',
  ],
};

function wolfParts(pose: string): Part[] {
  const F = 18; // feet row
  let head = WOLF_HEAD.idle;
  let hx = 1;
  let hy = 4;
  let bx = 10;
  let by = 7;
  let legs = WOLF_LEGS.stand;
  let lx = 9;
  let tail = WOLF_TAIL.down;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      hy = 5;
      by = 8;
      break;
    case 'windup':
      hx = 3;
      hy = 6;
      bx = 11;
      by = 8;
      legs = WOLF_LEGS.crouch;
      break;
    case 'attack':
      head = WOLF_HEAD.bite;
      hx = 0;
      hy = 5;
      bx = 9;
      by = 8;
      lx = 6;
      legs = WOLF_LEGS.lunge;
      tail = WOLF_TAIL.up;
      break;
    case 'hurt':
      head = WOLF_HEAD.idle.map((r) => r.replace('Ee', 'ee').replace('bibbib', 'bbbbbb'));
      hx = 3;
      hy = 4;
      bx = 11;
      by = 7;
      break;
    case 'tell':
      head = WOLF_HEAD.howl;
      hx = 3;
      hy = 0;
      bx = 11;
      by = 7;
      tail = WOLF_TAIL.up;
      break;
  }
  const ly = F - legs.length + 1;
  return [
    [tail, bx + 16, by + 1],
    [legs, lx, ly],
    [WOLF_BODY, bx, by],
    [head, hx, hy],
    ...extra,
  ];
}

// ------------------------------------------------------------------ beetle (low, armored, metallic shell)

// metallic teal: deep blue shadows, mint-yellow glare
const SHELL = ['#0c1a2a', '#123a4a', '#1a6066', '#2a8c84', '#58c0a2', '#c4f4c8'];
const BRONZE = ['#2e1610', '#6a3a18', '#a86a26', '#dca444', '#fff0a0'];
const BUG = ['#1a1024', '#30223c', '#4a3658', '#6a5276', '#927aa0'];
const BEETLE_PAL: Pal = {
  0: SHELL[0], 1: SHELL[1], 2: SHELL[2], 3: SHELL[3], 4: SHELL[4], 5: SHELL[5],
  k: '#140c1c', E: '#ff6a3a', e: '#ffd84a', W: '#ffffff', w: '#c4f4c8', g: '#fffbe0', G: '#f2c230',
  m: '#ffeab0', M: '#e0b070', n: '#a8784a', // wing membrane and its veins
};
const BEETLE_SHADES: Record<string, Shade> = {
  r: { ramp: BRONZE, top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
  c: { ramp: BRONZE, top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  u: { ramp: BUG, same: 'Eel', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  l: { ramp: BUG, top: [3], left: [3], right: [1], bottom: [1], mid: 2 },
};
// metallic dome in explicit tones (0-5): sharp glare up front, a dark core, reflected light above the
// bronze rim; the seam (1) splits the front plate from the wing case
const BEETLE_SHELL = [
  '........4444443.......',
  '.....445555444433.....',
  '...44555544431333332..',
  '..455544433133333222..',
  '.4554433331333332222..',
  '4544333321333322222221',
  '4433322221222222222111',
  '3322222112111111111110',
  '2333332213233332333321',
  'rrrrrrrrrrrrrrrrrrrrrr',
];
// head with a forward horn, 9 wide
const BEETLE_HEAD = [
  'c........',
  'cc.......',
  '.cc......',
  '.ccc.....',
  '..cccuu..',
  '..uuuuuu.',
  '.uEeuuuuu',
  'uuuuuuuuu',
  '.luuuuuu.',
  'l........',
];
const BEETLE_LEGS: Record<string, string[]> = {
  stand: ['.ll.....ll......ll..', 'll.....ll......ll...', 'l......l.......l....'],
  step: ['..ll....ll.....ll...', '.ll......ll...ll....', 'l.........l..l......'],
  rear: ['..........ll.....ll.', '.........ll.....ll..', '.........l......l...'],
};

/** Lift the left (front) end of a map by `amt` rows, tapering to 0 at the right end. */
function shearUp(rows: string[], amt: number): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  const out = Array.from({ length: rows.length + amt }, () => Array<string>(w).fill('.'));
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch !== '.') out[y + amt - Math.round(amt * (1 - x / (w - 1)))][x] = ch;
    }),
  );
  return out.map((r) => r.join(''));
}

function beetleParts(pose: string): Part[] {
  const F = 18;
  let sx = 7;
  let sy = 5;
  let hx = 1;
  let hy = 6;
  let legs = BEETLE_LEGS.stand;
  let head = BEETLE_HEAD;
  let shell = [...BEETLE_SHELL, '.uuuuuuuuuuuuuuuuuuuu'];
  const extra: Part[] = [];
  const pre: Part[] = [];
  switch (pose) {
    case 'idle1':
      sy = 6;
      hy = 7;
      break;
    case 'windup':
      sx = 8;
      hx = 3;
      hy = 7;
      sy = 6;
      break;
    case 'attack':
      sx = 6;
      hx = -1;
      hy = 6;
      legs = BEETLE_LEGS.step;
      head = BEETLE_HEAD.map((r) => r.replace('Ee', 'Ew'));
      break;
    case 'hurt':
      sx = 8;
      hx = 3;
      hy = 5;
      head = BEETLE_HEAD.map((r) => r.replace('Ee', 'kk'));
      break;
    case 'tell': {
      // rears up on its back legs; the plates crack open along the seam with light pouring out and
      // the wings unfolding under the back of the case
      const seam: [number, number][] = [[12, 2], [11, 3], [10, 4], [10, 5], [10, 6], [9, 7], [8, 8]];
      const lit = shell.map((r) => [...r]);
      for (const [x, y] of seam) {
        lit[y][x] = 'g';
        lit[y][x + 1] = 'G';
      }
      lit[1][13] = 'g';
      lit[0][13] = 'g';
      shell = shearUp(lit.map((r) => r.join('')), 3);
      sy = 15 - (shell.length - 1);
      hx = 0;
      hy = sy - 1;
      legs = BEETLE_LEGS.rear;
      head = BEETLE_HEAD.map((r) => r.replace('Ee', 'eW'));
      pre.push([['.........mM', '......mmmnM', '...mmmnmMM.', 'mmmnmMMM...', '.mMMM......'], sx + 12, sy + 1]);
      extra.push([['l.', '.l', 'l.'], hx + 7, hy + 10]);
      break;
    }
    case 'shell':
      // hunkered: head and legs pulled in, shell flat on the ground, a glint on top
      sy = 7;
      hx = 5;
      hy = 9;
      legs = [];
      shell = shell.map((r, y) => (y < 3 ? r.replace(/4/g, '5') : r));
      extra.push([['..W..', '..W..', 'WWwWW', '..W..', '..W..'], 11, 4]);
      break;
  }
  const parts: Part[] = [...pre];
  if (legs.length) parts.push([legs, sx + 1, F - legs.length + 1]);
  parts.push([head, hx, hy]);
  parts.push([shell, sx, sy]);
  return [...parts, ...extra];
}

// ------------------------------------------------------------------ archer (goblin with a short bow)

// goblin green: shadows lean blue-teal, highlights lean yellow
const GOB = ['#14262a', '#204630', '#3a6e34', '#68a03c', '#a4d04e', '#dcf07c'];
const HOOD = ['#26121c', '#48261e', '#6e4024', '#986434', '#c48c4c'];
const CLOTH = ['#1c1626', '#32243a', '#4e344c', '#704a60', '#94687a'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
const ARCHER_PAL: Pal = {
  E: '#ffe04a', k: '#140c1c', F: GOB[1], m: GOB[1], t: '#f4f0d8', // eye, brow, mouth, fang
  s: '#e8e0c8', o: WOOD[2], // bow string, dark side of the bow
  a: WOOD[4], A: WOOD[2], i: '#d8e2f0', I: '#7c86a6', f: '#e04a3a', q: '#a02a2a', // arrow
  d: '#2a1810', D: '#4a2c18', y: '#d8901c', Y: '#f2c230', // belt, buckle
  b: '#2a1810', B: '#4a3024', // boots
  p: '#2a2436', P: '#3e3650', // trousers
  W: '#ffffff',
};
const ARCHER_SHADES: Record<string, Shade> = {
  g: { ramp: GOB, same: 'EkFmtn', top: [4, 3], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  n: { ramp: GOB, top: [4], left: [4], right: [2], bottom: [2], mid: 3 },
  h: { ramp: HOOD, top: [4, 3], left: [3], right: [1, 2], bottom: [1], mid: 2 },
  c: { ramp: CLOTH, same: 'dDyY', top: [3], left: [3], right: [1, 1], bottom: [1], mid: 2 },
  v: { ramp: CLOTH, top: [4], left: [4], right: [2], bottom: [2], mid: 3 }, // sleeves
  w: { ramp: WOOD, top: [5], left: [4], right: [2], bottom: [1], mid: 3 },
  Q: { ramp: HOOD, top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // quiver
};
// hooded head, 15 wide, facing left; the long ear pokes out of the hood behind
const ARCHER_HEAD = [
  '.....hhhhh.....',
  '...hhhhhhhhh...',
  '..hhhhhhhhhhh..',
  '..hhgggggghhh..',
  '.hhgFFgggghhhgg',
  '.hgEkggggghhgg.',
  'nngggggggghhg..',
  'nnggmmtgghhh...',
  '..ggggghhhh....',
  '....hhhhh......',
];
// body with quiver on the back, 13 wide
const ARCHER_BODY = [
  '.......f.f...',
  '.......afa...',
  '...cccQQQQ...',
  '..cccccQQQQ..',
  '..ccccccQQQ..',
  '..ccccccQQQ..',
  '..dDyYddddd..',
  '..cccccccc...',
  '...ccc.ccc...',
];
const ARCHER_LEGS: Record<string, string[]> = {
  stand: ['...pP..pP.', '...pP..pP.', '..bbB.bbB.', '..bbb.bbb.'],
  lunge: ['..pP....pP', '.pP.....pP', 'bbB....bbB', 'bbb....bbb'],
};
// bows: [rows, grip x, grip y]
const BOW: Record<string, [string[], number, number]> = {
  rest: [['..w..', '.ws..', '.w.s.', 'w..s.', 'w..s.', 'w..s.', 'w..s.', 'w..s.', 'w..s.', 'w..s.', '.w.s.', '.ws..', '..w..'], 0, 6],
  drawn: [['..w....', '.w.s...', '.w..s..', 'w....s.', 'w.....s', 'w.....s', 'wiaaaff', 'w.....s', 'w.....s', 'w....s.', '.w..s..', '.w.s...', '..w....'], 0, 6],
};

/** The volley draw: a short bow tipped 45 degrees, the arrow pointing up-left, grip at (x, y). */
function bowHigh(x: number, y: number): Part[] {
  const P = (pts: [number, number][]) => pts.map(([dx, dy]) => [x + dx, y + dy] as [number, number]);
  return [
    dots([['s', P([[4, -2], [4, -1], [4, 0], [4, 1], [4, 2], [4, 3], [-2, 4], [-1, 4], [0, 4], [1, 4], [2, 4], [3, 4]])]], { late: true }),
    dots([
      ['o', P([[2, -1], [3, -2], [-1, 2], [-2, 3]])],
      ['w', P([[1, -1], [2, -2], [3, -3], [4, -3], [-1, 1], [-2, 2], [-3, 3], [-3, 4]])],
      ['I', P([[-2, -4], [-4, -2]])],
      ['i', P([[-3, -3]])],
      ['W', P([[-4, -4]])],
    ]),
    dots([['a', P([[3, 3], [2, 2], [1, 1], [-1, -1], [-2, -2]])], ['f', P([[3, 2], [2, 3]])]], { late: true }),
  ];
}

const HAND = ['gg', 'gg'];

function archerParts(pose: string): Part[] {
  const F = 24;
  let hx = 6;
  let hy = 2;
  let bx = 7;
  let by = 11;
  let bow: Part | null = null;
  let bowParts: Part[] = [];
  let gx = 4; // bow grip
  let gy = 15;
  let legs = ARCHER_LEGS.stand;
  let head = ARCHER_HEAD;
  let draw: [number, number] | null = null; // the drawing hand, when it is on the string
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      hy = 3;
      by = 12;
      gy = 16;
      break;
    case 'windup':
      hx = 7;
      bx = 8;
      bow = [BOW.drawn[0], 3 - BOW.drawn[1], 11 - BOW.drawn[2]];
      gx = 3;
      gy = 11;
      draw = [9, 11];
      break;
    case 'attack':
      // the string snaps straight, the arrow streaks away, the hand flies back
      hx = 5;
      bx = 6;
      gx = 3;
      gy = 11;
      legs = ARCHER_LEGS.lunge;
      extra.push([['iiaaaff'], 0, 10], limb(15, 14, 18, 12, 'v'), [HAND, 18, 11]);
      break;
    case 'hurt':
      hx = 8;
      hy = 3;
      bx = 8;
      by = 12;
      gx = 5;
      gy = 17;
      head = ARCHER_HEAD.map((r) => r.replace('Ek', 'kk').replace('FF', 'gF'));
      break;
    case 'tell':
      // the bow drawn and aimed high for a volley, leaning back, the arrowhead glinting
      hx = 10;
      hy = 3;
      bx = 9;
      by = 12;
      gx = 5;
      gy = 11;
      bowParts = bowHigh(gx, gy);
      draw = [8, 15];
      head = ARCHER_HEAD.map((r) => r.replace('Ek', 'EW'));
      break;
  }
  if (!bowParts.length) bowParts = [bow ?? [BOW.rest[0], gx - BOW.rest[1], gy - BOW.rest[2]]];
  const parts: Part[] = [
    [legs, bx + 1, F - legs.length + 1],
    [ARCHER_BODY, bx, by],
    [head, hx, hy],
  ];
  if (draw) parts.push(limb(bx + 5, by + 3, draw[0] + 1, draw[1], 'v', { edge: CLOTH[1] }));
  parts.push(...bowParts);
  if (draw) parts.push([HAND, draw[0], draw[1]]);
  parts.push(limb(bx + 3, by + 3, gx + 1, gy, 'v', { edge: CLOTH[1] }), [HAND, gx, gy]);
  return [...parts, ...extra];
}

// ------------------------------------------------------------------ shaman (mushroom folk with a crooked staff)

// magenta cap, hue-shifted: shadows lean violet, highlights lean pink
const CAP = ['#2a0c30', '#501650', '#7e1e68', '#ac2c7c', '#d85a92', '#ff9cb4'];
// deep teal robe (the cap's complement)
const ROBE = ['#0e1a26', '#16343a', '#1e5050', '#2c7064', '#4c967a', '#80bc94'];
const STEM = ['#4a3440', '#7a6070', '#a89098', '#d4c4bc', '#f4ece0'];
const SHAMAN_PAL: Pal = {
  0: CAP[0], 1: CAP[1], 2: CAP[2], 3: CAP[3], 4: CAP[4], 5: CAP[5],
  O: '#fff4e4', o: '#e0b8c8', // cap spots, lit and shaded
  g: '#3e1438', G: '#6e3454', // gills under the cap
  f: '#2e1a30', F: '#46304a', // face in the cap's shadow
  E: '#eaff8a', e: '#8ad040', // glowing eyes
  N: STEM[3], n: STEM[2], // nose
  w: '#e8f0d8', W: '#a4b894', // lichen beard
  h: STEM[3], H: STEM[1], // hands
  s: WOOD[3], S: WOOD[1], // staff
  d: '#4e2c16', D: '#8e5a2e', y: '#f2c230', // rope belt, bead
  b: '#2a1810', B: '#4a3024', // feet
  L: '#f4ffc8', l: '#b4f05a', j: '#5aa83a', // spore glow
};
const SHAMAN_SHADES: Record<string, Shade> = {
  r: { ramp: ROBE, same: 'dDy', top: [4], left: [4], right: [1, 2], bottom: [1], mid: 3 },
  v: { ramp: ROBE, top: [4], left: [4], right: [2], bottom: [2], mid: 3 }, // sleeve
};
// 20 wide, hand-shaded dome (0-5 = CAP ramp) with big pale spots, gills underneath
const SHAMAN_CAP = [
  '.......455443.......',
  '....445554OO4332....',
  '..344OO544OO433322..',
  '.344OOO44433333oo21.',
  '33444O333333333oo221',
  '3OO33333OO3333222221',
  '23O33333oo332oo22111',
  '.122222222222111110.',
  '..gGgGgGgGgGgGgGgg..',
];
// face in the cap's shadow: glowing eyes, a bulb nose catching the light, a wispy lichen beard
const SHAMAN_FACE = [
  '..fffffffF',
  '.fEffEffFF',
  'NNefefffF.',
  'Nnnfwfff..',
  '.wwwwwff..',
  '..wWwwW...',
  '..wwWw....',
  '...wW.....',
  '....w.....',
];
const SHAMAN_ROBE = [
  '...rrrrrr...',
  '..rrrrrrrr..',
  '..rrrrrrrrr.',
  '.rrrrrrrrrr.',
  '.rdDdyddddr.',
  '.rrrrrrrrrrr',
  'rrrrrrrrrrrr',
  'rrrrrrrrrrrr',
  'rrrrrrrrrrrr',
];
const SHAMAN_FEET = ['bB...bB'];
const SPORE = ['.lL', 'lLl', '.l.'];
const SPORE_SM = ['lL', 'jl'];

/** A 1px line from (x0, y0) to (x1, y1) in frame coordinates. */
function line(x0: number, y0: number, x1: number, y1: number, ch: string, opts?: PartOpts): Part {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1))]);
  return dots([[ch, pts]], opts);
}

/** The crooked staff from its foot (x0, y0) to the top of its shaft (x1, y1); a glowing bulb hangs off the hook. */
function staff(x0: number, y0: number, x1: number, y1: number): Part[] {
  const P = (pts: [number, number][]) => pts.map(([dx, dy]) => [x1 + dx, y1 + dy] as [number, number]);
  return [
    line(x0, y0, x1, y1, 's'),
    dots([
      ['s', P([[0, -1], [-1, -2], [-2, -2], [-3, -1]])],
      ['S', P([[0, 2], [-3, 0]])],
      ['l', P([[-4, 1], [-3, 2], [-4, 2]])],
      ['L', P([[-3, 1]])],
    ]),
  ];
}

function shamanParts(pose: string): Part[] {
  const F = 26;
  let x = 0; // upper body offset
  let y = 0;
  let face = SHAMAN_FACE;
  let cap = SHAMAN_CAP;
  let st: [number, number, number, number] = [6, 26, 6, 10]; // staff foot and top
  let hand: [number, number] = [5, 18];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      y = 1;
      hand = [5, 19];
      break;
    case 'windup':
      // rears back, the staff lifted off the ground
      x = 1;
      y = 1;
      st = [7, 23, 7, 7];
      hand = [6, 15];
      break;
    case 'attack':
      // thrusts the staff at the hero, a burst of spores off the bulb
      x = -1;
      st = [9, 22, 3, 12];
      hand = [5, 16];
      extra.push([SPORE, 0, 13], [SPORE_SM, 2, 17]);
      break;
    case 'hurt':
      x = 2;
      y = 1;
      st = [8, 26, 7, 11];
      hand = [6, 18];
      // knocked back, the cap jolted crooked, eyes squeezed to dim slits
      face = swap(SHAMAN_FACE, [['E', 'n'], ['e', 'f']]);
      cap = leanBack(SHAMAN_CAP, 3, 2);
      break;
    case 'tell':
      // the staff thrust up high, spores swirling off the glowing bulb
      st = [7, 20, 6, 4];
      hand = [5, 11];
      face = swap(SHAMAN_FACE, [['E', 'L'], ['e', 'l']]);
      extra.push([SPORE, 0, 0], [SPORE_SM, 9, 1], [SPORE_SM, 1, 8]);
      break;
  }
  return [
    [SHAMAN_FEET, 12, F],
    [SHAMAN_ROBE.slice(y), 11 + x, 17 + y],
    [face, 10 + x, 14 + y],
    [cap, 5 + x, 5 + y],
    ...staff(...st),
    limb(12 + x, 18 + y, hand[0] + 2, hand[1], 'v'),
    [['hh', 'hH'], hand[0], hand[1]],
    ...extra,
  ];
}

// ------------------------------------------------------------------ build

interface SpriteDef {
  W: number;
  H: number;
  pal: Pal;
  shades: Record<string, Shade>;
  parts: (pose: string) => Part[];
  extras?: string[];
}

export function buildFoeArt(add: Add): void {
  const defs: Record<string, SpriteDef> = {
    crow: { W: 26, H: 20, pal: CROW_PAL, shades: CROW_SHADES, parts: crowParts },
    wolf: { W: 32, H: 20, pal: WOLF_PAL, shades: WOLF_SHADES, parts: wolfParts },
    beetle: { W: 32, H: 20, pal: BEETLE_PAL, shades: BEETLE_SHADES, parts: beetleParts, extras: ['shell'] },
    archer: { W: 26, H: 26, pal: ARCHER_PAL, shades: ARCHER_SHADES, parts: archerParts },
    piglet: { W: 18, H: 13, pal: PIG_PAL, shades: PIG_SHADES, parts: pigParts },
    shaman: { W: 28, H: 28, pal: SHAMAN_PAL, shades: SHAMAN_SHADES, parts: shamanParts },
  };
  for (const name of FOE_SPRITES) {
    const d = defs[name];
    if (!d) {
      if (name === 'slimelet') {
        const rx = 8;
        const ry = 10;
        add('slimelet_idle0', slimeFrame(rx, ry, { squash: 0, lean: 0, face: 'idle' }));
        add('slimelet_idle1', slimeFrame(rx, ry, { squash: 0.4, lean: 0, face: 'idle' }));
        add('slimelet_windup', slimeFrame(rx, ry, { squash: -0.55, lean: 0.35, face: 'angry' }));
        add('slimelet_attack', slimeFrame(rx, ry, { squash: 0.25, lean: -1, face: 'attack' }));
        add('slimelet_hurt', slimeFrame(rx, ry, { squash: 0.8, lean: 0.4, face: 'hurt' }));
        add('slimelet_flash', slimeFrame(rx, ry, { squash: 0.8, lean: 0.4, face: 'hurt', flash: true }));
        add('slimelet_tell', slimeFrame(rx, ry, { squash: 1, lean: 0, face: 'angry' }));
        continue;
      }
      for (const pose of FOE_POSES) add(`${name}_${pose}`, render(7, 6, {}, {}, [[['#####', '#####', '#####', '#####'], 1, 1, { pal: { '#': pose === 'flash' ? '#ffffff' : '#7a6a9a' } }]]));
      continue;
    }
    for (const pose of [...FOE_POSES, ...(d.extras ?? [])]) {
      const p = pose === 'flash' ? 'hurt' : pose;
      add(`${name}_${pose}`, render(d.W, d.H, d.pal, d.shades, d.parts(p), pose === 'flash'));
    }
  }
}
