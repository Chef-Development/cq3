// Yara's spirits (see docs/content-bible.md section 3, Yara): called by green hits, made of soft cyan spirit-light
// with star specks. Textures like Moss's allies (art-hero-allies.ts): `ally_${kind}_0`, `ally_${kind}_1` (a two-frame
// idle) and `ally_${kind}_act` (what it does), ALLY_W x ALLY_H, facing right, the walkers' feet on ALLY_FEET; the Wisp
// Swarm hovers centred in the box. Forms are character maps lit from their own shape (light from the top left);
// toCanvas adds the ink outline.
//   spiritWolf      a lean wolf of spirit light: lunges in, jaws open (the bite)
//   spiritTortoise  a tortoise with a jade shell marked with a constellation: its shell flares, a ward arc before it
//   wispSwarm       three little star-wisps with tails: they flare and spread (filling the meter)
//   spiritStag      the Great Spirit (a Rally of hers calls it): a great stag of starlight with branching antlers,
//                   STAG_W x STAG_H, feet centred on the bottom row above the outline; it rears to strike
import { grid, put, stampShaded, toCanvas, type Grid, type Pal, type Shade } from './art';
import { ALLY_FEET, ALLY_H, ALLY_W } from './art-hero-allies';
import { ell, fill, or, sphere } from './art-paint';
import { sparkle } from './art-rig';

type Add = (key: string, c: HTMLCanvasElement) => void;

export const STAG_W = 46;
export const STAG_H = 44;

const SPIRIT = ['#14506e', '#2a8ab4', '#56c8e8', '#a4ecfa', '#e4fcff'];
const JADE = ['#0e4a44', '#1a7a68', '#2eae8c', '#6ad8b0', '#b8f4dc'];
const STAR = '#ffffff';
/** The Great Spirit glows brighter than the little spirits. */
const GLOW = ['#2a8ab4', '#4cb8e0', '#82daf2', '#bcf2fc', '#f0feff'];

const PAL: Pal = { k: '#0a2a44', E: '#ffffff', e: '#c4f8ff', x: STAR, W: '#ffffff', y: '#fff6b0', m: '#0e3a56' };
const SHADES: Record<string, Shade> = {
  b: { ramp: SPIRIT, same: 'xEe', top: [4, 3], left: [3], right: [1], bottom: [1, 2], mid: 2 }, // spirit body
  o: { ramp: JADE, same: 'x', top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 }, // the tortoise's shell
  r: { ramp: JADE, top: [3], left: [3], right: [1], bottom: [0], mid: 1 }, // its rim
};

/** Stamp a walker with its feet (the last `legs` rows) on ALLY_FEET, centred on the map's middle (+ dx), the body
 *  dropped `bob` px over the planted feet. */
function onFeet(g: Grid, rows: string[], o: { dx?: number; legs?: number; bob?: number } = {}): void {
  const w = Math.max(...rows.map((r) => r.length));
  const n = o.legs ?? 2;
  const x0 = ALLY_FEET[0] - Math.floor(w / 2) + (o.dx ?? 0);
  const yFeet = ALLY_FEET[1] - n + 1;
  const body = rows.slice(0, rows.length - n);
  stampShaded(g, rows.slice(rows.length - n), PAL, SHADES, x0, yFeet);
  stampShaded(g, body, PAL, SHADES, x0, yFeet - body.length + (o.bob ?? 0));
}

function frame(w: number, h: number, paint: (g: Grid) => void): HTMLCanvasElement {
  const g = grid(w, h);
  paint(g);
  return toCanvas(g);
}

/** A few drifting motes of spirit light round a spirit (`seed` places them), only on empty pixels. */
function motes(g: Grid, seed: number, cx: number, cy: number, r: number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const t = seed * 1.7 + i * 2.1;
    const x = Math.round(cx + Math.cos(t) * r);
    const y = Math.round(cy + Math.sin(t) * r * 0.6);
    if (g[y]?.[x] === null) put(g, x, y, i % 2 ? SPIRIT[3] : STAR);
  }
}

// ------------------------------------------------------------------ the wolf

