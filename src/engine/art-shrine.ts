// The camp's shrine, unlocked (see docs/art-style.md; the locked one is painted into camp_bg by art-camp.ts and stays
// as it is). The same mossy little stone house, same box and silhouette, so it covers the locked shrine exactly: the
// planks, chain and padlock are gone, the niche between the pillars glows violet with a crystal floating in it, the
// compass rose on the gable and the runes on the pillars are lit, light spills down the steps, and two candles
// burn either side of the door.
//
// Textures:
//   camp_shrine_open   SHRINE_W x SHRINE_H (38x51). Draw it over camp_bg with its top-left at SHRINE_AT (265, 54)
//                      (or origin (0.5, 1) at (284, 105)): it lands pixel for pixel on the locked shrine.
//   camp_shrine_glow   56x56 violet halo, translucent, no outline: centre it on SHRINE_GLOW_AT (284, 86), the
//                      niche, under or over the shrine with ADD blend; pulse its alpha for a breathing light.
//
// The shrine screen (view/shrine.ts) is a place: its stage is registered here as the 'shrine' theme (a night sky,
// far ruins, a great mossy stone arch with a violet glow in its opening, runes carved down its pillars and on its
// keystone, candles on the steps either side and a stone lantern at each side; SHRINE_CANDLES and SHRINE_LANTERNS
// are where their flames burn, drawn live). Its live parts:
//   shrine_altar       ALTAR_W x ALTAR_H (66x27): a stone altar with a violet runner and a carved rune. Origin
//                      (0.5, 1) on the floor: a chest stands on its top (ALTAR_TOP rows below the canvas's top).
//   shrine_crystal     13x23: the purple crystal that floats in the arch, lighting the altar
//   shrine_vial        VIALS.big.w x .h: the pity vial's glass (a crystal stopper, a neck, a tall body); the light
//   shrine_vial_thin   inside is drawn live behind it, row by row along VIALS[..].inner ([y, x0, x1] spans)
//   shrine_runes0/1    327x150 white masks, no outline: the carved runes (pillars / keystone and arch), to light
//                      with ADD and a violet tint, pulsing
import { grid, put, stamp, toCanvas, type Grid } from './art';
import { and, ell, fill, not, rect, tone, type Inside } from './art-paint';
import { registerStageTheme, type StageSpec } from './art-ui-stage';
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
  // the carved compass rose of the Atlas on the gable (story bible section 9), its points awake
  fill(g, and(ell(18.5, 11, 3.4, 3.4), not(ell(18.5, 11, 2.3, 2.3))), (x, y) => (x + y < 29 ? SPIRIT[3] : SPIRIT[2]));
  for (const [x, y, c] of [
    [18, 8, 5],
    [18, 9, 4],
    [18, 13, 3],
    [18, 14, 2],
    [15, 11, 4],
    [16, 11, 4],
    [20, 11, 3],
    [21, 11, 2],
    [18, 11, 5],
  ] as const)
    put(g, x, y, SPIRIT[c]);
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

// ------------------------------------------------------------------ the shrine screen: the place

/** Where the shrine's floor starts (game px from the top). */
export const SHRINE_FLOOR = 96;
/** The great arch: centred on the screen, its inner opening and outer edge (radii), the arc's centre. */
export const SHRINE_ARCH = { cx: 163, cy: 60, rIn: 33, rOut: 51 } as const;
/** Candle stubs on the floor at the pillars' feet (x, height), standing on CANDLE_FOOT. */
const CANDLE_STUBS: Array<[number, number]> = [
  [96, 9],
  [100, 6],
  [104, 12],
  [222, 11],
  [226, 7],
  [230, 9],
];
const CANDLE_FOOT = SHRINE_FLOOR + 5;
/** The candles' flames (where each flame's foot is): clusters on the steps at the pillars' feet. */
export const SHRINE_CANDLES: ReadonlyArray<{ x: number; y: number }> = CANDLE_STUBS.map(([x, h]) => ({ x, y: CANDLE_FOOT - h - 1 }));
/** The stone lanterns at the sides: where their flames sit. */
export const SHRINE_LANTERNS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 34, y: 74 },
  { x: 293, y: 74 },
];

