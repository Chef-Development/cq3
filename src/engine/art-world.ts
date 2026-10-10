// The kingdom's world map (see docs/art-style.md): an illustrated continent about three screens wide and two tall
// (the view pans over it), seen from above at a slight angle, painted into pixel buffers once at boot. The land is a
// plate whose southern edges show a cliff face (beaches where it's low); the sea gets lighter in the shallows, with
// reefs and islets. Greenmarch (south-west, playable) has its three acts as landmarks along a winding road: the
// Meadow Road (a village, fields and the Bandit Captain's camp), the Old Ruins (broken towers and the Golem's hall)
// and the Boar King's Hollow (a dark autumn wood round a great hollow tree), with a harbour, a lighthouse, a forest
// with a lake under a waterfall, orchards and standing stones. The capital, a walled town round the Great Pendulum,
// sits in the heartland on the Silverrun. The locked lands are painted as richly (the Frostpeaks' snowy range,
// frozen lake and mountain keep; Ashfell's volcano, lava rivers and basalt; Duskmire's fens, stilt huts and the
// Mirelight; Noonspire, a floating island with a sun temple) and veiled by a soft, drifting fog of war.
//
// Far things are hazier (the north fades toward the sky's colour) and the light is warm from the top left.
// Structures and trees live in art-world-sites.ts. The Frostpeaks' three acts stand on its mountains (the pass by
// the frozen falls, the cave above the frozen lake, the keep), with their markers in art-world-lands.ts; past the
// continent's east coast a strip of far sea (painted on its own, FAR_SEA_W) holds the far lands still to come.
//
// The map is alive, so it is painted in layers the view (view/world.ts) moves and cycles: the static base
// (`world_map`), wave marks and river ripples and surf lapping the coasts (`wm_sea0..5`), a gust
// over Greenmarch's meadows (`wm_wind0..7`), the volcano's and the Mirelight's glows (pulsing overlays), Noonspire's
// island (`wm_isle`, it bobs) and its mist, the veils over the locked lands (`wm_veil_<id>`, with alpha), the cloud
// band along the far north (`wm_rim`) and small sprites. Everything else that moves the view draws as a handful of
// rects a frame. The whole lot is painted once; later layouts reuse the canvases.
import { grid, stamp, toCanvas, type Pal } from './art';
import { paintLands, WORLD_ACTS_ASH, WORLD_ACTS_DUSK, WORLD_ACTS_NOON } from './art-world-lands';
import { NOON_ON } from '../data/flags';
import { ATLAS_INK, atlasPrint, blankOf, compassRose, draftOf, neatline, PARCH, paperAt } from './art-world-atlas';
import { bay, col, fbm, hash, level, lighten, mass, mix, noise, pick, Pix, ramp, rgba32, rng, tuft, wordCanvas, type Blob, type Col, type Ramp } from './backdrop';
import {
  banditCamp,
  BEACON,
  BEACON_PAL,
  campsite,
  capital,
  claimBox,
  fields,
  forest,
  free,
  hollowTree,
  house,
  INK,
  keep,
  LEAF,
  LIGHTHOUSE,
  LIGHTHOUSE_PAL,
  oldRuins,
  orchard,
  mountain,
  P,
  paddock,
  PENDULUM_AT,
  pier,
  R_ASH,
  R_DUSK,
  R_FROST,
  R_GREEN,
  R_HEART,
  shade,
  spr,
  standingStones,
  stiltHut,
  tree,
  trees,
  village,
  windmill,
  type Pt,
  type WCtx,
} from './art-world-sites';

type Add = (key: string, c: HTMLCanvasElement) => void;
type Box = { x: number; y: number; w: number; h: number };

/** The world's size (game px): about three screens wide and two tall. */
export const WORLD_W = 960;
export const WORLD_H = 300;
/** Past the continent's east coast the sea runs on into fog for this many px more (the far lands lie out there:
 *  art-world-lands.ts). It is painted on its own (`wm_farsea`, its wave marks `wm_farwave0..5`), so the continent's
 *  picture is untouched; the camera pans over MAP_W x WORLD_H. */
export const FAR_SEA_W = 160;
export const MAP_W = WORLD_W + FAR_SEA_W;

/** Regions: the anchor is where the locked ones show their small padlock (and where the name card points). */
export const WORLD_REGIONS: Array<{ id: string; name: string; x: number; y: number; locked: boolean }> = [
  { id: 'greenmarch', name: 'Greenmarch', x: 200, y: 222, locked: false },
  { id: 'frostpeaks', name: 'Frostpeaks', x: 566, y: 86, locked: true },
  { id: 'ashfell', name: 'Ashfell', x: 812, y: 142, locked: true },
  { id: 'duskmire', name: 'Duskmire', x: 708, y: 262, locked: true },
  { id: 'noonspire', name: 'Noonspire', x: 918, y: 156, locked: true },
];

/**
 * Every playable act as a landmark, by global act index (data/regions.ts): Greenmarch's three (the Bandit Captain's
 * camp, the Old Ruins, the Boar King's Hollow), then the Frostpeaks' three (the pass by the frozen falls, the cave
 * mouth above the frozen lake, the mountain keep), then the third region's three round the volcano (WORLD_ACTS_ASH in
 * art-world-lands.ts: the half-paved road, the glowing cave mouth, the black forge on the rim), then the fourth
 * region's three in its marsh (WORLD_ACTS_DUSK, beside them). Each: the landmark's
 * centre and its tap box, where Rowan stands while it's the act he's on, where its flag flies, and the view centre the
 * map opens on while it's the current act.
 */
export const WORLD_ACTS: Array<{ x: number; y: number; box: Box; stand: Pt; flag: Pt; view: Pt }> = [
  { x: 216, y: 247, box: { x: 198, y: 233, w: 38, h: 28 }, stand: [150, 245], flag: [229, 236], view: [163, 222] },
  { x: 262, y: 166, box: { x: 234, y: 146, w: 58, h: 40 }, stand: [233, 204], flag: [279, 156], view: [248, 205] },
  { x: 352, y: 226, box: { x: 326, y: 200, w: 54, h: 50 }, stand: [320, 225], flag: [374, 196], view: [302, 212] },
  { x: 464, y: 70, box: { x: 440, y: 52, w: 50, h: 36 }, stand: [434, 80], flag: [486, 62], view: [462, 82] },
  { x: 656, y: 82, box: { x: 630, y: 56, w: 54, h: 50 }, stand: [624, 94], flag: [688, 88], view: [648, 88] },
  { x: 566, y: 60, box: { x: 546, y: 38, w: 42, h: 44 }, stand: [538, 94], flag: [592, 50], view: [560, 84] },
  ...WORLD_ACTS_ASH,
  ...WORLD_ACTS_DUSK,
  ...(NOON_ON ? WORLD_ACTS_NOON : []),
];

/** The capital's gate, right under the Great Pendulum's tower; and the walled town's tap box. */
export const WORLD_CAPITAL = { x: 522, y: 164, box: { x: 484, y: 112, w: 78, h: 58 } };
/** Noonspire's floating island (its tap box, at rest). */
export const NOON_BOX: Box = { x: 896, y: 58, w: 46, h: 90 };

/** Frame counts of the cycled textures. */
export const SEA_FRAMES = 6;
export const FLAG_FRAMES = 3;
export const WIND_FRAMES = 6;
export const CLOUD_KINDS = 4;
export const SHADOW_KINDS = 2;
export const WALKER_KINDS = 4;

/** Where the cropped overlay layers sit (their textures' top-left and size). */
export const WORLD_BOXES = {
  wind: { x: 18, y: 84, w: 400, h: 200 },
  lava: { x: 728, y: 18, w: 160, h: 170 },
  lamp: { x: 694, y: 216, w: 29, h: 29 },
  isle: { x: 884, y: 30, w: 70, h: 128 },
};

/** The veils over the locked lands: each one's box (its texture covers it). */
export const VEIL_BOXES: Record<string, Box> = {
  frostpeaks: { x: 226, y: 0, w: 548, h: 132 },
  ashfell: { x: 700, y: 0, w: 200, h: 228 },
  duskmire: { x: 516, y: 178, w: 344, h: 122 },
};

/** His drafts of each land (the ink drawing shown until its region is restored, `wm_draft_<id>`): each one's box
 *  (set when painted). Greenmarch's includes the heartland round the capital. */
export const DRAFT_BOXES: Record<string, Box> = {};
const DRAFT_REG: Record<string, number> = { greenmarch: R_GREEN, frostpeaks: R_FROST, ashfell: R_ASH, duskmire: R_DUSK };

/** Where the view animates things (world px). */
export const WORLD_SPOTS = {
  mills: [
    [184, 232],
    [584, 158],
  ] as Pt[], // windmills' sail hubs
  crater: { x: 812, y: 31 }, // the volcano's mouth
  beacon: { x: 708, y: 230 }, // the Mirelight's lamp
  pendulum: { x: 0, y: 0 }, // the pendulum's pivot in the clock tower's belfry (set when painted)
  turrets: [] as Pt[], // tops of the capital's turrets (pennants)
  fog: [
    [600, 262],
    [660, 284],
    [720, 252],
    [780, 276],
    [640, 236],
  ] as Pt[], // Duskmire's mist banks (centres)
  wisps: [
    [598, 266],
    [650, 246],
    [742, 270],
    [690, 284],
    [770, 244],
  ] as Pt[], // will-o'-wisps wander round these
  lighthouse: { x: 16, y: 183 }, // the lighthouse's lamp
  sheep: { x: 250, y: 232, w: 18, h: 12 }, // a paddock between the camp and the Hollow
  sheep2: { x: 548, y: 182, w: 16, h: 10 }, // a paddock by the capital's farms
  falls: { x: 171, y0: 117, y1: 125 }, // the forest waterfall (2 px wide)
  isleFalls: { x: 903, y0: 104, y1: 126 }, // Noonspire's waterfall
  sun: { x: 918, y: 52 }, // the sun disc on Noonspire's spire
  isle: { x: 884, y: 30 }, // Noonspire's island layer: top-left at rest
  fires: [] as Pt[], // campfires and torches (flicker, smoke)
  glows: [] as Pt[], // rune glows at the Old Ruins
  eyes: [] as Pt[], // the eyes in the Boar King's den
  steam: [
    [878, 152],
    [884, 128],
  ] as Pt[], // where Ashfell's lava meets the sea
  keep: { x: 566, y: 64 },
  capitalSmoke: [
    [506, 132],
    [538, 136],
    [518, 152],
  ] as Pt[],
};

/** Filled when the map is painted: the open sea (glints, life), deep water (whales), lit windows, chimneys, boats. */
export const WORLD_LIFE = {
  /** 1 where the sea is open water (at least 6 px from any shore), per world pixel. */
  open: new Uint8Array(0),
  deep: [] as Pt[],
  windows: [] as Pt[],
  chimneys: [] as Pt[],
  boats: [] as Pt[], // fishing boats moored at piers (feet)
  birds: [] as Pt[], // forests the crows circle over
};

/** The roads travellers walk (a point per pixel, in order): the Meadow Road on to the capital, and a few others. */
export const WORLD_ROADS: Pt[][] = [];
/** The Meadow Road from the harbour to the Bandit Captain's camp (the wandering foe paces it). */
export const MEADOW_ROAD: Pt[] = [];

/** Ships' routes over the open sea (closed loops, world px). */
export const SEA_LANES: Pt[][] = [
  [
    [30, 30],
    [120, 14],
    [235, 40],
    [190, 76],
    [60, 70],
  ],
  [
    [8, 291],
    [140, 294],
    [300, 294],
    [520, 296],
    [380, 292],
    [180, 291],
  ],
  [
    [930, 180],
    [944, 250],
    [906, 292],
    [840, 296],
    [900, 260],
  ],
];

const REGION_IDS = ['', 'greenmarch', 'heartland', 'frostpeaks', 'ashfell', 'duskmire'];
let MASK: Uint8Array | null = null;

/** The region whose land (or cliff) is under a world point ('heartland' round the capital), or null over the sea. */
export function worldRegionAt(x: number, y: number): string | null {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (!MASK || xi < 0 || yi < 0 || xi >= WORLD_W || yi >= WORLD_H) return null;
  return REGION_IDS[MASK[yi * WORLD_W + xi]] || null;
}

// ------------------------------------------------------------------ palette

const SEA = ramp('#10264e', '#13305c', '#173a68', '#1c4676', '#235486', '#2a6092');
const SHALLOW = ramp('#2a6a9e', '#3180ae', '#3c96be', '#52aeca', '#74c6d4', '#a0dcdc');
const FOAM = col('#d8f0ec');
const GRASS = ramp('#24482e', '#2e5a32', '#3e7034', '#4f8a38', '#68a440', '#88bc48', '#a8d058', '#c8e070');
const MEADOW = ramp('#3a5428', '#4c6a2c', '#628434', '#7c9e3c', '#98b846', '#b6cc58', '#d0de74');
const SAND = ramp('#b09060', '#d4bc84', '#ecdcaa', '#f8ecc4');
const ROAD = ramp('#7a5034', '#a87a4c', '#d0a870', '#e8c890');
const TUNDRA = ramp('#4e5c70', '#66788c', '#8698aa', '#a8b8c8', '#cad6e2', '#e6eef6');
const ASH = ramp('#2e2428', '#3e3236', '#52423e', '#665248', '#7c6656', '#94806a');
const BASALT = ramp('#140c10', '#22161a', '#341e22', '#4a2a2a', '#62362e');
const LAVA = ramp('#a8281a', '#e8501e', '#ff9a2a', '#ffe070');
const VOLCANO = ramp('#0e080c', '#1a1014', '#2a1a1c', '#3e2624', '#54342e', '#6e4638', '#8c5c46');
const MARSH = ramp('#1a2a24', '#22362c', '#2e4636', '#3c5640', '#4e684a', '#647c54');
const POOL = ramp('#0e1a24', '#172a36', '#2a4a58', '#5a8494');
const REED = ramp('#4a4a2a', '#7a7a3e', '#a8a054', '#cfc478');
const RIVER = ramp('#2a6aa8', '#3a86c4', '#5aa6d8', '#8ad0e8');
const LAKE = ramp('#1e548e', '#2a6aa4', '#3a84bc', '#5aa2d0', '#8ac6e2');
const ICE = ramp('#7aa0c8', '#a4c4e2', '#cce2f4', '#eef8ff');
const CLOUD = ramp('#93a8cc', '#b8cae4', '#dce8f6', '#ffffff');
const SKY_HAZE = col('#b4c4e6');
const SUN = col('#fff0c0');
const FISSURE = col('#d8481e');

