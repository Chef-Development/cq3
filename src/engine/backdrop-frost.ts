// The Frostpeaks' fight backdrops, painted with backdrop.ts's toolkit (see there and docs/art-style.md): Frostbite
// Pass (a snowbound pass between the peaks, stuck in one cold afternoon: snow-laden pines, a frozen waterfall,
// prayer-flag ropes), the Glimmer Caves (blue ice caverns lit by glowing crystals, icicles, a frozen underground
// lake) and Wyrm's Glacier (a glacier field under a green-violet aurora, ice spires, a frozen hoard glinting on the
// horizon). Same contract as backdrop.ts (`bg_`, `frame_`, `fg_`/`fgo_` per sway frame), but painted the first time
// an act needs one (Stage.ensure), not at boot: Greenmarch's players never pay for them.
import type Phaser from 'phaser';
import {
  backlight,
  bay,
  blade,
  changed,
  clamp01,
  col,
  conifer,
  cornerness,
  fade,
  fbm,
  FG_FRAMES,
  FG_OVERLAP,
  hash,
  haze,
  lambert,
  mass,
  mix,
  noise,
  pebble,
  pick,
  Pix,
  ramp,
  rng,
  SWAY,
  trunk,
  understory,
  type Backdrop,
  type Blob,
  type Col,
  type FgLook,
  type Ramp,
  torchLight,
  type Theme,
} from './backdrop';

export type FrostTheme = 'pass' | 'caves' | 'glacier';
export const FROST_THEMES: FrostTheme[] = ['pass', 'caves', 'glacier'];
export const isFrost = (t: Theme): t is FrostTheme => t === 'pass' || t === 'caves' || t === 'glacier';

// ------------------------------------------------------------------ shared ramps (dark -> light, hue-shifted)

/** Snow: violet-blue in shadow, warm cream where the light catches it. */
const SNOW = ramp('#4e5888', '#6a76a8', '#8e9ac6', '#b4c0de', '#d6dfef', '#eff3fa', '#fffcf4');
/** Ice: deep blue in the cracks, cyan through the body, white glare. */
const ICE = ramp('#1a2a5a', '#284a84', '#3a6eaa', '#5a98cc', '#86c0e4', '#b6e2f4', '#e4f8ff', '#ffffff');
/** Cold slate rock. */
const SLATE = ramp('#141828', '#1e2438', '#2a324a', '#3a445e', '#4e5a76', '#68748e', '#8a94aa');

// ------------------------------------------------------------------ painters

/** The painted bounding box of `paint` as a change mask (cheap: only the box is compared). */
function painted(p: Pix, x0: number, y0: number, x1: number, y1: number, paint: () => void): { on: Uint8Array; x0: number; y0: number; bw: number; bh: number } {
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(p.w - 1, Math.ceil(x1));
  y1 = Math.min(p.h - 1, Math.ceil(y1));
  const bw = Math.max(0, x1 - x0 + 1);
  const bh = Math.max(0, y1 - y0 + 1);
  const before = new Int32Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) before[y * bw + x] = p.buf[(y0 + y) * p.w + x0 + x];
  paint();
  const on = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) on[y * bw + x] = p.buf[(y0 + y) * p.w + x0 + x] !== before[y * bw + x] ? 1 : 0;
  return { on, x0, y0, bw, bh };
}

interface SnowOpts {
  snow: Ramp;
  seed: number;
  /** Px of snow on a surface open to the sky (a little more here and there). */
  depth: number;
  /** Brightness offset (distance, shade). */
  light?: number;
}

/**
 * Paint something, then let snow settle on it: every pixel it painted whose top is open to the sky gets `depth` px
 * of snow, lit on the left, shaded on the right, with a lump hanging over an edge now and then.
 */
function snowy(p: Pix, box: [number, number, number, number], paint: () => void, o: SnowOpts): void {
  const m = painted(p, box[0], box[1], box[2], box[3], paint);
  const { on, x0, y0, bw, bh } = m;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < bw && y < bh && on[y * bw + x] === 1;
  const light = o.light ?? 0;
  for (let x = 0; x < bw; x++) {
    let k = 99;
    for (let y = 0; y < bh; y++) {
      if (!at(x, y)) {
        k = 99;
        continue;
      }
      k = at(x, y - 1) ? k + 1 : 0;
      const gx = x0 + x;
      const gy = y0 + y;
      const deep = o.depth + (noise(gx * 0.45, gy * 0.2, o.seed) > 0.55 ? 1 : 0);
      if (k >= deep) continue;
      let v = 0.78 - k * 0.2 + light + (noise(gx * 0.6, gy * 0.6, o.seed + 3) - 0.5) * 0.14;
      if (!at(x - 1, y)) v += 0.12;
      else if (!at(x + 1, y)) v -= 0.3;
      p.set(gx, gy, pick(o.snow, v, gx, gy));
      // a lump of snow hanging over the bough's tip
      if (k === 0 && !at(x + 1, y) && !at(x + 1, y + 1) && hash(gx, gy, o.seed) > 0.6) p.set(gx + 1, gy + 1, pick(o.snow, 0.45 + light, gx + 1, gy + 1));
    }
  }
}

/** A conifer heavy with snow (tiers of drooping boughs, snow settled on every shoulder). */
function snowPine(p: Pix, rnd: () => number, cx: number, base: number, hgt: number, wid: number, leaf: Ramp, snow: Ramp, seed: number, light = 0, depth = 1): void {
  snowy(
    p,
    [cx - wid, base - hgt - 2, cx + wid, base + 2],
    () => conifer(p, rnd, cx, base, hgt, wid, { ramp: leaf, seed, bump: 0.12, tex: 0.18, vgrad: 0.25, light }),
    { snow, seed: seed + 5, depth, light },
  );
}

/**
 * A snowy peak: snow over the upper slopes, rock breaking through in ribs and lower down; a crisp ridge between the lit
 * face (left) and the shaded one.
 */
function snowPeak(p: Pix, mx: number, my: number, sl: number, sr: number, base: number, rock: Ramp, snow: Ramp, seed: number, snowLine = 0.6): void {
  const xa = Math.floor(mx - (base - my) / sl);
  const xb = Math.ceil(mx + (base - my) / sr);
  for (let x = Math.max(0, xa); x <= Math.min(p.w - 1, xb); x++) {
    const rough = (fbm(x * 0.11, 0.5, seed) - 0.5) * 7;
    const top = Math.round(my + (x < mx ? (mx - x) * sl : (x - mx) * sr) + rough * Math.min(1, Math.abs(x - mx) / 8));
    for (let y = Math.max(0, top); y <= base && y < p.h; y++) {
      const ridge = mx + (y - my) * 0.22 + (noise(y * 0.12, 2, seed) - 0.5) * 7;
      const lit = x < ridge;
      const depth = (y - my) / Math.max(1, base - my);
      // ribs of rock run down the slopes; more of them lower down
      const rib = noise((x - mx) * 0.26 + (y - my) * (lit ? 0.42 : -0.42), y * 0.05, seed + 3) * 0.75 + noise(x * 0.17, y * 0.21, seed + 5) * 0.25;
      const rocky = rib > 0.7 - depth * 0.45 || depth > snowLine + (noise(x * 0.2, 4, seed) - 0.5) * 0.3;
      if (!rocky) {
        let v = lit ? 0.82 : 0.38;
        if (lit && x > ridge - 2) v = 0.95; // the ridge line catches the light
        v += (noise(x * 0.3, y * 0.3, seed + 7) - 0.5) * 0.12 - depth * 0.15;
        p.set(x, y, pick(snow, v, x, y, 0.2));
      } else {
        const v = (lit ? 0.62 : 0.24) + (noise(x * 0.5, y * 0.4, seed + 9) - 0.5) * 0.25;
        p.set(x, y, pick(rock, v, x, y, 0.15));
      }
    }
  }
}

/** A long soft band of cloud lit from above (tops bright, undersides in shade). */
function stratus(p: Pix, x0: number, y0: number, len: number, thick: number, r: Ramp, seed: number, glow: (x: number, y: number) => number): void {
  const r2 = rng(seed);
  const bl: Blob[] = [];
  const n = Math.max(3, Math.round(len / 8));
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const t = Math.sin(f * Math.PI);
    bl.push({ x: x0 + f * len + (r2() - 0.5) * 4, y: y0 - t * thick * 0.5 + (r2() - 0.5) * 1.2, rx: 5 + t * len * 0.15, ry: 1 + t * thick * (0.55 + r2() * 0.35) });
  }
  const inside = (x: number, y: number) => bl.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1 + (noise(x * 0.22, y * 0.55, seed) - 0.5) * 0.7);
  for (let y = Math.floor(y0 - thick * 2); y <= y0 + thick + 2; y++)
    for (let x = Math.floor(x0 - 10); x <= x0 + len + 10; x++) {
      if (!inside(x, y)) continue;
      let above = 0;
      while (above < 3 && inside(x, y - above - 1)) above++;
      const v = 0.2 + glow(x, y) * 0.4 + (above === 0 ? 0.32 : above === 1 ? 0.16 : 0) - (inside(x, y + 1) ? 0 : 0.1);
      p.set(x, y, pick(r, v, x, y, 0.2));
    }
}

