// Original pixel fonts, rasterized at boot into canvas textures and registered as Phaser bitmap fonts.
// Two fonts:
//   FONT_BOLD ('pxb'), the display font: caps 7 px, x-height 5, descenders 2, 2 px stems.
//   FONT ('px'), the small label font: caps 5 px, x-height 4, descenders 1, 2 px stems.
// Both are mixed case and proportional (digits are tabular), with a baked 1 px dark outline all around
// each glyph plus a 1 px drop shadow under it (so the bottom edge reads 2 px thick). Neighbouring
// letters share one column of outline, so fills sit GAP = 1 px apart.
// Glyph fills are pure white: BitmapText tint (multiply) recolors the fill and keeps the outline dark.
// Text box (what Phaser measures, what origins refer to): top outline + caps + bottom outline + shadow,
// i.e. FONT_BOLD_H = 10 and FONT_H = 8 at scale 1; descenders hang below the box.
import type Phaser from 'phaser';

export const FONT = 'px';
export const FONT_BOLD = 'pxb';

const INK = '#140c1c';
/** Pixels of dark ink between the fills of neighbouring letters (their outlines overlap). */
const GAP = 1;

interface Metrics {
  cap: number; // cap height, also the ascender height
  xh: number; // x-height
  desc: number; // descender depth
}
const BOLD_M: Metrics = { cap: 7, xh: 5, desc: 2 };
const SMALL_M: Metrics = { cap: 5, xh: 4, desc: 1 };

// ---------------------------------------------------------------------------------------------
// Glyph maps. '#' = fill. Rows start at the cap line; lowercase letters without an ascender are
// written from the x-height line with `bx(...)` / `sx(...)`. Rows below the baseline are descenders.
// Design rules: vertical stems 2 px, horizontal strokes 1 px, round letters get 1 px cut corners.

type GlyphMap = Record<string, string[]>;
const pad = (n: number, rows: string[]) => [...Array<string>(n).fill('.'.repeat(rows[0].length)), ...rows];

