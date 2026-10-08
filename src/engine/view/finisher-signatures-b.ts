// Part 6's second Summoner and second Marksman: their signature moments in the finisher show (core/finisher-show.ts
// HERO_SIGNATURE; drawn on top of their style's kit, view/finisher-kits.ts, like every hero's in
// view/finisher-signatures.ts, which lists these two in SIGNATURE_DRAW).
//   Yara  spiritStampede  stars join into a stag in the sky while she calls; then her spirits stampede across the
//                         stage through every foe (a wolf, a wisp, her tortoise spinning in its shell, one more for
//                         every spirit out and every stack) and, on the last blow, the great stag of starlight leaps
//                         down out of the sky and charges through them all
//   Dell  pebbleStorm     he hauls his slingshot band back till it glints; every strike is a pebble that pings off
//                         one foe onto the next and away (ricochets, little dust puffs); the last blow is his lucky
//                         golden pebble hopping from foe to foe in bright arcs, a clover sparkling where it lands
// Everything is drawn from the show's clock and deterministic noise (the screenshot tests stay exact).
import { FLURRY_END } from '../../core/finisher-show';
import { GAME_W } from '../layout';
import { clamp01, ease, INK, WHITE, type EnemyView } from './shared';
import { centerOf, chest, hash, hitFoe, line, twinkle, type G, type ShowCtx } from './finisher-fx';
import type { SignatureDraw } from './finisher-signatures';

const between = (k: number, a: number, b: number): number => clamp01((k - a) / Math.max(1e-6, b - a));

/** Draw a small pixel map (rows of letters; '.' empty) at (x, y) top left, `s` px a pixel, with a 1 px ink outline
 *  round it, in the colours `pal` gives each letter. `flip`: mirrored (facing left). */
function sprite(g: G, rows: readonly string[], pal: Record<string, number>, x: number, y: number, s = 1, a = 1): void {
  if (a <= 0.02) return;
  const X = Math.round(x);
  const Y = Math.round(y);
  g.fillStyle(INK, a);
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && g.fillRect(X + i * s - 1, Y + j * s - 1, s + 2, s + 2)));
  rows.forEach((r, j) =>
    [...r].forEach((ch, i) => {
      if (ch === '.') return;
      g.fillStyle(pal[ch] ?? WHITE, a);
      g.fillRect(X + i * s, Y + j * s, s, s);
    }),
  );
}

// ================================================================== Yara: the spirit stampede

const SPIRIT = { deep: 0x2a8ab4, base: 0x56c8e8, light: 0xa4ecfa, hot: 0xe4fcff };
const SP_PAL = { b: SPIRIT.base, l: SPIRIT.light, h: SPIRIT.hot, d: SPIRIT.deep, w: WHITE, j: 0x2eae8c, J: 0x6ad8b0 };

/** A running spirit wolf (two strides): light along its back, a white eye. */
const WOLF_RUN = [
  ['..........l.l..', '.........llll..', 'l........lhwlll', 'llllllllllllb..', '.bbbbbbbbbbbb..', '..dbbbbbbbbd...', '..b..b...b..b..', '.b....b.b....b.'],
  ['..........l.l..', '.........llll..', '.l.......lhwlll', 'llllllllllllb..', '.bbbbbbbbbbbb..', '..dbbbbbbbbd...', '...bb....bb....', '...bb....bb....'],
];
/** The tortoise tucked into its shell, rolling: a jade dome with a turning star on it. */
const SHELL_ROLL = [
  ['..JJJJJ..', '.JJwJJJj.', 'JJJJJJjjj', 'djjjjjjjd'],
  ['..JJJJJ..', '.JJJJwJj.', 'JJJJJJjjj', 'djjjjjjjd'],
];
/** The great stag of starlight, leaping (drawn at 2x). */
const STAG_LEAP = [
  '..........l..l...',
  '.........l.ll.l..',
  '..........llll...',
  '...........ll....',
  '..........hhhh...',
  '..........hwhhhh.',
  'll.......llll....',
  'lllllllllllll....',
  '.bbbbbbbbbbbb....',
  '..dbbbbbbbbbb....',
  '..b.b......bb.b..',
  '.b...b....b....b.',
];

