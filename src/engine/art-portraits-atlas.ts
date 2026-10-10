// The Atlas's people (docs/story-bible.md section 4): `portrait_mapmaker` (Ambrose Fairhand, the Mapmaker) and
// `portrait_keeper` (High Keeper Hesper). 40x40 busts on a transparent background, painted like the others
// (art-story.ts, art-hero-portraits.ts): lit volumes from the top left, hue-shifted ramps, details stamped, toCanvas
// adds the ink outline. Both stand on the right of a scene and face left (into it): the face on the left half, the
// near eye at x 12-15 and the far one at x 7-9 on the shared eye line (y 17), the near ear at x 19.
import { grid, put, stamp, toCanvas, type Pal } from './art';
import { and, bez, ell, fill, INK, not, or, portraitMood, rimShade, sphere, stroke } from './art-paint';

const P = 40;

// ------------------------------------------------------------------ the Mapmaker

/** His coat: keeper's blue, faded grey by fifteen years at the edge of the map. */
const M_COAT = ['#1a2034', '#283652', '#3a5070', '#566e8a', '#7e94a8', '#a8b8c4'];
/** Where the badge was torn off the cloth kept its old, unfaded blue. */
const M_UNFADED = ['#1e3260', '#2a4a88', '#3a62a8'];
const M_HAIR = ['#1c1824', '#2c2634', '#3e3648', '#564c60', '#72687c'];
const M_BEARD = ['#2c2634', '#463e4e', '#6a6274', '#8e8a9c'];
const M_SILVER = ['#8a8698', '#b8b6c6', '#e0dee8'];
const M_SKIN = ['#5a2e26', '#9a5a44', '#c8866a', '#e8aa88', '#f8ccaa'];
const M_LEATHER = ['#2e1a10', '#4e2e1a', '#74482a', '#9a6a3e'];
const PARCH = ['#6e4a2a', '#a8804e', '#d2b07a', '#ead2a0', '#f8ecc8'];
/** The Atlas's ink (line, wash): on his fingers and his cheek. */
const ATLAS_INK = ['#1a1026', '#2e2240', '#4a3a5e'];
/** A barred owl's feather: brown-grey bars on cream. */
const OWL = ['#3a2a20', '#6a5440', '#9a8468', '#c8b89a', '#ece2cc'];

