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
    top: 0.4,
    rim: 0xfff0b8,
    rimAmt: 0.75,
    rimLeft: 0.6,
    rimTop: 1,
    shadow: 0x0c1a14,
    shadowDx: 2,
    shadowLen: 1.1,
    dust: [0xc8a878, 0xa88a60, 0xe0c898],
    pool: 0xffe0a0,
    poolAmt: 0.2,
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
  // an overcast afternoon: soft cool light from a veiled sun high on the left, blue shadows on the snow
  pass: {
    shade: 0x3a4270,
    vignette: 0.46,
    floor: 0.4,
    top: 0.2,
    rim: 0xfff2e0,
    rimAmt: 0.6,
    rimLeft: 0.6,
    rimTop: 1,
    shadow: 0x262e5a,
    shadowDx: 2,
    shadowLen: 1.1,
    dust: [0xe8eef8, 0xc4cee6, 0xffffff],
    pool: 0xfff4e4,
    poolAmt: 0.1,
  },
  // the caves: cold light from the crystals and a crack in the roof, deep shade everywhere else
  caves: {
    shade: 0x0a0c2c,
    vignette: 0.7,
    floor: 0.52,
    top: 0.42,
    rim: 0x9ae4ff,
    rimAmt: 0.72,
    rimLeft: 0.55,
    rimTop: 1,
    shadow: 0x03041a,
    shadowDx: 1,
    shadowLen: 1,
    dust: [0x8ab4d8, 0x5a78a4, 0xbce4f4],
    pool: 0x8ad8ff,
    poolAmt: 0.13,
  },
  // the glacier at night: the aurora overhead lights everything from above in green, the ice glows back
  glacier: {
    shade: 0x0e1838,
    vignette: 0.62,
    floor: 0.48,
    top: 0.16,
    rim: 0x9affd0,
    rimAmt: 0.74,
    rimLeft: 0.35,
    rimTop: 1,
    shadow: 0x050a20,
    shadowDx: 1,
    shadowLen: 1,
    dust: [0xdcf0ff, 0xa8c6e6, 0xffffff],
    pool: 0x9cffd8,
    poolAmt: 0.1,
  },
  // the Cinder Flats: a smoky afternoon, the sky burning orange low down; the fighters rimmed warm by the volcano's
  // glow, plum shade, ash kicked up grey
  cinder: {
    shade: 0x3a1a26,
    vignette: 0.58,
    floor: 0.46,
    top: 0.34,
    rim: 0xffb070,
    rimAmt: 0.78,
    rimLeft: 0.5,
    rimTop: 1,
    shadow: 0x160a10,
    shadowDx: 2,
    shadowLen: 1.1,
    dust: [0x8a7874, 0x6e5e5c, 0xa8968e],
    pool: 0xff9a50,
    poolAmt: 0.12,
  },
  // the Glass Warrens: dark tunnels lit by the magma lake behind and the coloured glass, deep violet shade
  glass: {
    shade: 0x160c26,
    vignette: 0.68,
    floor: 0.52,
    top: 0.42,
    rim: 0xffa868,
    rimAmt: 0.72,
    rimLeft: 0.4,
    rimTop: 0.9,
    shadow: 0x06030e,
    shadowDx: 1,
    shadowLen: 1,
    dust: [0x4a3a5a, 0x6a5a7a, 0x8a7a9a],
    pool: 0xff7a3a,
    poolAmt: 0.14,
  },
  // the Black Forge: the furnace roaring behind the fighters, red-black smoke overhead, everything rimmed in fire
  forge: {
    shade: 0x2c0a12,
    vignette: 0.66,
    floor: 0.5,
    top: 0.38,
    rim: 0xff8a48,
    rimAmt: 0.86,
    rimLeft: 0.3,
    rimTop: 0.85,
    shadow: 0x0a0204,
    shadowDx: 1,
    shadowLen: 1,
    dust: [0x5a3a30, 0x7a4a38, 0x3a2420],
    pool: 0xff6a2a,
    poolAmt: 0.18,
  },
  // Lanternfen: a violet dusk that never ends, the low sky rose behind; the fighters rimmed rose from the top left,
  // lantern-warm light pooled where they stand
  fen: {
    shade: 0x1c1440,
    vignette: 0.74,
    floor: 0.5,
    top: 0.36,
    rim: 0xf0a0c0,
    rimAmt: 0.74,
    rimLeft: 0.7,
    rimTop: 0.9,
    shadow: 0x0a0614,
    shadowDx: 2,
    shadowLen: 1.2,
    dust: [0x5a4a5a, 0x6e5e66, 0x46384a],
    pool: 0xffb060,
    poolAmt: 0.14,
  },
  // the Drowned Causeway: a cooler teal-violet dusk over the flats, the rim pale lilac, wet stone underfoot
  causeway: {
    shade: 0x141a3c,
    vignette: 0.72,
    floor: 0.48,
    top: 0.34,
    rim: 0xd0b8f0,
    rimAmt: 0.72,
    rimLeft: 0.6,
    rimTop: 1,
    shadow: 0x06081a,
    shadowDx: 2,
    shadowLen: 1.1,
    dust: [0x7aaab0, 0x5a6a80, 0xb4c4cc],
    pool: 0xffc070,
    poolAmt: 0.1,
  },
  // the Gloaming Mere: the sky stuck at sunset, the lighthouse's lamp far off on the right; red-rose rims, deep plum
  // shade, the black lake under it all
  mere: {
    shade: 0x1c0e30,
    vignette: 0.76,
    floor: 0.52,
    top: 0.38,
    rim: 0xff9a7a,
    rimAmt: 0.82,
    rimLeft: 0.75,
    rimTop: 0.6,
    shadow: 0x0c040e,
    shadowDx: 3,
    shadowLen: 1.3,
    dust: [0x5a4658, 0x46364a, 0x7a6070],
    pool: 0xffa060,
    poolAmt: 0.12,
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
      const kt = L.top * Math.pow(clamp01(1 - y / (h * 0.36)), 2);
      const k = 1 - (1 - kv) * (1 - kf) * (1 - kt);
      out.set(x, y, L.shade, k);
    }
  return out;
}

