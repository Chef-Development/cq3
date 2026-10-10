// Solenne, the Dawnblade (round 7; docs/content-bible.md section 3): a tall sun-knight in white enamel plate trimmed
// with gold, a short crimson half-cape, warm brown skin, a cropped crop of silver-white hair under a gold circlet, and
// a long sword whose blade glows like morning light. Fight frames `solenne_${pose}` on the shared rig (art-rig.ts),
// her hero card, camp sprite, portrait (`portrait_solenne`) and map walker (art-hero-map.ts reads SOLENNE_WALKER).
import { grid, put, stamp, toCanvas, type Grid, type Pal, type Shade } from './art';
import { and, ell, fill, or, rimShade, sphere } from './art-paint';
import { swordMap } from './art-sword';
import { type Dir, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureLegs, type Rig, type RigPose, sparkle, stampAt } from './art-rig';

// ------------------------------------------------------------------ palette

const SKIN = ['#3a1c16', '#6a3826', '#985634', '#c27c4c', '#e2a46e'];
const HAIR = ['#5a5878', '#8c8eae', '#bcc0da', '#e6eaf6', '#ffffff'];
/** Ivory enamel: warm in the light, cool lavender in the shade. */
export const SOLENNE_PLATE = ['#4a4666', '#86809e', '#c2bacb', '#ece4d6', '#fffaec'];
export const SOLENNE_GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
export const SOLENNE_CRIMSON = ['#3a0a1a', '#6a1424', '#a82030', '#d83a3a', '#f06a58'];
/** The blade's morning light: white heart, pale gold, warm gold edge, an amber glow. */
export const SOLENNE_LIGHT = ['#f08a20', '#ffb840', '#ffe080', '#fff8d0', '#ffffff'];

