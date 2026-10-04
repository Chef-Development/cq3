// Pixel art for the app icon (original art, see docs/art-style.md): a close-up bust of Rowan (red plume,
// glowing eyes in the visor) with his sword raised behind him and the gold-and-red "3" shield badge.
// Drawn on a small grid (36x36 design area) that make-icons.mjs scales by an integer factor. The grid
// extends `M` px past the design area on every side so the shapes that run past it (plume tail, shoulders,
// body) still fill the icons' wider views.
// Light comes from the top left; ramps are the shared ones from the style guide; 1px ink outlines.

export const D = 36; // design area (180 px icon = 5x)
export const INK = '#140c1c';

const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];
const RED = ['#4a0f1a', '#8a1a22', '#d03030', '#f05a48', '#ff9a80'];
const BLUE = ['#10204a', '#1a3c8a', '#2a6ad8', '#4aa0f0', '#9ad8ff'];
const VISOR = '#1c1430';
const RIM = '#ffe8a0'; // warm rim light from the glow behind his head

// ------------------------------------------------------------------ grid toolkit

const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));

/** A layer: a (D + 2M) square grid drawn in design coordinates (the design area starts at M, M). */
function layer(M) {
  const n = D + 2 * M;
  const g = grid(n, n);
  const put = (x, y, c) => {
    x = Math.round(x) + M;
    y = Math.round(y) + M;
    if (y >= 0 && y < n && x >= 0 && x < n) g[y][x] = c;
  };
  /** Fill the pixels `inside` reports with the shader's colour. */
  const fill = (inside, shade) => {
    for (let y = -M; y < D + M; y++)
      for (let x = -M; x < D + M; x++) {
        if (!inside(x, y)) continue;
        const c = shade(x, y);
        if (c) put(x, y, c);
      }
  };
  const stamp = (rows, pal, ox, oy) =>
    rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && ch !== ' ' && put(ox + x, oy + y, pal[ch] ?? '#ff00ff')));
  return { g, M, n, put, fill, stamp };
}

const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.46];
  const n = Math.hypot(...v);
  return v.map((c) => c / n);
})();

/** Lambert light (0..1) on a sphere at normalised position (nx, ny). */
function lambert(nx, ny) {
  const r2 = nx * nx + ny * ny;
  const s = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
  const nz = Math.sqrt(Math.max(0, 1 - r2));
  return Math.max(0, nx * s * LIGHT[0] + ny * s * LIGHT[1] + nz * LIGHT[2]);
}
const tone = (r, v) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length)))];
const sphere = (r, cx, cy, rx, ry, bias = 0, amb = 0.1) => (x, y) => tone(r, amb + 0.95 * lambert((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry) + bias);
const ell = (cx, cy, rx, ry) => (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const or = (...f) => (x, y) => f.some((k) => k(x, y));
const and = (...f) => (x, y) => f.every((k) => k(x, y));
const not = (f) => (x, y) => !f(x, y);

/** Darken the pixels on a form's lower-right edge. */
function rimShade(L, inside, dark) {
  const out = [];
  for (let y = -L.M; y < D + L.M; y++)
    for (let x = -L.M; x < D + L.M; x++) if (inside(x, y) && !inside(x + 1, y + 1) && !inside(x, y + 1)) out.push([x, y]);
  for (const [x, y] of out) L.put(x, y, dark);
}

/** Points along a cubic Bezier. */
function bez(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]));
  }
  return out;
}

// ------------------------------------------------------------------ the parts

const LAYOUT = {
  helm: [14, 17.5], // dome centre
  badge: [23, 20], // top-left of the 12x15 "3" shield
  tip: [32, 3], // sword tip
};

/** Rowan's sword behind him: a broad blade at a clean 45 degree slope with a pointed tip near the top right. */
function drawSword(L) {
  const [tx, ty] = LAYOUT.tip;
  const k = tx + ty; // blade axis: x + y = k
  // 5 px wide across the axis: lit edge, light, core sheen, shade, dark edge; it starts behind the helmet
  for (let x = 11; x <= tx; x++) {
    const y = k - x;
    const left = tx - x; // steps from the tip
    if (left >= 2) {
      L.put(x - 1, y - 1, STEEL[4]);
      L.put(x, y - 1, STEEL[4]);
      L.put(x + 1, y + 1, '#8a94b4');
      L.put(x + 1, y, '#8a94b4');
    }
    if (left >= 1) {
      L.put(x - 1, y, '#ffffff');
      L.put(x, y + 1, '#9ad8ff');
    }
    L.put(x, y, left === 0 ? '#ffffff' : '#c8ecff');
  }
}