const WOLF = [
  '.............b..b...',
  '............bb.bb...',
  '............bbbbb...',
  'bb.........bbbEbbbb.',
  'bbb........bbbbbbbbm',
  '.bbb.bbbbbbbbbbbb...',
  '..bbbbbbxbbbbbbbb...',
  '...bbbbbbbbbbxbbb...',
  '...bbbbbbbbbbbbb....',
  '...bbb.bb..bbb.bb...',
  '...bb..bb...bb..bb..',
  '..bb...bb..bb...bb..',
];
/** The bite: low and lunging, jaws open. */
const WOLF_ACT = [
  '..............b..b...',
  '.............bb.bb...',
  'b............bbbbb...',
  'bb..........bbbEbbbbb',
  'bbb.bbbbbbbbbbbbbW...',
  '.bbbbbbbxbbbbbbbbbbbW',
  '..bbbbbbbbbbbbxbbbb..',
  '...bbbbbbbbbbbbbbb...',
  '..bbbb......bbbbb....',
  '.bbb..........bbbb...',
  'bb.............bb.bb.',
];

// ------------------------------------------------------------------ the tortoise

const TORTOISE = [
  '.....ooooo.......',
  '...ooxooooox.....',
  '..oooooxooooo....',
  '.oxooooooooxo.bb.',
  '.oooxoooooxoobbbE',
  'ooooooooooooobbbb',
  'rrrrrrrrrrrrrrbm.',
  '..bb..bb..bb..bb.',
  '..bb..bb..bb..bb.',
];
/** Braced: head tucked in, the shell held high and blazing. */
const TORTOISE_ACT = [
  '.....ooooo.......',
  '...ooxooooox.....',
  '..oooooxooooo....',
  '.oxooooooooxo....',
  '.oooxoooooxoob...',
  'ooooooooooooobE..',
  'rrrrrrrrrrrrrrr..',
  '.bbb..bb..bb.bbb.',
];

/** The shell's constellation: a few star-white specks joined by faint lines. */
function constellation(g: Grid, x0: number, y0: number, bright: boolean): void {
  const pts: Array<[number, number]> = [
    [5, 1],
    [7, 2],
    [11, 1],
    [11, 3],
  ];
  for (const [x, y] of pts) put(g, x0 + x, y0 + y, bright ? STAR : JADE[4]);
  put(g, x0 + 6, y0 + 1, bright ? SPIRIT[4] : JADE[4]);
  put(g, x0 + 9, y0 + 1, JADE[4]);
}

/** A ward of spirit light standing before the braced shell: a bright crescent, two pixels thick. */
function ward(g: Grid, x: number, y: number): void {
  for (let k = -5; k <= 5; k++) {
    const dx = Math.round(Math.sqrt(Math.max(0, 25 - k * k)) * 0.7);
    put(g, x + dx, y + k, Math.abs(k) < 4 ? SPIRIT[4] : SPIRIT[3]);
    put(g, x + dx - 1, y + k, Math.abs(k) < 3 ? SPIRIT[3] : SPIRIT[2]);
  }
}

// ------------------------------------------------------------------ the wisps

/** One star-wisp: a round bright heart and a little flame-tail of light flickering down behind it. */
function wisp(g: Grid, x: number, y: number, flick: number, big: boolean): void {
  const tail: Array<[number, number, string]> = [
    [-1, 2, SPIRIT[3]],
    [-1 - flick, 3, SPIRIT[2]],
    [-2 - flick, 4, SPIRIT[2]],
    [-2, 5, SPIRIT[1]],
  ];
  for (const [dx, dy, c] of tail) put(g, x + dx, y + dy, c);
  if (big) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) put(g, x + dx, y + dy, SPIRIT[3]);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(g, x + dx, y + dy, SPIRIT[4]);
  put(g, x, y, STAR);
}

function wisps(g: Grid, ph: number, bright: boolean): void {
  const cx = ALLY_W / 2;
  const cy = ALLY_H / 2;
  const spread = bright ? 1.4 : 1;
  const pos: Array<[number, number]> = [
    [-6, -2 + ph],
    [3, -5 - ph],
    [2, 3 + ph],
  ];
  pos.forEach(([dx, dy], i) => wisp(g, Math.round(cx + dx * spread), Math.round(cy + dy * spread), (i + ph) % 2, bright || i === 1));
  if (bright) {
    sparkle(g, Math.round(cx + 8), Math.round(cy - 6), SPIRIT[3], STAR);
    sparkle(g, Math.round(cx - 8), Math.round(cy + 6), SPIRIT[3], STAR);
  }
}

// ------------------------------------------------------------------ the Great Spirit

/** The stag, painted as lit volumes of spirit light: a deep chest, a rounded haunch and shoulder, a neck rising to the
 *  head, four jointed legs (the hind ones bent back at the hock, dark hooves; `rear`: up on its hind legs, forelegs
 *  folded to strike), great branching antlers, a few stars on its flank, a starry mane and a tail tuft. */
