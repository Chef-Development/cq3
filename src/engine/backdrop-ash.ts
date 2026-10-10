// Ashfell's fight backdrops, painted with backdrop.ts's toolkit (see there and docs/art-style.md): the Cinder Flats
// (ash plains under a smoky orange sky: the volcano smoking on the horizon, hexagonal basalt columns, charred trees, a
// lava river crossed by basalt slabs, smoking vents, the road-roller's half-paved road), the Glass Warrens (tunnels of
// black obsidian, panes of coloured volcanic glass glowing with the lava behind them, glass stalactites, a chain bridge
// over a magma lake, an old glassblowers' kiln) and the Black Forge (the basalt citadel on the crater's rim: lava
// falls, chains as thick as trees slung across the crater, giant anvils, the furnace roaring at its heart). Same
// contract as backdrop.ts (`bg_`, `frame_`, `fg_`/`fgo_` per sway frame); painted the first time an act needs one
// (Stage.ensure), never at boot.
import type Phaser from 'phaser';
import {
  backlight,
  bay,
  blade,
  changed,
  clamp01,
  col,
  cornerness,
  fade,
  fbm,
  FG_FRAMES,
  FG_OVERLAP,
  hash,
  haze,
  lambert,
  lighten,
  mass,
  mix,
  noise,
  pebble,
  pick,
  Pix,
  ramp,
  rng,
  SWAY,
  torchLight,
  understory,
  type Backdrop,
  type Blob,
  type Col,
  type FgLook,
  type Ramp,
  type Theme,
} from './backdrop';
import { cluster } from './backdrop-ice';

export type AshTheme = 'cinder' | 'glass' | 'forge';
export const ASH_BACKDROP_THEMES: AshTheme[] = ['cinder', 'glass', 'forge'];
export const isAsh = (t: Theme): t is AshTheme => t === 'cinder' || t === 'glass' || t === 'forge';

// ------------------------------------------------------------------ shared ramps (dark -> light, hue-shifted)

/** Ash: plum-grey in shadow, a warm dusty grey in the light. */
const ASH = ramp('#1e181c', '#2c2428', '#3a3034', '#4a3e40', '#5c4e4e', '#706060', '#887674', '#a28e88');
/** Basalt: cold violet-black shadows, warm grey caps. */
const BASALT = ramp('#0e0c12', '#18151e', '#24202a', '#322c36', '#423a44', '#564c54', '#6e6268', '#8a7c80');
/** Lava: crust red through orange to a white-hot core. */
const LAVA = ramp('#5a0e0e', '#8a1c12', '#c03a14', '#e8601a', '#ff8a24', '#ffb840', '#ffe080', '#fff8d0');
/** Charred wood. */
const CHAR = ramp('#0a0608', '#16100e', '#241812', '#342418', '#46301e');
const INK = col('#140c1c');

// ------------------------------------------------------------------ painters

/** A long band of smoke, dark on top and lit from below by the fire (`under` 0..1: how hot the glow under it). */
function smokeBand(p: Pix, x0: number, y0: number, len: number, thick: number, r: Ramp, seed: number, under: (x: number) => number): void {
  const r2 = rng(seed);
  const bl: Blob[] = [];
  const n = Math.max(3, Math.round(len / 7));
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const t = Math.sin(f * Math.PI);
    bl.push({ x: x0 + f * len + (r2() - 0.5) * 5, y: y0 - t * thick * 0.5 + (r2() - 0.5) * 1.6, rx: 5 + t * len * 0.13, ry: 1.4 + t * thick * (0.55 + r2() * 0.4) });
  }
  const inside = (x: number, y: number) => bl.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1 + (noise(x * 0.2, y * 0.5, seed) - 0.5) * 0.8);
  for (let y = Math.floor(y0 - thick * 2); y <= y0 + thick + 2; y++)
    for (let x = Math.floor(x0 - 12); x <= x0 + len + 12; x++) {
      if (!inside(x, y)) continue;
      let below = 0;
      while (below < 4 && inside(x, y + below + 1)) below++;
      let above = 0;
      while (above < 3 && inside(x, y - above - 1)) above++;
      // the underside glows with the fire below; the top is in the smoke's own shade, a dull rim of sky light
      const glow = below === 0 ? 0.55 : below === 1 ? 0.35 : below === 2 ? 0.15 : 0;
      const v = 0.12 + glow * under(x) + (above === 0 ? 0.12 : 0) + (noise(x * 0.3, y * 0.3, seed + 1) - 0.5) * 0.14;
      p.set(x, y, pick(r, v, x, y, 0.25));
    }
}

/**
 * Hexagonal basalt columns standing side by side ([x, top, width][]): a pale six-sided cap, the face toward the light
 * lit, the other in shade, cooling joints across each column, a dark seam between neighbours.
 */
function basaltColumns(p: Pix, cols: Array<[number, number, number]>, base: number, r: Ramp, seed: number, capLight = 0.86): void {
  for (const [x0, top, w] of cols.slice().sort((a, b) => a[1] - b[1])) {
    const capH = Math.max(2, Math.round(w * 0.35));
    for (let y = top; y <= base; y++)
      for (let x = x0; x < x0 + w; x++) {
        const u = (x - x0) / Math.max(1, w - 1);
        const k = y - top;
        let v: number;
        if (k < capH) {
          // the hexagonal cap: corners trimmed, lit, its far edge darker
          const trim = k === 0 ? 1 : 0;
          if (x < x0 + trim || x > x0 + w - 1 - trim) continue;
          v = capLight - (k === capH - 1 ? 0.18 : 0) - u * 0.12;
        } else {
          v = u < 0.42 ? 0.56 : u < 0.86 ? 0.36 : 0.2;
          if ((k + Math.floor(hash(x0, 1, seed) * 6)) % 7 === 0) v -= 0.14; // a cooling joint
          v += (noise(x * 0.5, y * 0.2, seed + x0) - 0.5) * 0.14;
        }
        if (x === x0 + w - 1 && k >= capH) v = 0.04; // the seam
        p.set(x, y, pick(r, v, x, y, 0.15));
      }
  }
}

/** A charred dead tree: a black trunk forking into bare branches, embers glowing in the cracks of the bark. */
function charredTree(p: Pix, x: number, base: number, hgt: number, seed: number, r: Ramp, embers: Array<[number, number]>): void {
  const rnd = rng(seed);
  const branch = (bx: number, by: number, ang: number, len: number, th: number, depth: number) => {
    let cx = bx;
    let cy = by;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const w = Math.max(1, th * (1 - t * 0.6));
      for (let d = -Math.floor(w / 2); d <= Math.floor((w - 1) / 2); d++) {
        const px = Math.round(cx + d * Math.cos(ang + Math.PI / 2));
        const py = Math.round(cy + d * Math.sin(ang + Math.PI / 2));
        const lit = d < 0 || (w < 2 && Math.cos(ang) < 0);
        p.set(px, py, pick(r, (lit ? 0.62 : 0.28) + (noise(px * 0.8, py * 0.3, seed) - 0.5) * 0.3, px, py));
      }
      if (th >= 2.5 && hash(Math.round(cx), Math.round(cy), seed) > 0.93) embers.push([Math.round(cx), Math.round(cy)]);
      cx += Math.cos(ang);
      cy += Math.sin(ang);
      ang += (rnd() - 0.5) * 0.18;
      if (depth > 0 && i > len * 0.35 && rnd() < 0.09) branch(cx, cy, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), len * (0.35 + rnd() * 0.3), th * 0.55, depth - 1);
    }
    if (depth > 0) {
      branch(cx, cy, ang - 0.45 - rnd() * 0.3, len * 0.5, th * 0.6, depth - 1);
      branch(cx, cy, ang + 0.4 + rnd() * 0.3, len * 0.45, th * 0.55, depth - 1);
    }
  };
  branch(x, base, -Math.PI / 2 + (rnd() - 0.5) * 0.2, hgt * 0.55, Math.max(2, hgt / 7), 2);
  // a root flare
  for (let i = -2; i <= 2; i++) p.set(x + i, base, r[1]);
}

/**
 * A molten river winding across between y0 and y1 (its middle line wobbling): a white-hot current under drifting
 * plates of black crust, the banks lit by it (returns the river's middle line per column).
 */
function lavaRiver(p: Pix, w: number, yMid: (x: number) => number, half: (x: number) => number, seed: number, glowTo: Col, reach: number): number[] {
  const mid: number[] = [];
  for (let x = 0; x < w; x++) {
    const m = yMid(x);
    const hw = half(x);
    mid.push(m);
    for (let y = Math.floor(m - hw - reach); y <= m + hw + reach; y++) {
      const d = Math.abs(y + 0.5 - m) / hw;
      if (d <= 1) {
        // crust plates drifting on the current, hot seams between them
        const plate = noise(x * 0.18 - y * 0.05, y * 0.5, seed);
        const seam = Math.abs(noise(x * 0.22, y * 0.4, seed + 3) - 0.5) < 0.05;
        let v = 0.9 - d * 0.5 + (noise(x * 0.5, y * 0.9, seed + 1) - 0.5) * 0.25;
        if (plate > 0.62 && !seam && d < 0.9) v = 0.06 + (plate - 0.62) * 0.4;
        if (d > 0.82) v = Math.min(v, 0.45); // the cooler edge
        p.set(x, y, pick(LAVA, v, x, y, 0.2));
      } else {
        // the banks lit by the glow
        const k = Math.pow(1 - (Math.abs(y + 0.5 - m) - hw) / reach, 2);
        if (k > 0) p.tint(x, y, (c) => fade(c, glowTo, k * 0.55, x, y, 3, 0.6));
      }
    }
  }
  return mid;
}