const NSTONE = ['#0e0a18', '#181224', '#221a30', '#2e243e', '#3c304c', '#4c3e5c', '#5e4e6c', '#74627e'];
const CAND = ['#9a8a78', '#d8c8a8', '#f4ead0'];

/** Abstract carved signs (5 x 6; '#' is carved). */
const RUNES = [
  ['.###.', '#...#', '#.#.#', '#...#', '.###.', '..#..'],
  ['#.#.#', '.###.', '..#..', '..#..', '.#.#.', '#...#'],
  ['.##..', '#....', '#..#.', '#....', '.##..', '...#.'],
  ['..#..', '.###.', '#.#.#', '..#..', '#####', '..#..'],
  ['#####', '.#.#.', '..#..', '.#.#.', '#####', '..#..'],
  ['#...#', '.#.#.', '..#..', '#.#.#', '..#..', '.###.'],
];

/** Where the runes are carved: down the pillars (group 0) and round the arch and on the keystone (group 1). */
function runeSpots(): Array<{ x: number; y: number; g: 0 | 1; i: number }> {
  const { cx, cy, rIn, rOut } = SHRINE_ARCH;
  const mid = (rIn + rOut) / 2;
  const out: Array<{ x: number; y: number; g: 0 | 1; i: number }> = [];
  [cy + 6, cy + 18].forEach((y, k) => {
    out.push({ x: cx - mid - 2, y, g: 0, i: k * 2 });
    out.push({ x: cx + mid - 2, y, g: 0, i: k * 2 + 1 });
  });
  [-150, -122, -58, -30].forEach((deg, k) => {
    const a = (deg * Math.PI) / 180;
    out.push({ x: Math.round(cx + Math.cos(a) * mid) - 2, y: Math.round(cy + Math.sin(a) * mid) - 3, g: 1, i: (k + 2) % RUNES.length });
  });
  out.push({ x: cx - 2, y: cy - rOut + 6, g: 1, i: 4 });
  return out;
}

const SHRINE_STAGE: StageSpec = {
  sky: ['#07040e', '#0a0614', '#0e081c', '#120a24', '#170d2c', '#1c1034', '#22143c'],
  far: ['#1a1230', '#271c40'],
  near: ['#120c20', '#2c2044'],
  floor: ['#2c2240', '#2a203c', '#251c36', '#20182e', '#1a1426', '#14101e'],
  floorY: 150, // (the motif paints its own floor of flagstones from SHRINE_FLOOR)
  motif: 'shrine',
  light: 0xd4b4ff,
  disc: [0x8a70b8, 0x4a3a6a, 0x2a2040],
  accent: 0xd070ff,
};

