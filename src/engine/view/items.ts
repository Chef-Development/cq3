// Shared gear UI pieces (the bag, the forge, the loot screen): an item cell with its rarity frame and icon, rarity
// colors, and the lines that describe an item. Rarity frames: Common grey, Uncommon green, Rare blue, Epic purple,
// Legendary orange, Mythic red (src/data/gear.ts RARITY_INFO).
import type Phaser from 'phaser';
import { BASE_BY_ID, EFFECTS, RARITY_INFO, SETS, SLOT_NAME, STAT_INFO, type GearRarity, type Slot, type StatId } from '../../data/gear';
import { baseStats, bonusStats, fmtStatShort, itemName, slotOfItem, statPower, zeroStats, type Item } from '../../core/gear';
import type { Tuning } from '../../core/tuning';
import { ITEM_ICON_SIZE } from '../art-gear';
import { textWidth } from '../font';
import { band, rows } from './pixels';
import { INK, mix, WHITE, type Rect } from './shared';
import type { ImagePool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** The rarity's frame colors [hi, base, lo, deep]. */
export const rarityFace = (r: GearRarity) => RARITY_INFO[r].face;
/** A rarity's text color (its frame's light tone). */
export const rarityText = (r: GearRarity): number => mix(RARITY_INFO[r].face[0], WHITE, 0.15);

export interface CellOpts {
  selected?: boolean;
  equipped?: boolean;
  fresh?: boolean;
  locked?: boolean;
  dim?: boolean;
  alpha?: number;
}

/**
 * An item cell: ink outline, a 1px frame in the rarity's colors (grey when empty), a dark well. The icon is drawn
 * separately (cellIcon) because it's a texture.
 */
export function itemCell(g: G, r: Rect, rarity: GearRarity | null, o: CellOpts = {}): void {
  const a = o.alpha ?? 1;
  const face = rarity ? rarityFace(rarity) : ([0x5e5090, 0x413668, 0x2f2650, 0x1b1530] as const);
  if (o.selected) {
    g.fillStyle(WHITE, 0.9 * a);
    g.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, INK, a);
  rows(g, r.x, r.y, r.w, r.h, 2, o.dim ? mix(face[2], INK, 0.5) : face[1], a);
  band(g, r.x, r.y, r.w, r.h, 2, 0, 1, o.dim ? face[2] : face[0], a);
  band(g, r.x, r.y, r.w, r.h, 2, r.h - 1, r.h, face[3], a);
  // the well
  g.fillStyle(mix(face[3], INK, 0.55), a);
  g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  g.fillStyle(mix(face[2], INK, 0.45), a);
  g.fillRect(r.x + 1, r.y + 1, r.w - 2, Math.round((r.h - 2) * 0.45));
  if (o.equipped) {
    // a small "E" corner tab
    g.fillStyle(0xfff0a0, a);
    g.fillRect(r.x + r.w - 4, r.y + 1, 3, 1);
    g.fillRect(r.x + r.w - 2, r.y + 1, 1, 3);
  }
  if (o.fresh) {
    // a pulsing dot for a new item
    g.fillStyle(0xff5a48, a);
    g.fillRect(r.x + 1, r.y + 1, 2, 2);
  }
  if (o.locked) {
    g.fillStyle(0xf2c230, a);
    g.fillRect(r.x + r.w - 4, r.y + r.h - 4, 3, 3);
    g.fillStyle(INK, a);
    g.fillRect(r.x + r.w - 3, r.y + r.h - 3, 1, 1);
  }
}

/** The item's icon centred in a cell (scale 1 at 14px cells; pass 2 for the big reveal card). */
export function cellIcon(pool: ImagePool, item: Item, r: Rect, depth: number, scale = 1, alpha = 1): void {
  const icon = BASE_BY_ID[item.base]?.icon;
  if (!icon) return;
  const s = ITEM_ICON_SIZE * scale;
  pool.scaled(`item_${icon}`, Math.round(r.x + (r.w - s) / 2), Math.round(r.y + (r.h - s) / 2), depth, scale, alpha);
}

/** "Lv 12 Epic Weapon" */
export function itemKind(item: Item): string {
  return `Lv ${item.ilvl} ${RARITY_INFO[item.rarity].name} ${SLOT_NAME[slotOfItem(item)]}`;
}

/** A rarity at or above Epic (shimmering frames, a sting when found). */
export const isShiny = (r: GearRarity): boolean => r === 'epic' || r === 'legendary' || r === 'mythic';

/** A base item icon per slot: drawn as a dark silhouette in an empty equipment slot. */
export const SLOT_ICON: Record<Slot, string> = { weapon: 'shortsword', helm: 'cap', armor: 'vest', boots: 'boots', trinket: 'locket' };

/**
 * The marks drawn OVER a cell's icon (draw them on a graphics layer above the icons): a gold "worn" corner tab, a
 * pulsing red "new" dot, a padlock. `now` drives the pulse.
 */
export function cellMarks(g: G, r: Rect, o: { equipped?: boolean; fresh?: boolean; locked?: boolean; alpha?: number }, now: number): void {
  const a = o.alpha ?? 1;
  if (o.equipped) {
    // a folded gold corner in the top right
    g.fillStyle(INK, a);
    g.fillRect(r.x + r.w - 6, r.y - 1, 7, 1);
    g.fillRect(r.x + r.w, r.y, 1, 6);
    g.fillRect(r.x + r.w - 6, r.y, 1, 1);
    g.fillRect(r.x + r.w - 1, r.y + 5, 1, 1);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(i < 2 ? 0xfff0a0 : 0xf2c230, a);
      g.fillRect(r.x + r.w - 5 + i, r.y, 5 - i, 1);
    }
    g.fillStyle(0xf2c230, a);
    for (let i = 1; i < 5; i++) g.fillRect(r.x + r.w - 5 + i, r.y + i, 5 - i, 1);
    g.fillStyle(0x9a5a14, a);
    g.fillRect(r.x + r.w - 1, r.y + 1, 1, 4);
  }
  if (o.fresh) {
    const p = 0.5 - 0.5 * Math.cos((now / 700) * Math.PI * 2);
    g.fillStyle(INK, a);
    g.fillRect(r.x - 1, r.y - 1, 5, 5);
    g.fillStyle(mix(0xd8303a, 0xff9a80, p), a);
    g.fillRect(r.x, r.y, 3, 3);
    g.fillStyle(WHITE, a * (0.5 + 0.5 * p));
    g.fillRect(r.x, r.y, 1, 1);
  }
  if (o.locked) padlock(g, r.x + r.w - 5, r.y + r.h - 6, a);
}