/** Light rays (ADD): soft beams with smooth falloff across and along them, fading out before the ground. */
function rays(w: number, h: number, G: number, theme: Theme): Rgba {
  const out = new Rgba(w, h);
  if (theme === 'pass' || theme === 'caves' || theme === 'glacier') return frostRays(out, w, h, G, theme);
  if (theme === 'cinder' || theme === 'glass' || theme === 'forge') return ashRays(out, w, h, G, theme);
  if (theme === 'fen' || theme === 'causeway' || theme === 'mere') return duskRays(out, w, h, G, theme);
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
        const a = (v * along * 0.18 + bloom * 0.34) * ground;
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

/**
 * The Frostpeaks' light (ADD): in the pass, a veiled sun's bloom and faint beams fanning down through the snow; in
 * the caves, cold shafts falling from a crack in the roof; on the glacier, the aurora's glow washing the sky (the
 * stage breathes and sways it, so it shimmers).
 */
function frostRays(out: Rgba, w: number, h: number, G: number, theme: 'pass' | 'caves' | 'glacier'): Rgba {
  if (theme === 'pass') {
    const sx = Math.round(w * 0.4);
    const sy = 26;
    const beams = [0.32, 0.55, 0.78, 1.02, 1.26];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - sx;
        const dy = (y + 0.5 - sy) * 1.3;
        const d = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        let v = 0;
        for (let i = 0; i < beams.length; i++) {
          const q = (ang - beams[i]) / (0.07 + (i % 2) * 0.03);
          v += Math.exp(-q * q) * (i % 2 ? 0.6 : 1);
        }
        const along = ss(10, 36, d) * (1 - ss(70, 170, d));
        const bloom = Math.pow(clamp01(1 - d / 52), 2) * 0.5;
        const ground = 1 - ss(G - 20, G + 4, y) * 0.8;
        const a = (v * along * 0.1 + bloom * 0.3) * ground;
        if (a > 0.004) out.set(x, y, 0xfff2dc, a);
      }
    return out;
  }
  if (theme === 'caves') {
    // a crack in the roof above the middle of the cavern: two narrow beams and a wider faint one, slanting right
    const list: Array<[number, number, number]> = [
      [Math.round(w * 0.38), 7, 1],
      [Math.round(w * 0.45), 4, 0.8],
      [Math.round(w * 0.31), 13, 0.45],
    ];
    for (let y = 0; y < h; y++) {
      const f = ss(4, 18, y) * (1 - ss(G - 26, G + 6, y) * 0.8);
      for (let x = 0; x < w; x++) {
        let v = 0;
        for (const [x0, wid, k] of list) {
          const cx = x0 + y * 0.28;
          const u = Math.abs(x + 0.5 - cx) / (wid / 2 + y * 0.04);
          if (u < 1) v += (1 - u * u) * (1 - u * u) * k;
        }
        if (v > 0) out.set(x, y, 0xa8e8ff, Math.min(1, v) * f * 0.16);
      }
    }
    // where they land, the floor glows a little
    const lx = Math.round(w * 0.38 + (G - 6) * 0.28);
    for (let y = G - 14; y < Math.min(h, G + 8); y++)
      for (let x = lx - 30; x < lx + 30; x++) {
        const d = Math.hypot((x + 0.5 - lx) / 26, (y + 0.5 - G) / 7);
        if (d < 1 && x >= 0 && x < w) {
          const i = (y * w + x) * 4;
          out.set(x, y, 0xa8e8ff, Math.min(1, out.d[i + 3] / 255 + Math.pow(1 - d, 2) * 0.12));
        }
      }
    return out;
  }
  // the aurora: curtains whose bright lower hems wave across the sky, green below, violet above
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hem = 30 + Math.sin(x * 0.021 + 0.8) * 9 + Math.sin(x * 0.057 + 2) * 4;
      const up = hem - y; // px above the hem
      if (up < -6) continue;
      const fold = 0.55 + 0.45 * Math.sin(x * 0.19 + Math.sin(x * 0.05) * 3);
      const k = (up < 0 ? Math.max(0, 1 + up / 6) : Math.exp(-up / 22)) * fold;
      const green = clamp01(1 - up / 26);
      const c = green > 0.5 ? 0x7affc0 : 0xb48aff;
      const a = k * (0.16 * green + 0.1 * (1 - green)) * (1 - ss(G - 30, G - 6, y));
      if (a > 0.004) out.set(x, y, c, a);
    }
  return out;
}

