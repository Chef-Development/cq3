// Original level backdrops, painted into pixel buffers at boot. Each theme gives a background texture
// (`bg_<theme>`, opaque, framing included), the framing trees alone (`frame_<theme>`, transparent elsewhere: drawn
// again above the drifting clouds), the dark foreground nearest the camera in FG_FRAMES sway frames
// (`fg_<theme>_<f>` in front of the actors, `fgo_<theme>_<f>` its last rows hanging over the top of the bar's band)
// and the spots the scene animates on top (torch flames). The light over all of it is in art-stage.ts.
//
// How the painting works (see docs/art-style.md): every layer is built from organic shapes (scalloped
// leaf clumps, ridged massifs, uneven masonry) lit from the top left and quantised onto short,
// hue-shifted ramps. Far layers are mixed toward the haze colour (atmospheric perspective). Ordered
// dithering is only used for broad gradients: sky, mist, light shafts and torch light.
import type Phaser from 'phaser';

export type Theme = 'forest' | 'ruins' | 'hollow' | 'pass' | 'caves' | 'glacier';
export const THEMES: Theme[] = ['forest', 'ruins', 'hollow', 'pass', 'caves', 'glacier'];
/** Greenmarch's themes are painted at boot (buildBackdrops); the Frostpeaks' (backdrop-frost.ts) the first time an
 *  act needs one (Stage.ensure). */
export const BOOT_THEMES: Theme[] = ['forest', 'ruins', 'hollow'];

export interface Backdrop {
  torches: Array<{ x: number; y: number }>; // flame base, game px
  /** Spots that twinkle now and then (ice, crystals, a hoard's gold), with their colour. */
  glints?: Array<{ x: number; y: number; c: number }>;
  /** Icicle tips where drops gather and fall. */
  drips?: Array<{ x: number; y: number }>;
}

// ------------------------------------------------------------------ colour + noise toolkit (also used by art-world.ts)

export type Col = number; // 0xRRGGBB
export type Ramp = Col[]; // dark -> light

export const col = (s: string): Col => parseInt(s.slice(1), 16);
export const ramp = (...s: string[]): Ramp => s.map(col);

export function mix(a: Col, b: Col, t: number): Col {
  const ar = a >> 16;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  return (
    (Math.round(ar + ((b >> 16) - ar) * t) << 16) |
    (Math.round(ag + (((b >> 8) & 255) - ag) * t) << 8) |
    Math.round(ab + ((b & 255) - ab) * t)
  );
}

/** Additive light (torch glow): a + l * k per channel. */
export function lighten(a: Col, l: Col, k: number): Col {
  const r = Math.min(255, (a >> 16) + Math.round((l >> 16) * k));
  const g = Math.min(255, ((a >> 8) & 255) + Math.round(((l >> 8) & 255) * k));
  const b = Math.min(255, (a & 255) + Math.round((l & 255) * k));
  return (r << 16) | (g << 8) | b;
}

export const haze = (r: Ramp, to: Col, t: number): Ramp => r.map((c) => mix(c, to, t));

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const bay = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** t (0..1) quantised to `steps` levels; `band` > 0 dithers that fraction of each step boundary. */
export function level(t: number, steps: number, x: number, y: number, band: number): number {
  const f = clamp01(t) * steps;
  const i = Math.min(steps - 1, Math.floor(f));
  const fr = f - i;
  const k = band > 0 ? clamp01((fr - 0.5) / band + 0.5) : fr >= 0.5 ? 1 : 0;
  return i + (k > bay(x, y) ? 1 : 0);
}

/** Value v (0..1) on a ramp, hard-edged or with a dithered band at each step. */
export const pick = (r: Ramp, v: number, x: number, y: number, band = 0): Col => r[level(v, r.length - 1, x, y, band)];

/** Dithered step toward `to` (mist, halos). */
export const fade = (c: Col, to: Col, t: number, x: number, y: number, steps = 3, band = 0.6): Col => {
  const q = level(t, steps, x, y, band) / steps;
  return q > 0 ? mix(c, to, q) : c;
};

export function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1. */
export function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s);
  const b = hash(xi + 1, yi, s);
  const c = hash(xi, yi + 1, s);
  const d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export const fbm = (x: number, y: number, s: number) => noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 7) * 0.28 + noise(x * 4.3, y * 4.3, s + 13) * 0.12;

export function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** RGB pixel buffer; -1 = transparent. */
export class Pix {
  readonly buf: Int32Array;
  constructor(
    readonly w: number,
    readonly h: number,
    fill: number,
  ) {
    this.buf = new Int32Array(w * h).fill(fill);
  }
  get(x: number, y: number): number {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.buf[y * this.w + x] : -1;
  }
  set(x: number, y: number, c: Col): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.buf[y * this.w + x] = c;
  }
  /** Recolour an existing pixel. */
  tint(x: number, y: number, f: (c: Col) => Col): void {
    const c = this.get(x, y);
    if (c >= 0) this.buf[y * this.w + x] = f(c);
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    if (LITTLE_ENDIAN) {
      // one write per pixel (the big world map layers paint a lot of pixels)
      const u = new Uint32Array(d.buffer, d.byteOffset, this.buf.length);
      for (let i = 0; i < this.buf.length; i++) {
        const v = this.buf[i];
        if (v >= 0) u[i] = (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0;
      }
    } else
      for (let i = 0; i < this.buf.length; i++) {
        const v = this.buf[i];
        if (v < 0) continue;
        d[i * 4] = v >> 16;
        d[i * 4 + 1] = (v >> 8) & 255;
        d[i * 4 + 2] = v & 255;
        d[i * 4 + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** An opaque colour as one 32-bit RGBA pixel (in the machine's byte order), for writing ImageData a word at a time. */
export const rgba32 = (v: Col, a = 255): number =>
  LITTLE_ENDIAN ? ((a << 24) | ((v & 255) << 16) | (v & 0xff00) | (v >> 16)) >>> 0 : ((v << 8) | a) >>> 0;

/** A w x h canvas whose pixels `paint` writes as 32-bit RGBA words (0 = transparent). */
export function wordCanvas(w: number, h: number, paint: (u: Uint32Array) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  paint(new Uint32Array(img.data.buffer, img.data.byteOffset, w * h));
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ shape painters

export interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface Mass {
  ramp: Ramp; // dark -> light
  seed: number;
  bump?: number; // scallop depth of each clump's rim
  tex?: number; // leafy break-up of the tone boundaries
  light?: number; // brightness offset
  vgrad?: number; // top of the mass brighter than its bottom
  shadow?: number; // shadow a clump casts on the clumps behind / below it
  form?: Blob; // overall volume, lit as one big sphere and blended with each clump's own light
  formMix?: number;
  frontLow?: boolean; // lower clumps overlap upper ones (hills) instead of the reverse (crowns, clouds)
  outline?: Col; // bottom/right silhouette edge
  floor?: number; // clip below this y (flat-bottomed clouds, tree lines)
  band?: number; // dither band between tones
}

const LIGHT = (() => {
  const v = [-0.5, -0.72, 0.5];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n);
})();

export function lambert(nx: number, ny: number): number {
  const r2 = nx * nx + ny * ny;
  const s = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  return nx * s * LIGHT[0] + ny * s * LIGHT[1] + nz * LIGHT[2];
}

/**
 * A mass of overlapping round clumps (tree crowns, bushes, clouds, hills). Upper clumps overlap the ones
 * below and cast a curved shadow on them, which gives the scalloped look; each clump is lit like a small
 * sphere from the top left and its rim is scalloped into leaf bumps.
 */
export function mass(p: Pix, blobs: Blob[], o: Mass): void {
  if (!blobs.length) return;
  const order = blobs.slice().sort((a, b) => (o.frontLow ? a.y - b.y : b.y - a.y));
  const bump = o.bump ?? 0.16;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const b of order) {
    x0 = Math.min(x0, b.x - b.rx * (1 + bump) - 1);
    x1 = Math.max(x1, b.x + b.rx * (1 + bump) + 1);
    y0 = Math.min(y0, b.y - b.ry * (1 + bump) - 1);
    y1 = Math.max(y1, b.y + b.ry * (1 + bump) + 1);
  }
  const top = y0;
  const bot = Math.min(y1, o.floor ?? y1);
  x0 = Math.max(0, Math.floor(x0));
  x1 = Math.min(p.w - 1, Math.ceil(x1));
  y0 = Math.max(0, Math.floor(y0));
  y1 = Math.min(p.h - 1, Math.ceil(o.floor ?? y1));
  if (x1 < x0 || y1 < y0) return;
  const bw = x1 - x0 + 1;
  const own = new Int16Array(bw * (y1 - y0 + 1)).fill(-1);
  order.forEach((b, k) => {
    const nb = Math.max(4, Math.round((b.rx + b.ry) * 0.8));
    const ph = hash(k, 3, o.seed) * 6.283;
    const ex = Math.ceil(b.rx * (1 + bump));
    const ey = Math.ceil(b.ry * (1 + bump));
    for (let y = Math.max(y0, Math.floor(b.y) - ey); y <= Math.min(y1, Math.ceil(b.y) + ey); y++)
      for (let x = Math.max(x0, Math.floor(b.x) - ex); x <= Math.min(x1, Math.ceil(b.x) + ex); x++) {
        const dx = (x + 0.5 - b.x) / b.rx;
        const dy = (y + 0.5 - b.y) / b.ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1 + bump) continue;
        if (bump > 0 && d > 1 - bump && d > 1 + bump * (2 * Math.abs(Math.sin(Math.atan2(dy, dx) * nb * 0.5 + ph)) - 1)) continue;
        own[(y - y0) * bw + (x - x0)] = k;
      }
  });
  const at = (x: number, y: number) => (x < x0 || x > x1 || y < y0 || y > y1 ? -2 : own[(y - y0) * bw + (x - x0)]);
  const outside = (x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h && at(x, y) < 0;
  const shadow = o.shadow ?? 0.28;
  const tex = o.tex ?? 0.3;
  const vgrad = o.vgrad ?? 0.2;
  const light = o.light ?? 0;
  const fm = o.form ? (o.formMix ?? 0.55) : 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const k = at(x, y);
      if (k < 0) continue;
      const b = order[k];
      let lam = lambert((x + 0.5 - b.x) / b.rx, (y + 0.5 - b.y) / b.ry);
      if (o.form) lam = lam * (1 - fm) + lambert((x + 0.5 - o.form.x) / o.form.rx, (y + 0.5 - o.form.y) / o.form.ry) * fm;
      let v = 0.3 + 0.5 * lam + light + vgrad * (0.5 - (y - top) / Math.max(1, bot - top));
      if (shadow > 0 && (at(x - 1, y - 2) > k || at(x, y - 2) > k || at(x - 1, y - 1) > k)) v -= shadow;
      v += tex * (noise(x * 0.6, y * 0.6, o.seed) - 0.5);
      const edge = o.outline !== undefined && (outside(x + 1, y) || outside(x, y + 1));
      p.set(x, y, edge ? o.outline! : pick(o.ramp, v, x, y, o.band ?? 0));
    }
}

/** Clumps filling an elliptical crown, on a jittered grid so the rim is evenly scalloped. */
export function crown(rnd: () => number, cx: number, cy: number, rx: number, ry: number, size: number): Blob[] {
  const out: Blob[] = [];
  const step = size * 1.05;
  for (let y = -ry + size * 0.7; y <= ry - size * 0.5; y += step * 0.85)
    for (let x = -rx + size * 0.6; x <= rx - size * 0.6; x += step) {
      const jx = x + (rnd() - 0.5) * size * 0.6;
      const jy = y + (rnd() - 0.5) * size * 0.5;
      if ((jx * jx) / (rx * rx) + (jy * jy) / (ry * ry) > 0.85) continue;
      const r = size * (0.8 + rnd() * 0.45);
      out.push({ x: cx + jx, y: cy + jy, rx: r, ry: r * 0.9 });
    }
  if (!out.length) out.push({ x: cx, y: cy, rx: Math.max(rx, 1.5), ry: Math.max(ry, 1.5) });
  return out;
}

/** Leafy crown lit as one volume (clump light blended with the whole crown's). */
export function tree(p: Pix, rnd: () => number, cx: number, cy: number, rx: number, ry: number, size: number, o: Mass): void {
  mass(p, crown(rnd, cx, cy, rx, ry, size), { form: { x: cx - rx * 0.1, y: cy, rx: rx * 1.1, ry: ry * 1.1 }, ...o });
}

/** Conifer: tiers of drooping, scalloped boughs, wider toward the base. */
export function conifer(p: Pix, rnd: () => number, cx: number, base: number, hgt: number, wid: number, o: Mass): void {
  const out: Blob[] = [];
  const tiers = Math.max(3, Math.round(hgt / 3.4));
  for (let t = 0; t < tiers; t++) {
    const f = (t + 1) / tiers;
    const y = base - hgt + 2 + f * (hgt - 3);
    const half = Math.max(1.2, wid * 0.5 * (0.2 + 0.8 * f));
    const r = 1.5 + f * 1.6;
    const n = Math.max(1, Math.round((half * 2) / (r * 1.4)));
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? cx : cx - half + r * 0.7 + ((half * 2 - r * 1.4) * i) / (n - 1);
      const droop = (Math.abs(x - cx) / (half + 1)) * 1.5;
      out.push({ x: x + (rnd() - 0.5) * 0.6, y: y + droop - 1, rx: r, ry: r * 0.75 });
    }
  }
  out.push({ x: cx, y: base - hgt + 1.8, rx: 1.1, ry: 2 });
  mass(p, out, { form: { x: cx - wid * 0.1, y: base - hgt * 0.5, rx: wid * 0.6, ry: hgt * 0.6 }, formMix: 0.6, ...o });
}

export interface TrunkOpts {
  ramp: Ramp;
  seed: number;
  outline?: Col;
  moss?: Ramp;
  flare?: number;
  wobble?: number;
}

/** Tree trunk lit from the left with vertical bark grooves, optional moss and a root flare. */
export function trunk(p: Pix, cx0: number, yTop: number, yBot: number, wTop: number, wBot: number, lean: number, o: TrunkOpts): void {
  for (let y = Math.floor(yTop); y < yBot; y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const cx = cx0 + lean * t + (noise(y * 0.07, 1, o.seed) - 0.5) * (o.wobble ?? 3);
    const fl = (o.flare ?? 0) * Math.pow(Math.max(0, t - 0.72) / 0.28, 2);
    const half = (wTop + (wBot - wTop) * t) / 2 + fl;
    const xl = Math.round(cx - half);
    const xr = Math.round(cx + half);
    for (let x = xl; x <= xr; x++) {
      const u = (x - xl) / Math.max(1, xr - xl);
      let v = 0.8 - u * 0.78;
      const g = noise(x * 0.55, y * 0.08, o.seed + 5);
      if (g > 0.63) v -= 0.3;
      else if (g < 0.3) v += 0.12;
      let c = pick(o.ramp, v, x, y, 0.12);
      if (o.moss && u < 0.5 && noise(x * 0.45, y * 0.2, o.seed + 9) > 0.6) c = pick(o.moss, 0.95 - u * 1.2, x, y);
      if (o.outline !== undefined && (x === xl || x === xr)) c = o.outline;
      p.set(x, y, c);
    }
  }
}

/** A root curling out from a trunk base. */
export function root(p: Pix, x: number, y: number, dir: number, len: number, r: Ramp, outline: Col): void {
  for (let i = 0; i < len; i++) {
    const yy = y + Math.round((i / len) ** 1.6 * 4);
    const th = i < len * 0.5 ? 2 : 1;
    p.set(x + dir * i, yy - th, r[r.length - 2]);
    if (th > 1) p.set(x + dir * i, yy - 1, r[1]);
    p.set(x + dir * i, yy, outline);
  }
}

/** Mountain massif: peak (x, y), slopes in px down per px across; lit face left of a wobbly ridge. */
export function massif(p: Pix, mx: number, my: number, sl: number, sr: number, base: number, r: Ramp, seed: number, snow?: Ramp): void {
  const xa = Math.floor(mx - (base - my) / sl);
  const xb = Math.ceil(mx + (base - my) / sr);
  for (let x = Math.max(0, xa); x <= Math.min(p.w - 1, xb); x++) {
    const rough = (fbm(x * 0.13, 0.5, seed) - 0.5) * 6;
    const top = Math.round(my + (x < mx ? (mx - x) * sl : (x - mx) * sr) + rough * Math.min(1, Math.abs(x - mx) / 6));
    const snowLine = my + 5 + (noise(x * 0.35, 1, seed) - 0.5) * 5;
    for (let y = Math.max(0, top); y <= base && y < p.h; y++) {
      const ridge = mx + (y - my) * 0.3 + (noise(y * 0.15, 2, seed) - 0.5) * 6;
      const lit = x < ridge;
      let v = lit ? 0.85 : 0.45;
      // gullies run down the lit face parallel to the slope
      if (noise((x - mx) * 0.32 + (y - my) * 0.45, y * 0.05, seed + 3) > 0.66) v -= 0.4;
      if (snow && y < snowLine) p.set(x, y, lit ? snow[1] : snow[0]);
      else p.set(x, y, pick(r, v, x, y, 0.15));
    }
  }
}

/** Grass tuft: 3-5 blades fanning out, lit blades on the left. */
export function tuft(p: Pix, x: number, y: number, hgt: number, r: Ramp, seed: number): void {
  const n = 3 + Math.floor(hash(x, y, seed) * 3);
  for (let i = 0; i < n; i++) {
    const off = i - (n - 1) / 2;
    const bh = Math.max(1, Math.round(hgt - Math.abs(off) * 1.1 + (hash(i, x, seed) - 0.5) * 2));
    for (let k = 0; k < bh; k++) {
      const bx = x + Math.round(off * (0.6 + (k / bh) * 0.7));
      const c = k === bh - 1 ? (off <= 0 ? r[3] : r[2]) : k < bh * 0.4 ? r[0] : off < 0 ? r[2] : r[1];
      p.set(bx, y - 1 - k, c);
    }
  }
}

/** Small stone: lit top-left, contact shadow under it. */
export function pebble(p: Pix, x: number, y: number, rw: number, rh: number, r: Ramp, shadow: Col): void {
  for (let yy = -rh; yy <= rh; yy++)
    for (let xx = -rw; xx <= rw; xx++) {
      if ((xx * xx) / (rw * rw + 0.4) + (yy * yy) / (rh * rh + 0.4) > 1) continue;
      const v = 0.55 - (xx / (rw + 0.5)) * 0.25 - (yy / (rh + 0.5)) * 0.4;
      p.set(x + xx, y + yy, pick(r, v, x + xx, y + yy));
    }
  for (let xx = -rw + 1; xx <= rw; xx++) p.set(x + xx, y + rh + 1, shadow);
}

/** Boulder: a lumpy dome standing on `base`, lit from the top left, with a moss cap and contact shadow. */
export function rock(p: Pix, cx: number, base: number, rx: number, ry: number, r: Ramp, moss: Ramp, shadow: Col, seed: number): void {
  const topAt = (x: number) => {
    const dx = (x + 0.5 - cx) / rx;
    return Math.abs(dx) >= 1 ? Infinity : base - ry * Math.sqrt(1 - dx * dx) * (0.85 + noise(x * 0.5, 1, seed) * 0.3);
  };
  for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
    const t = topAt(x);
    for (let y = Math.ceil(t); y < base; y++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - (base - ry * 0.35)) / ry;
      let v = 0.35 + 0.55 * lambert(nx, ny * 1.2) + (noise(x * 0.6, y * 0.6, seed) - 0.5) * 0.2;
      if (y - t < 1.5 && nx < 0.35) {
        p.set(x, y, pick(moss, 0.6 + v * 0.4, x, y)); // moss cap on the lit top
        continue;
      }
      if (x === Math.round(cx + rx * 0.25) && y > t + 2) v -= 0.3; // a crack
      if (y >= base - 1) v -= 0.25; // occlusion where it meets the ground
      p.set(x, y, pick(r, v, x, y));
    }
  }
  for (let x = Math.floor(cx - rx); x <= cx + rx + 1; x++) p.set(x, base, shadow);
}