/** A rope of prayer flags sagging between two points: small cloth squares in five colours, a few lifted by the wind. */
function prayerFlags(p: Pix, ax: number, ay: number, bx: number, by: number, sag: number, fw: number, fh: number, gap: number, hz: Col, hzAmt: number, seed: number, rope: Col): Array<[number, number]> {
  const cloth = [ramp('#14306e', '#2456b4', '#4a8ae0'), ramp('#9ca2b8', '#e2e2e6', '#fffcf4'), ramp('#6a1420', '#c02a2a', '#ee5a44'), ramp('#14482a', '#2e8a44', '#5ab45a'), ramp('#8a5a10', '#e0a420', '#ffd860')].map((r) => haze(r, hz, hzAmt));
  const ropeAt = (x: number) => {
    const t = (x - ax) / (bx - ax);
    return ay + (by - ay) * t + sag * 4 * t * (1 - t);
  };
  const tips: Array<[number, number]> = [];
  for (let x = Math.ceil(ax); x <= bx; x++) p.set(x, Math.round(ropeAt(x)), rope);
  let i = 0;
  for (let x = Math.ceil(ax) + gap; x + fw < bx - 1; x += fw + gap, i++) {
    const c = cloth[(i + seed) % cloth.length];
    const y0 = Math.round(ropeAt(x + fw / 2)) + 1;
    const lift = hash(i, 3, seed) > 0.7 ? 1 : 0; // a flag lifted by the wind leans downwind
    for (let yy = 0; yy < fh; yy++)
      for (let xx = 0; xx < fw; xx++) {
        const px = x + xx + (lift && yy >= fh / 2 ? 1 : 0);
        const v = yy === 0 ? 2 : xx === fw - 1 || yy === fh - 1 ? 0 : 1;
        p.set(px, y0 + yy, c[v]);
      }
    tips.push([x, y0]);
  }
  return tips;
}

/**
 * A frozen waterfall pouring over a brow of rock: a fan of fluted ice columns, narrow at the lip and spreading as it
 * falls, lit on the left, icicles fringing its edges and a cone of ice at its foot. Returns spots on it that glint.
 */
function icefall(p: Pix, cx: number, yTop: number, yBot: number, hw0: number, hw1: number, ice: Ramp, seed: number): Array<[number, number]> {
  const glints: Array<[number, number]> = [];
  const half = (y: number) => hw0 + (hw1 - hw0) * clamp01((y - yTop) / (yBot - yTop)) ** 0.7;
  // columns 2-3 px wide across the widest extent, each falling to its own length
  for (let x = Math.floor(cx - hw1 - 1); x <= cx + hw1 + 1; x++) {
    const col0 = Math.floor((x + 40) / 3);
    const k = (x + 40) % 3;
    const end = yBot - Math.floor(hash(col0, 2, seed) * 5);
    for (let y = yTop; y <= end; y++) {
      const hw = half(y) + (noise(x * 0.3, y * 0.15, seed) - 0.5) * 2;
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) > hw) continue;
      const u = dx / Math.max(1, hw);
      let v = 0.62 - u * 0.32 + (k === 0 ? 0.14 : k === 2 ? -0.18 : 0) + (noise(x * 0.9, y * 0.08, seed + 1) - 0.5) * 0.3;
      if (y < yTop + 3) v += 0.2; // the lip bulges out into the light
      if ((y + Math.floor(hash(col0, 4, seed) * 6)) % 8 === 0) v += 0.14; // frozen ripples down each column
      p.set(x, y, pick(ice, v, x, y, 0.2));
    }
    // icicles hanging off the fan's edges
    const edge = Math.abs(x + 0.5 - cx) > hw0 && k === 1 && hash(col0, 7, seed) > 0.3;
    if (edge) {
      let y = yTop;
      while (y < yBot && Math.abs(x + 0.5 - cx) > half(y)) y++;
      const len = 2 + Math.floor(hash(col0, 8, seed) * 4);
      for (let j = 0; j < len; j++) p.set(x, y + j, ice[j === len - 1 ? 6 : 4]);
    }
    if (k === 1 && hash(col0, 5, seed) > 0.5) glints.push([x, yTop + 3 + Math.floor(hash(col0, 6, seed) * (yBot - yTop - 10))]);
  }
  // the cone of ice at its foot
  const mh = hw1 + 6;
  for (let y = yBot - 7; y <= yBot + 3; y++)
    for (let x = Math.floor(cx - mh); x <= cx + mh; x++) {
      const dx = (x + 0.5 - cx) / mh;
      const dy = (y + 0.5 - (yBot + 3)) / 10;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.4, y * 0.4, seed + 2) - 0.5) * 0.3) continue;
      const v = 0.5 + 0.5 * lambert(dx, dy * 1.4) + (noise(x * 0.5, y * 0.5, seed + 9) - 0.5) * 0.2;
      p.set(x, y, pick(ice, v, x, y, 0.2));
    }
  return glints;
}

/** Spruce boughs reaching in over a top corner from a trunk (dir 1: from the left edge), heavy with snow. */
function snowBoughs(p: Pix, x0: number, dir: number, reach: number, seed: number, leaf: Ramp, snow: Ramp, ink: Col): void {
  const r2 = rng(seed);
  for (let b = 0; b < 6; b++) {
    const by = -6 + b * 8 + r2() * 2;
    const len = reach * (1 - b * 0.13) * (0.8 + r2() * 0.3);
    const bl: Blob[] = [];
    for (let i = 0; i < len; i += 2.5) {
      const t = i / len;
      const droop = t * t * 11 + Math.sin(i * 0.3 + b) * 0.8;
      const r = (6.4 - t * 3.4) * (0.85 + r2() * 0.3);
      bl.push({ x: x0 + dir * i, y: by + droop, rx: r, ry: r * 0.62 });
      if (r2() < 0.55) bl.push({ x: x0 + dir * (i + 1.5), y: by + droop + r * 0.5, rx: r * 0.6, ry: r * 0.42 }); // twigs hanging under
    }
    const xa = dir > 0 ? x0 - 8 : x0 - len - 8;
    snowy(p, [xa, by - 6, xa + len + 16, by + 20], () => mass(p, bl, { ramp: leaf, seed: seed + b, bump: 0.34, tex: 0.35, vgrad: 0.15, shadow: 0.3, outline: ink }), { snow, seed: seed + 50 + b, depth: 2 });
  }
}

// ------------------------------------------------------------------ Frostbite Pass

/** Snow in a frozen afternoon: violet-blue shadows, peach where the low sun catches it (alpenglow). */
const ALPEN = ramp('#4a5088', '#626aa6', '#8486c2', '#aaa6d4', '#d0c2dc', '#f2d8d4', '#ffe8dc', '#fff6ec');

