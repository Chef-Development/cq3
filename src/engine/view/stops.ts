// The bounty board (a side quest's stop on the act map): a notice pinned on a navy board, the goal's icon big, the
// goal in one short line and what it pays (an item, coins, a relic pick), "Take it" or "Pass". Taking it puts the
// tiny tracker on the map (view/map-roam.ts). Pops in like the other node screens (view/nodes.ts).
import type Phaser from 'phaser';
import { signed } from '../../core/format';
import { questById } from '../../data/quests';
import { RARITY_INFO } from '../../data/gear';
import { questText } from '../../core/quests';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { bagPal, glyph, glyphSize } from './overlays';
import { button3d, glow, hudIcon, iconSize, panel } from './pixels';
import { clamp01, easeBack, inRect, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, parchment, ribbon, RIBBON, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

export class StopScreens {
  private g!: G;
  private texts: TextPool;
  private phaseAt = 0;
  private lastPhase = '';

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(31.4);
  }

  private board(): Rect {
    const s = this.s;
    const w = Math.min(250, s.R - s.L - 6);
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: 26, w, h: 92 };
  }

  /** Take it (0, left) and Pass (1, right), under the notice. */
  button(i: number): Rect {
    const b = this.board();
    const w = Math.round((b.w - 28 - 8) / 2);
    return { x: b.x + 14 + i * (w + 8), y: b.y + b.h - 24, w, h: 17 };
  }

  /** A tap on the bounty board (x < 0: the keyboard takes the quest). */
  tap(x: number, y: number): void {
    const app = this.s.app;
    const run = app.run;
    if (run.phase !== 'bounty') return;
    for (const i of [0, 1]) {
      if (!(x < 0 ? i === 0 : inRect(this.button(i), x, y, 3))) continue;
      notePress(this.button(i));
      if (i === 0) app.audio.shopBuy();
      else app.audio.uiClick();
      app.setPhase(() => (i === 0 ? run.takeQuest() : run.passQuest()));
      return;
    }
  }

  draw(now: number): void {
    const s = this.s;
    const ph = s.app.run.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.phaseAt = now;
    }
    if (ph !== 'bounty') {
      this.g.clear();
      this.texts.hide();
      return;
    }
    const g = this.g;
    g.clear();
    this.texts.begin();
    this.drawBoard(g, now);
    this.texts.end();
  }

  private drawBoard(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const def = questById(run.bountyOffer ?? '');
    g.fillStyle(0x05040a, 0.5);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    const b0 = this.board();
    const k = easeBack((now - this.phaseAt) / 240, 1.5);
    const sc = 0.8 + 0.2 * k;
    const b: Rect = { x: Math.round(b0.x + (b0.w * (1 - sc)) / 2), y: Math.round(b0.y + (b0.h * (1 - sc)) / 2), w: Math.round(b0.w * sc), h: Math.round(b0.h * sc) };
    panel(g, b, { trim: 'full', alpha: clamp01(k * 2) });
    if (!def || k < 0.98) return;
    const T = this.texts;
    ribbon(g, b.x + b.w / 2, b.y - 6, Math.max(96, textWidth(def.title, 1, true) + 24), 12, RIBBON.red);
    T.text(def.title, b.x + b.w / 2, b.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    // the notice: the goal's icon big on the left, the goal, and what it pays
    const note: Rect = { x: b.x + 8, y: b.y + 11, w: b.w - 16, h: 44 };
    parchment(g, note);
    const [iw, ih] = iconSize(def.icon);
    const bob = Math.round(Math.sin(now / 400));
    hudIcon(g, def.icon, note.x + 8, note.y + Math.round((note.h - ih * 2) / 2) + bob, 2);
    const tx = note.x + 8 + iw * 2 + 8;
    T.text(questText(run.tuning, def), tx, note.y + 13, 0x4a2a12, { bold: true, oy: 0.5 });
    // the reward: an icon and one word
    const ry = note.y + 30;
    T.text('Reward', tx, ry, 0x5a3a1e, { oy: 0.5 });
    const rx = tx + textWidth('Reward', 1, false) + 5;
    if (def.reward === 'gear') {
      const [gw, gh] = glyphSize('bag');
      glyph(g, 'bag', rx, ry - Math.round(gh / 2), 1, bagPal(RARITY_INFO.rare.face));
      T.text('Rare gear', rx + gw + 3, ry, 0x2a5ac0, { bold: true, oy: 0.5 });
    } else if (def.reward === 'coins') {
      const [cw, ch] = glyphSize('coin');
      glyph(g, 'coin', rx, ry - Math.round(ch / 2));
      T.text(signed(run.tuning.quests.coins * (run.actIndex + 1)), rx + cw + 3, ry, 0x9a5a14, { bold: true, oy: 0.5 });
    } else {
      const [sw, sh] = iconSize('star');
      hudIcon(g, 'star', rx, ry - Math.round(sh / 2));
      T.text('Relic pick', rx + sw + 3, ry, 0x6e30a8, { bold: true, oy: 0.5 });
    }
    // Take it / Pass
    const since = now - this.phaseAt;
    (['Take it', 'Pass'] as const).forEach((label, i) => {
      const ck = easeBack((since - 160 - i * 60) / 240, 1.4);
      if (ck <= 0) return;
      const r0 = this.button(i);
      const r = { ...r0, x: r0.x + Math.round((1 - ck) * 40) };
      const pr = isPressed(r0, now);
      if (i === 0) glow(g, r, 0xffd23a, 0.3 + 0.3 * pulse(now, 900), 3);
      button3d(g, r, i === 0 ? FACE.gold : FACE.navy, pr);
      T.text(label, r.x + r.w / 2, r.y + r.h / 2 + (pr ? 2 : 0), i === 0 ? 0x3a1e08 : WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    });
  }
}
