// Sable, the second hero (see docs/art-style.md): a dual-dagger ninja, a thief who tried to rob the camp and joined
// after Pip caught them. A plum hood and gi with an eye slit, a teal scarf over the mouth whose long tails stream
// behind them, a coral sash, a leather strap across the chest, linen wraps on the hands and shins, and two short
// curved daggers, one per hand.
//
// Fight frames (`sable_${pose}`) share the hero frames' box and feet point (HERO_W x HERO_H, feet centred on
// HERO_FEET_X, the soles on the row above the bottom outline row), face right, and are composed per pose like
// Rowan's: the scarf tails and the far arm with its dagger behind the body, the legs, the torso, the head, then the
// near arm with its dagger in front. Daggers are pre-drawn at clean 8-way pixel slopes; a reverse grip is just the
// blade pointing down out of the fist.
import { HERO_FEET_X, HERO_H, HERO_W, grid, put, stamp, toCanvas, type Grid, type Pal } from './art';
import { ROWAN_CARD, ROWAN_RIG } from './art-hero-rowan';
import { jointLegs, LEG_FEET_X, rigFrame, STANCES, type LegLook } from './art-rig';
import { daggerMap } from './art-sword';
import { EARTH, LEAF, STONE, ell, fill, or, rect, sphere, tone } from './art-paint';
import { bay } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

// ------------------------------------------------------------------ palette

const PAL: Pal = {
  // plum cloth (hood, gi, trousers): shadows lean indigo, light leans warm mauve
  1: '#1c1632', 2: '#2c2250', 3: '#41306a', 4: '#5a3e84', 5: '#7a5498', 6: '#a274b0', 7: '#c69ac4',
  // teal scarf: shadows lean blue, light leans mint
  a: '#0c2c3c', b: '#135a62', c: '#1c8a80', d: '#34b496', e: '#74dcb0', f: '#c8f8d4',
  // coral sash
  r: '#5a1828', R: '#9a3030', q: '#d05a3a', Q: '#f09060',
  // skin and eyes
  z: '#8a4a32', s: '#d08c5c', S: '#f6c494', k: '#140c1c', W: '#ffffff',
  // linen wraps on the hands and shins
  w: '#6e6488', v: '#a89cbc', V: '#dcd2e6',
  // dagger steel (C shaded edge, L body, A lit spine, T tip glint)
  C: '#6a7496', L: '#a8b4d0', A: '#e6eef8', T: '#ffffff',
  // brass guard, pommel and buckle; leather grip and strap
  G: '#ffe48a', g: '#e0a030', y: '#9a5a14', P: '#f2c230', h: '#3e2030', H: '#6e3a44',
};

// ------------------------------------------------------------------ body parts (facing right)

// The hood and the scarf over the mouth, 13 x 11 (playtest round 8, L8: a smaller head on a longer body, about three
// heads tall). The face opening sits on the right under the brim's lit lip: a narrow band of skin with two small dark
// eyes, then the mask.
const HEAD = [
  '....5566.....',
  '..5677765....',
  '.567766554...',
  '45676655443..',
  '4566554433332',
  '456554666652.',
  '45554zSkSSk2.',
  '4554zsSSSSs2.',
  '.443ddeeeedc.',
  '..32deeedccb.',
  '...1cdddccb..',
];
const SQUINT: Record<number, [string, string]> = { 6: ['zSkSSk', 'zSzSSz'] };
const squint = (rows: string[]) => rows.map((r, y) => (SQUINT[y] ? r.replace(SQUINT[y][0], SQUINT[y][1]) : r));

// Shoulders to the sash and the gi's split hem, 15 wide (the mask covers the neck): a leather strap with a brass
// buckle crosses the chest.
const TORSO = [
  '...4HH555543...',
  '..345hHH55442..',
  '.34555hHg54332.',
  '.3455554hHH321.',
  '.345544443hH21.',
  '.3455544433321.',
  '.3455444333321.',
  '.2QQqqqqqRRrr1.',
  '..rqqqRRqRRr...',
  '..34554.33321..',
  '..3443...3321..',
];

