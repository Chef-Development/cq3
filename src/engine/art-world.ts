// The kingdom's world map (see docs/art-style.md): an illustrated island kingdom seen from above at a slight
// angle, painted into a pixel buffer at boot with the backdrop toolkit. The land is a plate whose southern
// edges show a cliff face; the sea gets lighter in the shallows and carries little wave marks; clouds soften
// the corners. Greenmarch (playable) is bright and saturated; the locked regions are desaturated and hazed so
// it pops. Landmarks are small hand-placed sprites with an ink outline so they read at 1x (8x on the phone).
//
// Layout (327x150): the left/right ~24 px sit behind the Dynamic Island and the rounded corners; the top-left
// (HUD panel), the top-right, the top centre (DOM buttons) and the bottom strip (y >= 128) stay calm. The
// anchors below are also placed so the scene's name plates (view/world.ts: padlock at the anchor, plate under
// it; Greenmarch's plate above it; "Great Pendulum" under the capital) never overlap each other.
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

/** Regions: the anchor is where the scene draws the label, padlock or glow and the tap target. */
export const WORLD_REGIONS: Array<{ id: string; name: string; x: number; y: number; locked: boolean }> = [
  { id: 'greenmarch', name: 'Greenmarch', x: 72, y: 104, locked: false },
  { id: 'frostpeaks', name: 'Frostpeaks', x: 210, y: 40, locked: true },
  { id: 'ashfell', name: 'Ashfell', x: 254, y: 66, locked: true },
  { id: 'duskmire', name: 'Duskmire', x: 198, y: 102, locked: true },
  { id: 'noonspire', name: 'Noonspire', x: 290, y: 90, locked: true },
];
/** The capital's gate, right under the Great Pendulum clock tower (the tower rises from y 60 to 30). */
export const WORLD_CAPITAL = { x: 160, y: 64 };
/** Flag spots (pole foot) for Greenmarch's three acts: the meadow, the old ruins, the Boar King's Hollow. */
export const GREENMARCH_FLAGS: Array<{ x: number; y: number }> = [
  { x: 56, y: 116 },
  { x: 125, y: 65 },
  { x: 151, y: 114 },
];

// ------------------------------------------------------------------ palette

const INK = col('#140c1c');
const SEA = ramp('#132a56', '#163262', '#1a3c70', '#1f4880', '#25558e');
const SHALLOW = ramp('#2a679c', '#317aac', '#3c90bc', '#52a8c8', '#72c2d2');
const FOAM = col('#d4eeec');
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
const HAZE = col('#a8b8d0');

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

const P = (o: Record<string, string>): Record<string, Col> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, col(v)]));

/** Darken an elliptical patch (a cast shadow on the ground). */
function shadow(p: Pix, cx: number, cy: number, rx: number, ry: number, k: number): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.tint(x, y, (c) => mix(c, col('#10101e'), k));
}

/** Additive glow, stepped with ordered dither (lamps, lava). */
function glow(p: Pix, cx: number, cy: number, r: number, c: Col, k: number): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1) continue;
      const q = (1 - d) ** 1.5;
      const s = q > 0.66 ? 1 : q > 0.33 ? 0.6 : q > bay(x, y) * 0.33 ? 0.3 : 0;
      if (s) p.tint(x, y, (o) => lighten(o, c, k * s));
    }
}

function desat(c: Col, k: number): Col {
  const l = Math.round(((c >> 16) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11) * 1.04);
  const g = Math.min(255, l);
  return mix(c, (g << 16) | (g << 8) | g, k);
}

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
const LONE_TREE = ['.lLl.', 'lLLLd', 'LLLdd', '.ddD.', '..t..'];
const LONE_PAL = P({ l: '#b4d058', L: '#78a83c', d: '#4a7e36', D: '#2e5a32', t: '#6e4020' });
const HOUSE_PAL = P({ q: '#f6684e', r: '#d23a30', R: '#8e2026', w: '#f4e6c0', W: '#c4a47a', k: '#3a2a48', d: '#6e4020' });
const HOUSE_BLUE = { ...HOUSE_PAL, ...P({ q: '#6aa0f0', r: '#3a6ad0', R: '#22408a' }) };

// the Great Pendulum: a clock tower with a slate spire, a clock face and the pendulum swinging in its belfry
const TOWER = [
  '.....G.....',
  '.....g.....',
  '....bBn....',
  '....bBn....',
  '...bbBnn...',
  '...bBBnn...',
  '..bbBBBnn..',
  '..bBBBBnn..',
  '.bbBBBBBnn.',
  'GgggggggyyY',
  '.sSSSSSSmm.',
  '.sSSgggmmm.',
  '.sSgWWWgmm.',
  '.sgWWkWWgm.',
  '.sgWWkkWgm.',
  '.sgWWWWWym.',
  '.sSgWWWymm.',
  '.sSSyyymmm.',
  '.sSSSSSSmm.',
  '.sSkkkkkmm.',
  '.sSkkgkkmm.',
  '.sSkkgkkmm.',
  '.sSkgGgkmm.',
  '.sSkGWykmm.',
  '.sSkyyYkmm.',
  '.sSSSSSSmm.',
  'GgggggggyyY',
  'sSSSSSSSmmM',
  'sSSSkkSSmmM',
  'sSSkkkkSmmM',
  'sSSkkkkSmmM',
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
  k: '#2a1c34',
});

