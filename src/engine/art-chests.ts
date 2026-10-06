// Hero chest art for the reveal (see docs/art-style.md): three chests, each closed and open, plus a soft glow and a
// bold starburst for the lead to tint by rarity. Chests are front-on like the act-map chest (art.ts chest_closed),
// lit from the top left: a domed lid over a box, with bands, corner caps and a lock plate; toCanvas adds the outline.
//
// Textures:
//   hchest_${kind}_closed / hchest_${kind}_open   CHEST_W x CHEST_H (36x34), kind = hero | rare | region. Closed and
//                     open share the canvas and the box's place in it (the box's bottom on the canvas's last rows),
//                     so draw them with origin (0.5, 1) and swap the texture to open: nothing jumps. The open lid
//                     stands up behind the box showing its inside; light pours from the mouth.
//                     hero: sturdy wood banded in gold, a hero crest (a blue shield with a sword) on the lid
//                     rare: deep blue lacquer banded in silver, studded with blue crystals
//                     region: violet panels framed in ornate gold, a big violet gem on the lock
//   hchest_glow       64x64 soft round glow, white with stepped, dithered alpha (tint it; ADD blend suits it)
//   hchest_burst      64x64 bold 12-point starburst, solid white (tint, rotate and scale it)
import { grid, put, stamp as stampAt, toCanvas, type Grid, type Pal } from './art';
import { bay } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

export const CHEST_W = 36;
export const CHEST_H = 34;
export const HERO_CHESTS = ['hero', 'rare', 'region'] as const;
export type HeroChestKind = (typeof HERO_CHESTS)[number];

const stamp = (g: Grid, rows: string[], pal: Pal, x: number, y: number) => stampAt(g, rows, pal, Math.round(x), Math.round(y));
const tone = (r: string[], v: number) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))];

// ------------------------------------------------------------------ ramps (dark -> light)

const WOOD = ['#2e1610', '#4e2a18', '#7a4224', '#a0602e', '#c8843e', '#e6a85a'];
const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0', '#fffbe0'];
const NAVY = ['#0c1230', '#16224e', '#22387a', '#3256a8', '#4a7ad0', '#78a8ea'];
const SILVER = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa', '#ffffff'];
const CRYSTAL = ['#123a7a', '#1e6ad0', '#3aa8f4', '#8ae0ff', '#e0faff', '#ffffff'];
const VIOLET = ['#1e0e34', '#381a5e', '#5a2a90', '#7e40c0', '#a86ae0', '#d0a4ff'];
const RUBY = ['#3a0a3a', '#7a1a6a', '#c0309a', '#f06ac8', '#ffc0ec', '#ffffff'];
const BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff', '#e0f6ff'];
const LIGHT = ['#d8901c', '#f2c230', '#ffe070', '#fff4b0', '#fffce8', '#ffffff'];

// ------------------------------------------------------------------ geometry

const X0 = 2;
const X1 = 33; // the box is 32 px wide
const BASE_TOP = 20; // the box's top row (the rim)
const BASE_BOT = CHEST_H - 2; // its bottom row (the last row is the outline)
const LID_TOP = 9; // the closed lid's crown

interface Style {
  body: string[]; // panels
  band: string[]; // bands, rims, corner caps
  /** Plank seams across the panels (wood) or smooth lacquer. */
  planks: boolean;
  /** Where the vertical bands run (left x of each, 3 px wide). */
  bands: number[];
  /** The emblem on the closed lid's front (centre x, centre y). */
  emblem: (g: Grid, cx: number, cy: number) => void;
  /** The lock plate on the box's top edge (centre x, top y). */
  lock: (g: Grid, cx: number, y: number) => void;
  /** Extra studs and trim, painted last. */
  trim?: (g: Grid, open: boolean) => void;
}

/** Inside the lid when closed: a dome over the box (top corners rounded). */
function lidIn(x: number, y: number): boolean {
  if (x < X0 || x > X1 || y < LID_TOP || y >= BASE_TOP) return false;
  const r = 5;
  const cx = x < X0 + r ? X0 + r : x > X1 - r ? X1 - r : x;
  return y >= LID_TOP + r || (x - cx) ** 2 + (y + 0.5 - (LID_TOP + r)) ** 2 <= r * r;
}

