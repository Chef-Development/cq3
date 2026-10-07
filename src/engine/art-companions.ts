// Companion art (see docs/art-style.md; looks from docs/content-bible.md section 4): the seven companions beside
// Pip. Each is painted from lit volumes (ellipses and strokes shaded like spheres from the top left onto short,
// hue-shifted ramps), with the face and small details stamped from character maps; toCanvas adds the 1px ink
// outline. Where a form sits in front of another, a line in the form's own darkest tone separates them (selective
// outlines).
//
// Textures, all facing right like Pip:
//   comp_${id}_idle0/1  PIP_W x PIP_H (36x24), the same box as Pip's frames so the fight view can swap them in. Ground
//                       companions (bun, newt, sprocket, brick, flurry) stand with their soles on row PIP_H - 2 (the
//                       bottom row is the outline): place them with origin (0.5, 1) on the ground line, or keep Pip's
//                       centre origin 12 px above it. mote and sunny hover like Pip (centre origin). idle0 -> idle1 is
//                       a breath (a 1px bob, an ear or tail twitch): for the ground ones ~300-400 ms a frame reads
//                       better than Pip's 110 ms flap; sunny flaps its wings and mote twinkles, so 110-160 ms suits.
//   comp_${id}_act      the attack pose, shown like pip_dive while it lunges: bun kicks, newt bites, sprocket zaps,
//                       brick headbutts, flurry bites (a frosty pounce), mote flares, sunny breathes fire.
//   comp_card_${id}     40x48 card (like the hero cards): the companion on a small mossy plinth before a soft glow in
//                       its rarity's colour with its own accent at the heart. comp_card_pip too (Pip's own frames are
//                       unchanged).
import { grid, put, stamp as stampAt, toCanvas, type Grid, type Pal } from './art';
import { ell, fill, lambert, or, rect, sphere, stroke, tone, type Inside, type Shader } from './art-paint';
import { bay } from './backdrop';

type Add = (key: string, canvas: HTMLCanvasElement) => void;
type Pose = 'idle0' | 'idle1' | 'act';

/** The companions drawn here (Pip's frames live in art.ts). */
export const COMPANION_ART = ['bun', 'newt', 'sprocket', 'brick', 'flurry', 'mote', 'sunny'] as const;
export type CompanionArtId = (typeof COMPANION_ART)[number];

// The companion box (Pip's: art.ts PIP_W x PIP_H), repeated here as plain numbers so this module never reads art.ts
// bindings while the modules load.
const W = 36;
const H = 24;
/** The soles' row for ground companions (the row under it is the outline). */
const FEET = H - 2;

// ------------------------------------------------------------------ ramps (dark -> light, hue-shifted)

const FUR_W = ['#4e4870', '#8a86ac', '#bdbbd6', '#e6e4f0', '#ffffff']; // white fur, shadows lean lavender
const PINK = ['#8a3a5a', '#d06a8a', '#f2a0b4', '#ffd0dc'];
const LEATHER = ['#2e1a0e', '#4e2c16', '#7a4624', '#a8683a', '#d09a5e'];
const GOLD = ['#5a3410', '#9a5a14', '#d8901c', '#f2c230', '#fff0a0'];

// ------------------------------------------------------------------ painting helpers

/** stamp (art.ts) at the nearest whole pixel. */
const stamp = (g: Grid, rows: string[], pal: Pal, x: number, y: number) => stampAt(g, rows, pal, Math.round(x), Math.round(y));

/**
 * Fill a form over what's already painted. With `sep`, the form's pixels that touch earlier paint (not of this
 * form) take that tone: a line in the form's own dark that parts it from what's behind.
 */
function form(g: Grid, inside: Inside, shade: Shader, sep?: string): void {
  const before = sep ? g.map((r) => r.slice()) : null;
  fill(g, inside, shade);
  if (!before || !sep) return;
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      if (!inside(x, y)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inside(nx, ny) && before[ny]?.[nx]) {
          g[y][x] = sep;
          break;
        }
      }
    }
}

/** An ellipse lit as a sphere, optionally parted from what's behind by a line in the ramp's darkest tone. */
function blob(g: Grid, ramp: string[], cx: number, cy: number, rx: number, ry: number, o: { bias?: number; sep?: boolean | string } = {}): void {
  const sep = typeof o.sep === 'string' ? o.sep : o.sep ? ramp[0] : undefined;
  form(g, ell(cx, cy, rx, ry), sphere(ramp, cx - rx * 0.25, cy - ry * 0.25, rx * 1.25, ry * 1.25, o.bias ?? 0, 0.12), sep);
}

/** Pixels of a polyline (1px), for straps, seams and whiskers. */
function line(g: Grid, pts: Array<[number, number]>, c: string | ((i: number) => string)): void {
  let i = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[k + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let s = k === 0 ? 0 : 1; s <= n; s++) put(g, ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n, typeof c === 'string' ? c : c(i++));
  }
}

/** Erase a pixel (a hole the outline then rings). */
function clear(g: Grid, x: number, y: number): void {
  const row = g[Math.round(y)];
  if (row && Math.round(x) >= 0 && Math.round(x) < row.length) row[Math.round(x)] = null;
}

/** A cute eye: dark with a glint toward the light (`tall` 3 rows, else 2), an optional coloured lower pixel. */
function eye(g: Grid, x: number, y: number, o: { tall?: boolean; big?: boolean; iris?: string; dark?: string; shut?: boolean } = {}): void {
  const k = o.dark ?? '#1c1028';
  x = Math.round(x);
  y = Math.round(y);
  if (o.shut) {
    put(g, x, y + 1, k);
    put(g, x + 1, y + 1, k);
    return;
  }
  const rows = o.big ? ['Wkk', 'kkk', '.ik'] : o.tall ? ['Wk', 'kk', 'ik'] : ['Wk', 'ik'];
  stamp(g, rows, { W: '#ffffff', k, i: o.iris ?? k }, x, y);
}

/** A painter may hand back a glow pass, drawn over the outlined canvas (soft light that wears no outline). */
type Glow = ((ctx: CanvasRenderingContext2D) => void) | void;

function frame(paint: (g: Grid) => Glow): HTMLCanvasElement {
  return framed(paint).canvas;
}

/** A frame and its lowest painted row. */
function framed(paint: (g: Grid) => Glow): { canvas: HTMLCanvasElement; feet: number } {
  const g = grid(W, H);
  const glow = paint(g);
  const canvas = toCanvas(g);
  if (glow) glow(canvas.getContext('2d')!);
  return { canvas, feet: lowestRow(g) };
}

