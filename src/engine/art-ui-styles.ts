// The eight style stages (docs/ui-style.md, "Hero select"): the place each style's heroes stand in on the hero select
// (and, darker, their skill tree's backdrop). Blade: a castle yard with banners; Shadow: moonlit rooftops; Guardian: a
// stone gate with torches; Marksman: a dusk forest; Brute: a quarry; Controller: an ice cave; Summoner: a glowing
// grove; Bomber: a workshop. Painted once on first use (art-ui-stage.ts ensureStage), never at boot.
//
// Composed for the hero select's layout: the hero stands left of centre (feet near x 80, y 130, on the floor that
// starts at the theme's floorY) and the details' glass covers the right, so each scene frames that spot (a gate, an
// arch, a great tree or a lamp behind them, props either side) and keeps its other interest spread wide (the skill
// tree uses the whole width). Light from the top left (art-style.md), shadows cool, highlights warm, far layers tinted
// toward the sky, clusters rather than noise, dithering only for big gradients and glows.
import type { StageSpec } from './art-ui-stage';

type Ctx = CanvasRenderingContext2D;
type Rng = () => number;

/** A style stage: the layers between the sky and the floor, and what stands on the floor (painted after it). */
export interface StylePainter {
  back: (ctx: Ctx, w: number, sp: StageSpec, r: Rng) => void;
  floor?: (ctx: Ctx, w: number, sp: StageSpec, r: Rng) => void;
}

const H = 150;
const INK = '#140c1c';
const B4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// ------------------------------------------------------------------ painting helpers

function fill(ctx: Ctx, c: string, x: number, y: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Colour `c` dithered over a rect at density k (0..1), 4x4 ordered. */
function dith(ctx: Ctx, c: string, x: number, y: number, w: number, h: number, k: number): void {
  ctx.fillStyle = c;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (k * 16 > B4[yy & 3][xx & 3]) ctx.fillRect(xx, yy, 1, 1);
}

/** A stepped (crisp) ellipse. */
function oval(ctx: Ctx, c: string, cx: number, cy: number, rx: number, ry: number, a = 1): void {
  if (rx <= 0 || ry <= 0) return;
  ctx.globalAlpha = a;
  ctx.fillStyle = c;
  const n = Math.ceil(ry);
  for (let y = -n; y <= n; y++) {
    const k = 1 - (y * y) / (ry * ry);
    if (k < 0) continue;
    const hw = Math.round(rx * Math.sqrt(k));
    if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
  ctx.globalAlpha = 1;
}

/** A soft light: stepped ovals, faint at the rim and stronger inside (`squash` flattens it, for a pool on a floor). */
function glowAt(ctx: Ctx, c: string, cx: number, cy: number, r: number, a = 0.5, squash = 1): void {
  for (const [k, aa] of [
    [1, 0.16],
    [0.72, 0.2],
    [0.48, 0.26],
    [0.26, 0.32],
  ] as const)
    oval(ctx, c, cx, cy, r * k, r * k * squash, a * aa);
}

/** Bands top to bottom over a rect, the last third of each dithering into the next. */
function vbands(ctx: Ctx, x: number, y0: number, w: number, y1: number, cols: string[]): void {
  const n = cols.length;
  const h = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const f = ((y - y0) / h) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const t = (f - i - 0.66) / 0.34;
    for (let xx = x; xx < x + w; xx++) {
      ctx.fillStyle = i + 1 < n && t > 0 && t * 16 > B4[y & 3][xx & 3] ? cols[i + 1] : cols[i];
      ctx.fillRect(xx, y, 1, 1);
    }
  }
}

/** A silhouette from a height function (top y per column), its top row lit. */
function ridge(ctx: Ctx, x0: number, x1: number, bottom: number, top: (x: number) => number, body: string, edge?: string): void {
  for (let x = Math.max(0, x0); x < x1; x++) {
    const t = Math.round(top(x));
    if (t >= bottom) continue;
    fill(ctx, body, x, t, 1, bottom - t);
    if (edge) fill(ctx, edge, x, t, 1, 1);
  }
}

/** Stars: single pixels and a few brighter crosses. */
function stars(ctx: Ctx, w: number, y0: number, y1: number, n: number, r: Rng, cols = ['#c8d8ff', '#ffffff', '#9ab0e0']): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(y0 + r() * (y1 - y0));
    const c = cols[i % cols.length];
    fill(ctx, c, x, y, 1, 1);
    if (i % 9 === 0) {
      ctx.globalAlpha = 0.5;
      fill(ctx, c, x - 1, y, 3, 1);
      fill(ctx, c, x, y - 1, 1, 3);
      ctx.globalAlpha = 1;
    }
  }
}

/** A moon: a halo, the disc lit from the top left, a few soft craters. */
function moon(ctx: Ctx, cx: number, cy: number, rad: number, lit: string, shade: string, halo: string): void {
  glowAt(ctx, halo, cx, cy, rad * 3.2, 0.55);
  oval(ctx, shade, cx, cy, rad, rad);
  oval(ctx, lit, cx - 1, cy - 1, rad - 1, rad - 1);
  oval(ctx, shade, cx + rad * 0.3, cy - rad * 0.2, rad * 0.22, rad * 0.22, 0.5);
  oval(ctx, shade, cx - rad * 0.25, cy + rad * 0.35, rad * 0.16, rad * 0.16, 0.45);
  oval(ctx, '#ffffff', cx - rad * 0.4, cy - rad * 0.45, rad * 0.2, rad * 0.12, 0.6);
}

/**
 * Masonry in running bond: each block a slightly different tone, its top edge lit, its bottom shaded, mortar
 * between. `shadeR` darkens toward the right edge (a tower's shaded side).
 */
function masonry(ctx: Ctx, x: number, y: number, w: number, h: number, o: { tones: string[]; mortar: string; hi: string; lo: string; rowH: number; blockW: number; r: Rng }): void {
  for (let yy = y, row = 0; yy < y + h; yy += o.rowH, row++) {
    const rh = Math.min(o.rowH, y + h - yy);
    let xx = x - (row % 2 ? Math.round(o.blockW / 2) : 0);
    while (xx < x + w) {
      const bw = Math.max(3, Math.round(o.blockW * (0.75 + o.r() * 0.5)));
      const a = Math.max(x, xx);
      const b = Math.min(x + w, xx + bw);
      if (b > a) {
        fill(ctx, o.tones[Math.floor(o.r() * o.tones.length)], a, yy, b - a, rh);
        fill(ctx, o.hi, a, yy, b - a - 1, 1);
        if (rh > 3) fill(ctx, o.lo, a, yy + rh - 2, b - a - 1, 1);
        fill(ctx, o.mortar, a, yy + rh - 1, b - a, 1);
        if (b < x + w) fill(ctx, o.mortar, b - 1, yy, 1, rh);
      }
      xx += bw;
    }
  }
}

/**
 * A floor in perspective from y0 to y1: rows of slabs that grow toward the viewer, their joints converging on a
 * vanishing point above (vx, y0). Each slab a tone of its own; a seam and a lit lip on every row. `rowH`/`grow` set the
 * rows (planks: one long row), `tile` the slab width at the back row.
 */
