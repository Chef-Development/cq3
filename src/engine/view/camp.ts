// The camp (phase 'camp'): Rowan and Pip at a campfire, with buildings to tap: the Bag (inventory, compare, equip,
// lock), the Forge (Mags the smith: upgrade, reroll, salvage) and the Shrine (locked, coming soon). Tapping Rowan
// shows his stats (4 core stats, a page with all 10). "Back" returns where the camp was opened from.
//
// SKELETON: only the backdrop and the Back button so far.
import type Phaser from 'phaser';
import type { FightScene } from '../scene';
import { button3d } from './pixels';
import { inRect, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

// depths: the camp owns 30.95-31.35 (over the maps, under the node screens, the overlays and the story box)
const DEPTH = 30.95;

export class CampView {
  private g!: G;
  private bg: Phaser.GameObjects.Image | null = null;
  private texts: TextPool;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, DEPTH + 0.35);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(DEPTH + 0.2);
    this.bg?.destroy();
    this.bg = this.s.add.image(0, 0, 'camp_bg').setOrigin(0, 0).setDepth(DEPTH).setVisible(false);
  }

  onPhase(_next: string): void {}

  private backButton(): Rect {
    const s = this.s;
    return { x: s.R - 52, y: s.B - 18, w: 48, h: 14 };
  }

  /** A tap on the camp (x < 0: the keyboard's default action). */
  tap(x: number, y: number): void {
    const app = this.s.app;
    const b = this.backButton();
    if (x < 0 || inRect(b, x, y, 3)) {
      notePress(b);
      app.audio.uiClick();
      app.leaveCamp();
    }
  }

  draw(now: number): void {
    const s = this.s;
    if (s.app.run.phase !== 'camp') {
      this.g.clear();
      this.bg?.setVisible(false);
      this.texts.hide();
      return;
    }
    this.g.clear();
    this.texts.begin();
    this.bg?.setVisible(true);
    this.texts.text('Camp', s.L + 6, 8, WHITE, { bold: true, oy: 0.5 });
    const b = this.backButton();
    button3d(this.g, b, FACE.navy, isPressed(b, now));
    this.texts.text('Back', b.x + b.w / 2, b.y + b.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    this.texts.end();
  }
}
