// Greenmarch enemies (see docs/art-style.md): character maps with an automatic ink outline, facing left.
// Every sprite has the frames the fighters view uses: idle0, idle1, windup, attack, hurt, flash, tell
// (the special's telegraph wind-up), plus a few extras (knight_guard, beetle_shell).
import { grid, overlay, slimeFrame, stampShaded, toCanvas, type Pal, type Shade } from './art';

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

// ------------------------------------------------------------------ knight (Hedge Knight: armor overgrown with leaves)

// tarnished steel, hue-shifted: shadows lean teal, highlights lean warm
const ARMOR = ['#161c26', '#2a3440', '#465462', '#6e7e8a', '#a4b2b4', '#e2ead8'];
const LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];
const KNIGHT_PAL: Pal = {
  k: '#140c1c', E: '#d8ff6a', e: '#6ab83a', // visor slit, glowing eyes
  K: ARMOR[1], // breathing holes
  d: '#3a2416', D: '#6e4426', // belt
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', // gold rim, buckle
  L: LEAF[5], l: LEAF[4], // leaf emblem
  A: '#eef3fa', C: '#7c86a6', T: '#ffffff', // sword blade: lit edge, shaded edge, tip
  h: '#4e2c16', // grip
  0: LEAF[0], 1: LEAF[1], 2: LEAF[2], 3: LEAF[3], 4: LEAF[4], 5: LEAF[5],
};
const KNIGHT_SHADES: Record<string, Shade> = {
  a: { ramp: ARMOR, same: 'kEeKdDgy', top: [5, 4], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  f: { ramp: LEAF, top: [5, 4], left: [4], right: [2], bottom: [1, 2], mid: 3 },
  q: { ramp: ['#0c1a16', '#14301e', '#1e4628', '#2c5e30', '#3e7634', '#5a9038'], same: 'Ll', top: [4], left: [4], right: [1, 2], bottom: [1, 2], mid: 3 },
  v: { ramp: ARMOR, top: [4], left: [4], right: [2], bottom: [1], mid: 3 }, // arm
};
// great helm, 11 wide, visor slit at the front with a green glow behind it
const KNIGHT_HELM = [
  '...aaaaaa..',
  '..aaaaaaaa.',
  '.aaaaaaaaaa',
  '.aaaaaaaaaa',
  'kkEkkkaaaaa',
  'aaaaaaaaaaa',
  '.aKaKaaaaaa',
  '.aaaaaaaaa.',
  '..aaaaaaa..',
];
// a crest of hedge leaves sprouting from the helm and sweeping back (0-5 = LEAF ramp)
const KNIGHT_CREST = [
  '.......45.45..',
  '...45.454454..',
  '..45444443343.',
  '.4544334432332',
  '..43322332221.',
  '...221..121...',
];
// body: broad shoulders, belt, tassets; the leaves are laid over it as separate clumps
const KNIGHT_BODY = [
  '...aaaaaaaa...',
  '..aaaaaaaaaaa.',
  '.aaaaaaaaaaaaa',
  '.aaaaaaaaaaaaa',
  '.aaaaaaaaaaaaa',
  '..aaaaaaaaaaa.',
  '..aaaaaaaaaaa.',
  '..ddddDgDdddd.',
  '.aaaaaaaaaaaaa',
  '.aaaaaaaaaaaa.',
  '..aaaa..aaaa..',
];
// hedge clumps growing over the armor (0-5 = LEAF ramp)
const HEDGE: Record<string, string[]> = {
  big: ['..45.4..', '.454443.', '45443332', '.4332321', '..21.1..'],
  mid: ['.45.', '4543', '3332', '.21.'],
  small: ['45', '32'],
  vine: ['4....', '.3...', '..32.', '....2'],
};
const KNIGHT_LEGS: Record<string, string[]> = {
  stand: [
    '..aaa..aaa.',
    '..aaa..aaa.',
    '..aaa..aaa.',
    '..aaa..aaa.',
    '..aaa..aaa.',
    '..aaa..aaa.',
    '.aaaa.aaaa.',
    'aaaaa.aaaa.',
  ],
  lunge: [
    '.aaa....aaa',
    '.aaa....aaa',
    'aaa......aaa',
    'aaa......aaa',
    'aaa.......aaa',
    'aaa.......aaa',
    'aaaa......aaaa',
    'aaaa......aaaa',
  ],
  brace: [
    '.aaa...aaa.',
    'aaa.....aaa',
    'aaa.....aaa',
    'aaa......aaa',
    'aaa......aaa',
    'aaaa.....aaaa',
    'aaaa.....aaaa',
    '..............',
  ],
};
// kite shield, front on: gold rim, hedge-green face, a big pale leaf
const KITE = [
  'GGGGGGGGGGy',
  'GqqqqqqqqqY',
  'GqqqqLqqqqY',
  'GqqqLLLqqqY',
  'GqqLLlLLqqY',
  'GqqLLlLLqqY',
  'GqqLLlLLqqY',
  '.GqqLlLqqY.',
  '.GqqqlqqqY.',
  '.GqqqlqqqY.',
  '..GqqqqqY..',
  '..GqqqqqY..',
  '...GqqqY...',
  '...GqqqY...',
  '....GqY....',
  '.....Y.....',
];

/** A straight sword: hand at (hx, hy), blade toward (dx, dy) (8-way), `len` px long. */
function knightSword(hx: number, hy: number, dx: number, dy: number, len: number): Part {
  const A: [number, number][] = [];
  const C: [number, number][] = [];
  const g: [number, number][] = [];
  const diag = dx !== 0 && dy !== 0;
  for (let i = 2; i < len + 2; i++) {
    const x = hx + dx * i;
    const y = hy + dy * i;
    A.push([x, y]);
    // second px: below a horizontal blade, right of a vertical one, beside a diagonal one
    if (i < len + 1) C.push(diag ? [x + (dx < 0 ? 1 : -1), y] : dy === 0 ? [x, y + 1] : [x + 1, y]);
  }
  const px = -dy;
  const py = dx;
  for (let k = -2; k <= 2; k++) g.push([hx + dx + px * k, hy + dy + py * k]);
  return dots([
    ['C', C],
    ['A', A],
    ['g', g],
    ['T', [A[A.length - 1]]],
    ['h', [[hx, hy], [hx - dx, hy - dy]]],
    ['y', [[hx - dx * 2, hy - dy * 2]]],
  ]);
}

function knightParts(pose: string): Part[] {
  const F = 32;
  let x = 0;
  let y = 0;
  let legs = KNIGHT_LEGS.stand;
  let lx = 10;
  let helm = KNIGHT_HELM;
  let sh: [number, number] = [3, 13]; // shield top-left
  let hand: [number, number] = [22, 19]; // sword hand
  let sw: [number, number, number] = [0, -1, 12]; // sword direction and length
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      y = 1;
      sh = [3, 14];
      hand = [22, 20];
      break;
    case 'windup':
      x = 1;
      y = 1;
      sh = [4, 15];
      hand = [21, 11];
      sw = [1, -1, 10];
      break;
    case 'attack':
      x = -2;
      y = 1;
      legs = KNIGHT_LEGS.lunge;
      lx = 8;
      sh = [5, 16];
      hand = [10, 15];
      sw = [-1, 0, 13];
      break;
    case 'hurt':
      x = 2;
      helm = swap(KNIGHT_HELM, [['E', 'k']]);
      sh = [5, 14];
      hand = [23, 20];
      sw = [1, -1, 10];
      break;
    case 'tell':
      // the shield heaved up high
      sh = [3, 1];
      helm = swap(KNIGHT_HELM, [['E', 'e']]);
      break;
    case 'guard':
      // braced behind the shield, squared up in front
      x = 1;
      y = 2;
      legs = KNIGHT_LEGS.brace;
      lx = 9;
      sh = [6, 11];
      hand = [22, 21];
      sw = [0, 1, 8];
      helm = swap(KNIGHT_HELM, [['E', 'e']]);
      break;
  }
  const by = 12 + y;
  const ly = F - legs.length + 1;
  const leafy = { edge: LEAF[0] };
  return [
    [legs, lx, ly],
    [HEDGE.small, lx + 7, ly + 2, leafy],
    [KNIGHT_BODY, 8 + x, by],
    [HEDGE.big, 15 + x, by, leafy],
    [HEDGE.vine, 14 + x, by + 4, leafy],
    [HEDGE.small, 19 + x, by + 8, leafy],
    [helm, 10 + x, 4 + y],
    [KNIGHT_CREST, 11 + x, 0 + y, leafy],
    [HEDGE.small, 19 + x, 9 + y, leafy],
    knightSword(hand[0], hand[1], ...sw),
    limb(19 + x, by + 3, hand[0] - 1, hand[1] - 1, 'v'),
    [['aa', 'aa'], hand[0] - 1, hand[1] - 1],
    [KITE, sh[0], sh[1]],
    ...extra,
  ];
}

