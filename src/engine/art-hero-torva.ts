// Torva, the hammer brute (see docs/content-bible.md section 3): a towering, muscular woman with a thick red braid
// and freckles, fur pauldrons over a leather harness, wrist wraps, tattoos on her arms and a giant stone-headed
// warhammer. Fight frames `torva_${pose}` on the shared rig (art-rig.ts).
import { put, type Pal, type Shade } from './art';
import { along, block, type Dir, dirAngle, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureLegs, pole, ribbon, type Rig, type RigPose, sparkle } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#6a3024', '#a8583a', '#d88a5a', '#f4b47c', '#ffd8a8'];
const HAIR = ['#4a1018', '#8a2020', '#c83a24', '#ec6a34', '#ffa060'];
const FUR = ['#3a3640', '#5e5866', '#8a8490', '#b8b2b8', '#e4e0dc'];
const LEATHER = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c', '#c08a58'];
const KILT = ['#24141a', '#3e2226', '#5e3630', '#82503c'];
const TROUSER = ['#1e1a2a', '#2e2a40', '#443e5a', '#5e5674'];
const WRAP = ['#7a6a5e', '#b8a890', '#ece0c8'];
export const TORVA_STONE = ['#2a2a3a', '#4a4858', '#6e6a74', '#96908e', '#c4bcae'];
const IRON: [string, string] = ['#7a7c90', '#34343e'];
const WOOD = ['#3a2014', '#6a4024', '#9a6438'];
const INK_TAT = '#2a5a7a';

