// The companions' screen art (see docs/art-style.md, docs/ui-style.md "Companions"): a moonlit night grove registered
// as a stage theme ('grove': far misty trunks, a scalloped canopy along the top, hanging moss, two great trunks framing
// the clearing, ferns and glowing mushrooms along the back of a mossy floor, moonbeams), and the mossy stump the
// companion stands on (`grove_stump`, 46 x 20: a cut stump, its top a lit ring face, bark sides, moss on the rim, roots
// and two little mushrooms; the companion's feet go on GROVE_STUMP_TOP). Painted the first time the screen opens
// (`ensureGroveArt`), never at boot.
import type Phaser from 'phaser';
import { grid, put, stamp, toCanvas } from './art';
import { ell, fill, rect, tone, type Inside } from './art-paint';
import { registerStageTheme, type StageSpec } from './art-ui-stage';

export const GROVE_THEME = 'grove';

const GROVE: StageSpec = {
  sky: ['#060d16', '#08121c', '#0b1824', '#0f1f2e', '#132838', '#183242'],
  far: ['#10222e', '#1c3a46'],
  near: ['#060c10', '#173032'],
  floor: ['#1a3226', '#1f3a2b', '#244230', '#1a3024', '#112018'],
  floorY: 114,
  motif: 'nightGrove',
  light: 0xd8f0ff,
  disc: [0x6a9a78, 0x3a5a44, 0x223a2c],
  accent: 0xc8ff9a,
  orb: [292, 24, 8],
  orbCol: '#eef8ff',
  twinkle: '#c8ff9a',
};