// ------------------------------------------------------------------ captain (Bandit Captain: tricorn, eyepatch, bombs)

// the bandit's purple, plus a darker hat
const CPURPLE = ['#1e1430', '#36244e', '#523a72', '#7a5a9a', '#a888c8'];
const CAPTAIN_PAL: Pal = {
  // hat (explicit tones) and gold trim
  b: CPURPLE[4], B: CPURPLE[3], n: CPURPLE[2], N: CPURPLE[1],
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14',
  // plume
  W: '#ffffff', w: '#ece6f8', v: '#a898c8',
  // face: skin, nose, eye, patch and strap, moustache, mouth, gold tooth
  S: '#f2b888', s: '#d88a5a', z: '#a0583a', k: '#140c1c', p: '#1c1430', P: '#4e3e62',
  m: '#2a1810', M: '#5a3420', r: '#4a1020', t: '#fff4e0',
  // scarf and sash
  R: '#8a1a22', q: '#d03030', Q: '#f05a48',
  // boots and trousers
  d: '#2a1810', D: '#4a2c18', T: '#262438', u: '#3c3a56',
  // bomb: body, cap, fuse, sparks
  a: '#2e2a44', A: '#4a4668', e: '#8a88b0', o: '#1a1628', f: '#c8a878', F: '#ffd84a', x: '#ff8a3a',
};
const CAPTAIN_SHADES: Record<string, Shade> = {
  c: { ramp: CPURPLE, same: 'gGyYRqQ', top: [4, 3], left: [3], right: [1, 1], bottom: [0, 1], mid: 2 },
  h: { ramp: CPURPLE, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // sleeve
};
// tricorn, 21 wide: crown dome, the brim turned up into points front and back, gold trim on its edge
const TRICORN = [
  '.......bbbbbb........',
  '.....bbBBBBBBnn......',
  'G...bBBBBBBBBBnn....G',
  'gG..bBBBBBBBBBBnn..gy',
  '.gG.BBBBBBBBBBBnnngyY',
  '..gGGgggggggggggggyY.',
  '...BBBBBBBBBBnnnnnn..',
  '....NNNNNNNNNNNNNN...',
];
// a big white plume sweeping back from the band, its barbs ragged underneath
const PLUME = [
  '..........WWW.',
  '.......WWWwwwW',
  '.....WWwwwwvvw',
  '...WWwwwvvv.v.',
  '..Wwwvv.v.....',
  '.Wwv..........',
  'Wv............',
];
// face, 3/4 to the left: a sly eye, a patch over the other with its strap, handlebar moustache, gold tooth
const CAPTAIN_FACE = [
  '..mSSSSSSmm',
  '.SSSSSSSSsm',
  '.SkSSSpppPm',
  'SSSSSSpPpsm',
  'zsSSSSSSssm',
  '.mmmSSmmmsm',
  '.m.mrtgrs..',
  '....sSSs...',
];
// a gold epaulette on the far shoulder
const EPAULET = ['.GGgy.', 'GgggyY', 'y.y.Y.'];
// long coat: red scarf, gold-trimmed lapels over a pale shirt, red sash, tails parted over the legs
const CAPTAIN_COAT = [
  '....qQqqR.......',
  '..cRqqqRRRcc....',
  '.ccgRqRRgccccc..',
  'cccgtqRtgcccccc.',
  'cccgtttgcccccccc',
  'ccccgtgccccccccc',
  'cccccgcccccccccc',
  'ccqqQqqqqqqRRccc',
  'ccRRRRRRRRRRRqcc',
  'cccgc.ccccccqRcc',
  'ccgc...cccccqRcc',
  'ccgc...ccccccRRc',
  'cgc.....cccccccc',
  'cgc.....ccccccc.',
];
const CAPTAIN_LEGS: Record<string, string[]> = {
  stand: [
    '....TTu..TTu....',
    '....TTu..TTu....',
    '....TTu..TTu....',
    '....TTu..TTu....',
    '...DDDDd.DDDDd..',
    '...DDDd..DDDd...',
    '...dddd..dddd...',
    '..ddddd.ddddd...',
  ],
  lunge: [
    '...TTu.....TTu..',
    '...TTu.....TTu..',
    '..TTu.......TTu.',
    '..TTu.......TTu.',
    '.DDDDd.....DDDDd',
    '.DDDd.......DDDd',
    '.dddd.......dddd',
    'ddddd.......dddd',
  ],
};
// round bomb with a capped fuse
const BOMB = ['...ff', '..AA.', '.aAAa.', 'aeWaaa', 'aeAaao', 'aAaaao', 'aaaaoo', '.aooo.'];
const SPARK = ['x.F', '.W.', 'F.x'];

function captainParts(pose: string): Part[] {
  const F = 36;
  let x = 0;
  let y = 0;
  let legs = CAPTAIN_LEGS.stand;
  let lx = 9;
  let face = CAPTAIN_FACE;
  let hat = TRICORN;
  let hand: [number, number] = [6, 22]; // bomb hand
  let bomb: [number, number] | null = [2, 15]; // bomb top-left
  let lit = false;
  let back = false; // throwing with the far arm, from behind the body
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      y = 1;
      hand = [6, 23];
      bomb = [2, 16];
      break;
    case 'windup':
      // the bomb cocked back over the shoulder
      x = 1;
      y = 1;
      hand = [27, 13];
      bomb = [26, 6];
      lit = true;
      back = true;
      break;
    case 'attack':
      // the throw: arm flung forward, the bomb away
      x = -1;
      legs = CAPTAIN_LEGS.lunge;
      lx = 8;
      hand = [5, 17];
      bomb = [0, 8];
      lit = true;
      break;
    case 'hurt':
      x = 2;
      face = swap(CAPTAIN_FACE, [['k', 'z']]);
      hat = leanBack(TRICORN, 4, 2);
      hand = [8, 24];
      bomb = [4, 17];
      break;
    case 'tell':
      // the lit bomb hoisted high, fuse spitting sparks
      hand = [6, 10];
      bomb = [2, 3];
      lit = true;
      face = swap(CAPTAIN_FACE, [['mrtgrs', 'mrttgr']]);
      break;
  }
  const arm: Part[] = [];
  if (bomb) {
    arm.push([BOMB, bomb[0], bomb[1]]);
    if (lit) arm.push([SPARK, bomb[0] + 3, bomb[1] - 2]);
  }
  if (back) arm.unshift(limb(22 + x, 19 + y, hand[0], hand[1] + 1, 'h'));
  else arm.push(limb(12 + x, 19 + y, hand[0] + 1, hand[1], 'h', { edge: CPURPLE[0] }));
  arm.push([['SS', 'ss'], hand[0], hand[1]]);
  return [
    ...(back ? arm : []),
    [legs, lx, F - legs.length + 1],
    [CAPTAIN_COAT, 9 + x, 16 + y],
    [EPAULET, 18 + x, 16 + y],
    [face, 10 + x, 9 + y],
    [PLUME, 20 + x, 0 + y],
    [hat, 6 + x, 3 + y],
    ...(back ? [] : arm),
    ...extra,
  ];
}

