// The fourth region's art pack (region-art.ts): its foes and portraits (art-dusk.ts) and its fight backdrops
// (backdrop-dusk.ts), in a chunk of their own. Only this file imports them.
import { buildDuskFoeArt, DUSK_COL, isDuskArtKey, paintDuskFoeSlice } from './art-dusk';
import { buildDuskBackdrop, type DuskTheme } from './backdrop-dusk';
import type { RegionArtPack } from './region-art';

export const PACK: RegionArtPack = {
  id: 'dusk',
  paintSlice: paintDuskFoeSlice,
  addArt: (add, now) => buildDuskFoeArt(add, now),
  isArtKey: isDuskArtKey,
  backdrop: (scene, theme, w, h, ground) => buildDuskBackdrop(scene, theme as DuskTheme, w, h, ground),
  col: DUSK_COL,
};
