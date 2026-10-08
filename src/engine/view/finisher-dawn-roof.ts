// Round 7's Solenne and Wren: their finishers' signature moments (Part 6), on top of their styles' kits
// (view/finisher-kits.ts: Blade's steel sky and crescent cuts, Shadow's moonlit night and afterimages). Wired in by
// finisher-signatures.ts (SIGNATURE_DRAW, SIG_MARKS) under the ids in core/finisher-show.ts.
//   Solenne  sunfall      the blade raised, a sun kindles at its point, gathering light; it shoots up out of sight,
//                         sunbeams spear down onto the foes with every strike, then the sun itself falls onto them
//                         (bigger with the stacks) and bursts: a white-gold flash, long rays, a ring of light
//                         rolling along the ground, motes of gold raining after
//   Wren     rooftopDrop  her hook flies up on its rope, she is yanked up out of sight; her small silhouette races
//                         across the top of the sky, knives glinting down onto the target with every strike (one per
//                         Chain link), then she drops straight onto it from above: speed lines, a white cut through
//                         it, smoke and roof tiles bursting off the landing, and she hops back home
// Each a single readable beat, inside the show's envelope (finisherShowMs); no Math.random per frame (hash).
import { clamp01, ease, WHITE, type EnemyView } from './shared';
import { centerOf, chest, hash, inkLine, line, mark, outQuad, poly, twinkle, type G, type MarkDraw, type ShowCtx } from './finisher-fx';
import type { HeroMotion, SignatureDraw } from './finisher-signatures';

/** 0..1 between two points of the show. */
const between = (k: number, a: number, b: number): number => clamp01((k - a) / Math.max(1e-6, b - a));
/** The nearest target (or none). */
const nearest = (c: ShowCtx): EnemyView | undefined => c.views.slice().sort((a, b) => a.homeX - b.homeX)[0];

const DAWN = { core: 0xffffff, hot: 0xfff8d0, gold: 0xffe080, amber: 0xffb840, ember: 0xf08a20, deep: 0xb84a18 } as const;
const MUSTARD = { hi: 0xfff08a, base: 0xecc848, dark: 0xd0a024 } as const;
const BRICK = [0x6a2416, 0x9a3a22, 0xc45a34] as const;
const SMOKE = [0x4a4656, 0x7a7688, 0xaaa6b8, 0xdcd8e6] as const;

// ================================================================== Solenne: Sunfall

/** The sun's radius at the blow: bigger with the stacks (the finisher's size). */
const sunR = (c: ShowCtx): number => 11 + 3 * c.n;
/** Where the blade's point is (the sun kindles there): over her raised blade, from where she stands. */
const bladeTip = (c: ShowCtx): { x: number; y: number } => {
  const h = c.heroAt();
  return { x: h.x + 17, y: c.s.ground - 38 - h.lift };
};
/** Where the sun lands: the middle of the foes, at their chests. */
const sunLand = (c: ShowCtx): { x: number; y: number } => ({ x: centerOf(c), y: c.s.ground - 20 });

/** A sun: a white heart, gold and amber rings, rays turning round it (`rays` 0 for none). */
function drawSun(g: G, x: number, y: number, r: number, spin: number, rays: number, a = 1): void {
  if (r < 1 || a <= 0) return;
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(DAWN.ember, 0.28 * a);
  g.fillCircle(x, y, Math.round(r * 1.7));
  g.fillStyle(DAWN.amber, 0.45 * a);
  g.fillCircle(x, y, Math.round(r * 1.25));
  // the rays: long thin wedges turning slowly, alternately long and short
  for (let i = 0; i < rays; i++) {
    const ang = spin + (i / rays) * Math.PI * 2;
    const len = r * (i % 2 ? 1.9 : 2.6);
    const w = Math.max(1, r * 0.22);
    const nx = -Math.sin(ang) * w;
    const ny = Math.cos(ang) * w;
    poly(
      g,
      [
        [x + Math.cos(ang) * r * 0.8 + nx, y + Math.sin(ang) * r * 0.8 + ny],
        [x + Math.cos(ang) * len, y + Math.sin(ang) * len],
        [x + Math.cos(ang) * r * 0.8 - nx, y + Math.sin(ang) * r * 0.8 - ny],
      ],
      i % 2 ? DAWN.amber : DAWN.gold,
      0.85 * a,
    );
  }
  g.fillStyle(DAWN.gold, a);
  g.fillCircle(x, y, Math.round(r));
  g.fillStyle(DAWN.hot, a);
  g.fillCircle(x - Math.round(r * 0.15), y - Math.round(r * 0.15), Math.max(1, Math.round(r * 0.72)));
  g.fillStyle(DAWN.core, a);
  g.fillCircle(x - Math.round(r * 0.25), y - Math.round(r * 0.25), Math.max(1, Math.round(r * 0.4)));
}

