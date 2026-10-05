// Camp art (see docs/art-style.md): the camp backdrop (a night clearing: the campfire, the bag tent, the forge, the
// locked shrine), the smith's sprites and her story portrait.
//
// Textures:
//   camp_bg          GAME_W x GAME_H backdrop (no fire, no people: those animate on top)
//   camp_fire0..3    the campfire's flames (CAMP_SPOTS.fire is where they stand)
//   smith_idle0/1    the smith at her anvil; smith_hammer0..2 her hammer swing (CAMP_SPOTS.smith)
//   camp_rowan0/1    Rowan sitting on a log by the fire (CAMP_SPOTS.rowan, bottom-centre)
//   camp_pip0/1      Pip perched beside him (CAMP_SPOTS.pip, bottom-centre)
//   portrait_smith   40x40 story portrait
//
// PLACEHOLDER: flat shapes until the real camp is painted.
import { grid, put, toCanvas } from './art';
import { PORTRAIT_SIZE } from './art-story';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Where things stand on the camp backdrop (bottom-centre points, game px); buildings are tap targets. */
export const CAMP_SPOTS = {
  fire: { x: 120, y: 112 },
  rowan: { x: 96, y: 114 },
  pip: { x: 140, y: 100 },
  smith: { x: 232, y: 108 },
  bag: { x: 46, y: 60, w: 44, h: 50 },
  forge: { x: 196, y: 50, w: 72, h: 60 },
  shrine: { x: 278, y: 52, w: 34, h: 58 },
};

function box(w: number, h: number, col: string, hi: string): HTMLCanvasElement {
  const g = grid(w, h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) put(g, x, y, y < 3 ? hi : col);
  return toCanvas(g);
}

function backdrop(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0e1a22';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#162a32';
  ctx.fillRect(0, Math.round(h * 0.55), w, h);
  ctx.fillStyle = '#23404a';
  ctx.fillRect(0, Math.round(h * 0.75), w, h);
  const S = CAMP_SPOTS;
  for (const [r, col] of [
    [S.bag, '#4e2c16'],
    [S.forge, '#34344a'],
    [S.shrine, '#545264'],
  ] as const) {
    ctx.fillStyle = col;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  return c;
}

export function buildCampArt(add: Add, w: number, h: number): void {
  add('camp_bg', backdrop(w, h));
  for (let i = 0; i < 4; i++) add(`camp_fire${i}`, box(10, 12 + (i % 2) * 2, '#e8441a', '#fff0a0'));
  add('smith_idle0', box(18, 26, '#5a2e26', '#b06a36'));
  add('smith_idle1', box(18, 25, '#5a2e26', '#b06a36'));
  for (let i = 0; i < 3; i++) add(`smith_hammer${i}`, box(18 + i * 2, 26, '#5a2e26', '#d8964e'));
  add('camp_rowan0', box(16, 22, '#2a6ad8', '#9ad8ff'));
  add('camp_rowan1', box(16, 21, '#2a6ad8', '#9ad8ff'));
  add('camp_pip0', box(10, 10, '#8a4a2c', '#d8964e'));
  add('camp_pip1', box(10, 9, '#8a4a2c', '#d8964e'));
  add('portrait_smith', box(PORTRAIT_SIZE, PORTRAIT_SIZE, '#5a2e26', '#b06a36'));
}
