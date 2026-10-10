// Tam, the sapper (see docs/content-bible.md section 3): short and wiry, brass goggles pushed up on a sooty
// forehead, an orange bandana, a leather apron full of pockets, rolled sleeves, and a satchel of round black kegs
// with fizzing fuses. Fight frames `tam_${pose}` on the shared rig (art-rig.ts), and the UI's `keg_icon`.
import { grid, put, stamp, toCanvas, type Grid, type Pal, type Shade } from './art';
import { ell, fill, sphere } from './art-paint';
import { type HeroCardSpec, type Layer, LEG_FEET_X, matureLegs, type Rig, type RigPose, sparkle } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#6a3424', '#a8603e', '#d8925e', '#f4c08a', '#ffe0b8'];
export const TAM_ORANGE = ['#5a1a10', '#a03a14', '#e0661c', '#ff9a3a', '#ffcc78'];
const BRASS = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const SHIRT = ['#5a5250', '#8a807a', '#beb4a8', '#e8e0d0'];
const APRON = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c', '#c08a58'];
const TROUSER = ['#1c1a22', '#2e2c36', '#46444e', '#625e66'];
const HAIR = ['#1e120e', '#3a2418', '#5a3a24', '#7a5034'];
export const KEG = ['#0e0c12', '#1e1c28', '#34323e', '#585664', '#8a889a'];
const HOOP = ['#5a3a24', '#9a7050'];
export const FUSE = '#c8b090';
export const SPARK = ['#f27a1c', '#ffb02a', '#fff0a0'];

