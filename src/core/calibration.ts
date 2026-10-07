/** Calibration math: tap along to a metronome, average how late (positive) or early the taps are. */

export interface CalibrationResult {
  ok: boolean;
  offsetMs: number; // average tap - beat; positive = taps late
  count: number;
  spreadMs: number; // standard deviation
}

/** For each tap, the signed offset to the nearest beat, dropping taps further than `windowMs` from any beat. */
export function tapOffsets(taps: number[], beats: number[], windowMs: number): number[] {
  const out: number[] = [];
  if (beats.length === 0) return out;
  for (const t of taps) {
    let best = Infinity;
    for (const b of beats) {
      const d = t - b;
      if (Math.abs(d) < Math.abs(best)) best = d;
    }
    if (Math.abs(best) <= windowMs) out.push(best);
  }
  return out;
}

export function computeCalibration(offsets: number[], minTaps = 8): CalibrationResult {
  let vals = offsets.slice();
  // Trim the single most extreme value on each side when there are plenty of taps.
  if (vals.length >= 10) {
    vals.sort((a, b) => a - b);
    vals = vals.slice(1, -1);
  }
  const count = vals.length;
  if (count === 0) return { ok: false, offsetMs: 0, count: 0, spreadMs: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / count;
  const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / count;
  return { ok: offsets.length >= minTaps, offsetMs: Math.round(mean), count: offsets.length, spreadMs: Math.round(Math.sqrt(variance)) };
}
