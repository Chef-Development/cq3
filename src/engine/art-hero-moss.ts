// Moss, the grove caller (see docs/content-bible.md section 3): a small round grove keeper (gnome-sized, in the same
// frame box as the others), a cloak of overlapping leaves, a twig crown with two buds, a big soft nose and a crooked
// wooden staff topped by a glowing seed. Fight frames `moss_${pose}` on the shared rig (art-rig.ts).
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { STEP, ribbon, sparkle, type Dir, type HeroCardSpec, type Item, type Layer, type Pt, type Rig, type RigPose } from './art-rig';

// ------------------------------------------------------------------ palette

export const MOSS_LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];
const MOSSHAIR = ['#6a7a5a', '#a8b494', '#d8dcc0', '#f4f4e0', '#ffffff'];
export const MOSS_BARK = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44'];
export const MOSS_SEED = ['#8a4a10', '#d8861c', '#ffc040', '#fff0a0', '#fffce0'];
const SKIN = ['#8a4a34', '#c47a54', '#eaa878', '#ffd0a4'];

export const MOSS_PAL: Pal = {
  // face (by hand): skin, the big soft nose, eyes, cheeks
  z: SKIN[1], s: SKIN[2], S: SKIN[3], O: '#ffd8c0', N: '#f49a80', n: '#d0705c', o: '#a04a44', k: '#140c1c', W: '#ffffff', p: '#f49a90', x: '#7a3030',
  // twig crown and its buds
  t: MOSS_BARK[3], T: MOSS_BARK[1], u: '#c8f070', U: '#f8a0c0',
  G: MOSSHAIR[4],
  // the leaf cloak's tones (1 darkest .. 5 lightest)
  1: MOSS_LEAF[1], 2: MOSS_LEAF[2], 3: MOSS_LEAF[3], 4: MOSS_LEAF[4], 5: MOSS_LEAF[5],
  // hands
  F: SKIN[3], f: SKIN[2], v: SKIN[1],
};
export const MOSS_SHADES: Record<string, Shade> = {
  g: { ramp: MOSSHAIR, same: 'G', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  b: { ramp: MOSS_BARK, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// Mossy hair under a twig crown with two buds (one green, one pink), small bright eyes, rosy cheeks and a big soft
// nose; 14 wide.
const HEAD = [
  '...t...t.t....',
  '..tut.tUtt....',
  '..ttTttTttt...',
  '.gGggggggggg..',
  'gGgggggggggggg',
  'gggggggggggggg',
  'ggggggSSgggSg.',
  'ggggzSkWSSkWS.',
  'ggggzSkkSSkkS.',
  '.gggzSpSSONNn.',
  '..ggzzSSONNNno',
  '...gggggNNnnoo',
  '....gggggnoog.',
  '.....ggggggg..',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 14 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 7: 'zSSSSSSSS.', 8: 'zSkkSSkkS.' }),
  // dazed: little crossed eyes
  ko: face(HEAD, { 7: 'zSkSSSkSS.', 8: 'zSSkSSSkS.' }),
  // calling the grove: eyes shut, smiling
  call: face(HEAD, { 7: 'zSSSSSSSS.', 8: 'zSkkSSkkS.' }),
};

/**
 * The leaf cloak: a bell of overlapping leaves in rows (each leaf 4 px wide, its tip pointing down, every other row
 * offset by 2), lit from the top left; `w0`/`w1` the half-widths at the top and the hem, the hem scalloped.
 */
function leafCloak(w: number, h: number, w0: number, w1: number): string[] {
  const cx = w / 2;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    const hw = w0 + (w1 - w0) * Math.pow(y / (h - 1), 0.75);
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > hw) {
        r += '.';
        continue;
      }
      const band = Math.floor(y / 3);
      const v = y % 3;
      const off = band % 2 ? 2 : 0;
      const u = (x + off) % 4;
      // the hem: only the leaf tips hang below the last full row
      if (y === h - 1 && (u === 0 || u === 3)) {
        r += '.';
        continue;
      }
      let t = v === 0 ? (u === 1 || u === 2 ? 4 : 3) : v === 1 ? (u === 3 ? 2 : 3) : u === 1 || u === 2 ? 3 : 1;
      if (v === 0 && u === 1) t = 5;
      // light from the top left
      const side = dx / hw;
      if (side < -0.45) t += 1;
      else if (side > 0.5) t -= 1;
      if (y < 2) t += 1;
      if (y >= h - 2 && t > 1) t -= 1;
      r += String(Math.max(1, Math.min(5, t)));
    }
    rows.push(r);
  }
  return rows;
}

