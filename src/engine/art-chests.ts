// Hero chest art (see docs/art-style.md and docs/ui-style.md): three chests, each its own object with its own
// silhouette, materials and emblem, lit from the top left; toCanvas adds the ink outline.
//
//   hero    a sturdy oak chest with a barrel lid, banded and riveted in gold, a hero's crest (a blue shield with a
//           sword) on the lid and a gold hasp
//   rare    a lacquered navy trunk with a bevelled lid trimmed in silver, a cluster of blue crystals growing out of
//           its top, a faceted gem on the lid and crystal studs
//   region  a violet reliquary on gold ball feet, an arched roof of scales with a gold crest (a gem between laurel
//           sprigs), gold pilasters and filigree panels, a big ruby set in its lock
//
// The big chest is drawn in two parts that line up on one canvas (lid and base), so the lid can hop, lift and
// burst away on its own; the base has the chest's open mouth painted under where the lid sits.
//
// Textures (kind = hero | rare | region):
//   hchest_${kind}_big            BIG_CHEST.w x BIG_CHEST.h (49x46): the closed chest (the base and lid together).
//                                 Draw with origin (0.5, 1): the box's bottom is on the canvas's last rows.
//   hchest_${kind}_big_base       the base alone (its mouth showing above the rim: dark, empty)
//   hchest_${kind}_big_lid        the closed lid alone (its crest, emblem and hasp with it). Same canvas: draw it at
//                                 the base's place (origin (0.5, 1)) and it sits shut; lift it by moving it up.
//   hchest_${kind}_big_open       open and empty: the lid tipped back behind the box (the dusty "none waiting" look)
//   hchest_${kind}_big_gap        white mask, no outline: the mouth's inside (draw between the base and the lid with
//                                 ADD and a tint: light shows in the gap when the lid lifts, and pours out after)
//   hchest_${kind}_big_leakL{n} / _leakB{n}
//                                 white masks, no outline, n = 0..2: light leaking from the seam, then cracks
//                                 spreading over the lid (L, drawn with the lid) and the base (B, with the base)
//   hchest_${kind}_closed         35x34: the same chest at camp size (the camp's prop by the tent)
//   hchest_${kind}_icon           17x16: a badge-size chest
//   hchest_glow                   64x64 soft round glow, white with stepped, dithered alpha (tint it; ADD)
//   hchest_burst                  64x64 bold 12-point starburst, solid white (tint, rotate and scale it)
//   hchest_glow_l, hchest_burst_l the same at 192 and 128 px (big effects: the dithering stays fine)
//   vault_flame0..3               7x12 torch flame frames (no outline; the vault's torches)
//
// The vault (the chest screen's stage, registered here as the 'vault' theme): three arched alcoves of dark stone at
// x = 163 -/+ VAULT_SLOT_DX (a chest stands in each), a round vault door in the middle one, chains, coin piles, and
// a torch on a pillar at each side (VAULT_TORCHES: their flames are drawn live).
import { grid, put, stamp as stampAt, toCanvas, type Grid, type Pal } from './art';
import { registerStageTheme, type StageSpec } from './art-ui-stage';
import { flagstones } from './art-shrine';
import { bay, hash } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

export const HERO_CHESTS = ['hero', 'rare', 'region'] as const;
export type HeroChestKind = (typeof HERO_CHESTS)[number];

/** The camp-size chest's canvas. */
export const CHEST_W = 35;
export const CHEST_H = 34;

/** The big chest: its canvas, the seam's row (the base's top rim), the lid's centre (to spin it), the mouth's top. */
export const BIG_CHEST = { w: 49, h: 46, seam: 27, lidCy: 19, mouth: 23 } as const;

const stamp = (g: Grid, rows: string[], pal: Pal, x: number, y: number) => stampAt(g, rows, pal, Math.round(x), Math.round(y));
const tone = (r: readonly string[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))];
const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''));

// ------------------------------------------------------------------ ramps (dark -> light, hue-shifted)

const OAK = ['#24100e', '#42201a', '#66341e', '#8a4e26', '#ae6e34', '#cc904a', '#e6b46c'];
const GOLD = ['#4a2a10', '#8a4e14', '#c8841c', '#eeb63a', '#ffe07a', '#fff6c8'];
const LACQ = ['#080c22', '#10183e', '#1a2a62', '#26408e', '#3460b8', '#4c84dc', '#7aaaf0'];
const SILVER = ['#22263a', '#40486a', '#6c769a', '#a4aec8', '#d8e2f0', '#ffffff'];
const CRYSTAL = ['#0c2a66', '#1650b8', '#2a8ae8', '#6cc8ff', '#c8f2ff', '#ffffff'];
const VIOLET = ['#160a2a', '#2c1452', '#48227e', '#6a32ac', '#8e4ed6', '#b47cf4', '#d8b0ff'];
const RUBY = ['#3a0828', '#741450', '#b42a7e', '#e65aae', '#ffaede', '#ffffff'];
const BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'];
const LEAF = ['#1e4a1a', '#3a7a26', '#6aaa3a', '#b4d860'];

// ------------------------------------------------------------------ geometry

interface Geo {
  W: number;
  H: number;
  /** The box's left and right columns. */
  x0: number;
  x1: number;
  /** The base's top row (its rim, the seam under the lid) and bottom row. */
  bt: number;
  bb: number;
  /** The closed lid's top row. */
  lt: number;
  big: boolean;
}

const BIG: Geo = { W: BIG_CHEST.w, H: BIG_CHEST.h, x0: 3, x1: 45, bt: BIG_CHEST.seam, bb: BIG_CHEST.h - 2, lt: 12, big: true };
const CAMP: Geo = { W: CHEST_W, H: CHEST_H, x0: 2, x1: 32, bt: 20, bb: CHEST_H - 2, lt: 9, big: false };

const midX = (G: Geo) => (G.x0 + G.x1) / 2;
/** Rows of the mouth (the box's inside, seen from a little above) over the base's rim. */
const mouthRows = (G: Geo) => (G.big ? 4 : 3);

/** A flat face's tone: lit from the top left, darker to the right and down; the left edge catches the light. */
function flat(G: Geo, x: number, y: number, y0: number, y1: number, base = 0.64): number {
  let v = base - (x - G.x0) / (G.W * 1.7) - ((y - y0) / Math.max(1, y1 - y0)) * 0.2;
  if (x === G.x0) v += 0.18;
  if (x >= G.x1 - 1) v -= 0.22;
  return v;
}

