// Brann, the bellwarden (see docs/content-bible.md section 3): a broad, calm monk with a shaved head, a grey beard and
// pale skin, in saffron-and-maroon robes with prayer beads, a huge bronze temple bell carried on his back (and swung as
// a shield). Fight frames `brann_${pose}` on the shared rig (art-rig.ts); `bellSprite` is the bell, at any size and
// tilt (the finisher and the portrait use it too).
import { grid, put, stamp, toCanvas, type Grid, type Pal, type Shade } from './art';
import { and, ell, fill, or, rimShade, sphere } from './art-paint';

const INK_B = '#140c1c';
import { sparkle, type HeroCardSpec, type Layer, type Rig, type RigPose } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#6a4652', '#b48688', '#e0b8a8', '#f6d8c6', '#fff4ea'];
const BEARD = ['#2e2e3c', '#545466', '#80808e', '#aeaebc', '#dcdce6'];
export const BRANN_SAFFRON = ['#6a2a0a', '#b45610', '#ea861c', '#ffb43c', '#ffe08a'];
export const BRANN_MAROON = ['#240c16', '#481422', '#701e2c', '#943240', '#b85258'];
/** The bell's bronze, dark to light (6 tones). */
export const BRONZE = ['#2e160c', '#5e3214', '#9a5a24', '#cc8c40', '#eec070', '#fff0b8'];
const SANDAL = ['#2a1810', '#4a2c18', '#6e4426', '#98663a'];