// ------------------------------------------------------------------ golem (Ruin Golem: mossy stone blocks, teal runes)

// weathered stone, hue-shifted: shadows lean blue-violet, highlights lean warm beige (as the portrait)
const STONE = ['#1c1c2c', '#34344a', '#545264', '#78747c', '#a09a96', '#c8c0b2'];
const MOSS = ['#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850'];
const RUNE = ['#14524e', '#22a098', '#62e4d4', '#d8fff6'];
const GOLEM_PAL: Pal = {
  0: STONE[0], 1: STONE[1], 2: STONE[2], 3: STONE[3], 4: STONE[4], 5: STONE[5],
  A: MOSS[0], B: MOSS[1], C: MOSS[2], D: MOSS[3], E: MOSS[4],
  r: RUNE[0], t: RUNE[1], u: RUNE[2], U: RUNE[3],
  p: '#ff8ac0', P: '#c04a8a', y: '#ffe070', // a little flower in the moss
  w: '#e8e0d0', // dust
};

/** Cheap deterministic hash in [0, 1). */
function hash2(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A worn stone block in explicit tones (0-5 = STONE): a lit front face, a darker side face `side` px wide on
 * the right, lit top and left rims, dark bottom and right rims, chamfered corners, a few chips. `dark` blocks
 * (the far side of the body) sit a tone lower.
 */
function stoneBlock(w: number, h: number, side = 0, cut = 2, seed = 1, dark = false): string[] {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && x + y >= cut && w - 1 - x + y >= cut && w - 1 - x + (h - 1 - y) >= cut - 1 && x + (h - 1 - y) >= cut - 1;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) {
        r += '.';
        continue;
      }
      const sideFace = x >= w - side;
      let t = sideFace ? 2 : 3;
      if (!inside(x, y - 1)) t = sideFace ? 4 : 5;
      else if (!inside(x, y + 1)) t = sideFace ? 0 : 1;
      else if (!inside(x + 1, y)) t = 1;
      else if (!inside(x - 1, y)) t = 4;
      else if (side && x === w - side) t = 1;
      else if (!inside(x, y - 2) && !sideFace) t = 4;
      else {
        // chips: 2x1 clusters a tone up or down
        const c = hash2(Math.floor(x / 2) + seed * 31, y + seed * 17);
        if (c < 0.08) t += 1;
        else if (c > 0.92) t -= 1;
      }
      if (dark) t = Math.max(0, t - 1);
      r += String(t);
    }
    rows.push(r);
  }
  return rows;
}