/** Hex colour, mixed toward another by t (0..1). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** The grove's layers between the sky and the floor (the 327 x 150 stage canvas). */
function paintGrove(ctx: CanvasRenderingContext2D, w: number, sp: StageSpec, r: () => number): void {
  const fy = sp.floorY;
  const [fb, fe] = sp.far;
  const [nb, ne] = sp.near;
  const px = (x: number, y: number, c: string, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  // moonbeams: a few soft slanted shafts from the top right (dithered, very faint)
  ctx.globalAlpha = 0.07;
  for (const [x0, wd] of [
    [250, 16],
    [200, 10],
    [150, 22],
  ] as const)
    for (let y = 0; y < fy; y++) {
      const x = x0 - y * 0.55;
      for (let k = 0; k < wd; k++) if ((Math.floor(x + k) + y) % 2 === 0 || k > 2) px(x + k, y, '#d8f0ff');
    }
  ctx.globalAlpha = 1;
  // far: misty trunks, thin and pale (atmospheric), each lit down its left edge
  const farTrunk = (x: number, tw: number, body: string, edge: string) => {
    px(x, 0, body, tw, fy);
    px(x, 0, edge, 1, fy);
    // a flare at the foot
    px(x - 1, fy - 4, body, tw + 2, 4);
    px(x - 2, fy - 2, body, tw + 4, 2);
  };
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * w);
    farTrunk(x, 2 + Math.floor(r() * 3), mixHex(fb, sp.sky[3], 0.35), mixHex(fe, sp.sky[4], 0.3));
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * w);
    farTrunk(x, 3 + Math.floor(r() * 3), fb, fe);
  }
  // a low mist over the far floor
  ctx.globalAlpha = 0.18;
  px(0, fy - 10, '#5a8a96', w, 4);
  ctx.globalAlpha = 0.1;
  px(0, fy - 14, '#5a8a96', w, 4);
  ctx.globalAlpha = 1;
  // the canopy: scalloped leaf masses along the top, a lit lower rim where the moon catches them
  const clump = (cx: number, cy: number, rad: number, body: string, edge: string) => {
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++) {
        const d = x * x + y * y * 1.6;
        if (d > rad * rad) continue;
        const rim = d > (rad - 1.6) ** 2 && y > 0;
        px(cx + x, cy + y, rim ? edge : body);
      }
  };
  for (let x = -6; x < w + 10; x += 9 + Math.floor(r() * 6)) clump(x, 2 + Math.floor(r() * 5), 7 + Math.floor(r() * 5), mixHex(nb, fb, 0.3), mixHex(fe, '#3a6a5a', 0.4));
  for (let x = -4; x < w + 10; x += 12 + Math.floor(r() * 8)) clump(x, -2 + Math.floor(r() * 4), 6 + Math.floor(r() * 4), nb, mixHex(ne, '#2a4a40', 0.2));
  // hanging moss and vines from the canopy, swaying strands of 1 px
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * w);
    const len = 10 + Math.floor(r() * 26);
    const y0 = 6 + Math.floor(r() * 6);
    for (let k = 0; k < len; k++) px(x + Math.round(Math.sin(k * 0.35 + i) * 0.8), y0 + k, k % 5 === 4 ? '#3a6a4a' : '#1e3e30');
    px(x - 1, y0 + len - 1, '#2a5238', 3, 1);
  }
  // the two great trunks framing the clearing (near layer): broad, rooted, moss on their lit side
  const bigTrunk = (cx: number, wd: number, lit: number) => {
    for (let y = 0; y < fy + 6; y++) {
      const flare = y > fy - 16 ? Math.round(((y - (fy - 16)) / 16) ** 2 * 7) : 0;
      const x0 = Math.round(cx - wd / 2 - flare);
      const ww = wd + flare * 2;
      px(x0, y, nb, ww, 1);
      // bark grooves and the lit side
      for (let k = 0; k < ww; k++) {
        const u = (k + Math.round(Math.sin(y * 0.2) * 1.2)) % 5;
        if (u === 0) px(x0 + k, y, '#04080a');
      }
      const litX = lit < 0 ? x0 : x0 + ww - 2;
      px(litX, y, ne, 2, 1);
      if ((y * 7) % 11 < 4) px(lit < 0 ? x0 + 2 : x0 + ww - 3, y, mixHex(ne, nb, 0.5));
    }
    // moss tufts on the lit side
    for (let y = 30; y < fy; y += 7 + Math.floor(r() * 9)) {
      const mx = lit < 0 ? cx - wd / 2 : cx + wd / 2 - 3;
      px(mx, y, '#3e7a44', 3, 2);
      px(mx + 1, y - 1, '#6aa04c', 1, 1);
    }
  };
  bigTrunk(6, 16, 1);
  bigTrunk(318, 20, -1);
  // ferns along the back of the floor: fronds fanning from a root
  const fern = (x: number, base: number, sz: number, body: string, edge: string) => {
    for (const dir of [-1, -0.45, 0.45, 1]) {
      for (let k = 0; k < sz; k++) {
        const fx = x + dir * k * 0.9;
        const fy2 = base - k * (1.1 - Math.abs(dir) * 0.55) + (k * k) / (sz * 2.2);
        px(fx, fy2, k === 0 ? edge : body);
        if (k % 2 === 0 && k > 1) px(fx, fy2 + 1, body);
      }
    }
  };
  for (let i = 0; i < 18; i++) fern(Math.floor(r() * w), fy + 1, 5 + Math.floor(r() * 4), '#16301f', '#2e5a36');
  // glowing mushrooms in little clusters at the floor's back edge (soft halo, pale caps)
  const shroom = (x: number, y: number) => {
    ctx.globalAlpha = 0.16;
    px(x - 3, y - 4, sp.twinkle ?? '#c8ff9a', 7, 6);
    ctx.globalAlpha = 0.28;
    px(x - 2, y - 3, sp.twinkle ?? '#c8ff9a', 5, 4);
    ctx.globalAlpha = 1;
    px(x, y - 1, '#c8d8c0', 1, 2);
    px(x - 1, y - 2, '#9affd8', 3, 1);
    px(x, y - 3, '#e8fff4', 1, 1);
  };
  for (let i = 0; i < 7; i++) {
    const x = 12 + Math.floor(r() * (w - 24));
    shroom(x, fy + 2);
    if (r() < 0.6) shroom(x + 3, fy + 3);
  }
}

/** The stump's ramps (dark -> light), hue-shifted: bark cool in the shade, the cut face warm in the light. */
const BARK = ['#1a1014', '#2e1c18', '#4a2e20', '#6a4428', '#8a5e34'];
const FACE = ['#5a3a22', '#8a5e34', '#b88a52', '#dcb478', '#f4d8a0'];
const MOSS = ['#123020', '#1e4a2a', '#2e6a34', '#4a8e3c', '#7ab84a', '#b4e070'];

