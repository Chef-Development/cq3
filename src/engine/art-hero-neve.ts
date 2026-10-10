// Neve, the frost mage (see docs/content-bible.md section 3): a pale-blue robe with white fur trim, a deep-navy
// sash, silver hair in a long braid, frost-white boots, and a staff topped by a floating ice crystal. Fight frames
// `neve_${pose}` on the shared rig (art-rig.ts).
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { along, LEG_FEET_X, matureLegs, pole, ribbon, sparkle, type Dir, type HeroCardSpec, type Item, type Layer, type Rig, type RigPose } from './art-rig';

// ------------------------------------------------------------------ palette

const ROBE = ['#26306a', '#3a5aa0', '#5a8ad0', '#8ab8ec', '#c0e2fa'];
const FUR = ['#6a7aa8', '#a8b8dc', '#dce8fa', '#ffffff'];
const HAIR = ['#464a74', '#7a84ae', '#aeb8da', '#dce4f6', '#ffffff'];
const SASH = ['#0c1030', '#18245a', '#2a3c88', '#4058b0'];
const BOOT = ['#4a5a8a', '#94a6d0', '#d4e2f8', '#ffffff'];
export const NEVE_ICE = ['#1866a8', '#28a4e4', '#6ad8fa', '#c4f6ff', '#ffffff'];
const STAFF = ['#2e2850', '#5a5490', '#948ccc'];