const bx = (...rows: string[]) => pad(BOLD_M.cap - BOLD_M.xh, rows);
const BOLD: GlyphMap = {
  A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
  C: ['.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '#####'],
  F: ['#####', '##...', '##...', '####.', '##...', '##...', '##...'],
  G: ['.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.####.'],
  H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  J: ['...##', '...##', '...##', '...##', '##.##', '##.##', '.###.'],
  K: ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##'],
  L: ['##...', '##...', '##...', '##...', '##...', '##...', '#####'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
  N: ['##..##', '###.##', '######', '##.###', '##..##', '##..##', '##..##'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  P: ['#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
  Q: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '....##'],
  R: ['#####.', '##..##', '##..##', '#####.', '##.##.', '##..##', '##..##'],
  S: ['.####.', '##..##', '##....', '.####.', '....##', '##..##', '.####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '..##..'],
  W: ['##...##', '##...##', '##...##', '##.#.##', '#######', '###.###', '##...##'],
  X: ['##..##', '##..##', '.####.', '..##..', '.####.', '##..##', '##..##'],
  Y: ['##..##', '##..##', '##..##', '.####.', '..##..', '..##..', '..##..'],
  Z: ['######', '....##', '...##.', '..##..', '.##...', '##....', '######'],

  a: bx('.###.', '...##', '.####', '##.##', '.####'),
  b: ['##...', '##...', '####.', '##.##', '##.##', '##.##', '####.'],
  c: bx('.####', '##...', '##...', '##...', '.####'),
  d: ['...##', '...##', '.####', '##.##', '##.##', '##.##', '.####'],
  e: bx('.###.', '##.##', '#####', '##...', '.####'),
  f: ['.###', '##..', '####', '##..', '##..', '##..', '##..'],
  g: bx('.####', '##.##', '##.##', '##.##', '.####', '...##', '####.'),
  h: ['##...', '##...', '####.', '##.##', '##.##', '##.##', '##.##'],
  i: ['##', '..', '##', '##', '##', '##', '##'],
  j: ['..##', '....', '..##', '..##', '..##', '..##', '..##', '..##', '###.'],
  k: ['##...', '##...', '##.##', '####.', '###..', '####.', '##.##'],
  l: ['##', '##', '##', '##', '##', '##', '##'],
  m: bx('#######.', '##.##.##', '##.##.##', '##.##.##', '##.##.##'),
  n: bx('####.', '##.##', '##.##', '##.##', '##.##'),
  o: bx('.###.', '##.##', '##.##', '##.##', '.###.'),
  p: bx('####.', '##.##', '##.##', '##.##', '####.', '##...', '##...'),
  q: bx('.####', '##.##', '##.##', '##.##', '.####', '...##', '...##'),
  r: bx('##.##', '####.', '##...', '##...', '##...'),
  s: bx('.####', '##...', '.###.', '...##', '####.'),
  t: ['....', '##..', '####', '##..', '##..', '##..', '.###'],
  u: bx('##.##', '##.##', '##.##', '##.##', '.####'),
  v: bx('##..##', '##..##', '##..##', '.####.', '..##..'),
  w: bx('##.##.##', '##.##.##', '##.##.##', '##.##.##', '.######.'),
  x: bx('##..##', '.####.', '..##..', '.####.', '##..##'),
  y: bx('##.##', '##.##', '##.##', '##.##', '.####', '...##', '####.'),
  z: bx('#####', '...##', '.###.', '##...', '#####'),

  '0': ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  '1': ['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '.####.'],
  '2': ['.####.', '##..##', '....##', '..###.', '.##...', '##....', '######'],
  '3': ['.####.', '##..##', '....##', '..###.', '....##', '##..##', '.####.'],
  '4': ['...###', '..####', '.##.##', '##..##', '######', '....##', '....##'],
  '5': ['######', '##....', '#####.', '....##', '....##', '##..##', '.####.'],
  '6': ['.####.', '##....', '##....', '#####.', '##..##', '##..##', '.####.'],
  '7': ['######', '....##', '...##.', '..##..', '..##..', '..##..', '..##..'],
  '8': ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '.####.'],
  '9': ['.####.', '##..##', '##..##', '.#####', '....##', '....##', '.####.'],

  ' ': ['....'],
  '!': ['##', '##', '##', '##', '##', '..', '##'],
  '?': ['.####.', '##..##', '....##', '..###.', '..##..', '......', '..##..'],
  '.': ['..', '..', '..', '..', '..', '##', '##'],
  ',': ['..', '..', '..', '..', '..', '##', '##', '#.'],
  ':': ['..', '..', '##', '##', '..', '##', '##'],
  ';': ['..', '..', '##', '##', '..', '##', '##', '#.'],
  '-': ['....', '....', '....', '####'],
  '+': ['......', '..##..', '..##..', '######', '..##..', '..##..'],
  '%': ['##...##', '##..##.', '...##..', '..##...', '.##....', '.##..##', '##...##'],
  '/': ['..##', '..##', '.##.', '.##.', '.##.', '##..', '##..'],
  '(': ['.##', '##.', '##.', '##.', '##.', '##.', '.##'],
  ')': ['##.', '.##', '.##', '.##', '.##', '.##', '##.'],
  "'": ['##', '##', '#.'],
  '"': ['##.##', '##.##', '#..#.'],
  '<': ['....', '..##', '.##.', '##..', '.##.', '..##'],
  '>': ['....', '##..', '.##.', '..##', '.##.', '##..'],
  '=': ['.....', '.....', '#####', '.....', '#####'],
  '*': ['......', '..##..', '######', '.####.', '##..##'],
  '#': ['.......', '.##.##.', '#######', '.##.##.', '#######', '.##.##.'],
  '&': ['.###...', '##.##..', '##.##..', '.###.##', '##.###.', '##..##.', '.###.##'],
  '^': ['..##..', '.####.', '##..##'],
};

const sx = (...rows: string[]) => pad(SMALL_M.cap - SMALL_M.xh, rows);
const SMALL: GlyphMap = {
  A: ['.###.', '##.##', '#####', '##.##', '##.##'],
  B: ['####.', '##.##', '####.', '##.##', '####.'],
  C: ['.####', '##...', '##...', '##...', '.####'],
  D: ['####.', '##.##', '##.##', '##.##', '####.'],
  E: ['####', '##..', '###.', '##..', '####'],
  F: ['####', '##..', '###.', '##..', '##..'],
  G: ['.####', '##...', '##.##', '##.##', '.####'],
  H: ['##.##', '##.##', '#####', '##.##', '##.##'],
  I: ['####', '.##.', '.##.', '.##.', '####'],
  J: ['...##', '...##', '...##', '##.##', '.###.'],
  K: ['##.##', '####.', '###..', '####.', '##.##'],
  L: ['##..', '##..', '##..', '##..', '####'],
  M: ['##...##', '###.###', '##.#.##', '##...##', '##...##'],
  N: ['##..##', '###.##', '##.###', '##..##', '##..##'],
  O: ['.###.', '##.##', '##.##', '##.##', '.###.'],
  P: ['####.', '##.##', '####.', '##...', '##...'],
  Q: ['.###.', '##.##', '##.##', '##.##', '.###.', '...##'],
  R: ['####.', '##.##', '####.', '##.##', '##.##'],
  S: ['.####', '##...', '.###.', '...##', '####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..'],
  U: ['##.##', '##.##', '##.##', '##.##', '.###.'],
  V: ['##..##', '##..##', '##..##', '.####.', '..##..'],
  W: ['##...##', '##...##', '##.#.##', '#######', '.##.##.'],
  X: ['##..##', '.####.', '..##..', '.####.', '##..##'],
  Y: ['##..##', '##..##', '.####.', '..##..', '..##..'],
  Z: ['#####', '...##', '.###.', '##...', '#####'],

  a: sx('.###.', '...##', '##.##', '.####'),
  b: ['##...', '####.', '##.##', '##.##', '####.'],
  c: sx('.####', '##...', '##...', '.####'),
  d: ['...##', '.####', '##.##', '##.##', '.####'],
  e: sx('.###.', '##.##', '####.', '.####'),
  f: ['..##', '.##.', '####', '.##.', '.##.'],
  g: sx('.####', '##.##', '.####', '...##', '####.'),
  h: ['##...', '####.', '##.##', '##.##', '##.##'],
  i: ['##', '..', '##', '##', '##'],
  j: ['.##', '...', '.##', '.##', '.##', '##.'],
  k: ['##...', '##.##', '###..', '####.', '##.##'],
  l: ['##', '##', '##', '##', '##'],
  m: sx('######.', '##.#.##', '##.#.##', '##.#.##'),
  n: sx('####.', '##.##', '##.##', '##.##'),
  o: sx('.###.', '##.##', '##.##', '.###.'),
  p: sx('####.', '##.##', '####.', '##...', '##...'),
  q: sx('.####', '##.##', '.####', '...##', '...##'),
  r: sx('##.##', '####.', '##...', '##...'),
  s: sx('.###', '##..', '..##', '###.'),
  t: ['##..', '####', '##..', '##..', '.###'],
  u: sx('##.##', '##.##', '##.##', '.####'),
  v: sx('##..##', '##..##', '.####.', '..##..'),
  w: sx('##.#.##', '##.#.##', '##.#.##', '.##.##.'),
  x: sx('##.##', '.###.', '.###.', '##.##'),
  y: sx('##.##', '##.##', '.####', '...##', '####.'),
  z: sx('#####', '..##.', '.##..', '#####'),

  '0': ['.###.', '##.##', '##.##', '##.##', '.###.'],
  '1': ['..##.', '.###.', '..##.', '..##.', '.####'],
  '2': ['####.', '...##', '.###.', '##...', '#####'],
  '3': ['####.', '...##', '.###.', '...##', '####.'],
  '4': ['##.##', '##.##', '#####', '...##', '...##'],
  '5': ['#####', '##...', '####.', '...##', '####.'],
  '6': ['.###.', '##...', '####.', '##.##', '.###.'],
  '7': ['#####', '...##', '..##.', '.##..', '.##..'],
  '8': ['.###.', '##.##', '.###.', '##.##', '.###.'],
  '9': ['.###.', '##.##', '.####', '...##', '.###.'],

  ' ': ['...'],
  '!': ['##', '##', '##', '..', '##'],
  '?': ['####.', '...##', '.###.', '.....', '.##..'],
  '.': ['..', '..', '..', '..', '##'],
  ',': ['..', '..', '..', '..', '##', '#.'],
  ':': ['..', '##', '..', '##', '..'],
  ';': ['..', '##', '..', '##', '#.'],
  '-': ['...', '...', '###'],
  '+': ['....', '.##.', '####', '.##.'],
  '%': ['##..##', '##.##.', '..##..', '.##.##', '##..##'],
  '/': ['..##', '..##', '.##.', '##..', '##..'],
  '(': ['.##', '##.', '##.', '##.', '.##'],
  ')': ['##.', '.##', '.##', '.##', '##.'],
  "'": ['##', '#.'],
  '"': ['##.##', '#..#.'],
  '<': ['..##', '.##.', '##..', '.##.', '..##'],
  '>': ['##..', '.##.', '..##', '.##.', '##..'],
  '=': ['....', '####', '....', '####'],
  '*': ['..#..', '#####', '.###.', '##.##'],
  '#': ['.##.##.', '#######', '.##.##.', '#######', '.##.##.'],
  '&': ['.###..', '##....', '.###.#', '##.##.', '.##.##'],
  '^': ['..#..', '.###.', '##.##'],
};

// ---------------------------------------------------------------------------------------------
// Metrics. A glyph's texture frame is its fill plus 1 px of outline on every side and 1 px of
// shadow below: frame width = fill width + 2, frame height = cell height.

/** Cell = top outline + cap height + descender + outline + shadow. */
const cellOf = (m: Metrics) => 1 + m.cap + m.desc + 2;
/** Line box (what Phaser measures and what origins refer to) = top outline + caps + bottom outline + shadow. */
const lineOf = (m: Metrics) => 1 + m.cap + 2;

/**
 * Height of a bold text object at scale 1 (its box: outline, caps, outline, shadow). Descenders hang
 * 2 px below it. With origin y 0.5 the box is centered on y, so the cap fill's center is 0.5 px
 * (times scale) above y. Baseline y = textY + (BASELINE - originY * H) * scale.
 */
export const FONT_BOLD_H = lineOf(BOLD_M); // 10
/** Height of a small text object. Descenders hang 1 px below it. */
export const FONT_H = lineOf(SMALL_M); // 8
/** Cap heights (white fill only). */
export const FONT_BOLD_CAP = BOLD_M.cap; // 7
export const FONT_CAP = SMALL_M.cap; // 5
/** Distance from the top of the text box to the baseline (the row just below the cap fill). */
export const FONT_BOLD_BASELINE = 1 + BOLD_M.cap; // 8
export const FONT_BASELINE = 1 + SMALL_M.cap; // 6
/** Full glyph cell height including descenders, outline and shadow. */
export const FONT_BOLD_CELL = cellOf(BOLD_M); // 12
export const FONT_CELL = cellOf(SMALL_M); // 9

const fillWidth = (map: GlyphMap) => {
  const w: Record<string, number> = {};
  for (const [ch, rows] of Object.entries(map)) w[ch] = rows[0].length;
  return w;
};
const W_BOLD = fillWidth(BOLD);
const W_SMALL = fillWidth(SMALL);

/** Phaser's nominal font size: the same for both fonts so `setFont` between them keeps scale 1. */
const NOMINAL_SIZE = 10;

export function buildFont(scene: Phaser.Scene): void {
  buildVariant(scene, FONT_BOLD, BOLD, BOLD_M);
  buildVariant(scene, FONT, SMALL, SMALL_M);
}

function buildVariant(scene: Phaser.Scene, key: string, map: GlyphMap, m: Metrics): void {
  const chars = Object.keys(map);
  const cellH = cellOf(m);
  const rowsMax = m.cap + m.desc;
  // Shelf-pack the frames into a texture 128 px wide, 1 px apart.
  const texW = 128;
  const pos: Record<string, { x: number; y: number; w: number }> = {};
  let px = 0;
  let py = 0;
  for (const ch of chars) {
    const fw = map[ch][0].length + 2;
    if (px + fw > texW) {
      px = 0;
      py += cellH + 1;
    }
    pos[ch] = { x: px, y: py, w: fw };
    px += fw + 1;
  }
  const texH = py + cellH;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d')!;

  for (const ch of chars) {
    const rows = map[ch];
    const gw = rows[0].length;
    if (rows.length > rowsMax || rows.some((r) => r.length !== gw)) throw new Error(`font ${key}: bad glyph '${ch}'`);
    const fill = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < gw && rows[y][x] === '#';
    // Outline = 4-neighbourhood of the fill, so convex corners come out rounded (softer than a square
    // 8-neighbourhood outline). Exception: in the frame's outer columns, which overlap the neighbouring
    // letter, bottom corners are square, so the bottom outline and the shadow run unbroken under a word.
    const edge = (x: number) => x === -1 || x === gw;
    const near = (x: number, y: number) =>
      fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1) || (edge(x) && (fill(x - 1, y - 1) || fill(x + 1, y - 1)));
    const { x: ox, y: oy } = pos[ch];
    ctx.fillStyle = INK;
    for (let y = -1; y <= rowsMax + 1; y++)
      for (let x = -1; x <= gw; x++) {
        if (fill(x, y)) continue;
        // outline, or shadow: 1 px below the outlined glyph
        if (near(x, y) || fill(x, y - 1) || near(x, y - 1)) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
      }
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < gw; x++) if (fill(x, y)) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
  }

  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);

  // Bitmap font data in the shape Phaser's parsers produce (see ParseRetroFont / ParseXMLBitmapFont).
  // xAdvance is the full frame width and every pair is kerned by GAP - 2, so neighbouring outlines
  // overlap and Phaser's measured width equals the rendered width (origin 0.5 centers the ink).
  const kern: Record<number, number> = {};
  for (const ch of chars) kern[ch.charCodeAt(0)] = GAP - 2;
  const data = {
    retroFont: false,
    font: key,
    size: NOMINAL_SIZE,
    lineHeight: lineOf(m),
    chars: {} as Record<number, unknown>,
  };
  for (const ch of chars) {
    const p = pos[ch];
    data.chars[ch.charCodeAt(0)] = {
      x: p.x,
      y: p.y,
      width: p.w,
      height: cellH,
      centerX: Math.floor(p.w / 2),
      centerY: Math.floor(cellH / 2),
      xOffset: 0,
      yOffset: 0,
      xAdvance: p.w,
      data: {},
      kerning: kern,
      u0: p.x / texW,
      v0: 1 - p.y / texH,
      u1: (p.x + p.w) / texW,
      v1: 1 - (p.y + cellH) / texH,
    };
  }
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null });
}

