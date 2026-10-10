// The world map's plan (pure): twelve regions to restore. Greenmarch is region 1; the continent's other lands are
// regions 2-5; seven more lie beyond the sea, erased land (blank) until the story reaches them. A land on the continent
// unveils when it can be played (its region is in REGIONS and the one before it is cleared: its first act is reached);
// a far land's blank follows the regions restored (`profile.weights`; this table: it starts to thin at `thin`, and
// lifts at `lift`). The far lands' ids are placeholders; their names (docs/story-bible.md section 8) show only once
// revealed (the map shows "?" until then). The first time a land unveils, the world map plays a short reveal; the
// profile remembers it in `seen` (`unveilKey`).

import { REGIONS, regionStart } from '../data/regions';

export interface PlanRegion {
  /** Its place in the kingdom's order (1 = Greenmarch ... 12). */
  n: number;
  id: string;
  /** Out beyond the sea (a silhouette in fog until revealed), not on the continent. */
  far: boolean;
  /** Regions restored at which its fog starts to thin, and at which it lifts. */
  thin: number;
  lift: number;
  /** Shown once revealed (the far lands; a playable land's name is its region's). */
  name?: string;
}

/** The twelve regions in order. A far land's fog thins once the region two before it is cleared, and lifts once the
 *  one just before it is (region n: thin at n - 2 restored, lift at n - 1). */
export const WORLD_PLAN: readonly PlanRegion[] = [
  { n: 1, id: 'greenmarch', far: false, thin: 0, lift: 0 },
  { n: 2, id: 'frostpeaks', far: false, thin: 1, lift: 1 },
  { n: 3, id: 'ashfell', far: false, thin: 2, lift: 2 },
  { n: 4, id: 'duskmire', far: false, thin: 3, lift: 3 },
  { n: 5, id: 'noonspire', far: false, thin: 4, lift: 4 },
  { n: 6, id: 'far6', far: true, thin: 4, lift: 5, name: 'Hushwood' },
  { n: 7, id: 'far7', far: true, thin: 5, lift: 6, name: 'Kestrel Reach' },
  { n: 8, id: 'far8', far: true, thin: 6, lift: 7, name: 'Thimblewick' },
  { n: 9, id: 'far9', far: true, thin: 7, lift: 8, name: 'Saltmarrow' },
  { n: 10, id: 'far10', far: true, thin: 8, lift: 9, name: 'Farlight' },
  { n: 11, id: 'far11', far: true, thin: 9, lift: 10, name: 'Lowmoor' },
  { n: 12, id: 'far12', far: true, thin: 10, lift: 11, name: 'The Margin' },
];

/** The far lands, in order. */
export const FAR_PLAN: readonly PlanRegion[] = WORLD_PLAN.filter((r) => r.far);

/** How thick a thinning fog still is (a fogged land is 1, a revealed one 0). */
export const FOG_THIN = 0.45;

export const planRegion = (id: string): PlanRegion | undefined => WORLD_PLAN.find((r) => r.id === id);

/** How thick a land's fog is with `weights` regions restored: 1 (fogged), FOG_THIN (thinning) or 0 (lifted). */
export function fogOf(weights: number, r: PlanRegion): number {
  return weights >= r.lift ? 0 : weights >= r.thin && r.thin < r.lift ? FOG_THIN : 1;
}

/** Whether a land's fog has lifted (with `weights` regions restored). */
export const revealed = (weights: number, r: PlanRegion): boolean => weights >= r.lift;

/** What a land is called on the map: its name once revealed (if it has one yet), "?" until then. */
export const planName = (weights: number, r: PlanRegion): string => (revealed(weights, r) && r.name ? r.name : '?');

/** Whether playable region `r` (an index into REGIONS) is open: the first always, a later one once its first act is
 *  reached (the region before it cleared). */
export const regionOpen = (p: { actsCleared: number }, r: number): boolean => r >= 0 && r < REGIONS.length && p.actsCleared >= regionStart(r);

/** The index into REGIONS of the playable region with this id, or -1 (a land with no acts yet). */
export const playableIndex = (id: string): number => REGIONS.findIndex((r) => r.id === id);

/** Whether the land with this id is unveiled on the world map: playable and open. */
export const landOpen = (p: { actsCleared: number }, id: string): boolean => regionOpen(p, playableIndex(id));

/** The profile's `seen` entry for a land's first reveal. */
export const unveilKey = (id: string): string => `unveil:${id}`;

/** The land whose first reveal is still to play (open, not Greenmarch, not seen yet), or null. */
export function unveilPending(p: { actsCleared: number; seen: string[] }): string | null {
  for (let r = 1; r < REGIONS.length; r++) if (regionOpen(p, r) && !p.seen.includes(unveilKey(REGIONS[r].id))) return REGIONS[r].id;
  return null;
}

/** Remember that a land's reveal has played (once). */
export function markUnveiled(p: { seen: string[] }, id: string): void {
  if (!p.seen.includes(unveilKey(id))) p.seen.push(unveilKey(id));
}
