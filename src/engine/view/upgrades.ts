// The camp's upgrades: build mode over the live camp (the camp's Camp button). No list: each upgrade is an object with
// its own spot in the clearing (art-camp-build.ts). In build mode the dim lifts, a spot not built yet shows the
// object's ghost (a pale blueprint, pulsing) under a hammer marker (gold: you can build it; grey with a padlock: not
// yet), a built one stands there for real; a banner along the foot says what to do. Tapping a spot opens its glass
// card: the name, one line on what it adds, and Build with its coin price (or what unlocks it, or "Built", or
// Practice for the Training Dummy). Building closes the card and plays over the spot: dust, three hammer clangs with
// sparks, the object rising out of the dust, a burst of sparkles, its name; it stands in the camp from then on (the
// camp draws it: objectAlpha), and tapping it opens its card again.
// The region progress is a button in the top bar.
import { HEROES } from '../../data/heroes';
import { CAMP_UPGRADES, CAMP_UPGRADE_IDS, MASTERY, type CampUpgradeId } from '../../data/meta';
import { buyCamp, campAvailable, hasCamp } from '../../core/meta';
import { BUILD_KEY, BUILD_SPOTS, ensureCampBuildArt } from '../art-camp-build';
import { textWidth } from '../font';
import { CampKit, D, GOLD_TXT, GREEN, pix, pixSize } from './camp-kit';
import { padlock, wrapText } from './items';
import { glow, GOLD } from './pixels';
import { clamp01, easeBack, inRect, INK, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON } from './ui';
import { bigButton, enterK, fillEllipse, glass, popK } from './ui-modern';


/** How an upgrade becomes buyable, in plain words ("Clear 3 acts", "Moss: clear 3 acts"); both when either works. */
export function unlockText(id: CampUpgradeId): string {
  const u = CAMP_UPGRADES[id];
  const out: string[] = [];
  if (u.acts !== undefined) out.push(`Clear ${u.acts} act${u.acts === 1 ? '' : 's'}`);
  for (const m of MASTERY) if (m.reward.kind === 'camp' && m.reward.upgrade === id) out.push(`${HEROES[m.hero].name}: ${m.text.charAt(0).toLowerCase()}${m.text.slice(1)}`);
  return out.join(', or ');
}

export type UpgradeState = 'bought' | 'buy' | 'locked';

/** How long building takes on screen (dust, clangs, the object rising), ms. */
export const BUILD_MS = 1500;

