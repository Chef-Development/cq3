// Shared gear UI pieces (the bag, the forge, the loot screen): an item cell with its rarity frame and icon, rarity
// colors, and the lines that describe an item. Rarity frames: Common grey, Uncommon green, Rare blue, Epic purple,
// Legendary orange, Mythic red (src/data/gear.ts RARITY_INFO).
import type Phaser from 'phaser';
import { BASE_BY_ID, EFFECTS, RARITY_INFO, SETS, SLOT_NAME, STAT_INFO, type GearRarity, type StatId } from '../../data/gear';
import { baseStats, bonusStats, fmtStat, itemName, slotOfItem, type Item } from '../../core/gear';
import type { Tuning } from '../../core/tuning';
import { ITEM_ICON_SIZE } from '../art-gear';
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

export interface ItemLine {
  text: string;
  color: number;
  icon?: string; // hudIcon key
  stat?: StatId;
}

/** Everything an item says, top to bottom: its base stats, bonus stats, unique effect and set. */
export function itemLines(t: Tuning, item: Item): ItemLine[] {
  const out: ItemLine[] = [];
  for (const l of baseStats(t, item)) out.push({ text: `${fmtStat(l.stat, l.value)} ${STAT_INFO[l.stat].short}`, color: WHITE, icon: STAT_INFO[l.stat].icon, stat: l.stat });
  for (const l of bonusStats(t, item)) out.push({ text: `${fmtStat(l.stat, l.value)} ${STAT_INFO[l.stat].short}`, color: 0x9ad8ff, icon: STAT_INFO[l.stat].icon, stat: l.stat });
  if (item.effect) out.push({ text: `${EFFECTS[item.effect].name}: ${EFFECTS[item.effect].text}`, color: 0xffb060 });
  const set = BASE_BY_ID[item.base]?.set;
  if (set) out.push({ text: `${SETS[set].name} set (${SETS[set].pieces.length})`, color: 0x8af06a });
  return out;
}

export { itemName };
