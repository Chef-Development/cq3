// Dialogue portraits for the M5 heroes (`portrait_${id}`): 40x40 busts facing right on a transparent background,
// painted like the others in art-story.ts: forms filled as lit volumes (light from the top left, hue-shifted ramps),
// details stamped from small character maps, and toCanvas adds the 1px ink outline. Each face sits where the HUD's
// 18x18 badge window can find both eyes (PORTRAIT_FACE_AT).
import { grid, put, stamp, toCanvas, type Grid, type Pal } from './art';
import { and, bez, ell, fill, not, or, rimShade, sphere, stroke, tone } from './art-paint';
import { fizzPortrait } from './art-hero-fizz';
import { brannPortrait } from './art-hero-brann';

const P = 40;
const INK = '#140c1c';

/** Where each portrait's 18x18 face window sits (top left), for the HUD badge and the hero tabs. */
export const PORTRAIT_FACE_AT: Record<string, [number, number]> = {
  neve: [15, 9],
  moss: [14, 10],
  tam: [15, 9],
  hollis: [14, 9],
  vesper: [15, 9],
  torva: [14, 8],
  // part6:A
  // part6:B
  yara: [15, 9],
  dell: [15, 10],
  // part6:C
  // part6:D
  fizz: [15, 10],
  brann: [15, 11],
};

const SKIN_FAIR = ['#8a4a3a', '#c87a5e', '#eeaa86', '#fcd0b0', '#fff0e0'];

/** A tapered lock or plait: a stroke whose radius runs from r0 to r1, filled from a ramp lit from the top left. */
function lock(g: Grid, pts: Array<[number, number]>, r0: number, r1: number, ramp: string[], bias = 0): void {
  const [x0, y0] = pts[0];
  stroke(g, pts, (t) => r0 + (r1 - r0) * t, sphere(ramp, x0 - 2, y0 - 2, 14, 14, bias));
}

/** Eyes: stamp a map with the given palette. */
const eyes = (g: Grid, rows: string[], pal: Pal, x: number, y: number) => stamp(g, rows, pal, x, y);

// ------------------------------------------------------------------ Neve

const N_HAIR = ['#464a74', '#7a84ae', '#aeb8da', '#dce4f6', '#ffffff'];
const N_ROBE = ['#26306a', '#3a5aa0', '#5a8ad0', '#8ab8ec', '#c0e2fa'];
const N_FUR = ['#6a7aa8', '#a8b8dc', '#dce8fa', '#ffffff'];
const N_ICE = ['#1866a8', '#28a4e4', '#6ad8fa', '#c4f6ff', '#ffffff'];

function neve(): HTMLCanvasElement {
  const g = grid(P, P);
  // the hair's back mass
  const hair = or(ell(20.5, 16.5, 12.5, 12.5), ell(17, 24, 5, 4));
  fill(g, hair, sphere(N_HAIR, 14, 9, 17, 17, -0.02, 0.04));
  rimShade(g, hair, N_HAIR[0], 2);
  // a shine band across the crown
  for (const [x, y] of bez([9, 14], [12, 7], [18, 4.6], [25, 5.4], 18)) {
    put(g, Math.round(x), Math.round(y), N_HAIR[4]);
    put(g, Math.round(x) + 1, Math.round(y) + 1, N_HAIR[3]);
  }
  // strands sweeping back over the crown
  for (const [a, b, c, d] of [
    [[26, 7], [20, 7], [14, 11], [11, 19]],
    [[29, 10], [23, 10], [18, 14], [15, 22]],
  ] as Array<Array<[number, number]>>)
    for (const [x, y] of bez(a, b, c, d, 40)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), N_HAIR[1]);
  // shoulders: the pale-blue robe, the navy sash crossing low, the fur collar
  const robe = ell(21, 42, 16.5, 10);
  fill(g, robe, sphere(N_ROBE, 15, 35, 21, 13, 0.08));
  rimShade(g, robe, N_ROBE[1]);
  for (let x = 6; x <= 36; x++) {
    const y = Math.round(38.6 - (x - 6) * 0.1);
    if (robe(x, y)) {
      put(g, x, y, '#2a3c88');
      put(g, x, y + 1, '#18245a');
    }
  }
  const fur = or(...[11, 15, 19, 23, 27, 31].map((cx, i) => ell(cx, 31.6 + (i % 2) * 0.7, 3.3, 2.9)));
  fill(g, fur, sphere(N_FUR, 14, 28, 16, 6, 0.26));
  rimShade(g, fur, N_FUR[1]);
  // the ice clasp at the collar
  stamp(g, ['.F.', 'FWE', 'ED.'], { F: N_ICE[3], W: '#ffffff', E: N_ICE[2], D: N_ICE[1] }, 23, 31);
  // the face, rounder at the cheek, a small chin
  const face = and(or(ell(27.5, 20, 6.8, 7.4), ell(27.5, 24.5, 5.4, 4.2), ell(34.2, 22.6, 1.3, 1.4)), (_x, y) => y >= 12);
  fill(g, face, sphere(SKIN_FAIR, 26, 17, 9, 10, 0.36));
  rimShade(g, face, SKIN_FAIR[1]);
  // the neck under the chin, in the collar's shadow
  fill(g, and(ell(24, 29, 3.2, 2.4), not(face), not(fur)), () => SKIN_FAIR[1]);
  // the braid over the near shoulder: plaited links with dark seams, a navy tie, a pale tuft
  for (let i = 0; i < 6; i++) {
    const cx = 17 - i * 1.15;
    const cy = 27 + i * 2.2;
    fill(g, ell(cx, cy, 2.6, 1.7), sphere(N_HAIR, cx - 1.3, cy - 1.1, 3.2, 2.4, 0.14));
    put(g, Math.round(cx + 1.6), Math.round(cy + 0.8), N_HAIR[0]);
    put(g, Math.round(cx - 2.2), Math.round(cy + 1), N_HAIR[1]);
  }
  stamp(g, ['nN', 'Nn'], { n: '#2a3c88', N: '#4058b0' }, 9, 38);
  // the fringe: pointed locks over the forehead (each with a shaded edge), a side lock before the ear
  for (const [x0, x1, y1] of [
    [21, 22, 17],
    [24.5, 25.5, 15.5],
    [28, 28.5, 14.5],
    [31.5, 32.5, 15.5],
  ]) {
    lock(g, [[x0, 9], [x1, y1]], 2.3, 0.4, N_HAIR, 0.12);
    for (let y = 11; y < y1 - 1; y++) put(g, Math.round(x0 + ((x1 - x0) * (y - 9)) / (y1 - 9) + 1.6 - (y - 9) * 0.25), y, N_HAIR[1]);
  }
  lock(g, [[20.5, 12], [20, 21], [21, 28]], 2.3, 0.6, N_HAIR, 0.04);
  for (let y = 15; y < 27; y++) put(g, 22, y, N_HAIR[1]);
  // eyes: big ice-blue irises, glints toward the light (the near eye larger)
  const eye: Pal = { k: INK, W: '#ffffff', i: '#3ab8f0', I: '#1a6ab0', j: '#9ae8ff' };
  eyes(g, ['kkkkk', 'kWiik', 'kiIIk', 'kjiIk', '.kkk.'], eye, 23, 17);
  eyes(g, ['kkkk', 'Wiik', 'iIIk', 'jiIk', 'kkk.'], eye, 30, 17);
  // brows, the nose's shadow, the mouth, blush
  for (const [x, y] of [
    [24, 15],
    [25, 15],
    [26, 15],
    [31, 15],
    [32, 15],
  ])
    put(g, x, y, N_HAIR[1]);
  put(g, 34, 24, SKIN_FAIR[2]);
  put(g, 30, 27, '#c86a70');
  put(g, 31, 27, '#c86a70');
  put(g, 24, 23, '#f49aa0');
  put(g, 25, 23, '#f49aa0');
  put(g, 32, 23, '#f49aa0');
  // a snowflake pin in her hair
  stamp(g, ['.F.F.', 'FFEFF', '.EWE.', 'FFEFF', '.F.F.'], { F: N_ICE[1], E: N_ICE[2], W: '#ffffff' }, 12, 8);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Torva

