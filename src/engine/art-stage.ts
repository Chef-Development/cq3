// Stage atmosphere, painted once per layout: the colour grade (vignette, shade toward the camera and under the
// canopy), light rays, a soft glow sprite, cloud shadows and mist banks, and the rim-light masks for the fighters.
// Light overlays are smooth per game pixel (no dither): they read as light falling on the scene, not as paint.
// Every theme keeps its light in one place (STAGE_LIGHT) so the stage, the fighters and the effects agree.
import type Phaser from 'phaser';
import { clamp01, hash, type Col, type Theme } from './backdrop';

export interface StageLight {
  /** Multiply colour of the grade (cool shadow, hue-shifted per theme) and its strengths. */
  shade: Col;
  vignette: number;
  floor: number; // shade toward the camera (below the feet line)
  top: number; // shade under the canopy along the top edge
  /** Rim light on the fighters: colour, strength, and how much comes from the left vs. from above. */
  rim: Col;
  rimAmt: number;
  rimLeft: number;
  rimTop: number;
  /** Contact shadows (cast away from the light: offset and stretch) and the dust kicked up off the ground. */
  shadow: Col;
  shadowDx: number;
  shadowLen: number;
  dust: readonly Col[];
  /** Warm light pooled where the fighters stand. */
  pool: Col;
  poolAmt: number;
}

export const STAGE_LIGHT: Record<Theme, StageLight> = {
  // late-morning sun through the canopy, from the top left
  forest: {
    shade: 0x2c3c5a,
    vignette: 0.6,
    floor: 0.5,
    top: 0.32,
    rim: 0xfff0b8,
    rimAmt: 0.75,
    rimLeft: 0.6,
    rimTop: 1,
    shadow: 0x0c1a14,
    shadowDx: 2,
    shadowLen: 1.1,
    dust: [0xc8a878, 0xa88a60, 0xe0c898],
    pool: 0xffe0a0,
    poolAmt: 0.16,
  },
  // moonlight from the top left, braziers below
  ruins: {
    shade: 0x0a1024,
    vignette: 0.66,
    floor: 0.5,
    top: 0.3,
    rim: 0x9ac0ff,
    rimAmt: 0.7,
    rimLeft: 0.7,
    rimTop: 1,
    shadow: 0x02040a,
    shadowDx: 1,
    shadowLen: 1,
    dust: [0x6a7888, 0x8a96a4, 0x4e5a68],
    pool: 0xff9a50,
    poolAmt: 0.1,
  },
  // the low sunset sun on the left
  hollow: {
    shade: 0x2a0c2c,
    vignette: 0.64,
    floor: 0.5,
    top: 0.34,
    rim: 0xffa050,
    rimAmt: 0.85,
    rimLeft: 1,
    rimTop: 0.45,
    shadow: 0x10040c,
    shadowDx: 6,
    shadowLen: 1.55,
    dust: [0x9a6060, 0xb87a6a, 0x7a4450],
    pool: 0xffa060,
    poolAmt: 0.14,
  },
};

// ------------------------------------------------------------------ RGBA buffer

