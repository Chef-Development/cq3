// The kingdom's world map, part three: the lands that open up as the story goes on. The second region's act
// landmarks stand on its painted mountains (art-world.ts, art-world-sites.ts); this adds what marks them once its
// veil lifts: prayer flags strung across the pass by the frozen falls, a cave mouth under the crag above the frozen
// lake (crystals glint inside), and the wyrm circling her keep. The third region's (not drawn while its veil is up):
// the road-roller's half-paved road on the plain west of the volcano, a cave mouth
// in the volcano's flank glowing with coloured glass, and the black forge on the crater's rim, a glowing chain slung
// across the crater (WORLD_ACTS_ASH: their places, acts 6-8 of WORLD_ACTS). Out in the far sea past the continent's east coast
// (art-world.ts paints that strip, FAR_SEA_W) lie the seven lands still to come (core/world-plan.ts): hazy island
// silhouettes, each under a fog bank that thins as weights come home. All of it is small textures painted once with
// the rest of the world map; the view (view/world.ts) places them, fades the fog and animates the glints.
import { col, hash, mix, noise, pick, Pix, ramp, rgba32, wordCanvas } from './backdrop';

/** The blank's vellum (art-world-atlas.ts FOG): paper, its lighter mottle, the impression of a line. */
const PAPER = ['#a09488', '#ac9f92', '#8c8078'].map(col);
import { INK, P, spr } from './art-world-sites';

type Add = (key: string, c: HTMLCanvasElement) => void;
type Box = { x: number; y: number; w: number; h: number };
type Pt = [number, number];

// ------------------------------------------------------------------ the far lands beyond the sea

export type FarKind = 'peaks' | 'mesa' | 'spire' | 'hills' | 'twin' | 'crater' | 'ridge';

/** A far land (world px): its silhouette's box (bottom = the waterline) and its fog bank's box, a little bigger. */
export interface FarIsle {
  id: string; // core/world-plan.ts FAR_PLAN
  kind: FarKind;
  box: Box;
  fog: Box;
}

const far = (id: string, cx: number, waterline: number, w: number, h: number, kind: FarKind): FarIsle => {
  const x = Math.round(cx - w / 2);
  const y = waterline - h;
  return { id, kind, box: { x, y, w, h }, fog: { x: x - 10, y: y - 4, w: w + 20, h: h + 10 } };
};

/** The seven far lands, scattered down the far sea east of the continent (x 960-1120), clear of the cloud band
 *  along the top and of each other's fog. */
export const FAR_ISLES: FarIsle[] = [
  far('far6', 996, 68, 44, 21, 'peaks'),
  far('far7', 1076, 44, 48, 18, 'mesa'),
  far('far8', 1060, 110, 36, 21, 'spire'),
  far('far9', 992, 154, 38, 16, 'hills'),
  far('far10', 1082, 188, 40, 19, 'twin'),
  far('far11', 1008, 236, 36, 19, 'crater'),
  far('far12', 1070, 280, 46, 16, 'ridge'),
];

const FAR_BODY = ramp('#3a5276', '#486288', '#587498', '#6886a8', '#7c98ba');
const FAR_LIT = col('#a0b6d4');
const FAR_RIM = col('#c4d4ea');
const FAR_SHORE = col('#b8d0e6');

