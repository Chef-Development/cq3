// The sharper chest reveal's lettering (view/chest-hd.ts): the game's own bold and small pixel fonts (font.ts) re-drawn
// on the finer grid. Each glyph's fill is doubled with Scale2x (EPX), which keeps every stem and spacing but rounds the
// stair-steps of curves and diagonals (once for 2x detail, twice for 4x), then gets a 3-tone ramp (lit top, deeper
// bottom), a 1 fine-px ink outline and a drop shadow (or an extrusion for the big name). Same shapes and widths as
// the game's text, at twice the detail: a level-1 text has 14 fine px caps (= bold scale 1, 7 game px at k = 2), a
// level-2 text 28 (= bold scale 2). Dark ink on a light surface drops the outline (like font.ts's plain twins).
//
// The masks are pure (unit-tested); hdText paints a cached canvas (DOM).
import { glyphMask } from './font';

export interface Mask {
  w: number;
  h: number;
  on: (x: number, y: number) => boolean;
}

/** Scale2x (EPX): every pixel becomes 2x2; a corner takes the neighbours' value where the two beside it agree. */
export function scale2x(m: Mask): Mask {
  const w = m.w * 2;
  const h = m.h * 2;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const p = m.on(x, y);
      const a = m.on(x, y - 1); // up
      const b = m.on(x + 1, y); // right
      const c = m.on(x - 1, y); // left
      const d = m.on(x, y + 1); // down
      const e1 = c === a && c !== d && a !== b ? a : p;
      const e2 = a === b && a !== c && b !== d ? b : p;
      const e3 = d === c && d !== b && c !== a ? c : p;
      const e4 = b === d && b !== a && d !== c ? d : p;
      const i = y * 2 * w + x * 2;
      out[i] = e1 ? 1 : 0;
      out[i + 1] = e2 ? 1 : 0;
      out[i + w] = e3 ? 1 : 0;
      out[i + w + 1] = e4 ? 1 : 0;
    }
  return { w, h, on: (x, y) => x >= 0 && y >= 0 && x < w && y < h && out[y * w + x] === 1 };
}

/** Bold caps 7 px, small caps 5 px (font.ts). */
const CAP = { bold: 7, small: 5 };

/** A line's fill on the fine grid: the game font's glyphs doubled `level` times (1: 2x, 2: 4x). */
export function hdTextMask(s: string, level: 1 | 2 = 1, bold = true): Mask & { cap: number } {
  let m: Mask = glyphMask(s, bold);
  for (let i = 0; i < level; i++) m = scale2x(m);
  return { ...m, cap: (bold ? CAP.bold : CAP.small) << level };
}

export interface HdTextStyle {
  /** 1: 2x detail (14 fine px bold caps), 2: 4x (28). */
  level?: 1 | 2;
  bold?: boolean;
  /** The fill's colour, and the deep one its ramp sinks toward (and the extrusion). */
  color: number;
  deep?: number;
  /** Dark ink on a light surface: no outline, no shadow. */
  plain?: boolean;
  /** Extrusion depth in fine px (the big name), in `deep`. */
  extrude?: number;
}

export interface HdTextImage {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** The cap line's row in the canvas (under the outline). */
  capTop: number;
  cap: number;
}

const INK = '#140c1c';
const css = (c: number) => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const mixC = (a: number, b: number, k: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The fill's tone for row y (0 = the cap line) of a text with `cap` px caps: a bright top edge, light, base, deep. */
export function rampRow(y: number, cap: number, color: number, deep: number): number {
  const k = y / cap;
  if (y === 0) return mixC(color, 0xffffff, 0.55);
  if (k < 0.42) return mixC(color, 0xffffff, 0.2);
  if (k < 0.72) return color;
  if (k < 1) return mixC(color, deep, 0.32);
  return mixC(color, deep, 0.5); // descenders
}

const cache = new Map<string, HdTextImage>();

/** A text's image on the fine grid (cached). */
export function hdText(s: string, st: HdTextStyle): HdTextImage {
  const level = st.level ?? 1;
  const bold = st.bold ?? true;
  const deep = st.deep ?? mixC(st.color, 0x140c1c, 0.6);
  const ext = st.plain ? 0 : (st.extrude ?? 0);
  const key = `${s}|${level}|${bold ? 1 : 0}|${st.color}|${deep}|${st.plain ? 1 : 0}|${ext}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const m = hdTextMask(s, level, bold);
  const pad = st.plain ? 0 : 1;
  const shadow = st.plain ? 0 : ext > 0 ? ext : 1;
  const w = Math.max(1, m.w + pad * 2);
  const h = m.h + pad * 2 + shadow;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const fill = (x: number, y: number) => m.on(x - pad, y - pad);
  // the extrusion (or shadow) under the fill, then the ink round both
  const body = (x: number, y: number) => {
    if (fill(x, y)) return true;
    for (let d = 1; d <= ext; d++) if (fill(x, y - d)) return true;
    return false;
  };
  if (!st.plain) {
    ctx.fillStyle = INK;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (body(x, y)) continue;
        const near = body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1);
        // the drop shadow: one row under the outlined shape
        const under = ext === 0 && (body(x, y - 1) || body(x - 1, y - 1) || body(x + 1, y - 1) || body(x, y - 2));
        if (near || under) ctx.fillRect(x, y, 1, 1);
      }
    if (ext > 0) {
      ctx.fillStyle = css(deep);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!fill(x, y) && body(x, y)) ctx.fillRect(x, y, 1, 1);
    }
  }
  for (let y = 0; y < m.h; y++) {
    ctx.fillStyle = css(st.plain ? st.color : rampRow(y, m.cap, st.color, deep));
    for (let x = 0; x < m.w; x++) if (m.on(x, y)) ctx.fillRect(x + pad, y + pad, 1, 1);
  }
  const img = { canvas: c, w, h, capTop: pad, cap: m.cap };
  if (cache.size > 300) cache.clear();
  cache.set(key, img);
  return img;
}

/** A text's width on the fine grid (outline included), without painting it. */
export function hdTextW(s: string, level: 1 | 2 = 1, bold = true, plain = false): number {
  return glyphMask(s, bold).w * (1 << level) + (plain ? 0 : 2);
}