export const SOLENNE_PAL: Pal = {
  // the face (painted by hand): skin, eyes (amber), mouth
  z: SKIN[1], s: SKIN[2], S: SKIN[3], T: SKIN[4], E: SKIN[2], k: '#140c1c', W: '#ffffff', e: '#c8701c', x: '#5a1a1a',
  // the circlet and its sun-stone
  G: SOLENNE_GOLD[3], g: SOLENNE_GOLD[2], o: SOLENNE_LIGHT[3], L: HAIR[4], H: HAIR[1],
  // gold trim on the plate (lit, mid), the sun on the breastplate
  Y: SOLENNE_GOLD[3], y: SOLENNE_GOLD[2], O: SOLENNE_GOLD[4], u: SOLENNE_GOLD[1],
  // the gauntlets (plate) and their gold cuffs
  R: SOLENNE_PLATE[4], r: SOLENNE_PLATE[3], q: SOLENNE_PLATE[2], Q: SOLENNE_PLATE[1], C: SOLENNE_CRIMSON[2],
};
export const SOLENNE_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, same: 'LH', top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  p: { ramp: SOLENNE_PLATE, same: 'YyOu', top: [4, 3], left: [3], right: [1, 2], bottom: [0, 1], mid: 3 },
  t: { ramp: SOLENNE_PLATE, same: 'y', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  c: { ramp: SOLENNE_CRIMSON, top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
  b: { ramp: SOLENNE_PLATE, same: 'y', top: [4], left: [3], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// A cropped crop of silver-white hair swept back, a gold circlet over the brow with a sun-stone at the front, warm
// brown skin, amber eyes under a level brow.
// (playtest round 8, L8, by hand: white hair under the gold circlet, level brows over one dark iris each, a long
// straight nose and a firm jaw: a knight, not a girl) 16 x 11.
const HEAD = [
  '..hh.hhhh.....',
  'hhLLhhLhhhhh..',
  'hhhHhhhHhhhhhh',
  'hhhhgGGGGGoGGg',
  'hHhzESSHHHSHHH',
  '.hzESSSEkSSEkS',
  '.hzEESSSTSSSSS',
  '.zzEESSSSSSSzT',
  '..zEESSSSSSSS.',
  '..zzEESSSxxSz.',
  '....zzEESSz...',
];
// (second pass, after the fresh-eyes review: 14 wide, not 16; the side of the face in shadow, sockets under the
// brows, a cheekbone and the nose's tip catching the light, the jaw shaded down to the chin)
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, r.length - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: eyes squeezed, teeth set
  squint: face(HEAD, { 5: 'zzSSzzS', 9: 'SWWxSz.' }),
  ko: face(HEAD, { 4: 'SSSSSSS', 5: 'zzSSzzS', 9: 'SSxSz.' }),
  // a battle cry: brows down, mouth open
  cry: face(HEAD, { 9: 'SxxxSz.', 10: 'zEExxz...' }),
};

// White enamel pauldrons with gold rims, a gold gorget, the breastplate with a gold sun on it, a gold belt, tassets.
const TORSO = [
  '.ppppp.....pppp..',
  'pppppppyYyppppppp',
  'ppppppppppppppppp',
  'yyyyyppppppppyyyy',
  '.ppppppOppppppp..',
  '..pppppYOYpppp...',
  '..pppppYOYpppp...',
  '..pppppYOYpppp...',
  '..pppppOYOpppp...',
  '..ppppppYppppp...',
  '..ppppppppppp....',
  '..yyyyyyYyyyyy...',
  '..tttttttttttt...',
];

// Ivory tassets over white greaves (gold at the knee), gold-trimmed sabatons; 17 wide, the feet centred on x = 8.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'b', legBack: '8', boot: 'b', bootBack: '8', sole: '9', cop: 'y', skirt: 't', fold: 'y', hem: 'y' });

const GAUNTLET = ['RRr', 'Rrq', 'rqQ'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.7, SOLENNE_PLATE[4], SOLENNE_PLATE[3], SOLENNE_PLATE[2]],
  [0.82, SOLENNE_GOLD[4], SOLENNE_GOLD[3], SOLENNE_GOLD[2]],
  [1, SOLENNE_PLATE[4], SOLENNE_PLATE[3], SOLENNE_PLATE[2]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.7, SOLENNE_PLATE[3], SOLENNE_PLATE[2], SOLENNE_PLATE[1]],
  [0.82, SOLENNE_GOLD[3], SOLENNE_GOLD[2], SOLENNE_GOLD[1]],
  [1, SOLENNE_PLATE[3], SOLENNE_PLATE[2], SOLENNE_PLATE[1]],
];

export const SOLENNE_RIG: Rig = {
  pal: { ...SOLENNE_PAL, '8': SOLENNE_PLATE[1], '9': SOLENNE_PLATE[0] },
  shades: SOLENNE_SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -8,
  torsoOverlap: 1,
  headX: 3,
  headOverlap: 1,
  shoulderNear: [4, 3],
  shoulderFar: [12, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: GAUNTLET,
  fistFar: GAUNTLET,
  fistAt: [-1, -1],
};

// ------------------------------------------------------------------ the dawn blade

// A long sword: a gold sun pommel, a crimson-wrapped grip, a gold crossguard and a blade of morning light (a white
// edge on top, pale gold, a warm gold edge under it, a white point).
const BLADE_PAL: Pal = {
  P: SOLENNE_GOLD[3], h: SOLENNE_CRIMSON[2], H: SOLENNE_CRIMSON[3], G: SOLENNE_GOLD[4], g: SOLENNE_GOLD[3], y: SOLENNE_GOLD[2], Y: SOLENNE_GOLD[1],
  A: SOLENNE_LIGHT[4], L: SOLENNE_LIGHT[3], M: SOLENNE_LIGHT[2], C: SOLENNE_LIGHT[1], t: '#ffffff',
};
/** Her blade at 8x: art-sword.ts's 4 px blade in morning light, a sun-stone in the gold guard. */
const LONG_PAL: Pal = { ...BLADE_PAL, T: '#ffffff', p: SOLENNE_GOLD[1], R: SOLENNE_LIGHT[4], r: SOLENNE_LIGHT[1] };
const blade =
  (dir: Dir): Item =>
  (g, x, y) =>
    stampAt(g, swordMap(dir, 14), LONG_PAL, x, y);

// ------------------------------------------------------------------ the cape and the light

type Cape = 'hang' | 'sway' | 'flow' | 'rise' | 'limp';
/** The short crimson half-cape from the shoulders, gold-hemmed: [rows, x, y] relative to the torso's top left. */
const CAPES: Record<Cape, [string[], number, number]> = {
  hang: [['..cc', '.ccc', 'cccc', 'cccc', 'cccc', 'cccc', 'ccc.', 'gg..'], -2, 1],
  sway: [['..cc', '.ccc', 'cccc', 'cccc', 'cccc', 'ccc.', 'cgg.', 'g...'], -2, 1],
  flow: [['.....cc', '...cccc', '.cccccc', 'cccccg.', 'ccgg...', 'gg.....'], -6, 1],
  rise: [['gg.....', 'cccgg..', '.ccccc.', '...cccc', '.....cc'], -6, 0],
  limp: [['..c', '.cc', 'ccc', 'ccc', 'ccc', 'ccc', 'cc.', 'cg.', 'g..'], -1, 2],
};
const cape =
  (k: Cape): Layer =>
  (g, a) => {
    const [rows, x, y] = CAPES[k];
    rows.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        if (ch === '.') return;
        const X = a.tx + x + i;
        const Y = a.ty + y + j;
        if (ch === 'g') return put(g, X, Y, SOLENNE_GOLD[(i + j) % 2 ? 2 : 3]);
        const left = r[i - 1] === undefined || r[i - 1] === '.';
        const below = rows[j + 1]?.[i] === undefined || rows[j + 1][i] === '.' || rows[j + 1][i] === 'g';
        // lit along its outer edge (top left), a fold down the middle, darker underneath
        put(g, X, Y, left ? SOLENNE_CRIMSON[3] : below ? SOLENNE_CRIMSON[1] : (i + j) % 4 === 0 ? SOLENNE_CRIMSON[1] : SOLENNE_CRIMSON[2]);
      }),
    );
  };

