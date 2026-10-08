// The shrine (a camp screen: tap the shrine): a place, not a table. A great mossy stone arch under the night sky, its
// runes breathing violet light, candles burning at its feet and a brazier at each side; a purple crystal floats
// under its keystone and lights the altar in front of it, where the Rare chest hovers, bobbing in that light (the
// 'shrine' stage and its live parts: art-shrine.ts).
//
// The pity is a crystal vial beside the altar that fills with light toward the guaranteed Legendary ("8 left"
// under it), the top pity (a Celestial or better) a thinner vial beside it; a tap on them says it in words. The odds
// of each rarity are behind the "i" (a sheet with a bar per tier, rising once the soft pity kicks in). One big action
// under the altar: Open, with its gem price: it pays and opens the chest right there (the opening: chest-opening.ts);
// a Rare chest already waiting opens free first. Short of gems, it shakes and says how many are missing. Gems come
// only from playing: no timers, no real money.
import { odds, whole } from '../../core/format';
import type Phaser from 'phaser';
import { TIERS, TIER_INFO, tierIndex } from '../../data/rarity';
import { buyRareChest, chestOdds, pityLeft } from '../../core/chests';
import { ALTAR_H, ALTAR_TOP, SHRINE_ARCH, SHRINE_CANDLES, SHRINE_LANTERNS, VIALS } from '../art-shrine';
import { BIG_CHEST } from '../art-chests';
import { textWidth } from '../font';
import { CampKit, D } from './camp-kit';
import { chestOpening, FxImages, type ChestOpening } from './chest-opening';
import { star } from './loot';
import { gauge, rows } from './pixels';
import { clamp01, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';
import { bigButton, countBadge, drawStage, enterK, fillEllipse, infoButton, popK, Sheet, spotlight, vignette } from './ui-modern';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

/** An odds figure: "60%", "8.5%", "0.3%", "<0.1%" (at most one decimal: core/format.ts odds; it printed "0.25%"). */
export const oddsText = (x: number): string => odds(x);

const SPIRIT = 0xb48ae8;
const FLAME = [0xd8401c, 0xffb02a, 0xffe070, 0xfff8d0];
const LEG_FACE = TIER_INFO.legendary.face as Face;
const CEL_FACE = TIER_INFO.celestial.face as Face;

export class ShrineScreen {
  private openAt = 0;
  /** When the gems were paid (they fly to the chest, then it opens). */
  private paidAt = -1e9;
  private shakeAt = -1e9;
  /** The vials' light as shown (it eases toward the real pity). */
  private shownLeg = -1;
  private shownTop = -1;
  private sheet = new Sheet();
  private sheetKind: 'odds' | 'pity' | null = null;
  private sheetAt = 0;
  private fx: FxImages;
  readonly opening: ChestOpening;

  constructor(private readonly kit: CampKit) {
    this.opening = chestOpening(kit);
    this.fx = new FxImages(kit.s);
  }

  open(now: number): void {
    this.openAt = now;
    this.paidAt = -1e9;
    this.sheet.close(now - 1000);
    this.shownLeg = this.shownTop = -1;
  }

  /** An opening is playing here. */
  get revealing(): boolean {
    return this.opening.active;
  }

  // ------------------------------------------------------------------ layout

  private cx(): number {
    return Math.round((this.kit.s.L + this.kit.s.R) / 2);
  }

  /** The one big action: Open (and the price), under the altar. */
  buyRect(): Rect {
    const s = this.kit.s;
    const w = 112;
    return { x: this.cx() - w / 2, y: s.B - 22, w, h: 19 };
  }

  /** Kept for callers of the old screen: the same big button. */
  openRect(): Rect {
    return this.buyRect();
  }

  /** The altar's foot (its bottom centre) and the chest's feet on it. */
  private altar(): { x: number; foot: number; top: number } {
    const foot = this.buyRect().y - 3;
    return { x: this.cx(), foot, top: foot - ALTAR_H + ALTAR_TOP + 1 };
  }

  /** The pity vials (their top-left) and the tap area round them. */
  private vials(): { big: { x: number; y: number }; thin: { x: number; y: number }; hit: Rect } {
    const s = this.kit.s;
    const x = this.cx() - 96;
    const bottom = s.B - 30;
    const big = { x, y: bottom - VIALS.big.h };
    const thin = { x: x + VIALS.big.w + 4, y: bottom - VIALS.thin.h };
    return { big, thin, hit: { x: x - 6, y: big.y - 12, w: VIALS.big.w + VIALS.thin.w + 16, h: VIALS.big.h + 24 } };
  }

  /** The odds: the round "i" and its legend of tier gems. */
  private oddsRect(): Rect {
    const s = this.kit.s;
    return { x: this.cx() + 66, y: s.B - 84, w: 36, h: 60 };
  }

  private infoRect(): Rect {
    const o = this.oddsRect();
    return { x: o.x + Math.round(o.w / 2) - 7, y: o.y, w: 14, h: 14 };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (this.opening.active) return this.opening.tap(now);
    if (now - this.paidAt < 420) return;
    if (this.sheet.open) {
      this.sheet.tap(now);
      return;
    }
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    const b = this.buyRect();
    if (inRect(b, x, y, 3)) {
      notePress(b);
      this.buyAndOpen(now);
      return;
    }
    if (inRect(this.oddsRect(), x, y, 3)) {
      notePress(this.infoRect());
      this.showOdds(now);
      return;
    }
    if (inRect(this.vials().hit, x, y)) {
      notePress(this.vials().hit);
      this.showPity(now);
    }
  }

  /** Open: a Rare chest already waiting opens free; else pay the gems and open the one bought, right here. Short of
   *  gems: the button shakes and says how many are missing. */
  buyAndOpen(now: number): boolean {
    const kit = this.kit;
    const p = kit.profile;
    if (p.chests.rare > 0) return this.opening.open(['rare'], now) > 0;
    const cost = Math.round(kit.tuning.chests.rareCost);
    const b = this.buyRect();
    if (!buyRareChest(p, kit.tuning)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(`Need ${whole(cost - p.gems)} more`, b.x + b.w / 2, b.y - 7, 0xffb0a0, { life: 1400, icon: 'gem' });
      return false;
    }
    kit.commit();
    this.paidAt = now;
    kit.app.audio.shopBuy();
    // the gems fly from the counter into the chest, it flares, and opens
    const a = this.altar();
    const gt = kit.gemsTag(kit.gUi, kit.texts, kit.s.R - 3, 4, now);
    const cy = a.top - BIG_CHEST.h / 2;
    for (let i = 0; i < 7; i++) kit.fx.fly({ color: [0xf6c8ff, 0xd070ff, WHITE][i % 3], x0: gt.x + 6, y0: gt.y + 6, x1: a.x + (i - 3) * 3, y1: cy, arc: 22, life: 340, delay: i * 30 });
    kit.after(380, () => {
      kit.fx.burst(a.x, cy, [0x9ad8ff, 0xd070ff, WHITE], 22, 1, { kind: 'star', g: 30, life: 600 });
      kit.fx.ring(a.x, cy, 26, 0xd4b4ff, 380);
      this.opening.open(['rare'], performance.now());
    });
    return true;
  }

  private showOdds(now: number): void {
    const kit = this.kit;
    const odds = chestOdds(kit.tuning, 'rare', kit.profile.pity.rare);
    const lines = TIERS.map((tier, i) => ({ tier, x: odds[i] }))
      .filter((o) => o.x > 0)
      .map((o) => ({ text: TIER_INFO[o.tier].name, col: mix(TIER_INFO[o.tier].face[0], WHITE, 0.2), bold: true }));
    this.sheet.show('Odds per chest', lines, now, [0xe8b8ff, 0xa060e0, 0x7a3cb0, 0x4a2470]);
    this.sheetKind = 'odds';
    this.sheetAt = now;
    kit.app.audio.panelOpen();
  }

  private showPity(now: number): void {
    const kit = this.kit;
    const left = pityLeft(kit.profile, kit.tuning);
    const t = kit.tuning.chests;
    this.sheet.show(
      'Pity',
      [
        { text: left.legendary === 1 ? 'A Legendary or better: the next chest!' : `A Legendary or better within ${left.legendary} chests.`, col: mix(LEG_FACE[0], WHITE, 0.2), bold: true },
        { text: left.top === 1 ? 'A Celestial or better: the next chest!' : `A Celestial or better within ${left.top} chests.`, col: mix(CEL_FACE[0], WHITE, 0.1), bold: true },
        { text: `From chest ${whole(t.softPity)} on, Legendary odds rise with every chest.` },
        { text: 'Gems come only from playing.' },
      ],
      now,
      [0xffe0a0, 0xffa030, 0xd86a14, 0x8a3a0a],
    );
    this.sheetKind = 'pity';
    this.sheetAt = now;
    kit.app.audio.panelOpen();
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gUi;
    g.clear(); // (the shrine covers the camp: no dim under it)
    this.fx.begin();
    const a = enterK(now, this.openAt, 0, 0, 240);
    drawStage(kit, 'shrine', now, { alpha: a, vignette: 0 });
    this.drawPlace(now, a);
    this.drawAltar(now);
    this.drawVials(now);
    this.drawOdds(now);
    vignette(g, s, a);
    kit.drawBack(g, now);
    kit.title(g, 'Shrine', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.purple);
    kit.gemsTag(g, kit.texts, s.R - 3, 4, now);
    this.drawButton(now);
    if (this.sheet.open || this.sheetKind) {
      const area = { x: s.L + 10, y: 20, w: s.R - s.L - 20, h: s.B - 24 };
      this.sheet.draw(kit, area, now);
      if (this.sheet.open && this.sheetKind === 'odds') this.drawOddsBars(now);
    }
    this.opening.draw(now);
    this.fx.end();
  }

  /** The live parts of the place: the runes breathing, the candles and braziers burning, the crystal and its light. */
  private drawPlace(now: number, a: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const { cx, cy } = SHRINE_ARCH;
    // the runes: the pillars' and the arch's light in turn
    for (const grp of [0, 1]) {
      const k = 0.35 + 0.45 * pulse(now, 2600, grp * 1300);
      this.fx.get(`shrine_runes${grp}`, 0, 0, D.ui - 0.002, { ox: 0, oy: 0, tint: SPIRIT, add: true, alpha: k * a });
    }
    // candle flames, each flickering on its own
    SHRINE_CANDLES.forEach((c, i) => {
      const fl = Math.sin(now / (70 + i * 9) + i * 1.7);
      const tall = fl > 0.3 ? 1 : 0;
      fillEllipse(g, c.x, c.y - 2, 6, 6, 0xffb040, 0.07 * a);
      g.fillStyle(FLAME[0], a);
      g.fillRect(c.x, c.y - 1, 1, 1);
      g.fillStyle(FLAME[1], a);
      g.fillRect(c.x - (fl < -0.5 ? 1 : 0), c.y - 2 - tall, 1, 1 + tall);
      g.fillStyle(FLAME[3], a);
      g.fillRect(c.x, c.y - 2, 1, 1);
      if (fl > 0.6) {
        g.fillStyle(FLAME[2], 0.8 * a);
        g.fillRect(c.x, c.y - 4, 1, 1);
      }
    });
    // the braziers' fire and its warm light
    SHRINE_LANTERNS.forEach((l, i) => {
      const fl = 0.85 + 0.15 * Math.sin(now / 77 + i * 3);
      fillEllipse(g, l.x, l.y - 6, 22 * fl, 18 * fl, 0xff9a40, 0.06 * a);
      fillEllipse(g, l.x, l.y - 4, 12 * fl, 9 * fl, 0xffc060, 0.08 * a);
      const f = [0, 2, 1, 3, 0, 1, 3, 2][Math.floor((now + i * 230) / 90) % 8];
      kit.imgs.at(`vault_flame${f}`, l.x - 3, l.y - 11, D.icons - 0.001, a);
      kit.imgs.at(`vault_flame${(f + 2) % 4}`, l.x - 5, l.y - 9, D.icons - 0.0015, 0.8 * a);
      kit.imgs.at(`vault_flame${(f + 1) % 4}`, l.x - 1, l.y - 9, D.icons - 0.0015, 0.8 * a);
    });
    // the crystal under the keystone: bobbing, turning its light on the altar
    const al = this.altar();
    const ccy = cy - 30 + Math.round(Math.sin(now / 700) * 2);
    const br = 0.8 + 0.2 * pulse(now, 1800);
    this.fx.get('hchest_glow', cx, ccy, D.ui - 0.001, { sx: 1.1 * br, tint: 0xa878f0, add: true, alpha: 0.7 * a });
    spotlight(g, cx, ccy + 6, al.top + 2, 12, 64, 0xd4b4ff, 0.06 * a * br);
    this.fx.get('shrine_crystal', cx, ccy, D.icons, { alpha: a });
    if (pulse(now, 1400) > 0.86) star(kit.gOver, cx - 3, ccy - 6, 1, WHITE, a);
    // motes of its light drifting down to the altar
    for (let i = 0; i < 9; i++) {
      const per = 2600 + ((i * 577) % 1800);
      const q = ((now + i * 811) % per) / per;
      g.fillStyle(i % 3 ? 0xd4b4ff : WHITE, Math.sin(q * Math.PI) * 0.7 * a);
      g.fillRect(Math.round(cx + Math.sin(i * 2.1 + now / 1300) * (8 + q * 22)), Math.round(ccy + 10 + q * (al.top - ccy - 14)), 1, 1);
    }
  }

  /** The altar and the Rare chest hovering over it in the crystal's light (it flares when it can be opened). */
  private drawAltar(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const p = kit.profile;
    const al = this.altar();
    const k = popK(now, this.openAt, 2, 60, 320);
    if (k <= 0) return;
    const fade = clamp01(k * 1.5);
    // a ring of runes glowing on the floor round the altar
    fillEllipse(g, al.x, al.foot - 1, 48, 6, 0x7a44c8, 0.18 * fade);
    fillEllipse(g, al.x, al.foot - 1, 38, 4, 0xa878f0, 0.14 * fade * (0.7 + 0.3 * pulse(now, 2000)));
    kit.imgs.foot('shrine_altar', al.x, al.foot, D.icons - 0.0005, fade);
    // the chest: rises onto the altar as the screen opens, hovers and bobs, hops when paid for
    const ready = p.chests.rare > 0 || p.gems >= Math.round(kit.tuning.chests.rareCost);
    const paid = now - this.paidAt;
    const hop = paid < 380 ? Math.round(Math.sin((paid / 380) * Math.PI) * 6) : 0;
    const hover = 3 + Math.round(Math.sin(now / 640) * 1.5) + hop;
    const rise = Math.round((1 - Math.min(1, k)) * 10);
    const feet = al.top - hover + rise;
    const face = TIER_INFO.rare.face;
    // its shadow on the altar, its aura
    fillEllipse(g, al.x, al.top + 1, 20 - hover, 2, INK, 0.45 * fade);
    const ak = ready ? 1 : 0.55;
    fillEllipse(g, al.x, feet - 22, 36, 28, face[3], 0.16 * fade * ak);
    fillEllipse(g, al.x, feet - 22, 26, 20, face[1], 0.12 * fade * ak);
    fillEllipse(g, al.x, feet - 22, 15, 12, 0xd4b4ff, 0.12 * fade * ak);
    const key = 'hchest_rare_big';
    const per = 2600;
    const ph = now % per;
    const peek = ready && ph < 380 ? Math.sin((ph / 380) * Math.PI) : 0;
    const lift = Math.round(peek * 2);
    this.fx.get(`${key}_base`, al.x, feet, D.icons, { ox: 0.5, oy: 1, alpha: fade });
    this.fx.get(`${key}_gap`, al.x, feet, D.icons + 0.001, { ox: 0.5, oy: 1, tint: 0xc8b0ff, add: true, alpha: (ready ? 0.5 + 0.5 * peek : 0.2) * fade });
    this.fx.get(`${key}_lid`, al.x, feet - lift, D.icons + 0.002, { ox: 0.5, oy: 1, alpha: fade });
    if (ready) {
      const la = (0.25 + 0.6 * peek + 0.12 * pulse(now, 1000)) * fade;
      this.fx.get(`${key}_leakB0`, al.x, feet, D.icons + 0.003, { ox: 0.5, oy: 1, tint: 0xd4b4ff, add: true, alpha: la });
      this.fx.get(`${key}_leakL0`, al.x, feet - lift, D.icons + 0.003, { ox: 0.5, oy: 1, tint: 0xd4b4ff, add: true, alpha: la });
    }
    if (paid < 300) this.fx.get(key, al.x, feet, D.icons + 0.004, { ox: 0.5, oy: 1, tint: WHITE, fill: true, add: true, alpha: 0.6 * (1 - paid / 300) });
    if (pulse(now, 1500, 300) > 0.86) star(kit.gOver, al.x + 13, feet - BIG_CHEST.h + 10, 1, WHITE, fade);
    // waiting ones: a badge
    if (p.chests.rare > 0) countBadge(kit.gOver, kit.texts, al.x + 23, feet - BIG_CHEST.h + 13, `${p.chests.rare}`, now, { alpha: fade });
  }

  /** The pity vials: light filling toward the guaranteed Legendary ("N left"), and the thin one toward a Celestial. */
  private drawVials(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const go = kit.gOver;
    const texts = kit.texts;
    const p = kit.profile;
    const t = kit.tuning.chests;
    const k = popK(now, this.openAt, 3, 60, 300);
    if (k <= 0) return;
    const fade = clamp01(k * 1.5);
    const v = this.vials();
    const left = pityLeft(p, kit.tuning);
    const legF = clamp01(p.pity.rare / Math.max(1, t.pity));
    const topF = clamp01(p.pity.top / Math.max(1, t.topPity));
    const ease = (shown: number, to: number) => (shown < 0 ? to : shown + (to - shown) * 0.08);
    this.shownLeg = ease(this.shownLeg, legF);
    this.shownTop = ease(this.shownTop, topF);
    const pr = isPressed(v.hit, now) ? 1 : 0;
    const drop = Math.round((1 - Math.min(1, k)) * 8) + pr;
    this.vial(g, go, 'shrine_vial', VIALS.big, v.big.x, v.big.y + drop, this.shownLeg, LEG_FACE, now, fade, left.legendary <= 3);
    this.vial(g, go, 'shrine_vial_thin', VIALS.thin, v.thin.x, v.thin.y + drop, this.shownTop, CEL_FACE, now, fade, left.top <= 3);
    // what it's for, and how many are left
    const bx = v.big.x + Math.round(VIALS.big.w / 2);
    const tw = textWidth('Legendary', 1, true) + 8;
    const tr = { x: Math.round(bx + 4 - tw / 2), y: v.big.y - 14 + drop, w: tw, h: 10 };
    tag(g, tr, LEG_FACE, fade);
    texts.text('Legendary', tr.x + tw / 2, tr.y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: fade });
    const lt = left.legendary === 1 ? 'Next!' : `${left.legendary} left`;
    texts.text(lt, bx + 4, v.big.y + VIALS.big.h + 6 + drop, mix(LEG_FACE[0], WHITE, 0.3), { bold: true, ox: 0.5, oy: 0.5, alpha: fade });
  }

  /** One vial: the dark glass, the light inside it filled to `frac` with a lapping surface and bubbles, the glass. */
  private vial(g: G, go: G, key: string, spec: { w: number; h: number; inner: ReadonlyArray<readonly [number, number, number]> }, x: number, y: number, frac: number, face: Face, now: number, a: number, near: boolean): void {
    const [hi, base, lo] = face;
    const n = spec.inner.length;
    const lit = Math.round(frac * n);
    if (near || frac >= 0.95) fillEllipse(g, x + spec.w / 2, y + spec.h * 0.6, spec.w, spec.h * 0.55, base, (0.12 + 0.12 * pulse(now, 700)) * a);
    spec.inner.forEach(([ry, x0, x1], i) => {
      const yy = y + ry;
      if (i >= lit) {
        g.fillStyle(0x140e22, 0.75 * a);
        g.fillRect(x + x0, yy, x1 - x0 + 1, 1);
        return;
      }
      const top = i >= lit - 1;
      const kk = i / Math.max(1, n - 1);
      const col = top ? mix(hi, WHITE, 0.4) : kk > 0.6 ? hi : kk > 0.25 ? base : i % 3 === 0 ? lo : mix(base, lo, 0.5);
      g.fillStyle(col, a);
      if (top) {
        // a lapping surface
        for (let xx = x0; xx <= x1; xx++) if (Math.sin(now / 240 + xx * 1.3) > -0.3) g.fillRect(x + xx, yy, 1, 1);
      } else g.fillRect(x + x0, yy, x1 - x0 + 1, 1);
    });
    // bubbles rising through the light
    if (lit > 2)
      for (let b = 0; b < 3; b++) {
        const per = 1400 + b * 500;
        const q = ((now + b * 470) % per) / per;
        const row = Math.floor(q * (lit - 1));
        const [ry, x0, x1] = spec.inner[row];
        const bx = x + x0 + ((b * 3 + 1) % Math.max(1, x1 - x0 + 1));
        go.fillStyle(mix(hi, WHITE, 0.6), (1 - q) * 0.8 * a);
        go.fillRect(bx, y + ry, 1, 1);
      }
    this.fx.get(key, x, y, D.icons, { ox: 0, oy: 0, alpha: a });
  }

  /** The odds: the round "i", the label and a column of the tiers a Rare chest can hold (rising: an arrow). */
  private drawOdds(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const texts = kit.texts;
    const k = popK(now, this.openAt, 4, 60, 300);
    if (k <= 0) return;
    const fade = clamp01(k * 1.5);
    const o = this.oddsRect();
    const drop = Math.round((1 - Math.min(1, k)) * 8);
    const ir = this.infoRect();
    infoButton(g, texts, { ...ir, y: ir.y + drop }, now);
    texts.text('Odds', o.x + o.w / 2, ir.y + drop + 21, 0xe8e0ff, { bold: true, ox: 0.5, oy: 0.5, alpha: fade });
    const odds = chestOdds(kit.tuning, 'rare', kit.profile.pity.rare);
    const tiers = TIERS.filter((_, i) => odds[i] > 0);
    const rising = kit.profile.pity.rare >= kit.tuning.chests.softPity;
    tiers.forEach((tier, i) => {
      const f = TIER_INFO[tier].face;
      const gx = o.x + 6 + (i % 3) * 9;
      const gy = ir.y + drop + 30 + Math.floor(i / 3) * 9;
      // a little cut gem in the tier's colours
      rows(g, gx - 1, gy - 1, 8, 8, 2, INK, fade);
      rows(g, gx, gy, 6, 6, 2, f[1], fade);
      g.fillStyle(f[0], fade);
      g.fillRect(gx + 1, gy + 1, 2, 1);
      g.fillStyle(f[3], fade);
      g.fillRect(gx + 2, gy + 5, 3, 1);
      if (tierIndex(tier) >= tierIndex('celestial') && pulse(now, 1100, i * 300) > 0.85) star(kit.gOver, gx + 5, gy, 1, WHITE, fade);
    });
    if (rising) {
      const w = textWidth('Rising!', 1, true) + 8;
      const tr = { x: Math.round(o.x + o.w / 2 - w / 2), y: ir.y + drop + 50, w, h: 10 };
      tag(kit.gOver, tr, [0xffd0a0, 0xe06a2a, 0xb04a1a, 0x6a2a0a], (0.8 + 0.2 * pulse(now, 600)) * fade);
      texts.text('Rising!', tr.x + w / 2, tr.y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: fade });
    }
  }

  /** The odds sheet's bars: one per tier, on a root scale (so the rare tiers still show), the figure at the end. */
  private drawOddsBars(now: number): void {
    const kit = this.kit;
    const l = kit.layer(true);
    const r = this.sheet.rect;
    const odds = chestOdds(kit.tuning, 'rare', kit.profile.pity.rare);
    const base = chestOdds(kit.tuning, 'rare', 0);
    const list = TIERS.map((tier, i) => ({ tier, x: odds[i], b: base[i] })).filter((o) => o.x > 0);
    const max = Math.max(...list.map((o) => o.x));
    const labelW = Math.max(...list.map((o) => textWidth(TIER_INFO[o.tier].name, 1, true))) + 10;
    const barX = r.x + 6 + labelW;
    const barW = r.w - 12 - labelW - 40;
    list.forEach((o, i) => {
      const y = r.y + 12 + i * 9;
      const f = TIER_INFO[o.tier].face;
      const ik = easeOut3((now - this.sheetAt - 80 - i * 40) / 260);
      gauge(l.g, barX, y + 2, barW, 4, Math.sqrt(o.x / max) * clamp01(ik), 0, { ramp: [f[0], f[1], f[2], f[3]] });
      const up = o.x > o.b * 1.001;
      l.texts.text(oddsText(o.x), r.x + r.w - 6, y + 4, up ? 0xffc080 : WHITE, { bold: true, ox: 1, oy: 0.5 });
    });
  }

  /** The big action under the altar: Open (free when one waits) or Open with its gem price. */
  private drawButton(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const k = popK(now, this.openAt, 5, 60, 300);
    if (k <= 0) return;
    const b = this.buyRect();
    const r = { ...b, y: b.y + Math.round((1 - Math.min(1, k)) * 12) };
    const cost = Math.round(kit.tuning.chests.rareCost);
    const waiting = p.chests.rare > 0;
    const short = !waiting && p.gems < cost;
    bigButton(kit, kit.gUi, kit.texts, r, 'Open', FACE.purple, now, {
      icon: 'chest',
      cost: waiting ? undefined : [{ icon: 'gem', n: cost, short }],
      shakeAt: this.shakeAt,
      glowCol: short ? undefined : 0xd070ff,
      alpha: clamp01(k * 1.5),
    });
  }
}
