// UI chrome textures (panels, the timing bar's frame, HUD buttons): original pixel art generated at boot.
// Style: dark outline, rounded corners, bright rim on top/left, dark band on bottom/right (docs/art-style.md).
import type Phaser from 'phaser';

const INK = '#140c1c';

interface Paint {
  ctx: CanvasRenderingContext2D;
  rect: (x: number, y: number, w: number, h: number, col: string) => void;
  px: (x: number, y: number, col: string) => void;
  rnd: () => number;
}

function canvas(w: number, h: number, seed = 1): [HTMLCanvasElement, Paint] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const rect = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  };
  return [c, { ctx, rect, px: (x, y, col) => rect(x, y, 1, 1, col), rnd }];
}

/** Horizontal inset of row i in a w x h box whose corners are rounded by r px (pixel-art stepping). */
export function cornerInset(i: number, h: number, r: number): number {
  const d = Math.min(i, h - 1 - i);
  if (d >= r) return 0;
  if (r <= 1) return d === 0 ? 1 : 0;
  if (r === 2) return d === 0 ? 2 : 1;
  return Math.round(r - Math.sqrt(Math.max(0, r * r - (r - d - 0.5) ** 2)));
}

/** Rounded rectangle filled row by row. */
function rrect(p: Paint, x: number, y: number, w: number, h: number, r: number, col: string): void {
  for (let i = 0; i < h; i++) {
    const k = cornerInset(i, h, r);
    p.rect(x + k, y + i, w - k * 2, 1, col);
  }
}

/** Wavy wood grain over an area (planks run horizontally). */
function woodGrain(p: Paint, x0: number, y0: number, w: number, h: number, tones: { base: string; dark: string; deep: string; light: string }): void {
  p.rect(x0, y0, w, h, tones.base);
  for (let y = y0 + 1; y < y0 + h - 1; y += 2 + Math.floor(p.rnd() * 3)) {
    let x = x0 - Math.floor(p.rnd() * 30);
    while (x < x0 + w) {
      const len = 8 + Math.floor(p.rnd() * 34);
      const ph = p.rnd() * 6;
      const amp = p.rnd() < 0.5 ? 1 : 0;
      const col = p.rnd() < 0.25 ? tones.deep : tones.dark;
      for (let i = 0; i < len; i++) {
        const xx = x + i;
        if (xx < x0 || xx >= x0 + w) continue;
        const yy = y + Math.round(Math.sin(i / 7 + ph) * amp);
        if (yy <= y0 || yy >= y0 + h - 1) continue;
        p.px(xx, yy, col);
        if (i % 9 === 3 && yy - 1 > y0) p.px(xx, yy - 1, tones.light);
      }
      x += len + 3 + Math.floor(p.rnd() * 12);
    }
  }
  // a few knots
  for (let i = 0; i < Math.max(1, Math.round((w * h) / 2600)); i++) {
    const kx = x0 + 6 + Math.floor(p.rnd() * Math.max(1, w - 12));
    const ky = y0 + 3 + Math.floor(p.rnd() * Math.max(1, h - 6));
    p.rect(kx - 2, ky, 5, 1, tones.deep);
    p.rect(kx - 1, ky - 1, 3, 1, tones.dark);
    p.rect(kx - 1, ky + 1, 3, 1, tones.dark);
    p.px(kx, ky, tones.light);
  }
}

const WOOD = { base: '#7a4626', dark: '#5e3218', deep: '#44220e', light: '#94603a' };

/** Bottom panel: a wooden band holding the bar over a slate strip. */
export function buildPanel(scene: Phaser.Scene, w: number, h: number, bandH: number): void {
  const [c, p] = canvas(w, h, 41);
  woodGrain(p, 0, 0, w, bandH, WOOD);
  // top lip: ink line, bright edge, shadow under the lip
  p.rect(0, 0, w, 1, INK);
  p.rect(0, 1, w, 1, '#b07a48');
  p.rect(0, 2, w, 1, '#8e5a2e');
  p.rect(0, bandH - 1, w, 1, '#2e1a0e');
  // slate strip: big flagstones with a lit top-left facet
  const sy = bandH;
  p.rect(0, sy, w, h - bandH, '#3c3c4a');
  p.rect(0, sy, w, 1, INK);
  p.rect(0, sy + 1, w, 1, '#24242e');
  for (let x = -Math.floor(p.rnd() * 20), row = 0; x < w; row++) {
    const sw = 22 + Math.floor(p.rnd() * 26);
    const top = sy + 2;
    const sh = h - top;
    p.rect(x, top, sw, sh, row % 2 ? '#464656' : '#4c4c5c');
    p.rect(x, top, sw, 1, '#62627a');
    p.rect(x, top, 1, sh, '#5a5a70');
    p.rect(x + sw - 1, top, 1, sh, '#2a2a36');
    // a lighter facet and a couple of chips
    for (let k = 0; k < Math.min(6, sh - 3); k++) p.rect(x + 3 + k, top + 2 + k, Math.max(0, 6 - k), 1, '#54546a');
    if (p.rnd() < 0.6) p.rect(x + 6 + Math.floor(p.rnd() * (sw - 10)), top + 4 + Math.floor(p.rnd() * Math.max(1, sh - 7)), 2, 1, '#30303c');
    x += sw;
  }
  if (scene.textures.exists('panel')) scene.textures.remove('panel');
  scene.textures.addCanvas('panel', c);
}

