// The camp's upgrades as objects in the camp (docs/ui-style.md "Camp upgrades"): each one a painted object at its own
// spot in the clearing, there for good once it's built, and a "ghost" of it (a pale blueprint outline) at that spot
// before. Painted the first time the camp shows (`ensureCampBuildArt`), never at boot. Lit like the rest of the camp:
// moonlight from the top left, the fire's warmth on the side facing it.
//
// Textures (bottom-centre on their BUILD_SPOTS point, like the camp's props; the charm hangs from its point instead):
//   cb_perch            the Companion Perch: a post with a round platform (the second companion sits on top,
//                       PERCH_SEAT px above its foot), a rope wrap, a seed cup
//   cb_lucky0/1         the Lucky Stone: a mossy boulder with a carved clover glowing green (frame 1 brighter)
//   cb_charm0..3        the Reroll Charm: a carved die on a cord, turning (face, edge, face, edge), a red tassel
//   cb_wartable         the War Table: a trestle table, a campaign map pinned with flags, a dagger in it
//   cb_maptable         the Map Table: a small table, an unrolled map, a scroll, a lantern
//   <key>_ghost         each one's blueprint (outline and a faint hatched fill, white: tint it)
import type Phaser from 'phaser';
import type { CampUpgradeId } from '../data/meta';
import { grid, put, stamp, toCanvas, type Grid } from './art';
import { ell, fill, rect, tone, type Inside } from './art-paint';

/** Where each upgrade stands in the camp (bottom-centre, camp backdrop px), the charm's hook instead. */
export const BUILD_SPOTS: Record<CampUpgradeId, { x: number; y: number }> = {
  perch: { x: 86, y: 110 },
  luckyStone: { x: 35, y: 112 },
  warTable: { x: 258, y: 111 },
  rerollCharm: { x: 67, y: 60 },
  dummy: { x: 289, y: 127 },
  mapTable: { x: 172, y: 96 },
};

/** How far above the perch's foot its platform is (where the companion's feet go). */
export const PERCH_SEAT = 39;

/** Each upgrade's object texture (its first frame), for the ghost and the tap area. */
export const BUILD_KEY: Record<CampUpgradeId, string> = {
  perch: 'cb_perch',
  luckyStone: 'cb_lucky0',
  warTable: 'cb_wartable',
  rerollCharm: 'cb_charm0',
  dummy: 'dummy_idle0',
  mapTable: 'cb_maptable',
};

const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
const STONE = ['#16151f', '#24242f', '#363744', '#4c4e5a', '#666874', '#868894', '#a8a8b0'];
const MOSS = ['#122218', '#1a3222', '#26482c', '#386236', '#527e40', '#7aa84a'];
const PAPER = ['#8a6a44', '#c0a070', '#e0c896', '#f4e4bc'];
const ROPE = ['#5a4024', '#8a6a3a', '#c0a060'];
const IRON = ['#141420', '#22222e', '#363846', '#525668', '#7a8094', '#b4bccc'];

function sprite(w: number, h: number, paint: (g: Grid) => void): HTMLCanvasElement {
  const g = grid(w, h);
  paint(g);
  return toCanvas(g);
}

/** The Companion Perch: a tall post planted in a little mound (the companion sits up high, over the tent's shoulder),
 *  a round platform on top, a rope wrap and a seed cup. */
function perch(): HTMLCanvasElement {
  const W = 22;
  const H = 43;
  return sprite(W, H, (g) => {
    const cx = 11;
    const base = H - 2;
    // the mound and a brace either side of the foot
    fill(g, (x, y) => y >= base - 2 && y <= base && Math.abs(x + 0.5 - cx) <= 6 - (base - y) * 1.5, (x, y) => (y === base - 2 || x < cx - 3 ? '#4a382c' : '#2a1f1e'));
    for (let k = 0; k < 4; k++) {
      put(g, cx - 2 - k, base - 3 - k * 1.2 + 4, WOOD[2]);
      put(g, cx + 2 + k, base - 3 - k * 1.2 + 4, WOOD[1]);
    }
    // the post: three px, lit on its left, warm on its right (the fire is to the right)
    for (let y = 5; y < base - 1; y++) {
      put(g, cx - 1, y, WOOD[4]);
      put(g, cx, y, y % 6 === 3 ? WOOD[2] : WOOD[3]);
      put(g, cx + 1, y, '#a8683a');
    }
    // the rope wrapped round the post, and a peg to climb by
    put(g, cx - 3, 26, WOOD[4]);
    put(g, cx - 2, 26, WOOD[3]);
    for (let y = 12; y < 17; y++) {
      put(g, cx - 1, y, y % 2 ? ROPE[2] : ROPE[1]);
      put(g, cx, y, y % 2 ? ROPE[1] : ROPE[2]);
      put(g, cx + 1, y, ROPE[0]);
    }
    // the platform: a round slab seen a little from above
    fill(g, ell(cx, 4, 9.5, 2.6), (x, y) => (y < 3 ? WOOD[5] : y === 3 ? WOOD[4] : tone(WOOD, 0.55 + (x - cx) * 0.02)));
    fill(g, rect(cx - 9, 5, cx + 9, 6), (x, y) => (y === 6 ? WOOD[1] : x < cx ? WOOD[3] : WOOD[2]));
    // rings on the slab's top
    for (const x of [cx - 4, cx + 3]) put(g, x, 3, WOOD[3]);
    // a little seed cup hanging off the platform's edge
    put(g, cx + 8, 7, ROPE[1]);
    put(g, cx + 8, 8, ROPE[1]);
    stamp(g, ['WWW', 'wsw', '.w.'], { W: '#c0c8d8', w: '#7a8094', s: '#e0c060' }, cx + 7, 9);
  });
}