/** A translucent pixel (for glow passes). */
function dot(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, a: number): void {
  const [r, gg, b] = rgb(c);
  ctx.fillStyle = `rgba(${r},${gg},${b},${a})`;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

// ------------------------------------------------------------------ Bun: a fluffy white rabbit with a tiny satchel

function bun(g: Grid, pose: Pose): void {
  const F = { bias: 0.34 };
  if (pose !== 'act') {
    const bob = pose === 'idle1' ? 1 : 0;
    const hx = 21;
    const hy = 11 + bob;
    const SEP = FUR_W[1];
    // far ear behind the head, leaning back
    stroke(g, [[hx - 3, hy - 4], [hx - 5.5, hy - 8.5]], 1.5, sphere(FUR_W, hx - 6, hy - 9, 3, 6, 0.12));
    // the fluffy tail, the round body, the big hind foot
    blob(g, FUR_W, 8.5, 18.5, 2.4, 2.4, F);
    blob(g, FUR_W, 14.5, 17.5 + bob * 0.5, 5.4, 4.6, { ...F, sep: SEP });
    blob(g, FUR_W, 14, FEET - 0.4, 3.6, 1.3, { sep: SEP, bias: 0.1 });
    // satchel strap over the shoulder, the little bag on the hip with a gold clasp
    line(g, [[hx - 4, hy + 3], [12, 18 + bob]], (i) => (i % 3 === 0 ? LEATHER[4] : LEATHER[3]));
    const by = 17 + bob;
    form(g, rect(9, by, 12, by + 2), (x, y) => (y === by ? LEATHER[4] : x === 12 || y === by + 2 ? LEATHER[2] : LEATHER[3]), LEATHER[1]);
    put(g, 11, by + 1, GOLD[4]);
    // the head, a tuft at the back of the cheek
    blob(g, FUR_W, hx, hy, 6.4, 5.4, { ...F, sep: SEP });
    put(g, hx - 7, hy + 2, FUR_W[3]);
    // near ear, upright, pink inside
    stroke(g, [[hx - 0.5, hy - 4], [hx - 1.5, hy - 9 + bob * 0.5]], 1.6, sphere(FUR_W, hx - 2.5, hy - 9, 3, 6, 0.25));
    line(g, [[hx - 1, hy - 5], [hx - 1.5, hy - 8]], PINK[2]);
    // front paws
    blob(g, FUR_W, 22.5, FEET - 0.4, 1.7, 1.2, { sep: SEP, bias: 0.25 });
    blob(g, FUR_W, 20, FEET - 0.2, 1.5, 1.1, { sep: SEP, bias: 0.05 });
    // face: a big eye, a pink nose, rosy cheeks
    eye(g, hx + 1, hy - 2, { big: true, iris: '#7a5aa8' });
    put(g, hx + 6, hy, PINK[1]);
    put(g, hx + 6, hy - 1, PINK[3]);
    put(g, hx + 5, hy + 2, FUR_W[1]);
    put(g, hx + 2, hy + 2, PINK[2]);
    put(g, hx + 3, hy + 2, PINK[3]);
    return;
  }
  // the kick: leaning back on the tucked foot, one hind leg snapped out to the right, ears streaming back
  const hx = 15;
  const hy = 8.5;
  stroke(g, [[hx - 3, hy - 1], [hx - 10, hy - 1]], 1.4, sphere(FUR_W, hx - 11, hy - 2, 5, 3, 0.32));
  blob(g, FUR_W, 8.5, 17.5, 2.3, 2.3, F);
  blob(g, FUR_W, 14, 15.5, 5.6, 4.6, { ...F, sep: true });
  blob(g, FUR_W, 13, FEET - 0.6, 3.2, 1.3, { sep: true, bias: 0.1 });
  // the kicking leg and its big foot, pink pads on the sole
  stroke(g, [[17, 16.5], [26, 15.5]], 1.7, sphere(FUR_W, 20, 14, 9, 4, 0.2));
  blob(g, FUR_W, 28.5, 15, 3.2, 1.8, { sep: true, bias: 0.25 });
  put(g, 31, 14, PINK[2]);
  put(g, 31, 15, PINK[1]);
  // the satchel swings out behind
  line(g, [[hx - 3, hy + 3], [8, 13]], LEATHER[3]);
  form(g, rect(4, 12, 8, 15), (x, y) => (y === 12 ? LEATHER[4] : x === 8 || y === 15 ? LEATHER[2] : LEATHER[3]), LEATHER[1]);
  stamp(g, ['hhhh', '.G..'], { h: LEATHER[2], G: GOLD[4] }, 5, 13);
  blob(g, FUR_W, hx, hy, 6.2, 5.3, { ...F, sep: true });
  stroke(g, [[hx - 2, hy - 3.5], [hx - 10, hy - 5.5]], 1.6, sphere(FUR_W, hx - 9, hy - 7, 6, 3, 0.25));
  line(g, [[hx - 3, hy - 4.5], [hx - 8, hy - 5.5]], PINK[2]);
  // a paw up in guard
  blob(g, FUR_W, 20.5, 13, 1.6, 1.4, { sep: true, bias: 0.25 });
  // "hi-yah!": a fierce eye under a set brow, mouth open
  eye(g, hx + 2, hy - 1, { tall: true, iris: '#6a4a8a' });
  put(g, hx + 1, hy - 2, FUR_W[0]);
  put(g, hx + 2, hy - 2, FUR_W[0]);
  put(g, hx + 3, hy - 3, FUR_W[1]);
  put(g, hx + 6, hy + 1, PINK[1]);
  stamp(g, ['kk', 'rk'], { k: '#3a1830', r: PINK[1] }, hx + 4, hy + 2);
  // speed lines
  for (const [x, y, n] of [
    [0, 11, 3],
    [1, 15, 2],
    [0, 19, 3],
  ])
    for (let k = 0; k < n; k++) put(g, x + k, y, '#ffffff');
}

// ------------------------------------------------------------------ Newt: a small orange salamander, flame-tipped tail

const NEWT = ['#4a1420', '#8e2a1c', '#d0501c', '#f07e24', '#ffb04a', '#ffe08a']; // orange skin, shadows lean crimson
const BELLY = ['#a8501c', '#e8902a', '#ffc860', '#fff0b0'];
const FLAME = ['#a8241c', '#e0461c', '#f87a1e', '#ffb02a', '#ffe070', '#fff8d0'];

/** A teardrop flame standing on (x, y) (its foot), `h` tall, leaning `lean` px at the tip; `f` varies the flicker. */
function flame(g: Grid, x: number, y: number, h: number, lean: number, f: number): void {
  const r = h * 0.36;
  for (let yy = Math.floor(y - h); yy <= y; yy++)
    for (let xx = Math.floor(x - r - 2); xx <= x + r + 2 + Math.abs(lean); xx++) {
      const t = (y - (yy + 0.5)) / h; // 0 at the foot, 1 at the tip
      if (t < 0 || t > 1) continue;
      const cx = x + lean * t * t;
      const w = t < 0.35 ? r * Math.sqrt(1 - ((0.35 - t) / 0.35) ** 2) : r * (1 - (t - 0.35) / 0.65) ** 1.3;
      const d = Math.abs(xx + 0.5 - cx);
      if (d > w + 0.15) continue;
      // hottest low in the middle
      const heat = (1 - t) * 0.75 + (1 - d / Math.max(0.6, w)) * 0.55 + ((xx + yy + f) % 3 === 0 ? 0.06 : 0);
      put(g, xx, yy, tone(FLAME, heat * 0.85 + 0.12));
    }
}

function newt(g: Grid, pose: Pose): void {
  const SEP = NEWT[1];
  const act = pose === 'act';
  const f = pose === 'idle1' ? 1 : 0;
  const B = { bias: 0.32 };
  const dx = act ? 2 : 0; // the whole front lunges forward in the bite
  const hx = 24 + dx;
  const hy = 13.5 + (act ? 0.5 : f * 0.5);
  // the tail curls up behind, a flame on its tip
  const tail: Array<[number, number]> = [
    [12, 18.5],
    [7.5, 18.5],
    [4.5, 16],
    [4.5, 12.5],
    [6.5, 10.5],
  ];
  stroke(g, tail, (t) => 2.4 - t * 1.4, sphere(NEWT, 6, 13, 7, 7, 0.22));
  // far legs, the body, the near legs (splayed toes)
  for (const lx of [13, 20 + dx]) blob(g, NEWT, lx + 1.2, FEET - 0.5, 1.4, 1.2, { bias: 0 });
  blob(g, NEWT, 16 + dx / 2, 18.3, 6.8 + dx / 2, 3.6, { ...B, sep: SEP });
  for (let x = 11; x <= 20 + dx; x++) put(g, x, 21, x % 2 ? BELLY[2] : BELLY[1]);
  for (const [x, y] of [
    [12, 16],
    [15, 15],
    [18, 15.5],
  ])
    put(g, x + dx / 2, y, NEWT[2]);
  for (const lx of [11.5, 18.5 + dx]) {
    blob(g, NEWT, lx, FEET - 0.6, 1.5, 1.3, { sep: SEP, bias: 0.25 });
    put(g, lx + 1.5, FEET, NEWT[4]);
  }
  // the head: big and round, both eyes up top
  blob(g, NEWT, hx, hy, 6, 5, { ...B, sep: SEP });
  if (act) {
    // the bite: jaws wide, a pink tongue, two little fangs
    const mouth: Inside = (x, y) => x >= hx - 1 && Math.abs(y + 0.5 - (hy + 2)) < (x + 0.5 - (hx - 1.5)) * 0.42 && ell(hx, hy, 6.4, 5.4)(x, y);
    fill(g, mouth, (_x, y) => (y + 0.5 > hy + 2.6 ? '#e05a78' : '#5a1428'));
    put(g, hx + 4, hy + 0.5, '#fff8e8');
    put(g, hx + 4, hy + 3.5, '#fff8e8');
    // eyes squeezed in glee
    stamp(g, ['k...k', '.k.k.'], { k: '#2a1018' }, hx - 3, hy - 3);
    stamp(g, ['k.k', '.k.'], { k: '#2a1018' }, hx + 2, hy - 3);
  } else {
    // a wide, happy smile and rosy cheeks
    line(g, [[hx - 1, hy + 2], [hx + 1, hy + 3], [hx + 3, hy + 3], [hx + 5, hy + 1.5]], NEWT[1]);
    put(g, hx - 3, hy + 2, '#f07888');
    put(g, hx - 2, hy + 2, '#ff9aa0');
    // big eyes: the near one, and the far one peeking over the snout
    eye(g, hx - 2, hy - 3, { big: true, iris: '#8a3a12' });
    eye(g, hx + 2, hy - 3, { tall: true, iris: '#8a3a12' });
  }
  put(g, hx + 5, hy - 0.5, NEWT[1]); // nostril
  // the tail flame flickers (it flares in the bite)
  flame(g, 6.6, 10, act ? 8 : 6 + f, act ? 1.5 : f ? -1 : 1, f);
}

// ------------------------------------------------------------------ Sprocket: a little clockwork robot with a wind-up key

const BRASS = ['#3e2210', '#7a4a1a', '#b8802a', '#e2b048', '#fbe08a', '#fffbd8'];
const STEEL = ['#2a2f45', '#4a5272', '#7c86a6', '#b8c2d8', '#eef3fa'];
const GLOW = ['#14524e', '#22a098', '#62e4d4', '#d8fff6'];
const ZAP = ['#1a3c8a', '#4aa0f0', '#9ad8ff', '#ffffff'];

/** A rectangle with its corners rounded off by radius `r`. */
const rbox =
  (x0: number, y0: number, x1: number, y1: number, r: number): Inside =>
  (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
    const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5;
  };

/** Metal lit like a box from the top left: a bright top edge and left face, a dark right face and underside. */
const boxLit =
  (ramp: string[], inside: Inside, base = 0.55): Shader =>
  (x, y) => {
    let v = base;
    if (!inside(x, y - 1)) v += 0.4;
    else if (!inside(x, y - 2)) v += 0.15;
    if (!inside(x - 1, y)) v += 0.18;
    if (!inside(x + 1, y)) v -= 0.3;
    if (!inside(x, y + 1)) v -= 0.4;
    return tone(ramp, v);
  };

function sprocket(g: Grid, pose: Pose): void {
  const act = pose === 'act';
  const f = pose === 'idle1' ? 1 : 0;
  const bob = f; // it hums up and down on its springs
  // the wind-up key on its back: face-on, then edge-on as it turns
  const ky = 14 + bob;
  line(g, [[10, ky], [13, ky]], STEEL[2]);
  if (f) {
    const edge = rbox(8, ky - 4, 9, ky + 4, 1);
    form(g, edge, boxLit(BRASS, edge));
  } else {
    for (const oy of [-2.6, 2.6]) {
      const loop = ell(7, ky + oy + 0.5, 2.6, 2.3);
      form(g, loop, sphere(BRASS, 6, ky + oy, 3.4, 3, 0.15));
      clear(g, 6.5, ky + oy);
    }
    put(g, 9, ky, BRASS[2]);
  }
  // legs and feet
  for (const lx of [15, 20]) {
    form(g, rect(lx, 18, lx + 1, 21), (x) => (x === lx ? STEEL[3] : STEEL[1]));
    const foot = rbox(lx - 1, 21, lx + 3, FEET, 1);
    form(g, foot, boxLit(STEEL, foot));
  }
  // the body: a brass drum with a little dial and rivets
  const body = rbox(13, 12 + bob, 24, 19 + bob, 2);
  form(g, body, boxLit(BRASS, body), BRASS[1]);
  form(g, ell(18.5, 15.8 + bob, 2, 2), (x, y) => (x + y < 33 + bob ? STEEL[4] : STEEL[3]), STEEL[1]);
  put(g, 18.5, 15 + bob, '#d03030');
  put(g, 18.5, 16 + bob, '#d03030');
  for (const x of [14.5, 22.5]) put(g, x, 13.5 + bob, BRASS[5]);
  // the head: a rounded brass box with a dark face plate and glowing eyes
  const hx = 19;
  const hy = 7 + bob;
  const head = rbox(hx - 6, hy - 4, hx + 6, hy + 5, 3);
  form(g, head, boxLit(BRASS, head), BRASS[1]);
  // antenna with a red bulb
  stamp(g, ['qr', 'rR'], act ? { q: '#ffffff', r: ZAP[2], R: ZAP[1] } : { q: '#ff9a80', r: '#e04038', R: '#9a1a22' }, hx - 1, hy - 6);
  const plate = rbox(hx - 3, hy - 2, hx + 5, hy + 3, 2);
  form(g, plate, (_x, y) => (y === hy - 2 ? '#2c3858' : '#161c34'));
  // eyes: round, glowing (white-hot when it zaps)
  for (const ex of [hx - 1, hx + 2.5]) stamp(g, ['ab', 'bc'], act ? { a: '#ffffff', b: GLOW[3], c: GLOW[2] } : { a: GLOW[3], b: GLOW[2], c: GLOW[1] }, ex, hy - 1);
  line(g, [[hx, hy + 2], [hx + 1, hy + 2.5], [hx + 2, hy + 2.5], [hx + 3, hy + 2]], GLOW[act ? 3 : 2]);
  // the side bolt (an ear)
  form(g, ell(hx - 5, hy + 1, 1.4, 1.6), (x, y) => (x + y < hx + hy - 4 ? STEEL[4] : STEEL[2]), STEEL[1]);
  if (!act) {
    // the near arm at its side, a round brass hand
    line(g, [[23.5, 14 + bob], [25, 16 + bob]], STEEL[3]);
    blob(g, BRASS, 25.5, 17 + bob, 1.6, 1.6, { sep: BRASS[1], bias: 0.15 });
    return;
  }
  // the zap: the arm thrust out, sparks leaping from the hand in a crackling bolt
  line(g, [[23.5, 14], [27, 13]], STEEL[3]);
  line(g, [[23.5, 15], [27, 14]], STEEL[1]);
  blob(g, BRASS, 28, 13.5, 1.7, 1.7, { sep: BRASS[1], bias: 0.25 });
  const bolt: Array<[number, number]> = [
    [30, 13],
    [31, 11],
    [33, 14],
    [34, 12],
    [35, 13],
  ];
  // a fat glow round the bolt, then its white-hot core
  for (let k = 0; k < bolt.length - 1; k++) {
    const [ax, ay] = bolt[k];
    const [bx, by] = bolt[k + 1];
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= n; s++) {
      const x = ax + ((bx - ax) * s) / n;
      const y = ay + ((by - ay) * s) / n;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ])
        if (!g[Math.round(y + dy)]?.[Math.round(x + dx)]) put(g, x + dx, y + dy, ZAP[1]);
    }
  }
  line(g, bolt, (i) => (i % 2 ? ZAP[3] : ZAP[2]));
  for (const [x, y] of [
    [30, 9],
    [33, 17],
    [29, 16],
  ])
    put(g, x, y, ZAP[2]);
}

