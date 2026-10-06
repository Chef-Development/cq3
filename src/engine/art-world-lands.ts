// The kingdom's world map, part three: the lands that open up as the story goes on. The second region's act
// landmarks stand on its painted mountains (art-world.ts, art-world-sites.ts); this adds what marks them once its
// veil lifts: prayer flags strung across the pass by the frozen falls, a cave mouth under the crag above the frozen
// lake (crystals glint inside), and the wyrm circling her keep. Out in the far sea past the continent's east coast
// (art-world.ts paints that strip, FAR_SEA_W) lie the seven lands still to come (core/world-plan.ts): hazy island
// silhouettes, each under a fog bank that thins as weights come home. All of it is small textures painted once with
// the rest of the world map; the view (view/world.ts) places them, fades the fog and animates the glints.
import { col, hash, mass, mix, noise, pick, Pix, ramp, rgba32, rng, wordCanvas, type Blob } from './backdrop';
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
const FOG = ramp('#8c9cbe', '#aebcd8', '#cfdaec', '#eaf0fa');
const FOG_EDGE = col('#7e8eb2');
const HAZE = col('#b8c6e2');

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

/** A far land's fog bank: a haze over all of it (dithered steps, thinner at the edges), and banks of cloud along its
 *  waterline and across its middle, leaving its heights showing through. */
function farFog(f: FarIsle, seed: number): HTMLCanvasElement {
  const { w, h } = f.fog;
  const r = rng(seed);
  const cl = new Pix(w, h, -1);
  const blobs: Blob[] = [];
  for (let x = 3 + r() * 3; x < w - 3; x += 5 + r() * 4) blobs.push({ x, y: h - 5 - r() * 2.5, rx: 3 + r() * 2.6, ry: 1.8 + r() * 1.2 });
  const midY = 4 + f.box.h * (0.62 + r() * 0.14);
  for (let x = w * (0.15 + r() * 0.15); x < w * (0.6 + r() * 0.3); x += 4 + r() * 4) blobs.push({ x, y: midY + (r() - 0.5) * 2, rx: 2.4 + r() * 2, ry: 1.3 + r() * 0.8 });
  mass(cl, blobs, { ramp: FOG, seed, bump: 0.14, tex: 0.1, vgrad: 0.45, light: 0.12, shadow: 0.18, band: 0.5, outline: FOG_EDGE });
  return wordCanvas(w, h, (u) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cl.buf[i] >= 0) {
          u[i] = rgba32(cl.buf[i], 235);
          continue;
        }
        const dx = (x + 0.5 - w / 2) / (w / 2);
        const dy = (y + 0.5 - h * 0.58) / (h * 0.58);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1) continue;
        const q = (1 - d) * 1.6 - hash(x, y, seed) * 0.35;
        const a = q > 0.8 ? 0.24 : q > 0.45 ? 0.16 : q > 0.15 ? 0.09 : 0;
        if (a) u[i] = rgba32(mix(HAZE, FOG[3], noise(x * 0.2, y * 0.3, seed) * 0.6), Math.round(a * 255));
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
}