// Legs from the shared joints (art-rig.ts STANCES): dark trousers lit on the left, linen wraps up the shins, the back
// leg a value darker; 'ready' is her own stance, knees bent on the balls of the feet.
const SABLE_LEGS: LegLook = { leg: '3', legLit: '4', legBack: '2', boot: 'w', bootLit: 'v', bootBack: '2', sole: '1', bootRows: 5 };
const LEGS: Record<string, string[]> = {
  ready: jointLegs({ h: 13, skirt: 0, flare: 0, back: [[LEG_FEET_X - 2, 1], [LEG_FEET_X - 5, 7], [LEG_FEET_X - 4, 12]], front: [[LEG_FEET_X + 2, 1], [LEG_FEET_X + 5, 6], [LEG_FEET_X + 4, 12]] }, SABLE_LEGS),
  lunge: jointLegs(STANCES.lunge, SABLE_LEGS),
  run: jointLegs(STANCES.run, SABLE_LEGS),
  crouch: jointLegs(STANCES.crouch, SABLE_LEGS),
  tuck: jointLegs(STANCES.tuck, SABLE_LEGS),
  kneel: jointLegs(STANCES.kneel, SABLE_LEGS),
};
type Legs = keyof typeof LEGS;

// ------------------------------------------------------------------ scarf tails

/**
 * A scarf tail from (x, y): `n` steps of 1px along the angle `ang(t)` (0 = right, PI/2 = down), 2px thick (lit on
 * its upper/left side) and thinning at the end.
 */
function tail(g: Grid, x: number, y: number, n: number, ang: (t: number) => number): void {
  let fx = x;
  let fy = y;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = ang(t);
    fx += Math.cos(a);
    fy += Math.sin(a);
    const px = Math.round(fx);
    const py = Math.round(fy);
    const lit = PAL[t < 0.4 ? 'e' : 'd'];
    const dark = PAL[t < 0.4 ? 'c' : 'b'];
    if (t > 0.86) {
      put(g, px, py, PAL.c);
      continue;
    }
    if (Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a))) {
      put(g, px, py, lit);
      put(g, px, py + 1, dark);
    } else {
      put(g, px, py, lit);
      put(g, px + 1, py, dark);
    }
  }
}

type Scarf = 'breeze' | 'sway' | 'drift' | 'settle' | 'hang' | 'flow' | 'wave' | 'rise' | 'limp';
/** The two tails (long, short) per scarf state: [steps, angle at the knot (x PI), curl along the tail, wave]. */
const SCARF: Record<Scarf, Array<[number, number, number, number]>> = {
  // standing: drifting back on a breeze, two phases
  breeze: [
    [14, 0.9, -0.12, 0.07],
    [10, 0.82, -0.1, 0.06],
  ],
  sway: [
    [14, 0.88, -0.14, -0.07],
    [10, 0.8, -0.1, -0.06],
  ],
  // the four-frame idle's two in-betweens: the tails a frame behind the breath
  drift: [
    [14, 0.85, -0.16, -0.03],
    [10, 0.77, -0.12, -0.03],
  ],
  settle: [
    [14, 0.88, -0.13, 0.03],
    [10, 0.8, -0.1, 0.03],
  ],
  // rising through the air: the tails drop below the knot
  hang: [
    [13, 0.8, -0.2, 0.05],
    [9, 0.7, -0.12, 0.04],
  ],
  flow: [
    [17, 0.98, 0.02, 0.1],
    [12, 0.9, 0.06, 0.09],
  ],
  wave: [
    [17, 0.97, 0.02, -0.1],
    [12, 0.92, 0.04, -0.09],
  ],
  rise: [
    [15, 1.18, 0.12, 0.08],
    [11, 1.1, 0.12, 0.07],
  ],
  // no wind left: hanging straight down the back
  limp: [
    [12, 0.66, -0.06, 0.02],
    [9, 0.7, -0.08, 0.02],
  ],
};

function scarf(g: Grid, kx: number, ky: number, s: Scarf): void {
  SCARF[s].forEach(([n, a0, curl, wave], i) =>
    tail(g, kx - i, ky + i, n, (t) => Math.PI * (a0 + curl * t + wave * Math.sin(t * Math.PI * 2.2))),
  );
}

// ------------------------------------------------------------------ daggers

type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl';
interface Blade {
  rows: string[];
  grip: [number, number];
}

/** Her dagger along `dir`: 3 px of steel so it reads at 8x (art-sword.ts's dagger, in her brass and steel). */
function dagger(dir: Dir): Blade {
  return daggerMap(dir, 7);
}

// ------------------------------------------------------------------ poses

interface Arm {
  hand: [number, number]; // the fist, relative to the feet (x right, y up)
  dir?: Dir; // the dagger (none: empty-handed)
}

