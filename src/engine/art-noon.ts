// Region 5 foes (see docs/art-style.md, decisions L7/L8, and docs/content-bible.md section 8), drawn with art-frost.ts's
// helpers like art-ash.ts and art-dusk.ts: shaded masks with an automatic ink outline, facing left. Every sprite has
// idle0, idle1, windup, attack, hurt, flash and tell; the two mini-bosses have a second look past half HP (`sphinx2_*`:
// her sun eyes open; `brasslion2_*`: the mane white-hot), and the boss a look per phase (`gnomon2_*`, `gnomon3_*`: the
// mapmaker's two edits). Noonspire is a plateau under a sun nailed at noon: the light is harsh and straight down-left,
// the shadows deep and cool (indigo, slate), the stone and sand bleached; menace comes from glowing eyes, teeth and hard
// silhouettes, and what is hot is white-gold.
//
// Textures: `${sprite}_${pose}` (data/enemies-noon.ts's `sprite` fields) and the speaker's portrait (`portrait_sphinx`).
// Imported only by pack-noon.ts (region-art.ts): painted in idle slices, or at once when a fight or scene needs them.
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
  sweep,
  vol,
  type Add,
  type Mask,
  type Part,
  type PartOpts,
  type SpriteDef,
} from './art-frost';

export const NOON_SPRITES = [
  'duneskink',
  'glarehawk',
  'dunebandit',
  'dunecolossus',
  'sphinx',
  'emberscarab',
  'brasssentry',
  'sandsalamander',
  'sunforgedgolem',
  'brasslion',
  'dialwarden',
  'heatdjinn',
  'sunvulture',
  'noonknight',
  'gnomon',
] as const;
export const NOON_POSES = ['idle0', 'idle1', 'windup', 'attack', 'hurt', 'flash', 'tell'] as const;

export const NOON_COL: Record<string, number> = {
  duneskink: 0xa87a4a,
  glarehawk: 0xd0b070,
  dunebandit: 0x2c3460,
  dunecolossus: 0xa87a4a,
  sphinx: 0xc8a060,
  sphinx2: 0xf4d070,
  emberscarab: 0x2e7a6c,
  brasssentry: 0xd09a2c,
  sandsalamander: 0xe8762a,
  sunforgedgolem: 0xf4c050,
  brasslion: 0xd09a2c,
  brasslion2: 0xffc050,
  dialwarden: 0xd4d0d0,
  heatdjinn: 0xf09028,
  sunvulture: 0x463230,
  noonknight: 0xcfc4b8,
  gnomon: 0xd09a2c,
  gnomon2: 0xf4d070,
  gnomon3: 0x46405a,
};

// ------------------------------------------------------------------ ramps (dark to light: cool deep shadows, bleached tops)

const INK = '#140c1c';
const SAND = ['#14121e', '#2e2630', '#56443e', '#8a6c52', '#bc9a72', '#e2cca0'];
const BONE = ['#16182a', '#34364e', '#626478', '#9a98a6', '#cac4c2', '#efe8dc'];
const BRASS = ['#1c120e', '#4a2c12', '#8a5a18', '#c8902a', '#ecc456', '#fbe8a0'];
const STONE = ['#181420', '#3a2c2e', '#6a4c3a', '#9a744c', '#c49a64', '#e2c088'];
const CLOTH = ['#080a1a', '#141834', '#222a50', '#38446e', '#56628c', '#7c86a8'];
const IRON = ['#0a0a12', '#181a26', '#2a2c3c', '#424456', '#626476', '#8a8c9c'];
const SCALE = ['#0a1218', '#122a32', '#1c4648', '#2a6a62', '#4a9282', '#7cbaa0'];
const SALA = ['#1e0a0e', '#4e1612', '#923416', '#c8601e', '#ec9238', '#fcc46a'];
const HOTW = ['#2a0e0a', '#6e2a0e', '#b46418', '#e8a838', '#fbe08a', '#ffffff'];
const PLUME = ['#120c14', '#261a20', '#3e2c2c', '#5e443a', '#82604c', '#a8826a'];
const ARMOR = ['#14142a', '#363450', '#6a6680', '#a8a2ae', '#dcd4cc', '#fbf6ea'];
const SKIN = ['#1e0e14', '#4a2220', '#7e4230', '#b06a46', '#d6946a', '#f0bc92'];
const BLOOD = ['#2a0810', '#5e1218', '#9e2222', '#d8443a', '#f47a62'];

/** Glow letters: the sun's heat (white-gold), mirage shimmer (pale violet-blue), eyes, teeth, sand. */
const GLOW: Pal = {
  k: INK,
  W: '#ffffff',
  Q: '#7a2a0e',
  q: '#c45a14',
  x: '#f0a028',
  X: '#ffd24a',
  Z: '#fff4c8',
  m: '#6e665e', // a mirage's shimmer: heat haze, pale and broken
  M: '#a89c8a',
  N: '#e2e8ff',
  r: '#d8302a', // eyes that glow red
  R: '#ff7a52',
  t: '#ece4cc', // teeth
  n: '#1a0e14', // a mouth's dark
  s: '#c8bfae', // dust
  S: '#8a8072',
  b: '#3a6ad8', // the skink's blue
  B: '#7aa8f0',
  g: '#c0506a', // tongue
};

type Pts = [number, number][];
const parts = (spec: Record<string, Pts>, o?: PartOpts): Part => dots(Object.entries(spec).filter(([, p]) => p.length) as [string, Pts][], o);
const V = (m: Mask, box: [number, number, number, number], light: [number, number, number, number], ramp: string[], o: PartOpts = {}): Part => vol(m, box, light, ramp, { edge: ramp[0], ...o });
const round = (cx: number, cy: number, rx: number, ry: number, ramp: string[], o: PartOpts = {}): Part =>
  V(ell(cx, cy, rx, ry), [Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(cx + rx + 1), Math.ceil(cy + ry + 1)], [cx - rx * 0.35, cy - ry * 0.45, rx * 1.2, ry * 1.2], ramp, o);
const darker = (r: string[]) => r.map((_, i) => r[Math.max(0, i - 1)]);

/** A flame or a column of heat licking up from (cx, base). Drawn late. */
function flame(cx: number, base: number, h: number, w: number, f: number, lean = 0): Part {
  const L = ['Q', 'q', 'x', 'X', 'Z'];
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
      pts[k > 0.6 && t < 0.55 ? 'Z' : k > 0.4 ? 'X' : k > 0.2 ? 'x' : t > 0.7 || u > 0.85 ? 'Q' : 'q'].push([x, base - y]);
    }
  }
  return parts(pts, { pal: GLOW, late: true });
}

/** Sand thrown up or poured out (late pixels). */
const dust = (pts: Pts): Part => parts({ s: pts.filter((_, i) => i % 2 === 0), S: pts.filter((_, i) => i % 2 === 1) }, { pal: GLOW, late: true });
/** The glare: short white-gold rays round a point (late). */
function glare(cx: number, cy: number, r: number): Part {
  const pts: Record<string, Pts> = { Z: [], X: [] };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const)
    for (let k = 2; k <= r; k++) pts[k < r - 1 ? 'Z' : 'X'].push([cx + dx * k, cy + dy * k]);
  return parts(pts, { pal: GLOW, late: true });
}
/** A glowing eye, 2 wide (red menace or sun white-gold), or a shut slit. */
const eye = (x: number, y: number, kind: 'red' | 'sun' | 'shut' = 'red'): Part =>
  kind === 'shut' ? [['nn'], x, y + 1, { pal: GLOW }] : kind === 'sun' ? [['ZW', 'XZ'], x, y, { pal: GLOW }] : [['Rr', 'rn'], x, y, { pal: GLOW }];
/** A mirage's shimmer round a shape (late, broken lines). */
const shimmer = (x0: number, y0: number, w: number, h: number, f: number): Part => {
  const pts: Record<string, Pts> = { m: [], M: [] };
  for (let y = y0; y < y0 + h; y += 4) for (let x = x0 + ((y + 2 * f) % 7); x < x0 + w; x += 8) pts[(x + y) % 3 ? 'm' : 'M'].push([x, y], [x + 1, y], [x + 2, y - 1]);
  return parts(pts, { pal: GLOW, late: true });
};

