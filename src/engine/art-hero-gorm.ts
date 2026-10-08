// Gorm, Stonefist (see docs/content-bible.md section 3): a huge, gentle half-giant with grey-green skin, a big jaw and
// a tuft of moss-green hair, a leather harness studded with stones, and two enormous stone gauntlets. Fight frames
// `gorm_${pose}` on the shared rig (art-rig.ts): the broadest hero in the box, a small head on great shoulders, arms
// as thick as Torva's legs, and the gauntlets drawn as their own blocks of stone (gauntlet()) at the fists.
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { sparkle, type HeroCardSpec, type Item, type Layer, type Rig, type RigPose } from './art-rig';

// ------------------------------------------------------------------ palette

/** Grey-green skin: shadows lean blue, light leans warm olive. */
const SKIN = ['#20252c', '#333d40', '#4b5854', '#67766a', '#889684', '#b0baa0'];
const HAIR = ['#163222', '#24502e', '#3e7434', '#689a3a', '#a2c84e', '#d0e47a'];
/** The gauntlets' granite: cool in shadow, warm where lit. */
export const GORM_STONE = ['#24232f', '#3c3a48', '#5c5864', '#837e7e', '#aba396', '#d6cdb8'];
const LEATHER = ['#26160e', '#452918', '#6a4224', '#946238', '#bc8c58'];
const CLOTH = ['#241e24', '#383036', '#52464a', '#6e5e5c', '#8a7870'];
const MOSS_PATCH = ['#2a5230', '#447436', '#6e9c3c'];

