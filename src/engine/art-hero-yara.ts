// Yara, the spirit caller (see docs/content-bible.md section 3): a young spirit caller with dark braided hair
// threaded with beads, a deep-blue shawl patterned with stars over a white tunic, bare feet, a carved staff with
// hanging charms, and soft cyan spirit-light round her hands. Fight frames `yara_${pose}` on the shared rig
// (art-rig.ts).
import { put, stamp, type Pal, type Shade } from './art';
import { type Dir, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureHeads, matureLegs, ribbon, type Rig, type RigPose, sparkle, STEP } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#4a2418', '#7a4228', '#a8643c', '#cc8a58', '#e8ae7c'];
const HAIR = ['#0e0a14', '#1c1424', '#2c2036', '#40304c', '#5e4a6c'];
export const YARA_SHAWL = ['#120c30', '#1e1a5a', '#2c2c8c', '#4042b8', '#6a6ede'];
const TUNIC = ['#5a5a7e', '#9a9abc', '#cacae0', '#eeeef8', '#ffffff'];
export const YARA_SPIRIT = ['#1a6a8a', '#3ab4d8', '#7ae4f8', '#c4f8ff', '#ffffff'];
const WOOD = ['#2e1a10', '#4e2e1a', '#74482a', '#9a6a3e', '#c0905a'];
const STAR = '#fff6d8';
const BEAD = { o: '#f08a30', r: '#d84a3a', y: '#f2c230', q: '#3ac8b8' };

export const YARA_PAL: Pal = {
  // the face (painted by hand): skin, eyes (warm brown), mouth
  z: SKIN[1], S: SKIN[3], T: SKIN[4], E: SKIN[2], k: '#140c1c', W: '#ffffff', i: '#6a3420', x: '#7a2a2a',
  // beads threaded in the hair, on the sash, round an ankle
  O: BEAD.o, R: BEAD.r, Y: BEAD.y, Q: BEAD.q,
  // stars on the shawl
  '*': STAR, '+': '#b8bcff',
  // the hair's sheen, the hands
  L: HAIR[4], H: HAIR[1], F: SKIN[3], f: SKIN[2], v: SKIN[1],
};
export const YARA_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, same: 'HLORYQ', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  c: { ramp: YARA_SHAWL, same: '*+', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  w: { ramp: TUNIC, same: 'ORYQ', top: [4], left: [3], right: [1], bottom: [1], mid: 3 },
  s: { ramp: SKIN, same: 'Qe', top: [4], left: [3], right: [1], bottom: [1], mid: 2 },
  e: { ramp: SKIN, same: 's', top: [4], left: [4], right: [2], bottom: [2], mid: 3 }, // bare feet: lit on top, no dark sole
};

// ------------------------------------------------------------------ body

// Dark hair with soft bangs, a bead at the temple, warm brown eyes, a small smile; 16 wide.
const HEAD = [
  '.....hhhhhh.....',
  '...hhhhLLhhhh...',
  '..hhhLLhhhhhhh..',
  '.hhhLhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhhhh',
  'hhhhhhhhhhSShhhh',
  'hhhhhhhSSSSSSSSh',
  'hhOhhhzSSkkSSkkS',
  'hhRhhzEzSWiSSWiS',
  '.hYhhzzSSSSSSSST',
  '..hhhhzSSSSSSSz.',
  '...hh.zzSxxSSz..',
  '.......zzSSSS...',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  squint: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSkkSSkk', 12: 'SxxxxSz..' }),
  ko: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSSSSSSS', 10: 'SSkkSSkT', 12: 'SSSxSSz..' }),
  // calling the spirits: eyes shut, a calm smile
  call: face(HEAD, { 8: 'SSSSSSSS', 9: 'SSkkSSkk', 12: 'SxxxSSz..' }),
};

// The star-patterned shawl over the shoulders and draped down either side, the white tunic, a beaded sash.
const TORSO = [
  '..ccccccccc....',
  '.cc*ccccc+ccc..',
  'cccccc*cccccc..',
  'cc+ccccccc*cc..',
  '.cccwwwwwccc...',
  '..ccwwwwwwcc...',
  '..ccwwwwwwcc...',
  '..ccwwwwwwcc...',
  '..cwwwwwwwwc...',
  '..wwwwwwwwww...',
  '..wOwRwYwQwOw..',
  '..wwwwwwwwwww..',
];