// ------------------------------------------------------------------ dune skink (a sand skink, a blue stripe, a tongue)

function skinkParts(pose: string): Part[] {
  let bx = 0;
  let by = 0;
  let tongue = 0;
  let curl = 0;
  let eyeK: 'red' | 'shut' = 'red';
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      tongue = 3;
      curl = 1;
      break;
    case 'windup':
      bx = 2;
      by = 1;
      curl = 2;
      break;
    case 'attack':
      bx = -4;
      tongue = 4;
      break;
    case 'hurt':
      bx = 2;
      eyeK = 'shut';
      curl = 2;
      break;
    case 'tell':
      // Skitter!: up on its forelegs, the air round it shimmering
      by = -2;
      tongue = 5;
      extra.push(shimmer(1, 4, 28, 12, 1));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const path = bezier([[X(5), Y(12)], [X(12), Y(15)], [X(20), Y(17)], [X(30) + curl, Y(12) - curl * 2]]);
  const out: Part[] = [];
  // the legs, splayed low
  for (const [x0, far] of [[X(8), false], [X(17), true], [X(10), true], [X(19), false]] as const)
    out.push(limb(x0, Y(15), x0 + (far ? 2 : -2), Y(19), far ? '2' : '3', { pal: digits(SAND) }));
  out.push(
    sweep(
      path,
      (t) => 3.6 - t * 3,
      (t, side, lit) => {
        if (Math.abs(side) < 0.25 && t > 0.08 && t < 0.75) return 'b'; // the blue stripe down its back
        if (side > 0.55) return '4';
        return lit > 0.45 ? '5' : lit > 0.05 ? '4' : lit > -0.4 ? '3' : '2';
      },
      110,
      { pal: { ...GLOW, ...digits(SAND) }, edge: SAND[0] },
    ),
  );
  // the head: a wedge, a hard brow, a red eye
  out.push(V(poly([[X(0), Y(12)], [X(4), Y(9)], [X(9), Y(10)], [X(9), Y(14)], [X(2), Y(14)]]), [X(-1), Y(8), X(10), Y(15)], [X(4), Y(10), 5, 3], SAND));
  out.push(eye(X(4), Y(10), eyeK));
  out.push(line(X(1), Y(13), X(6), Y(13), 'n', { pal: GLOW }));
  if (tongue) out.push(line(X(0), Y(13), X(-tongue), Y(13 + (tongue > 3 ? 1 : 0)), 'g', { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ glare hawk (pale gold, wings that flash)

function hawkParts(pose: string): Part[] {
  let wing = 0; // 0 up, 1 level, 2 down
  let bx = 0;
  let by = 0;
  let flash = false;
  let open = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      wing = 2;
      by = 1;
      break;
    case 'windup':
      wing = 0;
      bx = 3;
      by = -2;
      break;
    case 'attack':
      wing = 1;
      bx = -5;
      by = 3;
      open = true;
      break;
    case 'hurt':
      wing = 2;
      bx = 3;
      break;
    case 'tell':
      // Sun Dive!: wings flung wide, flashing white in the sun
      wing = 0;
      flash = true;
      open = true;
      extra.push(glare(4, 4, 4), glare(30, 3, 4));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const ramp = flash ? ['#3a3030', '#8a7a58', '#e8d8a0', '#fff4d0', '#ffffff', '#ffffff'] : ['#1e1620', '#4a3a34', '#8a7048', '#c4a468', '#ead6a0', '#fffbe8'];
  const wingRows =
    wing === 0
      ? ['.........55', '.......5543', '.....55443.', '...554432..', '.5544322...', '544332.....']
      : wing === 1
        ? ['55554444333322', '.4443333222211']
        : ['544332.....', '.5544322...', '...554432..', '.....55443.', '.......5543', '.........55'];
  const out: Part[] = [];
  out.push([wingRows, X(wing === 1 ? 15 : 17), Y(wing === 0 ? 2 : wing === 1 ? 10 : 11), { pal: digits(darker(ramp)), edge: ramp[0] }]);
  out.push(round(X(16), Y(12), 7, 4, ramp));
  // the tail fanned behind
  out.push([['..4433', '443322', '.3322.'], X(22), Y(12), { pal: digits(ramp), edge: ramp[0] }]);
  out.push([wingRows, X(wing === 1 ? 9 : 11), Y(wing === 0 ? 3 : wing === 1 ? 11 : 12), { pal: digits(ramp), edge: ramp[0] }]);
  // the head: a hooked beak, a hard brow over a red eye
  out.push(round(X(9), Y(10), 3.5, 3, ramp));
  out.push([open ? ['.XX', 'XXq', '.qq', 'q..'] : ['.XX', 'XXq', '.q.'], X(4), Y(10), { pal: GLOW }]);
  out.push(parts({ n: [[X(8), Y(8)], [X(9), Y(8)], [X(10), Y(8)]] }, { pal: GLOW }));
  out.push(eye(X(8), Y(9)));
  // talons
  out.push(parts({ n: [[X(14), Y(17)], [X(16), Y(17)], [X(13), Y(18)], [X(17), Y(18)]] }, { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ dune bandit (veiled, a curved blade, a mirror on his back)

function banditParts(pose: string): Part[] {
  let blade: [number, number, number, number] = [9, 21, 2, 14]; // hand, tip
  let bx = 0;
  let lean = 0;
  let mirrorFlash = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      blade = [9, 22, 2, 15];
      break;
    case 'windup':
      blade = [12, 14, 15, 2];
      bx = 2;
      lean = 1;
      break;
    case 'attack':
      blade = [6, 20, -6, 24];
      bx = -3;
      lean = -1;
      break;
    case 'hurt':
      bx = 2;
      lean = 1;
      break;
    case 'tell':
      // Mirror Trick!: the mirror swung round, flashing; two false glints thrown on the sand
      mirrorFlash = true;
      blade = [10, 22, 4, 16];
      extra.push(glare(22, 9, 4), shimmer(0, 26, 24, 6, 2));
      break;
  }
  const X = (x: number) => x + bx;
  const F = 33;
  const out: Part[] = [];
  // the round mirror on his back
  out.push(round(X(21), 12, 5, 6, mirrorFlash ? ['#6a6a7a', '#c8c8d8', '#f0f0ff', '#ffffff', '#ffffff', '#ffffff'] : ['#20243a', '#3e4868', '#6a7aa0', '#a8b8d8', '#dce8f8', '#ffffff']));
  out.push(parts({ 2: [[X(17), 7], [X(25), 7], [X(16), 12], [X(26), 12]] }, { pal: digits(BRASS) }));
  // legs in wrapped trousers, boots
  out.push(limb(X(12), 24, X(11) - lean, F, '2', { pal: digits(CLOTH) }), limb(X(16), 24, X(17), F, '3', { pal: digits(CLOTH) }));
  out.push([['333', '2222'], X(9) - lean, F - 1, { pal: digits(PLUME), edge: PLUME[0] }], [['333.', '2222'], X(16), F - 1, { pal: digits(PLUME), edge: PLUME[0] }]);
  // the robe: indigo, belted, a sash flying
  out.push(V(poly([[X(9) + lean, 12], [X(19) + lean, 12], [X(20), 26], [X(8), 26]]), [X(7), 11, X(21) + 1, 27], [X(12), 15, 6, 7], CLOTH));
  out.push([['55443322'], X(9), 21, { pal: digits(BRASS), edge: BRASS[0] }]);
  out.push([['.43', '432', '32.'], X(19), 21, { pal: digits(BLOOD), edge: BLOOD[0] }]);
  // the head wrapped in a veil, only the eyes showing: two red slits
  out.push(round(X(13) + lean, 8, 4.5, 4.5, CLOTH));
  out.push([['nnnnn', 'rRnRr', 'nnnnn'], X(9) + lean, 7, { pal: GLOW }]);
  // the near arm and the curved blade (2 px, a hooked tip)
  out.push(limb(X(12) + lean, 14, blade[0] + bx, blade[1], '3', { pal: digits(CLOTH) }));
  out.push(limb(blade[0] + bx, blade[1], blade[2] + bx, blade[3], '4', { pal: digits(ARMOR) }));
  out.push(parts({ 5: [[blade[2] + bx - 1, blade[3] - 1]] }, { pal: digits(ARMOR) }));
  out.push([['44', '33'], blade[0] + bx - 1, blade[1], { pal: digits(BRASS), edge: BRASS[0] }]);
  return [...out, ...extra];
}

// ------------------------------------------------------------------ dune colossus (sandstone giant, sand pouring from its joints)

function colossusParts(pose: string): Part[] {
  let fist: [number, number] = [6, 34];
  let bx = 0;
  let pour = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      pour = 2;
      fist = [6, 35];
      break;
    case 'windup':
      fist = [8, 3];
      bx = 2;
      break;
    case 'attack':
      fist = [-1, 40];
      bx = -3;
      extra.push(dust([[-5, 40], [3, 39], [-7, 37], [1, 41], [-3, 36], [5, 37]]));
      break;
    case 'hurt':
      bx = 3;
      pour = 3;
      break;
    case 'tell':
      // Sandslide!/Haze!: both arms up, sand streaming off it in sheets, the air shimmering
      fist = [9, 2];
      pour = 3;
      extra.push(shimmer(0, 10, 44, 26, 3));
      break;
  }
  const X = (x: number) => x + bx;
  const out: Part[] = [];
  // the far arm
  out.push(capsule(X(31), 14, X(37), 32, 4.4, 4, '2', { pal: digits(darker(STONE)), edge: STONE[0] }), round(X(37), 33, 5, 4.5, darker(STONE)));
  // legs: blocks of sandstone
  out.push(V(poly([[X(11), 30], [X(19), 30], [X(20), 43], [X(10), 43]]), [X(9), 29, X(21), 43], [X(13), 32, 6, 8], STONE));
  out.push(V(poly([[X(24), 30], [X(32), 30], [X(33), 43], [X(24), 43]]), [X(23), 29, X(34), 43], [X(26), 32, 6, 8], STONE));
  // the torso: a heavy carved block, its strata showing
  const torso = anyOf(poly([[X(9), 10], [X(34), 9], [X(36), 30], [X(8), 31]]), ell(X(21), 12, 13, 5));
  const tp = V(torso, [X(7), 6, X(37), 32], [X(16), 12, 16, 14], STONE);
  tp[0] = tp[0].map((r, y) => [...r].map((c) => (c !== '.' && (y + 6) % 6 === 0 && +c > 1 ? String(+c - 1) : c)).join(''));
  out.push(tp);
  // the head sunk between the shoulders: a crude carved face, eyes like coals
  out.push(V(poly([[X(14), 1], [X(24), 1], [X(25), 10], [X(13), 10]]), [X(12), 0, X(26), 11], [X(17), 3, 6, 5], STONE));
  out.push(eye(X(15), 4), eye(X(20), 4));
  out.push([['ntntn'], X(16), 8, { pal: GLOW }]);
  // sand pouring from the joints
  for (const [x, y] of [[X(9), 30], [X(34), 31], [X(21), 31]] as const) for (let k = 0; k < pour + 1; k++) out.push(dust([[x, y + 1 + k * 2], [x + (k % 2), y + 2 + k * 2]]));
  // the near arm and its great fist
  out.push(capsule(X(12), 13, fist[0] + bx, fist[1], 4.8, 4.2, '3', { pal: digits(STONE), edge: STONE[0] }));
  out.push(round(fist[0] + bx, fist[1], 5.2, 4.6, STONE));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ the Noon Sphinx (mini-boss): a lioness with a stern face

function sphinxParts(pose: string, phase: number): Part[] {
  let bx = 0;
  let by = 0;
  let paw: [number, number] = [6, 42];
  let mouth = 0;
  const extra: Part[] = [];
  const sun = phase > 1;
  switch (pose) {
    case 'idle1':
      by = 1;
      break;
    case 'windup':
      bx = 3;
      by = -1;
      paw = [9, 34];
      break;
    case 'attack':
      bx = -4;
      paw = [-2, 40];
      mouth = 2;
      break;
    case 'hurt':
      bx = 3;
      mouth = 1;
      break;
    case 'tell':
      // Riddle! (and her Last Riddle): she speaks, the air round her shimmering with false shapes
      mouth = 1;
      extra.push(shimmer(0, 18, 20, 20, 1), shimmer(44, 8, 18, 18, 3));
      if (sun) extra.push(glare(16, 13, 5));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const FUR = sun ? ['#1e1220', '#5a3a2a', '#a07040', '#d8a85c', '#f4d488', '#fff4c8'] : ['#141220', '#3e2c2e', '#7a5a3e', '#b08a58', '#d8b680', '#f0dcae'];
  const out: Part[] = [];
  // the far legs
  out.push(round(X(50), Y(38), 5, 5, darker(FUR)));
  // the body: a lion's, couched but ready, the haunch high
  out.push(V(anyOf(ell(X(38), Y(32), 18, 9), ell(X(50), Y(33), 9, 9)), [X(19), Y(22), X(60), Y(43)], [X(34), Y(26), 18, 9], FUR));
  // the tail curled over the back, a dark tuft
  out.push(sweep(bezier([[X(58), Y(30)], [X(64), Y(24)], [X(62), Y(14)], [X(55), Y(16)]]), (t) => 1.4 - t * 0.4, (_t, side) => (side < 0 ? '4' : '3'), 50, { pal: digits(FUR), edge: FUR[0] }));
  out.push(round(X(55), Y(16), 2.2, 2, darker(darker(FUR))));
  // the forelegs and the near paw (claws out)
  out.push(capsule(X(22), Y(32), paw[0] + bx + 3, paw[1] + by - 2, 3.6, 3, '3', { pal: digits(FUR), edge: FUR[0] }));
  out.push(round(paw[0] + bx + 3, paw[1] + by, 4, 2.8, FUR));
  out.push(parts({ t: [[paw[0] + bx - 1, paw[1] + by + 1], [paw[0] + bx + 1, paw[1] + by + 2], [paw[0] + bx + 3, paw[1] + by + 2]] }, { pal: GLOW }));
  // the headdress: striped indigo and gold falling to her shoulders
  const nemes = poly([[X(10), Y(8)], [X(24), Y(6)], [X(30), Y(14)], [X(30), Y(28)], [X(22), Y(30)], [X(12), Y(24)]]);
  const np = V(nemes, [X(9), Y(5), X(31), Y(31)], [X(17), Y(10), 12, 12], CLOTH);
  np[0] = np[0].map((r, y) => [...r].map((c) => (c !== '.' && Math.floor((y + Y(5)) / 2) % 2 === 0 ? (+c > 2 ? 'G' : 'g') : c)).join(''));
  out.push([np[0], np[1], np[2], { pal: { ...digits(CLOTH), G: BRASS[4], g: BRASS[2] }, edge: CLOTH[0] }]);
  // the face, drawn by hand: a hard brow shelf over deep sockets, eyes red (her sun eyes white-gold past half HP), the
  // nose ridge and cheekbones catching the overhead light, the jaw in shadow
  const FACE = [
    '..00000000..',
    '.0445555440.',
    '044555555440',
    '033444444330',
    '011111111110',
    '01Rr1441rR10',
    '034213312430',
    '034325423430',
    '023321112320',
    '023332223320',
    '0231nnnn1320',
    '022322223220',
    '.0223333220.',
    '..01222210..',
    '...000000...',
  ].map((r) => (sun ? r.replace(/R/g, 'Z').replace(/r/g, 'W') : r))
    .map((r, y) => (y === 10 && mouth ? '0231ntnt1320' : y === 11 && mouth === 2 ? '021nnnnnn120' : y === 12 && mouth === 2 ? '.021tttt120.' : r));
  out.push([FACE, X(8), Y(10), { pal: { ...GLOW, ...digits(SKIN) } }]);
  // a gold uraeus on her brow (the crown that marks her above the rest)
  out.push([['.X.', 'XZX', '.x.'], X(13), Y(8), { pal: GLOW }]);
  if (sun) extra.push(glare(X(14), Y(15), 3));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ ember scarab (brass, rolling a sun-hot ball)

function scarabParts(pose: string): Part[] {
  let ball: [number, number] = [6, 12];
  let bx = 0;
  let heat = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      ball = [5, 12];
      break;
    case 'windup':
      bx = 2;
      ball = [9, 11];
      heat = 2;
      break;
    case 'attack':
      bx = -3;
      ball = [0, 13];
      break;
    case 'hurt':
      bx = 2;
      heat = 0;
      break;
    case 'tell':
      // Scorch!: the ball blazing white, heat pouring up off it
      heat = 3;
      extra.push(flame(6, 7, 7, 5, 1), glare(6, 12, 5));
      break;
  }
  const X = (x: number) => x + bx;
  const out: Part[] = [];
  const hot = heat >= 3 ? HOTW : heat === 2 ? ['#2a0e0a', '#6e2a0e', '#b46418', '#e8a838', '#fbe08a', '#fff4c8'] : heat ? SALA : darker(SALA);
  out.push(round(ball[0] + bx, ball[1], 5, 5, hot));
  // legs: six thin-but-2px spiked legs
  for (const [x, dx] of [[X(13), -2], [X(17), -1], [X(21), 1]] as const) out.push(limb(x, 15, x + dx, 19, '1', { pal: digits(BRASS) }));
  // the shell: dark iridescent teal, brass edged, a seam down its back
  out.push(V(ell(X(18), 11, 8, 6), [X(9), 4, X(27), 18], [X(15), 8, 8, 5], SCALE));
  out.push(line(X(19), 6, X(20), 16, '1', { pal: digits(SCALE) }));
  out.push(parts({ 5: [[X(14), 7], [X(15), 6], [X(16), 6]] }, { pal: digits(SCALE) }));
  // the head and horn, red eyes
  out.push(round(X(11), 12, 3.4, 3, BRASS));
  out.push([['..44', '.43.', '43..'], X(7), 6, { pal: digits(BRASS), edge: BRASS[0] }]);
  out.push(eye(X(9), 11));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ brass sentry (an automaton with a sun disc for a chest)

function sentryParts(pose: string): Part[] {
  let spear: [number, number, number, number] = [7, 30, 6, 2];
  let bx = 0;
  let disc = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      disc = 2;
      break;
    case 'windup':
      spear = [12, 22, 16, 1];
      bx = 2;
      break;
    case 'attack':
      spear = [20, 20, -6, 22];
      bx = -2;
      break;
    case 'hurt':
      bx = 2;
      disc = 0;
      break;
    case 'tell':
      // Sunflash!: the disc on its chest blazes
      disc = 3;
      extra.push(glare(17, 20, 6));
      break;
  }
  const X = (x: number) => x + bx;
  const F = 41;
  const out: Part[] = [];
  // legs: jointed brass, riveted
  out.push(limb(X(13), 30, X(12), F, '2', { pal: digits(BRASS) }), limb(X(20), 30, X(21), F, '3', { pal: digits(BRASS) }));
  out.push([['3333', '2222'], X(10), F - 1, { pal: digits(BRASS), edge: BRASS[0] }], [['3333', '2222'], X(20), F - 1, { pal: digits(BRASS), edge: BRASS[0] }]);
  // the body: a brass drum, the sun disc set in its chest
  out.push(V(poly([[X(9), 12], [X(25), 12], [X(26), 31], [X(8), 31]]), [X(7), 11, X(27), 32], [X(13), 15, 9, 9], BRASS));
  const dr = disc >= 3 ? ['#6e2a0e', '#e8a838', '#fbe08a', '#ffffff', '#ffffff', '#ffffff'] : disc === 2 ? HOTW : disc ? SALA : darker(SALA);
  out.push(round(X(17), 21, 5, 5, dr));
  out.push(parts({ 1: [[X(10), 14], [X(24), 14], [X(10), 29], [X(24), 29]] }, { pal: digits(IRON) }));
  // the head: a helm with a single slit, a fin crest
  out.push(V(poly([[X(12), 3], [X(22), 3], [X(23), 11], [X(11), 11]]), [X(10), 2, X(24), 12], [X(15), 5, 6, 4], BRASS));
  out.push([['nnnnnnn', 'rRRrnnn'], X(12), 6, { pal: GLOW }]);
  out.push([['.55', '544', '43.'], X(16), -1, { pal: digits(BRASS), edge: BRASS[0] }]);
  // the arm and its spear (2 px shaft, a broad sun-blade head)
  out.push(limb(X(10), 15, spear[0] + bx + 1, spear[1] - 3, '3', { pal: digits(BRASS) }));
  out.push(limb(spear[0] + bx, spear[1], spear[2] + bx, spear[3], '2', { pal: digits(IRON) }));
  const ang = Math.atan2(spear[3] - spear[1], spear[2] - spear[0]);
  out.push(capsule(spear[2] + bx, spear[3], spear[2] + bx + Math.cos(ang) * 5, spear[3] + Math.sin(ang) * 5, 1.8, 0.5, '4', { pal: digits(BRASS), edge: BRASS[0] }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ sand salamander (orange, flame spots)

function salamanderParts(pose: string): Part[] {
  let head: [number, number] = [5, 14];
  let curl = 0;
  let open = false;
  let spots = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      head = [5, 13];
      curl = 1;
      break;
    case 'windup':
      head = [9, 11];
      curl = 2;
      spots = 2;
      break;
    case 'attack':
      head = [0, 15];
      open = true;
      extra.push(flame(-3, 16, 5, 3, 2, -0.7));
      break;
    case 'hurt':
      head = [9, 13];
      spots = 0;
      break;
    case 'tell':
      // Bask!: head up to the sun, its spots flaring
      head = [5, 9];
      spots = 3;
      open = true;
      extra.push(flame(14, 13, 5, 3, 1), flame(22, 14, 4, 3, 3));
      break;
  }
  const out: Part[] = [];
  for (const [x0, far] of [[8, false], [18, true], [11, true], [21, false]] as const)
    out.push(limb(x0, 17, x0 + (far ? 2 : -2), 21, far ? '2' : '3', { pal: digits(SALA) }));
  const path = bezier([[head[0] + 3, head[1] + 1], [12, 17], [22, 18], [31 + curl, 13 - curl * 2]]);
  out.push(
    sweep(
      path,
      (t) => 3.8 - t * 3.1,
      (t, side, lit) => {
        if (side < 0.1 && side > -0.6 && Math.floor(t * 12) % 2 === 0 && t > 0.1 && t < 0.8) return spots >= 2 ? 'X' : spots ? 'q' : '1';
        if (side > 0.55) return '4';
        return lit > 0.45 ? '5' : lit > 0.05 ? '4' : lit > -0.4 ? '3' : '2';
      },
      110,
      { pal: { ...GLOW, ...digits(SALA) }, edge: SALA[0] },
    ),
  );
  const [hx, hy] = head;
  out.push(V(poly([[hx - 2, hy + 1], [hx + 2, hy - 2], [hx + 7, hy - 1], [hx + 7, hy + 3], [hx, hy + 3]]), [hx - 3, hy - 3, hx + 8, hy + 4], [hx + 2, hy - 1, 5, 3], SALA));
  out.push(eye(hx + 2, hy - 1));
  out.push(open ? [['nnnn', 'tnnt'], hx - 2, hy + 2, { pal: GLOW }] : line(hx - 1, hy + 2, hx + 4, hy + 2, 'n', { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ sunforged golem (white-hot, a kiln door for a heart)

function sunGolemParts(pose: string): Part[] {
  let fist: [number, number] = [6, 34];
  let back: [number, number] = [38, 32];
  let bx = 0;
  let door = 1; // the kiln door: 0 shut, 1 a crack of fire, 2 thrown open
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      fist = [6, 35];
      break;
    case 'windup':
      fist = [8, 2];
      bx = 2;
      break;
    case 'attack':
      fist = [-1, 40];
      bx = -3;
      extra.push(flame(-2, 41, 6, 5, 1), flame(4, 41, 4, 4, 2));
      break;
    case 'hurt':
      bx = 2;
      door = 0;
      break;
    case 'tell':
      // Kiln Heart!: the door in its chest thrown open, the fire inside blazing out
      door = 2;
      back = [40, 6];
      extra.push(glare(21, 21, 7), flame(21, 18, 8, 6, 0));
      break;
  }
  const X = (x: number) => x + bx;
  const SHELL = ['#1c0c0c', '#46200e', '#8a4818', '#c88430', '#ecc060', '#fbe8a8'];
  const out: Part[] = [];
  out.push(capsule(X(32), 14, back[0] + bx, back[1], 4.2, 3.8, '2', { pal: digits(darker(SHELL)), edge: SHELL[0] }), round(back[0] + bx, back[1] + 2, 4.8, 4.2, darker(SHELL)));
  out.push(V(poly([[X(12), 30], [X(20), 30], [X(21), 43], [X(10), 43]]), [X(9), 29, X(22), 43], [X(13), 32, 6, 8], SHELL));
  out.push(V(poly([[X(25), 30], [X(33), 30], [X(35), 43], [X(25), 43]]), [X(24), 29, X(36), 43], [X(27), 32, 6, 8], SHELL));
  out.push(V(anyOf(ell(X(22), 21, 13, 11.5), ell(X(16), 13, 9, 7), ell(X(29), 14, 8, 6)), [X(7), 4, X(37), 34], [X(16), 11, 16, 14], SHELL));
  // white-hot seams where the plates meet
  out.push(parts({ Z: [[X(12), 17], [X(13), 18], [X(14), 19], [X(30), 18], [X(29), 19], [X(28), 20], [X(18), 29], [X(25), 29]], X: [[X(11), 16], [X(31), 17], [X(19), 30], [X(26), 30]] }, { pal: GLOW }));
  // the kiln door: an iron arch in the chest
  const dr = door === 2 ? ['nZZZZn', 'ZWWWWZ', 'ZWWWWZ', 'XZZZZX'] : door ? ['IIIIII', 'IqxxqI', 'IIIIII', 'IIIIII'] : ['IIIIII', 'IIIIII', 'IIIIII', 'IIIIII'];
  out.push([['.IIII.', ...dr], X(19), 17, { pal: { ...GLOW, I: IRON[2] } }]);
  // the small head, eyes like the inside of a kiln
  out.push(round(X(13), 9, 5, 4.4, SHELL));
  // a dark brow slot, the eyes burning white in it, a grate of a mouth
  out.push([['nnnnnnnn', 'nZWnnWZn', 'n.XnnX.n'], X(9), 7, { pal: GLOW }], [['nnnn', 'XnXn'], X(11), 11, { pal: GLOW }]);
  out.push(capsule(X(14), 15, fist[0] + bx, fist[1], 4.6, 4, '3', { pal: digits(SHELL), edge: SHELL[0] }));
  out.push(round(fist[0] + bx, fist[1], 5, 4.4, SHELL));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ the Brass Lion (mini-boss): the spire stairs' guardian

function lionParts(pose: string, phase: number): Part[] {
  let bx = 0;
  let by = 0;
  let jaw = 0;
  let paw: [number, number] = [8, 42];
  const extra: Part[] = [];
  const hot = phase > 1;
  switch (pose) {
    case 'idle1':
      by = 1;
      break;
    case 'windup':
      bx = 3;
      by = -2;
      paw = [12, 30];
      jaw = 1;
      break;
    case 'attack':
      bx = -4;
      paw = [-1, 40];
      jaw = 2;
      break;
    case 'hurt':
      bx = 3;
      jaw = 1;
      break;
    case 'tell':
      // Roar! (Shimmer! past half HP): the great jaws open, the mane flaring
      jaw = 2;
      by = -1;
      extra.push(hot ? shimmer(0, 6, 22, 30, 2) : glare(14, 14, 6));
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const MANE = hot ? HOTW : ['#1c0e0a', '#4a2410', '#8a4c16', '#c47c24', '#e8b040', '#fbe08a'];
  const out: Part[] = [];
  out.push(round(X(50), Y(38), 5, 5, darker(BRASS)));
  // the body: cast brass, riveted plates, a thin seam of heat at the joins (white-hot once it overheats)
  const HULL = hot ? ['#2a0e0a', '#6e2a0e', '#a8521a', '#d8862a', '#f0b848', '#fbe0a0'] : BRASS;
  const body = V(anyOf(ell(X(40), Y(30), 17, 10), ell(X(52), Y(31), 8, 9)), [X(22), Y(19), X(61), Y(42)], [X(36), Y(24), 18, 9], HULL);
  const seams: Pts = [];
  body[0] = body[0].map((r, y) => [...r].map((c, x) => {
    if (c === '.' || (x + body[1] - X(22)) % 9 !== 0 || +c <= 1) return c;
    seams.push([x + body[1], y + body[2]]);
    return String(+c - 1);
  }).join(''));
  out.push(body);
  // overheated: the seams glow red-hot and heat licks up off its back
  if (hot) {
    extra.push(parts({ Q: seams.filter((_, i) => i % 3 === 0), q: seams.filter((_, i) => i % 3 === 1), x: seams.filter((_, i) => i % 3 === 2) }, { pal: GLOW }));
    extra.push(flame(X(38), Y(21), 7, 4, by + jaw), flame(X(47), Y(22), 5, 3, by + jaw + 2, 0.4));
  }
  out.push(sweep(bezier([[X(59), Y(28)], [X(65), Y(20)], [X(64), Y(12)], [X(58), Y(14)]]), (t) => 1.3 - t * 0.3, (_t, side) => (side < 0 ? '4' : '3'), 50, { pal: digits(BRASS), edge: BRASS[0] }));
  out.push(round(X(58), Y(14), 2.4, 2.2, MANE));
  out.push(capsule(X(26), Y(30), paw[0] + bx + 3, paw[1] + by - 2, 3.8, 3.2, '3', { pal: digits(BRASS), edge: BRASS[0] }));
  out.push(round(paw[0] + bx + 3, paw[1] + by, 4.4, 3, BRASS));
  out.push(parts({ t: [[paw[0] + bx - 1, paw[1] + by + 1], [paw[0] + bx + 1, paw[1] + by + 2], [paw[0] + bx + 3, paw[1] + by + 2]] }, { pal: GLOW }));
  // the mane: a crown of blade-like brass spikes round the head (too hot to touch)
  const mane: Part[] = [];
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.95 + (i / 10) * Math.PI * 1.35;
    const cx = X(18) + Math.cos(a) * 9;
    const cy = Y(18) + Math.sin(a) * 9;
    mane.push(capsule(X(18) + Math.cos(a) * 5, Y(18) + Math.sin(a) * 5, cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 2.6, 0.6, i % 2 ? '4' : '3', { pal: digits(MANE), edge: MANE[0] }));
  }
  out.push(...mane);
  // the head: a heavy muzzle, a scowling brow, red eyes (white-hot when it overheats), fangs
  out.push(V(anyOf(ell(X(17), Y(18), 8, 7.5), poly([[X(6), Y(18)], [X(12), Y(14)], [X(14), Y(24)], [X(7), Y(24)]])), [X(5), Y(10), X(26), Y(26)], [X(13), Y(14), 9, 7], BRASS));
  out.push(parts({ 1: [[X(9), Y(14)], [X(10), Y(13)], [X(11), Y(13)], [X(12), Y(13)], [X(13), Y(14)]] }, { pal: digits(BRASS) }));
  out.push(eye(X(10), Y(15), hot ? 'sun' : 'red'));
  const jy = Y(21);
  out.push(jaw === 2 ? [['nnnnnn', 'tnnnnt', 'nnnnnn', 'tn.nt.'], X(5), jy, { pal: GLOW }] : jaw ? [['nnnnn', 'tnnnt'], X(6), jy, { pal: GLOW }] : [['nnnnn', '.t.t.'], X(6), jy, { pal: GLOW }]);
  out.push([['kk', 'k.'], X(5), Y(17), { pal: GLOW }]);
  return [...out, ...extra];
}

// ------------------------------------------------------------------ dial warden (a sun-white robed guard with a hand mirror)

function wardenParts(pose: string): Part[] {
  let mirror: [number, number] = [5, 18];
  let bx = 0;
  let flashM = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      mirror = [5, 19];
      break;
    case 'windup':
      mirror = [8, 8];
      bx = 2;
      break;
    case 'attack':
      mirror = [0, 16];
      bx = -2;
      flashM = true;
      break;
    case 'hurt':
      bx = 2;
      break;
    case 'tell':
      // Hand Mirror!: the mirror held high, the sun thrown off it in a blaze and a shimmer
      mirror = [4, 6];
      flashM = true;
      extra.push(glare(6, 8, 6), shimmer(0, 24, 22, 8, 1));
      break;
  }
  const X = (x: number) => x + bx;
  const F = 35;
  const out: Part[] = [];
  // the robe: long, white, its folds in cool shadow, a gold hem and a dial pendant
  const robe = poly([[X(10), 11], [X(20), 11], [X(24), F], [X(7), F]]);
  const rp = V(robe, [X(6), 10, X(25), F], [X(13), 14, 8, 12], BONE);
  rp[0] = rp[0].map((r) => [...r].map((c, x) => (c !== '.' && (x + 2) % 5 === 0 && +c > 2 ? String(+c - 1) : c)).join(''));
  out.push(rp);
  out.push([['5544433332'], X(7), F - 1, { pal: digits(BRASS) }]);
  out.push(round(X(15), 19, 2.2, 2.2, BRASS));
  // the hood: deep, the face in its shadow, two red eyes
  out.push(V(poly([[X(9), 2], [X(19), 1], [X(22), 9], [X(20), 13], [X(9), 13], [X(7), 8]]), [X(6), 0, X(23), 14], [X(13), 4, 7, 5], BONE));
  out.push([['nnnnn', 'Rrnrn', 'nnnnn'], X(9), 6, { pal: GLOW }]);
  // the arm and the hand mirror (a brass frame, a bright face)
  out.push(limb(X(11), 14, mirror[0] + bx + 3, mirror[1] + 3, '3', { pal: digits(BONE) }));
  out.push(round(mirror[0] + bx, mirror[1], 3.4, 3.8, flashM ? ['#8a8a9a', '#e8e8f8', '#ffffff', '#ffffff', '#ffffff', '#ffffff'] : ['#3a4060', '#6a7aa0', '#a8b8d8', '#dce8f8', '#ffffff', '#ffffff']));
  out.push(parts({ 3: [[mirror[0] + bx - 3, mirror[1]], [mirror[0] + bx + 3, mirror[1]], [mirror[0] + bx, mirror[1] - 4], [mirror[0] + bx, mirror[1] + 4]] }, { pal: digits(BRASS) }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ heat djinn (a wavering column of orange air, a sly face)

function djinnParts(pose: string): Part[] {
  let f = 0;
  let bx = 0;
  let tall = 30;
  let grin = 1;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      f = 1;
      tall = 29;
      break;
    case 'windup':
      f = 2;
      bx = 2;
      tall = 32;
      break;
    case 'attack':
      f = 3;
      bx = -4;
      grin = 2;
      break;
    case 'hurt':
      f = 2;
      bx = 2;
      tall = 25;
      grin = 0;
      break;
    case 'tell':
      // Haze!: it spreads wide, the air round it rippling with mirages
      f = 1;
      grin = 2;
      extra.push(shimmer(0, 0, 30, 34, 0), shimmer(2, 2, 26, 30, 2));
      break;
  }
  const X = (x: number) => x + bx;
  const out: Part[] = [];
  // the column: a body of heat tapering to a wisp below, arms of air
  const body = (x: number, y: number) => {
    const t = y / tall; // 0 top .. 1 bottom
    const cx = X(14) + Math.sin(t * 5 + f * 1.3) * 2 * t;
    const half = t < 0.35 ? 6 + t * 4 : 7.4 * (1 - (t - 0.35) / 0.75);
    return Math.abs(x + 0.5 - cx) <= half && y >= 2 && y < tall;
  };
  const pts: Record<string, Pts> = { n: [], Q: [], q: [], x: [], X: [], Z: [] };
  for (let y = 0; y < tall; y++)
    for (let x = -2; x < 32; x++) {
      if (!body(x, y)) continue;
      const lit = !body(x - 1, y) || !body(x, y - 1);
      const dark = !body(x + 1, y) || !body(x, y + 1);
      // a smouldering column, dark at its heart, its rim lit and sparks of white heat drifting up through it
      const k = lit ? 'x' : dark ? 'n' : (x + y * 2 + f) % 9 === 0 ? 'X' : y > tall * 0.45 || (x + y) % 3 === 0 ? 'Q' : 'q';
      pts[k].push([x, y]);
    }
  out.push(parts(pts, { pal: GLOW }));
  // arms of heat, folded like a merchant's
  out.push(capsule(X(8), 11, X(5), 16, 1.6, 1.2, 'q', { pal: GLOW }), capsule(X(20), 11, X(23), 16, 1.6, 1.2, 'Q', { pal: GLOW }));
  // the face: slanted eyes burning white in dark sockets, a sly grin with teeth
  out.push([['nn..nn', 'ZWnnWZ', '.X..X.'], X(11), 6, { pal: GLOW }]);
  out.push(grin === 2 ? [['nnnnn', 'tntnt'], X(11), 10, { pal: GLOW }] : grin ? [['n...n', '.nnn.'], X(11), 10, { pal: GLOW }] : line(X(12), 11, X(15), 11, 'n', { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ sun vulture (bleached wings, a bald red head)

function vultureParts(pose: string): Part[] {
  let wing = 0;
  let bx = 0;
  let by = 0;
  let open = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      wing = 2;
      by = 1;
      break;
    case 'windup':
      bx = 3;
      by = -2;
      break;
    case 'attack':
      wing = 1;
      bx = -5;
      by = 3;
      open = true;
      break;
    case 'hurt':
      wing = 2;
      bx = 3;
      break;
    case 'tell':
      // Circle!: wings wide, banking round, its shadow nowhere (noon)
      wing = 1;
      open = true;
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const WING = ['#1a1a2a', '#3e3c4e', '#7a7480', '#b8b0b0', '#e0d8d0', '#f8f2ea'];
  const rows =
    wing === 0
      ? ['..........5', '........554', '......5543.', '....55432..', '..554332...', '5543322....', '43322......']
      : wing === 1
        ? ['55555444433332222', '.44443333222211..', '...3.3.3.2.2.....']
        : ['43322......', '5543322....', '..554332...', '....55432..', '......5543.', '........554', '..........5'];
  const out: Part[] = [];
  out.push([rows, X(wing === 1 ? 15 : 18), Y(wing === 0 ? 1 : wing === 1 ? 11 : 12), { pal: digits(darker(WING)), edge: WING[0] }]);
  out.push(round(X(17), Y(14), 7, 5, PLUME));
  // the ruff of dark feathers, the long bare neck and red head
  out.push(round(X(12), Y(12), 4, 3.4, PLUME));
  out.push(capsule(X(11), Y(11), X(7), Y(8), 1.5, 1.3, '3', { pal: digits(BLOOD), edge: BLOOD[0] }));
  out.push(round(X(6), Y(7), 3, 2.6, BLOOD));
  out.push(open ? [['.ss', 'ssS', '.S.', 'S..'], X(1), Y(7), { pal: GLOW }] : [['.ss', 'ssS', '.S.'], X(1), Y(7), { pal: GLOW }]);
  out.push(eye(X(5), Y(6)));
  out.push([rows, X(wing === 1 ? 9 : 12), Y(wing === 0 ? 2 : wing === 1 ? 12 : 13), { pal: digits(WING), edge: WING[0] }]);
  out.push(parts({ n: [[X(16), Y(19)], [X(18), Y(19)], [X(15), Y(20)], [X(19), Y(20)]] }, { pal: GLOW }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ noon knight (white-gold armour behind a mirror shield)

function knightParts(pose: string): Part[] {
  let blade: [number, number, number, number] = [30, 26, 36, 38];
  let shieldX = 4;
  let bx = 0;
  let flashS = false;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      shieldX = 4;
      blade = [30, 27, 36, 39];
      break;
    case 'windup':
      blade = [29, 20, 33, 1];
      bx = 2;
      break;
    case 'attack':
      blade = [18, 22, -4, 30];
      bx = -2;
      shieldX = 7;
      break;
    case 'hurt':
      bx = 2;
      shieldX = 6;
      break;
    case 'tell':
      // Mirror Shield!/Noon Blade!: the shield turned to the sun, blazing
      flashS = true;
      extra.push(glare(8, 22, 7));
      break;
  }
  const X = (x: number) => x + bx;
  const F = 45;
  const GOLD = BRASS;
  const out: Part[] = [];
  // the far arm and the long blade (2 px, a crossguard)
  out.push(limb(X(27), 18, blade[0] + bx, blade[1], '2', { pal: digits(ARMOR) }));
  out.push(limb(blade[0] + bx, blade[1], blade[2] + bx, blade[3], '4', { pal: digits(ARMOR) }));
  out.push([['5443', '3221'], blade[0] + bx - 1, blade[1] - 1, { pal: digits(GOLD), edge: GOLD[0] }]);
  // legs, greaves, sabatons
  out.push(V(poly([[X(13), 31], [X(19), 31], [X(19), F - 2], [X(12), F - 2]]), [X(11), 30, X(20), F - 1], [X(14), 33, 5, 7], ARMOR));
  out.push(V(poly([[X(22), 31], [X(28), 31], [X(29), F - 2], [X(22), F - 2]]), [X(21), 30, X(30), F - 1], [X(24), 33, 5, 7], ARMOR));
  out.push([['333333..', '2222222.'], X(9), F - 2, { pal: digits(ARMOR), edge: ARMOR[0] }], [['33333...', '222222.'], X(21), F - 2, { pal: digits(ARMOR), edge: ARMOR[0] }]);
  // the body: a breastplate with a gold sunburst
  out.push(V(anyOf(ell(X(20), 22, 9, 10), poly([[X(12), 26], [X(29), 26], [X(30), 33], [X(11), 33]])), [X(10), 11, X(31), 34], [X(16), 17, 9, 9], ARMOR));
  out.push(parts({ 4: [[X(20), 18], [X(19), 19], [X(21), 19], [X(20), 20], [X(18), 18], [X(22), 18]] }, { pal: digits(GOLD) }));
  out.push(round(X(28), 15, 4, 3.2, darker(ARMOR)));
  // the helm: a tall visored helm with a gold crest; red light behind the slit
  out.push(V(poly([[X(14), 1], [X(24), 1], [X(25), 12], [X(13), 12]]), [X(12), 0, X(26), 13], [X(17), 3, 6, 5], ARMOR));
  out.push([['nnnnnn', 'RrnnRr'], X(14), 6, { pal: GLOW }]);
  out.push([['.4444.', '455554', '.3333.'], X(15), -2, { pal: digits(GOLD), edge: GOLD[0] }]);
  // the mirror shield in front: tall, gold-rimmed, its face catching the sun
  const face = flashS ? ['#8a8a9a', '#e8e8f8', '#ffffff', '#ffffff', '#ffffff', '#ffffff'] : ['#262c48', '#46507a', '#7a88b0', '#b8c4e0', '#e4ecfa', '#ffffff'];
  out.push(V(poly([[X(shieldX), 14], [X(shieldX + 9), 13], [X(shieldX + 10), 30], [X(shieldX + 5), 36], [X(shieldX), 30]]), [X(shieldX - 1), 12, X(shieldX + 11), 37], [X(shieldX + 3), 17, 4, 8], face));
  out.push(line(X(shieldX), 14, X(shieldX), 30, '4', { pal: digits(GOLD) }), line(X(shieldX + 1), 13, X(shieldX + 9), 13, '5', { pal: digits(GOLD) }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ the Gnomon (the boss): the sundial's needle stood up

/**
 * The great sundial's needle stood up as a brass sentinel: a tall, leaning triangular blade of brass on two jointed
 * legs, a slit of a face high on its edge, arms that end in hour-hands; under it a slab of the dial with its hour lines.
 * Phase 1, the needle as drawn. Phase 2 ("too bright to see"): it blazes, every edge white-gold, glare off its face.
 * Phase 3 ("closer, then"): the sun drawn down onto its point, pinned by the Nail; the brass gone dark against it, the
 * hour lines burning.
 */
function gnomonParts(pose: string, phase: number): Part[] {
  let bx = 0;
  let by = 0;
  let hand: [number, number] = [6, 36]; // the near arm's hour-hand tip
  let lean = 0;
  const extra: Part[] = [];
  switch (pose) {
    case 'idle1':
      by = 1;
      break;
    case 'windup':
      bx = 3;
      lean = 2;
      hand = [10, 2];
      break;
    case 'attack':
      bx = -3;
      lean = -2;
      hand = [-6, 44];
      break;
    case 'hurt':
      bx = 3;
      lean = 1;
      break;
    case 'tell':
      // Noon Strike! (and its edits): its point raised, the hour lines on the dial lighting one by one
      hand = [8, 4];
      by = -1;
      break;
  }
  const X = (x: number) => x + bx;
  const Y = (y: number) => y + by;
  const F = 63;
  const METAL = phase === 3 ? ['#08060e', '#14101c', '#241c28', '#3a2e34', '#584640', '#7a6450'] : phase === 2 ? ['#3a1e10', '#8a5a18', '#d09a2c', '#f4d070', '#fff4c8', '#ffffff'] : BRASS;
  const out: Part[] = [];
  // the great dial behind it: a bronze ring with twelve hour notches (burning in phase 3)
  const ring: Record<string, Pts> = { 1: [], 2: [], 3: [], x: [], X: [] };
  const [rcx, rcy, rr] = [X(31), Y(24), 19];
  for (let y = rcy - rr - 1; y <= rcy + rr + 1; y++)
    for (let x = rcx - rr - 1; x <= rcx + rr + 1; x++) {
      const d = Math.hypot(x - rcx, y - rcy);
      if (d < rr - 1.6 || d > rr + 0.6) continue;
      const a = (Math.atan2(y - rcy, x - rcx) / (Math.PI * 2)) * 12;
      const notch = Math.abs(a - Math.round(a)) < 0.09;
      ring[phase === 3 ? (notch ? 'X' : 'x') : notch ? '3' : d > rr - 0.4 ? '1' : '2'].push([x, y]);
    }
  out.push(parts(ring, { pal: { ...GLOW, ...digits(phase === 3 ? ['#08060e', '#2a0e0a', '#6e2a0e', '#b46418'] : ['#0e0a12', '#2a1c18', '#4a3020', '#7a5428']) } }));
  // the dial slab underfoot: pale stone with hour lines (burning in phase 3)
  const dial: Record<string, Pts> = { 1: [], 2: [], 3: [], 4: [], X: [], Z: [] };
  for (let y = F - 5; y <= F; y++)
    for (let x = 4; x <= 58; x++) {
      const u = (x - 31) / 27;
      if (Math.abs(u) > 1 - (F - y) * 0.03) continue;
      const hour = Math.abs(((x - 31) * 3 + (F - y) * 7) % 13) < 1 && y < F;
      dial[hour ? (phase === 3 ? 'X' : '1') : y === F - 5 ? '4' : y > F - 2 ? '2' : '3'].push([X(x), Y(y)]);
    }
  out.push(parts(dial, { pal: { ...GLOW, ...digits(BONE) } }));
  // legs: two heavy jointed brass pistons, a knee bolt on each, broad feet
  const M = { pal: digits(METAL), edge: METAL[0] };
  out.push(capsule(X(25), Y(42), X(22), Y(52), 2.4, 2, '3', M), capsule(X(22), Y(52), X(20), Y(F - 5), 2, 1.8, '2', M));
  out.push(capsule(X(37), Y(42), X(40), Y(52), 2.4, 2, '3', M), capsule(X(40), Y(52), X(41), Y(F - 5), 2, 1.8, '3', M));
  out.push([['.55.', '5444', '.44.'], X(21), Y(51), M], [['.55.', '5444', '.44.'], X(38), Y(51), M]);
  out.push([['.33333.', '3444443', '2222222'], X(16), Y(F - 7), M], [['.33333.', '3444443', '2222222'], X(38), Y(F - 7), M]);
  // the far arm: a hinged strut, a clawed hand
  out.push(capsule(X(36), Y(22), X(46), Y(35), 2, 1.6, '2', M), capsule(X(46), Y(35), X(52), Y(29), 1.6, 1.4, '3', M));
  out.push([['5.5', '444', '.3.'], X(51), Y(26), M]);
  // the needle: a great right-angled blade of brass, its long edge the light's, leaning
  const tip: [number, number] = [X(28) + lean * 2, Y(2)];
  const blade = poly([tip, [X(40) + lean, Y(44)], [X(20), Y(44)], [X(23) + lean, Y(20)]]);
  const bp = V(blade, [X(18), Y(1), X(42) + 2, Y(45)], [X(26), Y(16), 10, 20], METAL);
  // engraved hour marks down its face
  bp[0] = bp[0].map((r, y) => [...r].map((c, x) => (c !== '.' && (y + bp[2]) % 7 === 0 && (x + bp[1]) % 2 === 0 && +c > 1 ? String(+c - 1) : c)).join(''));
  out.push(bp);
  // the face: a slit high on its edge, red light behind it (white in the glare)
  out.push([['nnnnn', phase === 2 ? 'ZWWZn' : 'rRRrn', 'nnnnn'], X(25) + lean, Y(14), { pal: GLOW }]);
  // the near arm: a hinged strut ending in an hour-hand blade (broad, a heavy point)
  out.push(capsule(X(24), Y(22), X(16), Y(28), 2.2, 1.8, '3', M));
  out.push(capsule(X(16), Y(28), hand[0] + bx, hand[1] + by, 1.8, 1.6, '4', M));
  out.push([['545', '454'], X(15), Y(27), M]);
  const ang = Math.atan2(hand[1] + by - Y(28), hand[0] + bx - X(16));
  out.push(capsule(hand[0] + bx, hand[1] + by, hand[0] + bx + Math.cos(ang) * 8, hand[1] + by + Math.sin(ang) * 8, 2.6, 0.6, '5', M));
  // phase 2: glare off every edge
  if (phase === 2) extra.push(glare(tip[0], tip[1] + 3, 6), glare(X(37), Y(38), 4));
  // phase 3: the sun drawn down onto its point, the Nail through it
  if (phase === 3) {
    extra.push(parts(Object.fromEntries((['Z', 'X', 'x'] as const).map((k, i) => [k, Array.from({ length: 80 }, (_, j): [number, number] => [tip[0] + Math.round(Math.cos(j) * (2 + i * 1.6) * ((j % 5) / 5 + 0.6)), tip[1] - 2 + Math.round(Math.sin(j) * (2 + i * 1.6) * ((j % 5) / 5 + 0.6))])])), { pal: GLOW, late: true }));
    extra.push(limb(tip[0] - 1, tip[1] - 8, tip[0], tip[1] + 2, 'n', { pal: GLOW, late: true }));
    extra.push(glare(tip[0], tip[1] - 2, 8));
  }
  if (pose === 'tell') extra.push(parts({ X: [[X(10), Y(F - 2)], [X(30), Y(F - 3)], [X(50), Y(F - 2)]], Z: [[X(20), Y(F - 3)], [X(40), Y(F - 3)]] }, { pal: GLOW, late: true }));
  return [...out, ...extra];
}

// ------------------------------------------------------------------ portrait (40x40, facing left)

export const NOON_PORTRAITS = ['sphinx'] as const;

function sphinxPortrait(): HTMLCanvasElement {
  const p: Part[] = [];
  const FUR = ['#141220', '#3e2c2e', '#7a5a3e', '#b08a58', '#d8b680', '#f0dcae'];
  // her lion shoulders, then the striped headdress falling either side
  p.push(V(ell(26, 42, 17, 10), [7, 32, 39, 39], [22, 35, 14, 6], FUR));
  const nemes = poly([[6, 6], [30, 3], [38, 14], [38, 39], [26, 39], [12, 30], [4, 20]]);
  const np = V(nemes, [3, 2, 39, 39], [18, 10, 16, 16], CLOTH);
  np[0] = np[0].map((r, y) => [...r].map((c) => (c !== '.' && Math.floor((y + 2) / 2) % 2 === 0 ? (+c > 2 ? 'G' : 'g') : c)).join(''));
  p.push([np[0], np[1], np[2], { pal: { ...digits(CLOTH), G: BRASS[4], g: BRASS[2] }, edge: CLOTH[0] }]);
  // the face, drawn by hand: the brow a hard shelf over deep sockets and red eyes, the nose ridge and cheekbones lit
  // from above, the mouth a straight line, the jaw falling into shadow
  p.push([
    [
      '....000000000000....',
      '...04444555544440...',
      '..0445555555555440..',
      '.044455555555554440.',
      '.034444444444444430.',
      '.033333333333333330.',
      '01111111111111111110',
      '0111RRr114411rRR1110',
      '0121rnn124421nnr1210',
      '03442123455432124430',
      '03443223455432234430',
      '02343323455432334320',
      '02333323544532333320',
      '02233321111112333220',
      '02233332222223333220',
      '0223331nnnnnn1333220',
      '02233322111122333220',
      '.022333344443333220.',
      '..0222333333332220..',
      '...01222222222210...',
      '....001111111100....',
      '......00000000......',
    ],
    3,
    10,
    { pal: { ...GLOW, ...digits(SKIN) } },
  ]);
  // the gold uraeus on her brow
  p.push([['.X.', 'XZX', '.x.'], 12, 7, { pal: GLOW }]);
  return render(40, 40, GLOW, {}, p);
}

// ------------------------------------------------------------------ build

function jobs(): Array<() => Array<[string, HTMLCanvasElement]>> {
  const def = (W: number, H: number, fn: (pose: string) => Part[]): SpriteDef => ({ W, H, pal: GLOW, shades: {}, parts: fn });
  const defs: Record<string, SpriteDef> = {
    duneskink: def(32, 22, skinkParts),
    glarehawk: def(34, 22, hawkParts),
    dunebandit: def(28, 34, banditParts),
    dunecolossus: def(44, 44, colossusParts),
    sphinx: def(66, 46, (p) => sphinxParts(p, 1)),
    sphinx2: def(66, 46, (p) => sphinxParts(p, 2)),
    emberscarab: def(30, 21, scarabParts),
    brasssentry: def(30, 42, sentryParts),
    sandsalamander: def(34, 23, salamanderParts),
    sunforgedgolem: def(44, 44, sunGolemParts),
    brasslion: def(66, 46, (p) => lionParts(p, 1)),
    brasslion2: def(66, 46, (p) => lionParts(p, 2)),
    dialwarden: def(28, 36, wardenParts),
    heatdjinn: def(30, 34, djinnParts),
    sunvulture: def(34, 24, vultureParts),
    noonknight: def(38, 46, knightParts),
    gnomon: def(62, 64, (p) => gnomonParts(p, 1)),
    gnomon2: def(62, 64, (p) => gnomonParts(p, 2)),
    gnomon3: def(62, 64, (p) => gnomonParts(p, 3)),
  };
  const groups: Record<string, string[]> = { sphinx: ['sphinx', 'sphinx2'], brasslion: ['brasslion', 'brasslion2'], gnomon: ['gnomon', 'gnomon2', 'gnomon3'] };
  const out: Array<() => Array<[string, HTMLCanvasElement]>> = NOON_SPRITES.map((name) => () => fitFrames((groups[name] ?? [name]).flatMap((n) => NOON_POSES.map((pose): [string, SpriteDef, string] => [n, defs[n], pose]))));
  out.push(() => [['portrait_sphinx', sphinxPortrait()]]);
  return out;
}

const drawn: Array<[string, HTMLCanvasElement]> = [];
let queue: Array<() => Array<[string, HTMLCanvasElement]>> | null = null;

export function paintNoonFoeSlice(ms = 8): boolean {
  queue ??= jobs();
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < ms) drawn.push(...queue.shift()!());
  return queue.length === 0;
}

export const noonFoeArtReady = (): boolean => queue !== null && queue.length === 0;

export function buildNoonFoeArt(add: Add, now = false): void {
  if (now) while (!paintNoonFoeSlice(1e9));
  if (!noonFoeArtReady()) return;
  for (const [key, c] of drawn) {
    const copy = document.createElement('canvas');
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext('2d')!.drawImage(c, 0, 0);
    add(key, copy);
  }
}

const NOON_PORTRAIT_KEYS = NOON_PORTRAITS.map((n) => 'portrait_' + n);
export const isNoonArtKey = (key: string): boolean => NOON_PORTRAIT_KEYS.includes(key) || NOON_SPRITES.some((n) => key.startsWith(n + '_') || key.startsWith(n + '2_') || key.startsWith(n + '3_'));

void [hash2];