/** The shrine's backdrop: stars, far ruins, the arch with its glowing opening, its runes, moss, candles, lanterns. */
function paintShrine(ctx: CanvasRenderingContext2D, w: number, sp: StageSpec, r: () => number): void {
  const fy = SHRINE_FLOOR;
  const { cx, cy, rIn, rOut } = SHRINE_ARCH;
  const px = (x: number, y: number, c: string, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
  };
  const st = (v: number, x: number, y: number) => NSTONE[Math.max(0, Math.min(NSTONE.length - 1, Math.floor(v * NSTONE.length + (bay(x, y) - 0.5) * 0.45)))];
  // stars
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(r() * 70);
    px(x, y, i % 5 === 0 ? '#f4ecff' : '#a898d0', i % 5 === 0 ? 1 : 0.7);
    if (i % 9 === 0) {
      px(x - 1, y, '#a898d0', 0.5);
      px(x + 1, y, '#a898d0', 0.5);
      px(x, y - 1, '#a898d0', 0.5);
      px(x, y + 1, '#a898d0', 0.5);
    }
  }
  // far ruins: low hills with broken columns, tinted toward the sky
  for (let x = 0; x < w; x++) {
    const t = Math.round(78 + noise(x * 0.04, 2, 7) * 10);
    ctx.fillStyle = sp.far[0];
    ctx.fillRect(x, t, 1, fy - t);
    ctx.fillStyle = sp.far[1];
    ctx.fillRect(x, t, 1, 1);
  }
  for (const [x, h] of [
    [18, 26],
    [36, 14],
    [70, 20],
    [252, 24],
    [288, 16],
    [306, 28],
  ]) {
    ctx.fillStyle = sp.far[0];
    ctx.fillRect(x, fy - h - 4, 5, h);
    ctx.fillStyle = sp.far[1];
    ctx.fillRect(x, fy - h - 4, 1, h);
    ctx.fillRect(x - 1, fy - h - 5, 7, 1);
  }
  flagstones(ctx, w, SHRINE_FLOOR, 150, NSTONE, (x, y) => {
    // the opening's light spills onto the floor in front of the arch
    const d = Math.hypot((x - cx) / 1.6, (y - SHRINE_FLOOR) * 1.4) / 70;
    return Math.max(0, 1 - d) * 0.22;
  });
  const inOpening = (x: number, y: number) => {
    const dx = x + 0.5 - cx;
    return y < fy && Math.abs(dx) <= rIn && (y >= cy || dx * dx + (y + 0.5 - cy) ** 2 <= rIn * rIn);
  };
  const inArch = (x: number, y: number) => {
    const dx = x + 0.5 - cx;
    return y < fy + 2 && Math.abs(dx) <= rOut && (y >= cy || dx * dx + (y + 0.5 - cy) ** 2 <= rOut * rOut) && !inOpening(x, y);
  };
  // the opening: the night beyond it washed violet, a soft light round where the crystal floats, mist on the ground
  const hillAt = (x: number) => Math.round(78 + noise(x * 0.04, 2, 7) * 10);
  for (let y = 0; y < fy; y++)
    for (let x = cx - rIn - 1; x <= cx + rIn + 1; x++) {
      if (!inOpening(x, y)) continue;
      const d = Math.hypot((x + 0.5 - cx) / 1.15, y + 0.5 - (cy - 14)) / (rIn * 1.35);
      const light = Math.max(0, 1 - d) ** 1.6;
      const mist = y > fy - 14 ? ((y - (fy - 14)) / 14) * 0.35 : 0;
      const k = (y > hillAt(x) ? 0.04 : 0.16) + light * 0.72 + mist + (bay(x, y) - 0.5) * 0.12;
      px(x, y, SPIRIT[Math.max(0, Math.min(4, Math.floor(k * 4.4)))]);
    }
  // the arch: radial voussoirs over the opening, coursed blocks down the pillars, lit from the left
  for (let y = 0; y < fy + 2; y++)
    for (let x = cx - rOut - 1; x <= cx + rOut + 1; x++) {
      if (!inArch(x, y)) continue;
      const dx = x + 0.5 - cx;
      let v = 0.5 - dx / (rOut * 3.2);
      let mortar = false;
      let block = 0;
      if (y < cy) {
        const a = Math.atan2(y + 0.5 - cy, dx);
        const seg = (a + Math.PI) / (Math.PI / 11);
        const rad = Math.hypot(dx, y + 0.5 - cy);
        mortar = seg % 1 < 0.09;
        block = Math.floor(seg);
        // the stones' inner and outer faces catch or lose the light
        if (rad < rIn + 2) v += y < cy - rIn * 0.6 ? -0.12 : 0.1;
        if (rad > rOut - 1.5) v -= 0.16;
      } else {
        const course = Math.floor((y - cy) / 7);
        const local = (y - cy) % 7;
        mortar = local === 6 || (Math.abs(dx) > rIn + 1 && Math.abs(dx) < rOut - 1 && ((x + course * 5) % 11 === 0));
        block = course * 3 + (dx < 0 ? 0 : 1);
        if (Math.abs(dx) <= rIn + 2) v += dx < 0 ? -0.18 : 0.12; // the pillars' inner faces
        if (local === 0) v += 0.08;
      }
      v += (hash(block, 3, 11) - 0.5) * 0.14;
      if (mortar) v = 0.08;
      px(x, y, st(v, x, y));
    }
  // capitals where the arch springs, plinths at the pillars' feet
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? cx - rOut - 2 : cx + rIn - 1;
    for (let x = x0; x < x0 + rOut - rIn + 3; x++) {
      px(x, cy - 1, NSTONE[6]);
      px(x, cy, NSTONE[4]);
      px(x, cy + 1, NSTONE[1]);
      for (let y = fy - 5; y < fy + 2; y++) px(x, y, y === fy - 5 ? NSTONE[6] : st(0.42 - (x - x0) / 60, x, y));
    }
  }
  // the keystone, standing proud of the arch
  for (let y = cy - rOut - 2; y < cy - rIn + 3; y++)
    for (let x = cx - 6; x <= cx + 6; x++) {
      const k = (y - (cy - rOut - 2)) / (rOut - rIn + 5);
      const half = 4 + k * 2;
      if (Math.abs(x + 0.5 - cx) > half) continue;
      const v = 0.6 - (x - cx) / 20 + (y === cy - rOut - 2 ? 0.15 : 0);
      px(x, y, st(v, x, y));
    }
  // the runes, carved
  for (const s of runeSpots())
    RUNES[s.i].forEach((row, yy) => [...row].forEach((ch, xx) => ch === '#' && px(s.x + xx, s.y + yy, NSTONE[0])));
  // moss hanging from the arch's crown and creeping up the pillars
  for (let x = cx - rOut + 4; x <= cx + rOut - 4; x++) {
    const dx = x + 0.5 - cx;
    const top = Math.round(cy - Math.sqrt(Math.max(0, rOut * rOut - dx * dx)));
    const n = Math.max(0, Math.round(noise(x * 0.3, 5, 3) * 5 - 1));
    for (let k = 0; k < n; k++) px(x, top + k, MOSS_R[Math.max(0, 4 - k)]);
    const dn = Math.round(noise(x * 0.5, 9, 4) * 5) - 2;
    if (Math.abs(dx) < rIn + 1 && Math.abs(dx) > rIn - 6 && dn > 0) for (let k = 0; k < dn; k++) px(x, Math.round(cy - Math.sqrt(Math.max(0, rIn * rIn - dx * dx))) + k, MOSS_R[3 - Math.min(2, k)]);
  }
  for (const x0 of [cx - rOut, cx + rIn + 1])
    for (let x = x0; x < x0 + rOut - rIn; x++) {
      const n = Math.round(noise(x * 0.4, 1, 6) * 7);
      for (let k = 0; k < n; k++) px(x, fy - 6 - k, MOSS_R[Math.min(4, 1 + (k % 3))], 0.9);
    }
  // candle stubs at the pillars' feet
  for (const [x, h] of CANDLE_STUBS) {
    for (let k = 0; k < h; k++) {
      px(x - 1, CANDLE_FOOT - 1 - k, CAND[2]);
      px(x, CANDLE_FOOT - 1 - k, CAND[1]);
      px(x + 1, CANDLE_FOOT - 1 - k, CAND[0]);
    }
    px(x, CANDLE_FOOT - h - 1, '#2a2018');
    px(x - 2, CANDLE_FOOT - 2, CAND[1]);
    px(x + 2, CANDLE_FOOT - 1, CAND[0]);
    ctx.fillStyle = INK_HEX;
    ctx.fillRect(x - 2, CANDLE_FOOT - h - 1, 1, h - 1);
    ctx.fillRect(x + 2, CANDLE_FOOT - h - 1, 1, h - 2);
  }
  // the braziers at the sides: a fluted stone pedestal and a wide bowl (their fire is drawn live)
  for (const l of SHRINE_LANTERNS) {
    for (let y = l.y + 5; y < fy + 4; y++) {
      const half = y > fy ? 5 : y > l.y + 8 ? 3 : 4;
      for (let x = l.x - half; x <= l.x + half; x++) px(x, y, st(0.56 - (x - l.x) / 9 + ((x - l.x) % 2 === 0 && half === 3 ? 0.06 : 0) + (y === fy + 1 ? 0.2 : 0), x, y));
    }
    for (let y = l.y; y < l.y + 5; y++) {
      const half = 7 - Math.max(0, y - l.y - 1);
      for (let x = l.x - half; x <= l.x + half; x++) px(x, y, y === l.y ? NSTONE[6] : st(0.5 - (x - l.x) / 16 - (y - l.y) * 0.05, x, y));
    }
    for (let x = l.x - 5; x <= l.x + 5; x++) px(x, l.y, '#2a1830');
  }
}

