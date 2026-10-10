// Dell, the slinger (see docs/content-bible.md section 3): a freckled farm kid with a straw hat and a red neckerchief,
// patched overalls, a forked slingshot and a pouch of pebbles. Fight frames `dell_${pose}` on the shared rig
// (art-rig.ts): a kid, a head shorter than the grown-ups. The slingshot rides the far hand (in front of the body);
// the near hand pulls the band back.
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { type HeroCardSpec, type Layer, LEG_FEET_X, matureLegs, type Pt, type Rig, type RigPose, sparkle } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#8a4a3a', '#c87a5e', '#eeaa86', '#fcd0b0', '#fff0e0'];
export const DELL_STRAW = ['#5a3a10', '#9a6a18', '#d0a030', '#f2cc5a', '#fff0a0'];
export const DELL_DENIM = ['#141e44', '#22366a', '#345496', '#4c76bc', '#78a0e0'];
const RED = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
const SHIRT = ['#7a6a52', '#b8a888', '#e4d6b4', '#fbf2dc'];
const HAIR = ['#4a1a0e', '#8a3a1a', '#c0602e', '#e08a48'];
const BOOT = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c'];
export const DELL_WOOD = ['#3a2010', '#6a4024', '#9a6438', '#c8945a'];
export const DELL_STONE = ['#3e3c4c', '#6a6876', '#9a96a0', '#cac6c8'];

export const DELL_PAL: Pal = {
  // the face (painted by hand): skin, freckles, eyes, grin
  z: SKIN[1], S: SKIN[3], T: SKIN[4], E: SKIN[2], f: '#c8704a', k: '#140c1c', W: '#ffffff', i: '#2a6a3a', x: '#8a3030', X: '#fff4e8',
  // the straw hat (by hand: the weave's light and dark), its red band
  Y: DELL_STRAW[4], y: DELL_STRAW[3], u: DELL_STRAW[2], U: DELL_STRAW[1], r: RED[2], R: RED[1],
  // ginger hair under the brim
  H: HAIR[2], h: HAIR[1],
  // the overalls' brass buttons, their patches (red check, straw)
  B: '#f2c230', P: RED[3], p: RED[1], Q: DELL_STRAW[3], q: DELL_STRAW[1],
  // the neckerchief
  N: RED[3], n: RED[2], m: RED[1],
  // hands
  F: SKIN[3], v: SKIN[2], V: SKIN[1],
};
export const DELL_SHADES: Record<string, Shade> = {
  d: { ramp: DELL_DENIM, same: 'BPpQq', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  s: { ramp: SHIRT, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  b: { ramp: BOOT, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  c: { ramp: DELL_DENIM, top: [4], left: [4], right: [2], bottom: [2], mid: 3 }, // rolled cuffs: the denim's lighter inside
};

// ------------------------------------------------------------------ body

// A wide-brimmed straw hat with a red band, ginger tufts, big green eyes, freckles, a gap-toothed grin; 17 wide.
// (playtest round 8, L8, by hand: the straw hat over ginger hair, ginger brows over one dark iris each, a crooked
// half-smile, the jaw in shadow) 17 x 11.
const HEAD = [
  '......UuuuuU.....',
  '....RrrrrrrrrrR..',
  'UuuyyYyYyYyYyyuuU',
  '.UuuuuuuuuuuuuuuU',
  '..hHhhSSSSSSSSh..',
  '..hHhSShhSSShhS..',
  '..hhzESSSkSSSSkS.',
  '...hzESSSSSSSSST.',
  '....zzSSSSSSSzz..',
  '.....zSSSSxxSz...',
  '......zzSSSSz....',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 17 - swap[y].length) + swap[y] : r));
// (playtest round 8, L8, after the fresh-eyes review: the hat's brim a px in at each end and a column of hair out at
// the back, so the head is no wider than the shoulders and the hero reads about three heads tall at 3x on the hero
// select; the face keeps its place)
const narrowHeads = (heads: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(heads).map(([k, rows]) => [k, rows.map((r) => r.slice(1, 3) + r.slice(4, 16))]));
const HEADS = narrowHeads({
  base: HEAD,
  squint: face(HEAD, { 5: 'ShhSSShhS..', 6: 'SSzzSSSzzS.', 9: 'SSxxxxSz...' }),
  ko: face(HEAD, { 5: 'SSSSSSSSS..', 6: 'SSkSkSSkSkS.', 9: 'SSSxSSz...' }),
  // one eye shut, tongue out, aiming
  aim: face(HEAD, { 5: 'ShhSSShhS..', 6: 'SSzzSSSSkS.', 9: 'SSxxPSz...' }),
});

// The red neckerchief knotted at the throat, a cream shirt, the overalls' bib with brass buttons and a patch.
const TORSO = [
  '...mnnnnm.....',
  '.ssnNNNNnss...',
  'sssdmNNmdsss..',
  'ssddBdddBddss.',
  '.sdddddddddds.',
  '.sdddddddddds.',
  '.sdddddddddds.',
  '..dddddddPPd..',
  '..ddddddPpPd..',
  '..ddddddddd...',
  '..dddddddddd..',
];

// Overall legs (a straw patch on one knee), rolled cuffs, scuffed boots; 14 wide, the feet centred on x = 7.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'd', legBack: '8', boot: 'b', bootBack: '9', sole: '9' });

export const DELL_FIST = ['FF', 'vV'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.4, SHIRT[3], SHIRT[2]],
  [1, SKIN[4], SKIN[3]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.4, SHIRT[2], SHIRT[1]],
  [1, SKIN[3], SKIN[2]],
];