function perspFloor(ctx: Ctx, w: number, y0: number, y1: number, vx: number, o: { tones: string[]; seam: string; lip: string; r: Rng; tile?: number; rowH?: number; grow?: number; stagger?: boolean }): void {
  const vy = y0 - 46;
  let y = y0;
  let h = o.rowH ?? 3;
  let row = 0;
  while (y < y1) {
    const yb = Math.min(y1, y + h);
    const ym = (y + yb) / 2;
    const tw = (o.tile ?? 14) * ((ym - vy) / (y0 - vy));
    const off = o.stagger === false ? 0 : (row % 2) * 0.5;
    const jx = (j: number, yy: number) => vx + (j + off) * tw * ((yy - vy) / (ym - vy));
    for (let j = -40; j <= 40; j++) {
      if (jx(j + 1, ym) < -2 || jx(j, ym) > w + 2) continue;
      const tone = o.tones[Math.floor(o.r() * o.tones.length)];
      for (let yy = y; yy < yb; yy++) {
        const a = Math.round(jx(j, yy));
        const b = Math.round(jx(j + 1, yy));
        fill(ctx, tone, a + 1, yy, b - a - 1, 1);
        fill(ctx, o.seam, a, yy, 1, 1);
      }
    }
    fill(ctx, o.seam, 0, y, w, 1);
    if (yb - y > 2) {
      ctx.globalAlpha = 0.7;
      fill(ctx, o.lip, 0, y + 1, w, 1);
      ctx.globalAlpha = 1;
    }
    y = yb;
    row++;
    h = Math.round(h * (o.grow ?? 1.4) + 1);
  }
}

/** A wall torch: an iron bracket, a wooden haft, a flame, and its warm light on the wall. */
function torch(ctx: Ctx, x: number, y: number, light = '#ffa040', a = 0.7): void {
  glowAt(ctx, light, x + 1, y - 3, 26, a);
  fill(ctx, INK, x - 2, y - 1, 6, 11);
  fill(ctx, '#4e2c16', x, y, 2, 9);
  fill(ctx, '#8e5a2e', x, y, 1, 9);
  fill(ctx, '#2a2f45', x - 1, y + 4, 4, 2);
  fill(ctx, '#7c86a6', x - 1, y + 4, 4, 1);
  // the flame
  fill(ctx, '#c02a1a', x - 1, y - 4, 4, 4);
  fill(ctx, '#ff7a1a', x - 1, y - 5, 3, 4);
  fill(ctx, '#ffb83a', x, y - 6, 2, 4);
  fill(ctx, '#fff0a0', x, y - 4, 2, 2);
  fill(ctx, '#ff7a1a', x + 1, y - 8, 1, 2);
}

/** A hanging banner: a pole with gold finials, the cloth in folds (a lit left edge), trim, a swallowtail, an emblem. */
function banner(ctx: Ctx, x: number, top: number, bw: number, len: number, ramp: [string, string, string, string], trim: string, emblem?: (cx: number, cy: number) => void): void {
  fill(ctx, INK, x - 4, top - 3, bw + 8, 4);
  fill(ctx, '#6e4020', x - 3, top - 2, bw + 6, 2);
  fill(ctx, '#b07a44', x - 3, top - 2, bw + 6, 1);
  fill(ctx, '#f2c230', x - 5, top - 3, 2, 3);
  fill(ctx, '#f2c230', x + bw + 3, top - 3, 2, 3);
  const notch = Math.floor(bw / 2);
  // outline
  fill(ctx, INK, x - 1, top, bw + 2, len);
  for (let i = 0; i < bw; i++) {
    const d = Math.abs(i - (bw - 1) / 2);
    const cut = Math.max(0, Math.round(notch - d));
    const c = i === 0 ? ramp[0] : i % 4 === 3 ? ramp[2] : i === bw - 1 ? ramp[3] : ramp[1];
    fill(ctx, c, x + i, top, 1, len - cut);
    fill(ctx, INK, x + i, top + len - cut, 1, 1);
  }
  fill(ctx, trim, x, top + 1, bw, 2);
  fill(ctx, trim, x, top + len - notch - 3, bw, 1);
  emblem?.(x + bw / 2, top + Math.round(len * 0.42));
}

/** A pine: tiers of boughs, its left side catching the light. */
function pine(ctx: Ctx, cx: number, base: number, hgt: number, body: string, lit: string, dark?: string): void {
  for (let y = base - hgt; y < base; y++) {
    const k = (y - (base - hgt)) / hgt;
    const tier = (y - (base - hgt)) % 6;
    const half = Math.max(1, Math.round(1 + k * hgt * 0.3 - (tier < 2 ? 1.5 : 0)));
    fill(ctx, body, cx - half, y, half * 2, 1);
    fill(ctx, lit, cx - half, y, Math.max(1, Math.round(half * 0.45)), 1);
    if (dark) fill(ctx, dark, cx + half - Math.max(1, Math.round(half * 0.3)), y, Math.max(1, Math.round(half * 0.3)), 1);
  }
}

/**
 * A faceted crystal standing at (cx, base): a sharp tip, then a prism; the left face lit, a bright ridge, the right
 * face in shade, an ink rim, a glint near the tip. `lean` tilts it.
 */
function crystal(ctx: Ctx, cx: number, base: number, hgt: number, hw: number, ramp: [string, string, string, string], lean = 0): void {
  const top = base - hgt;
  const tip = Math.min(hgt * 0.55, hw * 2.4);
  const rowsOf = (y: number) => {
    const d = y - top;
    const half = d < tip ? Math.max(0, (d / tip) * hw) : hw + ((d - tip) / hgt) * 1.2;
    const sx = cx + lean * (1 - d / hgt) * hgt * 0.35;
    return { sx, half };
  };
  for (let y = top - 1; y < base; y++) {
    const { sx, half } = rowsOf(Math.max(top, y));
    fill(ctx, INK, Math.round(sx - half) - 1, y, Math.round(half * 2) + 2, 1);
  }
  for (let y = top; y < base; y++) {
    const { sx, half } = rowsOf(y);
    const x0 = Math.round(sx - half);
    const x1 = Math.round(sx + half);
    const rx = Math.round(sx - half * 0.2);
    if (x1 - x0 < 1) {
      fill(ctx, ramp[0], Math.round(sx), y, 1, 1);
      continue;
    }
    fill(ctx, ramp[1], x0, y, rx - x0, 1);
    fill(ctx, ramp[0], x0, y, Math.max(1, Math.round((rx - x0) * 0.45)), 1);
    fill(ctx, ramp[2], rx + 1, y, x1 - rx - 1, 1);
    if (x1 - rx > 3) fill(ctx, ramp[3], x1 - 1, y, 1, 1);
    fill(ctx, y - top < tip ? '#ffffff' : ramp[0], rx, y, 1, 1);
  }
  fill(ctx, '#ffffff', Math.round(cx - hw * 0.5), Math.round(top + tip + 2), 1, 3);
}

/** A wooden barrel or keg (bands of iron), bottom-centre at (cx, base). */
function barrel(ctx: Ctx, cx: number, base: number, bw: number, bh: number, o: { wood?: [string, string, string]; band?: string; mark?: string; fuse?: boolean } = {}): void {
  const [hi, mid, lo] = o.wood ?? ['#b07a44', '#8e5a2e', '#5e3618'];
  const x = Math.round(cx - bw / 2);
  const y = base - bh;
  fill(ctx, INK, x - 1, y - 1, bw + 2, bh + 1);
  for (let i = 0; i < bw; i++) {
    const k = i / (bw - 1);
    const bulge = k < 0.15 || k > 0.85 ? 1 : 0;
    fill(ctx, k < 0.3 ? hi : k < 0.75 ? mid : lo, x + i, y + bulge, 1, bh - bulge * 2);
    if (i % 4 === 3) fill(ctx, lo, x + i, y + bulge, 1, bh - bulge * 2);
  }
  const band = o.band ?? '#4a5272';
  for (const by of [y + 2, y + bh - 4]) {
    fill(ctx, band, x, by, bw, 2);
    fill(ctx, '#7c86a6', x, by, Math.round(bw * 0.4), 1);
  }
  fill(ctx, '#d8a868', x + 1, y + 1, Math.round(bw * 0.5), 1);
  if (o.mark) {
    // a painted X (powder)
    const mx = Math.round(cx);
    const my = Math.round(y + bh / 2);
    for (let i = -2; i <= 2; i++) {
      fill(ctx, o.mark, mx + i, my + i, 1, 1);
      fill(ctx, o.mark, mx + i, my - i, 1, 1);
    }
  }
  if (o.fuse) {
    fill(ctx, '#d8c8a0', Math.round(cx) + 1, y - 4, 1, 4);
    fill(ctx, '#d8c8a0', Math.round(cx) + 2, y - 5, 1, 1);
  }
}