// ------------------------------------------------------------------ Brick: a rock golem pup with moss on its back

const ROCK = ['#24222e', '#3e3a48', '#5e5866', '#867e86', '#ada49e', '#d2c8b6']; // shadows lean violet, light leans sand
const MOSS = ['#1a3626', '#2a5230', '#447436', '#6e9c3c', '#a8c850', '#d8f080'];

/** Moss over the top of a form: every pixel within `depth` of its top edge (ragged), lit from the top left. */
function mossTop(g: Grid, inside: Inside, x0: number, x1: number, depth: (x: number) => number): void {
  for (let x = x0; x <= x1; x++) {
    let y = 0;
    while (y < H && !inside(x, y)) y++;
    if (y >= H) continue;
    const d = depth(x);
    for (let k = 0; k < d; k++) if (inside(x, y + k)) put(g, x, y + k, MOSS[k === 0 ? (x < (x0 + x1) / 2 ? 5 : 4) : k === d - 1 ? 2 : 3]);
  }
}

/** Rock: lit like a box, flecked with lighter grit and darker pits. */
const rockLit =
  (inside: Inside, base: number): Shader =>
  (x, y) => {
    const c = boxLit(ROCK, inside, base)(x, y);
    if (!c || c === ROCK[0] || c === ROCK[ROCK.length - 1]) return c;
    const i = ROCK.indexOf(c);
    if ((((x >> 1) * 7 + y * 13) % 11) === 0) return ROCK[Math.min(ROCK.length - 1, i + 1)];
    if ((((x >> 1) * 5 + y * 3) % 13) === 0) return ROCK[Math.max(1, i - 1)];
    return c;
  };

