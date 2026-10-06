// The act map's art (see docs/art-style.md): a small living world seen from above at a slight angle, one per act
// theme (the sunny Meadow Road, the Old Ruins at dusk, the Boar King's Hollow at sunset). Two kinds of art:
//   - sprites built once at boot (buildMapArt): map-scale Rowan, Sable and Pip, a mini version of every enemy for the
//     fight nodes, the node props (campfire, chest, stall, "?", flag), the boss lairs and the ambient critters;
//   - the act's landscape (paintLand), painted per map with the backdrop toolkit because the roads and the
//     clearings follow that map's nodes. It comes out as LAND_FRAMES frames that differ only in how the trees,
//     bushes and grass lean, so the view can cycle them for a cheap wind sway.
// Colours and motifs come from backdrop.ts so the map matches the fights.
import { grid, stamp, toCanvas, type Pal } from './art';
import {
  bay,
  clamp01,
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
  rock,
  torchLight,
  tuft,
  type Blob,
  type Col,
  type Ramp,
  type Theme,
} from './backdrop';

type Add = (key: string, c: HTMLCanvasElement) => void;
export type Pt = [number, number];

const INK = col('#140c1c');
const INK_S = '#140c1c';

// ------------------------------------------------------------------ Rowan and Pip (map scale, facing right)

const ROWAN_PAL: Pal = {
  x: '#4a0f1a', R: '#8a1a22', r: '#d03030', q: '#f05a48', Q: '#ff9a80',
  M: '#4a5272', m: '#7c86a6', s: '#b8c2d8', S: '#eef3fa', W: '#ffffff',
  Y: '#9a5a14', y: '#d8901c', g: '#f2c230', G: '#fff0a0',
  B: '#1a3c8a', b: '#2a6ad8', l: '#4aa0f0',
  k: '#1c1430', e: '#4ad8ff',
  d: '#4a2c18', h: '#6e4426',
  c: '#6a1424', C: '#b42c34',
};
// head to tabard, 11 wide: the plume streams back, the visor glows, the sword is held up in front
const ROWAN_TOP = [
  '....rqQ....',
  '..Rrrqq...W',
  '.Rr.msSm..S',
  '.R.msSWsM.S',
  '.x.ygggyY.s',
  '...mkekek.s',
  '..cmsbbsmyg',
  '.cCMbllbMs.',
  '.cCygGgyY..',
  '..cbllbB...',
];
const ROWAN_CAPE_FLAP = ['..', 'C.', 'cC'];
const ROWAN_LEGS: Record<string, string[]> = {
  stand: ['...sm.sm...', '...hd.hd...'],
  a: ['..sm...sm..', '.hd.....hd.'],
  pass: ['....smm....', '....hdd....'],
  b: ['..ms...ms..', '.dh.....dh.'],
};
export const ROWAN_W = 13;
export const ROWAN_H = 16;
/** Rowan's feet inside his frame (the view's origin). */
export const ROWAN_FEET: Pt = [6, 14];

function rowanFrame(legs: string, bob: number, flap: boolean): HTMLCanvasElement {
  const g = grid(ROWAN_W, ROWAN_H);
  const top = ROWAN_H - 2 - ROWAN_LEGS.stand.length - ROWAN_TOP.length + bob;
  stamp(g, ROWAN_TOP, ROWAN_PAL, 1, top);
  if (flap) stamp(g, ROWAN_CAPE_FLAP, ROWAN_PAL, 0, top + 7);
  stamp(g, ROWAN_LEGS[legs], ROWAN_PAL, 1, ROWAN_H - 2 - 2);
  return toCanvas(g);
}

// Sable at the same scale (same frame size and feet point as Rowan): plum hood with the eye slit, the teal mask and
// its tail streaming back, the coral sash, a dagger in each hand held point-down.
const SABLE_PAL: Pal = {
  1: '#1c1632', 2: '#2c2250', 3: '#41306a', 4: '#5a3e84', 5: '#7a5498', 6: '#a274b0', 7: '#c69ac4',
  b: '#135a62', c: '#1c8a80', d: '#34b496', e: '#74dcb0',
  q: '#d05a3a', R: '#9a3030', S: '#f6c494', k: '#140c1c',
  V: '#dcd2e6', w: '#6e6488', A: '#e6eef8', L: '#a8b4d0', g: '#e0a030',
};
const SABLE_TOP = [
  '...45664...',
  '..5677654..',
  '.566655443.',
  '.5654SkSk3.',
  '..543eeddc.',
  '..2456654g.',
  '...566654A.',
  '..g5qqqRRL.',
  '.L.43332.A.',
  'L..32.32...',
];
/** The scarf tail: drooping at rest, streaming back on the move. [rows, x, y] relative to the top map. */
const SABLE_TAIL: Record<'rest' | 'flap', [string[], number, number]> = {
  rest: [['.ed', 'dc.', 'c..', 'b..'], 0, 4],
  flap: [['..edd', 'edcc.', 'c....'], -1, 4],
};
const SABLE_LEGS: Record<string, string[]> = {
  stand: ['...Vw.Vw...', '...21.21...'],
  a: ['..Vw...Vw..', '.21.....21.'],
  pass: ['....Vww....', '....211....'],
  b: ['..wV...wV..', '.12.....12.'],
};

function sableFrame(legs: string, bob: number, flap: boolean): HTMLCanvasElement {
  const g = grid(ROWAN_W, ROWAN_H);
  const top = ROWAN_H - 2 - SABLE_LEGS.stand.length - SABLE_TOP.length + bob;
  const [tail, tx, ty] = SABLE_TAIL[flap ? 'flap' : 'rest'];
  stamp(g, tail, SABLE_PAL, 1 + tx, top + ty);
  stamp(g, SABLE_TOP, SABLE_PAL, 1, top);
  stamp(g, SABLE_LEGS[legs], SABLE_PAL, 1, ROWAN_H - 2 - 2);
  return toCanvas(g);
}

const PIP_PAL: Pal = {
  b: '#2a6ad8', B: '#1a3c8a', N: '#6aaef0', f: '#8ac4f6',
  i: '#ffd84a', k: '#140c1c', g: '#ffe070', y: '#f2a020', c: '#efe2c4',
};
const PIP_MINI = ['.N...N.', '.bNNNb.', 'bikbikb', 'bbbybbb', 'Bbcccbb', '.bcccb.', '..y.y..'];
const PIP_WINGS = {
  down: [
    [-1, 3],
    [-1, 4],
    [7, 3],
    [7, 4],
    [-1, 5],
    [7, 5],
  ],
  up: [
    [-2, 0],
    [-1, 1],
    [-2, 1],
    [-1, 2],
    [8, 0],
    [7, 1],
    [8, 1],
    [7, 2],
  ],
};

function pipFrame(up: boolean): HTMLCanvasElement {
  const g = grid(13, 10);
  stamp(g, PIP_MINI, PIP_PAL, 3, 2);
  for (const [x, y] of up ? PIP_WINGS.up : PIP_WINGS.down) g[2 + y][3 + x] = up && y === 0 ? PIP_PAL.N : PIP_PAL.B;
  return toCanvas(g);
}

// ------------------------------------------------------------------ mini enemies (facing left, toward Rowan)

