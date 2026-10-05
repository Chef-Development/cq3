// The kingdom's world map (see docs/art-style.md): an illustrated island kingdom seen from above at a slight
// angle, painted into pixel buffers at boot with the backdrop toolkit. The land is a plate whose southern
// edges show a cliff face; the sea gets lighter in the shallows. Greenmarch (playable) is bright and saturated;
// the locked regions are desaturated and hazed so it pops. Landmarks are small hand-placed sprites with an ink
// outline so they read at 1x (8x on the phone).
//
// The map is alive, so it is painted in layers the view (view/world.ts) moves and cycles: the static base
// (`world_map`), wave marks and river ripples (`wm_wave0..5`), surf lapping the coast (`wm_surf0..3`), the
// floating island of Noonspire (`wm_isle`, it bobs), the lava and lamp glows (pulsing overlays), and small
// sprites: Rowan and Pip, a ship, the windmill's sails, gulls, clouds and their shadows, volcano smoke, mist,
// waving flags and the padlock. Everything else that moves (snow, sparkles, smoke from chimneys, the
// pendulum) the view draws as a handful of rects each frame.
//
// Layout (327x150): the left/right ~24 px sit behind the Dynamic Island and the rounded corners; the top-left
// holds the header panel and the top centre the DOM buttons.
import { grid, stamp, toCanvas, type Pal } from './art';
import {
  bay,
  col,
  conifer,
  crown,
  fbm,
  hash,
  lighten,
  mass,
  mix,
  noise,
  pick,
  Pix,
  ramp,
  rng,
  tuft,
  type Blob,
  type Col,
  type Ramp,
} from './backdrop';

type Add = (key: string, c: HTMLCanvasElement) => void;

/** The design size the anchors refer to (the game's 327x150 screen). */
export const WORLD_W = 327;
export const WORLD_H = 150;

/** Regions: the anchor is where the scene draws the padlock (or Greenmarch's marker) and the tap target. */
export const WORLD_REGIONS: Array<{ id: string; name: string; x: number; y: number; locked: boolean }> = [
  { id: 'greenmarch', name: 'Greenmarch', x: 72, y: 104, locked: false },
  { id: 'frostpeaks', name: 'Frostpeaks', x: 210, y: 40, locked: true },
  { id: 'ashfell', name: 'Ashfell', x: 254, y: 66, locked: true },
  { id: 'duskmire', name: 'Duskmire', x: 198, y: 102, locked: true },
  { id: 'noonspire', name: 'Noonspire', x: 290, y: 90, locked: true },
];
/** The capital's gate, right under the Great Pendulum clock tower (the tower rises from y 61 to 29). */
export const WORLD_CAPITAL = { x: 160, y: 64 };
/** Flag spots (pole foot) for Greenmarch's three acts: the meadow, the old ruins, the Boar King's Hollow. */
export const GREENMARCH_FLAGS: Array<{ x: number; y: number }> = [
  { x: 56, y: 116 },
  { x: 125, y: 65 },
  { x: 151, y: 114 },
];

/** Frame counts of the cycled textures. */
export const WAVE_FRAMES = 6;
export const SURF_FRAMES = 4;
export const FLAG_FRAMES = 3;
export const WIND_FRAMES = 10;
export const CLOUD_KINDS = 4;
export const SHADOW_KINDS = 2;

/** Where the cropped overlay layers sit (their textures' top-left and size). */
export const WORLD_BOXES = {
  wind: { x: 24, y: 36, w: 166, h: 88 },
  lava: { x: 216, y: 26, w: 68, h: 84 },
  lamp: { x: 210, y: 83, w: 23, h: 23 },
};

/** Where the view animates things (game px). */
export const WORLD_SPOTS = {
  hero: { x: 64, y: 105 }, // Rowan's feet, on the Meadow Road
  mill: { x: 99, y: 104 }, // the windmill's sail hub
  crater: { x: 250, y: 39 }, // the volcano's mouth
  beacon: { x: 221, y: 94 }, // the Mirelight's lamp
  pendulum: { x: 160, y: 50 }, // the pendulum's pivot in the clock tower's belfry
  isle: { x: 277, y: 36 }, // Noonspire's floating island: texture top-left at rest
  sun: { x: 291, y: 42 }, // the sun disc on the spire
  falls: { x: 282, y0: 74, y1: 95 }, // the island's waterfall (2 px wide)
  turrets: [
    { x: 145, y: 53 },
    { x: 175, y: 53 },
  ], // tops of the capital's turrets (pennants)
  fog: [
    { x: 196, y: 96 },
    { x: 226, y: 112 },
    { x: 238, y: 99 },
  ], // Duskmire's mist banks (centres)
  lighthouse: { x: 29, y: 84 }, // the lamp of the lighthouse on the western islet
  sheep: { x: 155, y: 86, w: 16, h: 17 }, // the paddock east of the Hollow
  wisps: [
    { x: 190, y: 106 },
    { x: 232, y: 104 },
    { x: 210, y: 116 },
  ], // will-o'-wisps wander round these
};

/** Filled when the map is painted: open sea spots (glints, wave life), deep water (whales), lit windows, chimneys. */
export const WORLD_LIFE = {
  sea: [] as Array<[number, number]>,
  deep: [] as Array<[number, number]>,
  windows: [] as Array<[number, number]>,
  chimneys: [] as Array<[number, number]>,
  boat: [0, 0] as [number, number], // a fishing boat moored at the village pier
};

/** The Meadow Road from the village to the capital's gate, a point per pixel (the merchant's cart rolls along it). */
export const WORLD_ROAD: Array<[number, number]> = [];

const REGION_IDS = ['', 'greenmarch', 'frostpeaks', 'ashfell', 'duskmire'] as const;
let MASK: Uint8Array | null = null;

/** The region whose land (or cliff) is under a point, or null over the sea. */
export function worldRegionAt(x: number, y: number): string | null {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (!MASK || xi < 0 || yi < 0 || xi >= WORLD_W || yi >= WORLD_H) return null;
  return REGION_IDS[MASK[yi * WORLD_W + xi]] || null;
}

// ------------------------------------------------------------------ palette

const INK = col('#140c1c');
const SEA = ramp('#132a56', '#163262', '#1a3c70', '#1f4880', '#25558e');
const SHALLOW = ramp('#2a679c', '#317aac', '#3c90bc', '#52a8c8', '#72c2d2');
const FOAM = col('#d4eeec');
const WAVE_LIGHT = col('#8cc4e8');
const GRASS = ramp('#24482e', '#2e5a32', '#3e7034', '#4f8a38', '#68a440', '#88bc48', '#a8d058');
const FOREST = ramp('#10241c', '#1a3a26', '#285430', '#3e7432', '#5e9836', '#8cbc44');
const SAND = ramp('#b09060', '#d4bc84', '#ecdcaa');
const ROAD = ramp('#8a5e3a', '#c09060', '#e6c890');
const TUNDRA = ramp('#4e5c70', '#66788c', '#8698aa', '#a8b8c8', '#cad6e2');
const ROCK = ramp('#262a40', '#3a4060', '#555e80', '#76809e', '#98a2bc');
const SNOW = ramp('#9cb2d4', '#d4e2f2', '#ffffff');
const ASH = ramp('#3a3034', '#4a3e40', '#5c4e4c', '#706058', '#867466');
const BASALT = ramp('#1c1216', '#2a1a1e', '#3c2426', '#52302e', '#6c4036');
const LAVA = ramp('#a8281a', '#e8501e', '#ff9a2a', '#ffe070');
const MARSH = ramp('#1e302a', '#283e34', '#344e3e', '#466048', '#5a7252');
const POOL = ramp('#14222e', '#1e3442', '#36586a', '#6a8e9c');
const REED = ramp('#4a4a2a', '#7a7a3e', '#a8a054', '#cfc478');
const CLOUD = ramp('#93a8cc', '#b8cae4', '#dce8f6', '#ffffff');
const HAZE = col('#5a6a8e');
const RIVER = col('#3a86c4');
const RIVER_BANK = col('#8ad0e8');

// ------------------------------------------------------------------ the land

type Region = 'greenmarch' | 'frostpeaks' | 'ashfell' | 'duskmire';

/** Overlapping lobes that make up the island (cx, cy, rx, ry). */
const LOBES: Array<[number, number, number, number]> = [
  [92, 90, 58, 32], // Greenmarch
  [76, 62, 36, 23], // its north-west forest
  [166, 44, 62, 20], // Frostpeaks
  [156, 84, 38, 34], // the heartland round the capital
  [244, 62, 27, 28], // Ashfell
  [210, 104, 44, 18], // Duskmire
  [206, 76, 22, 14], // the river valley between the capital and Ashfell
];

function landField(x: number, y: number): number {
  let f = -9;
  for (const [cx, cy, rx, ry] of LOBES) f = Math.max(f, 1 - Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry));
  f += (fbm(x * 0.055, y * 0.08, 5) - 0.5) * 0.34;
  f -= Math.max(0, 1 - Math.hypot((x + 0.5 - 170) / 8, (y + 0.5 - 127) / 9)) * 1.2; // the river mouth's bay
  if (y > 122) f -= (y - 122) * 0.25;
  // two rocky islets off the west coast
  f = Math.max(f, 1 - Math.hypot((x + 0.5 - 30) / 3.5, (y + 0.5 - 92) / 2.2), 1 - Math.hypot((x + 0.5 - 27) / 2.2, (y + 0.5 - 98) / 1.6));
  return f;
}

/** The river: from the Frostpeaks snows, past the capital's east wall, into the southern bay. */
const riverX = (y: number) => 192 - (y - 50) * 0.32 + Math.sin(y * 0.15) * 2.5;
const frostY = (x: number) => 53 + (noise(x * 0.08, 0.5, 3) - 0.5) * 8;

function regionAt(x: number, y: number): Region {
  if (x >= 117 + (noise(y * 0.2, 1, 4) - 0.5) * 6 && x <= 228 && y < frostY(x)) return 'frostpeaks';
  if (x > riverX(y)) return y < 87 + (x - 200) * 0.1 + (noise(x * 0.1, 2, 6) - 0.5) * 6 ? 'ashfell' : 'duskmire';
  return 'greenmarch';
}

