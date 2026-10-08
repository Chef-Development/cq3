// Story scenes: the speaker's portrait in a gold frame standing on a navy text box, a ribbon name plate, the
// text typing itself out (with a caret), a bouncing "next" arrow, progress pips and a Skip button. The box
// slides up when a scene starts; a new speaker's portrait slides in from their side. Tap: finish the box, then
// the next box. Used for the run's scenes (Run phase 'scene') and for a boss's scene in the middle of a fight
// (App.storyOverlay).
import type Phaser from 'phaser';
import { SPEAKER_NAME, STORY } from '../../data/story';
import type { Speaker } from '../../data/types';
import type { FightScene } from '../scene';
import { isAshArtKey } from '../art-ash';
import { textWidth } from '../font';
import { band, button3d, chevron, GOLD, NAVY, panel, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, ribbon, RIBBON, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** Characters per second the text types out at. */
const TYPE_CPS = 55;
/** Speakers whose portrait stands on the left (the heroes, Pip and the narrator); villains stand on the right. */
const LEFT: Speaker[] = [
  'narrator', 'rowan', 'pip', 'sable', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva',
  // part6:A
  // part6:B
  'yara', 'dell',
  // part6:C
  // part6:D
];
/** Friends who aren't heroes (Mags the smith): on the right like a villain, but in warm forge colors. */
const ALLY: Speaker[] = ['smith'];
/** Portrait backdrop [top, bottom] and name ribbon per side. */
const LOOK = {
  narrator: { bg: [0x3a3060, 0x1e1836], ribbon: RIBBON.purple, name: 0xf0e0ff },
  hero: { bg: [0x3a6aa8, 0x1a2c52], ribbon: RIBBON.blue, name: 0xfff07a },
  foe: { bg: [0x8a2a3a, 0x3a1020], ribbon: RIBBON.red, name: 0xffe0c0 },
  ally: { bg: [0xa8642a, 0x3e2014], ribbon: RIBBON.green, name: 0xfff6c0 },
} as const;

export class StoryView {
  private g!: G;
  private portrait: Phaser.GameObjects.Image | null = null;
  private texts: TextPool;
  private key = '';
  private boxAt = 0;
  private revealAll = false;
  private sceneKey = '';
  private sceneAt = 0;
  private who: Speaker | null = null;
  private whoAt = 0;

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
    const hit = !!this.s.app.storyId && inRect(this.skipRect(), x, y, 4);
    if (hit) notePress(this.skipRect());
    return hit;
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
      this.sceneKey = '';
      this.texts.end();
      return;
    }
    const key = `${id}:${s.app.storyBox}`;
    if (key !== this.key) {
      this.key = key;
      this.boxAt = now;
      this.revealAll = false;
    }
    if (id !== this.sceneKey) {
      this.sceneKey = id;
      this.sceneAt = now;
      this.who = null;
    }
    if (box.who !== this.who) {
      this.who = box.who;
      this.whoAt = now;
    }
    const W = s.R - s.L;
    const inK = easeBack((now - this.sceneAt) / 280, 1.3);
    const lift = Math.round((1 - inK) * 60);
    // the world dims behind the scene (a mid-fight scene keeps the fight visible), darker toward the bottom
    const dimA = (s.app.storyOverlay ? 0.3 : 0.4) * clamp01((now - this.sceneAt) / 160);
    g.fillStyle(INK, dimA);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(INK, dimA * 0.35);
      g.fillRect(0, s.B - 24 - i * 10, s.R + s.L + 1000, 24 + i * 10 + 200);
    }

    // text box along the bottom
    const bx = s.L + 4;
    const bw = W - 8;
    const bh = 38;
    const by = s.B - bh - 3 + lift;
    panel(g, { x: bx, y: by, w: bw, h: bh }, { trim: 'full' });

    // portrait in a gold frame standing on the box; a new speaker slides in from their side
    const left = LEFT.includes(box.who);
    const look = box.who === 'narrator' ? LOOK.narrator : left ? LOOK.hero : ALLY.includes(box.who) ? LOOK.ally : LOOK.foe;
    const fw = 46;
    const wk = easeBack((now - this.whoAt) / 240, 1.6);
    const slide = Math.round((1 - wk) * (left ? -26 : 26));
    const fx = (left ? bx + 6 : bx + bw - fw - 6) + slide;
    const fy = by - fw + 9;
    const typing = this.typed(now) < box.text.length;
    rows(g, fx - 1, fy + 2, fw + 2, fw + 1, 3, INK, 0.5);
    rows(g, fx - 1, fy - 1, fw + 2, fw + 2, 3, INK);
    rows(g, fx, fy, fw, fw, 2, GOLD[2]);
    band(g, fx, fy, fw, fw, 2, 0, 1, GOLD[4]);
    g.fillStyle(GOLD[3], 1);
    g.fillRect(fx, fy + 2, 1, fw - 4);
    band(g, fx, fy, fw, fw, 2, fw - 1, fw, GOLD[0]);
    g.fillStyle(GOLD[1], 1);
    g.fillRect(fx + fw - 1, fy + 2, 1, fw - 4);
    rows(g, fx + 2, fy + 2, fw - 4, fw - 4, 1, INK);
    const [bgTop, bgBot] = look.bg;
    g.fillStyle(bgBot, 1);
    g.fillRect(fx + 3, fy + 3, fw - 6, fw - 6);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(mix(bgBot, bgTop, (i + 1) / 4), 1);
      g.fillRect(fx + 3, fy + 3 + i * 5, fw - 6, 5);
    }
    // a soft light behind the head
    g.fillStyle(WHITE, 0.08);
    g.fillCircle(fx + fw / 2, fy + fw / 2 - 2, 14);
    g.fillStyle(WHITE, 0.06);
    g.fillCircle(fx + fw / 2, fy + fw / 2 - 2, 9);
    const bob = typing && Math.floor(now / 140) % 2 === 0 ? 1 : 0;
    if (this.portrait) {
      // the third region's speakers are painted in idle time after boot: finish them now if this scene comes sooner
      if (!this.s.textures.exists(`portrait_${box.who}`) && isAshArtKey(`portrait_${box.who}`)) this.s.ensureAshArt();
      const p = this.portrait.setTexture(`portrait_${box.who}`).setPosition(Math.round(fx + fw / 2), fy + fw - 3 - bob).setVisible(true);
      // keep the portrait inside its frame
      const over = Math.max(0, p.height - (fw - 6));
      p.setCrop(0, over, p.width, p.height - over);
    }
    // gold corner studs on the frame
    g.fillStyle(GOLD[4], 1);
    for (const [px, py] of [
      [fx + 1, fy + 1],
      [fx + fw - 2, fy + 1],
    ])
      g.fillRect(px, py, 1, 1);

    // name ribbon on the box's top edge, beside the portrait
    const name = SPEAKER_NAME[box.who];
    if (name) {
      const nw = textWidth(name, 1, true) + 14;
      const ncx = left ? fx + fw + 6 + nw / 2 : fx - 6 - nw / 2;
      ribbon(g, ncx, by - 6, nw, 11, look.ribbon, 1, false);
      this.texts.text(name, ncx, by - 0.5, look.name, { bold: true, ox: 0.5, oy: 0.5 });
    }

    // the text types itself out, with a caret at the end
    let left2 = this.typed(now);
    let caret: { x: number; y: number } | null = null;
    box.text.split('\n').forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, left2));
      left2 -= line.length + 1;
      const ty = by + 15 + i * 11;
      if (shown.length) this.texts.text(shown, bx + 9, ty, WHITE, { oy: 0.5 });
      if (typing && shown.length < line.length && !caret) caret = { x: bx + 9 + (shown.length ? textWidth(shown, 1, false) : 1), y: ty };
    });
    const cr = caret as { x: number; y: number } | null;
    if (cr && Math.floor(now / 200) % 2 === 0) {
      g.fillStyle(GOLD[3], 1);
      g.fillRect(cr.x, cr.y - 3, 2, 6);
    }
    if (!typing) {
      // next: a gold chevron bouncing in the corner
      const ax = bx + bw - 13;
      const ay = by + bh - 12 + (Math.floor(now / 160) % 4 < 2 ? 0 : 1);
      chevron(g, ax, ay, 7, GOLD[3], 1, 1, true);
      chevron(g, ax + 4, ay, 7, GOLD[4], 1, 1, true);
    }
    // where we are in the scene: a pip per box, the current one a longer gold pill
    const n = STORY[id].length;
    let px = bx + bw - 8;
    for (let i = n - 1; i >= 0; i--) {
      const cur = i === s.app.storyBox;
      const w = cur ? 6 : 2;
      px -= w;
      g.fillStyle(INK, 1);
      g.fillRect(px - 1, by + 4, w + 2, 4);
      g.fillStyle(cur ? GOLD[3] : i < s.app.storyBox ? NAVY[7] : NAVY[5], 1);
      g.fillRect(px, by + 5, w, 2);
      px -= 2;
    }

    // Skip
    const sr = this.skipRect();
    const pressed = isPressed(sr, now);
    button3d(g, sr, FACE.navy, pressed);
    this.texts.text('Skip', sr.x + 5, sr.y + sr.h / 2 + (pressed ? 2 : 0), WHITE, { bold: true, oy: 0.5 });
    chevron(g, sr.x + sr.w - 10, sr.y + 4 + (pressed ? 2 : 0), 5, GOLD[3], 1, 1, false);
    chevron(g, sr.x + sr.w - 7, sr.y + 4 + (pressed ? 2 : 0), 5, GOLD[4], 1, 1, false);
    this.texts.end();
  }
}
