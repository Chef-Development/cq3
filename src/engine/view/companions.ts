// The companions (a camp screen: tap a companion by the fire). One companion at a time, like the hero select
// (docs/ui-style.md, "Companions"):
//   the stage (left)   the companion big (3x) on a mossy stump in a moonlit grove (art-grove.ts), the moon behind its
//                      head, a lamp's light in its own colour on it, its rarity's aura behind it, fireflies; fliers
//                      hover and flap, walkers breathe. A tap: it hops and shows its attack (a chirp, a ring). Big
//                      arrows either side and a horizontal swipe on the stage page through them: the one on view
//                      slides out, the next hops in and lands (a puff of dust, or a flutter for a flier). One not met
//                      yet is a dark silhouette with a "?" on a dim stage. At its foot: the two "Along" sockets (who
//                      comes along; the second padlocked until the Companion Perch; tap one to pick the slot Equip
//                      fills) and the big button: Equip, Unequip, Along (the only one along) or Locked.
//   the top bar        Back, then the strip of companions as round tokens in their rarity's rings (silhouettes for
//                      ones not met; a check on those along), sized to fit however many there are.
//   the column (right) the name (bold 2) and its rarity; its stars (a shard meter under them) and its level (an XP
//                      meter); then what it does, read as cards on one glass plate: its attack, then each perk (an
//                      icon, the name in its colour, the description). When they all fit, each description is shown
//                      in full; when it's crowded (three perks on a phone), each gets its short line instead.
// Details live behind a tap, in a Sheet: a card (its full line, what stars do to it), the stars, the level, the name
// (its kind, its joke, its role, how it's found). The cards' text is built in one place: companion-cards.ts.
import type Phaser from 'phaser';
import { pct as fmtPct, whole } from '../../core/format';
import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../../data/companions';
import { COMPANION_FACE } from '../art-companions';
import { TIER_INFO } from '../../data/rarity';
import { levelProgress } from '../../core/heroes';
import { equipPet, petLevel, petOwned, petSlots, shardsToNext } from '../../core/roster';
import { ensureGroveArt, GROVE_STUMP_TOP, GROVE_THEME } from '../art-grove';
import { textWidth } from '../font';
import { attackText, CARD_TEXT_X, cardTextW, COMPANION_LIGHT, companionCards, companionStageW, wrapCard, type CompanionCard } from './companion-cards';
import { CampKit, D, GOLD_TXT, GREEN, pix, pixSize } from './camp-kit';
import { padlock } from './items';
import { gauge, glow, GOLD, NAVY } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, tag } from './ui';
import { aura, bigButton, bigName, drawStage, enterK, fillEllipse, glass, infoButton, liftDim, motes, opaqueBox, pageArrow, pips, popK, Sheet, spotlight, SwipePager, token, tooltip, type Face, type SheetLine } from './ui-modern';

export { attackText };

type G = Phaser.GameObjects.Graphics;

/** The companion's scale on the stage (whole numbers keep the pixels crisp). */
const S = 3;
/** Paging: the one on view slides out in OUT_MS; the next hops in and lands at IN_MS. */
const OUT_MS = 170;
const IN_MS = 280;

type SheetKind = `card${number}` | 'stars' | 'level' | 'info';
type CardMode = 'full' | 'line' | 'title';

/** A card as laid out: its rect, the lines it shows, whether that's its short line (the full one is a tap away). */
interface CardBox {
  card: CompanionCard;
  r: Rect;
  lines: string[];
  mode: CardMode;
  /** The title's top, from the card's top. */
  ty: number;
  shortened: boolean;
}

// fireflies over the grove: a home spot each, slow loops, blinking (offsets from the stage's centre)
const FLIES = Array.from({ length: 8 }, (_, i) => ({
  x: -50 + ((i * 41) % 104),
  y: 34 + ((i * 29) % 70),
  ax: 5 + (i % 3) * 3,
  ay: 3 + (i % 2) * 3,
  f1: 0.00033 + (i % 4) * 0.00008,
  f2: 0.00051 + (i % 3) * 0.0001,
  ph: i * 1.9,
  blink: 1700 + (i % 3) * 600,
}));

/** A companion's frame key ('pip' has its own frames). */
function frameKey(id: CompanionId, f: 'idle0' | 'idle1' | 'act'): string {
  if (id === 'pip') return f === 'act' ? 'pip_dive' : `pip_${f}`;
  return `comp_${id}_${f}`;
}