// ------------------------------------------------------------------ small helpers

/** Stamp a character-map sprite with a 1px outline around it. */
function spr(p: Pix, rows: string[], pal: Record<string, Col>, x: number, y: number, outline: Col | null = INK): void {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const on = (i: number, j: number) => j >= 0 && j < h && i >= 0 && i < rows[j].length && rows[j][i] !== '.';
  if (outline !== null)
    for (let j = -1; j <= h; j++)
      for (let i = -1; i <= w; i++) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) p.set(x + i, y + j, outline);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch !== '.' && pal[ch] !== undefined) p.set(x + i, y + j, pal[ch]);
    }
}

/** A standalone sprite texture (transparent, 1px ink outline round it). */
function sprite(rows: string[], pal: Record<string, Col>, outline: Col | null = INK): HTMLCanvasElement {
  const p = new Pix(Math.max(...rows.map((r) => r.length)) + 2, rows.length + 2, -1);
  spr(p, rows, pal, 1, 1, outline);
  return p.canvas();
}

const P = (o: Record<string, string>): Record<string, Col> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, col(v)]));

/** Darken an elliptical patch (a cast shadow on the ground). */
function shadow(p: Pix, cx: number, cy: number, rx: number, ry: number, k: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.tint(x, y, (c) => mix(c, col('#10101e'), k));
}

/** Stepped glow strength (0, 0.3, 0.6, 1) at a pixel, ordered-dithered at the rim. */
function glowStep(x: number, y: number, cx: number, cy: number, r: number): number {
  const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
  if (d >= 1) return 0;
  const q = (1 - d) ** 1.5;
  return q > 0.66 ? 1 : q > 0.33 ? 0.6 : q > bay(x, y) * 0.33 ? 0.3 : 0;
}

/** Additive glow, stepped with ordered dither (lamps, lava). */
function glow(p: Pix, cx: number, cy: number, r: number, c: Col, k: number): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const s = glowStep(x, y, cx, cy, r);
      if (s) p.tint(x, y, (o) => lighten(o, c, k * s));
    }
}

function desat(c: Col, k: number): Col {
  const l = Math.round(((c >> 16) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) * 1.04);
  const g = Math.min(255, l);
  return mix(c, (g << 16) | (g << 8) | g, k);
}
const hazed = (c: Col) => mix(desat(c, 0.4), HAZE, 0.2);