/** A wooden crate, bottom-left at (x, base). */
function crate(ctx: Ctx, x: number, base: number, cw: number, ch: number): void {
  const y = base - ch;
  fill(ctx, INK, x - 1, y - 1, cw + 2, ch + 1);
  fill(ctx, '#8e5a2e', x, y, cw, ch);
  for (let yy = y + 3; yy < base - 1; yy += 4) fill(ctx, '#6e4020', x, yy, cw, 1);
  fill(ctx, '#b07a44', x, y, cw, 1);
  fill(ctx, '#b07a44', x, y, 1, ch);
  fill(ctx, '#5e3618', x + cw - 1, y, 1, ch);
  // the diagonal brace
  for (let i = 0; i < cw - 2; i++) fill(ctx, '#d09a5e', x + 1 + i, Math.round(y + 1 + (i * (ch - 3)) / (cw - 3)), 1, 1);
}

/** Tufts of grass along a floor: little blades in two greens. */
function tufts(ctx: Ctx, w: number, y0: number, y1: number, n: number, r: Rng, cols: [string, string]): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(y0 + r() * (y1 - y0));
    const s = y > y0 + (y1 - y0) * 0.5 ? 2 : 1;
    fill(ctx, cols[0], x, y - s, 1, s + 1);
    fill(ctx, cols[1], x + 1, y - s - 1, 1, s + 2);
    fill(ctx, cols[0], x + 2, y - s + 1, 1, s);
  }
}

/** A glowing mushroom: a stem, a round cap with spots, its glow. */
function shroom(ctx: Ctx, x: number, base: number, size: number, cap: [string, string], glowCol: string): void {
  glowAt(ctx, glowCol, x, base - size, size * 3.2, 0.5);
  fill(ctx, INK, x - 1, base - size, 3, size + 1);
  fill(ctx, '#e0e8c8', x, base - size, 1, size);
  const cr = size + 1;
  oval(ctx, INK, x, base - size - 1, cr + 1, Math.ceil(cr / 2) + 1);
  oval(ctx, cap[1], x, base - size - 1, cr, Math.ceil(cr / 2));
  oval(ctx, cap[0], x - 1, base - size - 2, Math.max(1, cr - 2), Math.max(1, Math.ceil(cr / 2) - 1));
  fill(ctx, '#ffffff', x - 1, base - size - 3, 1, 1);
}

/** A paper lantern hanging at (x, y): a cap, a glowing body with ribs, a tassel, its glow. */
function lantern(ctx: Ctx, x: number, y: number, body: string, light: string): void {
  glowAt(ctx, light, x, y + 3, 14, 0.55);
  fill(ctx, INK, x - 3, y - 1, 7, 9);
  fill(ctx, '#2a1a20', x - 2, y - 1, 5, 1);
  fill(ctx, body, x - 2, y, 5, 6);
  fill(ctx, light, x - 1, y + 1, 3, 4);
  fill(ctx, '#fff0c0', x - 1, y + 1, 1, 2);
  fill(ctx, body, x - 2, y + 3, 5, 1);
  fill(ctx, '#2a1a20', x - 2, y + 6, 5, 1);
  fill(ctx, light, x, y + 7, 1, 2);
}

// ------------------------------------------------------------------ the eight stages

/** Blade: a castle yard at night. The keep's gate behind the hero, banners on the wall, torches either side. */
const castle: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    stars(ctx, w, 2, 46, 34, r);
    moon(ctx, 136, 24, 8, '#eef4ff', '#b8c8e8', '#bcd0ff');
    // far: the keep's towers and roofs, low contrast, tinted toward the sky
    const far = '#1a2648';
    const farLit = '#2a3a66';
    for (const [tx, tw2, top] of [
      [30, 20, 34],
      [100, 24, 22],
      [196, 18, 38],
      [262, 22, 30],
    ] as const) {
      fill(ctx, far, tx, top, tw2, fy - top);
      fill(ctx, farLit, tx, top, 2, fy - top);
      // a cone roof and its pennant
      for (let i = 0; i < 10; i++) {
        const half = Math.round(((i + 1) / 10) * (tw2 / 2 + 2));
        fill(ctx, '#202c52', tx + tw2 / 2 - half, top - 10 + i, half * 2, 1);
        fill(ctx, '#34446e', tx + tw2 / 2 - half, top - 10 + i, Math.max(1, Math.round(half * 0.5)), 1);
      }
      fill(ctx, '#3a4a70', tx + tw2 / 2, top - 15, 1, 5);
      fill(ctx, '#c03030', tx + tw2 / 2 + 1, top - 15, 4, 2);
      for (let wy = top + 6; wy < 62; wy += 9) {
        fill(ctx, '#0e1430', tx + tw2 / 2 - 1, wy, 3, 4);
        if (r() < 0.6) {
          glowAt(ctx, '#ffc870', tx + tw2 / 2 + 0.5, wy + 2, 5, 0.6);
          fill(ctx, '#ffd890', tx + tw2 / 2 - 1, wy + 1, 2, 3);
        }
      }
    }
    // the curtain wall with its crenels
    const wallTop = 66;
    for (let x = 0; x < w; x += 10) {
      fill(ctx, INK, x - 1, wallTop - 6, 8, 7);
      fill(ctx, '#2e3a60', x, wallTop - 5, 6, 6);
      fill(ctx, '#4a5a88', x, wallTop - 5, 6, 1);
      fill(ctx, '#3c4a76', x, wallTop - 5, 1, 6);
    }
    fill(ctx, INK, 0, wallTop - 1, w, 1);
    masonry(ctx, 0, wallTop, w, fy - wallTop, { tones: ['#2a3458', '#2e385e', '#263052', '#323c62'], mortar: '#1a2240', hi: '#3e4c7a', lo: '#222a4a', rowH: 6, blockW: 12, r });
    // the light falls off toward the floor (a cool shadow at the wall's foot)
    dith(ctx, '#141c38', 0, fy - 10, w, 10, 0.4);
    // the gate behind the hero: an arch of voussoirs, a portcullis in the dark
    const gx = 82;
    const gw = 24;
    const gTop = 70;
    for (let y = gTop - 4; y < fy; y++) {
      const dy = y - (gTop + 8);
      const half = dy < 0 ? Math.round(Math.sqrt(Math.max(0, (gw / 2 + 4) ** 2 - dy * dy * 2.2))) : gw / 2 + 4;
      fill(ctx, '#46547e', gx - half, y, half * 2, 1);
      fill(ctx, '#5a6a98', gx - half, y, 2, 1);
    }
    for (let y = gTop; y < fy; y++) {
      const dy = y - (gTop + 8);
      const half = dy < 0 ? Math.round(Math.sqrt(Math.max(0, (gw / 2) ** 2 - dy * dy * 2.2))) : gw / 2;
      fill(ctx, INK, gx - half - 1, y, half * 2 + 2, 1);
      fill(ctx, '#0a0e22', gx - half, y, half * 2, 1);
    }
    for (let x = gx - gw / 2 + 2; x < gx + gw / 2; x += 4) {
      fill(ctx, '#2a2f45', x, gTop + 4, 2, fy - gTop - 10);
      fill(ctx, '#4a5272', x, gTop + 4, 1, fy - gTop - 10);
    }
    for (let y = gTop + 8; y < fy - 6; y += 5) fill(ctx, '#2a2f45', gx - gw / 2 + 1, y, gw - 2, 1);
    // banners on the wall, framing the gate (and more along it)
    const red: [string, string, string, string] = ['#f05a48', '#c02a2a', '#8a1a22', '#5a0f1a'];
    const blue: [string, string, string, string] = ['#6aa0f0', '#2a5ac0', '#1a3c8a', '#10204a'];
    const sword = (cx: number, cy: number) => {
      fill(ctx, '#eef3fa', cx - 0.5, cy - 6, 1, 9);
      fill(ctx, '#f2c230', cx - 2.5, cy + 2, 5, 1);
      fill(ctx, '#d8901c', cx - 0.5, cy + 3, 1, 2);
    };
    banner(ctx, 40, 72, 11, 30, red, '#f2c230', sword);
    banner(ctx, 113, 72, 11, 30, red, '#f2c230', sword);
    banner(ctx, 176, 70, 10, 26, blue, '#f2c230', sword);
    banner(ctx, 238, 70, 10, 26, red, '#f2c230', sword);
    banner(ctx, 296, 70, 10, 26, blue, '#f2c230', sword);
    torch(ctx, 22, 84);
    torch(ctx, 142, 84);
    torch(ctx, 268, 84, '#ffa040', 0.5);
  },
  floor(ctx, w, sp, r) {
    perspFloor(ctx, w, sp.floorY, H, 82, { tones: ['#3a3e5a', '#42465f', '#363a54', '#3e4262', '#464a66'], seam: '#1e2236', lip: '#5a6084', r, tile: 16 });
    // torchlight warms the floor at the walls' foot
    glowAt(ctx, '#ff9a40', 22, sp.floorY + 4, 30, 0.45, 0.35);
    glowAt(ctx, '#ff9a40', 142, sp.floorY + 4, 30, 0.45, 0.35);
  },
};

