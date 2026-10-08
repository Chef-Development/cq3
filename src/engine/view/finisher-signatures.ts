// Each hero's signature moment in their finisher show: the one beat that belongs to that hero alone, on top of their
// style's kit (view/finisher-kits.ts). Keyed by SignatureId (core/finisher-show.ts: HERO_SIGNATURE says whose is
// whose); the record is typed over every id, so a new one can't be left undrawn. A hero without their own plays their
// style's default (the second half of the record).
//   Rowan   whirlwind     he becomes a steel tornado that sweeps through every foe and bursts into a ring of blades
//   Sable   shadowLeap    she sinks into her shadow, it slides under the target, she bursts out of its shadow and
//                         twin fangs snap shut on it
//   Neve    glacierRise   frost creeps to the foes, a glacier rises behind them, surges up over them and shatters
//   Moss    greatTree     a seed flies over the foes, a great tree grows behind them, roots burst up and its canopy
//                         storms them with leaves
//   Tam     giantKeg      a keg bigger than she is, lobbed among the foes; its fuse burns down, it swells, and it
//                         goes off: the biggest blast, staves and hoops flying
//   Hollis  rampartWall   a wall of stone and steel rises before him, his banner on it, and topples onto the foes
//   Vesper  arrowSky      one arrow shot straight up bursts into a sky of arrows over the foes; they rain down; a
//                         giant golden arrow falls last in a column of light
//   Torva   earthSplit    a towering leap, a slam, the earth splits from her feet to the foes glowing with magma,
//                         and erupts under them in rock and fire
import type { SignatureId } from '../../core/finisher-show';
import { GAME_W } from '../layout';
import { clamp01, ease, INK, rand, WHITE, type EnemyView } from './shared';
import {
  centerOf,
  chest,
  crescent,
  ellipseLine,
  hash,
  hitFoe,
  inkLine,
  inkPoly,
  line,
  mark,
  outQuad,
  poly,
  showAt,
  spanOf,
  topOf,
  twinkle,
  type G,
  type MarkDraw,
  type ShowCtx,
} from './finisher-fx';
import { arrow, heaterShield, rockSpike, vine } from './finisher-kits';
import { PART6B_SIGNATURES } from './finisher-signatures-b';

/** Where the hero is and how they look at a moment of the show. */
export interface HeroMotion {
  x: number;
  /** Px off the ground. */
  lift: number;
  pose: string;
  flip: boolean;
  /** Not drawn (a tornado, a shadow stands in for them). */
  hidden: boolean;
  alpha: number;
}

export interface SignatureDraw {
  /** The hero's own way through the show: change the default motion (or return it as it is). */
  motion?(c: ShowCtx, k: number, def: HeroMotion): HeroMotion;
  /** At the show's start (its own beats are scheduled here). */
  start?(c: ShowCtx): void;
  /** On each strike of the flurry, on each target. */
  strike?(c: ShowCtx, v: EnemyView, i: number, of: number): void;
  /** At the last blow, once. */
  blow?(c: ShowCtx): void;
  /** Every frame behind the actors (over the sky). */
  back?(g: G, c: ShowCtx, k: number, now: number): void;
  /** Every frame over the actors. */
  front?(g: G, c: ShowCtx, k: number, now: number): void;
}

/** The nearest target (or none). */
const nearest = (c: ShowCtx): EnemyView | undefined => c.views.slice().sort((a, b) => a.homeX - b.homeX)[0];
/** 0..1 between two points of the show. */
const between = (k: number, a: number, b: number): number => clamp01((k - a) / Math.max(1e-6, b - a));

// ================================================================== Rowan: the whirlwind

const WHIRLWIND: SignatureDraw = {
  motion(c, k, def) {
    const tl = c.tl;
    const hidden = k > 0.06 && k < 0.94;
    if (k < tl.build || k >= tl.back) return { ...def, hidden };
    // the tornado sweeps back and forth through every foe
    const [lo, hi] = spanOf(c);
    const q = (k - tl.build) / (tl.back - tl.build);
    const passes = 1 + Math.floor(c.n / 2);
    const x = lo - 10 + (hi - lo + 14) * (0.5 - 0.5 * Math.cos(q * Math.PI * 2 * passes - Math.PI)) * (c.views.length > 1 ? 1 : 0.4);
    return { ...def, x: c.views.length ? x : def.x, hidden };
  },
  front(g, c, k, now) {
    if (k <= 0.06 || k >= 0.94) return;
    const h = c.heroAt();
    const cx = h.x + 2;
    const ground = c.s.ground;
    const grow = Math.min(1, (k - 0.06) / 0.1) * Math.min(1, (0.94 - k) / 0.08);
    const layers = Math.round((4 + c.n) * grow);
    const { light, base } = c.pal;
    // a tornado of steel: stacked spinning rings, wider at the top, blades glinting round it
    for (let arc = 0; arc < layers; arc++) {
      const spin = now / 30 + arc * 1.7;
      const r = 7 + arc * 4;
      const cy = ground - 4 - arc * 6;
      // an ink-dark streak under each ring (it reads on the pale steel sky), then its bright steel
      for (let j = 0; j < 18; j++) {
        const ang = spin + j * 0.17;
        g.fillStyle(0x1a2238, (1 - j / 20) * 0.8);
        g.fillRect(Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy + Math.sin(ang) * r * 0.35) - 1, 5, 4);
      }
      for (let j = 0; j < 18; j++) {
        const ang = spin + j * 0.17;
        g.fillStyle(j < 6 ? WHITE : j < 12 ? light : base, 1 - j / 20);
        g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.35), 3, 2);
      }
      // a blade riding the ring
      const ba = spin * 1.3 + arc;
      const bx = cx + Math.cos(ba) * (r + 2);
      const by = cy + Math.sin(ba) * (r + 2) * 0.35;
      line(g, bx - 3, by + 1, bx + 3, by - 1, 1, WHITE, Math.cos(ba) > 0 ? 1 : 0.4);
    }
    g.fillStyle(0xd8c8a0, 0.35 * grow);
    g.fillEllipse(Math.round(cx), ground - 1, 30, 5);
  },
  blow(c) {
    // the tornado bursts into a ring of blades flying out through the foes
    const h = c.heroAt();
    mark(c, 'bladeRing', { x: h.x + 2, y: c.s.ground - 18, r: 70 + c.n * 8, life: 340 });
    c.s.fx.ring(h.x + 2, c.s.ground - 18, 40, WHITE, true);
  },
};

// ================================================================== Sable: the leap from the shadows