const T_HAIR = ['#4a1018', '#8a2020', '#c83a24', '#ec6a34', '#ffa060'];
const T_SKIN = ['#6a3024', '#a8583a', '#d88a5a', '#f4b47c', '#ffd8a8'];
const T_FUR = ['#3a3640', '#5e5866', '#8a8490', '#b8b2b8', '#e4e0dc'];
const T_LEATHER = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c'];

function torva(): HTMLCanvasElement {
  const g = grid(P, P);
  // the thick braid hanging down her back
  for (let i = 0; i < 7; i++) {
    const cx = 9.5 - i * 0.5;
    const cy = 20 + i * 2.6;
    fill(g, ell(cx, cy, 3.2, 2), sphere(T_HAIR, cx - 1.5, cy - 1.2, 4, 3, i % 2 ? -0.05 : 0.08));
    put(g, Math.round(cx + 2), Math.round(cy + 1), T_HAIR[0]);
  }
  // the neck and the chest above the leather top, a harness strap
  const chest = ell(22, 42, 14, 11);
  fill(g, chest, sphere(T_SKIN, 18, 33, 18, 12, 0.08));
  fill(g, and(chest, (_x, y) => y >= 37), sphere(T_LEATHER, 18, 36, 18, 8, 0.05));
  for (let y = 30; y < 40; y++) {
    const x = Math.round(17 + (y - 30) * 1.2);
    if (chest(x, y)) {
      put(g, x, y, T_LEATHER[3]);
      put(g, x + 1, y, T_LEATHER[1]);
    }
  }
  // the fur mantle: a big scalloped roll over each shoulder
  const furL = or(...[4, 8, 12, 15].map((cx, i) => ell(cx, 34 + (i % 2) * 0.8, 4.2, 4)));
  const furR = or(...[30, 34, 37].map((cx, i) => ell(cx, 35 + (i % 2) * 0.8, 3.8, 3.6)));
  fill(g, furL, sphere(T_FUR, 7, 31, 12, 7, 0.12));
  fill(g, furR, sphere(T_FUR, 31, 32, 9, 6, 0.04));
  rimShade(g, or(furL, furR), T_FUR[1]);
  for (const [x, y] of [
    [6, 33],
    [10, 34],
    [13, 32],
    [32, 34],
    [35, 35],
  ])
    put(g, x, y, T_FUR[4]);
  // the hair, swept back off the forehead
  const hair = or(ell(19.5, 15.5, 12, 11.5), ell(14, 21, 6.5, 6));
  fill(g, hair, sphere(T_HAIR, 14, 8, 17, 16, 0.04, 0.06));
  rimShade(g, hair, T_HAIR[0], 2);
  for (const [a, b, c, d] of [
    [[28, 6], [22, 5], [15, 8], [10, 16]],
    [[29, 9], [23, 8.5], [17, 11], [13, 19]],
    [[25, 4.5], [19, 3.5], [13, 6], [9, 12]],
  ] as Array<Array<[number, number]>>)
    for (const [x, y] of bez(a, b, c, d, 40)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), T_HAIR[1]);
  for (const [x, y] of bez([12, 13], [15, 6], [20, 4.5], [26, 5], 30)) put(g, Math.round(x), Math.round(y), T_HAIR[4]);
  // the face: broad cheeks, a strong jaw
  const face = and(or(ell(27, 19.5, 7.6, 7.6), ell(26.5, 24.5, 6.6, 4.8), ell(34.4, 21.8, 1.4, 1.5)), (_x, y) => y >= 11.5);
  fill(g, face, sphere(T_SKIN, 25, 16, 10, 11, 0.24));
  rimShade(g, face, T_SKIN[1]);
  // the ear
  fill(g, ell(20.5, 20.5, 1.8, 2.6), sphere(T_SKIN, 19.5, 19.5, 3, 3.5, 0.1));
  put(g, 21, 21, T_SKIN[1]);
  // heavy brows, green eyes, freckles
  for (const [x0, x1, y0] of [
    [22, 26, 15],
    [29, 33, 15],
  ])
    for (let x = x0; x <= x1; x++) {
      put(g, x, y0 + (x0 === 22 ? (x > 24 ? 1 : 0) : x < 30 ? 1 : 0), T_HAIR[1]);
    }
  const eye: Pal = { k: INK, W: '#ffffff', g: '#3aa04a', G: '#1e6a34', w: '#e8dcd0' };
  eyes(g, ['kkkk', 'WgGk', 'wGkk', '.kk.'], eye, 23, 17);
  eyes(g, ['kkk', 'WgG', 'wGk'], eye, 30, 17);
  for (const [x, y] of [
    [24, 22],
    [26, 23],
    [25, 21],
    [30, 22],
    [32, 21],
    [31, 23],
    [28, 21],
  ])
    put(g, x, y, '#b45a3a');
  // the nose's shade, a wide grin
  put(g, 34, 23, T_SKIN[2]);
  stamp(g, ['xxxxxx', 'xWWWWx', '.xxxx.'], { x: '#5a1a1a', W: '#fff4e8' }, 26, 25);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Hollis