// ------------------------------------------------------------------ the land's shape and its regions

/** Overlapping lobes that make up the continent (cx, cy, rx, ry). */
const LOBES: Array<[number, number, number, number]> = [
  [212, 205, 192, 76], // Greenmarch's meadows
  [112, 150, 92, 64], // its north-west forest
  [300, 140, 112, 62], // the hills of the ruins and the stones
  [500, 160, 145, 98], // the heartland round the capital
  [470, 248, 92, 40], // the heartland's south coast
  [510, 26, 262, 86], // the Frostpeaks
  [806, 96, 80, 92], // Ashfell
  [760, 66, 62, 60],
  [690, 246, 162, 50], // Duskmire
  [800, 192, 62, 42],
  [698, 150, 64, 58], // the land between the heartland, Ashfell and Duskmire
];
/** Bites the sea takes out of it (cx, cy, rx, ry). */
const BAYS: Array<[number, number, number, number]> = [
  [44, 214, 27, 13], // the harbour
  [262, 286, 22, 13], // the fishing cove
  [432, 294, 18, 11], // the Silverrun's mouth
  [600, 300, 24, 9],
];
/** Islets (cx, cy, rx, ry). */
const ISLETS: Array<[number, number, number, number]> = [
  [15, 191, 5, 3.4], // the lighthouse's
  [70, 42, 7, 4],
  [146, 22, 5, 3],
  [206, 58, 6, 3.6],
  [32, 252, 4, 2.6],
  [936, 232, 6, 3.6],
  [908, 284, 5, 3],
  [356, 293, 4, 2.4],
];

const LOBE_F = Float64Array.from(LOBES.flat());
const BAY_F = Float64Array.from(BAYS.flat());
const ISLET_F = Float64Array.from(ISLETS.flat());

function landField(x: number, y: number, n: number): number {
  let f = -1;
  for (let k = 0; k < LOBE_F.length; k += 4) {
    const dx = (x - LOBE_F[k]) / LOBE_F[k + 2];
    if (dx > 1.5 || dx < -1.5) continue;
    const dy = (y - LOBE_F[k + 1]) / LOBE_F[k + 3];
    if (dy > 1.5 || dy < -1.5) continue;
    const v = 1 - Math.sqrt(dx * dx + dy * dy);
    if (v > f) f = v;
  }
  f += (n - 0.5) * 0.34;
  for (let k = 0; k < BAY_F.length; k += 4) {
    const dx = (x - BAY_F[k]) / BAY_F[k + 2];
    const dy = (y - BAY_F[k + 1]) / BAY_F[k + 3];
    const d2 = dx * dx + dy * dy;
    if (d2 < 1) f -= (1 - Math.sqrt(d2)) * 1.4;
  }
  if (y > 276) f -= (y - 276) * 0.05;
  if (x < 24) f -= (24 - x) * 0.05;
  if (x > 884) f -= (x - 884) * 0.05;
  if (y < 20 && (x < 250 || x > 760)) f -= (20 - y) * 0.03;
  for (let k = 0; k < ISLET_F.length; k += 4) {
    const dx = (x - ISLET_F[k]) / ISLET_F[k + 2];
    const dy = (y - ISLET_F[k + 1]) / ISLET_F[k + 3];
    const d2 = dx * dx + dy * dy;
    if (d2 < 2) f = Math.max(f, (1 - Math.sqrt(d2)) * 0.6 + (n - 0.5) * 0.12);
  }
  return f;
}

/** The regions' borders, wobbled by 1D noise (precomputed per row and column). */
function regionBorders(W: number, H: number) {
  const fx = new Float32Array(W);
  const ax = new Float32Array(W);
  const dx = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    fx[x] = 98 + (noise(x * 0.03, 1, 7) - 0.5) * 16 + (x > 540 && x < 760 ? 8 : 0);
    ax[x] = 206 + (noise(x * 0.05, 5, 7) - 0.5) * 14;
    dx[x] = 204 + (noise(x * 0.04, 6, 7) - 0.5) * 14;
  }
  const fl = new Float32Array(H);
  const fr = new Float32Array(H);
  const ay = new Float32Array(H);
  const dy = new Float32Array(H);
  const gy = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    fl[y] = 238 + (noise(y * 0.05, 2, 7) - 0.5) * 16;
    fr[y] = 744 + (noise(y * 0.05, 3, 7) - 0.5) * 14;
    ay[y] = 738 + (y - 100) * 0.12 + (noise(y * 0.05, 4, 7) - 0.5) * 14;
    dy[y] = 548 + (noise(y * 0.05, 7, 7) - 0.5) * 16;
    gy[y] = 412 + (noise(y * 0.04, 8, 7) - 0.5) * 18;
  }
  return (x: number, y: number): number => {
    const xi = Math.max(0, Math.min(W - 1, x | 0));
    const yi = Math.max(0, Math.min(H - 1, y | 0));
    if (y < fx[xi] && x > fl[yi] && x < fr[yi]) return R_FROST;
    if (x > ay[yi] && y < ax[xi]) return R_ASH;
    if (y > dx[xi] && x > dy[yi]) return R_DUSK;
    if (x < gy[yi]) return R_GREEN;
    return R_HEART;
  };
}

/** A curve through points (Catmull-Rom), sampled finely. */
function spline(pts: Pt[], step = 0.25): Pt[] {
  const out: Pt[] = [];
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

/** One point per pixel along a path (for travellers). */
function perPixel(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const [x, y] of spline(pts, 0.3)) {
    const q: Pt = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  return out;
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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ------------------------------------------------------------------ roads and rivers (world px)

const RD_MEADOW: Pt[] = [
  [74, 203],
  [90, 210],
  [106, 221],
  [122, 231],
  [140, 241],
  [160, 247],
  [182, 251],
  [202, 252],
];
const RD_RUINS: Pt[] = [
  [213, 241],
  [219, 226],
  [229, 209],
  [240, 195],
  [252, 184],
];
const RD_EAST: Pt[] = [
  [262, 184],
  [282, 188],
  [302, 186],
  [326, 180],
  [350, 174],
  [376, 169],
  [404, 165],
  [432, 162],
  [458, 159],
  [482, 161],
  [504, 165],
  [522, 167],
];
const RD_HOLLOW: Pt[] = [
  [304, 186],
  [309, 202],
  [316, 218],
  [326, 232],
  [338, 242],
  [348, 248],
];
const RD_KEEP: Pt[] = [
  [514, 128],
  [522, 112],
  [536, 98],
  [550, 86],
  [560, 78],
  [566, 74],
];
const RD_ASHFELL: Pt[] = [
  [556, 152],
  [590, 150],
  [630, 144],
  [672, 140],
  [712, 144],
  [744, 156],
  [758, 170],
];
const RD_DUSK: Pt[] = [
  [530, 168],
  [552, 186],
  [576, 204],
  [598, 224],
  [614, 242],
];
const RD_HAMLET: Pt[] = [
  [508, 168],
  [498, 186],
  [492, 206],
  [490, 224],
];
const RD_HARBOUR_NORTH: Pt[] = [
  [74, 203],
  [80, 186],
  [76, 168],
  [64, 150],
];
const RD_COVE: Pt[] = [
  [182, 251],
  [204, 262],
  [228, 266],
  [246, 268],
];

const RIVER_G: Pt[] = [
  [150, 136],
  [138, 150],
  [126, 164],
  [114, 178],
  [100, 190],
  [84, 200],
  [64, 209],
  [52, 212],
];
const SILVERRUN: Pt[] = [
  [474, 70],
  [471, 92],
  [466, 114],
  [469, 136],
  [463, 158],
  [456, 180],
  [450, 198],
  [444, 220],
  [437, 244],
  [433, 268],
  [432, 292],
];
/** Reefs out at sea (cx, cy, rx, ry). */
const REEFS: Array<[number, number, number, number]> = [
  [100, 40, 9, 3.5],
  [236, 20, 7, 3],
  [118, 287, 8, 3],
  [930, 192, 6, 3],
  [880, 268, 8, 3],
  [492, 294, 7, 2.5],
];
const ESCARPMENT: Pt[] = [
  [136, 116],
  [148, 112],
  [162, 114],
  [176, 116],
  [192, 112],
  [208, 116],
];
const FROZEN_LAKE: [number, number, number, number] = [656, 98, 22, 7];
const LAVA_FLOWS: Array<{ pts: Pt[]; w: number }> = [
  {
    pts: [
      [813, 32],
      [817, 50],
      [826, 70],
      [831, 88],
      [846, 106],
      [858, 118],
      [866, 132],
      [878, 142],
      [886, 152],
    ],
    w: 2.4,
  },
  {
    pts: [
      [810, 32],
      [806, 52],
      [798, 72],
      [800, 92],
      [792, 112],
      [794, 130],
      [790, 148],
    ],
    w: 2,
  },
];
const SPIRES: Array<[number, number, number]> = [
  [748, 120, 8],
  [753, 124, 5],
  [858, 98, 7],
  [866, 102, 4],
  [770, 192, 6],
  [846, 176, 9],
  [852, 180, 5],
  [744, 92, 6],
  [872, 76, 6],
  [820, 136, 4],
];
const STILT_HUTS: Pt[] = [
  [606, 244],
  [636, 244],
  [620, 252],
  [628, 262],
];
const PIERS: Array<[number, number, number]> = [
  [56, 204, 11],
  [68, 207, 8],
  [258, 271, 7],
];

/** The Frostpeaks: rows of mountains from the far north (small, high) to the foothills (back rows first). */
function mountains(reg: Uint8Array): Array<[number, number, number, number, number, number, number]> {
  const out: Array<[number, number, number, number, number, number, number]> = [];
  const rows: Array<[number, number, number, number]> = [
    [28, 22, 36, 52],
    [50, 20, 40, 58],
    [72, 14, 30, 52],
    [94, 9, 18, 40],
    [106, 6, 11, 34],
  ];
  rows.forEach(([base, lo, hi, step], r) => {
    for (let x = 246 + (r % 2) * step * 0.5; x < 760; x += step * (0.8 + hash(Math.round(x), r, 5) * 0.4)) {
      const mx = Math.round(x + (hash(Math.round(x), r, 6) - 0.5) * step * 0.4);
      const hw = lo + hash(mx, r, 7) * (hi - lo);
      const by = base + Math.round((hash(mx, r, 8) - 0.5) * 6);
      if (reg[Math.min(WORLD_H - 1, by) * WORLD_W + mx] !== R_FROST) continue;
      if (by > 46 && Math.abs(mx - 566) < hw + 14) continue; // the keep's crag stands clear
      if (by > 56 && Math.abs(mx - 473) < hw + 4) continue; // the Silverrun's glacier
      if (by > 80 && Math.abs(mx - FROZEN_LAKE[0]) < hw + FROZEN_LAKE[2]) continue;
      const height = hw * (1.05 + hash(mx, r, 9) * 0.9);
      const asym = 0.75 + hash(mx, r, 10) * 0.5;
      out.push([mx, Math.round(by - height), by, hw * asym, hw * (2 - asym), 50 + r * 31 + (mx % 29), Math.round(height * (0.32 + hash(mx, r, 11) * 0.2))]);
    }
  });
  // two great peaks over the rest
  out.push([418, -8, 64, 40, 46, 211, 26], [652, -12, 60, 44, 40, 223, 28]);
  return out.sort((a, b) => a[2] - b[2]);
}

const LAKES: Array<[number, number, number, number]> = [
  [162, 132, 19, 8], // the forest lake under the waterfall
  [452, 200, 16, 8], // the Silverrun's lake
  [282, 222, 6, 3.4], // a pond in the meadows
];

// ------------------------------------------------------------------ the painting

interface WorldLayers {
  base: HTMLCanvasElement;
  sea: HTMLCanvasElement[];
  wind: HTMLCanvasElement[];
  lava: Pix;
  lamp: Pix;
  isle: Pix;
  veils: Record<string, HTMLCanvasElement>;
  drafts: Record<string, HTMLCanvasElement>;
  isleVeil: HTMLCanvasElement;
  rim: HTMLCanvasElement;
}

/** What the painting stages share. */
interface Stage {
  W: number;
  H: number;
  N: number;
  p: Pix;
  buf: Int32Array;
  c: WCtx;
  land: Uint8Array;
  cliff: Int8Array;
  plateMask: Uint8Array;
  reg: Uint8Array;
  coastN: Float32Array;
  relief: Float32Array;
  broad: Float32Array;
  dist: Float32Array;
  pool: Uint8Array;
  riverPix: number[];
  lakePix: number[];
  fires: Pt[];
  glows: Pt[];
  eyes: Pt[];
}

/** The fields, the land's mask (with its cliffs) and the regions. */
function* stageLand(W: number, H: number): Generator<void, Omit<Stage, 'p' | 'buf' | 'c' | 'dist' | 'riverPix' | 'lakePix' | 'fires' | 'glows' | 'eyes' | 'pool'>> {
  const N = W * H;
  const regionOf = regionBorders(W, H);
  // the fields on one coarse grid: the coast's noise, the terrain's relief, broad colour variation, the regions'
  // warp, and the land's own field (its lobes warped into headlands and coves)
  const step = 3;
  const gw = Math.ceil(W / step) + 2;
  const gh = Math.ceil(H / step) + 2;
  const F = 6;
  const g = new Float32Array(gw * gh * F);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const x = i * step;
      const y = j * step;
      const k = (j * gw + i) * F;
      const cn = fbm(x * 0.05, y * 0.075, 5);
      g[k] = cn;
      g[k + 1] = fbm(x * 0.045, y * 0.07, 21);
      g[k + 2] = fbm(x * 0.018, y * 0.03, 23);
      g[k + 3] = noise(x * 0.02, y * 0.03, 27);
      g[k + 4] = noise(x * 0.02, y * 0.03, 29);
      g[k + 5] = landField(x + (noise(x * 0.02, y * 0.03, 31) - 0.5) * 26, y + (noise(x * 0.02, y * 0.03, 33) - 0.5) * 16, cn);
      if (i === gw - 1 && j % 16 === 15) yield;
    }
  const coastN = new Float32Array(N);
  const relief = new Float32Array(N);
  const broad = new Float32Array(N);
  const land = new Uint8Array(N);
  const reg = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    if (y % 60 === 59) yield;
    const v = y / step;
    const j = Math.floor(v);
    const b = v - j;
    for (let x = 0; x < W; x++) {
      const u = x / step;
      const ii = Math.floor(u);
      const a = u - ii;
      const k00 = (j * gw + ii) * F;
      const k10 = k00 + F;
      const k01 = k00 + gw * F;
      const k11 = k01 + F;
      const w00 = (1 - a) * (1 - b);
      const w10 = a * (1 - b);
      const w01 = (1 - a) * b;
      const w11 = a * b;
      const i = y * W + x;
      const cn = g[k00] * w00 + g[k10] * w10 + g[k01] * w01 + g[k11] * w11;
      coastN[i] = cn;
      relief[i] = g[k00 + 1] * w00 + g[k10 + 1] * w10 + g[k01 + 1] * w01 + g[k11 + 1] * w11;
      broad[i] = g[k00 + 2] * w00 + g[k10 + 2] * w10 + g[k01 + 2] * w01 + g[k11 + 2] * w11;
      const lf = g[k00 + 5] * w00 + g[k10 + 5] * w10 + g[k01 + 5] * w01 + g[k11 + 5] * w11;
      if (lf + (cn - 0.5) * 0.06 <= 0) continue;
      land[i] = 1;
      const wx = g[k00 + 3] * w00 + g[k10 + 3] * w10 + g[k01 + 3] * w01 + g[k11 + 3] * w11;
      const wy = g[k00 + 4] * w00 + g[k10 + 4] * w10 + g[k01 + 4] * w01 + g[k11 + 4] * w11;
      reg[i] = regionOf(x + (wx - 0.5) * 44, y + (wy - 0.5) * 28);
    }
  }
  yield;
  // the sea is what a flood from the map's edges reaches; any pocket of water the noise left inland becomes land
  {
    const sea = new Uint8Array(N);
    const q = new Int32Array(N);
    let qt = 0;
    for (let x = 0; x < W; x++) for (const i of [x, (H - 1) * W + x]) if (!land[i] && !sea[i]) (sea[i] = 1), (q[qt++] = i);
    for (let y = 0; y < H; y++) for (const i of [y * W, y * W + W - 1]) if (!land[i] && !sea[i]) (sea[i] = 1), (q[qt++] = i);
    for (let qh = 0; qh < qt; qh++) {
      const i = q[qh];
      const x = i % W;
      if (x > 0 && !land[i - 1] && !sea[i - 1]) (sea[i - 1] = 1), (q[qt++] = i - 1);
      if (x < W - 1 && !land[i + 1] && !sea[i + 1]) (sea[i + 1] = 1), (q[qt++] = i + 1);
      if (i >= W && !land[i - W] && !sea[i - W]) (sea[i - W] = 1), (q[qt++] = i - W);
      if (i < N - W && !land[i + W] && !sea[i + W]) (sea[i + W] = 1), (q[qt++] = i + W);
    }
    for (let i = 0; i < N; i++)
      if (!sea[i] && !land[i]) {
        land[i] = 1;
        const x = i % W;
        reg[i] = regionOf(x, (i - x) / W);
      }
  }
  // cliff faces under southern edges, 1-4 px tall by the relief (1: a beach in front of a low bank); they belong to
  // the land above them
  const cliff = new Int8Array(N);
  const plateMask = land.slice();
  for (let i = 0; i < N - W; i++) {
    if (!land[i] || land[i + W]) continue;
    const tall = 1 + Math.round(clamp01((relief[i] - 0.3) * 2.2) * 3);
    for (let k = 1, q = i + W; k <= tall && q < N && !land[q]; k++, q += W) {
      cliff[q] = k;
      plateMask[q] = 1;
      reg[q] = reg[i];
    }
  }
  MASK = reg;
  return { W, H, N, land, cliff, plateMask, reg, coastN, relief, broad };
}