export const SUNFALL: SignatureDraw = {
  motion(c, k, def): HeroMotion {
    const tl = c.tl;
    // she steps up and raises the blade; the sun kindles on it; she brings the blade down as the sun falls
    const x = c.heroX + 10 * ease(between(k, 0, 0.12));
    if (k >= tl.back) return def;
    if (k < tl.build * 0.12) return { ...def, x, pose: 'windup', hidden: false, alpha: 1 };
    if (k < tl.blow - 0.06) return { ...def, x, pose: 'fin', hidden: false, alpha: 1, lift: 0 };
    return { ...def, x, pose: 'slashA', hidden: false, alpha: 1, lift: 0 };
  },
  back(g, c, k) {
    const tl = c.tl;
    if (k >= 1) return;
    // dawn breaking behind the foes: a warm band rising along the horizon, brightest as the sun falls
    const s = c.s;
    const rise = outQuad(between(k, 0, tl.build)) * (1 - between(k, tl.back, 1) * 0.8);
    const flare = k > tl.blow ? 1 - between(k, tl.blow, tl.blow + 0.12) : between(k, tl.blow - 0.1, tl.blow);
    const top = s.ground - 6 - 26 * rise - 14 * flare;
    for (let i = 0; i < 4; i++) {
      const y = Math.round(top + i * ((s.ground - top) / 4));
      g.fillStyle([DAWN.deep, DAWN.ember, DAWN.amber, DAWN.gold][i], (0.12 + 0.08 * i) * rise + 0.25 * flare);
      g.fillRect(0, y, 400, Math.max(1, Math.round((s.ground - top) / 4)) + 1);
    }
  },
  front(g, c, k, now) {
    const tl = c.tl;
    if (k >= 1) return;
    const spin = now / 400;
    // the build-up: a sun kindling at the blade's point, light gathering into it from all round
    const leave = tl.build;
    if (k < leave + 0.06) {
      const tip = bladeTip(c);
      const grow = outQuad(between(k, tl.build * 0.12, leave));
      if (k < leave) {
        for (let i = 0; i < 6 + c.scale.layers * 2; i++) {
          const q = (now / 520 + hash(i, 41)) % 1;
          const ang = hash(i, 42) * Math.PI * 2;
          const d = 30 * (1 - q);
          twinkle(g, tip.x + Math.cos(ang) * d, tip.y + Math.sin(ang) * d * 0.7, 1, DAWN.gold, q * grow);
        }
        drawSun(g, tip.x, tip.y, 2 + 5 * grow, spin, grow > 0.4 ? 8 : 0, 1);
      } else {
        // ...and it shoots up out of sight
        const q = between(k, leave, leave + 0.06);
        const y = tip.y - 80 * ease(q);
        line(g, tip.x, tip.y, tip.x, y, 3, DAWN.gold, 1 - q);
        line(g, tip.x, tip.y, tip.x, y, 1, WHITE, 1 - q);
        drawSun(g, tip.x, y, 7, spin, 8, 1 - q * 0.5);
      }
    }
    // the fall: from the top of the sky onto the foes, its trail of fire behind it
    const fall0 = tl.blow - 0.14;
    if (k >= fall0 && k < tl.blow) {
      const land = sunLand(c);
      const q = ease(between(k, fall0, tl.blow));
      const x = land.x - 40 * (1 - q);
      const y = 6 + (land.y - 6) * q;
      const R = sunR(c) * (0.7 + 0.3 * q);
      for (let i = 1; i <= 5; i++) {
        const tx = x - 8 * i * (1 - q * 0.3);
        const ty = y - 14 * i;
        g.fillStyle(i % 2 ? DAWN.amber : DAWN.ember, 0.5 * (1 - i / 6));
        g.fillCircle(Math.round(tx), Math.round(ty), Math.max(1, Math.round(R * (1 - i / 7))));
      }
      drawSun(g, x, y, R, spin * 2, 12, 1);
    }
  },
  strike(c, v) {
    // a sunbeam spears down onto the foe
    mark(c, 'sunbeam', { x: v.x + Math.round((hash(v.id, c.s.anim | 0) - 0.5) * 10), y: chest(v), r: 3 + Math.min(3, c.scale.layers), life: 180 });
  },
  blow(c) {
    const s = c.s;
    const land = sunLand(c);
    const R = sunR(c);
    mark(c, 'sunBurst', { x: land.x, y: land.y, r: R, life: 520 });
    mark(c, 'dawnRing', { x: land.x, y: s.ground, r: 80 + c.n * 12, life: 460, sky: true });
    for (let i = 0; i < 10 + c.n * 2; i++) mark(c, 'goldMote', { x: land.x + (hash(i, 51) - 0.5) * 110, y: s.ground - 70 - hash(i, 52) * 30, r: 1, at: s.anim + 60 + i * 18, life: 700, seed: i });
    s.fx.flashes.push({ x: land.x, y: land.y, r: R + 10, at: s.anim });
    s.fx.shake(3 + Math.round(c.n / 2), 260);
  },
};