const SLIME = { 1: '#14284a', 2: '#1b5464', 3: '#25866e', 4: '#3fb47e', 5: '#7cdc8e', 6: '#d4fac0' };
const CROW = { 0: '#100c20', 1: '#1e1e3c', 2: '#2e3460', 3: '#42548a', 4: '#6488bc', 5: '#9ccce0' };
const FUR = { 1: '#2e1622', 2: '#5a2e26', 3: '#8a4a2c', 4: '#b06a36', 5: '#d8964e' };
const PURP = { 1: '#1e1430', 2: '#36244e', 3: '#523a72', 4: '#7a5a9a', 5: '#a888c8' };
const GOLD_P = { G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14' };

interface Mini {
  pal: Pal;
  frames: string[][];
}

/** Every enemy sprite's map-scale stand-in: `mfoe_${sprite}_${frame}`. */
const MINIS: Record<string, Mini> = {
  slime: {
    pal: { ...SLIME, W: '#ffffff', k: INK_S },
    frames: [
      ['...5555...', '..566654..', '.56W65544.', '.5k55k444.', '45k55k4443', '4555554433', '3444443332', '.22222221.'],
      ['..........', '...55554..', '.556W6544.', '45k55k5443', '45k55k4443', '4555544433', '3444443332', '2222222221'],
    ],
  },
  slimelet: {
    pal: { ...SLIME, W: '#ffffff', k: INK_S },
    frames: [
      ['..555..', '.56W54.', '5k5k443', '4555433', '.22221.'],
      ['.......', '.5565..', '5k5k543', '4555433', '2222221'],
    ],
  },
  bigslime: {
    pal: { ...SLIME, ...GOLD_P, W: '#ffffff', k: INK_S },
    frames: [
      ['.....g.g.g...', '.....gyGyg...', '...5555555...', '..566666554..', '.56W66655544.', '.5k55k555444.', '45k55k5554443', '4555555544433', '3444444443332', '.22222222221.'],
      ['.............', '.....g.g.g...', '.....gyGyg...', '..555555554..', '.566W6665544.', '45k55k5554443', '45k55k5554443', '4555555544433', '3444444443332', '2222222222221'],
    ],
  },
  crow: {
    pal: { ...CROW, ...GOLD_P, E: '#ff4a3a', k: INK_S },
    frames: [
      ['...........', '..443......', '.45433.....', 'ggE33332...', '.y3333222..', '..33222221.', '...2222.111', '....y..y...'],
      ['......4....', '..443.43...', '.454334....', 'ggE33332...', '.y3333222..', '..33222221.', '...2222.111', '....y..y...'],
    ],
  },
  boar: {
    pal: { ...FUR, W: '#fff4e0', p: '#d88078', P: '#a85458', k: INK_S, h: '#2a1c24' },
    frames: [['.....1.1.1..', '...13444321.', '..345444433.', '.3k44444332.', 'pp444444332.', 'PW343333221.', '.W.h1..h1...']],
  },
  bandit: {
    pal: { ...PURP, S: '#f2b888', s: '#d88a5a', k: INK_S, A: '#eef3fa', a: '#7c86a6', d: '#2a1810', D: '#4a2c18' },
    frames: [['...443...', '..45443..', '.4kkkk3..', '.4SkSs3..', '..3s432..', '.433332..', 'A4433322.', 'a.43332..', '..3.32...', '..d..d...']],
  },
  knight: {
    pal: { 1: '#2a3440', 2: '#465462', 3: '#6e7e8a', 4: '#a4b2b4', 5: '#e2ead8', k: INK_S, E: '#d8ff6a', L: '#b4d058', l: '#78a83c', f: '#4a7e36', F: '#2e5a32', g: '#f2c230', y: '#d8901c' },
    frames: [['...lL4...', '..L4543..', '..4kEk3..', '..33332..', 'gLlf432..', 'yllff332.', 'yfff4332.', '.yff3332.', '..y.3.2..', '...2..2..']],
  },
  captain: {
    pal: { ...PURP, ...GOLD_P, W: '#ffffff', w: '#ece6f8', S: '#f2b888', s: '#d88a5a', k: INK_S, R: '#8a1a22', q: '#d03030', m: '#2a1810', d: '#2a1810' },
    frames: [['.....wW....', '...4444w...', '.g44554gg..', '..gyyyyy...', '...kSSs....', '...Smms....', '..qqqqR....', '.3qR4432...', '.334g4332..', '..33g332...', '..3.3.3....', '..d...d....']],
  },
  archer: {
    pal: { 1: '#14262a', 2: '#204630', 3: '#3a6e34', 4: '#68a03c', 5: '#a4d04e', h: '#6e4024', H: '#986434', j: '#48261e', E: '#ffe04a', k: INK_S, o: '#6e4020', a: '#b07a44', s: '#e8e0c8', c: '#4e344c', C: '#704a60', d: '#2a1810' },
    frames: [['...HHh...', '..HhhhH..', '.54Ek4h..', '5544442h.', '.a.43jh..', 'a.cCCCc..', 'as.cCCc..', '.a.cCc...', '..ac.c...', '...d.d...']],
  },
  shaman: {
    pal: { 1: '#501650', 2: '#7e1e68', 3: '#ac2c7c', 4: '#d85a92', 5: '#ff9cb4', O: '#fff4e4', g: '#3e1438', f: '#2e1a30', E: '#eaff8a', w: '#e8f0d8', r: '#2c7064', R: '#4c967a', t: '#1e5050', s: '#8e5a2e', S: '#4e2c16', L: '#f4ffc8', l: '#b4f05a' },
    frames: [['l..........', 'Ls.444.....', '.s45O443...', '.443444O32.', '.s3444443321', '.sggggggg1..', '.s.fEfE....', '.s.wwww....', '.s.rRRrt...', '.s.rRrtt...', '.s..rrt....', '.S..t.t....']],
  },
  beetle: {
    pal: { 1: '#123a4a', 2: '#1a6066', 3: '#2a8c84', 4: '#58c0a2', 5: '#c4f4c8', b: '#dca444', B: '#a86a26', u: '#30223c', E: '#ff6a3a', k: INK_S },
    frames: [['.....4443...', '...445543332', '..4554433322', '.u45433333221', 'uEbbbbbbbbbB.', '.uu.u..u..u..']],
  },
  golem: {
    pal: { 1: '#34344a', 2: '#545264', 3: '#78747c', 4: '#a09a96', 5: '#c8c0b2', C: '#447436', D: '#6e9c3c', E: '#a8c850', t: '#22a098', u: '#62e4d4', U: '#d8fff6', k: INK_S },
    frames: [['....DEDC....', '...45543....', '...4uU42....', '.DE443332E..', '45542u33221.', '4544u3332321', '.442333322..', '..43333321..', '..432..321..', '.4432..3321.']],
  },
  wolf: {
    pal: { 1: '#28304c', 2: '#404c6e', 3: '#5e6e92', 4: '#8a9cb8', 5: '#c0ccd8', W: '#f6f4ee', w: '#b4bccc', E: '#ffd84a', k: INK_S },
    frames: [['..4.4.......', '..444.......', '.4E443...44.', 'k44444333421', '.wW4433333..', '..w43332221.', '...4.3..3.2.', '...4.3..3.2.']],
  },
  boarking: {
    pal: { 1: '#3a1a22', 2: '#5e3030', 3: '#844a38', 4: '#a86a48', 5: '#c88e5e', m: '#1e1018', n: '#2e1622', o: '#46222e', ...GOLD_P, W: '#fff4e0', w: '#d8c8a8', p: '#d88078', P: '#a85458', e: '#ff5a3a', k: INK_S, h: '#2a1c24' },
    frames: [
      ['....g.g.g......', '....gGgGg......', '....yyyyynnm...', '...34444onnnmm..', '..3e44443onnnmm.', '.34444443oonnm..', 'pp4444443332221.', 'PW344443333221..', 'W.w33333322221..', '..h21..h2..h21..'],
    ],
  },
  piglet: {
    pal: { 1: '#7a4430', 2: '#a8683e', 3: '#d08e52', 4: '#f0b870', p: '#d88078', k: INK_S, h: '#2a1c24' },
    frames: [['..4.....', '.4433333', 'pk433322', 'p3332221', '.h1..h1.']],
  },
};
export const MINI_FOES = Object.keys(MINIS);

// ------------------------------------------------------------------ node props

const PROP_PAL: Pal = {
  ...GOLD_P,
  W: '#ffffff',
  k: INK_S,
  // wood
  D: '#2e1a0e', d: '#4e2c16', h: '#8e5a2e', H: '#b07a44', j: '#d09a5e',
  // stone
  n: '#4a5272', m: '#7c86a6', s: '#b8c2d8',
  // fire
  f: '#fff4b0', F: '#ffd84a', o: '#ff9a2a', O: '#e8441a', x: '#8a1a22',
  // cloth: green awning, cream stripes, blue flag
  a: '#2a6a34', A: '#4a9a40', L: '#7ac850', c: '#f4ead4', C: '#d8c8a8',
  b: '#2a6ad8', B: '#1a3c8a', l: '#4aa0f0',
  // red, bone
  r: '#d03030', R: '#8a1a22', e: '#fffcf0', E: '#d8c8a8',
  // the "?"
  q: '#e0f6ff', Q: '#9ad8ff', u: '#4aa0f0', U: '#2a6ad8',
};

const CHEST = ['.hhhhhhhhh.', 'hjHHgGHHHhd', 'hHHHgyHHhhd', 'gGggggggggy', 'dHHHgkgHHhd', 'dhhhyyyhhhd', 'dhhhhhhhhhd', '.ddddddddd.'];
const CHEST_OPEN = ['.DDDDDDDDD.', 'DhhhhhhhhhD', 'dHHHHHHHHhd', 'dGFGgGFgGyd', 'gGggggggggy', 'dHHHgkgHHhd', 'dhhhyyyhhhd', '.ddddddddd.'];
const LOGS = ['..m.....s..', '.smH..hjsm.', 'nmhjHHhjhmn', '.ndhhddhdn.'];
const EMBERS = ['....oO.....', '..m.Oo..s..', '.smHxOxhsm.', 'nmhjHHhjhmn', '.ndhhddhdn.'];
const FLAMES = [
  ['..f..', '.fF..', '.fFo.', 'oFFfo', 'OoFoO', '.OOO.'],
  ['...f.', '..Ff.', '.oFf.', 'ofFFo', 'OoFoO', '.OOO.'],
  ['..f..', '..Ff.', '.fFFo', 'oFfFo', 'OFoFO', '.OOO.'],
];
const STALL = [
  'cAcAcAcAcAcAc',
  'aAcAcAcAcAcAa',
  'acAcAcAcAcAca',
  '.LaLaLaLaLaL.',
  '.h.........h.',
  '.h..g.Ggy..h.',
  '.h.gGy.yY..h.',
  'jjjjjjjjjjjjH',
  'hHHHHHHHHHHHd',
  'hHdHHHHHHdHHd',
  'dddddddddddd.',
];
const QMARK = ['.qqqq.', 'qQ..uq', 'Q...uQ', '...uQ.', '..uQ..', '..Q...', '......', '..u...', '..U...'];
const QMARK_BIG = ['.qqqqq.', 'qQQ.QuQ', 'QQ...uQ', '....uQQ', '...uQQ.', '..uQQ..', '..QQ...', '.......', '..uu...', '..UU...'];
const FLAG = ['hblll.', 'hbbll.', 'hbgbbl', 'hbbbB.', 'hBB...', 'h.....', 'h.....', 'H.....', 'd.....'];
const SKULL = ['.eeee.', 'eeeeeE', 'ekeekE', 'eeEeEE', '.eEeE.'];
const SIGN = ['....h....', '.jjjjjjH.', 'jHHHHHHHd', 'jHkkkkHHdH', '.dddddddd', '....h....', '....h....', '...dhd...'];

function prop(rows: string[], pad = 1): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const g = grid(w + pad * 2, rows.length + pad * 2);
  stamp(g, rows, PROP_PAL, pad, pad);
  return toCanvas(g);
}

// ------------------------------------------------------------------ ambient critters

const FLY_PAL: Pal = { w: '#ffffff', y: '#fff0a0', k: INK_S, p: '#ff9cc0', o: '#ffb84a', b: '#9ad8ff' };
const BUTTERFLY = [
  ['w.w', 'wkw', '.k.'],
  ['.w.', '.k.', '.k.'],
];
const BIRD = [
  ['k...k', '.k.k.', '..k..'],
  ['.....', 'kkkkk', '..k..'],
];
const BAT = [
  ['k.....k', 'kk.k.kk', '.kkkkk.', '...k...'],
  ['.......', '..k.k..', 'kkkkkkk', 'k..k..k'],
];
const LEAF_PAL: Pal = { a: '#f4b040', b: '#e0822e', c: '#c0522a', d: '#8e3024' };
const LEAVES = [
  ['ab', 'cd'],
  ['.a', 'bc', 'd.'],
  ['abc', '.d.'],
];

/** A raw (no outline) sprite from rows. */
function raw(rows: string[], pal: Pal): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.' || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

/** Windmill sails at an angle (four arms of lattice cloth), drawn around the hub at the frame's centre. */
function sails(angle: number): HTMLCanvasElement {
  const S = 19;
  const p = new Pix(S, S, -1);
  const c = (S - 1) / 2;
  const cloth = [col('#f4ead4'), col('#d8c8a8')];
  const wood = col('#6e4020');
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    for (let t = 1; t <= 8; t++) {
      const x = Math.round(c + ux * t);
      const y = Math.round(c + uy * t);
      p.set(x, y, wood);
      if (t >= 3)
        for (let s = 1; s <= 2; s++) {
          const sx = Math.round(c + ux * t - uy * s);
          const sy = Math.round(c + uy * t + ux * s);
          if (p.get(sx, sy) < 0) p.set(sx, sy, cloth[(t + s) % 2 === 0 ? 0 : 1]);
        }
    }
  }
  p.set(c, c, col('#2e1a0e'));
  outline(p);
  return p.canvas();
}

/** A soft round shadow blob (cloud shadows), solid colour: the view draws it at a low alpha. */
function blobShadow(w: number, h: number, seed: number): HTMLCanvasElement {
  const p = new Pix(w, h, -1);
  const r = rng(seed);
  const blobs: Blob[] = [];
  for (let i = 0; i < 6; i++) blobs.push({ x: w * (0.2 + 0.6 * r()), y: h * (0.35 + 0.3 * r()), rx: w * (0.14 + 0.12 * r()), ry: h * (0.25 + 0.15 * r()) });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = blobs.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1 + (noise(x * 0.3, y * 0.3, seed) - 0.5) * 0.5);
      if (inside) p.set(x, y, 0x000000);
    }
  return p.canvas();
}

/** A long fog bank: a few stacked bands with ragged, dithered edges. */
function fogBank(w: number, h: number, seed: number): HTMLCanvasElement {
  const p = new Pix(w, h, -1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cx = Math.abs(x + 0.5 - w / 2) / (w / 2);
      const cy = Math.abs(y + 0.5 - h / 2) / (h / 2);
      const d = Math.max(cx ** 2.2, cy ** 1.4) + (noise(x * 0.12, y * 0.4, seed) - 0.5) * 0.5;
      if (d < 0.55 || (d < 0.85 && (0.85 - d) / 0.3 > bay(x, y))) p.set(x, y, col('#c8dce0'));
    }
  return p.canvas();
}

// ------------------------------------------------------------------ pixel buffer helpers

/** 1px ink outline around the opaque pixels of a transparent buffer. */
function outline(p: Pix, c: Col = INK): void {
  const src = p.buf.slice();
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h && src[y * p.w + x] >= 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) p.set(x, y, c);
}

/** Copy the opaque pixels of `s` onto `d` with its top-left at (x, y). */
function blit(d: Pix, s: Pix, x: number, y: number): void {
  for (let j = 0; j < s.h; j++)
    for (let i = 0; i < s.w; i++) {
      const c = s.buf[j * s.w + i];
      if (c >= 0) d.set(x + i, y + j, c);
    }
}

/** A copy whose rows above `split` (0..1 of the height) lean `dx` px: the wind-sway frames. */
function lean(s: Pix, dx: number, split: number): Pix {
  if (!dx) return s;
  const o = new Pix(s.w, s.h, -1);
  const cut = Math.round(s.h * split);
  for (let j = 0; j < s.h; j++) {
    const d = j < cut ? dx : 0;
    for (let i = 0; i < s.w; i++) {
      const c = s.buf[j * s.w + i];
      if (c >= 0) o.set(i + d, j, c);
    }
  }
  return o;
}

function stampPix(p: Pix, rows: string[], pal: Record<string, Col>, x: number, y: number): void {
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && pal[ch] !== undefined && p.set(x + i, y + j, pal[ch])));
}

const P = (o: Record<string, string>): Record<string, Col> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, col(v)]));

// ------------------------------------------------------------------ boss lairs (bottom centre = the lair's foot)

export interface Lair {
  canvas: HTMLCanvasElement;
  /** Flame bases (torches) and glow spots (runes, eyes), relative to the lair's foot. */
  flames: Pt[];
  glows: Pt[];
}

