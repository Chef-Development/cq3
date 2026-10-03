// Original level backdrops, painted pixel by pixel at boot. Each theme gives a background texture
// (`bg_<theme>`), a foreground strip drawn in front of the actors (`fg_<theme>`) and the spots the
// scene animates on top (torch flames).
import type Phaser from 'phaser';

export type Theme = 'forest' | 'ruins';
export const THEMES: Theme[] = ['forest', 'ruins'];

export interface Backdrop {
  torches: Array<{ x: number; y: number }>; // flame base, game px
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

interface Painter {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  rnd: () => number;
  px: (x: number, y: number, col: string) => void;
  rect: (x: number, y: number, w: number, h: number, col: string) => void;
  disc: (cx: number, cy: number, r: number, col: (dx: number, dy: number) => string | null, ry?: number) => void;
  gradient: (y0: number, y1: number, stops: string[]) => void;
}

function painter(w: number, h: number, seed: number): [HTMLCanvasElement, Painter] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rect = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  };
  const px = (x: number, y: number, col: string) => rect(x, y, 1, 1, col);
  const disc = (cx: number, cy: number, r: number, col: (dx: number, dy: number) => string | null, ry = r) => {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++)
      for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        if ((x * x) / (r * r) + (y * y) / (ry * ry) > 1) continue;
        const cc = col(x / r, y / ry);
        if (cc) px(cx + x, cy + y, cc);
      }
  };
  const gradient = (y0: number, y1: number, stops: string[]) => {
    const bands = stops.length - 1;
    for (let y = y0; y < y1; y++) {
      const f = ((y - y0) / Math.max(1, y1 - y0)) * bands;
      const i = Math.min(bands - 1, Math.floor(f));
      const t = f - i;
      for (let x = 0; x < w; x++) px(x, y, t * 16 > BAYER[y % 4][x % 4] ? stops[i + 1] : stops[i]);
    }
  };
  return [c, { ctx, w, h, rnd, px, rect, disc, gradient }];
}

/** Round leafy canopy lit from the top left. */
function canopy(p: Painter, cx: number, cy: number, r: number, dark: string, mid: string, light: string, ry = r): void {
  p.disc(cx, cy, r, (dx, dy) => (dx + dy < -0.55 ? light : dx + dy > 0.5 ? dark : mid), ry);
}

function pine(p: Painter, cx: number, base: number, hgt: number, dark: string, light: string): void {
  for (let y = 0; y < hgt; y++) {
    const half = Math.round(((y + 1) / hgt) * (hgt * 0.32)) + (y % 4 === 3 ? 1 : 0);
    for (let x = -half; x <= half; x++) p.px(cx + x, base - hgt + y, x < 0 && x > -half + 1 ? light : dark);
  }
  p.rect(cx, base, 1, 2, '#3a2616');
}

function grassTuft(p: Painter, x: number, y: number, hgt: number, dark: string, light: string): void {
  for (let i = -2; i <= 2; i++) {
    const hh = Math.max(1, hgt - Math.abs(i) * 2 + (i === 0 ? 1 : 0));
    p.rect(x + i, y - hh, 1, hh, i % 2 ? dark : light);
  }
}

function flower(p: Painter, x: number, y: number, col: string): void {
  p.px(x, y, col);
  p.px(x - 1, y, col);
  p.px(x + 1, y, col);
  p.px(x, y - 1, col);
  p.px(x, y + 1, '#2e7a2e');
  p.px(x, y, '#fff6a0');
}

// ------------------------------------------------------------------ forest (Level 1): bright, busy clearing