export const BRANN_PAL: Pal = {
  // the face (painted by hand): skin, brows, eyes, the mouth in the beard
  z: SKIN[1], S: SKIN[3], T: SKIN[4], E: SKIN[2], k: '#140c1c', x: '#4a2030', W: '#ffffff', b: BEARD[3], n: BEARD[1],
  // the prayer beads (dark wood, a light bead), the sash's knot
  o: '#4a2a1a', O: '#a8784a', q: BRANN_SAFFRON[4], Q: BRANN_SAFFRON[1],
  // skin fists and toes
  F: SKIN[3], f: SKIN[2], u: SKIN[1],
};
export const BRANN_SHADES: Record<string, Shade> = {
  s: { ramp: SKIN, top: [4, 4], left: [4, 3], right: [1], bottom: [1], mid: 3 }, // the shaved head
  d: { ramp: BEARD, same: 'x', top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // the beard
  y: { ramp: BRANN_SAFFRON, same: 'qQ', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  m: { ramp: BRANN_MAROON, same: 'oO', top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
  v: { ramp: BRANN_MAROON, top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // the robe's skirt
  h: { ramp: BRANN_SAFFRON, top: [3], left: [3], right: [1], bottom: [1], mid: 2 }, // its saffron hem
  e: { ramp: SANDAL, same: 'F', top: [3], left: [2], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// The shaved head (lit from its own shape), bushy grey brows over calm, narrowed eyes, a grey beard.
const HEAD = [
  '................',
  '.....ssssss.....',
  '...ssssssssss...',
  '..sssssssssssss.',
  '.ssssssssssssss.',
  '.ssssssSSbbbSbbb',
  '.sssssSSSkkSSSkk',
  '.sssssEzSSSSSSSS',
  '..ssssEzSSSSSSST',
  '..zssssSSdddSSdS',
  '...zdddddddxxdd.',
  '....dddddddddd..',
  '......dddddd....',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // eyes shut tight, teeth set
  squint: face(HEAD, { 5: 'SbbbSSbbb', 6: 'SSkkkSkkk', 10: 'dddxWxdd.' }),
  ko: face(HEAD, { 5: 'SSSSSSSSS', 6: 'SSkSkSkSk', 7: 'SSSkSSSkS', 10: 'ddddxddd.' }),
  // a shout: brows down, eyes wide open, mouth open in the beard
  shout: face(HEAD, { 5: 'SSbbSSSbb', 6: 'SSSkWSSkW', 10: 'dddxxxxd.', 11: 'ddxxddd..' }),
};

// Broad shoulders: the saffron upper robe over the maroon, the prayer beads in a loop, a saffron sash.
const TORSO = [
  '..yyyyyy..yyyyy...',
  '.yyyyyyyoyyoyyyyy.',
  'yyyyyyyyoyyoyyyyyy',
  'yyyyymmmmoomyyyyyy',
  '.yyyymmmmmOmmyyyy.',
  '..yymmmmmmmmmmyy..',
  '..yymmmmmmmmmmmy..',
  '..yyyyyyyyqyyyyy..',
  '..mmmmmmmmQmmmmm..',
  '..mmmmmmmmmmmmmm..',
];

// The robe to the ankles with a saffron hem, sandals; 17 wide, the feet centred on x = 8.
const LEGS: Record<string, string[]> = {
  stand: [
    '..vvvvvvvvvvvvv..',
    '..vvvvvvvvvvvvv..',
    '.vvvvvvvvvvvvvvv.',
    '.vvvvvvvvvvvvvvv.',
    '.vvvvvvvvvvvvvvv.',
    'vvvvvvvvvvvvvvvvv',
    'hhhhhhhhhhhhhhhhh',
    '..eeee....eeee...',
    '..eeeFe...eeeFe..',
  ],
  run: [
    '...vvvvvvvvvvvvv.',
    '..vvvvvvvvvvvvvv.',
    '.vvvvvvvvvvvvvvv.',
    'vvvvvvvvvvvvvvvv.',
    'hhhhhh.vvvvvvvvvv',
    'ee.....hhhhhhhhhh',
    'ee.........eeee..',
    '...........eeeee.',
    '...........eeeeFe',
  ],
  lunge: [
    '...vvvvvvvvvvvvv.',
    '..vvvvvvvvvvvvvvv',
    '.vvvvvvvvvvvvvvvv',
    '.vvvvvvv.vvvvvvvv',
    'vvvvvvv...vvvvvvv',
    'hhhhhh....hhhhhhh',
    'eee.........eeee.',
    'eeee........eeeee',
    'eeeFe.......eeeeFe',
  ],
  crouch: [
    '..vvvvvvvvvvvvv..',
    '.vvvvvvvvvvvvvvv.',
    'vvvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvvv',
    'hhhhhhhhhhhhhhhhh',
    'eeeee......eeeee.',
    'eeeeFe.....eeeeFe',
  ],
  tuck: [
    '..vvvvvvvvvvvvv..',
    '.vvvvvvvvvvvvvvv.',
    '.vvvvvvvvvvvvvvv.',
    '..hhhhhhhhhhhhh..',
    '.....eeeee.eeee..',
    '.....eeeeeeeeeee.',
  ],
  kneel: [
    '..vvvvvvvvvvvvv..',
    '.vvvvvvvvvvvvvvv.',
    'vvvvvvvvvvvvvvvvv',
    'hhhhhhhhhhvvvvvv.',
    'eeee......hhhhhh.',
    '..........eeeeFe.',
  ],
  // sat cross-legged (camp)
  lotus: [
    '..vvvvvvvvvvvvv..',
    '.vvvvvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvvv',
    'hhhhhhhhhhhhhhhhh',
  ],
};

const FIST = ['FFf', 'Fff', 'ffu'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.55, BRANN_SAFFRON[4], BRANN_SAFFRON[3], BRANN_SAFFRON[2]],
  [1, SKIN[4], SKIN[3], SKIN[2]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.55, BRANN_SAFFRON[3], BRANN_SAFFRON[2], BRANN_SAFFRON[1]],
  [1, SKIN[3], SKIN[2], SKIN[1]],
];

export const BRANN_RIG: Rig = {
  pal: BRANN_PAL,
  shades: BRANN_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 8,
  torsoX: -9,
  torsoOverlap: 1,
  headX: 1,
  headOverlap: 1,
  shoulderNear: [4, 3],
  shoulderFar: [13, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [-1, -1],
};

// ------------------------------------------------------------------ the bell

/**
 * The temple bell, `w` wide and `h` tall (its crown's loop above that), its top centred on (cx, top) and tilted by
 * `ang` (radians, clockwise; 0 = hanging upright): a rounded shoulder, a body flaring a little to a thick lip, two
 * bands round it, rows of bosses on its upper panel and a round striking pad below, lit from the top left on the
 * bronze ramp. `glow` brightens it (a ring of light: Peal).
 */
export function bellSprite(g: Grid, cx: number, top: number, w = 13, h = 16, ang = 0, glow = 0): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const half = w / 2;
  // half-width at height v (0 = top of the shoulder .. h = the lip's bottom)
  const hw = (v: number): number => {
    if (v < 0) return -1;
    if (v < 3.2) return (half - 1) * Math.sqrt(Math.max(0, 1 - ((3.2 - v) / 3.6) ** 2));
    if (v > h) return -1;
    if (v > h - 2) return half;
    return half - 1 + ((v - 3.2) / (h - 5)) * 0.8;
  };
  // the bell's own frame: u across (0 = the axis), v down from the top
  const local = (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - top;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  const inside = (x: number, y: number) => {
    const [u, v] = local(x, y);
    return Math.abs(u) <= hw(v);
  };
  const R = Math.ceil(Math.hypot(w, h)) + 4;
  const tone = (i: number) => BRONZE[Math.max(0, Math.min(BRONZE.length - 1, Math.round(i + glow)))];
  for (let y = Math.floor(top - R); y <= top + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (!inside(x, y)) continue;
      const [u, v] = local(x, y);
      const k = hw(v) > 0 ? u / hw(v) : 0; // -1 (left edge) .. 1 (right edge)
      // a cylinder lit from the left, the shoulder lit from above
      let t = k < -0.6 ? 3.4 : k < -0.15 ? 2.9 : k < 0.4 ? 2.2 : k < 0.75 ? 1.6 : 1;
      if (v < 2.2) t += 0.9;
      // the lip: a thick rim, dark under it
      if (v > h - 2) t = k < -0.3 ? 3.4 : k < 0.5 ? 2.6 : 1.6;
      if (v > h - 0.8) t -= 1.2;
      // two bands: a bright edge over a dark line
      const vb = [Math.round(h * 0.28), Math.round(h * 0.62)];
      for (const b of vb) {
        if (Math.abs(v - b) < 0.5) t -= 1.4;
        else if (Math.abs(v - (b - 1)) < 0.5) t += 0.6;
      }
      // the bosses: a grid of studs on the upper panel
      if (w >= 9 && v > vb[0] + 0.5 && v < vb[1] - 1.5 && Math.abs(u) < hw(v) - 1.5) {
        const iu = Math.round(u / 2.5);
        const iv = Math.round((v - vb[0] - 1.5) / 2.2);
        if (Math.abs(u - iu * 2.5) < 0.6 && Math.abs(v - vb[0] - 1.5 - iv * 2.2) < 0.6) t += 1.4;
      }
      // the striking pad: a round boss low on the body (a little left of the axis, where it catches the light)
      if (w >= 9) {
        const pu = u + 1.2;
        const pv = v - (vb[1] + (h - 2 - vb[1]) / 2);
        const d = Math.hypot(pu, pv * 1.1);
        if (d < 1.9) t = d < 0.8 ? 4.2 : 3.2;
        else if (d < 2.6) t = Math.min(t, 1.2);
      }
      put(g, x, y, tone(t));
    }
  // the crown: a loop on top (the dragon handle, simplified)
  const [lx, ly] = [cx - s * -1.5, top - c * 1.5];
  for (const [du, dv, i] of [
    [-1, 0, 3],
    [-1, -1, 4],
    [0, -2, 4],
    [1, -1, 3],
    [1, 0, 2],
  ] as Array<[number, number, number]>)
    put(g, Math.round(lx + du * c - dv * s), Math.round(ly + du * s + dv * c), tone(i));
}

/** The bell carried on his back: hung from its ropes, its top just over his far shoulder, behind him. */
const bellOnBack =
  (dx = 0, dy = 0, ang = -0.12): Layer =>
  (g, a) => {
    bellSprite(g, a.tx - 2 + dx, a.ty - 10 + dy, 13, 17, ang);
    // the rope over his shoulder
    for (let i = 0; i < 4; i++) put(g, a.tx + 3 + dx + i, a.ty - 3 + dy + i, i % 2 ? BRANN_SAFFRON[1] : BRANN_SAFFRON[3]);
  };

/** The bell held by its crown in a hand (`hand`), hanging (or swung) from it: its top just under the fist. */
const bellIn =
  (hand: 'near' | 'far', ang = 0, w = 13, h = 16, glow = 0): Layer =>
  (g, a) => {
    const [x, y] = a[hand];
    bellSprite(g, x + 1 - Math.sin(ang) * 2, y + 2 + Math.cos(ang) * 0, w, h, ang, glow);
    stamp(g, FIST, BRANN_PAL, x - 1, y - 1);
  };

/** The bell held in front as a shield: face-on, both hands behind it. */
const bellShield =
  (x: number, y: number, glow = 0): Layer =>
  (g, a) =>
    bellSprite(g, a.fx + x, a.fy - y, 13, 16, 0, glow);

/** The prayer beads swinging from the near hand. */
const beadsIn: Layer = (g, a) => {
  const [x, y] = a.near;
  for (let i = 0; i < 5; i++) put(g, x + 1 + (i % 2), y + 3 + i, i === 4 ? '#a8784a' : '#4a2a1a');
};

// ------------------------------------------------------------------ effects

/** Sound rings: arcs rolling out from (x, y) relative to the feet, toward the right. */
const rings =
  (x: number, y: number, rs: number[], col = BRONZE[4]): Layer =>
  (g, a) => {
    for (const [i, r] of rs.entries())
      for (let t = -0.9; t <= 0.9; t += 0.08) {
        const px = Math.round(a.fx + x + Math.cos(t) * r);
        const py = Math.round(a.fy - y - Math.sin(t) * r);
        put(g, px, py, i === 0 ? BRONZE[5] : col);
      }
  };

const spark =
  (x: number, y: number, col: string, big = false): Layer =>
  (g, a) =>
    sparkle(g, a.fx + x, a.fy - y, col, '#ffffff', big);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const BRANN_POSES: Record<string, RigPose> = {
  // palms pressed together at his chest, the bell on his back
  idle0: P({ near: { at: [5, 14] }, far: { at: [6, 14] }, farFront: true, back: [bellOnBack()] }),
  idle1: P({ near: { at: [5, 13] }, far: { at: [6, 13] }, farFront: true, dy: 1, back: [bellOnBack(0, 1)] }),
  // the bell on his back swings a frame behind the breath
  idle2: P({ near: { at: [5, 13] }, far: { at: [6, 13] }, farFront: true, dy: 1, back: [bellOnBack(-1, 1, -0.2)] }),
  idle3: P({ near: { at: [5, 14] }, far: { at: [6, 14] }, farFront: true, back: [bellOnBack(0, 0, -0.04)] }),
  dash: P({ near: { at: [-6, 12] }, far: { at: [9, 13] }, legs: 'run', dx: 1, lean: 1, back: [bellOnBack(-1, 0, -0.3)] }),
  // the bell swung by its crown into the foe
  slashA: P({ near: { at: [12, 14], hidden: true }, far: { at: [17, 17], hidden: true }, legs: 'lunge', dx: 2, lean: 1, head: 'shout', front: [bellShield(15, 24, 1), rings(22, 15, [3, 5, 7])] }),
  // a palm strike, the air ringing ahead of it
  slashB: P({ near: { at: [15, 16] }, far: { at: [-3, 12] }, legs: 'lunge', dx: 2, lean: 1, head: 'shout', back: [bellOnBack(-1, 0, -0.25)], front: [rings(19, 16, [3, 5, 7])] }),
  // the bell heaved up over his head
  windup: P({ near: { at: [-2, 25] }, far: { at: [8, 25] }, legs: 'crouch', dy: 1, armsUp: true, front: [(g, a) => bellSprite(g, a.fx + 3, a.fy - 38, 12, 13, 0)] }),
  // braced behind the bell held up as a shield
  parry: P({ near: { at: [6, 14], hidden: true }, far: { at: [13, 15], hidden: true }, legs: 'crouch', dy: 1, front: [bellShield(14, 23)] }),
  hurt: P({ near: { at: [-6, 11] }, far: { at: [9, 15] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [bellOnBack(-1, 1, -0.35)] }),
  leap: P({ near: { at: [0, 26] }, far: { at: [7, 26] }, legs: 'tuck', armsUp: true, front: [(g, a) => bellSprite(g, a.fx + 3, a.fy - 38, 12, 13, 0)] }),
  // knocked out: on his knees, head bowed, the bell set down mouth-first beside him
  down: P({
    near: { at: [7, 7] },
    far: { at: [10, 7] },
    farFront: true,
    legs: 'kneel',
    dy: 2,
    lean: 1,
    bow: 3,
    head: 'ko',
    back: [(g, a) => bellSprite(g, a.fx - 12, a.fy - 15, 13, 16, 0)],
  }),
  // the finisher: the great bell raised high, ringing
  fin: P({
    near: { at: [-2, 27] },
    far: { at: [8, 27] },
    legs: 'lunge',
    armsUp: true,
    head: 'shout',
    front: [(g, a) => bellSprite(g, a.fx + 3, a.fy - 38, 12, 13, 0, 1), spark(-9, 33, BRONZE[4], true), spark(16, 30, BRONZE[4])],
  }),
  // Peal: a palm laid on the bell held before him, the bronze ringing out
  cast: P({ near: { at: [9, 15] }, far: { at: [14, 22] }, farFront: true, front: [bellIn('far', 0, 13, 16, 1), rings(23, 14, [3, 5, 7])] }),
};

/** Hero select card: palms together, eyes calm, the bell on his back, before a saffron glow with a pale gold heart. */
export const BRANN_CARD: HeroCardSpec = {
  pose: { near: { at: [5, 14] }, far: { at: [6, 14] }, farFront: true, back: [bellOnBack()], front: [beadsIn] },
  glow: ['#ffe8a0', '#c0601a'],
  motes: [[5, 14], [34, 10], [34, 29]],
};

/** By the campfire (two breaths): sat cross-legged in meditation, palms together, the bell set down behind him. */
export const BRANN_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [5, 13] }, far: { at: [6, 13] }, farFront: true, legs: 'lotus', back: [(g, a) => bellSprite(g, a.fx - 10, a.fy - 15, 13, 16, 0)] }),
  P({ near: { at: [5, 12] }, far: { at: [6, 12] }, farFront: true, legs: 'lotus', dy: 1, back: [(g, a) => bellSprite(g, a.fx - 10, a.fy - 15, 13, 16, 0)] }),
];

// ------------------------------------------------------------------ the portrait

/** `portrait_brann`: a 40x40 bust facing right (art-hero-portraits.ts adds it; his face window is [15, 11]): the bell's
 *  crown over his shoulder behind him, the shaved head, grey brows and beard, the saffron robe and the prayer beads. */
export function brannPortrait(): HTMLCanvasElement {
  const g = grid(40, 40);
  // the bell behind his back, its top over his far shoulder
  bellSprite(g, 9, 14, 14, 22, -0.1);
  // the robe: saffron over both shoulders, maroon at the neck, the beads in a loop
  const robe = ell(22, 42, 16, 11);
  fill(g, robe, sphere(BRANN_SAFFRON, 16, 34, 20, 12, 0.06));
  rimShade(g, robe, BRANN_SAFFRON[1]);
  const under = and(robe, (x, y) => Math.abs(x - 25) < 6 - (y - 31) * 0.2 && y >= 31);
  fill(g, under, sphere(BRANN_MAROON, 22, 32, 10, 8, 0.08));
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * Math.PI;
    const x = Math.round(25 - Math.cos(t) * 7);
    const y = Math.round(31 + Math.sin(t) * 6);
    put(g, x, y, i === 8 ? '#d8a868' : i % 2 ? '#4a2a1a' : '#7a4a2a');
  }
  // the shaved head, lit from the top left, a shine on the crown
  const skull = or(ell(24, 17, 10, 10.5), ell(27, 22.5, 7.4, 6.8));
  fill(g, skull, sphere(SKIN, 21, 12, 12, 12, 0.26));
  rimShade(g, skull, SKIN[1]);
  for (const [x, y] of [
    [19, 9],
    [20, 8],
    [21, 8],
    [20, 9],
  ])
    put(g, x, y, SKIN[4]);
  // the ear
  fill(g, ell(19.5, 20, 1.9, 2.7), sphere(SKIN, 18.5, 19, 3, 3.5, 0.1));
  put(g, 20, 21, SKIN[1]);
  // the grey beard and moustache, a calm mouth in it
  const beard = and(or(ell(28, 27.5, 7.6, 5), ell(22.5, 24.5, 2.6, 4)), (_x, y) => y >= 23.2);
  fill(g, beard, sphere(BEARD, 25, 24, 11, 8, 0.12));
  rimShade(g, beard, BEARD[1]);
  fill(g, ell(30.5, 24.6, 4.4, 1.1), () => BEARD[3]);
  put(g, 30, 26, '#4a2030');
  put(g, 31, 26, '#4a2030');
  // bushy grey brows over calm, half-closed eyes; the nose
  for (const [x0, x1, y] of [
    [22, 26, 16],
    [29, 33, 16],
  ])
    for (let x = x0; x <= x1; x++) put(g, x, y - (x === x0 + 1 || x === x0 + 2 ? 1 : 0), BEARD[3]);
  for (const [x0, x1] of [
    [23, 26],
    [30, 32],
  ])
    for (let x = x0; x <= x1; x++) put(g, x, 18, INK_B);
  put(g, 23, 19, SKIN[2]);
  put(g, 30, 19, SKIN[2]);
  put(g, 34, 21, SKIN[3]);
  put(g, 34, 22, SKIN[2]);
  put(g, 33, 23, SKIN[1]);
  return toCanvas(g);
}