export function stag(g: Grid, o: { rear?: boolean; bob?: number }): void {
  const b = o.bob ?? 0;
  const feet = STAG_H - 2;
  const rear = !!o.rear;
  // the body tilts up when it rears
  const tilt = rear ? -4 : 0;
  const bodyY = feet - 18 + b;
  const haunch = ell(13, bodyY + 1 + tilt * 0.1, 6, 6.5);
  const shoulder = ell(27, bodyY + 1 + tilt * 0.8, 5.5, 6.5);
  const body = or(ell(20, bodyY + tilt * 0.4, 11.5, 6), ell(28, bodyY - 1 + tilt, 7, 6), haunch, shoulder);
  // the neck rising to the head at the front
  const hx = 36;
  const hy = rear ? bodyY - 15 : bodyY - 12;
  const neck = (x: number, y: number) => {
    const t = (bodyY - 2 + tilt - y) / Math.max(1, bodyY - 2 + tilt - (hy + 3));
    if (t < 0 || t > 1) return false;
    const cx = 29 + (hx - 2 - 29) * t;
    return Math.abs(x + 0.5 - cx) <= 4.8 - t * 1.4;
  };
  const head = or(ell(hx, hy + 1, 4.8, 4), ell(hx + 4.6, hy + 2.8, 3.4, 2.4));
  // a leg: a thick upper part (3 px) to the joint, a slim lower part (2 px) to the hoof; lit on its left
  const leg = (pts: Array<[number, number]>, far: boolean) => {
    const R = far ? [SPIRIT[0], GLOW[0], GLOW[1]] : [SPIRIT[1], GLOW[1], GLOW[3]];
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s];
      const [x1, y1] = pts[s + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      const wide = s === 0;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n);
        const y = Math.round(y0 + ((y1 - y0) * i) / n);
        put(g, x, y, R[2]);
        put(g, x + 1, y, R[1]);
        if (wide) put(g, x + 2, y, R[0]);
      }
    }
    const [hx1, hy1] = pts[pts.length - 1];
    // the hoof
    put(g, hx1, hy1, '#0e3a56');
    put(g, hx1 + 1, hy1, '#0a2a44');
    put(g, hx1, hy1 - 1, far ? SPIRIT[0] : SPIRIT[1]);
  };
  // far legs first (behind the body)
  if (rear) {
    leg([[11, bodyY + 4], [8, feet - 6], [10, feet]], true);
    leg([[31, bodyY - 3], [39, bodyY - 7], [41, bodyY - 2]], true);
  } else {
    leg([[11, bodyY + 4], [9, feet - 6], [11, feet]], true);
    leg([[28, bodyY + 5], [29, feet - 6], [29, feet]], true);
  }
  fill(g, or(body, neck), sphere(GLOW, 12, bodyY - 8, 28, 16, 0.12));
  fill(g, head, sphere(GLOW, hx - 4, hy - 3, 10, 7, 0.22));
  // the belly's shade and a lit ridge along the back (the light from the top left)
  for (let x = 9; x <= 32; x++)
    for (let y = bodyY - 8; y <= bodyY + 8; y++) {
      if (!body(x, y) || neck(x, y)) continue;
      if (!body(x, y + 1) && g[y + 1]?.[x] === null) put(g, x, y, GLOW[0]);
      else if (!body(x, y - 1) && x < 26) put(g, x, y, GLOW[4]);
    }
  // near legs (in front)
  if (rear) {
    leg([[15, bodyY + 4], [13, feet - 6], [15, feet]], false);
    leg([[29, bodyY - 1], [37, bodyY - 3], [38, bodyY + 3]], false);
  } else {
    leg([[15, bodyY + 4], [12, feet - 6], [14, feet]], false);
    leg([[25, bodyY + 5], [25, feet - 6], [24, feet]], false);
  }
  // the eye, the nose
  put(g, hx + 1, hy, '#0a2a44');
  put(g, hx + 2, hy, '#ffffff');
  put(g, hx + 1, hy + 1, '#0a2a44');
  put(g, hx + 7, hy + 2, SPIRIT[0]);
  // the ear
  put(g, hx - 3, hy - 3, SPIRIT[3]);
  put(g, hx - 4, hy - 4, SPIRIT[4]);
  put(g, hx - 3, hy - 4, SPIRIT[2]);
  put(g, hx - 5, hy - 4, SPIRIT[3]);
  // great branching antlers of starlight: a 2 px beam sweeping back then up, three tines, a star at the crown
  const antler = (x: number, y: number, far: boolean) => {
    const c1 = far ? SPIRIT[2] : SPIRIT[4];
    const c0 = far ? SPIRIT[1] : SPIRIT[3];
    const main: Array<[number, number]> = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      main.push([Math.round(x - Math.sin(t * 2.2) * 4), Math.round(y - i)]);
    }
    main.forEach(([px, py], i) => {
      put(g, px, py, c1);
      if (i < 7) put(g, px + 1, py, c0);
    });
    for (const [at, len, side] of [
      [2, 4, 1],
      [5, 3, -1],
      [8, 3, 1],
    ] as Array<[number, number, number]>) {
      const [px, py] = main[at];
      for (let k = 1; k <= len; k++) put(g, px + side * k, py - Math.round(k * 0.8), k === len ? c1 : c0);
    }
    put(g, main[10][0], main[10][1], STAR);
  };
  antler(hx - 3, hy - 2, true);
  antler(hx, hy - 2, false);
  // a starry mane down the neck, three stars on the flank (a little constellation), the tail's tuft
  for (const [x, y] of [
    [hx - 5, hy + 5],
    [hx - 6, hy + 9],
  ])
    put(g, x, y, STAR);
  for (const [x, y] of [
    [16, bodyY - 2],
    [20, bodyY + 1],
    [24, bodyY - 3],
  ])
    put(g, x, Math.round(y + tilt * 0.3), STAR);
  put(g, 7, bodyY - 4 + tilt, SPIRIT[4]);
  put(g, 6, bodyY - 3 + tilt, SPIRIT[3]);
  put(g, 6, bodyY - 5 + tilt, STAR);
  put(g, 7, bodyY - 3 + tilt, SPIRIT[3]);
}

