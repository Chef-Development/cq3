/**
 * Maps wall-clock milliseconds (performance.now / event.timeStamp) to simulation milliseconds.
 * Sim time only advances while the clock is running (fight in progress, not paused).
 */
export class SimClock {
  private base = 0; // sim ms at the moment of the last resume
  private resumedAt: number | null = null; // wall ms of the last resume

  get running(): boolean {
    return this.resumedAt !== null;
  }

  now(wallMs: number): number {
    return this.toSim(wallMs);
  }

  /** Sim time for a wall timestamp. Timestamps from before the last resume clamp to the resume point. */
  toSim(wallMs: number): number {
    if (this.resumedAt === null) return this.base;
    return this.base + Math.max(0, wallMs - this.resumedAt);
  }

  resume(wallMs: number): void {
    if (this.resumedAt !== null) return;
    this.resumedAt = wallMs;
  }

  pause(wallMs: number): void {
    if (this.resumedAt === null) return;
    this.base = this.toSim(wallMs);
    this.resumedAt = null;
  }

  /** Re-anchor so that `wallMs` maps to `simMs` (used to drop time after a long hitch). */
  rebase(wallMs: number, simMs: number): void {
    this.base = simMs;
    if (this.resumedAt !== null) this.resumedAt = wallMs;
  }

  reset(simMs = 0): void {
    this.base = simMs;
    this.resumedAt = null;
  }
}

/** Sim time (seconds) at which a tap is judged: its wall timestamp mapped to sim time, minus the calibration offset. */
export function tapSimTime(clock: SimClock, wallTs: number, calibrationMs: number): number {
  return (clock.toSim(wallTs) - calibrationMs) / 1000;
}