/** Basalt paving stones: hexagons in staggered rows, their tops lit, dark seams between (the road-roller's road). */
function hexPaving(p: Pix, x0: number, x1: number, y0: number, y1: number, r: Ramp, seed: number, edge: (y: number) => number, calm?: [number, number]): void {
  const cw = 7;
  const ch = 4;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (x < edge(y)) continue;
      const row = Math.floor((y - y0) / ch);
      const off = row % 2 ? Math.floor(cw / 2) : 0;
      const cx = Math.floor((x + off) / cw);
      const fx = (x + off) % cw;
      const fy = (y - y0) % ch;
      const seam = fx === 0 || fy === 0 || (fy === 1 && (fx === 1 || fx === cw - 1));
      const shade = hash(cx, row, seed);
      let v = seam ? 0.08 : 0.42 + shade * 0.22 + (fy === 1 ? 0.14 : fy === ch - 1 ? -0.1 : 0) - (fx === cw - 1 ? 0.1 : 0);
      // (where the fighters stand the seams soften: the ground under the feet stays calm, docs/art-style.md section 8)
      if (calm && y >= calm[0] && y <= calm[1]) v = seam ? 0.3 : 0.4 + shade * 0.08;
      v += (noise(x * 0.4, y * 0.4, seed) - 0.5) * 0.1;
      p.set(x, y, pick(r, v, x, y, 0.15));
    }
}

/** A great chain slung from (ax, ay) to (bx, by), sagging `sag`: links `s` px long, iron lit on top, `heat` a glow. */
function bigChain(p: Pix, ax: number, ay: number, bx: number, by: number, sag: number, s: number, r: Ramp, heat: number, seed: number): void {
  const L = Math.hypot(bx - ax, by - ay);
  const n = Math.max(2, Math.round(L / (s * 0.8)));
  const at = (t: number): [number, number] => [ax + (bx - ax) * t, ay + (by - ay) * t + Math.sin(t * Math.PI) * sag];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = at(t);
    const [x2, y2] = at(Math.min(1, t + 0.01));
    const a = Math.atan2(y2 - y, x2 - x);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const face = i % 2 === 0;
    const rx = s * 0.55;
    const ry = face ? s * 0.38 : s * 0.14;
    const R = Math.ceil(rx + 1);
    for (let yy = Math.floor(y - R); yy <= y + R; yy++)
      for (let xx = Math.floor(x - R); xx <= x + R; xx++) {
        const dx = xx + 0.5 - x;
        const dy = yy + 0.5 - y;
        const u = (dx * ux + dy * uy) / rx;
        const v = (-dx * uy + dy * ux) / ry;
        const d = u * u + v * v;
        if (d > 1) continue;
        // a face-on link is a ring (its eye shows the sky through it), an edge-on one a bar
        if (face && d < 0.3 && s >= 5) continue;
        const lit = -v * 0.6 - u * 0.2;
        let val = 0.42 + lit * 0.4 + (noise(xx * 0.5, yy * 0.5, seed) - 0.5) * 0.12;
        if (d > 0.75) val -= 0.18;
        let c = pick(r, val, xx, yy, 0.2);
        if (heat > 0 && v > 0.1) c = mix(c, LAVA[4], clamp01(heat * (0.4 + v * 0.5)));
        p.set(xx, yy, c);
      }
  }
}

/** A dithered glow pooled round a point (the scene adds its flicker on top). */
const glowAt = (p: Pix, x: number, y: number, rx: number, ry: number, c: Col, k: number) => torchLight(p, x, y, rx, ry, c, k);

/** A flat-topped volcano far off: a dark cone, its crater glowing, lava trickling down its flanks in a few meandering
 *  threads. */
function volcano(p: Pix, cx: number, top: number, base: number, halfTop: number, slope: number, r: Ramp, seed: number): void {
  const halfAt = (y: number) => halfTop + (y - top) / slope + (noise(y * 0.2, 1, seed) - 0.5) * 2;
  for (let y = top; y <= base; y++) {
    const t = (y - top) / (base - top);
    const half = halfAt(y);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const u = (x + 0.5 - cx) / half;
      let v = 0.4 - u * 0.25 + (noise(x * 0.25, y * 0.1, seed) - 0.5) * 0.25 - t * 0.12;
      // ridges running down the flanks
      if (noise((x - cx) * 0.4 + y * 0.12, y * 0.04, seed + 2) > 0.66) v -= 0.14;
      p.set(x, y, pick(r, v, x, y, 0.2));
    }
  }
  // threads of lava wandering down from the rim, cooling (dimmer) as they go
  for (let k = 0; k < 4; k++) {
    let x = cx + (k - 1.5) * halfTop * 0.55;
    const len = (base - top) * (0.45 + hash(k, 2, seed) * 0.4);
    for (let y = top + 1; y < top + len; y++) {
      const t = (y - top) / len;
      x += (noise(y * 0.18, k, seed + 5) - 0.5) * 1.4 + ((x - cx) / halfAt(y)) * 0.35;
      p.set(Math.round(x), y, t < 0.3 ? LAVA[6] : t < 0.6 ? LAVA[4] : LAVA[2]);
      if (t < 0.4) p.set(Math.round(x) + 1, y, LAVA[3]);
    }
  }
  // the crater's glowing lip
  for (let x = Math.floor(cx - halfTop); x <= cx + halfTop; x++) {
    p.set(x, top, LAVA[6]);
    p.set(x, top + 1, LAVA[4]);
  }
}
// ------------------------------------------------------------------ the Cinder Flats

const SKY_CINDER = ramp('#1e1218', '#2c161c', '#3e1c20', '#562424', '#702c24', '#8e3a24', '#ae4c26', '#cc642c', '#e48236', '#f4a24a', '#fcc46a');
const SMOKE = ramp('#140e12', '#22161a', '#30201e', '#422a24', '#5a3628', '#7a462a', '#a05c2e', '#c8783a');