/**
 * The timing bar's metal capsule (texture 'barframe'): w x h is the inner track; the frame adds 9 px at each
 * end and 5 px above/below. Track: dark ribbed channel.
 */
export function buildBarFrame(scene: Phaser.Scene, w: number, h: number): void {
  const ew = 9;
  const eh = 5;
  const W = w + ew * 2;
  const H = h + eh * 2;
  const [c, p] = canvas(W + 2, H + 2, 7);
  // drop shadow into the wood
  rrect(p, 1, 2, W, H, 8, 'rgba(20,10,4,0.55)');
  // ink outline + metal body
  rrect(p, 0, 0, W, H, 8, INK);
  rrect(p, 1, 1, W - 2, H - 2, 7, '#9aa4be');
  // vertical shading of the metal: bright top rows, darker bottom rows
  const rows: Array<[number, string]> = [
    [1, '#f4f8ff'],
    [2, '#d6deee'],
    [3, '#b8c2d8'],
    [H - 4, '#7c86a6'],
    [H - 3, '#5e6888'],
    [H - 2, '#4a5272'],
  ];
  for (const [y, col] of rows) {
    const k = cornerInset(y - 1, H - 2, 7);
    p.rect(1 + k, y, W - 2 - k * 2, 1, col);
  }
  // end caps: a bolt in each, a highlight on the left curve
  for (const cx of [ew / 2 + 1, W - ew / 2 - 1]) {
    const cy = Math.floor(H / 2);
    p.rect(cx - 2, cy - 1, 4, 3, '#5e6888');
    p.rect(cx - 1, cy - 2, 2, 5, '#5e6888');
    p.rect(cx - 1, cy - 1, 2, 2, '#d6deee');
    p.px(cx - 1, cy - 1, '#ffffff');
  }
  for (let y = 4; y < H - 6; y++) p.px(2, y, '#d6deee');
  // track channel: ink lip, ribbed dark interior, lit top row, deep bottom
  p.rect(ew - 1, eh - 1, w + 2, h + 2, INK);
  p.rect(ew, eh, w, h, '#2c2c38');
  for (let x = 0; x < w; x++) {
    const rib = x % 3;
    p.rect(ew + x, eh + 1, 1, h - 2, rib === 0 ? '#22222c' : rib === 1 ? '#3a3a48' : '#46465a');
  }
  p.rect(ew, eh, w, 1, '#5c5c74');
  p.rect(ew, eh + h - 2, w, 2, '#1c1c24');
  if (scene.textures.exists('barframe')) scene.textures.remove('barframe');
  scene.textures.addCanvas('barframe', c);
}

/** Wooden board for dialogs (boost choice): w x h with outline, bevel and grain. */
export function buildBoard(scene: Phaser.Scene, key: string, w: number, h: number): void {
  const [c, p] = canvas(w, h + 2, 13);
  rrect(p, 0, 2, w, h, 5, 'rgba(10,6,16,0.5)');
  rrect(p, 0, 0, w, h, 5, INK);
  // inner board
  const [ic, ip] = canvas(w - 2, h - 2, 29);
  woodGrain(ip, 0, 0, w - 2, h - 2, { base: '#8a5230', dark: '#6e3e20', deep: '#52280e', light: '#a86c40' });
  p.ctx.save();
  p.ctx.beginPath();
  for (let i = 0; i < h - 2; i++) {
    const k = cornerInset(i, h - 2, 4);
    p.ctx.rect(1 + k, 1 + i, w - 2 - k * 2, 1);
  }
  p.ctx.clip();
  p.ctx.drawImage(ic, 1, 1);
  p.ctx.restore();
  // bevel: lit top/left rim, dark bottom/right rim, inner groove
  for (let i = 0; i < h - 2; i++) {
    const k = cornerInset(i, h - 2, 4);
    p.px(1 + k, 1 + i, '#c48a52');
    p.px(w - 2 - k, 1 + i, '#4a2610');
  }
  const k0 = cornerInset(0, h - 2, 4);
  p.rect(1 + k0, 1, w - 2 - k0 * 2, 1, '#d6a066');
  p.rect(1 + k0, h - 2, w - 2 - k0 * 2, 1, '#3e1e0a');
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

/** HUD button art for the DOM pause / gear buttons (14x14 game px, returned as data URLs). */
export function hudButtonImages(): Record<'pause' | 'pauseOn' | 'gear' | 'gearOn', string> {
  const make = (icon: 'pause' | 'gear', on: boolean) => {
    const S = 14;
    const [c, p] = canvas(S, S + 1);
    rrect(p, 0, 1, S, S, 3, 'rgba(10,6,16,0.5)');
    rrect(p, 0, 0, S, S, 3, INK);
    const face = on ? ['#fff0a0', '#f2c230', '#d8901c', '#9a5a14'] : ['#f4f6fa', '#c8ccd8', '#9aa0b4', '#6a7088'];
    rrect(p, 1, 1, S - 2, S - 2, 2, face[1]);
    p.rect(3, 1, S - 6, 1, face[0]);
    p.rect(1, 3, 1, S - 6, face[0]);
    p.rect(2, 2, 1, 1, face[0]);
    p.rect(3, S - 2, S - 6, 1, face[3]);
    p.rect(S - 2, 3, 1, S - 6, face[2]);
    p.rect(2, S - 4, S - 4, 2, face[2]);
    p.rect(3, S - 2, S - 6, 1, face[3]);
    const glyph = on ? '#5a3410' : '#33374a';
    if (icon === 'pause') {
      p.rect(4, 4, 2, 6, glyph);
      p.rect(8, 4, 2, 6, glyph);
    } else {
      // cog: ring with four teeth (and four diagonal nubs) around an open hub
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - 7;
          const dy = y + 0.5 - 7;
          const d = Math.hypot(dx, dy);
          const tooth = Math.cos(Math.atan2(dy, dx) * 4) > 0.45;
          if (d >= 1.6 && (d <= 3.4 || (tooth && d <= 4.9))) p.px(x, y, glyph);
        }
    }
    return c.toDataURL();
  };
  return { pause: make('pause', false), pauseOn: make('pause', true), gear: make('gear', false), gearOn: make('gear', true) };
}