/** The Lucky Stone: a mossy round boulder with a carved four-leaf clover that glows (frame 1 brighter). */
function luckyStone(f: number): HTMLCanvasElement {
  const W = 18;
  const H = 14;
  return sprite(W, H, (g) => {
    const cx = 9;
    const cy = 8;
    const body: Inside = (x, y) => ((x + 0.5 - cx) / 8) ** 2 + ((y + 0.5 - cy) / 5.6) ** 2 <= 1 && y <= H - 2;
    fill(g, body, (x, y) => {
      const lit = 0.8 - (x + 0.5 - cx) / 14 - (y + 0.5 - cy) / 9;
      return tone(STONE, lit + ((x * 7 + y * 3) % 9 === 0 ? -0.12 : 0));
    });
    // moss over its crown (the moonlit side)
    fill(g, (x, y) => body(x, y) && y < cy - 2 + Math.round(Math.sin(x * 1.3) * 1.2) && x < cx + 4, (x, y) => tone(MOSS, 0.85 - (y - 2) * 0.12 - (x > cx ? 0.2 : 0)));
    // the carved clover: four leaves round a centre, glowing
    const glowC = f ? ['#d8ffb0', '#8af06a', '#4cbf44'] : ['#b4f070', '#5ad848', '#2e8a34'];
    stamp(g, ['.a.a.', 'abcba', '.cdc.', 'abcba', '.a.a.'], { a: glowC[2], b: glowC[1], c: glowC[1], d: glowC[0] }, cx - 3, cy - 2);
    // a few small white flowers at its foot
    for (const [x, y] of [
      [2, 12],
      [15, 12],
      [4, 13],
    ])
      put(g, x, y, '#f0f0e0');
  });
}

/** The Reroll Charm: a cord, a knot, a carved die turning (4 frames), a red tassel. */
function charm(f: number): HTMLCanvasElement {
  const W = 9;
  const H = 18;
  return sprite(W, H, (g) => {
    const cx = 4;
    for (let y = 0; y < 5; y++) put(g, cx, y, y % 2 ? ROPE[1] : ROPE[2]);
    put(g, cx, 5, '#c04030');
    // the die: a face (pips), the edge-on (two faces in perspective), the other face, the other edge
    const IVORY = ['#8a7a68', '#c8b89c', '#eee2c6', '#fffaf0'];
    if (f % 2 === 0) {
      fill(g, rect(cx - 3, 6, cx + 3, 12), (x, y) => (y === 6 || x === cx - 3 ? IVORY[3] : y === 12 || x === cx + 3 ? IVORY[1] : IVORY[2]));
      const pips = f === 0 ? [[cx, 9]] : [[cx - 2, 7], [cx, 9], [cx + 2, 11]];
      for (const [x, y] of pips) put(g, x, y, '#c03030');
    } else {
      fill(g, rect(cx - 2, 6, cx + 2, 12), (x, y) => (x < cx ? (y === 6 ? IVORY[3] : IVORY[2]) : y === 6 ? IVORY[2] : IVORY[1]));
      put(g, cx - 1, 8, '#c03030');
      put(g, cx + 1, 10, '#8a2020');
    }
    // the tassel
    put(g, cx, 13, '#c04030');
    for (let y = 14; y < 17; y++) {
      put(g, cx - 1, y, '#a02a20');
      put(g, cx, y, '#e0503c');
      put(g, cx + 1, y, '#a02a20');
    }
  });
}