function brick(g: Grid, pose: Pose): void {
  const act = pose === 'act';
  const f = pose === 'idle1' ? 1 : 0;
  const SEP = ROCK[1];
  // the head's box: up and alert, or ducked low and forward for the headbutt
  const [hx0, hy0] = act ? [22, 10] : [19, 6 + f];
  const head = rbox(hx0, hy0, hx0 + 11, hy0 + 10, 5);
  // far legs behind the body
  for (const lx of [10, 18]) {
    const leg = rbox(lx + 1, 17, lx + 4, FEET, 1);
    form(g, leg, rockLit(leg, 0.35));
  }
  // a stubby tail, wagging
  const tx = act ? 5 : 6;
  const ty = act ? 13 : 12 - f;
  form(g, rbox(tx, ty, tx + 3, ty + 2, 1), rockLit(rbox(tx, ty, tx + 3, ty + 2, 1), 0.6));
  // the body, with moss and a little flower on its back
  const by = act ? 13 : 12;
  const body = rbox(8, by, 22, 20, 3);
  form(g, body, rockLit(body, 0.52), SEP);
  mossTop(g, body, 9, 20, (x) => 2 + ((x * 7) % 5 === 0 ? 1 : 0) + (x > 10 && x < 15 ? 1 : 0));
  stamp(g, ['.p.', 'pYp', '.p.'], { p: '#f2a0b4', Y: '#ffe070' }, 12, by - 2);
  put(g, 13, by + 1, MOSS[2]);
  // cracks on the flank
  line(g, [[11, by + 4], [12, by + 5], [12, by + 6]], ROCK[1]);
  line(g, [[18, by + 3], [17, by + 5]], ROCK[1]);
  // near legs
  for (const lx of act ? [8, 16] : [9, 16]) {
    const leg = rbox(lx, 17, lx + 3, FEET, 1);
    form(g, leg, rockLit(leg, 0.6), SEP);
    put(g, lx + 1, FEET, ROCK[1]); // toes
  }
  // the head, two little rock ears, and moss on the crown
  for (const ex of [hx0 + 1, hx0 + 6]) {
    const ear = (x: number, y: number) => y >= hy0 - 3 && y <= hy0 + 1 && x >= ex && x <= ex + 3 && x - ex >= (hy0 - y) * 0.6 - 0.4 && ex + 3 - x >= (hy0 - y) * 0.6 - 0.4;
    form(g, ear, rockLit(ear, 0.55));
  }
  form(g, head, rockLit(head, 0.65), SEP);
  mossTop(g, head, hx0 + 2, hx0 + 6, (x) => (x === hx0 + 4 ? 2 : 1));
  // the snout: a lighter block with a dark nose
  const snout = rbox(hx0 + 7, hy0 + 5, hx0 + 12, hy0 + 9, 2);
  form(g, snout, rockLit(snout, 0.8), SEP);
  stamp(g, ['kk', 'k.'], { k: '#1c1824' }, hx0 + 11, hy0 + 5);
  if (act) {
    // eyes squeezed shut, braced for the hit
    line(g, [[hx0 + 4, hy0 + 3], [hx0 + 5, hy0 + 4], [hx0 + 4, hy0 + 5]], '#1c1824');
    line(g, [[hx0 + 9, hy0 + 3], [hx0 + 8, hy0 + 4], [hx0 + 9, hy0 + 5]], '#1c1824');
    // impact: a burst of pebbles and lines off the brow
    for (const [x, y] of [
      [35, 9],
      [34, 13],
      [35, 17],
    ])
      put(g, x, y, '#ffffff');
    stamp(g, ['ab', 'bc'], { a: ROCK[5], b: ROCK[3], c: ROCK[2] }, 33, 5);
    stamp(g, ['ab', 'b.'], { a: ROCK[5], b: ROCK[3] }, 31, 21);
    line(g, [[1, 11], [3, 11]], '#ffffff');
    line(g, [[0, 15], [2, 15]], '#ffffff');
  } else {
    // big glowing eyes: the pup's heart is a little rune-fire
    eye(g, hx0 + 3, hy0 + 3, { big: true, dark: '#0e3a3a', iris: GLOW[2] });
    eye(g, hx0 + 8, hy0 + 3, { tall: true, dark: '#0e3a3a', iris: GLOW[2] });
    put(g, hx0 + 2, hy0 + 7, '#e8909a'); // a rosy pebble cheek
    line(g, [[hx0 + 9, hy0 + 9], [hx0 + 10, hy0 + 9]], ROCK[1]); // a grin under the snout
  }
}

