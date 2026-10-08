// The eight style kits of the finisher show (core/finisher-show.ts STYLE_SHOW says how each style moves): what every
// hero of a style shares. Each kit has its own sky (behind the actors), its own flurry strike, its own layer of the
// last blow, and the marks those leave; the eye tells the styles apart with the sound off, not just by colour:
//   Blade      crescent slashes, steel glints, a straight cut through the foe that lingers and splits it; a cold steel
//              sky racing with speed lines, cut by every strike
//   Shadow     violet afterimages of the hero blinking round the foe, X cuts, ink smoke, rifts tearing open behind
//              it, jaws of shadow snapping shut; a moonlit violet night
//   Guardian   shields flung edge-on into the foe, a bright shield arc where each lands, a steel dome of a shockwave,
//              the tower emblem; a royal sky fanned with golden rays
//   Marksman   reticles that close on every target and lock gold, arrows streaking in and sticking, one great arrow
//              piercing through; a dusk sky, its first stars, the sun on the horizon
//   Brute      blows that crack the ground, rock debris and dust, rock spikes bursting up under the foe; a dust storm
//              with rocks shaken loose floating up
//   Controller ice spikes stabbing up, frost shards, cold mist along the ground, the foe locked in an ice crystal that
//              shatters; an aurora night with falling snow
//   Summoner   spirit wisps arcing in and bursting into leaves, a vine lash, vines coiling up the foe; a deep grove with
//              light shafts and drifting leaves
//   Bomber     bombs lobbed in arcs that blow on the foe, shrapnel and smoke, a fireball that rolls into a smoke
//              column; a smoky sky over a burning horizon
import type { StyleId } from '../../data/heroes';
import { GAME_W } from '../layout';
import { clamp01, ease, INK, rand, WHITE, type EnemyView } from './shared';
import {
  bands,
  chest,
  crescent,
  ellipseLine,
  hash,
  hitFoe,
  inkLine,
  inkPoly,
  line,
  mark,
  msUntil,
  poly,
  topOf,
  toward,
  twinkle,
  type G,
  type Mark,
  type MarkDraw,
  type Pal,
  type ShowCtx,
} from './finisher-fx';

export interface StyleKit {
  pal: Pal;
  /** The tint of the hero's afterimages while they move through the show. */
  ghost: number;
  /** The last blow's screen flash. */
  flash: number;
  /** The sky (behind the actors): `a` is how far it has taken over (the show's fade x the rarity's sky). */
  sky(g: G, c: ShowCtx, k: number, a: number, now: number): void;
  /** At the show's start. */
  start?(c: ShowCtx): void;
  /** One strike of the flurry on a target (i of `of`). */
  strike(c: ShowCtx, v: EnemyView, i: number, of: number): void;
  /** The kit's layer of the last blow, on each target. */
  blow(c: ShowCtx, v: EnemyView): void;
  /** Once at the last blow (not per target). */
  blowOnce?(c: ShowCtx): void;
  /** Every frame, over the actors. */
  front?(g: G, c: ShowCtx, k: number, now: number): void;
}

/** Where the hero's hands are now (what they throw, shoot or cast from). */
function hand(c: ShowCtx, dy = 18): { x: number; y: number } {
  const h = c.heroAt();
  return { x: h.x + 9, y: c.s.ground - dy - h.lift };
}

/** A projectile's flight (ms): `base`, but always landing before the last blow. */
const flight = (c: ShowCtx, base: number): number => Math.max(36, Math.min(base, msUntil(c, c.tl.blow) * 0.8));

/** The sky's floor (the ground strip under the actors stays calm). */
const skyFloor = (c: ShowCtx): number => c.s.ground - 8;

// ================================================================== Blade

const BLADE: StyleKit = {
  pal: { deep: 0x141a2e, dark: 0x2a2f45, base: 0x7c86a6, light: 0xb8c2d8, hot: 0xeef3fa, accent: 0x9ad8ff },
  ghost: 0xbfe8ff,
  flash: WHITE,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    // a pale steel dawn, brightest at the horizon (the foes stand dark against it)
    bands(g, [0x283250, 0x3a4668, 0x525e84, 0x6e7aa0, 0x8e9abc, 0xb0bad4], 0, bottom, a);
    // speed lines racing left, more and faster with the stacks
    const n = c.n;
    const lines = 12 + n * 4;
    for (let i = 0; i < lines; i++) {
      const y = 4 + ((i * 37) % Math.max(1, bottom - 8));
      const len = 16 + ((i * 53) % 40) + n * 4;
      const speed = 0.5 + (i % 3) * 0.25 + n * 0.08;
      const x = ((((i * 97 - now * speed) % (GAME_W + 80)) + GAME_W + 80) % (GAME_W + 80)) - 40;
      g.fillStyle(i % 3 === 0 ? 0x2a2f45 : WHITE, a * (i % 3 === 0 ? 0.5 : i % 2 ? 0.75 : 0.45));
      g.fillRect(Math.round(x), y, len, i % 4 === 0 ? 2 : 1);
    }
    // a cold glint of sun up left, a streak through it
    const gx = 34;
    const gy = 16;
    g.fillStyle(0xb8c2d8, 0.25 * a);
    g.fillCircle(gx, gy, 9);
    twinkle(g, gx, gy, 6, 0xeef3fa, a);
    line(g, gx - 20, gy + 8, gx + 20, gy - 8, 1, WHITE, 0.35 * a);
  },
  strike(c, v, i) {
    const fx = c.s.fx;
    const cy = chest(v) + rand(-6, 4);
    hitFoe(c, v, 4);
    fx.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: c.s.anim, big: i % 2 === 1, dir: i % 2 ? 1 : -1, color: 0xb8c2d8, rim: 0x2a2f45, core: 0xeef3fa });
    fx.sparks.push({ x: v.x + rand(-8, 6), y: cy + rand(-6, 4), at: c.s.anim, size: 7, color: 0xeef3fa });
    mark(c, 'cut', { x: v.x + rand(-3, 3), y: cy, r: (i % 2 ? 1 : -1) * (0.35 + 0.25 * hash(i, c.at)), life: 170 });
    mark(c, 'skycut', { x: 60 + hash(i, 5) * (GAME_W - 120), y: 20 + hash(i, 9) * 40, dir: i % 2 ? 1 : -1, life: 170, sky: true });
    if (c.scale.layers >= 3) fx.chips(v.x, cy, 8, [WHITE, 0xb8c2d8, 0x7c86a6], 6, 0);
  },
  blow(c, v) {
    const fx = c.s.fx;
    const cy = chest(v);
    fx.slashes.push({ x: v.x, y: cy, at: c.s.anim, big: true, dir: 1, color: 0xb8c2d8, rim: 0x2a2f45, core: 0xeef3fa });
    fx.slashes.push({ x: v.x, y: cy - 2, at: c.s.anim, big: true, dir: -1, color: 0x9ad8ff, rim: 0x1a3c8a, core: 0xeef3fa });
    mark(c, 'bigcut', { x: v.x, y: cy, r: -0.18, life: 460 });
    fx.chips(v.x, cy, v.img.displayWidth * 0.6, [WHITE, 0xeef3fa, 0xb8c2d8, 0x7c86a6], 16, 0);
  },
};