/** The sea: distance to the shore, shallows, foam, deep water. */
function stageSea(S: Stage): void {
  const { W, H, N, buf, plateMask, coastN, broad } = S;
  // ---- the sea: distance to the shore (chamfer), shallows, foam, deep water
  const dist = (S.dist = new Float32Array(N).fill(1e9));
  for (let i = 0; i < N; i++) if (plateMask[i]) dist[i] = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let d = dist[i];
      if (x > 0 && dist[i - 1] + 1 < d) d = dist[i - 1] + 1;
      if (y > 0) {
        if (dist[i - W] + 1 < d) d = dist[i - W] + 1;
        if (x > 0 && dist[i - W - 1] + 1.41 < d) d = dist[i - W - 1] + 1.41;
        if (x < W - 1 && dist[i - W + 1] + 1.41 < d) d = dist[i - W + 1] + 1.41;
      }
      dist[i] = d;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let d = dist[i];
      if (x < W - 1 && dist[i + 1] + 1 < d) d = dist[i + 1] + 1;
      if (y < H - 1) {
        if (dist[i + W] + 1 < d) d = dist[i + W] + 1;
        if (x < W - 1 && dist[i + W + 1] + 1.41 < d) d = dist[i + W + 1] + 1.41;
        if (x > 0 && dist[i + W - 1] + 1.41 < d) d = dist[i + W - 1] + 1.41;
      }
      dist[i] = d;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (plateMask[i]) continue;
      const d = dist[i];
      if (d <= 1.2) buf[i] = hash(x, y, 2) < 0.85 ? FOAM : SHALLOW[5];
      else if (d < 11) buf[i] = pick(SHALLOW, 0.95 - (d - 1.2) / 10 + (coastN[i] - 0.5) * 0.3, x, y, 0.3);
      else {
        const vx = (x - W * 0.4) / W;
        buf[i] = pick(SEA, 0.72 - vx * vx * 0.8 + (broad[i] - 0.5) * 0.6 + (d < 20 ? (20 - d) * 0.012 : 0) + (y > H * 0.6 ? 0.06 : 0), x, y, 0.14);
      }
    }
  // a few reefs: turquoise shoals with coral showing through
  for (const [cx, cy, rx, ry] of REEFS)
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const i = y * W + x;
        if (x < 0 || y < 0 || x >= W || y >= H || plateMask[i] || dist[i] < 3) continue;
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (hash(x >> 1, y >> 1, 5) - 0.5) * 0.5;
        if (e > 1) continue;
        buf[i] = e > 0.7 ? SHALLOW[2] : e > 0.35 ? SHALLOW[3] : hash(x, y, 4) < 0.12 ? (hash(x, y, 6) < 0.5 ? col('#f08aa0') : col('#ffd27a')) : SHALLOW[4];
        dist[i] = Math.min(dist[i], 4);
      }
  WORLD_LIFE.open = new Uint8Array(N);
  WORLD_LIFE.deep = [];
  for (let i = 0; i < N; i++) if (!plateMask[i] && dist[i] >= 6) WORLD_LIFE.open[i] = 1;
  for (let y = 8; y < H - 8; y += 6) for (let x = 8; x < W - 8; x += 7) if (dist[y * W + x] >= 13) WORLD_LIFE.deep.push([x, y]);

}

/** Duskmire's dark pools. */
function stagePools(S: Stage): void {
  const { W, H, land, reg, pool } = S;
  for (let y = 200; y < H; y++)
    for (let x = 520; x < W; x++) {
      const i = y * W + x;
      if (land[i] && reg[i] === R_DUSK && noise(x * 0.1, y * 0.18, 45) > 0.6) pool[i] = 1;
    }
}

/** The land's top surface for rows y0..y1, per region (the border between two regions is dithered), beaches. */
function stageSurface(S: Stage, y0: number, y1: number): void {
  const { W, H, N, buf, c, land, cliff, plateMask, reg, relief, broad, coastN, pool } = S;
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!land[i]) continue;
      const h0 = hash(x, y, 9);
      const j = i + (h0 < 0.25 ? -3 : h0 < 0.5 ? -2 : h0 < 0.75 ? 2 : 3);
      const r = j >= 0 && j < N && plateMask[j] ? reg[j] : reg[i];
      const lit = (relief[i > W ? i - W - 1 : i] - relief[i < N - W - 1 ? i + W + 1 : i]) * 9;
      const big = broad[i] - 0.5;
      let v: Col;
      if (r === R_GREEN) v = pick(GRASS, 0.52 + lit * 0.5 + big * 0.5 + (relief[i] - 0.5) * 0.3, x, y, 0.35);
      else if (r === R_HEART) v = pick(MEADOW, 0.55 + lit * 0.5 + big * 0.45, x, y, 0.35);
      else if (r === R_FROST) v = pick(TUNDRA, 0.55 + lit * 0.5 + big * 0.4 + (y < 70 ? 0.25 : 0) + (relief[i] > 0.58 ? 0.25 : 0), x, y, 0.3);
      else if (r === R_ASH) {
        v = pick(ASH, 0.5 + lit * 0.5 + big * 0.35, x, y, 0.3);
        const dx = x - 812;
        const dy = (y - 80) * 1.4;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 70);
        const crack = Math.abs(noise(x * 0.14, y * 0.22, 43) - 0.5);
        if (crack < 0.01 + near * 0.014) (v = FISSURE), (c.hot[i] = 1);
        else if (crack < 0.022 + near * 0.02) v = mix(v, col('#7a2016'), 0.5);
      } else if (pool[i]) {
        const up = pool[i - W] === 1;
        const dn = pool[i + W] === 1;
        v = !up ? POOL[0] : !dn ? POOL[2] : hash(x, y, 46) < 0.05 ? POOL[3] : POOL[1];
        c.water[i] = 5;
        if (up && dn && hash(x, y, 47) < 0.025) v = col('#5a9a4a'); // lily pads
      } else v = pick(MARSH, 0.52 + lit * 0.5 + big * 0.35, x, y, 0.35);
      // a beach (or snow, basalt, reeds) along the shore; a dark lip over a tall cliff
      const below = y < H - 1 ? cliff[i + W] : 0;
      const lS = y < H - 1 ? land[i + W] : 0;
      const lW = x > 0 ? land[i - 1] : 0;
      const lE = x < W - 1 ? land[i + 1] : 0;
      const seaN = y > 0 && !land[i - W] && !cliff[i - W];
      const seaSide = !lW || !lE || (!lS && below === 1);
      const near = coastN[i] < 0.5 && ((y < H - 2 && !land[i + 2 * W]) || (x > 1 && !land[i - 2]) || (x < W - 2 && !land[i + 2]));
      if (!lS && below > 1) v = r === R_GREEN ? GRASS[1] : r === R_HEART ? MEADOW[1] : r === R_FROST ? TUNDRA[1] : r === R_ASH ? BASALT[2] : MARSH[0];
      else if (seaN || seaSide || near) {
        v = r === R_GREEN || r === R_HEART ? (seaN ? SAND[3] : SAND[2]) : r === R_FROST ? TUNDRA[5] : r === R_ASH ? BASALT[3] : REED[1];
        c.water[i] = 0;
      }
      if (c.hot[i] && v !== FISSURE) c.hot[i] = 0;
      buf[i] = v;
    }
}

/** Cliff faces under the southern edges. */
function stageCliffs(S: Stage): void {
  const { W, N, buf, cliff, reg } = S;
  // cliff faces: a lit lip, then strata down to the waterline (Ashfell's basalt in columns)
  const CLIFF: Record<number, Ramp> = {
    [R_GREEN]: ramp('#3a2418', '#5a3820', '#7a5030', '#9a6c40', '#b8885a'),
    [R_HEART]: ramp('#3e2a1a', '#604024', '#86603a', '#a8804e', '#c8a068'),
    [R_FROST]: ramp('#2a2e44', '#3e4460', '#5a6280', '#7c86a2', '#a8b4cc'),
    [R_ASH]: ramp('#0e080c', '#1a1016', '#28181e', '#3a2226', '#4e2e2c'),
    [R_DUSK]: ramp('#1a2216', '#283220', '#38442c', '#4c5a38', '#62704a'),
  };
  for (let i = 0; i < N; i++) {
    const k = cliff[i];
    if (!k) continue;
    const x = i % W;
    const y = (i - x) / W;
    const r = CLIFF[reg[i]] ?? CLIFF[R_GREEN];
    let tone = 4 - k;
    if (reg[i] === R_ASH) tone = x % 3 === 2 ? 0 : x % 3 === 0 ? 3 - (k > 2 ? 1 : 0) : 2 - (k > 2 ? 1 : 0);
    else if (hash(x >> 1, y, 47) > 0.7) tone -= 1;
    buf[i] = r[Math.max(0, Math.min(4, tone))];
  }

}

