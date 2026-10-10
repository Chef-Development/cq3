// The sharper chest reveal's other pieces on the finer grid (view/chest-hd.ts): the rarity ribbon, the tags under the
// name, the eight tier gems, stars, the shard crystal, the fast-forward chevron, and the light: a ray wedge, the
// starburst in frames, a twinkle. Hard pixels only (no smoothing, no blur): ramps lit from the top left, a 1 px ink
// outline. Each is painted on first use and cached (by its size and colours).

const INK = 0x140c1c;

export type Face4 = readonly [number, number, number, number];

const css = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
export const mixRgb = (a: number, b: number, k: number): number => {
  const t = Math.max(0, Math.min(1, k));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** A small raster of colours (null = clear) painted to a canvas with an optional ink outline. */
class Raster {
  readonly c: Array<number | null>;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new Array<number | null>(w * h).fill(null);
  }
  set(x: number, y: number, col: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col;
  }
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.c[y * this.w + x] !== null;
  }
  canvas(outline = true, shadow = false): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const im = ctx.createImageData(this.w, this.h);
    const put = (x: number, y: number, col: number, a = 255) => {
      const i = (y * this.w + x) * 4;
      im.data[i] = (col >> 16) & 255;
      im.data[i + 1] = (col >> 8) & 255;
      im.data[i + 2] = col & 255;
      im.data[i + 3] = a;
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const col = this.c[y * this.w + x];
        if (col !== null) put(x, y, col);
        else if (outline && (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1))) put(x, y, INK);
        else if (shadow && (this.has(x, y - 2) || this.has(x - 1, y - 2) || this.has(x + 1, y - 2))) put(x, y, INK, 110);
      }
    ctx.putImageData(im, 0, 0);
    return cv;
  }
}

const cache = new Map<string, HTMLCanvasElement>();
function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 160) cache.clear();
    c = make();
    cache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------------ the rarity ribbon

/**
 * A ribbon banner w x h (fine px) in a tier's colours: a band lit along its top with a sheen, darker toward its foot,
 * gold-beaded edges, and a tail folded behind each end with a V notch. The canvas is wider than w by the tails (TAIL
 * each side) and taller by its shadow; the band's top-left is at (TAIL, 1).
 */
export const RIBBON_TAIL = 16;
export function hdRibbon(w: number, h: number, face: Face4): HTMLCanvasElement {
  return cached(`rib|${w}|${h}|${face.join(',')}`, () => {
    const T = RIBBON_TAIL;
    const r = new Raster(w + T * 2, h + 10);
    const [hi, base, lo, deep] = face;
    // the tails: lower than the band, darker, a V cut into their outer ends, a fold where they tuck behind
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 1 : T + w - 6;
      const x1 = side < 0 ? T + 6 : T * 2 + w - 2;
      for (let y = 7; y < h + 7; y++) {
        const mid = Math.abs(y - (7 + (h - 1) / 2)) / ((h - 1) / 2);
        const notch = Math.round((1 - mid) * 7);
        for (let x = x0; x <= x1; x++) {
          const out = side < 0 ? x - x0 : x1 - x;
          if (out < notch) continue;
          const row = y - 7;
          let c = row < 2 ? mixRgb(lo, base, 0.4) : row >= h - 3 ? deep : lo;
          if (out === notch && row > 1 && row < h - 2) c = mixRgb(lo, deep, 0.5);
          r.set(x, y, c);
        }
      }
      // the fold: a dark wedge where the tail tucks under the band
      const fx = side < 0 ? T : T + w - 6;
      for (let y = h - 1; y < h + 6; y++) for (let x = fx; x < fx + 6; x++) if ((side < 0 ? x - fx : fx + 5 - x) <= y - (h - 1)) r.set(x, y + 1, mixRgb(deep, INK, 0.45));
    }
    // the band
    for (let y = 1; y <= h; y++)
      for (let x = T; x < T + w; x++) {
        const row = y - 1;
        let c: number;
        if (row === 0) c = mixRgb(hi, 0xffffff, 0.35);
        else if (row <= 2) c = hi;
        else if (row < h * 0.55) c = mixRgb(hi, base, 0.55);
        else if (row < h - 4) c = base;
        else if (row < h - 2) c = lo;
        else c = deep;
        // its edges catch the light on the left, sink on the right
        if (x === T) c = mixRgb(c, 0xffffff, 0.25);
        if (x === T + w - 1) c = mixRgb(c, deep, 0.5);
        r.set(x, y, c);
      }
    // a sheen: a slanted bright stripe and a thinner one, toward the left
    for (let y = 2; y < h - 2; y++)
      for (const [o, ww, k] of [
        [10, 4, 0.28],
        [17, 2, 0.16],
      ] as const)
        for (let i = 0; i < ww; i++) {
          const x = T + o + i + (h - y);
          const at = r.c[y * r.w + x];
          if (at !== null && at !== undefined) r.set(x, y, mixRgb(at, 0xffffff, k));
        }
    // gold beads along the top and bottom edges
    for (let x = T + 4; x < T + w - 3; x += 6) {
      r.set(x, 2, 0xfff0a8);
      r.set(x, h - 1, mixRgb(deep, 0xffd866, 0.5));
    }
    return r.canvas(true, true);
  });
}