/** A tiny padlock (6 x 7, ink outline included) with its top-left at (x, y). */
export function padlock(g: G, x: number, y: number, a = 1, body = 0xf2c230): void {
  g.fillStyle(INK, a);
  g.fillRect(x + 1, y, 4, 1);
  g.fillRect(x, y + 1, 1, 3);
  g.fillRect(x + 5, y + 1, 1, 3);
  g.fillRect(x, y + 3, 6, 4);
  g.fillStyle(0xd0d4e0, a);
  g.fillRect(x + 1, y + 1, 1, 2);
  g.fillRect(x + 4, y + 1, 1, 2);
  g.fillRect(x + 2, y + 1, 2, 1);
  g.fillStyle(body, a);
  g.fillRect(x + 1, y + 4, 4, 2);
  g.fillStyle(mix(body, WHITE, 0.5), a);
  g.fillRect(x + 1, y + 4, 4, 1);
  g.fillStyle(INK, a);
  g.fillRect(x + 2, y + 5, 2, 1);
}

/** A soft pulsing glow under a Rare-or-better cell (draw before the frame). */
export function cellGlow(g: G, r: Rect, rarity: GearRarity, now: number, alpha = 1): void {
  const ri = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarity);
  if (ri < 2) return;
  const p = 0.5 - 0.5 * Math.cos(((now + r.x * 13 + r.y * 7) / 1100) * Math.PI * 2);
  const k = ri === 2 ? 0.25 : ri === 3 ? 0.45 : 0.6;
  const spread = ri >= 4 ? 3 : 2;
  const col = rarityFace(rarity)[1];
  for (let i = spread; i >= 1; i--) rows(g, r.x - 1 - i, r.y - 1 - i, r.w + 2 + i * 2, r.h + 2 + i * 2, Math.min(4, i + 1), col, (alpha * k * (0.6 + 0.4 * p) * (spread + 1 - i)) / (spread + 1));
}