/** What one chest paints: the base (with its mouth), the closed lid, the lid tipped open. */
interface Parts {
  base: Grid;
  lid: Grid;
  open: Grid;
  /** The keyhole's centre (where light leaks first). */
  key: [number, number];
}

/** The mouth over the base's rim: the back rim in the trim's colour, the inside dark, the side walls. */
function paintMouth(g: Grid, G: Geo, rim: readonly string[], body: readonly string[], dark: string): void {
  const m = mouthRows(G);
  const top = G.bt - m;
  for (let x = G.x0; x <= G.x1; x++) put(g, x, top, rim[x < G.x1 - 2 ? 3 : 1]);
  for (let y = top + 1; y < G.bt; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      // the back wall (lit a little from the left), the floor nearer the front in deep shadow, the side walls
      const left = x < (G.x0 + G.x1) / 2;
      let c = y === top + 1 ? body[left ? 2 : 1] : y === G.bt - 1 ? dark : body[left ? 1 : 0];
      if (x === G.x0) c = body[3];
      else if (x === G.x1) c = body[1];
      else if (x === G.x0 + 1) c = body[2];
      else if (x === G.x1 - 1) c = body[0];
      put(g, x, y, c);
    }
}

/** The lid tipped back behind the box: its inside in shadow, the trim showing, its front edge on top in the light. */
function paintOpenLid(g: Grid, G: Geo, body: readonly string[], trim: readonly string[], bands: Array<[number, number]>, round: number): void {
  const m = mouthRows(G);
  const hinge = G.bt - m - 1;
  const lh = G.big ? 13 : 9;
  const top = hinge - lh;
  const inLid = (x: number, y: number) => {
    if (y < top || y > hinge) return false;
    const inset = Math.round(((hinge - y) / lh) * (G.big ? 2 : 1));
    const l = G.x0 + inset;
    const r = G.x1 - inset;
    if (x < l || x > r) return false;
    const cx = x < l + round ? l + round : x > r - round ? r - round : x;
    return y >= top + round || (x - cx) ** 2 + (y + 0.5 - (top + round)) ** 2 <= round * round + 1;
  };
  for (let y = top; y <= hinge; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      if (!inLid(x, y)) continue;
      let v = 0.24 + ((y - top) / lh) * 0.26 - (x - G.x0) / (G.W * 2.4);
      if ((y - top) % 4 === 3) v -= 0.08;
      put(g, x, y, tone(body, v));
      for (const [b, w] of bands) if (x >= b && x < b + w) put(g, x, y, trim[x - b === 0 ? 2 : 1]);
      // the lid's frame, seen from inside
      if (!inLid(x - 1, y)) put(g, x, y, trim[3]);
      else if (!inLid(x + 1, y)) put(g, x, y, trim[1]);
    }
  for (let x = G.x0; x <= G.x1; x++) {
    if (inLid(x, top)) put(g, x, top, trim[4]);
    if (inLid(x, top + 1)) put(g, x, top + 1, trim[2]);
    if (inLid(x, hinge)) put(g, x, hinge, body[0]);
  }
}

// ------------------------------------------------------------------ the hero chest: oak, gold bands, a crest

function heroChest(G: Geo): Parts {
  const big = G.big;
  const cx = midX(G);
  const bw = big ? 4 : 3;
  const bands: Array<[number, number]> = big
    ? [
        [G.x0 + 7, bw],
        [G.x1 - 10, bw],
      ]
    : [
        [G.x0 + 5, bw],
        [G.x1 - 7, bw],
      ];
  const bandAt = (x: number) => bands.find(([b, w]) => x >= b && x < b + w);
  const bandTone = (x: number) => {
    const b = bandAt(x)!;
    return GOLD[(bw === 4 ? [4, 3, 2, 1] : [4, 2, 1])[x - b[0]]];
  };
  const plank = big ? 5 : 4;
  // ---- the base
  const base = grid(G.W, G.H);
  for (let y = G.bt; y <= G.bb; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      let v = flat(G, x, y, G.bt, G.bb, 0.66);
      const row = y - G.bt - 2;
      if (row >= 0 && row % plank === plank - 1) v -= 0.3; // a seam between planks
      const j = Math.floor(row / plank);
      if (row >= 0 && x === G.x0 + 4 + ((j * 13 + 5) % (G.x1 - G.x0 - 8)) && row % plank !== plank - 1) v -= 0.26; // a plank's end
      if (hash(x, y, 17) < 0.05 && row % plank === 1) v -= 0.15; // grain
      put(base, x, y, tone(OAK, v));
    }
  for (let y = G.bt; y <= G.bb; y++) for (let x = G.x0; x <= G.x1; x++) if (bandAt(x)) put(base, x, y, bandTone(x));
  for (let x = G.x0; x <= G.x1; x++) {
    put(base, x, G.bt, GOLD[x < G.x1 - 2 ? 4 : 2]);
    put(base, x, G.bt + 1, GOLD[2]);
    put(base, x, G.bb - 1, GOLD[3]);
    put(base, x, G.bb, GOLD[1]);
  }
  // rivets down the bands, and gold corner caps
  for (const [b, w] of bands)
    for (let y = G.bt + 4; y < G.bb - 2; y += big ? 4 : 5) {
      put(base, b + (w >> 1), y, GOLD[5]);
      put(base, b + (w >> 1), y + 1, GOLD[1]);
    }
  const cap = big ? ['b....', 'bc...', 'bcc..', 'bccc.', 'abbbb'] : ['b...', 'bc..', 'bcc.', 'abbb'];
  const capPal = { a: GOLD[4], b: GOLD[3], c: GOLD[1] };
  stamp(base, cap, capPal, G.x0, G.bb - cap.length + 1);
  stamp(base, mirror(cap), capPal, G.x1 - cap[0].length + 1, G.bb - cap.length + 1);
  // the lock plate the hasp closes over
  const lp = big ? ['YggggY', 'gGGGGy', 'gGkkGy', 'gGGkGy', 'YyyyyY'] : ['ygggy', 'gGkGy', 'yyyyy'];
  stamp(base, lp, { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], k: '#2a1408' }, Math.round(cx - (lp[0].length - 1) / 2), G.bt + (big ? 3 : 2));
  paintMouth(base, G, GOLD, OAK, '#140806');
  // ---- the lid: a barrel top, planks curving over it, the bands, a gold rim along its front edge
  const lid = grid(G.W, G.H);
  const rad = big ? 7 : 5;
  const inLid = (x: number, y: number) => {
    if (x < G.x0 || x > G.x1 || y < G.lt || y >= G.bt) return false;
    const ccx = x < G.x0 + rad ? G.x0 + rad : x > G.x1 - rad ? G.x1 - rad : x;
    return y >= G.lt + rad || (x - ccx) ** 2 + (y + 0.5 - (G.lt + rad)) ** 2 <= rad * rad;
  };
  for (let y = G.lt; y < G.bt; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      if (!inLid(x, y)) continue;
      const k = (y - G.lt) / (G.bt - 1 - G.lt);
      let v = 0.86 - k * 0.42 - (x - G.x0) / (G.W * 1.7);
      if (!inLid(x - 1, y)) v += 0.15;
      if (!inLid(x + 1, y) || !inLid(x + 2, y)) v -= 0.22;
      if ((y - G.lt) % 4 === 3) v -= 0.28;
      put(lid, x, y, tone(OAK, v));
      if (bandAt(x)) put(lid, x, y, bandTone(x));
    }
  // the crown's highlight
  for (let x = G.x0 + rad - 2; x < cx - 2; x++) if (!bandAt(x) && inLid(x, G.lt + 1)) put(lid, x, G.lt + 1, OAK[6]);
  for (let x = G.x0; x <= G.x1; x++) {
    put(lid, x, G.bt - 2, GOLD[x < G.x1 - 2 ? 3 : 2]);
    put(lid, x, G.bt - 1, GOLD[1]);
  }
  // nails along the rim
  for (let x = G.x0 + 3; x <= G.x1 - 3; x += big ? 5 : 6) if (!bandAt(x)) put(lid, x, G.bt - 2, GOLD[5]);
  // the crest: a blue heater shield with a gold rim and a silver sword
  const crest = big
    ? ['GGGGGGGGGGg', 'GbbbbYbbBBg', 'GbbbbYbbBBg', 'GbbYYYYYBBg', 'GbbbbWsbBBg', 'GbbbbWsbBBg', '.GbbbWsbBg.', '.GbbbWsBBg.', '..GbbWBBg..', '...GbWBg...', '....Ggg....']
    : ['GGGGGGg', 'GbbYbBg', 'GbYYYBg', 'GbbWBBg', '.GbWBg.', '..Ggg..'];
  stamp(lid, crest, { G: GOLD[4], g: GOLD[2], b: BLUE[3], B: BLUE[2], W: SILVER[5], s: SILVER[3], Y: GOLD[4] }, Math.round(cx - (crest[0].length - 1) / 2), G.lt + (big ? 2 : 1));
  // the hasp hangs from the lid's rim over the lock plate
  const hasp = big ? ['.GGGg.', 'GGgggY', 'Ggkkgy', 'GgkkgY', '.gyyY.'] : ['GGgY', 'GkkY', '.yy.'];
  stamp(lid, hasp, { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], k: '#2a1408' }, Math.round(cx - (hasp[0].length - 1) / 2), G.bt - (big ? 2 : 1));
  const open = grid(G.W, G.H);
  paintOpenLid(open, G, OAK, GOLD, bands, big ? 4 : 3);
  return { base, lid, open, key: [Math.round(cx), G.bt + (big ? 4 : 2)] };
}

