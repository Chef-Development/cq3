// Rowan, the starter (a Blade): a knight in a close steel helm with a dark red plume and a visor slit lit cyan, dented
// steel pauldrons over a navy tabard trimmed in old bronze, a wine-dark cape and a plain steel sword. Fight frames
// `hero_${pose}` (his art key is `hero`) on the shared rig (art-rig.ts): every pose (cast, down, fin) and a four-frame
// idle where the plume and the cape lag the breath by a frame (docs/art-style.md section 7). Playtest round 8 (L8:
// "more mature and moodier"): about three heads tall (a 13 x 11 helm on a 35 px figure), legs built from joints, worn
// and darker materials. His hero card is drawn from ROWAN_CARD (art-sable.ts).
import { put, type Grid, type Pal, type Shade } from './art';
import { LEG_FEET_X, matureLegs, sparkle, stampAt, type Dir, type HeroCardSpec, type Item, type Layer, type Rig, type RigPose, type Sprite } from './art-rig';
import { swordMap, SWORD_PAL } from './art-sword';

// ------------------------------------------------------------------ palette

// Playtest round 8 (decisions L7, L8: "more mature and moodier"): darker, worn materials. Steel is dulled and
// dented, the tabard a deep navy, the trim old bronze, the plume and cape a dark wine.
export const ROWAN_STEEL = ['#1c1f2e', '#343a52', '#565e7c', '#8a92ae', '#d4d8e4'];
export const ROWAN_BLUE = ['#0a1228', '#13234c', '#1e3772', '#2f5096', '#4a6cb2'];
export const ROWAN_BRONZE = ['#2e1c0c', '#5a3814', '#8a5a1e', '#b8862e', '#dcb45a'];
const BRONZE = ROWAN_BRONZE;
export const ROWAN_PLUME = ['#2a0810', '#52121c', '#7e1c24', '#b03430', '#e0705e'];
const PLUME = ROWAN_PLUME;
/** The cape: darker than the plume so the two read apart. */
const CAPE = ['#1e0610', '#3a0c18', '#561622', '#70222a', '#8c3434'];
const LEATHER = ['#1a100a', '#2e1e14', '#4a3020', '#6a4630'];
/** The visor's glow (the cursor's blue, his signature), now a narrow slit's light. */
export const ROWAN_GLOW = ['#1a6ab0', '#4ad8ff', '#e6fcff'];

