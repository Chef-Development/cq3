// Tess, Timekeeper (see docs/content-bible.md section 3): a small, sharp old clockmaker with a grey bun pinned with
// gears, round brass spectacles, a teal waistcoat over a cream blouse, a tool belt and a staff topped with a big brass
// pocket watch. Fight frames `tess_${pose}` on the shared rig (art-rig.ts): small (Moss's size class, a little taller),
// bright brass and teal against the cream, the watch the biggest shape she carries.
import { put, stamp, type Grid, type Pal, type Shade } from './art';
import { type Dir, type HeroCardSpec, type Item, type Layer, LEG_FEET_X, matureHeads, matureLegs, type Rig, type RigPose, sparkle, STEP } from './art-rig';

// ------------------------------------------------------------------ palette

const HAIR = ['#44445a', '#72728a', '#a2a2b0', '#cacad2', '#eeeef0'];
const SKIN = ['#7a463a', '#b4765e', '#dca486', '#f2c8ac', '#ffe6d4'];
/** The teal waistcoat: shadows toward blue-green night, light toward mint. */
export const TESS_TEAL = ['#0c2a30', '#15484c', '#1e6c68', '#309686', '#62c4aa', '#a8ecd0'];
const CREAM = ['#7a6a58', '#b4a488', '#dcd0b4', '#f6eed8', '#ffffff'];
/** Brass (the watch, the spectacles, the gears): shadows toward rust, light toward pale gold. */
export const TESS_BRASS = ['#4a2a10', '#8a5414', '#c88a1c', '#ecbc34', '#fff0a0'];
const SKIRT = ['#221a24', '#362a38', '#4c3c4c', '#665264'];
const LEATHER = ['#2a1810', '#4a2c1a', '#6e4426', '#98663a'];
const WOOD = ['#2a160c', '#4a2a16', '#6e4424', '#966236'];

export const TESS_PAL: Pal = {
  // the face (by hand): skin, eyes, the spectacles' brass rims and lens glint, the mouth
  z: SKIN[1], S: SKIN[3], T: SKIN[4], k: '#140c1c', Y: TESS_BRASS[3], y: TESS_BRASS[1], L: '#e8f8ff', m: '#8a3a3a', w: SKIN[2],
  // the gear pin in her bun
  G: TESS_BRASS[3], g: TESS_BRASS[1], O: TESS_BRASS[4],
  // brass buttons, the belt's buckle and tools (steel)
  B: TESS_BRASS[3], b: TESS_BRASS[1], i: '#c8d0e0', I: '#7a8296',
  // shoes
  K: '#2a2028', J: '#4a3c46',
};
export const TESS_SHADES: Record<string, Shade> = {
  h: { ramp: HAIR, top: [4, 3], left: [3], right: [1], bottom: [1], mid: 2 },
  s: { ramp: SKIN, same: 'zSTkYyLmw', top: [4], left: [3], right: [1], bottom: [1], mid: 2 },
  v: { ramp: TESS_TEAL, same: 'Bb', top: [5, 4], left: [4], right: [1], bottom: [1], mid: 3 },
  c: { ramp: CREAM, top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 },
  q: { ramp: SKIRT, top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
  l: { ramp: LEATHER, same: 'iIBb', top: [3], left: [3], right: [1], bottom: [0], mid: 2 },
};

// ------------------------------------------------------------------ body

// A grey bun pinned with a brass gear at the back, hair swept up, a sharp nose, round brass spectacles; 14 wide.
const HEAD = [
  '.GGG..........',
  'GgOgG.........',
  'GOkOGhh.......',
  '.GgGhhhhh.....',
  '..hhhhhhhhh...',
  '.hhhhhhhhhhh..',
  '.hhhhhhssssss.',
  '.hhhhhsssssss.',
  '.hhhhsyYysyYys',
  '..hhhsYkLyYkLS',
  '..hhhzsyYysyYy',
  '...hzssssssssw',
  '....zsssssmmsz',
  '.....zzssssss.',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 14 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: the eyes squeezed behind the lenses, the mouth tight
  squint: face(HEAD, { 9: 'YkkyYkkS', 12: 'sssmmmsz' }),
  // knocked out: the spectacles askew, little crossed eyes
  ko: face(HEAD, { 8: 'yYysssyYys', 9: 'YkYsssYkYS', 10: 'yYyssyYy', 12: 'sssmsssz' }),
  // a knowing smile (the card, the camp)
  smile: face(HEAD, { 12: 'ssmsmmmz' }),
  // a sharp "Hm!" (casting): the mouth open
  call: face(HEAD, { 12: 'sssssmkz' }),
};

// A cream blouse with puffed sleeves and a high collar, the teal waistcoat buttoned in brass, the tool belt (a
// wrench and a screwdriver tucked in); 13 wide.
const TORSO = [
  '...ccccccc...',
  '..ccccvcccc..',
  '.cccvvcvvccc.',
  '.ccvvvBvvvcc.',
  '..cvvvvvvvc..',
  '..cvvvvvvvc..',
  '..cvvvvvvvc..',
  '..cvvvBvvvc..',
  '..vvvvvvvvv..',
  '.lllliBblIll.',
  '..lllllllll..',
];

// A long dark skirt to the ankles, little buckled shoes; 13 wide, the feet centred on x = 6.
// the shared jointed legs (art-rig.ts STANCES, playtest round 8: L8, about three heads tall)
const LEGS = matureLegs({ leg: 'J', legBack: 'K', boot: 'J', bootBack: 'K', sole: 'K', skirt: 'q', robe: 2 });

const FIST = ['ws', 'zz'];
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.78, CREAM[4], CREAM[2]],
  [1, SKIN[3], SKIN[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.78, CREAM[2], CREAM[1]],
  [1, SKIN[2], SKIN[1]],
];

