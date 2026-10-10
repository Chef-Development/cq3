// Ashfell's art pack (region-art.ts): its foes, portraits and bar pieces (art-ash.ts) and its fight backdrops
// (backdrop-ash.ts), in a chunk of their own. Only this file imports them (its relic icons stay in the main chunk:
// art-relics-ash.ts is small and the relic log shows every relic).
import { ASH_COL, buildAshFoeArt, isAshArtKey, paintAshFoeSlice } from './art-ash';
import { buildAshBackdrop, type AshTheme } from './backdrop-ash';
import type { RegionArtPack } from './region-art';

export const PACK: RegionArtPack = {
  id: 'ash',
  paintSlice: paintAshFoeSlice,
  addArt: (add, now) => buildAshFoeArt(add, now),
  isArtKey: isAshArtKey,
  backdrop: (scene, theme, w, h, ground) => buildAshBackdrop(scene, theme as AshTheme, w, h, ground),
  col: ASH_COL,
};
