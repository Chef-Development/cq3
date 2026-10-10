// Region 4 foes (see docs/art-style.md and docs/content-bible.md section 7), drawn with art-frost.ts's helpers like
// art-ash.ts: character maps and shaded masks with an automatic ink outline, facing left. Every sprite has the frames
// the fighters view uses (idle0, idle1, windup, attack, hurt, flash, tell); the toad-king has a second look past half HP
// (`bellybog2_*`: he glows from inside like a paper lamp) and the boss a look per phase (`lighthouse2_*`,
// `lighthouse3_*`: each one of the mapmaker's edits). The fen is violet and teal at a dusk that never ends, so every
// foe carries a light of its own (a lantern, a wisp's flame, glowing spots or eyes) or a pale face to read against it.
//
// Textures (keyed by the enemy's `sprite`, as data/enemies-dusk.ts names them): `${sprite}_${pose}` and the two
// speakers' portraits (`portrait_bellybog`, `portrait_sluiceKeeper`). Painted in idle slices after boot (paintDuskFoeSlice,
// like Ashfell's) and added once done; a fight or scene that needs them sooner draws the rest at once
// (buildDuskFoeArt(add, true), scene.ensureDuskArt()).
import type { Pal } from './art';
import {
  anyOf,
  bezier,
  capsule,
  digits,
  dots,
  ell,
  fitFrames,
  hash2,
  limb,
  line,
  poly,
  render,
  shag,
  sweep,
  vol,
  type Add,
  type Mask,
  type Part,
  type PartOpts,
  type SpriteDef,
} from './art-frost';

/** Sprite names this file draws (each gets `${name}_${pose}` textures): data/enemies-dusk.ts's `sprite` fields. */
export const DUSK_SPRITES = [
  'bogwisp',
  'miretoad',
  'reedling',
  'peatgolem',
  'bellybog',
  'mudskipper',
  'stiltheron',
  'lamplighter',
  'oldsnapper',
  'sluicekeeper',
  'inkeel',
  'duskmoths',
  'boghag',
  'sunkensentinel',
  'lighthouse',
] as const;
export const DUSK_POSES = ['idle0', 'idle1', 'windup', 'attack', 'hurt', 'flash', 'tell'] as const;
/** The boss's phase looks (the mapmaker's two edits), the same size as `lighthouse_*`; the toad-king's lit belly. */
export const LIGHTHOUSE_PHASES = ['lighthouse2', 'lighthouse3'] as const;

/** Each sprite's main body colour (death-burst and hit chips), like ASH_COL. */
export const DUSK_COL: Record<string, number> = {
  bogwisp: 0x5ad8a8,
  miretoad: 0x5a6a2c,
  reedling: 0x7a8a3a,
  peatgolem: 0x4c3424,
  bellybog: 0x5a6a2c,
  bellybog2: 0xf0a020,
  mudskipper: 0x6a5648,
  stiltheron: 0x707c96,
  lamplighter: 0xc8901c,
  oldsnapper: 0x3e5628,
  sluicekeeper: 0x7e4c30,
  inkeel: 0x2c2444,
  duskmoths: 0x6e6478,
  boghag: 0x5c6e4a,
  sunkensentinel: 0x4e6870,
  lighthouse: 0xc8bcb8,
  lighthouse2: 0xc8bcb8,
  lighthouse3: 0x6e6670,
};

// ------------------------------------------------------------------ shared ramps (dark to light, hue-shifted)

const INK = '#140c1c';
/** Toad skin: blue-green in the shadow, warm olive to straw where the light lands. */
const BOG = ['#121a1a', '#1e2e22', '#34462a', '#526430', '#7a8a3a', '#aab25a'];
/** Peat: violet-black shadows, warm brown tops. */
const PEAT = ['#100c14', '#1e1620', '#302226', '#46322a', '#604632', '#7e603e'];
/** Reeds and rushes: teal-green shadow to a dry straw top. */
const REED = ['#14201e', '#1e3428', '#2e4e2e', '#4a6a32', '#74883a', '#a8a852'];
const CATTAIL = ['#1e0e10', '#3a1a16', '#5a2c1c', '#7e4224', '#a05e30', '#c48244'];
/** Mudskipper: grey-violet in shadow, a warm sandy brown on top. */
const MUD = ['#16121c', '#2a2230', '#423638', '#5e4e46', '#806c56', '#a69070'];
/** Heron feathers: slate blue to a warm off-white. */
const FEATHER = ['#1a1c30', '#2c344c', '#485470', '#707e98', '#a4aec2', '#dcdee6'];
const COAT = ['#0c0e22', '#141a36', '#202a4e', '#2e3e6a', '#46588a', '#6a7aa8'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e'];
const BRASS = ['#3a1e10', '#7a4614', '#b8781c', '#e4ac30', '#fadc72', '#fff4b4'];
const CLOAK = ['#120c14', '#22161e', '#36222a', '#4c3032', '#664438', '#845c44'];
/** Snapper shell: moss green, blue-black in the cracks, sunlit moss on top. */
const SHELL = ['#0c1614', '#16261e', '#223822', '#364e26', '#527030', '#7c9440'];
const HIDE = ['#14161c', '#262a2c', '#3a4038', '#545c48', '#727a58', '#969c70'];
/** Beaver fur. */
const FUR = ['#1c0e12', '#36201a', '#583224', '#7c4a30', '#a2683e', '#c48c54'];
const OVERALL = ['#0e1426', '#18223c', '#263656', '#364e74', '#4c6a94', '#6c8cb4'];
/** Ink eel: violet-black, a cold slate sheen on top. */
const INKY = ['#06040c', '#0e0a18', '#181428', '#241e3a', '#342c50', '#4a4268'];
const MOTH = ['#1a1424', '#2e263a', '#463c52', '#62586c', '#867c8e', '#b2a8b6'];
/** Hag skin: grey-green, a sickly warm top. */
const HAG = ['#141818', '#222c26', '#36442e', '#506038', '#6e7e48', '#98a462'];
const RAGS = ['#100e12', '#1c1a1e', '#2a2a28', '#3a3c32', '#4e543c', '#6a7048'];
/** Drowned armour: steel gone teal under the water, a pale glint where the dusk catches it. */
const ARMOR = ['#0e161e', '#1a2a32', '#2a4048', '#3e5a60', '#5e7e80', '#94b0ac'];
/** The lighthouse: lime-washed stone (violet in shadow, a rosy dusk on the lit side), red bands, grey stone legs. */
const PLASTER = ['#221e2e', '#3c3448', '#5e5466', '#887c8a', '#b8a8aa', '#e8d6c8'];
const BAND = ['#2a0c1a', '#521424', '#86202a', '#b43a34', '#dc6448', '#f49a70'];
const STONE = ['#100e18', '#1e1c28', '#302c3a', '#46404e', '#5e5664', '#7c7280'];
const IRONR = ['#0a0810', '#18141e', '#28222e', '#3a3240', '#504654'];
/** Erased land (the fog ramp): the edits rub the drawing back to paper. */
const FOG = ['#3e3a4c', '#6a6478', '#9a94a8', '#c8c2d2', '#ece8f0', '#ffffff'];

/** Glow letters every palette here shares: lantern light (warm), wisp fire (cold), water, smoke, eyes. */
const GLOW: Pal = {
  k: INK,
  W: '#ffffff',
  // lantern light, deep to white-hot
  Q: '#7a2a12',
  q: '#c45a1a',
  x: '#f09428',
  X: '#ffcc52',
  Z: '#fff4c4',
  // wisp fire, teal to white-green
  a: '#0e3640',
  b: '#1a6a6a',
  c: '#2aa88a',
  d: '#6ae0b0',
  e: '#d0fce6',
  // water and foam
  u: '#1c3440',
  w: '#3e6a72',
  v: '#7aaab0',
  V: '#d4eeea',
  // smoke and fog
  s: '#cec6d6',
  S: '#8e86a0',
  // eyes and teeth
  y: '#f2d040',
  Y: '#fff8b0',
  r: '#c83a30',
  t: '#f0e8d0',
  n: '#2a1a24', // a mouth's dark
  // violet glow (ink spots, the moths' eyes)
  p: '#7a3cb0',
  P: '#c890ff',
  O: '#f4e0ff',
  // tongue
  g: '#c0506a',
  G: '#f08aa0',
  // pencil (the mapmaker's edits)
  l: '#5a5468',
  L: '#8a8498',
};

type Pts = [number, number][];
const parts = (spec: Record<string, Pts>, o?: PartOpts): Part => dots(Object.entries(spec).filter(([, p]) => p.length) as [string, Pts][], o);
/** A shaded volume with its interior contour in the ramp's darkest tone. */
const V = (m: Mask, box: [number, number, number, number], light: [number, number, number, number], ramp: string[], o: PartOpts = {}): Part => vol(m, box, light, ramp, { edge: ramp[0], ...o });
const round = (cx: number, cy: number, rx: number, ry: number, ramp: string[], o: PartOpts = {}): Part =>
  V(ell(cx, cy, rx, ry), [Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1)], [cx - rx * 0.35, cy - ry * 0.4, rx * 1.2, ry * 1.2], ramp, o);

/** A flame (warm lantern fire or a wisp's cold fire) licking up from (cx, base), `h` tall and `w` wide. Drawn late. */
function flame(cx: number, base: number, h: number, w: number, f: number, cold = false, lean = 0): Part {
  const L = cold ? ['a', 'b', 'c', 'd', 'e'] : ['Q', 'q', 'x', 'X', 'Z'];
  const pts: Record<string, Pts> = Object.fromEntries(L.map((c) => [c, []]));
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const sway = Math.sin(t * 3 + f * 1.9) * t * 1.1 + lean * t * t * h * 0.3;
    const half = (w / 2) * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI * 0.5);
    const c2 = cx + sway;
    for (let x = Math.floor(c2 - half - 0.5); x <= c2 + half + 0.5; x++) {
      const u = Math.abs(x + 0.5 - c2) / Math.max(0.6, half);
      if (u > 1.05) continue;
      const k = (1 - u) * (1 - t * 0.7);
      pts[k > 0.6 && t < 0.55 ? L[4] : k > 0.4 ? L[3] : k > 0.2 ? L[2] : t > 0.7 || u > 0.85 ? L[0] : L[1]].push([x, base - y]);
    }
  }
  return parts(pts, { pal: GLOW, late: true });
}

/** A puff of smoke, steam or fog (r 1-3), lit on its upper left. Drawn late. */
function puff(x: number, y: number, r: number): Part {
  const pts: Record<string, Pts> = { s: [], S: [] };
  for (let yy = -r; yy <= r; yy++)
    for (let xx = -r - 1; xx <= r + 1; xx++) {
      const d = ((xx + 0.5) / (r + 1)) ** 2 + ((yy + 0.5) / (r + 0.4)) ** 2;
      if (d > 1) continue;
      pts[xx + yy < -r * 0.4 ? 's' : d > 0.5 ? 'S' : 's'].push([x + xx, y + yy]);
    }
  return parts(pts, { pal: GLOW, late: true });
}

/** Water drops and foam flung up (late single pixels and pairs). */
const drops = (pts: Pts): Part =>
  parts({ V: pts.filter((_, i) => i % 3 === 0), v: pts.filter((_, i) => i % 3 === 1), w: pts.filter((_, i) => i % 3 === 2) }, { pal: GLOW, late: true });

/** A small lantern (5 wide, 7 tall from its ring at (x, y)): an iron cap and base, a glowing pane; `lit` 0..2. */
function lantern(x: number, y: number, lit: number, o: PartOpts = {}): Part[] {
  const glass = lit >= 2 ? ['XZX', 'xXx', 'qxq'] : lit === 1 ? ['xXx', 'qxq', 'QqQ'] : ['QqQ', 'kQk', 'kkk'];
  return [
    [['.4.', '424', '22222'.slice(0, 3)], x + 1, y, { pal: digits(IRONR), edge: IRONR[0], ...o }],
    [['2' + glass[0] + '1', '2' + glass[1] + '1', '2' + glass[2] + '1', '22111'], x, y + 3, { pal: { ...GLOW, ...digits(IRONR) }, ...o }],
  ];
}

/** Eyes: a 2x2 glowing eye (lantern gold or wisp green) or a shut slit. */
const glowEye = (x: number, y: number, shut = false, cold = false): Part =>
  shut ? [[cold ? 'bb' : 'qq'], x, y + 1, { pal: GLOW }] : [[cold ? 'de' : 'XZ', cold ? 'cd' : 'xX'], x, y, { pal: GLOW }];