/** The escarpment over the forest lake. */
function stageEscarp(S: Stage): void {
  const { W, buf, c, plateMask } = S;
  // ---- the escarpment over the forest lake (the waterfall drops off it); no trees grow up against its face
  {
    const top = new Map<number, number>();
    for (const [x, y] of spline(ESCARPMENT, 0.5)) top.set(Math.round(x), Math.round(y));
    const rr = ramp('#2e2632', '#4a3e44', '#6a5a58', '#8c7a6e', '#ae9a86');
    for (const [x, y] of top) {
      const crack = hash(x >> 1, 7, 3) < 0.3;
      for (let k = 1; k <= 6; k++) {
        const i = (y + k) * W + x;
        if (!plateMask[i] || c.water[i]) break;
        let t = 4 - Math.floor((k - 1) * 0.7) - (crack && k > 1 ? 2 : 0) - (x % 4 === 0 && k > 2 ? 1 : 0);
        if (k === 6) t = 0;
        buf[i] = rr[Math.max(0, Math.min(4, t))];
      }
      buf[(y + 7) * W + x] = mix(buf[(y + 7) * W + x], col('#10241c'), 0.35);
      buf[y * W + x] = GRASS[6];
      buf[(y - 1) * W + x] = GRASS[4];
      claimBox(c, x, y - 1, 1, 15);
    }
  }

}

/** Rivers, lakes and reeds. */
function stageWater(S: Stage): void {
  const { W, H, p, buf, c, plateMask, coastN, riverPix, lakePix } = S;
  // ---- water: rivers (with banks), lakes, reeds
  const river = (pts: Pt[], w0: number, w1: number) => {
    const line = spline(pts, 0.3);
    line.forEach(([cx, cy], k) => {
      const wd = w0 + ((w1 - w0) * k) / line.length;
      for (let y = Math.floor(cy - wd / 2 - 1); y <= cy + wd / 2 + 1; y++)
        for (let x = Math.floor(cx - wd / 2 - 1); x <= cx + wd / 2 + 1; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x;
          if (!plateMask[i] || c.water[i] === 1) continue;
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= wd / 2) {
            riverPix.push(i);
            c.water[i] = 1;
          }
        }
    });
  };
  river(RIVER_G, 2.2, 3.6);
  river(SILVERRUN, 2.4, 4.6);
  for (const [cx, cy, rx, ry] of LAKES)
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const i = y * W + x;
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (noise(x * 0.3, y * 0.3, 61) - 0.5) * 0.4;
        if (e <= 1 && plateMask[i]) {
          c.water[i] = 2;
          lakePix.push(i);
        }
      }
  for (const i of [...riverPix, ...lakePix]) {
    const w = c.water[i];
    const x = i % W;
    const y = (i - x) / W;
    const dry = (j: number) => !c.water[j] && plateMask[j] === 1;
    let v: Col;
    if (dry(i - W)) v = w === 1 ? RIVER[0] : LAKE[0]; // the far bank's shadow on the water
    else if (dry(i + W)) v = w === 1 ? RIVER[3] : LAKE[4]; // the near bank's light
    else if (w === 2) v = pick(LAKE, 0.55 + (coastN[i] - 0.5) * 0.5 - (dry(i - 2 * W) ? 0.2 : 0), x, y, 0.4);
    else v = RIVER[1];
    buf[i] = v;
    for (const j of [i - 1, i + 1, i + W]) if (dry(j) && !c.taken[j]) buf[j] = mix(buf[j], col('#10241c'), 0.3);
  }
  for (const i of lakePix) {
    const x = i % W;
    const y = (i - x) / W;
    if (hash(x, y, 63) < 0.08 && !c.water[i + W] && plateMask[i + W]) tuft(p, x, y + 2, 2, REED, x * 3 + y);
  }

}

/** Roads, and bridges where they cross water. */
function stageRoads(S: Stage): void {
  const { W, N, buf, c, plateMask, reg } = S;
  // ---- roads (bridges where they cross water)
  const roadMask = c.road;
  const roadAt = (pts: Pt[], wide: boolean, keepIt = true) => {
    const line = perPixel(pts);
    for (const [x, y] of line)
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < (wide ? 2 : 1); dx++) {
          const i = (y + dy) * W + x + dx;
          if (plateMask[i]) roadMask[i] = c.water[i] === 1 || c.water[i] === 2 ? 2 : 1;
        }
    if (keepIt) WORLD_ROADS.push(line);
    return line;
  };
  WORLD_ROADS.length = 0;
  MEADOW_ROAD.length = 0;
  MEADOW_ROAD.push(...roadAt(RD_MEADOW, true));
  roadAt(RD_RUINS, true);
  roadAt(RD_EAST, true);
  roadAt(RD_HOLLOW, false);
  roadAt(RD_HARBOUR_NORTH, false, false);
  roadAt(RD_COVE, false, false);
  roadAt(RD_HAMLET, false);
  roadAt(RD_KEEP, false, false);
  roadAt(RD_ASHFELL, false, false);
  roadAt(RD_DUSK, false, false);
  const ROADS: Record<number, Ramp> = {
    [R_FROST]: ramp('#6a7486', '#98a2b4', '#c8d0dc', '#e6ecf4'),
    [R_ASH]: ramp('#3a2a28', '#5a4440', '#7a625a', '#94806a'),
    [R_DUSK]: ramp('#3a3424', '#5a5034', '#7a6e48', '#968a5a'),
  };
  for (let i = W; i < N - W; i++) {
    const r = roadMask[i];
    if (!r) continue;
    const x = i % W;
    const y = (i - x) / W;
    c.taken[i] = 1;
    if (r === 2) {
      // planks across the water, rails either side
      buf[i] = (x + y) % 2 ? col('#c08a50') : col('#a06c3a');
      if (!roadMask[i - W]) buf[i - W] = col('#6e4020');
      if (!roadMask[i + W]) buf[i + W] = col('#3a2418');
      c.water[i] = 0;
      continue;
    }
    const rr = ROADS[reg[i]] ?? ROAD;
    buf[i] = !roadMask[i + W] ? rr[0] : !roadMask[i - W] ? rr[3] : hash(x, y, 71) < 0.12 ? rr[2] : rr[1];
  }

}

/** The Frostpeaks. */
function stageFrost(S: Stage): void {
  const { W, buf, c, reg } = S;
  const T = trees();
  // the Frostpeaks: a frozen lake in the foothills, the range (back to front), the keep on its crag, a glacier, pines
  {
    const [cx, cy, rx, ry] = FROZEN_LAKE;
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
        const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (noise(x * 0.3, y * 0.4, 81) - 0.5) * 0.3;
        if (e > 1) continue;
        const i = y * W + x;
        c.water[i] = 3;
        c.taken[i] = 1;
        const crack = Math.abs(noise(x * 0.25, y * 0.5, 83) - 0.5) < 0.03;
        buf[i] = e > 0.8 ? ICE[3] : crack ? ICE[1] : pick(ICE, 0.75 - e * 0.35 - ((x - cx) / rx) * 0.15, x, y, 0.4);
      }
  }
  for (const [mx, top, base, hwL, hwR, seed, snow] of mountains(reg)) mountain(c, mx, top, base, hwL, hwR, seed, snow);
  keep(c, WORLD_SPOTS.keep.x, WORLD_SPOTS.keep.y);
  for (let y = 58; y < 74; y++)
    for (let x = 467 - Math.round((y - 58) * 0.15); x <= 479 - Math.round((y - 58) * 0.2); x++) buf[y * W + x] = pick(ICE, 0.95 - (x - 466) / 16 - (y - 58) * 0.01, x, y, 0.4);
  forest(c, 250, 50, 760, 116, 5.4, (x, y) => reg[y * W + x] === R_FROST && noise(x * 0.06, y * 0.08, 91) > 0.54, (_x, _y, r) => T.snowpine[Math.floor(r * 3)], 0.18);

}

/** Ashfell. */
function stageAsh(S: Stage): void {
  const { W, H, p, buf, c, plateMask, fires } = S;
  const T = trees();
  // Ashfell: the volcano, lava rivers to the sea and into a lava lake, basalt spires, the black citadel
  {
    const vx = WORLD_SPOTS.crater.x;
    const vTop = WORLD_SPOTS.crater.y - 1;
    const vBase = 128;
    const vxl: number[] = [];
    const vxr: number[] = [];
    for (let y = vTop; y <= vBase; y++) {
      const t = (y - vTop) / (vBase - vTop);
      vxl.push(Math.round(vx - (5 + 46 * Math.pow(t, 1.25) + (noise(y * 0.3, 1, 81) - 0.5) * 6 * t)));
      vxr.push(Math.round(vx + (5 + 52 * Math.pow(t, 1.25) + (noise(y * 0.3, 2, 81) - 0.5) * 6 * t)));
    }
    const inV = (x: number, y: number) => y >= vTop && y <= vBase && x >= vxl[y - vTop] && x <= vxr[y - vTop];
    for (let y = vTop; y <= vBase; y++)
      for (let x = vxl[y - vTop]; x <= vxr[y - vTop]; x++) {
        const t = (y - vTop) / (vBase - vTop);
        if (t > 0.88 && hash(x, y, 82) < (t - 0.88) * 8) continue;
        const lit = x < vx + (y - vTop) * 0.22;
        // ridges and gullies radiating down from the crater
        const ang = Math.atan2(x - vx, (y - vTop) * 1.6 + 4);
        const rib = noise(ang * 15, t * 3, 83);
        const edge = (x - vxl[y - vTop]) / Math.max(1, vxr[y - vTop] - vxl[y - vTop]);
        let v = pick(VOLCANO, (lit ? 0.8 - edge * 0.45 : 0.3 - (edge - 0.5) * 0.3) + (rib - 0.5) * 0.9 + t * 0.06, x, y, 0.1);
        if (t < 0.85 && (!inV(x, y - 1) || !inV(x - 1, y) || !inV(x + 1, y))) v = INK;
        const i = y * W + x;
        buf[i] = v;
        c.taken[i] = 1;
        c.hot[i] = 0;
      }
    const lava = (x: number, y: number, v: Col) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x;
      buf[i] = v;
      c.hot[i] = 2;
      c.taken[i] = 1;
    };
    for (let x = vx - 4; x <= vx + 4; x++) {
      lava(x, vTop, x < vx + 3 ? LAVA[3] : LAVA[2]);
      lava(x, vTop + 1, Math.abs(x - vx) < 4 ? LAVA[2] : LAVA[1]);
      if (Math.abs(x - vx) < 3) lava(x, vTop + 2, LAVA[1]);
    }
    glow(p, vx + 0.5, vTop + 1, 12, col('#ff7a2a'), 0.22);
    // lava rivers: meandering down the lit face and on across the plain to the sea, and one into a lava lake
    for (const f of LAVA_FLOWS)
      spline(f.pts, 0.4).forEach(([x0, y], k, all) => {
        const x = x0 + Math.sin(y * 0.3 + f.w) * 1.4;
        const wd = f.w * (0.55 + (k / all.length) * 0.7);
        for (let yy = Math.floor(y - wd); yy <= y + wd; yy++)
          for (let xx = Math.floor(x - wd); xx <= x + wd; xx++) {
            const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
            if (d > wd || xx < 0 || yy < 0 || xx >= W || yy >= H || !plateMask[yy * W + xx]) continue;
            lava(xx, yy, d < wd * 0.4 ? LAVA[3] : d < wd * 0.75 ? LAVA[2] : LAVA[1]);
          }
        // a crust of cooled rock either side
        for (const s of [-1, 1]) {
          const xx = Math.round(x + s * (wd + 1));
          const yy = Math.round(y);
          if (xx >= 0 && xx < W && yy < H && plateMask[yy * W + xx] && c.hot[yy * W + xx] !== 2) buf[yy * W + xx] = BASALT[0];
        }
      });
    for (let y = 146; y <= 162; y++)
      for (let x = 772; x <= 808; x++) {
        const e = ((x + 0.5 - 790) / 16) ** 2 + ((y + 0.5 - 154) / 6.5) ** 2 + (noise(x * 0.3, y * 0.3, 85) - 0.5) * 0.3;
        if (e > 1) continue;
        lava(x, y, e < 0.25 ? LAVA[3] : e < 0.6 ? LAVA[2] : e < 0.85 ? LAVA[1] : LAVA[0]);
        if (e < 0.8 && hash(x, y, 86) < 0.08) lava(x, y, col('#3a1a14'));
      }
    // basalt spires
    for (const [x, y, hgt] of SPIRES)
      for (let k = 0; k <= hgt; k++) {
        if (k === hgt) {
          buf[(y - k) * W + x] = INK;
          continue;
        }
        buf[(y - k) * W + x] = k === hgt - 1 ? BASALT[4] : BASALT[2];
        if (k < hgt - 2) buf[(y - k) * W + x + 1] = BASALT[1];
        if (k < hgt - 1) buf[(y - k) * W + x - 1] = INK;
        buf[(y - k) * W + x + (k < hgt - 2 ? 2 : 1)] = INK;
        claimBox(c, x - 1, y - k, 3, 1);
      }
    // the black citadel: dark walls and a glowing gate
    {
      const cx = 770;
      const base = 176;
      const dark = P({ s: '#5a4448', S: '#3e2e32', m: '#2a1e22', k: '#ff9a2a', K: '#ffe070', r: '#8a1a22' });
      shade(p, cx + 3, base + 1, 13, 2, 0.35);
      spr(c, ['.r...r...r.', 'sSs.sSs.sSs', 'sSSSSSSSSSm', 'sSmSSkSSmSm', 'sSSSkKkSSSm', 'sSSSkKkSSmm'], dark, cx - 5, base - 6);
      spr(c, ['.r.', 'sSm', 'sSm', 'sSm', 'skm', 'sSm', 'sSm', 'sSm'], dark, cx - 9, base - 8);
      spr(c, ['.r.', 'sSm', 'sSm', 'skm', 'sSm', 'sSm', 'sSm', 'sSm', 'sSm', 'sSm'], dark, cx + 7, base - 10);
      fires.push([cx, base - 3]);
    }
    for (let k = 0; k < 34; k++) {
      const x = Math.round(736 + hash(k, 1, 87) * 150);
      const y = Math.round(40 + hash(k, 2, 87) * 160);
      if (!free(c, x - 2, y - 2, 4, 3, [R_ASH])) continue;
      tree(c, T.ash[k % 2], x, y, 0.25);
    }
  }

}