/** Act 1: the Bandit Captain's camp, a striped tent with a skull banner, crates and a barrel. */
function lairCamp(): Lair {
  const W = 34;
  const H = 30;
  const p = new Pix(W, H, -1);
  const cx = 16;
  const apex = 8;
  const base = H - 3;
  const purple = ramp('#36244e', '#523a72', '#7a5a9a', '#a888c8');
  const red = ramp('#4a0f1a', '#8a1a22', '#d03030', '#f05a48');
  const dark = ramp('#0e0a16', '#1c1430', '#2e2244');
  for (let y = apex; y <= base; y++) {
    const half = (y - apex) * 0.62 + 1;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x + 0.5 - cx) / Math.max(1, y - apex + 2);
      const stripe = Math.floor((u + 1) * 4.5) % 2;
      const lit = x < cx;
      const r = stripe ? red : purple;
      let v = lit ? 0.85 : 0.45;
      if (y > base - 2) v -= 0.25;
      if (Math.abs(u) > 0.5) v -= 0.15;
      p.set(x, y, pick(r, v, x, y));
      // the open flap: a dark doorway, deepest in the middle
      const door = y > apex + 7 && Math.abs(x + 0.5 - cx - 1) < (y - apex - 7) * 0.42;
      if (door) p.set(x, y, dark[Math.abs(x + 0.5 - cx - 1) < (y - apex - 7) * 0.2 ? 0 : 1]);
    }
  }
  // the flap folded back on the lit side
  for (let y = apex + 9; y <= base; y++) p.set(Math.round(cx - (y - apex - 7) * 0.42) - 1, y, col('#f05a48'));
  // pole and skull banner
  for (let y = 0; y < apex + 1; y++) p.set(cx, y, col('#6e4020'));
  stampPix(p, ['kkkkk.', 'keekkk', 'kekekk', 'keeek.', 'kkkk..'], P({ k: '#1c1430', e: '#f4ead4' }), cx + 1, 0);
  p.set(cx, 0, col('#f2c230'));
  // a barrel and two crates beside the tent
  stampPix(p, ['.hhh.', 'hHHhd', 'yyyyY', 'hHHhd', 'hHHhd', '.ddd.'], P({ h: '#8e5a2e', H: '#b07a44', d: '#4e2c16', y: '#7c86a6', Y: '#4a5272' }), 1, base - 5);
  stampPix(p, ['jjjjjH', 'jHdHHd', 'jdHdHd', 'jHdHdd', 'dddddd'], P({ j: '#d09a5e', H: '#b07a44', d: '#6e4020' }), W - 8, base - 4);
  stampPix(p, ['jjjjH', 'jHdHd', 'ddddd'], P({ j: '#d09a5e', H: '#b07a44', d: '#6e4020' }), W - 7, base - 7);
  outline(p);
  return { canvas: p.canvas(), flames: [], glows: [] };
}

/** Act 2: the rune gate, a toppled temple's last arch, its runes glowing teal; the golem guards it. */
function lairGate(): Lair {
  const W = 36;
  const H = 32;
  const p = new Pix(W, H, -1);
  const stone = ramp('#1c1c2c', '#34344a', '#545264', '#78747c', '#a09a96', '#c8c0b2');
  const moss = ramp('#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850');
  const rune = ramp('#14524e', '#22a098', '#62e4d4', '#d8fff6');
  const base = H - 2;
  const glows: Pt[] = [];
  const block = (x0: number, y0: number, w: number, h: number, seed: number) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const u = (x - x0) / Math.max(1, w - 1);
        let v = 0.78 - u * 0.5 + (noise(x * 0.5, y * 0.5, seed) - 0.5) * 0.25;
        if (y === y0) v += 0.2;
        // courses of masonry
        if ((y - y0) % 5 === 4 || ((x - x0 + ((((y - y0) / 5) | 0) % 2) * 3) % 6 === 5 && (y - y0) % 5 !== 4)) v -= 0.35;
        p.set(x, y, pick(stone, v, x, y));
        if (y - y0 < 2 && noise(x * 0.4, y, seed + 3) > 0.45) p.set(x, y, pick(moss, 0.7 - u * 0.4, x, y));
      }
  };
  // the dark void inside the arch
  const voidR = ramp('#0a0c14', '#101826', '#162a36');
  for (let y = 9; y < base; y++) for (let x = 9; x < W - 9; x++) p.set(x, y, pick(voidR, ((y - 9) / (base - 9)) * 0.9, x, y, 0.4));
  block(3, 10, 7, base - 10, 5);
  block(W - 10, 10, 7, base - 10, 9);
  // the lintel and its broken corner
  block(1, 4, W - 2, 7, 13);
  for (let x = W - 6; x < W - 1; x++) for (let y = 4; y < 4 + (x - (W - 6)); y++) p.set(x, y, -1);
  // a capstone ridge
  block(8, 1, W - 18, 3, 17);
  // runes carved down the pillars and across the lintel
  const marks: Pt[] = [
    [6, 15],
    [6, 20],
    [6, 25],
    [W - 7, 15],
    [W - 7, 20],
    [W - 7, 25],
    [12, 7],
    [W / 2, 7],
    [W - 13, 7],
  ];
  for (const [x, y] of marks) {
    stampPix(p, ['.u.', 'uUu', '.u.'], { u: rune[1], U: rune[3] }, Math.round(x) - 1, y - 1);
    glows.push([Math.round(x) - W / 2, y - H]);
  }
  // rubble at the foot
  const rubble: Array<[number, number, number]> = [
    [2, base, 2],
    [W - 3, base, 2],
    [12, base, 1],
  ];
  for (const [x, y, r] of rubble)
    for (let yy = -r; yy <= 0; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy * 2 <= r * r + 1) p.set(x + xx, y + yy, pick(stone, 0.6 - xx * 0.1 - yy * 0.15, x + xx, y + yy));
  outline(p);
  return { canvas: p.canvas(), flames: [], glows };
}

/** Act 3: the Boar King's den, a vast gnarled oak with a black hollow at its foot, torches either side. */
function lairDen(): Lair {
  const W = 46;
  const H = 46;
  const p = new Pix(W, H, -1);
  const cx = 23;
  const base = H - 3;
  const bark = ramp('#1a0e1c', '#281424', '#3a1c2a', '#4e262e', '#663232', '#7e4236', '#9a5a3e');
  const crownR = ramp('#2c1024', '#4a1a2c', '#741e2e', '#a0302e', '#c84e30', '#e67a36', '#f8aa46');
  const hole = ramp('#0a050c', '#140812', '#220c16', '#381218');
  const r = rng(77);
  // the crown: a wide autumn canopy
  mass(p, crown(r, cx, 13, 21, 11, 4.2), { ramp: crownR, seed: 31, bump: 0.2, tex: 0.3, vgrad: 0.25, light: 0.05, shadow: 0.3, form: { x: cx - 3, y: 12, rx: 23, ry: 13 }, formMix: 0.5 });
  // the trunk, flaring into roots
  for (let y = 16; y <= base; y++) {
    const t = (y - 16) / (base - 16);
    const half = 6 + t * t * 9 + (noise(y * 0.3, 1, 5) - 0.5) * 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const u = (x - (cx - half)) / (half * 2);
      let v = 0.85 - u * 0.75;
      const g = noise(x * 0.6, y * 0.12, 9);
      if (g > 0.62) v -= 0.3;
      else if (g < 0.3) v += 0.1;
      p.set(x, y, pick(bark, v, x, y, 0.15));
    }
  }
  // root tips curling out over the ground
  const roots: Array<[number, number]> = [
    [cx - 15, -1],
    [cx + 15, 1],
    [cx - 9, -1],
    [cx + 10, 1],
  ];
  for (const [x, dir] of roots)
    for (let i = 0; i < 5; i++) {
      p.set(x + dir * i, base - 1 + (i > 2 ? 1 : 0), bark[i < 2 ? 4 : 3]);
      p.set(x + dir * i, base + (i > 2 ? 1 : 0), bark[1]);
    }
  // the hollow: an arched black opening
  for (let y = base - 13; y <= base; y++)
    for (let x = cx - 7; x <= cx + 7; x++) {
      const dx = (x + 0.5 - cx) / 7;
      const dy = (y + 0.5 - (base - 6)) / 7.5;
      if (y > base - 6 ? Math.abs(dx) <= 1 : dx * dx + dy * dy <= 1) {
        const edge = Math.abs(dx) > 0.75 || (y < base - 6 && dx * dx + dy * dy > 0.6);
        p.set(x, y, edge ? hole[3] : hole[(y + x) % 7 === 0 ? 1 : 0]);
      }
    }
  // bones and a skull at the threshold
  stampPix(p, ['e...e', 'eeeee', 'e...e'], P({ e: '#e6d4bc' }), cx - 13, base - 1);
  stampPix(p, ['.ee.', 'ekke', '.eE.'], P({ e: '#fff4e0', k: '#2a140c', E: '#b49a8a' }), cx + 9, base - 2);
  outline(p);
  // torches on poles either side of the hollow
  for (const x of [cx - 11, cx + 11]) {
    for (let y = base - 9; y <= base; y++) p.set(x, y, y === base - 9 ? col('#4a3a34') : col('#6e3e20'));
    p.set(x - 1, base - 10, col('#2a2224'));
    p.set(x + 1, base - 10, col('#2a2224'));
    p.set(x, base - 10, col('#4a3a34'));
  }
  return {
    canvas: p.canvas(),
    flames: [
      [cx - 11 - W / 2, base - 10 - H],
      [cx + 11 - W / 2, base - 10 - H],
    ],
    glows: [],
  };
}

const LAIRS: Record<Theme, () => Lair> = { forest: lairCamp, ruins: lairGate, hollow: lairDen };
/** Each theme's lair spots (filled when buildMapArt builds the `maplair_${theme}` textures). */
export const LAIR_SPOTS: Partial<Record<Theme, { flames: Pt[]; glows: Pt[] }>> = {};

// ------------------------------------------------------------------ roads

/** Points along a polyline, every `step` px of arc length. */
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let need = step;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg >= need) {
      const t = need / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push([ax, ay]);
      seg -= need;
      need = step;
    }
    need -= seg;
  }
  const last = pts[pts.length - 1];
  const end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 0.3) out.push(last);
  return out;
}

/** The road from one spot to the next: an S-curve that leaves and arrives level, sampled every 1 px. */
export function trail(a: Pt, b: Pt, seed: number): Pt[] {
  const dx = b[0] - a[0];
  const c1: Pt = [a[0] + dx * 0.45, a[1] + (hash(seed, 11, 3) - 0.5) * 7];
  const c2: Pt = [b[0] - dx * 0.45, b[1] + (hash(seed, 12, 3) - 0.5) * 7];
  const fine: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const u = 1 - t;
    fine.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]);
  }
  return resample(fine, 1);
}

// ------------------------------------------------------------------ the land

/** Frames of the landscape (the trees and the grass lean differently in each). */
export const LAND_FRAMES = 4;
const SWAY = [0, 1, 0, -1];

export interface LandSpec {
  theme: Theme;
  w: number;
  h: number;
  /** Clearings: the start, every node and the boss (r = half width). */
  pads: Array<{ x: number; y: number; r: number; start?: boolean }>;
  /** Each road's points (from trail()). */
  trails: Pt[][];
  /** x of each column of nodes, left to right (the stream runs between two of them). */
  cols: number[];
  /** Rects the landmarks stay out of (HUD plates, the buttons). */
  keep: Array<{ x: number; y: number; w: number; h: number }>;
  /** Rects no scenery may cover (the icons standing on the clearings, their labels, the lair). */
  zones: Array<{ x: number; y: number; w: number; h: number }>;
  seed: number;
}

export interface Land {
  frames: HTMLCanvasElement[];
  /** Brazier and torch flame bases. */
  flames: Pt[];
  /** Chimney tops. */
  smoke: Pt[];
  /** Windmill hubs. */
  mills: Pt[];
  /** The stream's centre line, top to bottom (empty when there is none). */
  water: Pt[];
  /** Open ground for the critters to hang around. */
  spots: Pt[];
  /** Per pixel (y * w + x), for the critters (view/map-life.ts): 0 road or kept clear, 1 open ground, 2 cover (a
   *  tree, bush, stone or wall to hide in), 3 open water. */
  ground: Uint8Array;
}

/** A piece of scenery: its sprite (neutral, leaning right, leaning left), placed by its foot. */
interface Deco {
  spr: Pix[];
  /** Foot inside the sprite. */
  fx: number;
  fy: number;
  /** Footprint: radius around the visual centre, `cy` px above the foot. */
  r: number;
  cy: number;
  sway: boolean;
  /** Cast shadow (rx, ry) at the foot, or none. */
  shadow?: [number, number];
}

interface Placed {
  x: number;
  y: number;
  d: Deco;
  ph: number;
}

interface Ctx {
  W: number;
  H: number;
  spec: LandSpec;
  road: Uint8Array; // 1 road, 2 clearing
  water: Uint8Array; // 1 water, 2 bank
  dist: Float32Array; // px to the nearest road, clearing, water or reserved zone
  block: Uint8Array; // what dist measures from
  items: Placed[];
  land: Land;
  seed: number;
}

