// Fizz's and Brann's kit moments on what they touch (the playtester's rule: every effect shows on the thing it
// affects; view/perk-at.ts says where, view/onsite.ts calls in here):
//   Fizz   a flask going off bursts on the bar in its brew: fire flames licking up, frost shards and a cold ring, a
//          spark's green lightning forking out wide; a toss flies from her hand to the foe, spinning in its brew's
//          glass, and shatters there (glass chips, the brew's splash, then the number)
//   Brann  a block rings his bell: a bronze sound ring off the block and a little bell swinging over it; the hit that
//          spends the tolls lands with a bell's boom on the foe (bigger with more tolls); Peal's echo rolls from him
//          to each foe as arcs of sound, the hit landing as they reach it
// Plain drawing on the onsite layers (the bar marks in screen space, the stage's in the world layer); everything
// animates from the scene's clock.
import type Phaser from 'phaser';
import type { Combat, CombatEvent } from '../../core/combat';
import { whole } from '../../core/format';
import { BREWS, type Brew } from '../../core/kit-fizz-brann';
import type { FightScene } from '../scene';
import { BREW_COL, BRONZE_COL, paintBell, paintFlask } from './fizz-brann-paint';
import { clamp01, ease, INK, WHITE, type EnemyView } from './shared';

type G = Phaser.GameObjects.Graphics;
type PerkEvent = Extract<CombatEvent, { type: 'perk' }>;

/** A brew's burst on the bar (screen px). */
interface Burst {
  x: number;
  brew: Brew;
  at: number;
  /** Its reach on screen (a spark's is wider). */
  r: number;
}
/** A bell ringing over a block on the bar (screen px). */
interface Toll {
  x: number;
  at: number;
  n: number;
}
/** A flask (or a peal of sound) flying from the hero to a foe (world px), landing at `at + ms`. */
interface Flight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  at: number;
  ms: number;
  kind: 'toss' | 'peal';
  brew: Brew;
}
/** A bell's boom on a foe (world px). */
interface Boom {
  x: number;
  y: number;
  at: number;
  n: number;
}

const BURST_MS = 420;
const TOLL_MS = 460;
const BOOM_MS = 420;

export class FizzBrannView {
  private bursts: Burst[] = [];
  private tolls: Toll[] = [];
  private flights: Flight[] = [];
  private booms: Boom[] = [];

  constructor(private readonly s: FightScene) {}

  newFight(): void {
    this.bursts = [];
    this.tolls = [];
    this.flights = [];
    this.booms = [];
  }

  private barX(pos: number): number {
    return this.s.barView.x(Math.max(0, Math.min(1, pos)));
  }

  private foe(id: number): EnemyView | null {
    const v = id ? this.s.fighters.enemies.get(id) : undefined;
    return v && !v.dieAt ? v : null;
  }

  /** One of their perks kicked in (onsite.special passes every perk through here). */
  perk(e: PerkEvent, c: Combat): void {
    const s = this.s;
    switch (e.id) {
      case 'fireBrew':
      case 'frostBrew':
      case 'sparkBrew': {
        // a flask went off on the bar (a toss's burst shows where it lands instead)
        if (e.pos === undefined || e.enemyId) return;
        const brew: Brew = e.id === 'fireBrew' ? 'fire' : e.id === 'frostBrew' ? 'frost' : 'spark';
        const r = Math.round(c.mod(c.tuning.styles.kegRadius, (h, v) => h.kegRadius?.(c, v)) * s.bar.w * (brew === 'spark' ? 1 : 0.7));
        this.bursts.push({ x: this.barX(e.pos), brew, at: s.anim, r: Math.max(10, r) });
        if (this.bursts.length > 8) this.bursts.shift();
        const [, base, light, glint] = BREW_COL[brew];
        const x = this.barX(e.pos);
        s.fx.chips(x, s.bar.y - 4, 10, [WHITE, glint, light, base], brew === 'frost' ? 10 : 7, -1);
        break;
      }
      case 'toll':
        if (e.pos === undefined) return;
        this.tolls.push({ x: this.barX(e.pos), at: s.anim, n: Math.max(1, e.amount) });
        if (this.tolls.length > 6) this.tolls.shift();
        break;
      case 'tollHit': {
        const v = this.foe(e.enemyId);
        if (!v) return;
        this.booms.push({ x: v.x, y: v.y - v.img.displayHeight / 2, at: s.anim + 30, n: Math.max(1, e.amount) });
        if (this.booms.length > 6) this.booms.shift();
        break;
      }
    }
  }