/** Moss draped over the top of a block w wide: a lit cushion with drips hanging down. */
function mossTop(w: number, seed = 1, dark = false): string[] {
  const rows = [Array(w).fill('.'), Array(w).fill('.'), Array(w).fill('.'), Array(w).fill('.')];
  for (let x = 1; x < w - 1; x++) {
    const hgt = 1 + Math.floor(hash2(Math.floor(x / 2), seed) * 2.6);
    const lit = x < w * 0.7 && !dark;
    rows[0][x] = lit ? 'E' : 'D';
    for (let k = 1; k <= hgt && k < 4; k++) rows[k][x] = k === hgt ? 'B' : lit ? 'D' : 'C';
  }
  return rows.map((r) => r.join(''));
}

const crack = (pts: [number, number][], ox: number, oy: number): Part =>
  dots([
    ['4', pts.map(([x, y]) => [ox + x - 1, oy + y] as [number, number])],
    ['0', pts.map(([x, y]) => [ox + x, oy + y] as [number, number])],
  ]);

// the head: a heavy brow over two rune eyes, a carved mouth slot
function golemHead(eyes: 'lit' | 'dim' | 'blaze'): string[] {
  let h = stoneBlock(14, 12, 4, 2, 4);
  const E = eyes === 'dim' ? ['rrt', 'rrr'] : eyes === 'blaze' ? ['uUU', 'UUu'] : ['tuu', 'uUu'];
  h = overlay(h, ['5555555555', '0000000001'], 0, 4); // brow ledge and its shadow
  h = overlay(h, E, 1, 5);
  h = overlay(h, E.map((r) => r.slice(0, 2)), 6, 5);
  h = overlay(h, ['0000000', '1212121', '.22222.'], 1, 8); // mouth slot with stubby teeth
  return h;
}
// a squared nose jutting off the front of the face
const GOLEM_NOSE = ['54', '543', '4321', '.11.'];
// the old king's crown, carved in the chest and still glowing
const CHEST_RUNE = ['t...t...t', 'ut.tut.tu', 'uuuuUuuuu', 'ttttttttt', 'r.r.r.r.r'];
// finger grooves on a fist's front face
const KNUCKLES = ['1.1.1.', '2.2.2.', '......'];

