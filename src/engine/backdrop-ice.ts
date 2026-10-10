// The ice parts shared by the Frostpeaks' fight backdrops (backdrop-frost.ts), the act maps' frozen landscapes
// (art-map.ts) and Ashfell's backdrops: crystal shards, shard clusters and seracs. In a file of their own so the act
// maps (painted at boot) don't pull the Frostpeaks' backdrops into the main chunk (region-art.ts, docs/perf.md).
import { clamp01, hash, noise, pick, rng, type Pix, type Ramp } from './backdrop';

/**
 * A crystal (or ice) shard: a prism rising from (x, base) along a lean, its point at the top; a lit face on the left,
 * a bright ridge, a shaded face on the right, and an inner glow brightest low in its body.
 */
export function shard(p: Pix, x: number, base: number, hgt: number, wid: number, lean: number, r: Ramp, glow = 0.1): void {
  const tipAt = hgt - Math.max(2, wid * 0.9);
  for (let t = 0; t <= hgt; t++) {
    const y = base - t;
    const cx = x + lean * t;
    const half = t < tipAt ? wid / 2 : (wid / 2) * (1 - (t - tipAt) / (hgt - tipAt + 0.5));
    if (half < 0.3) {
      p.set(Math.round(cx), y, r[r.length - 2]);
      continue;
    }
    for (let xx = Math.floor(cx - half); xx <= Math.ceil(cx + half); xx++) {
      const u = (xx + 0.5 - cx) / half;
      if (u < -1.05 || u > 1.05) continue;
      let v = u < -0.3 ? 0.62 : u < 0.25 ? 0.46 : 0.24;
      if (Math.abs(u + 0.3) < 0.2) v = 0.86; // the ridge catches the light
      v += glow * (1 - t / hgt) + (t >= tipAt ? 0.08 : 0);
      if (u > 0.82 || u < -0.9) v -= 0.12;
      p.set(xx, y, pick(r, v, xx, y));
    }
  }
}

/** A cluster of shards fanning out from one foot (back ones first); returns the tips (for glints). */
export function cluster(p: Pix, x: number, base: number, size: number, r: Ramp, seed: number): Array<[number, number]> {
  const r2 = rng(seed);
  const n = 3 + Math.floor(r2() * 3);
  const list: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1) - 0.5;
    const hgt = size * (0.45 + (1 - Math.abs(f) * 1.6) * 0.55) * (0.8 + r2() * 0.35);
    list.push([x + f * size * 0.55 + (r2() - 0.5) * 2, hgt, Math.max(2.5, size * (0.27 + r2() * 0.12)), f * 0.7 + (r2() - 0.5) * 0.2]);
  }
  // the tallest stands at the back
  list.sort((a, b) => b[1] - a[1]);
  const tips: Array<[number, number]> = [];
  for (const [sx, hg, wd, ln] of list) {
    shard(p, sx, base, Math.round(hg), wd, ln, r, 0.12);
    tips.push([Math.round(sx + ln * hg), Math.round(base - hg)]);
  }
  return tips;
}


/**
 * A serac: a tower of glacier ice, narrowing a little as it rises, its top sheared off at a slant (`cut` px from
 * left to right); three flat faces (lit, front, shade), old layers banding it, snow on the cut. Returns its top.
 */
export function serac(p: Pix, x: number, base: number, hgt: number, wid: number, cut: number, r: Ramp, snow: Ramp, seed: number): [number, number] {
  let top0: [number, number] = [x, base - hgt];
  for (let y = Math.round(base - hgt - Math.abs(cut) - 2); y <= base; y++) {
    const t = clamp01((base - y) / hgt);
    const half = (wid / 2) * (1 - t * 0.22) + (noise(y * 0.3, 1, seed) - 0.5) * 1.2;
    for (let xx = Math.floor(x - half); xx <= Math.ceil(x + half); xx++) {
      const u = (xx + 0.5 - (x - half)) / (half * 2);
      if (u < 0 || u > 1) continue;
      const top = base - hgt + cut * (u - 0.5) + (noise(xx * 0.6, 2, seed) - 0.5) * 2;
      if (y < top) continue;
      if (y < top + 1) {
        p.set(xx, y, pick(snow, 0.8 - u * 0.4, xx, y));
        if (top0[1] > y) top0 = [xx, y];
        continue;
      }
      let v = u < 0.3 ? 0.68 : u < 0.64 ? 0.48 : 0.26;
      if (Math.abs(u - 0.3) < 0.05) v = 0.88; // the edge between the faces catches the light
      if ((y + Math.floor(hash(seed, 1, 7) * 5)) % 6 === 0) v -= 0.1; // the glacier's old layers
      if (noise(xx * 0.9, y * 0.06, seed + 3) > 0.7) v -= 0.14; // cracks
      p.set(xx, y, pick(r, v, xx, y, 0.15));
    }
  }
  return top0;
}