export interface SablePose {
  near: Arm; // the near (low) hand: the left cursor's dagger
  far: Arm; // the far (high) hand: the right cursor's dagger
  legs?: Legs;
  dx?: number; // upper body shift
  dy?: number; // upper body drop (down = positive)
  lean?: number; // the head's extra shift forward
  scarf?: Scarf;
  squint?: boolean;
  bow?: number; // the head hangs this much lower on the shoulders
  armsUp?: boolean; // both hands raised over the head: the near arm passes behind the head too
  glint?: Array<[number, number]>; // sparkles on the steel, relative to the feet
  dropped?: Array<[number, number, Dir]>; // daggers lying loose: [x, y of the grip relative to the feet, direction]
}

export const SABLE_POSES: Record<string, SablePose> = {
  idle0: { near: { hand: [7, 10], dir: 'dl' }, far: { hand: [11, 15], dir: 'd' }, glint: [[13, 9]] },
  idle1: { near: { hand: [7, 9], dir: 'dl' }, far: { hand: [11, 14], dir: 'd' }, dy: 1, scarf: 'sway' },
  idle2: { near: { hand: [7, 9], dir: 'dl' }, far: { hand: [11, 14], dir: 'd' }, dy: 1, scarf: 'drift' },
  idle3: { near: { hand: [7, 10], dir: 'dl' }, far: { hand: [11, 15], dir: 'd' }, scarf: 'settle', glint: [[12, 8]] },
  dash: { near: { hand: [-7, 12], dir: 'l' }, far: { hand: [10, 14], dir: 'dl' }, legs: 'run', dx: 2, lean: 1, scarf: 'flow' },
  slashA: { near: { hand: [15, 10], dir: 'r' }, far: { hand: [3, 16], dir: 'd' }, legs: 'lunge', dx: 2, lean: 1, scarf: 'flow', glint: [[25, 11]] },
  slashB: { near: { hand: [-2, 10], dir: 'dl' }, far: { hand: [14, 18], dir: 'ur' }, legs: 'lunge', dx: 2, lean: 1, scarf: 'wave', glint: [[21, 26]] },
  slashX: { near: { hand: [10, 11], dir: 'ur' }, far: { hand: [10, 19], dir: 'dr' }, legs: 'lunge', dx: 2, lean: 1, scarf: 'flow', glint: [[14, 15]] },
  windup: { near: { hand: [9, 7], dir: 'r' }, far: { hand: [-4, 19], dir: 'ul' }, legs: 'crouch', dy: 1, scarf: 'sway' },
  parry: { near: { hand: [9, 13], dir: 'ur' }, far: { hand: [14, 13], dir: 'ul' }, glint: [[12, 21]] },
  hurt: { near: { hand: [-6, 10], dir: 'dl' }, far: { hand: [-1, 18], dir: 'ul' }, dx: -1, lean: -1, dy: 1, squint: true, scarf: 'wave' },
  leap: { near: { hand: [7, 24], dir: 'ul' }, far: { hand: [13, 19], dir: 'ur' }, legs: 'tuck', scarf: 'hang', armsUp: true, glint: [[18, 25]] },
  // the finisher's blow: diving forward, both blades raking across in an X
  fang: { near: { hand: [14, 8], dir: 'ur' }, far: { hand: [14, 16], dir: 'dr' }, legs: 'run', dx: 3, lean: 3, bow: 1, scarf: 'rise', glint: [[18, 12]] },
  // the finisher's pose (the bible's twelve): both blades thrown wide and high, the scarf streaming up off her shoulders
  fin: { near: { hand: [13, 21], dir: 'ur' }, far: { hand: [-4, 22], dir: 'ul' }, legs: 'lunge', dx: 1, scarf: 'rise', armsUp: true, glint: [[21, 30], [-9, 30]] },
  // the green ability: the daggers crossed before her mask, a glint where they cross
  cast: { near: { hand: [9, 14], dir: 'ur' }, far: { hand: [13, 14], dir: 'ul' }, scarf: 'breeze', glint: [[11, 20]] },
  // knocked out: down on one knee, head bowed, leaning on a dagger stuck in the ground, the other one dropped
  down: {
    near: { hand: [9, 8], dir: 'd' },
    far: { hand: [-5, 6] },
    legs: 'kneel',
    dy: 2,
    lean: 3,
    bow: 3,
    squint: true,
    scarf: 'limp',
    dropped: [[-14, 1, 'r']],
  },
};

const FIST = ['Vv', 'vw'];