/** A panel tone: lit from the top left, darker to the right and down, with plank seams. */
function panel(s: Style, x: number, y: number, top: number, bot: number, curved: boolean): string {
  let v = 0.62 - (x - X0) / 90;
  if (curved) v += 0.28 - ((y - top) / (bot - top)) * 0.42; // the dome: bright crown, shaded toward the front
  else v -= ((y - top) / (bot - top)) * 0.18;
  if (x === X0) v += 0.2;
  if (x >= X1 - 1) v -= 0.25;
  if (s.planks && (y - top) % 4 === 3) v -= 0.3; // seam
  if (s.planks && (x * 3 + Math.floor((y - top) / 4) * 7) % 23 === 0) v -= 0.18; // a knot
  return tone(s.body, v);
}

function bandsAt(g: Grid, s: Style, y0: number, y1: number, inside: (x: number, y: number) => boolean): void {
  for (const bx of s.bands)
    for (let y = y0; y <= y1; y++)
      for (let k = 0; k < 3; k++) if (inside(bx + k, y)) put(g, bx + k, y, s.band[[4, 3, 1][k]]);
}

/** The box: panels, the rim along its top, bands, corner caps. */
function paintBase(g: Grid, s: Style): void {
  const inBase = (x: number, y: number) => x >= X0 && x <= X1 && y >= BASE_TOP && y <= BASE_BOT;
  for (let y = BASE_TOP; y <= BASE_BOT; y++) for (let x = X0; x <= X1; x++) put(g, x, y, panel(s, x, y, BASE_TOP, BASE_BOT, false));
  bandsAt(g, s, BASE_TOP, BASE_BOT, inBase);
  // the rim: a metal strip along the top, and a dark foot along the bottom
  for (let x = X0; x <= X1; x++) {
    put(g, x, BASE_TOP, s.band[x < X1 - 2 ? 4 : 2]);
    put(g, x, BASE_TOP + 1, s.band[2]);
    put(g, x, BASE_BOT, s.band[1]);
  }
  // corner caps: an L of metal round each bottom corner
  const cap = ['b...', 'bc..', 'bcc.', 'abbb'];
  for (const [x, flip] of [
    [X0, false],
    [X1 - 3, true],
  ] as Array<[number, boolean]>)
    stamp(g, flip ? cap.map((q) => [...q].reverse().join('')) : cap, { a: s.band[4], b: s.band[3], c: s.band[1] }, x, BASE_BOT - 3);
}

/** The closed lid: a dome of panels with the bands running over it and a rim along its front edge. */
function paintLid(g: Grid, s: Style): void {
  for (let y = LID_TOP; y < BASE_TOP; y++) for (let x = X0; x <= X1; x++) if (lidIn(x, y)) put(g, x, y, panel(s, x, y, LID_TOP, BASE_TOP - 1, true));
  bandsAt(g, s, LID_TOP, BASE_TOP - 1, lidIn);
  for (let x = X0; x <= X1; x++) put(g, x, BASE_TOP - 1, s.band[x < X1 - 2 ? 3 : 1]);
  // the crown's highlight: a lit streak along the top of the dome
  for (let x = X0 + 5; x < X1 - 8; x++) if (!s.bands.some((b) => x >= b && x < b + 3)) put(g, x, LID_TOP + 1, s.body[5]);
}

/**
 * The open chest, seen a little from above: over the box's front rim, its mouth (the inside, lit by the treasure),
 * bounded by the back wall's rim; above that the lid stands tilted back, its inside toward us (shadowed, the bands
 * showing through) and its front edge, now on top, catching the light.
 */