/** Light shafts from the top left: solid cores with ordered-dither edges that lift the colours below. */
export function shafts(p: Pix, list: Array<[number, number, number]>, slope: number, y0: number, y1: number, to: Col, amt: number): void {
  for (let y = y0; y < y1; y++) {
    const f = Math.min(1, (y - y0 + 2) / 10, ((y1 - y) / (y1 - y0)) * 2.2);
    for (const [sx, sw, sa] of list) {
      const cx = sx + (y - y0) * slope;
      for (let x = Math.floor(cx - sw / 2); x <= Math.ceil(cx + sw / 2); x++) {
        const u = Math.abs(x + 0.5 - cx) / (sw / 2);
        if (u > 1) continue;
        if (clamp01((1 - u) * 3.5) * f > bay(x, y)) p.tint(x, y, (c) => mix(c, to, amt * sa));
      }
    }
  }
}

/** Warm torch light pooled around a point (static part; the scene adds a flickering glow on top). */
export function torchLight(p: Pix, cx: number, cy: number, rx: number, ry: number, warm: Col, k: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const q = level((1 - d) ** 1.4, 3, x, y, 0.3) / 3;
      if (q > 0) p.tint(x, y, (c) => lighten(c, warm, q * k));
    }
}

/** Hanging vine / moss strand with leaf pairs. */
export function vine(p: Pix, x: number, y: number, len: number, r: Ramp, seed: number): void {
  for (let i = 0; i < len; i++) {
    const vx = x + Math.round(Math.sin(i * 0.45 + seed) * 0.8);
    p.set(vx, y + i, i % 3 === 0 ? r[2] : r[1]);
    if (i % 3 === 1 && i < len - 1) {
      p.set(vx - 1, y + i, r[3]);
      p.set(vx + 1, y + i + 1, r[1]);
    }
  }
  p.set(x + Math.round(Math.sin(len * 0.45 + seed) * 0.8), y + len, r[2]);
}

/** Heavy leaf canopy over a top corner (dir = 1: left corner, -1: right), with hanging vines. */
export function cornerCanopy(p: Pix, cx: number, dir: number, reach: number, seed: number, leaf: Ramp, vines: Ramp): void {
  const r2 = rng(seed);
  const bl: Blob[] = [];
  for (let i = 0; i < 30; i++) {
    const t = Math.pow(r2(), 1.2);
    const r = 4 + (1 - t) * 5 + r2() * 2.5;
    bl.push({ x: cx + dir * t * reach, y: -4 + (1 - t) * 16 + r2() * 8 - t * 4, rx: r, ry: r * 0.82 });
  }
  mass(p, bl, {
    ramp: leaf,
    seed,
    bump: 0.2,
    tex: 0.3,
    vgrad: 0.05,
    light: -0.04,
    shadow: 0.3,
    outline: leaf[0],
    form: { x: cx + dir * reach * 0.35, y: 2, rx: reach * 0.7, ry: 22 },
    formMix: 0.35,
  });
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + r2() * 0.8;
    const vx = Math.round(cx + dir * t * reach * 0.95);
    let vy = 0;
    while (vy < p.h && leaf.includes(p.get(vx, vy))) vy++;
    if (vy > 1) vine(p, vx, vy - 2, 3 + Math.floor(r2() * 13 * (1 - t * 0.5)), vines, i + seed);
  }
}

/** Shade what was painted since `before` between y0 and y1, deepest at y1 (the foot of a tree line). */
export function understory(p: Pix, before: Int32Array, y0: number, y1: number, to: Col, amt: number, base = 0): void {
  for (let y = Math.max(0, y0); y < Math.min(p.h, y1 + 4); y++) {
    const k = base + (amt - base) * Math.pow(clamp01((y - y0) / (y1 - y0)), 1.4);
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      if (p.buf[i] !== before[i]) p.buf[i] = mix(p.buf[i], to, k);
    }
  }
}

/** Pixels that changed since `before` (the framing layer, drawn again above the drifting clouds). */
export function changed(p: Pix, before: Int32Array): Pix {
  const f = new Pix(p.w, p.h, -1);
  for (let i = 0; i < p.buf.length; i++) if (p.buf[i] !== before[i]) f.buf[i] = p.buf[i];
  return f;
}

// ------------------------------------------------------------------ forest (Level 1): bright woodland clearing

