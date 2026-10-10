// The Mapmaker's Edits: opt-in hardships a player who has restored a region can draw into the next act they start
// (core/run.ts applies them; the numbers are tuning.edits). Each makes the act harder in one plain way and pays for
// it: more XP from the act's fights and its clear, and gems the first time the act is cleared under that Edit (kept
// in profile.edits.cleared). Never in a newcomer's first ten minutes: they open once Region 1 is restored. Off by
// default, nothing bought with money, no timers.

export type EditId = 'swiftReds' | 'ironHides' | 'thinMercy' | 'sharpEdges' | 'lastLife';

export interface EditDef {
  id: EditId;
  name: string;
  /** What it does, in one short line (the chooser; at most EDIT_LINE_W wide). */
  line: string;
  /** How hard it makes an act (1-2): the reward scales with it (tuning.edits.xpPer, gemsPer). */
  weight: number;
  /** Its glyph on the chooser and the HUD (view/icons). */
  icon: string;
}

export const EDITS: readonly EditDef[] = [
  { id: 'swiftReds', name: 'Swift Reds', line: 'Red attacks come faster.', weight: 2, icon: 'flame' },
  { id: 'ironHides', name: 'Iron Hides', line: 'Foes have more HP.', weight: 2, icon: 'guard' },
  { id: 'thinMercy', name: 'Thin Mercy', line: 'Fight heals stop sooner.', weight: 1, icon: 'heartS' },
  { id: 'sharpEdges', name: 'Sharp Edges', line: 'Misses cost triple HP.', weight: 1, icon: 'blade' },
  { id: 'lastLife', name: 'Last Life', line: 'No revives, no forgiveness.', weight: 1, icon: 'moon' },
];

/** How wide an Edit's line may be (game px, the small letters): one row of the chooser (view/edits.ts). */
export const EDIT_LINE_W = 146;

export const EDIT_IDS: readonly EditId[] = EDITS.map((e) => e.id);
export const isEditId = (v: unknown): v is EditId => typeof v === 'string' && (EDIT_IDS as readonly string[]).includes(v);
export const editById = (id: EditId): EditDef => EDITS.find((e) => e.id === id)!;