/** The plume: a thick arc of feathers rising from the crest and streaming back, shaded across its width. */
function drawPlume(L) {
  const [hx, hy] = LAYOUT.helm;
  const S = 64;
  const spine = bez([hx + 1, hy - 9], [hx - 2, hy - 15], [hx - 13.5, hy - 14.5], [hx - 15.5, hy + 1], S);
  const FEATHERS = 3;
  const width = (t) => 4.5 - t * 2.1;
  for (let y = -L.M; y < D; y++)
    for (let x = -L.M; x < D; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let best = 0;
      let bd = Infinity;
      spine.forEach(([sx, sy], i) => {
        const d = (px - sx) ** 2 + (py - sy) ** 2;
        if (d < bd) [bd, best] = [d, i];
      });
      const t = best / S;
      const r = width(t);
      if (Math.sqrt(bd) > r) continue;
      const [ax, ay] = spine[Math.max(0, best - 1)];
      const [bx, by] = spine[Math.min(S, best + 1)];
      const tl = Math.hypot(bx - ax, by - ay);
      const [tx, ty] = [(bx - ax) / tl, (by - ay) / tl];
      const q = ((px - spine[best][0]) * -ty + (py - spine[best][1]) * tx) / r; // +1 outer edge, -1 inner edge
      const f = (t * FEATHERS) % 1; // position within a feather; its tip trails back
      if (q < -(0.35 + 0.65 * f)) continue; // scalloped inner edge
      let c = q > 0.5 ? RED[3] : q > -0.15 ? RED[2] : RED[1];
      if (q > 0.72 && t < 0.75) c = RED[4];
      if (f < 0.1 && q < 0.2 && t > 0.15) c = RED[1]; // feather partings
      L.put(x, y, c);
    }
}

function drawBody(L) {
  const [hx] = LAYOUT.helm;
  const tabard = ell(hx + 3, 41, 15, 11);
  const lit = sphere(BLUE, hx - 1, 35, 20, 13, 0.08);
  L.fill(tabard, (x, y) => (x < hx - 4 || x > hx + 10 ? BLUE[1] : lit(x, y))); // sides in the pauldrons' shadow
  L.fill(and(tabard, (x) => x === hx - 4 || x === hx - 3), (x) => (x === hx - 4 ? GOLD[3] : GOLD[2]));
  L.fill(and(tabard, (x) => x === hx + 9 || x === hx + 10), (x) => (x === hx + 9 ? GOLD[2] : GOLD[1]));
  const gorget = and(ell(hx + 3.5, 29.5, 8.5, 3.8), (_x, y) => y >= 27);
  L.fill(gorget, (x, y) => (y === 29 ? STEEL[1] : sphere(STEEL, hx + 1, 27, 9, 4, 0.1)(x, y)));
  for (const [cx, rx] of [
    [hx - 11, 7.5],
    [hx + 17, 7],
  ]) {
    const pad = ell(cx, 35, rx, 5.8);
    L.fill(pad, sphere(STEEL, cx - 2, 33, rx + 1, 6.5, 0.1));
    L.fill(and(pad, not(ell(cx, 35.8, rx, 5.8))), (x) => (x < cx ? GOLD[4] : GOLD[3])); // gold trim on top
  }
}

