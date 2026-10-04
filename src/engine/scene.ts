// Phaser scene (landscape 327x150): renders the core state and plays the juice. Reads input only through App.
import Phaser from 'phaser';
import { isRed, type Block, type BlockKind, type Combat, type CombatEvent, type RemoveReason } from '../core/combat';
import { boostLabel, type BoostId, type Phase } from '../core/run';
import type { App, View } from './app';
import { buildArt, HERO_FEET_X, HERO_W, HUD_ICONS, ICONS } from './art';
import { buildBarFrame, buildBoard, buildCrest, buildPanel, cornerInset } from './chrome';
import { buildBackdrops, type Backdrop, type Theme } from './backdrop';
import { buildFont, FONT, FONT_BOLD, fontText, textWidth } from './font';
import { GAME_H, GAME_W } from './layout';

const COL = {
  yellow: [0xeab22e, 0xffe680, 0xb8781a],
  green: [0x4ccf4a, 0xa8f590, 0x2a9a3a],
  red: [0xd63a3a, 0xff8a76, 0x9a1c26],
  purple: [0x9a4ad8, 0xdab0ff, 0x6a2aa8],
} as const;
const kindCol = (k: BlockKind) => (k === 'yellow' ? COL.yellow : k === 'green' ? COL.green : k === 'purple' ? COL.purple : COL.red);
const BOMB_COL = [0xf28a2a, 0xffd890, 0xa04a10] as const;
const deepOf = (k: BlockKind) => (k === 'yellow' ? 0x7a4410 : k === 'green' ? 0x14622a : k === 'purple' ? 0x3a1a60 : 0x5a1020);

/** How a block leaves the bar: never instantly. */
type DyingStyle = 'pop' | 'shatter' | 'crunch' | 'fade' | 'zip';
const DYING_MS: Record<DyingStyle, number> = { pop: 270, shatter: 360, crunch: 220, fade: 260, zip: 200 };
const dyingStyle = (kind: BlockKind, reason: RemoveReason): DyingStyle =>
  reason === 'hit' ? (isRed(kind) ? 'shatter' : 'pop') : reason === 'bomb' ? 'shatter' : reason === 'impact' ? 'crunch' : reason === 'expire' ? 'fade' : 'zip';

interface Dying {
  x: number; // center, game px
  w: number;
  kind: BlockKind;
  reason: RemoveReason;
  style: DyingStyle;
  at: number; // anim time
}
const ENEMY_COL: Record<string, number> = { slime: 0x4fc4a0, bigslime: 0x4fc4a0, boar: 0x8a5a34, bandit: 0x5a4a6a };

const WHITE = 0xffffff;
const INK = 0x0a0812;
const SPRITE_SCALE = 1;
const BOOST_ICON: Record<BoostId, string> = { maxHp: 'heart', damage: 'sword', crit: 'crit', critDmg: 'crit', comboPower: 'bolt', heal: 'potion' };
const BAND_H = 32;
const DASH_MS = 70;
const RETURN_MS = 190;
const ENGAGE_MS = 750;
const LEAP_MS = 260;
/** Finisher show length grows with the number of stacks spent. */
const superMsFor = (stacks: number) => 560 + 170 * Math.min(5, Math.max(1, stacks));
/** Color per finisher stack: [fill, highlight, shade]. Stack 1 blue, 2 violet, 3 gold, 4 crimson, 5 white-hot. */
const STACK_COL: ReadonlyArray<readonly [number, number, number]> = [
  [0x2a8ae0, 0x7ad0ff, 0x1a5ab0],
  [0x3aa0ff, 0xa8e4ff, 0x1a5ab0],
  [0xa060ff, 0xe0c0ff, 0x5a2ab0],
  [0xffb020, 0xfff0a0, 0xa86010],
  [0xff4a6a, 0xffb0c0, 0xa01a3a],
  [0xf6f2ff, 0xffffff, 0xb0a0e0],
];
const stackCol = (n: number) => STACK_COL[Math.max(0, Math.min(STACK_COL.length - 1, n))];
const FINISHER_NAME = ['', 'Finisher!', 'Double Finisher!', 'Triple Finisher!', 'Quad Finisher!', 'MAX FINISHER!'];
/** Slash color by combo tier: the longer the streak, the hotter the blade. */
const comboSlashCol = (combo: number) => (combo >= 50 ? 0xff6ad8 : combo >= 25 ? 0xffd23a : combo >= 10 ? 0x5af0ff : 0x6ab4ff);
const ENTER_MS = 900;
const PIP_SWOOP_MS = 140;
const PIP_BACK_MS = 280;

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
  kickAt: number; // anim time of the last hit (spring knockback + squash)
  kickDist: number;
  numAt: number; // anim time of the last damage number (for cascading)
  numLevel: number;
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
  lungeAt: number; // anim time of the last slash (small forward lunge)
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
  count?: { to: number; dur: number; at?: number }; // a number that counts up from 0
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
  shape?: 'chip' | 'shard' | 'spark' | 'streak';
}

interface Ambient {
  kind: 'leaf' | 'mote' | 'rain' | 'ember';
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number; // anim ms
  life: number;
  color: number;
  phase: number;
}