// The tunic to the knee, bare shins and bare feet (a bead anklet); 15 wide, the feet centred on x = 7.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 's', legBack: '8', boot: 'e', bootBack: '9', sole: '9', skirt: 'w' });

export const YARA_FIST = ['FF', 'fv'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.45, YARA_SHAWL[4], YARA_SHAWL[3]],
  [1, SKIN[4], SKIN[3]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.45, YARA_SHAWL[3], YARA_SHAWL[2]],
  [1, SKIN[3], SKIN[2]],
];

export const YARA_RIG: Rig = {
  pal: { ...YARA_PAL, '8': SKIN[1], '9': SKIN[0] },
  shades: YARA_SHADES,
  heads: matureHeads(HEADS, {drop: [2, 4]}),
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -7,
  torsoOverlap: 1,
  headX: -1,
  headOverlap: 2,
  shoulderNear: [4, 2],
  shoulderFar: [10, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: YARA_FIST,
  fistFar: YARA_FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the shawl's back, the braid

type Drape = 'hang' | 'sway' | 'flow' | 'rise' | 'limp';
/** The shawl's back behind her from the shoulders: [rows, x, y] relative to the torso's top left. */
const DRAPES: Record<Drape, [string[], number, number]> = {
  hang: [['..cc', '.ccc', 'cc*c', 'cccc', 'c+cc', 'cccc', 'ccc.', 'cc..'], -2, 2],
  sway: [['..cc', '.ccc', 'cc*c', 'cccc', 'c+cc', 'cccc', 'cc..', 'c...'], -2, 2],
  flow: [['......cc', '...ccccc', '.cc*cccc', 'ccccc+c.', 'cccc....', '.cc.....'], -7, 2],
  rise: [['cc......', 'cc*cc...', '.ccccc+.', '...ccccc', '.....ccc'], -6, 0],
  limp: [['.cc', 'ccc', 'c*c', 'ccc', 'cc+', 'cc.', 'c..'], -1, 3],
};
const drape =
  (k: Drape): Layer =>
  (g, a) => {
    const [rows, x, y] = DRAPES[k];
    rows.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        if (ch === '.') return;
        const X = a.tx + x + i;
        const Y = a.ty + y + j;
        if (ch === '*') return put(g, X, Y, STAR);
        if (ch === '+') return put(g, X, Y, '#b8bcff');
        const left = r[i - 1] === undefined || r[i - 1] === '.';
        const below = rows[j + 1]?.[i] === undefined || rows[j + 1][i] === '.';
        put(g, X, Y, left ? YARA_SHAWL[3] : below ? YARA_SHAWL[1] : YARA_SHAWL[2]);
      }),
    );
  };

/** The long braid from the nape: plaited links in two tones, a bead every few links, a tuft at the end. */
function braid(a0: number, curl: number, wave: number, n = 13): Layer {
  const beads = [BEAD.o, BEAD.q, BEAD.y, BEAD.r];
  return (g, a) =>
    ribbon(g, a.hx + 2, a.hy + 6, n, (t) => Math.PI * (a0 + curl * t + wave * Math.sin(t * Math.PI * 2)), (t, i) => {
      if (t > 0.86) return [HAIR[3], HAIR[1]];
      if (i % 4 === 2) return [beads[(i >> 2) % 4], HAIR[1]];
      return i % 2 ? [HAIR[3], HAIR[2], HAIR[0]] : [HAIR[4], HAIR[2], HAIR[1]];
    });
}

// ------------------------------------------------------------------ the staff and its charms

/**
 * The carved staff from its grip: `len` px toward its head, `back` px to its foot, carved bands along the shaft. Its
 * head is a carved ring holding a spirit stone (cyan; `bright` flares it); from the ring hang two cords with beads
 * and a white feather, swinging the other way (`swing`: -1..1).
 */
