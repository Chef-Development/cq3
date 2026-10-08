// The region card's map geometry (pure, no Phaser: unit-tested): how big each region's parchment map is, the window
// its frame shows of it (the map is bigger and pans: view/progress.ts), where the act sites are, and where each
// counted thing's seal sits (regionMarks: one mark per item of core/completion.ts regionCompletion, so the card shows
// exactly what the tracker counts).
//
// Two coordinate spaces: the "sheet" is the map's middle REGION_VIEW_W x REGION_VIEW_H, where the act sites, the road
// and every seal are (art-region-map.ts paints the landscape in sheet coordinates, carrying it on past the sheet's
// edges into the margins); "map px" are the whole painted map's, the sheet sitting REGION_PAD_X / REGION_PAD_Y in.
// The card opens with the sheet in view (every seal at once) and the margins are what a drag pans to.
import type { CompletionItem, CompletionKey } from '../core/completion';

/** The window the frame shows (game px): the sheet. */
export const REGION_VIEW_W = 190;
export const REGION_VIEW_H = 110;
/** The map beyond the sheet on each side (game px): what panning shows. */
export const REGION_PAD_X = 30;
export const REGION_PAD_Y = 20;
/** The whole painted map. */
export const REGION_MAP_W = REGION_VIEW_W + REGION_PAD_X * 2;
export const REGION_MAP_H = REGION_VIEW_H + REGION_PAD_Y * 2;

type Pt = [number, number];

/** The act sites on each region's sheet, in act order; and where its events' seals go. */
export const REGION_SITES: Record<string, { acts: Pt[]; events: Pt }> = {
  greenmarch: { acts: [[46, 62], [100, 26], [158, 58]], events: [98, 100] },
  frostpeaks: { acts: [[38, 50], [102, 66], [160, 28]], events: [100, 100] },
  ashfell: { acts: [[42, 70], [98, 58], [142, 22]], events: [100, 100] },
};

/** A seal's radius (game px) and the spacing of a row of them. */
export const SEAL_R = 5;
export const SEAL_STEP = 12;
/** Each act's row under its site, left to right: the act, its mini-boss (the boss on the last act), its bounty, its
 *  hidden treasure. */
const ROW: Partial<Record<CompletionKey, number>> = { acts: 0, minis: 1, boss: 1, bounties: 2, treasures: 3 };
/** How far below an act site its row of seals sits (clear of the landmark's foot). */
const ROW_DY = 10;

/** A seal (done) or socket (still to do) on the map: what it stands for and where (map px). */
export interface RegionMark extends CompletionItem {
  x: number;
  y: number;
}

/** Every item's mark on region `id`'s map (map px), one per item, in the items' order (none when the region has no
 *  sites). */
export function regionMarks(id: string, items: readonly CompletionItem[]): RegionMark[] {
  const sites = REGION_SITES[id];
  if (!sites) return [];
  const evs = items.filter((it) => it.key === 'events').length;
  return items.map((it) => {
    if (it.key === 'events') {
      const [ex, ey] = sites.events;
      return { ...it, x: REGION_PAD_X + ex + Math.round((it.n - (evs - 1) / 2) * SEAL_STEP), y: REGION_PAD_Y + ey };
    }
    const [sx, sy] = sites.acts[Math.min(sites.acts.length - 1, it.n)];
    const col = ROW[it.key] ?? 0;
    return { ...it, x: REGION_PAD_X + sx + Math.round((col - 1.5) * SEAL_STEP), y: REGION_PAD_Y + sy + ROW_DY };
  });
}

/** The camera (map px at the window's top-left) the card opens with: the sheet, every seal in view. */
export const OPENING_CAMERA = { x: REGION_PAD_X, y: REGION_PAD_Y } as const;

/** A camera kept on the map (the window never shows past its edges). */
export function clampCamera(x: number, y: number): { x: number; y: number } {
  return { x: Math.max(0, Math.min(REGION_MAP_W - REGION_VIEW_W, Math.round(x))), y: Math.max(0, Math.min(REGION_MAP_H - REGION_VIEW_H, Math.round(y))) };
}
