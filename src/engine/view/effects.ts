// Juice: particles, floating text, rings, sparks, starbursts, slashes, pixel debris, and the camera
// (shake, kick, hit-stop freeze, screen flash). Everything is fire-and-forget; the scene draws it each frame.
import Phaser from 'phaser';
import { impactFeel, impactWeight, type ImpactFeel, type ImpactTier } from '../../core/impact';
import type { FightScene } from '../scene';
import { FONT, FONT_BOLD, fontText, textWidth } from '../font';
import { GAME_W } from '../layout';
import { hudIcon, iconSize } from './pixels';
import { clamp01, ease, INK, rand, tintGrad, WHITE, type EnemyView, type Floater, type Particle } from './shared';

type G = Phaser.GameObjects.Graphics;

export class Effects {
  particles: Particle[] = [];
  floaters: Floater[] = [];
  private pool: Phaser.GameObjects.BitmapText[] = [];
  private singles: Record<string, Floater | undefined> = {};
  rings: Array<{ x: number; y: number; at: number; r: number; color: number; world: boolean }> = [];
  sparks: Array<{ x: number; y: number; at: number; size: number; color: number }> = [];
  stars: Array<{ x: number; y: number; at: number; r: number; color: number }> = [];
  slashes: Array<{ x: number; y: number; at: number; big: boolean; dir: number; color: number }> = [];
  flashes: Array<{ x: number; y: number; r: number; at: number }> = [];
  puffs: Array<{ x: number; y: number; r: number; at: number; life: number; color: number }> = [];
  debris: Array<{ x: number; y: number; vx: number; vy: number; color: number; born: number; life: number; bounces: number; floor: number }> = [];
  private lastWorldAnim = 0;
  private pixelCache = new Map<string, ImageData>();
  // camera
  freezeUntil = 0;
  private shakeUntil = 0;
  private shakeMag = 0;
  private kickDx = 0;
  private kickUntil = 0;
  screenFlashUntil = 0;
  screenFlashColor = WHITE;
  /** Full-scene white impact frames on heavy hits: shown until this time (and for at least one frame). */
  impactFlashUntil = 0;
  impactFlashPending = false;

  constructor(private readonly s: FightScene) {}

  /** Drop the floating text objects (the scene is about to rebuild its textures). */
  destroyText(): void {
    for (const f of this.floaters) f.t.destroy();
    for (const t of this.pool) t.destroy();
    this.floaters = [];
    this.pool = [];
  }

  /** Drop every effect in flight (new layout). */
  clear(): void {
    this.particles = [];
    this.slashes = [];
    this.rings = [];
    this.stars = [];
    this.sparks = [];
    this.debris = [];
    this.puffs = [];
    this.flashes = [];
  }

  // ------------------------------------------------------------------ camera

  /** Camera kick: the world jolts by dx px and springs back. */
  kick(dx: number, ms: number): void {
    this.kickDx = dx;
    this.kickUntil = performance.now() + ms;
  }