/** A floor of flagstones in perspective from y0 down: rows widening toward the front, seams fanning out from the
 *  middle, each stone a little different, its back edge lit; `light` brightens it where light falls. */
export function flagstones(ctx: CanvasRenderingContext2D, w: number, y0: number, y1: number, ramp: readonly string[], light: (x: number, y: number) => number, base = 0.3): void {
  const seams = [0, 4, 9, 15, 22, 30, 39, 49, 60, 72];
  const vx = 163;
  const vy = y0 - 70;
  for (let y = y0; y < y1; y++) {
    let band = 0;
    while (band + 1 < seams.length && y - y0 >= seams[band + 1]) band++;
    const local = y - y0 - seams[band];
    const persp = (y - vy) / (y0 - vy);
    for (let x = 0; x < w; x++) {
      const u = vx + (x - vx) / persp; // the floor's own x, as at the back row
      const sw = 26;
      const su = u + (band % 2) * (sw / 2);
      const stone = Math.floor(su / sw);
      const across = ((su % sw) + sw) % sw;
      let v = base + (y - y0) / (y1 - y0) * -0.08 + (hash(stone, band, 23) - 0.5) * 0.12 + light(x, y);
      if (local === 0) v = 0.08;
      else if (local === 1) v += 0.1;
      if (across < 1 / persp) v = 0.1;
      ctx.fillStyle = ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + (bay(x, y) - 0.5) * 0.4)))];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const INK_HEX = '#140c1c';