function paintOpen(g: Grid, s: Style): void {
  const backRim = BASE_TOP - 5;
  const top = 4;
  const hinge = backRim - 1;
  // the lid, tilted back: a touch narrower toward its far edge, which arches over the top (the dome's rim)
  const inLid = (x: number, y: number) => {
    if (y < top || y > hinge) return false;
    const inset = Math.round(((hinge - y) / (hinge - top)) * 1.5);
    const l = X0 + inset;
    const r = X1 - inset;
    if (x < l || x > r) return false;
    const k = 3;
    const cx = x < l + k ? l + k : x > r - k ? r - k : x;
    return y >= top + k || (x - cx) ** 2 + (y + 0.5 - (top + k)) ** 2 <= k * k + 1;
  };
  for (let y = top; y <= hinge; y++)
    for (let x = X0; x <= X1; x++) {
      if (!inLid(x, y)) continue;
      // the inside of the dome: in shadow, lit from below near the mouth
      let v = 0.18 + ((y - top) / (hinge - top)) * 0.2 - (x - X0) / 140;
      if (s.planks && (hinge - y) % 4 === 3) v -= 0.12;
      put(g, x, y, tone(s.body, v));
    }
  for (const bx of s.bands) for (let y = top; y <= hinge; y++) for (let k = 0; k < 3; k++) if (inLid(bx + k, y)) put(g, bx + k, y, s.band[[3, 2, 1][k]]);
  // the lid's front edge on top, and its hinge line
  for (let x = X0; x <= X1; x++) {
    if (inLid(x, top)) put(g, x, top, s.band[4]);
    if (inLid(x, top + 1)) put(g, x, top + 1, s.band[2]);
    if (inLid(x, hinge)) put(g, x, hinge, s.body[0]);
  }
  paintBase(g, s);
  // the back wall's rim, then the mouth: brightest in the middle where the treasure glows
  for (let x = X0; x <= X1; x++) put(g, x, backRim, s.band[x < X1 - 2 ? 3 : 1]);
  for (let y = backRim + 1; y < BASE_TOP; y++)
    for (let x = X0; x <= X1; x++) {
      const d = Math.abs(x + 0.5 - (X0 + X1 + 1) / 2) / ((X1 - X0) / 2);
      const depth = (y - backRim) / (BASE_TOP - backRim); // the front of the mouth is nearest the treasure
      let v = 1.1 - d * 1.05 + depth * 0.25 + (bay(x, y) - 0.5) * 0.25;
      if (x === X0 || x === X1) v = -1;
      put(g, x, y, v < 0.1 ? s.body[1] : v < 0.25 ? s.body[2] : tone(LIGHT, v));
    }
  // the box's side walls seen inside the mouth
  for (let y = backRim + 1; y < BASE_TOP; y++) {
    put(g, X0 + 1, y, s.body[3]);
    put(g, X1 - 1, y, s.body[1]);
  }
  // motes of light rising over the lid
  for (const [x, y, big] of [
    [12, 9, false],
    [17, 5, true],
    [23, 10, false],
    [26, 4, false],
  ] as Array<[number, number, boolean]>) {
    put(g, x, y, LIGHT[5]);
    if (big)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        put(g, x + dx, y + dy, LIGHT[3]);
  }
}

// ------------------------------------------------------------------ the three chests

const HERO: Style = {
  body: WOOD,
  band: GOLD,
  planks: true,
  bands: [6, 27],
  emblem: (g, cx, cy) =>
    // a blue shield with a gold rim, a silver sword down its middle
    stamp(
      g,
      ['GGGGGGGGG', 'GbbbWbbBG', 'GbbbWbbBG', 'GbbWWWbBG', 'GbbbWbbBG', '.GbbWbBG.', '.GbbYbBG.', '..GbbBG..', '...GgG...', '....g....'],
      { G: GOLD[3], g: GOLD[2], b: BLUE[3], B: BLUE[2], W: SILVER[4], Y: GOLD[4] },
      cx - 4,
      cy - 5,
    ),
  lock: (g, cx, y) => stamp(g, ['GGgggy', 'GgkkgY', 'gggkgY', 'yggggY', '.yYYY.'], { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], k: '#2a1408' }, cx - 3, y),
};

const RARE: Style = {
  body: NAVY,
  band: SILVER,
  planks: false,
  bands: [6, 27],
  emblem: (g, cx, cy) =>
    // a big faceted crystal set in a silver bezel
    stamp(
      g,
      ['..sSSs..', '.sWLLcs.', 'sWLLlccs', 'sLLlccbs', 'sLlccbbs', '.sccbbs.', '..sbbs..', '...ss...'],
      { s: SILVER[3], S: SILVER[4], W: CRYSTAL[5], L: CRYSTAL[4], l: CRYSTAL[3], c: CRYSTAL[2], b: CRYSTAL[1] },
      cx - 4,
      cy - 4,
    ),
  lock: (g, cx, y) => stamp(g, ['SSsssm', 'SsLcsM', 'ssccsM', 'msssmM', '.mMMM.'], { S: SILVER[5], s: SILVER[3], m: SILVER[2], M: SILVER[1], L: CRYSTAL[4], c: CRYSTAL[2] }, cx - 3, y),
  trim: (g, open) => {
    // crystal studs on the bands and the corners
    const stud = (x: number, y: number) => stamp(g, ['WL', 'Lc'], { W: CRYSTAL[5], L: CRYSTAL[3], c: CRYSTAL[1] }, x, y);
    for (const bx of [6, 27]) {
      stud(bx + 0.5, BASE_TOP + 4);
      stud(bx + 0.5, BASE_TOP + 9);
      if (!open) stud(bx + 0.5, LID_TOP + 4);
    }
    stud(X0 + 1, BASE_TOP + 3);
    stud(X1 - 2, BASE_TOP + 3);
  },
};

