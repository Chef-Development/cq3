// The relic log (a camp screen): every relic in a grid, each in its rarity's frame (Common grey, Rare blue, Epic
// purple): unlocked ones in colour, locked ones as dark silhouettes with a padlock, new ones with a red NEW tag.
// The counter is in the title ("Relics 27/40"); under the grid, how many of each rarity are unlocked. Tapping one
// shows its card: the icon at 2x, name, rarity, tags as chips, what it does, and for a locked one how to unlock it.
// Looking at a new relic clears its NEW tag.
import type Phaser from 'phaser';
import { RARITY_INFO } from '../../data/gear';
import { RELICS, type RelicDef, type RelicId, type RelicRarity, type RelicTag } from '../../data/relics';
import { relicUnlocked } from '../../core/profile';
import { relicText, unlockHint } from '../../core/relics';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GOLD_TXT, pix } from './camp-kit';
import { cellGlow, cellShine, itemCell, padlock, wrapText } from './items';
import { cardTile, chipWidth, RARITY_FACE, tagChip } from './relic-ui';
import { gauge, glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

const CELL = 14;
const PX = 16;
const PY = 17;
const COLS = 8;

/** Each tag's color (its chip and the stand-in icons). */
export const TAG_COL: Record<RelicTag, number> = {
  bomb: 0xf28a2a,
  crit: 0xf05a48,
  block: 0x4aa0f0,
  combo: 0x5af0ff,
  finisher: 0xf2c230,
  green: 0x6ad040,
  pip: 0x9ad8ff,
  sustain: 0xff7aa8,
  coins: 0xffd23a,
  risk: 0xb06ae0,
  ice: 0x8ae0f6,
  hold: 0x6a9af0,
  drift: 0xf08a3a,
  link: 0xb8b0c8,
  light: 0xf6d860,
  tide: 0x4ab8c0,
};

const RARITIES: RelicRarity[] = ['common', 'rare', 'epic'];

export class RelicLogScreen {
  sel: RelicId | null = null;
  private openAt = 0;
  private selAt = 0;
  private seenAt = new Map<RelicId, number>();

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    this.openAt = now;
    this.selAt = now;
    this.sel = null;
    this.seenAt.clear();
  }

  // ------------------------------------------------------------------ layout

  private gridPane(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 20, w: COLS * PX - 2 + 12, h: s.B - 23 };
  }

  private cell(i: number): Rect {
    const p = this.gridPane();
    return { x: p.x + 6 + (i % COLS) * PX, y: p.y + 8 + Math.floor(i / COLS) * PY, w: CELL, h: CELL };
  }

  private card(): Rect {
    const s = this.kit.s;
    const g = this.gridPane();
    const x = g.x + g.w + 4;
    return { x, y: 20, w: s.R - 3 - x, h: s.B - 23 };
  }

  private unlocked(id: RelicId): boolean {
    return relicUnlocked(this.kit.profile, id);
  }

  private isNew(id: RelicId): boolean {
    return this.kit.profile.relicsNew.includes(id);
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (let i = 0; i < RELICS.length; i++)
      if (inRect(this.cell(i), x, y, 1)) {
        const id = RELICS[i].id;
        if (id === this.sel) return;
        return this.select(id, now);
      }
  }

  select(id: RelicId, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    this.sel = id;
    this.selAt = now;
    if (p.relicsNew.includes(id)) {
      // a new one, seen: its NEW tag pops off
      p.relicsNew = p.relicsNew.filter((r) => r !== id);
      kit.app.saveProfile();
      this.seenAt.set(id, now);
      const r = this.cell(RELICS.findIndex((q) => q.id === id));
      kit.fx.burst(r.x + 3, r.y + 1, [0xff5a48, WHITE, 0xfff0a0], 12, 0.8, { kind: 'star', g: 60, life: 520 });
      kit.app.audio.statUp(4);
      kit.after(80, () => kit.app.audio.coin());
    } else kit.app.audio.uiClick();
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const p = kit.profile;
    const have = RELICS.filter((r) => relicUnlocked(p, r.id)).length;
    kit.drawBack(g, now);
    kit.title(g, 'Relics', kit.backRect().x + kit.backRect().w + 4, 4, RIBBON.purple, `${have}/${RELICS.length}`);
    if (p.relicsNew.length) {
      const s = kit.s;
      const txt = `${p.relicsNew.length} new!`;
      kit.texts.text(txt, s.R - 4, 9, 0xff9a8a, { bold: true, ox: 1, oy: 0.5, alpha: 0.7 + 0.3 * pulse(now, 900) });
    }
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const gp0 = this.gridPane();
    kit.pane(g, { ...gp0, x: gp0.x - Math.round((1 - k) * 24) }, { alpha: clamp01(k * 2) });
    const c0 = this.card();
    kit.pane(g, { ...c0, x: c0.x + Math.round((1 - k) * 24) }, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    this.drawGrid(g, now);
    this.drawTally(g, now);
    if (this.sel) this.drawCard(g, this.sel, c0, now);
    else this.drawIntro(g, c0, now);
  }

  /** A relic's icon (12x12) with its top-left at (x, y): its art, or a pendant in its main tag's color. */
  private icon(def: RelicDef, x: number, y: number, depth: number, o: { scale?: number; dark?: boolean; alpha?: number } = {}): void {
    const kit = this.kit;
    const sc = o.scale ?? 1;
    const key = `relic_${def.id}`;
    if (kit.has(key)) {
      kit.sprites.draw(key, x, y, depth, { scale: sc, tint: o.dark ? 0x2c2444 : undefined, alpha: o.alpha });
      return;
    }
    pendant(kit.gOver, x, y, o.dark ? 0x2a2238 : TAG_COL[def.tags[0]], sc, o.alpha ?? 1, !!o.dark);
  }

  private drawGrid(g: G, now: number): void {
    const kit = this.kit;
    const over = kit.gOver;
    const gp = this.gridPane();
    // the grid sits in a dark tray
    const last = this.cell(RELICS.length - 1);
    const tray = { x: gp.x + 3, y: gp.y + 3, w: COLS * PX - 2 + 6, h: last.y + last.h + 3 - (gp.y + 3) };
    rows(g, tray.x, tray.y, tray.w, tray.h, 2, NAVY[1]);
    g.fillStyle(INK, 1);
    g.fillRect(tray.x + 2, tray.y, tray.w - 4, 1);
    RELICS.forEach((def, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ck = clamp01((now - this.openAt - 80 - (col + row) * 16) / 150);
      if (ck <= 0) return;
      const on = def.id === this.sel;
      const r0 = this.cell(i);
      const r = { ...r0, y: r0.y - (on ? 1 : 0) + Math.round((1 - easeBack(ck, 2)) * 3) };
      const open = this.unlocked(def.id);
      if (open) cellGlow(g, r, def.rarity, now, ck);
      itemCell(g, r, def.rarity, { selected: on, dim: !open, alpha: ck });
      if (on) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, mix(GOLD[4], WHITE, pulse(now, 700)), 0.9 * ck);
      if (on) itemCell(g, r, def.rarity, { dim: !open, alpha: ck });
      this.icon(def, r.x + 1, r.y + 1, D.icons, { dark: !open, alpha: ck });
      if (open) cellShine(over, r, def.rarity, now, ck);
      else padlock(over, r.x + r.w - 5, r.y + r.h - 6, ck * 0.95, 0xb08a4a);
    });
    // NEW tags over everything (they stick out of their cells)
    RELICS.forEach((def, i) => {
      const r = this.cell(i);
      const ck = clamp01((now - this.openAt - 300) / 150);
      if (this.isNew(def.id)) newTag(over, r.x - 2, r.y - 5, now, ck);
      const seen = now - (this.seenAt.get(def.id) ?? -1e9);
      if (seen < 260) newTag(over, r.x - 2, r.y - 5 - Math.round(seen / 30), now, 1 - seen / 260);
    });
  }

  /** Under the grid: how many of each rarity are unlocked, and a bar for all of them. */
  private drawTally(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const gp = this.gridPane();
    const last = this.cell(RELICS.length - 1);
    const have = RELICS.filter((r) => relicUnlocked(p, r.id)).length;
    // at the panel's foot (the grid keeps its place at the top)
    let y = Math.max(last.y + last.h + 10, gp.y + gp.h - 24);
    const bar = { x: gp.x + 6, y, w: gp.w - 12, h: 5 };
    gauge(g, bar.x, bar.y, bar.w, bar.h, have / RELICS.length, 0, { ramp: [0xf0d8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a] });
    y += 13;
    const part = (gp.w - 12) / RARITIES.length;
    RARITIES.forEach((rar, i) => {
      const n = RELICS.filter((r) => r.rarity === rar).length;
      const h = RELICS.filter((r) => r.rarity === rar && relicUnlocked(p, r.id)).length;
      const x = Math.round(gp.x + 6 + i * part);
      const sq = { x, y: y - 3, w: 6, h: 6 };
      rows(g, sq.x - 1, sq.y - 1, sq.w + 2, sq.h + 2, 1, INK);
      g.fillStyle(RARITY_INFO[rar].face[1], 1);
      g.fillRect(sq.x, sq.y, sq.w, sq.h);
      g.fillStyle(RARITY_INFO[rar].face[0], 1);
      g.fillRect(sq.x, sq.y, sq.w, 2);
      texts.text(`${h}/${n}`, x + 9, y, h === n ? GOLD_TXT : 0xd8d0f0, { oy: 0.5 });
    });
    void now;
  }

  /** Nothing tapped yet: what the log is. */
  private drawIntro(g: G, c: Rect, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const p = kit.profile;
    const have = RELICS.filter((r) => relicUnlocked(p, r.id)).length;
    const cx = c.x + c.w / 2;
    pix(g, 'relic', Math.round(cx - 4), c.y + 8);
    texts.text(`${have}/${RELICS.length}`, cx, c.y + 30, WHITE, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: NAVY[1] });
    texts.text('relics unlocked', cx, c.y + 44, 0xd8d0f0, { ox: 0.5, oy: 0.5 });
    let y = c.y + 60;
    for (const l of wrapText('Pick them after fights. Clear acts, beat elites and try events to unlock more.', c.w - 14)) {
      texts.text(l, cx, y, DIM_TXT, { ox: 0.5, oy: 0.5 });
      y += 8;
    }
    texts.text('Tap one to read it', cx, c.y + c.h - 10, 0xfff07a, { ox: 0.5, oy: 0.5, alpha: 0.55 + 0.45 * pulse(now, 1100) });
  }

  /**
   * A relic's card, in the relic cards' style (the pick, the unlock card): the icon at 2x on a tile in its rarity's
   * colours, the name, the rarity tag (Rare and Epic), its tag chips, what it does; a locked one says how to unlock it.
   */
  private drawCard(g: G, id: RelicId, c: Rect, now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const texts = kit.texts;
    const def = RELICS.find((r) => r.id === id)!;
    const open = this.unlocked(id);
    const k = easeBack((now - this.selAt) / 200, 1.6);
    const a = clamp01((now - this.selAt) / 120);
    const ix = c.x + 6 + Math.round((1 - k) * 6);
    const iw = c.w - 12;
    // the icon at 2x on its rarity's tile (a locked one dark, with a padlock)
    const look = RARITY_FACE[def.rarity];
    const face = open ? look.face : ([0x6a6478, 0x4a4458, 0x3a3448, 0x26222e] as const);
    const tile = { x: ix, y: c.y + 6, w: 30, h: 30 };
    if (open && def.rarity !== 'common') glow(g, tile, face[1], 0.35 + 0.2 * pulse(now, 1000), 2);
    rows(g, tile.x - 1, tile.y - 1, tile.w + 2, tile.h + 2, 3, INK, a);
    cardTile(g, tile, face, a);
    this.icon(def, tile.x + 3, tile.y + 3, D.icons, { scale: 2, dark: !open, alpha: a });
    if (!open) padlock(kit.gOver, tile.x + tile.w - 8, tile.y + tile.h - 9, a, GOLD[3]);
    // the name (two lines if it must), then the rarity tag
    const nx = tile.x + tile.w + 6;
    const nw = c.x + c.w - 6 - nx;
    let y = c.y + 11;
    for (const l of wrapText(def.name, nw, true).slice(0, 2)) {
      texts.text(l, nx, y, open ? WHITE : 0xb0a8c8, { bold: true, oy: 0.5, alpha: a });
      y += 9;
    }
    if (look.tag) {
      const tw = textWidth(look.tag, 1, false) + 6;
      tag(g, { x: nx, y: y - 4, w: tw, h: 9 }, face, a);
      texts.text(look.tag, nx + 3, y + 0.5, WHITE, { oy: 0.5, alpha: a });
    }
    // its tags, as the relic cards show them
    y = Math.max(y + 8, tile.y + tile.h + 6);
    let x = ix;
    for (const tg of def.tags) {
      const w = chipWidth(tg);
      if (x + w > ix + iw) {
        x = ix;
        y += 12;
      }
      x += tagChip(kit.s, g, texts, kit.imgs, tg, x, y, D.icons, { alpha: a * (open ? 1 : 0.7), now }) + 3;
    }
    y += 18;
    // what it does
    for (const l of wrapText(relicText(t, id), iw)) {
      texts.text(l, ix, y, open ? 0xe8e2ff : 0xb0a8c8, { oy: 0.5, alpha: a });
      y += 9;
    }
    // a locked one: how to unlock it
    if (!open) {
      y += 3;
      kit.divider(g, ix, y - 4, iw);
      y += 5;
      padlock(g, ix, y - 4, a, GOLD[3]);
      texts.text('To unlock:', ix + 9, y, GOLD_TXT, { bold: true, oy: 0.5, alpha: a });
      y += 9;
      for (const l of wrapText(unlockHint(id), iw)) {
        texts.text(l, ix, y, 0xfff0c0, { oy: 0.5, alpha: a });
        y += 8;
      }
    }
  }
}