/** The War Table: a trestle table with a campaign map pinned with flags and a dagger stuck in it. */
function warTable(): HTMLCanvasElement {
  const W = 28;
  const H = 18;
  return sprite(W, H, (g) => {
    const top = 7;
    // the X legs
    for (let k = 0; k < 9; k++) {
      for (const lx of [5, W - 7]) {
        put(g, lx - 2 + Math.round(k * 0.5), top + 2 + k, WOOD[2]);
        put(g, lx + 2 - Math.round(k * 0.5), top + 2 + k, WOOD[1]);
      }
    }
    put(g, 4, H - 2, WOOD[1]);
    put(g, W - 5, H - 2, WOOD[1]);
    // the table top: planks seen a little from above, its front edge lit by the fire on the left
    fill(g, rect(1, top - 3, W - 2, top + 1), (x, y) => (y === top + 1 ? WOOD[1] : y === top ? WOOD[3] : tone(WOOD, 0.6 + (x / W) * -0.2 + ((x + 3) % 7 === 0 ? -0.15 : 0))));
    // the map spread on it, its corners pinned
    fill(g, rect(4, top - 3, W - 6, top - 1), (x, y) => (y === top - 3 ? PAPER[3] : (x * 3 + y) % 7 === 0 ? PAPER[1] : PAPER[2]));
    put(g, 9, top - 2, '#5a8a48');
    put(g, 10, top - 2, '#5a8a48');
    put(g, 15, top - 1, '#4a7ab0');
    put(g, 16, top - 2, '#4a7ab0');
    // pin flags: red and blue, standing up off the map
    stamp(g, ['rR', 'k.', 'k.'], { r: '#e0463c', R: '#ff8a7a', k: '#3a2a20' }, 8, top - 6);
    stamp(g, ['bB', 'k.', 'k.'], { b: '#3a7ac0', B: '#8ac8ff', k: '#3a2a20' }, 13, top - 7);
    stamp(g, ['rR', 'k.', 'k.'], { r: '#e0463c', R: '#ff8a7a', k: '#3a2a20' }, 18, top - 6);
    // the dagger stuck in the corner
    stamp(g, ['.S', '.S', 'hH', '.h'], { S: IRON[5], h: WOOD[2], H: '#e0b040' }, 21, top - 7);
  });
}

/** The Map Table: a small table, an unrolled map with a red route, a rolled scroll, a lantern glowing on it. */
function mapTable(): HTMLCanvasElement {
  const W = 24;
  const H = 22;
  return sprite(W, H, (g) => {
    const top = 12;
    // four straight legs
    for (let y = top + 2; y < H - 1; y++) {
      put(g, 3, y, WOOD[3]);
      put(g, W - 4, y, WOOD[2]);
      if (y > top + 3) {
        put(g, 6, y - 1, WOOD[1]);
        put(g, W - 7, y - 1, WOOD[1]);
      }
    }
    fill(g, rect(1, top - 2, W - 2, top + 1), (x, y) => (y === top + 1 ? WOOD[1] : y === top ? WOOD[3] : tone(WOOD, 0.62 + (x / W) * 0.15)));
    // the unrolled map with a red dotted route
    fill(g, rect(3, top - 3, 13, top - 1), (_x, y) => (y === top - 3 ? PAPER[3] : PAPER[2]));
    for (const [x, y] of [
      [5, top - 2],
      [7, top - 2],
      [9, top - 1],
      [11, top - 2],
    ])
      put(g, x, y, '#c03a30');
    // the rolled scroll
    fill(g, rect(14, top - 3, 18, top - 2), (_x, y) => (y === top - 3 ? PAPER[3] : PAPER[1]));
    put(g, 18, top - 3, '#a04030');
    // the lantern: a brass cap and handle, a glowing glass body
    stamp(
      g,
      ['..h..', '.h.h.', '.ggg.', 'gWYWg', 'gYwYg', 'gWYWg', '.ggg.'],
      { h: '#5a3a20', g: '#9a6a20', W: '#fff4c8', Y: '#ffd060', w: '#ffffff' },
      W - 9,
      top - 9,
    );
  });
}

/** A blueprint of a sprite: its outline solid, its body a faint diagonal hatch, all white (tint it when drawn). */
export function ghostOf(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const d = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const im = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const edge = !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1);
      const a = edge ? ((x + y) % 4 === 3 ? 120 : 255) : (x + y) % 3 === 0 ? 70 : 22;
      const i = (y * w + x) * 4;
      im.data[i] = 255;
      im.data[i + 1] = 255;
      im.data[i + 2] = 255;
      im.data[i + 3] = a;
    }
  ctx.putImageData(im, 0, 0);
  return c;
}

/** Paint the upgrade objects and their ghosts (once; the dummy's ghost once its frames exist). */
export function ensureCampBuildArt(scene: Phaser.Scene): void {
  const add = (key: string, make: () => HTMLCanvasElement) => {
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, make());
  };
  add('cb_perch', perch);
  add('cb_lucky0', () => luckyStone(0));
  add('cb_lucky1', () => luckyStone(1));
  for (let f = 0; f < 4; f++) add(`cb_charm${f}`, () => charm(f));
  add('cb_wartable', warTable);
  add('cb_maptable', mapTable);
  for (const key of Object.values(BUILD_KEY))
    if (scene.textures.exists(key) && !scene.textures.exists(`${key}_ghost`)) add(`${key}_ghost`, () => ghostOf(scene.textures.get(key).getSourceImage() as HTMLCanvasElement));
}
