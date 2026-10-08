// The sharper chest reveal (playtest round 7: "chest reveals could look cleaner and higher-resolution"; a test, the
// old reveal stays the default). The same opening (view/chest-opening.ts: its timeline, taps, sounds, queue and
// summary) drawn on a finer grid: a DOM canvas laid exactly over the game canvas at HD_K x its resolution
// (hd-layer.ts), image smoothing off, hard pixels only (fillRect and pre-painted canvases, never paths, so no
// anti-aliasing). The world and the fighters stay on the game's grid; the chest (art-chests-hd.ts), the light, the
// particles, the ribbon, the tags and the lettering (font-hd.ts) are authored at the finer grid. Every beat of the old
// one: the slam and its dust, the pulses through the rarity colours (the tier gems lighting one by one), the cracks
// of light, the charge, the lid bursting off (a flash, the starburst, rays, a column of light, sparks), the prize
// rising as a silhouette rimmed in its tier's light, the white flash as it fills in, the ribbon, the name and what it
// means (new, or shards filling toward a star). Particles are worked out from the time and a seed (no state), so a
// tap's fast-forward lands mid-flight and the screenshot tests stay exact.
//
// The layer shows only on frames that draw on it (a frame that doesn't hides it), so leaving a screen leaves nothing.
import Phaser from 'phaser';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { HEROES, type HeroId } from '../../data/heroes';
import { TIERS, TIER_INFO, type Tier } from '../../data/rarity';
import { STYLES } from '../../data/styles';
import { shardsToNext } from '../../core/roster';
import type { Tuning } from '../../core/tuning';
import { HERO_FEET_X } from '../art';
import type { HeroChestKind } from '../art-chests';
import { HD_CHEST, hdChest } from '../art-chests-hd';
import { BURST_RADII, hdBurst, hdChevron, hdRay, hdRibbon, hdShard, hdStar, hdTag, hdTierGem, hdTwinkle, mixRgb, type Face4 } from '../art-reveal-hd';
import { hdText, hdTextW, type HdTextStyle } from '../font-hd';
import { HD_K, hdLayerRect, sameLayer, type HdLayerRect } from '../hd-layer';
import type { ScreenLayout } from '../layout';
import { STYLE_LOOK, type CampKit } from './camp-kit';

type Ctx = CanvasRenderingContext2D;

const WHITE = 0xffffff;
const INK = 0x140c1c;
/** The prism's colours (Divine's light cycles through them), as the old reveal's. */
const PRISM = [0xff8ab8, 0xffe070, 0x7af0b4, 0x8acbff, 0xc8a2ff];
/** The shards' star pops this long after the reveal (as the old reveal's). */
export const REVEAL_STAR_AT = 1000;

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const easeOut3 = (k: number) => 1 - (1 - clamp01(k)) ** 3;
const easeBack = (k: number, over = 1.6) => {
  const t = clamp01(k) - 1;
  return 1 + t * t * ((over + 1) * t + over);
};
const pulse = (now: number, period: number, phase = 0) => 0.5 - 0.5 * Math.cos(((now + phase) / period) * Math.PI * 2);
const css = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
/** A deterministic hash in [0, 1). */
function hash(a: number, b: number, s: number): number {
  let h = (a * 374761393 + b * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ the layer (a DOM canvas over the game canvas)

/** The fine-grid canvas over the game: placed and sized with the layout, cleared each frame it's drawn on, hidden on
 *  frames it isn't. */
export class HdLayer {
  private cv: HTMLCanvasElement | null = null;
  private ctx: Ctx | null = null;
  private rect: HdLayerRect | null = null;
  private drawn = false;
  private shown = false;
  private hooked = false;

  constructor(
    private readonly s: Phaser.Scene,
    private readonly layout: () => ScreenLayout,
  ) {}

  /** The canvas (tests). */
  get canvas(): HTMLCanvasElement | null {
    return this.cv;
  }

  get visible(): boolean {
    return this.shown;
  }

  private hook(): void {
    if (this.hooked) return;
    this.hooked = true;
    this.s.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.preUpdate, this);
    this.s.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
  }

  private preUpdate(): void {
    this.drawn = false;
  }

  private postUpdate(): void {
    if (!this.drawn && this.shown) this.hide();
  }

  /** A frame on the layer: placed over the game canvas, cleared. */
  begin(): { ctx: Ctx; r: HdLayerRect } {
    this.hook();
    if (!this.cv) {
      const cv = document.createElement('canvas');
      cv.id = 'hd-layer';
      cv.setAttribute('aria-hidden', 'true');
      const st = cv.style;
      st.position = 'absolute';
      st.pointerEvents = 'none';
      st.imageRendering = 'pixelated';
      st.margin = '0';
      st.display = 'none';
      (document.getElementById('game') ?? document.body).appendChild(cv);
      this.cv = cv;
      this.ctx = cv.getContext('2d');
    }
    const cv = this.cv;
    const ctx = this.ctx!;
    const r = hdLayerRect(this.layout(), HD_K);
    if (!sameLayer(this.rect, r)) {
      const st = cv.style;
      st.left = `${r.left}px`;
      st.top = `${r.top}px`;
      st.width = `${r.cssW}px`;
      st.height = `${r.cssH}px`;
      if (cv.width !== r.w) cv.width = r.w;
      if (cv.height !== r.h) cv.height = r.h;
      this.rect = r;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, r.w, r.h);
    if (!this.shown) {
      cv.style.display = 'block';
      this.shown = true;
    }
    this.drawn = true;
    return { ctx, r };
  }

  hide(): void {
    if (this.cv && this.shown) this.cv.style.display = 'none';
    this.shown = false;
  }

  destroy(): void {
    if (this.hooked) {
      this.s.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.preUpdate, this);
      this.s.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    }
    this.hooked = false;
    this.cv?.remove();
    this.cv = null;
    this.ctx = null;
    this.rect = null;
    this.shown = false;
  }
}

// ------------------------------------------------------------------ drawing helpers (hard pixels only)