const BLADE_MARKS: Record<string, MarkDraw> = {
  // a straight cut through the foe: it opens from the middle, lingers, fades
  cut(g, m, k) {
    const len = 18 * clamp01(k * 4);
    const dx = Math.cos(m.r) * len;
    const dy = Math.sin(m.r) * len;
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    line(g, m.x - dx, m.y - dy, m.x + dx, m.y + dy, 3, 0x7c86a6, a * 0.8);
    line(g, m.x - dx, m.y - dy, m.x + dx, m.y + dy, 1, WHITE, a);
  },
  // the sky itself is cut by every strike
  skycut(g, m, k) {
    const a = (1 - k) * 0.8;
    const dy = 34 * m.dir;
    line(g, m.x - 70, m.y - dy, m.x + 70, m.y + dy, 2, 0xb8c2d8, a * 0.6);
    line(g, m.x - 70, m.y - dy, m.x + 70, m.y + dy, 1, WHITE, a);
  },
  // the last cut: a long line through the foe that holds, then splits apart
  bigcut(g, m, k) {
    const len = 36 * clamp01(k * 6);
    const ux = Math.cos(m.r);
    const uy = Math.sin(m.r);
    const open = k > 0.4 ? (k - 0.4) * 10 : 0;
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    for (const side of open > 0 ? [-1, 1] : [0]) {
      const ox = -uy * open * side;
      const oy = ux * open * side;
      const x0 = m.x - ux * len + ox;
      const y0 = m.y - uy * len + oy;
      const x1 = m.x + ux * len + ox;
      const y1 = m.y + uy * len + oy;
      inkLine(g, x0, y0, x1, y1, 3, 0xb8c2d8, a);
      line(g, x0, y0, x1, y1, 1, WHITE, a);
    }
  },
};

// ================================================================== Shadow

const SHADOW: StyleKit = {
  pal: { deep: 0x07040e, dark: 0x2a1440, base: 0x7a3cb0, light: 0xa86ae0, hot: 0xdab0ff, accent: 0x3ac0b0 },
  ghost: 0xa86ae0,
  flash: 0xc8a0f0,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x06030c, 0x0c0618, 0x140a26, 0x1e1036, 0x2a1646, 0x361c56], 0, bottom, a);
    // the moon: pale violet, its craters, a soft halo
    const mx = GAME_W - 34;
    const my = 60;
    g.fillStyle(0xa86ae0, 0.12 * a);
    g.fillCircle(mx, my, 22);
    g.fillStyle(0xa86ae0, 0.18 * a);
    g.fillCircle(mx, my, 17);
    g.fillStyle(INK, a);
    g.fillCircle(mx, my, 14);
    g.fillStyle(0xe8d8ff, a);
    g.fillCircle(mx, my, 13);
    g.fillStyle(0xc8b0f0, a);
    g.fillCircle(mx + 4, my + 3, 9);
    g.fillStyle(0xe8d8ff, a);
    g.fillCircle(mx + 2, my + 1, 8);
    g.fillStyle(0xb898e0, a);
    g.fillCircle(mx - 5, my - 3, 2);
    g.fillCircle(mx + 3, my + 6, 3);
    g.fillCircle(mx + 6, my - 5, 1);
    // violet mist drifting low, motes rising
    for (let i = 0; i < 7; i++) {
      const w = 40 + (i % 3) * 20;
      const x = ((((i * 61 - now * (0.02 + (i % 2) * 0.015)) % (GAME_W + w)) + GAME_W + w) % (GAME_W + w)) - w;
      const y = bottom - 30 + (i % 4) * 7;
      g.fillStyle(0x7a3cb0, 0.13 * a);
      g.fillRect(Math.round(x), y, w, 4);
      g.fillRect(Math.round(x) + 6, y - 2, w - 12, 2);
    }
    for (let i = 0; i < 10 + c.n * 2; i++) {
      const life = 2400;
      const q = ((now + hash(i, 3) * life) % life) / life;
      const x = Math.round(hash(i, 7) * GAME_W + Math.sin(q * 6 + i) * 4);
      const y = Math.round(bottom - q * (bottom - 6));
      g.fillStyle(i % 3 ? 0xa86ae0 : 0xdab0ff, a * (1 - q) * 0.9);
      g.fillRect(x, y, 1, 2);
    }
  },
  strike(c, v, i) {
    const fx = c.s.fx;
    const cy = chest(v) + rand(-5, 4);
    hitFoe(c, v, 4);
    // she blinks in beside it: an afterimage on the near side, the far side or above
    const side = i % 3;
    const ax = side === 0 ? v.x - 16 : side === 1 ? v.x + 16 : v.x - 4;
    const ay = side === 2 ? topOf(v) - 2 : c.s.ground;
    mark(c, 'after', { x: ax, y: ay, dir: side === 1 ? -1 : 1, life: 180, tex: c.heroTex(i % 2 ? 'slashA' : 'slashB') });
    mark(c, 'xcut', { x: v.x + rand(-3, 3), y: cy, life: 150, r: 9 + (i % 2) * 2 });
    mark(c, 'rift', { x: v.x + (i % 2 ? 10 : -10), y: cy - 2, r: 20, life: 230, sky: true });
    fx.puffs.push({ x: v.x + rand(-6, 6), y: cy + rand(-4, 6), r: rand(3, 5), at: c.s.anim, life: 320, color: i % 2 ? 0x2a1440 : 0x3a2050 });
    fx.sparks.push({ x: v.x + rand(-6, 6), y: cy, at: c.s.anim, size: 6, color: 0xdab0ff });
    if (c.scale.layers >= 3) fx.chips(v.x, cy, 8, [0xdab0ff, 0x7a3cb0, INK], 6, 0);
  },
  blow(c, v) {
    const fx = c.s.fx;
    const cy = chest(v);
    mark(c, 'rift', { x: v.x + 2, y: cy - 4, r: v.img.displayHeight + 30, life: 560, sky: true, seed: 3 });
    mark(c, 'jaws', { x: v.x, y: cy, r: Math.max(16, v.img.displayWidth * 0.6), life: 300 });
    for (let i = 0; i < 6; i++) fx.puffs.push({ x: v.x + rand(-12, 12), y: cy + rand(-10, 10), r: rand(4, 8), at: c.s.anim + i * 25, life: 480, color: i % 2 ? 0x1a0e2e : 0x3a2050 });
    fx.chips(v.x, cy, v.img.displayWidth * 0.6, [0xdab0ff, 0xa86ae0, 0x7a3cb0, INK], 16, 0);
  },
};

/** A rift's jagged slit: a zigzag spine from top to bottom, `w` wide at its widest. */
function riftPts(x: number, y: number, h: number, w: number, seed: number): Array<[number, number]> {
  const n = Math.max(4, Math.round(h / 5));
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    const yy = y - h / 2 + q * h;
    const zig = (hash(i, seed) - 0.5) * 4;
    const half = w * Math.sin(Math.PI * q) * (0.6 + 0.4 * hash(i + 9, seed));
    left.push([x + zig - half, yy]);
    right.push([x + zig + half, yy]);
  }
  return [...left, ...right.reverse()];
}