const PAL: Pal = {
  // the visor slit and its eyes
  v: '#0e0a16', E: ROWAN_GLOW[2], e: ROWAN_GLOW[1], w: ROWAN_GLOW[0],
  // a warm specular dash on the helm, a dent, a scratch
  K: '#d8d2c4', d: ROWAN_STEEL[1], s: ROWAN_STEEL[3],
  // old bronze trim: the brow band, collar, hem, knee cops, the buckle, the chest's emblem
  G: BRONZE[3], g: BRONZE[2], Y: BRONZE[3], y: BRONZE[2], O: BRONZE[4], X: BRONZE[3],
  // the gorget (dark steel), the tabard's folds, a boot's sole
  M: ROWAN_STEEL[1], C: ROWAN_BLUE[0], Z: LEATHER[0],
};
const SHADES: Record<string, Shade> = {
  // (a bright steel edge on the top and left of the helm, the plate and the greaves: he reads on a dark stage)
  h: { ramp: ROWAN_STEEL, same: 'gGvEewKd', top: [4, 3], left: [4], right: [1], bottom: [1], mid: 2 }, // the helm
  m: { ramp: ROWAN_STEEL, same: 'MyYgds', top: [4], left: [4, 3], right: [1], bottom: [0, 1], mid: 2 }, // plate
  c: { ramp: ROWAN_BLUE, same: 'GOgyYC', top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // the tabard
  l: { ramp: LEATHER, same: 'X', top: [3], left: [2], right: [1], bottom: [0], mid: 2 }, // the belt
  o: { ramp: LEATHER, same: 'Z', top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // boots
  // the back leg, a value darker
  n: { ramp: ROWAN_STEEL, same: 'y', top: [2], left: [2], right: [0], bottom: [0], mid: 1 },
  b: { ramp: LEATHER, same: 'Z', top: [2], left: [2], right: [0], bottom: [0], mid: 1 },
};

// ------------------------------------------------------------------ body

// A close helm (13 x 11: about a third of his height), a bronze band over the brow, a narrow visor slit with two
// small points of light, the bevor closing under it in a squared jaw; a dent on the crown. The plume is a layer (it
// lags the head).
const HEAD = [
  '....hhhhh....',
  '..hhhhhhhhh..',
  '.hKKhhhhhhhh.',
  '.hhhhhhhhhhhh',
  'hhhhhhhhdhhhh',
  'hhhhhgGGGGGGg',
  'hhhhhvvvvvvvv',
  'hhhhhvEvvvvEv',
  'hhhhhhhhhhhhh',
  '.hhhhhhhhhhhh',
  '...hhhhhhhh..',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 13 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: the light in the slit gone to a line
  squint: face(HEAD, { 7: 'vwvvvvwv' }),
  // knocked out: the slit dark
  ko: face(HEAD, { 7: 'vvvvvvvv' }),
  // a battle cry: the eyes flare
  cry: face(HEAD, { 6: 'vevvvvev', 7: 'vEEvvvEE' }),
};

// Broad steel pauldrons (bronze-rimmed, scratched) and a dark gorget over the navy tabard with its bronze emblem, mail
// at the sides, a worn leather belt; 19 wide, 12 tall.
const TORSO = [
  '...mmmm.....mmmm...',
  '..mmmmmmMMMmmmmmm..',
  '.mmsmmmmMMMmmmmdmm.',
  'mmmmmmmcccccmmmmmmm',
  'yyyyymcccccccmyyyyy',
  '.mmmmccccOccccmmmm.',
  '..mmcccccOcccccmm..',
  '..mmccccOGOccccmm..',
  '..mmcccccOcccccmm..',
  '..mmcccccccccccmm..',
  '..llllllllXXllll...',
  '...ccccccccccccc...',
];

// ---- legs, built from joints (art-rig.ts STANCES): plate on the thigh and shin, a bronze knee cop, a worn boot; the
// tabard's skirt hangs over the thighs with folds and a bronze hem
const LEGS = matureLegs({ leg: 'm', legBack: 'n', boot: 'o', bootBack: 'b', sole: 'Z', cop: 'g', copBack: 'y', skirt: 'c', fold: 'C', hem: 'y' });

const GAUNTLET = ['RRr', 'Rrq', 'rqq'];
const GAUNTLET_PAL: Pal = { R: ROWAN_STEEL[4], r: ROWAN_STEEL[3], q: ROWAN_STEEL[1] };
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.45, ROWAN_STEEL[3], ROWAN_STEEL[2], ROWAN_STEEL[1]],
  [0.55, BRONZE[3], BRONZE[2], BRONZE[1]],
  [1, ROWAN_STEEL[3], ROWAN_STEEL[2], ROWAN_STEEL[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [
  [0.45, ROWAN_STEEL[2], ROWAN_STEEL[1], ROWAN_STEEL[0]],
  [0.55, BRONZE[2], BRONZE[1], BRONZE[0]],
  [1, ROWAN_STEEL[2], ROWAN_STEEL[1], ROWAN_STEEL[0]],
];

export const ROWAN_RIG: Rig = {
  pal: { ...PAL, ...GAUNTLET_PAL },
  shades: SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: LEG_FEET_X,
  torsoX: -9,
  torsoOverlap: 1,
  headX: 4,
  headOverlap: 1,
  shoulderNear: [4, 4],
  shoulderFar: [14, 4],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: GAUNTLET,
  fistFar: GAUNTLET,
  fistAt: [-1, -1],
  // (his palette is made for the dark stage already)
  graded: true,
};

// ------------------------------------------------------------------ the sword

/** Where the sword's point landed in the last frame painted (frame px), for the blade's glint (fighters.ts). */
let lastTip: [number, number] | null = null;
/** His sword (steel, a cyan core, a gold guard with a red stone), `len` px of blade along `dir`, grip at the hand. */
const sword =
  (dir: Dir, len = 14): Item =>
  (g, x, y) => {
    const s: Sprite = swordMap(dir, len);
    stampAt(g, s, SWORD_PAL, x, y);
    s.rows.forEach((r, j) => {
      const i = r.indexOf('T');
      if (i >= 0) lastTip = [x - s.grip[0] + i, y - s.grip[1] + j];
    });
  };

// ------------------------------------------------------------------ the plume and the cape (secondary motion)

/** The plume as a curve from the helm's crest: `tail` and `ctrl` relative to the crest (x right, y down). It tapers
 *  from 3 px to 2 (no 1 px tail at 8x) and is lit on its upper side. */
type PlumeK = 'hang' | 'lag' | 'sway' | 'flow' | 'rise' | 'limp' | 'up';
const PLUMES: Record<PlumeK, { ctrl: [number, number]; tail: [number, number] }> = {
  hang: { ctrl: [-4, -7], tail: [-11, 5] },
  lag: { ctrl: [-4, -7], tail: [-11, 6] },
  sway: { ctrl: [-5, -6], tail: [-12, 7] },
  flow: { ctrl: [-7, -4], tail: [-15, 1] },
  rise: { ctrl: [-5, -7], tail: [-13, -4] },
  limp: { ctrl: [-4, -4], tail: [-8, 8] },
  up: { ctrl: [-2, -8], tail: [-10, -3] },
};
const plume =
  (k: PlumeK): Layer =>
  (g, a) => {
    const { ctrl, tail } = PLUMES[k];
    const rx = a.hx + 6;
    const ry = a.hy;
    const cells = new Map<string, number>();
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      const px = rx + 2 * u * t * ctrl[0] + t * t * tail[0];
      const py = ry + 2 * u * t * ctrl[1] + t * t * tail[1];
      const r = 1.6 - 0.6 * t;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= r) cells.set(`${Math.round(px + dx)},${Math.round(py + dy)}`, t);
    }
    const has = (x: number, y: number) => cells.has(`${x},${y}`);
    for (const [key, t] of cells) {
      const [x, y] = key.split(',').map(Number);
      // lit along the top, a shaded underside, the tip darker (it curls away from the light)
      let c = PLUME[2];
      if (!has(x, y - 1)) c = t < 0.5 ? PLUME[4] : PLUME[3];
      else if (!has(x, y + 1)) c = PLUME[1];
      if (t > 0.85 && has(x, y - 1)) c = PLUME[1];
      put(g, x, y, c);
    }
  };

type CapeK = 'hang' | 'sway' | 'flow' | 'rise' | 'limp';
/** The cape as cloth between the shoulders' line and its hem: [bottom-left, bottom-right] relative to the torso's top
 *  left (the top edge runs along the shoulders). Most of it is hidden behind the body. */
const CAPES: Record<CapeK, [[number, number], [number, number], number]> = {
  // [bottom-left, bottom-right, billow: how far its middle bellies out (it ripples along its length)]
  hang: [[-1, 22], [8, 23], 0],
  sway: [[-4, 21], [6, 23], 1],
  flow: [[-13, 6], [-10, 13], 2.5],
  rise: [[-11, -3], [-13, 4], 2],
  limp: [[1, 21], [9, 21], 0],
};
const cape =
  (k: CapeK): Layer =>
  (g, a) => {
    const [bl, br, billow] = CAPES[k];
    const tl: [number, number] = [a.tx + 2, a.ty + 2];
    const tr: [number, number] = [a.tx + 10, a.ty + 2];
    const BL: [number, number] = [a.tx + bl[0], a.ty + bl[1]];
    const BR: [number, number] = [a.tx + br[0], a.ty + br[1]];
    const len = Math.max(Math.hypot(BL[0] - tl[0], BL[1] - tl[1]), Math.hypot(BR[0] - tr[0], BR[1] - tr[1]));
    const cells = new Map<string, [number, number]>();
    for (let v = 0; v <= 1.0001; v += 0.5 / len)
      for (let u = 0; u <= 1.0001; u += 0.05) {
        const x0 = tl[0] + (BL[0] - tl[0]) * v;
        const y0 = tl[1] + (BL[1] - tl[1]) * v;
        const x1 = tr[0] + (BR[0] - tr[0]) * v;
        const y1 = tr[1] + (BR[1] - tr[1]) * v;
        // the cloth bellies out (away from the body: up and back) and ripples along its length, narrowing at the hem
        const narrow = 1 - 0.35 * v * (billow > 0 ? 1 : 0);
        const uu = 0.5 + (u - 0.5) * narrow;
        const wave = billow * Math.sin(v * Math.PI) + (billow ? Math.sin(v * 9 + uu * 2) * 0.6 : 0);
        cells.set(`${Math.round(x0 + (x1 - x0) * uu - wave * 0.6)},${Math.round(y0 + (y1 - y0) * uu - wave)}`, [u, v]);
      }
    for (const [key, [u, v]] of cells) {
      const [x, y] = key.split(',').map(Number);
      // the outer edge lit, heavy folds running down it, the hem and the far side in shadow
      const fold = Math.abs(((u * 4) % 1) - 0.5) < 0.12 && v > 0.15;
      const c = v > 0.95 ? CAPE[0] : u < 0.12 ? CAPE[3] : fold ? CAPE[1] : u > 0.85 ? CAPE[1] : CAPE[2];
      put(g, x, y, c);
    }
  };

// ------------------------------------------------------------------ light

const ARC = ['#ffffff', ROWAN_GLOW[2], ROWAN_BLUE[3], ROWAN_BLUE[2]];
/** A steel-blue arc trailing a cut (a bright edge, a cyan body, a blue tail). */
const sweep =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    ARC.slice(0, 3).forEach((col, k) => {
      const rr = r - k;
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        if (k === 2 && t > 0.75) continue;
        const ang = a0 + (a1 - a0) * t;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
    });
  };