/** A curve through points (Catmull-Rom), sampled finely. */
function spline(pts: Array<[number, number]>, step = 0.2): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step);
    for (let s = 0; s < n; s++) {
      const t = s / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Copy a rectangle of a buffer into its own buffer. */
function crop(p: Pix, x0: number, y0: number, w: number, h: number): Pix {
  const out = new Pix(w, h, -1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.buf[y * w + x] = p.get(x0 + x, y0 + y);
  return out;
}

// ------------------------------------------------------------------ landmark sprites

const STONE_PAL = P({ s: '#e2dacb', S: '#b8b0a6', m: '#8a8290', M: '#5e5870', d: '#3a3650', l: '#9ad050', L: '#5e9a3e' });

// the old stone ruins (Act 2): a broken arcade, one arch still standing, moss on the tops
const RUINS = [
  '.lL.............',
  '.sSm.....lL.....',
  '.sSm.....sSm....',
  '.sSsssSSSsSm....',
  '.sSmMMMMMsSm..l.',
  '.sSm.....sSm..sm',
  '.sSm.....sSm..Sm',
  '.sSm.....sSm..Sm',
  '.sSm.....sSm..Sm',
  'ssSmm.ss.sSmm.Sm',
  'MMMMMdMMdMMMMdMM',
];

const HOUSE = ['..qR..', '.qqrR.', 'qqqrRR', 'wwwwWW', 'wkwdWW'];
const HOUSE_WINDOW = '#3a2a48';
const LONE_TREE = ['.lLl.', 'lLLLd', 'LLLdd', '.ddD.', '..t..'];
const LONE_PAL = P({ l: '#b4d058', L: '#78a83c', d: '#4a7e36', D: '#2e5a32', t: '#6e4020' });
const HOUSE_PAL = P({ q: '#f6684e', r: '#d23a30', R: '#8e2026', w: '#f4e6c0', W: '#c4a47a', k: HOUSE_WINDOW, d: '#6e4020' });
const HOUSE_BLUE = { ...HOUSE_PAL, ...P({ q: '#6aa0f0', r: '#3a6ad0', R: '#22408a' }) };

// the Great Pendulum: a clock tower with a slate spire, a big clock face (stopped at a quarter past twelve),
// and an open belfry where the pendulum hangs (the view draws the pendulum, which swings as weights come home)
const TOWER = [
  '......G......',
  '......g......',
  '.....bBn.....',
  '.....bBn.....',
  '....bbBnn....',
  '....bBBnn....',
  '...bbBBBnn...',
  '...bBBBBnn...',
  '..bbBBBBBnn..',
  '.bbBBBBBBBnn.',
  'GgggggggggyyY',
  '.sSSSSSSSSmm.',
  '.sSSSgggSSmm.',
  '.sSSgWkWgSmm.',
  '.sSgWWkWwgmm.',
  '.sSgWWkkwgmm.',
  '.sSgWWWWwgmm.',
  '.sSSgWWwgSmm.',
  '.sSSSyyySSmm.',
  '.sSSSSSSSSmm.',
  'GgggggggggyyY',
  '.sSSkkkkkSmm.',
  '.sSkKKKKKkmm.',
  '.sSkkkkkkkmm.',
  '.sSkkkkkkkmm.',
  '.sSkkkkkkkmm.',
  '.sSkkkkkkkmm.',
  '.sSSSSSSSSmm.',
  'GgggggggggyyY',
  'sSSSSSSSSSmmM',
  'sSSSSkkkSSmmM',
  'sSSSkkkkkSmmM',
  'sSSSkkkkkSmmM',
];
const TOWER_PAL = P({
  G: '#fff0a0',
  g: '#f2c230',
  y: '#d8901c',
  Y: '#9a5a14',
  b: '#6a92e0',
  B: '#3a62c0',
  n: '#22387a',
  s: '#f4ecd8',
  S: '#d4c6a8',
  m: '#a49478',
  M: '#746450',
  W: '#ffffff',
  w: '#c8d0e0',
  k: '#2a1c34',
  K: '#3e2c48',
});

const TURRET = ['..b..', '.bBn.', 'bbBnn', 'sSSmm', 'sSkmm', 'sSSmm', 'sSSmm'];

// the windmill at the end of the fields (the view turns its sails)
const MILL = ['.rrR.', 'rrrRR', '.wwW.', '.wkW.', '.wwW.', 'wwwWW', 'wwdWW'];
const MILL_PAL = P({ r: '#d23a30', R: '#8e2026', w: '#f4e6c0', W: '#c4a47a', k: '#3a2a48', d: '#6e4020' });

// the Mirelight: a lantern beacon on stilts guiding travellers through the fens
const BEACON = [
  '...q...',
  '..qrR..',
  '.qrrRR.',
  '.kfFfk.',
  '.kfffk.',
  'sSSSSmm',
  '.wwwWW.',
  '.wwwWW.',
  '.rrrRR.',
  '.rrrRR.',
  '.wwwWW.',
  '.wwwWW.',
  '.rrrRR.',
  '.rrrRR.',
  'sSSSSmm',
  '.h...h.',
  'h.h.h.h',
];
const BEACON_PAL = P({ q: '#f6684e', r: '#d23a30', R: '#8e2026', k: '#2a1c34', f: '#ffe680', F: '#ffffff', s: '#c8c0b2', S: '#a09a96', m: '#78747c', w: '#f4ecd8', W: '#c8bca4', h: '#5a4630' });

// ------------------------------------------------------------------ painters

/** A mountain peak (summit mx, top; half-width hw at `base`): lit face left of a wobbly ridge, snow cap, outline. */
function peak(p: Pix, mx: number, top: number, hw: number, base: number, seed: number, snowDepth: number): void {
  const xl: number[] = [];
  const xr: number[] = [];
  for (let y = top; y <= base; y++) {
    const t = (y - top) / (base - top);
    const half = hw * Math.pow(t, 0.9) + (noise(y * 0.5, 1, seed) - 0.5) * 2.2 * t;
    xl.push(Math.round(mx - half - (noise(y * 0.35, 4, seed) - 0.5) * 2 * t));
    xr.push(Math.round(mx + half + (noise(y * 0.35, 5, seed) - 0.5) * 2 * t));
  }
  const inside = (x: number, y: number) => y >= top && y <= base && x >= xl[y - top] && x <= xr[y - top];
  for (let y = top; y <= base; y++)
    for (let x = xl[y - top]; x <= xr[y - top]; x++) {
      const ridge = mx + (y - top) * 0.38 + (noise(y * 0.3, 2, seed) - 0.5) * 3;
      const lit = x < ridge;
      const gully = noise((x - mx) * 0.4 + (y - top) * 0.45, y * 0.07, seed + 3) > 0.64;
      const snowY = top + snowDepth + (noise(x * 0.45, 3, seed) - 0.5) * 5 - Math.abs(x - mx) * 0.15;
      let c: Col;
      if (y < snowY) c = lit ? (gully ? SNOW[1] : SNOW[2]) : gully ? SNOW[0] : SNOW[1];
      else c = pick(ROCK, (lit ? 0.78 : 0.4) - (gully ? 0.3 : 0) - (y - top) / (base - top) * 0.15, x, y, 0.2);
      if (!inside(x, y - 1) || !inside(x - 1, y) || !inside(x + 1, y)) c = ROCK[0];
      p.set(x, y, c);
    }
}

// ------------------------------------------------------------------ the map

const MEADOW_ROAD: Array<[number, number]> = [
  [44, 108],
  [56, 106],
  [70, 102],
  [84, 96],
  [96, 88],
  [104, 78],
  [110, 68],
  [122, 66],
  [136, 67],
  [150, 66],
  [160, 66],
  [174, 68],
];

interface WorldLayers {
  base: Pix;
  isle: Pix; // Noonspire's floating island, cropped at WORLD_SPOTS.isle
  waves: HTMLCanvasElement[];
  surf: HTMLCanvasElement[];
  lava: Pix; // the volcano lit up (crater glow, lava runs, fissures), cropped to WORLD_BOXES.lava
  lamp: Pix; // the Mirelight lit up, cropped to WORLD_BOXES.lamp
  wind: HTMLCanvasElement[]; // a gust rolling east over Greenmarch's meadows, fields and forest, cropped to WORLD_BOXES.wind
}

function paintWorld(): WorldLayers {
  const W = WORLD_W;
  const H = WORLD_H;
  const p = new Pix(W, H, 0);
  const rnd = rng(311);
  const N = W * H;

  // ---- land mask, the cliff under the southern edges, and each pixel's region
  const land = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) land[y * W + x] = landField(x, y) > 0 ? 1 : 0;
  // fill lakes the noise punched into the land: only sea reachable from the map's edge stays sea
  const open = new Uint8Array(N);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (open[i] || land[i]) continue;
    open[i] = 1;
    const x = i % W;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (i >= W) stack.push(i - W);
    if (i < N - W) stack.push(i + W);
  }
  for (let i = 0; i < N; i++) if (!open[i]) land[i] = 1;
  const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && land[y * W + x] === 1;
  const CL = 3;
  const cliff = new Int8Array(N); // depth below the land's edge, 1..CL
  for (let x = 0; x < W; x++)
    for (let y = 0; y < H - 1; y++)
      if (isLand(x, y) && !isLand(x, y + 1))
        for (let k = 1; k <= CL && y + k < H && !isLand(x, y + k); k++) cliff[(y + k) * W + x] = k;
  const plate = (i: number) => land[i] === 1 || cliff[i] > 0;
  const reg: Region[] = new Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      // a cliff pixel belongs to the land above it
      reg[i] = regionAt(x, cliff[i] ? y - cliff[i] : y);
    }
  MASK = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (plate(i)) MASK[i] = REGION_IDS.indexOf(reg[i]);
  const hot = new Uint8Array(N); // lava and glowing fissures (1), the crater and the lava runs (2)

  // ---- the sea: distance to the shore (chamfer), shallows, foam and a vignette
  const dist = new Float32Array(N).fill(1e9);
  for (let i = 0; i < N; i++) if (plate(i)) dist[i] = 0;
  const relax = (x: number, y: number, dx: number, dy: number, c: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const v = dist[ny * W + nx] + c;
    if (v < dist[y * W + x]) dist[y * W + x] = v;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      relax(x, y, -1, 0, 1);
      relax(x, y, 0, -1, 1);
      relax(x, y, -1, -1, 1.41);
      relax(x, y, 1, -1, 1.41);
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      relax(x, y, 1, 0, 1);
      relax(x, y, 0, 1, 1);
      relax(x, y, 1, 1, 1.41);
      relax(x, y, -1, 1, 1.41);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (plate(i)) continue;
      const d = dist[i];
      let c: Col;
      if (d <= 1.2) c = hash(x, y, 2) < 0.85 ? FOAM : SHALLOW[4];
      else if (d < 10) c = pick(SHALLOW, 0.92 - (d - 1.2) / 8.8 + (noise(x * 0.3, y * 0.3, 8) - 0.5) * 0.2, x, y, 0.5);
      else {
        const vx = (x - W / 2) / (W / 2);
        const vy = (y - H * 0.52) / (H / 2);
        const v = 0.82 - (vx * vx + vy * vy) * 0.4 + (fbm(x * 0.03, y * 0.05, 9) - 0.5) * 0.4 + Math.max(0, 16 - d) * 0.012;
        c = pick(SEA, v, x, y, 0.3);
      }
      p.set(x, y, c);
    }
  // open water for the view's glints and whales (clear of the header panel)
  WORLD_LIFE.sea.length = 0;
  WORLD_LIFE.deep.length = 0;
  for (let gy = 2; gy < H - 2; gy += 4)
    for (let gx = 2; gx < W - 2; gx += 5) {
      const x = Math.round(gx + (hash(gx, gy, 35) - 0.5) * 4);
      const y = Math.round(gy + (hash(gx, gy, 36) - 0.5) * 3);
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1 || (x < 118 && y < 34)) continue;
      const d = dist[y * W + x];
      if (d >= 6) WORLD_LIFE.sea.push([x, y]);
      if (d >= 11 && y > 6 && y < H - 6 && x > 26 && x < W - 26) WORLD_LIFE.deep.push([x, y]);
    }

  const marshPool = (x: number, y: number) => noise(x * 0.12, y * 0.21, 45) > 0.6;

  // ---- the land's top surface, per region
  const h1 = (x: number, y: number) => fbm(x * 0.06, y * 0.09, 21);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const r = reg[i];
      const lit = (h1(x - 1, y - 1) - h1(x + 1, y + 1)) * 5;
      const big = fbm(x * 0.02, y * 0.03, 23) - 0.5;
      let c: Col;
      if (r === 'greenmarch') c = pick(GRASS, 0.5 + lit * 0.5 + big * 0.35, x, y, 0.35);
      else if (r === 'frostpeaks') c = pick(TUNDRA, 0.55 + lit * 0.5 + big * 0.4 + (noise(x * 0.2, y * 0.3, 41) > 0.6 ? 0.3 : 0), x, y, 0.3);
      else if (r === 'ashfell') {
        c = pick(ASH, 0.5 + lit * 0.5 + big * 0.3, x, y, 0.3);
        // a few glowing fissures, more of them near the volcano
        const near = Math.max(0, 1 - Math.hypot(x - 250, (y - 70) * 1.5) / 40);
        const crack = Math.abs(noise(x * 0.16, y * 0.24, 43) - 0.5);
        if (crack < 0.012 + near * 0.014) (c = col('#d8481e')), (hot[i] = 1);
        else if (crack < 0.024 + near * 0.02) c = mix(c, col('#8a2418'), 0.5);
      } else {
        c = pick(MARSH, 0.52 + lit * 0.5 + big * 0.35, x, y, 0.35);
        // dark pools: a shadowed bank on top, a lit rim at the bottom, a glint of sky here and there
        if (marshPool(x, y)) c = !marshPool(x, y - 1) ? POOL[0] : !marshPool(x, y + 1) ? POOL[2] : hash(x, y, 46) < 0.05 ? POOL[3] : POOL[1];
      }
      // a beach (or snow, ash, mud) rim along the shore; a dark grassy lip over the cliff
      const seaN = !isLand(x, y - 1) && !cliff[i - W];
      const seaSide = !isLand(x - 1, y) || !isLand(x + 1, y);
      if (!isLand(x, y + 1)) c = r === 'greenmarch' ? GRASS[1] : r === 'frostpeaks' ? TUNDRA[1] : r === 'ashfell' ? ASH[0] : MARSH[0];
      else if (seaN || seaSide) c = r === 'greenmarch' ? (seaN ? SAND[2] : SAND[1]) : r === 'frostpeaks' ? SNOW[1] : r === 'ashfell' ? BASALT[1] : REED[1];
      if (hot[i] && c !== col('#d8481e')) hot[i] = 0;
      p.set(x, y, c);
    }
  // cliff faces: lit lip, then darker strata down to the waterline
  const CLIFF: Record<Region, Ramp> = {
    greenmarch: ramp('#3a2418', '#5a3820', '#7a5030', '#9a6c40'),
    frostpeaks: ramp('#2a2e44', '#3e4460', '#5a6280', '#7c86a2'),
    ashfell: ramp('#140c10', '#20141a', '#2e1c22', '#40282c'),
    duskmire: ramp('#202618', '#2e3622', '#40482e', '#56603c'),
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = cliff[i];
      if (!k) continue;
      const r = CLIFF[reg[i]];
      const strata = noise(x * 0.5, y * 0.9, 47) > 0.62 ? -1 : 0;
      p.set(x, y, r[Math.max(0, 3 - k + strata)]);
    }

  // ---- the river (and its banks); its ripples are drawn on the wave frames
  const riverPix: number[] = [];
  for (let y = 48; y < H; y++) {
    const cx = riverX(y);
    const wd = 1.4 + ((y - 48) / 78) * 1.6;
    for (let x = Math.floor(cx - wd / 2 - 1); x <= cx + wd / 2 + 1; x++) {
      const i = y * W + x;
      if (x < 0 || x >= W || !plate(i)) continue;
      const u = x + 0.5 - (cx - wd / 2);
      if (u < 0 || u > wd + 0.01) {
        if (land[i]) p.tint(x, y, (c) => mix(c, col('#10241c'), 0.35));
        continue;
      }
      p.set(x, y, u < 0.9 ? RIVER_BANK : RIVER);
      if (u >= 0.9) riverPix.push(i);
    }
  }

  // ---- what the locked regions hold (recorded, so it gets hazed with them)
  const lockPix = new Uint8Array(N);
  const record = (paint: () => void) => {
    const before = p.buf.slice();
    paint();
    for (let i = 0; i < N; i++) if (p.buf[i] !== before[i]) lockPix[i] = 1;
  };

  record(() => {
    // Frostpeaks: a range of snowy peaks, the tallest above its padlock, conifers on the foothills
    const peaks: Array<[number, number, number, number, number]> = [
      [136, 30, 17, 54, 11],
      [120, 36, 14, 55, 9],
      [176, 26, 20, 54, 13],
      [224, 31, 14, 55, 10],
      [204, 18, 24, 56, 16],
      [154, 33, 15, 55, 10],
      [190, 40, 11, 58, 7],
      [130, 42, 11, 58, 6],
      [216, 43, 10, 59, 6],
    ];
    peaks.forEach(([mx, top, hw, base, sd], k) => peak(p, mx, top, hw, base, 50 + k, sd));
    const pine = ramp('#0e1e22', '#16302e', '#22463a', '#336044', '#4a7a50');
    for (let i = 0; i < 16; i++) {
      const x = 122 + i * 6.6 + (hash(i, 1, 61) - 0.5) * 3;
      const base = Math.round(frostY(x) + 3 + hash(i, 2, 61) * 3);
      if (regionAt(Math.round(x), base - 2) !== 'frostpeaks' || Math.abs(x - 160) < 9) continue;
      conifer(p, rnd, x, base, 6 + Math.round(hash(i, 3, 61) * 2), 4, { ramp: pine, seed: 70 + i, bump: 0.1, tex: 0.1, shadow: 0.2, outline: col('#0a1418') });
    }

    // Ashfell: a black volcano with a glowing crater and lava running down its lit face (the view puffs its smoke)
    const vx = 250;
    const vTop = 40;
    const vBase = 80;
    const vxl: number[] = [];
    const vxr: number[] = [];
    for (let y = vTop; y <= vBase; y++) {
      const t = (y - vTop) / (vBase - vTop);
      const half = 4 + 22 * Math.pow(t, 1.25) + (noise(y * 0.4, 1, 81) - 0.5) * 2 * t;
      vxl.push(Math.round(vx - half));
      vxr.push(Math.round(vx + half));
    }
    const inV = (x: number, y: number) => y >= vTop && y <= vBase && x >= vxl[y - vTop] && x <= vxr[y - vTop];
    for (let y = vTop; y <= vBase; y++)
      for (let x = vxl[y - vTop]; x <= vxr[y - vTop]; x++) {
        const ridge = vx + (y - vTop) * 0.25;
        const lit = x < ridge;
        const gully = noise((x - vx) * 0.5 + (y - vTop) * 0.3, y * 0.05, 83) > 0.63;
        let c = pick(BASALT, (lit ? 0.72 : 0.35) - (gully ? 0.28 : 0) + ((y - vTop) / (vBase - vTop)) * 0.12, x, y, 0.2);
        if (!inV(x, y - 1) || !inV(x - 1, y) || !inV(x + 1, y)) c = INK;
        p.set(x, y, c);
        hot[y * W + x] = 0;
      }
    const lava = (x: number, y: number, c: Col) => {
      p.set(x, y, c);
      if (x >= 0 && y >= 0 && x < W && y < H) hot[y * W + x] = 2;
    };
    // the crater: a dark mouth with a molten rim
    for (let x = vx - 3; x <= vx + 3; x++) {
      lava(x, vTop, x < vx + 2 ? LAVA[3] : LAVA[2]);
      lava(x, vTop + 1, Math.abs(x - vx) < 3 ? LAVA[2] : LAVA[1]);
      if (Math.abs(x - vx) < 2) lava(x, vTop + 2, LAVA[1]);
    }
    glow(p, vx + 0.5, vTop + 1, 9, col('#ff7a2a'), 0.2);
    // lava runs: meandering down the lit face, molten core, cooling crust at the edges
    for (const [x0, drift, len, seed] of [
      [vx - 2, -0.5, 30, 91],
      [vx + 1, 0.12, 22, 93],
    ] as const) {
      let lx = x0;
      for (let k = 2; k < len; k++) {
        const y = vTop + k;
        lx += drift + (noise(k * 0.3, 1, seed) - 0.5) * 1.1;
        const xx = Math.round(lx);
        if (!inV(xx - 1, y) || !inV(xx + 1, y)) break;
        lava(xx, y, k < len * 0.6 ? LAVA[3] : LAVA[2]);
        lava(xx + 1, y, k < len * 0.75 ? LAVA[2] : LAVA[1]);
        if (k > len * 0.4) lava(xx - 1, y, LAVA[0]);
      }
    }
    // a few black spires in the ash fields
    for (const [x, y, hgt] of [
      [226, 82, 6],
      [231, 86, 4],
      [268, 80, 5],
    ] as const)
      for (let k = 0; k < hgt; k++) {
        p.set(x, y - k, k === hgt - 1 ? BASALT[3] : BASALT[2]);
        if (k < hgt - 2) p.set(x + 1, y - k, BASALT[1]);
        if (k < hgt - 1) p.set(x - 1, y - k, INK);
        p.set(x + (k < hgt - 2 ? 2 : 1), y - k, INK);
      }

    // Duskmire: reeds and dead trees over the fens (the view drifts mist and wisps over them); the Mirelight beacon
    for (let y = 86; y < 122; y += 2)
      for (let x = 176; x < 262; x += 2) {
        if (!isLand(x, y + 1) || regionAt(x, y) !== 'duskmire' || x < riverX(y) + 3) continue;
        if (!marshPool(x, y + 1) || marshPool(x, y) || hash(x, y, 103) > 0.45) continue;
        tuft(p, x, y + 1, 2 + Math.round(hash(x, y, 104) * 2), REED, x * 7 + y);
      }
    // dead trees: crooked grey trunks with bare branches
    for (const [x, y] of [
      [186, 98],
      [196, 117],
      [233, 104],
      [242, 98],
      [212, 118],
      [248, 112],
    ] as const) {
      if (!isLand(x, y)) continue;
      const tc = col('#7a7470');
      const td = col('#4a4644');
      for (let k = 0; k < 7; k++) {
        const xx = x + (k > 4 ? 1 : 0);
        p.set(xx - 1, y - k, INK);
        p.set(xx, y - k, k % 3 === 2 ? td : tc);
        p.set(xx + 1, y - k, k < 2 ? td : INK);
      }
      for (const [dx, dy] of [
        [-1, -4],
        [-2, -5],
        [-3, -5],
        [2, -6],
        [3, -7],
        [1, -7],
      ])
        p.set(x + dx, y + dy, dx < 0 ? tc : td);
    }
    const bx = 218;
    const by = 90;
    shadow(p, bx + 4, by + 17, 5, 1.5, 0.35);
    spr(p, BEACON, BEACON_PAL, bx, by);
    glow(p, bx + 3.5, by + 4, 8, col('#ffd860'), 0.2);

    // the road on into the locked east (over the river by a little bridge)
    const east = spline([
      [174, 68],
      [184, 70],
      [196, 74],
      [208, 80],
      [218, 84],
    ]);
    for (const [x, y] of east) {
      const xx = Math.round(x);
      const yy = Math.round(y);
      if (!isLand(xx, yy)) continue;
      p.set(xx, yy + 1, ROAD[0]);
      p.set(xx, yy, ROAD[1]);
    }
    const br = Math.round(riverX(70));
    spr(p, ['sSSSm', 'm...m'], P({ s: '#c8a070', S: '#a07848', m: '#6a4a2c' }), br - 2, 69, null);
  });

  // ---- haze over the locked regions (soft, dithered edges)
  const lockReg = new Float32Array(N);
  for (let i = 0; i < N; i++) lockReg[i] = plate(i) && reg[i] !== 'greenmarch' ? 1 : 0;
  const blur = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          s += lockReg[yy * W + xx];
          n++;
        }
      blur[y * W + x] = s / n;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = lockPix[i] ? 1 : plate(i) ? blur[i] : 0;
      if (k <= 0 || k < bay(x, y)) continue;
      p.buf[i] = hot[i] ? mix(p.buf[i], HAZE, 0.1) : hazed(p.buf[i]);
    }

  // ---- Noonspire: a floating island over the eastern sea, crowned by the white sun-spire (locked: hazed).
  // Painted on its own layer (the view bobs it); only its shadow on the sea goes on the map.
  const iso = WORLD_SPOTS.isle;
  const isleFull = new Pix(W, H, -1);
  {
    const q = isleFull;
    const ix = 291;
    const iy = 72;
    shadow(p, ix + 2, 100, 9, 2.2, 0.3);
    // a waterfall spilling off the island, fading into spray
    for (let y = iy + 2; y < iy + 24; y++) {
      const f = (y - iy - 2) / 22;
      for (const dx of [0, 1]) if (f < 0.6 || bay(ix - 9 + dx, y) > f) q.set(ix - 9 + dx, y, dx ? col('#9ad0f0') : col('#e8f8ff'));
    }
    const isleRock = ramp('#241a30', '#382a48', '#504064', '#6e5c84', '#8c7aa2');
    for (let y = iy + 1; y <= iy + 20; y++) {
      const t = (y - iy - 1) / 19;
      const half = 11 * Math.pow(1 - t, 1.2) + (noise(y * 0.5, 1, 111) - 0.5) * 2;
      for (let x = Math.round(ix - half); x <= Math.round(ix + half * 0.9); x++) {
        const u = (x - (ix - half)) / Math.max(1, half * 1.9);
        let v = 0.75 - u * 0.6 - t * 0.2;
        if ((y + Math.floor(noise(x * 0.4, 1, 113) * 3)) % 4 === 0) v -= 0.25; // strata
        q.set(x, y, pick(isleRock, v, x, y, 0.2));
      }
    }
    for (let y = iy - 3; y <= iy + 2; y++)
      for (let x = ix - 12; x <= ix + 12; x++) {
        const d = ((x + 0.5 - ix) / 11.5) ** 2 + ((y + 0.5 - iy) / 3.4) ** 2;
        if (d > 1) continue;
        q.set(x, y, y >= iy + 2 ? GRASS[2] : pick(GRASS, 0.85 - ((x - ix + 11) / 23) * 0.4 - (y - iy + 3) * 0.05, x, y, 0.3));
      }
    // the spire: tapering white stone with gold bands, a gold sun disc on top (the view twinkles its rays)
    for (let y = 46; y <= iy; y++) {
      const half = y < 52 ? 0 : y < 62 ? 1 : 1.5;
      for (let x = Math.round(ix - half); x <= Math.round(ix + half); x++) q.set(x, y, x < ix ? col('#ffffff') : x === ix ? col('#d8e0ee') : col('#9aa6c4'));
      if (y === 56 || y === 64) for (let x = ix - 1; x <= ix + 1; x++) q.set(x, y, x <= ix ? col('#f2c230') : col('#b07a18'));
    }
    for (let y = 46; y <= iy; y++) {
      const half = y < 52 ? 0 : y < 62 ? 1 : 1.5;
      q.set(Math.round(ix - half) - 1, y, INK);
      q.set(Math.round(ix + half) + 1, y, INK);
    }
    spr(q, ['.gGg.', 'gGWGy', 'GWGgy', 'gGgyY', '.yyY.'], P({ W: '#ffffff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14' }), ix - 2, 40);
    // a little white shrine at its foot
    spr(q, ['.sSm.', 'sSSmm', 'sk.km'], P({ s: '#ffffff', S: '#d8e0ee', m: '#9aa6c4', k: '#3a3050' }), ix + 3, iy - 4);
    for (let i = 0; i < N; i++) if (q.buf[i] >= 0) q.buf[i] = hazed(q.buf[i]);
  }
  const isle = crop(isleFull, iso.x, iso.y, 29, 62);

  // ---- Greenmarch (playable): fields, the Meadow Road, the forest, the ruins, the Hollow and the capital
  const roadPix = new Uint8Array(N);
  const road = (pts: Array<[number, number]>, wide: boolean) => {
    for (const [x, y] of spline(pts)) {
      const xx = Math.round(x);
      const yy = Math.round(y);
      if (!isLand(xx, yy) || reg[yy * W + xx] !== 'greenmarch') continue;
      for (const [dx, dy] of wide ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0], [0, 1]]) roadPix[(yy + dy) * W + xx + dx] = 1;
    }
  };
  road(MEADOW_ROAD, true);
  WORLD_ROAD.length = 0;
  for (const [x, y] of spline(MEADOW_ROAD.slice(0, 11), 1)) WORLD_ROAD.push([Math.round(x), Math.round(y)]);
  road(
    [
      [86, 95],
      [100, 99],
      [114, 104],
      [126, 110],
    ],
    false,
  );

  // patchwork fields round the village, hedged
  const FIELDS = [GRASS[5], GRASS[6], col('#d8c060'), col('#c0a048'), GRASS[4], col('#9a6a3e')];
  for (let y = 98; y < 122; y++)
    for (let x = 36; x < 104; x++) {
      const i = y * W + x;
      if (!land[i] || reg[i] !== 'greenmarch' || !isLand(x, y + 1) || !isLand(x - 1, y) || !isLand(x + 1, y)) continue;
      if (((x + 0.5 - 70) / 34) ** 2 + ((y + 0.5 - 111) / 11) ** 2 > 1) continue;
      const row = Math.floor((y - 98) / 5);
      const sx = x + row * 3 - (y - 98) * 0.4;
      const colI = Math.floor(sx / 9);
      const fy = (y - 98) % 5;
      const fx = Math.floor(sx) % 9;
      const kind = Math.floor(hash(colI, row, 121) * FIELDS.length);
      if (hash(colI, row, 122) < 0.22) continue; // some meadow left wild
      let c = FIELDS[kind];
      if (kind === 5 && x % 2 === 0) c = col('#7a4e2e'); // ploughed furrows
      if ((kind === 2 || kind === 3) && fy === 2) c = mix(c, col('#8a6a2a'), 0.4);
      if (fy === 4 || fx === 0) c = (x + y) % 3 === 0 ? FOREST[1] : GRASS[1]; // hedgerows
      p.set(x, y, c);
    }
  // the roads, over the fields
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!roadPix[i]) continue;
      const below = y + 1 < H && !roadPix[i + W];
      p.set(x, y, below ? ROAD[0] : roadPix[i - W] ? ROAD[2] : ROAD[1]);
    }

  // the forest: tree crowns packed over the north-west, nearer crowns overlapping the ones behind
  const forest: Blob[] = [];
  for (let y = 40; y < 84; y += 3.3)
    for (let x = 36; x < 112; x += 4.1) {
      const jx = x + (rnd() - 0.5) * 2.4 + ((y / 3.3) % 2) * 2;
      const jy = y + (rnd() - 0.5) * 1.6;
      const xi = Math.round(jx);
      const yi = Math.round(jy);
      if (((jx - 72) / 34) ** 2 + ((jy - 60) / 20) ** 2 > 1 + (noise(jx * 0.15, jy * 0.15, 131) - 0.5) * 0.6) continue;
      if (!isLand(xi, yi + 2) || !isLand(xi - 2, yi) || !isLand(xi + 2, yi) || regionAt(xi, yi) !== 'greenmarch') continue;
      if (roadPix[yi * W + xi] || roadPix[(yi + 2) * W + xi] || (jx > 98 && jy < 66 && jx < 124)) continue;
      const r = 2.2 + rnd() * 0.9;
      forest.push({ x: jx, y: jy, rx: r, ry: r * 0.88 });
    }
  for (const b of forest) shadow(p, b.x + 1.2, b.y + 2, b.rx, b.ry * 0.7, 0.3);
  mass(p, forest, { ramp: FOREST, seed: 133, bump: 0.22, tex: 0.22, vgrad: 0.08, light: 0.06, shadow: 0.3, frontLow: true, outline: col('#0c1c16'), form: { x: 66, y: 54, rx: 40, ry: 26 }, formMix: 0.3 });
  // a few lone trees over the meadows
  for (const [x, y] of [
    [103, 111],
    [118, 78],
    [150, 99],
    [62, 90],
    [40, 94],
    [141, 115],
    [174, 82],
    [58, 96],
  ] as const) {
    if (!isLand(x, y + 5) || roadPix[(y + 4) * W + x + 2]) continue;
    shadow(p, x + 3.5, y + 5, 2.6, 1, 0.35);
    spr(p, LONE_TREE, LONE_PAL, x, y, col('#0c1c16'));
  }

  // wildflowers and bushes dotted over the open meadows
  {
    const grassy = (x: number, y: number) => isLand(x, y) && reg[y * W + x] === 'greenmarch' && !roadPix[y * W + x] && GRASS.includes(p.get(x, y));
    const FLOWERS: Array<[Col, Col]> = [
      [col('#f07aa8'), col('#ffd0e0')],
      [col('#f2d048'), col('#fff0a0')],
      [col('#e8eef8'), col('#ffffff')],
      [col('#a87ae8'), col('#dab0ff')],
    ];
    const BUSH = ['.lL.', 'lLLd', '.dD.'];
    for (let gy = 64; gy < 122; gy += 4)
      for (let gx = 30; gx < 186; gx += 5) {
        const x = Math.round(gx + (hash(gx, gy, 151) - 0.5) * 4);
        const y = Math.round(gy + (hash(gx, gy, 152) - 0.5) * 3);
        const r = hash(gx, gy, 153);
        if (Math.abs(x - WORLD_SPOTS.hero.x) < 7 && Math.abs(y - WORLD_SPOTS.hero.y) < 6) continue;
        if (r < 0.07) {
          if (!grassy(x, y) || !grassy(x + 3, y + 2) || !grassy(x, y + 2) || !grassy(x + 3, y)) continue;
          shadow(p, x + 2.5, y + 3, 2.2, 0.8, 0.3);
          spr(p, BUSH, LONE_PAL, x, y, col('#0c1c16'));
        } else if (r < 0.3) {
          if (!grassy(x, y) || !grassy(x + 1, y) || !grassy(x, y + 1)) continue;
          const [a, b] = FLOWERS[Math.floor(hash(gx, gy, 154) * FLOWERS.length)];
          p.set(x, y, b);
          p.set(x + 1, y, a);
          p.set(x, y + 1, a);
        }
      }
  }

  // a fenced sheep paddock east of the Hollow (the view grazes the sheep)
  {
    const sp = WORLD_SPOTS.sheep;
    const wood = col('#d0a46a');
    const post = col('#8e5a2e');
    const dark = col('#3a2a1a');
    for (let x = sp.x; x <= sp.x + sp.w; x++)
      for (const y of [sp.y, sp.y + sp.h]) {
        const isPost = (x - sp.x) % 4 === 0;
        if (isPost) p.set(x, y - 1, wood);
        p.set(x, y, isPost ? post : wood);
        p.set(x, y + 1, dark);
      }
    for (let y = sp.y + 1; y < sp.y + sp.h; y++)
      for (const x of [sp.x, sp.x + sp.w]) {
        const isPost = (y - sp.y) % 3 === 0;
        p.set(x, y, isPost ? post : wood);
        p.set(x + 1, y, x === sp.x ? mix(p.get(x + 1, y), col('#10241c'), 0.3) : dark);
      }
    // a hayrick in the corner
    spr(p, ['.yY.', 'yyYY', 'YYYz'], P({ y: '#f2d048', Y: '#c09030', z: '#8a6020' }), sp.x + sp.w - 6, sp.y + 2);
  }

  // things standing over the water (kept clear of the wave and surf layers)
  const cover = new Uint8Array(N);
  const covering = (paint: () => void) => {
    const before = p.buf.slice();
    paint();
    for (let i = 0; i < N; i++) if (p.buf[i] !== before[i]) cover[i] = 1;
  };
  // the lighthouse on the western islet (the view flashes its lamp)
  covering(() => {
    const lh = WORLD_SPOTS.lighthouse;
    spr(p, ['.rR.', 'kffk', 'sSSm', '.wW.', '.rR.', '.wW.', '.rR.', 'sSSm'], P({ r: '#d23a30', R: '#8e2026', k: '#2a1c34', f: '#ffe680', s: '#c8c0b2', S: '#a09a96', m: '#78747c', w: '#f4ecd8', W: '#c8bca4' }), lh.x - 1, lh.y - 1);
  });

  // a pier at the village, a fishing boat moored at its end
  covering(() => {
    const py = 106;
    let cx = 20;
    while (cx < 60 && !isLand(cx, py)) cx++;
    for (let x = cx - 6; x < cx; x++) {
      p.set(x, py, col('#c08a50'));
      p.set(x, py + 1, col('#6e4020'));
      if ((x - cx) % 2 === 0) p.set(x, py + 2, col('#3a2418'));
    }
    WORLD_LIFE.boat = [cx - 9, py + 2];
  });

  // the windmill at the end of the fields (its sails turn in the view)
  {
    const m = WORLD_SPOTS.mill;
    shadow(p, m.x + 2, m.y + 7, 3.5, 1.2, 0.35);
    spr(p, MILL, MILL_PAL, m.x - 2, m.y - 1);
  }

  // the village at the start of the Meadow Road (its chimneys smoke in the view)
  WORLD_LIFE.chimneys.length = 0;
  for (const [x, y, blue] of [
    [38, 100, false],
    [45, 98, true],
    [42, 104, false],
  ] as const) {
    shadow(p, x + 4, y + 4, 3, 1, 0.35);
    spr(p, HOUSE, blue ? HOUSE_BLUE : HOUSE_PAL, x, y);
    WORLD_LIFE.chimneys.push([x + 4, y - 1]);
  }

  // the old stone ruins (Act 2), at the forest's eastern edge
  shadow(p, 115, 63, 9, 1.6, 0.35);
  spr(p, RUINS, STONE_PAL, 106, 52);
  for (const [x, y] of [
    [103, 62],
    [123, 63],
  ] as const) {
    p.set(x, y, STONE_PAL.S);
    p.set(x + 1, y, STONE_PAL.m);
    p.set(x, y + 1, STONE_PAL.M);
  }

  // the Boar King's Hollow (Act 3): a giant, twisted autumn tree with a dark den between its roots
  {
    const tx = 134;
    const bark = ramp('#2a1418', '#46242a', '#683a30', '#8e5a3c');
    shadow(p, tx + 4, 112, 12, 2.5, 0.35);
    for (let y = 96; y <= 111; y++) {
      const t = (y - 96) / 15;
      const cx = tx + Math.sin(y * 0.35) * 1.2;
      const half = 2.6 + t * 1.6 + Math.pow(Math.max(0, t - 0.6) / 0.4, 2) * 3;
      const xl = Math.round(cx - half);
      const xr = Math.round(cx + half);
      for (let x = xl - 1; x <= xr + 1; x++) {
        if (x < xl || x > xr) {
          p.set(x, y, INK);
          continue;
        }
        const u = (x - xl) / Math.max(1, xr - xl);
        let v = 0.85 - u * 0.75;
        if (noise(x * 0.7, y * 0.15, 141) > 0.62) v -= 0.3;
        p.set(x, y, pick(bark, v, x, y));
      }
    }
    // the den: an almond-shaped hollow, two red eyes glinting inside
    for (let y = 104; y <= 111; y++) {
      const half = Math.round(Math.sin(((y - 103) / 9) * Math.PI) * 2.2);
      for (let x = tx - half; x <= tx + half; x++) p.set(x, y, y > 109 ? col('#2a1418') : INK);
    }
    p.set(tx - 1, 107, col('#ff5a3a'));
    p.set(tx + 1, 107, col('#ff5a3a'));
    // roots
    for (const [dir, len] of [
      [-1, 6],
      [1, 7],
    ] as const)
      for (let k = 0; k < len; k++) {
        const x = tx + dir * (5 + k);
        const y = 110 + Math.round((k / len) * 2);
        p.set(x, y, bark[2]);
        p.set(x, y + 1, INK);
        p.set(x, y - 1, k > len - 2 ? INK : bark[3]);
      }
    const AUTUMN = ramp('#4a1618', '#7e2220', '#b83a24', '#e0642a', '#f49a3a', '#ffd070');
    const crownBlobs = crown(rng(143), tx - 1, 90, 15, 8.5, 3.4);
    mass(p, crownBlobs, { ramp: AUTUMN, seed: 145, bump: 0.24, tex: 0.25, vgrad: 0.12, light: 0.04, shadow: 0.3, outline: col('#2e0c10'), form: { x: tx - 3, y: 88, rx: 17, ry: 10 }, formMix: 0.5 });
    for (const [x, y] of [
      [tx - 13, 101],
      [tx + 12, 103],
      [tx - 8, 104],
      [tx + 7, 112],
    ] as const)
      p.set(x, y, AUTUMN[3]); // fallen leaves
  }

  // the capital: a walled town round the Great Pendulum
  {
    const cx = 160;
    const cy = 56;
    const rx = 15;
    const ry = 7;
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.set(x, y, (x * 3 + y * 5) % 7 === 0 ? col('#a89474') : (x + y) % 2 ? col('#cdb894') : col('#c2ac88'));
    // the back wall
    for (let x = cx - rx + 2; x <= cx + rx - 2; x++) {
      const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
      p.set(x, y - 1, INK);
      p.set(x, y, col('#d4c6a8'));
      p.set(x, y + 1, col('#8a7a68'));
    }
    // houses, back row first
    for (const [x, y, blue] of [
      [148, 49, false],
      [166, 49, true],
      [144, 52, true],
      [150, 53, false],
      [170, 52, false],
      [146, 56, true],
      [167, 56, false],
    ] as const)
      spr(p, HOUSE, blue ? HOUSE_BLUE : HOUSE_PAL, x, y);
    WORLD_LIFE.chimneys.push([151, 48], [174, 51]);
    // the front wall with crenellations and the gate
    for (let x = cx - rx; x <= cx + rx; x++) {
      const y = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2))) - 1;
      const lit = x < cx + 4;
      p.set(x, y - 2, x % 2 ? (lit ? col('#f4ecd8') : col('#d4c6a8')) : INK);
      p.set(x, y - 1, lit ? col('#e6dac0') : col('#bcae92'));
      p.set(x, y, lit ? col('#c8b898') : col('#a49478'));
      p.set(x, y + 1, col('#746450'));
      p.set(x, y + 2, INK);
      if (x % 2 === 0) p.set(x, y - 3, INK);
    }
    spr(p, ['.kk.', 'kkkk', 'kkkk'], P({ k: '#2a1c34' }), cx - 2, 61, null);
    for (const tx of [cx - rx - 2, cx + rx - 2]) spr(p, TURRET, TOWER_PAL, tx, cy - 3);
    // the tower itself, rising out of the middle of the town
    shadow(p, cx + 7, 61, 5, 1.2, 0.3);
    spr(p, TOWER, TOWER_PAL, cx - 6, 29);
    glow(p, cx + 0.5, 44.5, 7, col('#fff0c0'), 0.1);
  }

  // lit windows (village and capital) for the view to twinkle
  WORLD_LIFE.windows.length = 0;
  const win = col(HOUSE_WINDOW);
  for (let y = 45; y < 112; y++)
    for (let x = 30; x < 180; x++) if (p.buf[y * W + x] === win && (x < 60 || x > 140)) WORLD_LIFE.windows.push([x, y]);

  // ---- the cycled layers: wave marks + river ripples, surf, glows
  // (each layer's frames are painted one after another into one scratch buffer)
  const waves: HTMLCanvasElement[] = [];
  const scratch = new Pix(W, H, -1);
  const marks: Array<[number, number, number]> = [];
  for (let gy = 2; gy < H; gy += 7)
    for (let gx = (gy * 5) % 11; gx < W; gx += 11) {
      const x = Math.round(gx + (hash(gx, gy, 31) - 0.5) * 6);
      const y = Math.round(gy + (hash(gx, gy, 32) - 0.5) * 3);
      if (x < 1 || x > W - 6 || y < 2 || y >= H || hash(gx, gy, 33) < 0.25) continue;
      if (dist[y * W + x] < 5 || dist[y * W + Math.min(W - 1, x + 5)] < 5) continue;
      marks.push([x, y, Math.floor(hash(gx, gy, 34) * WAVE_FRAMES)]);
    }
  const light = (c: Col, k = 0.38) => mix(c, WAVE_LIGHT, k);
  for (let f = 0; f < WAVE_FRAMES; f++) {
    const q = scratch;
    q.buf.fill(-1);
    const tint = (x: number, y: number, fn: (c: Col) => Col) => {
      const c = p.get(x, y);
      if (c >= 0) q.set(x, y, fn(c));
    };
    for (const [x, y, ph] of marks) {
      if (cover[y * W + x] || cover[y * W + x + 3]) continue;
      const s = (f + ph) % WAVE_FRAMES; // 0-1 hidden, 2 forming, 3 full, 4 cresting a pixel on, 5 breaking up
      if (s < 2) continue;
      const o = s >= 4 ? 1 : 0;
      if (s === 2 || s === 5) {
        tint(x + 1 + o, y - 1, (c) => light(c, 0.3));
        tint(x + 2 + o, y - 1, (c) => light(c, 0.3));
        continue;
      }
      tint(x + o, y, light);
      tint(x + 1 + o, y - 1, light);
      tint(x + 2 + o, y - 1, s === 4 ? () => FOAM : light);
      tint(x + 3 + o, y, light);
      tint(x + 1 + o, y, (c) => mix(c, SEA[0], 0.4));
      tint(x + 2 + o, y, (c) => mix(c, SEA[0], 0.4));
    }
    // the river's ripples flow downstream
    for (const i of riverPix) {
      const x = i % W;
      const y = (i - x) / W;
      if ((((y + x * 2 - f) % WAVE_FRAMES) + WAVE_FRAMES) % WAVE_FRAMES === 0) q.buf[i] = mix(p.buf[i], col('#a8e0f4'), 0.55);
    }
    waves.push(q.canvas());
  }
  // surf: a broken line of foam rolls in to the beach, then the beach foam swells
  const surf: HTMLCanvasElement[] = [];
  for (let f = 0; f < SURF_FRAMES; f++) {
    const q = scratch;
    q.buf.fill(-1);
    const at = 4.2 - f * 0.95; // the line's distance from the shore
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const d = dist[i];
        if (d === 0 || d > 5.5 || cover[i]) continue;
        const n = noise(x * 0.33, y * 0.33, 77);
        if (f < SURF_FRAMES - 1) {
          if (Math.abs(d - at) < 0.55 && n > 0.5 - f * 0.12) q.buf[i] = f === 0 ? mix(p.buf[i], FOAM, 0.4) : f === 1 ? mix(p.buf[i], FOAM, 0.7) : FOAM;
        } else if (d > 1.2 && d < 2.3 && n > 0.3) q.buf[i] = d < 1.8 ? FOAM : mix(p.buf[i], FOAM, 0.6);
      }
    surf.push(q.canvas());
  }
  // the volcano lit up (crater, lava, fissures, a halo), and the Mirelight's lamp lit up
  const lavaP = new Pix(W, H, -1);
  const crater = WORLD_SPOTS.crater;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const s = glowStep(x, y, crater.x + 0.5, crater.y + 1.5, 9);
      const near = Math.hypot(x - crater.x, (y - crater.y - 30) * 0.8) < 30;
      if (hot[i] === 2) lavaP.buf[i] = mix(p.buf[i], col('#fff4b0'), 0.7);
      else if (hot[i] === 1 && near) lavaP.buf[i] = mix(p.buf[i], col('#ffb040'), 0.6);
      else if (s) lavaP.buf[i] = lighten(p.buf[i], col('#ff6a2a'), 0.32 * s);
    }
  const lampP = new Pix(W, H, -1);
  const lamp = WORLD_SPOTS.beacon;
  for (let y = lamp.y - 10; y <= lamp.y + 10; y++)
    for (let x = lamp.x - 10; x <= lamp.x + 10; x++) {
      const s = glowStep(x, y, lamp.x + 0.5, lamp.y + 0.5, 10);
      if (s) lampP.set(x, y, lighten(p.get(x, y), col('#ffd860'), 0.4 * s));
    }
  for (const [x, y] of [
    [lamp.x - 1, lamp.y - 1],
    [lamp.x, lamp.y - 1],
    [lamp.x + 1, lamp.y - 1],
    [lamp.x - 1, lamp.y],
    [lamp.x, lamp.y],
    [lamp.x + 1, lamp.y],
  ])
    lampP.set(x, y, col('#ffffff'));

  // the gust: a soft diagonal band that lifts each leaf and grass tone one step up its ramp
  const wind: HTMLCanvasElement[] = [];
  const crops = new Set([...FIELDS, ...Object.values(LONE_PAL)]);
  const tip = col('#f0f8c0');
  const straw = col('#f0f4b0');
  const up = (c: Col, n: number): Col => {
    for (const r of [GRASS, FOREST]) {
      const k = r.indexOf(c);
      if (k >= 0) return k + n < r.length ? r[k + n] : mix(r[r.length - 1], tip, 0.3 * n);
    }
    return crops.has(c) ? mix(c, straw, 0.2 * n) : -1;
  };
  const leafInk = col('#0c1c16');
  const wb = WORLD_BOXES.wind;
  const gq = new Pix(wb.w, wb.h, -1);
  for (let f = 0; f < WIND_FRAMES; f++) {
    const q = gq;
    q.buf.fill(-1);
    const at = 20 + (f / (WIND_FRAMES - 1)) * 190;
    for (let y = wb.y; y < wb.y + wb.h; y++)
      for (let x = wb.x; x < wb.x + wb.w; x++) {
        const i = y * W + x;
        const j = (y - wb.y) * wb.w + x - wb.x;
        if (!land[i] || reg[i] !== 'greenmarch' || roadPix[i]) continue;
        const d = Math.abs(x + y * 0.7 - at) / 9;
        if (d >= 1 || 1 - d < bay(x, y) * 1.2) continue;
        const c = p.buf[i];
        if (c === INK || c === leafInk) continue;
        const v = up(c, d < 0.45 ? 2 : 1);
        if (v >= 0) q.buf[j] = v;
      }
    wind.push(q.canvas());
  }

  const box = (q: Pix, b: { x: number; y: number; w: number; h: number }) => crop(q, b.x, b.y, b.w, b.h);
  return { base: p, isle, waves, surf, lava: box(lavaP, WORLD_BOXES.lava), lamp: box(lampP, WORLD_BOXES.lamp), wind };
}

