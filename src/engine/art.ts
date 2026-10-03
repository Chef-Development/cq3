// Original placeholder pixel art, drawn from character maps at boot (auto 1px outline).
import type Phaser from 'phaser';

type Palette = Record<string, string>;

const OUTLINE = '#140c1c';

const HERO = {
  pal: { h: '#8a3a1c', s: '#f0c49c', e: '#140c1c', b: '#3a6bc8', B: '#26468a', w: '#5a3a20', y: '#f2c230', m: '#dfe6f2' },
  rows: [
    '.....hhhh.......',
    '....hhhhhh......',
    '...hhhhhhhh....m',
    '...hhsssshh...m.',
    '...hsesseh...m..',
    '....ssssss..m...',
    '.....ssss..m....',
    '....bbbbbbym....',
    '...bbbbbbbsy....',
    '...bbBbbBbb.....',
    '...sbbbbbb......',
    '....wwwyww......',
    '....bbbbbb......',
    '....BB..BB......',
    '....BB..BB......',
    '....BB..BB......',
    '...www..www.....',
  ],
};

const SLIME = {
  pal: { g: '#4fc4a0', G: '#2e8a6e', w: '#d8fff0', e: '#140c1c' },
  rows: [
    '......gggg......',
    '....gggggggg....',
    '...gwwggggggg...',
    '..gwwggggggggg..',
    '..geggegggggggg.',
    '.ggeggeggggggggg',
    '.gggggggggggggGg',
    'ggggggggggggggGG',
    'GgggggggggggggGG',
    '.GGGGGGGGGGGGGG.',
  ],
};

const BOAR = {
  pal: { b: '#8a5a34', B: '#5e3a20', p: '#e8a0a0', t: '#f4f0e0', e: '#140c1c', d: '#3a2414' },
  rows: [
    '.......BBBBBBB......',
    '.....BbbbbbbbbbB....',
    '...bbbbbbbbbbbbbbb..',
    '..bebbbbbbbbbbbbbbb.',
    'ppbbbbbbbbbbbbbbbbbb',
    'ppbbbbbbbbbbbbbbbbbb',
    'tpbbbbbbbbbbbbbbbbb.',
    't..bbbbbbbbbbbbbbb..',
    '...bb..bb...bb..bb..',
    '...dd..dd...dd..dd..',
  ],
};

const BANDIT = {
  pal: { c: '#5a4a6a', C: '#3a2e48', s: '#d8a880', m: '#c83a3a', e: '#140c1c', d: '#dfe6f2', w: '#8a6a3a', k: '#2a2030' },
  rows: [
    '.....ccccc....',
    '....ccccccc...',
    '...ccccccccc..',
    '...cssssscc...',
    '...mmmmmmmc...',
    '...meemeemc...',
    '...sssssscc...',
    '....cccccc....',
    '..cccccccccc..',
    '.dCcccccccccc.',
    'd.scccccccccs.',
    '...cccccccc...',
    '...cwwwwwwc...',
    '...cccccccc...',
    '...CCC..CCC...',
    '...CCC..CCC...',
    '...kkk..kkk...',
  ],
};

export const ICONS: Record<string, string[]> = {
  drop: ['..#..', '.###.', '#####', '#####', '.###.'],
  tusk: ['#....', '#....', '.#...', '..##.', '....#'],
  mask: ['#####', '#.#.#', '#####', '.###.', '.....'],
  shield: ['#####', '#...#', '#...#', '.#.#.', '..#..'],
  bomb: ['...#.', '..#..', '.###.', '#####', '.###.'],
  speed: ['..#.#', '.#.#.', '#.#..', '.#.#.', '..#.#'],
};

function drawMap(rows: string[], pal: Palette): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const h = rows.length + 2;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const filled = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== '.';
  ctx.fillStyle = OUTLINE;
  for (let y = -1; y <= rows.length; y++)
    for (let x = -1; x <= w - 2; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = pal[ch] ?? '#ff00ff';
      ctx.fillRect(x + 1, y + 1, 1, 1);
    }),
  );
  return c;
}

function drawBackground(w: number, h: number, horizon: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const sky = ['#16142c', '#1c1a36', '#232040', '#2a264c', '#322e58', '#3b3664', '#454070', '#504a7c', '#5c5588', '#686094'];
  const band = Math.ceil(horizon / sky.length);
  sky.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, i * band, w, band);
  });
  // stars
  ctx.fillStyle = '#d8d4ff';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * horizon * 0.6), 1, 1);
  // far hills
  ctx.fillStyle = '#2e2a4e';
  for (let x = 0; x < w; x++) {
    const y = Math.round(horizon - 22 - 8 * Math.sin(x / 17) - 5 * Math.sin(x / 7 + 1));
    ctx.fillRect(x, y, 1, horizon - y);
  }
  ctx.fillStyle = '#243a3a';
  for (let x = 0; x < w; x++) {
    const y = Math.round(horizon - 10 - 5 * Math.sin(x / 11 + 2));
    ctx.fillRect(x, y, 1, horizon - y);
  }
  // ground
  ctx.fillStyle = '#3a6a3a';
  ctx.fillRect(0, horizon, w, 3);
  ctx.fillStyle = '#2c4e2e';
  ctx.fillRect(0, horizon + 3, w, h - horizon - 3);
  ctx.fillStyle = '#4a8a4a';
  for (let x = 0; x < w; x += 3) ctx.fillRect(x + (x % 2), horizon - 1, 1, 1);
  ctx.fillStyle = '#244026';
  for (let i = 0; i < 60; i++) ctx.fillRect(Math.floor(rnd() * w), horizon + 4 + Math.floor(rnd() * (h - horizon - 4)), 2, 1);
  return c;
}

export function buildArt(scene: Phaser.Scene, w: number, h: number, horizon: number): void {
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, canvas);
  };
  add('hero', drawMap(HERO.rows, HERO.pal));
  add('slime', drawMap(SLIME.rows, SLIME.pal));
  add('boar', drawMap(BOAR.rows, BOAR.pal));
  add('bandit', drawMap(BANDIT.rows, BANDIT.pal));
  add('bg', drawBackground(w, h, horizon));
}