const SHADOW_LEAP: SignatureDraw = {
  motion(c, k, def) {
    const tl = c.tl;
    const t = nearest(c);
    const tx = t ? t.homeX - 12 : c.toX;
    const sink = tl.build * 0.3;
    const rise = tl.build * 0.75;
    if (k < sink) return { ...def, x: c.heroX, lift: 0, pose: 'windup', hidden: false, alpha: 1 - between(k, 0, sink) };
    if (k < rise) return { ...def, x: c.heroX + (tx - c.heroX) * ease(between(k, sink, rise)), lift: 0, hidden: true, alpha: 0 };
    if (k < tl.build) {
      // out of the target's own shadow, up into the air
      const q = between(k, rise, tl.build);
      return { ...def, x: tx, lift: Math.sin(q * Math.PI * 0.5) * 26, pose: 'leap', hidden: false, alpha: Math.min(1, q * 3), flip: false };
    }
    if (k < tl.blow + 0.04) {
      const q = between(k, tl.build, tl.build + 0.12);
      return { ...def, x: tx, lift: 26 * (1 - ease(q)), pose: k >= tl.blow - 0.03 ? 'fang' : def.pose, hidden: false, alpha: 1, flip: false };
    }
    if (k < tl.back + 0.06) return { ...def, x: tx, lift: 0, hidden: true, alpha: 0 };
    // back out of her own shadow at home
    return { ...def, x: c.heroX, lift: 0, pose: 'idle0', flip: false, hidden: false, alpha: between(k, tl.back + 0.06, 1) };
  },
  back(g, c, k) {
    const tl = c.tl;
    const t = nearest(c);
    const tx = t ? t.homeX - 12 : c.toX;
    const ground = c.s.ground;
    const pool = (x: number, w: number, a: number) => {
      if (a <= 0.02 || w < 2) return;
      g.fillStyle(0x07040e, 0.85 * a);
      g.fillEllipse(Math.round(x), ground - 1, Math.round(w), 6);
      g.fillStyle(0x7a3cb0, 0.6 * a);
      g.fillEllipse(Math.round(x), ground - 2, Math.round(w * 0.8), 2);
      // wisps curling up off it
      for (let i = 0; i < 4; i++) {
        const wx = x - w / 3 + (i * w) / 6;
        const hgt = 4 + 4 * Math.sin(c.s.anim / 90 + i * 2);
        line(g, wx, ground - 2, wx + Math.sin(c.s.anim / 120 + i) * 2, ground - 2 - hgt, 1, 0xa86ae0, 0.6 * a);
      }
    };
    const sink = tl.build * 0.3;
    const rise = tl.build * 0.75;
    if (k < rise) pool(c.heroX + (tx - c.heroX) * ease(between(k, sink, rise)), 14 + 10 * between(k, 0, sink), 1);
    else if (k < tl.build + 0.08) pool(tx, 24, 1 - between(k, tl.build, tl.build + 0.08));
    if (k >= tl.blow + 0.04 && k < 1) {
      pool(tx, 20, 1 - between(k, tl.back + 0.06, 1));
      pool(c.heroX, 18, between(k, tl.blow + 0.04, tl.back + 0.06) * (1 - between(k, 0.95, 1)));
    }
  },
  start(c) {
    // shadow tendrils whip up out of the target's shadow as she rises
    const t = nearest(c);
    if (!t) return;
    c.s.later(c.tl.ms * c.tl.build * 0.75, () => {
      for (let i = 0; i < 5; i++) mark(c, 'tendril', { x: t.homeX - 12 + (i - 2) * 4, y: c.s.ground, r: 18 + (i % 3) * 8, dir: i % 2 ? 1 : -1, life: 260, seed: i });
    });
  },
  blow(c) {
    // the twin fangs: two great violet blades crossing on the target
    for (const v of c.views) mark(c, 'twinFang', { x: v.x, y: chest(v), r: Math.max(22, v.img.displayHeight * 0.8), life: 300 });
  },
};

// ================================================================== Neve: the glacier rising

/** The glacier's outline: a jagged ice mass from x0 to x1 standing on `ground`, `h` tall at its peaks. */
function glacierPts(x0: number, x1: number, ground: number, h: number, seed: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [[x0, ground]];
  const n = Math.max(4, Math.round((x1 - x0) / 9));
  for (let i = 0; i <= n; i++) {
    const q = i / n;
    const x = x0 + (x1 - x0) * q;
    const edge = Math.sin(q * Math.PI);
    const peak = i % 2 ? 0.55 + 0.45 * hash(i, seed) : 0.25 + 0.3 * hash(i + 50, seed);
    pts.push([x, ground - h * peak * (0.35 + 0.65 * edge)]);
  }
  pts.push([x1, ground]);
  return pts;
}

function drawGlacier(g: G, c: ShowCtx, h: number, a: number, overlay = false): void {
  if (h < 2) return;
  const [lo, hi] = spanOf(c);
  const x0 = lo - 26;
  const x1 = hi + 26;
  const ground = c.s.ground;
  const pts = glacierPts(x0, x1, ground, h, 7);
  if (overlay) {
    // the foes inside the ice: a pale wash with a hard rim
    poly(g, pts, 0xbff0ff, 0.42 * a);
    for (let i = 1; i < pts.length - 2; i++) line(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1, WHITE, a);
    return;
  }
  // deep ice (dark enough that the foes in front of it stay easy to see), lit faces, pale ridges
  inkPoly(g, pts, 0x1a4270, a);
  for (let i = 1; i < pts.length - 2; i += 2) {
    const [px, py] = pts[i + 1] ?? pts[i];
    poly(
      g,
      [
        [pts[i][0], pts[i][1]],
        [px, py],
        [px - 2, ground],
        [pts[i][0] - 4, ground],
      ],
      0x2a6496,
      a,
    );
    poly(
      g,
      [
        [pts[i][0] + 1, pts[i][1] + 2],
        [px - 1, py + 2],
        [(pts[i][0] + px) / 2, ground - (ground - py) * 0.4],
      ],
      0x4a90c0,
      a,
    );
    line(g, pts[i][0], pts[i][1], px, py, 1, 0xbff0ff, a);
    g.fillStyle(WHITE, a);
    g.fillRect(Math.round(pts[i][0]) - 1, Math.round(pts[i][1]), 2, 1);
  }
  twinkle(g, (x0 + x1) / 2 + 6, ground - h * 0.7, 3, 0xe0faff, a * (0.6 + 0.4 * Math.sin(c.s.anim / 120)));
}

