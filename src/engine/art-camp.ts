// Camp art (see docs/art-style.md): the camp backdrop (a night clearing: the campfire, the bag tent, the forge, the
// locked shrine), the smith's sprites and her story portrait.
//
// Textures (draw every sprite with origin (0.5, 1), bottom-centre, at its CAMP_SPOTS point):
//   camp_bg          GAME_W x GAME_H backdrop (no flames, no people: those animate on top). It already holds the
//                    fire pit's stone ring and embers, the log, the anvil, Rowan's planted sword and the firewood.
//   camp_fire0..3    20x24 flames, a 4-frame flicker loop (CAMP_SPOTS.fire is where they stand, on the pit)
//   smith_idle0/1    40x40 Mags at her anvil, hammer on her shoulder (2-frame breathing idle)
//   smith_hammer0..2 40x40 raise, strike, rebound: all frames share the 40x40 box and the feet point, so the
//                    strike lands on the anvil painted in camp_bg (CAMP_SPOTS.smith)
//   camp_rowan0/1    32x33 Rowan sitting on the log, warming his hands at the fire (frame 1 breathes out)
//   camp_pip0/1      16x17 Pip perched on the log (frame 1: eyes drowsy, settled 1px lower)
//   camp_sable0/1    22x31 Sable perched on the firewood right of the fire, facing it, drawing a whetstone along a
//                    dagger (frame 1: the stone at the tip, a spark, the shoulders 1px lower; CAMP_SPOTS.sable)
//   portrait_smith   40x40 story portrait (faces left, like the villains)
//
// The backdrop is painted like the fight backdrops (backdrop.ts toolkit): a teal night sky with a moon and stars,
// layered tree lines and a low mist, a clearing, then a pass of warm light from the campfire and the forge's hearth,
// and last the buildings and props as outlined sprites (each carrying its own firelight), smoke and fireflies.
// The top ~16 px and the bottom ~20 px stay calm for the UI; nothing important sits in the 23 px safe areas.
import { grid, put, stamp, toCanvas, type Grid, type Pal } from './art';
import { and, ell, fill, lambert, moodGrade, not, or, portraitMood, rect, rimShade, sphere, stroke, tone, type Inside } from './art-paint';
import { SABLE_FIST, SABLE_HEAD, SABLE_PAL, SABLE_TORSO, sableArm, sableDagger, scarfTail } from './art-sable';
import { PORTRAIT_SIZE } from './art-story';
import { bay, clamp01, col, conifer, fbm, hash, level, mass, mix, noise, pick, Pix, ramp, rng, tree, type Blob, type Col, type Ramp } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Where things stand on the camp backdrop (bottom-centre points, game px); buildings are tap targets. */
export const CAMP_SPOTS = {
  fire: { x: 150, y: 117 },
  rowan: { x: 125, y: 122 },
  pip: { x: 103, y: 115 },
  sable: { x: 175, y: 124 },
  smith: { x: 228, y: 113 },
  bag: { x: 30, y: 57, w: 60, h: 51 },
  forge: { x: 182, y: 33, w: 70, h: 80 },
  shrine: { x: 264, y: 54, w: 40, h: 52 },
};


// ------------------------------------------------------------------ the night clearing

/** The back of the clearing: where the tree line meets the grass. */
const HORIZON = 86;
const FIRE_LIGHT = { x: 150, y: 112 };

const SKY = ramp('#081218', '#0b161e', '#0e1a22', '#122230', '#162a34', '#1c3440');
const FAR = ramp('#122530', '#173039', '#1e3c44', '#284a50', '#33585c');
const MID = ramp('#0a141a', '#0e1c22', '#14272c', '#1c3436', '#284642', '#365852');
const NEAR = ramp('#05090d', '#081016', '#0c171c', '#111f24', '#182a2c');
const GRASS = ramp('#0b151a', '#0f1d21', '#142629', '#1a302f', '#213b36', '#2a4a3e');
const DIRT = ramp('#140e12', '#1e1618', '#2a1f1e', '#382a24', '#4a382c');
const WARM = col('#ff9040');

function sky(p: Pix): void {
  for (let y = 0; y < HORIZON; y++)
    for (let x = 0; x < p.w; x++) p.set(x, y, pick(SKY, clamp01((y - 6) / 70), x, y, 0.5));
  // the moon, low over the left woods, with a soft dithered halo
  const mx = 92;
  const my = 30;
  for (let y = my - 18; y <= my + 18; y++)
    for (let x = mx - 18; x <= mx + 18; x++) {
      const d = Math.hypot(x + 0.5 - mx, (y + 0.5 - my) * 1.05);
      if (d < 7.2) continue;
      const k = clamp01(1 - (d - 7) / 11);
      if (k > 0) p.tint(x, y, (c) => mix(c, col('#3e6a6a'), (level(k * k, 3, x, y, 0.7) / 3) * 0.45));
    }
  const moonR = ramp('#7aa49a', '#a8cabc', '#d0e6d8', '#eef8ee');
  for (let y = my - 8; y <= my + 8; y++)
    for (let x = mx - 8; x <= mx + 8; x++) {
      const dx = (x + 0.5 - mx) / 7;
      const dy = (y + 0.5 - my) / 7;
      if (dx * dx + dy * dy > 1) continue;
      // lit from the top left, a few soft maria
      let v = 0.75 - dx * 0.35 - dy * 0.3;
      if (noise(x * 0.45, y * 0.45, 5) > 0.62) v -= 0.3;
      p.set(x, y, pick(moonR, v, x, y));
    }
  // stars: dim specks, brighter ones, and a few four-point twinkles
  const r = rng(77);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(r() * p.w);
    const y = Math.floor(2 + r() * 62);
    if (Math.hypot(x - mx, y - my) < 13) continue;
    const b = r();
    p.set(x, y, b > 0.85 ? col('#e8f8f0') : b > 0.5 ? col('#9cc4b8') : col('#4e7a78'));
  }
  for (const [x, y] of [
    [40, 10],
    [139, 8],
    [176, 22],
    [212, 6],
    [268, 14],
    [302, 30],
    [60, 44],
  ]) {
    p.set(x, y, col('#ffffff'));
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      p.set(x + dx, y + dy, col('#7aa49a'));
  }
}

/** Bark: a tapering trunk lit from the left, with grooves. */
function trunk(p: Pix, cx: number, yTop: number, yBot: number, wTop: number, wBot: number, r: Ramp, seed: number): void {
  for (let y = Math.floor(yTop); y < yBot; y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const half = (wTop + (wBot - wTop) * t) / 2 + 2.2 * Math.max(0, t - 0.8) ** 2 / 0.04 * 0.25;
    const c0 = cx + (noise(y * 0.08, 1, seed) - 0.5) * 2;
    for (let x = Math.round(c0 - half); x <= Math.round(c0 + half); x++) {
      const u = (x - (c0 - half)) / Math.max(1, half * 2);
      let v = 0.75 - u * 0.7;
      if (noise(x * 0.6, y * 0.1, seed) > 0.62) v -= 0.25;
      p.set(x, y, pick(r, v, x, y, 0.15));
    }
  }
}

function woods(p: Pix): void {
  const w = p.w;
  const rnd = rng(19);
  // far line: hazy crowns and pointed firs, lower in the middle where the clearing opens to the sky
  const dip = (x: number) => 1 - Math.exp(-(((x - 150) / 70) ** 2)) * 0.55;
  const farB: Blob[] = [];
  for (let x = -6; x < w + 6; x += 5 + rnd() * 4) farB.push({ x, y: HORIZON - 10 - dip(x) * 18 - rnd() * 5, rx: 5 + rnd() * 3, ry: 5 + rnd() * 3 });
  mass(p, farB, { ramp: FAR, seed: 3, bump: 0.18, tex: 0.25, vgrad: 0.45, light: -0.02, floor: HORIZON });
  for (let x = 6; x < w; x += 14 + rnd() * 20) {
    const hg = (16 + rnd() * 14) * (0.55 + dip(x) * 0.6);
    conifer(p, rnd, x, HORIZON - 4, hg, 7 + rnd() * 3, { ramp: FAR, seed: 4 + x, bump: 0.15, tex: 0.2, vgrad: 0.3, floor: HORIZON });
  }
  // a few tall firs rising out of the far line
  for (const [x, hg] of [
    [118, 36],
    [176, 40],
    [250, 44],
    [140, 28],
  ])
    conifer(p, rnd, x, HORIZON - 2, hg, 11, { ramp: FAR, seed: x, bump: 0.15, tex: 0.2, vgrad: 0.4, light: 0.02, floor: HORIZON });
  // mid line: big dark crowns and firs either side of the clearing
  const plantMid = (x: number, s: number, fir: boolean, seed: number) => {
    const base = HORIZON + 1;
    if (fir) {
      conifer(p, rnd, x, base, 40 * s, 18 * s, { ramp: MID, seed, bump: 0.16, tex: 0.25, vgrad: 0.35, light: 0.02 });
    } else {
      trunk(p, x, base - 22 * s, base, 3, 4, NEAR, seed);
      tree(p, rnd, x, base - 30 * s, 14 * s, 13 * s, 3.4, { ramp: MID, seed, bump: 0.2, tex: 0.3, vgrad: 0.35, light: 0.02 });
    }
  };
  for (const [x, s, fir] of [
    [12, 1.25, false],
    [44, 1.05, true],
    [72, 0.85, false],
    [104, 0.55, true],
    [186, 0.7, true],
    [212, 0.75, false],
    [240, 0.95, true],
    [266, 0.9, false],
    [300, 1.2, false],
    [330, 1.1, true],
  ] as Array<[number, number, boolean]>)
    plantMid(x, s, fir, x + 11);
  // a low mist where the trees meet the clearing, then dark bushes along their feet
  for (let y = HORIZON - 16; y < HORIZON + 3; y++)
    for (let x = 0; x < w; x++) {
      const k = Math.exp(-(((y - (HORIZON - 4)) / 6) ** 2)) * (0.65 + noise(x * 0.05, y * 0.2, 2) * 0.5);
      const q = level(k, 3, x, y, 0.8) / 3;
      if (q > 0) p.tint(x, y, (c) => mix(c, col('#2c4c52'), q * 0.45));
    }
  const bush: Blob[] = [];
  for (let x = -4; x < w + 4; x += 6 + rnd() * 7) bush.push({ x, y: HORIZON + 1 - rnd() * 2, rx: 4 + rnd() * 4, ry: 2.6 + rnd() * 1.6 });
  mass(p, bush, { ramp: ramp('#081216', '#0c1a1e', '#122426', '#1a302e'), seed: 13, bump: 0.25, tex: 0.3, vgrad: 0.5, floor: HORIZON + 3 });
  // corner framing: near trunks and heavy crowns hanging into the top corners (they sit in the safe areas)
  for (const [cx, dir] of [
    [6, 1],
    [321, -1],
  ]) {
    trunk(p, cx + dir * 3, 10, 150, 7, 10, NEAR, cx);
    const bl: Blob[] = [];
    const r2 = rng(cx + 5);
    for (let i = 0; i < 26; i++) {
      const t = r2() ** 1.3;
      const rr = 5 + (1 - t) * 6 + r2() * 3;
      bl.push({ x: cx + dir * (t * 46 - 4), y: -4 + (1 - t) * 26 + r2() * 10 - t * 6, rx: rr, ry: rr * 0.8 });
    }
    mass(p, bl, { ramp: NEAR, seed: cx, bump: 0.2, tex: 0.3, vgrad: 0.15, shadow: 0.25, form: { x: cx + dir * 14, y: 4, rx: 30, ry: 26 }, formMix: 0.35 });
  }
}

