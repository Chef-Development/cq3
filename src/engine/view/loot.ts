// The loot screen (phase 'loot', after a fight or a treasure chest): the items burst out with a beam in their
// rarity's color, Epic and better with a sting, Legendary and Mythic with a full-screen reveal card. A tap collects
// them (they're already in the bag) and the boost pick follows.
//
// SKELETON: a plain row of item cells so far.
import type Phaser from 'phaser';
import type { FightScene } from '../scene';
import { cellIcon, itemCell, itemName, rarityText } from './items';
import { WHITE } from './shared';
import { ImagePool, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

// depths: the loot screen owns 31.6-31.95 (over the fight HUD and the bar, under the story box)
const DEPTH = 31.6;

export class LootView {
  private g!: G;
  private texts: TextPool;
  private pool: ImagePool;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, DEPTH + 0.3);
    this.pool = new ImagePool(s);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(DEPTH);
    this.pool.destroy();
  }

  onPhase(_next: string): void {}

  /** A tap on the loot screen: collect and move on to the boost pick. */
  tap(_x: number, _y: number): void {
    const app = this.s.app;
    if (performance.now() - app.phaseSince < 500) return;
    app.setPhase(() => app.run.collectLoot());
  }

  draw(_now: number): void {
    const s = this.s;
    const run = s.app.run;
    this.g.clear();
    this.texts.begin();
    this.pool.begin();
    if (run.phase === 'loot') {
      const n = run.loot.length;
      const cx = Math.round((s.L + s.R) / 2);
      this.texts.text('Loot!', cx, 24, 0xffe680, { bold: true, scale: 2, ox: 0.5, oy: 0.5 });
      run.loot.forEach((it, i) => {
        const r = { x: cx - n * 12 + i * 24 + 2, y: 40, w: 20, h: 20 };
        itemCell(this.g, r, it.rarity);
        cellIcon(this.pool, it, r, DEPTH + 0.3);
        this.texts.text(itemName(it), r.x + r.w / 2, r.y + 26 + (i % 2) * 9, rarityText(it.rarity), { ox: 0.5, oy: 0.5 });
      });
      this.texts.text('Tap to continue', cx, 90, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    }
    this.pool.end();
    this.texts.end();
  }
}
