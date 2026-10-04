// Original level backdrops, painted into pixel buffers at boot. Each theme gives a background texture
// (`bg_<theme>`, opaque, framing included), a foreground strip drawn in front of the actors
// (`fg_<theme>`), the framing trees alone (`frame_<theme>`, transparent elsewhere: optional, for drawing
// them again above the drifting clouds) and the spots the scene animates on top (torch flames).
//
// How the painting works (see docs/art-style.md): every layer is built from organic shapes (scalloped
// leaf clumps, ridged massifs, uneven masonry) lit from the top left and quantised onto short,
// hue-shifted ramps. Far layers are mixed toward the haze colour (atmospheric perspective). Ordered
// dithering is only used for broad gradients: sky, mist, light shafts and torch light.
import type Phaser from 'phaser';

export type Theme = 'forest' | 'ruins';
export const THEMES: Theme[] = ['forest', 'ruins'];

export interface Backdrop {
  torches: Array<{ x: number; y: number }>; // flame base, game px
}

// ------------------------------------------------------------------ colour + noise toolkit

type Col = number; // 0xRRGGBB
type Ramp = Col[]; // dark -> light

const col = (s: string): Col => parseInt(s.slice(1), 16);
const ramp = (...s: string[]): Ramp => s.map(col);

function mix(a: Col, b: Col, t: number): Col {
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
function lighten(a: Col, l: Col, k: number): Col {
  const r = Math.min(255, (a >> 16) + Math.round((l >> 16) * k));
  const g = Math.min(255, ((a >> 8) & 255) + Math.round(((l >> 8) & 255) * k));
  const b = Math.min(255, (a & 255) + Math.round((l & 255) * k));
  return (r << 16) | (g << 8) | b;
}

const haze = (r: Ramp, to: Col, t: number): Ramp => r.map((c) => mix(c, to, t));

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const bay = (x: number, y: number) => (BAYER[y & 3][x & 3] + 0.5) / 16;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** t (0..1) quantised to `steps` levels; `band` > 0 dithers that fraction of each step boundary. */
function level(t: number, steps: number, x: number, y: number, band: number): number {
  const f = clamp01(t) * steps;
  const i = Math.min(steps - 1, Math.floor(f));
  const fr = f - i;
  const k = band > 0 ? clamp01((fr - 0.5) / band + 0.5) : fr >= 0.5 ? 1 : 0;
  return i + (k > bay(x, y) ? 1 : 0);
}

/** Value v (0..1) on a ramp, hard-edged or with a dithered band at each step. */
const pick = (r: Ramp, v: number, x: number, y: number, band = 0): Col => r[level(v, r.length - 1, x, y, band)];

/** Dithered step toward `to` (mist, halos). */
const fade = (c: Col, to: Col, t: number, x: number, y: number, steps = 3, band = 0.6): Col => {
  const q = level(t, steps, x, y, band) / steps;
  return q > 0 ? mix(c, to, q) : c;
};

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise, 0..1. */
function noise(x: number, y: number, s: number): number {
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
const fbm = (x: number, y: number, s: number) => noise(x, y, s) * 0.6 + noise(x * 2.1, y * 2.1, s + 7) * 0.28 + noise(x * 4.3, y * 4.3, s + 13) * 0.12;

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** RGB pixel buffer; -1 = transparent. */
class Pix {
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

// ------------------------------------------------------------------ shape painters

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface Mass {
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

function lambert(nx: number, ny: number): number {
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
function mass(p: Pix, blobs: Blob[], o: Mass): void {
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
function crown(rnd: () => number, cx: number, cy: number, rx: number, ry: number, size: number): Blob[] {
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
function tree(p: Pix, rnd: () => number, cx: number, cy: number, rx: number, ry: number, size: number, o: Mass): void {
  mass(p, crown(rnd, cx, cy, rx, ry, size), { form: { x: cx - rx * 0.1, y: cy, rx: rx * 1.1, ry: ry * 1.1 }, ...o });
}

/** Conifer: tiers of drooping, scalloped boughs, wider toward the base. */
function conifer(p: Pix, rnd: () => number, cx: number, base: number, hgt: number, wid: number, o: Mass): void {
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

interface TrunkOpts {
  ramp: Ramp;
  seed: number;
  outline?: Col;
  moss?: Ramp;
  flare?: number;
  wobble?: number;
}

/** Tree trunk lit from the left with vertical bark grooves, optional moss and a root flare. */
function trunk(p: Pix, cx0: number, yTop: number, yBot: number, wTop: number, wBot: number, lean: number, o: TrunkOpts): void {
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
function root(p: Pix, x: number, y: number, dir: number, len: number, r: Ramp, outline: Col): void {
  for (let i = 0; i < len; i++) {
    const yy = y + Math.round((i / len) ** 1.6 * 4);
    const th = i < len * 0.5 ? 2 : 1;
    p.set(x + dir * i, yy - th, r[r.length - 2]);
    if (th > 1) p.set(x + dir * i, yy - 1, r[1]);
    p.set(x + dir * i, yy, outline);
  }
}

/** Mountain massif: peak (x, y), slopes in px down per px across; lit face left of a wobbly ridge. */
function massif(p: Pix, mx: number, my: number, sl: number, sr: number, base: number, r: Ramp, seed: number, snow?: Ramp): void {
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
function tuft(p: Pix, x: number, y: number, hgt: number, r: Ramp, seed: number): void {
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
function pebble(p: Pix, x: number, y: number, rw: number, rh: number, r: Ramp, shadow: Col): void {
  for (let yy = -rh; yy <= rh; yy++)
    for (let xx = -rw; xx <= rw; xx++) {
      if ((xx * xx) / (rw * rw + 0.4) + (yy * yy) / (rh * rh + 0.4) > 1) continue;
      const v = 0.55 - (xx / (rw + 0.5)) * 0.25 - (yy / (rh + 0.5)) * 0.4;
      p.set(x + xx, y + yy, pick(r, v, x + xx, y + yy));
    }
  for (let xx = -rw + 1; xx <= rw; xx++) p.set(x + xx, y + rh + 1, shadow);
}

/** Boulder: a lumpy dome standing on `base`, lit from the top left, with a moss cap and contact shadow. */
function rock(p: Pix, cx: number, base: number, rx: number, ry: number, r: Ramp, moss: Ramp, shadow: Col, seed: number): void {
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
function shafts(p: Pix, list: Array<[number, number, number]>, slope: number, y0: number, y1: number, to: Col, amt: number): void {
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
function torchLight(p: Pix, cx: number, cy: number, rx: number, ry: number, warm: Col, k: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const q = level((1 - d) ** 1.4, 3, x, y, 0.3) / 3;
      if (q > 0) p.tint(x, y, (c) => lighten(c, warm, q * k));
    }
}

/** Hanging vine / moss strand with leaf pairs. */
function vine(p: Pix, x: number, y: number, len: number, r: Ramp, seed: number): void {
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
function cornerCanopy(p: Pix, cx: number, dir: number, reach: number, seed: number, leaf: Ramp, vines: Ramp): void {
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

/** Pixels that changed since `before` (the framing layer, drawn again above the drifting clouds). */
function changed(p: Pix, before: Int32Array): Pix {
  const f = new Pix(p.w, p.h, -1);
  for (let i = 0; i < p.buf.length; i++) if (p.buf[i] !== before[i]) f.buf[i] = p.buf[i];
  return f;
}

/** Fern / bush clump for a bottom corner of the foreground strip. */
function fern(f: Pix, fx: number, dir: number, h: number, leaf: Ramp, ink: Col, seed: number): void {
  const bl: Blob[] = [];
  for (let i = 0; i < 9; i++) bl.push({ x: fx + dir * (i * 2.2 - 4), y: h - 2 - Math.sin((i / 8) * Math.PI) * 9, rx: 4, ry: 3.2 });
  mass(f, bl, { ramp: leaf, seed, bump: 0.25, tex: 0.3, vgrad: 0.25, light: -0.05, outline: ink, form: { x: fx + dir * 6, y: h - 8, rx: 14, ry: 10 }, formMix: 0.4 });
}

// ------------------------------------------------------------------ forest (Level 1): bright woodland clearing

function forest(w: number, h: number, G: number): [Pix, Pix, Pix, Backdrop] {
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
  plant(G - 18, 0.2, 1.1, 0, 4, 31);
  plant(G - 15, 0, 0.95, 6, 22, 37);
  // bushes along the foot of the tree line
  const bushR = ramp('#1d4630', '#295c36', '#39763c', '#4f9046', '#6eac52');
  for (let x = 4; x < w; x += 16 + rnd() * 26) {
    const rx = 4 + rnd() * 4;
    tree(p, rnd, x, G - 15, rx, 3.5, 2.3, { ramp: bushR, seed: Math.round(x) + 1, bump: 0.2, tex: 0.25, vgrad: 0.3, floor: G - 13 });
  }
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

  // foreground strip: tufts and flowers along the bottom edge, ferns in the corners
  const f = new Pix(w, h, -1);
  const fgR = ramp('#1c4a22', '#2a6428', '#3e8030', '#5ea03c');
  for (let x = 0; x < w; x += 2 + Math.floor(hash(x, 1, 77) * 4)) tuft(f, x, h, 2 + Math.floor(hash(x, 2, 77) * 3), fgR, x);
  for (let i = 0; i < 9; i++) {
    const x = 30 + Math.floor(hash(i, 3, 77) * (w - 60));
    f.set(x, h - 4, petals[i % 3]);
    f.set(x, h - 3, fgR[1]);
  }
  const fernR = ramp('#10281a', '#1a3a20', '#285428', '#3a6e30', '#56883a');
  fern(f, 4, 1, h, fernR, ink, 7);
  fern(f, w - 4, -1, h, fernR, ink, 8);
  return [p, f, frame, { torches: [] }];
}

// ------------------------------------------------------------------ ruins (Level 2): moonlit, rainy, torches

function ruins(w: number, h: number, G: number): [Pix, Pix, Pix, Backdrop] {
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

  // foreground strip: dark rubble and grass along the bottom, ferns in the corners
  const f = new Pix(w, h, -1);
  const fgR = ramp('#0c1a16', '#14281e', '#1e3a28', '#2c5032');
  for (let x = 0; x < w; x += 3 + Math.floor(hash(x, 1, 55) * 5)) tuft(f, x, h, 2 + Math.floor(hash(x, 2, 55) * 3), fgR, x);
  const fgRock = ramp('#0e141c', '#18222c', '#243440', '#344a54');
  for (let i = 0; i < 7; i++) pebble(f, 24 + Math.floor(hash(i, 4, 55) * (w - 48)), h - 2, 2 + (i % 2), 1, fgRock, ink);
  const fernR = ramp('#060e10', '#0c1a18', '#14281e', '#1e3a28', '#2e5232');
  fern(f, 4, 1, h, fernR, ink, 9);
  fern(f, w - 4, -1, h, fernR, ink, 10);
  return [p, f, frame, { torches }];
}

export function buildBackdrops(scene: Phaser.Scene, w: number, h: number, ground: number): Record<Theme, Backdrop> {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const out = {} as Record<Theme, Backdrop>;
  for (const [theme, make] of [
    ['forest', forest],
    ['ruins', ruins],
  ] as const) {
    const [bg, fg, frame, info] = make(w, h, ground);
    add(`bg_${theme}`, bg.canvas());
    add(`fg_${theme}`, fg.canvas());
    add(`frame_${theme}`, frame.canvas());
    out[theme] = info;
  }
  return out;
}