export const GROVE_STUMP_W = 62;
export const GROVE_STUMP_H = 24;
/** Where the companion's feet go on the stump (the centre of its top face), from the texture's top-left. */
export const GROVE_STUMP_TOP = { x: 30, y: 6 };

/** A mossy tree stump: the cut face (rings, lit top-left), bark down the sides, roots, moss and two mushrooms. */
function stumpSprite(): HTMLCanvasElement {
  const W = GROVE_STUMP_W;
  const H = GROVE_STUMP_H;
  const g = grid(W, H);
  const cx = 30;
  const topY = 6;
  const rx = 18;
  const base = 19;
  // roots spreading at the foot (drawn first: the trunk overlaps them)
  const roots: Array<[number, number, number]> = [
    [-1, 9, 3],
    [1, 10, 3],
    [-1, 5, 2],
    [1, 6, 2],
  ];
  for (const [dir, len, th] of roots)
    for (let k = 0; k < len + 4; k++) {
      const x = cx + dir * (rx - 3 + k);
      const y = base - 3 + Math.round((k / (len + 4)) * 4);
      for (let t = 0; t < th - Math.floor(k / 5); t++) put(g, x, y + t, t === 0 ? BARK[3] : BARK[1 + (k % 2)]);
    }
  // the trunk: a short cylinder, lit from the left
  const body: Inside = (x, y) => y >= topY && y <= base && Math.abs(x + 0.5 - cx) <= rx + (y > base - 3 ? (y - base + 3) * 0.8 : 0);
  fill(g, body, (x, y) => {
    const u = (x + 0.5 - (cx - rx)) / (rx * 2);
    const groove = (x * 3 + Math.floor(y / 3)) % 5 === 0;
    return tone(BARK, 0.85 - u * 0.75 + (groove ? -0.2 : 0) - (y - topY) * 0.01);
  });
  // the cut face: an ellipse with rings, warm and lit from the top left
  const face = ell(cx, topY, rx, 4.6);
  fill(g, face, (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - topY) / 4.6);
    const ring = Math.abs(((d * 4.2) % 1) - 0.5) < 0.16;
    const lit = 0.75 - (x + 0.5 - cx) / (rx * 4) - (y + 0.5 - topY) / 10;
    return tone(FACE, lit + (ring ? -0.25 : 0));
  });
  // the bark's lip round the face
  for (let x = cx - rx; x <= cx + rx; x++) {
    const dy = Math.round(4.6 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
    put(g, x, topY + dy, BARK[2]);
  }
  // moss over the rim (left and back) and dripping down the side
  fill(g, (x, y) => face(x, y) && (x < cx - rx + 5 || y < topY - 2) && ((x * 7 + y * 3) % 5 !== 0), (x, y) => tone(MOSS, 0.9 - (y - topY + 4) * 0.08 - (x > cx ? 0.2 : 0)));
  for (const [x, len] of [
    [cx - rx + 1, 6],
    [cx - rx + 3, 9],
    [cx - rx + 6, 4],
    [cx + 4, 3],
  ])
    for (let k = 0; k < len; k++) put(g, x + (k % 3 === 2 ? 1 : 0), topY + 2 + k, k < 2 ? MOSS[4] : MOSS[k % 2 ? 2 : 3]);
  fill(g, rect(cx - rx - 2, base - 1, cx - rx + 8, base + 1), (x, y) => ((x + y) % 3 === 0 ? MOSS[1] : MOSS[3]));
  // two little mushrooms at the foot
  stamp(g, ['.rRr.', 'rRWRr', '..s..', '..s..'], { r: '#b02a2a', R: '#e0463c', W: '#ffe0d0', s: '#e8dcc8' }, cx + rx - 1, base - 3);
  stamp(g, ['.rR.', 'rRWr', '.s..'], { r: '#b02a2a', R: '#e0463c', W: '#ffe0d0', s: '#e8dcc8' }, cx + rx + 4, base - 1);
  return toCanvas(g);
}

let registered = false;

/** Register the grove theme and paint the stump (once). */
export function ensureGroveArt(scene: Phaser.Scene): void {
  if (!registered) {
    registerStageTheme(GROVE_THEME, GROVE, paintGrove);
    registered = true;
  }
  if (!scene.textures.exists('grove_stump')) scene.textures.addCanvas('grove_stump', stumpSprite());
}
