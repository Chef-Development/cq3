// Rowan, the starter (a Blade): a young knight in a round steel helm with a red plume and a visor that glows cyan,
// steel pauldrons over a royal-blue tabard trimmed in gold, a deep-red cape and a plain steel sword. Fight frames
// `hero_${pose}` (his art key is `hero`) on the shared rig (art-rig.ts), so he has the same head size, feet line and
// stance as the other fifteen, every pose they have (cast, down, fin) and a four-frame idle where the plume and the
// cape lag the breath by a frame (docs/art-style.md section 7). His hero card is drawn from ROWAN_CARD (art-sable.ts).
import { put, type Grid, type Pal, type Shade } from './art';
import { sparkle, stampAt, type Dir, type HeroCardSpec, type Item, type Layer, type Rig, type RigPose, type Sprite } from './art-rig';
import { swordMap, SWORD_PAL } from './art-sword';

// ------------------------------------------------------------------ palette

export const ROWAN_STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
export const ROWAN_BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'];
const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const PLUME = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
/** The cape: a deeper red than the plume so the two read apart. */
const CAPE = ['#3e0c1c', '#6a1424', '#8e1e2a', '#b42c34', '#d24840'];
const LEATHER = ['#2a1810', '#4a2c18', '#6e4426', '#98663a'];
/** The visor's glow (the cursor's blue, his signature). */
export const ROWAN_GLOW = ['#1a6ab0', '#4ad8ff', '#e0fcff'];

