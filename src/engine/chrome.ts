// UI chrome textures (panels, the timing bar's frame, HUD buttons): original pixel art generated at boot.
// Style: dark outline, rounded corners, bright rim on top/left, dark band on bottom/right (docs/art-style.md).
import type Phaser from 'phaser';
import { glyphMask } from './font';

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


/** Bottom panel: a wooden band holding the bar over a slate strip. */
/** Vertical gradient through `tones` (top to bottom) over rows y0..y1-1, with 2x2 dithered seams between tones. */
function gradient(p: Paint, x0: number, y0: number, w: number, y1: number, tones: string[]): void {
  const n = tones.length;
  const h = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / Math.max(1, h - 1)) * (n - 1);
    const i = Math.min(n - 2, Math.floor(t));
    const f = t - i;
    // rows near a seam alternate the two tones in a checker; elsewhere a solid tone
    if (f > 0.4 && f < 0.6) {
      for (let x = x0; x < x0 + w; x++) p.px(x, y, (x + y) % 2 ? tones[i] : tones[i + 1]);
    } else p.rect(x0, y, w, 1, f < 0.5 ? tones[i] : tones[i + 1]);
  }
}

/**
 * Bottom panel: a dark navy console holding the bar (gold trim along its top edge, riveted plates, a fine
 * brushed texture) over an inset tray for the finisher strip.
 */
export function buildPanel(scene: Phaser.Scene, w: number, h: number, bandH: number): void {
  const [c, p] = canvas(w, h, 41);
  // top lip: ink, gold trim, its shadow, ink
  p.rect(0, 0, w, 1, INK);
  p.rect(0, 1, w, 1, '#f2c230');
  p.rect(0, 2, w, 1, '#a8661a');
  p.rect(0, 3, w, 1, '#5a3410');
  p.rect(0, 4, w, 1, INK);
  gradient(p, 0, 5, w, bandH - 1, ['#342b58', '#2a2248', '#221b3c', '#1a1430']);
  p.rect(0, 5, w, 1, '#4a3f78');
  // brushed metal: faint horizontal streaks
  for (let i = 0; i < Math.round((w * bandH) / 70); i++) {
    const y = 7 + Math.floor(p.rnd() * (bandH - 10));
    const x = Math.floor(p.rnd() * w);
    const len = 3 + Math.floor(p.rnd() * 9);
    p.rect(x, y, len, 1, y < bandH / 2 ? '#3a3062' : '#2a2248');
  }
  // plate seams with rivets
  for (let x = 36; x < w; x += 72) {
    p.rect(x, 5, 1, bandH - 6, '#100c1e');
    p.rect(x + 1, 5, 1, bandH - 6, '#3d3364');
    for (const ry of [8, bandH - 7])
      for (const rx of [x - 4, x + 4]) {
        p.rect(rx, ry, 2, 2, '#413668');
        p.px(rx, ry, '#8a7cc0');
        p.px(rx + 2, ry + 1, '#0b0814');
        p.px(rx + 1, ry + 2, '#0b0814');
      }
  }
  p.rect(0, bandH - 1, w, 1, '#0b0814');
  // the tray: an inset channel, shadowed on top, a faint lit lip at the bottom
  const sy = bandH;
  p.rect(0, sy, w, h - sy, '#100c1c');
  p.rect(0, sy, w, 1, INK);
  p.rect(0, sy + 1, w, 1, '#06040c');
  p.rect(0, sy + 2, w, 1, '#0b0814');
  gradient(p, 0, sy + 3, w, h, ['#100c1c', '#141026', '#18132c']);
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
  // drop shadow onto the console
  rrect(p, 1, 2, W, H, 8, 'rgba(6,3,14,0.7)');
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
  // end caps: a gold-cored bolt in each, a highlight on the left curve
  for (const cx of [ew / 2 + 1, W - ew / 2 - 1]) {
    const cy = Math.floor(H / 2);
    p.rect(cx - 2, cy - 1, 4, 3, '#4a5272');
    p.rect(cx - 1, cy - 2, 2, 5, '#4a5272');
    p.rect(cx - 1, cy - 1, 2, 2, '#f2c230');
    p.px(cx - 1, cy - 1, '#fff0a0');
    p.px(cx, cy, '#9a5a14');
  }
  for (let y = 4; y < H - 6; y++) p.px(2, y, '#d6deee');
  // track channel: ink lip, ribbed deep-navy interior, shadowed top rows, a faint lit bottom edge
  p.rect(ew - 1, eh - 1, w + 2, h + 2, INK);
  p.rect(ew, eh, w, h, '#1e1932');
  for (let x = 0; x < w; x++) {
    const rib = x % 3;
    p.rect(ew + x, eh + 1, 1, h - 2, rib === 0 ? '#161226' : rib === 1 ? '#262040' : '#2e274c');
  }
  p.rect(ew, eh, w, 1, '#08060f');
  p.rect(ew, eh + 1, w, 1, '#120e22');
  p.rect(ew, eh + h - 1, w, 1, '#3a3262');
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
    // navy key (gold when on) with a lit top edge and a 2 px darker base, like the in-game buttons
    const face = on ? ['#fff0a0', '#f2c230', '#d8901c', '#9a5a14'] : ['#6e5fa8', '#3a3062', '#2c2450', '#1b1530'];
    rrect(p, 1, 1, S - 2, S - 2, 2, face[1]);
    p.rect(1, 6, S - 2, S - 9, on ? '#e8b028' : '#342b58');
    p.rect(3, 1, S - 6, 1, face[0]);
    p.rect(1, 3, 1, S - 6, face[0]);
    p.rect(2, 2, 1, 1, face[0]);
    p.rect(S - 2, 3, 1, S - 6, face[2]);
    p.rect(2, S - 4, S - 4, 1, face[2]);
    p.rect(2, S - 3, S - 4, 1, face[3]);
    p.rect(3, S - 2, S - 6, 1, face[3]);
    p.px(S - 4, 2, '#ffffff');
    p.px(S - 5, 2, on ? '#ffffff' : '#a898e0');
    const glyph = on ? '#5a3410' : '#eef0fa';
    const shadow = on ? '#d8901c' : INK;
    const mark = (col: string, oy: number) => {
      if (icon === 'pause') {
        p.rect(4, 3 + oy, 2, 6, col);
        p.rect(8, 3 + oy, 2, 6, col);
        return;
      }
      // cog: ring with four teeth (and four diagonal nubs) around an open hub
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - 7;
          const dy = y + 0.5 - 6.5;
          const d = Math.hypot(dx, dy);
          const tooth = Math.cos(Math.atan2(dy, dx) * 4) > 0.45;
          if (d >= 1.6 && (d <= 3.2 || (tooth && d <= 4.6))) p.px(x, y + oy, col);
        }
    };
    mark(shadow, 1);
    mark(glyph, 0);
    return c.toDataURL();
  };
  return { pause: make('pause', false), pauseOn: make('pause', true), gear: make('gear', false), gearOn: make('gear', true) };
}