function cinder(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(613);
  const hz = col('#a85a3a');
  const vx = Math.round(w * 0.63); // the volcano
  const glowSky = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - vx) * 0.32, (y - (G - 40)) * 0.9) / 70) ** 1.4;
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const embers: Array<[number, number]> = [];

  // a smoky sky: plum-black overhead, burning orange low down where the volcano and the river light the smoke
  const skyBot = G - 14;
  for (let y = 0; y < skyBot; y++)
    for (let x = 0; x < w; x++) {
      const v = (y / (G - 22)) * 0.72 + glowSky(x, y) * 0.32 + (fbm(x * 0.02, y * 0.06, 7) - 0.5) * 0.16;
      p.set(x, y, pick(SKY_CINDER, v, x, y, 0.35));
    }
  // the volcano on the horizon, its plume of ash rolling off to the east
  const plume: Blob[] = [];
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    plume.push({ x: vx - t * 46 + Math.sin(t * 5) * 3, y: G - 66 - t * 20 + t * t * 6, rx: 4 + t * 10, ry: 3 + t * 5 });
  }
  mass(p, plume, { ramp: haze(SMOKE, col('#2a1418'), 0.2), seed: 41, bump: 0.22, tex: 0.25, vgrad: -0.35, light: -0.02, shadow: 0.18, band: 0.4 });
  const farR = haze(ramp('#0e080c', '#160c12', '#1e1016', '#28141a', '#341a1e'), hz, 0.18);
  volcano(p, vx, G - 62, G - 24, 8, 0.62, farR, 31);
  // the plume's foot lit by the crater
  glowAt(p, vx + 0.5, G - 63, 14, 7, col('#ff7a2a'), 0.5);
  // bands of smoke across the sky, their bellies lit orange from below
  for (const [fx, fy, len, th] of [
    [-0.06, 10, 110, 5],
    [0.3, 20, 70, 3.4],
    [0.74, 8, 100, 4.4],
    [0.12, 32, 60, 2.6],
    [0.86, 30, 56, 3],
  ])
    smokeBand(p, Math.round(fx * w), fy, len, th, SMOKE, Math.round(fx * 100 + fy), (x) => 0.7 + glowSky(x, G - 40) * 0.9);

  // far ridges in the haze, black against the glow
  for (let x = 0; x < w; x++) {
    const top = Math.round(G - 30 - fbm(x * 0.025, 1, 51) * 10 - Math.max(0, 1 - Math.abs(x - vx) / 90) * 4);
    for (let y = top; y < G - 18; y++) {
      const t = (y - top) / 12;
      p.set(x, y, pick(haze(BASALT, hz, 0.42 - t * 0.12), 0.28 + (y === top ? 0.2 : 0) - t * 0.1 + (noise(x * 0.2, y * 0.3, 53) - 0.5) * 0.15, x, y, 0.2));
    }
  }
  // the plain stretching off, ash grey going hazy toward the ridges
  for (let y = G - 21; y < G - 10; y++)
    for (let x = 0; x < w; x++) {
      if (y < G - 18 && p.get(x, y) !== -1 && noise(x * 0.1, y, 3) < 0.5) continue;
      const t = (y - (G - 21)) / 11;
      p.set(x, y, pick(haze(ASH, hz, 0.35 - t * 0.25), 0.36 + t * 0.12 + (fbm(x * 0.05, y * 0.3, 57) - 0.5) * 0.3, x, y, 0.3));
    }
  // basalt columns standing in clusters on the plain, hazy, the volcano's glow on their caps
  const midBasalt = haze(BASALT, hz, 0.22);
  basaltColumns(p, [[16, G - 40, 6], [21, G - 46, 7], [27, G - 38, 6], [32, G - 33, 5], [10, G - 30, 5]], G - 17, midBasalt, 61, 0.8);
  basaltColumns(p, [[226, G - 36, 5], [230, G - 42, 6], [235, G - 47, 7], [241, G - 39, 6], [246, G - 31, 5]], G - 17, midBasalt, 67, 0.8);
  basaltColumns(p, [[150, G - 27, 4], [154, G - 30, 5], [158, G - 25, 4]], G - 17, haze(BASALT, hz, 0.32), 69, 0.78);
  // charred trees, dead and black, an ember here and there still smouldering in the bark
  const treeR = haze(CHAR, hz, 0.12);
  for (const [fx, hgt, seed] of [
    [0.29, 26, 71],
    [0.42, 18, 73],
    [0.86, 24, 77],
  ] as const) {
    charredTree(p, Math.round(fx * w), G - 17, hgt, seed, treeR, embers);
  }
  // a smouldering stump burning low on the far bank
  const stumpX = Math.round(w * 0.36);
  for (let y = G - 21; y <= G - 17; y++)
    for (let x = stumpX - 2; x <= stumpX + 2; x++) p.set(x, y, pick(treeR, x < stumpX ? 0.6 : 0.25, x, y));
  torches.push({ x: stumpX, y: G - 21 });
  glowAt(p, stumpX + 0.5, G - 19, 12, 5, col('#ff8a3a'), 0.25);

  // the lava river winding behind the arena, basalt slabs laid across it for a crossing
  const riverMid = (x: number) => G - 14 + Math.sin(x * 0.021 + 1.2) * 1.6 + Math.sin(x * 0.07) * 0.6;
  const riverHalf = (x: number) => 2.1 + Math.sin(x * 0.033 + 2) * 0.6;
  lavaRiver(p, w, riverMid, riverHalf, 81, col('#ff9a4a'), 5);
  const slabX = Math.round(w * 0.55);
  for (let i = 0; i < 3; i++) {
    const sx = slabX + i * 6;
    const sy = Math.round(riverMid(sx)) - 1;
    for (let y = sy - 1; y <= sy + 2; y++)
      for (let x = sx - 2; x <= sx + 2; x++) {
        if ((x === sx - 2 || x === sx + 2) && (y === sy - 1 || y === sy + 2)) continue;
        p.set(x, y, pick(BASALT, y === sy - 1 ? 0.8 : x < sx ? 0.5 : 0.3, x, y));
      }
  }
  // smoking vents on the plain (the stage puffs their smoke)
  const vents: Array<{ x: number; y: number }> = [];
  for (const fx of [0.13, 0.47, 0.78]) {
    const x = Math.round(fx * w);
    const y = Math.round(riverMid(x)) - 4;
    for (let yy = -2; yy <= 0; yy++)
      for (let xx = -3 - yy; xx <= 3 + yy; xx++) p.set(x + xx, y + yy, pick(ASH, yy === -2 ? 0.7 : xx < 0 ? 0.55 : 0.35, x + xx, y + yy));
    p.set(x, y - 2, LAVA[3]);
    p.set(x + 1, y - 2, LAVA[2]);
    vents.push({ x, y: y - 3 });
  }

  // the near ground: ash, trodden flat where the fighters stand; cinders strewn about
  const groundTop = G - 10;
  for (let y = groundTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - groundTop) / (h - groundTop);
      let v = 0.5 - t * 0.12 + (fbm(x * 0.05, y * 0.25, 91) - 0.5) * 0.28;
      if (y <= Math.round(riverMid(x)) + riverHalf(x) + 1) continue;
      if (Math.abs(noise(x * 0.09, y * 0.5, 93) - 0.5) < 0.03) v -= 0.12; // wind ripples
      p.set(x, y, pick(ASH, v, x, y, 0.25));
    }
  // the road-roller's road: basalt pavers laid from the right, ending ragged halfway, a stack waiting to be laid
  const roadEnd = Math.round(w * 0.5);
  const roadTop = G - 5;
  hexPaving(p, 0, w, roadTop, h, BASALT, 97, (y) => roadEnd + Math.round(noise(y * 0.4, 1, 97) * 10) - (y - roadTop) * 0.6, [G - 4, G + 3]);
  for (let i = 0; i < 4; i++) {
    const sx = roadEnd - 14 + (i % 2) * 2;
    const sy = roadTop - 2 - i * 2;
    for (let x = sx; x < sx + 6; x++) {
      p.set(x, sy, pick(BASALT, 0.78 - (x - sx) * 0.05, x, sy));
      p.set(x, sy + 1, pick(BASALT, 0.32, x, sy + 1));
    }
  }
  // cinders and grit, kept off the line the fighters stand on
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.35 ? G - 8 + Math.floor(rnd() * 2) : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    if (x > roadEnd && y >= roadTop) continue;
    pebble(p, x, y, 1, 0, BASALT, ASH[0]);
  }
  // a few embers glowing in the ash
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(rnd() * roadEnd);
    const y = G + 4 + Math.floor(rnd() * Math.max(1, h - G - 6));
    p.set(x, y, LAVA[4]);
    glints.push({ x, y, c: 0xffb040 });
  }
  // the edges in smoky shade
  const edgeShade = col('#140a10');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 36) p.tint(x, y, (c) => fade(c, edgeShade, ((36 - e) / 36) ** 1.6 * 0.6, x, y, 3, 0.5));
    }

  // framing: a great charred tree on the left reaching over the top, near basalt columns on the right
  const before = p.buf.slice();
  const frameChar = ramp('#060406', '#0e0a0c', '#181010', '#241814', '#34221a');
  const frameEmbers: Array<[number, number]> = [];
  for (let y = 0; y < G + 2; y++) {
    const half = 5 + Math.max(0, (y - (G - 20)) * 0.25) + Math.max(0, 14 - y) * 0.25;
    for (let x = 0; x <= 7 + half; x++) {
      const u = x / (7 + half);
      p.set(x, y, x === Math.floor(7 + half) ? INK : pick(frameChar, 0.6 - u * 0.45 + (noise(x * 0.6, y * 0.15, 303) - 0.5) * 0.3, x, y));
    }
  }
  // big bare limbs off the trunk, reaching right over the top of the scene, forking into twigs
  const limb = (x0: number, y0: number, ang: number, len: number, th: number, depth: number, seed: number) => {
    const r2 = rng(seed);
    let x = x0;
    let y = y0;
    let a = ang;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const wd = Math.max(1, th * (1 - t * 0.7));
      for (let d = 0; d < wd; d++) {
        const yy = Math.round(y + d);
        p.set(Math.round(x), yy, d === 0 ? pick(frameChar, 0.7, Math.round(x), yy) : d >= wd - 1 ? INK : pick(frameChar, 0.3, Math.round(x), yy));
      }
      if (wd >= 3 && hash(Math.round(x), Math.round(y), seed) > 0.95) frameEmbers.push([Math.round(x), Math.round(y) + 1]);
      x += Math.cos(a);
      y += Math.sin(a);
      a += (r2() - 0.5) * 0.25;
      if (depth > 0 && i > 4 && r2() < 0.12) limb(x, y, a + (r2() < 0.6 ? -0.7 : 0.6), len * (0.3 + r2() * 0.25), wd * 0.6, depth - 1, seed + i);
    }
  };
  limb(10, 14, -0.18, 70, 4, 2, 311);
  limb(9, 30, 0.12, 40, 3, 2, 313);
  limb(8, 4, -0.35, 30, 3, 1, 317);
  const nearBasalt = ramp('#06050a', '#0c0a10', '#141018', '#1c1822', '#26202c', '#342a36', '#46384a', '#5a4a5a');
  basaltColumns(p, [[w - 26, 18, 8], [w - 19, 4, 9], [w - 11, -2, 11], [w - 31, 34, 6]], G + 2, nearBasalt, 307, 0.75);
  const frame = changed(p, before);
  for (const [x, y] of frameEmbers) glints.push({ x, y, c: 0xff7a2a });
  for (const [x, y] of embers) glints.push({ x, y, c: 0xff9a3a });
  for (const [x, y] of [...embers, ...frameEmbers]) p.set(x, y, LAVA[4]);

  return [p, frame, { torches, glints, vents }];
}