function forest(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(23);
  const hz = col('#d4ecf2');
  const skyR = ramp('#3d8ddc', '#56a4e6', '#74bbee', '#98cff2', '#bfe3f5');
  for (let y = 0; y < G - 14; y++) for (let x = 0; x < w; x++) p.set(x, y, pick(skyR, y / (G - 30), x, y, 0.22));

  // far mountains with snowy peaks, in the haze
  const mR = haze(ramp('#58809f', '#6c93b2', '#86a9c4', '#a2c0d6'), hz, 0.42);
  const snowR = haze(ramp('#b6cede', '#f2fafc'), hz, 0.15);
  for (const [fx, fy, sl, sr] of [
    [0.04, -52, 0.62, 0.7],
    [0.27, -60, 0.66, 0.55],
    [0.5, -51, 0.6, 0.7],
    [0.83, -63, 0.55, 0.62],
    [1.02, -54, 0.6, 0.6],
  ])
    massif(p, Math.round(fx * w), G + fy, sl, sr, G - 26, mR, Math.round(fx * 100), snowR);

  // cumulus bank wrapped around the mountain feet
  const cloudR = ramp('#a2b6da', '#bed0ea', '#dbeaf6', '#f4fbfd', '#ffffff');
  const cy = G - 38;
  for (let x = -14; x < w + 20; x += 24 + Math.floor(rnd() * 16)) {
    const bl: Blob[] = [];
    const len = 20 + rnd() * 26;
    const hgt = 4 + rnd() * 6;
    for (let i = 0; i < 7; i++) {
      const f = i / 6;
      const r = 3 + Math.sin(f * Math.PI) * hgt * (0.7 + rnd() * 0.4);
      bl.push({ x: x + f * len, y: cy + 3 - Math.sin(f * Math.PI) * hgt * 0.55, rx: r * 1.15, ry: r * 0.85 });
    }
    mass(p, bl, { ramp: cloudR, seed: 3 + x, bump: 0.12, tex: 0.1, vgrad: 0.5, light: 0.2, shadow: 0.14, floor: cy + 6, band: 0.3 });
  }

  // rolling hills with a castle (original design) on the highest one
  const hillR = haze(ramp('#3a7866', '#48886c', '#5a9a72', '#70ac7c', '#8abe88'), hz, 0.36);
  const kx = Math.round(w * 0.665);
  mass(
    p,
    [
      { x: w * 0.08, y: G - 25, rx: 46, ry: 9 },
      { x: w * 0.38, y: G - 24, rx: 54, ry: 8 },
      { x: kx + 4, y: G - 27, rx: 34, ry: 11 },
      { x: w * 0.97, y: G - 24, rx: 44, ry: 9 },
    ],
    { ramp: hillR, seed: 41, bump: 0.03, tex: 0.18, vgrad: 0.35, light: 0.12, shadow: 0, frontLow: true, floor: G - 14 },
  );
  const kb = G - 36;
  const wallR = haze(ramp('#6e7c92', '#8898ac', '#a6b4c2', '#c4ced6'), hz, 0.3);
  const roofR = haze(ramp('#3c4e7a', '#55689a', '#7084b0'), hz, 0.25);
  const tower = (tx: number, tw: number, th: number, roofH: number) => {
    for (let y = kb - th; y < kb + 3; y++)
      for (let x = tx; x < tx + tw; x++) p.set(x, y, x === tx ? wallR[3] : x >= tx + tw - 2 ? wallR[1] : wallR[2]);
    for (let i = 0; i < roofH; i++) {
      const half = ((i + 1) / roofH) * (tw / 2 + 1);
      for (let x = Math.round(tx + tw / 2 - half); x < Math.round(tx + tw / 2 + half); x++) p.set(x, kb - th - roofH + i, x < tx + tw / 2 - 0.5 ? roofR[2] : roofR[0]);
    }
    p.set(Math.floor(tx + tw / 2), kb - th - roofH - 1, roofR[1]);
    p.set(tx + Math.floor(tw / 2), kb - th + 3, roofR[0]);
    p.set(tx + Math.floor(tw / 2), kb - th + 4, roofR[0]);
  };
  for (let y = kb - 8; y < kb + 3; y++) for (let x = kx - 14; x < kx + 12; x++) p.set(x, y, y === kb - 8 ? wallR[3] : x > kx + 4 ? wallR[1] : wallR[2]);
  for (let x = kx - 14; x < kx + 12; x += 3) {
    p.set(x, kb - 9, wallR[3]);
    p.set(x + 1, kb - 9, wallR[2]);
  }
  tower(kx - 18, 6, 15, 6);
  tower(kx + 11, 6, 13, 5);
  tower(kx - 5, 8, 20, 8);
  for (let y = kb - 34; y < kb - 28; y++) p.set(kx - 1, y, wallR[0]);
  for (const [x, y] of [
    [kx, kb - 34],
    [kx + 1, kb - 34],
    [kx, kb - 33],
    [kx + 1, kb - 33],
    [kx + 2, kb - 33],
  ])
    p.set(x, y, col('#e0503c'));
  for (let y = kb - 3; y < kb + 3; y++) for (let x = kx - 2; x < kx + 1; x++) p.set(x, y, roofR[0]);
  // little trees dotted on the hills
  const hillTreeR = haze(ramp('#2a5e4a', '#3a7454', '#4e8a5c'), hz, 0.3);
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * w);
    if (Math.abs(x - kx) < 22) continue;
    let y = G - 40;
    while (y < G - 18 && skyR.includes(p.get(x, y))) y++;
    if (y >= G - 18 || y < G - 36) continue;
    mass(p, crown(rnd, x, y + 1, 2.5, 2, 1.6), { ramp: hillTreeR, seed: i, bump: 0.1, tex: 0.1, vgrad: 0.4, shadow: 0.2 });
  }

  // far tree line, tinted toward the sky; the understory below it stays in shade
  const farT = haze(ramp('#245a4a', '#2f6c52', '#3f8058', '#559462', '#6ea86c'), hz, 0.3);
  const farB: Blob[] = [];
  for (let x = -6; x < w + 6; x += 4 + rnd() * 3) farB.push({ x, y: G - 22 - rnd() * 4, rx: 3.5 + rnd() * 2.5, ry: 3.2 + rnd() * 2 });
  mass(p, farB, { ramp: farT, seed: 7, bump: 0.18, tex: 0.22, vgrad: 0.4, light: 0.06, floor: G - 15 });
  for (let x = 14; x < w; x += 26 + rnd() * 34) conifer(p, rnd, x, G - 17, 13 + rnd() * 6, 7, { ramp: farT, seed: 8, bump: 0.15, tex: 0.15, vgrad: 0.2, floor: G - 15 });
  for (let y = G - 22; y < G - 14; y++) for (let x = 0; x < w; x++) if (skyR.includes(p.get(x, y))) p.set(x, y, farT[1]);

  // meadow: in shade under the trees, brighter toward the path
  const meadowR = ramp('#2a6234', '#376f37', '#468239', '#58973e', '#6eab45', '#89bd4d');
  const mTop = G - 17;
  for (let y = mTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - mTop) / (G - 7 - mTop);
      const v = 0.12 + t * 0.62 + (fbm(x * 0.07, y * 0.22, 11) - 0.5) * 0.4;
      p.set(x, y, pick(meadowR, v, x, y, 0.25));
    }

  // mid tree line: individual trees with varied silhouettes, a hazier row behind a nearer one
  const leafR = ramp('#183e30', '#22543a', '#306c42', '#43864a', '#5ea052', '#80ba5a');
  const barkR = ramp('#22170f', '#382616', '#52381f', '#6c4b2a');
  const leafLight = ramp('#24502e', '#336a34', '#4a863a', '#68a042', '#8cba4c', '#b2d25e');
  const leafDeep = ramp('#14352e', '#1c4a38', '#286240', '#367a48', '#4c9250', '#68aa58');
  const plant = (base: number, hzAmt: number, s: number, gapMin: number, gapRand: number, seed: number) => {
    const r2 = rng(seed);
    const jobs: Array<[number, () => void]> = [];
    for (let x = -6 + r2() * 8; x < w + 10; ) {
      const kind = r2();
      const tint = r2();
      const lr = haze(tint < 0.68 ? leafR : tint < 0.86 ? leafLight : leafDeep, hz, hzAmt);
      const tx = Math.round(x);
      if (kind < 0.28) {
        const hg = (17 + r2() * 9) * s;
        const wd = (10 + r2() * 4) * s;
        jobs.push([hg, () => conifer(p, r2, tx, base + 1, hg, wd, { ramp: lr, seed: tx, bump: 0.16, tex: 0.22, vgrad: 0.2 })]);
        x += wd * 0.75 + gapMin + r2() * gapRand;
      } else if (kind < 0.42) {
        const hg = (17 + r2() * 7) * s;
        const rx = (3.6 + r2()) * s;
        jobs.push([
          hg,
          () => {
            trunk(p, tx, base - 6, base + 1, 1.5, 2, 0, { ramp: barkR, seed: tx, wobble: 1 });
            tree(p, r2, tx, base - 4 - hg / 2, rx, hg / 2, 2.6, { ramp: lr, seed: tx, bump: 0.2, tex: 0.25, vgrad: 0.2 });
          },
        ]);
        x += rx * 1.6 + gapMin + r2() * gapRand;
      } else {
        const rx = (7 + r2() * 5) * s;
        const ry = (6 + r2() * 3) * s;
        const cyy = base - 5 * s - ry * 0.75 - r2() * 3;
        jobs.push([
          ry * 2,
          () => {
            trunk(p, tx, cyy, base + 1, 2, 3, 0, { ramp: barkR, seed: tx, flare: 1, wobble: 1.5 });
            tree(p, r2, tx, cyy, rx, ry, 3.1, { ramp: lr, seed: tx, bump: 0.2, tex: 0.28, vgrad: 0.2 });
          },
        ]);
        x += rx * 1.25 + gapMin + r2() * gapRand;
      }
    }
    jobs.sort((a, b) => b[0] - a[0]);
    for (const [, job] of jobs) job();
  };
  const beforeTrees = p.buf.slice();
  plant(G - 18, 0.2, 1.1, 0, 4, 31);
  plant(G - 15, 0, 0.95, 6, 22, 37);
  // the woods fall into cool shade toward their feet; only the crowns' tops stay in the sun
  understory(p, beforeTrees, G - 52, G - 13, col('#0a1c26'), 0.72, 0.16);
  // bushes along the foot of the tree line
  const bushR = ramp('#1d4630', '#295c36', '#39763c', '#4f9046', '#6eac52');
  for (let x = 4; x < w; x += 16 + rnd() * 26) {
    const rx = 4 + rnd() * 4;
    tree(p, rnd, x, G - 15, rx, 3.5, 2.3, { ramp: bushR, seed: Math.round(x) + 1, bump: 0.2, tex: 0.25, vgrad: 0.3, floor: G - 13 });
  }
  // the meadow behind the path lies in the trees' shade
  for (let y = mTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) p.tint(x, y, (c) => mix(c, col('#0c2426'), 0.5 - ((y - mTop) / (G - 7 - mTop)) * 0.22));
  // grass tufts and flower clusters in the meadow
  const tuftR = ramp('#2e6a32', '#3e8038', '#5a9c42', '#86c052');
  for (let i = 0; i < 44; i++) tuft(p, Math.floor(rnd() * w), mTop + 5 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 2), tuftR, i);
  const petals = ramp('#fff4e0', '#ffd860', '#ff9cc0', '#c8b4ff');
  for (let i = 0; i < 13; i++) {
    const fx = Math.floor(rnd() * w);
    const fy = mTop + 5 + Math.floor(rnd() * 5);
    const pc = petals[i % petals.length];
    for (let k = 0; k < 5 + Math.floor(rnd() * 4); k++) {
      const x = fx + Math.floor((rnd() - 0.5) * 10);
      const y = fy + Math.floor((rnd() - 0.5) * 3);
      p.set(x, y + 1, meadowR[1]);
      p.set(x, y, pc);
    }
  }
  // mossy boulders
  const rockR = ramp('#4a5462', '#66717e', '#87909c', '#acb3bb');
  const mossR = ramp('#3a7434', '#55903e', '#78ae48');
  rock(p, Math.round(w * 0.2), G - 8, 6, 8, rockR, mossR, meadowR[0], 4);
  rock(p, Math.round(w * 0.2) + 7, G - 8, 3, 3, rockR, mossR, meadowR[0], 6);

  // a crooked old fence on the enemies' side
  const woodR = ramp('#3e2616', '#5c3a20', '#7e5530', '#a07444', '#bc915a');
  const fx0 = Math.round(w * 0.6);
  const fx1 = Math.round(w * 0.92);
  const posts: Array<[number, number]> = [];
  for (let x = fx0; x <= fx1; x += 9 + Math.floor(rnd() * 3)) posts.push([x, G - 16 - Math.floor(rnd() * 2)]);
  for (const ry of [3, 7])
    for (let i = 0; i + 1 < posts.length; i++) {
      if (ry === 3 && i === 1) continue; // a broken rail
      const [ax, ay] = posts[i];
      const [bx, by] = posts[i + 1];
      for (let x = ax; x <= bx; x++) {
        const t = (x - ax) / (bx - ax);
        const y = Math.round(ay + (by - ay) * t + ry + Math.sin(t * Math.PI) * 0.8);
        p.set(x, y, woodR[3]);
        p.set(x, y + 1, woodR[1]);
      }
    }
  for (const [x, y] of posts) {
    for (let yy = y; yy < G - 7; yy++) {
      p.set(x, yy, woodR[3]);
      p.set(x + 1, yy, woodR[1]);
    }
    p.set(x, y - 1, woodR[4]);
    p.set(x + 1, y - 1, woodR[2]);
    p.set(x, y, mossR[1]);
    tuft(p, x + 1, G - 7, 3, tuftR, x);
  }

  // a short, weathered signpost at the meadow's edge pointing down the road to the castle (low: HP bars float above)
  {
    const px = Math.round(w * 0.47);
    const base = G - 8;
    const outl = col('#2a1810');
    for (let y = base - 10; y < base; y++) {
      p.set(px, y, woodR[3]);
      p.set(px + 1, y, woodR[1]);
      p.set(px + 2, y, outl);
    }
    const board = (x0: number, x1: number, y0: number, dir: number) => {
      for (let y = y0; y < y0 + 4; y++)
        for (let x = x0; x <= x1; x++) {
          const tip = dir > 0 ? x1 - x : x - x0; // the pointed end
          if (tip < 2 && (y === y0 || y === y0 + 3) && tip < 1) continue;
          const edgeB = y === y0 + 3 || (dir > 0 ? tip === 0 && y !== y0 + 1 && y !== y0 + 2 : x === x1);
          let c = y === y0 ? woodR[4] : y === y0 + 3 ? woodR[1] : woodR[2 + (hash(x, y, 5) > 0.7 ? 1 : 0)];
          if (edgeB) c = outl;
          if (y === y0 + 1 + (x % 3 === 0 ? 1 : 0) && x > x0 + 2 && x < x1 - 2 && hash(x, 7, 3) > 0.45) c = woodR[0]; // carved letters
          p.set(x, y, c);
        }
    };
    board(px - 4, px + 8, base - 9, 1);
    p.set(px, base - 11, woodR[4]);
    p.set(px + 1, base - 11, woodR[2]);
    for (let x = px - 2; x <= px + 4; x++) p.set(x, base, meadowR[0]);
    tuft(p, px - 1, base, 3, tuftR, 5);
    tuft(p, px + 3, base, 2, tuftR, 6);
  }

  // light shafts through the canopy gap
  shafts(
    p,
    [
      [44, 9, 0.9],
      [86, 5, 0.75],
      [126, 14, 0.85],
      [190, 6, 0.6],
    ],
    0.55,
    0,
    G - 8,
    col('#fffbe0'),
    0.16,
  );

  // the dirt path the fight happens on
  const dirtR = ramp('#6e4426', '#865834', '#9c6b42', '#b07f52', '#c19462', '#d2ab78');
  const pathTop = G - 8;
  for (let y = pathTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - pathTop) / (h - pathTop);
      let v = 0.62 - t * 0.14 + (fbm(x * 0.05, y * 0.3, 21) - 0.5) * 0.3;
      if ((y === G + 2 || y === G + 6) && noise(x * 0.12, y, 4) > 0.45) v -= 0.15;
      p.set(x, y, pick(dirtR, v, x, y, 0.2));
    }
  // dappled sunlight through the leaves: warm, irregular pools on the dirt
  for (let y = pathTop + 2; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = fbm(x * 0.075, y * 0.32, 33);
      if (n > 0.62) p.tint(x, y, (c) => fade(c, col('#f2d49c'), Math.min(1, (n - 0.62) * 4.5) * 0.55, x, y, 2, 0.7));
      else if (n < 0.36) p.tint(x, y, (c) => mix(c, col('#4a3020'), 0.16));
    }
  // worn wheel ruts: compacted, darker tracks with a sunlit lip on their far side, grass sprouting between them
  for (const ry of [G - 3, G + 3])
    for (let x = 0; x < w; x++) {
      if (noise(x * 0.08, ry * 0.5, 13) < 0.24) continue; // the track fades in and out
      const yy = ry + Math.round((noise(x * 0.025, ry, 9) - 0.5) * 2.4);
      p.set(x, yy - 1, pick(dirtR, 0.86, x, yy - 1, 0.5));
      p.set(x, yy, dirtR[1]);
      p.set(x, yy + 1, hash(x, yy, 3) > 0.5 ? dirtR[2] : dirtR[1]);
    }
  for (let i = 0; i < 16; i++) tuft(p, Math.floor(rnd() * w), G + 1, 1 + Math.floor(rnd() * 2), tuftR, i + 90);
  // grass edge overhanging the path, with a soft shadow under it
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(noise(x * 0.35, 5, 6) * 2.4) + (hash(x, 9, 1) > 0.75 ? 1 : 0);
    for (let k = 0; k < len; k++) p.set(x, pathTop + k, k === len - 1 ? meadowR[2] : meadowR[3 + (hash(x, k, 3) > 0.5 ? 1 : 0)]);
    p.set(x, pathTop + len, dirtR[1]);
    if (hash(x, 4, 4) > 0.5) p.set(x, pathTop + len + 1, dirtR[2]);
  }
  // pebbles, cracks and stray grass, kept off the line the actors stand on
  const pebR = ramp('#7a5a3e', '#a08060', '#c4a682', '#e0c8a2');
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.4 ? G - 4 + Math.floor(rnd() * 2) : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    if (rnd() < 0.65) pebble(p, x, y, 1, 0, pebR, dirtR[1]);
    else {
      p.set(x, y, dirtR[1]);
      p.set(x + 1, y, dirtR[1]);
      p.set(x, y - 1, dirtR[4]);
    }
  }
  for (let i = 0; i < 6; i++) {
    let x = Math.floor(rnd() * w);
    let y = G + 4 + Math.floor(rnd() * 3);
    for (let k = 0; k < 4 + rnd() * 5; k++) {
      p.set(x, y, dirtR[1]);
      p.set(x, y + 1, dirtR[4]);
      x += 1;
      if (rnd() < 0.4) y += rnd() < 0.5 ? 1 : -1;
    }
  }
  for (let i = 0; i < 10; i++) tuft(p, Math.floor(rnd() * w), G + 5 + Math.floor(rnd() * (h - G - 5)), 2, tuftR, i + 50);
  // the framing trees shade the ground near the edges (cooler, darker)
  const shade = col('#203428');
  for (let y = mTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 40) p.tint(x, y, (c) => fade(c, shade, ((40 - e) / 40) ** 1.5 * 0.55, x, y, 3, 0.5));
    }

  // framing trees: thick trunks, heavy leaves over the top corners, hanging vines
  const frameLeaf = ramp('#0d1e17', '#153020', '#1e4428', '#2a5a30', '#3d7438', '#589040');
  const frameBark = ramp('#140e0a', '#24180f', '#382517', '#4e3420', '#684629');
  const trunkMoss = ramp('#1e4a26', '#2e6232', '#467e3a');
  const vineR = ramp('#163222', '#24502a', '#3a7034', '#5a9442');
  const ink = col('#140c1c');
  const before = p.buf.slice();
  trunk(p, 6, 0, G + 2, 15, 17, -1, { ramp: frameBark, seed: 3, outline: ink, moss: trunkMoss, flare: 5, wobble: 2 });
  trunk(p, w - 6, 0, G + 2, 14, 16, 1, { ramp: frameBark, seed: 9, outline: ink, moss: trunkMoss, flare: 5, wobble: 2 });
  root(p, 16, G - 1, 1, 9, frameBark, ink);
  root(p, 11, G, 1, 7, frameBark, ink);
  root(p, w - 16, G - 1, -1, 9, frameBark, ink);
  root(p, w - 10, G + 1, -1, 6, frameBark, ink);
  for (const [bx, by, dir, len] of [
    [12, 16, 1, 22],
    [w - 12, 12, -1, 26],
  ])
    for (let i = 0; i < len; i++) {
      const y = Math.round(by - i * 0.45 + Math.sin(i * 0.3) * 1.2);
      p.set(bx + dir * i, y, frameBark[3]);
      p.set(bx + dir * i, y + 1, frameBark[1]);
      if (i < len * 0.6) p.set(bx + dir * i, y + 2, ink);
    }
  cornerCanopy(p, 4, 1, 86, 5, frameLeaf, vineR);
  cornerCanopy(p, w - 4, -1, 86, 6, frameLeaf, vineR);
  const frame = changed(p, before);

  return [p, frame, { torches: [] }];
}