/** A sleeve from the shoulder to the fist, 2px thick (lit on its upper/left side), a linen wrap at the wrist. */
function arm(g: Grid, sx: number, sy: number, hx: number, hy: number, near: boolean): void {
  const n = Math.max(Math.abs(hx - sx), Math.abs(hy - sy));
  const flat = Math.abs(hx - sx) >= Math.abs(hy - sy);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const x = Math.round(sx + (hx - sx) * t);
    const y = Math.round(sy + (hy - sy) * t);
    const wrist = i >= n - 1;
    put(g, x, y, PAL[wrist ? 'V' : near ? '6' : '4']);
    put(g, x + (flat ? 0 : 1), y + (flat ? 1 : 0), PAL[wrist ? 'v' : near ? '4' : '3']);
  }
}

/** A four-point sparkle on the steel. */
function sparkle(g: Grid, x: number, y: number): void {
  put(g, x, y, PAL.T);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    put(g, x + dx, y + dy, PAL.A);
}

/** Paint a pose into `g` (the frame's box). */
/** Her poses were set for the shorter build: each stance's old leg height (the hands rise by the difference, plus the
 *  longer gi). */
const OLD_LEG_H: Record<string, number> = { ready: 8, lunge: 8, run: 8, crouch: 6, tuck: 5, kneel: 7 };

export function paintSable(g: Grid, p: SablePose): void {
  const feetY = HERO_H - 2;
  const legs = LEGS[p.legs ?? 'ready'];
  const SABLE_LIFT = legs.length - OLD_LEG_H[p.legs ?? 'ready'] + 2;
  const lx = HERO_FEET_X - LEG_FEET_X;
  const ly = feetY - legs.length + 1;
  const tx = HERO_FEET_X - 7 + (p.dx ?? 0);
  const ty = ly - TORSO.length + 2 + (p.dy ?? 0);
  const hx0 = tx + 1 + (p.lean ?? 0);
  const hy0 = ty - HEAD.length + 1 + (p.bow ?? 0);
  // (her poses were set for the shorter build: the hands rise with the longer body, playtest round 8)
  const hand = (a: Arm): [number, number] => [HERO_FEET_X + a.hand[0], feetY - a.hand[1] - SABLE_LIFT];
  const drawDagger = (a: Arm) => {
    if (!a.dir) return;
    const b = dagger(a.dir);
    const [x, y] = hand(a);
    stamp(g, b.rows, PAL, x - b.grip[0], y - b.grip[1]);
  };
  for (const [x, y, dir] of p.dropped ?? []) {
    const b = dagger(dir);
    stamp(g, b.rows, PAL, HERO_FEET_X + x - b.grip[0], feetY - y - b.grip[1]);
  }
  scarf(g, hx0 + 2, hy0 + 8, p.scarf ?? 'breeze');
  // far arm and its dagger, behind the body
  const [fx, fy] = hand(p.far);
  drawDagger(p.far);
  arm(g, tx + 10, ty + 1, fx, fy, false);
  stamp(g, FIST, PAL, fx, fy);
  const [nx, ny] = hand(p.near);
  const nearArm = () => {
    arm(g, tx + 5, ty + 1, nx, ny, true);
    drawDagger(p.near);
    stamp(g, FIST, PAL, nx, ny);
  };
  if (p.armsUp) nearArm();
  stamp(g, legs, PAL, lx, ly);
  stamp(g, TORSO, PAL, tx, ty);
  stamp(g, p.squint ? squint(HEAD) : HEAD, PAL, hx0, hy0);
  // near arm in front
  if (!p.armsUp) nearArm();
  for (const [x, y] of p.glint ?? []) sparkle(g, HERO_FEET_X + x, feetY - y - SABLE_LIFT);
}

function sableFrame(p: SablePose): HTMLCanvasElement {
  const g = grid(HERO_W, HERO_H);
  paintSable(g, p);
  return toCanvas(g);
}

// ------------------------------------------------------------------ hero select cards