// ------------------------------------------------------------------ the Rare chest: navy lacquer, silver, crystals

function rareChest(G: Geo): Parts {
  const big = G.big;
  const cx = Math.round(midX(G));
  const sw = big ? 3 : 2;
  const straps: Array<[number, number]> = big
    ? [
        [G.x0 + 8, sw],
        [G.x1 - 10, sw],
      ]
    : [
        [G.x0 + 6, sw],
        [G.x1 - 7, sw],
      ];
  const strapAt = (x: number) => straps.find(([b, w]) => x >= b && x < b + w);
  const strapTone = (x: number) => SILVER[(sw === 3 ? [4, 3, 1] : [4, 2])[x - strapAt(x)![0]]];
  /** The lacquer's gloss: a bright slanted streak with a softer one beside it (a reflection, not a scratch). */
  const gloss = (x: number, y: number, y0: number) => {
    const d = x - G.x0 - (y - y0) * 0.8;
    if (d >= 4 && d < (big ? 6 : 5)) return 0.22;
    if (d >= (big ? 6 : 5) && d < (big ? 8 : 6)) return 0.1;
    if (big && d >= 10 && d < 11) return 0.1;
    return 0;
  };
  // ---- the base: a lacquered box in a silver frame
  const base = grid(G.W, G.H);
  for (let y = G.bt; y <= G.bb; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      const v = flat(G, x, y, G.bt, G.bb, 0.6) + gloss(x, y, G.bt);
      put(base, x, y, tone(LACQ, v));
    }
  for (let y = G.bt; y <= G.bb; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      if (strapAt(x)) put(base, x, y, strapTone(x));
      if (x === G.x0) put(base, x, y, SILVER[4]);
      else if (x === G.x0 + 1 && big) put(base, x, y, SILVER[2]);
      else if (x === G.x1) put(base, x, y, SILVER[1]);
      else if (x === G.x1 - 1 && big) put(base, x, y, SILVER[2]);
    }
  for (let x = G.x0; x <= G.x1; x++) {
    put(base, x, G.bt, SILVER[x < G.x1 - 2 ? 4 : 2]);
    put(base, x, G.bt + 1, SILVER[2]);
    put(base, x, G.bb - 1, SILVER[3]);
    put(base, x, G.bb, SILVER[1]);
  }
  // crystal studs where the straps cross the rims, and at the corners
  const stud = (x: number, y: number) =>
    big ? stamp(base, ['.c.', 'cWl', '.l.'], { W: CRYSTAL[5], c: CRYSTAL[3], l: CRYSTAL[1] }, x - 1, y - 1) : stamp(base, ['Wc', 'cl'], { W: CRYSTAL[5], c: CRYSTAL[3], l: CRYSTAL[1] }, x, y);
  for (const [b, w] of straps) {
    stud(b + (w >> 1), G.bt + (big ? 1 : 0));
    stud(b + (w >> 1), G.bb - (big ? 1 : 1));
  }
  stud(G.x0 + (big ? 1 : 0), G.bb - (big ? 1 : 1));
  stud(G.x1 - (big ? 1 : 1), G.bb - (big ? 1 : 1));
  // the lock: a silver plate with a crystal keyhole
  const lock = big ? ['SSsssm', 'SsLLsM', 'sLWcls', 'sscclM', 'mssssM', '.mMMM.'] : ['Sssm', 'sLcM', 'mMMM'];
  stamp(base, lock, { S: SILVER[5], s: SILVER[3], m: SILVER[2], M: SILVER[1], L: CRYSTAL[4], W: CRYSTAL[5], c: CRYSTAL[2], l: CRYSTAL[1] }, cx - (big ? 2 : 1), G.bt + (big ? 2 : 2));
  paintMouth(base, G, SILVER, LACQ, '#04060e');
  // ---- the lid: bevelled (narrower toward its flat top), its top face catching the light, crystals growing out
  const lid = grid(G.W, G.H);
  const bev = big ? 4 : 3;
  const topRows = big ? 3 : 2;
  const inset = (y: number) => Math.round(((G.bt - 1 - y) / (G.bt - 1 - G.lt)) * bev);
  const inLid = (x: number, y: number) => y >= G.lt && y < G.bt && x >= G.x0 + inset(y) && x <= G.x1 - inset(y);
  for (let y = G.lt; y < G.bt; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      if (!inLid(x, y)) continue;
      let c: string;
      if (y < G.lt + topRows) c = tone(LACQ, 0.92 - (x - G.x0) / (G.W * 2) - (y - G.lt) * 0.08);
      else c = tone(LACQ, flat(G, x, y, G.lt + topRows, G.bt - 1, 0.6) + gloss(x, y, G.lt + topRows));
      if (!inLid(x - 1, y)) c = SILVER[4];
      else if (!inLid(x + 1, y)) c = SILVER[1];
      put(lid, x, y, c);
      if (strapAt(x) && y >= G.lt + topRows) put(lid, x, y, strapTone(x));
    }
  for (let x = G.x0; x <= G.x1; x++) {
    if (inLid(x, G.lt)) put(lid, x, G.lt, SILVER[x < cx + 6 ? 5 : 3]);
    if (inLid(x, G.lt + topRows)) put(lid, x, G.lt + topRows, SILVER[x < G.x1 - 4 ? 3 : 2]);
    put(lid, x, G.bt - 2, SILVER[x < G.x1 - 2 ? 3 : 2]);
    put(lid, x, G.bt - 1, SILVER[1]);
  }
  // silver corner brackets at the lid's lower corners
  if (big) {
    const br = ['Ss...', 'Ss...', 'SsSSs', 'smmmm'];
    const bp = { S: SILVER[4], s: SILVER[3], m: SILVER[1] };
    stamp(lid, br, bp, G.x0, G.bt - 4);
    stamp(lid, mirror(br).map((r) => r.replace(/S/g, 's')), bp, G.x1 - 4, G.bt - 4);
  }
  // the gem on the lid's face: faceted, in a silver bezel with four prongs
  const gem = big
    ? ['...sSs...', '..sWLls..', '.sWLLlcs.', 'sSLLlccbs', '.sLlccbs.', '..scbbs..', '...sMs...']
    : ['.sSs.', 'sWLcs', '.scs.'];
  stamp(lid, gem, { s: SILVER[3], S: SILVER[5], M: SILVER[1], W: CRYSTAL[5], L: CRYSTAL[4], l: CRYSTAL[3], c: CRYSTAL[2], b: CRYSTAL[1] }, cx - ((gem[0].length - 1) >> 1), G.lt + topRows + (big ? 2 : 1));
  // the crystal cluster on top: a tall one in the middle and a shorter one leaning out each side
  const shard = (x0: number, h: number, w: number, lean: number) => {
    for (let k = 0; k < h; k++) {
      const y = G.lt + 1 - k;
      const off = Math.round((k / h) * lean);
      const half = k >= h - 2 ? Math.max(0, w - 2 - (k - (h - 2)) * 2) : w;
      for (let i = 0; i < half; i++) {
        const x = x0 + off + Math.round((w - half) / 2) + i;
        const left = i < half / 2;
        put(lid, x, y, i === 0 ? CRYSTAL[4] : left ? CRYSTAL[3] : i === half - 1 ? CRYSTAL[1] : CRYSTAL[2]);
      }
    }
  };
  if (big) {
    shard(cx - 7, 7, 4, -2);
    shard(cx + 4, 6, 4, 2);
    shard(cx - 2, 11, 5, 0);
    put(lid, cx - 1, G.lt - 7, CRYSTAL[5]);
    put(lid, cx - 1, G.lt - 6, CRYSTAL[5]);
    put(lid, cx - 6, G.lt - 3, CRYSTAL[5]);
  } else {
    shard(cx - 5, 4, 3, -1);
    shard(cx + 3, 4, 3, 1);
    shard(cx - 1, 7, 3, 0);
    put(lid, cx - 1, G.lt - 4, CRYSTAL[5]);
  }
  const open = grid(G.W, G.H);
  paintOpenLid(open, G, LACQ, SILVER, straps, 1);
  return { base, lid, open, key: [cx, G.bt + (big ? 4 : 3)] };
}