const PAL: Pal = {
  // the visor and its eyes
  v: '#1c1430', E: ROWAN_GLOW[2], e: ROWAN_GLOW[1], w: ROWAN_GLOW[0],
  // a warm specular dash on the polished helm (top left)
  K: '#fffaf0',
  // gold trim: the brow band, collar, hem, knee cops, the buckle, the chest's star
  G: GOLD[3], g: GOLD[2], Y: GOLD[3], y: GOLD[2], O: GOLD[4], X: GOLD[3],
  // the gorget (dark steel)
  M: ROWAN_STEEL[1],
};
const SHADES: Record<string, Shade> = {
  h: { ramp: ROWAN_STEEL, same: 'gGvEewK', top: [4, 4], left: [4], right: [2], bottom: [1, 2], mid: 3 }, // the helm (polished: brighter than Hollis's)
  m: { ramp: ROWAN_STEEL, same: 'MyY', top: [4, 3], left: [4], right: [1, 2], bottom: [0, 1], mid: 3 }, // plate
  c: { ramp: ROWAN_BLUE, same: 'GOgyY', top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // the tabard
  l: { ramp: LEATHER, same: 'X', top: [3], left: [2], right: [1], bottom: [0], mid: 2 }, // the belt
  o: { ramp: LEATHER, top: [3], left: [3], right: [1], bottom: [0], mid: 2 }, // boots
};

// ------------------------------------------------------------------ body

// A round steel helm, a gold band over the brow, the visor's slit with two glowing eyes, the cheek guard closing
// under it. The plume is a layer (it lags the head).
const HEAD = [
  '.....hhhhhh.....',
  '...hhhhhhhhhh...',
  '..hKKhhhhhhhhh..',
  '.hhhhhhhhhhhhhh.',
  '.hhhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhhhh',
  'hhhhhhgGGGGGGGGg',
  'hhhhhhvvvvvvvvvv',
  'hhhhhhvvEEvvvEEv',
  'hhhhhhhvwevvvwev',
  '.hhhhhhhvvvvvvvh',
  '..hhhhhhhhhhhhh.',
  '....hhhhhhhhh...',
];
const face = (rows: string[], swap: Record<number, string>) => rows.map((r, y) => (swap[y] ? r.slice(0, 16 - swap[y].length) + swap[y] : r));
const HEADS = {
  base: HEAD,
  // a wince: the eyes narrowed to slits
  squint: face(HEAD, { 8: 'vveevvvveev', 9: 'hvvvvvvvvvv' }),
  // knocked out: the glow gone out
  ko: face(HEAD, { 8: 'vvwwvvvwwv', 9: 'hvvvvvvvvv' }),
  // a battle cry: the eyes flare white
  cry: face(HEAD, { 7: 'vvvEvvvvEv', 8: 'vvEEEvvEEE', 9: 'hvveEvvveE' }),
};

// Steel pauldrons with gold rims and a dark gorget over the blue tabard, its gold star on the chest, a leather belt.
const TORSO = [
  '.mmmmm.....mmmm...',
  'mmmmmmmMMMmmmmmm..',
  'mmmmmmmmmmmmmmmmm.',
  'yyyyyYcccccYyyyyy.',
  '.mmmmcccccccmmmm..',
  '..ccccccccOcccc...',
  '..cccccccOGOccc...',
  '..ccccccccOcccc...',
  '..lllllllXXllll...',
  '..ccccccccccccc...',
];

// The tabard's skirt and its gold hem over steel greaves (gold knee cops) and leather boots; 17 wide, the feet
// centred on x = 8.
const LEGS: Record<string, string[]> = {
  stand: [
    '..ccccccccccccc..',
    '..cccccccccccccc.',
    '.Yyyyyyyyyyyyyyy.',
    '...mggm...mggm...',
    '...mmmm...mmmm...',
    '...mmmm...mmmm...',
    '...oooo...oooo...',
    '...oooo...oooo...',
    '..oooooo.oooooo..',
    '..ooooooo.ooooooo',
  ],
  run: [
    '...cccccccccccc..',
    '..cccccccccccccc.',
    '.Yyyyyyyyyyyyyyy.',
    'mmm.......mggm...',
    'mm.........mmmm..',
    'oo..........mmmm.',
    '............oooo.',
    '............oooo.',
    '...........oooooo',
    '...........ooooooo',
  ],
  lunge: [
    '...cccccccccccc..',
    '..ccccccccccccccc',
    '.Yyyyyyyyyyyyyyyy',
    '.mgm.......mggm..',
    'mmm.........mmmm.',
    'mmm.........mmmm.',
    'ooo.........oooo.',
    'ooo.........oooo.',
    'oooo.......oooooo',
    'ooooo......ooooooo',
  ],
  crouch: [
    '..ccccccccccccc..',
    '.Yyyyyyyyyyyyyyyy',
    '.mggm.......mggm.',
    'mmmm........mmmm.',
    'oooo........oooo.',
    'ooooo......oooooo',
    'oooooo.....ooooooo',
  ],
  tuck: [
    '..ccccccccccccc..',
    '.Yyyyyyyyyyyyyyy.',
    '..mmmmmmm.mggmm..',
    '.....mmmmm.mmmm..',
    '.....ooooooooooo.',
    '......ooooo.oooo.',
  ],
  kneel: [
    '..ccccccccccccc..',
    '.Yyyyyyyyyyyyyyyy',
    '..mmmmmm....mggm.',
    'oooommmmm...mmmm.',
    'ooooooooo..oooooo',
    '...........oooooo',
  ],
};

const GAUNTLET = ['RRr', 'Rrq', 'rqq'];
const GAUNTLET_PAL: Pal = { R: ROWAN_STEEL[4], r: ROWAN_STEEL[3], q: ROWAN_STEEL[2] };
const ARM_NEAR: Array<[number, ...string[]]> = [
  [0.75, ROWAN_STEEL[4], ROWAN_STEEL[3], ROWAN_STEEL[2]],
  [1, ROWAN_STEEL[3], ROWAN_STEEL[2], ROWAN_STEEL[1]],
];
const ARM_FAR: Array<[number, ...string[]]> = [[1, ROWAN_STEEL[3], ROWAN_STEEL[2], ROWAN_STEEL[1]]];

export const ROWAN_RIG: Rig = {
  pal: { ...PAL, ...GAUNTLET_PAL },
  shades: SHADES,
  heads: HEADS,
  torso: TORSO,
  legs: LEGS,
  legsFeetX: 8,
  torsoX: -9,
  torsoOverlap: 1,
  headX: 1,
  headOverlap: 1,
  shoulderNear: [4, 3],
  shoulderFar: [12, 3],
  armNear: { segs: ARM_NEAR },
  armFar: { segs: ARM_FAR },
  fistNear: GAUNTLET,
  fistFar: GAUNTLET,
  fistAt: [-1, -1],
};

// ------------------------------------------------------------------ the sword

/** Where the sword's point landed in the last frame painted (frame px), for the blade's glint (fighters.ts). */
let lastTip: [number, number] | null = null;
/** His sword (steel, a cyan core, a gold guard with a red stone), `len` px of blade along `dir`, grip at the hand. */
const sword =
  (dir: Dir, len = 14): Item =>
  (g, x, y) => {
    const s: Sprite = swordMap(dir, len);
    stampAt(g, s, SWORD_PAL, x, y);
    s.rows.forEach((r, j) => {
      const i = r.indexOf('T');
      if (i >= 0) lastTip = [x - s.grip[0] + i, y - s.grip[1] + j];
    });
  };

// ------------------------------------------------------------------ the plume and the cape (secondary motion)

/** The plume as a curve from the helm's crest: `tail` and `ctrl` relative to the crest (x right, y down). It tapers
 *  from 3 px to 1 and is lit on its upper side. */
type PlumeK = 'hang' | 'lag' | 'sway' | 'flow' | 'rise' | 'limp' | 'up';
const PLUMES: Record<PlumeK, { ctrl: [number, number]; tail: [number, number] }> = {
  hang: { ctrl: [-4, -9], tail: [-13, 5] },
  lag: { ctrl: [-4, -9], tail: [-13, 6] },
  sway: { ctrl: [-5, -8], tail: [-14, 7] },
  flow: { ctrl: [-8, -5], tail: [-18, 0] },
  rise: { ctrl: [-5, -9], tail: [-15, -6] },
  limp: { ctrl: [-4, -5], tail: [-9, 9] },
  up: { ctrl: [-2, -10], tail: [-12, -5] },
};
const plume =
  (k: PlumeK): Layer =>
  (g, a) => {
    const { ctrl, tail } = PLUMES[k];
    const rx = a.hx + 9;
    const ry = a.hy;
    const cells = new Map<string, number>();
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      const px = rx + 2 * u * t * ctrl[0] + t * t * tail[0];
      const py = ry + 2 * u * t * ctrl[1] + t * t * tail[1];
      // (thick to the end: no 1 px tail at 8x)
      const r = 2.5 - 1.3 * t;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) <= r) cells.set(`${Math.round(px + dx)},${Math.round(py + dy)}`, t);
    }
    const has = (x: number, y: number) => cells.has(`${x},${y}`);
    for (const [key, t] of cells) {
      const [x, y] = key.split(',').map(Number);
      // lit along the top, a shaded underside, the tip darker (it curls away from the light)
      let c = PLUME[2];
      if (!has(x, y - 1)) c = t < 0.5 ? PLUME[4] : PLUME[3];
      else if (!has(x, y + 1)) c = PLUME[1];
      else if (!has(x - 1, y) && t > 0.5) c = PLUME[3];
      if (t > 0.85 && has(x, y - 1)) c = PLUME[1];
      put(g, x, y, c);
    }
  };

