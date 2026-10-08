// Gorm's and Tess's dialogue portraits (Part 6; `portrait_gorm`, `portrait_tess`): 40x40 busts facing right on a
// transparent background, painted like the others (art-hero-portraits.ts): forms filled as lit volumes (light from the
// top left, hue-shifted ramps), details stamped from small maps, the 1px ink outline from toCanvas. Their 18x18 face
// windows are in PORTRAIT_FACE_AT.
import { grid, put, stamp, toCanvas, type Pal } from './art';
import { and, bez, ell, fill, not, or, rect, rimShade, sphere, stroke } from './art-paint';

const P = 40;
const INK = '#140c1c';

// ------------------------------------------------------------------ Gorm

const G_SKIN = ['#20252c', '#333d40', '#4b5854', '#67766a', '#889684', '#b0baa0', '#ccd4b4'];
const G_HAIR = ['#163222', '#24502e', '#3e7434', '#689a3a', '#a2c84e', '#d0e47a'];
const G_STONE = ['#24232f', '#3c3a48', '#5c5864', '#837e7e', '#aba396', '#d6cdb8'];
const G_LEATHER = ['#26160e', '#452918', '#6a4224', '#946238', '#bc8c58'];

export function gormPortrait(): HTMLCanvasElement {
  const g = grid(P, P);
  // the great shoulders and chest, filling the frame's foot
  const body = or(ell(20, 45, 23, 14), ell(5, 34, 7, 6), ell(36, 35, 6, 6));
  fill(g, body, sphere(G_SKIN, 12, 30, 26, 16, 0.22));
  rimShade(g, body, G_SKIN[1]);
  // the harness: two leather straps crossing to a stone, studded with stones
  for (const [x0, y0, x1, y1] of [
    [6, 30, 21, 40],
    [35, 31, 21, 40],
  ]) {
    stroke(g, [[x0, y0], [x1, y1]], 1.3, (x, y) => (body(x, y) ? (x + y) % 5 === 0 ? G_LEATHER[3] : G_LEATHER[2] : null));
    for (let t = 0.25; t < 0.8; t += 0.35) {
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      stamp(g, ['ab', 'bc'], { a: G_STONE[5], b: G_STONE[3], c: G_STONE[1] }, x, y);
    }
  }
  // the thick neck
  const neck = ell(23, 30, 8, 6);
  fill(g, neck, sphere(G_SKIN, 20, 26, 10, 8, 0.15));
  // the head: a small cranium over a big jaw jutting forward
  const skull = ell(23, 15, 8.5, 8);
  const jaw = ell(26, 23.5, 10.5, 6.5);
  const head = or(skull, jaw, ell(33.5, 18.5, 2.2, 2.6));
  fill(g, head, sphere(G_SKIN, 22, 13, 13, 13, 0.42));
  rimShade(g, head, G_SKIN[1]);
  // the ear at the back
  fill(g, ell(15.5, 19, 2, 3), sphere(G_SKIN, 14.5, 18, 3, 3.5, 0.1));
  put(g, 16, 19, G_SKIN[1]);
  // the tuft of moss-green hair, spiking up and swept back
  const tuft = or(ell(21, 7.5, 6.5, 3.6), ell(17, 9, 3, 2.5), ell(25.5, 6.5, 2.5, 2.2));
  fill(g, tuft, sphere(G_HAIR, 18, 5, 8, 4, 0.25));
  for (const [x, y] of [
    [17, 4],
    [20, 3],
    [23, 3],
    [26, 4],
  ]) {
    put(g, x, y, G_HAIR[4]);
    put(g, x, y + 1, G_HAIR[3]);
  }
  rimShade(g, tuft, G_HAIR[1]);
  // the heavy brow, small kind eyes, the broad nose
  for (let x = 24; x <= 34; x++) put(g, x, x < 29 ? 15 : 14 + (x > 31 ? 1 : 0), G_SKIN[2]);
  const eye: Pal = { k: INK, W: '#f4f0e0', a: '#8a6a2a' };
  stamp(g, ['kkk', 'Wak', '.k.'], eye, 25, 16);
  stamp(g, ['kkk', 'Wak'], eye, 31, 16);
  stamp(g, ['.ss', 'sSS', 'zzs'], { s: G_SKIN[4], S: G_SKIN[5], z: G_SKIN[2] }, 33, 18);
  // the mouth: a long line with the underbite's two little teeth pointing up
  for (let x = 25; x <= 35; x++) put(g, x, 24 + (x < 27 ? 1 : 0), '#2a1a1a');
  stamp(g, ['t', 't'], { t: '#ece4c8' }, 28, 23);
  stamp(g, ['t', 't'], { t: '#ece4c8' }, 33, 23);
  // a stone gauntlet raised at the frame's edge
  const fist = and(rect(30, 30, 39, 39), not(or(rect(30, 30, 30, 30), rect(39, 39, 39, 39))));
  fill(g, fist, sphere(G_STONE, 32, 32, 9, 9, 0.35));
  for (const y of [32, 35, 38]) for (const x of [37, 38]) put(g, x, y, G_STONE[1]);
  for (const y of [32, 35]) put(g, 35, y, G_STONE[5]);
  stamp(g, ['MM.', '.Mm'], { M: G_HAIR[4], m: G_HAIR[2] }, 31, 29);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Tess

const T_HAIR = ['#44445a', '#72728a', '#a2a2b0', '#cacad2', '#eeeef0'];
const T_SKIN = ['#7a463a', '#b4765e', '#dca486', '#f2c8ac', '#ffe6d4'];
const T_TEAL = ['#0c2a30', '#15484c', '#1e6c68', '#309686', '#62c4aa', '#a8ecd0'];
const T_CREAM = ['#7a6a58', '#b4a488', '#dcd0b4', '#f6eed8', '#ffffff'];
const T_BRASS = ['#4a2a10', '#8a5414', '#c88a1c', '#ecbc34', '#fff0a0'];

export function tessPortrait(): HTMLCanvasElement {
  const g = grid(P, P);
  // the teal waistcoat over a cream blouse, a high collar and a brass button
  const coat = ell(21, 43, 15, 11);
  fill(g, coat, sphere(T_TEAL, 15, 35, 20, 12, 0.06));
  rimShade(g, coat, T_TEAL[1]);
  const blouse = and(ell(22, 40, 5.5, 10), coat);
  fill(g, blouse, sphere(T_CREAM, 20, 34, 7, 8, 0.12));
  const collar = or(ell(18.5, 32, 4.5, 2.2), ell(26.5, 32.2, 4.2, 2));
  fill(g, collar, sphere(T_CREAM, 18, 30, 10, 4, 0.2));
  rimShade(g, collar, T_CREAM[1]);
  stamp(g, ['ab', 'bc'], { a: T_BRASS[4], b: T_BRASS[3], c: T_BRASS[1] }, 22, 36);
  // the hair swept up into a bun at the back, pinned with a brass gear
  const hair = or(ell(22, 15.5, 10.5, 9.5), ell(17, 21, 5, 5));
  fill(g, hair, sphere(T_HAIR, 17, 9, 15, 14, 0.06, 0.06));
  rimShade(g, hair, T_HAIR[0], 2);
  const bun = ell(11.5, 10, 5, 5);
  fill(g, bun, sphere(T_HAIR, 9.5, 7.5, 6, 6, 0.12));
  rimShade(g, bun, T_HAIR[1]);
  for (const [x, y] of bez([8, 12], [9, 7], [13, 6], [15, 9], 14)) put(g, Math.round(x), Math.round(y), T_HAIR[1]);
  for (const [x, y] of bez([14, 13], [18, 7], [24, 5.5], [30, 8], 30)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), T_HAIR[4]);
  // the gear: a brass ring with teeth and a dark hub
  const gx = 10;
  const gy = 5;
  fill(g, ell(gx + 0.5, gy + 0.5, 3.2, 3.2), sphere(T_BRASS, gx - 1, gy - 1, 4, 4, 0.1));
  for (const [dx, dy] of [
    [0, -4],
    [4, 0],
    [0, 4],
    [-4, 0],
    [3, -3],
    [-3, 3],
    [3, 3],
    [-3, -3],
  ])
    put(g, gx + dx, gy + dy, T_BRASS[2]);
  put(g, gx, gy, T_BRASS[0]);
  // the face: small and sharp, a pointed chin
  const face = and(or(ell(27.5, 20.5, 6.5, 7), ell(28, 25, 4.4, 3.6), ell(34.3, 22, 1.4, 1.6)), (_x, y) => y >= 13.5);
  fill(g, face, sphere(T_SKIN, 26, 17, 9, 10, 0.3));
  rimShade(g, face, T_SKIN[1]);
  fill(g, ell(21.5, 21, 1.6, 2.3), sphere(T_SKIN, 20.5, 20, 2.5, 3, 0.1));
  // the round brass spectacles: two rings, the eyes behind the glass, a glint
  for (const [cx, cy] of [
    [25.5, 20.5],
    [31.5, 20.5],
  ]) {
    for (let a = 0; a < Math.PI * 2; a += 0.2) put(g, Math.round(cx + Math.cos(a) * 2.6 - 0.5), Math.round(cy + Math.sin(a) * 2.6 - 0.5), a > 2.4 && a < 5.4 ? T_BRASS[3] : T_BRASS[1]);
    fill(g, ell(cx, cy, 1.9, 1.9), () => '#e8f6fa');
  }
  put(g, 28, 20, T_BRASS[2]);
  put(g, 29, 20, T_BRASS[2]);
  stamp(g, ['k', 'k'], { k: INK }, 26, 20);
  stamp(g, ['k', 'k'], { k: INK }, 32, 20);
  put(g, 24, 19, '#ffffff');
  put(g, 30, 19, '#ffffff');
  // thin arched brows, a sharp nose, a pursed little mouth, a laugh line
  for (const [x, y] of [
    [23, 16],
    [24, 15],
    [25, 15],
    [26, 15],
    [30, 15],
    [31, 15],
    [32, 15],
  ])
    put(g, x, y, T_HAIR[1]);
  stamp(g, ['.s', 'sS', 'zs'], { s: T_SKIN[3], S: T_SKIN[4], z: T_SKIN[1] }, 34, 21);
  put(g, 30, 26, '#8a3a3a');
  put(g, 31, 26, '#8a3a3a');
  put(g, 32, 25, '#8a3a3a');
  put(g, 28, 24, T_SKIN[1]);
  return toCanvas(g);
}