const SHADOW_MARKS: Record<string, MarkDraw> = {
  xcut(g, m, k) {
    const r = m.r * clamp01(k * 5);
    const a = 1 - k;
    for (const d of [1, -1]) {
      line(g, m.x - r, m.y - r * d * 0.8, m.x + r, m.y + r * d * 0.8, 3, 0x7a3cb0, a);
      line(g, m.x - r, m.y - r * d * 0.8, m.x + r, m.y + r * d * 0.8, 1, 0xf0e0ff, a);
    }
  },
  // a tear in the air: it opens, glows violet round a black heart, and closes
  rift(g, m, k) {
    const open = k < 0.3 ? ease(k / 0.3) : k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    if (open <= 0.02) return;
    const w = (m.r > 30 ? 7 : 3.5) * open;
    poly(g, riftPts(m.x, m.y, m.r, w + 4, m.seed), 0x7a3cb0, 0.35 * open);
    poly(g, riftPts(m.x, m.y, m.r, w + 1.5, m.seed), 0xdab0ff, 0.9 * open);
    poly(g, riftPts(m.x, m.y, m.r, w, m.seed), 0x07040e, open);
  },
  // jaws of shadow: an upper and a lower fang closing on the foe
  jaws(g, m, k) {
    const close = ease(clamp01(k / 0.35));
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    const gap = (1 - close) * 16;
    const cols = { body: 0x7a3cb0, light: 0xa86ae0, rim: 0x07040e };
    crescent(g, m.x, m.y - gap + m.r * 0.55, m.r, 8, Math.PI * 1.1, Math.PI * 0.8, 0.55, cols, a);
    crescent(g, m.x, m.y + gap - m.r * 0.55, m.r, 8, Math.PI * 0.1, Math.PI * 0.8, 0.55, cols, a);
  },
};

// ================================================================== Guardian

const GUARDIAN: StyleKit = {
  pal: { deep: 0x10204a, dark: 0x1a3c8a, base: 0x3a6ad8, light: 0xb8d8ff, hot: 0xeef3fa, accent: 0xf2c230 },
  ghost: 0x9ad8ff,
  flash: 0xfff0c0,
  sky(g, c, k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x0a1430, 0x101e44, 0x16295a, 0x1c3672, 0x24458a, 0x2e56a4], 0, bottom, a);
    // golden rays fanning from behind the hero, turning slowly; brighter on each strike
    const h = c.heroAt();
    const cx = h.x - 4;
    const cy = c.s.ground - 26;
    const rays = 12;
    const flare = c.tl.strikes.some((t) => k >= t && k < t + 0.04) ? 1.6 : 1;
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + now / 2600;
      const w = 0.09;
      const R = 260;
      poly(
        g,
        [
          [cx, cy],
          [cx + Math.cos(ang - w) * R, cy + Math.sin(ang - w) * R],
          [cx + Math.cos(ang + w) * R, cy + Math.sin(ang + w) * R],
        ],
        i % 2 ? 0xf2c230 : 0xfff0a0,
        a * (i % 2 ? 0.22 : 0.16) * flare,
      );
    }
    g.fillStyle(0xfff0a0, 0.18 * a);
    g.fillCircle(cx, cy, 22);
    g.fillStyle(0xfff0a0, 0.3 * a);
    g.fillCircle(cx, cy, 12);
  },
  strike(c, v, i) {
    const s = c.s;
    const fx = s.fx;
    const from = hand(c, 20);
    const ty = chest(v) + rand(-4, 4);
    const tx = v.x - v.img.displayWidth * 0.3;
    const ms = flight(c, 90);
    mark(c, 'shieldFly', { x: from.x, y: from.y, x1: tx, y1: ty, life: ms, seed: i });
    s.later(ms, () => {
      hitFoe(c, v, 5);
      fx.sparks.push({ x: tx, y: ty, at: s.anim, size: 9, color: 0xeef3fa });
      mark(c, 'arc', { x: tx - 2, y: ty, r: 12 + (i % 2) * 2, life: 170 });
      fx.shock(v.x, s.ground, 22, 0xb8d8ff);
      fx.chips(tx, ty, 6, [WHITE, 0xb8c2d8, 0x3a6ad8], 6, 0);
      if (c.scale.layers >= 3) fx.ring(tx, ty, 10, 0xf2c230, true);
    });
  },
  blow(c, v) {
    const s = c.s;
    mark(c, 'dome', { x: v.x, y: v.y, r: Math.max(34, v.img.displayWidth + 14), life: 380 });
    mark(c, 'emblem', { x: v.x, y: chest(v), life: 320 });
    s.fx.shock(v.x, s.ground, 44, 0xeef3fa);
    s.later(80, () => s.fx.shock(v.x, s.ground, 60, 0xf2c230));
    s.fx.chips(v.x, chest(v), v.img.displayWidth * 0.6, [WHITE, 0xb8c2d8, 0xf2c230], 14, 0);
  },
};

/** A heater shield (blue, a white tower on it, a steel rim) centred on (x, y), `w` wide (edge-on when narrow). */
export function heaterShield(g: G, x: number, y: number, w: number, h: number, a = 1): void {
  const hw = Math.max(1, w / 2);
  const hh = h / 2;
  const pts: Array<[number, number]> = [
    [x - hw, y - hh],
    [x + hw, y - hh],
    [x + hw, y + hh * 0.25],
    [x, y + hh],
    [x - hw, y + hh * 0.25],
  ];
  inkPoly(g, pts, 0xb8c2d8, a);
  if (hw < 2.5) return;
  poly(
    g,
    pts.map(([px, py]): [number, number] => [x + (px - x) * 0.72, y + (py - y) * 0.75]),
    0x2a5ac0,
    a,
  );
  // the tower
  const tw = Math.max(1, Math.round(hw * 0.5));
  g.fillStyle(WHITE, a);
  g.fillRect(Math.round(x - tw / 2), Math.round(y - hh * 0.35), tw, Math.round(hh * 0.8));
  if (tw >= 3) {
    g.fillRect(Math.round(x - tw / 2) - 1, Math.round(y - hh * 0.45), 1, 2);
    g.fillRect(Math.round(x + tw / 2), Math.round(y - hh * 0.45), 1, 2);
  }
  g.fillStyle(0xeef3fa, a);
  g.fillRect(Math.round(x - hw) + 1, Math.round(y - hh) + 1, Math.max(1, Math.round(hw)), 1);
}