/** How trodden the ground is (> 0: bare earth): round the fire, and paths to the tent and the forge. */
function trodden(x: number, y: number): number {
  const n = (noise(x * 0.16, y * 0.35, 8) - 0.5) * 0.45;
  let k = 1 - Math.hypot((x + 0.5 - FIRE_LIGHT.x) / 46, (y + 0.5 - 119) / 11.5) + n;
  const path = (ax: number, ay: number, bx: number, by: number, wd: number) => {
    const t = clamp01(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2));
    const d = Math.hypot(x - (ax + (bx - ax) * t), (y - (ay + (by - ay) * t)) * 1.8);
    k = Math.max(k, (wd - d) / wd + n * 0.9);
  };
  path(130, 115, 66, 108, 7);
  path(166, 116, 210, 109, 7);
  return k;
}

function clearing(p: Pix): void {
  const w = p.w;
  const H = p.h;
  for (let y = HORIZON - 2; y < H; y++)
    for (let x = 0; x < w; x++) {
      if (y < HORIZON + 1 && p.get(x, y) !== -1 && !SKY.includes(p.get(x, y))) continue;
      const t = (y - HORIZON) / (H - HORIZON);
      const v = 0.32 + t * 0.25 + (fbm(x * 0.09, y * 0.2, 21) - 0.5) * 0.45;
      p.set(x, y, pick(GRASS, v, x, y, 0.3));
    }
  // bare earth with a crisp, darker lip where the grass starts
  for (let y = HORIZON + 4; y < H; y++)
    for (let x = 0; x < w; x++) {
      const k = trodden(x, y);
      if (k <= 0) continue;
      const v = k < 0.1 ? 0.1 : 0.42 + (fbm(x * 0.2, y * 0.4, 9) - 0.5) * 0.7;
      p.set(x, y, pick(DIRT, v, x, y));
    }
  // stepping stones from the forge to the shrine
  for (const [x, y] of [
    [236, 110],
    [246, 108],
    [256, 107],
    [265, 105],
  ]) {
    for (let dx = -2; dx <= 2; dx++) {
      p.set(x + dx, y, col(dx < 0 ? '#4c4e5a' : '#3a3b48'));
      if (Math.abs(dx) < 2) p.set(x + dx, y - 1, col(dx < 1 ? '#666874' : '#4c4e5a'));
      p.set(x + dx, y + 1, col('#141a1e'));
    }
  }
  // pebbles on the earth
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(100 + r() * 120);
    const y = Math.floor(106 + r() * 24);
    if (trodden(x, y) < 0.15) continue;
    p.set(x, y, col('#6a5a50'));
    p.set(x + 1, y, col('#4a3c36'));
    p.set(x, y + 1, col('#1e1416'));
    p.set(x + 1, y + 1, col('#1e1416'));
  }
  // grass tufts across the clearing (none on the bare earth)
  const tuftR = ramp('#0f1d21', '#1a302f', '#2a4a3e', '#3e6450');
  for (let i = 0; i < 130; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(HORIZON + 3 + r() * (H - HORIZON - 4));
    if (trodden(x, y) > -0.05) continue;
    const hgt = 2 + Math.floor(r() * 2 + (y - HORIZON) / 30);
    const n = 3 + Math.floor(hash(x, y, 3) * 3);
    for (let b = 0; b < n; b++) {
      const off = b - (n - 1) / 2;
      const bh = Math.max(1, Math.round(hgt - Math.abs(off) * 0.9));
      for (let k = 0; k < bh; k++) p.set(x + Math.round(off * (0.5 + (k / bh) * 0.6)), y - 1 - k, tuftR[k === bh - 1 ? (off <= 0 ? 3 : 2) : k < bh * 0.4 ? 0 : 1]);
    }
  }
}

const mixHex = (a: string, b: string, t: number) => '#' + mix(col(a), col(b), t).toString(16).padStart(6, '0');

/** Night life over the finished picture: chimney smoke, fireflies, glowing mushrooms by the shrine, dark grass in the near corners. */
function nightLife(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const px = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  // smoke rising from the chimney, then leaning right and thinning into the sky
  for (let i = 4; i >= 0; i--) {
    const t = i / 4;
    const cx = 221 + t * t * 14 + Math.sin(t * 6) * 1;
    const cy = 29 - t * 19;
    const r = 1.6 + t * 2.6;
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2) / r;
        if (d > 1 || (d > 0.7 && bay(x, y) > 0.5)) continue;
        const lit = x + 0.5 - cx + (y + 0.5 - cy) < -r * 0.3;
        px(x, y, mixHex(lit ? '#3e565a' : '#2c4046', '#132630', 0.15 + t * 0.6));
      }
  }
  // glowing mushrooms at the shrine's foot
  for (const [x, y, big] of [
    [262, 102, true],
    [266, 103, false],
    [303, 101, true],
    [299, 102, false],
  ] as Array<[number, number, boolean]>) {
    ctx.fillStyle = '#140c1c';
    ctx.fillRect(x - (big ? 2 : 1), y - (big ? 3 : 2), big ? 5 : 3, big ? 4 : 3);
    px(x, y, '#c8d8d0');
    px(x, y - 1, '#c8d8d0');
    ctx.fillStyle = '#62e4d4';
    ctx.fillRect(x - (big ? 1 : 0), y - (big ? 2 : 1), big ? 3 : 1, 1);
    if (big) px(x - 1, y - 2, '#d8fff6');
  }
  // fireflies: a bright speck with a soft cross of light
  for (const [x, y] of [
    [30, 92],
    [52, 58],
    [96, 80],
    [148, 70],
    [176, 86],
    [258, 78],
    [292, 92],
    [308, 64],
    [86, 132],
    [240, 128],
    [20, 118],
  ]) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      px(x + dx, y + dy, '#4e6a3a');
    px(x, y, '#eaff9a');
  }
  // dark grass blades in the near corners
  const r = rng(91);
  for (const [x0, x1] of [
    [0, 34],
    [w - 34, w],
  ])
    for (let x = x0; x < x1; x++) {
      const edge = x0 === 0 ? 1 - x / (x1 - x0) : (x - x0) / (x1 - x0);
      const hgt = Math.round((4 + r() * 9) * edge);
      for (let k = 0; k < hgt; k++) px(x + Math.round(((k / Math.max(1, hgt)) ** 2) * (x0 === 0 ? 1 : -1) * 2), h - 1 - k, k > hgt - 2 ? '#0e1a1c' : '#060b0e');
    }
}

// ------------------------------------------------------------------ the buildings (outlined sprites)

/** A sprite painted on a grid; toCanvas adds the ink outline. */
function sprite(w: number, h: number, paint: (g: Grid) => void): HTMLCanvasElement {
  const g = grid(w, h);
  paint(g);
  return toCanvas(g);
}

// canvas: cool in the moon's shade, warm on the side facing the fire (dark -> light)
const CANVAS = ['#1c1c26', '#2e2e38', '#4a4448', '#6e5e58', '#988068', '#c4a47c', '#e8cc98'];
const LEATHER = ['#2a1418', '#4a2618', '#723e1e', '#9a5a2a', '#c27c3a', '#e8a456'];
const PLANK = ['#2e1a14', '#4e2e1c', '#6e4426', '#8e5e32', '#b07a44', '#d09a5e'];

