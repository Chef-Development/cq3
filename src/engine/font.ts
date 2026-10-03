// Original 5x7 pixel font, generated at boot into a texture with a baked 1px dark outline.
// Glyphs are white so BitmapText tint (multiply) recolors the fill and keeps the outline dark.
import Phaser from 'phaser';

const G: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ',': ['.....', '.....', '.....', '.....', '.....', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '^': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
};

export const FONT = 'px';
export const FONT_BOLD = 'pxb';
export const ADVANCE = 6;
export const ADVANCE_BOLD = 7;

/** Regular: 5x7 glyphs. Bold: every stroke doubled horizontally (6x7), chunkier for HUD numbers and titles. */
export function buildFont(scene: Phaser.Scene): void {
  buildVariant(scene, FONT, false);
  buildVariant(scene, FONT_BOLD, true);
}

function buildVariant(scene: Phaser.Scene, key: string, bold: boolean): void {
  const gw = bold ? 6 : 5;
  const cellW = gw + 2;
  const cellH = 9;
  const chars = Object.keys(G).join('');
  const perRow = 16;
  const rows = Math.ceil(chars.length / perRow);
  const canvas = document.createElement('canvas');
  canvas.width = perRow * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext('2d')!;
  [...chars].forEach((ch, i) => {
    const ox = (i % perRow) * cellW;
    const oy = Math.floor(i / perRow) * cellH;
    const g = G[ch];
    const raw = (x: number, y: number) => y >= 0 && y < 7 && x >= 0 && x < 5 && g[y][x] === '#';
    const on = (x: number, y: number) => raw(x, y) || (bold && raw(x - 1, y));
    ctx.fillStyle = '#140c1c';
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= gw; x++) {
        if (on(x, y)) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) near = on(x + dx, y + dy);
        if (near) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
      }
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < 7; y++) for (let x = 0; x < gw; x++) if (on(x, y)) ctx.fillRect(ox + x + 1, oy + y + 1, 1, 1);
  });
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: key,
    width: cellW,
    height: cellH,
    chars,
    charsPerRow: perRow,
    offset: { x: 0, y: 0 },
    spacing: { x: 0, y: 0 },
    lineSpacing: 1,
  } as unknown as Phaser.Types.GameObjects.BitmapText.RetroFontConfig) as unknown as { data: { chars: Record<number, { xAdvance: number }> } };
  for (const c of Object.values(entry.data.chars)) c.xAdvance = bold ? ADVANCE_BOLD : ADVANCE;
  scene.cache.bitmapFont.add(key, entry);
}

/** Upper-cases text but keeps 'x' as the multiply sign when it follows a digit or starts a word before a digit. */
export function fontText(s: string): string {
  return s.replace(/[a-wyz]/g, (c) => c.toUpperCase()).replace(/x(?![0-9.])/g, 'X');
}

export const textWidth = (s: string, scale = 1, bold = false): number => (s.length ? (s.length * (bold ? ADVANCE_BOLD : ADVANCE) + 1) * scale : 0);