/** Shadow: moonlit rooftops. A big moon over the hero, a pagoda, paper lanterns strung across, a tiled roof to stand on. */
const roofs: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    stars(ctx, w, 2, 50, 40, r, ['#e8d8ff', '#ffffff', '#b8a0e8']);
    moon(ctx, 92, 36, 15, '#f8f0ff', '#c8b8e8', '#d8c0ff');
    // a thin cloud across the moon
    for (const [cx, cy, len] of [
      [70, 42, 40],
      [118, 30, 30],
      [230, 22, 46],
    ] as const) {
      fill(ctx, '#3a2660', cx - len / 2, cy, len, 2);
      fill(ctx, '#4e3478', cx - len / 2 + 4, cy - 1, len - 8, 1);
      fill(ctx, '#2a1a48', cx - len / 2 + 6, cy + 2, len - 12, 1);
    }
    // the far town: rooftops with curled eaves and a few lit windows
    const farTop = (x: number) => {
      const seg = Math.floor(x / 28);
      const local = x % 28;
      const h = 70 + ((seg * 37) % 16);
      const eave = local < 3 || local > 25 ? 2 : 0;
      return h + Math.abs(local - 14) * 0.45 - eave;
    };
    ridge(ctx, 0, w, fy, farTop, '#22163e', '#3a2862');
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(84 + r() * (fy - 92));
      glowAt(ctx, '#ffb850', x + 1, y + 1, 4, 0.5);
      fill(ctx, '#ffcc70', x, y, 2, 2);
    }
    // the pagoda: three tiers of curved roofs, right of the hero
    const px = 170;
    for (const [ty, half, bh] of [
      [36, 12, 12],
      [52, 16, 14],
      [70, 20, 42],
    ] as const) {
      fill(ctx, '#1a1030', px - half + 4, ty, (half - 4) * 2, bh);
      fill(ctx, '#2a1c48', px - half + 4, ty, 2, bh);
      // the roof: curled up at the ends
      for (let i = 0; i < 6; i++) {
        const hw = half + i;
        fill(ctx, '#140c24', px - hw, ty - 6 + i, hw * 2, 1);
        fill(ctx, '#4a3470', px - hw, ty - 6 + i, Math.round(hw * 0.6), 1);
      }
      fill(ctx, '#4a3470', px - half - 7, ty - 3, 2, 2);
      fill(ctx, '#4a3470', px + half + 5, ty - 3, 2, 2);
      fill(ctx, '#ffcc70', px - 2, ty + 3, 4, 4);
      glowAt(ctx, '#ffb850', px, ty + 5, 8, 0.5);
    }
    fill(ctx, '#2a1c48', px, 20, 1, 10);
    // near rooftops either side
    ridge(ctx, 0, w, fy, (x) => 96 + Math.abs((x % 60) - 30) * 0.35 + (x % 60 < 3 || x % 60 > 57 ? -2 : 0), '#160e2a', '#40306a');
    // the lantern string, sagging between posts
    for (const [x0, x1] of [
      [0, 150],
      [210, 327],
    ] as const) {
      const sag = (x: number) => 44 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 12;
      for (let x = x0; x < x1; x++) fill(ctx, '#2a1a3a', x, sag(x), 1, 1);
      for (let x = x0 + 12; x < x1 - 6; x += 22) lantern(ctx, x, Math.round(sag(x)) + 1, x % 44 < 22 ? '#c02a2a' : '#d06a1a', '#ff9a50');
    }
  },
  floor(ctx, w, sp, r) {
    // the roof we stand on: rows of tiles, a ridge cap along the back
    perspFloor(ctx, w, sp.floorY, H, 84, { tones: ['#2e2048', '#34244f', '#2a1c42', '#3a2856'], seam: '#160e28', lip: '#5a4488', r, tile: 9, rowH: 4, grow: 1.25 });
    fill(ctx, INK, 0, sp.floorY - 1, w, 2);
    fill(ctx, '#4a3470', 0, sp.floorY - 1, w, 1);
    for (let x = 2; x < w; x += 9) fill(ctx, '#6a4c98', x, sp.floorY - 1, 3, 1);
    glowAt(ctx, '#c8a0ff', 84, sp.floorY + 12, 40, 0.25, 0.3);
  },
};