const TURRET = ['..b..', '.bBn.', 'bbBnn', 'sSSmm', 'sSkmm', 'sSSmm', 'sSSmm'];

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

/** A puffy cloud bank (blobs) lit from the top left. */
function clouds(p: Pix, blobs: Blob[], seed: number): void {
  mass(p, blobs, { ramp: CLOUD, seed, bump: 0.12, tex: 0.12, vgrad: 0.35, light: 0.16, shadow: 0.18, band: 0.5 });
}

// ------------------------------------------------------------------ the map

function paintWorld(): Pix {
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

  // ---- the sea: distance to the shore (chamfer), shallows, foam, a vignette and little wave marks
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
  // wave marks on open water, on a jittered grid
  for (let gy = 2; gy < H; gy += 7)
    for (let gx = (gy * 5) % 11; gx < W; gx += 11) {
      const x = Math.round(gx + (hash(gx, gy, 31) - 0.5) * 6);
      const y = Math.round(gy + (hash(gx, gy, 32) - 0.5) * 3);
      if (x < 1 || x > W - 4 || y < 1 || y >= H || hash(gx, gy, 33) < 0.25) continue;
      if (dist[y * W + x] < 5 || dist[y * W + Math.min(W - 1, x + 3)] < 5) continue;
      const light = (c: Col) => mix(c, col('#8cc4e8'), 0.38);
      p.tint(x, y, light);
      p.tint(x + 1, y - 1, light);
      p.tint(x + 2, y - 1, light);
      p.tint(x + 3, y, light);
      p.tint(x + 1, y, (c) => mix(c, SEA[0], 0.4));
      p.tint(x + 2, y, (c) => mix(c, SEA[0], 0.4));
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
      if (r === 'greenmarch') c = pick(GRASS, 0.56 + lit * 0.5 + big * 0.35, x, y, 0.35);
      else if (r === 'frostpeaks') c = pick(TUNDRA, 0.55 + lit * 0.5 + big * 0.4 + (noise(x * 0.2, y * 0.3, 41) > 0.6 ? 0.3 : 0), x, y, 0.3);
      else if (r === 'ashfell') {
        c = pick(ASH, 0.5 + lit * 0.5 + big * 0.3, x, y, 0.3);
        // a few glowing fissures, more of them near the volcano
        const near = Math.max(0, 1 - Math.hypot(x - 250, (y - 70) * 1.5) / 40);
        const crack = Math.abs(noise(x * 0.16, y * 0.24, 43) - 0.5);
        if (crack < 0.012 + near * 0.014) c = col('#d8481e');
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

  // ---- the river (and its banks)
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
      p.set(x, y, u < 0.9 ? col('#8ad0e8') : (x + y) % 5 === 0 ? col('#6ab8e0') : col('#3a86c4'));
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

    // Ashfell: a black volcano with a glowing crater, lava runs down its lit face, a smoke plume drifting east
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
      }
    // the crater: a dark mouth with a molten rim
    for (let x = vx - 3; x <= vx + 3; x++) {
      p.set(x, vTop, x < vx + 2 ? LAVA[3] : LAVA[2]);
      p.set(x, vTop + 1, Math.abs(x - vx) < 3 ? LAVA[2] : LAVA[1]);
      if (Math.abs(x - vx) < 2) p.set(x, vTop + 2, LAVA[1]);
    }
    glow(p, vx + 0.5, vTop + 1, 9, col('#ff7a2a'), 0.28);
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
        p.set(xx, y, k < len * 0.6 ? LAVA[3] : LAVA[2]);
        p.set(xx + 1, y, k < len * 0.75 ? LAVA[2] : LAVA[1]);
        if (k > len * 0.4) p.set(xx - 1, y, LAVA[0]);
      }
    }
    // smoke drifting east from the crater (kept below the calm top-right corner)
    const smoke = ramp('#2e2632', '#4a4050', '#6a6272', '#8e8696');
    mass(
      p,
      [
        { x: vx + 1, y: 37, rx: 2.4, ry: 2 },
        { x: vx + 5, y: 35, rx: 3.2, ry: 2.6 },
        { x: vx + 10.5, y: 34.5, rx: 3.6, ry: 2.9 },
        { x: vx + 16.5, y: 35, rx: 3.4, ry: 2.7 },
        { x: vx + 22, y: 36, rx: 2.8, ry: 2.2 },
        { x: vx + 26.5, y: 37, rx: 2, ry: 1.6 },
      ],
      { ramp: smoke, seed: 95, bump: 0.22, tex: 0.12, vgrad: 0.35, light: 0.12, outline: col('#1e1822'), shadow: 0.25 },
    );
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

    // Duskmire: reeds, dead trees and drifting mist over the fens; the Mirelight beacon
    // reeds in clumps along the pools' banks
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
    for (const [x0, y0, len] of [
      [182, 94, 16],
      [204, 112, 14],
      [228, 96, 12],
    ] as const)
      for (let k = 0; k < len; k++) {
        const x = x0 + k;
        const y = y0 + Math.round(Math.sin(k * 0.5) * 0.6);
        if ((x + y) % 2 === 0) p.tint(x, y, (c) => mix(c, col('#c8d8d4'), 0.5));
      }
    const bx = 218;
    const by = 90;
    shadow(p, bx + 4, by + 17, 5, 1.5, 0.35);
    spr(p, BEACON, BEACON_PAL, bx, by);
    glow(p, bx + 3.5, by + 4, 8, col('#ffd860'), 0.32);

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
  const hazeAt = (i: number, x: number, y: number) => {
    const k = lockPix[i] ? 1 : plate(i) ? blur[i] : 0;
    if (k <= 0 || k < bay(x, y)) return;
    const hot = LAVA.includes(p.buf[i]);
    p.buf[i] = hot ? mix(p.buf[i], HAZE, 0.1) : mix(desat(p.buf[i], 0.45), HAZE, 0.16);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hazeAt(y * W + x, x, y);

  // ---- Noonspire: a floating island over the eastern sea, crowned by the white sun-spire (locked: hazed)
  {
    const before = p.buf.slice();
    const ix = 291;
    const iy = 72;
    shadow(p, ix + 2, 100, 9, 2.2, 0.3);
    // a waterfall spilling off the island, fading into spray
    for (let y = iy + 2; y < iy + 24; y++) {
      const f = (y - iy - 2) / 22;
      for (const dx of [0, 1]) if (f < 0.6 || bay(ix - 9 + dx, y) > f) p.set(ix - 9 + dx, y, dx ? col('#9ad0f0') : col('#e8f8ff'));
    }
    const isleRock = ramp('#241a30', '#382a48', '#504064', '#6e5c84', '#8c7aa2');
    for (let y = iy + 1; y <= iy + 20; y++) {
      const t = (y - iy - 1) / 19;
      const half = 11 * Math.pow(1 - t, 1.2) + (noise(y * 0.5, 1, 111) - 0.5) * 2;
      for (let x = Math.round(ix - half); x <= Math.round(ix + half * 0.9); x++) {
        const u = (x - (ix - half)) / Math.max(1, half * 1.9);
        let v = 0.75 - u * 0.6 - t * 0.2;
        if ((y + Math.floor(noise(x * 0.4, 1, 113) * 3)) % 4 === 0) v -= 0.25; // strata
        p.set(x, y, pick(isleRock, v, x, y, 0.2));
      }
    }
    for (let y = iy - 3; y <= iy + 2; y++)
      for (let x = ix - 12; x <= ix + 12; x++) {
        const d = ((x + 0.5 - ix) / 11.5) ** 2 + ((y + 0.5 - iy) / 3.4) ** 2;
        if (d > 1) continue;
        p.set(x, y, y >= iy + 2 ? GRASS[2] : pick(GRASS, 0.85 - ((x - ix + 11) / 23) * 0.4 - (y - iy + 3) * 0.05, x, y, 0.3));
      }
    // the spire: tapering white stone with gold bands, a gold sun disc and rays on top
    for (let y = 46; y <= iy; y++) {
      const half = y < 52 ? 0 : y < 62 ? 1 : 1.5;
      for (let x = Math.round(ix - half); x <= Math.round(ix + half); x++) p.set(x, y, x < ix ? col('#ffffff') : x === ix ? col('#d8e0ee') : col('#9aa6c4'));
      if (y === 56 || y === 64) for (let x = ix - 1; x <= ix + 1; x++) p.set(x, y, x <= ix ? col('#f2c230') : col('#b07a18'));
    }
    for (let y = 46; y <= iy; y++) {
      const half = y < 52 ? 0 : y < 62 ? 1 : 1.5;
      p.set(Math.round(ix - half) - 1, y, INK);
      p.set(Math.round(ix + half) + 1, y, INK);
    }
    spr(p, ['.gGg.', 'gGWGy', 'GWGgy', 'gGgyY', '.yyY.'], P({ W: '#ffffff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14' }), ix - 2, 40);
    for (const [dx, dy] of [
      [0, -3],
      [-4, 0],
      [4, 0],
      [-3, -3],
      [3, -3],
    ]) {
      p.set(ix + dx, 42 + dy, col('#ffe680'));
    }
    // a little white shrine at its foot
    spr(p, ['.sSm.', 'sSSmm', 'sk.km'], P({ s: '#ffffff', S: '#d8e0ee', m: '#9aa6c4', k: '#3a3050' }), ix + 3, iy - 4);
    for (let i = 0; i < N; i++) if (p.buf[i] !== before[i]) p.buf[i] = mix(desat(p.buf[i], 0.45), HAZE, 0.16);
  }

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
  road(
    [
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
    ],
    true,
  );
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
    [92, 104],
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

  // the village at the start of the Meadow Road
  for (const [x, y, blue] of [
    [38, 100, false],
    [45, 98, true],
    [42, 104, false],
  ] as const) {
    shadow(p, x + 4, y + 4, 3, 1, 0.35);
    spr(p, HOUSE, blue ? HOUSE_BLUE : HOUSE_PAL, x, y);
  }

  // the old stone ruins (Act 2), at the forest's eastern edge
  shadow(p, 113, 63, 9, 1.6, 0.35);
  spr(p, RUINS, STONE_PAL, 104, 52);
  for (const [x, y] of [
    [101, 62],
    [121, 63],
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
    shadow(p, cx + 6, 60, 5, 1.2, 0.3);
    spr(p, TOWER, TOWER_PAL, cx - 5, 30);
    glow(p, cx, 43.5, 6, col('#fff0c0'), 0.12);
  }

  // ---- clouds round the edges (calm corners for the HUD)
  const bank = (cx: number, cy: number, n: number, spread: number, seed: number, flat = 0.75) => {
    const r2 = rng(seed);
    const bl: Blob[] = [];
    for (let i = 0; i < n; i++) {
      const r = 3.5 + r2() * 4.5;
      bl.push({ x: cx + (r2() - 0.5) * spread, y: cy + (r2() - 0.5) * spread * 0.45, rx: r, ry: r * flat });
    }
    clouds(p, bl, seed);
  };
  bank(14, 4, 9, 40, 201);
  bank(40, -2, 6, 30, 202);
  bank(312, 2, 9, 40, 203);
  bank(286, -3, 5, 26, 204);
  bank(4, 70, 8, 26, 205);
  bank(322, 52, 7, 24, 206);
  bank(320, 112, 8, 26, 207);
  bank(6, 140, 8, 30, 208);
  bank(320, 146, 7, 30, 209);
  bank(271, 90, 3, 8, 210, 0.6);
  bank(304, 84, 3, 8, 211, 0.6);
  return p;
}

// ------------------------------------------------------------------ padlock and flags (sprites)

const PADLOCK = [
  '....SSSSs....',
  '...SS...sm...',
  '..Ss.....mM..',
  '..Ss.....mM..',
  '..Ss.....mM..',
  '..Ss.....mM..',
  '.GGGGgggggyy.',
  'gGWWgggggggyY',
  'gGgggkkkggyyY',
  'gGgggkkkgyyyY',
  'ggggggkgyyyyY',
  'ggggggkgyyyyY',
  'yggggggyyyyYY',
  'yyyyyyyyyyYYz',
  '.YYYYYYYYYYz.',
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

// a planted banner: the cloth hangs from a crossbar, centred on the pole, so the texture's bottom centre (the
// scene's origin) is the pole's foot; a gold chevron is stitched on it
const FLAG = ['...G...', '.hhhhh.', '.ccccd.', '.eccce.', '.ceced.', '.ccEcd.', '.cd.cd.', '...h...', '...h...', '...h...', '...H...'];
const FLAG_ON: Pal = { G: '#fff0a0', h: '#b07a44', H: '#6e4020', c: '#e03a30', d: '#9a1e24', e: '#f2c230', E: '#fff0a0' };
const FLAG_OFF: Pal = { G: '#d8dce6', h: '#9a8a7a', H: '#5e5248', c: '#e8ecf4', d: '#a8b0c4', e: '#b8c0d0', E: '#d0d6e2' };

function flag(pal: Pal): HTMLCanvasElement {
  const g = grid(9, 13);
  stamp(g, FLAG, pal, 1, 1);
  return toCanvas(g);
}

export function buildWorldArt(add: Add, w: number, h: number): void {
  const map = paintWorld().canvas();
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
  const lock = grid(15, 17);
  stamp(lock, PADLOCK, PADLOCK_PAL, 1, 1);
  add('padlock', toCanvas(lock));
  add('flag_on', flag(FLAG_ON));
  add('flag_off', flag(FLAG_OFF));
}
