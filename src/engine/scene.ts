// Phaser scene (landscape 437x201): renders the core state and plays the juice. Reads input only through App.
import Phaser from 'phaser';
import { isRed, type Block, type BlockKind, type Combat, type CombatEvent } from '../core/combat';
import { boostLabel, type Phase } from '../core/run';
import type { App, View } from './app';
import { buildArt, HERO_FEET_X, HERO_W, ICONS } from './art';
import { buildFont, FONT, fontText, textWidth } from './font';
import { GAME_H, GAME_W } from './layout';

const COL = {
  yellow: [0xf2c230, 0xffe680, 0xb08a10],
  green: [0x4fc45a, 0xa4f2a8, 0x2e8a3a],
  red: [0xe0463c, 0xff8a7a, 0x9a2a24],
  purple: [0x9b4fd6, 0xd6a4ff, 0x6a2a9a],
} as const;
const kindCol = (k: BlockKind) => (k === 'yellow' ? COL.yellow : k === 'green' ? COL.green : k === 'purple' ? COL.purple : COL.red);
const ENEMY_COL: Record<string, number> = { slime: 0x4fc4a0, bigslime: 0x4fc4a0, boar: 0x8a5a34, bandit: 0x5a4a6a };

const WHITE = 0xffffff;
const PANEL = 0x18122a;
const INK = 0x0a0812;
const SPRITE_SCALE = 2;
const DASH_MS = 70;
const RETURN_MS = 190;
const ENGAGE_MS = 750;
const LEAP_MS = 260;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface EnemyView {
  id: number;
  sprite: string;
  img: Phaser.GameObjects.Image;
  homeX: number;
  x: number;
  y: number; // feet
  pose: string;
  poseUntil: number;
  flashUntil: number;
  knockUntil: number;
  lunge: { t0: number; dist: number; ms: number } | null;
  dieAt: number;
  phase: number;
  hpShown: number;
}

interface HeroAnim {
  state: 'idle' | 'dash' | 'engaged' | 'return' | 'leap';
  x: number;
  y: number;
  fromX: number;
  toX: number;
  t0: number;
  pose: string;
  poseUntil: number;
  lastAction: number;
  alt: boolean;
  hurtUntil: number;
  flashUntil: number;
  flashColor: number;
}

interface Floater {
  t: Phaser.GameObjects.BitmapText;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
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
  g: number;
  born: number;
  life: number;
  color: number;
  size: number;
  world: boolean;
  streak: boolean;
}