const H_SKIN = ['#2a1410', '#4a2618', '#6e3e26', '#925a38', '#b47a50'];
const H_BLACK = ['#0e0a14', '#1e1824', '#2e2834', '#463e4c', '#5e5464'];
const H_STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const H_BLUE = ['#10204a', '#1a3c8a', '#2a5ac0', '#4a84e0', '#8ab8f4'];

function hollis(): HTMLCanvasElement {
  const g = grid(P, P);
  // the blue surcoat, a gorget, and big steel pauldrons
  const coat = ell(21, 42, 15, 10);
  fill(g, coat, sphere(H_BLUE, 16, 35, 20, 12, 0.04));
  rimShade(g, coat, H_BLUE[1]);
  fill(g, and(coat, (x) => x === 22 || x === 23), (x) => (x === 22 ? '#ffffff' : '#c8d4e8'));
  const gorget = and(ell(22, 31, 8.5, 3.6), (_x, y) => y >= 28.5);
  fill(g, gorget, sphere(H_STEEL, 19, 29, 10, 4, 0.04));
  for (const [cx, rx] of [
    [6, 7.5],
    [36, 6.5],
  ]) {
    const pad = ell(cx, 35.5, rx, 6);
    fill(g, pad, sphere(H_STEEL, cx - 2.5, 32.5, rx + 1.5, 7, 0.06));
    rimShade(g, pad, H_STEEL[1]);
    // a rivet and a lit rim
    put(g, Math.round(cx - 1), 33, H_STEEL[4]);
    fill(g, and(pad, not(ell(cx, 36.6, rx, 6))), () => H_STEEL[3]);
  }
  // the head: a close-cropped skull
  const skull = or(ell(22.5, 18, 10.5, 11.5), ell(27, 22.5, 7.8, 7.2));
  fill(g, skull, sphere(H_SKIN, 24, 15, 11, 12, 0.3));
  rimShade(g, skull, H_SKIN[1]);
  // the cropped hair: a cap over the crown and the back of the head
  const cap = and(skull, (x, y) => y < 13.5 - (x - 22) * 0.35 || (x < 19 && y < 22 - (19 - x) * 0.3));
  fill(g, cap, sphere(H_BLACK, 17, 9, 14, 12, 0.12));
  for (const [x, y] of [
    [16, 9],
    [19, 8],
    [22, 7],
    [14, 13],
    [17, 12],
  ])
    put(g, x, y, H_BLACK[4]);
  // the ear
  fill(g, ell(19.5, 20.5, 1.9, 2.7), sphere(H_SKIN, 18.5, 19.5, 3, 3.5, 0.12));
  put(g, 20, 21, H_SKIN[1]);
  // the beard: along the jaw, round the chin, a moustache
  const beard = and(or(ell(27, 27, 8.5, 4.5), ell(21.5, 24, 2.6, 4)), skull, (_x, y) => y >= 22.5);
  fill(g, beard, sphere(H_BLACK, 23, 24, 12, 7, 0.08));
  fill(g, and(ell(30, 25, 4.5, 1.2), skull), () => H_BLACK[2]);
  // the mouth in the beard
  put(g, 29, 26, '#4a1a1a');
  put(g, 30, 26, '#6a2a24');
  put(g, 31, 26, '#4a1a1a');
  // brows and dark eyes, the nose
  for (let x = 23; x <= 26; x++) put(g, x, 16, H_BLACK[0]);
  for (let x = 30; x <= 32; x++) put(g, x, 16, H_BLACK[0]);
  for (let x = 24; x <= 25; x++) put(g, x, 15, H_BLACK[2]);
  const eye: Pal = { k: INK, W: '#fff8f0', b: '#6a3a24', w: '#d8ccc4' };
  eyes(g, ['kkkk', 'WWbk', 'wbbk'], eye, 23, 17);
  eyes(g, ['kkk', 'Wbk', 'wbk'], eye, 30, 17);
  // the cheekbone and brow catching the light
  put(g, 27, 20, H_SKIN[4]);
  put(g, 28, 20, H_SKIN[4]);
  put(g, 22, 13, H_SKIN[4]);
  put(g, 23, 13, H_SKIN[4]);
  put(g, 34, 21, H_SKIN[3]);
  put(g, 34, 22, H_SKIN[2]);
  put(g, 33, 23, H_SKIN[1]);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Vesper

const V_HAIR = ['#0c0c16', '#181a2a', '#262a40', '#3a4262', '#5e6a92'];
const V_CLOAK = ['#1e1236', '#33205a', '#4e3480', '#6e4ea6', '#9a78c8'];
const V_GOLD = ['#7a4a10', '#c08020', '#f2c040', '#fff0a0'];
const V_GREEN = ['#0e1e1a', '#18302a', '#24483a', '#38644a', '#5a8a5a'];

function vesper(): HTMLCanvasElement {
  const g = grid(P, P);
  // the quiver's white fletchings over her shoulder
  for (const [x, y] of [
    [5, 22],
    [8, 20],
    [11, 21],
  ]) {
    stamp(g, ['W.', 'Ww', 'wv', '.v'], { W: '#ffffff', w: '#e0dcec', v: '#a89cbc' }, x, y);
    for (let k = 4; k < 10; k++) put(g, x + 1 - Math.floor(k / 4), y + k, '#9a643c');
  }
  // the hair's tail flicking out behind
  lock(g, [[13, 17], [8, 19], [4, 24]], 3, 0.8, V_HAIR, 0.1);
  // the cloak: the hood down in folds round her shoulders, lined with gold; the green tunic at the throat
  const cloak = ell(20.5, 42, 17, 11);
  fill(g, cloak, sphere(V_CLOAK, 14, 34, 22, 14, 0.06));
  rimShade(g, cloak, V_CLOAK[1]);
  const hood = or(ell(12, 33, 8, 4.2), ell(31, 33.5, 7, 3.8));
  fill(g, hood, sphere(V_CLOAK, 12, 30, 14, 6, 0.14));
  for (let x = 4; x <= 38; x++) {
    let y = 26;
    while (y < 40 && !hood(x, y)) y++;
    if (y < 40) put(g, x, y, x < 20 ? V_GOLD[3] : V_GOLD[2]);
  }
  const tunic = and(ell(22.5, 39, 5.5, 8), not(hood));
  fill(g, tunic, sphere(V_GREEN, 20, 34, 8, 8, 0.1));
  stamp(g, ['GgY', 'gYz'], { G: V_GOLD[3], g: V_GOLD[2], Y: V_GOLD[1], z: V_GOLD[0] }, 21, 33);
  // the head: dark hair swept back
  const hair = or(ell(20.5, 16, 11.5, 11.5), ell(15, 20, 5.5, 5));
  fill(g, hair, sphere(V_HAIR, 15, 9, 16, 16, 0.08, 0.06));
  rimShade(g, hair, V_HAIR[0], 2);
  for (const [x, y] of bez([11, 14], [14, 6], [20, 4.5], [27, 5.5], 30)) put(g, Math.round(x), Math.round(y), V_HAIR[4]);
  for (const [x, y] of bez([28, 8], [22, 7.5], [16, 10], [12, 17], 30)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), V_HAIR[3]);
  // the face: fine-boned, a pointed chin
  const face = and(or(ell(27.5, 19.5, 6.8, 7.2), ell(28, 24.5, 4.6, 4), ell(34.3, 21.7, 1.2, 1.4)), (_x, y) => y >= 11.5);
  fill(g, face, sphere(SKIN_FAIR, 26, 16, 9, 10, 0.3));
  rimShade(g, face, SKIN_FAIR[1]);
  // a lock of hair swept across the brow
  lock(g, [[21, 11], [27, 12], [31, 15]], 1.8, 0.5, V_HAIR, 0.12);
  // the long pointed ear, reaching up and back
  const ear = (x: number, y: number) => {
    const t = (21.5 - x) / 9; // 0 at the base, 1 at the tip
    if (t < 0 || t > 1) return false;
    const cy = 20 - t * 8;
    return Math.abs(y + 0.5 - cy) <= 2.4 * (1 - t) + 0.5;
  };
  fill(g, ear, (x, y) => (y + 0.5 < 20 - ((21.5 - x) / 9) * 8 - 0.6 ? SKIN_FAIR[4] : y + 0.5 > 20 - ((21.5 - x) / 9) * 8 + 1 ? SKIN_FAIR[1] : SKIN_FAIR[3]));
  put(g, 19, 19, SKIN_FAIR[1]);
  put(g, 18, 18, SKIN_FAIR[1]);
  // sharp brows, narrow amber eyes, a smirk
  for (const [x, y] of [
    [23, 16],
    [24, 15],
    [25, 15],
    [26, 15],
    [30, 15],
    [31, 15],
    [32, 16],
  ])
    put(g, x, y, V_HAIR[1]);
  const eye: Pal = { k: INK, W: '#ffffff', a: '#f2c040', A: '#b07018' };
  eyes(g, ['kkkkk', 'kWaAk', '.kkk.'], eye, 22, 17);
  eyes(g, ['kkkk', 'WaAk', '.kk.'], eye, 30, 17);
  put(g, 34, 23, SKIN_FAIR[2]);
  put(g, 29, 26, '#a04a4a');
  put(g, 30, 26, '#a04a4a');
  put(g, 31, 25, '#a04a4a');
  return toCanvas(g);
}