/**
 * Ashfell's light (ADD): on the Cinder Flats the volcano's glow blooming on the horizon and a band of fire-lit haze low
 * over the plain; in the Glass Warrens the magma lake's glow through the gap in the far wall; in the Black Forge the
 * furnace's mouth blazing behind the fighters, heat rising off it in faint wavering columns.
 */
function ashRays(out: Rgba, w: number, h: number, G: number, theme: 'cinder' | 'glass' | 'forge'): Rgba {
  const [bx, by, br, col, amt] =
    theme === 'cinder' ? [w * 0.63, G - 42, 70, 0xff9a4a, 0.34] : theme === 'glass' ? [w * 0.52, G - 30, 64, 0xff7a3a, 0.3] : [w * 0.5, G - 22, 80, 0xff7034, 0.4];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - bx) * 0.75, (y + 0.5 - by) * 1.3);
      let a = Math.pow(clamp01(1 - d / br), 2) * amt;
      if (theme === 'cinder') a += clamp01(1 - Math.abs(y - (G - 18)) / 10) * 0.07; // the fire-lit haze over the plain
      if (theme === 'forge') {
        // heat rising off the furnace: faint columns that sway
        const col2 = Math.sin(x * 0.21 + Math.sin(y * 0.09) * 1.6);
        if (col2 > 0.7 && Math.abs(x - bx) < 60) a += (col2 - 0.7) * 0.12 * clamp01(1 - y / (G - 10)) * clamp01(1 - Math.abs(x - bx) / 60);
      }
      a *= 1 - ss(G - 6, G + 8, y) * 0.6;
      if (a > 0.004) out.set(x, y, col, a);
    }
  return out;
}

/**
 * The Duskmire's light (ADD): the low sky's afterglow along the horizon (rose in the fen, a cooler band over the
 * flats, burning on the mere), and on the mere the lighthouse's lamp blooming far off with its beam laid low across the
 * water toward the fighters.
 */
function duskRays(out: Rgba, w: number, h: number, G: number, theme: 'fen' | 'causeway' | 'mere'): Rgba {
  const [hx, hy, hr, hc, amt] = theme === 'fen' ? [w * 0.3, G - 30, 110, 0xc88aa8, 0.1] : theme === 'causeway' ? [w * 0.7, G - 34, 110, 0xa898d0, 0.09] : [w * 0.5, G - 32, 120, 0xd07a7a, 0.13];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - hx) * 0.45, (y + 0.5 - hy) * 2.2);
      let a = Math.pow(clamp01(1 - d / hr), 2) * amt;
      let c = hc;
      if (theme === 'mere') {
        // the lamp's bloom and its beam across the lake (drawn in the backdrop: this is its glow on the air)
        const ld = Math.hypot(x + 0.5 - 214, (y + 0.5 - (G - 62)) * 1.2);
        const la = Math.pow(clamp01(1 - ld / 30), 2) * 0.4;
        const along = 214 - x;
        const bm = along > 0 ? Math.pow(clamp01(1 - Math.abs(y - (G - 62 + along * 0.16)) / (2 + along * 0.05)), 2) * clamp01(1 - along / 150) * 0.14 : 0;
        if (la + bm > a) c = 0xffd890;
        a = Math.max(a, la + bm);
      }
      a *= 1 - ss(G - 6, G + 8, y) * 0.6;
      if (a > 0.004) out.set(x, y, c, a);
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

/** The Frostpeaks' drifting banks (far, near): snow haze in the pass, cold mist over the caves' lake, spindrift on
 *  the glacier. */