/** A stand-in relic icon: a pendant on a gold chain, its gem in `col` (12x12 at scale 1). */
function pendant(g: G, x: number, y: number, col: number, sc: number, a: number, dark: boolean): void {
  const ROWS = ['...cccc.....', '..c....c....', '...c..c.....', '....cc......', '...kkkk.....', '..kGHGgk....', '.kGHGGggk...', '.kGGGGggk...', '..kGGggk....', '...kggk.....', '....kk......'];
  const pal: Record<string, number> = { c: dark ? 0x2a2238 : 0xf2c230, k: INK, G: col, H: dark ? col : mix(col, WHITE, 0.6), g: dark ? col : mix(col, INK, 0.4) };
  ROWS.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; xx++) {
      const ch = r[xx];
      if (ch === '.') continue;
      g.fillStyle(pal[ch], a);
      g.fillRect(x + (xx + 2) * sc, y + yy * sc, sc, sc);
    }
  });
}


/** A tiny red "NEW" tag (pixel letters, 17 x 9 with its outline) with its top-left at (x, y). */
function newTag(g: G, x: number, y: number, now: number, a: number): void {
  const p = pulse(now, 800);
  g.fillStyle(INK, a);
  g.fillRect(x, y + 1, 17, 7);
  g.fillRect(x + 1, y, 15, 9);
  g.fillStyle(mix(0xc8202a, 0xf04a3a, p), a);
  g.fillRect(x + 1, y + 1, 15, 7);
  g.fillStyle(0xff8a7a, a);
  g.fillRect(x + 2, y + 1, 13, 1);
  // N E W, 3x5 / 3x5 / 5x5 letters
  const L = [
    ['#..#', '##.#', '#.##', '#..#', '#..#'],
    ['###', '#..', '##.', '#..', '###'],
    ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  ];
  g.fillStyle(WHITE, a);
  let lx = x + 2;
  for (const glyph of L) {
    glyph.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === '#') g.fillRect(lx + xx, y + 2 + yy, 1, 1);
    });
    lx += glyph[0].length + 1;
  }
}