// ------------------------------------------------------------------ Tam

const TM_SKIN = ['#6a3424', '#a8603e', '#d8925e', '#f4c08a', '#ffe0b8'];
const TM_ORANGE = ['#5a1a10', '#a03a14', '#e0661c', '#ff9a3a', '#ffcc78'];
const TM_BRASS = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const TM_SHIRT = ['#5a5250', '#8a807a', '#beb4a8', '#e8e0d0'];
const TM_APRON = ['#2e1a14', '#4e2c1c', '#74442a', '#9a643c', '#c08a58'];
const TM_HAIR = ['#1e120e', '#3a2418', '#5a3a24', '#7a5034'];

function tam(): HTMLCanvasElement {
  const g = grid(P, P);
  // shoulders: the shirt, the apron's bib and strap, the satchel's strap across
  const shirt = ell(21, 42, 15.5, 10);
  fill(g, shirt, sphere(TM_SHIRT, 15, 34, 20, 12, 0.06));
  rimShade(g, shirt, TM_SHIRT[1]);
  const bib = and(shirt, (x) => x >= 22 && x <= 32);
  fill(g, bib, sphere(TM_APRON, 24, 34, 10, 8, 0.08));
  for (const [x, y] of [
    [24, 37],
    [25, 37],
    [28, 37],
    [29, 37],
  ])
    put(g, x, y, TM_APRON[4]);
  for (let x = 6; x <= 21; x++) {
    const y = Math.round(31 + (x - 6) * 0.45);
    if (shirt(x, y)) {
      put(g, x, y, TM_APRON[3]);
      put(g, x, y + 1, TM_APRON[1]);
    }
  }
  // the neck
  fill(g, and(ell(24, 30, 4, 3), not(bib)), () => TM_SKIN[1]);
  // messy hair poking out under the bandana
  const mess = or(ell(13, 20, 5.5, 6), ell(16, 25, 4, 3));
  fill(g, mess, sphere(TM_HAIR, 11, 17, 8, 8, 0.1));
  for (const [x, y] of [
    [8, 23],
    [9, 25],
    [11, 26],
    [7, 20],
  ])
    put(g, x, y, TM_HAIR[1]);
  // the face: round, sooty, cheeky
  const face = and(or(ell(26.5, 20.5, 7.4, 7.6), ell(26.5, 25, 6, 4.4), ell(34.2, 22.4, 1.4, 1.5)), (_x, y) => y >= 12);
  fill(g, face, sphere(TM_SKIN, 25, 17, 10, 11, 0.26));
  rimShade(g, face, TM_SKIN[1]);
  fill(g, ell(19.8, 21, 1.8, 2.6), sphere(TM_SKIN, 19, 20, 3, 3.5, 0.12));
  // soot smudges
  for (const [x, y, c] of [
    [23, 23, '#b07858'],
    [24, 23, '#9a6a50'],
    [25, 23, '#b07858'],
    [24, 24, '#b07858'],
    [32, 21, '#b88060'],
    [33, 21, '#a07058'],
    [21, 17, '#a07058'],
    [22, 17, '#b88060'],
  ] as Array<[number, number, string]>)
    put(g, x, y, c);
  // the bandana: a cap of orange cloth, its knot and two tails at the back
  const band = and(or(ell(20.5, 14, 12, 9.5), ell(14, 17, 6.5, 6)), (x, y) => y < 15.5 - (x - 20) * 0.05 || x < 17 && y < 19);
  fill(g, band, sphere(TM_ORANGE, 15, 7, 16, 12, 0.08));
  rimShade(g, band, TM_ORANGE[1]);
  for (const [x, y] of [
    [12, 10],
    [16, 7],
    [21, 6],
  ])
    put(g, x, y, TM_ORANGE[4]);
  fill(g, or(ell(6.5, 16, 2.5, 1.8), ell(5, 20, 1.8, 2.6)), sphere(TM_ORANGE, 5, 15, 4, 4, 0.04));
  // the goggles pushed up on the bandana: two brass rims with green glass, a glint each
  for (const [cx, r] of [
    [24, 3.4],
    [31.5, 3],
  ]) {
    fill(g, ell(cx, 11.5, r + 1, r + 0.8), (x, y) => tone(TM_BRASS, 0.85 - (x - cx) * 0.09 - (y - 11.5) * 0.12));
    fill(g, ell(cx, 11.5, r - 0.3, r - 0.4), (x, y) => (x + y < cx + 11.5 - 1 ? '#c8fff0' : x + y < cx + 11.5 + 1.5 ? '#5ac8b4' : '#2a7a70'));
    put(g, Math.round(cx - 1.4), 10, '#ffffff');
  }
  put(g, 28, 11, TM_BRASS[1]);
  put(g, 28, 12, TM_BRASS[1]);
  // brows, eyes, a gap-toothed grin
  for (let x = 23; x <= 25; x++) put(g, x, 16, TM_HAIR[1]);
  for (let x = 30; x <= 32; x++) put(g, x, 16, TM_HAIR[1]);
  const eye: Pal = { k: INK, W: '#ffffff', b: '#4a3020' };
  eyes(g, ['Wbk', 'bkk', '.k.'], eye, 23, 18);
  eyes(g, ['Wb', 'bk'], eye, 30, 18);
  put(g, 34, 23, TM_SKIN[2]);
  stamp(g, ['xxxxx', 'xWxWx', '.xxx.'], { x: '#5a1a1a', W: '#fff4e8' }, 27, 25);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Moss

const M_LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];
const M_HAIR = ['#7a7468', '#aea696', '#d8d0be', '#f4efe2', '#ffffff'];
const M_SKIN = ['#8a4a34', '#c47a54', '#eaa878', '#ffd0a4', '#fff0dc'];
const M_NOSE = ['#a04a44', '#d0705c', '#f49a80', '#ffc4a8', '#ffe4d4'];
const M_BARK = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44'];