  /**
   * A toss's or a peal's blow (fighters.perkFx hands it over instead of its plain bolt): the flask (in the brew of her
   * last toss) or the arcs of sound fly to the foe; the hit, its splash and its number land when they get there.
   */
  strike(id: 'toss' | 'peal', v: EnemyView, amount: number, c: Combat): void {
    const s = this.s;
    const h = s.fighters.h;
    const brew = BREWS[Math.max(0, (c.perk.tossBrew ?? 1) - 1)] ?? 'fire';
    const x0 = h.x + (id === 'toss' ? 10 : 12);
    const y0 = s.ground - (id === 'toss' ? 26 : 20);
    const x1 = v.x - v.img.displayWidth * 0.2;
    const y1 = v.y - v.img.displayHeight / 2;
    const ms = id === 'toss' ? 230 : Math.round(140 + Math.abs(x1 - x0) * 0.6);
    this.flights.push({ x0, y0, x1, y1, at: s.anim, ms, kind: id, brew });
    if (this.flights.length > 10) this.flights.shift();
    s.later(ms, () => {
      const fx = s.fx;
      v.flashUntil = s.anim + 60;
      v.kickAt = s.anim;
      v.kickDist = id === 'toss' ? 5 : 3;
      if (!v.dieAt) s.fighters.setEnemyPose(v, 'hurt', 140);
      if (id === 'toss') {
        const [, base, light, glint] = BREW_COL[brew];
        // the glass shatters, the brew splashes
        fx.chips(x1, y1, 8, [WHITE, 0xdce8ee, glint], 8, 0);
        fx.burst(x1, y1, light, 10, true, 1.2, true);
        fx.burst(x1, y1, base, 6, true, 0.8);
        fx.glow(x1, y1, 14, light, 180, v.fly ? undefined : s.ground);
        fx.stars.push({ x: x1, y: y1, at: s.anim, r: 14, color: light });
        s.app.audio.hit(0, false);
        fx.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), glint, 2);
      } else {
        fx.ring(x1, y1, 12, BRONZE_COL[4], true);
        fx.burst(x1, y1, BRONZE_COL[4], 6, true, 0.9);
        fx.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), BRONZE_COL[5], 1);
      }
    });
  }

  // ------------------------------------------------------------------ frame

  /** The bar's marks (screen space, over the blocks): the brews' bursts, the bells ringing. */
  drawBar(g: G): void {
    const s = this.s;
    const B = s.bar;
    const a0 = s.anim;
    this.bursts = this.bursts.filter((b) => a0 - b.at < BURST_MS);
    for (const b of this.bursts) {
      const k = (a0 - b.at) / BURST_MS;
      const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      const [, base, light, glint] = BREW_COL[b.brew];
      const cy = B.y + B.h / 2;
      if (b.brew === 'fire') {
        // flames licking up off the bar where it blew
        for (let i = -3; i <= 3; i++) {
          const fx = Math.round(b.x + i * (b.r / 4));
          const fh = Math.round((10 + 8 * Math.abs(Math.sin(i * 1.7))) * ease(clamp01(k * 3)) * (1 - Math.abs(i) * 0.12));
          const sway = Math.round(Math.sin(a0 / 50 + i) * 1);
          g.fillStyle(INK, 0.8 * a);
          g.fillRect(fx - 2 + sway, B.y - fh - 1, 4, fh + 2);
          g.fillStyle(base, a);
          g.fillRect(fx - 1 + sway, B.y - fh, 2, fh);
          g.fillStyle(light, a);
          g.fillRect(fx - 1 + sway, B.y - Math.round(fh * 0.6), 2, Math.round(fh * 0.5));
          g.fillStyle(glint, a);
          g.fillRect(fx + sway, B.y - Math.round(fh * 0.3), 1, Math.round(fh * 0.3));
        }
      } else if (b.brew === 'frost') {
        // a cold ring and shards bursting out along the bar
        const r = b.r * ease(clamp01(k * 2.2));
        g.lineStyle(1, glint, a);
        g.strokeEllipse(Math.round(b.x), Math.round(cy), Math.round(r * 2), Math.max(4, Math.round(B.h + 8)));
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.3;
          const x = Math.round(b.x + Math.cos(ang) * r);
          const y = Math.round(cy + Math.sin(ang) * (B.h / 2 + 6));
          g.fillStyle(INK, a);
          g.fillRect(x - 2, y - 2, 4, 4);
          g.fillStyle(i % 2 ? light : WHITE, a);
          g.fillRect(x - 1, y - 1, 2, 2);
        }
      } else {
        // green lightning forking out to the wide blast's edges
        for (const dir of [-1, 1]) {
          let px = b.x;
          let py = cy;
          const reach = b.r * ease(clamp01(k * 3));
          for (let j = 1; j <= 6; j++) {
            const x = b.x + dir * (reach * j) / 6;
            const y = cy + (j < 6 ? Math.round(Math.sin(j * 2.3 + Math.floor(a0 / 60)) * 5) : 0);
            this.zag(g, px, py, x, y, 3, INK, a);
            this.zag(g, px, py, x, y, 1, j % 2 ? glint : light, a);
            px = x;
            py = y;
          }
        }
        if (k < 0.2) {
          g.fillStyle(WHITE, 0.6 * (1 - k / 0.2));
          g.fillRect(Math.round(b.x - b.r), B.y - 4, Math.round(b.r * 2), B.h + 8);
        }
      }
    }
    // the bell rung where the red was blocked: it swings in the bar's track there, sound rings rolling off it (more
    // tolls, a bigger bell)
    this.tolls = this.tolls.filter((t) => a0 - t.at < TOLL_MS);
    for (const t of this.tolls) {
      const k = (a0 - t.at) / TOLL_MS;
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const cy = B.y + B.h / 2;
      for (let j = 0; j < 2; j++) {
        const r = 6 + (k + j * 0.3) * 14;
        g.lineStyle(2, INK, a * 0.6 * (1 - j * 0.4));
        g.strokeEllipse(Math.round(t.x), Math.round(cy), Math.round(r * 2 + 2), Math.round(B.h + 8 + r * 0.5 + 2));
        g.lineStyle(1, j ? BRONZE_COL[4] : BRONZE_COL[5], a * (1 - j * 0.4));
        g.strokeEllipse(Math.round(t.x), Math.round(cy), Math.round(r * 2), Math.round(B.h + 8 + r * 0.5));
      }
      const w = 8 + Math.min(4, t.n);
      const h = w + 2;
      const swing = Math.sin(k * 18) * (1 - k) * 2;
      const pop = k < 0.12 ? Math.round((1 - k / 0.12) * 3) : 0;
      paintBell(g, t.x + swing, Math.round(cy - h / 2) - pop, w, h, { a, glow: k < 0.3 ? 1 : 0 });
    }
  }

  /** A jagged line (lightning). */
  private zag(g: G, x0: number, y0: number, x1: number, y1: number, w: number, col: number, a: number): void {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    g.fillStyle(col, a);
    const o = Math.floor(w / 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      g.fillRect(Math.round(x0 + (x1 - x0) * t) - o, Math.round(y0 + (y1 - y0) * t) - o, w, w);
    }
  }

  /** The stage's marks (the world layer): tosses and peals in flight, bells booming on foes. */
  drawWorld(g: G, now: number): void {
    const s = this.s;
    const a0 = s.anim;
    this.flights = this.flights.filter((f) => a0 - f.at < f.ms);
    for (const f of this.flights) {
      const k = clamp01((a0 - f.at) / f.ms);
      if (f.kind === 'toss') {
        const x = f.x0 + (f.x1 - f.x0) * k;
        const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 22;
        // droplets trailing it
        const [, , light, glint] = BREW_COL[f.brew];
        for (let j = 1; j <= 3; j++) {
          const q = Math.max(0, k - j * 0.07);
          g.fillStyle(j % 2 ? light : glint, 0.8 - j * 0.2);
          g.fillRect(Math.round(f.x0 + (f.x1 - f.x0) * q), Math.round(f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * 22), 2, 2);
        }
        paintFlask(g, x, y, 3, f.brew, now, { spin: k * Math.PI * 3, glow: 0.6 });
      } else {
        // arcs of sound rolling out toward the foe: bronze crescents, a white leading edge
        const x = f.x0 + (f.x1 - f.x0) * ease(k);
        const y = f.y0 + (f.y1 - f.y0) * k;
        for (let j = 0; j < 3; j++) {
          const r = 5 + j * 3;
          const xx = x - j * 5;
          const a = 1 - j * 0.28;
          for (let t = -0.9; t <= 0.9; t += 0.12) {
            const px = Math.round(xx + Math.cos(t) * r);
            const py = Math.round(y - Math.sin(t) * r * 1.2);
            g.fillStyle(INK, 0.7 * a);
            g.fillRect(px - 1, py - 1, 3, 3);
          }
          for (let t = -0.9; t <= 0.9; t += 0.12) {
            const px = Math.round(xx + Math.cos(t) * r);
            const py = Math.round(y - Math.sin(t) * r * 1.2);
            g.fillStyle(j === 0 ? WHITE : j === 1 ? BRONZE_COL[5] : BRONZE_COL[4], a);
            g.fillRect(px, py, 1, 1);
            g.fillStyle(BRONZE_COL[4], a);
            g.fillRect(px - 1, py, 1, 1);
          }
        }
      }
    }
    this.booms = this.booms.filter((b) => a0 - b.at < BOOM_MS);
    for (const b of this.booms) {
      const k = (a0 - b.at) / BOOM_MS;
      if (k < 0) continue;
      const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      // a bell's boom: rings of bronze swelling off the foe, more with more tolls
      for (let j = 0; j < Math.min(5, b.n); j++) {
        const r = 6 + (k * 18 + j * 5) * (0.8 + b.n * 0.1);
        g.lineStyle(j ? 1 : 2, j % 2 ? BRONZE_COL[4] : BRONZE_COL[5], a * (1 - j * 0.15));
        g.strokeEllipse(Math.round(b.x), Math.round(b.y), Math.round(r * 2), Math.round(r * 1.4));
      }
      if (k < 0.25) {
        g.fillStyle(WHITE, 0.7 * (1 - k / 0.25));
        g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 6, 2, 12);
        g.fillRect(Math.round(b.x) - 6, Math.round(b.y) - 1, 12, 2);
      }
    }
  }
}
