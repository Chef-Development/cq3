// Vesper, the dusk ranger (see docs/content-bible.md section 3): a tall, keen-eyed ranger with pointed ears, a
// dusk-purple hooded cloak lined with gold (the hood down on her shoulders), a silver longbow, a quiver of
// white-fletched arrows and dark green leathers. Fight frames `vesper_${pose}` on the shared rig (art-rig.ts). The
// bow rides the far hand (in front of the body); the near hand draws the string.
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { ribbon, sparkle, type HeroCardSpec, type Layer, type Pt, type Rig, type RigPose } from './art-rig';

// ------------------------------------------------------------------ palette

const CLOAK = ['#1e1236', '#33205a', '#4e3480', '#6e4ea6', '#9a78c8'];
export const VESPER_GOLD = ['#7a4a10', '#c08020', '#f2c040', '#fff0a0'];
const GREEN = ['#0e1e1a', '#18302a', '#24483a', '#38644a', '#5a8a5a'];
const HAIR = ['#0c0c16', '#181a2a', '#262a40', '#3a4262', '#5e6a92'];
const LEATHER = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c'];
export const VESPER_SILVER = ['#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];

export const VESPER_PAL: Pal = {
  // face (by hand): skin, eyes (amber), the ear
  z: '#a8604a', s: '#e09a74', S: '#f8c49c', T: '#ffe2c4', E: '#e09a74', e: '#ffd8b4', k: '#140c1c', W: '#ffffff', i: '#f2c040', I: '#b07018', x: '#8a3a3a',
  H: HAIR[1], L: HAIR[4], G: VESPER_GOLD[2], g: VESPER_GOLD[1], N: GREEN[0], y: LEATHER[2], Y: VESPER_GOLD[2],
  // gloves
  V: LEATHER[3], v: LEATHER[2], u: LEATHER[1],
};
export const VESPER_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, same: 'HL', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  c: { ramp: CLOAK, same: 'Gg', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  t: { ramp: GREEN, same: 'N', top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
  l: { ramp: LEATHER, same: 'Y', top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
  b: { ramp: LEATHER, top: [3], left: [2], right: [1], bottom: [0], mid: 1 },
  p: { ramp: GREEN, top: [3], left: [2], right: [1], bottom: [0], mid: 1 },
};

// ------------------------------------------------------------------ body

// Dark hair swept back into a tail, a long pointed ear, narrow amber eyes.
const HEAD = [
  '.....hhhhhh.....',
  '...hhhLLhhhhh...',
  '..hhLLhhhhhhhh..',
  '.hhLhhhhhhHhhhh.',
  '.hhhhhhhhHhhhhhh',
  'hhhhhhhhHhhhhhhh',
  'hhEehhhHhhhSSShh',
  'hhhEehhhSSSSSSSS',
  'hhhzEEhzSSkkSSkk',
  'hhhhzEEzSSWiSSWi',
  '.hhhhzzSSSSSSSST',
  '..hhhhzzSSSSSSz.',
  '...hhh.zzSSSxS..',
  '........zzSSS...',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSkkSSkk', 12: 'SSxxS..' }),
  ko: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSSSSSSS', 10: 'SSkkSSkT', 12: 'SSSxS..' }),
  // one eye shut, aiming
  aim: face(HEAD, { 8: 'SSkSSSkk', 9: 'SSkkSSWi' }),
};

// The hood down round the shoulders (purple, gold-edged), a green leather tunic, a quiver strap, a belt.
const TORSO = [
  '..ccccccccc....',
  '.cccGcccGccc...',
  'ccccgtttgccccc.',
  '.ccctttyttcc...',
  '..ttttyttttt...',
  '..tttytttttt...',
  '..ttyttNtttt...',
  '..tyttNttttt...',
  '..llllllYllll..',
  '..ttttttNtttt..',
];

// Green leggings and tall brown boots; 15 wide, the feet centred on x = 7.
const LEGS: Record<string, string[]> = {
  stand: [
    '..tttttttttt...',
    '..ttttNtttttt..',
    '...ppp...ppp...',
    '...ppp...ppp...',
    '...ppp...ppp...',
    '...bbb...bbb...',
    '...bbb...bbb...',
    '...bbb...bbb...',
    '..bbbbb..bbbbb.',
    '..bbbbbb.bbbbbb',
  ],
  run: [
    '...tttttttttt..',
    '..ttttttNtttt..',
    '.ppp......ppp..',
    'ppp........ppp.',
    'bb.........ppp.',
    'bb..........bbb',
    '............bbb',
    '............bbb',
    '...........bbbbb',
    '...........bbbbbb',
  ],
  lunge: [
    '...tttttttttt..',
    '..ttttttNttttt.',
    '..ppp......ppp.',
    '.ppp.......ppp.',
    '.ppp........ppp',
    'bbb.........bbb',
    'bbb.........bbb',
    'bbb.........bbb',
    'bbbb.......bbbbb',
    'bbbbb......bbbbbb',
  ],
  crouch: [
    '..tttttttttt...',
    '.ttttttNttttt..',
    '.ppp......ppp..',
    'ppp.......ppp..',
    'bbb.......bbb..',
    'bbb.......bbb..',
    'bbbb.....bbbbb.',
    'bbbbb....bbbbbb',
  ],
  tuck: [
    '..tttttttttt...',
    '.ttttttNtttt...',
    '..pppppp.pppp..',
    '.....bbbbbbbbb.',
    '.....bbbbb.bbbb',
    '......bbbb.bbbb',
  ],
  // down on one knee (also her kneeling shot)
  kneel: [
    '..tttttttttt...',
    '.ttttttNttttt..',
    '..ppppppp..ppp.',
    'bbbppppp...ppp.',
    'bbbbbbbb...bbb.',
    '...........bbb.',
    '..........bbbbb',
  ],
};

export const VESPER_FIST = ['VV', 'vu'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.7, GREEN[4], GREEN[3]],
  [1, LEATHER[3], LEATHER[2]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.7, GREEN[3], GREEN[2]],
  [1, LEATHER[2], LEATHER[1]],
];

export const VESPER_RIG: Rig = {
  pal: VESPER_PAL,
  shades: VESPER_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 7,
  torsoX: -7,
  torsoOverlap: 1,
  headX: -1,
  headOverlap: 2,
  shoulderNear: [4, 2],
  shoulderFar: [9, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: VESPER_FIST,
  fistFar: VESPER_FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the cloak, the quiver, the tail

type Cloak = 'hang' | 'sway' | 'flow' | 'rise' | 'limp';
/** The cloak behind her from the shoulders: [rows, x, y] relative to the torso's top left (G/g the gold lining). */
const CLOAKS: Record<Cloak, [string[], number, number]> = {
  hang: [['...cc', '..ccc', '.cccg', '.cccg', 'ccccG', 'ccccG', 'ccccG', 'cccgG', 'cccgG', 'ccgG.', 'cgG..', '.g...'], -3, 2],
  sway: [['...cc', '..ccc', '.cccg', 'ccccg', 'ccccG', 'ccccG', 'ccccG', 'cccgG', 'ccgG.', 'cgG..', 'gG...'], -3, 2],
  flow: [['.......cc', '....ccccc', '..cccccgg', 'cccccgGG.', 'cccgGG...', '.cgG.....', '..g......'], -8, 2],
  rise: [['ggG......', 'cccgGG...', '.cccccgG.', '...ccccc.', '.....ccc.'], -7, 0],
  limp: [['..cc', '.ccc', '.ccg', 'cccg', 'cccG', 'cccG', 'ccgG', 'ccgG', 'cgG.', 'gG..'], -2, 3],
};
const cloak =
  (k: Cloak): Layer =>
  (g, a) => {
    const [rows, x, y] = CLOAKS[k];
    stamp(g, rows, { c: CLOAK[2], g: VESPER_GOLD[1], G: VESPER_GOLD[2] }, a.tx + x, a.ty + y);
    // shade the cloak's back edge and lower folds
    rows.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        if (ch !== 'c') return;
        const left = r[i - 1] === undefined || r[i - 1] === '.';
        const below = rows[j + 1]?.[i] === undefined || rows[j + 1][i] === '.';
        if (left) put(g, a.tx + x + i, a.ty + y + j, CLOAK[3]);
        else if (below || (i + j) % 5 === 0) put(g, a.tx + x + i, a.ty + y + j, CLOAK[1]);
      }),
    );
  };

/** The quiver on her back: a leather tube sloping down to the left, three white fletchings out of its mouth. */
const quiver: Layer = (g, a) => {
  const x0 = a.tx + 4;
  const y0 = a.ty - 1;
  for (let i = 0; i < 9; i++) {
    put(g, x0 - Math.floor(i / 2), y0 + i, LEATHER[3]);
    put(g, x0 - Math.floor(i / 2) - 1, y0 + i, LEATHER[2]);
    put(g, x0 - Math.floor(i / 2) - 2, y0 + i, LEATHER[1]);
  }
  for (const [dx, dy] of [
    [0, -2],
    [2, -3],
    [-2, -3],
  ]) {
    put(g, x0 + dx, y0 + dy, '#ffffff');
    put(g, x0 + dx, y0 + dy + 1, '#c8c4d8');
    put(g, x0 + dx + 1, y0 + dy, '#e0dcec');
  }
};

/** The hair's tail from the back of the head. */
const tail =
  (a0: number, curl: number, n = 8): Layer =>
  (g, a) =>
    ribbon(g, a.hx + 2, a.hy + 6, n, (t) => Math.PI * (a0 + curl * t), (t) => (t > 0.7 ? [HAIR[3], HAIR[1]] : [HAIR[4], HAIR[2], HAIR[0]]));

// ------------------------------------------------------------------ the bow and arrows

const ARROW_TIP = VESPER_SILVER[3];

/** The longbow's two tips and its curve, gripped at (x, y): `ang` tilts its axis (0 upright, + leaning forward). */
function bowCurve(x: number, y: number, ang: number, half = 11, bulge = 4): { pts: Pt[]; tips: [Pt, Pt]; fwd: Pt } {
  const ax = Math.sin(ang);
  const ay = -Math.cos(ang);
  const fx = Math.cos(ang);
  const fy = Math.sin(ang);
  const pts: Pt[] = [];
  for (let s = -1; s <= 1.0001; s += 0.02) {
    const px = x + 0.5 + ax * s * half - fx * bulge * s * s;
    const py = y + 0.5 + ay * s * half - fy * bulge * s * s;
    pts.push([px, py]);
  }
  return { pts, tips: [pts[0], pts[pts.length - 1]], fwd: [fx, fy] };
}

/** A line of single pixels from a to b. */
function line(g: Grid, a: Pt, b: Pt, col: string | ((t: number) => string)): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    put(g, Math.floor(a[0] + (b[0] - a[0]) * t), Math.floor(a[1] + (b[1] - a[1]) * t), typeof col === 'string' ? col : col(t));
  }
}