/** The bag: a canvas tent with a big leather backpack in front and a hanging sign. Its foot is the canvas bottom. */
function tentSprite(): HTMLCanvasElement {
  const W = 64;
  const H = 52;
  return sprite(W, H, (g) => {
    const base = H - 3;
    const ax = 27; // front apex
    const ay = 7;
    const half = (y: number) => ((y - ay) / (base - ay)) * 23;
    const front: Inside = (x, y) => y >= ay && y <= base && Math.abs(x + 0.5 - ax) <= half(y) + 0.5;
    // the right roof side, seen a little from the right: it faces the fire
    const bx0 = 38; // back apex
    const by0 = 4;
    const xr = (y: number) => bx0 + ((y - by0) / (base - 6 - by0)) * 21;
    const side: Inside = (x, y) => {
      if (front(x, y) || x < ax) return false;
      const px = x + 0.5;
      const top = px <= bx0 ? ay - ((px - ax) / (bx0 - ax)) * (ay - by0) : by0;
      const bot = px <= ax + 23 ? base : base - ((px - ax - 23) / (xr(base - 6) - ax - 23)) * 6;
      return y + 0.5 >= top && y <= bot && px <= xr(y + 0.5);
    };
    fill(g, side, (x, y) => {
      // seams run down the slope; the panel brightens toward the fire and the ground
      const u = (x + 0.5 - ax) - (y - ay) * 0.55;
      const seam = Math.abs(((u % 7) + 7) % 7 - 3.5) < 0.5;
      return tone(CANVAS, 0.66 + (y - by0) / 160 + (seam ? -0.14 : 0));
    });
    for (let y = by0 + 1; y < base - 6; y++) put(g, Math.floor(xr(y + 0.5) - 0.5), y, CANVAS[6]); // the rim catching the firelight
    // the front: dim on the moon side, warmer toward the fire, seams fanning from the apex, a little sag at the hem
    fill(g, front, (x, y) => {
      const u = (x + 0.5 - (ax - half(y))) / Math.max(1, half(y) * 2);
      let v = 0.2 + u * 0.36 + (y - ay) / 180;
      for (const k of [0.5, 0.78]) if (Math.abs(x + 0.5 - (ax - half(y) * k)) < 0.55 || Math.abs(x + 0.5 - (ax + half(y) * k)) < 0.55) v -= 0.1;
      return tone(CANVAS, v);
    });
    for (let y = ay; y <= base; y++) put(g, Math.round(ax - half(y)), y, y < ay + 8 ? '#8aa6a0' : '#5a6e70'); // moonlit left rim
    for (let x = Math.round(ax - half(base)); x <= Math.round(ax + half(base)); x++) put(g, x, base, CANVAS[1]);
    // a patch sewn on the moon side
    fill(g, rect(13, 34, 16, 37), (x, y) => (x === 13 || y === 34 ? '#6a6070' : (x + y) % 2 ? '#4a4450' : '#55505c'));
    // the open door: a dark interior (a red bedroll inside), flaps tied back either side
    const door: Inside = (x, y) => y >= 17 && y <= base - 1 && Math.abs(x + 0.5 - ax) <= ((y - 17) / (base - 17)) * 10 + 0.5;
    fill(g, door, (x, y) => (y > base - 5 && x > ax - 6 && x < ax + 5 ? (y === base - 4 ? '#c03a40' : x < ax ? '#7a2430' : '#5a1a26') : y < 24 ? '#0a0810' : '#120c16'));
    for (const s of [-1, 1]) {
      for (let y = 19; y <= base - 1; y++) {
        const e = ax + s * (((y - 17) / (base - 17)) * 10 + 1);
        const wdt = Math.max(1, Math.round(1 + (y - 19) * 0.12));
        for (let k = 0; k < wdt; k++) put(g, Math.round(e + s * k), y, s < 0 ? tone(CANVAS, 0.46 - k * 0.06) : tone(CANVAS, 0.74 - k * 0.08));
      }
      put(g, Math.round(ax + s * 8), 32, PLANK[1]);
      put(g, Math.round(ax + s * 8) + s, 32, PLANK[2]);
      put(g, Math.round(ax + s * 8) + s * 2, 32, PLANK[1]);
    }
    // ridge pole tip, guy ropes and pegs
    stamp(g, ['.h.', 'hHd', '.d.'], { h: PLANK[3], H: PLANK[5], d: PLANK[1] }, ax - 1, ay - 3);
    for (let i = 0; i < 8; i++) put(g, ax + 24 + i * 0.55, base - 12 + i * 1.5, PLANK[3]);
    stamp(g, ['H', 'd'], { H: PLANK[4], d: PLANK[1] }, ax + 28, base - 1);
    for (let i = 0; i < 7; i++) put(g, ax - 23 - i * 0.45, base - 10 + i * 1.5, PLANK[2]);
    // the hanging sign under the apex: a plank on two cords with a backpack painted on it
    put(g, ax - 4, 12, PLANK[2]);
    put(g, ax + 4, 12, PLANK[2]);
    fill(g, rect(ax - 7, 13, ax + 7, 21), (x, y) => (y === 13 ? PLANK[5] : y === 21 ? PLANK[1] : x === ax - 7 ? PLANK[4] : x === ax + 7 ? PLANK[2] : (x + y * 3) % 9 === 0 ? PLANK[2] : PLANK[3]));
    stamp(g, ['..GG..', '.G..g.', 'GGggyy', 'GgYYgy', 'gggyyY'], { G: '#fff4d0', g: '#f2c860', y: '#d89a40', Y: '#9a5a14' }, ax - 3, 15);
    // a lantern hung by the door, glowing warm
    for (let y = 23; y <= 25; y++) put(g, ax - 10, y, PLANK[1]);
    stamp(g, ['.k.', 'kGk', 'gWg', 'kyk', '.k.'], { k: '#3a2418', G: '#fff0a0', W: '#ffffff', g: '#ffd060', y: '#e89030' }, ax - 11, 26);
    // the backpack: a big rounded leather sack with a flap and buckle, a rolled red blanket on top, lit by the fire
    const bx = 44;
    const by = 37;
    const sack = and(or(ell(bx, by, 8, 9.5), rect(bx - 8, by + 1, bx + 8, base)), (_x, y) => y <= base);
    fill(g, sack, (x, y) => tone(LEATHER, 0.12 + 0.95 * Math.max(0, 0.45 + (x + 0.5 - bx) * 0.035 - (y + 0.5 - by) * 0.02) + (x > bx + 5 ? 0.12 : 0)));
    rimShade(g, sack, LEATHER[1]);
    for (let y = by - 6; y <= base - 1; y++) if (sack(bx + 8, y)) put(g, bx + 8, y, LEATHER[5]); // firelit edge
    // the side pocket and the straps
    fill(g, rect(bx - 7, by + 3, bx - 3, by + 9), (x, y) => (y === by + 3 ? LEATHER[4] : x === bx - 7 ? LEATHER[3] : LEATHER[2]));
    for (let y = by - 5; y <= base; y++) {
      put(g, bx + 1, y, y % 3 === 0 ? LEATHER[1] : LEATHER[2]);
      put(g, bx + 5, y, y % 3 === 1 ? LEATHER[2] : LEATHER[3]);
    }
    // the flap with a gold buckle
    fill(g, and(ell(bx + 0.5, by - 4, 8.5, 5.5), (_x, y) => y >= by - 9 && y <= by), (x, y) => (y === by ? LEATHER[1] : tone(LEATHER, 0.62 + (x - bx) * 0.03 - (y - by + 9) * 0.02)));
    stamp(g, ['GgY', 'g.y', 'yYz'], { G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', z: '#5a3410' }, bx, by - 1);
    // the blanket roll strapped across the top
    const roll = ell(bx + 0.5, by - 10, 9.5, 2.8);
    fill(g, roll, (x, y) => ((x + 1) % 4 === 0 ? '#e8d8b8' : y < by - 10 ? '#f05a48' : y === by - 10 ? '#c83030' : '#8a1a22'));
    fill(g, ell(bx + 9.5, by - 10, 1.4, 2.6), (_x, y) => (y < by - 10 ? '#ff9a80' : '#d03030'));
    put(g, bx - 4, by - 10, LEATHER[1]);
    put(g, bx + 5, by - 10, LEATHER[1]);
  });
}

// fieldstone: cool in the moonlight, shadows lean blue-purple (dark -> light)
const FSTONE = ['#16151f', '#24242f', '#363744', '#4c4e5a', '#666874', '#868894', '#a8a8b0'];
const MOSS_R = ['#122218', '#1a3222', '#26482c', '#386236', '#527e40'];
const HOT = ['#5a1418', '#a82a1c', '#e05a1c', '#ff9a2a', '#ffd25a', '#fff6c8'];
const IRON = ['#141420', '#22222e', '#363846', '#525668', '#7a8094', '#b4bccc'];

/** Rounded fieldstones in courses: each stone lit from the top left, mortar between them. */
function stones(g: Grid, inside: Inside, seed: number, light: (x: number, y: number) => number, rampS = FSTONE): void {
  fill(g, inside, (x, y) => {
    const row = Math.floor((y + seed) / 4);
    const off = (row * 5 + seed) % 7;
    const sx = Math.floor((x + off) / 6);
    const u = ((x + off) % 6) / 5;
    const v = ((y + seed) % 4) / 3;
    const mortar = (x + off) % 6 === 5 || (y + seed) % 4 === 3;
    const jit = (hash(sx, row, seed) - 0.5) * 0.12;
    const t = light(x, y) + jit + (mortar ? -0.22 : 0.14 - u * 0.12 - v * 0.12);
    return tone(rampS, t);
  });
}

/** The forge: a fieldstone hearth glowing in its arch, a tall chimney, bellows, and a lean-to over the quench barrel. */
function forgeSprite(): HTMLCanvasElement {
  const W = 70;
  const H = 74;
  return sprite(W, H, (g) => {
    const base = H - 3;
    // light on the stone: the campfire from the left, the moon from above, dark toward the right
    const lit = (x: number, y: number) => 0.5 - (x - 8) / 110 - (y - 30) / 300;
    // lean-to on the right: a plank roof on a post, sheltering the quench barrel
    for (let y = 38; y <= base; y++) put(g, 63, y, y % 5 === 0 ? PLANK[1] : PLANK[2]);
    for (let y = 38; y <= base; y++) put(g, 64, y, PLANK[1]);
    for (let i = 0; i < 26; i++) {
      const x = 42 + i;
      const y0 = Math.round(29 + i * 0.42);
      put(g, x, y0, i % 4 === 0 ? PLANK[3] : PLANK[4]);
      put(g, x, y0 + 1, PLANK[2]);
      put(g, x, y0 + 2, PLANK[1]);
    }
    // the barrel with dark water, and a pair of tongs leaning on it
    const barrel = rect(50, 56, 60, base);
    fill(g, barrel, (x, y) => (y === 59 || y === 66 ? IRON[3] : x === 50 ? PLANK[3] : x > 57 ? PLANK[1] : PLANK[2]));
    fill(g, rect(51, 56, 59, 56), () => '#1e3a44');
    put(g, 52, 56, '#3e6a70');
    for (let i = 0; i < 12; i++) put(g, 48 + Math.round(i * 0.25), 52 + i, IRON[i < 2 ? 4 : 2]);
    // the chimney: courses of stone tapering up to a cap, lit on its left
    const chim: Inside = (x, y) => y >= 5 && y <= 46 && Math.abs(x + 0.5 - 39) <= 6.5 - (46 - y) * 0.05;
    stones(g, chim, 1, (x, y) => 0.62 - (x - 33) * 0.055 - (y < 20 ? 0.04 : 0));
    fill(g, rect(30, 2, 47, 5), (x, y) => (y === 2 ? FSTONE[5] : y === 5 ? FSTONE[1] : x < 36 ? FSTONE[4] : FSTONE[3]));
    // soot round the chimney mouth
    for (let x = 33; x <= 45; x++) if ((x * 7) % 3) put(g, x, 6, FSTONE[1]);
    // the hearth body: a squat mass of fieldstones
    const body: Inside = (x, y) => y >= 40 && y <= base && x >= 4 && x <= 48 && !(y < 43 && (x < 6 || x > 46)) && !(y < 42 && (x < 5 || x > 47));
    stones(g, body, 3, lit);
    // moss on the top course
    for (let x = 6; x <= 46; x++) {
      const m = noise(x * 0.4, 2, 9);
      if (m < 0.45) continue;
      put(g, x, 40, m > 0.7 ? MOSS_R[4] : MOSS_R[3]);
      if (m > 0.6) put(g, x, 41, MOSS_R[2]);
    }
    // a sloped hood from the hearth up into the chimney
    const hood: Inside = (x, y) => y >= 30 && y < 40 && Math.abs(x + 0.5 - 30) <= 8 + (y - 30) * 0.9;
    fill(g, hood, (x, y) => (y === 39 ? FSTONE[1] : y === 30 ? FSTONE[4] : tone(FSTONE, 0.55 - (x - 22) * 0.018 - (y - 30) * 0.01)));
    // the arched hearth mouth and its glow
    const hx = 17;
    const arch: Inside = (x, y) => y <= base - 3 && y >= 50 && (y >= 56 || (x + 0.5 - hx) ** 2 / 49 + (y + 0.5 - 56) ** 2 / 36 <= 1) && Math.abs(x + 0.5 - hx) <= 7;
    const ring: Inside = (x, y) => !arch(x, y) && y <= base - 3 && y >= 47 && (y >= 56 ? Math.abs(x + 0.5 - hx) <= 9 : (x + 0.5 - hx) ** 2 / 81 + (y + 0.5 - 56) ** 2 / 72 <= 1);
    fill(g, ring, (x, y) => {
      const d = Math.hypot(x + 0.5 - hx, (y + 0.5 - 58) * 1.2);
      return tone(['#2a1418', '#5a2a1c', '#8e4424', '#c06a30', '#e89448'], 0.95 - d / 14 + ((x + y) % 3 === 0 ? -0.1 : 0));
    });
    fill(g, arch, (x, y) => {
      const d = Math.hypot((x + 0.5 - hx) * 0.8, y + 0.5 - (base - 4));
      return tone(HOT, 1.05 - d / 11);
    });
    // coals heaped on the hearth floor
    for (let x = hx - 6; x <= hx + 6; x++) {
      const top = base - 5 - Math.round(Math.max(0, 2.2 - Math.abs(x + 0.5 - hx) * 0.35));
      for (let y = top; y <= base - 3; y++) put(g, x, y, (x * 3 + y * 5) % 4 === 0 ? HOT[2] : y === top ? HOT[5] : HOT[4]);
    }
    fill(g, rect(hx - 9, base - 2, hx + 9, base), (x, y) => (y === base - 2 ? FSTONE[5] : x < hx ? FSTONE[3] : FSTONE[2]));
    // leather bellows on the left, nozzle into the hearth side
    const bel: Inside = (x, y) => x >= 1 && x <= 6 && Math.abs(y + 0.5 - 60) <= 1 + (x - 1) * 0.6;
    fill(g, bel, (x, y) => (x % 3 === 0 ? LEATHER[1] : tone(LEATHER, 0.75 - (y - 56) * 0.06)));
    fill(g, rect(0, 59, 0, 61), () => PLANK[4]);
    stamp(g, ['dd', 'Hd'], { d: PLANK[2], H: PLANK[4] }, 7, 59);
    // tools on the wall: a hammer and tongs on pegs
    stamp(g, ['.IIi.', '..h..', '..h..', '..h..', '..d..'], { I: IRON[4], i: IRON[2], h: PLANK[4], d: PLANK[2] }, 38, 44);
    stamp(g, ['i.i', 'i.i', '.i.', 'i.i', 'i.i', 'i..'], { i: IRON[3] }, 43, 45);
  });
}

/** The anvil on its stump; the horn points left, toward the fire. Foot = canvas bottom. */
function anvilSprite(): HTMLCanvasElement {
  return sprite(22, 16, (g) => {
    stamp(
      g,
      [
        '...lLLLLLLLLLLLl...',
        'lLLSSSSSSSSSSSSsm..',
        '.mMssssssssssssmMm.',
        '...kMMmmmmmmmmMk...',
        '......mMMMMm.......',
        '......MMkkMM.......',
        '.....mMMMMMMm......',
        '....MMMkkkkMMk.....',
      ],
      { L: '#ffe0b0', l: '#e8a868', S: IRON[5], s: IRON[4], m: IRON[3], M: IRON[2], k: IRON[1] },
      1,
      1,
    );
    // the stump
    fill(g, rect(4, 9, 16, 13), (x, y) => (y === 9 ? PLANK[5] : x < 7 ? PLANK[4] : x > 13 ? PLANK[1] : (x + y) % 4 === 0 ? PLANK[2] : PLANK[3]));
    fill(g, rect(3, 13, 17, 14), (x) => (x < 7 ? PLANK[3] : PLANK[1]));
  });
}

/** The shrine: a mossy little stone house, boarded up with planks and chained with a big padlock (locked). */
function shrineSprite(): HTMLCanvasElement {
  const W = 38;
  const H = 51;
  return sprite(W, H, (g) => {
    const base = H - 3;
    const cool = (x: number, y: number) => 0.58 - (x - 4) / 70 - (y - 13) / 200;
    // plinth: two steps
    fill(g, rect(1, base - 3, 36, base), (x, y) => tone(FSTONE, (y === base - 3 ? 0.8 : 0.45) - (x - 1) / 90 + ((x * 5) % 7 === 0 ? -0.15 : 0)));
    fill(g, rect(3, base - 6, 34, base - 4), (x, y) => tone(FSTONE, (y === base - 6 ? 0.85 : 0.5) - (x - 3) / 90 + ((x * 3) % 8 === 0 ? -0.15 : 0)));
    // the dark niche between the pillars, something faintly violet asleep inside
    fill(g, rect(10, 20, 27, base - 7), (x, y) => (y < 23 ? '#06060c' : (x * 7 + y * 3) % 17 === 0 ? '#3a2a5a' : '#0c0c16'));
    stamp(g, ['.a.', '.a.', '.a.', 'aba', 'bcb', '.b.'], { a: '#2a2a40', b: '#3a3456', c: '#6a4a9a' }, 17, 25);
    for (const px of [4, 27]) stones(g, rect(px, 20, px + 6, base - 7), px, (x, y) => cool(x, y) + 0.05);
    // lintel and gabled roof slab, a stone orb on the ridge
    fill(g, rect(2, 16, 35, 20), (x, y) => (y === 16 ? FSTONE[5] : y === 20 ? FSTONE[1] : tone(FSTONE, cool(x, y) + 0.08)));
    const roof: Inside = (x, y) => y >= 5 && y < 16 && Math.abs(x + 0.5 - 18.5) <= (y - 4) * 1.6;
    fill(g, roof, (x, y) => tone(FSTONE, (x < 18 ? 0.7 : 0.38) - (y - 5) / 40 + ((x + y * 2) % 7 === 0 ? -0.12 : 0)));
    fill(g, ell(18.5, 3, 2.2, 2.2), (x, y) => (x + y < 20 ? FSTONE[5] : x + y < 22 ? FSTONE[4] : FSTONE[2]));
    // the carved compass rose of the Atlas on the gable, dark (the shrine sleeps)
    fill(g, and(ell(18.5, 11, 3.4, 3.4), not(ell(18.5, 11, 2.3, 2.3))), (x, y) => (x + y < 29 ? FSTONE[1] : FSTONE[2]));
    for (const [x, y] of [
      [18, 8],
      [18, 9],
      [18, 13],
      [18, 14],
      [15, 11],
      [16, 11],
      [20, 11],
      [21, 11],
      [18, 11],
    ])
      put(g, x, y, y === 11 && x === 18 ? '#5a4a7a' : '#4a3a6a');
    // moss over the roof and ivy down the left pillar
    fill(g, and(roof, (x, y) => y <= 6 + noise(x * 0.5, 1, 4) * 6 - Math.abs(x - 18) * 0.15), (x, y) => tone(MOSS_R, 0.95 - (y - 5) * 0.12 - (x > 18 ? 0.25 : 0)));
    for (const [x, len] of [
      [3, 9],
      [5, 15],
      [7, 6],
      [30, 6],
    ])
      for (let k = 0; k < len; k++) put(g, x + (k % 3 === 2 ? 1 : 0), 17 + k, k % 2 ? MOSS_R[2] : MOSS_R[3]);
    // boarded up: two planks across the doorway, nailed
    const plank = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n);
        const y = Math.round(y0 + ((y1 - y0) * i) / n);
        put(g, x, y - 1, PLANK[5]);
        put(g, x, y, PLANK[3]);
        put(g, x, y + 1, PLANK[3]);
        put(g, x, y + 2, PLANK[1]);
      }
      for (const [nx, ny] of [
        [x0 + 1, y0],
        [x1 - 1, y1],
      ]) {
        put(g, nx, ny, '#c8ccd8');
        put(g, nx, ny + 1, '#5a5e70');
      }
    };
    plank(7, 35, 30, 27);
    plank(8, 25, 29, 26);
    // chalk scrawl on the plank ("soon")
    for (const x of [12, 13, 15, 17, 18, 20, 22, 23]) put(g, x, 26, '#e8e4d0');
    // a heavy padlock on a chain looped across the doorway
    for (let x = 9; x <= 28; x++) put(g, x, Math.round(31 + Math.sin(((x - 9) / 19) * Math.PI) * 3), x % 2 ? '#9aa0b0' : '#5a5e70');
    stamp(
      g,
      ['...yYYy...', '..y....y..', '..Y....Y..', '.GGgggggyY', '.Ggg..ggyY', '.Gggkkggyz', '.gggkkgyyz', '.ggggkgyyz', '.yyyyyyYzz'],
      { G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14', z: '#5a3410', k: '#2a1810' },
      13,
      30,
    );
  });
}

