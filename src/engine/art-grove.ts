// The companions' screen art (see docs/art-style.md, docs/ui-style.md "Companions"): a moonlit night grove registered
// as a stage theme ('grove'), and the mossy stump the companion stands on. Back to front: a night sky with a few stars
// in the canopy's gaps and a big moon low over the clearing (behind the companion's head, framing it), faint
// moonbeams, far misty trunks, a mid row of darker trunks with moss on their lit side, the canopy's scalloped leaf
// masses along the top with hanging moss, two great trunks framing the clearing, a low mist; then the floor (painted
// after the stage's own bands, so it's ours): moss in perspective bands, a lit clearing round the stump with a ring
// of short grass, ferns and glowing mushrooms along the back, little flowers, pebbles and leaf litter. The stump
// (`grove_stump`, GROVE_STUMP_W x GROVE_STUMP_H): a low cut stump, its top a lit ring face, bark sides, moss on the
// rim, roots and two mushrooms; the companion's feet go on GROVE_STUMP_TOP. Painted the first time the screen opens
// (`ensureGroveArt`), never at boot.
import type Phaser from 'phaser';
import { grid, put, stamp, toCanvas } from './art';
import { ell, fill, moodGrade, rect, tone, type Inside } from './art-paint';
import { paintStage, registerStageTheme, type StageSpec } from './art-ui-stage';

export const GROVE_THEME = 'grove';
/** The moon, behind the stage's companion: [x, y, r] on the 327 x 150 backdrop. */
export const GROVE_MOON: [number, number, number] = [80, 33, 12];

const GROVE: StageSpec = {
  sky: ['#060c18', '#08101e', '#0b1626', '#0f1d30', '#13253a', '#182e44'],
  far: ['#122634', '#1e3e4c'],
  near: ['#060c10', '#173032'],
  floor: ['#1c3a28', '#1f402c', '#22442f', '#1c3828', '#142a1e'],
  floorY: 112,
  motif: 'nightGrove',
  light: 0xd8f0ff,
  disc: [0x6a9a78, 0x3a5a44, 0x223a2c],
  accent: 0xc8ff9a,
  twinkle: '#c8ff9a',
};

/** Hex colour, mixed toward another by t (0..1). */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** A seeded stream (mulberry32): the floor's details come out the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Px = (x: number, y: number, c: string, ww?: number, hh?: number) => void;
const pxOf =
  (ctx: CanvasRenderingContext2D): Px =>
  (x, y, c, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };

/** The moon: a soft halo in stepped rings, the disc lit from the top left, a few dim seas. */
function moon(ctx: CanvasRenderingContext2D, px: Px): void {
  const [mx, my, mr] = GROVE_MOON;
  for (const [k, a] of [
    [3.2, 0.05],
    [2.4, 0.08],
    [1.7, 0.12],
  ] as const) {
    ctx.globalAlpha = a;
    for (let y = -mr * k; y <= mr * k; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, (mr * k) ** 2 - y * y)));
      px(mx - half, my + y, '#bfe0ff', half * 2, 1);
    }
  }
  ctx.globalAlpha = 1;
  for (let y = -mr; y <= mr; y++)
    for (let x = -mr; x <= mr; x++) {
      const d = Math.hypot(x + 0.5, y + 0.5);
      if (d > mr) continue;
      // lit from the top left; the far side a cooler tone (hue-shifted, not grey)
      const lit = (-(x + 0.5) - (y + 0.5)) / (mr * 2);
      px(mx + x, my + y, lit > 0.25 ? '#ffffff' : lit > -0.2 ? '#eef6ff' : lit > -0.45 ? '#d4e6fa' : '#b4cceb');
    }
  // seas: soft clusters, not single pixels
  for (const [sx, sy, w, h] of [
    [-5, -3, 4, 3],
    [1, 2, 5, 3],
    [-2, 6, 3, 2],
    [4, -6, 3, 2],
  ])
    px(mx + sx, my + sy, '#c8daf0', w, h);
}

