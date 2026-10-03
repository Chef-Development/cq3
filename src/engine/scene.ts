// Phaser scene: renders the core state and plays the juice. Reads input only through App.
import Phaser from 'phaser';
import { isRed, type Block, type BlockKind, type Combat, type CombatEvent } from '../core/combat';
import { boostLabel, type Phase } from '../core/run';
import type { App, View } from './app';
import { buildArt, ICONS } from './art';
import { buildFont, FONT, fontText, textWidth } from './font';
import { GAME_H, GAME_W } from './layout';

const COL = {
  yellow: [0xf2c230, 0xffe680, 0xb08a10],
  green: [0x4fc45a, 0xa4f2a8, 0x2e8a3a],
  red: [0xe0463c, 0xff8a7a, 0x9a2a24],
  purple: [0x9b4fd6, 0xd6a4ff, 0x6a2a9a],
} as const;
const kindCol = (k: BlockKind) => (k === 'yellow' ? COL.yellow : k === 'green' ? COL.green : k === 'purple' ? COL.purple : COL.red);

const WHITE = 0xffffff;
const PANEL = 0x16122a;
const INK = 0x0a0812;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EnemyView {
  id: number;
  img: Phaser.GameObjects.Image;
  x: number;
  y: number; // feet
  flashUntil: number;
  lungeUntil: number;
  knockUntil: number;
  windupUntil: number;
  dieAt: number;
  bob: number;
  hpShown: number;
}

interface Floater {
  t: Phaser.GameObjects.BitmapText;
  x: number;
  y: number;
  vy: number;
  born: number;
  life: number;
  scale: number;
  pop: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: number;
  size: number;
  world: boolean;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const inRect = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

export class FightScene extends Phaser.Scene implements View {
  private app!: App;
  // layout
  private top = 0;
  private splitY = 262;
  private ground = 240;
  private bar: Rect = { x: 8, y: 300, w: 185, h: 20 };
  private meter: Rect = { x: 8, y: 334, w: 185, h: 6 };
  private button: Rect = { x: 40, y: 350, w: 121, h: 28 };
  private heroX = 40;
  // objects
  private world!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private gWorld!: Phaser.GameObjects.Graphics;
  private gPanel!: Phaser.GameObjects.Graphics;
  private gBar!: Phaser.GameObjects.Graphics;
  private gTop!: Phaser.GameObjects.Graphics;
  private txt: Record<string, Phaser.GameObjects.BitmapText> = {};
  private boostTexts: Phaser.GameObjects.BitmapText[] = [];
  private enemies = new Map<number, EnemyView>();
  private floaters: Floater[] = [];
  private pool: Phaser.GameObjects.BitmapText[] = [];
  private particles: Particle[] = [];
  private lastCombat: Combat | null = null;
  // juice state
  private shakeUntil = 0;
  private shakeMag = 0;
  private heroFlashUntil = 0;
  private heroFlashColor = WHITE;
  private heroLungeUntil = 0;
  private screenFlashUntil = 0;
  private screenFlashColor = WHITE;
  private comboBreakUntil = 0;
  private comboPopUntil = 0;
  private slashUntil = 0;
  private slashAt = { x: 0, y: 0 };
  private explodeFx: { x: number; r: number; until: number } | null = null;
  private heroHpShown = 0;

  constructor() {
    super('fight');
  }

  init(data: { app: App }): void {
    this.app = data.app;
    this.app.view = this;
  }

  create(): void {
    buildFont(this);
    this.world = this.add.container(0, 0).setDepth(0);
    this.gPanel = this.add.graphics().setDepth(10);
    this.gBar = this.add.graphics().setDepth(11);
    this.gTop = this.add.graphics().setDepth(30);
    const mk = (key: string, depth = 12) => (this.txt[key] = this.add.bitmapText(0, 0, FONT, '').setDepth(depth));
    ['level', 'heroHp', 'ability', 'combo', 'comboLabel', 'speed', 'tier', 'meterLabel', 'button', 'hint', 'enemyName', 'debug'].forEach((k) =>
      mk(k),
    );
    ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3'].forEach((k) => mk(k, 32));
    for (let i = 0; i < 6; i++) this.boostTexts.push(this.add.bitmapText(0, 0, FONT, '').setDepth(32));
    this.onLayout();
    this.heroHpShown = this.app.run.hero.hp;
  }

  // ------------------------------------------------------------------ layout