/**
 * Epic and better: a slanted shimmer sweeping across the cell every couple of seconds; Legendary and Mythic also
 * twinkle at the corners. Draw it over the icon.
 */
export function cellShine(g: G, r: Rect, rarity: GearRarity, now: number, alpha = 1): void {
  if (!isShiny(rarity)) return;
  const period = rarity === 'epic' ? 2600 : 1900;
  const cyc = (((now + r.x * 31 + r.y * 17) % period) + period) % period / period;
  if (cyc < 0.28) {
    const k = cyc / 0.28;
    const sx = r.x - r.h + (r.w + r.h + 4) * k;
    g.fillStyle(WHITE, (rarity === 'epic' ? 0.38 : 0.5) * alpha * Math.sin(k * Math.PI));
    for (let y = 1; y < r.h - 1; y++) {
      const x = Math.round(sx + (r.h - y) * 0.6);
      const x0 = Math.max(r.x + 1, x);
      const x1 = Math.min(r.x + r.w - 1, x + 3);
      if (x1 > x0) g.fillRect(x0, r.y + y, x1 - x0, 1);
    }
  }
  if (rarity !== 'epic') {
    const q = (((now + r.x * 57) / 900) % 1 + 1) % 1;
    if (q < 0.5) {
      const corner = Math.floor((now + r.x * 57) / 900) % 4;
      const px = corner % 2 ? r.x + r.w : r.x - 1;
      const py = corner < 2 ? r.y - 1 : r.y + r.h;
      const arm = q < 0.25 ? 2 : 1;
      g.fillStyle(rarity === 'mythic' ? 0xffd0c0 : 0xfff0a0, alpha * (1 - q * 2));
      g.fillRect(px - arm, py, arm * 2 + 1, 1);
      g.fillRect(px, py - arm, 1, arm * 2 + 1);
    }
  }
}

/** Text cut to fit `w` game px, with an ellipsis. */
export function fit(s: string, w: number, bold = false): string {
  if (textWidth(s, 1, bold) <= w) return s;
  let t = s;
  while (t.length > 1 && textWidth(`${t}...`, 1, bold) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Word-wrap `s` to lines no wider than `maxW` game px (explicit '\n' breaks are kept). */
export function wrapText(s: string, maxW: number, bold = false): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let cur = '';
    for (const w of para.split(' ')) {
      const test = cur ? `${cur} ${w}` : w;
      if (!cur || textWidth(test, 1, bold) <= maxW) cur = test;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
}

export interface ItemLine {
  text: string;
  color: number;
  icon?: string; // hudIcon key
  stat?: StatId;
  value?: number;
}

/** "+4 ATK", "+5% Meter fill": a stat as lists print it (whole numbers in plain units, plain names). */
export const statText = (stat: StatId, v: number): string => `${fmtStatShort(stat, v)} ${STAT_INFO[stat].short}`;

/** How much an amount of a stat is worth on the bag's power scale: ranks stats by size across their units. */
export function statSize(t: Tuning, stat: StatId, v: number): number {
  const one = zeroStats();
  one[stat] = Math.abs(v);
  return statPower(t, one);
}

/** Everything an item says, top to bottom: its base stats, bonus stats (short numbers), unique effect and set. */
export function itemLines(t: Tuning, item: Item): ItemLine[] {
  const out: ItemLine[] = [];
  for (const l of baseStats(t, item)) out.push({ text: statText(l.stat, l.value), color: WHITE, icon: STAT_INFO[l.stat].icon, stat: l.stat, value: l.value });
  for (const l of bonusStats(t, item)) out.push({ text: statText(l.stat, l.value), color: 0x9ad8ff, icon: STAT_INFO[l.stat].icon, stat: l.stat, value: l.value });
  if (item.effect) out.push({ text: `${EFFECTS[item.effect].name}: ${EFFECTS[item.effect].text}`, color: 0xffb060 });
  const set = BASE_BY_ID[item.base]?.set;
  if (set) out.push({ text: `${SETS[set].name} set (${SETS[set].pieces.length})`, color: 0x8af06a });
  return out;
}

export { itemName };
