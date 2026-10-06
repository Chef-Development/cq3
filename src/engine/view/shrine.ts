// The shrine (a camp screen: tap the shrine, unlocked now). Gems (earned only by playing) buy Rare chests here: the
// chest on its pedestal in the shrine's violet glow, its price and Buy (a bought one waits to be opened: Open goes
// straight to its reveal); beside it the odds of each rarity coming out of one (chestOdds, rising once the soft pity
// kicks in), and along the bottom the pity: "Legendary or better within N chests" and "Celestial or better within M",
// each with a bar of how close it is. No timers, no real money: just gems from playing.
import type Phaser from 'phaser';
import { TIERS, TIER_INFO } from '../../data/rarity';
import { buyRareChest, chestOdds, pityLeft } from '../../core/chests';
import { textWidth } from '../font';
import { CampKit, D } from './camp-kit';
import { star } from './loot';
import { gauge, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

/** An odds figure: "60%", "8.5%", "0.25%". */
export function oddsText(x: number): string {
  const p = x * 100;
  if (p >= 10) return `${Math.round(p)}%`;
  if (p >= 1) return `${Math.round(p * 10) / 10}%`;
  return `${Math.round(p * 100) / 100}%`;
}

export class ShrineScreen {
  private openAt = 0;
  private buyAt = -1e9;
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    this.openAt = now;
  }

  // ------------------------------------------------------------------ layout

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  /** The left column: the chest, its price and Buy / Open. */
  private left(): Rect {
    const c = this.card();
    return { x: c.x + 4, y: c.y + 4, w: 92, h: c.h - 36 };
  }

  private buyRect(): Rect {
    const l = this.left();
    return { x: l.x + 4, y: l.y + l.h - 17, w: l.w - 8, h: 15 };
  }

  private openRect(): Rect {
    const l = this.left();
    const w = textWidth('Open', 1, true) + 14;
    return { x: l.x + l.w - 3 - w, y: l.y + 3, w, h: 13 };
  }

  /** The odds column. */
  private right(): Rect {
    const c = this.card();
    const l = this.left();
    const x = l.x + l.w + 6;
    return { x, y: c.y + 4, w: c.x + c.w - 4 - x, h: l.h };
  }

  /** The pity, along the bottom. */
  private pity(): Rect {
    const c = this.card();
    return { x: c.x + 4, y: c.y + c.h - 30, w: c.w - 8, h: 26 };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | 'openRare' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    if (kit.profile.chests.rare > 0 && inRect(this.openRect(), x, y, 2)) {
      notePress(this.openRect());
      return 'openRare';
    }
    const b = this.buyRect();
    if (inRect(b, x, y, 2)) {
      notePress(b);
      this.buy(now);
    }
  }

  private buy(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const cost = Math.round(kit.tuning.chests.rareCost);
    const b = this.buyRect();
    if (!buyRareChest(p, kit.tuning)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(`Need ${cost - p.gems} more gems`, b.x + b.w / 2, b.y - 8, 0xffb0a0, { life: 1300 });
      return;
    }
    kit.commit();
    this.buyAt = now;
    kit.app.audio.shopBuy();
    const l = this.left();
    const cx = l.x + l.w / 2;
    const gt = kit.gemsTag(kit.gUi, kit.texts, kit.s.R - 3, 4, now);
    for (let i = 0; i < 6; i++) kit.fx.fly({ color: [0xf6c8ff, 0xd070ff, WHITE][i % 3], x0: gt.x + 6, y0: gt.y + 6, x1: cx + (i - 3) * 2, y1: l.y + 40, arc: 18, life: 380, delay: i * 40 });
    kit.after(420, () => {
      kit.fx.burst(cx, l.y + 40, [0x9ad8ff, 0x4aa0f0, WHITE, 0xf6c8ff], 26, 1, { kind: 'star', g: 30, life: 700 });
      kit.fx.ring(cx, l.y + 40, 24, 0x9ad8ff, 420);
      kit.fx.float('+1 Rare chest!', cx, l.y + 14, 0x9ad8ff, { life: 1500 });
      kit.app.audio.rareSting(false);
    });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const s = kit.s;
    kit.drawBack(g, now);
    kit.title(g, 'The Shrine', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.purple);
    kit.gemsTag(g, kit.texts, s.R - 3, 4, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    this.drawChest(g, now);
    this.drawOdds(g, now);
    this.drawPity(g, now);
  }

  /** The Rare chest in the shrine's glow, its price and Buy; Open when one is waiting. */
  private drawChest(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const l = this.left();
    rows(g, l.x, l.y, l.w, l.h, 2, 0x140e22, 0.8);
    const cx = Math.round(l.x + l.w / 2);
    // the shrine's violet light
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i < 2 ? 0x7a3cb0 : 0xb48ae8, (0.08 + 0.03 * pulse(now, 1600)) * (1 - i * 0.15));
      g.fillCircle(cx, l.y + 34, 26 - i * 5);
    }
    if (kit.has('camp_shrine_glow')) kit.imgs.mid('camp_shrine_glow', cx, l.y + 34, D.icons - 0.001, 0.35 + 0.15 * pulse(now, 1600));
    // the chest on a pedestal (a hop when one's just bought)
    const bk = now - this.buyAt;
    const hop = bk < 420 ? Math.round(Math.sin((bk / 420) * Math.PI) * 5) : Math.round(Math.sin(now / 500) * 1);
    const py = l.y + 46;
    rows(g, cx - 20, py - 1, 40, 6, 2, INK);
    rows(g, cx - 19, py, 38, 4, 1, 0x4a4058);
    g.fillStyle(0x8a7cc0, 1);
    g.fillRect(cx - 18, py, 36, 1);
    kit.imgs.foot('hchest_rare_closed', cx, py + 1 - Math.max(0, hop), D.icons);
    if (pulse(now, 1100) > 0.85) star(kit.gOver, cx + 12, py - 26, 1, WHITE, 1);
    texts.text('Rare chest', cx, l.y + 56, 0x9ad8ff, { bold: true, ox: 0.5, oy: 0.5 });
    if (this.buyRect().y - (l.y + 65) >= 5) texts.text('Better odds', cx, l.y + 65, 0xc8c0e8, { ox: 0.5, oy: 0.5 });
    // waiting ones: a count and Open
    const n = p.chests.rare;
    if (n > 0) {
      const o = this.openRect();
      kit.button(g, texts, o, 'Open', FACE.green, now, { glowCol: 0x8af06a });
      kit.bubble(kit.gOver, texts, o.x - 2, o.y - 2, `${n}`, now);
    }
    const cost = Math.round(kit.tuning.chests.rareCost);
    const short = p.gems < cost;
    kit.button(g, texts, this.buyRect(), 'Buy', FACE.purple, now, { cost: [{ icon: 'gem', n: cost, short }], shakeAt: this.shakeAt, glowCol: short ? undefined : 0xd070ff });
  }

  /** The odds of each rarity from one Rare chest (only the rarities it can hold), rising with the soft pity. */
  private drawOdds(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const t = kit.tuning;
    const r = this.right();
    const odds = chestOdds(t, 'rare', p.pity.rare);
    const base = chestOdds(t, 'rare', 0);
    texts.text('Odds per chest', r.x, r.y + 5, WHITE, { bold: true, oy: 0.5 });
    const rising = p.pity.rare >= t.chests.softPity;
    if (rising) {
      const w = textWidth('Rising!', 1, true) + 8;
      const tr = { x: r.x + r.w - w, y: r.y, w, h: 10 };
      tag(kit.gOver, tr, [0xffd0a0, 0xe06a2a, 0xb04a1a, 0x6a2a0a], 0.8 + 0.2 * pulse(now, 600));
      texts.text('Rising!', tr.x + w / 2, tr.y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    }
    const list = TIERS.map((tier, i) => ({ tier, x: odds[i], b: base[i] })).filter((o) => o.x > 0);
    const rowH = Math.min(10, Math.floor((r.h - 14) / Math.max(1, list.length)));
    let y = r.y + 14;
    const labelW = Math.max(...list.map((o) => textWidth(TIER_INFO[o.tier].name, 1, false))) + 14;
    const barX = r.x + labelW;
    const barW = Math.max(16, r.w - labelW - 40);
    const max = Math.max(...list.map((o) => o.x));
    list.forEach((o, i) => {
      const info = TIER_INFO[o.tier];
      const ik = clamp01((now - this.openAt - 120 - i * 50) / 160);
      const face = info.face;
      rows(g, r.x, y - 3, 7, 7, 2, INK, ik);
      rows(g, r.x + 1, y - 2, 5, 5, 1, face[1], ik);
      g.fillStyle(face[0], ik);
      g.fillRect(r.x + 2, y - 2, 2, 1);
      texts.text(info.name, r.x + 10, y + 0.5, mix(face[0], WHITE, 0.2), { oy: 0.5, alpha: ik });
      // a bar (on a root scale so the rare tiers still show) and the figure
      const frac = Math.sqrt(o.x / max);
      gauge(g, barX, y - 2, barW, 4, frac * ik, 0, { ramp: [face[0], face[1], face[2], face[3]] });
      const up = o.x > o.b * 1.001;
      texts.text(oddsText(o.x), r.x + r.w, y + 0.5, up ? 0xffc080 : WHITE, { bold: true, ox: 1, oy: 0.5, alpha: ik });
      y += rowH;
    });
  }

  /** The pity: a Legendary or better within N chests, a Celestial or better within M, each with its bar. */
  private drawPity(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const t = kit.tuning;
    const r = this.pity();
    const left = pityLeft(p, t);
    rows(g, r.x, r.y, r.w, r.h, 2, 0x140e22, 0.8);
    const lines: Array<{ tier: 'legendary' | 'celestial'; text: string; frac: number }> = [
      { tier: 'legendary', text: left.legendary === 1 ? 'Legendary or better: the next chest!' : `Legendary or better within ${left.legendary} chests`, frac: p.pity.rare / Math.max(1, t.chests.pity) },
      { tier: 'celestial', text: left.top === 1 ? 'Celestial or better: the next chest!' : `Celestial or better within ${left.top}`, frac: p.pity.top / Math.max(1, t.chests.topPity) },
    ];
    lines.forEach((l, i) => {
      const y = r.y + 7 + i * 12;
      const face = TIER_INFO[l.tier].face;
      const barW = 46;
      const tw = r.w - 12 - barW - 8;
      const text = textWidth(l.text, 1, false) <= tw ? l.text : l.text.replace(' or better', '+').replace(' chests', '');
      texts.text(text, r.x + 6, y, mix(face[0], WHITE, 0.25), { oy: 0.5 });
      const near = l.frac > 0.8;
      gauge(g, r.x + r.w - 6 - barW, y - 2, barW, 5, clamp01(l.frac), 0, { ramp: [face[0], face[1], face[2], face[3]] });
      if (near) {
        g.fillStyle(face[0], 0.25 + 0.25 * pulse(now, 700));
        g.fillRect(r.x + r.w - 7 - barW, y - 3, barW + 2, 7);
      }
    });
  }
}
