// The camp's Training Dummy (see docs/art-style.md), drawn procedurally like the coin sack (art-roam.ts) and
// outlined in ink by toCanvas: a straw dummy on a wooden post for practice fights, a burlap sack head with stitched
// eyes, a straw bundle tied with rope round the middle and a target painted on its chest, a cross-arm with straw
// hands, the post driven into a little mound. It faces left, toward the hero, like every foe.
//
// Textures (DUMMY_W x DUMMY_H, drawn with origin (0.5, 1) on the ground like any foe; the camp draws dummy_idle0/1
// by the shrine once it's built):
//   dummy_idle0 / dummy_idle1   a gentle sway on its post (frame 1 leans a pixel back)
//   dummy_windup                rocks back on the post, straw bristling
//   dummy_attack                swings forward at the hero
//   dummy_hurt                  knocked back, eyes squeezed shut, straw flying
//   dummy_flash                 the hurt pose as a white silhouette (the hit flash)
//   dummy_tell                  a special's wind-up: eyes lit red, arms bristling (it never has one, but every foe
//                               gets the frame)
import { grid, put, toCanvas, type Grid } from './art';

type Add = (key: string, c: HTMLCanvasElement) => void;

export const DUMMY_W = 30;
export const DUMMY_H = 40;

// ramps, dark -> light (hue-shifted: shadows cooler, highlights warmer)
const STRAW = ['#5a3c18', '#8a6024', '#b88a34', '#dcb44a', '#f2d878', '#fff0b0'];
const BURLAP = ['#4a2e1a', '#6e4626', '#98663a', '#c0905a', '#e0bc84'];
const WOOD = ['#2e1a0e', '#4e2c16', '#6e4020', '#8e5a2e', '#b07a44'];
const ROPE = ['#5a1a1a', '#8a2a22', '#c04a30', '#e07a4a'];
const DIRT = ['#2a1810', '#4a2c18', '#6e4426'];
const TARGET = { red: '#d03030', redHi: '#f05a48', white: '#f4ecd8', whiteLo: '#c8bca0' };

interface Pose {
  lean: number; // px the top leans right (back, away from the hero); negative leans at the hero
  hurt?: boolean;
  flash?: boolean;
  tell?: boolean;
  bristle?: boolean; // straw sticking out further
}

const pick = (ramp: string[], v: number) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(v)))];