export const TORVA_PAL: Pal = {
  // the face (painted by hand): skin tones, freckles, eyes, teeth
  z: SKIN[1], S: SKIN[3], T: SKIN[4], E: SKIN[2], f: '#b45a3a', k: '#140c1c', W: '#ffffff', g: '#3aa04a', x: '#5a1a1a',
  V: WRAP[2], v: WRAP[1], n: WRAP[0],
  H: HAIR[1], L: HAIR[4], U: FUR[1], o: INK_TAT, m: SKIN[1], Y: '#f2c230', y: '#9a5a14', N: LEATHER[0], Q: KILT[0],
};
export const TORVA_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, same: 'HL', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  s: { ramp: SKIN, same: 'om', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  u: { ramp: FUR, same: 'U', top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 },
  l: { ramp: LEATHER, same: 'NYy', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  q: { ramp: KILT, same: 'Q', top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
  p: { ramp: TROUSER, top: [3], left: [2], right: [1], bottom: [0], mid: 1 },
  b: { ramp: LEATHER, top: [3], left: [2], right: [1], bottom: [0], mid: 1 },
};

// ------------------------------------------------------------------ body

// (playtest round 8, L8, by hand: a fierce brute: red hair in braids, brows drawn down over one dark iris each, a
// blue war-paint stripe under the eyes, a set mouth, a strong jaw) 16 x 11.
const HEAD = [
  '...hhhhhhh......',
  '.hhhhHLHhhhhh...',
  'hhhHLHhhhhhhhhh.',
  'hhLHLhhhhhhhSSSh',
  'hHLHhhhSSHHSSHHS',
  'hLHhhhzSSSkSSSkS',
  'hHLhhzEzSooSSooS',
  'hhHhhzEzSSSSSSST',
  '.hhhhhzSSSSSSzzS',
  '..hhh.zzSSSxxxz.',
  '......zzzzSSSz..',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: eyes squeezed, teeth gritted
  squint: face(HEAD, { 4: 'SSHHSSHHS', 5: 'SSzzSSzzS', 9: 'SSxWWxz.' }),
  ko: face(HEAD, { 4: 'SSSSSSSSS', 5: 'SSzzSSzzS', 9: 'SSSxxSz.' }),
  // a battle roar: brows down hard, mouth wide open
  roar: face(HEAD, { 4: 'SHHHSHHH', 5: 'SSSkSSSkS', 8: 'SSSSSSzzS', 9: 'SSxxxxz.', 10: 'zzSxxSz..' }),
};

// The fur mantle over both shoulders, the leather top under the harness straps, the bare midriff, the belt.
const TORSO = [
  '.uuuuu.....uuu...',
  'uuuuuUussuuuuuu..',
  'uuuuUuuslsuUuuuu.',
  'uuuUuuulllsuuUuu.',
  '.uuuulNllNllluu..',
  '..sllNlllNllls...',
  '..sllNlllNllls...',
  '..sllNlllNllls...',
  '..sslllllllls....',
  '..ssssmsmsmss....',
  '..sssssmsmsss....',
  '..llllllYyllll...',
  '..llllllyyllll...',
];

// A leather kilt, dark trousers, fur-topped boots; 17 wide, the feet centred on x = 8.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'p', legBack: '8', boot: 'b', bootBack: '9', sole: '9', skirt: 'q', fold: 'Q' });

const FIST = ['VVv', 'Vvv', 'vvn'];
const ARM_PAL_NEAR: Array<[number, ...string[]]> = [
  [0.3, SKIN[4], SKIN[3], SKIN[2]],
  [0.45, SKIN[4], INK_TAT, SKIN[2]],
  [0.82, SKIN[4], SKIN[3], SKIN[2]],
  [1, WRAP[2], WRAP[1], WRAP[0]],
];
const ARM_PAL_FAR: Array<[number, ...string[]]> = [
  [0.3, SKIN[3], SKIN[2], SKIN[1]],
  [0.45, SKIN[3], INK_TAT, SKIN[1]],
  [0.82, SKIN[3], SKIN[2], SKIN[1]],
  [1, WRAP[1], WRAP[0], WRAP[0]],
];

export const TORVA_RIG: Rig = {
  pal: { ...TORVA_PAL, '8': TROUSER[1], '9': LEATHER[0] },
  shades: TORVA_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -8,
  torsoOverlap: 1,
  headX: 1,
  headOverlap: 1,
  shoulderNear: [4, 3],
  shoulderFar: [12, 3],
  armNear: { segs: ARM_PAL_NEAR },
  armFar: { segs: ARM_PAL_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [-1, -1],
};

// ------------------------------------------------------------------ the hammer

/** The warhammer at its grip: the haft runs `len` px to the stone head's centre, `back` px to the iron pommel. */
function hammer(dir: Dir, len: number, back: number): Item {
  return (g, x, y) => {
    pole(g, x, y, dir, len - 2, back, WOOD);
    const [px, py] = along(x, y, dir, -back - 1);
    put(g, px, py, IRON[0]);
    put(g, px + 1, py, IRON[1]);
    put(g, px, py + 1, IRON[1]);
    const [cx, cy] = along(x, y, dir, len);
    const diag = dir.length === 2;
    block(g, cx + 0.5, cy + 0.5, dirAngle(dir), diag ? 3.6 : 3.5, diag ? 6.2 : 5.5, TORVA_STONE, IRON, 2);
  };
}

// ------------------------------------------------------------------ the braid and effects

/** The thick braid from the nape: a 4px plait in alternating links, a leather tie, a flared tuft. */
function braid(a0: number, curl: number, wave: number, n = 15): Layer {
  return (g, a) =>
    ribbon(g, a.hx + 1, a.hy + 7, n, (t) => Math.PI * (a0 + curl * t + wave * Math.sin(t * Math.PI * 2)), (t, i) => {
      if (t > 0.88) return [HAIR[4], HAIR[3], HAIR[2]];
      if (t > 0.78) return [LEATHER[3], LEATHER[1]];
      if (i % 2 === 0) return [HAIR[4], HAIR[3], HAIR[2], HAIR[1]];
      return [HAIR[3], HAIR[2], HAIR[1], HAIR[0]];
    });
}

/** Dust kicked up where the hammer lands. */
const dust =
  (x: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy;
    for (const [dx, dy, c] of [
      [-6, -1, '#c8b494'],
      [-5, -2, '#e8d8b8'],
      [-7, -3, '#c8b494'],
      [6, -1, '#c8b494'],
      [7, -2, '#e8d8b8'],
      [8, -4, '#c8b494'],
      [-3, -5, '#e8d8b8'],
      [4, -6, '#e8d8b8'],
    ] as Array<[number, number, string]>)
      put(g, X + dx, Y + dy, c);
    // cracks in the ground
    for (let k = -4; k <= 4; k++) if (k !== 0) put(g, X + k, Y + (Math.abs(k) % 2), '#4a3020');
  };

/** Swoosh lines trailing a swing: arcs of pale pixels. */
const swoosh =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    for (const [rr, col] of [
      [r, '#ffffff'],
      [r - 1, '#c8dcf0'],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        const ang = a0 + (a1 - a0) * t;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

/** Rage: short strokes bursting out round her (the finisher and Wind-Up). */
const rage =
  (pts: Array<[number, number, number, number]>, col = '#ffb02a'): Layer =>
  (g, a) => {
    for (const [x, y, dx, dy] of pts) for (let k = 0; k < 3; k++) put(g, a.fx + x + dx * k, a.fy - y - dy * k, k === 0 ? '#fff0a0' : col);
  };

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const TORVA_POSES: Record<string, RigPose> = {
  // the hammer resting on her shoulder, its head behind her back
  idle0: P({ near: { at: [3, 21], item: hammer('ul', 13, 5), behind: true }, far: { at: [8, 16] }, back: [braid(0.62, 0.02, 0.03)] }),
  idle1: P({ near: { at: [3, 20], item: hammer('ul', 13, 5), behind: true }, far: { at: [8, 15] }, dy: 1, back: [braid(0.63, 0.02, -0.03)] }),
  // the braid swings a frame behind the breath, the hammer's weight settles on her shoulder
  idle2: P({ near: { at: [3, 20], item: hammer('ul', 13, 5), behind: true }, far: { at: [8, 15] }, dy: 1, back: [braid(0.66, 0.03, -0.06)] }),
  idle3: P({ near: { at: [3, 21], item: hammer('ul', 13, 5), behind: true }, far: { at: [8, 16] }, back: [braid(0.65, 0.03, 0)] }),
  dash: P({ near: { at: [3, 17], item: hammer('l', 14, 3), behind: true }, far: { at: [6, 18] }, legs: 'run', dx: 1, lean: 1, back: [braid(0.92, -0.06, 0.06)] }),
  // the overhead smash lands in front
  slashA: P({
    near: { at: [11, 20], item: hammer('dr', 9, 4) },
    far: { at: [13, 19] },
    legs: 'lunge',
    dx: 2,
    lean: 1,
    bow: 1,
    back: [braid(0.82, -0.1, 0.06)],
    front: [dust(21)],
  }),
  // a sweeping side swing, level with her chest
  slashB: P({
    near: { at: [11, 22], item: hammer('r', 13, 4) },
    far: { at: [13, 21] },
    legs: 'lunge',
    dx: 2,
    lean: 1,
    back: [braid(0.9, -0.05, 0.08), swoosh(10, 16, 13, 2.2, 0.9)],
  }),
  // the hammer heaved up behind her head
  windup: P({
    near: { at: [-1, 30], item: hammer('ul', 9, 3), behind: true },
    far: { at: [1, 29], hidden: true },
    legs: 'crouch',
    dy: 1,
    armsUp: true,
    head: 'roar',
    back: [braid(0.6, 0.05, 0.03)],
  }),
  // the haft held crosswise in both fists
  parry: P({
    near: { at: [4, 20], item: hammer('r', 15, 3) },
    far: { at: [14, 20] },
    legs: 'crouch',
    dy: 1,
    farFront: true,
    back: [braid(0.62, 0.02, 0.03)],
  }),
  hurt: P({
    near: { at: [-4, 16], item: hammer('dl', 9, 3), behind: true },
    far: { at: [8, 22] },
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
    back: [braid(0.35, -0.1, 0.06)],
  }),
  leap: P({ near: { at: [5, 32], item: hammer('u', 9, 4) }, far: { at: [7, 31], hidden: true }, legs: 'tuck', armsUp: true, back: [braid(0.75, -0.25, 0.04)] }),
  // knocked out: on one knee, sagging on the hammer stood head-down in front of her
  down: P({
    near: { at: [10, 15], item: hammer('d', 11, 2) },
    far: { at: [12, 14] },
    farFront: true,
    legs: 'kneel',
    dy: 1,
    lean: 2,
    bow: 2,
    head: 'ko',
    back: [braid(0.56, -0.02, 0.01)],
  }),
  // the finisher: the hammer hoisted straight overhead in both fists
  fin: P({
    near: { at: [3, 34], item: hammer('u', 6, 4) },
    far: { at: [5, 34], hidden: true },
    legs: 'lunge',
    armsUp: true,
    head: 'roar',
    back: [braid(0.7, -0.08, 0.06)],
    front: [rage([[-10, 32, -1, 1], [16, 32, 1, 1], [-12, 24, -1, 0], [18, 24, 1, 0]])],
  }),
  // Wind-Up: the hammer planted, a fist raised in a flex, roaring
  cast: P({
    near: { at: [-10, 30] },
    far: { at: [11, 16], item: hammer('d', 6, 6) },
    farFront: true,
    head: 'roar',
    back: [braid(0.62, 0.02, 0.03)],
    front: [rage([[-14, 30, -1, 1], [16, 32, 1, 1], [18, 24, 1, 0], [-15, 22, -1, 0]]), (g, a) => sparkle(g, a.fx - 9, a.fy - 29, '#ffb02a')],
  }),
};

/** Hero select card: the hammer on her shoulder and a grin, before an ember-red glow with an orange heart. */
export const TORVA_CARD: HeroCardSpec = {
  pose: { near: { at: [3, 21], item: hammer('ul', 13, 5), behind: true }, far: { at: [8, 16] }, back: [braid(0.62, 0.02, 0.03)] },
  glow: ['#ffc070', '#b02a20'],
  motes: [[5, 14], [34, 10], [34, 30]],
};

/** By the campfire (two breaths): the hammer stood head-down, both fists stacked on the end of its haft. */
export const TORVA_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [9, 22], item: hammer('d', 12, 1) }, far: { at: [10, 23] }, farFront: true, back: [braid(0.62, 0.02, 0.03)] }),
  P({ near: { at: [9, 21], item: hammer('d', 11, 1) }, far: { at: [10, 22] }, farFront: true, dy: 1, back: [braid(0.63, 0.02, -0.03)] }),
];