const at = (c: Ctx, x: number, y: number) => Math.max(0, Math.min(c.W - 1, Math.round(x))) + Math.max(0, Math.min(c.H - 1, Math.round(y))) * c.W;
const distAt = (c: Ctx, x: number, y: number) => c.dist[at(c, x, y)];

/** Distance (px, chamfer) from every pixel to the nearest set pixel of `mask`. */
function distField(mask: Uint8Array, W: number, H: number): Float32Array {
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : 1e6;
  const D = Math.SQRT2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - W] + 1);
        if (x > 0) v = Math.min(v, d[i - W - 1] + D);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + D);
      }
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + 1);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + D);
        if (x > 0) v = Math.min(v, d[i + W - 1] + D);
      }
      d[i] = v;
    }
  return d;
}

/** Whether a piece of scenery fits with its foot at (x, y): off the roads and water, not on top of other scenery. */
function fits(c: Ctx, d: Deco, x: number, y: number, spread = 0.8): boolean {
  if (x < -2 || x > c.W + 2 || y < 3 || y > c.H + 4) return false;
  if (distAt(c, x, y - d.cy) < d.r + 1.5 || distAt(c, x, y) < 2) return false;
  if (c.water[at(c, x, y)]) return false;
  for (const it of c.items) if (Math.hypot(it.x - x, it.y - it.d.cy - (y - d.cy)) < (it.d.r + d.r) * spread) return false;
  return true;
}

function put(c: Ctx, d: Deco, x: number, y: number): void {
  c.items.push({ x: Math.round(x), y: Math.round(y), d, ph: Math.floor(hash(Math.round(x), Math.round(y), c.seed) * 4) });
}

/** Mark a rect as taken (nothing else is placed over it once dist is refreshed). */
function reserve(c: Ctx, x: number, y: number, w: number, h: number): void {
  for (let j = Math.max(0, Math.floor(y)); j < Math.min(c.H, Math.ceil(y + h)); j++)
    for (let i = Math.max(0, Math.floor(x)); i < Math.min(c.W, Math.ceil(x + w)); i++) c.block[j * c.W + i] = 1;
}

/** Place a landmark and keep everything else off it. */
function claim(c: Ctx, d: Deco, x: number, y: number): void {
  put(c, d, x, y);
  const s = d.spr[0];
  reserve(c, Math.round(x) - d.fx, Math.round(y) - d.fy, s.w, s.h);
  c.dist = distField(c.block, c.W, c.H);
}

/** Whether a rect clears the keep-out rects. */
const kept = (c: Ctx, x: number, y: number, w: number, h: number) => c.spec.keep.some((k) => x < k.x + k.w && x + w > k.x && y < k.y + k.h && y + h > k.y);

/** Best foot for a landmark of size w x h (foot at its bottom centre), or null when nothing is roomy enough. */
function roomFor(c: Ctx, w: number, h: number, need: number, near?: Pt, within = 1e9): Pt | null {
  let best: Pt | null = null;
  let bestS = -1;
  for (let y = h + 2; y < c.H - 2; y += 2)
    for (let x = Math.ceil(w / 2) + 2; x < c.W - w / 2 - 2; x += 2) {
      if (near && Math.hypot(x - near[0], y - near[1]) > within) continue;
      if (kept(c, x - w / 2, y - h, w, h)) continue;
      let m = 1e9;
      for (const [u, v] of [
        [0, 0],
        [-0.5, 0],
        [0.5, 0],
        [0, -1],
        [-0.5, -1],
        [0.5, -1],
        [0, -0.5],
        [-0.5, -0.5],
        [0.5, -0.5],
      ])
        m = Math.min(m, distAt(c, x + u * w, y + v * h));
      if (m < need) continue;
      if (c.items.some((it) => Math.abs(it.x - x) < (w + it.d.r * 2) / 2 && Math.abs(it.y - it.d.cy - (y - h / 2)) < (h + it.d.r * 2) / 2)) continue;
      const s = m + hash(x, y, c.seed) * 2 - (near ? Math.hypot(x - near[0], y - near[1]) * 0.05 : 0);
      if (s > bestS) (bestS = s), (best = [x, y]);
    }
  return best;
}

function shadowAt(p: Pix, cx: number, cy: number, rx: number, ry: number, k: number, to: Col): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) p.tint(x, y, (o) => mix(o, to, k));
}

/** A piece of scenery from a transparent buffer: optional outline, then the lean variants. */
function deco(p: Pix, fx: number, fy: number, r: number, cy: number, o: { sway?: boolean; split?: number; line?: boolean; shadow?: [number, number] } = {}): Deco {
  if (o.line !== false) outline(p);
  const sway = !!o.sway;
  const split = o.split ?? 0.45;
  return { spr: sway ? [p, lean(p, 1, split), lean(p, -1, split)] : [p], fx, fy, r, cy, sway, shadow: o.shadow };
}

// ------------------------------------------------------------------ scenery kits (built once per theme)

interface Kit {
  big: Deco[]; // trees
  mid: Deco[]; // bushes, columns, rocks
  small: Deco[]; // tufts, flowers, rubble
  extra: Record<string, Deco[]>;
}
const kits: Partial<Record<Theme, Kit>> = {};

/** Round-crowned tree: trunk under a leafy crown lit as one volume. */
function broadTree(seed: number, rx: number, ry: number, leaf: Ramp, bark: Ramp): Deco {
  const trunkH = Math.max(3, Math.round(ry * 0.8));
  const W = Math.ceil(rx * 2.4) + 4;
  const H = Math.ceil(ry * 2.3) + trunkH + 3;
  const p = new Pix(W, H, -1);
  const cx = W / 2;
  const cy = ry * 1.15 + 1.5;
  const foot = H - 2;
  for (let y = Math.floor(cy); y <= foot; y++) {
    p.set(Math.floor(cx) - 1, y, bark[2]);
    p.set(Math.floor(cx), y, bark[1]);
    if (y === foot) p.set(Math.floor(cx) + 1, y, bark[1]);
  }
  mass(p, crown(rng(seed), cx, cy, rx, ry, Math.max(2, rx * 0.42)), { ramp: leaf, seed, bump: 0.18, tex: 0.22, vgrad: 0.25, light: 0.04, shadow: 0.24, form: { x: cx - rx * 0.15, y: cy - ry * 0.1, rx: rx * 1.15, ry: ry * 1.15 }, formMix: 0.6 });
  return deco(p, Math.floor(cx), foot, rx * 0.95, foot - cy, { sway: true, split: 0.42, shadow: [rx * 0.8, Math.max(1.5, ry * 0.32)] });
}

function pineTree(seed: number, hgt: number, wid: number, leaf: Ramp, bark: Ramp): Deco {
  const W = Math.ceil(wid) + 4;
  const H = hgt + 4;
  const p = new Pix(W, H, -1);
  const cx = Math.floor(W / 2);
  const foot = H - 2;
  for (let y = foot - 3; y <= foot; y++) p.set(cx, y, bark[1]);
  conifer(p, rng(seed), cx + 0.5, foot - 2, hgt - 2, wid, { ramp: leaf, seed, bump: 0.1, tex: 0.15, light: 0.05 });
  return deco(p, cx, foot, wid * 0.45, hgt * 0.5, { sway: true, split: 0.4, shadow: [wid * 0.45, 1.5] });
}

function bush(seed: number, rx: number, leaf: Ramp, dots?: Col[]): Deco {
  const W = Math.ceil(rx * 2) + 6;
  const H = Math.ceil(rx * 1.6) + 4;
  const p = new Pix(W, H, -1);
  const r = rng(seed);
  const cx = W / 2;
  const foot = H - 2;
  const bl: Blob[] = [
    { x: cx - rx * 0.45, y: foot - rx * 0.55, rx: rx * 0.62, ry: rx * 0.55 },
    { x: cx + rx * 0.45, y: foot - rx * 0.5, rx: rx * 0.6, ry: rx * 0.52 },
    { x: cx + (r() - 0.5), y: foot - rx * 0.85, rx: rx * 0.65, ry: rx * 0.58 },
  ];
  mass(p, bl, { ramp: leaf, seed, bump: 0.2, tex: 0.25, vgrad: 0.3, light: 0.05, shadow: 0.22 });
  if (dots)
    for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
      const x = Math.round(cx + (r() - 0.5) * rx * 1.6);
      const y = Math.round(foot - rx * (0.4 + r() * 0.8));
      if (p.get(x, y) >= 0) p.set(x, y, dots[i % dots.length]);
    }
  return deco(p, Math.floor(cx), foot, rx * 0.9, rx * 0.6, { sway: true, split: 0.4, shadow: [rx * 0.9, 1.2] });
}

function tuftDeco(seed: number, hgt: number, r: Ramp): Deco {
  const p = new Pix(7, hgt + 2, -1);
  tuft(p, 3, hgt + 1, hgt, r, seed);
  return deco(p, 3, hgt + 1, 1, 1, { sway: true, split: 0.5, line: false });
}

function flowers(seed: number, petals: Col[], stem: Col): Deco {
  const p = new Pix(8, 5, -1);
  const r = rng(seed);
  const n = 3 + Math.floor(r() * 3);
  const c = petals[Math.floor(r() * petals.length)];
  for (let i = 0; i < n; i++) {
    const x = 1 + Math.floor(r() * 6);
    const y = 1 + Math.floor(r() * 2);
    p.set(x, y + 1, stem);
    p.set(x, y, i === 0 ? petals[(petals.indexOf(c) + 1) % petals.length] : c);
  }
  return deco(p, 4, 4, 2, 1, { sway: true, split: 0.5, line: false });
}

function boulder(seed: number, rx: number, ry: number, stone: Ramp, moss: Ramp, shadow: Col): Deco {
  const W = Math.ceil(rx * 2) + 5;
  const H = Math.ceil(ry) + 4;
  const p = new Pix(W, H, -1);
  const foot = H - 2;
  rock(p, W / 2, foot, rx, ry, stone, moss, shadow, seed);
  for (let x = 0; x < W; x++) if (p.get(x, foot) === shadow) p.set(x, foot, -1);
  return deco(p, Math.floor(W / 2), foot, rx, ry * 0.5, { shadow: [rx, 1] });
}

const LEAF_GREEN = ramp('#183e30', '#22543a', '#306c42', '#43864a', '#5ea052', '#80ba5a', '#a8d062');
const LEAF_LIGHT = ramp('#24502e', '#336a34', '#4a863a', '#68a042', '#8cba4c', '#b2d25e');
const PINE = ramp('#14352e', '#1c4a38', '#286240', '#367a48', '#4c9250', '#68aa58');
const BARK = ramp('#22170f', '#382616', '#52381f', '#6c4b2a');
const BUSH = ramp('#1d4630', '#295c36', '#39763c', '#4f9046', '#6eac52', '#8cc45a');
const TUFT_F = ramp('#2e6a32', '#3e8038', '#5a9c42', '#86c052');
const PETALS = [col('#fff4e0'), col('#ffd860'), col('#ff9cc0'), col('#c8b4ff')];
const ROCK_R = ramp('#4a5462', '#66717e', '#87909c', '#acb3bb');
const MOSS_R = ramp('#3a7434', '#55903e', '#78ae48');

function forestKit(): Kit {
  const big: Deco[] = [];
  for (let i = 0; i < 6; i++) big.push(broadTree(100 + i, 4 + (i % 3) * 1.4, 3.6 + (i % 3) * 1.1, i % 2 ? LEAF_GREEN : LEAF_LIGHT, BARK));
  for (let i = 0; i < 3; i++) big.push(pineTree(200 + i, 12 + i * 2, 8 + i, PINE, BARK));
  const mid: Deco[] = [
    bush(301, 3.2, BUSH),
    bush(302, 3.8, BUSH, [col('#ff6a7a'), col('#fff4e0')]),
    bush(303, 2.8, BUSH, [col('#fff4e0')]),
    bush(304, 4.2, BUSH),
    boulder(311, 3, 3, ROCK_R, MOSS_R, col('#2e4a2a')),
    boulder(312, 2.6, 2.4, ROCK_R, ROCK_R, col('#2e4a2a')),
  ];
  const small: Deco[] = [];
  for (let i = 0; i < 4; i++) small.push(tuftDeco(400 + i, 2 + (i % 3), TUFT_F));
  for (let i = 0; i < 4; i++) small.push(flowers(500 + i, PETALS, col('#3e8038')));
  // reeds for the stream banks
  const reed = (seed: number) => {
    const p = new Pix(5, 7, -1);
    const r = rng(seed);
    for (let k = 0; k < 3; k++) {
      const x = 1 + k;
      const h = 3 + Math.floor(r() * 3);
      for (let j = 0; j < h; j++) p.set(x, 5 - j, j === h - 1 ? col('#8a5a2e') : j > h / 2 ? col('#6aa848') : col('#3e7a38'));
    }
    return deco(p, 2, 5, 1, 2, { sway: true, split: 0.5, line: false });
  };
  return { big, mid, small, extra: { reed: [reed(601), reed(602), reed(603)], sign: [signDeco()], mill: [millDeco()], house: [houseDeco()], field: [fieldDeco()] } };
}

