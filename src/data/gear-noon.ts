// Region 5's gear (SPOILERS: docs/content-bible.md section 8). NOT IN PLAY YET: not merged into BASE_ITEMS, EFFECTS,
// SETS or SIGNATURES (src/data/gear.ts) until the region is wired in. Same shapes as gear.ts entries (like
// gear-dusk.ts); merging means adding the effect and set ids to the unions there and the effects to the core
// (combat.ts, beside the Lamplighter's set; numbers in tuning.effects): the Wayfarer's set (2 pieces: hits on blazing
// yellows; 4: a green cools the Heat and heals) and the Gnomon's signatures (Sunstone: the Heat burns slower; the
// Gnomon's Hand: a mirage hit within a moment of its hop deals more). Icons fall back to a slot's look until painted.

import type { BaseItem, EffectDef, GearRarity, SetDef } from './gear';

/** The boss's two signature Legendaries' unique effects. */
export type NoonEffectId = 'sunstone' | 'gnomonHand';

export const NOON_EFFECTS: Record<NoonEffectId, EffectDef> = {
  sunstone: { name: 'Cool Head', text: 'Your Heat burns half as fast.', signature: true },
  gnomonHand: { name: 'True Hour', text: 'A mirage hit right after its hop: x3.', signature: true },
};

export type NoonSetId = 'wayfarer';

export const NOON_SETS: Record<NoonSetId, SetDef> = {
  wayfarer: {
    name: "Wayfarer's",
    pieces: ['sunHat', 'linenRobe', 'sandals', 'waterSkin'],
    bonuses: [
      { count: 2, text: '+20% damage on blazing blocks' },
      { count: 4, text: 'A green cools you and heals 2% HP' },
    ],
  },
};

/** A BASE_ITEMS entry, with Region 5's set and signature effects. */
export interface NoonBaseItem extends Omit<BaseItem, 'set' | 'signature'> {
  set?: NoonSetId;
  signature?: { boss: string; rarity: GearRarity; effect: NoonEffectId };
}

// From Region 5's first act (global act 12) on.
export const NOON_BASE_ITEMS: NoonBaseItem[] = [
  // weapons
  { id: 'dialSpear', name: 'Dial Spear', slot: 'weapon', icon: 'dialspear', base: [{ stat: 'atk', mult: 1.05 }, { stat: 'critChance', mult: 0.6 }], act: 12 },
  { id: 'sunsteelSaber', name: 'Sunsteel Saber', slot: 'weapon', icon: 'sunsaber', base: [{ stat: 'atk', mult: 1.2 }, { stat: 'critDmg', mult: 0.4 }], act: 12 },
  { id: 'spireHammer', name: 'Spire Hammer', slot: 'weapon', icon: 'spirehammer', base: [{ stat: 'atk', mult: 1.35 }], act: 13 },
  // helms
  { id: 'veilHood', name: 'Veil Hood', slot: 'helm', icon: 'veilhood', base: [{ stat: 'hp', mult: 0.5 }, { stat: 'meterGain', mult: 0.6 }], act: 12 },
  { id: 'brassVisor', name: 'Brass Visor', slot: 'helm', icon: 'brassvisor', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.65 }], act: 13 },
  // armor
  { id: 'dustMail', name: 'Dust Mail', slot: 'armor', icon: 'dustmail', base: [{ stat: 'hp', mult: 1.25 }, { stat: 'def', mult: 0.7 }], act: 12 },
  { id: 'sunplate', name: 'Sunplate', slot: 'armor', icon: 'sunplate', base: [{ stat: 'hp', mult: 1 }, { stat: 'def', mult: 1.4 }], act: 14 },
  // boots
  { id: 'duneStriders', name: 'Dune Striders', slot: 'boots', icon: 'dunestriders', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.35 }], act: 12 },
  { id: 'stairTreads', name: 'Stair Treads', slot: 'boots', icon: 'stairtreads', base: [{ stat: 'def', mult: 0.85 }, { stat: 'steady', mult: 1.05 }], act: 13 },
  // trinkets
  { id: 'noonPearl', name: 'Noon Pearl', slot: 'trinket', icon: 'noonpearl', base: [{ stat: 'critDmg', mult: 1.2 }], act: 13 },
  { id: 'hazeGlass', name: 'Haze Glass', slot: 'trinket', icon: 'hazeglass', base: [{ stat: 'meterGain', mult: 1.2 }], act: 12 },
  // the Wayfarer's set (a desert traveller's kit)
  { id: 'sunHat', name: 'Sun Hat', slot: 'helm', icon: 'sunhat', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 12, set: 'wayfarer' },
  { id: 'linenRobe', name: 'Linen Robe', slot: 'armor', icon: 'linenrobe', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 0.8 }], act: 12, set: 'wayfarer' },
  { id: 'sandals', name: 'Sandals', slot: 'boots', icon: 'sandals', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.1 }], act: 12, set: 'wayfarer' },
  { id: 'waterSkin', name: 'Water Skin', slot: 'trinket', icon: 'waterskin', base: [{ stat: 'hp', mult: 0.6 }], act: 12, set: 'wayfarer' },
  // the boss's signature Legendaries
  { id: 'sunstone', name: 'Sunstone', slot: 'trinket', icon: 'sunstone', base: [{ stat: 'hp', mult: 1.1 }], act: 14, signature: { boss: 'gnomon', rarity: 'legendary', effect: 'sunstone' } },
  { id: 'gnomonHand', name: "Gnomon's Hand", slot: 'weapon', icon: 'gnomonhand', base: [{ stat: 'atk', mult: 1.4 }], act: 14, signature: { boss: 'gnomon', rarity: 'legendary', effect: 'gnomonHand' } },
];

/** The boss's signature drops (merged into SIGNATURES; bad-luck protection as for the others). */
export const NOON_SIGNATURES: Record<string, string[]> = {
  gnomon: ['sunstone', 'gnomonHand'],
};
