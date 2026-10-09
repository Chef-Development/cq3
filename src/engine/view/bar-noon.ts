// The fifth region's bar rules, drawn on the bar and on the hero (view/bar.ts calls these). Pictures only:
// - a mirage: a heat shimmer rising off it (two wavy lines of pale light above the block); once its landing spot is
//   chosen, a blinking ghost outline stands there (with a dotted line of shimmer from the block to it) until it hops.
// - a blazing yellow: a white-hot rim and short rays of sun flickering over its top.
// - Heat on the hero: an orange glow at his feet, heat shimmer rising off him and a flame pip per stack over his head.
import type Phaser from 'phaser';
import type { Block, Combat } from '../../core/combat';
import type { BarBox } from './bar-links';

type G = Phaser.GameObjects.Graphics;

const HAZE = 0xfff4c8;
const GHOST = 0xffe6a0;
const SUN = [0xfffbe0, 0xffe680, 0xffb040] as const;
const FIRE = [0xfff0a0, 0xffa040, 0xe0501c] as const;

/** Over the still blocks: each mirage's shimmer and its landing ghost. */
export function drawMirages(g: G, c: Combat, t: number, now: number, B: BarBox, bx: number): void {
  for (const b of c.blocks) {
    if (b.hopAt === Infinity) continue;
    const pos = c.blockPosAt(b, t);
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const x = Math.round(B.x + pos * B.w - w / 2) + bx;
    // the shimmer: two wavy lines above the block
    for (let i = 0; i < 2; i++) {
      const y = B.y - 7 - i * 2;
      g.fillStyle(HAZE, 0.55 - i * 0.2);
      for (let k = 0; k < w; k += 2) g.fillRect(x + k, y + Math.round(Math.sin(now / 120 + k * 0.7 + i * 2 + b.id) * 1), 1, 1);
    }
    if (b.hopTo < 0) continue;
    // the landing spot: a blinking ghost outline, and a dotted line of shimmer from the block to it
    const gx = Math.round(B.x + b.hopTo * B.w - w / 2) + bx;
    const on = Math.floor(now / 120) % 2 === 0;
    g.fillStyle(GHOST, on ? 0.9 : 0.45);
    const y0 = B.y - 5;
    const h = B.h + 10;
    g.fillRect(gx, y0, w, 1);
    g.fillRect(gx, y0 + h - 1, w, 1);
    g.fillRect(gx, y0, 1, h);
    g.fillRect(gx + w - 1, y0, 1, h);
    g.fillStyle(GHOST, 0.18);
    g.fillRect(gx + 1, y0 + 1, w - 2, h - 2);
    const a = Math.min(x, gx) + w / 2;
    const z = Math.max(x, gx) + w / 2;
    g.fillStyle(HAZE, 0.5);
    for (let k = Math.round(a); k < z; k += 3) g.fillRect(k, B.y - 9 + Math.round(Math.sin(now / 90 + k) * 1), 1, 1);
  }
}

/** A blazing yellow's look, over its brick (bar.ts drawBlock): a white-hot rim, rays flickering over its top. */
export function drawBlaze(g: G, b: Block, x: number, y: number, w: number, h: number, now: number): void {
  const f = Math.floor(now / 90 + b.id) % 3;
  g.fillStyle(SUN[0], 0.9);
  g.fillRect(x, y, w, 1);
  g.fillRect(x, y, 1, h);
  g.fillRect(x + w - 1, y, 1, h);
  for (let i = 0; i < 3; i++) {
    const rx = x + Math.round(((i + 0.5) * w) / 3);
    const len = 2 + ((i + f) % 3);
    g.fillStyle(SUN[(i + f) % 3], 0.85);
    g.fillRect(rx, y - 1 - len, 1, len);
  }
}

/** Heat on the hero: a glow at the feet, shimmer rising off him, a flame pip per stack over his head. */
export function drawHeat(g: G, c: Combat, heroX: number, ground: number, now: number): void {
  if (c.heat <= 0) return;
  const k = 0.6 + 0.4 * Math.sin(now / 140);
  g.fillStyle(FIRE[1], 0.22 * k);
  g.fillRect(heroX - 9, ground - 2, 18, 3);
  g.fillStyle(FIRE[2], 0.18 * k);
  g.fillRect(heroX - 6, ground - 26, 12, 24);
  for (let i = 0; i < 4; i++) {
    const y = ground - 8 - ((now / 30 + i * 7) % 26);
    g.fillStyle(HAZE, 0.35);
    g.fillRect(heroX - 6 + i * 4 + Math.round(Math.sin(now / 100 + i) * 1), Math.round(y), 1, 2);
  }
  for (let i = 0; i < c.heat; i++) {
    const px = heroX - (c.heat - 1) * 3 + i * 6;
    const py = ground - 40;
    const fl = Math.floor(now / 110 + i) % 2;
    g.fillStyle(FIRE[2], 1);
    g.fillRect(px - 1, py, 3, 3);
    g.fillStyle(FIRE[1], 1);
    g.fillRect(px - 1 + fl, py - 2, 2, 2);
    g.fillStyle(FIRE[0], 1);
    g.fillRect(px, py + 1, 1, 1);
  }
}
