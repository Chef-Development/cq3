// The Frostpeaks' art pack (region-art.ts): its foes, portraits and bar pieces (art-frost.ts) and its fight backdrops
// (backdrop-frost.ts), in a chunk of their own. Only this file imports them.
import { buildFrostFoeArt, FROST_COL, isFrostArtKey, paintFrostFoeSlice } from './art-frost';
import { buildFrostBackdrop, type FrostTheme } from './backdrop-frost';
import type { RegionArtPack } from './region-art';

export const PACK: RegionArtPack = {
  id: 'frost',
  paintSlice: paintFrostFoeSlice,
  addArt: (add, now) => buildFrostFoeArt(add, now),
  isArtKey: isFrostArtKey,
  backdrop: (scene, theme, w, h, ground) => buildFrostBackdrop(scene, theme as FrostTheme, w, h, ground),
  col: FROST_COL,
};
