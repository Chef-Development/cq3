// The companions (a camp screen: tap a companion by the fire). A moonlit night grove (art-grove.ts) with the one on
// view big (3x) on a mossy stump under a soft light, its rarity's aura behind it, idling (fliers hover and flap,
// walkers breathe; a tap makes it show its attack), fireflies drifting. Its name over it, its rarity and role as chips
// (an "i" opens a sheet: its kind, its joke, how companions grow). The strip across the top: all eight as round
// tokens in their rarity's ring (a dark one for one not found yet; a check on those along). On the right: its level
// and XP, its stars and shards as meters, then what it does as cards on glass (its attack first, then each perk: the
// playtester likes reading these). Under the stump: the two "Along" sockets (the second padlocked until the Companion
// Perch is built: tap one to pick the slot Equip fills) and the big button: Equip, Unequip, Along (the only one along)
// or Locked (one not found yet: found in hero chests).
import type Phaser from 'phaser';
import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../../data/companions';
import { TIER_INFO } from '../../data/rarity';
import { levelProgress } from '../../core/heroes';
import { equipPet, petLevel, petOwned, petSlots, shardsToNext } from '../../core/roster';
import { ensureGroveArt, GROVE_STUMP_TOP, GROVE_THEME } from '../art-grove';
import { STAGE_THEMES } from '../art-ui-stage';
import { textWidth } from '../font';
import { CampKit, D, GOLD_TXT, GREEN, pix } from './camp-kit';
import { gauge, glow, GOLD } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, tag } from './ui';
import { aura, bigButton, bigName, drawStage, enterK, fillEllipse, glass, infoButton, opaqueBox, popK, Sheet, spotlight, textCard, textCardH, textCardLines, token, type Face } from './ui-modern';

type G = Phaser.GameObjects.Graphics;

/** How a companion attacks, in plain words ("Pecks every 4 hits", "Breathes on every foe every 6 hits"). */
export function attackText(id: CompanionId): string {
  const c = COMPANIONS[id];
  const verb: Record<string, string> = { Kick: 'Kicks', Peck: 'Pecks', Bite: 'Bites', Zap: 'Zaps', Headbutt: 'Headbutts', Twinkle: 'Twinkles', Breath: 'Breathes' };
  return `${verb[c.attack] ?? c.attack}${c.allFoes ? ' on every foe' : ''} every ${c.every} hits`;
}

/** Each perk's icon and colour (by its name), the attack's own. */
const PERK_LOOK: Record<string, { icon: string; col: number; text: number }> = {
  'Lucky Foot': { icon: 'coin', col: 0x9a6a14, text: 0xffe680 },
  'Owl Watch': { icon: 'feather', col: 0x3a6ab0, text: 0x9ad8ff },
  'Ember Bite': { icon: 'flame', col: 0xa8401c, text: 0xffb070 },
  'Oil Can': { icon: 'clock', col: 0x3a7a5a, text: 0xb4f070 },
  'Rock Wall': { icon: 'shield', col: 0x4a5a8a, text: 0xb8d0ff },
  'Chill Bite': { icon: 'flake', col: 0x2a7aa0, text: 0xa8ecff },
  'Snow Dash': { icon: 'flake', col: 0x2a7aa0, text: 0xa8ecff },
  Starlight: { icon: 'star', col: 0x7a4ab0, text: 0xe8c8ff },
  Mend: { icon: 'heartS', col: 0x9a2a3a, text: 0xffa8b0 },
  'Gold Hoard': { icon: 'coin', col: 0x9a6a14, text: 0xffe680 },
  'Fire Breath': { icon: 'flame', col: 0xa8401c, text: 0xffb070 },
  'Warm Glow': { icon: 'flame', col: 0xb8601c, text: 0xffd08a },
};
const ATTACK_LOOK = { icon: 'crit', col: 0x8a2a2a, text: 0xffffff };


// fireflies over the grove: a home spot each, slow loops, blinking (offsets from the stage's centre)
const FLIES = Array.from({ length: 7 }, (_, i) => ({
  x: -46 + ((i * 41) % 96),
  y: 30 + ((i * 29) % 60),
  ax: 5 + (i % 3) * 3,
  ay: 3 + (i % 2) * 3,
  f1: 0.00033 + (i % 4) * 0.00008,
  f2: 0.00051 + (i % 3) * 0.0001,
  ph: i * 1.9,
  blink: 1700 + (i % 3) * 600,
}));