function mapmaker(): HTMLCanvasElement {
  const g = grid(P, P);
  // rolled maps standing up out of the satchel behind his near shoulder: paper cylinders, their ends curled
  for (const [x0, y0, x1, y1, r] of [
    [29, 36, 33.5, 19, 2.1],
    [34, 37, 37.5, 24, 1.8],
  ]) {
    stroke(g, [[x0, y0], [x1, y1]], r, (x) => (x < x1 - 0.6 ? PARCH[4] : x < x1 + 0.8 ? PARCH[3] : PARCH[2]));
    fill(g, ell(x1, y1 - 0.4, r + 0.3, 1.5), (x) => (x < x1 - 0.5 ? PARCH[4] : PARCH[3]));
    put(g, Math.round(x1 - 0.5), Math.round(y1 - 0.9), PARCH[1]);
    put(g, Math.round(x1 + 0.5), Math.round(y1 - 0.9), PARCH[0]);
    // the map's ink showing through near the curl
    put(g, Math.round(x1 - 1), Math.round(y1 + 3), ATLAS_INK[2]);
    put(g, Math.round(x1), Math.round(y1 + 4), ATLAS_INK[2]);
  }
  // the tail of his hair, tied at the nape, short
  stroke(g, bez([23.5, 19], [25.5, 21], [26.2, 23], [26, 26], 8), (t) => 1.7 - t * 0.8, sphere(M_HAIR, 23, 19, 5, 7, 0.1));
  put(g, 25, 22, M_SILVER[0]);
  put(g, 26, 24, M_SILVER[0]);
  stamp(g, ['lL', 'LL'], { l: M_LEATHER[3], L: M_LEATHER[1] }, 23, 19);
  // the coat: long, high-collared, a little too big for him now
  const coat = ell(20, 43, 17.5, 11.5);
  fill(g, coat, sphere(M_COAT, 13, 35, 22, 13, 0.06));
  rimShade(g, coat, M_COAT[1]);
  // the shirt in the coat's open front, the coat's lapel edges catching the light
  const shirt = and(coat, (x, y) => y >= 31 && Math.abs(x - 14.5) <= (y - 30) * 0.55);
  fill(g, shirt, (x) => (x < 14 ? '#e6dcc8' : '#b8ac98'));
  for (let y = 31; y < 40; y++) {
    const w = Math.round((y - 30) * 0.55);
    put(g, Math.round(14.5 - w) - 1, y, M_COAT[5]);
    put(g, Math.round(14.5 + w) + 1, y, M_COAT[1]);
  }
  // the high collar standing round the neck
  const collar = and(or(ell(11, 30, 3.4, 3.2), ell(19, 29.5, 3.6, 3.4)), (_x, y) => y >= 26.5);
  fill(g, collar, sphere(M_COAT, 9, 27, 8, 5, 0.12));
  rimShade(g, collar, M_COAT[1]);
  // where his keeper's badge was: a patch of unfaded blue, loose threads at its edges
  stamp(g, ['tbbbt', 'bBBBb', 'bBBcb', '.t.t.'], { b: M_UNFADED[1], B: M_UNFADED[2], c: M_UNFADED[0], t: '#c8a050' }, 22, 35);
  // the satchel strap across his chest from the near shoulder, a brass buckle
  for (let x = 6; x <= 30; x++) {
    const y = Math.round(40 - (x - 6) * 0.36);
    if (!coat(x, y + 1) && !coat(x, y)) continue;
    put(g, x, y, M_LEATHER[3]);
    put(g, x, y + 1, M_LEATHER[2]);
    put(g, x, y + 2, M_LEATHER[0]);
  }
  stamp(g, ['GgY', 'g.Y', 'YYz'], { G: '#fff0a0', g: '#f2c230', Y: '#9a5a14', z: '#5a3410' }, 16, 35);
  // the neck in the collar's shadow
  fill(g, and(ell(15, 28, 3.2, 3), not(collar)), (x) => (x < 14 ? M_SKIN[2] : M_SKIN[1]));
  // the head: his hair's back mass (combed back, close to the skull), then the long, lean face
  const hair = or(ell(17.5, 14.5, 9.2, 9.2), ell(20.5, 19.5, 3.8, 3.6));
  fill(g, hair, sphere(M_HAIR, 13, 8, 14, 14, 0.08, 0.06));
  rimShade(g, hair, M_HAIR[0], 2);
  const face = and(or(ell(12.5, 19, 6.3, 7.8), ell(12, 24.6, 4.5, 4.8), ell(5.8, 21.6, 1.3, 1.6)), (_x, y) => y >= 10.5);
  fill(g, face, sphere(M_SKIN, 10, 15.5, 9, 11, 0.28));
  rimShade(g, face, M_SKIN[1]);
  // the hairline swept back off a high forehead, the sideburn before the ear
  for (let x = 6; x <= 20; x++) {
    const hl = 11 + (x > 12 ? Math.round((x - 12) * 0.55) : 0);
    for (let y = 5; y < hl; y++) if (face(x, y) || hair(x, y)) put(g, x, y, y === hl - 1 ? M_HAIR[2] : sphere(M_HAIR, 13, 8, 14, 14, 0.08, 0.06)(x, y)!);
  }
  for (let y = 15; y <= 21; y++) put(g, 18, y, M_HAIR[2]);
  // silver threads in the dark hair, combed back to the tie
  for (const [a, b, c, d] of [
    [[8, 9], [13, 6], [19, 6], [23, 12]],
    [[13, 10], [17, 8.5], [21, 9.5], [23.5, 16]],
    [[17, 13], [19.5, 12], [21.5, 13.5], [23, 18]],
    [[11, 7], [15, 5], [20, 5.5], [24, 9]],
    [[19, 17], [21, 15.5], [23, 16.5], [24, 19]],
  ] as Array<Array<[number, number]>>)
    bez(a, b, c, d, 24).forEach(([x, y], i) => {
      if (hair(Math.round(x), Math.round(y)) && !face(Math.round(x), Math.round(y) + 1)) put(g, Math.round(x), Math.round(y), i < 9 ? M_SILVER[2] : M_SILVER[1]);
    });
  put(g, 17, 15, M_SILVER[1]);
  put(g, 18, 16, M_SILVER[0]);
  // the near ear
  fill(g, ell(19.5, 20.5, 1.8, 2.6), sphere(M_SKIN, 18.6, 19.4, 3, 3.5, 0.12));
  put(g, 19, 21, M_SKIN[1]);
  // spectacles pushed up onto his head: two round wire rims, the lenses catching the lamp
  const spec: Pal = { y: '#d8901c', Y: '#9a5a14', W: '#ffffff', l: '#a8d4ee' };
  stamp(g, ['.yy.', 'yWly', '.YY.'], spec, 11, 7);
  stamp(g, ['.y', 'yW', '.Y'], spec, 7, 8);
  put(g, 9, 8, spec.y);
  put(g, 10, 8, spec.y);
  for (let x = 15; x <= 18; x++) put(g, x, 8 + (x > 16 ? 1 : 0), spec.Y);
  // brows lifted at the inner ends (kind, a little worried)
  stamp(g, ['3...', '.334'], { 3: M_HAIR[3], 4: M_SILVER[0] }, 12, 14);
  stamp(g, ['..3', '33.'], { 3: M_HAIR[3] }, 7, 14);
  // tired lids (a crease above), kind brown eyes looking left, a shadow under each
  for (const x of [12, 13, 14, 15, 7, 8, 9]) put(g, x, 16, M_SKIN[2]);
  const eye: Pal = { k: INK, W: '#ffffff', I: '#7a4a24', i: '#4a2a14', w: '#e8dcd0' };
  stamp(g, ['kkkk', 'WIwk', 'iIk.'], eye, 12, 17);
  stamp(g, ['kkk', 'WIk', 'ik.'], eye, 7, 17);
  for (const x of [13, 14, 15, 8]) put(g, x, 20, M_SKIN[2]);
  // the long nose: a lit bridge, a shaded underside; a hollow under the cheekbone
  for (let y = 18; y <= 21; y++) put(g, 6, y, M_SKIN[4]);
  put(g, 5, 23, M_SKIN[1]);
  put(g, 6, 23, M_SKIN[1]);
  put(g, 7, 23, M_SKIN[2]);
  for (const [x, y] of [
    [14, 22],
    [15, 23],
    [16, 24],
  ])
    put(g, x, y, M_SKIN[2]);
  // a short beard, salt and pepper, along the jaw and round the chin; the mouth in it, a gentle half smile
  const beard = and(face, ell(12, 26.8, 6.2, 3.6), (x, y) => y >= 24 + (x > 15 ? -2 : 0));
  fill(g, beard, sphere(M_BEARD, 8, 24.5, 7, 4.5, 0.05));
  stamp(g, ['ttttt', 'm...m', '.mmm.'], { t: M_BEARD[1], m: '#6a3430' }, 6, 24);
  fill(g, and(ell(8.5, 26.5, 1.4, 0.6), face), () => '#a85a4a');
  // his hand, lifted, holding the pen: the owl feather rising, the silver nib below, ink-stained fingertips
  const vane = bez([4.5, 34], [3.5, 30], [2.5, 27], [2.5, 23], 14);
  stroke(g, vane, (t) => 1.6 + Math.sin(t * Math.PI) * 0.5, (x, y) => {
    if (y % 3 === 0) return x < 3 ? OWL[2] : OWL[1];
    return x < 3 ? OWL[4] : OWL[3];
  });
  for (const [x, y] of vane.filter((_p, i) => i % 2 === 0)) put(g, Math.round(x), Math.round(y), OWL[0]);
  const hand = or(ell(5.5, 35.5, 3.4, 2.8), ell(8, 37.5, 2.6, 2.4));
  fill(g, hand, sphere(M_SKIN, 4, 33.5, 5, 4.5, 0.18));
  rimShade(g, hand, M_SKIN[1]);
  for (const x of [5, 7]) put(g, x, 36, M_SKIN[1]);
  stamp(g, ['ki', 'i.'], { k: ATLAS_INK[0], i: ATLAS_INK[2] }, 2, 34);
  put(g, 4, 33, ATLAS_INK[1]);
  stamp(g, ['S', 'W', 's'], { S: '#b8c2d8', W: '#eef3fa', s: '#7c86a6' }, 4, 37);
  put(g, 3, 39, '#f2c230');
  return toCanvas(g);
}

