/** Finisher swipe classification (pure; distances in CSS px): a quick flick in any direction. */
export function isSwipe(dx: number, dy: number, elapsedMs: number, minDistPx: number, maxMs: number): boolean {
  return Math.hypot(dx, dy) >= minDistPx && elapsedMs <= maxMs;
}

/**
 * Whether a press may still become the finisher swipe. A press that started a hold is never a swipe (the finger stays
 * down, and sliding it a little while holding must not fire the finisher), and no swipe starts while a hold is held.
 */
export function swipeAllowed(holding: boolean, pressOutcome?: string): boolean {
  return !holding && pressOutcome !== 'hold';
}