function moss(): HTMLCanvasElement {
  const g = grid(P, P);
  // the leaf cloak: rows of overlapping leaves round his shoulders
  const cloak = ell(20.5, 42, 17, 12);
  for (let y = 28; y < P; y++)
    for (let x = 0; x < P; x++) {
      if (!cloak(x, y)) continue;
      const band = Math.floor((y - 28) / 3);
      const v = (y - 28) % 3;
      const u = (x + (band % 2 ? 2 : 0)) % 5;
      let t = v === 0 ? (u === 1 || u === 2 ? 4 : 3) : v === 1 ? (u === 4 ? 2 : 3) : u === 1 || u === 2 ? 3 : 1;
      if (v === 0 && u === 1) t = 5;
      if (x < 14) t += 1;
      else if (x > 28) t -= 1;
      put(g, x, y, M_LEAF[Math.max(1, Math.min(5, t))]);
    }
  // the head: fluffy white hair in puffs round the back and top, a beard of puffs under the face
  const puffs: Array<[number, number, number]> = [
    [11, 12, 4.6],
    [15, 7.5, 4.8],
    [21, 6, 4.8],
    [27, 7.5, 4.2],
    [9, 18, 4.6],
    [11, 24, 4.4],
    [15, 28, 4],
    [17, 14, 6],
    [15, 21, 5.5],
    [21, 29, 3.6],
    [26, 30, 3.6],
    [31, 29, 3.4],
    [34.5, 26.5, 2.6],
  ];
  const fluff = or(...puffs.map(([x, y, r]) => ell(x, y, r, r * 0.92)));
  // each puff lit as its own ball, so the curls read where they overlap
  for (const [x, y, r] of puffs) fill(g, ell(x, y, r, r * 0.92), sphere(M_HAIR, x - r * 0.4, y - r * 0.45, r * 1.25, r * 1.2, 0.18, 0.05));
  rimShade(g, fluff, M_HAIR[1]);
  // the round face
  const face = and(or(ell(27.5, 19.5, 8, 7), ell(26.5, 23.5, 6.5, 3.5)), (_x, y) => y >= 12.5);
  fill(g, face, sphere(M_SKIN, 25, 16, 10, 9, 0.32));
  rimShade(g, face, M_SKIN[1]);
  // bushy white brows over small bright eyes
  for (const [cx, cy] of [
    [24.5, 15.2],
    [30.8, 15.2],
  ])
    fill(g, ell(cx, cy, 2.8, 1.4), sphere(M_HAIR, cx - 1, cy - 1, 3.5, 2, 0.15));
  const eye: Pal = { k: INK, W: '#ffffff' };
  eyes(g, ['kW', 'kk', 'kk'], eye, 24, 17);
  eyes(g, ['kW', 'kk', 'kk'], eye, 30, 17);
  put(g, 22, 21, '#f49a90');
  put(g, 23, 21, '#f49a90');
  // the moustache sweeping out under the nose
  fill(g, or(ell(26, 25.8, 4, 1.8), ell(32.5, 25.8, 3.2, 1.6)), sphere(M_HAIR, 25, 24.5, 8, 3, 0.2));
  // the big soft nose: a round rosy bulb poking past the face, a glint on top
  const nose = ell(32, 22, 4.4, 3.8);
  fill(g, nose, sphere(M_NOSE, 30.5, 20, 5.5, 5, 0.12));
  rimShade(g, nose, M_NOSE[0]);
  put(g, 30, 20, M_NOSE[4]);
  put(g, 31, 20, M_NOSE[3]);
  // the twig crown: a band of twigs round the hair, three prongs, two buds (green, pink)
  for (let x = 10; x <= 30; x++) {
    const y = Math.round(9.5 + ((x - 20) / 11) ** 2 * 3);
    put(g, x, y, x < 20 ? M_BARK[4] : M_BARK[3]);
    put(g, x, y + 1, M_BARK[1]);
  }
  for (const [x0, y0, x1, y1] of [
    [13, 10, 10, 4],
    [20, 9, 21, 3],
    [27, 10, 30, 4.5],
  ]) {
    stroke(g, [[x0, y0], [x1, y1]], 0.7, () => M_BARK[3]);
    const mx = Math.round((x0 + x1) / 2);
    const my = Math.round((y0 + y1) / 2);
    put(g, mx - 1, my - 1, M_BARK[4]);
    put(g, mx + 1, my, M_BARK[1]);
  }
  fill(g, ell(10, 3, 1.9, 1.9), sphere(['#2e5a32', '#4a7e36', '#78a83c', '#c8f070', '#f0ffc0'], 9, 2, 2.6, 2.6, 0.1));
  fill(g, ell(30.5, 3.5, 1.9, 1.9), sphere(['#8a3050', '#c85078', '#f08aac', '#ffc0d4', '#fff0f4'], 29.5, 2.5, 2.6, 2.6, 0.1));
  return toCanvas(g);
}

