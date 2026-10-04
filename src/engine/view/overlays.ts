// Overlays and menus: the title screen (chrome logo, Rowan and Pip showcased, a pulsing start prompt, how-to
// tips), the boost pick (with a reroll), the treasure / act-clear chest, defeat, the victory, pause, "TAP TO
// BEGIN!", the fight banner, and the screen flash. Panels pop in with a little overshoot; cards stagger in.
import Phaser from 'phaser';
import { heroMaxHp } from '../../core/combat';
import { boostLabel, type BoostOffer, type Phase, type Rarity } from '../../core/run';
import { saveLabel } from '../../core/save';
import type { FightScene } from '../scene';
import { HERO_FEET_X, HERO_W } from '../art';
import { buildCrest, buildLogo } from '../chrome';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { band, brick, button3d, chevron, gauge, glow, GOLD, hudIcon, iconSize, NAVY, panel, RAMP, rows } from './pixels';
import { BOOST_ICON, clamp01, COL, easeBack, easeOut3, inRect, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, ribbon, RIBBON, strip, tag, TextPool } from './ui';

/** Boost card looks per rarity: button face [hi, base, lo, deep], icon well [fill, top line], tag. */
export const CARD: Record<Rarity, { face: readonly [number, number, number, number]; well: [number, number]; tag: string }> = {
  common: { face: [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26], well: [0x2a8a2e, 0x1e6a24], tag: '' },
  rare: { face: [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a], well: [0x2456b0, 0x1a3c8a], tag: 'RARE' },
  epic: { face: [0xf0b8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a], well: [0x6a2aa8, 0x4a1a7a], tag: 'EPIC' },
};

type G = Phaser.GameObjects.Graphics;

/** Title entrance: when each piece has arrived (ms after the title appears). */
const TITLE_IN = { heroes: 340, logo: 420, ribbon: 460, prompt: 420 };