type Blk = [w: number, h: number, side: number, cut: number, seed: number, dark?: boolean];
const GOLEM_BLOCKS: Record<string, Blk> = {
  farFist: [11, 9, 4, 2, 20, true],
  farFore: [9, 10, 3, 1, 21, true],
  farUpper: [8, 8, 3, 1, 22, true],
  farShoulder: [13, 10, 4, 3, 23, true],
  farLeg: [8, 10, 3, 1, 24, true],
  farFoot: [11, 4, 3, 1, 25, true],
  hips: [18, 7, 5, 1, 26],
  chest: [21, 19, 6, 3, 27],
  nearLeg: [9, 10, 3, 1, 28],
  nearFoot: [12, 4, 3, 1, 29],
  nearShoulder: [13, 10, 4, 3, 30],
  nearUpper: [8, 8, 3, 1, 31],
  nearFore: [10, 10, 3, 1, 32],
  nearFist: [12, 9, 4, 2, 33],
};
type GolemPose = Record<string, [number, number]>;
const GOLEM_IDLE: GolemPose = {
  farShoulder: [29, 13], farUpper: [32, 21], farFore: [32, 27], farFist: [31, 35],
  farLeg: [25, 37], farFoot: [24, 45],
  hips: [14, 31], chest: [12, 14],
  nearLeg: [15, 37], nearFoot: [13, 45],
  head: [10, 3],
  nearShoulder: [5, 13], nearUpper: [6, 21], nearFore: [4, 27], nearFist: [3, 35],
};
const UPPER = ['farShoulder', 'farUpper', 'farFore', 'farFist', 'hips', 'chest', 'head', 'nearShoulder', 'nearUpper', 'nearFore', 'nearFist'];

/** Move the named blocks of a pose by (dx, dy). */
function shiftPose(p: GolemPose, names: string[], dx: number, dy: number): GolemPose {
  const out = { ...p };
  for (const n of names) out[n] = [p[n][0] + dx, p[n][1] + dy];
  return out;
}