const GLACIER_RISE: SignatureDraw = {
  back(g, c, k) {
    const tl = c.tl;
    const ground = c.s.ground;
    // frost creeping along the ground from her staff to the foes
    if (k < tl.blow + 0.1) {
      const [, hi] = spanOf(c);
      const reach = c.heroX + 8 + (hi + 26 - c.heroX - 8) * outQuad(between(k, 0.03, tl.build));
      const a = 1 - between(k, tl.blow, tl.blow + 0.1);
      for (let x = Math.round(c.heroX + 8); x < reach; x += 3) {
        g.fillStyle(x % 2 ? 0xe0faff : 0xbff0ff, 0.8 * a);
        g.fillRect(x, ground - 1 - (x % 3 === 0 ? 1 : 0), 3, 2);
        if (hash(x, 3) < 0.18) twinkle(g, x, ground - 3, 1, WHITE, a);
      }
    }
    // the glacier rises behind the foes through the flurry, then sinks away after it shatters
    const rise = outQuad(between(k, tl.build, tl.blow));
    const sink = between(k, tl.blow + 0.05, 1);
    if (rise > 0 && sink < 1) drawGlacier(g, c, (34 + c.n * 4) * rise * (1 - sink), 1 - sink);
  },
  front(g, c, k) {
    const tl = c.tl;
    // the surge: the ice swallows the foes for a moment at the last blow
    if (k >= tl.blow && k < tl.blow + 0.06) drawGlacier(g, c, 48 + c.n * 4, 1 - between(k, tl.blow + 0.03, tl.blow + 0.06), true);
  },
  blow(c) {
    const s = c.s;
    const [lo, hi] = spanOf(c);
    for (let i = 0; i < 10 + c.n * 2; i++) {
      const x = lo - 20 + hash(i, 61) * (hi - lo + 40);
      mark(c, 'shard', { x, y: s.ground - 10 - hash(i, 62) * 30, x1: (hash(i, 63) - 0.5) * 120, y1: -60 - hash(i, 64) * 80, r: 3 + (i % 3), life: 520, seed: i });
    }
    s.fx.shock((lo + hi) / 2, s.ground, 80, 0xbff0ff);
  },
};

// ================================================================== Moss: the great tree

/** The tree's root: where it grows (behind the foes). */
const treeX = (c: ShowCtx): number => Math.min(GAME_W - 30, spanOf(c)[1] + 14);

function drawTree(g: G, c: ShowCtx, grow: number, shake: number, now: number, a = 1): void {
  if (grow <= 0) return;
  const ground = c.s.ground;
  const x = treeX(c);
  const H = 64 * grow; // (its crown clear of the foe plate at the top right)
  const w = Math.max(3, 14 * Math.min(1, grow * 1.4));
  // roots spreading toward the foes
  const reach = 70 * grow;
  for (let i = 0; i < 4; i++) {
    const dir = i < 3 ? -1 : 1;
    const len = (i < 3 ? reach * (0.5 + i * 0.25) : 18 * grow);
    let px = x;
    let py = ground - 1;
    for (let d = 2; d <= len; d += 2) {
      const nx = x + dir * d;
      const ny = ground - 1 + Math.round(Math.sin(d / 7 + i) * 1.5);
      inkLine(g, px, py, nx, ny, d < len * 0.5 ? 2 : 1, 0x6e4020, a);
      px = nx;
      py = ny;
    }
  }
  // the trunk: bark lit from the left, dark grooves
  const sway = shake * Math.sin(now / 30);
  const top = ground - H;
  inkPoly(
    g,
    [
      [x - w / 2 - 3, ground],
      [x - w / 3 + sway * 0.3, top + H * 0.25],
      [x + sway, top],
      [x + w / 3 + sway * 0.3, top + H * 0.25],
      [x + w / 2 + 3, ground],
    ],
    0x6e4020,
    a,
  );
  poly(
    g,
    [
      [x - w / 2 - 2, ground],
      [x - w / 3 + sway * 0.3 + 1, top + H * 0.25],
      [x + sway, top + 2],
      [x - 1, ground],
    ],
    0x8e5a2e,
    a,
  );
  for (let i = 0; i < 4; i++) line(g, x - w / 4 + i * 3, ground - 3, x - w / 5 + i * 2 + sway * 0.2, ground - H * (0.35 + 0.1 * i), 1, 0x4e2c16, a);
  // branches and the canopy: scalloped clumps of leaves, lit from the top left
  const canopy = between(grow, 0.35, 1);
  if (canopy <= 0) return;
  const cy = top + 8;
  const R = 34 * canopy;
  const clumps: Array<[number, number, number]> = [
    [-0.8, 0.25, 0.55],
    [0.8, 0.3, 0.55],
    [-0.4, -0.25, 0.65],
    [0.45, -0.2, 0.6],
    [0, 0.05, 0.75],
    [0, -0.5, 0.5],
  ];
  line(g, x + sway, top + 14, x - R * 0.7 + sway, cy + R * 0.2, 2, 0x4e2c16, a);
  line(g, x + sway, top + 16, x + R * 0.7 + sway, cy + R * 0.25, 2, 0x4e2c16, a);
  for (const [dx, dy, rk] of clumps) {
    const px = Math.round(x + dx * R + sway * 1.4);
    const py = Math.round(cy + dy * R);
    const r = Math.max(2, Math.round(R * rk * 0.6));
    g.fillStyle(INK, a);
    g.fillCircle(px, py, r + 1);
  }
  for (const [dx, dy, rk] of clumps) {
    const px = Math.round(x + dx * R + sway * 1.4);
    const py = Math.round(cy + dy * R);
    const r = Math.max(2, Math.round(R * rk * 0.6));
    g.fillStyle(0x2e5a32, a);
    g.fillCircle(px, py, r);
    g.fillStyle(0x4a7e36, a);
    g.fillCircle(px - Math.ceil(r / 4), py - Math.ceil(r / 4), Math.max(1, Math.round(r * 0.75)));
    g.fillStyle(0x78a83c, a);
    g.fillCircle(px - Math.ceil(r / 2.5), py - Math.ceil(r / 2.5), Math.max(1, Math.round(r * 0.4)));
  }
  // glowing seeds in the leaves
  for (let i = 0; i < 6; i++) {
    const a = 0.5 + 0.5 * Math.sin(now / 200 + i * 1.3);
    twinkle(g, x + (hash(i, 71) - 0.5) * R * 1.4 + sway, cy + (hash(i, 72) - 0.5) * R * 0.8, 1, 0xf0ffd0, a * canopy);
  }
}

