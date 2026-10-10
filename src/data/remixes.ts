// The Mapmaker's revisions (New Game+, SPOILERS: docs/content-bible.md section 9): once a region is restored (its boss
// beaten, its weight home), its boss comes back redrawn, one more of the Mapmaker's edits on top of the fight you won:
// a new last phase that brings a later region's bar rule, at the numbers of the furthest act you have reached (so it
// stays a challenge), for a better reward the first time (gems and a hero chest) and Rare-or-better gear every time.
// Reached from the region's act picker on the world map. Plain data; core/run.ts startRemix plays it; its numbers are
// tuning.remix.

/** A remix: which region's boss, as which foe (src/data/enemies-remix.ts), and its words. */
export interface RemixDef {
  /** The foe key of the revised boss (also its id in the profile: `remix:<id>` once beaten). */
  id: string;
  /** The region whose boss it revises (REGIONS id): offered once that region is restored. */
  region: string;
  /** The boss it revises (ENEMIES key). */
  of: string;
  /** The picker's line for it, and the try-it line. */
  name: string;
  text: string;
}

export const REMIXES: RemixDef[] = [
  // the first region's boss, redrawn in the dark (the fourth region's lantern rule) for his last phase
  { id: 'boarKingRevised', region: 'greenmarch', of: 'boarKing', name: "The Mapmaker's revision", text: 'The Boar King, redrawn. Bring a light.' },
];

export const remixById = (id: string): RemixDef | undefined => REMIXES.find((r) => r.id === id);