/** Motes of morning light drifting off the blade (sparkles in pale gold). */
const motes =
  (pts: Array<[number, number]>): Layer =>
  (g, a) => {
    pts.forEach(([x, y], i) => (i % 2 ? put(g, a.fx + x, a.fy - y, SOLENNE_LIGHT[3]) : sparkle(g, a.fx + x, a.fy - y, SOLENNE_LIGHT[2], SOLENNE_LIGHT[4])));
  };

/** A gold arc trailing a sweep of the blade. */
const sweep =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    for (const [rr, col] of [
      [r, SOLENNE_LIGHT[4]],
      [r - 1, SOLENNE_LIGHT[2]],
      [r - 2, SOLENNE_LIGHT[1]],
    ] as Array<[number, string]>)
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        const ang = a0 + (a1 - a0) * t;
        if (rr === r - 2 && t > 0.7) continue;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
  };

/** Sunfall's sun: a small sun over the raised blade, its rays round it. */
const sun =
  (x: number, y: number, r = 3): Layer =>
  (g, a) => {
    const X = a.fx + x;
    const Y = a.fy - y;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const d = Math.hypot(i, j);
        if (d > r + 0.3) continue;
        put(g, X + i, Y + j, d < r - 1.6 ? SOLENNE_LIGHT[4] : i + j < 0 ? SOLENNE_LIGHT[3] : SOLENNE_LIGHT[1]);
      }
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      for (const d of [r + 2, r + 3]) put(g, Math.round(X + Math.cos(ang) * d), Math.round(Y + Math.sin(ang) * d), d === r + 2 ? SOLENNE_LIGHT[2] : SOLENNE_LIGHT[1]);
    }
  };