/** Title crest (texture 'crest'): a gold-rimmed red shield with a big steel "3" over two crossed swords. */
export function buildCrest(scene: Phaser.Scene): void {
  const c = crestCanvas();
  if (scene.textures.exists('crest')) scene.textures.remove('crest');
  scene.textures.addCanvas('crest', c);
}

/**
 * The title logo (texture 'logo'): "Combo" over "Quest" in chunky chrome letters (the display font at 3x: a
 * white-to-steel gradient with a dark horizon line, bevelled edges, a 2 px ink outline and a 4 px navy
 * extrusion), with the crest beside the second line. Also 'logo_shine_0'..'logo_shine_<n-1>': a white gleam
 * sweeping across the letters, one frame each. Returns the frame count.
 */
export function buildLogo(scene: Phaser.Scene): number {
  const S = 3;
  const lines = [
    { m: glyphMask('Combo'), x: 3, y: 3 },
    { m: glyphMask('Quest'), x: 18, y: 28 },
  ];
  const crestX = lines[1].x + lines[1].m.w * S + 2;
  const crestY = 13;
  const W = crestX + 44 + 2;
  const H = lines[1].y + (lines[1].m.h + 0) * S + 8;
  const letter = (x: number, y: number) => {
    for (const l of lines) {
      const lx = Math.floor((x - l.x) / S);
      const ly = Math.floor((y - l.y) / S);
      if (x >= l.x && y >= l.y && l.m.on(lx, ly)) return l;
    }
    return null;
  };
  const L = new Uint8Array(W * H);
  const top = new Int16Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const l = letter(x, y);
      if (l) {
        L[y * W + x] = 1;
        top[y * W + x] = y - l.y;
      }
    }
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && L[y * W + x] === 1;
  // 2 px outline: within 2 px (corners rounded off)
  const near = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && on(x + dx, y + dy)) return true;
    return false;
  };
  const D = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (near(x, y)) D[y * W + x] = 1;
  const [c, p] = canvas(W, H);
  const EXT = ['#5e5090', '#413668', '#2f2650', '#211a38'];
  for (let d = 5; d >= 0; d--)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!D[y * W + x] || y + d >= H) continue;
        p.px(x, y + d, d === 5 || d === 0 ? INK : EXT[d - 1]);
      }
  const RAMP: Array<[number, string]> = [
    [2, '#ffffff'],
    [10, '#e8eef9'],
    [11, '#c9d1e4'],
    [13, '#6e7898'],
    [17, '#9aa4c0'],
    [20, '#b8c2d8'],
    [99, '#dfe6f4'],
  ];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!on(x, y)) continue;
      const ry = top[y * W + x];
      let col = RAMP.find(([lim]) => ry < lim)![1];
      if (!on(x, y + 1)) col = '#3a4262';
      else if (!on(x, y - 1)) col = '#ffffff';
      else if (!on(x + 1, y)) col = ry < 11 ? '#b8c2d8' : '#5a6484';
      else if (!on(x - 1, y)) col = ry < 11 ? '#ffffff' : '#c9d1e4';
      p.px(x, y, col);
    }
  p.ctx.drawImage(crestCanvas(), crestX, crestY);
  if (scene.textures.exists('logo')) scene.textures.remove('logo');
  scene.textures.addCanvas('logo', c);
  // the gleam: a slanted white band crossing the letters
  const N = 12;
  for (let i = 0; i < N; i++) {
    const [gc, gp] = canvas(W, H);
    const pos = -24 + ((W + 30) * i) / (N - 1);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!on(x, y)) continue;
        const u = x + y * 0.55 - pos;
        if (u >= 0 && u < 7) gp.px(x, y, u < 2 || u >= 5 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.95)');
      }
    const key = `logo_shine_${i}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, gc);
  }
  return N;
}

function crestCanvas(): HTMLCanvasElement {
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
  return c;
}