/** The stag constellation (offsets in px from its centre) and the lines that join its stars. */
const STARS: ReadonlyArray<readonly [number, number]> = [
  [-15, -2], [-4, -5], [7, -5], [12, 0], [1, 3], [-13, 3],
  [-15, 12], [-10, 12], [6, 12], [12, 12],
  [14, -12], [21, -10],
  [11, -21], [16, -24], [7, -26], [19, -18],
];
const LINKS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6], [0, 7], [4, 8], [3, 9], [2, 10], [10, 11], [10, 12], [12, 13], [12, 14], [13, 15],
];

/** How many spirits she had out when the show began (more runners for each). */
const spiritsAt = new WeakMap<ShowCtx, number>();

/** The runners: one per strike (it passes through the foes on that strike), more for each spirit out. */
function runners(c: ShowCtx): Array<{ kind: 0 | 1 | 2; at: number; lane: number; extra: boolean }> {
  const tl = c.tl;
  const out: Array<{ kind: 0 | 1 | 2; at: number; lane: number; extra: boolean }> = [];
  tl.strikes.forEach((t, i) => out.push({ kind: (i % 3) as 0 | 1 | 2, at: t, lane: i % 3, extra: false }));
  const extra = Math.min(6, (spiritsAt.get(c) ?? 0) * 2);
  for (let i = 0; i < extra; i++) {
    const t = tl.build + ((i + 0.5) / extra) * (FLURRY_END - tl.build);
    out.push({ kind: ((i + 1) % 3) as 0 | 1 | 2, at: t, lane: (i + 1) % 3, extra: true });
  }
  return out;
}

/** Where a runner is at k: it crosses the stage left to right, reaching the foes' middle at its strike. */
function runnerX(c: ShowCtx, at: number, k: number): number {
  const mid = centerOf(c);
  const speed = (GAME_W + 60) / 0.32; // px per show (it crosses in about a third of the show)
  return mid + (k - at) * speed;
}