  freeze(ms: number): void {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  shake(px: number, ms: number): void {
    const now = performance.now();
    if (px <= 0 || ms <= 0) return;
    this.shakeMag = now < this.shakeUntil ? Math.max(this.shakeMag, px) : px;
    this.shakeUntil = Math.max(this.shakeUntil, now + ms);
  }

  screenFlash(color: number, now: number, ms: number): void {
    this.screenFlashColor = color;
    this.screenFlashUntil = now + ms;
  }

  /** Weight of an impact tier (finisher: grows with stacks). */
  weight(tier: ImpactTier, stacks = 1): number {
    return impactWeight(this.s.app.tuning, tier, stacks);
  }

  /** How an impact of weight w looks (no side effects). */
  feel(w: number): ImpactFeel {
    return impactFeel(this.s.app.tuning, w);
  }

  /**
   * An impact of weight w lands: hit-stop, shake, white impact frames and a music dip, all scaled by the weight.
   * Returns the feel so the caller can knock back and flash whatever was hit to match.
   */
  impact(w: number): ImpactFeel {
    const f = this.feel(w);
    this.freeze(f.hitStopMs);
    this.shake(f.shakePx, f.shakeMs);
    if (f.frames > 0) {
      // 1 or 2 frames at 60 fps (the frame it lands on counts): time-based, so 120 Hz screens show the same length
      this.impactFlashUntil = Math.max(this.impactFlashUntil, performance.now() + ((f.frames - 0.5) * 1000) / 60);
      this.impactFlashPending = true;
    }
    if (f.duck > 0) this.s.app.audio.duckMusic(f.duck, f.duckMs);
    return f;
  }

  /** Shake and kick move the whole world container. */
  applyCamera(now: number): void {
    const kx = now < this.kickUntil ? Math.round(this.kickDx * Math.sin(((this.kickUntil - now) / 110) * Math.PI * 0.5)) : 0;
    if (now < this.shakeUntil) {
      const m = Math.round(this.shakeMag);
      this.s.world.setPosition(Math.round(rand(-m, m)) + kx, Math.round(rand(-m, m)));
    } else this.s.world.setPosition(kx, 0);
  }

  // ------------------------------------------------------------------ spawning

  /** Chunky 2px chips flung out of a block. dir: -1 = upward, 0 = all around, 1 = to the right. */
  chips(x: number, y: number, spread: number, colors: readonly number[], n: number, dir: number): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const vx = dir === 1 ? rand(40, 140) : rand(-90, 90);
      const vy = dir === -1 ? rand(-190, -80) : rand(-150, 10);
      this.particles.push({ x: x + rand(-spread / 2, spread / 2), y: y + rand(-2, 2), vx, vy, g: 520, born: now, life: rand(220, 380), color: colors[i % colors.length], size: i % 4 === 0 ? 2 : 1, world: false, streak: false, shape: 'shard' });
    }
  }

  ring(x: number, y: number, r: number, color: number, world: boolean): void {
    this.rings.push({ x, y, at: performance.now(), r, color, world });
  }

  burst(x: number, y: number, color: number, n: number, world: boolean, speed = 1, streak = false): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 120) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30 * speed,
        g: streak ? 0 : 220,
        born: now,
        life: rand(220, 460),
        color,
        size: Math.random() < 0.35 ? 2 : 1,
        world,
        streak,
        shape: streak ? 'streak' : Math.random() < 0.4 ? 'shard' : 'chip',
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  sparkle(x: number, y: number): void {
    const now = performance.now();
    for (let i = 0; i < 10; i++)
      this.particles.push({ x: x + rand(-8, 8), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-80, -30), g: 60, born: now, life: rand(300, 600), color: i % 2 ? 0xfff07a : WHITE, size: 1, world: false, streak: false });
  }

  /** A judgment word over the bar. Only one at a time: a new one replaces the last. */
  judge(x: number, text: string, color: number, pop: boolean, dy = 0): void {
    const w = textWidth(text, 1, true);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.replaceFloater('judge', () => this.addFloater(x, this.s.bar.y - 10 + dy, text, color, 1, false, 0, pop ? -40 : -26, pop ? 60 : 0, 520, false));
  }

  /** Spawn a floater that replaces the previous one with the same key (if it's still alive). */
  replaceFloater(key: string, make: () => void): void {
    const prev = this.singles[key];
    if (prev) {
      const i = this.floaters.indexOf(prev);
      if (i >= 0) {
        this.killFloater(prev);
        this.floaters.splice(i, 1);
      }
    }
    make();
    this.singles[key] = this.floaters[this.floaters.length - 1];
  }

  floatNum(x: number, y: number, text: string, color: number, scale: number): void {
    const w = textWidth(text, scale, true);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, y, text, color, scale, true, rand(-6, 6), -60, 140, 760, true);
  }

  /** A rising "+N" with a HUD icon in front of it. */
  iconFloat(x: number, y: number, text: string, color: number, icon: string): void {
    this.addFloater(x + 6, y, text, color, 1, true, 0, -30, 20, 1000, true);
    const f = this.floaters[this.floaters.length - 1];
    if (f) f.icon = icon;
  }

  addFloater(x: number, y: number, text: string, color: number, scale: number, pop: boolean, vx: number, vy: number, g: number, life: number, world: boolean): void {
    const s = this.s;
    const t = this.pool.pop() ?? s.add.bitmapText(0, 0, FONT, '');
    t.setFont(FONT_BOLD);
    t.setText(fontText(text)).setOrigin(0.5, 0.5).setVisible(true).setAlpha(1).setScale(scale);
    tintGrad(t, color);
    if (t.parentContainer) t.parentContainer.remove(t);
    if (world) {
      s.fxLayer.add(t);
    } else {
      s.add.existing(t);
      t.setDepth(25);
    }
    this.floaters.push({ t, x, y, vx, vy, g, born: performance.now(), life, scale, pop });
    if (this.floaters.length > 30) this.killFloater(this.floaters.shift()!);
  }

  private killFloater(f: Floater): void {
    f.icon = undefined;
    f.t.setVisible(false);
    if (f.t.parentContainer) f.t.parentContainer.remove(f.t);
    this.pool.push(f.t);
  }

  /** Fling the enemy's own pixels (2x2 chunks of its sprite) outward; they bounce on the ground and fade. */
  explodePixels(v: EnemyView, boss: boolean): void {
    const key = `${v.sprite}_idle0`;
    let data = this.pixelCache.get(key);
    if (!data) {
      const src = this.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const ctx = src.getContext?.('2d');
      if (!ctx) return;
      data = ctx.getImageData(0, 0, src.width, src.height);
      this.pixelCache.set(key, data);
    }
    const anim = this.s.anim;
    const ground = this.s.ground;
    const W = data.width;
    const H = data.height;
    const ox = Math.round(v.x - W / 2);
    const oy = v.y - H;
    const cx = v.x;
    const cy = v.y - H * 0.55;
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        if (data.data[i + 3] < 128) continue;
        const color = (data.data[i] << 16) | (data.data[i + 1] << 8) | data.data[i + 2];
        if (color === 0x1a1020 && Math.random() < 0.65) continue; // fewer outline chunks
        const px = ox + x;
        const py = oy + y;
        const dx = px - cx;
        const dy = py - cy;
        const d = Math.hypot(dx, dy) || 1;
        const sp = rand(45, 130) * (boss ? 1.35 : 1);
        this.debris.push({
          x: px,
          y: py,
          vx: (dx / d) * sp + rand(-25, 25),
          vy: (dy / d) * sp * 0.7 - rand(70, 170),
          color,
          born: anim,
          life: rand(650, 1150),
          bounces: 0,
          floor: ground + Math.round(rand(-3, 3)),
        });
      }
    if (this.debris.length > 1100) this.debris.splice(0, this.debris.length - 1100);
  }

  // ------------------------------------------------------------------ drawing

  /** Slashes, starbursts, world rings, debris, sparks and world particles, in that order (world layer). */
  drawWorld(g: G, now: number): void {
    this.drawSlashes(g);
    this.drawStars(g);
    this.drawRings(g, now, true);
    this.drawDebris(g);
    this.drawSparks(g);
    this.drawParticles(g, now, true);
  }

  /** Slash arcs: tapered crescents (outer colored edge, bright inner core), sweeping open then thinning out. */
  private drawSlashes(g: G): void {
    const anim = this.s.anim;
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      const k = (anim - sl.at) / (sl.big ? 170 : 120);
      if (k >= 1) {
        this.slashes.splice(i, 1);
        continue;
      }
      const r = sl.big ? 26 : 20;
      const span = Math.PI * (0.35 + 0.75 * ease(clamp01(k * 1.7)));
      const a0 = sl.dir > 0 ? -Math.PI * 0.95 : -Math.PI * 0.05 - span;
      const thick = (sl.big ? 14 : 11) * (1 - k * 0.6);
      const crescent = (rOut: number, th: number) => {
        const pts: Phaser.Math.Vector2[] = [];
        const N = 18;
        for (let j = 0; j <= N; j++) {
          const ang = a0 + (span * j) / N;
          pts.push(new Phaser.Math.Vector2(sl.x + Math.cos(ang) * rOut, sl.y + Math.sin(ang) * rOut * 0.7));
        }
        for (let j = N; j >= 0; j--) {
          const t = j / N;
          const taper = Math.sin(Math.PI * (sl.dir > 0 ? Math.pow(t, 0.7) : 1 - Math.pow(1 - t, 0.7)));
          const ang = a0 + span * t;
          const rr = rOut - th * taper;
          pts.push(new Phaser.Math.Vector2(sl.x + Math.cos(ang) * rr, sl.y + Math.sin(ang) * rr * 0.7));
        }
        return pts;
      };
      const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      // dark rim, colored body, pale inner band, white-hot inner edge
      g.fillStyle(sl.color === 0x6ab4ff || sl.color === 0x3a8ae8 ? 0x1a3c8a : 0x9a5a14, alpha);
      g.fillPoints(crescent(r + 1, thick + 1), true);
      g.fillStyle(sl.color, alpha);
      g.fillPoints(crescent(r, thick), true);
      g.fillStyle(0xcfeeff, alpha);
      g.fillPoints(crescent(r - thick * 0.4, thick * 0.6), true);
      g.fillStyle(WHITE, alpha);
      g.fillPoints(crescent(r - thick * 0.62, thick * 0.38), true);
    }
  }

  /** Crit / finisher starbursts behind the numbers. */
  private drawStars(g: G): void {
    const anim = this.s.anim;
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      const k = (anim - st.at) / 260;
      if (k >= 1) {
        this.stars.splice(i, 1);
        continue;
      }
      const r = st.r * (0.5 + 0.5 * ease(clamp01(k * 2)));
      const star = (rad: number) => {
        const pts: Phaser.Math.Vector2[] = [];
        for (let p = 0; p < 20; p++) {
          const ang = (p / 20) * Math.PI * 2 + st.at;
          const rr = p % 2 ? rad * 0.55 : rad;
          pts.push(new Phaser.Math.Vector2(Math.round(st.x + Math.cos(ang) * rr), Math.round(st.y + Math.sin(ang) * rr * 0.85)));
        }
        return pts;
      };
      g.fillStyle(INK, (1 - k) * 0.9);
      g.fillPoints(star(r + 2), true);
      g.fillStyle(st.color, 1 - k);
      g.fillPoints(star(r), true);
      g.fillStyle(0xfff6c8, 1 - k);
      g.fillPoints(star(r * 0.72), true);
      g.fillStyle(WHITE, 1 - k);
      g.fillPoints(star(r * 0.45), true);
    }
  }

  /** Debris chunks, smoke puffs and burst flashes (world space, on the scene clock so hit-stop freezes them). */
  private drawDebris(g: G): void {
    const anim = this.s.anim;
    const dt = Math.min(0.05, Math.max(0, (anim - this.lastWorldAnim) / 1000));
    this.lastWorldAnim = anim;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      const k = (anim - f.at) / 200;
      if (k >= 1) {
        this.flashes.splice(i, 1);
        continue;
      }
      const r = f.r * (k < 0.35 ? ease(k / 0.35) : 1 - (k - 0.35) * 0.6);
      g.fillStyle(0xfff6d0, 0.9 * (1 - k));
      g.fillCircle(Math.round(f.x), Math.round(f.y), Math.max(1, r));
      g.fillStyle(WHITE, 1 - k);
      g.fillCircle(Math.round(f.x), Math.round(f.y), Math.max(1, r * 0.6));
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      const k = (anim - p.at) / p.life;
      if (k >= 1) {
        this.puffs.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const r = p.r * (0.6 + 0.8 * ease(k));
      g.fillStyle(p.color, 0.75 * (1 - k));
      g.fillCircle(Math.round(p.x), Math.round(p.y - 8 * k), Math.max(1, r));
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      const age = anim - d.born;
      if (age > d.life) {
        this.debris.splice(i, 1);
        continue;
      }
      if (dt > 0) {
        d.vy += 620 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= d.floor && d.vy > 0) {
          d.y = d.floor;
          if (d.bounces < 2) {
            d.vy = -d.vy * 0.36;
            d.vx *= 0.55;
            d.bounces++;
          } else {
            d.vy = 0;
            d.vx *= 0.7;
          }
        }
      }
      const k = age / d.life;
      g.fillStyle(d.color, k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35);
      g.fillRect(Math.round(d.x), Math.round(d.y) - 1, 2, 2);
    }
  }

  /** Impact sparks: a big 4-point star at the contact point that flips between + and x for a few frames. */
  private drawSparks(g: G): void {
    const anim = this.s.anim;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      const k = (anim - sp.at) / 130;
      if (k >= 1) {
        this.sparks.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const r = Math.max(2, Math.round(sp.size * (k < 0.3 ? 0.6 + k * 1.4 : 1 - (k - 0.3) * 1.2)));
      const diag = Math.floor(k * 6) % 2 === 1;
      const x = Math.round(sp.x);
      const y = Math.round(sp.y);
      const arm = (len: number, w: number, col: number) => {
        g.fillStyle(col, 1);
        for (let d = -len; d <= len; d++) {
          const t = Math.max(1, Math.round(w * (1 - Math.abs(d) / (len + 1))));
          if (diag) {
            g.fillRect(x + d - Math.floor(t / 2), y + d - Math.floor(t / 2), t, t);
            g.fillRect(x + d - Math.floor(t / 2), y - d - Math.floor(t / 2), t, t);
          } else {
            g.fillRect(x + d, y - Math.floor(t / 2), 1, t);
            g.fillRect(x - Math.floor(t / 2), y + d, t, 1);
          }
        }
      };
      arm(r + 1, 5, INK);
      arm(r, 3, sp.color);
      arm(Math.max(1, r - 2), 1, WHITE);
      g.fillStyle(WHITE, 1);
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  drawRings(g: G, now: number, world: boolean): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      if (r.world !== world) continue;
      const k = (now - r.at) / 240;
      if (k >= 1) {
        this.rings.splice(i, 1);
        continue;
      }
      const rad = r.r * ease(k);
      g.lineStyle(k < 0.5 ? 2 : 1, r.color, 1 - k);
      g.strokeCircle(Math.round(r.x), Math.round(r.y), Math.max(1, rad));
    }
  }

  /** Particles: chips (squares), shards (diamonds along their flight), sparks (4-point stars), streaks (speed lines). */
  drawParticles(g: G, now: number, world: boolean): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.world !== world) continue;
      const age = (now - p.born) / 1000;
      const k = (age * 1000) / p.life;
      if (k >= 1) {
        this.particles.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const x = Math.round(p.x + p.vx * age);
      const y = Math.round(p.y + p.vy * age + 0.5 * p.g * age * age);
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const shape = p.shape ?? (p.streak ? 'streak' : 'chip');
      if (shape === 'streak') {
        const sp = Math.hypot(p.vx, p.vy + p.g * age) || 1;
        const ux = p.vx / sp;
        const uy = (p.vy + p.g * age) / sp;
        const len = Math.max(2, Math.round(5 * (1 - k)));
        for (let j = 0; j < len; j++) {
          g.fillStyle(j === 0 ? WHITE : p.color, alpha * (1 - j / (len + 1)));
          g.fillRect(Math.round(x - ux * j), Math.round(y - uy * j), j === 0 ? 2 : 1, j === 0 ? 2 : 1);
        }
      } else if (shape === 'shard') {
        // a chunky diamond (taller than wide) that shrinks as it fades
        const sz = k > 0.7 ? Math.max(1, p.size - 1) : p.size;
        g.fillStyle(p.color, alpha);
        for (let dy = -2 * sz; dy <= 2 * sz; dy++) {
          const hw = Math.round(sz * (1 - Math.abs(dy) / (2 * sz + 1)));
          g.fillRect(x - hw, y + dy, hw * 2 + 1, 1);
        }
      } else if (shape === 'spark') {
        const arm = Math.max(1, Math.round(p.size * (1 - k)));
        g.fillStyle(p.color, alpha);
        g.fillRect(x - arm, y, arm * 2 + 1, 1);
        g.fillRect(x, y - arm, 1, arm * 2 + 1);
        g.fillStyle(WHITE, alpha);
        g.fillRect(x, y, 1, 1);
      } else {
        g.fillStyle(p.color, alpha);
        g.fillRect(x, y, p.size, p.size);
      }
    }
  }

  updateFloaters(now: number): void {
    const s = this.s;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const age = now - f.born;
      if (age > f.life) {
        this.killFloater(f);
        this.floaters.splice(i, 1);
        continue;
      }
      const k = age / f.life;
      const sec = age / 1000;
      if (f.count) {
        f.count.at ??= now;
        const q = Math.min(1, (now - f.count.at) / f.count.dur);
        f.t.setText(fontText(`${Math.round(f.count.to * ease(q))}`));
        if (q >= 1) f.count = undefined;
      }
      const popS = f.pop && age < 90 ? f.scale + 1 : f.scale;
      f.t.setScale(popS);
      f.t.setPosition(Math.round(f.x + f.vx * sec), Math.round(f.y + f.vy * sec + 0.5 * f.g * sec * sec));
      f.t.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      if (f.icon && k < 0.85) {
        const [iw, ih] = iconSize(f.icon);
        const wx = f.t.parentContainer ? s.world.x : 0;
        const wy = f.t.parentContainer ? s.world.y : 0;
        hudIcon(s.gTop, f.icon, Math.round(f.t.x - f.t.displayWidth / 2 - iw - 1 + wx), Math.round(f.t.y - ih / 2 + wy));
      }
    }
  }
}