function golemParts(pose: string): Part[] {
  let P = GOLEM_IDLE;
  let eyes: 'lit' | 'dim' | 'blaze' = 'lit';
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      P = shiftPose(P, UPPER, 0, 1);
      break;
    case 'windup':
      // rears back, the near fist hauled up beside the head
      P = shiftPose(P, UPPER, 2, 1);
      P = { ...P, nearUpper: [15, 17], nearFore: [20, 10], nearFist: [24, 2] };
      break;
    case 'attack':
      // a straight punch, the whole weight behind it
      P = shiftPose(P, UPPER, -2, 2);
      P = { ...P, nearUpper: [5, 22], nearFore: [1, 23], nearFist: [1, 21] };
      eyes = 'blaze';
      break;
    case 'hurt':
      P = shiftPose(P, UPPER, 3, 0);
      eyes = 'dim';
      extra.push([['.45', '432', '21.'], 2, 6], [['43', '21'], 0, 12]);
      break;
    case 'tell':
      // the near foot hauled up high for a stomp, arms flung wide for balance
      P = shiftPose(P, UPPER, 2, -1);
      P = {
        ...P,
        nearLeg: [9, 27], nearFoot: [7, 35],
        nearUpper: [3, 18], nearFore: [1, 11], nearFist: [1, 3],
        farUpper: [35, 19], farFore: [36, 23], farFist: [34, 29],
      };
      eyes = 'blaze';
      break;
  }
  const seam = { edge: STONE[0] };
  const blk = (n: string): Part => {
    const [w, h, side, cut, seed, dark] = GOLEM_BLOCKS[n];
    return [stoneBlock(w, h, side, cut, seed, dark), P[n][0], P[n][1], seam];
  };
  const at = (n: string, dx: number, dy: number, rows: string[]): Part => [rows, P[n][0] + dx, P[n][1] + dy];
  const parts: Part[] = [
    blk('farFore'), blk('farUpper'), blk('farFist'),
    blk('farShoulder'), at('farShoulder', 1, 0, mossTop(12, 3, true)),
    blk('farLeg'), blk('farFoot'),
    blk('hips'),
    blk('chest'),
    at('chest', 5, 6, CHEST_RUNE),
    crack([[0, 0], [1, 1], [1, 2], [2, 3]], P.chest[0] + 16, P.chest[1] + 3),
    crack([[0, 0], [0, 1], [1, 2]], P.chest[0] + 4, P.chest[1] + 13),
  ];
  if (pose === 'tell') {
    // the thigh swung up level, the shin hanging, the foot well off the ground
    parts.push([stoneBlock(11, 8, 3, 1, 34), P.nearLeg[0] + 3, P.nearLeg[1] - 2, seam]);
  }
  parts.push(
    blk('nearLeg'), blk('nearFoot'),
    [golemHead(eyes), P.head[0], P.head[1], seam],
    at('head', -2, 6, GOLEM_NOSE),
    at('head', 1, 0, mossTop(12, 5)),
    at('head', 8, -3, ['.p.', 'pyp', '.P.']),
    blk('nearUpper'), blk('nearFore'),
    at('nearFore', 2, 3, ['tu', 'ut', 'tu']),
    blk('nearShoulder'), at('nearShoulder', 1, 0, mossTop(11, 6)),
    crack([[0, 0], [1, 1], [1, 2]], P.nearShoulder[0] + 6, P.nearShoulder[1] + 4),
    blk('nearFist'), at('nearFist', 2, 4, KNUCKLES),
  );
  return [...parts, ...extra];
}

// ------------------------------------------------------------------ boarking (Boar King: the final boss)

// dark fur, hue-shifted: shadows lean purple, highlights lean orange; the mane is near black
const KFUR = ['#1e0e18', '#3a1a22', '#5e3030', '#844a38', '#a86a48', '#c88e5e'];
const KMANE = ['#0e0812', '#1e1018', '#2e1622', '#46222e', '#66323a', '#8a4a48'];
const VELVET = ['#3a0c1c', '#6a1424', '#a02430', '#d03c3c', '#f06a5a'];
const IVORY = ['#6a5a4a', '#a8967a', '#d8c8a8', '#f4ead4', '#fffcf0'];
const BRASS = ['#6e4a14', '#b07c22', '#e0b040', '#f8dc70', '#fffad0'];
const KING_PAL: Pal = {
  0: KFUR[0], 1: KFUR[1], 2: KFUR[2], 3: KFUR[3], 4: KFUR[4], 5: KFUR[5],
  m: KMANE[0], n: KMANE[1], N: KMANE[2], o: KMANE[3], O: KMANE[4], Q: KMANE[5],
  v: VELVET[1], V: VELVET[2], R: VELVET[3], q: VELVET[0],
  i: IVORY[1], I: IVORY[2], j: IVORY[3], J: IVORY[4], z: IVORY[0],
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', Z: '#5a3410', r: '#e8443a', c: '#4aa0f0',
  B: BRASS[2], b: BRASS[1], W: BRASS[4], X: BRASS[3], k: '#2a140c', // brass bob in its bezel
  p: '#a85458', P: '#d88078', t: '#5a2430', // snout disc, nostril
  e: '#ff5a3a', E: '#ffd0a0', K: '#140c1c', // eye
  s: '#d89a9a', S: '#7a3a44', // scars
  h: '#2a1c24', H: '#5a4650', // hooves
  w: '#ffffff', u: '#c8d8e8', // steam
  d: '#b49a70', D: '#e8d4a8', // dust
  f: '#f4ece6', F: '#140c1c', // ermine
};