const SPIRIT_STAMPEDE: SignatureDraw = {
  start(c) {
    spiritsAt.set(c, c.s.app.run.combat?.allies.length ?? 0);
  },
  back(g, c, k, now) {
    const tl = c.tl;
    // the constellation: its stars come out one by one while she calls, the lines join them into a stag, it flares
    // as the stampede begins and fades through it; gone when the great stag leaps down
    // (a great constellation across the sky over the stage: its lines read between the actors and the title)
    const cx = Math.round(GAME_W / 2) + 8;
    const cy = c.s.ground - 26;
    const sc = 1.6 + 0.05 * c.n;
    const fade = k < tl.build ? 1 : k < tl.blow - 0.06 ? 0.55 : 0.55 * (1 - between(k, tl.blow - 0.06, tl.blow));
    if (fade <= 0.02) return;
    const flare = k >= tl.build && k < tl.build + 0.06 ? 1 - between(k, tl.build, tl.build + 0.06) : 0;
    const lines = between(k, tl.build * 0.3, tl.build);
    LINKS.forEach(([a, b], i) => {
      const q = clamp01(lines * LINKS.length - i);
      if (q <= 0) return;
      const [ax, ay] = STARS[a];
      const [bx, by] = STARS[b];
      const ex = ax + (bx - ax) * q;
      const ey = ay + (by - ay) * q;
      line(g, cx + ax * sc, cy + ay * sc + 1, cx + ex * sc, cy + ey * sc + 1, 1, SPIRIT.deep, 0.5 * fade);
      line(g, cx + ax * sc, cy + ay * sc, cx + ex * sc, cy + ey * sc, 1, flare > 0 ? WHITE : SPIRIT.light, (0.65 + 0.35 * flare) * fade);
    });
    STARS.forEach(([x, y], i) => {
      const show = between(k, 0.02 + (i / STARS.length) * tl.build * 0.6, 0.05 + (i / STARS.length) * tl.build * 0.6);
      if (show <= 0) return;
      const tw = 0.7 + 0.3 * Math.sin(now / 120 + i * 1.9);
      twinkle(g, cx + x * sc, cy + y * sc, i % 4 === 0 ? 3 : 2, i % 3 ? SPIRIT.light : 0xfff6d8, show * tw * fade);
    });
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const ground = c.s.ground;
    // the stampede: each runner crosses the stage, leaving a trail of spirit light
    for (const r of runners(c)) {
      const x = runnerX(c, r.at, k);
      if (x < -30 || x > GAME_W + 30 || k < tl.build - 0.02) continue;
      const feet = ground - 1 - r.lane * 3;
      const a = r.extra ? 0.8 : 1;
      const stride = Math.floor(now / 70 + r.at * 50) % 2;
      for (let j = 1; j <= 5; j++) {
        g.fillStyle(j % 2 ? SPIRIT.light : SPIRIT.base, a * (1 - j / 6) * 0.7);
        g.fillRect(Math.round(x - 8 - j * 5), Math.round(feet - 5 - (hash(j, Math.round(r.at * 999)) * 3)), 2, 1);
      }
      if (r.kind === 0) sprite(g, WOLF_RUN[stride], SP_PAL, x - 8, feet - 8, 1, a);
      else if (r.kind === 1) {
        // a wisp: a bright orb streaking along, bobbing
        const y = feet - 10 - Math.sin(now / 60 + r.at * 30) * 2;
        g.fillStyle(SPIRIT.light, 0.35 * a);
        g.fillCircle(Math.round(x), Math.round(y), 4);
        sprite(g, ['.h.', 'hwh', '.h.'], SP_PAL, x - 1, y - 1, 1, a);
      } else sprite(g, SHELL_ROLL[stride], SP_PAL, x - 4, feet - 4 - stride, 1, a);
    }
    // the great stag: down out of the sky, leaping through the foes' middle on the last blow and off the stage (most of
    // its run comes before the blow's flash)
    const q = between(k, tl.blow - 0.15, tl.blow + 0.13);
    if (q > 0 && q < 1) {
      const mid = centerOf(c);
      const x0 = Math.min(c.heroX - 10, mid - 140);
      const x = x0 + (2 * (mid - x0) * (k - (tl.blow - 0.15))) / 0.3 - 16;
      const fall = between(q, 0, 0.35);
      const y = ground - 26 - Math.abs(Math.sin(q * Math.PI * 2)) * 12 - (1 - ease(fall)) * 50;
      for (let j = 1; j <= 8; j++) twinkle(g, x - 6 - j * 7, y + 12 + Math.sin(j + now / 90) * 3, j % 3 ? 1 : 2, j % 2 ? SPIRIT.light : 0xfff6d8, 1 - j / 9);
      g.fillStyle(SPIRIT.light, 0.25);
      g.fillEllipse(Math.round(x + 16), Math.round(y + 12), 44, 30);
      sprite(g, STAG_LEAP, SP_PAL, x, y, 2, 1);
    }
  },
  strike(c, v, i) {
    // the runner of this strike tramples through it
    const s = c.s;
    hitFoe(c, v, 4);
    s.fx.sparks.push({ x: v.x - 4, y: chest(v) + 4, at: s.anim, size: 7, color: SPIRIT.light });
    s.fx.chips(v.x, s.ground - 2, 10, [WHITE, SPIRIT.light, SPIRIT.base], 5, -1);
    if (i % 2 === 0) s.fx.dust(v.x, s.ground, 3, 1, 0.8);
  },
  blow(c) {
    // the great stag charges through each foe in turn: a ring of starlight bursts off each as it passes
    const s = c.s;
    const list = c.views.slice().sort((a, b) => a.x - b.x);
    list.forEach((v, j) =>
      s.later(40 + j * 45, () => {
        if (v.dieAt && s.anim - v.dieAt > 60) return;
        s.fx.ring(v.x, chest(v), 26, SPIRIT.hot, true);
        s.fx.stars.push({ x: v.x, y: chest(v), at: s.anim, r: 26, color: SPIRIT.light });
        s.fx.chips(v.x, chest(v), v.img.displayWidth * 0.6, [WHITE, 0xfff6d8, SPIRIT.light, SPIRIT.base], 14, -1);
      }),
    );
    s.fx.shock(centerOf(c), s.ground, 90, SPIRIT.light);
  },
};

// ================================================================== Dell: the pebble storm

