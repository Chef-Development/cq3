// Overlays and menus: title screen, boost choice (with a reroll), the treasure / act-clear chest, defeat, the
// victory, pause, "TAP TO BEGIN!", the fight banner, and the screen flash.
import Phaser from 'phaser';
import { boostLabel, type Phase, type Rarity } from '../../core/run';
import { saveLabel } from '../../core/save';
import type { FightScene } from '../scene';
import { buildBoard, buildCrest } from '../chrome';
import { FONT_BOLD, fontText, textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { button3d, hudIcon, iconSize, rows } from './pixels';
import { BOOST_ICON, clamp01, ease, inRect, INK, rand, WHITE, type Rect } from './shared';

/** Boost card looks per rarity: button face [hi, base, lo, deep], icon well [fill, top line], tag. */
export const CARD: Record<Rarity, { face: readonly [number, number, number, number]; well: [number, number]; tag: string }> = {
  common: { face: [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26], well: [0x2a8a2e, 0x1e6a24], tag: '' },
  rare: { face: [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a], well: [0x2456b0, 0x1a3c8a], tag: 'RARE' },
  epic: { face: [0xf0b8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a], well: [0x6a2aa8, 0x4a1a7a], tag: 'EPIC' },
};

type G = Phaser.GameObjects.Graphics;

export class Overlays {
  gCards!: G;
  private boostTexts: Phaser.GameObjects.BitmapText[] = [];
  private boardImg: Phaser.GameObjects.Image | null = null;
  private crestImg: Phaser.GameObjects.Image | null = null;
  private chest: Phaser.GameObjects.Image | null = null;
  private chestAt = 0;
  private chestOpenAt = 0;
  private banner = '';
  private bannerUntil = 0;
  /** New run over a saved one needs a second tap within this time. */
  private newRunArmedUntil = 0;

  constructor(private readonly s: FightScene) {}

  createTexts(): void {
    // per card: name, value, rarity tag
    // per card: name, value, rarity tag; then the reroll label
    for (let i = 0; i < 10; i++) this.boostTexts.push(this.s.add.bitmapText(0, 0, FONT_BOLD, '').setDepth(32));
  }

  /** Regenerate the boost board and title crest for a new layout. */
  build(): void {
    const s = this.s;
    const bp = this.boostPanel();
    buildBoard(s, 'board_boost', bp.w, bp.h);
    this.boardImg?.destroy();
    this.boardImg = s.add.image(bp.x, bp.y, 'board_boost').setOrigin(0, 0).setDepth(31).setVisible(false);
    buildCrest(s);
    this.crestImg?.destroy();
    this.crestImg = s.add.image(0, 0, 'crest').setOrigin(0.5, 0.5).setDepth(31).setVisible(false);
  }

  showBanner(text: string): void {
    this.banner = text;
    this.bannerUntil = performance.now() + 1800;
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

  /** Title screen with a saved run: Continue (left) and New run (right). */
  private titleButtons(): { cont: Rect; fresh: Rect } {
    const cx = Math.round(GAME_W / 2);
    return { cont: { x: cx - 112, y: 89, w: 120, h: 24 }, fresh: { x: cx + 16, y: 89, w: 96, h: 24 } };
  }

  /** Which title button a tap hits. New run arms on the first tap and only fires on the second. */
  titleTap(x: number, y: number): 'continue' | 'new' | null {
    const b = this.titleButtons();
    if (inRect(b.cont, x, y, 3)) return 'continue';
    if (inRect(b.fresh, x, y, 3)) {
      const now = performance.now();
      if (now < this.newRunArmedUntil) return 'new';
      this.newRunArmedUntil = now + 2500;
      this.s.app.audio.uiClick();
    }
    return null;
  }

  /** The reroll button on the boost board (shown while the run has rerolls bought at a shop). */
  private rerollRect(): Rect {
    const p = this.boostPanel();
    return { x: p.x + p.w - 50, y: p.y + 4, w: 44, h: 12 };
  }

  rerollAt(x: number, y: number): boolean {
    return this.s.app.run.rerolls > 0 && inRect(this.rerollRect(), x, y, 3);
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

  /** Rare and epic cards: a gold rim, a light band sweeping across, and (epic) twinkles around the edge. */
  private fancyCard(g: G, r: Rect, rarity: Rarity, t: number): void {
    g.fillStyle(0xf2c230, 1);
    g.fillRect(r.x + 2, r.y + 1, r.w - 4, 1);
    g.fillRect(r.x + 2, r.y + r.h - 2, r.w - 4, 1);
    g.fillRect(r.x + 1, r.y + 2, 1, r.h - 4);
    g.fillRect(r.x + r.w - 2, r.y + 2, 1, r.h - 4);
    const cyc = (t % 1600) / 1600;
    if (cyc < 0.45) {
      // a slanted shimmer crossing the face
      const sx = r.x + 2 + (r.w + 16) * (cyc / 0.45) - 12;
      g.fillStyle(WHITE, rarity === 'epic' ? 0.45 : 0.32);
      for (let y = 2; y < r.h - 2; y++) {
        const x = Math.round(sx + (r.h - y) * 0.5);
        const x0 = Math.max(r.x + 2, x);
        const x1 = Math.min(r.x + r.w - 2, x + 4);
        if (x1 > x0) g.fillRect(x0, r.y + y, x1 - x0, 1);
      }
    }
    if (rarity === 'epic')
      for (let i = 0; i < 4; i++) {
        const q = ((t / 700 + i * 0.37) % 1 + 1) % 1;
        const px = Math.round(r.x + 4 + ((i * 53 + Math.floor(t / 700) * 17) % (r.w - 8)));
        const py = i % 2 ? r.y - 1 : r.y + r.h;
        const arm = q < 0.5 ? 1 : 0;
        g.fillStyle(q < 0.5 ? WHITE : 0xffe680, 1 - q);
        g.fillRect(px - arm, py, arm * 2 + 1, 1);
        g.fillRect(px, py - arm, 1, arm * 2 + 1);
      }
  }

  draw(now: number): void {
    const s = this.s;
    const g = s.gTop;
    const txt = s.txt;
    g.clear();
    const run = s.app.run;
    const ph = run.phase;
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
    const ov = ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3'];
    const hide = (...keys: string[]) => keys.forEach((k) => txt[k].setVisible(false));
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
    if (!(ph === 'fight' && s.app.awaitingBegin && !s.app.userPaused)) txt.begin.setVisible(false);
    if (ph !== 'title') hide('tCont', 'tContSub', 'tNew');
    if (ph === 'scene' || ph === 'map' || ph === 'rest' || ph === 'shop' || ph === 'event') hide(...ov);
    if (ph === 'fight' && now < this.bannerUntil) {
      const k = (this.bannerUntil - now) / 1800;
      s.setText('banner', this.banner, cx, 40, WHITE, 2, 0.5, 0.5, true);
      txt.banner.setAlpha(k < 0.15 ? k / 0.15 : 1);
    } else txt.banner.setVisible(false);
    if (ph === 'title') {
      dim(0.3);
      // logo: steel-gradient title with the crest, a tag line, how-to on a dark ribbon, blinking start prompt
      const title = 'Combo Quest';
      const tw = textWidth(title, 3, true);
      const crestW = 44;
      const lx = Math.round(cx - (tw + crestW - 6) / 2);
      const bob = Math.round(Math.sin(now / 500) * 1.5);
      s.setText('ovTitle', title, lx, 30 + bob, WHITE, 3, 0, 0.5);
      txt.ovTitle.setTint(0xffffff, 0xffffff, 0x9aa8c8, 0x9aa8c8);
      this.crestImg?.setVisible(true).setPosition(lx + tw - 6 + crestW / 2, 30 + bob);
      s.setText('ovSub', 'Region 1: Greenmarch', cx, 53, 0xffe680, 1, 0.5, 0.5);
      g.fillStyle(INK, 0.55);
      g.fillRect(0, 62, GAME_W, 22);
      g.fillStyle(INK, 0.3);
      g.fillRect(0, 61, GAME_W, 1);
      g.fillRect(0, 84, GAME_W, 1);
      s.setText('ovLine1', 'Tap when the line is on a block', cx, 68, WHITE, 1, 0.5, 0.5);
      s.setText('ovLine2', 'Tap red to block - avoid purple', cx, 78, 0xff9a80, 1, 0.5, 0.5);
      const save = s.app.savedRun;
      s.setText('ovLine3', 'TAP TO START!', cx, 97, WHITE, 2, 0.5, 0.5, blink && !save);
      if (save) {
        // a run was saved: Continue it, or start over (that takes a second tap)
        const { cont, fresh } = this.titleButtons();
        const gc = this.gCards;
        const armed = now < this.newRunArmedUntil;
        button3d(gc, cont, [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26]);
        button3d(gc, fresh, armed ? [0xff9a8a, 0xe0463c, 0xb02a2a, 0x7a1a1a] : [0x8a90a6, 0x6e7488, 0x585e72, 0x3e4254]);
        s.setText('tCont', 'Continue', cont.x + cont.w / 2, cont.y + 8, WHITE, 1, 0.5, 0.5);
        s.setText('tContSub', saveLabel(save, s.app.run), cont.x + cont.w / 2, cont.y + 17, 0xfff07a, 1, 0.5, 0.5);
        s.setText('tNew', armed ? 'Tap again' : 'New run', fresh.x + fresh.w / 2, fresh.y + fresh.h / 2, WHITE, 1, 0.5, 0.5);
      } else hide('tCont', 'tContSub', 'tNew');
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
      s.setText('ovTitle', 'CHOOSE A BOOST', run.rerolls > 0 ? p.x + 52 : cx, p.y + 10, WHITE, 1, 0.5, 0.5);
      if (run.rerolls > 0) {
        const rr = this.rerollRect();
        button3d(gc, rr, [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a]);
        const b = this.boostTexts[9];
        b.setText(fontText(`Reroll x${run.rerolls}`)).setPosition(rr.x + rr.w / 2, rr.y + rr.h / 2).setTint(WHITE).setOrigin(0.5, 0.5).setScale(1).setVisible(true);
      }
      const since = now - s.app.phaseSince;
      run.boostChoices.forEach((offer, i) => {
        const look = CARD[offer.rarity];
        // the cards pop up one after another
        const k = ease(clamp01((since - i * 70) / 200));
        const r0 = this.cardRect(i);
        const r = { ...r0, y: r0.y + Math.round((1 - k) * 16) };
        button3d(gc, r, look.face);
        if (offer.rarity !== 'common') this.fancyCard(gc, r, offer.rarity, now + i * 300);
        // icon well
        rows(gc, r.x + 4, r.y + 4, 20, r.h - 7, 2, look.well[0]);
        gc.fillStyle(look.well[1], 1);
        gc.fillRect(r.x + 5, r.y + 4, 18, 1);
        const icon = BOOST_ICON[offer.id];
        const [iw, ih] = iconSize(icon);
        hudIcon(gc, icon, r.x + 4 + ((20 - iw) >> 1), r.y + 4 + ((r.h - 7 - ih) >> 1));
        const [name, val] = boostLabel(s.app.tuning, offer);
        const a = this.boostTexts[i * 3];
        const b = this.boostTexts[i * 3 + 1];
        const tag = this.boostTexts[i * 3 + 2];
        a.setText(fontText(name)).setPosition(r.x + 29, r.y + 10).setTint(WHITE).setOrigin(0, 0.5).setScale(1).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + 29, r.y + 19).setTint(0xfff07a).setOrigin(0, 0.5).setScale(1).setVisible(true);
        if (look.tag) tag.setText(fontText(look.tag)).setPosition(r.x + r.w - 5, r.y + 19).setTint(0xffe680).setOrigin(1, 0.5).setScale(1).setVisible(true);
      });
    } else if (ph === 'actClear') {
      const opened = !!this.chestOpenAt;
      s.setText('ovTitle', opened ? `Act ${run.actIndex + 1} clear!` : run.act.name, cx, 28, opened ? 0xffd23a : WHITE, 2, 0.5, 0.5);
      s.setText('ovLine1', opened ? 'Tap to continue' : 'Tap the chest to continue', cx, 44, WHITE, 1, 0.5, 0.5, opened ? blink : true);
      hide('ovSub', 'ovLine2', 'ovLine3');
    } else if (ph === 'treasure') {
      s.setText('ovTitle', 'Treasure!', cx, 28, 0xffd23a, 2, 0.5, 0.5);
      s.setText('ovLine1', 'Tap the chest', cx, 44, WHITE, 1, 0.5, 0.5, !this.chestOpenAt);
      hide('ovSub', 'ovLine2', 'ovLine3');
    } else if (ph === 'defeat') {
      dim(0.65);
      s.setText('ovTitle', 'DEFEATED', cx, 38, 0xff5a5a, 3, 0.5, 0.5);
      s.setText('ovSub', `Rowan falls... back to the start of Act ${run.actIndex + 1}`, cx, 56, WHITE, 1, 0.5, 0.5);
      s.setText('ovLine1', 'Tap to retry the act', cx, 76, 0xffd23a, 2, 0.5, 0.5, blink);
      hide('ovLine2', 'ovLine3');
    } else if (ph === 'victory') {
      dim(0.55);
      const since = now - s.app.phaseSince;
      s.setText('ovTitle', 'Greenmarch is saved!', cx, 32, 0xffd23a, 2, 0.5, 0.5);
      s.setText('ovSub', 'The first weight is home. Eleven to go.', cx, 50, WHITE, 1, 0.5, 0.5);
      s.setText('ovLine1', 'Next: the Frostpeaks (coming soon)', cx, 62, 0x9ad8ff, 1, 0.5, 0.5);
      s.setText('ovLine2', 'Tap to return to the title', cx, 84, 0xfff07a, 1, 0.5, 0.5, since > 1500 && blink);
      hide('ovLine3');
      // a little shower of golden sparks
      if (Math.random() < 0.5) s.fx.particles.push({ x: rand(20, GAME_W - 20), y: -2, vx: rand(-10, 10), vy: rand(20, 40), g: 30, born: now, life: 2200, color: Math.random() < 0.5 ? 0xffe680 : WHITE, size: 1, world: false, streak: false });
    } else if (ph === 'fight' && s.app.storyOverlay) {
      hide(...ov);
    } else if (ph === 'fight' && s.app.awaitingBegin) {
      hide(...ov);
      s.setText('begin', 'TAP TO BEGIN!', cx, 44, WHITE, 2, 0.5, 0.5, true);
    } else if (s.app.userPaused) {
      dim(0.55);
      s.setText('ovTitle', 'PAUSED', cx, 40, WHITE, 3, 0.5, 0.5);
      s.setText('ovSub', 'Tap to resume', cx, 60, 0xffd23a, 1, 0.5, 0.5, blink);
      hide('ovLine1', 'ovLine2', 'ovLine3');
    } else hide(...ov);
  }
}
