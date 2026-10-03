// Phaser scene (landscape 437x201): renders the core state and plays the juice. Reads input only through App.
import Phaser from 'phaser';
import { isRed, type Block, type BlockKind, type Combat, type CombatEvent } from '../core/combat';
import { boostLabel, type Phase } from '../core/run';
import type { App, View } from './app';
import { buildArt, buildPanel, HERO_FEET_X, HERO_W, HUD_ICONS, ICONS } from './art';
import { buildFont, FONT, FONT_BOLD, fontText, textWidth } from './font';
import { GAME_H, GAME_W } from './layout';

const COL = {
  yellow: [0xe8b42c, 0xfff0a0, 0xa87414],
  green: [0x48c050, 0xb0f4a8, 0x2a7a32],
  red: [0xd83434, 0xff8a7a, 0x8a1a1a],
  purple: [0x9a4ad8, 0xdab0ff, 0x5a2888],
} as const;
const kindCol = (k: BlockKind) => (k === 'yellow' ? COL.yellow : k === 'green' ? COL.green : k === 'purple' ? COL.purple : COL.red);
const ENEMY_COL: Record<string, number> = { slime: 0x4fc4a0, bigslime: 0x4fc4a0, boar: 0x8a5a34, bandit: 0x5a4a6a };

const WHITE = 0xffffff;
const INK = 0x0a0812;
const SPRITE_SCALE = 1;
const BAND_H = 40;
const DASH_MS = 70;
const RETURN_MS = 190;
const ENGAGE_MS = 750;
const LEAP_MS = 260;
const SUPER_MS = 760;
const ENTER_MS = 900;

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
  enterAt: number; // anim time the walk-in started (0 = done)
}

interface HeroAnim {
  state: 'idle' | 'dash' | 'engaged' | 'return' | 'leap' | 'super';
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
  private meter: Rect = { x: 0, y: 0, w: 0, h: 6 };
  private panelImg: Phaser.GameObjects.Image | null = null;
  // objects
  private world!: Phaser.GameObjects.Container;
  private back!: Phaser.GameObjects.Container;
  private actors!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private clouds: Phaser.GameObjects.Image[] = [];
  private gShadow!: Phaser.GameObjects.Graphics;
  private gSuper!: Phaser.GameObjects.Graphics;
  private superAt = -1e9;
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
  private beams: Array<{ x: number; at: number; color: number }> = [];
  private stars: Array<{ x: number; y: number; at: number; r: number; color: number }> = [];
  private heroHpShown = 0;
  private lastMilestone = 0;
  private banner = '';
  private bannerUntil = 0;

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
    const mk = (key: string, depth = 12, bold = false) => (this.txt[key] = this.add.bitmapText(0, 0, bold ? FONT_BOLD : FONT, '').setDepth(depth));
    ['level', 'ability', 'comboLabel', 'speed', 'tier', 'debug', 'enemyName'].forEach((k) => mk(k));
    ['heroHp', 'enemyHp', 'stat0', 'stat1', 'stat2', 'stat3', 'enemyAtk', 'combo', 'button', 'meterLabel'].forEach((k) => mk(k, 12, true));
    ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3', 'begin', 'banner'].forEach((k) => mk(k, 32, true));
    for (let i = 0; i < 6; i++) this.boostTexts.push(this.add.bitmapText(0, 0, FONT_BOLD, '').setDepth(32));
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
    this.splitY = Math.round(this.B - 58);
    this.ground = this.splitY - 12;
    this.heroHome = Math.round(GAME_W / 2 - 74);
    const btnW = 52;
    this.button = { x: this.R - btnW - 4, y: this.splitY + 6, w: btnW, h: BAND_H - 11 };
    const barX = this.L + 44;
    this.bar = { x: barX, y: this.splitY + 12, w: this.button.x - 12 - barX, h: 16 };
    this.meter = { x: this.bar.x, y: this.splitY + BAND_H + 4, w: this.bar.w, h: 10 };

    // Tear down everything built for the previous layout before regenerating textures.
    for (const f of this.floaters) f.t.destroy();
    for (const t of this.pool) t.destroy();
    this.floaters = [];
    this.pool = [];
    this.particles = [];
    this.pending = [];
    this.slashes = [];
    this.rings = [];
    this.beams = [];
    this.stars = [];
    this.back.removeAll(true);
    this.actors.removeAll(true);
    this.fxLayer.removeAll(true);
    this.panelImg?.destroy();
    buildArt(this, GAME_W, this.splitY, this.ground);
    buildPanel(this, GAME_W, GAME_H - this.splitY, BAND_H);
    this.panelImg = this.add.image(0, this.splitY, 'panel').setOrigin(0, 0).setDepth(9);
    this.back.add(this.add.image(0, 0, 'bg').setOrigin(0, 0));
    this.clouds = [0, 1].map((i) => this.add.image(i * GAME_W, 4, 'clouds').setOrigin(0, 0).setAlpha(0.95));
    this.back.add(this.clouds);
    this.gSuper = this.add.graphics();
    this.back.add(this.gSuper);
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