function pass(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(131);
  const ink = col('#140c1c');
  const hz = col('#d4c6d8');

  // a cold afternoon that never ends: slate blue overhead, lilac, a peach glow round the veiled sun
  const skyR = ramp('#3a4888', '#465696', '#5664a4', '#6a74b0', '#8286bc', '#9c9ac6', '#b6aecc', '#ceC0d0', '#e2cccc', '#f0d4c6', '#f8dcc0', '#ffe8c8');
  const sunX = Math.round(w * 0.4);
  const sunY = 26;
  const skyBot = G - 14;
  const glowAt = (x: number, y: number) => Math.max(0, 1 - Math.hypot((x - sunX) * 0.4, (y - sunY) * 1.0) / 70) ** 1.5;
  for (let y = 0; y < skyBot; y++) for (let x = 0; x < w; x++) p.set(x, y, pick(skyR, (y / (G - 30)) * 0.8 + glowAt(x, y) * 0.36, x, y, 0.3));
  const sunHalo = col('#fff2dc');
  for (let y = sunY - 24; y <= sunY + 24; y++)
    for (let x = sunX - 32; x <= sunX + 32; x++) {
      const d = Math.hypot(x + 0.5 - sunX, (y + 0.5 - sunY) * 1.2);
      if (d < 28) p.tint(x, y, (c) => fade(c, sunHalo, Math.pow(1 - d / 28, 2.2) * 0.75, x, y, 3, 0.7));
    }
  const sunR = ramp('#f8e6cc', '#fff2de', '#fffcf4');
  for (let y = -7; y <= 7; y++)
    for (let x = -7; x <= 7; x++) {
      const d = Math.hypot(x, y);
      if (d <= 7.2) p.set(sunX + x, sunY + y, sunR[d > 6 ? 0 : d > 4 && x + y > -2 ? 1 : 2]);
    }
  // long bands of snow cloud, lit along their tops (warm near the sun); one veils the sun's lower half
  const cloudR = ramp('#6e78a2', '#8690b4', '#9ea4c4', '#b8bad4', '#d0cede', '#e6dfe6', '#f8eeec', '#fff6ec');
  for (const [fx, fy, len, th] of [
    [-0.08, 12, 92, 3.5],
    [0.1, 34, 66, 2.2],
    [0.44, 7, 96, 3.2],
    [0.66, 22, 80, 3],
    [0.36, 42, 40, 1.6],
    [0.84, 40, 56, 2],
  ])
    stratus(p, Math.round(fx * w), fy, len, th, cloudR, Math.round(fx * 100 + fy), glowAt);

  // the far range in the haze: one great peak framed by the pass, its snowfields catching the light
  const farRock = haze(ramp('#3c4474', '#4a5480', '#5a648e', '#6c769c'), hz, 0.5);
  const farSnow = haze(ALPEN, hz, 0.3);
  for (const [fx, fy, sl, sr] of [
    [0.06, -58, 0.66, 0.6],
    [0.24, -80, 0.74, 0.6],
    [0.47, -60, 0.6, 0.72],
    [0.63, -70, 0.62, 0.62],
    [0.93, -60, 0.6, 0.66],
  ])
    snowPeak(p, Math.round(fx * w), G + fy, sl, sr, G - 26, farRock, farSnow, Math.round(fx * 97) + 3, 0.72);
  for (let y = G - 46; y < G - 22; y++)
    for (let x = 0; x < w; x++) {
      const k = clamp01((y - (G - 46)) / 24) * (0.6 + (fbm(x * 0.03, y * 0.12, 17) - 0.5) * 0.8);
      p.tint(x, y, (c) => fade(c, hz, k * 0.75, x, y, 3, 0.6));
    }

  // the shoulders either side of the pass: closer and sharper; the right one breaks in a cliff with a frozen waterfall
  const midRock = haze(SLATE, hz, 0.22);
  const midSnow = haze(ALPEN, hz, 0.08);
  const shoulders = painted(p, 0, 0, w - 1, G - 17, () => {
    snowPeak(p, Math.round(w * 0.1), G - 62, 0.6, 0.62, G - 18, midRock, midSnow, 41, 0.5);
    snowPeak(p, Math.round(w * 0.72), G - 84, 0.52, 0.55, G - 18, midRock, midSnow, 47, 0.45);
  });
  const slopeTop = (x: number) => Math.round(G - 84 + (Math.round(w * 0.72) - x) * 0.52 + (fbm(x * 0.11, 0.5, 47) - 0.5) * 7);
  // the cliff: a band of dark rock broken out of the slope, ledges dusted with snow
  const cl0 = Math.round(w * 0.46);
  const cl1 = Math.round(w * 0.6);
  snowy(
    p,
    [cl0 - 8, G - 66, cl1 + 10, G - 17],
    () => {
      for (let y = G - 66; y < G - 17; y++) {
        const t = (y - (G - 66)) / 49;
        const L = cl0 + (noise(y * 0.14, 1, 5) - 0.5) * 8 - t * 5;
        const R = cl1 + (noise(y * 0.14, 2, 5) - 0.5) * 8 + t * 7;
        for (let x = Math.floor(L); x <= R; x++) {
          if (y < slopeTop(x) + 3) continue;
          const u = (x - L) / (R - L);
          let v = 0.56 - u * 0.36 + (noise(x * 0.35, y * 0.12, 9) - 0.5) * 0.32;
          if (noise(x * 0.8, y * 0.05, 11) > 0.68) v -= 0.25; // cracks running down
          if (x - L < 1.5) v += 0.3; // its lit edge
          p.set(x, y, pick(midRock, v, x, y, 0.15));
        }
      }
    },
    { snow: midSnow, seed: 51, depth: 1 },
  );
  const fallX = Math.round(w * 0.525);
  const fallGlints = icefall(p, fallX, slopeTop(fallX) + 4, G - 21, 5, 12, haze(ICE, hz, 0.06), 61);

  // tiny snowy pines dotting the shoulders' lower slopes
  const leafR = ramp('#0c1a26', '#122830', '#1a3834', '#24483c', '#325a44', '#466c4e');
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rnd() * w);
    const y = G - 42 + Math.floor(rnd() * 22);
    const sx = x - shoulders.x0;
    const sy = y - shoulders.y0;
    if (sx < 0 || sy < 0 || sx >= shoulders.bw || sy >= shoulders.bh || !shoulders.on[sy * shoulders.bw + sx]) continue;
    if (x > cl0 - 6 && x < cl1 + 10) continue;
    const s = 4 + rnd() * 4;
    snowPine(p, rnd, x + 0.5, y, s, s * 0.6, haze(leafR, hz, 0.45), haze(SNOW, hz, 0.3), i * 7, 0.05);
  }

  // a far rope of prayer flags strung across the pass
  prayerFlags(p, Math.round(w * 0.2), G - 46, Math.round(w * 0.47), G - 52, 8, 2, 2, 2, hz, 0.3, 2, mix(col('#3a2a30'), hz, 0.35));

  // snowy pines below the slopes: a hazy row behind a nearer, darker one, thickest behind the foes; the foot of the
  // woods in blue shade
  const beforeTrees = p.buf.slice();
  const plant = (base: number, hzAmt: number, s: number, seed: number, light: number, gap: (x: number) => number) => {
    const r2 = rng(seed);
    const jobs: Array<[number, () => void]> = [];
    for (let x = -4 + r2() * 6; x < w + 8; ) {
      const tall = r2();
      const hg = (11 + tall * tall * 24) * s;
      const wd = (7 + tall * 8) * s;
      const tx = Math.round(x);
      const lr = haze(leafR, hz, hzAmt);
      const sr = haze(SNOW, hz, hzAmt * 0.6);
      jobs.push([hg, () => snowPine(p, r2, tx + 0.5, base + 1 + Math.floor(r2() * 2), hg, wd, lr, sr, seed + tx, light, hg > 14 ? 2 : 1)]);
      x += wd * 0.6 + gap(x) * r2();
    }
    jobs.sort((a, b) => b[0] - a[0]);
    for (const [, job] of jobs) job();
  };
  plant(G - 20, 0.4, 0.8, 71, 0.08, (x) => 4 + (x < w * 0.4 ? 10 : 2));
  plant(G - 15, 0.04, 1.08, 77, 0.04, (x) => (x < w * 0.3 ? 28 : x < w * 0.55 ? 18 : 8));
  understory(p, beforeTrees, G - 46, G - 13, col('#161c40'), 0.62, 0.04);

  // deep snow behind the road, rising to the trees; bluer where the woods shade it
  const bankR = ramp('#545e90', '#6c78a8', '#8a96c2', '#aab6d8', '#c8d2ea', '#e2e8f4', '#f6f8fc', '#fffaf2');
  const gTop = G - 16;
  for (let y = gTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      if (y < gTop + 2 && !skyR.includes(p.get(x, y)) && hash(x, y, 4) > 0.5) continue;
      const t = (y - gTop) / (G - 7 - gTop);
      const lit = glowAt(x, 20) * 0.25;
      p.set(x, y, pick(bankR, 0.26 + t * 0.4 + lit + (fbm(x * 0.06, y * 0.25, 81) - 0.5) * 0.45, x, y, 0.3));
    }
  // snowed-under juniper and rocks along the bank
  const juniper = ramp('#0e1a22', '#14262a', '#1c3430', '#284438');
  const rockR = ramp('#262c46', '#363e5a', '#4a5472', '#646e8c');
  for (let i = 0; i < 9; i++) {
    const x = Math.round(w * (0.08 + i * 0.105) + (rnd() - 0.5) * 14);
    const rx = 3 + rnd() * 3;
    const rock = i % 3 === 1;
    snowy(
      p,
      [x - rx - 3, G - 18, x + rx + 3, G - 8],
      () => {
        if (rock)
          for (let yy = -Math.round(rx * 0.6); yy <= 0; yy++)
            for (let xx = -Math.round(rx); xx <= rx; xx++) {
              if ((xx / (rx + 0.5)) ** 2 + (yy / (rx * 0.6 + 0.5)) ** 2 > 1) continue;
              p.set(x + xx, G - 9 + yy, pick(rockR, 0.55 - xx * 0.07 - yy * 0.1, x + xx, G - 9 + yy));
            }
        else mass(p, [{ x, y: G - 10, rx, ry: rx * 0.6 }, { x: x + rx * 0.6, y: G - 9, rx: rx * 0.6, ry: rx * 0.45 }], { ramp: juniper, seed: i, bump: 0.3, tex: 0.3, vgrad: 0.2 });
      },
      { snow: SNOW, seed: 200 + i, depth: rock ? 1 : 2 },
    );
  }
  // a cairn of flat stones, a prayer-flag pole planted in it, on the hero's side
  const cairnX = Math.round(w * 0.24);
  const cairnR = ramp('#3a3e5c', '#525a78', '#707894', '#9098b0');
  snowy(
    p,
    [cairnX - 9, G - 26, cairnX + 9, G - 8],
    () => {
      for (let i = 0; i < 7; i++) {
        const sw = 9 - i - (i > 3 ? 1 : 0);
        const sy = G - 10 - i * 2;
        const sx = cairnX - Math.floor(sw / 2) + (i % 3 === 1 ? 1 : i % 3 === 2 ? -1 : 0);
        for (let x = sx; x < sx + sw; x++) {
          p.set(x, sy, pick(cairnR, 0.85 - ((x - sx) / sw) * 0.6, x, sy));
          p.set(x, sy + 1, pick(cairnR, 0.3 - ((x - sx) / sw) * 0.2, x, sy + 1));
        }
      }
    },
    { snow: SNOW, seed: 91, depth: 1 },
  );
  const poleX = cairnX;
  for (let y = G - 46; y < G - 23; y++) {
    p.set(poleX, y, col('#7a5234'));
    p.set(poleX + 1, y, col('#3e2618'));
  }
  p.set(poleX, G - 47, col('#f2c230'));
  p.set(poleX + 1, G - 47, col('#9a5a14'));
  // a short rope from the pole to the left
  prayerFlags(p, Math.round(w * 0.08), G - 40, poleX, G - 45, 5, 2, 3, 2, hz, 0.1, 3, col('#2e2024'));

  // the road: trodden snow, packed into a calm blue-grey where the fighters stand
  const roadR = ramp('#4a5480', '#58628e', '#68729c', '#7a84aa', '#8e96ba', '#a6accc', '#c0c4dc');
  const roadTop = G - 8;
  for (let y = roadTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - roadTop) / (h - roadTop);
      let v = 0.58 - t * 0.12 + (fbm(x * 0.05, y * 0.3, 91) - 0.5) * 0.24 + glowAt(x, 10) * 0.12;
      if ((y === G + 3 || y === G + 7) && noise(x * 0.12, y, 4) > 0.45) v -= 0.14;
      p.set(x, y, pick(roadR, v, x, y, 0.2));
    }
  // sledge ruts pressed into icy tracks, a lit lip on their far side
  for (const ry of [G - 3, G + 4])
    for (let x = 0; x < w; x++) {
      if (noise(x * 0.07, ry * 0.5, 23) < 0.22) continue;
      const yy = ry + Math.round((noise(x * 0.025, ry, 29) - 0.5) * 2.4);
      p.set(x, yy - 1, pick(roadR, 0.92, x, yy - 1, 0.5));
      p.set(x, yy, roadR[1]);
      p.set(x, yy + 1, hash(x, yy, 3) > 0.5 ? roadR[2] : roadR[1]);
    }
  // footprints in pairs, kept off the line the actors stand on
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.35 ? G - 5 : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    p.set(x, y, roadR[1]);
    p.set(x + 2, y + (rnd() < 0.5 ? 1 : 0), roadR[1]);
  }
  // the bank's lip of snow overhanging the road, a soft blue shadow under it
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(noise(x * 0.3, 5, 31) * 2.4) + (hash(x, 9, 7) > 0.8 ? 1 : 0);
    for (let k = 0; k < len; k++) p.set(x, roadTop + k, k === len - 1 ? bankR[3] : bankR[5 + (hash(x, k, 3) > 0.6 ? 1 : 0)]);
    p.set(x, roadTop + len, roadR[1]);
    if (hash(x, 4, 8) > 0.5) p.set(x, roadTop + len + 1, roadR[2]);
  }
  for (let i = 0; i < 12; i++) pebble(p, Math.floor(rnd() * w), G + 4 + Math.floor(rnd() * Math.max(1, h - G - 5)), 1, 0, rockR, roadR[0]);
  // the framing pine and the crag shade the snow near the edges (cool violet)
  const edgeShade = col('#1c2044');
  for (let y = gTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 40) p.tint(x, y, (c) => fade(c, edgeShade, ((40 - e) / 40) ** 1.5 * 0.55, x, y, 3, 0.5));
    }

  // framing: a great snow-laden spruce on the left, a crag with an icy overhang on the right, prayer flags between
  const before = p.buf.slice();
  const frameBark = ramp('#100c12', '#1e1418', '#2e1e20', '#40282a', '#563630');
  const frameLeaf = ramp('#060c14', '#0a161c', '#10221e', '#183024', '#22402a', '#305234');
  const frameSnow = ramp('#2e3462', '#4a548a', '#7480b2', '#a2acd4', '#cad2ea', '#eef0f8', '#fffaf0');
  trunk(p, 6, 0, G + 2, 12, 15, -1, { ramp: frameBark, seed: 33, outline: ink, flare: 4, wobble: 2 });
  for (let y = 4; y < G - 4; y++) if (noise(y * 0.15, 3, 33) > 0.48) p.set(1 + Math.round((noise(y * 0.07, 1, 33) - 0.5) * 2), y, frameSnow[3]);
  snowBoughs(p, 9, 1, 70, 301, frameLeaf, frameSnow, frameLeaf[0]);
  // the crag: dark slate with a lit edge, an overhang across the top right, icicles under its brow
  const crag = ramp('#08080e', '#10121c', '#1a1e2c', '#262c3e', '#343c52', '#465068', '#5c6884');
  const cragL = (y: number) => Math.round(w - 16 - Math.max(0, 20 - y) * 1.7 + (noise(y * 0.18, 1, 37) - 0.5) * 5 - (y > G - 12 ? (y - (G - 12)) * 0.8 : 0));
  snowy(
    p,
    [w - 60, 0, w - 1, G + 2],
    () => {
      for (let y = 0; y < G + 2; y++) {
        const xl = cragL(y);
        for (let x = xl; x < w; x++) {
          const k = x - xl;
          let v = 0.66 - k * 0.04 + (noise(x * 0.3, y * 0.15, 39) - 0.5) * 0.3;
          if (noise(x * 0.12, y * 0.5, 41) > 0.68) v -= 0.25; // bedding planes
          if (k === 1) v = 0.92; // the edge catches the sky
          p.set(x, y, k === 0 ? ink : pick(crag, v, x, y));
        }
      }
    },
    { snow: frameSnow, seed: 43, depth: 2, light: -0.05 },
  );
  const drips: NonNullable<Backdrop['drips']> = [];
  for (let x = cragL(0) + 1; x < w - 14; x++) {
    let y = 0;
    while (y < 30 && x >= cragL(y + 1)) y++;
    if (y >= 30 || y < 2 || hash(x, 1, 45) < 0.4) continue;
    const len = 2 + Math.floor(hash(x, 2, 45) * 8);
    for (let j = 1; j <= len; j++) p.set(x, y + j, j === len ? ICE[6] : j === 1 ? ICE[2] : ICE[j < len / 2 ? 4 : 5]);
    if (len >= 6) drips.push({ x, y: y + len + 1 });
  }
  // the near rope of prayer flags across the top, from the spruce to the crag
  prayerFlags(p, 20, 7, w - 44, 3, 13, 4, 5, 3, hz, 0, 0, col('#2a1c20'));
  const frame = changed(p, before);

  const glints = fallGlints.map(([x, y]) => ({ x, y, c: 0xe8fbff }));
  return [p, frame, { torches: [], glints, drips }];
}