  onLayout(): void {
    const { safeTop, safeBottom } = this.app.layout;
    this.top = safeTop;
    const usable = GAME_H - safeTop - safeBottom;
    this.splitY = Math.round(safeTop + usable * 0.6);
    this.ground = this.splitY - 20;
    const avail = GAME_H - safeBottom - this.splitY;
    const barY = this.splitY + Math.max(36, Math.round(avail * 0.28));
    this.bar = { x: 8, y: barY, w: GAME_W - 16, h: 20 };
    this.meter = { x: 8, y: barY + this.bar.h + 20, w: GAME_W - 16, h: 6 };
    this.button = { x: 40, y: this.meter.y + this.meter.h + 12, w: GAME_W - 80, h: 30 };

    buildArt(this, GAME_W, this.splitY, this.ground);
    this.world.removeAll(true);
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
    this.hero = this.add.image(this.heroX, this.ground, 'hero').setOrigin(0.5, 1).setScale(3);
    this.gWorld = this.add.graphics();
    this.world.add([this.bg, this.hero, this.gWorld]);
    this.enemies.clear();
    this.lastCombat = null;
  }

  // ------------------------------------------------------------------ input helpers (game px)

  finisherButtonHit(x: number, y: number): boolean {
    return this.app.settings.finisherInput === 'button' && this.app.run.phase === 'fight' && inRect(this.button, x, y, 4);
  }