/** Motes of light (sparkles and dots in the visor's cyan). */
const motes =
  (pts: Array<[number, number]>): Layer =>
  (g, a) =>
    pts.forEach(([x, y], i) => (i % 2 ? put(g, a.fx + x, a.fy - y, ROWAN_GLOW[2]) : sparkle(g, a.fx + x, a.fy - y, ROWAN_GLOW[1], '#ffffff')));
/** A whirl of light round the raised blade (the finisher: Whirlwind). */
const whirl: Layer = (g, a) => {
  const cx = a.fx + 1;
  const cy = a.fy - 15;
  for (let k = 0; k < 3; k++) {
    const r = 19 - k * 3;
    for (let t = 0; t <= 1; t += 1 / (r * 5)) {
      const ang = 2.6 + t * 4.2 + k * 0.5;
      const ry = r * 0.3;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * ry);
      if (t > 0.8 && k > 0) continue;
      put(g, x, y, ARC[Math.min(3, k + (t > 0.6 ? 1 : 0))]);
    }
  }
};
/** The sword lying on the ground beside him (knocked out). */
const droppedSword: Layer = (g, a) => stampAt(g, swordMap('r', 15), SWORD_PAL, a.fx - 20, a.fy - 1);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const ROWAN_POSES: Record<string, RigPose> = {
  // a knight's guard: the sword up before him in his forward hand (no arm crosses his chest), the back hand at his
  // hip; the breath (0-1-2-3: up, down, down, up) with the plume and cape a frame behind it
  idle0: P({ far: { at: [11, 15], item: sword('ur', 14) }, near: { at: [-6, 13] }, farFront: true, back: [cape('hang'), plume('hang')] }),
  idle1: P({ far: { at: [11, 14], item: sword('ur', 14) }, near: { at: [-6, 12] }, farFront: true, dy: 1, back: [cape('hang'), plume('lag')] }),
  idle2: P({ far: { at: [11, 14], item: sword('ur', 14) }, near: { at: [-6, 12] }, farFront: true, dy: 1, back: [cape('sway'), plume('sway')] }),
  idle3: P({ far: { at: [11, 15], item: sword('ur', 14) }, near: { at: [-6, 13] }, farFront: true, back: [cape('sway'), plume('lag')] }),
  dash: P({ near: { at: [-8, 15], item: sword('l', 15) }, far: { at: [9, 16] }, legs: 'run', dx: 1, lean: 1, back: [cape('flow'), plume('flow')] }),
  // a cut down and forward, the arc trailing it
  slashA: P({ near: { at: [15, 16], item: sword('dr', 14) }, far: { at: [10, 15] }, legs: 'lunge', dx: 2, lean: 1, back: [cape('flow'), plume('flow')], front: [sweep(10, 19, 17, 1.9, -0.6)] }),
  // a sweep level with his chest
  slashB: P({ near: { at: [15, 20], item: sword('r', 16) }, far: { at: [10, 15] }, legs: 'lunge', dx: 2, lean: 1, head: 'cry', back: [cape('flow'), plume('flow'), sweep(9, 20, 16, 2.4, 0.4)] }),
  // the sword drawn back over his shoulder in both hands, crouched to spring
  windup: P({ near: { at: [-3, 28], item: sword('ul', 16) }, far: { at: [-1, 27], hidden: true }, legs: 'crouch', dy: 1, armsUp: true, back: [cape('hang'), plume('up')] }),
  // the blade upright before him, the free hand bracing behind it
  parry: P({ far: { at: [11, 15], item: sword('u', 15) }, near: { at: [-5, 11] }, farFront: true, legs: 'crouch', dy: 1, back: [cape('hang'), plume('hang')], front: [motes([[15, 33], [8, 28]])] }),
  // knocked back a step: the sword flung up and back, the free hand thrown out
  hurt: P({ near: { at: [-6, 18], item: sword('ul', 13) }, far: { at: [11, 19] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [cape('rise'), plume('rise')] }),
  leap: P({ near: { at: [7, 29], item: sword('ur', 14) }, far: { at: [9, 28], hidden: true }, legs: 'tuck', armsUp: true, back: [cape('rise'), plume('flow')] }),
  // knocked out: on one knee, the sword dropped beside him, the visor dark
  down: P({ near: { at: [9, 9] }, far: { at: [12, 8] }, farFront: true, legs: 'kneel', dy: 2, lean: 2, bow: 2, head: 'ko', back: [cape('limp'), plume('limp'), droppedSword] }),
  // Whirlwind: the blade swung out level at the end of a spin, a whirl of light round him, the visor blazing
  fin: P({ near: { at: [16, 19], item: sword('r', 17) }, far: { at: [11, 15] }, legs: 'lunge', dx: 1, head: 'cry', back: [cape('flow'), plume('flow')], front: [whirl, motes([[24, 34], [-9, 24]])] }),
  // the ability: the blade up before his visor, a glint running up it, the free hand open
  cast: P({ far: { at: [12, 17], item: sword('u', 16) }, near: { at: [-6, 13] }, farFront: true, back: [cape('sway'), plume('sway')], front: [motes([[14, 38], [6, 32], [18, 28], [4, 37]]), (g, a) => sparkle(g, a.fx + 11, a.fy - 31, ROWAN_GLOW[1], '#ffffff', true)] }),
};

/** Hero select card: the sword raised, cape streaming, before a steel-blue glow with a bronze heart. */
export const ROWAN_CARD: HeroCardSpec = {
  pose: { near: { at: [10, 19], item: sword('u', 17) }, far: { at: [12, 14] }, back: [cape('flow'), plume('flow')] },
  glow: ['#e6c370', '#2f5096'],
  motes: [[6, 14], [33, 9], [35, 27]],
};

/** Where the point of the sword is in a frame (frame px), read while painting it (null: no sword in hand). */
export function rowanTip(paint: (g: Grid) => void, g: Grid): [number, number] | null {
  lastTip = null;
  paint(g);
  return lastTip;
}