// ------------------------------------------------------------------ High Keeper Hesper

/** Her robes: keeper's blue gone to grey with the hall's dust; silver trim. */
const K_ROBE = ['#161c2a', '#242e42', '#38465c', '#506078', '#728296', '#9eaabb'];
const K_TRIM = ['#7c86a6', '#b8c2d8', '#eef3fa'];
const K_HAIR = ['#4a4858', '#7a788c', '#a8a6b8', '#d2d0dc', '#f4f2f8'];
const K_SKIN = ['#6a3a30', '#a86a54', '#d49a7c', '#ecbea0', '#fadcc4'];
const K_BRASS = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];

function keeper(): HTMLCanvasElement {
  const g = grid(P, P);
  // the tight bun at the back of her head, a pin through it
  const bun = ell(26, 11, 4.2, 3.8);
  fill(g, bun, sphere(K_HAIR, 24.5, 9.5, 5, 5, 0.06));
  rimShade(g, bun, K_HAIR[0]);
  for (const [x, y] of bez([23, 9], [25, 8], [28, 9.5], [29, 13], 8)) put(g, Math.round(x), Math.round(y), K_HAIR[1]);
  stamp(g, ['G....', '.gY..', '...YY'], { G: K_BRASS[4], g: K_BRASS[3], Y: K_BRASS[1] }, 25, 6);
  // the robe and its stole: straight shoulders (she stands upright), silver piping down the front
  const robe = ell(20, 43, 16.5, 11.5);
  fill(g, robe, sphere(K_ROBE, 13, 35, 21, 13, 0.04));
  rimShade(g, robe, K_ROBE[1]);
  for (const sx of [11, 22]) for (let y = 32; y < 40; y++) if (robe(sx, y)) {
    put(g, sx, y, sx < 15 ? K_TRIM[2] : K_TRIM[1]);
    put(g, sx + 1, y, K_TRIM[0]);
  }
  // the high standing collar, trimmed in silver along its top edge
  const collar = and(or(ell(11.5, 30.5, 4, 3.6), ell(18.5, 30, 4.4, 3.8)), (_x, y) => y >= 26.5);
  fill(g, collar, sphere(K_ROBE, 9, 27, 9, 6, 0.14));
  rimShade(g, collar, K_ROBE[1]);
  for (let x = 7; x <= 23; x++)
    for (let y = 26; y <= 30; y++)
      if (collar(x, y) && !collar(x, y - 1)) {
        put(g, x, y, x < 15 ? K_TRIM[2] : K_TRIM[1]);
        break;
      }
  // the neck above the collar
  fill(g, and(ell(15, 26.5, 3, 2.4), not(collar)), (x) => (x < 14 ? K_SKIN[2] : K_SKIN[1]));
  // the hair: silver, pulled back tight from a centre line toward the bun
  const hair = or(ell(17.5, 15.5, 10, 10.5), ell(21, 20, 4.6, 4.4));
  fill(g, hair, sphere(K_HAIR, 13, 8, 15, 15, 0.04, 0.08));
  rimShade(g, hair, K_HAIR[0], 2);
  for (const [a, b, c, d] of [
    [[10, 9], [15, 6], [21, 6.5], [24, 10]],
    [[12, 12], [17, 9.5], [21, 10], [24, 12.5]],
    [[17, 14], [20, 12.5], [22.5, 13], [24, 13]],
  ] as Array<Array<[number, number]>>)
    for (const [x, y] of bez(a, b, c, d, 24)) if (hair(Math.round(x), Math.round(y))) put(g, Math.round(x), Math.round(y), K_HAIR[1]);
  for (const [x, y] of bez([9, 10], [12, 7], [16, 5.5], [20, 6], 16)) put(g, Math.round(x), Math.round(y), K_HAIR[4]);
  // the face: long, lean cheeks, a firm chin
  const face = and(or(ell(12.5, 19.5, 6.4, 7.6), ell(12, 24.6, 4.6, 4.2), ell(5.8, 21.8, 1.3, 1.6)), (_x, y) => y >= 11.5);
  fill(g, face, sphere(K_SKIN, 10, 16, 9, 11, 0.3));
  rimShade(g, face, K_SKIN[1]);
  // the hairline: smooth, pulled straight back
  for (let x = 6; x <= 20; x++) {
    const hl = 12 + (x > 14 ? Math.round((x - 14) * 0.4) : 0);
    for (let y = 9; y < hl; y++) if (face(x, y)) put(g, x, y, y === hl - 1 ? K_HAIR[1] : K_HAIR[3]);
  }
  for (let y = 14; y <= 19; y++) put(g, 18, y, K_HAIR[1]);
  // the near ear
  fill(g, ell(19.5, 20.5, 1.8, 2.6), sphere(K_SKIN, 18.6, 19.4, 3, 3.5, 0.12));
  put(g, 19, 21, K_SKIN[1]);
  // level brows; steady grey eyes, a little narrowed; lines at the eye's corner and the cheek
  for (let x = 12; x <= 15; x++) put(g, x, 15, K_HAIR[1]);
  for (let x = 7; x <= 9; x++) put(g, x, 15, K_HAIR[1]);
  put(g, 12, 14, K_HAIR[0]);
  const eye: Pal = { k: INK, W: '#ffffff', I: '#5a7a96', i: '#2e4462', w: '#dcd4cc' };
  stamp(g, ['kkkk', 'WIwk', '.ii.'], eye, 12, 17);
  stamp(g, ['kkk', 'WIk', '.i.'], eye, 7, 17);
  put(g, 16, 17, K_SKIN[1]);
  put(g, 16, 19, K_SKIN[1]);
  for (const x of [8, 13, 14]) put(g, x, 20, K_SKIN[2]);
  put(g, 14, 20, K_SKIN[1]);
  for (const [x, y] of [
    [10, 22],
    [10, 23],
    [9, 24],
  ])
    put(g, x, y, K_SKIN[1]);
  // a straight nose with a lit bridge; a thin, level mouth (plain words, few of them)
  for (let y = 17; y <= 21; y++) put(g, 6, y, K_SKIN[4]);
  put(g, 5, 23, K_SKIN[1]);
  put(g, 6, 23, K_SKIN[1]);
  stamp(g, ['mmmm', '...n'], { m: '#8a4a44', n: K_SKIN[1] }, 6, 26);
  put(g, 7, 27, K_SKIN[4]);
  // the chain round her neck, down to the heavy key of the Atlas Hall: its bow a compass rose
  for (const [a, b] of [
    [[9.5, 31], [16, 35]],
    [[22, 30.5], [18, 35]],
  ] as Array<[[number, number], [number, number]]>) {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n;
      const y = a[1] + ((b[1] - a[1]) * i) / n;
      put(g, Math.round(x), Math.round(y), i % 2 ? K_TRIM[0] : K_TRIM[2]);
    }
  }
  stamp(
    g,
    ['..GGy..', '.Gg4gY.', 'Gg343gY', 'G43W34Y', 'yg343YY', '.yY4YY.', '..YYY..', '...g...', '...yz..', '..gyz..'],
    { G: K_BRASS[4], g: K_BRASS[3], y: K_BRASS[2], Y: K_BRASS[1], z: K_BRASS[0], 3: '#3a2418', 4: '#6e4426', W: '#fff0a0' },
    14,
    32,
  );
  return toCanvas(g);
}

