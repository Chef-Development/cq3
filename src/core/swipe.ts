/** Finisher swipe classification (pure; distances in CSS px): a quick flick in any direction. */
export function isSwipe(dx: number, dy: number, elapsedMs: number, minDistPx: number, maxMs: number): boolean {
  return Math.hypot(dx, dy) >= minDistPx && elapsedMs <= maxMs;
}
