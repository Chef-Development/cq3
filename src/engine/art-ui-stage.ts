// The modern menus' painted stages (docs/ui-style.md): one 327 x 150 backdrop per theme, painted on first use
// (`ensureStage`), never at boot. A stage is layers, back to front: a sky (or a wall) in dithered bands, a far
// silhouette (the theme's motif, low contrast, tinted toward the sky), a near silhouette, and a floor in perspective
// bands. The live parts (the stage disc, the spotlight, motes, the vignette) are drawn every frame by
// view/ui-modern.ts drawStage, so the same backdrop serves any layout. Themes are data: add one to STAGE_THEMES (and,
// if it needs a new silhouette, a motif painter below).
import type Phaser from 'phaser';

export type StageMotif = 'castle' | 'roofs' | 'gate' | 'pines' | 'cliffs' | 'crystals' | 'grove' | 'workshop' | 'arch' | 'vault' | 'none' | (string & {});

export interface StageSpec {
  /** Sky (or back wall) bands, top to bottom. */
  sky: string[];
  /** The far silhouette's body and its lit edge. */
  far: [string, string];
  /** The near silhouette's body and its lit edge. */
  near: [string, string];
  /** Floor bands, back (top) to front (bottom). */
  floor: string[];
  /** Where the floor starts (game px from the top). */
  floorY: number;
  motif: StageMotif;
  /** The live parts' colours: the light (cone, pool, motes), the stage disc [rim, top, side], the accent. */
  light: number;
  disc: [number, number, number];
  accent: number;
  /** A moon or a lamp in the sky: [x, y, r] (0: none). */
  orb?: [number, number, number];
  orbCol?: string;
  /** Little lights in the far layer (windows, stars, glowing mushrooms). */
  twinkle?: string;
}