type Mask = (x: number, y: number) => boolean;
const ell = (cx: number, cy: number, rx: number, ry: number): Mask => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const anyOf = (...m: Mask[]): Mask => (x, y) => m.some((f) => f(x, y));
function poly(pts: [number, number][]): Mask {
  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

/** Tone digits (0-5) for a rounded form: lit from the top left around (cx, cy), dark rim underneath. */
function roundTones(w: number, h: number, m: Mask, cx: number, cy: number, rx: number, ry: number): string[] {
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

const KW = 56;
const KH = 44;
// the body (frame coordinates): high humped shoulders, the back sloping down to a round rump
const KING_BODY_MASK = anyOf(ell(35, 26, 19, 10), ell(27, 18, 13, 10), ell(46, 25, 8.5, 9), ell(21, 27, 8, 8));
// the head: a heavy wedge sloping down to the snout
const KING_HEAD_MASK = poly([[1, 21], [6, 17], [14, 11], [22, 10], [25, 12], [27, 16], [27, 25], [24, 31], [20, 33], [9, 34], [3, 32], [1, 29]]);
const KING_HEAD = roundTones(KW, KH, KING_HEAD_MASK, 9, 12, 18, 19);
// the body a tone darker than the head, with fur strokes raked down and back
const KING_BODY = roundTones(KW, KH, KING_BODY_MASK, 30, 13, 26, 19).map((r, y) =>
  [...r]
    .map((c, x) => {
      if (c === '.') return c;
      let t = Math.min(4, +c);
      if (t >= 2 && hash2(x - Math.floor(y / 2), 7) < 0.12 && hash2(Math.floor((x - y / 2) / 1), y >> 1) < 0.5) t -= 1;
      return String(t);
    })
    .join(''),
);

/** The bristly mane over the hump and down the spine: a dark mass with spikes leaning back, lit at the tips. */
function kingMane(bristle = 1, dy = 0): Part {
  const pts: Record<string, [number, number][]> = { m: [], n: [], N: [], o: [], O: [], Q: [] };
  for (let x = 15; x <= 49; x++) {
    let top = 0;
    while (top < KH && !KING_BODY_MASK(x, top)) top++;
    const base = x % 3 === 0 ? 7 : x % 3 === 1 ? 5 : 3;
    const fade = x < 20 ? 0.8 : x > 36 ? Math.max(0.3, (50 - x) / 14) : 1;
    const hgt = Math.max(1, Math.round(base * fade * bristle));
    const depth = Math.round(5 * fade);
    for (let k = -depth; k < hgt; k++) {
      const yy = top - k + dy;
      const xx = x + Math.floor(Math.max(0, k) / 2);
      const t = k < -2 ? 'm' : k < 0 ? 'n' : k >= hgt - 1 ? 'Q' : k >= hgt - 2 ? 'O' : k > 1 ? 'o' : 'N';
      pts[t].push([xx, yy]);
    }
  }
  return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][]);
}

/** The mane's ruff down the back of the head and neck, hiding the seam: spikes sweeping back. */
function kingRuff(ox: number, oy: number): Part {
  const pts: Record<string, [number, number][]> = { n: [], N: [], o: [], O: [], Q: [] };
  for (let y = 10; y <= 31; y++) {
    const bx = 22 + Math.round(4 * Math.sin(((y - 9) / 23) * Math.PI));
    const len = y % 3 === 0 ? 6 : y % 3 === 1 ? 4 : 3;
    for (let k = 0; k < len; k++) {
      const t = k < 2 ? 'n' : k >= len - 1 ? (y < 20 ? 'Q' : 'O') : k >= len - 2 ? 'O' : 'o';
      pts[k < 1 ? 'N' : t].push([ox + bx + k, oy + y - Math.floor(k / 2)]);
    }
  }
  return dots(Object.entries(pts).filter(([, p]) => p.length) as [string, [number, number][]][]);
}

/** A thick leg w x h with a hoof, lit on the left; `dark` for the far legs, `slant` px of lean over its height. */
function kingLeg(w: number, h: number, dark = false, slant = 0): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    const sh = Math.round((slant * y) / (h - 1));
    const pad = slant < 0 ? -slant : 0;
    let r = '.'.repeat(pad + sh);
    if (y >= h - 2) r += 'h' + 'hH'.padEnd(w - 1, 'h');
    else for (let x = 0; x < w; x++) r += String(Math.max(0, (x === 0 ? 4 : x === w - 1 ? 1 : x === w - 2 ? 2 : 3) - (dark ? 1 : 0)));
    rows.push(r);
  }
  return rows;
}