const GUARDIAN_MARKS: Record<string, MarkDraw> = {
  // a shield flung at the foe, spinning edge-on and back
  shieldFly(g, m, k) {
    if (k >= 1) return;
    const x = m.x + (m.x1 - m.x) * k;
    const y = m.y + (m.y1 - m.y) * k - Math.sin(k * Math.PI) * 6;
    const spin = Math.abs(Math.cos(k * Math.PI * 2.5 + m.seed));
    line(g, m.x + (m.x1 - m.x) * Math.max(0, k - 0.35), m.y + (m.y1 - m.y) * Math.max(0, k - 0.35), x, y, 1, 0xb8d8ff, 0.6);
    heaterShield(g, x, y, 3 + 7 * spin, 11);
  },
  // a bright shield arc on the foe's near side
  arc(g, m, k) {
    const a = 1 - k;
    const r = m.r * (0.7 + 0.3 * ease(k));
    for (let j = 0; j < 12; j++) {
      const ang = Math.PI * (0.62 + (0.76 * j) / 11);
      const x = Math.round(m.x + Math.cos(ang) * r * 0.55);
      const y = Math.round(m.y + Math.sin(ang) * r);
      g.fillStyle(INK, a);
      g.fillRect(x - 2, y - 1, 4, 3);
    }
    for (let j = 0; j < 12; j++) {
      const ang = Math.PI * (0.62 + (0.76 * j) / 11);
      g.fillStyle(j > 3 && j < 8 ? WHITE : 0xb8d8ff, a);
      g.fillRect(Math.round(m.x + Math.cos(ang) * r * 0.55) - 1, Math.round(m.y + Math.sin(ang) * r), 2, 1);
    }
  },
  // the steel shockwave: a dome rising from the foe's feet
  dome(g, m, k) {
    const e = ease(k);
    const rx = m.r * e;
    const ry = rx * 0.75;
    const a = 1 - k;
    const th = k < 0.4 ? 3 : k < 0.7 ? 2 : 1;
    g.lineStyle(th + 2, INK, a * 0.6);
    g.beginPath();
    g.arc(Math.round(m.x), Math.round(m.y), Math.round(rx), Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.lineStyle(th, 0xeef3fa, a);
    g.beginPath();
    g.arc(Math.round(m.x), Math.round(m.y), Math.round(rx), Math.PI, Math.PI * 2, false);
    g.strokePath();
    g.fillStyle(0x9ad8ff, 0.12 * a);
    g.fillEllipse(Math.round(m.x), Math.round(m.y), Math.round(rx * 2), Math.round(ry * 2));
  },
  // the tower emblem over the foe, swelling and fading
  emblem(g, m, k) {
    const sc = 1 + k * 1.4;
    heaterShield(g, m.x, m.y - 4 - k * 6, 12 * sc, 15 * sc, 1 - k);
  },
};

// ================================================================== Marksman

const MARKSMAN: StyleKit = {
  pal: { deep: 0x1a0e30, dark: 0x4a2470, base: 0xb07ae0, light: 0xf2c230, hot: 0xfff0a0, accent: 0x5a9a4a },
  ghost: 0xdab0ff,
  flash: 0xfff0c0,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x140a28, 0x221238, 0x3a1c52, 0x5e2a62, 0x8e3e68, 0xc0606a], 0, bottom, a);
    // the sun sinking on the horizon behind the hero
    const sx = Math.round(GAME_W * 0.24);
    g.fillStyle(0xf2a040, 0.35 * a);
    g.fillCircle(sx, bottom + 2, 20);
    g.fillStyle(0xffd070, 0.8 * a);
    g.fillCircle(sx, bottom + 2, 13);
    g.fillStyle(0xfff0a0, a);
    g.fillCircle(sx, bottom + 2, 8);
    g.fillStyle(0xc0606a, a);
    for (let i = 0; i < 3; i++) g.fillRect(sx - 16, bottom - 6 + i * 3, 32, 1);
    // the first stars, twinkling
    for (let i = 0; i < 16 + c.n * 2; i++) {
      const x = Math.round(hash(i, 11) * GAME_W);
      const y = Math.round(3 + hash(i, 12) * (bottom * 0.45));
      const tw = 0.5 + 0.5 * Math.sin(now / 160 + i * 1.7);
      if (i % 4 === 0) twinkle(g, x, y, 1, 0xfff0a0, a * tw);
      else {
        g.fillStyle(WHITE, a * (0.4 + 0.6 * tw));
        g.fillRect(x, y, 1, 1);
      }
    }
  },
  start(c) {
    // a reticle on every target, closing in through the build-up
    for (const v of c.views) mark(c, 'reticle', { x: v.x, y: chest(v), v, life: c.tl.ms * c.tl.blow + 300 });
  },
  strike(c, v) {
    const s = c.s;
    const from = hand(c, 19);
    const tx = v.x + rand(-6, 6);
    const ty = chest(v) + rand(-6, 6);
    const ms = flight(c, 70);
    mark(c, 'arrow', { x: from.x, y: from.y, x1: tx, y1: ty, life: ms });
    s.later(ms, () => {
      hitFoe(c, v, 3);
      s.fx.sparks.push({ x: tx, y: ty, at: s.anim, size: 7, color: 0xfff0a0 });
      mark(c, 'stuck', { x: tx - v.x, y: ty - chest(v), v, r: Math.atan2(ty - from.y, tx - from.x), life: Math.max(60, msUntil(c, c.tl.blow) + 40) });
      if (c.scale.layers >= 3) s.fx.chips(tx, ty, 4, [WHITE, 0xfff0a0, 0xb07ae0], 5, 0);
    });
  },
  blowOnce(c) {
    // one great arrow pierces through every target
    const from = hand(c, 19);
    const y = c.views.length ? c.views.reduce((sum, v) => sum + chest(v), 0) / c.views.length : from.y;
    mark(c, 'pierce', { x: from.x, y, x1: GAME_W + 40, y1: y, life: 260 });
  },
  blow(c, v) {
    const s = c.s;
    s.fx.stars.push({ x: v.x, y: chest(v), at: s.anim, r: 22, color: 0xf2c230 });
    s.fx.chips(v.x, chest(v), v.img.displayWidth * 0.5, [WHITE, 0xfff0a0, 0xf2c230, 0xb07ae0], 12, 0);
  },
};

/** An arrow pointing along `ang` with its head at (x, y), `len` long. */
function arrow(g: G, x: number, y: number, ang: number, len: number, col = 0xd8dce8, a = 1, head = 0xeef3fa): void {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const tx = x - ux * len;
  const ty = y - uy * len;
  line(g, tx, ty, x, y, 3, INK, a);
  line(g, tx, ty, x, y, 1, col, a);
  // the head and the white fletching
  g.fillStyle(head, a);
  g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  g.fillStyle(WHITE, a);
  g.fillRect(Math.round(tx - uy * 2), Math.round(ty + ux * 2), 1, 1);
  g.fillRect(Math.round(tx + uy * 2), Math.round(ty - ux * 2), 1, 1);
  g.fillRect(Math.round(tx - uy * 2 + ux), Math.round(ty + ux * 2 + uy), 1, 1);
  g.fillRect(Math.round(tx + uy * 2 + ux), Math.round(ty - ux * 2 + uy), 1, 1);
}

const MARKSMAN_MARKS: Record<string, MarkDraw> = {
  // closes from wide to tight through the build-up, ticks on each strike, locks gold at the last blow and bursts
  reticle(g, m, _k, c) {
    const v = m.v;
    if (!v) return;
    const sk = (c.s.anim - c.at) / c.tl.ms;
    const x = Math.round(v.x);
    const y = Math.round(chest(v));
    const close = ease(clamp01(sk / Math.max(0.05, c.tl.build)));
    const locked = sk >= c.tl.blow;
    const lk = locked ? (sk - c.tl.blow) / 0.2 : 0;
    const r = locked ? 9 + lk * 16 : 24 - close * 14 + (c.tl.strikes.some((t) => sk >= t && sk < t + 0.03) ? 2 : 0);
    const a = locked ? Math.max(0, 1 - lk) : Math.min(1, sk * 8);
    const col = locked ? 0xf2c230 : sk > c.tl.build ? 0xfff0a0 : 0xeef3fa;
    ellipseLine(g, x, y, r + 1, r + 1, 3, INK, a * 0.7);
    ellipseLine(g, x, y, r, r, 1, col, a);
    const spin = locked ? 0 : (1 - close) * 0.8;
    for (let q = 0; q < 4; q++) {
      const ang = (q * Math.PI) / 2 + spin;
      const x0 = x + Math.cos(ang) * (r - 3);
      const y0 = y + Math.sin(ang) * (r - 3);
      const x1 = x + Math.cos(ang) * (r + 4);
      const y1 = y + Math.sin(ang) * (r + 4);
      inkLine(g, x0, y0, x1, y1, 1, col, a);
    }
    g.fillStyle(col, a);
    g.fillRect(x, y, 1, 1);
  },
  arrow(g, m, k) {
    if (k >= 1) return;
    const x = m.x + (m.x1 - m.x) * k;
    const y = m.y + (m.y1 - m.y) * k;
    const ang = Math.atan2(m.y1 - m.y, m.x1 - m.x);
    line(g, m.x + (m.x1 - m.x) * Math.max(0, k - 0.5), m.y + (m.y1 - m.y) * Math.max(0, k - 0.5), x, y, 1, 0xf2c230, 0.55);
    arrow(g, x, y, ang, 8);
  },
  // an arrow sticking out of the foe until the last blow
  stuck(g, m, k) {
    const v = m.v;
    if (!v || v.dieAt) return;
    const x = v.x + m.x;
    const y = chest(v) + m.y;
    arrow(g, x + Math.cos(m.r) * 2, y + Math.sin(m.r) * 2, m.r, 6, 0xd8dce8, k > 0.85 ? (1 - k) / 0.15 : 1);
  },
  // the great arrow: gold, glowing, a long trail, through every target and off the stage
  pierce(g, m, k) {
    const x = m.x + (m.x1 - m.x) * ease(k);
    const y = m.y;
    const a = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    for (let j = 0; j < 5; j++) line(g, Math.max(m.x, x - 140 + j * 10), y, x - 6, y, 5 - j, j < 2 ? 0xb07ae0 : j < 4 ? 0xf2c230 : 0xfff0a0, a * (0.3 + j * 0.15));
    g.fillStyle(0xfff0a0, 0.3 * a);
    g.fillCircle(Math.round(x), Math.round(y), 7);
    inkPoly(
      g,
      [
        [x + 6, y],
        [x - 4, y - 5],
        [x - 2, y],
        [x - 4, y + 5],
      ],
      0xfff0a0,
      a,
    );
  },
};