/** The stages, by theme: the eight styles (the hero select, the skill trees), and the places other screens add. */
export const STAGE_THEMES: Record<string, StageSpec> = {
  blade: {
    sky: ['#0e1630', '#142044', '#1a2c58', '#22386a', '#2c4678', '#38567e'],
    far: ['#1c2a48', '#2c3c62'],
    near: ['#121a30', '#26345a'],
    floor: ['#2a2e44', '#323650', '#3a3e5a', '#2a2c40', '#1e2032'],
    floorY: 112,
    motif: 'castle',
    light: 0xbfd8ff,
    disc: [0x8aa0d0, 0x4a5a86, 0x2a3454],
    accent: 0x9ad8ff,
    orb: [258, 26, 9],
    orbCol: '#e8f0ff',
    twinkle: '#ffd890',
  },
  shadow: {
    sky: ['#120a24', '#1a1036', '#24164a', '#2e1c5a', '#3a2468', '#4a2e72'],
    far: ['#1e1236', '#2e1e4e'],
    near: ['#120a20', '#2a1a44'],
    floor: ['#22183a', '#2a1e46', '#32244e', '#22183a', '#160e28'],
    floorY: 114,
    motif: 'roofs',
    light: 0xdab0ff,
    disc: [0x9a7ad0, 0x4e3478, 0x2a1a44],
    accent: 0x5ae0d0,
    orb: [70, 24, 12],
    orbCol: '#f4ecff',
    twinkle: '#ffe0a0',
  },
  guardian: {
    sky: ['#101a24', '#162430', '#1e2e3c', '#263a48', '#2e4652', '#36505a'],
    far: ['#1e2c38', '#2e404c'],
    near: ['#141c24', '#34444e'],
    floor: ['#2e3236', '#383c40', '#42464a', '#30343a', '#22262a'],
    floorY: 113,
    motif: 'gate',
    light: 0xffd8a0,
    disc: [0xa0a8b0, 0x5a626c, 0x343a42],
    accent: 0xffb060,
  },
  marksman: {
    sky: ['#2a1a3a', '#4a2a48', '#7a3c4a', '#b0584a', '#d8844a', '#f0b060'],
    far: ['#3a2a40', '#5a3a48'],
    near: ['#1a1a24', '#2e2a36'],
    floor: ['#2a3024', '#323a28', '#3a4430', '#2a3022', '#1c2218'],
    floorY: 114,
    motif: 'pines',
    light: 0xffd090,
    disc: [0x9ab070, 0x4a6034, 0x2a361e],
    accent: 0xc8f0a0,
    orb: [240, 58, 14],
    orbCol: '#ffe8a0',
  },
  brute: {
    sky: ['#2a1410', '#3a1c14', '#4e2618', '#64321c', '#7a3e22', '#8a4a2a'],
    far: ['#3a2018', '#5a3424'],
    near: ['#24140e', '#4a2c1c'],
    floor: ['#4a3426', '#56402e', '#624a36', '#4a3628', '#34261c'],
    floorY: 112,
    motif: 'cliffs',
    light: 0xffb080,
    disc: [0xb08060, 0x6a4430, 0x3e2618],
    accent: 0xffb090,
  },
  controller: {
    sky: ['#0a1828', '#0e2236', '#142e46', '#1a3a56', '#224866', '#2a5674'],
    far: ['#1a3a56', '#3a6a8a'],
    near: ['#0e2238', '#4a88a8'],
    floor: ['#2a4a60', '#34586e', '#3e667c', '#2c4c62', '#1e3648'],
    floorY: 113,
    motif: 'crystals',
    light: 0xd0f8ff,
    disc: [0xb8e8f8, 0x5aa0c0, 0x2a5a78],
    accent: 0x6ad0f0,
    twinkle: '#d0f8ff',
  },
  summoner: {
    sky: ['#0a1a14', '#0e221a', '#142c20', '#1a3626', '#20402c', '#284a30'],
    far: ['#14301e', '#24482c'],
    near: ['#0c1e12', '#2a5030'],
    floor: ['#24381e', '#2c4424', '#34502a', '#263a20', '#1a2816'],
    floorY: 114,
    motif: 'grove',
    light: 0xd8f090,
    disc: [0x8ab060, 0x4a6a30, 0x2a401c],
    accent: 0xb4f070,
    twinkle: '#c8ff9a',
  },
  bomber: {
    sky: ['#1a120c', '#241810', '#302014', '#3c2818', '#48301c', '#523820'],
    far: ['#2e2014', '#4a3420'],
    near: ['#1a120a', '#3e2c1a'],
    floor: ['#3e2e20', '#4a3826', '#56422c', '#40301e', '#2c2014'],
    floorY: 112,
    motif: 'workshop',
    light: 0xffd890,
    disc: [0xc0905a, 0x6e4426, 0x4a2c18],
    accent: 0xff9a2a,
    twinkle: '#ffb040',
  },
  /** A quiet night clearing (companions). */
  night: {
    sky: ['#081218', '#0b161e', '#0e1a22', '#122230', '#162a34', '#1c3440'],
    far: ['#122530', '#1e3c44'],
    near: ['#0a141a', '#1c3436'],
    floor: ['#1c3028', '#22382e', '#284034', '#1e3228', '#14241c'],
    floorY: 114,
    motif: 'grove',
    light: 0xc8e8ff,
    disc: [0x6a9a78, 0x3a5a44, 0x223a2c],
    accent: 0x9ad8ff,
    orb: [262, 22, 8],
    orbCol: '#e6f6fb',
    twinkle: '#c8ff9a',
  },
};

// ------------------------------------------------------------------ painting

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const B4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

type Ctx = CanvasRenderingContext2D;

/** Bands top to bottom over [y0, y1), each edge dithered with a 4x4 ordered pattern. */
function bands(ctx: Ctx, w: number, y0: number, y1: number, cols: string[]): void {
  const n = cols.length;
  const h = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const f = ((y - y0) / h) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const frac = f - i;
    // the last third of each band dithers into the next one
    const t = (frac - 0.66) / 0.34;
    for (let x = 0; x < w; x++) {
      const next = i + 1 < n && t > 0 && t * 16 > B4[y & 3][x & 3] ? i + 1 : i;
      ctx.fillStyle = cols[next];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A silhouette from a height function (top y per column), its top row lit. */
function silhouette(ctx: Ctx, w: number, bottom: number, top: (x: number) => number, body: string, edge: string): void {
  for (let x = 0; x < w; x++) {
    const t = Math.round(top(x));
    if (t >= bottom) continue;
    ctx.fillStyle = body;
    ctx.fillRect(x, t, 1, bottom - t);
    ctx.fillStyle = edge;
    ctx.fillRect(x, t, 1, 1);
  }
}

/** Little lights dotted in a band (2 px, some pairs): windows, stars, glowing caps. */
function twinkles(ctx: Ctx, w: number, y0: number, y1: number, col: string, n: number, r: () => number): void {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w);
    const y = Math.floor(y0 + r() * (y1 - y0));
    ctx.fillRect(x, y, 1, 1);
    if (r() < 0.35) ctx.fillRect(x + 1, y, 1, 1);
  }
}

