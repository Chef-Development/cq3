// The camp's upgrades (a camp screen: tap the notice board). Each upgrade is a row on the left: its name, and a
// coin price (can buy), a check (built) or a padlock (not yet); the one tapped shows on the right: what it adds, how
// it unlocks (a number of acts cleared, or a hero's mastery goal), its price in coins and Buy. The Training Dummy,
// once built, offers Practice (a fight with no risk and no rewards, back to the camp after).
import type Phaser from 'phaser';
import { HEROES } from '../../data/heroes';
import { CAMP_UPGRADES, CAMP_UPGRADE_IDS, MASTERY, type CampUpgradeId } from '../../data/meta';
import { buyCamp, campAvailable, hasCamp } from '../../core/meta';
import { textWidth } from '../font';
import { CampKit, GREEN, pix, pixSize } from './camp-kit';
import { padlock, wrapText } from './items';
import { glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON } from './ui';

type G = Phaser.GameObjects.Graphics;

/** Each upgrade's small icon. */
const ICON: Record<CampUpgradeId, string> = { perch: 'paw', luckyStone: 'clover', warTable: 'flag', rerollCharm: 'dice', dummy: 'target', mapTable: 'chest' };

/** How an upgrade becomes buyable, in plain words ("Clear 3 acts", "Moss: clear 3 acts"); both when either works. */
export function unlockText(id: CampUpgradeId): string {
  const u = CAMP_UPGRADES[id];
  const out: string[] = [];
  if (u.acts !== undefined) out.push(`Clear ${u.acts} act${u.acts === 1 ? '' : 's'}`);
  for (const m of MASTERY) if (m.reward.kind === 'camp' && m.reward.upgrade === id) out.push(`${HEROES[m.hero].name}: ${m.text.charAt(0).toLowerCase()}${m.text.slice(1)}`);
  return out.join(', or ');
}

export type UpgradeState = 'bought' | 'buy' | 'locked';