/** Duskmire. */
function stageDusk(S: Stage): void {
  const { W, p, buf, c, reg, plateMask } = S;
  const T = trees();
  // Duskmire: the stilt village on its boardwalks, the Mirelight, willows, dead trees, reeds, glowing mushrooms
  {
    for (let x = 604; x <= 646; x++) {
      buf[256 * W + x] = x % 2 ? col('#7a6248') : col('#5a4632');
      buf[257 * W + x] = col('#2a1e14');
    }
    for (let y = 250; y <= 268; y++) {
      buf[y * W + 626] = y % 2 ? col('#7a6248') : col('#5a4632');
      buf[y * W + 627] = col('#2a1e14');
    }
    claimBox(c, 600, 236, 50, 36);
    // small clearings where Rowan stands by the village and the lighthouse (WORLD_ACTS_DUSK stands)
    claimBox(c, 588, 248, 14, 14);
    claimBox(c, 684, 241, 14, 14);
    for (const [x, y] of STILT_HUTS) stiltHut(c, x, y);
    const b = WORLD_SPOTS.beacon;
    shade(p, b.x + 2, b.y + 15, 5, 1.5, 0.35);
    spr(c, BEACON, BEACON_PAL, b.x - 3, b.y - 3);
    claimBox(c, b.x - 5, b.y - 5, 11, 22);
    glow(p, b.x + 0.5, b.y + 1, 10, col('#ffd860'), 0.18);
    // the drowned arch (the fen's first act, WORLD_ACTS_DUSK[0]): a black pool, a broken stone arch half sunk in it,
    // its reflection, two fen lanterns on poles glowing at its sides
    {
      const ax = 779;
      const ay = 256;
      for (let y = ay - 6; y <= ay + 6; y++)
        for (let x = ax - 14; x <= ax + 14; x++) {
          const e = ((x + 0.5 - ax) / 14) ** 2 + ((y + 0.5 - ay) / 5.6) ** 2 + (hash(x >> 1, y, 107) - 0.5) * 0.12;
          const i = y * W + x;
          if (e > 1 || !plateMask[i]) continue;
          buf[i] = e > 0.82 ? col('#3a5440') : e > 0.62 ? col('#172a36') : col('#0e1a24');
          if (e < 0.55 && (x * 2 + y * 5) % 13 === 0) buf[i] = col('#2a4a58');
        }
      spr(
        c,
        ['...sSSSm.....', '..sSSSSSm.m..', '.sSm...sSmSm.', '.sS.....Sm...', '.sS.....sm...', '.sm.....sm...', '.rr.....rr...', '..r.....r....'],
        P({ s: '#a8b0a0', S: '#7a8478', m: '#4a5248', r: '#3a5a60' }),
        ax - 6,
        ay - 9,
      );
      for (const lx of [ax - 12, ax + 11]) {
        for (let k = 1; k <= 5; k++) buf[(ay - k) * W + lx] = col('#4a3a2a');
        buf[(ay - 7) * W + lx] = col('#fff0a0');
        buf[(ay - 6) * W + lx] = col('#ffd860');
        glow(p, lx + 0.5, ay - 6, 6, col('#ffd860'), 0.22);
      }
      claimBox(c, ax - 22, ay - 20, 44, 32);
    }
    forest(
      c,
      536,
      200,
      870,
      296,
      7,
      (x, y) => reg[y * W + x] === R_DUSK && noise(x * 0.05, y * 0.07, 93) > 0.36,
      (_x, _y, r) => (r < 0.5 ? T.willow[Math.floor(r * 4) % 2] : r < 0.58 ? T.dead[Math.floor(r * 50) % 2] : r < 0.9 ? T.deep[Math.floor(r * 10) % 4] : null),
      0.25,
    );
    for (let y = 204; y < 296; y += 2)
      for (let x = 536; x < 870; x += 2) {
        const i = y * W + x;
        if (reg[i] !== R_DUSK || c.taken[i] || c.water[i] || c.water[i + W] !== 5 || hash(x, y, 103) > 0.5) continue;
        tuft(p, x, y + 1, 2 + Math.round(hash(x, y, 104) * 2), REED, x * 7 + y);
      }
    for (let k = 0; k < 50; k++) {
      const x = Math.round(546 + hash(k, 3, 105) * 310);
      const y = Math.round(206 + hash(k, 4, 105) * 86);
      const i = y * W + x;
      if (reg[i] !== R_DUSK || c.taken[i] || c.water[i] || !plateMask[i]) continue;
      buf[i] = col('#c8f0d0');
      buf[i + W] = col('#7aa48a');
      if (hash(k, 5, 105) < 0.5) buf[i + W + 2] = col('#a8e8c0');
    }
  }

}

/** The heartland round the capital. */
function stageHeart(S: Stage): void {
  const { W, p, c, reg } = S;
  const T = trees();
  const HT = [R_HEART];
  // ---- the heartland: the capital round the Great Pendulum, its farms, hamlets, woods
  {
    const cap = capital(c, 522, 146, 36, 17);
    WORLD_SPOTS.turrets = cap.turrets;
    WORLD_SPOTS.pendulum = { x: cap.tower[0] + PENDULUM_AT[0], y: cap.tower[1] + PENDULUM_AT[1] };
    glow(p, WORLD_SPOTS.pendulum.x + 0.5, WORLD_SPOTS.pendulum.y - 6, 9, col('#fff0c0'), 0.1);
    windmill(c, WORLD_SPOTS.mills[1][0], WORLD_SPOTS.mills[1][1]);
    paddock(c, WORLD_SPOTS.sheep2.x, WORLD_SPOTS.sheep2.y, WORLD_SPOTS.sheep2.w, WORLD_SPOTS.sheep2.h);
    village(c, 488, 232, 18, 8, 9, 131, ['red', 'thatch', 'blue'], HT);
    village(c, 612, 168, 14, 6, 6, 133, ['thatch', 'red'], HT);
    village(c, 444, 132, 10, 6, 4, 135, ['red', 'blue'], HT);
    village(c, 690, 186, 10, 5, 4, 137, ['thatch', 'red'], HT);
    fields(c, 590, 188, 44, 14, 141, ['wheat', 'wheat', 'vine', 'green', 'ploughed'], HT, 10, 5);
    fields(c, 506, 206, 34, 12, 143, ['wheat', 'green', 'flax', 'ploughed'], HT);
    fields(c, 414, 124, 22, 10, 145, ['wheat', 'pasture', 'green'], HT);
    fields(c, 664, 170, 30, 12, 147, ['wheat', 'vine', 'pasture'], HT);
    fields(c, 520, 252, 30, 10, 149, ['wheat', 'lavender', 'green'], HT);
    forest(c, 400, 90, 740, 200, 5.2, (x, y) => reg[y * W + x] === R_HEART && noise(x * 0.04, y * 0.06, 151) > 0.66, (_x, _y, r) => (r < 0.7 ? T.oak[Math.floor(r * 5) % 4] : T.golden[Math.floor(r * 7) % 2]), 0.22);
    forest(c, 390, 200, 560, 290, 5.2, (x, y) => reg[y * W + x] === R_HEART && noise(x * 0.05, y * 0.07, 153) > 0.66, (_x, _y, r) => T.oak[Math.floor(r * 4)], 0.22);
  }

}

/** Greenmarch. */
function stageGreen(S: Stage): void {
  const { W, p, c, reg, fires, glows, eyes } = S;
  const T = trees();
  const GM = [R_GREEN];
  // ---- Greenmarch
  {
    // the lighthouse on its islet, the harbour town, piers and moored boats
    const lh = WORLD_SPOTS.lighthouse;
    shade(p, lh.x + 2, lh.y + 10, 3, 1, 0.35);
    spr(c, LIGHTHOUSE, LIGHTHOUSE_PAL, lh.x - 1, lh.y - 1);
    for (let y = lh.y - 2; y < lh.y + 12; y++) for (let x = lh.x - 2; x < lh.x + 4; x++) c.cover[y * W + x] = 1;
    village(c, 86, 190, 24, 11, 12, 161, ['red', 'blue', 'red', 'slate'], GM);
    village(c, 58, 236, 11, 5, 4, 163, ['blue', 'red'], GM);
    for (const [x, y, len] of PIERS) {
      pier(c, x, y, 0, 1, len);
      WORLD_LIFE.boats.push([x + 4, y + len]);
    }
    // the Meadow Road: its village, fields, orchards, a windmill and the Bandit Captain's camp
    banditCamp(c, WORLD_ACTS[0].x, WORLD_ACTS[0].y + 3, fires);
    village(c, 114, 230, 26, 12, 12, 171, ['red', 'thatch', 'red', 'blue'], GM);
    village(c, 236, 264, 10, 5, 4, 173, ['thatch', 'red'], GM);
    windmill(c, WORLD_SPOTS.mills[0][0], WORLD_SPOTS.mills[0][1]);
    orchard(c, 140, 203, 5, 3, GM);
    orchard(c, 90, 246, 3, 2, GM);
    paddock(c, WORLD_SPOTS.sheep.x, WORLD_SPOTS.sheep.y, WORLD_SPOTS.sheep.w, WORLD_SPOTS.sheep.h);
    fields(c, 128, 260, 64, 13, 181, ['wheat', 'green', 'ploughed', 'wheat', 'lavender', 'pasture'], GM);
    fields(c, 190, 220, 20, 8, 183, ['wheat', 'green', 'ploughed'], GM);
    // the Old Ruins on their rise, the standing stones, campsites, a woodcutter's hut
    oldRuins(c, WORLD_ACTS[1].x, WORLD_ACTS[1].y + 10, glows);
    standingStones(c, 306, 136);
    campsite(c, 70, 136, fires);
    campsite(c, 284, 254, fires, '#a8c0e0');
    house(c, 108, 104, 3, 'thatch');
    // the Boar King's Hollow: the great tree in its dark autumn wood
    hollowTree(c, WORLD_ACTS[2].x, WORLD_ACTS[2].y + 20, fires, eyes);
    // forests: the north-west wood (clearings round the camp and the hut), the dark wood round the Hollow, copses
    forest(
      c,
      20,
      84,
      236,
      200,
      4.4,
      (x, y) => reg[y * W + x] === R_GREEN && ((x - 116) / 100) ** 2 + ((y - 138) / 54) ** 2 < 1 && noise(x * 0.07, y * 0.09, 191) > 0.3 && !(Math.hypot(x - 72, (y - 138) * 1.4) < 13) && !(Math.hypot(x - 110, (y - 106) * 1.4) < 10),
      (_x, _y, r) => (r < 0.1 ? null : r < 0.7 ? T.oak[Math.floor(r * 9) % 4] : r < 0.85 ? T.pine[Math.floor(r * 13) % 3] : T.deep[Math.floor(r * 17) % 4]),
    );
    forest(
      c,
      290,
      186,
      414,
      278,
      4.4,
      (x, y) => reg[y * W + x] === R_GREEN && ((x - 352) / 62) ** 2 + ((y - 230) / 42) ** 2 < 1 + (noise(x * 0.1, y * 0.1, 193) - 0.5) * 0.5,
      (_x, _y, r) => (r < 0.5 ? T.dark[Math.floor(r * 8) % 4] : r < 0.8 ? T.autumn[Math.floor(r * 11) % 3] : T.deep[Math.floor(r * 13) % 4]),
      0.3,
    );
    forest(c, 230, 84, 420, 200, 5, (x, y) => reg[y * W + x] === R_GREEN && noise(x * 0.05, y * 0.07, 195) > 0.67, (_x, _y, r) => (r < 0.6 ? T.oak[Math.floor(r * 6) % 4] : r < 0.85 ? T.small[Math.floor(r * 7) % 3] : T.pine[Math.floor(r * 9) % 3]));
    forest(c, 20, 200, 300, 284, 6, (x, y) => reg[y * W + x] === R_GREEN && noise(x * 0.06, y * 0.08, 197) > 0.76, (_x, _y, r) => (r < 0.7 ? T.oak[Math.floor(r * 6) % 4] : T.fruit[Math.floor(r * 9) % 3]));
    WORLD_LIFE.birds = [
      [110, 140],
      [352, 214],
      [600, 120],
      [470, 262],
    ];
  }

}