// ================================================================== Wren: Rooftop Drop

/** Where she drops (just short of the target, like a blink's strike spot). */
const dropX = (c: ShowCtx): number => {
  const t = nearest(c);
  return t ? t.homeX - 10 : c.toX;
};
/** When the drop starts and lands (it lands on the blow). */
const dropAt = (c: ShowCtx): [number, number] => [c.tl.blow - 0.08, c.tl.blow];

/** Her arc over the rooftops between the hook and the drop: from home, up and across to above the target. */
const ARC_LIFT = 24;
const DROP_LIFT = 44;

export const ROOFTOP_DROP: SignatureDraw = {
  motion(c, k, def): HeroMotion {
    const tl = c.tl;
    const yank0 = tl.build * 0.45;
    const [d0, d1] = dropAt(c);
    const tx = dropX(c);
    const show = { ...def, hidden: false, alpha: 1, flip: false };
    // the hook thrown up, then yanked up out of sight
    if (k < yank0) return { ...show, x: c.heroX, lift: 0, pose: 'cast' };
    if (k < tl.build) {
      const q = between(k, yank0, tl.build);
      return { ...show, x: c.heroX + 4 * q, lift: 130 * q * q, pose: 'leap', hidden: q > 0.97 };
    }
    // down out of the sky onto the rooftops' height, then racing across it toward the target, throwing knives
    const in1 = tl.build + 0.06;
    if (k < in1) return { ...show, x: c.heroX + 8, lift: ARC_LIFT + (130 - ARC_LIFT) * (1 - ease(between(k, tl.build, in1))), pose: 'leap' };
    const hop = d0 - 0.05;
    if (k < hop) {
      const q = between(k, in1, hop);
      return { ...show, x: c.heroX + 8 + (tx - 16 - c.heroX - 8) * q, lift: ARC_LIFT + 4 * Math.sin(q * Math.PI * 3), pose: Math.floor(q * 6) % 2 ? 'slashB' : 'leap' };
    }
    // a hop up over the target...
    if (k < d0) return { ...show, x: tx - 16 + 16 * ease(between(k, hop, d0)), lift: ARC_LIFT + (DROP_LIFT - ARC_LIFT) * outQuad(between(k, hop, d0)), pose: 'leap' };
    // ...and straight down onto it
    if (k < d1) return { ...show, x: tx, lift: DROP_LIFT * (1 - between(k, d0, d1) ** 2), pose: 'fin' };
    if (k < tl.back) return { ...show, x: tx, lift: 0, pose: 'slashA' };
    // a hop back home, over the foes' heads and down at her spot
    const q = between(k, tl.back, 1);
    return { ...show, x: tx + (c.heroX - tx) * ease(q), lift: Math.sin(q * Math.PI) * 30, pose: q < 0.9 ? 'leap' : 'idle0', flip: q < 0.9 };
  },
  front(g, c, k, now) {
    const tl = c.tl;
    const s = c.s;
    if (k >= 1) return;
    const h = c.heroAt();
    // the hook flying up on its rope (an inked line, so it reads over any sky), then taut as she's yanked up
    const yank0 = tl.build * 0.45;
    if (k < tl.build) {
      const throwQ = outQuad(between(k, 0, yank0));
      const hx = Math.round(c.heroX + 12);
      const hy = s.ground - 24 - h.lift;
      const ty = Math.round(hy - 120 * throwQ);
      for (let y = hy; y > ty; y -= 1) {
        const x = Math.round(hx + Math.sin((y - hy) / 7 + now / 60) * (1 - throwQ) * 2);
        g.fillStyle(0x140c1c, 1).fillRect(x - 1, y, 3, 1);
        g.fillStyle((y >> 1) % 2 ? 0xd8b47a : 0xa88050, 1).fillRect(x, y, 1, 1);
      }
      if (throwQ < 1) {
        g.fillStyle(0x140c1c, 1).fillRect(hx - 3, ty - 2, 7, 4);
        g.fillStyle(0xeef3fa, 1).fillRect(hx - 2, ty - 1, 5, 1);
        g.fillStyle(0x7c86a6, 1).fillRect(hx - 2, ty, 1, 1).fillRect(hx + 2, ty, 1, 1);
      }
    }
    // racing across the rooftops: her scarf a long mustard streak behind her
    const [d0, d1] = dropAt(c);
    if (k >= tl.build + 0.06 && k < d0) {
      const y = s.ground - 18 - h.lift;
      for (let i = 1; i < 10; i++) {
        g.fillStyle(i > 7 ? BRICK[2] : i % 2 ? MUSTARD.base : MUSTARD.hi, 1 - i / 11);
        g.fillRect(Math.round(h.x - 4 - i * 2), Math.round(y + Math.sin(now / 50 + i * 0.8) * 1.5), 2, 2);
      }
    }
    // the drop: speed lines streaming above her as she falls
    if (k >= d0 && k < d1 + 0.04) {
      const a = 1 - between(k, d1, d1 + 0.04);
      for (let i = 0; i < 7; i++) {
        const lx = Math.round(h.x - 7 + i * 3);
        const top = s.ground - 30 - h.lift - (i % 3) * 6;
        line(g, lx, top - 26, lx, top, 1, i % 2 ? WHITE : MUSTARD.hi, 0.85 * a);
      }
    }
  },
  strike(c, v, i) {
    // a knife flung down from where she races onto the target: one per strike (more Chain links, more knives)
    const h = c.heroAt();
    const x0 = h.x + 6;
    const y0 = c.s.ground - 22 - h.lift;
    const x1 = v.x + Math.round((hash(i, 61) - 0.5) * 12);
    const y1 = chest(v) + Math.round((hash(i, 62) - 0.5) * 10);
    mark(c, 'knifeFall', { x: x0, y: y0, x1, y1, life: 110, seed: i });
    c.s.later(110, () => {
      mark(c, 'xCut', { x: x1, y: y1, r: 6, life: 220, seed: i });
      c.s.fx.sparks.push({ x: x1, y: y1, at: c.s.anim, size: 7, color: MUSTARD.hi });
    });
  },
  blow(c) {
    const s = c.s;
    const t = nearest(c);
    const x = dropX(c);
    // the landing: a white cut down through the target, smoke rolling out, roof tiles bursting off
    if (t) mark(c, 'dropCut', { x: t.x, y: s.ground - t.img.displayHeight - 8, x1: t.x, y1: s.ground, life: 260 });
    for (let i = 0; i < 8; i++) s.fx.puffs.push({ x: x + 6 + (i - 3.5) * 6, y: s.ground - 3 - (i % 3) * 2, r: 3 + (i % 3), at: s.anim + i * 15, life: 480, color: SMOKE[1 + (i % 3)] });
    for (let i = 0; i < 9 + c.n; i++) mark(c, 'tile', { x: x + 8, y: s.ground - 6, x1: (hash(i, 71) - 0.5) * 140, y1: -120 - hash(i, 72) * 90, r: 2, life: 560, seed: i });
    s.fx.shock(x + 8, s.ground, 46, MUSTARD.hi);
    s.fx.shake(3, 200);
  },
};

