// The fifth region's art pack (region-art.ts): its foes and portrait (art-noon.ts) and its fight backdrops
// (backdrop-noon.ts), in a chunk of their own. Only this file imports them.
import { buildNoonFoeArt, isNoonArtKey, NOON_COL, paintNoonFoeSlice } from './art-noon';
import { buildNoonBackdrop, type NoonTheme } from './backdrop-noon';
import type { RegionArtPack } from './region-art';

export const PACK: RegionArtPack = {
  id: 'noon',
  paintSlice: paintNoonFoeSlice,
  addArt: (add, now) => buildNoonFoeArt(add, now),
  isArtKey: isNoonArtKey,
  backdrop: (scene, theme, w, h, ground) => buildNoonBackdrop(scene, theme as NoonTheme, w, h, ground),
  col: NOON_COL,
};