// ------------------------------------------------------------------ bog wisp (a will-o'-wisp with a sly face)

function wispParts(pose: string): Part[] {
  let hx = 10; // the head's centre (the round of the flame)
  let hy = 15;
  let r = 6;
  let tail: [number, number] = [23, 3];
  let f = 0;
  let dim = 0; // tones knocked down (hurt)
  let eyes: 'sly' | 'wide' | 'shut' = 'sly';
  let grin = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      hy = 14;
      tail = [24, 4];
      f = 1;
      break;
    case 'windup':
      hx = 12;
      r = 7;
      tail = [22, 1];
      f = 2;
      eyes = 'wide';
      grin = 2;
      break;
    case 'attack':
      hx = 6;
      hy = 16;
      tail = [25, 9];
      f = 3;
      eyes = 'wide';
      grin = 3;
      extra.push(parts({ d: [[0, 14], [-2, 17]], c: [[1, 19], [-1, 12]] }, { pal: GLOW, late: true }));
      break;
    case 'hurt':
      hx = 12;
      r = 5;
      tail = [21, 6];
      f = 2;
      dim = 1;
      eyes = 'shut';
      grin = 0;
      break;
    case 'tell':
      // Lure!: a little light dangles under it on a thread of fire (and a second, dimmer one): one is a yellow
      hy = 12;
      tail = [24, 2];
      f = 1;
      grin = 2;
      extra.push(line(hx - 3, hy + 5, hx - 6, hy + 10, 'c', { pal: GLOW, late: true }), line(hx + 1, hy + 6, hx + 2, hy + 9, 'b', { pal: GLOW, late: true }));
      extra.push([['.X.', 'XZX', '.X.'], hx - 8, hy + 10, { pal: GLOW }], [['p.', 'pP'], hx + 1, hy + 10, { pal: GLOW }]);
      break;
  }
  // the flame: a round head with a tail of fire trailing up and back, hottest at its core (upper left of the head)
  const body: Mask = (x, y) => {
    if (ell(hx, hy, r, r * 0.95)(x, y)) return true;
    // the tail: a tapering, wavering capsule from the head up to the tip
    const dx = tail[0] - hx;
    const dy = tail[1] - hy;
    const L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x + 0.5 - hx) * dx + (y + 0.5 - hy) * dy) / L2));
    const wob = Math.sin(t * 7 + f * 1.6) * 1.1 * t;
    const px = hx + dx * t + wob;
    const py = hy + dy * t;
    const rr = r * (1 - t) ** 0.9 + 0.4;
    return (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= rr * rr;
  };
  const pts: Record<string, Pts> = { a: [], b: [], c: [], d: [], e: [] };
  const T = ['a', 'b', 'c', 'd', 'e'];
  for (let y = -2; y < 26; y++)
    for (let x = -2; x < 30; x++) {
      if (!body(x, y)) continue;
      const d = Math.hypot(x + 0.5 - (hx - 1.5), y + 0.5 - (hy - 1.5)) / (r + 1);
      const along = Math.max(0, ((x - hx) * (tail[0] - hx) + (y - hy) * (tail[1] - hy)) / ((tail[0] - hx) ** 2 + (tail[1] - hy) ** 2));
      let k = d < 0.3 ? 4 : d < 0.55 ? 3 : d < 0.85 ? 2 : 1;
      k = Math.min(k, along > 0.75 ? 1 : along > 0.45 ? 2 : 4);
      if ((!body(x, y - 1) || !body(x - 1, y)) && along > 0.2) k = Math.min(3, k + 1); // the tail's lit top edge
      if (!body(x, y + 1) || !body(x + 1, y)) k = Math.max(0, Math.min(k, 1)); // the shadow edges (bottom, right)
      pts[T[Math.max(0, k - dim)]].push([x, y]);
    }
  const face: Part[] = [];
  if (eyes === 'shut') face.push(parts({ a: [[hx - 4, hy - 1], [hx - 3, hy - 1], [hx, hy - 1], [hx + 1, hy - 1]] }, { pal: GLOW }));
  else if (eyes === 'wide') face.push([['aa', 'kW'], hx - 5, hy - 2, { pal: GLOW }], [['aa', 'kW'], hx - 1, hy - 2, { pal: GLOW }]);
  else face.push([['aaa', '.kW'], hx - 6, hy - 2, { pal: GLOW }], [['aaa', '.kW'], hx - 2, hy - 2, { pal: GLOW }]);
  // the sly grin, curling up at the back
  if (grin === 1) face.push(parts({ a: [[hx - 5, hy + 2], [hx - 4, hy + 3], [hx - 3, hy + 3], [hx - 2, hy + 3], [hx - 1, hy + 2], [hx, hy + 1]] }, { pal: GLOW }));
  else if (grin) face.push(parts({ n: Array.from({ length: 5 }, (_, i): [number, number] => [hx - 5 + i, hy + 2]).concat(grin >= 2 ? Array.from({ length: 3 }, (_, i): [number, number] => [hx - 4 + i, hy + 3]) : []), a: [[hx, hy + 1], [hx - 6, hy + 1]] }, { pal: GLOW }));
  // sparks shed off the tail
  const sp: Pts = [
    [tail[0] + 2, tail[1] + 3 + f],
    [tail[0] - 3, tail[1] + 6 - (f % 2)],
    [tail[0] + 4, tail[1] + 7 - f],
  ];
  return [parts(pts, { pal: GLOW }), ...face, parts({ d: sp.slice(0, 2), e: sp.slice(2) }, { pal: GLOW, late: true }), ...extra];
}

// ------------------------------------------------------------------ mire toad (fat, lazy, a lantern-orange throat)

function toadParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let sac = 1; // the throat sac: 0 flat, 1 a little, 2 full and glowing
  let lids = 1; // 0 open, 1 lazy, 2 shut
  let mouth = 0;
  let stretch = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      sac = 0;
      by = 0;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      lids = 0;
      sac = 0;
      break;
    case 'attack':
      bx = -3;
      by = -1;
      stretch = 2;
      lids = 0;
      mouth = 2;
      break;
    case 'hurt':
      bx = 2;
      lids = 2;
      sac = 0;
      mouth = 1;
      break;
    case 'tell':
      // Gulp!: the sac blown up huge and glowing with the light it swallowed, eyes shut in bliss
      sac = 2;
      lids = 2;
      by = -1;
      extra.push(parts({ X: [[0, 9], [2, 7]], x: [[-2, 12], [1, 5]] }, { pal: GLOW, late: true }));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const body = anyOf(ell(X(17) + stretch * 0.5, Y(12), 11 + stretch, 7), ell(X(9) - stretch, Y(10), 7.5, 5.6));
  const out: Part[] = [];
  // the far hind leg, then the body, the near haunch and the front leg
  out.push(round(X(25), Y(16), 4, 3, BOG.map((_, i) => BOG[Math.max(0, i - 1)])));
  out.push(V(body, [X(0) - stretch * 2, Y(3), X(30) + stretch, Y(20)], [X(10), Y(6), 14, 8], BOG));
  out.push(V(ell(X(23), Y(14), 5.5, 4.5), [X(16), Y(9), X(30), Y(20)], [X(21), Y(12), 5, 4], BOG));
  out.push([['5543', '4432', '..33', '.333', '3322'.slice(0, 4)], X(26), Y(16), { pal: digits(BOG), edge: BOG[0] }]);
  out.push([['.43', '432', '33.', '322'], X(5) - stretch, Y(14), { pal: digits(BOG), edge: BOG[0] }]);
  // warts on the back, a shade darker
  out.push(parts({ 3: [[X(15), Y(7)], [X(19), Y(8)], [X(22), Y(10)], [X(17), Y(10)]], 2: [[X(15), Y(8)], [X(22), Y(11)]] }, { pal: digits(BOG) }));
  // the throat sac under the chin, lantern orange
  if (sac) {
    const rx = sac === 2 ? 6 : 3.6;
    const ry = sac === 2 ? 5 : 2.6;
    const cx = X(6) - stretch;
    const cy = Y(14) + (sac === 2 ? 2 : 0);
    const sp: Record<string, Pts> = { Q: [], q: [], x: [], X: [], Z: [] };
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d > 1) continue;
        const lx = (x - cx) / rx + (y - cy) / ry;
        sp[sac === 2 ? (d < 0.3 ? 'Z' : d < 0.6 ? 'X' : 'x') : lx < -0.6 ? 'x' : d > 0.6 ? 'Q' : 'q'].push([x, y]);
      }
    out.push(parts(sp, { pal: GLOW }));
  }
  // the long lazy mouth
  const my = Y(12);
  if (mouth === 2) out.push([['nnnnnnnn', '.gGGgnn.', '..gggn..'], X(0) - stretch, my, { pal: GLOW }]);
  else out.push(line(X(1) - stretch, my, X(11), my + 1, mouth ? 'n' : '1', { pal: { ...GLOW, ...digits(BOG) } }));
  // the bulging eyes on top: a gold iris with a slit pupil under a heavy lid
  for (const ex of [X(5) - stretch, X(10) - stretch]) {
    out.push(round(ex + 1, Y(5), 2.4, 2.2, BOG));
    if (lids === 2) out.push([['111', '.1.'], ex, Y(5), { pal: digits(BOG) }]);
    else out.push([lids ? ['333', 'kyk'] : ['yyy', 'kyk'], ex, Y(4) + (lids ? 0 : 0), { pal: { ...GLOW, ...digits(BOG) } }]);
  }
  return [...out, ...extra];
}

// ------------------------------------------------------------------ reedling (a little man of reeds, a cattail hat)

