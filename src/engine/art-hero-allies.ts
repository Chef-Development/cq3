// Moss's allies (see docs/content-bible.md section 3, Moss): small grove creatures called by green hits. Textures
// `ally_${kind}_0`, `ally_${kind}_1` (a two-frame idle) and `ally_${kind}_act` (what it does), each ALLY_W x ALLY_H
// (smaller than Pip's frame), facing right; the walkers stand with their feet centred on ALLY_FEET (soles on the row
// above the bottom outline row), the glowmoth hovers centred in the box. Forms are character maps lit from their
// own shape (light from the top left); toCanvas adds the ink outline.
//   thornling  a spiky seed-sprout: jabs a long thorn forward
//   barkback   a stump on stubby legs: braces low behind a raised slab of bark
//   glowmoth   a lantern moth: its lantern flares bright (the heal)
//   seedling   a sprout with an acorn cap: plants a glowing green seed
import { grid, put, stampShaded, toCanvas, type Grid, type Pal, type Shade } from './art';

type Add = (key: string, c: HTMLCanvasElement) => void;

export const ALLY_W = 24;
export const ALLY_H = 22;
/** The walkers' feet point in the ally box (bottom centre). */
export const ALLY_FEET: [number, number] = [12, 20];

const LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];
const BARK = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44'];
const WOOD = ['#8a5a30', '#b8844c', '#dcae70', '#f4d49a'];
const GLOW = ['#d8861c', '#ffc040', '#ffe070', '#fff6c0', '#ffffff'];

const PAL: Pal = {
  k: '#140c1c', W: '#ffffff', e: '#ff7a3a',
  // thorns: tan, pale tips
  t: '#e8d8a0', T: '#a07a44',
  // leaves and stems
  l: LEAF[4], L: LEAF[5], d: LEAF[2], D: LEAF[3],
  // roots and legs
  r: BARK[2], R: BARK[3],
  // the stump's cut top: rings
  o: WOOD[2], O: WOOD[3], q: WOOD[1], Q: WOOD[0],
  // bark grooves
  g: BARK[1],
  // moth: fur, antennae, wing spots, lantern
  a: '#c8a878', y: GLOW[1], Y: GLOW[3], z: GLOW[0], E: '#3a2a5a',
  // acorn cap
  c: BARK[3], C: BARK[1],
  // seed glow (green)
  G: '#b4f070', j: '#5ac850', J: '#e8ffd0',
};
const SHADES: Record<string, Shade> = {
  b: { ramp: LEAF.slice(1), same: 'kWe', top: [4, 3], left: [3], right: [1], bottom: [0, 1], mid: 2 }, // the thornling's seed body
  B: { ramp: BARK, same: 'gkW', top: [4], left: [3], right: [1], bottom: [0], mid: 2 }, // bark
  f: { ramp: ['#7a5a48', '#a8846a', '#d0b08c', '#f0dcbc', '#fff4e0'], same: 'kW', top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 }, // moth fur
  w: { ramp: ['#3a2a5a', '#5e4a86', '#8a74b4', '#b8a4dc', '#e4d8f6'], same: 'E', top: [4], left: [3], right: [1], bottom: [0], mid: 2 }, // moth wings
  h: { ramp: ['#8a5a30', '#c08a50', '#e8b878', '#fcdca8', '#fff2d8'], same: 'kWe', top: [4, 3], left: [3], right: [1], bottom: [0], mid: 2 }, // the seedling's head
};

/**
 * Stamp a walker with its feet (the last `legs` rows) on ALLY_FEET, centred on the map's middle (+ dx); `bob` drops
 * the body over the planted feet (the idle's second frame), `sway` shifts its top `swayRows` rows (leaves) sideways.
 */