// ------------------------------------------------------------------ Flurry: a white snow fox with a frosty tail

const FROST = ['#3a4678', '#7488bc', '#b0c4e6', '#e0ecfa', '#ffffff']; // white fur, shadows lean icy blue
const ICE = ['#1a4a8a', '#3a8ad8', '#7ad0f6', '#c8f2ff', '#ffffff'];

/** A pointed ear: a triangle from a base (x0..x1 at row y) up to a tip, filled from inside-tests. */
const ear =
  (x0: number, x1: number, y: number, tx: number, ty: number): Inside =>
  (x, yy) => {
    if (yy > y || yy < ty) return false;
    const t = (y - (yy + 0.5)) / (y - ty); // 0 at the base, 1 at the tip
    const l = x0 + (tx - x0) * t;
    const r = x1 + (tx - x1) * t;
    return x + 0.5 >= l - 0.2 && x + 0.5 <= r + 0.2;
  };

function flurry(g: Grid, pose: Pose): void {
  const act = pose === 'act';
  const f = pose === 'idle1' ? 1 : 0;
  const SEP = FROST[1];
  const B = { bias: 0.3 };
  const lift = act ? -2 : 0; // the pounce lifts it off the ground
  // the big frosty tail, curling up behind (it swishes)
  const tail: Array<[number, number]> = act
    ? [
        [10, 14],
        [6, 12.5],
        [3.5, 10],
        [3, 6.5],
      ]
    : [
        [10, 17],
        [6, 16],
        [3.5, 12.5],
        [4 + f, 8],
      ];
  const [tx, ty] = tail[tail.length - 1];
  stroke(g, tail, (t) => 1.7 + Math.sin(t * Math.PI * 0.9) * 1.6, (x, y) => {
    // white fur at the root, frosting to ice at the tip
    const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty);
    const lit = 0.25 + 0.95 * lambert((x + 0.5 - 5) / 6, (y + 0.5 - 12) / 7);
    return d < 2.6 ? tone(ICE.slice(1, 4), lit) : d < 3.6 ? tone(ICE.slice(2), lit) : tone(FROST, lit + 0.1);
  });
  // far legs
  if (act) {
    stroke(g, [[11, 15 + lift], [7, 19]], 1, sphere(FROST, 8, 16, 4, 4, 0));
    stroke(g, [[20, 15 + lift], [25, 19]], 1, sphere(FROST, 22, 16, 4, 4, 0));
  } else for (const lx of [11, 19]) form(g, rect(lx + 1, 18, lx + 2, FEET), (x) => (x === lx + 1 ? FROST[2] : FROST[1]));
  // the body
  blob(g, FROST, 15, (act ? 14 : 16.5) + lift * 0, act ? 7 : 6.5, act ? 3.6 : 3.8, { ...B, sep: SEP });
  // near legs, slender, with icy socks
  if (act) {
    stroke(g, [[13, 16], [9, 20]], 1.1, sphere(FROST, 10, 17, 4, 4, 0.2));
    stroke(g, [[20, 16], [27, 18]], 1.1, sphere(FROST, 23, 16, 5, 4, 0.2));
    put(g, 9, 20, ICE[2]);
    put(g, 28, 18, ICE[2]);
  } else
    for (const lx of [10, 18]) {
      form(g, rect(lx, 18, lx + 1, FEET), (x, y) => (y >= FEET - 1 ? ICE[x === lx ? 3 : 2] : x === lx ? FROST[3] : FROST[2]), SEP);
    }
  // the head: round, with a pointed snout and cheek ruffs
  const hx = act ? 26 : 23.5;
  const hy = act ? 11 : 10.5 + f * 0.5;
  const ears = [ear(hx - 4.5, hx - 1.5, hy - 2, hx - 4.5, hy - 7.5), ear(hx - 1, hx + 2.5, hy - 2.5, hx + (act ? -2 : 0.5), hy - 8)];
  form(g, ears[0], sphere(FROST, hx - 4, hy - 6, 3, 5, 0.05));
  blob(g, FROST, hx, hy, 4.6, 4, { ...B, sep: SEP });
  // the cheek ruff: white tufts at the back of the jaw
  for (const [x, y] of [
    [hx - 4, hy + 3],
    [hx - 3, hy + 4],
    [hx - 2, hy + 4],
  ])
    put(g, x, y, FROST[4]);
  form(g, ears[1], sphere(FROST, hx, hy - 6, 3, 5, 0.25), SEP);
  // icy inner ear
  line(g, [[hx + 0.5, hy - 3.5], [hx + (act ? -1.5 : 0.5), hy - 6]], ICE[2]);
  // the snout
  const snout: Inside = (x, y) => {
    const t = (x + 0.5 - (hx + 1)) / 5;
    return t >= 0 && t <= 1 && y + 0.5 >= hy + 0.2 - (1 - t) * 1.6 && y + 0.5 <= hy + 2.6 - t * 0.9;
  };
  form(g, snout, (_x, y) => (y < hy + 1 ? FROST[4] : FROST[3]));
  put(g, hx + 6, hy + 0.8, '#1c1830'); // nose
  if (act) {
    // the bite: jaws open, a puff of frost
    fill(g, (x, y) => x >= hx + 2 && x <= hx + 5 && y === Math.round(hy + 2), () => '#5a2440');
    for (let x = hx + 2; x <= hx + 5; x++) put(g, x, hy + 3, FROST[3]);
    put(g, hx + 4, hy + 3, '#ffffff');
    for (const [x, y, c] of [
      [33, 12, ICE[3]],
      [34, 13, ICE[2]],
      [33, 14, ICE[3]],
      [35, 11, ICE[4]],
      [35, 15, ICE[2]],
    ] as Array<[number, number, string]>)
      put(g, x, y, c);
    // a fierce, narrowed eye
    stamp(g, ['kkk', 'Wki'], { k: '#1c1830', W: '#ffffff', i: ICE[1] }, hx, hy - 1);
  } else {
    eye(g, hx, hy - 1.5, { big: true, iris: ICE[1] });
    put(g, hx + 4, hy + 2.5, FROST[1]); // a sly little smile
    put(g, hx + 5, hy + 2, FROST[1]);
  }
  // frost sparkles round the tail tip
  for (const [dx, dy] of f || act ? [[-3, -2], [3, 1]] : [[2, -3], [-3, 2]]) {
    put(g, tx + dx, ty + dy, '#ffffff');
  }
}