/** Guardian: a fortress gate at dusk, its arch behind the hero, torches burning either side, shields on the towers. */
const gate: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    stars(ctx, w, 2, 30, 18, r, ['#a8c0c8', '#e0f0f0']);
    // far mountains
    ridge(ctx, 0, w, fy, (x) => 40 + Math.abs(Math.sin(x * 0.018 + 0.6)) * 18 + Math.sin(x * 0.07) * 3, '#1a2832', '#2a3c46');
    ridge(ctx, 0, w, fy, (x) => 56 + Math.abs(Math.sin(x * 0.03 + 2)) * 12, '#1e2c36', '#30424c');
    const stone = { mortar: '#24282e', hi: '#727880', lo: '#383c44', rowH: 6, blockW: 11, r };
    // the side walls out to the edges
    masonry(ctx, 0, 66, w, fy - 66, { ...stone, tones: ['#3e4248', '#44484e', '#3a3e44'] });
    for (let x = 0; x < w; x += 9) {
      fill(ctx, INK, x - 1, 60, 7, 7);
      fill(ctx, '#4a4e56', x, 61, 5, 6);
      fill(ctx, '#666c76', x, 61, 5, 1);
    }
    // the gatehouse: two towers and the arch between them
    const gx = 82;
    for (const tx of [gx - 50, gx + 26]) {
      masonry(ctx, tx, 22, 24, fy - 22, { ...stone, tones: ['#4c5056', '#52565e', '#484c52'] });
      // the right third in shade
      ctx.globalAlpha = 0.35;
      fill(ctx, '#141a24', tx + 16, 22, 8, fy - 22);
      ctx.globalAlpha = 1;
      fill(ctx, '#7a808a', tx, 22, 1, fy - 22);
      for (let x = tx; x < tx + 24; x += 6) {
        fill(ctx, INK, x - 1, 15, 6, 8);
        fill(ctx, '#565a62', x, 16, 4, 7);
        fill(ctx, '#7a808a', x, 16, 4, 1);
      }
      // an arrow slit and a round shield
      fill(ctx, INK, tx + 11, 34, 2, 9);
      const scx = tx + 12;
      oval(ctx, INK, scx, 56, 6, 6);
      oval(ctx, '#2a5ac0', scx, 56, 5, 5);
      oval(ctx, '#4a8ae8', scx - 1, 55, 3, 3);
      fill(ctx, '#d8dee8', scx - 1, 51, 2, 10);
      fill(ctx, '#d8dee8', scx - 5, 55, 10, 2);
      fill(ctx, '#f2c230', scx - 1, 55, 2, 2);
    }
    masonry(ctx, gx - 26, 40, 52, fy - 40, { ...stone, tones: ['#464a50', '#4c5056', '#42464c'] });
    for (let x = gx - 26; x < gx + 26; x += 7) {
      fill(ctx, INK, x - 1, 34, 6, 7);
      fill(ctx, '#52565e', x, 35, 4, 6);
      fill(ctx, '#727880', x, 35, 4, 1);
    }
    // the arch: voussoirs, the dark passage, the raised portcullis' teeth
    const aw = 17;
    const aTop = 58;
    for (let y = aTop - 4; y < fy; y++) {
      const dy = y - (aTop + 12);
      const half = dy < 0 ? Math.round(Math.sqrt(Math.max(0, (aw + 4) ** 2 - dy * dy * 1.4))) : aw + 4;
      fill(ctx, '#62686f', gx - half, y, half * 2, 1);
      fill(ctx, '#80868e', gx - half, y, 2, 1);
    }
    for (let y = aTop; y < fy; y++) {
      const dy = y - (aTop + 12);
      const half = dy < 0 ? Math.round(Math.sqrt(Math.max(0, aw ** 2 - dy * dy * 1.4))) : aw;
      fill(ctx, INK, gx - half - 1, y, half * 2 + 2, 1);
      fill(ctx, '#0c1218', gx - half, y, half * 2, 1);
    }
    // a glimpse of warm light far through the passage
    glowAt(ctx, '#ffb060', gx, fy - 14, 16, 0.35);
    for (let x = gx - aw + 3; x < gx + aw - 2; x += 4) {
      fill(ctx, '#2a2f45', x, aTop + 2, 2, 12);
      fill(ctx, '#4a5272', x, aTop + 2, 1, 12);
      fill(ctx, '#7c86a6', x, aTop + 13, 2, 2);
    }
    fill(ctx, '#2a2f45', gx - aw + 2, aTop + 6, aw * 2 - 4, 1);
    torch(ctx, gx - 55, 78, '#ffa040', 0.85);
    torch(ctx, gx + 54, 78, '#ffa040', 0.85);
    torch(ctx, 250, 80, '#ffa040', 0.6);
    torch(ctx, 306, 80, '#ffa040', 0.5);
  },
  floor(ctx, w, sp, r) {
    perspFloor(ctx, w, sp.floorY, H, 82, { tones: ['#40444a', '#484c52', '#3a3e44', '#4e5258', '#44484e'], seam: '#22262c', lip: '#686e76', r, tile: 9, rowH: 3, grow: 1.3 });
    glowAt(ctx, '#ff9a40', 27, sp.floorY + 6, 34, 0.5, 0.35);
    glowAt(ctx, '#ff9a40', 136, sp.floorY + 6, 34, 0.5, 0.35);
  },
};

/** Marksman: a forest at dusk. The low sun through the pines behind the hero, rays, a straw target with arrows. */
const pines: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    const sx = 84;
    const sy = 80;
    glowAt(ctx, '#ffd890', sx, sy, 70, 0.55);
    oval(ctx, '#fff0b0', sx, sy, 11, 11);
    oval(ctx, '#ffffe0', sx - 1, sy - 1, 8, 8);
    // three rows of pines, the far ones tinted toward the sky
    for (let i = 0; i < 26; i++) pine(ctx, Math.floor(r() * w), fy - 8, 22 + Math.floor(r() * 16), '#8a4a5a', '#a85e60');
    for (let i = 0; i < 18; i++) pine(ctx, Math.floor(r() * w), fy - 4, 34 + Math.floor(r() * 18), '#5a3048', '#7a4050', '#4a2440');
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(r() * w);
      if (Math.abs(x - sx) < 20) continue;
      pine(ctx, x, fy + 2, 46 + Math.floor(r() * 22), '#2e1c30', '#5a3040', '#24142a');
    }
    // two great trunks framing the scene, rimmed by the sun on their inner sides
    for (const [tx, tw2, rim] of [
      [2, 12, 1],
      [150, 14, -1],
      [262, 12, -1],
    ] as const) {
      fill(ctx, INK, tx - 1, 0, tw2 + 2, fy + 4);
      fill(ctx, '#2a1a1e', tx, 0, tw2, fy + 4);
      fill(ctx, '#3e2620', tx + 2, 0, 3, fy + 4);
      for (let y = 6; y < fy; y += 7) fill(ctx, '#1e1216', tx + 3 + ((y / 7) % 3), y, 4, 2);
      fill(ctx, '#e08a4a', rim > 0 ? tx + tw2 - 1 : tx, 0, 1, fy + 4);
      // roots
      fill(ctx, '#2a1a1e', tx - 3, fy, tw2 + 6, 3);
    }
    // leaf masses across the top: scalloped clumps, their undersides warm from the sun
    const clumps: Array<[number, number]> = [];
    for (let i = 0; i < 22; i++) {
      const cx = Math.floor(r() * w);
      const cy = Math.floor(r() * 10);
      for (let j = 0; j < 4; j++) clumps.push([cx + (j - 1.5) * 7, cy + (j % 2) * 3]);
    }
    for (const [ox, oy] of clumps) oval(ctx, INK, ox, oy, 7, 6);
    for (const [ox, oy] of clumps) {
      oval(ctx, '#1e1a22', ox, oy, 6, 5);
      fill(ctx, '#6a3436', ox - 3, oy + 4, 6, 1);
    }
    for (const [ox, oy] of clumps) oval(ctx, '#30222c', ox - 2, oy - 2, 2, 1);
    // a straw target on a stand, arrows in it
    const tx = 136;
    const ty = 92;
    fill(ctx, '#4e2c16', tx - 6, ty, 2, fy - ty + 2);
    fill(ctx, '#4e2c16', tx + 5, ty, 2, fy - ty + 2);
    oval(ctx, INK, tx, ty, 10, 10);
    oval(ctx, '#e0c070', tx, ty, 9, 9);
    oval(ctx, '#d03030', tx, ty, 7, 7);
    oval(ctx, '#f4ecd8', tx, ty, 5, 5);
    oval(ctx, '#d03030', tx, ty, 3, 3);
    oval(ctx, '#f2c230', tx, ty, 1, 1);
    fill(ctx, '#fff0c0', tx - 6, ty - 6, 3, 1);
    for (const [ax, ay] of [
      [-2, -1],
      [3, 2],
      [1, -4],
    ] as const) {
      for (let i = 0; i < 7; i++) fill(ctx, '#8e5a2e', tx + ax - i, ty + ay - Math.round(i * 0.4), 1, 1);
      fill(ctx, '#eef3fa', tx + ax - 8, ty + ay - 4, 2, 2);
    }
  },
  floor(ctx, w, sp, r) {
    vbands(ctx, 0, sp.floorY, w, H, ['#3a3a24', '#34402a', '#2e3a26', '#283222', '#20281c']);
    // a dirt path running to the hero
    for (let y = sp.floorY; y < H; y++) {
      const k = (y - sp.floorY) / (H - sp.floorY);
      const half = 6 + k * 26;
      dith(ctx, '#6a5034', 84 - half, y, half * 2, 1, 0.55 - k * 0.15);
    }
    glowAt(ctx, '#ffc070', 84, sp.floorY + 2, 60, 0.45, 0.25);
    tufts(ctx, w, sp.floorY + 2, H - 2, 90, r, ['#3e5a2a', '#6a8a3a']);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(sp.floorY + 4 + r() * (H - sp.floorY - 6));
      fill(ctx, i % 2 ? '#f0d070' : '#e88aa0', x, y, 1, 1);
    }
  },
};

