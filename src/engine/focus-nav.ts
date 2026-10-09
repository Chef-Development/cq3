// Keyboard focus between a screen's buttons (pure: no DOM, unit-tested in tests/unit/focus-nav.test.ts). The targets
// are the rects the screen drew as buttons on its last frame (engine/focus.ts collects them), in game px. The arrows
// move to the nearest target that way; Tab steps through them in reading order (rows top to bottom, then left to
// right), wrapping. Things move as they animate in, so the ring follows its target from frame to frame by its centre.

export interface FRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FocusDir = 'left' | 'right' | 'up' | 'down';

const cx = (r: FRect) => r.x + r.w / 2;
const cy = (r: FRect) => r.y + r.h / 2;

/** Rows: centres within this many game px of a row's first one share it. */
const ROW_PX = 8;

/** The usable targets: on screen, big enough to press, each rect once (the same rect drawn twice is one target). */
export function usable<T extends FRect>(rs: readonly T[], W: number, H: number): T[] {
  const out: T[] = [];
  const keys = new Set<string>();
  for (const r of rs) {
    if (r.w < 3 || r.h < 3) continue;
    if (cx(r) < 0 || cx(r) > W || cy(r) < 0 || cy(r) > H) continue;
    const k = `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`;
    if (keys.has(k)) continue;
    keys.add(k);
    out.push(r);
  }
  return out;
}

/** Reading order: rows top to bottom, left to right within a row. */
export function readingOrder<T extends FRect>(rs: readonly T[]): T[] {
  const byY = [...rs].sort((a, b) => cy(a) - cy(b) || cx(a) - cx(b));
  const rows: T[][] = [];
  for (const r of byY) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(cy(r) - cy(row[0])) <= ROW_PX) row.push(r);
    else rows.push([r]);
  }
  return rows.flatMap((row) => row.sort((a, b) => cx(a) - cx(b)));
}

/** The target that is `cur` a frame later (it may have moved a little as it animates): the nearest centre within 16
 *  game px, preferring the same size. */
export function track<T extends FRect>(rs: readonly T[], cur: FRect | null): T | null {
  if (!cur) return null;
  let best: T | null = null;
  let bestD = 16;
  for (const r of rs) {
    const d = Math.hypot(cx(r) - cx(cur), cy(r) - cy(cur)) + (Math.abs(r.w - cur.w) + Math.abs(r.h - cur.h)) * 0.25;
    if (d < bestD) (best = r), (bestD = d);
  }
  return best;
}

/** Tab (+1) and Shift+Tab (-1): the next target in reading order, wrapping; the first (or last) with none yet. */
export function cycle<T extends FRect>(rs: readonly T[], cur: FRect | null, delta: 1 | -1): T | null {
  const order = readingOrder(rs);
  if (!order.length) return null;
  const at = cur ? order.indexOf(track(order, cur) as T) : -1;
  if (at < 0) return delta > 0 ? order[0] : order[order.length - 1];
  return order[(at + delta + order.length) % order.length];
}

/**
 * An arrow: the nearest target whose centre lies that way, measured along the arrow with the sideways distance
 * counted double (so the target straight ahead wins over a nearer one off to the side). Targets inside a 60 degree
 * cone come first; with none there, any target on that side. With no target yet, the first in reading order. None
 * that way: null (the ring stays).
 */
export function step<T extends FRect>(rs: readonly T[], cur: FRect | null, dir: FocusDir): T | null {
  if (!rs.length) return null;
  const from = cur ? (track(rs, cur) ?? cur) : null;
  if (!from) return readingOrder(rs)[0];
  const [ux, uy] = dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'up' ? [0, -1] : [0, 1];
  let best: T | null = null;
  let bestScore = Infinity;
  let bestCone = false;
  for (const r of rs) {
    if (r === from) continue;
    const dx = cx(r) - cx(from);
    const dy = cy(r) - cy(from);
    const along = dx * ux + dy * uy;
    if (along <= 1) continue;
    const side = Math.abs(dx * uy - dy * ux);
    const cone = side <= along * Math.tan(Math.PI / 6) + Math.min(from.w, from.h) / 2;
    const score = along + side * 2;
    if ((cone && !bestCone) || (cone === bestCone && score < bestScore)) {
      best = r;
      bestScore = score;
      bestCone = cone;
    }
  }
  return best;
}
