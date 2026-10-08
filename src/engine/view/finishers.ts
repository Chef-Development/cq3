// The finisher show (playtest round 7: "finishers look much the same across heroes; each should be unique"). Every
// show runs on the plan in core/finisher-show.ts (the envelope finisherShowMs(stacks), the strikes, the last blow at
// FINISHER_BLOW_AT) and is built from three parts:
//   - the hero's STYLE KIT (view/finisher-kits.ts): its own sky, flurry strike, last-blow layer and marks, shared by
//     every hero of the style;
//   - the hero's SIGNATURE MOMENT (view/finisher-signatures.ts): the beat that belongs to that hero alone (Rowan's
//     whirlwind, Sable's leap from the shadows, Neve's glacier, Moss's great tree, Tam's giant keg, Hollis's rampart,
//     Vesper's sky of arrows, Torva's earth split), or their style's default until they have one;
//   - the RARITY SCALER (showScale): a rarer hero's show spends longer building up (inside the same total), adds
//     layers (motes, converging light, a halo, star or prism sparkles), takes over more of the sky and lands a bigger
//     flash and shake. The stacks add strikes, rings and sky motion.
// The fighters (view/fighters.ts) ask it where the hero is (`motion`), let it draw (`draw`), and land the last blow's
// hit and its counting-up number themselves before calling `blow`.
import Phaser from 'phaser';
import { moveOf, showScale, showTimeline, signatureOf, styleOf, type ShowMove } from '../../core/finisher-show';
import type { Tier } from '../../data/rarity';
import type { FightScene } from '../scene';
import { HERO_FEET_X, HERO_W } from '../art';
import { GAME_W } from '../layout';
import { clamp01, ease, rand, stackCol, WHITE, type EnemyView } from './shared';
import { chest, hash, line, mark, poly, showFade, twinkle, vignette, type G, type Mark, type MarkDraw, type ShowCtx } from './finisher-fx';
import { KIT_MARKS, STYLE_KITS, type StyleKit } from './finisher-kits';
import { SIG_MARKS, SIGNATURE_DRAW, type HeroMotion, type SignatureDraw } from './finisher-signatures';

/** Every mark's drawer, by kind (the kits' and the signatures'; 'sparkle' is the rarity layer's own). */
const MARKS: Record<string, MarkDraw> = {
  ...KIT_MARKS,
  ...SIG_MARKS,
  sparkle(g, m, k) {
    const a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
    twinkle(g, m.x, m.y, 2, m.r ? 0xffe070 : 0xa8eef8, a);
  },
};

/** What a show needs to start. */
export interface ShowStart {
  hero: string;
  /** The rarity it's drawn at (the hero's own, or the Test lab gallery's pick). */
  tier: Tier;
  stacks: number;
  /** Its targets. */
  views: EnemyView[];
  heroX: number;
  damage: number;
  heroTex: (pose: string) => string;
  heroAt: () => { x: number; lift: number };
}

/** Where a move takes the hero (in to strike, to a guard spot short of the foes, or a step forward to cast). */
function toXFor(move: ShowMove, heroX: number, front?: EnemyView): number {
  if (!front) return move === 'stand' ? heroX + 12 : heroX + 80;
  switch (move) {
    case 'dash':
      return front.homeX - 8;
    case 'blink':
      return front.homeX - 12;
    case 'leap':
      return front.homeX - 22;
    case 'guard':
      return Math.max(heroX + 6, Math.min(heroX + 16, front.homeX - 60));
    default:
      return Math.min(heroX + 12, front.homeX - 40);
  }
}

/** The last strike at or before k (-1 before the first). */
function lastStrike(c: ShowCtx, k: number): number {
  let idx = -1;
  c.tl.strikes.forEach((t, i) => {
    if (k >= t) idx = i;
  });
  return idx;
}