/** Hero select card art (`hero_card_${hero}`): the hero on a grassy plinth before a soft glow in their colours. */
export const HERO_CARD_W = 40;
export const HERO_CARD_H = 48;
/** The feet row on the card (the plinth's top face). */
export const HERO_CARD_FEET_Y = 43;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** A round glow behind the hero in stepped, ordered-dithered bands: `inner` at the heart, `outer` at the rim. */
function cardGlow(ctx: CanvasRenderingContext2D, inner: string, outer: string, motes: Array<[number, number]>): void {
  const a = rgb(inner);
  const b = rgb(outer);
  const ALPHA = [0, 0.22, 0.4, 0.58, 0.74, 0.88];
  for (let y = 0; y < HERO_CARD_H; y++)
    for (let x = 0; x < HERO_CARD_W; x++) {
      const d = Math.hypot((x + 0.5 - 20) / 20, (y + 0.5 - 23) / 23);
      if (d >= 1) continue;
      const band = Math.max(0, Math.min(5, Math.floor((1 - d) ** 0.8 * 6 + (bay(x, y) - 0.5) * 0.9)));
      if (!band) continue;
      const k = (band - 1) / 4;
      const c = a.map((v, i) => Math.round(b[i] + (v - b[i]) * k));
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${ALPHA[band]})`;
      ctx.fillRect(x, y, 1, 1);
    }
  for (const [x, y] of motes) {
    ctx.fillStyle = inner;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = `rgba(${a[0]},${a[1]},${a[2]},0.5)`;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      ctx.fillRect(x + dx, y + dy, 1, 1);
  }
}

/** The plinth: a round patch of turf on a little earth bank, lit from the top left, a few tufts and pebbles. */
function cardPlinth(): HTMLCanvasElement {
  const g = grid(HERO_CARD_W, HERO_CARD_H);
  const cx = 20;
  const top = ell(cx, HERO_CARD_FEET_Y + 0.5, 15, 3.4);
  const bank = or(ell(cx, HERO_CARD_FEET_Y + 2.5, 14.5, 3.3), rect(6, HERO_CARD_FEET_Y, 33, HERO_CARD_FEET_Y + 2));
  fill(g, bank, (x, y) => tone(EARTH, 0.62 - (x - 6) / 60 - (y - HERO_CARD_FEET_Y) * 0.07 + ((x * 3 + y * 5) % 7 === 0 ? -0.15 : 0)));
  fill(g, top, sphere(LEAF.slice(1), cx - 6, HERO_CARD_FEET_Y - 2, 17, 6, 0.08));
  // the turf's lip hangs over the bank
  for (let x = 6; x <= 34; x++) {
    let y = HERO_CARD_FEET_Y + 4;
    while (y > 0 && !top(x, y)) y--;
    if (top(x, y) && (x + 1) % 3 !== 0) put(g, x, y + 1, LEAF[x < cx ? 2 : 1]);
  }
  // pebbles on the bank, tufts on the turf
  for (const [x, y] of [
    [12, HERO_CARD_FEET_Y + 3],
    [26, HERO_CARD_FEET_Y + 4],
  ]) {
    put(g, x, y, STONE[4]);
    put(g, x + 1, y, STONE[2]);
  }
  for (const [x, h] of [
    [8, 2],
    [10, 3],
    [30, 3],
    [32, 2],
  ]) {
    for (let k = 0; k < h; k++) put(g, x + (k === h - 1 ? -1 : 0), HERO_CARD_FEET_Y - 1 - k, LEAF[k === h - 1 ? 5 : 4]);
  }
  return toCanvas(g);
}

export function heroCard(glow: [string, string], motes: Array<[number, number]>, figure: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = HERO_CARD_W;
  c.height = HERO_CARD_H;
  const ctx = c.getContext('2d')!;
  cardGlow(ctx, glow[0], glow[1], motes);
  ctx.drawImage(cardPlinth(), 0, 0);
  // the hero frame's feet (HERO_FEET_X, HERO_H - 2) land on the card's centre line at the feet row
  ctx.drawImage(figure, HERO_CARD_W / 2 - HERO_FEET_X, HERO_CARD_FEET_Y - (HERO_H - 2));
  return c;
}

/** Rowan: sword raised, cape streaming, before a steel-blue glow with a gold heart. */
const rowanCard = () => heroCard(ROWAN_CARD.glow, ROWAN_CARD.motes, rigFrame(ROWAN_RIG, ROWAN_CARD.pose));

/** Sable: one dagger raised high, the other low and forward, scarf drifting, before a plum glow with a teal heart. */
const sableCard = () => {
  const g = grid(HERO_W, HERO_H);
  paintSable(g, { near: { hand: [9, 9], dir: 'r' }, far: { hand: [10, 19], dir: 'ur' }, glint: [[19, 26]] });
  return heroCard(['#8af0c8', '#a274b0'], [[5, 12], [34, 10], [33, 29]], toCanvas(g));
};

// ------------------------------------------------------------------ build

// shared with Sable's camp sprite (art-camp.ts)
export { PAL as SABLE_PAL, HEAD as SABLE_HEAD, TORSO as SABLE_TORSO, FIST as SABLE_FIST, tail as scarfTail, dagger as sableDagger, arm as sableArm };
export type SableDir = Dir;

export function buildSableArt(add: Add): void {
  for (const [name, pose] of Object.entries(SABLE_POSES)) add(`sable_${name}`, sableFrame(pose));
  add('hero_card_rowan', rowanCard());
  add('hero_card_sable', sableCard());
}
