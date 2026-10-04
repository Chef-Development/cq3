// Story scenes: the speaker's portrait in a frame standing on a text box, a name plate, the text typing itself
// out, a blinking "next" arrow and a Skip button. Tap: finish the box, then the next box. Used for the run's
// scenes (Run phase 'scene') and for a boss's scene in the middle of a fight (App.storyOverlay).
import type Phaser from 'phaser';
import { SPEAKER_NAME, STORY } from '../../data/story';
import type { Speaker } from '../../data/types';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { button3d, rows } from './pixels';
import { inRect, INK, WHITE, type Rect } from './shared';
import { darkPanel, FACE, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** Characters per second the text types out at. */
const TYPE_CPS = 55;
/** Speakers whose portrait stands on the left (the heroes and the narrator); villains stand on the right. */
const LEFT: Speaker[] = ['narrator', 'rowan', 'pip'];

export class StoryView {
  private g!: G;
  private portrait: Phaser.GameObjects.Image | null = null;
  private texts: TextPool;
  private key = '';
  private boxAt = 0;
  private revealAll = false;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32.5);
  }

  /** New layout: the graphics and portrait image go with the old textures. */
  build(): void {
    this.g?.destroy();
    this.portrait?.destroy();
    this.g = this.s.add.graphics().setDepth(32.2);
    this.portrait = this.s.add.image(0, 0, 'portrait_rowan').setOrigin(0.5, 1).setDepth(32.3).setVisible(false);
  }

  private skipRect(): Rect {
    return { x: this.s.R - 44, y: 4, w: 38, h: 14 };
  }

  storySkipAt(x: number, y: number): boolean {
    return !!this.s.app.storyId && inRect(this.skipRect(), x, y, 4);
  }

  /** A tap while the box is still typing shows all of it (returns true: the tap is used up). */
  reveal(): boolean {
    const box = this.box();
    if (!box || this.revealAll || this.typed(performance.now()) >= box.text.length) return false;
    this.revealAll = true;
    return true;
  }

  private box() {
    const id = this.s.app.storyId;
    return id ? STORY[id]?.[this.s.app.storyBox] : undefined;
  }

  private typed(now: number): number {
    return this.revealAll ? Infinity : Math.floor(((now - this.boxAt) / 1000) * TYPE_CPS);
  }

  draw(now: number): void {
    const s = this.s;
    const g = this.g;
    g.clear();
    this.texts.begin();
    const id = s.app.storyId;
    const box = this.box();
    if (!id || !box) {
      this.portrait?.setVisible(false);
      this.texts.end();
      return;
    }
    const key = `${id}:${s.app.storyBox}`;
    if (key !== this.key) {
      this.key = key;
      this.boxAt = now;
      this.revealAll = false;
    }
    const W = s.R - s.L;
    // the world dims behind the scene (a mid-fight scene keeps the fight visible)
    g.fillStyle(INK, s.app.storyOverlay ? 0.35 : 0.45);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);

    // text box along the bottom
    const bx = s.L + 4;
    const bw = W - 8;
    const bh = 38;
    const by = s.B - bh - 3;
    darkPanel(g, { x: bx, y: by, w: bw, h: bh }, 0x1e1630);

    // portrait in a frame standing on the box
    const left = LEFT.includes(box.who);
    const fw = 46;
    const fx = left ? bx + 6 : bx + bw - fw - 6;
    const fy = by - fw + 9;
    const typing = this.typed(now) < box.text.length;
    rows(g, fx - 1, fy + 1, fw + 2, fw + 2, 3, INK, 0.45);
    rows(g, fx - 1, fy - 1, fw + 2, fw + 2, 3, INK);
    rows(g, fx, fy, fw, fw, 2, 0xd8901c);
    rows(g, fx + 1, fy + 1, fw - 2, fw - 2, 2, 0x9a5a14);
    rows(g, fx + 2, fy + 2, fw - 4, fw - 4, 1, box.who === 'narrator' ? 0x2a2440 : left ? 0x2a4a6a : 0x4a2a3a);
    g.fillStyle(WHITE, 0.08);
    g.fillRect(fx + 3, fy + 3, fw - 6, Math.round((fw - 6) / 2));
    const bob = typing && Math.floor(now / 140) % 2 === 0 ? 1 : 0;
    this.portrait
      ?.setTexture(`portrait_${box.who}`)
      .setPosition(Math.round(fx + fw / 2), fy + fw - 2 - bob)
      .setVisible(true)
      .setCrop(0, 0, 1000, 1000);
    // keep the portrait inside its frame
    if (this.portrait) {
      const p = this.portrait;
      const over = Math.max(0, p.height - (fw - 4));
      p.setCrop(0, over, p.width, p.height - over);
    }

    // name plate on the box's top edge, beside the portrait
    const name = SPEAKER_NAME[box.who];
    if (name) {
      const nw = textWidth(name, 1, true) + 12;
      const nx = left ? fx + fw + 4 : fx - nw - 4;
      darkPanel(g, { x: nx, y: by - 8, w: nw, h: 14 }, 0x3a2a52);
      this.texts.text(name, nx + nw / 2, by - 1, left ? 0xfff07a : 0xff9a80, { bold: true, ox: 0.5, oy: 0.5 });
    }

    // the text types itself out
    let left2 = this.typed(now);
    box.text.split('\n').forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, left2));
      left2 -= line.length + 1;
      if (shown.length) this.texts.text(shown, bx + 9, by + 14 + i * 11, WHITE, { oy: 0.5 });
    });
    if (!typing && Math.floor(now / 380) % 2 === 0) {
      // next: a little gold arrow in the corner
      const ax = bx + bw - 12;
      const ay = by + bh - 10;
      g.fillStyle(INK, 1);
      g.fillRect(ax - 1, ay - 1, 7, 5);
      g.fillStyle(0xf2c230, 1);
      g.fillRect(ax, ay, 5, 1);
      g.fillRect(ax + 1, ay + 1, 3, 1);
      g.fillRect(ax + 2, ay + 2, 1, 1);
    }
    // where we are in the scene: one dot per box
    const n = STORY[id].length;
    for (let i = 0; i < n; i++) {
      g.fillStyle(i === s.app.storyBox ? 0xf2c230 : 0x5a4a7a, 1);
      g.fillRect(bx + bw - 14 - (n - 1 - i) * 4 - 6, by + 5, 2, 2);
    }

    // Skip
    const sr = this.skipRect();
    button3d(g, sr, FACE.grey);
    this.texts.text('Skip', sr.x + sr.w / 2, sr.y + sr.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    this.texts.end();
  }
}