/** The bow at the far hand; with `drawTo` the string is pulled to that point (the near fist), else straight. */
function paintBow(g: Grid, x: number, y: number, ang: number, drawTo?: Pt, slack = 0): void {
  const { pts, tips, fwd } = bowCurve(x, y, ang);
  // the string first, so the limbs sit over its ends
  const str = '#e8e4f4';
  if (drawTo) {
    line(g, tips[0], [drawTo[0] + 0.5, drawTo[1] + 0.5], str);
    line(g, tips[1], [drawTo[0] + 0.5, drawTo[1] + 0.5], str);
  } else {
    const mid: Pt = [(tips[0][0] + tips[1][0]) / 2 - fwd[0] * slack, (tips[0][1] + tips[1][1]) / 2 - fwd[1] * slack];
    line(g, tips[0], mid, str);
    line(g, mid, tips[1], str);
  }
  // the limbs: 3 px through the middle tapering to 2 at the tips (they read at 8x), lit on the side facing the light,
  // a darker back
  pts.forEach(([px, py], i) => {
    const s = Math.abs(i / (pts.length - 1) - 0.5) * 2;
    if (s < 0.75) put(g, Math.floor(px - fwd[0] * 0.9), Math.floor(py - fwd[1] * 0.9), VESPER_SILVER[3]);
    put(g, Math.floor(px), Math.floor(py), VESPER_SILVER[2]);
    put(g, Math.floor(px + fwd[0] * 0.9 + 0.3), Math.floor(py + fwd[1] * 0.9), VESPER_SILVER[1]);
  });
  for (let k = 0; k < pts.length; k += 6) {
    const [px, py] = pts[k];
    if (Math.abs(k - pts.length / 2) > 18) put(g, Math.floor(px - 0.3), Math.floor(py), VESPER_SILVER[3]);
  }
  // gold nocks at the tips, the leather grip
  for (const [tx, ty] of tips) put(g, Math.floor(tx), Math.floor(ty), VESPER_GOLD[2]);
  for (const dy of [-1, 2]) {
    put(g, x, y + dy, LEATHER[2]);
    put(g, x + 1, y + dy, LEATHER[1]);
  }
}

