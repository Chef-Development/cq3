// The bag's item grid (the forge's item picker reuses it) and the row of six equipment slots. Cells pop in with a
// wave when a screen opens; empty cells are dim; Rare and better glow, Epic and better shimmer; worn items carry a
// gold corner, new ones a pulsing red dot, locked ones a padlock. The selected cell lifts, with a pulsing white rim.
import type Phaser from 'phaser';
import { SLOT_KEYS, slotOf, type Slot, type SlotKey } from '../../data/gear';
import type { Item } from '../../core/gear';
import { equippedIn, isEquipped, sortItems, type Profile, type SortMode } from '../../core/profile';
import type { Tuning } from '../../core/tuning';
import type { CampKit, Layer } from './camp-kit';
import { cellGlow, cellIcon, cellMarks, cellShine, itemCell, SLOT_ICON } from './items';
import { glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;

export const CELL = 14;
export const PITCH = 15;

export interface GridDraw {
  layer: Layer;
  cap: number;
  /** uid of the selected item (0 = none). */
  selected: number;
  /** When the screen opened (performance.now): the cells pop in with a wave. */
  openAt: number;
  /** Items to point out (they pulse green), e.g. the ones that fit an empty slot that was tapped. */
  hilite?: (it: Item) => boolean;
  /** Items shown faded (e.g. ones that can't go on the anvil). */
  faded?: (it: Item) => boolean;
  alpha?: number;
}

/** The bag's cells: a page of `cols` x `rows`, in a stable display order. */
export class ItemGrid {
  x = 0;
  y = 0;
  cols = 10;
  rows = 6;
  page = 0;
  /** Display order (uids). Recomputed when the bag's items or the sort change, not when a "new" flag clears. */
  order: number[] = [];
  private key = '';

  layout(x: number, y: number, cols: number, rows: number): void {
    this.x = x;
    this.y = y;
    this.cols = cols;
    this.rows = rows;
  }

  get perPage(): number {
    return this.cols * this.rows;
  }

  pages(cap: number): number {
    return Math.max(1, Math.ceil(Math.max(cap, this.order.length) / this.perPage));
  }

  get w(): number {
    return (this.cols - 1) * PITCH + CELL;
  }

  get h(): number {
    return (this.rows - 1) * PITCH + CELL;
  }

  refresh(p: Profile, t: Tuning, mode: SortMode, wornFirst = false, force = false): void {
    const key = `${mode}|${wornFirst}|${p.items
      .map((i) => i.uid)
      .sort((a, b) => a - b)
      .join(',')}`;
    if (key === this.key && !force) return;
    this.key = key;
    let items = sortItems(t, p.items, mode);
    if (wornFirst) {
      const worn = SLOT_KEYS.map((k) => equippedIn(p, k)).filter((i): i is Item => !!i);
      items = [...worn, ...items.filter((i) => !worn.includes(i))];
    }
    this.order = items.map((i) => i.uid);
    this.page = Math.min(this.page, this.pages(0) - 1);
  }

  /** The rect of the i-th cell on the page. */
  rect(i: number): Rect {
    return { x: this.x + (i % this.cols) * PITCH, y: this.y + Math.floor(i / this.cols) * PITCH, w: CELL, h: CELL };
  }

  /** The cells holding items on this page: the keyboard's targets (drawn as cells, not buttons: input.ts focusExtras). */
  itemRects(): Rect[] {
    const n = Math.max(0, Math.min(this.perPage, this.order.length - this.page * this.perPage));
    return Array.from({ length: n }, (_, i) => this.rect(i));
  }

  /** The rect of an item's cell, if it's on the page. */
  rectOf(uid: number): Rect | null {
    const i = this.order.indexOf(uid) - this.page * this.perPage;
    return i >= 0 && i < this.perPage ? this.rect(i) : null;
  }

  /** What a tap hits: { item } for an item's cell, { item: undefined } for an empty cell, null outside the grid. */
  hit(p: Profile, x: number, y: number): { item: Item | undefined } | null {
    if (x < this.x - 1 || y < this.y - 1 || x > this.x + this.w + 1 || y > this.y + this.h + 1) return null;
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.x + 0.5) / PITCH)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.y + 0.5) / PITCH)));
    const uid = this.order[this.page * this.perPage + r * this.cols + c];
    return { item: uid ? p.items.find((i) => i.uid === uid) : undefined };
  }

  draw(kit: CampKit, p: Profile, now: number, o: GridDraw): void {
    const { g, over, icons } = o.layer;
    const A = o.alpha ?? 1;
    const base = this.page * this.perPage;
    const shown = Math.min(this.perPage, Math.max(0, Math.max(o.cap, this.order.length) - base));
    for (let i = 0; i < this.perPage; i++) {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      // the wave: cells pop in along the diagonal
      const k = clamp01((now - o.openAt - 60 - (col + row) * 14) / 150);
      if (k <= 0) continue;
      const a = A * k;
      const r0 = this.rect(i);
      const dy = Math.round((1 - easeBack(k, 2)) * 3);
      if (i >= shown) continue; // past the bag's size: no cell
      const uid = this.order[base + i];
      const it = uid ? p.items.find((x) => x.uid === uid) : undefined;
      if (!it) {
        itemCell(g, { ...r0, y: r0.y + dy }, null, { dim: true, alpha: a * 0.8 });
        continue;
      }
      const sel = it.uid === o.selected;
      const lift = sel ? -1 : 0;
      const r = { ...r0, y: r0.y + dy + lift };
      const faded = o.faded?.(it) ?? false;
      const fa = faded ? a * 0.45 : a;
      if (sel) {
        glow(g, r, WHITE, 0.25 + 0.25 * pulse(now, 700), 2);
        rows(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 3, INK, a);
        rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 2, mix(GOLD[3], WHITE, pulse(now, 600)), a);
      } else if (!faded) cellGlow(g, r, it.rarity, now, a);
      if (o.hilite?.(it)) glow(g, r, 0x8af06a, 0.4 + 0.4 * pulse(now, 500), 3);
      itemCell(g, r, it.rarity, { alpha: fa });
      cellIcon(kit.imgs, it, r, icons, 1, fa);
      if (!faded) cellShine(over, r, it.rarity, now, a);
      cellMarks(over, r, { equipped: isEquipped(p, it.uid), fresh: it.fresh, locked: it.locked, alpha: fa }, now);
      if (it.plus > 0) plusPips(over, r, it.plus, fa);
    }
  }
}