class Rgba {
  readonly d: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: Col, a: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c >> 16;
    this.d[i + 1] = (c >> 8) & 255;
    this.d[i + 2] = c & 255;
    this.d[i + 3] = Math.round(clamp01(a) * 255);
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.d);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Value noise that wraps every `period` cells in x (for layers that scroll forever). */
function tnoise(x: number, y: number, s: number, period: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let fx = x - xi;
  let fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const m = (v: number) => ((v % period) + period) % period;
  const a = hash(m(xi), yi, s);
  const b = hash(m(xi + 1), yi, s);
  const c = hash(m(xi), yi + 1, s);
  const d = hash(m(xi + 1), yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const tfbm = (x: number, y: number, s: number, p: number) => tnoise(x, y, s, p) * 0.62 + tnoise(x * 2, y * 2, s + 7, p * 2) * 0.26 + tnoise(x * 4, y * 4, s + 13, p * 4) * 0.12;

// ------------------------------------------------------------------ painters

/** The grade, drawn with MULTIPLY over the actors: a vignette, the floor darkening toward the camera, canopy shade. */
function grade(w: number, h: number, G: number, L: StageLight): Rgba {
  const out = new Rgba(w, h);
  const cy = G - 22;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ex = (x + 0.5 - w / 2) / (w / 2);
      const ey = (y + 0.5 - cy) / (h * 0.62);
      const r = Math.sqrt(ex * ex + ey * ey * 1.5);
      const kv = L.vignette * ss(0.5, 1.32, r);
      const kf = L.floor * Math.pow(clamp01((y - G - 1) / (h - G - 1)), 1.25);
      const kt = L.top * Math.pow(clamp01(1 - y / (h * 0.32)), 2);
      const k = 1 - (1 - kv) * (1 - kf) * (1 - kt);
      out.set(x, y, L.shade, k);
    }
  return out;
}

/** Light rays (ADD): soft beams with smooth falloff across and along them, fading out before the ground. */
function rays(w: number, h: number, G: number, theme: Theme): Rgba {
  const out = new Rgba(w, h);
  if (theme === 'hollow') {
    // the low sun on the left: long beams raking right across the den, a bloom around the disc
    const sx = Math.round(w * 0.24);
    const sy = G - 38;
    const beams = [-0.34, -0.17, 0.02, 0.15, 0.3, 0.44];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - sx;
        const dy = (y + 0.5 - sy) * 1.6;
        const d = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        let v = 0;
        for (let i = 0; i < beams.length; i++) {
          const wid = 0.045 + (i % 3) * 0.02;
          const q = (ang - beams[i]) / wid;
          v += Math.exp(-q * q) * (0.7 + 0.3 * ((i * 7) % 3) / 2);
        }
        const along = ss(8, 40, d) * (1 - ss(120, 260, d));
        const bloom = Math.pow(clamp01(1 - d / 46), 2.2) * 0.9;
        const ground = 1 - ss(G - 10, G + 6, y) * 0.7;
        const a = (v * along * 0.2 + bloom * 0.42) * ground;
        out.set(x, y, 0xffb070, a);
      }
    return out;
  }
  // forest: sunbeams slanting down from the canopy gap; ruins: faint moonbeams
  const warm = theme === 'forest';
  const list: Array<[number, number, number]> = warm
    ? [
        [40, 13, 1],
        [84, 7, 0.7],
        [122, 18, 0.9],
        [178, 9, 0.6],
        [236, 12, 0.5],
      ]
    : [
        [70, 16, 0.9],
        [128, 9, 0.6],
        [196, 14, 0.55],
      ];
  const slope = warm ? 0.55 : 0.42;
  const col = warm ? 0xfff2c0 : 0x9ab8ff;
  const amt = warm ? 0.17 : 0.1;
  for (let y = 0; y < h; y++) {
    const f = ss(0, 26, y) * (1 - ss(G - 30, G + 4, y) * 0.85);
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (const [x0, wid, k] of list) {
        const cx = x0 + y * slope;
        const u = Math.abs(x + 0.5 - cx) / (wid / 2);
        if (u < 1) v += (1 - u * u) * (1 - u * u) * k;
      }
      if (v > 0) out.set(x, y, col, Math.min(1, v) * f * amt);
    }
  }
  if (!warm) {
    // a cool bloom around the moon
    const mx = Math.round(w * 0.3);
    const my = G - 54;
    for (let y = Math.max(0, my - 40); y < my + 40; y++)
      for (let x = mx - 50; x < mx + 50; x++) {
        const d = Math.hypot(x + 0.5 - mx, (y + 0.5 - my) * 1.2);
        const b = Math.pow(clamp01(1 - d / 40), 2) * 0.35;
        if (b > 0) {
          const i = (y * w + x) * 4;
          const prev = x >= 0 && x < w ? out.d[i + 3] / 255 : 0;
          out.set(x, y, 0xa8c4ff, Math.min(1, prev + b));
        }
      }
  }
  return out;
}