export const DELL_RIG: Rig = {
  pal: { ...DELL_PAL, '8': DELL_DENIM[1], '9': BOOT[0] },
  shades: DELL_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -7,
  torsoOverlap: 1,
  headX: 0,
  headOverlap: 2,
  shoulderNear: [3, 2],
  shoulderFar: [9, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: DELL_FIST,
  fistFar: DELL_FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the pebble pouch, the neckerchief's tail

/** The pebble pouch at his hip (behind the near hand): a leather sack, its drawstring, grey pebbles peeking out. */
const pouch: Layer = (g, a) => {
  const x = a.tx + 1;
  const y = a.ty + 6;
  stamp(g, ['.ab.', 'cddc', 'deee', 'deee', '.ee.'], { a: DELL_STONE[3], b: DELL_STONE[2], c: BOOT[3], d: BOOT[2], e: BOOT[1] }, x - 2, y);
};

/** The neckerchief's two ends fluttering behind his neck. */
const kerchief =
  (ang: number): Layer =>
  (g, a) => {
    const x = a.tx + 2;
    const y = a.ty + 1;
    const dx = -Math.round(Math.cos(ang) * 3);
    const dy = Math.round(Math.sin(ang) * 3);
    put(g, x - 1, y, RED[2]);
    put(g, x - 1 + Math.round(dx / 2), y + Math.round(dy / 2), RED[3]);
    put(g, x - 1 + dx, y + dy, RED[2]);
    put(g, x + Math.round(dx / 2), y + 1 + Math.round(dy / 2), RED[1]);
  };

// ------------------------------------------------------------------ the slingshot and its pebbles

/** A line of single pixels from a to b. */
function line(g: Grid, a: Pt, b: Pt, col: string): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    put(g, Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), col);
  }
}

/** A pebble centred near (x, y): a little grey stone lit from the top left (`gold`: a lucky one, glowing). */
function pebble(g: Grid, x: number, y: number, gold = false): void {
  const S = gold ? [DELL_STRAW[1], DELL_STRAW[2], DELL_STRAW[3], DELL_STRAW[4]] : DELL_STONE;
  stamp(g, ['ba', 'cb'], { a: S[2], b: S[1], c: S[0] }, x, y);
  put(g, x, y, S[3]);
  if (gold) sparkle(g, x + 3, y - 2, DELL_STRAW[4], '#ffffff');
}

/**
 * The slingshot gripped at (x, y): a forked hazel stick, `ang` tilting it (0 upright, + leaning forward); the band
 * stretched from both prong tips to `drawTo` (the pouch, at the near fist) or hanging slack between them.
 */
