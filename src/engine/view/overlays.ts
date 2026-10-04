// Overlays and menus: title screen, boost choice, level-clear chest, defeat, pause, "TAP TO BEGIN!",
// the stage banner, and the screen flash.
import Phaser from 'phaser';
import { boostLabel, type Phase } from '../../core/run';
import type { FightScene } from '../scene';
import { buildBoard, buildCrest } from '../chrome';
import { FONT_BOLD, fontText, textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { button3d, hudIcon, iconSize, rows } from './pixels';
import { BOOST_ICON, clamp01, inRect, INK, rand, WHITE, type Rect } from './shared';

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

  constructor(private readonly s: FightScene) {}

  createTexts(): void {
    for (let i = 0; i < 6; i++) this.boostTexts.push(this.s.add.bitmapText(0, 0, FONT_BOLD, '').setDepth(32));
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
    if (next === 'levelClear') {
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

  /** Level clear: the first tap bursts the chest open (returns true = consumed); the next one moves on. */
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
      s.setText('ovSub', 'Working title - feel prototype', cx, 53, 0xffe680, 1, 0.5, 0.5);
      g.fillStyle(INK, 0.55);
      g.fillRect(0, 62, GAME_W, 22);
      g.fillStyle(INK, 0.3);
      g.fillRect(0, 61, GAME_W, 1);
      g.fillRect(0, 84, GAME_W, 1);
      s.setText('ovLine1', 'Tap when the line is on a block', cx, 68, WHITE, 1, 0.5, 0.5);
      s.setText('ovLine2', 'Tap red to block - avoid purple', cx, 78, 0xff9a80, 1, 0.5, 0.5);
      s.setText('ovLine3', 'TAP TO START!', cx, 97, WHITE, 2, 0.5, 0.5, blink);
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
      s.setText('ovTitle', 'CHOOSE A BOOST', cx, p.y + 10, WHITE, 1, 0.5, 0.5);
      run.boostChoices.forEach((id, i) => {
        const r = this.cardRect(i);
        button3d(gc, r, [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26]);
        // icon well
        rows(gc, r.x + 4, r.y + 4, 20, r.h - 7, 2, 0x2a8a2e);
        gc.fillStyle(0x1e6a24, 1);
        gc.fillRect(r.x + 5, r.y + 4, 18, 1);
        const [iw, ih] = iconSize(BOOST_ICON[id]);
        hudIcon(gc, BOOST_ICON[id], r.x + 4 + ((20 - iw) >> 1), r.y + 4 + ((r.h - 7 - ih) >> 1));
        const [name, val] = boostLabel(s.app.tuning, id);
        const a = this.boostTexts[i * 2];
        const b = this.boostTexts[i * 2 + 1];
        a.setText(fontText(name)).setPosition(r.x + 29, r.y + 10).setTint(WHITE).setOrigin(0, 0.5).setScale(1).setVisible(true);
        b.setText(fontText(val)).setPosition(r.x + 29, r.y + 19).setTint(0xfff07a).setOrigin(0, 0.5).setScale(1).setVisible(true);
      });
    } else if (ph === 'levelClear') {
      const opened = !!this.chestOpenAt;
      s.setText('ovTitle', opened ? `${run.level.name} clear!` : 'Treasure Chest', cx, 28, opened ? 0xffd23a : WHITE, 2, 0.5, 0.5);
      s.setText('ovLine1', opened ? 'Tap to continue' : 'Tap the chest to continue', cx, 44, WHITE, 1, 0.5, 0.5, opened ? blink : true);
      hide('ovSub', 'ovLine2', 'ovLine3');
    } else if (ph === 'defeat') {
      dim(0.65);
      s.setText('ovTitle', 'DEFEATED', cx, 38, 0xff5a5a, 3, 0.5, 0.5);
      s.setText('ovSub', 'Rowan falls...', cx, 56, WHITE, 1, 0.5, 0.5);
      s.setText('ovLine1', 'Tap to retry level', cx, 76, 0xffd23a, 2, 0.5, 0.5, blink);
      hide('ovLine2', 'ovLine3');
    } else if (s.app.awaitingBegin) {
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