// ------------------------------------------------------------------ tags and chips

/** A rounded tag (w x h fine px) in a ramp: lit top rows, a base, a deep foot, 2 px corners, an ink outline. */
export function hdTag(w: number, h: number, face: Face4, shadow = true): HTMLCanvasElement {
  return cached(`tag|${w}|${h}|${face.join(',')}|${shadow ? 1 : 0}`, () => {
    const r = new Raster(w + 2, h + (shadow ? 4 : 2));
    const [hi, base, lo, deep] = face;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const cx = Math.min(x, w - 1 - x);
        const cy = Math.min(y, h - 1 - y);
        if (cx + cy < 2) continue;
        let c = y === 0 ? mixRgb(hi, 0xffffff, 0.3) : y < 3 ? hi : y < h - 3 ? base : y < h - 1 ? lo : deep;
        if (x === 0 && y > 1 && y < h - 2) c = mixRgb(c, 0xffffff, 0.2);
        if (x === w - 1 && y > 1) c = mixRgb(c, deep, 0.5);
        r.set(x + 1, y + 1, c);
      }
    return r.canvas(true, shadow);
  });
}

// ------------------------------------------------------------------ the tier gems (the row under the top bar)

/** One tier's gem, 14 x 14 fine px plus its outline: an octagonal cut, facets lit from the top left. Unlit: slate. */
export function hdTierGem(face: Face4 | null): HTMLCanvasElement {
  return cached(`gem|${face ? face.join(',') : 'off'}`, () => {
    const S = 14;
    const r = new Raster(S + 2, S + 4);
    const [hi, base, lo, deep] = face ?? [0x4a4060, 0x2e2640, 0x241c34, 0x16121e];
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const cx = Math.min(x, S - 1 - x);
        const cy = Math.min(y, S - 1 - y);
        if (cx + cy < 3) continue;
        const dx = x + 0.5 - S / 2;
        const dy = y + 0.5 - S / 2;
        let c: number;
        if (Math.abs(dx) < 2.6 && Math.abs(dy) < 2.6) c = face ? mixRgb(hi, base, 0.35) : base; // the table
        else if (dy < -2 && Math.abs(dx) <= -dy + 0.5) c = face ? hi : mixRgb(hi, base, 0.3);
        else if (dx < -2) c = face ? mixRgb(hi, base, 0.6) : base;
        else if (dx > 2 && Math.abs(dy) < dx) c = lo;
        else c = deep;
        // the cut's girdle: a darker ring just inside the edge
        if (cx + cy === 3 || cx === 0 || cy === 0) c = mixRgb(c, deep, 0.55);
        r.set(x + 1, y + 1, c);
      }
    if (face) {
      r.set(4, 4, 0xffffff);
      r.set(5, 4, mixRgb(hi, 0xffffff, 0.6));
      r.set(4, 5, mixRgb(hi, 0xffffff, 0.6));
    }
    return r.canvas(true, true);
  });
}

// ------------------------------------------------------------------ stars, the shard, the chevron

/** A five-point star 17 x 17 fine px (gold when lit, a dark socket when not). */
export function hdStar(lit: boolean): HTMLCanvasElement {
  return cached(`star|${lit ? 1 : 0}`, () => {
    const S = 17;
    const r = new Raster(S + 2, S + 4);
    const cx = S / 2;
    const cy = S / 2 + 0.8;
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const a = Math.atan2(dy, dx) + Math.PI / 2;
        const k = Math.abs(((((a / (Math.PI * 2)) * 5) % 1) + 1) % 1 - 0.5) * 2; // 1 at a point, 0 between
        const rad = 3.4 + 4.9 * Math.pow(k, 1.6);
        const d = Math.hypot(dx, dy);
        if (d > rad) continue;
        let c: number;
        if (!lit) c = d > rad - 1.2 ? 0x3a3050 : 0x241c34;
        else {
          const litSide = dx * 0.6 + dy < 0;
          c = d > rad - 1.1 ? 0xb06a14 : litSide ? (d < 3 ? 0xfff6c8 : 0xffe070) : d < 3 ? 0xffd040 : 0xf2a828;
        }
        r.set(x + 1, y + 1, c);
      }
    if (lit) r.set(7, 7, 0xffffff);
    return r.canvas(true, true);
  });
}