// ---------------------------------------------------------------------------------------------
// Text helpers.

const SUBST: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '`': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  _: '-',
  '~': '-',
  '\u00d7': 'x',
  '\u2026': '...',
  '[': '(',
  ']': ')',
  '{': '(',
  '}': ')',
  '|': '!',
  '\\': '/',
  '@': 'a',
  $: 'S',
  '\u00a0': ' ',
  '\t': ' ',
};

/** Maps characters the fonts lack to the closest ones they have. Keeps case. */
export function fontText(s: string): string {
  let out = '';
  for (const c of s) {
    if (c in W_BOLD || c === '\n') out += c;
    else if (c in SUBST) out += SUBST[c];
    else {
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      out += base && [...base].every((b) => b in W_BOLD) ? base : '?';
    }
  }
  return out;
}

/**
 * Exact rendered width in game px of `s` (after fontText), outline included, at the given scale.
 * Equals the BitmapText's own width, so origins line up with the ink.
 */
export function textWidth(s: string, scale = 1, bold = false): number {
  const w = bold ? W_BOLD : W_SMALL;
  let best = 0;
  for (const line of fontText(s).split('\n')) {
    if (!line.length) continue;
    let sum = 0;
    for (const c of line) sum += w[c] + GAP;
    best = Math.max(best, sum - GAP + 2);
  }
  return best * scale;
}

/**
 * The fill pixels of one line of text (no outline, no shadow), letters GAP px apart, rows from the cap line
 * down through the descenders. For art built from the font (the title logo).
 */
export function glyphMask(s: string, bold = true): { w: number; h: number; on: (x: number, y: number) => boolean } {
  const map = bold ? BOLD : SMALL;
  const m = bold ? BOLD_M : SMALL_M;
  const h = m.cap + m.desc;
  const line = fontText(s).split('\n')[0] ?? '';
  const cells: Array<{ x: number; rows: string[] }> = [];
  let x = 0;
  for (const c of line) {
    cells.push({ x, rows: map[c] });
    x += map[c][0].length + GAP;
  }
  const w = Math.max(0, x - GAP);
  const grid = new Uint8Array(w * h);
  for (const { x: cx, rows } of cells)
    rows.forEach((r, y) => {
      for (let i = 0; i < r.length; i++) if (r[i] === '#') grid[y * w + cx + i] = 1;
    });
  return { w, h, on: (px, py) => px >= 0 && py >= 0 && px < w && py < h && grid[py * w + px] === 1 };
}
