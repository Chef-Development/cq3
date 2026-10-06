// Region completion (a camp screen, also opened from the world map: camp.openProgress). A tab per region in the top
// bar (a region not reached yet is "???": its name is a surprise); the card shows the region's percentage as a big
// number over a bar, then each part of it as a row (acts cleared, mini-bosses and the boss beaten, bounties done,
// hidden treasures found, events seen) with have/of and a pip per piece, and at the bottom the 100% reward (a region
// chest and gems): "Claim" when it's earned and not yet given, "Claimed!" after.
import type Phaser from 'phaser';
import { REGIONS, regionStart } from '../../data/regions';
import { claimRegionReward, regionCompletion, regionLog, type CompletionKey } from '../../core/completion';
import { textWidth } from '../font';
import { CampKit, DIM_TXT, GOLD_TXT, GREEN, pix, pixSize } from './camp-kit';
import { star } from './loot';
import { gauge, glow, GOLD, hudIcon, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

/** Each part's icon. */
const PART_ICON: Record<CompletionKey, string> = { acts: 'flag', minis: 'crown', boss: 'skull', bounties: 'sword', treasures: 'chest', events: 'rune' };

export class ProgressScreen {
  region = 0;
  private openAt = 0;
  private regionAt = 0;
  private claimAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, region?: number): void {
    this.openAt = now;
    this.regionAt = now;
    this.region = Math.max(0, Math.min(REGIONS.length - 1, region ?? this.current()));
  }

  /** The region the player is in now (the furthest reached). */
  current(): number {
    const p = this.kit.profile;
    let r = 0;
    for (let i = 0; i < REGIONS.length; i++) if (p.actsCleared >= regionStart(i)) r = i;
    return r;
  }

  /** Whether region `r` has been reached (its name can show). */
  reached(r: number): boolean {
    return this.kit.profile.actsCleared >= regionStart(r);
  }

  // ------------------------------------------------------------------ layout

  /** A tab per region, stacked in the card's left column under the percentage. */
  tabs(): Array<{ r: Rect; region: number; label: string }> {
    const c = this.card();
    const labels = REGIONS.map((def, i) => (this.reached(i) ? def.name : '???'));
    const w = 74;
    const h = 13;
    const y0 = c.y + c.h - 6 - labels.length * (h + 3) + 3;
    return labels.map((label, i) => ({ r: { x: c.x + 6, y: y0 + i * (h + 3), w, h }, region: i, label }));
  }

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  private claimRect(): Rect {
    const c = this.card();
    return { x: c.x + c.w - 6 - 50, y: c.y + c.h - 21, w: 50, h: 16 };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (const t of this.tabs())
      if (inRect(t.r, x, y, 2)) {
        notePress(t.r);
        if (this.region !== t.region) {
          this.region = t.region;
          this.regionAt = now;
          kit.app.audio.uiClick();
        }
        return;
      }
    const c = regionCompletion(kit.profile, this.region);
    const cr = this.claimRect();
    if (c.done && !regionLog(kit.profile, this.region).chest && inRect(cr, x, y, 2)) {
      notePress(cr);
      if (!claimRegionReward(kit.profile, kit.tuning, this.region)) return;
      kit.commit();
      this.claimAt = now;
      kit.app.audio.shopBuy();
      kit.after(160, () => kit.app.audio.rareSting(true));
      kit.fx.burst(cr.x + cr.w / 2, cr.y, [0xfff0a0, 0xffd23a, WHITE, 0xb06ae0], 36, 1.2, { kind: 'star', g: 30, life: 900 });
      kit.fx.ring(cr.x + cr.w / 2, cr.y + 7, 30, 0xfff0a0, 500);
      kit.fx.float('Region chest!', cr.x + cr.w / 2 - 20, cr.y - 12, 0xdab0ff, { life: 1800 });
    }
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    kit.title(g, 'Progress', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.green);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    for (const t of this.tabs()) {
      const on = t.region === this.region;
      const r = { ...t.r, y: t.r.y + (isPressed(t.r, now) ? 1 : 0) };
      if (on) glow(g, r, 0xffd23a, 0.25 + 0.15 * pulse(now, 1200), 2);
      tag(g, r, on ? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]] : [NAVY[6], NAVY[4], NAVY[3], NAVY[1]]);
      kit.texts.text(t.label, r.x + r.w / 2, r.y + r.h / 2, on ? 0x4a2408 : this.reached(t.region) ? 0xd8d0f0 : 0x9890b8, { bold: true, ox: 0.5, oy: 0.5 });
    }
    this.drawRegion(g, now);
  }

  private drawRegion(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const c = this.card();
    const r = this.region;
    const comp = regionCompletion(p, r);
    const log = regionLog(p, r);
    const a = clamp01((now - this.regionAt) / 200);
    // the percentage, big, over its bar (it counts up when the region is shown)
    const ck = easeOut3((now - this.regionAt) / 700);
    const pct = Math.round(comp.pct * ck);
    const left = { x: c.x + 6, y: c.y + 5, w: 74 };
    const big = `${pct}%`;
    texts.text(big, left.x + left.w / 2, left.y + 14, comp.done ? GOLD_TXT : WHITE, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: comp.done ? 0x7a3a0a : NAVY[1], alpha: a });
    gauge(g, left.x, left.y + 27, left.w, 6, (comp.pct / 100) * ck, 0, { ramp: comp.done ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : [0xd8ffb0, 0x8af06a, 0x3aaa34, 0x1e6a24], seg: 10 });
    texts.text(`${comp.have} of ${comp.of}`, left.x + left.w / 2, left.y + 41, 0xc8c0e8, { ox: 0.5, oy: 0.5, alpha: a });
    if (comp.done && kit.has('badge_region')) {
      const [bw] = iconSize('badge_region');
      hudIcon(g, 'badge_region', Math.round(left.x + left.w / 2 - bw / 2), left.y + 49, 1, a);
    }
    // the parts: an icon, the label, have/of and a pip per piece
    const x0 = left.x + left.w + 10;
    const right = c.x + c.w - 6;
    let y = c.y + 9;
    comp.parts.forEach((part, i) => {
      const ik = clamp01((now - this.regionAt - 100 - i * 50) / 160);
      if (ik <= 0) return;
      const done = part.have >= part.of;
      const icon = PART_ICON[part.key];
      const [iw, ih] = pixSize(icon);
      pix(g, icon, x0 + Math.round((9 - iw) / 2), Math.round(y - ih / 2), ik * (part.have > 0 ? 1 : 0.6));
      texts.text(part.label, x0 + 13, y, done ? 0xd8f0c0 : 0xe0d8f8, { oy: 0.5, alpha: ik });
      const num = `${part.have}/${part.of}`;
      texts.text(num, right, y, done ? GREEN : WHITE, { bold: true, ox: 1, oy: 0.5, alpha: ik });
      // pips, right-aligned before the number
      const pw = 6;
      const px0 = right - textWidth(num, 1, true) - 6 - part.of * pw;
      for (let j = 0; j < part.of; j++) {
        const px = px0 + j * pw;
        rows(g, px, Math.round(y - 3), 5, 5, 1, INK, ik);
        g.fillStyle(j < part.have ? (done ? 0x8af06a : 0xffd23a) : NAVY[3], ik);
        g.fillRect(px + 1, Math.round(y - 2), 3, 3);
      }
      if (done) pix(kit.gOver, 'check', x0 + 13 + textWidth(part.label, 1, false) + 3, Math.round(y - 4), ik);
      y += 13;
    });
    // the 100% reward
    const rr = { x: x0, y: c.y + c.h - 22, w: right - x0, h: 18 };
    rows(g, rr.x - 2, rr.y, rr.w + 4, rr.h, 2, 0x140e22, 0.85 * a);
    const lab = '100%:';
    texts.text(lab, rr.x + 2, rr.y + 9, GOLD_TXT, { bold: true, oy: 0.5, alpha: a });
    let x = rr.x + 4 + textWidth(lab, 1, true);
    pix(g, 'chest', x, rr.y + 5, a);
    x += 12;
    const gems = Math.round(kit.tuning.gems.region);
    const status = log.chest ? 'Claimed!' : comp.done ? '' : `${100 - comp.pct}% to go`;
    const statusW = log.chest ? textWidth(status, 1, true) + 12 : comp.done ? this.claimRect().w : textWidth(status, 1, false);
    const long = `Region chest + ${gems}`;
    const reward = x + textWidth(long, 1, false) + 14 <= right - statusW - 4 ? long : `+ ${gems}`;
    texts.text(reward, x, rr.y + 9, 0xdab0ff, { oy: 0.5, alpha: a });
    x += textWidth(reward, 1, false) + 2;
    hudIcon(g, 'gem', x, rr.y + 4, 1, a);
    const cr = this.claimRect();
    if (log.chest) {
      const t = 'Claimed!';
      pix(g, 'check', right - textWidth(t, 1, true) - 12, rr.y + 5, a);
      texts.text(t, right, rr.y + 9, GREEN, { bold: true, ox: 1, oy: 0.5, alpha: a });
      const ck2 = now - this.claimAt;
      if (ck2 < 1500 && pulse(now, 300) > 0.5) star(kit.gOver, right - 6, rr.y + 2, 1, WHITE, 1 - ck2 / 1500);
    } else if (comp.done) {
      kit.button(g, texts, cr, 'Claim', FACE.gold, now, { glowCol: 0xffd23a });
    } else texts.text(`${100 - comp.pct}% to go`, right, rr.y + 9, DIM_TXT, { ox: 1, oy: 0.5, alpha: a });
  }
}
