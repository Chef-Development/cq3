// Small UI helpers for the menu screens (map, story, shop, events): a pool of bitmap texts reused every frame,
// and a few drawing shortcuts in the game's chrome style (ink outline, rounded corners, bevelled rims).
import type Phaser from 'phaser';
import type { FightScene } from '../scene';
import { FONT, FONT_BOLD, fontText } from '../font';
import { rows } from './pixels';
import { INK, tintGrad, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Bitmap texts handed out in draw order each frame; the ones not used this frame are hidden. */
export class TextPool {
  private items: Phaser.GameObjects.BitmapText[] = [];
  private used = 0;

  constructor(
    private readonly s: FightScene,
    private readonly depth = 32,
  ) {}

  begin(): void {
    this.used = 0;
  }

  text(str: string, x: number, y: number, color = WHITE, o: { scale?: number; ox?: number; oy?: number; bold?: boolean; alpha?: number } = {}): Phaser.GameObjects.BitmapText {
    let t = this.items[this.used];
    if (!t) {
      t = this.s.add.bitmapText(0, 0, FONT_BOLD, '').setDepth(this.depth);
      this.items.push(t);
    }
    this.used++;
    t.setFont(o.bold ? FONT_BOLD : FONT)
      .setText(fontText(str))
      .setPosition(Math.round(x), Math.round(y))
      .setScale(o.scale ?? 1)
      .setOrigin(o.ox ?? 0, o.oy ?? 0)
      .setAlpha(o.alpha ?? 1)
      .setVisible(true);
    tintGrad(t, color);
    return t;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }
}

/** A dark panel with a gold inner line (story text box, name plates). */
export function darkPanel(g: G, r: Rect, fill = 0x231a33, alpha = 1): void {
  rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 2, 3, INK, 0.45 * alpha);
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK, alpha);
  rows(g, r.x, r.y, r.w, r.h, 2, 0x4a3c66, alpha);
  rows(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 2, fill, alpha);
  g.fillStyle(0xd8901c, alpha);
  g.fillRect(r.x + 3, r.y + 2, r.w - 6, 1);
  g.fillRect(r.x + 3, r.y + r.h - 3, r.w - 6, 1);
  g.fillRect(r.x + 2, r.y + 3, 1, r.h - 6);
  g.fillRect(r.x + r.w - 3, r.y + 3, 1, r.h - 6);
  g.fillStyle(0xf2c230, alpha);
  for (const [x, y] of [
    [r.x + 2, r.y + 2],
    [r.x + r.w - 3, r.y + 2],
    [r.x + 2, r.y + r.h - 3],
    [r.x + r.w - 3, r.y + r.h - 3],
  ])
    g.fillRect(x, y, 1, 1);
}

/** Parchment fill (the map, event notes) with darker edges. */
export function parchment(g: G, r: Rect, speckles: Array<[number, number, number]> = []): void {
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, 0x6a4a2a);
  rows(g, r.x, r.y, r.w, r.h, 2, 0xe2c992);
  g.fillStyle(0xecd8aa, 1);
  g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  g.fillStyle(0xf4e6c0, 1);
  g.fillRect(r.x + 6, r.y + 5, r.w - 12, r.h - 10);
  g.fillStyle(0xd2b47a, 1);
  g.fillRect(r.x + 1, r.y + r.h - 3, r.w - 2, 2);
  g.fillRect(r.x + r.w - 3, r.y + 1, 2, r.h - 2);
  for (const [x, y, c] of speckles) {
    g.fillStyle(c, 1);
    g.fillRect(r.x + x, r.y + y, 1, 1);
  }
}

/** Faces for menu buttons: [hi, base, lo, deep]. */
export const FACE = {
  green: [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26],
  gold: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14],
  red: [0xff9a8a, 0xe0463c, 0xb02a2a, 0x7a1a1a],
  grey: [0x8a90a6, 0x6e7488, 0x585e72, 0x3e4254],
  blue: [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a],
  wood: [0xd6a066, 0xa86c40, 0x8a5230, 0x52280e],
} as const;