export const TAM_PAL: Pal = {
  // face (by hand): skin, soot, eyes, grin
  z: SKIN[1], s: SKIN[2], S: SKIN[3], T: SKIN[4], E: SKIN[2], m: '#7a5a50', M: '#4a3a40', k: '#140c1c', W: '#ffffff', i: '#4a3020', x: '#5a1a1a',
  // goggles: brass rims, green-glass lenses
  B: BRASS[3], b: BRASS[2], q: BRASS[1], G: '#c8fff0', g: '#5ac8b4', n: '#2a7a70',
  O: TAM_ORANGE[1], H: HAIR[1], A: APRON[1], l: APRON[3], L: APRON[1], Y: BRASS[3],
  // skin fists
  F: SKIN[3], f: SKIN[2], u: SKIN[1],
};
export const TAM_SHADES: Record<string, Shade> = {
  o: { ramp: TAM_ORANGE, same: 'O', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  h: { ramp: HAIR, same: 'H', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  w: { ramp: SHIRT, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  a: { ramp: APRON, same: 'AlLY', top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
  p: { ramp: TROUSER, top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
  d: { ramp: APRON, top: [3], left: [2], right: [1], bottom: [0], mid: 1 },
};

// ------------------------------------------------------------------ body

// The bandana knotted at the back, the goggles up on the forehead, messy hair, a soot-smudged cheeky grin.
const HEAD = [
  '.....oooooo.....',
  '...oooooooooo...',
  '..ooooooooooooo.',
  'O.ooooooooqbbqbbq',
  'OOoooooooqbGgbGgb',
  '.Ooooooooqbgnbgnb',
  '.hhhhhhhhhqbbmbbS',
  'hhhhhhhzSSSmSSSSS',
  'hhhhhzEzSSkkSSkkS',
  '.hhhhzEzSSWiSSWiS',
  '.hhhhhzSmSSSSSSST',
  '..hhh.zzSSxxxxxz.',
  '.......zzSSSSSz..',
].map((r) => r.slice(0, 16));
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSkkSSkk', 11: 'SSxWxz.' }),
  // knocked out: blackened with soot, eyes crossed out
  ko: face(HEAD, { 7: 'MSSmMSMSS', 8: 'SmkSmSkSm', 9: 'SSmkSSmkS', 10: 'SmSSMSSST', 11: 'zSSxSz.' }),
  // goggles pulled down over the eyes (bracing for a blast)
  goggles: face(HEAD, { 3: 'oooooooooooooo', 4: 'ooooooooooooo', 5: 'ooooooooooo', 6: 'hhhhhhhSSSS', 7: 'zqbbqbbqb', 8: 'zqbGgbGgb', 9: 'zqbgnbgnb', 10: 'zSqbbqbbq', 11: 'zzSSxxxz.' }),
};

// The shirt with the satchel's strap across it, the leather apron's bib with its pockets.
const TORSO = [
  '..wwwwwwwww..',
  '.wwwwLwwwwww.',
  '.wwwwwLaaaaw.',
  '.wwwwwaLaaaw.',
  '..wwwaaaLaaa.',
  '..wwwaaaLaaa.',
  '..wwwaaaLaaa.',
  '..wwaalYaaLa.',
  '..wwaAAaaAAa.',
  '..wwaaaaaaaa.',
];

// The apron to the knees over sooty trousers, stout boots; 13 wide, the feet centred on x = 6.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'p', legBack: '8', boot: 'd', bootBack: '9', sole: '9', skirt: 'a', fold: 'A' });

const FIST = ['FF', 'fu'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.45, SHIRT[3], SHIRT[2]],
  [1, SKIN[3], SKIN[2]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.45, SHIRT[2], SHIRT[1]],
  [1, SKIN[2], SKIN[1]],
];

export const TAM_RIG: Rig = {
  pal: { ...TAM_PAL, '8': TROUSER[1], '9': APRON[0] },
  shades: TAM_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -6,
  torsoOverlap: 1,
  headX: -2,
  headOverlap: 1,
  shoulderNear: [4, 2],
  shoulderFar: [9, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ kegs

/** A round black keg centred on (cx, cy), radius `r`, two hoops round it and a fuse out of its top; `lit` adds a
 *  fizzing spark at the fuse's end. */
export function keg(g: Grid, cx: number, cy: number, r = 3.5, lit = true): void {
  const body = ell(cx, cy, r, r);
  fill(g, body, sphere(KEG, cx - r * 0.45, cy - r * 0.5, r * 1.25, r * 1.25, 0.02));
  // hoops
  for (const dy of [-Math.round(r * 0.45), Math.round(r * 0.45)]) {
    const y = Math.floor(cy + dy);
    for (let x = Math.floor(cx - r); x <= cx + r; x++) if (body(x, y)) put(g, x, y, x < cx - 0.5 ? HOOP[1] : HOOP[0]);
  }
  // a glint
  put(g, Math.floor(cx - r * 0.45), Math.floor(cy - r * 0.6), KEG[4]);
  // the fuse
  const fx = Math.floor(cx + r * 0.3);
  const fy = Math.floor(cy - r);
  put(g, fx, fy, FUSE);
  put(g, fx + 1, fy - 1, FUSE);
  if (lit) {
    put(g, fx + 2, fy - 2, SPARK[2]);
    put(g, fx + 3, fy - 2, SPARK[1]);
    put(g, fx + 2, fy - 3, SPARK[1]);
    put(g, fx + 3, fy - 3, SPARK[0]);
    put(g, fx + 1, fy - 3, SPARK[0]);
  }
}

/** A keg at a point relative to the feet. */
const kegAt =
  (x: number, y: number, r = 3.5, lit = true): Layer =>
  (g, a) =>
    keg(g, a.fx + x, a.fy - y, r, lit);

/** A keg in a hand: centred just past the fist. */
const kegHeld =
  (hand: 'near' | 'far', dx = 2, dy = 0, r = 3.5): Layer =>
  (g, a) => {
    const [x, y] = a[hand];
    keg(g, x + 1 + dx, y + dy, r);
    stamp(g, FIST, TAM_PAL, x, y);
  };

/** An unlit keg in a hand (at camp). */
const kegCold =
  (hand: 'near' | 'far', dx = 2, dy = 0): Layer =>
  (g, a) => {
    const [x, y] = a[hand];
    keg(g, x + 1 + dx, y + dy, 3.5, false);
    stamp(g, FIST, TAM_PAL, x, y);
  };

/** The satchel on her hip at the back, two kegs peeking out. */
const satchel: Layer = (g, a) => {
  const x = a.tx - 3;
  const y = a.ty + 6;
  keg(g, x + 2, y - 1, 2.2, false);
  keg(g, x + 5, y - 2, 2.2, false);
  stamp(
    g,
    ['llllllL', 'lllllLL', 'lAAAALL', 'llllLLL', '.LLLLL.'],
    { l: APRON[3], L: APRON[1], A: APRON[2] },
    x,
    y,
  );
};

/** A trail of sparks behind a flying keg. */
const trail =
  (pts: Array<[number, number]>): Layer =>
  (g, a) =>
    pts.forEach(([x, y], i) => put(g, a.fx + x, a.fy - y, SPARK[i % 2 ? 0 : 1]));

/** A soft cloud of smoke: overlapping puffs [x, y, r] shaded as one form (lit along its top and left edges). */
const puffs =
  (pts: Array<[number, number, number]>): Layer =>
  (g, a) => {
    const inside = (x: number, y: number) => pts.some(([px, py, r]) => (x + 0.5 - (a.fx + px)) ** 2 + (y + 0.5 - (a.fy - py)) ** 2 <= r * r);
    const SM = ['#7a7480', '#a49ea8', '#ccc6cc', '#eeeae8'];
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[0].length; x++) {
        if (!inside(x, y)) continue;
        let c = SM[2];
        if (!inside(x, y + 1) || !inside(x + 1, y + 1)) c = SM[0];
        else if (!inside(x + 1, y) || !inside(x, y + 2)) c = SM[1];
        else if (!inside(x, y - 1) || !inside(x - 1, y)) c = SM[3];
        put(g, x, y, c);
      }
  };

/** A match flaring in the near hand (Fuse Up). */
const match: Layer = (g, a) => {
  const [x, y] = a.near;
  put(g, x + 2, y - 1, '#e0c8a0');
  put(g, x + 3, y - 2, '#e0c8a0');
  sparkle(g, x + 4, y - 4, SPARK[1], SPARK[2], true);
  stamp(g, FIST, TAM_PAL, x, y);
};

// ------------------------------------------------------------------ poses

export const TAM_POSES: Record<string, RigPose> = {
  idle0: { near: { at: [8, 17] }, far: { at: [3, 16] }, back: [satchel], front: [kegHeld('near')] },
  // tossing the keg an inch and catching it
  idle1: { near: { at: [8, 17] }, far: { at: [3, 15] }, dy: 1, back: [satchel], front: [kegHeld('near', 2, -2)] },
  // the keg drops back into the hand a frame behind the breath
  idle2: { near: { at: [8, 16] }, far: { at: [3, 15] }, dy: 1, back: [satchel], front: [kegHeld('near', 2, 1)] },
  idle3: { near: { at: [8, 17] }, far: { at: [3, 16] }, back: [satchel], front: [kegHeld('near', 2, 1)] },
  dash: { near: { at: [5, 18] }, far: { at: [-6, 19] }, legs: 'run', dx: 1, lean: 1, back: [satchel], front: [kegHeld('near', 1, 0)] },
  // a sidearm toss: the keg just leaving the hand
  slashA: { near: { at: [11, 20] }, far: { at: [-4, 18] }, legs: 'lunge', dx: 1, lean: 1, back: [satchel], front: [kegAt(17, 14), trail([[12, 12], [13, 14]])] },
  // an overhand lob: following through low, the keg arcing high ahead
  slashB: {
    near: { at: [10, 15] },
    far: { at: [-5, 21] },
    legs: 'lunge',
    dx: 2,
    lean: 2,
    bow: 1,
    back: [satchel],
    front: [kegAt(20, 23), trail([[13, 15], [14, 18], [16, 20]])],
  },
  windup: { near: { at: [-6, 27] }, far: { at: [10, 22] }, legs: 'crouch', armsUp: true, back: [satchel, kegHeld('near', -2, -1)] },
  // goggles down, arms up over the face, braced for the blast
  parry: { near: { at: [7, 24] }, far: { at: [9, 26] }, legs: 'crouch', dy: 1, head: 'goggles', farFront: true, back: [satchel] },
  hurt: { near: { at: [-5, 19] }, far: { at: [8, 23] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [satchel], front: [puffs([[13, 17, 2.6], [16, 19, 2.4], [14, 21, 2]])] },
  leap: { near: { at: [0, 34] }, far: { at: [5, 33] }, legs: 'tuck', armsUp: true, back: [satchel], front: [kegAt(3, 26), (g, a) => stamp(g, FIST, TAM_PAL, a.near[0], a.near[1]), (g, a) => stamp(g, FIST, TAM_PAL, a.far[0], a.far[1])] },
  // knocked out: sat down hard, sooty, smoke curling up, the keg rolled off unlit
  down: {
    near: { at: [8, 3] },
    far: { at: [-4, 3] },
    legs: 'kneel',
    lean: 1,
    bow: 2,
    head: 'ko',
    back: [satchel],
    front: [kegAt(16, 3, 3, false), puffs([[2, 25, 2.2], [4, 27, 2], [3, 30, 1.6], [5, 32, 1.2]])],
  },
  // the finisher: a big keg heaved overhead in both hands
  fin: {
    near: { at: [1, 31] },
    far: { at: [6, 31] },
    legs: 'lunge',
    dx: -1,
    armsUp: true,
    back: [satchel],
    front: [kegAt(4, 27, 5.5), (g, a) => stamp(g, FIST, TAM_PAL, a.near[0], a.near[1]), (g, a) => stamp(g, FIST, TAM_PAL, a.far[0], a.far[1])],
  },
  // Fuse Up: striking a match to a fresh keg's fuse
  cast: { near: { at: [6, 24] }, far: { at: [10, 20] }, farFront: true, back: [satchel], front: [kegHeld('far', 1, 0), match] },
};

/** Hero select card: a lit keg held up with a grin, before an orange glow with a warm yellow heart. */
export const TAM_CARD: HeroCardSpec = {
  pose: { near: { at: [9, 21] }, far: { at: [3, 16] }, back: [satchel], front: [kegHeld('near', 1, -1)] },
  glow: ['#ffe070', '#e0661c'],
  motes: [[5, 14], [34, 10], [34, 29]],
};

// ------------------------------------------------------------------ the keg icon (UI)

/** `keg_icon`: a 9x9 (outline included) round black keg with two hoops and a lit orange fuse, for the UI. */
const KEG_ICON = [
  '......o..',
  '.....oWo.',
  '....f.o..',
  '..1f21...',
  '.123221..',
  '.hHHhh1..',
  '.122111..',
  '..1111...',
  '.........',
];
export function kegIcon(): HTMLCanvasElement {
  const g = grid(9, 9);
  stamp(g, KEG_ICON, { 1: '#3a384a', 2: '#5a586e', 3: '#9a98b0', h: '#8a6a48', H: '#c8a070', f: FUSE, W: '#fff8d0', o: SPARK[1] }, 0, 0);
  return toCanvas(g);
}

/** By the campfire (two breaths): turning a cold keg over in one hand, the other on a hip. */
export const TAM_CAMP: [RigPose, RigPose] = [
  { near: { at: [8, 17] }, far: { at: [3, 16] }, back: [satchel], front: [kegCold('near', 2, 0)] },
  { near: { at: [8, 16] }, far: { at: [3, 15] }, dy: 1, back: [satchel], front: [kegCold('near', 2, -1)] },
];
