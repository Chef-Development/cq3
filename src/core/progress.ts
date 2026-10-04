// Progress kept across runs (pure; storage.ts saves it): how far Greenmarch has been cleared, and how many of the
// Great Pendulum's 12 weights are home. The world map shows it (act flags, the weights counter).

export interface Progress {
  v: 1;
  actsCleared: number; // Greenmarch's acts cleared at least once (0-3)
  weights: number; // pendulum weights recovered (a region cleared brings one home)
}

export const WEIGHTS_TOTAL = 12;

export function newProgress(): Progress {
  return { v: 1, actsCleared: 0, weights: 0 };
}

/** Saved progress in current form (anything unreadable starts over). */
export function readProgress(data: unknown): Progress {
  const p = data as Progress | null;
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
  if (!p || typeof p !== 'object' || p.v !== 1) return newProgress();
  return { v: 1, actsCleared: n(p.actsCleared, 3), weights: n(p.weights, WEIGHTS_TOTAL) };
}

/** Act `act` (0-based) was just cleared. Returns true if that's new. */
export function recordAct(p: Progress, act: number): boolean {
  if (act + 1 <= p.actsCleared) return false;
  p.actsCleared = act + 1;
  return true;
}

/** The region was cleared: its weight is home (once). */
export function recordRegion(p: Progress): boolean {
  if (p.weights >= 1) return false;
  p.weights = 1;
  return true;
}