// ------------------------------------------------------------------ the Glass Warrens

const OBSID = ramp('#06040a', '#0c0812', '#140e1c', '#1c1428', '#261c34', '#322642', '#443456', '#5c4870');
/** Coloured volcanic glass: amber, bottle green, violet, ruby; each lit from behind by the lava. */
const GLASS: Ramp[] = [
  ramp('#3a1a06', '#7a3a0a', '#c06a14', '#f0a030', '#ffd070', '#fff4c0'),
  ramp('#062a18', '#0e5430', '#1e8a48', '#46c06a', '#9ae89a', '#e4ffd8'),
  ramp('#1e0a3a', '#3e1a6e', '#6a32a8', '#9a5ad8', '#c89aff', '#f2e4ff'),
  ramp('#3a0612', '#6e1020', '#a82232', '#e04a4a', '#ff8a7a', '#ffd4c8'),
];

/** A tall pane of volcanic glass set in the rock, glowing from the lava behind it: brightest low down, veined. */
function glassWall(p: Pix, x0: number, y0: number, wd: number, ht: number, r: Ramp, seed: number, glints: NonNullable<Backdrop['glints']>, gc: number): void {
  for (let y = y0; y < y0 + ht; y++) {
    const t = (y - y0) / ht;
    const inset = Math.round((1 - Math.sin(Math.min(1, t * 3) * Math.PI * 0.5)) * wd * 0.35 + (noise(y * 0.3, 1, seed) - 0.5) * 2);
    for (let x = x0 + inset; x < x0 + wd - inset * 0.6; x++) {
      const u = (x - x0) / wd;
      let v = 0.25 + t * 0.55 + (noise(x * 0.3, y * 0.08, seed) - 0.5) * 0.35;
      // the lava's glow seen through it: a bright smear low in the middle
      v += Math.max(0, 1 - Math.hypot((u - 0.5) * 2.4, (t - 0.85) * 2.2)) * 0.35;
      // veins and flow lines frozen in the glass
      if (Math.abs(noise(x * 0.15, y * 0.05, seed + 3) - 0.5) < 0.04) v -= 0.25;
      if (x === x0 + inset) v += 0.2; // a lit edge
      p.set(x, y, pick(r, v, x, y, 0.25));
    }
    if (hash(y, 3, seed) > 0.86) glints.push({ x: x0 + inset + 1, y, c: gc });
  }
}

/** A stalactite of glass (or obsidian) hanging from the roof at x: a tapered spike, lit on its left, a glint at its tip. */
function stalactite(p: Pix, x: number, top: number, len: number, wid: number, r: Ramp, seed: number): [number, number] {
  for (let k = 0; k < len; k++) {
    const t = k / len;
    const half = (wid / 2) * (1 - t) ** 0.9;
    const cx = x + Math.sin(t * 2 + seed) * 0.6;
    for (let xx = Math.floor(cx - half); xx <= cx + half; xx++) {
      const u = (xx + 0.5 - cx) / Math.max(0.5, half);
      p.set(xx, top + k, pick(r, 0.55 - u * 0.35 + t * 0.25 + (noise(xx * 0.5, k * 0.3, seed) - 0.5) * 0.2, xx, top + k));
    }
  }
  return [Math.round(x), top + len];
}

/** A beehive kiln of old brick, its mouth glowing (returns the mouth's centre). */
function kiln(p: Pix, cx: number, base: number, rx: number, ry: number, seed: number): [number, number] {
  const brick = ramp('#1a0a0c', '#2e1210', '#461c16', '#62281c', '#7e3824', '#9a4a2e');
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1) continue;
      let v = 0.3 + 0.45 * lambert(dx, dy) + (hash(Math.floor((x + (Math.floor(y / 2) % 2) * 2) / 4), Math.floor(y / 2), seed) - 0.5) * 0.18;
      if (y % 2 === 0 || (x + (Math.floor(y / 2) % 2) * 2) % 4 === 0) v -= 0.16;
      p.set(x, y, pick(brick, v, x, y));
    }
  // the mouth: an arch glowing white-hot inside
  const mx = Math.round(cx - rx * 0.15);
  const my = base - 1;
  for (let y = my - 5; y <= my; y++)
    for (let x = mx - 3; x <= mx + 3; x++) {
      const d = Math.hypot((x + 0.5 - mx) / 3.4, (y + 0.5 - my) / 5.6);
      if (d > 1) continue;
      p.set(x, y, d < 0.45 ? LAVA[7] : d < 0.7 ? LAVA[5] : LAVA[3]);
    }
  // a chimney stub
  for (let y = Math.round(base - ry - 4); y < base - ry + 1; y++) for (let x = Math.round(cx + rx * 0.2); x < cx + rx * 0.2 + 3; x++) p.set(x, y, brick[x < cx + rx * 0.2 + 1 ? 3 : 1]);
  return [mx, my - 3];
}