// ------------------------------------------------------------------ ruins (Level 2): moonlit, rainy, torches

function ruins(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(91);
  const hz = col('#4a6870');
  const skyR = ramp('#0f1630', '#141f3c', '#1a2a48', '#223852', '#2c485c', '#3a5a66');
  for (let y = 0; y < G - 14; y++) for (let x = 0; x < w; x++) p.set(x, y, pick(skyR, y / (G - 28), x, y, 0.25));

  // stars (deliberate sparkles) in the upper sky
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * (G - 50));
    p.set(x, y, rnd() < 0.3 ? col('#e8f0ff') : col('#8ea2c8'));
    if (i % 9 === 0)
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        p.set(x + dx, y + dy, col('#5a6e98'));
  }

  // moon with a dithered halo
  const mx = Math.round(w * 0.3);
  const my = G - 54;
  const mr = 7;
  for (let y = my - 24; y <= my + 24; y++)
    for (let x = mx - 28; x <= mx + 28; x++) {
      const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my);
      if (d <= mr + 0.5 || d > 26) continue;
      p.tint(x, y, (c) => fade(c, col('#6c8a9c'), Math.pow(1 - (d - mr) / 19, 2) * 0.8, x, y, 3, 0.7));
    }
  const moonR = ramp('#a8a690', '#cfcab0', '#ece6cc', '#fbf8ea');
  for (let y = -mr; y <= mr; y++)
    for (let x = -mr; x <= mr; x++) {
      if (Math.hypot(x, y) > mr + 0.2) continue;
      let v = 0.78 - (x / mr) * 0.22 - (y / mr) * 0.22;
      if (Math.hypot(x - 3, y + 2) > mr + 0.2 && x + y > 2) v -= 0.25; // shaded crescent
      if (Math.hypot(x - 2, y + 1) < 1.6 || Math.hypot(x + 3, y - 2) < 1.3 || Math.hypot(x, y - 4) < 1) v -= 0.22;
      p.set(mx + x, my + y, pick(moonR, v, mx + x, my + y));
    }

  // long night clouds, moonlit along their tops
  const nCloud = ramp('#1a2440', '#222f4a', '#2c3c56', '#3a4d64', '#55697c');
  for (const [cx0, cy0, len] of [
    [0.02, -46, 70],
    [0.35, -45, 50],
    [0.55, -60, 80],
    [0.74, -44, 66],
  ]) {
    const bl: Blob[] = [];
    const x0 = cx0 * w;
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const r = 2.5 + Math.sin(f * Math.PI) * 4 * (0.6 + rnd() * 0.5);
      bl.push({ x: x0 + f * len, y: G + cy0 - Math.sin(f * Math.PI) * 2, rx: r * 1.5, ry: r * 0.8 });
    }
    mass(p, bl, { ramp: nCloud, seed: Math.round(x0), bump: 0.1, tex: 0.15, vgrad: 0.5, light: 0.05, shadow: 0.12, floor: G + cy0 + 3, band: 0.3 });
  }

  // far wooded hills in the haze
  const farWood = haze(ramp('#16222e', '#1c2c38', '#243844', '#2e4650'), hz, 0.5);
  const fw: Blob[] = [];
  for (let x = -8; x < w + 8; x += 5 + rnd() * 5) fw.push({ x, y: G - 30 - Math.sin(x / 37) * 4 - rnd() * 4, rx: 5 + rnd() * 4, ry: 4 + rnd() * 3 });
  mass(p, fw, { ramp: farWood, seed: 3, bump: 0.18, tex: 0.2, vgrad: 0.5, light: 0.05, floor: G - 14 });

  // ruined spires rising out of the far wood
  const spire = (x: number, base: number, tw: number, th: number, kind: number, r: Ramp, seed: number, warm: boolean) => {
    const top = base - th;
    for (let y = top; y <= base; y++) {
      const ledge = (y - top) % 10 === 4;
      for (let xx = x - (ledge ? 1 : 0); xx < x + tw + (ledge ? 1 : 0); xx++) p.set(xx, y, ledge || xx <= x ? r[2] : xx >= x + tw - 2 ? r[0] : r[1]);
    }
    const mid = x + (tw - 1) / 2;
    if (kind === 0) {
      // pointed roof with a finial
      const rh = Math.round(tw * 1.5);
      for (let i = 0; i < rh; i++) {
        const half = ((i + 1) / rh) * (tw / 2 + 0.5);
        for (let xx = Math.round(mid - half); xx <= Math.round(mid + half); xx++) p.set(xx, top - rh + i, xx < mid ? r[2] : r[0]);
      }
      p.set(Math.round(mid), top - rh - 1, r[2]);
      p.set(Math.round(mid), top - rh - 2, r[2]);
    } else if (kind === 1) {
      // broken, jagged top
      for (let xx = 0; xx < tw; xx++) {
        const hh = Math.round((tw - xx) * 0.9 + noise(xx * 0.9, seed, seed) * 3);
        for (let k = 1; k <= hh; k++) p.set(x + xx, top - k, xx === 0 ? r[2] : r[1]);
      }
    } else if (kind === 2) {
      // crenellations
      for (let xx = 0; xx < tw; xx++) if (xx % 3 !== 2) p.set(x + xx, top - 1, xx === 0 ? r[2] : r[1]);
    } else {
      // dome
      const rr = tw / 2;
      for (let yy = 1; yy <= rr; yy++)
        for (let xx = 0; xx < tw; xx++) if (Math.hypot(xx + 0.5 - rr, yy - 0.5) <= rr) p.set(x + xx, top - yy, xx < rr - 1 ? r[2] : r[1]);
      p.set(Math.round(mid), top - Math.ceil(rr) - 1, r[2]);
    }
    for (let y = top + 3; y < base - 3; y += 7) {
      const wx = Math.round(mid);
      const lit = warm && y === top + 3;
      p.set(wx, y, lit ? col('#e8a050') : r[0]);
      p.set(wx, y + 1, lit ? col('#a8603a') : r[0]);
    }
  };
  const spR = haze(ramp('#1a2836', '#22323f', '#2e4450'), hz, 0.45);
  for (const [fx, tw, th, kind, warm] of [
    [0.13, 6, 30, 0, 0],
    [0.35, 5, 22, 1, 1],
    [0.5, 7, 34, 3, 0],
    [0.6, 4, 18, 0, 1],
    [0.88, 8, 28, 1, 0],
    [0.97, 5, 24, 2, 1],
  ])
    spire(Math.round(fx * w), G - 22, tw, th, kind, spR, Math.round(fx * 10), warm === 1);

  // mist in the distance
  for (let y = G - 36; y < G - 16; y++)
    for (let x = 0; x < w; x++) {
      const k = (1 - Math.abs(y - (G - 25)) / 11) * (0.65 + (fbm(x * 0.035, y * 0.15, 31) - 0.5) * 0.9);
      p.tint(x, y, (c) => fade(c, hz, k * 0.6, x, y, 3, 0.6));
    }

  // broken viaduct across the middle distance (pointed arches)
  const viaR = haze(ramp('#16222e', '#1e2e3a', '#283c48', '#34505a'), hz, 0.22);
  const vy = G - 33;
  const va = Math.round(w * 0.44);
  for (let x = va; x < Math.round(w * 0.98); x++) {
    const span = 17;
    const u = (x - va) % span;
    const broken = x > w * 0.66 && x < w * 0.75;
    const topY = vy + (broken ? 9 + Math.floor(noise(x * 0.5, 1, 5) * 6) : Math.floor(hash(x >> 2, 2, 5) * 2));
    for (let y = topY; y < G - 16; y++) {
      const ax = u - span / 2 - 1.5;
      const inArch = u > 3 && y > vy + 4 && (y >= vy + 12 ? Math.abs(ax) < 5.5 : Math.hypot(ax + 2.5, y - (vy + 12)) < 8 && Math.hypot(ax - 2.5, y - (vy + 12)) < 8);
      if (inArch) continue;
      p.set(x, y, y === topY ? viaR[3] : y === vy + 3 ? viaR[0] : u <= 1 ? viaR[2] : viaR[1]);
    }
  }

  // nearer wood line
  const nearWood = haze(ramp('#0e1820', '#14222a', '#1a2e34', '#223c40', '#2c4c4c'), hz, 0.18);
  const nw: Blob[] = [];
  for (let x = -6; x < w + 6; x += 4 + rnd() * 5) nw.push({ x, y: G - 19 - rnd() * 3 - (noise(x * 0.04, 1, 5) > 0.55 ? 4 : 0), rx: 4 + rnd() * 3, ry: 3.5 + rnd() * 2.5 });
  for (let x = -4; x < w + 6; x += 5 + rnd() * 3) nw.push({ x, y: G - 15, rx: 4.5, ry: 3.5 });
  mass(p, nw, { ramp: nearWood, seed: 9, bump: 0.2, tex: 0.25, vgrad: 0.4, light: -0.02, floor: G - 14 });

  // stone painter for the nearer ruins: coursed blocks, moonlit top/left edges, moss on the ledges
  const stoneR = ramp('#101a24', '#182632', '#223540', '#2e4650', '#3e5c66', '#587a80');
  const mossR = ramp('#142c28', '#1c3e32', '#28543c', '#386a46');
  const masonry = (x0: number, x1: number, yTop: (x: number) => number, yBot: number, hole: (x: number, y: number) => boolean, seed: number) => {
    const inside = (x: number, y: number) => x >= x0 && x < x1 && y >= yTop(x) && y < yBot && !hole(x, y);
    for (let y = 0; y < yBot; y++)
      for (let x = x0; x < x1; x++) {
        if (!inside(x, y)) continue;
        const row = Math.floor((yBot - y) / 4);
        const bwid = 6 + Math.floor(hash(row, 3, seed) * 3);
        const off = Math.floor(hash(row, 1, seed) * bwid);
        const joint = (yBot - y) % 4 === 0 || (x + off) % bwid === 0;
        const block = Math.floor((x + off) / bwid) * 31 + row;
        let v = 0.45 + (hash(block, 2, seed) - 0.5) * 0.25 - ((x - x0) / (x1 - x0)) * 0.12;
        if (!inside(x - 1, y) || !inside(x, y - 1)) v = 0.95;
        else if (!inside(x + 1, y) || !inside(x, y + 1)) v = 0.12;
        else if (joint) v -= 0.25;
        v += (noise(x * 0.3, y * 0.3, seed) - 0.5) * 0.2;
        let c = pick(stoneR, v, x, y);
        if ((!inside(x, y - 1) || !inside(x, y - 2)) && noise(x * 0.5, y, seed + 1) > 0.35) c = pick(mossR, 0.85, x, y);
        else if (noise(x * 0.25, y * 0.12, seed + 2) > 0.7) c = pick(mossR, 0.35 + v * 0.4, x, y);
        p.set(x, y, c);
      }
  };
  // left: a broken arcade of pointed arches
  const ax0 = Math.round(w * 0.1);
  const ax1 = Math.round(w * 0.4);
  const aBase = G - 16;
  masonry(
    ax0,
    ax1,
    (x) => {
      const t = (x - ax0) / (ax1 - ax0);
      return Math.round(aBase - 36 + t * t * 26 + Math.floor(noise(x * 0.4, 1, 3) * 3) + (t > 0.75 ? 6 : 0));
    },
    aBase,
    (x, y) => {
      const span = 16;
      const u = ((x - ax0 - 4) % span) - span / 2 + 2;
      const sp = aBase - 13;
      if (x < ax0 + 4 || Math.abs(u) > 5) return false;
      if (y >= sp) return true;
      return Math.hypot(u + 3, y - sp) < 8 && Math.hypot(u - 3, y - sp) < 8;
    },
    4,
  );
  // right: a tall broken tower with a gothic window
  const tx0 = Math.round(w * 0.72);
  masonry(
    tx0,
    tx0 + 18,
    (x) => Math.round(G - 62 + ((x - tx0) / 18) ** 2 * 18 + noise(x * 0.5, 2, 7) * 3),
    G - 15,
    (x, y) => {
      const u = x - (tx0 + 9);
      const sp = G - 40;
      if (Math.abs(u) > 3) return false;
      if (y >= sp && y < G - 30) return true;
      return y < sp && Math.hypot(u + 1.5, y - sp) < 4.5 && Math.hypot(u - 1.5, y - sp) < 4.5;
    },
    8,
  );
  // dead trees with hanging moss between the ruins
  const deadR = ramp('#0a0e16', '#121824', '#1c2432');
  const deadTree = (x: number, base: number, hgt: number, seed: number) => {
    const r2 = rng(seed);
    const limb = (bx: number, by: number, ang: number, len: number, th: number, depth: number) => {
      for (let i = 0; i < len; i++) {
        bx += Math.sin(ang);
        by -= Math.cos(ang);
        ang += (r2() - 0.5) * 0.25;
        for (let k = 0; k < th; k++) p.set(Math.round(bx) + k, Math.round(by), k === 0 && th > 1 ? deadR[2] : deadR[1]);
        if (th > 2) p.set(Math.round(bx) + th, Math.round(by), deadR[0]);
      }
      if (depth > 0) {
        limb(bx, by, ang - 0.55 - r2() * 0.35, len * 0.62, Math.max(1, th - 1), depth - 1);
        limb(bx, by, ang + 0.45 + r2() * 0.35, len * 0.58, Math.max(1, th - 1), depth - 1);
      } else if (r2() < 0.6) vine(p, Math.round(bx), Math.round(by) + 1, 2 + Math.floor(r2() * 5), mossR, seed);
    };
    for (let k = -2; k <= 3; k++) p.set(x + k, base - 1, deadR[1]);
    limb(x - 1, base, (r2() - 0.5) * 0.3, hgt * 0.5, 3, 3);
  };
  deadTree(Math.round(w * 0.47), G - 16, 34, 3);
  deadTree(Math.round(w * 0.92), G - 16, 28, 5);

  // overgrown ground behind the road: dark grass, rubble, tufts
  const grassR = ramp('#122420', '#172e28', '#1e3a30', '#284a38', '#36603e');
  const gTop = G - 16;
  for (let y = gTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      if (y < gTop + 2 && !skyR.includes(p.get(x, y)) && hash(x, y, 4) > 0.5) continue;
      const t = (y - gTop) / (G - 7 - gTop);
      p.set(x, y, pick(grassR, 0.2 + t * 0.45 + (fbm(x * 0.09, y * 0.3, 41) - 0.5) * 0.5, x, y, 0.25));
    }
  const tuftR = ramp('#14281f', '#1e3a2c', '#2e5238', '#45704a');
  for (let i = 0; i < 40; i++) tuft(p, Math.floor(rnd() * w), gTop + 4 + Math.floor(rnd() * 6), 2 + Math.floor(rnd() * 3), tuftR, i);
  const rubR = ramp('#1a2430', '#26343e', '#34464e', '#4a6066');
  for (let i = 0; i < 9; i++) pebble(p, Math.floor(rnd() * w), gTop + 4 + Math.floor(rnd() * 4), 1 + Math.floor(rnd() * 2), 1, rubR, grassR[0]);
  // rubble heaped at the foot of the broken arcade and tower
  rock(p, ax1 - 3, G - 11, 5, 5, stoneR, mossR, grassR[0], 3);
  rock(p, ax1 + 4, G - 10, 3, 3, stoneR, mossR, grassR[0], 5);
  rock(p, tx0 + 21, G - 11, 4, 4, stoneR, mossR, grassR[0], 7);
  // a fallen column drum
  const fallen = (x: number, y: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const broken = i >= len - 2 ? Math.floor(hash(i, 1, 9) * 3) : 0;
      for (let k = -2 + broken; k <= 2; k++) {
        let v = 0.62 - k * 0.17 + (noise((x + i) * 0.4, k, 3) - 0.5) * 0.15;
        if (i % 4 === 3 && i < len - 2) v -= 0.18; // fluting
        p.set(x + i, y + k, pick(stoneR, v, x + i, y + k));
      }
      p.set(x + i, y + 3, grassR[0]);
    }
    // the lit end face
    for (let k = -2; k <= 2; k++) {
      p.set(x - 1, y + k, k === 2 ? stoneR[2] : stoneR[4]);
      p.set(x, y + k, Math.abs(k) === 2 ? stoneR[3] : stoneR[5]);
    }
    for (let i = 1; i < len - 3; i++) if (hash(i, 2, 9) > 0.45) p.set(x + i, y - 3, mossR[2 + (i % 2)]);
  };
  fallen(Math.round(w * 0.62), G - 11, 11);

  // the flagstone road: worn, irregular slabs; joints stay low contrast where the actors stand
  const flagR = ramp('#1a2230', '#222c3a', '#2a3644', '#323f4e', '#3c4a58', '#4a5a66');
  const roadTop = G - 8;
  const rows = [roadTop, G - 5, G - 1, G + 4, h];
  const joint = new Uint8Array(w * h);
  for (let ri = 0; ri + 1 < rows.length; ri++) {
    const ya = rows[ri];
    const yb = rows[ri + 1];
    let x = -Math.floor(hash(ri, 1, 6) * 10);
    while (x < w) {
      const sw = 7 + ri * 2 + Math.floor(hash(x, ri, 7) * 7);
      const tone = 0.5 + (hash(x, ri, 8) - 0.5) * 0.24;
      const dt = ri > 0 && hash(x, ri, 11) > 0.55 ? 1 : 0; // uneven joint line
      const crack = hash(x, ri, 9) > 0.72 ? 2 + Math.floor(hash(x, ri, 10) * (sw - 4)) : -9;
      for (let y = ya; y < yb; y++)
        for (let xx = x; xx < x + sw; xx++) {
          const lx = xx - x;
          const ly = y - ya - dt;
          let v = tone + (noise(xx * 0.3, y * 0.5, 61) - 0.5) * 0.14;
          if (ly < 0) v = 0.3; // previous slab's lower lip
          else if (ly === 0 || lx === 0 || (lx === 1 && ly === 1) || (lx === sw - 1 && y === yb - 1)) {
            v = 0.05;
            joint[y * w + xx] = 1;
          } else if (ly === 1) v += 0.16;
          else if (lx === sw - 1 || y === yb - 1) v -= 0.1;
          if (lx === crack + Math.floor(ly / 2) && ly > 1) v = 0.2;
          p.set(xx, y, pick(flagR, v, xx, y));
        }
      x += sw;
    }
  }
  // moss and sprigs in some joints, softer joints in the band the actors stand on
  for (let y = roadTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!joint[y * w + x]) continue;
      if (noise(x * 0.16, y * 0.5, 71) > 0.72) {
        p.set(x, y, mossR[1]);
        if (hash(x, y, 2) > 0.6) p.set(x, y - 1, mossR[2]);
      } else if (y >= G - 2 && y <= G + 1) p.set(x, y, flagR[1]);
    }
  for (let i = 0; i < 5; i++) tuft(p, Math.floor(rnd() * w), G + 5 + Math.floor(rnd() * 4), 2, tuftR, i + 70);
  // puddles reflecting the sky
  const puddle = (px0: number, py: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const edge = i === 0 || i === len - 1;
      p.set(px0 + i, py, edge ? flagR[1] : i < len * 0.35 ? col('#56707e') : col('#3e5664'));
      if (!edge) p.set(px0 + i, py + 1, i > 1 && i < len * 0.45 ? col('#7896a2') : col('#30485a'));
    }
  };
  puddle(Math.round(w * 0.2) - 6, G + 4, 13);
  puddle(Math.round(w * 0.47), G + 5, 9);
  puddle(Math.round(w * 0.86) - 7, G + 4, 14);

  // braziers on stone pedestals behind the road, pooling warm light
  const torches: Backdrop['torches'] = [];
  const ironR = ramp('#120e10', '#2a2224', '#4a3a34', '#6e5a4a');
  const warm = col('#ff9040');
  for (const fx of [0.2, 0.53, 0.86]) {
    const tx = Math.round(w * fx);
    const ty = G - 18;
    torchLight(p, tx + 0.5, G - 9, 28, 13, warm, 0.24);
    torchLight(p, tx + 0.5, ty - 2, 17, 17, warm, 0.16);
    // pedestal: plinth, shaft, cap
    for (let y = ty + 3; y < G - 6; y++) {
      const plinth = y >= G - 9;
      for (let x = tx - (plinth ? 3 : 2); x <= tx + (plinth ? 3 : 2); x++) {
        const edgeL = x === tx - (plinth ? 3 : 2);
        const edgeR = x === tx + (plinth ? 3 : 2);
        const c = edgeL ? stoneR[4] : edgeR ? stoneR[1] : y === G - 9 ? stoneR[4] : stoneR[3];
        p.set(x, y, lighten(c, warm, 0.13));
      }
    }
    for (let x = tx - 3; x <= tx + 3; x++) {
      p.set(x, ty + 3, lighten(x < tx + 2 ? stoneR[5] : stoneR[3], warm, 0.18));
      p.set(x, ty + 4, lighten(stoneR[1], warm, 0.1));
    }
    // iron bowl with glowing coals
    for (let x = tx - 3; x <= tx + 3; x++) {
      p.set(x, ty + 1, x === tx - 3 ? ironR[3] : ironR[2]);
      if (Math.abs(x - tx) < 3) p.set(x, ty + 2, ironR[1]);
    }
    p.set(tx - 4, ty, ironR[3]);
    p.set(tx + 4, ty, ironR[2]);
    for (let x = tx - 3; x <= tx + 3; x++) p.set(x, ty, Math.abs(x - tx) < 2 ? col('#ffd070') : col('#e0702c'));
    torches.push({ x: tx, y: ty });
    for (let y = G + 4; y < G + 9; y++) {
      const c = p.get(tx, y);
      if (c === col('#56707e') || c === col('#3e5664') || c === col('#7896a2') || c === col('#30485a')) {
        p.set(tx, y, col('#e8a050'));
        p.set(tx + 1, y, col('#a8603a'));
      }
    }
  }

  // framing: a gnarled tree on the left, an ivy-wrapped column on the right, dark canopy overhead
  const ink = col('#0a0a12');
  const before = p.buf.slice();
  const barkR = ramp('#0a0c12', '#14161e', '#20222c', '#2e3038', '#40424a');
  trunk(p, 7, 0, G + 2, 13, 16, -2, { ramp: barkR, seed: 13, outline: ink, moss: mossR, flare: 5, wobble: 3 });
  root(p, 16, G - 1, 1, 9, barkR, ink);
  root(p, 12, G + 1, 1, 6, barkR, ink);
  const colR = ramp('#0c1218', '#141e26', '#1e2c36', '#2a3c46', '#3a5058', '#4c6668');
  const c0 = w - 15;
  for (let y = 0; y < G + 2; y++) {
    const plinth = y >= G - 4;
    const xl = plinth ? c0 - 3 : c0;
    for (let x = xl; x < w; x++) {
      const k = x - xl;
      let v = 0.78 - k * 0.045;
      if (!plinth && k > 1 && k % 4 === 2) v -= 0.22;
      if (!plinth && y % 17 === 0) v = 0.1;
      if (plinth && y === G - 4) v = 0.9;
      v += (noise(x * 0.3, y * 0.15, 2) - 0.5) * 0.22;
      let c = k === 0 ? ink : pick(colR, v, x, y);
      if (!plinth && k < 8 && noise(x * 0.3, y * 0.14, 17) > 0.6) c = pick(mossR, 0.95 - k * 0.08, x, y);
      p.set(x, y, c);
    }
  }
  // a crack running down the column
  for (let y = 20, x = c0 + 6; y < G - 8; y++) {
    if (hash(y, 1, 3) > 0.6) x += hash(y, 2, 3) > 0.5 ? 1 : -1;
    x = Math.max(c0 + 3, Math.min(w - 3, x));
    p.set(x, y, colR[0]);
    if (hash(y, 3, 3) > 0.5) p.set(x - 1, y, colR[4]);
  }
  for (let i = 0; i < 4; i++) vine(p, c0 + 1 + i * 3, 4, 20 + Math.floor(hash(i, 5, 5) * 26), mossR, i + 2);
  const canopyR = ramp('#060c12', '#0c1820', '#13242c', '#1d3438', '#2a4a48', '#3e6460');
  cornerCanopy(p, 2, 1, 80, 15, canopyR, mossR);
  cornerCanopy(p, w - 2, -1, 80, 16, canopyR, mossR);
  const frame = changed(p, before);

  return [p, frame, { torches }];
}