const GREAT_TREE: SignatureDraw = {
  start(c) {
    // a glowing seed flies from his staff over the foes and drops behind them
    const h = c.heroAt();
    mark(c, 'seed', { x: h.x + 8, y: c.s.ground - 30, x1: treeX(c), y1: c.s.ground - 2, life: c.tl.ms * c.tl.build * 0.6 });
  },
  back(g, c, k, now) {
    const tl = c.tl;
    const grow = outQuad(between(k, tl.build * 0.6, tl.blow));
    const fade = between(k, 0.88, 1);
    if (fade >= 1) return;
    const shake = k >= tl.blow && k < tl.blow + 0.08 ? 2 : 0;
    // (it fades out with the sky)
    drawTree(g, c, grow, shake, now, 1 - fade);
  },
  front(g, c, k, now) {
    const tl = c.tl;
    // the leaf storm over the foes after the last blow
    if (k < tl.blow || k >= 1) return;
    const q = between(k, tl.blow, 1);
    const [lo, hi] = spanOf(c);
    for (let i = 0; i < 28 + c.n * 4; i++) {
      const x0 = lo - 30 + hash(i, 81) * (hi - lo + 60);
      const x = Math.round(x0 + Math.sin(now / 90 + i) * 8 + q * 40 * (hash(i, 82) - 0.3));
      const y = Math.round(c.s.ground - 70 + q * 60 * (0.4 + hash(i, 83)) + Math.cos(now / 70 + i) * 4);
      g.fillStyle(i % 4 === 0 ? 0xff9ac0 : i % 2 ? 0x78a83c : 0xb4d058, 1 - q * 0.8);
      g.fillRect(x, y, i % 3 ? 3 : 2, i % 3 ? 2 : 3);
    }
  },
  blow(c) {
    const s = c.s;
    // roots burst up round every foe
    for (const v of c.views) mark(c, 'roots', { x: v.x, y: s.ground, r: Math.max(14, v.img.displayHeight * 0.7), life: 480, seed: v.id });
    s.fx.shock(treeX(c), s.ground, 70, 0xb4f070);
  },
};

// ================================================================== Tam: the giant keg

/** Where the giant keg lands: among the foes, just behind them (they stay in front of it). */
const kegX = (c: ShowCtx): number => {
  const t = nearest(c);
  if (!t) return c.heroX + 90;
  return c.views.length > 1 ? centerOf(c) + 3 : t.homeX + 14;
};

function giantKeg(g: G, cx: number, cy: number, r: number, now: number, fuse: number, swell = 0): void {
  const rx = Math.round(r * (1 + swell * 0.12));
  const ry = Math.round(r * (1 - swell * 0.08));
  const X = Math.round(cx);
  const Y = Math.round(cy);
  g.fillStyle(0xff9a3a, 0.25 + swell * 0.3);
  g.fillEllipse(X, Y, rx * 2 + 10, ry * 2 + 10);
  g.fillStyle(INK, 1);
  g.fillEllipse(X, Y, rx * 2 + 2, ry * 2 + 2);
  g.fillStyle(0x2a2630, 1);
  g.fillEllipse(X, Y, rx * 2, ry * 2);
  g.fillStyle(0x3a3444, 1);
  g.fillEllipse(X - 2, Y - 2, rx * 2 - 6, ry * 2 - 6);
  g.fillStyle(0x5a5466, 1);
  g.fillEllipse(X - 4, Y - 5, Math.round(rx * 0.7), Math.round(ry * 0.5));
  // two copper hoops and the staves between them
  for (const dy of [-Math.round(ry * 0.45), Math.round(ry * 0.4)]) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * rx);
    g.fillStyle(0x6a3a1a, 1);
    g.fillRect(X - half, Y + dy + 1, half * 2, 2);
    g.fillStyle(0xd8904a, 1);
    g.fillRect(X - half, Y + dy, half * 2, 2);
    g.fillStyle(0xffd0a0, 1);
    g.fillRect(X - half + 2, Y + dy, 3, 1);
  }
  g.fillStyle(0x1a1620, 1);
  for (let i = -1; i <= 1; i++) g.fillRect(X + i * Math.round(rx / 2.2), Y - ry + 3, 1, ry * 2 - 6);
  g.fillStyle(WHITE, 0.9);
  g.fillRect(X - rx + 4, Y - Math.round(ry / 2), 2, 3);
  // the fuse: burning down as `fuse` goes 1 -> 0
  const top = Y - ry;
  const len = Math.round(12 * fuse);
  g.fillStyle(INK, 1);
  g.fillRect(X - 2, top - 3, 5, 4);
  g.fillStyle(0xd8904a, 1);
  g.fillRect(X - 1, top - 2, 3, 1);
  for (let i = 0; i < len; i++) {
    const fx = X + 1 + Math.round(Math.sin(i / 3) * 2);
    g.fillStyle(INK, 1);
    g.fillRect(fx - 1, top - 3 - i, 3, 1);
    g.fillStyle(0xd8b080, 1);
    g.fillRect(fx, top - 3 - i, 1, 1);
  }
  const sx = X + 1 + Math.round(Math.sin(len / 3) * 2);
  const sy = top - 3 - len;
  const fl = Math.floor(now / 40) % 3;
  g.fillStyle(0xff7a2a, 1);
  g.fillRect(sx - 2, sy - 2, 5, 5);
  g.fillStyle(0xffe080, 1);
  g.fillRect(sx - 1 + (fl === 1 ? 1 : 0), sy - 1, 3, 3);
  g.fillStyle(WHITE, 1);
  g.fillRect(sx, sy, 1, 1);
  for (let i = 0; i < 4; i++) {
    const ang = now / 60 + i * 1.6;
    g.fillStyle(i % 2 ? 0xffe080 : 0xff9a3a, 1);
    g.fillRect(Math.round(sx + Math.cos(ang) * (3 + fl)), Math.round(sy + Math.sin(ang) * (3 + fl)), 1, 1);
  }
}

const KEG_R = 13;

const GIANT_KEG: SignatureDraw = {
  motion(c, k, def) {
    // the big throw: wound up, then the follow-through
    return { ...def, pose: k < c.tl.build * 0.25 ? 'cast' : def.pose };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const ground = c.s.ground;
    const land = tl.build * 0.85;
    const tx = kegX(c);
    if (k < tl.build * 0.2 || k >= land) return;
    // lobbed high over the foes
    const q = between(k, tl.build * 0.2, land);
    const x0 = c.heroX + 8;
    const x = x0 + (tx - x0) * q;
    const y0 = ground - 30;
    const y = y0 + (ground - KEG_R - 1 - y0) * q - Math.sin(q * Math.PI) * 50;
    giantKeg(g, x, y, KEG_R * (0.7 + 0.3 * q), now, 1);
  },
  back(g, c, k, now) {
    const tl = c.tl;
    const ground = c.s.ground;
    const land = tl.build * 0.85;
    const tx = kegX(c);
    if (k < land || k >= tl.blow) return;
    // landed among the foes: the fuse burns down, it swells faster and faster
    const q = between(k, land, tl.blow);
    const swell = q > 0.5 ? 0.5 + 0.5 * Math.sin(now / (60 - 40 * q)) : 0;
    giantKeg(g, tx, ground - KEG_R - 1, KEG_R, now, 1 - q, swell * q);
    if (Math.floor(now / 90) % 2 === 0) {
      g.fillStyle(0x8a8494, 0.4);
      g.fillCircle(Math.round(tx + 3), Math.round(ground - KEG_R * 2 - 16 - q * 4), 3);
    }
  },
  start(c) {
    const s = c.s;
    // it lands with a thump
    s.later(c.tl.ms * c.tl.build * 0.85, () => {
      s.fx.dust(kegX(c), s.ground, 8, 0, 1.2);
      s.fx.shock(kegX(c), s.ground, 26, 0xe8dcc0);
      s.fx.kick(3, 90);
    });
  },
  blow(c) {
    const s = c.s;
    const x = kegX(c);
    const y = s.ground - KEG_R - 1;
    mark(c, 'megaBlast', { x, y, r: 34 + c.n * 4, life: 640, seed: 5 });
    // staves and hoops flying
    for (let i = 0; i < 10; i++) s.fx.debris.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-160, 200), vy: -rand(120, 260), color: i % 3 === 0 ? 0xd8904a : i % 2 ? 0x3a3444 : 0x5a5466, born: s.anim, life: rand(600, 1000), bounces: 0, floor: s.ground + Math.round(rand(-1, 3)), size: 2 });
    s.fx.shock(x, s.ground, 90, 0xffd060);
    s.fx.dust(x, s.ground, 14, 0, 1.8);
  },
};