/** The grove's layers between the sky and the floor (the 327 x 150 stage canvas). */
function paintGrove(ctx: CanvasRenderingContext2D, w: number, sp: StageSpec, r: () => number): void {
  const fy = sp.floorY;
  const [fb, fe] = sp.far;
  const [nb, ne] = sp.near;
  const px = pxOf(ctx);
  // a few stars where the canopy thins (clusters of two, never lone specks), then the moon
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * w);
    const y = 12 + Math.floor(r() * 40);
    if (Math.hypot(x - GROVE_MOON[0], y - GROVE_MOON[1]) < GROVE_MOON[2] * 2.6) continue;
    px(x, y, '#c8d8f0');
    px(x + 1, y, '#8aa0c8');
  }
  moon(ctx, px);
  // moonbeams: soft shafts falling from the moon into the clearing (dithered, very faint)
  ctx.globalAlpha = 0.06;
  for (const [dx, wd, lean] of [
    [-10, 8, -0.28],
    [-2, 12, -0.08],
    [8, 7, 0.16],
  ] as const)
    for (let y = GROVE_MOON[1] + 6; y < fy; y++) {
      const x = GROVE_MOON[0] + dx + (y - GROVE_MOON[1]) * lean;
      const ww = wd + (y - GROVE_MOON[1]) * 0.12;
      for (let k = 0; k < ww; k++) if ((Math.floor(x + k) + y) % 2 === 0 || (k > 1 && k < ww - 2)) px(x + k, y, '#d8f0ff');
    }
  ctx.globalAlpha = 1;
  // far: misty trunks, thin and pale (atmospheric), each lit down its left edge
  const trunk = (x: number, tw: number, body: string, edge: string, foot = 4) => {
    px(x, 0, body, tw, fy);
    px(x, 0, edge, 1, fy);
    px(x - 1, fy - foot, body, tw + 2, foot);
    px(x - 2, fy - 2, body, tw + 4, 2);
  };
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * w);
    if (Math.abs(x - GROVE_MOON[0]) < GROVE_MOON[2] + 3) continue; // the moon stays clear
    trunk(x, 2 + Math.floor(r() * 3), mixHex(fb, sp.sky[3], 0.45), mixHex(fe, sp.sky[4], 0.35));
  }
  // a low mist over the far floor (the far trunks fade into it)
  for (const [y, h, a] of [
    [fy - 18, 5, 0.06],
    [fy - 13, 5, 0.1],
    [fy - 8, 8, 0.16],
  ] as const) {
    ctx.globalAlpha = a;
    px(0, y, '#6a9aa6', w, h);
  }
  ctx.globalAlpha = 1;
  // mid: darker trunks with bark grooves, moss on their lit (left) side
  for (let i = 0; i < 9; i++) {
    const x = 20 + Math.floor(r() * (w - 40));
    if (Math.abs(x - GROVE_MOON[0]) < GROVE_MOON[2] + 6) continue;
    const tw = 4 + Math.floor(r() * 3);
    trunk(x, tw, fb, fe, 6);
    for (let y = 8; y < fy; y += 3 + Math.floor(r() * 4)) px(x + 1 + Math.floor(r() * (tw - 1)), y, mixHex(fb, '#000000', 0.35), 1, 2);
    for (let y = 26 + Math.floor(r() * 20); y < fy - 8; y += 14 + Math.floor(r() * 16)) {
      px(x, y, '#2e5a3a', 2, 2);
      px(x, y - 1, '#4a8a4a', 1, 1);
    }
  }
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
  // hanging moss and vines from the canopy, swaying strands of 1 px (never in front of the moon)
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * w);
    const len = 10 + Math.floor(r() * 26);
    const y0 = 6 + Math.floor(r() * 6);
    if (Math.abs(x - GROVE_MOON[0]) < GROVE_MOON[2] + 4) continue;
    for (let k = 0; k < len; k++) px(x + Math.round(Math.sin(k * 0.35 + i) * 0.8), y0 + k, k % 5 === 4 ? '#3a6a4a' : '#1e3e30');
    px(x - 1, y0 + len - 1, '#2a5238', 3, 1);
  }
  // the two great trunks framing the clearing (near layer): broad, rooted, moss on their lit side
  const bigTrunk = (cx: number, wd: number, lit: number) => {
    for (let y = 0; y < fy + 8; y++) {
      const flare = y > fy - 16 ? Math.round(((y - (fy - 16)) / 16) ** 2 * 7) : 0;
      const x0 = Math.round(cx - wd / 2 - flare);
      const ww = wd + flare * 2;
      px(x0, y, nb, ww, 1);
      for (let k = 0; k < ww; k++) {
        const u = (k + Math.round(Math.sin(y * 0.2) * 1.2)) % 5;
        if (u === 0) px(x0 + k, y, '#04080a');
      }
      const litX = lit < 0 ? x0 : x0 + ww - 2;
      px(litX, y, ne, 2, 1);
      if ((y * 7) % 11 < 4) px(lit < 0 ? x0 + 2 : x0 + ww - 3, y, mixHex(ne, nb, 0.5));
    }
    for (let y = 30; y < fy; y += 7 + Math.floor(r() * 9)) {
      const mx = lit < 0 ? cx - wd / 2 : cx + wd / 2 - 3;
      px(mx, y, '#3e7a44', 3, 2);
      px(mx + 1, y - 1, '#6aa04c', 1, 1);
    }
  };
  bigTrunk(6, 16, 1);
  bigTrunk(318, 20, -1);
}