function sling(g: Grid, x: number, y: number, ang: number, drawTo?: Pt, loaded = false, gold = false): void {
  const ax = Math.sin(ang);
  const ay = -Math.cos(ang);
  const fx = Math.cos(ang);
  const fy = Math.sin(ang);
  const W = DELL_WOOD;
  const at = (along: number, side: number): Pt => [Math.round(x + ax * along + fx * side), Math.round(y + ay * along + fy * side)];
  // the handle (down from the grip), the crotch, the two prongs spreading up: 3 px of wood in the handle and 2 in
  // each prong, lit on the side toward the light, so the fork reads at 8x
  for (let k = -3; k <= 1; k++) {
    const [lx, ly] = at(k, -1);
    const [px, py] = at(k, 0);
    const [dx, dy] = at(k, 1);
    put(g, lx, ly, W[3]);
    put(g, px, py, W[2]);
    put(g, dx, dy, W[1]);
  }
  const tips: Pt[] = [];
  for (const side of [-1, 1]) {
    for (let k = 1; k <= 6; k++) {
      const s = side * Math.min(3, k * 0.75);
      const [px, py] = at(1 + k, s);
      const [qx, qy] = at(1 + k, s + side);
      // the outer edge of the left prong and the inner edge of the right one face the light
      put(g, px, py, side < 0 ? W[2] : W[3]);
      put(g, qx, qy, side < 0 ? W[3] : W[1]);
      if (k === 6) {
        put(g, px, py, W[3]);
        tips.push([px, py]);
      }
    }
  }
  // the band (and its leather cup at the near fist when drawn)
  const band = '#5a2a1e';
  if (drawTo) {
    for (const t of tips) line(g, t, drawTo, band);
    stamp(g, ['ab', 'bb'], { a: BOOT[3], b: BOOT[2] }, drawTo[0] - 1, drawTo[1]);
    if (loaded) pebble(g, drawTo[0] - 2, drawTo[1] - 1, gold);
  } else {
    const mid: Pt = [Math.round((tips[0][0] + tips[1][0]) / 2 - fx * 2), Math.round((tips[0][1] + tips[1][1]) / 2 - fy * 2 + 1)];
    line(g, tips[0], mid, band);
    line(g, mid, tips[1], band);
  }
}

type SlingOpt = { ang?: number; drawn?: boolean; gold?: boolean };
/** The slingshot in the far hand and, when drawn, its band to the near fist with a pebble in the cup; drawn as a front
 *  layer so the band sits under the pulling fingers. */
const slingshot =
  (o: SlingOpt = {}): Layer =>
  (g, a) => {
    const [fx, fy] = a.far;
    const [nx, ny] = a.near;
    sling(g, fx, fy, o.ang ?? 0, o.drawn ? [nx, ny] : undefined, o.drawn, o.gold);
    stamp(g, DELL_FIST, DELL_PAL, fx, fy);
    if (o.drawn) stamp(g, DELL_FIST, DELL_PAL, nx, ny);
  };

/** A pebble flying right with speed lines (`gold`: a lucky shot). */
const flying =
  (x: number, y: number, gold = false): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    pebble(g, X, Y, gold);
    for (let k = 1; k <= 3; k++) put(g, X - k * 3, Y + 1, gold ? DELL_STRAW[3] : '#d8dcec');
  };

/** A pebble tossed up from the near hand (idle): just above the fist. */
const tossed =
  (dy: number): Layer =>
  (g, a) =>
    pebble(g, a.near[0], a.near[1] - dy);

/** A hail of pebbles rising round him (the finisher). */
const hail =
  (pts: Array<[number, number]>): Layer =>
  (g, a) => {
    for (const [x, y] of pts) {
      pebble(g, a.fx + x, a.fy - y);
      put(g, a.fx + x + 1, a.fy - y + 3, '#d8dcec');
    }
  };

/** A four-leaf clover glinting by the shot (Lucky Shot). */
const clover =
  (x: number, y: number): Layer =>
  (g, a) => {
    stamp(g, ['.aa.', 'abba', 'abba', '.aa.', '..c.'], { a: '#5ac850', b: '#b4f070', c: '#2e5a32' }, a.fx + x, a.fy - y);
    sparkle(g, a.fx + x + 5, a.fy - y - 1, '#fff0a0', '#ffffff');
  };

/** His hat knocked off, on the ground (knocked out). */
const droppedHat: Layer = (g, a) => stamp(g, HEAD.slice(0, 6), DELL_PAL, a.fx - 20, a.fy - 5);
/** The slingshot lying in the grass. */
const droppedSling: Layer = (g, a) => sling(g, a.fx + 13, a.fy - 2, 1.6);

/** Dizzy little stars circling the head. */
const dizzy: Layer = (g, a) => {
  for (const [dx, dy] of [
    [3, -2],
    [10, -4],
    [16, -1],
  ])
    sparkle(g, a.hx + dx, a.hy + dy, DELL_STRAW[3], '#ffffff');
};

// ------------------------------------------------------------------ poses