// ================================================================== Hollis: the rampart wall

/** Where the wall stands: just ahead of him. */
const wallX = (c: ShowCtx): number => c.toX + 22;

/** The wall standing (h tall), or toppling forward by `fall` (0 upright .. 1 flat on the foes). */
function drawWall(g: G, c: ShowCtx, h: number, fall: number, a: number): void {
  if (h < 2) return;
  const x = wallX(c);
  const ground = c.s.ground;
  const th = 16;
  const ang = fall * Math.PI * 0.5;
  // the wall's corners rotate about its far-side foot
  const px = x + th;
  const rot = (dx: number, dy: number): [number, number] => [px + dx * Math.cos(ang) - dy * Math.sin(ang), ground + dx * Math.sin(ang) + dy * Math.cos(ang)];
  const quad = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => [rot(x0, y0), rot(x1, y0), rot(x1, y1), rot(x0, y1)];
  // its face: stone courses, a steel cap, a blue banner with the white tower
  inkPoly(g, quad(-th, -h, 0, 0), 0x7c86a6, a);
  const courses = Math.max(1, Math.floor(h / 6));
  for (let i = 0; i < courses; i++) {
    const y0 = -i * 6 - 1;
    const off = i % 2 ? -th / 2 : 0;
    poly(g, quad(-th + 1, y0 - 5, -1, y0), i % 2 ? 0x6a7090 : 0x7c86a6, a);
    const [lx0, ly0] = rot(-th + 1, y0 - 5);
    const [lx1, ly1] = rot(-1, y0 - 5);
    line(g, lx0, ly0, lx1, ly1, 1, 0x4a5272, a);
    const [jx0, jy0] = rot(-th / 2 + off + 2, y0 - 5);
    const [jx1, jy1] = rot(-th / 2 + off + 2, y0);
    line(g, jx0, jy0, jx1, jy1, 1, 0x4a5272, a);
  }
  // the lit edge facing him, the steel cap
  const [ex0, ey0] = rot(-th, -h);
  const [ex1, ey1] = rot(-th, 0);
  line(g, ex0, ey0, ex1, ey1, 1, 0xb8c2d8, a);
  // the battlements: a lip of pale stone and two merlons
  inkPoly(g, quad(-th - 1, -h - 2, 1, -h), 0xb8c2d8, a);
  if (h > 12) {
    inkPoly(g, quad(-th - 1, -h - 7, -th + 5, -h - 2), 0x9aa4c0, a);
    inkPoly(g, quad(-5, -h - 7, 1, -h - 2), 0x9aa4c0, a);
  }
  if (h > 20) {
    poly(g, quad(-th + 3, -h + 4, -3, -h + 24), 0x2a5ac0, a);
    const [bx, by] = rot(-th / 2, -h + 12);
    if (fall < 0.3) heaterShield(g, bx, by, 6, 8, a);
  }
}

const RAMPART_WALL: SignatureDraw = {
  back(g, c, k) {
    const tl = c.tl;
    if (k >= tl.blow - 0.08) return;
    const rise = outQuad(between(k, tl.build * 0.5, tl.build + 0.12));
    drawWall(g, c, wallH(c) * rise, 0, 1);
  },
  front(g, c, k) {
    const tl = c.tl;
    if (k < tl.blow - 0.08 || k >= 1) return;
    // it topples onto the foes (landing on the last blow), then crumbles away
    const q = between(k, tl.blow - 0.08, tl.blow);
    const fall = q * q;
    const a = 1 - between(k, tl.blow + 0.1, 0.99);
    drawWall(g, c, wallH(c), fall, a);
  },
  start(c) {
    const s = c.s;
    s.later(c.tl.ms * c.tl.build * 0.5, () => {
      s.fx.dust(wallX(c), s.ground, 6, 1, 1);
      s.fx.rubble(wallX(c), s.ground, 5, 0.8);
    });
  },
  blow(c) {
    const s = c.s;
    const x0 = wallX(c) + 10;
    const x1 = x0 + wallH(c);
    for (let x = x0; x <= x1; x += 14) {
      s.fx.dust(x, s.ground, 3, 0, 1.4);
      s.fx.rubble(x, s.ground, 2, 1);
    }
    s.fx.shock((x0 + x1) / 2, s.ground, 90, 0xeef3fa);
    s.later(90, () => s.fx.shock((x0 + x1) / 2, s.ground, 70, 0xf2c230));
  },
};

/** The wall: tall (taller with the stacks), and always long enough to land on the farthest foe when it falls. */
function wallH(c: ShowCtx): number {
  const [, hi] = spanOf(c);
  return Math.max(46 + 4 * c.n, Math.min(84, hi + 6 - wallX(c) - 16));
}

// ================================================================== Vesper: the sky of arrows

/** The hanging arrows: a loose grid over the foes, each with the strike it falls on. */
function skyArrows(c: ShowCtx): Array<{ x: number; y: number; at: number }> {
  const [lo, hi] = spanOf(c);
  const cols = 6 + c.n;
  const out: Array<{ x: number; y: number; at: number }> = [];
  for (let i = 0; i < cols * 2; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = lo - 22 + ((hi - lo + 44) * (col + 0.5 + (row ? 0.5 : 0) * 0.5)) / cols + (hash(i, 91) - 0.5) * 4;
    const y = 12 + row * 12 + hash(i, 92) * 5;
    const at = c.tl.strikes[Math.min(c.tl.strikes.length - 1, Math.floor(hash(i, 93) * c.tl.strikes.length))];
    out.push({ x, y, at });
  }
  return out;
}