  /** Boost choices: a wooden panel with three stacked buttons (hit-tested by index). */
  private boostPanel(): Rect {
    return { x: Math.round(GAME_W / 2 - 85), y: 25, w: 170, h: 148 };
  }

  private cardRect(i: number): Rect {
    const p = this.boostPanel();
    return { x: p.x + 10, y: p.y + 24 + i * 41, w: p.w - 20, h: 35 };
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
          this.cursorHit(x, perfect ? 0x6aff5a : WHITE);
          if (perfect) this.sparkle(x, this.bar.y + this.bar.h / 2);
          this.comboPopAt = now;
          this.milestone(e.combo);
          this.heroAttack(e.enemyId, e.damage, e.crit, perfect);
          break;
        }
        case 'block': {
          const x = this.barX(e.pos);
          if (e.perfect || e.cracked) this.judge(x, e.perfect ? 'PERFECT!' : 'CRACK', e.perfect ? 0xfff07a : 0x7ae0ff, e.perfect);
          if (!e.cracked) this.addFloater(this.h.x + 8, this.ground - 50, 'BLOCK!', WHITE, 2, true, 0, -16, 0, 620, true);
          this.cursorPulse(0x7ae0ff);
          this.cursorHit(x, e.perfect ? 0x6aff5a : 0x7ae0ff);
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
            if (e.damage > 0 || this.app.settings.godMode) this.floatNum(this.h.x, this.ground - 40, `${e.damage}`, 0xff4a4a, 2);
            this.burst(this.h.x + 4, this.ground - 16, 0xff5a5a, e.source === 'miss' ? 3 : 10, true);
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
          this.floatNum(GAME_W / 2, 60, 'BOOM!', 0xff8a3a, 2);
          break;
        case 'finisher':
          this.heroFinisher(e.damage);
          break;
        case 'ability':
          this.floatNum(this.h.x, this.ground - 46, 'KEEN EDGE', 0x9af0a0, 1);
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
          this.floatNum(this.heroHome + 10, this.ground - 50, 'REVIVED!', 0x9af0a0, 2);
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
    return Math.round(v.homeX - v.img.displayWidth / 2 - 12);
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
    const col = finisher ? 0xff8a2a : crit ? 0xffb020 : perfect ? 0xfff07a : 0xffe040;
    if (big) this.stars.push({ x: v.x, y: cy - 8, at: this.anim, r: finisher ? 30 : 22, color: finisher ? 0xffb03a : 0xfff07a });
    this.floatNum(v.x + rand(-6, 6), v.y - v.img.displayHeight - 8, `${damage}`, col, big ? 3 : 2);
    this.slashes.push({ x: v.x, y: cy, at: this.anim, big, dir: this.h.alt ? 1 : -1, color: crit ? 0xffd23a : 0x6ab4ff });
    this.burst(v.x - 4, cy, WHITE, big ? 14 : 7, true, big ? 1.5 : 1, true);
    if (big) this.ring(v.x, cy, 26, col, true);
    this.shake(big ? J.shakeMaxPx : J.shakeMinPx, J.shakeMs * (big ? 1.4 : 0.7));
    this.freeze(big ? 80 : 45);
  }