/** The style's way through the show (a signature can change it). */
function defaultMotion(c: ShowCtx, k: number, home: number): HeroMotion {
  const tl = c.tl;
  const from = c.heroX;
  const to = c.toX;
  const idx = lastStrike(c, k);
  const since = idx < 0 ? 1e9 : (k - tl.strikes[idx]) * tl.ms;
  const base: HeroMotion = { x: from, lift: 0, pose: 'idle0', flip: false, hidden: false, alpha: 1 };
  const appr = clamp01(k / Math.max(0.01, tl.build));
  const blowing = k >= tl.blow - 0.02;
  if (k >= tl.back) {
    if (c.move === 'blink') {
      // gone into the shadows, back out of them at home
      const q = clamp01((k - tl.back) / (1 - tl.back));
      return q < 0.4 ? { ...base, x: to, hidden: true, alpha: 0 } : { ...base, x: home, alpha: (q - 0.4) / 0.6 };
    }
    const q = clamp01((k - tl.back) / (1 - tl.back));
    const x = to + (home - to) * ease(q);
    const moving = Math.abs(x - home) > 3;
    return { ...base, x, pose: moving ? 'dash' : 'idle0', flip: moving };
  }
  switch (c.move) {
    case 'dash':
      if (k < tl.build) return { ...base, x: from + (to - from) * ease(appr), pose: appr < 0.2 ? 'windup' : 'dash' };
      return { ...base, x: to, pose: blowing ? 'fin' : idx % 2 ? 'slashA' : 'slashB' };
    case 'leap':
      if (k < tl.build) return { ...base, x: from + (to - from) * ease(appr), lift: Math.sin(appr * Math.PI) * 26, pose: 'leap' };
      return { ...base, x: to, pose: blowing || since < 60 ? 'fin' : 'windup' };
    case 'blink': {
      const out = tl.build * 0.35;
      if (k < out) return { ...base, pose: 'windup', alpha: 1 - k / out };
      if (k < tl.build * 0.8) return { ...base, x: to, hidden: true, alpha: 0 };
      if (k < tl.build) return { ...base, x: to, pose: 'leap', alpha: clamp01((k - tl.build * 0.8) / (tl.build * 0.2)) };
      if (k < tl.blow + 0.03) return { ...base, x: to, pose: blowing ? 'fang' : idx % 2 ? 'slashA' : 'slashB' };
      return { ...base, x: to, hidden: true, alpha: 0 };
    }
    case 'guard':
      if (k < tl.build) return { ...base, x: from + (to - from) * ease(appr), pose: 'dash' };
      return { ...base, x: to, pose: blowing || since < 70 ? 'fin' : 'parry' };
    default:
      return { ...base, x: from + (to - from) * ease(clamp01(k / 0.12)), pose: k < tl.build * 0.5 ? 'cast' : 'fin' };
  }
}

export class FinisherShow {
  /** The show playing (or whose marks are still fading out). */
  ctx: ShowCtx | null = null;
  private kit: StyleKit = STYLE_KITS.blade;
  private sig: SignatureDraw = SIGNATURE_DRAW.whirlwind;
  /** Every live mark, across shows (a mark can outlive its show). */
  private marks: Mark[] = [];
  /** Afterimages (a Shadow's blinks): the hero's own frames, tinted. */
  private ghosts: Phaser.GameObjects.Image[] = [];

  constructor(private readonly s: FightScene) {}

  /** A new layout (the containers were just emptied): fresh afterimage images, nothing in flight. */
  build(): void {
    const s = this.s;
    this.ghosts = [0, 1, 2, 3, 4, 5].map(() => s.add.image(0, 0, 'hero_idle0').setVisible(false).setTintMode(Phaser.TintModes.FILL));
    s.actors.add(this.ghosts);
    this.reset();
  }

  /** A new fight: nothing playing. */
  reset(): void {
    this.ctx = null;
    this.marks = [];
    for (const g of this.ghosts) g.setVisible(false);
  }

  /** The kit of the show playing (the afterimages' tint while the hero moves). */
  get look(): StyleKit {
    return this.kit;
  }

  /** How far through the show it is (0..1; -1 when none plays). */
  k(): number {
    const c = this.ctx;
    if (!c) return -1;
    const k = (this.s.anim - c.at) / c.tl.ms;
    return k >= 0 && k < 1 ? k : -1;
  }