/** The blade, dropped on the ground (knocked out). */
const droppedBlade: Layer = (g, a) => stampAt(g, swordMap('r', 14), LONG_PAL, a.fx - 17, a.fy - 1);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const SOLENNE_POSES: Record<string, RigPose> = {
  // the blade held up before her, a knight's guard; the far hand at her belt
  idle0: P({ near: { at: [7, 17], item: blade('ur') }, far: { at: [10, 15] }, back: [cape('hang')] }),
  idle1: P({ near: { at: [7, 16], item: blade('ur') }, far: { at: [10, 14] }, dy: 1, back: [cape('sway')], front: [motes([[19, 26]])] }),
  // the cape swings a frame behind the breath
  idle2: P({ near: { at: [7, 16], item: blade('ur') }, far: { at: [10, 14] }, dy: 1, back: [cape('sway')], front: [motes([[20, 28]])] }),
  idle3: P({ near: { at: [7, 17], item: blade('ur') }, far: { at: [10, 15] }, back: [cape('sway')] }),
  dash: P({ near: { at: [-6, 17], item: blade('l') }, far: { at: [7, 18] }, legs: 'run', dx: 1, lean: 1, back: [cape('flow')] }),
  // a cut down and forward
  slashA: P({ near: { at: [12, 20], item: blade('dr') }, far: { at: [8, 17] }, legs: 'lunge', dx: 2, lean: 1, back: [cape('flow')], front: [sweep(9, 16, 15, 1.9, -0.6)] }),
  // a sweep level with her chest
  slashB: P({ near: { at: [12, 23], item: blade('r') }, far: { at: [8, 17] }, legs: 'lunge', dx: 2, lean: 1, head: 'cry', back: [cape('flow'), sweep(8, 17, 14, 2.4, 0.4)] }),
  // the blade raised back over her head in both hands
  windup: P({ near: { at: [-2, 30], item: blade('ul') }, far: { at: [0, 29], hidden: true }, legs: 'crouch', dy: 1, armsUp: true, back: [cape('hang')] }),
  // the blade held crosswise, point up, guarding
  parry: P({ near: { at: [9, 19], item: blade('u') }, far: { at: [11, 22] }, farFront: true, legs: 'crouch', dy: 1, back: [cape('hang')], front: [motes([[13, 30], [8, 25]])] }),
  hurt: P({ near: { at: [-5, 17], item: blade('dl') }, far: { at: [8, 21] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [cape('rise')] }),
  leap: P({ near: { at: [6, 31], item: blade('ur') }, far: { at: [8, 30], hidden: true }, legs: 'tuck', armsUp: true, back: [cape('rise')] }),
  // knocked out: on one knee, the blade dropped beside her
  down: P({ near: { at: [7, 11] }, far: { at: [10, 10] }, farFront: true, legs: 'kneel', dy: 2, lean: 2, bow: 3, head: 'ko', back: [cape('limp'), droppedBlade] }),
  // Sunfall: the blade raised high, a sun kindling over its point
  fin: P({ near: { at: [5, 33], item: blade('ur') }, far: { at: [7, 32], hidden: true }, legs: 'lunge', armsUp: true, head: 'cry', back: [cape('flow')], front: [sun(19, 38, 3)] }),
  // Gleam: the blade up before her face, a glint running up it, the free hand open
  cast: P({
    near: { at: [8, 19], item: blade('u') },
    far: { at: [14, 25] },
    farFront: true,
    back: [cape('sway')],
    front: [motes([[12, 34], [5, 28], [16, 24], [3, 33]]), (g, a) => sparkle(g, a.fx + 9, a.fy - 25, SOLENNE_LIGHT[2], '#ffffff', true)],
  }),
};

/** Hero select card: the blade up in a knight's guard, before a sunrise glow with a white-gold heart. */
export const SOLENNE_CARD: HeroCardSpec = {
  pose: { near: { at: [7, 18], item: blade('ur') }, far: { at: [10, 15] }, back: [cape('hang')], front: [motes([[19, 27], [21, 31]])] },
  glow: ['#fff4c8', '#e07a20'],
  motes: [[5, 13], [34, 9], [35, 29]],
};

/** By the campfire (two breaths): the blade stood point-down, both gauntlets stacked on its pommel. */
export const SOLENNE_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [9, 22], item: blade('d') }, far: { at: [10, 23] }, farFront: true, back: [cape('hang')] }),
  P({ near: { at: [9, 21], item: blade('d') }, far: { at: [10, 22] }, farFront: true, dy: 1, back: [cape('sway')] }),
];

