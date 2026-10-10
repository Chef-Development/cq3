// Rowan's sword as character maps at 8 directions (straight and clean 1:1 diagonals), drawn by art-hero-rowan.ts.
import type { Pal } from './art';

type Dir = 'r' | 'l' | 'u' | 'd' | 'ur' | 'ul' | 'dr' | 'dl';

// Sword maps: A lit edge, L core, C shaded edge, T tip, P pommel, d/h grip, G g r y Y guard.
interface SwordMap {
  rows: string[];
  grip: [number, number];
}

/** Horizontal sword pointing right, blade n px long. */
function swordH(n: number): SwordMap {
  return {
    rows: [
      '....G' + '.'.repeat(n + 1),
      '....g' + 'A'.repeat(n) + '.',
      'Pdhdr' + 'L'.repeat(n - 1) + 'AT',
      '....y' + 'C'.repeat(n - 1) + 'A.',
      '....Y' + '.'.repeat(n + 1),
    ],
    grip: [2, 2],
  };
}

/** Diagonal sword pointing up-right, blade n steps long. */
function swordD(n: number): SwordMap {
  const S = n + 6;
  const g: string[][] = Array.from({ length: S }, () => Array<string>(S).fill('.'));
  const set = (x: number, y: number, c: string) => {
    if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = c;
  };
  const at = (c: number): [number, number] => [c, S - 1 - c];
  for (let c = 5; c < 5 + n; c++) {
    const [x, y] = at(c);
    const nearTip = c === 4 + n;
    set(x - 1, y, 'A');
    set(x, y, nearTip ? 'A' : 'L');
    set(x + 1, y, nearTip ? 'A' : 'C');
  }
  set(...at(5 + n), 'T');
  set(...at(0), 'P');
  set(...at(1), 'd');
  set(...at(2), 'h');
  set(...at(3), 'd');
  // crossguard: a 2px thick bar perpendicular to the blade, lit at its upper end
  const [gx, gy] = at(4);
  for (let k = -2; k <= 2; k++) set(gx + k, gy + k, k === -2 ? 'G' : k === 0 ? 'r' : 'g');
  for (let k = -2; k <= 1; k++) set(gx + k + 1, gy + k, k < 0 ? 'y' : 'Y');
  return { rows: g.map((r) => r.join('')), grip: at(2) };
}

const flipX = (m: SwordMap): SwordMap => {
  const w = m.rows[0].length;
  return { rows: m.rows.map((r) => [...r].reverse().join('')), grip: [w - 1 - m.grip[0], m.grip[1]] };
};
const swapAC = (r: string) => r.replace(/[AC]/g, (c) => (c === 'A' ? 'C' : 'A'));
const flipY = (m: SwordMap, swap: boolean): SwordMap => ({
  rows: [...m.rows].reverse().map((r) => (swap ? swapAC(r) : r)),
  grip: [m.grip[0], m.rows.length - 1 - m.grip[1]],
});
/** Rotate 90 degrees counter-clockwise: the top row becomes the left column. */
const rotCCW = (m: SwordMap): SwordMap => {
  const h = m.rows.length;
  const w = m.rows[0].length;
  const rows = Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => m.rows[x][w - 1 - y]).join(''));
  return { rows, grip: [m.grip[1], w - 1 - m.grip[0]] };
};

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

export const SWORD_PAL: Pal = {
  A: '#eef3fa', L: '#9ad8ff', C: '#8a94b4', T: '#ffffff',
  P: '#f2c230', d: '#4a2c18', h: '#8a5a30',
  G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', r: '#e8443a',
};