  /** Start a show (its strikes are scheduled here; the fighters call `blow` at the last blow). */
  start(o: ShowStart): ShowCtx {
    const s = this.s;
    const style = styleOf(o.hero);
    const sigId = signatureOf(o.hero);
    this.kit = STYLE_KITS[style];
    this.sig = SIGNATURE_DRAW[sigId];
    const tl = showTimeline(o.tier, o.stacks);
    const move = moveOf(o.hero);
    const front = o.views.slice().sort((a, b) => a.homeX - b.homeX)[0];
    const c: ShowCtx = {
      s,
      hero: o.hero,
      style,
      sig: sigId,
      move,
      scale: showScale(o.tier),
      tl,
      n: tl.n,
      at: s.anim,
      views: o.views,
      heroX: o.heroX,
      toX: toXFor(move, o.heroX, front),
      pal: this.kit.pal,
      stack: stackCol(tl.n),
      marks: this.marks,
      damage: o.damage,
      heroTex: o.heroTex,
      heroAt: o.heroAt,
    };
    this.ctx = c;
    s.app.audio.finisherFlavor(style, 'start', 0, tl.strikes.length);
    // every hero: a glint as it begins; a rarer one's halo bursts as the build-up ends
    const h = o.heroAt();
    s.fx.sparks.push({ x: h.x + 8, y: s.ground - 24, at: s.anim, size: 8, color: c.pal.hot });
    if (c.scale.layers >= 4)
      s.later(tl.ms * tl.build, () => {
        if (this.ctx !== c) return;
        const p = c.heroAt();
        s.fx.ring(p.x + 2, s.ground - 18 - p.lift, 30, c.pal.hot, true);
        s.later(60, () => s.fx.ring(p.x + 2, s.ground - 18 - p.lift, 46, c.pal.light, true));
      });
    this.kit.start?.(c);
    this.sig.start?.(c);
    tl.strikes.forEach((k, i) => s.later(tl.ms * k, () => this.strike(c, i)));
    return c;
  }

  /** One strike of the flurry, on every target: the kit's look, the signature's, the rarity's extra layers. */
  private strike(c: ShowCtx, i: number): void {
    if (this.ctx !== c) return;
    const s = this.s;
    const of = c.tl.strikes.length;
    const L = c.scale.layers;
    for (const v of c.views) {
      if (v.dieAt) continue;
      this.kit.strike(c, v, i, of);
      this.sig.strike?.(c, v, i, of);
      const cy = chest(v);
      if (L >= 2) s.fx.ring(v.x, cy, 10 + (i % 2) * 3, c.pal.light, true);
      if (L >= 4) s.fx.glow(v.x, cy, 10, c.pal.hot, 140);
      if (L >= 5 && i % 2 === 0) mark(c, 'sparkle', { x: v.x + rand(-12, 12), y: cy + rand(-14, 8), r: c.scale.sparkle === 'prism' ? 1 : 0, life: 300 });
    }
    s.app.audio.finisherStrike(i, of);
    s.app.audio.finisherFlavor(c.style, 'strike', i, of);
    s.fx.kick(i % 2 ? 2 : -2, 60);
    const gap = of > 1 ? (c.tl.strikes[1] - c.tl.strikes[0]) * c.tl.ms : 100;
    s.fx.freeze(Math.min(25, gap * 0.35));
  }

  /** The last blow's show (the fighters have landed the hit and its number on every target). */
  blow(): void {
    const c = this.ctx;
    if (!c) return;
    const s = this.s;
    const n = c.n;
    s.app.audio.finisherFlavor(c.style, 'blow', 0, c.tl.strikes.length);
    this.kit.blowOnce?.(c);
    this.sig.blow?.(c);
    const rings = n + c.scale.layers - 1;
    for (const v of c.views) {
      this.kit.blow(c, v);
      const cy = chest(v);
      for (let r = 0; r < rings; r++) s.later(r * 60, () => s.fx.ring(v.x, cy, 26 + r * 12, r % 2 ? c.stack[1] : c.pal.light, true));
    }
    s.fx.screenFlash(this.kit.flash, performance.now(), c.scale.flashMs + 20 * n);
    s.fx.shake(2 + c.scale.shake + n * 0.5, 200 + 40 * c.scale.shake);
    s.fx.kick(6, 160);
  }