export class CompanionsScreen {
  sel: CompanionId = 'pip';
  /** The slot Equip fills (0, or 1 with the Perch). */
  slot = 0;
  /** It draws its own stage (the camp skips its dim behind it). */
  readonly staged = true;
  private openAt = 0;
  private selAt = 0;
  private equipAt = -1e9;
  private shakeAt = -1e9;
  private actAt = -1e9;
  private sockAt = [-1e9, -1e9];
  private readonly sheet = new Sheet();

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: CompanionId): void {
    const p = this.kit.profile;
    ensureGroveArt(this.kit.s);
    this.openAt = now;
    this.sheet.open = false;
    this.select(id ?? p.petsOn[0] ?? 'pip', now);
    // Equip fills the slot the one shown is in (else the first)
    this.slot = Math.max(0, Math.min(petSlots(p) - 1, p.petsOn.indexOf(this.sel)));
  }

  /** Show companion `id` (it drops onto the stump; Equip aims at an empty slot when there is one). */
  select(id: CompanionId, now: number): void {
    const p = this.kit.profile;
    const changed = id !== this.sel;
    this.sel = id;
    this.selAt = now;
    if (!p.petsOn.includes(id) && petSlots(p) > 1 && p.petsOn.length < petSlots(p)) this.slot = p.petsOn.length;
    if (changed && now - this.openAt > 200) this.kit.after(200, () => this.landPuff());
  }

  // ------------------------------------------------------------------ layout

  /** The stage: its centre x, the stump's top face (where the companion's feet go). */
  private stage(): { cx: number; top: number } {
    const s = this.kit.s;
    return { cx: s.L + 60, top: s.B - 38 };
  }

  /** The right column (meters, then cards). */
  private col(): Rect {
    const s = this.kit.s;
    const x = s.L + 124;
    return { x, y: 21, w: s.R - 3 - x, h: s.B - 3 - 21 };
  }

  /** Companion i's token in the strip across the top (hopping over the HTML buttons in the middle). */
  cell(i: number): Rect {
    const kit = this.kit;
    const b = kit.backRect();
    const n = COMPANION_IDS.length;
    const rs = kit.topRow(Array(n).fill(17), b.x + b.w + 6, kit.s.R - 3, 2, 1, 17) ?? kit.topRow(Array(n).fill(17), b.x + b.w + 4, 1e9, 1, 1, 17)!;
    return rs[i];
  }

  /** The "Along" sockets, bottom left (two: the second padlocked until the Companion Perch). */
  slots(): Rect[] {
    const s = this.kit.s;
    return [0, 1].map((i) => ({ x: s.L + 4 + i * 20, y: s.B - 19, w: 17, h: 17 }));
  }

  equipRect(): Rect {
    const s = this.kit.s;
    const x = s.L + 46;
    return { x, y: s.B - 20, w: Math.max(66, s.L + 120 - x), h: 18 };
  }

  /** The "i" (the sheet), right after the name. */
  private infoRect(): Rect {
    const st = this.stage();
    const w = textWidth(COMPANIONS[this.sel].name, 2, true);
    return { x: Math.round(st.cx + w / 2 + 3), y: 20, w: 11, h: 11 };
  }

  /** The rarity chip and the stars under the name (their left end and total width). */
  private chipRow(): Rect {
    const def = COMPANIONS[this.sel];
    const w = textWidth(TIER_INFO[def.rarity].name, 1, true) + 8 + 5 + 45;
    const st = this.stage();
    return { x: Math.round(st.cx - w / 2), y: 33, w, h: 10 };
  }

  /** The companion's sprite now: key, and whether it hovers. */
  private frameKey(id: CompanionId, now: number): string {
    const fly = COMPANIONS[id].flies;
    if (now - this.actAt < 320 || now - this.equipAt < 320) return id === 'pip' ? 'pip_dive' : `comp_${id}_act`;
    const per = fly ? 140 : 380;
    const f = Math.floor(now / per) % 2;
    return id === 'pip' ? `pip_idle${f}` : `comp_${id}_idle${f}`;
  }

  /** Where the companion is drawn at 3x (its top-left), and the centre of what it shows. */
  private creature(now: number): { key: string; x: number; y: number; cx: number; cy: number; top: number } {
    const kit = this.kit;
    const id = this.sel;
    const key = this.frameKey(id, now);
    const st = this.stage();
    const box = kit.has(key) ? opaqueBox(kit, key) : { x: 10, y: 6, w: 16, h: 16 };
    const fly = COMPANIONS[id].flies;
    // the drop onto the stump when it's chosen (a little overshoot), the hop when it acts or comes along
    const dk = clamp01((now - this.selAt) / 260);
    const drop = -Math.round((1 - easeBack(dk, 1.4)) * 26);
    const ak = Math.min(now - this.actAt, now - this.equipAt);
    const hop = ak < 360 ? Math.round(Math.sin((ak / 360) * Math.PI) * 6) : 0;
    const bob = fly ? Math.round(Math.sin(now / 320) * 2) : 0;
    const x = Math.round(st.cx - (box.x + box.w / 2) * 3);
    // walkers stand on the face (their soles' row on it); fliers hover with their middle 24 px above it
    const y = fly ? Math.round(st.top - 22 - (box.y + box.h / 2) * 3) + bob : Math.round(st.top + 2 - (box.y + box.h) * 3);
    return { key, x, y: y + drop - hop, cx: st.cx, cy: y + drop - hop + (box.y + box.h / 2) * 3, top: y + drop - hop + box.y * 3 };
  }

  private equipLabel(): 'Locked' | 'Equip' | 'Unequip' | 'Along' {
    const p = this.kit.profile;
    if (!petOwned(p, this.sel)) return 'Locked';
    if (!p.petsOn.includes(this.sel)) return 'Equip';
    return p.petsOn.length > 1 ? 'Unequip' : 'Along';
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const app = kit.app;
    const p = kit.profile;
    if (this.sheet.tap(now)) return;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (let i = 0; i < COMPANION_IDS.length; i++) {
      const r = this.cell(i);
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      if (this.sel !== COMPANION_IDS[i]) {
        this.select(COMPANION_IDS[i], now);
        kit.fadeToast();
        app.audio.uiClick();
      }
      return;
    }
    const sl = this.slots();
    for (let i = 0; i < sl.length; i++) {
      if (!inRect(sl[i], x, y, 2)) continue;
      notePress(sl[i]);
      if (i >= petSlots(p)) {
        app.audio.lockToggle();
        this.sockAt[i] = now;
        kit.fx.float('Build the Companion Perch', sl[i].x + 40, sl[i].y - 8, 0xffb0a0, { life: 1500 });
        return;
      }
      this.slot = i;
      const on = p.petsOn[i];
      if (on && on !== this.sel) this.select(on, now);
      app.audio.uiClick();
      return;
    }
    const inf = this.infoRect();
    if (inRect(inf, x, y, 3)) {
      notePress(inf);
      app.audio.panelOpen();
      return this.showSheet(now);
    }
    const e = this.equipRect();
    if (inRect(e, x, y, 2)) {
      notePress(e);
      return this.equip(now);
    }
    // the companion itself: it shows its attack
    const c = this.creature(now);
    if (petOwned(p, this.sel) && Math.abs(x - c.cx) < 26 && y > c.top - 6 && y < this.stage().top + 4) {
      this.actAt = now;
      app.audio.pet();
      const col = TIER_INFO[COMPANIONS[this.sel].rarity].face[0];
      kit.fx.burst(c.cx + 14, c.cy - 4, [col, WHITE, 0xfff0a0], 10, 0.7, { kind: 'star', g: 20, life: 500 });
    }
  }

  private showSheet(now: number): void {
    const def = COMPANIONS[this.sel];
    this.sheet.show(
      def.name,
      [
        { text: `${def.kind}, ${def.role.toLowerCase()}. ${def.bio}`, col: 0xfff0c0 },
        { text: `${attackText(this.sel)}.`, icon: 'crit' },
        { text: 'Levels up from XP earned while it comes along.', icon: 'up' },
        { text: 'Dupes from chests give shards; enough add a star.', icon: 'shard' },
      ],
      now,
      TIER_INFO[def.rarity].face,
    );
  }

  private equip(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.sel;
    const label = this.equipLabel();
    const e = this.equipRect();
    if (label === 'Locked') {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float('Found in hero chests', e.x + e.w / 2, e.y - 8, 0xffd890, { life: 1400 });
      return;
    }
    if (label === 'Along') {
      kit.app.audio.uiClick();
      kit.fx.float('Already along', e.x + e.w / 2, e.y - 8, 0xd8d0f0, { life: 1000 });
      return;
    }
    if (label === 'Unequip') {
      const at = p.petsOn.indexOf(id);
      if (!equipPet(p, at, null)) return;
      kit.commit();
      kit.app.audio.panelClose();
      this.slot = Math.min(this.slot, p.petsOn.length);
      const s = this.slots()[at];
      kit.fx.burst(s.x + s.w / 2, s.y + s.h / 2, [0x8a7cc0, 0xd8d0f0], 10, 0.6, { kind: 'chip', g: 60, life: 450 });
      return;
    }
    const slot = Math.min(this.slot, petSlots(p) - 1);
    if (!equipPet(p, slot, id)) return;
    kit.commit();
    this.equipAt = now;
    this.sockAt[slot] = now + 380;
    kit.app.audio.equip();
    const c = this.creature(now);
    const tierCol = TIER_INFO[COMPANIONS[id].rarity].face;
    kit.fx.burst(c.cx, c.cy, [0xfff0a0, WHITE, GREEN, tierCol[0]], 26, 1, { kind: 'star', g: 30, life: 700 });
    kit.fx.ring(c.cx, c.cy, 30, tierCol[0], 460);
    const s = this.slots()[p.petsOn.indexOf(id)] ?? this.slots()[0];
    kit.fx.fly({ color: tierCol[1], x0: c.cx, y0: c.cy, x1: s.x + s.w / 2, y1: s.y + s.h / 2, arc: 24, life: 380 });
    kit.after(380, () => {
      kit.fx.ring(s.x + s.w / 2, s.y + s.h / 2, 14, 0xfff0a0, 360);
      kit.fx.burst(s.x + s.w / 2, s.y + s.h / 2, [0xfff0a0, WHITE], 10, 0.6, { kind: 'star', g: 0, life: 400 });
    });
    kit.fx.float('Comes along!', c.cx, c.top - 8, GREEN, { life: 1500 });
  }

  /** A puff of dust where the companion lands on the stump. */
  private landPuff(): void {
    const st = this.stage();
    if (COMPANIONS[this.sel].flies) return;
    this.kit.fx.burst(st.cx, st.top + 1, [0x8a7a5a, 0x6a5a44, 0xb0a080], 12, 0.45, { kind: 'chip', g: 80, life: 420, up: 25, spread: 1.4 });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gUi;
    const p = kit.profile;
    const def = COMPANIONS[this.sel];
    const owned = petOwned(p, this.sel);
    const ek = enterK(now, this.openAt, 0, 0, 240);
    const theme = STAGE_THEMES[GROVE_THEME] ?? STAGE_THEMES.night;
    drawStage(kit, GROVE_THEME, now, { alpha: ek, motes: true });
    const st = this.stage();
    // the light on the stump (it breathes, flickers a touch), the rarity's aura, the fireflies
    const flick = 0.9 + 0.1 * pulse(now, 1300) + 0.04 * Math.sin(now / 97);
    spotlight(g, st.cx, -4, st.top + 2, 26, 62, theme.light, (owned ? 0.075 : 0.04) * ek, flick);
    const k = popK(now, this.openAt, 2, 40, 300);
    const c = this.creature(now);
    const enterDy = Math.round((1 - k) * 18);
    if (owned) {
      // a soft halo in the rarity's colour under the aura's rings, so even a Common one stands in a glow
      const [hi, base] = TIER_INFO[def.rarity].face;
      fillEllipse(g, st.cx, c.cy + enterDy, 46 * k, 36 * k, base, 0.07 * k);
      fillEllipse(g, st.cx, c.cy + enterDy, 34 * k, 27 * k, hi, 0.05 * k);
      aura(kit, g, st.cx, c.cy + enterDy, 36, 30, def.rarity, now, k);
    }
    this.drawFlies(g, st.cx, now, ek);
    // the stump, then the companion on it (a dark shape with a "?" for one not found yet)
    kit.imgs.at('grove_stump', st.cx - GROVE_STUMP_TOP.x, st.top - GROVE_STUMP_TOP.y + Math.round((1 - ek) * 10), D.icons - 0.004, ek);
    if (kit.has(c.key) && k > 0) {
      if (def.flies) fillEllipse(kit.gOver, st.cx, st.top, 10 - Math.abs(Math.sin(now / 320)) * 2, 2, INK, 0.3 * k);
      kit.sprites.draw(c.key, c.x, c.y + enterDy, D.icons, { scale: 3, alpha: clamp01(k * 1.5), tint: owned ? undefined : 0x1a1430 });
    }
    if (!owned && k > 0.5) kit.texts.text('?', st.cx, c.cy + enterDy, 0xa898d8, { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: clamp01((k - 0.5) * 2) });
    this.drawName(g, now);
    this.drawStrip(now);
    this.drawSockets(now);
    this.drawButton(g, now);
    this.drawMeters(g, now);
    this.drawCards(now);
    kit.drawBack(g, now);
    this.sheet.draw(kit, { x: s.L + 6, y: 20, w: s.R - s.L - 12, h: s.B - 24 }, now);
  }

  /** Fireflies drifting over the grove, blinking. */
  private drawFlies(g: G, cx: number, now: number, a: number): void {
    for (const f of FLIES) {
      const x = cx + f.x + Math.sin(now * f.f1 + f.ph) * f.ax * 2;
      const y = f.y + Math.cos(now * f.f2 + f.ph) * f.ay * 2;
      const b = pulse(now, f.blink, f.ph * 300);
      if (b < 0.3) continue;
      const k = ((b - 0.3) / 0.7) * a;
      g.fillStyle(0xd8ff8a, 0.2 * k);
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle(0xf0ffc0, k);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /** The name, big, over the stage; its rarity and role as chips, and the "i". */
  private drawName(g: G, now: number): void {
    const kit = this.kit;
    const def = COMPANIONS[this.sel];
    const owned = petOwned(kit.profile, this.sel);
    const a = enterK(now, this.selAt, 0, 0, 200) * enterK(now, this.openAt, 1, 40, 220);
    const st = this.stage();
    bigName(kit.texts, def.name, st.cx, 25 - Math.round((1 - a) * 4), owned ? WHITE : 0xb0a8c8, { ox: 0.5, alpha: a, ext: owned ? mix(TIER_INFO[def.rarity].face[3], INK, 0.3) : 0x2a2438 });
    const cr = this.chipRow();
    // on a glass pill over the stage and the name (a tall companion's ears, a "y" pass behind it)
    glass(kit.gTop, { x: cr.x - 2, y: cr.y - 1, w: cr.w + 4, h: cr.h + 2 }, { alpha: 0.85 * a, clear: 0.3 });
    const x = cr.x + kit.rarityTag(kit.gTop, kit.topTexts, def.rarity, cr.x, cr.y + 5, a) + 5;
    void g;
    // its stars (duplicates' shards raise them)
    kit.starRow(kit.gTop, x, cr.y + 1, owned ? kit.profile.pets[this.sel].stars : 0, { alpha: a });
    if (a > 0.5) infoButton(kit.gOver, kit.texts, this.infoRect(), now);
  }

  /** The strip of companions: round tokens in their rarity's rings. */
  private drawStrip(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const l = kit.layer();
    COMPANION_IDS.forEach((id, i) => {
      const k = popK(now, this.openAt, i, 30, 220);
      if (k <= 0) return;
      const r0 = this.cell(i);
      const r = { ...r0, y: r0.y - Math.round((1 - k) * 8) };
      const owned = petOwned(p, id);
      const key = id === 'pip' ? 'pip_idle0' : `comp_${id}_idle0`;
      const rr = token(kit, l, r, { face: TIER_INFO[COMPANIONS[id].rarity].face, sprite: kit.has(key) ? { key, at: this.faceAt(key), tint: owned ? undefined : 0x241c3a } : undefined, dim: !owned, selected: this.sel === id, check: owned && p.petsOn.includes(id), alpha: clamp01(k * 1.4) }, now);
      if (!owned) kit.texts.text('?', rr.x + rr.w / 2, rr.y + rr.h / 2, 0x8a7cc0, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
    });
  }

  /** The 11 x 11 window on a companion's frame that shows its face (the top of what it shows, centred). */
  private faceAt(key: string): [number, number] {
    const b = opaqueBox(this.kit, key);
    const fx = Math.round(b.x + b.w / 2 - 5.5);
    const fy = Math.round(b.y + Math.min(b.h, 14) / 2 - 5.5);
    return [Math.max(0, fx), Math.max(0, fy)];
  }

  /** The "Along" sockets: who comes along; the slot Equip fills glows; the second padlocked without the Perch. */
  private drawSockets(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const l = kit.layer();
    const n = petSlots(p);
    const sl = this.slots();
    const a = enterK(now, this.openAt, 4, 40, 220);
    kit.texts.text('Along', sl[0].x + 1, sl[0].y - 5, 0xc8e8c0, { oy: 0.5, alpha: a });
    sl.forEach((r0, i) => {
      const id = p.petsOn[i];
      const pk = now - this.sockAt[i];
      const sh = i >= n && pk < 280 ? Math.round(Math.sin(pk / 18) * 2 * (1 - pk / 280)) : 0;
      const r = { ...r0, x: r0.x + sh, y: r0.y + Math.round((1 - a) * 10) };
      const locked = i >= n;
      const key = id ? (id === 'pip' ? 'pip_idle0' : `comp_${id}_idle0`) : '';
      const face: Face = id ? TIER_INFO[COMPANIONS[id].rarity].face : [0x8a7cc0, 0x413668, 0x2f2650, 0x1b1530];
      token(kit, l, r, { face, dim: locked, locked, sprite: id && kit.has(key) ? { key, at: this.faceAt(key) } : undefined, selected: !locked && n > 1 && i === this.slot, alpha: a }, now);
      if (!id && !locked) kit.texts.text('+', r.x + r.w / 2, r.y + r.h / 2 - 1, 0x8a7cc0, { bold: true, ox: 0.5, oy: 0.5, alpha: a * (0.6 + 0.4 * pulse(now, 1200)) });
      if (pk >= 0 && pk < 400 && !locked) glow(kit.gOver, r, 0xfff0a0, 0.6 * (1 - pk / 400), 2);
    });
  }

  /** The big button: Equip / Unequip / Along / Locked. */
  private drawButton(g: G, now: number): void {
    const kit = this.kit;
    const e0 = this.equipRect();
    const a = enterK(now, this.openAt, 5, 40, 240);
    if (a <= 0) return;
    const e = { ...e0, y: e0.y + Math.round((1 - a) * 12) };
    const label = this.equipLabel();
    if (label === 'Locked') {
      kit.button(g, kit.texts, e, 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
      return;
    }
    if (label === 'Along') kit.button(g, kit.texts, e, 'Along', FACE.gold, now, { icon: 'check' });
    else if (label === 'Unequip') kit.button(g, kit.texts, e, 'Unequip', FACE.navy, now);
    else bigButton(kit, g, kit.texts, e, 'Equip', FACE.green, now);
  }

  /** Level and XP, stars and shards (or how it's found). */
  private drawMeters(g: G, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const texts = kit.texts;
    const col = this.col();
    const a = enterK(now, this.selAt, 0, 0, 200) * enterK(now, this.openAt, 3, 40, 220);
    if (a <= 0) return;
    const y = col.y;
    if (!petOwned(p, this.sel)) {
      const msg = 'Found in hero chests';
      const w = textWidth(msg, 1, true) + 22;
      const r = { x: Math.round(col.x + (col.w - w) / 2), y: y + 1, w, h: 13 };
      glow(g, r, GOLD[3], (0.2 + 0.2 * pulse(now, 1200)) * a, 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
      pix(kit.gOver, 'chest', r.x + 4, r.y + 3, a);
      texts.text(msg, r.x + 16, r.y + 6.5, 0x5a2a08, { bold: true, oy: 0.5, alpha: a });
      return;
    }
    const pr = p.pets[this.sel];
    glass(g, { x: col.x, y, w: col.w, h: 14 }, { alpha: a, clear: 0.2 });
    const half = Math.floor(col.w * 0.6);
    // level: a gold "Lv 6" and the XP toward the next (earned with your hero while it's along)
    const lv = petLevel(kit.tuning, pr.xp);
    const max = Math.round(kit.tuning.pets.maxLevel);
    const lp = levelProgress(kit.tuning, pr.xp);
    const lt = `Lv ${lv}`;
    const lw = textWidth(lt, 1, true) + 6;
    tag(g, { x: col.x + 2, y: y + 2, w: lw, h: 10 }, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
    texts.text(lt, col.x + 2 + lw / 2, y + 7, 0x3a1e08, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    const atMax = lv >= max || !lp.need;
    this.miniMeter(g, col.x + lw + 6, y, half - lw - 9, atMax ? 1 : lp.into / lp.need, atMax ? 'Max' : `${lp.into}/${lp.need}`, atMax ? GOLD_TXT : 0xc8e0ff, [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a], a, now);
    // shards toward the next star
    const need = shardsToNext(kit.tuning, pr.stars);
    const sx = col.x + half + 2;
    pix(g, 'shard', sx, y + 3, a);
    this.miniMeter(g, sx + 11, y, col.x + col.w - 4 - (sx + 11), need === null ? 1 : pr.shards / need, need === null ? 'Max' : `${pr.shards}/${need}`, need === null ? GOLD_TXT : 0xe8d0ff, [0xf0d8ff, 0xb06ae0, 0x7a3cb0, 0x4a2470], a, now);
  }

  /** A slim bar with its numbers over its right end (small), in a 14 px row from y. */
  private miniMeter(g: G, x: number, y: number, w: number, frac: number, value: string, col: number, ramp: Face, a: number, now: number): void {
    gauge(g, x, y + 9, w, 3, frac, 0, { ramp, glow: frac >= 1 ? 0.3 + 0.3 * pulse(now, 900) : 0 });
    this.kit.texts.text(value, x + w, y + 4.5, col, { ox: 1, oy: 0.5, alpha: a });
  }

  /** What it does, as cards: the attack, then each perk (the body bold when everything fits, else small). */
  private drawCards(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const def = COMPANIONS[this.sel];
    const owned = petOwned(p, this.sel);
    const col = this.col();
    const top = col.y + 16;
    const avail = col.y + col.h - top;
    const cards = [
      { title: def.attack, body: `Every ${def.every} hits${def.allFoes ? ', all foes' : ''}.`, look: ATTACK_LOOK },
      ...def.perks.map((pk) => ({ title: pk.name, body: pk.text, look: PERK_LOOK[pk.name] ?? { icon: 'rune', col: 0x4a3a7a, text: 0xd8c8ff } })),
    ];
    const gap = 2;
    const fit = (bold: boolean, tight: boolean) => cards.reduce((h, c) => h + textCardH(textCardLines(col.w, { icon: c.look.icon, body: c.body, bold }).length, bold, tight), 0) + gap * (cards.length - 1) <= avail;
    const bold = fit(true, false);
    const tight = !bold && !fit(false, false);
    const l = kit.layer();
    let y = top;
    cards.forEach((c, i) => {
      const lines = textCardLines(col.w, { icon: c.look.icon, body: c.body, bold });
      const h = textCardH(lines.length, bold, tight);
      const k = easeOut3(enterK(now, Math.max(this.selAt, this.openAt + 120), i, 50, 200));
      if (k > 0) textCard(kit, l, { x: col.x + Math.round((1 - k) * 10), y, w: col.w, h }, { icon: c.look.icon, iconCol: c.look.col, title: c.title, titleCol: c.look.text, body: c.body, bold, dim: !owned, alpha: k }, now, tight);
      y += h + gap;
    });
  }
}