// ================================================================== Brute

const BRUTE: StyleKit = {
  pal: { deep: 0x2a1810, dark: 0x4a2c18, base: 0x98663a, light: 0xe0bc84, hot: 0xffd890, accent: 0xff7a2a },
  ghost: 0xffd890,
  flash: 0xffe0b0,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x24140c, 0x361e12, 0x4c2a18, 0x643a20, 0x7e4c2a, 0x986236], 0, bottom, a);
    // dust bands blowing across
    for (let i = 0; i < 6; i++) {
      const y = 10 + i * ((bottom - 20) / 6);
      const w = 90 + (i % 3) * 40;
      const x = ((((i * 83 - now * (0.05 + (i % 3) * 0.02) * (1 + c.n * 0.2)) % (GAME_W + w)) + GAME_W + w) % (GAME_W + w)) - w;
      g.fillStyle(0xc0905a, 0.12 * a);
      g.fillRect(Math.round(x), Math.round(y), w, 5);
      g.fillStyle(0xe0bc84, 0.08 * a);
      g.fillRect(Math.round(x) + 10, Math.round(y) + 1, w - 20, 2);
    }
    // rocks shaken loose, floating up
    for (let i = 0; i < 9 + c.n * 2; i++) {
      const life = 3000;
      const q = ((now + hash(i, 21) * life) % life) / life;
      const x = Math.round(hash(i, 22) * GAME_W + Math.sin(now / 300 + i) * 2);
      const y = Math.round(bottom - q * (bottom * 0.8));
      const sz = 2 + (i % 2);
      const fade = (q < 0.15 ? q / 0.15 : q > 0.8 ? (1 - q) / 0.2 : 1) * 0.85;
      g.fillStyle(0x4a2c18, a * fade);
      g.fillRect(x, y, sz, sz - 1);
      g.fillRect(x + 1, y + sz - 1, Math.max(1, sz - 1), 1);
      g.fillStyle(0xc0905a, a * fade);
      g.fillRect(x, y, Math.max(1, sz - 1), 1);
    }
  },
  strike(c, v, i) {
    const s = c.s;
    const fx = s.fx;
    const cy = chest(v) + rand(-6, 2);
    hitFoe(c, v, 6, 50);
    fx.sparks.push({ x: v.x + rand(-4, 4), y: cy, at: s.anim, size: 9, color: 0xffd890 });
    mark(c, 'crack', { x: v.x + rand(-6, 6), y: s.ground, dir: i % 2 ? 1 : -1, r: 10 + (i % 3) * 5, seed: i * 13 + 1, life: c.tl.ms * (1 - (s.anim - c.at) / c.tl.ms) + 200, sky: true });
    fx.rubble(v.x, s.ground, 2, 0.8);
    if (i % 2 === 0) fx.dust(v.x, s.ground, 1, 0, 0.8);
    fx.kick(i % 2 ? 3 : -3, 70);
    if (c.scale.layers >= 3) fx.chips(v.x, cy, 8, [0xe0bc84, 0x98663a, 0x4a2c18], 6, 0);
  },
  blow(c, v) {
    const s = c.s;
    mark(c, 'pillars', { x: v.x, y: s.ground, r: Math.max(20, v.img.displayHeight * 0.7), seed: v.id, life: 680 });
    s.fx.rubble(v.x, s.ground, 14, 1.3);
    s.fx.dust(v.x, s.ground, 12, 0, 1.5);
    s.fx.shock(v.x, s.ground, 60, 0xffd890);
  },
};

/** A jagged rock spike from the ground at (x, y) up to height h: lit face left, shaded right, an ink rim. */
function rockSpike(g: G, x: number, y: number, w: number, h: number, seed: number, a = 1): void {
  if (h < 2) return;
  const lean = (hash(seed, 3) - 0.5) * w * 0.6;
  const tipX = x + lean;
  const pts: Array<[number, number]> = [
    [x - w / 2, y],
    [x - w / 2 + w * 0.15, y - h * 0.5],
    [tipX, y - h],
    [x + w / 2 - w * 0.1, y - h * 0.45],
    [x + w / 2, y],
  ];
  inkPoly(g, pts, 0x4a3c38, a);
  poly(
    g,
    [
      [x - w / 2 + 1, y],
      [x - w / 2 + w * 0.15 + 1, y - h * 0.5],
      [tipX, y - h + 1],
      [tipX, y],
    ],
    0x8a7a6a,
    a,
  );
  line(g, x - w / 2 + w * 0.15 + 1, y - h * 0.5, tipX, y - h + 1, 1, 0xc8b8a0, a);
  g.fillStyle(0xe0d0b8, a);
  g.fillRect(Math.round(tipX) - 1, Math.round(y - h) + 1, 2, 2);
}

const BRUTE_MARKS: Record<string, MarkDraw> = {
  // a crack running along the ground from the blow, with a branch; it stays until the show ends
  crack(g, m, k) {
    const grow = clamp01(k * 12);
    const a = k > 0.9 ? (1 - k) / 0.1 : 1;
    let x = m.x;
    let y = m.y;
    const len = m.r * grow;
    for (let d = 0; d < len; d += 2) {
      const nx = m.x + m.dir * (d + 2);
      const ny = m.y + Math.round((hash(d, m.seed) - 0.5) * 2);
      line(g, x, y, nx, ny, 1, 0x1a0e08, a);
      x = nx;
      y = ny;
      if (d === 6) line(g, x, y, x + m.dir * 3, y - 2, 1, 0x1a0e08, a);
    }
    if (k < 0.15) line(g, m.x, m.y, x, y, 1, 0xffd890, 1 - k / 0.15);
  },
  // rock spikes bursting up round the foe; they hold, then crumble back into the ground
  pillars(g, m, k) {
    const rise = ease(clamp01(k / 0.14));
    const sink = k > 0.7 ? (k - 0.7) / 0.3 : 0;
    const a = 1 - sink * 0.6;
    const spikes: Array<[number, number, number]> = [
      [-11, 0.65, 8],
      [11, 0.75, 8],
      [0, 1, 10],
    ];
    for (const [dx, hk, w] of spikes) rockSpike(g, m.x + dx, m.y + Math.round(sink * m.r * 0.6), w, m.r * hk * rise * (1 - sink * 0.4), m.seed + dx, a);
  },
};