/** Scatter over the open land. */
function stageScatter(S: Stage): void {
  const { W, H, buf, c, land, reg } = S;
  const T = trees();
  const roadMask = c.road;
  // ---- scatter: lone trees, bushes, flowers and rocks over the open land
  {
    const FLOWERS: Array<[Col, Col]> = [
      [col('#f07aa8'), col('#ffd0e0')],
      [col('#f2d048'), col('#fff0a0')],
      [col('#e8eef8'), col('#ffffff')],
      [col('#a87ae8'), col('#dab0ff')],
    ];
    for (let gy = 4; gy < H - 4; gy += 4)
      for (let gx = 4; gx < W - 4; gx += 5) {
        const x = Math.round(gx + (hash(gx, gy, 151) - 0.5) * 4);
        const y = Math.round(gy + (hash(gx, gy, 152) - 0.5) * 3);
        const i = y * W + x;
        const r = hash(gx, gy, 153);
        const rg = reg[i];
        if (!land[i] || c.taken[i] || roadMask[i] || c.water[i]) continue;
        if (rg === R_GREEN || rg === R_HEART) {
          if (r < 0.012) {
            if (!free(c, x - 3, y - 6, 7, 7, [rg])) continue;
            tree(c, T.small[Math.floor(hash(gx, gy, 154) * 3)], x, y, 0.3);
          } else if (r < 0.11) {
            if (!free(c, x, y, 2, 2, [rg])) continue;
            const [a, b] = FLOWERS[Math.floor(hash(gx, gy, 155) * FLOWERS.length)];
            buf[i] = b;
            buf[i + 1] = a;
            buf[i + W] = a;
          }
        } else if (rg === R_FROST && r < 0.05 && free(c, x, y, 3, 2, [rg])) {
          buf[i] = TUNDRA[5];
          buf[i + 1] = TUNDRA[3];
          buf[i + W] = TUNDRA[1];
          buf[i + W + 1] = TUNDRA[0];
        } else if (rg === R_ASH && r < 0.06 && free(c, x, y, 3, 2, [rg])) {
          buf[i] = BASALT[3];
          buf[i + 1] = BASALT[1];
          buf[i + W] = BASALT[0];
        }
      }
  }

}

/**
 * The sea's frames (SEA_FRAMES): wave marks crest and break on the open sea, a broken line of surf rolls in to every
 * shore and the beach foam swells, ripples run down the rivers and across the lakes.
 */
function* paintSea(S: Stage): Generator<void, HTMLCanvasElement[]> {
  const { W, H, N, buf, c, plateMask, dist, coastN, riverPix, lakePix } = S;
  const marks: Array<[number, number, number]> = [];
  for (let gy = 2; gy < H; gy += 7)
    for (let gx = (gy * 5) % 11; gx < W; gx += 11) {
      const x = Math.round(gx + (hash(gx, gy, 31) - 0.5) * 6);
      const y = Math.round(gy + (hash(gx, gy, 32) - 0.5) * 3);
      if (x < 1 || x > W - 6 || y < 2 || y >= H || hash(gx, gy, 33) < 0.25) continue;
      if (dist[y * W + x] < 5 || dist[y * W + Math.min(W - 1, x + 5)] < 5 || c.cover[y * W + x] || c.cover[y * W + x + 3]) continue;
      marks.push([x, y, Math.floor(hash(gx, gy, 34) * SEA_FRAMES)]);
    }
  const coast: number[] = [];
  const coastK: number[] = [];
  for (let i = 0; i < N; i++)
    if (!plateMask[i] && dist[i] <= 5.5 && !c.cover[i]) {
      const x = i % W;
      const y = (i - x) / W;
      coast.push(i);
      coastK.push(coastN[i] * 0.6 + hash(x >> 1, y >> 1, 77) * 0.4);
    }
  const ripple = col('#a8e0f4');
  // on the Atlas: the wave marks are small strokes of faded ink, the surf a pale line of bare paper
  const foam = rgba32(PARCH[5]);
  const frames: HTMLCanvasElement[] = [];
  for (let f = 0; f < SEA_FRAMES; f++) {
    yield;
    frames.push(
      wordCanvas(W, H, (u) => {
        const tint = (x: number, y: number, k: number, to = ATLAS_INK[3]) => {
          const i = y * W + x;
          u[i] = rgba32(mix(buf[i], to, k));
        };
        for (const [x, y, ph] of marks) {
          const s = (f + ph) % SEA_FRAMES; // 0-1 hidden, 2 forming, 3 full, 4 cresting a pixel on, 5 breaking up
          if (s < 2) continue;
          const o = s >= 4 ? 1 : 0;
          if (s === 2 || s === 5) {
            tint(x + 1 + o, y - 1, 0.3);
            tint(x + 2 + o, y - 1, 0.3);
            continue;
          }
          tint(x + o, y, 0.38);
          tint(x + 1 + o, y - 1, 0.38);
          if (s === 4) u[(y - 1) * W + x + 2 + o] = foam;
          else tint(x + 2 + o, y - 1, 0.38);
          tint(x + 3 + o, y, 0.38);
          tint(x + 1 + o, y, 0.3, PARCH[5]);
          tint(x + 2 + o, y, 0.3, PARCH[5]);
        }
        // the surf: a line rolls in over three frames, then the beach foam lingers
        const at = 4.2 - f * 0.95;
        for (let k = 0; k < coast.length; k++) {
          const i = coast[k];
          const d = dist[i];
          const n = coastK[k];
          if (f < 3) {
            if (Math.abs(d - at) < 0.55 && n > 0.5 - f * 0.12) u[i] = f === 0 ? rgba32(mix(buf[i], PARCH[5], 0.4)) : f === 1 ? rgba32(mix(buf[i], PARCH[5], 0.7)) : foam;
          } else if (d > 1.2 && d < 2.3 && n > 0.32 + (f - 3) * 0.08) u[i] = d < 1.8 ? foam : rgba32(mix(buf[i], PARCH[5], 0.6));
        }
        for (const i of riverPix) {
          if (c.water[i] !== 1) continue;
          const x = i % W;
          const y = (i - x) / W;
          if ((((y + x * 2 - f) % SEA_FRAMES) + SEA_FRAMES) % SEA_FRAMES === 0) u[i] = rgba32(mix(buf[i], ripple, 0.55));
        }
        for (const i of lakePix) {
          const x = i % W;
          const y = (i - x) / W;
          if (c.water[i] === 2 && hash(x >> 2, y, 64) < 0.1 && ((x >> 2) + f) % SEA_FRAMES < 2) u[i] = rgba32(mix(buf[i], ripple, 0.45));
        }
      }),
    );
  }
  return frames;
}

/** A gust rolling east over Greenmarch's meadows and woods (WIND_FRAMES, cropped to WORLD_BOXES.wind). */
function paintWind(S: Stage): HTMLCanvasElement[] {
  const { W, buf, c, land, reg } = S;
  const roadMask = c.road;
  // the gust: a soft diagonal band that lifts each grass and leaf tone one step up its ramp
  const wb = WORLD_BOXES.wind;
  const tip = col('#f0f8c0');
  const upMap = new Map<Col, [number, number]>();
  for (const r of [GRASS, MEADOW, LEAF]) r.forEach((v, k) => upMap.set(v, [rgba32(k + 1 < r.length ? r[k + 1] : mix(v, tip, 0.3)), rgba32(k + 2 < r.length ? r[k + 2] : mix(v, tip, 0.5))]));
  // the band runs along x + 0.7 y: bucket the gust's pixels by that, so each frame only visits its own band
  const buckets: Array<Array<[number, number, [number, number]]>> = [];
  for (let y = wb.y; y < wb.y + wb.h; y++)
    for (let x = wb.x; x < wb.x + wb.w; x++) {
      const i = y * W + x;
      if (!land[i] || reg[i] !== R_GREEN || roadMask[i]) continue;
      const up = upMap.get(buf[i]);
      if (!up) continue;
      const k = Math.floor(x + y * 0.7);
      (buckets[k] ??= []).push([x, y, up]);
    }
  const wind: HTMLCanvasElement[] = [];
  for (let f = 0; f < WIND_FRAMES; f++)
    wind.push(
      wordCanvas(wb.w, wb.h, (u) => {
        const at = 60 + (f / (WIND_FRAMES - 1)) * 420;
        for (let k = Math.max(0, Math.floor(at - 12)); k <= at + 12; k++)
          for (const [x, y, up] of buckets[k] ?? []) {
            const d = Math.abs(x + y * 0.7 - at) / 12;
            if (d >= 1 || 1 - d < bay(x, y) * 1.2) continue;
            u[(y - wb.y) * wb.w + x - wb.x] = d < 0.45 ? up[1] : up[0];
          }
      }),
    );
  return wind;
}

/** The volcano and its lava lit up, and the Mirelight's lamp lit up (pulsing overlays). */
function paintGlows(S: Stage): { lava: Pix; lamp: Pix } {
  const { W, p, buf, c } = S;
  // the volcano lit up (crater, lava, fissures, a halo)
  const lb = WORLD_BOXES.lava;
  const lavaP = new Pix(lb.w, lb.h, -1);
  const cr = WORLD_SPOTS.crater;
  for (let y = lb.y; y < lb.y + lb.h; y++)
    for (let x = lb.x; x < lb.x + lb.w; x++) {
      const i = y * W + x;
      const j = (y - lb.y) * lb.w + x - lb.x;
      if (c.hot[i] === 2) lavaP.buf[j] = lighten(buf[i], col('#ffb040'), 0.45);
      else if (c.hot[i] === 1) lavaP.buf[j] = mix(buf[i], col('#ffb040'), 0.6);
      else if (c.hot[i - 1] === 2 || c.hot[i + 1] === 2 || c.hot[i - W] === 2 || c.hot[i + W] === 2) lavaP.buf[j] = lighten(buf[i], col('#ff6a2a'), 0.25);
      else {
        const s = glowStep(x, y, cr.x + 0.5, cr.y + 1.5, 12);
        if (s) lavaP.buf[j] = lighten(buf[i], col('#ff6a2a'), 0.32 * s);
      }
    }
  // the Mirelight's lamp lit up
  const mb = WORLD_BOXES.lamp;
  const lampP = new Pix(mb.w, mb.h, -1);
  const lamp = WORLD_SPOTS.beacon;
  for (let y = 0; y < mb.h; y++)
    for (let x = 0; x < mb.w; x++) {
      const s = glowStep(mb.x + x, mb.y + y, lamp.x + 0.5, lamp.y + 0.5, 13);
      if (s) lampP.buf[y * mb.w + x] = lighten(p.get(mb.x + x, mb.y + y), col('#ffd860'), 0.4 * s);
    }
  for (const [dx, dy] of [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ])
    lampP.set(lamp.x - mb.x + dx, lamp.y - mb.y + dy, col('#ffffff'));

  return { lava: lavaP, lamp: lampP };
}

/** The whole painting, as a sequence of steps (each a few ms to a few tens of ms) so it can run in idle slices. */
function* paintWorld(): Generator<void, WorldLayers> {
  const W = WORLD_W;
  const H = WORLD_H;
  const L = yield* stageLand(W, H);
  yield;
  const p = new Pix(W, H, 0);
  const c: WCtx = {
    p,
    W,
    H,
    land: L.plateMask,
    reg: L.reg,
    water: new Uint8Array(L.N),
    road: new Uint8Array(L.N),
    taken: new Uint8Array(L.N),
    cover: new Uint8Array(L.N),
    hot: new Uint8Array(L.N),
    rnd: rng(311),
    windows: [],
    chimneys: [],
  };
  const S: Stage = { ...L, p, buf: p.buf, c, dist: new Float32Array(0), pool: new Uint8Array(L.N), riverPix: [], lakePix: [], fires: [], glows: [], eyes: [] };
  WORLD_LIFE.boats = [];
  stageSea(S);
  yield;
  stagePools(S);
  for (let y = 0; y < H; y += 40) {
    yield;
    stageSurface(S, y, Math.min(H, y + 40));
  }
  stageCliffs(S);
  stageEscarp(S);
  stageWater(S);
  yield;
  stageRoads(S);
  yield;
  stageFrost(S);
  yield;
  stageAsh(S);
  yield;
  stageDusk(S);
  stageHeart(S);
  yield;
  stageGreen(S);
  yield;
  stageScatter(S);
  WORLD_SPOTS.fires = S.fires;
  WORLD_SPOTS.glows = S.glows;
  WORLD_SPOTS.eyes = S.eyes;
  WORLD_LIFE.windows = c.windows;
  WORLD_LIFE.chimneys = c.chimneys;
  atmosphere(p);
  duskGrade(p, L.plateMask);
  // printed on the Atlas: parchment sea, inked coasts and borders (art-world-atlas.ts), then his drafts of each land
  const greenish = (r: number) => (r === R_HEART ? R_GREEN : r);
  yield* atlasPrint({ W, H, buf: p.buf, land: L.plateMask, reg: L.reg, water: c.water, dist: S.dist, sheetW: MAP_W }, (a, b) => greenish(a) === greenish(b));
  const drafts: Record<string, HTMLCanvasElement> = {};
  for (const [id, R] of Object.entries(DRAFT_REG)) {
    yield;
    const d = draftOf(p.buf, W, H, (i) => L.plateMask[i] === 1 && greenish(L.reg[i]) === R);
    DRAFT_BOXES[id] = d.box;
    drafts[id] = d.canvas;
  }
  const sea = yield* paintSea(S);
  yield;
  const wind = paintWind(S);
  yield;
  const glows = paintGlows(S);
  const isle = paintIsle(p);
  const veils = yield* paintVeils(L.reg, L.plateMask, L.broad, p.buf);
  yield;
  const rim = paintRim();
  return { base: p.canvas(), sea, wind, lava: glows.lava, lamp: glows.lamp, isle: isle.p, veils, drafts, isleVeil: isle.veil, rim };
}