function staff(dir: Dir, len: number, back: number, o: { bright?: boolean; swing?: number; dim?: boolean } = {}): Item {
  return (g, x, y) => {
    const [sx, sy] = STEP[dir];
    const diag = sx !== 0 && sy !== 0;
    for (let i = -back; i <= len - 2; i++) {
      const X = x + sx * i;
      const Y = y + sy * i;
      const band = i > 0 && i % 5 === 0;
      // (3 px thick so it reads at 8x: a lit side, the wood, a shaded side)
      if (diag) {
        put(g, X + (sx === sy ? 1 : -1), Y, WOOD[4]);
        put(g, X, Y, band ? WOOD[4] : WOOD[3]);
        put(g, X + (sx === sy ? -1 : 1), Y, band ? WOOD[3] : WOOD[2]);
        put(g, X, Y + 1, WOOD[1]);
      } else if (sx === 0) {
        put(g, X - 1, Y, WOOD[4]);
        put(g, X, Y, band ? WOOD[4] : WOOD[3]);
        put(g, X + 1, Y, band ? WOOD[2] : WOOD[1]);
      } else {
        put(g, X, Y - 1, WOOD[4]);
        put(g, X, Y, band ? WOOD[4] : WOOD[3]);
        put(g, X, Y + 1, band ? WOOD[2] : WOOD[1]);
      }
    }
    // the head: a carved ring round a spirit stone
    const cx = x + sx * (len + 1);
    const cy = y + sy * (len + 1);
    stamp(g, ['.bab.', 'b...a', 'a...b', 'b...a', '.aba.'], { a: WOOD[3], b: WOOD[2] }, cx - 2, cy - 2);
    put(g, cx - 2, cy - 1, WOOD[4]);
    put(g, cx - 1, cy - 2, WOOD[4]);
    const S = o.dim ? ['#2a4a5a', '#3a6a7a', '#5a8a9a'] : [YARA_SPIRIT[1], YARA_SPIRIT[2], YARA_SPIRIT[3]];
    stamp(g, ['ba.', 'cba', '.c.'], { a: S[2], b: S[1], c: S[0] }, cx - 1, cy - 1);
    if (!o.dim) put(g, cx - 1, cy - 1, '#ffffff');
    if (o.bright) {
      for (const [dx, dy] of [
        [-4, 0],
        [4, 0],
        [0, -4],
        [0, 4],
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
      ])
        put(g, cx + dx, cy + dy, YARA_SPIRIT[3]);
      sparkle(g, cx + 5, cy - 5, YARA_SPIRIT[2], '#ffffff', true);
    }
    // the charms: two cords from under the ring (beads, then a feather), swinging
    const sw = Math.round((o.swing ?? 0) * 2);
    const hang = (hx: number, n: number, beads: string[], feather: boolean) => {
      for (let k = 1; k <= n; k++) {
        const X = hx + Math.round((sw * k) / n);
        const Y = cy + 2 + k;
        put(g, X, Y, k === n && !feather ? beads[0] : k % 2 ? '#c8b89a' : beads[k % beads.length]);
      }
      if (feather) {
        const X = hx + sw;
        const Y = cy + 3 + n;
        stamp(g, ['W', 'W', 'w', 'w', 'v'], { W: '#ffffff', w: '#d8d8ea', v: '#9a9abc' }, X, Y);
      }
    };
    hang(cx - 2, 3, [BEAD.o, BEAD.y], false);
    hang(cx + 2, 3, [BEAD.q, BEAD.r], true);
  };
}

// ------------------------------------------------------------------ spirit light and effects

/** Soft cyan spirit-light round a hand: a few motes circling it (`ph` turns them), a brighter heart at `big`. */
const spiritHand =
  (which: 'near' | 'far', ph = 0, big = false): Layer =>
  (g, a) => {
    const [hx, hy] = a[which];
    const r = big ? 4 : 3;
    const n = big ? 6 : 3;
    for (let k = 0; k < n; k++) {
      const t = ph + (k / n) * Math.PI * 2;
      const X = Math.round(hx + 0.5 + Math.cos(t) * r);
      const Y = Math.round(hy + 0.5 + Math.sin(t) * r * 0.8);
      put(g, X, Y, k % 2 ? YARA_SPIRIT[2] : YARA_SPIRIT[3]);
    }
    if (big) sparkle(g, hx + 1, hy - 4, YARA_SPIRIT[2], '#ffffff', true);
  };