/** How high a far land stands above the waterline at column x (0..w-1), by its kind. */
function relief(kind: FarKind, x: number, w: number, H: number, seed: number): number {
  const u = (x + 0.5) / w;
  const end = Math.min(1, Math.min(u, 1 - u) * 6); // the shores slope into the sea
  const bump = (c: number, hw: number, hgt: number) => Math.max(0, 1 - Math.abs(u - c) / hw) * hgt;
  let v: number;
  switch (kind) {
    case 'peaks':
      v = Math.max(H * 0.25, bump(0.28, 0.2, H * 0.72), bump(0.52, 0.22, H), bump(0.76, 0.17, H * 0.6));
      break;
    case 'mesa':
      v = u > 0.2 && u < 0.7 ? H * 0.82 - (u > 0.42 && u < 0.46 ? 2 : 0) : Math.max(H * 0.22, bump(0.2, 0.08, H * 0.8), bump(0.7, 0.12, H * 0.82), bump(0.84, 0.12, H * 0.42));
      break;
    case 'spire':
      v = Math.max(H * 0.3 + Math.sin(u * 9) * 1.5, bump(0.62, 0.07, H), bump(0.38, 0.16, H * 0.5));
      break;
    case 'hills':
      v = H * 0.42 + Math.sin(u * 11 + 1) * H * 0.2 + bump(0.45, 0.3, H * 0.4);
      break;
    case 'twin':
      v = Math.max(H * 0.2, bump(0.32, 0.22, H), bump(0.68, 0.2, H * 0.86));
      break;
    case 'crater': {
      const cone = bump(0.5, 0.42, H);
      v = cone > H * 0.84 ? H * 0.84 - (cone - H * 0.84) * 0.8 : Math.max(H * 0.18, cone);
      break;
    }
    case 'ridge':
      v = Math.max(H * 0.2, u < 0.78 ? H * (0.25 + 0.75 * (u / 0.78) ** 1.4) : H * (1 - (u - 0.78) * 3.4));
      break;
  }
  v += (noise(x * 0.45, 1, seed) - 0.5) * 2.2;
  return Math.max(0, Math.min(H, v * end));
}

/** A far land's silhouette: hazy blue, the slopes facing the light (top left) picked out, a pale line of surf. */
function farIsle(f: FarIsle, seed: number): HTMLCanvasElement {
  const { w, h } = f.box;
  const p = new Pix(w, h, -1);
  const H = h - 2;
  const hs = Array.from({ length: w }, (_, x) => Math.round(relief(f.kind, x, w, H, seed)));
  const wl = h - 1; // the waterline row
  for (let x = 0; x < w; x++) {
    const top = wl - hs[x];
    const lit = (hs[x - 1] ?? 0) < hs[x] || (hs[x - 1] === hs[x] && (hs[x - 2] ?? 0) < hs[x]);
    for (let y = top; y < wl; y++) {
      const t = (y - top) / Math.max(1, hs[x]);
      let v = 0.62 - t * 0.35 + (lit ? 0.25 : -0.1) + (hash(x, y, seed) - 0.5) * 0.12;
      if (noise(x * 0.3, y * 0.5, seed + 5) > 0.7) v -= 0.18; // a gully, a shadowed fold
      p.set(x, y, pick(FAR_BODY, v, x, y, 0.4));
    }
    if (hs[x] > 0) p.set(x, top, lit ? FAR_RIM : FAR_LIT);
    if (lit && hs[x] > 2) p.set(x, top + 1, mix(FAR_LIT, FAR_BODY[4], 0.4));
    // the surf breaking on its shore
    if (hs[x] > 0 && hash(x, 7, seed) > 0.35) p.set(x, wl, FAR_SHORE);
  }
  return p.canvas();
}

/** A far land erased (the Atlas's blank, docs/story-bible.md section 9): a patch of white-grey vellum over all of it,
 *  its edge rubbed ragged (stepped and dithered), keeping only the faint impression of its old waterline and heights. */
function farFog(f: FarIsle, seed: number): HTMLCanvasElement {
  const { w, h } = f.fog;
  const ox = f.box.x - f.fog.x;
  const oy = f.box.y - f.fog.y;
  // the impression: the land's own outline (its relief), pressed in a shade darker than the paper
  const hs = Array.from({ length: f.box.w }, (_, x) => Math.round(relief(f.kind, x, f.box.w, f.box.h - 2, seed - 40)));
  const wl = oy + f.box.h - 1;
  return wordCanvas(w, h, (u) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const dx = (x + 0.5 - w / 2) / (w / 2);
        const dy = (y + 0.5 - h * 0.58) / (h * 0.58);
        const d = Math.sqrt(dx * dx + dy * dy) + (noise(x * 0.25, y * 0.3, seed) - 0.5) * 0.3;
        if (d >= 1) continue;
        // stepped toward the edge: solid, a dithered half, a sparse quarter
        if (d > 0.82 && hash(x, y, seed) > (d > 0.92 ? 0.25 : 0.5)) continue;
        let c = noise(x * 0.08, y * 0.1, seed + 3) > 0.55 ? PAPER[1] : PAPER[0];
        const lx = x - ox;
        if (lx >= 0 && lx < hs.length && hs[lx] > 0 && (y === wl - hs[lx] || y === wl)) c = PAPER[2];
        u[i] = rgba32(c);
      }
  });
}