registerStageTheme('shrine', SHRINE_STAGE, paintShrine);

/** The runes' light: white masks of the carved pixels (group 0: the pillars; 1: the arch and keystone). */
function runeMask(group: 0 | 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 327;
  c.height = 150;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  for (const s of runeSpots())
    if (s.g === group) RUNES[s.i].forEach((row, yy) => [...row].forEach((ch, xx) => ch === '#' && ctx.fillRect(s.x + xx, s.y + yy, 1, 1)));
  return c;
}

export const ALTAR_W = 66;
export const ALTAR_H = 27;
/** Rows from the altar canvas's top to where a chest's feet stand. */
export const ALTAR_TOP = 3;

/** The altar: a chamfered top slab, a body of two stone blocks with runes either side of a violet runner, a plinth. */
function altar(): HTMLCanvasElement {
  const W = ALTAR_W;
  const H = ALTAR_H;
  const g = grid(W, H);
  const st = (v: number) => tone(NSTONE, v);
  // the plinth
  fill(g, rect(2, H - 5, W - 3, H - 2), (x, y) => st(y === H - 5 ? 0.78 : 0.5 - (x - 2) / 160 - (y - (H - 5)) * 0.06));
  // the body
  fill(g, rect(6, 6, W - 7, H - 6), (x, y) => {
    let v = 0.56 - (x - 6) / 130 - (y - 6) / 70;
    if (x === 6) v += 0.12;
    if (x >= W - 8) v -= 0.18;
    if (x === 33) v = 0.18; // the seam between the two blocks
    return st(v);
  });
  // runes on the body either side of the runner, softly lit
  for (const [x, i] of [
    [12, 0],
    [W - 18, 3],
  ] as Array<[number, number]>)
    RUNES[i].forEach((row, yy) => [...row].forEach((ch, xx) => ch === '#' && put(g, x + xx, 10 + yy, SPIRIT[2 + ((xx + yy) % 2)])));
  // the top slab, chamfered, its top face catching the light
  fill(g, rect(1, ALTAR_TOP, W - 2, ALTAR_TOP + 3), (x, y) => {
    if ((x === 1 || x === W - 2) && y === ALTAR_TOP) return null;
    if (y === ALTAR_TOP) return st(0.92 - (x - 1) / 140);
    return st(0.6 - (x - 1) / 120 - (y - ALTAR_TOP) * 0.08);
  });
  // the runner over the slab and down the front: violet, gold edges, a pointed end with a gold tassel
  const rl = 25;
  const rr = 40;
  fill(g, (x, y) => x >= rl && x <= rr && y >= ALTAR_TOP && y <= 20 + Math.min(x - rl, rr - x) / 2 - 1, (x, y) => {
    if (x === rl || x === rr) return GOLD_R[x === rl ? 3 : 1];
    const bottom = 20 + Math.min(x - rl, rr - x) / 2 - 1;
    if (y >= bottom - 1) return GOLD_R[2];
    if (y === ALTAR_TOP) return SPIRIT[3];
    const v = 0.55 - (x - rl) / 34 + (x % 4 === 1 ? 0.08 : 0);
    return tone(VELVET, v);
  });
  // a gold sigil on the runner: a crescent round a star
  stamp(g, ['.GG..', 'G..y.', 'G.W..', 'G..y.', '.GG..'], { G: GOLD_R[3], y: GOLD_R[2], W: '#fff4c8' }, 31, 10);
  put(g, 33, 23, GOLD_R[3]);
  put(g, 32, 24, GOLD_R[2]);
  put(g, 33, 24, GOLD_R[3]);
  return toCanvas(g);
}

