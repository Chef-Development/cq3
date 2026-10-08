// The map extras' art (see docs/art-style.md): original sprites built at boot, outlined in ink like the rest.
//   - map scale: the Coin Rush stop (a fat coin sack), the bounty board (a notice pinned to a post board), the secret
//     (a mossy boulder with a crack, and the crack lit), the travelling merchant (a pack as big as she is, a lantern,
//     two walking frames);
//   - fight scale: the Coin Sack itself, a burlap sack tied with a red string, a coin stamped on its belly and a pair
//     of worried eyes. It never fights back; every hit knocks coins out of it.
import { grid, put, stamp, toCanvas, type Grid, type Pal } from './art';

type Add = (key: string, c: HTMLCanvasElement) => void;

const PAL: Pal = {
  k: '#140c1c',
  W: '#ffffff',
  // burlap
  D: '#5a3418',
  b: '#8a5a2e',
  B: '#b07a44',
  c: '#d4a466',
  C: '#ecc888',
  // gold
  y: '#d8901c',
  Y: '#f2c230',
  G: '#fff0a0',
  // the string, a pin, a blush
  r: '#8a1a22',
  R: '#d03030',
  p: '#e88a7a',
  // wood
  d: '#4e2c16',
  h: '#8e5a2e',
  H: '#b07a44',
  j: '#d09a5e',
  // paper
  e: '#fffcf0',
  E: '#d8c8a8',
  // stone and moss
  n: '#4a5272',
  m: '#7c86a6',
  s: '#b8c2d8',
  a: '#2a6a34',
  A: '#4a9a40',
  L: '#7ac850',
  // the glow in the crack
  u: '#62e4d4',
  U: '#d8fff6',
  // the merchant: a teal cloak, a plum pack, her skin and hair
  t: '#1e5050',
  T: '#2c7064',
  q: '#4c967a',
  v: '#4e2a48',
  V: '#7a3e6a',
  w: '#a8608e',
  S: '#f2b888',
  o: '#ffb84a',
};

/** A prop from character rows, outlined (1 px of room each side). */
function prop(rows: string[], pal: Pal = PAL): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const g = grid(w + 2, rows.length + 2);
  stamp(g, rows, pal, 1, 1);
  return toCanvas(g);
}

// ------------------------------------------------------------------ map props

/** Coin Rush: a fat sack, coins spilling at its foot. */
const SACK = [
  '...c..c....',
  '..cCbcCb...',
  '...bRRb....',
  '..bcCccb...',
  '.bcCcccBb..',
  '.bcYYYcBb..',
  'bcYGYyYcBb.',
  'bcYYyyYcBb.',
  'bccYyYccBbY',
  '.bBBBBBBbYG',
  '..bbbbbbyYy',
];

/** The bounty board: a notice with a red pin on a post board. */
const BOARD = [
  '.jjjjjjjjj.',
  'jHHHHHHHHHd',
  'jHeeeeeRHHd',
  'jHekkkeEHHd',
  'jHeeeeeEHHd',
  'jHekkeeEHHd',
  'jHeEEEEEHHd',
  '.ddddddddd.',
  '..h.....h..',
  '..h.....h..',
  '..d.....d..',
];

/** The secret: a mossy boulder with a crack (lit: the crack glows). */
const ROCK = ['....nnmms....', '..nnmmmsmss..', '.nmmmkmmmmss.', 'nmmmmkkmmmmsm', 'nmmmkmmmmmmmm', 'nnmkmmmmmmmmn', 'AnnmmmmmmmnnA', '.AaAnnnnnaaL.'];
const ROCK_LIT = ROCK.map((r, y) => r.replace(/k/g, y === 3 ? 'U' : 'u'));

/** The travelling merchant (facing right): a teal hood and cloak, a pack bigger than she is, a lantern up front. */
const MERCHANT: string[][] = [
  [
    '.vVVv.......',
    'vVwwVv.tt...',
    'vVwVVvtTTt..',
    'vVVVVvtSkS..',
    'vVwVVvtSSS.o',
    '.vVVvtTTTqTy',
    '.vvvvtTTTq..',
    '....tTTTTq..',
    '....tTTTTq..',
    '....d...d...',
  ],
  [
    '.vVVv.......',
    'vVwwVv.tt...',
    'vVwVVvtTTt..',
    'vVVVVvtSkS..',
    'vVwVVvtSSS..',
    '.vVVvtTTTqTo',
    '.vvvvtTTTq.y',
    '....tTTTTq..',
    '....tTTTTq..',
    '.....d.d....',
  ],
];

// ------------------------------------------------------------------ the Coin Sack (fight scale)

interface SackOpts {
  squash: number; // 0..1: wider and shorter
  hurt?: boolean; // eyes squeezed shut, mouth open
  flash?: boolean;
}