interface Pending {
  at: number; // anim time
  fn: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
/** Scale an RGB color toward black (f < 1) or white (f > 1). */
const shade = (c: number, f: number) => {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1))));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};
/** Text gets a gentle top-to-bottom gradient (lit top, deeper bottom), like the reference's lettering. */
const tintGrad = (t: Phaser.GameObjects.BitmapText, c: number) => {
  const top = shade(c, 1.12);
  const bot = shade(c, 0.78);
  t.setTint(top, top, bot, bot);
};
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
  private barImg: Phaser.GameObjects.Image | null = null;
  private boardImg: Phaser.GameObjects.Image | null = null;
  private gCards!: Phaser.GameObjects.Graphics;
  private crestImg: Phaser.GameObjects.Image | null = null;
  // objects
  private world!: Phaser.GameObjects.Container;
  private back!: Phaser.GameObjects.Container;
  private actors!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private front!: Phaser.GameObjects.Container;
  private bgImg!: Phaser.GameObjects.Image;
  private fgImg!: Phaser.GameObjects.Image;
  private frameImg!: Phaser.GameObjects.Image;
  private gBack!: Phaser.GameObjects.Graphics;
  private gAmb!: Phaser.GameObjects.Graphics;
  private backdrops = {} as Record<Theme, Backdrop>;
  private theme: Theme = 'forest';
  private ambient: Ambient[] = [];
  private nextAmbient = 0;
  private clouds: Phaser.GameObjects.Image[] = [];
  private gShadow!: Phaser.GameObjects.Graphics;
  private gSuper!: Phaser.GameObjects.Graphics;
  private superAt = -1e9;
  private superMs = superMsFor(1);
  private superStacks = 1;
  private superFinalAt = -1e9; // anim time of the finisher's last blow
  private sparks: Array<{ x: number; y: number; at: number; size: number; color: number }> = [];
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostTrail: Array<{ x: number; y: number; tex: string; flip: boolean; at: number }> = [];
  private kickDx = 0;
  private kickUntil = 0;
  private stackPopAt = -1e9;
  private stackLostAt = -1e9;
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
  private dying: Dying[] = [];
  private blockSeen = new Map<number, number>(); // block id -> anim time it first appeared
  private heroHpShown = 0;
  private lastMilestone = 0;
  private banner = '';
  private bannerUntil = 0;
  private chest: Phaser.GameObjects.Image | null = null;
  private pip!: Phaser.GameObjects.Image;
  private pipAnim = { state: 'idle' as 'idle' | 'swoop' | 'back', t0: 0, x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0 };
  private coinsShown = 0;
  private coinsPending = 0; // coins from kills whose burst hasn't spawned yet
  private coinFlights: Array<{ x0: number; y0: number; vx: number; vy: number; born: number; value: number }> = [];
  private lastCoinSound = 0;
  private chestAt = 0;
  private chestOpenAt = 0;

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
    this.front = this.add.container(0, 0);
    this.world.add([this.back, this.actors, this.front, this.fxLayer]);
    this.gPanel = this.add.graphics().setDepth(10);
    this.gBar = this.add.graphics().setDepth(11);
    this.gTop = this.add.graphics().setDepth(30);
    this.gCards = this.add.graphics().setDepth(31.5);
    const mk = (key: string, depth = 12, bold = false) => (this.txt[key] = this.add.bitmapText(0, 0, bold ? FONT_BOLD : FONT, '').setDepth(depth));
    ['level', 'ability', 'comboLabel', 'speed', 'tier', 'debug', 'enemyName'].forEach((k) => mk(k));
    ['heroHp', 'enemyHp', 'stat0', 'stat1', 'stat2', 'stat3', 'enemyAtk', 'combo', 'button', 'meterLabel', 'coins'].forEach((k) => mk(k, 12, true));
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
      lungeAt: -1e9,
    };
  }

  // ------------------------------------------------------------------ layout

  onLayout(): void {
    const l = this.app.layout;
    this.L = l.safeLeft;
    this.R = GAME_W - l.safeRight;
    this.B = GAME_H - l.safeBottom;
    this.splitY = Math.round(this.B - 46);
    this.ground = this.splitY - 9;
    this.heroHome = Math.round(GAME_W / 2 - 40);
    const btnW = 44;
    this.button = { x: this.R - btnW - 3, y: this.splitY + 5, w: btnW, h: BAND_H - 10 };
    const barX = this.L + 30;
    // the finisher is a swipe by default: no button, so the bar spans the whole band
    const swipe = this.app.settings.finisherInput === 'swipe';
    const barEnd = swipe ? this.R - 30 : this.button.x - 11;
    this.bar = { x: barX, y: this.splitY + 10, w: barEnd - barX, h: 12 };
    const meterX = this.L + 46;
    this.meter = { x: meterX, y: this.splitY + BAND_H + 3, w: this.button.x - 11 - meterX, h: 8 };

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
    this.dying = [];
    this.back.removeAll(true);
    this.actors.removeAll(true);
    this.fxLayer.removeAll(true);
    this.front.removeAll(true);
    this.ambient = [];
    this.panelImg?.destroy();
    buildArt(this, GAME_W);
    this.backdrops = buildBackdrops(this, GAME_W, this.splitY, this.ground);
    buildPanel(this, GAME_W, GAME_H - this.splitY, BAND_H);
    this.panelImg = this.add.image(0, this.splitY, 'panel').setOrigin(0, 0).setDepth(9);
    buildBarFrame(this, this.bar.w, this.bar.h);
    this.barImg?.destroy();
    this.barImg = this.add.image(this.bar.x - 9, this.bar.y - 5, 'barframe').setOrigin(0, 0).setDepth(10.5);
    const bp = this.boostPanel();
    buildBoard(this, 'board_boost', bp.w, bp.h);
    this.boardImg?.destroy();
    this.boardImg = this.add.image(bp.x, bp.y, 'board_boost').setOrigin(0, 0).setDepth(31).setVisible(false);
    buildCrest(this);
    this.crestImg?.destroy();
    this.crestImg = this.add.image(0, 0, 'crest').setOrigin(0.5, 0.5).setDepth(31).setVisible(false);
    this.bgImg = this.add.image(0, 0, 'bg_forest').setOrigin(0, 0);
    this.back.add(this.bgImg);
    this.clouds = [0, 1].map((i) => this.add.image(i * GAME_W, 4, 'clouds').setOrigin(0, 0).setAlpha(0.95));
    this.back.add(this.clouds);
    // framing trees/canopies drawn over the drifting clouds
    this.frameImg = this.add.image(0, 0, 'frame_forest').setOrigin(0, 0);
    this.back.add(this.frameImg);
    this.gBack = this.add.graphics();
    this.back.add(this.gBack);
    this.fgImg = this.add.image(0, 0, 'fg_forest').setOrigin(0, 0);
    this.gAmb = this.add.graphics();
    this.front.add([this.gAmb, this.fgImg]);
    this.gSuper = this.add.graphics();
    this.back.add(this.gSuper);
    this.gShadow = this.add.graphics();
    this.back.add(this.gShadow);
    this.pip = this.add.image(this.heroHome - 30, this.ground - 24, 'pip_idle0').setOrigin(0.5, 0.5);
    this.actors.add(this.pip);
    this.pipAnim = { state: 'idle', t0: 0, x: this.heroHome - 30, y: this.ground - 24, fromX: 0, fromY: 0, toX: 0, toY: 0 };
    this.ghosts = [0, 1, 2].map(() => this.add.image(0, 0, 'hero_dash').setVisible(false).setTintMode(Phaser.TintModes.FILL));
    this.actors.add(this.ghosts);
    this.ghostTrail = [];
    this.sparks = [];
    this.superFinalAt = -1e9;
    this.hero = this.add.image(this.heroHome, this.ground, 'hero_idle0').setScale(SPRITE_SCALE);
    this.actors.add(this.hero);
    this.coinFlights = [];
    this.coinsPending = 0;
    this.coinsShown = this.app.run.coins;
    this.gFx = this.add.graphics();
    this.fxLayer.add(this.gFx);
    this.enemies.clear();
    this.lastCombat = null;
    this.h = this.freshHero();
    this.applyTheme();
  }

  /** Each level has its own backdrop (tuning.levels[i].theme; default: forest first, then ruins). */
  private applyTheme(): void {
    const run = this.app.run;
    const theme: Theme = run.level.theme ?? (run.levelIndex === 0 ? 'forest' : 'ruins');
    if (!this.backdrops[theme]) return;
    this.theme = theme;
    this.ambient = [];
    this.bgImg.setTexture(`bg_${theme}`);
    this.fgImg.setTexture(`fg_${theme}`);
    this.frameImg.setTexture(`frame_${theme}`);
    for (const cl of this.clouds) {
      if (theme === 'ruins') cl.setTint(0x6a7090).setAlpha(0.45);
      else cl.clearTint().setAlpha(0.95);
    }
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

  /** Level clear: the first tap bursts the chest open (returns true = consumed); the next one moves on. */
  levelClearTap(): boolean {
    if (!this.chest) return false;
    if (!this.chestOpenAt) {
      if (this.anim - this.chestAt < 550) return true;
      this.chestOpenAt = this.anim;
      this.chest.setTexture('chest_open');
      const x = this.chest.x;
      const y = this.ground - 18;
      this.burst(x, y, 0xf2c230, 30, true, 1.6);
      this.burst(x, y, 0x5ae070, 12, true, 1.4);
      this.burst(x, y, WHITE, 10, true, 1.2, true);
      this.ring(x, y, 34, 0xffe680, true);
      this.shake(this.app.tuning.juice.shakeMaxPx, 160);
      this.app.audio.kill();
      return true;
    }
    return this.anim - this.chestOpenAt < 400;
  }

  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++) if (inRect(this.cardRect(i), x, y)) return i;
    return -1;
  }

  /** Boost choices: a wooden panel with three stacked buttons (hit-tested by index). */
  private boostPanel(): Rect {
    return { x: Math.round(GAME_W / 2 - 78), y: 17, w: 156, h: 116 };
  }

  private cardRect(i: number): Rect {
    const p = this.boostPanel();
    return { x: p.x + 8, y: p.y + 20 + i * 31, w: p.w - 16, h: 28 };
  }

  // ------------------------------------------------------------------ events

  onPhase(_prev: Phase, next: Phase): void {
    if (next === 'fight') this.syncEnemies(true);
    if (next === 'levelClear') {
      this.chest?.destroy();
      this.chest = this.add.image(GAME_W / 2, -30, 'chest_closed').setOrigin(0.5, 1).setScale(2);
      this.actors.add(this.chest);
      this.chestAt = this.anim;
      this.chestOpenAt = 0;
    } else if (this.chest) {
      this.chest.destroy();
      this.chest = null;
    }
    if (next !== 'fight' && this.h.state !== 'idle') this.heroReturn();
  }

  onEvents(events: CombatEvent[]): number {
    const now = performance.now();
    const c = this.app.run.combat;
    if (!c) return 0;
    const J = this.app.tuning.juice;
    let hold = 0;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const x = this.barX(e.pos);
          const perfect = e.perfect;
          if (perfect || e.crit) this.judge(x, perfect ? 'Perfect!' : 'Crit!', perfect ? 0xfff07a : 0xff9a3a, true);
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
          if (e.perfect) this.judge(x, 'Perfect!', 0xfff07a, true, e.cracked ? 6 : 0);
          if (!e.cracked) this.replaceFloater('block', () => this.addFloater(this.h.x - 12, this.ground - 50, 'Block!', WHITE, 2, true, 0, -16, 0, 520, true));
          this.cursorPulse(0x7ae0ff);
          this.cursorHit(x, e.perfect ? 0x6aff5a : 0x7ae0ff);
          this.comboPopAt = now;
          this.milestone(e.combo);
          this.heroParry(e.ownerId, e.cracked);
          if (e.cracked) {
            // knocked back: a clang, sparks flying right, the bar jolts
            this.burst(x, this.bar.y + this.bar.h / 2, 0xc8d0e0, 6, false);
            this.chips(x + 6, this.bar.y + this.bar.h / 2, 4, [WHITE, 0xffe680, 0xc8d0e0], 10, 1);
            this.sparks.push({ x, y: this.bar.y + this.bar.h / 2, at: this.anim, size: 9, color: 0x9ad8ff });
            this.judge(x, 'Clang!', 0x9ad8ff, true, -6);
            this.barShakeUntil = now + 90;
          }
          break;
        }
        case 'trap':
          this.judge(this.barX(e.pos), 'Trap!', COL.purple[1], true);
          this.enemyLunge(e.enemyId, 1);
          this.screenFlash(COL.purple[0], now, 160);
          break;
        case 'miss':
          this.judge(this.barX(e.pos), 'Miss', 0x9a94b0, false);
          this.barShakeUntil = now + 140;
          if (this.h.state === 'idle') this.setHeroPose('windup', 120);
          break;
        case 'remove':
          this.blockDies(e.kind, e.pos, e.width, e.reason);
          break;
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
            if (e.damage > 0 || this.app.settings.godMode) this.floatNum(this.h.x, this.ground - 40, `${e.damage}`, 0xff4a4a, 1);
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
          const coins = this.app.tuning.enemies[c.enemyById(id)?.key ?? '']?.coins ?? 0;
          const isBoss = !!this.app.tuning.enemies[c.enemyById(id)?.key ?? '']?.boss;
          this.coinsPending += coins;
          // a finisher kill waits for the last blow; a normal kill for the hero's dash to land
          const delay = Math.max(this.h.state === 'dash' ? DASH_MS : 0, this.superFinalAt > this.anim ? this.superFinalAt - this.anim + 20 : 0);
          hold = Math.max(hold, delay * 1.3 + (isBoss ? 1300 : 900));
          this.later(delay, () => {
            const v = this.enemies.get(id);
            if (!v) {
              this.coinsPending -= coins;
              return;
            }
            v.dieAt = this.anim;
            const cy = v.y - v.img.displayHeight / 2;
            this.coinsPending -= coins;
            this.dropCoins(v.x, cy, coins);
            const boss = !!this.app.tuning.enemies[c.enemyById(id)?.key ?? '']?.boss;
            this.burst(v.x, cy, ENEMY_COL[v.sprite] ?? WHITE, boss ? 60 : 26, true, boss ? 1.9 : 1.4);
            this.burst(v.x, cy, 0xffffff, boss ? 24 : 12, true, 1.2);
            this.ring(v.x, cy, 40, 0xffe680, true);
            if (boss) {
              this.burst(v.x, cy, 0xff8a2a, 30, true, 1.6);
              for (const [ms, r, col] of [
                [90, 44, 0xff8a2a],
                [180, 58, 0xffd23a],
                [270, 72, 0xff5a3a],
              ] as const)
                this.later(ms, () => this.ring(v.x, cy, r, col, true));
              this.screenFlash(0xffe0a0, now, 220);
            }
            this.shake(J.shakeMaxPx, J.shakeMs * (boss ? 3 : 1.8));
            this.freeze(boss ? 170 : 90);
          });
          break;
        }
        case 'explode':
          this.explodeFx = { x: this.barX(e.pos), r: e.radius * this.bar.w, until: now + 260 };
          this.shake(J.shakeMaxPx, J.shakeMs * 1.5);
          this.floatNum(GAME_W / 2, 44, 'BOOM!', 0xff8a3a, 2);
          break;
        case 'finisher':
          this.heroFinisher(e.damage, e.stacks);
          hold = Math.max(hold, this.superMs);
          break;
        case 'pet':
          this.petAttack(e.enemyId, e.damage);
          break;
        case 'heal':
          this.floatNum(this.h.x, this.ground - 44, `+${e.amount}`, 0xff7aa8, 1);
          this.burst(this.h.x, this.ground - 16, 0xff7aa8, 10, true, 0.8);
          this.app.audio.heal();
          break;
        case 'ability':
          this.floatNum(this.h.x, this.ground - 46, 'Keen Edge', 0x9af0a0, 1);
          break;
        case 'speedUp':
          this.judge(this.bar.x + this.bar.w / 2, 'Speed up!', 0xff9a3a, true, -14);
          break;
        case 'comboBreak':
          this.comboBreakUntil = now + 420;
          this.lastMilestone = 0;
          if (e.lostStacks > 0) {
            // the banked stacks shatter out of the meter
            this.stackLostAt = now;
            const m = this.meter;
            this.chips(m.x + m.w / 2, m.y + m.h / 2, m.w, [stackCol(e.lostStacks)[0], stackCol(e.lostStacks)[1], WHITE], 18, 0);
            this.addFloater(m.x + m.w / 2, m.y - 10, `x${e.lostStacks} lost!`, 0xff5a5a, 1, true, 0, -20, 0, 800, false);
          }
          break;
        case 'meterFull': {
          const [col] = stackCol(e.stacks);
          this.stackPopAt = now;
          const m = this.meter;
          const bt = this.button;
          this.addFloater(bt.x + bt.w / 2 - 6, this.splitY - 8, e.stacks >= this.app.tuning.meter.maxStacks ? `x${e.stacks} MAX!` : `x${e.stacks}!`, stackCol(e.stacks)[1], 2, true, 0, -22, 0, 750, false);
          this.chips(m.x + m.w / 2, m.y, m.w * 0.8, [WHITE, stackCol(e.stacks)[1], col], 12, -1);
          break;
        }
        case 'revive':
          this.screenFlash(0x9af0a0, now, 320);
          this.floatNum(this.heroHome + 10, this.ground - 50, 'Revived!', 0x9af0a0, 2);
          break;
        case 'defeat':
          hold = Math.max(hold, 900);
          break;
      }
    }
    return hold;
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
      h.lungeAt = this.anim;
      this.enemyHurtFx(enemyId, damage, crit, perfect);
    });
  }

  /** Camera kick: the world jolts by dx px and springs back. */
  private kick(dx: number, ms: number): void {
    this.kickDx = dx;
    this.kickUntil = performance.now() + ms;
  }

  private enemyHurtFx(enemyId: number, damage: number, crit: boolean, perfect: boolean, finisher = false, scale = 0): void {
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const J = this.app.tuning.juice;
    const combo = this.app.run.combat?.combo ?? 0;
    const cy = v.y - v.img.displayHeight / 2;
    const big = crit || finisher;
    v.flashUntil = this.anim + J.flashMs;
    v.knockUntil = this.anim + (big ? 140 : 90);
    v.kickAt = this.anim;
    v.kickDist = finisher ? 14 : crit ? 10 : 6;
    if (!v.dieAt) this.setEnemyPose(v, 'hurt', 160);
    const col = finisher ? 0xff8a2a : crit ? 0xffb020 : perfect ? 0xfff07a : 0xffe040;
    // contact point: the enemy's front edge, at chest height
    const hx = Math.round(v.x - v.img.displayWidth * 0.3);
    if (big) this.stars.push({ x: v.x, y: cy - 8, at: this.anim, r: finisher ? 34 : 24, color: finisher ? 0xffb03a : 0xfff07a });
    this.sparks.push({ x: hx, y: cy, at: this.anim, size: finisher ? 18 : crit ? 14 : 10, color: big ? 0xfff07a : 0xbfe8ff });
    const numScale = scale || (finisher ? 3 : 2);
    // quick successive numbers cascade upward and alternate sides instead of piling on each other
    const recent = this.anim - v.numAt < 260;
    v.numLevel = recent ? (v.numLevel + 1) % 3 : 0;
    v.numAt = this.anim;
    this.floatNum(v.x + (v.numLevel % 2 ? 8 : -6) + rand(-2, 2), v.y - v.img.displayHeight - 10 - v.numLevel * 11, `${damage}`, col, numScale);
    const tier = combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;
    this.slashes.push({ x: v.x, y: cy, at: this.anim, big: big || tier >= 2, dir: this.h.alt ? 1 : -1, color: crit ? 0xffd23a : comboSlashCol(combo) });
    this.burst(hx, cy, WHITE, (big ? 14 : 8) + tier * 2, true, big ? 1.6 : 1.1, true);
    this.chips(hx, cy, 6, [WHITE, col, ENEMY_COL[v.sprite] ?? WHITE], big ? 10 : 5, 0);
    if (big) this.ring(v.x, cy, 28, col, true);
    this.kick(big ? 4 : 2, big ? 110 : 70);
    if (big) this.shake(J.shakeMaxPx, J.shakeMs * 1.4);
    this.freeze(big ? 90 : 50);
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

  /**
   * The finisher show, scaled by the stacks spent: the hero dashes in and whirls through the enemies with a
   * flurry of strikes (more stacks = more strikes, a longer show and a hotter backdrop), then lands one huge
   * blow whose number counts up. Kills and the HP bars wait for that last blow.
   */
  private heroFinisher(damage: number, stacks: number): void {
    const h = this.h;
    const J = this.app.tuning.juice;
    const n = Math.max(1, Math.min(5, stacks));
    const views = [...this.enemies.values()].filter((v) => !v.dieAt);
    const front = views.slice().sort((a, b) => a.homeX - b.homeX)[0];
    this.superMs = superMsFor(n);
    this.superStacks = n;
    const ms = this.superMs;
    h.state = 'super';
    h.fromX = h.x;
    h.toX = front ? front.homeX - 8 : h.x + 80;
    h.t0 = this.anim;
    h.lastAction = this.anim + ms;
    this.superAt = this.anim;
    const finalK = 0.8;
    this.superFinalAt = this.anim + ms * finalK;
    const [col, hi] = stackCol(n);
    this.addFloater(GAME_W / 2, 42, FINISHER_NAME[n] ?? 'Finisher!', n === 1 ? 0xffe680 : hi, n >= 2 ? 3 : 2, true, 0, -6, 0, ms * 0.95, true);
    // the flurry: 1 + 2n quick strikes between 30% and 70% of the show
    const strikes = 1 + 2 * n;
    for (let s = 0; s < strikes; s++) {
      const k = 0.3 + (0.4 * s) / Math.max(1, strikes - 1);
      this.later(ms * k, () => {
        for (const v of views) {
          const cy = v.y - v.img.displayHeight / 2 + rand(-6, 4);
          v.flashUntil = this.anim + 40;
          v.kickAt = this.anim;
          v.kickDist = 4;
          this.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: this.anim, big: s % 2 === 1, dir: s % 2 ? 1 : -1, color: s % 3 === 2 ? hi : col });
          this.sparks.push({ x: v.x + rand(-8, 4), y: cy, at: this.anim, size: 8, color: hi });
          this.burst(v.x, cy, WHITE, 5, true, 1.3, true);
        }
        this.app.audio.finisherStrike(s, strikes);
        this.kick(s % 2 ? 2 : -2, 60);
        this.freeze(25);
      });
    }
    // the last blow
    this.later(ms * finalK, () => {
      for (const v of views) {
        this.enemyHurtFx(v.id, damage, false, false, true, 3);
        // the damage number (the floater enemyHurtFx just made) counts up over the enemy, hangs longer, rises slowly
        const num = this.floaters[this.floaters.length - 1];
        if (num && damage > 0) {
          num.y = Math.max(34, v.y - v.img.displayHeight / 2 - 4);
          num.count = { to: damage, dur: 260 + 50 * n };
          num.life = 1300 + 100 * n;
          num.vy = -28;
          num.g = 20;
          num.vx = 0;
        }
        const cy = v.y - v.img.displayHeight / 2;
        for (let r = 0; r < n; r++) this.later(r * 70, () => this.ring(v.x, cy, 30 + r * 14, r % 2 ? hi : col, true));
        this.stars.push({ x: v.x, y: cy - 6, at: this.anim, r: 30 + n * 6, color: col });
        this.burst(v.x, cy, col, 16 + n * 8, true, 1.6 + n * 0.15);
      }
      this.app.audio.finisherBoom(n);
      this.screenFlash(n >= 3 ? 0xfff0c0 : WHITE, performance.now(), 160 + 40 * n);
      this.shake(J.shakeMaxPx + n, J.shakeMs * (1.6 + 0.4 * n));
      this.kick(6, 160);
      this.freeze(110 + 30 * n);
    });
  }

  private dropCoins(x: number, y: number, total: number): void {
    if (total <= 0) return;
    const n = Math.max(3, Math.min(10, Math.round(total / 5)));
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const value = Math.floor(total / n) + (i < total % n ? 1 : 0);
      this.coinFlights.push({ x0: x, y0: y, vx: rand(-60, 60), vy: rand(-110, -60), born: now + i * 25, value });
    }
  }

  /** Coins pop out, then home in on the coin counter; the counter ticks up as each one lands. */
  private drawCoins(g: Phaser.GameObjects.Graphics, now: number): void {
    const tx = this.L + 95;
    const ty = 7;
    for (let i = this.coinFlights.length - 1; i >= 0; i--) {
      const f = this.coinFlights[i];
      const age = (now - f.born) / 1000;
      if (age < 0) continue;
      const T1 = 0.28;
      const T2 = 0.42;
      let x: number;
      let y: number;
      const pop = (t: number) => ({ x: f.x0 + f.vx * t, y: f.y0 + f.vy * t + 260 * t * t });
      if (age < T1) ({ x, y } = pop(age));
      else {
        const p = pop(T1);
        const k = ease(clamp01((age - T1) / T2));
        x = p.x + (tx - p.x) * k;
        y = p.y + (ty - p.y) * k;
        if (k >= 1) {
          this.coinFlights.splice(i, 1);
          this.coinsShown += f.value;
          if (now - this.lastCoinSound > 55) {
            this.lastCoinSound = now;
            this.app.audio.coin();
          }
          continue;
        }
      }
      // a spinning gold coin: 5 px face that narrows to its edge and back
      const X = Math.round(x);
      const Y = Math.round(y);
      const spin = [2, 1, 0, 1][Math.floor(now / 70 + i) % 4];
      this.rows(g, X - spin - 1, Y - 3, spin * 2 + 3, 7, spin > 0 ? 2 : 1, INK);
      g.fillStyle(spin === 0 ? 0xb07e18 : 0xf2c230, 1);
      g.fillRect(X - spin, Y - 2, spin * 2 + 1, 5);
      if (spin > 0) {
        g.fillStyle(0xfff0a0, 1);
        g.fillRect(X - spin, Y - 2, 1, 3);
        g.fillStyle(0xd8901c, 1);
        g.fillRect(X + spin, Y - 1, 1, 3);
        g.fillRect(X - spin + 1, Y + 2, spin * 2, 1);
      }
    }
    if (!this.coinFlights.length && this.coinsPending <= 0) this.coinsShown = this.app.run.coins;
  }

  private petAttack(enemyId: number, damage: number): void {
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const P = this.pipAnim;
    Object.assign(P, { state: 'swoop', t0: this.anim, fromX: P.x, fromY: P.y, toX: v.homeX - v.img.displayWidth / 2 - 2, toY: v.y - v.img.displayHeight * 0.6 });
    this.later(PIP_SWOOP_MS, () => {
      const cy = v.y - v.img.displayHeight / 2;
      v.flashUntil = this.anim + 50;
      v.knockUntil = this.anim + 60;
      this.floatNum(v.x + rand(-4, 4), v.y - v.img.displayHeight - 8, `${damage}`, 0x6aff5a, 1);
      this.burst(v.x - 6, cy, 0xb8e4ff, 8, true, 1, true);
      this.app.audio.pet();
      Object.assign(P, { state: 'back', t0: this.anim, fromX: P.x, fromY: P.y });
    });
  }

  private updatePip(): void {
    const P = this.pipAnim;
    const a = this.anim;
    const homeX = this.h.x - 30;
    const homeY = this.ground - 24 + Math.sin(a / 260) * 2;
    let tex = Math.floor(a / 110) % 2 ? 'pip_idle1' : 'pip_idle0';
    if (P.state === 'swoop') {
      const k = clamp01((a - P.t0) / PIP_SWOOP_MS);
      P.x = P.fromX + (P.toX - P.fromX) * ease(k);
      P.y = P.fromY + (P.toY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 10;
      tex = 'pip_dive';
    } else if (P.state === 'back') {
      const k = clamp01((a - P.t0) / PIP_BACK_MS);
      P.x = P.fromX + (homeX - P.fromX) * ease(k);
      P.y = P.fromY + (homeY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 14;
      if (k >= 1) P.state = 'idle';
    } else {
      P.x += (homeX - P.x) * 0.12;
      P.y = homeY;
    }
    this.pip.setTexture(tex).setPosition(Math.round(P.x), Math.round(P.y)).setVisible(this.app.tuning.companion.everyHits > 0);
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
      [10, 'Nice!'],
      [25, 'Great!'],
      [50, 'Awesome!'],
      [75, 'Insane!'],
      [100, 'Godlike!'],
    ];
    for (const [n, label] of marks)
      if (combo >= n && this.lastMilestone < n) {
        this.lastMilestone = n;
        this.addFloater(GAME_W / 2 + 10, 36, `${n} Combo - ${label}`, 0xffd23a, 1, true, 0, -14, 0, 900, true);
        this.app.audio.ready2();
      }
  }

  // ------------------------------------------------------------------ small fx helpers

  /** A removed block plays out on the bar (see drawDying) and throws chips. */
  private blockDies(kind: BlockKind, pos: number, width: number, reason: RemoveReason): void {
    const style = dyingStyle(kind, reason);
    const x = this.barX(pos);
    const w = Math.max(6, Math.round(width * this.bar.w) - 1);
    this.dying.push({ x, w, kind, reason, style, at: this.anim });
    for (const id of this.blockSeen.keys()) if (!this.app.run.combat?.blocks.some((b) => b.id === id)) this.blockSeen.delete(id);
    if (this.dying.length > 24) this.dying.shift();
    const [base, light] = reason === 'bomb' ? BOMB_COL : kindCol(kind);
    const top = this.bar.y - 5;
    const mid = this.bar.y + this.bar.h / 2;
    if (style === 'pop') {
      this.chips(x, top, w, [WHITE, light, base], 10, -1);
    } else if (style === 'shatter') {
      this.chips(x, mid, w, [base, light, WHITE], 12, 0);
      this.chips(x, mid, w, [0x7ae0ff, WHITE], 4, -1);
    } else if (style === 'crunch') {
      this.chips(x - w / 2, mid, 4, [base, light, WHITE], 9, 1);
    } else if (style === 'zip') {
      this.chips(x, mid, w, [WHITE, light], 5, 0);
    }
  }

  /** Chunky 2px chips flung out of a block. dir: -1 = upward, 0 = all around, 1 = to the right. */
  private chips(x: number, y: number, spread: number, colors: readonly number[], n: number, dir: number): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const vx = dir === 1 ? rand(40, 140) : rand(-90, 90);
      const vy = dir === -1 ? rand(-190, -80) : rand(-150, 10);
      this.particles.push({ x: x + rand(-spread / 2, spread / 2), y: y + rand(-2, 2), vx, vy, g: 520, born: now, life: rand(220, 380), color: colors[i % colors.length], size: i % 4 === 0 ? 2 : 1, world: false, streak: false, shape: 'shard' });
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

  /** A judgment word over the bar. Only one at a time: a new one replaces the last. */
  private judge(x: number, text: string, color: number, pop: boolean, dy = 0): void {
    const w = textWidth(text, 1, true);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.replaceFloater('judge', () => this.addFloater(x, this.bar.y - 10 + dy, text, color, 1, false, 0, pop ? -40 : -26, pop ? 60 : 0, 520, false));
  }

  private singles: Record<string, Floater | undefined> = {};

  /** Spawn a floater that replaces the previous one with the same key (if it's still alive). */
  private replaceFloater(key: string, make: () => void): void {
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

  private floatNum(x: number, y: number, text: string, color: number, scale: number): void {
    const w = textWidth(text, scale, true);
    x = Math.max(w / 2 + 2, Math.min(GAME_W - w / 2 - 2, x));
    this.addFloater(x, y, text, color, scale, true, rand(-6, 6), -60, 140, 760, true);
  }

  private addFloater(x: number, y: number, text: string, color: number, scale: number, pop: boolean, vx: number, vy: number, g: number, life: number, world: boolean): void {
    const t = this.pool.pop() ?? this.add.bitmapText(0, 0, FONT, '');
    t.setFont(FONT_BOLD);
    t.setText(fontText(text)).setOrigin(0.5, 0.5).setVisible(true).setAlpha(1).setScale(scale);
    tintGrad(t, color);
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
        shape: streak ? 'streak' : Math.random() < 0.4 ? 'shard' : 'chip',
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
    if (count === 1) return Math.round(GAME_W / 2 + 44);
    return Math.round(GAME_W / 2 + 18 + slot * 32);
  }

  private syncEnemies(force = false): void {
    const c = this.app.run.combat;
    if (!c) return;
    if (c === this.lastCombat && !force) return;
    if (c !== this.lastCombat) {
      for (const v of this.enemies.values()) v.img.destroy();
      this.enemies.clear();
      this.h = this.freshHero();
      this.superFinalAt = -1e9;
      this.superAt = -1e9;
      this.blockSeen.clear();
      this.applyTheme();
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
        kickAt: -1e9,
        kickDist: 0,
        numAt: -1e9,
        numLevel: 0,
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
    this.updateFloatersAndCoins(now);
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
      const k = clamp01((a - h.t0) / this.superMs);
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
    const spinning = h.state === 'super' && a - h.t0 > this.superMs * 0.06 && a - h.t0 < this.superMs * 0.94;
    this.hero.setVisible(!spinning);
    this.hero.setTexture(`hero_${pose}`);
    this.hero.setFlipX(flip);
    this.hero.setOrigin((flip ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W, 1);
    // a small forward lunge on every slash
    const lk = (a - h.lungeAt) / 90;
    const lunge = lk >= 0 && lk < 1 ? Math.round(4 * Math.sin(lk * Math.PI)) : 0;
    this.hero.setPosition(Math.round(h.x + knock + lunge), Math.round(this.ground + yOff));
    // afterimages while dashing, returning or leaping
    const moving = (h.state === 'dash' || h.state === 'return' || h.state === 'leap' || (h.state === 'super' && !spinning)) && this.hero.visible;
    const last = this.ghostTrail[this.ghostTrail.length - 1];
    if (moving && (!last || a - last.at > 22)) {
      this.ghostTrail.push({ x: this.hero.x, y: this.hero.y, tex: `hero_${pose}`, flip, at: a });
      if (this.ghostTrail.length > 3) this.ghostTrail.shift();
    }
    this.ghosts.forEach((gh, i) => {
      const tr = this.ghostTrail[this.ghostTrail.length - 1 - i];
      const age = tr ? a - tr.at : 1e9;
      if (!tr || age > 140) return void gh.setVisible(false);
      gh.setTexture(tr.tex).setFlipX(tr.flip).setOrigin(this.hero.originX, 1).setPosition(tr.x, tr.y);
      gh.setTint(i === 0 ? 0xbfe8ff : 0x6ab4ff).setAlpha((0.5 - i * 0.14) * (1 - age / 140)).setVisible(true);
    });
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
    const kx = now < this.kickUntil ? Math.round(this.kickDx * Math.sin(((this.kickUntil - now) / 110) * Math.PI * 0.5)) : 0;
    if (now < this.shakeUntil) {
      const m = Math.round(this.shakeMag);
      this.world.setPosition(Math.round(rand(-m, m)) + kx, Math.round(rand(-m, m)));
    } else this.world.setPosition(kx, 0);
    const drift = (now * 0.004) % GAME_W;
    this.clouds[0].setX(Math.round(-drift));
    this.clouds[1].setX(Math.round(GAME_W - drift));

    this.updateHero();
    this.updatePip();
    this.drawAmbient();
    this.drawSuper(now);
    if (this.chest) {
      const k = clamp01((this.anim - this.chestAt) / 600);
      const bounce = k < 0.6 ? (k / 0.6) ** 2 : 1 - Math.abs(Math.sin((k - 0.6) * Math.PI * 2.5)) * 0.12 * (1 - k);
      this.chest.setY(Math.round(-30 + (this.ground + 30) * bounce));
      if (!this.chestOpenAt && Math.random() < 0.25) {
        const sx = this.chest.x + rand(-20, 20);
        const sy = this.chest.y - rand(4, 30);
        this.particles.push({ x: sx, y: sy, vx: 0, vy: -12, g: 0, born: now, life: 420, color: Math.random() < 0.5 ? 0xfff0a0 : WHITE, size: 1, world: true, streak: false });
      }
    }
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
        // spring knockback: pushed away from the hero, overshoots back, settles
        const kk = (a - v.kickAt) / 260;
        if (kk >= 0 && kk < 1) x += Math.round(v.kickDist * Math.exp(-4.5 * kk) * Math.cos(kk * Math.PI * 2.2));
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
        // squash on impact: wide and short for a few frames, then a little stretch back
        const sq = (a - v.kickAt) / 150;
        const amt = sq >= 0 && sq < 1 ? Math.sin(sq * Math.PI) * (sq < 0.5 ? 0.16 : -0.06) * (v.kickDist / 8) : 0;
        v.img.setTexture(`${v.sprite}_${pose}`).setPosition(Math.round(x), v.y - walkBob).setScale(SPRITE_SCALE * (1 + amt), SPRITE_SCALE * (1 - amt)).setAlpha(1);
        shadow(x, v.img.displayWidth * 0.8, 0.3);
        if (a >= this.superFinalAt) v.hpShown += (e.hp - v.hpShown) * 0.25;
        if (c.enemies.length > 1) {
          const bw = Math.max(26, Math.round(v.img.displayWidth * 0.7));
          const bx = Math.round(v.homeX - bw / 2);
          const by = Math.round(v.y - v.img.displayHeight - 8);
          this.hpBar(g, bx, by, bw, 3, e.hp / e.maxHp, v.hpShown / e.maxHp, 0xe0463c);
          const def = this.app.tuning.enemies[e.key];
          const isTarget = target?.id === e.id;
          this.icon(g, ICONS[def.icon], bx - 9, by - 2, 0xff8a7a);
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

    // slash arcs: tapered crescents (outer colored edge, bright inner core), sweeping open then thinning out
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      const k = (this.anim - sl.at) / (sl.big ? 170 : 120);
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
      g.fillStyle(INK, (1 - k) * 0.9);
      g.fillPoints(star(r + 2), true);
      g.fillStyle(st.color, 1 - k);
      g.fillPoints(star(r), true);
      g.fillStyle(0xfff6c8, 1 - k);
      g.fillPoints(star(r * 0.72), true);
      g.fillStyle(WHITE, 1 - k);
      g.fillPoints(star(r * 0.45), true);
    }
    this.drawRings(g, now, true);
    this.drawSparks(g);
    this.drawParticles(g, now, true);
  }

  /** Impact sparks: a big 4-point star at the contact point that flips between + and x for a few frames. */
  private drawSparks(g: Phaser.GameObjects.Graphics): void {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      const k = (this.anim - sp.at) / 130;
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

  /** Living backdrop: torches flicker; leaves, motes, rain and embers drift through the scene. */
  private drawAmbient(): void {
    const a = this.anim;
    const gb = this.gBack;
    const g = this.gAmb;
    gb.clear();
    g.clear();
    const theme = this.theme;
    for (const t of this.backdrops[theme]?.torches ?? []) {
      const f = Math.sin(a / 70 + t.x) * 0.5 + Math.sin(a / 33 + t.x * 3) * 0.5;
      gb.fillStyle(0xffa040, 0.1);
      gb.fillCircle(t.x + 0.5, t.y - 2, 15 + f * 2);
      gb.fillStyle(0xffc060, 0.14);
      gb.fillCircle(t.x + 0.5, t.y - 2, 9 + f);
      const fh = 6 + Math.round(f * 1.5);
      gb.fillStyle(0xe8441a, 1);
      gb.fillRect(t.x - 2, t.y - fh + 2, 5, fh - 1);
      gb.fillStyle(0xff9a2a, 1);
      gb.fillRect(t.x - 1, t.y - fh, 3, fh);
      gb.fillRect(t.x + (Math.floor(a / 90) % 2 ? -2 : 2), t.y - fh + 3, 1, 2);
      gb.fillStyle(0xfff0a0, 1);
      gb.fillRect(t.x, t.y - fh + 2, 1, fh - 3);
      if (Math.random() < 0.04) this.ambient.push({ kind: 'ember', x: t.x + rand(-1, 1), y: t.y - fh, vx: rand(-6, 6), vy: rand(-26, -14), born: a, life: rand(500, 900), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, phase: 0 });
    }
    // spawn
    const W = GAME_W;
    const top = 0;
    const bottom = this.ground + 4;
    while (a >= this.nextAmbient) {
      if (this.nextAmbient === 0) this.nextAmbient = a;
      if (theme === 'forest') {
        if (Math.random() < 0.3)
          this.ambient.push({ kind: 'leaf', x: rand(0, W), y: top - 2, vx: rand(4, 14), vy: rand(10, 18), born: a, life: 9000, color: [0x5aa84c, 0x8ac850, 0xe8c048][Math.floor(Math.random() * 3)], phase: rand(0, 6) });
        else this.ambient.push({ kind: 'mote', x: rand(20, W - 20), y: rand(30, bottom), vx: rand(-3, 3), vy: rand(-6, -2), born: a, life: rand(2500, 4500), color: Math.random() < 0.6 ? 0xffffff : 0xfff0a0, phase: rand(0, 6) });
        this.nextAmbient += 260;
      } else {
        this.ambient.push({ kind: 'rain', x: rand(-20, W), y: rand(-10, 20), vx: 50, vy: 260, born: a, life: 900, color: 0x9ab8e8, phase: 0 });
        this.nextAmbient += 22;
      }
    }
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i];
      const age = a - p.born;
      const t = age / 1000;
      let x = p.x + p.vx * t;
      const y = p.y + p.vy * t;
      if (age > p.life || y > bottom + 6 || x > W + 10) {
        if (p.kind === 'rain' && y > bottom - 10) {
          g.fillStyle(0xb8d0f0, 0.5);
          g.fillRect(Math.round(x) - 1, Math.round(this.ground - rand(0, 8)), 1, 1);
          g.fillRect(Math.round(x) + 1, Math.round(this.ground - rand(0, 8)), 1, 1);
        }
        this.ambient.splice(i, 1);
        continue;
      }
      if (p.kind === 'leaf') {
        x += Math.sin(t * 2.4 + p.phase) * 6;
        const flat = Math.floor(t * 4 + p.phase) % 2 === 0;
        g.fillStyle(p.color, 1);
        g.fillRect(Math.round(x), Math.round(y), flat ? 2 : 1, flat ? 1 : 2);
      } else if (p.kind === 'mote') {
        const k = age / p.life;
        g.fillStyle(p.color, Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(t * 6 + p.phase)));
        g.fillRect(Math.round(x + Math.sin(t * 1.5 + p.phase) * 3), Math.round(y), 1, 1);
      } else if (p.kind === 'rain') {
        g.fillStyle(p.color, 0.45);
        g.fillRect(Math.round(x), Math.round(y), 1, 3);
        g.fillRect(Math.round(x + 1), Math.round(y + 3), 1, 2);
      } else {
        const k = age / p.life;
        g.fillStyle(p.color, 1 - k);
        g.fillRect(Math.round(x + Math.sin(t * 8 + p.x) * 1.5), Math.round(y), 1, 1);
      }
    }
    if (this.ambient.length > 160) this.ambient.splice(0, this.ambient.length - 160);
  }

  /**
   * Finisher special: the sky swaps to a streaked backdrop while the hero whirls through the enemies. Its colors
   * heat up with the stacks spent (blue, violet, gold, crimson, then a cycling rainbow), with radial speed lines.
   */
  private drawSuper(now: number): void {
    const g = this.gSuper;
    g.clear();
    const k = (this.anim - this.superAt) / this.superMs;
    if (k < 0 || k >= 1) return;
    const n = this.superStacks;
    const alpha = k < 0.08 ? k / 0.08 : k > 0.86 ? (1 - k) / 0.14 : 1;
    const bottom = this.ground - 8;
    const PAL: Record<number, number[]> = {
      1: [0x1022a8, 0x1a3cc8, 0x2a62dc, 0x3a8ae8, 0x48b4f0, 0x5ad8f4],
      2: [0x2a0e6a, 0x441a9a, 0x6a2ac8, 0x8a4ae0, 0xb07af0, 0xd8b0ff],
      3: [0x6a2a08, 0x9a420a, 0xc86a10, 0xe8941a, 0xf8c040, 0xffe890],
      4: [0x5a0a1e, 0x8a1230, 0xb81c3e, 0xe0344e, 0xf86a6a, 0xffb0a0],
    };
    let bands = PAL[Math.min(4, n)];
    if (n >= 5) {
      // white-hot: cycle through every palette
      const cyc = [PAL[1], PAL[2], PAL[3], PAL[4]];
      bands = cyc[Math.floor(this.anim / 90) % cyc.length];
    }
    const bh = Math.ceil(bottom / bands.length);
    bands.forEach((col, i) => {
      g.fillStyle(col, alpha);
      g.fillRect(0, i * bh, GAME_W, Math.min(bh, bottom - i * bh));
    });
    const lines = 14 + n * 4;
    const hiCol = stackCol(n)[1];
    for (let i = 0; i < lines; i++) {
      const y = 4 + ((i * 37) % Math.max(1, bottom - 8));
      const len = 18 + ((i * 53) % 46) + n * 4;
      const speed = 0.5 + (i % 3) * 0.25 + n * 0.08;
      const x = ((((i * 97 - now * speed) % (GAME_W + 80)) + GAME_W + 80) % (GAME_W + 80)) - 40;
      g.fillStyle(i % 3 === 0 ? hiCol : WHITE, alpha * (i % 2 ? 0.85 : 0.5));
      g.fillRect(Math.round(x), y, len, i % 4 === 0 ? 2 : 1);
    }
    // whirlwind where the hero is
    const h = this.h;
    if (h.state !== 'super') return;
    const fx = this.gFx;
    const cx = h.x + 2;
    const [c1, c2] = stackCol(n);
    // a tornado: stacked spinning rings, wider at the top (taller with more stacks)
    for (let arc = 0; arc < 4 + n; arc++) {
      const base = this.anim / 30 + arc * 1.7;
      const r = 7 + arc * 4;
      const cy = this.ground - 4 - arc * 6;
      for (let j = 0; j < 18; j++) {
        const ang = base + j * 0.17;
        fx.fillStyle(j < 6 ? WHITE : j < 12 ? c2 : c1, 1 - j / 20);
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

  /** Small rounded HP bar over an enemy in a group fight. */
  private hpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, frac: number, ghost: number, color: number): void {
    this.rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK);
    g.fillStyle(0x3a2030, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(0xfff0c0, 1);
    g.fillRect(x, y, Math.round(w * clamp01(ghost)), h);
    const fw = Math.round(w * clamp01(frac));
    g.fillStyle(color, 1);
    g.fillRect(x, y, fw, h);
    g.fillStyle(WHITE, 0.45);
    g.fillRect(x, y, fw, 1);
  }

  private icon(g: Phaser.GameObjects.Graphics, rows: string[], x: number, y: number, color: number): void {
    g.fillStyle(color, 1);
    rows.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === '#') g.fillRect(x + xx, y + yy, 1, 1);
    });
  }

  /** Particles: chips (squares), shards (diamonds along their flight), sparks (4-point stars), streaks (speed lines). */
  private drawParticles(g: Phaser.GameObjects.Graphics, now: number, world: boolean): void {
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

  /** Rounded rectangle drawn row by row (pixel-art corners). */
  private rows(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): void {
    g.fillStyle(color, alpha);
    for (let i = 0; i < h; i++) {
      const k = cornerInset(i, h, r);
      if (w - k * 2 > 0) g.fillRect(x + k, y + i, w - k * 2, 1);
    }
  }

  /**
   * Reference-style meter: ink outline, a light metal bevel (lit top/left, dark bottom/right), a dark trough and a
   * 3-tone fill with a white "ghost" for recent loss. `mirror` drains from the left (enemy bars).
   */
  private hudBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    frac: number,
    ghost: number,
    o: { fill?: number; hi?: number; lo?: number; bg?: number; bgHi?: number; bgLo?: number; mirror?: boolean; frame?: boolean } = {},
  ): void {
    const framed = o.frame !== false;
    if (framed) {
      this.rows(g, x - 3, y - 3, w + 6, h + 6, 2, INK);
      this.rows(g, x - 2, y - 2, w + 4, h + 4, 1, 0xa8aec2);
      g.fillStyle(0xeef3fa, 1);
      g.fillRect(x - 1, y - 2, w + 2, 1);
      g.fillRect(x - 2, y - 1, 1, h + 2);
      g.fillStyle(0x6a7088, 1);
      g.fillRect(x - 1, y + h + 1, w + 2, 1);
      g.fillRect(x + w + 1, y - 1, 1, h + 2);
      g.fillStyle(INK, 1);
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
    } else this.rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK);
    const bg = o.bg ?? 0xc8303a;
    g.fillStyle(bg, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(o.bgHi ?? 0xf05a48, 1);
    g.fillRect(x, y, w, 1);
    g.fillStyle(o.bgLo ?? 0x8a1a22, 1);
    g.fillRect(x, y + h - 2, w, 2);
    const gw = Math.round(w * clamp01(ghost));
    const fw = Math.round(w * clamp01(frac));
    const at = (len: number) => (o.mirror ? x + w - len : x);
    g.fillStyle(0xfff6d8, 1);
    g.fillRect(at(gw), y, gw, h);
    if (fw > 0) {
      g.fillStyle(o.fill ?? 0x6ad040, 1);
      g.fillRect(at(fw), y, fw, h);
      g.fillStyle(o.hi ?? 0xb4f070, 1);
      g.fillRect(at(fw), y, fw, Math.max(1, Math.floor(h / 3)));
      g.fillStyle(o.lo ?? 0x3e9228, 1);
      g.fillRect(at(fw), y + h - 2, fw, 2);
      // a soft gloss line under the highlight
      g.fillStyle(WHITE, 0.35);
      g.fillRect(at(fw), y, fw, 1);
    }
  }

  /**
   * A chunky reference-style button: ink outline, 1 px light rim (white top/left, grey bottom/right), a face that
   * is lighter on top and darker at the bottom, and a drop shadow.
   */
  private button3d(g: Phaser.GameObjects.Graphics, r: Rect, face: readonly [number, number, number, number], pressed = false, rim = true): void {
    const y = r.y + (pressed ? 1 : 0);
    if (!pressed) this.rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 2, 3, INK, 0.45);
    this.rows(g, r.x - 1, y - 1, r.w + 2, r.h + 2, 3, INK);
    if (rim) {
      this.rows(g, r.x, y, r.w, r.h, 2, 0xc8d0dc);
      g.fillStyle(WHITE, 1);
      g.fillRect(r.x + 2, y, r.w - 4, 1);
      g.fillRect(r.x, y + 2, 1, r.h - 4);
      g.fillRect(r.x + 1, y + 1, 1, 1);
    }
    const ix = r.x + (rim ? 1 : 0);
    const iy = y + (rim ? 1 : 0);
    const iw = r.w - (rim ? 2 : 0);
    const ih = r.h - (rim ? 2 : 0);
    const [hi, base, lo, deep] = face;
    this.rows(g, ix, iy, iw, ih, rim ? 1 : 2, base);
    g.fillStyle(hi, 1);
    g.fillRect(ix + 1, iy, iw - 2, Math.max(1, Math.floor(ih * 0.4)));
    g.fillStyle(lo, 1);
    g.fillRect(ix + 1, iy + ih - 3, iw - 2, 2);
    g.fillStyle(deep, 1);
    g.fillRect(ix + 1, iy + ih - 1, iw - 2, 1);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(ix + iw - 5, iy + 1, 3, 1);
    g.fillRect(ix + 2, iy + ih - 3, 2, 1);
  }

  private iconSize(key: string): [number, number] {
    const rows = HUD_ICONS[key].rows;
    return [Math.max(...rows.map((r) => r.length)), rows.length];
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
    const title = run.phase === 'title';
    this.barImg?.setVisible(!title);
    if (title) return;
    // hero: heart + HP bar, stat column
    const H = run.hero;
    const maxHp = T.hero.maxHp + H.bonusMaxHp;
    this.heroHpShown += (H.hp - this.heroHpShown) * 0.2;
    this.hudBar(g, this.L + 19, 4, 66, 8, H.hp / maxHp, this.heroHpShown / maxHp);
    this.hudIcon(g, 'heart', this.L + 2, 1);
    ['sword', 'crit', 'bolt', 'potion'].forEach((k, i) => {
      const [w, h] = this.iconSize(k);
      this.hudIcon(g, k, this.L + 3 + ((12 - w) >> 1), Math.round(24.5 + i * 15 - h / 2));
    });
    this.hudIcon(g, 'coin', this.L + 92, 2);
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(this.L + 18, 15, Math.round(68 * (H.abilityTimer / Math.max(0.01, T.hero.abilitySec))), 1);
    }
    if (!c) return;
    // enemy (the current target): HP bar with a skull, attack stat below
    const target = run.phase === 'levelClear' ? null : (c.currentTarget() ?? c.enemies[0]);
    if (target) {
      const v = this.enemies.get(target.id);
      const bx = this.R - 86;
      const shownHp = this.anim < this.superFinalAt && v ? v.hpShown : target.hp;
      this.hudBar(g, bx + 1, 13, 66, 8, shownHp / target.maxHp, (v?.hpShown ?? target.hp) / target.maxHp, { mirror: true });
      this.hudIcon(g, 'skull', this.R - 14, 8);
      if (this.app.tuning.enemies[target.key].boss) this.hudIcon(g, 'crown', this.R - 14, 2);
      this.hudIcon(g, 'sword', this.R - 15, 25);
    }

    // finisher button on the wooden band: gray until a stack is banked, then the color of the stacks it holds
    const b = this.button;
    const ready = c.finisherReady;
    const stacks = c.stacks;
    const swipe = this.app.settings.finisherInput === 'swipe';
    const pulse = ready && Math.floor(now / (160 - stacks * 15)) % 2 === 0;
    const [sc, sh, sd] = stackCol(Math.max(1, stacks));
    const face = ready
      ? stacks <= 1
        ? pulse
          ? ([0xfff6c0, 0xffe066, 0xf2b030, 0xb07018] as const)
          : ([0xffe680, 0xf2c230, 0xd8901c, 0x9a5a14] as const)
        : ([pulse ? WHITE : sh, sc, sd, shade(sd, 0.7)] as const)
      : swipe
        ? ([0x5a5e70, 0x464a5c, 0x363a4a, 0x26283a] as const)
        : ([0x8a90a6, 0x6e7488, 0x585e72, 0x3e4254] as const);
    if (!swipe) this.button3d(g, b, face, false, ready);
    if (ready && !swipe) {
      // pulsing glow rings: one more ring per stack
      for (let r = 0; r < Math.min(3, stacks); r++) {
        const k = ((now + r * 180) % 560) / 560;
        this.rows(g, b.x - 3 - Math.round(k * 4), b.y - 3 - Math.round(k * 4), b.w + 6 + Math.round(k * 8), b.h + 6 + Math.round(k * 8), 4, stacks <= 1 ? 0xffe066 : sh, 0.45 * (1 - k));
      }
    }

    // finisher meter on the stone strip: the next stack fills over the color of the banked ones
    const m = this.meter;
    const maxed = stacks >= this.app.tuning.meter.maxStacks;
    const [fc, fh, fl] = stackCol(maxed ? stacks : stacks + 1);
    const [bc, bh, bl] = stackCol(stacks);
    this.hudBar(g, m.x, m.y, m.w, m.h, c.meter, c.meter, {
      fill: fc,
      hi: fh,
      lo: fl,
      bg: stacks > 0 ? bc : 0x161624,
      bgHi: stacks > 0 ? bh : 0x22223a,
      bgLo: stacks > 0 ? bl : 0x0e0e18,
      frame: false,
    });
    if (stacks > 0) {
      // the banked layer is dimmed so the filling layer reads on top of it
      g.fillStyle(INK, 0.35);
      g.fillRect(m.x + Math.round(m.w * c.meter), m.y, m.w - Math.round(m.w * c.meter), m.h);
    }
    if (ready) {
      // shimmer sweeping across, faster with more stacks
      const sx = m.x + ((now / (3.2 - stacks * 0.4)) % (m.w + 20)) - 10;
      g.fillStyle(WHITE, 0.55);
      for (let i = 0; i < 4; i++) if (sx + i - 2 >= m.x && sx + i - 2 < m.x + m.w) g.fillRect(Math.round(sx + i - 2), m.y, 2, m.h);
    }
    // flash when a stack is banked
    const pk = (now - this.stackPopAt) / 240;
    if (pk >= 0 && pk < 1) this.rows(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, 2, WHITE, 0.7 * (1 - pk));
    // red flash when stacks are lost
    const lk = (now - this.stackLostAt) / 360;
    if (lk >= 0 && lk < 1) {
      g.fillStyle(0xff3030, 0.6 * (1 - lk));
      g.fillRect(m.x, m.y, m.w, m.h);
    }
    this.hudIcon(g, 'bolt', m.x - 11, m.y - 2);
  }

  private drawBar(t: number, now: number): void {
    const g = this.gBar;
    g.clear();
    const c = this.app.run.combat;
    const B = this.bar;
    const bx = now < this.barShakeUntil ? Math.round(rand(-2, 2)) : 0;
    if (this.app.run.phase === 'title') return;
    this.barImg?.setX(B.x - 9 + bx);
    // the left end is where enemy attacks land: a warm warning glow
    g.fillStyle(0xe0463c, 0.85);
    g.fillRect(B.x + bx, B.y + 1, 2, B.h - 2);
    g.fillStyle(0xff9a80, 0.5);
    g.fillRect(B.x + bx + 2, B.y + 1, 1, B.h - 2);
    if (!c) return;

    const group = c.enemies.length > 1;
    for (const b of c.blocks) if (!isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);
    for (const b of c.blocks) if (isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);

    this.drawDying(g, bx);

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 260;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 4, r * 2, B.h + 8);
    }

    // cursor: a blue blade with silver caps (trail at speed, pulse on hits)
    const speed = c.speedMult();
    const hot = speed >= this.app.tuning.cursor.maxSpeedMult - 0.01;
    const blade = hot ? 0xff8a2a : 0x3a8ae8;
    const core = hot ? 0xffd080 : 0x9ad8ff;
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
    // a glowing blade: ink capsule, lit left edge, white-hot core, deep right edge
    const top = B.y - 7;
    const len = B.h + 14;
    this.rows(g, cx - 2, top, 5, len, 1, INK);
    g.fillStyle(blade, 1);
    g.fillRect(cx - 1, top + 1, 3, len - 2);
    g.fillStyle(core, 1);
    g.fillRect(cx - 1, top + 2, 1, len - 4);
    g.fillStyle(WHITE, 1);
    g.fillRect(cx, top + 3, 1, len - 6);
    g.fillStyle(hot ? 0xa0400a : 0x1a3c8a, 1);
    g.fillRect(cx + 1, top + 2, 1, len - 4);
    // sparkle caps: 4-point stars with an ink rim
    for (const sy of [top - 1, top + len]) {
      g.fillStyle(INK, 1);
      g.fillRect(cx - 4, sy - 1, 9, 3);
      g.fillRect(cx - 1, sy - 4, 3, 9);
      g.fillRect(cx - 2, sy - 2, 5, 5);
      g.fillStyle(0xb8c2d8, 1);
      g.fillRect(cx - 3, sy, 7, 1);
      g.fillRect(cx, sy - 3, 1, 7);
      g.fillRect(cx - 1, sy - 1, 3, 3);
      g.fillStyle(WHITE, 1);
      g.fillRect(cx - 2, sy, 4, 1);
      g.fillRect(cx, sy - 2, 1, 4);
    }

    // swipe hint: an arrow streak sweeping across above the bar while a finisher is banked
    if (c.finisherReady && this.app.settings.finisherInput === 'swipe') {
      const cyc = (now % 1100) / 1100;
      if (cyc < 0.65) {
        const k = ease(cyc / 0.65);
        const [col, hi] = stackCol(c.stacks);
        const hx = Math.round(B.x + 10 + (B.w - 40) * k);
        const hy = B.y - 13;
        const a = cyc < 0.1 ? cyc / 0.1 : cyc > 0.5 ? (0.65 - cyc) / 0.15 : 1;
        for (let i = 0; i < 26; i++) {
          g.fillStyle(i < 8 ? WHITE : i < 16 ? hi : col, a * (1 - i / 28));
          g.fillRect(hx - i, hy - (i < 4 ? 1 : 0), 1, i < 4 ? 3 : i < 14 ? 2 : 1);
        }
        g.fillStyle(INK, a);
        g.fillRect(hx + 1, hy - 3, 1, 7);
        g.fillStyle(WHITE, a);
        for (let j = 0; j < 4; j++) {
          g.fillRect(hx + 1 + j, hy - 3 + j, 2, 1);
          g.fillRect(hx + 1 + j, hy + 3 - j, 2, 1);
        }
      }
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
    // fresh blocks drop in from above and land with a little squash (scene time, so it plays before TAP TO BEGIN too)
    let seen = this.blockSeen.get(b.id);
    if (seen === undefined) this.blockSeen.set(b.id, (seen = this.anim));
    const age = (this.anim - seen) / 160;
    const fall = age < 0.7 ? Math.round(-14 * (1 - age / 0.7) ** 2) : 0;
    const squash = age >= 0.7 && age < 1 ? Math.round(2 * Math.sin(((age - 0.7) / 0.3) * Math.PI)) : 0;
    const X = x - squash;
    const Y = y + fall + squash;
    const W = w + squash * 2;
    const H = h - squash;
    this.brick(g, X, Y, W, H, impacting ? [WHITE, WHITE, light, base] : [light, base, dark, deepOf(b.kind)]);
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
    const cx = Math.round(X + W / 2 - 3.5);
    const cy = Math.round(Y + H / 2 - 3.5);
    if (isRed(b.kind)) {
      const variant = b.kind === 'red' ? null : ICONS[b.kind];
      const owner = c.enemyById(b.ownerId);
      const ownerIcon = group && owner ? ICONS[this.app.tuning.enemies[owner.key].icon] : null;
      if (variant) {
        this.icon(g, variant, cx, ownerIcon ? Y + 12 : cy, b.kind === 'speed' ? 0xffe680 : INK);
        if (ownerIcon) this.icon(g, ownerIcon, cx, Y + 3, WHITE);
      } else if (ownerIcon) this.icon(g, ownerIcon, cx, cy, WHITE);
    } else if (b.kind === 'purple' || b.kind === 'green') {
      // white symbol with a dark rim: "+" heals, "!" is a trap
      const mx = Math.round(X + W / 2);
      const my = Math.round(Y + H / 2);
      const parts: Array<[number, number, number, number]> =
        b.kind === 'green'
          ? [
              [mx - 1, my - 4, 2, 8],
              [mx - 4, my - 1, 8, 2],
            ]
          : [
              [mx - 1, my - 5, 2, 6],
              [mx - 1, my + 3, 2, 2],
            ];
      g.fillStyle(deepOf(b.kind), 1);
      for (const [x0, y0, w0, h0] of parts) g.fillRect(x0 - 1, y0 - 1, w0 + 2, h0 + 2);
      g.fillStyle(WHITE, 1);
      for (const [x0, y0, w0, h0] of parts) g.fillRect(x0, y0, w0, h0);
    }
  }

  /**
   * A glossy timing block like the reference's: ink outline with rounded corners, lit top rows and left edge,
   * darker bottom and right edge (a slightly cylindrical look), and specular dashes in two corners.
   */
  private brick(g: Phaser.GameObjects.Graphics, X: number, Y: number, W: number, H: number, ramp: readonly [number, number, number, number], alpha = 1): void {
    const [hi, base, lo, deep] = ramp;
    this.rows(g, X - 1, Y - 1, W + 2, H + 2, 3, INK, alpha);
    this.rows(g, X, Y, W, H, 2, base, alpha);
    // vertical light: two lit rows on top, two shaded + one deep row at the bottom
    for (let i = 0; i < H; i++) {
      const k = cornerInset(i, H, 2);
      const col = i < 2 ? hi : i >= H - 1 ? deep : i >= H - 3 ? lo : -1;
      if (col < 0) continue;
      g.fillStyle(col, alpha);
      g.fillRect(X + k, Y + i, W - k * 2, 1);
    }
    if (W >= 6) {
      // lit left edge, shaded right edge
      g.fillStyle(hi, alpha);
      g.fillRect(X + 1, Y + 2, 1, H - 5);
      g.fillStyle(lo, alpha);
      g.fillRect(X + W - 2, Y + 2, 2, H - 5);
      // specular dashes
      g.fillStyle(WHITE, alpha);
      g.fillRect(X + W - 5, Y + 1, 3, 1);
      g.fillRect(X + 2, Y + H - 3, 3, 1);
    }
  }

  /** A beveled brick with an ink outline, centered on cx. */
  private slab(g: Phaser.GameObjects.Graphics, cx: number, y: number, w: number, h: number, fill: number, hi: number, lo: number, alpha = 1): void {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    if (W < 4 || H < 6) {
      g.fillStyle(INK, alpha);
      g.fillRect(Math.round(cx - W / 2) - 1, Math.round(y) - 1, W + 2, H + 2);
      g.fillStyle(fill, alpha);
      g.fillRect(Math.round(cx - W / 2), Math.round(y), W, H);
      return;
    }
    this.brick(g, Math.round(cx - W / 2), Math.round(y), W, H, [hi, fill, lo, lo], alpha);
  }

  /** Pixel ellipse ring (an aura around a popping block). */
  private ellipse(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number, thick: number): void {
    g.fillStyle(color, alpha);
    const n = Math.max(24, Math.round(rx * 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.fillRect(Math.round(cx + Math.cos(a) * rx - thick / 2), Math.round(cy + Math.sin(a) * ry - thick / 2), thick, thick);
    }
  }

  private drawDying(g: Phaser.GameObjects.Graphics, bx: number): void {
    const B = this.bar;
    const H0 = B.h + 10;
    const mid = B.y + B.h / 2;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      const k = (this.anim - d.at) / DYING_MS[d.style];
      if (k >= 1) {
        this.dying.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const [base, light, dark] = d.reason === 'bomb' ? BOMB_COL : kindCol(d.kind);
      const x = d.x + bx;
      switch (d.style) {
        case 'pop': {
          // white swell, then the brick stretches into a tall pillar of light and pinches out
          const A = 0.14;
          this.ellipse(g, x, mid + 2, d.w / 2 + 4 + 16 * ease(k), 4 + 6 * ease(k), light, 1 - k, k < 0.5 ? 2 : 1);
          if (k < A) {
            const q = k / A;
            const s = 1 + 0.3 * q;
            this.slab(g, x, mid - (H0 * s) / 2, d.w * s, H0 * s, WHITE, WHITE, light);
          } else {
            const q = (k - A) / (1 - A);
            const w = d.w * 1.3 * (1 - q) ** 1.6;
            const h = H0 * (1.25 + 1.5 * ease(q));
            const bottom = mid + H0 * 0.65 * (1 - q * 0.6);
            const fill = q < 0.3 ? light : base;
            this.slab(g, x, bottom - h, w, h, fill, q < 0.3 ? WHITE : light, dark, 1 - q * 0.45);
            if (w > 3) {
              g.fillStyle(WHITE, 1 - q);
              g.fillRect(Math.round(x - w * 0.15), Math.round(bottom - h + 2), Math.max(1, Math.round(w * 0.3)), Math.round(h - 4));
            }
          }
          break;
        }
        case 'shatter': {
          // flash, then the brick splits in two halves that tumble apart and fall
          const A = 0.12;
          const flash = d.reason === 'bomb' ? 0xffe8b0 : 0xd8f8ff;
          if (k < A) {
            const s = 1 + 0.18 * (k / A);
            this.slab(g, x, mid - (H0 * s) / 2, d.w * s, H0 * s, flash, WHITE, light);
            break;
          }
          const q = (k - A) / (1 - A);
          const alpha = q < 0.55 ? 1 : 1 - (q - 0.55) / 0.45;
          const hw = d.w / 2;
          for (const side of [-1, 1]) {
            const cx = x + side * (hw / 2 + 2 + 16 * ease(q));
            const cy = mid + 26 * q * q - 6 * Math.sin(q * Math.PI);
            const rot = side * 1.1 * q;
            const quad = (pad: number) => {
              const pts: Phaser.Math.Vector2[] = [];
              for (const [ux, uy] of [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
              ]) {
                const px = ux * (hw / 2 + pad);
                const py = uy * (H0 / 2 + pad);
                pts.push(new Phaser.Math.Vector2(Math.round(cx + px * Math.cos(rot) - py * Math.sin(rot)), Math.round(cy + px * Math.sin(rot) + py * Math.cos(rot))));
              }
              return pts;
            };
            g.fillStyle(INK, alpha);
            g.fillPoints(quad(1), true);
            g.fillStyle(q < 0.15 ? flash : base, alpha);
            g.fillPoints(quad(0), true);
          }
          break;
        }
        case 'crunch': {
          // the attack slams into the left end: squashes flat against it with a red-white flash
          const left = x - d.w / 2;
          const w = 2 + (d.w - 2) * (1 - ease(k));
          const h = H0 * (1 + 0.4 * Math.sin(k * Math.PI));
          this.slab(g, left + w / 2, mid - h / 2, w, h, k < 0.35 ? WHITE : base, k < 0.35 ? WHITE : light, dark, 1 - k * 0.5);
          break;
        }
        case 'fade': {
          // shrinks and drops away, blinking
          if (k > 0.4 && Math.floor(this.anim / 45) % 2 === 0) break;
          const s = 1 - ease(k) * 0.85;
          this.slab(g, x, mid - (H0 * s) / 2 + 6 * k, d.w * s, H0 * s, dark, base, INK, 1 - k * 0.4);
          break;
        }
        case 'zip': {
          // closes like an eye: flattens to a bright line
          const h = H0 * (1 - ease(k));
          this.slab(g, x, mid - h / 2, d.w * (1 + 0.25 * k), Math.max(1, h), k < 0.4 ? WHITE : light, WHITE, base, 1 - k * 0.3);
          break;
        }
      }
    }
  }

  private setText(key: string, s: string, x: number, y: number, color = WHITE, scale = 1, ox = 0, oy = 0, visible = true): void {
    const t = this.txt[key];
    t.setText(fontText(s)).setPosition(Math.round(x), Math.round(y)).setScale(scale).setOrigin(ox, oy).setVisible(visible);
    tintGrad(t, color);
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
    this.setText('level', `${lvl.name}${stageInfo}`, GAME_W / 2, 17, 0xf2f4fa, 1, 0.5, 0, run.phase !== 'levelClear' && run.phase !== 'title');
    this.setText('heroHp', `${Math.ceil(H.hp)}/${maxHp}`, this.L + 52, 8.5, WHITE, 1, 0.5, 0.5);
    this.setText('coins', `${this.coinsShown}`, this.L + 103, 7, 0xffe680, 1, 0, 0.5);
    const crit = T.hero.critChance + H.bonusCrit + (H.abilityTimer > 0 ? T.hero.abilityCritBonus : 0);
    const stats = [
      `${Math.round(T.hero.atk * (1 + H.bonusDmg))}`,
      `${Math.round(crit * 100)}%`,
      `${T.hero.comboPower + H.bonusComboPower}`,
      `${H.revives}`,
    ];
    stats.forEach((v, i) => this.setText(`stat${i}`, v, this.L + 20, 24.5 + i * 15, i === 1 && H.abilityTimer > 0 ? 0x9af0a0 : WHITE, 1, 0, 0.5));
    this.setText('ability', 'Keen Edge', this.L + 20 + textWidth(stats[1], 1, true) + 4, 39.5, 0x9af0a0, 1, 0, 0.5, H.abilityTimer > 0);
    const target = c && run.phase !== 'levelClear' ? (c.currentTarget() ?? c.enemies[0]) : null;
    if (target && c) {
      const def = T.enemies[target.key];
      this.setText('enemyName', def.name, this.R - 52, 2, def.boss ? 0xffd23a : WHITE, 1, 0.5, 0);
      const tv = this.enemies.get(target.id);
      const hpNow = this.anim < this.superFinalAt && tv ? tv.hpShown : target.hp;
      this.setText('enemyHp', `${Math.ceil(hpNow)}/${target.maxHp}`, this.R - 52, 17.5, WHITE, 1, 0.5, 0.5);
      this.setText('enemyAtk', `${def.atk}`, this.R - 17, 31, WHITE, 1, 1, 0.5);
    } else ['enemyName', 'enemyHp', 'enemyAtk'].forEach((k) => this.txt[k].setVisible(false));

    const combo = c?.combo ?? 0;
    const broke = now < this.comboBreakUntil;
    const pk = (now - this.comboPopAt) / 140;
    const pop = pk < 1 && !broke ? 3 : 2;
    const comboCol = broke ? 0xff5a5a : combo >= 50 ? 0xff6a3a : combo >= 25 ? 0xffa03a : combo >= 10 ? 0xffd23a : WHITE;
    const my = this.meter.y + this.meter.h / 2;
    this.setText('combo', broke ? 'X' : `${combo}`, this.L + 4, this.B, comboCol, pop, 0, 1);
    this.txt.comboLabel.setVisible(false);
    const sp = c ? c.speedMult() : 1;
    this.setText('speed', `SPD x${sp.toFixed(2)}`, this.R - 2, my, sp > 1.01 ? 0xffd080 : 0xc8c8d4, 1, 1, 0.5);
    if (S.comboTiers && c) {
      const tm = combo >= T.tiers.t3 ? T.tiers.m3 : combo >= T.tiers.t2 ? T.tiers.m2 : combo >= T.tiers.t1 ? T.tiers.m1 : 1;
      this.setText('tier', `DMG x${tm}`, this.meter.x + this.meter.w, this.meter.y - 6, tm > 1 ? 0xffd23a : 0xc8c8d4, 1, 1, 0.5);
    } else this.txt.tier.setVisible(false);

    const ready = !!c?.finisherReady;
    const b = this.button;
    const fight = run.phase === 'fight';
    const swipeMode = S.finisherInput === 'swipe';
    const stacks = c?.stacks ?? 0;
    this.setText(
      'meterLabel',
      `${swipeMode ? 'SWIPE!' : 'FINISHER'} x${stacks}`,
      this.meter.x + this.meter.w / 2,
      this.meter.y + this.meter.h / 2,
      Math.floor(now / 150) % 2 ? WHITE : stackCol(stacks)[1],
      1,
      0.5,
      0.5,
      ready && fight,
    );
    const label = S.finisherInput === 'button' ? (ready ? (stacks > 1 ? `x${stacks}` : 'GO!') : 'Finish') : ready ? `x${stacks}` : 'Swipe';
    this.txt.button.setFont(ready ? FONT_BOLD : FONT);
    this.setText('button', label, b.x + b.w / 2, b.y + b.h / 2, ready ? WHITE : 0xd0d4e0, ready ? 2 : 1, 0.5, 0.5, fight && !swipeMode);

    const d = this.app.lastTap;
    this.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, GAME_W / 2, this.meter.y + 9, 0xc8c8d4, 1, 0.5, 0, this.app.panelOpen);

    if (run.phase === 'title')
      for (const k of ['heroHp', 'coins', 'stat0', 'stat1', 'stat2', 'stat3', 'ability', 'enemyName', 'enemyHp', 'enemyAtk', 'combo', 'speed', 'tier', 'meterLabel', 'button']) this.txt[k].setVisible(false);
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
    this.gCards.clear();
    this.boardImg?.setVisible(false);
    this.crestImg?.setVisible(false);
    const dim = (a: number) => {
      g.fillStyle(0x05040a, a);
      g.fillRect(0, 0, GAME_W, GAME_H);
    };
    const blink = Math.floor(now / 450) % 2 === 0;
    const cx = GAME_W / 2;
    if (!(ph === 'fight' && this.app.awaitingBegin && !this.app.userPaused)) this.txt.begin.setVisible(false);
    if (ph === 'fight' && now < this.bannerUntil) {
      const k = (this.bannerUntil - now) / 1800;
      this.setText('banner', this.banner, cx, 40, WHITE, 2, 0.5, 0.5, true);
      this.txt.banner.setAlpha(k < 0.15 ? k / 0.15 : 1);
    } else this.txt.banner.setVisible(false);
    if (ph === 'title') {
      dim(0.3);
      // logo: steel-gradient title with the crest, a tag line, how-to on a dark ribbon, blinking start prompt
      const title = 'Combo Quest';
      const tw = textWidth(title, 3, true);
      const crestW = 44;
      const lx = Math.round(cx - (tw + crestW - 6) / 2);
      const bob = Math.round(Math.sin(now / 500) * 1.5);
      this.setText('ovTitle', title, lx, 30 + bob, WHITE, 3, 0, 0.5);
      this.txt.ovTitle.setTint(0xffffff, 0xffffff, 0x9aa8c8, 0x9aa8c8);
      this.crestImg?.setVisible(true).setPosition(lx + tw - 6 + crestW / 2, 30 + bob);
      this.setText('ovSub', 'Working title - feel prototype', cx, 53, 0xffe680, 1, 0.5, 0.5);
      g.fillStyle(INK, 0.55);
      g.fillRect(0, 62, GAME_W, 22);
      g.fillStyle(INK, 0.3);
      g.fillRect(0, 61, GAME_W, 1);
      g.fillRect(0, 84, GAME_W, 1);
      this.setText('ovLine1', 'Tap when the line is on a block', cx, 68, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine2', 'Tap red to block - avoid purple', cx, 78, 0xff9a80, 1, 0.5, 0.5);
      this.setText('ovLine3', 'TAP TO START!', cx, 97, WHITE, 2, 0.5, 0.5, blink);
    } else if (ph === 'boost') {
      dim(0.35);
      hide('ovSub', 'ovLine1', 'ovLine2', 'ovLine3');
      const p = this.boostPanel();
      this.boardImg?.setVisible(true);
      const gc = this.gCards;
      // title plate
      gc.fillStyle(0x3e1e0a, 1);
      gc.fillRect(p.x + 4, p.y + 18, p.w - 8, 1);
      gc.fillStyle(0xc48a52, 1);
      gc.fillRect(p.x + 4, p.y + 19, p.w - 8, 1);
      this.setText('ovTitle', 'CHOOSE A BOOST', cx, p.y + 10, WHITE, 1, 0.5, 0.5);
      run.boostChoices.forEach((id, i) => {
        const r = this.cardRect(i);
        this.button3d(gc, r, [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26]);
        // icon well
        this.rows(gc, r.x + 4, r.y + 4, 20, r.h - 7, 2, 0x2a8a2e);
        gc.fillStyle(0x1e6a24, 1);
        gc.fillRect(r.x + 5, r.y + 4, 18, 1);
        const [iw, ih] = this.iconSize(BOOST_ICON[id]);
        this.hudIcon(gc, BOOST_ICON[id], r.x + 4 + ((20 - iw) >> 1), r.y + 4 + ((r.h - 7 - ih) >> 1));
        const [name, val] = boostLabel(this.app.tuning, id);
        const a = this.boostTexts[i * 2];
        const b = this.boostTexts[i * 2 + 1];
        a.setText(fontText(name)).setPosition(r.x + 29, r.y + 10).setTint(WHITE).setOrigin(0, 0.5).setScale(1).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + 29, r.y + 19).setTint(0xfff07a).setOrigin(0, 0.5).setScale(1).setVisible(true);
      });
    } else if (ph === 'levelClear') {
      const opened = !!this.chestOpenAt;
      this.setText('ovTitle', opened ? `${run.level.name} clear!` : 'Treasure Chest', cx, 28, opened ? 0xffd23a : WHITE, 2, 0.5, 0.5);
      this.setText('ovLine1', opened ? 'Tap to continue' : 'Tap the chest to continue', cx, 44, WHITE, 1, 0.5, 0.5, opened ? blink : true);
      hide('ovSub', 'ovLine2', 'ovLine3');
    } else if (ph === 'defeat') {
      dim(0.65);
      this.setText('ovTitle', 'DEFEATED', cx, 38, 0xff5a5a, 3, 0.5, 0.5);
      this.setText('ovSub', 'Rowan falls...', cx, 56, WHITE, 1, 0.5, 0.5);
      this.setText('ovLine1', 'Tap to retry level', cx, 76, 0xffd23a, 2, 0.5, 0.5, blink);
      hide('ovLine2', 'ovLine3');
    } else if (this.app.awaitingBegin) {
      hide(...ov);
      this.setText('begin', 'TAP TO BEGIN!', cx, 44, WHITE, 2, 0.5, 0.5, true);
    } else if (this.app.userPaused) {
      dim(0.55);
      this.setText('ovTitle', 'PAUSED', cx, 40, WHITE, 3, 0.5, 0.5);
      this.setText('ovSub', 'Tap to resume', cx, 60, 0xffd23a, 1, 0.5, 0.5, blink);
      hide('ovLine1', 'ovLine2', 'ovLine3');
    } else hide(...ov);
  }

  private updateFloatersAndCoins(now: number): void {
    this.drawCoins(this.gTop, now);
    this.updateFloaters(now);
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
      if (f.count) {
        f.count.at ??= now;
        const q = Math.min(1, (now - f.count.at) / f.count.dur);
        f.t.setText(fontText(`${Math.round(f.count.to * ease(q))}`));
        if (q >= 1) f.count = undefined;
      }
      const popS = f.pop && age < 90 ? f.scale + 1 : f.scale;
      f.t.setScale(popS);
      f.t.setPosition(Math.round(f.x + f.vx * s), Math.round(f.y + f.vy * s + 0.5 * f.g * s * s));
      f.t.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
    }
  }
}