export const TESS_RIG: Rig = {
  pal: { ...{ ...TESS_PAL,  }, s: SKIN[2] },
  shades: TESS_SHADES,
  heads: matureHeads(HEADS, {drop: [4, 5], skin: 's'}),
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -6,
  torsoOverlap: 1,
  headX: 0,
  headOverlap: 2,
  shoulderNear: [2, 2],
  shoulderFar: [10, 2],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: FIST,
  fistFar: FIST,
  fistAt: [0, 0],
};

// ------------------------------------------------------------------ the watch staff

/**
 * The big brass pocket watch centred on (cx, cy): a 9 x 9 round case lit from the top left, a cream face with twelve
 * ticks (the four quarters marked), two hands (`at`: the minute hand's angle, 0 = 12 o'clock; the hour hand a third
 * round behind), the winding crown and its ring on top. `glow`: a halo of brass light round it (the ability, the
 * finisher).
 */
export function pocketWatch(g: Grid, cx: number, cy: number, at = 0.15, glow = false): void {
  const B = TESS_BRASS;
  if (glow)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const x = Math.round(cx + Math.cos(a) * 7);
      const y = Math.round(cy + Math.sin(a) * 7);
      put(g, x, y, (Math.round(a * 4) % 2 ? B[4] : B[3]));
    }
  // the crown and its ring
  put(g, cx, cy - 6, B[3]);
  put(g, cx - 1, cy - 7, B[4]);
  put(g, cx + 1, cy - 7, B[2]);
  put(g, cx, cy - 8, B[3]);
  put(g, cx, cy - 5, B[2]);
  // the case
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const d = i * i + j * j;
      if (d > 20) continue;
      let c = B[2];
      if (d > 12) c = i + j < -1 ? B[4] : i + j > 1 ? B[1] : B[3];
      else c = CREAM[3];
      if (d <= 12 && d > 8 && i + j > 2) c = CREAM[2];
      put(g, cx + i, cy + j, c);
    }
  // ticks at the quarters
  for (const [dx, dy] of [
    [0, -3],
    [3, 0],
    [0, 3],
    [-3, 0],
  ])
    put(g, cx + dx, cy + dy, B[1]);
  // the hands
  const ha = at * Math.PI * 2 - Math.PI / 2;
  for (let r = 1; r <= 2; r++) put(g, cx + Math.round(Math.cos(ha) * r), cy + Math.round(Math.sin(ha) * r), '#140c1c');
  const hb = (at - 0.33) * Math.PI * 2 - Math.PI / 2;
  put(g, cx + Math.round(Math.cos(hb)), cy + Math.round(Math.sin(hb)), '#3a2a20');
  put(g, cx, cy, B[1]);
  // a glint on the glass
  put(g, cx - 2, cy - 2, '#ffffff');
}