/** The fire pit: a ring of stones round crossed logs with glowing ends. Centre = (11, 6) in the canvas. */
function firePitSprite(): HTMLCanvasElement {
  return sprite(24, 11, (g) => {
    // embers and ash in the pit
    fill(g, ell(11.5, 6, 8, 2.6), (x, y) => ((x * 7 + y * 3) % 5 === 0 ? HOT[3] : (x + y) % 3 === 0 ? '#3a1a18' : '#24141a'));
    // two crossed logs, their ends charred and glowing
    for (const [x0, y0, x1, y1] of [
      [5, 7, 17, 4],
      [6, 4, 18, 7],
    ]) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n);
        const y = Math.round(y0 + ((y1 - y0) * i) / n);
        const end = i < 2 || i > n - 2;
        put(g, x, y, end ? HOT[4] : PLANK[3]);
        put(g, x, y + 1, end ? HOT[2] : PLANK[1]);
      }
    }
    // the stone ring: front stones lit by the fire from behind, back stones lit on their inner face
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const sx = Math.round(11.5 + Math.cos(a) * 9.5 - 1);
      const sy = Math.round(6 + Math.sin(a) * 3.2 - 1);
      const front = Math.sin(a) > 0;
      stamp(g, front ? ['abb', 'bcc'] : ['dcb', 'cbb'], { a: FSTONE[5], b: FSTONE[3], c: FSTONE[2], d: '#c08060' }, sx, sy);
    }
  });
}