function glass(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(733);
  const hz = col('#3a1e3a');
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const drips: NonNullable<Backdrop['drips']> = [];
  const GC = [0xffd070, 0x9ae89a, 0xc89aff, 0xff8a7a];

  // the far wall of the warren: black obsidian, rippled with flow lines, a dull violet sheen
  const wallR = haze(OBSID, hz, 0.18);
  for (let y = 0; y < G - 14; y++)
    for (let x = 0; x < w; x++) {
      const flow = noise(x * 0.05 + y * 0.02, y * 0.12, 3) * 0.6 + noise(x * 0.2, y * 0.3, 5) * 0.4;
      let v = 0.27 + (flow - 0.5) * 0.5 + (y / (G - 14)) * 0.12;
      if (Math.abs(flow - 0.55) < 0.03) v += 0.25; // a glossy ridge catching the light
      p.set(x, y, pick(wallR, v, x, y, 0.3));
    }
  // windows of coloured glass grown into the wall, faceted, the lava behind them lighting them up
  const geodes: Array<[number, number, number, number, number]> = [
    [0.13, G - 44, 8, 13, 0], // (clear of the dithered edge shade, which turned it into a checkerboard)
    [0.18, G - 56, 6, 10, 3],
    [0.3, G - 50, 5, 8, 1],
    [0.7, G - 54, 6, 9, 2],
    [0.83, G - 46, 8, 13, 1],
    [0.765, G - 60, 5, 8, 3],
  ];
  for (const [fx, cy, rx, ry, gi] of geodes) {
    const cx = Math.round(fx * w);
    const r2 = rng(cx * 7 + cy);
    const n = 6;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < n; i++) {
      const a2 = (i / n) * Math.PI * 2 + r2() * 0.5;
      const k = 0.75 + r2() * 0.3;
      pts.push([cx + Math.cos(a2) * rx * k, cy + Math.sin(a2) * ry * k]);
    }
    // a facet point off centre toward the light: each triangle to it is a plane of its own tone
    const fpx = cx - rx * 0.25;
    const fpy = cy - ry * 0.2;
    const inPoly = (x: number, y: number) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const r = haze(GLASS[gi], hz, 0.06);
    glowAt(p, cx + 0.5, cy + ry * 0.3, rx * 2.4, ry * 1.6, GLASS[gi][3], 0.16);
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (!inPoly(x + 0.5, y + 0.5)) continue;
        const edge = !inPoly(x - 0.5, y + 0.5) || !inPoly(x + 1.5, y + 0.5) || !inPoly(x + 0.5, y - 0.5) || !inPoly(x + 0.5, y + 1.5);
        if (edge) {
          p.set(x, y, OBSID[x < cx ? 5 : 1]); // a rim of obsidian round the glass
          continue;
        }
        const ang = Math.atan2(y + 0.5 - fpy, x + 0.5 - fpx);
        const facet = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * n);
        const v = 0.35 + hash(facet, gi, cx) * 0.35 + ((y - (cy - ry)) / (ry * 2)) * 0.25;
        p.set(x, y, pick(r, v, x, y, 0.2));
      }
    glints.push({ x: Math.round(fpx), y: Math.round(fpy), c: GC[gi] });
    // set in the rock, not floating: a ragged socket round it, its lip lit on the top left, shaded bottom right
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++)
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        if (inPoly(x + 0.5, y + 0.5)) continue;
        const d = Math.hypot((x + 0.5 - cx) / (rx + 2.5), (y + 0.5 - cy) / (ry + 2.5)) + (noise(x * 0.4, y * 0.4, cx) - 0.5) * 0.3;
        if (d > 1) continue;
        const lit = x + y < cx + cy - 2;
        p.set(x, y, d > 0.86 ? OBSID[lit ? 6 : 1] : OBSID[lit ? 4 : 2]);
      }
  }

  // through a wide low opening in the far wall: the far cavern red with the magma lake's glow, the lake itself, and a
  // chain bridge slung across
  const ox = w * 0.52;
  const lakeY = G - 21;
  // (a tall arch, so the far cavern gives the warren depth: its haze lightens toward the lake like air in sunlight)
  const openH = 44;
  const open = (x: number, y: number) => {
    const dx = (x + 0.5 - ox) / (w * 0.24);
    const dy = (y + 0.5 - (G - 17)) / openH;
    return y < G - 16 && dy < 0 && dx * dx + dy * dy < 1 + (noise(x * 0.09, y * 0.12, 7) - 0.5) * 0.3;
  };
  // the warm light of the lake spilling out of the opening onto the near wall round it
  glowAt(p, ox + 0.5, G - 26, w * 0.34, 34, col('#a03a1c'), 0.16);
  const far = ramp('#1a060e', '#2a0a12', '#3e1014', '#561a16', '#702818', '#8e3a1c', '#a84c22', '#c2602a');
  const farTop = G - 17 - openH;
  /** The far cavern's air: dark high up, glowing hot just over the lake. */
  const airV = (x: number, y: number) => 0.06 + ((y - farTop) / (lakeY - farTop)) ** 1.6 * 0.74 + (noise(x * 0.12, y * 0.2, 9) - 0.5) * 0.12;
  // pillars of obsidian standing in the far cavern, two depths: the farthest barely darker than the air, the nearer
  // darker; each its own width and height, tapering, joined by the odd broken arch
  const farCols: Array<[number, number, number, number]> = [
    // [x as a share of w, half width, top (px above the lake), row: 0 far, 1 near]
    [0.36, 2, 30, 0],
    [0.41, 1.5, 22, 0],
    [0.49, 2.5, 36, 0],
    [0.57, 1.5, 26, 0],
    [0.66, 2, 32, 0],
    [0.33, 3, 40, 1],
    [0.45, 2.5, 18, 1],
    [0.6, 3.5, 44, 1],
    [0.7, 2.5, 20, 1],
  ];
  const pillarAt = (x: number, y: number): number => {
    let row = -1;
    for (const [fx2, half, top, r] of farCols) {
      const cx = fx2 * w;
      const t = (lakeY - y) / top;
      if (t < 0 || t > 1) continue;
      const hw = half * (1 - t * 0.35) + (t < 0.12 ? (0.12 - t) * 8 : 0);
      if (Math.abs(x + 0.5 - cx) <= hw) row = Math.max(row, r);
    }
    return row;
  };
  for (let y = 0; y < G - 14; y++)
    for (let x = 0; x < w; x++) {
      if (!open(x, y)) continue;
      if (!open(x - 1, y) || !open(x, y - 1) || !open(x + 1, y)) {
        p.set(x, y, OBSID[x < ox ? 4 : 1]); // the opening's rim
        continue;
      }
      if (y < lakeY) {
        let v = airV(x, y);
        const row = pillarAt(x, y);
        if (row === 1) v -= pillarAt(x - 1, y) === 1 ? 0.36 : 0.24; // a lit left edge toward the light
        else if (row === 0) v -= 0.14;
        p.set(x, y, pick(far, v, x, y, 0.3));
      } else {
        const v = 0.5 + ((y - lakeY) / 5) * 0.3 + (noise(x * 0.25, y * 0.9, 11) - 0.5) * 0.4;
        p.set(x, y, pick(LAVA, v, x, y, 0.25));
      }
    }
  // the lake's light spills out of the opening across the far wall (Ashfell's key: ember from below), so the warren
  // has depth: lit round the opening, falling off into the dark
  glowAt(p, ox, G - 18, w * 0.42, 34, col('#c0521e'), 0.2);
  glowAt(p, ox, G - 16, w * 0.26, 18, col('#ff8a3a'), 0.14);
  // far stalagmites standing in the lake, black against its glow
  for (const [fx, hgt] of [
    [0.38, 9],
    [0.43, 5],
    [0.61, 11],
    [0.66, 6],
  ] as const) {
    const x = Math.round(fx * w);
    for (let k = 0; k < hgt; k++) {
      const half = 2.2 * (1 - k / hgt);
      for (let xx = Math.floor(x - half); xx <= x + half; xx++) if (open(xx, lakeY + 2 - k)) p.set(xx, lakeY + 2 - k, xx < x ? OBSID[3] : OBSID[1]);
    }
  }
  // heat rising off the lake in shafts: stepped bands of lighter air, dithered at their edges, fading upward
  for (const [fx2, half] of [
    [0.44, 3],
    [0.53, 5],
    [0.62, 3],
  ] as const) {
    const cx = Math.round(fx2 * w);
    for (let y = farTop; y < lakeY; y++) {
      const up = (lakeY - y) / (lakeY - farTop);
      for (let x = cx - half - 1; x <= cx + half + 1; x++) {
        if (!open(x, y) || !open(x - 1, y) || !open(x + 1, y) || !open(x, y - 1)) continue;
        const edge = Math.abs(x - cx) > half;
        if (edge && (x + y) % 2) continue;
        const sway = Math.round(Math.sin(y * 0.18 + cx) * 1);
        if (Math.abs(x - cx - sway) > half + (edge ? 1 : 0)) continue;
        const lift = (1 - up) * 0.22 + 0.04;
        p.tint(x, y, () => pick(far, airV(x, y) + lift, x, y, 0.3));
      }
    }
  }
  // the chain bridge: a chain sagging across the opening, planks hung from it, a lit link here and there
  const bA = Math.round(ox - w * 0.2);
  const bB = Math.round(ox + w * 0.2);
  const chainR = ramp('#0a080c', '#1a1418', '#2c2228', '#40302e', '#5a4236', '#7a5a42');
  const bridgeY = (x: number) => G - 36 + Math.sin(((x - bA) / (bB - bA)) * Math.PI) * 6;
  for (let x = bA; x <= bB; x++) {
    if (!open(x, Math.round(bridgeY(x))) && !open(x, Math.round(bridgeY(x)) + 3)) continue;
    const y = Math.round(bridgeY(x));
    p.set(x, y - 3, x % 2 ? chainR[3] : chainR[1]);
    p.set(x, y, x % 3 === 1 ? LAVA[2] : x % 2 ? chainR[4] : chainR[2]);
    if (x % 3 === 0) {
      p.set(x, y - 2, chainR[1]);
      p.set(x, y - 1, chainR[1]);
    }
    p.set(x, y + 1, pick(ramp('#140c0a', '#24160e', '#3a2416'), x % 3 === 0 ? 0.2 : 0.8, x, y + 1));
  }

  // clusters of coloured glass standing at the back of the floor, each glowing
  const clusters: Array<[number, number, number]> = [
    [0.16, 13, 0],
    [0.23, 8, 3],
    [0.78, 11, 1],
    [0.88, 15, 2],
  ];
  for (const [fx, size, gi] of clusters) {
    const x = Math.round(fx * w);
    glowAt(p, x + 0.5, G - 17, size * 1.8, size * 0.8, GLASS[gi][3], 0.18);
    for (const [tx, ty] of cluster(p, x, G - 15, size, haze(GLASS[gi], hz, 0.06), x * 3 + gi)) glints.push({ x: tx, y: ty + 1, c: GC[gi] });
  }
  // the old glassblowers' kiln on the far left, its mouth still glowing; a rack of long blowpipes beside it
  const [kx, ky] = kiln(p, Math.round(w * 0.06), G - 15, 11, 13, 41);
  glowAt(p, kx + 0.5, ky + 2, 16, 7, col('#ff8a3a'), 0.3);
  torches.push({ x: kx, y: ky + 3 });
  for (let i = 0; i < 4; i++) for (let y = G - 32; y < G - 15; y++) p.set(Math.round(w * 0.31) + i * 2 + Math.round((y - (G - 32)) * 0.14), y, i % 2 ? col('#4a4256') : col('#7a7286'));

  // the warren's floor: black glass worn smooth, catching the coloured light; a calm strip where the fighters stand
  const floorTop = G - 15;
  const floorR = ramp('#08060c', '#100c16', '#181220', '#20182a', '#2a2036', '#362a44', '#463656');
  for (let y = floorTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - floorTop) / (h - floorTop);
      let v = 0.42 - t * 0.12 + (fbm(x * 0.04, y * 0.2, 51) - 0.5) * 0.28;
      if (Math.abs(noise(x * 0.06, y * 0.6, 53) - 0.5) < 0.025) v += 0.3; // glossy streaks
      p.set(x, y, pick(floorR, v, x, y, 0.25));
    }
  // the floor reflects the lake's glow and the glass's colours
  glowAt(p, ox, G - 10, w * 0.22, 6, col('#c04a20'), 0.16);
  for (const [fx, size, gi] of clusters) glowAt(p, Math.round(fx * w) + 0.5, G - 9, size * 2.2, 6, GLASS[gi][2], 0.14);
  for (let i = 0; i < 18; i++) pebble(p, Math.floor(rnd() * w), G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4)), 1, 0, OBSID, OBSID[0]);
  // the edges and the roof in deep shade
  const edgeShade = col('#04020a');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      const k = Math.max(e < 40 ? ((40 - e) / 40) ** 1.5 * 0.55 : 0, y < 12 ? ((12 - y) / 12) * 0.5 : 0);
      if (k > 0) p.tint(x, y, (c) => fade(c, edgeShade, k, x, y, 3, 0.5));
    }

  // framing: obsidian walls closing in on both sides, a roof hung with glass stalactites
  const before = p.buf.slice();
  const nearObs = ramp('#020104', '#06040a', '#0c0812', '#140e1c', '#1e1628', '#2a1e36', '#3a2a4a');
  const wallL = (y: number) => Math.round(14 + Math.max(0, 22 - y) * 0.8 - Math.max(0, y - (G - 10)) * 0.6 + (noise(y * 0.15, 1, 61) - 0.5) * 5);
  const wallR2 = (y: number) => Math.round(w - 14 - Math.max(0, 26 - y) * 0.9 + Math.max(0, y - (G - 10)) * 0.6 - (noise(y * 0.15, 2, 61) - 0.5) * 5);
  for (let y = 0; y < G + 2; y++) {
    for (let x = 0; x <= wallL(y); x++) {
      const k = wallL(y) - x;
      let v = 0.5 - x * 0.012 + (noise(x * 0.3, y * 0.1, 63) - 0.5) * 0.4;
      if (Math.abs(noise(x * 0.1 + y * 0.05, y * 0.15, 65) - 0.55) < 0.025) v += 0.35; // conchoidal ridges shining
      p.set(x, y, k === 0 ? nearObs[5] : pick(nearObs, v, x, y));
    }
    for (let x = wallR2(y); x < w; x++) {
      const k = x - wallR2(y);
      let v = 0.38 + (noise(x * 0.3, y * 0.1, 67) - 0.5) * 0.4;
      if (Math.abs(noise(x * 0.1 - y * 0.05, y * 0.15, 69) - 0.55) < 0.025) v += 0.3;
      p.set(x, y, k === 0 ? INK : pick(nearObs, v, x, y));
    }
  }
  // a shard of amber glass grown into the left wall, glowing
  glassWall(p, 4, 26, 8, 30, haze(GLASS[0], col('#140a1a'), 0.2), 81, glints, GC[0]);
  // the roof: a jagged lip of obsidian across the top, stalactites of coloured glass hanging from it
  for (let x = 0; x < w; x++) {
    const d = Math.round(3 + noise(x * 0.12, 3, 71) * 6);
    for (let y = 0; y < d; y++) p.set(x, y, pick(nearObs, y === d - 1 ? 0.6 : 0.25, x, y));
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.round(24 + i * ((w - 48) / 13) + (rnd() - 0.5) * 10);
    const gi = Math.floor(rnd() * 4);
    const len = 6 + Math.floor(rnd() * 14);
    const top = Math.round(3 + noise(x * 0.12, 3, 71) * 6) - 1;
    const tip = stalactite(p, x, top, len, 3 + rnd() * 2, i % 3 === 0 ? nearObs : haze(GLASS[gi], col('#140a1a'), 0.2), i);
    if (i % 3 !== 0) {
      glints.push({ x: tip[0], y: tip[1] - 1, c: GC[gi] });
      if (len > 11) drips.push({ x: tip[0], y: tip[1] });
    }
  }
  const frame = changed(p, before);
  return [p, frame, { torches, glints, drips }];
}