export const DELL_POSES: Record<string, RigPose> = {
  // the slingshot loose in his far hand, tossing a pebble with the near one
  idle0: { near: { at: [-1, 19] }, far: { at: [8, 18] }, farFront: true, back: [kerchief(0.4), pouch], front: [slingshot({ ang: 0.3 }), tossed(2)] },
  idle1: { near: { at: [-1, 18] }, far: { at: [8, 17] }, farFront: true, dy: 1, back: [kerchief(0.6), pouch], front: [slingshot({ ang: 0.3 }), tossed(5)] },
  // the pebble comes down, the kerchief settles a frame behind the breath
  idle2: { near: { at: [-1, 18] }, far: { at: [8, 17] }, farFront: true, dy: 1, back: [kerchief(0.7), pouch], front: [slingshot({ ang: 0.3 }), tossed(4)] },
  idle3: { near: { at: [-1, 19] }, far: { at: [8, 18] }, farFront: true, back: [kerchief(0.5), pouch], front: [slingshot({ ang: 0.3 }), tossed(1)] },
  dash: { near: { at: [-5, 19] }, far: { at: [8, 20] }, farFront: true, legs: 'run', dx: 1, lean: 1, back: [kerchief(0.05), pouch], front: [slingshot({ ang: 0.6 })] },
  // full draw: the band at his cheek, one eye shut
  slashA: { near: { at: [2, 26] }, far: { at: [12, 25] }, farFront: true, legs: 'lunge', head: 'aim', back: [kerchief(0.2), pouch], front: [slingshot({ ang: 1.45, drawn: true })] },
  // the snap: the pebble away, the band slack, the pulling hand flung back
  slashB: { near: { at: [-5, 26] }, far: { at: [12, 25] }, farFront: true, legs: 'lunge', back: [kerchief(0.1), pouch], front: [slingshot({ ang: 1.45 }), flying(28, 17)] },
  // digging in the pouch for a pebble
  windup: { near: { at: [-2, 17] }, far: { at: [9, 22] }, farFront: true, legs: 'crouch', dy: 1, bow: 1, back: [kerchief(0.4), pouch], front: [slingshot({ ang: 0.9 }), (g, a) => pebble(g, a.near[0] - 1, a.near[1] - 2)] },
  // ducking behind a raised arm, the slingshot up
  parry: { near: { at: [7, 27] }, far: { at: [11, 22] }, farFront: true, legs: 'crouch', dy: 1, dx: -1, head: 'squint', back: [kerchief(0.4), pouch], front: [slingshot({ ang: 0.2 })] },
  hurt: { near: { at: [-6, 19] }, far: { at: [5, 17] }, farFront: true, dx: -1, lean: -1, dy: 1, head: 'squint', back: [kerchief(-0.3), pouch], front: [slingshot({ ang: -0.5 })] },
  leap: { near: { at: [3, 25] }, far: { at: [12, 23] }, farFront: true, legs: 'tuck', head: 'aim', back: [kerchief(-0.2), pouch], front: [slingshot({ ang: 1.2, drawn: true })] },
  // knocked out: sat down hard, hat off, dizzy
  down: { near: { at: [7, 4] }, far: { at: [-3, 4] }, legs: 'kneel', bow: 1, head: 'ko', back: [kerchief(0.6), droppedHat, droppedSling], front: [dizzy] },
  // the finisher: drawing straight up, a hail of pebbles in the air
  fin: {
    near: { at: [6, 24] },
    far: { at: [9, 35] },
    farFront: true,
    legs: 'lunge',
    head: 'aim',
    back: [kerchief(0.2), pouch],
    front: [slingshot({ ang: 0.15, drawn: true }), hail([[-8, 30], [16, 33], [-12, 22], [20, 25], [3, 38], [12, 40]])],
  },
  // Lucky Shot: a kneeling shot with a glowing gold pebble, a four-leaf clover by it
  cast: { near: { at: [1, 23] }, far: { at: [12, 22] }, farFront: true, legs: 'crouch', dy: 1, head: 'aim', back: [kerchief(0.3), pouch], front: [slingshot({ ang: 1.45, drawn: true, gold: true }), clover(18, 22)] },
};

/** Hero select card: tossing a pebble, the slingshot at his side, before a straw-gold glow with a denim-blue rim. */
export const DELL_CARD: HeroCardSpec = {
  pose: { near: { at: [-1, 21] }, far: { at: [8, 18] }, farFront: true, back: [kerchief(0.5), pouch], front: [slingshot({ ang: 0.3 }), tossed(6)] },
  glow: ['#fff0a0', '#3a62b0'],
  motes: [[6, 12], [33, 10], [34, 28]],
};

/** By the campfire (two breaths): sat easy, whittling a fresh slingshot fork. */
export const DELL_CAMP: [RigPose, RigPose] = [
  { near: { at: [3, 21] }, far: { at: [8, 22] }, farFront: true, back: [kerchief(0.5), pouch], front: [slingshot({ ang: 0.6 }), tossed(1)] },
  { near: { at: [3, 20] }, far: { at: [8, 21] }, farFront: true, dy: 1, back: [kerchief(0.6), pouch], front: [slingshot({ ang: 0.6 }), tossed(4)] },
];