const ARROW_SKY: SignatureDraw = {
  motion(c, k, def) {
    // aiming straight up for the first arrow
    return { ...def, pose: k < c.tl.build * 0.35 ? 'cast' : def.pose };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const ground = c.s.ground;
    const h = c.heroAt();
    // the one arrow, straight up
    const up = between(k, 0.02, tl.build * 0.35);
    if (up > 0 && up < 1) {
      const y = ground - 30 - up * (ground - 40);
      line(g, h.x + 8, ground - 30, h.x + 8, y + 6, 1, 0xf2c230, 0.6);
      arrow(g, h.x + 8, y, -Math.PI / 2, 9, 0xd8dce8);
    }
    const burst = tl.build * 0.35;
    if (k < burst || k >= tl.blow + 0.12) return;
    if (k < burst + 0.05) {
      const q = between(k, burst, burst + 0.05);
      ellipseLine(g, h.x + 8, 12, 6 + q * 30, 4 + q * 12, 2, 0xfff0a0, 1 - q);
    }
    // the sky of arrows: they appear, hang glinting, and drop each on its strike
    const list = skyArrows(c);
    list.forEach((ar, i) => {
      const appear = between(k, burst + (i / list.length) * (tl.build - burst) * 0.8, burst + 0.04 + (i / list.length) * (tl.build - burst) * 0.8);
      if (appear <= 0) return;
      const fall = between(k, ar.at, ar.at + 0.05);
      if (fall >= 1) return;
      const y = ar.y + fall * (ground - 6 - ar.y);
      const glint = Math.sin(now / 90 + i) > 0.85;
      arrow(g, ar.x, y + 9, Math.PI / 2, 9, glint ? WHITE : 0xd8dce8, appear);
      if (fall > 0) line(g, ar.x, y - 8, ar.x, y, 1, 0xfff0a0, 0.5);
    });
    // the giant golden arrow, dropping in its column of light
    const gq = between(k, tl.blow - 0.04, tl.blow);
    if (gq > 0) {
      const cx = centerOf(c);
      const col = 1 - between(k, tl.blow, tl.blow + 0.12);
      g.fillStyle(0xfff0a0, 0.25 * col);
      g.fillRect(Math.round(cx - 9), 0, 18, ground);
      g.fillStyle(WHITE, 0.3 * col);
      g.fillRect(Math.round(cx - 3), 0, 6, ground);
      if (k < tl.blow) {
        const y = 4 + gq * (ground - 30);
        line(g, cx, y - 30, cx, y, 5, INK, 1);
        line(g, cx, y - 30, cx, y, 3, 0xf2c230, 1);
        inkPoly(
          g,
          [
            [cx, y + 9],
            [cx - 6, y - 1],
            [cx + 6, y - 1],
          ],
          0xfff0a0,
          1,
        );
      }
    }
  },
  strike(c, v, i) {
    // arrows from the sky strike it too
    if (i % 2) return;
    c.s.fx.sparks.push({ x: v.x + rand(-8, 8), y: topOf(v) + 4, at: c.s.anim, size: 6, color: 0xfff0a0 });
    hitFoe(c, v, 2);
  },
  blow(c) {
    const s = c.s;
    const cx = centerOf(c);
    s.fx.stars.push({ x: cx, y: s.ground - 20, at: s.anim, r: 40, color: 0xf2c230 });
    s.fx.shock(cx, s.ground, 80, 0xfff0a0);
    s.fx.flashes.push({ x: cx, y: s.ground - 20, r: 26, at: s.anim });
  },
};

// ================================================================== Torva: the earth split

/** The fissure's path along the ground from her landing to past the farthest foe. */
function fissure(c: ShowCtx): { x0: number; x1: number } {
  const [, hi] = spanOf(c);
  return { x0: c.toX + 10, x1: hi + 18 };
}

/** The fissure's two lips now (top and bottom points every 3 px), and how open it is. */
function fissureLips(c: ShowCtx, k: number): { top: Array<[number, number]>; bot: Array<[number, number]>; wide: number; a: number; x0: number; end: number } {
  const tl = c.tl;
  const ground = c.s.ground;
  const { x0, x1 } = fissure(c);
  const run = outQuad(between(k, tl.build, tl.build + (tl.blow - tl.build) * 0.35));
  const wide = between(k, tl.build, tl.blow);
  const close = between(k, tl.blow + 0.06, 1);
  const end = x0 + (x1 - x0) * run;
  const top: Array<[number, number]> = [];
  const bot: Array<[number, number]> = [];
  for (let x = x0; x <= end; x += 3) {
    const q = (x - x0) / Math.max(1, x1 - x0);
    const w = (2 + 3 * wide) * (1 - q * 0.35) * (1 - close);
    const y = ground - 1 + Math.round((hash(x, 101) - 0.5) * 4);
    top.push([x, y - w]);
    bot.push([x, y + w * 0.6 + 1]);
  }
  return { top, bot, wide, a: 1 - close, x0, end };
}

const EARTH_SPLIT: SignatureDraw = {
  motion(c, k, def) {
    // a towering leap (the default arc, higher)
    if (k < c.tl.build) return { ...def, lift: def.lift * 1.4 };
    return def;
  },
  back(g, c, k, now) {
    const tl = c.tl;
    if (k < tl.build) return;
    const ground = c.s.ground;
    // a jagged crack in the ground, wider the longer it runs (its glowing heart is drawn over the actors: front)
    const { top, bot, wide, a, x0, end } = fissureLips(c, k);
    if (top.length > 1) {
      for (let i = 0; i < top.length - 1; i++) line(g, top[i][0], top[i][1] - 1, top[i + 1][0], top[i + 1][1] - 1, 1, 0x140c1c, a);
      poly(g, [...top, ...bot.slice().reverse()], 0x2a0e08, a);
    }
    // lava spitting out of it
    for (let i = 0; i < 6 + c.n * 2; i++) {
      const life = 380;
      const q = ((now + hash(i, 103) * life) % life) / life;
      const sx = x0 + hash(i, 104) * (end - x0);
      const sy = ground - 2 - Math.sin(q * Math.PI) * (8 + 10 * hash(i, 105)) * wide;
      g.fillStyle(i % 2 ? 0xff7a2a : 0xffd060, a * (1 - q));
      g.fillRect(Math.round(sx), Math.round(sy), 1 + (i % 2), 1 + (i % 2));
    }
  },
  front(g, c, k, now) {
    if (k < c.tl.build) return;
    // the magma in the crack: a white-hot heart, its heat glowing up off the ground
    const { top, bot, wide, a } = fissureLips(c, k);
    for (let i = 0; i < top.length - 1; i++) {
      const glow = 0.75 + 0.25 * Math.sin(now / 80 + i);
      const my0 = (top[i][1] + bot[i][1]) / 2;
      const my1 = (top[i + 1][1] + bot[i + 1][1]) / 2;
      g.fillStyle(0xff7a2a, 0.22 * a * glow);
      g.fillRect(Math.round(top[i][0]), Math.round(my0 - 4 - 4 * wide), 3, Math.round(3 + 4 * wide));
      g.fillStyle(0xffa040, 0.14 * a * glow);
      g.fillRect(Math.round(top[i][0]), Math.round(my0 - 9 - 6 * wide), 3, Math.round(5 + 3 * wide));
      line(g, top[i][0], my0, top[i + 1][0], my1, wide > 0.4 ? 2 : 1, i % 3 ? 0xff7a2a : 0xffd060, a * glow);
      if (i % 3 === 1) line(g, top[i][0], my0, top[i][0] + 1, my0, 1, 0xfff0c0, a);
    }
  },
  start(c) {
    const s = c.s;
    // the slam on landing
    s.later(c.tl.ms * c.tl.build, () => {
      const x = c.toX + 14;
      s.fx.shock(x, s.ground, 70, 0xffd890);
      s.fx.rubble(x, s.ground, 14, 1.4);
      s.fx.dust(x, s.ground, 5, 0, 1.2);
      s.fx.shake(4, 260);
      s.fx.flashes.push({ x, y: s.ground - 4, r: 16, at: s.anim });
    });
  },
  blow(c) {
    const s = c.s;
    for (const v of c.views) {
      mark(c, 'eruption', { x: v.x, y: s.ground, r: Math.max(26, v.img.displayHeight * 0.9), life: 700, seed: v.id });
      s.fx.rubble(v.x, s.ground, 10, 1.6);
    }
    s.fx.shake(6, 380);
  },
};