// ------------------------------------------------------------------ hollow (Level 3): the Boar King's den at sunset

/** A small hand-drawn bit (bones, a tusk) stamped into a backdrop; '.' is transparent. */
export function bits(p: Pix, rows: string[], pal: Record<string, Col>, x: number, y: number): void {
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && pal[ch] !== undefined && p.set(x + i, y + j, pal[ch])));
}

/** Crooked trunk and limbs (gnarled trees); returns the twig tips so leaf clumps can hang on them. */
function gnarled(p: Pix, x: number, base: number, hgt: number, th: number, r: Ramp, seed: number, depth = 3): Array<[number, number]> {
  const r2 = rng(seed);
  const tips: Array<[number, number]> = [];
  const limb = (bx: number, by: number, ang: number, len: number, t: number, d: number) => {
    for (let i = 0; i < len; i++) {
      bx += Math.sin(ang);
      by -= Math.cos(ang);
      ang += (r2() - 0.5) * 0.4;
      const x0 = Math.round(bx - t / 2);
      for (let k = 0; k < t; k++) p.set(x0 + k, Math.round(by), k === 0 && t > 1 ? r[2] : k === t - 1 && t > 2 ? r[0] : r[1]);
    }
    if (d > 0) {
      limb(bx, by, ang - 0.45 - r2() * 0.45, len * 0.64, Math.max(1, t - 1), d - 1);
      limb(bx, by, ang + 0.4 + r2() * 0.45, len * 0.6, Math.max(1, t - 1), d - 1);
    } else tips.push([bx, by]);
  };
  // a flared foot so the tree stands on its base
  for (let k = -1 - Math.ceil(th / 2); k <= Math.ceil(th / 2) + 1; k++) p.set(x + k, base, r[1]);
  limb(x, base + 1, (r2() - 0.5) * 0.5, hgt * 0.42, th, depth);
  return tips;
}