function forest(w: number, h: number, ground: number): [HTMLCanvasElement, HTMLCanvasElement, Backdrop] {
  const [c, p] = painter(w, h, 23);
  const { rnd, px, rect } = p;
  const horizon = ground - 30;

  // sky + sun beams
  p.gradient(0, horizon, ['#4aa4e6', '#62b4ec', '#7cc4f0', '#98d2f2', '#b4e0f6', '#d2eef8']);
  p.ctx.globalAlpha = 0.14;
  for (const [x0, wd] of [
    [30, 12],
    [80, 7],
    [140, 16],
    [215, 9],
    [270, 6],
  ])
    for (let y = 0; y < horizon; y++) rect(x0 + y * 0.55, y, wd, 1, '#ffffff');
  p.ctx.globalAlpha = 1;
  // horizon clouds
  for (let x = -10; x < w + 10; x += 9) p.disc(x, horizon - 26 + Math.round(Math.sin(x / 23) * 4), 6 + Math.round(rnd() * 5), (_, dy) => (dy > 0.35 ? '#d6ecf6' : '#ffffff'));

  // far mountains
  const ridgeY = (x: number, base: number, amp: number, f1: number, f2: number, ph: number) => Math.round(base - amp * (0.6 * Math.abs(Math.sin(x / f1 + ph)) + 0.4 * Math.sin(x / f2 + ph * 2)));
  const ridge = (base: number, amp: number, f1: number, f2: number, col: string, hi: string, ph: number) => {
    for (let x = 0; x < w; x++) {
      const y = ridgeY(x, base, amp, f1, f2, ph);
      rect(x, y, 1, horizon - y + 1, col);
      if (ridgeY(x - 1, base, amp, f1, f2, ph) > y) px(x, y, hi);
    }
  };
  ridge(horizon - 16, 22, 41, 15, '#90c4b8', '#b8e2d4', 0.4);

  // a far castle on the ridge (generic, original)
  const kx = Math.round(w * 0.6);
  const ky = horizon - 10;
  const wall = '#b4c2cc';
  const lit = '#d2dee4';
  const shade = '#94a4b0';
  const roof = '#5a72a0';
  rect(kx - 18, ky - 10, 36, 12, wall);
  rect(kx - 18, ky - 10, 36, 1, lit);
  for (let x = kx - 18; x < kx + 18; x += 3) rect(x, ky - 12, 2, 2, wall);
  const tower = (tx: number, tw: number, th: number) => {
    rect(tx, ky - th, tw, th, wall);
    rect(tx + tw - 2, ky - th, 2, th, shade);
    rect(tx, ky - th, 1, th, lit);
    for (let i = 0; i <= tw / 2 + 1; i++) rect(tx - 1 + i, ky - th - 1 - i, tw + 2 - i * 2, 1, roof);
    rect(tx + Math.floor(tw / 2) - 1, ky - th + 4, 2, 3, '#4a5a7a');
  };
  tower(kx - 22, 7, 22);
  tower(kx + 15, 7, 22);
  tower(kx - 5, 10, 30);
  rect(kx - 1, ky - 30 - 10, 1, 5, '#6a5a4a');
  rect(kx, ky - 40, 4, 2, '#e05a4a');
  rect(kx - 3, ky - 4, 6, 6, '#4a5a7a');
  ridge(horizon - 6, 12, 27, 11, '#6aac84', '#8ccaa0', 1.9);

  // tree lines: pale round crowns, a band of pines, darker crowns in front
  for (let x = -6; x < w + 6; x += 7 + Math.floor(rnd() * 6)) canopy(p, x, horizon - 3 - Math.floor(rnd() * 6), 6 + Math.floor(rnd() * 4), '#3a7a52', '#4a9060', '#66aa70');
  for (let x = -4; x < w + 4; x += 5 + Math.floor(rnd() * 5)) pine(p, x, horizon + 4, 14 + Math.floor(rnd() * 10), '#2a6040', '#3e7e52');
  for (let x = -6; x < w + 6; x += 9 + Math.floor(rnd() * 6)) canopy(p, x, horizon + 4, 5 + Math.floor(rnd() * 3), '#245a32', '#307040', '#46904e');

  // meadow with bushes, flowers, a fence, rocks and a signpost
  const meadowTop = horizon + 7;
  for (let y = meadowTop; y < ground - 8; y++) {
    const t = (y - meadowTop) / Math.max(1, ground - 8 - meadowTop);
    for (let x = 0; x < w; x++) px(x, y, t * 16 > BAYER[y % 4][x % 4] ? '#5ea844' : '#74b84c');
  }
  for (let x = 0; x < w; x++) if (rnd() < 0.5) px(x, meadowTop, '#2e6e3a');
  for (let x = 4; x < w; x += 14 + Math.floor(rnd() * 22)) canopy(p, x, meadowTop + 2, 4 + Math.floor(rnd() * 3), '#2e7032', '#3e8a3e', '#5aa84c', 3);
  for (let i = 0; i < 26; i++) {
    const fx = Math.floor(rnd() * w);
    const fy = meadowTop + 4 + Math.floor(rnd() * Math.max(1, ground - 14 - meadowTop));
    const col = ['#ff8ab0', '#ffe066', '#ffffff', '#b08aff'][i % 4];
    for (let k = 0; k < 3; k++) flower(p, fx + k * 3 - 3, fy + (k % 2), col);
  }
  // wooden fence along the back of the path, with gaps
  const fenceY = ground - 18;
  for (const [x0, x1] of [
    [24, 112],
    [196, 300],
  ]) {
    rect(x0, fenceY + 3, x1 - x0, 2, '#9a6a3c');
    rect(x0, fenceY + 3, x1 - x0, 1, '#c08a50');
    rect(x0, fenceY + 7, x1 - x0, 2, '#9a6a3c');
    rect(x0, fenceY + 7, x1 - x0, 1, '#c08a50');
    for (let x = x0; x <= x1; x += 11) {
      rect(x - 1, fenceY, 3, 11, '#7a4e28');
      rect(x - 1, fenceY, 1, 11, '#a87444');
      px(x, fenceY - 1, '#7a4e28');
    }
  }
  // signpost
  const sx = Math.round(w * 0.86);
  rect(sx, ground - 26, 2, 18, '#7a4e28');
  rect(sx - 7, ground - 25, 14, 6, '#a87444');
  rect(sx - 7, ground - 25, 14, 1, '#c89a60');
  rect(sx - 5, ground - 23, 10, 1, '#5a3418');
  rect(sx - 5, ground - 21, 7, 1, '#5a3418');
  // mossy boulders
  const rock = (x: number, y: number, r: number) => {
    p.disc(x, y, r, (dx, dy) => (dy < -0.5 ? '#7aa060' : dx + dy < -0.3 ? '#b4b8c0' : dx + dy > 0.6 ? '#6a6e7a' : '#9094a0'), r * 0.7);
  };
  rock(Math.round(w * 0.16), ground - 10, 5);
  rock(Math.round(w * 0.16) + 6, ground - 9, 3);
  rock(Math.round(w * 0.73), ground - 10, 4);

  // the dirt path the fight happens on
  for (let y = ground - 8; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = y < ground - 6;
      px(x, y, edge ? '#5a9a3a' : y > ground + 2 ? '#a07a4c' : '#b48c5a');
    }
  for (let x = 0; x < w; x += 2) if (rnd() < 0.7) px(x, ground - 9, '#4a8a30');
  for (let x = 0; x < w; x++) {
    if (rnd() < 0.18) rect(x, ground - 3, 3, 1, '#9a7448');
    if (rnd() < 0.18) rect(x, ground + 4, 3, 1, '#8a6a40');
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w);
    const y = ground - 5 + Math.floor(rnd() * Math.max(1, h - ground + 5));
    rect(x, y, 2, 1, rnd() < 0.5 ? '#c8a070' : '#8a6a40');
    if (rnd() < 0.2) px(x, y - 1, '#d8b888');
  }
  for (let x = 2; x < w; x += 6 + Math.floor(rnd() * 10)) grassTuft(p, x, ground - 5, 3 + Math.floor(rnd() * 3), '#3e7e2a', '#5aa83a');

  // framing trees: thick trunks with roots, heavy leaves across the top corners, hanging vines
  const trunk = (x0: number, width: number, flip: boolean) => {
    for (let x = x0; x < x0 + width; x++)
      for (let y = 0; y < h; y++) {
        const k = x - x0;
        const kk = flip ? width - 1 - k : k;
        const ridge = (kk + Math.floor(y / 6) + (y % 11 === 0 ? 1 : 0)) % 5 === 0;
        px(x, y, k === 0 || k === width - 1 ? '#22160c' : ridge ? '#5e4228' : kk < width / 3 ? '#4e3420' : '#3a2616');
      }
    for (let r = 0; r < 4; r++) {
      const rx = flip ? x0 - 2 - r * 2 : x0 + width + r * 2;
      rect(rx, ground - 3 + r, 2, h - ground + 3, '#3a2616');
    }
  };
  trunk(-2, 20, false);
  trunk(w - 18, 20, true);
  for (let i = 0; i < 40; i++) {
    const left = i % 2 === 0;
    const cx = left ? Math.floor(rnd() * 80) - 8 : w - Math.floor(rnd() * 80) + 8;
    canopy(p, cx, Math.floor(rnd() * 18) - 6, 7 + Math.floor(rnd() * 6), '#1e4a26', '#2a6232', '#3e7e40');
  }
  for (let i = 0; i < 12; i++) {
    const left = i % 2 === 0;
    const vx = left ? 14 + Math.floor(rnd() * 50) : w - 14 - Math.floor(rnd() * 50);
    const len = 6 + Math.floor(rnd() * 16);
    for (let y = 8; y < 8 + len; y++) px(vx + (y % 5 === 0 ? 1 : 0), y, y % 3 ? '#2a6232' : '#4e9a4a');
  }

  // foreground: tufts and flowers along the bottom edge, bushes in the corners
  const [fc, f] = painter(w, h, 77);
  for (let x = 0; x < w; x += 3 + Math.floor(f.rnd() * 7)) grassTuft(f, x, h, 3 + Math.floor(f.rnd() * 4), '#2e6e22', '#4e9a32');
  for (let i = 0; i < 10; i++) flower(f, Math.floor(f.rnd() * w), h - 3 - Math.floor(f.rnd() * 2), ['#ff8ab0', '#ffe066', '#ffffff'][i % 3]);
  canopy(f, 8, h - 2, 11, '#1e4a26', '#2a6232', '#3e7e40', 8);
  canopy(f, w - 8, h - 2, 11, '#1e4a26', '#2a6232', '#3e7e40', 8);
  return [c, fc, { torches: [] }];
}