// ================================================================== the styles' defaults (a hero with no moment yet)

const CROSS_CUT: SignatureDraw = {
  blow(c) {
    const [lo, hi] = spanOf(c);
    mark(c, 'crossCut', { x: lo - 20, y: c.s.ground - 60, x1: hi + 20, y1: c.s.ground - 6, life: 360 });
  },
};

const RIFT: SignatureDraw = {
  start(c) {
    const cx = centerOf(c);
    mark(c, 'rift', { x: cx + 6, y: c.s.ground - 34, r: 60, life: c.tl.ms * (1 - c.tl.build) + 120, at: showAt(c, c.tl.build), sky: true, seed: 11 });
  },
};

const SHIELD_DOME: SignatureDraw = {
  front(g, c, k) {
    const tl = c.tl;
    if (k >= tl.blow) return;
    const h = c.heroAt();
    const grow = outQuad(between(k, 0.04, tl.build));
    const r = 22 * grow;
    if (r < 2) return;
    g.fillStyle(0x9ad8ff, 0.14);
    g.fillEllipse(Math.round(h.x + 2), c.s.ground, Math.round(r * 2), Math.round(r * 1.6));
    g.lineStyle(1, 0xeef3fa, 0.8);
    g.beginPath();
    g.arc(Math.round(h.x + 2), c.s.ground, Math.round(r), Math.PI, Math.PI * 2, false);
    g.strokePath();
  },
  blow(c) {
    const h = c.heroAt();
    mark(c, 'dome', { x: h.x + 2, y: c.s.ground, r: 120, life: 420 });
  },
};

const LOCK_ON: SignatureDraw = {
  front(g, c, k) {
    const tl = c.tl;
    if (k >= tl.blow) return;
    const cx = centerOf(c);
    const r = 60 - 40 * outQuad(between(k, 0, tl.build));
    ellipseLine(g, cx, c.s.ground - 22, r, r * 0.8, 1, 0xfff0a0, 0.7);
  },
};

const GROUND_SLAM: SignatureDraw = {
  start(c) {
    const s = c.s;
    s.later(c.tl.ms * c.tl.build, () => {
      const x = c.toX + 14;
      s.fx.shock(x, s.ground, 70, 0xffd890);
      s.fx.rubble(x, s.ground, 12, 1.3);
      s.fx.dust(x, s.ground, 10, 0, 1.3);
      s.fx.shake(4, 240);
    });
  },
};

const ICE_SPIKES: SignatureDraw = {
  blow(c) {
    const [lo, hi] = spanOf(c);
    for (let i = 0; i < 7; i++) mark(c, 'spike', { x: lo - 16 + ((hi - lo + 32) * i) / 6, y: c.s.ground, r: 26 + (i % 3) * 8, life: 420, seed: i });
  },
};