// ------------------------------------------------------------------ Yara (Part 6)

const Y_SKIN = ['#4a2418', '#7a4228', '#a8643c', '#cc8a58', '#e8ae7c'];
const Y_HAIR = ['#0e0a14', '#1c1424', '#2c2036', '#40304c', '#5e4a6c'];
const Y_SHAWL = ['#120c30', '#1e1a5a', '#2c2c8c', '#4042b8', '#6a6ede'];
const Y_TUNIC = ['#7a7a9e', '#aaaacc', '#d6d6ea', '#f2f2fa', '#ffffff'];
const Y_SPIRIT = ['#1a6a8a', '#3ab4d8', '#7ae4f8', '#c4f8ff', '#ffffff'];
const Y_BEADS = ['#f08a30', '#3ac8b8', '#f2c230', '#d84a3a'];

function yara(): HTMLCanvasElement {
  const g = grid(P, P);
  // the braid falling behind her shoulder, threaded with beads
  for (let i = 0; i < 7; i++) {
    const cx = 10.5 - i * 0.6;
    const cy = 19 + i * 2.6;
    fill(g, ell(cx, cy, 2.6, 1.7), sphere(Y_HAIR, cx - 1.2, cy - 1, 3.4, 2.6, i % 2 ? -0.04 : 0.1));
    if (i % 2 === 1) put(g, Math.round(cx + 1), Math.round(cy), Y_BEADS[(i >> 1) % 4]);
  }
  // the shawl round her shoulders (indigo, star specks), the white tunic at the throat
  const shawl = ell(21, 42, 17, 11);
  fill(g, shawl, sphere(Y_SHAWL, 14, 34, 22, 14, 0.06));
  rimShade(g, shawl, Y_SHAWL[1]);
  // (a V of it between the shawl's edges)
  const tunic = and(ell(23, 41, 5, 9), (x, y) => y >= 32 && Math.abs(x + 0.5 - 23) <= (y - 30) * 0.9);
  fill(g, tunic, sphere(Y_TUNIC, 20, 33, 9, 9, 0.02));
  // the shawl's edges crossing over the tunic
  for (let y = 32; y < 40; y++) {
    put(g, 17 + Math.round((y - 32) * 0.4), y, Y_SHAWL[3]);
    put(g, 29 - Math.round((y - 32) * 0.3), y, Y_SHAWL[2]);
  }
  for (const [x, y] of [
    [9, 35],
    [13, 33],
    [6, 38],
    [33, 35],
    [36, 38],
    [11, 38],
  ])
    put(g, x, y, '#fff6d8');
  put(g, 30, 33, '#b8bcff');
  // the head: dark hair with soft bangs
  const hair = or(ell(20.5, 16, 11.5, 11.5), ell(15, 20, 5.5, 5.5));
  fill(g, hair, sphere(Y_HAIR, 15, 9, 16, 16, 0.08, 0.06));
  rimShade(g, hair, Y_HAIR[0], 2);
  for (const [x, y] of bez([11, 14], [14, 6], [20, 4.5], [27, 5.5], 30)) put(g, Math.round(x), Math.round(y), Y_HAIR[4]);
  for (const [x, y] of bez([28, 8], [22, 7.5], [16, 10], [12, 17], 30)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), Y_HAIR[3]);
  // the face: soft, a rounded chin
  const face = and(or(ell(27.5, 20, 6.8, 7.2), ell(27.5, 24.5, 5, 4), ell(34.2, 22, 1.2, 1.4)), (_x, y) => y >= 12);
  fill(g, face, sphere(Y_SKIN, 26, 16, 9, 10, 0.28));
  rimShade(g, face, Y_SKIN[1]);
  // bangs over the brow
  lock(g, [[21, 11], [26, 12.5], [30, 14]], 2, 0.6, Y_HAIR, 0.1);
  lock(g, [[25, 10], [30, 11], [33, 14]], 1.4, 0.5, Y_HAIR, 0.14);
  // the ear, a bead string hanging from the temple
  fill(g, ell(20.5, 21, 1.6, 2.4), sphere(Y_SKIN, 19.5, 20, 3, 3.5, 0.1));
  for (let k = 0; k < 5; k++) put(g, 20, 23 + k, k % 2 ? Y_BEADS[k % 4] : '#c8b89a');
  // brows, warm brown eyes, a calm smile
  for (const [x, y] of [
    [23, 16],
    [24, 15],
    [25, 15],
    [30, 15],
    [31, 15],
    [32, 16],
  ])
    put(g, x, y, Y_HAIR[1]);
  const eye: Pal = { k: INK, W: '#ffffff', a: '#7a3a1e', A: '#4a200e' };
  eyes(g, ['kkkk', 'WaAk', '.kk.'], eye, 23, 17);
  eyes(g, ['kkk', 'WaA', '.kk'], eye, 30, 17);
  put(g, 34, 23, Y_SKIN[2]);
  for (const [x, y] of [
    [28, 26],
    [29, 26],
    [30, 26],
    [27, 25],
  ])
    put(g, x, y, '#7a2a2a');
  // spirit-light: a mote drifting by her shoulder
  for (const [dx, dy, c] of [
    [0, 0, Y_SPIRIT[4]],
    [1, 0, Y_SPIRIT[3]],
    [-1, 0, Y_SPIRIT[3]],
    [0, 1, Y_SPIRIT[3]],
    [0, -1, Y_SPIRIT[3]],
    [2, 2, Y_SPIRIT[2]],
  ] as Array<[number, number, string]>)
    put(g, 36 + dx, 29 + dy, c);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Dell (Part 6)