// ------------------------------------------------------------------ Mote: a tiny star wisp

const STAR = ['#9a5a1c', '#e0a02c', '#ffd24a', '#fff08a', '#fffbe0'];
const WISP = ['#4a2c8a', '#8a5ad8', '#c49aff', '#ecdcff'];

/** A chubby five-point star (one tip up), turned by `rot` radians. */
const starShape =
  (cx: number, cy: number, rOut: number, rIn: number, rot = 0): Inside =>
  (x, y) => {
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - cy;
    const a = Math.atan2(dx, -dy) - rot;
    const k = (1 + Math.cos(5 * a)) / 2;
    return Math.hypot(dx, dy) <= rIn + (rOut - rIn) * k ** 1.6;
  };

function mote(g: Grid, pose: Pose): Glow {
  const act = pose === 'act';
  const f = pose === 'idle1' ? 1 : 0;
  const cx = 21;
  const cy = 11.5 + (f ? -0.5 : 0);
  // the wisp's tail: a ribbon of starlight trailing behind, thinning to sparks
  const tail: Array<[number, number]> = [
    [cx - 3, cy + 3],
    [cx - 7, cy + 4 - f],
    [cx - 11, cy + 2 + f],
    [cx - 13.5, cy + 0.5],
  ];
  stroke(g, tail, (t) => 2.4 - t * 1.7, (x, y) => {
    const along = (cx - 3 - (x + 0.5)) / 11;
    const edge = Math.abs(y + 0.5 - (cy + 3 - along * 2)) > 1.6 - along;
    return edge ? WISP[1] : tone(WISP.slice(1), 0.95 - along * 0.6 + (y < cy + 3 - along * 2 ? 0.2 : 0));
  });
  for (const [x, y, r] of [
    [cx - 16, cy - 0.5 + f, 0.8],
    [cx - 18.5, cy - 1.5, 0.5],
  ])
    form(g, ell(x, y, r + 0.5, r + 0.5), () => WISP[2]);
  // the star itself, lit from the top left, a dark-gold line where it overlaps the tail
  const rot = act ? 0.14 : f ? -0.06 : 0.06;
  const R = act ? 8.6 : 8;
  const star = starShape(cx, cy, R, R * 0.56, rot);
  form(g, star, sphere(STAR, cx - 2.5, cy - 3, R * 1.3, R * 1.3, 0.2, 0.15), STAR[1]);
  if (act) {
    // the twinkle: eyes squeezed shut with joy, a wide open smile
    stamp(g, ['k.k', '.k.'], { k: '#5a2a1a' }, cx - 3.5, cy - 1);
    stamp(g, ['k.k', '.k.'], { k: '#5a2a1a' }, cx + 0.5, cy - 1);
    stamp(g, ['kkk', '.r.'], { k: '#5a2a1a', r: '#ff7a8a' }, cx - 1.5, cy + 2);
  } else {
    eye(g, cx - 3, cy - 1.5, { tall: true, dark: '#3a1a10', iris: '#7a3a1a' });
    eye(g, cx + 1, cy - 1.5, { tall: true, dark: '#3a1a10', iris: '#7a3a1a' });
    put(g, cx - 1, cy + 2, '#7a3a1a');
    put(g, cx, cy + 2.4, '#7a3a1a');
    put(g, cx + 1, cy + 2, '#7a3a1a');
  }
  put(g, cx - 4, cy + 1.5, '#ff9aa0'); // blush
  put(g, cx + 3, cy + 1.5, '#ff9aa0');
  return (ctx) => {
    // sparkles: little crosses that come and go
    const sp: Array<[number, number, number]> = act
      ? [
          [cx, cy - 11, 2],
          [cx + 11, cy, 2],
          [cx - 9, cy - 8, 1],
          [cx + 8, cy + 8, 1],
          [cx + 9, cy - 8, 1],
        ]
      : f
        ? [
            [cx + 10, cy - 6, 1],
            [cx - 9, cy + 6, 0],
            [cx + 4, cy + 10, 0],
          ]
        : [
            [cx + 9, cy - 8, 0],
            [cx - 6, cy - 9, 1],
            [cx + 11, cy + 4, 0],
          ];
    for (const [x, y, s] of sp) {
      dot(ctx, x, y, '#ffffff', 1);
      for (let k = 1; k <= s; k++)
        for (const [dx, dy] of [
          [k, 0],
          [-k, 0],
          [0, k],
          [0, -k],
        ])
          dot(ctx, x + dx, y + dy, '#fff6c0', k === s ? 0.55 : 0.85);
      if (!s)
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          dot(ctx, x + dx, y + dy, '#e8d8ff', 0.4);
    }
  };
}

// ------------------------------------------------------------------ Sunny: a golden drake whelp

