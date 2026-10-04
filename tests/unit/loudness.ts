// Loudness measurement for rendered sounds: ITU-R BS.1770 K-weighting, short-window loudness, peak, and a crude
// "phone speaker" filter (4th-order high-pass at 300 Hz: an iPhone speaker barely reproduces anything below).

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

function run(x: Float32Array, f: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = f.b0 * x[i] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** BS.1770 stage 1 (high shelf) and stage 2 (high-pass), for any sample rate. */
function kWeighting(fs: number): Biquad[] {
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Q1 = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q1 + K * K;
  const shelf = { b0: (Vh + (Vb * K) / Q1 + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q1 + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q1 + K * K) / a0 };
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const hp = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q2 + K * K) / a0 };
  return [shelf, hp];
}

function lowpass(fs: number, f0: number, q: number): Biquad {
  const w = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + alpha;
  return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
}

function highpass(fs: number, f0: number, q: number): Biquad {
  const w = (2 * Math.PI * f0) / fs;
  const alpha = Math.sin(w) / (2 * q);
  const c = Math.cos(w);
  const a0 = 1 + alpha;
  return { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
}

export interface Measure {
  peak: number; // max |sample|
  loud: number; // max loudness over 100 ms windows (LUFS-style dB, K-weighted)
  mean: number; // power-average loudness of the 100 ms windows that aren't silent
  energy: number; // K-weighted energy (dB): loudness and length together
  phoneLoud: number; // the same, through the phone speaker filter
  phoneMean: number;
  phoneEnergy: number;
  lowEnergy: number; // energy below ~100 Hz (dB, unweighted): what headphones add and phone speakers lose
}

export function measure(channels: Float32Array[], fs: number): Measure {
  let peak = 0;
  for (const ch of channels) for (let i = 0; i < ch.length; i++) peak = Math.max(peak, Math.abs(ch[i]));
  const kw = kWeighting(fs);
  const phone = [highpass(fs, 300, 0.5412), highpass(fs, 300, 1.3066)];
  const stats = (filters: Biquad[]) => {
    const sq = new Float64Array(channels[0].length);
    for (const ch of channels) {
      let y = ch;
      for (const f of filters) y = run(y, f);
      for (let i = 0; i < y.length; i++) sq[i] += y[i] * y[i];
    }
    const win = Math.round(fs * 0.1);
    let max = 0;
    let sum = 0;
    let n = 0;
    let total = 0;
    for (let s = 0; s + win <= sq.length; s += win) {
      let e = 0;
      for (let i = s; i < s + win; i++) e += sq[i];
      total += e;
      const ms = e / win;
      max = Math.max(max, ms);
      if (ms > 1e-7) {
        sum += ms;
        n++;
      }
    }
    const db = (v: number) => -0.691 + 10 * Math.log10(Math.max(v, 1e-12));
    return { loud: db(max), mean: db(n ? sum / n : 0), energy: db(total / fs) };
  };
  const full = stats(kw);
  const ph = stats([...phone, ...kw]);
  const low = stats([lowpass(fs, 100, 0.5412), lowpass(fs, 100, 1.3066)]);
  return { peak, loud: full.loud, mean: full.mean, energy: full.energy, phoneLoud: ph.loud, phoneMean: ph.mean, phoneEnergy: ph.energy, lowEnergy: low.energy };
}

/** Seeded 0..1 random (mulberry32). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