/** Toadstool standing on y: a domed cap lit from the top left (optional pale spots) on a pale stem. */
function toadstool(p: Pix, x: number, y: number, r: number, cap: Ramp, stem: Ramp, shadow: Col, spots: boolean): void {
  const sh = Math.max(1, r);
  for (let k = 1; k <= sh; k++) {
    p.set(x, y - k, stem[2]);
    if (r > 1) p.set(x + 1, y - k, stem[1]);
  }
  const cy = y - sh;
  const cx = x + (r > 1 ? 0.5 : 0);
  for (let yy = -r; yy <= 0; yy++)
    for (let xx = Math.floor(-r - 1.5); xx <= r + 1.5; xx++) {
      const dx = (x + xx + 0.5 - (cx + 0.5)) / (r + 1);
      const dy = (yy - 0.3) / (r + 0.6);
      if (dx * dx + dy * dy > 1) continue;
      let v = 0.62 - dx * 0.35 + dy * 0.5;
      if (yy === 0) v = 0.12; // the shaded rim / gills
      p.set(x + xx, cy + yy, pick(cap, v, x + xx, cy + yy));
    }
  if (spots && r > 1) {
    p.set(x - 1, cy - r + 1, stem[3]);
    p.set(x + 1, cy - 1, stem[3]);
    if (r > 2) p.set(x + 2, cy - r + 1, stem[3]);
  }
  for (let xx = -r; xx <= r + 1; xx++) if (p.get(x + xx, y) !== stem[2]) p.set(x + xx, y, shadow);
}

