// The companions (a camp screen: tap the companion by the fire). All eight in a row along the top, each in a cell of
// its rarity's colours (a dark silhouette for one not found yet); the slots they go in on the top bar (one; two with
// the Companion Perch: tap a slot to choose which one Equip fills). Under the row, the one tapped: its card in a
// frame of its rarity, name, kind, rarity, stars and shards, level and XP (earned with your hero while it's along),
// how it attacks and its perks; Equip puts it in the chosen slot. One not found yet says "Found in hero chests".
import type Phaser from 'phaser';
import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../../data/companions';
import { TIER_INFO } from '../../data/rarity';
import { levelProgress } from '../../core/heroes';
import { equipPet, petLevel, petOwned, petSlots, shardsToNext } from '../../core/roster';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GOLD_TXT, GREEN, pix } from './camp-kit';
import { wrapFlow } from './heroes';
import { padlock, wrapText } from './items';
import { gauge, glow, GOLD, hudIcon, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

/** How a companion attacks, in plain words ("Pecks every 4 hits", "Breathes on every foe every 6 hits"). */
export function attackText(id: CompanionId): string {
  const c = COMPANIONS[id];
  const verb: Record<string, string> = { Kick: 'Kicks', Peck: 'Pecks', Bite: 'Bites', Zap: 'Zaps', Headbutt: 'Headbutts', Twinkle: 'Twinkles', Breath: 'Breathes' };
  return `${verb[c.attack] ?? c.attack}${c.allFoes ? ' on every foe' : ''} every ${c.every} hits`;
}

export class CompanionsScreen {
  sel: CompanionId = 'pip';
  /** The slot Equip fills (0 or 1 with the Perch). */
  slot = 0;
  private openAt = 0;
  private selAt = 0;
  private equipAt = -1e9;
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: CompanionId): void {
    const p = this.kit.profile;
    this.openAt = now;
    this.sel = id ?? p.petsOn[0] ?? 'pip';
    this.selAt = now;
    // Equip fills the slot the one shown is in (else the first)
    this.slot = Math.max(0, Math.min(petSlots(p) - 1, p.petsOn.indexOf(this.sel)));
  }

  // ------------------------------------------------------------------ layout

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  /** Companion i's cell in the row. */
  private cell(i: number): Rect {
    const c = this.card();
    const n = COMPANION_IDS.length;
    const w = Math.min(32, Math.floor((c.w - 10 - (n - 1) * 2) / n));
    const total = n * w + (n - 1) * 2;
    const x0 = Math.round(c.x + c.w / 2 - total / 2);
    return { x: x0 + i * (w + 2), y: c.y + 4, w, h: 22 };
  }

  /** The slots on the top bar (right of the HTML buttons in its middle). */
  slots(): Rect[] {
    const kit = this.kit;
    const s = kit.s;
    const n = 2;
    const out: Rect[] = [];
    for (let i = n - 1; i >= 0; i--) out.unshift({ x: s.R - 3 - (n - i) * 17 + 2, y: 3, w: 15, h: 13 });
    return out;
  }

  private frame(): Rect {
    const c = this.card();
    return { x: c.x + 6, y: c.y + 32, w: 46, h: 50 };
  }

  private col(): { x: number; w: number } {
    const c = this.card();
    const f = this.frame();
    const x = f.x + f.w + 7;
    return { x, w: c.x + c.w - 6 - x };
  }

  private equipRect(): Rect {
    const c = this.card();
    const label = this.equipLabel();
    const w = textWidth(label, 1, true) + 14 + (label === 'Equipped' ? 9 : 0);
    return { x: c.x + c.w - 6 - w, y: c.y + 32, w, h: 14 };
  }

  private equipLabel(): string {
    const p = this.kit.profile;
    if (!petOwned(p, this.sel)) return 'Locked';
    const at = p.petsOn.indexOf(this.sel);
    if (at < 0) return 'Equip';
    return petSlots(p) > 1 && at !== this.slot ? 'Move here' : 'Equipped';
  }

  /** "Unequip" (two slots, this companion along and another one too). */
  private unequipRect(): Rect | null {
    const p = this.kit.profile;
    if (petSlots(p) < 2 || !p.petsOn.includes(this.sel) || p.petsOn.length < 2) return null;
    const e = this.equipRect();
    const w = textWidth('Unequip', 1, true) + 14;
    return { x: e.x - 4 - w, y: e.y, w, h: 14 };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const app = kit.app;
    const p = kit.profile;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (let i = 0; i < COMPANION_IDS.length; i++) {
      const r = this.cell(i);
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      if (this.sel !== COMPANION_IDS[i]) {
        this.sel = COMPANION_IDS[i];
        this.selAt = now;
        kit.fadeToast();
        app.audio.uiClick();
      }
      return;
    }
    const sl = this.slots();
    for (let i = 0; i < sl.length; i++) {
      if (!inRect(sl[i], x, y, 1)) continue;
      notePress(sl[i]);
      if (i >= petSlots(p)) {
        kit.app.audio.lockToggle();
        kit.fx.float('Camp upgrade: Companion Perch', sl[i].x - 40, sl[i].y + 22, 0xffb0a0, { life: 1500 });
        return;
      }
      this.slot = i;
      const on = p.petsOn[i];
      if (on) {
        this.sel = on;
        this.selAt = now;
      }
      app.audio.uiClick();
      return;
    }
    const u = this.unequipRect();
    if (u && inRect(u, x, y, 2)) {
      notePress(u);
      const at = p.petsOn.indexOf(this.sel);
      if (equipPet(p, at, null)) {
        kit.commit();
        app.audio.panelClose();
        this.slot = 0;
      }
      return;
    }
    const e = this.equipRect();
    if (inRect(e, x, y, 2)) {
      notePress(e);
      this.equip(now);
    }
  }

  private equip(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.sel;
    if (!petOwned(p, id)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      return;
    }
    const at = p.petsOn.indexOf(id);
    if (at === this.slot || (at >= 0 && petSlots(p) < 2)) {
      kit.app.audio.uiClick();
      const e = this.equipRect();
      kit.fx.float('Already along', e.x + e.w / 2, e.y + e.h + 8, 0xd8d0f0, { life: 1000 });
      return;
    }
    if (!equipPet(p, this.slot, id)) return;
    kit.commit();
    this.equipAt = now;
    kit.app.audio.equip();
    const f = this.frame();
    kit.fx.flash(f, WHITE, 380);
    kit.fx.burst(f.x + f.w / 2, f.y + f.h / 2, [0xfff0a0, WHITE, GREEN, TIER_INFO[COMPANIONS[id].rarity].face[0]], 22, 1, { kind: 'star', g: 30, life: 650 });
    const s = this.slots()[this.slot];
    kit.fx.fly({ color: TIER_INFO[COMPANIONS[id].rarity].face[1], x0: f.x + f.w / 2, y0: f.y + 10, x1: s.x + s.w / 2, y1: s.y + s.h / 2, arc: 20, life: 420 });
    kit.fx.float(`${COMPANIONS[id].name} comes along!`, f.x + f.w / 2 + 60, f.y + 4, GREEN, { life: 1500 });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    kit.title(g, 'Companions', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.green);
    this.drawSlots(g, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    COMPANION_IDS.forEach((id, i) => this.drawCell(g, id, i, now));
    kit.divider(g, c0.x + 6, c0.y + 29, c0.w - 12);
    this.drawDetail(g, now);
  }

  /** The slots: each one's companion (a face in its rarity's frame), the one Equip fills lifted; the second slot
   *  padlocked until the Companion Perch is built. */
  private drawSlots(g: G, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const n = petSlots(p);
    const sl = this.slots();
    const label = n > 1 ? 'Along' : 'Along';
    kit.texts.text(label, sl[0].x - 4, 9.5, 0xc8e8c0, { ox: 1, oy: 0.5 });
    sl.forEach((r, i) => {
      const id = p.petsOn[i];
      const on = i === this.slot && n > 1;
      const pr = isPressed(r, now);
      const y = r.y + (on ? -1 : pr ? 1 : 0);
      const face = i >= n ? ([0x6a6078, 0x4a4058, 0x3a3048, 0x2a2438] as const) : id ? TIER_INFO[COMPANIONS[id].rarity].face : ([0x8a7cc0, 0x413668, 0x2f2650, 0x1b1530] as const);
      if (on) glow(g, r, 0xffd23a, 0.3 + 0.2 * pulse(now, 900), 2);
      rows(g, r.x - 1, y - 1, r.w + 2, r.h + 2, 2, INK);
      rows(g, r.x, y, r.w, r.h, 2, on ? GOLD[3] : face[1]);
      g.fillStyle(on ? GOLD[4] : face[0], 1);
      g.fillRect(r.x + 2, y, r.w - 4, 1);
      g.fillStyle(0x120e1e, 1);
      g.fillRect(r.x + 2, y + 1, r.w - 4, r.h - 3);
      if (i >= n) padlock(kit.gOver, r.x + 3, y + 2, 1, 0xd8901c);
      else if (id) this.mini(id, r.x + 2, y + 1, r.w - 4, r.h - 3, D.icons);
    });
  }

  /** A companion's idle frame, cropped round its middle to fit a w x h window at (x, y). */
  private mini(id: CompanionId, x: number, y: number, w: number, h: number, depth: number, o: { tint?: number; alpha?: number; frame?: number } = {}): void {
    const kit = this.kit;
    const key = id === 'pip' ? `pip_idle${o.frame ?? 0}` : `comp_${id}_idle${o.frame ?? 0}`;
    if (!kit.has(key)) return;
    const [tw, th] = kit.imgs.size(key);
    // the creature sits in the lower middle of its 36x24 box
    const cx = Math.round(tw / 2 - w / 2);
    const cy = Math.max(0, Math.min(th - h, Math.round(th * 0.62 - h / 2)));
    kit.sprites.draw(key, x, y, depth, { crop: [cx, cy, Math.min(w, tw), Math.min(h, th)], tint: o.tint, alpha: o.alpha });
  }

  private drawCell(g: G, id: CompanionId, i: number, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const r = this.cell(i);
    const owned = petOwned(p, id);
    const sel = this.sel === id;
    const ik = clamp01((now - this.openAt - 80 - i * 35) / 160);
    if (ik <= 0) return;
    const tier = COMPANIONS[id].rarity;
    if (sel) glow(g, r, 0xffd23a, 0.35 + 0.25 * pulse(now, 1000), 3);
    kit.rarityFrame(g, r, tier, now, { dark: !owned, alpha: ik });
    const bob = owned ? Math.floor((now + i * 170) / 360) % 2 : 0;
    this.mini(id, r.x + 2, r.y + 2, r.w - 4, r.h - 4, D.icons, { tint: owned ? undefined : 0x241c3a, alpha: ik, frame: bob });
    if (!owned) kit.texts.text('?', r.x + r.w / 2, r.y + r.h / 2, 0x8a7cc0, { bold: true, ox: 0.5, oy: 0.5, alpha: ik });
    // along: a green check on the corner; stars as gold dots along the foot
    if (p.petsOn.includes(id) && owned) pix(kit.gOver, 'check', r.x + r.w - 7, r.y - 3, ik);
    if (owned) {
      const st = p.pets[id].stars;
      for (let s = 0; s < st; s++) {
        const sx = Math.round(r.x + r.w / 2 - (st * 3 - 1) / 2 + s * 3);
        kit.gOver.fillStyle(INK, ik);
        kit.gOver.fillRect(sx - 1, r.y + r.h - 3, 3, 3);
        kit.gOver.fillStyle(0xffd23a, ik);
        kit.gOver.fillRect(sx, r.y + r.h - 2, 1, 1);
      }
    }
    if (sel) {
      // a marker under the selected one
      g.fillStyle(GOLD[3], 1);
      g.fillRect(r.x + r.w / 2 - 2, r.y + r.h + 2, 5, 1);
      g.fillRect(r.x + r.w / 2 - 1, r.y + r.h + 1, 3, 1);
    }
  }

  /** The one tapped: its card, name, kind, rarity, stars, level, attack and perks; Equip. */
  private drawDetail(g: G, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const texts = kit.texts;
    const id = this.sel;
    const def = COMPANIONS[id];
    const owned = petOwned(p, id);
    const c = this.card();
    const a = clamp01((now - this.selAt) / 180);
    const f = this.frame();
    // the card in its rarity frame
    const ek = now - this.equipAt;
    const hop = ek < 380 ? Math.round(Math.sin((ek / 380) * Math.PI) * 4) : 0;
    kit.rarityFrame(g, f, def.rarity, now, { dark: !owned });
    const key = `comp_card_${id}`;
    if (kit.has(key)) {
      const [w, h] = kit.imgs.size(key);
      const inner = { x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6 };
      const ch = Math.min(h, inner.h + hop);
      kit.sprites.draw(key, inner.x + Math.round((inner.w - w) / 2), inner.y - hop, D.icons, { crop: [Math.max(0, Math.round((w - inner.w) / 2)), 0, Math.min(w, inner.w), ch], tint: owned ? undefined : 0x241c3a, alpha: a });
    }
    if (!owned) texts.text('?', f.x + f.w / 2, f.y + f.h / 2, 0x8a7cc0, { bold: true, scale: 2, ox: 0.5, oy: 0.5 });
    const col = this.col();
    // name (big when it fits before the buttons), kind and rarity
    const e = this.equipRect();
    const u = this.unequipRect();
    const nameRight = (u ?? e).x - 4;
    const big = col.x + textWidth(def.name, 2, true) <= nameRight;
    texts.text(def.name, col.x, f.y + 7, owned ? WHITE : 0x9a90b8, { bold: true, scale: big ? 2 : 1, oy: 0.5, extrude: 1, extrudeCol: NAVY[1], alpha: a });
    if (owned) {
      const label = this.equipLabel();
      if (label === 'Equipped') kit.button(g, texts, e, 'Equipped', FACE.gold, now, { icon: 'check' });
      else kit.button(g, texts, e, label, FACE.green, now, { glowCol: 0x8af06a });
      if (u) kit.button(g, texts, u, 'Unequip', FACE.navy, now);
    } else {
      kit.button(g, texts, e, 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
      padlock(kit.gOver, e.x + 4, e.y + 4, 1, 0xd8901c);
    }
    let y = f.y + 22;
    let x = col.x;
    x += kit.rarityTag(g, texts, def.rarity, x, y, a) + 5;
    texts.text(def.kind, x, y, 0xffd890, { oy: 0.5, alpha: a });
    x += textWidth(def.kind, 1, false) + 6;
    if (owned) {
      const pr = p.pets[id];
      x += kit.starRow(g, x, y - 4, pr.stars, { alpha: a }) + 4;
      const need = shardsToNext(kit.tuning, pr.stars);
      if (x + 40 <= c.x + c.w - 6) {
        hudIcon(g, 'shard', x, y - 6, 1, a);
        texts.text(need === null ? 'Max' : `${pr.shards}/${need}`, x + 11, y, need === null ? GOLD_TXT : 0xe0d0ff, { bold: true, oy: 0.5, alpha: a });
      }
    } else {
      const msg = 'Found in hero chests';
      const w = textWidth(msg, 1, true) + 16;
      const r = { x: Math.min(x, c.x + c.w - 6 - w), y: y - 6, w, h: 12 };
      glow(g, r, GOLD[3], 0.2 + 0.25 * pulse(now, 1200), 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
      padlock(kit.gOver, r.x + 3, r.y + 2, a, 0xfff0a0);
      texts.text(msg, r.x + 12, r.y + 6, 0x5a2a08, { bold: true, oy: 0.5, alpha: a });
    }
    // level and XP (from the XP your hero earns with it along), and its attack
    y += 11;
    if (owned) {
      const pr = p.pets[id];
      const lv = petLevel(kit.tuning, pr.xp);
      const max = Math.round(kit.tuning.pets.maxLevel);
      const lp = levelProgress(kit.tuning, pr.xp);
      const lt = `Lv ${lv}`;
      const lw = textWidth(lt, 1, true) + 8;
      tag(g, { x: col.x, y: y - 5, w: lw, h: 10 }, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
      texts.text(lt, col.x + lw / 2, y, 0x3a1e08, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      // its XP bar (when there's room for it) and its attack: beside the level when it fits, else under it
      const at = attackText(id);
      const right = c.x + c.w - 6;
      const barW = col.x + lw + 3 + 28 + 5 + textWidth(at, 1, false) <= right ? 28 : 0;
      if (barW) gauge(g, col.x + lw + 3, y - 3, barW, 6, lv >= max ? 1 : lp.need ? lp.into / lp.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a] });
      const ax = col.x + lw + (barW ? barW + 8 : 5);
      if (ax + textWidth(at, 1, false) <= right) texts.text(at, ax, y, 0xd8d0f0, { oy: 0.5, alpha: a });
      else {
        y += 9;
        texts.text(at, col.x, y, 0xd8d0f0, { oy: 0.5, alpha: a });
      }
    } else texts.text(attackText(id), col.x, y, DIM_TXT, { oy: 0.5, alpha: a });
    // the perks, each "Name: what it does", wrapped
    y += 10;
    const bottom = c.y + c.h - 4;
    def.perks.forEach((pk, i) => {
      const ik = clamp01((now - this.selAt - 80 - i * 60) / 160);
      if (ik <= 0) return;
      const nm = `${pk.name}:`;
      const nw = textWidth(nm, 1, false);
      const lines = wrapFlow(pk.text, col.w - nw - 4, col.w);
      if (y + 4 > bottom) return;
      texts.text(nm, col.x, y, owned ? 0xb4f070 : 0x8aa070, { oy: 0.5, alpha: ik });
      lines.forEach((l, j) => l && y + j * 8 + 4 <= bottom && texts.text(l, j === 0 ? col.x + nw + 4 : col.x, y + j * 8, owned ? 0xe8e0f8 : DIM_TXT, { oy: 0.5, alpha: ik }));
      y += lines.length * 8 + 1;
    });
    // the joke, when there's room
    if (y + 4 <= bottom) {
      const bio = wrapText(def.bio, c.x + c.w - 6 - col.x);
      if (y + bio.length * 8 <= bottom + 4) bio.forEach((l, j) => texts.text(l, col.x, y + 1 + j * 8, 0x9a90c0, { oy: 0.5, alpha: a }));
    }
  }
}
