// Gear art (see docs/art-style.md): an icon for every base item (`item_${icon}`, ITEM_ICON_SIZE square, 1px ink
// outline included, transparent background; the bag draws the rarity frame around it).
//
// PLACEHOLDER: simple per-slot shapes until the real icons are painted.
import { BASE_ITEMS, type Slot } from '../data/gear';
import { grid, put, toCanvas } from './art';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Item icons are this many px square (outline included). */
export const ITEM_ICON_SIZE = 12;

const SLOT_COL: Record<Slot, [string, string]> = {
  weapon: ['#b8c2d8', '#eef3fa'],
  helm: ['#7c86a6', '#b8c2d8'],
  armor: ['#98663a', '#c0905a'],
  boots: ['#6e4426', '#98663a'],
  trinket: ['#d8901c', '#f2c230'],
};

function placeholder(slot: Slot): HTMLCanvasElement {
  const n = ITEM_ICON_SIZE - 2;
  const g = grid(ITEM_ICON_SIZE, ITEM_ICON_SIZE);
  const [lo, hi] = SLOT_COL[slot];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const on =
        slot === 'weapon' ? Math.abs(x - (n - 1 - y)) <= 1 : slot === 'trinket' ? Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) < n / 2 - 1 : slot === 'boots' ? x < 6 && y > 2 && (y > 6 || x < 4) : y > 1;
      if (on) put(g, x + 1, y + 1, x + y < n ? hi : lo);
    }
  return toCanvas(g);
}

export function buildGearArt(add: Add): void {
  const done = new Set<string>();
  for (const b of BASE_ITEMS) {
    if (done.has(b.icon)) continue;
    done.add(b.icon);
    add(`item_${b.icon}`, placeholder(b.slot));
  }
}