// ================================================================== their marks

export const DAWN_ROOF_MARKS: Record<string, MarkDraw> = {
  // a sunbeam spearing down onto a foe from the top of the sky: a white core, gold edges, a flare where it lands
  sunbeam(g, m, k) {
    const a = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
    const w = Math.max(1, Math.round(m.r * (1 - k * 0.5)));
    g.fillStyle(DAWN.amber, 0.45 * a).fillRect(Math.round(m.x - w - 1), 0, w * 2 + 3, Math.round(m.y));
    g.fillStyle(DAWN.gold, 0.85 * a).fillRect(Math.round(m.x - w / 2), 0, Math.max(1, w), Math.round(m.y));
    g.fillStyle(WHITE, a).fillRect(Math.round(m.x), 0, 1, Math.round(m.y));
    twinkle(g, m.x, m.y, 3 + Math.round(m.r / 2), DAWN.gold, a);
  },
  // the fallen sun bursting on the foes: a white-gold disc swelling and fading, long rays flung out
  sunBurst(g, m, k) {
    const R = m.r * (1 + 1.2 * ease(clamp01(k / 0.4)));
    const a = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + 0.2;
      const len = R * (1.6 + 1.4 * ease(clamp01(k / 0.5))) * (i % 2 ? 0.7 : 1);
      line(g, m.x + Math.cos(ang) * R * 0.6, m.y + Math.sin(ang) * R * 0.5, m.x + Math.cos(ang) * len, m.y + Math.sin(ang) * len * 0.75, i % 2 ? 1 : 2, i % 2 ? DAWN.amber : DAWN.gold, a);
    }
    drawSun(g, m.x, m.y, R, k * 2, 0, a);
  },
  // a ring of light rolling out along the ground
  dawnRing(g, m, k) {
    const r = m.r * ease(k);
    const a = 1 - k;
    for (const [dr, col] of [
      [0, DAWN.gold],
      [-3, DAWN.amber],
    ] as Array<[number, number]>) {
      const rr = Math.max(1, r + dr);
      g.lineStyle(dr ? 1 : 2, col, a);
      g.strokeEllipse(Math.round(m.x), Math.round(m.y), Math.round(rr * 2), Math.max(2, Math.round(rr * 0.4)));
    }
  },
  // motes of gold raining after the sun
  goldMote(g, m, k) {
    const y = m.y + k * 60;
    const x = m.x + Math.sin(k * 6 + m.seed) * 3;
    const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    if (m.seed % 3 === 0) twinkle(g, x, y, 1, DAWN.gold, a);
    else g.fillStyle(m.seed % 2 ? DAWN.hot : DAWN.gold, a).fillRect(Math.round(x), Math.round(y), 1, 1);
  },
  // Wren: a knife flung onto the target, turning as it flies, a mustard streak behind it
  knifeFall(g, m, k) {
    const x = m.x + (m.x1 - m.x) * k;
    const y = m.y + (m.y1 - m.y) * k;
    const tx = m.x + (m.x1 - m.x) * Math.max(0, k - 0.35);
    const ty = m.y + (m.y1 - m.y) * Math.max(0, k - 0.35);
    line(g, tx, ty, x, y, 1, MUSTARD.hi, 0.7);
    const ang = k * Math.PI * 3 + m.seed;
    const dx = Math.cos(ang) * 3;
    const dy = Math.sin(ang) * 3;
    inkLine(g, x - dx, y - dy, x + dx, y + dy, 1, 0xeef3fa, 1);
    g.fillStyle(0x74442a, 1).fillRect(Math.round(x - dx), Math.round(y - dy), 1, 1);
  },
  // a quick X of two knife cuts on the target
  xCut(g, m, k) {
    const a = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
    const r = m.r * ease(clamp01(k / 0.25));
    inkLine(g, m.x - r, m.y - r, m.x + r, m.y + r, 1, MUSTARD.hi, a);
    inkLine(g, m.x - r, m.y + r, m.x + r, m.y - r, 1, WHITE, a);
  },
  // the drop's cut: a white line down through the target, thinning as it fades
  dropCut(g, m, k) {
    const a = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
    const len = ease(clamp01(k / 0.15));
    const y1 = m.y + (m.y1 - m.y) * len;
    inkLine(g, m.x, m.y, m.x, y1, k < 0.5 ? 3 : 1, MUSTARD.hi, a);
    line(g, m.x, m.y, m.x, y1, 1, WHITE, a);
  },
  // a roof tile flung off the landing, tumbling (brick red, a lit edge)
  tile(g, m, k) {
    const t = k * (m.life / 1000);
    const x = m.x + m.x1 * t;
    const y = m.y + m.y1 * t + 0.5 * 520 * t * t;
    const a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    const flip = Math.floor(k * 10 + m.seed) % 2;
    g.fillStyle(0x140c1c, a).fillRect(Math.round(x) - 2, Math.round(y) - 2, flip ? 5 : 4, flip ? 3 : 4);
    g.fillStyle(BRICK[1], a).fillRect(Math.round(x) - 1, Math.round(y) - 1, flip ? 3 : 2, flip ? 1 : 2);
    g.fillStyle(BRICK[2], a).fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
  },
};