/** A swoosh of spirit light trailing a swing: an arc of cyan pixels. */
const swoosh =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    for (const [rr, col] of [
      [r, YARA_SPIRIT[3]],
      [r - 1, YARA_SPIRIT[2]],
      [r - 2, YARA_SPIRIT[1]],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        const ang = a0 + (a1 - a0) * t;
        if (t > 0.15 || rr === r) put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

/** A bolt of spirit light flying right: a bright head, a fading trail. */
const bolt =
  (x: number, y: number): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    stamp(g, ['.cb.', 'cbaa', '.cb.'], { a: '#ffffff', b: YARA_SPIRIT[3], c: YARA_SPIRIT[2] }, X - 2, Y - 1);
    for (const [dx, c] of [
      [-4, YARA_SPIRIT[3]],
      [-6, YARA_SPIRIT[2]],
      [-9, YARA_SPIRIT[2]],
      [-12, YARA_SPIRIT[1]],
    ] as Array<[number, string]>)
      put(g, X + dx, Y, c);
  };

/** Stars rising round her (the finisher, Call). */
const stars =
  (pts: Array<[number, number, boolean?]>): Layer =>
  (g, a) => {
    for (const [x, y, big] of pts) sparkle(g, a.fx + x, a.fy - y, big ? YARA_SPIRIT[2] : STAR, '#ffffff', !!big);
  };

/** A ghostly paw print and a wisp at her feet (Call: the next spirit coming). */
const callSign =
  (x: number): Layer =>
  (g, a) => {
    stamp(g, ['a.a.a', '.....', '.aaa.', 'aaaaa', '.aaa.'], { a: YARA_SPIRIT[2] }, a.fx + x - 2, a.fy - 5);
    for (const [dx, dy, c] of [
      [-3, 8, YARA_SPIRIT[3]],
      [2, 10, '#ffffff'],
      [4, 7, YARA_SPIRIT[2]],
      [0, 13, YARA_SPIRIT[3]],
    ] as Array<[number, number, string]>)
      put(g, a.fx + x + dx, a.fy - dy, c);
  };

/** Her staff lying on the ground (knocked out). */
const droppedStaff: Layer = (g, a) => staff('r', 15, 0, { dim: true })(g, a.fx - 13, a.fy - 1);

/** Dizzy little stars circling the head. */
const dizzy: Layer = (g, a) => {
  for (const [dx, dy] of [
    [2, -2],
    [9, -4],
    [15, -1],
  ])
    sparkle(g, a.hx + dx, a.hy + dy, YARA_SPIRIT[2], '#ffffff');
};

// ------------------------------------------------------------------ poses

export const YARA_POSES: Record<string, RigPose> = {
  // the staff upright in her far hand, spirit-light circling the near one
  idle0: { near: { at: [-7, 19] }, far: { at: [9, 19], item: staff('u', 14, 9, { swing: -0.2 }) }, farFront: true, back: [braid(0.62, 0.02, 0.03), drape('hang')], front: [spiritHand('near', 0.3)] },
  idle1: { near: { at: [-7, 18] }, far: { at: [9, 18], item: staff('u', 14, 8, { swing: 0.2 }) }, farFront: true, dy: 1, back: [braid(0.63, 0.02, -0.03), drape('sway')], front: [spiritHand('near', 1.4)] },
  // the shawl and the braid swing a frame behind the breath, the spirit light circles on
  idle2: { near: { at: [-7, 18] }, far: { at: [9, 18], item: staff('u', 14, 8, { swing: 0.5 }) }, farFront: true, dy: 1, back: [braid(0.66, 0.03, -0.06), drape('sway')], front: [spiritHand('near', 2.5)] },
  idle3: { near: { at: [-7, 19] }, far: { at: [9, 19], item: staff('u', 14, 9, { swing: 0.1 }) }, farFront: true, back: [braid(0.65, 0.03, 0), drape('hang')], front: [spiritHand('near', 3.6)] },
  dash: { near: { at: [-5, 19] }, far: { at: [9, 20], item: staff('ur', 10, 6, { swing: -0.8 }) }, farFront: true, legs: 'run', dx: 1, lean: 1, back: [braid(0.95, -0.05, 0.05), drape('flow')] },
  // the staff thrust out, a bolt of spirit light leaping from its stone
  slashA: {
    near: { at: [6, 23] },
    far: { at: [13, 23], item: staff('r', 10, 6, { bright: true, swing: -0.8 }) },
    farFront: true,
    legs: 'lunge',
    dx: 2,
    lean: 1,
    back: [braid(0.85, -0.05, 0.05), drape('sway')],
    front: [bolt(39, 15), spiritHand('near', 0.8)],
  },
  // a sweeping swing that leaves an arc of spirit light
  slashB: {
    near: { at: [8, 16] },
    far: { at: [12, 17], item: staff('dr', 9, 4, { swing: 1 }) },
    farFront: true,
    legs: 'lunge',
    dx: 2,
    lean: 1,
    bow: 1,
    back: [braid(0.9, -0.05, 0.07), drape('flow')],
    front: [swoosh(12, 15, 13, 2.0, 0.0)],
  },
  // the staff raised behind her, its stone flaring
  windup: {
    near: { at: [-2, 31], item: staff('ul', 8, 5, { bright: true, swing: 0.5 }) },
    far: { at: [6, 19] },
    legs: 'crouch',
    armsUp: true,
    dy: 1,
    back: [braid(0.6, 0.05, 0.03), drape('hang')],
    front: [spiritHand('far', 0.5)],
  },
  // the staff crosswise, a ward of spirit light before it
  parry: {
    near: { at: [4, 20] },
    far: { at: [12, 20], item: staff('u', 9, 7, { swing: -0.4 }) },
    farFront: true,
    legs: 'crouch',
    dy: 1,
    back: [braid(0.62, 0.02, 0.03), drape('hang')],
    front: [swoosh(13, 13, 9, 1.3, -1.3), spiritHand('near', 0.2)],
  },
  hurt: {
    near: { at: [-6, 18] },
    far: { at: [6, 16], item: staff('ul', 10, 7, { swing: 1 }) },
    farFront: true,
    dx: -1,
    lean: -1,
    dy: 1,
    head: 'squint',
    back: [braid(0.35, -0.1, 0.06), drape('rise')],
  },
  leap: {
    near: { at: [3, 26] },
    far: { at: [10, 24], item: staff('ur', 9, 6, { bright: true, swing: 0.8 }) },
    farFront: true,
    legs: 'tuck',
    back: [braid(0.75, -0.25, 0.04), drape('rise')],
  },
  // knocked out: on one knee, head bowed, the staff fallen beside her
  down: { near: { at: [8, 7] }, far: { at: [4, 6] }, legs: 'kneel', dy: 1, lean: 2, bow: 3, head: 'ko', back: [braid(0.56, -0.02, 0.01), drape('limp'), droppedStaff], front: [dizzy] },
  // the finisher: the staff held high in both hands, eyes shut, calling, stars rising round her
  fin: {
    near: { at: [-9, 32] },
    far: { at: [13, 33], item: staff('u', 8, 7, { bright: true, swing: 0.3 }) },
    farFront: true,
    legs: 'lunge',
    head: 'call',
    back: [braid(0.7, -0.08, 0.06), drape('flow')],
    front: [spiritHand('near', 0.4, true), stars([[-14, 34, true], [22, 38, true], [-17, 18], [24, 20], [-4, 40], [6, 44]])],
  },
  // Call: the staff planted, a hand raised and glowing, a spirit's sign at her feet
  cast: {
    near: { at: [-10, 29] },
    far: { at: [9, 19], item: staff('u', 14, 9, { bright: true, swing: 0 }) },
    farFront: true,
    head: 'call',
    back: [braid(0.62, 0.02, 0.03), drape('hang')],
    front: [spiritHand('near', 0.6, true), callSign(20)],
  },
};

/** Hero select card: the staff upright, its stone blazing, spirit-light round her hand, before an indigo glow with a
 *  cyan heart. */
export const YARA_CARD: HeroCardSpec = {
  pose: { near: { at: [-3, 21] }, far: { at: [9, 19], item: staff('u', 14, 9, { bright: true, swing: -0.2 }) }, farFront: true, head: 'call', back: [braid(0.62, 0.02, 0.03), drape('sway')], front: [spiritHand('near', 0.9, true)] },
  glow: ['#c4f8ff', '#3a3aa8'],
  motes: [[5, 12], [34, 9], [35, 28]],
};

/** By the campfire (two breaths): sat back on her heels, the staff across her lap, a mote of spirit light in her palm. */
export const YARA_CAMP: [RigPose, RigPose] = [
  { near: { at: [6, 21] }, far: { at: [9, 19], item: staff('u', 13, 9, { swing: -0.2 }) }, farFront: true, back: [braid(0.62, 0.02, 0.03), drape('hang')], front: [spiritHand('near', 0.5)] },
  { near: { at: [6, 20] }, far: { at: [9, 18], item: staff('u', 13, 8, { swing: 0.2 }) }, farFront: true, dy: 1, back: [braid(0.63, 0.02, -0.03), drape('sway')], front: [spiritHand('near', 1.6)] },
];