/** Forge levels on a cell: a gold "+n" pip row along the bottom edge (one pip per 2 levels, max 5). */
function plusPips(g: G, r: Rect, plus: number, a: number): void {
  const n = Math.min(5, Math.ceil(plus / 2));
  const x0 = r.x + 2;
  for (let i = 0; i < n; i++) {
    g.fillStyle(INK, a);
    g.fillRect(x0 + i * 2, r.y + r.h - 3, 2, 3);
    g.fillStyle(plus >= 10 ? 0xffffff : 0xf2c230, a);
    g.fillRect(x0 + i * 2, r.y + r.h - 2, 1, 1);
  }
}

/** The six equipment slots in a row (trinkets set a little apart). */
export class WornRow {
  x = 0;
  y = 0;
  readonly size = 16;
  readonly pitch = 17;

  layout(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  get w(): number {
    return 5 * this.pitch + 3 + this.size;
  }

  rect(k: SlotKey): Rect {
    const i = SLOT_KEYS.indexOf(k);
    return { x: this.x + i * this.pitch + (i >= 4 ? 3 : 0), y: this.y, w: this.size, h: this.size };
  }

  /** Every slot's rect (the keyboard's targets). */
  rects(): Rect[] {
    return SLOT_KEYS.map((k) => this.rect(k));
  }

  at(x: number, y: number): SlotKey | null {
    for (const k of SLOT_KEYS) if (inRect(this.rect(k), x, y, 1)) return k;
    return null;
  }

  /**
   * The slots: an empty one shows its kind as a dark silhouette; a worn item its rarity frame. `target` pulses the
   * slots an item could go in (the selected bag item's kind); `flash` maps a slot to the time something landed in it.
   */
  draw(kit: CampKit, p: Profile, now: number, o: { layer: Layer; selected: number; target: Slot | null; flash: Map<SlotKey, number>; openAt: number; alpha?: number }): void {
    const { g, over, icons } = o.layer;
    const A = o.alpha ?? 1;
    // a shelf the slots sit on: a gold-trimmed strip
    const sx = this.x - 4;
    const sw = this.w + 8;
    rows(g, sx - 1, this.y - 4, sw + 2, this.size + 9, 3, INK, A);
    rows(g, sx, this.y - 3, sw, this.size + 7, 2, NAVY[2], A);
    g.fillStyle(NAVY[4], A);
    g.fillRect(sx + 2, this.y - 3, sw - 4, 1);
    g.fillStyle(GOLD[2], A);
    g.fillRect(sx + 2, this.y + this.size + 2, sw - 4, 1);
    SLOT_KEYS.forEach((k, i) => {
      const kk = clamp01((now - o.openAt - 20 - i * 30) / 160);
      if (kk <= 0) return;
      const a = A * kk;
      const r0 = this.rect(k);
      const fl = now - (o.flash.get(k) ?? -1e9);
      const bump = fl < 260 ? -Math.round(Math.sin((fl / 260) * Math.PI) * 3) : 0;
      const r = { ...r0, y: r0.y + bump + Math.round((1 - easeBack(kk, 2)) * 3) };
      const it = equippedIn(p, k);
      const fits = o.target !== null && slotOf(k) === o.target;
      if (fits) glow(g, r, 0x8af06a, 0.35 + 0.45 * pulse(now, 650), 3);
      if (it) {
        const sel = it.uid === o.selected;
        if (sel) {
          rows(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 3, INK, a);
          rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 2, mix(GOLD[3], WHITE, pulse(now, 600)), a);
        } else cellGlow(g, r, it.rarity, now, a);
        itemCell(g, r, it.rarity, { alpha: a });
        cellIcon(kit.imgs, it, r, icons, 1, a);
        cellShine(over, r, it.rarity, now, a);
        cellMarks(over, r, { locked: it.locked, alpha: a }, now);
        if (it.plus > 0) plusPips(over, r, it.plus, a);
      } else {
        // an empty slot: a dark well with a gold dashed rim and the slot's silhouette
        rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, INK, a);
        rows(g, r.x, r.y, r.w, r.h, 2, fits ? 0x2a4a2a : NAVY[1], a);
        g.fillStyle(fits ? 0x8af06a : GOLD[1], a * (fits ? 0.6 + 0.4 * pulse(now, 650) : 0.8));
        for (let d = 2; d < r.w - 2; d += 3) {
          g.fillRect(r.x + d, r.y, 2, 1);
          g.fillRect(r.x + d, r.y + r.h - 1, 2, 1);
          g.fillRect(r.x, r.y + d, 1, 2);
          g.fillRect(r.x + r.w - 1, r.y + d, 1, 2);
        }
        const key = `item_${SLOT_ICON[slotOf(k)]}`;
        const [w, h] = kit.imgs.size(key);
        kit.imgs.at(key, r.x + Math.round((r.w - w) / 2), r.y + Math.round((r.h - h) / 2), icons, a * 0.5, 0x3a3060);
      }
      if (fl < 420) {
        const fk = fl / 420;
        rows(over, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, WHITE, 0.85 * (1 - fk) * a);
      }
    });
  }
}
