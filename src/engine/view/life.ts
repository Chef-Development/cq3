// The living maps' shared parts (view/map-life.ts on the act maps, view/world-life.ts on the world map): critters
// that come and go on their own clocks and startle when tapped, the sparkle's glint and its pop when it's picked up.
// Life stays at the edge of attention: small, muted, slow, and never over a node, a road, a tag or the HUD (the
// views choose the spots). Every pose is a pure function of `now` and a seed, plus the moment of the last tap, so
// screenshots stay pixel-exact. Drawing is cheap: a few pooled images and a few dozen rects a frame.
import type Phaser from 'phaser';
import { buildLifeArt } from '../art-life';
import { hash } from '../backdrop';
import type { FightScene } from '../scene';
import { hudIcon, iconSize } from './pixels';
import { clamp01, WHITE, type Rect } from './shared';
import { ImagePool, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
export type Pt = [number, number];

export const rnd = (a: number, b: number, s: number): number => hash(a, b, s);
const mod = (v: number, m: number) => ((v % m) + m) % m;
const ease = (k: number) => 1 - (1 - k) * (1 - k);
export const overlaps = (a: Rect, b: Rect, pad = 0): boolean => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** A critter's pose this frame: its feet, its frame's texture, which way it faces, how solid it is. */
export interface Pose {
  x: number;
  y: number;
  key: string;
  flip: boolean;
  alpha: number;
}

/** The pools and the three graphics layers a living map draws on (under the critters, over them, the pops). */
export class LifeLayers {
  readonly pool: ImagePool;
  readonly texts: TextPool;
  low!: G;
  high!: G;
  pop!: G;

  /** The camera (a map bigger than the screen): everything is placed in map px less this. */
  private ox = 0;
  private oy = 0;

  constructor(
    private readonly s: FightScene,
    private readonly depth: { low: number; high: number; pop: number; text: number },
  ) {
    this.pool = new ImagePool(s);
    this.texts = new TextPool(s, depth.text);
  }

  /** Where the camera is this frame (the graphics layers follow it; sprites and texts are placed less it). */
  offset(ox: number, oy: number): void {
    this.ox = ox;
    this.oy = oy;
    for (const g of [this.low, this.high, this.pop]) g.setPosition(-ox, -oy);
  }

  /** New layout: the critters' textures (once), fresh layers. */
  build(): void {
    const s = this.s;
    buildLifeArt(
      (k, c) => s.textures.addCanvas(k, c),
      (k) => s.textures.exists(k),
    );
    for (const g of [this.low, this.high, this.pop]) g?.destroy();
    this.low = s.add.graphics().setDepth(this.depth.low);
    this.high = s.add.graphics().setDepth(this.depth.high);
    this.pop = s.add.graphics().setDepth(this.depth.pop);
    this.pool.destroy();
  }

  begin(): void {
    for (const g of [this.low, this.high, this.pop]) g.clear();
    this.pool.begin();
    this.texts.begin();
  }

  end(): void {
    this.pool.end();
    this.texts.end();
  }

  hide(): void {
    for (const g of [this.low, this.high, this.pop]) g?.clear();
    this.pool.hide();
    this.texts.hide();
  }

  size(key: string): [number, number] {
    return this.pool.size(key);
  }

  /** A sprite standing with its feet (bottom centre) at (x, y). */
  foot(key: string, x: number, y: number, depth: number, flip: boolean, alpha = 1, tint?: number): Img {
    return this.pool.foot(key, x - this.ox, y - this.oy, depth, alpha, tint).setFlipX(flip);
  }

  /** A sprite centred on (x, y). */
  mid(key: string, x: number, y: number, depth: number, flip: boolean, alpha = 1, tint?: number): Img {
    return this.pool.mid(key, x - this.ox, y - this.oy, depth, alpha, tint).setFlipX(flip);
  }

  /** A text at map (x, y). */
  text(str: string, x: number, y: number, color: number, o: Parameters<TextPool['text']>[4] = {}): void {
    this.texts.text(str, x - this.ox, y - this.oy, color, o);
  }

  pose(p: Pose, depth: number): void {
    this.foot(p.key, p.x, p.y, depth, p.flip, p.alpha);
  }
}

/** A tap box around a pose: the sprite and a margin, thumb-sized at 8x (at least 14 x 12 game px). */
export function poseBox(L: LifeLayers, p: Pose): Rect {
  const [w, h] = L.size(p.key);
  const bw = Math.max(14, w + 4);
  const bh = Math.max(12, h + 4);
  return { x: Math.round(p.x - bw / 2), y: Math.round(p.y - h / 2 - bh / 2), w: bw, h: bh };
}

// ------------------------------------------------------------------ a critter with a hiding place

const FLEE_MS = 320;
const CURL_MS = 2600;

/**
 * A critter that comes out of its cover now and then: out onto open ground, idles a while (nibbling, pecking,
 * grazing), then goes back. Tapped while out, it bolts back into cover (and stays there a while), or curls up where
 * it is (the hedgehog), or leaps into the water (the frog).
 */
export interface BurrowSpec {
  sprite: string;
  /** Frames standing about (cycled now and then), on the move, bolting. */
  idle: number[];
  move: number[];
  flee: number;
  /** Instead of bolting, it curls up in place for a moment (this frame). */
  curl?: number;
  /** Its feet in cover (hidden) and out on the open ground. */
  home: Pt;
  out: Pt;
  /** Its comings and goings repeat every `period` s (a seed shifts it). */
  period: number;
  seed: number;
  /** How it moves: hops (rabbits, squirrels), a walk, a single leap (the frog). */
  gait: 'hop' | 'walk' | 'leap';
  moveSec: number;
}

export class Burrow {
  private scaredAt = -1e9;
  private fleeFrom: Pt = [0, 0];
  private fleeFlip = false;
  private resumeAt = -1e9;
  /** ms its clock has been held back by curling up. */
  private lag = 0;

  constructor(readonly spec: BurrowSpec) {}

  private key(f: number): string {
    return `life_${this.spec.sprite}_${f}`;
  }

  /** Where it is now (null: in its cover). */
  pose(now: number): Pose | null {
    const c = this.spec;
    const since = now - this.scaredAt;
    if (c.curl !== undefined && since < CURL_MS) {
      // curled up where it was tapped; a shiver as it uncurls
      const shake = since > CURL_MS - 400 && Math.floor(since / 70) % 2 ? 1 : 0;
      return { x: this.fleeFrom[0] + shake, y: this.fleeFrom[1], key: this.key(c.curl), flip: this.fleeFlip, alpha: 1 };
    }
    if (c.curl === undefined) {
      if (since < FLEE_MS) {
        const k = since / FLEE_MS;
        const [fx, fy] = this.fleeFrom;
        const x = fx + (c.home[0] - fx) * ease(k);
        const y = fy + (c.home[1] - fy) * ease(k) - Math.sin(k * Math.PI) * (c.gait === 'walk' ? 1 : 3);
        return { x, y, key: this.key(c.flee), flip: c.home[0] < fx, alpha: 1 - clamp01((k - 0.7) / 0.3) };
      }
      if (now < this.resumeAt) return null;
    }
    const cycleMs = c.curl !== undefined && since < CURL_MS ? this.scaredAt - (this.lag - CURL_MS) : now - this.lag;
    return this.cyclePose(cycleMs / 1000, now);
  }

  private cyclePose(t: number, now: number): Pose | null {
    const c = this.spec;
    const P = c.period;
    const u = mod(t + c.seed * P, P);
    const m = c.moveSec;
    const tOut = 0.3 * P;
    const tBack = 0.85 * P - m;
    if (u < tOut || u >= tBack + m) return null;
    const [hx, hy] = c.home;
    const [ox, oy] = c.out;
    const outward = ox < hx;
    if (u < tOut + m || u >= tBack) {
      const going = u < tOut + m;
      const k = going ? (u - tOut) / m : (u - tBack) / m;
      const [ax, ay, bx, by] = going ? [hx, hy, ox, oy] : [ox, oy, hx, hy];
      let x = ax + (bx - ax) * k;
      let y = ay + (by - ay) * k;
      let f = c.move[Math.floor((t * 1000) / 150) % c.move.length];
      if (c.gait !== 'walk') {
        // hops (or one leap): up and down along the way, sitting between hops
        const hops = c.gait === 'leap' ? 1 : Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 3));
        const q = (k * hops) % 1;
        y -= Math.sin(q * Math.PI) * (c.gait === 'leap' ? 4 : 2);
        f = q > 0.15 && q < 0.85 ? c.move[0] : c.idle[0];
        x = Math.round(x);
      }
      // it slips out of (and back into) its cover
      const alpha = clamp01((going ? k : 1 - k) / 0.3);
      return { x, y, key: this.key(f), flip: going ? outward : !outward, alpha };
    }
    // out: idling, now and then turning round or switching what it does
    const slot = Math.floor((now + c.seed * 7919) / 700);
    const f = c.idle.length > 1 && rnd(slot, 3, Math.floor(c.seed * 1e6)) < 0.45 ? c.idle[1 + (slot % (c.idle.length - 1))] : c.idle[0];
    const turn = rnd(Math.floor(slot / 4), 5, Math.floor(c.seed * 1e6)) < 0.3;
    return { x: ox, y: oy, key: this.key(f), flip: turn ? !outward : outward, alpha: 1 };
  }

  /** Startle it if the tap lands on it (it has to be out). True: the tap was its. */
  tap(L: LifeLayers, x: number, y: number, now: number, hideMs: number): boolean {
    const p = this.pose(now);
    if (!p || p.alpha < 0.5 || now - this.scaredAt < (this.spec.curl !== undefined ? CURL_MS : FLEE_MS)) return false;
    const b = poseBox(L, p);
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false;
    this.scaredAt = now;
    this.fleeFrom = [p.x, p.y];
    this.fleeFlip = p.flip;
    if (this.spec.curl !== undefined) this.lag += CURL_MS;
    else {
      // back out once a whole cycle starts after it's had time to calm down
      const P = this.spec.period;
      const tc = (now + hideMs - this.lag) / 1000 + this.spec.seed * P;
      this.resumeAt = (Math.ceil(tc / P) * P - this.spec.seed * P) * 1000 + this.lag;
    }
    return true;
  }

  /** When it was last startled (the views add a splash or a rustle where it went). */
  get startledAt(): number {
    return this.scaredAt;
  }
}

