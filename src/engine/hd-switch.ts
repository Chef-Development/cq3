// The sharper text's switch (view/hd-text.ts draws it): which surfaces draw their text on the fine layer. Pure (no
// Phaser, no DOM), unit-tested: one flag per surface, the defaults judged from side-by-side phone shots
// (docs/decisions.md A20), overridden by the 'cq3.hdText' setting (storage.ts): 'off' puts every surface back on the
// old path, 'on' turns every one on, an object sets single surfaces.
import type { HdTextSetting } from './storage';

export type HdSurface = 'story' | 'heroSelect' | 'tips' | 'cards';
export const HD_SURFACES: readonly HdSurface[] = ['story', 'heroSelect', 'tips', 'cards'];

/** Which surfaces read better sharper (docs/decisions.md A20). */
export const HD_DEFAULT: Readonly<Record<HdSurface, boolean>> = {
  /** The story boxes: the lines, the speaker's ribbon, Skip. */
  story: true,
  /** The hero select: the labels, chips, kit cards' words, buttons, its sheets (the big name stays: scale 3). */
  heroSelect: true,
  /** The tip card. */
  tips: true,
  /** The relic/boost pick's cards and the loot row and its Legendary/Mythic card. */
  cards: true,
};

/** Is this surface's text drawn sharper under this setting? */
export function surfaceOn(setting: HdTextSetting, surface: HdSurface): boolean {
  if (setting === 'off') return false;
  if (setting === 'on') return true;
  if (setting && typeof setting[surface] === 'boolean') return setting[surface];
  return HD_DEFAULT[surface];
}