// ------------------------------------------------------------------ the region chest: a violet reliquary

function regionChest(G0: Geo): Parts {
  const big = G0.big;
  // the box stands on ball feet: its bottom is two rows up
  const G: Geo = { ...G0, bb: G0.bb - 2 };
  const cx = Math.round(midX(G));
  const pil = big ? 3 : 2;
  const strip = big ? 2 : 1;
  const gold = (x: number) => {
    if (x < G.x0 + pil) return GOLD[[4, 3, 2][x - G.x0] ?? 2];
    if (x > G.x1 - pil) return GOLD[[1, 2, 3][G.x1 - x] ?? 2];
    if (Math.abs(x - cx) <= strip) return GOLD[x < cx ? 4 : x === cx ? 3 : 2];
    return null;
  };
  // ---- the base: gold pilasters and mouldings, two violet panels with filigree
  const base = grid(G.W, G.H);
  for (let y = G.bt; y <= G.bb; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      let v = flat(G, x, y, G.bt, G.bb, 0.62);
      // an inset gold line framing each panel
      const pl = x > cx ? cx + strip + 1 : G.x0 + pil;
      const pr = x > cx ? G.x1 - pil : cx - strip - 1;
      const inner = big && (x === pl + 1 || x === pr - 1 || y === G.bt + 3 || y === G.bb - 3) && x > pl && x < pr && y > G.bt + 2 && y < G.bb - 2;
      put(base, x, y, inner ? GOLD[x === pr - 1 || y === G.bb - 3 ? 1 : 2] : tone(VIOLET, v));
      const gc = gold(x);
      if (gc) put(base, x, y, gc);
    }
  for (let x = G.x0; x <= G.x1; x++) {
    put(base, x, G.bt, GOLD[x < G.x1 - 2 ? 4 : 2]);
    put(base, x, G.bt + 1, GOLD[2]);
    put(base, x, G.bb - 1, GOLD[3]);
    put(base, x, G.bb, GOLD[1]);
  }
  // a gold lozenge with a ruby heart in the middle of each panel, and studs in the panel's corners
  const panels: Array<[number, number]> = [
    [G.x0 + pil, cx - strip - 1],
    [cx + strip + 1, G.x1 - pil],
  ];
  for (const [pl, pr] of panels) {
    const mx = Math.round((pl + pr) / 2);
    const my = Math.round((G.bt + G.bb) / 2);
    if (big) {
      stamp(base, ['...g...', '..gGg..', '.gG.Gy.', 'gG.R.Gy', '.gG.Gy.', '..gGy..', '...y...'], { g: GOLD[3], G: GOLD[4], y: GOLD[1], R: RUBY[3] }, mx - 3, my - 3);
      for (const [sx, sy] of [
        [pl + 3, G.bt + 5],
        [pr - 3, G.bt + 5],
        [pl + 3, G.bb - 5],
        [pr - 3, G.bb - 5],
      ])
        put(base, sx, sy, GOLD[3]);
    } else stamp(base, ['.g.', 'gRg', '.g.'], { g: GOLD[3], R: RUBY[3] }, mx - 1, my - 1);
  }
  // the lock: a big ruby in a gold mount on the middle strip
  const lock = big ? ['.GGgy.', 'GRrrvY', 'gRWrvy', 'grrvvY', 'Yvvvvy', '.yYYY.'] : ['GrrY', 'gRvY', '.yY.'];
  stamp(base, lock, { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], R: RUBY[4], W: RUBY[5], r: RUBY[3], v: RUBY[2] }, cx - (big ? 2 : 1), G.bt + (big ? 2 : 2));
  // ball feet under the pilasters
  const foot = big ? ['GGgy', 'gggY'] : ['Ggy', 'gyY'];
  const fp = { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1] };
  stamp(base, foot, fp, G.x0, G.bb + 1);
  stamp(base, foot, fp, G.x1 - foot[0].length + 1, G.bb + 1);
  paintMouth(base, G, GOLD, VIOLET, '#0a0414');
  // ---- the lid: an arched roof of violet scales under a gold trim, a gold frieze along its foot, the crest on top
  const lid = grid(G.W, G.H);
  const half = (G.x1 - G.x0) / 2;
  const peak = G.lt - (big ? 2 : 1);
  const wall = big ? 5 : 3; // the lid's straight foot
  const drop = G.bt - 1 - wall - peak;
  const topAt = (x: number) => peak + Math.round(drop * Math.pow(Math.abs(x + 0.5 - (G.x0 + G.x1 + 1) / 2) / (half + 0.5), 1.7));
  const inLid = (x: number, y: number) => x >= G.x0 && x <= G.x1 && y >= topAt(x) && y < G.bt;
  for (let y = peak; y < G.bt; y++)
    for (let x = G.x0; x <= G.x1; x++) {
      if (!inLid(x, y)) continue;
      const t = topAt(x);
      let c: string;
      if (y - t <= 1) c = GOLD[y === t ? (x < cx + 4 ? 4 : 3) : 2];
      else if (y >= G.bt - 2) c = GOLD[y === G.bt - 2 ? (x < G.x1 - 2 ? 3 : 2) : 1];
      else if (y === G.bt - wall) c = GOLD[2];
      else {
        let v = 0.74 - ((y - peak) / (G.bt - peak)) * 0.35 - (x - G.x0) / (G.W * 1.7);
        // scales: rows of little arches
        const row = Math.floor((y - peak) / 3);
        const sx = (x + (row % 2) * 2) % 4;
        if (big && (y - peak) % 3 === 2 && sx !== 1 && sx !== 2) v -= 0.22;
        if (big && sx === 0 && (y - peak) % 3 !== 0) v -= 0.12;
        if (y > G.bt - wall) v = 0.42 - (x - G.x0) / (G.W * 1.7) + (x % 4 === 1 ? 0.1 : 0);
        c = tone(VIOLET, v);
      }
      put(lid, x, y, c);
    }
  // gold beads along the frieze
  for (let x = G.x0 + 2; x <= G.x1 - 2; x += 3) put(lid, x, G.bt - wall + (big ? 2 : 1), GOLD[4]);
  // a gold star medallion on the roof
  const star = big ? ['...G...', '..GgG..', 'GGgRgGG', '.gRWRg.', 'GGgRgGG', '..GgG..', '...G...'] : ['.G.', 'GRG', '.G.'];
  stamp(lid, star, { G: GOLD[4], g: GOLD[2], R: RUBY[3], W: RUBY[5] }, cx - ((star[0].length - 1) >> 1), peak + (big ? 5 : 3));
  // the crest on the peak: a gem on a gold ball between two laurel sprigs
  const crest = big
    ? ['....RR....', '...RWrv...', '...rrvv...', 'l..GggY..l', 'Ll.GGgY.lL', '.LlgGgylL.', '..LLyyLL..']
    : ['.Rr.', 'lGgl'];
  stamp(lid, crest, { R: RUBY[4], W: RUBY[5], r: RUBY[3], v: RUBY[2], G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], l: LEAF[3], L: LEAF[2] }, cx - ((crest[0].length - 1) >> 1) - (big ? 0 : 0), peak - crest.length + 2);
  const open = grid(G.W, G.H);
  paintOpenLid(open, G, VIOLET, GOLD, [], big ? 5 : 3);
  return { base, lid, open, key: [cx, G.bt + (big ? 4 : 2)] };
}