// ------------------------------------------------------------------ a flock on the ground (or the water)

const FLY_S = 2.4;
const LAND_S = 1.8;

export interface FlockSpec {
  sprite: string;
  /** The flying frames (textures). */
  fly: readonly [string, string];
  center: Pt;
  n: number;
  rx: number;
  ry: number;
  seed: number;
  /** Floating on the water: they bob, and ripples spread under them. */
  water?: boolean;
}

/** A few birds pecking about (or floating). Tapped, they scatter and fly off, and come back a while later. */
export class Flock {
  private scaredAt = -1e9;
  private dir = 1;
  readonly offs: Pt[] = [];

  constructor(readonly spec: FlockSpec) {
    const s = Math.floor(spec.seed * 1e6);
    for (let i = 0; i < spec.n; i++) {
      let best: Pt = [0, 0];
      for (let k = 0; k < 24; k++) {
        const o: Pt = [Math.round((rnd(i, k, s) - 0.5) * 2 * spec.rx), Math.round((rnd(i, k + 99, s) - 0.5) * 2 * spec.ry)];
        best = o;
        if (this.offs.every(([x, y]) => Math.abs(x - o[0]) >= 5 || Math.abs(y - o[1]) >= 3)) break;
      }
      this.offs.push(best);
    }
    this.offs.sort((a, b) => a[1] - b[1]);
  }

