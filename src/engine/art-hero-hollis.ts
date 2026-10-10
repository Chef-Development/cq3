// Hollis, the shieldwarden (see docs/content-bible.md section 3): a tall, broad man with dark brown skin and a short
// black beard, steel plate over royal-blue cloth, a huge blue tower shield with a white tower on it and a short
// broad sword. Fight frames `hollis_${pose}` on the shared rig (art-rig.ts). The shield is held out in front on the
// far arm, so most poses draw the far hand in front of the body.
import { put, stamp, type Pal, type Shade } from './art';
import { dir8, sparkle, stampAt, type Dir, type HeroCardSpec, type Item, type Layer, type Rig, type RigPose, type Sprite } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#2a1410', '#4a2618', '#6e3e26', '#925a38', '#b47a50'];
const BLACK = ['#0e0a14', '#1e1824', '#2e2834', '#463e4c', '#5e5464'];
export const HOLLIS_STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
export const HOLLIS_BLUE = ['#10204a', '#1a3c8a', '#2a5ac0', '#4a84e0', '#8ab8f4'];
const LEATHER = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c'];

export const HOLLIS_PAL: Pal = {
  // face (painted by hand)
  z: SKIN[1], s: SKIN[2], S: SKIN[3], T: SKIN[4], E: SKIN[2], k: '#140c1c', W: '#f4ece4', x: '#2a0c10',
  // shield: steel rim (R lit, r mid, q dark), blue field (B lit, b mid, n dark), white tower (W lit, w shade, o door)
  R: HOLLIS_STEEL[3], r: HOLLIS_STEEL[2], q: HOLLIS_STEEL[1], B: HOLLIS_BLUE[3], b: HOLLIS_BLUE[2], n: HOLLIS_BLUE[1],
  V: '#ffffff', v: '#c8d4e8', o: HOLLIS_BLUE[0], O: HOLLIS_STEEL[4],
  // sword: steel (A lit edge, L body, C shaded edge, T tip), brass guard, leather grip
  A: '#eef3fa', L: '#b8c2d8', C: '#6a7496', t: '#ffffff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', P: '#f2c230', h: '#4e2c1c', H: '#8a5a30',
  M: HOLLIS_STEEL[1], N: HOLLIS_BLUE[1], K: LEATHER[0], X: '#f2c230',
};
export const HOLLIS_SHADES: Record<string, Shade> = {
  a: { ramp: BLACK, top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 }, // hair
  d: { ramp: BLACK, top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // beard
  m: { ramp: HOLLIS_STEEL, same: 'M', top: [4, 3], left: [3], right: [1], bottom: [0, 1], mid: 2 },
  c: { ramp: HOLLIS_BLUE, same: 'NVv', top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
  l: { ramp: LEATHER, same: 'X', top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

const HEAD = [
  '.....aaaaaa.....',
  '...aaaaaaaaaa...',
  '..aaaaaaaaaaaa..',
  '.aaaaaaaaaaaaaS.',
  '.aaaaaaaaaaSSSS.',
  'aaaaaaaSSSSSSSSS',
  'aaaaazSSSSkkSSkk',
  'aaaazEzSSSWkSSWk',
  '.sssEEzSSSSSSSST',
  '.zsszzSSSSSSSSzS',
  '..zddddddsxxxdd.',
  '...ddddddddddd..',
  '.....ddddddd....',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 6: 'SSSSSSSSSS', 7: 'SSSkkSSkk', 10: 'dsxWxdd.' }),
  ko: face(HEAD, { 6: 'SSSSSSSSSS', 7: 'SSSSSSSSS', 8: 'SSSkkSSkT', 10: 'ddsxxdd.' }),
  // a shout behind the shield
  shout: face(HEAD, { 6: 'SSSSSkSSSk', 7: 'SSSkWSSkW', 10: 'dsxxxxd.', 11: 'ddddxxdd..' }),
};

// Steel pauldrons and gorget over a royal-blue surcoat, a white band down its front, a leather belt.
const TORSO = [
  '.mmmmm.....mmmm...',
  'mmmmmmmMMMmmmmmm..',
  'mmmmmmmmmmmmmmmmm.',
  'mmmmmmccVccmmmmmm.',
  '.mmmmcccVcccmmmm..',
  '..cccccVvcccccc...',
  '..ccccccVcccccc...',
  '..ccccccVvccccc...',
  '..llllllXXllllll..',
  '..ccccccVcccccc...',
];

// The surcoat's skirt over steel greaves and sabatons; 17 wide, the feet centred on x = 8.
const LEGS: Record<string, string[]> = {
  stand: [
    '..cccccccVccccc..',
    '..ccccccVvcccccc.',
    '.cccccccVccccccc.',
    '...mmmm...mmmm...',
    '...mmmm...mmmm...',
    '...mMmm...mMmm...',
    '...mmmm...mmmm...',
    '...mmmm...mmmm...',
    '..mmmmmm.mmmmmm..',
    '..mmmmmmm.mmmmmmm',
  ],
  run: [
    '...ccccccVcccccc.',
    '..cccccccVvccccc.',
    '.ccccccccVcccccc.',
    'mmm.......mmmm...',
    'mm.........mmmm..',
    'mm..........mmmm.',
    '............mmmm.',
    '............mmmm.',
    '...........mmmmmm',
    '...........mmmmmmm',
  ],
  lunge: [
    '...ccccccVcccccc.',
    '..cccccccVvcccccc',
    '.ccccccccVccccccc',
    '.mmm.......mmmm..',
    'mmm.........mmmm.',
    'mmm.........mmmm.',
    'mmm.........mmmm.',
    'mmm.........mmmm.',
    'mmmm.......mmmmmm',
    'mmmmm......mmmmmmm',
  ],
  crouch: [
    '..cccccccVccccc..',
    '.ccccccccVvcccccc',
    '.mmmm.......mmmm.',
    'mmmm........mmmm.',
    'mmmm........mmmm.',
    'mmmmm......mmmmmm',
    'mmmmmm.....mmmmmmm',
  ],
  tuck: [
    '..cccccccVccccc..',
    '.ccccccccVvccccc.',
    '..mmmmmmm.mmmmm..',
    '.....mmmmm.mmmm..',
    '.....mmmmmmmmmmm.',
    '......mmmmm.mmmm.',
  ],
  kneel: [
    '..cccccccVccccc..',
    '.ccccccccVvcccccc',
    '..mmmmmm....mmmm.',
    'mmmmmmmmm...mmmm.',
    'mmmmmmmmm..mmmmmm',
    '...........mmmmmm',
  ],
};

const GAUNTLET = ['RRr', 'Rrq', 'rqq'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.75, HOLLIS_STEEL[4], HOLLIS_STEEL[3], HOLLIS_STEEL[2]],
  [1, HOLLIS_STEEL[3], HOLLIS_STEEL[2], HOLLIS_STEEL[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [[1, HOLLIS_STEEL[3], HOLLIS_STEEL[2], HOLLIS_STEEL[1]]];

export const HOLLIS_RIG: Rig = {
  pal: HOLLIS_PAL,
  shades: HOLLIS_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 8,
  torsoX: -9,
  torsoOverlap: 1,
  headX: 1,
  headOverlap: 1,
  shoulderNear: [4, 3],
  shoulderFar: [12, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: GAUNTLET,
  fistFar: GAUNTLET,
  fistAt: [-1, -1],
};

// ------------------------------------------------------------------ the shield and the sword

const SHIELD = [
  '...RRRRRRRr...',
  '.RRRBBBBBBrrr.',
  'RRBBBbbbbbbbrq',
  'RBBbbbbbbbbbnq',
  'RBbbbVbVbVbbnq',
  'RBbbbVVVVVbbnq',
  'RBbbbbVVVvbbnq',
  'RBbbbbVVVvbbnq',
  'RBbbbbVoVvbbnq',
  'RBbbbbVoVvbbnq',
  'RBbbbVVVVVvbnq',
  'RBbbbbbbbbbbnq',
  'RBbbbbbbbbbbnq',
  'RBbbbbbbbbbbnq',
  'RBbbbbbbbbbbnq',
  'RBbbbbbbbbbnnq',
  'Rrbbbbbbbbnnqq',
  '.rrnnnnnnnnqq.',
  '...rqqqqqqq...',
];
/** The tower shield face-on, its grip at the middle; `glow` rings it in blue light (Brace). */
export function shieldAt(g: (string | null)[][], x: number, y: number, glow = false): void {
  const ox = x - 7;
  const oy = y - 9;
  if (glow) {
    for (let j = -2; j < SHIELD.length + 2; j++)
      for (let i = -2; i < 16; i++) {
        const inS = (ii: number, jj: number) => SHIELD[jj]?.[ii] !== undefined && SHIELD[jj][ii] !== '.';
        if (inS(i, j)) continue;
        let near = false;
        for (let dj = -2; dj <= 2 && !near; dj++) for (let di = -2; di <= 2 && !near; di++) if (Math.abs(di) + Math.abs(dj) <= 2 && inS(i + di, j + dj)) near = true;
        if (near && (i + j) % 2 === 0) put(g, ox + i, oy + j, (i + j) % 4 === 0 ? '#9ad8ff' : '#4aa0f0');
      }
  }
  stamp(g, SHIELD, HOLLIS_PAL, ox, oy);
}
const shield =
  (glow = false): Item =>
  (g, x, y) =>
    shieldAt(g, x, y, glow);

const SWORD_R: Sprite = { rows: ['...G........', '...gAAAAAAA.', 'PhHgLLLLLLLAt', '...yCCCCCCCA.', '...Y........'], grip: [1, 2] };
const SWORD_UR: Sprite = {
  rows: ['.........t', '........AA', '.......ALC', '......ALC.', '.....ALC..', '....ALC...', '..GALC....', '...gY.....', '..H..y....', '.h........', 'P.........'],
  grip: [2, 8],
};
const sword =
  (dir: Dir): Item =>
  (g, x, y) =>
    stampAt(g, dir8(SWORD_R, SWORD_UR, dir), HOLLIS_PAL, x, y);

// ------------------------------------------------------------------ effects

/** A shockwave where the shield strikes the ground: blue arcs and flying grit. */
const slam =
  (x: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy;
    for (const [r, c] of [
      [9, '#4aa0f0'],
      [12, '#9ad8ff'],
    ] as Array<[number, string]>)
      for (let t = 0; t <= Math.PI; t += 0.05) {
        const px = Math.round(X + Math.cos(t) * r);
        const py = Math.round(Y - Math.sin(t) * r * 0.4);
        if (Math.abs(px - X) > 6) put(g, px, py, c);
      }
    for (const [dx, dy] of [
      [-9, 6],
      [10, 7],
      [-12, 3],
      [13, 4],
    ])
      put(g, X + dx, Y - dy, '#c8b494');
  };

const glint =
  (x: number, y: number): Layer =>
  (g, a) =>
    sparkle(g, a.fx + x, a.fy - y, HOLLIS_STEEL[3]);

/** The sword lying on the ground (knocked out). */
const droppedSword: Layer = (g, a) => stampAt(g, SWORD_R, HOLLIS_PAL, a.fx - 15, a.fy - 1);

// ------------------------------------------------------------------ poses

export const HOLLIS_POSES: Record<string, RigPose> = {
  idle0: { near: { at: [-4, 11], item: sword('u') }, far: { at: [11, 10], item: shield(), over: true }, farFront: true },
  idle1: { near: { at: [-4, 10], item: sword('u') }, far: { at: [11, 9], item: shield(), over: true }, farFront: true, dy: 1 },
  // the sword and shield settle a frame behind the breath
  idle2: { near: { at: [-4, 9], item: sword('u') }, far: { at: [11, 8], item: shield(), over: true }, farFront: true, dy: 1 },
  idle3: { near: { at: [-4, 10], item: sword('u') }, far: { at: [11, 9], item: shield(), over: true }, farFront: true },
  // charging behind the shield
  dash: { near: { at: [-6, 12], item: sword('l') }, far: { at: [13, 12], item: shield(), over: true }, farFront: true, legs: 'run', dx: 1, lean: 1 },
  // a thrust over the top of the shield
  slashA: {
    near: { at: [12, 21], item: sword('r') },
    far: { at: [12, 9], item: shield(), over: true },
    farFront: true,
    legs: 'lunge',
    dx: 1,
    lean: 1,
    head: 'shout',
  },
  // a shield bash
  slashB: {
    near: { at: [-6, 13], item: sword('l') },
    far: { at: [15, 13], item: shield(), over: true },
    farFront: true,
    legs: 'lunge',
    dx: 2,
    lean: 1,
    head: 'shout',
    front: [glint(23, 22), glint(22, 6)],
  },
  windup: {
    near: { at: [-3, 23], item: sword('ul') },
    far: { at: [13, 9], item: shield(), over: true },
    farFront: true,
    armsUp: true,
    legs: 'crouch',
    dy: 1,
  },
  // hunkered down behind the raised shield
  parry: {
    near: { at: [5, 13], hidden: true },
    far: { at: [12, 11], item: shield(), over: true },
    farFront: true,
    legs: 'crouch',
    dy: 2,
    front: [glint(4, 23)],
  },
  hurt: {
    near: { at: [-6, 12], item: sword('dl') },
    far: { at: [11, 12], item: shield(), over: true },
    farFront: true,
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
  },
  leap: {
    near: { at: [2, 24], item: sword('u') },
    far: { at: [12, 11], item: shield(), over: true },
    farFront: true,
    armsUp: true,
    legs: 'tuck',
  },
  // knocked out: on one knee, slumped on the planted shield, the sword dropped
  down: {
    near: { at: [6, 12] },
    far: { at: [12, 9], item: shield(), over: true },
    farFront: true,
    legs: 'kneel',
    dy: 2,
    lean: 2,
    bow: 3,
    head: 'ko',
    back: [droppedSword],
  },
  // the finisher: the shield slammed edge-first into the ground, a shockwave rolling out
  fin: {
    near: { at: [-5, 20], item: sword('ul') },
    far: { at: [15, 7], item: shield(), over: true },
    farFront: true,
    armsUp: true,
    legs: 'lunge',
    dx: 2,
    lean: 2,
    bow: 1,
    head: 'shout',
    front: [slam(15)],
  },
  // Brace: the shield planted, glowing blue, the sword held upright behind it
  cast: {
    near: { at: [-4, 12], item: sword('u') },
    far: { at: [12, 9], item: shield(true), over: true },
    farFront: true,
    legs: 'crouch',
    dy: 1,
    head: 'shout',
  },
};

/** Hero select card: the sword raised behind the tower shield, before a royal-blue glow with a pale heart. */
export const HOLLIS_CARD: HeroCardSpec = {
  pose: { near: { at: [-4, 14], item: sword('u') }, far: { at: [10, 10], item: shield(), over: true }, farFront: true },
  glow: ['#e0f6ff', '#2a5ac0'],
  motes: [[5, 12], [34, 9], [35, 30]],
};

/** By the campfire (two breaths): the tower shield stood on the ground, both hands resting on its rim. */
export const HOLLIS_CAMP: [RigPose, RigPose] = [
  { near: { at: [5, 19] }, far: { at: [8, 10], item: shield(), over: true, hidden: true }, farFront: true },
  { near: { at: [5, 19] }, far: { at: [8, 10], item: shield(), over: true, hidden: true }, farFront: true, dy: 1 },
];