// ------------------------------------------------------------------ the Black Forge

const SKY_FORGE = ramp('#0e060a', '#18080c', '#240c10', '#341012', '#481614', '#601e16', '#7c2a18', '#9c3a1a', '#c0521e', '#e0702a');

function forge(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(853);
  const hz = col('#6a2418');
  const torches: Backdrop['torches'] = [];
  const glints: NonNullable<Backdrop['glints']> = [];
  const fx = Math.round(w * 0.5); // the great furnace
  const furnaceY = G - 22;
  const heat = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - fx) * 0.5, (y - furnaceY) * 0.8) / 60) ** 1.3;

  // the crater's sky: red-black smoke lit from below by the forge and the lava
  for (let y = 0; y < G - 14; y++)
    for (let x = 0; x < w; x++) {
      const v = (y / (G - 14)) * 0.55 + heat(x, y) * 0.45 + (fbm(x * 0.025, y * 0.07, 3) - 0.5) * 0.2;
      p.set(x, y, pick(SKY_FORGE, v, x, y, 0.35));
    }
  for (const [fxx, fy, len, th] of [
    [-0.04, 8, 120, 4.4],
    [0.6, 4, 140, 5],
    [0.24, 22, 70, 3],
  ])
    smokeBand(p, Math.round(fxx * w), fy, len, th, SMOKE, Math.round(fxx * 50 + fy), (x) => 0.35 + heat(x, 40) * 0.6);
  // a far ridge of the crater behind the rim, hazy and low in contrast (atmospheric perspective: tinted toward the sky)
  const ridgeTop = (x: number) => Math.round(G - 66 + fbm(x * 0.02, 5, 19) * 16 + Math.abs(x - fx) * 0.04);
  for (let x = 0; x < w; x++)
    for (let y = ridgeTop(x); y < G - 30; y++) {
      const sky = (y / (G - 14)) * 0.55 + heat(x, y) * 0.45;
      p.set(x, y, pick(SKY_FORGE, sky - 0.16 + (y === ridgeTop(x) ? 0.08 : 0), x, y, 0.35));
    }
  // the crater's far rim, black, with lava falls pouring down it
  const rimR = haze(BASALT, hz, 0.3);
  const rimTop = (x: number) => Math.round(G - 52 + fbm(x * 0.03, 1, 11) * 14 + Math.abs(x - fx) * 0.05);
  for (let x = 0; x < w; x++)
    for (let y = rimTop(x); y < G - 14; y++) p.set(x, y, pick(rimR, 0.22 + (y === rimTop(x) ? 0.3 : 0) + (noise(x * 0.2, y * 0.15, 13) - 0.5) * 0.25 - (y - rimTop(x)) * 0.004, x, y, 0.2));
  for (const [fxx, wd] of [
    [0.14, 5],
    [0.86, 4],
    [0.7, 2],
  ] as const) {
    const x0 = Math.round(fxx * w);
    for (let y = rimTop(x0) - 1; y < G - 16; y++) {
      const t = (y - rimTop(x0)) / (G - 16 - rimTop(x0));
      // the fall bows out over the rim, narrows, then spreads into a fan where it lands
      const half = wd / 2 + (t < 0.15 ? (0.15 - t) * 6 : 0) + Math.max(0, t - 0.7) * 10 + Math.sin(y * 0.4 + x0) * 0.5;
      const cx = x0 + Math.sin(t * 2.2) * 1.5;
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const u = Math.abs(x + 0.5 - cx) / half;
        const streak = noise(x * 0.9, y * 0.06 - t * 3, 17);
        let v = 0.98 - u * 0.55 + (streak - 0.5) * 0.5 - t * 0.12;
        if (u > 0.8) v = Math.min(v, 0.32); // the cooling crust at its edges
        p.set(x, y, pick(LAVA, v, x, y, 0.2));
      }
    }
    // a cloud of steam and glow where it lands
    glowAt(p, x0 + 0.5, G - 17, 14, 6, col('#ff7a2a'), 0.4);
  }
  // chains as thick as trees slung across the crater, glowing where the heat has got into them
  const chainR = haze(ramp('#06040a', '#120c12', '#201618', '#30201e', '#443026', '#5c4232'), hz, 0.15);
  bigChain(p, w * 0.44, 22, w + 8, 30, 12, 6, haze(chainR, hz, 0.18), 0.5, 23);
  bigChain(p, -8, 28, w * 0.66, 40, 16, 8, chainR, 0.6, 21);

  // the citadel: black basalt walls and towers round the furnace, slit windows glowing
  const cit = haze(ramp('#08060a', '#100c12', '#18121a', '#221a22', '#2e222c', '#3c2e36'), hz, 0.08);
  const towers: Array<[number, number, number]> = [
    [0.27, G - 64, 16],
    [0.36, G - 54, 12],
    [0.62, G - 58, 14],
    [0.73, G - 68, 18],
  ];
  for (const [fxx, top, wd] of towers) {
    const x0 = Math.round(fxx * w - wd / 2);
    for (let y = top; y < G - 14; y++)
      for (let x = x0; x < x0 + wd; x++) {
        const u = (x - x0) / wd;
        let v = u < 0.35 ? 0.62 : 0.32;
        if ((y - top) % 6 === 0) v -= 0.12;
        v += heat(x, y) * 0.3;
        p.set(x, y, pick(cit, v, x, y, 0.2));
      }
    // battlements
    for (let x = x0; x < x0 + wd; x += 3) for (let y = top - 2; y < top; y++) p.set(x, y, cit[3]);
    for (let x = x0 + 1; x < x0 + wd; x += 3) for (let y = top - 2; y < top; y++) p.set(x, y, cit[3]);
    // windows glowing with the forge's light
    for (let k = 0; k < 3; k++) {
      const wx = x0 + Math.round(wd * 0.35) + (k % 2) * Math.round(wd * 0.3);
      const wy = top + 6 + k * 8;
      if (wy > G - 20) break;
      p.set(wx, wy, LAVA[5]);
      p.set(wx, wy + 1, LAVA[3]);
      glints.push({ x: wx, y: wy, c: 0xffb040 });
    }
  }
  // the great wall between the towers, the furnace's arched mouth in it roaring
  for (let y = G - 46; y < G - 14; y++)
    for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x++) {
      if (y < G - 46 + (x % 7 === 0 ? 0 : 0)) continue;
      const v = 0.3 + heat(x, y) * 0.35 + ((y - (G - 46)) % 5 === 0 ? -0.1 : 0) + (noise(x * 0.3, y * 0.3, 31) - 0.5) * 0.15;
      p.set(x, y, pick(cit, v, x, y, 0.2));
    }
  for (let x = Math.round(w * 0.3); x < Math.round(w * 0.7); x += 4) p.set(x, G - 47, cit[4]);
  // pilasters along the wall: a lit left face and a shaded right one (light from the top left), so it has volume
  for (const px of [0.34, 0.42, 0.58, 0.66]) {
    const x0 = Math.round(px * w);
    for (let y = G - 46; y < G - 14; y++) {
      p.set(x0, y, pick(cit, 0.62 + heat(x0, y) * 0.3, x0, y, 0.2));
      p.set(x0 + 1, y, pick(cit, 0.48 + heat(x0, y) * 0.3, x0 + 1, y, 0.2));
      p.set(x0 + 2, y, pick(cit, 0.1, x0 + 2, y, 0.2));
    }
    for (let x = x0 - 1; x <= x0 + 3; x++) p.set(x, G - 47, cit[5]);
  }
  // the furnace's heat rising over the wall: a plume of smoke lit from below, stepped and dithered, fading upward
  for (let y = 6; y < G - 46; y++) {
    const up = (G - 46 - y) / (G - 52);
    const half = 7 + up * 12;
    const sway = Math.sin(y * 0.09) * 3 * up;
    for (let x = Math.floor(fx - half - 2); x <= fx + half + 2; x++) {
      const d = Math.abs(x + 0.5 - fx - sway) / half;
      if (d > 1.15) continue;
      if (d > 1 && (x + y) % 2) continue;
      const lift = (1 - up) * 0.3 * (1 - d * 0.6);
      p.tint(x, y, (c) => (c === SKY_FORGE[0] || c === SKY_FORGE[1] || c === SKY_FORGE[2] || c >= 0 ? pick(SKY_FORGE, (y / (G - 14)) * 0.55 + heat(x, y) * 0.45 + lift + (fbm(x * 0.025, y * 0.07, 3) - 0.5) * 0.2, x, y, 0.35) : c));
    }
  }
  for (let y = furnaceY - 12; y < G - 14; y++)
    for (let x = fx - 13; x <= fx + 13; x++) {
      const dx = (x + 0.5 - fx) / 12;
      const dy = (y + 0.5 - (furnaceY - 1)) / 10;
      const inArch = y >= furnaceY - 1 ? Math.abs(dx) <= 1 : dx * dx + dy * dy <= 1;
      if (!inArch) continue;
      const rim = y >= furnaceY - 1 ? Math.abs(dx) > 0.84 : dx * dx + dy * dy > 0.7;
      if (rim) {
        p.set(x, y, pick(ramp('#1a1214', '#3a2a28', '#5a4034'), x < fx ? 0.8 : 0.3, x, y));
        continue;
      }
      // the fire inside: white-hot deep in, flames licking up
      const d = Math.hypot(dx, (y - (G - 16)) / 12);
      const lick = noise(x * 0.4, y * 0.2, 37);
      p.set(x, y, pick(LAVA, 0.95 - d * 0.6 + (lick - 0.5) * 0.45, x, y, 0.2));
    }
  glowAt(p, fx + 0.5, furnaceY + 4, 38, 14, col('#ff7a2a'), 0.28);
  torches.push({ x: fx - 8, y: G - 16 }, { x: fx + 8, y: G - 16 });

  // the forge floor: great basalt flagstones, glowing seams of heat between some of them
  const floorTop = G - 14;
  const floorR = ramp('#0e0a0e', '#18121a', '#221a22', '#2e222a', '#3c2e34', '#4e3c40', '#644e50');
  for (let y = floorTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - floorTop) / (h - floorTop);
      const row = Math.floor((y - floorTop) / 5);
      const off = (row % 2) * 9;
      const cell = Math.floor((x + off) / 18);
      const seam = (y - floorTop) % 5 === 0 || (x + off) % 18 === 0;
      let v = 0.5 - t * 0.14 + (hash(cell, row, 41) - 0.5) * 0.18 + (noise(x * 0.3, y * 0.3, 43) - 0.5) * 0.12;
      if ((y - floorTop) % 5 === 1) v += 0.1;
      let c = pick(floorR, seam ? 0.05 : v, x, y, 0.2);
      // (the strip the fighters stand on stays calm: no glowing seams within 6 px of the feet line in the arena)
      const arena = x > w * 0.12 && x < w * 0.9 && y >= G - 10 && y <= G + 6;
      if (arena) c = pick(floorR, seam ? 0.2 : 0.38 + (v - 0.5) * 0.4, x, y, 0.2);
      else if (seam && hash(cell, row, 47) > 0.72 && Math.abs(y - G) > 2) c = (x + y) % 3 ? LAVA[2] : LAVA[3];
      p.set(x, y, c);
    }
  // the furnace's light across the floor
  glowAt(p, fx + 0.5, G - 8, w * 0.36, 10, col('#ff6a2a'), 0.22);
  // giant anvils and coils of chain on the platform, set back from the fighters
  const anvilR = ramp('#06040a', '#120c12', '#1e1418', '#2c1e20', '#3c2a28', '#523a30');
  const anvil = (x0: number, base: number, s: number) => {
    const top = base - Math.round(9 * s);
    for (let x = Math.round(x0 - 2 * s); x <= x0 + 12 * s; x++) {
      const horn = x < x0 + 2 * s;
      for (let y = top + (horn ? Math.round((x0 + 2 * s - x) * 0.5) : 0); y <= top + 2 * s; y++) p.set(x, y, pick(anvilR, y === top ? 0.9 : x < x0 + 5 * s ? 0.55 : 0.3, x, y));
    }
    for (let y = Math.round(top + 2 * s); y <= base; y++) {
      const waist = y < base - 2 * s ? 3 * s : 5 * s;
      for (let x = Math.round(x0 + 6 * s - waist); x <= x0 + 6 * s + waist; x++) p.set(x, y, pick(anvilR, x < x0 + 5 * s ? 0.5 : 0.25, x, y));
    }
    glints.push({ x: Math.round(x0 + 4 * s), y: top, c: 0xffe0a0 });
  };
  anvil(Math.round(w * 0.11), G - 14, 1.3);
  anvil(Math.round(w * 0.8), G - 14, 1.1);
  // a brazier each side of the arena
  for (const bx of [Math.round(w * 0.2), Math.round(w * 0.92)]) {
    for (let y = G - 19; y <= G - 14; y++) p.set(bx, y, anvilR[2]);
    for (let x = bx - 3; x <= bx + 3; x++) {
      p.set(x, G - 20, anvilR[4]);
      p.set(x, G - 21, x === bx - 3 || x === bx + 3 ? anvilR[3] : LAVA[3]);
    }
    torches.push({ x: bx, y: G - 21 });
    glowAt(p, bx + 0.5, G - 14, 14, 5, col('#ff8a3a'), 0.3);
  }
  for (let i = 0; i < 16; i++) pebble(p, Math.floor(rnd() * w), G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4)), 1, 0, floorR, floorR[0]);
  // the edges in smoky shade
  const edgeShade = col('#0a0306');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 40) p.tint(x, y, (c) => fade(c, edgeShade, ((40 - e) / 40) ** 1.5 * 0.6, x, y, 3, 0.5));
    }

  // framing: a massive basalt pillar on the left, a chain wound round it; on the right the horn of a colossal anvil
  const before = p.buf.slice();
  const nearB = ramp('#040306', '#08060a', '#100c12', '#18121a', '#221a22', '#2e222a', '#3c2e34');
  for (let y = 0; y < G + 2; y++) {
    const half = 9 + Math.max(0, (y - (G - 12)) * 0.5);
    for (let x = 0; x <= 4 + half * 2; x++) {
      const u = x / (4 + half * 2);
      let v = 0.55 - u * 0.4 + (noise(x * 0.4, y * 0.12, 51) - 0.5) * 0.2;
      if (y % 9 === 0) v -= 0.15;
      p.set(x, y, u > 0.96 ? INK : pick(nearB, v, x, y));
    }
  }
  bigChain(p, 0, 30, 26, 40, 0, 6, ramp('#06040a', '#120c12', '#221818', '#3a2a24', '#584030', '#7a5a40'), 0.45, 53);
  bigChain(p, 0, 58, 25, 66, 0, 6, ramp('#06040a', '#120c12', '#221818', '#3a2a24', '#584030', '#7a5a40'), 0.35, 55);
  // the colossal anvil's horn reaching in from the right, glowing at its tip where it was last struck
  for (let x = w - 46; x < w; x++) {
    const t = (x - (w - 46)) / 46;
    const top = Math.round(14 - t * 6);
    const bot = Math.round(17 + t * 10);
    for (let y = top; y <= bot; y++) p.set(x, y, pick(nearB, y === top ? 0.9 : y < top + 3 ? 0.6 : 0.3, x, y));
    if (t < 0.12) for (let y = top; y <= bot; y++) p.set(x, y, t < 0.05 ? LAVA[4] : LAVA[2]);
  }
  for (let y = 27; y < G + 2; y++) for (let x = w - 20 - Math.max(0, y - 60) * 0.3; x < w; x++) p.set(Math.round(x), y, pick(nearB, x < w - 18 ? 0.6 : 0.28 + (noise(x * 0.3, y * 0.1, 57) - 0.5) * 0.2, Math.round(x), y));
  const frame = changed(p, before);
  return [p, frame, { torches, glints }];
}