const GOLD_R = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const VELVET = ['#1e0a34', '#34125a', '#4e1e84', '#6a2eae', '#8a46d0'];

/** The crystal that floats in the arch: double-pointed, faceted, bright on its left faces. */
function crystal(): HTMLCanvasElement {
  const W = 13;
  const H = 23;
  const g = grid(W, H);
  const cxk = 6;
  for (let y = 0; y < H; y++) {
    const half = y < 8 ? Math.round((y / 8) * 5) : y > 14 ? Math.round(((H - 1 - y) / 8) * 5) : 5;
    for (let x = cxk - half; x <= cxk + half; x++) {
      const k = (x - (cxk - half)) / Math.max(1, half * 2);
      let c = k < 0.3 ? SPIRIT[5] : k < 0.55 ? SPIRIT[4] : k < 0.8 ? SPIRIT[3] : SPIRIT[2];
      if (y > 14 && k < 0.5) c = SPIRIT[3];
      if (y === 8 || y === 14) c = k < 0.5 ? SPIRIT[5] : SPIRIT[3];
      put(g, x, y, c);
    }
  }
  put(g, cxk - 2, 5, '#ffffff');
  put(g, cxk - 3, 9, '#ffffff');
  put(g, cxk - 3, 10, '#ffffff');
  put(g, cxk - 3, 11, SPIRIT[5]);
  return toCanvas(g);
}

/** A vial's shape: its outer half-width per row (0: not glass), and the stopper's rows. */
interface VialShape {
  w: number;
  h: number;
  cx: number;
  /** Outer half-width at row y (glass from cx - hw to cx + hw), 0 above the neck or below the bottom. */
  hw: (y: number) => number;
  neckTop: number;
  bottom: number;
}