  /** Where the hero is and how they look, at anim time `a` (null: no show plays). */
  motion(a: number, home: number): HeroMotion | null {
    const c = this.ctx;
    if (!c) return null;
    const k = clamp01((a - c.at) / c.tl.ms);
    const def = defaultMotion(c, k, home);
    return this.sig.motion ? this.sig.motion(c, k, def) : def;
  }

  /** Every frame: the sky, the signature's backdrop and the ground marks behind the actors (gBack); the rest over
   *  them (gFront), with the rarity's layers and the stage's darkened edges. */
  draw(gBack: G, gFront: G, now: number): void {
    const c = this.ctx;
    if (!c) return;
    const k = (this.s.anim - c.at) / c.tl.ms;
    if (k >= 0 && k < 1) {
      const fade = showFade(k);
      this.kit.sky(gBack, c, k, fade * c.scale.sky, now);
      this.skyExtras(gBack, c, fade, now);
      if (c.scale.layers >= 4 && k < c.tl.build + 0.05) {
        const h = c.heroAt();
        gBack.fillStyle(c.pal.light, 0.22 * (1 - clamp01((k - c.tl.build) / 0.05)));
        gBack.fillEllipse(Math.round(h.x + 2), this.s.ground, 44, 8);
      }
      this.sig.back?.(gBack, c, k, now);
    }
    this.drawMarks(gBack, true);
    if (k >= 0 && k < 1) {
      this.kit.front?.(gFront, c, k, now);
      this.sig.front?.(gFront, c, k, now);
    }
    this.drawMarks(gFront, false);
    this.drawGhosts();
    if (k >= 0 && k < 1) this.rarityLayers(gFront, c, k, now);
    if (k >= 1 && !this.marks.length) this.ctx = null;
  }

  private drawMarks(g: G, sky: boolean): void {
    const a = this.s.anim;
    let dead = false;
    for (const m of this.marks) {
      const k = (a - m.at) / m.life;
      if (k >= 1) {
        dead = true;
        continue;
      }
      if (m.sky !== sky || m.kind === 'after' || k < 0) continue;
      const c = m.c ?? this.ctx;
      if (c) MARKS[m.kind]?.(g, m, k, c);
    }
    if (dead) {
      const live = this.marks.filter((m) => (a - m.at) / m.life < 1);
      this.marks.length = 0;
      this.marks.push(...live);
    }
  }

