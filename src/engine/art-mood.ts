// The mood pass on the fight stages (playtest round 8, decisions L7 and A2C-1): every painted layer of an act's stage
// (backdrop, framing, foreground) goes through one grade per theme, baked into the pixels once when the stage is
// painted (never per frame). Unlike a flat multiply, the grade reads each colour:
//   - midtones lose some saturation and take a cool multiply (the theme's shade colour): values come down ~20-35%;
//   - the darkest tones lean toward a deep cool shadow (indigo, teal), so shadows read as shade, not as black paint;
//   - bright saturated colours (fire, lava, the sun, lanterns, crystals, the aurora) keep their light: warm light stays
//     an accent, and a ramp's tones stay apart (it is a smooth map, so 3+ hue-shifted tones stay 3+);
//   - the strip the fighters stand on takes an extra, calm darkening (the actors own the brightest values).
// A layer's sky is usually repainted for the mood directly and left out of the grade (`skip`).
import type { Col, Pix, Theme } from './backdrop';

export interface Mood {
  /** Multiply on everything that isn't a light (cool; its value sets how much darker the scene gets). */
  tint: Col;
  /** 0..1: how much midtone saturation goes (lights keep theirs). */
  desat: number;
  /** 0..1: how much a bright, saturated colour escapes the tint and the desaturation (fire, sun, crystals). */
  keep: number;
  /** The deep cool colour the darkest tones lean toward, and how far (0..1, at black). */
  shadow: Col;
  shadowAmt: number;
  /** The ground strip under the fighters (from a few px above the feet line down): an extra multiply, its strength. */
  ground: Col;
  groundAmt: number;
}

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** One colour through a mood's grade (no ground term). */
export function moodColour(c: Col, m: Mood): Col {
  let r = ((c >> 16) & 255) / 255;
  let g = ((c >> 8) & 255) / 255;
  let b = (c & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx > 0 ? (mx - mn) / mx : 0;
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  // a light: bright and saturated (or very bright): it keeps its colour
  const k = m.keep * Math.max(ss(0.55, 0.9, mx) * ss(0.28, 0.6, sat), ss(0.9, 1, L) * 0.6);
  const ds = m.desat * (1 - k);
  r = L + (r - L) * (1 - ds);
  g = L + (g - L) * (1 - ds);
  b = L + (b - L) * (1 - ds);
  const tr = ((m.tint >> 16) & 255) / 255;
  const tg = ((m.tint >> 8) & 255) / 255;
  const tb = (m.tint & 255) / 255;
  r *= tr + (1 - tr) * k;
  g *= tg + (1 - tg) * k;
  b *= tb + (1 - tb) * k;
  // the darks take the theme's shadow hue at their own value (a hue shift, never a lift)
  const d = m.shadowAmt * (1 - ss(0.05, 0.32, L)) * (1 - k);
  if (d > 0) {
    const sr = ((m.shadow >> 16) & 255) / 255;
    const sg = ((m.shadow >> 8) & 255) / 255;
    const sb = (m.shadow & 255) / 255;
    const L2 = 0.299 * r + 0.587 * g + 0.114 * b;
    const f = L2 / Math.max(0.01, 0.299 * sr + 0.587 * sg + 0.114 * sb);
    r += (sr * f - r) * d;
    g += (sg * f - g) * d;
    b += (sb * f - b) * d;
  }
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

/**
 * Grade a painted layer in place. `G` is the feet line (the ground term starts a few px above it); `skip` is left as
 * painted: a set of colours (a sky repainted for the mood), or a snapshot of the layer taken once its sky was done
 * (every pixel still as it was then). Transparent pixels (-1) stay transparent.
 */
export type Skip = ReadonlySet<Col> | Int32Array;
export function moodGrade(p: Pix, m: Mood, G: number, skip?: Skip): void {
  const snap = skip instanceof Int32Array ? skip : null;
  const set = skip instanceof Int32Array ? null : skip;
  const cache = new Map<Col, Col>();
  const gr = ((m.ground >> 16) & 255) / 255;
  const gg = ((m.ground >> 8) & 255) / 255;
  const gb = (m.ground & 255) / 255;
  for (let y = 0; y < p.h; y++) {
    const gk = m.groundAmt * ss(G - 9, G - 1, y);
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      const c = p.buf[i];
      if (c < 0 || set?.has(c) || (snap && snap[i] === c)) continue;
      let o = cache.get(c);
      if (o === undefined) {
        o = moodColour(c, m);
        cache.set(c, o);
      }
      if (gk > 0) {
        const r = (o >> 16) & 255;
        const g = (o >> 8) & 255;
        const b = o & 255;
        o = (Math.round(r * (1 - gk + gk * gr)) << 16) | (Math.round(g * (1 - gk + gk * gg)) << 8) | Math.round(b * (1 - gk + gk * gb));
      }
      p.buf[i] = o;
    }
  }
}

/** Each act's grade (Greenmarch, the Frostpeaks, Ashfell; later regions paint their mood in). */
export const MOOD: Partial<Record<Theme, Mood>> = {
  // late day in the woods: deep teal shade, the gold only where the low sun gets through
  forest: { tint: 0x9aa6c4, desat: 0.3, keep: 0.6, shadow: 0x0c1c2c, shadowAmt: 0.6, ground: 0x7c7a96, groundAmt: 0.42 },
  // a rainy dusk: the stones wet and blue, the braziers warm
  ruins: { tint: 0xb8c0da, desat: 0.22, keep: 0.85, shadow: 0x080e20, shadowAmt: 0.5, ground: 0x7a84a8, groundAmt: 0.38 },
  // a blood-red evening: the crimson kept in the sky and the light; the midtones and shade lean plum-indigo (A2C-10),
  // so the far planes sit back cool and the ground under the feet is calm and cool
  hollow: { tint: 0xa494b4, desat: 0.26, keep: 0.45, shadow: 0x120a26, shadowAmt: 0.6, ground: 0x5e5a80, groundAmt: 0.5 },
  // a blue night on the pass: the snow under the moon, the flags' colours faded
  pass: { tint: 0x7a8cc4, desat: 0.4, keep: 0.4, shadow: 0x0c1636, shadowAmt: 0.55, ground: 0x7884b4, groundAmt: 0.36 },
  // the caves colder and darker; the crystals keep their glow
  caves: { tint: 0xa8b2d8, desat: 0.18, keep: 0.95, shadow: 0x060a20, shadowAmt: 0.5, ground: 0x8890b8, groundAmt: 0.3 },
  // night under the aurora
  glacier: { tint: 0xa8b4d8, desat: 0.16, keep: 0.9, shadow: 0x081028, shadowAmt: 0.5, ground: 0x8a94bc, groundAmt: 0.3 },
  // smoke over the flats: the plain dark, the lava and the volcano's fire kept
  cinder: { tint: 0xa4909e, desat: 0.24, keep: 0.95, shadow: 0x140a14, shadowAmt: 0.45, ground: 0x80687a, groundAmt: 0.36 },
  // the warrens a step darker; the lake and the glass keep their light
  glass: { tint: 0xb0a4c4, desat: 0.14, keep: 0.95, shadow: 0x0c0818, shadowAmt: 0.45, ground: 0x887894, groundAmt: 0.3 },
  // the forge in smoke; the fires stay
  forge: { tint: 0xa8969e, desat: 0.16, keep: 0.95, shadow: 0x140608, shadowAmt: 0.45, ground: 0x887078, groundAmt: 0.32 },
};

/** Grade a theme's layer if it has a mood (no-op otherwise). */
export function gradeLayer(theme: Theme, p: Pix, G: number, skip?: Skip): void {
  const m = MOOD[theme];
  if (m) moodGrade(p, m, G, skip);
}

/**
 * The act maps' mood (decision L7, A2C-6): the same kind of grade on the landscape the player looks at between fights,
 * a little lighter than the stages (the map is read, not watched), with its roads and clearings graded only part way
 * so the route stays a lit thread through the dusk. The nodes, tags and roamers are drawn over it at full value.
 */
export const MAP_MOOD: Partial<Record<Theme, Mood>> = {
  // (A2C-12) the first map anyone sees: a step darker and cooler than before, the lime gone out of the meadow
  forest: { tint: 0x6a78a4, desat: 0.48, keep: 0.5, shadow: 0x0a1828, shadowAmt: 0.6, ground: 0xffffff, groundAmt: 0 },
  ruins: { tint: 0xb4bcd6, desat: 0.2, keep: 0.85, shadow: 0x080e20, shadowAmt: 0.45, ground: 0xffffff, groundAmt: 0 },
  hollow: { tint: 0x9c7a8c, desat: 0.26, keep: 0.4, shadow: 0x1a0818, shadowAmt: 0.5, ground: 0xffffff, groundAmt: 0 },
  pass: { tint: 0x6c80bc, desat: 0.46, keep: 0.4, shadow: 0x101838, shadowAmt: 0.5, ground: 0xffffff, groundAmt: 0 },
  caves: { tint: 0xb0b8dc, desat: 0.16, keep: 0.95, shadow: 0x060a20, shadowAmt: 0.45, ground: 0xffffff, groundAmt: 0 },
  glacier: { tint: 0x7c8cc0, desat: 0.28, keep: 0.9, shadow: 0x081028, shadowAmt: 0.5, ground: 0xffffff, groundAmt: 0 },
  cinder: { tint: 0xa8949e, desat: 0.22, keep: 0.95, shadow: 0x140a14, shadowAmt: 0.45, ground: 0xffffff, groundAmt: 0 },
  glass: { tint: 0xb8acc8, desat: 0.14, keep: 0.95, shadow: 0x0c0818, shadowAmt: 0.4, ground: 0xffffff, groundAmt: 0 },
  forge: { tint: 0xb0a0a8, desat: 0.14, keep: 0.95, shadow: 0x140608, shadowAmt: 0.4, ground: 0xffffff, groundAmt: 0 },
};

/** Grade an act map's landscape frame; `road` marks the roads and clearings (non-zero), graded `roadAmt` of the way. */
export function gradeMap(theme: Theme, p: Pix, road: Uint8Array, roadAmt = 0.55, cache = new Map<Col, Col>()): void {
  const m = MAP_MOOD[theme];
  if (!m) return;
  for (let i = 0; i < p.buf.length; i++) {
    const c = p.buf[i];
    if (c < 0) continue;
    let o = cache.get(c);
    if (o === undefined) {
      o = moodColour(c, m);
      cache.set(c, o);
    }
    if (road[i]) {
      const t = roadAmt;
      o =
        (Math.round(((c >> 16) & 255) + (((o >> 16) & 255) - ((c >> 16) & 255)) * t) << 16) |
        (Math.round(((c >> 8) & 255) + (((o >> 8) & 255) - ((c >> 8) & 255)) * t) << 8) |
        Math.round((c & 255) + ((o & 255) - (c & 255)) * t);
    }
    p.buf[i] = o;
  }
}
