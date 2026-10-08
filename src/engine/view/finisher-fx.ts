// The finisher shows' shared parts: the context every style kit and signature moment draws from (view/finishers.ts
// builds it), the show's own short-lived marks (a cut that lingers, a rift, a flying shield, an ice spike...: each a
// kind with a drawer, on the stage behind the actors or over them), and small pixel helpers (outlined polygons, thick
// lines, a stage vignette, deterministic noise so the screenshot tests stay exact).
import type Phaser from 'phaser';
import type { ShowMove, ShowScale, ShowTimeline, SignatureId } from '../../core/finisher-show';
import type { StyleId } from '../../data/heroes';
import type { FightScene } from '../scene';
import { GAME_W } from '../layout';
import { clamp01, INK, mix, type EnemyView } from './shared';

export type G = Phaser.GameObjects.Graphics;

/** A style's palette, darkest to white-hot, plus its accent. */
export interface Pal {
  deep: number;
  dark: number;
  base: number;
  light: number;
  hot: number;
  accent: number;
}

/** A short-lived piece of a show, drawn each frame by its kind's drawer until its life is up. */
export interface Mark {
  kind: string;
  x: number;
  y: number;
  /** A second point (a flight's target, a line's end). */
  x1: number;
  y1: number;
  /** Anim time it starts (it may start later than it is made) and how long it lasts (ms). */
  at: number;
  life: number;
  r: number;
  dir: number;
  seed: number;
  /** Behind the actors (on the sky and the ground) or over them. */
  sky: boolean;
  v?: EnemyView;
  /** A texture (an afterimage's frame). */
  tex?: string;
  /** The show that made it (a mark can outlive its show, or see the next one start). */
  c?: ShowCtx;
}

/** Everything a show's kit and signature draw from. */
export interface ShowCtx {
  s: FightScene;
  hero: string;
  style: StyleId;
  sig: SignatureId;
  move: ShowMove;
  scale: ShowScale;
  tl: ShowTimeline;
  /** Stacks it's drawn for (1..5). */
  n: number;
  /** Anim time it started. */
  at: number;
  /** Its targets (the living foes it hits, as they stood when it started). */
  views: EnemyView[];
  /** Where the hero stood, and where their moves take them. */
  heroX: number;
  toX: number;
  pal: Pal;
  /** The stacks' colours [fill, highlight, shade] (the title, the rings). */
  stack: readonly [number, number, number];
  marks: Mark[];
  damage: number;
  /** The hero's frame for a pose (their own, else Rowan's). */
  heroTex: (pose: string) => string;
  /** Where the hero is now (x, and how far off the ground). */
  heroAt: () => { x: number; lift: number };
}

/** A drawer for one kind of mark: k is 0..1 through its life. */
export type MarkDraw = (g: G, m: Mark, k: number, c: ShowCtx) => void;

/** How far through the show it is now (0..1; past 1 once it's over). */
export const showK = (c: ShowCtx): number => (c.s.anim - c.at) / c.tl.ms;
/** Anim time of a point k through the show. */
export const showAt = (c: ShowCtx, k: number): number => c.at + k * c.tl.ms;
/** Ms from now until a point k through the show (0 if it's past). */
export const msUntil = (c: ShowCtx, k: number): number => Math.max(0, showAt(c, k) - c.s.anim);

/** Add a mark (its fields default to the spot itself, now, 300 ms, over the actors). */
export function mark(c: ShowCtx, kind: string, o: Partial<Mark> & { x: number; y: number }): Mark {
  const m: Mark = { kind, x1: o.x, y1: o.y, at: c.s.anim, life: 300, r: 0, dir: 1, seed: (c.marks.length * 7919 + c.at) | 0, sky: false, c, ...o };
  c.marks.push(m);
  if (c.marks.length > 220) c.marks.splice(0, c.marks.length - 220);
  return m;
}

/** A foe's chest (its middle), top and feet. */
export const chest = (v: EnemyView): number => v.y - v.img.displayHeight / 2;
export const topOf = (v: EnemyView): number => v.y - v.img.displayHeight;
/** The middle of the targets (or a spot ahead of the hero). */
export const centerOf = (c: ShowCtx): number => (c.views.length ? c.views.reduce((a, v) => a + v.x, 0) / c.views.length : c.heroX + 90);
/** The targets' span: the nearest and the farthest x. */
export function spanOf(c: ShowCtx): [number, number] {
  if (!c.views.length) return [c.heroX + 70, c.heroX + 110];
  return [Math.min(...c.views.map((v) => v.x)), Math.max(...c.views.map((v) => v.x))];
}

/** A foe is struck: it flashes white and is knocked back a little (the shows' own hits, between the real ones). */
export function hitFoe(c: ShowCtx, v: EnemyView, dist = 4, flashMs = 30): void {
  v.flashUntil = c.s.anim + flashMs;
  v.kickAt = c.s.anim;
  v.kickDist = dist;
}

/** Deterministic noise in 0..1 (per frame drawing must not use Math.random: the screenshots stay exact). */
export function hash(i: number, seed = 0): number {
  let h = (i * 374761393 + seed * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A filled polygon (points in order). */
export function poly(g: G, pts: ReadonlyArray<readonly [number, number]>, col: number, a = 1): void {
  if (pts.length < 3 || a <= 0) return;
  g.fillStyle(col, a);
  // (fillPoints only reads x and y)
  g.fillPoints(pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y) })) as unknown as Phaser.Math.Vector2[], true);
}

