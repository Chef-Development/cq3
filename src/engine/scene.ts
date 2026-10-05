// Phaser scene (landscape 327x150): renders the core state and plays the juice. Reads input only through App.
// The work is split across src/engine/view/: stage (backdrop), fighters (hero, enemies, Pip, finisher show),
// effects (particles, text, camera), bar (timing bar), hud (stats, meter, rewards) and overlays (menus).
// This file owns the layout, the layers, the animation clock, and routes core events to those modules.
import Phaser from 'phaser';
import type { Combat, CombatEvent } from '../core/combat';
import { heroDef } from '../data/heroes';
import type { Phase } from '../core/run';
import type { App, View } from './app';
import { buildArt } from './art';
import { buildPanel } from './chrome';
import { buildFont, FONT, FONT_BOLD, FONT_BOLD_PLAIN, fontFor, fontText, isDarkInk, readable } from './font';
import { GAME_H, GAME_W } from './layout';
import { BarView } from './view/bar';
import { CampView } from './view/camp';
import { LootView } from './view/loot';
import { Effects } from './view/effects';
import { Fighters } from './view/fighters';
import { Hud } from './view/hud';
import { MapView } from './view/map';
import { NodeScreens } from './view/nodes';
import { Overlays } from './view/overlays';
import { StoryView } from './view/story';
import { WorldView } from './view/world';
import { buildWorldArt } from './art-world';
import { buildMapArt } from './art-map';
import { BAND_H, COL, DASH_MS, DEATH_CHARGE_MS, inRect, kindCol, stackCol, tintGrad, WHITE, type Pending, type Rect } from './view/shared';
import { Stage } from './view/stage';
import { TipsView } from './view/tips';
import { Transition } from './view/transition';

export class FightScene extends Phaser.Scene implements View {
  app!: App;
  // layout (game px)
  L = 0;
  R = GAME_W;
  B = GAME_H;
  splitY = 132;
  ground = 122;
  heroHome = 70;
  bar: Rect = { x: 0, y: 0, w: 0, h: 18 };
  button: Rect = { x: 0, y: 0, w: 0, h: 0 };
  meter: Rect = { x: 0, y: 0, w: 0, h: 6 };
  // layers: the world container (shaken as one) holds back, actors, front and fx; the rest are screen space
  world!: Phaser.GameObjects.Container;
  back!: Phaser.GameObjects.Container;
  actors!: Phaser.GameObjects.Container;
  fxLayer!: Phaser.GameObjects.Container;
  front!: Phaser.GameObjects.Container;
  gFx!: Phaser.GameObjects.Graphics;
  gTop!: Phaser.GameObjects.Graphics;
  txt: Record<string, Phaser.GameObjects.BitmapText> = {};
  private panelImg: Phaser.GameObjects.Image | null = null;
  /** Scene animation clock (ms); pauses during hit-freeze. */
  anim = 0;
  private lastNow = 0;
  private pending: Pending[] = [];
  private lastCombat: Combat | null = null;
  private pauseShown = true;
  // modules
  readonly fx = new Effects(this);
  readonly barView = new BarView(this);
  readonly stage = new Stage(this);
  readonly fighters = new Fighters(this);
  readonly hud = new Hud(this);
  readonly overlays = new Overlays(this);
  readonly mapView = new MapView(this);
  readonly story = new StoryView(this);
  readonly nodes = new NodeScreens(this);
  readonly worldMap = new WorldView(this);
  readonly camp = new CampView(this);
  readonly loot = new LootView(this);
  readonly transition = new Transition(this);
  readonly tips = new TipsView(this);

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
    this.hud.g = this.add.graphics().setDepth(10);
    this.barView.g = this.add.graphics().setDepth(11);
    this.gTop = this.add.graphics().setDepth(30);
    this.overlays.gCards = this.add.graphics().setDepth(31.5);
    const mk = (key: string, depth = 12, bold = false) => (this.txt[key] = this.add.bitmapText(0, 0, bold ? FONT_BOLD : FONT, '').setDepth(depth));
    ['level', 'ability', 'comboLabel', 'speed', 'tier', 'debug', 'enemyName'].forEach((k) => mk(k));
    ['heroHp', 'enemyHp', 'combo', 'button', 'meterLabel', 'coins'].forEach((k) => mk(k, 12, true));
    ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3', 'begin', 'banner', 'tCont', 'tContSub', 'tNew'].forEach((k) => mk(k, 32, true));
    this.overlays.createTexts();
    this.lastNow = performance.now();
    this.onLayout();
    this.hud.heroHpShown = this.app.run.hero.hp;
    this.app.sceneReady = true;
    // a returning player's first launch of this version: Pip's welcome back, over the title
    this.app.welcome();
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
    const meterX = this.L + 17;
    this.meter = { x: meterX, y: this.splitY + BAND_H + 3, w: this.R - 70 - meterX, h: 8 };

