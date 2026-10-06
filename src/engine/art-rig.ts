// The shared rig for the M5 heroes' fight frames (see docs/art-style.md and art-sable.ts, which this generalises).
// A hero is a head, a torso and a set of leg maps (character maps; letters listed in `shades` are lit from their own
// shape, light from the top left), two arms drawn as thick lines from the shoulders to the fists, and whatever the
// hands hold. A pose places the fists (relative to the feet, x right, y up), picks the legs, shifts the upper body
// and adds layers behind (capes, braids, quivers) and in front (spells, projectiles, sparkles).
//
// Every frame shares Rowan's box and feet point: HERO_W x HERO_H, the feet centred on HERO_FEET_X, the soles on the
// row above the bottom outline row, facing right. Composition order: back layers, the far arm and what it holds,
// the legs, the torso, the head, the near arm and what it holds, then the front layers (a pose can put the far
// hand in front, like a shield held out, or the near arm behind, like both hands raised over the head).
import { HERO_FEET_X, HERO_H, HERO_W, grid, put, stamp, stampShaded, toCanvas, type Grid, type Pal, type Shade } from './art';

export type Add = (key: string, canvas: HTMLCanvasElement) => void;
export type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl';
export type Pt = [number, number];

/** The soles' row in a hero frame (a function: art.ts imports this module, so its values aren't ready at load). */
export const feetRow = () => HERO_H - 2;
/** Unit steps per direction (y down). */
export const STEP: Record<Dir, Pt> = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1], ur: [1, -1], ul: [-1, -1], dr: [1, 1], dl: [-1, 1] };

/** Something a hand holds, drawn with its grip at (x, y). */
export type Item = (g: Grid, x: number, y: number) => void;
/** A layer drawn with the frame's anchor points. */
export type Layer = (g: Grid, a: Anchors) => void;

export interface Anchors {
  /** The feet point. */
  fx: number;
  fy: number;
  /** The torso map's top left. */
  tx: number;
  ty: number;
  /** The head map's top left. */
  hx: number;
  hy: number;
  /** The fists (frame px). */
  near: Pt;
  far: Pt;
}

/** One arm's look: segments from the shoulder (t = 0) to the fist (t = 1), each [t end, lit, ..., dark]. */
export interface ArmStyle {
  segs: Array<[number, ...string[]]>;
}

export interface Rig {
  pal: Pal;
  shades?: Record<string, Shade>;
  heads: Record<string, string[]>; // 'base' and any face variants
  torso: string[];
  legs: Record<string, string[]>;
  legsFeetX: number; // the feet centre column in the leg maps
  torsoX: number; // the torso map's left edge, relative to the feet
  torsoOverlap: number; // rows the torso's bottom overlaps the legs' top
  headX: number; // the head map's left edge, relative to the torso's
  headOverlap: number; // rows the head's bottom overlaps the torso's top
  shoulderNear: Pt; // in torso map coordinates
  shoulderFar: Pt;
  armNear: ArmStyle;
  armFar: ArmStyle;
  fistNear: string[];
  fistFar: string[];
  fistAt: Pt; // the fist map's top left relative to the hand point
}

export interface Hand {
  at: Pt; // relative to the feet (x right, y up)
  item?: Item;
  /** The item is drawn over the fist (a shield's face), else under it (a handle the fingers wrap). */
  over?: boolean;
  /** No arm or fist (the hand is hidden, e.g. behind a shield). */
  hidden?: boolean;
  /** The item is carried behind the whole body (a hammer on the shoulder): drawn before everything else. */
  behind?: boolean;
}

export interface RigPose {
  near: Hand;
  far: Hand;
  legs?: string;
  dx?: number; // upper body shift (right = positive)
  dy?: number; // upper body drop (down = positive)
  lean?: number; // the head's extra shift forward
  bow?: number; // the head hangs this much lower on the shoulders
  head?: string; // a face variant
  armsUp?: boolean; // the near arm goes behind the body (both hands over the head)
  farFront?: boolean; // the far arm and its item go in front of the body
  back?: Layer[];
  mid?: Layer[]; // after the far arm, before the legs
  front?: Layer[];
}

/** A thick line from the shoulder to the fist, lit on its upper/left side. */
export function armLine(g: Grid, sx: number, sy: number, hx: number, hy: number, style: ArmStyle): void {
  const n = Math.max(Math.abs(hx - sx), Math.abs(hy - sy));
  const flat = Math.abs(hx - sx) >= Math.abs(hy - sy);
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    const x = Math.round(sx + (hx - sx) * t);
    const y = Math.round(sy + (hy - sy) * t);
    const seg = style.segs.find((s) => t <= s[0]) ?? style.segs[style.segs.length - 1];
    const cols = seg.slice(1) as string[];
    cols.forEach((c, k) => put(g, x + (flat ? 0 : k), y + (flat ? k : 0), c));
  }
}