  enemyAt(x: number, y: number): number | null {
    for (const v of this.enemies.values()) {
      if (v.dieAt) continue;
      const b = v.img.getBounds();
      if (inRect({ x: b.x, y: b.y, w: b.width, h: b.height }, x, y, 4)) return v.id;
    }
    return null;
  }

  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++) if (inRect(this.cardRect(i), x, y)) return i;
    return -1;
  }

  private cardRect(i: number): Rect {
    const h = 40;
    const y0 = Math.round(GAME_H / 2 - 70);
    return { x: 26, y: y0 + i * (h + 8), w: GAME_W - 52, h };
  }

  // ------------------------------------------------------------------ events

  onPhase(_prev: Phase, next: Phase): void {
    if (next === 'fight') this.syncEnemies(true);
  }

  onEvents(events: CombatEvent[]): void {
    const now = performance.now();
    const c = this.app.run.combat;
    if (!c) return;
    const J = this.app.tuning.juice;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const x = this.barX(e.pos);
          this.judge(x, e.perfect ? 'PERFECT' : e.crit ? 'CRIT!' : 'HIT', e.perfect ? 0xfff07a : e.crit ? 0xff9a3a : WHITE, e.perfect);
          this.heroLungeUntil = now + 90;
          this.comboPopUntil = now + 90;
          const v = this.enemies.get(e.enemyId);
          if (v) {
            this.slashAt = { x: v.x, y: v.y - v.img.displayHeight / 2 };
            this.slashUntil = now + 90;
          }
          this.shake(e.crit ? J.shakeMaxPx : J.shakeMinPx, J.shakeMs * (e.crit ? 1.3 : 0.7));
          break;
        }
        case 'block': {
          const x = this.barX(e.pos);
          this.judge(x, e.perfect ? 'PERFECT' : e.cracked ? 'CRACK' : 'BLOCK', e.perfect ? 0xfff07a : 0x7ae0ff, e.perfect);
          this.heroFlashUntil = now + J.flashMs;
          this.heroFlashColor = 0x7ae0ff;
          this.comboPopUntil = now + 90;
          if (e.cracked) this.burst(x, this.bar.y + this.bar.h / 2, 0xc8d0e0, 4, false);
          break;
        }
        case 'trap':
          this.judge(this.barX(e.pos), 'TRAP!', COL.purple[1], true);
          this.enemyLunge(e.enemyId, now);
          this.screenFlash(COL.purple[0], now, 120);
          break;
        case 'miss':
          this.judge(this.barX(e.pos), 'MISS', 0x9a94b0, false);
          break;
        case 'remove': {
          if (e.reason === 'expire') {
            this.burst(this.barX(e.pos), this.bar.y + this.bar.h / 2, kindCol(e.kind)[2], 4, false, 0.4);
            break;
          }
          const n = e.reason === 'impact' ? 6 : 10;
          this.burst(this.barX(e.pos), this.bar.y + this.bar.h / 2, kindCol(e.kind)[0], n, false);
          this.burst(this.barX(e.pos), this.bar.y + this.bar.h / 2, kindCol(e.kind)[1], 4, false);
          break;
        }
        case 'windup': {
          const v = this.enemies.get(e.enemyId);
          if (v) v.windupUntil = now + 160;
          break;
        }
        case 'heroHurt': {
          this.heroFlashUntil = now + J.flashMs * 1.5;
          this.heroFlashColor = 0xff3030;
          if (e.damage > 0 || this.app.settings.godMode) this.floatNum(this.heroX, this.ground - 62, `-${e.damage}`, 0xff5a5a, 1, true);
          if (e.source === 'red' || e.source === 'bomb') this.enemyLunge(e.enemyId, now);
          this.shake(e.source === 'miss' ? J.shakeMinPx : J.shakeMaxPx, J.shakeMs);
          break;
        }
        case 'enemyHurt': {
          const v = this.enemies.get(e.enemyId);
          if (!v) break;
          v.flashUntil = now + J.flashMs;
          v.knockUntil = now + 80;
          const big = e.crit || e.source === 'finisher';
          this.floatNum(v.x + rand(-4, 4), v.y - v.img.displayHeight - 4, `${e.damage}`, e.crit ? 0xffd23a : e.source === 'finisher' ? 0xff8a2a : WHITE, big ? 2 : 1, true);
          this.burst(v.x, v.y - v.img.displayHeight / 2, WHITE, big ? 8 : 3, true);
          break;
        }
        case 'kill': {
          const v = this.enemies.get(e.enemyId);
          if (v) {
            v.dieAt = now;
            this.burst(v.x, v.y - v.img.displayHeight / 2, 0xffffff, 16, true);
            this.burst(v.x, v.y - v.img.displayHeight / 2, 0xffd23a, 10, true);
          }
          this.shake(J.shakeMaxPx, J.shakeMs * 1.5);
          break;
        }
        case 'explode':
          this.explodeFx = { x: this.barX(e.pos), r: e.radius * this.bar.w, until: now + 220 };
          this.shake(J.shakeMaxPx, J.shakeMs * 1.5);
          this.floatNum(GAME_W / 2, this.splitY - 70, 'BOOM!', 0xff8a3a, 2, true);
          break;
        case 'finisher':
          this.screenFlash(WHITE, now, 160);
          this.shake(J.shakeMaxPx, J.shakeMs * 2);
          this.heroLungeUntil = now + 160;
          this.floatNum(GAME_W / 2, this.splitY - 90, 'FINISHER!', 0xffb03a, 2, true);
          break;
        case 'ability':
          this.floatNum(this.heroX, this.ground - 72, 'KEEN EDGE', 0x9af0a0, 1, true);
          break;
        case 'speedUp':
          this.judge(this.bar.x + this.bar.w / 2, 'SPEED UP', 0xff9a3a, true, -24);
          break;
        case 'comboBreak':
          this.comboBreakUntil = now + 350;
          break;
        case 'meterFull':
          this.judge(this.meter.x + this.meter.w / 2, 'FINISHER READY', 0xffb03a, true, this.meter.y - this.bar.y - 2);
          break;
        case 'revive':
          this.screenFlash(0x9af0a0, now, 300);
          this.floatNum(this.heroX + 10, this.ground - 80, 'REVIVED!', 0x9af0a0, 2, true);
          break;
      }
    }
  }

  private barX(pos: number): number {
    return this.bar.x + pos * this.bar.w;
  }

  private shake(px: number, ms: number): void {
    const now = performance.now();
    if (px <= 0 || ms <= 0) return;
    this.shakeMag = now < this.shakeUntil ? Math.max(this.shakeMag, px) : px;
    this.shakeUntil = Math.max(this.shakeUntil, now + ms);
  }

  private screenFlash(color: number, now: number, ms: number): void {
    this.screenFlashColor = color;
    this.screenFlashUntil = now + ms;
  }

  private enemyLunge(id: number, now: number): void {
    const v = this.enemies.get(id);
    if (v) v.lungeUntil = now + 140;
  }

  private judge(x: number, text: string, color: number, pop: boolean, dy = 0): void {
    const w = textWidth(text);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, this.bar.y - 12 + dy, text, color, 1, pop, -18, 520, false);
  }

  private floatNum(x: number, y: number, text: string, color: number, scale: number, pop: boolean): void {
    const w = textWidth(text, scale);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, y, text, color, scale, pop, -22, 700, true);
  }

  private addFloater(x: number, y: number, text: string, color: number, scale: number, pop: boolean, vy: number, life: number, world: boolean): void {
    const t = this.pool.pop() ?? this.add.bitmapText(0, 0, FONT, '');
    t.setText(fontText(text)).setTint(color).setOrigin(0.5, 0.5).setVisible(true).setAlpha(1).setScale(scale);
    if (world) {
      this.world.add(t);
      t.setDepth(0);
    } else {
      if (t.parentContainer) t.parentContainer.remove(t);
      this.add.existing(t);
      t.setDepth(25);
    }
    this.floaters.push({ t, x, y, vy, born: performance.now(), life, scale, pop });
    if (this.floaters.length > 24) this.killFloater(this.floaters.shift()!);
  }

  private killFloater(f: Floater): void {
    f.t.setVisible(false);
    if (f.t.parentContainer) f.t.parentContainer.remove(f.t);
    this.pool.push(f.t);
  }

  private burst(x: number, y: number, color: number, n: number, world: boolean, speed = 1): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(30, 90) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40 * speed, born: now, life: rand(250, 450), color, size: Math.random() < 0.3 ? 2 : 1, world });
    }
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260);
  }

  // ------------------------------------------------------------------ enemies

  private enemyX(slot: number, count: number): number {
    if (count === 1) return 148;
    return [106, 141, 177][slot] ?? 150;
  }

  private spriteScale(scale: number, count: number): number {
    return Math.max(1, Math.round(count > 1 ? scale - 1 : scale));
  }

  private syncEnemies(force = false): void {
    const c = this.app.run.combat;
    if (!c) return;
    if (c !== this.lastCombat || force) {
      if (c !== this.lastCombat) {
        for (const v of this.enemies.values()) v.img.destroy();
        this.enemies.clear();
      }
      this.lastCombat = c;
      for (const e of c.enemies) {
        if (this.enemies.has(e.id)) continue;
        if (!e.alive) continue;
        const def = this.app.tuning.enemies[e.key];
        const img = this.add.image(0, 0, def.sprite).setOrigin(0.5, 1).setScale(this.spriteScale(def.scale, c.enemies.length));
        this.world.add(img);
        this.enemies.set(e.id, {
          id: e.id,
          img,
          x: this.enemyX(e.slot, c.enemies.length),
          y: this.ground + (c.enemies.length > 1 ? (e.slot % 2) * 4 : 0),
          flashUntil: 0,
          lungeUntil: 0,
          knockUntil: 0,
          windupUntil: 0,
          dieAt: 0,
          bob: Math.random() * 6,
          hpShown: e.hp,
        });
      }
      this.heroHpShown = this.app.run.hero.hp;
    }
  }

  // ------------------------------------------------------------------ frame

  update(): void {
    const now = performance.now();
    this.app.update(now);
    this.syncEnemies();
    const t = this.app.renderTime(now);
    this.drawWorld(now);
    this.drawPanel(now);
    this.drawBar(t, now);
    this.drawTexts(now);
    this.drawOverlay(now);
    this.updateFloaters(now);
  }

  private drawWorld(now: number): void {
    const run = this.app.run;
    const c = run.combat;
    const g = this.gWorld;
    g.clear();
    // shake (scene only; the bar stays still so timing stays readable)
    if (now < this.shakeUntil) {
      const m = Math.round(this.shakeMag);
      this.world.setPosition(Math.round(rand(-m, m)), Math.round(rand(-m, m)));
    } else this.world.setPosition(0, 0);

    // hero
    const lunge = now < this.heroLungeUntil ? 4 : 0;
    this.hero.setPosition(this.heroX + lunge, this.ground);
    if (now < this.heroFlashUntil) this.hero.setTint(this.heroFlashColor).setTintMode(Phaser.TintModes.FILL);
    else this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if (run.hero.abilityTimer > 0 && Math.floor(now / 100) % 2 === 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(this.heroX - 18, this.ground - 50 + Math.round(rand(0, 40)), 1, 2);
      g.fillRect(this.heroX + 16, this.ground - 50 + Math.round(rand(0, 40)), 1, 2);
    }

    // enemies
    if (c) {
      const target = c.currentTarget();
      for (const v of this.enemies.values()) {
        const e = c.enemyById(v.id);
        if (!e) continue;
        let x = v.x;
        let y = v.y;
        if (now < v.lungeUntil) x -= 10;
        if (now < v.knockUntil) x += 3;
        const def = this.app.tuning.enemies[e.key];
        const s = this.spriteScale(def.scale, c.enemies.length);
        let sy = s;
        if (now < v.windupUntil) sy = s * 0.85;
        else if (def.sprite === 'slime') sy = s * (1 + 0.05 * Math.sin(now / 220 + v.bob));
        else y += Math.sin(now / 260 + v.bob) > 0.7 ? -1 : 0;
        v.img.setPosition(Math.round(x), Math.round(y)).setScale(s, sy);
        if (v.dieAt) {
          const k = (now - v.dieAt) / 450;
          v.img.setAlpha(Math.max(0, 1 - k)).setTint(WHITE).setTintMode(Phaser.TintModes.FILL);
          v.img.setY(Math.round(y + k * 6));
          if (k >= 1) v.img.setVisible(false);
          continue;
        }
        if (now < v.flashUntil) v.img.setTint(WHITE).setTintMode(Phaser.TintModes.FILL);
        else v.img.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
        // HP bar above head
        v.hpShown += (e.hp - v.hpShown) * 0.25;
        const bw = Math.max(24, Math.round(v.img.displayWidth * 0.8));
        const bx = Math.round(v.x - bw / 2);
        const by = Math.round(v.y - v.img.displayHeight - 8);
        this.hpBar(g, bx, by, bw, 3, e.hp / e.maxHp, v.hpShown / e.maxHp, 0xe0463c);
        if (c.enemies.length > 1 && target?.id === e.id) {
          const tx = Math.round(v.x);
          const ty = by - 6 + (Math.floor(now / 250) % 2);
          g.fillStyle(WHITE, 1);
          g.fillRect(tx - 2, ty, 5, 1);
          g.fillRect(tx - 1, ty + 1, 3, 1);
          g.fillRect(tx, ty + 2, 1, 1);
        }
        // owner icon so group red blocks can be matched to enemies
        if (c.enemies.length > 1) this.icon(g, ICONS[def.icon], Math.round(v.x - 2), by - 13 + (target?.id === e.id ? -4 : 0), 0xff8a7a);
      }
    }

    // slash
    if (now < this.slashUntil) {
      const k = 1 - (this.slashUntil - now) / 90;
      g.fillStyle(WHITE, 1);
      for (let i = -8; i <= 8; i++) {
        if (Math.abs(i) > 8 * k + 2) continue;
        g.fillRect(Math.round(this.slashAt.x + i), Math.round(this.slashAt.y - i), 2, 1);
      }
    }

    // world particles
    this.drawParticles(g, now, true);
  }

  private hpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, ghost: number, color: number): void {
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x3a3050, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(WHITE, 1);
    g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ghost))), h);
    g.fillStyle(color, 1);
    g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
  }

  private icon(g: Phaser.GameObjects.Graphics, rows: string[], x: number, y: number, color: number): void {
    g.fillStyle(color, 1);
    rows.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === '#') g.fillRect(x + xx, y + yy, 1, 1);
    });
  }

  private drawParticles(g: Phaser.GameObjects.Graphics, now: number, world: boolean): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.world !== world) continue;
      const age = (now - p.born) / 1000;
      if (age * 1000 > p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const x = p.x + p.vx * age;
      const y = p.y + p.vy * age + 160 * age * age;
      g.fillStyle(p.color, 1);
      g.fillRect(Math.round(x), Math.round(y), p.size, p.size);
    }
  }

  private drawPanel(now: number): void {
    const g = this.gPanel;
    const run = this.app.run;
    const c = run.combat;
    g.clear();
    g.fillStyle(PANEL, 1);
    g.fillRect(0, this.splitY, GAME_W, GAME_H - this.splitY);
    g.fillStyle(INK, 1);
    g.fillRect(0, this.splitY, GAME_W, 2);
    g.fillStyle(0x2a2440, 1);
    g.fillRect(0, this.splitY + 2, GAME_W, 1);
    // top strip behind HUD text
    g.fillStyle(INK, 0.55);
    g.fillRect(0, 0, GAME_W, this.top + 22);

    // hero HP
    const H = run.hero;
    const maxHp = this.app.tuning.hero.maxHp + H.bonusMaxHp;
    this.heroHpShown += (H.hp - this.heroHpShown) * 0.2;
    this.hpBar(g, 6, this.top + 14, 70, 4, H.hp / maxHp, this.heroHpShown / maxHp, 0x5ad06a);

    if (!c) return;
    // meter
    const m = this.meter;
    const ready = c.finisherReady;
    g.fillStyle(INK, 1);
    g.fillRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
    g.fillStyle(0x2a2440, 1);
    g.fillRect(m.x, m.y, m.w, m.h);
    const fill = Math.round(m.w * c.meter);
    const pulse = ready && Math.floor(now / 120) % 2 === 0;
    g.fillStyle(pulse ? 0xfff07a : 0xffa02a, 1);
    g.fillRect(m.x, m.y, fill, m.h);
    g.fillStyle(0xffe0a0, 1);
    g.fillRect(m.x, m.y, fill, 1);

    // finisher button / swipe hint
    if (this.app.settings.finisherInput === 'button') {
      const b = this.button;
      const press = ready && Math.floor(now / 160) % 2 === 0;
      g.fillStyle(INK, 1);
      g.fillRect(b.x - 1, b.y - 1, b.w + 2, b.h + 3);
      g.fillStyle(ready ? (press ? 0xffc04a : 0xff9a2a) : 0x3a3050, 1);
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle(ready ? 0xffe0a0 : 0x4a4060, 1);
      g.fillRect(b.x, b.y, b.w, 2);
      g.fillStyle(ready ? 0xb05a10 : 0x241e36, 1);
      g.fillRect(b.x, b.y + b.h - 2, b.w, 2);
    } else if (ready) {
      const ax = GAME_W / 2;
      const ay = this.button.y + 6 - (Math.floor(now / 150) % 3);
      g.fillStyle(0xffb03a, 1);
      for (let i = 0; i < 5; i++) g.fillRect(ax - i, ay + i, i * 2 + 1, 1);
      g.fillRect(ax - 1, ay + 5, 3, 8);
    }
  }

  private drawBar(t: number, now: number): void {
    const g = this.gBar;
    g.clear();
    const c = this.app.run.combat;
    const B = this.bar;
    g.fillStyle(INK, 1);
    g.fillRect(B.x - 2, B.y - 2, B.w + 4, B.h + 4);
    g.fillStyle(0x2a2440, 1);
    g.fillRect(B.x, B.y, B.w, B.h);
    g.fillStyle(0x221c36, 1);
    for (let i = 1; i < 8; i++) g.fillRect(Math.round(B.x + (B.w * i) / 8), B.y + B.h - 3, 1, 3);
    // left end = the hero's side
    g.fillStyle(0x5ad06a, 0.5);
    g.fillRect(B.x, B.y, 1, B.h);
    if (!c) return;

    const perfectFrac = this.app.tuning.judge.perfectFrac;
    const group = c.enemies.length > 1;
    for (const b of c.blocks) if (!isRed(b.kind)) this.drawBlock(g, b, c, t, now, perfectFrac, group);
    for (const b of c.blocks) if (isRed(b.kind)) this.drawBlock(g, b, c, t, now, perfectFrac, group);

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 220;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 3, r * 2, B.h + 6);
    }

    // cursor (with a short trail at higher speeds)
    const speed = c.speedMult();
    if (speed > 1.25) {
      for (let i = 1; i <= 2; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.012) * B.w);
        g.fillStyle(0xffffff, 0.35 / i);
        g.fillRect(px - 1, B.y - 2, 2, B.h + 4);
      }
    }
    const cx = Math.round(B.x + c.cursorPosAt(t) * B.w);
    const hot = speed >= this.app.tuning.cursor.maxSpeedMult - 0.01;
    g.fillStyle(INK, 1);
    g.fillRect(cx - 2, B.y - 5, 4, B.h + 10);
    g.fillStyle(hot ? 0xffb03a : WHITE, 1);
    g.fillRect(cx - 1, B.y - 4, 2, B.h + 8);
    g.fillRect(cx - 2, B.y - 7, 4, 1);
    g.fillRect(cx - 1, B.y - 6, 2, 1);

    this.drawParticles(g, now, false);
  }

  private drawBlock(g: Phaser.GameObjects.Graphics, b: Block, c: Combat, t: number, now: number, perfectFrac: number, group: boolean): void {
    const B = this.bar;
    const pos = c.blockPosAt(b, t);
    const w = Math.max(3, Math.round(b.width * B.w));
    const x = Math.round(B.x + pos * B.w - w / 2);
    const y = B.y + 2;
    const h = B.h - 4;
    if (b.kind === 'purple' && b.life < 1 && Math.floor(now / 90) % 2 === 0) return;
    const [base, light, dark] = kindCol(b.kind);
    const impacting = b.impactTimer >= 0 && Math.floor(now / 40) % 2 === 0;
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(impacting ? WHITE : base, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(light, 1);
    g.fillRect(x, y, w, 1);
    g.fillStyle(dark, 1);
    g.fillRect(x, y + h - 2, w, 2);
    // perfect zone
    const pw = Math.max(1, Math.round(w * perfectFrac));
    g.fillStyle(light, 0.55);
    g.fillRect(Math.round(x + (w - pw) / 2), y + 1, pw, h - 3);
    if (b.kind === 'shield') {
      g.fillStyle(0xc8d0e0, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
      if (b.taps <= 1) {
        g.fillStyle(INK, 1);
        g.fillRect(x + 2, y + 3, 1, 3);
        g.fillRect(x + 3, y + 6, 1, 3);
        g.fillRect(x + 2, y + 9, 1, 2);
      }
    }
    const cx = Math.round(x + w / 2 - 2.5);
    if (isRed(b.kind)) {
      const variant = b.kind === 'red' ? null : ICONS[b.kind];
      const owner = c.enemyById(b.ownerId);
      const ownerIcon = owner ? ICONS[this.app.tuning.enemies[owner.key].icon] : null;
      if (variant) {
        this.icon(g, variant, cx, y + h - 8, b.kind === 'speed' ? 0xffe680 : INK);
        if (group && ownerIcon) this.icon(g, ownerIcon, cx, y + 2, WHITE);
      } else if (ownerIcon) this.icon(g, ownerIcon, cx, y + Math.round((h - 5) / 2) - 1, WHITE);
    } else if (b.kind === 'purple') {
      g.fillStyle(INK, 1);
      g.fillRect(cx + 1, y + 4, 3, 1);
      g.fillRect(cx + 2, y + 5, 1, 4);
      g.fillRect(cx + 2, y + 10, 1, 1);
    } else if (b.kind === 'green') {
      g.fillStyle(WHITE, 1);
      g.fillRect(cx + 2, y + 4, 1, 5);
      g.fillRect(cx, y + 6, 5, 1);
    }
  }

  private setText(key: string, s: string, x: number, y: number, color = WHITE, scale = 1, ox = 0, oy = 0, visible = true): void {
    const t = this.txt[key];
    t.setText(fontText(s)).setPosition(Math.round(x), Math.round(y)).setTint(color).setScale(scale).setOrigin(ox, oy).setVisible(visible);
  }

  private drawTexts(now: number): void {
    const run = this.app.run;
    const c = run.combat;
    const S = this.app.settings;
    const H = run.hero;
    const maxHp = this.app.tuning.hero.maxHp + H.bonusMaxHp;
    const lvl = run.level;
    const stageInfo = lvl.stages.length > 1 ? `  ${run.stageIndex + 1}/${lvl.stages.length}` : '';
    this.setText('level', `${lvl.name}${stageInfo}`, 6, this.top + 3, 0xc8c0e8);
    this.setText('heroHp', `${Math.ceil(H.hp)}/${maxHp}${H.revives > 0 ? '' : ''}`, 80, this.top + 12, 0x9af0a0);
    this.setText('ability', 'KEEN EDGE', 6, this.top + 22, 0x9af0a0, 1, 0, 0, H.abilityTimer > 0);
    if (c && c.enemies.length === 1) {
      const def = this.app.tuning.enemies[c.enemies[0].key];
      this.setText('enemyName', def.name, GAME_W - 6, this.top + 24, 0xff8a7a, 1, 1, 0);
    } else this.txt.enemyName.setVisible(false);

    const combo = c?.combo ?? 0;
    const broke = now < this.comboBreakUntil;
    const pop = now < this.comboPopUntil ? 1 : 0;
    this.setText('combo', broke ? 'X' : `${combo}`, 10, this.splitY + 8 - pop, broke ? 0xff5a5a : combo >= 10 ? 0xffd23a : WHITE, 2);
    const cw = textWidth(broke ? 'X' : `${combo}`, 2);
    this.setText('comboLabel', broke ? 'BREAK' : 'COMBO', 14 + cw, this.splitY + 15, broke ? 0xff5a5a : 0x9a94b0);
    const sp = c ? c.speedMult() : 1;
    this.setText('speed', `SPD x${sp.toFixed(2)}`, GAME_W - 8, this.splitY + 8, sp > 1.01 ? 0xffb03a : 0x9a94b0, 1, 1, 0);
    if (S.comboTiers && c) {
      const tm = combo >= this.app.tuning.tiers.t3 ? this.app.tuning.tiers.m3 : combo >= this.app.tuning.tiers.t2 ? this.app.tuning.tiers.m2 : combo >= this.app.tuning.tiers.t1 ? this.app.tuning.tiers.m1 : 1;
      this.setText('tier', `DMG x${tm}`, GAME_W - 8, this.splitY + 18, tm > 1 ? 0xffd23a : 0x6a6480, 1, 1, 0);
    } else this.txt.tier.setVisible(false);

    const ready = !!c?.finisherReady;
    this.setText('meterLabel', ready ? 'FINISHER READY' : 'FINISHER', this.meter.x, this.meter.y - 10, ready ? 0xffd23a : 0x6a6480, 1, 0, 0, run.phase === 'fight');
    if (S.finisherInput === 'button') {
      const b = this.button;
      const dmg = c ? Math.round(c.combo * (this.app.tuning.hero.comboPower + H.bonusComboPower)) : 0;
      this.setText('button', ready ? `FINISH ${dmg}` : 'FINISHER', b.x + b.w / 2, b.y + b.h / 2 - 1, ready ? INK : 0x6a6480, 1, 0.5, 0.5, true);
      this.txt.hint.setVisible(false);
    } else {
      this.txt.button.setVisible(false);
      this.setText('hint', ready ? 'SWIPE UP!' : 'SWIPE UP WHEN FULL', GAME_W / 2, this.button.y + 22, ready ? 0xffb03a : 0x6a6480, 1, 0.5, 0);
    }

    const d = this.app.lastTap;
    const showDbg = this.app.panelOpen;
    this.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, GAME_W / 2, GAME_H - this.app.layout.safeBottom - 10, 0x6a6480, 1, 0.5, 0, showDbg);
  }

  private drawOverlay(now: number): void {
    const g = this.gTop;
    g.clear();
    const run = this.app.run;
    const ph = run.phase;
    if (now < this.screenFlashUntil) {
      g.fillStyle(this.screenFlashColor, Math.min(0.6, (this.screenFlashUntil - now) / 250));
      g.fillRect(0, 0, GAME_W, GAME_H);
    }
    const ov = ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3'];
    const hideOv = () => ov.forEach((k) => this.txt[k].setVisible(false));
    this.boostTexts.forEach((t) => t.setVisible(false));
    const dim = (a: number) => {
      g.fillStyle(0x05040a, a);
      g.fillRect(0, 0, GAME_W, GAME_H);
    };
    const blink = Math.floor(now / 450) % 2 === 0;
    const cy = Math.round(GAME_H * 0.36);
    if (ph === 'title') {
      dim(0.7);
      this.setText('ovTitle', 'COMBO QUEST 3', GAME_W / 2, cy - 30, 0xffd23a, 2, 0.5, 0.5);
      this.setText('ovSub', 'WORKING TITLE - M1', GAME_W / 2, cy - 12, 0x9a94b0, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP WHEN THE LINE IS ON A BLOCK', GAME_W / 2, cy + 14, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine2', 'BLOCK RED - AVOID PURPLE', GAME_W / 2, cy + 26, 0xff8a7a, 1, 0.5, 0.5);
      this.setText('ovLine3', 'TAP TO START', GAME_W / 2, cy + 52, 0xffd23a, 1, 0.5, 0.5, blink);
    } else if (ph === 'boost') {
      dim(0.75);
      const won = run.combat?.result === 'won';
      this.setText('ovTitle', won ? 'VICTORY!' : 'ENEMY DOWN!', GAME_W / 2, this.cardRect(0).y - 30, 0xffd23a, 2, 0.5, 0.5);
      this.setText('ovSub', 'CHOOSE A BOOST', GAME_W / 2, this.cardRect(0).y - 12, WHITE, 1, 0.5, 0.5);
      ['ovLine1', 'ovLine2', 'ovLine3'].forEach((k) => this.txt[k].setVisible(false));
      run.boostChoices.forEach((id, i) => {
        const r = this.cardRect(i);
        g.fillStyle(INK, 1);
        g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 3);
        g.fillStyle(0x2a2450, 1);
        g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle(0x4a4280, 1);
        g.fillRect(r.x, r.y, r.w, 2);
        const [name, val] = boostLabel(this.app.tuning, id);
        const a = this.boostTexts[i * 2];
        const b = this.boostTexts[i * 2 + 1];
        a.setText(fontText(name)).setPosition(r.x + 8, r.y + r.h / 2).setTint(WHITE).setOrigin(0, 0.5).setScale(1).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + r.w - 8, r.y + r.h / 2).setTint(0xffd23a).setOrigin(1, 0.5).setScale(2).setVisible(true);
      });
    } else if (ph === 'levelClear') {
      dim(0.7);
      this.setText('ovTitle', 'LEVEL CLEAR!', GAME_W / 2, cy - 10, 0xffd23a, 2, 0.5, 0.5);
      this.setText('ovSub', `${run.level.name} DONE`, GAME_W / 2, cy + 8, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP FOR NEXT LEVEL', GAME_W / 2, cy + 34, 0xffd23a, 1, 0.5, 0.5, blink);
      this.txt.ovLine2.setVisible(false);
      this.txt.ovLine3.setVisible(false);
    } else if (ph === 'defeat') {
      dim(0.7);
      this.setText('ovTitle', 'DEFEATED', GAME_W / 2, cy - 10, 0xff5a5a, 2, 0.5, 0.5);
      this.setText('ovSub', 'ROWAN FALLS...', GAME_W / 2, cy + 8, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP TO RETRY LEVEL', GAME_W / 2, cy + 34, 0xffd23a, 1, 0.5, 0.5, blink);
      this.txt.ovLine2.setVisible(false);
      this.txt.ovLine3.setVisible(false);
    } else if (this.app.userPaused) {
      dim(0.6);
      this.setText('ovTitle', 'PAUSED', GAME_W / 2, cy, WHITE, 2, 0.5, 0.5);
      this.setText('ovSub', 'TAP TO RESUME', GAME_W / 2, cy + 20, 0xffd23a, 1, 0.5, 0.5, blink);
      ['ovLine1', 'ovLine2', 'ovLine3'].forEach((k) => this.txt[k].setVisible(false));
    } else hideOv();
  }

  private updateFloaters(now: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      const age = now - f.born;
      if (age > f.life) {
        this.killFloater(f);
        this.floaters.splice(i, 1);
        continue;
      }
      const k = age / f.life;
      const popS = f.pop && age < 80 ? f.scale + 1 : f.scale;
      f.t.setScale(popS);
      f.t.setPosition(Math.round(f.x), Math.round(f.y + (f.vy * age) / 1000));
      f.t.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
  }
}