/** The shard: a violet crystal splinter 12 x 18 fine px. */
export function hdShard(): HTMLCanvasElement {
  return cached('shard', () => {
    const r = new Raster(14, 22);
    const rows = [
      '.....aa.....',
      '....abba....',
      '....abbc....',
      '...abbbcc...',
      '...abbbcc...',
      '..abbbbccd..',
      '..abbbbccd..',
      '..abbbbccd..',
      '.aabbbbcccd.',
      '.aabbbbcccd.',
      '.abbbbbcccd.',
      '..abbbbccd..',
      '..abbbbccd..',
      '...abbbcd...',
      '...abbccd...',
      '....abcd....',
      '....abcd....',
      '.....cd.....',
    ];
    const pal: Record<string, number> = { a: 0xf0d8ff, b: 0xc08af0, c: 0x8a4ad0, d: 0x4a2080 };
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && r.set(x + 1, y + 1, pal[ch])));
    r.set(5, 4, 0xffffff);
    r.set(5, 5, 0xffffff);
    return r.canvas(true, true);
  });
}

/** The fast-forward chevron (one "›"), 9 x 14 fine px. */
export function hdChevron(col: number): HTMLCanvasElement {
  return cached(`chev|${col}`, () => {
    const r = new Raster(11, 18);
    for (let y = 0; y < 14; y++) {
      const d = y < 7 ? y : 13 - y;
      for (let i = 0; i < 4; i++) r.set(1 + d + i, y + 1, i === 0 ? mixRgb(col, 0xffffff, 0.5) : y < 7 ? col : mixRgb(col, 0x806040, 0.35));
    }
    return r.canvas(true, true);
  });
}

// ------------------------------------------------------------------ the light

/** One ray: a long thin wedge from its apex at (0, h / 2) out to length `len`, half-angle `ang`. White, hard-edged. */
export function hdRay(len: number, ang: number): HTMLCanvasElement {
  return cached(`ray|${len}|${ang}`, () => {
    const hw = Math.ceil(Math.tan(ang) * len) + 1;
    const c = document.createElement('canvas');
    c.width = len;
    c.height = hw * 2;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x < len; x++) {
      const half = Math.round(Math.tan(ang) * (x + 0.5));
      if (half <= 0) continue;
      ctx.fillRect(x, hw - half, 1, half * 2);
    }
    return c;
  });
}

/** The burst: a bold 12-point starburst of radius `rad` (long and short rays by turns, a round heart). White. It is
 *  symmetric about both axes: one quarter is worked out and drawn four times. */
export function hdBurst(rad: number): HTMLCanvasElement {
  return cached(`burst|${rad}`, () => {
    const n = rad * 2 + 2;
    const h = n / 2;
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    const R = rad;
    const inside = (x: number, y: number) => {
      const dx = x + 0.5 - h;
      const dy = y + 0.5 - h;
      const a = Math.atan2(dy, dx) + Math.PI / 12;
      const f = ((((a / (Math.PI * 2)) * 12) % 12) + 12) % 12;
      const ph = f % 1;
      const tip = Math.floor(f) % 2 === 0 ? R : R * 0.68;
      const r = R * 0.42 + (tip - R * 0.42) * Math.max(0, 1 - Math.abs(ph - 0.5) * 2) ** 0.9;
      return dx * dx + dy * dy <= r * r;
    };
    // the bottom-right quarter in runs, mirrored to the other three
    for (let y = h; y < n; y++) {
      let run = -1;
      for (let x = h; x <= n; x++) {
        const on = x < n && inside(x, y);
        if (on && run < 0) run = x;
        else if (!on && run >= 0) {
          const w = x - run;
          const my = n - 1 - y;
          ctx.fillRect(run, y, w, 1);
          ctx.fillRect(n - run - w, y, w, 1);
          ctx.fillRect(run, my, w, 1);
          ctx.fillRect(n - run - w, my, w, 1);
          run = -1;
        }
      }
    }
    return c;
  });
}

/** The burst's frames: the radii it steps through as it grows (a frame animation, not a smooth scale). */
export const BURST_RADII = [14, 24, 36, 50, 66, 84, 104, 126, 150, 176, 204, 234];

/** A twinkle: a four-point sparkle `size` 1..3 (arms 1, 2 or 4 px), as a canvas in one colour. */
export function hdTwinkle(size: number, col: number): HTMLCanvasElement {
  return cached(`tw|${size}|${col}`, () => {
    const arm = size >= 3 ? 4 : size;
    const n = arm * 2 + 3;
    const c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const ctx = c.getContext('2d')!;
    const m = Math.floor(n / 2);
    ctx.fillStyle = css(col);
    ctx.fillRect(m - arm, m, arm * 2 + 1, 1);
    ctx.fillRect(m, m - arm, 1, arm * 2 + 1);
    if (size >= 2) ctx.fillRect(m - 1, m - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(m, m, 1, 1);
    return c;
  });
}
