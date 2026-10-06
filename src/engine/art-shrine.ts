// The camp's shrine, unlocked (see docs/art-style.md; the locked one is painted into camp_bg by art-camp.ts and stays
// as it is). The same mossy little stone house, same box and silhouette, so it covers the locked shrine exactly: the
// planks, chain and padlock are gone, the niche between the pillars glows violet with a crystal floating in it, the
// pendulum emblem on the gable and the runes on the pillars are lit, light spills down the steps, and two candles
// burn either side of the door.
//
// Textures:
//   camp_shrine_open   SHRINE_W x SHRINE_H (38x51). Draw it over camp_bg with its top-left at SHRINE_AT (265, 54)
//                      (or origin (0.5, 1) at (284, 105)): it lands pixel for pixel on the locked shrine.
//   camp_shrine_glow   56x56 violet halo, translucent, no outline: centre it on SHRINE_GLOW_AT (284, 86), the
//                      niche, under or over the shrine with ADD blend; pulse its alpha for a breathing light.
import { grid, put, stamp, toCanvas, type Grid } from './art';
import { and, ell, fill, not, rect, tone, type Inside } from './art-paint';
import { bay, hash, noise } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

export const SHRINE_W = 38;
export const SHRINE_H = 51;
/** Where the shrine's canvas sits on camp_bg (its top-left), and the niche's centre for the glow. */
export const SHRINE_AT = { x: 265, y: 54 };
export const SHRINE_GLOW_AT = { x: 284, y: 86 };

// the camp's ramps (art-camp.ts), dark -> light
const FSTONE = ['#16151f', '#24242f', '#363744', '#4c4e5a', '#666874', '#868894', '#a8a8b0'];
const MOSS_R = ['#122218', '#1a3222', '#26482c', '#386236', '#527e40'];
// the shrine's light: violet, warming to white at the heart
const SPIRIT = ['#2a1450', '#4a2484', '#7a44c8', '#a878f0', '#d4b4ff', '#f4ecff'];
const CANDLE = ['#c8b898', '#efe2c4', '#fff8e6'];
const FLAME = ['#e0461c', '#ffb02a', '#ffe070', '#fff8d0'];

/** Rounded fieldstones in courses (as art-camp.ts lays them), with an extra wash of violet light near the door. */
function stones(g: Grid, inside: Inside, seed: number, light: (x: number, y: number) => number, lit: (x: number, y: number) => number): void {
  fill(g, inside, (x, y) => {
    const row = Math.floor((y + seed) / 4);
    const off = (row * 5 + seed) % 7;
    const sx = Math.floor((x + off) / 6);
    const u = ((x + off) % 6) / 5;
    const v = ((y + seed) % 4) / 3;
    const mortar = (x + off) % 6 === 5 || (y + seed) % 4 === 3;
    const jit = (hash(sx, row, seed) - 0.5) * 0.12;
    const t = light(x, y) + jit + (mortar ? -0.22 : 0.14 - u * 0.12 - v * 0.12);
    // stone facing the doorway catches the violet light
    return lit(x, y) > 0.5 && !mortar ? tone(SPIRIT, t * 0.9) : tone(FSTONE, t);
  });
}