  private heroParry(ownerId: number, cracked: boolean): void {
    const h = this.h;
    h.lastAction = this.anim;
    this.setHeroPose('parry', 150);
    const sx = h.x + 10;
    const sy = this.ground - 22;
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
    const J = this.app.tuning.juice;
    const alive = c ? c.enemies.filter((e) => e.alive) : [];
    const views = alive.map((e) => this.enemies.get(e.id)).filter((v): v is EnemyView => !!v);
    const front = views.slice().sort((a, b) => a.homeX - b.homeX)[0];
    h.state = 'super';
    h.fromX = h.x;
    h.toX = front ? front.homeX - 8 : h.x + 80;
    h.t0 = this.anim;
    h.lastAction = this.anim + SUPER_MS;
    this.superAt = this.anim;
    this.floatNum(GAME_W / 2, 66, 'FINISHER!', 0xffb03a, 3);
    // A whirlwind of hits, then the big number.
    const hits: Array<[number, boolean]> = [
      [0.36, false],
      [0.48, false],
      [0.62, true],
    ];
    for (const [k, last] of hits)
      this.later(SUPER_MS * k, () => {
        for (const v of views) {
          const cy = v.y - v.img.displayHeight / 2;
          if (last) this.enemyHurtFx(v.id, damage, false, false, true);
          else {
            v.flashUntil = this.anim + 50;
            v.knockUntil = this.anim + 60;
            this.burst(v.x, cy, WHITE, 8, true, 1.2, true);
          }
          this.slashes.push({ x: v.x, y: cy, at: this.anim, big: last, dir: last ? -1 : 1, color: 0x6ab4ff });
        }
        if (last) {
          this.screenFlash(WHITE, performance.now(), 160);
          this.shake(J.shakeMaxPx, J.shakeMs * 2);
          this.freeze(110);
        } else this.shake(J.shakeMinPx + 1, 80);
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
        this.floatNum(GAME_W / 2, 44, `${n} COMBO - ${label}`, 0xffd23a, 1);
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

  /** Ring + vertical beam shooting up from the bar where a block was hit. */
  private cursorHit(x: number, color: number): void {
    const y = this.bar.y + this.bar.h / 2;
    this.ring(x, y, 18, color, false);
    this.beams.push({ x: Math.round(x), at: performance.now(), color });
    this.burst(x, y, WHITE, 8, false, 1.3, true);
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
    const w = textWidth(text, scale, true);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, y, text, color, scale, true, rand(-14, 14), -70, 160, 760, true);
  }

  private addFloater(x: number, y: number, text: string, color: number, scale: number, pop: boolean, vx: number, vy: number, g: number, life: number, world: boolean): void {
    const t = this.pool.pop() ?? this.add.bitmapText(0, 0, FONT, '');
    t.setFont(world ? FONT_BOLD : FONT);
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
    if (count === 1) return Math.round(GAME_W / 2 + 74);
    return Math.round(GAME_W / 2 + 40 + slot * 42);
  }

  private syncEnemies(force = false): void {
    const c = this.app.run.combat;
    if (!c) return;
    if (c === this.lastCombat && !force) return;
    if (c !== this.lastCombat) {
      for (const v of this.enemies.values()) v.img.destroy();
      this.enemies.clear();
      this.h = this.freshHero();
      const run = this.app.run;
      if (run.stageIndex > 0) {
        this.banner = `${run.stageIndex} OUT OF ${run.level.stages.length} DEFEATED!`;
        this.bannerUntil = performance.now() + 1800;
      }
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
        enterAt: this.anim + e.slot * 120,
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
      yOff = -Math.sin(k * Math.PI) * 24;
      if (k >= 1) h.state = 'engaged';
    } else if (h.state === 'super') {
      const k = clamp01((a - h.t0) / SUPER_MS);
      if (k < 0.3) h.x = h.fromX + (h.toX - h.fromX) * ease(k / 0.3);
      else if (k < 0.75) h.x = h.toX + Math.sin(a / 25) * 3;
      else h.x = h.toX + (this.heroHome - h.toX) * ease((k - 0.75) / 0.25);
      if (k >= 1) {
        h.state = 'idle';
        h.x = this.heroHome;
      }
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
    const spinning = h.state === 'super' && a - h.t0 > SUPER_MS * 0.06 && a - h.t0 < SUPER_MS * 0.94;
    this.hero.setVisible(!spinning);
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
    this.drawSuper(now);
    const shadow = (x: number, w: number, alpha = 0.35) => {
      sh.fillStyle(0x000000, alpha);
      sh.fillRect(Math.round(x - w / 2), this.ground - 1, Math.round(w), 2);
      sh.fillRect(Math.round(x - w / 2 + 2), this.ground + 1, Math.round(w - 4), 1);
    };
    shadow(this.h.x + 1, 16 * (1 + this.h.y / 60), 0.3);
    if (run.hero.abilityTimer > 0 && Math.floor(now / 90) % 2 === 0) {
      g.fillStyle(0x9af0a0, 1);
      for (let i = 0; i < 2; i++) g.fillRect(Math.round(this.h.x + rand(-11, 11)), Math.round(this.ground - rand(3, 30)), 1, 2);
    }

    if (c) {
      const target = c.currentTarget();
      const a = this.anim;
      for (const v of this.enemies.values()) {
        const e = c.enemyById(v.id);
        if (!e) continue;
        let x = v.homeX;
        let walkBob = 0;
        if (v.enterAt) {
          const k = (a - v.enterAt) / ENTER_MS;
          if (k >= 1) v.enterAt = 0;
          else {
            x = GAME_W + 30 + (v.homeX - GAME_W - 30) * ease(clamp01(k));
            walkBob = Math.floor(a / 90) % 2;
          }
        }
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
        v.img.setTexture(`${v.sprite}_${pose}`).setPosition(Math.round(x), v.y - walkBob).setScale(SPRITE_SCALE).setAlpha(1);
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
      const r = s.big ? 24 : 18;
      const span = Math.PI * (0.25 + 0.75 * ease(clamp01(k * 1.6)));
      const a0 = s.dir > 0 ? -Math.PI * 0.85 : -Math.PI * 0.15 - span;
      const thick = s.big ? 5 : 4;
      for (let j = 0; j <= 24; j++) {
        const ang = a0 + (span * j) / 24;
        const w = Math.max(1, Math.round(thick * Math.sin((j / 24) * Math.PI) * (1 - k)));
        g.fillStyle(j > 8 ? s.color : WHITE, 1 - k * 0.6);
        g.fillRect(Math.round(s.x + Math.cos(ang) * r), Math.round(s.y + Math.sin(ang) * r * 0.75), w, w);
      }
    }
    // crit / finisher starbursts behind the numbers
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const st = this.stars[i];
      const k = (this.anim - st.at) / 260;
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
      g.fillStyle(st.color, 1 - k);
      g.fillPoints(star(r), true);
      g.fillStyle(WHITE, 1 - k);
      g.fillPoints(star(r * 0.6), true);
    }
    this.drawRings(g, now, true);
    this.drawParticles(g, now, true);
  }

  /** Finisher special: the sky swaps to a streaked blue backdrop while the hero whirls through the enemies. */
  private drawSuper(now: number): void {
    const g = this.gSuper;
    g.clear();
    const k = (this.anim - this.superAt) / SUPER_MS;
    if (k < 0 || k >= 1) return;
    const alpha = k < 0.08 ? k / 0.08 : k > 0.86 ? (1 - k) / 0.14 : 1;
    const bottom = this.ground - 8;
    const bands = [0x1022a8, 0x1a3cc8, 0x2a62dc, 0x3a8ae8, 0x48b4f0, 0x5ad8f4];
    const bh = Math.ceil(bottom / bands.length);
    bands.forEach((col, i) => {
      g.fillStyle(col, alpha);
      g.fillRect(0, i * bh, GAME_W, Math.min(bh, bottom - i * bh));
    });
    for (let i = 0; i < 18; i++) {
      const y = 4 + ((i * 37) % Math.max(1, bottom - 8));
      const len = 18 + ((i * 53) % 46);
      const speed = 0.5 + (i % 3) * 0.25;
      const x = ((((i * 97 - now * speed) % (GAME_W + 80)) + GAME_W + 80) % (GAME_W + 80)) - 40;
      g.fillStyle(WHITE, alpha * (i % 2 ? 0.85 : 0.5));
      g.fillRect(Math.round(x), y, len, i % 4 === 0 ? 2 : 1);
    }
    // whirlwind where the hero is
    const h = this.h;
    if (h.state !== 'super') return;
    const fx = this.gFx;
    const cx = h.x + 2;
    // a tornado: stacked spinning rings, wider at the top
    for (let arc = 0; arc < 5; arc++) {
      const base = this.anim / 30 + arc * 1.7;
      const r = 7 + arc * 4;
      const cy = this.ground - 4 - arc * 7;
      for (let j = 0; j < 18; j++) {
        const ang = base + j * 0.17;
        fx.fillStyle(j < 6 ? WHITE : j < 12 ? 0xb8e4ff : 0x5aa8f0, 1 - j / 20);
        fx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.35), 3, 2);
      }
    }
    if (Math.random() < 0.5) this.burst(cx, this.ground - 2, 0xd8c8a0, 1, true, 0.6);
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

  private hudBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    frac: number,
    ghost: number,
    o: { fill?: number; hi?: number; lo?: number; bg?: number; mirror?: boolean } = {},
  ): void {
    const fill = o.fill ?? 0x64c83c;
    g.fillStyle(INK, 1);
    g.fillRect(x - 2, y - 1, w + 4, h + 2);
    g.fillRect(x - 1, y - 2, w + 2, h + 4);
    g.fillStyle(0xd0d4e0, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x8a8ea0, 1);
    g.fillRect(x - 1, y + h, w + 2, 1);
    g.fillStyle(o.bg ?? 0xb82828, 1);
    g.fillRect(x, y, w, h);
    const gw = Math.round(w * clamp01(ghost));
    const fw = Math.round(w * clamp01(frac));
    const at = (len: number) => (o.mirror ? x + w - len : x);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(at(gw), y, gw, h);
    g.fillStyle(fill, 1);
    g.fillRect(at(fw), y, fw, h);
    g.fillStyle(o.hi ?? 0xa8f070, 1);
    g.fillRect(at(fw), y, fw, 2);
    g.fillStyle(o.lo ?? 0x3e9228, 1);
    g.fillRect(at(fw), y + h - 2, fw, 2);
  }

  /** Filled rectangle with corners rounded by roughly `r` pixels. */
  private roundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number): void {
    g.fillStyle(color, 1);
    for (let i = 0; i < h; i++) {
      const d = Math.min(i, h - 1 - i);
      const inset = d >= r ? 0 : Math.round(r - Math.sqrt(Math.max(0, r * r - (r - d - 0.5) ** 2)));
      g.fillRect(x + inset, y + i, w - inset * 2, 1);
    }
  }