const SCALE = ['#5a2a10', '#9a5414', '#d8901c', '#f2c030', '#ffe680', '#fff8c8']; // gold scales, shadows lean rust
const CREAM = ['#a8783c', '#e0b870', '#f8e0a0', '#fff6d8'];
const WING = ['#6a1a1c', '#b8401e', '#e87030', '#ffa04a', '#ffd080']; // ember-orange membranes

/** Inside a triangle (a, b, c). */
const tri =
  (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Inside =>
  (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };

/** A small bat wing from the shoulder (sx, sy) out to the tip (tx, ty), its trailing edge scalloped back to (bx, by). */
function wing(g: Grid, sx: number, sy: number, tx: number, ty: number, bx: number, by: number, far: boolean): void {
  // two bites out of the trailing edge, pushed outward from the shoulder
  const bite = (k: number) => {
    const ex = tx + (bx - tx) * k;
    const ey = ty + (by - ty) * k;
    const d = Math.hypot(ex - sx, ey - sy);
    return ell(ex + ((ex - sx) / d) * 0.6, ey + ((ey - sy) / d) * 0.6, 1.5, 1.5);
  };
  const bites = [bite(0.36), bite(0.72)];
  const mem: Inside = (x, y) => tri(sx, sy, tx, ty, bx, by)(x, y) && !bites.some((c) => c(x, y));
  form(g, mem, (x, y) => tone(WING, 0.78 - Math.hypot(x - sx, y - sy) / 26 - (far ? 0.32 : 0)), far ? undefined : WING[1]);
  // the bones: the leading edge and a strut, gold, a claw at the tip
  line(g, [[sx, sy], [tx, ty]], far ? SCALE[2] : SCALE[4]);
  line(g, [[sx, sy], [(tx + bx) / 2, (ty + by) / 2]], far ? SCALE[1] : SCALE[2]);
  put(g, tx, ty, far ? SCALE[3] : SCALE[5]);
}

function sunny(g: Grid, pose: Pose): Glow {
  const act = pose === 'act';
  const up = pose !== 'idle0'; // wings: down in idle0, up in idle1 and the breath
  const bob = up ? -1 : 0;
  const SEP = SCALE[1];
  const B = { bias: 0.24 };
  const cy = 15 + bob;
  // far wing behind
  if (up) wing(g, 16, cy - 4.5, 13, cy - 12, 10.5, cy - 5.5, true);
  else wing(g, 16, cy - 4, 10, cy - 8.5, 10, cy - 2, true);
  // the tail, curling down and back to a spade tip
  const tail: Array<[number, number]> = [
    [11.5, cy + 2],
    [7.5, cy + 4],
    [4.5, cy + 3],
    [3.5, cy + 0.5],
  ];
  stroke(g, tail, (t) => 1.8 - t * 1, sphere(SCALE, 7, cy, 6, 5, 0.15));
  stamp(g, ['.a.', 'aab', '.b.'], { a: SCALE[4], b: SCALE[2] }, 2, cy - 2);
  // body, a dangling hind foot, the cream belly plates
  blob(g, SCALE, 15, cy, 5, 4.5, { ...B, sep: SEP });
  blob(g, CREAM, 17.6, cy + 1, 2.3, 3.2, { bias: 0.2 });
  put(g, 17, cy, CREAM[0]);
  put(g, 18, cy + 2, CREAM[0]);
  blob(g, SCALE, 13.5, cy + 4.5, 1.8, 1.4, { sep: SEP, bias: 0.15 });
  put(g, 13, cy + 5.6, CREAM[3]);
  put(g, 15, cy + 5.6, CREAM[3]);
  blob(g, SCALE, 19.8, cy + 2.2, 1.4, 1.3, { sep: SEP, bias: 0.3 });
  // near wing on the back
  if (up) wing(g, 14, cy - 4, 9.5, cy - 12.5, 6.5, cy - 5, false);
  else wing(g, 14, cy - 3.5, 6, cy - 7, 7, cy + 0.5, false);
  // the head: big and round, a snout, two little horns swept back
  const hx = 23;
  const hy = 9.5 + bob + (act ? -0.5 : 0);
  for (const [x0, y0, x1, y1] of [
    [hx - 2.5, hy - 3.5, hx - 4.5, hy - 6.5],
    [hx - 0.5, hy - 4, hx - 1.5, hy - 7],
  ])
    line(g, [[x0, y0], [x1, y1]], (i) => (i === 0 ? CREAM[1] : CREAM[3]));
  blob(g, SCALE, hx, hy, 5.2, 4.6, { ...B, sep: SEP });
  blob(g, SCALE, hx + 4.5, hy + 1.5, 2.6, 2, { bias: 0.34 });
  put(g, hx + 6, hy + 0.8, SCALE[1]); // nostril
  for (const [x, y] of [
    [hx - 5, hy - 1],
    [hx - 5.5, hy + 1],
  ])
    put(g, x, y, SCALE[4]); // a frill of little spines
  if (act) {
    // the breath: jaws wide, a roaring cone of fire
    const mouth: Inside = (x, y) => x >= hx + 2 && x <= hx + 7 && Math.abs(y + 0.5 - (hy + 3)) <= (x - hx - 1) * 0.4;
    fill(g, mouth, () => '#5a1428');
    for (let x = hx + 6; x < W; x++) {
      const t = (x - hx - 6) / (W - hx - 6);
      const half = 1 + t * 3.4;
      const mid = hy + 3 + t * 1.2;
      for (let y = Math.floor(mid - half); y <= mid + half; y++) {
        const d = Math.abs(y + 0.5 - mid) / half;
        if (d > 1 || (d > 0.75 && (x + y) % 2)) continue;
        put(g, x, y, tone(FLAME, 1.05 - d * 0.75 - t * 0.25));
      }
    }
    stamp(g, ['kkk', 'Wki'], { k: '#1c1028', W: '#ffffff', i: '#1e8a4a' }, hx - 1, hy - 1);
  } else {
    eye(g, hx - 1, hy - 1.5, { big: true, dark: '#1c1028', iris: '#1e8a4a' });
    eye(g, hx + 3, hy - 1.5, { tall: true, dark: '#1c1028', iris: '#1e8a4a' });
    put(g, hx, hy + 2.5, '#ff9a80'); // cheek
    line(g, [[hx + 3, hy + 3], [hx + 5, hy + 2.5]], SCALE[1]); // a toothy smile
    put(g, hx + 4, hy + 3.6, '#fff8e8');
  }
}

// ------------------------------------------------------------------ cards

const CARD_W = 40;
const CARD_H = 48;
/** The plinth's top face on the card (the companion's soles). */
const CARD_FEET = 39;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** A round glow behind the companion in stepped, ordered-dithered bands: `inner` at the heart, `outer` at the rim. */
function cardGlow(ctx: CanvasRenderingContext2D, inner: string, outer: string, cy: number, motes: Array<[number, number]>): void {
  const a = rgb(inner);
  const b = rgb(outer);
  const ALPHA = [0, 0.22, 0.4, 0.58, 0.74, 0.88];
  const im = ctx.createImageData(CARD_W, CARD_H);
  const d = im.data;
  const set = (x: number, y: number, c: RGB, al: number) => {
    const i = (y * CARD_W + x) * 4;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = Math.round(al * 255);
  };
  for (let y = 0; y < CARD_H; y++)
    for (let x = 0; x < CARD_W; x++) {
      const dd = Math.hypot((x + 0.5 - 20) / 20, (y + 0.5 - cy) / 21);
      if (dd >= 1) continue;
      const band = Math.max(0, Math.min(5, Math.floor((1 - dd) ** 0.8 * 6 + (bay(x, y) - 0.5) * 0.9)));
      if (!band) continue;
      const k = (band - 1) / 4;
      set(x, y, a.map((v, i) => Math.round(b[i] + (v - b[i]) * k)) as RGB, ALPHA[band]);
    }
  // motes: a bright speck with a soft cross (over the glow, so they blend toward it)
  for (const [x, y] of motes) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const i = ((y + dy) * CARD_W + x + dx) * 4;
      const al = d[i + 3] / 255;
      const out = 0.5 + al * 0.5;
      for (let c = 0; c < 3; c++) d[i + c] = Math.round((a[c] * 0.5 + d[i + c] * al * 0.5) / out);
      d[i + 3] = Math.round(out * 255);
    }
    set(x, y, a, 1);
  }
  ctx.putImageData(im, 0, 0);
}