const PEBBLE = { dark: 0x4a4858, base: 0x8a8694, light: 0xcac6c8, gold: 0xf2cc5a, goldHi: 0xfff0a0, goldLo: 0x9a6a18 };

/** A pebble at (x, y): a little stone lit from the top left (`gold`: his lucky one, bigger). */
function pebble(g: G, x: number, y: number, gold = false, a = 1): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  const w = gold ? 5 : 3;
  g.fillStyle(INK, a);
  g.fillRect(X - 1, Y - 1, w + 2, w + 2);
  g.fillStyle(gold ? PEBBLE.goldLo : PEBBLE.dark, a);
  g.fillRect(X, Y, w, w);
  g.fillStyle(gold ? PEBBLE.gold : PEBBLE.base, a);
  g.fillRect(X, Y, w - 1, w - 1);
  g.fillStyle(gold ? PEBBLE.goldHi : PEBBLE.light, a);
  g.fillRect(X, Y, gold ? 2 : 1, 1);
  g.fillRect(X, Y, 1, gold ? 2 : 1);
}

/** Dell's hand (where the band lets go). */
const hand = (c: ShowCtx): { x: number; y: number } => {
  const h = c.heroAt();
  return { x: h.x + 14, y: c.s.ground - 17 - h.lift };
};

/** A strike's pebble path: from his hand to its foe, off it onto another (or up and away), down to the ground. */
function pebblePath(c: ShowCtx, i: number): Array<[number, number]> {
  const views = c.views.slice().sort((a, b) => a.homeX - b.homeX);
  const ground = c.s.ground;
  const from = hand(c);
  if (!views.length) return [[from.x, from.y], [from.x + 90, from.y - 6], [from.x + 120, ground]];
  const a = views[i % views.length];
  const b = views.length > 1 ? views[(i + 1) % views.length] : null;
  const pa: [number, number] = [a.homeX + (hash(i, 61) - 0.5) * 8, chest(a) + (hash(i, 62) - 0.5) * 8];
  const pb: [number, number] = b ? [b.homeX + (hash(i, 63) - 0.5) * 8, chest(b) + (hash(i, 64) - 0.5) * 6] : [pa[0] + 18, pa[1] - 22];
  const end: [number, number] = [pb[0] + (pb[0] >= pa[0] ? 22 : -22), ground - 1];
  return [[from.x, from.y], pa, pb, end];
}

/** A point along a path of segments, each `seg` of the show long, `t` into it (null: before or after). */
function along(path: Array<[number, number]>, t: number, seg: number): [number, number] | null {
  if (t < 0) return null;
  const s = Math.floor(t / seg);
  if (s >= path.length - 1) return null;
  const q = (t - s * seg) / seg;
  const [ax, ay] = path[s];
  const [bx, by] = path[s + 1];
  // the bounces arc a little
  return [ax + (bx - ax) * q, ay + (by - ay) * q - Math.sin(q * Math.PI) * (s === 0 ? 3 : 8)];
}

const SEG = 0.045;

