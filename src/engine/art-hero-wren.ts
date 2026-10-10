// Wren, the rooftop runner (round 7; docs/content-bible.md section 3): a small, quick street runner in a charcoal
// hood, a long mustard scarf, bandaged hands, soft boots, a grappling hook on a coil of rope at her hip and a single
// curved knife. Palette: charcoal greys, mustard yellow, brick red. Fight frames `wren_${pose}` on the shared rig
// (art-rig.ts), her hero card, camp sprite, portrait (`portrait_wren`) and map walker (WREN_WALKER, art-hero-map.ts).
// She is drawn a head shorter than the knights: short legs, a small torso, a big hood.
import { grid, put, stamp, toCanvas, type Grid, type Pal, type Shade } from './art';
import { and, bez, ell, fill, or, rimShade, sphere } from './art-paint';
import { type Dir, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureLegs, ribbon, type Rig, type RigPose, sparkle, type Sprite, stampAt } from './art-rig';
import { daggerMap } from './art-sword';

// ------------------------------------------------------------------ palette

const CHAR = ['#16141c', '#26232e', '#3a3644', '#575264', '#7c7688'];
export const WREN_MUSTARD = ['#5a3a0c', '#9a6a14', '#d0a024', '#ecc848', '#fff08a'];
export const WREN_BRICK = ['#3a140e', '#6a2416', '#9a3a22', '#c45a34', '#e88a5a'];
const SKIN = ['#6a3a2a', '#a8664a', '#d89a74', '#f4c8a0', '#ffe4c8'];
const BANDAGE = ['#7e7262', '#bcb09c', '#ece4d4'];
const LEATHER = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c'];
const STEEL = ['#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const ROPE = ['#6e5030', '#a88050', '#d8b47a'];
/** Her smoke (Smoke Pop): soft greys. */
export const WREN_SMOKE = ['#4a4656', '#7a7688', '#aaa6b8', '#dcd8e6'];

export const WREN_PAL: Pal = {
  // the face (by hand): skin, eyes (hazel), a grin
  z: SKIN[1], s: SKIN[2], S: SKIN[3], T: SKIN[4], E: SKIN[2], k: '#140c1c', W: '#ffffff', e: '#5a8a3a', x: '#5a1a1a', f: '#c07050',
  // the hood's lit lip, the brick-red fringe
  O: CHAR[4], r: WREN_BRICK[2], R: WREN_BRICK[3],
  // the belt and its buckle
  n: LEATHER[1], N: LEATHER[2], B: WREN_MUSTARD[3],
  // bandaged hands
  V: BANDAGE[2], v: BANDAGE[1], u: BANDAGE[0],
};
export const WREN_SHADES: Record<string, Shade> = {
  o: { ramp: CHAR, same: 'O', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  m: { ramp: WREN_MUSTARD, top: [4, 3], left: [3], right: [1], bottom: [0, 1], mid: 2 },
  j: { ramp: CHAR, same: 'nNB', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  t: { ramp: WREN_BRICK, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  b: { ramp: CHAR, top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// The charcoal hood, its tip falling back behind her head, a lit lip over the brow; a brick-red fringe; a cheeky
// face with bright eyes and a grin.
// (playtest round 8, L8, by hand: the charcoal hood, a brick-red fringe falling over one brow, one dark iris each
// under the lids, a sly half-smile, a pointed chin) 15 x 10.
const HEAD = [
  '.....oooooo....',
  '.ooooooooooooOO',
  'oooooooooRrRrrO',
  'oooooooRrrSkkSk',
  '.ooooozSSSSkSSk',
  '.oooozESSSSSSSS',
  '..ooozESSSSSSST',
  '..oooozSSSSSSzS',
  '...oooozSSSxzS.',
  '.....ooozzSz...',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 15 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 3: 'SkkSk', 4: 'SSzzSzz', 8: 'SSxWxS.' }),
  ko: face(HEAD, { 3: 'SSSSS', 4: 'SSzzSzz', 8: 'SSSxSS.' }),
  // a grin with the tongue out, eyes narrowed (her tricks)
  sly: face(HEAD, { 3: 'SkkSk', 4: 'SSSzkSzk', 8: 'SxxxxS.' }),
};

// The mustard scarf wound thick round her neck (its knot at the front), a charcoal jacket, a belt with a brass
// buckle; 13 wide.
const TORSO = [
  '..mmmmmmmmm..',
  '.mmmmmmmmmmm.',
  '.jjjjjjjmmmj.',
  '.jjjjjjjjmmj.',
  '.jjjjjjjjjmj.',
  '.jjjjjjjjjmj.',
  '.jjjjjjjjjmj.',
  '..jjjjjjjjj..',
  '..nnnnNBnnn..',
  '..jjjj.jjjj..',
];

// Brick-red trousers, soft charcoal boots; 15 wide, the feet centred on x = 7.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 't', legBack: '8', boot: 'b', bootBack: '9', sole: '9' });

const FIST = ['VV', 'vu'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.7, CHAR[4], CHAR[3]],
  [1, BANDAGE[2], BANDAGE[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.7, CHAR[3], CHAR[2]],
  [1, BANDAGE[1], BANDAGE[0]],
];

export const WREN_RIG: Rig = {
  pal: { ...WREN_PAL, '8': WREN_BRICK[1], '9': CHAR[0] },
  shades: WREN_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -6,
  torsoOverlap: 1,
  headX: -1,
  headOverlap: 2,
  shoulderNear: [3, 2],
  shoulderFar: [9, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the knife

// One curved knife: a wrapped grip, a small brass guard, a 3 px blade sweeping up to its point (art-sword.ts's dagger,
// so it reads at 8x).
const KNIFE_PAL: Pal = {
  h: LEATHER[1], H: LEATHER[3], P: WREN_MUSTARD[2], G: WREN_MUSTARD[4], g: WREN_MUSTARD[3], y: WREN_MUSTARD[1],
  A: STEEL[3], L: STEEL[2], C: STEEL[0], T: '#ffffff',
};
const KNIFE_R: Sprite = daggerMap('r', 7);
const knife =
  (dir: Dir): Item =>
  (g, x, y) =>
    stampAt(g, daggerMap(dir, 7), KNIFE_PAL, x, y);

// ------------------------------------------------------------------ the scarf, the hook, the smoke

/** The scarf's two tails from the back of her neck (a long one and a short one under it): 2px mustard bands that
 *  flutter (a wave runs along them), lit along their top edge, a fold every few steps, a brick-red fringe at the end.
 *  [a0, curl, wave]: the angle at the knot (x PI; 1 = straight back), how far it bends along the tail, the flutter. */
function scarf(a0: number, curl: number, wave: number, n = 15): Layer {
  const one = (g: Grid, x: number, y: number, len: number, b0: number, ph: number) =>
    ribbon(g, x, y, len, (t) => Math.PI * (b0 + curl * t + wave * 3 * t * Math.sin(t * Math.PI * 2.4 + ph)), (t, i) => {
      if (t > 0.84) return i % 2 ? [WREN_BRICK[3]] : [WREN_BRICK[2], WREN_BRICK[1]];
      return i % 4 === 2 ? [WREN_MUSTARD[2], WREN_MUSTARD[1]] : [WREN_MUSTARD[i < 3 ? 4 : 3], WREN_MUSTARD[2]];
    });
  return (g, a) => {
    one(g, a.tx + 3, a.ty + 2, Math.round(n * 0.6), a0 - 0.1, 1.6);
    one(g, a.tx + 3, a.ty + 1, n, a0, 0);
  };
}

/** The grappling hook on its coil of rope at her hip (the back hip, behind the belt). */
const hook: Layer = (g, a) => {
  const X = a.tx + 1;
  const Y = a.ty + 6;
  // the coil: a small ring of rope
  for (const [dx, dy, c] of [
    [1, 0, 2],
    [2, 0, 2],
    [0, 1, 1],
    [3, 1, 1],
    [0, 2, 1],
    [3, 2, 0],
    [1, 3, 0],
    [2, 3, 0],
  ] as Array<[number, number, number]>)
    put(g, X + dx, Y + dy, ROPE[c]);
  // the iron hook hanging under it: a shank and two prongs
  put(g, X + 1, Y + 4, STEEL[1]);
  put(g, X + 1, Y + 5, STEEL[2]);
  put(g, X, Y + 6, STEEL[3]);
  put(g, X + 2, Y + 6, STEEL[1]);
  put(g, X - 1, Y + 5, STEEL[2]);
  put(g, X + 3, Y + 5, STEEL[0]);
};

/** A puff of smoke: a few overlapping grey balls (Smoke Pop's throw, the dodge's afterimage). */
const puff =
  (x: number, y: number, r = 3): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    for (const [cx, cy, rr] of [
      [0, 0, r],
      [-r + 1, 1, r - 1],
      [r - 1, 1, r - 1],
    ] as Array<[number, number, number]>)
      for (let j = -rr; j <= rr; j++)
        for (let i = -rr; i <= rr; i++) {
          if (i * i + j * j > rr * rr + 0.5) continue;
          put(g, X + cx + i, Y + cy + j, i + j < -rr * 0.6 ? WREN_SMOKE[3] : i + j > rr * 0.6 ? WREN_SMOKE[1] : WREN_SMOKE[2]);
        }
  };

/** A swish of air behind the knife. */
const swish =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    for (const [rr, col] of [
      [r, '#ffffff'],
      [r - 1, WREN_MUSTARD[4]],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        const ang = a0 + (a1 - a0) * t;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

/** Speed lines above her as she drops (Rooftop Drop). */
const drop: Layer = (g, a) => {
  for (const [x, y, n] of [
    [-4, 34, 5],
    [3, 37, 6],
    [10, 33, 4],
  ] as Array<[number, number, number]>)
    for (let k = 0; k < n; k++) put(g, a.fx + x, a.fy - y - k, k < 2 ? '#ffffff' : WREN_SMOKE[3]);
};

const droppedKnife: Layer = (g, a) => stampAt(g, KNIFE_R, KNIFE_PAL, a.fx - 13, a.fy - 1);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const WREN_POSES: Record<string, RigPose> = {
  // light on her feet: the knife low and forward, the free hand up, the scarf tail drifting
  idle0: P({ near: { at: [7, 16], item: knife('ur') }, far: { at: [10, 20] }, back: [scarf(0.74, 0.1, 0.04), hook] }),
  idle1: P({ near: { at: [7, 15], item: knife('ur') }, far: { at: [10, 19] }, dy: 1, back: [scarf(0.72, 0.12, -0.04), hook] }),
  // the scarf's tails flutter a frame behind the breath
  idle2: P({ near: { at: [7, 15], item: knife('ur') }, far: { at: [10, 19] }, dy: 1, back: [scarf(0.7, 0.14, -0.07), hook] }),
  idle3: P({ near: { at: [7, 16], item: knife('ur') }, far: { at: [10, 20] }, back: [scarf(0.72, 0.12, 0), hook] }),
  dash: P({ near: { at: [-5, 17], item: knife('l') }, far: { at: [7, 18] }, legs: 'run', dx: 1, lean: 1, back: [scarf(0.98, -0.02, 0.04, 17), hook] }),
  // a rising cut
  slashA: P({ near: { at: [11, 21], item: knife('dr') }, far: { at: [4, 20] }, legs: 'lunge', dx: 2, lean: 1, back: [scarf(0.95, -0.03, 0.05, 16), hook], front: [swish(8, 13, 10, 1.6, -0.4)] }),
  // a quick thrust
  slashB: P({ near: { at: [12, 20], item: knife('r') }, far: { at: [4, 21] }, legs: 'lunge', dx: 2, lean: 1, head: 'sly', back: [scarf(0.97, -0.02, 0.06, 16), hook, swish(6, 12, 11, 2.5, 0.6)] }),
  windup: P({ near: { at: [-3, 26], item: knife('ul') }, far: { at: [8, 19] }, legs: 'crouch', dy: 1, back: [scarf(0.84, 0.06, 0.03), hook] }),
  // the knife up crosswise, ducking under
  parry: P({ near: { at: [8, 19], item: knife('u') }, far: { at: [10, 21] }, farFront: true, legs: 'crouch', dy: 1, back: [scarf(0.8, 0.08, 0.02), hook] }),
  hurt: P({ near: { at: [-4, 17], item: knife('dl') }, far: { at: [7, 21] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [scarf(0.6, -0.1, 0.05), hook] }),
  leap: P({ near: { at: [11, 20], item: knife('ur') }, far: { at: [3, 25] }, legs: 'tuck', back: [scarf(0.72, -0.2, 0.04, 16), hook] }),
  down: P({ near: { at: [6, 9] }, far: { at: [9, 8] }, farFront: true, legs: 'kneel', dy: 2, lean: 2, bow: 2, head: 'ko', back: [scarf(0.52, -0.02, 0.01, 12), hook, droppedKnife] }),
  // Rooftop Drop: dropping onto the foe, knife point-down in both hands, the scarf streaming up behind
  fin: P({ near: { at: [8, 20], item: knife('d') }, far: { at: [9, 21], hidden: true }, legs: 'tuck', dy: -2, head: 'sly', back: [scarf(1.25, 0.1, 0.05, 16), hook], front: [drop] }),
  // Smoke Pop: a smoke ball tossed from the free hand
  cast: P({ near: { at: [5, 16], item: knife('r') }, far: { at: [11, 26] }, farFront: true, head: 'sly', back: [scarf(0.86, 0.06, 0.03), hook], front: [puff(15, 22, 3), (g, a) => sparkle(g, a.fx + 18, a.fy - 26, WREN_SMOKE[3])] }),
};

/** Hero select card: the knife up, the scarf flying, before a moonlit-grey glow with a mustard heart. */
export const WREN_CARD: HeroCardSpec = {
  pose: { near: { at: [7, 17], item: knife('ur') }, far: { at: [10, 21] }, head: 'sly', back: [scarf(0.92, -0.04, 0.05, 17), hook] },
  glow: ['#fff08a', '#5a5470'],
  motes: [[5, 14], [34, 10], [34, 30]],
};

/** By the campfire (two breaths): tossing the knife from hand to hand. */
export const WREN_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [6, 17], item: knife('u') }, far: { at: [9, 16] }, back: [scarf(0.6, 0.02, 0.02, 13), hook] }),
  P({ near: { at: [6, 16] }, far: { at: [9, 17], item: knife('u') }, dy: 1, back: [scarf(0.62, 0.02, -0.02, 13), hook] }),
];

// ------------------------------------------------------------------ the map walker (art-hero-map.ts draws it)

/** At map scale: the charcoal hood, the mustard scarf and its tail, the brick trousers, the knife. */
export const WREN_WALKER = {
  pal: {
    o: '#3a3644', O: '#7c7688', r: '#9a3a22', S: '#f4c8a0', s: '#d89a74', k: '#140c1c', m: '#ecc848', M: '#d0a024', j: '#3a3644',
    J: '#575264', V: '#ece4d4', t: '#9a3a22', T: '#6a2416', b: '#3a3644', B: '#26232e', A: '#b8c2d8',
  } as Pal,
  top: [
    '...........',
    '...........',
    '...ooooo...',
    '..ooooooO..',
    '..oorSkSk..',
    '..ooSSSSs..',
    '.MmmmmmmmA.',
    '..jJJjjjV..',
    '..jjjjjjj..',
    '..ttttttt..',
  ],
  legs: {
    stand: ['...tt.tt...', '..bbB.bbB..'],
    a: ['..tt...tt..', '.bbB...bbB.'],
    pass: ['....ttt....', '...bbBB....'],
    b: ['..tt...tt..', '.bBB...bBB.'],
  },
  flap: [['Mm', '.M'], -1, 6] as [string[], number, number],
};

// ------------------------------------------------------------------ the portrait (40x40, facing right)

/** Her dialogue portrait: the hood up, the mustard scarf wound thick at her neck, a brick-red fringe, a grin; her face
 *  window is PORTRAIT_FACE_AT.wren. */
export function wrenPortrait(): HTMLCanvasElement {
  const g: Grid = grid(40, 40);
  // the jacket's shoulders
  const shoulders = ell(21, 42, 15, 10);
  fill(g, shoulders, sphere(CHAR, 14, 33, 20, 12, 0.1));
  rimShade(g, shoulders, CHAR[0]);
  // the hood: a big soft cowl, its tip falling back; a fold running down it
  const HOOD = [CHAR[1], CHAR[2], CHAR[3], CHAR[4], '#a49eb2'];
  const hood = or(ell(21, 18, 13, 13), ell(10, 25, 6, 8), ell(7, 31, 3, 3), ell(12, 7, 4, 3));
  fill(g, hood, sphere(HOOD, 12, 5, 20, 20, 0.12, 0.05));
  rimShade(g, hood, CHAR[0], 2);
  for (const [x, y] of bez([16, 5], [12, 12], [11, 20], [13, 30], 40)) if (hood(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), CHAR[1]);
  for (const [x, y] of bez([17, 5], [13, 12], [12, 20], [14, 30], 40)) if (hood(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), HOOD[3]);
  // the face in the hood's opening
  const faceM = and(or(ell(27.5, 22, 7.2, 7.4), ell(27, 26.5, 6, 4.2), ell(34.5, 23.5, 1.2, 1.4)), (_x, y) => y >= 14);
  fill(g, faceM, sphere(SKIN, 25, 18, 10, 10, 0.24));
  rimShade(g, faceM, SKIN[1]);
  // the hood's lit lip over her brow, and its edge down the cheek
  for (const [x, y] of bez([18, 15], [22, 10], [29, 9.2], [36, 12], 40)) {
    put(g, Math.round(x), Math.round(y) - 1, '#a49eb2');
    put(g, Math.round(x), Math.round(y), CHAR[4]);
    put(g, Math.round(x), Math.round(y) + 1, CHAR[2]);
  }
  for (const [x, y] of bez([19, 15], [19, 20], [20, 26], [22, 31], 24)) {
    put(g, Math.round(x) - 1, Math.round(y), CHAR[4]);
    put(g, Math.round(x), Math.round(y), CHAR[1]);
  }
  // the brick-red fringe under the lip
  for (const [x0, len] of [
    [22, 3],
    [25, 4],
    [29, 3],
    [32, 2],
  ])
    for (let i = 0; i < len; i++) put(g, x0 + Math.floor(i / 2), 13 + i, i === 0 ? WREN_BRICK[3] : WREN_BRICK[2]);
  // the scarf: thick mustard turns round her neck, the knot and a tail at the front
  const scarfM = or(ell(23, 33, 10, 3.6), ell(25, 36.5, 11, 3.4), ell(31, 39, 3, 3));
  fill(g, scarfM, sphere(WREN_MUSTARD, 18, 30, 14, 8, 0.08));
  rimShade(g, scarfM, WREN_MUSTARD[1]);
  for (let x = 14; x <= 33; x++) if (scarfM(x, 34) && scarfM(x, 35)) put(g, x, 34, WREN_MUSTARD[1]);
  // eyes (hazel), a freckle or two, a cheeky grin
  const eye: Pal = { k: '#140c1c', W: '#ffffff', e: '#6a9a3a', E: '#2e5a22', w: '#e8dccc' };
  stamp(g, ['kkkk', '.Ek.'], eye, 24, 19);
  stamp(g, ['kkk', '.Ek'], eye, 31, 19);
  for (const [x, y] of [
    [25, 24],
    [27, 25],
    [32, 24],
  ])
    put(g, x, y, '#c07050');
  put(g, 35, 25, SKIN[2]);
  stamp(g, ['.....x', 'xxxxx.'], { x: '#5a1a1a' }, 28, 27);
  return toCanvas(g);
}