/** Title crest (texture 'crest'): a gold-rimmed red shield with a big steel "3" over two crossed swords. */
export function buildCrest(scene: Phaser.Scene): void {
  const W = 44;
  const H = 42;
  const [c, p] = canvas(W, H, 3);
  const g: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  const put = (x: number, y: number, col: string) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = col;
  };
  // crossed swords behind the shield
  for (const dir of [1, -1]) {
    const x0 = dir > 0 ? 6 : W - 7;
    for (let i = 0; i < 34; i++) {
      const x = x0 + dir * i * 0.92;
      const y = 4 + i * 0.92;
      const blade = i < 26;
      put(x, y, blade ? (i < 2 ? '#ffffff' : '#d6deee') : '#6e4426');
      put(x + dir, y, blade ? '#8a94b0' : '#4a2c18');
      if (i === 26) for (let k = -3; k <= 3; k++) put(x + k * 0.7 * dir, y - k * 0.7, '#f2c230');
    }
  }
  // shield: flat top, curved sides meeting in a point
  const sx = 9;
  const sy = 6;
  const sw = 26;
  const sh = 31;
  const inShield = (x: number, y: number, inset: number) => {
    const u = x - sx;
    const v = y - sy;
    if (v < inset || v >= sh - inset) return false;
    const t = v / sh;
    const half = (sw / 2) * (t < 0.45 ? 1 : Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2))) - inset;
    return Math.abs(u + 0.5 - sw / 2) <= half;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!inShield(x, y, 0)) continue;
      const rim = !inShield(x, y, 2);
      const v = (y - sy) / sh;
      const u = (x - sx) / sw;
      if (rim) put(x, y, u + v * 0.3 < 0.45 ? '#fff0a0' : u + v * 0.3 < 0.8 ? '#f2c230' : '#b07018');
      else put(x, y, u < 0.5 ? (v < 0.5 ? '#e8443a' : '#c8303a') : v < 0.5 ? '#c8303a' : '#a01c28');
    }
  // big chunky "3" (steel, lit from the top left) with a deep-red inner outline
  const three = [
    '########.',
    '#########',
    '.......##',
    '.......##',
    '..######.',
    '..######.',
    '.......##',
    '.......##',
    '#########',
    '########.',
  ];
  const tx = sx + 8;
  const ty = sy + 7;
  const mask = new Set<string>();
  three.forEach((row, yy) =>
    [...row].forEach((ch, xx) => {
      if (ch !== '#') return;
      for (const dy of [0, 1]) mask.add(`${tx + xx},${ty + Math.floor(yy * 1.5) + dy}`);
    }),
  );
  for (const key of mask) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
    ])
      if (!mask.has(`${x + dx},${y + dy}`)) put(x + dx, y + dy, '#4a0f1a');
  }
  for (const key of mask) {
    const [x, y] = key.split(',').map(Number);
    const v = (y - ty) / 15;
    put(x, y, v < 0.2 ? '#ffffff' : v < 0.55 ? '#d6deee' : v < 0.8 ? '#b8c2d8' : '#8a94b0');
  }
  // outline everything
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (filled(x, y)) p.px(x, y, g[y][x]!);
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) p.px(x, y, INK);
    }
  if (scene.textures.exists('crest')) scene.textures.remove('crest');
  scene.textures.addCanvas('crest', c);
}