// ------------------------------------------------------------------ the second region's act landmarks

/** Where the second region's landmark sprites stand (world px, the textures' top-left), once its veil lifts. */
export const FROST_SIGHTS = {
  /** prayer flags across the pass, by the frozen falls (Act 4's landmark) */
  prayer: { x: 444, y: 57 },
  /** the cave mouth under the crag above the frozen lake (Act 5's) */
  cave: { x: 650, y: 59 },
  /** crystals glinting inside the cave (world px) */
  glints: [
    [654, 64],
    [659, 66],
    [656, 67],
  ] as Pt[],
  /** the wyrm circling over her keep (Act 6's): the loop's centre and radii */
  wyrm: { x: 568, y: 33, rx: 22, ry: 5 },
};

const PRAYER_COLS = ['#d03a30', '#f2c230', '#4cb050', '#3a72d8', '#eef3fa'].map(col);

/** Prayer flags on a sagging rope between two posts (two frames: the cloth flutters). */
function prayerFlags(f: number): HTMLCanvasElement {
  const w = 26;
  const h = 10;
  const p = new Pix(w, h, -1);
  const post = col('#4a3426');
  for (let y = 1; y < h; y++) {
    p.set(0, y, post);
    p.set(w - 1, y, post);
  }
  const ropeY = (x: number) => 1 + Math.round(Math.sin((x / (w - 1)) * Math.PI) * 3);
  for (let x = 1; x < w - 1; x++) p.set(x, ropeY(x), col('#3a2c22'));
  for (let k = 0, x = 3; x < w - 3; x += 4, k++) {
    const c = PRAYER_COLS[k % PRAYER_COLS.length];
    const y = ropeY(x) + 1;
    const lean = (k + f) % 2;
    p.set(x, y, c);
    p.set(x + 1, y, c);
    p.set(x + lean, y + 1, c);
    p.set(x + 1 + lean, y + 1, mix(c, INK, 0.25));
    p.set(x + lean, y + 2, mix(c, INK, 0.15));
  }
  return p.canvas();
}

const CAVE_ROWS = ['....mmmmm....', '..mmsSSSsmm..', '.mskkkkkkksm.', 'mskWkkWkWkksm', 'mskkWkkkWkksm', 'mskkkKkkkkksm', 'mskkKbKkKbksm', 'mskkkKKKKkksm', 'wwwwwwwwwwwww'];
const CAVE_PAL = P({ m: '#4a5474', s: '#76809e', S: '#98a2bc', k: '#0c1220', K: '#16284a', b: '#5ad0ff', W: '#eef8ff', w: '#e4ecf8' });

// the wyrm in flight, head to the left: wings raised, then swept down
const WYRM_ROWS = [
  ['......W.....W........', '.....WWw...WWw.......', '....WWww..WWww.......', '...WWwwb.WWwwb.......', 'hh..bbbbbbbbbbbt.....', 'eHbbbbbBBBbbbbbtt....', '.h....bb..bb....ttt..', '...................t.'],
  ['.....................', '.....................', '.....................', 'hh..bbbbbbbbbbbt.....', 'eHbbbbbBBBbbbbbtt....', '.h.wwwbb.wwwbb..ttt..', '...WWwww.WWwww.....t.', '....WWw...WWw........'],
];
const WYRM_PAL = P({ b: '#5a8ad8', B: '#b0d4f8', h: '#7aa8e8', H: '#8ab8ec', e: '#e8fbff', w: '#9cc8f4', W: '#e0f0ff', t: '#4a76c4' });

// ------------------------------------------------------------------ the third region's act landmarks

type ActSpot = { x: number; y: number; box: Box; stand: Pt; flag: Pt; view: Pt };

