// Map node screens: the campfire (rest), the shop and events. (Treasure uses the chest in overlays.ts.)
import type Phaser from 'phaser';
import { eventById } from '../../data/events';
import { heroMaxHp } from '../../core/combat';
import { boostLabel, type ShopItem } from '../../core/run';
import type { FightScene } from '../scene';
import { buildBoard } from '../chrome';
import { textWidth } from '../font';
import { button3d, hudIcon, iconSize, rows } from './pixels';
import { BOOST_ICON, clamp01, inRect, INK, rand, WHITE, type Rect } from './shared';
import { CARD } from './overlays';
import { darkPanel, FACE, parchment, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

export class NodeScreens {
  private g!: G;
  private board: Phaser.GameObjects.Image | null = null;
  private boardKey = '';
  private texts: TextPool;
  private shake: number[] = [];
  private restAt = 0; // anim time the rest started (0 = not yet)
  private bought: Array<{ i: number; at: number }> = [];

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(31.4);
    this.board?.destroy();
    this.board = null;
    this.boardKey = '';
  }

  onPhase(next: string): void {
    this.restAt = 0;
    this.shake = [];
    this.bought = [];
    if (next === 'event') this.s.app.audio.eventSting();
  }

  /** A wooden board of this size, created on demand (each screen has its own size). */
  private useBoard(r: Rect): void {
    const key = `board_node_${r.w}x${r.h}`;
    if (this.boardKey !== key) {
      buildBoard(this.s, key, r.w, r.h);
      this.board?.destroy();
      this.board = this.s.add.image(0, 0, key).setOrigin(0, 0).setDepth(31.2);
      this.boardKey = key;
    }
    this.board!.setPosition(r.x, r.y).setVisible(true);
  }

  // ------------------------------------------------------------------ layout

  private restButton(): Rect {
    const s = this.s;
    return { x: Math.round((s.L + s.R) / 2 - 40), y: 50, w: 80, h: 20 };
  }

  private shopBoard(): Rect {
    const s = this.s;
    const w = Math.min(250, s.R - s.L - 8);
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: 6, w, h: 134 };
  }

  private shopRow(i: number): Rect {
    const b = this.shopBoard();
    return { x: b.x + 8, y: b.y + 22 + i * 18, w: b.w - 16, h: 16 };
  }

  private leaveButton(): Rect {
    const b = this.shopBoard();
    return { x: b.x + b.w - 66, y: b.y + b.h - 20, w: 58, h: 15 };
  }

  private eventBoard(): Rect {
    const s = this.s;
    const w = Math.min(276, s.R - s.L - 6);
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: 20, w, h: 116 };
  }

  private eventButton(i: number): Rect {
    const b = this.eventBoard();
    return { x: b.x + 14, y: b.y + 64 + i * 22, w: b.w - 28, h: 18 };
  }

  // ------------------------------------------------------------------ taps

  /** A tap on a node screen (x < 0: the keyboard's default action). */
  tap(x: number, y: number): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const key = x < 0;
    if (run.phase === 'rest') {
      if (this.restAt || !(key || inRect(this.restButton(), x, y, 4))) return;
      this.restAt = s.anim;
      const H = run.hero;
      const heal = Math.min(heroMaxHp(run.tuning, H) - H.hp, Math.round(heroMaxHp(run.tuning, H) * run.tuning.map.restHeal));
      app.audio.restHeal();
      const f = s.fighters.h;
      f.flashUntil = s.anim + 300;
      f.flashColor = 0x9af0a0;
      s.fx.iconFloat(f.x + 2, s.ground - 46, `+${heal}`, 0x9af06a, 'heart');
      s.fx.burst(f.x, s.ground - 16, 0x9af0a0, 16, true, 0.9);
      s.later(750, () => {
        if (app.run.phase === 'rest') app.setPhase(() => app.run.rest());
      });
    } else if (run.phase === 'shop') {
      if (key || inRect(this.leaveButton(), x, y, 3)) {
        app.audio.uiClick();
        app.setPhase(() => run.leaveShop());
        return;
      }
      for (let i = 0; i < run.shop.length; i++) {
        if (!inRect(this.shopRow(i), x, y, 1)) continue;
        if (run.buy(i)) {
          app.audio.shopBuy();
          this.bought.push({ i, at: performance.now() });
          const r = this.shopRow(i);
          s.fx.burst(r.x + r.w - 20, r.y + r.h / 2, 0xffe680, 12, false, 1.1, true);
          s.hud.coinsShown = run.coins;
          app.saveRun();
        } else {
          app.audio.uiClick();
          this.shake[i] = performance.now();
        }
        return;
      }
    } else if (run.phase === 'event') {
      const ev = run.event;
      if (!ev) return;
      if (ev.outcome >= 0) {
        if (key || inRect(this.eventButton(1), x, y, 3)) {
          app.audio.uiClick();
          app.setPhase(() => run.endEvent());
        }
        return;
      }
      const def = eventById(ev.id);
      for (let i = 0; i < (def?.choices.length ?? 0); i++) {
        if (!(key ? i === 0 : inRect(this.eventButton(i), x, y, 2))) continue;
        const coins = run.coins;
        const hp = run.hero.hp;
        if (run.chooseEvent(i)) {
          const o = def!.choices[i].outcomes[run.event!.outcome];
          if (o.coins && run.coins > coins) app.audio.coin();
          else if (run.hero.hp > hp || o.maxHp) app.audio.heal();
          else if (run.hero.hp < hp) app.audio.hurt();
          else app.audio.uiClick();
          s.hud.coinsShown = run.coins;
          app.saveRun();
        } else {
          app.audio.uiClick();
          this.shake[i] = performance.now();
        }
        return;
      }
    }
  }

  // ------------------------------------------------------------------ drawing

  private hide(): void {
    this.g.clear();
    this.board?.setVisible(false);
    this.texts.hide();
  }

  draw(now: number): void {
    const ph = this.s.app.run.phase;
    if (ph !== 'rest' && ph !== 'shop' && ph !== 'event') return this.hide();
    const g = this.g;
    g.clear();
    this.texts.begin();
    if (ph === 'rest') this.drawRest(g, now);
    else if (ph === 'shop') this.drawShop(g, now);
    else this.drawEvent(g, now);
    this.texts.end();
  }

  /** A campfire between Rowan and the right edge, and a Rest button. */
  private drawRest(g: G, now: number): void {
    const s = this.s;
    this.board?.setVisible(false);
    const run = s.app.run;
    const cx = Math.round(s.heroHome + 52);
    const base = s.ground;
    const a = s.anim;
    // warm glow
    for (const [r, al] of [
      [34, 0.08],
      [22, 0.12],
      [13, 0.16],
    ] as const) {
      g.fillStyle(0xffa040, al + 0.02 * Math.sin(a / 90));
      g.fillCircle(cx, base - 6, r + Math.sin(a / 70) * 1.5);
    }
    // logs
    rows(g, cx - 12, base - 4, 24, 5, 2, INK);
    rows(g, cx - 11, base - 3, 22, 3, 1, 0x6e4020);
    g.fillStyle(0xb07a44, 1);
    g.fillRect(cx - 10, base - 3, 20, 1);
    rows(g, cx - 8, base - 6, 16, 4, 1, INK);
    g.fillStyle(0x8e5a2e, 1);
    g.fillRect(cx - 7, base - 5, 14, 2);
    // flames: three tongues flickering
    for (const [dx, h0, ph] of [
      [-4, 9, 0],
      [0, 14, 1.7],
      [4, 10, 3.1],
    ] as const) {
      const h = Math.round(h0 + Math.sin(a / 60 + ph) * 2 + Math.sin(a / 23 + ph) * 1);
      g.fillStyle(0xe8441a, 1);
      g.fillRect(cx + dx - 2, base - 5 - h, 5, h);
      g.fillStyle(0xff9a2a, 1);
      g.fillRect(cx + dx - 1, base - 6 - h + 2, 3, h - 1);
      g.fillStyle(0xfff0a0, 1);
      g.fillRect(cx + dx, base - 6 - h + 5, 1, Math.max(1, h - 5));
    }
    if (Math.random() < 0.3) s.fx.particles.push({ x: cx + rand(-4, 4), y: base - 16, vx: rand(-6, 6), vy: rand(-30, -18), g: 0, born: now, life: rand(400, 800), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, size: 1, world: true, streak: false });
    // the board
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const heal = Math.min(max - H.hp, Math.round(max * run.tuning.map.restHeal));
    const pr = { x: Math.round((s.L + s.R) / 2 - 80), y: 8, w: 160, h: 70 };
    darkPanel(g, pr, 0x2a1e30);
    this.texts.text('Campfire', pr.x + pr.w / 2, pr.y + 12, 0xffd23a, { bold: true, scale: 1, ox: 0.5, oy: 0.5 });
    this.texts.text(`Rest: heal ${Math.round(run.tuning.map.restHeal * 100)}% of max HP (+${heal})`, pr.x + pr.w / 2, pr.y + 26, WHITE, { ox: 0.5, oy: 0.5 });
    this.texts.text(`HP ${H.hp}/${max}`, pr.x + pr.w / 2, pr.y + 35, 0xff9a9a, { ox: 0.5, oy: 0.5 });
    const b = this.restButton();
    const done = this.restAt > 0;
    button3d(g, b, done ? FACE.grey : FACE.green, done);
    this.texts.text(done ? 'Resting...' : 'Rest', b.x + b.w / 2, b.y + b.h / 2 + (done ? 1 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
  }

  private drawShop(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    g.fillStyle(0x05040a, 0.45);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    const b = this.shopBoard();
    this.useBoard(b);
    g.fillStyle(0x3e1e0a, 1);
    g.fillRect(b.x + 4, b.y + 17, b.w - 8, 1);
    g.fillStyle(0xc48a52, 1);
    g.fillRect(b.x + 4, b.y + 18, b.w - 8, 1);
    this.texts.text('Shop', b.x + 10, b.y + 9, WHITE, { bold: true, oy: 0.5 });
    hudIcon(g, 'coin', b.x + b.w - 44, b.y + 4);
    this.texts.text(`${run.coins}`, b.x + b.w - 32, b.y + 9, 0xffe680, { bold: true, oy: 0.5 });
    run.shop.forEach((item, i) => this.shopItem(g, item, i, now));
    const lb = this.leaveButton();
    button3d(g, lb, FACE.grey);
    this.texts.text('Leave', lb.x + lb.w / 2, lb.y + lb.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    if (run.rerolls > 0) this.texts.text(`Rerolls: ${run.rerolls}`, b.x + 10, lb.y + lb.h / 2, 0x9ad8ff, { oy: 0.5 });
  }

  private shopItem(g: G, item: ShopItem, i: number, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const shook = now - (this.shake[i] ?? -1e9);
    const r0 = this.shopRow(i);
    const r = { ...r0, x: r0.x + (shook < 240 ? Math.round(Math.sin(shook / 20) * 2) : 0) };
    const afford = run.coins >= item.price;
    const face = item.sold ? FACE.grey : item.kind === 'boost' && item.offer ? CARD[item.offer.rarity].face : item.kind === 'potion' ? FACE.red : FACE.blue;
    button3d(g, r, face, item.sold);
    let name: string;
    let val: string;
    let icon: string;
    if (item.kind === 'boost' && item.offer) {
      [name, val] = boostLabel(run.tuning, item.offer);
      icon = BOOST_ICON[item.offer.id];
      if (item.offer.rarity !== 'common') val += item.offer.rarity === 'epic' ? '  EPIC' : '  RARE';
    } else if (item.kind === 'potion') {
      name = 'Potion';
      val = `Heal ${Math.round(run.tuning.map.potionHeal * 100)}% HP`;
      icon = 'potion';
    } else {
      name = 'Reroll';
      val = 'Redraw a boost pick';
      icon = 'bolt';
    }
    const [iw, ih] = iconSize(icon);
    hudIcon(g, icon, r.x + 4 + ((12 - iw) >> 1), r.y + ((r.h - ih) >> 1));
    this.texts.text(name, r.x + 20, r.y + r.h / 2, WHITE, { bold: true, oy: 0.5 });
    this.texts.text(val, r.x + 24 + textWidth(name, 1, true), r.y + r.h / 2 + 1, 0xfff07a, { oy: 0.5 });
    // price tag on the right
    const tagW = 34;
    const tx = r.x + r.w - tagW - 3;
    rows(g, tx, r.y + 2, tagW, r.h - 4, 2, item.sold ? 0x3e4254 : 0x2a1608, 0.85);
    if (item.sold) this.texts.text('Sold', tx + tagW / 2, r.y + r.h / 2, 0xc8ccd8, { bold: true, ox: 0.5, oy: 0.5 });
    else {
      hudIcon(g, 'coin', tx + 2, r.y + 3);
      this.texts.text(`${item.price}`, tx + tagW - 3, r.y + r.h / 2, afford ? 0xffe680 : 0xff6a5a, { bold: true, ox: 1, oy: 0.5 });
    }
    const b = this.bought.find((x) => x.i === i);
    if (b) {
      const k = clamp01((now - b.at) / 400);
      if (k < 1) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, WHITE, 0.6 * (1 - k));
    }
  }

  private drawEvent(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const ev = run.event;
    const def = ev ? eventById(ev.id) : undefined;
    g.fillStyle(0x05040a, 0.45);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    const b = this.eventBoard();
    this.useBoard(b);
    if (!ev || !def) return;
    const note = { x: b.x + 6, y: b.y + 18, w: b.w - 12, h: 40 };
    parchment(g, note);
    this.texts.text(def.title, b.x + b.w / 2, b.y + 9, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const done = ev.outcome >= 0;
    const body = done ? def.choices[ev.choice].outcomes[ev.outcome].text : def.text;
    body.split('\n').forEach((line, i) => this.texts.text(line, note.x + 7, note.y + 13 + i * 11, done ? 0x7a2a10 : 0x4a2a12, { oy: 0.5 }));
    if (done) {
      const r = this.eventButton(1);
      button3d(g, r, FACE.green);
      this.texts.text('Continue', r.x + r.w / 2, r.y + r.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      if (ev.boost) this.texts.text('A boost pick awaits!', b.x + b.w / 2, this.eventButton(0).y + 9, 0x9ad8ff, { bold: true, ox: 0.5, oy: 0.5 });
      return;
    }
    def.choices.forEach((c, i) => {
      const shook = now - (this.shake[i] ?? -1e9);
      const r0 = this.eventButton(i);
      const r = { ...r0, x: r0.x + (shook < 240 ? Math.round(Math.sin(shook / 20) * 2) : 0) };
      const ok = run.coins >= (c.cost ?? 0);
      button3d(g, r, ok ? (i === 0 ? FACE.gold : FACE.wood) : FACE.grey);
      this.texts.text(c.label, r.x + r.w / 2, r.y + r.h / 2, ok ? WHITE : 0xc8ccd8, { bold: true, ox: 0.5, oy: 0.5 });
      if (!ok) this.texts.text(`need ${c.cost}`, r.x + r.w - 6, r.y + r.h / 2, 0xff9a8a, { ox: 1, oy: 0.5 });
    });
  }
}