const SPIRIT_SWARM: SignatureDraw = {
  front(g, c, k, now) {
    const tl = c.tl;
    if (k >= tl.build) return;
    const h = c.heroAt();
    for (let i = 0; i < 6; i++) {
      const ang = now / 180 + (i * Math.PI) / 3;
      const x = h.x + 2 + Math.cos(ang) * 16;
      const y = c.s.ground - 20 + Math.sin(ang) * 8;
      g.fillStyle(0xd0ff90, 0.35);
      g.fillCircle(Math.round(x), Math.round(y), 3);
      g.fillStyle(0xf0ffd0, 1);
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  },
};

const BARRAGE: SignatureDraw = {
  start(c) {
    const [lo, hi] = spanOf(c);
    for (let i = 0; i < 6; i++) {
      const tx = lo - 10 + ((hi - lo + 20) * i) / 5;
      mark(c, 'bomb', { x: -10 - i * 8, y: 30, x1: tx, y1: c.s.ground - 6, r: 30, at: c.s.anim + i * 40, life: c.tl.ms * c.tl.build * 0.8, seed: i });
    }
  },
};

/** Every signature moment's drawing (typed over every SignatureId: a new one can't be left out). */
export const SIGNATURE_DRAW: Record<SignatureId, SignatureDraw> = {
  whirlwind: WHIRLWIND,
  shadowLeap: SHADOW_LEAP,
  glacierRise: GLACIER_RISE,
  greatTree: GREAT_TREE,
  giantKeg: GIANT_KEG,
  rampartWall: RAMPART_WALL,
  arrowSky: ARROW_SKY,
  earthSplit: EARTH_SPLIT,
  // part6:A
  // part6:B
  spiritStampede: PART6B_SIGNATURES.spiritStampede,
  pebbleStorm: PART6B_SIGNATURES.pebbleStorm,
  // part6:C
  // part6:D
  crossCut: CROSS_CUT,
  rift: RIFT,
  shieldDome: SHIELD_DOME,
  lockOn: LOCK_ON,
  groundSlam: GROUND_SLAM,
  iceSpikes: ICE_SPIKES,
  spiritSwarm: SPIRIT_SWARM,
  barrage: BARRAGE,
};

// ------------------------------------------------------------------ the signatures' own marks

export const SIG_MARKS: Record<string, MarkDraw> = {
  // Rowan: blades flying out of the tornado's burst
  bladeRing(g, m, k) {
    const r = m.r * ease(k);
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + k * 2;
      const x = m.x + Math.cos(ang) * r;
      const y = m.y + Math.sin(ang) * r * 0.45;
      crescent(g, x, y, 7, 3, ang - 1.2, 2.2, 0.8, { body: 0xb8c2d8, light: 0xeef3fa, rim: 0x2a2f45 }, a);
    }
  },
  // Sable: tendrils of shadow whipping up out of the ground
  tendril(g, m, k) {
    const h = m.r * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.6) / 0.4);
    let px = m.x;
    let py = m.y;
    for (let d = 2; d <= h; d += 2) {
      const x = m.x + Math.sin(d / 5 + m.seed) * 3 * m.dir;
      const y = m.y - d;
      line(g, px, py, x, y, d < h * 0.5 ? 2 : 1, d % 4 ? 0x2a1440 : 0x7a3cb0, 1);
      px = x;
      py = y;
    }
  },
  // Sable: two great violet blades crossing on the target
  twinFang(g, m, k) {
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const sweep = ease(clamp01(k * 3));
    const cols = { body: 0x7a3cb0, light: 0xdab0ff, rim: 0x07040e };
    crescent(g, m.x - 4, m.y, m.r, 9, -Math.PI * 0.9, Math.PI * 0.9 * sweep + 0.2, 0.75, cols, a);
    crescent(g, m.x + 4, m.y, m.r, 9, Math.PI * 0.1, Math.PI * 0.9 * sweep + 0.2, 0.75, cols, a);
  },
  // Neve: shards of the shattered glacier flying
  shard(g, m, k) {
    const t = k * (m.life / 1000);
    const x = m.x + m.x1 * t;
    const y = m.y + m.y1 * t + 0.5 * 420 * t * t;
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    const r = m.r;
    inkPoly(
      g,
      [
        [x, y - r * 1.4],
        [x + r, y],
        [x, y + r * 1.4],
        [x - r, y],
      ],
      m.seed % 2 ? 0xbff0ff : 0x6ad0f0,
      a,
    );
    g.fillStyle(WHITE, a);
    g.fillRect(Math.round(x) - 1, Math.round(y - r), 1, Math.max(1, Math.round(r)));
  },
  // Moss: the seed arcing over the foes
  seed(g, m, k) {
    if (k >= 1) return;
    const x = m.x + (m.x1 - m.x) * k;
    const y = m.y + (m.y1 - m.y) * k - Math.sin(k * Math.PI) * 40;
    g.fillStyle(0xd0ff90, 0.35);
    g.fillCircle(Math.round(x), Math.round(y), 5);
    g.fillStyle(INK, 1);
    g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
    g.fillStyle(0xc8a050, 1);
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    g.fillStyle(0xf0ffd0, 1);
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
  },
  // Moss: roots bursting up round a foe
  roots(g, m, k) {
    const grow = ease(clamp01(k / 0.25));
    const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    for (let i = 0; i < 3; i++) {
      const bx = m.x - 12 + i * 12;
      vine(g, bx, m.y, bx + (i - 1) * 4, m.y - m.r * (0.7 + 0.3 * hash(i, m.seed)), grow, i + m.seed, a);
    }
  },
  // Tam: the giant keg goes off
  megaBlast(g, m, k) {
    const R = m.r;
    if (k < 0.34) {
      const e = ease(clamp01(k / 0.1));
      const cool = clamp01((k - 0.1) / 0.24);
      const flick = 1 + 0.06 * Math.sin(k * 120);
      g.fillStyle(cool > 0.5 ? 0x8a3a1a : 0xff5a1a, 0.9);
      g.fillCircle(Math.round(m.x), Math.round(m.y), Math.round(R * e * flick));
      g.fillStyle(cool > 0.6 ? 0xff7a2a : 0xffa030, 1);
      g.fillCircle(Math.round(m.x), Math.round(m.y - 3), Math.round(R * 0.72 * e));
      g.fillStyle(cool > 0.7 ? 0xffd060 : 0xfff0c0, 1);
      g.fillCircle(Math.round(m.x - 2), Math.round(m.y - 6), Math.max(1, Math.round(R * 0.42 * e * (1 - cool * 0.6))));
    }
    if (k > 0.22) {
      // the mushroom: a smoke column with a rolling cap
      const q = (k - 0.22) / 0.78;
      const top = m.y - 20 - q * 50;
      g.fillStyle(0x3a3046, 0.7 * (1 - q));
      g.fillRect(Math.round(m.x - 7), Math.round(top), 14, Math.round(m.y - top));
      for (let j = 0; j < 5; j++) {
        const x = m.x + (j - 2) * 9;
        const r = R * (0.35 + 0.2 * q) * (1 - Math.abs(j - 2) * 0.15);
        g.fillStyle(j % 2 ? 0x5a5466 : 0x3a3046, 0.75 * (1 - q));
        g.fillCircle(Math.round(x), Math.round(top + Math.abs(j - 2) * 3), Math.max(1, Math.round(r)));
      }
    }
  },
  // Torva: rock and fire erupting under a foe
  eruption(g, m, k) {
    const rise = ease(clamp01(k / 0.12));
    const sink = k > 0.7 ? (k - 0.7) / 0.3 : 0;
    const a = 1 - sink * 0.7;
    rockSpike(g, m.x - 12, m.y, 9, m.r * 0.7 * rise * (1 - sink * 0.5), m.seed + 1, a);
    rockSpike(g, m.x + 12, m.y, 9, m.r * 0.8 * rise * (1 - sink * 0.5), m.seed + 2, a);
    rockSpike(g, m.x, m.y, 11, m.r * rise * (1 - sink * 0.5), m.seed + 3, a);
    // a fountain of magma
    for (let i = 0; i < 14; i++) {
      const t = k * 0.7;
      const vx = (hash(i, m.seed) - 0.5) * 120;
      const vy = -140 - hash(i + 7, m.seed) * 110;
      const x = m.x + vx * t;
      const y = m.y - 4 + vy * t + 0.5 * 520 * t * t;
      if (y > m.y) continue;
      g.fillStyle(i % 3 ? 0xff7a2a : 0xffd060, 1 - k);
      g.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  },
  // the Blade default: a great cross cut over every foe
  crossCut(g, m, k) {
    const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
    const grow = clamp01(k * 5);
    const mx = (m.x + m.x1) / 2;
    const my = (m.y + m.y1) / 2;
    const dx = ((m.x1 - m.x) / 2) * grow;
    const dy = ((m.y1 - m.y) / 2) * grow;
    inkLine(g, mx - dx, my - dy, mx + dx, my + dy, 3, 0xb8c2d8, a);
    inkLine(g, mx - dx, my + dy, mx + dx, my - dy, 3, 0xb8c2d8, a);
    line(g, mx - dx, my - dy, mx + dx, my + dy, 1, WHITE, a);
    line(g, mx - dx, my + dy, mx + dx, my - dy, 1, WHITE, a);
  },
};