function shrineOpen(): HTMLCanvasElement {
  const W = SHRINE_W;
  const H = SHRINE_H;
  const g = grid(W, H);
  const base = H - 3;
  const cool = (x: number, y: number) => 0.58 - (x - 4) / 70 - (y - 13) / 200;
  // how strongly the niche's light reaches a point (1 at the door, falling off)
  const reach = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x + 0.5 - 18.5) / 11, (y + 0.5 - 34) / 16));
  // plinth: two steps, lit violet in front of the door
  const stepTone = (x: number, y: number, top: boolean, x0: number) => {
    const t = (top ? 0.8 : 0.45) - (x - x0) / 90 + ((x * 5) % 7 === 0 ? -0.15 : 0);
    return x >= 11 && x <= 26 && top ? tone(SPIRIT, t + 0.05) : x >= 9 && x <= 28 && reach(x, y) > 0.25 ? tone(SPIRIT, t * 0.75) : tone(FSTONE, t);
  };
  fill(g, rect(1, base - 3, 36, base), (x, y) => stepTone(x, y, y === base - 3, 1));
  fill(g, rect(3, base - 6, 34, base - 4), (x, y) => stepTone(x, y, y === base - 6, 3));
  // the niche: deep violet, brightening toward its heart
  fill(g, rect(10, 20, 27, base - 7), (x, y) => {
    const d = Math.hypot((x + 0.5 - 18.5) / 9, (y + 0.5 - 31) / 11);
    const k = 1 - d + (bay(x, y) - 0.5) * 0.18;
    return y < 22 ? SPIRIT[0] : tone(SPIRIT.slice(0, 5), k * 1.15 + 0.12);
  });
  // the pillars and their runes (lit)
  for (const px of [4, 27])
    stones(g, rect(px, 20, px + 6, base - 7), px, (x, y) => cool(x, y) + 0.05, (x) => (px === 4 ? (x >= px + 5 ? 1 : 0) : x <= px ? 1 : 0));
  for (const [x, y] of [
    [7, 25],
    [7, 31],
    [30, 25],
    [30, 31],
  ])
    stamp(g, ['.a.', 'aba', '.a.'], { a: SPIRIT[3], b: SPIRIT[5] }, x - 1, y - 1);
  // lintel and gabled roof slab, a stone orb on the ridge (glowing faintly now)
  fill(g, rect(2, 16, 35, 20), (x, y) => (y === 16 ? FSTONE[5] : y === 20 ? (x >= 10 && x <= 27 ? SPIRIT[2] : FSTONE[1]) : tone(FSTONE, cool(x, y) + 0.08)));
  const roof: Inside = (x, y) => y >= 5 && y < 16 && Math.abs(x + 0.5 - 18.5) <= (y - 4) * 1.6;
  fill(g, roof, (x, y) => tone(FSTONE, (x < 18 ? 0.7 : 0.38) - (y - 5) / 40 + ((x + y * 2) % 7 === 0 ? -0.12 : 0)));
  fill(g, ell(18.5, 3, 2.2, 2.2), (x, y) => (x + y < 20 ? SPIRIT[5] : x + y < 22 ? SPIRIT[4] : SPIRIT[2]));
  // the carved pendulum emblem on the gable, its rune awake
  fill(g, and(ell(18.5, 11, 3.4, 3.4), not(ell(18.5, 11, 2.3, 2.3))), (x, y) => (x + y < 29 ? SPIRIT[3] : SPIRIT[2]));
  put(g, 18, 9, SPIRIT[4]);
  put(g, 18, 10, SPIRIT[5]);
  put(g, 18, 11, SPIRIT[5]);
  put(g, 18, 12, SPIRIT[4]);
  put(g, 17, 12, SPIRIT[3]);
  put(g, 19, 12, SPIRIT[3]);
  // moss over the roof and ivy down the left pillar
  fill(g, and(roof, (x, y) => y <= 6 + noise(x * 0.5, 1, 4) * 6 - Math.abs(x - 18) * 0.15), (x, y) => tone(MOSS_R, 0.95 - (y - 5) * 0.12 - (x > 18 ? 0.25 : 0)));
  for (const [x, len] of [
    [3, 9],
    [5, 15],
    [7, 6],
    [30, 6],
  ])
    for (let k = 0; k < len; k++) put(g, x + (k % 3 === 2 ? 1 : 0), 17 + k, k % 2 ? MOSS_R[2] : MOSS_R[3]);
  // the crystal floating in the niche, its light ringing round it
  stamp(
    g,
    ['...W...', '..WLl..', '.WLLll.', 'WLLlllm', '.Llllm.', '..lmm..', '...m...'],
    { W: '#ffffff', L: SPIRIT[5], l: SPIRIT[4], m: SPIRIT[3] },
    15,
    25,
  );
  for (const [x, y] of [
    [14, 24],
    [23, 25],
    [13, 31],
    [24, 32],
    [18, 35],
  ])
    put(g, x, y, SPIRIT[5]);
  // a little altar step inside, and offerings: a flower each side
  fill(g, rect(13, base - 9, 24, base - 8), (_x, y) => (y === base - 9 ? SPIRIT[3] : SPIRIT[1]));
  stamp(g, ['.p.', 'pYp', '.e.'], { p: '#f2a0b4', Y: '#ffe070', e: MOSS_R[4] }, 10, base - 9);
  stamp(g, ['.p.', 'pYp', '.e.'], { p: '#b8a0ff', Y: '#ffe070', e: MOSS_R[4] }, 25, base - 9);
  // two candles on the lower step, either side of the door
  for (const cx of [6, 31]) {
    fill(g, rect(cx, base - 6, cx + 1, base - 4), (x, y) => (y === base - 6 ? CANDLE[2] : x === cx ? CANDLE[1] : CANDLE[0]));
    put(g, cx, base - 8, FLAME[1]);
    put(g, cx, base - 7, FLAME[3]);
    put(g, cx + 1, base - 7, FLAME[2]);
  }
  return toCanvas(g);
}

/** A soft violet halo for the doorway's light: stepped, dithered alpha, no outline. */
function shrineGlow(n: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d')!;
  const A = [0, 0.08, 0.16, 0.26, 0.38, 0.52];
  const im = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot((x + 0.5 - n / 2) / (n / 2), (y + 0.5 - n / 2) / (n / 2));
      if (d >= 1) continue;
      const band = Math.max(0, Math.min(A.length - 1, Math.floor((1 - d) ** 1.3 * A.length + (bay(x, y) - 0.5) * 0.9)));
      if (!band) continue;
      const i = (y * n + x) * 4;
      im.data.set(band >= 4 ? [212, 180, 255] : [168, 120, 240], i);
      im.data[i + 3] = Math.round(A[band] * 255);
    }
  ctx.putImageData(im, 0, 0);
  return c;
}

export function buildShrineArt(add: Add): void {
  add('camp_shrine_open', shrineOpen());
  add('camp_shrine_glow', shrineGlow(56));
}