/** Her staff from the grip: dark wood `len` px toward the watch (`back` px to its foot, a brass ferrule there), a brass
 *  collar under the watch. */
function staff(dir: Dir, len: number, back: number, o: { at?: number; glow?: boolean } = {}): Item {
  return (g, x, y) => {
    const [sx, sy] = STEP[dir];
    const diag = sx !== 0 && sy !== 0;
    for (let i = -back; i <= len; i++) {
      const X = x + sx * i;
      const Y = y + sy * i;
      const c = i === -back || i === len ? TESS_BRASS[3] : WOOD[3];
      const d = i === -back || i === len ? TESS_BRASS[1] : WOOD[1];
      // (3 px thick so it reads at 8x: a lit side, the wood, a shaded side)
      const lit = i === -back || i === len ? TESS_BRASS[4] : '#b88a52';
      if (diag) {
        put(g, X + (sx === sy ? 1 : -1), Y, lit);
        put(g, X, Y, c);
        put(g, X + (sx === sy ? -1 : 1), Y, i === len ? TESS_BRASS[2] : WOOD[2]);
        put(g, X, Y + 1, d);
      } else if (sx === 0) {
        put(g, X - 1, Y, lit);
        put(g, X, Y, c);
        put(g, X + 1, Y, d);
      } else {
        put(g, X, Y - 1, lit);
        put(g, X, Y, c);
        put(g, X, Y + 1, d);
      }
    }
    pocketWatch(g, x + sx * (len + 5), y + sy * (len + 5), o.at ?? 0.15, o.glow);
  };
}

// ------------------------------------------------------------------ effects

/** Little brass gears spinning off (a hit, the finisher). */
const gears =
  (pts: Array<[number, number]>): Layer =>
  (g, a) => {
    for (const [x, y] of pts) stamp(g, ['.G.', 'GOG', '.G.'], { G: TESS_BRASS[2], O: TESS_BRASS[4] }, a.fx + x - 1, a.fy - y - 1);
  };

/** Arcs of time sweeping round (the finisher's rewind, Slow Time): dotted teal circles. */
const arcs =
  (cx: number, cy: number, rs: number[], a0: number, a1: number): Layer =>
  (g, a) => {
    for (const r of rs)
      for (let t = a0; t <= a1; t += 1 / (r * 1.5)) put(g, Math.round(a.fx + cx + Math.cos(t) * r), Math.round(a.fy - cy - Math.sin(t) * r), r % 2 ? TESS_TEAL[5] : TESS_TEAL[4]);
  };

/** A tick spark at a point (a jab landing). */
const tick =
  (x: number, y: number): Layer =>
  (g, a) =>
    sparkle(g, a.fx + x, a.fy - y, TESS_BRASS[3], '#ffffff', true);

/** Her staff lying on the ground (knocked out). */
const droppedStaff: Layer = (g, a) => staff('r', 12, 0)(g, a.fx - 14, a.fy - 1);

