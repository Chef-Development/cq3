// Yara's spirits (see docs/content-bible.md section 3, Yara): called by green hits, in spirit light. Textures like
// Moss's allies (art-hero-allies.ts): `ally_${kind}_0`, `ally_${kind}_1` (a two-frame idle) and `ally_${kind}_act`,
// ALLY_W x ALLY_H, facing right, feet on ALLY_FEET; the Wisp Swarm hovers centred in the box. The Great Spirit stag
// is bigger (STAG_W x STAG_H, feet centred on the bottom row above the outline).
import { grid, toCanvas, type Grid } from './art';
import { ALLY_H, ALLY_W } from './art-hero-allies';

type Add = (key: string, c: HTMLCanvasElement) => void;

export const STAG_W = 44;
export const STAG_H = 42;

function frame(w: number, h: number, paint: (g: Grid) => void): HTMLCanvasElement {
  const g = grid(w, h);
  paint(g);
  return toCanvas(g);
}

export function buildSpiritArt(add: Add): void {
  for (const k of ['spiritWolf', 'spiritTortoise', 'wispSwarm'])
    for (const p of ['0', '1', 'act'])
      add(
        `ally_${k}_${p}`,
        frame(ALLY_W, ALLY_H, (g) => {
          for (let y = 8; y < 20; y++) for (let x = 6; x < 18; x++) g[y][x] = '#7ad8ff';
        }),
      );
  for (const p of ['0', '1', 'act'])
    add(
      `ally_spiritStag_${p}`,
      frame(STAG_W, STAG_H, (g) => {
        for (let y = 10; y < STAG_H - 2; y++) for (let x = 8; x < 36; x++) g[y][x] = '#b0f4ff';
      }),
    );
}