/** A soft round glow (ADD), white so it can be tinted. */
function glow(size: number): Rgba {
  const out = new Rgba(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      if (d < 1) out.set(x, y, 0xffffff, Math.pow(1 - d, 2));
    }
  return out;
}

/**
 * Patches that scroll across the ground forever (the width wraps): cloud shadows in the meadow (MULTIPLY), mist
 * banks in the ruins and the hollow (NORMAL). `y0..y1` is the band they cover, `y1` fading out.
 */
function patches(w: number, h: number, y0: number, y1: number, color: Col, amt: number, seed: number, thresh: number, sx: number, sy: number): Rgba {
  const out = new Rgba(w, h);
  const cells = Math.max(2, Math.round(w * sx));
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    const band = ss(y0, y0 + (y1 - y0) * 0.35, y) * (1 - ss(y1 - (y1 - y0) * 0.25, y1, y));
    for (let x = 0; x < w; x++) {
      const n = tfbm((x / w) * cells, y * sy, seed, cells);
      const a = ss(thresh, thresh + 0.16, n) * band * amt;
      if (a > 0.004) out.set(x, y, color, a);
    }
  }
  return out;
}

/** Rim-light mask of a sprite: the edge facing the light, bright on the first pixel inside the outline. */
export function rimMask(src: HTMLCanvasElement, left: number, top: number): HTMLCanvasElement | null {
  const ctx = src.getContext('2d');
  if (!ctx) return null;
  const w = src.width;
  const h = src.height;
  const s = ctx.getImageData(0, 0, w, h).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] >= 128;
  const out = new Rgba(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) continue;
      // the outline pixel facing the light glows faintly; the first pixel inside it catches the light
      const edge = Math.max(solid(x - 1, y) ? 0 : left, solid(x, y - 1) ? 0 : top);
      const inner = Math.max(!solid(x - 2, y) && solid(x - 1, y) ? left : 0, !solid(x, y - 2) && solid(x, y - 1) ? top : 0);
      const v = Math.max(edge * 0.32, inner);
      if (v > 0) out.set(x, y, 0xffffff, v);
    }
  return out.canvas();
}

// ------------------------------------------------------------------ build

export const RAYS_DRIFT = 4; // the ray layers are this much wider on each side, so they can sway

/** Paint every stage texture for the current layout (stage height h, feet line G). */
export function buildStageArt(scene: Phaser.Scene, w: number, h: number, G: number): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  add('st_glow', glow(32).canvas());
  add('st_glow_s', glow(12).canvas());
  for (const theme of ['forest', 'ruins', 'hollow'] as const) {
    add(`st_grade_${theme}`, grade(w, h, G, STAGE_LIGHT[theme]).canvas());
    add(`st_rays_${theme}`, rays(w, h, G, theme).canvas());
  }
  // drifting cloud shadows over the meadow; mist banks in the ruins and the hollow (two depths each)
  add('st_cloudshade', patches(w, h, G - 26, h, 0x1c2a40, 0.36, 5, 0.47, 0.026, 0.1).canvas());
  add('st_mist_ruins', patches(w, h, G - 30, G + 4, 0x7e98b0, 0.38, 11, 0.42, 0.02, 0.12).canvas());
  add('st_mist_ruins_near', patches(w, h, G - 6, h, 0x6a84a0, 0.22, 17, 0.5, 0.014, 0.16).canvas());
  add('st_mist_hollow', patches(w, h, G - 28, G + 2, 0xf0a8a0, 0.3, 23, 0.44, 0.02, 0.12).canvas());
  add('st_mist_hollow_near', patches(w, h, G - 4, h, 0xc87a86, 0.18, 29, 0.52, 0.014, 0.16).canvas());
}