// ------------------------------------------------------------------ the map walker (art-hero-map.ts draws it)

/** At map scale: the silver crop and circlet, white plate, the crimson half-cape, the glowing blade at her side. */
export const SOLENNE_WALKER = {
  pal: {
    h: '#bcc0da', H: '#ffffff', G: '#f2c230', S: '#c27c4c', s: '#985634', k: '#140c1c', p: '#ece4d6', P: '#fffaec', q: '#c2bacb',
    y: '#d8901c', c: '#a82030', C: '#d83a3a', b: '#c2bacb', B: '#86809e', L: '#fff8d0', l: '#ffe080',
  } as Pal,
  top: [
    '...hhHh....',
    '..hHhhhh...',
    '..hGGGGG...',
    '..hhSkSk...',
    '..chSSSs..L',
    '.cqpPPPpq.l',
    'Ccqpyyypqyl',
    '.cqpPPPpq..',
    '..yyyyyyy..',
    '..ppppppp..',
  ],
  legs: {
    stand: ['...bb.bb...', '..BbB.BbB..'],
    a: ['..bb...bb..', '.BbB...BbB.'],
    pass: ['....bbb....', '...BbbB....'],
    b: ['..bb...bb..', '.BBb...BBb.'],
  },
  flap: [['C.', 'cC'], -1, 5] as [string[], number, number],
};

// ------------------------------------------------------------------ the portrait (40x40, facing right)

/** Her dialogue portrait: the bust in white-gold plate, the crimson cape over a shoulder, the silver crop, the circlet's
 *  sun-stone; her face window is PORTRAIT_FACE_AT.solenne. */