  /** Every bird this frame (none while they're away). */
  poses(now: number, hideMs: number): Pose[] {
    const c = this.spec;
    const s = Math.floor(c.seed * 1e6);
    const t = (now - this.scaredAt) / 1000;
    const back = t - hideMs / 1000;
    const out: Pose[] = [];
    if (t < FLY_S || (back >= 0 && back < LAND_S)) {
      // flying off (and back again along the same line)
      for (let i = 0; i < c.n; i++) {
        const tt = t < FLY_S ? t : (1 - ease(back / LAND_S)) * FLY_S * 0.8;
        const vx = this.dir * (26 + 16 * rnd(i, 1, s));
        const vy = -(16 + 12 * rnd(i, 2, s));
        const [sx, sy] = this.at(i);
        const x = sx + vx * tt * (0.6 + 0.4 * tt);
        const y = sy - 3 + vy * tt + Math.sin(tt * 9 + i) * 1.2;
        const landing = t >= FLY_S && back > LAND_S - 0.25;
        const fade = t < FLY_S ? 1 - clamp01((t - FLY_S + 0.7) / 0.7) : clamp01(back / 0.5);
        const flapKey = c.fly[Math.floor(now / 70 + i) % 2];
        out.push({ x, y: landing ? sy : y + 2, key: landing ? `life_${c.sprite}_0` : flapKey, flip: t < FLY_S ? this.dir < 0 : this.dir > 0, alpha: fade });
      }
      return out;
    }
    if (back < 0) return out;
    for (let i = 0; i < c.n; i++) {
      const [x, y] = this.at(i);
      const slot = Math.floor((now + i * 211) / (300 + i * 37));
      const peck = rnd(i, slot, s) < (c.water ? 0.15 : 0.4);
      const slot2 = Math.floor((now + i * 503) / 2600);
      const hop = c.water ? 0 : rnd(i, slot2, s + 7) < 0.25 ? (rnd(i, slot2, s + 8) < 0.5 ? -1 : 1) : 0;
      const bob = c.water ? Math.round(Math.sin(now / 650 + i * 2.1) * 0.6) : 0;
      out.push({ x: x + hop, y: y + bob, key: `life_${c.sprite}_${peck ? 1 : 0}`, flip: rnd(i, slot2, s + 9) < 0.5, alpha: 1 });
    }
    return out;
  }