// ================================================================== Controller

const CONTROLLER: StyleKit = {
  pal: { deep: 0x0e2a44, dark: 0x2a6a9a, base: 0x6ad0f0, light: 0xbff0ff, hot: WHITE, accent: 0x9af0c0 },
  ghost: 0xbff0ff,
  flash: 0xe0faff,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x060e16, 0x0a1620, 0x0e1e2c, 0x142a3a, 0x1a3648, 0x224456], 0, bottom, a);
    // the aurora: wavy ribbons, brightest at their top edge
    const ribbons: Array<[number, number, number]> = [
      [20, 0x6af0c0, 0],
      [32, 0x6ad0f0, 2.1],
      [44, 0xa880f0, 4.2],
    ];
    for (const [y0, col, ph] of ribbons) {
      for (let x = 0; x < GAME_W; x += 3) {
        const y = Math.round(y0 + 7 * Math.sin(x / 34 + now / 900 + ph) + 3 * Math.sin(x / 13 + now / 500));
        const h = 7 + Math.round(3 * Math.sin(x / 21 + ph));
        g.fillStyle(col, 0.1 * a);
        g.fillRect(x, y, 3, h);
        g.fillStyle(col, 0.22 * a);
        g.fillRect(x, y, 3, 2);
      }
    }
    // snow falling
    for (let i = 0; i < 20 + c.n * 4; i++) {
      const life = 2600 + (i % 5) * 300;
      const q = ((now + hash(i, 31) * life) % life) / life;
      const x = Math.round(hash(i, 32) * GAME_W + Math.sin(q * 9 + i) * 5);
      const y = Math.round(q * bottom);
      g.fillStyle(WHITE, a * (i % 3 ? 0.7 : 0.95));
      if (i % 4 === 0) {
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      } else g.fillRect(x, y, 1, 1);
    }
  },
  front(g, c, k, now) {
    // cold mist rolling along the ground
    const a = (k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1) * 0.5;
    const y = c.s.ground - 3;
    for (let i = 0; i < 9; i++) {
      const w = 34 + (i % 3) * 14;
      const x = ((((i * 47 + now * 0.03 * (i % 2 ? 1 : -1)) % (GAME_W + w)) + GAME_W + w) % (GAME_W + w)) - w;
      g.fillStyle(0xe0faff, 0.2 * a);
      g.fillEllipse(Math.round(x + w / 2), y + (i % 3), w, 6);
      g.fillStyle(WHITE, 0.14 * a);
      g.fillEllipse(Math.round(x + w / 2), y - 1 + (i % 3), Math.round(w * 0.6), 3);
    }
  },
  strike(c, v, i) {
    const s = c.s;
    const fx = s.fx;
    const cy = chest(v) + rand(-5, 4);
    hitFoe(c, v, 3);
    mark(c, 'spike', { x: v.x + (i % 2 ? 6 : -6) + rand(-3, 3), y: s.ground, r: 16 + (i % 3) * 5, life: 230, seed: i });
    fx.chips(v.x, cy, 10, [WHITE, 0xbff0ff, 0x6ad0f0], 7, 0);
    fx.sparks.push({ x: v.x + rand(-6, 6), y: cy, at: s.anim, size: 7, color: 0xbff0ff });
    if (c.scale.layers >= 3) fx.ring(v.x, cy, 10, 0xbff0ff, true);
  },
  blow(c, v) {
    const s = c.s;
    const cy = chest(v);
    mark(c, 'encase', { x: v.x, y: cy, v, r: v.img.displayWidth / 2 + 5, x1: v.img.displayHeight / 2 + 6, life: 300, seed: v.id });
    s.later(250, () => {
      s.fx.chips(v.x, cy, v.img.displayWidth * 0.8, [WHITE, 0xe0faff, 0xbff0ff, 0x6ad0f0], 20, 0);
      s.fx.flashes.push({ x: v.x, y: cy, r: 14, at: s.anim });
    });
    s.fx.shock(v.x, s.ground, 40, 0xbff0ff);
  },
};

/** An ice crystal spike up from (x, y), h tall: a lit left face, a white edge, an ink rim. */
export function iceSpike(g: G, x: number, y: number, w: number, h: number, a = 1): void {
  if (h < 2) return;
  inkPoly(
    g,
    [
      [x - w / 2, y],
      [x, y - h],
      [x + w / 2, y],
    ],
    0x6ad0f0,
    a,
  );
  poly(
    g,
    [
      [x - w / 2 + 1, y],
      [x, y - h + 1],
      [x, y],
    ],
    0xbff0ff,
    a,
  );
  line(g, x, y - h + 1, x, y - h * 0.4, 1, WHITE, a);
}

const CONTROLLER_MARKS: Record<string, MarkDraw> = {
  spike(g, m, k) {
    const rise = ease(clamp01(k / 0.25));
    const a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    iceSpike(g, m.x, m.y, 6, m.r * rise, a);
  },
  // the foe locked in a crystal of ice: it forms, cracks, and shatters (the chips come from the kit's blow)
  encase(g, m, k) {
    const v = m.v;
    const x = v ? v.x : m.x;
    const y = v ? chest(v) : m.y;
    if (k > 0.85) return;
    const form = ease(clamp01(k / 0.2));
    const hw = m.r * form;
    const hh = m.x1 * form;
    const pts: Array<[number, number]> = [
      [x - hw * 0.5, y - hh],
      [x + hw * 0.6, y - hh * 0.95],
      [x + hw, y - hh * 0.2],
      [x + hw * 0.8, y + hh],
      [x - hw * 0.7, y + hh],
      [x - hw, y + hh * 0.1],
    ];
    inkPoly(g, pts, 0xbff0ff, 0.45);
    poly(
      g,
      [
        [x - hw * 0.5, y - hh],
        [x + hw * 0.6, y - hh * 0.95],
        [x + hw * 0.2, y - hh * 0.4],
        [x - hw * 0.6, y - hh * 0.3],
      ],
      WHITE,
      0.35,
    );
    line(g, x - hw * 0.5, y - hh + 1, x - hw + 1, y + hh * 0.1, 1, WHITE, 0.9);
    twinkle(g, x + hw * 0.5, y - hh * 0.6, 2, 0xe0faff, 0.9);
    if (k > 0.45) {
      const ck = (k - 0.45) / 0.4;
      for (let j = 0; j < 4; j++) {
        const ang = hash(j, m.seed) * Math.PI * 2;
        line(g, x, y, x + Math.cos(ang) * hw * ck, y + Math.sin(ang) * hh * ck, 1, WHITE, 1);
      }
    }
  },
};

// ================================================================== Summoner