/** The land in the mood (L7; review-4 R4-14: it read as a bright midday green beside the dusk fights): every land
 *  colour a little less saturated and pulled toward a cool dusk indigo, less so the brighter it is (lit windows,
 *  fires and the roads' pale dust keep their step above the fields, so roads and landmarks still read). */
function duskGrade(p: Pix, land: Uint8Array): void {
  const buf = p.buf;
  const [dr, dg, db] = [0x1a, 0x1e, 0x36];
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (land[i] !== 1 || c < 0) continue;
    let r = (c >> 16) & 255;
    let g = (c >> 8) & 255;
    let b = c & 255;
    const l = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    // a step less saturated
    const y = l * 255;
    r += (y - r) * 0.18;
    g += (y - g) * 0.18;
    b += (y - b) * 0.18;
    const k = Math.max(0, 0.26 - Math.max(0, l - 0.58) * 0.9);
    r += (dr - r) * k;
    g += (dg - g) * k;
    b += (db - b) * k;
    buf[i] = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }
}

/** The light over everything: distance hazes the far north toward the sky's colour (in dithered steps), and the
 *  low sun warms the west. */
function atmosphere(p: Pix): void {
  const W = p.w;
  const buf = p.buf;
  for (let y = 0; y < Math.min(p.h, 120); y++) {
    const k = ((120 - y) / 120) ** 1.4 * 0.32;
    for (let x = 0; x < W; x++) {
      const q = level(k / 0.32, 4, x, y, 0.25) / 4;
      if (q > 0) buf[y * W + x] = mix(buf[y * W + x], SKY_HAZE, q * 0.32);
    }
  }
  for (let y = 0; y < p.h; y++) {
    const ky = (1 - Math.abs(y - 180) / 200) * 0.14;
    for (let x = 0; x < 480; x++) {
      const k = (1 - x / 480) * ky;
      if (k > bay(x, y) * 0.16) buf[y * W + x] = mix(buf[y * W + x], SUN, k);
    }
  }
}

// ------------------------------------------------------------------ Noonspire

/** The floating island with its sun temple (crop of WORLD_BOXES.isle), its waterfall, and the mist over it. */
function paintIsle(base: Pix): { p: Pix; veil: HTMLCanvasElement } {
  const b = WORLD_BOXES.isle;
  const q = new Pix(b.w, b.h, -1);
  const ix = 918 - b.x; // the island's centre (local)
  const iy = 100 - b.y; // its top surface
  // its shadow on the sea far below
  shade(base, 920, 196, 16, 3.5, 0.35, col('#08142a'));
  const rock = ramp('#3a2a40', '#54405a', '#6e5876', '#8e7694', '#b09ab0');
  // the underside: a tapering crag with strata and hanging roots
  for (let y = iy; y <= iy + 40; y++) {
    const t = (y - iy) / 40;
    const half = 19 * Math.pow(1 - t, 1.15) + (noise(y * 0.4, 1, 111) - 0.5) * 3;
    for (let x = Math.round(ix - half); x <= Math.round(ix + half * 0.95); x++) {
      const u = (x - (ix - half)) / Math.max(1, half * 1.95);
      let v = 0.8 - u * 0.62 - t * 0.2;
      if ((y + Math.floor(noise(x * 0.4, 1, 113) * 3)) % 4 === 0) v -= 0.22;
      q.set(x, y, pick(rock, v, x, y, 0.2));
    }
    q.set(Math.round(ix - half) - 1, y, INK);
    q.set(Math.round(ix + half * 0.95) + 1, y, INK);
  }
  for (let k = 0; k < 7; k++) {
    const x = Math.round(ix - 14 + k * 4.5);
    for (let j = 0; j < 3 + (k % 3) * 2; j++) q.set(x, iy + 4 + j + Math.round(Math.abs(x - ix) * 0.5), j % 2 ? col('#3e5a2e') : col('#5a7a36'));
  }
  // the grassy top
  const top = ramp('#2e5a32', '#4a7e36', '#78a83c', '#a8d058', '#d0e878');
  for (let y = iy - 6; y <= iy + 2; y++)
    for (let x = ix - 21; x <= ix + 21; x++) {
      const d = ((x + 0.5 - ix) / 20.5) ** 2 + ((y + 0.5 - iy + 2) / 5) ** 2;
      if (d > 1) continue;
      q.set(x, y, y >= iy + 1 ? top[0] : pick(top, 0.95 - ((x - ix + 20) / 41) * 0.5 - (y - iy + 6) * 0.04, x, y, 0.3));
    }
  // the sun spire rising behind the temple
  const sunY = WORLD_SPOTS.sun.y - b.y;
  for (let y = sunY + 2; y <= iy - 8; y++) {
    const half = y < sunY + 10 ? 0 : y < sunY + 22 ? 1 : 1.5;
    for (let x = Math.round(ix - half); x <= Math.round(ix + half); x++) q.set(x, y, x < ix ? col('#ffffff') : x === ix ? col('#e0e8f4') : col('#a8b4d0'));
    q.set(Math.round(ix - half) - 1, y, INK);
    q.set(Math.round(ix + half) + 1, y, INK);
    if (y === sunY + 12 || y === sunY + 24) for (let x = ix - 1; x <= ix + 1; x++) q.set(x, y, x <= ix ? col('#f2c230') : col('#b07a18'));
  }
  spr(q, ['.gGg.', 'gGWGy', 'GWGgy', 'gGgyY', '.yyY.'], P({ W: '#ffffff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14' }), ix - 2, sunY - 2);
  // the temple: a white colonnade under a gold dome
  spr(
    q,
    ['....gGGg....', '..gGGGGGgy..', '.gGGWGGGggy.', 'sssssssssssm', 's.s.s..s.s.m', 's.s.s..s.s.m', 's.s.s..s.s.m', 'sssssssssssm'],
    P({ G: '#fff0a0', g: '#f2c230', y: '#d8901c', W: '#ffffff', s: '#f4f0e8', m: '#a8b0c8' }),
    ix - 6,
    iy - 11,
  );
  // little gold-roofed shrines either side
  const shrine = ['.gy.', 'gGyy', 'sssm', 's.sm'];
  const shrinePal = P({ G: '#fff0a0', g: '#f2c230', y: '#d8901c', s: '#f4f0e8', m: '#a8b0c8' });
  spr(q, shrine, shrinePal, ix - 17, iy - 6);
  spr(q, shrine, shrinePal, ix + 12, iy - 5);
  // the waterfall spilling off the west edge, fading into spray
  const wf = WORLD_SPOTS.isleFalls;
  for (let y = wf.y0 - b.y; y < wf.y1 - b.y + 8; y++) {
    const f = (y - (wf.y0 - b.y)) / (wf.y1 - wf.y0 + 8);
    for (const dx of [0, 1]) if (f < 0.6 || bay(wf.x + dx, y) > f) q.set(wf.x - b.x + dx, y, dx ? col('#9ad0f0') : col('#e8f8ff'));
  }
  // the clouds it floats on, and a golden mist over it (the veil, with alpha)
  const veil = new Veil(b.w, b.h);
  const cl = new Pix(b.w, b.h, -1);
  const r2 = rng(117);
  const blobs: Blob[] = [];
  for (let k = 0; k < 9; k++) blobs.push({ x: ix - 26 + k * 6.5 + (r2() - 0.5) * 3, y: iy + 30 + Math.sin(k * 1.7) * 4, rx: 5 + r2() * 3, ry: 3.4 + r2() * 1.6 });
  for (let k = 0; k < 5; k++) blobs.push({ x: ix - 20 + k * 10 + (r2() - 0.5) * 3, y: iy + 22 + (r2() - 0.5) * 4, rx: 4 + r2() * 2, ry: 3 });
  mass(cl, blobs, { ramp: ramp('#c8b8a0', '#e8dcc4', '#fff4e0', '#ffffff'), seed: 119, bump: 0.14, tex: 0.12, vgrad: 0.35, light: 0.12, shadow: 0.22, band: 0.5, outline: col('#a89878') });
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const v = cl.get(x, y);
      if (v >= 0) veil.set(x, y, v, 0.95);
      else if (q.get(x, y) >= 0) veil.set(x, y, col('#fff6dc'), Math.floor((0.24 + noise(x * 0.2, y * 0.2, 121) * 0.25) * 4 + bay(x, y)) / 4);
    }
  return { p: q, veil: veil.canvas() };
}

// ------------------------------------------------------------------ the veils (fog of war) over the locked lands

/** An RGBA buffer (the veils have alpha). */
class Veil {
  readonly rgb: Int32Array;
  readonly a: Float32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.rgb = new Int32Array(w * h);
    this.a = new Float32Array(w * h);
  }
  set(x: number, y: number, c: Col, a: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.rgb[y * this.w + x] = c;
    this.a[y * this.w + x] = a;
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    const d = img.data;
    for (let i = 0; i < this.rgb.length; i++) {
      const a = this.a[i];
      if (a <= 0) continue;
      const v = this.rgb[i];
      d[i * 4] = v >> 16;
      d[i * 4 + 1] = (v >> 8) & 255;
      d[i * 4 + 2] = v & 255;
      d[i * 4 + 3] = Math.round(Math.min(1, a) * 255);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

const VEIL_REG: Record<string, number> = { frostpeaks: R_FROST, ashfell: R_ASH, duskmire: R_DUSK };

/**
 * A soft fog of war over each locked land: a thin, billowing mist over its land, a wall of cloud along its frontier
 * with the known lands, and a few banks drifting over its far parts; its landmarks keep clear patches so they show
 * through. The mist is quantised to a few alpha steps with ordered dither (pixel art, not a blur).
 */
function* paintVeils(reg: Uint8Array, plate: Uint8Array, _broad: Float32Array, printed: Int32Array): Generator<void, Record<string, HTMLCanvasElement>> {
  const W = WORLD_W;
  const H = WORLD_H;
  // where the known lands are not (the sea, the map's edge and the locked lands), blurred into a soft frontier
  const sw = W + 1;
  const sat = new Float32Array(sw * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      row += !plate[i] || reg[i] === R_FROST || reg[i] === R_ASH || reg[i] === R_DUSK ? 1 : 0;
      sat[(y + 1) * sw + x + 1] = sat[y * sw + x + 1] + row;
    }
  }
  const rad = 8;
  const area = (2 * rad + 1) ** 2;
  const soft = (x: number, y: number) => {
    const x0 = Math.max(0, x - rad);
    const y0 = Math.max(0, y - rad);
    const x1 = Math.min(W, x + rad + 1);
    const y1 = Math.min(H, y + rad + 1);
    // off the map counts as unknown too
    const s = sat[y1 * sw + x1] - sat[y0 * sw + x1] - sat[y1 * sw + x0] + sat[y0 * sw + x0];
    return (s + area - (x1 - x0) * (y1 - y0)) / area;
  };
  // where two locked lands meet, the line between their blanks is torn, not ruled (review round 8: the region border
  // read as a straight box edge between two sheets): a pixel near such a border belongs to whichever locked land a
  // point jittered round it falls in (the same jitter for every veil, so the two blanks still meet without a gap)
  const locked = (r: number) => r === R_FROST || r === R_ASH || r === R_DUSK;
  const owner = (i: number): number => {
    const r = reg[i];
    if (!locked(r)) return r;
    const x = i % W;
    const y = (i / W) | 0;
    const jx = (noise(x * 0.11, y * 0.11, 61) - 0.5) * 22 + (noise(x * 0.6, y * 0.6, 63) - 0.5) * 5;
    const jy = (noise(x * 0.11, y * 0.11, 62) - 0.5) * 22 + (noise(x * 0.6, y * 0.6, 64) - 0.5) * 5;
    const sx = Math.max(0, Math.min(W - 1, Math.round(x + jx)));
    const sy = Math.max(0, Math.min(H - 1, Math.round(y + jy)));
    const j = sy * W + sx;
    return plate[j] === 1 && locked(reg[j]) ? reg[j] : r;
  };
  // each locked land as erased: blank vellum keeping the impression of its lines (art-world-atlas.ts blankOf)
  const out: Record<string, HTMLCanvasElement> = {};
  for (const [id, b] of Object.entries(VEIL_BOXES)) {
    yield;
    const R = VEIL_REG[id];
    // whose each pixel of the box is, worked out once (blankOf asks about a pixel more than once)
    const own = new Uint8Array(b.w * b.h);
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const gx = b.x + x;
        const gy = b.y + y;
        if (gx < W && gy < H) own[y * b.w + x] = owner(gy * W + gx);
      }
    const ownAt = (i: number) => {
      const x = (i % W) - b.x;
      const y = ((i / W) | 0) - b.y;
      return x >= 0 && y >= 0 && x < b.w && y < b.h ? own[y * b.w + x] : reg[i];
    };
    out[id] = blankOf(printed, W, H, b, (i) => plate[i] === 1 && ownAt(i) === R, soft);
  }
  return out;
}


/**
 * The far sea east of the continent (FAR_SEA_W x WORLD_H, at x = WORLD_W): the open sea of stageSea carried on
 * (the same deep-water formula and dither in world px, so it meets the continent's picture without a seam, darker
 * the further out), hazed like the rest of the north, fading into a sea mist at the world's eastern edge; and its
 * wave marks in SEA_FRAMES overlays, on paintSea's grid.
 */