// ------------------------------------------------------------------ foregrounds

/** The near ground's dark lip along the bottom edge, rising in the corners. */
function lip(p: Pix, w: number, h: number, L: FgLook, seed: number, cl = 90, cr = 46, lift = 6): void {
  const H = h + FG_OVERLAP;
  for (let x = 0; x < w; x++) {
    const c = cornerness(x, w, cl, cr);
    const top = Math.round(h - 1 - c * lift - noise(x * 0.12, 1, seed) * 2.4);
    for (let y = top; y < H; y++) p.set(x, y, y === top ? L.rim : pick(L.bush, 0.3 - (y - top) * 0.05 + (noise(x * 0.3, y * 0.3, seed + 1) - 0.5) * 0.2, x, y));
  }
}

/** Dry burnt stalks along the bottom, dense in the corners, swaying with the frame. */
function stalks(p: Pix, w: number, h: number, frame: number, L: FgLook, seed: number): void {
  for (let x = 1; x < w - 1; ) {
    const c = cornerness(x, w, 80, 40);
    const hgt = Math.round(2 + c * 9 + hash(x, 1, seed) * 3);
    const sway = hgt >= 5 ? SWAY[(frame + Math.floor(hash(x, 3, seed) * 2 + x / 46)) % 4] : 0;
    const lean = (hash(x, 4, seed) - 0.5) * 1.6;
    if (c > 0.15 || hash(x, 6, seed) > 0.75) blade(p, x, h + (c > 0.3 ? FG_OVERLAP - 1 : 0), hgt, lean, sway, L, false);
    x += c > 0.3 ? 2 + Math.floor(hash(x, 5, seed) * 2) : 4 + Math.floor(hash(x, 5, seed) * 6);
  }
}