/** An arrow from the nock (a) toward b: white fletching, a wooden shaft, a silver head. */
function arrow(g: Grid, a: Pt, b: Pt, glow = false): void {
  const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  const d: Pt = [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
  for (let i = 0; i <= n; i++) {
    const x = Math.round(a[0] + d[0] * i);
    const y = Math.round(a[1] + d[1] * i);
    put(g, x, y, i < 3 ? '#ffffff' : i >= n - 1 ? (glow ? '#fff0a0' : ARROW_TIP) : glow ? VESPER_GOLD[2] : '#b08050');
  }
  // the fletching's vanes and the head's barbs
  const px = -d[1];
  const py = d[0];
  for (const s of [1, -1]) {
    put(g, Math.round(a[0] + d[0] + px * s), Math.round(a[1] + d[1] + py * s), '#e0dcec');
    put(g, Math.round(b[0] - d[0] + px * s), Math.round(b[1] - d[1] + py * s), glow ? VESPER_GOLD[3] : VESPER_SILVER[2]);
  }
  if (glow) sparkle(g, Math.round(b[0] + d[0] * 2), Math.round(b[1] + d[1] * 2), VESPER_GOLD[3], '#ffffff', true);
}

type BowOpt = { ang?: number; drawn?: boolean; arrows?: number; glow?: boolean; slack?: number };
/** The bow (held in the far hand) and, when drawn, the string to the near fist and the nocked arrow(s); drawn as a
 *  front layer so the string sits under the drawing fingers. */
const bow =
  (o: BowOpt = {}): Layer =>
  (g, a) => {
    const ang = o.ang ?? 0;
    const [fx, fy] = a.far;
    const [nx, ny] = a.near;
    paintBow(g, fx, fy, ang, o.drawn ? [nx, ny] : undefined, o.slack ?? 0);
    stamp(g, VESPER_FIST, VESPER_PAL, fx, fy);
    if (o.drawn) {
      const n = o.arrows ?? 1;
      for (let k = 0; k < n; k++) {
        const spread = (k - (n - 1) / 2) * 0.09;
        const dx = fx - nx;
        const dy = fy - ny;
        const len = Math.hypot(dx, dy);
        const c = Math.cos(spread);
        const s = Math.sin(spread);
        const ux = (dx * c - dy * s) / len;
        const uy = (dx * s + dy * c) / len;
        arrow(g, [nx, ny], [Math.round(nx + ux * (len + 6)), Math.round(ny + uy * (len + 6))], o.glow);
      }
      stamp(g, VESPER_FIST, VESPER_PAL, nx, ny);
    }
  };

/** A loosed arrow streaking away with a trail. */
const loosed =
  (x: number, y: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    arrow(g, [X, Y], [X + 9, Y]);
    for (let k = 1; k <= 6; k++) if (k % 2) put(g, X - k * 2, Y, '#c8c4d8');
  };

/** The bow lying on the ground (knocked out). */
const droppedBow: Layer = (g, a) => paintBow(g, a.fx - 6, a.fy - 2, Math.PI / 2 + 0.05, undefined, 0);

// ------------------------------------------------------------------ poses

export const VESPER_POSES: Record<string, RigPose> = {
  idle0: { near: { at: [-1, 9] }, far: { at: [9, 12] }, farFront: true, back: [tail(0.7, 0.05), cloak('hang'), quiver], front: [bow()] },
  idle1: { near: { at: [-1, 8] }, far: { at: [9, 11] }, farFront: true, dy: 1, back: [tail(0.72, 0.08), cloak('sway'), quiver], front: [bow()] },
  // the cloak and the hair swing a frame behind the breath
  idle2: { near: { at: [-1, 8] }, far: { at: [9, 11] }, farFront: true, dy: 1, back: [tail(0.76, 0.1), cloak('sway'), quiver], front: [bow()] },
  idle3: { near: { at: [-1, 9] }, far: { at: [9, 12] }, farFront: true, back: [tail(0.74, 0.08), cloak('hang'), quiver], front: [bow()] },
  dash: {
    near: { at: [-6, 12] },
    far: { at: [9, 12] },
    farFront: true,
    legs: 'run',
    dx: 1,
    lean: 1,
    back: [tail(0.95, 0.02), cloak('flow'), quiver],
    front: [bow({ ang: 0.5 })],
  },
  // full draw: the string at her cheek, the arrow levelled
  slashA: {
    near: { at: [3, 21] },
    far: { at: [14, 20] },
    farFront: true,
    legs: 'lunge',
    head: 'aim',
    back: [tail(0.85, 0.05), cloak('sway'), quiver],
    front: [bow({ drawn: true })],
  },
  // the loose: the string snaps back, the arrow streaks away, the drawing hand flies open behind her
  slashB: {
    near: { at: [-4, 21] },
    far: { at: [14, 20] },
    farFront: true,
    legs: 'lunge',
    back: [tail(0.9, 0.05), cloak('flow'), quiver],
    front: [bow({ slack: 1 }), loosed(28, 21)],
  },
  // reaching over her shoulder for an arrow
  windup: {
    near: { at: [-4, 25] },
    far: { at: [10, 12] },
    farFront: true,
    armsUp: true,
    legs: 'crouch',
    dy: 1,
    back: [tail(0.7, 0.05), cloak('hang'), quiver, (g, a) => arrow(g, [a.near[0] + 1, a.near[1] + 1], [a.near[0] - 5, a.near[1] + 8])],
    front: [bow({ ang: 0.3 })],
  },
  // the bow braced crosswise in both hands
  parry: {
    near: { at: [5, 12] },
    far: { at: [12, 12] },
    farFront: true,
    legs: 'crouch',
    dy: 1,
    dx: -1,
    back: [tail(0.65, 0.05), cloak('hang'), quiver],
    front: [bow({ ang: 0.9 })],
  },
  hurt: {
    near: { at: [-6, 11] },
    far: { at: [6, 9] },
    farFront: true,
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
    back: [tail(0.4, -0.05), cloak('rise'), quiver],
    front: [bow({ ang: -0.4 })],
  },
  leap: {
    near: { at: [4, 18] },
    far: { at: [13, 16] },
    farFront: true,
    legs: 'tuck',
    head: 'aim',
    back: [tail(0.75, -0.2), cloak('rise'), quiver],
    front: [bow({ ang: 0.45, drawn: true })],
  },
  // knocked out: on one knee, head bowed, the bow fallen in the grass
  down: {
    near: { at: [8, 7] },
    far: { at: [4, 6] },
    legs: 'kneel',
    dy: 1,
    lean: 2,
    bow: 3,
    head: 'ko',
    back: [tail(0.6, 0.02), cloak('limp'), quiver, droppedBow],
  },
  // the finisher: drawing a volley of three arrows up at the sky
  fin: {
    near: { at: [7, 20] },
    far: { at: [15, 29] },
    farFront: true,
    legs: 'lunge',
    dx: -1,
    lean: -1,
    head: 'aim',
    back: [tail(0.8, 0.05), cloak('flow'), quiver],
    front: [bow({ ang: 0.78, drawn: true, arrows: 3 })],
  },
  // Piercing Shot: a kneeling shot with a glowing gold arrow
  cast: {
    near: { at: [3, 17] },
    far: { at: [14, 16] },
    farFront: true,
    legs: 'kneel',
    dy: 1,
    head: 'aim',
    back: [tail(0.8, 0.05), cloak('hang'), quiver],
    front: [bow({ drawn: true, glow: true })],
  },
};

/** Hero select card: the longbow at her side, the cloak drifting, before a dusk-purple glow with a gold heart. */
export const VESPER_CARD: HeroCardSpec = {
  pose: { near: { at: [-1, 9] }, far: { at: [9, 12] }, farFront: true, back: [tail(0.7, 0.05), cloak('sway'), quiver], front: [bow()] },
  glow: ['#fff0a0', '#7a58b0'],
  motes: [[5, 13], [34, 8], [35, 29]],
};

/** By the campfire (two breaths): the bow lowered, an arrow held up to check its fletching. */
export const VESPER_CAMP: [RigPose, RigPose] = [
  {
    near: { at: [8, 18] },
    far: { at: [9, 11] },
    farFront: true,
    back: [tail(0.7, 0.05), cloak('hang'), quiver],
    front: [bow({ ang: 0.15 }), (g, a) => arrow(g, [a.near[0] - 1, a.near[1] + 4], [a.near[0] + 3, a.near[1] - 6])],
  },
  {
    near: { at: [8, 17] },
    far: { at: [9, 10] },
    farFront: true,
    dy: 1,
    back: [tail(0.72, 0.08), cloak('sway'), quiver],
    front: [bow({ ang: 0.15 }), (g, a) => arrow(g, [a.near[0] - 1, a.near[1] + 4], [a.near[0] + 3, a.near[1] - 6])],
  },
];