/** Half widths of the sack's rows, from its tied top (row 0) to its bottom. */
const SACK_W = [1, 2, 3, 3, 3, 3, 4, 6, 7.5, 8.5, 9.5, 10, 10.5, 11, 11, 11.5, 11.5, 11.5, 11, 11, 10.5, 9.5, 8, 5.5];

function sackFrame(o: SackOpts): HTMLCanvasElement {
  const W = 28;
  const H = SACK_W.length + 3;
  const g: Grid = grid(W, H);
  const cx = W / 2;
  const sq = o.squash;
  const rowsN = SACK_W.length;
  const top = Math.round(sq * 2) + 1; // squashed: the top sits lower
  const span = rowsN - 1 - (top - 1);
  const halfAt = (y: number): number => {
    // y in the frame -> the sack's row (stretched to fit), wider when squashed
    const k = (y - top) / span;
    if (k < 0 || k > 1) return -1;
    const i = Math.min(rowsN - 1, Math.round(k * (rowsN - 1)));
    return SACK_W[i] * (i >= 6 ? 1 + 0.08 * sq : 1);
  };
  const rowOf = (y: number) => Math.round(((y - top) / span) * (rowsN - 1));
  const inside = (x: number, y: number) => {
    const hw = halfAt(y);
    return hw > 0 && Math.abs(x + 0.5 - cx) <= hw;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inside(x, y)) continue;
      if (o.flash) {
        put(g, x, y, '#ffffff');
        continue;
      }
      const i = rowOf(y);
      const hw = halfAt(y);
      const u = (x + 0.5 - cx) / hw;
      const v = i / (rowsN - 1);
      // the string round the neck
      if (i === 4 || i === 5) {
        put(g, x, y, PAL[u < -0.2 ? 'R' : u > 0.5 ? 'r' : i === 4 ? 'R' : 'r']);
        continue;
      }
      // light from the top left, a burlap weave, a dark rim on the lower right
      let lam = -0.6 * u - 0.5 * (v - 0.45);
      if ((x * 3 + y * 5) % 11 === 0) lam -= 0.25;
      let t = lam > 0.45 ? 'C' : lam > 0.05 ? 'c' : lam > -0.35 ? 'B' : 'b';
      if (!inside(x + 1, y + 1) && (u > 0 || y > H - 6)) t = 'D';
      put(g, x, y, PAL[t]);
    }
  if (!o.flash) {
    const at = (i: number) => top + Math.round((i / (rowsN - 1)) * span);
    // the coin stamped on its belly
    const ccx = Math.round(cx) - 1;
    const ccy = at(16);
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 3.3) continue;
        const col = d > 2.4 ? 'y' : dx + dy < -2 ? 'G' : dx === 0 && Math.abs(dy) < 2 ? 'y' : 'Y';
        put(g, ccx + dx, ccy + dy, PAL[col]);
      }
    // eyes (squeezed shut when hurt), a blush under each, a small mouth
    const ey = at(11);
    for (const ex of [Math.round(cx) - 5, Math.round(cx) + 3]) {
      if (o.hurt) {
        put(g, ex, ey, PAL.k);
        put(g, ex + 1, ey + 1, PAL.k);
        put(g, ex, ey + 2, PAL.k);
      } else {
        put(g, ex, ey, PAL.k);
        put(g, ex + 1, ey, PAL.k);
        put(g, ex, ey + 1, PAL.k);
        put(g, ex + 1, ey + 1, PAL.k);
        put(g, ex, ey, PAL.W);
      }
      put(g, ex, ey + 3, PAL.p);
      put(g, ex + 1, ey + 3, PAL.p);
    }
    const my = ey + 3;
    put(g, Math.round(cx) - 1, my, PAL.k);
    if (o.hurt) {
      put(g, Math.round(cx) - 1, my + 1, PAL.k);
      put(g, Math.round(cx), my + 1, PAL.k);
      put(g, Math.round(cx), my, PAL.k);
    }
  }
  return toCanvas(g);
}

export function buildRoamArt(add: Add): void {
  add('mn_sack', prop(SACK));
  add('mn_board', prop(BOARD));
  add('mn_rock', prop(ROCK));
  add('mn_rock_lit', prop(ROCK_LIT));
  MERCHANT.forEach((rows, i) => add(`mn_merch_${i}`, prop(rows)));
  add('coinsack_idle0', sackFrame({ squash: 0 }));
  add('coinsack_idle1', sackFrame({ squash: 0.5 }));
  add('coinsack_windup', sackFrame({ squash: 0.5 }));
  add('coinsack_attack', sackFrame({ squash: 0 }));
  add('coinsack_hurt', sackFrame({ squash: 1, hurt: true }));
  add('coinsack_flash', sackFrame({ squash: 1, hurt: true, flash: true }));
}