/** A polygon with a 1 px ink outline round it (grown by 1 px from its middle). */
export function inkPoly(g: G, pts: ReadonlyArray<readonly [number, number]>, col: number, a = 1, ink = INK): void {
  if (pts.length < 3) return;
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const grow = pts.map(([x, y]): [number, number] => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((x - cx) / d) * 1.2, y + ((y - cy) / d) * 1.2];
  });
  poly(g, grow, ink, a);
  poly(g, pts, col, a);
}

/** A pixel line `w` px thick from (x0, y0) to (x1, y1). */
export function line(g: G, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a = 1): void {
  if (a <= 0) return;
  const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const steps = Math.max(1, Math.ceil(len));
  const o = Math.floor(w / 2);
  g.fillStyle(col, a);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    g.fillRect(Math.round(x0 + (x1 - x0) * t) - o, Math.round(y0 + (y1 - y0) * t) - o, w, w);
  }
}

/** An inked line: an ink line one px wider under a coloured one. */
export function inkLine(g: G, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a = 1): void {
  line(g, x0, y0, x1, y1, w + 2, INK, a);
  line(g, x0, y0, x1, y1, w, col, a);
}

/** A ring (an ellipse outline). */
export function ellipseLine(g: G, x: number, y: number, rx: number, ry: number, th: number, col: number, a = 1): void {
  if (a <= 0 || rx < 1) return;
  g.lineStyle(th, col, a);
  g.strokeEllipse(Math.round(x), Math.round(y), Math.round(rx * 2), Math.max(2, Math.round(ry * 2)));
}

/** A 4-point twinkle (a cross with a white heart). */
export function twinkle(g: G, x: number, y: number, size: number, col: number, a = 1): void {
  if (a <= 0) return;
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(col, a);
  g.fillRect(x - size, y, size * 2 + 1, 1);
  g.fillRect(x, y - size, 1, size * 2 + 1);
  g.fillStyle(0xffffff, a);
  g.fillRect(x, y, 1, 1);
}

/** Vertical bands of colour from y0 to y1 (a sky), with a 2x2 dither between them. */
export function bands(g: G, cols: readonly number[], y0: number, y1: number, a: number): void {
  const h = (y1 - y0) / cols.length;
  cols.forEach((col, i) => {
    const top = Math.round(y0 + i * h);
    const bot = Math.round(y0 + (i + 1) * h);
    g.fillStyle(col, a);
    g.fillRect(0, top, GAME_W, bot - top);
    // a dithered seam into the next band
    if (i < cols.length - 1) {
      g.fillStyle(cols[i + 1], a);
      for (let x = (i % 2) * 2; x < GAME_W; x += 4) g.fillRect(x, bot - 1, 2, 1);
    }
  });
}

/** The stage's edges darken (only the stage: the bar stays as readable as ever). */
export function vignette(g: G, s: FightScene, amt: number): void {
  if (amt <= 0.01) return;
  const h = s.splitY;
  for (let i = 0; i < 6; i++) {
    const a = amt * (0.22 - i * 0.03);
    if (a <= 0) break;
    const w = 6 + i * 7;
    g.fillStyle(INK, a);
    g.fillRect(0, 0, w, h);
    g.fillRect(GAME_W - w, 0, w, h);
    g.fillRect(w, 0, GAME_W - 2 * w, Math.round(w * 0.5));
  }
}

/**
 * A crescent band (a slash, a jaw, a fang) from angle a0 through `span`: outer radius r, `th` thick at its middle and
 * tapering to points, squashed vertically by `sy`. Drawn as an ink rim, a body, a pale band and a white-hot edge.
 */
export function crescent(g: G, cx: number, cy: number, r: number, th: number, a0: number, span: number, sy: number, cols: { body: number; light: number; rim?: number }, a = 1): void {
  const band = (rOut: number, t: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    const N = 16;
    for (let j = 0; j <= N; j++) {
      const ang = a0 + (span * j) / N;
      pts.push([cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut * sy]);
    }
    for (let j = N; j >= 0; j--) {
      const q = j / N;
      const ang = a0 + span * q;
      const rr = rOut - t * Math.sin(Math.PI * q);
      pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * sy]);
    }
    return pts;
  };
  poly(g, band(r + 1, th + 1), cols.rim ?? INK, a);
  poly(g, band(r, th), cols.body, a);
  poly(g, band(r - th * 0.35, th * 0.6), cols.light, a);
  poly(g, band(r - th * 0.6, th * 0.34), 0xffffff, a);
}

/** The show's fade: in over its first 8%, out over its last 14%. */
export const showFade = (k: number): number => (k < 0 || k >= 1 ? 0 : k < 0.08 ? k / 0.08 : k > 0.86 ? (1 - k) / 0.14 : 1);

/** Quick in, slow out (0..1). */
export const outQuad = (k: number): number => 1 - (1 - clamp01(k)) ** 2;

/** A colour pulled toward another (re-exported for the kits). */
export const toward = mix;