export const NEVE_PAL: Pal = {
  // skin (pale), eyes, blush
  z: '#b86a5a', s: '#e8a888', S: '#fcd0b0', T: '#fff0e0', k: '#140c1c', i: '#3ab8f0', j: '#1a6ab0', W: '#ffffff', p: '#f49aa0',
  H: HAIR[1], L: HAIR[4], R: ROBE[1], N: SASH[0], m: SASH[3],
  // ice
  C: NEVE_ICE[0], D: NEVE_ICE[1], E: NEVE_ICE[2], F: NEVE_ICE[3],
  // silver
  a: '#8a94b4', A: '#dce4f4',
};
export const NEVE_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, same: 'HL', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  r: { ramp: ROBE, same: 'R', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  w: { ramp: FUR, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  n: { ramp: SASH, same: 'Nm', top: [3], left: [2], right: [0], bottom: [0], mid: 1 },
  b: { ramp: BOOT, top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// Silver hair swept back into the braid (a layer), a pale face in profile with a defined brow and two small dark eyes
// (no glossy whites, no blush: playtest round 8, L8), 13 x 11 on a body about three heads tall.
const HEAD = [
  '...hhhhhhh...',
  '.hhhhLLhhhhh.',
  'hhhhLhhhhhHhh',
  'hhhLhhhhhHhhh',
  'hhhhhhhhHhhhh',
  'hhhhhhhHHsHHh',
  'hhhhhhhsjSSjS',
  'hhhhhhhsSSSST',
  'hhhhhhhzSSzzS',
  '.hhhhhhhzSSS.',
  '..hhh..hzz...',
];
const swapRow = (rows: string[], y: number, row: string) => rows.map((r, i) => (i === y ? row : r));
const HEADS = {
  base: HEAD,
  // eyes squeezed shut
  squint: swapRow(swapRow(HEAD, 6, 'hhhhhhhszSSzS'), 8, 'hhhhhhhzSzkzS'),
  // knocked out: eyes closed, head hung
  ko: swapRow(HEAD, 6, 'hhhhhhhszSSzS'),
  // casting: the brow drawn down in focus
  focus: swapRow(HEAD, 5, 'hhhhhhhHHHHHh'),
};

const TORSO = [
  '...wwwwwww...',
  '..wwwwwwwww..',
  '.rrrrwwwrrrr.',
  'rrrrrrwrrrrrr',
  'rrrrrrRrrrrrr',
  'rrrrrrRrrrrrr',
  '.rrrrrRrrrrr.',
  '.rrrrrRrrrrr.',
  '.nnnnnnnnnnn.',
  '..rrrrrNmrr..',
  '..rrrrrNmrr..',
];

// The robe falls to the shins over frost-white boots (the shared joints, art-rig.ts), its folds in shadow, the fur at
// its hem; the back leg a value darker.
const LEGS = matureLegs({ leg: 'b', legBack: 'n', boot: 'b', bootBack: 'n', sole: 'N', skirt: 'r', fold: 'R', hem: 'w', robe: 4, bootRows: 4 });

const SKIN_FIST = ['SS', 'sz'];

export const NEVE_RIG: Rig = {
  pal: NEVE_PAL,
  shades: NEVE_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -6,
  torsoOverlap: 1,
  headX: 0,
  headOverlap: 1,
  shoulderNear: [4, 2],
  shoulderFar: [9, 2],
  armNear: { segs: [[0.7, ROBE[3], ROBE[2]], [1, FUR[3], FUR[1]]] },
  armFar: { segs: [[0.7, ROBE[2], ROBE[1]], [1, FUR[2], FUR[0]]] },
  fistNear: SKIN_FIST,
  fistFar: SKIN_FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the staff and its crystal

const CRYSTAL = ['..W..', '.FWE.', '.FED.', 'FEEDC', 'FEDDC', '.EDC.', '.DC..', '..C..'];
const CRYSTAL_BIG = [
  '....W....',
  '...FWE...',
  '...FWED..',
  '..FWEED..',
  '..FEEDDC.',
  '.FWEEDDC.',
  'FFEEEDDCC',
  '.FEEDDDC.',
  '..EEDDC..',
  '..EDDC...',
  '...DC....',
  '...C.....',
];
const DIM: Pal = { W: '#a8c8e0', F: '#7aa0c8', E: '#4a78a8', D: '#2e5288', C: '#1e3466' };

/** The crystal centred on (cx, cy), drawn upright whatever the staff's angle; a cyan glint beside it when lit. */
export function crystal(g: Grid, cx: number, cy: number, o: { big?: boolean; dim?: boolean; glint?: boolean } = {}): void {
  const m = o.big ? CRYSTAL_BIG : CRYSTAL;
  const pal = o.dim ? DIM : NEVE_PAL;
  stamp(g, m, pal, cx - Math.floor(m[0].length / 2), cy - Math.floor(m.length / 2));
  if (o.glint && !o.dim) sparkle(g, cx + (o.big ? 6 : 4), cy - (o.big ? 5 : 4), NEVE_ICE[2]);
}

/** The staff held at its grip: `len` px toward the crystal, `back` px to its foot; the crystal floats `gap` px past
 *  the silver cap. `bob` lifts the crystal (idle). */
function staff(dir: Dir, len: number, back: number, o: { gap?: number; big?: boolean; dim?: boolean; glint?: boolean; bob?: number } = {}): Item {
  return (g, x, y) => {
    pole(g, x, y, dir, len, back, STAFF);
    const [ex, ey] = along(x, y, dir, len);
    // the silver cap
    put(g, ex, ey, NEVE_PAL.A);
    put(g, ex + 1, ey, NEVE_PAL.a);
    put(g, ex, ey + 1, NEVE_PAL.a);
    const gap = (o.gap ?? 5) + (o.big ? 2 : 0);
    const diag = dir.length === 2 ? 0.75 : 1;
    const [cx, cy] = along(ex, ey, dir, Math.round(gap * diag));
    crystal(g, cx, cy - (o.bob ?? 0), o);
  };
}

// ------------------------------------------------------------------ the braid

/** The braid from the nape: a 3px plait woven in alternating lit and shaded links, a navy tie, a pale tuft. */
function braid(a0: number, curl: number, wave: number, n = 13): Layer {
  return (g, a) =>
    ribbon(g, a.hx + 1, a.hy + 8, n, (t) => Math.PI * (a0 + curl * t + wave * Math.sin(t * Math.PI * 2)), (t, i) => {
      if (t > 0.9) return [HAIR[4], HAIR[2]];
      if (t > 0.78) return [SASH[3], SASH[1]];
      const thin = t > 0.55;
      if (i % 2 === 0) return thin ? [HAIR[4], HAIR[2]] : [HAIR[4], HAIR[3], HAIR[1]];
      return thin ? [HAIR[2], HAIR[0]] : [HAIR[3], HAIR[2], HAIR[0]];
    });
}

// ------------------------------------------------------------------ spell effects

/** A frost bolt: an ice shard flying right with a trail of flakes. */
const shard =
  (x: number, y: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    stamp(g, ['....FW.', 'aFEEEDW', 'EDDDDC.', '....C..'], { ...NEVE_PAL, a: NEVE_ICE[3] }, X, Y - 1);
    for (const [dx, dy, c] of [
      [-3, 0, NEVE_ICE[2]],
      [-5, -1, NEVE_ICE[3]],
      [-7, 1, NEVE_ICE[2]],
      [-9, 0, NEVE_ICE[3]],
    ] as Array<[number, number, string]>)
      put(g, X + dx, Y + dy, c);
  };

/** A burst of frost: a six-armed flake with a white heart. */
const flake =
  (x: number, y: number, r = 3): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    for (let k = 1; k <= r; k++) {
      const c = k === r ? NEVE_ICE[2] : NEVE_ICE[3];
      put(g, X, Y - k, c);
      put(g, X, Y + k, c);
      put(g, X + k, Y - Math.round(k / 2), c);
      put(g, X - k, Y - Math.round(k / 2), c);
      put(g, X + k, Y + Math.round(k / 2), c);
      put(g, X - k, Y + Math.round(k / 2), c);
    }
    if (r >= 3) {
      // little barbs near the tips
      put(g, X - 1, Y - r + 1, NEVE_ICE[2]);
      put(g, X + 1, Y - r + 1, NEVE_ICE[2]);
      put(g, X - 1, Y + r - 1, NEVE_ICE[2]);
      put(g, X + 1, Y + r - 1, NEVE_ICE[2]);
    }
    put(g, X, Y, '#ffffff');
  };

/** An ice wall: a column of faceted blocks in front of her (the parry). */
const iceWall =
  (x: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const rows = [
      '.FW.',
      'FWED',
      'FEED',
      'FEDC',
      'FEDC',
      'WEDC',
      'FEDC',
      'FEDC',
      'FDDC',
      'FEDC',
      'FEDC',
      'WEDC',
      'FEDC',
      'FDDC',
      'FEDC',
      'EDDC',
      'EDCC',
      '.DC.',
    ];
    stamp(g, rows, NEVE_PAL, X, a.fy - rows.length - 6);
    sparkle(g, X + 1, a.fy - rows.length - 4, NEVE_ICE[3]);
  };

/** Frost motes drifting round a point. */
const motes =
  (pts: Array<[number, number]>, col = NEVE_ICE[3]): Layer =>
  (g, a) => {
    for (const [x, y] of pts) put(g, a.fx + x, a.fy - y, col);
  };

const spikes: Layer = (g, a) => {
  // ice spikes bursting from the raised crystal
  const cx = a.fx + 9;
  const cy = a.fy - 39;
  for (const [dx, dy, n] of [
    [-1, 0, 4],
    [1, 0, 4],
    [-1, -1, 3],
    [1, -1, 3],
    [-1, 1, 2],
    [1, 1, 2],
  ]) {
    for (let k = 0; k < n; k++) put(g, cx + dx * (6 + k), cy + dy * (4 + k), k === n - 1 ? NEVE_ICE[4] : NEVE_ICE[2]);
  }
};

/** The staff lying in the snow behind her (knocked out; the crystal lies dark in front). */
const droppedStaff: Layer = (g, a) => {
  pole(g, a.fx - 17, a.fy - 1, 'r', 17, 0, STAFF);
};

// ------------------------------------------------------------------ poses

export const NEVE_POSES: Record<string, RigPose> = {
  idle0: { near: { at: [9, 15], item: staff('u', 17, 15) }, far: { at: [11, 17] }, back: [braid(0.62, 0.02, 0.03)] },
  idle1: { near: { at: [9, 14], item: staff('u', 17, 14, { bob: 1 }) }, far: { at: [11, 16] }, dy: 1, back: [braid(0.63, 0.02, -0.03)] },
  // the braid swings on a frame behind the breath, the crystal bobs a little higher
  idle2: { near: { at: [9, 14], item: staff('u', 17, 14, { bob: 2 }) }, far: { at: [11, 16] }, dy: 1, back: [braid(0.66, 0.03, -0.06)] },
  idle3: { near: { at: [9, 15], item: staff('u', 17, 15, { bob: 1 }) }, far: { at: [11, 17] }, back: [braid(0.65, 0.03, 0)] },
  dash: {
    near: { at: [6, 17], item: staff('ur', 12, 8) },
    far: { at: [-6, 17] },
    legs: 'run',
    dx: 1,
    lean: 1,
    back: [braid(0.88, 0.1, 0.1, 14)],
  },
  // casting a frost bolt: the staff levelled at the foe
  slashA: {
    near: { at: [10, 20], item: staff('r', 10, 6, { gap: 4, glint: true }) },
    far: { at: [5, 17] },
    legs: 'lunge',
    dx: 1,
    lean: 1,
    head: 'focus',
    back: [braid(0.85, 0.05, 0.08, 14)],
    front: [shard(34, 21)],
  },
  // a burst of frost from the open hand, the staff held back
  slashB: {
    near: { at: [2, 16], item: staff('u', 16, 15) },
    far: { at: [14, 21] },
    legs: 'lunge',
    dx: 1,
    lean: 1,
    head: 'focus',
    back: [braid(0.8, 0.05, -0.08, 14)],
    front: [flake(20, 22, 3), motes([[17, 25], [24, 19], [25, 25], [18, 18]])],
  },
  windup: {
    near: { at: [-4, 25], item: staff('ul', 9, 6, { glint: true }) },
    far: { at: [10, 17] },
    legs: 'crouch',
    dy: 1,
    head: 'focus',
    armsUp: true,
    back: [braid(0.7, -0.05, 0.05)],
  },
  // the staff held crosswise and a wall of ice thrown up in front
  parry: {
    near: { at: [3, 19], item: staff('r', 11, 3, { gap: 4 }) },
    far: { at: [12, 19] },
    legs: 'crouch',
    dy: 1,
    farFront: true,
    back: [braid(0.6, -0.05, 0.03)],
    front: [iceWall(20)],
  },
  hurt: {
    near: { at: [-3, 17], item: staff('ul', 12, 7) },
    far: { at: [8, 21] },
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
    back: [braid(0.3, -0.1, 0.06)],
  },
  leap: {
    near: { at: [7, 23], item: staff('u', 12, 9, { glint: true }) },
    far: { at: [11, 21] },
    legs: 'tuck',
    back: [braid(0.75, -0.25, 0.04)],
  },
  // knocked out: slumped forward on her knees, a hand on the ground, the staff fallen and its crystal gone dark
  down: {
    near: { at: [10, 2] },
    far: { at: [4, 3] },
    legs: 'kneel',
    dy: 2,
    lean: 3,
    bow: 3,
    head: 'ko',
    back: [braid(0.5, 0.05, 0.01, 12), droppedStaff],
    front: [(g, a) => crystal(g, a.fx + 15, a.fy - 3, { dim: true })],
  },
  // the finisher: the staff raised high in both hands, the crystal grown huge and bristling with ice
  fin: {
    near: { at: [9, 26], item: staff('u', 6, 9, { big: true, gap: 3 }) },
    far: { at: [10, 25] },
    legs: 'lunge',
    armsUp: true,
    head: 'focus',
    back: [braid(0.7, -0.08, 0.06, 14)],
    front: [spikes, motes([[-1, 32], [19, 31], [2, 40], [16, 44]], NEVE_ICE[3])],
  },
  // Chill: the staff planted, a snowflake spinning over the raised palm
  cast: {
    near: { at: [6, 15], item: staff('u', 17, 15, { glint: true }) },
    far: { at: [13, 26] },
    head: 'focus',
    back: [braid(0.55, -0.05, 0.04)],
    front: [flake(15, 33, 4), motes([[10, 37], [20, 36], [19, 28], [11, 30]])],
  },
};

/** Hero select card: the staff held up, the crystal glinting, a flake over the open hand, before an ice-blue glow
 *  with a cyan heart. */
export const NEVE_CARD: HeroCardSpec = {
  pose: {
    near: { at: [8, 16], item: staff('u', 16, 16, { glint: true }) },
    far: { at: [12, 20] },
    farFront: true,
    head: 'base',
    back: [braid(0.62, 0.02, 0.03)],
    front: [flake(15, 25, 2)],
  },
  glow: ['#c4f6ff', '#4a7ac0'],
  motes: [[5, 13], [34, 8], [35, 30]],
};

/** By the campfire (two breaths): the staff planted, a hand held out to the warmth. */
export const NEVE_CAMP: [RigPose, RigPose] = [
  { near: { at: [5, 15], item: staff('u', 17, 15) }, far: { at: [12, 19] }, farFront: true, back: [braid(0.62, 0.02, 0.03)] },
  { near: { at: [5, 14], item: staff('u', 17, 14, { bob: 1 }) }, far: { at: [12, 18] }, farFront: true, dy: 1, back: [braid(0.63, 0.02, -0.03)] },
];