/**
 * The third region's three acts as world-map landmarks, by global act index 6-8 (the same shape as WORLD_ACTS'
 * entries: the landmark's centre and tap box, where Rowan stands, where its flag flies, the view the map opens on).
 * art-world.ts appends them to WORLD_ACTS; its land opens with core/world-plan.ts landOpen.
 */
export const WORLD_ACTS_ASH: ActSpot[] = [
  // the road-roller's half-paved road, where the road from the heartland comes into the ash
  { x: 750, y: 157, box: { x: 734, y: 147, w: 32, h: 20 }, stand: [730, 152], flag: [764, 150], view: [768, 140] },
  // a cave mouth in the volcano's west flank, glowing with coloured glass
  { x: 788, y: 101, box: { x: 778, y: 91, w: 22, h: 20 }, stand: [774, 112], flag: [794, 90], view: [790, 104] },
  // the black forge on the crater's rim
  { x: 803, y: 26, box: { x: 792, y: 14, w: 24, h: 22 }, stand: [786, 44], flag: [816, 18], view: [806, 70] },
];

/**
 * The fourth region's three acts, by global act index 9-11, on what its land already shows (art-world.ts stageDusk):
 * the drowned arch in its pool (the lantern-lit fen), the stilt village on its boardwalks (the half-sunk causeway), the
 * lighthouse's lamp in the middle (the mere). Placeholders for the art team: move them with the landmarks they draw.
 */
export const WORLD_ACTS_DUSK: ActSpot[] = [
  // the drowned arch in its black pool, the fen's wisps round it
  { x: 779, y: 254, box: { x: 766, y: 244, w: 26, h: 20 }, stand: [762, 262], flag: [792, 246], view: [770, 252] },
  // the stilt village on its boardwalks, the causeway's half-sunk road
  { x: 626, y: 254, box: { x: 604, y: 240, w: 44, h: 28 }, stand: [600, 264], flag: [648, 240], view: [626, 250] },
  // the lighthouse wading in the mere
  { x: 708, y: 234, box: { x: 699, y: 222, w: 20, h: 28 }, stand: [694, 252], flag: [718, 222], view: [708, 240] },
];

/**
 * The fifth region's three acts, by global act index 12-14, on the floating island (NOON_BOX in art-world.ts): the white
 * road at its foot, the spire's steps, the great sundial on top. Placeholders for its art; in WORLD_ACTS only while the
 * region is in play (src/data/flags.ts).
 */
export const WORLD_ACTS_NOON: ActSpot[] = [
  { x: 906, y: 128, box: { x: 896, y: 120, w: 22, h: 16 }, stand: [892, 134], flag: [916, 120], view: [900, 110] },
  { x: 914, y: 100, box: { x: 904, y: 90, w: 22, h: 18 }, stand: [900, 106], flag: [924, 92], view: [904, 96] },
  { x: 918, y: 70, box: { x: 906, y: 58, w: 24, h: 22 }, stand: [902, 78], flag: [928, 60], view: [906, 82] },
];

/** Where the third region's landmark sprites stand (world px, the textures' top-left), once its veil lifts. */
export const ASH_SIGHTS = {
  /** the half-paved road, its barrier and the road-roller curled up on it (the region's first act) */
  road: { x: 737, y: 151 },
  /** the glowing cave mouth in the flank */
  cave: { x: 781, y: 95 },
  /** coloured glass glinting inside the cave (world px) */
  glints: [
    [785, 101],
    [790, 103],
    [787, 104],
    [792, 101],
  ] as Pt[],
  /** the black forge on the rim (two frames: its furnace breathes) */
  forge: { x: 797, y: 21 },
  /** the chain slung across the crater, from the forge's top to the far rim (world px) */
  chain: { a: [806, 24] as Pt, b: [823, 33] as Pt, sag: 4 },
};