/** A rough boulder (or a lump of slag) in a bottom corner. */
function boulder(p: Pix, cx: number, base: number, rx: number, ry: number, r: Ramp, seed: number): void {
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.4, y * 0.4, seed) - 0.5) * 0.35) continue;
      p.set(x, y, pick(r, 0.3 + 0.5 * lambert(dx, dy) + (noise(x * 0.5, y * 0.5, seed + 1) - 0.5) * 0.2, x, y));
    }
}

/** A dark shard of obsidian standing up out of the floor, leaning `lean`. */
function obsidianShard(p: Pix, x: number, base: number, hgt: number, wid: number, lean: number, r: Ramp, tipC?: Col): void {
  for (let k = 0; k < hgt; k++) {
    const t = k / hgt;
    const half = (wid / 2) * (1 - t) ** 0.8;
    const cx = x + lean * k;
    for (let xx = Math.floor(cx - half); xx <= cx + half; xx++) {
      const u = (xx + 0.5 - cx) / Math.max(0.5, half);
      p.set(xx, base - k, pick(r, u < -0.1 ? 0.7 : 0.3, xx, base - k));
    }
  }
  if (tipC !== undefined) p.set(Math.round(x + lean * (hgt - 1)), base - hgt + 1, tipC);
}

function foregroundAsh(theme: AshTheme, w: number, h: number, frame: number): Pix {
  const H = h + FG_OVERLAP;
  const p = new Pix(w, H, -1);
  const ink = col('#040206');
  let rim = col('#c46a3a');
  let mid = col('#4a2420');
  if (theme === 'cinder') {
    const L: FgLook = { blade: ramp('#060406', '#0e0a0a', '#18100e', '#241812'), rim: col('#a0502a'), bush: ramp('#040304', '#08060a', '#100c10', '#181216', '#221a1c', '#2e2224'), ink };
    // a lip of ash, lumps of black slag in the corners, burnt stalks, an ember or two in the cracks
    lip(p, w, h, L, 17, 96, 50, 8);
    boulder(p, 10, H, 16, 12, L.bush, 3);
    boulder(p, 27, H, 9, 6, L.bush, 4);
    boulder(p, w - 7, H, 13, 10, L.bush, 5);
    stalks(p, w, h, frame, L, 21);
    for (const [x, y] of [
      [12, H - 9],
      [w - 9, H - 7],
      [31, H - 4],
    ])
      p.set(x, y, frame % 2 ? LAVA[4] : LAVA[3]);
  } else if (theme === 'glass') {
    const L: FgLook = { blade: ramp('#040208', '#0a0612', '#120c1c', '#1c1428'), rim: col('#6a4a8a'), bush: ramp('#020104', '#05030a', '#0a0612', '#100a1a', '#181024', '#221830'), ink };
    // a ledge of black glass, shards of obsidian and coloured glass jutting up in the corners
    lip(p, w, h, L, 23, 90, 50, 6);
    boulder(p, 8, H, 15, 12, L.bush, 31);
    boulder(p, w - 8, H, 14, 11, L.bush, 33);
    obsidianShard(p, 22, H - 2, 15, 5, 0.3, L.bush);
    obsidianShard(p, 30, H - 1, 8, 3, 0.55, L.bush, col('#c89aff'));
    obsidianShard(p, w - 23, H - 2, 13, 4, -0.32, L.bush);
    obsidianShard(p, w - 30, H - 1, 7, 3, -0.6, L.bush, col('#ffd070'));
    for (let i = 0; i < 7; i++) pebble(p, 50 + Math.floor(hash(i, 4, 57) * (w - 100)), h - 1 + (i % 3 === 0 ? 2 : 0), 1 + (i % 2), 1, L.bush, ink);
    rim = col('#8a6aaa');
    mid = col('#2a1a3e');
  } else {
    const L: FgLook = { blade: ramp('#060304', '#0e0608', '#180c0c', '#241210'), rim: col('#b04a2a'), bush: ramp('#030202', '#080404', '#100808', '#180c0c', '#221212', '#2e1a18'), ink };
    // rubble and slag along the bottom, a coil of chain in a corner, cooling slag still glowing
    lip(p, w, h, L, 29, 96, 50, 8);
    boulder(p, 9, H, 16, 11, L.bush, 41);
    boulder(p, w - 10, H, 15, 10, L.bush, 43);
    boulder(p, 27, H, 7, 4, L.bush, 45);
    const chainR = ramp('#040204', '#0a0608', '#120c0c', '#1c1210', '#281a14');
    for (let i = 0; i < 6; i++) {
      const x = w - 38 + i * 4;
      const y = H - 3 - (i % 2);
      for (let k = 0; k < 3; k++) p.set(x + k, y - (i % 2 ? 0 : 1), chainR[k === 0 ? 4 : 2]);
      p.set(x, y + 1, chainR[1]);
    }
    for (const [x, y] of [
      [14, H - 8],
      [w - 14, H - 6],
      [24, H - 3],
    ])
      p.set(x, y, frame % 2 ? LAVA[4] : LAVA[5]);
    rim = col('#d0602a');
    mid = col('#5a1e18');
  }
  backlight(p, rim, mid, theme.length);
  return p;
}

// ------------------------------------------------------------------ build

const PAINT: Record<AshTheme, (w: number, h: number, G: number) => [Pix, Pix, Backdrop]> = { cinder, glass, forge };

/** Paint one Ashfell theme's backdrop textures for the current layout (stage height h, feet line `ground`). */
export function buildAshBackdrop(scene: Phaser.Scene, theme: AshTheme, w: number, h: number, ground: number): Backdrop {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const [bg, frame, info] = PAINT[theme](w, h, ground);
  add(`bg_${theme}`, bg.canvas());
  add(`frame_${theme}`, frame.canvas());
  for (let f = 0; f < FG_FRAMES; f++) {
    const fg = foregroundAsh(theme, w, h, f);
    const top = new Pix(w, h, -1);
    top.buf.set(fg.buf.subarray(0, w * h));
    const over = new Pix(w, FG_OVERLAP, -1);
    over.buf.set(fg.buf.subarray(w * h));
    add(`fg_${theme}_${f}`, top.canvas());
    add(`fgo_${theme}_${f}`, over.canvas());
  }
  return info;
}

/** For tests and the art sheet: paint a theme's backdrop into plain pixel buffers (no scene). */
export function paintAshBackdrop(theme: AshTheme, w: number, h: number, ground: number): { bg: Pix; frame: Pix; fg: Pix; info: Backdrop } {
  const [bg, frame, info] = PAINT[theme](w, h, ground);
  return { bg, frame, fg: foregroundAsh(theme, w, h, 0), info };
}

void [lighten, understory, bay, mix];