    // Tear down everything built for the previous layout before regenerating textures.
    this.fx.destroyText();
    this.fx.clear();
    this.pending = [];
    this.barView.beams = [];
    this.barView.dying = [];
    this.back.removeAll(true);
    this.actors.removeAll(true);
    this.fxLayer.removeAll(true);
    this.front.removeAll(true);
    this.stage.clearAmbient();
    this.panelImg?.destroy();
    buildArt(this, GAME_W);
    buildWorldArt((key, canvas) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }, GAME_W, GAME_H);
    buildMapArt((key, canvas) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      this.textures.addCanvas(key, canvas);
    }, GAME_W, GAME_H);
    this.stage.buildTextures();
    buildPanel(this, GAME_W, GAME_H - this.splitY, BAND_H);
    this.panelImg = this.add.image(0, this.splitY, 'panel').setOrigin(0, 0).setDepth(9);
    this.barView.build();
    this.overlays.build();
    this.mapView.build();
    this.story.build();
    this.nodes.build();
    this.worldMap.build();
    this.camp.build();
    this.loot.build();
    this.tips.build();
    this.stage.build();
    this.fighters.build();
    this.hud.reset();
    this.hud.resetCoins();
    this.fx.build();
    this.gFx = this.add.graphics();
    this.fxLayer.add(this.gFx);
    this.fighters.reset();
    this.lastCombat = null;
    this.stage.applyTheme();
  }

  // ------------------------------------------------------------------ input helpers (game px)

  finisherButtonHit(x: number, y: number): boolean {
    return this.app.settings.finisherInput === 'button' && this.app.run.phase === 'fight' && inRect(this.button, x, y, 4);
  }

  enemyAt(x: number, y: number): number | null {
    return this.fighters.enemyAt(x, y);
  }

  /** Level clear: the first tap bursts the chest open (returns true = consumed); the next one moves on. */
  levelClearTap(): boolean {
    return this.overlays.levelClearTap();
  }

  boostCardAt(x: number, y: number): number {
    return this.overlays.boostCardAt(x, y);
  }

  titleTap(x: number, y: number): 'continue' | 'new' | null {
    return this.overlays.titleTap(x, y);
  }

  storySkipAt(x: number, y: number): boolean {
    return this.story.storySkipAt(x, y);
  }

  /** A tap while a story box is still typing shows the whole box (true = the tap is used up). */
  storyReveal(): boolean {
    return this.story.reveal();
  }

  mapNodeAt(x: number, y: number): number | null {
    return this.mapView.nodeAt(x, y);
  }

  chooseNode(id: number): void {
    this.mapView.choose(id);
  }

  rerollAt(x: number, y: number): boolean {
    return this.overlays.rerollAt(x, y);
  }

  onReroll(): void {
    this.app.audio.shopBuy();
    this.app.phaseSince = performance.now() - 250; // the cards pop in again
  }

  worldTap(x: number, y: number): void {
    this.worldMap.tap(x, y);
  }

  /** The camp and its buildings (bag, forge, shrine, stats). */
  campTap(x: number, y: number): void {
    this.camp.tap(x, y);
  }

  /** The loot screen after a fight or a chest. */
  lootTap(x: number, y: number): void {
    this.loot.tap(x, y);
  }

  /** Treasure, rest, shop and event screens. */
  nodeTap(x: number, y: number): void {
    if (this.app.run.phase === 'treasure') this.overlays.treasureTap();
    else this.nodes.tap(x, y);
  }

  /** The fight HUD and the bar show in fights, and over the loot, the boost pick and the defeat screen. */
  fightHud(): boolean {
    const ph = this.app.run.phase;
    return ph === 'fight' || ph === 'loot' || ph === 'boost' || ph === 'defeat';
  }

  // ------------------------------------------------------------------ helpers for the modules

  /** Run fn after `ms` of scene time (so hit-stop delays it too). */
  later(ms: number, fn: () => void): void {
    if (ms <= 0) fn();
    else this.pending.push({ at: this.anim + ms, fn });
  }

  setText(key: string, s: string, x: number, y: number, color = WHITE, scale = 1, ox = 0, oy = 0, visible = true): void {
    const t = this.txt[key];
    const bold = t.font === FONT_BOLD || t.font === FONT_BOLD_PLAIN;
    const plain = isDarkInk(color);
    t.setFont(fontFor(bold, plain));
    t.setText(fontText(s)).setPosition(Math.round(x), Math.round(y)).setScale(scale).setOrigin(ox, oy).setVisible(visible);
    tintGrad(t, plain ? color : readable(color), !bold);
  }

  // ------------------------------------------------------------------ events

  onPhase(_prev: Phase, next: Phase): void {
    if (next === 'fight') this.syncCombat(true);
    if (next === 'actClear' || next === 'map' || next === 'scene') this.stage.applyTheme();
    if (next === 'victory') this.app.audio.victory();
    // the loot bursts out over the stage it was won on (no wipe in or out: the boost pick pops in over it too)
    if (next !== 'loot' && _prev !== 'loot') this.transition.onPhase(_prev, next);
    this.overlays.onPhase(next);
    this.nodes.onPhase(next);
    this.camp.onPhase(next);
    this.loot.onPhase(next, _prev);
    if (next !== 'fight' && this.fighters.h.state !== 'idle') this.fighters.heroReturn();
  }

  onEvents(events: CombatEvent[]): number {
    const now = performance.now();
    const c = this.app.run.combat;
    if (!c) return 0;
    const J = this.app.tuning.juice;
    const { fx, barView: bar, fighters: f, hud } = this;
    const barMid = this.bar.y + this.bar.h / 2;
    let hold = 0;
    // gear effects say where they happened through the events just before them (a miss, a bomb), and a Riposte's
    // blow is shown by its spark flying back (not as a bomb's hit)
    let missX: number | undefined;
    let bombX: number | undefined;
    let riposte = -1;
    // a perk's blow is shown by its bolt (not again as its enemyHurt); a perk right after the meter's events banked stacks
    let perkStruck = -1;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const before = events[i - 1];
      const after = events[i + 1];
      switch (e.type) {
        case 'hit': {
          const x = bar.x(e.pos);
          const perfect = e.perfect;
          if (perfect || e.crit) fx.judge(x, perfect ? 'Perfect!' : 'Crit!', perfect ? 0xfff07a : 0xff9a3a, true);
          bar.cursorPulse(perfect ? 0xfff07a : kindCol(e.kind)[1], e.hand);
          bar.cursorHit(x, perfect ? 0x6aff5a : WHITE);
          if (perfect) fx.sparkle(x, barMid);
          hud.comboPopAt = now;
          hud.milestone(e.combo);
          f.heroAttack(e.enemyId, e.damage, e.crit, perfect, e.combo, false, e.hand, e.echo);
          break;
        }
        case 'block': {
          const x = bar.x(e.pos);
          if (e.perfect) fx.judge(x, 'Perfect!', 0xfff07a, true, e.cracked ? 6 : 0);
          if (!e.cracked) fx.replaceFloater('block', () => fx.addFloater(f.h.x - 4, this.ground - 44, 'Block!', WHITE, 1, true, 0, -18, 0, 520, true));
          bar.cursorPulse(0x7ae0ff, e.hand);
          bar.cursorHit(x, e.perfect ? 0x6aff5a : 0x7ae0ff);
          hud.comboPopAt = now;
          hud.milestone(e.combo);
          f.heroParry(e.ownerId, e.cracked, e.perfect);
          if (e.cracked) {
            // knocked back: a clang, sparks flying right, the bar jolts
            fx.burst(x, barMid, 0xc8d0e0, 6, false);
            fx.chips(x + 6, barMid, 4, [WHITE, 0xffe680, 0xc8d0e0], 10, 1);
            fx.sparks.push({ x, y: barMid, at: this.anim, size: 9, color: 0x9ad8ff });
            fx.judge(x, 'Clang!', 0x9ad8ff, true, -6);
            bar.shakeUntil = now + 90;
          }
          break;
        }
        case 'trap':
          fx.judge(bar.x(e.pos), 'Trap!', COL.purple[1], true);
          f.enemyLunge(e.enemyId, 1);
          fx.screenFlash(COL.purple[0], now, 160);
          break;
        case 'miss':
          missX = bar.x(e.pos);
          fx.judge(bar.x(e.pos), 'Miss', 0x9a94b0, false);
          bar.shakeUntil = now + 140;
          if (f.h.state === 'idle') f.setHeroPose('windup', 120);
          break;
        case 'remove':
          bar.blockDies(e.kind, e.pos, e.width, e.reason);
          break;
        case 'windup': {
          const v = f.enemies.get(e.enemyId);
          if (v) f.setEnemyPose(v, 'windup', 170);
          break;
        }
        case 'heroHurt': {
          if (e.source === 'perk') {
            // a relic's cost in HP (Glass Edge, Blood Price...): its name and the HP, in violet
            f.perkHurt(e.perk ?? '', e.damage);
            this.app.audio.hurt();
            break;
          }
          if (e.source === 'red' || e.source === 'bomb') f.enemyLunge(e.enemyId, 0.8);
          const delay = e.source === 'red' || e.source === 'bomb' ? 70 : 0;
          this.later(delay, () => {
            if (e.source !== 'miss') this.app.audio.hurt(); // lands with the enemy's blow
            const h = f.h;
            h.hurtUntil = this.anim + 220;
            h.flashUntil = this.anim + J.flashMs * 1.5;
            h.flashColor = 0xff3030;
            if (e.damage > 0 || this.app.settings.godMode) fx.floatNum(h.x, this.ground - 40, `${e.damage}`, 0xff4a4a, 1);
            fx.burst(h.x + 4, this.ground - 16, 0xff5a5a, e.source === 'miss' ? 3 : 10, true);
            fx.shake(e.source === 'miss' ? J.shakeMinPx : J.shakeMaxPx, J.shakeMs);
          });
          if (f.h.state === 'engaged') f.heroReturn();
          break;
        }
        case 'enemyHurt': {
          if (e.source === 'perk') {
            // a perk's blow: its bolt shows it (perkFx), unless it came without one
            if (e.enemyId === perkStruck) perkStruck = -1;
            else f.enemyHurtFx(e.enemyId, e.damage, e.crit, false, fx.feel(fx.weight('hit') * 0.7));
            break;
          }
          if (e.source !== 'bomb') break; // hits and finishers show damage when the blow lands
          if (e.enemyId === riposte) {
            riposte = -1;
            break;
          }
          f.enemyHurtFx(e.enemyId, e.damage, e.crit, false, fx.feel(fx.weight('bomb')));
          break;
        }
        case 'gearFx':
          f.gearFx(e.fx, e.amount, e.enemyId, { missX, bombX });
          if (e.fx === 'riposte') riposte = e.enemyId;
          break;
        case 'perk':
          // a relic, skill node or kit part kicked in
          // (a blow when its enemyHurt follows; stacks when the meter's events came first; coins when they did)
          if (
            f.perkFx(e.id, e.amount, e.enemyId, {
              strike: after?.type === 'enemyHurt' && after.source === 'perk' && after.enemyId === e.enemyId,
              stacks: before?.type === 'meterFull',
              coins: before?.type === 'coins' && before.id === e.id,
              pos: e.pos,
            })
          )
            perkStruck = e.enemyId;
          break;
        case 'coins':
          // coins a perk found: they pop off the foe into the coin chip
          f.perkCoins(e.id, e.amount);
          break;
        case 'morph':
          // a block changed kind (Chain Reaction): it flashes as it turns
          bar.morph(e.id);
          break;
        case 'kill': {
          const id = e.enemyId;
          const def = this.app.tuning.enemies[c.enemyById(id)?.key ?? ''];
          const coins = e.coins;
          const isBoss = !!def?.boss;
          hud.coinsPending += coins;
          // a finisher kill waits for the last blow; a normal kill for the hero's dash to land
          const delay = Math.max(f.h.state === 'dash' ? DASH_MS : 0, f.superFinalAt > this.anim ? f.superFinalAt - this.anim + 20 : 0);
          // hold the boost choice until the burst and the coins have played out
          hold = Math.max(hold, delay * 1.3 + (isBoss ? 2300 : 1900));
          f.burstAt.set(id, this.anim + delay + DEATH_CHARGE_MS);
          f.lastBurstAt = this.anim + delay + DEATH_CHARGE_MS;
          this.later(delay, () => f.enemyDeath(id, coins, isBoss));
          break;
        }
        case 'statGain':
          // a kill's small permanent gains are silent: the HP readout just ticks up with them
          break;
        case 'explode':
          bombX = bar.x(e.pos);
          bar.explodeFx = { x: bar.x(e.pos), r: e.radius * this.bar.w, until: now + 260 };
          this.app.audio.explode();
          fx.impact(fx.weight('bomb'));
          fx.floatNum(GAME_W / 2, 44, 'BOOM!', 0xff8a3a, 2);
          break;
        case 'finisher':
          f.heroFinisher(e.damage, e.stacks, e.targets);
          hold = Math.max(hold, f.superMs);
          break;
        case 'pet':
          f.petAttack(e.enemyId, e.damage, e.crit);
          break;
        case 'heal': {
          // healing comes from the kill: it lands just after the burst
          const amount = e.amount;
          this.later(Math.max(0, f.lastBurstAt - this.anim + 180), () => {
            fx.iconFloat(f.h.x + 2, this.ground - 46, `+${amount}`, 0xff7aa8, 'heart');
            fx.burst(f.h.x, this.ground - 16, 0xff7aa8, 12, true, 0.8);
            hud.hpPulseAt = performance.now();
            this.app.audio.heal();
          });
          break;
        }
        case 'ability':
          // (named the first time each fight; then the plate's green timer shows it)
          if (f.firstName('ability')) fx.floatNum(f.h.x, this.ground - 46, heroDef(this.app.run.hero.build?.id ?? 'rowan').ability.name, 0x9af0a0, 1);
          break;
        case 'speedUp':
          fx.judge(this.bar.x + this.bar.w / 2, 'Speed up!', 0xff9a3a, true, -14);
          break;
        case 'comboBreak':
          hud.comboBreakUntil = now + 420;
          hud.lastMilestone = 0;
          if (e.lostStacks > 0) {
            // the banked stacks shatter out of the meter
            hud.stackLostAt = now;
            const m = this.meter;
            fx.chips(m.x + m.w / 2, m.y + m.h / 2, m.w, [stackCol(e.lostStacks)[0], stackCol(e.lostStacks)[1], WHITE], 18, 0);
            fx.addFloater(m.x + m.w / 2, m.y - 10, `x${e.lostStacks} lost!`, 0xff5a5a, 1, true, 0, -20, 0, 800, false);
          }
          break;
        case 'meterFull': {
          const [col] = stackCol(e.stacks);
          hud.stackPopAt = now;
          const m = this.meter;
          const bt = this.button;
          fx.addFloater(bt.x + bt.w / 2 - 6, this.splitY - 8, e.stacks >= c.maxStacks() ? `x${e.stacks} MAX!` : `x${e.stacks}!`, stackCol(e.stacks)[1], 2, true, 0, -22, 0, 750, false);
          fx.chips(m.x + m.w / 2, m.y, m.w * 0.8, [WHITE, stackCol(e.stacks)[1], col], 12, -1);
          break;
        }
        case 'revive':
          fx.screenFlash(0x9af0a0, now, 320);
          fx.floatNum(this.heroHome + 10, this.ground - 50, 'Revived!', 0x9af0a0, 2);
          break;
        case 'telegraph':
          f.telegraph(e.enemyId, e.name, e.sec);
          break;
        case 'tellCancel':
          f.tellOver(e.enemyId);
          break;
        case 'special':
          f.special(e.enemyId);
          break;
        case 'counter': {
          // a yellow tapped while the shield was up: the knight bashes Rowan
          const x = bar.x(e.pos);
          fx.judge(x, 'Countered!', 0xc8a0ff, true);
          fx.screenFlash(COL.purple[0], now, 160);
          f.enemyLunge(e.enemyId, 0.9);
          this.app.audio.counter();
          bar.shakeUntil = now + 160;
          break;
        }
        case 'wardBreak': {
          const x = bar.x(e.pos);
          fx.judge(x, e.left ? 'Crack!' : 'Shell broken!', 0x7af0e0, true, e.perfect ? -6 : 0);
          bar.cursorPulse(0x7af0e0);
          bar.cursorHit(x, 0x7af0e0);
          hud.comboPopAt = now;
          hud.milestone(e.combo);
          f.heroAttack(e.enemyId, 0, false, e.perfect, e.combo, true);
          this.app.audio.wardBreak(e.left === 0);
          break;
        }
        case 'shellOn': {
          const v = f.enemies.get(e.enemyId);
          if (v) fx.ring(v.x, v.y - v.img.displayHeight / 2, 20, 0x7af0e0, true);
          break;
        }
        case 'shellOff': {
          const v = f.enemies.get(e.enemyId);
          if (v) fx.chips(v.x, v.y - v.img.displayHeight / 2, 16, [0x7af0e0, 0xa8f0e0, WHITE], 12, 0);
          break;
        }
        case 'guardOn': {
          const v = f.enemies.get(e.enemyId);
          if (v) fx.addFloater(v.x, Math.max(30, v.y - v.img.displayHeight - 10), "Don't hit yellow!", 0xc8a0ff, 1, true, 0, -6, 0, e.sec * 1000, true);
          break;
        }
        case 'enemyHeal': {
          const v = f.enemies.get(e.enemyId);
          if (v) {
            fx.floatNum(v.x, v.y - v.img.displayHeight - 6, `+${e.amount}`, 0x9af06a, 1);
            fx.burst(v.x, v.y - v.img.displayHeight / 2, 0x9af06a, 8, true, 0.8);
          }
          break;
        }
        case 'sporeHeal':
          fx.judge(bar.x(e.pos), 'Spores heal!', 0xff9ae0, true);
          this.app.audio.sporeHeal();
          break;
        case 'summon':
          this.app.audio.summonArrive();
          this.later(0, () => this.fighters.addEnemies(c));
          break;
        case 'wave':
          // the next foes of the fight walk in
          this.app.audio.summonArrive();
          this.fighters.addEnemies(c, true);
          break;
        case 'split':
          f.splitApart(e.enemyId, e.ids);
          this.fighters.addEnemies(c);
          break;
        case 'flee':
          f.flee(e.enemyId);
          break;
        case 'freeze': {
          // the stomp lands: the ground shakes and the cursor freezes
          this.app.audio.stompLand();
          fx.shake(J.shakeMaxPx + 2, 300);
          fx.judge(bar.x(c.cursorPosAt(c.time)), 'Frozen!', 0xbfe8ff, true, -10);
          fx.burst(GAME_W / 2 + 44, this.ground - 2, 0xc8b090, 16, true, 1.2);
          break;
        }
        case 'cursorFloor':
          fx.floatNum(this.bar.x + this.bar.w / 2, this.splitY - 10, 'Enraged: faster!', 0xff5a3a, 1);
          break;
        case 'phase': {
          const v = f.enemies.get(e.enemyId);
          if (v) {
            fx.screenFlash(e.phase >= 3 ? 0xff5a3a : 0xffe0a0, now, 260);
            fx.ring(v.x, v.y - v.img.displayHeight / 2, 40, e.phase >= 3 ? 0xff5a3a : 0xffd23a, true);
            fx.shake(J.shakeMaxPx, 260);
          }
          break;
        }
        case 'cursorReset':
          // the finisher is done: the cursor snaps back to the start of the bar
          bar.cursorPulse(0x9ad8ff);
          fx.ring(bar.x(0), barMid, 14, 0x9ad8ff, false);
          this.app.audio.swish();
          break;
        case 'defeat':
          hold = Math.max(hold, 900);
          this.later(260, () => f.heroDown());
          break;
      }
    }
    return hold;
  }

  /** A new combat replaces the fighters, the theme and the bar's memory; then any missing enemy views are added. */
  private syncCombat(force = false): void {
    const c = this.app.run.combat;
    if (!c) return;
    if (c === this.lastCombat && !force) return;
    if (c !== this.lastCombat) {
      this.fighters.newFight();
      this.barView.newFight();
      this.stage.applyTheme();
      const run = this.app.run;
      const type = run.node?.type;
      if (type === 'elite') this.overlays.showBanner('ELITE!');
      else if (type === 'boss') this.overlays.showBanner(this.app.tuning.enemies[c.enemies[0].key]?.name.toUpperCase() ?? 'BOSS');
    }
    this.lastCombat = c;
    this.fighters.addEnemies(c);
    this.hud.heroHpShown = this.app.run.hero.hp;
  }

  // ------------------------------------------------------------------ frame

  update(): void {
    const now = performance.now();
    const dt = Math.min(100, now - this.lastNow);
    this.lastNow = now;
    if (now >= this.fx.freezeUntil) this.anim += dt;
    this.app.update(now);
    this.syncCombat();
    for (let i = 0; i < this.pending.length; i++) {
      const p = this.pending[i];
      if (this.anim >= p.at) {
        this.pending.splice(i--, 1);
        p.fn();
      }
    }
    // the pause button only makes sense in a fight
    const pause = this.app.run.phase === 'fight';
    if (pause !== this.pauseShown) {
      this.pauseShown = pause;
      const b = document.getElementById('btn-pause');
      if (b) b.style.visibility = pause ? 'visible' : 'hidden';
    }
    const t = this.app.renderTime(now);
    this.drawWorld(now);
    this.hud.drawPanel(now);
    this.barView.draw(t, now);
    this.hud.drawTexts(now);
    this.overlays.draw(now);
    this.worldMap.draw(now);
    this.mapView.draw(now);
    this.nodes.draw(now);
    this.loot.draw(now);
    this.camp.draw(now);
    this.story.draw(now);
    this.hud.drawCoins(this.gTop, now);
    this.fx.updateFloaters(now);
    this.transition.draw(now);
    this.tips.draw(now);
  }

  private drawWorld(now: number): void {
    const g = this.gFx;
    g.clear();
    this.fighters.clearShadows();
    this.fx.applyCamera(now);
    this.stage.driftClouds(now);
    this.fighters.updateHero();
    this.fighters.updatePip();
    this.stage.drawAmbient();
    this.fighters.drawSuper(now);
    this.overlays.updateChest(now);
    this.fighters.drawActors(g, now);
    this.fx.drawWorld(g, now);
  }
}