// ------------------------------------------------------------------ sprites

/** A blob mass on a transparent canvas of its own (clouds, smoke, mist), plus its silhouette as a flat shadow. */
function massSprite(blobs: Blob[], o: Parameters<typeof mass>[2], shadowCol?: Col): { img: HTMLCanvasElement; sil: HTMLCanvasElement } {
  let w = 0;
  let h = 0;
  for (const b of blobs) {
    w = Math.max(w, Math.ceil(b.x + b.rx * 1.3) + 2);
    h = Math.max(h, Math.ceil(b.y + b.ry * 1.3) + 2);
  }
  const p = new Pix(w, h, -1);
  mass(p, blobs, o);
  const s = new Pix(w, h, -1);
  const sc = shadowCol ?? col('#08122a');
  for (let i = 0; i < p.buf.length; i++) if (p.buf[i] >= 0) s.buf[i] = sc;
  return { img: p.canvas(), sil: s.canvas() };
}

const CLOUD_SHAPES: Blob[][] = [
  [
    { x: 6, y: 7, rx: 4, ry: 3.2 },
    { x: 11, y: 5.5, rx: 5, ry: 4 },
    { x: 17, y: 6.5, rx: 4.2, ry: 3.3 },
    { x: 21.5, y: 7.5, rx: 2.8, ry: 2.2 },
  ],
  [
    { x: 5, y: 6, rx: 3.4, ry: 2.8 },
    { x: 10, y: 5, rx: 4.4, ry: 3.4 },
    { x: 14.5, y: 6.5, rx: 3, ry: 2.4 },
  ],
  [
    { x: 6, y: 8, rx: 4.4, ry: 3.4 },
    { x: 12, y: 6, rx: 5.6, ry: 4.4 },
    { x: 19, y: 6.5, rx: 5, ry: 4 },
    { x: 25, y: 8, rx: 4, ry: 3 },
    { x: 29.5, y: 9, rx: 2.6, ry: 2 },
  ],
  [
    { x: 4, y: 4.5, rx: 2.8, ry: 2.2 },
    { x: 8, y: 4, rx: 3.4, ry: 2.8 },
    { x: 11.5, y: 5, rx: 2.4, ry: 1.9 },
  ],
];
// shadows of clouds high overhead, drifting over the land
const SHADOW_SHAPES: Blob[][] = [
  [
    { x: 12, y: 11, rx: 10, ry: 6 },
    { x: 24, y: 9, rx: 12, ry: 7.5 },
    { x: 38, y: 11, rx: 11, ry: 6.5 },
    { x: 49, y: 13, rx: 7, ry: 4.5 },
  ],
  [
    { x: 10, y: 9, rx: 8, ry: 5 },
    { x: 21, y: 8, rx: 10, ry: 6 },
    { x: 31, y: 10, rx: 7, ry: 4.5 },
  ],
];
const PUFF_SHAPES: Blob[][] = [
  [{ x: 3.5, y: 3.5, rx: 2.2, ry: 2 }],
  [
    { x: 4, y: 4.5, rx: 3, ry: 2.6 },
    { x: 6.5, y: 4, rx: 2.4, ry: 2.1 },
  ],
  [
    { x: 5, y: 6, rx: 4, ry: 3.3 },
    { x: 9, y: 5.5, rx: 3.4, ry: 2.9 },
    { x: 3, y: 6.5, rx: 2.4, ry: 2 },
  ],
];
const FOG_SHAPES: Blob[][] = [
  [
    { x: 6, y: 4.5, rx: 5, ry: 2.2 },
    { x: 14, y: 4, rx: 7, ry: 2.8 },
    { x: 24, y: 4.5, rx: 6, ry: 2.4 },
    { x: 32, y: 5, rx: 4, ry: 1.8 },
  ],
  [
    { x: 5, y: 4, rx: 4.5, ry: 2 },
    { x: 12, y: 3.5, rx: 6, ry: 2.5 },
    { x: 20, y: 4, rx: 5, ry: 2.2 },
  ],
];