const BIG_VIAL: VialShape = {
  w: 17,
  h: 40,
  cx: 8,
  hw: (y) => (y < 6 || y > 37 ? 0 : y <= 10 ? 2 : y === 11 ? 4 : y === 12 ? 6 : y <= 35 ? 7 : y === 36 ? 6 : 4),
  neckTop: 6,
  bottom: 37,
};
const THIN_VIAL: VialShape = {
  w: 11,
  h: 34,
  cx: 5,
  hw: (y) => (y < 5 || y > 31 ? 0 : y <= 8 ? 1 : y === 9 ? 2 : y <= 29 ? 3 : y === 30 ? 2 : 2),
  neckTop: 5,
  bottom: 31,
};

/** The light's room inside a vial, bottom-up rows: [y, x0, x1]. */
function vialInner(v: VialShape): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let y = v.bottom - 1; y > v.neckTop; y--) {
    const hw = v.hw(y) - 1;
    if (hw >= 0) out.push([y, v.cx - hw, v.cx + hw]);
  }
  return out;
}

/** The pity vials: their size and the light's room inside each (bottom-up rows). */
export const VIALS = {
  big: { w: BIG_VIAL.w, h: BIG_VIAL.h, inner: vialInner(BIG_VIAL) },
  thin: { w: THIN_VIAL.w, h: THIN_VIAL.h, inner: vialInner(THIN_VIAL) },
} as const;

/** A vial's glass: its rim lit on the left, a lip at the neck, a shine down the body; a crystal stopper. */
function vial(v: VialShape): HTMLCanvasElement {
  const g = grid(v.w, v.h);
  for (let y = v.neckTop; y <= v.bottom; y++) {
    const hw = v.hw(y);
    if (!hw) continue;
    const bottomRow = y === v.bottom || v.hw(y + 1) < hw - 1;
    for (let x = v.cx - hw; x <= v.cx + hw; x++) {
      const edgeL = x === v.cx - hw;
      const edgeR = x === v.cx + hw;
      if (y === v.neckTop) put(g, x, y, x < v.cx + hw ? '#ffffff' : '#b8a8e0');
      else if (edgeL) put(g, x, y, '#e8e0ff');
      else if (edgeR) put(g, x, y, '#6a5a98');
      else if (bottomRow || y === v.bottom) put(g, x, y, '#8a7ab8');
      else if (v.hw(y - 1) < hw && v.hw(y - 1) > 0 && Math.abs(x - v.cx) >= v.hw(y - 1)) put(g, x, y, '#c8b8f0'); // the shoulder
    }
  }
  // the shine down the body's left side
  for (let y = v.neckTop + 6; y < v.bottom - 4; y++) if (v.hw(y) > 2 && y % 7 !== 0) put(g, v.cx - v.hw(y) + 2, y, '#ffffff');
  // the stopper: a gold band and a violet crystal cap
  const top = v.neckTop - (v === BIG_VIAL ? 5 : 4);
  const sw = v === BIG_VIAL ? 3 : 2;
  for (let x = v.cx - sw; x <= v.cx + sw; x++) {
    put(g, x, v.neckTop - 1, GOLD_R[x < v.cx ? 4 : 2]);
    put(g, x, v.neckTop - 2, GOLD_R[x < v.cx ? 3 : 1]);
  }
  for (let y = top; y < v.neckTop - 2; y++) {
    const k = y - top;
    const half = Math.min(sw - 1, k);
    for (let x = v.cx - half; x <= v.cx + half; x++) put(g, x, y, x < v.cx ? SPIRIT[5] : x === v.cx ? SPIRIT[4] : SPIRIT[2]);
  }
  return toCanvas(g);
}

export function buildShrineArt(add: Add): void {
  add('camp_shrine_open', shrineOpen());
  add('camp_shrine_glow', shrineGlow(56));
  add('shrine_altar', altar());
  add('shrine_crystal', crystal());
  add('shrine_vial', vial(BIG_VIAL));
  add('shrine_vial_thin', vial(THIN_VIAL));
  add('shrine_runes0', runeMask(0));
  add('shrine_runes1', runeMask(1));
}