/** Brute: a quarry at sundown. Cut terraces in bands, a crane holding a boulder, stacked blocks, a pick in a rock. */
const cliffs: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    glowAt(ctx, '#ffb070', 230, 40, 60, 0.4);
    // the quarry's terraces: stepped walls with strata, each step's edge catching the light
    const steps = [
      { top: 26, col: ['#5e3626', '#6a3e2a', '#563020'], lip: '#9a6040' },
      { top: 48, col: ['#6e4430', '#7a4c34', '#643c2a'], lip: '#b07850' },
      { top: 72, col: ['#7e5038', '#8a5a3e', '#744a34'], lip: '#c08a5a' },
    ];
    steps.forEach((st, i) => {
      const top = (x: number) => st.top + Math.round(Math.sin(x * 0.05 + i * 2) * 2) + (Math.floor(x / 40 + i) % 2) * 3;
      ridge(ctx, 0, w, fy, top, st.col[0], st.lip);
      for (let x = 0; x < w; x++) {
        const t = top(x);
        for (let y = t + 3; y < fy; y += 5) fill(ctx, st.col[(Math.floor(y / 5) + i) % 3], x, y, 1, 3);
      }
      // cut marks
      for (let k = 0; k < 10; k++) fill(ctx, '#3e2418', Math.floor(r() * w), st.top + 6 + Math.floor(r() * 14), 1, 4);
      ctx.globalAlpha = 0.18;
      fill(ctx, '#2a140c', 0, st.top + 12, w, 4);
      ctx.globalAlpha = 1;
    });
    // the crane: a mast, a boom, a rope, a boulder hanging
    const mx = 30;
    fill(ctx, INK, mx - 1, 18, 5, fy - 18);
    fill(ctx, '#6e4020', mx, 18, 3, fy - 18);
    fill(ctx, '#b07a44', mx, 18, 1, fy - 18);
    for (let i = 0; i < 48; i++) {
      const x = mx + i;
      const y = 22 + Math.round(i * 0.08);
      fill(ctx, INK, x, y - 1, 1, 4);
      fill(ctx, '#8e5a2e', x, y, 1, 2);
      fill(ctx, '#b07a44', x, y, 1, 1);
    }
    for (let i = 0; i < 30; i++) fill(ctx, '#3e2418', mx + 2 + i, 22 + 18 - Math.round(i * 0.6), 1, 1);
    const bx = mx + 44;
    fill(ctx, '#c0a070', bx, 26, 1, 22);
    oval(ctx, INK, bx, 54, 9, 7);
    oval(ctx, '#7a5a48', bx, 54, 8, 6);
    oval(ctx, '#9a7a62', bx - 2, 52, 5, 3);
    fill(ctx, '#c0a070', bx - 6, 48, 12, 1);
    // stacked cut blocks
    const block = (x: number, base: number, bw: number, bh: number) => {
      fill(ctx, INK, x - 1, base - bh - 4, bw + 6, bh + 5);
      fill(ctx, '#c09068', x, base - bh - 3, bw, 3);
      fill(ctx, '#9a6e4c', x, base - bh, bw, bh);
      fill(ctx, '#6a4630', x + bw, base - bh - 2, 4, bh + 2);
      fill(ctx, '#d8b080', x, base - bh - 3, bw, 1);
    };
    block(124, fy, 18, 12);
    block(146, fy, 14, 10);
    block(132, fy - 15, 16, 10);
    block(200, fy, 20, 14);
    block(286, fy, 18, 12);
    block(292, fy - 14, 12, 9);
  },
  floor(ctx, w, sp, r) {
    vbands(ctx, 0, sp.floorY, w, H, ['#6e5038', '#644832', '#5a402c', '#503826', '#463020']);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(sp.floorY + 2 + r() * (H - sp.floorY - 3));
      const s = y > 135 ? 2 : 1;
      fill(ctx, INK, x - 1, y, s + 2, s + 1);
      fill(ctx, r() < 0.5 ? '#9a7a5c' : '#80604a', x, y, s, s);
    }
    // cracks
    for (let k = 0; k < 6; k++) {
      let x = Math.floor(r() * w);
      let y = sp.floorY + 4 + Math.floor(r() * 20);
      for (let i = 0; i < 14; i++) {
        fill(ctx, '#3a2618', x, y, 1, 1);
        x += r() < 0.5 ? 1 : -1;
        y += r() < 0.6 ? 1 : 0;
      }
    }
    // a big rock with a pick in it
    oval(ctx, INK, 140, 136, 13, 8);
    oval(ctx, '#7a6a5c', 140, 136, 12, 7);
    oval(ctx, '#9a8a78', 137, 133, 7, 3);
    fill(ctx, '#6e4020', 145, 118, 2, 16);
    fill(ctx, '#b07a44', 145, 118, 1, 16);
    for (let i = -6; i <= 6; i++) fill(ctx, i < 0 ? '#b8c2d8' : '#7c86a6', 146 + i, 118 + Math.round(Math.abs(i) * 0.4), 1, 2);
    glowAt(ctx, '#ffb070', 84, sp.floorY + 10, 50, 0.3, 0.3);
  },
};