export const GORM_PAL: Pal = {
  // the face (by hand): skin tones, brow, eyes, mouth, teeth, the ear's shade
  z: SKIN[1], Z: SKIN[2], S: SKIN[4], T: SKIN[5], E: SKIN[2], k: '#140c1c', W: '#f4f0e0', x: '#3a1a1a', t: '#ece4c8',
  // the harness's studs: a lit stone and its shade; the buckle's stone
  o: GORM_STONE[4], O: GORM_STONE[2], B: GORM_STONE[5], b: GORM_STONE[3],
  // moss growing on the gauntlets and shoulders
  M: MOSS_PATCH[2], m: MOSS_PATCH[1],
};
export const GORM_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, top: [5, 4], left: [4], right: [1], bottom: [1], mid: 3 },
  s: { ramp: SKIN, same: 'zZSTEkWxtMm', top: [5, 4], left: [4], right: [1], bottom: [1, 2], mid: 3 },
  l: { ramp: LEATHER, same: 'oOBb', top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 },
  p: { ramp: CLOTH, top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 },
  w: { ramp: LEATHER, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// A small head on a thick neck: a moss-green tuft swept back, a heavy brow over small kind eyes, a broad nose and a
// big jaw jutting forward with two little lower teeth showing; 14 wide.
const HEAD = [
  '.....h.h......',
  '...hhhhhh.....',
  '..hhhhhhhh....',
  '.hhhhhhhhhh...',
  '..hssssssss...',
  '.ssssssssssss.',
  '.sssssssZZsZZ.',
  'EssssssssWksWk',
  'EEsssssSsssSsS',
  'EsssssssssssZz',
  'sssssssstsstss',
  'ssssssxxtxxtxs',
  'ssssssssssssss',
  '.sssssssssssz.',
  '..sssssssssz..',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 14 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: eyes squeezed shut under the brow
  squint: face(HEAD, { 6: 'ZZZsZZ.', 7: 'zzzszzz', 11: 'xxtxxtxs' }),
  ko: face(HEAD, { 7: 'skzsskz', 10: 'ssssssss', 11: 'sssxxxss' }),
  // the Roar: brows down, the great jaw dropped wide open
  roar: face(HEAD, { 6: 'ZZZZZZZ', 7: 'zWkzzWk', 10: 'xtxxtxx', 11: 'xxxxxxx', 12: 'xtxxtxs', 13: 'ssssssz.' }),
  // a gentle smile, eyes curved shut
  smile: face(HEAD, { 7: 'skksskk', 10: 'xsssssx', 11: 'sxxtxxs' }),
};

// Great round shoulders, a broad grey-green chest crossed by the harness's straps with their stones, a belly, the
// belt with a stone buckle; 22 wide.
const TORSO = [
  '....ssss.......sssss...',
  '..ssssssssssssssssssss.',
  'sssssssssssssssssssssss',
  'sssZsllssssssssssllsZss',
  'sssZssllssssssssllssZss',
  'ssssZssoOsssssssoOsZsss',
  '.sssssssllsssssllsssss.',
  '.ssssssssllsssllssssss.',
  '..sssssssslllllsssssss.',
  '..ssssssssloBolsssssss.',
  '..ssssssZsslllssZsssss.',
  '..ssssssssslllssssssss.',
  '..llllllllllBBlllllll..',
  '..llllllllllbblllllll..',
  '...ppppppppppppppppp...',
];

// Wide cloth breeches, leather wraps on the shins, great bare feet; 19 wide, the feet centred on x = 9.
const LEGS: Record<string, string[]> = {
  stand: [
    '..ppppppppppppppp..',
    '..ppppppppppppppp..',
    '..ppppppp.ppppppp..',
    '..pppppp...pppppp..',
    '..pppppp...pppppp..',
    '...wwwww...wwwww...',
    '...wwwww...wwwww...',
    '...wwwww...wwwww...',
    '...sssss...ssssss..',
    '..sssssss..sssssss.',
    '..sssssss..ssssssss',
  ],
  run: [
    '...ppppppppppppppp.',
    '..ppppppp..ppppppp.',
    '.pppppp.....pppppp.',
    'pppppp......pppppp.',
    'pppppp.......ppppp.',
    'wwwww........wwwww.',
    'wwww.........wwwww.',
    'sss..........wwwww.',
    'sss.........ssssss.',
    '............sssssss',
    '............ssssssss',
  ],
  lunge: [
    '...ppppppppppppppp.',
    '..ppppppp..ppppppp.',
    '.pppppp.....pppppp.',
    '.pppppp.....pppppp.',
    '.pppppp.....pppppp.',
    '.wwwww......wwwww..',
    'wwwww........wwwww.',
    'wwwww........wwwww.',
    'ssss.........sssss.',
    'sssss.......sssssss',
    'ssssss......ssssssss',
  ],
  crouch: [
    '..ppppppppppppppp..',
    '.ppppppp...pppppppp',
    '.pppppp.....pppppp.',
    '.pppppp.....pppppp.',
    '.wwwww......wwwwww.',
    'wwwww.......wwwwww.',
    'sssss........sssss.',
    'ssssss......sssssss',
    'sssssss.....ssssssss',
  ],
  tuck: [
    '..ppppppppppppppp..',
    '.pppppppppppppppp..',
    '..pppppppp.pppppp..',
    '.....wwwwww.wwwww..',
    '.....sssssssssssss.',
    '......ssssss.sssss.',
  ],
  kneel: [
    '..ppppppppppppppp..',
    '.ppppppppppppppppp.',
    '..pppppppp...pppppp',
    'wwwwwwwwww...wwwww.',
    'ssssssssss...wwwww.',
    '.............sssss.',
    '............sssssss',
  ],
};

/** The bare forearms: thick and grey-green, a leather bracer at the wrist where the gauntlet starts. */
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.72, SKIN[5], SKIN[4], SKIN[3], SKIN[2], SKIN[1]],
  [1, LEATHER[4], LEATHER[3], LEATHER[2], LEATHER[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.72, SKIN[4], SKIN[3], SKIN[2], SKIN[1], SKIN[0]],
  [1, LEATHER[3], LEATHER[2], LEATHER[1], LEATHER[0]],
];

/** The rig's fists are left empty (a pixel of wrist): the gauntlets are items drawn over them (gauntlet()). */
const WRIST = ['l'];