  /** A Shadow's afterimages: the hero's own frame, tinted in the style's colour, fading where it blinked. */
  private drawGhosts(): void {
    const a = this.s.anim;
    let gi = 0;
    for (const m of this.marks) {
      if (m.kind !== 'after' || !m.tex) continue;
      const k = (a - m.at) / m.life;
      if (k < 0 || k >= 1) continue;
      const img = this.ghosts[gi++];
      if (!img) break;
      const flip = m.dir < 0;
      img
        .setTexture(m.tex)
        .setFlipX(flip)
        .setOrigin((flip ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W, 1)
        .setPosition(Math.round(m.x), Math.round(m.y))
        .setTint((m.c ? STYLE_KITS[m.c.style] : this.kit).ghost)
        .setAlpha(0.8 * (1 - k))
        .setVisible(true);
    }
    for (; gi < this.ghosts.length; gi++) this.ghosts[gi].setVisible(false);
  }

  /** The rarity's sky layers: drifting motes, then light shafts, then the top tiers' stars or prism. */
  private skyExtras(g: G, c: ShowCtx, fade: number, now: number): void {
    const lvl = c.scale.skyFx;
    if (lvl <= 0) return;
    const bottom = this.s.ground - 8;
    for (let i = 0; i < 12; i++) {
      const x = Math.round(((hash(i, 201) * GAME_W + now * (0.01 + 0.01 * (i % 3))) % (GAME_W + 10)) - 5);
      const y = Math.round(8 + hash(i, 202) * (bottom - 20) + Math.sin(now / 400 + i) * 3);
      g.fillStyle(i % 2 ? c.pal.light : c.pal.hot, 0.55 * fade);
      g.fillRect(x, y, 2, 1);
    }
    if (lvl >= 2)
      for (let i = 0; i < 2; i++) {
        const x0 = 70 + i * 150 + Math.sin(now / 1500 + i) * 8;
        poly(
          g,
          [
            [x0, 0],
            [x0 + 12, 0],
            [x0 + 40, bottom],
            [x0 + 20, bottom],
          ],
          c.pal.hot,
          0.07 * fade,
        );
      }
    if (lvl >= 3) {
      const prism = c.scale.sparkle === 'prism';
      for (let i = 0; i < 14; i++) {
        const x = Math.round(hash(i, 203) * GAME_W);
        const y = Math.round(4 + hash(i, 204) * bottom * 0.5);
        const tw = 0.5 + 0.5 * Math.sin(now / 130 + i * 2.1);
        twinkle(g, x, y, i % 3 ? 1 : 2, prism ? [0xff9a9a, 0xffe070, 0x9af0a0, 0x9ad8ff, 0xe0a8ff][i % 5] : 0xa8eef8, fade * tw);
      }
    }
  }

  /** The rarity's layers over the stage: motes rising round the hero and light converging on them through the
   *  build-up, the top tiers' falling stars or prismatic rays, and the stage's edges darkening. */
  private rarityLayers(g: G, c: ShowCtx, k: number, now: number): void {
    const L = c.scale.layers;
    const fade = showFade(k);
    const tl = c.tl;
    const h = c.heroAt();
    const hx = h.x + 2;
    const hy = this.s.ground - 16 - h.lift;
    if (k < tl.build && L >= 2) {
      const bq = k / tl.build;
      for (let i = 0; i < 4 + 2 * L; i++) {
        const q = (bq * 2 + hash(i, 211)) % 1;
        const x = Math.round(hx + (hash(i, 212) - 0.5) * 30);
        const y = Math.round(this.s.ground - q * 40);
        g.fillStyle(i % 2 ? c.pal.light : c.pal.hot, 1 - q);
        g.fillRect(x, y, 1, 2);
      }
    }
    if (k < tl.build && L >= 3) {
      const bq = k / tl.build;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.3;
        const r0 = 70 * (1 - bq) + 12;
        const r1 = r0 + 14;
        line(g, hx + Math.cos(ang) * r1, hy + Math.sin(ang) * r1 * 0.6, hx + Math.cos(ang) * r0, hy + Math.sin(ang) * r0 * 0.6, 1, i % 2 ? c.pal.hot : c.pal.light, 0.8 * bq);
      }
    }
    if (c.scale.sparkle === 'stars') {
      for (let i = 0; i < 10; i++) {
        const life = 1600;
        const q = ((now + hash(i, 221) * life) % life) / life;
        twinkle(g, hash(i, 222) * GAME_W, q * (this.s.ground - 10), i % 3 ? 1 : 2, i % 2 ? 0xa8eef8 : WHITE, fade * (1 - q));
      }
    } else if (c.scale.sparkle === 'prism') {
      const cols = [0xff9a9a, 0xffe070, 0x9af0a0, 0x9ad8ff, 0xe0a8ff];
      for (let i = 0; i < 5; i++) {
        const x0 = GAME_W / 2 - 60 + i * 24 + Math.sin(now / 700) * 6;
        poly(
          g,
          [
            [x0, 0],
            [x0 + 10, 0],
            [x0 + 26 + (i - 2) * 16, this.s.ground],
            [x0 + 10 + (i - 2) * 16, this.s.ground],
          ],
          cols[i],
          0.06 * fade,
        );
      }
      for (let i = 0; i < 8; i++) {
        const life = 1400;
        const q = ((now + hash(i, 231) * life) % life) / life;
        twinkle(g, hash(i, 232) * GAME_W, 10 + q * (this.s.ground - 20), 2, 0xffe070, fade * (1 - q));
      }
    }
    vignette(g, this.s, c.scale.vignette * fade);
  }
}