const PAINTERS: Record<HeroChestKind, (G: Geo) => Parts> = { hero: heroChest, rare: rareChest, region: regionChest };

// ------------------------------------------------------------------ light masks

/** A white mask (no outline) of the pixels `on` reports. */
function mask(G: Geo, on: (x: number, y: number) => boolean | number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = G.W;
  c.height = G.H;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < G.H; y++)
    for (let x = 0; x < G.W; x++) {
      const v = on(x, y);
      if (!v) continue;
      ctx.fillStyle = `rgba(255,255,255,${v === true ? 1 : v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

/** Jagged cracks running from the seam over the lid (up) and the base (down): deterministic per kind. */
function cracks(G: Geo, p: Parts, seed: number): Array<{ pts: Array<[number, number]>; lid: boolean; stage: number }> {
  const out: Array<{ pts: Array<[number, number]>; lid: boolean; stage: number }> = [];
  const starts = [0.24, 0.66, 0.5, 0.3, 0.78, 0.86];
  starts.forEach((f, i) => {
    const lidSide = i % 2 === 0;
    let x = Math.round(G.x0 + 2 + f * (G.x1 - G.x0 - 4));
    let y = lidSide ? G.bt - 2 : G.bt + 1;
    const len = i < 3 ? 4 + (i % 2) : 7 + ((i * 3) % 4);
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < len; k++) {
      pts.push([x, y]);
      const r = hash(i, k, seed);
      if (r < 0.3) x -= 1;
      else if (r > 0.7) x += 1;
      y += lidSide ? -1 : 1;
      if (lidSide && !p.lid[y]?.[x]) break;
      if (!lidSide && (y >= G.bb - 1 || !p.base[y]?.[x])) break;
    }
    out.push({ pts, lid: lidSide, stage: i < 3 ? 1 : 2 });
  });
  return out;
}

function leakMasks(G: Geo, p: Parts, seed: number): { lid: HTMLCanvasElement[]; base: HTMLCanvasElement[]; gap: HTMLCanvasElement } {
  const cx = midX(G);
  const cr = cracks(G, p, seed);
  const m = mouthRows(G);
  const lid: HTMLCanvasElement[] = [];
  const base: HTMLCanvasElement[] = [];
  for (let n = 0; n < 3; n++) {
    const reach = n === 0 ? 7 : 99;
    const seam = (x: number) => x > G.x0 && x < G.x1 && Math.abs(x - cx) <= reach;
    const on = (x: number, y: number, isLid: boolean): boolean | number => {
      for (const c of cr) if (c.lid === isLid && c.stage <= n) for (const [px, py] of c.pts) if (px === x && py === y) return true;
      return false;
    };
    lid.push(
      mask(G, (x, y) => {
        if (y === G.bt - 1 && seam(x) && p.lid[y]?.[x]) return n === 0 ? 0.8 : 1;
        if (y === G.bt - 2 && seam(x) && n === 2 && p.lid[y]?.[x]) return 0.55;
        return on(x, y, true);
      }),
    );
    base.push(
      mask(G, (x, y) => {
        if (y === G.bt && seam(x)) return n === 0 ? 0.8 : 1;
        if (y === G.bt + 1 && seam(x) && n >= 1) return 0.45;
        const [kx, ky] = p.key;
        if (Math.abs(x - kx) <= (G.big ? 0 : 0) && y >= ky - 1 && y <= ky + (G.big ? 1 : 0)) return true;
        return on(x, y, false);
      }),
    );
  }
  const gap = mask(G, (x, y) => {
    if (y < G.bt - m + 1 || y >= G.bt || x <= G.x0 || x >= G.x1) return false;
    const d = Math.abs(x + 0.5 - (G.x0 + G.x1 + 1) / 2) / ((G.x1 - G.x0) / 2);
    const k = 1 - d * 0.75 + (bay(x, y) - 0.5) * 0.3;
    return Math.max(0.25, Math.min(1, k));
  });
  return { lid, base, gap };
}

// ------------------------------------------------------------------ the badge-size chests

const ICONS: Record<HeroChestKind, { rows: string[]; pal: Pal }> = {
  hero: {
    rows: [
      '...............',
      '...............',
      '..aaaaGaaGaaa..',
      '.abbbbGbBbGbbc.',
      'abbbbbGBBBGbbcc',
      'abbbbbGbBbGbccd',
      'yyyyyyyGGyyyyyY',
      'GGGGGGgkgGGGGGy',
      'bbbbbbGkGbGbccd',
      'cbbbbbGGGbGbccd',
      'cccccccccbGcddd',
      'GGGGGGGGGGGGGGy',
      'yyyyyyyyyyyyyyY',
    ],
    pal: { a: OAK[6], b: OAK[4], c: OAK[3], d: OAK[2], G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], B: BLUE[3], k: '#2a1408' },
  },
  rare: {
    rows: [
      '......W........',
      '....c.Wl.c.....',
      '...SScWlcSSS...',
      '..SaaaaWaaaSs..',
      '.SaaaLLlaaaass.',
      'SaaaaLclaaaaass',
      'sssssssssssssss',
      'SSSSSSSmSSSSSSs',
      'SbbbbsLcsbbbbbs',
      'Sbbbbbmmbbbbbms',
      'Sbbbbbbbbbbbbbs',
      'SSSSSSSSSSSSSSs',
      'sssssssssssssss',
    ],
    pal: { a: LACQ[4], b: LACQ[3], S: SILVER[4], s: SILVER[2], m: SILVER[1], W: CRYSTAL[5], L: CRYSTAL[4], l: CRYSTAL[2], c: CRYSTAL[3] },
  },
  region: {
    rows: [
      '......RR.......',
      '....lGRvGl.....',
      '...GGGGgGGGG...',
      '..GaaaaGaaaaG..',
      '.GaaaaGRGaaabG.',
      'GaaaabbGbbbbbbG',
      'GGGGGGGGGGGGGGy',
      'GGgggggRggggggy',
      'GbbbbgRWRgbbbby',
      'GbbbbbgRgbbbcby',
      'GbbbbbbgbbbbcbY',
      'GGGGGGGGGGGGGGy',
      'GGy.........GgY',
    ],
    pal: { a: VIOLET[5], b: VIOLET[3], c: VIOLET[2], G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], R: RUBY[3], W: RUBY[5], v: RUBY[2], l: LEAF[3] },
  },
};

function icon(kind: HeroChestKind): HTMLCanvasElement {
  const def = ICONS[kind];
  const g = grid(17, 16);
  stamp(g, def.rows, def.pal, 1, 1);
  return toCanvas(g);
}

// ------------------------------------------------------------------ light and burst

/** A soft round glow: white, alpha in stepped bands, dithered where they meet. */
function glowTexture(n: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d')!;
  const A = [0, 0.08, 0.16, 0.26, 0.38, 0.52, 0.68, 0.84];
  const im = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      if (d >= 1) continue;
      const band = Math.max(0, Math.min(A.length - 1, Math.floor((1 - d) ** 1.4 * A.length + (bay(x, y) - 0.5) * 0.9)));
      if (!band) continue;
      const i = (y * n + x) * 4;
      im.data.fill(255, i, i + 3);
      im.data[i + 3] = Math.round(A[band] * 255);
    }
  ctx.putImageData(im, 0, 0);
  return c;
}

/** A bold starburst: 12 rays, long and short by turns, with a round heart. Solid white. */
function burstTexture(n: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  const R = n / 2 - 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2;
      const dy = y + 0.5 - n / 2;
      const a = Math.atan2(dy, dx) + Math.PI / 12;
      const k = 12;
      const ph = ((((a / (Math.PI * 2)) * k) % 1) + 1) % 1;
      const long = Math.floor(((((a / (Math.PI * 2)) * k) % k) + k) % k) % 2 === 0;
      const tip = long ? R : R * 0.7;
      const r = R * 0.44 + (tip - R * 0.44) * Math.max(0, 1 - Math.abs(ph - 0.5) * 2) ** 0.85;
      if (Math.hypot(dx, dy) <= r) ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

const FLAME = ['#d8401c', '#f27a1c', '#ffb02a', '#ffe070', '#fff8d0'];

/** A torch flame, frame f (0..3): a teardrop of fire licking up, its heart near white. No outline. */
function flame(f: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const W = 7;
  const H = 12;
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const sway = [0, 1, 0, -1][f];
  const tall = [0, 1, 2, 1][f];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = (y - tall) / (H - 1 - tall); // 0 at the tip, 1 at the base
      if (k < 0) continue;
      const cxk = 3 + sway * (1 - k);
      const half = 0.6 + 2.6 * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.62);
      const d = Math.abs(x + 0.5 - (cxk + 0.5)) / half;
      if (d > 1) continue;
      const heat = (1 - d) * 0.7 + k * 0.5;
      const i = Math.max(0, Math.min(FLAME.length - 1, Math.floor(heat * FLAME.length - 0.4 + (bay(x, y) - 0.5) * 0.6)));
      ctx.fillStyle = FLAME[i];
      ctx.fillRect(x, y, 1, 1);
    }
  return c;
}

// ------------------------------------------------------------------ the vault (the chest screen's stage)

/** The chest screen's slots stand this far apart, centred on the screen (the alcoves are painted to match). */
export const VAULT_SLOT_DX = 88;
/** Where the vault's floor starts (game px from the top). */
export const VAULT_FLOOR = 90;
/** The torches on the side pillars: where each flame's foot is. */
export const VAULT_TORCHES: ReadonlyArray<{ x: number; y: number }> = [
  { x: 31, y: 46 },
  { x: 296, y: 46 },
];

const VSTONE = ['#0c0a12', '#16121e', '#201a2a', '#2a2236', '#352b42', '#43374f', '#55475e'];

const VAULT: StageSpec = {
  sky: ['#08060c', '#0c0912', '#100c18', '#130e1c', '#161020', '#181224'],
  far: ['#1a1424', '#2a2034'],
  near: ['#120e1a', '#2e2438'],
  floor: ['#2c2434', '#2a2232', '#262030', '#221c2a', '#1c1724', '#16121c'],
  floorY: 150, // (the motif paints its own floor of flagstones from VAULT_FLOOR)
  motif: 'vault',
  light: 0xffd8a0,
  disc: [0x6a5a7a, 0x3a3048, 0x241c30],
  accent: 0xffd23a,
};

/** The vault's back wall: stone courses, three arched alcoves (the middle one holding a round vault door), pillars
 *  with torch sconces, chains and coin piles. */
function paintVault(ctx: CanvasRenderingContext2D, w: number, _sp: StageSpec, r: () => number): void {
  const fy = VAULT_FLOOR;
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  // stone courses: blocks 9 px tall, staggered, lit on their top edge, darker toward the corners of the room
  for (let y = 0; y < fy; y++) {
    const row = Math.floor(y / 9);
    const ry = y % 9;
    for (let x = 0; x < w; x++) {
      const off = (row * 13) % 24;
      const bx = Math.floor((x + off) / 24);
      const lx = (x + off) % 24;
      const jit = (hash(bx, row, 41) - 0.5) * 0.14;
      const edge = 1 - Math.abs(x - w / 2) / (w / 2);
      let v = 0.28 + edge * 0.18 + jit + (y / fy) * 0.12;
      if (ry === 8 || lx === 23) v = 0.06;
      else if (ry === 0) v += 0.12;
      else if (lx === 0) v += 0.06;
      px(x, y, VSTONE[Math.max(0, Math.min(VSTONE.length - 1, Math.floor(v * VSTONE.length + (bay(x, y) - 0.5) * 0.5)))]);
    }
  }
  // the alcoves: deep arched recesses, darkest at their back, a lit stone rim round each arch
  const cx = 163;
  const slots = [cx - VAULT_SLOT_DX, cx, cx + VAULT_SLOT_DX];
  const aw = 35;
  const top = 22;
  for (const sx of slots)
    for (let y = top - 4; y < fy; y++)
      for (let x = sx - aw - 4; x <= sx + aw + 4; x++) {
        const dx = Math.abs(x + 0.5 - sx);
        const archY = (half: number) => top + 12 - Math.sqrt(Math.max(0, half * half - dx * dx)) * (12 / half);
        const inner = dx <= aw && y >= archY(aw);
        const rim = dx <= aw + 4 && y >= archY(aw + 4) && !inner;
        if (inner) {
          const depth = Math.min(1, (y - archY(aw)) / 30);
          const v = 0.05 + depth * 0.06 + (dx / aw) * 0.04 + (y > fy - 6 ? 0.04 : 0);
          px(x, y, VSTONE[Math.floor(v * VSTONE.length)] ?? VSTONE[0]);
        } else if (rim) {
          const k = (x - (sx - aw - 4)) / (2 * aw + 8);
          const voussoir = Math.floor(Math.atan2(y - (top + 12), x - sx) * 5) % 2 === 0;
          px(x, y, VSTONE[Math.max(1, Math.min(6, Math.round(5 - k * 2 + (voussoir ? 0 : -1))))]);
        }
      }
  // the round vault door in the middle alcove: iron rings, bolts round its rim, a wheel at its heart
  const IRON = ['#141420', '#1e1e2c', '#2a2a3a', '#3a3a4c', '#4e4e62', '#6a6a7e'];
  const dy = 58;
  const R = 26;
  for (let y = dy - R - 1; y <= dy + R + 1; y++)
    for (let x = cx - R - 1; x <= cx + R + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - dy);
      if (d > R + 0.5) continue;
      const lit = ((cx - x) + (dy - y)) / (2 * R);
      let v = 0.32 + lit * 0.22;
      if (d > R - 1.5) v = 0.12;
      else if (d > R - 4) v = 0.5 + lit * 0.25;
      else if (Math.abs(d - 15) < 1) v = 0.18;
      else if (Math.abs(d - 14) < 1) v = 0.48 + lit * 0.2;
      px(x, y, IRON[Math.max(0, Math.min(5, Math.floor(v * 6)))]);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bx = Math.round(cx + Math.cos(a) * (R - 2.5));
    const by = Math.round(dy + Math.sin(a) * (R - 2.5));
    px(bx, by, IRON[5]);
    px(bx + 1, by + 1, IRON[0]);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    for (let k = 2; k <= 8; k++) px(Math.round(cx + Math.cos(a) * k), Math.round(dy + Math.sin(a) * k), IRON[k < 4 ? 4 : 3]);
  }
  for (let y = dy - 2; y <= dy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) if (Math.hypot(x - cx, y - dy) <= 2.2) px(x, y, (x + y) % 2 ? IRON[5] : '#8a7a5a');
  // pillars between the alcoves and at the sides, a sconce on each side pillar
  const pillars = [cx - VAULT_SLOT_DX * 1.5, cx - VAULT_SLOT_DX / 2, cx + VAULT_SLOT_DX / 2, cx + VAULT_SLOT_DX * 1.5];
  for (const p of pillars) {
    const x0 = Math.round(p - 5);
    for (let y = 0; y < fy; y++)
      for (let x = x0; x < x0 + 11; x++) {
        const k = (x - x0) / 10;
        let v = 0.62 - k * 0.42 + ((y % 18) === 17 ? -0.3 : 0) + (x === x0 ? 0.1 : 0);
        if (y < 6) v -= 0.1;
        px(x, y, VSTONE[Math.max(0, Math.min(6, Math.floor(v * 7)))]);
      }
  }
  for (const t of VAULT_TORCHES) {
    // an iron sconce: a cup on a bracket
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(t.x - 3, t.y, 7, 1);
    ctx.fillRect(t.x - 2, t.y + 1, 5, 3);
    ctx.fillRect(t.x - 1, t.y + 4, 3, 6);
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(t.x - 2, t.y, 5, 1);
    ctx.fillStyle = '#3a2e28';
    ctx.fillRect(t.x - 1, t.y + 1, 3, 2);
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(t.x, t.y + 4, 1, 6);
    // soot on the stone above
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#060408';
    ctx.fillRect(t.x - 2, t.y - 24, 5, 10);
    ctx.fillRect(t.x - 1, t.y - 30, 3, 6);
    ctx.globalAlpha = 1;
  }
  // chains hanging in the side alcoves
  for (const x of [slots[0] - 24, slots[2] + 24]) {
    for (let y = 26; y < 58; y++) px(x, y, y % 3 === 0 ? '#4a4258' : y % 3 === 1 ? '#2a2434' : '#5e5470');
    px(x - 1, 58, '#4a4258');
    px(x + 1, 58, '#4a4258');
    px(x - 1, 59, '#2a2434');
    px(x, 60, '#5e5470');
  }
  // coin piles and a goblet at the alcoves' feet, glinting
  const COIN = ['#4a2a10', '#8a4e14', '#c8841c', '#eeb63a', '#ffe07a'];
  const pile = (x0: number, wide: number, high: number) => {
    for (let x = 0; x < wide; x++) {
      const h = Math.round(high * Math.sin(((x + 0.5) / wide) * Math.PI) + (hash(x, x0, 5) - 0.5) * 1.4);
      for (let k = 0; k < h; k++) {
        const y = fy - 1 - k;
        const v = 0.35 + (k / high) * 0.4 - (x / wide) * 0.25 + (hash(x, k + x0, 9) - 0.5) * 0.3;
        px(x0 + x, y, COIN[Math.max(0, Math.min(4, Math.floor(v * 5)))]);
      }
    }
  };
  pile(slots[0] - aw + 2, 12, 5);
  pile(slots[0] + aw - 13, 9, 3);
  pile(slots[2] - aw + 3, 8, 3);
  pile(slots[2] + aw - 15, 13, 6);
  pile(slots[1] - aw + 3, 7, 3);
  pile(slots[1] + aw - 11, 9, 4);
  flagstones(ctx, w, fy, 150, VSTONE, (x) => 0.1 - Math.abs(x - 163) / 900);
  void r;
}

registerStageTheme('vault', VAULT, paintVault);

// ------------------------------------------------------------------ build

/** Copy canvases onto one (the composite frames: lid over base, base over the open lid). */
function layer(w: number, h: number, ...cs: HTMLCanvasElement[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (const s of cs) ctx.drawImage(s, 0, 0);
  return c;
}

export function buildChestArt(add: Add): void {
  HERO_CHESTS.forEach((kind, i) => {
    const big = PAINTERS[kind](BIG);
    const base = toCanvas(big.base);
    const lid = toCanvas(big.lid);
    add(`hchest_${kind}_big`, layer(BIG.W, BIG.H, base, lid));
    add(`hchest_${kind}_big_base`, base);
    add(`hchest_${kind}_big_lid`, lid);
    add(`hchest_${kind}_big_open`, layer(BIG.W, BIG.H, toCanvas(big.open), base));
    const m = leakMasks(BIG, big, 31 + i * 7);
    add(`hchest_${kind}_big_gap`, m.gap);
    m.lid.forEach((c, n) => add(`hchest_${kind}_big_leakL${n}`, c));
    m.base.forEach((c, n) => add(`hchest_${kind}_big_leakB${n}`, c));
    const camp = PAINTERS[kind](CAMP);
    add(`hchest_${kind}_closed`, layer(CAMP.W, CAMP.H, toCanvas(camp.base), toCanvas(camp.lid)));
    add(`hchest_${kind}_icon`, icon(kind));
  });
  add('hchest_glow', glowTexture(64));
  add('hchest_glow_l', glowTexture(192));
  add('hchest_burst', burstTexture(64));
  add('hchest_burst_l', burstTexture(128));
  for (let f = 0; f < 4; f++) add(`vault_flame${f}`, flame(f));
}