// Rowan at map scale: plumed helm with glowing eyes, gold pauldrons, blue tabard, red cape. Frame 1 is the
// breath (the body sinks a pixel).
const HERO_PAL = P({
  r: '#d03030',
  q: '#f05a48',
  Q: '#ff9a80',
  R: '#8a1a22',
  S: '#eef3fa',
  W: '#ffffff',
  s: '#b8c2d8',
  m: '#7c86a6',
  M: '#4a5272',
  k: '#1c1430',
  E: '#7ae8ff',
  G: '#fff0a0',
  g: '#f2c230',
  y: '#d8901c',
  Y: '#9a5a14',
  b: '#2a6ad8',
  l: '#4aa0f0',
  B: '#1a3c8a',
  v: '#b42c34',
  V: '#d24840',
  c: '#6a1424',
  d: '#4a2c18',
  h: '#6e4426',
});
const HERO_ROWS = [
  '....rQ....',
  '...rqqR...',
  '...sSSm...',
  '..sSWSsm..',
  '..kEkkEk..',
  '..mssmmM..',
  '.gGgbbgyY.',
  'vsSblbbBmc',
  'vmsbgbbBMc',
  '.cyyGyyYc.',
  '..BbbbbB..',
  '..mM..mM..',
  '..hd..hd..',
];
const HERO_FRAMES = [HERO_ROWS, ['..........', '.....rQ...', '...rqqrR..', ...HERO_ROWS.slice(2, 10), HERO_ROWS[11], HERO_ROWS[12]]];