/** The anchors of a pose. */
export function anchors(rig: Rig, p: RigPose): Anchors {
  const fx = HERO_FEET_X;
  const fy = feetRow();
  const legs = rig.legs[p.legs ?? 'stand'];
  const ly = fy - legs.length + 1;
  const tx = fx + rig.torsoX + (p.dx ?? 0);
  const ty = ly - rig.torso.length + rig.torsoOverlap + (p.dy ?? 0);
  const head = rig.heads[p.head ?? 'base'] ?? rig.heads.base;
  const hx = tx + rig.headX + (p.lean ?? 0);
  const hy = ty - head.length + rig.headOverlap + (p.bow ?? 0);
  return { fx, fy, tx, ty, hx, hy, near: [fx + p.near.at[0], fy - p.near.at[1]], far: [fx + p.far.at[0], fy - p.far.at[1]] };
}

/** Paint a pose into `g` (a hero frame's box). */
export function paintRig(g: Grid, rig: Rig, p: RigPose): Anchors {
  const a = anchors(rig, p);
  const sh = rig.shades ?? {};
  const legs = rig.legs[p.legs ?? 'stand'];
  const head = rig.heads[p.head ?? 'base'] ?? rig.heads.base;
  const hand = (h: Hand, at: Pt, shoulder: Pt, style: ArmStyle, fist: string[]) => {
    if (h.item && !h.over && !h.behind) h.item(g, at[0], at[1]);
    if (!h.hidden) {
      armLine(g, a.tx + shoulder[0], a.ty + shoulder[1], at[0], at[1], style);
      stamp(g, fist, rig.pal, at[0] + rig.fistAt[0], at[1] + rig.fistAt[1]);
    }
    if (h.item && h.over) h.item(g, at[0], at[1]);
  };
  const far = () => hand(p.far, a.far, rig.shoulderFar, rig.armFar, rig.fistFar);
  const near = () => hand(p.near, a.near, rig.shoulderNear, rig.armNear, rig.fistNear);
  for (const l of p.back ?? []) l(g, a);
  if (p.far.item && p.far.behind) p.far.item(g, a.far[0], a.far[1]);
  if (p.near.item && p.near.behind) p.near.item(g, a.near[0], a.near[1]);
  if (!p.farFront) far();
  for (const l of p.mid ?? []) l(g, a);
  if (p.armsUp) near();
  stampShaded(g, legs, rig.pal, sh, a.fx - rig.legsFeetX, a.fy - legs.length + 1);
  stampShaded(g, rig.torso, rig.pal, sh, a.tx, a.ty);
  stampShaded(g, head, rig.pal, sh, a.hx, a.hy);
  if (p.farFront) far();
  if (!p.armsUp) near();
  for (const l of p.front ?? []) l(g, a);
  return a;
}

/** A hero select card: the pose on the plinth, the glow's [heart, rim] colours and a few motes (card px). */
export interface HeroCardSpec {
  pose: RigPose;
  glow: [string, string];
  motes: Array<[number, number]>;
}

export function rigFrame(rig: Rig, p: RigPose): HTMLCanvasElement {
  const g = grid(HERO_W, HERO_H);
  paintRig(g, rig, p);
  return toCanvas(g);
}

// ------------------------------------------------------------------ shapes shared by the heroes' kits

/** A four-point sparkle: a white heart and four arms in `arm`. */
export function sparkle(g: Grid, x: number, y: number, arm: string, heart = '#ffffff', big = false): void {
  put(g, x, y, heart);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    put(g, x + dx, y + dy, arm);
    if (big) put(g, x + dx * 2, y + dy * 2, arm);
  }
}

/**
 * A pole (staff, haft) from the grip (x, y) running `len` px along `dir` and `back` px the other way, 2 px thick,
 * lit on its upper/left side. `ramp` = [dark, mid, lit]. Diagonals step cleanly (1:1).
 */
export function pole(g: Grid, x: number, y: number, dir: Dir, len: number, back: number, ramp: string[]): void {
  const [sx, sy] = STEP[dir];
  const diag = sx !== 0 && sy !== 0;
  for (let i = -back; i <= len; i++) {
    const px = x + sx * i;
    const py = y + sy * i;
    if (diag) {
      // two pixels per step along the diagonal: the upper one lit, the lower one shaded
      put(g, px, py, ramp[2]);
      put(g, px + (sx === sy ? -1 : 1), py, ramp[1]);
      put(g, px, py + 1, ramp[0]);
    } else if (sx === 0) {
      put(g, px, py, ramp[2]);
      put(g, px + 1, py, ramp[0]);
    } else {
      put(g, px, py, ramp[2]);
      put(g, px, py + 1, ramp[0]);
    }
  }
}

/** The end of a pole: the point `len` px from (x, y) along `dir`. */
export const along = (x: number, y: number, dir: Dir, len: number): Pt => [x + STEP[dir][0] * len, y + STEP[dir][1] * len];

