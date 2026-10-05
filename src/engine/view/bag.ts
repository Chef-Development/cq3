// The Bag (a camp screen): the item grid, the six equipped slots, sorting (Rarity / Slot / New), and a card for the
// selected item: its name in its rarity's color, kind and power, every stat it gives with how each one compares to
// what's worn (green up, red down; stats it would lose in red), its unique effect, its set; Equip / Unequip and Lock.
// With nothing selected the card shows Rowan's core stats and his set bonuses.
// Equipping is loud: the icon flies into its slot, the slot flashes, and a toast lists each stat before -> after.
import type Phaser from 'phaser';
import { BASE_BY_ID, EFFECTS, RARITY_INFO, SETS, SLOT_NAME, STAT_IDS, STAT_INFO, CORE_STATS, slotOf, type Slot, type SlotKey, type StatId } from '../../data/gear';
import { baseStats, bonusStats, fmtStat, itemName, itemPower, itemStats, setOf, slotOfItem, zeroStats, type Item, type StatBlock } from '../../core/gear';
import { equip, equippedIn, equippedItems, isEquipped, itemByUid, profileLoadout, replaces, toggleLock, unequip, type SortMode } from '../../core/profile';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GREEN, RED, statChanges } from './camp-kit';
import { ItemGrid, WornRow } from './item-grid';
import { cellGlow, cellIcon, cellMarks, cellShine, fit, itemCell, rarityText, wrapText } from './items';
import { GOLD, hudIcon, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON, tag } from './ui';

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
    if (this.lastStats) for (const id of STAT_IDS) if (fmtStat(id, st[id], false) !== fmtStat(id, this.lastStats[id], false)) this.statAt.set(id, { at: now, up: st[id] > this.lastStats[id] });
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

  /** Nothing selected: Rowan's core stats, his set bonuses and unique effects, and a hint. */
  private drawRowan(g: G, pr: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const st = kit.stats();
    const ix = pr.x + 6;
    const iw = pr.w - 12;
    texts.text('Rowan', pr.x + pr.w / 2, pr.y + 9, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5 });
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
      texts.text(fmtStat(id, st[id], false), ix + iw, ry + 6.5 - (hot > 0.7 ? 1 : 0), col, { bold: true, ox: 1, oy: 0.5 });
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
    const maxY = pr.y + pr.h - 22;
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
    // the bottom hint: a full bag warns that new loot will melt into scrap
    const full = p.items.length >= this.cap;
    const hint = full ? 'Bag full! New loot melts into scrap' : p.items.length ? 'Tap an item to compare it' : 'Win fights to find gear!';
    wrapText(hint, iw).forEach((l, i, a) =>
      texts.text(l, pr.x + pr.w / 2, pr.y + pr.h - 8 - (a.length - 1 - i) * 8, full ? 0xff8a7a : 0xfff07a, { ox: 0.5, oy: 0.5, alpha: 0.55 + 0.45 * pulse(now, 1100) }),
    );
  }

  /** The selected item's card: header, power, compare rows, effect, set, buttons. */
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
    // "Lv 12 Epic Weapon" (the slot is left off when it doesn't fit: the icon and the "vs" line show it)
    const kindFull = `Lv ${it.ilvl} ${RARITY_INFO[it.rarity].name} ${SLOT_NAME[slotOfItem(it)]}`;
    const kind = textWidth(kindFull, 1, false) <= nw ? kindFull : `Lv ${it.ilvl} ${RARITY_INFO[it.rarity].name}`;
    texts.text(fit(kind, nw), nx, y, mix(rc, 0xd8d0f0, 0.5), { oy: 0.5 });
    y += 8;
    y = Math.max(y, cell.y + cell.h + 6);

    // what goes in the body: this item's stats, the worn one's stats it lacks, its unique effect, its set
    const next = itemStats(t, it);
    const now0: StatBlock = cur ? itemStats(t, cur) : zeroStats();
    const own = [...baseStats(t, it).map((l) => ({ ...l, bonus: false })), ...bonusStats(t, it).map((l) => ({ ...l, bonus: true }))];
    const lost = worn ? [] : STAT_IDS.filter((s) => now0[s] > 1e-9 && next[s] <= 1e-9);
    const effect = it.effect ? wrapText(`${EFFECTS[it.effect].name}: ${EFFECTS[it.effect].text}`, iw) : [];
    const set = setOf(it);
    const setLines: Array<{ text: string; col: number }> = [];
    if (set) {
      const def = SETS[set];
      const have = profileLoadout(p, t).sets[set] ?? 0;
      const would = worn ? have : have + 1 - (cur && setOf(cur) === set ? 1 : 0);
      setLines.push({ text: fit(`${def.name} set ${have}/${def.pieces.length}`, iw), col: 0x8af06a });
      for (const b of def.bonuses) for (const l of wrapText(`${b.count}: ${b.text}`, iw - 4)) setLines.push({ text: ` ${l}`, col: have >= b.count ? 0xd8ffc0 : would >= b.count ? 0xb4f070 : 0x7a8a7a });
    }
    // fit it all above the buttons: fold the lost stats into one line, tighten the rows, drop the set's bonus
    // lines, then the "vs" line (the unique effect always shows in full)
    const bottom = this.buttons().equip.y - 2;
    const lostLine = lost.length ? wrapText(`Loses ${lost.map((x) => STAT_INFO[x].short).join(', ')}`, iw) : [];
    let foldLost = false;
    let pitch = 8;
    let setShown = setLines.length;
    let vsShown = true;
    const need = () =>
      9 + (vsShown ? 10 : 0) + 6 + (own.length + (foldLost ? lostLine.length : lost.length)) * pitch + (effect.length ? effect.length * pitch + 2 : 0) + (setShown ? setShown * pitch + 2 : 0);
    const avail = bottom - y + 2;
    if (need() > avail) foldLost = true;
    if (need() > avail) pitch = 7;
    if (need() > avail) setShown = Math.min(1, setShown);
    if (need() > avail) vsShown = false;

    // power, and what it's compared with
    const pw = itemPower(t, it);
    const dp = worn ? 0 : pw - (cur ? itemPower(t, cur) : 0);
    texts.text('Power', ix, y, 0xc8c0e8, { oy: 0.5 });
    texts.text(`${pw}`, ix + textWidth('Power', 1, false) + 3, y, WHITE, { bold: true, oy: 0.5 });
    if (!worn) {
      const txt = dp >= 0 ? `+${dp}` : `${dp}`;
      const col = dp > 0 ? GREEN : dp < 0 ? RED : DIM_TXT;
      texts.text(txt, ix + iw, y, col, { bold: true, ox: 1, oy: 0.5 });
      if (dp !== 0) arrow(g, ix + iw - textWidth(txt, 1, true) - 7, y - 2, dp > 0, col);
    } else {
      const r = { x: ix + iw - 27, y: y - 5, w: 27, h: 10 };
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]]);
      texts.text('Worn', r.x + r.w / 2, r.y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    }
    y += 9;
    if (vsShown) {
      const kindName = SLOT_NAME[slotOfItem(it)];
      const vs = worn ? 'Rowan wears this' : cur ? `vs ${itemName(cur)}` : kindName === 'Trinket' ? 'A trinket slot is free' : `${kindName} slot is empty`;
      texts.text(fit(vs, iw), ix, y, worn ? 0xffe680 : 0x9890b8, { oy: 0.5 });
      y += 10;
    } else y += 1;
    kit.divider(g, ix, y - 6, iw);

    // the stat rows: what this item gives, and the change vs what's worn (loud: bold green up, bold red down)
    const colV = ix + iw - 36;
    const row = (label: string, lc: number, val: string, vc: number, stat: StatId, d: number | null) => {
      if (y > bottom - 3) return;
      if (d !== null && Math.abs(d) > 1e-9) rows(g, colV + 2, y - 4, ix + iw - colV - 1, 8, 2, d > 0 ? 0x2a8a3a : 0x8a1a2a, 0.35);
      texts.text(label, ix, y, lc, { oy: 0.5 });
      texts.text(val, colV, y, vc, { ox: 1, oy: 0.5 });
      if (d !== null) this.delta(stat, d, ix + iw, y);
      y += pitch;
    };
    for (const l of own) row(STAT_INFO[l.stat].short, l.bonus ? 0x9ad8ff : 0xe8e0ff, compact(l.stat, l.value), l.bonus ? 0xc0e8ff : WHITE, l.stat, worn ? null : next[l.stat] - now0[l.stat]);
    if (!foldLost) for (const x of lost) row(STAT_INFO[x].short, 0x9890b8, '-', 0x9890b8, x, -now0[x]);
    else
      for (const l of lostLine) {
        texts.text(l, ix, y, RED, { oy: 0.5 });
        y += pitch;
      }
    if (effect.length) {
      y += 2;
      for (const l of effect) {
        if (y > bottom - 3) break;
        texts.text(l, ix, y, 0xffb060, { oy: 0.5 });
        y += pitch;
      }
    }
    if (setShown) {
      y += 2;
      for (const l of setLines.slice(0, setShown)) {
        if (y > bottom - 3) break;
        texts.text(l.text, ix, y, l.col, { oy: 0.5 });
        y += pitch;
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

  /** A compare delta at the row's right end: green "+x" up, red "-x" down, dim when it rounds to nothing. */
  private delta(stat: StatId, d: number, right: number, y: number): void {
    const txt = compact(stat, d);
    const zero = /^[+-]?0(\.0+)?(%|x)?$/.test(txt.replace(/^[+-]/, '')) || Math.abs(d) < 1e-9;
    const col = zero ? DIM_TXT : d > 0 ? GREEN : RED;
    this.kit.texts.text(zero ? '=' : txt, right, y, col, { bold: !zero, ox: 1, oy: 0.5 });
  }
}

/** A stat as the tight compare rows print it: like fmtStat, but "+.17x" for multipliers. */
export function compact(stat: StatId, v: number, signed = true): string {
  const s = fmtStat(stat, v, signed);
  return STAT_INFO[stat].unit === 'mult' ? s.replace(/^([+-]?)0\./, '$1.') : s;
}

/** A tiny up (green) or down (red) triangle, 5 x 3 inside an ink rim, top-left at (x, y). */
export function arrow(g: G, x: number, y: number, up: boolean, col: number): void {
  const w = up ? [1, 3, 5] : [5, 3, 1];
  g.fillStyle(INK, 1);
  w.forEach((n, i) => g.fillRect(x + (5 - n) / 2 - 1, y + i - 1, n + 2, 3));
  g.fillStyle(col, 1);
  w.forEach((n, i) => g.fillRect(x + (5 - n) / 2, y + i, n, 1));
}

