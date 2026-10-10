// A small painting toolkit for sprites and portraits painted as lit volumes (see docs/art-style.md), shared by the
// gear and camp art (the same approach as the portraits in art-story.ts): forms are filled from inside-tests and
// lit like spheres from the top left onto short, hue-shifted ramps; details are stamped from small character maps,
// and toCanvas (art.ts) adds the 1px ink outline.
import { put, type Grid } from './art';

// ------------------------------------------------------------------ shared ramps (dark -> light)

export const INK = '#140c1c';
export const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
export const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
export const RED = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
export const LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];
export const NIGHT = ['#0e1a22', '#162a32', '#23404a', '#355a60', '#4e7a78', '#7aa49a'];
export const EARTH = ['#2a1810', '#4a2c18', '#6e4426', '#98663a', '#c0905a', '#e0bc84'];
export const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
export const BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff', '#e0f6ff'];
export const SKIN = ['#5a2e22', '#a0583a', '#d88a5a', '#f2b888'];
export const PURPLE = ['#2a1440', '#4a2470', '#7a3cb0', '#a86ae0', '#dab0ff'];
export const STONE = ['#1c1c2c', '#34344a', '#545264', '#78747c', '#a09a96', '#c8c0b2'];
export const MOSS = ['#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850'];
export const TEAL = ['#14524e', '#22a098', '#62e4d4', '#d8fff6'];
export const FIRE = ['#8a1a22', '#d8401c', '#f27a1c', '#ffb02a', '#ffe070', '#fff8d0'];

// ------------------------------------------------------------------ light

const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.46];
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / n);
})();

/** Lambert light (0..1) on a sphere at normalised position (nx, ny), lit from the top left. */
export function lambert(nx: number, ny: number): number {
  const r2 = nx * nx + ny * ny;
  const s = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  return Math.max(0, nx * s * LIGHT[0] + ny * s * LIGHT[1] + nz * LIGHT[2]);
}

/** The ramp tone for a light value 0..1. */
export const tone = (r: string[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))];

export type Shader = (x: number, y: number) => string | null;
export type Inside = (x: number, y: number) => boolean;

/** A volume lit as one sphere (centre, radii); `bias` brightens or darkens the whole form. */
export const sphere =
  (r: string[], cx: number, cy: number, rx: number, ry: number, bias = 0, amb = 0.1): Shader =>
  (x, y) =>
    tone(r, amb + 0.95 * lambert((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + bias);

/** A cylinder standing upright (lit from the left): light depends only on x. */
export const column =
  (r: string[], cx: number, rx: number, bias = 0): Shader =>
  (x) =>
    tone(r, 0.1 + 0.95 * lambert((x + 0.5 - cx) / rx, -0.15) + bias);

export const ell =
  (cx: number, cy: number, rx: number, ry: number): Inside =>
  (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
export const rect =
  (x0: number, y0: number, x1: number, y1: number): Inside =>
  (x, y) =>
    x >= x0 && x <= x1 && y >= y0 && y <= y1;
export const or =
  (...f: Inside[]): Inside =>
  (x, y) =>
    f.some((k) => k(x, y));
export const and =
  (...f: Inside[]): Inside =>
  (x, y) =>
    f.every((k) => k(x, y));
export const not =
  (f: Inside): Inside =>
  (x, y) =>
    !f(x, y);

/** Fill the pixels `inside` reports with the shader's colour. */
export function fill(g: Grid, inside: Inside, shade: Shader): void {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      if (!inside(x, y)) continue;
      const c = shade(x, y);
      if (c) g[y][x] = c;
    }
}

/** Darken the pixels of a form that sit on its lower/right edge (`k` px in), toward a ramp's dark end. */
export function rimShade(g: Grid, inside: Inside, dark: string, k = 1): void {
  const out: Array<[number, number]> = [];
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      if (!inside(x, y)) continue;
      for (let d = 1; d <= k; d++) if (!inside(x + d, y + d) && !inside(x, y + d)) out.push([x, y]);
    }
  for (const [x, y] of out) g[y][x] = dark;
}

/** Thick polyline with round ends; shading by the caller's shader. */
export function stroke(g: Grid, pts: Array<[number, number]>, r: number | ((t: number) => number), shade: Shader): void {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const rr = typeof r === 'number' ? r : r((i + t) / n);
      for (let yy = Math.floor(y - rr); yy <= y + rr; yy++)
        for (let xx = Math.floor(x - rr); xx <= x + rr; xx++)
          if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= rr * rr) {
            const c = shade(xx, yy);
            if (c) put(g, xx, yy, c);
          }
    }
  }
}

/** Points along a cubic Bezier. */
export function bez(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/** Mirror a set of character-map rows left to right. */
export const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

/**
 * The mood's grade (docs/art-style.md section 0, L7) over a painted canvas, in place: every colour moves `k` of the
 * way toward a deep cool indigo, less so the brighter it is (light sources and highlights keep their value), so
 * midtones darken and cool while lamps, moons and crystals still glow. Alpha is kept.
 */
export function moodGrade(c: HTMLCanvasElement, k = 0.2): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const [mr, mg, mb] = [0x14, 0x1a, 0x30];
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
    const t = Math.max(0, k - Math.max(0, l - 0.62) * 0.9);
    d[i] = Math.round(d[i] + (mr - d[i]) * t);
    d[i + 1] = Math.round(d[i + 1] + (mg - d[i + 1]) * t);
    d[i + 2] = Math.round(d[i + 2] + (mb - d[i + 2]) * t);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * A portrait in the mood's light (docs/art-style.md section 0, L7/L8), in place: the key from the top left, the far
 * side falling into a deep cool shadow (stepped by distance from the light, never a blur), the ink outline kept.
 */
export function portraitMood(c: HTMLCanvasElement, k = 0.34): HTMLCanvasElement {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const [mr, mg, mb] = [0x14, 0x14, 0x2a];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (!d[i + 3]) continue;
      if (d[i] === 0x14 && d[i + 1] === 0x0c && d[i + 2] === 0x1c) continue; // the outline
      const s = (x + y * 0.7 - c.width * 0.45) / (c.width * 0.9);
      const t = 0.06 + Math.max(0, Math.min(1, s)) * k;
      const q = Math.round(t * 8) / 8; // stepped
      d[i] = Math.round(d[i] + (mr - d[i]) * q);
      d[i + 1] = Math.round(d[i + 1] + (mg - d[i + 1]) * q);
      d[i + 2] = Math.round(d[i + 2] + (mb - d[i + 2]) * q);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