function orb(ctx: Ctx, cx: number, cy: number, rad: number, col: string): void {
  // a soft halo in two stepped rings, then the disc
  for (const [k, a] of [
    [2.2, 0.08],
    [1.6, 0.14],
  ] as const) {
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let y = -rad; y <= rad; y++)
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y > rad * rad) continue;
      ctx.fillStyle = col;
      ctx.fillRect(cx + x, cy + y, 1, 1);
      // a faint shade on the far side (a crescent of the same hue, not a grey wedge)
      if ((x - rad * 0.35) ** 2 + (y - rad * 0.35) ** 2 > (rad * 0.95) ** 2) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx + x, cy + y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
}

/** The far and near layers of a motif. */
function paintMotif(ctx: Ctx, w: number, sp: StageSpec, r: () => number): void {
  const fy = sp.floorY;
  const [fb, fe] = sp.far;
  const [nb, ne] = sp.near;
  switch (sp.motif) {
    case 'castle': {
      // far: a curtain wall with crenels and two towers; near: banners on poles
      silhouette(ctx, w, fy, (x) => {
        let t = 70 + (x % 10 < 5 ? 0 : 3);
        for (const tx of [40, 230]) if (x >= tx && x < tx + 24) t = 38 + ((x - tx) % 8 < 4 ? 0 : 3);
        return t;
      }, fb, fe);
      ctx.fillStyle = sp.twinkle ?? '#ffd890';
      for (const [x, y] of [
        [48, 52],
        [56, 60],
        [238, 50],
        [246, 64],
        [120, 82],
        [180, 84],
      ])
        ctx.fillRect(x, y, 2, 3);
      for (const bx of [16, 104, 214, 300]) {
        ctx.fillStyle = nb;
        ctx.fillRect(bx, 40, 2, fy - 40);
        ctx.fillStyle = '#8a1a22';
        ctx.fillRect(bx + 2, 44, 10, 22);
        ctx.fillStyle = '#d03030';
        ctx.fillRect(bx + 2, 44, 10, 2);
        ctx.fillRect(bx + 3, 66, 3, 3);
        ctx.fillRect(bx + 8, 66, 3, 3);
        ctx.fillStyle = '#f2c230';
        ctx.fillRect(bx + 6, 52, 2, 6);
      }
      break;
    }
    case 'roofs': {
      silhouette(ctx, w, fy, (x) => {
        const seg = Math.floor(x / 36);
        const local = x % 36;
        const h = 56 + ((seg * 37) % 22);
        return h + Math.abs(local - 18) * 0.6;
      }, fb, fe);
      if (sp.twinkle) twinkles(ctx, w, 72, fy - 6, sp.twinkle, 14, r);
      silhouette(ctx, w, fy, (x) => {
        const local = x % 54;
        return 88 + Math.abs(local - 27) * 0.5 + (x % 7 === 0 ? -2 : 0);
      }, nb, ne);
      break;
    }
    case 'gate': {
      // a great stone arch in the middle distance, torches either side
      silhouette(ctx, w, fy, (x) => 60 + Math.sin(x * 0.05) * 3, fb, fe);
      const ax = 220;
      ctx.fillStyle = nb;
      ctx.fillRect(ax - 34, 34, 68, fy - 34);
      ctx.fillStyle = ne;
      ctx.fillRect(ax - 34, 34, 68, 2);
      ctx.fillStyle = sp.sky[2];
      for (let y = 52; y < fy; y++) {
        const half = y < 70 ? Math.round(Math.sqrt(Math.max(0, 18 * 18 - (70 - y) * (70 - y)))) : 18;
        ctx.fillRect(ax - half, y, half * 2, 1);
      }
      for (const tx of [ax - 44, ax + 42]) {
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(tx, 70, 2, 14);
        ctx.fillStyle = '#ff9a2a';
        ctx.fillRect(tx - 1, 66, 4, 4);
        ctx.fillStyle = '#fff0a0';
        ctx.fillRect(tx, 67, 2, 2);
      }
      // stone blocks on the arch
      ctx.fillStyle = fe;
      for (let y = 38; y < fy; y += 6) for (let x = ax - 32 + ((y / 6) % 2) * 5; x < ax + 32; x += 10) ctx.fillRect(x, y, 1, 5);
      break;
    }
    case 'pines': {
      const tree = (cx: number, base: number, hgt: number, body: string, edge: string) => {
        for (let y = base - hgt; y < base; y++) {
          const k = (y - (base - hgt)) / hgt;
          const half = Math.round(1 + k * hgt * 0.32 + ((y % 5) < 2 ? -1 : 0));
          ctx.fillStyle = body;
          ctx.fillRect(cx - half, y, half * 2, 1);
          ctx.fillStyle = edge;
          ctx.fillRect(cx - half, y, 1, 1);
        }
      };
      for (let i = 0; i < 16; i++) tree(Math.floor(r() * w), fy - 6, 34 + Math.floor(r() * 20), fb, fe);
      for (let i = 0; i < 7; i++) tree(Math.floor(r() * w), fy + 4, 50 + Math.floor(r() * 26), nb, ne);
      break;
    }
    case 'cliffs': {
      silhouette(ctx, w, fy, (x) => 46 + Math.abs(Math.sin(x * 0.021) * 26) + (x % 13 < 3 ? 2 : 0), fb, fe);
      silhouette(ctx, w, fy, (x) => 78 + Math.abs(Math.sin(x * 0.043 + 1) * 18) + (x % 9 < 2 ? 1 : 0), nb, ne);
      // a crane and a hanging rock
      ctx.fillStyle = nb;
      ctx.fillRect(268, 30, 3, fy - 30);
      ctx.fillRect(240, 30, 32, 3);
      ctx.fillRect(246, 33, 1, 18);
      ctx.fillStyle = ne;
      ctx.fillRect(242, 51, 10, 7);
      break;
    }
    case 'crystals': {
      const spike = (cx: number, base: number, hgt: number, wid: number, body: string, edge: string) => {
        for (let y = base - hgt; y < base; y++) {
          const k = (y - (base - hgt)) / hgt;
          const half = Math.max(1, Math.round(k * wid));
          ctx.fillStyle = body;
          ctx.fillRect(cx - half, y, half * 2, 1);
          ctx.fillStyle = edge;
          ctx.fillRect(cx - half, y, Math.max(1, Math.round(half * 0.5)), 1);
        }
      };
      // a cave mouth: the ceiling hangs down
      silhouette(ctx, w, 30, () => 0, '#06101c', '#06101c');
      for (let x = 0; x < w; x++) {
        const d = 30 + Math.round(Math.abs(Math.sin(x * 0.07)) * 12 + (x % 11 < 3 ? 6 : 0));
        ctx.fillStyle = '#06101c';
        ctx.fillRect(x, 0, 1, d);
        ctx.fillStyle = '#1a3a56';
        ctx.fillRect(x, d - 1, 1, 1);
      }
      for (let i = 0; i < 12; i++) spike(Math.floor(r() * w), fy, 20 + Math.floor(r() * 30), 4 + Math.floor(r() * 5), fb, fe);
      for (let i = 0; i < 6; i++) spike(Math.floor(r() * w), fy + 6, 30 + Math.floor(r() * 30), 6 + Math.floor(r() * 5), nb, ne);
      if (sp.twinkle) twinkles(ctx, w, 40, fy, sp.twinkle, 18, r);
      break;
    }
    case 'grove': {
      const crown = (cx: number, cy: number, rad: number, body: string, edge: string) => {
        for (let y = -rad; y <= rad; y++)
          for (let x = -rad; x <= rad; x++) {
            const d = x * x + y * y * 1.3;
            if (d > rad * rad) continue;
            ctx.fillStyle = d > (rad - 1.5) ** 2 && y < 0 ? edge : body;
            ctx.fillRect(cx + x, cy + y, 1, 1);
          }
      };
      for (let i = 0; i < 12; i++) {
        const cx = Math.floor(r() * w);
        ctx.fillStyle = fb;
        ctx.fillRect(cx - 1, 60, 3, fy - 60);
        crown(cx, 50 + Math.floor(r() * 14), 14 + Math.floor(r() * 8), fb, fe);
      }
      for (let i = 0; i < 6; i++) {
        const cx = Math.floor(r() * w);
        ctx.fillStyle = nb;
        ctx.fillRect(cx - 2, 70, 5, fy - 70);
        crown(cx, 60 + Math.floor(r() * 12), 18 + Math.floor(r() * 8), nb, ne);
      }
      if (sp.twinkle) twinkles(ctx, w, 60, fy - 2, sp.twinkle, 16, r);
      break;
    }
    case 'workshop': {
      // a plank wall with shelves, barrels and a lamp
      ctx.fillStyle = fe;
      for (let x = 0; x < w; x += 12) ctx.fillRect(x, 16, 1, fy - 16);
      for (const sy of [44, 72]) {
        ctx.fillStyle = nb;
        ctx.fillRect(0, sy, w, 3);
        ctx.fillStyle = ne;
        ctx.fillRect(0, sy, w, 1);
        for (let x = 6; x < w; x += 22 + Math.floor(r() * 10)) {
          const h = 6 + Math.floor(r() * 8);
          ctx.fillStyle = r() < 0.5 ? '#6e4426' : '#4a5272';
          ctx.fillRect(x, sy - h, 6 + Math.floor(r() * 5), h);
        }
      }
      for (const bx of [24, 270, 294]) {
        ctx.fillStyle = '#4e2c16';
        ctx.fillRect(bx, fy - 20, 16, 20);
        ctx.fillStyle = '#2a2f45';
        ctx.fillRect(bx, fy - 16, 16, 2);
        ctx.fillRect(bx, fy - 6, 16, 2);
        ctx.fillStyle = '#8e5a2e';
        ctx.fillRect(bx + 2, fy - 20, 3, 20);
      }
      break;
    }
    default: {
      // a motif a screen registered from its own art file (registerStageTheme)
      MOTIFS.get(sp.motif)?.(ctx, w, sp, r);
      break;
    }
  }
}