function onFeet(g: Grid, rows: string[], o: { dx?: number; legs?: number; bob?: number; sway?: number; swayRows?: number } = {}): void {
  const w = Math.max(...rows.map((r) => r.length));
  const n = o.legs ?? 2;
  const x0 = ALLY_FEET[0] - Math.floor(w / 2) + (o.dx ?? 0);
  const yFeet = ALLY_FEET[1] - n + 1;
  const body = rows.slice(0, rows.length - n);
  const sr = o.swayRows ?? 0;
  stampShaded(g, rows.slice(rows.length - n), PAL, SHADES, x0, yFeet);
  stampShaded(g, body.slice(sr), PAL, SHADES, x0, yFeet - body.length + sr + (o.bob ?? 0));
  if (sr) stampShaded(g, body.slice(0, sr), PAL, SHADES, x0 + (o.sway ?? 0), yFeet - body.length + (o.bob ?? 0));
}

// ------------------------------------------------------------------ thornling

const THORN = [
  '.....l.L.....',
  '....lLDLl....',
  '.....dDd.....',
  '......d......',
  '...t.bbb.t...',
  '..tbbbbbbbt..',
  '..bbbbbkbbk..',
  '.tbbbbbWkbWkt',
  '..bbbbbkkbkk.',
  '.tbbbbbbbbbb.',
  '..bbbbbbbbbbt',
  '...tbbbbbbt..',
  '....bbbbbb...',
  '....r....r...',
  '...rr...rr...',
];
/** The jab: leaning in, a vine arm thrusting a long thorn. */
const THORN_ACT = [
  '......l.L......',
  '.....lLDLl.....',
  '......dDd......',
  '.......d.......',
  '....t.bbb.t....',
  '...tbbbbbbbt...',
  '...bbbbbbkbbk..',
  '..tbbbbbbWkbWk.',
  '...bbbbbbkkbkk.',
  '..tbbbbbbbbbbDDtttT',
  '...bbbbbbbbbbt.....',
  '....tbbbbbbt...',
  '.....bbbbbb....',
  '...rr.....r....',
  '..rr.....rr....',
];

// ------------------------------------------------------------------ barkback

const STUMP = [
  '.......l.....',
  '......lL.....',
  '...qoooOoq...',
  '..qoOOooOoq..',
  '..QqoooooqQ..',
  '..BBBBBBBBB..',
  '..BgBBgBBgB..',
  '..BgBWkBgWk..',
  '..BgBkkBgkk..',
  '..BgBBgBBgB..',
  '..BBBBBBBBB..',
  '..BgBBgBBgB..',
  '...BBBBBBB...',
  '...rR...rR...',
  '..rrR..rrR...',
];
/** Bracing: squatted low, legs planted wide, a slab of bark held up in front by a twig arm. */
const STUMP_ACT = [
  '.......l..........',
  '......lL.....BB...',
  '...qoooOoq..BBBB..',
  '..qoOOooOoq.BgBB..',
  '..QqoooooqQ.BgBB..',
  '..BBBBBBBBBRBgBB..',
  '..BgBBgBkBkRBgBB..',
  '..BgBBgBkkk.BgBB..',
  '..BgBBgBBgB.BgBB..',
  '..BBBBBBBBB.BgBB..',
  '..BgBBgBBgB.BBBB..',
  '.rrBBBBBBBrr.BB...',
  'rrR.......rrR.....',
];

// ------------------------------------------------------------------ glowmoth

