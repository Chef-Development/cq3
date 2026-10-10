// Fizz, the alchemist (see docs/content-bible.md section 3): wiry, with wild bright-teal hair bursting out from under
// a scorched leather cap with a brass-rimmed lens on its front, a stained cream lab coat with rolled sleeves, a
// bandolier of coloured flasks across her chest, and a long-handled ladle. Fight frames `fizz_${pose}` on the shared
// rig (art-rig.ts); `flaskSprite` is her flask, drawn in a brew's glass (fire red, frost blue, spark green).
import { grid, put, stamp, toCanvas, type Grid, type Pal, type Shade } from './art';
import { and, ell, fill, not, or, rimShade, sphere } from './art-paint';

const INK_C = '#140c1c';
import { along, type Dir, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureLegs, pole, type Rig, type RigPose, sparkle } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#7a3a2c', '#c0705a', '#eaa47e', '#fccaa0', '#fff0dc'];
export const FIZZ_HAIR = ['#0e2e46', '#12666e', '#1aa896', '#4cdcbc', '#b0ffe0'];
const CAP = ['#1e1210', '#3a2218', '#5e3a26', '#845a38', '#ac8054'];
const COAT = ['#6e5a50', '#a8947c', '#d4c4a4', '#eee4c8', '#fffbea'];
const TROUSER = ['#1a1622', '#2a2634', '#3e384a', '#565064'];
const BOOT = ['#1e1210', '#36201a', '#563826', '#7a5236'];
const BRASS = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const STEELR = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const WOODR = ['#4e2c16', '#8e5a2e', '#c0905a'];

/** A flask's glass in each brew [deep, base, light, glint]: fire red, frost blue, spark green. */
export const BREW_GLASS: Record<'fire' | 'frost' | 'spark', readonly string[]> = {
  fire: ['#5a0e1e', '#c02a2e', '#ff6a4a', '#ffd0a0'],
  frost: ['#10286a', '#2a62d8', '#62b0ff', '#d8f4ff'],
  spark: ['#0e4a22', '#26a03a', '#7ae25a', '#f0ffb0'],
};
type BrewKey = keyof typeof BREW_GLASS;