// ------------------------------------------------------------------ crystals and ice

/**
 * A crystal (or ice) shard: a prism rising from (x, base) along a lean, its point at the top; a lit face on the left,
 * a bright ridge, a shaded face on the right, and an inner glow brightest low in its body.
 */
export function shard(p: Pix, x: number, base: number, hgt: number, wid: number, lean: number, r: Ramp, glow = 0.1): void {
  const tipAt = hgt - Math.max(2, wid * 0.9);
  for (let t = 0; t <= hgt; t++) {
    const y = base - t;
    const cx = x + lean * t;
    const half = t < tipAt ? wid / 2 : (wid / 2) * (1 - (t - tipAt) / (hgt - tipAt + 0.5));
    if (half < 0.3) {
      p.set(Math.round(cx), y, r[r.length - 2]);
      continue;
    }
    for (let xx = Math.floor(cx - half); xx <= Math.ceil(cx + half); xx++) {
      const u = (xx + 0.5 - cx) / half;
      if (u < -1.05 || u > 1.05) continue;
      let v = u < -0.3 ? 0.62 : u < 0.25 ? 0.46 : 0.24;
      if (Math.abs(u + 0.3) < 0.2) v = 0.86; // the ridge catches the light
      v += glow * (1 - t / hgt) + (t >= tipAt ? 0.08 : 0);
      if (u > 0.82 || u < -0.9) v -= 0.12;
      p.set(xx, y, pick(r, v, xx, y));
    }
  }
}

/** A cluster of shards fanning out from one foot (back ones first); returns the tips (for glints). */
export function cluster(p: Pix, x: number, base: number, size: number, r: Ramp, seed: number): Array<[number, number]> {
  const r2 = rng(seed);
  const n = 3 + Math.floor(r2() * 3);
  const list: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1) - 0.5;
    const hgt = size * (0.45 + (1 - Math.abs(f) * 1.6) * 0.55) * (0.8 + r2() * 0.35);
    list.push([x + f * size * 0.55 + (r2() - 0.5) * 2, hgt, Math.max(2.5, size * (0.27 + r2() * 0.12)), f * 0.7 + (r2() - 0.5) * 0.2]);
  }
  // the tallest stands at the back
  list.sort((a, b) => b[1] - a[1]);
  const tips: Array<[number, number]> = [];
  for (const [sx, hg, wd, ln] of list) {
    shard(p, sx, base, Math.round(hg), wd, ln, r, 0.12);
    tips.push([Math.round(sx + ln * hg), Math.round(base - hg)]);
  }
  return tips;
}

/** A column of ice or rock hanging from `y0` (dir 1) or rising from it (dir -1), fluted, tapering to a point. */
function spike(p: Pix, x: number, y0: number, len: number, wid: number, dir: number, r: Ramp, seed: number): void {
  for (let t = 0; t < len; t++) {
    const y = y0 + dir * t;
    const half = (wid / 2) * (1 - t / len) ** 0.8;
    for (let xx = Math.floor(x - half); xx <= Math.ceil(x + half); xx++) {
      const u = (xx + 0.5 - x) / Math.max(0.5, half);
      if (Math.abs(u) > 1.05) continue;
      let v = 0.66 - u * 0.36 + (noise(xx * 0.7, y * 0.15, seed) - 0.5) * 0.25;
      if (half < 0.8) v = 0.75;
      p.set(xx, y, pick(r, v, xx, y));
    }
  }
}

// ------------------------------------------------------------------ the Glimmer Caves

const CAVE = ramp('#05061a', '#0a0e26', '#111a36', '#192848', '#22365a', '#2c466e', '#3c5c86');
const VIOLET = ramp('#22104a', '#3e1c7a', '#6a32b4', '#9a5ce2', '#c89aff', '#ecdcff', '#ffffff');
const CYAN = ramp('#0a304e', '#125c80', '#1c94b0', '#46cad8', '#96eef0', '#e2ffff', '#ffffff');