const PEBBLE_STORM: SignatureDraw = {
  motion(c, k, def) {
    const tl = c.tl;
    if (k >= tl.back) return def;
    if (k < tl.build) return { ...def, pose: 'slashA' };
    if (k >= tl.blow - 0.06) return { ...def, pose: 'cast' };
    // the band snaps on each strike, and he loads the next
    const recent = tl.strikes.some((t) => k >= t - SEG && k < t - SEG + 0.04);
    return { ...def, pose: recent ? 'slashB' : 'slashA' };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const h = hand(c);
    // the band hauled back till it glints
    const pull = between(k, 0.02, tl.build);
    if (k < tl.build + 0.02 && pull > 0) {
      twinkle(g, h.x - 8, h.y, 1 + Math.round(pull * 2), 0xfff0a0, pull * (0.7 + 0.3 * Math.sin(now / 50)));
      for (let j = 0; j < 3; j++) {
        const ang = now / 140 + (j * Math.PI * 2) / 3;
        g.fillStyle(0xd8dcec, 0.6 * pull);
        g.fillRect(Math.round(h.x - 8 + Math.cos(ang) * (8 - pull * 4)), Math.round(h.y + Math.sin(ang) * (6 - pull * 3)), 1, 1);
      }
    }
    // each strike's pebble: away from his hand just before it lands, pinging off its foe onto the next and away
    tl.strikes.forEach((t, i) => {
      const path = pebblePath(c, i);
      const p = along(path, k - (t - SEG), SEG);
      if (!p) return;
      for (let j = 1; j <= 4; j++) {
        const tp = along(path, k - (t - SEG) - j * 0.006, SEG);
        if (tp) {
          g.fillStyle(j < 2 ? WHITE : 0xd8dcec, 0.75 * (1 - j / 5));
          g.fillRect(Math.round(tp[0]) + 1, Math.round(tp[1]) + 1, 2, 1);
        }
      }
      pebble(g, p[0], p[1]);
    });
    // the lucky pebble: off his hand on the last blow, hopping from foe to foe in bright arcs and off the stage
    const views = c.views.slice().sort((a, b) => a.homeX - b.homeX);
    const stops: Array<[number, number]> = [[h.x, h.y], ...views.map((v): [number, number] => [v.homeX, chest(v)]), [GAME_W + 30, c.s.ground - 30]];
    // (most of its hops come before the blow's flash)
    const lq = between(k, tl.blow - 0.13, tl.blow + 0.09);
    if (lq > 0 && lq < 1) {
      const span = lq * (stops.length - 1);
      const s = Math.min(stops.length - 2, Math.floor(span));
      const q = span - s;
      const [ax, ay] = stops[s];
      const [bx, by] = stops[s + 1];
      const x = ax + (bx - ax) * q;
      const y = ay + (by - ay) * q - Math.sin(q * Math.PI) * 16;
      for (let j = 1; j <= 6; j++) twinkle(g, x - j * 5, y + Math.sin(j * 1.3 + now / 80) * 2, j % 3 ? 1 : 2, j % 2 ? 0xfff0a0 : WHITE, 1 - j / 7);
      g.fillStyle(0xfff0a0, 0.3);
      g.fillCircle(Math.round(x + 2), Math.round(y + 2), 8);
      pebble(g, x, y, true);
    }
  },
  strike(c, v, i) {
    // the pebble lands on this strike (with a puff) and pings off onto the next foe a moment later
    const s = c.s;
    const path = pebblePath(c, i);
    if (Math.abs(path[1][0] - v.homeX) > 6) return;
    hitFoe(c, v, 3);
    s.fx.sparks.push({ x: path[1][0], y: path[1][1], at: s.anim, size: 6, color: WHITE });
    s.fx.chips(path[1][0], path[1][1], 6, [WHITE, PEBBLE.light, PEBBLE.base], 5, 0);
    const b = c.views.find((x) => Math.abs(x.homeX - path[2][0]) < 6 && x !== v);
    s.later(c.tl.ms * SEG, () => {
      if (b && !b.dieAt) hitFoe(c, b, 2);
      s.fx.sparks.push({ x: path[2][0], y: path[2][1], at: s.anim, size: 5, color: 0xfff0a0 });
    });
    s.later(c.tl.ms * SEG * 2, () => s.fx.dust(path[3][0], s.ground, 2, 0, 0.6));
  },
  blow(c) {
    // the lucky pebble hops through each foe in turn: gold bursts, a clover sparkle at the last
    const s = c.s;
    const list = c.views.slice().sort((a, b) => a.homeX - b.homeX);
    const step = (c.tl.ms * 0.22) / Math.max(1, list.length + 1);
    list.forEach((v: EnemyView, j) =>
      s.later(Math.max(0, c.tl.ms * -0.13 + step * (j + 1)), () => {
        if (v.dieAt && s.anim - v.dieAt > 60) return;
        s.fx.ring(v.x, chest(v), 22, 0xfff0a0, true);
        s.fx.stars.push({ x: v.x, y: chest(v), at: s.anim, r: 22, color: 0xf2cc5a });
        s.fx.chips(v.x, chest(v), v.img.displayWidth * 0.5, [WHITE, 0xfff0a0, 0xf2cc5a, 0x5ac850], 12, 0);
      }),
    );
  },
};

export const PART6B_SIGNATURES = { spiritStampede: SPIRIT_STAMPEDE, pebbleStorm: PEBBLE_STORM };