const FROST_MIST: Record<'pass' | 'caves' | 'glacier', (w: number, h: number, G: number) => [Rgba, Rgba]> = {
  pass: (w, h, G) => [patches(w, h, G - 34, G + 2, 0xe6e8f6, 0.24, 31, 0.46, 0.02, 0.12), patches(w, h, G - 5, h, 0xd4dcf0, 0.16, 37, 0.52, 0.014, 0.16)],
  caves: (w, h, G) => [patches(w, h, G - 30, G - 6, 0x7aa8d8, 0.2, 41, 0.46, 0.022, 0.14), patches(w, h, G - 4, h, 0x4a70a8, 0.14, 43, 0.54, 0.014, 0.16)],
  glacier: (w, h, G) => [patches(w, h, G - 26, G + 4, 0xc4dcf0, 0.2, 47, 0.47, 0.024, 0.12), patches(w, h, G - 6, h, 0xb0cce4, 0.18, 53, 0.5, 0.016, 0.18)],
};

/** Ashfell's drifting banks (far, near): ash haze over the plain, hot haze in the warrens, smoke in the forge. */
const ASH_MIST: Record<'cinder' | 'glass' | 'forge', (w: number, h: number, G: number) => [Rgba, Rgba]> = {
  cinder: (w, h, G) => [patches(w, h, G - 32, G + 2, 0x9a7068, 0.22, 61, 0.46, 0.02, 0.12), patches(w, h, G - 5, h, 0x6a4c4c, 0.16, 67, 0.52, 0.014, 0.16)],
  glass: (w, h, G) => [patches(w, h, G - 30, G - 6, 0x8a3c3c, 0.16, 71, 0.48, 0.022, 0.14), patches(w, h, G - 4, h, 0x3a2048, 0.16, 73, 0.54, 0.014, 0.16)],
  forge: (w, h, G) => [patches(w, h, G - 34, G + 2, 0x7a2a20, 0.22, 79, 0.46, 0.022, 0.12), patches(w, h, G - 6, h, 0x4a1a14, 0.18, 83, 0.5, 0.016, 0.18)],
};

/** The Duskmire's drifting banks (far, near): mist lying on the fen's black pools, a sea haze over the flats, the
 *  mere's low fog. */
const DUSK_MIST: Record<'fen' | 'causeway' | 'mere', (w: number, h: number, G: number) => [Rgba, Rgba]> = {
  fen: (w, h, G) => [patches(w, h, G - 26, G - 4, 0x6e6a96, 0.22, 91, 0.45, 0.022, 0.14), patches(w, h, G - 5, h, 0x3e3a62, 0.18, 93, 0.52, 0.014, 0.16)],
  causeway: (w, h, G) => [patches(w, h, G - 30, G - 4, 0x6a7898, 0.2, 97, 0.46, 0.02, 0.12), patches(w, h, G - 5, h, 0x3a4462, 0.16, 99, 0.52, 0.014, 0.16)],
  mere: (w, h, G) => [patches(w, h, G - 28, G - 4, 0x7a5a7e, 0.18, 101, 0.46, 0.022, 0.12), patches(w, h, G - 6, h, 0x3a2442, 0.2, 103, 0.5, 0.016, 0.18)],
};

/** One Frostpeaks or Ashfell theme's stage textures for the current layout (painted the first time an act needs them). */
export function buildStageTheme(scene: Phaser.Scene, w: number, h: number, G: number, theme: 'pass' | 'caves' | 'glacier' | 'cinder' | 'glass' | 'forge' | 'fen' | 'causeway' | 'mere'): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  add(`st_grade_${theme}`, grade(w, h, G, STAGE_LIGHT[theme]).canvas());
  add(`st_rays_${theme}`, rays(w, h, G, theme).canvas());
  const [far, near] = theme === 'cinder' || theme === 'glass' || theme === 'forge' ? ASH_MIST[theme](w, h, G) : theme === 'fen' || theme === 'causeway' || theme === 'mere' ? DUSK_MIST[theme](w, h, G) : FROST_MIST[theme](w, h, G);
  add(`st_mist_${theme}`, far.canvas());
  add(`st_mist_${theme}_near`, near.canvas());
}

/** Paint every stage texture for the current layout (stage height h, feet line G): the shared ones and Greenmarch's
 *  (the Frostpeaks' come later, buildStageTheme). */
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
  add('st_mist_ruins', patches(w, h, G - 30, G + 4, 0x7e98b0, 0.3, 11, 0.44, 0.02, 0.12).canvas());
  add('st_mist_ruins_near', patches(w, h, G - 6, h, 0x6a84a0, 0.22, 17, 0.5, 0.014, 0.16).canvas());
  add('st_mist_hollow', patches(w, h, G - 28, G + 2, 0xe8a098, 0.17, 23, 0.48, 0.02, 0.12).canvas());
  add('st_mist_hollow_near', patches(w, h, G - 4, h, 0xb86a7a, 0.12, 29, 0.54, 0.014, 0.16).canvas());
}