/** Tinted copies of white masks and sprites (fill: every opaque pixel takes the colour), cached. */
const tints = new WeakMap<CanvasImageSource, Map<number, HTMLCanvasElement>>();
function tinted(src: HTMLCanvasElement, col: number): HTMLCanvasElement {
  let m = tints.get(src);
  if (!m) {
    m = new Map();
    tints.set(src, m);
  }
  let c = m.get(col);
  if (!c) {
    if (m.size > 24) m.clear();
    c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const x = c.getContext('2d')!;
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = css(col);
    x.fillRect(0, 0, c.width, c.height);
    m.set(col, c);
  }
  return c;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, col: number, a: number): void {
  if (a <= 0 || w <= 0 || h <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = css(col);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A filled ellipse in whole rows (hard edges). */
function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: number, a: number): void {
  if (a <= 0 || rx < 0.5 || ry < 0.5) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = css(col);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const R = Math.round(ry);
  for (let dy = -R; dy < R; dy++) {
    const k = (dy + 0.5) / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)));
    if (half > 0) ctx.fillRect(x0 - half, y0 + dy, half * 2, 1);
  }
}

const circlePts = new Map<number, Array<[number, number]>>();
/** The pixels of a circle outline of radius r (midpoint), cached. */
function circle(r: number): Array<[number, number]> {
  let pts = circlePts.get(r);
  if (!pts) {
    pts = [];
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      for (const [a, b] of [
        [x, y],
        [y, x],
        [-y, x],
        [-x, y],
        [-x, -y],
        [-y, -x],
        [y, -x],
        [x, -y],
      ])
        pts.push([a, b]);
      y++;
      if (err < 0) err += 2 * y + 1;
      else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
    if (circlePts.size > 400) circlePts.clear();
    circlePts.set(r, pts);
  }
  return pts;
}

/** A ring of light expanding from `at` over `life` ms (radius rEnd fine px), thinning as it fades. */
function ring(ctx: Ctx, cx: number, cy: number, rEnd: number, col: number, at: number, life: number, lt: number, A: number): void {
  const k = (lt - at) / life;
  if (k < 0 || k >= 1) return;
  const r = Math.round(rEnd * (0.32 + 0.68 * easeOut3(k)));
  ctx.globalAlpha = (1 - k) * 0.9 * A;
  ctx.fillStyle = css(col);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (const [dx, dy] of circle(r)) ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
  if (k < 0.55) {
    ctx.globalAlpha = (1 - k) * 0.5 * A;
    for (const [dx, dy] of circle(Math.max(1, r - 1))) ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
  }
}

interface ImgOpts {
  ox?: number;
  oy?: number;
  sx?: number;
  sy?: number;
  angle?: number;
  alpha?: number;
  add?: boolean;
  tint?: number;
}

/** Draw a canvas at (x, y) with an origin, scale, rotation (radians), alpha, additive blend or a fill tint. */
function img(ctx: Ctx, src: HTMLCanvasElement, x: number, y: number, o: ImgOpts = {}): void {
  const a = o.alpha ?? 1;
  if (a <= 0) return;
  const c = o.tint === undefined ? src : tinted(src, o.tint);
  const sx = o.sx ?? 1;
  const sy = o.sy ?? sx;
  ctx.globalAlpha = Math.min(1, a);
  ctx.globalCompositeOperation = o.add ? 'lighter' : 'source-over';
  if (o.angle) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(o.angle);
    ctx.drawImage(c, Math.round(-(o.ox ?? 0.5) * c.width * sx), Math.round(-(o.oy ?? 0.5) * c.height * sy), Math.round(c.width * sx), Math.round(c.height * sy));
    ctx.restore();
  } else ctx.drawImage(c, Math.round(x - (o.ox ?? 0.5) * c.width * sx), Math.round(y - (o.oy ?? 0.5) * c.height * sy), Math.round(c.width * sx), Math.round(c.height * sy));
  ctx.globalCompositeOperation = 'source-over';
}

/** Text on the fine grid at (x, y): origin like the game's texts (oy 0.5 centres the box: caps and outline). */
function text(ctx: Ctx, s: string, x: number, y: number, st: HdTextStyle, o: { ox?: number; oy?: number; alpha?: number } = {}): { w: number; h: number } {
  const t = hdText(s, st);
  const boxH = t.cap + t.capTop * 2 + 1;
  ctx.globalAlpha = Math.min(1, o.alpha ?? 1);
  if ((o.alpha ?? 1) > 0) ctx.drawImage(t.canvas, Math.round(x - (o.ox ?? 0) * t.w), Math.round(y - (o.oy ?? 0) * boxH));
  return { w: t.w, h: boxH };
}

// ------------------------------------------------------------------ particles (from the time and a seed)

type PKind = 'spark' | 'star' | 'chip' | 'dust';
interface Burst {
  seed: number;
  at: number;
  x: number;
  y: number;
  n: number;
  /** How far they fly (fine px over their life), gravity (fine px/s^2), a lift (fine px/s). */
  dist: number;
  g: number;
  up?: number;
  life: number;
  cols: readonly number[];
  kind: PKind;
  /** Directions: all round (default), or the upper half fanned out (the slam's chips). */
  fan?: 'up';
}

function drawBurst(ctx: Ctx, b: Burst, lt: number, A: number): void {
  const age = lt - b.at;
  if (age < 0 || age > b.life * 1.05) return;
  for (let i = 0; i < b.n; i++) {
    const life = b.life * (0.55 + 0.45 * hash(i, 2, b.seed));
    if (age > life) continue;
    const k = age / life;
    const th = b.fan === 'up' ? -Math.PI * (0.08 + 0.84 * hash(i, 0, b.seed)) : Math.PI * 2 * hash(i, 0, b.seed);
    const d = b.dist * (0.3 + 0.7 * hash(i, 1, b.seed)) * easeOut3(k);
    const ts = age / 1000;
    const x = b.x + Math.cos(th) * d;
    const y = b.y + Math.sin(th) * d * 0.85 - (b.up ?? 0) * ts + 0.5 * b.g * ts * ts;
    const a = (1 - k * k) * A;
    const col = b.cols[i % b.cols.length];
    const X = Math.round(x);
    const Y = Math.round(y);
    if (b.kind === 'spark') {
      const big = k < 0.45 && i % 3 !== 0;
      rect(ctx, X, Y, big ? 2 : 1, big ? 2 : 1, col, a);
      // a short trail back toward where it came from
      const tx = Math.round(x - Math.cos(th) * 3);
      const ty = Math.round(y - Math.sin(th) * 3 * 0.85);
      rect(ctx, tx, ty, 1, 1, col, a * 0.45);
    } else if (b.kind === 'star') {
      const size = k < 0.5 ? (i % 2 === 0 ? 3 : 2) : k < 0.8 ? 2 : 1;
      img(ctx, hdTwinkle(size, col), X, Y, { alpha: a });
    } else if (b.kind === 'chip') {
      rect(ctx, X - 1, Y, 3, 2, col, a);
      rect(ctx, X - 1, Y, 2, 1, mixRgb(col, WHITE, 0.4), a);
    } else {
      // dust: a soft puff that grows and thins (two tones, lit on top)
      const r = 3 + k * 6 + (i % 3);
      ellipse(ctx, X, Y, r, r * 0.75, col, a * 0.5);
      ellipse(ctx, X - 1, Y - 1, r * 0.6, r * 0.45, mixRgb(col, WHITE, 0.25), a * 0.35);
    }
  }
}