/** Dizzy little gears circling her head. */
const dizzy: Layer = (g, a) => {
  for (const [dx, dy] of [
    [1, -2],
    [7, -4],
    [12, -1],
  ])
    sparkle(g, a.hx + dx, a.hy + dy, TESS_BRASS[3], '#ffffff');
};

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const TESS_POSES: Record<string, RigPose> = {
  // the watch staff planted beside her, the other hand on her hip
  idle0: P({ near: { at: [7, 18], item: staff('u', 12, 17) }, far: { at: [-3, 19] } }),
  idle1: P({ near: { at: [7, 17], item: staff('u', 12, 16, { at: 0.2 }) }, far: { at: [-3, 18] }, dy: 1 }),
  // the watch on her staff swings a frame behind the breath
  idle2: P({ near: { at: [7, 16], item: staff('u', 12, 15, { at: 0.35 }) }, far: { at: [-3, 18] }, dy: 1 }),
  idle3: P({ near: { at: [7, 17], item: staff('u', 12, 16, { at: 0.1 }) }, far: { at: [-3, 19] } }),
  dash: P({ near: { at: [7, 18], item: staff('ur', 9, 5) }, far: { at: [-4, 19] }, legs: 'run', dx: 1, lean: 1 }),
  // a rap of the watch on the target, a tick of light
  slashA: P({ near: { at: [9, 25], item: staff('dr', 3, 4, { at: 0.4 }) }, far: { at: [4, 19] }, legs: 'lunge', dx: 1, lean: 1, bow: 1, front: [tick(25, 2), gears([[21, 14]])] }),
  // a jab with the staff, the watch end forward
  slashB: P({ near: { at: [10, 21], item: staff('r', 7, 6, { at: 0.6 }) }, far: { at: [5, 19] }, legs: 'lunge', dx: 1, lean: 1, front: [tick(30, 11)] }),
  windup: P({ near: { at: [-2, 27], item: staff('ul', 6, 4, { at: 0.8 }) }, far: { at: [7, 19] }, legs: 'crouch', armsUp: true }),
  // the staff crosswise, the watch held up like a shield
  parry: P({ near: { at: [4, 21], item: staff('r', 6, 3, { glow: true }) }, far: { at: [9, 21] }, legs: 'crouch', farFront: true }),
  hurt: P({ near: { at: [-4, 19], item: staff('ul', 8, 5) }, far: { at: [7, 21] }, dx: -1, lean: -1, head: 'squint', front: [gears([[-8, 22], [14, 24]])] }),
  leap: P({ near: { at: [5, 25], item: staff('u', 8, 5, { at: 0.5 }) }, far: { at: [9, 23] }, legs: 'tuck' }),
  // knocked out: sat down in a heap, the spectacles askew, the staff fallen
  down: P({ near: { at: [7, 3] }, far: { at: [-3, 3] }, legs: 'kneel', bow: 1, head: 'ko', back: [droppedStaff], front: [dizzy] }),
  // the finisher: the watch raised high and blazing, arcs of time winding back round her
  fin: P({
    near: { at: [5, 28], item: staff('u', 6, 6, { at: 0.95, glow: true }) },
    far: { at: [10, 26] },
    legs: 'lunge',
    head: 'call',
    back: [arcs(2, 16, [14, 17], 0.3, 2.8)],
    front: [gears([[-12, 8], [18, 6], [-9, 28]])],
  }),
  // Slow Time: the watch held out ahead, glowing, a ripple of slowed time from it
  cast: P({
    near: { at: [10, 22], item: staff('ur', 7, 5, { at: 0.5, glow: true }) },
    far: { at: [-2, 24] },
    head: 'call',
    front: [arcs(22, 24, [9, 12], -0.9, 0.9)],
  }),
};

/** Hero select card: the watch staff held up beside her, a finger raised ("tick, tock"), before a brass glow with a
 *  teal heart. */
export const TESS_CARD: HeroCardSpec = {
  pose: { near: { at: [7, 19], item: staff('u', 12, 17, { at: 0.1, glow: true }) }, far: { at: [-4, 25] }, head: 'smile' },
  glow: ['#a8ecd0', '#c88a1c'],
  motes: [[5, 14], [33, 9], [34, 29]],
};

/** By the campfire (two breaths): leaning on the staff with both hands, a knowing smile. */
export const TESS_CAMP: [RigPose, RigPose] = [
  P({ near: { at: [6, 19], item: staff('u', 11, 8) }, far: { at: [7, 19] }, farFront: true, head: 'smile' }),
  P({ near: { at: [6, 18], item: staff('u', 11, 7, { at: 0.2 }) }, far: { at: [7, 18] }, farFront: true, dy: 1, head: 'smile' }),
];