type CapeK = 'hang' | 'sway' | 'flow' | 'rise' | 'limp';
/** The cape from the shoulders: [rows, x, y] relative to the torso's top left ('c' cloth, 'C' a fold in shadow). Most
 *  of it is hidden behind the body; what shows is the part left of the back. */
const CAPES: Record<CapeK, [string[], number, number]> = {
  hang: [['...ccccc', '..cccccc', '.cCccccc', '.cCccccc', '.cCccccc', 'ccCccccc', 'ccCccccc', 'ccCccccc', 'ccCccccc', 'cCccCccc', 'cCcccccc', '.cc.cccc'], -3, 1],
  sway: [['...ccccc', '..cccccc', '.cCccccc', '.cCccccc', 'ccCccccc', 'ccCccccc', 'cccCcccc', 'cccCcccc', 'ccccCccc', 'cccccCcc', '.cccccCc', '..cc.ccc'], -4, 1],
  flow: [['......ccccc', '....ccccccc', '..cccCccccc', 'ccccCcccccc', 'cccCcccccc.', '.ccCcccccc.', '..ccccc....'], -9, 1],
  rise: [['cc.........', 'cccc.......', '.cCccc.....', '..ccCccccc.', '...cccccccc', '.....cccccc'], -9, -2],
  limp: [['..ccccc', '.cccccc', '.cCcccc', '.cCcccc', '.cCcccc', '.cCcccc', '.cCcccc', '.cCcccc', '..Ccccc'], -2, 2],
};
const capeShade: Shade = { ramp: CAPE, same: 'C', top: [4], left: [3], right: [1], bottom: [0], mid: 2 };
const cape =
  (k: CapeK): Layer =>
  (g, a) => {
    const [rows, x, y] = CAPES[k];
    rows.forEach((r, j) =>
      [...r].forEach((ch, i) => {
        if (ch === '.') return;
        const X = a.tx + x + i;
        const Y = a.ty + y + j;
        if (ch === 'C') return put(g, X, Y, CAPE[1]);
        const left = r[i - 1] === undefined || r[i - 1] === '.';
        const below = rows[j + 1]?.[i] === undefined || rows[j + 1][i] === '.';
        const top = j === 0 || rows[j - 1][i] === undefined || rows[j - 1][i] === '.';
        put(g, X, Y, top ? capeShade.ramp[4] : left ? capeShade.ramp[3] : below ? capeShade.ramp[0] : capeShade.ramp[2]);
      }),
    );
  };