function hollow(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(57);
  const ink = col('#140c1c');

  // sunset sky: deep violet overhead, rose, then gold at the horizon; a wide glow around the low sun
  const skyR = ramp('#20123a', '#301746', '#451c50', '#5e2457', '#7c2e5c', '#9c3a5e', '#bc4c5e', '#d8645c', '#ec845c', '#f8a862', '#fdcb78');
  const sunX = Math.round(w * 0.24);
  const sunY = G - 38;
  const skyBot = G - 12;
  for (let y = 0; y < skyBot; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - sunX) * 0.5, (y - sunY) * 1.25);
      const glow = Math.max(0, 1 - d / 64) ** 1.7;
      p.set(x, y, pick(skyR, (y / (G - 26)) * 0.84 + glow * 0.3, x, y, 0.3));
    }
  // the sun: a soft halo and a pale disc, sinking behind the far hills
  const sunHalo = col('#ffe4a0');
  for (let y = sunY - 26; y <= sunY + 26; y++)
    for (let x = sunX - 34; x <= sunX + 34; x++) {
      const d = Math.hypot(x + 0.5 - sunX, (y + 0.5 - sunY) * 1.15);
      if (d > 30) continue;
      p.tint(x, y, (c) => fade(c, sunHalo, Math.pow(1 - d / 30, 2.2) * 0.75, x, y, 3, 0.7));
    }
  const sunR = ramp('#ffc46a', '#ffdc8c', '#fff0be', '#fffbe6');
  const sr = 8;
  for (let y = -sr; y <= sr; y++)
    for (let x = -sr; x <= sr; x++) {
      const d = Math.hypot(x, y);
      if (d > sr + 0.3) continue;
      p.set(sunX + x, sunY + y, sunR[d > sr - 1 ? 0 : d > sr - 2.5 ? 1 : x + y < -3 ? 3 : 2]);
    }

  // long wisps of cloud, lit along their undersides by the sinking sun
  const cloudR = ramp('#3a1a4a', '#542254', '#742c5a', '#983a5c', '#bc4e5c', '#dc6a5c', '#f29062', '#ffbc7c', '#ffe0a0');
  const wisp = (x0: number, y0: number, len: number, thick: number, seed: number) => {
    const r2 = rng(seed);
    const bl: Blob[] = [];
    const n = Math.max(3, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const t = Math.sin(f * Math.PI);
      bl.push({ x: x0 + f * len + (r2() - 0.5) * 4, y: y0 - t * thick * 0.6 + (r2() - 0.5) * 1.5, rx: 6 + t * len * 0.16, ry: 0.9 + t * thick * (0.5 + r2() * 0.4) });
    }
    const inside = (x: number, y: number) =>
      bl.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1 + (noise(x * 0.25, y * 0.6, seed) - 0.5) * 0.7);
    for (let y = Math.floor(y0 - thick * 2); y <= y0 + thick + 2; y++)
      for (let x = Math.floor(x0 - 12); x <= x0 + len + 12; x++) {
        if (!inside(x, y)) continue;
        let below = 0;
        while (below < 3 && inside(x, y + below + 1)) below++;
        const near = clamp01(1 - Math.hypot((x - sunX) * 0.6, (y - sunY) * 1.4) / 120);
        const v = 0.16 + near * 0.55 + (below === 0 ? 0.3 : below === 1 ? 0.14 : 0) - (inside(x, y - 1) ? 0 : 0.06);
        p.set(x, y, pick(cloudR, v, x, y, 0.15));
      }
  };
  for (const [fx, fy, len, th] of [
    [-0.04, 0.2, 84, 3],
    [0.3, 0.13, 62, 2.5],
    [0.62, 0.08, 90, 3.5],
    [0.47, 0.3, 46, 2],
    [0.08, 0.42, 58, 2.5],
    [0.74, 0.34, 70, 3],
    [0.33, 0.5, 40, 1.6],
    [0.86, 0.52, 44, 1.8],
  ])
    wisp(Math.round(fx * w), Math.round(fy * (G - 40)) + 4, len, th, Math.round(fx * 100 + fy * 1000));

  // far hills with a fringe of tiny trees, almost lost in the rose haze
  const hz = col('#d87a6c');
  const farR = haze(ramp('#4a2248', '#5c2a4e', '#703456', '#86405c'), hz, 0.52);
  const far: Blob[] = [];
  for (let x = -10; x < w + 10; x += 14 + rnd() * 12) far.push({ x, y: G - 27 - Math.sin(x / 41 + 1) * 4, rx: 16 + rnd() * 10, ry: 6 + rnd() * 3 });
  for (let x = -10; x < w + 10; x += 20) far.push({ x, y: G - 16, rx: 16, ry: 6 }); // hide the horizon line
  for (let x = -4; x < w + 4; x += 2.5 + rnd() * 3) far.push({ x, y: G - 32 - Math.sin(x / 41 + 1) * 4 + rnd() * 3, rx: 1.8 + rnd() * 1.6, ry: 2.4 + rnd() * 2 });
  mass(p, far, { ramp: farR, seed: 5, bump: 0.12, tex: 0.12, vgrad: 0.45, light: 0.06, shadow: 0.08, floor: G - 14 });

  // mist pooled in the valley
  const mistC = col('#e8a49c');
  const mist = (yc: number, half: number, amt: number, seed: number) => {
    for (let y = Math.floor(yc - half); y <= yc + half; y++)
      for (let x = 0; x < w; x++) {
        const k = (1 - Math.abs(y - yc) / half) * (0.6 + (fbm(x * 0.03, y * 0.2, seed) - 0.5) * 1.1);
        if (k > 0) p.tint(x, y, (c) => fade(c, mistC, k * amt, x, y, 3, 0.6));
      }
  };
  mist(G - 26, 8, 0.6, 31);

  // gnarled autumn trees in layers: far ones nearly sky-coloured, nearer ones deep plum with warm crowns
  const crowns = [
    ramp('#3a1426', '#5e1c2c', '#8a2a30', '#b43e30', '#d8603a', '#f08c48'), // crimson
    ramp('#3e1a22', '#62261e', '#8e3c1e', '#bc5c22', '#e08a2c', '#f6b848'), // amber
    ramp('#2c1428', '#46203a', '#68283e', '#8e3640', '#b44c44', '#d6704c'), // rust-plum
  ];
  const barkFar = ramp('#2a1428', '#3a1c30', '#4c2636');
  const grove = (base: number, hzAmt: number, s: number, seed: number, avoid: Array<[number, number]>) => {
    const r2 = rng(seed);
    for (let x = -4 + r2() * 10; x < w + 8; x += (20 + r2() * 24) * s) {
      if (avoid.some(([a, b]) => x > a && x < b)) continue;
      const tx = Math.round(x);
      const hg = (26 + r2() * 16) * s;
      const bark = haze(barkFar, hz, hzAmt);
      const tips = gnarled(p, tx, base, hg, Math.max(2, Math.round(3 * s)), bark, seed + tx, 3);
      if (r2() < 0.18) continue; // a bare, dead one now and then
      const lr = haze(crowns[Math.floor(r2() * crowns.length)], hz, hzAmt);
      const bl: Blob[] = [];
      for (const [bx, by] of tips) {
        const r = (3 + r2() * 2.5) * s;
        bl.push({ x: bx + (r2() - 0.5) * 2, y: by + 1, rx: r, ry: r * 0.8 });
      }
      const cx = tips.reduce((a, t) => a + t[0], 0) / tips.length;
      const cy = tips.reduce((a, t) => a + t[1], 0) / tips.length;
      mass(p, bl, { ramp: lr, seed: tx, bump: 0.22, tex: 0.25, vgrad: 0.25, shadow: 0.25, form: { x: cx - 4, y: cy, rx: 18 * s, ry: 12 * s }, formMix: 0.4 });
    }
  };
  const cx = Math.round(w * 0.5); // the den tree
  grove(G - 22, 0.62, 0.7, 11, [[sunX - 16, sunX + 12]]);
  mist(G - 21, 6, 0.45, 37);
  grove(G - 15, 0.34, 0.95, 17, [
    [sunX - 14, sunX + 16],
    [cx - 30, cx + 30],
  ]);
  // undergrowth at the foot of the grove, gaps letting the low sun through
  const brushR = haze(ramp('#2a1226', '#3e1a2c', '#5a2430', '#7a3232', '#9a4636'), hz, 0.3);
  const brush: Blob[] = [];
  for (let x = -6; x < w + 6; x += 3 + rnd() * 4) {
    if (noise(x * 0.06, 2, 19) < 0.38) continue;
    brush.push({ x, y: G - 15 + rnd() * 2, rx: 3 + rnd() * 3, ry: 2.5 + rnd() * 2.5 });
  }
  mass(p, brush, { ramp: brushR, seed: 19, bump: 0.25, tex: 0.25, vgrad: 0.35, shadow: 0.2, floor: G - 13 });
  mist(G - 16, 4, 0.35, 43);

  // the forest floor behind the road: leaf litter
  const floorR = ramp('#24121e', '#321824', '#44202a', '#5a2a2e', '#723a32', '#8c4c36');
  const leafR = ramp('#5a1e24', '#8e3024', '#c0522a', '#e0822e', '#f4b040');
  const gTop = G - 14;
  for (let y = gTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      if (y === gTop && hash(x, y, 4) > 0.5) continue;
      const t = (y - gTop) / (G - 7 - gTop);
      const n = fbm(x * 0.12, y * 0.35, 51);
      let c = pick(floorR, 0.25 + t * 0.4 + (n - 0.5) * 0.6, x, y, 0.25);
      const l = noise(x * 0.3, y * 0.6, 53);
      if (l > 0.75) c = pick(leafR, (l - 0.75) * 2.2 + (y - gTop) * 0.03, x, y);
      p.set(x, y, c);
    }
  // ---- the Boar King's den: a colossal, twisted hollow tree rising out of the frame
  const dBase = G - 14;
  const barkD = ramp('#1a0e1c', '#281424', '#3a1c2a', '#4e262e', '#663232', '#7e4236', '#9a5a3e');
  const rimC = col('#e4783e'); // sunset rim light on the sun-facing edge
  const twist = (y: number) => Math.sin(y * 0.045 + 0.6) * 4 + Math.sin(y * 0.12) * 1.2;
  const halfW = (y: number) => {
    const t = y / dBase;
    return 15 + t * 5 + Math.pow(Math.max(0, t - 0.62) / 0.38, 2.2) * 17 + (noise(y * 0.2, 3, 21) - 0.5) * 2;
  };
  // the opening: an organic, almond-shaped hollow between two root buttresses
  const mTop = dBase - 25;
  const mx = cx + twist(dBase) - 1;
  const mouthHalf = (y: number) => {
    if (y < mTop) return -1;
    const t = (y - mTop) / (dBase - mTop);
    return (t < 0.55 ? Math.sin((t / 0.55) * Math.PI * 0.5) ** 0.8 : 1 + (t - 0.55) * 0.35) * 9.5 + (noise(y * 0.4, 7, 9) - 0.5) * 1.6;
  };
  const inMouth = (x: number, y: number) => y >= mTop && y <= dBase && Math.abs(x + 0.5 - mx) < mouthHalf(y);
  const holR = ramp('#0a050c', '#140812', '#220c16', '#381218', '#561c1a', '#7c2c1c', '#a8461e');
  for (let y = 0; y <= dBase; y++) {
    const c = cx + twist(y);
    const hw = halfW(y);
    const xl = Math.round(c - hw);
    const xr = Math.round(c + hw);
    for (let x = xl; x <= xr; x++) {
      if (inMouth(x, y)) {
        // dark inside, with a deep ember glow low in the den
        const g = Math.max(0, 1 - Math.hypot((x + 0.5 - mx - 1) / 8, (y - dBase) / 13));
        let v = 0.06 + g * g * 0.75;
        if (!inMouth(x - 1, y) || !inMouth(x - 2, y)) v = Math.min(v, 0.05); // the lip's shadow on the left
        p.set(x, y, pick(holR, v, x, y, 0.4));
        continue;
      }
      const nx = (x + 0.5 - c) / hw;
      let v = 0.16 + 0.66 * lambert(nx * 0.95, 0.15);
      // fibrous strands wrapped round the trunk, spiralling with its twist: lit crests, dark grooves
      const ph = (Math.asin(Math.max(-1, Math.min(1, nx))) / Math.PI + 0.5) * 9 + y * 0.035 + (noise(x * 0.2, y * 0.06, 33) - 0.5) * 1.2;
      const fr = ph - Math.floor(ph);
      if (fr > 0.78) v -= 0.32;
      else if (fr < 0.28) v += 0.12;
      // the right inner wall of the hollow catches the low sun
      if (inMouth(x - 1, y) || inMouth(x - 2, y)) v = 0.7;
      else if (inMouth(x + 1, y)) v = 0.2;
      let cc = pick(barkD, v, x, y, 0.12);
      if (x === xr || (y === dBase && x > xl)) cc = barkD[0];
      else if (x - xl < 2 && nx < -0.85) cc = x === xl ? mix(rimC, barkD[3], 0.35) : mix(rimC, barkD[4], 0.6);
      p.set(x, y, cc);
    }
  }
  // a burl and a knot hole up the trunk
  const knot = (kx: number, ky: number, rx: number, ry: number) => {
    for (let y = -ry - 1; y <= ry + 1; y++)
      for (let x = -rx - 1; x <= rx + 1; x++) {
        const d = Math.hypot(x / (rx + 1), y / (ry + 1));
        if (d > 1) continue;
        const inner = Math.hypot(x / rx, y / ry) <= 0.8;
        p.set(kx + x, ky + y, inner ? (y < 0 ? holR[0] : holR[1]) : y + x < 0 ? barkD[1] : barkD[5]);
      }
  };
  knot(Math.round(cx + twist(30) + 6), 30, 2, 3);
  knot(Math.round(cx + twist(12) - 7), 12, 1, 2);
  // giant limbs heading out of frame
  const limb = (x0: number, y0: number, dir: number, len: number, rise: number, th: number) => {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const yy = Math.round(y0 - rise * Math.sin(t * Math.PI * 0.5) + Math.sin(i * 0.4) * 0.8);
      const thk = Math.max(2, Math.round(th * (1 - t * 0.6)));
      for (let k = 0; k < thk; k++) p.set(x0 + dir * i, yy + k, k === 0 ? barkD[4] : k === thk - 1 ? barkD[0] : barkD[2]);
    }
  };
  limb(Math.round(cx - 12), 16, -1, 36, 16, 6);
  limb(Math.round(cx + 14), 10, 1, 40, 12, 6);
  limb(Math.round(cx - 6), 6, -1, 20, 8, 4);
  // its autumn crown spills in from the top edge
  const crownR = ramp('#2c1024', '#4a1a2c', '#741e2e', '#a0302e', '#c84e30', '#e67a36', '#f8aa46');
  const top: Blob[] = [];
  for (let i = 0; i < 26; i++) {
    const t = rnd();
    const x = cx - 62 + t * 124;
    const r = 4 + rnd() * 4.5;
    top.push({ x, y: -3 + Math.abs(t - 0.5) * 12 + rnd() * 9, rx: r, ry: r * 0.8 });
  }
  mass(p, top, { ramp: crownR, seed: 77, bump: 0.22, tex: 0.3, vgrad: 0.2, shadow: 0.3, form: { x: cx - 20, y: 0, rx: 70, ry: 20 }, formMix: 0.4 });
  for (let i = 0; i < 6; i++) {
    const vx = Math.round(cx - 50 + rnd() * 100);
    let vy = 0;
    while (vy < 30 && crownR.includes(p.get(vx, vy))) vy++;
    if (vy > 2) vine(p, vx, vy - 1, 2 + Math.floor(rnd() * 5), ramp('#3a1222', '#7a2a2a', '#c45a30', '#f09a44'), i);
  }
  // great roots spreading over the floor
  const rootR = barkD;
  const bigRoot = (x0: number, dir: number, len: number, th: number, seed: number) => {
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const x = Math.round(x0 + dir * i);
      const r = th * (1 - t * 0.75);
      const yc = dBase - th * 0.6 + t * (th * 0.6 + 2) + Math.sin(t * 5 + seed) * 0.6;
      for (let y = Math.floor(yc - r); y <= Math.ceil(yc + r * 0.5); y++) {
        const ny = (y + 0.5 - yc) / r;
        if (ny < -1 || ny > 0.5) continue;
        let v = 0.65 - ny * 0.55 - (dir > 0 ? t * 0.1 : 0);
        if (ny > 0.25) v = 0.08;
        if (noise(x * 0.5, y * 0.4, seed) > 0.7) v -= 0.2;
        p.set(x, y, pick(rootR, v, x, y));
      }
    }
  };
  bigRoot(Math.round(cx - halfW(dBase) + 6), -1, 26, 6, 1);
  bigRoot(Math.round(cx - halfW(dBase) + 14), -1, 12, 4, 2);
  bigRoot(Math.round(cx + halfW(dBase) - 6), 1, 28, 6, 3);
  bigRoot(Math.round(cx + halfW(dBase) - 12), 1, 14, 4, 4);

  // the den mouth's floor: trampled dark earth
  for (let y = dBase - 1; y <= dBase + 2; y++)
    for (let x = Math.round(mx - 10); x <= mx + 10; x++) if (Math.abs(x + 0.5 - mx) < 11 - (y - dBase) * 0.5) p.set(x, y, y === dBase - 1 ? holR[3] : pick(floorR, 0.2, x, y));
  // bones and a broken tusk by the den
  const boneP = { a: col('#f0e2c8'), b: col('#c8ac8c'), c: col('#8a6a5a'), s: floorR[0] };
  bits(p, ['a...a', 'baaab', 'c...c', '.sss.'], boneP, Math.round(mx + 13), dBase - 1);
  bits(p, ['a.', 'ab', '.ba', '..bc', '...c'], boneP, Math.round(mx - 20), dBase - 3);
  bits(p, ['....a', '...ab', '.aab.', 'abc..', 'ss...'], boneP, Math.round(mx + 22), dBase - 2);
  // toadstools in clusters at the roots and along the litter
  const capRed = ramp('#4a0e1c', '#8a1a22', '#c8302c', '#ee5a3a', '#ff9a6a');
  const capBrown = ramp('#3a1a1a', '#5e2e22', '#8a4a2a', '#b06c38', '#d49450');
  const stemR = ramp('#6a4a4a', '#b49a8a', '#e6d4bc', '#fff4e0');
  for (const [mxx, r, red] of [
    [cx - 36, 2, 1],
    [cx - 32, 1, 1],
    [cx + 34, 2, 0],
    [cx + 38, 1, 0],
    [cx + 40, 1, 0],
    [Math.round(w * 0.12), 2, 1],
    [Math.round(w * 0.15), 1, 1],
    [Math.round(w * 0.86), 2, 0],
    [Math.round(w * 0.89), 1, 1],
  ] as const)
    toadstool(p, mxx, gTop + 4 + (r === 1 ? 1 : 0), r, red ? capRed : capBrown, stemR, floorR[0], red === 1);

  // low sunlight raking across the floor from the left
  shafts(
    p,
    [
      [-20, 16, 0.9],
      [30, 8, 0.7],
      [72, 12, 0.8],
    ],
    1.9,
    G - 46,
    G - 6,
    col('#ffc080'),
    0.14,
  );

  // torches staked at the den mouth (flames are animated by the stage)
  const torches: Backdrop['torches'] = [];
  const warm = col('#ff9040');
  const woodR = ramp('#24120e', '#4a2616', '#6e3e20', '#946036');
  const ironR = ramp('#120e10', '#2a2224', '#4a3a34', '#6e5a4a');
  for (const dx of [-17, 17]) {
    const tx = Math.round(mx + dx);
    const ty = dBase - 13;
    torchLight(p, tx + 0.5, dBase + 1, 26, 9, warm, 0.22);
    torchLight(p, tx + 0.5, ty - 2, 16, 16, warm, 0.16);
    for (let y = ty + 2; y <= dBase + 1; y++) {
      p.set(tx, y, lighten(woodR[2], warm, 0.12));
      p.set(tx + 1, y, woodR[1]);
    }
    // iron cage holding the pitch-soaked wrap
    for (let x = tx - 1; x <= tx + 2; x++) p.set(x, ty + 2, ironR[x === tx - 1 ? 3 : 2]);
    p.set(tx - 1, ty + 1, ironR[3]);
    p.set(tx + 2, ty + 1, ironR[1]);
    p.set(tx, ty + 1, col('#5a2a18'));
    p.set(tx + 1, ty + 1, col('#3a1a14'));
    p.set(tx, ty, col('#ffd070'));
    p.set(tx + 1, ty, col('#e0702c'));
    torches.push({ x: tx, y: ty });
  }

  // the road: packed dark earth, calm where the actors stand
  const roadR = ramp('#26141e', '#341a24', '#44222a', '#562c2e', '#6a3832', '#7e4636');
  const roadTop = G - 8;
  for (let y = roadTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - roadTop) / (h - roadTop);
      let v = 0.62 - t * 0.12 + (fbm(x * 0.05, y * 0.3, 61) - 0.5) * 0.28;
      if ((y === G + 3 || y === G + 7) && noise(x * 0.12, y, 4) > 0.5) v -= 0.14;
      p.set(x, y, pick(roadR, v, x, y, 0.2));
    }
  // leaf litter overhanging the road edge, with a soft shadow below it
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(noise(x * 0.3, 5, 8) * 2.4) + (hash(x, 9, 2) > 0.8 ? 1 : 0);
    for (let k = 0; k < len; k++) p.set(x, roadTop + k, k === len - 1 ? floorR[2] : hash(x, k, 5) > 0.7 ? leafR[2] : floorR[3 + (hash(x, k, 3) > 0.5 ? 1 : 0)]);
    p.set(x, roadTop + len, roadR[1]);
    if (hash(x, 4, 6) > 0.5) p.set(x, roadTop + len + 1, roadR[2]);
  }
  // fallen leaves and pebbles, kept off the line the actors stand on
  const leafCols = [leafR[1], leafR[2], leafR[3], leafR[4], capRed[2]];
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.35 ? G - 5 + Math.floor(rnd() * 3) : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    const c = leafCols[Math.floor(rnd() * leafCols.length)];
    p.set(x, y, c);
    p.set(x + 1, y, rnd() < 0.5 ? c : mix(c, roadR[0], 0.5));
    if (rnd() < 0.3) p.set(x + 1, y - 1, c);
  }
  const pebR = ramp('#4a2a2c', '#6e4440', '#946656', '#b88a70');
  for (let i = 0; i < 12; i++) pebble(p, Math.floor(rnd() * w), G + 4 + Math.floor(rnd() * Math.max(1, h - G - 5)), 1, 0, pebR, roadR[0]);
  // the framing trees shade the ground near the edges (cooler, toward plum)
  const shade = col('#1e1024');
  for (let y = gTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 44) p.tint(x, y, (c) => fade(c, shade, ((44 - e) / 44) ** 1.5 * 0.6, x, y, 3, 0.5));
    }

  // framing: gnarled old trunks at both edges under a blazing autumn canopy, dead-leaf strands hanging
  const before = p.buf.slice();
  const frameBark = ramp('#110a12', '#1e1018', '#2c1820', '#3e2228', '#54302e', '#6c4034');
  const lichen = ramp('#2e1418', '#4a1e1e', '#6a2c24'); // red autumn ivy
  trunk(p, 7, 0, G + 2, 15, 18, -2, { ramp: frameBark, seed: 23, outline: ink, moss: lichen, flare: 6, wobble: 5 });
  trunk(p, w - 7, 0, G + 2, 14, 17, 2, { ramp: frameBark, seed: 29, outline: ink, moss: lichen, flare: 6, wobble: 5 });
  root(p, 17, G - 1, 1, 10, frameBark, ink);
  root(p, 12, G + 1, 1, 7, frameBark, ink);
  root(p, w - 17, G - 1, -1, 10, frameBark, ink);
  root(p, w - 11, G + 1, -1, 7, frameBark, ink);
  // knots on the trunks
  for (const [kx, ky] of [
    [8, 40],
    [w - 9, 56],
  ]) {
    for (let y = -2; y <= 2; y++)
      for (let x = -1; x <= 2; x++) {
        if (Math.abs(y) === 2 && (x === -1 || x === 2)) continue;
        p.set(kx + x, ky + y, Math.abs(y) < 2 && x >= 0 && x <= 1 ? (y < 0 ? holR[0] : holR[2]) : y < 0 ? frameBark[1] : frameBark[4]);
      }
  }
  // crooked branches reaching in under the canopy
  for (const [bx, by, dir, len] of [
    [12, 20, 1, 26],
    [w - 12, 15, -1, 30],
  ])
    for (let i = 0; i < len; i++) {
      const y = Math.round(by - i * 0.4 + Math.sin(i * 0.35) * 2);
      p.set(bx + dir * i, y, frameBark[4]);
      p.set(bx + dir * i, y + 1, frameBark[2]);
      if (i < len * 0.7) p.set(bx + dir * i, y + 2, ink);
      if (i === Math.round(len * 0.55)) for (let k = 1; k < 5; k++) p.set(bx + dir * (i + k), y - k, frameBark[3]); // a twig
    }
  const canopyR = ramp('#1a0a18', '#2e1022', '#4c162a', '#74202e', '#a0342e', '#c8562e', '#e88438');
  const strandR = ramp('#2a0e1c', '#5a1a26', '#9a3a2a', '#d4742e');
  cornerCanopy(p, 4, 1, 84, 25, canopyR, strandR);
  cornerCanopy(p, w - 4, -1, 84, 26, canopyR, strandR);
  const frame = changed(p, before);

  return [p, frame, { torches }];
}

// ------------------------------------------------------------------ foreground: dark plants nearest the camera

/** Rows the foreground hangs down over the top of the bar's band (drawn above it, in its own texture). */
export const FG_OVERLAP = 4;
/** The foreground sways through these frames (blade tips lean -1, 0, +1 px in a wave along the strip). */
export const FG_FRAMES = 4;
export const SWAY = [0, 1, 0, -1];

export interface FgLook {
  blade: Ramp; // base -> lit tip
  rim: Col; // the lit tip / top-left edge
  bush: Ramp;
  ink: Col;
}