// ------------------------------------------------------------------ the reveal

/** The timeline of one chest (chest-opening.ts timeline()). */
export interface RevealTimes {
  steps: number[];
  charge: number;
  burst: number;
  reveal: number;
  done: number;
}

/** One chest as it stands this frame (from the opening's run). */
export interface HdRun {
  kind: HeroChestKind;
  prize: { kind: string; id: string; tier: Tier; fresh?: boolean; shards: number; starsUp: number };
  before: { stars: number; shards: number };
  after: { stars: number; shards: number };
  /** The prize's tier index, the timeline, the slam (ms), where it is (local ms, fast-forward included). */
  t: number;
  tl: RevealTimes;
  slam: number;
  lt: number;
  shakes: ReadonlyArray<readonly [number, number, number]>;
  spin: number;
  /** Fading out (1 -> 0) once tapped away; chests still waiting after this one. */
  A: number;
  left: number;
  closing: boolean;
}

export interface HdScene {
  now: number;
  /** The screen's darkening (0..1). */
  veil: number;
  run: HdRun | null;
  /** The reveal's centre (game px), and the band it's clipped to (game px: the split view's half). */
  cx: number;
  clip: { x0: number; x1: number } | null;
  /** An opaque backdrop instead of the see-through veil (the split view: hides the old reveal's spill). */
  opaque: boolean;
  /** Where "Tap" / "Next (n)" goes (game px; default the bottom right corner). */
  hint?: { x: number; y: number; ox: number };
}

/** The tier's colours at step i (Divine's cycle through the prism), as the old reveal's. */
export function stepFace(i: number, now: number): Face4 {
  if (i >= 7) {
    const c = PRISM[Math.floor(now / 110) % PRISM.length];
    return [mixRgb(c, WHITE, 0.5), c, mixRgb(c, 0x000000, 0.25), mixRgb(c, 0x000000, 0.55)];
  }
  return TIER_INFO[TIERS[Math.max(0, i)]].face as Face4;
}

const heroPrize = (p: HdRun['prize']) => p.kind === 'hero' || p.kind === 'heroShards';
const freshPrize = (p: HdRun['prize']) => (p.kind === 'hero' || p.kind === 'pet') && !!p.fresh;

export class ChestHd {
  readonly layer: HdLayer;

  constructor(private readonly kit: CampKit) {
    this.layer = new HdLayer(kit.s, () => kit.app.layout);
  }

  /** Painting still to do before it's needed, one piece per frame (the burst's frames, tinted; the chests). */
  private warmQ: Array<() => void> = [];
  private warmed = false;

  private get tuning(): Tuning {
    return this.kit.tuning;
  }

  /** A chest is about to play: its parts are painted now (on the tap), the burst's frames over the next frames. */
  prepare(kind: HeroChestKind, tier: Tier): void {
    hdChest(kind);
    const col = mixRgb(TIER_INFO[tier].face[1], WHITE, 0.3);
    for (const rad of BURST_RADII) this.warmQ.push(() => tinted(hdBurst(rad), col));
  }

  /** The vault or the shrine is open with the new reveal on: the three chests painted, one per frame. */
  warmChests(): void {
    if (this.warmed) return;
    this.warmed = true;
    for (const k of ['hero', 'rare', 'region'] as const) this.warmQ.push(() => hdChest(k));
  }