function signDeco(): Deco {
  const p = new Pix(11, 11, -1);
  stampPix(p, SIGN, P({ h: '#8e5a2e', H: '#b07a44', j: '#d09a5e', d: '#4e2c16', k: '#4e2c16' }), 1, 1);
  return deco(p, 5, 9, 4, 4, { shadow: [3, 1] });
}

/** A windmill tower (the view turns the sails over its hub: the sprite's top centre, 5 px down). */
function millDeco(): Deco {
  const W = 14;
  const H = 22;
  const p = new Pix(W, H, -1);
  const wall = ramp('#8a7a64', '#b8a68a', '#dccaa8', '#f4ead4');
  const roof = ramp('#4a1a1a', '#7a2a24', '#a8402e', '#c86a46');
  const foot = H - 2;
  for (let y = 7; y <= foot; y++) {
    const half = 3 + ((y - 7) / (foot - 7)) * 2;
    for (let x = Math.round(7 - half); x <= Math.round(6 + half); x++) {
      const u = (x - (7 - half)) / (half * 2);
      p.set(x, y, pick(wall, 0.95 - u * 0.8 - (y === foot ? 0.2 : 0), x, y));
    }
  }
  // a door and a little window
  for (let y = foot - 3; y <= foot; y++) for (let x = 6; x <= 7; x++) p.set(x, y, y === foot - 3 && x === 7 ? col('#6e4020') : col('#3a2416'));
  p.set(7, 11, col('#3a2a48'));
  p.set(7, 12, col('#3a2a48'));
  // the cap
  for (let y = 2; y <= 7; y++) {
    const half = Math.min(4, (y - 1) * 0.9);
    for (let x = Math.round(7 - half); x <= Math.round(6 + half); x++) p.set(x, y, pick(roof, 0.9 - ((x - (7 - half)) / (half * 2)) * 0.8 + (y === 7 ? -0.3 : 0), x, y));
  }
  return deco(p, 7, foot, 5, 8, { shadow: [5, 1.5] });
}

/** A farmhouse: plaster walls, a red tile roof, a door, a window and a chimney (smoke rises from 3, 0). */
function houseDeco(): Deco {
  const W = 19;
  const H = 17;
  const p = new Pix(W, H, -1);
  const wall = ramp('#a48c6a', '#d4c09a', '#f4e6c0');
  const roof = ramp('#5a1a1e', '#8e2026', '#c43a30', '#e85a44', '#f6845e');
  const wood = ramp('#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e');
  const foot = H - 2;
  // walls (front face) and the end wall in shade
  for (let y = foot - 6; y <= foot; y++) for (let x = 2; x <= 16; x++) p.set(x, y, x >= 14 ? wall[0] : y === foot - 6 ? wall[1] : wall[2]);
  // beams
  for (let x = 2; x <= 13; x++) p.set(x, foot - 6, wood[2]);
  for (const x of [2, 8, 13]) for (let y = foot - 6; y <= foot; y++) p.set(x, y, wood[2]);
  // roof: a slab sloping back, lit from the left, a light ridge
  for (let y = 2; y <= foot - 7; y++) {
    const inset = Math.max(0, 2 - (y - 2));
    for (let x = 1 + inset; x <= 17; x++) {
      const v = 0.75 - (y - 2) * 0.08 - (x > 14 ? 0.35 : 0) + ((x + y) % 3 === 0 ? -0.12 : 0);
      p.set(x, y, pick(roof, y === 2 ? 0.95 : v, x, y));
    }
  }
  // chimney
  for (let y = 0; y <= 3; y++) {
    p.set(3, y, col('#78747c'));
    p.set(4, y, col('#545264'));
  }
  // door and window
  for (let y = foot - 3; y <= foot; y++) for (let x = 10; x <= 11; x++) p.set(x, y, x === 10 ? wood[3] : wood[1]);
  for (let y = foot - 4; y <= foot - 3; y++)
    for (let x = 4; x <= 6; x++) p.set(x, y, x === 5 ? wood[2] : col('#ffe680'));
  return deco(p, 9, foot, 8, 7, { shadow: [9, 2] });
}

/** A small fenced field of crops in rows. */
function fieldDeco(): Deco {
  const W = 20;
  const H = 11;
  const p = new Pix(W, H, -1);
  const soil = ramp('#4a2c18', '#6e4426', '#8a5a34');
  const crop = ramp('#3e7a38', '#62a040', '#9ac850', '#e8d060');
  const foot = H - 2;
  for (let y = 2; y <= foot - 1; y++)
    for (let x = 1; x <= W - 2; x++) {
      const row = (y - 2) % 2 === 0;
      p.set(x, y, row ? pick(crop, 0.4 + hash(x, y, 9) * 0.6, x, y) : soil[(x + y) % 3 === 0 ? 0 : 1]);
    }
  // fence: rails along the front and sides, posts every 3 px
  for (let x = 0; x <= W - 1; x++) {
    p.set(x, foot, col('#8e5a2e'));
    if (x % 3 === 0) {
      p.set(x, foot - 1, col('#b07a44'));
      p.set(x, foot, col('#6e4020'));
    }
  }
  for (let y = 1; y <= foot; y++) {
    p.set(0, y, y % 3 === 0 ? col('#b07a44') : col('#8e5a2e'));
    p.set(W - 1, y, y % 3 === 0 ? col('#b07a44') : col('#6e4020'));
  }
  return deco(p, W >> 1, foot, 9, 4);
}

const STONE_R = ramp('#2a2a3e', '#3e4054', '#585a6c', '#767888', '#9a9aa6', '#c0bcbc');
const RMOSS = ramp('#1c3e32', '#28543c', '#3a7046', '#58904e', '#86b05c');
const NIGHT_LEAF = ramp('#0c1820', '#13242c', '#1d3438', '#2a4a48', '#3e6460', '#5a8474');
const DEAD_BARK = ramp('#14161e', '#20222c', '#2e3038', '#40424a', '#585a60');
const RTUFT = ramp('#14281f', '#1e3a2c', '#2e5238', '#45704a');

/** A standing column, broken off at `h` px; fluted, on a plinth, moss on its stump. */
function columnDeco(seed: number, h: number): Deco {
  const W = 9;
  const H = h + 5;
  const p = new Pix(W, H, -1);
  const foot = H - 2;
  for (let y = foot - h + 1; y <= foot - 2; y++)
    for (let x = 2; x <= 6; x++) {
      const v = [0.85, 0.7, 0.55, 0.38, 0.22][x - 2] + ((x === 3 || x === 5) && y % 4 !== 0 ? -0.08 : 0);
      p.set(x, y, pick(STONE_R, v, x, y));
    }
  // a jagged break and its moss
  const top = foot - h + 1;
  for (let x = 2; x <= 6; x++) {
    const cut = Math.floor(hash(x, seed, 5) * 2.2);
    for (let y = top; y < top + cut; y++) p.set(x, y, -1);
    p.set(x, top + cut, hash(x, seed, 6) > 0.4 ? RMOSS[3 - Math.min(2, Math.abs(x - 3))] : STONE_R[5]);
  }
  for (let x = 1; x <= 7; x++) {
    p.set(x, foot - 1, pick(STONE_R, 0.9 - (x - 1) * 0.11, x, foot));
    p.set(x, foot, pick(STONE_R, 0.5 - (x - 1) * 0.06, x, foot));
  }
  return deco(p, 4, foot, 3, h * 0.5, { shadow: [4, 1.2] });
}

function fallenColumn(seed: number, len: number): Deco {
  const W = len + 4;
  const H = 8;
  const p = new Pix(W, H, -1);
  const foot = H - 2;
  for (let y = foot - 3; y <= foot; y++)
    for (let x = 2; x < W - 2; x++) {
      const v = [0.9, 0.7, 0.5, 0.3][y - (foot - 3)] + (x % 3 === 0 ? -0.06 : 0) + (noise(x * 0.5, y, seed) - 0.5) * 0.15;
      p.set(x, y, pick(STONE_R, v, x, y));
    }
  // the broken end: a round face
  for (let y = foot - 3; y <= foot; y++) p.set(W - 2, y, STONE_R[y === foot - 3 ? 4 : 3]);
  p.set(4, foot - 3, RMOSS[3]);
  p.set(5, foot - 3, RMOSS[2]);
  return deco(p, W >> 1, foot, len * 0.4, 2, { shadow: [len * 0.5, 1] });
}

/** A run of crumbling wall: a lit top course with moss, a brick face in shade, ragged broken ends. */
function wallDeco(seed: number, len: number): Deco {
  const W = len + 4;
  const H = 11;
  const p = new Pix(W, H, -1);
  const foot = H - 2;
  for (let x = 2; x < W - 2; x++) {
    const end = Math.min(x - 2, W - 3 - x);
    const hgt = Math.min(6, 2 + end * 2 + Math.floor(hash(x, seed, 2) * 2));
    for (let k = 0; k < hgt; k++) {
      const y = foot - k;
      const course = Math.floor(k / 2);
      const joint = (x + course * 2) % 4 === 0 || k % 2 === 1;
      p.set(x, y, k === hgt - 1 ? STONE_R[4] : pick(STONE_R, (joint ? 0.25 : 0.5) + (noise(x * 0.6, y * 0.6, seed) - 0.5) * 0.2, x, y));
    }
    p.set(x, foot - hgt, hash(x, seed, 4) > 0.5 ? RMOSS[3] : STONE_R[5]);
    if (hash(x, seed, 7) > 0.75) p.set(x, foot - hgt - 1, RMOSS[2]);
  }
  return deco(p, W >> 1, foot, len * 0.38, 3, { shadow: [len * 0.45, 1] });
}

/** A lone standing arch. */
function archDeco(seed: number): Deco {
  const W = 20;
  const H = 19;
  const p = new Pix(W, H, -1);
  const foot = H - 2;
  const cx = 10;
  for (let y = 1; y <= foot; y++)
    for (let x = 2; x <= 17; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - 8;
      const outer = y >= 8 ? Math.abs(dx) <= 8 : dx * dx + dy * dy <= 64;
      const inner = y >= 8 ? Math.abs(dx) <= 4 : dx * dx + dy * dy <= 20;
      if (!outer || inner) continue;
      // the top right of the arch has fallen
      if (x > 13 && y < 7) continue;
      const u = (x - 2) / 15;
      const joint = (y % 4 === 0 && (x < 6 || x > 13)) || (y < 8 && Math.abs(Math.atan2(dy, dx) * 3) % 1 < 0.15);
      p.set(x, y, pick(STONE_R, 0.8 - u * 0.45 - (joint ? 0.25 : 0) + (noise(x * 0.5, y * 0.5, seed) - 0.5) * 0.2, x, y));
      if (!p.get(x, y - 1) || p.get(x, y - 1) < 0) if (hash(x, y, seed) > 0.4) p.set(x, y, RMOSS[3]);
    }
  return deco(p, cx, foot, 8, 8, { shadow: [9, 1.5] });
}

function brazierDeco(): Deco {
  const p = new Pix(9, 9, -1);
  stampPix(p, ['ywwwwwy', '.ksssk.', '..kmk..', '..m.m..', '.m...m.'], P({ y: '#ff9040', w: '#4a3a34', k: '#2a2224', s: '#6e5a4a', m: '#4a3a34' }), 1, 2);
  return deco(p, 4, 6, 3, 2, { shadow: [3, 1] });
}

function deadTree(seed: number, hgt: number): Deco {
  const W = 17;
  const H = hgt + 4;
  const p = new Pix(W, H, -1);
  const r = rng(seed);
  const foot = H - 2;
  const limb = (bx: number, by: number, ang: number, len: number, t: number, d: number) => {
    for (let i = 0; i < len; i++) {
      bx += Math.sin(ang);
      by -= Math.cos(ang);
      ang += (r() - 0.5) * 0.5;
      for (let k = 0; k < t; k++) p.set(Math.round(bx - t / 2 + k), Math.round(by), DEAD_BARK[k === 0 ? 3 : t > 1 && k === t - 1 ? 1 : 2]);
    }
    if (d > 0) {
      limb(bx, by, ang - 0.5 - r() * 0.4, len * 0.6, Math.max(1, t - 1), d - 1);
      limb(bx, by, ang + 0.45 + r() * 0.4, len * 0.55, Math.max(1, t - 1), d - 1);
    }
  };
  limb(8, foot + 1, (r() - 0.5) * 0.3, hgt * 0.45, 2, 2);
  return deco(p, 8, foot, 3, hgt * 0.5, { sway: false, shadow: [3, 1] });
}