function caves(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(211);
  const ink = col('#04040e');
  const hz = col('#24447a');
  const glints: NonNullable<Backdrop['glints']> = [];
  const crackX = Math.round(w * 0.38);

  // the cavern's far wall: deep indigo, flowstone streaks running down it, paler where the light from the roof falls
  const wallR = haze(CAVE, hz, 0.3);
  for (let y = 0; y < G - 14; y++)
    for (let x = 0; x < w; x++) {
      const lightCone = clamp01(1 - Math.abs(x - (crackX + y * 0.28)) / (20 + y * 0.5)) * clamp01(y / 30);
      const flow = noise(x * 0.16, y * 0.035, 3) * 0.6 + noise(x * 0.45, y * 0.08, 5) * 0.4;
      let v = 0.18 + (y / (G - 14)) * 0.32 + (flow - 0.5) * 0.4 + lightCone * 0.35;
      if (flow > 0.7) v += 0.12;
      p.set(x, y, pick(wallR, v, x, y, 0.3));
    }
  // through an opening in the far wall, a further chamber of ice glows pale in the distance
  const ox = Math.round(w * 0.47);
  const oy = G - 50;
  const inOpen = (x: number, y: number) => {
    const dx = (x + 0.5 - ox) / 25;
    const dy = (y + 0.5 - oy) / 17;
    const a = Math.atan2(dy, dx);
    return y < G - 15 && Math.hypot(dx, dy * (dy < 0 ? 1.1 : 0.62)) < 1 + (noise(a * 2.2 + 3, 1, 7) - 0.5) * 0.5;
  };
  const farChamber = ramp('#16305a', '#1c3c6a', '#24497a', '#2e5a8c', '#3c6c9c', '#4e80ac', '#6698bc');
  for (let y = oy - 26; y < G - 14; y++)
    for (let x = ox - 40; x <= ox + 40; x++) {
      if (!inOpen(x, y)) continue;
      // organ pipes of ice down its far wall, lit from a glow low in the middle
      const pipe = (x + Math.floor(noise(y * 0.1, 2, 9) * 3)) % 5;
      const lit = clamp01(1 - Math.hypot((x - ox) / 30, (y - (G - 26)) / 26));
      let v = 0.16 + lit * 0.6 + (pipe === 0 ? 0.12 : pipe === 4 ? -0.12 : 0) + (noise(x * 0.3, y * 0.06, 19) - 0.5) * 0.2;
      if (!inOpen(x - 1, y) || !inOpen(x, y - 1) || !inOpen(x - 2, y)) v -= 0.22; // the opening's rim in shadow
      p.set(x, y, pick(farChamber, v, x, y, 0.3));
    }
  for (const [dx, s0, r] of [
    [-14, 6, CYAN],
    [9, 8, VIOLET],
    [20, 5, CYAN],
  ] as const) {
    const x = ox + dx;
    const y = oy + 15;
    torchLight(p, x + 0.5, y - 2, 12, 8, r === CYAN ? col('#3ab8d0') : col('#8a4ad0'), 0.14);
    cluster(p, x, y, s0, haze(r, col('#3a6a9a'), 0.55), x * 7);
  }
  // the crack in the roof the light pours through
  for (let y = 0; y < 7; y++) {
    const cx = crackX + Math.sin(y * 1.3) * 1.5 + y * 0.3;
    const half = 3.5 - y * 0.45;
    for (let x = Math.floor(cx - half); x <= cx + half; x++) p.set(x, y, Math.abs(x + 0.5 - cx) < half * 0.4 ? col('#f0fcff') : col('#9ad8f4'));
  }
  // far crystals glowing in the gloom, each lighting the rock round it
  const farCrystals: Array<[number, number, number, Ramp, Col]> = [
    [0.08, G - 40, 12, VIOLET, col('#7a3cc0')],
    [0.25, G - 46, 9, CYAN, col('#2ab0c8')],
    [0.74, G - 50, 10, VIOLET, col('#7a3cc0')],
    [0.93, G - 42, 13, CYAN, col('#2ab0c8')],
  ];
  for (const [fx, y, s, r, gc] of farCrystals) {
    const x = Math.round(fx * w);
    torchLight(p, x + 0.5, y - s * 0.3, s * 3.4, s * 2.4, gc, 0.16);
    cluster(p, x, y, s, haze(r, hz, 0.3), x + y);
  }
  // great pillars where the ice from the roof met the ice from the floor, hazy in the distance
  const pillarR = haze(ramp('#122040', '#1a3054', '#244268', '#30567e', '#426e94', '#5a88aa'), hz, 0.4);
  for (const [fx, wid] of [
    [0.17, 9],
    [0.64, 12],
    [0.84, 8],
  ]) {
    const x = Math.round(fx * w);
    for (let y = 0; y < G - 20; y++) {
      const t = y / (G - 20);
      const waist = 0.35 + Math.abs(t - 0.55) * 1.4;
      const half = (wid / 2) * Math.min(1.6, waist) + (noise(y * 0.2, x, 7) - 0.5) * 1.6;
      for (let xx = Math.floor(x - half); xx <= x + half; xx++) {
        const u = (xx + 0.5 - x) / half;
        let v = 0.62 - u * 0.4 + (noise(xx * 0.6, y * 0.1, x) - 0.5) * 0.3;
        if (Math.abs(u) > 0.85) v -= 0.18;
        p.set(xx, y, pick(pillarR, v, xx, y, 0.2));
      }
    }
  }
  // far stalactites along the roof and stalagmites rising from the far shore
  const farSpike = haze(CAVE, hz, 0.45);
  for (let i = 0; i < 22; i++) {
    const x = Math.round(rnd() * w);
    if (Math.abs(x - crackX) < 8) continue;
    spike(p, x, 0, 6 + Math.round(rnd() * 14), 3 + rnd() * 4, 1, farSpike, i);
  }
  // cold mist hanging over the lake
  for (let y = G - 40; y < G - 22; y++)
    for (let x = 0; x < w; x++) {
      const k = (1 - Math.abs(y - (G - 30)) / 10) * (0.55 + (fbm(x * 0.035, y * 0.15, 31) - 0.5) * 0.9);
      if (k > 0) p.tint(x, y, (c) => fade(c, col('#3e6aa0'), k * 0.55, x, y, 3, 0.6));
    }
  // the far shore: a low lip of rock with small stalagmites, and the frozen lake below it
  const shoreR = haze(CAVE, hz, 0.22);
  const lakeTop = G - 27;
  const lakeBot = G - 16;
  for (let x = 0; x < w; x++) {
    const top = lakeTop - 2 - Math.round(noise(x * 0.09, 1, 13) * 4);
    for (let y = top; y < lakeTop; y++) p.set(x, y, pick(shoreR, y === top ? 0.75 : 0.35 + (noise(x * 0.4, y, 15) - 0.5) * 0.3, x, y));
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.round(rnd() * w);
    spike(p, x, lakeTop - 3, 4 + Math.round(rnd() * 8), 2.5 + rnd() * 2, -1, shoreR, i + 40);
  }
  // crystals along the far shore, mirrored in the ice below
  for (const [fx, s0, r] of [
    [0.36, 8, VIOLET],
    [0.58, 7, CYAN],
    [0.66, 11, CYAN],
  ] as const) {
    const x = Math.round(fx * w);
    torchLight(p, x + 0.5, lakeTop - 5, s0 * 2.6, s0 * 1.6, r === CYAN ? col('#2ab0c8') : col('#7a3cc0'), 0.18);
    cluster(p, x, lakeTop - 2, s0, haze(r, hz, 0.2), x * 5);
    farCrystals.push([fx, lakeTop, s0, r, 0]);
  }
  // the lake: glossy black-blue ice, the crystals' colours mirrored in long wobbling streaks, pale cracks across it
  const lakeR = ramp('#080e28', '#0e1a3e', '#162a56', '#20406e', '#305a88', '#4c7ca4', '#86b4d0');
  for (let y = lakeTop; y < lakeBot; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - lakeTop) / (lakeBot - lakeTop);
      let v = 0.32 + t * 0.12 + (noise(x * 0.04, y * 0.6, 21) - 0.5) * 0.25;
      if (noise(x * 0.09, y * 1.4, 23) > 0.7) v += 0.22; // sheen
      p.set(x, y, pick(lakeR, v, x, y, 0.3));
    }
  for (const [fx, , , r] of farCrystals) {
    const x = Math.round(fx * w);
    for (let y = lakeTop; y < lakeBot; y++) {
      const wob = Math.round(Math.sin(y * 1.7 + x) * 1.2);
      const k = 1 - (y - lakeTop) / (lakeBot - lakeTop);
      if (hash(x, y, 3) < k * 0.9) p.set(x + wob, y, haze(r, hz, 0.4)[3]);
      if (hash(x + 1, y, 3) < k * 0.5) p.set(x + wob + 1, y, haze(r, hz, 0.4)[2]);
    }
  }
  for (let i = 0; i < 6; i++) {
    let x = Math.round(rnd() * w);
    let y = lakeTop + 1 + Math.floor(rnd() * (lakeBot - lakeTop - 2));
    for (let k = 0; k < 8 + rnd() * 12; k++) {
      p.set(x, y, lakeR[5]);
      x += 1;
      if (rnd() < 0.3) y += rnd() < 0.5 ? 1 : -1;
      y = Math.max(lakeTop, Math.min(lakeBot - 1, y));
    }
  }
  // the near shore: rock ledges, glowing crystal clusters lighting them, ice spikes
  const ledgeR = CAVE;
  const gTop = G - 16;
  for (let y = gTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - gTop) / (G - 7 - gTop);
      const n = fbm(x * 0.08, y * 0.3, 41);
      let v = 0.32 + t * 0.25 + (n - 0.5) * 0.5;
      if (y === gTop || (y === gTop + 1 && hash(x, y, 5) > 0.5)) v = 0.85; // frost on the lip
      p.set(x, y, pick(ledgeR, v, x, y, 0.25));
    }
  const near: Array<[number, number, Ramp, Col, number]> = [
    [0.13, 24, VIOLET, col('#8a4ad0'), 1],
    [0.21, 13, VIOLET, col('#8a4ad0'), 0],
    [0.5, 10, CYAN, col('#2ab8d0'), 0],
    [0.79, 21, CYAN, col('#2ab8d0'), 1],
    [0.88, 12, VIOLET, col('#8a4ad0'), 0],
  ];
  for (const [fx, s, r, gc, big] of near) {
    const x = Math.round(fx * w);
    torchLight(p, x + 0.5, G - 12, s * 2.4, 9, gc, 0.3);
    torchLight(p, x + 0.5, G - 12 - s * 0.4, s * 1.5, s * 1.2, gc, 0.22);
    const tips = cluster(p, x, G - 11, s, r, x * 3 + 1);
    for (const [tx, ty] of tips.slice(0, big ? 3 : 1)) glints.push({ x: tx, y: ty + 1, c: r === VIOLET ? 0xf0dcff : 0xe2ffff });
  }
  const iceSpikeR = ICE;
  for (const [fx, len] of [
    [0.31, 8],
    [0.325, 5],
    [0.64, 10],
    [0.66, 6],
  ])
    spike(p, Math.round(fx * w), G - 9, len, 5, -1, haze(iceSpikeR, col('#2a5a8a'), 0.3), Math.round(fx * 100));

  // the floor: dark stone glazed with ice, calm where the fighters stand; the crystals' light pooled on it
  const floorR = ramp('#10162e', '#161e3a', '#1c2846', '#243454', '#2e4262', '#3a5274', '#4c6888');
  const roadTop = G - 8;
  for (let y = roadTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - roadTop) / (h - roadTop);
      let v = 0.5 - t * 0.14 + (fbm(x * 0.05, y * 0.3, 51) - 0.5) * 0.24;
      const glaze = noise(x * 0.06, y * 0.5, 53);
      if (glaze > 0.6) v += 0.18 + (y % 2 === 0 && glaze > 0.68 ? 0.12 : 0); // a sheet of ice: glossy streaks
      p.set(x, y, pick(floorR, v, x, y, 0.2));
    }
  // frost on the ledge's edge overhanging the floor, a shadow under it
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(noise(x * 0.3, 5, 55) * 2.2);
    for (let k = 0; k < len; k++) p.set(x, roadTop + k, k === len - 1 ? ledgeR[3] : ledgeR[4 + (hash(x, k, 3) > 0.6 ? 1 : 0)]);
    p.set(x, roadTop + len, floorR[0]);
  }
  for (const [fx, , r, gc] of near) torchLight(p, Math.round(fx * w) + 0.5, G + 2, 26, 7, gc, 0.18 + (r === CYAN ? 0.02 : 0));
  // ice shards and pebbles strewn about, kept off the line the actors stand on
  const pebR = ramp('#2a3a5c', '#3e5478', '#5c7a9c', '#8aaac4');
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.35 ? G - 5 : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    if (rnd() < 0.5) pebble(p, x, y, 1, 0, pebR, floorR[0]);
    else {
      p.set(x, y, ICE[5]);
      p.set(x + 1, y, ICE[3]);
      p.set(x, y + 1, floorR[0]);
    }
  }
  // the walls shade the floor near the edges
  const edgeShade = col('#060818');
  for (let y = gTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 44) p.tint(x, y, (c) => fade(c, edgeShade, ((44 - e) / 44) ** 1.5 * 0.6, x, y, 3, 0.5));
    }

  // framing: the cave's walls either side and its roof overhead, icicles and stalactites hanging from it
  const before = p.buf.slice();
  const frameR = ramp('#030410', '#070a1c', '#0c122a', '#141c3a', '#1e2a4c', '#2a3a60');
  const roofAt = (x: number) => {
    const e = Math.min(x, w - 1 - x);
    return Math.round(3 + noise(x * 0.07, 1, 61) * 6 + Math.max(0, 40 - e) * 0.5);
  };
  const wallAt = (y: number, dir: number) => Math.round(14 + noise(y * 0.08, dir, 63) * 8 + Math.max(0, 22 - y) * 0.9 + (y > G - 10 ? (y - (G - 10)) * 1.2 : 0));
  for (let y = 0; y < G + 2; y++)
    for (let x = 0; x < w; x++) {
      const lw = wallAt(y, 1);
      const rw = wallAt(y, 2);
      const inRoof = y < roofAt(x);
      const inL = x < lw;
      const inR = x >= w - rw;
      if (!inRoof && !inL && !inR) continue;
      // edges facing the cavern catch the crystals' light: violet on the left, cyan on the right
      const edgeL = inL && !inRoof && x >= lw - 2;
      const edgeR = inR && !inRoof && x <= w - rw + 1;
      const edgeT = inRoof && y >= roofAt(x) - 1 && !inL && !inR;
      let c = pick(frameR, 0.4 + (noise(x * 0.25, y * 0.25, 65) - 0.5) * 0.45, x, y);
      if (edgeL) c = x === lw - 1 ? ink : mix(c, VIOLET[3], x === lw - 2 ? 0.45 : 0.2);
      else if (edgeR) c = x === w - rw ? ink : mix(c, CYAN[3], x === w - rw + 1 ? 0.45 : 0.2);
      else if (edgeT) c = y === roofAt(x) - 1 ? ink : c;
      p.set(x, y, c);
    }
  // icicles and stalactites hanging from the roof (drops gather on the long ones)
  const drips: NonNullable<Backdrop['drips']> = [];
  for (let x = 4; x < w - 4; x++) {
    if (hash(x, 3, 67) < 0.55) continue;
    const top = roofAt(x) - 1;
    const icy = hash(x, 4, 67) > 0.35;
    const len = Math.round((icy ? 3 : 5) + hash(x, 5, 67) * (icy ? 12 : 9) * (Math.abs(x - w / 2) < 60 ? 0.8 : 1.2));
    spike(p, x + 0.5, top, len, icy ? 2.2 + hash(x, 6, 67) * 1.5 : 4 + hash(x, 6, 67) * 2, 1, icy ? ICE : frameR, x);
    if (icy && len >= 10) drips.push({ x, y: top + len });
    x += icy ? 2 : 4;
  }
  const frame = changed(p, before);
  return [p, frame, { torches: [], glints, drips }];
}

