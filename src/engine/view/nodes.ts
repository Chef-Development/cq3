// Map node screens: the campfire (rest), the shop and events. (Treasure uses the chest in overlays.ts.)
// Navy panels with a ribbon header pop in with a little overshoot; rows and buttons stagger in after them.
// The campfire keeps the stage clear: its controls sit on the console under it.
// The shop sells three cards (mostly relics), a potion and a reroll. A relic's row shows its icon, name, tags and
// its text when it fits; a tap on the row opens its card (the full text, Buy or Back), a tap on the price buys.
// Prices come from the run (Gold Fever raises them; under Haggler the first buy reads "Free!").
import type Phaser from 'phaser';
import { eventById } from '../../data/events';
import { relicById } from '../../data/relics';
import { hpNow, pct, signed, signedPct, whole } from '../../core/format';
import { heroMaxHp } from '../../core/combat';
import { relicText } from '../../core/relics';
import { boostLabel, boostPreview, isRelicOffer, type BoostPreview, type ShopItem } from '../../core/run';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { band, button3d, gauge, glow, GOLD, hudIcon, iconSize, NAVY, panel, RAMP, rows } from './pixels';
import { BOOST_ICON, clamp01, easeBack, hpLabel, inRect, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { CARD, previewLine, previewWidth } from './overlays';
import { chipWidth, relicCard, relicIcon, tagChip } from './relic-ui';
import { FACE, ImagePool, isPressed, notePress, parchment, ribbon, RIBBON, tag, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

export class NodeScreens {
  private g!: G;
  private texts: TextPool;
  private shake: number[] = [];
  private restAt = 0; // anim time the rest started (0 = not yet)
  private bought: Array<{ i: number; at: number }> = [];
  private phaseAt = 0;
  private lastPhase = '';
  /** Relic icons in the shop rows (over the board, under the texts). */
  private pool: ImagePool;
  /** The shop's relic card open on top of the board (its item index; null = none), and when it opened. */
  detail: number | null = null;
  private detailAt = 0;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32);
    this.pool = new ImagePool(s);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(31.4);
    this.pool.destroy();
  }

  onPhase(next: string): void {
    this.restAt = 0;
    this.shake = [];
    this.bought = [];
    this.detail = null;
    if (next === 'event') this.s.app.audio.eventSting();
  }

  // ------------------------------------------------------------------ layout

  /** The campfire's Rest button, on the console under the stage. */
  private restButton(): Rect {
    const s = this.s;
    return { x: s.R - 92, y: s.splitY + 6, w: 84, h: 20 };
  }

  private shopBoard(): Rect {
    const s = this.s;
    const w = Math.min(270, s.R - s.L - 6);
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: 23, w, h: 117 };
  }

  /** Shop rows: the cards one per row (two lines tall), then the potion and the reroll side by side. */
  shopRow(i: number): Rect {
    const b = this.shopBoard();
    const item = this.s.app.run.shop[i];
    const cards = this.s.app.run.shop.filter((x) => x.kind === 'boost').length;
    if (item?.kind === 'boost') return { x: b.x + 8, y: b.y + 11 + i * 24, w: b.w - 16, h: 21 };
    const y = b.y + 11 + cards * 24;
    // (the travelling merchant sells no reroll: her potion has the row to itself)
    const half = this.s.app.run.shop.some((x) => x.kind === 'reroll') ? Math.floor((b.w - 16 - 6) / 2) : b.w - 16;
    return item?.kind === 'potion' ? { x: b.x + 8, y, w: half, h: 14 } : { x: b.x + b.w - 8 - half, y, w: half, h: 14 };
  }

  /** The price tag at a row's right end (a tap there buys at once). */
  private priceTag(r: Rect): Rect {
    return { x: r.x + r.w - 38, y: r.y + 2, w: 36, h: r.h - 4 };
  }

  private leaveButton(): Rect {
    const b = this.shopBoard();
    return { x: b.x + b.w - 64, y: b.y + b.h - 17, w: 56, h: 12 };
  }

  /** The relic card opened from a row, and its Back and Buy buttons under it. */
  detailRects(): { card: Rect; back: Rect; buy: Rect } {
    const b = this.shopBoard();
    const w = Math.min(244, b.w - 20);
    const card: Rect = { x: Math.round(b.x + b.w / 2 - w / 2), y: b.y + 30, w, h: 33 };
    const y = card.y + card.h + 10;
    return { card, back: { x: card.x + card.w / 2 - 92, y, w: 72, h: 16 }, buy: { x: card.x + card.w / 2 - 12, y, w: 104, h: 16 } };
  }

  /** Buy shop item `i` (the coin burst, the save), or shake its row when it can't be bought. */
  private buyItem(i: number): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const r = this.shopRow(i);
    if (run.buy(i)) {
      app.audio.shopBuy();
      this.bought.push({ i, at: performance.now() });
      s.fx.burst(r.x + r.w - 20, r.y + r.h / 2, 0xffe680, 12, false, 1.1, true);
      s.hud.coinsShown = run.coins;
      app.saveRun();
    } else {
      app.audio.uiClick();
      this.shake[i] = performance.now();
    }
  }

  private eventBoard(): Rect {
    const s = this.s;
    const w = Math.min(276, s.R - s.L - 6);
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: 24, w, h: 110 };
  }

  private eventButton(i: number): Rect {
    const b = this.eventBoard();
    return { x: b.x + 14, y: b.y + 60 + i * 22, w: b.w - 28, h: 17 };
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
      notePress(this.restButton());
      this.restAt = s.anim;
      const H = run.hero;
      const heal = Math.min(heroMaxHp(run.tuning, H) - H.hp, Math.round(heroMaxHp(run.tuning, H) * run.restShare));
      app.audio.restHeal();
      const f = s.fighters.h;
      f.flashUntil = s.anim + 300;
      f.flashColor = 0x9af0a0;
      s.fx.iconFloat(f.x + 2, s.ground - 46, signed(Math.max(1, heal)), 0x9af06a, 'heart');
      s.fx.burst(f.x, s.ground - 16, 0x9af0a0, 16, true, 0.9);
      s.later(750, () => {
        if (app.run.phase === 'rest') app.setPhase(() => app.run.rest());
      });
    } else if (run.phase === 'shop') {
      if (this.detail !== null) {
        // the relic card: Buy, or Back (a tap anywhere else closes it too)
        const d = this.detailRects();
        const i = this.detail;
        if (performance.now() - this.detailAt < 200) return;
        this.detail = null;
        if (!key && inRect(d.buy, x, y, 3) && !run.shop[i]?.sold) {
          notePress(d.buy);
          this.buyItem(i);
        } else {
          if (inRect(d.back, x, y, 3)) notePress(d.back);
          app.audio.panelClose();
        }
        return;
      }
      if (key || inRect(this.leaveButton(), x, y, 3)) {
        notePress(this.leaveButton());
        app.audio.uiClick();
        app.setPhase(() => run.leaveShop());
        return;
      }
      for (let i = 0; i < run.shop.length; i++) {
        const r = this.shopRow(i);
        if (!inRect(r, x, y, 1)) continue;
        const item = run.shop[i];
        // a relic's row opens its card (its whole text); its price tag buys straight away
        if (item.offer && isRelicOffer(item.offer) && (item.sold || !inRect(this.priceTag(r), x, y, 2))) {
          this.detail = i;
          this.detailAt = performance.now();
          app.audio.panelOpen();
          return;
        }
        notePress(r);
        this.buyItem(i);
        return;
      }
    } else if (run.phase === 'event') {
      const ev = run.event;
      if (!ev) return;
      if (ev.outcome >= 0) {
        if (key || inRect(this.eventButton(1), x, y, 3)) {
          notePress(this.eventButton(1));
          app.audio.uiClick();
          app.setPhase(() => run.endEvent());
        }
        return;
      }
      const def = eventById(ev.id);
      for (let i = 0; i < (def?.choices.length ?? 0); i++) {
        if (!(key ? i === 0 : inRect(this.eventButton(i), x, y, 2))) continue;
        notePress(this.eventButton(i));
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
    this.texts.hide();
    this.pool.hide();
  }

  draw(now: number): void {
    const ph = this.s.app.run.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.phaseAt = now;
    }
    if (ph !== 'rest' && ph !== 'shop' && ph !== 'event') return this.hide();
    const g = this.g;
    g.clear();
    this.texts.begin();
    this.pool.begin();
    if (ph === 'rest') this.drawRest(g, now);
    else if (ph === 'shop') this.drawShop(g, now);
    else this.drawEvent(g, now);
    this.texts.end();
    this.pool.end();
  }

  /** A panel that pops in: grows from 80% with a little overshoot. Returns the rect to draw this frame. */
  private popIn(r: Rect, now: number): { r: Rect; k: number } {
    const k = easeBack((now - this.phaseAt) / 240, 1.5);
    const sc = 0.8 + 0.2 * k;
    return { r: { x: Math.round(r.x + (r.w * (1 - sc)) / 2), y: Math.round(r.y + (r.h * (1 - sc)) / 2), w: Math.round(r.w * sc), h: Math.round(r.h * sc) }, k };
  }

  /** The dim behind a node board. */
  private dim(g: G, a: number): void {
    const s = this.s;
    g.fillStyle(0x05040a, a);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
  }

  /** A slim item card: ink outline, a colored rim, navy body, an icon tile in the rim's colors. */
  private itemCard(g: G, r: Rect, face: readonly [number, number, number, number], icon: string, dim: boolean): void {
    const [hi, base, lo, deep] = face;
    rows(g, r.x - 1, r.y + 3, r.w + 2, r.h, 3, INK, 0.45);
    rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, INK);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, dim ? NAVY[4] : base);
    band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, 0, 1, dim ? NAVY[5] : hi);
    rows(g, r.x, r.y, r.w, r.h, 1, NAVY[3]);
    band(g, r.x, r.y, r.w, r.h, 1, 0, Math.round(r.h * 0.45), NAVY[4]);
    band(g, r.x, r.y, r.w, r.h, 1, r.h - 2, r.h, NAVY[2]);
    const tile: Rect = { x: r.x + 1, y: r.y + 1, w: 16, h: r.h - 2 };
    rows(g, tile.x, tile.y, tile.w, tile.h, 1, dim ? NAVY[5] : lo);
    band(g, tile.x, tile.y, tile.w, tile.h, 1, 0, Math.round(tile.h * 0.5), dim ? NAVY[6] : base);
    band(g, tile.x, tile.y, tile.w, tile.h, 1, tile.h - 1, tile.h, dim ? NAVY[2] : deep);
    if (!icon) return;
    const [iw, ih] = iconSize(icon);
    hudIcon(g, icon, tile.x + ((tile.w - iw) >> 1), tile.y + ((tile.h - ih) >> 1), 1, dim ? 0.5 : 1);
  }

  /** A campfire between Rowan and the right edge; the Rest controls sit on the console under the stage. */
  private drawRest(g: G, now: number): void {
    const s = this.s;
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

    // header ribbon over the scene
    const since = now - this.phaseAt;
    const hk = easeBack(since / 300, 1.6);
    const mid = Math.round((s.L + s.R) / 2);
    ribbon(g, mid, 22 - Math.round((1 - hk) * 30), 86, 12, RIBBON.red);
    this.texts.text('Campfire', mid, 28.5 - Math.round((1 - hk) * 30), 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5 });

    // the console: HP now and after resting on the left, the Rest button on the right
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const heal = Math.min(max - H.hp, Math.round(max * run.restShare));
    const dy = Math.round((1 - easeBack((since - 80) / 300, 1.4)) * 30);
    const y0 = s.splitY + 6 + dy;
    const px = s.L + 8;
    hudIcon(g, 'heart', px, y0 + 2);
    const gw = Math.max(60, Math.min(120, this.restButton().x - px - 26 - 12));
    const done = this.restAt > 0;
    const preview = (H.hp + (done ? 0 : heal)) / max;
    // the heal preview pulses green past the current fill
    gauge(g, px + 18, y0 + 4, gw, 8, preview, preview, { ramp: [0xd8ffc0, 0x9af06a, 0x5ab040, 0x2e7a2a], seg: Math.round(gw / 10) });
    g.fillStyle(WHITE, 0.25 + 0.25 * pulse(now, 700));
    const cw = Math.round(gw * (H.hp / max));
    const pw = Math.round(gw * preview);
    if (pw > cw) g.fillRect(px + 18 + cw, y0 + 4, pw - cw, 8);
    gauge(g, px + 18, y0 + 4, Math.max(1, cw), 8, 1, 1, { ramp: RAMP.hp });
    this.texts.text(hpLabel(H.hp, max), px + 18 + gw / 2, y0 + 8, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    this.texts.text(heal > 0 ? `Rest: ${signed(Math.max(1, heal))} HP (${pct(run.restShare)} of max)` : 'Already at full HP', px + 18, y0 + 18, heal > 0 ? 0xb4f070 : 0xc8c0e8, { oy: 0.5 });
    const b = { ...this.restButton(), y: this.restButton().y + dy };
    if (!done) glow(g, b, 0x8af06a, 0.35 + 0.35 * pulse(now, 900), 3);
    button3d(g, b, done ? FACE.grey : FACE.green, done || isPressed(this.restButton(), now));
    this.texts.text(done ? 'Resting...' : 'Rest', b.x + b.w / 2, b.y + b.h / 2 + (done ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
  }

  private drawShop(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    this.dim(g, 0.5);
    const { r: b, k } = this.popIn(this.shopBoard(), now);
    panel(g, b, { trim: 'full', alpha: clamp01(k * 2) });
    if (k < 0.98) return;
    // the travelling merchant's small shop has her own banner
    const title = run.merchant ? 'Trader' : 'Shop';
    ribbon(g, b.x + b.w / 2, b.y - 6, 70, 12, run.merchant ? RIBBON.blue : RIBBON.green);
    this.texts.text(title, b.x + b.w / 2, b.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    // the purse: a gold tag on the panel's corner
    const cw = textWidth(whole(run.coins), 1, true) + 15;
    const cr: Rect = { x: b.x + b.w - cw - 6, y: b.y - 5, w: cw, h: 11 };
    tag(g, cr, [GOLD[4], GOLD[2], GOLD[1], GOLD[0]]);
    hudIcon(g, 'coin', cr.x + 2, cr.y + 1);
    this.texts.text(whole(run.coins), cr.x + 12, cr.y + 5.5, WHITE, { bold: true, oy: 0.5 });
    const since = now - this.phaseAt;
    // a relic's card open: it alone on the board
    if (this.detail !== null) return this.drawDetail(g, now);
    run.shop.forEach((item, i) => this.shopItem(g, item, i, now, since));
    const lb = this.leaveButton();
    button3d(g, lb, FACE.navy, isPressed(lb, now));
    this.texts.text('Leave', lb.x + lb.w / 2, lb.y + lb.h / 2 + (isPressed(lb, now) ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    if (run.rerolls > 0) this.texts.text(`Rerolls: ${run.rerolls}`, b.x + 10, lb.y + lb.h / 2, 0x9ad8ff, { oy: 0.5 });
    else if (run.shopFree) this.texts.text('Haggler: your first buy is free!', b.x + 10, lb.y + lb.h / 2, 0x9af06a, { oy: 0.5 });
  }

  /** A relic's card over the board (its whole text), with Back and Buy (the price, or "Free!") under it. */
  private drawDetail(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const i = this.detail ?? -1;
    const item = run.shop[i];
    if (!item?.offer || !isRelicOffer(item.offer)) return void (this.detail = null);
    const k = easeBack((now - this.detailAt) / 220, 1.6);
    const d = this.detailRects();
    const dy = Math.round((1 - Math.min(1, k)) * 10);
    relicCard({ s, g, texts: this.texts, pool: this.pool, depth: 31.45 }, { ...d.card, y: d.card.y + dy }, item.offer.relic, { owned: run.hero.relics, tuning: run.tuning, now, alpha: clamp01(k * 1.5) });
    if (k < 0.9) return;
    const back = d.back;
    button3d(g, back, FACE.navy, isPressed(back, now));
    this.texts.text('Back', back.x + back.w / 2, back.y + back.h / 2 + (isPressed(back, now) ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const buy = d.buy;
    if (item.sold) {
      button3d(g, buy, FACE.grey, true);
      this.texts.text('Owned', buy.x + buy.w / 2, buy.y + buy.h / 2 + 2, 0xd0c8e8, { bold: true, ox: 0.5, oy: 0.5 });
      return;
    }
    const price = run.priceOf(item);
    const ok = run.coins >= price;
    const pr = isPressed(buy, now);
    if (ok) glow(g, buy, 0xffd23a, 0.3 + 0.3 * pulse(now, 900), 3);
    button3d(g, buy, ok ? (price === 0 ? FACE.green : FACE.gold) : FACE.grey, pr);
    const dy2 = pr ? 2 : 0;
    if (price === 0) this.texts.text('Take it!', buy.x + buy.w / 2, buy.y + buy.h / 2 + dy2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    else {
      const label = 'Buy';
      const pw = textWidth(whole(price), 1, true);
      const w = textWidth(label, 1, true) + 4 + 10 + pw;
      const x0 = Math.round(buy.x + buy.w / 2 - w / 2);
      this.texts.text(label, x0, buy.y + buy.h / 2 + dy2, ok ? 0x3a1e08 : 0xc8ccd8, { bold: true, oy: 0.5 });
      hudIcon(g, 'coin', x0 + textWidth(label, 1, true) + 4, buy.y + 3 + dy2);
      this.texts.text(whole(price), x0 + textWidth(label, 1, true) + 14, buy.y + buy.h / 2 + dy2, ok ? 0x3a1e08 : 0xff8a7a, { bold: true, oy: 0.5 });
    }
  }

  private shopItem(g: G, item: ShopItem, i: number, now: number, since: number): void {
    const s = this.s;
    const run = s.app.run;
    const shook = now - (this.shake[i] ?? -1e9);
    const ck = easeBack((since - 140 - i * 50) / 240, 1.4);
    if (ck <= 0) return;
    const r0 = this.shopRow(i);
    const pressed = isPressed(r0, now) ? 1 : 0;
    const r = { ...r0, x: r0.x + Math.round((1 - ck) * 60) + (shook < 240 ? Math.round(Math.sin(shook / 20) * 2) : 0), y: r0.y + pressed };
    const price = run.priceOf(item);
    const afford = run.coins >= price;
    const face = item.kind === 'boost' && item.offer ? CARD[item.offer.rarity].face : item.kind === 'potion' ? FACE.red : FACE.blue;
    const alpha = item.sold ? 0.5 : 1;
    const relic = item.offer && isRelicOffer(item.offer) ? relicById(item.offer.relic) : undefined;
    // the price tag on the right: a dark slot with the coin and the price, "Free!" (Haggler), or a SOLD stamp
    const pt = this.priceTag(r);
    const tx = pt.x;
    const drawPrice = () => {
      if (item.sold) {
        tag(g, pt, [NAVY[6], NAVY[4], NAVY[3], NAVY[2]]);
        this.texts.text(relic ? 'OWNED' : 'SOLD', pt.x + pt.w / 2, r.y + r.h / 2, 0xd0c8e8, { bold: !relic, ox: 0.5, oy: 0.5 });
      } else if (price === 0) {
        glow(g, pt, 0x8af06a, 0.3 + 0.3 * pulse(now, 700), 2);
        tag(g, pt, FACE.green);
        this.texts.text('Free!', pt.x + pt.w / 2, r.y + r.h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      } else {
        rows(g, pt.x, pt.y, pt.w, pt.h, 2, NAVY[0]);
        band(g, pt.x, pt.y, pt.w, pt.h, 2, 0, 1, INK);
        hudIcon(g, 'coin', pt.x + 2, Math.round(r.y + r.h / 2 - 5));
        this.texts.text(whole(price), pt.x + pt.w - 3, r.y + r.h / 2, afford ? 0xffe680 : 0xff6a5a, { bold: true, ox: 1, oy: 0.5 });
      }
    };
    if (relic) {
      // a relic: its icon, name and tags; under them its text when it fits on the line, else a hint to open its card
      this.itemCard(g, r, face, '', item.sold);
      relicIcon(s, this.pool, g, relic.id, r.x + 3, r.y + Math.round((r.h - 12) / 2), 31.45, alpha);
      const nx = r.x + 21;
      this.texts.text(relic.name, nx, r.y + 1, WHITE, { bold: true, alpha });
      let cx = nx + textWidth(relic.name, 1, true) + 4;
      const named = cx + relic.tags.reduce((sum, t) => sum + chipWidth(t) + 3, 0) <= tx - 4;
      for (const t of relic.tags) cx += tagChip(s, g, this.texts, this.pool, t, cx, r.y + 2, 31.45, { name: named, alpha, hot: false }) + 3;
      const text = relicText(run.tuning, relic.id);
      const room = tx - 4 - nx;
      if (textWidth(text) <= room) this.texts.text(text, nx, r.y + 11, 0xe0dcf4, { alpha });
      else {
        this.texts.text('Tap to read', nx, r.y + 11, 0x9ad8ff, { alpha });
        // a little "i" badge after it
        const bx = nx + textWidth('Tap to read') + 3;
        rows(g, bx, r.y + 12, 7, 7, 2, 0x2a62c8, alpha);
        g.fillStyle(WHITE, alpha);
        g.fillRect(bx + 3, r.y + 13, 1, 1);
        g.fillRect(bx + 3, r.y + 15, 1, 3);
      }
      if (relic.rarity !== 'common' && !item.sold) {
        const rare = relic.rarity === 'epic' ? 'EPIC' : 'RARE';
        const rw = textWidth(rare, 1, false) + 6;
        tag(g, { x: tx - rw - 4, y: r.y + 11, w: rw, h: 8 }, face);
        this.texts.text(rare, tx - rw - 1, r.y + 15, WHITE, { oy: 0.5 });
      }
      drawPrice();
    } else {
      let name: string;
      let val = '';
      let icon: string;
      // boosts (and the potion) show what they'd do to the hero right now: "ATK 14 -> 16", "HP 60 -> 100"
      let preview: BoostPreview | null = null;
      // (a sold row keeps its plain label: the hero already has it, so a preview would count it twice)
      if (item.kind === 'boost' && item.offer) {
        [name, val] = boostLabel(run.tuning, item.offer);
        if (!item.sold) preview = boostPreview(run.tuning, run.hero, item.offer);
        icon = BOOST_ICON[item.offer.id];
      } else if (item.kind === 'potion') {
        name = 'Potion';
        const H = run.hero;
        const max = heroMaxHp(run.tuning, H);
        const after = Math.min(max, H.hp + Math.round(max * run.tuning.map.potionHeal));
        if (item.sold) val = `${signedPct(run.tuning.map.potionHeal)} HP`;
        else if (after > H.hp) preview = { stat: 'HP', before: hpNow(H.hp, max), after: hpNow(after, max) };
        else val = 'At full HP'; // ("HP full" read as "heals to full")
        // a half row too tight for "100 -> 130": the share it heals
        if (preview && r.x + 25 + textWidth(name, 1, true) + previewWidth(preview) > tx - 4) {
          preview = null;
          val = signedPct(run.tuning.map.potionHeal);
        }
        icon = 'potion';
      } else {
        name = 'Reroll';
        val = 'a pick';
        icon = 'bolt';
      }
      this.itemCard(g, r, face, icon, item.sold);
      const rare = item.kind === 'boost' && item.offer && item.offer.rarity !== 'common' && !item.sold ? (item.offer.rarity === 'epic' ? 'EPIC' : 'RARE') : '';
      const rareW = rare ? textWidth(rare, 1, false) + 6 : 0;
      const cy = r.y + r.h / 2;
      this.texts.text(name, r.x + 21, cy, WHITE, { bold: true, oy: 0.5, alpha });
      let vx = r.x + 25 + textWidth(name, 1, true);
      const valCol = item.sold ? 0xa8a0c8 : mix(face[0], WHITE, 0.3);
      if (preview) {
        // the stat's name is dropped when the row is too tight for it (the boost's name says it anyway)
        const room = tx - 4 - vx - (rare ? rareW + 4 : 0);
        const stat = preview.stat !== name && previewWidth(preview) <= room;
        vx += previewLine(g, this.texts, preview, vx, cy, item.sold ? 0xa8a0c8 : item.offer?.rarity === 'common' || !item.offer ? 0xb4f070 : mix(face[0], WHITE, 0.3), alpha, stat);
      } else if (vx + textWidth(val) <= tx - 3) {
        this.texts.text(val, vx, cy + 1, valCol, { oy: 0.5, alpha });
        vx += textWidth(val, 1, false);
      }
      if (rare) {
        tag(g, { x: vx + 4, y: Math.round(cy - 5), w: rareW, h: 10 }, face);
        this.texts.text(rare, vx + 7, cy, WHITE, { oy: 0.5 });
      }
      drawPrice();
    }
    const bt = this.bought.find((x) => x.i === i);
    if (bt) {
      const k = clamp01((now - bt.at) / 400);
      if (k < 1) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, WHITE, 0.6 * (1 - k));
    }
  }

  private drawEvent(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const ev = run.event;
    const def = ev ? eventById(ev.id) : undefined;
    this.dim(g, 0.5);
    const { r: b, k } = this.popIn(this.eventBoard(), now);
    panel(g, b, { trim: 'full', alpha: clamp01(k * 2) });
    if (!ev || !def || k < 0.98) return;
    const tw = textWidth(def.title, 1, true) + 22;
    ribbon(g, b.x + b.w / 2, b.y - 6, tw, 12, RIBBON.blue);
    this.texts.text(def.title, b.x + b.w / 2, b.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const note = { x: b.x + 6, y: b.y + 12, w: b.w - 12, h: 40 };
    parchment(g, note);
    const done = ev.outcome >= 0;
    const body = done ? def.choices[ev.choice].outcomes[ev.outcome].text : def.text;
    body.split('\n').forEach((line, i) => this.texts.text(line, note.x + 7, note.y + 13 + i * 11, done ? 0x7a2a10 : 0x4a2a12, { oy: 0.5 }));
    const since = now - this.phaseAt;
    if (done) {
      const r = this.eventButton(1);
      glow(g, r, 0x8af06a, 0.3 + 0.3 * pulse(now, 900), 3);
      button3d(g, r, FACE.green, isPressed(r, now));
      this.texts.text('Continue', r.x + r.w / 2, r.y + r.h / 2 + (isPressed(r, now) ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      if (ev.boost) this.texts.text('A boost pick is next!', b.x + b.w / 2, this.eventButton(0).y + 8, 0x9ad8ff, { bold: true, ox: 0.5, oy: 0.5 });
      return;
    }
    def.choices.forEach((c, i) => {
      const ck = easeBack((since - 160 - i * 60) / 240, 1.4);
      if (ck <= 0) return;
      const shook = now - (this.shake[i] ?? -1e9);
      const r0 = this.eventButton(i);
      const r = { ...r0, x: r0.x + Math.round((1 - ck) * 50) + (shook < 240 ? Math.round(Math.sin(shook / 20) * 2) : 0) };
      const ok = run.coins >= (c.cost ?? 0);
      const pr = isPressed(r0, now);
      button3d(g, r, ok ? (i === 0 ? FACE.gold : FACE.navy) : FACE.grey, pr);
      this.texts.text(c.label, r.x + r.w / 2, r.y + r.h / 2 + (pr ? 2 : 0), ok ? WHITE : 0xc8ccd8, { bold: true, ox: 0.5, oy: 0.5 });
      if (c.cost) {
        const cw = textWidth(whole(c.cost), 1, true) + 14;
        const cr: Rect = { x: r.x + r.w - cw - 4, y: r.y + 3 + (pr ? 2 : 0), w: cw, h: r.h - 6 };
        rows(g, cr.x, cr.y, cr.w, cr.h, 2, NAVY[0], 0.8);
        hudIcon(g, 'coin', cr.x + 1, cr.y + ((cr.h - 9) >> 1));
        this.texts.text(whole(c.cost), cr.x + 11, cr.y + cr.h / 2, ok ? 0xffe680 : 0xff8a7a, { bold: true, oy: 0.5 });
      }
    });
  }
}