/** The moth hovering: wings up (0) or down (1); `bright` flares the lantern. */
function moth(up: boolean, bright: boolean): string[] {
  const wings = up
    ? [
        '..a.......a..',
        '...a.....a...',
        'ww..a.f.a..ww',
        'wwww.fff.wwww',
        'wEwwwfkfwwwEw',
        'wwwwwfffwwwww',
        '.wwwwfffwwww.',
        '..www.y.www..',
        '.....yYy.....',
        '.....yYy.....',
        '......y......',
      ]
    : [
        '..a.......a..',
        '...a.....a...',
        '....a.f.a....',
        '.....fff.....',
        '.wwwwfkfwwww.',
        'wwEwwfffwwEww',
        'wwwwwfffwwwww',
        '.wwww.y.wwww.',
        '..ww.yYy.ww..',
        '.....yYy.....',
        '......y......',
      ];
  if (!bright) return wings;
  // a bigger, whiter lantern
  return wings.map((r, i) => (i === 7 ? r.replace('.y.', 'yYy') : i === 8 || i === 9 ? r.replace('yYy', 'YWY') : i === 10 ? r.replace('.y.', 'yYy') : r));
}
/** The lantern flaring (the heal): rays of light out of it and four sparkles round the moth. */
function flare(g: Grid, cx: number, cy: number): void {
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ])
    for (let k = 3; k <= 5; k++) put(g, cx + dx * k, cy + dy * k, k === 5 ? GLOW[2] : GLOW[3]);
  for (const [dx, dy] of [
    [-9, -2],
    [9, -3],
    [-7, 6],
    [8, 6],
  ]) {
    put(g, cx + dx, cy + dy, GLOW[4]);
    put(g, cx + dx + 1, cy + dy, GLOW[2]);
    put(g, cx + dx - 1, cy + dy, GLOW[2]);
    put(g, cx + dx, cy + dy + 1, GLOW[2]);
    put(g, cx + dx, cy + dy - 1, GLOW[2]);
  }
}
function mothFrame(up: boolean, bright: boolean, bob: number): HTMLCanvasElement {
  const g = grid(ALLY_W, ALLY_H);
  const rows = moth(up, bright);
  const ox = Math.floor(ALLY_W / 2) - 6;
  const oy = 4 + bob;
  if (bright) flare(g, ox + 6, oy + 9);
  stampShaded(g, rows, PAL, SHADES, ox, oy);
  return toCanvas(g);
}

// ------------------------------------------------------------------ seedling

const SEEDLING = [
  '.....LL....',
  '....LlL....',
  '.....d.....',
  '...cccccc..',
  '..cCcCcCcc.',
  '..hhhhhhhh.',
  '..hhhhWkhWk',
  '..hhhhkkhkk',
  '..hhhhhhhh.',
  '...hhhhhhh.',
  '....hhhhh..',
  '...dd.Gj...',
  '....d.jj...',
  '...r...r...',
  '..rr..rr...',
];
/** Planting: bent over, pressing a glowing green seed into the ground, sparkles rising. */
const SEEDLING_ACT = [
  '..........LL..',
  '.........LlL..',
  '...cccccc.d...',
  '..cCcCcCcc....',
  '..hhhhhhhh....',
  '..hhhhhkhhk...',
  '..hhhhhhhhh...',
  '...hhhhhhhh...',
  '....hhhhhd....',
  '.....dd..d....',
  '...rr...dJGj..',
  '..rr....jGGj..',
];

// ------------------------------------------------------------------ build

function frame(paint: (g: Grid) => void): HTMLCanvasElement {
  const g = grid(ALLY_W, ALLY_H);
  paint(g);
  return toCanvas(g);
}

export function buildAllyArt(add: Add): void {
  add('ally_thornling_0', frame((g) => onFeet(g, THORN, { swayRows: 4 })));
  add('ally_thornling_1', frame((g) => onFeet(g, THORN, { bob: 1, swayRows: 4, sway: 1 })));
  add('ally_thornling_act', frame((g) => onFeet(g, THORN_ACT, { dx: 1, swayRows: 4, sway: -1 })));
  add('ally_barkback_0', frame((g) => onFeet(g, STUMP, { swayRows: 2 })));
  add('ally_barkback_1', frame((g) => onFeet(g, STUMP, { bob: 1, swayRows: 2, sway: 1 })));
  add('ally_barkback_act', frame((g) => onFeet(g, STUMP_ACT, { dx: 2, legs: 2 })));
  add('ally_glowmoth_0', mothFrame(true, false, 0));
  add('ally_glowmoth_1', mothFrame(false, false, 1));
  add('ally_glowmoth_act', mothFrame(true, true, 0));
  add('ally_seedling_0', frame((g) => onFeet(g, SEEDLING, { swayRows: 3 })));
  add('ally_seedling_1', frame((g) => onFeet(g, SEEDLING, { bob: 1, swayRows: 3, sway: 1 })));
  add(
    'ally_seedling_act',
    frame((g) => {
      onFeet(g, SEEDLING_ACT, { dx: 1 });
      for (const [x, y] of [
        [18, 8],
        [21, 11],
        [16, 5],
      ]) {
        put(g, x, y, '#e8ffd0');
        put(g, x, y + 1, '#b4f070');
      }
    }),
  );
}