export const FIZZ_PAL: Pal = {
  // face (by hand): skin, soot, eyes, a grin
  z: SKIN[1], S: SKIN[3], T: SKIN[4], E: SKIN[2], m: '#a08070', k: '#140c1c', W: '#ffffff', x: '#5a1a1a', i: '#1a6a64',
  // the cap's lens: a brass rim, red glass with a glint
  L: BRASS[3], l: BRASS[1], R: BREW_GLASS.fire[1], r: BREW_GLASS.fire[0], G: BREW_GLASS.fire[3],
  // the cap's scorch marks, the coat's stains, the bandolier and its vials
  C: CAP[0], y: '#b8ac6a', Y: '#8a8456', b: CAP[2], B: CAP[1], f: BREW_GLASS.fire[2], o: BREW_GLASS.frost[2], g: BREW_GLASS.spark[2],
  n: '#d8c090', d: '#3a2c3a',
  // skin fists
  F: SKIN[3], u: SKIN[2], U: SKIN[1],
};
export const FIZZ_SHADES: Record<string, Shade> = {
  h: { ramp: FIZZ_HAIR, same: 'H', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  c: { ramp: CAP, same: 'C', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  w: { ramp: COAT, same: 'yYbBfogn', top: [4, 3], left: [3], right: [2], bottom: [1], mid: 3 },
  v: { ramp: COAT, same: 'yY', top: [3], left: [3], right: [2], bottom: [1], mid: 3 }, // the coat's tails
  p: { ramp: TROUSER, top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
  e: { ramp: BOOT, top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// The scorched cap with its lens up front, wild teal hair bursting out round the back, a sooty cheek and a grin.
const HEAD = [
  '.hh..hcccccc....',
  'hhhhhcccccccc...',
  '.hhhccCcccccLLl.',
  'hhhhcccccccLRGl.',
  '.hhhhcccCccLRrl.',
  'hhhhhcccccccllll',
  '.hhhhhhhhhSSSSS.',
  'hhhhhhzSShkkSSkk',
  '.hhhhzEzSSWiSSWi',
  'hhhhhhzSSmSSSSST',
  '.hhhhhzzSxWWWxz.',
  'hh.hh..zzSSSSz..',
  '........zzzz....',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 7: 'SShSSSSS', 8: 'SSkkSSkk', 10: 'SSxWxz.' }),
  // knocked out: sooty all over, eyes crossed out, the cap's lens cracked
  ko: face(HEAD, { 3: 'LRkl.', 4: 'LkRl.', 7: 'mSSSSSSS', 8: 'SkSkSkSk', 9: 'mSkSSkST', 10: 'SSSxSz.' }),
  // a wild grin: eyes wide, mouth open
  grin: face(HEAD, { 7: 'hkkkSkkk', 8: 'SWikSWik', 10: 'SxWWWWx.', 11: 'zSxxxSz.' }),
};

// The lab coat (stained), the bandolier from her far shoulder to her near hip, a vial in each loop.
const TORSO = [
  '..wwwwdwwwww..',
  '.wwwwwdwwwwBb.',
  '.wwwwwwwwwBfw.',
  '.wwwwwwwwBbww.',
  '..wwwwwwBowww.',
  '..wwwwwwBowww.',
  '..wwwwwwBowww.',
  '..wwwwwBbwwww.',
  '..wwwwBgwywww.',
  '..wwwBbwwYwww.',
  '..wwwwwwwwwww.',
];

// The coat's tails to the knees over dark trousers and scuffed boots; 13 wide, the feet centred on x = 6.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'p', legBack: '8', boot: 'e', bootBack: '9', sole: '9', skirt: 'v' });

const FIST = ['FF', 'uU'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.4, COAT[3], COAT[2]],
  [0.52, COAT[4], COAT[2]],
  [1, SKIN[3], SKIN[2]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.4, COAT[2], COAT[1]],
  [0.52, COAT[3], COAT[1]],
  [1, SKIN[2], SKIN[1]],
];

export const FIZZ_RIG: Rig = {
  pal: { ...FIZZ_PAL, '8': TROUSER[1], '9': BOOT[0] },
  shades: FIZZ_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -7,
  torsoOverlap: 1,
  headX: -2,
  headOverlap: 1,
  shoulderNear: [4, 2],
  shoulderFar: [10, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ flasks and the ladle

/**
 * A round-bottomed flask: its body centred on (cx, cy) (radius r), a neck and a cork above it, the glass in a brew's
 * colours lit from the top left, liquid filling the lower part, a glint; `fizz` puts a bubble over the cork.
 */
export function flaskSprite(g: Grid, cx: number, cy: number, brew: BrewKey, r = 2.5, fizz = false): void {
  const glass = BREW_GLASS[brew];
  const body = ell(cx, cy, r, r);
  fill(g, body, (_x, y) => (y + 0.5 < cy - r * 0.15 ? '#e8f0f4' : null));
  fill(g, body, (x, y) => (y + 0.5 >= cy - r * 0.15 ? sphere([glass[0], glass[1], glass[2], glass[2]], cx - r * 0.4, cy - r * 0.2, r * 1.2, r * 1.2, 0.18)(x, y) : null));
  // the neck and its cork
  const nx = Math.floor(cx - 0.5);
  const ny = Math.floor(cy - r);
  put(g, nx, ny, '#c8d8e0');
  put(g, nx + 1, ny, '#98aab8');
  put(g, nx, ny - 1, '#c8d8e0');
  put(g, nx + 1, ny - 1, '#98aab8');
  put(g, nx, ny - 2, '#d8b080');
  put(g, nx + 1, ny - 2, '#9a6a40');
  // a glint on the glass
  put(g, Math.floor(cx - r * 0.5), Math.floor(cy - r * 0.45), '#ffffff');
  if (fizz) {
    put(g, nx + 2, ny - 3, glass[3]);
    put(g, nx - 1, ny - 4, glass[2]);
  }
}

/** A flask in a brew at a point relative to the feet. */
const flaskAt =
  (x: number, y: number, brew: BrewKey, r = 2.5, fizz = true): Layer =>
  (g, a) =>
    flaskSprite(g, a.fx + x, a.fy - y, brew, r, fizz);

/** A flask held in a hand: its body just past the fist, the fist stamped over its neck. */
const flaskHeld =
  (hand: 'near' | 'far', brew: BrewKey, dx = 2, dy = -1, r = 2.5): Layer =>
  (g, a) => {
    const [x, y] = a[hand];
    flaskSprite(g, x + 1 + dx, y + dy, brew, r, true);
    stamp(g, FIST, FIZZ_PAL, x, y);
  };

/** The long-handled ladle at its grip: the handle runs `len` px along `dir` to the bowl, `back` px the other way; the
 *  steel bowl (glowing with brew when `brew` is given) cupped at the end. */
function ladle(dir: Dir, len: number, back: number, brew?: BrewKey): Item {
  return (g, x, y) => {
    pole(g, x, y, dir, len - 2, back, WOODR);
    const [cx, cy] = along(x, y, dir, len);
    // a deep steel cup, its mouth up: a bright rim, the inside dark (or brimming with brew), a rounded belly
    const inside = brew ? BREW_GLASS[brew] : null;
    for (let i = -2; i <= 2; i++) put(g, cx + i, cy - 1, i < 1 ? STEELR[4] : STEELR[3]);
    put(g, cx - 2, cy, STEELR[3]);
    for (let i = -1; i <= 1; i++) put(g, cx + i, cy, inside ? inside[i < 0 ? 3 : 2] : STEELR[0]);
    put(g, cx + 2, cy, STEELR[1]);
    put(g, cx - 1, cy + 1, STEELR[3]);
    put(g, cx, cy + 1, STEELR[2]);
    put(g, cx + 1, cy + 1, STEELR[1]);
  };
}

// ------------------------------------------------------------------ effects

/** A soft cloud of coloured fumes: overlapping puffs [x, y, r] shaded as one form in `ramp` (dark to light). */
const fumes =
  (pts: Array<[number, number, number]>, ramp: readonly string[] = ['#5e8a7a', '#8abaa4', '#b8e2c8', '#e4fff0']): Layer =>
  (g, a) => {
    const inside = (x: number, y: number) => pts.some(([px, py, r]) => (x + 0.5 - (a.fx + px)) ** 2 + (y + 0.5 - (a.fy - py)) ** 2 <= r * r);
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[0].length; x++) {
        if (!inside(x, y)) continue;
        let c = ramp[2];
        if (!inside(x, y + 1) || !inside(x + 1, y + 1)) c = ramp[0];
        else if (!inside(x + 1, y) || !inside(x, y + 2)) c = ramp[1];
        else if (!inside(x, y - 1) || !inside(x - 1, y)) c = ramp[3];
        put(g, x, y, c);
      }
  };

/** Bubbles and droplets in a brew's colours at points relative to the feet. */
const drops =
  (pts: Array<[number, number]>, brew: BrewKey): Layer =>
  (g, a) =>
    pts.forEach(([x, y], i) => put(g, a.fx + x, a.fy - y, BREW_GLASS[brew][i % 2 ? 2 : 3]));

/** A splash arcing off the ladle's swing: two rows of brew droplets. */
const splash =
  (cx: number, cy: number, r: number, a0: number, a1: number, brew: BrewKey): Layer =>
  (g, a) => {
    const glass = BREW_GLASS[brew];
    for (const [rr, col] of [
      [r, glass[3]],
      [r - 1, glass[2]],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 3)) {
        const ang = a0 + (a1 - a0) * t;
        if (Math.floor(t * 12) % 3 === 2) continue; // broken into droplets
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

const spark =
  (x: number, y: number, col: string, big = false): Layer =>
  (g, a) =>
    sparkle(g, a.fx + x, a.fy - y, col, '#ffffff', big);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const FIZZ_POSES: Record<string, RigPose> = {
  // the ladle on her far shoulder, a fire flask swirled in the near hand
  idle0: P({ near: { at: [8, 17] }, far: { at: [3, 22], item: ladle('ul', 14, 3), behind: true }, front: [flaskHeld('near', 'fire')] }),
  idle1: P({ near: { at: [8, 18] }, far: { at: [3, 21], item: ladle('ul', 14, 3), behind: true }, dy: 1, front: [flaskHeld('near', 'fire', 2, -2), drops([[12, 17]], 'fire')] }),
  // the flask settles back into her hand a frame behind the breath, the brew still sloshing
  idle2: P({ near: { at: [8, 17] }, far: { at: [3, 21], item: ladle('ul', 14, 3), behind: true }, dy: 1, front: [flaskHeld('near', 'fire', 2, 0), drops([[11, 21]], 'fire')] }),
  idle3: P({ near: { at: [8, 17] }, far: { at: [3, 22], item: ladle('ul', 14, 3), behind: true }, front: [flaskHeld('near', 'fire', 2, 0), drops([[11, 18]], 'fire')] }),
  dash: P({ near: { at: [6, 19] }, far: { at: [-4, 21], item: ladle('l', 13, 2), behind: true }, legs: 'run', dx: 1, lean: 1, front: [flaskHeld('near', 'frost', 1, -1)] }),
  // an overhand toss: the flask just leaving her hand, spinning
  slashA: P({
    near: { at: [11, 23] },
    far: { at: [-3, 21], item: ladle('ul', 12, 2), behind: true },
    legs: 'lunge',
    dx: 1,
    lean: 1,
    head: 'grin',
    front: [flaskAt(17, 19, 'fire'), drops([[13, 16], [14, 18], [15, 17]], 'fire')],
  }),
  // a scooping swing of the ladle, brew splashing off it
  slashB: P({
    near: { at: [10, 19], item: ladle('ur', 13, 3, 'spark') },
    far: { at: [8, 18] },
    legs: 'lunge',
    dx: 2,
    lean: 1,
    farFront: false,
    front: [splash(14, 18, 11, 1.9, 0.5, 'spark')],
  }),
  // a flask heaved back over her head
  windup: P({ near: { at: [-6, 29] }, far: { at: [10, 20], item: ladle('r', 9, 3) }, legs: 'crouch', armsUp: true, head: 'grin', front: [flaskHeld('near', 'spark', -2, -2), drops([[-6, 26], [-3, 27]], 'spark')] }),
  // the ladle held crosswise, braced, eyes screwed shut
  parry: P({ near: { at: [4, 22], item: ladle('ur', 12, 4) }, far: { at: [10, 24] }, legs: 'crouch', dy: 1, head: 'squint', farFront: true }),
  hurt: P({
    near: { at: [-5, 19] },
    far: { at: [8, 23], item: ladle('dr', 9, 3) },
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
  }),
  leap: P({ near: { at: [0, 33] }, far: { at: [6, 32], item: ladle('u', 9, 3) }, legs: 'tuck', armsUp: true, head: 'grin', front: [flaskAt(-3, 27, 'frost', 2, false)] }),
  // knocked out: sat down hard, sooty, green fumes curling up, a cracked flask rolled away
  down: P({
    near: { at: [8, 3] },
    far: { at: [-4, 3] },
    legs: 'kneel',
    lean: 1,
    bow: 2,
    head: 'ko',
    front: [flaskAt(17, 3, 'spark', 2, false), fumes([[16, 8, 1.5], [18, 11, 1.3], [16, 14, 1]])],
  }),
  // the finisher: three flasks thrown up at once from both hands, each in its own brew
  fin: P({
    near: { at: [-1, 30] },
    far: { at: [8, 30] },
    legs: 'lunge',
    armsUp: true,
    head: 'grin',
    front: [flaskAt(-2, 29, 'fire'), flaskAt(4, 33, 'frost'), flaskAt(11, 29, 'spark'), spark(-6, 26, '#ffb02a'), spark(15, 26, '#7ae25a')],
  }),
  // Toss: a flask flicked up out of the near hand, a fizz of sparks
  cast: P({
    near: { at: [7, 24] },
    far: { at: [3, 21], item: ladle('ul', 13, 3), behind: true },
    head: 'grin',
    front: [flaskAt(11, 24, 'frost'), drops([[9, 19], [10, 21]], 'frost'), spark(14, 27, '#62b0ff')],
  }),
};

/** Hero select card: a fire flask held up to the light with a grin, the ladle on her shoulder, before a teal glow with
 *  a pale green heart. */
export const FIZZ_CARD: HeroCardSpec = {
  pose: { near: { at: [9, 22] }, far: { at: [3, 22], item: ladle('ul', 14, 3), behind: true }, head: 'grin', front: [flaskHeld('near', 'fire', 1, -2)] },
  glow: ['#c8ffe0', '#1aa896'],
  motes: [[5, 14], [34, 10], [34, 29]],
};

/** By the campfire (two breaths): stirring the ladle in a bubbling flask held low. */
export const FIZZ_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [7, 18] }, far: { at: [9, 21], item: ladle('d', 8, 4) }, farFront: true, front: [flaskHeld('near', 'spark', 1, 0, 3)] }),
  P({ near: { at: [7, 17] }, far: { at: [10, 20], item: ladle('d', 8, 4) }, farFront: true, dy: 1, front: [flaskHeld('near', 'spark', 1, -1, 3), drops([[10, 15], [12, 17]], 'spark')] }),
];

// ------------------------------------------------------------------ the portrait

const P_SKIN = ['#7a3a2c', '#c0705a', '#eaa47e', '#fccaa0', '#fff0dc'];

/** `portrait_fizz`: a 40x40 bust facing right (art-hero-portraits.ts adds it; her face window is [15, 10]): the wild teal
 *  hair bursting out under the scorched cap and its red lens, the stained coat with its bandolier of flasks. */
export function fizzPortrait(): HTMLCanvasElement {
  const g = grid(40, 40);
  // the wild hair behind: a big mass with tufts sticking out back and up
  const tufts: Array<[number, number, number, number]> = [
    [9, 13, 4.5, 3.2],
    [6, 19, 4.2, 3],
    [8, 25, 4, 2.8],
    [12, 29, 3.4, 2.6],
    [13, 8, 3.6, 3],
    [18, 6, 3.4, 2.8],
  ];
  const hair = or(ell(17, 18, 10, 11), ...tufts.map(([x, y, rx, ry]) => ell(x, y, rx, ry)));
  fill(g, hair, sphere(FIZZ_HAIR, 11, 9, 15, 15, 0.3, 0.12));
  rimShade(g, hair, FIZZ_HAIR[0], 1);
  for (const [x, y] of [
    [7, 12],
    [5, 18],
    [11, 7],
    [16, 5],
    [7, 24],
  ])
    put(g, x, y, FIZZ_HAIR[4]);
  // the coat's shoulders, its collar open on a dark shirt, the bandolier strap and its flasks
  const coat = ell(21, 42, 15, 11);
  fill(g, coat, sphere(COAT, 16, 34, 20, 12, 0.1));
  rimShade(g, coat, COAT[1]);
  fill(g, and(coat, (x, y) => Math.abs(x - 24.5) < 2.2 - (y - 31) * 0.1 && y < 37), () => '#3a2c3a');
  for (let y = 31; y < 40; y++) {
    const x = Math.round(31 - (y - 31) * 1.6);
    if (coat(x, y)) {
      put(g, x, y, CAP[3]);
      put(g, x + 1, y, CAP[1]);
    }
  }
  for (const [x, y, brew] of [
    [27, 34, 'fire'],
    [22, 37, 'frost'],
  ] as Array<[number, number, BrewKey]>)
    flaskSprite(g, x, y, brew, 1.6, false);
  // a stain on the coat
  put(g, 12, 36, '#b8ac6a');
  put(g, 13, 36, '#b8ac6a');
  put(g, 12, 37, '#8a8456');
  // the face
  const faceF = and(or(ell(27, 20.5, 7.4, 7.6), ell(26.5, 25, 6.2, 4.6), ell(34, 22.4, 1.3, 1.4)), (_x, y) => y >= 12);
  fill(g, faceF, sphere(P_SKIN, 25, 17, 10, 11, 0.22));
  rimShade(g, faceF, P_SKIN[1]);
  // hair falling over the brow under the cap (a few strands), the ear
  for (const [x, y] of [
    [21, 13],
    [22, 13],
    [23, 13],
    [21, 14],
    [22, 14],
    [26, 13],
    [27, 13],
  ])
    put(g, x, y, FIZZ_HAIR[2]);
  fill(g, ell(20.5, 21, 1.8, 2.6), sphere(P_SKIN, 19.5, 20, 3, 3.5, 0.1));
  put(g, 21, 22, P_SKIN[1]);
  // the scorched leather cap, its brim out over her eyes, the brass-rimmed red lens up front
  const capF = and(or(ell(23, 10, 10.5, 6.5), ell(31, 13.2, 5.6, 1.6)), (_x, y) => y <= 14);
  fill(g, capF, sphere(CAP, 19, 6, 13, 8, 0.1));
  rimShade(g, capF, CAP[0]);
  for (const [x, y] of [
    [17, 7],
    [18, 7],
    [24, 5],
    [14, 11],
    [15, 11],
  ])
    put(g, x, y, '#1a1216');
  const ring = and(ell(30, 8, 3.6, 3.6), not(ell(30, 8, 2.2, 2.2)));
  fill(g, ring, sphere(BRASS, 28.5, 6.5, 4, 4, 0.1));
  fill(g, ell(30, 8, 2.2, 2.2), sphere(BREW_GLASS.fire.slice(0, 3) as string[], 29.4, 7.2, 2.4, 2.4, 0.15));
  put(g, 29, 7, '#ffffff');
  // bright eyes (teal), a sooty smudge, a grin
  const eye: Pal = { k: INK_C, W: '#ffffff', i: '#1aa896', I: '#0e5a5a', w: '#e8dcd0' };
  stamp(g, ['kkkk', 'WiIk', 'wIkk'], eye, 23, 17);
  stamp(g, ['kkk', 'WiI', 'wIk'], eye, 30, 17);
  for (const [x, y] of [
    [24, 22],
    [25, 22],
    [24, 23],
  ])
    put(g, x, y, '#a08070');
  put(g, 34, 23, P_SKIN[2]);
  stamp(g, ['xxxxxx', 'xWWWWx', '.xxxx.'], { x: '#5a1a1a', W: '#fff4e8' }, 27, 25);
  return toCanvas(g);
}