/** Controller: an ice cave. Icicles from the ceiling, a frozen fall behind the hero, crystal clusters glowing, a polished ice floor. */
const crystals: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    // the frozen fall behind the hero
    for (let x = 62; x < 106; x++) {
      const k = Math.abs(x - 84) / 22;
      const col = (x * 7) % 5 < 2 ? '#5aa8c8' : (x * 3) % 4 === 0 ? '#9ad8f0' : '#3a7a9a';
      fill(ctx, col, x, 10, 1, fy - 10 - Math.round(k * 6));
    }
    dith(ctx, '#d0f8ff', 70, 14, 28, fy - 30, 0.12);
    glowAt(ctx, '#9ae8ff', 84, 60, 44, 0.35);
    // far crystal spires
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * w);
      if (Math.abs(x - 84) < 26) continue;
      crystal(ctx, x, fy - 2, 18 + Math.floor(r() * 26), 3 + Math.floor(r() * 3), ['#3a6a8a', '#24486a', '#1a3a56', '#10283e'], (r() - 0.5) * 0.6);
    }
    // the ceiling and its icicles
    for (let x = 0; x < w; x++) {
      const d = 8 + Math.round(Math.abs(Math.sin(x * 0.06)) * 8 + (x % 13 < 4 ? 4 : 0));
      fill(ctx, '#060e18', x, 0, 1, d);
      fill(ctx, '#2a5a7a', x, d - 1, 1, 1);
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * w);
      const len = 6 + Math.floor(r() * 14);
      const top = 10 + Math.floor(r() * 6);
      for (let y = 0; y < len; y++) {
        const half = Math.max(0, Math.round((1 - y / len) * 2));
        fill(ctx, '#9ad8f0', x - half, top + y, half * 2 + 1, 1);
        fill(ctx, '#e0f8ff', x - half, top + y, 1, 1);
      }
    }
    // big crystal clusters framing the hero, and more along the cave
    const ice: [string, string, string, string] = ['#e0fbff', '#7ad8f4', '#2a8ab0', '#14506e'];
    const deep: [string, string, string, string] = ['#a8e8ff', '#4aa0d0', '#226a94', '#103e5a'];
    for (const [x, hgt, hw, lean] of [
      [20, 44, 7, -0.4],
      [30, 30, 5, 0.3],
      [10, 24, 4, -0.2],
      [140, 48, 8, 0.35],
      [128, 28, 5, -0.3],
      [152, 26, 4, 0.5],
      [220, 34, 6, 0.2],
      [300, 40, 7, -0.3],
      [312, 22, 4, 0.4],
    ] as const) {
      glowAt(ctx, '#7ae0ff', x, fy - hgt / 2, hgt * 0.9, 0.35);
      crystal(ctx, x, fy + 2, hgt, hw, hgt > 35 ? ice : deep, lean);
    }
  },
  floor(ctx, w, sp, r) {
    vbands(ctx, 0, sp.floorY, w, H, ['#3a7090', '#336680', '#2c5a74', '#26506a', '#1e4258']);
    // reflections: long light streaks and the clusters' glow mirrored
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(sp.floorY + 3 + r() * (H - sp.floorY - 5));
      fill(ctx, '#7ac8e0', x, y, 6 + Math.floor(r() * 14), 1);
    }
    for (const x of [20, 140, 300]) dith(ctx, '#9ae8ff', x - 6, sp.floorY + 1, 12, 14, 0.3);
    // snow drifts at the edges
    oval(ctx, '#d8f0ff', 8, H - 2, 30, 8);
    oval(ctx, '#ffffff', 4, H - 5, 18, 3);
    oval(ctx, '#d8f0ff', 186, H, 40, 6);
    oval(ctx, '#d8f0ff', 320, H - 4, 26, 9);
    fill(ctx, '#e0f8ff', 0, sp.floorY, w, 1);
  },
};

/** Summoner: a glowing grove at night. An ancient tree behind the hero with runes, glowing mushrooms, hanging vines. */
const grove: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    // far trunks
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(r() * w);
      const tw2 = 3 + Math.floor(r() * 4);
      fill(ctx, '#10261a', x, 0, tw2, fy);
      fill(ctx, '#1c3a26', x, 0, 1, fy);
    }
    // the canopy: leaf clumps with lit rims
    for (let i = 0; i < 20; i++) {
      const cx = Math.floor(r() * w);
      const cy = Math.floor(r() * 26);
      oval(ctx, '#0c2014', cx, cy, 16 + r() * 10, 8 + r() * 5);
      oval(ctx, '#1e4026', cx - 4, cy - 2, 8, 3);
    }
    // the ancient tree behind the hero: a broad trunk, roots spreading, carved runes glowing
    const tx = 84;
    for (let y = 0; y < fy; y++) {
      const k = y / fy;
      const half = Math.round(16 + Math.max(0, k - 0.7) * 50);
      fill(ctx, INK, tx - half - 1, y, half * 2 + 2, 1);
      fill(ctx, '#2a3a24', tx - half, y, half * 2, 1);
      fill(ctx, '#3e5430', tx - half, y, Math.round(half * 0.5), 1);
      fill(ctx, '#1c2a1a', tx + Math.round(half * 0.55), y, Math.round(half * 0.45), 1);
    }
    for (let x = tx - 14; x < tx + 14; x += 5) for (let y = 4; y < fy - 10; y += 9 + (x % 3)) fill(ctx, '#1c2a1a', x, y, 1, 5);
    // the hollow, glowing
    oval(ctx, INK, tx, 54, 8, 11);
    oval(ctx, '#0a1a12', tx, 54, 7, 10);
    glowAt(ctx, '#7af0c8', tx, 56, 18, 0.6);
    oval(ctx, '#3a8a6a', tx, 58, 4, 5);
    // runes up the trunk
    const RUNES = [
      ['X.X', '.X.', '.X.', '.X.', '.X.'],
      ['.X.', 'X.X', '.X.', 'X.X', '.X.'],
      ['X..', 'XX.', 'X.X', 'XX.', 'X..'],
      ['XXX', 'X..', 'XX.', 'X..', 'X..'],
    ];
    [
      [tx - 9, 24],
      [tx + 6, 32],
      [tx - 4, 78],
      [tx + 8, 88],
    ].forEach(([x, y], i) => {
      glowAt(ctx, '#7af0d0', x + 1, y + 2, 7, 0.6);
      RUNES[i].forEach((row, yy) => [...row].forEach((c, xx) => c === 'X' && fill(ctx, '#9affe0', x + xx, y + yy, 1, 1)));
    });
    // vines with glowing bulbs
    for (const vx of [20, 44, 128, 150, 196, 240, 282, 312]) {
      const len = 30 + Math.floor(r() * 40);
      for (let y = 0; y < len; y++) fill(ctx, '#2a5a30', vx + Math.round(Math.sin(y * 0.2) * 1.5), y, 1, 1);
      for (let y = 10; y < len; y += 12) {
        glowAt(ctx, '#c8ff9a', vx + 1, y + 1, 6, 0.6);
        fill(ctx, '#d8ffb0', vx, y, 2, 2);
      }
    }
    // standing stones either side, mossy, a rune glowing on each
    for (const [x, hgt] of [
      [22, 34],
      [146, 30],
      [270, 32],
    ] as const) {
      fill(ctx, INK, x - 7, fy - hgt - 1, 14, hgt + 1);
      fill(ctx, '#4a5a52', x - 6, fy - hgt, 12, hgt);
      fill(ctx, '#6a7a70', x - 6, fy - hgt, 4, hgt);
      fill(ctx, '#323e38', x + 3, fy - hgt, 3, hgt);
      fill(ctx, '#3e7a3a', x - 6, fy - hgt, 12, 3);
      glowAt(ctx, '#7af0c8', x, fy - hgt / 2, 10, 0.55);
      fill(ctx, '#9affe0', x - 1, fy - hgt / 2 - 3, 2, 6);
      fill(ctx, '#9affe0', x - 3, fy - hgt / 2 - 1, 6, 1);
    }
  },
  floor(ctx, w, sp, r) {
    vbands(ctx, 0, sp.floorY, w, H, ['#2a4e26', '#244424', '#1e3c20', '#1a341c', '#142a18']);
    // roots of the great tree running out over the floor
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 40; i++) {
        const x = 84 + dir * (14 + i);
        const y = sp.floorY + Math.round(i * 0.18);
        fill(ctx, '#2a3a24', x, y, 1, 3);
        fill(ctx, '#3e5430', x, y, 1, 1);
      }
    }
    tufts(ctx, w, sp.floorY + 2, H - 2, 70, r, ['#2e5a2a', '#5a9a3a']);
    for (const [x, y, s, a] of [
      [40, 128, 3, 0],
      [48, 132, 2, 1],
      [118, 126, 3, 1],
      [126, 131, 2, 0],
      [8, 140, 4, 0],
      [160, 140, 3, 1],
      [206, 124, 3, 0],
      [250, 136, 4, 1],
      [300, 128, 3, 0],
    ] as const)
      shroom(ctx, x, y, s, a ? ['#c8ff9a', '#6ac04a'] : ['#9af0e0', '#3aa0a0'], a ? '#c8ff9a' : '#7af0d0');
  },
};