export class Overlays {
  gCards!: G;
  private texts: TextPool;
  /** The picked boost card flies off above everything (even the screen transition). */
  private gFly: G | null = null;
  private flyTexts: TextPool;
  private logo: Phaser.GameObjects.Image | null = null;
  private shine: Phaser.GameObjects.Image | null = null;
  private shineFrames = 0;
  private heroBig: Phaser.GameObjects.Image | null = null;
  private pipBig: Phaser.GameObjects.Image | null = null;
  private chest: Phaser.GameObjects.Image | null = null;
  private chestAt = 0;
  private chestOpenAt = 0;
  private banner = '';
  private bannerAt = -1e9;
  private bannerUntil = 0;
  private bannerWaited = false;
  /** New run over a saved one needs a second tap within this time. */
  private newRunArmedUntil = 0;
  private lastPhase: Phase | null = null;
  private phaseAt = 0; // when the current phase started drawing (performance.now)
  private picked: { offer: BoostOffer; r: Rect; at: number } | null = null;
  private rerollAt2 = -1e9;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32);
    this.flyTexts = new TextPool(s, 41.5);
  }

  createTexts(): void {
    // texts come from the pools on demand
  }

  /** Regenerate the logo and the title's showcase sprites for a new layout. */
  build(): void {
    const s = this.s;
    buildCrest(s);
    this.shineFrames = buildLogo(s);
    for (const o of [this.logo, this.shine, this.heroBig, this.pipBig]) o?.destroy();
    this.heroBig = s.add.image(0, 0, 'hero_idle0').setOrigin(HERO_FEET_X / HERO_W, 1).setScale(2).setDepth(31.3).setVisible(false);
    this.pipBig = s.add.image(0, 0, 'pip_idle0').setOrigin(0.5, 0.5).setScale(2).setDepth(31.3).setVisible(false);
    this.logo = s.add.image(0, 0, 'logo').setOrigin(0, 0).setDepth(31.6).setVisible(false);
    this.shine = s.add.image(0, 0, 'logo_shine_0').setOrigin(0, 0).setDepth(31.7).setVisible(false);
    this.gFly?.destroy();
    this.gFly = s.add.graphics().setDepth(41);
  }

  showBanner(text: string): void {
    this.banner = text;
    this.bannerAt = performance.now();
    this.bannerUntil = this.bannerAt + 1700;
  }

  onPhase(next: Phase): void {
    const s = this.s;
    if (next === 'boost') {
      // a rare or epic card on offer gets a sting
      const best = s.app.run.boostChoices.reduce((m, o) => (o.rarity === 'epic' ? 2 : o.rarity === 'rare' ? Math.max(m, 1) : m), 0);
      if (best > 0) s.later(120, () => s.app.audio.rareSting(best === 2));
    }
    if (next === 'actClear' || next === 'treasure') {
      this.chest?.destroy();
      this.chest = s.add.image(GAME_W / 2, -30, 'chest_closed').setOrigin(0.5, 1).setScale(2);
      s.actors.add(this.chest);
      this.chestAt = s.anim;
      this.chestOpenAt = 0;
    } else if (this.chest) {
      this.chest.destroy();
      this.chest = null;
    }
  }

  /** Treasure: the first tap bursts the chest open and spills its coins; then the boost pick comes up. */
  treasureTap(): void {
    const s = this.s;
    if (this.chestOpenAt || !this.levelClearTap()) return;
    if (!this.chestOpenAt) return;
    const coins = s.app.run.treasure?.coins ?? 0;
    const x = this.chest?.x ?? 0;
    s.hud.dropCoins(x, s.ground - 20, coins);
    s.fx.iconFloat(x + 18, s.ground - 44, `+${coins}`, 0xffe066, 'coin');
    s.later(900, () => {
      if (s.app.run.phase === 'treasure') s.app.setPhase(() => s.app.run.openTreasure());
    });
  }

  /** Act clear (and treasure): the first tap bursts the chest open (returns true = consumed); the next one moves on. */
  levelClearTap(): boolean {
    const s = this.s;
    if (!this.chest) return false;
    if (!this.chestOpenAt) {
      if (s.anim - this.chestAt < 550) return true;
      this.chestOpenAt = s.anim;
      this.chest.setTexture('chest_open');
      const x = this.chest.x;
      const y = s.ground - 18;
      s.fx.burst(x, y, 0xf2c230, 30, true, 1.6);
      s.fx.burst(x, y, 0x5ae070, 12, true, 1.4);
      s.fx.burst(x, y, WHITE, 10, true, 1.2, true);
      s.fx.ring(x, y, 34, 0xffe680, true);
      s.fx.shake(s.app.tuning.juice.shakeMaxPx, 160);
      s.app.audio.kill();
      return true;
    }
    return s.anim - this.chestOpenAt < 400;
  }

  /** The chest drops in and bounces; sparkles rise from it until it is opened. */
  updateChest(now: number): void {
    const s = this.s;
    if (!this.chest) return;
    const k = clamp01((s.anim - this.chestAt) / 600);
    const bounce = k < 0.6 ? (k / 0.6) ** 2 : 1 - Math.abs(Math.sin((k - 0.6) * Math.PI * 2.5)) * 0.12 * (1 - k);
    this.chest.setY(Math.round(-30 + (s.ground + 30) * bounce));
    if (!this.chestOpenAt && Math.random() < 0.25) {
      const sx = this.chest.x + rand(-20, 20);
      const sy = this.chest.y - rand(4, 30);
      s.fx.particles.push({ x: sx, y: sy, vx: 0, vy: -12, g: 0, born: now, life: 420, color: Math.random() < 0.5 ? 0xfff0a0 : WHITE, size: 1, world: true, streak: false });
    }
  }

  // ------------------------------------------------------------------ layout and taps

  /** Title screen with a saved run: Continue (left) and New run (right), on the band. */
  private titleButtons(): { cont: Rect; fresh: Rect } {
    const cx = Math.round(GAME_W / 2);
    const y = this.s.splitY - 6;
    return { cont: { x: cx - 112, y, w: 120, h: 22 }, fresh: { x: cx + 16, y, w: 96, h: 22 } };
  }

  /** Which title button a tap hits. New run arms on the first tap and only fires on the second. */
  titleTap(x: number, y: number): 'continue' | 'new' | null {
    const b = this.titleButtons();
    if (inRect(b.cont, x, y, 3)) {
      notePress(b.cont);
      return 'continue';
    }
    if (inRect(b.fresh, x, y, 3)) {
      notePress(b.fresh);
      const now = performance.now();
      if (now < this.newRunArmedUntil) return 'new';
      this.newRunArmedUntil = now + 2500;
      this.s.app.audio.uiClick();
    }
    return null;
  }

  /** Boost choices: a navy panel with three stacked cards (hit-tested by index). */
  private boostPanel(): Rect {
    return { x: Math.round(GAME_W / 2 - 84), y: 25, w: 168, h: 108 };
  }

  private cardRect(i: number): Rect {
    const p = this.boostPanel();
    return { x: p.x + 8, y: p.y + 12 + i * 31, w: p.w - 16, h: 27 };
  }

  /** The reroll button on the boost panel (shown while the run has rerolls bought at a shop). */
  private rerollRect(): Rect {
    const p = this.boostPanel();
    return { x: p.x + p.w - 50, y: p.y + p.h - 6, w: 44, h: 12 };
  }

  rerollAt(x: number, y: number): boolean {
    const hit = this.s.app.run.rerolls > 0 && inRect(this.rerollRect(), x, y, 3);
    if (hit) {
      notePress(this.rerollRect());
      this.rerollAt2 = performance.now();
    }
    return hit;
  }

  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++)
      if (inRect(this.cardRect(i), x, y)) {
        const offer = this.s.app.run.boostChoices[i];
        if (offer) this.picked = { offer, r: this.cardRect(i), at: performance.now() };
        return i;
      }
    return -1;
  }

  // ------------------------------------------------------------------ drawing helpers

  /** A boost card: ink outline, a rim in the rarity's color, navy body, a lit icon tile, name and value. */
  private card(g: G, texts: TextPool, r: Rect, offer: BoostOffer, now: number, flash = 0, alpha = 1): void {
    const s = this.s;
    const look = CARD[offer.rarity];
    const [hi, base, lo, deep] = look.face;
    if (offer.rarity !== 'common') glow(g, r, base, (0.45 + 0.3 * pulse(now, 900)) * alpha, 3);
    rows(g, r.x - 1, r.y + 3, r.w + 2, r.h, 3, INK, 0.45 * alpha);
    rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 4, INK, alpha);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, base, alpha);
    band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, 0, 1, hi, alpha);
    band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, r.h + 1, r.h + 2, deep, alpha);
    rows(g, r.x, r.y, r.w, r.h, 2, NAVY[3], alpha);
    band(g, r.x, r.y, r.w, r.h, 2, 0, Math.round(r.h * 0.45), NAVY[4], alpha);
    band(g, r.x, r.y, r.w, r.h, 2, r.h - 4, r.h, NAVY[2], alpha);
    band(g, r.x, r.y, r.w, r.h, 2, 0, 1, mix(NAVY[6], base, 0.35), alpha);
    // icon tile in the rarity's colors
    const tile: Rect = { x: r.x + 2, y: r.y + 2, w: 24, h: r.h - 4 };
    rows(g, tile.x, tile.y, tile.w, tile.h, 2, lo, alpha);
    band(g, tile.x, tile.y, tile.w, tile.h, 2, 0, Math.round(tile.h * 0.5), base, alpha);
    band(g, tile.x, tile.y, tile.w, tile.h, 2, 0, 1, hi, alpha);
    band(g, tile.x, tile.y, tile.w, tile.h, 2, tile.h - 1, tile.h, deep, alpha);
    g.fillStyle(INK, 0.6 * alpha);
    g.fillRect(tile.x + tile.w, tile.y + 1, 1, tile.h - 2);
    const icon = BOOST_ICON[offer.id];
    const [iw, ih] = iconSize(icon);
    hudIcon(g, icon, tile.x + ((tile.w - iw) >> 1), tile.y + ((tile.h - ih) >> 1), 1, alpha);
    const [name, val] = boostLabel(s.app.tuning, offer);
    texts.text(name, r.x + 31, r.y + 9, WHITE, { bold: true, oy: 0.5, alpha });
    texts.text(val, r.x + 31, r.y + 19, offer.rarity === 'common' ? 0xb4f070 : hi, { bold: true, oy: 0.5, alpha });
    if (look.tag) {
      const tw = textWidth(look.tag, 1, false) + 6;
      const tr: Rect = { x: r.x + r.w - tw - 3, y: r.y + r.h - 12, w: tw, h: 9 };
      tag(g, tr, look.face, alpha);
      texts.text(look.tag, tr.x + 3, tr.y + 4.5, WHITE, { oy: 0.5, alpha });
    }
    if (offer.rarity !== 'common') {
      // a slanted shimmer crossing the face, and (epic) twinkles around the rim
      const cyc = ((now + r.y * 37) % 1700) / 1700;
      if (cyc < 0.4) {
        const sx = r.x + (r.w + 20) * (cyc / 0.4) - 14;
        g.fillStyle(WHITE, (offer.rarity === 'epic' ? 0.3 : 0.2) * alpha);
        for (let y = 1; y < r.h - 1; y++) {
          const x = Math.round(sx + (r.h - y) * 0.5);
          const x0 = Math.max(r.x + 1, x);
          const x1 = Math.min(r.x + r.w - 1, x + 5);
          if (x1 > x0) g.fillRect(x0, r.y + y, x1 - x0, 1);
        }
      }
      if (offer.rarity === 'epic')
        for (let i = 0; i < 4; i++) {
          const q = (((now / 700 + i * 0.37) % 1) + 1) % 1;
          const px = Math.round(r.x + 4 + ((i * 53 + Math.floor(now / 700) * 17) % (r.w - 8)));
          const py = i % 2 ? r.y - 2 : r.y + r.h + 1;
          const arm = q < 0.5 ? 1 : 0;
          g.fillStyle(q < 0.5 ? WHITE : 0xffe680, (1 - q) * alpha);
          g.fillRect(px - arm, py, arm * 2 + 1, 1);
          g.fillRect(px, py - arm, 1, arm * 2 + 1);
        }
    }
    if (flash > 0) {
      g.fillStyle(WHITE, flash * alpha);
      g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
  }

  /** A four-point twinkle. */
  private star(g: G, x: number, y: number, size: number, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.fillRect(x - size, y, size * 2 + 1, 1);
    g.fillRect(x, y - size, 1, size * 2 + 1);
    if (size >= 2) {
      g.fillStyle(WHITE, alpha);
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  /** A big prompt on a dark strip with chevrons sliding in from both sides (TAP TO BEGIN, tap to start). */
  private prompt(g: G, text: string, cy: number, now: number, color = WHITE, alpha = 1): void {
    const w = textWidth(text, 2, true);
    const p = pulse(now, 900);
    strip(g, 0, cy - 12, GAME_W, 24, 0.55 * alpha);
    const cx = Math.round(GAME_W / 2);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const k = ((now / 600 + i / 3) % 1 + 1) % 1;
        const x = Math.round(cx + side * (w / 2 + 30 - k * 18));
        chevron(g, x, cy - 5, 11, i === 0 ? GOLD[4] : GOLD[3], alpha * Math.sin(k * Math.PI), -side, true);
      }
    this.texts.text(text, cx, cy + 1, mix(color, WHITE, 0.4 * p), { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: alpha * (0.8 + 0.2 * p), extrude: 1, extrudeCol: 0x2a2046 });
  }

  // ------------------------------------------------------------------ the frame

  draw(now: number): void {
    const s = this.s;
    const g = s.gTop;
    const gc = this.gCards;
    const txt = s.txt;
    g.clear();
    gc.clear();
    this.texts.begin();
    const run = s.app.run;
    const ph = run.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.phaseAt = now;
    }
    if (now < s.fx.screenFlashUntil) {
      // scene only: the bar must stay readable
      g.fillStyle(s.fx.screenFlashColor, Math.min(0.6, (s.fx.screenFlashUntil - now) / 260));
      g.fillRect(0, 0, GAME_W, s.splitY);
    }
    if (now < s.fx.impactFlashUntil || s.fx.impactFlashPending) {
      // heavy impact: the scene goes white for a frame or two
      s.fx.impactFlashPending = false;
      g.fillStyle(WHITE, 0.82);
      g.fillRect(0, 0, GAME_W, s.splitY);
    }
    // the old named texts are no longer used by the overlays
    for (const k of ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3', 'begin', 'banner', 'tCont', 'tContSub', 'tNew']) txt[k]?.setVisible(false);
    const titleOn = ph === 'title';
    this.logo?.setVisible(titleOn);
    this.shine?.setVisible(false);
    this.heroBig?.setVisible(titleOn);
    this.pipBig?.setVisible(titleOn);
    const since = now - this.phaseAt;
    if (ph === 'fight') this.drawBanner(g, now);
    if (ph === 'title') this.drawTitle(g, gc, now, since);
    else if (ph === 'boost') this.drawBoost(g, gc, now, since);
    else if (ph === 'actClear') this.drawChestScreen(g, gc, now, true);
    else if (ph === 'treasure') this.drawChestScreen(g, gc, now, false);
    else if (ph === 'defeat') this.drawDefeat(g, gc, now, since);
    else if (ph === 'victory') this.drawVictory(g, gc, now, since);
    else if (ph === 'fight' && s.app.storyOverlay) {
      // a boss's scene: the story view draws it
    } else if (ph === 'fight' && s.app.awaitingBegin && !s.app.userPaused) {
      this.prompt(g, 'TAP TO BEGIN!', now < this.bannerUntil ? 56 : 50, now);
    } else if (ph === 'fight' && s.app.userPaused) this.drawPause(g, gc, now);
    this.drawPicked(now);
    this.texts.end();
  }

  /** The dim behind menus, darker toward the edges (a vignette) so the middle stays lit. */
  private dim(g: G, a: number, color = 0x05040a): void {
    g.fillStyle(color, a);
    g.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(color, a * 0.22);
      g.fillRect(0, 0, GAME_W, 4 + i * 4);
      g.fillRect(0, GAME_H - 4 - i * 4, GAME_W, 4 + i * 4);
      g.fillRect(0, 0, 6 + i * 6, GAME_H);
      g.fillRect(GAME_W - 6 - i * 6, 0, 6 + i * 6, GAME_H);
    }
  }

  // ------------------------------------------------------------------ title

  private drawTitle(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const L = s.L;
    const R = s.R;
    const cx = Math.round(GAME_W / 2);
    // the sky darkens toward the top behind the logo; the stage dims a touch
    g.fillStyle(0x05040a, 0.14);
    g.fillRect(0, 0, GAME_W, s.splitY);
    for (let y = 0; y < 72; y += 4) {
      g.fillStyle(0x0a0618, 0.42 * (1 - y / 72) ** 1.6);
      g.fillRect(0, y, GAME_W, 4);
    }
    // the stage's own hero and owl make way for the big showcase versions
    const f = s.fighters as unknown as { hero?: Phaser.GameObjects.Image; pip?: Phaser.GameObjects.Image };
    f.hero?.setVisible(false);
    f.pip?.setVisible(false);

    // Rowan and Pip, 2x, slide in from the left; Rowan flourishes his sword now and then
    const hk = easeBack(since / TITLE_IN.heroes, 1.2);
    const slide = Math.round((1 - hk) * -140);
    const hx = L + 82 + slide;
    const cyc = now % 3600;
    const pose = cyc < 140 ? 'windup' : cyc < 340 ? 'slashA' : Math.floor(now / 420) % 2 ? 'idle1' : 'idle0';
    // a soft spotlight on the ground under them
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xfff0c0, 0.06);
      const w = 70 - i * 14;
      g.fillRect(hx - w / 2 - 8, s.ground - 3 + Math.floor(i / 2), w + 16, 3);
    }
    rows(g, hx - 22, s.ground - 2, 44, 5, 2, INK, 0.35);
    this.heroBig?.setTexture(`hero_${pose}`).setPosition(hx, s.ground);
    const px = L + 38 + slide;
    const py = Math.round(s.ground - 46 + Math.sin(now / 300) * 3);
    this.pipBig?.setTexture(Math.floor(now / 110) % 2 ? 'pip_idle1' : 'pip_idle0').setPosition(px, py);
    if (cyc >= 140 && cyc < 420) {
      const k = (cyc - 140) / 280;
      this.star(gc, hx + 44, s.ground - 52 + Math.round(k * 10), k < 0.5 ? 3 : 2, 0xfff0a0, 1 - k);
    }

    // the logo drops in with a bounce, bobs gently, and a gleam sweeps across it every few seconds
    const lw = this.logo?.width ?? 150;
    const lk = easeBack((since - 60) / (TITLE_IN.logo - 60), 1.4);
    const lx = Math.round(Math.min(R - 6 - lw, Math.max(cx - lw / 2, hx + 52)));
    const ly = Math.round(Math.max(18, s.ground - 78) - (1 - lk) * 90 + Math.sin(now / 650) * 1.5);
    this.logo?.setPosition(lx, ly);
    const sf = Math.floor(((now - this.phaseAt) % 2800) / 34);
    if (since > TITLE_IN.logo && sf < this.shineFrames) this.shine?.setTexture(`logo_shine_${sf}`).setPosition(lx, ly).setVisible(true);
    // twinkles around the crest
    for (let i = 0; i < 3; i++) {
      const q = ((now / 900 + i * 0.33) % 1 + 1) % 1;
      const sx = lx + lw - 46 + ((i * 31) % 44);
      const sy = ly + 12 + ((i * 17) % 40);
      if (q < 0.5 && lk >= 1) this.star(gc, sx, sy, q < 0.25 ? 2 : 1, 0xfff0a0, 1 - q * 2);
    }
    // region ribbon unfurls under the logo
    const rk = easeOut3((since - 220) / (TITLE_IN.ribbon - 220));
    const label = 'Region 1: Greenmarch';
    const rw = Math.round((textWidth(label, 1, true) + 16) * rk);
    if (rw > 6) {
      ribbon(gc, lx + 70, ly + 58, rw, 11, RIBBON.red, 1, rk > 0.8);
      if (rk >= 1) this.texts.text(label, lx + 70, ly + 63.5, 0xfff0a0, { bold: true, ox: 0.5, oy: 0.5 });
    }
    // drifting golden motes
    if (Math.random() < 0.2)
      s.fx.particles.push({ x: rand(L, R), y: s.ground - rand(0, 30), vx: rand(-4, 4), vy: rand(-14, -6), g: 0, born: now, life: rand(1400, 2400), color: Math.random() < 0.5 ? 0xfff0a0 : 0xffd23a, size: 1, world: true, streak: false });

    // the band: Continue / New run (with a save), or the start prompt; how-to tips in the tray under it
    const save = s.app.savedRun;
    const pa = clamp01((since - 260) / (TITLE_IN.prompt - 260));
    if (save) {
      const { cont, fresh } = this.titleButtons();
      const armed = now < this.newRunArmedUntil;
      const ck = easeBack((since - 200) / 260, 1.6);
      const dy = Math.round((1 - ck) * 30);
      if (ck > 0) {
        glow(gc, { ...cont, y: cont.y + dy }, 0x8af06a, 0.35 + 0.3 * pulse(now, 900), 3);
        button3d(gc, { ...cont, y: cont.y + dy }, FACE.green, isPressed(cont, now));
        button3d(gc, { ...fresh, y: fresh.y + dy }, armed ? FACE.red : FACE.navy, isPressed(fresh, now));
        const pc = isPressed(cont, now) ? 2 : 0;
        this.texts.text('Continue', cont.x + cont.w / 2, cont.y + dy + 7 + pc, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
        this.texts.text(saveLabel(save, s.app.run), cont.x + cont.w / 2, cont.y + dy + 16 + pc, 0xfff07a, { ox: 0.5, oy: 0.5 });
        const pf = isPressed(fresh, now) ? 2 : 0;
        this.texts.text(armed ? 'Tap again' : 'New run', fresh.x + fresh.w / 2, fresh.y + dy + fresh.h / 2 + pf, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      }
    } else if (pa > 0) this.prompt(g, 'Tap to start!', s.splitY + 16, now, WHITE, pa);
    if (pa > 0) {
      const ty = s.splitY + 32 + Math.round((GAME_H - s.splitY - 32 - (GAME_H - s.B)) / 2);
      const tips: Array<[readonly number[], string]> = [
        [COL.yellow, 'Tap on blocks'],
        [COL.red, 'Tap red to block'],
        [COL.purple, 'Avoid purple'],
      ];
      const widths = tips.map(([, t]) => textWidth(t, 1, false) + 10);
      const total = widths.reduce((a, b) => a + b, 0) + (tips.length - 1) * 12;
      let x = Math.round(cx - total / 2);
      tips.forEach(([col, t], i) => {
        const [base, light, dark] = col;
        brick(gc, x, ty - 4, 6, 9, [light, base, dark, mix(dark, INK, 0.4)], pa);
        this.texts.text(t, x + 9, ty + 1, i === 0 ? 0xfff0c0 : i === 1 ? 0xffb0a0 : 0xdab0ff, { oy: 0.5, alpha: pa });
        x += widths[i] + 12;
        if (i < tips.length - 1) {
          gc.fillStyle(NAVY[5], pa);
          gc.fillRect(x - 7, ty - 1, 2, 2);
        }
      });
    }
  }

  // ------------------------------------------------------------------ boost pick

  private drawBoost(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const run = s.app.run;
    this.dim(g, 0.45);
    // the panel pops in (grows with a little overshoot), then the cards slide in one after another
    const p0 = this.boostPanel();
    const k = easeBack(since / 240, 1.5);
    const sc = 0.75 + 0.25 * k;
    const p: Rect = { x: Math.round(p0.x + (p0.w * (1 - sc)) / 2), y: Math.round(p0.y + (p0.h * (1 - sc)) / 2), w: Math.round(p0.w * sc), h: Math.round(p0.h * sc) };
    if (since < 60) return;
    panel(gc, p, { trim: 'full', alpha: clamp01(since / 120) });
    if (k < 0.98) return;
    ribbon(gc, p.x + p.w / 2, p.y - 6, 112, 13, RIBBON.purple);
    this.texts.text('Choose a Boost', p.x + p.w / 2, p.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    run.boostChoices.forEach((offer, i) => {
      const ck = easeBack((since - 120 - i * 70) / 260, 1.4);
      if (ck <= 0) return;
      const r0 = this.cardRect(i);
      const r = { ...r0, x: r0.x + Math.round((1 - ck) * 70) };
      const rr = (now - this.rerollAt2) / 300;
      this.card(gc, this.texts, r, offer, now + i * 300, rr >= 0 && rr < 1 ? 0.7 * (1 - rr) : 0, clamp01(ck * 1.5));
    });
    if (run.rerolls > 0) {
      const rr = this.rerollRect();
      const pr = isPressed(rr, now);
      button3d(gc, rr, FACE.blue, pr);
      this.texts.text(`Reroll x${run.rerolls}`, rr.x + rr.w / 2, rr.y + rr.h / 2 + (pr ? 2 : 0), WHITE, { ox: 0.5, oy: 0.5 });
    }
  }

  /** The picked card lifts, flashes and fades out over whatever comes next (even the screen wipe). */
  private drawPicked(now: number): void {
    const g = this.gFly;
    if (!g) return;
    g.clear();
    this.flyTexts.begin();
    const p = this.picked;
    if (p) {
      const k = (now - p.at) / 340;
      if (k >= 1 || this.s.app.run.phase === 'boost') {
        if (k >= 1) this.picked = null;
      } else {
        const r = { ...p.r, y: p.r.y - Math.round(easeOut3(k) * 10) };
        glow(g, r, CARD[p.offer.rarity].face[0], 0.8 * (1 - k), 4);
        this.card(g, this.flyTexts, r, p.offer, now, Math.max(0, 0.8 - k * 2), 1 - k * k);
      }
    }
    this.flyTexts.end();
  }

  // ------------------------------------------------------------------ chest screens, defeat, victory, pause

  private drawChestScreen(g: G, gc: G, now: number, actClear: boolean): void {
    const s = this.s;
    const run = s.app.run;
    const cx = Math.round(GAME_W / 2);
    const opened = !!this.chestOpenAt;
    const since = now - this.phaseAt;
    const k = easeBack(since / 300, 1.5);
    // a banner (the big title on a ribbon) drops in under the HUD buttons; the hint sits under it
    const y = Math.round(20 - (1 - k) * 50);
    g.fillStyle(0x0a0618, 0.22);
    g.fillRect(0, 0, GAME_W, 54);
    const clear = actClear && opened;
    const ok = clear ? Math.min(1, easeBack((s.anim - this.chestOpenAt) / 320, 1.8)) : 1;
    const title = clear ? `Act ${run.actIndex + 1} Clear!` : actClear ? run.act.name : 'Treasure!';
    const look = clear ? RIBBON.gold : actClear ? RIBBON.blue : RIBBON.gold;
    const tw = textWidth(title, 2, true);
    ribbon(gc, cx, y, Math.round((tw + 24) * (clear ? ok : 1)), 22, look, 1, ok > 0.9);
    if (ok > 0.5)
      this.texts.text(title, cx, y + 11, clear ? 0xfff6c0 : actClear ? WHITE : 0xfff6c0, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: clear || !actClear ? 0x7a3a0a : 0x10204a });
    this.drawStatus(gc, now);
    const hint = clear ? 'Tap to continue' : actClear ? 'Tap the chest to continue' : 'Tap the chest';
    this.texts.text(hint, cx, y + 32, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: clear ? 0.7 + 0.3 * pulse(now, 800) : 1 });
    if (clear) {
      for (let i = 0; i < 4; i++) {
        const q = ((now / 900 + i * 0.27) % 1 + 1) % 1;
        if (q < 0.45) this.star(gc, Math.round(cx - tw / 2 - 6 + ((i * 47) % (tw + 12))), y - 3 + ((i * 13) % 28), q < 0.2 ? 2 : 1, 0xfff0a0, 1 - q / 0.45);
      }
    } else if (this.chest && s.anim - this.chestAt > 600) {
      // a bouncing arrow beside the chest, pointing at it
      const ax = Math.round(this.chest.x + 30 + Math.abs(Math.sin(now / 220)) * 5);
      const ay = Math.round(this.chest.y - 20);
      chevron(gc, ax, ay - 5, 11, GOLD[3], 1, -1, true);
      chevron(gc, ax + 4, ay - 5, 11, GOLD[4], 1, -1, true);
    }
  }

  /** Between fights the console shows the hero's status: HP, coins and revives. */
  private drawStatus(gc: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const dy = Math.round((1 - easeBack((now - this.phaseAt - 80) / 300, 1.4)) * 30);
    const y = s.splitY + 9 + dy;
    const coins = `${s.hud.coinsShown}`;
    const cw = textWidth(coins, 1, true) + 15;
    const total = 16 + 104 + 8 + cw + 6 + 20;
    let x = Math.round((s.L + s.R) / 2 - total / 2);
    hudIcon(gc, 'heart', x, y - 1);
    x += 18;
    gauge(gc, x, y + 1, 100, 8, H.hp / max, H.hp / max, { ramp: H.hp / max <= 0.3 ? RAMP.hpLow : RAMP.hp, seg: 10 });
    this.texts.text(`${H.hp}/${max}`, x + 50, y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    x += 110;
    const cr: Rect = { x, y, w: cw, h: 11 };
    tag(gc, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    hudIcon(gc, 'coin', cr.x + 2, cr.y + 1);
    this.texts.text(coins, cr.x + 12, cr.y + 5.5, 0xffe680, { bold: true, oy: 0.5 });
    x += cw + 6;
    const rr: Rect = { x, y, w: 20, h: 11 };
    tag(gc, rr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    hudIcon(gc, 'potionS', rr.x + 2, rr.y + 1, 1, H.revives > 0 ? 1 : 0.45);
    this.texts.text(`${H.revives}`, rr.x + 11, rr.y + 5.5, H.revives > 0 ? 0xffb0e0 : 0x8a84a0, { bold: true, oy: 0.5 });
  }

  private drawDefeat(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.55, 0x12030a);
    // a red pulse around the edges
    const p = pulse(now, 1400);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xa01828, (0.12 + 0.08 * p) * (1 - i / 4));
      g.fillRect(0, i * 3, GAME_W, 3);
      g.fillRect(0, GAME_H - (i + 1) * 3, GAME_W, 3);
    }
    const k = easeBack(since / 380, 1.6);
    const y = Math.round(36 - (1 - k) * 30);
    this.texts.text('DEFEATED', cx, y, 0xff5a5a, { bold: true, scale: 3, ox: 0.5, oy: 0.5, extrude: 3, extrudeCol: 0x4a0a14, alpha: clamp01(since / 150) });
    if (since > 250) {
      this.texts.text(`Rowan falls... back to the start of Act ${s.app.run.actIndex + 1}`, cx, y + 22, 0xffd8d0, { ox: 0.5, oy: 0.5 });
      const r: Rect = { x: cx - 64, y: y + 32, w: 128, h: 18 };
      if (since > 700) glow(gc, r, 0xffd23a, 0.3 + 0.4 * pulse(now, 800), 3);
      button3d(gc, r, since > 700 ? FACE.gold : FACE.grey);
      this.texts.text('Retry the act', cx, r.y + r.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    }
  }

  private drawVictory(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.5);
    // slow golden rays behind the title
    const ox = cx;
    const oy = 34;
    const rot = now / 4000;
    for (let i = 0; i < 12; i++) {
      const a0 = rot + (i / 12) * Math.PI * 2;
      const a1 = a0 + Math.PI / 18;
      g.fillStyle(i % 2 ? 0xffe680 : 0xfff6c0, 0.09);
      g.fillTriangle(ox, oy, Math.round(ox + Math.cos(a0) * 260), Math.round(oy + Math.sin(a0) * 260), Math.round(ox + Math.cos(a1) * 260), Math.round(oy + Math.sin(a1) * 260));
    }
    const k = easeBack(since / 420, 1.5);
    ribbon(gc, cx, 44, Math.round(220 * Math.min(1, k)), 12, RIBBON.gold, 1, k > 0.9);
    this.texts.text('Greenmarch is saved!', cx, 32 - Math.round((1 - Math.min(1, k)) * 12), 0xffd23a, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 2, extrudeCol: 0x5a3410 });
    if (since > 400) {
      this.texts.text('The first weight is home. Eleven to go.', cx, 49.5, 0x3a1e08, { bold: false, ox: 0.5, oy: 0.5, grad: [WHITE, 0xfff6d8] });
      this.texts.text('Next: the Frostpeaks (coming soon)', cx, 66, 0x9ad8ff, { ox: 0.5, oy: 0.5 });
    }
    if (since > 1500) this.prompt(g, 'Tap to continue', 88, now, 0xfff07a);
    // a little shower of golden sparks
    if (Math.random() < 0.5) s.fx.particles.push({ x: rand(20, GAME_W - 20), y: -2, vx: rand(-10, 10), vy: rand(20, 40), g: 30, born: now, life: 2200, color: Math.random() < 0.5 ? 0xffe680 : WHITE, size: 1, world: true, streak: false });
    for (let i = 0; i < 5; i++) {
      const q = ((now / 1100 + i * 0.21) % 1 + 1) % 1;
      if (q < 0.4) this.star(gc, Math.round(cx - 110 + ((i * 53) % 220)), 20 + ((i * 23) % 36), q < 0.2 ? 2 : 1, 0xfff0a0, 1 - q / 0.4);
    }
  }

  private drawPause(g: G, gc: G, now: number): void {
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.55);
    const r: Rect = { x: cx - 60, y: 30, w: 120, h: 50 };
    panel(gc, r, { trim: 'full' });
    this.texts.text('Paused', cx, r.y + 17, WHITE, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: NAVY[0] });
    this.texts.text('Tap to resume', cx, r.y + 37, 0xffd23a, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.7 + 0.3 * pulse(now, 900) });
  }

  /** ELITE! / the boss's name: a banner sweeping in across the stage, holding, then sweeping out. */
  private drawBanner(g: G, now: number): void {
    // while the fight waits for its first tap the banner holds (above the TAP TO BEGIN prompt); the tap sends it off
    const waiting = this.s.app.awaitingBegin;
    if (waiting && now < this.bannerUntil) this.bannerUntil = Math.max(this.bannerUntil, now + 600);
    else if (this.bannerWaited && !waiting) this.bannerUntil = Math.min(this.bannerUntil, now + 240);
    this.bannerWaited = waiting && now < this.bannerUntil;
    if (now >= this.bannerUntil) return;
    const t = now - this.bannerAt;
    const total = this.bannerUntil - this.bannerAt;
    const inK = easeOut3(t / 220);
    const outK = clamp01((t - (total - 240)) / 240);
    const y = 30;
    const h = 24;
    const elite = this.banner === 'ELITE!';
    const col = elite ? 0x8a1a22 : 0x4a2470;
    const wIn = Math.round(GAME_W * inK);
    const x0 = Math.round(GAME_W * outK);
    const x1 = Math.min(GAME_W, wIn);
    if (x1 <= x0) return;
    g.fillStyle(INK, 0.5);
    g.fillRect(x0, y - h / 2 - 2, x1 - x0, h + 4);
    g.fillStyle(col, 0.85);
    g.fillRect(x0, y - h / 2, x1 - x0, h);
    g.fillStyle(mix(col, WHITE, 0.25), 0.9);
    g.fillRect(x0, y - h / 2, x1 - x0, 2);
    g.fillStyle(GOLD[3], 1);
    g.fillRect(x0, y - h / 2 - 1, x1 - x0, 1);
    g.fillRect(x0, y + h / 2, x1 - x0, 1);
    // speed streaks
    g.fillStyle(WHITE, 0.25);
    for (let i = 0; i < 6; i++) {
      const sx = Math.round(((now * 0.4 + i * 67) % (GAME_W + 60)) - 30);
      if (sx > x0 && sx < x1) g.fillRect(GAME_W - sx, y - 8 + ((i * 5) % 16), 18, 1);
    }
    const tx = Math.round(GAME_W / 2 + (1 - inK) * 120 - outK * 160);
    this.texts.text(this.banner, tx, y + 1, elite ? 0xffd0c0 : 0xffe680, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 2, extrudeCol: elite ? 0x4a0a10 : 0x2a1040 });
  }
}