function rubble(seed: number): Deco {
  const p = new Pix(9, 6, -1);
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(r() * 5);
    const y = 2 + Math.floor(r() * 2);
    p.set(x, y, STONE_R[4]);
    p.set(x + 1, y, STONE_R[3]);
    p.set(x, y + 1, STONE_R[2]);
    p.set(x + 1, y + 1, STONE_R[1]);
  }
  return deco(p, 4, 4, 2, 1);
}

function ruinsKit(): Kit {
  const big: Deco[] = [];
  for (let i = 0; i < 4; i++) big.push(broadTree(700 + i, 4.5 + (i % 2) * 1.5, 4 + (i % 2), NIGHT_LEAF, DEAD_BARK));
  big.push(deadTree(711, 14), deadTree(712, 12));
  const mid: Deco[] = [columnDeco(721, 11), columnDeco(722, 7), columnDeco(723, 13), columnDeco(724, 5), fallenColumn(731, 10), wallDeco(741, 14), wallDeco(742, 20), wallDeco(743, 9), bush(751, 3.2, ramp('#0e2020', '#163028', '#204432', '#2e5a3c', '#40744a'))];
  const small: Deco[] = [rubble(761), rubble(762), rubble(763)];
  for (let i = 0; i < 4; i++) small.push(tuftDeco(770 + i, 2 + (i % 2), RTUFT));
  small.push(flowers(781, [col('#c8b4ff'), col('#e0f6ff')], RTUFT[1]));
  return { big, mid, small, extra: { arch: [archDeco(791)], brazier: [brazierDeco()], sign: [signDeco()] } };
}

const AUTUMN = ramp('#2c1024', '#4a1a2c', '#741e2e', '#a0302e', '#c84e30', '#e67a36', '#f8aa46');
const AUTUMN_GOLD = ramp('#3a1a1c', '#6a2a22', '#9a4224', '#c8642a', '#e8902e', '#f8c048', '#fff07a');
const HBARK = ramp('#1a0e1c', '#281424', '#3a1c2a', '#4e262e', '#663232');
const BRUSH = ramp('#2a1226', '#3e1a2c', '#5a2430', '#7a3232', '#9a4636', '#b85e3c');
const HTUFT = ramp('#4a2a1a', '#7a4a24', '#a8722e', '#d4a048');
const HSTONE = ramp('#2e1a24', '#4a2a2c', '#6e4440', '#946656', '#b88a70');
const HMOSS = ramp('#4a1e1e', '#6a2c24', '#8e4028');

function toadstools(seed: number): Deco {
  const p = new Pix(10, 7, -1);
  const r = rng(seed);
  const cap = [col('#8a1a22'), col('#c8302c'), col('#ee5a3a')];
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const x = 2 + i * 3 + Math.floor(r() * 2);
    const big = i === 0;
    const y = 5;
    p.set(x, y, col('#e6d4bc'));
    if (big) p.set(x, y - 1, col('#e6d4bc'));
    const top = y - (big ? 2 : 1);
    p.set(x - 1, top, cap[1]);
    p.set(x, top, cap[2]);
    p.set(x + 1, top, cap[0]);
    if (big) {
      p.set(x, top - 1, cap[1]);
      p.set(x, top, col('#fff4e0'));
    }
  }
  return deco(p, 5, 5, 3, 1);
}

function leafPile(seed: number): Deco {
  const p = new Pix(11, 6, -1);
  mass(p, [{ x: 5.5, y: 4, rx: 4, ry: 2 }], { ramp: ramp('#5a1e24', '#8e3024', '#c0522a', '#e0822e', '#f4b040'), seed, bump: 0.25, tex: 0.5, vgrad: 0.4 });
  return deco(p, 5, 4, 3, 1);
}

function hollowKit(): Kit {
  const big: Deco[] = [];
  for (let i = 0; i < 6; i++) big.push(broadTree(800 + i, 4 + (i % 3) * 1.4, 3.6 + (i % 3) * 1.1, i % 2 ? AUTUMN : AUTUMN_GOLD, HBARK));
  big.push(deadTree(811, 15), deadTree(812, 11));
  const mid: Deco[] = [bush(821, 3.2, BRUSH), bush(822, 3.8, BRUSH, [col('#f4b040')]), boulder(831, 3, 2.6, HSTONE, HMOSS, col('#2a1018')), boulder(832, 2.6, 2.4, HSTONE, HSTONE, col('#2a1018')), toadstools(841), toadstools(842), leafPile(851)];
  const small: Deco[] = [];
  for (let i = 0; i < 4; i++) small.push(tuftDeco(860 + i, 2 + (i % 3), HTUFT));
  small.push(toadstools(871), leafPile(872));
  return { big, mid, small, extra: { sign: [signDeco()] } };
}

function kit(theme: Theme): Kit {
  return (kits[theme] ??= theme === 'forest' ? forestKit() : theme === 'ruins' ? ruinsKit() : hollowKit());
}

// ------------------------------------------------------------------ ground and roads per theme

const MEADOW = ramp('#2a6234', '#376f37', '#468239', '#58973e', '#6eab45', '#89bd4d', '#a8cc58');
const DIRT = ramp('#5a3820', '#6e4426', '#865834', '#9c6b42', '#b07f52', '#c19462', '#d2ab78');
const WATER = ramp('#1e4a7a', '#2a62a0', '#3a80bc', '#5aa2d4', '#8ccce6', '#d4f0f6');
const RGRASS = ramp('#1a3028', '#203a30', '#284638', '#325440', '#3e6448', '#4e7650');
const PAVE = ramp('#26283a', '#34364a', '#44465a', '#56586a', '#6a6c7c', '#828290');
const COBBLE = ramp('#34364a', '#54566a', '#727486', '#9294a2', '#b2b0b6', '#d2ccc4');
const FLOOR = ramp('#2e141e', '#3e1c24', '#4e242a', '#622e2e', '#7a3c32', '#924c36');
const LEAVES_R = ramp('#8e3024', '#c0522a', '#e0822e', '#f4b040');
const EARTH = ramp('#4a2a24', '#64382c', '#7e4a36', '#9a6042', '#b47a52', '#cc9664');

/** Light from the top left: 0 in the far bottom right corner, 1 in the top left. */
const sun = (c: Ctx, x: number, y: number) => 1 - (x / c.W) * 0.55 - (y / c.H) * 0.45;

function groundForest(p: Pix, c: Ctx): void {
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const v = 0.44 + (fbm(x * 0.045, y * 0.07, c.seed) - 0.5) * 1.15 + (sun(c, x, y) - 0.5) * 0.3;
      let col = pick(MEADOW, v, x, y, 0.3);
      // blades: short strokes a tone off
      const h = hash(x, y, c.seed + 1);
      if (h < 0.06) col = pick(MEADOW, v + 0.2, x, y);
      else if (h > 0.93) col = pick(MEADOW, v - 0.2, x, y);
      p.set(x, y, col);
      if (h < 0.06) p.set(x, y + 1, pick(MEADOW, v + 0.06, x, y));
    }
  // patches of wildflowers
  for (let y = 0; y < c.H - 1; y++)
    for (let x = 0; x < c.W; x++) {
      const f = fbm(x * 0.07 + 3, y * 0.09, c.seed + 11);
      if (f < 0.62 || hash(x, y, c.seed + 12) > (f - 0.62) * 1.1) continue;
      p.set(x, y, PETALS[Math.floor(fbm(x * 0.03, y * 0.03, c.seed + 13) * 7) % PETALS.length]);
      p.set(x, y + 1, MEADOW[1]);
    }
}

function groundRuins(p: Pix, c: Ctx): void {
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const v = 0.5 + (fbm(x * 0.05, y * 0.07, c.seed) - 0.5) * 0.8 + (sun(c, x, y) - 0.5) * 0.2;
      let k = pick(RGRASS, v, x, y, 0.3);
      // old paving under the moss
      const pave = fbm(x * 0.03 + 7, y * 0.05, c.seed + 5);
      if (pave > 0.52) {
        const row = Math.floor((y + Math.floor(hash(0, Math.floor(y / 4), c.seed) * 3)) / 4);
        const off = (row % 2) * 3;
        const tx = Math.floor((x + off) / 6);
        const edgeX = (x + off) % 6 === 0;
        const edgeY = (y + Math.floor(hash(0, Math.floor(y / 4), c.seed) * 3)) % 4 === 0;
        const tone = 0.3 + hash(tx, row, c.seed + 9) * 0.45 + (sun(c, x, y) - 0.5) * 0.2;
        if (edgeX || edgeY) k = pave > 0.56 && hash(x, y, c.seed) > 0.5 ? RGRASS[2] : PAVE[0];
        else k = pick(PAVE, tone + ((x + off) % 6 === 1 || (y % 4 === 1) ? 0.12 : 0), x, y);
        // moss creeping in at the edges of the paving
        if (pave < 0.56 && hash(x, y, c.seed + 3) > 0.45) k = pick(RGRASS, v + 0.1, x, y);
      }
      if (hash(x, y, c.seed + 1) < 0.04) k = pick(RGRASS, v + 0.2, x, y);
      p.set(x, y, k);
    }
}

function groundHollow(p: Pix, c: Ctx): void {
  for (let y = 0; y < c.H; y++)
    for (let x = 0; x < c.W; x++) {
      const v = 0.42 + (fbm(x * 0.05, y * 0.07, c.seed) - 0.5) * 0.9 + (sun(c, x, y) - 0.5) * 0.35;
      let k = pick(FLOOR, v, x, y, 0.3);
      // drifts of fallen leaves, each leaf a 2x1 fleck, brighter where the low sun reaches
      const drift = fbm(x * 0.07, y * 0.09, c.seed + 4);
      const cell = hash(x >> 1, y, c.seed + 2);
      if ((drift > 0.6 && cell < 0.28) || cell < 0.008) {
        const lit = clamp01(sun(c, x, y) * 1.4 - 0.2 + (drift - 0.58));
        k = mix(LEAVES_R[Math.min(3, Math.floor(hash(x >> 1, y, c.seed + 5) * 2 + lit * 2))], FLOOR[2], 0.35 - lit * 0.2);
      }
      p.set(x, y, k);
    }
}

/** Roads and clearings: the trail is sunk a little, so its top edge sits in the shadow of the verge. */
function paintRoads(p: Pix, c: Ctx, fill: (x: number, y: number, clearing: boolean) => Col, verge: (k: Col) => Col): void {
  const { W, H, road } = c;
  // the verge: worn ground just outside the road
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (road[i] || c.water[i]) continue;
      if (c.dist[i] <= 1.01 && hash(x, y, 31) > 0.25) p.set(x, y, verge(p.get(x, y)));
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!road[i] || c.water[i]) continue;
      p.set(x, y, fill(x, y, road[i] === 2));
    }
}

function roadsForest(p: Pix, c: Ctx): void {
  const R = c.road;
  const W = c.W;
  paintRoads(
    p,
    c,
    (x, y, clr) => {
      const up = y > 0 && !R[(y - 1) * W + x];
      const down = y < c.H - 1 && !R[(y + 1) * W + x];
      let v = (clr ? 0.66 : 0.6) + (noise(x * 0.4, y * 0.4, 5) - 0.5) * 0.3;
      if (up) v -= 0.32;
      else if (down) v += 0.16;
      if (hash(x, y, 77) > 0.96) v += 0.3; // pebbles
      // grass creeping over the edge of a clearing
      if (clr && c.dist[y * W + x] === 0 && distToEdge(c, x, y) < 1.5 && hash(x, y, 8) > 0.55) return pick(MEADOW, 0.45, x, y);
      return pick(DIRT, v, x, y, 0.2);
    },
    (k) => mix(k, col('#3a5a28'), 0.3),
  );
}