function drawHelm(L) {
  const [hx, hy] = LAYOUT.helm;
  // a rounded dome with a jutting face plate (faces right), kept bright so it reads small
  const dome = ell(hx, hy, 9.5, 10);
  const plate = ell(hx + 4, hy + 4, 7, 6);
  const helm = or(dome, plate);
  L.fill(helm, (x, y) => tone(STEEL, 0.42 + 0.72 * lambert((x + 0.5 - hx + 1.5) / 12, (y + 0.5 - hy + 2.5) / 13)));
  // form shadow: a band of the mid-dark tone along the lower right, then the dark rim
  for (let y = -L.M; y < D + L.M; y++)
    for (let x = -L.M; x < D + L.M; x++)
      if (helm(x, y) && (!helm(x + 2, y + 2) || !helm(x, y + 2)) && x + y > hx + hy + 2) L.put(x, y, STEEL[1]);
  rimShade(L, helm, STEEL[0]);
  // rim light from the glow behind him, along the upper right of the dome
  for (let y = hy - 9; y < hy + 2; y++)
    for (let x = hx; x < hx + 12; x++) if (helm(x, y) && !helm(x + 1, y)) L.put(x, y, RIM);
  // specular highlight on the dome (kept inside the silhouette)
  ['..WW', '.WWS', 'WWS.', 'WS..'].forEach((r, j) =>
    [...r].forEach((ch, i) => {
      const [x, y] = [hx - 7 + i, Math.round(hy - 8) + j];
      if (ch !== '.' && helm(x, y)) L.put(x, y, ch === 'W' ? '#ffffff' : STEEL[4]);
    }),
  );
  // gold brow band wrapping round the dome, a crest knob on top
  const band = (x) => Math.round(hy - 5.5 + ((x - hx - 3) / 11) ** 2 * 2.2);
  for (let x = hx - 11; x < hx + 12; x++) {
    const yb = band(x);
    if (!helm(x, yb)) continue;
    const v = 0.98 - ((x - hx + 9) / 22) * 0.6;
    L.put(x, yb, tone(GOLD, v));
    L.put(x, yb + 1, tone(GOLD, v - 0.3));
  }
  L.stamp(['GGg', 'gyY'], { G: GOLD[4], g: GOLD[3], y: GOLD[2], Y: GOLD[1] }, hx, hy - 11);
  // visor slit across the face with glowing eyes (the near eye larger)
  for (let x = hx - 1; x < hx + 12; x++) {
    const yb = band(x) + 3;
    if (!helm(x, yb + 2)) continue;
    if (x === hx - 1) {
      L.put(x, yb + 1, VISOR);
      continue;
    }
    for (let k = 0; k < 3; k++) L.put(x, yb + k, VISOR);
    L.put(x, yb - 1, STEEL[1]);
    if (helm(x, yb + 3)) L.put(x, yb + 3, STEEL[4]);
  }
  const eye = { e: '#4ad8ff', E: '#e0fcff', c: '#1e6a8a', W: '#ffffff' };
  const ey = band(hx + 3) + 3;
  L.stamp(['cEEc', 'eWEe', 'ceec'], eye, hx + 2, ey);
  L.stamp(['cEc', 'eEe', 'cec'], eye, hx + 8, ey);
  // breathing slits on the face plate (a lit lip under each)
  for (const dx of [4, 6, 8]) {
    L.put(hx + dx, hy + 5, STEEL[1]);
    L.put(hx + dx, hy + 6, STEEL[1]);
    L.put(hx + dx, hy + 7, STEEL[3]);
  }
  // seam where the face plate meets the cheek, under the visor (3/4 view)
  for (let y = band(hx) + 6; y < hy + 10; y++)
    if (helm(hx - 1, y + 1)) {
      L.put(hx - 1, y, STEEL[1]);
      L.put(hx, y, STEEL[3]);
    }
}

// "3" shield badge: 12x15, gold rim lit from the top left, red field, chunky steel "3" with a dark-red keyline.
const THREE = ['#####.', '######', '....##', '.####.', '.####.', '....##', '######', '#####.'];

function drawBadge(L) {
  const [bx, by] = LAYOUT.badge;
  const W = 12;
  const H = 15;
  const inShield = (x, y, inset) => {
    const u = x - bx;
    const v = y - by;
    if (v < inset || v >= H - inset) return false;
    const t = (v + 0.5) / H;
    const half = (W / 2) * (t < 0.5 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2))) - inset;
    return Math.abs(u + 0.5 - W / 2) <= half;
  };
  for (let y = by; y < by + H; y++)
    for (let x = bx; x < bx + W; x++) {
      if (!inShield(x, y, 0)) continue;
      const u = (x - bx) / W;
      const v = (y - by) / H;
      if (!inShield(x, y, 1)) L.put(x, y, u + v * 0.4 < 0.45 ? GOLD[4] : u + v * 0.4 < 0.85 ? GOLD[3] : GOLD[1]);
      else L.put(x, y, u + v * 0.5 < 0.55 ? '#e8443a' : u + v * 0.5 < 0.95 ? '#c8303a' : '#a01c28');
    }
  const tx = bx + 3;
  const ty = by + 2;
  const on = (x, y) => THREE[y - ty]?.[x - tx] === '#';
  for (let y = ty - 1; y <= ty + THREE.length; y++)
    for (let x = tx - 1; x <= tx + 6; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || on(x - 1, y - 1)) L.put(x, y, RED[0]);
    }
  THREE.forEach((row, yy) =>
    [...row].forEach((ch, xx) => {
      if (ch !== '#') return;
      const v = yy / (THREE.length - 1);
      L.put(tx + xx, ty + yy, v < 0.2 ? '#ffffff' : v < 0.55 ? '#e4eaf4' : v < 0.8 ? STEEL[3] : '#8a94b0');
    }),
  );
}

// ------------------------------------------------------------------ compose

/** Paint a layer over `dst` (same size) with a 1px ink outline around its filled pixels. */
function over(dst, L) {
  const { g, n } = L;
  const filled = (x, y) => y >= 0 && y < n && x >= 0 && x < n && g[y][x] !== null;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (filled(x, y)) dst[y][x] = g[y][x];
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) dst[y][x] = INK;
    }
}

/** The icon art: a (D + 2M) square grid of '#rrggbb' or null (background), design area at offset M. */
export function iconArt(M = 16) {
  const n = D + 2 * M;
  const out = grid(n, n);
  const sword = layer(M);
  drawSword(sword);
  over(out, sword);
  const hero = layer(M);
  drawPlume(hero);
  drawBody(hero);
  drawHelm(hero);
  over(out, hero);
  const badge = layer(M);
  drawBadge(badge);
  over(out, badge);
  return out;
}