/** The floor, over the stage's own bands: moss, the lit clearing, grass, ferns, mushrooms, flowers, pebbles. */
function paintGroveFloor(ctx: CanvasRenderingContext2D, w: number, h: number, sp: StageSpec): void {
  const px = pxOf(ctx);
  const r = rng(0x9e0e);
  const fy = sp.floorY;
  const cx = GROVE_MOON[0];
  // the clearing: a paler oval of moss under the moon (dithered at its edge), brightest at its heart
  for (let y = fy; y < h; y++) {
    const t = (y - fy) / (h - fy);
    const rx = 34 + t * 46;
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.abs(x + 0.5 - cx) / rx;
      if (d > 1) continue;
      const lit = d < 0.45 ? 2 : d < 0.75 ? 1 : (x + y) % 2 === 0 ? 1 : 0;
      if (lit) px(x, y, lit === 2 ? '#2e5638' : '#264a32');
    }
  }
  // the back edge: the far floor catches the mist; a strip of darker moss under the bushes
  px(0, fy, mixHex(sp.floor[0], '#6a9aa6', 0.25), w, 1);
  px(0, fy + 1, '#142a1e', w, 1);
  // bushes along the back edge: scalloped clumps with a moonlit rim
  for (let x = -4; x < w + 6; x += 8 + Math.floor(r() * 10)) {
    if (Math.abs(x - cx) < 26) continue; // the clearing's mouth stays open
    const rad = 4 + Math.floor(r() * 4);
    for (let y = -rad; y <= 1; y++)
      for (let xx = -rad; xx <= rad; xx++) {
        const d = xx * xx + y * y * 1.8;
        if (d > rad * rad) continue;
        px(x + xx, fy + 1 + y, d > (rad - 1.4) ** 2 && y < -1 && xx < rad * 0.4 ? '#2e5a3e' : '#10221a');
      }
  }
  // ferns: fronds fanning from a root, along the back
  const fern = (x: number, base: number, sz: number, body: string, edge: string) => {
    for (const dir of [-1, -0.45, 0.45, 1])
      for (let k = 0; k < sz; k++) {
        const fx = x + dir * k * 0.9;
        const fy2 = base - k * (1.1 - Math.abs(dir) * 0.55) + (k * k) / (sz * 2.2);
        px(fx, fy2, k === 0 ? edge : body);
        if (k % 2 === 0 && k > 1) px(fx, fy2 + 1, body);
      }
  };
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * w);
    if (Math.abs(x - cx) < 22) continue;
    fern(x, fy + 3 + Math.floor(r() * 3), 5 + Math.floor(r() * 4), '#1a3a24', '#3a6a3e');
  }
  // glowing mushrooms in little clusters (a soft halo, pale caps)
  const shroom = (x: number, y: number) => {
    ctx.globalAlpha = 0.14;
    px(x - 3, y - 4, sp.twinkle ?? '#c8ff9a', 7, 6);
    ctx.globalAlpha = 0.26;
    px(x - 2, y - 3, sp.twinkle ?? '#c8ff9a', 5, 4);
    ctx.globalAlpha = 1;
    px(x, y - 1, '#c8d8c0', 1, 2);
    px(x - 1, y - 2, '#9affd8', 3, 1);
    px(x, y - 3, '#e8fff4', 1, 1);
  };
  for (let i = 0; i < 10; i++) {
    const x = 10 + Math.floor(r() * (w - 20));
    // (the clearing and the stage's front left, where the Along sockets stand, stay clear of their glow)
    if (Math.abs(x - cx) < 30 || x < 70) continue;
    const y = fy + 4 + Math.floor(r() * 8);
    shroom(x, y);
    if (r() < 0.6) shroom(x + 3, y + 1);
  }
  // short grass in tufts over the clearing's rim and the floor (lit tips toward the moon)
  for (let i = 0; i < 70; i++) {
    const y = fy + 4 + Math.floor(r() * (h - fy - 6));
    const x = Math.floor(r() * w);
    const near = Math.abs(x - cx) < 30 + (y - fy) * 0.9;
    const tip = near ? '#5a9a4a' : '#3a6a3a';
    px(x, y, '#1a3424', 1, 2);
    px(x + 1, y - 1, tip, 1, 2);
    px(x + 2, y, '#1a3424', 1, 2);
  }
  // little flowers: pale blue and white, in pairs
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * w);
    const y = fy + 6 + Math.floor(r() * (h - fy - 8));
    const c = r() < 0.5 ? '#a8d0ff' : '#f0f0e0';
    px(x, y, c);
    px(x + 1, y, mixHex(c, '#3a6a8a', 0.4));
    px(x, y + 1, '#2a5a34');
  }
  // pebbles (a lit top, a dark underside) and leaf litter
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * w);
    const y = fy + 5 + Math.floor(r() * (h - fy - 7));
    px(x, y, '#5a6a6a', 3, 1);
    px(x, y + 1, '#2a3434', 3, 1);
    px(x + 1, y, '#8a9a96', 1, 1);
  }
  for (let i = 0; i < 30; i++) px(Math.floor(r() * w), fy + 3 + Math.floor(r() * (h - fy - 4)), r() < 0.5 ? '#3a4a24' : '#4a3a20', 2, 1);
}

