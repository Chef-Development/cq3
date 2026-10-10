// Rowan's sword as character maps at 8 directions, drawn by art-hero-rowan.ts. Built to read at 8x (playtest round 8:
// "the sword looks too thin"): a blade band 4 px across (a warm white lit edge, pale steel, mid steel, a shaded edge),
// a tapered point, a gold crossguard 2 px thick and 8 px long with a red stone, a wrapped grip and a round pommel.
// Straight maps point right (`r`) and diagonals up-right (`ur`); the other six are flips and quarter turns of those,
// with the lit and shaded edges swapped when a flip would put the light underneath.
import type { Pal } from './art';

type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl';

// A lit edge, L pale steel, M mid steel, C shaded edge, T the point's glint; P/p pommel, h/H grip wraps, G/g/y/Y the
// guard (lit to shaded), R/r the stone.
interface SwordMap {
  rows: string[];
  grip: [number, number];
}

const blank = (w: number, h: number) => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const done = (g: string[][], grip: [number, number]): SwordMap => ({ rows: g.map((r) => r.join('')), grip });

/** Straight sword pointing right, the blade `n` px long (point included). */
function swordH(n: number): SwordMap {
  const W = 7 + n;
  const g = blank(W, 8);
  // pommel and grip
  g[3][0] = 'P';
  g[4][0] = 'p';
  g[3][1] = 'P';
  g[4][1] = 'p';
  for (let x = 2; x <= 4; x++) {
    g[3][x] = x % 2 ? 'H' : 'h';
    g[4][x] = 'h';
  }
  // the crossguard: 2 px thick, rows 0-7, the stone in its middle
  const gc = ['G', 'G', 'G', 'R', 'r', 'g', 'g', 'y'];
  const gd = ['g', 'g', 'g', 'r', 'r', 'y', 'y', 'Y'];
  for (let y = 0; y < 8; y++) {
    g[y][5] = gc[y];
    g[y][6] = gd[y];
  }
  // the blade: rows 2-5 (lit edge on top), tapering to a point on row 3
  for (let j = 0; j < n; j++) {
    const x = 7 + j;
    const t = n - 1 - j;
    if (t >= 3) {
      g[2][x] = 'A';
      g[3][x] = 'L';
      g[4][x] = 'M';
      g[5][x] = 'C';
    } else if (t === 2) {
      g[2][x] = 'A';
      g[3][x] = 'L';
      g[4][x] = 'C';
    } else if (t === 1) {
      g[3][x] = 'A';
      g[4][x] = 'C';
    } else g[3][x] = 'T';
  }
  return done(g, [3, 4]);
}

/** Diagonal sword pointing up-right, `m` steps of blade (point included). */
function swordD(m: number): SwordMap {
  const S = m + 12;
  const g = blank(S, S);
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = c;
  };
  // the axis: step c sits at (c + 2, S - 2 - c)
  const at = (c: number): [number, number] => [c + 2, S - 2 - c];
  // pommel: a 2x2 knob at the bottom-left end
  {
    const [x, y] = at(0);
    set(x - 1, y, 'P');
    set(x, y, 'P');
    set(x - 1, y + 1, 'p');
    set(x, y + 1, 'p');
  }
  // the grip: two pixels per step
  for (let c = 1; c <= 3; c++) {
    const [x, y] = at(c);
    set(x, y, c % 2 ? 'H' : 'h');
    set(x + 1, y, 'h');
  }
  // the crossguard: across the blade (along the down-right diagonal), 2 px thick, lit at its upper-left end, the
  // stone where it crosses the blade
  {
    const [x, y] = at(4);
    for (let k = -4; k <= 3; k++) {
      const stone = k === 0 || k === -1;
      set(x + k, y + k, stone ? (k === -1 ? 'R' : 'r') : k < -1 ? 'G' : k > 1 ? 'y' : 'g');
      set(x + k + 1, y + k, stone ? 'r' : k < -1 ? 'g' : k > 1 ? 'Y' : 'y');
    }
  }
  // the blade: four pixels per row (lit edge upper-left, shaded edge lower-right), tapering at the point
  for (let i = 0; i < m; i++) {
    const [x, y] = at(6 + i);
    const t = m - 1 - i;
    if (t >= 3) {
      set(x - 2, y, 'A');
      set(x - 1, y, 'L');
      set(x, y, 'M');
      set(x + 1, y, 'C');
    } else if (t === 2) {
      set(x - 1, y, 'A');
      set(x, y, 'L');
      set(x + 1, y, 'C');
    } else if (t === 1) {
      set(x - 1, y, 'A');
      set(x, y, 'C');
    } else set(x - 1, y, 'T');
  }
  return done(g, at(2));
}

const flipX = (m: SwordMap): SwordMap => {
  const w = m.rows[0].length;
  return { rows: m.rows.map((r) => [...r].reverse().join('')), grip: [w - 1 - m.grip[0], m.grip[1]] };
};
/** Swap the lit and shaded tones (a flip that puts the lit edge underneath). */
const LIT_SWAP: Record<string, string> = { A: 'C', C: 'A', L: 'M', M: 'L' };
const swapLit = (r: string) => r.replace(/[ACLM]/g, (c) => LIT_SWAP[c]);
const flipY = (m: SwordMap, swap: boolean): SwordMap => ({
  rows: [...m.rows].reverse().map((r) => (swap ? swapLit(r) : r)),
  grip: [m.grip[0], m.rows.length - 1 - m.grip[1]],
});
/** Rotate 90 degrees counter-clockwise: the top row becomes the left column (the lit edge stays toward the light). */
const rotCCW = (m: SwordMap): SwordMap => {
  const h = m.rows.length;
  const w = m.rows[0].length;
  const rows = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => m.rows[x][w - 1 - y]).join(''));
  return { rows, grip: [m.grip[1], w - 1 - m.grip[0]] };
};

/** The sword along `dir` with `len` px of blade (a diagonal has about 0.72 of that in steps). */
export function swordMap(dir: Dir, len: number): SwordMap {
  const nd = Math.round(len * 0.72);
  switch (dir) {
    case 'r':
      return swordH(len);
    case 'l':
      return flipX(swordH(len));
    case 'u':
      return rotCCW(swordH(len));
    case 'd':
      return flipY(rotCCW(swordH(len)), false);
    case 'ur':
      return swordD(nd);
    case 'ul':
      return flipX(swordD(nd));
    case 'dr':
      return flipY(swordD(nd), true);
    case 'dl':
      return flipX(flipY(swordD(nd), true));
  }
}

// Steel hue-shifted (the shade toward violet, the light toward warm white), gold and a red stone.
export const SWORD_PAL: Pal = {
  A: '#fffaf0', L: '#c4daf2', M: '#8a9cc4', C: '#4a5272', T: '#ffffff',
  P: '#f2c230', p: '#9a5a14', h: '#4a2c18', H: '#8a5a30',
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', R: '#ff7a5a', r: '#c0282a',
};