// ------------------------------------------------------------------ Wyrm's Glacier

/**
 * A serac: a tower of glacier ice, narrowing a little as it rises, its top sheared off at a slant (`cut` px from
 * left to right); three flat faces (lit, front, shade), old layers banding it, snow on the cut. Returns its top.
 */
export function serac(p: Pix, x: number, base: number, hgt: number, wid: number, cut: number, r: Ramp, snow: Ramp, seed: number): [number, number] {
  let top0: [number, number] = [x, base - hgt];
  for (let y = Math.round(base - hgt - Math.abs(cut) - 2); y <= base; y++) {
    const t = clamp01((base - y) / hgt);
    const half = (wid / 2) * (1 - t * 0.22) + (noise(y * 0.3, 1, seed) - 0.5) * 1.2;
    for (let xx = Math.floor(x - half); xx <= Math.ceil(x + half); xx++) {
      const u = (xx + 0.5 - (x - half)) / (half * 2);
      if (u < 0 || u > 1) continue;
      const top = base - hgt + cut * (u - 0.5) + (noise(xx * 0.6, 2, seed) - 0.5) * 2;
      if (y < top) continue;
      if (y < top + 1) {
        p.set(xx, y, pick(snow, 0.8 - u * 0.4, xx, y));
        if (top0[1] > y) top0 = [xx, y];
        continue;
      }
      let v = u < 0.3 ? 0.68 : u < 0.64 ? 0.48 : 0.26;
      if (Math.abs(u - 0.3) < 0.05) v = 0.88; // the edge between the faces catches the light
      if ((y + Math.floor(hash(seed, 1, 7) * 5)) % 6 === 0) v -= 0.1; // the glacier's old layers
      if (noise(xx * 0.9, y * 0.06, seed + 3) > 0.7) v -= 0.14; // cracks
      p.set(xx, y, pick(r, v, xx, y, 0.15));
    }
  }
  return top0;
}