const STONE = ['#1c1c2c', '#34344a', '#545264', '#78747c', '#a09a96', '#c8c0b2'];
const LEAF = ['#12261e', '#1e3c2a', '#2e5a32', '#4a7e36', '#78a83c', '#b4d058'];

/** A small plinth: a mossy turf cap on a short drum of fitted stone, lit from the top left. */
function cardPlinth(): HTMLCanvasElement {
  const g = grid(CARD_W, CARD_H);
  const cx = 20;
  const top = ell(cx, CARD_FEET + 0.5, 11.5, 2.8);
  const drum = or(ell(cx, CARD_FEET + 5.5, 11, 2.6), rect(9, CARD_FEET, 30, CARD_FEET + 5));
  fill(g, drum, (x, y) => {
    const v = 0.1 + 0.95 * lambert((x + 0.5 - cx) / 12, -0.2);
    // courses of stone: a mortar line every 3 rows, staggered joints
    const row = Math.floor((y - CARD_FEET) / 3);
    const joint = (x + row * 3) % 7 === 0 || (y - CARD_FEET) % 3 === 0;
    return tone(STONE.slice(1), v - (joint ? 0.28 : 0));
  });
  fill(g, top, sphere(LEAF.slice(1), cx - 5, CARD_FEET - 1.5, 14, 5, 0.08));
  // the turf's lip hangs over the stone
  for (let x = 9; x <= 31; x++) {
    let y = CARD_FEET + 4;
    while (y > 0 && !top(x, y)) y--;
    if (top(x, y) && x % 3 !== 1) put(g, x, y + 1, LEAF[x < cx ? 2 : 1]);
  }
  for (const [x, h] of [
    [10, 2],
    [12, 3],
    [28, 3],
    [30, 2],
  ])
    for (let k = 0; k < h; k++) put(g, x + (k === h - 1 ? -1 : 0), CARD_FEET - 1 - k, LEAF[k === h - 1 ? 5 : 4]);
  return toCanvas(g);
}

/** The lowest row of a canvas with any opaque pixel (Pip's frame: its bottom outline row). */
function bottomRow(c: HTMLCanvasElement): number {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 200) return y;
  return c.height - 1;
}

/** The lowest painted row of a grid (a companion's soles; the outline goes under it). */
function lowestRow(g: Grid): number {
  for (let y = g.length - 1; y >= 0; y--) if (g[y].some((c) => c)) return y;
  return g.length - 1;
}

/**
 * A card: the glow, the plinth, and the companion's frame standing on the plinth's top (its soles, row `feet` of
 * the frame, on the plinth's top row), raised by `lift` for one that hovers.
 */
function card(glow: [string, string], plinth: HTMLCanvasElement, figure: HTMLCanvasElement, feet: number, lift = 0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const ctx = c.getContext('2d')!;
  cardGlow(ctx, glow[0], glow[1], 25, MOTES);
  ctx.drawImage(plinth, 0, 0);
  ctx.drawImage(figure, Math.round((CARD_W - figure.width) / 2), CARD_FEET - feet - lift);
  return c;
}

// ------------------------------------------------------------------ build

const PAINT: Record<CompanionArtId, (g: Grid, pose: Pose) => Glow> = {
  bun,
  newt,
  sprocket,
  brick,
  flurry,
  mote,
  sunny,
};

/** Card glows [heart, rim]: the rim in the rarity's colour, the heart in the companion's own accent. */
const CARD_GLOW: Record<CompanionArtId | 'pip', [string, string]> = {
  bun: ['#ffe4ec', '#9aa0b4'],
  pip: ['#ffe070', '#5ad848'],
  newt: ['#ffb02a', '#5ad848'],
  sprocket: ['#ffe48a', '#3a8ae8'],
  brick: ['#b4d058', '#3a8ae8'],
  flurry: ['#e0f6ff', '#b05ae0'],
  mote: ['#fff6c0', '#b05ae0'],
  sunny: ['#fff0a0', '#ffa030'],
};
const MOTES: Array<[number, number]> = [
  [6, 12],
  [33, 8],
  [35, 26],
];

/** Hovering companions sit this many px above the plinth on their card. */
const HOVER: Partial<Record<CompanionArtId, number>> = { mote: 6, sunny: 2 };
/** The pose each card shows (wings up for the drake). */
const CARD_POSE: Partial<Record<CompanionArtId, Pose>> = { sunny: 'idle1' };

/**
 * Register the companions' frames and cards. `pip` is Pip's resting frame (art.ts owlFrame('down')), for its card.
 */
export function buildCompanionArt(add: Add, pip: HTMLCanvasElement): void {
  const plinth = cardPlinth();
  for (const id of COMPANION_ART) {
    for (const pose of ['idle0', 'idle1', 'act'] as const) add(`comp_${id}_${pose}`, frame((g) => PAINT[id](g, pose)));
    const f = framed((g) => PAINT[id](g, CARD_POSE[id] ?? 'idle0'));
    add(`comp_card_${id}`, card(CARD_GLOW[id], plinth, f.canvas, f.feet, HOVER[id] ?? 0));
  }
  add('comp_card_pip', card(CARD_GLOW.pip, plinth, pip, bottomRow(pip) - 1, 1));
}