function stagFrame(o: { rear?: boolean; bob?: number }, seed: number): HTMLCanvasElement {
  const g = grid(STAG_W, STAG_H);
  stag(g, o);
  motes(g, seed, 22, 18, 18, 5);
  if (o.rear) {
    sparkle(g, 42, 6, SPIRIT[3], STAR, true);
    sparkle(g, 40, 18, SPIRIT[3], STAR);
  }
  return toCanvas(g);
}

export function buildSpiritArt(add: Add): void {
  add('ally_spiritWolf_0', frame(ALLY_W, ALLY_H, (g) => (onFeet(g, WOLF), motes(g, 1, 12, 9, 10))));
  add('ally_spiritWolf_1', frame(ALLY_W, ALLY_H, (g) => (onFeet(g, WOLF, { bob: 1 }), motes(g, 2, 12, 9, 10))));
  add('ally_spiritWolf_act', frame(ALLY_W, ALLY_H, (g) => (onFeet(g, WOLF_ACT, { dx: 2 }), sparkle(g, 22, 8, SPIRIT[3], STAR))));
  const tort = (rows: string[], bob: number, bright: boolean, dx = 0) => (g: Grid) => {
    onFeet(g, rows, { bob, dx });
    const w = Math.max(...rows.map((r) => r.length));
    constellation(g, ALLY_FEET[0] - Math.floor(w / 2) + dx, ALLY_FEET[1] - rows.length + 1 + bob, bright);
  };
  add('ally_spiritTortoise_0', frame(ALLY_W, ALLY_H, tort(TORTOISE, 0, false)));
  add('ally_spiritTortoise_1', frame(ALLY_W, ALLY_H, tort(TORTOISE, 1, false)));
  add('ally_spiritTortoise_act', frame(ALLY_W, ALLY_H, (g) => (tort(TORTOISE_ACT, 0, true, -2)(g), ward(g, 18, 14))));
  add('ally_wispSwarm_0', frame(ALLY_W, ALLY_H, (g) => wisps(g, 0, false)));
  add('ally_wispSwarm_1', frame(ALLY_W, ALLY_H, (g) => wisps(g, 1, false)));
  add('ally_wispSwarm_act', frame(ALLY_W, ALLY_H, (g) => wisps(g, 0, true)));
  add('ally_spiritStag_0', stagFrame({}, 1));
  add('ally_spiritStag_1', stagFrame({ bob: 1 }, 2));
  add('ally_spiritStag_act', stagFrame({ rear: true }, 3));
}
