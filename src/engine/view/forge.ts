// The Forge (a camp screen), run by Mags the smith. On the left her workshop: Mags at 2x by the fire with the
// chosen item glowing over her anvil (tap "Change item" for the picker: the worn items first, then the bag, in the
// bag's grid). On the right three tabs:
//   Upgrade  +n -> +n+1 for scrap and coins (red when short), each base stat before -> after; her hammer comes down
//            twice in a spray of sparks, the item flashes and the new +n pops. +10 is the max.
//   Reroll   pick a bonus line, pay coins (the price doubles with each reroll on the item); the line spins through
//            stats like a slot machine and lands on its new roll.
//   Salvage  melt this item into scrap (a second tap confirms; never locked or worn items), or melt every unlocked,
//            unworn Common and Uncommon at once (the count and the scrap are shown first; a second tap confirms).
import type Phaser from 'phaser';
import { BASE_BY_ID, RARITY_INFO, STAT_IDS, STAT_INFO, type StatId } from '../../data/gear';
import { baseStats, bonusValue, fmtStat, itemPower, rerollCost, salvageValue, upgradeCost, type BonusRoll, type Item } from '../../core/gear';
import { equippedIn, isEquipped, itemByUid, reroll, salvage, salvageAll, upgrade } from '../../core/profile';
import { Rng } from '../../core/rng';
import { HEROES } from '../../data/heroes';
import { textWidth } from '../font';
import { CampKit, D, GOLD_TXT, GREEN, pix, pixSize, RED, SCRAP_TXT, statChanges } from './camp-kit';
import { ItemGrid, WornRow } from './item-grid';
import { cellGlow, cellIcon, cellMarks, cellShine, fit, itemCell, rarityFace, rarityText, wrapText } from './items';
import { button3d, chevron, glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;
type Tab = 'upgrade' | 'reroll' | 'salvage';
const TABS: Tab[] = ['upgrade', 'reroll', 'salvage'];
const TAB_LABEL: Record<Tab, string> = { upgrade: 'Upgrade', reroll: 'Reroll', salvage: 'Salvage' };

/** The hammer's swing: frames (smith_hammer0..2) over time, and when it hits the anvil (ms after the swing starts). */
const SWING = [
  { until: 90, f: 0 },
  { until: 150, f: 1 },
  { until: 230, f: 2 },
  { until: 290, f: 0 },
  { until: 350, f: 1 },
  { until: 470, f: 2 },
];
const HIT1 = 150;
const HIT2 = 350;

export class ForgeScreen {
  anvil = 0; // uid on the anvil
  tab: Tab = 'upgrade';
  private picking = false;
  private pickAt = 0;
  private openAt = 0;
  private tabAt = 0;
  private line = -1; // the bonus line picked for a reroll
  private swingAt = -1e9;
  private upAt = -1e9; // the last upgrade landed
  private shortAt = -1e9; // an upgrade was refused for want of scrap or coins
  private reveal: { uid: number; plus: number; until: number } | null = null;
  private spin: { uid: number; line: number; at: number; from: BonusRoll } | null = null;
  private armed: { what: 'one' | 'all'; until: number } | null = null;
  private shakes = new Map<string, number>();
  private idleTapAt = 0;
  private readonly rng = new Rng((Date.now() >>> 0) ^ 0x5eed);
  private readonly grid = new ItemGrid();
  private readonly worn = new WornRow();

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    const p = this.kit.profile;
    this.openAt = now;
    this.tabAt = now;
    this.picking = false;
    this.armed = null;
    this.spin = null;
    this.reveal = null;
    this.line = -1;
    if (!itemByUid(p, this.anvil)) this.anvil = (equippedIn(p, 'weapon') ?? p.items.find((i) => isEquipped(p, i.uid)) ?? p.items[0])?.uid ?? 0;
    this.idleTapAt = now + 1800;
  }

  // ------------------------------------------------------------------ layout

  private stage(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 20, w: 116, h: s.B - 23 };
  }

  private right(): Rect {
    const s = this.kit.s;
    const st = this.stage();
    const x = st.x + st.w + 5;
    return { x, y: 20, w: s.R - 3 - x, h: s.B - 23 };
  }

  private tabRect(i: number): Rect {
    const r = this.right();
    const w = Math.floor((r.w - 4) / 3);
    return { x: r.x + i * (w + 2), y: r.y, w, h: 14 };
  }

  private content(): Rect {
    const r = this.right();
    return { x: r.x, y: r.y + 18, w: r.w, h: r.h - 18 };
  }

  private changeRect(): Rect {
    const st = this.stage();
    return { x: st.x + 8, y: st.y + st.h - 18, w: st.w - 16, h: 14 };
  }

  private anvilCell(now: number): Rect {
    const st = this.stage();
    const bob = Math.round(Math.sin(now / 420) * 1.5);
    return { x: st.x + 70, y: st.y + 30 + bob, w: 26, h: 26 };
  }

  /** The main button at the bottom of the content panel. */
  private mainRect(): Rect {
    const c = this.content();
    return { x: c.x + 8, y: c.y + c.h - 20, w: c.w - 16, h: 16 };
  }

  private salvageOneRect(): Rect {
    const c = this.content();
    return { x: c.x + 8, y: c.y + 23, w: c.w - 16, h: 15 };
  }

  private lineRect(i: number): Rect {
    const c = this.content();
    return { x: c.x + 6, y: c.y + 15 + i * 13, w: c.w - 12, h: 12 };
  }

  private picker(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: 161, h: s.B - 22 };
  }

  private layoutPicker(): void {
    const pr = this.picker();
    this.worn.layout(pr.x + 9, pr.y + 9);
    this.grid.layout(pr.x + 6, pr.y + 31, 10, 6);
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const app = kit.app;
    const p = kit.profile;
    if (this.picking) return this.tapPicker(x, y, now);
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (let i = 0; i < TABS.length; i++)
      if (inRect(this.tabRect(i), x, y, 2)) {
        if (this.tab !== TABS[i]) {
          this.tab = TABS[i];
          this.tabAt = now;
          this.armed = null;
          app.audio.uiClick();
        }
        notePress(this.tabRect(i));
        return;
      }
    const st = this.stage();
    if (inRect(this.changeRect(), x, y, 2) || (inRect(st, x, y) && y < this.changeRect().y)) {
      notePress(this.changeRect());
      this.openPicker(now);
      return;
    }
    const it = itemByUid(p, this.anvil);
    if (this.tab === 'upgrade' && it && inRect(this.mainRect(), x, y, 2)) return this.doUpgrade(it, now);
    if (this.tab === 'reroll' && it) {
      for (let i = 0; i < it.bonus.length; i++)
        if (inRect(this.lineRect(i), x, y, 1)) {
          if (this.spin && now - this.spin.at < 700) return;
          this.line = i;
          notePress(this.lineRect(i));
          app.audio.uiClick();
          return;
        }
      if (inRect(this.mainRect(), x, y, 2)) return this.doReroll(it, now);
    }
    if (this.tab === 'salvage') {
      if (it && inRect(this.salvageOneRect(), x, y, 2)) return this.doSalvage(it, now);
      if (inRect(this.mainRect(), x, y, 2)) return this.doSalvageAll(now);
    }
  }

  private openPicker(now: number): void {
    this.picking = true;
    this.pickAt = now;
    this.kit.toastNow = null; // the popup shares the toast's layer
    this.layoutPicker();
    this.grid.refresh(this.kit.profile, this.kit.tuning, 'rarity', true, true);
    this.grid.page = 0;
    this.kit.app.audio.panelOpen();
  }

  private tapPicker(x: number, y: number, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    this.layoutPicker();
    const k = this.worn.at(x, y);
    const pick = (uid: number) => {
      this.anvil = uid;
      this.picking = false;
      this.line = -1;
      this.armed = null;
      this.spin = null;
      this.reveal = null;
      kit.app.audio.forgeHammer();
      const c = this.anvilCell(now);
      kit.fx.sparks(c.x + c.w / 2, c.y + c.h, 10);
      kit.fx.flash(c, WHITE, 300);
    };
    if (k) {
      const it = equippedIn(p, k);
      if (it) return pick(it.uid);
      return;
    }
    const hit = this.grid.hit(p, x, y);
    if (hit?.item) return pick(hit.item.uid);
    if (hit) return;
    if (!inRect(this.picker(), x, y)) {
      this.picking = false;
      kit.app.audio.panelClose();
    }
  }

  private shake(key: string, now: number, msg: string, col = RED): void {
    this.shakes.set(key, now);
    this.kit.app.audio.uiClick();
    const r = this.mainRect();
    this.kit.fx.float(msg, r.x + r.w / 2, r.y - 8, col, { life: 1300 });
  }

  /** Mags swings her hammer (two blows; the callers play the sounds). */
  private swing(now: number): void {
    this.swingAt = now;
  }

  private anvilHit(big: boolean): void {
    const kit = this.kit;
    const now = performance.now();
    const c = this.anvilCell(now);
    kit.fx.sparks(c.x + c.w / 2, c.y + c.h + 4, big ? 26 : 12, 0.3);
    kit.fx.ring(c.x + c.w / 2, c.y + c.h + 4, big ? 18 : 10, 0xffd23a, 300);
  }

  private doUpgrade(it: Item, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const cost = upgradeCost(t, it);
    notePress(this.mainRect());
    if (!cost) {
      this.shakes.set('main', now);
      kit.app.audio.uiClick();
      return;
    }
    if (p.scrap < cost.scrap || p.coins < cost.coins) {
      this.shakes.set('main', now); // the red "Need ..." line is already on the panel: it flashes
      this.shortAt = now;
      kit.app.audio.uiClick();
      return;
    }
    const old = it.plus;
    const before = baseStats(t, it);
    const heroBefore = kit.stats();
    const worn = isEquipped(p, it.uid);
    if (upgrade(p, t, it.uid) !== 'ok') return;
    kit.commit();
    const heroAfter = kit.stats();
    this.reveal = { uid: it.uid, plus: old, until: now + HIT2 };
    this.swing(now);
    this.spend(cost.scrap, cost.coins);
    kit.after(HIT1, () => {
      kit.app.audio.forgeHammer();
      this.anvilHit(false);
    });
    kit.after(HIT2, () => {
      const n = performance.now();
      kit.app.audio.forgeHammer();
      kit.app.audio.forgeUpgrade();
      this.anvilHit(true);
      this.upAt = n;
      const c = this.anvilCell(n);
      kit.fx.flash(c, WHITE, 420);
      kit.fx.burst(c.x + c.w / 2, c.y + c.h / 2, [0xfff0a0, 0xffd23a, WHITE], 18, 1.2, { kind: 'star', g: 30, life: 600 });
      kit.fx.float(`+${it.plus}!`, c.x + c.w / 2, c.y - 6, 0xffe066, { scale: 2, life: 1300, rise: 10 });
      // what changed, before -> after: the hero's stats if it's worn, else the item's own
      const after = baseStats(t, it);
      const mine = after.map((l, i) => ({ label: STAT_INFO[l.stat].short, stat: l.stat, from: fine(l.stat, before[i]?.value ?? 0), to: fine(l.stat, l.value), good: true }));
      const his = worn ? statChanges(heroBefore, heroAfter, STAT_IDS) : [];
      kit.toast({
        title: it.plus >= 10 ? 'Maxed out: +10!' : `Upgraded to +${it.plus}!`,
        ribbon: RIBBON.gold,
        lines: his.length ? his : mine,
        note: his.length ? `${HEROES[p.hero].name}'s stats` : worn ? undefined : 'Equip it to use it',
        ...this.toastAt(),
      });
    });
  }

  /** Where the forge's toasts pop up: over the lower half of the workshop (the actions stay in view). */
  private toastAt(): { cx: number; cy: number } {
    const st = this.stage();
    return { cx: st.x + st.w / 2, cy: st.y + 96 };
  }

  /** The price leaves the purse: red "-n" numbers drop from the counters. */
  private spend(scrap: number, coins: number): void {
    const kit = this.kit;
    const tags = kit.purseRects(kit.s.R - 3, 3);
    if (scrap) kit.fx.float(`-${scrap}`, tags.scrap.x + tags.scrap.w / 2, tags.scrap.y + 17, RED, { icon: 'scrap', life: 1000, rise: -8 });
    if (coins) kit.fx.float(`-${coins}`, tags.coins.x + tags.coins.w / 2, tags.coins.y + 17, RED, { icon: 'coin', life: 1000, rise: -8 });
  }

  private doReroll(it: Item, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    notePress(this.mainRect());
    if (!it.bonus.length) return this.shake('main', now, 'No bonus stats to reroll');
    if (this.line < 0 || !it.bonus[this.line]) return this.shake('main', now, 'Tap a line to pick it first', GOLD_TXT);
    if (this.spin && now - this.spin.at < 700) return;
    const cost = rerollCost(t, it);
    if (p.coins < cost) return this.shake('main', now, `Need ${cost - p.coins} more coins`);
    const from = { ...it.bonus[this.line] };
    if (reroll(p, t, it.uid, this.line, this.rng) !== 'ok') return this.shake('main', now, 'No other stat to roll');
    kit.commit();
    this.spin = { uid: it.uid, line: this.line, at: now, from };
    this.spend(0, cost);
    kit.app.audio.coin();
    for (let i = 1; i <= 6; i++) kit.after(i * 85, () => kit.app.audio.uiClick());
    const line = this.line;
    kit.after(620, () => {
      kit.app.audio.reroll();
      const r = this.lineRect(line);
      kit.fx.flash(r, WHITE, 380);
      kit.fx.burst(r.x + r.w - 20, r.y + r.h / 2, [0x9ad8ff, WHITE, 0xfff0a0], 14, 0.9, { kind: 'star', g: 20, life: 520 });
      const nb = it.bonus[line];
      if (!nb) return;
      const was = `${fmtStat(from.stat, bonusValue(t, it, from))} ${STAT_INFO[from.stat].short}`;
      const is = `${fmtStat(nb.stat, bonusValue(t, it, nb))} ${STAT_INFO[nb.stat].short}`;
      kit.toast({
        title: 'Rerolled!',
        ribbon: RIBBON.blue,
        lines: [],
        text: [
          { text: `Was ${was}`, col: 0xa8a0c8 },
          { text: `Now ${is}`, col: 0x9ad8ff, bold: true },
        ],
        ...this.toastAt(),
      });
    });
  }

  private doSalvage(it: Item, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    notePress(this.salvageOneRect());
    if (isEquipped(p, it.uid)) return this.shakeAt('one', now, 'Worn: unequip it first', this.salvageOneRect());
    if (it.locked) return this.shakeAt('one', now, 'Locked: unlock it first', this.salvageOneRect());
    if (!this.armed || this.armed.what !== 'one' || now > this.armed.until) {
      this.armed = { what: 'one', until: now + 2600 };
      kit.app.audio.uiClick();
      return;
    }
    this.armed = null;
    const c = this.anvilCell(now);
    const v = salvage(p, t, it.uid);
    if (!v) return;
    kit.commit();
    this.anvil = 0;
    this.swing(now);
    kit.after(HIT1, () => {
      kit.app.audio.salvage();
      this.melt(c, rarityFace(it.rarity), v, 1);
    });
    kit.after(450, () => kit.toast({ title: 'Melted!', ribbon: RIBBON.red, lines: [{ label: 'Scrap', from: `${p.scrap - v}`, to: `${p.scrap}`, good: true }], ...this.toastAt() }));
  }

  private shakeAt(key: string, now: number, msg: string, r: Rect): void {
    this.shakes.set(key, now);
    this.kit.app.audio.uiClick();
    this.kit.fx.float(msg, r.x + r.w / 2, r.y - 7, RED, { life: 1500 });
  }

  /** An item (or a heap of them) melts: chips burst from the anvil and fly into the scrap counter. */
  private melt(c: Rect, face: readonly number[], scrap: number, items: number): void {
    const kit = this.kit;
    kit.fx.burst(c.x + c.w / 2, c.y + c.h / 2, [face[0], face[1], face[2], 0xff9a2a, 0xfff0a0], 26, 1.3, { kind: 'chip', g: 160, life: 700 });
    kit.fx.ring(c.x + c.w / 2, c.y + c.h / 2, 22, 0xff9a2a, 380);
    const tags = kit.purseRects(kit.s.R - 3, 3);
    const n = Math.min(18, 4 + items * 2);
    for (let i = 0; i < n; i++)
      kit.fx.fly({
        color: i % 2 ? 0xb8c2d8 : 0xffd23a,
        x0: c.x + c.w / 2 + rand(-8, 8),
        y0: c.y + c.h / 2 + rand(-6, 6),
        x1: tags.scrap.x + 6,
        y1: tags.scrap.y + 6,
        arc: rand(10, 30),
        life: 420 + i * 25,
        delay: 80 + i * 20,
        done: i === n - 1 ? () => kit.app.audio.coin() : undefined,
      });
    kit.fx.float(`+${scrap}`, tags.scrap.x + tags.scrap.w / 2, tags.scrap.y + 17, GREEN, { icon: 'scrap', life: 1400, delay: 500, rise: -8 });
  }

  /** The unlocked, unworn Common and Uncommon items (what "Salvage all" would melt), and their scrap. */
  private junk(): { count: number; scrap: number } {
    const p = this.kit.profile;
    const t = this.kit.tuning;
    const list = p.items.filter((i) => (i.rarity === 'common' || i.rarity === 'uncommon') && !i.locked && !isEquipped(p, i.uid));
    return { count: list.length, scrap: list.reduce((a, i) => a + salvageValue(t, i), 0) };
  }

  private doSalvageAll(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    notePress(this.mainRect());
    const j = this.junk();
    if (!j.count) return this.shake('main', now, 'Nothing to salvage', 0xd8d0f0);
    if (!this.armed || this.armed.what !== 'all' || now > this.armed.until) {
      this.armed = { what: 'all', until: now + 2800 };
      kit.app.audio.uiClick();
      return;
    }
    this.armed = null;
    const onAnvil = itemByUid(p, this.anvil);
    const r = salvageAll(p, kit.tuning);
    kit.commit();
    if (onAnvil && !itemByUid(p, onAnvil.uid)) this.anvil = 0;
    this.swing(now);
    kit.after(HIT1, () => {
      kit.app.audio.salvage();
      this.melt(this.anvilCell(performance.now()), [0x9aa0b4, 0x5ad848, 0x6e7488, 0x3aaa34], r.scrap, r.count);
    });
    kit.after(HIT2, () => kit.app.audio.salvage());
    kit.after(450, () =>
      kit.toast({
        title: 'Salvaged!',
        ribbon: RIBBON.red,
        lines: [
          { label: 'Items', from: `${r.count + p.items.length}`, to: `${p.items.length}`, good: null },
          { label: 'Scrap', from: `${p.scrap - r.scrap}`, to: `${p.scrap}`, good: true },
        ],
        ...this.toastAt(),
      }),
    );
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const p = kit.profile;
    if (this.anvil && !itemByUid(p, this.anvil)) this.anvil = 0;
    const it = itemByUid(p, this.anvil);
    kit.drawBack(g, now);
    kit.title(g, 'Forge', kit.backRect().x + kit.backRect().w + 4, 4, RIBBON.red);
    kit.purse(g, kit.texts, kit.s.R - 3, 3, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    this.drawStage(g, it, now, k);
    this.drawTabs(g, now, k);
    const c = this.content();
    const ck = { ...c, x: c.x + Math.round((1 - k) * 30) };
    kit.pane(g, ck, { alpha: clamp01(k * 2) });
    const tk = clamp01((now - this.tabAt) / 140);
    if (k >= 0.9 && tk > 0.3) {
      if (!it && this.tab !== 'salvage') this.drawEmpty(c, now);
      else if (this.tab === 'upgrade' && it) this.drawUpgrade(g, it, c, now);
      else if (this.tab === 'reroll' && it) this.drawReroll(g, it, c, now);
      else this.drawSalvage(g, it, c, now);
    }
    if (this.picking) this.drawPicker(now);
  }

  private shownPlus(it: Item, now: number): number {
    return this.reveal && this.reveal.uid === it.uid && now < this.reveal.until ? this.reveal.plus : it.plus;
  }

  /** Mags's workshop: the fire's glow, Mags at 2x, the item over the anvil, its name, "Change item". */
  private drawStage(g: G, it: Item | undefined, now: number, k: number): void {
    const kit = this.kit;
    const st0 = this.stage();
    const st = { ...st0, x: st0.x - Math.round((1 - k) * 30) };
    kit.pane(g, st, { warm: true, alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    // the forge fire behind her: a warm pulsing glow and embers
    const fx0 = st.x + 22;
    const fy0 = st.y + 30;
    for (const [r, a] of [
      [34, 0.07],
      [24, 0.09],
      [15, 0.12],
    ] as const) {
      g.fillStyle(0xff8a2a, a + 0.03 * Math.sin(now / 110 + r));
      g.fillCircle(fx0, fy0, r + Math.sin(now / 90 + r) * 1.2);
    }
    if (Math.random() < 0.25) kit.fx.parts.push({ x: fx0 + rand(-10, 10), y: fy0 + rand(-4, 8), vx: rand(-6, 6), vy: rand(-26, -14), g: 0, drag: 0.4, born: now, life: rand(600, 1100), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, kind: 'px' });
    // the floor
    const floorY = st.y + 76;
    g.fillStyle(0x2a1818, 1);
    g.fillRect(st.x + 2, floorY, st.w - 4, 3);
    g.fillStyle(0x5a3a2a, 1);
    g.fillRect(st.x + 2, floorY, st.w - 4, 1);
    // the anvil
    const ax = st.x + 83;
    rows(g, ax - 15, floorY - 14, 30, 6, 2, INK);
    rows(g, ax - 14, floorY - 13, 28, 4, 1, 0x7c86a6);
    g.fillStyle(0xb8c2d8, 1);
    g.fillRect(ax - 12, floorY - 13, 22, 1);
    g.fillStyle(INK, 1);
    g.fillRect(ax - 6, floorY - 9, 12, 6);
    g.fillRect(ax - 9, floorY - 4, 18, 4);
    g.fillStyle(0x4a5272, 1);
    g.fillRect(ax - 5, floorY - 9, 10, 5);
    g.fillRect(ax - 8, floorY - 3, 16, 3);
    g.fillStyle(0x7c86a6, 1);
    g.fillRect(ax - 5, floorY - 9, 2, 5);
    // a hot glow on the anvil's face after a blow
    const sinceUp = now - this.upAt;
    if (sinceUp < 600) {
      g.fillStyle(0xff9a2a, 0.8 * (1 - sinceUp / 600));
      g.fillRect(ax - 12, floorY - 13, 24, 2);
    }
    // Mags at 2x: idle, or her hammer swing
    const sw = now - this.swingAt;
    let frame = Math.floor(now / 520) % 2 ? 'smith_idle1' : 'smith_idle0';
    if (sw >= 0 && sw < SWING[SWING.length - 1].until) frame = `smith_hammer${SWING.find((q) => sw < q.until)!.f}`;
    else if (now > this.idleTapAt) {
      // now and then she taps the work lightly
      this.idleTapAt = now + 3800 + Math.random() * 2400;
      this.swing(now);
      kit.after(HIT1, () => this.anvilHit(false));
    }
    const [w, h] = kit.imgs.size(frame);
    const mx = st.x + 34;
    kit.imgs.scaled(frame, Math.round(mx - w), floorY - h * 2, D.icons, 2);
    // the item over the anvil (or an empty slot waiting for one)
    const c = this.anvilCell(now);
    if (it) {
      const plus = this.shownPlus(it, now);
      glow(g, c, rarityFace(it.rarity)[1], 0.35 + 0.25 * pulse(now, 1000), 4);
      cellGlow(g, c, it.rarity, now);
      itemCell(g, c, it.rarity);
      cellIcon(kit.imgs, it, c, D.icons, 2);
      cellShine(kit.gOver, c, it.rarity, now);
      cellMarks(kit.gOver, c, { locked: it.locked, equipped: isEquipped(kit.profile, it.uid) }, now);
      if (plus > 0) {
        const txt = `+${plus}`;
        const pop = now - this.upAt < 300 ? -2 : 0;
        const tw = textWidth(txt, 1, true) + 4;
        const r = { x: c.x + c.w - tw + 4, y: c.y - 5 + pop, w: tw, h: 10 };
        tag(kit.gOver, r, plus >= 10 ? [0xffffff, 0xfff0a0, GOLD[3], GOLD[1]] : [GOLD[4], GOLD[3], GOLD[2], GOLD[0]]);
        kit.texts.text(txt, r.x + 2, r.y + 5, plus >= 10 ? 0x7a3a0a : WHITE, { bold: true, oy: 0.5, plain: plus >= 10 });
      }
      // name and kind under the scene
      const lines = wrapText(BASE_BY_ID[it.base]?.name ?? 'Item', st.w - 10, true).slice(0, 2);
      let y = floorY + 9;
      for (const l of lines) {
        kit.texts.text(l, st.x + st.w / 2, y, rarityText(it.rarity), { bold: true, ox: 0.5, oy: 0.5 });
        y += 9;
      }
      kit.texts.text(`Lv ${it.ilvl} ${RARITY_INFO[it.rarity].name}`, st.x + st.w / 2, y, 0xd8c8b0, { ox: 0.5, oy: 0.5 });
    } else {
      rows(g, c.x - 1, c.y - 1, c.w + 2, c.h + 2, 3, INK);
      rows(g, c.x, c.y, c.w, c.h, 2, 0x2a1a1e);
      g.fillStyle(GOLD[2], 0.5 + 0.5 * pulse(now, 900));
      for (let d = 2; d < c.w - 2; d += 4) {
        g.fillRect(c.x + d, c.y, 2, 1);
        g.fillRect(c.x + d, c.y + c.h - 1, 2, 1);
        g.fillRect(c.x, c.y + d, 1, 2);
        g.fillRect(c.x + c.w - 1, c.y + d, 1, 2);
      }
      kit.texts.text('?', c.x + c.w / 2, c.y + c.h / 2, GOLD[3], { bold: true, scale: 2, ox: 0.5, oy: 0.5 });
      kit.texts.text('The anvil is empty', st.x + st.w / 2, floorY + 10, 0xd8c8b0, { ox: 0.5, oy: 0.5 });
    }
    const cr = this.changeRect();
    kit.button(g, kit.texts, cr, it ? 'Change item' : 'Pick an item', it ? FACE.wood : FACE.gold, now, { icon: 'swap', glowCol: it ? undefined : 0xffd23a });
  }

  private drawTabs(g: G, now: number, k: number): void {
    const kit = this.kit;
    TABS.forEach((tb, i) => {
      const r0 = this.tabRect(i);
      const r = { ...r0, y: r0.y - Math.round((1 - k) * 12) };
      const on = this.tab === tb;
      if (on) glow(g, r, 0xffd23a, 0.25, 2);
      button3d(g, r, on ? FACE.gold : FACE.navy, isPressed(r0, now) || on);
      kit.texts.text(TAB_LABEL[tb], r.x + r.w / 2, r.y + r.h / 2 + (isPressed(r0, now) || on ? 2 : 0), on ? WHITE : 0xc8c0e8, { bold: true, ox: 0.5, oy: 0.5 });
    });
  }

  private drawEmpty(c: Rect, now: number): void {
    const t = this.kit.texts;
    t.text('Put an item on the anvil:', c.x + c.w / 2, c.y + 30, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    t.text('tap "Pick an item".', c.x + c.w / 2, c.y + 42, 0xfff07a, { ox: 0.5, oy: 0.5, alpha: 0.6 + 0.4 * pulse(now, 1000) });
  }

  private costRow(g: G, x: number, y: number, scrap: number, coins: number): number {
    const kit = this.kit;
    const p = kit.profile;
    let cx = x;
    const piece = (icon: string, n: number, have: number, col: number) => {
      const [iw, ih] = pixSize(icon);
      pix(g, icon, cx, Math.round(y - ih / 2));
      cx += iw + 2;
      const short = have < n;
      kit.texts.text(`${n}`, cx, y, short ? RED : col, { bold: true, oy: 0.5 });
      cx += textWidth(`${n}`, 1, true) + 7;
    };
    if (scrap > 0) piece('scrap', scrap, p.scrap, SCRAP_TXT);
    if (coins > 0) piece('coin', coins, p.coins, GOLD_TXT);
    return cx;
  }

  private drawUpgrade(g: G, it: Item, c: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const plus = this.shownPlus(it, now);
    const shown: Item = { ...it, plus };
    const cost = upgradeCost(t, shown);
    const max = !cost;
    const cx = c.x + c.w / 2;
    const ix = c.x + 7;
    const iw = c.w - 14;
    // +n -> +n+1, big
    const hot = clamp01(1 - (now - this.upAt) / 700);
    if (max) {
      const a = `+${plus}`;
      const wa = textWidth(a, 2, true);
      const x0 = Math.round(cx - (wa + 30) / 2);
      texts.text(a, x0, c.y + 13, 0xffe066, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
      const r = { x: x0 + wa + 4, y: c.y + 8, w: 26, h: 11 };
      tag(g, r, [0xffffff, 0xfff0a0, GOLD[3], GOLD[1]]);
      texts.text('MAX', r.x + r.w / 2, r.y + 5.5, 0x7a3a0a, { bold: true, ox: 0.5, oy: 0.5, plain: true });
    } else {
      const a = `+${plus}`;
      const b = `+${plus + 1}`;
      const wa = textWidth(a, 2, true);
      const wb = textWidth(b, 2, true);
      const x0 = Math.round(cx - (wa + 16 + wb) / 2);
      texts.text(a, x0, c.y + 13, hot > 0 ? mix(0xffe066, 0xb0a8c8, 1 - hot) : 0xb0a8c8, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: NAVY[1] });
      const k2 = (now / 500) % 1;
      chevron(g, x0 + wa + 4 + Math.round(k2 * 2), c.y + 9, 9, GOLD[3], 1, 1, true);
      texts.text(b, x0 + wa + 16, c.y + 13, 0xffe066, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
    }
    // each base stat: now -> after the upgrade
    let y = c.y + 30;
    const nowS = baseStats(t, it, plus);
    const next = max ? nowS : baseStats(t, it, plus + 1);
    nowS.forEach((l, i) => {
      const nv = next[i]?.value ?? l.value;
      texts.text(STAT_INFO[l.stat].name, ix, y, 0xe8e0ff, { oy: 0.5 });
      const a = fine(l.stat, l.value);
      const b = fine(l.stat, nv);
      if (max) texts.text(a, ix + iw, y, WHITE, { bold: true, ox: 1, oy: 0.5 });
      else {
        const wb = textWidth(b, 1, true);
        texts.text(b, ix + iw, y, GREEN, { bold: true, ox: 1, oy: 0.5 });
        chevron(g, ix + iw - wb - 7, y - 3, 7, GREEN, 1, 1, true);
        texts.text(a, ix + iw - wb - 10, y, 0xc8c0e8, { bold: true, ox: 1, oy: 0.5 });
      }
      if (hot > 0) rows(g, ix - 2, y - 5, iw + 4, 10, 2, 0x8af06a, 0.35 * hot);
      y += 10;
    });
    const pa = itemPower(t, shown);
    const pb = max ? pa : itemPower(t, { ...it, plus: plus + 1 });
    texts.text('Power', ix, y, 0xc8c0e8, { oy: 0.5 });
    texts.text(max ? `${pa}` : `${pa} > ${pb}`, ix + iw, y, max ? WHITE : 0xd8ffc0, { bold: true, ox: 1, oy: 0.5 });
    y += 9;
    kit.divider(g, ix, y, iw);
    y += 8;
    const b = this.mainRect();
    if (max) {
      texts.text('Mags can do no more.', cx, y + 2, 0xfff0c0, { ox: 0.5, oy: 0.5 });
      kit.button(g, texts, b, 'Max level', FACE.gold, now, { disabled: true, shakeAt: this.shakes.get('main') });
      return;
    }
    // the cost, red where you're short
    texts.text('Cost', ix, y, 0xc8c0e8, { oy: 0.5 });
    this.costRow(g, ix + 24, y, cost.scrap, cost.coins);
    y += 10;
    const short = p.scrap < cost.scrap ? `Need ${cost.scrap - p.scrap} more scrap` : p.coins < cost.coins ? `Need ${cost.coins - p.coins} more coins` : '';
    if (short) {
      // a refused tap makes it flash and jump
      const sk = clamp01(1 - (now - this.shortAt) / 450);
      texts.text(short, ix + Math.round(Math.sin(sk * 18) * 2 * sk), y, sk > 0 ? mix(RED, WHITE, sk * 0.6) : RED, { oy: 0.5 });
      if (p.scrap < cost.scrap && y + 12 < this.mainRect().y) texts.text('Salvage junk for scrap!', ix, y + 8, 0xffb0a0, { oy: 0.5, alpha: 0.5 + 0.5 * pulse(now, 1100) });
    }
    const ok = !short;
    kit.button(g, texts, b, `Upgrade to +${plus + 1}`, FACE.green, now, { icon: 'hammer', disabled: !ok, glowCol: ok ? 0x8af06a : undefined, shakeAt: this.shakes.get('main') });
  }

  private drawReroll(g: G, it: Item, c: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const ix = c.x + 7;
    const iw = c.w - 14;
    if (!it.bonus.length) {
      let y = c.y + 22;
      for (const l of wrapText('This item has no bonus stats to reroll. Uncommon and better items have them.', iw)) {
        texts.text(l, ix, y, 0xd8d0f0, { oy: 0.5 });
        y += 9;
      }
      kit.button(g, texts, this.mainRect(), 'Reroll', FACE.blue, now, { disabled: true, icon: 'dice', shakeAt: this.shakes.get('main') });
      return;
    }
    texts.text(this.line < 0 ? 'Tap a line to reroll it' : 'This line gets a new stat:', ix, c.y + 8, this.line < 0 ? 0xfff07a : 0xd8d0f0, { oy: 0.5, alpha: this.line < 0 ? 0.8 + 0.2 * pulse(now, 900) : 1 });
    it.bonus.forEach((roll, i) => {
      const r0 = this.lineRect(i);
      const on = i === this.line;
      const r = { ...r0, x: r0.x + (isPressed(r0, now) ? 1 : 0) };
      rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, INK);
      rows(g, r.x, r.y, r.w, r.h, 2, on ? 0x3a3070 : NAVY[2]);
      if (on) {
        rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, mix(GOLD[3], WHITE, pulse(now, 700)), 0.9);
        rows(g, r.x, r.y, r.w, r.h, 2, 0x3a3070);
        chevron(g, r.x + 3, r.y + 3, 7, GOLD[3], 1, 1, true);
      }
      const sp = this.spin && this.spin.uid === it.uid && this.spin.line === i ? now - this.spin.at : -1;
      let stat: StatId = roll.stat;
      let val = bonusValue(t, it, roll);
      let col = 0x9ad8ff;
      if (sp >= 0 && sp < 620) {
        // the slot machine: random stats flicker past, slowing down
        const step = Math.floor(Math.pow(sp / 620, 0.6) * 12);
        stat = STAT_IDS[(step * 7 + i * 3) % STAT_IDS.length];
        val = bonusValue(t, it, { stat, q: ((step * 37) % 100) / 100 });
        col = mix(0xfff0a0, WHITE, step % 2);
        g.fillStyle(WHITE, 0.12);
        g.fillRect(r.x + 1, r.y + 1 + (step % 3) * 3, r.w - 2, 2);
      }
      texts.text(STAT_INFO[stat].name, r.x + 12, r.y + r.h / 2, on ? WHITE : 0xd8d0f0, { oy: 0.5 });
      texts.text(fmtStat(stat, val), r.x + r.w - 4, r.y + r.h / 2, col, { bold: true, ox: 1, oy: 0.5 });
      if (sp >= 620 && sp < 1100) rows(g, r.x, r.y, r.w, r.h, 2, WHITE, 0.5 * (1 - (sp - 620) / 480));
    });
    const cost = rerollCost(t, it);
    const y = this.mainRect().y - 8;
    texts.text('Cost', ix, y, 0xc8c0e8, { oy: 0.5 });
    const ex = this.costRow(g, ix + 24, y, 0, cost);
    texts.text('(x2 each time)', ex - 3, y, 0x8a84a8, { oy: 0.5 });
    const ok = this.line >= 0 && p.coins >= cost;
    kit.button(g, texts, this.mainRect(), 'Reroll', FACE.blue, now, { icon: 'dice', disabled: !ok, glowCol: ok ? 0x9ad8ff : undefined, shakeAt: this.shakes.get('main') });
  }

  private drawSalvage(g: G, it: Item | undefined, c: Rect, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const t = kit.tuning;
    const texts = kit.texts;
    const ix = c.x + 7;
    const iw = c.w - 14;
    // this item
    const one = this.salvageOneRect();
    if (it) {
      const v = salvageValue(t, it);
      const worn = isEquipped(p, it.uid);
      const why = worn ? 'Worn: unequip it first' : it.locked ? 'Locked: unlock it first' : '';
      texts.text(why ? fit(why, iw) : 'Melt this item into scrap:', ix, c.y + 7, why ? 0xffb0a0 : 0xd8d0f0, { oy: 0.5 });
      pix(g, 'scrap', ix, c.y + 12);
      texts.text(`+${v} scrap`, ix + 10, c.y + 16, why ? 0x9890b8 : GREEN, { bold: true, oy: 0.5 });
      const armed = this.armed?.what === 'one' && now < this.armed.until;
      kit.button(g, texts, one, armed ? 'Tap again to melt it!' : 'Salvage', FACE.red, now, { icon: armed ? undefined : 'flame', disabled: !!why, glowCol: armed ? 0xff5a48 : undefined, shakeAt: this.shakes.get('one') });
    } else texts.text('No item on the anvil.', ix, c.y + 12, 0x9890b8, { oy: 0.5 });
    kit.divider(g, ix, one.y + one.h + 5, iw);
    // salvage all Common and Uncommon: how many, and the scrap they'd make
    const j = this.junk();
    let y = one.y + one.h + 14;
    const title = 'All Common & Uncommon';
    texts.text(textWidth(title, 1, true) <= iw ? title : 'All Common/Uncommon', ix, y, WHITE, { bold: true, oy: 0.5 });
    y += 10;
    if (j.count) {
      texts.text(`${j.count} item${j.count > 1 ? 's' : ''}`, ix, y, 0xd8d0f0, { oy: 0.5 });
      const sw = textWidth(`+${j.scrap}`, 1, true);
      pix(g, 'scrap', ix + iw - sw - 11, y - 4);
      texts.text(`+${j.scrap}`, ix + iw, y, GREEN, { bold: true, ox: 1, oy: 0.5 });
      y += 8;
      const skips = 'Skips locked & worn items';
      texts.text(textWidth(skips) <= iw ? skips : 'Skips locked & worn', ix, y, 0xa49ec0, { oy: 0.5 });
    } else texts.text('Nothing to salvage', ix, y, 0x9890b8, { oy: 0.5 });
    const armed = this.armed?.what === 'all' && now < this.armed.until;
    kit.button(g, texts, this.mainRect(), armed ? `Melt ${j.count}? Tap again!` : 'Salvage all', FACE.red, now, {
      icon: armed ? undefined : 'flame',
      disabled: !j.count,
      glowCol: armed ? 0xff5a48 : undefined,
      shakeAt: this.shakes.get('main'),
    });
  }

  /** The item picker: worn items first, then the bag. */
  private drawPicker(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const g = kit.gTop;
    const layer = kit.layer(true);
    this.layoutPicker();
    const k = easeBack((now - this.pickAt) / 220, 1.5);
    g.fillStyle(0x07050e, 0.5 * clamp01((now - this.pickAt) / 120));
    g.fillRect(0, 0, kit.s.R + kit.s.L + 400, kit.s.B + 200);
    const pr0 = this.picker();
    const sc = 0.85 + 0.15 * k;
    const pr = { x: Math.round(pr0.x + (pr0.w * (1 - sc)) / 2), y: Math.round(pr0.y + (pr0.h * (1 - sc)) / 2), w: Math.round(pr0.w * sc), h: Math.round(pr0.h * sc) };
    kit.pane(g, pr);
    if (k < 0.95) return;
    const tw = textWidth('Pick an item', 1, true) + 22;
    const rx = pr.x + pr.w / 2 - tw / 2;
    rows(g, rx - 1, pr.y - 7, tw + 2, 13, 1, INK);
    rows(g, rx, pr.y - 6, tw, 11, 1, 0xd8383a);
    g.fillStyle(0xff9a80, 1);
    g.fillRect(rx, pr.y - 6, tw, 1);
    layer.texts.text('Pick an item', pr.x + pr.w / 2, pr.y - 1, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    this.grid.refresh(p, kit.tuning, 'rarity', true);
    this.worn.draw(kit, p, now, { layer, selected: this.anvil, target: null, flash: new Map(), openAt: this.pickAt });
    const gr = this.grid;
    rows(g, gr.x - 3, gr.y - 3, gr.w + 6, gr.h + 6, 3, INK);
    rows(g, gr.x - 2, gr.y - 2, gr.w + 4, gr.h + 4, 2, NAVY[1]);
    gr.draw(kit, p, now, { layer, cap: Math.max(1, Math.round(kit.tuning.gear.bagSize)), selected: this.anvil, openAt: this.pickAt });
  }
}

/** A stat precise enough that one forge level visibly moves it (flat stats keep a decimal under 100). */
function fine(stat: StatId, v: number): string {
  if (STAT_INFO[stat].unit !== 'flat' || Math.abs(v) >= 100) return fmtStat(stat, v, false);
  return (Math.round(v * 10) / 10).toFixed(1);
}