/** The stump's ramps (dark -> light), hue-shifted: bark cool in the shade, the cut face warm in the light. */
const BARK = ['#1a1014', '#2e1c18', '#4a2e20', '#6a4428', '#8a5e34'];
const FACE = ['#5a3a22', '#8a5e34', '#b88a52', '#dcb478', '#f4d8a0'];
const MOSS = ['#123020', '#1e4a2a', '#2e6a34', '#4a8e3c', '#7ab84a', '#b4e070'];

export const GROVE_STUMP_W = 56;
export const GROVE_STUMP_H = 17;
/** Where the companion's feet go on the stump (the centre of its top face), from the texture's top-left. */
export const GROVE_STUMP_TOP = { x: 28, y: 5 };

/** A low mossy tree stump: the cut face (rings, lit top-left), bark down the sides, roots, moss and two mushrooms. */
function stumpSprite(): HTMLCanvasElement {
  const g = grid(GROVE_STUMP_W, GROVE_STUMP_H);
  const cx = GROVE_STUMP_TOP.x;
  const topY = GROVE_STUMP_TOP.y;
  const rx = 19;
  const ry = 4.4;
  const base = 12;
  // roots spreading at the foot (drawn first: the trunk overlaps them)
  for (const [dir, len, th] of [
    [-1, 7, 2],
    [1, 8, 2],
    [-1, 3, 2],
    [1, 4, 1],
  ] as const)
    for (let k = 0; k < len + 3; k++) {
      const x = cx + dir * (rx - 3 + k);
      const y = base - 2 + Math.round((k / (len + 3)) * 3);
      for (let t = 0; t < th - Math.floor(k / 5); t++) put(g, x, y + t, t === 0 ? BARK[3] : BARK[1 + (k % 2)]);
    }
  // the trunk: a short cylinder, lit from the left
  const body: Inside = (x, y) => y >= topY && y <= base && Math.abs(x + 0.5 - cx) <= rx + (y > base - 2 ? (y - base + 2) * 0.9 : 0);
  fill(g, body, (x, y) => {
    const u = (x + 0.5 - (cx - rx)) / (rx * 2);
    const groove = (x * 3 + Math.floor(y / 3)) % 5 === 0;
    return tone(BARK, 0.85 - u * 0.75 + (groove ? -0.2 : 0) - (y - topY) * 0.012);
  });
  // the cut face: an ellipse with rings, warm and lit from the top left
  const face = ell(cx, topY, rx, ry);
  fill(g, face, (x, y) => {
    const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - topY) / ry);
    const ring = Math.abs(((d * 4.2) % 1) - 0.5) < 0.16;
    const lit = 0.75 - (x + 0.5 - cx) / (rx * 4) - (y + 0.5 - topY) / 10;
    return tone(FACE, lit + (ring ? -0.25 : 0));
  });
  // the bark's lip round the face
  for (let x = cx - rx; x <= cx + rx; x++) {
    const dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)));
    put(g, x, topY + dy, BARK[2]);
  }
  // moss over the rim (left and back) and dripping down the side
  fill(g, (x, y) => face(x, y) && (x < cx - rx + 5 || y < topY - 2) && (x * 7 + y * 3) % 5 !== 0, (x, y) => tone(MOSS, 0.9 - (y - topY + 4) * 0.08 - (x > cx ? 0.2 : 0)));
  for (const [x, len] of [
    [cx - rx + 1, 5],
    [cx - rx + 3, 7],
    [cx - rx + 6, 3],
    [cx + 5, 3],
  ])
    for (let k = 0; k < len; k++) put(g, x + (k % 3 === 2 ? 1 : 0), topY + 2 + k, k < 2 ? MOSS[4] : MOSS[k % 2 ? 2 : 3]);
  fill(g, rect(cx - rx - 2, base, cx - rx + 8, base + 1), (x, y) => ((x + y) % 3 === 0 ? MOSS[1] : MOSS[3]));
  // two little mushrooms at the foot
  stamp(g, ['.rRr.', 'rRWRr', '..s..', '..s..'], { r: '#b02a2a', R: '#e0463c', W: '#ffe0d0', s: '#e8dcc8' }, cx + rx - 2, base - 2);
  stamp(g, ['.rR.', 'rRWr', '.s..'], { r: '#b02a2a', R: '#e0463c', W: '#ffe0d0', s: '#e8dcc8' }, cx + rx + 3, base);
  return toCanvas(g);
}

let registered = false;

/** Register the grove theme, paint its backdrop (with our floor) and the stump (once). */
export function ensureGroveArt(scene: Phaser.Scene): void {
  if (!registered) {
    registerStageTheme(GROVE_THEME, GROVE, paintGrove);
    registered = true;
  }
  const key = `uistage_${GROVE_THEME}`;
  if (!scene.textures.exists(key)) {
    const c = paintStage(GROVE);
    paintGroveFloor(c.getContext('2d')!, c.width, c.height, GROVE);
    // (L7: the menus' stages in the mood's darker light)
    scene.textures.addCanvas(key, moodGrade(c, 0.2));
  }
  if (!scene.textures.exists('grove_stump')) scene.textures.addCanvas('grove_stump', stumpSprite());
}