/** The log by the fire (Rowan and Pip sit on it): bark lit from the fire on the right, the cut end facing left. */
function logSprite(): HTMLCanvasElement {
  return sprite(38, 11, (g) => {
    const body = rect(4, 1, 35, 8);
    fill(g, body, (x, y) => {
      const v = y === 1 ? 0.9 : y === 2 ? 0.75 : y >= 7 ? 0.12 : 0.45 + (x - 4) / 120;
      return tone(PLANK, v + ((x * 5 + y * 3) % 11 === 0 ? -0.2 : 0) + (y > 2 && (x + y * 2) % 7 === 0 ? -0.12 : 0));
    });
    // the cut end: rings
    fill(g, ell(3.5, 4.5, 3.2, 4.2), (x, y) => {
      const d = Math.hypot(x + 0.5 - 3.5, (y + 0.5 - 4.5) * 0.8);
      return d < 1 ? '#8e5e32' : d < 2 ? '#d8a868' : d < 2.6 ? '#b07a44' : '#e8c48a';
    });
    // a broken-off branch stub and a tuft of moss
    stamp(g, ['hH', 'dh'], { h: PLANK[3], H: PLANK[4], d: PLANK[1] }, 22, 0);
    for (const x of [9, 10, 11, 30, 31]) put(g, x, 1, MOSS_R[3]);
    put(g, 10, 0, MOSS_R[4]);
    // dry grass at its foot
    for (const x of [6, 12, 19, 27, 33]) put(g, x, 9, '#2a4a3e');
  });
}

/** Rowan's sword, planted in the ground by the log. */
function swordSprite(): HTMLCanvasElement {
  return sprite(5, 16, (g) => stamp(g, ROWAN_SWORD, { ...ROWAN_PAL, C: '#8a94b4', T: '#b8c2d8' }, 1, 1));
}

/** Firewood stacked by a stump with the woodcutter's axe in it. Foot = canvas bottom. */
function woodpileSprite(): HTMLCanvasElement {
  return sprite(24, 14, (g) => {
    // split logs, end-on
    for (const [x, y] of [
      [2, 8],
      [6, 8],
      [10, 8],
      [4, 5],
      [8, 5],
    ])
      stamp(g, ['.jj.', 'jJHh', 'jHhd', '.dd.'], { J: '#e8c48a', j: '#c09058', H: '#a87444', h: '#7a4e2a', d: '#4e2c16' }, x, y);
    // the stump and the axe
    fill(g, rect(15, 7, 22, 12), (x, y) => (y === 7 ? '#d8a868' : x < 17 ? PLANK[4] : x > 20 ? PLANK[1] : PLANK[2]));
    stamp(g, ['.SS.', 'SssI', '.II.', '..h.', '..h.', '..h.'], { S: IRON[5], s: IRON[4], I: IRON[2], h: PLANK[4] }, 16, 1);
  });
}

/** Warm light around a point (dithered steps), stronger where it is close. */
function glow(img: Uint8ClampedArray, W: number, H: number, cx: number, cy: number, rx: number, ry: number, warm: Col, k: number, pow = 1.5): void {
  const wr = warm >> 16;
  const wg = (warm >> 8) & 255;
  const wb = warm & 255;
  for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(H, cy + ry); y++)
    for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(W, cx + rx); x++) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const q = level((1 - d) ** pow, 5, x, y, 0.5) / 5;
      if (q <= 0) continue;
      const i = (y * W + x) * 4;
      if (img[i + 3] === 0) continue;
      img[i] = Math.min(255, img[i] + wr * q * k);
      img[i + 1] = Math.min(255, img[i + 1] + wg * q * k);
      img[i + 2] = Math.min(255, img[i + 2] + wb * q * k);
    }
}

/** Contact shadows under the buildings and props (dark, flattened ellipses on the ground). */
function shadows(p: Pix): void {
  for (const [cx, cy, rx, ry] of [
    [58, 106, 31, 3],
    [214, 104, 36, 3.5],
    [284, 102, 19, 2.5],
    [113, 121, 19, 2],
    [206, 112, 10, 2],
    [228, 112, 9, 1.6],
    [90, 122, 3, 1],
    [180, 124, 12, 2],
  ])
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
        if (d < 1) p.tint(x, y, (c) => mix(c, col('#04070a'), d < 0.6 ? 0.55 : 0.3));
      }
}

function backdrop(w: number, h: number): HTMLCanvasElement {
  const p = new Pix(w, h, -1);
  sky(p);
  woods(p);
  clearing(p);
  shadows(p);
  const c = p.canvas();
  const ctx = c.getContext('2d')!;
  // light on the land: the campfire and the forge's hearth, then a cool vignette
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  glow(d, w, h, FIRE_LIGHT.x, FIRE_LIGHT.y, 120, 56, WARM, 0.32, 1.7);
  glow(d, w, h, FIRE_LIGHT.x, FIRE_LIGHT.y + 4, 46, 16, col('#ffb060'), 0.22, 1.2);
  glow(d, w, h, 199, 104, 34, 12, col('#ff7a30'), 0.3, 1.4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ex = Math.max(0, Math.abs(x + 0.5 - w / 2) / (w / 2) - 0.72) / 0.28;
      const ey = Math.max(0, (y - h * 0.82) / (h * 0.18));
      const t = clamp01(Math.max(ex, ey));
      if (t <= 0) continue;
      const q = level(t, 3, x, y, 0.6) / 3;
      const i = (y * w + x) * 4;
      d[i] = d[i] * (1 - q * 0.55) + 5 * q * 0.55;
      d[i + 1] = d[i + 1] * (1 - q * 0.55) + 9 * q * 0.55;
      d[i + 2] = d[i + 2] * (1 - q * 0.55) + 13 * q * 0.55;
    }
  ctx.putImageData(im, 0, 0);
  // the buildings and props, back to front (each carries its own light)
  ctx.drawImage(shrineSprite(), 265, 102 - 48);
  ctx.drawImage(forgeSprite(), 182, 104 - 71);
  ctx.drawImage(tentSprite(), 28, 106 - 49);
  ctx.drawImage(anvilSprite(), 197, 112 - 14);
  ctx.drawImage(swordSprite(), 88, 107);
  ctx.drawImage(logSprite(), 94, 112);
  ctx.drawImage(firePitSprite(), FIRE_LIGHT.x - 12, 117 - 6);
  ctx.drawImage(woodpileSprite(), 168, 124 - 12);
  nightLife(ctx, w, h);
  return c;
}

// ------------------------------------------------------------------ the campfire's flames (4-frame flicker loop)

const FLAME = ['#a8241c', '#e0461c', '#f87a1e', '#ffb02a', '#ffe070', '#fff8d0'];