const D_SKIN = ['#8a4a3a', '#c87a5e', '#eeaa86', '#fcd0b0', '#fff0e0'];
const D_STRAW = ['#5a3a10', '#9a6a18', '#d0a030', '#f2cc5a', '#fff0a0'];
const D_DENIM = ['#141e44', '#22366a', '#345496', '#4c76bc', '#78a0e0'];
const D_RED = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
const D_HAIR = ['#4a1a0e', '#8a3a1a', '#c0602e', '#e08a48', '#f8b070'];
const D_SHIRT = ['#7a6a52', '#b8a888', '#e4d6b4', '#fbf2dc'];

function dell(): HTMLCanvasElement {
  const g = grid(P, P);
  // the shoulders: a cream shirt, the overalls' bib and straps, a brass button
  const shirt = ell(21, 43, 16, 11);
  fill(g, shirt, sphere(D_SHIRT, 14, 35, 22, 13, 0.1));
  rimShade(g, shirt, D_SHIRT[1]);
  const bib = and(ell(23, 44, 9, 10), (_x, y) => y >= 35);
  fill(g, bib, sphere(D_DENIM, 20, 37, 12, 9, 0.12));
  for (const sx of [15, 30])
    for (let y = 31; y < 40; y++) {
      put(g, sx + Math.round((y - 31) * (sx < 20 ? 0.35 : -0.3)), y, D_DENIM[3]);
      put(g, sx + 1 + Math.round((y - 31) * (sx < 20 ? 0.35 : -0.3)), y, D_DENIM[2]);
    }
  stamp(g, ['ab', 'bc'], { a: '#fff0a0', b: '#f2c230', c: '#9a5a14' }, 18, 37);
  stamp(g, ['ab', 'bc'], { a: '#fff0a0', b: '#f2c230', c: '#9a5a14' }, 28, 37);
  // the red neckerchief knotted at the throat
  const scarf = or(ell(23, 32, 7, 2.6), ell(23, 35, 2.6, 2.4));
  fill(g, scarf, sphere(D_RED, 20, 30, 9, 5, 0.1));
  rimShade(g, scarf, D_RED[1]);
  // ginger hair under the hat
  const hair = or(ell(20, 18, 10.5, 9), ell(15, 22, 5, 5));
  fill(g, hair, sphere(D_HAIR, 15, 13, 14, 12, 0.06));
  rimShade(g, hair, D_HAIR[0]);
  // the face: round cheeks, a snub nose
  const face = and(or(ell(27, 21, 7.2, 7.2), ell(27, 25.5, 5.6, 3.8), ell(34, 22.8, 1.4, 1.4)), (_x, y) => y >= 13);
  fill(g, face, sphere(D_SKIN, 25, 17, 9, 10, 0.3));
  rimShade(g, face, D_SKIN[1]);
  fill(g, ell(20.5, 21.5, 1.8, 2.5), sphere(D_SKIN, 19.5, 20.5, 3, 3.5, 0.12));
  put(g, 21, 22, D_SKIN[1]);
  // tufts poking out at the brow
  for (const [x, y] of [
    [22, 14],
    [24, 15],
    [21, 15],
    [26, 14],
  ])
    put(g, x, y, D_HAIR[3]);
  // big green eyes, freckles, a gap-toothed grin
  const eye: Pal = { k: INK, W: '#ffffff', a: '#3aa04a', A: '#1e6a34' };
  eyes(g, ['.kk.', 'kWak', 'kaAk', '.kk.'], eye, 22, 17);
  eyes(g, ['.kk', 'kWa', 'kaA', '.kk'], eye, 30, 17);
  for (const [x, y] of [
    [23, 22],
    [25, 23],
    [24, 21],
    [30, 22],
    [32, 21],
    [31, 23],
    [27, 22],
  ])
    put(g, x, y, '#c8704a');
  put(g, 34, 23, D_SKIN[2]);
  stamp(g, ['xxxxx', 'xW.Wx', '.xxx.'], { x: '#8a3030', W: '#fff4e8', '.': '#c05050' }, 26, 25);
  // the straw hat: a domed crown with a red band, a wide brim tilted back
  const crown = ell(21, 7.5, 8, 5.5);
  fill(g, crown, sphere(D_STRAW, 17, 4, 11, 7, 0.1));
  rimShade(g, crown, D_STRAW[1]);
  for (let x = 13; x <= 29; x++) {
    put(g, x, 11, x % 2 ? D_RED[2] : D_RED[3]);
    put(g, x, 12, D_RED[1]);
  }
  const brim = ell(21, 13.5, 17, 3);
  fill(g, and(brim, (_x, y) => y >= 12), (x, y) => (y <= 13 ? ((x + y) % 2 ? D_STRAW[3] : D_STRAW[4]) : (x + y) % 2 ? D_STRAW[2] : D_STRAW[1]));
  // the weave: a few darker strands across the crown
  for (let x = 15; x <= 27; x += 3) put(g, x, 7, D_STRAW[2]);
  for (let x = 16; x <= 26; x += 3) put(g, x, 9, D_STRAW[2]);
  return toCanvas(g);
}

// ------------------------------------------------------------------ build

export function buildHeroPortraits(add: (key: string, c: HTMLCanvasElement) => void): void {
  add('portrait_neve', neve());
  add('portrait_moss', moss());
  add('portrait_tam', tam());
  add('portrait_hollis', hollis());
  add('portrait_vesper', vesper());
  add('portrait_torva', torva());
  // part6:A
  // part6:B
  add('portrait_yara', yara());
  add('portrait_dell', dell());
  // part6:C
  // part6:D
  add('portrait_fizz', fizzPortrait());
  add('portrait_brann', brannPortrait());
}