function* paintFarSea(): Generator<void, { base: HTMLCanvasElement; waves: HTMLCanvasElement[] }> {
  const W = FAR_SEA_W;
  const H = WORLD_H;
  const X0 = WORLD_W;
  const p = new Pix(W, H, 0);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = X0 + x;

      // the Atlas's parchment carried on past the continent (the same paper and burnt edge), into the blank at the
      // sheet's eastern edge
      let c = paperAt(gx, y, MAP_W, H);
      const m = level(clamp01((gx - (MAP_W - 72)) / 72), 4, gx, y, 0.3) / 4;
      if (m > 0) c = mix(c, col('#8c8078'), m * 0.5);
      p.buf[y * W + x] = c;
    }
  neatline(p.buf, W, H, X0, MAP_W);
  yield;
  const marks: Array<[number, number, number]> = [];
  for (let gy = 2; gy < H; gy += 7)
    for (let gx = (gy * 5) % 11; gx < MAP_W; gx += 11) {
      if (gx < X0 - 4) continue;
      const x = Math.round(gx + (hash(gx, gy, 31) - 0.5) * 6);
      const y = Math.round(gy + (hash(gx, gy, 32) - 0.5) * 3);
      if (x < X0 || x > MAP_W - 30 || y < 2 || y >= H || hash(gx, gy, 33) < 0.25) continue;
      marks.push([x - X0, y, Math.floor(hash(gx, gy, 34) * SEA_FRAMES)]);
    }
  const foam = rgba32(PARCH[5]);
  const waves = Array.from({ length: SEA_FRAMES }, (_, f) =>
    wordCanvas(W, H, (u) => {
      const tint = (x: number, y: number, k: number, to = ATLAS_INK[3]) => {
        if (x < W) u[y * W + x] = rgba32(mix(p.buf[y * W + x], to, k));
      };
      for (const [x, y, ph] of marks) {
        const s = (f + ph) % SEA_FRAMES;
        if (s < 2) continue;
        const o = s >= 4 ? 1 : 0;
        if (s === 2 || s === 5) {
          tint(x + 1 + o, y - 1, 0.3);
          tint(x + 2 + o, y - 1, 0.3);
          continue;
        }
        tint(x + o, y, 0.38);
        tint(x + 1 + o, y - 1, 0.38);
        if (s === 4) u[(y - 1) * W + x + 2 + o] = foam;
        else tint(x + 2 + o, y - 1, 0.38);
        tint(x + 3 + o, y, 0.38);
        tint(x + 1 + o, y, 0.3, PARCH[5]);
        tint(x + 2 + o, y, 0.3, PARCH[5]);
      }
    }),
  );
  return { base: p.canvas(), waves };
}

/** The far north vanishing into clouds: a band of cloud banks along the map's top edge (on over the far sea). */
function paintRim(): HTMLCanvasElement {
  const W = MAP_W;
  const h = 26;
  const p = new Pix(W, h, -1);
  const deep = ramp('#7a8cbc', '#9cb0d8', '#c4d4ec', '#e6eefa', '#ffffff');
  const r = rng(701);
  for (let x0 = -10; x0 < W + 10; x0 += 30) {
    const bl: Blob[] = [];
    for (let k = 0; k < 6; k++) {
      const rr = 3.5 + r() * 5;
      bl.push({ x: x0 + r() * 34, y: 3 + r() * 9 - (x0 > 260 && x0 < 760 ? 0 : 3), rx: rr, ry: rr * 0.7 });
    }
    mass(p, bl, { ramp: deep, seed: 701 + x0, bump: 0.13, tex: 0.12, vgrad: 0.4, light: 0.12, shadow: 0.2, band: 0.5, outline: col('#5e6e9c'), floor: h - 1 });
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < 3; y++) if (p.get(x, y) < 0) p.set(x, y, deep[3]);
  return p.canvas();
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
const HERO_PAL = P({ r: '#d03030', q: '#f05a48', Q: '#ff9a80', R: '#8a1a22', S: '#eef3fa', W: '#ffffff', s: '#b8c2d8', m: '#7c86a6', M: '#4a5272', k: '#1c1430', E: '#7ae8ff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', b: '#2a6ad8', l: '#4aa0f0', B: '#1a3c8a', v: '#b42c34', V: '#d24840', c: '#6a1424', d: '#4a2c18', h: '#6e4426' });
const HERO_ROWS = ['....rQ....', '...rqqR...', '...sSSm...', '..sSWSsm..', '..kEkkEk..', '..mssmmM..', '.gGgbbgyY.', 'vsSblbbBmc', 'vmsbgbbBMc', '.cyyGyyYc.', '..BbbbbB..', '..mM..mM..', '..hd..hd..'];
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

// a fishing boat (moored at the piers) and the merchant's covered cart (rolls along the roads)
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
// travellers on foot: a head, a tunic, legs in stride
const WALKER_FRAMES = [
  ['.s.', 'tTt', '.T.', 'l.l'],
  ['.s.', 'tTt', '.T.', '.l.'],
];
const WALKER_TUNICS: Array<[string, string]> = [
  ['#4a9a48', '#2e6a30'],
  ['#3a6ad0', '#22408a'],
  ['#c8743a', '#8a4a20'],
  ['#b04a8a', '#7a2a5a'],
];

// gulls (wings up, level), and crows over the forests
const BIRD_PAL = P({ W: '#ffffff', w: '#c8d0e0' });
const BIRD_FRAMES = [
  ['W...W', '.W.W.', '..w..'],
  ['.....', 'WWwWW', '.....'],
];
const CROW_PAL = P({ W: '#2a2236', w: '#4a405a' });

/** The windmill's four sails (a lattice spar with the cloth on its trailing side): + and x. */
function millSails(diag: boolean): HTMLCanvasElement {
  const n = 11;
  const cc = 5;
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
      g[cc + dy * k][cc + dx * k] = 'm';
      if (k >= 2) {
        const x = cc + dx * k + ox;
        const y = cc + dy * k + oy;
        if (x >= 0 && y >= 0 && x < n && y < n && g[y][x] === '.') g[y][x] = dx + dy > 0 || (diag && dx > 0) ? 'W' : 'w';
      }
    }
  }
  g[cc][cc] = 'o';
  return sprite(
    g.map((r) => r.join('')),
    P({ m: '#6e4020', w: '#f4ecd8', W: '#d8ccb4', o: '#2e1a0e' }),
  );
}

/** A standalone sprite texture (transparent, 1px ink outline round it unless `outline` is null). */
function sprite(rows: string[], pal: Record<string, Col>, outline: Col | null = INK): HTMLCanvasElement {
  const p = new Pix(Math.max(...rows.map((r) => r.length)) + 2, rows.length + 2, -1);
  spr(p, rows, pal, 1, 1, outline);
  return p.canvas();
}

// ------------------------------------------------------------------ padlocks and flags

const PADLOCK = ['..SSSs...', '.Ss...sm.', '.Ss...mM.', '.Ss...mM.', 'GGGgggggy', 'gWWggggyY', 'gGggkkgyY', 'gggkkkyyY', 'ggggkgyyY', 'yggggyyYY', '.yyyyyYz.'];
const PADLOCK_SMALL = ['.sSs.', 's...m', 's...m', 'GgggY', 'gWkgY', 'ggkyY', '.yyY.'];
const PADLOCK_PAL: Pal = { S: '#eef3fa', s: '#b8c2d8', m: '#7c86a6', M: '#4a5272', W: '#ffffff', G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', z: '#5a3410', k: '#2a1830' };

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

/** Darkened screen edges: an elliptical vignette in ordered-dither steps of a warm deep purple (screen space). */
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
      let a = Math.min(1, Math.max(0, (r - 0.5) / 0.6));
      a = a * a * (3 - 2 * a);
      // three tones, dithered only where one meets the next
      // (L7: a stronger vignette)
      const q = (level(a, 3, x, y, 0.3) / 3) * 0.55;
      const i = (y * w + x) * 4;
      d[i] = 16;
      d[i + 1] = 8;
      d[i + 2] = 30;
      d[i + 3] = Math.round(q * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ build (painted once, kept across relayouts)

let BUILT: Array<[string, HTMLCanvasElement]> | null = null;
let JOB: Generator<void, void> | null = null;
/** The world map's painting: total ms spent, in how many slices, the longest single step (ms). */
export const WORLD_PAINT = { ms: 0, steps: 0, longest: 0 };

/** Everything the world map needs, painted step by step. */
function* buildSteps(): Generator<void, void> {
  const L = yield* paintWorld();
  yield;
  const out: Array<[string, HTMLCanvasElement]> = [];
  const put = (k: string, cv: HTMLCanvasElement) => out.push([k, cv]);
  put('world_map', L.base);
  L.sea.forEach((cv, i) => put(`wm_sea${i}`, cv));
  L.wind.forEach((cv, i) => put(`wm_wind${i}`, cv));
  put('wm_isle', L.isle.canvas());
  put('wm_isle_veil', L.isleVeil);
  put('wm_lava', L.lava.canvas());
  put('wm_lamp', L.lamp.canvas());
  for (const [id, cv] of Object.entries(L.veils)) put(`wm_veil_${id}`, cv);
  for (const [id, cv] of Object.entries(L.drafts)) put(`wm_draft_${id}`, cv);
  put('wm_compass', compassRose());
  put('wm_rim', L.rim);
  yield;
  const far = yield* paintFarSea();
  put('wm_farsea', far.base);
  far.waves.forEach((cv, i) => put(`wm_farwave${i}`, cv));
  yield;
  paintLands(put);
  put('wm_vignette', vignette(327, 150));
  CLOUD_SHAPES.forEach((bl, i) => {
    const floor = Math.max(...bl.map((b) => b.y)) + 1.5;
    const m = massSprite(bl, { ramp: CLOUD, seed: 201 + i, bump: 0.12, tex: 0.12, vgrad: 0.35, light: 0.16, shadow: 0.18, band: 0.5, floor });
    put(`wm_cloud${i}`, m.img);
    put(`wm_cloudsh${i}`, m.sil);
  });
  SHADOW_SHAPES.forEach((bl, i) => put(`wm_shadow${i}`, massSprite(bl, { ramp: CLOUD, seed: 221 + i, bump: 0.18, tex: 0 }).sil));
  const smoke = ramp('#3a3442', '#5a5466', '#7e788a', '#a8a2b2', '#cac6d2');
  PUFF_SHAPES.forEach((bl, i) => put(`wm_puff${i}`, massSprite(bl, { ramp: smoke, seed: 231 + i, bump: 0.2, tex: 0.1, vgrad: 0.4, light: 0.1, outline: col('#2a2432'), shadow: 0.2 }).img));
  const steam = ramp('#a8a8b8', '#c8c8d4', '#e4e4ec', '#ffffff');
  PUFF_SHAPES.forEach((bl, i) => put(`wm_steam${i}`, massSprite(bl, { ramp: steam, seed: 241 + i, bump: 0.2, tex: 0.1, vgrad: 0.4, light: 0.12, shadow: 0.15 }).img));
  const mist = ramp('#a8bab8', '#c8d8d4', '#e2ece8');
  FOG_SHAPES.forEach((bl, i) => put(`wm_fog${i}`, massSprite(bl, { ramp: mist, seed: 251 + i, bump: 0.1, tex: 0.1, vgrad: 0.6, light: 0.1, shadow: 0 }).img));
  HERO_FRAMES.forEach((r, i) => put(`wm_hero${i}`, sprite(r, HERO_PAL)));
  PIP_FRAMES.forEach((r, i) => put(`wm_pip${i}`, sprite(r, PIP_PAL)));
  SHIP_FRAMES.forEach((r, i) => put(`wm_ship${i}`, sprite(r, SHIP_PAL)));
  BIRD_FRAMES.forEach((r, i) => put(`wm_bird${i}`, sprite(r, BIRD_PAL)));
  BIRD_FRAMES.forEach((r, i) => put(`wm_crow${i}`, sprite(r, CROW_PAL, null)));
  BOAT_FRAMES.forEach((r, i) => put(`wm_boat${i}`, sprite(r, BOAT_PAL)));
  CART_FRAMES.forEach((r, i) => put(`wm_cart${i}`, sprite(r, CART_PAL)));
  WALKER_TUNICS.forEach(([t, tt], k) => WALKER_FRAMES.forEach((r, i) => put(`wm_walk${k}_${i}`, sprite(r, P({ s: '#f2b888', t, T: tt, l: '#4a2c18' })))));
  put('wm_mill0', millSails(false));
  put('wm_mill1', millSails(true));
  const lock = grid(11, 13);
  stamp(lock, PADLOCK, PADLOCK_PAL, 1, 1);
  put('padlock', toCanvas(lock));
  const small = grid(7, 9);
  stamp(small, PADLOCK_SMALL, PADLOCK_PAL, 1, 1);
  put('wm_lock', toCanvas(small));
  FLAG_FRAMES_ROWS.forEach((r, i) => {
    put(`flag_on${i}`, sprite(r, FLAG_ON));
    put(`flag_off${i}`, sprite(r, FLAG_OFF));
  });
  BUILT = out;
}

/** Whether the world map is painted (its textures can be handed over). */
export const worldArtReady = (): boolean => !!BUILT;

/** Paint more of the world map, for about `budgetMs` (whole steps); true once it's all painted. */
export function paintWorldSlice(budgetMs: number): boolean {
  if (BUILT) return true;
  JOB ??= buildSteps();
  const t0 = performance.now();
  for (;;) {
    const s0 = performance.now();
    const r = JOB.next();
    const d = performance.now() - s0;
    WORLD_PAINT.ms += d;
    WORLD_PAINT.steps++;
    WORLD_PAINT.longest = Math.max(WORLD_PAINT.longest, d);
    if (r.done) return true;
    if (performance.now() - t0 >= budgetMs) return false;
  }
}

/** Hand the world map's textures to `add`, painting whatever is still to paint first. */
export function buildWorldArt(add: Add): void {
  while (!paintWorldSlice(1e9));
  for (const [k, cv] of BUILT!) add(k, cv);
}