// Pip at map scale: a round blue owl with yellow eyes, wings up / down
const PIP_PAL = P({ b: '#2a6ad8', B: '#1a3c8a', l: '#4aa0f0', n: '#6aaef0', i: '#ffd84a', y: '#f2a020', c: '#efe2c4' });
const PIP_FRAMES = [
  ['n.l.l.n', 'nlbbbbn', '.bibib.', '.bbyBB.', '..bcB..'],
  ['..l.l..', '.lbbbb.', 'nbibibn', 'nbbyBBn', '..bcB..'],
];

// a merchant cog under a striped sail, bow to the right; frame 1 the sail fills and the pennant flicks
const SHIP_PAL = P({ w: '#dcd4c4', W: '#ffffff', r: '#d03030', R: '#8a1a22', m: '#6e4020', h: '#c08a50', H: '#8e5a2e', d: '#6e4020', D: '#4e2c16', g: '#f2c230' });
const SHIP_FRAMES = [
  ['......Rr.....', '......m......', '....wWWWw....', '...wWWWWWw...', '...rrrrrrr...', '...wWWWWWw...', '....wwWww....', '......m.....h', 'hhhhhhhhhhhH.', '.dddgddddddD.', '..DDDDDDDDD..'],
  ['......Rrr....', '......m......', '....wWWWw....', '...wWWWWWWw..', '...rrrrrrrr..', '...wWWWWWWw..', '....wwWwww...', '......m.....h', 'hhhhhhhhhhhH.', '.dddgddddddD.', '..DDDDDDDDD..'],
];

