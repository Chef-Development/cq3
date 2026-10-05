// The Bag (a camp screen): the item grid, the six equipped slots, sorting (Rarity / Slot / New), and a card for the
// selected item: its name in its rarity's color and kind, one verdict line (better or worse than what's worn, in
// power), only the stats that would change (green up, red down; the item's full list one tap away), its unique
// effect, its set; Equip / Unequip and Lock.
// With nothing selected the card shows the picked hero's core stats and set bonuses (gear is shared by the heroes).
// Equipping is loud: the icon flies into its slot, the slot flashes, and a toast lists each stat before -> after.
import type Phaser from 'phaser';
import { BASE_BY_ID, EFFECTS, RARITY_INFO, SETS, SLOT_NAME, STAT_IDS, STAT_INFO, CORE_STATS, slotOf, type Slot, type SlotKey, type StatId } from '../../data/gear';
import { baseStats, bonusStats, fmtStatShort, fmtTotal, itemPower, itemStats, setOf, slotOfItem, statAmount, zeroStats, type Item, type StatBlock } from '../../core/gear';
import { equip, equippedIn, equippedItems, isEquipped, itemByUid, profileLoadout, replaces, toggleLock, unequip, type SortMode } from '../../core/profile';
import { HEROES } from '../../data/heroes';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GREEN, RED, statChanges, statMark } from './camp-kit';
import { ItemGrid, WornRow } from './item-grid';
import { cellGlow, cellIcon, cellMarks, cellShine, fit, itemCell, rarityText, statSize, wrapText } from './items';
import { GOLD, hudIcon, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

const SORTS: SortMode[] = ['rarity', 'slot', 'new'];
const SORT_LABEL: Record<SortMode, string> = { rarity: 'Rarity', slot: 'Slot', new: 'New' };

export class BagScreen {
  readonly grid = new ItemGrid();
  readonly worn = new WornRow();
  sel = 0;
  sort: SortMode = 'rarity';
  private openAt = 0;
  private selAt = 0;
  private slotFlash = new Map<SlotKey, number>();
  private hilite: { slot: Slot; at: number } | null = null;
  private shakes = new Map<string, number>();
  private lockAt = -1e9;
  private sortAt = -1e9;
  private statAt = new Map<StatId, { at: number; up: boolean }>();
  private lastStats: StatBlock | null = null;
  /** The card's compare view, or the item's full list (a tap on the stat area or its Details tag flips it). */
  private details = false;
  private statsArea: Rect | null = null;
  private detailsTag: Rect | null = null;

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    this.openAt = now;
    this.selAt = now;
    this.sel = 0;
    this.grid.page = 0;
    this.lastStats = null;
    this.layout();
    this.grid.refresh(this.kit.profile, this.kit.tuning, this.sort, false, true);
  }

  // ------------------------------------------------------------------ layout

  private get left(): number {
    return this.kit.s.L + 3;
  }

  private layout(): void {
    const left = this.left;
    this.worn.layout(left + 3, 22);
    this.grid.layout(left + 1, 44, 10, 6);
  }

  private sortRect(): Rect {
    const x = this.worn.x + this.worn.w + 6;
    return { x, y: 19, w: this.grid.x + this.grid.w - x, h: 17 };
  }

  private pageRect(): Rect | null {
    if (this.grid.pages(this.cap) <= 1) return null;
    const s = this.sortRect();
    return { x: s.x + Math.round(s.w / 2) + 1, y: s.y, w: s.w - Math.round(s.w / 2) - 1, h: s.h };
  }

  private pane(): Rect {
    const s = this.kit.s;
    const x = this.grid.x + this.grid.w + 5;
    return { x, y: 3, w: s.R - 3 - x, h: s.B - 6 };
  }

  private get cap(): number {
    return Math.max(1, Math.round(this.kit.tuning.gear.bagSize));
  }

  private buttons(): { equip: Rect; lock: Rect } {
    const p = this.pane();
    const y = p.y + p.h - 19;
    const lw = 44;
    return { equip: { x: p.x + 5, y, w: p.w - 10 - lw - 3, h: 15 }, lock: { x: p.x + p.w - 5 - lw, y, w: lw, h: 15 } };
  }

  // ------------------------------------------------------------------ taps

  /** A tap on the bag screen; returns 'back' to leave it. */
  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const app = kit.app;
    const p = kit.profile;
    this.layout();
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    const pr = this.pageRect();
    if (pr && inRect(pr, x, y, 1)) {
      notePress(pr);
      app.audio.uiClick();
      this.grid.page = (this.grid.page + 1) % this.grid.pages(this.cap);
      this.openAt = now - 60;
      return;
    }
    const sr = this.sortRect();
    if (inRect(pr ? { ...sr, w: sr.w - (pr.w + 1) } : sr, x, y, 2)) {
      notePress(pr ? { ...sr, w: sr.w - (pr.w + 1) } : sr);
      app.audio.uiClick();
      this.sort = SORTS[(SORTS.indexOf(this.sort) + 1) % SORTS.length];
      this.grid.refresh(p, kit.tuning, this.sort, false, true);
      this.grid.page = 0;
      this.sortAt = now;
      kit.fx.float(this.sort === 'new' ? 'Newest first' : `Sorted by ${this.sort}`, this.grid.x + this.grid.w / 2, this.grid.y + 20, 0xfff0c0, { life: 1100 });
      this.openAt = now - 40; // the cells pop in again in their new order
      return;
    }
    const k = this.worn.at(x, y);
    if (k) return this.tapSlot(k, now);
    const hit = this.grid.hit(p, x, y);
    if (hit) {
      if (hit.item) this.select(hit.item.uid === this.sel ? 0 : hit.item.uid, now);
      else if (this.sel) this.select(0, now);
      return;
    }
    if (this.sel) {
      const b = this.buttons();
      const it = itemByUid(p, this.sel);
      if (it && inRect(b.equip, x, y, 2)) {
        notePress(b.equip);
        if (isEquipped(p, it.uid)) this.unequipSel(now);
        else this.equipSel(now);
        return;
      }
      if (it && inRect(b.lock, x, y, 2)) {
        notePress(b.lock);
        const locked = toggleLock(p, it.uid);
        kit.commit();
        app.audio.lockToggle();
        this.lockAt = now;
        const c = this.grid.rectOf(it.uid) ?? this.worn.rect(this.slotOfWorn(it.uid) ?? 'weapon');
        kit.fx.burst(c.x + c.w - 3, c.y + c.h - 3, locked ? [0xf2c230, 0xfff0a0, WHITE] : [0xb8c2d8, WHITE], 8, 0.6);
        kit.fx.float(locked ? 'Locked!' : 'Unlocked', b.lock.x + b.lock.w / 2, b.lock.y - 6, locked ? 0xffe680 : 0xd8d0f0);
        return;
      }
      // the stat area (or its Details tag): every stat the item has, or back to the compare
      const dt = this.detailsTag;
      if (it && ((dt && inRect(dt, x, y, 3)) || (this.statsArea && inRect(this.statsArea, x, y)))) {
        if (dt) notePress(dt);
        this.details = !this.details;
        app.audio.uiClick();
        return;
      }
    }
  }

  private slotOfWorn(uid: number): SlotKey | null {
    const p = this.kit.profile;
    for (const k of Object.keys(p.equipped) as SlotKey[]) if (p.equipped[k] === uid) return k;
    return null;
  }

  private select(uid: number, now: number): void {
    const kit = this.kit;
    this.sel = uid;
    this.selAt = now;
    this.details = false;
    kit.fadeToast();
    const it = uid ? itemByUid(kit.profile, uid) : undefined;
    if (it?.fresh) {
      it.fresh = false;
      kit.app.saveProfile();
    }
    kit.app.audio.uiClick();
  }

  private tapSlot(k: SlotKey, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const sel = this.sel ? itemByUid(p, this.sel) : undefined;
    // a bag item of this kind is selected: it goes in this slot
    if (sel && !isEquipped(p, sel.uid) && slotOfItem(sel) === slotOf(k)) {
      notePress(this.worn.rect(k));
      return this.equipSel(now, k);
    }
    // a worn trinket selected: tapping the other trinket slot moves it there
    if (sel && slotOfItem(sel) === 'trinket' && slotOf(k) === 'trinket' && p.equipped[k] !== sel.uid && !p.equipped[k]) {
      return this.equipSel(now, k);
    }
    const worn = equippedIn(p, k);
    if (worn) return this.select(worn.uid === this.sel ? 0 : worn.uid, now);
    // an empty slot: point out the bag items that fit it
    const kind = slotOf(k);
    const n = p.items.filter((i) => slotOfItem(i) === kind && !isEquipped(p, i.uid)).length;
    this.hilite = { slot: kind, at: now };
    this.shakes.set(k, now);
    kit.app.audio.uiClick();
    const r = this.worn.rect(k);
    kit.fx.float(n ? `Pick a ${SLOT_NAME[kind].toLowerCase()}!` : `No ${SLOT_NAME[kind].toLowerCase()} yet`, r.x + r.w / 2, r.y + r.h + 10, n ? GREEN : 0xd8d0f0, { life: 1300 });
    if (this.sel) this.select(0, now);
  }

  private equipSel(now: number, slot?: SlotKey): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const it = itemByUid(p, this.sel);
    if (!it) return;
    const kind = slotOfItem(it);
    const target = slot ?? (kind === 'trinket' ? replaces(p, t, it).slot : (kind as SlotKey));
    const before = kit.stats();
    const from = this.grid.rectOf(it.uid) ?? (this.slotOfWorn(it.uid) ? this.worn.rect(this.slotOfWorn(it.uid)!) : null);
    const got = equip(p, it.uid, target);
    if (!got) return;
    kit.commit();
    const after = kit.stats();
    kit.app.audio.equip();
    const to = this.worn.rect(got);
    const land = () => {
      const t2 = performance.now();
      this.slotFlash.set(got, t2);
      kit.fx.flash(to, WHITE, 360);
      kit.fx.ring(to.x + to.w / 2, to.y + to.h / 2, 16, 0xfff0a0, 360);
      kit.fx.burst(to.x + to.w / 2, to.y + to.h / 2, [0xfff0a0, 0xffd23a, WHITE, 0x8af06a], 16, 1, { kind: 'star', g: 40, life: 520 });
    };
    if (from) kit.fx.fly({ key: `item_${BASE_BY_ID[it.base]?.icon}`, x0: from.x + from.w / 2, y0: from.y + from.h / 2, x1: to.x + to.w / 2, y1: to.y + to.h / 2, arc: 18, life: 360, done: land });
    else land();
    const lines = statChanges(before, after, STAT_IDS);
    kit.after(from ? 300 : 0, () =>
      kit.toast({ title: 'Equipped!', ribbon: RIBBON.green, lines, cx: this.grid.x + this.grid.w / 2, cy: this.grid.y + this.grid.h / 2 + 2, note: lines.length ? undefined : 'No stat change' }),
    );
    this.selAt = now;
  }

  private unequipSel(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const k = this.slotOfWorn(this.sel);
    if (!k) return;
    const it = itemByUid(p, this.sel)!;
    const before = kit.stats();
    const from = this.worn.rect(k);
    unequip(p, k);
    kit.commit();
    const after = kit.stats();
    kit.app.audio.panelClose();
    this.slotFlash.set(k, now);
    const to = this.grid.rectOf(it.uid);
    if (to) kit.fx.fly({ key: `item_${BASE_BY_ID[it.base]?.icon}`, x0: from.x + from.w / 2, y0: from.y + from.h / 2, x1: to.x + to.w / 2, y1: to.y + to.h / 2, arc: 14, life: 340, done: () => kit.fx.flash(to, WHITE, 260) });
    const lines = statChanges(before, after, STAT_IDS);
    kit.toast({ title: 'Taken off', ribbon: RIBBON.red, lines, cx: this.grid.x + this.grid.w / 2, cy: this.grid.y + this.grid.h / 2 + 2, note: lines.length ? undefined : 'No stat change' });
    this.selAt = now;
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const g = kit.gUi;
    this.layout();
    this.grid.refresh(p, t, this.sort);
    if (this.sel && !itemByUid(p, this.sel)) this.sel = 0;
    // stats that just changed glow in the Rowan card
    const st = kit.stats();
    if (this.lastStats) for (const id of STAT_IDS) if (fmtTotal(id, st[id]) !== fmtTotal(id, this.lastStats[id])) this.statAt.set(id, { at: now, up: st[id] > this.lastStats[id] });
    this.lastStats = st;

    // top bar: Back, the title with the bag's fill
    kit.drawBack(g, now);
    const n = p.items.length;
    const full = n >= this.cap;
    kit.title(g, 'Bag', kit.backRect().x + kit.backRect().w + 4, 4, full ? RIBBON.red : RIBBON.blue, `${n}/${this.cap}`);

    // the worn row, the sort button, the grid
    const sel = this.sel ? itemByUid(p, this.sel) : undefined;
    const target = sel && !isEquipped(p, sel.uid) ? slotOfItem(sel) : null;
    const layer = kit.layer(false);
    this.worn.draw(kit, p, now, { layer, selected: this.sel, target, flash: this.slotFlash, openAt: this.openAt });
    this.drawSort(g, now);
    // the grid sits in a dark tray
    const gr = this.grid;
    rows(g, gr.x - 3, gr.y - 3, gr.w + 6, gr.h + 6, 3, INK);
    rows(g, gr.x - 2, gr.y - 2, gr.w + 4, gr.h + 4, 2, NAVY[1]);
    g.fillStyle(NAVY[3], 1);
    g.fillRect(gr.x - 1, gr.y + gr.h + 1, gr.w + 2, 1);
    const hl = this.hilite && now - this.hilite.at < 1600 ? this.hilite.slot : null;
    gr.draw(kit, p, now, { layer, cap: this.cap, selected: this.sel, openAt: this.openAt, hilite: hl ? (it) => slotOfItem(it) === hl && !isEquipped(p, it.uid) : undefined });

    // the card
    const pr = this.pane();
    const k = easeBack((now - this.openAt - 80) / 260, 1.4);
    if (k <= 0) return;
    const pk = { ...pr, x: pr.x + Math.round((1 - k) * 30) };
    kit.pane(g, pk, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    if (sel) this.drawItem(g, sel, pr, now);
    else this.drawRowan(g, pr, now);
  }

  private drawSort(g: G, now: number): void {
    const kit = this.kit;
    const sr = this.sortRect();
    const pr = this.pageRect();
    const r = pr ? { ...sr, w: sr.w - (pr.w + 1) } : sr;
    const pop = now - this.sortAt < 200 ? -1 : 0;
    kit.button(g, kit.texts, { ...r, y: r.y + pop }, pr ? '' : SORT_LABEL[this.sort], FACE.navy, now, { icon: pr ? 'sort' : undefined, bold: false });
    if (pr) kit.button(g, kit.texts, pr, `${this.grid.page + 1}/${this.grid.pages(this.cap)}`, FACE.navy, now, { bold: false });
  }

  /** Nothing selected: the picked hero's core stats, the set bonuses and unique effects, and a hint. */
  private drawRowan(g: G, pr: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const st = kit.stats();
    const ix = pr.x + 6;
    const iw = pr.w - 12;
    texts.text(HEROES[p.hero].name, pr.x + pr.w / 2, pr.y + 9, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5 });
    const gp = equippedItems(p).reduce((a, i) => a + itemPower(t, i), 0);
    let y = pr.y + 20;
    texts.text(`Gear power ${gp}`, pr.x + pr.w / 2, y, 0xc8c0e8, { ox: 0.5, oy: 0.5 });
    y += 9;
    CORE_STATS.forEach((id, i) => {
      const ry = y + i * 15;
      const ch = this.statAt.get(id);
      const hot = ch ? clamp01(1 - (now - ch.at) / 1400) : 0;
      rows(g, ix - 2, ry, iw + 4, 13, 2, i % 2 ? NAVY[2] : NAVY[3]);
      if (hot > 0) rows(g, ix - 2, ry, iw + 4, 13, 2, ch!.up ? 0x3aaa34 : 0xb02a2a, 0.6 * hot);
      const ic = STAT_INFO[id].icon;
      const [iw2, ih] = iconSize(ic);
      hudIcon(g, ic, ix + Math.round((15 - iw2) / 2), ry + Math.round((13 - ih) / 2));
      texts.text(STAT_INFO[id].name, ix + 18, ry + 7, 0xe8e0ff, { oy: 0.5 });
      const col = hot > 0 ? mix(WHITE, ch!.up ? GREEN : RED, 1 - hot * 0.3) : WHITE;
      texts.text(fmtTotal(id, st[id]), ix + iw, ry + 6.5 - (hot > 0.7 ? 1 : 0), col, { bold: true, ox: 1, oy: 0.5 });
    });
    y += 4 * 15 + 3;
    kit.divider(g, ix, y, iw);
    y += 7;
    // set bonuses and unique effects worn
    const L = profileLoadout(p, t);
    const lines: Array<{ text: string; col: number }> = [];
    for (const [id, def] of Object.entries(SETS)) {
      const worn = L.sets[id as keyof typeof SETS] ?? 0;
      if (!worn) continue;
      lines.push({ text: `${def.name} ${worn}/${def.pieces.length}`, col: 0x8af06a });
      for (const b of def.bonuses) for (const l of wrapText(`${b.count}: ${b.text}`, iw - 4)) lines.push({ text: ` ${l}`, col: worn >= b.count ? 0xd8ffc0 : 0x7a8a7a });
    }
    for (const e of L.effects) lines.push({ text: EFFECTS[e].name, col: 0xffb060 });
    // the bottom hint: a full bag warns that new loot will melt into scrap (the lines above stop clear of it)
    const full = p.items.length >= this.cap;
    const hint = wrapText(full ? 'Bag full! New loot melts into scrap' : p.items.length ? 'Tap an item to compare it' : 'Win fights to find gear!', iw);
    const maxY = pr.y + pr.h - 8 - (hint.length - 1) * 8 - 9;
    if (!lines.length) {
      texts.text('No set bonuses yet', ix, y, DIM_TXT, { oy: 0.5 });
      y += 8;
      for (const l of wrapText('Wear 2 set pieces!', iw)) {
        if (y > maxY) break;
        texts.text(l, ix, y, 0x7a7298, { oy: 0.5 });
        y += 8;
      }
    } else
      for (const l of lines) {
        if (y > maxY) break;
        texts.text(l.text, ix, y, l.col, { oy: 0.5 });
        y += 8;
      }
    hint.forEach((l, i, a) =>
      texts.text(l, pr.x + pr.w / 2, pr.y + pr.h - 8 - (a.length - 1 - i) * 8, full ? 0xff8a7a : 0xfff07a, { ox: 0.5, oy: 0.5, alpha: 0.55 + 0.45 * pulse(now, 1100) }),
    );
  }

  /**
   * The selected item's card: the header, then ONE verdict line (better / worse / same power than what's worn, or
   * nothing worn there), then only the stats that change ("+4 ATK" green, "-8 HP" red: at most four, the core four
   * first, then "+N more"), its unique effect and its set. A tap on the stat area (or Details) lists every stat the
   * item has instead. Equip / Unequip and Lock at the bottom.
   */
  private drawItem(g: G, it: Item, pr: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const over = kit.gOver;
    const k = easeBack((now - this.selAt) / 220, 1.6);
    const sx = Math.round((1 - k) * 8);
    const ix = pr.x + 5 + sx;
    const iw = pr.w - 10;
    const worn = isEquipped(p, it.uid);
    const rep = replaces(p, t, it);
    const cur = !worn ? rep.item : undefined;
    const rc = rarityText(it.rarity);

    // header: the icon at 2x in its rarity frame, the name, the kind
    const cell: Rect = { x: ix, y: pr.y + 6, w: 26, h: 26 };
    cellGlow(g, cell, it.rarity, now);
    itemCell(g, cell, it.rarity);
    cellIcon(kit.imgs, it, cell, D.icons, 2);
    cellShine(over, cell, it.rarity, now);
    cellMarks(over, cell, { locked: it.locked }, now);
    if (now - this.lockAt < 300) rows(over, cell.x - 1, cell.y - 1, cell.w + 2, cell.h + 2, 2, WHITE, 0.7 * (1 - (now - this.lockAt) / 300));
    if (it.plus > 0) {
      const txt = `+${it.plus}`;
      const tw = textWidth(txt, 1, true) + 4;
      const r = { x: cell.x + cell.w - tw + 3, y: cell.y - 4, w: tw, h: 10 };
      tag(over, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]]);
      texts.text(txt, r.x + 2, r.y + 5, WHITE, { bold: true, oy: 0.5 });
    }
    const nx = cell.x + cell.w + 5;
    const nw = pr.x + pr.w - 5 - nx;
    let y = pr.y + 9;
    for (const line of wrapText(BASE_BY_ID[it.base]?.name ?? 'Item', nw, true).slice(0, 2)) {
      texts.text(line, nx, y, rc, { bold: true, oy: 0.5 });
      y += 9;
    }
    // "Lv 12 Epic Weapon" (the slot is left off when it doesn't fit: the icon shows it)
    const kindFull = `Lv ${it.ilvl} ${RARITY_INFO[it.rarity].name} ${SLOT_NAME[slotOfItem(it)]}`;
    // ("Lv 24 Legendary" too wide for the column wraps to two lines rather than losing the rarity)
    const kind = textWidth(kindFull, 1, false) <= nw ? kindFull : `Lv ${it.ilvl} ${RARITY_INFO[it.rarity].name}`;
    for (const line of wrapText(kind, nw).slice(0, 2)) {
      texts.text(fit(line, nw), nx, y, mix(rc, 0xd8d0f0, 0.5), { oy: 0.5 });
      y += 8;
    }
    y = Math.max(y, cell.y + cell.h + 6);

    // the verdict
    const pw = itemPower(t, it);
    const dp = worn ? 0 : pw - (cur ? itemPower(t, cur) : 0);
    this.verdict(g, { x: ix - 1, y: y - 6, w: iw + 2, h: 13 }, worn ? 'worn' : !cur ? 'empty' : dp > 0 ? 'better' : dp < 0 ? 'worse' : 'same', worn ? pw : dp);
    y += this.details ? 13 : 14;

    // the stat rows: the changes vs what's worn (compare), or every stat the item has (details; and a worn item)
    const next = itemStats(t, it);
    const now0: StatBlock = cur ? itemStats(t, cur) : zeroStats();
    const own = [...baseStats(t, it).map((l) => ({ ...l, bonus: false })), ...bonusStats(t, it).map((l) => ({ ...l, bonus: true }))];
    const byImportance = (a: { stat: StatId; value: number }, b: { stat: StatId; value: number }) => {
      const ca = CORE_STATS.indexOf(a.stat);
      const cb = CORE_STATS.indexOf(b.stat);
      if (ca >= 0 || cb >= 0) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
      return statSize(t, b.stat, b.value) - statSize(t, a.stat, a.value);
    };
    type Row = { stat: StatId; value: number; col: number; lc: number };
    let list: Row[];
    if (this.details) list = own.map((l) => ({ stat: l.stat, value: l.value, col: l.bonus ? 0xc0e8ff : WHITE, lc: l.bonus ? 0x9ad8ff : 0xd8d0f0 }));
    else if (worn) list = [...own].sort(byImportance).map((l) => ({ stat: l.stat, value: l.value, col: WHITE, lc: 0xd8d0f0 }));
    else
      list = STAT_IDS.map((id) => ({ stat: id, value: next[id] - now0[id] }))
        // (a sliver of a stat, like 0.1 ATK, isn't a change worth a line)
        .filter((l) => Math.abs(l.value) >= statAmount(t, l.stat) * 0.1)
        .sort(byImportance)
        .map((l) => ({ ...l, col: l.value > 0 ? GREEN : RED, lc: 0xd8d0f0 }));
    // its unique effect and its set
    const effect = it.effect ? wrapText(this.details ? `${EFFECTS[it.effect].name}: ${EFFECTS[it.effect].text}` : EFFECTS[it.effect].text, iw) : [];
    const setLines: Array<{ text: string; col: number; up?: boolean; cont?: boolean }> = [];
    const set = setOf(it);
    if (set) {
      const def = SETS[set];
      const have = profileLoadout(p, t).sets[set] ?? 0;
      const would = worn ? have : have + 1 - (cur && setOf(cur) === set ? 1 : 0);
      // a bonus it would turn on: "Set 2/4: +10% max HP" (or just that one turns on, when its text is too long)
      const on = def.bonuses.find((b) => have < b.count && would >= b.count);
      const onText = on ? `Set ${would}/${def.pieces.length}: ${on.text}` : '';
      if (on && !this.details) setLines.push({ text: textWidth(onText, 1, false) <= iw - 9 ? onText : `Set ${would}/${def.pieces.length}: a bonus turns on`, col: 0xb4f070, up: true });
      else setLines.push({ text: `${def.name} set ${have}/${def.pieces.length}`, col: 0x8af06a });
      if (this.details)
        for (const b of def.bonuses)
          wrapText(`${b.count}: ${b.text}`, iw - 6).forEach((l, i) => setLines.push({ text: i ? `   ${l}` : ` ${l}`, col: have >= b.count ? 0xd8ffc0 : would >= b.count ? 0xb4f070 : 0x7a8a7a, cont: i > 0 }));
    }
    // fit it all above the buttons: fewer stat rows in compare (they fold into "+N more"), then a tighter pitch and
    // fewer set lines in details
    const bottom = this.buttons().equip.y - 4;
    let pitch = this.details ? 8 : 10;
    let shown = this.details ? list.length : Math.min(4, list.length);
    let setShown = setLines.length;
    // the Details / Compare toggle sits at the end of the last stat row when it fits there, else on a row of its own
    // (with "+N more" when some rows are folded away)
    const tl = this.details ? (worn ? 'Less' : 'Compare') : 'Details';
    const tw = textWidth(tl, 1, false) + 8;
    // (the full list is plainer: regular type, so a long one packs tight)
    const bold = !this.details;
    const rowW = (l: Row) => 11 + textWidth(fmtStatShort(l.stat, l.value), 1, bold) + 3 + textWidth(STAT_INFO[l.stat].short, 1, false);
    const ownRow = () => shown < list.length || !shown || rowW(list[shown - 1]) + 4 + tw > iw;
    const need = () => (shown || 1) * pitch + (ownRow() ? 10 : 0) + (effect.length ? effect.length * 8 + 2 : 0) + (setShown ? setShown * 8 + 1 : 0);
    const avail = bottom - y + 4;
    while (need() > avail && !this.details && shown > 2) shown--;
    if (need() > avail) pitch = 8;
    // (a set bonus goes whole: never half of its wrapped text)
    while (need() > avail && setShown > 1) {
      setShown--;
      while (setShown > 1 && setLines[setShown]?.cont) setShown--;
    }

    const area: Rect = { x: ix - 2, y: y - 5, w: iw + 4, h: 0 };
    if (!list.length) {
      texts.text(worn || this.details ? 'No stats' : 'No stat changes', ix, y, DIM_TXT, { oy: 0.5 });
      y += pitch;
    }
    for (const l of list.slice(0, shown)) {
      const mw = statMark(g, l.stat, ix, y);
      const val = fmtStatShort(l.stat, l.value);
      texts.text(val, ix + mw + 2, y, l.col, { bold, oy: 0.5 });
      texts.text(STAT_INFO[l.stat].short, ix + mw + 2 + textWidth(val, 1, bold) + (bold ? 3 : 4), y + (bold ? 0.5 : 0), l.lc, { oy: 0.5 });
      y += pitch;
    }
    const togRow = ownRow();
    const more = list.length - shown;
    if (more > 0) texts.text(`+${more} more`, ix, y, DIM_TXT, { oy: 0.5 });
    const ty = togRow ? y : y - pitch;
    const tr: Rect = { x: ix + iw - tw, y: ty - 5, w: tw, h: 10 };
    const tp = isPressed(tr, now) ? 1 : 0;
    tag(g, { ...tr, y: tr.y + tp }, [NAVY[6], NAVY[4], NAVY[3], NAVY[2]]);
    texts.text(tl, tr.x + tr.w / 2, tr.y + 5 + tp, 0xfff0c0, { ox: 0.5, oy: 0.5 });
    this.detailsTag = tr;
    if (togRow) y += 10;
    else y += 1;
    area.h = y - 5 - area.y;
    this.statsArea = area;
    if (effect.length) {
      y += 2;
      for (const l of effect) {
        texts.text(l, ix, y, 0xffb060, { oy: 0.5 });
        y += 8;
      }
    }
    if (setShown) {
      y += 1;
      for (const l of setLines.slice(0, setShown)) {
        if (l.up) arrow(g, ix + 1, y - 1, true, l.col);
        texts.text(l.text, ix + (l.up ? 9 : 0), y, l.col, { oy: 0.5 });
        y += 8;
      }
    }

    // buttons: Equip / Unequip, Lock / Unlock
    const b = this.buttons();
    if (worn) kit.button(g, texts, b.equip, 'Unequip', FACE.navy, now);
    else kit.button(g, texts, b.equip, 'Equip', FACE.green, now, { glowCol: dp > 0 ? 0x8af06a : undefined });
    const lk = now - this.lockAt;
    const lr = lk < 200 ? { ...b.lock, y: b.lock.y - Math.round(Math.sin((lk / 200) * Math.PI) * 2) } : b.lock;
    kit.button(g, texts, lr, it.locked ? 'Unlock' : 'Lock', it.locked ? FACE.gold : FACE.navy, now, { bold: false });
  }

  /** The verdict band: "Better: +21 power" (green, up), "Worse: -12 power" (red, down), "Same power", "Nothing worn
   *  here" (an empty slot), or "Worn: 103 power" (gold). */
  private verdict(g: G, r: Rect, kind: 'better' | 'worse' | 'same' | 'empty' | 'worn', n: number): void {
    const texts = this.kit.texts;
    const look = {
      better: { face: [0x8af06a, 0x235a2c, 0x1c4a24, 0x0e2a14] as const, col: GREEN, text: `Better: +${n} power`, arrow: true },
      empty: { face: [0x8af06a, 0x235a2c, 0x1c4a24, 0x0e2a14] as const, col: GREEN, text: 'Nothing worn here', arrow: false },
      worse: { face: [0xff8a7a, 0x5a2030, 0x4a1a26, 0x2a0a14] as const, col: RED, text: `Worse: ${n} power`, arrow: true },
      same: { face: [NAVY[6], NAVY[3], NAVY[2], NAVY[1]] as const, col: 0xc8c0e8, text: 'Same power', arrow: false },
      worn: { face: [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] as const, col: 0x3a1e08, text: `Worn: ${n} power`, arrow: false },
    }[kind];
    tag(g, r, look.face);
    const tw = textWidth(look.text, 1, true);
    const w = tw + (look.arrow ? 9 : 0);
    const x = Math.round(r.x + (r.w - w) / 2);
    if (look.arrow) arrow(g, x + 1, r.y + 5, kind === 'better', look.col);
    texts.text(look.text, x + (look.arrow ? 9 : 0), r.y + r.h / 2, look.col, { bold: true, oy: 0.5 });
  }
}

/** A tiny up (green) or down (red) triangle, 5 x 3 inside an ink rim, top-left at (x, y). */
export function arrow(g: G, x: number, y: number, up: boolean, col: number): void {
  const w = up ? [1, 3, 5] : [5, 3, 1];
  g.fillStyle(INK, 1);
  w.forEach((n, i) => g.fillRect(x + (5 - n) / 2 - 1, y + i - 1, n + 2, 3));
  g.fillStyle(col, 1);
  w.forEach((n, i) => g.fillRect(x + (5 - n) / 2, y + i, n, 1));
}