// ------------------------------------------------------------------ the narrator: a corner of the Atlas

/** (aged parchment, L7: no cream) */
const N_PARCH = ['#4a3020', '#6a4a2c', '#86623a', '#a07a4a', '#b8925c'];
const N_WASH = ['#2e5a6a', '#46707a', '#62847e'];

/** The narrator (docs/story-bible.md section 9): a corner of the living map, lit from the top left: a sheet of
 *  parchment with a coast drawn on it (the sea washed blue, a patch of land in colour), the corner curling up, and a
 *  compass rose in gold and ink at its heart. */
function narrator(): HTMLCanvasElement {
  const g = grid(P, P);
  // the sheet: a slightly tilted square of parchment, lighter toward the lamp (top left)
  const sheet = (x: number, y: number) => x >= 3 && y >= 3 && x <= 37 && y <= 37 && x + y <= 70;
  fill(g, sheet, (x, y) => {
    const v = 1 - (x + y) / 80;
    return N_PARCH[v > 0.72 ? 4 : v > 0.42 ? 3 : 2];
  });
  // the sea, washed blue along the left, its engraved water lines following the coast
  const coast = (y: number) => 13 + Math.round(Math.sin(y * 0.35) * 2 + Math.sin(y * 0.9) * 1);
  for (let y = 3; y <= 37; y++)
    for (let x = 3; x < coast(y); x++) {
      if (!sheet(x, y)) continue;
      const d = coast(y) - x;
      put(g, x, y, d <= 2 ? N_WASH[0] : d <= 5 ? N_WASH[1] : N_WASH[2]);
      if (d === 4 && y % 3 !== 0) put(g, x, y, '#4a3a5e');
    }
  // the land in colour round a little wood, the rest still ink on paper
  for (let y = 4; y <= 36; y++) {
    const cx = coast(y);
    put(g, cx, y, ATLAS_INK[1]);
    for (let x = cx + 1; x < cx + 9 && x < 37; x++) if (Math.hypot(x - 18, y - 30) < 7.5) put(g, x, y, (x + y) % 5 === 0 ? '#2e5a32' : x < 18 ? '#78a83c' : '#4a7e36');
  }
  stamp(g, ['.gG.', 'gGGg', 'ddgd', '.t..'], { g: '#2e5a32', G: '#4a7e36', d: '#1e3c2a', t: '#4e2c16' }, 17, 27);
  // a few ink marks: hills and a road
  stamp(g, ['..k..', '.k.k.', 'k...k'], { k: ATLAS_INK[2] }, 27, 8);
  stamp(g, ['..k..', '.k.k.', 'k...k'], { k: ATLAS_INK[2] }, 31, 12);
  for (let x = 21; x <= 34; x += 2) put(g, x, 34 - Math.round((x - 21) * 0.3), '#8a1a22');
  // the compass rose: four long points (gold, lit on their top-left halves), four short ink ones, a ring
  const cx = 22;
  const cy = 17;
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    put(g, Math.round(cx + Math.cos(t) * 7.4), Math.round(cy + Math.sin(t) * 7.4), ATLAS_INK[2]);
  }
  const pt = (dx: number, dy: number, len: number, lit: string, dark: string) => {
    for (let k = 0; k <= len; k++) {
      const w = Math.round(2 * (1 - k / len));
      for (let s = -w; s <= w; s++) put(g, cx + dx * k - dy * s, cy + dy * k + dx * s, s < 0 ? lit : s > 0 ? dark : ATLAS_INK[1]);
    }
  };
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ])
    for (let k = 1; k <= 5; k++) put(g, cx + dx * k, cy + dy * k, ATLAS_INK[2]);
  pt(0, -1, 10, '#fff0a0', '#d8901c');
  pt(0, 1, 10, '#f2c230', '#9a5a14');
  pt(1, 0, 10, '#f2c230', '#9a5a14');
  pt(-1, 0, 10, '#fff0a0', '#d8901c');
  put(g, cx, cy, '#ffffff');
  // the N over the north point
  stamp(g, ['k..k', 'kk.k', 'k.kk', 'k..k'], { k: ATLAS_INK[1] }, cx - 1, 1);
  // the corner curling up at the bottom right: the back of the sheet, a shadow under it
  for (let y = 26; y <= 38; y++)
    for (let x = 26; x <= 38; x++) {
      const f = 38 - x + (38 - y);
      if (f < 9) put(g, x, y, f < 2 ? N_PARCH[0] : f < 5 ? N_PARCH[1] : N_PARCH[2]);
      else if (f < 11 && sheet(x, y)) put(g, x, y, N_PARCH[1]);
    }
  return toCanvas(g);
}

/** Paint the Atlas's people and the narrator (called from art-story.ts buildStoryArt). */
export function buildAtlasPortraits(add: (key: string, c: HTMLCanvasElement) => void): void {
  // (L7/L8: moodier light, the far side in deep cool shadow)
  add('portrait_mapmaker', portraitMood(mapmaker()));
  add('portrait_keeper', portraitMood(keeper()));
  add('portrait_narrator', portraitMood(narrator(), 0.28));
}