// Character-map transforms (for items drawn at 8 directions from a right-pointing and an up-right-pointing map).
export interface Sprite {
  rows: string[];
  grip: Pt;
}
export const flipXS = (m: Sprite): Sprite => {
  const w = Math.max(...m.rows.map((r) => r.length));
  return { rows: m.rows.map((r) => [...r.padEnd(w, '.')].reverse().join('')), grip: [w - 1 - m.grip[0], m.grip[1]] };
};
export const flipYS = (m: Sprite): Sprite => ({ rows: [...m.rows].reverse(), grip: [m.grip[0], m.rows.length - 1 - m.grip[1]] });
/** Rotate 90 degrees counter-clockwise: the top row becomes the left column. */
export const rotCCWS = (m: Sprite): Sprite => {
  const h = m.rows.length;
  const w = Math.max(...m.rows.map((r) => r.length));
  const rows = m.rows.map((r) => r.padEnd(w, '.'));
  return { rows: Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => rows[x][w - 1 - y]).join('')), grip: [m.grip[1], w - 1 - m.grip[0]] };
};
/** A sprite at 8 directions from its right-pointing (`r`) and up-right-pointing (`ur`) maps. */
export function dir8(r: Sprite, ur: Sprite, dir: Dir): Sprite {
  switch (dir) {
    case 'r':
      return r;
    case 'l':
      return flipXS(r);
    case 'u':
      return rotCCWS(r);
    case 'd':
      return flipYS(rotCCWS(r));
    case 'ur':
      return ur;
    case 'ul':
      return flipXS(ur);
    case 'dr':
      return flipYS(ur);
    case 'dl':
      return flipXS(flipYS(ur));
  }
}
/** Stamp a sprite with its grip at (x, y). */
export const stampAt = (g: Grid, s: Sprite, pal: Pal, x: number, y: number) => stamp(g, s.rows, pal, x - s.grip[0], y - s.grip[1]);

/** A ribbon (braid, scarf, vine) from (x, y): `n` 1px steps along the angle `ang(t)` (0 = right, PI/2 = down), with
 *  a colour per step: `col(t, i)` returns [lit, dark] (the dark pixel goes under/right of the lit one), or one colour. */
export function ribbon(g: Grid, x: number, y: number, n: number, ang: (t: number) => number, col: (t: number, i: number) => string[]): void {
  let fx = x;
  let fy = y;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = ang(t);
    fx += Math.cos(a);
    fy += Math.sin(a);
    const px = Math.round(fx);
    const py = Math.round(fy);
    const c = col(t, i);
    const flat = Math.abs(Math.cos(a)) >= Math.abs(Math.sin(a));
    c.forEach((cc, k) => put(g, px + (flat ? 0 : k), py + (flat ? k : 0), cc));
  }
}

/** A warm firelight rim on the pixels whose right neighbour is empty (the camp sprites stand left of the fire). */
export function fireRim(g: Grid, from: number, lit: string, dim: string, skip: Set<string> = new Set()): void {
  for (let y = from; y < g.length; y++)
    for (let x = 0; x < g[0].length - 1; x++) {
      const c = g[y][x];
      if (!c || g[y][x + 1] || skip.has(c)) continue;
      const v = parseInt(c.slice(1), 16);
      const lum = ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11;
      g[y][x] = lum > 110 ? lit : dim;
    }
}

/**
 * A solid block (a hammer head, a keg's stave) rotated to angle `ang` (0 = its long axis vertical), centred on
 * (cx, cy): `hu` half-length across the long axis, `hv` half-length along it, corners cut. Shaded in screen space
 * from its own edges (light from the top left) on `ramp` (dark to light, 5 tones); `band` (optional) paints two
 * bands round it, `bandAt` px in from each end, in [lit, dark].
 */
export function block(g: Grid, cx: number, cy: number, ang: number, hu: number, hv: number, ramp: string[], band?: [string, string], bandAt = 2): void {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const R = Math.ceil(Math.hypot(hu, hv)) + 1;
  const local = (x: number, y: number): [number, number] => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    return [dx * c + dy * s, -dx * s + dy * c];
  };
  const inside = (x: number, y: number) => {
    const [u, v] = local(x, y);
    return Math.abs(u) <= hu && Math.abs(v) <= hv && Math.abs(u) + Math.abs(v) <= hu + hv - 1.2;
  };
  for (let y = Math.floor(cy - R); y <= cy + R; y++)
    for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (!inside(x, y)) continue;
      let col = ramp[2];
      if (!inside(x, y + 1)) col = ramp[0];
      else if (!inside(x + 1, y)) col = ramp[1];
      else if (!inside(x, y - 1)) col = ramp[4];
      else if (!inside(x - 1, y) || !inside(x, y - 2)) col = ramp[3];
      else if (!inside(x + 1, y + 1)) col = ramp[1];
      if (band) {
        const [, v] = local(x, y);
        if (Math.abs(Math.abs(v) - (hv - bandAt)) < 0.75) col = !inside(x, y + 1) || !inside(x + 1, y) ? band[1] : band[0];
      }
      put(g, x, y, col);
    }
}

/** The direction's angle for `block` (the block's long axis across the direction). */
export const dirAngle = (dir: Dir): number => Math.atan2(STEP[dir][1], STEP[dir][0]);