/** Flames as a few teardrop tongues whose tips sway; brightest low in the middle. Foot = bottom centre. */
function flameFrame(f: number): HTMLCanvasElement {
  const W = 20;
  const H = 24;
  const base = H - 2;
  const ph = (f / 4) * Math.PI * 2;
  // [x, height, half-width, sway]
  const tongues: Array<[number, number, number, number]> = [
    [10, 18 + Math.round(Math.sin(ph) * 2), 4.6, Math.sin(ph + 0.6) * 2.2],
    [6.5, 11 + Math.round(Math.sin(ph + 2.1) * 2), 3.2, Math.sin(ph + 2.4) * 1.6 - 0.8],
    [13.5, 12 + Math.round(Math.sin(ph + 4.2) * 2), 3.2, Math.sin(ph + 4.0) * 1.6 + 0.8],
    [8.5, 15 + Math.round(Math.cos(ph + 1) * 1.5), 2.6, Math.cos(ph) * 1.8],
  ];
  const heat = (x: number, y: number) => {
    let best = -1;
    for (const [tx, th, tw, sw] of tongues) {
      const t = (base + 0.5 - (y + 0.5)) / th;
      if (t < 0 || t > 1) continue;
      const cx = tx + sw * t * t;
      const hw = tw * Math.pow(1 - t, 0.75) * Math.min(1, 0.7 + t * 2.5);
      const u = Math.abs(x + 0.5 - cx) / Math.max(0.01, hw);
      if (u > 1) continue;
      best = Math.max(best, (1 - u) * 0.6 + (1 - t) * 0.6 - 0.1);
    }
    return best;
  };
  const g = grid(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = heat(x, y);
      if (k < 0) continue;
      put(g, x, y, tone(FLAME, k * 1.05 + 0.08));
    }
  const c = toCanvas(g);
  // sparks rising above (no outline: they are light)
  const ctx = c.getContext('2d')!;
  const sparks: Array<[number, number]> = [
    [[4, 6], [15, 3]],
    [[5, 3], [14, 7]],
    [[3, 1], [16, 5]],
    [[6, 4], [13, 1]],
  ][f] as Array<[number, number]>;
  for (const [x, y] of sparks) {
    ctx.fillStyle = FLAME[4];
    ctx.fillRect(x, y, 1, 1);
  }
  return c;
}

// ------------------------------------------------------------------ Rowan by the fire (sitting on the log, facing right)

const ROWAN_PAL: Record<string, string> = {
  x: '#4a0f1a', R: '#8a1a22', r: '#d03030', q: '#f05a48', Q: '#ff9a80',
  K: '#2a2f45', M: '#4a5272', m: '#7c86a6', s: '#b8c2d8', S: '#eef3fa', W: '#ffffff',
  z: '#5a3410', Y: '#9a5a14', y: '#d8901c', g: '#f2c230', G: '#fff0a0',
  n: '#10204a', B: '#1a3c8a', b: '#2a6ad8', l: '#4aa0f0', L: '#9ad8ff',
  k: '#1c1430', e: '#4ad8ff', E: '#e0fcff',
  D: '#2a1810', d: '#4a2c18', h: '#6e4426', H: '#98663a',
  u: '#3e0c1c', c: '#6a1424', C: '#8e1e2a', v: '#b42c34', V: '#d24840',
  // firelight on the side facing the flames
  F: '#ffc890', f: '#e8a070',
};
// the knight's upper body as in the fight sprite (facing right), without the arms in front
const ROWAN_TOP = [
  '.........rqQQq.........',
  '......RrrqqQQqq........',
  '....RRrrqqqrqqqR.......',
  '...RrrqrrRrRgSsm.......',
  '..RrqrRRsSSSSSssm......',
  '..RrrR.sSWWSSssssm.....',
  '..RrR.sSSWSSssssmmF....',
  '..RR..sSSSSsssssmmF....',
  '..xR..yGggggggggyyG....',
  '...x..sssssKkkkkkkk....',
  '......msssskEEkkEEk....',
  '......msssskeekkeek....',
  '......mmssssMMMMMMM....',
  '.......MmmmmmmmKmK.....',
  '...sSSs.KMmsmMK.sSSs...',
  '..sSWSsmyGgggGYsSWSsF..',
  '..msSsmMylbGbBYmsSsmf..',
  '..yGggyYylgGyBYyGggyY..',
  '...mM..yllbybBBY.......',
  '.......yllbbbBBY.......',
  '.......yllbbbBBY.......',
];
// sitting: the belt, the skirt over the log, a thigh reaching to the knee, the shin down to the boot
const ROWAN_SIT = [
  '.......dhhgGgddD.......',
  '......llbbnbbBBsSSSSF..',
  '......yggYyggYmmsssMf..',
  '..............KMmsSM...',
  '................msM....',
  '................msM....',
  '...............HhhdF...',
  '...............dddDD...',
];
const ROWAN_CAPE = ['....cu', '...vcu', '..Vvcu', '..VvCc', '.VvvCc', '.VvvCc', 'VvvvCc', 'VvvCcc', 'cVvCcu', 'cVvCcu', '.cvCcu', '.cc.cu'];
// the sword planted in the ground beside him
const ROWAN_SWORD = ['.g.', 'GgY', '.d.', '.h.', 'yry', '.SC', '.SC', '.SC', '.SC', '.SC', '.SC', '.SC', '.Sc', '.T.'];

function rowanFrame(f: number): HTMLCanvasElement {
  const W = 32;
  const H = 33;
  const g = grid(W, H);
  const ox = 5;
  const feet = H - 2;
  const sitTop = feet - ROWAN_SIT.length + 1;
  const by = sitTop - ROWAN_TOP.length + f; // breathing: the upper body settles 1px
  stamp(g, ROWAN_CAPE, ROWAN_PAL, ox, by + 15);
  stamp(g, ROWAN_SIT, ROWAN_PAL, ox, sitTop);
  stamp(g, ROWAN_TOP, ROWAN_PAL, ox, by);
  // both arms reaching out to the fire, gauntlets open to the warmth
  const hx = ox + 22;
  const hy = by + 19 + (f ? 0 : -1);
  for (const [sx, sy, c1, c2] of [
    [ox + 4, by + 16, 'M', 'K'],
    [ox + 17, by + 16, 'm', 'M'],
  ] as Array<[number, number, string, string]>) {
    const n = Math.max(Math.abs(hx - sx), Math.abs(hy - sy));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(sx + ((hx - sx) * i) / n);
      const y = Math.round(sy + ((hy - sy) * i) / n);
      if (c1 === 'M' && x > ox + 14) continue; // the far arm hides behind the body
      put(g, x, y, ROWAN_PAL[c1]);
      put(g, x, y + 1, ROWAN_PAL[c2]);
    }
  }
  stamp(g, ['sSF', 'msf', 'MmM'], ROWAN_PAL, hx - 1, hy - 1);
  stamp(g, ['.F', 'Ff'], ROWAN_PAL, hx + 1, hy - 2 + f);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Pip by the fire (perched on the log, facing right)

const PIPC: Record<string, string> = {
  1: '#14204a', 2: '#1e3c8a', 3: '#2a6ad8', 4: '#4aa0f0', 5: '#9ad8ff',
  f: '#8ac4f6', F: '#c8e4fa', k: '#140c1c', i: '#ffd84a', I: '#e89a20', W: '#ffffff',
  g: '#ffe070', y: '#f2a020', Y: '#b0601a', c: '#efe2c4', v: '#c8b496', o: '#ffb070',
};
const PIP_OPEN = [
  '..5.......5...',
  '..45.....54...',
  '..443333334...',
  '.43333333333..',
  '.3fFFFf3fFFf2.',
  '3fkkkkfffkkkf2',
  '3fkiiWkfkiiWk2',
  '3fkiikkfkiikk2',
  '3ffkkkfyfkkkf2',
  '.3fffffYfffo2.',
  '.33cccvcccc22.',
  '.34cvcccvcc22.',
  '..3ccvcvcc22..',
  '...2ccccc22...',
  '....y.y..y....',
];
const PIP_SLEEPY = [
  '..............',
  '..5.......5...',
  '..45.....54...',
  '.4433333334...',
  '.43333333333..',
  '3fFFFFfFFFFf2.',
  '3f3333f33333o2',
  '3fkiiikfkiiik2',
  '3ffkkkfyfkkkf2',
  '.3fffffYfffo2.',
  '.33cccvcccc22.',
  '.34cvcccvcc22.',
  '..3ccvcvcc22..',
  '...2ccccc22...',
  '....y.y..y....',
];

function pipFrame(f: number): HTMLCanvasElement {
  const g = grid(16, 17);
  stamp(g, f ? PIP_SLEEPY : PIP_OPEN, PIPC, 1, 1);
  return toCanvas(g);
}

// ------------------------------------------------------------------ Sable by the fire (perched on the woodpile, facing left)

const SABLE_W = 22;
const SABLE_H = 31;

/**
 * Turn one of Sable's right-facing maps to face left and light it again from the top left: the plum cloth and the
 * teal scarf are re-toned as round forms (centre and radii in map px); the lit hood rim beside the face is kept.
 */