/** A motif painter: the far and near layers between the sky and the floor (the context is the 327 x 150 canvas). */
export type MotifPainter = (ctx: CanvasRenderingContext2D, w: number, sp: StageSpec, r: () => number) => void;
const MOTIFS = new Map<string, MotifPainter>();

/**
 * Add a stage theme from a screen's own art file (the shrine, the vault, the companions' grove...): its spec and, for
 * a new motif, the painter of its layers. Keeps each screen's art in its own file (no edits to this one).
 */
export function registerStageTheme(name: string, spec: StageSpec, painter?: MotifPainter): void {
  STAGE_THEMES[name] = spec;
  if (painter) MOTIFS.set(spec.motif, painter);
}

/** Paint a stage's backdrop: the sky, the motif's layers, the floor. */
export function paintStage(sp: StageSpec, w = 327, h = 150, seed = 7): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const r = rng(seed);
  bands(ctx, w, 0, sp.floorY, sp.sky);
  if (sp.orb) orb(ctx, sp.orb[0], sp.orb[1], sp.orb[2], sp.orbCol ?? '#ffffff');
  if (sp.twinkle && (sp.motif === 'castle' || sp.motif === 'roofs' || sp.motif === 'pines')) twinkles(ctx, w, 4, 40, '#c8d8ff', 10, r);
  paintMotif(ctx, w, sp, r);
  bands(ctx, w, sp.floorY, h, sp.floor);
  // the floor's front edge catches a little light, and a few pebbles or seams
  ctx.fillStyle = sp.floor[0];
  ctx.fillRect(0, sp.floorY, w, 1);
  ctx.fillStyle = sp.floor[sp.floor.length - 1];
  for (let i = 0; i < 40; i++) ctx.fillRect(Math.floor(r() * w), sp.floorY + 3 + Math.floor(r() * (h - sp.floorY - 4)), 2, 1);
  return c;
}

/** The backdrop texture for `theme` (painted the first time it's asked for); returns its key. */
export function ensureStage(scene: Phaser.Scene, theme: string): string {
  const key = `uistage_${theme}`;
  if (scene.textures.exists(key)) return key;
  const sp = STAGE_THEMES[theme] ?? STAGE_THEMES.night;
  scene.textures.addCanvas(key, paintStage(sp));
  return key;
}