// a fishing boat (moored at the pier) and the merchant's covered cart (rolls along the Meadow Road)
const BOAT_PAL = P({ w: '#e8e0d0', W: '#ffffff', h: '#c08a50', H: '#8e5a2e', d: '#6e4020', D: '#4e2c16', m: '#6e4020' });
const BOAT_FRAMES = [
  ['..m...', '..wW..', '..wWW.', 'hhhhhH', '.dddD.'],
  ['..m...', '..Ww..', '..wWw.', 'hhhhhH', '.dddD.'],
];
const CART_PAL = P({ w: '#f4ecd8', W: '#c8bca4', h: '#b07a44', H: '#6e4020', o: '#3a2418', O: '#8e5a2e', b: '#8a5a34', B: '#5a3420' });
const CART_FRAMES = [
  ['.wwW....', 'wwwWW.b.', 'hhhHHbbB', '.o..o.B.'],
  ['.wwW....', 'wwwWW.b.', 'hhhHHbbB', '.O..O..B'],
];

// gulls: wings up, wings level
const BIRD_PAL = P({ W: '#ffffff', w: '#c8d0e0' });
const BIRD_FRAMES = [
  ['W...W', '.W.W.', '..w..'],
  ['.....', 'WWwWW', '.....'],
];

/** The windmill's four sails (a lattice spar with the cloth on its trailing side): + and x. */
function millSails(diag: boolean): HTMLCanvasElement {
  const n = 11;
  const c = 5;
  const g: string[][] = Array.from({ length: n }, () => Array<string>(n).fill('.'));
  const arms: Array<[number, number, number, number]> = diag
    ? [
        [1, 1, -1, 0],
        [-1, 1, 0, -1],
        [-1, -1, 1, 0],
        [1, -1, 0, 1],
      ]
    : [
        [1, 0, 0, 1],
        [0, 1, -1, 0],
        [-1, 0, 0, -1],
        [0, -1, 1, 0],
      ];
  for (const [dx, dy, ox, oy] of arms) {
    const len = diag ? 4 : 5;
    for (let k = 1; k <= len; k++) {
      g[c + dy * k][c + dx * k] = 'm';
      if (k >= 2) {
        const x = c + dx * k + ox;
        const y = c + dy * k + oy;
        if (x >= 0 && y >= 0 && x < n && y < n && g[y][x] === '.') g[y][x] = dx + dy > 0 || (diag && dx > 0) ? 'W' : 'w';
      }
    }
  }
  g[c][c] = 'o';
  return sprite(
    g.map((r) => r.join('')),
    P({ m: '#6e4020', w: '#f4ecd8', W: '#d8ccb4', o: '#2e1a0e' }),
  );
}