// ------------------------------------------------------------------ light

const ARC = ['#ffffff', ROWAN_GLOW[2], ROWAN_BLUE[3], ROWAN_BLUE[2]];
/** A steel-blue arc trailing a cut (a bright edge, a cyan body, a blue tail). */
const sweep =
  (cx: number, cy: number, r: number, a0: number, a1: number): Layer =>
  (g, a) => {
    ARC.slice(0, 3).forEach((col, k) => {
      const rr = r - k;
      for (let t = 0; t <= 1; t += 1 / (rr * 4)) {
        if (k === 2 && t > 0.75) continue;
        const ang = a0 + (a1 - a0) * t;
        put(g, Math.round(a.fx + cx + Math.cos(ang) * rr), Math.round(a.fy - cy - Math.sin(ang) * rr), col);
      }
    });
  };
/** Motes of light (sparkles and dots in the visor's cyan). */
const motes =
  (pts: Array<[number, number]>): Layer =>
  (g, a) =>
    pts.forEach(([x, y], i) => (i % 2 ? put(g, a.fx + x, a.fy - y, ROWAN_GLOW[2]) : sparkle(g, a.fx + x, a.fy - y, ROWAN_GLOW[1], '#ffffff')));
/** A whirl of light round the raised blade (the finisher: Whirlwind). */
const whirl: Layer = (g, a) => {
  const cx = a.fx + 1;
  const cy = a.fy - 12;
  for (let k = 0; k < 3; k++) {
    const r = 19 - k * 3;
    for (let t = 0; t <= 1; t += 1 / (r * 5)) {
      const ang = 2.6 + t * 4.2 + k * 0.5;
      const ry = r * 0.3;
      const x = Math.round(cx + Math.cos(ang) * r);
      const y = Math.round(cy + Math.sin(ang) * ry);
      if (t > 0.8 && k > 0) continue;
      put(g, x, y, ARC[Math.min(3, k + (t > 0.6 ? 1 : 0))]);
    }
  }
};
/** The sword lying on the ground beside him (knocked out). */
const droppedSword: Layer = (g, a) => stampAt(g, swordMap('r', 14), SWORD_PAL, a.fx - 18, a.fy - 1);

// ------------------------------------------------------------------ poses