function reedParts(pose: string): Part[] {
  let lean = 0;
  let sway = 0;
  let pipe: [number, number, number, number] = [7, 12, 1, 14]; // mouth end, far end
  let arms: [number, number] = [6, 18]; // the near hand
  let splay = 0;
  let eyes = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      sway = 1;
      break;
    case 'windup':
      lean = 2;
      pipe = [8, 11, 4, 2];
      arms = [6, 10];
      break;
    case 'attack':
      lean = -2;
      pipe = [6, 14, -2, 22];
      arms = [4, 18];
      break;
    case 'hurt':
      lean = 2;
      sway = 1;
      eyes = false;
      pipe = [8, 15, 3, 24];
      arms = [7, 20];
      break;
    case 'tell':
      // Rustle!: arms up, its reeds splayed out like a fan, rustling
      splay = 1;
      pipe = [5, 6, 2, 0];
      arms = [4, 7];
      extra.push(parts({ v: [[0, 16], [1, 17], [19, 14], [20, 13], [21, 18], [2, 22]], V: [[19, 9], [1, 10]] }, { pal: GLOW, late: true }));
      break;
  }
  const F = 31; // feet
  const out: Part[] = [];
  // legs: two reed stalks
  out.push(limb(9, 25, 8 + Math.min(0, lean), F, '2', { pal: digits(REED) }));
  out.push(limb(12, 25, 13 + Math.max(0, lean), F, '3', { pal: digits(REED) }));
  // the bundle of reeds: vertical stalks, lit on the left, tied at the waist
  const pts: Record<string, Pts> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (let i = 0; i < 8; i++) {
    const x0 = 6 + i;
    const top = 8 - (i % 3 === 1 ? 2 : i % 3 === 2 ? 1 : 0) - (splay ? Math.abs(i - 3.5) > 2 ? 2 : 0 : 0);
    for (let y = top; y <= 26; y++) {
      const t = (26 - y) / 18;
      const fan = splay ? (i - 3.5) * t * t * 1.6 : 0;
      const x = Math.round(x0 + (lean + sway) * t + fan);
      const tone = i === 0 ? 4 : i < 3 ? (i % 2 ? 3 : 4) : i < 6 ? (i % 2 ? 2 : 3) : i === 7 ? 1 : 2;
      pts[y === top ? Math.min(5, tone + 1) : tone].push([x, y]);
    }
  }
  out.push(parts(pts, { pal: digits(REED), edge: REED[0] }));
  // the waist tie of cattail brown
  out.push([['3333333344'.slice(0, 9), '222222222'], 6 + Math.round(lean * 0.3), 19, { pal: digits(CATTAIL), edge: CATTAIL[0] }]);
  // the face peeking out between the reeds
  const fx = 7 + Math.round((lean + sway) * 0.8);
  if (eyes) out.push([['k.k', 'y.y'], fx, 12, { pal: GLOW }]);
  else out.push([['k.k'], fx, 13, { pal: GLOW }]);
  // the cattail hat on its stalk
  const hx = 10 + Math.round((lean + sway) * 1.2) + (splay ? 0 : 0);
  out.push(limb(hx, 3, hx + sway, 7, '4', { pal: digits(REED) }));
  out.push(capsule(hx + sway + 0.5, 1, hx + sway + 0.5, 5, 1.7, 1.7, '3', { pal: digits(CATTAIL), edge: CATTAIL[0] }));
  out.push(parts({ 5: [[hx + sway - 1, 1]], 4: [[hx + sway - 1, 2], [hx + sway - 1, 3]] }, { pal: digits(CATTAIL) }));
  // the near arm and the reed pipe (pale cane)
  out.push(limb(9, 16, arms[0], arms[1], '2', { pal: digits(REED) }));
  out.push(limb(pipe[0], pipe[1], pipe[2], pipe[3], '4', { pal: digits(WOOD) }));
  out.push(parts({ 2: [[pipe[2], pipe[3]]] }, { pal: digits(WOOD) }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ peat golem (roots and peat, a caged lantern heart)

function golemParts(pose: string): Part[] {
  let fist: [number, number] = [6, 36]; // the near fist
  let back: [number, number] = [38, 34];
  let bx = 0;
  let lit = 2;
  let eyes = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      lit = 1;
      fist = [6, 37];
      break;
    case 'windup':
      fist = [8, 4];
      bx = 2;
      break;
    case 'attack':
      fist = [0, 40];
      bx = -3;
      extra.push(drops([[-4, 41], [4, 39], [-6, 38], [2, 42], [-2, 37]]));
      break;
    case 'hurt':
      bx = 2;
      eyes = false;
      lit = 1;
      fist = [10, 36];
      extra.push(parts({ 3: [[-1, 14], [2, 10]], 2: [[0, 18], [41, 12]] }, { pal: digits(PEAT), late: true }));
      break;
    case 'tell':
      // Smother!: a great hand cupped over its own lantern heart; the other raised for the slam
      fist = [21, 21];
      back = [40, 6];
      lit = 0;
      break;
  }
  const X = (x: number) => x + bx;
  const out: Part[] = [];
  // the far arm
  out.push(capsule(X(32), 14, back[0] + bx, back[1], 4.2, 3.6, '2', { pal: digits(PEAT.map((_, i) => PEAT[Math.max(0, i - 1)])), edge: PEAT[0] }));
  out.push(round(back[0] + bx, back[1] + 2, 4.5, 4, PEAT.map((_, i) => PEAT[Math.max(0, i - 1)])));
  // legs: stumps of packed peat
  out.push(V(poly([[X(12), 30], [X(20), 30], [X(21), 43], [X(10), 43]]), [X(9), 29, X(22), 43], [X(13), 32, 6, 8], PEAT));
  out.push(V(poly([[X(25), 30], [X(33), 30], [X(35), 43], [X(25), 43]]), [X(24), 29, X(36), 43], [X(27), 32, 6, 8], PEAT));
  // the torso: a hunched heap, shoulders high
  const torso = anyOf(ell(X(22), 21, 13, 11.5), ell(X(16), 13, 9, 7), ell(X(29), 14, 8, 6));
  out.push(V(torso, [X(7), 4, X(37), 34], [X(16), 11, 16, 14], PEAT));
  // moss on the shoulders and roots trailing off the belly
  out.push(parts({ 4: [[X(11), 7], [X(12), 6], [X(13), 6], [X(14), 7], [X(24), 8], [X(25), 8], [X(26), 9]], 5: [[X(12), 5], [X(13), 5], [X(25), 7]], 3: [[X(10), 8], [X(15), 8], [X(27), 9]] }, { pal: digits(REED) }));
  for (const [rx, len] of [
    [13, 5],
    [19, 3],
    [29, 4],
  ] as const)
    out.push(line(X(rx), 31, X(rx) + 1, 31 + len, '1', { pal: digits(PEAT) }));
  // the caged lantern in its chest
  const glass = lit === 2 ? ['XZX', 'ZZX', 'XXx'] : lit === 1 ? ['xXx', 'XXx', 'qxq'] : ['QqQ', 'qQQ', 'QQk'];
  out.push([['.2222.', '2' + glass[0].split('').join('') + '22', '2' + glass[1] + '22', '1' + glass[2] + '11', '.1111.'], X(20), 17, { pal: { ...GLOW, ...digits(IRONR) } }]);
  out.push(parts({ 4: [[X(22), 17], [X(22), 18], [X(22), 19], [X(22), 20]] }, { pal: digits(IRONR) }));
  // the small sunken head and its lantern eyes
  out.push(round(X(13), 9, 5, 4.4, PEAT));
  if (eyes) out.push(glowEye(X(9), 8), glowEye(X(13), 8));
  else out.push(glowEye(X(9), 8, true), glowEye(X(13), 8, true));
  // the near arm: a heavy root-wound limb ending in a great fist
  out.push(capsule(X(14), 15, fist[0] + bx, fist[1], 4.6, 4, '2', { pal: digits(PEAT), edge: PEAT[0] }));
  out.push(round(fist[0] + bx, fist[1], 5, 4.4, PEAT));
  out.push(line(X(13), 17, fist[0] + bx + 2, fist[1] - 3, '4', { pal: digits(PEAT) }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ Old Bellybog (a toad the size of a hut, full of lanterns)

function bellybogParts(pose: string, phase: number): Part[] {
  let bx = 0;
  let by = 0;
  let lids = 1;
  let mouth = 0; // 0 shut, 1 a little, 2 gaping, 3 the tongue lashing out
  let breathe = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      breathe = 1;
      break;
    case 'windup':
      bx = 2;
      by = -1;
      lids = 0;
      mouth = 1;
      break;
    case 'attack':
      bx = -2;
      lids = 0;
      mouth = 3;
      break;
    case 'hurt':
      bx = 2;
      lids = 2;
      mouth = 1;
      break;
    case 'tell':
      // Gulp! (and, past half HP, Burp!): the great mouth wide open, the air (and the light) swirling in
      by = -1;
      lids = 2;
      mouth = 2;
      extra.push(
        parts(
          phase > 1
            ? { X: [[-6, 26], [-3, 22], [-8, 31]], Z: [[-5, 24]], x: [[-1, 20], [-9, 28], [-4, 33]] }
            : { v: [[-6, 27], [-5, 26], [-8, 30], [-7, 31], [-3, 21], [-2, 22]], V: [[-4, 24], [-9, 33]], S: [[-1, 34], [0, 35]] },
          { pal: GLOW, late: true },
        ),
      );
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const lit = phase > 1;
  const out: Part[] = [];
  // the far hind leg and the far front leg
  out.push(round(X(54), Y(38), 6, 5, BOG.map((_, i) => BOG[Math.max(0, i - 1)])));
  // the great body: a dome of a back, the head running into it at the front
  const body = anyOf(ell(X(37), Y(29), 26, 15 + breathe * 0.6), ell(X(19), Y(27), 17, 12.5));
  out.push(V(body, [X(1), Y(11), X(64), Y(46)], [X(24), Y(17), 30, 18], BOG));
  // the belly: pale and soft, and full of lanterns glowing through the skin (past half HP he lights up like a paper lamp)
  const belly = ell(X(32), Y(38), 21, 7.5 + breathe * 0.5);
  const bp: Record<string, Pts> = { 3: [], 4: [], 5: [], Q: [], q: [], x: [], X: [], Z: [] };
  const lamps: [number, number][] = [
    [X(22), Y(38)],
    [X(32), Y(40)],
    [X(42), Y(37)],
    [X(28), Y(35)],
    [X(47), Y(41)],
  ];
  for (let y = Y(30); y <= Y(46); y++)
    for (let x = X(10); x <= X(54); x++) {
      if (!belly(x, y) || !body(x, y)) continue;
      const near = Math.min(...lamps.map(([lx, ly]) => Math.hypot(x + 0.5 - lx, (y + 0.5 - ly) * 1.3)));
      if (lit) bp[near < 1.6 ? 'Q' : near < 2.6 ? 'Z' : y < Y(36) ? 'X' : near < 5 ? 'X' : 'x'].push([x, y]);
      else bp[near < 1.5 ? 'X' : near < 2.6 ? 'x' : near < 3.6 ? 'q' : y < Y(36) ? '5' : y < Y(42) ? '4' : '3'].push([x, y]);
    }
  out.push(parts(bp, { pal: { ...GLOW, ...digits(['#20281c', '#36402a', '#5a6236', '#8e8e4e', '#bcb070', '#d8cc8e']) } }));
  // the near haunch, its foot splayed on the ground; the front leg with its toes
  out.push(V(ell(X(52), Y(35), 9, 8), [X(42), Y(26), X(62), Y(44)], [X(49), Y(31), 8, 7], BOG));
  out.push([['..4433', '.44332', '443322', '3322.2', '2.2...'], X(55), Y(42), { pal: digits(BOG), edge: BOG[0] }]);
  out.push(V(poly([[X(9), Y(36)], [X(15), Y(35)], [X(16), Y(44)], [X(8), Y(44)]]), [X(7), Y(34), X(17), Y(45)], [X(11), Y(37), 4, 5], BOG));
  out.push([['4.4.4', '33333'], X(6), Y(44), { pal: digits(BOG), edge: BOG[0] }]);
  // warts in clusters on the back
  out.push(
    parts(
      {
        3: [[X(34), Y(17)], [X(35), Y(17)], [X(44), Y(19)], [X(48), Y(23)], [X(40), Y(24)], [X(29), Y(21)], [X(56), Y(27)]],
        2: [[X(34), Y(18)], [X(44), Y(20)], [X(48), Y(24)], [X(56), Y(28)]],
        5: [[X(39), Y(16)], [X(52), Y(20)]],
      },
      { pal: digits(BOG) },
    ),
  );
  // the mouth: a long, wide line under the snout (gaping: a dark maw with the light inside)
  const my = Y(29);
  if (mouth >= 2) {
    const maw: Pts = [];
    for (let x = X(2); x <= X(26); x++) for (let y = my - 1; y <= my + Math.round(5 * Math.sin(((x - X(2)) / 24) * Math.PI)); y++) maw.push([x, y]);
    out.push(parts({ n: maw }, { pal: GLOW }));
    out.push(parts(lit ? { X: [[X(10), my + 2], [X(11), my + 2], [X(12), my + 3]], Z: [[X(11), my + 3]] } : { q: [[X(10), my + 2], [X(11), my + 3]], g: [[X(14), my + 2], [X(15), my + 2]] }, { pal: GLOW }));
  } else if (mouth === 3) {
    // Tongue Lash!: the tongue whips out far to the left
    out.push(parts({ n: Array.from({ length: 18 }, (_, i): [number, number] => [X(3) + i, my]) }, { pal: GLOW }));
    out.push(capsule(X(4), my + 1, X(-10), my + 3, 1.6, 1.4, 'g', { pal: GLOW }));
    out.push(round(X(-11), my + 3, 2.6, 2.2, ['#5a1a2a', '#8a2a40', '#c0506a', '#e07090', '#f08aa0', '#ffc0cc']));
  } else out.push(bezierLine(X(2), my, X(14), my + 3, X(27), my + 1, mouth ? 'n' : '0', { ...GLOW, ...digits(BOG) }));
  // the eyes: huge domes, heavy-lidded and sleepy (glowing gold once he's lit)
  for (const [ex, ey] of [
    [X(10), Y(16)],
    [X(21), Y(13)],
  ] as const) {
    out.push(round(ex + 2, ey + 1, 3.6, 3.3, BOG));
    if (lids === 2) out.push([['22222', '.111.'], ex, ey + 1, { pal: digits(BOG) }]);
    else out.push([lids ? ['44444', 'kyYyk'] : ['.YYY.', 'yykyy'], ex, ey, { pal: { ...GLOW, ...digits(BOG) } }]);
    if (lit && lids !== 2) out.push(parts({ Z: [[ex + 2, ey + 1]] }, { pal: GLOW }));
  }
  // his crown: a lily pad on his head with a swallowed lantern standing on it
  out.push([['..333333..', '.33444443.', '3344554443', '.2233332..'], X(12), Y(9), { pal: digits(REED), edge: REED[0] }]);
  out.push(...lantern(X(15), Y(1), lit ? 2 : 1));
  return [...out, ...extra];
}

/** A 1px quadratic curve through (x0, y0), (cx, cy) and (x1, y1). */
function bezierLine(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, ch: string, pal: Pal): Part {
  const pts: Pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const u = 1 - t;
    const p: [number, number] = [Math.round(u * u * x0 + 2 * u * t * cx + t * t * x1), Math.round(u * u * y0 + 2 * u * t * cy + t * t * y1)];
    if (!pts.some(([a, b]) => a === p[0] && b === p[1])) pts.push(p);
  }
  return dots([[ch, pts]], { pal });
}

// ------------------------------------------------------------------ mudskipper (goggle eyes, standing on its fins)

function skipperParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let curl = 0;
  let eyes = 'L'; // pupils looking left; 'X' dizzy
  let grin = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      curl = 1;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      curl = 2;
      break;
    case 'attack':
      bx = -4;
      by = -2;
      grin = 2;
      break;
    case 'hurt':
      bx = 2;
      eyes = 'X';
      grin = 0;
      break;
    case 'tell':
      // Splash!: a leap straight up, the water thrown high round where it was
      by = -5;
      curl = 2;
      grin = 2;
      extra.push(drops([[2, 20], [3, 18], [5, 16], [21, 19], [22, 17], [20, 15], [8, 21], [17, 21], [1, 15], [23, 14], [12, 21]]));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const out: Part[] = [];
  // the body: from the big head down and back to a tail curled on the ground
  const path = bezier([
    [X(9), Y(10)],
    [X(14), Y(14)],
    [X(18), Y(20)],
    [X(23) + curl, Y(17) - curl],
  ]);
  out.push(
    sweep(
      path,
      (t) => 5.2 - t * 4.2,
      (t, side, lit) => {
        if (side > 0.5 && t < 0.6) return '4'; // the pale belly
        if (side < -0.3 && (Math.floor(t * 30) % 4 === 0) && t > 0.15 && t < 0.8) return 'P'; // blue spots
        return lit > 0.45 ? '5' : lit > 0 ? '4' : lit > -0.4 ? '3' : '2';
      },
      100,
      { pal: { ...GLOW, ...digits(MUD), P: '#6aa8d8' }, edge: MUD[0] },
    ),
  );
  // the dorsal fin, a spiky sail along the back
  out.push([['1.1.1.', '212121', '.2222.'], X(12), Y(8), { pal: digits(['#2a1a3a', '#4a3060', '#7a5a9a']), edge: '#2a1a3a' }]);
  // the head, big and blunt
  out.push(round(X(8), Y(9), 6, 5, MUD));
  // pectoral fins as little arms it stands on
  out.push(limb(X(8), Y(13), X(4), Y(19) - Math.min(0, by), '3', { pal: digits(MUD) }));
  out.push(parts({ 2: [[X(3), Y(19) - Math.min(0, by)], [X(4), Y(19) - Math.min(0, by)], [X(5), Y(19) - Math.min(0, by)]] }, { pal: digits(MUD) }));
  // the goggle eyes on top
  for (const ex of [X(4), X(9)]) {
    out.push(round(ex + 1.5, Y(3) + 1.5, 2.6, 2.6, ['#5a5e70', '#9aa0b0', '#c8ccd6', '#e8eaf0', '#ffffff', '#ffffff']));
    out.push(eyes === 'X' ? [['k.k', '.k.', 'k.k'], ex, Y(2), { pal: GLOW }] : [['kk', 'kW'], ex, Y(3), { pal: GLOW }]);
  }
  // the cheeky grin
  out.push(grin === 2 ? [['nnnnn', '.tnt.'], X(2), Y(10), { pal: GLOW }] : grin ? bezierLine(X(2), Y(10), X(5), Y(12), X(9), Y(10), 'n', GLOW) : line(X(2), Y(11), X(7), Y(11), 'n', { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ stilt heron (a ferryman on stilts, a punt-pole spear)

function heronParts(pose: string): Part[] {
  let head: [number, number] = [9, 6]; // the crown of the head
  let neckMid: [number, number] = [15, 13];
  let pole: [number, number, number, number] = [6, 46, 7, 2]; // foot, tip
  let crouch = 0;
  let wing = 0;
  let eye = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      head = [9, 7];
      neckMid = [16, 14];
      break;
    case 'windup':
      head = [13, 8];
      neckMid = [18, 14];
      pole = [14, 40, 20, 4];
      break;
    case 'attack':
      head = [5, 9];
      neckMid = [11, 15];
      pole = [24, 20, -6, 22];
      crouch = 1;
      break;
    case 'hurt':
      head = [14, 5];
      neckMid = [18, 12];
      eye = false;
      pole = [4, 46, 9, 4];
      break;
    case 'tell':
      // Spear Dive!: crouched low on its stilts, wings spread, the spear levelled at the hero
      head = [7, 12];
      neckMid = [13, 16];
      pole = [26, 22, -4, 24];
      crouch = 3;
      wing = 1;
      break;
  }
  const F = 47;
  const out: Part[] = [];
  // the stilts: two poles with foot-straps, the bird's own thin orange legs on top
  const hip = 31 + crouch;
  out.push(limb(12, hip + 1, 11, F, '3', { pal: digits(WOOD) }), limb(17, hip + 1, 18, F, '4', { pal: digits(WOOD) }));
  out.push(parts({ 1: [[11, hip + 6], [12, hip + 6], [18, hip + 6], [19, hip + 6]] }, { pal: digits(WOOD) }));
  out.push(limb(12, hip - 2, 11, hip + 5, 'x', { pal: GLOW }), limb(16, hip - 2, 17, hip + 5, 'q', { pal: GLOW }));
  // the ferryman's coat: a long dark coat over the body, its tails flaring
  const coat = anyOf(ell(16, 22 + crouch, 7, 8.5), poly([[10, 24 + crouch], [22, 24 + crouch], [24, hip + 1], [9, hip + 1]]));
  out.push(V(coat, [8, 12 + crouch, 25, hip + 2], [13, 17 + crouch, 9, 9], COAT));
  // a wing as an arm, or both spread for the dive
  if (wing) {
    out.push([['......5544', '...5544332', '.54433221.', '5433221...', '332.......'], 1, 14 + crouch, { pal: digits(FEATHER), edge: FEATHER[0] }]);
    out.push([['4455......', '2334455...', '.12233445.', '...1223344', '.......233'], 19, 13 + crouch, { pal: digits(FEATHER), edge: FEATHER[0] }]);
  }
  // brass buttons down the coat
  out.push(parts({ X: [[13, 20 + crouch], [13, 23 + crouch], [13, 26 + crouch]] }, { pal: GLOW }));
  // the neck: a long S from the shoulders to the head
  const neck = bezier([
    [16, 16 + crouch],
    [neckMid[0] + 3, neckMid[1]],
    [neckMid[0] - 3, neckMid[1] - 3],
    [head[0] + 2, head[1] + 2],
  ]);
  out.push(sweep(neck, () => 1.7, (_t, side, lit) => (side > 0.4 ? '5' : lit > 0 ? '4' : '3'), 60, { pal: digits(FEATHER), edge: FEATHER[0] }));
  // the head: small and pale, a black crest trailing back, the long dagger beak
  out.push(round(head[0] + 2, head[1] + 2, 3, 2.5, FEATHER));
  out.push(line(head[0] + 4, head[1], head[0] + 9, head[1] - 1, '1', { pal: digits(FEATHER) }), line(head[0] + 4, head[1] + 1, head[0] + 8, head[1] + 2, '1', { pal: digits(FEATHER) }));
  const bk = head[0] - 7;
  out.push([['......xx', '..xxxXXq', 'qqqqqq..'], bk, head[1] + 1, { pal: GLOW }]);
  out.push(eye ? [['y'], head[0] + 1, head[1] + 1, { pal: GLOW }] : [['k'], head[0] + 1, head[1] + 2, { pal: GLOW }]);
  // the punt pole with its spearhead
  out.push(limb(pole[0], pole[1], pole[2], pole[3], '2', { pal: digits(WOOD) }));
  out.push(line(pole[0], pole[1], pole[2], pole[3], '4', { pal: digits(WOOD) }));
  const ang = Math.atan2(pole[3] - pole[1], pole[2] - pole[0]);
  out.push(capsule(pole[2], pole[3], pole[2] + Math.cos(ang) * 5, pole[3] + Math.sin(ang) * 5, 1.6, 0.5, '4', { pal: digits(['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa']), edge: '#2a2f45' }));
  // the hand on the pole
  const hx = Math.round(pole[0] + (pole[2] - pole[0]) * 0.55);
  const hy = Math.round(pole[1] + (pole[3] - pole[1]) * 0.55);
  out.push([['44', '33'], hx, hy, { pal: digits(FEATHER), edge: FEATHER[0] }]);
  return [...out, ...extra];
}

// ------------------------------------------------------------------ lamplighter (a hood like a candle snuffer, a wick-pole)

function lamplighterParts(pose: string): Part[] {
  let tip: [number, number] = [2, 3]; // the pole's tip (the flame)
  let hand: [number, number] = [7, 19];
  let hunch = 0;
  let flameOn = true;
  let fl = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      fl = 1;
      hunch = 1;
      break;
    case 'windup':
      tip = [10, -2];
      hand = [9, 15];
      fl = 2;
      break;
    case 'attack':
      tip = [-6, 16];
      hand = [5, 20];
      hunch = 2;
      fl = 3;
      break;
    case 'hurt':
      tip = [6, 2];
      hand = [9, 20];
      fl = 2;
      break;
    case 'tell':
      // Snuff Out!: the snuffer's cup capped over the flame, a curl of smoke going up
      tip = [3, 2];
      hand = [8, 17];
      flameOn = false;
      extra.push(puff(tip[0], tip[1] - 5, 1), puff(tip[0] + 2, tip[1] - 9, 2));
      break;
  }
  const out: Part[] = [];
  const F = 31;
  // boots
  out.push([['.22', '211'], 9, F - 1, { pal: digits(CLOAK), edge: CLOAK[0] }], [['22.', '1111'], 14, F - 1, { pal: digits(CLOAK), edge: CLOAK[0] }]);
  // the cloak: a hunched bell shape, patched
  const cloak = anyOf(ell(14, 22 + hunch * 0.5, 7, 8.5), poly([[8, 22], [20, 21], [21, F - 1], [7, F - 1]]));
  out.push(V(cloak, [6, 12, 22, F - 1], [11, 17, 8, 9], CLOAK));
  out.push([['3332', '3222'], 15, 25, { pal: digits(CATTAIL), edge: CATTAIL[0] }]);
  // the hood: a brass candle-snuffer cone tipping back, the face in its shadow with two small glowing eyes
  const hx = 9 - hunch;
  const hood = poly([[hx - 1, 18], [hx + 2, 11], [hx + 9, 3], [hx + 11, 4], [hx + 9, 12], [hx + 10, 18]]);
  out.push(V(hood, [hx - 2, 2, hx + 12, 19], [hx + 4, 7, 6, 6], BRASS));
  out.push([['nnnn', 'nynn', 'nnnn'], hx, 14, { pal: GLOW }]);
  out.push(parts({ y: [[hx + 3, 15]] }, { pal: GLOW }));
  // the wick-pole: a long thin pole, a little flame at its tip (or the cup over it)
  out.push(limb(hand[0], hand[1] + 4, tip[0], tip[1], '2', { pal: digits(WOOD) }));
  out.push(line(hand[0], hand[1] + 4, tip[0], tip[1], '4', { pal: digits(WOOD) }));
  out.push([['44', '33'], hand[0] - 1, hand[1], { pal: digits(CLOAK), edge: CLOAK[0] }]);
  if (flameOn) out.push(flame(tip[0] + 1, tip[1] - 1, 7, 4, fl));
  else out.push([['.33.', '3443', '2222'], tip[0] - 1, tip[1] - 3, { pal: digits(BRASS), edge: BRASS[0] }]);
  return [...out, ...extra];
}

// ------------------------------------------------------------------ Old Snapper (a shell like a sunken island)

function snapperParts(pose: string): Part[] {
  let head: [number, number] = [8, 21]; // the head's centre
  let open = 0;
  let eye = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      head = [9, 22];
      break;
    case 'windup':
      head = [15, 22];
      break;
    case 'attack':
      head = [1, 24];
      open = 3;
      break;
    case 'hurt':
      head = [16, 23];
      eye = false;
      break;
    case 'tell':
      // High Tide!: head up, the water pouring off the island of its shell at both ends
      head = [6, 13];
      open = 2;
      extra.push(drops([[0, 30], [1, 27], [-1, 24], [50, 28], [51, 25], [52, 31], [49, 22], [3, 22]]));
      break;
  }
  const F = 33;
  const out: Part[] = [];
  // legs, the far ones darker
  const dk = HIDE.map((_, i) => HIDE[Math.max(0, i - 1)]);
  out.push(round(42, 29, 4.5, 3.5, dk), round(14, 29, 4.5, 3.5, dk));
  out.push([['3333', '2.2.2'], 38, F - 1, { pal: digits(HIDE), edge: HIDE[0] }]);
  // the neck and the head: a heavy hooked beak, a small mean eye
  const [hx, hy] = head;
  out.push(capsule(hx + 6, hy + 1, 18, 23, 3.4, 4.6, '3', { pal: digits(HIDE), edge: HIDE[0] }));
  out.push(V(anyOf(ell(hx + 3, hy, 5.5, 4.2), poly([[hx - 4, hy - 1], [hx, hy - 3], [hx + 2, hy + 2], [hx - 3, hy + 2]])), [hx - 5, hy - 5, hx + 9, hy + 5], [hx + 1, hy - 2, 6, 4], HIDE));
  out.push([['55', '43', '.3'], hx - 4, hy - 1 + 0, { pal: digits(['#2a2418', '#5a4a30', '#8a7650', '#bca878', '#e4d4a4', '#fff4cc']), edge: '#2a2418' }]);
  if (open) out.push(parts({ n: Array.from({ length: 5 + open }, (_, i): [number, number] => [hx - 3 + i, hy + 2 + (i < 3 ? 0 : 0)]).concat(open > 1 ? Array.from({ length: 4 }, (_, i): [number, number] => [hx - 2 + i, hy + 3]) : []) }, { pal: GLOW }));
  else out.push(line(hx - 3, hy + 2, hx + 3, hy + 2, '1', { pal: digits(HIDE) }));
  out.push(eye ? [['r'], hx + 1, hy - 2, { pal: GLOW }] : [['k'], hx + 1, hy - 1, { pal: GLOW }]);
  // the shell: a mossy dome, its plates traced in their darkest moss, a rim of old horn underneath
  const shell = poly([[16, 26], [18, 14], [26, 7], [38, 6], [48, 11], [53, 22], [52, 27]]);
  const sh = V(anyOf(shell, ell(34, 19, 18, 10)), [14, 4, 54, 28], [28, 10, 18, 11], SHELL);
  // plate seams
  sh[0] = sh[0].map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c === '.') return c;
        const gx = x + 14;
        const gy = y + 4;
        const seam = (gx + Math.round(gy * 0.3)) % 9 === 0 || (gy - 4) % 7 === 0;
        return seam && +c > 1 ? String(Math.max(1, +c - 2)) : c;
      })
      .join(''),
  );
  out.push(sh);
  out.push([['3333333333333333333333333333333333333', '2222222222222222222222222222222222222'], 16, 26, { pal: digits(['#1a140e', '#3a2c1e', '#5e4a32', '#86704a']), edge: '#1a140e' }]);
  // the island on its back: a tuft of reeds and an old stone, moss clumps
  out.push([['.3.', '343', '3432', '2221'], 28, 3, { pal: digits(STONE), edge: STONE[0] }]);
  for (const [x, hgt] of [
    [38, 6],
    [40, 8],
    [41, 5],
    [43, 7],
  ] as const)
    out.push(line(x, 6, x + (x % 2 ? 1 : -1), 6 - hgt, x % 2 ? '4' : '3', { pal: digits(REED) }));
  out.push(parts({ 5: [[22, 10], [23, 10], [33, 6], [46, 10], [47, 11]], 4: [[22, 11], [24, 11], [34, 6], [45, 11]] }, { pal: digits(REED) }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ the Sluice Keeper (a beaver in a diving helmet)

function sluiceParts(pose: string): Part[] {
  let watch: [number, number] = [8, 26]; // the pocket watch in the near hand
  let wrench: [number, number] = [36, 18]; // the wrench's head in the far hand
  let mouth = false;
  let dent = false;
  let steam = 0;
  let bx = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      watch = [9, 27];
      steam = 1;
      break;
    case 'windup':
      wrench = [38, 4];
      bx = 2;
      break;
    case 'attack':
      wrench = [2, 30];
      watch = [12, 30];
      bx = -2;
      break;
    case 'hurt':
      dent = true;
      steam = 2;
      bx = 2;
      break;
    case 'tell':
      // Open the Gates! (and his other orders): the watch held up high, read out loud; the helmet's valve whistling
      watch = [4, 6];
      mouth = true;
      steam = 3;
      break;
  }
  const X = (x: number) => x + bx;
  const F = 47;
  const out: Part[] = [];
  // the flat tail behind, cross-hatched
  const tail = V(ell(X(40), 43, 8, 3.2), [X(31), 39, X(49), 47], [X(38), 41, 7, 3], FUR.map((_, i) => FUR[Math.max(0, i - 1)]));
  tail[0] = tail[0].map((r, y) => [...r].map((c, x) => (c !== '.' && (x + y) % 3 === 0 && +c > 1 ? String(+c - 1) : c)).join(''));
  out.push(tail);
  // the far arm and its wrench
  out.push(limb(X(30), 24, wrench[0] + bx, wrench[1] + 4, '2', { pal: digits(FUR) }));
  out.push(limb(wrench[0] + bx, wrench[1] + 3, wrench[0] + bx - 1, wrench[1] + 11, '3', { pal: digits(STONE) }));
  out.push([['44..44', '443344', '433334', '.3333.'], wrench[0] + bx - 2, wrench[1] - 1, { pal: digits(STONE), edge: STONE[0] }]);
  // big webbed feet
  out.push([['..3333', '334443', '222222'], X(13), F - 2, { pal: digits(FUR), edge: FUR[0] }], [['3333..', '344433', '222222'], X(24), F - 2, { pal: digits(FUR), edge: FUR[0] }]);
  // the body in its overalls
  out.push(V(ell(X(23), 31, 11, 13), [X(11), 17, X(35), F - 2], [X(19), 25, 10, 10], FUR));
  out.push(V(poly([[X(14), 27], [X(32), 27], [X(33), 40], [X(30), F - 3], [X(16), F - 3], [X(13), 40]]), [X(12), 26, X(34), F - 2], [X(20), 31, 9, 9], OVERALL));
  out.push(parts({ X: [[X(16), 28], [X(30), 28]], 5: [[X(21), 33], [X(22), 33], [X(23), 33], [X(24), 33]], 1: [[X(21), 35], [X(22), 35], [X(23), 35], [X(24), 35]] }, { pal: { ...GLOW, ...digits(OVERALL) } }));
  // the brass diving helmet: a round dome, a collar plate, a porthole on the front with the beaver's face behind it
  const hx = X(20);
  out.push(V(poly([[X(11), 21], [X(31), 21], [X(32), 26], [X(10), 26]]), [X(9), 20, X(33), 27], [X(16), 21, 10, 3], BRASS));
  out.push(parts({ 2: [[X(12), 23], [X(17), 24], [X(22), 24], [X(27), 24]] }, { pal: digits(BRASS) }));
  const dome = dent ? anyOf(ell(hx, 12, 9.5, 9.5), ell(hx + 2, 10, 8, 8)) : ell(hx, 12, 9.5, 9.5);
  out.push(V(dome, [hx - 10, 1, hx + 11, 23], [hx - 4, 7, 9, 9], BRASS));
  // the valve on top (steam when he talks), bolts round the porthole
  out.push([['.33.', '4433', '.22.'], hx + 3, 0, { pal: digits(BRASS), edge: BRASS[0] }]);
  for (let i = 0; i < steam; i++) out.push(puff(hx + 6 + i * 2, -3 - i * 3, 1 + (i > 1 ? 1 : 0)));
  // the porthole: a glass disc showing his face (eyes, a pink nose, the two big teeth)
  const px = hx - 9;
  out.push([['.11111.', '1vVvvv1', '1ukvuk1', '1vugGv1', '1vutt.1', '.1tt11.'], px, 9, { pal: { ...GLOW, 1: BRASS[1], '.': '' } }]);
  out.push([['.5.....', '5......'], px, 8, { pal: { 5: BRASS[5] } }]);
  if (mouth) out.push(parts({ n: [[px + 3, 13], [px + 4, 13]] }, { pal: GLOW }));
  // the near arm, the pocket watch on its chain
  out.push(limb(X(16), 25, watch[0] + 1, watch[1] - 1, '3', { pal: digits(FUR) }));
  out.push([['.444.', '45554', '45k54', '44554', '.333.'], watch[0] - 2, watch[1], { pal: { ...digits(BRASS), k: INK } }]);
  out.push(line(watch[0] + 1, watch[1] + 4, X(17), 30, 'X', { pal: GLOW, late: true }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ ink eel (black, violet spots, ink in the water)

function eelParts(pose: string): Part[] {
  let head: [number, number] = [9, 9];
  let mid: [number, number] = [24, 19];
  let open = 1;
  let eye = 'PO';
  let churn = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      head = [10, 10];
      mid = [25, 20];
      churn = 1;
      break;
    case 'windup':
      head = [17, 5];
      mid = [28, 15];
      open = 2;
      churn = 1;
      break;
    case 'attack':
      head = [1, 17];
      mid = [18, 22];
      open = 4;
      churn = 2;
      break;
    case 'hurt':
      head = [14, 9];
      mid = [26, 18];
      open = 0;
      eye = 'pp';
      break;
    case 'tell':
      // Undertow!: reared up high, the water under it pulled round into a whirl of ink
      head = [11, 2];
      mid = [26, 14];
      open = 3;
      churn = 3;
      break;
  }
  const F = 41;
  const [hx, hy] = head;
  const path = bezier([
    [20, F - 3],
    [mid[0] + 6, mid[1] + 6],
    [mid[0] - 4, mid[1] - 4],
    [hx + 6, hy + 2],
  ]);
  const body = sweep(
    path,
    (t) => 4 - t * 1.3,
    (t, side, lit) => {
      // glowing violet spots along the flank, a slate sheen on the lit back
      if (side < 0.2 && side > -0.6 && Math.floor(t * 14) % 2 === 0 && Math.abs(((t * 14) % 1) - 0.5) < 0.2) return t % 0.14 < 0.07 ? 'O' : 'P';
      if (side > 0.55) return '2';
      return lit > 0.45 ? '5' : lit > 0.05 ? '4' : lit > -0.4 ? '3' : '1';
    },
    120,
    { pal: { ...digits(INKY), ...GLOW }, edge: INKY[0] },
  );
  // the fin running along its back
  const fin: Part[] = [];
  for (const t of [0.4, 0.52, 0.64, 0.76, 0.88]) {
    const [x, y] = path(t);
    const [x2, y2] = path(t + 0.01);
    const a = Math.atan2(y2 - y, x2 - x) - Math.PI / 2;
    fin.push(dots([['p', [[Math.round(x + Math.cos(a) * 4), Math.round(y + Math.sin(a) * 4)]]]], { pal: GLOW }));
  }
  const skull = anyOf(ell(hx + 4, hy + 2, 5, 3.4), poly([[hx - 2, hy + 1], [hx + 2, hy - 1], [hx + 6, hy + 1], [hx + 4, hy + 4], [hx - 1, hy + 3]]));
  const jaw = poly([[hx - 1, hy + 3 + open * 0.5], [hx + 5, hy + 3], [hx + 7, hy + 6], [hx, hy + 5 + open]]);
  const gape: Pts = [];
  for (let x = hx - 1; x <= hx + 5; x++) for (let y = hy + 3; y <= hy + 3 + Math.round(open * ((x - hx + 2) / 7)); y++) gape.push([x, y]);
  // the black water it rises from, ink curling out through it
  const pool: Part = (() => {
    const pts: Record<string, Pts> = { u: [], w: [], v: [], V: [], 1: [], p: [] };
    for (let y = F - 5; y <= F; y++)
      for (let x = 1; x <= 31; x++) {
        const d = ((x + 0.5 - 16) / 15) ** 2 + ((y + 0.5 - (F - 2)) / 3.4) ** 2;
        if (d > 1) continue;
        const sw = Math.sin(Math.atan2(y - (F - 2), (x - 16) * 0.3) * 2 + Math.hypot(x - 16, (y - F + 2) * 3) * 0.6 - churn * 1.4);
        if (d > 0.7) pts[y < F - 2 ? 'v' : 'u'].push([x, y]);
        else pts[sw > 0.55 ? '1' : sw > 0.1 && churn > 1 ? 'p' : sw > -0.5 ? 'w' : 'u'].push([x, y]);
      }
    for (let x = 4; x < 29; x += 3) if (Math.sin(x * 1.3 + churn) > 0.2) pts.V.push([x, F - 5]);
    return parts(pts, { pal: { ...GLOW, ...digits(INKY) } });
  })();
  return [
    pool,
    body,
    ...fin,
    parts({ n: gape }, { pal: GLOW }),
    V(jaw, [hx - 2, hy + 2, hx + 8, hy + 7 + open], [hx + 2, hy + 3, 5, 3], INKY),
    V(skull, [hx - 3, hy - 3, hx + 10, hy + 6], [hx + 2, hy - 1, 7, 5], INKY),
    [[eye], hx + 1, hy, { pal: GLOW }],
    ...(open ? [parts({ P: [[hx + 1, hy + 4], [hx + 2, hy + 4]] }, { pal: GLOW })] : []),
    ...(churn ? [parts({ p: [[5, F - 7 - churn], [26, F - 6 - churn]], P: [[9, F - 8 - churn]] }, { pal: GLOW, late: true })] : []),
    ...extra,
  ];
}

// ------------------------------------------------------------------ dusk moths (a cloud of moths round a stolen lantern)

/** One moth at (x, y) facing left: wings up, level or down (flap 0-2), an eyespot on each forewing. */
function moth(x: number, y: number, flap: number, far = false): Part {
  const rows =
    flap === 0
      ? ['.4.44.', '45554.', '.p32..', '..k1..']
      : flap === 1
        ? ['.45544', 'p45532', '.k321.', '..1...']
        : ['......', '.k21..', 'p45532', '.45544'];
  const ramp = far ? MOTH.map((_, i) => MOTH[Math.max(0, i - 1)]) : MOTH;
  return [rows, x, y, { pal: { ...digits(ramp), p: '#a06ad0', k: INK }, edge: ramp[0] }];
}

function mothParts(pose: string): Part[] {
  // the moths' spots round the lantern, [dx, dy, flap offset, far]
  let spread = 1;
  let dx0 = 0;
  let lit = 2;
  let swing = 0;
  let ph = 0;
  switch (pose) {
    case 'idle1':
      ph = 1;
      break;
    case 'windup':
      spread = 0.8;
      dx0 = 2;
      ph = 2;
      break;
    case 'attack':
      dx0 = -4;
      spread = 0.9;
      swing = -2;
      ph = 1;
      break;
    case 'hurt':
      spread = 1.35;
      lit = 1;
      swing = 2;
      ph = 2;
      break;
    case 'tell':
      // Flutter!: the swarm closes round the lantern, wings over the light
      spread = 0.55;
      lit = 0;
      ph = 0;
      break;
  }
  const cx = 16 + dx0;
  const cy = 17;
  const out: Part[] = [];
  const spots: [number, number, number, boolean][] = [
    [-10, -9, 0, true],
    [6, -11, 1, true],
    [10, 2, 2, true],
    [-12, 3, 1, false],
    [-4, -14, 2, false],
    [4, 8, 0, false],
    [-7, 9, 1, false],
    [11, -5, 0, false],
  ];
  // far moths behind, then the lantern (hung from two moths' threads), then the near ones
  for (const [dx, dy, f] of spots.filter((s) => s[3])) out.push(moth(Math.round(cx + dx * spread), Math.round(cy + dy * spread), (f + ph) % 3, true));
  out.push(line(cx + 1, cy - 9, cx + 2 + swing, cy - 3, 'S', { pal: GLOW }));
  out.push(...lantern(cx + swing, cy - 3, lit));
  for (const [dx, dy, f] of spots.filter((s) => !s[3])) out.push(moth(Math.round(cx + dx * spread), Math.round(cy + dy * spread), (f + ph) % 3));
  // the lantern's light catching the dust off their wings
  if (lit) out.push(parts({ x: [[cx - 4, cy + 7], [cx + 7, cy - 1]], X: [[cx + 3, cy + 9]] }, { pal: GLOW, late: true }));
  return out;
}

// ------------------------------------------------------------------ bog hag (mossy, a kettle on a stick, a lantern jaw)

function hagParts(pose: string): Part[] {
  let stick: [number, number, number, number] = [10, 24, 1, 14]; // hand, end
  let lean = 0;
  let steam = 1;
  let eyes = true;
  let grin = true;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      stick = [10, 25, 1, 15];
      steam = 2;
      break;
    case 'windup':
      stick = [12, 20, 6, 6];
      lean = 1;
      break;
    case 'attack':
      stick = [8, 24, -5, 20];
      lean = -2;
      break;
    case 'hurt':
      lean = 2;
      eyes = false;
      grin = false;
      steam = 0;
      break;
    case 'tell':
      // Fog Bank!: the kettle swung up, a great bank of fog rolling out of it
      stick = [11, 18, 3, 6];
      steam = 0;
      extra.push(puff(1, 2, 3), puff(-4, 7, 2), puff(6, -1, 2), puff(-2, -2, 2), puff(-7, 2, 1));
      break;
  }
  const F = 35;
  const L = (x: number) => x + lean;
  const out: Part[] = [];
  // bare knobbly feet under the rags
  out.push([['.33', '332'], 13, F - 1, { pal: digits(HAG), edge: HAG[0] }], [['33.', '2332'], 19, F - 1, { pal: digits(HAG), edge: HAG[0] }]);
  // the rags: a mossy heap, fringed at the hem
  out.push(shag(anyOf(ell(L(18), 24, 9, 10), poly([[L(10), 22], [L(26), 22], [L(28), F], [L(9), F]])), [L(7), 13, L(29), F], [L(15), 19, 10, 10], RAGS, 5, { edge: RAGS[0] }));
  out.push(parts({ 4: [[L(15), 21], [L(16), 22], [L(22), 26], [L(21), 30]], 5: [[L(15), 20], [L(22), 25]] }, { pal: digits(REED) }));
  // the head: a long hooked nose, the jutting lantern jaw, hair of moss hanging down her back
  const hx = L(12);
  out.push(shag(poly([[hx + 2, 6], [hx + 11, 5], [hx + 14, 12], [hx + 13, 24], [hx + 6, 20]]), [hx, 4, hx + 15, 25], [hx + 6, 8, 7, 8], REED.map((_, i) => REED[Math.max(0, i - 1)]), 9, { edge: REED[0] }));
  out.push(V(anyOf(ell(hx + 5, 11, 5.5, 5), poly([[hx - 1, 13], [hx + 3, 12], [hx + 7, 15], [hx + 6, 19], [hx + 1, 18]])), [hx - 2, 5, hx + 11, 20], [hx + 3, 9, 6, 6], HAG));
  out.push([['..54', '.543', '5432', '.32.'], hx - 3, 9, { pal: digits(HAG), edge: HAG[0] }]);
  // eyes and the grin with its two teeth
  out.push(eyes ? [['Yk', 'y.'], hx + 2, 9, { pal: GLOW }] : [['kk'], hx + 2, 10, { pal: GLOW }]);
  out.push(grin ? [['nnnn', '.t.t'], hx, 15, { pal: GLOW }] : line(hx, 16, hx + 3, 16, 'n', { pal: GLOW }));
  // the stick, the black kettle hanging from its end, green steam curling up
  out.push(limb(stick[0], stick[1], stick[2], stick[3], '2', { pal: digits(WOOD) }));
  out.push(line(stick[0], stick[1], stick[2], stick[3], '4', { pal: digits(WOOD) }));
  out.push([['33', '22'], stick[0] - 1, stick[1] - 1, { pal: digits(HAG), edge: HAG[0] }]);
  const kx = stick[2] - 3;
  const ky = stick[3] + 1;
  out.push(line(stick[2], stick[3], kx + 3, ky + 1, 'S', { pal: GLOW }));
  out.push([['..44..', '.4443.', '443332', '433322', '.2222.'], kx, ky + 2, { pal: digits(IRONR), edge: IRONR[0] }]);
  out.push([['dc'], kx + 2, ky + 2, { pal: GLOW }]);
  for (let i = 0; i < steam; i++) out.push(parts({ c: [[kx + 2 + i, ky - i * 2], [kx + 3 + i, ky - 1 - i * 2]], d: [[kx + 2 + i * 2, ky - 2 - i * 2]] }, { pal: GLOW, late: true }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ sunken sentinel (armour full of marsh water)

function sentinelParts(pose: string): Part[] {
  let lamp: [number, number] = [6, 24]; // the drowned lantern in the near hand
  let blade: [number, number, number, number] = [32, 26, 38, 40];
  let visor = false;
  let bx = 0;
  let leak = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      lamp = [6, 25];
      leak = 1;
      break;
    case 'windup':
      blade = [31, 22, 34, 2];
      bx = 2;
      break;
    case 'attack':
      blade = [12, 24, -6, 34];
      lamp = [10, 28];
      bx = -2;
      break;
    case 'hurt':
      bx = 2;
      leak = 2;
      break;
    case 'tell':
      // Floodgate!: the visor thrown open, the marsh water inside it gushing out
      visor = true;
      lamp = [4, 16];
      extra.push(drops([[2, 8], [0, 9], [-2, 11], [-3, 14], [-4, 17], [1, 10], [-1, 13], [-5, 20], [-2, 16]]));
      break;
  }
  const X = (x: number) => x + bx;
  const F = 45;
  const out: Part[] = [];
  // the far arm and its rusted blade
  out.push(limb(X(28), 20, blade[0] + bx, blade[1], '2', { pal: digits(ARMOR) }));
  out.push(line(blade[0] + bx, blade[1], blade[2] + bx, blade[3], '4', { pal: digits(ARMOR) }));
  out.push(line(blade[0] + bx + 1, blade[1], blade[2] + bx + 1, blade[3], '2', { pal: digits(ARMOR) }));
  // a heavy crossguard where the blade meets the gauntlet
  out.push([['5443', '3221'], blade[0] + bx - 1, blade[1] - 1, { pal: digits(ARMOR), edge: ARMOR[0] }]);
  // legs: greaves and sabatons
  out.push(V(poly([[X(13), 31], [X(19), 31], [X(19), F - 2], [X(12), F - 2]]), [X(11), 30, X(20), F - 1], [X(14), 33, 5, 7], ARMOR));
  out.push(V(poly([[X(22), 31], [X(28), 31], [X(29), F - 2], [X(22), F - 2]]), [X(21), 30, X(30), F - 1], [X(24), 33, 5, 7], ARMOR));
  out.push([['333333..', '2222222.'], X(9), F - 2, { pal: digits(ARMOR), edge: ARMOR[0] }], [['33333...', '222222.'], X(21), F - 2, { pal: digits(ARMOR), edge: ARMOR[0] }]);
  // the body: a breastplate, a skirt of plates, pauldrons; rust blooms in its creases
  out.push(V(anyOf(ell(X(20), 22, 9, 10), poly([[X(12), 26], [X(29), 26], [X(30), 33], [X(11), 33]])), [X(10), 11, X(31), 34], [X(16), 17, 9, 9], ARMOR));
  out.push(parts({ 1: [[X(12), 28], [X(16), 28], [X(20), 28], [X(24), 28], [X(28), 28]], q: [[X(23), 25], [X(24), 26], [X(14), 31]], Q: [[X(22), 25], [X(25), 30]] }, { pal: { ...GLOW, ...digits(ARMOR) } }));
  out.push(round(X(11), 15, 4.5, 3.5, ARMOR), round(X(28), 15, 4, 3.2, ARMOR.map((_, i) => ARMOR[Math.max(0, i - 1)])));
  // the helm: a great bucket helm, a visor slit full of dark water; weed for a plume
  const hx = X(16);
  out.push(V(poly([[hx - 5, 2], [hx + 5, 1], [hx + 7, 6], [hx + 6, 13], [hx - 5, 13], [hx - 6, 6]]), [hx - 7, 0, hx + 8, 14], [hx - 1, 4, 6, 5], ARMOR));
  if (visor) out.push([['wvvvvv', 'uwwwvV', 'uuwwww'], hx - 6, 5, { pal: GLOW }], [['44444', '33333'], hx - 4, -1, { pal: digits(ARMOR), edge: ARMOR[0] }]);
  else out.push([['uwVwwu', 'uuuwuu'], hx - 5, 6, { pal: GLOW }]);
  out.push(parts({ 2: [[hx, 8], [hx, 9], [hx, 10], [hx, 11]] }, { pal: digits(ARMOR) }));
  // the weed plume trailing back off the crown
  out.push(sweep(bezier([[hx + 1, 1], [hx + 6, -4], [hx + 12, -1], [hx + 15, 5]]), (t) => 1.6 - t, (_t, side) => (side < 0 ? '4' : '3'), 40, { pal: digits(REED), edge: REED[0] }));
  // water leaking at the joints
  for (let i = 0; i < leak; i++) out.push(drops([[X(12) - i, 33 + i * 3], [X(29), 34 + i * 2]]));
  // the near arm holding the drowned lantern up: a cold green light behind cracked glass
  out.push(limb(X(14), 18, lamp[0] + 2 + bx, lamp[1] - 2, '3', { pal: digits(ARMOR) }));
  out.push([['.4.', '434', '22222'.slice(0, 3)], lamp[0] + bx + 1, lamp[1] - 3, { pal: digits(IRONR), edge: IRONR[0] }]);
  out.push([['2cdc1', '2dek1', '2bcb1', '22111'], lamp[0] + bx, lamp[1], { pal: { ...GLOW, ...digits(IRONR) } }]);
  out.push(round(lamp[0] + bx + 3, lamp[1] - 3, 2.6, 2.2, ARMOR));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ the Gloaming Lighthouse (the boss: a lighthouse on stone legs)

/**
 * The lighthouse wading on two legs of stacked stone, its door a mouth, the sun shut in its lamp, the mapmaker a small
 * dark figure with a pen on its gallery. Phase 1 as drawn: lime-washed with red bands, the beam sweeping the water.
 * Phase 2 (the shoreline redrawn): the water up to its knees on both sides, fresh pencil lines on the stone where the
 * shore was moved. Phase 3 (the sky erased): rubbed back toward paper in great patches, the bands gone to ink, the
 * lamp shuttered to a red glare and its windows lit like eyes.
 */
function lighthouseParts(pose: string, phase: number): Part[] {
  let bx = 0;
  let by = 0;
  let beam = -0.18; // the beam's angle (0 = straight left, + down)
  let door = 1; // the door-mouth: 0 shut, 1 ajar, 2 roaring
  let step = 0; // legs: 0 planted, 1 the near one lifted (wading forward)
  let lampK = phase >= 3 ? 1 : 2;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      beam = 0.08;
      by = 1;
      break;
    case 'windup':
      bx = 3;
      by = -1;
      step = 1;
      door = 0;
      beam = -0.4;
      break;
    case 'attack':
      bx = -3;
      door = 2;
      beam = 0.32;
      break;
    case 'hurt':
      bx = 2;
      door = 0;
      lampK = 1;
      beam = 99;
      break;
    case 'tell':
      // Fog Horn! (the door bellowing) / Breakers! / the edits: the lamp flaring, the beam straight at the hero
      door = 2;
      beam = 0.04;
      lampK = 3;
      by = -1;
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const F = 79;
  const out: Part[] = [];
  const cx = 38; // the tower's axis
  // ---- the legs: columns of stacked stones, knees bent, wading
  const leg = (x0: number, lift: number, far: boolean) => {
    const ramp = far ? STONE.map((_, i) => STONE[Math.max(0, i - 1)]) : STONE;
    const pts: Record<string, Pts> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    const top = 60;
    for (let y = top; y <= F - lift; y++) {
      const t = (y - top) / (F - lift - top);
      const knee = Math.sin(t * Math.PI) * (far ? 2 : 3);
      const half = 4.2 - t * 0.6 + (y > F - lift - 3 ? 1.5 : 0);
      const xc = x0 + knee;
      const course = Math.floor((y - top) / 4);
      const off = course % 2 ? 1.5 : 0;
      for (let x = Math.floor(xc - half); x <= xc + half; x++) {
        const u = (x + 0.5 - xc) / half;
        let k = u < -0.35 ? 4 : u < 0.25 ? 3 : u < 0.7 ? 2 : 1;
        if ((y - top) % 4 === 0 || Math.abs(((x - xc + off + 10) % 3.5) - 0) < 0.6) k = Math.max(1, k - 1); // mortar lines
        if (y === top) k = 5;
        pts[k].push([X(x), Y(y)]);
      }
    }
    out.push(parts(pts, { pal: digits(ramp), edge: ramp[0] }));
  };
  leg(cx + 7, 0, true);
  leg(cx - 6, step * 3, false);
  // phase 2: the water redrawn up round its knees, foam where it meets the stone
  if (phase === 2) {
    const wp: Record<string, Pts> = { u: [], w: [], v: [], V: [] };
    const surf = (x: number) => 71 + Math.round(Math.sin(x * 0.45 + (pose === 'idle1' ? 1.5 : 0)) * 0.8);
    for (let x = 14; x <= 64; x++) {
      const end = Math.min(1, (x - 14) / 6, (64 - x) / 6);
      const top = surf(x) + Math.round((1 - end) * 4);
      for (let y = top; y <= F; y++) {
        const dd = y - top;
        wp[dd === 0 ? 'V' : dd === 1 && x % 4 === 0 ? 'V' : dd < 3 ? 'v' : dd < 6 ? 'w' : 'u'].push([X(x), Y(y)]);
      }
    }
    out.push(parts(wp, { pal: GLOW }));
  }
  // ---- the tower: tapering, lime-washed, red bands (ink in phase 3), stones in courses
  const T0 = 40; // top of the tower body (under the gallery)
  const T1 = 62; // its foot
  const half = (y: number) => 8 + ((y - T0) / (T1 - T0)) * 5;
  const tw: Record<string, Pts> = { 1: [], 2: [], 3: [], 4: [], 5: [], A: [], B: [], C: [], D: [], E: [], a: [], b: [], c: [], d: [], e: [], l: [] };
  // phase 3: two broad strokes of the eraser across the tower, ragged at their edges, rubbed back to paper
  const erased = (x: number, y: number) => {
    if (phase < 3) return false;
    const rag = (hash2(x, y * 3) - 0.5) * 1.6 + Math.sin(y * 0.9) * 0.8;
    const s1 = Math.abs((x - cx) * 0.75 + (y - 46)) < 3.6 + rag;
    const s2 = Math.abs((x - cx) * 0.6 - (y - 57)) < 2.8 + rag && x > cx - 6;
    return s1 || s2;
  };
  for (let y = T0; y <= T1; y++) {
    const hw = half(y);
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const u = (x + 0.5 - cx) / hw; // -1 lit side .. 1 shade side
      let k = u < -0.6 ? 4 : u < -0.1 ? 5 : u < 0.35 ? 4 : u < 0.72 ? 3 : 2;
      if (y === T1) k = 1;
      const band = Math.floor((y - T0) / 5) % 2 === 1;
      if ((y - T0) % 3 === 0 && (x + Math.floor((y - T0) / 3) * 2) % 5 === 0) k = Math.max(1, k - 1); // stone joints
      if (erased(x, y)) {
        tw[u < -0.1 ? 'e' : u < 0.5 ? 'd' : 'c'].push([X(x), Y(y)]);
        continue;
      }
      if (phase === 2 && (((x - cx) * 2 + y) % 11 === 0 && y > 48) && k > 2) {
        tw.l.push([X(x), Y(y)]); // fresh pencil hatching where the shoreline was redrawn
        continue;
      }
      tw[band ? (phase >= 3 ? String(Math.max(1, k - 2)) : 'ABCDE'[k - 1]) : String(k)].push([X(x), Y(y)]);
    }
  }
  const towerPal: Pal = {
    ...digits(PLASTER),
    A: BAND[1],
    B: BAND[2],
    C: BAND[3],
    D: BAND[4],
    E: BAND[5],
    a: FOG[1],
    b: FOG[2],
    c: FOG[3],
    d: FOG[4],
    e: FOG[5],
    l: GLOW.l,
    L: GLOW.L,
  };
  if (phase >= 3) Object.assign(towerPal, digits(['#1a1222', '#2e2238', '#4a3a56', '#6a5a72', '#8e7e92', '#b2a2b0']));
  out.push(dots(Object.entries(tw).filter(([, p]) => p.length) as [string, Pts][], { pal: towerPal, edge: PLASTER[0] }));
  // phase 2: a pencil guide line across the tower where the new shore is measured from
  if (phase === 2) out.push(line(X(cx - 12), Y(53), X(cx + 13), Y(55), 'L', { pal: GLOW, late: true }));
  // windows up the tower (lit like eyes once the sky is erased)
  for (const wy of [45]) out.push([phase >= 3 ? ['XZ', 'xX', 'qx'] : ['kk', 'kn', 'nn'], X(cx - 2), Y(wy), { pal: GLOW }]);
  // the door: an arched mouth with stone teeth
  const dy = 55;
  const doorRows = door === 2 ? ['.3333.', '3tnnt3', '3nnnn3', '3nqqn3', '3nxXn3', '3tnnt3'] : door === 1 ? ['.3333.', '3tttt3', '3nnnn3', '3nnnn3', '3tttt3', '333333'] : ['.3333.', '3tttt3', '3tttt3', '3tttt3', '3tttt3', '333333'];
  out.push([doorRows, X(cx - 5), Y(dy), { pal: { ...GLOW, 3: STONE[3] } }]);
  // ---- the gallery: a stone ring with an iron rail, and the mapmaker standing on it with his pen
  out.push(V(poly([[X(cx - 13), Y(36)], [X(cx + 13), Y(36)], [X(cx + 11), Y(41)], [X(cx - 11), Y(41)]]), [X(cx - 14), Y(35), X(cx + 14), Y(42)], [X(cx - 6), Y(37), 12, 3], STONE));
  out.push(line(X(cx - 13), Y(32), X(cx + 13), Y(32), '2', { pal: digits(IRONR) }));
  for (let x = cx - 13; x <= cx + 13; x += 3) out.push(line(X(x), Y(32), X(x), Y(35), '1', { pal: digits(IRONR) }));
  // the mapmaker: a small dark coat, a pale face, a pen raised (it writes on the scene in the edits)
  const mx = cx - 11;
  out.push([['.11.', '1551', '.11.', '2222', '2332', '2222', '1.1.'], X(mx), Y(28), { pal: { 1: '#1a1426', 2: '#2a2240', 3: '#4a3a5e', 5: '#e8d2c0' } }]);
  // his pen: a long quill held up (2 px, so it reads at 8x)
  out.push(limb(X(mx - 3), Y(phase > 1 || pose === 'tell' ? 24 : 28), X(mx), Y(31), 'L', { pal: GLOW }));
  // ---- the lantern room: a glass cage on the gallery, the sun shut inside it; a cupola and a vane on top
  const L0 = 22;
  const sun = lampK >= 3 ? ['ZZZZZ', 'ZWWWZ', 'ZWWWZ', 'ZZZZZ'] : lampK === 2 ? ['XZZZX', 'ZZWZZ', 'ZZZZZ', 'XZZZX'] : ['qxxxq', 'xXXXx', 'xXXXx', 'qxxxq'];
  const room = [
    '1' + '2'.repeat(15) + '1',
    '2' + sun[0].padStart(10, '.').padEnd(15, '.') + '2',
    '2' + sun[1].padStart(10, '.').padEnd(15, '.') + '2',
    '2' + sun[2].padStart(10, '.').padEnd(15, '.') + '2',
    '2' + sun[3].padStart(10, '.').padEnd(15, '.') + '2',
    '2' + '.'.repeat(15) + '2',
    '1' + '1'.repeat(15) + '1',
  ];
  // the glass glows round the sun (a gold wash), or burns low behind shutters
  const roomRows = room.map((r, y) =>
    [...r]
      .map((c, x) => {
        if (c !== '.') return c;
        if (phase >= 3) return x % 3 === 0 ? 'k' : 'Q';
        const d = Math.hypot(x - 8, (y - 3) * 1.3);
        return d < 4 ? 'X' : d < 6 ? 'x' : 'q';
      })
      .join(''),
  );
  out.push([roomRows, X(cx - 8), Y(L0 + 3), { pal: { ...GLOW, 1: IRONR[1], 2: IRONR[3] } }]);
  out.push(V(poly([[X(cx - 9), Y(L0 + 3)], [X(cx), Y(L0 - 3)], [X(cx + 9), Y(L0 + 3)]]), [X(cx - 10), Y(L0 - 4), X(cx + 10), Y(L0 + 4)], [X(cx - 3), Y(L0), 6, 3], phase >= 3 ? STONE : BAND));
  out.push(line(X(cx), Y(L0 - 7), X(cx), Y(L0 - 3), '4', { pal: digits(IRONR) }), [['44.', '.33'], X(cx - 2), Y(L0 - 7), { pal: digits(IRONR), edge: IRONR[0] }]);
  // ---- the beam: a long wedge of pale gold light swept across the water (gone when the sky is erased)
  if (phase < 3 && beam < 10) {
    const bp: Record<string, Pts> = { Z: [], X: [], x: [] };
    const ox = cx - 9;
    const oy = L0 + 6;
    for (let i = 2; i < 30; i++) {
      const spread = 0.8 + i * 0.16;
      for (let s = -spread; s <= spread; s += 1) {
        const x = Math.round(ox - i * Math.cos(beam) - s * Math.sin(beam) * 0.3);
        const y = Math.round(oy + i * Math.sin(beam) + s);
        const edge = Math.abs(s) > spread - 1;
        if (i > 23 && (x + y) % 2) continue; // the far end breaks up (an ordered dither)
        bp[edge ? 'x' : i < 12 ? 'Z' : 'X'].push([X(x), Y(y)]);
      }
    }
    extra.push(parts(bp, { pal: GLOW, late: true }));
  }
  // phase 3: the sky's rubbed-out edge: crumbs of eraser falling off the tower
  if (phase >= 3) extra.push(parts({ e: [[X(cx + 14), Y(44)], [X(cx + 16), Y(50)], [X(cx - 15), Y(56)]], d: [[X(cx + 15), Y(47)], [X(cx - 14), Y(53)]] }, { pal: { d: FOG[4], e: FOG[5] }, late: true }));
  if (pose === 'tell') extra.push(parts({ s: [[X(cx - 9), Y(dy + 2)], [X(cx - 11), Y(dy + 1)], [X(cx - 13), Y(dy + 3)]], S: [[X(cx - 12), Y(dy + 4)], [X(cx - 15), Y(dy + 2)]] }, { pal: GLOW, late: true }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ portraits (40x40 busts facing left, like the villains)

/** Portrait textures this file draws: `portrait_${name}` (the speakers' ids in data/story-dusk.ts). */
export const DUSK_PORTRAITS = ['bellybog', 'sluiceKeeper'] as const;
const PS = 40;

function bellybogPortrait(): HTMLCanvasElement {
  const parts2: Part[] = [];
  // the vast head filling the frame, the belly's glow coming up from below
  const head = anyOf(ell(24, 28, 22, 15), ell(14, 24, 13, 11));
  parts2.push(V(head, [0, 8, 39, 39], [16, 18, 22, 14], BOG));
  // the throat glowing with swallowed lanterns
  const gp: Record<string, Pts> = { q: [], x: [], X: [], Z: [] };
  for (let y = 31; y < 40; y++)
    for (let x = 4; x < 36; x++) {
      if (!ell(20, 39, 16, 7)(x, y) || !head(x, y)) continue;
      const d = Math.min(Math.hypot(x - 12, y - 36), Math.hypot(x - 24, (y - 38) * 1.2));
      gp[d < 2 ? 'Z' : d < 4 ? 'X' : d < 7 ? 'x' : 'q'].push([x, y]);
    }
  parts2.push(parts(gp, { pal: GLOW }));
  // the wide mouth, a sleepy pleased curl at the corner
  parts2.push(bezierLine(1, 27, 12, 31, 28, 28, '0', { ...digits(BOG) }));
  parts2.push(parts({ 0: [[28, 27], [29, 26]] }, { pal: digits(BOG) }));
  // the great eyes, heavy-lidded, a gold slit pupil
  parts2.push(round(10, 14, 5, 4.5, BOG), round(25, 11, 5, 4.5, BOG));
  parts2.push([['4444444', '.yYkYy.'], 7, 13, { pal: { ...GLOW, ...digits(BOG) } }], [['4444444', '.yYkYy.'], 22, 10, { pal: { ...GLOW, ...digits(BOG) } }]);
  // warts and a nostril
  parts2.push(parts({ 2: [[2, 21], [4, 21]], 3: [[30, 20], [34, 24], [31, 17]], 5: [[18, 18], [20, 21]] }, { pal: digits(BOG) }));
  // the lily-pad crown with its lantern
  parts2.push([['..333333..', '.33444443.', '3344554443', '.2233332..'], 13, 4, { pal: digits(REED), edge: REED[0] }]);
  parts2.push(...lantern(16, -2, 2));
  return render(PS, PS, GLOW, {}, parts2);
}

function sluiceKeeperPortrait(): HTMLCanvasElement {
  const p: Part[] = [];
  // overall straps on the shoulders, the collar plate
  p.push(V(ell(22, 42, 18, 10), [3, 32, 39, 39], [16, 35, 14, 6], OVERALL));
  p.push(V(poly([[4, 31], [38, 31], [39, 37], [3, 37]]), [2, 30, 39, 38], [14, 32, 14, 3], BRASS));
  p.push(parts({ 2: [[7, 34], [14, 35], [21, 35], [28, 35], [35, 34]] }, { pal: digits(BRASS) }));
  // the helmet's dome
  p.push(V(ell(22, 17, 16, 15), [5, 1, 39, 33], [15, 9, 15, 13], BRASS));
  p.push([['.333.', '44333', '.222.'], 24, 0, { pal: digits(BRASS), edge: BRASS[0] }]);
  // the porthole: his face behind the glass (brown fur, bright eyes, a pink nose, the big front teeth)
  const ph: Record<string, Pts> = { 1: [], 2: [], 3: [], 4: [], v: [], V: [] };
  for (let y = 7; y < 29; y++)
    for (let x = 1; x < 24; x++) {
      const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 18);
      if (d > 11) continue;
      if (d > 9.5) ph[d > 10.3 ? '2' : '4'].push([x, y]);
      else ph[(x - 12) + (y - 18) < -9 ? 'V' : 'v'].push([x, y]);
    }
  p.push(parts({ 2: ph['2'], 4: ph['4'] }, { pal: digits(BRASS) }));
  // fur inside, a shade cooler (seen through the glass)
  p.push(V(ell(13, 20, 8, 8), [4, 11, 22, 28], [10, 16, 7, 6], FUR));
  p.push([['.55.', '5555', '.44.'], 3, 20, { pal: digits(FUR), edge: FUR[0] }]);
  p.push([['kk...kk', 'kW...kW'], 6, 16, { pal: GLOW }]);
  p.push([['GG', 'gg'], 3, 19, { pal: GLOW }]);
  p.push([['ttt', 'ttt', 't.t'], 5, 23, { pal: GLOW }]);
  // the glass: a glint across it, bolts round the rim
  p.push(parts({ V: [[5, 10], [6, 10], [4, 11], [7, 9]], v: [[8, 9], [3, 12]] }, { pal: GLOW, late: true }));
  p.push(parts({ 5: [[12, 7], [2, 18], [21, 15], [20, 25], [5, 26]] }, { pal: digits(BRASS) }));
  return render(PS, PS, GLOW, {}, p);
}

// ------------------------------------------------------------------ build

/** Foes dark enough to sink into the Duskmire's backdrops: they get the region's rim light. */
const RIMMED = ['peatgolem', 'inkeel', 'sunkensentinel', 'duskmoths', 'lamplighter', 'stiltheron', 'boghag', 'oldsnapper'];

/**
 * The Duskmire's light on a finished frame (docs/art-style.md section 9): the sky's rose-violet dusk on the top and
 * left edges, the fen's lantern amber along the bottom edge. Ink (the outline, dark interior lines) is left alone.
 */
function duskRim(c: HTMLCanvasElement): void {
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const W = c.width;
  const H = c.height;
  const src = new Uint8ClampedArray(d);
  const isDark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return true;
    const i = (y * W + x) * 4;
    return src[i + 3] < 128 || src[i] + src[i + 1] + src[i + 2] < 90;
  };
  const tint = (i: number, col: [number, number, number], k: number) => {
    d[i] = Math.round(d[i] + (col[0] - d[i]) * k);
    d[i + 1] = Math.round(d[i + 1] + (col[1] - d[i + 1]) * k);
    d[i + 2] = Math.round(d[i + 2] + (col[2] - d[i + 2]) * k);
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (isDark(x, y)) continue;
      const i = (y * W + x) * 4;
      if (isDark(x, y - 1) || isDark(x - 1, y)) tint(i, [232, 150, 196], 0.4);
      else if (isDark(x, y + 1)) tint(i, [240, 160, 72], 0.38);
    }
  ctx.putImageData(img, 0, 0);
}

/** The jobs that draw every texture this file makes: one sprite (with its phase looks) per job, then the rest. */
function jobs(): Array<() => Array<[string, HTMLCanvasElement]>> {
  const def = (W: number, H: number, fn: (pose: string) => Part[]): SpriteDef => ({ W, H, pal: GLOW, shades: {}, parts: fn });
  const defs: Record<string, SpriteDef> = {
    bogwisp: def(28, 26, wispParts),
    miretoad: def(31, 21, toadParts),
    reedling: def(22, 32, reedParts),
    peatgolem: def(44, 44, golemParts),
    bellybog: def(66, 48, (p) => bellybogParts(p, 1)),
    bellybog2: def(66, 48, (p) => bellybogParts(p, 2)),
    mudskipper: def(27, 23, skipperParts),
    stiltheron: def(32, 48, heronParts),
    lamplighter: def(24, 32, lamplighterParts),
    oldsnapper: def(55, 34, snapperParts),
    sluicekeeper: def(48, 48, sluiceParts),
    inkeel: def(32, 42, eelParts),
    duskmoths: def(34, 32, mothParts),
    boghag: def(32, 36, hagParts),
    sunkensentinel: def(38, 46, sentinelParts),
    lighthouse: def(76, 80, (p) => lighthouseParts(p, 1)),
    lighthouse2: def(76, 80, (p) => lighthouseParts(p, 2)),
    lighthouse3: def(76, 80, (p) => lighthouseParts(p, 3)),
  };
  const out: Array<() => Array<[string, HTMLCanvasElement]>> = DUSK_SPRITES.map((name) => () => {
    // a boss's phase looks share its frame size, so swapping between them never jumps
    const group: string[] = name === 'lighthouse' ? [name, ...LIGHTHOUSE_PHASES] : name === 'bellybog' ? [name, 'bellybog2'] : [name];
    const frames = fitFrames(group.flatMap((n) => DUSK_POSES.map((pose): [string, SpriteDef, string] => [n, defs[n], pose])));
    if (RIMMED.includes(name)) for (const [key, c] of frames) if (!key.endsWith('_flash')) duskRim(c);
    return frames;
  });
  out.push(() => [
    ['portrait_bellybog', bellybogPortrait()],
    ['portrait_sluiceKeeper', sluiceKeeperPortrait()],
  ]);
  return out;
}

const drawn: Array<[string, HTMLCanvasElement]> = [];
let queue: Array<() => Array<[string, HTMLCanvasElement]>> | null = null;

/**
 * Draw some of Region 4's foe art (whole sprites, until `ms` have gone by): the scene paints it in idle time after
 * boot, after Ashfell's, so a player who never reaches the region never waits for it. True once it's all drawn.
 */
export function paintDuskFoeSlice(ms = 8): boolean {
  queue ??= jobs();
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < ms) drawn.push(...queue.shift()!());
  return queue.length === 0;
}

/** Whether all of it has been drawn. */
export const duskFoeArtReady = (): boolean => queue !== null && queue.length === 0;

/**
 * Add Region 4's foes and portraits once they're drawn (every call after that, as on a relayout, adds fresh copies of
 * the drawn canvases). `now`: draw whatever is left first (a fight or a scene needs them).
 */
export function buildDuskFoeArt(add: Add, now = false): void {
  if (now) while (!paintDuskFoeSlice(1e9));
  if (!duskFoeArtReady()) return;
  for (const [key, c] of drawn) {
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext('2d')!.drawImage(c, 0, 0);
    add(key, copy);
  }
}

const DUSK_PORTRAIT_KEYS = DUSK_PORTRAITS.map((n) => 'portrait_' + n);
/** Whether a texture is one this file draws (a foe's frame, a phase look's, a portrait): asking for one draws the lot. */
export const isDuskArtKey = (key: string): boolean => DUSK_PORTRAIT_KEYS.includes(key) || DUSK_SPRITES.some((n) => key.startsWith(n + '_') || key.startsWith(n + '2_') || key.startsWith(n + '3_'));

void [hash2, shag];