/** Bomber: a sapper's workshop. A lamp over the hero, shelves of jars and fuses, kegs and crates, a pegboard of tools. */
const workshop: StylePainter = {
  back(ctx, w, sp, r) {
    const fy = sp.floorY;
    // the plank wall
    for (let x = 0; x < w; x += 9) {
      const tone = ['#3a2416', '#34200f', '#402818'][Math.floor(r() * 3)];
      fill(ctx, tone, x, 0, 9, fy);
      fill(ctx, '#52341e', x, 0, 1, fy);
      fill(ctx, '#22140a', x + 8, 0, 1, fy);
      for (let y = 8 + Math.floor(r() * 20); y < fy; y += 30 + Math.floor(r() * 20)) fill(ctx, '#7c86a6', x + 4, y, 1, 1);
    }
    // beams
    for (const by of [18, 92]) {
      fill(ctx, INK, 0, by - 1, w, 6);
      fill(ctx, '#5e3618', 0, by, w, 4);
      fill(ctx, '#8e5a2e', 0, by, w, 1);
    }
    // a round window, the night outside
    oval(ctx, INK, 30, 50, 13, 13);
    oval(ctx, '#b07a44', 30, 50, 12, 12);
    oval(ctx, '#162a4a', 30, 50, 9, 9);
    oval(ctx, '#1e3a62', 28, 48, 5, 5);
    fill(ctx, '#e8f0ff', 33, 45, 2, 2);
    fill(ctx, '#b07a44', 21, 49, 18, 2);
    fill(ctx, '#b07a44', 29, 41, 2, 18);
    // shelves of jars, bottles and coiled fuse
    const shelf = (x0: number, x1: number, y: number) => {
      fill(ctx, INK, x0 - 1, y - 1, x1 - x0 + 2, 5);
      fill(ctx, '#8e5a2e', x0, y, x1 - x0, 3);
      fill(ctx, '#b07a44', x0, y, x1 - x0, 1);
      for (let x = x0 + 3; x < x1 - 6; x += 9 + Math.floor(r() * 6)) {
        const kind = Math.floor(r() * 3);
        if (kind === 0) {
          const col = ['#5ad848', '#e0463c', '#3a8ae8', '#f2c230'][Math.floor(r() * 4)];
          fill(ctx, INK, x - 1, y - 10, 7, 10);
          fill(ctx, '#c8d8e8', x, y - 9, 5, 9);
          fill(ctx, col, x, y - 6, 5, 6);
          fill(ctx, '#ffffff', x + 1, y - 8, 1, 3);
          fill(ctx, '#6e4426', x + 1, y - 11, 3, 2);
        } else if (kind === 1) {
          barrel(ctx, x + 3, y, 7, 8, { mark: '#e0463c' });
        } else {
          oval(ctx, INK, x + 3, y - 3, 5, 4);
          oval(ctx, '#d8c8a0', x + 3, y - 3, 4, 3);
          oval(ctx, '#a89870', x + 3, y - 3, 2, 1);
        }
      }
    };
    shelf(48, 120, 46);
    shelf(150, 210, 40);
    shelf(150, 210, 66);
    shelf(240, 327, 48);
    // the pegboard: a wrench, a hammer, a saw, a coil
    fill(ctx, INK, 214, 28, 26, 46);
    fill(ctx, '#a07a50', 215, 29, 24, 44);
    for (let y = 32; y < 72; y += 4) for (let x = 218; x < 238; x += 4) fill(ctx, '#6e4a30', x, y, 1, 1);
    fill(ctx, '#b8c2d8', 219, 34, 2, 18);
    fill(ctx, '#b8c2d8', 217, 32, 6, 3);
    fill(ctx, '#6e4020', 228, 40, 2, 16);
    fill(ctx, '#7c86a6', 225, 36, 8, 4);
    fill(ctx, '#eef3fa', 225, 36, 8, 1);
    oval(ctx, '#d8c8a0', 230, 64, 5, 4);
    oval(ctx, '#a07a50', 230, 64, 2, 2);
    // the lamp over the hero: a chain, a brass shade, a bulb, its warm light
    const lx = 84;
    for (let y = 0; y < 22; y += 2) fill(ctx, '#7c86a6', lx, y, 1, 1);
    glowAt(ctx, '#ffc860', lx, 30, 54, 0.55);
    for (let i = 0; i < 6; i++) {
      fill(ctx, INK, lx - 3 - i - 1, 22 + i, (3 + i) * 2 + 3, 1);
      fill(ctx, i < 2 ? '#f2c230' : '#d8901c', lx - 3 - i, 22 + i, (3 + i) * 2 + 1, 1);
    }
    fill(ctx, '#fff0a0', lx - 3, 28, 7, 3);
    fill(ctx, '#ffffff', lx - 1, 28, 3, 2);
    // powder kegs stacked at the left, crates and a keg at the right
    barrel(ctx, 14, fy, 16, 20, { mark: '#e0463c', fuse: true });
    barrel(ctx, 32, fy, 14, 18, { mark: '#e0463c' });
    barrel(ctx, 22, fy - 20, 14, 16, { mark: '#e0463c', fuse: true });
    crate(ctx, 124, fy, 20, 16);
    crate(ctx, 128, fy - 16, 14, 12);
    barrel(ctx, 154, fy, 12, 16, { mark: '#e0463c' });
    // the workbench on the right
    fill(ctx, INK, 248, fy - 24, 72, 5);
    fill(ctx, '#8e5a2e', 249, fy - 23, 70, 3);
    fill(ctx, '#d09a5e', 249, fy - 23, 70, 1);
    fill(ctx, '#5e3618', 252, fy - 20, 3, 20);
    fill(ctx, '#5e3618', 312, fy - 20, 3, 20);
    barrel(ctx, 270, fy - 24, 9, 10, { mark: '#e0463c', fuse: true });
    fill(ctx, '#7c86a6', 290, fy - 27, 12, 3);
  },
  floor(ctx, w, sp, r) {
    perspFloor(ctx, w, sp.floorY, H, 84, { tones: ['#5e4428', '#563e24', '#4e3820', '#664a2c'], seam: '#2a1a0e', lip: '#8e6a40', r, tile: 10, rowH: 40, grow: 1, stagger: false });
    // scorch marks
    for (const [x, y, s] of [
      [40, 132, 8],
      [170, 126, 6],
      [236, 140, 10],
    ] as const) {
      oval(ctx, '#2a1a10', x, y, s, s * 0.3, 0.7);
      oval(ctx, '#1a100a', x, y, s * 0.5, s * 0.15, 0.8);
    }
    glowAt(ctx, '#ffc860', 84, sp.floorY + 14, 56, 0.45, 0.3);
  },
};

/** The style stages' painters, by motif (art-ui-stage.ts paints the sky, then `back`, the floor bands, then `floor`). */
export const STYLE_PAINTERS: Record<string, StylePainter> = { yard: castle, rooftops: roofs, gatehouse: gate, dusk: pines, quarry: cliffs, icecave: crystals, glowgrove: grove, sapper: workshop };