// the road's paving laid from the citadel's end up toward the heartland, stopping short at a barrier
const ROAD_ROWS = [
  'wwoo.....................',
  'ywwOoSsSsS...............',
  '.wwooSsSsSssSsSsS........',
  'd..dSsSsSsSsSsSsSsSsS....',
  '....SsSsSsSsSsSsSsSsssS..',
  '....sSsSsSsSsSsSsSsSsSsSs',
  '.....mmmmmmmmmmmmmmmmmmm.',
];
const ROAD_PAL = P({ S: '#6a5e6a', s: '#3e3644', m: '#1a1620', o: '#f27a1c', O: '#ffb05a', w: '#f4ece0', y: '#b8aaa0', d: '#5a3a26' });
// the road-roller himself, curled into a ball at the end of his road, his cauldron on top
const ROLLER_ROWS = ['..kkk..', '.kIIIk.', 'bbBbBbb', 'bBbBbBb', 'bbBbBbb', '.bbbbb.'];
const ROLLER_PAL = P({ k: '#2a2830', I: '#6a6872', b: '#4c4a54', B: '#827c86' });
const GCAVE_ROWS = ['....mmmmm....', '..mmsSSSsmm..', '.mskkkkkkksm.', 'mskaKkgKvkksm', 'mskkAkkGkVksm', 'mskkkkkkkkksm', 'mskkqkkkqkksm', 'mskkkqqqkkksm', 'wwwwwwwwwwwww'];
const GCAVE_PAL = P({ m: '#2a2026', s: '#4a3c44', S: '#6a5a60', k: '#0e0810', a: '#c06a14', A: '#ffd070', g: '#1e8a48', G: '#9ae89a', v: '#6a32a8', V: '#c89aff', q: '#8a2a14', K: '#3a1a10', w: '#3a2a28' });
// the black forge on the rim: a squat tower, battlements, a slit window and its furnace door glowing
const FORGE_ROWS = [
  [
    '.b.b.b....',
    '.bbbbbb...',
    '.bBbbbbm..',
    '.bBbYbbm..',
    '.bBbbbbm..',
    'bbBbbbbbm.',
    'bBbbXXbbm.',
    'bBbXZZXbm.',
    'bBbXZZXbmm',
  ],
  [
    '.b.b.b....',
    '.bbbbbb...',
    '.bBbbbbm..',
    '.bBbXbbm..',
    '.bBbbbbm..',
    'bbBbbbbbm.',
    'bBbbxxbbm.',
    'bBbxXXxbm.',
    'bBbxXXxbmm',
  ],
];
const FORGE_PAL = P({ b: '#2e2630', B: '#4a3e48', m: '#140e14', x: '#e0501c', X: '#ffb040', Z: '#fff4b8', Y: '#ffd070' });

/** The far lands' silhouettes and fog banks, the second region's landmark sprites. */
export function paintLands(put: Add): void {
  FAR_ISLES.forEach((f, i) => {
    put(`wm_far_${f.id}`, farIsle(f, 811 + i * 17));
    put(`wm_farfog_${f.id}`, farFog(f, 851 + i * 13));
  });
  put('wm_prayer0', prayerFlags(0));
  put('wm_prayer1', prayerFlags(1));
  const cave = new Pix(15, 11, -1);
  spr(cave, CAVE_ROWS, CAVE_PAL, 1, 1);
  put('wm_cave', cave.canvas());
  WYRM_ROWS.forEach((rows, i) => {
    const p = new Pix(23, 10, -1);
    spr(p, rows, WYRM_PAL, 1, 1);
    put(`wm_wyrm${i}`, p.canvas());
  });
  // the third region's (drawn only once its veil lifts)
  const road = new Pix(26, 9, -1);
  spr(road, ROAD_ROWS, ROAD_PAL, 1, 1);
  spr(road, ROLLER_ROWS, ROLLER_PAL, 17, 0);
  put('wm_ashroad', road.canvas());
  const gcave = new Pix(15, 11, -1);
  spr(gcave, GCAVE_ROWS, GCAVE_PAL, 1, 1);
  put('wm_glasscave', gcave.canvas());
  FORGE_ROWS.forEach((rows, i) => {
    const p = new Pix(12, 11, -1);
    spr(p, rows, FORGE_PAL, 1, 1);
    put(`wm_forge${i}`, p.canvas());
  });
}