const SUMMONER: StyleKit = {
  pal: { deep: 0x12261e, dark: 0x2e5a32, base: 0x4a9e3a, light: 0xb4f070, hot: 0xf0ffd0, accent: 0xff9ac0 },
  ghost: 0xb4f070,
  flash: 0xf0ffd0,
  sky(g, c, _k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x08160e, 0x0e2216, 0x152f1e, 0x1d3e26, 0x264e2e, 0x305e36], 0, bottom, a);
    // light shafts slanting down through the canopy, swaying
    for (let i = 0; i < 5; i++) {
      const x0 = 30 + i * 66 + Math.sin(now / 1400 + i) * 6;
      const w = 10 + (i % 2) * 6;
      poly(
        g,
        [
          [x0, 0],
          [x0 + w, 0],
          [x0 + w + 30, bottom],
          [x0 + 18, bottom],
        ],
        0xd8f0a0,
        a * (0.07 + 0.04 * Math.sin(now / 700 + i * 2)),
      );
    }
    // canopy fringes along the top
    for (let x = 0; x < GAME_W; x += 6) {
      const h = 4 + Math.round(3 * Math.sin(x / 9) + 2 * hash(x, 41));
      g.fillStyle(0x0a1a10, a);
      g.fillRect(x, 0, 6, h + 1);
      g.fillStyle(0x1e3c2a, a);
      g.fillRect(x + 1, 0, 4, h);
    }
    // leaves drifting down, spirit motes rising
    for (let i = 0; i < 12 + c.n * 2; i++) {
      const life = 2800;
      const q = ((now + hash(i, 43) * life) % life) / life;
      const x = Math.round(hash(i, 44) * GAME_W + Math.sin(q * 7 + i) * 7);
      const y = Math.round(6 + q * (bottom - 6));
      const flip = Math.sin(q * 11 + i) > 0;
      g.fillStyle(i % 3 ? 0x78a83c : 0xb4d058, a);
      g.fillRect(x, y, flip ? 3 : 2, flip ? 2 : 3);
      const my = Math.round(bottom - q * bottom * 0.7);
      g.fillStyle(0xd0ff90, a * (1 - q) * 0.8);
      g.fillRect(Math.round(hash(i, 45) * GAME_W), my, 1, 1);
    }
  },
  strike(c, v, i) {
    const s = c.s;
    const from = hand(c, 30);
    const tx = v.x + rand(-5, 5);
    const ty = chest(v) + rand(-5, 5);
    const ms = flight(c, 110);
    mark(c, 'wisp', { x: from.x, y: from.y, x1: tx, y1: ty, life: ms, seed: i });
    s.later(ms, () => {
      hitFoe(c, v, 3);
      s.fx.chips(tx, ty, 8, [0xb4f070, 0x78a83c, 0x4a9e3a, 0xff9ac0], 5, 0);
      s.fx.sparks.push({ x: tx, y: ty, at: s.anim, size: 6, color: 0xd0ff90 });
      mark(c, 'lash', { x: tx, y: ty, x1: v.x + (i % 2 ? 12 : -12), y1: s.ground, life: 150, seed: i });
      if (c.scale.layers >= 3) s.fx.ring(tx, ty, 9, 0xb4f070, true);
    });
  },
  blow(c, v) {
    const s = c.s;
    mark(c, 'coil', { x: v.x, y: v.y, v, r: v.img.displayWidth / 2 + 3, x1: v.img.displayHeight, life: 560, seed: v.id });
    s.fx.chips(v.x, chest(v), v.img.displayWidth * 0.8, [0xb4f070, 0x78a83c, 0xff9ac0, 0xf0ffd0], 18, -1);
    s.fx.burst(v.x, chest(v), 0xb4f070, 12, true, 1.2);
  },
};

/** A vine from (x0, y0) to (x1, y1), waving, `grow` of it drawn, with leaves along it. */
function vine(g: G, x0: number, y0: number, x1: number, y1: number, grow: number, seed: number, a = 1): void {
  const n = 14;
  let px = x0;
  let py = y0;
  for (let j = 1; j <= Math.round(n * clamp01(grow)); j++) {
    const q = j / n;
    const wob = Math.sin(q * Math.PI * 2 + seed) * 4 * Math.sin(q * Math.PI);
    const x = x0 + (x1 - x0) * q + wob;
    const y = y0 + (y1 - y0) * q;
    inkLine(g, px, py, x, y, 1, j % 2 ? 0x4a9e3a : 0x2e5a32, a);
    if (j % 4 === 2) {
      g.fillStyle(0xb4d058, a);
      g.fillRect(Math.round(x) + (j % 8 === 2 ? 1 : -3), Math.round(y) - 1, 2, 2);
    }
    px = x;
    py = y;
  }
}