// ------------------------------------------------------------------ padlock and flags

const PADLOCK = [
  '..SSSs...',
  '.Ss...sm.',
  '.Ss...mM.',
  '.Ss...mM.',
  'GGGgggggy',
  'gWWggggyY',
  'gGggkkgyY',
  'gggkkkyyY',
  'ggggkgyyY',
  'yggggyyYY',
  '.yyyyyYz.',
];
const PADLOCK_PAL: Pal = {
  S: '#eef3fa',
  s: '#b8c2d8',
  m: '#7c86a6',
  M: '#4a5272',
  W: '#ffffff',
  G: '#fff0a0',
  g: '#f2c230',
  y: '#d8901c',
  Y: '#9a5a14',
  z: '#5a3410',
  k: '#2a1830',
};

// a pennant on a pole (the pole's foot is the scene's origin: 2.5 px from the texture's left), three frames of
// the cloth rippling in the wind; a gold star is stitched on it
const FLAG_FRAMES_ROWS = [
  ['.G......', '.hccc...', '.hcEccc.', '.hcccccd', '.hccd...', '.h......', '.h......', '.h......', '.h......', '.H......'],
  ['.G......', '.hcccc..', '.hcEcccd', '.hcccd..', '.hcd....', '.h......', '.h......', '.h......', '.h......', '.H......'],
  ['.G......', '.hccccd.', '.hcEccc.', '.hccccd.', '.hd.....', '.h......', '.h......', '.h......', '.h......', '.H......'],
];
const FLAG_ON = P({ G: '#fff0a0', h: '#b07a44', H: '#6e4020', c: '#e03a30', d: '#9a1e24', E: '#fff0a0' });
const FLAG_OFF = P({ G: '#d8dce6', h: '#9a8a7a', H: '#5e5248', c: '#e8ecf4', d: '#a8b0c4', E: '#c8d0dc' });
/** The flag texture's origin (pole foot). */
export const FLAG_ORIGIN = { x: 2.5 / 10, y: 1 };

/** Cloud banks framing the map's corners and edges (foreground, transparent elsewhere). */
function paintFrame(): Pix {
  const p = new Pix(WORLD_W, WORLD_H, -1);
  const deep = ramp('#5a6c98', '#8094c0', '#a8bcdc', '#d4e2f4', '#f4f8ff');
  const bank = (cx: number, cy: number, n: number, spread: number, seed: number, flat = 0.75) => {
    const r2 = rng(seed);
    const bl: Blob[] = [];
    for (let i = 0; i < n; i++) {
      const r = 3.5 + r2() * 4.5;
      bl.push({ x: cx + (r2() - 0.5) * spread, y: cy + (r2() - 0.5) * spread * 0.45, rx: r, ry: r * flat });
    }
    mass(p, bl, { ramp: deep, seed, bump: 0.13, tex: 0.12, vgrad: 0.4, light: 0.12, shadow: 0.2, band: 0.5, outline: col('#3e4c78') });
  };
  bank(10, 2, 9, 36, 201);
  bank(312, 0, 9, 40, 203);
  bank(288, -5, 5, 24, 204);
  bank(2, 70, 7, 22, 205);
  bank(325, 50, 7, 22, 206);
  bank(322, 110, 8, 24, 207);
  bank(4, 142, 9, 34, 208);
  bank(322, 147, 8, 32, 209);
  bank(30, 152, 6, 26, 210);
  return p;
}

/** Darkened edges: an elliptical vignette in ordered-dither steps of a deep blue-black. */
function vignette(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h * 0.5) / (h / 2);
      const r = Math.sqrt(nx * nx * 0.8 + ny * ny * 0.9);
      let a = Math.min(1, Math.max(0, (r - 0.55) / 0.6));
      a = a * a * (3 - 2 * a) * 0.6;
      const q = Math.floor(a * 10 + bay(x, y)) / 10;
      const i = (y * w + x) * 4;
      d[i] = 4;
      d[i + 1] = 6;
      d[i + 2] = 20;
      d[i + 3] = Math.round(q * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function buildWorldArt(add: Add, w: number, h: number): void {
  const L = paintWorld();
  const map = L.base.canvas();
  if (w === WORLD_W && h === WORLD_H) add('world_map', map);
  else {
    // other sizes: centre the painted map on open sea
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#163262';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(map, Math.floor((w - WORLD_W) / 2), Math.floor((h - WORLD_H) / 2));
    add('world_map', c);
  }
  L.waves.forEach((c, i) => add(`wm_wave${i}`, c));
  L.surf.forEach((c, i) => add(`wm_surf${i}`, c));
  L.wind.forEach((c, i) => add(`wm_wind${i}`, c));
  add('wm_isle', L.isle.canvas());
  add('wm_lava', L.lava.canvas());
  add('wm_lamp', L.lamp.canvas());
  add('wm_frame', paintFrame().canvas());
  add('wm_vignette', vignette(WORLD_W, WORLD_H));

  CLOUD_SHAPES.forEach((bl, i) => {
    const floor = Math.max(...bl.map((b) => b.y)) + 1.5;
    const m = massSprite(bl, { ramp: CLOUD, seed: 201 + i, bump: 0.12, tex: 0.12, vgrad: 0.35, light: 0.16, shadow: 0.18, band: 0.5, floor });
    add(`wm_cloud${i}`, m.img);
    add(`wm_cloudsh${i}`, m.sil);
  });
  SHADOW_SHAPES.forEach((bl, i) => add(`wm_shadow${i}`, massSprite(bl, { ramp: CLOUD, seed: 221 + i, bump: 0.18, tex: 0 }).sil));
  const smoke = ramp('#3a3442', '#5a5466', '#7e788a', '#a8a2b2', '#cac6d2');
  PUFF_SHAPES.forEach((bl, i) => add(`wm_puff${i}`, massSprite(bl, { ramp: smoke, seed: 231 + i, bump: 0.2, tex: 0.1, vgrad: 0.4, light: 0.1, outline: col('#2a2432'), shadow: 0.2 }).img));
  const mist = ramp('#a8bab8', '#c8d8d4', '#e2ece8');
  FOG_SHAPES.forEach((bl, i) => add(`wm_fog${i}`, massSprite(bl, { ramp: mist, seed: 241 + i, bump: 0.1, tex: 0.1, vgrad: 0.6, light: 0.1, shadow: 0 }).img));

  HERO_FRAMES.forEach((r, i) => add(`wm_hero${i}`, sprite(r, HERO_PAL)));
  PIP_FRAMES.forEach((r, i) => add(`wm_pip${i}`, sprite(r, PIP_PAL)));
  SHIP_FRAMES.forEach((r, i) => add(`wm_ship${i}`, sprite(r, SHIP_PAL)));
  BIRD_FRAMES.forEach((r, i) => add(`wm_bird${i}`, sprite(r, BIRD_PAL)));
  BOAT_FRAMES.forEach((r, i) => add(`wm_boat${i}`, sprite(r, BOAT_PAL)));
  CART_FRAMES.forEach((r, i) => add(`wm_cart${i}`, sprite(r, CART_PAL)));
  add('wm_mill0', millSails(false));
  add('wm_mill1', millSails(true));

  const lock = grid(11, 13);
  stamp(lock, PADLOCK, PADLOCK_PAL, 1, 1);
  add('padlock', toCanvas(lock));
  FLAG_FRAMES_ROWS.forEach((r, i) => {
    add(`flag_on${i}`, sprite(r, FLAG_ON));
    add(`flag_off${i}`, sprite(r, FLAG_OFF));
  });
}