export class UpgradesScreen {
  /** The spot whose card is open (null: none). */
  sel: CampUpgradeId | null = null;
  /** It needs no dim over the camp (build mode is the camp itself). */
  readonly staged = true;
  /** The upgrade being built now (its object rises out of the dust). */
  building: { id: CampUpgradeId; at: number } | null = null;
  private openAt = 0;
  private selAt = 0;
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: CampUpgradeId): void {
    ensureCampBuildArt(this.kit.s);
    this.openAt = now;
    this.sel = null;
    if (id) this.select(id, now);
  }

  select(id: CampUpgradeId | null, now: number): void {
    this.sel = id;
    this.selAt = now;
  }

  state(id: CampUpgradeId): UpgradeState {
    const p = this.kit.profile;
    if (hasCamp(p, id)) return 'bought';
    return campAvailable(p).includes(id) ? 'buy' : 'locked';
  }

  /** Something can be built now (available, not built, coins enough): the Camp button's "!". */
  canBuild(): boolean {
    const p = this.kit.profile;
    return CAMP_UPGRADE_IDS.some((id) => this.state(id) === 'buy' && p.coins >= CAMP_UPGRADES[id].cost);
  }

  /** How solid an upgrade's object stands in the camp: 0 not built, 1 built, between while it's being built. */
  objectAlpha(id: CampUpgradeId, now: number): number {
    if (!hasCamp(this.kit.profile, id)) return 0;
    const b = this.building;
    if (!b || b.id !== id) return 1;
    return clamp01((now - b.at - 350) / 800);
  }

  // ------------------------------------------------------------------ layout

  /** An upgrade's object (or ghost) on screen: its texture's rect at its spot. */
  objectRect(id: CampUpgradeId): Rect {
    const kit = this.kit;
    const key = BUILD_KEY[id];
    const [w, h] = kit.has(key) ? kit.imgs.size(key) : [20, 20];
    const at = BUILD_SPOTS[id];
    // the charm hangs from its hook; everything else stands on its feet
    if (id === 'rerollCharm') return { x: at.x - (w >> 1), y: at.y, w, h };
    return { x: at.x - (w >> 1), y: at.y - h, w, h };
  }

  /** Where a spot is tapped: its object, and the marker over it. */
  spotRect(id: CampUpgradeId): Rect {
    const r = this.objectRect(id);
    const m = this.markerAt(id);
    const top = Math.min(r.y, m.y - 7);
    return { x: Math.min(r.x, m.x - 7), y: top, w: Math.max(r.w, 14), h: r.y + r.h - top };
  }

  /** The hammer marker over a spot (its centre). */
  markerAt(id: CampUpgradeId): { x: number; y: number } {
    const r = this.objectRect(id);
    if (id === 'rerollCharm') return { x: r.x - 6, y: r.y + 5 };
    return { x: r.x + r.w / 2, y: r.y - 8 };
  }

  /** The open card's rect (beside or above its spot, inside the safe area, clear of the bars), or null. */
  cardRect(): Rect | null {
    const id = this.sel;
    if (!id) return null;
    const s = this.kit.s;
    const w = 132;
    const h = this.cardH(id, w);
    const o = this.objectRect(id);
    const m = this.markerAt(id);
    const top = 20;
    const bottom = s.B - 20;
    const cx = o.x + o.w / 2;
    // above the marker when there's room, else to the side away from the screen's edge it's nearer
    let y = Math.round(m.y - 8 - h);
    let x = Math.round(cx - w / 2);
    if (y < top) {
      y = Math.round(Math.max(top, Math.min(bottom - h, o.y + o.h / 2 - h / 2)));
      x = cx < (s.L + s.R) / 2 ? Math.round(o.x + o.w + 10) : Math.round(o.x - 10 - w);
    }
    x = Math.max(s.L + 3, Math.min(s.R - 3 - w, x));
    return { x, y, w, h };
  }

  private cardLines(id: CampUpgradeId, w: number): string[] {
    return wrapText(CAMP_UPGRADES[id].text, w - 10);
  }

  private cardH(id: CampUpgradeId, w: number): number {
    const lines = this.cardLines(id, w).length;
    const lockRow = this.state(id) === 'locked' ? 10 : 0;
    return 15 + lines * 8 + lockRow + 4 + 17 + 4;
  }

  /** The card's button: Build (with its price), Practice, or Built. */
  buyRect(): Rect {
    const c = this.cardRect() ?? { x: 0, y: -100, w: 132, h: 40 };
    return { x: c.x + 4, y: c.y + c.h - 21, w: c.w - 8, h: 17 };
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

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | 'practice' | 'progress' | 'pets' | void {
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
    const card = this.cardRect();
    if (card && this.sel) {
      const b = this.buyRect();
      if (inRect(b, x, y, 2)) {
        notePress(b);
        const st = this.state(this.sel);
        if (st === 'bought') {
          if (this.sel === 'dummy') return 'practice';
          if (this.sel === 'perch') return 'pets';
          kit.app.audio.uiClick();
          return;
        }
        return this.build(now);
      }
      if (inRect(card, x, y, 1)) return;
    }
    // a spot (its marker or its object): open its card (a second tap closes it)
    for (const id of [...CAMP_UPGRADE_IDS].reverse()) {
      if (!inRect(this.spotRect(id), x, y, 2)) continue;
      notePress(this.spotRect(id));
      kit.app.audio.uiClick();
      this.select(this.sel === id ? null : id, now);
      return;
    }
    if (this.sel) {
      this.select(null, now);
      kit.app.audio.panelClose();
    }
  }

  /** Build the open card's upgrade: pay, then the dust, the clangs and the object rising. */
  private build(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.sel!;
    const b = this.buyRect();
    if (this.state(id) === 'locked') {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(unlockText(id), b.x + b.w / 2, b.y - 6, 0xffd890, { life: 1600 });
      return;
    }
    if (!buyCamp(p, id)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float(`Need ${CAMP_UPGRADES[id].cost - p.coins} more coins`, b.x + b.w / 2, b.y - 6, 0xffb0a0, { life: 1400 });
      return;
    }
    kit.commit();
    this.building = { id, at: now };
    // the card closes so the building can be watched; the object then stands there (tap it for its card)
    this.select(null, now);
    kit.app.audio.shopBuy();
    const o = this.objectRect(id);
    const cx = o.x + o.w / 2;
    const foot = o.y + o.h;
    const dust = [0x8a7a62, 0x6a5a48, 0xb0a084, 0x4a3e34];
    // dust rolling up round the spot, puff after puff
    for (const t of [0, 220, 460, 700, 940]) kit.after(t, () => kit.fx.burst(cx + rand(-4, 4), foot - 3, dust, 14, 0.6, { kind: 'chip', g: -14, life: 700, up: 22, spread: 1.5 }));
    // three hammer clangs with sparks
    for (const t of [180, 560, 940])
      kit.after(t, () => {
        kit.app.audio.forgeHammer();
        kit.fx.sparks(cx + rand(-5, 5), o.y + o.h * 0.4, 8, rand(-1, 1));
      });
    // done: a burst of sparkles, a ring, its name
    kit.after(1180, () => {
      kit.app.audio.forgeUpgrade();
      kit.after(120, () => kit.app.audio.rareSting(false));
      kit.fx.burst(cx, o.y + o.h / 2, [0xfff0a0, 0xffd23a, WHITE, GREEN], 30, 1, { kind: 'star', g: 20, life: 850 });
      kit.fx.ring(cx, o.y + o.h / 2, 24, 0xfff0a0, 480);
      const label = `${CAMP_UPGRADES[id].name} built!`;
      const half = textWidth(label, 1, true) / 2 + 3;
      kit.fx.float(label, Math.max(kit.s.L + half, Math.min(kit.s.R - half, cx)), Math.max(26, o.y - 10), GREEN, { life: 1800 });
    });
    kit.after(BUILD_MS + 200, () => {
      if (this.building?.id === id) this.building = null;
    });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const s = kit.s;
    // a soft darkening at the edges only (the camp stays lit: it's what you're building on)
    const ek = enterK(now, this.openAt, 0, 0, 220);
    g.fillStyle(INK, 0.22 * ek);
    g.fillRect(-20, -10, 380, 22);
    this.drawSpots(now);
    this.drawHammers(now);
    // the top bar: Back, "Build", Progress, the coins
    kit.drawBack(g, now);
    const tk = easeBack((now - this.openAt) / 260, 1.5);
    kit.title(g, 'Build', kit.backRect().x + kit.backRect().w + 2, 3 - Math.round((1 - clamp01(tk)) * 16), RIBBON.gold);
    kit.button(g, kit.texts, this.progressRect(), 'Progress', FACE.blue, now, { icon: 'flag' });
    kit.coinsTag(g, kit.texts, this.coinsRect(), now);
    // the banner along the foot: what to do
    const left = CAMP_UPGRADE_IDS.filter((id) => this.state(id) !== 'bought').length;
    const bk = popK(now, this.openAt, 3, 40, 260);
    const msg = left ? 'Tap a hammer to build' : 'Every upgrade is built!';
    const bw = textWidth(msg, 1, true) + 22;
    const br = { x: Math.round((s.L + s.R) / 2 - bw / 2), y: s.B - 16 + Math.round((1 - bk) * 16), w: bw, h: 13 };
    if (!this.sel) {
      glass(g, br, { alpha: bk, rim: GOLD[2] });
      pix(kit.gOver, left ? 'hammer' : 'check', br.x + 5, br.y + 3, bk);
      kit.texts.text(msg, br.x + 16, br.y + 6.5, left ? WHITE : GREEN, { bold: true, oy: 0.5, alpha: bk });
    }
    this.drawCard(now);
  }

  /** Each spot: the ghost of what isn't built (pulsing), a glow round the one whose card is open. */
  private drawSpots(now: number): void {
    const kit = this.kit;
    CAMP_UPGRADE_IDS.forEach((id, i) => {
      const k = popK(now, this.openAt, i, 50, 260);
      if (k <= 0) return;
      const o = this.objectRect(id);
      const st = this.state(id);
      const on = this.sel === id;
      if (on) glow(kit.gBack, { x: o.x - 2, y: o.y - 2, w: o.w + 4, h: o.h + 4 }, 0xffd23a, 0.35 + 0.2 * pulse(now, 900), 3);
      if (st === 'bought' && !(this.building?.id === id)) return;
      const ghost = `${BUILD_KEY[id]}_ghost`;
      if (!kit.has(ghost)) return;
      const bk = this.building?.id === id ? 1 - clamp01((now - this.building.at - 300) / 700) : 1;
      const pl = pulse(now, 1400, i * 230);
      const a = (0.7 + 0.3 * pl) * k * bk;
      const col = st === 'locked' ? 0xb8b0d8 : 0xb0e4ff;
      if (id !== 'rerollCharm') fillEllipse(kit.gBack, o.x + o.w / 2, o.y + o.h - 1, o.w / 2 + 3, 3, col, (0.12 + 0.1 * pl) * k * bk);
      kit.imgs.at(ghost, o.x, o.y + Math.round((1 - k) * 4), D.actors + 0.0009, a, col);
    });
  }

  /** The hammer markers over the spots: gold (build it), grey with a padlock (not yet), a check (built). */
  private drawHammers(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const g = kit.gUi;
    CAMP_UPGRADE_IDS.forEach((id, i) => {
      const k = popK(now, this.openAt, i, 50, 260);
      if (k <= 0 || this.building?.id === id) return;
      const st = this.state(id);
      const m = this.markerAt(id);
      const bob = st === 'bought' ? 0 : Math.round(Math.sin(now / 420 + i * 1.3) * 1.5);
      // a press sinks it a px and flashes it
      const pressed = isPressed(this.spotRect(id), now);
      const cy = m.y + bob - Math.round((1 - k) * 8) + (pressed ? 1 : 0);
      if (pressed) fillEllipse(g, m.x, cy, 9, 9, WHITE, 0.35);
      const ready = st === 'buy' && p.coins >= CAMP_UPGRADES[id].cost;
      if (st === 'bought') return;
      const face = ready ? [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14] : st === 'buy' ? [0xd8d0f0, 0x8a7cc0, 0x5e5090, 0x2f2650] : [0x8a90a6, 0x5e6478, 0x484e60, 0x2a2e3a];
      if (ready) fillEllipse(g, m.x, cy, 9, 9, 0xffd23a, (0.15 + 0.15 * pulse(now, 900, i * 150)) * k);
      fillEllipse(g, m.x, cy + 1.5, 7, 7, INK, 0.45 * k);
      fillEllipse(g, m.x, cy, 7, 7, INK, k);
      fillEllipse(g, m.x, cy, 6, 6, face[2], k);
      fillEllipse(g, m.x - 0.5, cy - 0.5, 5, 5, face[1], k);
      g.fillStyle(face[0], k);
      g.fillRect(Math.round(m.x - 3), Math.round(cy - 5), 3, 1);
      // a tail down to the spot
      g.fillStyle(INK, k);
      g.fillRect(Math.round(m.x) - 1, Math.round(cy + 6), 3, 2);
      g.fillStyle(face[2], k);
      g.fillRect(Math.round(m.x), Math.round(cy + 6), 1, 1);
      const [hw, hh] = pixSize('hammer');
      pix(kit.gOver, 'hammer', Math.round(m.x - hw / 2), Math.round(cy - hh / 2), st === 'locked' ? 0.6 * k : k);
      if (st === 'locked') padlock(kit.gOver, Math.round(m.x + 2), Math.round(cy + 1), k, 0xd8901c);
    });
    // the hammers over a spot being built: two swinging in turn
    const b = this.building;
    if (b) {
      const t = now - b.at;
      if (t < 1150) {
        const o = this.objectRect(b.id);
        const cx = o.x + o.w / 2;
        for (const side of [-1, 1]) {
          const ph = ((t + (side > 0 ? 190 : 0)) % 380) / 380;
          const lift = Math.round(Math.abs(Math.sin(ph * Math.PI)) * 6);
          pix(kit.gTopOver, 'hammer', Math.round(cx + side * 9 - 3), Math.round(o.y + o.h * 0.3 - lift), 1);
        }
      }
    }
  }

  /** The open spot's card: the name, what it adds, and Build (its price) / what unlocks it / Built / Practice. */
  private drawCard(now: number): void {
    const kit = this.kit;
    const id = this.sel;
    const c = this.cardRect();
    if (!id || !c) return;
    const p = kit.profile;
    const l = kit.layer(true);
    const g = l.g;
    const texts = l.texts;
    const u = CAMP_UPGRADES[id];
    const st = this.state(id);
    const k = popK(now, this.selAt, 0, 0, 220);
    const a = clamp01(k * 1.5);
    const r = { ...c, y: c.y + Math.round((1 - k) * 6) };
    glass(g, r, { alpha: a, rim: st === 'bought' ? 0x2e8a34 : st === 'locked' ? 0x5e6478 : GOLD[2], clear: 0.08 });
    // a tail toward the spot
    const o = this.objectRect(id);
    const tx = Math.round(Math.max(r.x + 6, Math.min(r.x + r.w - 6, o.x + o.w / 2)));
    if (r.y + r.h < o.y) {
      g.fillStyle(INK, a);
      g.fillRect(tx - 2, r.y + r.h + 1, 5, 1);
      g.fillRect(tx - 1, r.y + r.h + 2, 3, 1);
      g.fillRect(tx, r.y + r.h + 3, 1, 1);
    }
    texts.text(u.name, r.x + 5, r.y + 3, st === 'locked' ? 0xc8c0e0 : WHITE, { bold: true, alpha: a });
    let y = r.y + 15;
    for (const line of this.cardLines(id, r.w)) {
      texts.text(line, r.x + 5, y, 0xe0d8f8, { alpha: a });
      y += 8;
    }
    if (st === 'locked') {
      padlock(l.over, r.x + 5, y + 1, a, 0xd8901c);
      texts.text(unlockText(id), r.x + 14, y, GOLD_TXT, { alpha: a });
    }
    const b0 = this.buyRect();
    const b = { ...b0, y: b0.y + Math.round((1 - k) * 6) };
    if (st === 'bought') {
      if (id === 'dummy') bigButton(kit, g, texts, b, 'Practice', FACE.green, now, { icon: 'target' });
      else if (id === 'perch') kit.button(g, texts, b, 'Companions', FACE.blue, now, { icon: 'paw' });
      else kit.button(g, texts, b, 'Built', FACE.gold, now, { icon: 'check' });
      return;
    }
    const short = p.coins < u.cost;
    if (st === 'locked') {
      kit.button(g, texts, b, 'Build', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt, cost: [{ icon: 'coin', n: u.cost }] });
      padlock(l.over, b.x + 4, b.y + 4, 1, 0xd8901c);
    } else if (short) kit.button(g, texts, b, 'Build', FACE.green, now, { icon: 'hammer', shakeAt: this.shakeAt, cost: [{ icon: 'coin', n: u.cost, short: true }] });
    else bigButton(kit, g, texts, b, 'Build', FACE.green, now, { icon: 'hammer', cost: [{ icon: 'coin', n: u.cost }] });
  }
}