function roadsRuins(p: Pix, c: Ctx): void {
  const R = c.road;
  const W = c.W;
  const pads = c.spec.pads;
  paintRoads(
    p,
    c,
    (x, y, clr) => {
      const up = y > 0 && !R[(y - 1) * W + x];
      if (clr) {
        // round flagstone platforms: rings of slabs around the centre
        const pd = pads.reduce((b, q) => (Math.hypot(q.x - x, (q.y + 2 - y) * 1.6) < Math.hypot(b.x - x, (b.y + 2 - y) * 1.6) ? q : b), pads[0]);
        const d = Math.hypot(x + 0.5 - pd.x, (y + 0.5 - pd.y - 2) * 1.6);
        const ring = Math.floor(d / 3.2);
        const a = Math.atan2(y + 0.5 - pd.y - 2, x + 0.5 - pd.x);
        const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * (4 + ring * 4));
        const joint = d % 3.2 < 0.9 || ((((a + Math.PI) / (Math.PI * 2)) * (4 + ring * 4)) % 1) < 0.12;
        if (joint) return COBBLE[1];
        return pick(COBBLE, 0.45 + hash(ring, seg, 13) * 0.35 - (up ? 0.25 : 0) + (sun(c, x, y) - 0.5) * 0.2, x, y);
      }
      // cobbles: offset rows of small stones with dark joints
      const row = Math.floor(y / 2);
      const off = (row % 2) * 2;
      const cell = Math.floor((x + off) / 3);
      if ((x + off) % 3 === 0 || y % 2 === 0) return up ? COBBLE[0] : COBBLE[1];
      return pick(COBBLE, 0.45 + hash(cell, row, 21) * 0.4 - (up ? 0.25 : 0) + (sun(c, x, y) - 0.5) * 0.2, x, y);
    },
    (k) => mix(k, col('#141c20'), 0.3),
  );
}

function roadsHollow(p: Pix, c: Ctx): void {
  const R = c.road;
  const W = c.W;
  paintRoads(
    p,
    c,
    (x, y, clr) => {
      const up = y > 0 && !R[(y - 1) * W + x];
      const down = y < c.H - 1 && !R[(y + 1) * W + x];
      let v = (clr ? 0.62 : 0.56) + (noise(x * 0.4, y * 0.4, 6) - 0.5) * 0.3 + (sun(c, x, y) - 0.5) * 0.25;
      if (up) v -= 0.3;
      else if (down) v += 0.14;
      const h = hash(x, y, 91);
      if (h > 0.93) return LEAVES_R[Math.floor(hash(x, y, 92) * 4)];
      if (clr && distToEdge(c, x, y) < 1.5 && h > 0.5) return LEAVES_R[1 + Math.floor(hash(x, y, 93) * 3)];
      return pick(EARTH, v, x, y, 0.2);
    },
    (k) => mix(k, col('#1e0c14'), 0.3),
  );
}

/** Px from a road/clearing pixel to the nearest pixel outside it (small values only). */
function distToEdge(c: Ctx, x: number, y: number): number {
  for (let r = 1; r <= 2; r++)
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const xx = x + i;
        const yy = y + j;
        if (xx < 0 || yy < 0 || xx >= c.W || yy >= c.H) continue;
        if (!c.road[yy * c.W + xx]) return Math.hypot(i, j);
      }
  return 3;
}

// ------------------------------------------------------------------ the forest stream

function stream(p: Pix, c: Ctx): void {
  const cols = c.spec.cols;
  if (cols.length < 4) return;
  const ph0 = hash(c.seed, 1, 1) * 6;
  const course = (x0: number, amp: number, ph: number) => (y: number) => x0 + Math.sin(y * 0.055 + ph) * amp + Math.sin(y * 0.17 + ph * 2) * 1.2;
  // run it where the roads cross it most squarely (the shortest bridges), near the middle of the map
  const mid = Math.floor(cols.length / 2) - 1;
  let cx = course((cols[mid] + cols[mid + 1]) / 2, 2, ph0);
  let best = 1e9;
  for (let k = 1; k < cols.length - 2; k++)
    for (let off = -6; off <= 6; off += 2)
      for (const amp of [1, 2.5, 4])
        for (const dph of [0, 1.6, 3.2, 4.8]) {
          const f = course((cols[k] + cols[k + 1]) / 2 + off, amp, ph0 + dph);
          // keep well clear of the clearings
          if (c.spec.pads.some((q) => Math.abs(q.x - f(q.y + 2)) < q.r + 6)) continue;
          let worst = 0;
          const wet: Pt[] = [];
          for (const t of c.spec.trails) {
            let n = 0;
            let sx = 0;
            let sy = 0;
            for (const [x, y] of t)
              if (Math.abs(x - f(y)) <= 4) {
                n++;
                sx += x;
                sy += y;
              }
            worst = Math.max(worst, n);
            if (n) wet.push([sx / n, sy / n]);
          }
          // two bridges on top of each other read as a tangle
          let crowd = 0;
          for (let i = 0; i < wet.length; i++) for (let j = i + 1; j < wet.length; j++) if (Math.hypot(wet[i][0] - wet[j][0], wet[i][1] - wet[j][1]) < 15) crowd += 6;
          const score = worst + crowd + Math.abs(k - mid) * 1.5 + Math.abs(off) * 0.15 - amp * 0.3;
          if (score < best) (best = score), (cx = f);
        }
  const { W, H } = c;
  for (let y = 0; y < H; y++) {
    const m = cx(y);
    c.land.water.push([m, y]);
    for (let x = Math.floor(m - 5); x <= m + 5; x++) {
      if (x < 0 || x >= W) continue;
      const d = Math.abs(x + 0.5 - m);
      if (d <= 2.6) c.water[y * W + x] = 1;
      else if (d <= 3.6) c.water[y * W + x] = 2;
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const w = c.water[y * W + x];
      if (!w) continue;
      const m = cx(y);
      const d = (x + 0.5 - m) / 2.6;
      if (w === 2) {
        // muddy banks with a stone here and there, darker on the shaded (right) side
        p.set(x, y, hash(x, y, 4) > 0.8 ? ROCK_R[d < 0 ? 2 : 1] : DIRT[d < 0 ? 2 : 1]);
        continue;
      }
      let v = 0.55 - Math.abs(d) * 0.1 + (d < -0.6 ? -0.25 : d > 0.6 ? 0.1 : 0);
      // ripples: short light dashes across the current
      if (noise(x * 0.5, y * 0.35, 12) > 0.68) v += 0.3;
      p.set(x, y, pick(WATER, v, x, y, 0.2));
    }
}

/** Plank bridges where the roads cross the stream: planks across the road, rails along its edges. */
function bridges(p: Pix, c: Ctx): void {
  const plank = ramp('#4e2c16', '#6e4020', '#8e5a2e', '#b07a44', '#d09a5e');
  for (const t of c.spec.trails) {
    const wet = t.map(([x, y]) => c.water[at(c, x, y)] > 0);
    const i0 = wet.indexOf(true);
    if (i0 < 0) continue;
    const i1 = wet.lastIndexOf(true);
    const a = Math.max(1, i0 - 2);
    const b = Math.min(t.length - 2, i1 + 2);
    const done = new Set<number>();
    for (let i = a; i <= b; i++) {
      const [x, y] = t[i];
      const dx = t[i + 1][0] - t[i - 1][0];
      const dy = t[i + 1][1] - t[i - 1][1];
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      const tone = ((i - a) >> 1) % 2 === 0 ? 3 : 2;
      for (let k = -2.5; k <= 2.5; k += 0.5) {
        const px = Math.round(x + nx * k);
        const py = Math.round(y + ny * k);
        const key = py * 4096 + px;
        const rail = Math.abs(k) >= 2;
        if (done.has(key) && !rail) continue;
        done.add(key);
        p.set(px, py, rail ? plank[k < 0 ? 1 : 0] : k < -1 ? plank[tone + 1] : plank[tone]);
      }
      // the deck's shadow on the water
      const sx = Math.round(x + nx * 3.5);
      const sy = Math.round(y + ny * 3.5);
      if (c.water[at(c, sx, sy)] === 1 && !done.has(sy * 4096 + sx)) p.set(sx, sy, WATER[0]);
    }
    // posts at the four corners
    for (const i of [a, b]) {
      const [x, y] = t[i];
      const dx = t[i + 1][0] - t[i - 1][0];
      const dy = t[i + 1][1] - t[i - 1][1];
      const l = Math.hypot(dx, dy) || 1;
      for (const k of [-3, 3]) {
        const px = Math.round(x - (dy / l) * k);
        const py = Math.round(y + (dx / l) * k);
        p.set(px, py, plank[4]);
        p.set(px, py + 1, plank[1]);
        p.set(px, py - 1, INK);
      }
    }
  }
}

// ------------------------------------------------------------------ scattering the scenery

type Odds = (x: number, y: number) => number;

function scatter(c: Ctx, k: Kit, o: { big: Odds; mid: Odds; small: Odds; step: number }): void {
  const r = rng(c.seed + 17);
  const pickOf = (list: Deco[]) => list[Math.floor(r() * list.length)];
  // trees first (they make the clumps), then bushes and stones, then the small stuff
  const layers: Array<[Deco[], Odds, number]> = [
    [k.big, o.big, o.step],
    [k.mid, o.mid, o.step],
    [k.small, o.small, 4],
  ];
  for (const [list, odds, step] of layers)
    for (let y = 2; y < c.H + 4; y += step)
      for (let x = 0; x < c.W + 2; x += step) {
        const jx = x + (r() - 0.5) * step;
        const jy = y + (r() - 0.5) * step;
        if (r() > odds(jx, jy)) continue;
        const d = pickOf(list);
        if (fits(c, d, jx, jy)) put(c, d, jx, jy);
      }
}

/** How close (0..1) a spot is to the edge of the screen (the woods thicken there). */
const edgy = (c: Ctx, x: number, y: number) => clamp01(1 - Math.min(y / 18, (c.H - y) / 14, x / 14, (c.W - x) / 14));

function decorForest(c: Ctx): void {
  const k = kit('forest');
  const { extra } = k;
  // the farm and the windmill in the roomiest spots
  const house = extra.house[0];
  const hs = roomFor(c, 26, 18, 3);
  if (hs) {
    claim(c, house, hs[0] - 4, hs[1] - 1);
    c.land.smoke.push([hs[0] - 4 - house.fx + 3, hs[1] - 1 - house.fy]);
    const field = extra.field[0];
    if (fits(c, field, hs[0] + 9, hs[1] + 3, 0.5)) claim(c, field, hs[0] + 9, hs[1] + 3);
  }
  const ms = roomFor(c, 18, 26, 3);
  if (ms) {
    const mill = extra.mill[0];
    claim(c, mill, ms[0], ms[1]);
    c.land.mills.push([ms[0], ms[1] - mill.fy + 5]);
  }
  // reeds along the stream banks
  const r = rng(c.seed + 5);
  for (const [x, y] of c.land.water)
    if (r() < 0.12) {
      const side = r() < 0.5 ? -4 : 4;
      const d = pickOf(extra.reed, r);
      const xx = Math.round(x + side);
      if (!c.road[at(c, xx, y)] && distAt(c, xx, y + 3) > 0) c.items.push({ x: xx, y: Math.round(y) + 2, d, ph: Math.floor(r() * 4) });
    }
  const clump = (x: number, y: number) => fbm(x * 0.035, y * 0.05, c.seed + 9) > 0.6;
  scatter(c, k, {
    big: (x, y) => Math.max(edgy(c, x, y) * 0.95, clump(x, y) ? 0.8 : 0.1),
    mid: (x, y) => (clump(x, y) ? 0.55 : 0.32),
    small: () => 0.55,
    step: 7,
  });
}

function decorRuins(c: Ctx): void {
  const k = kit('ruins');
  const { extra } = k;
  for (let i = 0; i < 2; i++) {
    const s = roomFor(c, 22, 20, 3);
    if (s) claim(c, extra.arch[0], s[0], s[1]);
  }
  // braziers beside some of the clearings
  const br = extra.brazier[0];
  c.spec.pads.forEach((pd, i) => {
    if (pd.start || hash(i, 3, c.seed) < 0.45) return;
    for (const side of hash(i, 4, c.seed) < 0.5 ? [-1, 1] : [1, -1]) {
      const x = pd.x + side * (pd.r + 4);
      const y = pd.y - 1;
      if (distAt(c, x, y) >= 1 && distAt(c, x, y - 3) >= 1 && !c.items.some((it) => Math.hypot(it.x - x, it.y - y) < 6)) {
        reserve(c, x - 3, y - 6, 7, 7);
        put(c, br, x, y);
        c.land.flames.push([Math.round(x), Math.round(y) - 4]);
        break;
      }
    }
  });
  c.dist = distField(c.block, c.W, c.H);
  const clump = (x: number, y: number) => fbm(x * 0.04, y * 0.05, c.seed + 9) > 0.56;
  scatter(c, k, {
    big: (x, y) => Math.max(edgy(c, x, y) * 0.7, clump(x, y) ? 0.4 : 0.06),
    mid: (x, y) => (clump(x, y) ? 0.6 : 0.3),
    small: () => 0.4,
    step: 7,
  });
}

function decorHollow(c: Ctx): void {
  const k = kit('hollow');
  const clump = (x: number, y: number) => fbm(x * 0.04, y * 0.05, c.seed + 9) > 0.52;
  scatter(c, k, {
    big: (x, y) => Math.max(edgy(c, x, y), clump(x, y) ? 0.8 : 0.16),
    mid: (x, y) => (clump(x, y) ? 0.5 : 0.42),
    small: () => 0.4,
    step: 6,
  });
}

const pickOf = <T,>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)];