/** One blade of grass (or a dry stalk): 1-2 px wide, curving with `lean`, its tip pushed by `sway`. */
export function blade(p: Pix, x: number, base: number, hgt: number, lean: number, sway: number, L: FgLook, wide: boolean): void {
  for (let k = 0; k < hgt; k++) {
    const t = k / Math.max(1, hgt - 1);
    const bx = x + Math.round(lean * t * t * hgt * 0.35 + sway * t * t);
    const c = k >= hgt - 1 ? L.rim : pick(L.blade, 0.1 + t * 0.85, bx, base - k);
    p.set(bx, base - k, c);
    if (wide && t < 0.55) p.set(bx + 1, base - k, L.blade[0]);
  }
}

/** A fern frond: a spine that rises and curls over toward `dir`, with leaflets shrinking toward the tip. */
export function frond(p: Pix, x: number, base: number, len: number, dir: number, sway: number, L: FgLook): void {
  let fx = x;
  let fy = base;
  let ang = -Math.PI / 2 + dir * 0.3;
  const curl = dir * 1.25;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    fx += Math.cos(ang);
    fy += Math.sin(ang);
    ang += (curl / len) * (0.6 + t);
    const px = Math.round(fx + sway * t * t);
    const py = Math.round(fy);
    p.set(px, py, t > 0.8 ? L.blade[2] : L.blade[1]);
    if (i % 2 === 0 && t < 0.92) {
      const leaf = Math.max(1, Math.round((1 - t) * 4));
      // leaflets hang off both sides of the spine, perpendicular, drooping a little
      const nx = -Math.sin(ang);
      const ny = Math.cos(ang);
      for (let s = 1; s <= leaf; s++) {
        p.set(Math.round(px + nx * s), Math.round(py + ny * s + s * 0.3), s === leaf ? L.blade[1] : L.blade[2]);
        p.set(Math.round(px - nx * s), Math.round(py - ny * s + s * 0.3), s === 1 ? L.rim : L.blade[3]);
      }
    }
  }
}

/** How much of a bottom corner x is in: 1 at the edge, 0 past `cl` px from the left / `cr` px from the right. */
export const cornerness = (x: number, w: number, cl: number, cr: number) => Math.max(clamp01(1 - x / cl), clamp01(1 - (w - 1 - x) / cr));

/**
 * The near ground's dark lip along the bottom edge (a bumpy mound line, lit along its top here and there), and the
 * grass on it: dense and tall in the corners, short and sparse where the fighters stand. The left corner reaches
 * further in (no enemy stands there).
 */
export function grassStrip(p: Pix, w: number, h: number, frame: number, L: FgLook, seed: number, tall = 1): void {
  const H = h + FG_OVERLAP;
  for (let x = 0; x < w; x++) {
    const c = cornerness(x, w, 90, 46);
    const top = Math.round(h - 1 - (1 + noise(x * 0.18, 1, seed) * 2.6 + c * c * 6 + (noise(x * 0.5, 2, seed) - 0.5) * 1.5));
    for (let y = top; y < H; y++) p.set(x, y, y === top ? (noise(x * 0.3, 3, seed) > 0.55 ? L.blade[2] : L.blade[1]) : y < top + 2 ? L.bush[1] : L.bush[0]);
  }
  for (let x = -2; x < w + 2; ) {
    const c = cornerness(x, w, 90, 46);
    const hgt = Math.round((3 + hash(x, 1, seed) * 4 + c * c * (8 + hash(x, 2, seed) * 10)) * tall);
    const phase = Math.floor(hash(x, 3, seed) * 2 + x / 46);
    const sway = hgt >= 5 ? SWAY[(frame + phase) % 4] * (hgt >= 12 ? 2 : 1) : 0;
    const lean = (hash(x, 4, seed) - 0.5) * 1.6 + (x < w / 2 ? 0.3 : -0.3) * c;
    const base = h - 1 + (c > 0.3 || hash(x, 6, seed) > 0.84 ? FG_OVERLAP : 1);
    blade(p, x, base, hgt + (base > h ? FG_OVERLAP - 1 : 0), lean, sway, L, hgt >= 9);
    x += c > 0.3 ? 1 + Math.floor(hash(x, 5, seed) * 2) : 1 + Math.floor(hash(x, 5, seed) * 3);
  }
}

/** A dark bush mound in a bottom corner (leaf clumps lit from the top left, inked edge). */
export function cornerBush(p: Pix, cx: number, dir: number, base: number, size: number, L: FgLook, seed: number): void {
  const r2 = rng(seed);
  const bl: Blob[] = [];
  for (let i = 0; i < 12; i++) {
    const t = r2();
    const r = (3.2 + (1 - t) * 4.2 + r2() * 2) * size;
    bl.push({ x: cx + dir * t * 34 * size + (r2() - 0.5) * 4, y: base - (1 - t) * 15 * size - r2() * 5 + 2, rx: r, ry: r * 0.84 });
  }
  mass(p, bl, { ramp: L.bush, seed, bump: 0.24, tex: 0.3, vgrad: 0.3, light: -0.02, shadow: 0.3, outline: L.ink, form: { x: cx + dir * 8, y: base - 10, rx: 30 * size, ry: 16 * size }, formMix: 0.45 });
}

/** Backlight: the scene's light catches the top edges of the foreground's silhouettes (and some left edges). */
export function backlight(p: Pix, rim: Col, mid: Col, seed: number): void {
  const src = p.buf.slice();
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < p.w && y < p.h ? src[y * p.w + x] : -1);
  for (let y = 1; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (at(x, y) < 0) continue;
      const lit = noise(x * 0.3, y * 0.2, seed) > 0.5;
      if (at(x, y - 1) < 0) p.set(x, y, lit ? rim : mid);
      else if (at(x, y - 2) < 0 && lit) p.set(x, y, mid);
      else if (at(x - 1, y) < 0 && at(x - 1, y - 1) < 0 && lit) p.set(x, y, mid);
    }
}

/**
 * The foreground nearest the camera, for one theme and sway frame: near-black plants (and rubble or roots)
 * along the bottom edge, heavy in the corners, low between the fighters so their feet stay clear. The texture
 * is FG_OVERLAP rows taller than the stage: those rows hang over the top of the bar's band.
 */
function foreground(theme: Theme, w: number, h: number, frame: number): Pix {
  const H = h + FG_OVERLAP;
  const p = new Pix(w, H, -1);
  const ink = col('#06040a');
  if (theme === 'forest') {
    const L: FgLook = { blade: ramp('#06120c', '#0c1e14', '#14301c', '#1e4426'), rim: col('#3e7034'), bush: ramp('#040a08', '#08140e', '#0e2016', '#16301e', '#22462a', '#346034'), ink };
    cornerBush(p, -8, 1, H, 1.45, L, 3);
    cornerBush(p, w + 8, -1, H, 1.05, L, 4);
    for (const [x, d, len] of [
      [6, 1, 30],
      [20, 1, 24],
      [36, 1, 19],
      [52, 1, 13],
      [w - 8, -1, 26],
      [w - 20, -1, 17],
    ] as const)
      frond(p, x, H - 1, len, d, SWAY[(frame + (x > w / 2 ? 2 : 0)) % 4], L);
    grassStrip(p, w, h, frame, L, 77);
    // a few flower heads in the shade, one dab of colour each
    const petals = [col('#c87a9a'), col('#d8c070'), col('#a8a0d8'), col('#e0d8c8')];
    for (let i = 0; i < 7; i++) {
      const x = 46 + Math.floor(hash(i, 3, 78) * (w - 92));
      const y = h - 4 - Math.floor(hash(i, 4, 78) * 3);
      const s = SWAY[(frame + Math.floor(x / 46)) % 4];
      for (let k = y + 1; k < h; k++) p.set(x, k, L.blade[1]);
      p.set(x + (y < h - 5 ? s : 0), y, petals[i % petals.length]);
      p.set(x + 1 + (y < h - 5 ? s : 0), y, L.blade[2]);
    }
  } else if (theme === 'ruins') {
    const L: FgLook = { blade: ramp('#030808', '#071210', '#0c1c18', '#142a24'), rim: col('#2e5450'), bush: ramp('#020406', '#05090e', '#0a1218', '#121e26', '#1c2e38', '#2a4250'), ink };
    // tumbled blocks in the left corner, a broken column stump in the right
    const block = (x0: number, y0: number, bw: number, bh: number) => {
      for (let y = y0; y < y0 + bh; y++)
        for (let x = x0; x < x0 + bw; x++) {
          const top = y === y0;
          const left = x === x0;
          const edge = x === x0 + bw - 1 || y === y0 + bh - 1;
          let c = top ? L.bush[4] : left ? L.bush[3] : pick(L.bush, 0.35 + (noise(x * 0.4, y * 0.4, 3) - 0.5) * 0.3, x, y);
          if (edge) c = ink;
          if (top && hash(x, y, 9) > 0.55) c = L.blade[3];
          p.set(x, y, c);
        }
    };
    block(-3, H - 13, 17, 13);
    block(10, H - 8, 13, 8);
    block(-2, H - 21, 11, 8);
    const c0 = w - 19;
    for (let y = H - 26; y < H; y++)
      for (let x = c0; x < w + 1; x++) {
        const k = x - c0;
        const jag = H - 26 + Math.floor(hash(x, 1, 5) * 4) + (k > 12 ? 3 : 0);
        if (y < jag) continue;
        let v = 0.82 - k * 0.05 + (noise(x * 0.3, y * 0.2, 4) - 0.5) * 0.2;
        if (k > 1 && k % 4 === 2) v -= 0.25;
        p.set(x, y, k === 0 || y === jag ? (k === 0 ? ink : L.bush[5]) : pick(L.bush, v, x, y));
      }
    for (let i = 0; i < 6; i++) pebble(p, 30 + Math.floor(hash(i, 4, 55) * (w - 60)), h - 1 + (i % 3 === 0 ? 2 : 0), 2 + (i % 2), 1, ramp('#06080e', '#0e141c', '#18222c', '#243440'), ink);
    for (const [x, d, len] of [
      [16, 1, 14],
      [24, 1, 10],
      [w - 22, -1, 13],
    ] as const)
      frond(p, x, H - 1, len, d, SWAY[(frame + (x > w / 2 ? 2 : 0)) % 4], L);
    grassStrip(p, w, h, frame, L, 55, 0.85);
  } else {
    const L: FgLook = { blade: ramp('#12040a', '#220a10', '#381218', '#521c1c'), rim: col('#c4602e'), bush: ramp('#0a0306', '#14060c', '#200a12', '#32121a', '#4a1c1e', '#6a2c22'), ink };
    // a great root arching out of the ground in each corner, lit along its top by the low sun
    const arch = (x0: number, dir: number, span: number, rise: number, th: number) => {
      for (let i = 0; i <= span; i++) {
        const t = i / span;
        const x = Math.round(x0 + dir * i);
        const yc = H - 1 - Math.sin(t * Math.PI) * rise;
        const r = th * (1 - Math.abs(t - 0.4) * 0.6);
        for (let y = Math.floor(yc - r); y <= Math.ceil(yc + r * 0.6); y++) {
          const ny = (y + 0.5 - yc) / r;
          if (ny < -1 || ny > 0.6) continue;
          let v = 0.5 - ny * 0.6;
          if (noise(x * 0.5, y * 0.4, x0) > 0.68) v -= 0.25;
          p.set(x, y, ny < -0.75 ? L.rim : ny > 0.45 ? ink : pick(L.bush, v, x, y));
        }
      }
    };
    cornerBush(p, -8, 1, H, 0.8, L, 12);
    cornerBush(p, w + 8, -1, H, 0.8, L, 13);
    arch(2, 1, 34, 11, 3);
    arch(w - 3, -1, 30, 9, 3);
    for (const [x, d, len] of [
      [8, 1, 17],
      [30, 1, 12],
      [w - 10, -1, 18],
      [w - 30, -1, 11],
    ] as const)
      frond(p, x, H - 1, len, d, SWAY[(frame + (x > w / 2 ? 2 : 0)) % 4], L);
    // drifts of dead leaves along the bottom
    const leafR = ramp('#1e060c', '#360c14', '#561a1a', '#7a2c20');
    for (let x = 40; x < w - 40; x += 18 + Math.floor(hash(x, 1, 91) * 26)) {
      const r = 2 + hash(x, 2, 91) * 2.5;
      mass(p, [{ x, y: h + 1, rx: r * 1.6, ry: r }], { ramp: leafR, seed: x + 3, bump: 0.3, tex: 0.4, vgrad: 0.3, light: -0.05, outline: ink });
    }
    grassStrip(p, w, h, frame, L, 91, 0.9);
    const capRed = ramp('#2a0610', '#5a0e18', '#8a1e22', '#b83a2e', '#e06a44');
    const stemR = ramp('#3a2228', '#6a5050', '#9a8478', '#c8b4a0');
    toadstool(p, 40, h, 2, capRed, stemR, ink, true);
    toadstool(p, 44, h + 1, 1, capRed, stemR, ink, true);
    toadstool(p, w - 42, h, 2, capRed, stemR, ink, true);
  }
  const [rim, mid] = theme === 'forest' ? [col('#5e9a3c'), col('#25492a')] : theme === 'ruins' ? [col('#40707e'), col('#1a3640')] : [col('#c45a30'), col('#5e1e1e')];
  backlight(p, rim, mid, theme.length);
  return p;
}

/** Greenmarch's backdrops (BOOT_THEMES), painted at boot for the current layout; the Frostpeaks' are painted the first
 *  time an act needs them (backdrop-frost.ts, Stage.ensure). */
export function buildBackdrops(scene: Phaser.Scene, w: number, h: number, ground: number): Partial<Record<Theme, Backdrop>> {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const out: Partial<Record<Theme, Backdrop>> = {};
  for (const [theme, make] of [
    ['forest', forest],
    ['ruins', ruins],
    ['hollow', hollow],
  ] as const) {
    const [bg, frame, info] = make(w, h, ground);
    add(`bg_${theme}`, bg.canvas());
    add(`frame_${theme}`, frame.canvas());
    for (let f = 0; f < FG_FRAMES; f++) {
      // the stage part goes in front of the actors; the last rows hang over the band (see FG_OVERLAP)
      const fg = foreground(theme, w, h, f);
      const top = new Pix(w, h, -1);
      top.buf.set(fg.buf.subarray(0, w * h));
      const over = new Pix(w, FG_OVERLAP, -1);
      over.buf.set(fg.buf.subarray(w * h));
      add(`fg_${theme}_${f}`, top.canvas());
      add(`fgo_${theme}_${f}`, over.canvas());
    }
    out[theme] = info;
  }
  return out;
}