  /** Draw this frame: the reveal (if any), then `extra` (the Test lab's controls). Neither: the layer hides. */
  frame(sc: HdScene | null, extra?: ((ctx: Ctx, r: HdLayerRect) => void) | null): void {
    this.warmQ.shift()?.();
    if (!sc && !extra) return this.layer.hide();
    const { ctx, r } = this.layer.begin();
    if (sc) this.drawScene(ctx, r, sc);
    if (extra) {
      ctx.save();
      extra(ctx, r);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  hide(): void {
    this.layer.hide();
  }

  destroy(): void {
    this.layer.destroy();
  }

  private drawScene(ctx: Ctx, r: HdLayerRect, sc: HdScene): void {
    const F = r.k;
    ctx.save();
    if (sc.clip) {
      ctx.beginPath();
      ctx.rect(Math.round(sc.clip.x0 * F), 0, Math.round((sc.clip.x1 - sc.clip.x0) * F), r.h);
      ctx.clip();
    }
    if (sc.opaque) rect(ctx, 0, 0, r.w, r.h, 0x07050d, 1);
    else rect(ctx, 0, 0, r.w, r.h, 0x05030a, 0.93 * sc.veil);
    if (sc.run) this.drawRun(ctx, r, sc, sc.run);
    this.vignette(ctx, r, sc.veil);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The edges and corners darkened in stepped bands. */
  private vignette(ctx: Ctx, r: HdLayerRect, k: number): void {
    const bands = [0.3, 0.2, 0.13, 0.07];
    bands.forEach((a, i) => {
      const d = (i + 1) * 7;
      rect(ctx, 0, 0, d, r.h, INK, a * k * 0.6);
      rect(ctx, r.w - d, 0, d, r.h, INK, a * k * 0.6);
      rect(ctx, 0, 0, r.w, Math.round(d * 0.6), INK, a * k * 0.5);
      rect(ctx, 0, r.h - Math.round(d * 0.6), r.w, Math.round(d * 0.6), INK, a * k * 0.5);
    });
  }

  private drawRun(ctx: Ctx, r: HdLayerRect, sc: HdScene, run: HdRun): void {
    const F = r.k;
    const s = this.kit.s;
    const now = sc.now;
    const { tl, t, lt, A } = run;
    const SLAM = run.slam;
    const CH = HD_CHEST;
    // the shake, on the fine grid
    let m = 0;
    for (const [at, px, ms] of run.shakes) {
      const k = (lt - at) / ms;
      if (k >= 0 && k < 1) m = Math.max(m, px * (1 - k));
    }
    const shx = m >= 0.25 ? Math.round(Math.sin(lt / 23) * m * F) : 0;
    const shy = m >= 0.25 ? Math.round(Math.cos(lt / 31) * m * 0.6 * F) : 0;
    const CX0 = Math.round(sc.cx * F);
    const CX = CX0 + shx;
    const GROUND = Math.round((s.B - 6) * F) + shy;
    const FOOT = Math.round((s.B - 39) * F) + shy;
    const PRIZE_MID = FOOT - 36 * F;
    const burst = lt >= tl.burst;
    const revealed = lt >= tl.reveal;
    // ---- the chest: falls, slams, hops on each step, recoils into the floor after the burst and sinks away
    let chestY = GROUND;
    if (lt < SLAM) {
      const q = lt / SLAM;
      chestY = Math.round(GROUND - (1 - q * q) * (GROUND + 40 * F));
    }
    if (burst) chestY += Math.round(easeOut3((lt - tl.burst) / 280) * 34 * F);
    if (revealed) chestY += Math.round(clamp01((lt - tl.reveal) / 420) ** 2 * 90 * F);
    const chestMid = chestY - CH.h / 2;
    const restMid = GROUND - CH.h / 2;
    let step = -1;
    tl.steps.forEach((at, i) => {
      if (lt >= at) step = i;
    });
    const sinceStep = step >= 0 ? lt - tl.steps[step] : 1e9;
    const charging = lt >= tl.charge && !burst;
    const ck = charging ? clamp01((lt - tl.charge) / (tl.burst - tl.charge)) : 0;
    const face = step >= 0 ? stepFace(step, now) : (TIER_INFO.common.face as Face4);
    const [hi, base] = face;
    // the slam's squash
    let sx = 1;
    let sy = 1;
    if (lt >= SLAM && lt < SLAM + 150) {
      const b = 1 - (lt - SLAM) / 150;
      sy = 1 - 0.08 * b;
      sx = 1 + 0.05 * b;
    }
    // each step jolts it: a hop of the lid, a jitter; the charge rattles it without rest
    const hopK = sinceStep < 170 ? Math.sin((sinceStep / 170) * Math.PI) : 0;
    let lift = Math.round(hopK * (1.5 + step * 0.4) * 2 * F);
    let jx = sinceStep < 300 ? Math.round(Math.sin(sinceStep / 18) * (1 + step * 0.35) * (1 - sinceStep / 300) * F) : 0;
    let jy = -Math.round(hopK * 1.5 * F);
    if (charging) {
      const amp = (1 + t * 0.25 + ck * 2) * F;
      jx = Math.round(Math.sin(lt / 17) * amp);
      jy = Math.floor(lt / 55) % 2 ? -F : 0;
      lift = Math.floor(lt / 70) % 2 ? Math.round((1 + ck * 2) * 2 * F) : 0;
    }
    // ---- the glow behind it in the tier's colour, swelling step by step, and its light on the floor
    const glowK = burst ? Math.max(0, 1 - (lt - tl.burst) / 900) : step < 0 ? 0.15 : 0.45 + (step / 7) * 0.4 + ck * 0.3;
    if (glowK > 0) {
      const pk = sinceStep < 220 ? 1 - sinceStep / 220 : 0;
      const R = 32 * (1.7 + step * 0.16 + ck * 0.6 + pk * 0.35 + 0.05 * Math.sin(now / 90)) * F;
      const ga = Math.min(1, glowK * (0.75 + 0.25 * pulse(now, 420)) + pk * 0.3) * A;
      // the tier's aura: clear stepped rings, then the glow's bands (additive), a brighter heart in its light colour
      if (step >= 0 && !burst) this.aura(ctx, CX, chestMid, (58 + step * 3 + pk * 6) * F, (50 + step * 3 + pk * 6) * F, step, now, A);
      ctx.globalCompositeOperation = 'lighter';
      [1, 0.76, 0.52].forEach((f, i) => ellipse(ctx, CX, chestMid, R * f, R * f, base, (0.06 + i * 0.03) * ga));
      const R2 = R * 0.6;
      [1, 0.58].forEach((f, i) => ellipse(ctx, CX, chestMid, R2 * f, R2 * f, hi, (0.08 + i * 0.05) * Math.min(1, glowK * 0.85 + pk * 0.3) * A));
      ctx.globalCompositeOperation = 'source-over';
      ellipse(ctx, CX, GROUND + 2 * F, (46 + step * 3) * F, 7 * F, base, 0.16 * glowK * A);
      ellipse(ctx, CX, GROUND + 2 * F, (30 + step * 2) * F, 4 * F, hi, 0.1 * glowK * A);
    }
    // the tiers climbed so far: a gem lights up per step (the ones above stay dark: will it go further?)
    const rowA = (burst ? 1 - clamp01((lt - tl.burst) / 260) : clamp01((lt - SLAM) / 300)) * A;
    if (rowA > 0) this.tierRow(ctx, now, CX0, step, sinceStep, rowA, F);
    // the floor's shadow under it
    if (!burst) ellipse(ctx, CX, GROUND + F, 44 * F * (lt < SLAM ? clamp01(lt / SLAM) : 1), 4 * F, 0x000000, 0.5 * A);
    // the slam: dust rolling out both ways, chips of stone
    for (const side of [-1, 1]) {
      drawBurst(ctx, { seed: 11 + side, at: SLAM, x: CX0 + side * 38 * F, y: GROUND - 3 * F, n: 7, dist: 26 * F, g: -20, life: 640, cols: [0x8a7a92, 0x6a5a7a, 0xa496ae], kind: 'dust', fan: 'up' }, lt, A);
      drawBurst(ctx, { seed: 21 + side, at: SLAM, x: CX0 + side * 40 * F, y: GROUND - 2 * F, n: 12, dist: 34 * F, g: 520, up: 40, life: 650, cols: [0x6a5a7a, 0x8a7a92, 0x4a4058, 0xb0a4b8], kind: 'chip', fan: 'up' }, lt, A);
    }
    // ---- the chest's parts
    const art = hdChest(run.kind);
    const cyB = chestY + jy;
    img(ctx, art.base, CX + jx, cyB, { ox: 0.5, oy: 1, sx, sy, alpha: A });
    // light in the gap (shows when the lid lifts) and, after the burst, pouring from the mouth
    const gapA = burst ? 1 : step < 0 ? 0 : 0.5 + 0.5 * (step / Math.max(1, t)) + ck * 0.5;
    if (gapA > 0) img(ctx, art.gap, CX + jx, cyB, { ox: 0.5, oy: 1, sx, sy, tint: burst ? mixRgb(TIER_INFO[run.prize.tier].face[0], WHITE, 0.3) : hi, add: true, alpha: Math.min(1, gapA) * A });
    if (!burst) img(ctx, art.lid, CX + jx, cyB - lift, { ox: 0.5, oy: 1, sx, sy, alpha: A });
    else {
      const ft = (lt - tl.burst) / 1000;
      if (ft < 1.2) {
        const lidCy = cyB - (CH.h - CH.lidCy);
        img(ctx, art.lid, CX + run.spin * ft * 90 * F, lidCy - 430 * F * ft + 280 * F * ft * ft, { ox: 0.5, oy: CH.lidCy / CH.h, angle: (run.spin * ft * 560 * Math.PI) / 180, alpha: A * clamp01(1.4 - ft) });
      }
    }
    // cracks of light: the seam, then cracks spreading over the lid and the box as the steps climb
    if (step >= 0 && !burst) {
      const n = charging ? 2 : Math.min(2, Math.floor((step * 3) / (t + 1)));
      const flick = sinceStep < 200 ? 0.35 * (1 - sinceStep / 200) : 0;
      const la = Math.min(1, 0.5 + 0.4 * (step / Math.max(1, t)) + flick + ck * 0.4 + 0.12 * Math.sin(now / 60)) * A;
      const lc = mixRgb(hi, WHITE, 0.3);
      img(ctx, art.leakB[n], CX + jx, cyB, { ox: 0.5, oy: 1, sx, sy, tint: lc, add: true, alpha: la });
      img(ctx, art.leakL[n], CX + jx, cyB - lift, { ox: 0.5, oy: 1, sx, sy, tint: lc, add: true, alpha: la });
    }
    // motes of light drawn into the chest while it builds (more and faster as it charges)
    if (charging || (step >= 0 && !burst)) {
      const n = charging ? 10 + Math.round(ck * 16) : 4 + step;
      for (let i = 0; i < n; i++) {
        const per = charging ? 620 - ck * 300 : 900;
        const q = (((lt / per + i / n) % 1) + 1) % 1;
        const ang = i * 2.39996 + Math.floor(lt / per + i / n) * 1.3;
        const d = 72 * F * (1 - q * q);
        const x = Math.round(CX + Math.cos(ang) * d);
        const y = Math.round(chestMid + Math.sin(ang) * d * 0.7);
        const a = (0.3 + 0.7 * q) * A * (charging ? 1 : 0.55);
        if (q > 0.72) rect(ctx, x, y, 1, 1, i % 3 ? hi : WHITE, a);
        else img(ctx, hdTwinkle(q > 0.4 ? 2 : 1, i % 3 ? hi : WHITE), x, y, { alpha: a });
      }
    }
    // ---- the burst: rays turning, a column of light, the starburst, a flash, sparks; the prize rising
    const pFace = TIER_INFO[run.prize.tier].face as Face4;
    if (burst) {
      const since = lt - tl.burst;
      const rayY = revealed ? PRIZE_MID : Math.round(restMid + (PRIZE_MID - restMid) * easeOut3((since - 160) / 700));
      this.rays(ctx, CX, rayY, now, t, easeOut3(since / 500) * A, F);
      const mouthY = cyB - (CH.h - CH.mouth);
      const ca = (revealed ? Math.max(0, 1 - (lt - tl.reveal) / 500) : 1) * A;
      if (ca > 0) {
        const top = -10 * F;
        // a clean widening edge (one fine px per row), its light fading up in a few flat bands
        const colC = mixRgb(pFace[0], WHITE, 0.3);
        for (let y = mouthY; y > top; y--) {
          const k = (mouthY - y) / (mouthY - top);
          const kq = Math.floor(k * 6) / 6;
          const half = Math.round((30 + k * 26) * F);
          rect(ctx, CX - half, y, half * 2, 1, colC, 0.16 * (1 - kq) * ca);
          rect(ctx, CX - Math.round(half * 0.4), y, Math.round(half * 0.8), 1, WHITE, 0.1 * (1 - kq) * ca);
        }
      }
      if (since < 650) {
        const bk = since / 650;
        const want = (0.5 + easeOut3(bk) * (2.6 + t * 0.3)) * 31.5 * F;
        const rad = BURST_RADII.find((x) => x >= want) ?? BURST_RADII[BURST_RADII.length - 1];
        img(ctx, hdBurst(rad), CX, restMid, { angle: (since / 5) * (Math.PI / 180), tint: mixRgb(pFace[1], WHITE, 0.3), add: true, alpha: (1 - bk) * A });
      }
      if (since < 260) rect(ctx, 0, 0, ctx.canvas.width, ctx.canvas.height, mixRgb(pFace[0], WHITE, 0.55), 0.85 * (1 - since / 260) * A);
      this.drawPrize(ctx, now, run, CX, FOOT, A, F);
    }
    // ---- the sparks and rings, over everything (like the camp's effects over the old reveal)
    tl.steps.forEach((at, i) => {
      if (lt < at || lt > at + 700) return;
      const f = stepFace(i, now);
      ring(ctx, CX0, restMid, (30 + i * 5) * F, f[0], at, 420, lt, A);
      drawBurst(ctx, { seed: 40 + i, at, x: CX0, y: restMid + 8 * F, n: 8 + i * 3, dist: 46 * F, g: 160, life: 560, cols: [f[0], f[1], WHITE], kind: 'spark' }, lt, A);
    });
    if (burst) {
      const bc = stepFace(t, now);
      drawBurst(ctx, { seed: 70, at: tl.burst, x: CX0, y: restMid, n: 34 + t * 8, dist: 120 * F, g: 70, life: 1000, cols: [bc[0], bc[1], WHITE, 0xfff0a8], kind: 'star' }, lt, A);
      drawBurst(ctx, { seed: 71, at: tl.burst, x: CX0, y: restMid, n: 22 + t * 3, dist: 100 * F, g: 130, life: 760, cols: [bc[0], WHITE], kind: 'spark' }, lt, A);
      drawBurst(ctx, { seed: 72, at: tl.burst, x: CX0, y: restMid, n: 16, dist: 70 * F, g: 420, up: 60, life: 900, cols: [bc[1], bc[2]], kind: 'chip' }, lt, A);
      ring(ctx, CX0, restMid, (44 + t * 5) * F, bc[0], tl.burst, 560, lt, A);
      ring(ctx, CX0, restMid, 26 * F, WHITE, tl.burst, 400, lt, A);
      // the reveal's own burst
      drawBurst(ctx, { seed: 90, at: tl.reveal, x: CX0, y: PRIZE_MID, n: 24 + t * 6, dist: 80 * F, g: 30, life: 1100, cols: [pFace[0], WHITE, pFace[1]], kind: 'star' }, lt, A);
      ring(ctx, CX0, PRIZE_MID, (40 + t * 4) * F, pFace[0], tl.reveal, 600, lt, A);
      if (t >= 4) ring(ctx, CX0, PRIZE_MID, (60 + t * 4) * F, WHITE, tl.reveal + 160, 700, lt, A);
    }
    // the fast-forward mark while it builds, "Tap" (or "Next (n)") once it can be closed
    const R = Math.round(s.R * F);
    const B = Math.round(s.B * F);
    if (!revealed) {
      const fa = (0.35 + 0.3 * pulse(now, 800)) * A;
      img(ctx, hdChevron(0xfff0c0), R - 30, B - 24, { ox: 0, oy: 0.5, alpha: fa });
      img(ctx, hdChevron(0xfff0c0), R - 20, B - 24, { ox: 0, oy: 0.5, alpha: fa });
    } else if (lt >= tl.done && !run.closing) {
      const h = sc.hint ?? { x: s.R - 4, y: s.B - 7, ox: 1 };
      text(ctx, run.left ? `Next (${run.left})` : 'Tap', Math.round(h.x * F), Math.round(h.y * F), { color: 0xfff0c0 }, { ox: h.ox, oy: 0.5, alpha: 0.6 + 0.4 * pulse(now, 900) });
    }
  }

  /** The tier's aura: stepped ellipses in its colours, motes rising (the shared rarity glow, finer). */
  private aura(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, step: number, now: number, A: number): void {
    const [hi, base, , deep] = stepFace(step, now);
    const br = 0.85 + 0.15 * pulse(now, 1400);
    const strength = 0.55 + step * 0.07;
    ellipse(ctx, cx, cy, rx * 1.25, ry * 1.2, deep, 0.18 * strength * br * A);
    ellipse(ctx, cx, cy, rx, ry, base, 0.16 * strength * br * A);
    ellipse(ctx, cx, cy, rx * 0.68, ry * 0.7, hi, 0.14 * strength * br * A);
    const n = 8 + step * 3;
    for (let i = 0; i < n; i++) {
      const period = 1800 + ((i * 431) % 1400);
      const q = ((now + i * 613) % period) / period;
      const x = cx + Math.sin(i * 2.3 + now / 1500) * rx * 0.85;
      const y = cy + ry * 0.8 - q * ry * 2.2;
      rect(ctx, x, y, 1, i % 4 === 0 ? 2 : 1, i % 2 ? hi : WHITE, Math.sin(q * Math.PI) * 0.85 * A);
    }
  }

  /** Eight gems, Common to Divine, under the top bar: lit up to the step reached, the newest popping. */
  private tierRow(ctx: Ctx, now: number, cx: number, step: number, sinceStep: number, a: number, F: number): void {
    const n = TIERS.length;
    const gap = 10 * F;
    const x0 = Math.round(cx - (n * gap - 3 * F) / 2);
    const y = 23 * F;
    for (let i = 0; i < n; i++) {
      const lit = i <= step;
      const f = stepFace(i, now);
      const pop = lit && i === step && sinceStep < 260 ? Math.sin((sinceStep / 260) * Math.PI) : 0;
      const x = x0 + i * gap;
      const yy = y - Math.round(pop * 3);
      if (lit && i === step) {
        const ga = (0.3 + 0.25 * pulse(now, 500)) * a;
        ellipse(ctx, x + 7, yy + 7, 12 + pop * 3, 12 + pop * 3, f[1], ga * 0.5);
        ellipse(ctx, x + 7, yy + 7, 9 + pop * 2, 9 + pop * 2, f[0], ga * 0.5);
      }
      img(ctx, hdTierGem(lit ? f : null), x - 1, yy - 1, { ox: 0, oy: 0, alpha: a });
      if (lit && i >= 6 && pulse(now, 700, i * 200) > 0.8) img(ctx, hdTwinkle(2, WHITE), x + 13, yy + 1, { alpha: a });
    }
  }

  /** Rays turning round (x, y) in the prize's colours (Divine's in the prism's). */
  private rays(ctx: Ctx, x: number, y: number, now: number, t: number, a: number, F: number): void {
    if (a <= 0) return;
    const face = TIER_INFO[TIERS[t]].face;
    const n = 12 + t * 2;
    const L = 360 * F;
    for (let i = 0; i < n; i++) {
      const a0 = now / (3600 - t * 200) + (i / n) * Math.PI * 2;
      const w = 0.05 + (i % 2 ? 0 : 0.025);
      const col = t >= 7 ? PRISM[i % PRISM.length] : i % 2 ? face[1] : face[0];
      img(ctx, hdRay(L, w), x, y, { ox: 0, oy: 0.5, angle: a0, tint: col, alpha: (i % 2 ? 0.09 : 0.06 + t * 0.008) * a });
    }
    // a heart of light
    ellipse(ctx, x, y, (34 + t * 2) * F, (30 + t * 2) * F, face[1], 0.1 * a);
    ellipse(ctx, x, y, (20 + t) * F, (18 + t) * F, face[0], 0.12 * a);
  }

  /** The prize: rising out of the light as a silhouette rimmed in its tier's colour, then revealed. */
  private drawPrize(ctx: Ctx, now: number, run: HdRun, CX: number, FOOT: number, A: number, F: number): void {
    const kit = this.kit;
    const { tl, lt } = run;
    const pz = run.prize;
    const hero = heroPrize(pz);
    const face = TIER_INFO[pz.tier].face as Face4;
    const revealed = lt >= tl.reveal;
    const art = hero ? HEROES[pz.id as HeroId].art : '';
    const frame = (n: number) => (hero ? `${art}_idle${n}` : pz.id === 'pip' ? `pip_idle${n}` : `comp_${pz.id}_idle${n}`);
    const f = revealed ? Math.floor((lt - tl.reveal) / (hero ? 480 : 340)) % 2 : 0;
    let key = frame(f);
    if (!kit.has(key)) key = frame(0);
    if (!kit.has(key)) return;
    const src = kit.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
    if (!src || !(src as HTMLCanvasElement).getContext) return;
    const w = src.width;
    const SC = (hero ? 2 : 3) * F; // the sprite keeps the game's grid: each of its pixels 2 (3) game px
    const flies = !hero && !!COMPANIONS[pz.id as CompanionId]?.flies;
    const ox = hero ? (HERO_FEET_X + 0.5) / w : 0.5;
    const rise = easeOut3((lt - tl.burst - 160) / 650);
    if (rise > 0) {
      const startY = (this.kit.s.B + 20) * F;
      const bob = revealed ? Math.round(Math.sin((lt - tl.reveal) / 380) * (flies ? 2 : 1) * F) : 0;
      const y = Math.round(startY + (FOOT - startY) * rise) - (flies ? 6 * F : 0) + bob + SC;
      const o = { ox, oy: 1, sx: SC };
      // the rim of light, on the fine grid: two steps out (a soft outer edge, a bright inner one)
      const rimA = (revealed ? Math.max(0.35, 1 - (lt - tl.reveal) / 600) : 0.75 + 0.25 * pulse(now, 500)) * A;
      const rimCol = pz.tier === 'divine' ? PRISM[Math.floor(now / 120) % PRISM.length] : mixRgb(face[0], WHITE, 0.2);
      for (const [dx, dy] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ])
        img(ctx, src, CX + dx, y + dy, { ...o, tint: face[1], add: true, alpha: rimA * 0.55 });
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        img(ctx, src, CX + dx, y + dy, { ...o, tint: rimCol, add: true, alpha: rimA });
      if (!revealed) img(ctx, src, CX, y, { ...o, tint: 0x0a0612, alpha: A });
      else {
        const rk = clamp01((lt - tl.reveal) / 360);
        img(ctx, src, CX, y, { ...o, alpha: A });
        if (rk < 1) img(ctx, src, CX, y, { ...o, tint: WHITE, alpha: (1 - rk) * A });
      }
    }
    if (revealed) this.drawLines(ctx, now, run, CX, FOOT, A, face, F);
  }

  /** The rarity ribbon over the prize, its name under it, and what it means. */
  private drawLines(ctx: Ctx, now: number, run: HdRun, CX: number, FOOT: number, A: number, face: Face4, F: number): void {
    const pz = run.prize;
    const since = run.lt - run.tl.reveal;
    const [hi, , , deep] = face;
    // the ribbon drops in from above with a bounce
    if (since > 60) {
      const bk = easeBack((since - 60) / 300, 2);
      const info = TIER_INFO[pz.tier];
      const tw = hdTextW(info.name, 1, true);
      const bw = tw + 40;
      const bh = 26;
      const top = 21 * F - Math.round((1 - Math.min(1, bk)) * 16);
      const rib = hdRibbon(bw, bh, face);
      img(ctx, rib, CX, top - 1, { ox: 0.5, oy: 0, alpha: A });
      text(ctx, info.name, CX, top + bh / 2, { color: WHITE, deep }, { ox: 0.5, oy: 0.5, alpha: A });
      if (info.sparkle !== 'none') {
        const c = Math.floor(now / 150) % 4;
        const left = CX - bw / 2;
        const cols = info.sparkle === 'stars' ? [WHITE, 0xd8f8ff] : PRISM;
        img(ctx, hdTwinkle(c % 2 ? 3 : 2, cols[c % cols.length]), left - 2, top + 3, { alpha: A });
        img(ctx, hdTwinkle(c % 2 ? 2 : 3, cols[(c + 2) % cols.length]), left + bw + 2, top + bh - 4, { alpha: A });
      } else if (pulse(now, 900) > 0.8) img(ctx, hdTwinkle(2, WHITE), CX + bw / 2 - 6, top + 4, { alpha: A });
    }
    // the name
    const na = clamp01((since - 220) / 180) * A;
    if (na > 0) {
      const ny = FOOT + 11 * F + Math.round((1 - na) * 10);
      text(ctx, prizeNameOf(pz), CX, ny, { level: 2, color: mixRgb(hi, WHITE, 0.25), deep, extrude: 3 }, { ox: 0.5, oy: 0.5, alpha: na });
    }
    // what it means
    const ka = clamp01((since - 420) / 180) * A;
    if (ka <= 0) return;
    const y = FOOT + 27 * F;
    if (freshPrize(pz)) {
      const hero = heroPrize(pz);
      const what = hero ? 'New hero!' : 'New companion!';
      const w = hdTextW(what, 1, true, true) + 26;
      const style = hero ? HEROES[pz.id as HeroId].style : null;
      const chipW = style ? hdTextW(STYLES[style].name, 1, true) + 20 : 0;
      const gap = style ? 8 : 0;
      const x0 = Math.round(CX - (w + gap + chipW) / 2);
      const pk = easeBack((since - 420) / 260, 2.2);
      const h = 26;
      const ty = y - 12 - Math.round((1 - Math.min(1, pk)) * 8);
      // a gold glow behind, the gold tag, dark lettering on it
      const ga = (0.35 + 0.3 * pulse(now, 700)) * ka;
      ellipse(ctx, x0 + w / 2, ty + h / 2, w / 2 + 8, h / 2 + 6, 0xf2c230, ga * 0.35);
      img(ctx, hdTag(w, h, [0xfff0a8, 0xffd866, 0xd08c24, 0x6e3c12]), x0 - 1, ty - 1, { ox: 0, oy: 0, alpha: ka });
      text(ctx, what, x0 + w / 2, ty + h / 2 + 1, { color: 0x5a2a08, plain: true }, { ox: 0.5, oy: 0.5, alpha: ka });
      if (pulse(now, 900) > 0.8) img(ctx, hdTwinkle(2, WHITE), x0 + w - 5, ty + 3, { alpha: ka });
      if (style) {
        const look = STYLE_LOOK[style];
        const cx0 = x0 + w + gap;
        const ch = 24;
        img(ctx, hdTag(chipW, ch, look.face), cx0 - 1, y - ch / 2 - 1, { ox: 0, oy: 0, alpha: ka });
        // a small gem in the style's light colour, then its name
        ellipse(ctx, cx0 + 7, y, 3, 3, look.face[0], ka);
        rect(ctx, cx0 + 6, y - 2, 1, 1, WHITE, ka);
        text(ctx, STYLES[style].name, cx0 + 14, y, { color: WHITE, deep: look.face[3] }, { ox: 0, oy: 0.5, alpha: ka });
      }
    } else this.drawShards(ctx, run, since, CX, y, ka, F);
  }

  /** "+10" shards: the stars and the shard bar filling from before to after; a star gained pops in with a burst. */
  private drawShards(ctx: Ctx, run: HdRun, since: number, CX: number, y: number, a: number, F: number): void {
    const { prize: pz, before, after } = run;
    const up = pz.starsUp > 0;
    const STAR_AT = REVEAL_STAR_AT;
    const starsShown = up && since < STAR_AT ? before.stars : after.stars;
    const label = `+${pz.shards}`;
    const lw = 26 + hdTextW(label, 1, true);
    const step = 9 * F;
    const sw = 5 * step;
    const barW = 40 * F;
    const tailW = up ? hdTextW('Star up!', 1, true) : 24 * F;
    const total = lw + 12 + sw + 8 + barW + 8 + tailW;
    let x = Math.round(CX - total / 2);
    img(ctx, hdShard(), x, y, { ox: 0, oy: 0.5, alpha: a });
    text(ctx, label, x + 20, y, { color: 0xe8d0ff }, { oy: 0.5, alpha: a });
    x += lw + 12;
    const sx0 = x;
    for (let i = 0; i < 5; i++) img(ctx, hdStar(i < starsShown), x + i * step, y, { ox: 0, oy: 0.5, alpha: a });
    x += sw + 8;
    const need = shardsToNext(this.tuning, starsShown);
    const fk = easeOut3((since - 600) / 600);
    let frac: number;
    let shown: string;
    if (up && since < STAR_AT) {
      const n0 = shardsToNext(this.tuning, before.stars) ?? 1;
      frac = (before.shards + (n0 - before.shards) * clamp01(fk)) / n0;
      shown = `${n0}/${n0}`;
    } else if (need === null) {
      frac = 1;
      shown = 'Max';
    } else {
      const from = up ? 0 : before.shards;
      frac = (from + (after.shards - from) * clamp01(up ? (since - STAR_AT) / 400 : fk)) / need;
      shown = `${after.shards}/${need}`;
    }
    this.gauge(ctx, x, y - 5, barW, 10, clamp01(frac), a);
    if (!(up && since >= STAR_AT)) text(ctx, shown, x + barW + 8, y, { color: 0xe0d0ff, bold: false }, { oy: 0.5, alpha: a });
    else {
      const px = sx0 + (after.stars - 1) * step + 9;
      drawBurst(ctx, { seed: 120, at: STAR_AT, x: px, y, n: 24, dist: 34 * F, g: 40, life: 800, cols: [0xfff0a0, 0xffd23a, WHITE], kind: 'star' }, since, a);
      ring(ctx, px, y, 16 * F, 0xfff0a0, STAR_AT, 420, since, a);
      const k = clamp01((since - STAR_AT) / 200);
      text(ctx, 'Star up!', x + barW + 8, y - Math.round((1 - easeBack(k, 2)) * 6), { color: 0xffe680 }, { oy: 0.5, alpha: a * k });
    }
  }

  /** A chunky bar on the fine grid: ink rim, a dark well, the fill's ramp (lit top), a shine on its top row. */
  private gauge(ctx: Ctx, x: number, y: number, w: number, h: number, frac: number, a: number): void {
    rect(ctx, x - 1, y - 1, w + 2, h + 2, INK, a);
    rect(ctx, x, y + h + 1, w, 2, INK, a * 0.4);
    rect(ctx, x, y, w, h, 0x241a34, a);
    rect(ctx, x, y + h - 2, w, 2, 0x1a1226, a);
    const fw = Math.round(w * frac);
    if (fw > 0) {
      const ramp = [0xf0d8ff, 0xc08af0, 0xa066e0, 0x8a4ad0, 0x6a34b0, 0x4a2080];
      const rows = [0, 1, 1, 2, 2, 3, 3, 3, 4, 5];
      for (let i = 0; i < h; i++) rect(ctx, x, y + i, fw, 1, ramp[rows[Math.min(rows.length - 1, Math.floor((i / h) * rows.length))]], a);
      rect(ctx, x + fw - 1, y, 1, h, 0xf0d8ff, a * 0.6);
    }
    for (let i = 1; i < 4; i++) rect(ctx, x + Math.round((w * i) / 4), y + 1, 1, h - 2, INK, a * 0.35);
  }
}

/** A prize's name. */
function prizeNameOf(p: HdRun['prize']): string {
  return heroPrize(p) ? HEROES[p.id as HeroId].name : COMPANIONS[p.id as CompanionId].name;
}