const P = (p: RigPose): RigPose => p;
export const ROWAN_POSES: Record<string, RigPose> = {
  // a knight's guard: the sword up before him; the breath (0-1-2-3: up, down, down, up) with the plume and cape a
  // frame behind it (they drop as he rises again)
  // (the sword in the forward hand, in front of him: no arm crosses his chest; the back hand rests at his hip)
  idle0: P({ far: { at: [10, 10], item: sword('ur', 13) }, near: { at: [-4, 9] }, farFront: true, back: [cape('hang'), plume('hang')] }),
  idle1: P({ far: { at: [10, 9], item: sword('ur', 13) }, near: { at: [-4, 8] }, farFront: true, dy: 1, back: [cape('hang'), plume('lag')] }),
  idle2: P({ far: { at: [10, 9], item: sword('ur', 13) }, near: { at: [-4, 8] }, farFront: true, dy: 1, back: [cape('sway'), plume('sway')] }),
  idle3: P({ far: { at: [10, 10], item: sword('ur', 13) }, near: { at: [-4, 9] }, farFront: true, back: [cape('sway'), plume('lag')] }),
  dash: P({ near: { at: [-6, 11], item: sword('l') }, far: { at: [7, 12] }, legs: 'run', dx: 1, lean: 1, back: [cape('flow'), plume('flow')] }),
  // a cut down and forward, the arc trailing it
  slashA: P({ near: { at: [12, 13], item: sword('dr', 13) }, far: { at: [8, 11] }, legs: 'lunge', dx: 2, lean: 1, back: [cape('flow'), plume('flow')], front: [sweep(9, 16, 15, 1.9, -0.6)] }),
  // a sweep level with his chest
  slashB: P({ near: { at: [12, 16], item: sword('r', 15) }, far: { at: [8, 11] }, legs: 'lunge', dx: 2, lean: 1, head: 'cry', back: [cape('flow'), plume('flow'), sweep(8, 17, 14, 2.4, 0.4)] }),
  // the sword drawn back over his shoulder in both hands, crouched to spring
  windup: P({ near: { at: [-2, 23], item: sword('ul', 15) }, far: { at: [0, 22], hidden: true }, legs: 'crouch', dy: 1, armsUp: true, back: [cape('hang'), plume('up')] }),
  // the blade upright before him, the free hand bracing behind it
  parry: P({ far: { at: [9, 13], item: sword('u', 14) }, near: { at: [-3, 10] }, farFront: true, legs: 'crouch', dy: 1, back: [cape('hang'), plume('hang')], front: [motes([[13, 30], [7, 26]])] }),
  // knocked back a step: the sword flung up and back, the free hand thrown out
  hurt: P({ near: { at: [-4, 13], item: sword('ul', 12) }, far: { at: [9, 16] }, dx: -1, lean: -1, dy: 1, head: 'squint', back: [cape('rise'), plume('rise')] }),
  leap: P({ near: { at: [6, 24], item: sword('ur') }, far: { at: [8, 23], hidden: true }, legs: 'tuck', armsUp: true, back: [cape('rise'), plume('flow')] }),
  // knocked out: on one knee, the sword dropped beside him, the visor dark
  down: P({ near: { at: [7, 10] }, far: { at: [10, 9] }, farFront: true, legs: 'kneel', dy: 2, lean: 2, bow: 3, head: 'ko', back: [cape('limp'), plume('limp'), droppedSword] }),
  // Whirlwind: the blade swung out level at the end of a spin, a whirl of light round him, the visor blazing
  fin: P({ near: { at: [13, 15], item: sword('r', 16) }, far: { at: [9, 12] }, legs: 'lunge', dx: 1, head: 'cry', back: [cape('flow'), plume('flow')], front: [whirl, motes([[22, 30], [-8, 20]])] }),
  // the ability: the blade up before his visor, a glint running up it, the free hand open
  cast: P({ far: { at: [10, 13], item: sword('u', 15) }, near: { at: [-4, 9] }, farFront: true, back: [cape('sway'), plume('sway')], front: [motes([[12, 34], [5, 28], [16, 24], [3, 33]]), (g, a) => sparkle(g, a.fx + 9, a.fy - 27, ROWAN_GLOW[1], '#ffffff', true)] }),
};

/** Hero select card: the sword raised, cape streaming, before a steel-blue glow with a gold heart. */
export const ROWAN_CARD: HeroCardSpec = {
  pose: { near: { at: [9, 15], item: sword('u', 16) }, far: { at: [11, 10] }, back: [cape('flow'), plume('flow')] },
  glow: ['#fff0a0', '#4aa0f0'],
  motes: [[6, 14], [33, 9], [35, 27]],
};

/** Where the point of the sword is in a frame (frame px), read while painting it (null: no sword in hand). */
export function rowanTip(paint: (g: Grid) => void, g: Grid): [number, number] | null {
  lastTip = null;
  paint(g);
  return lastTip;
}