function faceLeft(rows: string[], cloth: [number, number, number, number], scarf?: [number, number, number, number], top = 7): string[] {
  const m = rows.map((r) => [...r].reverse().join(''));
  const face = (c: string | undefined) => c !== undefined && 'zsSkW1'.includes(c);
  return m.map((r, y) =>
    [...r]
      .map((ch, x) => {
        if ('234567'.includes(ch)) {
          if (ch === '6' && (face(r[x - 1]) || face(r[x + 1]))) return ch;
          const [cx, cy, rx, ry] = cloth;
          const v = 0.12 + lambert((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
          return String(Math.max(2, Math.min(top, 2 + Math.floor(v * (top - 1.4)))));
        }
        if (scarf && 'bcde'.includes(ch)) {
          const [cx, cy, rx, ry] = scarf;
          return 'bcde'[Math.max(0, Math.min(3, Math.floor((0.15 + lambert((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)) * 4.2)))];
        }
        if ('qQRr'.includes(ch)) return x < 4 ? 'Q' : x < 9 ? 'q' : x < 12 ? 'R' : 'r';
        return ch;
      })
      .join(''),
  );
}

// Sitting on the logs, facing left: short thighs over the edge, the shins down to the ground (left = forward).
const SABLE_SIT = [
  '.344443333..',
  '34444333332.',
  '3443332222..',
  'Vvw..wvw....',
  'Vvw..wvw....',
  'Vvw..wvw....',
  'Vvw..wvw....',
  'Vvw.2333....',
  '2333.1222...',
  '1222........',
];
/** Where the whetstone sits along the blade in each frame (it draws toward the point, a spark flies on frame 1). */
const SABLE_STROKE = [
  { stone: 0, bob: 0 },
  { stone: 3, bob: 1 },
];

function sableCampFrame(f: number): HTMLCanvasElement {
  const g = grid(SABLE_W, SABLE_H);
  const P = SABLE_PAL;
  const pal: Pal = { ...P, F: '#ffc890', f: '#e8a070', o: IRON[2], O: IRON[4], X: IRON[5] };
  const { stone, bob } = SABLE_STROKE[f];
  // compact, so nothing above the seat reaches the forge (its rect starts 7px right of CAMP_SPOTS.sable)
  const hx = 1;
  const hy = 1 + bob;
  const tx = 2;
  const ty = hy + SABLE_HEAD.length - 1;
  // the scarf's tails hang down the back and only drift away from the fire below the seat
  scarfTail(g, hx + 14, hy + 9, 13, (t) => Math.PI * (0.5 - 0.5 * Math.max(0, t - 0.55)));
  scarfTail(g, hx + 13, hy + 10, 11, (t) => Math.PI * (0.52 - 0.4 * Math.max(0, t - 0.6)));
  // the far hand holds the dagger across the lap, point toward the fire
  const dx = 9;
  const dy = 19;
  const blade = sableDagger('l');
  stamp(g, faceLeft(SABLE_TORSO, [9, 2, 9, 7], undefined, 5), pal, tx, ty);
  // the second dagger tucked through the sash
  stamp(g, ['.g', 'Pg', 'h.'], pal, tx + 10, ty + 3);
  stamp(g, SABLE_SIT, pal, 1, SABLE_H - 2 - SABLE_SIT.length + 1);
  stamp(g, faceLeft(SABLE_HEAD, [10, 4, 9, 8], [9, 10, 8, 3]), pal, hx, hy);
  sableArm(g, tx + 9, ty + 2, dx + 1, dy - 1, false);
  stamp(g, blade.rows, pal, dx - blade.grip[0], dy - blade.grip[1]);
  stamp(g, SABLE_FIST, pal, dx, dy - 1);
  // the near hand draws the whetstone along the edge, the elbow tucked in
  const sx = dx - 5 - stone;
  const sy = dy - 2;
  sableArm(g, tx + 6, ty + 2, sx + 2, sy - 1, true);
  stamp(g, ['XXO', 'OOo'], pal, sx, sy);
  stamp(g, SABLE_FIST, pal, sx + 1, sy - 2);
  if (f === 1) {
    put(g, sx - 1, sy - 1, '#fff6c8');
    put(g, sx - 2, sy - 2, '#ffd25a');
  }
  // firelight: the cloth, skin and scarf edges that face the flames (left) catch a warm rim
  const warmable = new Set(['2', '3', '4', '5', '6', '7', 'b', 'c', 'd', 'e', 's', 'S', 'z', 'v', 'V', 'w'].map((k) => pal[k]));
  for (let y = hy + 5; y < SABLE_H; y++)
    for (let x = 1; x < SABLE_W; x++) {
      const c = g[y][x];
      if (!c || g[y][x - 1] || !warmable.has(c)) continue;
      const v = parseInt(c.slice(1), 16);
      const lum = ((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11;
      g[y][x] = lum > 120 ? pal.F : pal.f;
    }
  return toCanvas(g);
}

// ------------------------------------------------------------------ Mags, the badger smith (facing left, toward the anvil)

const MAGS: Record<string, string> = {
  // badger head: white crown and cheeks, black stripe through the eye, black nose
  W: '#f4f0e6', w: '#c4bec4', g: '#8a8494', K: '#1c1824', k: '#3e3848', N: '#0e0a12', n: '#6a6070', E: '#ffffff', e: '#d8d0d0',
  // brass goggles with amber lenses, leather strap
  B: '#e8b048', b: '#9a6420', L: '#ffb84a', l: '#c86a1c', s: '#3a2418',
  // brown fur (shadows lean purple, light leans orange)
  1: '#2a1618', 2: '#4a2a20', 3: '#6e4228', 4: '#925c34', 5: '#b47a44',
  // linen shirt, rolled sleeves
  c: '#ece0c4', C: '#b8a68c', x: '#7a6858',
  // the soot-black leather apron, its edge catching the firelight
  p: '#18141e', P: '#262230', q: '#3a3446', Q: '#6a5a62', r: '#5a3a28', y: '#e8b048',
  // trousers and boots
  t: '#262636', T: '#3a3a52', d: '#1e1214', D: '#120a0e', h: '#3e2a20', H: '#6a4a32',
  // firelight rim
  F: '#ffb878', f: '#d88a58',
};
const MAGS_HEAD = [
  '.....bBBbBBb..',
  '....WbLlbLlbK.',
  '...WWWWWWWKKKe',
  '..WWWWWKKKKKKk',
  '.WWWKKKEKKKKk2',
  'nKKKKKKKKKWW23',
  'NKKKWWWWWWWW33',
  '.gWWWWWWWWWW34',
  '..wwWWWWWWw344',
  '....wwwwww3444',
];
const MAGS_LEGS = ['..TTtt...Ttt...', '..TTtt...Ttt...', '.HhhdD..Hhhdd..', 'Hhhhdd.Hhhhddd.'];

interface MagsPose {
  hand: [number, number]; // near hand (canvas px)
  head: [number, number]; // hammer head centre
  elbow: [number, number];
  far?: [number, number]; // far hand on the handle (hidden behind otherwise)
  lean?: number; // upper body shift (left = negative)
  bob?: number;
  armBehind?: boolean; // the near arm passes behind the head (raised high)
}

const MAGS_POSES: Record<string, MagsPose> = {
  // the hammer resting on her shoulder, the other paw on her hip
  idle0: { hand: [15, 25], elbow: [17, 30], head: [28, 13] },
  idle1: { hand: [15, 26], elbow: [17, 31], head: [28, 14], bob: 1 },
  // raise: both paws high, the hammer cocked back over her head
  hammer0: { hand: [18, 8], elbow: [17, 13], head: [26, 2], far: [20, 7], lean: 1, armBehind: true },
  // strike: arms thrown forward, the hammer flat on the anvil's face
  hammer1: { hand: [8, 22], elbow: [11, 20], head: [3, 24], far: [10, 21], lean: -2, bob: 1 },
  // rebound: the hammer kicks back up off the steel
  hammer2: { hand: [12, 17], elbow: [13, 21], head: [8, 9], far: [14, 16], lean: -1 },
};

function magsFrame(pose: MagsPose): HTMLCanvasElement {
  const W = 40;
  const H = 40;
  const g = grid(W, H);
  const feet = H - 3;
  const bob = pose.bob ?? 0;
  const lean = pose.lean ?? 0;
  const cx = 22 + lean; // body centre
  const top = feet - 28 + bob;
  // the far arm (behind the body), when both paws are on the handle
  const shoulderFar: [number, number] = [cx + 4, top + 13];
  if (pose.far) {
    stroke(g, [shoulderFar, pose.far], 1.2, () => MAGS['2']);
  } else {
    // paw on the hip
    stroke(g, [shoulderFar, [cx + 8, top + 17], [cx + 6, top + 20]], 1.2, () => MAGS['2']);
  }
  // legs and boots
  stamp(g, MAGS_LEGS, MAGS, cx - 8, feet - 3);
  // the body: a stout barrel of brown fur lit from the left, the apron over the front
  const body = ell(cx, top + 18, 8.2, 9.5);
  fill(g, body, (x, y) => tone(['#2a1618', '#4a2a20', '#6e4228', '#925c34', '#b47a44'], 0.35 + lambertish(x - cx, y - top - 14)));
  const apron: Inside = (x, y) => body(x, y) && y >= top + 12 && x <= cx + 4 - (y < top + 15 ? 2 : 0) && x >= cx - 9;
  fill(g, apron, (x, y) => {
    if (!apron(x - 1, y) || !body(x - 1, y)) return MAGS.Q;
    if (y === top + 19) return MAGS.r; // the waist tie
    return (x + y) % 5 === 0 ? MAGS.q : x < cx - 4 ? MAGS.P : MAGS.p;
  });
  put(g, cx + 3, top + 19, MAGS.y);
  // the apron's pocket with a pair of tongs poking out
  fill(g, rect(cx - 5, top + 22, cx - 1, top + 25), (x, y) => (y === top + 22 ? MAGS.q : x === cx - 5 ? MAGS.P : MAGS.p));
  put(g, cx - 4, top + 21, MAGS.T);
  put(g, cx - 2, top + 20, MAGS.T);
  // the neck strap
  put(g, cx - 3, top + 11, MAGS.p);
  put(g, cx + 1, top + 11, MAGS.p);
  // the near arm: a rolled linen sleeve to the elbow, a furry forearm to the paw
  const nearArm = () => {
    const shoulder: [number, number] = [cx - 2, top + 13];
    stroke(g, [shoulder, pose.elbow], 1.6, (x, y) => (x + y < shoulder[0] + shoulder[1] - 1 ? MAGS.c : MAGS.C));
    stroke(g, [pose.elbow, pose.hand], 1.2, (x, y) => (y < pose.elbow[1] && x < pose.elbow[0] ? MAGS['5'] : MAGS['4']));
    put(g, pose.elbow[0], pose.elbow[1], MAGS.c);
  };
  // the head (profile, snout to the left), sitting low on the shoulders
  if (pose.armBehind) nearArm();
  stamp(g, MAGS_HEAD, MAGS, cx - 12, top + 1);
  if (!pose.armBehind) nearArm();
  // the hammer: a hickory handle through the paw, a heavy iron head across its end
  const [hx, hy] = pose.hand;
  const [kx, ky] = pose.head;
  const len = Math.hypot(kx - hx, ky - hy);
  const ux = (kx - hx) / len;
  const uy = (ky - hy) / len;
  const tail: [number, number] = [hx - ux * 3, hy - uy * 3];
  stroke(g, [tail, [kx - ux * 1.5, ky - uy * 1.5]], 0.7, (x, y) => ((x - hx) * -uy + (y - hy) * ux < 0 ? '#c08850' : '#7a4a28'));
  const headIn: Inside = (x, y) => {
    const dx = x + 0.5 - kx;
    const dy = y + 0.5 - ky;
    return Math.abs(dx * ux + dy * uy) <= 2.2 && Math.abs(dx * -uy + dy * ux) <= 3.6;
  };
  fill(g, headIn, (x, y) => {
    const along = (x + 0.5 - kx) * ux + (y + 0.5 - ky) * uy;
    const across = (x + 0.5 - kx) * -uy + (y + 0.5 - ky) * ux;
    const v = 0.55 - along * 0.12 - across * 0.06 - (x + 0.5 - kx) * 0.04 - (y + 0.5 - ky) * 0.05;
    return tone(IRON, Math.abs(across) > 3 ? v + 0.25 : v);
  });
  // a hot rim on the hammer head's lit edges (the hearth and the fire)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (headIn(x, y) && (!headIn(x - 1, y) || !headIn(x, y - 1))) put(g, x, y, '#e8d0b8');
  // the paw over the handle
  stamp(g, ['32', '43'], MAGS, hx - 1, hy - 1);
  if (pose.far) stamp(g, ['2'], MAGS, pose.far[0], pose.far[1]);
  return toCanvas(g);
}

/** Simple top-left light on a round form (offsets from its centre, px). */
function lambertish(dx: number, dy: number): number {
  return Math.max(0, Math.min(0.6, 0.35 - dx * 0.045 - dy * 0.03));
}

// ------------------------------------------------------------------ Mags' story portrait (40x40, faces left)

const FUR_W = ['#7a7486', '#b4aebc', '#dcd6da', '#f4f0ea', '#fffdf8'];
const FUR_K = ['#0a080e', '#15111b', '#211b29', '#322a3c', '#4a4056'];
const FUR_B = ['#2a1618', '#4a2a20', '#6e4228', '#925c34', '#b47a44', '#d09a5e'];
const APRON = ['#100e16', '#1a1622', '#262230', '#38324a', '#544a66'];
const BRASS_P = ['#5a3410', '#9a6420', '#d8a040', '#f2c860', '#fff0b0'];

function magsPortrait(): HTMLCanvasElement {
  const P = PORTRAIT_SIZE;
  const g = grid(P, P);
  // the big hammer over her shoulder, its iron head behind her (drawn first)
  stroke(g, [
    [36, 20],
    [33, 40],
  ], 1.3, (x, y) => (x + y * 0.2 < 41 ? '#c08850' : '#7a4a28'));
  const hammer: Inside = (x, y) => x >= 33 && x <= 39 && y >= 12 && y <= 21 && !(x === 33 && (y === 12 || y === 21));
  fill(g, hammer, (x, y) => tone(IRON, 0.95 - (x - 33) * 0.07 - (y - 12) * 0.06 + (y === 12 || x === 33 ? 0.2 : 0)));
  fill(g, rect(33, 16, 39, 16), () => IRON[1]);
  // shoulders: stout and furry, the linen collar, the soot-black apron bib with brass buckles
  const torso = ell(21, 44, 21, 13);
  fill(g, torso, sphere(FUR_B, 10, 34, 24, 14, 0.08));
  // a thick furry neck under the jaw
  fill(g, ell(23, 29, 10, 6.5), sphere(FUR_B, 17, 25, 12, 8, 0.12));
  fill(g, and(torso, ell(19, 33, 10, 3.6)), sphere(['#7a6858', '#b8a68c', '#ece0c4', '#fff8e8'], 14, 32, 12, 5, 0.12));
  const bib: Inside = (x, y) => torso(x, y) && y >= 35 && Math.abs(x + 0.5 - 19.5) <= 7.5 + (y - 35) * 0.7;
  fill(g, bib, (x, y) => tone(APRON, 0.6 - (x - 12) * 0.022 - (y - 35) * 0.03 + ((x * 3 + y * 5) % 13 === 0 ? 0.2 : 0)));
  fill(g, and(bib, (x, y) => !bib(x - 1, y) || !bib(x, y - 1)), () => APRON[4]);
  for (const [x0, x1] of [
    [13, 9],
    [26, 30],
  ])
    stroke(g, [
      [x0, 36],
      [x1, 31],
    ], 0.8, () => APRON[2]);
  const buckle: Pal = { G: BRASS_P[4], g: BRASS_P[3], y: BRASS_P[2], Y: BRASS_P[1], Z: BRASS_P[0] };
  stamp(g, ['GgY', 'g.y', 'YyZ'], buckle, 12, 36);
  stamp(g, ['GgY', 'g.y', 'YyZ'], buckle, 25, 36);
  // the head: a broad skull tapering to a long snout that points left
  const nose: [number, number] = [3.5, 22.5];
  const back: [number, number] = [33, 13];
  const len = Math.hypot(back[0] - nose[0], back[1] - nose[1]);
  const dx = (back[0] - nose[0]) / len;
  const dy = (back[1] - nose[1]) / len;
  const along = (x: number, y: number) => (x + 0.5 - nose[0]) * dx + (y + 0.5 - nose[1]) * dy;
  const across = (x: number, y: number) => (x + 0.5 - nose[0]) * -dy + (y + 0.5 - nose[1]) * dx; // + is down-right
  const head: Inside = (x, y) => {
    const a = along(x, y);
    const c = across(x, y);
    if (a < -1.5 || a > len + 1) return false;
    const t = clamp01(a / len);
    const up = 2.8 + Math.sqrt(t) * 9.5; // crown side
    const down = 3 + Math.sqrt(t) * 11 - (t > 0.82 ? (t - 0.82) * 34 : 0); // cheek side, rounding off at the back
    return c >= -up && c <= down && (a > 0 || Math.hypot(a, c) < 3);
  };
  // the ears: the near one at the back, the far one peeking over the crown
  fill(g, ell(30, 8, 3.8, 3.8), (x, y) => (Math.hypot(x + 0.5 - 30, y + 0.5 - 8) > 2.7 ? FUR_W[3] : FUR_K[2]));
  fill(g, ell(22, 4.5, 3, 2.6), (x, y) => (Math.hypot(x + 0.5 - 22, (y + 0.5 - 4.5) * 1.1) > 2 ? FUR_W[2] : FUR_K[1]));
  // white fur, lit from the top left
  fill(g, head, (x, y) => tone(FUR_W, 0.55 + 0.5 * lambert((x + 0.5 - 16) / 18, (y + 0.5 - 14) / 15)));
  // the black stripe from the snout through the eye to the ear (widening toward the back)
  const stripe: Inside = (x, y) => {
    const t = clamp01(along(x, y) / len);
    const c = across(x, y);
    return head(x, y) && along(x, y) > 1.2 && c >= -0.6 - t * 3.6 && c <= 1.4 + t * 2.4;
  };
  fill(g, stripe, (x, y) => tone(FUR_K, 0.55 - clamp01(along(x, y) / len) * 0.25 + (across(x, y) < -0.2 - clamp01(along(x, y) / len) * 3 ? 0.35 : 0)));
  rimShade(g, head, FUR_W[1]);
  // the nose, glossy black, and a crooked grin with a tooth
  fill(g, ell(3.2, 22.5, 2.7, 2.5), (x, y) => (x < 3 && y < 22 ? FUR_K[4] : FUR_K[0]));
  put(g, 2, 21, '#9a90a8');
  for (const [x, y] of [
    [6, 26],
    [7, 26],
    [8, 27],
    [9, 27],
    [10, 27],
    [11, 27],
    [12, 27],
    [13, 26],
  ])
    put(g, x, y, FUR_W[0]);
  put(g, 10, 28, FUR_W[4]);
  // soot smudges on the cheek
  for (const [x, y] of [
    [19, 27],
    [21, 26],
    [20, 28],
  ])
    put(g, x, y, FUR_W[1]);
  // the eye: small, bright, a glint; a brow lifted (she's sizing you up)
  stamp(g, ['kkk', 'kWb', 'kbk'], { k: '#06040a', W: '#ffffff', b: '#8a4a20' }, 13, 16);
  for (const [x, y] of [
    [12, 14],
    [13, 13],
    [14, 13],
    [15, 13],
  ])
    put(g, x, y, FUR_K[4]);
  // brass goggles pushed up on the crown, amber lenses, a strap round to the ear
  for (let x = 23; x <= 31; x++) {
    put(g, x, 9 + Math.round((x - 23) * 0.22), '#3a2418');
    put(g, x, 10 + Math.round((x - 23) * 0.22), '#6a4a30');
  }
  const lens = (cx: number, cy: number, r: number) => {
    fill(g, ell(cx, cy, r + 1, r + 0.8), (x, y) => tone(BRASS_P, 0.8 - (x - cx) * 0.1 - (y - cy) * 0.12));
    fill(g, ell(cx, cy, r - 0.2, r - 0.3), (x, y) => (x + y < cx + cy - 1 ? '#ffd890' : x + y < cx + cy + 1 ? '#ffa838' : '#c45a18'));
    put(g, Math.round(cx - 1), Math.round(cy - 1), '#ffffff');
  };
  lens(13, 10, 2.4);
  lens(19.5, 8, 2.6);
  put(g, 16, 9, BRASS_P[1]);
  return toCanvas(g);
}

// ------------------------------------------------------------------ build

export function buildCampArt(add: Add, w: number, h: number): void {
  // (L7: the camp in the mood's darker, cooler night; the forge and the fire keep their glow)
  add('camp_bg', moodGrade(backdrop(w, h), 0.16));
  for (let i = 0; i < 4; i++) add(`camp_fire${i}`, flameFrame(i));
  for (const [k, pose] of Object.entries(MAGS_POSES)) add(`smith_${k}`, magsFrame(pose));
  add('camp_rowan0', rowanFrame(0));
  add('camp_rowan1', rowanFrame(1));
  add('camp_pip0', pipFrame(0));
  add('camp_pip1', pipFrame(1));
  add('camp_sable0', sableCampFrame(0));
  add('camp_sable1', sableCampFrame(1));
  add('portrait_smith', portraitMood(magsPortrait(), 0.3));
}