  private hudIcon(g: Phaser.GameObjects.Graphics, key: string, x: number, y: number, scale = 1): void {
    const ic = HUD_ICONS[key];
    ic.rows.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) {
        const col = ic.pal[r[xx]];
        if (col === undefined) continue;
        g.fillStyle(col, 1);
        g.fillRect(x + xx * scale, y + yy * scale, scale, scale);
      }
    });
  }

  private drawPanel(now: number): void {
    const g = this.gPanel;
    const run = this.app.run;
    const c = run.combat;
    const T = this.app.tuning;
    g.clear();
    // hero: heart + HP bar, stat column
    const H = run.hero;
    const maxHp = T.hero.maxHp + H.bonusMaxHp;
    this.heroHpShown += (H.hp - this.heroHpShown) * 0.2;
    this.hudBar(g, this.L + 17, 5, 86, 10, H.hp / maxHp, this.heroHpShown / maxHp);
    this.hudIcon(g, 'heart', this.L + 3, 3, 2);
    ['sword', 'crit', 'bolt', 'potion'].forEach((k, i) => this.hudIcon(g, k, this.L + 6, 21 + i * 10));
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(this.L + 17, 17, Math.round(86 * (H.abilityTimer / Math.max(0.01, T.hero.abilitySec))), 1);
    }
    if (!c) return;
    // enemy (the current target): HP bar with a skull, attack stat below
    const target = c.currentTarget() ?? c.enemies[0];
    if (target) {
      const v = this.enemies.get(target.id);
      const bx = this.R - 104;
      this.hudBar(g, bx, 15, 86, 10, target.hp / target.maxHp, (v?.hpShown ?? target.hp) / target.maxHp, { mirror: true });
      this.hudIcon(g, 'skull', this.R - 16, 12, 2);
      if (this.app.tuning.enemies[target.key].boss) this.hudIcon(g, 'crown', this.R - 16, 3, 2);
      this.hudIcon(g, 'sword', this.R - 11, 31);
    }

    // finisher button on the wooden band
    const b = this.button;
    const ready = c.finisherReady;
    const swipe = this.app.settings.finisherInput === 'swipe';
    const pulse = ready && Math.floor(now / 140) % 2 === 0;
    g.fillStyle(INK, 1);
    g.fillRect(b.x - 1, b.y - 2, b.w + 2, b.h + 5);
    g.fillRect(b.x - 2, b.y - 1, b.w + 4, b.h + 3);
    const body = ready ? (pulse ? 0xffd84a : 0xf2b030) : swipe ? 0x3a2a20 : 0x4e3a2c;
    g.fillStyle(body, 1);
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle(ready ? 0xfff0a0 : 0x6a5040, 1);
    g.fillRect(b.x, b.y, b.w, 2);
    g.fillStyle(ready ? 0xb06a10 : 0x2e2018, 1);
    g.fillRect(b.x, b.y + b.h - 2, b.w, 2);
    if (ready) {
      g.lineStyle(1, pulse ? WHITE : 0xffd84a, 1);
      g.strokeRect(b.x - 3.5, b.y - 3.5, b.w + 7, b.h + 8);
    }

    // finisher meter on the stone strip, combo count to its left
    const m = this.meter;
    this.hudBar(g, m.x, m.y, m.w, m.h, c.meter, c.meter, { fill: ready ? 0x5ac8ff : 0x3ab0ff, hi: ready ? 0xd8f6ff : 0xa8e4ff, lo: 0x1e78c8, bg: 0x1e1e2a });
    if (ready && pulse) {
      g.fillStyle(WHITE, 0.35);
      g.fillRect(m.x, m.y, m.w, m.h);
    }
    this.hudIcon(g, 'bolt', this.L + 6, m.y - 1);
  }

  private drawBar(t: number, now: number): void {
    const g = this.gBar;
    g.clear();
    const c = this.app.run.combat;
    const B = this.bar;
    const bx = now < this.barShakeUntil ? Math.round(rand(-2, 2)) : 0;
    // metal frame: a capsule with rivets at both ends
    const fx = B.x - 8 + bx;
    const fy = B.y - 4;
    const fw = B.w + 16;
    const fh = B.h + 8;
    this.roundRect(g, fx - 1, fy - 1, fw + 2, fh + 2, 8, INK);
    this.roundRect(g, fx, fy, fw, fh, 7, 0xc4c8d6);
    g.fillStyle(0xf2f4fa, 1);
    g.fillRect(fx + 6, fy + 1, fw - 12, 1);
    g.fillStyle(0x7c8096, 1);
    g.fillRect(fx + 6, fy + fh - 2, fw - 12, 1);
    for (const rx of [fx + 3, fx + fw - 6]) {
      g.fillStyle(0x7c8096, 1);
      g.fillRect(rx + 1, fy + fh / 2 - 2, 1, 4);
      g.fillRect(rx, fy + fh / 2 - 1, 3, 2);
    }
    // track: dark with a fine vertical grid
    g.fillStyle(0x1a1a24, 1);
    g.fillRect(B.x - 1 + bx, B.y - 1, B.w + 2, B.h + 2);
    g.fillStyle(0x3a3a46, 1);
    g.fillRect(B.x + bx, B.y, B.w, B.h);
    g.fillStyle(0x2c2c36, 1);
    for (let x = 2; x < B.w; x += 3) g.fillRect(B.x + bx + x, B.y + 2, 1, B.h - 3);
    g.fillStyle(0x54546a, 1);
    g.fillRect(B.x + bx, B.y, B.w, 1);
    // the left end is where enemy attacks land
    g.fillStyle(0xe0463c, 0.7);
    g.fillRect(B.x + bx, B.y, 2, B.h);
    if (!c) return;

    const group = c.enemies.length > 1;
    for (const b of c.blocks) if (!isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);
    for (const b of c.blocks) if (isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 260;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 4, r * 2, B.h + 8);
    }

    // cursor: a blue blade with silver caps (trail at speed, pulse on hits)
    const speed = c.speedMult();
    const hot = speed >= this.app.tuning.cursor.maxSpeedMult - 0.01;
    const blade = hot ? 0xff8a2a : 0x2a6ad8;
    const core = hot ? 0xffd080 : 0x8ac8ff;
    if (speed > 1.2) {
      for (let i = 1; i <= 3; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.01) * B.w) + bx;
        g.fillStyle(core, 0.35 / i);
        g.fillRect(px - 1, B.y, 3, B.h);
      }
    }
    const cx = Math.round(B.x + c.cursorPosAt(t) * B.w) + bx;
    const pk = (now - this.cursorPulseAt) / 160;
    if (pk < 1) {
      const pw = Math.round(2 + 6 * (1 - pk));
      g.fillStyle(this.cursorPulseColor, 0.6 * (1 - pk));
      g.fillRect(cx - pw, B.y - 3, pw * 2 + 1, B.h + 6);
    }
    g.fillStyle(INK, 1);
    g.fillRect(cx - 2, B.y - 5, 5, B.h + 10);
    g.fillStyle(blade, 1);
    g.fillRect(cx - 1, B.y - 4, 3, B.h + 8);
    g.fillStyle(core, 1);
    g.fillRect(cx, B.y - 4, 1, B.h + 8);
    for (const cy of [B.y - 6, B.y + B.h + 5]) {
      g.fillStyle(INK, 1);
      g.fillRect(cx - 4, cy - 1, 9, 3);
      g.fillRect(cx - 1, cy - 2, 3, 5);
      g.fillStyle(0xd8dce8, 1);
      g.fillRect(cx - 3, cy, 7, 1);
      g.fillRect(cx, cy - 1, 1, 3);
      g.fillStyle(WHITE, 1);
      g.fillRect(cx, cy, 1, 1);
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i];
      const k = (now - bm.at) / 200;
      if (k >= 1) {
        this.beams.splice(i, 1);
        continue;
      }
      const top = Math.round(this.ground - 40 - 30 * k);
      const w = Math.max(1, Math.round(4 * (1 - k)));
      g.fillStyle(bm.color, 0.9 * (1 - k));
      g.fillRect(bm.x - Math.floor(w / 2), top, w, B.y - top);
      g.fillStyle(WHITE, 0.9 * (1 - k));
      g.fillRect(bm.x, top, 1, B.y - top);
    }
    this.drawRings(g, now, false);
    this.drawParticles(g, now, false);
  }

  private drawBlock(g: Phaser.GameObjects.Graphics, b: Block, c: Combat, t: number, now: number, group: boolean, bx: number): void {
    const B = this.bar;
    const pos = c.blockPosAt(b, t);
    // Chunky bricks that stick out above and below the track; 1px seam when they touch.
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const x = Math.round(B.x + pos * B.w - w / 2) + bx;
    const h = B.h + 10;
    const y = B.y - 5;
    if (b.kind === 'purple' && b.life < 1 && Math.floor(now / 90) % 2 === 0) return;
    const [base, light, dark] = kindCol(b.kind);
    if (b.push > 0)
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(light, 0.4 / i);
        g.fillRect(x - i * 6, y + 3, w, h - 6);
      }
    const impacting = b.impactTimer >= 0 && Math.floor(now / 40) % 2 === 0;
    const age = c.time - b.bornAt;
    const grow = age < 0.08 ? Math.round((1 - age / 0.08) * 3) : 0; // fresh blocks pop in
    const X = x - grow;
    const Y = y - grow;
    const W = w + grow * 2;
    const H = h + grow * 2;
    g.fillStyle(INK, 1);
    g.fillRect(X - 1, Y, W + 2, H);
    g.fillRect(X, Y - 1, W, H + 2);
    g.fillStyle(impacting ? WHITE : base, 1);
    g.fillRect(X, Y, W, H);
    g.fillStyle(impacting ? WHITE : light, 1);
    g.fillRect(X + 1, Y, W - 2, 2);
    g.fillRect(X, Y + 1, 1, H - 3);
    g.fillStyle(dark, 1);
    g.fillRect(X + 1, Y + H - 3, W - 2, 3);
    g.fillRect(X + W - 1, Y + 1, 1, H - 3);
    g.fillStyle(WHITE, 1);
    g.fillRect(X + W - 4, Y + 1, 2, 1);
    g.fillRect(X + 2, Y + H - 4, 2, 1);
    if (b.kind === 'shield') {
      g.fillStyle(0xdfe6f2, 1);
      g.fillRect(X + 1, Y + 2, 2, H - 5);
      g.fillRect(X + W - 3, Y + 2, 2, H - 5);
      if (b.taps <= 1) {
        g.fillStyle(INK, 1);
        g.fillRect(X + 5, Y + 3, 1, 5);
        g.fillRect(X + 6, Y + 8, 1, 4);
        g.fillRect(X + 5, Y + 12, 1, 4);
      }
    }
    const cx = Math.round(X + W / 2 - 2.5);
    const cy = Math.round(Y + H / 2 - 3);
    if (isRed(b.kind)) {
      const variant = b.kind === 'red' ? null : ICONS[b.kind];
      const owner = c.enemyById(b.ownerId);
      const ownerIcon = group && owner ? ICONS[this.app.tuning.enemies[owner.key].icon] : null;
      if (variant) {
        this.icon(g, variant, cx, ownerIcon ? cy + 3 : cy, b.kind === 'speed' ? 0xffe680 : INK);
        if (ownerIcon) this.icon(g, ownerIcon, cx, cy - 5, WHITE);
      } else if (ownerIcon) this.icon(g, ownerIcon, cx, cy, WHITE);
    } else if (b.kind === 'purple') {
      g.fillStyle(WHITE, 1);
      g.fillRect(cx + 2, cy - 1, 2, 5);
      g.fillRect(cx + 2, cy + 6, 2, 2);
    } else if (b.kind === 'green') {
      g.fillStyle(WHITE, 1);
      g.fillRect(cx + 2, cy - 1, 2, 8);
      g.fillRect(cx - 1, cy + 2, 8, 2);
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
    this.setText('level', `${lvl.name}${stageInfo}`, GAME_W / 2, 24, 0xf2f4fa, 1, 0.5, 0);
    this.setText('heroHp', `${Math.ceil(H.hp)}/${maxHp}`, this.L + 60, 10, WHITE, 1, 0.5, 0.5);
    const crit = T.hero.critChance + H.bonusCrit + (H.abilityTimer > 0 ? T.hero.abilityCritBonus : 0);
    const stats = [
      `${Math.round(T.hero.atk * (1 + H.bonusDmg))}`,
      `${Math.round(crit * 100)}%`,
      `${T.hero.comboPower + H.bonusComboPower}`,
      `${H.revives}`,
    ];
    stats.forEach((v, i) => this.setText(`stat${i}`, v, this.L + 15, 25 + i * 10, i === 1 && H.abilityTimer > 0 ? 0x9af0a0 : WHITE, 1, 0, 0.5));
    this.setText('ability', 'KEEN EDGE', this.L + 15 + textWidth(stats[1], 1, true) + 4, 35, 0x9af0a0, 1, 0, 0.5, H.abilityTimer > 0);
    const target = c ? (c.currentTarget() ?? c.enemies[0]) : null;
    if (target && c) {
      const def = T.enemies[target.key];
      this.setText('enemyName', def.name, this.R - 61, 4, def.boss ? 0xffd23a : WHITE, 1, 0.5, 0);
      this.setText('enemyHp', `${Math.ceil(target.hp)}/${target.maxHp}`, this.R - 61, 20, WHITE, 1, 0.5, 0.5);
      this.setText('enemyAtk', `${def.atk}`, this.R - 14, 35, WHITE, 1, 1, 0.5);
    } else ['enemyName', 'enemyHp', 'enemyAtk'].forEach((k) => this.txt[k].setVisible(false));

    const combo = c?.combo ?? 0;
    const broke = now < this.comboBreakUntil;
    const pk = (now - this.comboPopAt) / 140;
    const pop = pk < 1 && !broke ? 3 : 2;
    const comboCol = broke ? 0xff5a5a : combo >= 50 ? 0xff6a3a : combo >= 25 ? 0xffa03a : combo >= 10 ? 0xffd23a : WHITE;
    const my = this.meter.y + this.meter.h / 2;
    this.setText('combo', broke ? 'X' : `${combo}`, this.L + 15, my, comboCol, pop, 0, 0.5);
    this.txt.comboLabel.setVisible(false);
    const sp = c ? c.speedMult() : 1;
    this.setText('speed', `SPD x${sp.toFixed(2)}`, this.button.x + this.button.w / 2, my, sp > 1.01 ? 0xffd080 : 0xc8c8d4, 1, 0.5, 0.5);
    if (S.comboTiers && c) {
      const tm = combo >= T.tiers.t3 ? T.tiers.m3 : combo >= T.tiers.t2 ? T.tiers.m2 : combo >= T.tiers.t1 ? T.tiers.m1 : 1;
      this.setText('tier', `DMG x${tm}`, this.meter.x + this.meter.w, this.meter.y - 6, tm > 1 ? 0xffd23a : 0xc8c8d4, 1, 1, 0.5);
    } else this.txt.tier.setVisible(false);

    const ready = !!c?.finisherReady;
    const b = this.button;
    const fight = run.phase === 'fight';
    const swipeMode = S.finisherInput === 'swipe';
    this.setText(
      'meterLabel',
      swipeMode ? 'SWIPE UP!' : 'FINISHER READY!',
      this.meter.x + this.meter.w / 2,
      this.meter.y + this.meter.h / 2,
      Math.floor(now / 150) % 2 ? 0xffe040 : 0xffb020,
      1,
      0.5,
      0.5,
      ready && fight,
    );
    const label = S.finisherInput === 'button' ? (ready ? 'FINISH!' : 'FINISH') : ready ? 'SWIPE ^' : 'SWIPE';
    this.setText('button', label, b.x + b.w / 2, b.y + b.h / 2, ready ? WHITE : 0x9a8070, 1, 0.5, 0.5, fight);

    const d = this.app.lastTap;
    this.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, GAME_W / 2, this.meter.y + 9, 0xc8c8d4, 1, 0.5, 0, this.app.panelOpen);
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
    if (!(ph === 'fight' && this.app.awaitingBegin && !this.app.userPaused)) this.txt.begin.setVisible(false);
    if (ph === 'fight' && now < this.bannerUntil) {
      const k = (this.bannerUntil - now) / 1800;
      this.setText('banner', this.banner, cx, 60, WHITE, 2, 0.5, 0.5, true);
      this.txt.banner.setAlpha(k < 0.15 ? k / 0.15 : 1);
    } else this.txt.banner.setVisible(false);
    if (ph === 'title') {
      dim(0.6);
      this.setText('ovTitle', 'COMBO QUEST 3', cx, 50, 0xffd23a, 3, 0.5, 0.5);
      this.setText('ovSub', 'WORKING TITLE - FEEL PROTOTYPE', cx, 74, 0xd8d4f0, 1, 0.5, 0.5);
      this.setText('ovLine1', 'TAP WHEN THE LINE IS ON A BLOCK', cx, 94, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine2', 'TAP RED TO BLOCK - AVOID PURPLE', cx, 106, 0xff8a7a, 1, 0.5, 0.5);
      this.setText('ovLine3', 'TAP TO START!', cx, 126, WHITE, 2, 0.5, 0.5, blink);
    } else if (ph === 'boost') {
      dim(0.35);
      hide('ovSub', 'ovLine1', 'ovLine2', 'ovLine3');
      const p = this.boostPanel();
      this.roundRect(g, p.x - 2, p.y - 2, p.w + 4, p.h + 4, 4, INK);
      this.roundRect(g, p.x, p.y, p.w, p.h, 3, 0x7a4a28);
      g.fillStyle(0x94603a, 1);
      for (let yy = p.y + 2; yy < p.y + p.h; yy += 12) g.fillRect(p.x + 3, yy, p.w - 6, 1);
      g.fillStyle(0x5a3418, 1);
      g.fillRect(p.x + 3, p.y + 19, p.w - 6, 1);
      this.setText('ovTitle', 'CHOOSE A BOOST', cx, p.y + 11, WHITE, 1, 0.5, 0.5);
      run.boostChoices.forEach((id, i) => {
        const r = this.cardRect(i);
        this.roundRect(g, r.x - 1, r.y - 1, r.w + 2, r.h + 3, 3, INK);
        this.roundRect(g, r.x, r.y, r.w, r.h, 2, 0x58c840);
        g.fillStyle(0xa8f080, 1);
        g.fillRect(r.x + 2, r.y + 1, r.w - 4, 2);
        g.fillStyle(0x2e8a22, 1);
        g.fillRect(r.x + 2, r.y + r.h - 3, r.w - 4, 2);
        g.fillStyle(0xd0d4e0, 1);
        g.fillRect(r.x + 1, r.y + 1, 1, r.h - 3);
        g.fillRect(r.x + r.w - 2, r.y + 1, 1, r.h - 3);
        const [name, val] = boostLabel(this.app.tuning, id);
        const a = this.boostTexts[i * 2];
        const b = this.boostTexts[i * 2 + 1];
        a.setText(fontText(name)).setPosition(r.x + r.w / 2, r.y + 13).setTint(WHITE).setOrigin(0.5, 0.5).setScale(2).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + r.w / 2, r.y + 28).setTint(0xfff07a).setOrigin(0.5, 0.5).setScale(1).setVisible(true);
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
    } else if (this.app.awaitingBegin) {
      hide(...ov);
      this.setText('begin', 'TAP TO BEGIN!', cx, 66, WHITE, 2, 0.5, 0.5, true);
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