export const GORM_RIG: Rig = {
  pal: { ...GORM_PAL, l: LEATHER[2] },
  shades: GORM_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 9,
  torsoX: -11,
  torsoOverlap: 1,
  headX: 6,
  headOverlap: 3,
  shoulderNear: [4, 3],
  shoulderFar: [18, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: WRIST,
  fistFar: WRIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the gauntlets

type Facing = 'r' | 'l' | 'u' | 'd';

/**
 * A stone gauntlet centred on the hand: a 9 x 9 block of granite with cut corners, lit from the top left, three
 * finger grooves on the side it faces, a ridge of knuckle studs, a cuff band and a tuft of moss. `dim`: the far one
 * (a step darker); `big`: two px larger all round (the finisher).
 */
function gauntlet(face: Facing, o: { dim?: boolean; big?: boolean } = {}): Item {
  return (g, x, y) => {
    const R = o.dim ? [GORM_STONE[0], GORM_STONE[0], GORM_STONE[1], GORM_STONE[2], GORM_STONE[3], GORM_STONE[4]] : GORM_STONE;
    const n = o.big ? 11 : 9;
    const h = (n - 1) / 2;
    const x0 = x - h;
    const y0 = y - h;
    const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < n && j < n && !((i === 0 || i === n - 1) && (j === 0 || j === n - 1));
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        if (!inside(i, j)) continue;
        let c = R[3];
        if (!inside(i, j + 1)) c = R[1];
        else if (!inside(i + 1, j)) c = R[2];
        else if (!inside(i, j - 1)) c = R[5];
        else if (!inside(i - 1, j)) c = R[4];
        else if (!inside(i + 1, j + 1) || !inside(i, j + 2)) c = R[2];
        put(g, x0 + i, y0 + j, c);
      }
    // finger grooves across the face it points at, and the knuckle ridge just behind them
    const grooves = o.big ? [3, 5, 7] : [2, 4, 6];
    for (const k of grooves) {
      for (let d = 1; d <= 2; d++) {
        if (face === 'r') put(g, x0 + n - 1 - d, y0 + k, R[1]);
        else if (face === 'l') put(g, x0 + d, y0 + k, R[1]);
        else if (face === 'u') put(g, x0 + k, y0 + d, R[1]);
        else put(g, x0 + k, y0 + n - 1 - d, R[1]);
      }
    }
    const studs = o.big ? [2, 5, 8] : [2, 4, 6];
    for (const k of studs) {
      if (face === 'r') (put(g, x0 + n - 4, y0 + k, R[5]), put(g, x0 + n - 4, y0 + k + 1, R[2]));
      else if (face === 'l') (put(g, x0 + 3, y0 + k, R[5]), put(g, x0 + 3, y0 + k + 1, R[2]));
      else if (face === 'u') (put(g, x0 + k, y0 + 3, R[5]), put(g, x0 + k + 1, y0 + 3, R[2]));
      else (put(g, x0 + k, y0 + n - 4, R[5]), put(g, x0 + k + 1, y0 + n - 4, R[2]));
    }
    // a band of leather at the cuff (the side away from the fingers)
    for (let k = 1; k < n - 1; k++) {
      if (face === 'r') put(g, x0, y0 + k, LEATHER[k < 3 ? 3 : 2]);
      else if (face === 'l') put(g, x0 + n - 1, y0 + k, LEATHER[1]);
      else if (face === 'u') put(g, x0 + k, y0 + n - 1, LEATHER[1]);
      else put(g, x0 + k, y0, LEATHER[3]);
    }
    // moss on its top
    if (!o.dim) {
      put(g, x0 + 2, y0, MOSS_PATCH[2]);
      put(g, x0 + 3, y0, MOSS_PATCH[1]);
      put(g, x0 + 3, y0 - 1, MOSS_PATCH[2]);
    }
  };
}

// ------------------------------------------------------------------ effects

/** Dust and pebbles kicked up where a gauntlet lands, cracks in the ground. */
const impact =
  (x: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy;
    for (const [dx, dy, c] of [
      [-7, -1, '#c8b494'],
      [-6, -3, '#e8d8b8'],
      [-8, -4, '#c8b494'],
      [7, -1, '#c8b494'],
      [8, -3, '#e8d8b8'],
      [9, -5, '#c8b494'],
      [-4, -6, '#e8d8b8'],
      [5, -7, '#e8d8b8'],
    ] as Array<[number, number, string]>)
      put(g, X + dx, Y + dy, c);
    // pebbles flying
    for (const [dx, dy] of [
      [-10, 6],
      [11, 8],
      [-3, 10],
    ])
      stamp(g, ['ab', 'bc'], { a: GORM_STONE[5], b: GORM_STONE[3], c: GORM_STONE[1] }, X + dx, Y - dy);
    for (let k = -5; k <= 5; k++) if (k !== 0) put(g, X + k, Y + (Math.abs(k) % 2), '#4a3020');
  };

/** Swoosh lines trailing a punch: arcs of pale pixels. */
const swoosh =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    for (const [rr, col] of [
      [r, '#ffffff'],
      [r - 1, '#d8d8c8'],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        const ang = a0 + (a1 - a0) * t;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

/** The Roar: rings of sound rolling out of his mouth. */
const roarRings: Layer = (g, a) => {
  const cx = a.hx + 14;
  const cy = a.hy + 10;
  for (const [r, c] of [
    [4, '#f4f0e0'],
    [7, '#d8d4c4'],
    [10, '#b8b4a8'],
  ] as Array<[number, string]>)
    for (let t = -0.9; t <= 0.9; t += 1 / (r * 3)) put(g, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), c);
};

/** Pebbles shaken loose round him (the finisher). */
const pebbles =
  (pts: Array<[number, number]>): Layer =>
  (g, a) => {
    for (const [x, y] of pts) stamp(g, ['.ab', 'abc', 'bc.'], { a: GORM_STONE[5], b: GORM_STONE[3], c: GORM_STONE[1] }, a.fx + x, a.fy - y);
  };

/** Dizzy stars round the head (knocked out). */
const dizzy: Layer = (g, a) => {
  for (const [dx, dy] of [
    [1, -2],
    [8, -4],
    [14, -1],
  ])
    sparkle(g, a.hx + dx, a.hy + dy, '#e8d080', '#ffffff');
};

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
const G = (face: Facing, o: { dim?: boolean; big?: boolean } = {}) => ({ item: gauntlet(face, o), over: true });
export const GORM_POSES: Record<string, RigPose> = {
  // the gauntlets hanging heavy at his sides, a gentle slouch
  idle0: P({ near: { at: [-8, 9], ...G('d') }, far: { at: [12, 10], ...G('d', { dim: true }) } }),
  idle1: P({ near: { at: [-8, 8], ...G('d') }, far: { at: [12, 9], ...G('d', { dim: true }) }, dy: 1 }),
  dash: P({ near: { at: [-6, 14], ...G('r') }, far: { at: [14, 15], ...G('r', { dim: true }) }, legs: 'run', dx: 1, lean: 1 }),
  // a two-fisted hammer blow landing in front
  slashA: P({ near: { at: [16, 8], ...G('d') }, far: { at: [19, 10], ...G('d', { dim: true }) }, legs: 'lunge', dx: 2, lean: 1, bow: 1, front: [impact(18)] }),
  // a great hook punch, the near gauntlet thrown out level with his chest
  slashB: P({ near: { at: [21, 20], ...G('r') }, far: { at: [8, 14], ...G('r', { dim: true }) }, legs: 'lunge', dx: 2, lean: 1, back: [swoosh(10, 20, 13, 2.4, 0.4)] }),
  // a gauntlet drawn back high over his shoulder
  windup: P({ near: { at: [-8, 30], ...G('u') }, far: { at: [12, 16], ...G('r', { dim: true }) }, legs: 'crouch', dy: 1, head: 'roar' }),
  // the gauntlets crossed in front of him, a wall of stone
  parry: P({ near: { at: [13, 18], ...G('r') }, far: { at: [14, 25], ...G('r', { dim: true }) }, legs: 'crouch', dy: 1, farFront: true }),
  hurt: P({ near: { at: [-10, 14], ...G('l') }, far: { at: [10, 17], ...G('r', { dim: true }) }, dx: -1, lean: -1, dy: 1, head: 'squint' }),
  leap: P({ near: { at: [2, 34], ...G('u') }, far: { at: [12, 33], ...G('u', { dim: true }) }, legs: 'tuck', armsUp: true }),
  // knocked out: down on one knee, the gauntlets resting on the ground
  down: P({ near: { at: [14, 4], ...G('d') }, far: { at: [-7, 4], ...G('d', { dim: true }) }, legs: 'kneel', dy: 1, lean: 1, bow: 2, head: 'ko', front: [dizzy] }),
  // the finisher: both gauntlets raised high overhead, roaring, pebbles shaking loose
  fin: P({
    near: { at: [-13, 30], ...G('u', { big: true }) },
    far: { at: [19, 31], ...G('u', { dim: true, big: true }) },
    legs: 'lunge',
    head: 'roar',
    front: [pebbles([[-20, 18], [25, 20], [-17, 8], [27, 9]])],
  }),
  // Roar: chest out, gauntlets spread wide, the jaw dropped
  cast: P({ near: { at: [-12, 18], ...G('l') }, far: { at: [20, 18], ...G('r', { dim: true }) }, head: 'roar', front: [roarRings] }),
};

/** Hero select card: a friendly wave with one gauntlet, the other at his side, before a granite glow with a moss heart. */
export const GORM_CARD: HeroCardSpec = {
  pose: { near: { at: [-8, 9], ...G('d') }, far: { at: [14, 24], ...G('u', { dim: true }) }, head: 'smile' },
  glow: ['#c8e070', '#6e6a74'],
  motes: [[5, 12], [34, 9], [35, 30]],
};

/** By the campfire (two breaths): the gauntlets folded in front of him, smiling at the fire. */
export const GORM_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [6, 13], ...G('r') }, far: { at: [11, 12], ...G('r', { dim: true }) }, head: 'smile' }),
  P({ near: { at: [6, 12], ...G('r') }, far: { at: [11, 11], ...G('r', { dim: true }) }, dy: 1, head: 'smile' }),
];

/** Exported for the card and portrait code that wants a gauntlet on its own. */
export const gormGauntlet = (g: Grid, x: number, y: number, face: Facing = 'r') => gauntlet(face)(g, x, y);