export class CompanionsScreen {
  sel: CompanionId = 'pip';
  /** The slot Equip fills (0, or 1 with the Perch). */
  slot = 0;
  /** It draws its own stage (the camp skips its dim behind it). */
  readonly staged = true;
  private openAt = 0;
  /** When the one on view changed (a page turn, a token, opening). */
  private selAt = 0;
  /** The one sliding out, the way the page turned (1: to the next), where it was when it let go (a swipe). */
  private prev: CompanionId | null = null;
  private dir = 0;
  private prevFrom = 0;
  private hopAt = -1e9;
  private actAt = -1e9;
  private equipAt = -1e9;
  private shakeAt = -1e9;
  private sockAt = [-1e9, -1e9];
  /** When the padlocked socket was tapped (its tip shows for a moment). */
  private lockTipAt = -1e9;
  readonly pager = new SwipePager();
  readonly sheet = new Sheet();
  sheetKind: SheetKind | null = null;
  /** The cards as laid out, per companion and column (the text never changes while the game runs). */
  private readonly cardCache = new Map<string, CardBox[]>();

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: CompanionId): void {
    const p = this.kit.profile;
    ensureGroveArt(this.kit.s);
    this.openAt = now;
    this.selAt = now;
    this.prev = null;
    this.dir = 0;
    this.pager.reset();
    this.lockTipAt = -1e9;
    this.sheet.close(now - 1000);
    this.sheetKind = null;
    this.sel = id ?? p.petsOn[0] ?? 'pip';
    // Equip fills the slot the one shown is in, else an empty one, else the first
    this.slot = this.aimSlot(this.sel);
    this.kit.after(260, () => this.landing(this.sel, now));
  }

  /** Show companion `id` (the token strip, a socket): it pages there. */
  select(id: CompanionId, now: number): void {
    this.show(id, now);
  }

  /** The slot Equip would fill for `id`: the one it's in, else an empty one, else the slot chosen. */
  private aimSlot(id: CompanionId): number {
    const p = this.kit.profile;
    const n = petSlots(p);
    const at = p.petsOn.indexOf(id);
    if (at >= 0) return Math.min(at, n - 1);
    if (p.petsOn.length < n) return p.petsOn.length;
    return Math.max(0, Math.min(n - 1, this.slot));
  }

  // ------------------------------------------------------------------ layout

  private owned(id: CompanionId): boolean {
    return petOwned(this.kit.profile, id);
  }

  /** The stage: the left part of the screen under the top bar (the action row along its foot). */
  stage(): Rect {
    const s = this.kit.s;
    return { x: s.L, y: 19, w: companionStageW(s.L, s.R), h: s.B - 19 };
  }

  /** Where a swipe can start: the stage above its action row. */
  private swipeArea(): Rect {
    const st = this.stage();
    return { ...st, h: this.kit.s.B - 24 - st.y };
  }

  private stageCx(): number {
    const st = this.stage();
    return st.x + Math.round(st.w / 2);
  }

  /** The stump's top face (where walkers' feet go). */
  private floorY(): number {
    return this.kit.s.B - 31;
  }

  /** The big arrows either side of the stage, at the companion's middle. */
  arrows(): { prev: Rect; next: Rect } {
    const st = this.stage();
    const y = this.floorY() - 47;
    return { prev: { x: st.x + 3, y, w: 15, h: 24 }, next: { x: st.x + st.w - 18, y, w: 15, h: 24 } };
  }

  /** The column right of the stage. */
  private col(): { x: number; w: number } {
    const st = this.stage();
    const x = st.x + st.w + 4;
    return { x, w: this.kit.s.R - 3 - x };
  }

  /** Companion i's token in the strip across the top (hopping over the HTML buttons in the middle), as big as fits. */
  cell(i: number): Rect {
    const kit = this.kit;
    const b = kit.backRect();
    const n = COMPANION_IDS.length;
    for (const [sz, gap] of [
      [17, 2],
      [15, 2],
      [13, 1],
    ] as const) {
      const rs = kit.topRow(Array(n).fill(sz), b.x + b.w + 5, kit.s.R - 3, gap, sz === 17 ? 1 : 2, sz);
      if (rs) return rs[i];
    }
    return kit.topRow(Array(n).fill(13), b.x + b.w + 4, 1e9, 1, 2, 13)![i];
  }

  /** The "Along" sockets at the stage's foot (two: the second padlocked until the Companion Perch). */
  slots(): Rect[] {
    const st = this.stage();
    const y = this.kit.s.B - 20;
    return [0, 1].map((i) => ({ x: st.x + 4 + i * 20, y, w: 17, h: 17 }));
  }

  /** The big button, right of the sockets. */
  equipRect(): Rect {
    const st = this.stage();
    const x = st.x + 46;
    return { x, y: this.kit.s.B - 20, w: st.x + st.w - 3 - x, h: 18 };
  }

  /** The name row (a tap: who it is). */
  infoRect(): Rect {
    const c = this.col();
    return { x: c.x - 2, y: 18, w: c.w + 2, h: 22 };
  }

  /** The "i" at the name row's right end (drawn when it fits after the rarity chip). */
  private infoButtonRect(): Rect {
    const c = this.col();
    return { x: c.x + c.w - 12, y: 21, w: 11, h: 11 };
  }

  /** The stars (and their shard meter): under the name, clear of its descenders (bold 2 hangs 4 px below its box). */
  starsRect(): Rect {
    const c = this.col();
    return { x: c.x, y: 42, w: 5 * 8 + 4 * 2, h: 12 };
  }

  /** The level and its XP meter. */
  levelRect(): Rect {
    const c = this.col();
    const x = c.x + this.starsRect().w + 7;
    return { x, y: 42, w: c.x + c.w - x, h: 10 };
  }

  /** The cards' plate: under the meters, down to the foot of the column. */
  private cardsArea(): Rect {
    const c = this.col();
    const y = 58;
    return { x: c.x, y, w: c.w, h: this.kit.s.B - 2 - y };
  }

  /**
   * What it does, laid out: the attack, then each perk. The perks get the best mode that fits: every description in
   * full (roomy, then compact), then a line each (the description if it fits on one, else its short line), then
   * titles only; the attack, when room is short, shrinks first to one row ("Breath every 6 hits").
   */
  cards(id = this.sel): CardBox[] {
    const a = this.cardsArea();
    const ck = `${id}|${a.x}|${a.y}|${a.w}|${a.h}`;
    const hit = this.cardCache.get(ck);
    if (hit) return hit;
    const cards = companionCards(id);
    const tw = cardTextW(a.w);
    const fits1 = (s: string) => textWidth(s, 1, true) <= tw;
    const plans: Array<{ mode: CardMode; ty: number; pad: number; row: boolean }> = [];
    for (const [mode, ty, pad] of [
      ['full', 3, 1],
      ['full', 1, 0],
      ['line', 3, 1],
      ['line', 1, 0],
    ] as const)
      for (const row of [false, true]) plans.push({ mode, ty, pad, row });
    plans.push({ mode: 'title', ty: 3, pad: 0, row: true });
    let pick: CardBox[] = [];
    for (const pl of plans) {
      let y = a.y;
      pick = cards.map((card) => {
        const mode: CardMode = card.kind === 'attack' && pl.row ? 'title' : pl.mode;
        let lines: string[] = [];
        let shortened = false;
        if (mode === 'full') lines = wrapCard(card.text, tw);
        else if (mode === 'line') {
          shortened = !fits1(card.text);
          lines = shortened ? wrapCard(card.short, cardTextW(a.w, true)).slice(0, 1) : [card.text];
        } else shortened = true;
        // a card: its title's bold box (10), each line 10 under the last, the descenders 2 below; a title row: 15
        const h = mode === 'title' ? 15 : pl.ty + 11 + lines.length * 10 + pl.pad;
        const r = { x: a.x, y, w: a.w, h };
        y += h;
        return { card, r, lines, mode, ty: pl.ty, shortened };
      });
      if (y - a.y <= a.h) break;
    }
    this.cardCache.set(ck, pick);
    return pick;
  }

  /** A title row's words after the name: the attack's "every 6 hits" when it fits on the row. */
  private rowTail(b: CardBox, w: number): string {
    if (b.card.kind !== 'attack') return '';
    const tail = `every ${whole(COMPANIONS[this.sel].every)} hits`;
    return textWidth(b.card.name, 1, true) + 5 + textWidth(tail, 1, true) <= cardTextW(w, true) ? tail : '';
  }

  private sheetArea(): Rect {
    const c = this.col();
    return { x: c.x - 2, y: 20, w: c.w + 2, h: this.kit.s.B - 3 - 20 };
  }

  // ------------------------------------------------------------------ the companion on the stage

  /** Its box (the opaque pixels of its first idle frame): it's placed by this, so frames never jitter. */
  private box(id: CompanionId): Rect {
    const key = frameKey(id, 'idle0');
    return this.kit.has(key) ? opaqueBox(this.kit, key) : { x: 6, y: 2, w: 24, h: 21 };
  }

  /** Where companion `id`'s frame goes (its top-left on screen) shifted `off` px and lifted `lift` px. */
  private place(id: CompanionId, off: number, lift: number, now: number): { x: number; y: number } {
    const b = this.box(id);
    const fly = COMPANIONS[id].flies;
    const x = Math.round(this.stageCx() + off - (b.x + b.w / 2) * S);
    // walkers stand on the stump's face (their soles' row on it); fliers hover a little over it, bobbing
    const bob = fly ? Math.round(Math.sin(now / 320) * 2) : 0;
    const bottom = fly ? this.floorY() - 9 + bob : this.floorY() + 2;
    return { x, y: Math.round(bottom - (b.y + b.h) * S) - lift };
  }

  /** The one on view as it stands (taps on it: a hop). */
  creatureRect(now = performance.now()): Rect {
    const b = this.box(this.sel);
    const p = this.place(this.sel, 0, 0, now);
    return { x: p.x + b.x * S, y: p.y + b.y * S, w: b.w * S, h: b.h * S };
  }

  /** Its frame now: the attack pose just after a tap or an equip, else its idle (fliers flap fast, walkers breathe). */
  private frameNow(id: CompanionId, now: number): string {
    if (id === this.sel && (now - this.actAt < 320 || now - this.equipAt < 360)) return frameKey(id, 'act');
    const per = COMPANIONS[id].flies ? 140 : 420;
    return frameKey(id, Math.floor(now / per) % 2 ? 'idle1' : 'idle0');
  }

  private equipLabel(): 'Locked' | 'Equip' | 'Unequip' | 'Along' {
    const p = this.kit.profile;
    if (!this.owned(this.sel)) return 'Locked';
    if (!p.petsOn.includes(this.sel)) return 'Equip';
    return p.petsOn.length > 1 ? 'Unequip' : 'Along';
  }

  // ------------------------------------------------------------------ input

  /** A press on the stage might be a swipe: true takes it (judged when it's let go: a tap if it stayed put). */
  pressAt(x: number, y: number, now: number): boolean {
    if (this.sheet.open || !inRect(this.swipeArea(), x, y)) return false;
    const a = this.arrows();
    if (inRect(a.prev, x, y, 3) || inRect(a.next, x, y, 3) || inRect(this.kit.backRect(), x, y, 3)) return false;
    this.pager.pressAt(x, y, now);
    return true;
  }

  dragTo(x: number, y: number, now: number): void {
    this.pager.dragTo(x, y, now);
  }

  /** Let go: a swipe far enough (or a flick) pages that way, a short one snaps back; true when it was a tap. */
  releaseAt(x: number, _y: number, now: number): boolean {
    const r = this.pager.releaseAt(x, now);
    if (r.page) this.page(r.page, now, r.from);
    return r.tap;
  }

  cancelPress(): void {
    this.pager.cancel(performance.now());
  }

  /** The next (d = 1) or the previous companion (d = -1); `from`: where a swipe left the one on view. */
  private page(d: number, now: number, from = 0): void {
    const n = COMPANION_IDS.length;
    const i = COMPANION_IDS.indexOf(this.sel);
    this.show(COMPANION_IDS[(i + d + n) % n], now, d, from);
  }

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const app = kit.app;
    const p = kit.profile;
    if (this.sheet.open) {
      // a tap anywhere closes the sheet (Back too goes back)
      this.sheet.tap(now);
      this.sheetKind = null;
      app.audio.panelClose();
      if (!(x < 0 || inRect(kit.backRect(), x, y, 3))) return;
    }
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (let i = 0; i < COMPANION_IDS.length; i++) {
      const r = this.cell(i);
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      this.show(COMPANION_IDS[i], now);
      return;
    }
    const a = this.arrows();
    for (const [r, d] of [
      [a.prev, -1],
      [a.next, 1],
    ] as const) {
      if (!inRect(r, x, y, 3)) continue;
      notePress(r);
      this.page(d, now);
      return;
    }
    const sl = this.slots();
    for (let i = 0; i < sl.length; i++) {
      if (!inRect(sl[i], x, y, 2)) continue;
      notePress(sl[i]);
      if (i >= petSlots(p)) {
        // padlocked: it rattles, and a tip over it says what opens it
        app.audio.lockToggle();
        this.sockAt[i] = now;
        this.lockTipAt = now;
        return;
      }
      this.slot = i;
      const on = p.petsOn[i];
      if (on && on !== this.sel) this.show(on, now);
      else {
        this.sockAt[i] = now;
        app.audio.uiClick();
      }
      return;
    }
    const e = this.equipRect();
    if (inRect(e, x, y, 2)) {
      notePress(e);
      return this.equip(now);
    }
    if (inRect(this.infoRect(), x, y)) {
      notePress(this.infoButtonRect());
      return this.openSheet('info', now);
    }
    if (inRect(this.starsRect(), x, y, 2)) {
      notePress(this.starsRect());
      return this.openSheet(this.owned(this.sel) ? 'stars' : 'info', now);
    }
    if (inRect(this.levelRect(), x, y, 2)) {
      notePress(this.levelRect());
      return this.openSheet(this.owned(this.sel) ? 'level' : 'info', now);
    }
    const cs = this.cards();
    for (let i = 0; i < cs.length; i++) {
      if (!inRect(cs[i].r, x, y)) continue;
      notePress(cs[i].r);
      return this.openSheet(`card${i}`, now);
    }
    // the companion itself: a hop and its attack (one not met yet shakes its head)
    const cr = this.creatureRect(now);
    if (inRect(cr, x, y, 5)) this.poke(now);
  }

  /** A tap on the companion: it hops and shows its attack, a chirp, a ring of its rarity. */
  private poke(now: number): void {
    const kit = this.kit;
    const id = this.sel;
    const cr = this.creatureRect(now);
    if (!this.owned(id)) {
      this.shakeAt = now;
      kit.app.audio.lockToggle();
      kit.fx.float('Found in hero chests', cr.x + cr.w / 2, cr.y - 4, 0xffd890, { life: 1400 });
      return;
    }
    this.actAt = now;
    this.hopAt = now;
    if (COMPANIONS[id].flies) kit.app.audio.critterChirp();
    else kit.app.audio.pet();
    const [hi] = TIER_INFO[COMPANIONS[id].rarity].face;
    const cx = cr.x + cr.w / 2;
    const cy = cr.y + cr.h / 2;
    kit.fx.ring(cx, cy, 22, hi, 420);
    kit.fx.burst(cx + 12, cy - 6, [hi, WHITE, 0xfff0a0], 10, 0.7, { kind: 'star', g: 20, life: 500 });
  }

  /** Page to companion `id` (`dir`: which way it turned, for the slide; `from`: a swipe's offset when it let go). */
  show(id: CompanionId, now: number, dir = 0, from = 0): void {
    if (this.sel === id) return;
    const kit = this.kit;
    const i0 = COMPANION_IDS.indexOf(this.sel);
    this.prev = this.sel;
    this.prevFrom = from;
    this.dir = dir || Math.sign(COMPANION_IDS.indexOf(id) - i0);
    this.sel = id;
    this.selAt = now;
    this.slot = this.aimSlot(id);
    this.pager.reset();
    if (this.sheet.open) this.sheet.close(now);
    this.sheetKind = null;
    kit.fadeToast();
    kit.app.audio.swish();
    kit.after(IN_MS, () => this.landing(id, now));
  }

  /** The landing (on a page turn, or opening): a puff of dust either side of a walker's feet, a flutter for a flier. */
  private landing(id: CompanionId, at: number): void {
    const kit = this.kit;
    if (this.sel !== id || (this.selAt !== at && this.openAt !== at) || kit.app.run.phase !== 'camp') return;
    const x = this.stageCx();
    const y = this.floorY() + 1;
    const owned = this.owned(id);
    if (COMPANIONS[id].flies) {
      const cr = this.creatureRect();
      const col = owned ? [0xfff0d0, COMPANION_LIGHT[id], WHITE] : [0x6a6478, 0x4a4458];
      kit.fx.burst(cr.x + cr.w / 2, cr.y + cr.h - 4, col, 8, 0.4, { kind: 'px', up: 10, spread: 1.4, g: 40, life: 520 });
      if (owned) kit.app.audio.critterFlutter(true);
      return;
    }
    const dust = owned ? [0xd8ccb0, 0xb0a48c, 0x8a7e6c, 0xece4d0] : [0x6a6478, 0x4a4458];
    kit.fx.burst(x - 12, y, dust, 7, 0.45, { kind: 'chip', up: 16, spread: 0.9, g: 220, life: 380 });
    kit.fx.burst(x + 12, y, dust, 7, 0.45, { kind: 'chip', up: 16, spread: 0.9, g: 220, life: 380 });
    kit.app.audio.footstep(1);
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
      this.slot = this.aimSlot(id);
      const s = this.slots()[at];
      kit.fx.burst(s.x + s.w / 2, s.y + s.h / 2, [0x8a7cc0, 0xd8d0f0], 10, 0.6, { kind: 'chip', g: 60, life: 450 });
      kit.fx.float('Stays at camp', this.stageCx(), this.creatureRect(now).y - 6, 0xd8d0f0, { life: 1200 });
      return;
    }
    const slot = Math.min(this.slot, petSlots(p) - 1);
    if (!equipPet(p, slot, id)) return;
    kit.commit();
    this.equipAt = now;
    this.hopAt = now;
    this.sockAt[p.petsOn.indexOf(id)] = now + 380;
    kit.app.audio.equip();
    for (let i = 0; i < 3; i++) kit.after(120 + i * 70, () => kit.app.audio.statUp(i));
    const cr = this.creatureRect(now);
    const cx = cr.x + cr.w / 2;
    const cy = cr.y + cr.h / 2;
    const tierCol = TIER_INFO[COMPANIONS[id].rarity].face;
    kit.fx.ring(cx, cy, 28, 0xfff0a0, 460);
    kit.after(90, () => kit.fx.ring(cx, cy, 40, tierCol[0], 560));
    kit.fx.burst(cx, cy, [0xfff0a0, WHITE, GREEN, tierCol[0]], 26, 1, { kind: 'star', g: 30, life: 700 });
    const s = this.slots()[p.petsOn.indexOf(id)] ?? this.slots()[0];
    kit.fx.fly({ color: tierCol[1], x0: cx, y0: cy, x1: s.x + s.w / 2, y1: s.y + s.h / 2, arc: 24, life: 380 });
    kit.after(380, () => {
      kit.fx.ring(s.x + s.w / 2, s.y + s.h / 2, 14, 0xfff0a0, 360);
      kit.fx.burst(s.x + s.w / 2, s.y + s.h / 2, [0xfff0a0, WHITE], 10, 0.6, { kind: 'star', g: 0, life: 400 });
    });
    kit.fx.flash(e, WHITE, 300);
    kit.fx.float('Comes along!', cx, cr.y - 8, GREEN, { life: 1500 });
  }

  // ------------------------------------------------------------------ sheets

  private openSheet(kind: SheetKind, now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const id = this.sel;
    const def = COMPANIONS[id];
    const owned = this.owned(id);
    const pr = kit.profile.pets[id];
    const T = t.pets;
    const pct = (n: number) => fmtPct(n);
    let title = '';
    let lines: SheetLine[] = [];
    let face: Face = TIER_INFO[def.rarity].face;
    if (kind.startsWith('card')) {
      const box = this.cards()[Number(kind.slice(4))];
      if (!box) return;
      const c = box.card;
      title = c.name;
      face = [mix(c.look.col, WHITE, 0.45), c.look.col, mix(c.look.col, INK, 0.25), mix(c.look.col, INK, 0.5)];
      if (c.kind === 'attack') {
        lines = [
          { text: `${attackText(id)}.`, bold: true, col: 0xfff0c0, icon: c.look.icon },
          { text: `Hits harder each level (+${pct(T.levelDmg)}) and each star (+${pct(T.starDmg)}).`, col: 0xd8d0f0 },
        ];
      } else {
        lines = [
          { text: c.text, bold: true, col: 0xfff0c0, icon: c.look.icon },
          { text: `Each star makes it ${pct(T.perkStep)} stronger.`, col: 0xffd890 },
        ];
        if (owned && pr.stars > 1) lines.push({ text: `${pr.stars} stars: ${pct(T.perkStep * (pr.stars - 1))} stronger now.`, col: GREEN, bold: true, icon: 'star_on' });
      }
    } else if (kind === 'stars') {
      const need = shardsToNext(t, pr.stars);
      title = 'Stars';
      face = [GOLD[4], GOLD[3], GOLD[2], GOLD[1]];
      lines = [
        { text: `${pr.stars} of 5 stars`, bold: true, col: 0xfff0c0, icon: 'star_on' },
        { text: `Each star: +${pct(T.starDmg)} damage, perks ${pct(T.perkStep)} stronger.` },
        { text: need === null ? 'All five stars!' : `Shards ${whole(pr.shards)}/${whole(need)}: dupes from hero chests.`, col: 0xe8d0ff, icon: 'shard' },
      ];
    } else if (kind === 'level') {
      const lv = petLevel(t, pr.xp);
      const lp = levelProgress(t, pr.xp);
      const max = lv >= Math.round(T.maxLevel) || !lp.need;
      title = `Lv ${lv}`;
      face = [0x9ad8ff, 0x2a62c8, 0x22489c, 0x1a3070];
      lines = [
        { text: max ? 'Max level' : `${whole(lp.into)}/${whole(lp.need)} XP to Lv ${lv + 1}`, bold: true, col: 0xc8e0ff },
        { text: 'Earns XP when it comes along.', icon: 'up' },
        { text: `+${pct(T.levelDmg)} damage a level, up to Lv ${Math.round(T.maxLevel)}.`, col: 0xd8d0f0 },
      ];
    } else {
      title = def.name;
      lines = [
        { text: `${def.kind}. ${def.role}.`, bold: true, col: 0xffd890 },
        { text: def.bio, col: 0xfff0c0 },
        { text: `${attackText(id)}.`, icon: 'crit' },
      ];
      if (!owned) lines.push({ text: 'Found in hero chests', bold: true, col: GOLD_TXT, icon: 'chest' });
    }
    this.sheet.show(title, lines, now, face);
    this.sheetKind = kind;
    kit.app.audio.panelOpen();
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    liftDim(kit, (now - this.openAt) / 160);
    this.drawBackdrop(now);
    this.drawCompanions(now);
    const ak = enterK(now, this.openAt, 3);
    const a = this.arrows();
    pageArrow(kit.gOver, { ...a.prev, x: a.prev.x - Math.round((1 - ak) * 10) }, -1, now, ak);
    pageArrow(kit.gOver, { ...a.next, x: a.next.x + Math.round((1 - ak) * 10) }, 1, now, ak);
    kit.drawBack(kit.gUi, now);
    this.drawStrip(now);
    this.drawHeader(now);
    this.drawCards(now);
    this.drawSockets(now);
    this.drawButton(now);
    this.sheet.draw(kit, this.sheetArea(), now);
  }

  /** The light the lamp throws now (blending from the last one's colour after a page turn). */
  private lightNow(now: number): number {
    const k = clamp01((now - this.selAt) / 260);
    const to = COMPANION_LIGHT[this.sel] ?? 0xd8f0ff;
    return this.prev && k < 1 ? mix(COMPANION_LIGHT[this.prev] ?? 0xd8f0ff, to, k) : to;
  }

  /** The grove, the lamp's light on the stump in the companion's colour, motes and fireflies, the stump. */
  private drawBackdrop(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const st = this.stage();
    const owned = this.owned(this.sel);
    const ek = enterK(now, this.openAt, 0, 0, 220);
    drawStage(kit, GROVE_THEME, now, { alpha: ek, motes: false, dim: owned ? 0 : 0.4 });
    const cx = this.stageCx();
    const fy = this.floorY();
    const light = this.lightNow(now);
    const flick = 0.9 + 0.1 * pulse(now, 1300) + 0.04 * Math.sin(now / 97);
    spotlight(g, cx, -4, fy + 1, 22, 66, light, (owned ? 0.08 : 0.035) * ek, flick);
    // a ring of light on the moss round the stump
    fillEllipse(g, cx, fy + 9, 40, 6, light, (owned ? 0.07 : 0.03) * ek);
    motes(g, light, now, st.x + 6, st.x + st.w - 6, 24, fy, (owned ? 0.8 : 0.4) * ek, 10);
    this.drawFlies(g, cx, now, ek);
    // the stump (it rises in with the stage)
    kit.imgs.at('grove_stump', cx - GROVE_STUMP_TOP.x, fy - GROVE_STUMP_TOP.y + Math.round((1 - ek) * 8), D.icons - 0.004, ek);
  }

  /** Fireflies drifting over the stage, blinking. */
  private drawFlies(g: G, cx: number, now: number, a: number): void {
    const st = this.stage();
    for (const f of FLIES) {
      const x = cx + f.x + Math.sin(now * f.f1 + f.ph) * f.ax * 2;
      const y = f.y + Math.cos(now * f.f2 + f.ph) * f.ay * 2;
      if (x < st.x + 2 || x > st.x + st.w - 2) continue;
      const b = pulse(now, f.blink, f.ph * 300);
      if (b < 0.3) continue;
      const k = ((b - 0.3) / 0.7) * a;
      g.fillStyle(0xd8ff8a, 0.2 * k);
      g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      g.fillStyle(0xf0ffc0, k);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /** The one on view (and the one sliding out), its aura, a flier's shadow, the "?" over one not met yet. */
  private drawCompanions(now: number): void {
    const kit = this.kit;
    const t = now - this.selAt;
    // the old one slides out the way the page turned
    if (this.prev && this.dir !== 0 && t < OUT_MS) {
      const k = t / OUT_MS;
      const off = this.prevFrom + (-this.dir * 110 - this.prevFrom) * k * k;
      this.drawOne(this.prev, Math.round(off), 0, 1 - k * 0.6, now);
    }
    const id = this.sel;
    const owned = this.owned(id);
    // the new one hops in from the other side (or, opening the screen, drops onto the stump)
    let off = 0;
    let lift = 0;
    let alpha = 1;
    if (this.dir !== 0 && t < IN_MS) {
      const k = clamp01(t / IN_MS);
      off = Math.round(this.dir * 100 * (1 - easeOut3(k)));
      lift = Math.round(Math.sin(k * Math.PI) * 12);
      alpha = clamp01(k * 3);
    } else if (this.dir === 0) {
      const dk = clamp01((now - this.openAt - 40) / 260);
      lift = Math.round((1 - easeBack(dk, 1.4)) * 26);
      alpha = clamp01(dk * 2);
    }
    off += this.pager.offset(now);
    if (this.pager.dragging) alpha *= 1 - Math.min(0.5, Math.abs(this.pager.dragDx) / 160);
    // a hop when tapped or equipped; a shake for one not met yet
    const hk = (now - this.hopAt) / 360;
    if (hk >= 0 && hk < 1) lift += Math.round(Math.sin(hk * Math.PI) * 8);
    const sh = now - this.shakeAt;
    if (sh < 300) off += Math.round(Math.sin(sh / 20) * 3 * (1 - sh / 300));
    // the aura breathes behind it (faint for one not met yet)
    const cr = this.creatureRect(now);
    const ak = (this.dir === 0 ? popK(now, this.openAt, 2, 40, 360) : clamp01(t / IN_MS)) * (owned ? 1 : 0.35);
    if (ak > 0) {
      const tier = COMPANIONS[id].rarity;
      const [hi, base] = TIER_INFO[tier].face;
      const ax = cr.x + cr.w / 2 + Math.round(off * 0.5);
      const ay = cr.y + cr.h / 2 + 2;
      // a soft halo in the rarity's colour under the aura's rings, so even a Common one stands in a glow
      fillEllipse(kit.gUi, ax, ay, 48 * ak, 38 * ak, base, 0.06 * ak);
      fillEllipse(kit.gUi, ax, ay, 34 * ak, 28 * ak, hi, 0.04 * ak);
      aura(kit, kit.gUi, ax, ay, 38, Math.round(cr.h / 2) + 10, tier, now, ak);
    }
    // a flier's shadow on the stump's face (smaller when it bobs up)
    if (COMPANIONS[id].flies && alpha > 0.2) fillEllipse(kit.gOver, this.stageCx() + off, this.floorY(), 11 - Math.abs(Math.sin(now / 320)) * 2 - lift * 0.2, 2, INK, 0.3 * alpha);
    this.drawOne(id, off, lift, alpha, now);
    if (!owned) {
      const qa = alpha * (0.65 + 0.35 * pulse(now, 1200));
      kit.texts.text('?', cr.x + cr.w / 2 + off, cr.y + cr.h / 2 - lift, 0xb8a8f0, { bold: true, scale: 3, ox: 0.5, oy: 0.5, alpha: qa });
    }
  }

  /** One companion at 3x (shifted `off` px, lifted `lift` px), cropped to the stage so it never walks over the column. */
  private drawOne(id: CompanionId, off: number, lift: number, alpha: number, now: number): void {
    const kit = this.kit;
    const key = this.frameNow(id, now);
    if (!kit.has(key) || alpha <= 0) return;
    const { x, y } = this.place(id, off, lift, now);
    const st = this.stage();
    const [tw, th] = kit.imgs.size(key);
    const c0 = Math.max(0, Math.ceil((st.x - x) / S));
    const c1 = Math.min(tw, Math.floor((st.x + st.w + 2 - x) / S));
    if (c1 - c0 <= 0) return;
    const crop: [number, number, number, number] = [c0, 0, c1 - c0, th];
    if (!this.owned(id)) {
      // not met yet: a dark silhouette, its top and left edges rimmed by the lamp's light
      const rim = mix(this.lightNow(now), 0x6a5aa0, 0.35);
      kit.sprites.draw(key, x + c0 * S - 1, y - 2, D.icons - 0.001, { crop, scale: S, alpha: alpha * 0.55, fill: rim });
      kit.sprites.draw(key, x + c0 * S, y, D.icons, { crop, scale: S, alpha, fill: 0x120c22 });
      return;
    }
    kit.sprites.draw(key, x + c0 * S, y, D.icons, { crop, scale: S, alpha });
  }

  /** The strip of companions: round tokens in their rarity's rings (silhouettes for ones not met yet). */
  private drawStrip(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const l = kit.layer();
    COMPANION_IDS.forEach((id, i) => {
      const k = popK(now, this.openAt, i, 25, 220);
      if (k <= 0) return;
      const r0 = this.cell(i);
      const r = { ...r0, y: r0.y - Math.round((1 - k) * 8) };
      const owned = petOwned(p, id);
      const key = frameKey(id, 'idle0');
      const has = kit.has(key);
      const at = has ? this.faceAt(key) : ([0, 0] as [number, number]);
      const a = clamp01(k * 1.4);
      const rr = token(kit, l, r, { face: TIER_INFO[COMPANIONS[id].rarity].face, sprite: has && owned ? { key, at } : undefined, dim: !owned, selected: this.sel === id, check: owned && p.petsOn.includes(id), alpha: a }, now);
      if (!owned) {
        // not met yet: its silhouette in the well, rimmed faintly, and a "?" on it
        const x = Math.round(rr.x + rr.w / 2 - 5.5);
        const y = Math.round(rr.y + rr.h / 2 - 5.5);
        if (has) {
          kit.sprites.draw(key, x - 1, y - 1, l.icons - 0.001, { crop: [at[0], at[1], 11, 11], fill: 0x5a4c88, alpha: 0.6 * a });
          kit.sprites.draw(key, x, y, l.icons, { crop: [at[0], at[1], 11, 11], fill: 0x0c0818, alpha: a });
        }
        kit.texts.text('?', rr.x + rr.w / 2, rr.y + rr.h / 2, 0x9a8cd0, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
      }
    });
  }

  /** The 11 x 11 window on a companion's frame that shows its face (the top of what it shows, centred). */
  private faceAt(key: string): [number, number] {
    // (one with its face placed by hand: round 7's companions)
    const face = COMPANION_FACE[key.replace(/^comp_|_idle0$/g, '')];
    if (face) return [Math.max(0, Math.round(face[0] - 5.5)), Math.max(0, Math.round(face[1] - 5.5))];
    const b = opaqueBox(this.kit, key);
    const fx = Math.round(b.x + b.w / 2 - 5.5);
    const fy = Math.round(b.y + Math.min(b.h, 14) / 2 - 5.5);
    return [Math.max(0, fx), Math.max(0, fy)];
  }

  /** The column's head on a glass plate: the name and its rarity (and the "i"), the stars and the level. */
  private drawHeader(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const texts = kit.texts;
    const p = kit.profile;
    const id = this.sel;
    const def = COMPANIONS[id];
    const owned = this.owned(id);
    const c = this.col();
    const at = Math.max(this.openAt, this.selAt);
    const kOf = (i: number) => enterK(now, at, i, 35, 200);
    const dxOf = (i: number) => Math.round((1 - easeOut3(kOf(i))) * 10 * (this.dir || 1));
    const tier = TIER_INFO[def.rarity];
    const pk = enterK(now, this.openAt, 1, 0, 220);
    glass(g, { x: c.x - 4, y: 18, w: c.w + 6, h: 37 }, { alpha: pk, rim: owned ? mix(tier.face[0], INK, 0.45) : undefined, clear: 0.3 });
    // the name (bold 2), its rarity after it, the "i" at the end when there's room
    let k = kOf(0);
    let dx = dxOf(0);
    const nameW = textWidth(def.name, 2, true);
    bigName(texts, def.name, c.x + dx, 27, owned ? WHITE : 0xb0a8c8, { alpha: k, ext: owned ? mix(tier.face[3], INK, 0.3) : NAVY[1] });
    const chipX = c.x + nameW + 5;
    const chipW = textWidth(tier.name, 1, true) + 8;
    const ib = this.infoButtonRect();
    if (chipX + chipW <= c.x + c.w) kit.rarityTag(g, texts, def.rarity, chipX + dx, 27, k);
    if (chipX + chipW + 3 <= ib.x && k > 0.5) infoButton(kit.gOver, texts, ib, now);
    // the stars (and the shards toward the next one) and the level; one not met yet: how it's found
    k = kOf(1);
    dx = dxOf(1);
    const pr = p.pets[id];
    if (!owned) {
      const msg = 'Found in hero chests';
      const r = { x: c.x + dx, y: 42, w: Math.min(textWidth(msg, 1, true) + 22, c.w), h: 12 };
      glow(g, r, GOLD[3], (0.2 + 0.25 * pulse(now, 1200)) * k, 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], k);
      pix(kit.gOver, 'chest', r.x + 4, r.y + 2, k);
      texts.text(msg, r.x + 17, r.y + 6, 0x5a2a08, { bold: true, oy: 0.5, alpha: k });
      return;
    }
    const sr = this.starsRect();
    const spr = isPressed(sr, now) ? 1 : 0;
    pips(g, sr.x + dx, sr.y + spr, 5, pr.stars, now, { kind: 'star', size: 8, gap: 2, alpha: k });
    const need = shardsToNext(kit.tuning, pr.stars);
    gauge(g, sr.x + dx + 1, sr.y + 9 + spr, sr.w - 2, 3, need === null ? 1 : pr.shards / need, 0, { ramp: need === null ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : [0xf0e0ff, 0xb48ae8, 0x7a3cb0, 0x4a2470] });
    const lr = this.levelRect();
    const lpr = isPressed(lr, now) ? 1 : 0;
    const lv = petLevel(kit.tuning, pr.xp);
    const lp = levelProgress(kit.tuning, pr.xp);
    const max = lv >= Math.round(kit.tuning.pets.maxLevel) || !lp.need;
    const lt = `Lv ${lv}`;
    const lw = textWidth(lt, 1, true);
    texts.text(lt, lr.x + dx, lr.y + 4 + lpr, GOLD_TXT, { bold: true, oy: 0.5, alpha: k });
    const bx = lr.x + dx + lw + 4;
    gauge(g, bx, lr.y + 1 + lpr, lr.x + lr.w - bx, 6, max ? 1 : lp.into / lp.need, 0, { ramp: max ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a], seg: 8, glow: max ? 0.25 + 0.25 * pulse(now, 1000) : 0 });
  }

  /** What it does: the cards on one glass plate, each an icon, its name in its colour and its line(s). */
  private drawCards(now: number): void {
    const kit = this.kit;
    const owned = this.owned(this.sel);
    const boxes = this.cards();
    if (!boxes.length) return;
    const l = kit.layer();
    const g = l.g;
    const at = Math.max(this.openAt + 120, this.selAt);
    const area = this.cardsArea();
    const bottom = boxes[boxes.length - 1].r.y + boxes[boxes.length - 1].r.h;
    const pk = enterK(now, this.openAt, 2, 0, 220);
    glass(g, { x: area.x - 4, y: area.y, w: area.w + 6, h: bottom - area.y }, { alpha: pk, clear: 0.22 });
    boxes.forEach((b, i) => {
      const k = easeOut3(enterK(now, at, i, 45, 200));
      if (k <= 0) return;
      const dx = Math.round((1 - k) * 10 * (this.dir || 1));
      const pr = isPressed(b.r, now) ? 1 : 0;
      const on = this.sheet.open && this.sheetKind === `card${i}`;
      const r = { ...b.r, x: b.r.x + dx, y: b.r.y + pr };
      // the divider above every card but the first; a pressed or open card lights up
      if (i > 0) {
        g.fillStyle(INK, 0.55 * k);
        g.fillRect(area.x - 2, b.r.y - 1, area.w + 2, 1);
        g.fillStyle(0x8a7cc0, 0.22 * k);
        g.fillRect(area.x - 2, b.r.y, area.w + 2, 1);
      }
      if (pr || on) {
        g.fillStyle(on ? GOLD[3] : WHITE, (on ? 0.12 : 0.08) * k);
        g.fillRect(area.x - 3, b.r.y + 1, area.w + 4, b.r.h - 2);
      }
      this.drawCard(l, b, r, owned, k);
    });
  }

  private drawCard(l: ReturnType<CampKit['layer']>, b: CardBox, r: Rect, owned: boolean, a: number): void {
    const g = l.g;
    const look = b.card.look;
    // the icon on a round disc in its colour, centred on the title (on the card, for a tall one)
    const cy = r.y + (b.mode === 'title' ? Math.round(r.h / 2) : b.ty + 6);
    const cx = r.x + 9;
    const col = owned ? look.col : 0x4a4058;
    fillEllipse(g, cx, cy, 7, 7, INK, a);
    fillEllipse(g, cx, cy, 6, 6, col, a);
    fillEllipse(g, cx - 1, cy - 1, 4, 4, mix(col, WHITE, 0.25), 0.6 * a);
    const [iw, ih] = pixSize(look.icon);
    pix(l.over, look.icon, Math.round(cx - iw / 2), Math.round(cy - ih / 2), (owned ? 1 : 0.6) * a);
    const tx = r.x + CARD_TEXT_X;
    const ty = r.y + (b.mode === 'title' ? Math.round(r.h / 2) - 5 : b.ty);
    l.texts.text(b.card.name, tx, ty, owned ? look.text : 0x9a90b8, { bold: true, alpha: a });
    const tail = b.mode === 'title' ? this.rowTail(b, r.w) : '';
    if (tail) l.texts.text(tail, tx + textWidth(b.card.name, 1, true) + 5, ty, owned ? 0xf0eaff : 0xa8a0c0, { bold: true, alpha: a });
    b.lines.forEach((s, j) => l.texts.text(s, tx, ty + 9 + j * 10, owned ? 0xf0eaff : 0xa8a0c0, { bold: true, alpha: a }));
    // a shortened card shows a little chevron: there's more behind a tap
    if (b.shortened) {
      const x = r.x + r.w - 3;
      const y = Math.round(r.y + r.h / 2 - 3);
      g.fillStyle(INK, 0.9 * a);
      g.fillRect(x - 1, y - 1, 4, 8);
      g.fillStyle(GOLD[3], a);
      for (let j = 0; j < 3; j++) {
        g.fillRect(x + j, y + j, 1, 1);
        g.fillRect(x + j, y + 5 - j, 1, 1);
      }
      g.fillRect(x + 2, y + 2, 1, 2);
    }
  }

  /** The "Along" sockets: who comes along; the slot Equip fills glows; the second padlocked without the Perch. */
  private drawSockets(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const l = kit.layer();
    const n = petSlots(p);
    const sl = this.slots();
    const a = enterK(now, this.openAt, 5, 40, 220);
    if (a <= 0) return;
    kit.texts.text('Along', sl[0].x + 1, sl[0].y - 6, 0xc8e8c0, { bold: true, oy: 0.5, alpha: a });
    sl.forEach((r0, i) => {
      const id = p.petsOn[i];
      const pk = now - this.sockAt[i];
      const locked = i >= n;
      const sh = locked && pk < 280 ? Math.round(Math.sin(pk / 18) * 2 * (1 - pk / 280)) : 0;
      const r = { ...r0, x: r0.x + sh, y: r0.y + Math.round((1 - a) * 10) };
      const key = id ? frameKey(id, 'idle0') : '';
      const face: Face = id ? TIER_INFO[COMPANIONS[id].rarity].face : [0x8a7cc0, 0x413668, 0x2f2650, 0x1b1530];
      token(kit, l, r, { face, dim: locked, locked, sprite: id && kit.has(key) ? { key, at: this.faceAt(key) } : undefined, selected: !locked && n > 1 && i === this.slot, alpha: a }, now);
      if (!id && !locked) kit.texts.text('+', r.x + r.w / 2, r.y + r.h / 2 - 1, 0x8a7cc0, { bold: true, ox: 0.5, oy: 0.5, alpha: a * (0.6 + 0.4 * pulse(now, 1200)) });
      if (pk >= 0 && pk < 400 && !locked) glow(kit.gOver, r, 0xfff0a0, 0.6 * (1 - pk / 400), 2);
      if (locked) {
        const st = this.stage();
        tooltip(kit.layer(true), 'Build the Perch', r.x + r.w / 2, r.y - 1, now, this.lockTipAt, st.x + 2, st.x + st.w - 2, 1700);
      }
    });
  }

  /** The big button: Equip / Unequip / Along / Locked. */
  private drawButton(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const e0 = this.equipRect();
    const a = enterK(now, this.openAt, 6, 40, 240);
    if (a <= 0) return;
    const e = { ...e0, y: e0.y + Math.round((1 - easeOut3(a)) * 10) };
    const label = this.equipLabel();
    if (label === 'Locked') {
      bigButton(kit, g, kit.texts, e, 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt, alpha: a });
      const sh = now - this.shakeAt;
      const dx = sh < 280 ? Math.round(Math.sin(sh / 18) * 2 * (1 - sh / 280)) : 0;
      padlock(kit.gOver, Math.round(e.x + e.w / 2 - textWidth('Locked', 1, true) / 2 - 11) + dx, e.y + 5, a, 0xd8901c);
      return;
    }
    if (label === 'Along') kit.button(g, kit.texts, e, 'Along', FACE.gold, now, { icon: 'check', alpha: a });
    else if (label === 'Unequip') kit.button(g, kit.texts, e, 'Unequip', FACE.navy, now, { alpha: a });
    else bigButton(kit, g, kit.texts, e, 'Equip', FACE.green, now, { alpha: a });
  }
}