// crown: gold band with a point either side over a velvet cap; the brass pendulum bob hangs from the centre
// finial in a dark bezel (brass is yellower than the crown's gold)
const KING_CROWN = [
  'G......G......g',
  'Gg....gGy....gy',
  'Gg.....k.....gy',
  'GgV...kkk...Vgy',
  'GgVV.kXWBk.VVyY',
  'GgVVkXWBBbkVVyY',
  'GgVVkXBBBbkVVyY',
  'GgVVkBBBbbkVvyY',
  'GgVv.kbbbk.vvyY',
  'GgVvv.kkk.vvvyY',
  'GgggggggggggyyY',
  'yryyyycyyyyyrYZ',
  'YYYYYYYYYYYYYZZ',
];
// the near tusk curling up past the snout
const KING_TUSK = ['.J..', 'Jj..', 'Jj..', 'Jji.', 'Jji.', 'jjI.', 'jII.', '.IIz', '.IIiz', '..iiizz', '....zzz'];
const KING_EAR = ['.....o', '....oO', '...o32', '..oP23', '.oPp23', 'o2223.'];
const KING_EYE = ['KKKKK', '.KKeE', '..KKK'];
const KING_SNOUT = ['.pP', 'pPP', 'tPp', 'pPp', 'pPp', 'tPp', 'pPP', '.pp'];

function kingParts(pose: string): Part[] {
  let bx = 0; // body offset
  let by = 0;
  let hx = 0; // head offset (with crown and tusk)
  let hy = 0;
  let eye = KING_EYE;
  let bristle = 1;
  // legs: [x, slant] for far front, far back, near front, near back
  let legs: [number, number][] = [[21, 0], [38, 0], [13, 0], [45, 0]];
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      hy = 1;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      hx = 2;
      hy = 2;
      bristle = 1.2;
      extra.push([['.w', 'wu', 'u.'], 0, 20]);
      break;
    case 'attack':
      bx = -2;
      hx = -2;
      hy = 1;
      legs = [[23, -4], [36, 3], [14, -5], [46, 4]];
      break;
    case 'hurt':
      bx = 2;
      hx = 3;
      hy = -1;
      eye = ['KKKKK', '.KKKK', '.....'];
      break;
    case 'tell':
      // head down, hackles up, steam from the snout, a front hoof pawing up dust
      bx = 1;
      hx = 1;
      hy = 2;
      bristle = 1.35;
      legs = [[21, 0], [38, 0], [-99, 0], [45, 0]];
      extra.push([['.ww.', 'wwuw', '.uu.'], 0, 16], [['ww', 'u.'], 2, 20]);
      // the near front leg lifted and scraping back, kicking up dust
      extra.push([['333.', '33332', '.3332', '..321', '..hHh'], 16, 34, { edge: KFUR[0] }], [['..D.', '.DdD', 'dDdd'], 21, 39]);
      break;
  }
  const H = (rows: string[], x: number, y: number, o?: PartOpts): Part => [rows, x + hx, y + hy + 2, o];
  const legPart = ([x, sl]: [number, number], dark: boolean): Part[] => (x < -50 ? [] : [[kingLeg(5, 13, dark, sl), x + Math.min(0, sl), 30]]);
  const parts: Part[] = [
    ...legPart(legs[0], true),
    ...legPart(legs[1], true),
    ...legPart(legs[2], false),
    ...legPart(legs[3], false),
  ];
  parts.push(
    [['.mn', 'mnN', 'nN.'], 52 + bx, 21 + by], // tail tuft
    [KING_BODY, bx, by, { edge: KFUR[0] }],
    kingMane(bristle, by),
    // scars: claw marks raked across the flank
    [['..sS', '.sS.', 'sS..', 's...'], 40 + bx, 21 + by],
    [['..sS', '.sS.', 'sS..'], 44 + bx, 22 + by],
    H(KING_EAR, 19, 6),
    H(KING_HEAD, 0, 0, { edge: KFUR[0] }),
    kingRuff(hx, hy + 2),
    H(['5555544', '.000001', '......0'], 8, 17), // heavy brow and its shadow
    H(KING_SNOUT, 0, 21),
    H(eye, 9, 18),
    H(['.....s', '....sS', '...sS.', '..sS..'], 13, 23), // a scar across the cheek
    H(['.5554', '55443'], 3, 19), // lit ridge of the snout
    H(['0000000', '......00'], 6, 30), // the mouth line
    H(KING_TUSK, 3, 22),
    H(KING_CROWN, 9, 0),
    ...extra,
  );
  return parts;
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
    captain: { W: 34, H: 38, pal: CAPTAIN_PAL, shades: CAPTAIN_SHADES, parts: captainParts },
    boarking: { W: KW, H: KH, pal: KING_PAL, shades: {}, parts: kingParts },
    golem: { W: 46, H: 50, pal: GOLEM_PAL, shades: {}, parts: golemParts },
    knight: { W: 30, H: 34, pal: KNIGHT_PAL, shades: KNIGHT_SHADES, parts: knightParts, extras: ['guard'] },
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