const SUMMONER_MARKS: Record<string, MarkDraw> = {
  // a spirit: a glowing orb arcing in with a trail of light
  wisp(g, m, k) {
    if (k >= 1) return;
    const at = (q: number): [number, number] => [m.x + (m.x1 - m.x) * q, m.y + (m.y1 - m.y) * q - Math.sin(q * Math.PI) * 16];
    for (let j = 6; j >= 1; j--) {
      const [x, y] = at(Math.max(0, k - j * 0.06));
      g.fillStyle(0xb4f070, (1 - j / 7) * 0.8);
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
    const [x, y] = at(k);
    g.fillStyle(0xd0ff90, 0.35);
    g.fillCircle(Math.round(x), Math.round(y), 5);
    // a soft round spirit: a cross-shaped glowing heart (a leaf-green rim), white at its middle
    const X = Math.round(x);
    const Y = Math.round(y);
    g.fillStyle(0x2e5a32, 1);
    g.fillRect(X - 1, Y - 3, 3, 7);
    g.fillRect(X - 3, Y - 1, 7, 3);
    g.fillStyle(0xd0ff90, 1);
    g.fillRect(X - 1, Y - 2, 3, 5);
    g.fillRect(X - 2, Y - 1, 5, 3);
    g.fillStyle(WHITE, 1);
    g.fillRect(X, Y - 1, 1, 2);
  },
  lash(g, m, k) {
    vine(g, m.x1, m.y1, m.x, m.y, k * 3, m.seed, k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
  },
  // vines coiling up the foe from its feet, thorns and leaves on them
  coil(g, m, k) {
    const v = m.v;
    const x0 = v ? v.x : m.x;
    const feet = v ? v.y : m.y;
    const grow = ease(clamp01(k / 0.3));
    const a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    for (let strand = 0; strand < 2; strand++) {
      const ph = strand * Math.PI;
      let px = x0 + Math.sin(ph) * m.r;
      let py = feet;
      const steps = Math.round(24 * grow);
      for (let j = 1; j <= steps; j++) {
        const q = j / 24;
        const ang = q * Math.PI * 3.2 + ph;
        const x = x0 + Math.sin(ang) * m.r;
        const y = feet - q * m.x1;
        const near = Math.cos(ang) > 0;
        line(g, px, py, x, y, near ? 3 : 2, INK, a);
        line(g, px, py, x, y, near ? 2 : 1, near ? 0x4a9e3a : 0x2e5a32, a);
        if (j % 5 === 0 && near) {
          g.fillStyle(0xb4d058, a);
          g.fillRect(Math.round(x) + 1, Math.round(y) - 2, 3, 2);
          g.fillStyle(0xf0e0a0, a);
          g.fillRect(Math.round(x) - 2, Math.round(y), 1, 1);
        }
        px = x;
        py = y;
      }
    }
  },
};

// ================================================================== Bomber

const BOMBER: StyleKit = {
  pal: { deep: 0x2a1a1a, dark: 0x5a2a14, base: 0xff7a2a, light: 0xffd060, hot: 0xfff0c0, accent: 0x8a8494 },
  ghost: 0xffd060,
  flash: 0xfff0c0,
  sky(g, c, k, a, now) {
    const bottom = skyFloor(c);
    bands(g, [0x100a0e, 0x1e1018, 0x341818, 0x522414, 0x7e3814, 0xb05418], 0, bottom, a);
    // a burning horizon
    for (let x = 0; x < GAME_W; x += 4) {
      const h = 3 + Math.round(3 * (0.5 + 0.5 * Math.sin(x / 7 + now / 120)) + 2 * hash(x, 51));
      g.fillStyle(0xff9a3a, 0.5 * a);
      g.fillRect(x, bottom - h, 4, h);
      g.fillStyle(0xffd060, 0.4 * a);
      g.fillRect(x + 1, bottom - Math.max(1, h - 2), 2, Math.max(1, h - 2));
    }
    // smoke billows rolling along the top
    for (let i = 0; i < 9; i++) {
      const r = 10 + (i % 3) * 5;
      const x = ((((i * 53 - now * 0.025) % (GAME_W + 2 * r)) + GAME_W + 2 * r) % (GAME_W + 2 * r)) - r;
      const y = 8 + (i % 4) * 9;
      g.fillStyle(0x0a060a, 0.4 * a);
      g.fillCircle(Math.round(x), y + 2, r);
      g.fillStyle(0x3a3036, 0.45 * a);
      g.fillCircle(Math.round(x), y, r);
      g.fillStyle(0x5a5466, 0.3 * a);
      g.fillCircle(Math.round(x) - 3, y - 3, Math.round(r * 0.6));
    }
    // embers rising; the sky flares on each blast
    for (let i = 0; i < 16 + c.n * 3; i++) {
      const life = 1800;
      const q = ((now + hash(i, 53) * life) % life) / life;
      const x = Math.round(hash(i, 54) * GAME_W + Math.sin(q * 8 + i) * 4);
      const y = Math.round(bottom - q * (bottom - 4));
      g.fillStyle(i % 3 ? 0xff9a3a : 0xffe080, a * (1 - q));
      g.fillRect(x, y, 1, 1);
    }
    const flare = c.tl.strikes.some((t) => k >= t + 0.02 && k < t + 0.06);
    if (flare) {
      g.fillStyle(0xff9a3a, 0.12 * a);
      g.fillRect(0, 0, GAME_W, bottom);
    }
  },
  strike(c, v, i) {
    const s = c.s;
    const from = hand(c, 26);
    const tx = v.x + rand(-6, 6);
    const ty = chest(v) + rand(-4, 6);
    const ms = flight(c, 140);
    mark(c, 'bomb', { x: from.x, y: from.y, x1: tx, y1: ty, r: 24 + (i % 3) * 6, life: ms, seed: i });
    s.later(ms, () => {
      hitFoe(c, v, 5);
      s.fx.stars.push({ x: tx, y: ty, at: s.anim, r: 12 + (c.scale.layers >= 3 ? 4 : 0), color: i % 2 ? 0xffd060 : 0xff7a2a });
      s.fx.puffs.push({ x: tx + rand(-5, 5), y: ty - 2, r: rand(3, 6), at: s.anim + 40, life: 420, color: 0x8a8494 });
      s.fx.chips(tx, ty, 6, [0x2a1a1a, 0x5a5466, 0xff7a2a], 7, 0);
      s.fx.flashes.push({ x: tx, y: ty, r: 7, at: s.anim });
    });
  },
  blow(c, v) {
    const s = c.s;
    const cy = chest(v);
    mark(c, 'fireball', { x: v.x, y: cy, r: Math.max(18, v.img.displayWidth * 0.75), life: 640, seed: v.id });
    s.fx.chips(v.x, cy, v.img.displayWidth, [0x2a1a1a, 0x140c1c, 0x5a5466, 0xff7a2a], 18, 0);
    for (let i = 0; i < 4; i++) s.fx.puffs.push({ x: v.x + rand(-8, 8), y: cy - 8 - i * 6, r: rand(6, 9), at: s.anim + 120 + i * 50, life: 700, color: i % 2 ? 0x5a5466 : 0x8a8494 });
  },
};

/** A round black bomb at (x, y), a fizzing fuse on top. */
export function bomb(g: G, x: number, y: number, r: number, now: number, a = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  g.fillStyle(INK, a);
  g.fillCircle(X, Y, r + 1);
  g.fillStyle(0x3a3046, a);
  g.fillCircle(X, Y, r);
  g.fillStyle(0x6a6080, a);
  g.fillRect(X - Math.round(r / 2), Y - Math.round(r / 2), Math.max(1, Math.round(r / 2)), Math.max(1, Math.round(r / 3)));
  g.fillStyle(0x8a5a2e, a);
  g.fillRect(X, Y - r - 2, 1, 2);
  g.fillStyle(Math.floor(now / 50) % 2 ? 0xffe080 : 0xff7a2a, a);
  g.fillRect(X - 1 + (Math.floor(now / 70) % 2), Y - r - 4, 2, 2);
}

const BOMBER_MARKS: Record<string, MarkDraw> = {
  bomb(g, m, k, c) {
    if (k >= 1) return;
    const x = m.x + (m.x1 - m.x) * k;
    const y = m.y + (m.y1 - m.y) * k - Math.sin(k * Math.PI) * m.r;
    bomb(g, x, y, 2, c.s.anim);
  },
  // a fireball: it swells white-hot, burns, and rolls up into smoke
  fireball(g, m, k) {
    const R = m.r;
    if (k < 0.45) {
      const e = ease(clamp01(k / 0.15));
      const cool = clamp01((k - 0.15) / 0.3);
      const flick = 1 + 0.08 * Math.sin(k * 90);
      g.fillStyle(toward(0xff7a2a, 0x8a3a1a, cool), 1);
      g.fillCircle(Math.round(m.x), Math.round(m.y), Math.max(1, Math.round(R * e * flick)));
      g.fillStyle(toward(0xffd060, 0xff7a2a, cool), 1);
      g.fillCircle(Math.round(m.x), Math.round(m.y - 1), Math.max(1, Math.round(R * 0.7 * e)));
      g.fillStyle(toward(0xfff0c0, 0xffd060, cool), 1);
      g.fillCircle(Math.round(m.x - 1), Math.round(m.y - 2), Math.max(1, Math.round(R * 0.4 * e * (1 - cool * 0.5))));
    }
    if (k > 0.3) {
      const q = (k - 0.3) / 0.7;
      for (let j = 0; j < 4; j++) {
        const x = m.x + (hash(j, m.seed) - 0.5) * R;
        const y = m.y - q * (14 + j * 6);
        const r = R * (0.45 + 0.25 * q) * (1 - j * 0.12);
        g.fillStyle(j % 2 ? 0x5a5466 : 0x3a3046, 0.7 * (1 - q));
        g.fillCircle(Math.round(x), Math.round(y), Math.max(1, Math.round(r)));
      }
    }
  },
};

// ================================================================== the registry

export const STYLE_KITS: Record<StyleId, StyleKit> = {
  blade: BLADE,
  shadow: SHADOW,
  guardian: GUARDIAN,
  marksman: MARKSMAN,
  brute: BRUTE,
  controller: CONTROLLER,
  summoner: SUMMONER,
  bomber: BOMBER,
};

/** Every kit's marks, by kind. */
export const KIT_MARKS: Record<string, MarkDraw> = { ...BLADE_MARKS, ...SHADOW_MARKS, ...GUARDIAN_MARKS, ...MARKSMAN_MARKS, ...BRUTE_MARKS, ...CONTROLLER_MARKS, ...SUMMONER_MARKS, ...BOMBER_MARKS };

/** For a mark that needs only its spot and a kit (the signatures reuse these). */
export type { Mark };
export { arrow, rockSpike, vine };