// ------------------------------------------------------------------ light

/** The theme's light over the finished frame: a soft vignette, dusk blue for the ruins, the sunset for the hollow. */
function lightFrame(p: Pix, c: Ctx, theme: Theme): void {
  const { W, H } = c;
  const edge = theme === 'forest' ? col('#14321e') : theme === 'ruins' ? col('#0a1020') : col('#1a0818');
  const warm = col('#ffb060');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const e = clamp01(1 - Math.min(x / 16, (W - 1 - x) / 16, y / 12, (H - 1 - y) / 12));
      let k = p.get(x, y);
      const amt = theme === 'forest' ? 0.35 : 0.5;
      if (e > 0 && e * e > bay(x, y) * 0.9) k = mix(k, edge, e * amt);
      if (theme === 'hollow') {
        const s = sun(c, x, y);
        if (s > 0.62 && (s - 0.62) * 3 > bay(x, y)) k = lighten(k, warm, 0.08);
        if (s < 0.4 && (0.4 - s) * 3 > bay(x, y)) k = mix(k, col('#2a1030'), 0.18);
      }
      if (theme === 'ruins') k = mix(k, col('#1a2a50'), 0.06);
      p.set(x, y, k);
    }
}

/** Foreground foliage framing the screen: dark leaf masses overhanging the top and bottom edges and corners. */
function frameEdges(p: Pix, c: Ctx, theme: Theme): void {
  const { W, H } = c;
  const leaf =
    theme === 'forest'
      ? ramp('#0a1a14', '#10261a', '#183420', '#224628', '#2e5a30')
      : theme === 'ruins'
        ? ramp('#04080c', '#081016', '#0e1a20', '#16262a', '#203634')
        : ramp('#12060e', '#200a14', '#34101a', '#4e1a1e', '#6e2a22');
  const r = rng(c.seed + 41);
  const blobs: Blob[] = [];
  // along the bottom edge: low clumps poking up; along the top: hanging canopy; heavier in the corners
  for (let x = -6; x < W + 6; x += 7 + r() * 6) {
    const corner = Math.max(0, 1 - Math.min(x, W - x) / 60);
    const hb = 2.5 + r() * 3 + corner * 6;
    blobs.push({ x, y: H + 1 - hb * 0.3, rx: 4 + r() * 3 + corner * 3, ry: hb });
    const ht = 1.5 + r() * 2.5 + corner * 7;
    if (r() < 0.55 + corner) blobs.push({ x: x + 3, y: -1 + ht * 0.2, rx: 4 + r() * 3 + corner * 3, ry: ht });
  }
  // the sides (mostly behind the iPhone's rounded corners and the island)
  for (let y = 0; y < H; y += 9 + r() * 6) {
    const k = Math.max(0, 1 - Math.min(y, H - y) / 40);
    blobs.push({ x: -2, y, rx: 3 + r() * 2 + k * 4, ry: 4 + r() * 2 });
    blobs.push({ x: W + 1, y: y + 4, rx: 3 + r() * 2 + k * 4, ry: 4 + r() * 2 });
  }
  // keep the clearings, roads and their glow readable: no clump reaches a road
  const ok = blobs.filter((b) => {
    const cx = Math.max(0, Math.min(W - 1, b.x));
    const cy = Math.max(0, Math.min(H - 1, b.y));
    return c.dist[at(c, cx, cy)] > Math.max(b.rx, b.ry) + 2;
  });
  mass(p, ok, { ramp: leaf, seed: c.seed + 3, bump: 0.22, tex: 0.3, vgrad: 0.2, light: -0.05, shadow: 0.3, outline: INK });
}

// ------------------------------------------------------------------ paint

export function paintLand(spec: LandSpec): Land {
  const W = spec.w;
  const H = spec.h;
  const land: Land = { frames: [], flames: [], smoke: [], mills: [], water: [], spots: [], ground: new Uint8Array(W * H) };
  const road = new Uint8Array(W * H);
  const mark = (x: number, y: number, v: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H && road[y * W + x] !== 2) road[y * W + x] = v;
  };
  // roads: 3 px wide
  for (const t of spec.trails)
    for (const [x, y] of t)
      for (let j = -2; j <= 2; j++)
        for (let i = -2; i <= 2; i++) if ((Math.floor(x) + i + 0.5 - x) ** 2 + (Math.floor(y) + j + 0.5 - y) ** 2 <= 2.4) mark(Math.floor(x) + i, Math.floor(y) + j, 1);
  // clearings: flattened ellipses under each node
  for (const pd of spec.pads) {
    const rx = pd.r;
    const ry = pd.r * 0.6;
    for (let y = Math.floor(pd.y + 2 - ry); y <= pd.y + 2 + ry; y++)
      for (let x = Math.floor(pd.x - rx); x <= pd.x + rx; x++) {
        const d = ((x + 0.5 - pd.x) / rx) ** 2 + ((y + 0.5 - pd.y - 2) / ry) ** 2;
        if (d <= 1 + (noise(x * 0.5, y * 0.5, 3) - 0.5) * 0.3 && x >= 0 && y >= 0 && x < W && y < H) road[y * W + x] = 2;
      }
  }
  const c: Ctx = { W, H, spec, road, water: new Uint8Array(W * H), dist: new Float32Array(0), block: new Uint8Array(W * H), items: [], land, seed: spec.seed };
  const base = new Pix(W, H, 0);
  if (spec.theme === 'forest') {
    groundForest(base, c);
    stream(base, c);
  } else if (spec.theme === 'ruins') groundRuins(base, c);
  else groundHollow(base, c);
  for (let i = 0; i < c.block.length; i++) c.block[i] = road[i] || c.water[i] ? 1 : 0;
  c.dist = distField(c.block, W, H);
  if (spec.theme === 'forest') {
    roadsForest(base, c);
    bridges(base, c);
  } else if (spec.theme === 'ruins') roadsRuins(base, c);
  else roadsHollow(base, c);

  // from here on, the icons, their labels and the lair are off limits too
  for (const z of spec.zones) reserve(c, z.x, z.y, z.w, z.h);
  c.dist = distField(c.block, W, H);
  // a signpost at the start
  const start = spec.pads.find((q) => q.start);
  const sign = kit(spec.theme).extra.sign[0];
  if (start) put(c, sign, start.x - start.r + 1, start.y - 3);
  if (spec.theme === 'forest') decorForest(c);
  else if (spec.theme === 'ruins') decorRuins(c);
  else decorHollow(c);

  // braziers light the stones around them
  for (const [x, y] of land.flames) torchLight(base, x, y + 3, 14, 9, col('#ff9040'), 0.35);
  // cast shadows, then the scenery in depth order
  const shade = spec.theme === 'forest' ? col('#16301e') : spec.theme === 'ruins' ? col('#080c14') : col('#14060e');
  const sx = spec.theme === 'hollow' ? 2 : 1;
  for (const it of c.items) if (it.d.shadow) shadowAt(base, it.x + sx, it.y, it.d.shadow[0], it.d.shadow[1], 0.35, shade);
  c.items.sort((a, b) => a.y - b.y || a.x - b.x);
  for (let f = 0; f < LAND_FRAMES; f++) {
    const p = new Pix(W, H, 0);
    p.buf.set(base.buf);
    for (const it of c.items) {
      const s = it.d.sway ? SWAY[(f + it.ph) % 4] : 0;
      const spr = it.d.spr[s === 0 ? 0 : s > 0 ? 1 : 2];
      blit(p, spr, it.x - it.d.fx, it.y - it.d.fy);
    }
    frameEdges(p, c, spec.theme);
    lightFrame(p, c, spec.theme);
    land.frames.push(p.canvas());
  }
  // what's underfoot, for the critters: open ground, or scenery to hide in
  for (let i = 0; i < W * H; i++) land.ground[i] = road[i] ? 0 : c.water[i] === 1 ? 3 : c.dist[i] >= 2 && !c.water[i] ? 1 : 0;
  for (const it of c.items) {
    const s = it.d.spr[0];
    if (it.d.r >= 2.5)
      for (let j = 0; j < s.h; j++)
        for (let i = 0; i < s.w; i++) {
          const x = it.x - it.d.fx + i;
          const y = it.y - it.d.fy + j;
          if (s.buf[j * s.w + i] >= 0 && x >= 0 && y >= 0 && x < W && y < H) land.ground[y * W + x] = 2;
        }
  }
  // open ground for the critters
  const r = rng(spec.seed + 99);
  for (let i = 0; i < 200 && land.spots.length < 10; i++) {
    const x = 10 + r() * (W - 20);
    const y = 20 + r() * (H - 40);
    if (c.dist[at(c, x, y)] > 3 && !c.water[at(c, x, y)]) land.spots.push([Math.round(x), Math.round(y)]);
  }
  return land;
}

// ------------------------------------------------------------------ textures

export function buildMapArt(add: Add, w: number, h: number): void {
  // Rowan: idle (breathing) and a four-step walk; Pip: wings down / up
  add('mrow_idle0', rowanFrame('stand', 0, false));
  add('mrow_idle1', rowanFrame('stand', 1, false));
  add('mrow_walk0', rowanFrame('a', 0, true));
  add('mrow_walk1', rowanFrame('pass', -1, false));
  add('mrow_walk2', rowanFrame('b', 0, true));
  add('mrow_walk3', rowanFrame('pass', -1, false));
  // Sable: the same frames (same size and feet point as Rowan's)
  add('msab_idle0', sableFrame('stand', 0, false));
  add('msab_idle1', sableFrame('stand', 1, false));
  add('msab_walk0', sableFrame('a', 0, true));
  add('msab_walk1', sableFrame('pass', -1, false));
  add('msab_walk2', sableFrame('b', 0, true));
  add('msab_walk3', sableFrame('pass', -1, false));
  add('mpip_0', pipFrame(false));
  add('mpip_1', pipFrame(true));
  // the enemies' stand-ins
  for (const [name, m] of Object.entries(MINIS))
    m.frames.forEach((rows, i) => {
      const g = grid(Math.max(...rows.map((r) => r.length)) + 2, rows.length + 2);
      stamp(g, rows, m.pal, 1, 1);
      add(`mfoe_${name}_${i}`, toCanvas(g));
    });
  // node props
  add('mn_chest', prop(CHEST));
  add('mn_chest_open', prop(CHEST_OPEN));
  add('mn_logs', prop(LOGS));
  add('mn_embers', prop(EMBERS));
  FLAMES.forEach((f, i) => add(`mn_flame_${i}`, raw(f, PROP_PAL)));
  add('mn_stall', prop(STALL));
  add('mn_q_0', prop(QMARK));
  add('mn_q_1', prop(QMARK_BIG));
  add('mn_flag', prop(FLAG));
  add('mn_skull', prop(SKULL));
  // the bosses' lairs
  for (const theme of ['forest', 'ruins', 'hollow'] as Theme[]) {
    const l = LAIRS[theme]();
    LAIR_SPOTS[theme] = { flames: l.flames, glows: l.glows };
    add(`maplair_${theme}`, l.canvas);
  }
  // critters, sails, cloud shadows and fog
  BUTTERFLY.forEach((f, i) => add(`ma_fly_${i}`, raw(f, FLY_PAL)));
  BIRD.forEach((f, i) => add(`ma_bird_${i}`, raw(f, FLY_PAL)));
  BAT.forEach((f, i) => add(`ma_bat_${i}`, raw(f, FLY_PAL)));
  LEAVES.forEach((f, i) => add(`ma_leaf_${i}`, raw(f, LEAF_PAL)));
  for (let i = 0; i < 3; i++) add(`ma_sails_${i}`, sails((i * Math.PI) / 6));
  add('ma_cloud_0', blobShadow(Math.round(w * 0.3), Math.round(h * 0.28), 5));
  add('ma_cloud_1', blobShadow(Math.round(w * 0.22), Math.round(h * 0.22), 9));
  add('ma_fog', fogBank(Math.round(w * 0.45), 14, 3));
}