export class UpgradesScreen {
  sel: CampUpgradeId = 'dummy';
  private openAt = 0;
  private selAt = 0;
  private buyAt = -1e9;
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    this.openAt = now;
    this.selAt = now;
    // the first one that can be bought, else the first built, else the first
    const p = this.kit.profile;
    this.sel = CAMP_UPGRADE_IDS.find((id) => this.state(id) === 'buy') ?? CAMP_UPGRADE_IDS.find((id) => hasCamp(p, id)) ?? CAMP_UPGRADE_IDS[0];
  }

  state(id: CampUpgradeId): UpgradeState {
    const p = this.kit.profile;
    if (hasCamp(p, id)) return 'bought';
    return campAvailable(p).includes(id) ? 'buy' : 'locked';
  }

  // ------------------------------------------------------------------ layout

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  private listW(): number {
    return Math.max(...CAMP_UPGRADE_IDS.map((id) => textWidth(CAMP_UPGRADES[id].name, 1, true))) + 46;
  }

  private row(i: number): Rect {
    const c = this.card();
    const h = Math.min(17, Math.floor((c.h - 8) / CAMP_UPGRADE_IDS.length));
    return { x: c.x + 4, y: c.y + 4 + i * h, w: this.listW(), h: h - 2 };
  }

  private panel(): Rect {
    const c = this.card();
    const x = c.x + 4 + this.listW() + 5;
    return { x, y: c.y + 4, w: c.x + c.w - 4 - x, h: c.h - 8 };
  }

  /** The region progress, from the top bar (right of the HTML buttons in its middle). */
  progressRect(): Rect {
    const kit = this.kit;
    const w = textWidth('Progress', 1, true) + pixSize('flag')[0] + 14;
    const z = kit.hudZone();
    return { x: Math.max(z.x + z.w + 3, this.coinsRect().x - 4 - w), y: 3, w, h: 13 };
  }

  /** The coins (what upgrades cost), top right. */
  private coinsRect(): Rect {
    const kit = this.kit;
    const w = Math.max(30, textWidth(`${Math.round(kit.coinsShown)}`, 1, true) + 16);
    return { x: kit.s.R - 3 - w, y: 4, w, h: 12 };
  }

  private buyRect(): Rect {
    const p = this.panel();
    return { x: p.x + 5, y: p.y + p.h - 19, w: p.w - 10, h: 15 };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | 'practice' | 'progress' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    const pr = this.progressRect();
    if (inRect(pr, x, y, 2)) {
      notePress(pr);
      return 'progress';
    }
    for (let i = 0; i < CAMP_UPGRADE_IDS.length; i++) {
      const r = this.row(i);
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      if (this.sel !== CAMP_UPGRADE_IDS[i]) {
        this.sel = CAMP_UPGRADE_IDS[i];
        this.selAt = now;
        kit.app.audio.uiClick();
      }
      return;
    }
    const b = this.buyRect();
    if (!inRect(b, x, y, 2)) return;
    notePress(b);
    const st = this.state(this.sel);
    if (st === 'bought') {
      if (this.sel === 'dummy') return 'practice';
      kit.app.audio.uiClick();
      return;
    }
    this.buy(now);
  }

  private buy(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.sel;
    const b = this.buyRect();
    if (this.state(id) === 'locked') {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(unlockText(id), b.x + b.w / 2, b.y - 8, 0xffb0a0, { life: 1500 });
      return;
    }
    if (!buyCamp(p, id)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(`Need ${CAMP_UPGRADES[id].cost - p.coins} more coins`, b.x + b.w / 2, b.y - 8, 0xffb0a0, { life: 1300 });
      return;
    }
    kit.commit();
    this.buyAt = now;
    kit.app.audio.shopBuy();
    kit.after(150, () => kit.app.audio.forgeUpgrade());
    const pn = this.panel();
    kit.fx.burst(pn.x + pn.w / 2, pn.y + 20, [0xfff0a0, 0xffd23a, WHITE, GREEN], 30, 1.1, { kind: 'star', g: 30, life: 800 });
    kit.fx.ring(pn.x + pn.w / 2, pn.y + 20, 30, 0xfff0a0, 460);
    kit.fx.float(`${CAMP_UPGRADES[id].name} built!`, pn.x + pn.w / 2, pn.y + 14, GREEN, { life: 1700 });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    kit.title(g, 'Upgrades', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.green);
    kit.coinsTag(g, kit.texts, this.coinsRect(), now);
    kit.button(g, kit.texts, this.progressRect(), 'Progress', FACE.blue, now, { icon: 'flag' });
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    CAMP_UPGRADE_IDS.forEach((id, i) => this.drawRow(g, id, i, now));
    this.drawPanel(g, now);
  }

  private drawRow(g: G, id: CampUpgradeId, i: number, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const r = this.row(i);
    const st = this.state(id);
    const sel = this.sel === id;
    const ik = clamp01((now - this.openAt - 80 - i * 40) / 160);
    if (ik <= 0) return;
    if (sel) glow(g, r, 0xffd23a, 0.25, 2);
    rows(g, r.x, r.y, r.w, r.h, 2, sel ? NAVY[5] : st === 'bought' ? 0x1e3a2a : NAVY[2], ik);
    if (sel) {
      g.fillStyle(GOLD[3], ik);
      g.fillRect(r.x + 2, r.y, r.w - 4, 1);
    }
    const cy = r.y + r.h / 2;
    const icon = ICON[id];
    const [iw, ih] = pixSize(icon);
    pix(g, icon, r.x + 3, Math.round(cy - ih / 2), st === 'locked' ? 0.5 * ik : ik);
    texts.text(CAMP_UPGRADES[id].name, r.x + iw + 6, cy, st === 'locked' ? 0x9890b8 : st === 'bought' ? 0xc8f0b0 : WHITE, { bold: true, oy: 0.5, alpha: ik });
    // on the right: a check, a padlock, or a coin price
    if (st === 'bought') pix(kit.gOver, 'check', r.x + r.w - 10, Math.round(cy - 3), ik);
    else if (st === 'locked') padlock(kit.gOver, r.x + r.w - 10, Math.round(cy - 4), ik, 0xd8901c);
    else {
      const affordable = kit.profile.coins >= CAMP_UPGRADES[id].cost;
      const [cw, ch] = pixSize('coin');
      pix(kit.gOver, 'coin', r.x + r.w - 3 - cw, Math.round(cy - ch / 2), (affordable ? 0.75 + 0.25 * pulse(now, 900, i * 200) : 0.5) * ik);
    }
  }

  private drawPanel(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const pn = this.panel();
    const id = this.sel;
    const u = CAMP_UPGRADES[id];
    const st = this.state(id);
    const a = clamp01((now - this.selAt) / 180);
    rows(g, pn.x, pn.y, pn.w, pn.h, 2, 0x140e22, 0.8);
    const bk = now - this.buyAt;
    const pop = bk < 360 ? Math.round(Math.sin((bk / 360) * Math.PI) * 3) : 0;
    const icon = ICON[id];
    const [iw, ih] = pixSize(icon);
    let y = pn.y + 9 - pop;
    pix(g, icon, pn.x + 5, Math.round(y - ih / 2), a);
    const name = u.name;
    texts.text(name, pn.x + iw + 9, y, st === 'locked' ? 0xb8b0d0 : WHITE, { bold: true, oy: 0.5, alpha: a });
    y += 12 + pop;
    for (const l of wrapText(u.text, pn.w - 10)) {
      texts.text(l, pn.x + 5, y, 0xe0d8f8, { oy: 0.5, alpha: a });
      y += 8;
    }
    y += 4;
    // how it unlocks (or that it's built)
    if (st === 'bought') {
      pix(g, 'check', pn.x + 5, y - 3, a);
      texts.text('Built!', pn.x + 15, y, GREEN, { bold: true, oy: 0.5, alpha: a });
    } else {
      const how = unlockText(id);
      const lab = st === 'locked' ? 'Unlocks:' : 'Unlocked:';
      const lw = textWidth(lab, 1, false);
      texts.text(lab, pn.x + 5, y, st === 'locked' ? 0xffb0a0 : 0xb4f070, { oy: 0.5, alpha: a });
      const lines = wrapText(how, pn.w - 14 - lw);
      lines.forEach((l, j) => texts.text(l, pn.x + 9 + lw, y + j * 8, st === 'locked' ? 0xffd8c8 : 0xd8f0c0, { oy: 0.5, alpha: a }));
    }
    // Buy (the price on it), or Practice for the dummy once it's built
    const b = this.buyRect();
    if (st === 'bought') {
      if (id === 'dummy') kit.button(g, texts, b, 'Practice', FACE.green, now, { icon: 'target', glowCol: 0x8af06a });
      else kit.button(g, texts, b, 'Built', FACE.gold, now, { icon: 'check' });
    } else {
      const short = p.coins < u.cost;
      kit.button(g, texts, b, 'Buy', st === 'locked' ? FACE.grey : FACE.green, now, { cost: [{ icon: 'coin', n: u.cost, short }], disabled: st === 'locked', shakeAt: this.shakeAt, glowCol: st === 'buy' && !short ? 0x8af06a : undefined });
      if (st === 'locked') padlock(kit.gOver, b.x + 4, b.y + 4, 1, 0xd8901c);
    }
  }
}