const REGION: Style = {
  body: VIOLET,
  band: GOLD,
  planks: false,
  bands: [5, 28],
  emblem: (g, cx, cy) =>
    // a gold sunburst medallion with a violet heart
    stamp(
      g,
      ['...g.g...', '.g.GGG.g.', '..GGgGG..', 'gGgvvVgGg', '.GgvRvgG.', 'gGgVvvgGg', '..GGgGG..', '.g.ggg.g.', '...g.g...'],
      { G: GOLD[4], g: GOLD[2], v: RUBY[3], V: RUBY[2], R: RUBY[5] },
      cx - 4,
      cy - 4,
    ),
  lock: (g, cx, y) =>
    stamp(g, ['.GGggy.', 'GgRrrgY', 'gRrrvgY', 'gGvvvyY', '.yyYYY.'], { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1], R: RUBY[5], r: RUBY[3], v: RUBY[2] }, cx - 3.5, y),
  trim: (g, open) => {
    // gold filigree curls in the panels, and gold feet
    const curl = ['.gg.', 'g..g', 'g.g.', '.g..'];
    for (const [x, y] of [
      [10, BASE_TOP + 4],
      [22, BASE_TOP + 4],
    ]) {
      stamp(g, curl, { g: GOLD[3] }, x, y);
      stamp(g, curl.map((r) => [...r].reverse().join('')), { g: GOLD[3] }, x + 4, y);
    }
    for (let x = 10; x <= 25; x++) if (x % 2 === 0) put(g, x, BASE_BOT - 2, GOLD[2]);
    if (!open)
      for (const x of [9, 24]) {
        stamp(g, ['.g.', 'g.g'], { g: GOLD[3] }, x, LID_TOP + 6);
        stamp(g, ['.g.', 'g.g'], { g: GOLD[3] }, x + 3, LID_TOP + 6);
      }
  },
};

const STYLES: Record<HeroChestKind, Style> = { hero: HERO, rare: RARE, region: REGION };

function chest(kind: HeroChestKind, open: boolean): HTMLCanvasElement {
  const s = STYLES[kind];
  const g = grid(CHEST_W, CHEST_H);
  const cx = Math.floor((X0 + X1) / 2) + 1;
  if (open) paintOpen(g, s);
  else {
    paintBase(g, s);
    paintLid(g, s);
    s.emblem(g, cx, LID_TOP + 5);
  }
  s.lock(g, cx, BASE_TOP - (open ? 0 : 1));
  s.trim?.(g, open);
  return toCanvas(g);
}

// ------------------------------------------------------------------ light

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
  const g = grid(n, n);
  const R = n / 2 - 1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = x + 0.5 - n / 2;
      const dy = y + 0.5 - n / 2;
      const a = Math.atan2(dy, dx) + Math.PI / 12;
      const k = 12;
      const ph = (((a / (Math.PI * 2)) * k) % 1 + 1) % 1; // 0..1 across one ray
      const long = Math.floor((((a / (Math.PI * 2)) * k) % k + k) % k) % 2 === 0;
      const tip = long ? R : R * 0.7;
      const r = R * 0.44 + (tip - R * 0.44) * Math.max(0, 1 - Math.abs(ph - 0.5) * 2) ** 0.85;
      if (Math.hypot(dx, dy) <= r) g[y][x] = '#ffffff';
    }
  // no outline: copy the pixels straight onto a canvas
  const c = document.createElement('canvas');
  c.width = n;
  c.height = n;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (g[y][x]) ctx.fillRect(x, y, 1, 1);
  return c;
}

// ------------------------------------------------------------------ build

export function buildChestArt(add: Add): void {
  for (const kind of HERO_CHESTS) {
    add(`hchest_${kind}_closed`, chest(kind, false));
    add(`hchest_${kind}_open`, chest(kind, true));
  }
  add('hchest_glow', glowTexture(64));
  add('hchest_burst', burstTexture(64));
}