  private at(i: number): Pt {
    const [cx, cy] = this.spec.center;
    return [cx + this.offs[i][0], cy + this.offs[i][1]];
  }

  /** Whether they're all on the ground (or the water), and so can be startled. */
  landed(now: number, hideMs: number): boolean {
    return (now - this.scaredAt) / 1000 >= hideMs / 1000 + LAND_S;
  }

  /** The ground they peck about on (their tap box). */
  box(): Rect {
    const c = this.spec;
    const w = Math.max(16, c.rx * 2 + 10);
    const h = Math.max(12, c.ry * 2 + 9);
    return { x: Math.round(c.center[0] - w / 2), y: Math.round(c.center[1] - 2 - h / 2), w, h };
  }

  /** Scatter them if the tap lands on the flock (they fly off away from it). True: the tap was theirs. */
  tap(x: number, y: number, now: number, hideMs: number): boolean {
    const b = this.box();
    if (!this.landed(now, hideMs) || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false;
    this.scaredAt = now;
    this.dir = x <= this.spec.center[0] ? 1 : -1;
    return true;
  }
}

// ------------------------------------------------------------------ the sparkle

/** A four-point star: a white core, arms `r` px long (on the diagonals if `diag`). */
function star(g: G, x: number, y: number, r: number, diag: boolean, alpha: number): void {
  if (alpha <= 0.02 || r <= 0) return;
  for (let i = 1; i <= r; i++) {
    g.fillStyle(i === r && r > 1 ? 0xf2c230 : 0xfff0a0, alpha * (i === r && r > 1 ? 0.8 : 1));
    if (diag)
      for (const [dx, dy] of [
        [-i, -i],
        [i, -i],
        [-i, i],
        [i, i],
      ])
        g.fillRect(x + dx, y + dy, 1, 1);
    else {
      g.fillRect(x - i, y, 1, 1);
      g.fillRect(x + i, y, 1, 1);
      g.fillRect(x, y - i, 1, 1);
      g.fillRect(x, y + i, 1, 1);
    }
  }
  g.fillStyle(WHITE, alpha);
  g.fillRect(x, y, 1, 1);
}

/** How long a twinkle takes, and how often one comes. */
const TWINKLE_MS = 560;
const TWINKLE_EVERY = 1900;

/**
 * The sparkle at (x, y), `age` ms after it appeared: a small warm glint that never quite goes out (a coin in the grass,
 * something bobbing on the waves) and, every couple of seconds, a twinkle; a bigger one as it first appears.
 */
export function drawSparkle(g: G, x: number, y: number, age: number, now: number, water = false): void {
  x = Math.round(x);
  y = Math.round(y + (water ? Math.round(Math.sin(now / 520)) : 0));
  const a = clamp01(age / 400);
  // a faint warm halo, and the glint itself
  g.fillStyle(0xfff0a0, 0.14 * a);
  g.fillRect(x - 2, y - 1, 5, 3);
  g.fillRect(x - 1, y - 2, 3, 5);
  g.fillStyle(0xd8901c, 0.9 * a);
  g.fillRect(x - 1, y + 1, 3, 1);
  g.fillStyle(0xf2c230, a);
  g.fillRect(x - 1, y, 2, 1);
  g.fillStyle(0xfff0a0, a);
  g.fillRect(x + 1, y, 1, 1);
  if (water) {
    g.fillStyle(0xd4eeec, 0.5 * a);
    g.fillRect(x - 3, y + 2, 2, 1);
    g.fillRect(x + 2, y + 2, 2, 1);
  }
  // the twinkle: grows, holds, shrinks (the first one, as it appears, bigger)
  const first = age < TWINKLE_MS + 200;
  const k = first ? age / (TWINKLE_MS + 200) : ((now % TWINKLE_EVERY) - (TWINKLE_EVERY - TWINKLE_MS)) / TWINKLE_MS;
  if (k < 0 || k >= 1) return;
  const r = Math.round(Math.sin(k * Math.PI) * (first ? 4 : 3));
  star(g, x, y - 1, r, false, 1);
  if (r >= 2) star(g, x, y - 1, r - 1, true, 0.5);
}

/** A sparkle's tap box (thumb-sized at 8x). */
export const sparkleBox = (x: number, y: number): Rect => ({ x: Math.round(x) - 8, y: Math.round(y) - 9, w: 16, h: 15 });

/** A sparkle picked up: where, when (ms) and what it paid. */
export interface Pop {
  x: number;
  y: number;
  at: number;
  coins: number;
}

export const POP_MS = 1000;

/** The pop: a flash ring and gold shards burst out, the coin hops up with a tiny "+1", and fades. */
export function drawPop(L: LifeLayers, p: Pop, now: number): void {
  const t = now - p.at;
  if (t < 0 || t >= POP_MS) return;
  const g = L.pop;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  // the flash: a white core and a ring spreading out
  if (t < 260) {
    const k = t / 260;
    const r = 2 + k * 8;
    g.fillStyle(WHITE, 1 - k);
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 1 + Math.sin(a) * r * 0.8), 1, 1);
    }
    if (t < 90) star(g, x, y - 1, 3, false, 1);
  }
  // shards: chunky gold bits flying out and falling
  if (t < 560) {
    const k = t / 560;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * (0.1 + (0.8 * i) / 6);
      const v = 9 + (i % 3) * 3;
      const sx = Math.round(x + Math.cos(a) * v * ease(k));
      const sy = Math.round(y - 1 + Math.sin(a) * v * ease(k) + k * k * 8);
      g.fillStyle(i % 2 ? 0xfff0a0 : 0xf2c230, 1 - k);
      g.fillRect(sx, sy, i % 3 === 0 ? 2 : 1, 1);
    }
  }
  // the coin hops up, with what it paid beside it
  const k = clamp01(t / 420);
  const fade = 1 - clamp01((t - 700) / 300);
  const [cw, ch] = iconSize('coin');
  const cy = Math.round(y - 4 - ch - ease(k) * 7);
  hudIcon(g, 'coin', x - Math.round(cw / 2) - 4, cy, 1, fade);
  L.text(`+${p.coins}`, x - Math.round(cw / 2) - 4 + cw + 1, cy + ch / 2 + 0.5, 0xffe680, { bold: true, oy: 0.5, alpha: fade });
}
