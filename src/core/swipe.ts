/** Swipe-up finisher gesture classification (pure; distances in CSS px, dy negative = up). */
export function isSwipeUp(dx: number, dy: number, elapsedMs: number, minDistPx: number, maxMs: number): boolean {
  const up = -dy;
  return up >= minDistPx && Math.abs(dx) <= up && elapsedMs <= maxMs;
}