export function solennePortrait(): HTMLCanvasElement {
  const g: Grid = grid(40, 40);
  // the cape behind her far shoulder, and the near pauldron's crimson drape
  const capeB = or(ell(8, 37, 9, 7), ell(6, 32, 5, 5));
  fill(g, capeB, sphere(SOLENNE_CRIMSON, 3, 28, 12, 10, 0.06));
  rimShade(g, capeB, SOLENNE_CRIMSON[1]);
  // the shoulders in white enamel, gold rims, the gorget
  const chest = ell(22, 42, 15, 11);
  fill(g, chest, sphere([SOLENNE_PLATE[1], SOLENNE_PLATE[2], SOLENNE_PLATE[3], SOLENNE_PLATE[4]], 15, 32, 20, 12, 0.18));
  rimShade(g, chest, SOLENNE_PLATE[1]);
  const pauldron = or(ell(10, 35, 6.5, 4.6), ell(33, 35, 5.4, 4.2));
  fill(g, pauldron, sphere([SOLENNE_PLATE[1], SOLENNE_PLATE[2], SOLENNE_PLATE[3], SOLENNE_PLATE[4]], 6, 31, 12, 8, 0.2));
  rimShade(g, pauldron, SOLENNE_PLATE[1]);
  for (let x = 4; x <= 38; x++)
    for (let y = 33; y <= 40; y++) if (pauldron(x, y) && !pauldron(x, y + 1) && y < 40) put(g, x, y, (x + y) % 3 ? SOLENNE_GOLD[2] : SOLENNE_GOLD[3]);
  // the gorget's gold collar and the sun on the breastplate
  for (let x = 17; x <= 29; x++) {
    put(g, x, 31, SOLENNE_GOLD[3]);
    put(g, x, 32, SOLENNE_GOLD[2]);
  }
  stamp(g, ['..O..', '.OYO.', 'OYGYO', '.OYO.', '..O..'], { O: SOLENNE_GOLD[2], Y: SOLENNE_GOLD[3], G: SOLENNE_GOLD[4] }, 21, 35);
  // the neck
  fill(g, and(ell(25, 29, 4.2, 4), (_x, y) => y < 31), sphere(SKIN, 23, 26, 6, 5, 0.1));
  // the silver crop: short and tousled, close to the skull, tufts along its top and at the back, the nape bare
  const hair = or(ell(21, 13.8, 10, 8.2), ell(13.5, 13, 4.2, 5.6), ell(15, 6.6, 2.4, 1.8), ell(19.5, 5.4, 2.6, 1.8), ell(24.5, 5.6, 2.4, 1.6), ell(11.4, 9.6, 2, 2.2));
  fill(g, hair, sphere(HAIR, 13, 4, 18, 14, 0.12, 0.05));
  rimShade(g, hair, HAIR[1], 1);
  // tufts: little spikes on the outline (lit on top), short grooves between them, lit clusters toward the light
  for (const [x, y] of [
    [13, 5],
    [17, 3],
    [22, 3],
    [27, 4],
    [9, 9],
  ])
    put(g, x, y, HAIR[3]);
  for (const [x, y, n] of [
    [16, 8, 2],
    [21, 7, 3],
    [26, 8, 2],
    [14, 12, 2],
    [19, 11, 2],
    [12, 16, 2],
    [24, 11, 2],
  ])
    for (let i = 0; i < n; i++) put(g, x - i, y + i, HAIR[1]);
  for (const [x, y] of [
    [15, 6],
    [16, 6],
    [20, 5],
    [21, 5],
    [22, 5],
    [14, 9],
    [18, 8],
    [19, 8],
  ])
    put(g, x, y, HAIR[4]);
  // the face
  const faceM = and(or(ell(27, 20, 7.4, 7.6), ell(26.5, 25, 6.4, 4.6), ell(34.2, 22, 1.3, 1.5)), (_x, y) => y >= 12);
  fill(g, faceM, sphere(SKIN, 25, 16, 10, 11, 0.22));
  rimShade(g, faceM, SKIN[1]);
  fill(g, ell(20.5, 20.5, 1.8, 2.6), sphere(SKIN, 19.5, 19.5, 3, 3.5, 0.1));
  put(g, 21, 21, SKIN[1]);
  // the circlet: a gold band across the brow, the sun-stone at the front
  for (let x = 17; x <= 34; x++) {
    const y = Math.round(13.2 - (x - 17) * 0.06);
    if (!hair(x, y) && !faceM(x, y)) continue;
    put(g, x, y, x % 4 === 0 ? SOLENNE_GOLD[4] : SOLENNE_GOLD[3]);
    put(g, x, y + 1, SOLENNE_GOLD[2]);
  }
  stamp(g, ['.o.', 'oWo', '.o.'], { o: SOLENNE_LIGHT[2], W: '#ffffff' }, 28, 11);
  // level brows, amber eyes, a warm smile
  for (const [x0, x1] of [
    [23, 26],
    [29, 32],
  ])
    for (let x = x0; x <= x1; x++) put(g, x, 16, HAIR[1]);
  const eye: Pal = { k: '#140c1c', W: '#ffffff', e: '#d8801c', E: '#8a4a10', w: '#e8d8cc' };
  stamp(g, ['kkkk', '.Ek.'], eye, 23, 17);
  stamp(g, ['kkk', '.Ek'], eye, 30, 17);
  put(g, 34, 23, SKIN[2]);
  stamp(g, ['xxxx'], { x: '#5a1a1a' }, 28, 26);
  put(g, 30, 27, SKIN[4]);
  // a glint of the blade's light on the cheek
  put(g, 32, 20, SKIN[4]);
  return toCanvas(g);
}
