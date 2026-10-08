// The Test lab's Finisher gallery (playtest round 7): every hero's finisher on demand. The lab drops the playtester
// into a practice fight against a few foes (core/lab.ts galleryFight: nothing comes onto the bar, nothing hurts,
// nothing dies, nothing is saved) whose clock waits between shows (App.galleryHold). Big, simple controls sit on a
// plate over the bar's band: the hero (every hero in HEROES, by arrows), the stacks (1 to max) and the rarity the show
// is drawn at (the hero's own to start; any tier, to see the rarity scaler), Play and Back. Play puts two reds and a
// yellow on the bar (to see what the finisher does to them), then fires the real finisher; the plate slides away
// while the show plays and comes back after it. Switching heroes starts a fresh fight as that hero (the foes walk in
// again; a Play pressed meanwhile waits for them). Back ends the scenario (the lab's rating card).
import type Phaser from 'phaser';
import { finisherShowMs } from '../../core/impact';
import { galleryArm, galleryFight, galleryHeroes, galleryRest } from '../../core/lab';
import { heroDef, type HeroId } from '../../data/heroes';
import type { LabScenario } from '../../data/lab';
import { TIER_INFO, TIERS, type Tier } from '../../data/rarity';
import { STYLES } from '../../data/styles';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { button3d } from './pixels';
import { clamp01, ease, WHITE, type Rect } from './shared';
import { glass, pageArrow } from './ui-modern';
import { FACE, isPressed, notePress, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
/** The tiers the rarity picker steps through (heroes are Rare and up). */
const GALLERY_TIERS: Tier[] = TIERS.filter((t) => TIERS.indexOf(t) >= TIERS.indexOf('rare'));
/** The plate slides away over this long when a show starts, and back in after it. */
const SLIDE_MS = 150;
/** After a show, the bar's part of the finisher plays out this long before the clock is held again. */
const TAIL_MS = 900;
/** The reds and the yellow drop onto the bar for this long before the finisher fires. */
const ARM_MS = 320;

export type GalleryButton = 'heroL' | 'heroR' | 'stackL' | 'stackR' | 'tierL' | 'tierR' | 'play' | 'back';

export class FinisherGallery {
  /** The gallery is up (its controls take every tap in the fight). */
  active = false;
  hero: HeroId = galleryHeroes()[0];
  stacks = 3;
  tier: Tier = 'rare';
  /** 'idle': the controls are up; 'arming': the blocks drop in, then it fires; 'playing': the show runs. */
  state: 'idle' | 'arming' | 'playing' = 'idle';
  /** Shows played since it opened (the tests). */
  played = 0;
  private scenario: LabScenario | null = null;
  private onBack: (() => void) | null = null;
  private at = 0;
  private showMs = 0;
  /** Play was pressed while the foes were still walking in: it fires once they're in. */
  private queued = false;
  private g: G | null = null;
  private texts: TextPool | null = null;
  private drawn = false;
  private rects: Partial<Record<GalleryButton, Rect>> = {};

  constructor(private readonly s: FightScene) {}

  /** A new layout: its own graphics and texts, over the bar and the HUD. */
  build(): void {
    this.g = this.s.add.graphics().setDepth(33);
    this.texts = new TextPool(this.s, 34);
    this.drawn = false;
  }

  /** Open it over the gallery scenario's fight (the lab has just started it); `onBack` ends the scenario. */
  open(s: LabScenario, onBack: () => void): void {
    if (s.setup.kind !== 'gallery') return;
    const app = this.s.app;
    this.scenario = s;
    this.onBack = onBack;
    this.active = true;
    this.played = 0;
    this.queued = false;
    this.hero = app.run.hero.build?.id ?? s.setup.hero ?? galleryHeroes()[0];
    this.tier = heroDef(this.hero).rarity;
    this.stacks = Math.min(3, this.maxStacks());
    this.setState('idle', performance.now());
    app.galleryHold = true;
    app.begin();
  }

  /** Close it (the scenario ends): the fight's clock is no longer held, the show's rarity is the hero's own again. */
  close(): void {
    if (!this.active) return;
    this.active = false;
    this.scenario = null;
    this.onBack = null;
    this.s.app.galleryHold = false;
    this.s.fighters.showTier = null;
  }

  private maxStacks(): number {
    return Math.max(1, this.s.app.run.combat?.maxStacks() ?? 5);
  }

  private setState(st: FinisherGallery['state'], now: number): void {
    this.state = st;
    this.at = now;
  }

  /** The foes are all in place (not walking in). */
  private foesIn(): boolean {
    const views = [...this.s.fighters.enemies.values()];
    return views.length > 0 && views.every((v) => !v.enterAt);
  }

  /** The buttons as drawn (game px): the tests press them. */
  buttons(): Partial<Record<GalleryButton, Rect>> {
    return { ...this.rects };
  }

  /** A tap (game px; x < 0: the keyboard's Space, which plays). Only while the controls are up. */
  tap(x: number, y: number, now: number): void {
    if (!this.active || this.state !== 'idle' || this.queued) return;
    if (x < 0) return this.press('play', now);
    for (const [k, r] of Object.entries(this.rects) as Array<[GalleryButton, Rect]>) if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) return this.press(k, now);
  }

  /** Press a button (by name). */
  press(b: GalleryButton, now = performance.now()): void {
    if (!this.active || this.state !== 'idle') return;
    const app = this.s.app;
    const r = this.rects[b];
    if (r) notePress(r);
    app.audio.uiClick();
    const heroes = galleryHeroes();
    switch (b) {
      case 'heroL':
      case 'heroR': {
        const i = heroes.indexOf(this.hero);
        this.hero = heroes[(i + (b === 'heroR' ? 1 : -1) + heroes.length) % heroes.length];
        this.tier = heroDef(this.hero).rarity;
        this.switchHero();
        break;
      }
      case 'stackL':
      case 'stackR':
        this.stacks = Math.max(1, Math.min(this.maxStacks(), this.stacks + (b === 'stackR' ? 1 : -1)));
        break;
      case 'tierL':
      case 'tierR': {
        const i = GALLERY_TIERS.indexOf(this.tier);
        this.tier = GALLERY_TIERS[(i + (b === 'tierR' ? 1 : -1) + GALLERY_TIERS.length) % GALLERY_TIERS.length];
        break;
      }
      case 'play':
        if (this.foesIn()) this.arm(now);
        else this.queued = true;
        break;
      case 'back':
        this.onBack?.();
        break;
    }
  }

  /** A fresh fight as the picked hero (their own finisher), the clock held again. */
  private switchHero(): void {
    const app = this.s.app;
    const sc = this.scenario;
    if (!sc) return;
    app.setPhase(() => galleryFight(app.run, sc, this.hero, (Date.now() & 0xffffff) | 1));
    app.galleryHold = true;
    app.begin();
  }

  /** The bar set up for the show (two reds and a yellow drop in), the foes healed with plenty to spare. */
  private arm(now: number): void {
    const app = this.s.app;
    const c = app.run.combat;
    this.queued = false;
    if (!c || !galleryArm(c, this.stacks)) return;
    app.flush();
    this.s.fighters.showTier = this.tier === heroDef(this.hero).rarity ? null : this.tier;
    this.setState('arming', now);
  }

  /** Every frame: the state machine (fire, hold again) and the plate. */
  draw(now: number): void {
    const g = this.g;
    const texts = this.texts;
    if (!g || !texts) return;
    if (this.active && this.s.app.run.phase !== 'fight') this.close();
    if (!this.active) {
      if (this.drawn) {
        g.clear();
        texts.hide();
        this.drawn = false;
        this.rects = {};
      }
      return;
    }
    const app = this.s.app;
    if (this.queued && this.foesIn()) this.arm(now);
    if (this.state === 'arming' && now - this.at >= ARM_MS) {
      // fire: the clock runs for the show
      app.galleryHold = false;
      app.syncClock(now);
      const n = app.run.combat?.stacks ?? this.stacks;
      if (app.finisher()) {
        this.played++;
        this.showMs = finisherShowMs(n);
        this.setState('playing', now);
      } else {
        app.galleryHold = true;
        app.syncClock(now);
        this.setState('idle', now);
      }
    } else if (this.state === 'playing' && now - this.at >= this.showMs + TAIL_MS) {
      app.galleryHold = true;
      app.syncClock(now);
      const c = app.run.combat;
      if (c) galleryRest(c);
      this.setState('idle', now);
    }
    this.drawPlate(g, texts, now);
    this.drawn = true;
  }

  private drawPlate(g: G, texts: TextPool, now: number): void {
    const s = this.s;
    g.clear();
    texts.begin();
    const k = clamp01((now - this.at) / SLIDE_MS);
    const away = this.state === 'idle' ? 1 - ease(k) : ease(k);
    const top = s.splitY + 2;
    const off = Math.round(away * (s.B - top + 6));
    const plate: Rect = { x: s.L + 3, y: top + off, w: s.R - s.L - 6, h: s.B - top - 2 };
    this.rects = {};
    if (plate.y >= s.B) return texts.end();
    glass(g, plate, { clear: 0.06, rim: 0x8a7cc0 });
    const live = away < 0.05 && !this.queued;
    const def = heroDef(this.hero);
    // row 1: the hero, the stacks, the rarity
    const r1 = plate.y + 3;
    const x0 = plate.x + 4;
    const room = plate.w - 8;
    const nameW = Math.max(56, Math.min(92, room - 196));
    const arrowW = 16;
    const heroL: Rect = { x: x0, y: r1, w: arrowW, h: 16 };
    const heroR: Rect = { x: x0 + arrowW + 2 + nameW + 2, y: r1, w: arrowW, h: 16 };
    pageArrow(g, heroL, -1, now);
    pageArrow(g, heroR, 1, now);
    const tierCol = TIER_INFO[def.rarity].face[0];
    texts.text(def.name, heroL.x + arrowW + 2 + nameW / 2, r1 + 8, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    g.fillStyle(tierCol, 1);
    g.fillRect(Math.round(heroL.x + arrowW + 2 + nameW / 2 - textWidth(def.name, 1, true) / 2), r1 + 13, Math.round(textWidth(def.name, 1, true)), 1);
    const sx = heroR.x + arrowW + 8;
    const stackL: Rect = { x: sx, y: r1, w: 16, h: 16 };
    const stackR: Rect = { x: sx + 16 + 24, y: r1, w: 16, h: 16 };
    this.smallButton(g, texts, stackL, '-', now);
    this.smallButton(g, texts, stackR, '+', now);
    texts.text(`x${this.stacks}`, sx + 16 + 12, r1 + 8, 0xfff0a0, { bold: true, ox: 0.5, oy: 0.5 });
    const tx = stackR.x + 16 + 8;
    const tierW = Math.max(50, plate.x + plate.w - 4 - tx - 2 * arrowW - 4);
    const tierL: Rect = { x: tx, y: r1, w: arrowW, h: 16 };
    const tierR: Rect = { x: tx + arrowW + 2 + tierW + 2, y: r1, w: arrowW, h: 16 };
    pageArrow(g, tierL, -1, now);
    pageArrow(g, tierR, 1, now);
    const info = TIER_INFO[this.tier];
    texts.text(info.name, tierL.x + arrowW + 2 + tierW / 2, r1 + 8, info.face[0], { bold: true, ox: 0.5, oy: 0.5 });
    // row 2: Play, what plays, Back
    const r2 = r1 + 20;
    const play: Rect = { x: x0, y: r2, w: 58, h: 16 };
    const back: Rect = { x: plate.x + plate.w - 4 - 44, y: r2, w: 44, h: 16 };
    button3d(g, play, this.queued ? FACE.grey : FACE.green, isPressed(play, now));
    texts.text(this.queued ? 'Wait' : 'Play', play.x + play.w / 2, r2 + 7 + (isPressed(play, now) ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    button3d(g, back, FACE.navy, isPressed(back, now));
    texts.text('Back', back.x + back.w / 2, r2 + 7 + (isPressed(back, now) ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const line = `${def.finisher.name}, ${STYLES[def.style].name}`;
    const lx = play.x + play.w + 8;
    if (lx + textWidth(line, 1, true) < back.x - 4) texts.text(line, lx, r2 + 8, 0xd8d0f0, { bold: true, oy: 0.5 });
    if (live) this.rects = { heroL, heroR, stackL, stackR, tierL, tierR, play, back };
    texts.end();
  }

  private smallButton(g: G, texts: TextPool, r: Rect, label: string, now: number): void {
    const pr = isPressed(r, now);
    button3d(g, r, FACE.navy, pr);
    texts.text(label, r.x + r.w / 2, r.y + 7 + (pr ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
  }
}