function glacier(w: number, h: number, G: number): [Pix, Pix, Backdrop] {
  const p = new Pix(w, h, 0);
  const rnd = rng(307);
  const ink = col('#04040e');
  const hz = col('#24486a');
  const glints: NonNullable<Backdrop['glints']> = [];

  // the night sky, deep indigo overhead, teal toward the horizon; stars
  const skyR = ramp('#05071c', '#080c26', '#0c1230', '#10193a', '#132244', '#162c4e', '#1a3858', '#1e4462', '#24526a');
  const skyBot = G - 14;
  for (let y = 0; y < skyBot; y++) for (let x = 0; x < w; x++) p.set(x, y, pick(skyR, y / (G - 22), x, y, 0.3));
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rnd() * w);
    const y = Math.floor(rnd() * (G - 36));
    p.set(x, y, rnd() < 0.3 ? col('#f0f6ff') : col('#7a8cbc'));
    if (i % 12 === 0) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(x + dx, y + dy, col('#3e4e80'));
  }
  // the aurora: ribbons of light hanging in folds, a bright mint hem waving low, green rays rising into violet
  const aurG = ramp('#16404e', '#1a5e5e', '#208068', '#2aa478', '#40c88a', '#70e8a8', '#b4ffd4', '#ecfff6');
  const aurV = ramp('#1a1a4a', '#28226a', '#3a2c88', '#5038a4', '#6a4abe');
  const ribbon = (hem: (x: number) => number, tall: number, amt: number, seed: number) => {
    for (let x = 0; x < w; x++) {
      const streak = noise(x * 0.3, 1, seed);
      const ray = 0.3 + 0.7 * streak * streak * (0.7 + 0.3 * Math.sin(x * 0.9 + seed));
      const fold = 0.75 + 0.25 * Math.sin(x * 0.08 + seed * 2);
      const hy = hem(x);
      for (let y = Math.max(0, Math.floor(hy - tall)); y <= hy + 1 && y < skyBot; y++) {
        const up = hy - y;
        const k = (up < 0 ? 0.35 : Math.exp(-up / (tall * 0.38))) * ray * fold * amt;
        const green = up < tall * 0.42;
        const target = green ? pick(aurG, 0.25 + k * 0.85 + (up < 1.5 ? 0.15 : 0), x, y, 0.25) : pick(aurV, 0.2 + k * 1.6, x, y, 0.25);
        const a = green ? k * 1.8 : k * 1.2 + 0.1;
        if (a > 0.07) p.tint(x, y, (c) => fade(c, target, Math.min(1, a), x, y, 4, 0.3));
      }
    }
  };
  const hemAt = (x: number) => G - 56 + Math.sin(x * 0.021 + 0.8) * 9 + Math.sin(x * 0.057 + 2) * 4;
  ribbon((x) => G - 70 + Math.sin(x * 0.03 + 3) * 6, 18, 0.45, 9);
  ribbon(hemAt, 34, 1, 5);

  // the far range: smooth mountains of ice and snow, hazy, with a few seracs on the skyline
  const farIce = haze(ramp('#16304e', '#1e4064', '#2a5478', '#3a6a8c', '#5486a4', '#78a8c0', '#a8d0dc'), hz, 0.4);
  const farSnow = haze(ramp('#2a4468', '#3a5a80', '#56789c', '#7a9cb8', '#a2c2d4', '#cce4ec', '#eefaff'), hz, 0.35);
  for (const [fx, fy, sl, sr] of [
    [0.04, -46, 0.6, 0.5],
    [0.25, -40, 0.5, 0.62],
    [0.45, -50, 0.6, 0.55],
    [0.92, -44, 0.55, 0.6],
  ])
    snowPeak(p, Math.round(fx * w), G + fy, sl, sr, G - 20, farIce, farSnow, Math.round(fx * 89) + 7, 0.8);
  for (const [fx, hg, wd, cut] of [
    [0.34, 14, 5, 3],
    [0.46, 18, 6, -4],
    [0.7, 12, 5, 4],
    [0.75, 16, 6, -3],
  ])
    serac(p, Math.round(fx * w), G - 22, hg, wd, cut, farIce, farSnow, Math.round(fx * 100));
  // the wyrm's hoard on the horizon: a hill of gold under a skin of ice, a crown and a goblet on top, glinting
  const hx = Math.round(w * 0.165);
  const hb = G - 21;
  const goldR = haze(ramp('#3a1e14', '#6a3a16', '#a2641a', '#d89a26', '#f6cc4a', '#fff0a0'), hz, 0.12);
  torchLight(p, hx + 0.5, hb - 6, 30, 15, col('#ffa040'), 0.14);
  for (let y = hb - 10; y <= hb; y++)
    for (let x = hx - 18; x <= hx + 18; x++) {
      const dx = (x + 0.5 - hx) / 18;
      const dy = (y + 0.5 - hb) / 10;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.4, y * 0.4, 75) - 0.5) * 0.2) continue;
      let v = 0.3 + 0.6 * lambert(dx * 0.9, dy * 1.4);
      if ((x + (y % 2) * 2) % 4 === 0 && hash(x, y, 79) > 0.4) v += 0.18; // coins
      const iced = y > hb - 4 + Math.sin(x * 0.4) * 1.5; // the ice has crept over its foot
      p.set(x, y, iced ? pick(farIce, 0.5 + v * 0.3, x, y) : pick(haze(goldR, hz, 0.15), v, x, y));
    }
  bitsAt(p, ['g.g.g', 'gGgGg', 'yyyyy'], { g: goldR[4], G: goldR[5], y: goldR[2] }, hx - 7, hb - 13);
  bitsAt(p, ['GgG', 'yGy', '.g.', 'ggy'], { g: goldR[4], G: goldR[5], y: goldR[2] }, hx + 4, hb - 13);
  bitsAt(p, ['.s', 's.', 'y.'], { s: col('#c8d4e8'), y: goldR[3] }, hx + 11, hb - 12);
  for (let i = 0; i < 8; i++) glints.push({ x: hx - 13 + Math.floor(hash(i, 1, 81) * 26), y: hb - 3 - Math.floor(hash(i, 2, 81) * 6), c: 0xfff4b0 });
  // spindrift haze along the glacier's far edge
  for (let y = G - 28; y < G - 14; y++)
    for (let x = 0; x < w; x++) {
      const k = (1 - Math.abs(y - (G - 21)) / 7) * (0.55 + (fbm(x * 0.04, y * 0.2, 83) - 0.5) * 0.9);
      if (k > 0) p.tint(x, y, (c) => fade(c, col('#6a90b0'), k * 0.5, x, y, 3, 0.4));
    }

  // the glacier field: broad planes of blue ice, crevasses running across it with lit lips
  const fieldR = ramp('#0c1a38', '#142a4c', '#1e3e60', '#2a5476', '#3c6c8c', '#5688a2', '#78a8bc', '#a6ccd8');
  const gTop = G - 19;
  for (let y = gTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - gTop) / (G - 7 - gTop);
      let v = 0.5 + t * 0.1 + (fbm(x * 0.04, y * 0.3, 85) - 0.5) * 0.3;
      const crev = Math.abs(noise(x * 0.028, y * 0.3, 87) - 0.5);
      if (crev < 0.03) v = 0.08;
      else if (crev < 0.055) v += 0.28;
      p.set(x, y, pick(fieldR, v, x, y, 0.25));
    }
  // seracs standing out of the glacier, the aurora green down their lit faces
  const spireR = ramp('#10264a', '#1a3a64', '#285484', '#3c78a2', '#5ea2c2', '#96d0de', '#d4f4f2', '#ffffff');
  const spireSnow = ramp('#5a7aa0', '#8aaac6', '#c2dcea', '#eefaff', '#ffffff');
  for (const [fx, hg, wd, cut] of [
    [0.3, 40, 13, 7],
    [0.36, 22, 8, -5],
    [0.55, 20, 9, -6],
    [0.67, 15, 7, 4],
    [0.84, 46, 14, -8],
    [0.89, 26, 9, 6],
  ] as const) {
    const x = Math.round(fx * w);
    const [tx, ty] = serac(p, x, G - 12, hg, wd, cut, spireR, spireSnow, Math.round(fx * 100));
    for (let y = ty + 1; y < G - 12; y++) {
      const t = (y - ty) / (G - 12 - ty);
      const xl = Math.round(x - (wd / 2) * (1 - (1 - t) * 0.22));
      for (let xx = xl; xx < xl + 2; xx++) if (hash(xx, y, 89) > 0.3 + t * 0.5) p.tint(xx, y, (c) => mix(c, col('#8affc8'), 0.32 * (1 - t)));
    }
    glints.push({ x: tx, y: ty, c: 0xe8fff4 });
  }
  // wind-carved snow behind the road: ridges of hard snow, chunks of ice
  const snowR = ramp('#36507a', '#4a6892', '#6484ac', '#86a6c6', '#aec8de', '#d6e8f2', '#f4fcff');
  const sTop = G - 12;
  for (let y = sTop; y < G - 7; y++)
    for (let x = 0; x < w; x++) {
      if (y === sTop && hash(x, y, 4) > 0.6) continue;
      const ridge = Math.sin(x * 0.16 + y * 0.9 + noise(x * 0.05, y, 91) * 6);
      const v = 0.44 + (y - sTop) * 0.05 + ridge * 0.18 + (fbm(x * 0.06, y * 0.3, 93) - 0.5) * 0.3;
      let c = pick(snowR, v, x, y, 0.25);
      if (ridge > 0.6 && y < sTop + 3) c = mix(c, col('#9affd0'), 0.18); // the aurora on the ridges' crests
      p.set(x, y, c);
    }
  for (let i = 0; i < 6; i++) {
    const x = Math.round(w * (0.12 + i * 0.15) + (rnd() - 0.5) * 16);
    serac(p, x, G - 8, 3 + Math.round(rnd() * 4), 4 + Math.round(rnd() * 3), (rnd() - 0.5) * 6, spireR, spireSnow, 120 + i);
  }

  // the road: snow-dusted blue ice, calm where the fighters stand, the aurora's green glancing off it
  const roadR = ramp('#1a2a4a', '#223658', '#2c4466', '#385474', '#466684', '#587a96', '#7092aa');
  const roadTop = G - 8;
  for (let y = roadTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = (y - roadTop) / (h - roadTop);
      let v = 0.56 - t * 0.14 + (fbm(x * 0.05, y * 0.3, 95) - 0.5) * 0.24;
      if ((y === G + 3 || y === G + 6) && noise(x * 0.14, y, 97) > 0.55) v += 0.16; // windblown snow lines
      let c = pick(roadR, v, x, y, 0.2);
      const sheen = noise(x * 0.035, y * 0.4, 99);
      if (sheen > 0.62 && (sheen - 0.62) * 5 > bay(x, y)) c = mix(c, col('#5ae0a8'), 0.18);
      p.set(x, y, c);
    }
  for (let x = 0; x < w; x++) {
    const len = 1 + Math.floor(noise(x * 0.3, 5, 101) * 2.2);
    for (let k = 0; k < len; k++) p.set(x, roadTop + k, k === len - 1 ? snowR[3] : snowR[5 + (hash(x, k, 3) > 0.7 ? 1 : 0)]);
    p.set(x, roadTop + len, roadR[0]);
  }
  for (let i = 0; i < 7; i++) {
    let x = Math.floor(rnd() * w);
    let y = G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    for (let k = 0; k < 5 + rnd() * 7; k++) {
      p.set(x, y, roadR[0]);
      p.set(x, y + 1, roadR[5]);
      x += 1;
      if (rnd() < 0.4) y += rnd() < 0.5 ? 1 : -1;
    }
  }
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rnd() * w);
    const y = rnd() < 0.35 ? G - 5 : G + 3 + Math.floor(rnd() * Math.max(1, h - G - 4));
    p.set(x, y, snowR[6]);
    p.set(x + 1, y, snowR[4]);
  }
  const edgeShade = col('#060a1c');
  for (let y = gTop; y < h; y++)
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x);
      if (e < 40) p.tint(x, y, (c) => fade(c, edgeShade, ((40 - e) / 40) ** 1.5 * 0.55, x, y, 3, 0.5));
    }

  // framing: a great serac at the left edge with something of the hoard sealed in it, a broken spire on the right
  const before = p.buf.slice();
  const wallR = ramp('#081430', '#0e2040', '#163054', '#204468', '#2c5a80', '#3e7498', '#5a92b2');
  const leftAt = (y: number) => (y < 6 + (y >> 3) ? -1 : Math.round(15 + noise(y * 0.06, 1, 103) * 7 + (y > G - 10 ? (y - (G - 10)) * 1.2 : 0)));
  const rightAt = (y: number) => (y < 22 ? Math.round(Math.max(0, (y - 8) * 1.1)) : Math.round(14 + noise(y * 0.07, 2, 103) * 7 + (y > G - 10 ? (y - (G - 10)) * 1.2 : 0)));
  for (let y = 0; y < G + 2; y++)
    for (let x = 0; x < w; x++) {
      const lw = leftAt(y);
      const rw = rightAt(y);
      const inL = x < lw;
      const inR = rw > 0 && x >= w - rw;
      if (!inL && !inR) continue;
      const k = inL ? lw - 1 - x : x - (w - rw);
      const fn = noise(x * 0.09 + y * 0.05, y * 0.07, inL ? 105 : 107) * 5;
      const fct = Math.floor(fn);
      let v = 0.2 + fct * 0.1 - Math.min(0.15, k * 0.01);
      if (fn - fct < 0.12 && k > 2) v += 0.3; // a facet's bright edge
      if (k === 1) v = 0.86;
      let c = pick(wallR, v, x, y, 0.2);
      if (k === 0) c = ink;
      else if (k === 2 && y < G - 4) c = mix(c, col('#7affc0'), 0.3); // the aurora on the lip
      p.set(x, y, c);
    }
  // coins and a chalice sealed in the left serac, dim gold through the blue
  const sealed = haze(goldR, col('#1a3456'), 0.45);
  for (let i = 0; i < 16; i++) {
    const cx = 2 + Math.floor(hash(i, 1, 109) * 10);
    const cy = G - 34 + Math.floor(hash(i, 2, 109) * 26);
    if (cx >= leftAt(cy) - 3) continue;
    p.set(cx, cy, sealed[4]);
    p.set(cx + 1, cy, sealed[3]);
    if (i % 3 === 0) glints.push({ x: cx, y: cy, c: 0xffd860 });
  }
  bitsAt(p, ['GgG', 'gyg', '.g.', '.g.', 'ggg'], { g: sealed[4], G: sealed[5], y: sealed[2] }, 5, G - 48);
  // snow on the serac's sheared top
  for (let x = 0; x < 30; x++) {
    let y = 0;
    while (y < G && x >= leftAt(y)) y++;
    if (y < G && y > 0) {
      p.set(x, y, col('#e8f4fc'));
      if (hash(x, y, 113) > 0.4) p.set(x, y + 1, col('#9ab8d4'));
    }
  }
  const frame = changed(p, before);
  return [p, frame, { torches: [], glints }];
}