function dummyFrame(o: Pose): HTMLCanvasElement {
  const W = DUMMY_W;
  const H = DUMMY_H;
  const g: Grid = grid(W, H);
  const base = H - 2; // the bottom row inside the outline
  const pivot = base - 6; // the post bends from here (the mound holds it)
  // how far a row is pushed sideways by the lean (0 at the pivot, the full lean at the head)
  const dx = (y: number) => (y >= pivot ? 0 : Math.round((o.lean * (pivot - y)) / (pivot - 4)));
  const set = (x: number, y: number, c: string) => put(g, x + dx(y), y, o.flash ? '#ffffff' : c);
  const cx = 15;

  // the mound of earth round the post's foot
  for (let y = base - 2; y <= base; y++)
    for (let x = cx - 6; x <= cx + 5; x++) {
      const k = (x - cx + 0.5) / 6;
      const top = base - 2 + Math.round(Math.abs(k) * 2.2);
      if (y < top) continue;
      put(g, x, y, o.flash ? '#ffffff' : pick(DIRT, y === top ? (k < 0 ? 2 : 1) : 0.6 - k * 0.5));
    }
  // the post: two px wide, lit on its left
  for (let y = 18; y < base - 1; y++) {
    set(cx - 1, y, WOOD[3]);
    set(cx, y, WOOD[1]);
    if (y % 5 === 2) set(cx - 1, y, WOOD[2]); // a knot now and then
  }
  // the straw body: an egg of straw, striated, lit from the top left
  const by = 22;
  const brx = 7;
  const bry = 8;
  for (let y = by - bry; y <= by + bry + 2; y++)
    for (let x = cx - brx - 1; x <= cx + brx + 1; x++) {
      const u = (x - cx + 0.5) / brx;
      const v = (y - by + 0.5) / bry;
      const d = u * u + v * v;
      // a ragged hem of straw ends under the body
      const hem = y > by + bry - 2 && (x * 7 + y * 3) % 4 !== 0 && Math.abs(u) < 0.85 && y <= by + bry + 1 + (o.bristle && x % 2 ? 1 : 0);
      if (d > 1 && !hem) continue;
      let lam = 2.6 - 1.6 * u - 1.2 * v;
      if ((x + (y >> 1)) % 3 === 0) lam -= 0.7; // straw strands
      if (d > 0.75 && (u > 0 || v > 0.3)) lam -= 0.8; // the rim away from the light
      set(x, y, pick(STRAW, lam));
    }
  // the target painted on the chest
  const tx = cx - 1;
  const ty = by - 1;
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++) {
      const r = Math.hypot(x, y);
      if (r > 3.3) continue;
      const ring = r < 1.2 ? 'red' : r < 2.3 ? 'white' : 'red';
      const lit = x + y < 0;
      set(tx + x, ty + y, ring === 'red' ? (lit ? TARGET.redHi : TARGET.red) : lit ? TARGET.white : TARGET.whiteLo);
    }
  // the rope round its middle
  for (let x = cx - brx; x <= cx + brx; x++) {
    const u = (x - cx) / brx;
    set(x, by + 4, pick(ROPE, 2.4 - u * 1.5 + ((x & 1) ? 0.4 : -0.4)));
  }
  set(cx + 2, by + 5, ROPE[1]);
  set(cx + 3, by + 6, ROPE[2]); // a dangling end
  // the cross-arm through the shoulders, straw hands at its ends
  const ay = by - 6;
  for (let x = cx - 12; x <= cx + 12; x++) {
    set(x, ay, WOOD[3]);
    set(x, ay + 1, WOOD[1]);
  }
  for (const [hx, side] of [
    [cx - 12, -1],
    [cx + 12, 1],
  ] as const) {
    const reach = o.bristle ? 3 : 2;
    for (let i = 0; i <= reach; i++) {
      set(hx + side * i, ay - 1 - (i >> 1), STRAW[4 - Math.min(2, i)]);
      set(hx + side * i, ay + 2 + (i >> 1), STRAW[2]);
      set(hx + side * (i + 1), ay, STRAW[3]);
    }
    set(hx, ay - 1, STRAW[3]);
    set(hx, ay + 2, STRAW[1]);
  }
  // the head: a burlap sack, a weave, a tie at the neck
  const hx0 = cx;
  const hy = 9;
  const hr = 5.6;
  for (let y = hy - 6; y <= hy + 6; y++)
    for (let x = hx0 - 7; x <= hx0 + 7; x++) {
      const u = (x - hx0 + 0.5) / hr;
      const v = (y - hy + 0.5) / (hr + 0.4);
      const d = u * u + v * v;
      if (d > 1) continue;
      let lam = 2.6 - 1.5 * u - 1.3 * v;
      if ((x * 3 + y * 5) % 7 === 0) lam -= 0.6; // the weave
      if (d > 0.72 && (u > 0.1 || v > 0.2)) lam -= 0.7;
      set(x, y, pick(BURLAP, lam));
    }
  // the tie at the neck, with a tuft of straw poking out on top
  for (let x = hx0 - 3; x <= hx0 + 3; x++) set(x, hy + 6, x < hx0 ? ROPE[2] : ROPE[1]);
  set(hx0 - 1, hy - 6, STRAW[4]);
  set(hx0, hy - 7, STRAW[3]);
  set(hx0 + 1, hy - 6, STRAW[2]);
  if (o.bristle) {
    set(hx0 - 2, hy - 7, STRAW[4]);
    set(hx0 + 2, hy - 7, STRAW[2]);
  }
  // the face (stitched), looking left at the hero
  const ink = '#2a1810';
  const stitch = o.tell ? '#ff3a2a' : ink;
  const ex = [hx0 - 4, hx0];
  if (o.hurt) {
    // squeezed shut: > <
    set(ex[0], hy - 1, ink);
    set(ex[0] + 1, hy, ink);
    set(ex[0], hy + 1, ink);
    set(ex[1] + 2, hy - 1, ink);
    set(ex[1] + 1, hy, ink);
    set(ex[1] + 2, hy + 1, ink);
  } else
    for (const e of ex) {
      // stitched X eyes
      set(e, hy - 1, stitch);
      set(e + 2, hy - 1, stitch);
      set(e + 1, hy, stitch);
      set(e, hy + 1, stitch);
      set(e + 2, hy + 1, stitch);
    }
  // a stitched mouth (open in a yelp when hurt)
  const my = hy + 3;
  if (o.hurt) {
    set(hx0 - 3, my, ink);
    set(hx0 - 2, my - 1, ink);
    set(hx0 - 2, my + 1, ink);
    set(hx0 - 1, my, ink);
  } else for (let x = hx0 - 4; x <= hx0; x++) set(x, my, x % 2 ? BURLAP[1] : ink);
  // straw flying off a hit
  if (o.hurt)
    for (const [sx, sy] of [
      [cx + 9, by - 2],
      [cx + 10, by + 3],
      [cx + 8, by - 9],
      [cx - 9, by + 6],
    ] as const) {
      put(g, sx + dx(sy), sy, o.flash ? '#ffffff' : STRAW[4]);
      put(g, sx + dx(sy) + 1, sy - 1, o.flash ? '#ffffff' : STRAW[3]);
    }
  return toCanvas(g);
}

export function buildDummyArt(add: Add): void {
  add('dummy_idle0', dummyFrame({ lean: 0 }));
  add('dummy_idle1', dummyFrame({ lean: 1 }));
  add('dummy_windup', dummyFrame({ lean: 2, bristle: true }));
  add('dummy_attack', dummyFrame({ lean: -3 }));
  add('dummy_hurt', dummyFrame({ lean: 3, hurt: true, bristle: true }));
  add('dummy_flash', dummyFrame({ lean: 3, hurt: true, bristle: true, flash: true }));
  add('dummy_tell', dummyFrame({ lean: 1, tell: true, bristle: true }));
}