interface Pending {
  at: number; // anim time
  fn: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ease = (k: number) => 1 - (1 - k) * (1 - k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const inRect = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

export class FightScene extends Phaser.Scene implements View {
  private app!: App;
  // layout (game px)
  private L = 0;
  private R = GAME_W;
  private B = GAME_H;
  private splitY = 132;
  private ground = 122;
  private heroHome = 70;
  private bar: Rect = { x: 0, y: 0, w: 0, h: 18 };
  private button: Rect = { x: 0, y: 0, w: 0, h: 0 };
  // objects
  private world!: Phaser.GameObjects.Container;
  private back!: Phaser.GameObjects.Container;
  private actors!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Image[] = [];
  private gShadow!: Phaser.GameObjects.Graphics;
  private gFx!: Phaser.GameObjects.Graphics;
  private gPanel!: Phaser.GameObjects.Graphics;
  private gBar!: Phaser.GameObjects.Graphics;
  private gTop!: Phaser.GameObjects.Graphics;
  private hero!: Phaser.GameObjects.Image;
  private txt: Record<string, Phaser.GameObjects.BitmapText> = {};
  private boostTexts: Phaser.GameObjects.BitmapText[] = [];
  private enemies = new Map<number, EnemyView>();
  private floaters: Floater[] = [];
  private pool: Phaser.GameObjects.BitmapText[] = [];
  private particles: Particle[] = [];
  private pending: Pending[] = [];
  private lastCombat: Combat | null = null;
  private h: HeroAnim = this.freshHero();
  // clocks / juice
  private anim = 0; // scene animation clock (ms); pauses during hit-freeze
  private lastNow = 0;
  private freezeUntil = 0;
  private shakeUntil = 0;
  private shakeMag = 0;
  private screenFlashUntil = 0;
  private screenFlashColor = WHITE;
  private comboPopAt = 0;
  private comboBreakUntil = 0;
  private cursorPulseAt = 0;
  private cursorPulseColor = WHITE;
  private barShakeUntil = 0;
  private slashes: Array<{ x: number; y: number; at: number; big: boolean; dir: number; color: number }> = [];
  private rings: Array<{ x: number; y: number; at: number; r: number; color: number; world: boolean }> = [];
  private explodeFx: { x: number; r: number; until: number } | null = null;
  private heroHpShown = 0;
  private lastMilestone = 0;

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
    this.back = this.add.container(0, 0);
    this.actors = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    this.world.add([this.back, this.actors, this.fxLayer]);
    this.gPanel = this.add.graphics().setDepth(10);
    this.gBar = this.add.graphics().setDepth(11);
    this.gTop = this.add.graphics().setDepth(30);
    const mk = (key: string, depth = 12) => (this.txt[key] = this.add.bitmapText(0, 0, FONT, '').setDepth(depth));
    ['level', 'heroName', 'heroHp', 'ability', 'combo', 'comboLabel', 'speed', 'tier', 'button', 'button2', 'enemyName', 'enemyHp', 'debug'].forEach((k) => mk(k));
    ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3'].forEach((k) => mk(k, 32));
    for (let i = 0; i < 6; i++) this.boostTexts.push(this.add.bitmapText(0, 0, FONT, '').setDepth(32));
    this.lastNow = performance.now();
    this.onLayout();
    this.heroHpShown = this.app.run.hero.hp;
    this.app.sceneReady = true;
  }

  private freshHero(): HeroAnim {
    return {
      state: 'idle',
      x: this.heroHome,
      y: 0,
      fromX: this.heroHome,
      toX: this.heroHome,
      t0: 0,
      pose: 'idle0',
      poseUntil: 0,
      lastAction: 0,
      alt: false,
      hurtUntil: 0,
      flashUntil: 0,
      flashColor: WHITE,
    };
  }

  // ------------------------------------------------------------------ layout

  onLayout(): void {
    const l = this.app.layout;
    this.L = l.safeLeft;
    this.R = GAME_W - l.safeRight;
    this.B = GAME_H - l.safeBottom;
    this.splitY = Math.round(this.B - 60);
    this.ground = this.splitY - 9;
    this.heroHome = this.L + 42;
    const btnW = 56;
    this.button = { x: this.R - btnW - 2, y: this.splitY + 6, w: btnW, h: this.B - this.splitY - 10 };
    this.bar = { x: this.L + 6, y: this.splitY + 26, w: this.button.x - 8 - (this.L + 6), h: 18 };

    // Tear down everything built for the previous layout before regenerating textures.
    for (const f of this.floaters) f.t.destroy();
    for (const t of this.pool) t.destroy();
    this.floaters = [];
    this.pool = [];
    this.particles = [];
    this.pending = [];
    this.slashes = [];
    this.rings = [];
    this.back.removeAll(true);
    this.actors.removeAll(true);
    this.fxLayer.removeAll(true);
    buildArt(this, GAME_W, this.splitY, this.ground - 4);
    this.back.add(this.add.image(0, 0, 'bg').setOrigin(0, 0));
    this.clouds = [0, 1].map((i) => this.add.image(i * GAME_W, 6, 'clouds').setOrigin(0, 0).setAlpha(0.9));
    this.back.add(this.clouds);
    this.gShadow = this.add.graphics();
    this.back.add(this.gShadow);
    this.hero = this.add.image(this.heroHome, this.ground, 'hero_idle0').setScale(SPRITE_SCALE);
    this.actors.add(this.hero);
    this.gFx = this.add.graphics();
    this.fxLayer.add(this.gFx);
    this.enemies.clear();
    this.lastCombat = null;
    this.h = this.freshHero();
  }

  // ------------------------------------------------------------------ input helpers (game px)

  finisherButtonHit(x: number, y: number): boolean {
    return this.app.settings.finisherInput === 'button' && this.app.run.phase === 'fight' && inRect(this.button, x, y, 4);
  }

  enemyAt(x: number, y: number): number | null {
    for (const v of this.enemies.values()) {
      if (v.dieAt) continue;
      const b = v.img.getBounds();
      if (inRect({ x: b.x, y: b.y, w: b.width, h: b.height }, x, y, 6)) return v.id;
    }
    return null;
  }

  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++) if (inRect(this.cardRect(i), x, y)) return i;
    return -1;
  }

  private cardRect(i: number): Rect {
    const w = 112;
    const gap = 10;
    const x0 = Math.round(GAME_W / 2 - (w * 3 + gap * 2) / 2);
    return { x: x0 + i * (w + gap), y: 74, w, h: 64 };
  }

  // ------------------------------------------------------------------ events

  onPhase(_prev: Phase, next: Phase): void {
    if (next === 'fight') this.syncEnemies(true);
    if (next !== 'fight' && this.h.state !== 'idle') this.heroReturn();
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
          const perfect = e.perfect;
          this.judge(x, perfect ? 'PERFECT!' : e.crit ? 'CRIT!' : 'HIT', perfect ? 0xfff07a : e.crit ? 0xff9a3a : WHITE, perfect || e.crit);
          this.cursorPulse(perfect ? 0xfff07a : kindCol(e.kind)[1]);
          if (perfect) this.sparkle(x, this.bar.y + this.bar.h / 2);
          this.comboPopAt = now;
          this.milestone(e.combo);
          this.heroAttack(e.enemyId, e.damage, e.crit, perfect);
          break;
        }
        case 'block': {
          const x = this.barX(e.pos);
          this.judge(x, e.perfect ? 'PERFECT!' : e.cracked ? 'CRACK' : 'BLOCK', e.perfect ? 0xfff07a : 0x7ae0ff, e.perfect);
          this.cursorPulse(0x7ae0ff);
          this.comboPopAt = now;
          this.milestone(e.combo);
          this.heroParry(e.ownerId, e.cracked);
          if (e.cracked) this.burst(x, this.bar.y + this.bar.h / 2, 0xc8d0e0, 5, false);
          break;
        }
        case 'trap':
          this.judge(this.barX(e.pos), 'TRAP!', COL.purple[1], true);
          this.enemyLunge(e.enemyId, 1);
          this.screenFlash(COL.purple[0], now, 160);
          break;
        case 'miss':
          this.judge(this.barX(e.pos), 'MISS', 0x9a94b0, false);
          this.barShakeUntil = now + 140;
          if (this.h.state === 'idle') this.setHeroPose('windup', 120);
          break;
        case 'remove': {
          const y = this.bar.y + this.bar.h / 2;
          if (e.reason === 'expire') {
            this.burst(this.barX(e.pos), y, kindCol(e.kind)[2], 5, false, 0.4);
            break;
          }
          const big = e.reason === 'hit' || e.reason === 'bomb';
          this.burst(this.barX(e.pos), y, kindCol(e.kind)[0], big ? 12 : 6, false);
          this.burst(this.barX(e.pos), y, kindCol(e.kind)[1], big ? 6 : 3, false);
          break;
        }
        case 'windup': {
          const v = this.enemies.get(e.enemyId);
          if (v) this.setEnemyPose(v, 'windup', 170);
          break;
        }
        case 'heroHurt': {
          if (e.source === 'red' || e.source === 'bomb') this.enemyLunge(e.enemyId, 0.8);
          const delay = e.source === 'red' || e.source === 'bomb' ? 70 : 0;
          this.later(delay, () => {
            this.h.hurtUntil = this.anim + 220;
            this.h.flashUntil = this.anim + J.flashMs * 1.5;
            this.h.flashColor = 0xff3030;
            if (e.damage > 0 || this.app.settings.godMode) this.floatNum(this.h.x, this.ground - 50, `-${e.damage}`, 0xff5a5a, 2);
            this.burst(this.h.x + 6, this.ground - 22, 0xff5a5a, e.source === 'miss' ? 3 : 10, true);
            this.shake(e.source === 'miss' ? J.shakeMinPx : J.shakeMaxPx, J.shakeMs);
          });
          if (this.h.state === 'engaged') this.heroReturn();
          break;
        }
        case 'enemyHurt': {
          if (e.source !== 'bomb') break; // hits and finishers show damage when the blow lands
          this.enemyHurtFx(e.enemyId, e.damage, false, false);
          break;
        }
        case 'kill': {
          const id = e.enemyId;
          this.later(this.h.state === 'dash' ? DASH_MS : 0, () => {
            const v = this.enemies.get(id);
            if (!v) return;
            v.dieAt = this.anim;
            const cy = v.y - v.img.displayHeight / 2;
            this.burst(v.x, cy, ENEMY_COL[v.sprite] ?? WHITE, 26, true, 1.4);
            this.burst(v.x, cy, 0xffffff, 12, true, 1.2);
            this.ring(v.x, cy, 40, 0xffe680, true);
            this.shake(J.shakeMaxPx, J.shakeMs * 1.8);
            this.freeze(90);
          });
          break;
        }
        case 'explode':
          this.explodeFx = { x: this.barX(e.pos), r: e.radius * this.bar.w, until: now + 260 };
          this.shake(J.shakeMaxPx, J.shakeMs * 1.5);
          this.floatNum(GAME_W / 2, this.splitY - 70, 'BOOM!', 0xff8a3a, 3);
          break;
        case 'finisher':
          this.heroFinisher(e.damage);
          break;
        case 'ability':
          this.floatNum(this.h.x, this.ground - 62, 'KEEN EDGE', 0x9af0a0, 1);
          break;
        case 'speedUp':
          this.judge(this.bar.x + this.bar.w / 2, 'SPEED UP!', 0xff9a3a, true, -14);
          break;
        case 'comboBreak':
          this.comboBreakUntil = now + 420;
          this.lastMilestone = 0;
          break;
        case 'meterFull':
          this.judge(this.button.x + this.button.w / 2, 'READY!', 0xffb03a, true, -2);
          break;
        case 'revive':
          this.screenFlash(0x9af0a0, now, 320);
          this.floatNum(this.heroHome + 20, this.ground - 70, 'REVIVED!', 0x9af0a0, 2);
          break;
      }
    }
  }

  // ------------------------------------------------------------------ choreography

  private later(ms: number, fn: () => void): void {
    if (ms <= 0) fn();
    else this.pending.push({ at: this.anim + ms, fn });
  }

  private setHeroPose(pose: string, ms: number): void {
    this.h.pose = pose;
    this.h.poseUntil = this.anim + ms;
  }

  private standX(v: EnemyView): number {
    return Math.round(v.homeX - v.img.displayWidth / 2 - 22);
  }

  private heroAttack(enemyId: number, damage: number, crit: boolean, perfect: boolean): void {
    const v = this.enemies.get(enemyId);
    const h = this.h;
    h.lastAction = this.anim;
    h.alt = !h.alt;
    const slash = h.alt ? 'slashA' : 'slashB';
    if (!v) {
      this.setHeroPose(slash, 110);
      return;
    }
    const target = this.standX(v);
    let arrive = 0;
    if (h.state === 'idle' || h.state === 'return' || Math.abs(target - h.x) > 6) {
      h.state = 'dash';
      h.fromX = h.x;
      h.toX = target;
      h.t0 = this.anim;
      arrive = Math.abs(target - h.x) > 6 ? DASH_MS : 0;
      this.burst(h.x - 6, this.ground - 2, 0xc8b090, 4, true, 0.5);
    }
    this.later(arrive, () => {
      if (h.state === 'dash') {
        h.state = 'engaged';
        h.x = h.toX;
      }
      this.setHeroPose(slash, 110);
      this.enemyHurtFx(enemyId, damage, crit, perfect);
    });
  }

  private enemyHurtFx(enemyId: number, damage: number, crit: boolean, perfect: boolean, finisher = false): void {
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const J = this.app.tuning.juice;
    const cy = v.y - v.img.displayHeight / 2;
    v.flashUntil = this.anim + J.flashMs;
    v.knockUntil = this.anim + (crit || finisher ? 140 : 90);
    if (!v.dieAt) this.setEnemyPose(v, 'hurt', 140);
    const big = crit || finisher;
    const col = finisher ? 0xff8a2a : crit ? 0xffd23a : perfect ? 0xfff07a : WHITE;
    this.floatNum(v.x + rand(-6, 6), v.y - v.img.displayHeight - 6, `${damage}${crit ? '!' : ''}`, col, big ? 3 : 2);
    this.slashes.push({ x: v.x, y: cy, at: this.anim, big, dir: this.h.alt ? 1 : -1, color: crit ? 0xffd23a : WHITE });
    this.burst(v.x - 4, cy, WHITE, big ? 14 : 7, true, big ? 1.5 : 1, true);
    if (big) this.ring(v.x, cy, 26, col, true);
    this.shake(big ? J.shakeMaxPx : J.shakeMinPx, J.shakeMs * (big ? 1.4 : 0.7));
    this.freeze(big ? 80 : 45);
  }

  private heroParry(ownerId: number, cracked: boolean): void {
    const h = this.h;
    h.lastAction = this.anim;
    this.setHeroPose('parry', 150);
    const sx = h.x + 14;
    const sy = this.ground - 34;
    this.burst(sx, sy, 0x7ae0ff, cracked ? 6 : 10, true, 1, true);
    this.burst(sx, sy, WHITE, 4, true, 0.8, true);
    this.ring(sx, sy, 14, 0x7ae0ff, true);
    const v = this.enemies.get(ownerId);
    if (v && !v.dieAt) {
      v.knockUntil = this.anim + 80;
      this.setEnemyPose(v, 'attack', 90);
    }
    this.shake(this.app.tuning.juice.shakeMinPx, 60);
  }

  private heroFinisher(damage: number): void {
    const c = this.app.run.combat;
    const h = this.h;
    const alive = c ? c.enemies.filter((e) => e.alive) : [];
    const views = alive.map((e) => this.enemies.get(e.id)).filter((v): v is EnemyView => !!v);
    const front = views.slice().sort((a, b) => a.homeX - b.homeX)[0];
    h.state = 'leap';
    h.fromX = h.x;
    h.toX = front ? this.standX(front) : h.x + 60;
    h.t0 = this.anim;
    h.lastAction = this.anim + LEAP_MS;
    this.floatNum(GAME_W / 2, this.splitY - 92, 'FINISHER!', 0xffb03a, 3);
    this.later(LEAP_MS * 0.75, () => {
      this.screenFlash(WHITE, performance.now(), 180);
      for (const v of views) this.enemyHurtFx(v.id, damage, false, false, true);
      for (const v of views) this.slashes.push({ x: v.x, y: v.y - v.img.displayHeight / 2, at: this.anim, big: true, dir: -1, color: 0xffb03a });
      this.shake(this.app.tuning.juice.shakeMaxPx, this.app.tuning.juice.shakeMs * 2);
      this.freeze(110);
    });
  }

  private heroReturn(): void {
    const h = this.h;
    if (h.state === 'idle') return;
    h.state = 'return';
    h.fromX = h.x;
    h.toX = this.heroHome;
    h.t0 = this.anim;
  }

  private setEnemyPose(v: EnemyView, pose: string, ms: number): void {
    v.pose = pose;
    v.poseUntil = this.anim + ms;
  }

  private enemyLunge(id: number, strength: number): void {
    const v = this.enemies.get(id);
    if (!v || v.dieAt) return;
    const reach = Math.max(10, v.homeX - v.img.displayWidth / 2 - (this.h.x + 20));
    v.lunge = { t0: this.anim, dist: reach * strength, ms: 260 };
    this.setEnemyPose(v, 'attack', 200);
  }

  private freeze(ms: number): void {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  private milestone(combo: number): void {
    const marks: Array<[number, string]> = [
      [10, 'NICE!'],
      [25, 'GREAT!'],
      [50, 'AWESOME!'],
      [75, 'INSANE!'],
      [100, 'GODLIKE!'],
    ];
    for (const [n, label] of marks)
      if (combo >= n && this.lastMilestone < n) {
        this.lastMilestone = n;
        this.floatNum(GAME_W / 2, 52, `${n} COMBO - ${label}`, 0xffd23a, 2);
        this.app.audio.ready2();
      }
  }

  // ------------------------------------------------------------------ small fx helpers

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

  private cursorPulse(color: number): void {
    this.cursorPulseAt = performance.now();
    this.cursorPulseColor = color;
  }

  private ring(x: number, y: number, r: number, color: number, world: boolean): void {
    this.rings.push({ x, y, at: performance.now(), r, color, world });
  }

  private judge(x: number, text: string, color: number, pop: boolean, dy = 0): void {
    const w = textWidth(text);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, this.bar.y - 10 + dy, text, color, 1, false, 0, pop ? -40 : -26, pop ? 60 : 0, 520, false);
  }

  private floatNum(x: number, y: number, text: string, color: number, scale: number): void {
    const w = textWidth(text, scale);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, y, text, color, scale, true, rand(-14, 14), -70, 160, 760, true);
  }

  private addFloater(x: number, y: number, text: string, color: number, scale: number, pop: boolean, vx: number, vy: number, g: number, life: number, world: boolean): void {
    const t = this.pool.pop() ?? this.add.bitmapText(0, 0, FONT, '');
    t.setText(fontText(text)).setTint(color).setOrigin(0.5, 0.5).setVisible(true).setAlpha(1).setScale(scale);
    if (t.parentContainer) t.parentContainer.remove(t);
    if (world) {
      this.fxLayer.add(t);
    } else {
      this.add.existing(t);
      t.setDepth(25);
    }
    this.floaters.push({ t, x, y, vx, vy, g, born: performance.now(), life, scale, pop });
    if (this.floaters.length > 30) this.killFloater(this.floaters.shift()!);
  }

  private killFloater(f: Floater): void {
    f.t.setVisible(false);
    if (f.t.parentContainer) f.t.parentContainer.remove(f.t);
    this.pool.push(f.t);
  }

  private burst(x: number, y: number, color: number, n: number, world: boolean, speed = 1, streak = false): void {
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
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private sparkle(x: number, y: number): void {
    const now = performance.now();
    for (let i = 0; i < 10; i++)
      this.particles.push({ x: x + rand(-8, 8), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-80, -30), g: 60, born: now, life: rand(300, 600), color: i % 2 ? 0xfff07a : WHITE, size: 1, world: false, streak: false });
  }

  // ------------------------------------------------------------------ enemies

  private enemyX(slot: number, count: number): number {
    if (count === 1) return this.R - 110;
    return Math.round(this.R - 190 + slot * 62);
  }

  private syncEnemies(force = false): void {
    const c = this.app.run.combat;
    if (!c) return;
    if (c === this.lastCombat && !force) return;
    if (c !== this.lastCombat) {
      for (const v of this.enemies.values()) v.img.destroy();
      this.enemies.clear();
      this.h = this.freshHero();
    }
    this.lastCombat = c;
    for (const e of c.enemies) {
      if (this.enemies.has(e.id) || !e.alive) continue;
      const def = this.app.tuning.enemies[e.key];
      const img = this.add.image(0, 0, `${def.sprite}_idle0`).setOrigin(0.5, 1).setScale(SPRITE_SCALE);
      this.actors.add(img);
      const x = this.enemyX(e.slot, c.enemies.length);
      this.enemies.set(e.id, {
        id: e.id,
        sprite: def.sprite,
        img,
        homeX: x,
        x,
        y: this.ground + (c.enemies.length > 1 ? (e.slot % 2) * 3 : 0),
        pose: 'idle0',
        poseUntil: 0,
        flashUntil: 0,
        knockUntil: 0,
        lunge: null,
        dieAt: 0,
        phase: Math.random() * 1000,
        hpShown: e.hp,
      });
    }
    this.heroHpShown = this.app.run.hero.hp;
  }

  // ------------------------------------------------------------------ frame

  update(): void {
    const now = performance.now();
    const dt = Math.min(100, now - this.lastNow);
    this.lastNow = now;
    if (now >= this.freezeUntil) this.anim += dt;
    this.app.update(now);
    this.syncEnemies();
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (this.anim >= p.at) {
        this.pending.splice(i--, 1);
        p.fn();
      }
    }
    const t = this.app.renderTime(now);
    this.drawWorld(now);
    this.drawPanel(now);
    this.drawBar(t, now);
    this.drawTexts(now);
    this.drawOverlay(now);
    this.updateFloaters(now);
  }

  private updateHero(): void {
    const h = this.h;
    const a = this.anim;
    let yOff = 0;
    if (h.state === 'dash') {
      const k = clamp01((a - h.t0) / DASH_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      if (k >= 1) h.state = 'engaged';
    } else if (h.state === 'leap') {
      const k = clamp01((a - h.t0) / LEAP_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      yOff = -Math.sin(k * Math.PI) * 30;
      if (k >= 1) h.state = 'engaged';
    } else if (h.state === 'return') {
      const k = clamp01((a - h.t0) / RETURN_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      if (k >= 1) {
        h.state = 'idle';
        h.x = this.heroHome;
      }
    } else if (h.state === 'engaged' && a - h.lastAction > ENGAGE_MS) this.heroReturn();

    let pose: string;
    let flip = false;
    if (a < h.hurtUntil) pose = 'hurt';
    else if (h.state === 'leap') pose = a - h.t0 < LEAP_MS * 0.7 ? 'leap' : 'slashA';
    else if (a < h.poseUntil) pose = h.pose;
    else if (h.state === 'dash') pose = 'dash';
    else if (h.state === 'return') {
      pose = 'dash';
      flip = true;
    } else if (h.state === 'engaged') pose = 'windup';
    else pose = Math.floor(a / 420) % 2 ? 'idle1' : 'idle0';
    const knock = a < h.hurtUntil ? -4 : 0;
    h.y = yOff;
    this.hero.setTexture(`hero_${pose}`);
    this.hero.setFlipX(flip);
    this.hero.setOrigin((flip ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W, 1);
    this.hero.setPosition(Math.round(h.x + knock), Math.round(this.ground + yOff));
    if (a < h.flashUntil) this.hero.setTint(h.flashColor).setTintMode(Phaser.TintModes.FILL);
    else this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private drawWorld(now: number): void {
    const run = this.app.run;
    const c = run.combat;
    const g = this.gFx;
    const sh = this.gShadow;
    g.clear();
    sh.clear();
    if (now < this.shakeUntil) {
      const m = Math.round(this.shakeMag);
      this.world.setPosition(Math.round(rand(-m, m)), Math.round(rand(-m, m)));
    } else this.world.setPosition(0, 0);
    const drift = (now * 0.004) % GAME_W;
    this.clouds[0].setX(Math.round(-drift));
    this.clouds[1].setX(Math.round(GAME_W - drift));

    this.updateHero();
    const shadow = (x: number, w: number, alpha = 0.35) => {
      sh.fillStyle(0x000000, alpha);
      sh.fillRect(Math.round(x - w / 2), this.ground - 1, Math.round(w), 2);
      sh.fillRect(Math.round(x - w / 2 + 2), this.ground + 1, Math.round(w - 4), 1);
    };
    shadow(this.h.x + 2, 20 * (1 + this.h.y / 60), 0.35);
    if (run.hero.abilityTimer > 0 && Math.floor(now / 90) % 2 === 0) {
      g.fillStyle(0x9af0a0, 1);
      for (let i = 0; i < 2; i++) g.fillRect(Math.round(this.h.x + rand(-14, 14)), Math.round(this.ground - rand(4, 44)), 1, 2);
    }

    if (c) {
      const target = c.currentTarget();
      const a = this.anim;
      for (const v of this.enemies.values()) {
        const e = c.enemyById(v.id);
        if (!e) continue;
        let x = v.homeX;
        if (v.lunge) {
          const k = (a - v.lunge.t0) / v.lunge.ms;
          if (k >= 1) v.lunge = null;
          else x -= v.lunge.dist * (k < 0.3 ? ease(k / 0.3) : 1 - ease((k - 0.3) / 0.7));
        }
        if (a < v.knockUntil) x += 4;
        v.x = x;
        const flash = a < v.flashUntil;
        let pose = a < v.poseUntil ? v.pose : Math.floor((a + v.phase) / 380) % 2 ? 'idle1' : 'idle0';
        if (flash) pose = 'flash';
        if (v.dieAt) {
          const k = (a - v.dieAt) / 380;
          v.img.setTexture(`${v.sprite}_flash`).setAlpha(Math.max(0, 1 - k)).setScale(SPRITE_SCALE * (1 + k * 0.3), SPRITE_SCALE * (1 - k * 0.5));
          v.img.setPosition(Math.round(x), v.y);
          if (k >= 1) v.img.setVisible(false);
          continue;
        }
        v.img.setTexture(`${v.sprite}_${pose}`).setPosition(Math.round(x), v.y).setScale(SPRITE_SCALE).setAlpha(1);
        shadow(x, v.img.displayWidth * 0.8, 0.3);
        v.hpShown += (e.hp - v.hpShown) * 0.25;
        if (c.enemies.length > 1) {
          const bw = Math.max(26, Math.round(v.img.displayWidth * 0.7));
          const bx = Math.round(v.homeX - bw / 2);
          const by = Math.round(v.y - v.img.displayHeight - 8);
          this.hpBar(g, bx, by, bw, 3, e.hp / e.maxHp, v.hpShown / e.maxHp, 0xe0463c);
          const def = this.app.tuning.enemies[e.key];
          const isTarget = target?.id === e.id;
          this.icon(g, ICONS[def.icon], bx - 7, by - 1, 0xff8a7a);
          if (isTarget) {
            const tx = Math.round(v.homeX);
            const ty = by - 8 + (Math.floor(now / 250) % 2);
            g.fillStyle(WHITE, 1);
            g.fillRect(tx - 3, ty, 7, 1);
            g.fillRect(tx - 2, ty + 1, 5, 1);
            g.fillRect(tx - 1, ty + 2, 3, 1);
            g.fillRect(tx, ty + 3, 1, 1);
          }
        }
      }
    }

    // slash arcs
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      const k = (this.anim - s.at) / (s.big ? 160 : 110);
      if (k >= 1) {
        this.slashes.splice(i, 1);
        continue;
      }
      const r = s.big ? 26 : 17;
      const span = Math.PI * (0.25 + 0.75 * ease(clamp01(k * 1.6)));
      const a0 = s.dir > 0 ? -Math.PI * 0.85 : -Math.PI * 0.15 - span;
      const thick = s.big ? 3 : 2;
      for (let j = 0; j <= 24; j++) {
        const ang = a0 + (span * j) / 24;
        const w = Math.max(1, Math.round(thick * Math.sin((j / 24) * Math.PI) * (1 - k)));
        g.fillStyle(j > 16 ? s.color : WHITE, 1 - k * 0.6);
        g.fillRect(Math.round(s.x + Math.cos(ang) * r), Math.round(s.y + Math.sin(ang) * r * 0.75), w, w);
      }
    }
    this.drawRings(g, now, true);
    this.drawParticles(g, now, true);
  }

  private drawRings(g: Phaser.GameObjects.Graphics, now: number, world: boolean): void {
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

  private hpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, ghost: number, color: number): void {
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x3a3050, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(WHITE, 1);
    g.fillRect(x, y, Math.round(w * clamp01(ghost)), h);
    g.fillStyle(color, 1);
    g.fillRect(x, y, Math.round(w * clamp01(frac)), h);
    if (h >= 4) {
      g.fillStyle(WHITE, 0.35);
      g.fillRect(x, y, Math.round(w * clamp01(frac)), 1);
    }
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
      const y = p.y + p.vy * age + 0.5 * p.g * age * age;
      g.fillStyle(p.color, 1 - (age * 1000) / p.life / 2);
      if (p.streak) {
        // short line along the velocity for impact sparks
        const sp = Math.hypot(p.vx, p.vy) || 1;
        for (let k = 0; k < 3; k++) g.fillRect(Math.round(x - (p.vx / sp) * k), Math.round(y - (p.vy / sp) * k), 1, 1);
      } else g.fillRect(Math.round(x), Math.round(y), p.size, p.size);
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
    g.fillStyle(0x3e3260, 1);
    g.fillRect(0, this.splitY + 2, GAME_W, 1);
    // top HUD strip
    g.fillStyle(INK, 0.5);
    g.fillRect(0, 0, GAME_W, 22);

    // hero HP
    const H = run.hero;
    const maxHp = this.app.tuning.hero.maxHp + H.bonusMaxHp;
    this.heroHpShown += (H.hp - this.heroHpShown) * 0.2;
    this.hpBar(g, this.L + 4, 13, 96, 5, H.hp / maxHp, this.heroHpShown / maxHp, 0x5ad06a);
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(this.L + 4, 20, Math.round(96 * (H.abilityTimer / Math.max(0.01, this.app.tuning.hero.abilitySec))), 1);
    }
    // single enemy HP (group fights show bars over heads)
    if (c && c.enemies.length === 1) {
      const e = c.enemies[0];
      const v = this.enemies.get(e.id);
      const w = 110;
      const x = this.R - 50 - w;
      this.hpBar(g, x, 13, w, 5, e.hp / e.maxHp, (v?.hpShown ?? e.hp) / e.maxHp, 0xe0463c);
    }
    if (!c) return;

    // finisher button, with the meter filling it from the bottom
    const b = this.button;
    const ready = c.finisherReady;
    const swipe = this.app.settings.finisherInput === 'swipe';
    const pulse = ready && Math.floor(now / 140) % 2 === 0;
    g.fillStyle(INK, 1);
    g.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 5);
    g.fillStyle(swipe ? 0x1e1830 : 0x2a2244, 1);
    g.fillRect(b.x, b.y, b.w, b.h);
    const fh = Math.round((b.h - 4) * c.meter);
    g.fillStyle(ready ? (pulse ? 0xffd24a : 0xff9a2a) : 0xc8681e, 1);
    g.fillRect(b.x + 2, b.y + b.h - 2 - fh, b.w - 4, fh);
    if (fh > 0) {
      g.fillStyle(ready ? 0xfff0b0 : 0xffb060, 1);
      g.fillRect(b.x + 2, b.y + b.h - 2 - fh, b.w - 4, 1);
    }
    g.fillStyle(ready ? 0xfff0b0 : 0x4a4070, 1);
    g.fillRect(b.x, b.y, b.w, 2);
    g.fillStyle(INK, 0.6);
    g.fillRect(b.x, b.y + b.h - 2, b.w, 2);
    if (ready) {
      g.lineStyle(1, pulse ? 0xffffff : 0xffd24a, 1);
      g.strokeRect(b.x - 3.5, b.y - 3.5, b.w + 7, b.h + 8);
    }
  }

  private drawBar(t: number, now: number): void {
    const g = this.gBar;
    g.clear();
    const c = this.app.run.combat;
    const B = this.bar;
    const bx = now < this.barShakeUntil ? Math.round(rand(-2, 2)) : 0;
    g.fillStyle(INK, 1);
    g.fillRect(B.x - 3 + bx, B.y - 3, B.w + 6, B.h + 6);
    g.fillStyle(0x4a3e70, 1);
    g.fillRect(B.x - 2 + bx, B.y - 2, B.w + 4, 1);
    g.fillStyle(0x2a2244, 1);
    g.fillRect(B.x + bx, B.y, B.w, B.h);
    g.fillStyle(0x221c38, 1);
    g.fillRect(B.x + bx, B.y + B.h - 4, B.w, 4);
    g.fillStyle(0x342a52, 1);
    for (let i = 1; i < 10; i++) g.fillRect(Math.round(B.x + bx + (B.w * i) / 10), B.y + B.h - 3, 1, 3);
    // the left end is where enemy attacks land
    g.fillStyle(0xe0463c, 0.5);
    g.fillRect(B.x + bx, B.y, 2, B.h);
    if (!c) return;

    const perfectFrac = this.app.tuning.judge.perfectFrac;
    const group = c.enemies.length > 1;
    for (const b of c.blocks) if (!isRed(b.kind)) this.drawBlock(g, b, c, t, now, perfectFrac, group, bx);
    for (const b of c.blocks) if (isRed(b.kind)) this.drawBlock(g, b, c, t, now, perfectFrac, group, bx);

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 260;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 4, r * 2, B.h + 8);
    }

    // cursor (trail at higher speeds, pulse on hits)
    const speed = c.speedMult();
    if (speed > 1.2) {
      for (let i = 1; i <= 3; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.01) * B.w) + bx;
        g.fillStyle(0xffffff, 0.3 / i);
        g.fillRect(px - 1, B.y - 2, 2, B.h + 4);
      }
    }
    const cx = Math.round(B.x + c.cursorPosAt(t) * B.w) + bx;
    const hot = speed >= this.app.tuning.cursor.maxSpeedMult - 0.01;
    const pk = (now - this.cursorPulseAt) / 160;
    if (pk < 1) {
      const pw = Math.round(2 + 6 * (1 - pk));
      g.fillStyle(this.cursorPulseColor, 0.6 * (1 - pk));
      g.fillRect(cx - pw, B.y - 5, pw * 2, B.h + 10);
    }
    g.fillStyle(INK, 1);
    g.fillRect(cx - 2, B.y - 6, 4, B.h + 12);
    g.fillStyle(hot ? 0xffb03a : WHITE, 1);
    g.fillRect(cx - 1, B.y - 5, 2, B.h + 10);
    g.fillRect(cx - 3, B.y - 8, 6, 2);
    g.fillRect(cx - 3, B.y + B.h + 6, 6, 2);

    this.drawRings(g, now, false);
    this.drawParticles(g, now, false);
  }

  private drawBlock(g: Phaser.GameObjects.Graphics, b: Block, c: Combat, t: number, now: number, perfectFrac: number, group: boolean, bx: number): void {
    const B = this.bar;
    const pos = c.blockPosAt(b, t);
    const w = Math.max(4, Math.round(b.width * B.w));
    const x = Math.round(B.x + pos * B.w - w / 2) + bx;
    const y = B.y + 2;
    const h = B.h - 4;
    if (b.kind === 'purple' && b.life < 1 && Math.floor(now / 90) % 2 === 0) return;
    const [base, light, dark] = kindCol(b.kind);
    if (b.push > 0)
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(light, 0.45 / i);
        g.fillRect(x - i * 6, y + 2, w, h - 4);
      }
    const impacting = b.impactTimer >= 0 && Math.floor(now / 40) % 2 === 0;
    // fresh blocks pop in
    const age = c.time - b.bornAt;
    const grow = age < 0.08 ? Math.round((1 - age / 0.08) * 3) : 0;
    g.fillStyle(INK, 1);
    g.fillRect(x - 1 - grow, y - 1 - grow, w + 2 + grow * 2, h + 2 + grow * 2);
    g.fillStyle(impacting ? WHITE : base, 1);
    g.fillRect(x - grow, y - grow, w + grow * 2, h + grow * 2);
    g.fillStyle(light, 1);
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 1, h);
    g.fillStyle(dark, 1);
    g.fillRect(x, y + h - 2, w, 2);
    g.fillRect(x + w - 1, y, 1, h);
    // perfect zone
    const pw = Math.max(1, Math.round(w * perfectFrac));
    g.fillStyle(light, 0.5);
    g.fillRect(Math.round(x + (w - pw) / 2), y + 2, pw, h - 4);
    if (b.kind === 'shield') {
      g.fillStyle(0xdfe6f2, 1);
      g.fillRect(x, y, 2, h);
      g.fillRect(x + w - 2, y, 2, h);
      if (b.taps <= 1) {
        g.fillStyle(INK, 1);
        g.fillRect(x + 3, y + 2, 1, 4);
        g.fillRect(x + 4, y + 6, 1, 3);
        g.fillRect(x + 3, y + 9, 1, 3);
      }
    }
    const cx = Math.round(x + w / 2 - 2.5);
    if (isRed(b.kind)) {
      const variant = b.kind === 'red' ? null : ICONS[b.kind];
      const owner = c.enemyById(b.ownerId);
      const ownerIcon = owner ? ICONS[this.app.tuning.enemies[owner.key].icon] : null;
      if (variant) {
        this.icon(g, variant, cx, y + h - 7, b.kind === 'speed' ? 0xffe680 : INK);
        if (group && ownerIcon) this.icon(g, ownerIcon, cx, y + 1, WHITE);
      } else if (ownerIcon) this.icon(g, ownerIcon, cx, y + Math.round((h - 5) / 2), WHITE);
    } else if (b.kind === 'purple') {
      g.fillStyle(INK, 1);
      g.fillRect(cx + 1, y + 2, 3, 1);
      g.fillRect(cx + 2, y + 3, 1, 4);
      g.fillRect(cx + 2, y + 8, 1, 1);
    } else if (b.kind === 'green') {
      g.fillStyle(WHITE, 1);
      g.fillRect(cx + 2, y + 2, 1, 5);
      g.fillRect(cx, y + 4, 5, 1);
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
    const T = this.app.tuning;
    const maxHp = T.hero.maxHp + H.bonusMaxHp;
    const lvl = run.level;
    const stageInfo = lvl.stages.length > 1 ? ` - ${run.stageIndex + 1}/${lvl.stages.length}` : '';
    this.setText('level', `${lvl.name}${stageInfo}`, GAME_W / 2, 3, 0xc8c0e8, 1, 0.5, 0);
    this.setText('heroName', 'ROWAN', this.L + 4, 3, WHITE);
    this.setText('heroHp', `${Math.ceil(H.hp)}/${maxHp}`, this.L + 104, 12, 0x9af0a0);
    this.setText('ability', 'KEEN EDGE', this.L + 40, 3, 0x9af0a0, 1, 0, 0, H.abilityTimer > 0);
    if (c && c.enemies.length === 1) {
      const e = c.enemies[0];
      const def = T.enemies[e.key];
      this.setText('enemyName', def.name, this.R - 50, 3, 0xff8a7a, 1, 1, 0);
      this.setText('enemyHp', `${Math.ceil(e.hp)}`, this.R - 50 - 114, 12, 0xff8a7a, 1, 1, 0);
    } else {
      this.txt.enemyName.setVisible(false);
      this.txt.enemyHp.setVisible(false);
    }

    const combo = c?.combo ?? 0;
    const broke = now < this.comboBreakUntil;
    const pk = (now - this.comboPopAt) / 140;
    const pop = pk < 1 ? 1 + 0.5 * (1 - pk) : 1;
    const comboCol = broke ? 0xff5a5a : combo >= 50 ? 0xff6a3a : combo >= 25 ? 0xffa03a : combo >= 10 ? 0xffd23a : WHITE;
    const cs = 2;
    this.setText('combo', broke ? 'X' : `${combo}`, this.bar.x + 2, this.splitY + 13, comboCol, cs * (1 + (pop - 1) * 0.6), 0, 0.5);
    const cw = textWidth(broke ? 'X' : `${combo}`, cs);
    this.setText('comboLabel', broke ? 'BREAK!' : 'COMBO', this.bar.x + 6 + cw, this.splitY + 14, broke ? 0xff5a5a : 0x9a94b0, 1, 0, 0.5);
    const sp = c ? c.speedMult() : 1;
    this.setText('speed', `SPEED x${sp.toFixed(2)}`, this.bar.x + this.bar.w, this.splitY + 14, sp > 1.01 ? 0xffb03a : 0x6a6480, 1, 1, 0.5);
    if (S.comboTiers && c) {
      const tm = combo >= T.tiers.t3 ? T.tiers.m3 : combo >= T.tiers.t2 ? T.tiers.m2 : combo >= T.tiers.t1 ? T.tiers.m1 : 1;
      this.setText('tier', `DMG x${tm}`, this.bar.x + this.bar.w - 84, this.splitY + 14, tm > 1 ? 0xffd23a : 0x6a6480, 1, 1, 0.5);
    } else this.txt.tier.setVisible(false);

    const ready = !!c?.finisherReady;
    const b = this.button;
    const fight = run.phase === 'fight';
    const dmg = c ? Math.round(c.combo * (T.hero.comboPower + H.bonusComboPower)) : 0;
    if (S.finisherInput === 'button') {
      this.setText('button', ready ? 'FINISH!' : 'FINISH', b.x + b.w / 2, b.y + b.h / 2 - 5, ready ? INK : 0x8a80b0, 1, 0.5, 0.5, fight);
      this.setText('button2', ready ? `${dmg}` : `${Math.floor((c?.meter ?? 0) * 100)}%`, b.x + b.w / 2, b.y + b.h / 2 + 6, ready ? INK : 0x8a80b0, 1, 0.5, 0.5, fight);
    } else {
      this.setText('button', ready ? 'SWIPE' : 'METER', b.x + b.w / 2, b.y + b.h / 2 - 5, ready ? INK : 0x6a6480, 1, 0.5, 0.5, fight);
      this.setText('button2', ready ? 'UP ^' : `${Math.floor((c?.meter ?? 0) * 100)}%`, b.x + b.w / 2, b.y + b.h / 2 + 6, ready ? INK : 0x6a6480, 1, 0.5, 0.5, fight);
    }

    const d = this.app.lastTap;
    this.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, this.bar.x + this.bar.w / 2, this.B - 6, 0x6a6480, 1, 0.5, 0, this.app.panelOpen);
  }

  private drawOverlay(now: number): void {
    const g = this.gTop;
    g.clear();
    const run = this.app.run;
    const ph = run.phase;
    if (now < this.screenFlashUntil) {
      // scene only: the bar must stay readable
      g.fillStyle(this.screenFlashColor, Math.min(0.6, (this.screenFlashUntil - now) / 260));
      g.fillRect(0, 0, GAME_W, this.splitY);
    }
    const ov = ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3'];
    const hide = (...keys: string[]) => keys.forEach((k) => this.txt[k].setVisible(false));
    this.boostTexts.forEach((t) => t.setVisible(false));
    const dim = (a: number) => {
      g.fillStyle(0x05040a, a);
      g.fillRect(0, 0, GAME_W, GAME_H);
    };
    const blink = Math.floor(now / 450) % 2 === 0;
    const cx = GAME_W / 2;
    if (ph === 'title') {
      dim(0.6);
      this.setText('ovTitle', 'COMBO QUEST 3', cx, 46, 0xffd23a, 3, 0.5, 0.5);
      this.setText('ovSub', 'WORKING TITLE - FEEL PROTOTYPE', cx, 70, 0x9a94b0, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP ANYWHERE WHEN THE LINE IS ON A BLOCK', cx, 92, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine2', 'TAP RED TO BLOCK - NEVER TAP PURPLE', cx, 104, 0xff8a7a, 1, 0.5, 0.5);
      this.setText('ovLine3', 'TAP TO START', cx, 124, 0xffd23a, 2, 0.5, 0.5, blink);
    } else if (ph === 'boost') {
      dim(0.72);
      const won = run.combat?.result === 'won';
      this.setText('ovTitle', won ? 'VICTORY!' : 'ENEMY DOWN!', cx, 40, 0xffd23a, 3, 0.5, 0.5);
      this.setText('ovSub', 'CHOOSE A BOOST', cx, 60, WHITE, 1, 0.5, 0.5);
      hide('ovLine1', 'ovLine2', 'ovLine3');
      run.boostChoices.forEach((id, i) => {
        const r = this.cardRect(i);
        g.fillStyle(INK, 1);
        g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 5);
        g.fillStyle(0x2a2450, 1);
        g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle(0x4a4280, 1);
        g.fillRect(r.x, r.y, r.w, 2);
        const [name, val] = boostLabel(this.app.tuning, id);
        const a = this.boostTexts[i * 2];
        const b = this.boostTexts[i * 2 + 1];
        a.setText(fontText(name)).setPosition(r.x + r.w / 2, r.y + 14).setTint(WHITE).setOrigin(0.5, 0.5).setScale(1).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + r.w / 2, r.y + 40).setTint(0xffd23a).setOrigin(0.5, 0.5).setScale(2).setVisible(true);
      });
    } else if (ph === 'levelClear') {
      dim(0.65);
      this.setText('ovTitle', 'LEVEL CLEAR!', cx, 60, 0xffd23a, 3, 0.5, 0.5);
      this.setText('ovSub', `${run.level.name} DONE`, cx, 84, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP FOR NEXT LEVEL', cx, 110, 0xffd23a, 2, 0.5, 0.5, blink);
      hide('ovLine2', 'ovLine3');
    } else if (ph === 'defeat') {
      dim(0.65);
      this.setText('ovTitle', 'DEFEATED', cx, 60, 0xff5a5a, 3, 0.5, 0.5);
      this.setText('ovSub', 'ROWAN FALLS...', cx, 84, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP TO RETRY LEVEL', cx, 110, 0xffd23a, 2, 0.5, 0.5, blink);
      hide('ovLine2', 'ovLine3');
    } else if (this.app.userPaused) {
      dim(0.55);
      this.setText('ovTitle', 'PAUSED', cx, 66, WHITE, 3, 0.5, 0.5);
      this.setText('ovSub', 'TAP TO RESUME', cx, 92, 0xffd23a, 1, 0.5, 0.5, blink);
      hide('ovLine1', 'ovLine2', 'ovLine3');
    } else hide(...ov);
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
      const s = age / 1000;
      const popS = f.pop && age < 90 ? f.scale + 1 : f.scale;
      f.t.setScale(popS);
      f.t.setPosition(Math.round(f.x + f.vx * s), Math.round(f.y + f.vy * s + 0.5 * f.g * s * s));
      f.t.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
  }
}