/** A tiny hand-drawn bit ('.' transparent). */
function bitsAt(p: Pix, rows: string[], pal: Record<string, Col>, x: number, y: number): void {
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== '.' && pal[ch] !== undefined && p.set(x + i, y + j, pal[ch])));
}

// ------------------------------------------------------------------ foregrounds

/** A heap of snow along the bottom: a bumpy mound line (heavier in the corners), its top lit by the sky. */
function drift(p: Pix, w: number, h: number, L: FgLook, seed: number, cl = 90, cr = 46, lift = 6): void {
  const H = h + FG_OVERLAP;
  for (let x = 0; x < w; x++) {
    const c = cornerness(x, w, cl, cr);
    const top = Math.round(h - 1 - (1 + noise(x * 0.12, 1, seed) * 2.4 + c * c * lift + (noise(x * 0.4, 2, seed) - 0.5) * 1.2));
    for (let y = top; y < H; y++) p.set(x, y, y === top ? L.rim : y < top + 2 ? L.bush[3] : y < top + 4 ? L.bush[2] : L.bush[1]);
  }
}

/** Dry stalks poking out of the snow: tall in the corners, short and few where the fighters stand. */
function stalks(p: Pix, w: number, h: number, frame: number, L: FgLook, seed: number, tall = 1): void {
  for (let x = -2; x < w + 2; ) {
    const c = cornerness(x, w, 80, 40);
    const hgt = Math.round((2 + hash(x, 1, seed) * 3 + c * c * (6 + hash(x, 2, seed) * 9)) * tall);
    const sway = hgt >= 5 ? SWAY[(frame + Math.floor(hash(x, 3, seed) * 2 + x / 46)) % 4] * (hgt >= 11 ? 2 : 1) : 0;
    const lean = (hash(x, 4, seed) - 0.5) * 1.8;
    if (c > 0.15 || hash(x, 6, seed) > 0.7) blade(p, x, h + (c > 0.3 ? FG_OVERLAP - 1 : 0), hgt + (c > 0.3 ? FG_OVERLAP - 1 : 0), lean, sway, L, hgt >= 9);
    x += c > 0.3 ? 2 + Math.floor(hash(x, 5, seed) * 2) : 3 + Math.floor(hash(x, 5, seed) * 6);
  }
}

/** A rock in a bottom corner, snow heaped on its top. */
function snowRock(p: Pix, cx: number, base: number, rx: number, ry: number, L: FgLook, seed: number): void {
  for (let y = Math.floor(base - ry); y <= base; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - base) / ry;
      if (dx * dx + dy * dy > 1 + (noise(x * 0.4, y * 0.4, seed) - 0.5) * 0.3) continue;
      const v = 0.3 + 0.5 * lambert(dx, dy) + (noise(x * 0.5, y * 0.5, seed + 1) - 0.5) * 0.2;
      p.set(x, y, pick(L.bush, v, x, y));
    }
}

/** A dark sapling of a pine in a corner (its boughs sway with the frame). */
function sapling(p: Pix, x: number, base: number, hgt: number, frame: number, L: FgLook, seed: number): void {
  const r2 = rng(seed);
  const s = SWAY[(frame + 1) % 4];
  const bl: Blob[] = [];
  for (let t = 0; t < hgt; t += 2.2) {
    const f = t / hgt;
    const half = 1.5 + (1 - f) * hgt * 0.32;
    bl.push({ x: x + s * f * 2 - half * 0.45, y: base - t - 1, rx: half * 0.7, ry: 1.6 });
    bl.push({ x: x + s * f * 2 + half * 0.45, y: base - t - 0.5 + r2() * 0.5, rx: half * 0.7, ry: 1.6 });
  }
  mass(p, bl, { ramp: L.bush, seed, bump: 0.35, tex: 0.3, vgrad: 0.3, shadow: 0.25, outline: L.ink });
}

function foregroundFrost(theme: FrostTheme, w: number, h: number, frame: number): Pix {
  const H = h + FG_OVERLAP;
  const p = new Pix(w, H, -1);
  const ink = col('#04040a');
  let rim = col('#b8c8e8');
  let mid = col('#3a4670');
  if (theme === 'pass') {
    const L: FgLook = { blade: ramp('#06060e', '#0e1020', '#181c32', '#242a46'), rim: col('#9aa8cc'), bush: ramp('#04050c', '#080a18', '#0e1224', '#161c34', '#222a48', '#323c60'), ink };
    drift(p, w, h, L, 17, 96, 50, 8);
    snowRock(p, 10, H, 16, 12, L, 3);
    snowRock(p, 26, H, 9, 6, L, 4);
    snowRock(p, w - 6, H, 12, 10, L, 5);
    sapling(p, 40, H - 2, 16, frame, L, 7);
    sapling(p, w - 26, H - 1, 11, frame, L, 8);
    stalks(p, w, h, frame, L, 21);
    rim = col('#c8d4f0');
    mid = col('#6a76a6');
  } else if (theme === 'caves') {
    const L: FgLook = { blade: ramp('#04040c', '#0a0c1c', '#12162c', '#1c2240'), rim: col('#3e7ca0'), bush: ramp('#020208', '#05060f', '#0a0c1c', '#10142a', '#181e3a', '#24304e'), ink };
    // a ledge of broken rock along the bottom, boulders and dark crystal shards in the corners
    drift(p, w, h, L, 23, 90, 50, 6);
    snowRock(p, 8, H, 15, 13, L, 31);
    snowRock(p, 25, H, 8, 6, L, 32);
    snowRock(p, w - 8, H, 14, 11, L, 33);
    shard(p, 31, H - 3, 15, 5, 0.28, L.bush, 0);
    shard(p, 38, H - 1, 8, 3, 0.55, L.bush, 0);
    shard(p, w - 25, H - 2, 13, 4, -0.32, L.bush, 0);
    shard(p, w - 31, H - 1, 7, 3, -0.6, L.bush, 0);
    for (let i = 0; i < 7; i++) pebble(p, 50 + Math.floor(hash(i, 4, 57) * (w - 100)), h - 1 + (i % 3 === 0 ? 2 : 0), 1 + (i % 2), 1, L.bush, ink);
    rim = col('#4e94b8');
    mid = col('#24486e');
  } else {
    const L: FgLook = { blade: ramp('#04060e', '#0a1020', '#121a32', '#1c2846'), rim: col('#5a9c98'), bush: ramp('#02040a', '#050a16', '#0a1224', '#101c36', '#1a2a4a', '#26405e'), ink };
    // drifts of snow along the bottom, jagged shards of ice heaved up in the corners
    drift(p, w, h, L, 29, 96, 50, 8);
    shard(p, 12, H, 24, 8, 0.14, L.bush, 0);
    shard(p, 24, H, 13, 5, 0.42, L.bush, 0);
    shard(p, 4, H, 15, 6, -0.1, L.bush, 0);
    shard(p, w - 12, H, 19, 7, -0.2, L.bush, 0);
    shard(p, w - 23, H, 9, 4, -0.5, L.bush, 0);
    snowRock(p, 40, H + 1, 7, 4, L, 41);
    rim = col('#6ab8a8');
    mid = col('#285a64');
  }
  backlight(p, rim, mid, theme.length);
  return p;
}

// ------------------------------------------------------------------ build

const PAINT: Record<FrostTheme, (w: number, h: number, G: number) => [Pix, Pix, Backdrop]> = {
  pass,
  caves,
  glacier,
};

/** Paint one Frostpeaks theme's backdrop textures for the current layout (stage height h, feet line `ground`). */
export function buildFrostBackdrop(scene: Phaser.Scene, theme: FrostTheme, w: number, h: number, ground: number): Backdrop {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  const [bg, frame, info] = PAINT[theme](w, h, ground);
  add(`bg_${theme}`, bg.canvas());
  add(`frame_${theme}`, frame.canvas());
  for (let f = 0; f < FG_FRAMES; f++) {
    const fg = foregroundFrost(theme, w, h, f);
    const top = new Pix(w, h, -1);
    top.buf.set(fg.buf.subarray(0, w * h));
    const over = new Pix(w, FG_OVERLAP, -1);
    over.buf.set(fg.buf.subarray(w * h));
    add(`fg_${theme}_${f}`, top.canvas());
    add(`fgo_${theme}_${f}`, over.canvas());
  }
  return info;
}

