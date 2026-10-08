// The sharper chest reveal's layer (playtest round 7, a test): a DOM 2D canvas laid exactly over the game canvas, at
// HD_K times the game's resolution, where the chest reveal alone is drawn on a finer pixel grid (view/chest-hd.ts).
// The world and the fighters stay on the game's grid; this file is the pure maths (no DOM at import, unit-tested):
// where the layer goes, how big its backing store is, and how game px map to its fine px.
//
// k = 2: the layer is 654 x 300 fine px, 4 device px per fine px on an iPhone 16 Pro (8x): about the internal size of
// a modern HD pixel-art game, so it still reads as pixel art (k = 4 would be 2 device px per pixel: smooth, not pixel
// art). Any k works here; the art in art-chests-hd.ts and font-hd.ts is authored for HD_K.
import { GAME_H, GAME_W, type ScreenLayout } from './layout';

/** Fine px per game px. */
export const HD_K = 2;

export interface HdLayerRect {
  /** Where the canvas goes and its CSS size: exactly the game canvas's. */
  left: number;
  top: number;
  cssW: number;
  cssH: number;
  /** Its backing store (fine px). */
  w: number;
  h: number;
  k: number;
  /** Device px per fine px, and whether that is a whole number (every fine px the same size on screen). */
  devPerFine: number;
  exact: boolean;
  /** The safe area in fine px (the game's s.L / s.R / s.B, times k). */
  L: number;
  R: number;
  B: number;
}

/** The layer for a layout: over the game canvas, k x its resolution. */
export function hdLayerRect(l: ScreenLayout, k = HD_K): HdLayerRect {
  const devPerFine = l.scale / k;
  return {
    left: l.left,
    top: l.top,
    cssW: l.cssW,
    cssH: l.cssH,
    w: GAME_W * k,
    h: GAME_H * k,
    k,
    devPerFine,
    exact: Math.abs(devPerFine - Math.round(devPerFine)) < 1e-9 && devPerFine >= 1,
    L: l.safeLeft * k,
    R: (GAME_W - l.safeRight) * k,
    B: (GAME_H - l.safeBottom) * k,
  };
}

/** Game px -> the fine px it starts at (whole, so everything lands on the fine grid). */
export const toFine = (v: number, k = HD_K): number => Math.round(v * k);

/** A client point (CSS px) -> game px, through the layer (the same as through the game canvas). */
export function layerToGame(r: HdLayerRect, x: number, y: number): { x: number; y: number } {
  return { x: ((x - r.left) * GAME_W) / r.cssW, y: ((y - r.top) * GAME_H) / r.cssH };
}

/** Two layer rects that need no change to the canvas. */
export const sameLayer = (a: HdLayerRect | null, b: HdLayerRect): boolean =>
  !!a && a.left === b.left && a.top === b.top && a.cssW === b.cssW && a.cssH === b.cssH && a.w === b.w && a.h === b.h;