// ------------------------------------------------------------------ ruins (Level 2): dusk, moonlit, torches

function ruins(w: number, h: number, ground: number): [HTMLCanvasElement, HTMLCanvasElement, Backdrop] {
  const [c, p] = painter(w, h, 91);
  const { rnd, px, rect } = p;
  const horizon = ground - 28;

  p.gradient(0, horizon + 4, ['#141e3a', '#1e2c4e', '#2a3c62', '#3e4e72', '#625c7c', '#94707a', '#c08a74']);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * horizon * 0.6);
    px(x, y, rnd() < 0.3 ? '#ffffff' : '#9aa8d0');
  }
  // moon with a soft halo
  const mx = Math.round(w * 0.72);
  const my = 20;
  p.ctx.globalAlpha = 0.18;
  p.disc(mx, my, 19, () => '#f2ecd0');
  p.ctx.globalAlpha = 0.25;
  p.disc(mx, my, 14, () => '#f2ecd0');
  p.ctx.globalAlpha = 1;
  p.disc(mx, my, 10, (dx, dy) => (dx + dy > 0.7 ? '#d6ccaa' : (dx - 0.3) ** 2 + (dy + 0.2) ** 2 < 0.05 || (dx + 0.4) ** 2 + (dy - 0.3) ** 2 < 0.04 ? '#ddd4b4' : '#f4eed6'));

  // far city of broken towers
  const far = '#2e3c5c';
  for (let x = -4; x < w + 4; ) {
    const tw = 8 + Math.floor(rnd() * 12);
    const th = 12 + Math.floor(rnd() * 26);
    rect(x, horizon - th, tw, th + 4, far);
    for (let k = 0; k < tw; k += 2) if (rnd() < 0.6) rect(x + k, horizon - th - 1 - Math.floor(rnd() * 3), 1, 3, far);
    if (rnd() < 0.5) rect(x + 2 + Math.floor(rnd() * (tw - 4)), horizon - th + 4 + Math.floor(rnd() * 6), 2, 3, '#e8b45a');
    x += tw + Math.floor(rnd() * 6);
  }
  // mist over the horizon
  p.ctx.globalAlpha = 0.28;
  rect(0, horizon - 6, w, 8, '#8a8eb0');
  p.ctx.globalAlpha = 1;

  // nearer ruins: broken arches and columns, dead trees
  const near = '#1e2840';
  const nearLit = '#34405e';
  const arch = (ax: number, aw: number, ah: number) => {
    rect(ax, horizon - ah, 5, ah + 6, near);
    rect(ax + aw - 5, horizon - ah + 6, 5, ah, near);
    for (let i = 0; i <= aw; i++) {
      const y = horizon - ah - Math.round(Math.sin((i / aw) * Math.PI) * 6);
      if (i > aw * 0.7) continue; // broken
      rect(ax + i, y, 1, 5, near);
      px(ax + i, y, nearLit);
    }
    rect(ax, horizon - ah, 1, ah + 6, nearLit);
  };
  arch(Math.round(w * 0.08), 34, 26);
  arch(Math.round(w * 0.62), 40, 30);
  const column = (cx: number, ch: number) => {
    rect(cx - 3, horizon + 6 - ch, 7, ch, near);
    rect(cx - 3, horizon + 6 - ch, 1, ch, nearLit);
    rect(cx - 4, horizon + 6 - ch, 9, 2, near);
  };
  column(Math.round(w * 0.36), 22);
  column(Math.round(w * 0.45), 14);
  const deadTree = (tx: number, th: number) => {
    rect(tx, horizon + 6 - th, 2, th, '#141a2a');
    const branch = (bx: number, by: number, dir: number, len: number) => {
      for (let i = 0; i < len; i++) px(bx + dir * i, by - Math.floor(i / 2), '#141a2a');
    };
    branch(tx, horizon + 6 - th + 6, -1, 9);
    branch(tx + 1, horizon + 6 - th + 3, 1, 8);
    branch(tx, horizon + 6 - th + 12, 1, 6);
  };
  deadTree(Math.round(w * 0.27), 34);
  deadTree(Math.round(w * 0.88), 30);

  // ground: dark meadow, then a cracked flagstone road
  for (let y = horizon + 6; y < ground - 8; y++)
    for (let x = 0; x < w; x++) px(x, y, (y - horizon) * 3 > BAYER[y % 4][x % 4] + 20 ? '#22382e' : '#2a4436');
  for (let i = 0; i < 40; i++) grassTuft(p, Math.floor(rnd() * w), horizon + 10 + Math.floor(rnd() * 12), 2 + Math.floor(rnd() * 3), '#1a2e24', '#355a40');
  for (let y = ground - 8; y < h; y++)
    for (let x = 0; x < w; x++) px(x, y, y < ground - 6 ? '#2a3a30' : y > ground + 2 ? '#3a3c4a' : '#464858');
  for (let row = 0; ground - 5 + row * 6 < h; row++) {
    const y0 = ground - 5 + row * 6;
    rect(0, y0, w, 1, '#2a2c36');
    for (let x = (row % 2) * 7; x < w; x += 14) {
      rect(x, y0, 1, 6, '#2a2c36');
      rect(x + 1, y0 + 1, 12, 1, '#585a6c');
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rnd() * w);
    const y = ground - 4 + Math.floor(rnd() * (h - ground + 3));
    rect(x, y, 3, 1, '#3e5a3a');
    px(x + 1, y - 1, '#4e7448');
  }

  // torches on posts behind the road
  const torches: Backdrop['torches'] = [];
  for (const tx of [Math.round(w * 0.24), Math.round(w * 0.55), Math.round(w * 0.82)]) {
    const top = ground - 30;
    rect(tx - 1, top + 4, 3, 22, '#2a1e16');
    rect(tx - 1, top + 4, 1, 22, '#4a3626');
    rect(tx - 3, top + 1, 7, 3, '#5a4a3a');
    rect(tx - 3, top + 1, 7, 1, '#8a7258');
    rect(tx - 2, top + 4, 5, 1, '#3a2e24');
    torches.push({ x: tx, y: top + 1 });
  }

  // framing: broken stone pillars with ivy
  const pillar = (x0: number, pw: number) => {
    for (let x = x0; x < x0 + pw; x++)
      for (let y = 0; y < h; y++) {
        const k = x - x0;
        const joint = y % 12 === 0;
        px(x, y, k === 0 || k === pw - 1 ? '#121620' : joint ? '#22283a' : k < pw / 3 ? '#4a5068' : '#363c52');
      }
    for (let y = 0; y < h; y += 1) if ((y * 7) % 5 < 2) px(x0 + 2 + ((y * 3) % (pw - 4)), y, '#2e5a3a');
  };
  pillar(-2, 18);
  pillar(w - 16, 18);
  for (let i = 0; i < 18; i++) {
    const left = i % 2 === 0;
    const vx = left ? 2 + Math.floor(rnd() * 60) : w - 2 - Math.floor(rnd() * 60);
    const len = 4 + Math.floor(rnd() * 14);
    for (let y = 0; y < len; y++) px(vx + (y % 4 === 0 ? 1 : 0), y, y % 3 ? '#1e3a2a' : '#356a44');
  }

  const [fc, f] = painter(w, h, 55);
  for (let x = 0; x < w; x += 4 + Math.floor(f.rnd() * 8)) grassTuft(f, x, h, 2 + Math.floor(f.rnd() * 4), '#1a2e24', '#355a40');
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(f.rnd() * w);
    f.disc(x, h - 1, 3 + Math.floor(f.rnd() * 2), (dx, dy) => (dx + dy < -0.3 ? '#5a5e70' : '#3e4252'), 2);
  }
  return [c, fc, { torches }];
}

export function buildBackdrops(scene: Phaser.Scene, w: number, h: number, ground: number): Record<Theme, Backdrop> {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const out = {} as Record<Theme, Backdrop>;
  for (const [theme, make] of [
    ['forest', forest],
    ['ruins', ruins],
  ] as const) {
    const [bg, fg, info] = make(w, h, ground);
    add(`bg_${theme}`, bg);
    add(`fg_${theme}`, fg);
    out[theme] = info;
  }
  return out;
}