const TORSO = leafCloak(16, 10, 4.2, 7.9);

// Little bark-brown boots under the hem; 16 wide, the feet centred on x = 8.
const LEGS: Record<string, string[]> = {
  stand: ['....bbb..bbb....', '...bbbb..bbbbb..'],
  run: ['.bbb......bbb...', '..........bbbbb.'],
  lunge: ['..bbb.....bbb...', '.bbbb.....bbbbb.'],
  crouch: ['..bbbb...bbbbb..'],
  tuck: ['.....bbbbbbb....'],
  kneel: ['..bbb.......bbb.'],
};

const FIST = ['FF', 'fv'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.75, MOSS_LEAF[4], MOSS_LEAF[3]],
  [1, MOSS_BARK[4], MOSS_BARK[3]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.75, MOSS_LEAF[3], MOSS_LEAF[2]],
  [1, MOSS_BARK[3], MOSS_BARK[2]],
];

export const MOSS_RIG: Rig = {
  pal: MOSS_PAL,
  shades: MOSS_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 8,
  torsoX: -8,
  torsoOverlap: 1,
  headX: 1,
  headOverlap: 2,
  shoulderNear: [7, 3],
  shoulderFar: [11, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the staff and its seed

/** The glowing seed centred on (cx, cy): amber, lit from the top left, a soft halo cross; `bright` flares it. */
export function seed(g: Grid, cx: number, cy: number, bright = false, dim = false): void {
  const S = dim ? ['#4a3018', '#7a5a2a', '#a0804a', '#c0a070', '#d8c090'] : MOSS_SEED;
  if (!dim) {
    const halo = bright ? '#fff8c0' : '#ffe890';
    for (const [dx, dy] of [
      [-2, 0],
      [3, 0],
      [0, -3],
      [1, -3],
      [0, 3],
      [1, 3],
      [-1, -2],
      [2, -2],
      [-1, 2],
      [2, 2],
    ])
      put(g, cx + dx, cy + dy, halo);
  }
  stamp(g, ['.dc.', 'dcbb', 'cbba', '.aa.'], { d: S[4], c: S[3], b: S[2], a: S[1] }, cx - 1, cy - 2);
  if (bright) {
    sparkle(g, cx + 5, cy - 4, MOSS_SEED[3], '#ffffff', true);
    sparkle(g, cx - 4, cy - 5, MOSS_SEED[3]);
  }
}

/** The crooked staff from its grip: `len` px toward the seed, `back` px to its foot; it kinks along the way (a
 *  sideways jog of a pixel every few px) and curls at the top into a crook that cradles the seed. */
function staff(dir: Dir, len: number, back: number, o: { bright?: boolean; dim?: boolean } = {}): Item {
  return (g, x, y) => {
    const [sx, sy] = STEP[dir];
    const diag = sx !== 0 && sy !== 0;
    const px = -sy;
    const py = sx;
    const jog = (i: number) => (i > 4 && i < 9 ? 1 : i < -3 ? -1 : 0);
    const B = MOSS_BARK;
    for (let i = -back; i <= len; i++) {
      const k = jog(i);
      const X = x + sx * i + (diag ? 0 : px * k);
      const Y = y + sy * i + (diag ? 0 : py * k);
      const knot = i % 6 === 3;
      if (diag) {
        put(g, X, Y, knot ? B[4] : B[3]);
        put(g, X + (sx === sy ? -1 : 1), Y, B[2]);
        put(g, X, Y + 1, B[1]);
      } else if (sx === 0) {
        put(g, X, Y, knot ? B[4] : B[3]);
        put(g, X + 1, Y, B[1]);
      } else {
        put(g, X, Y, knot ? B[4] : B[3]);
        put(g, X, Y + 1, B[1]);
      }
    }
    // the crook: the staff's tip curls forward and back down round the seed
    const e: Pt = [x + sx * len, y + sy * len];
    const hook: Array<[number, number]> = [
      [1, 1],
      [2, 2],
      [3, 2],
      [4, 1],
      [4, 0],
    ];
    for (const [a, b] of hook) {
      // a along the staff, b sideways (forward = the right of the direction)
      const X = e[0] + sx * a + (diag ? 0 : -px * b);
      const Y = e[1] + sy * a + (diag ? 0 : -py * b);
      put(g, X, Y, B[3]);
      put(g, X + 1, Y, B[1]);
    }
    seed(g, e[0] + sx * 3 + (dir === 'u' ? 1 : 0), e[1] + sy * 3 + (dir === 'u' ? 2 : 0), o.bright, o.dim);
  };
}

// ------------------------------------------------------------------ effects

/** Leaves flying (a spray from the swing, or blown off when hit). */
const leaves =
  (pts: Array<[number, number, number]>): Layer =>
  (g, a) => {
    for (const [x, y, k] of pts) {
      const X = a.fx + x;
      const Y = a.fy - y;
      const L = MOSS_LEAF;
      if (k % 2) stamp(g, ['.54', '43.'], { 5: L[5], 4: L[4], 3: L[3] }, X, Y);
      else stamp(g, ['45.', '.43'], { 5: L[5], 4: L[4], 3: L[3] }, X, Y);
    }
  };

/** A seed shot: a glowing seed flying right, a few motes behind. */
const shot =
  (x: number, y: number): Layer =>
  (g, a) => {
    seed(g, a.fx + x, a.fy - y, true);
    for (const [dx, c] of [
      [-5, MOSS_SEED[3]],
      [-8, MOSS_SEED[2]],
      [-11, MOSS_SEED[3]],
    ] as Array<[number, string]>)
      put(g, a.fx + x + dx, a.fy - y, c);
  };

/** A wall of leaves swirling up in front (the parry). */
const leafWall =
  (x: number): Layer =>
  (g, a) => {
    const rows = leafCloak(6, 15, 2.2, 2.9);
    stamp(g, rows, MOSS_PAL, a.fx + x, a.fy - 18);
  };

/** Vines spiralling up from the ground (the finisher). */
const vines =
  (specs: Array<[number, number, number, number]>): Layer =>
  (g, a) => {
    for (const [x, n, ph, amp] of specs) {
      ribbon(g, a.fx + x, a.fy, n, (t) => -Math.PI / 2 + amp * Math.sin(t * 6 + ph), (t) => (t > 0.85 ? [MOSS_LEAF[5]] : [MOSS_LEAF[4], MOSS_LEAF[2]]));
      // a leaf every few steps up the vine
      for (let k = 4; k < n; k += 5) {
        const yy = a.fy - k;
        const xx = Math.round(a.fx + x + Math.sin(ph + k * 0.4) * 2);
        stamp(g, k % 2 ? ['54', '3.'] : ['45', '.3'], { 5: MOSS_LEAF[5], 4: MOSS_LEAF[4], 3: MOSS_LEAF[3] }, xx + (k % 2 ? 1 : -2), yy);
      }
    }
  };

/** A sprout popping up from the ground (Call). */
const sprout =
  (x: number): Layer =>
  (g, a) => {
    stamp(g, ['5..45', '44.43', '.343.', '..3..', '..2..'], { 5: MOSS_LEAF[5], 4: MOSS_LEAF[4], 3: MOSS_LEAF[3], 2: MOSS_LEAF[2] }, a.fx + x - 2, a.fy - 4);
    for (const [dx, dy] of [
      [-3, 6],
      [3, 8],
      [0, 10],
    ])
      put(g, a.fx + x + dx, a.fy - dy, MOSS_SEED[3]);
  };

/** Moss's staff lying in the grass (knocked out). */
const droppedStaff: Layer = (g, a) => staff('r', 14, 0, { dim: true })(g, a.fx - 12, a.fy - 1);

/** Dizzy little stars circling the head. */
const dizzy: Layer = (g, a) => {
  for (const [dx, dy] of [
    [2, -2],
    [9, -4],
    [15, -1],
  ])
    sparkle(g, a.hx + dx, a.hy + dy, MOSS_SEED[3], '#ffffff');
};

// ------------------------------------------------------------------ poses

export const MOSS_POSES: Record<string, RigPose> = {
  idle0: { near: { at: [6, 7], item: staff('u', 12, 7) }, far: { at: [9, 6] } },
  idle1: { near: { at: [6, 6], item: staff('u', 12, 6) }, far: { at: [9, 5] }, dy: 1 },
  // the staff's hand settles a frame behind the breath
  idle2: { near: { at: [6, 5], item: staff('u', 12, 5) }, far: { at: [9, 4] }, dy: 1 },
  idle3: { near: { at: [6, 6], item: staff('u', 12, 6) }, far: { at: [9, 6] } },
  dash: { near: { at: [6, 7], item: staff('ur', 9, 5) }, far: { at: [-3, 8] }, legs: 'run', dx: 1, lean: 1 },
  // a seed shot from the levelled staff
  slashA: { near: { at: [9, 9], item: staff('r', 10, 5, { bright: true }) }, far: { at: [5, 6] }, legs: 'lunge', dx: 1, lean: 1, front: [shot(33, 12)] },
  // a sweep that scatters a spray of leaves
  slashB: {
    near: { at: [10, 6], item: staff('dr', 6, 2) },
    far: { at: [-2, 9] },
    legs: 'lunge',
    dx: 1,
    lean: 1,
    bow: 1,
    front: [leaves([[19, 8, 0], [22, 12, 1], [24, 6, 2], [27, 10, 3], [21, 15, 4]])],
  },
  windup: { near: { at: [-3, 14], item: staff('ul', 8, 5, { bright: true }) }, far: { at: [8, 8] }, legs: 'crouch', armsUp: true },
  // the staff crosswise, a wall of leaves swirling up in front
  parry: { near: { at: [3, 9], item: staff('r', 9, 3) }, far: { at: [10, 9] }, legs: 'crouch', farFront: true, front: [leafWall(15)] },
  hurt: { near: { at: [-4, 8], item: staff('ul', 9, 6) }, far: { at: [8, 10] }, dx: -1, lean: -1, head: 'squint', front: [leaves([[-6, 20, 0], [12, 22, 1], [-9, 14, 2]])] },
  leap: { near: { at: [5, 12], item: staff('u', 9, 6, { bright: true }) }, far: { at: [9, 11] }, legs: 'tuck' },
  // knocked out: sat down in a heap, dazed, the staff fallen in the grass
  down: { near: { at: [7, 2] }, far: { at: [-4, 2] }, legs: 'kneel', bow: 1, head: 'ko', back: [droppedStaff], front: [dizzy] },
  // the finisher: the staff raised high, vines spiralling up all round
  fin: {
    near: { at: [5, 17], item: staff('u', 7, 6, { bright: true }) },
    far: { at: [8, 16] },
    legs: 'lunge',
    head: 'call',
    back: [vines([[-11, 22, 0, 0.5], [-6, 15, 2, 0.6]])],
    front: [vines([[15, 20, 1, 0.5], [21, 14, 3, 0.6]])],
  },
  // Call: the staff planted, a hand raised to the grove, a sprout popping up ahead
  cast: { near: { at: [6, 7], item: staff('u', 12, 7, { bright: true }) }, far: { at: [11, 15] }, farFront: true, head: 'call', front: [sprout(19)] },
};

/** Hero select card: the staff raised, its seed blazing, a sprout at his feet, before a leaf-green glow with a gold
 *  heart. */
export const MOSS_CARD: HeroCardSpec = {
  pose: { near: { at: [6, 10], item: staff('u', 10, 9, { bright: true }) }, far: { at: [10, 9] }, head: 'call', front: [sprout(13)] },
  glow: ['#fff0a0', '#4a7e36'],
  motes: [[6, 12], [33, 9], [34, 28]],
};

/** By the campfire (two breaths): leaning on the staff, the seed glowing softly, eyes shut and content. */
export const MOSS_CAMP: [RigPose, RigPose] = [
  { near: { at: [6, 8], item: staff('u', 11, 8) }, far: { at: [8, 7] }, head: 'call' },
  { near: { at: [6, 7], item: staff('u', 11, 7) }, far: { at: [8, 6] }, dy: 1, head: 'call' },
];
