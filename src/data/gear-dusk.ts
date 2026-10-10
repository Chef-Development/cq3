// Region 4's gear (SPOILERS: docs/content-bible.md section 7). Merged into BASE_ITEMS, EFFECTS, SETS and
// SIGNATURES (src/data/gear.ts); the effects are in the core (combat.ts, beside the Emberwright set's; numbers in
// tuning.effects): the Lamplighter's set (2 pieces: hits on dark blocks; 4: blocking a red in the water heals) and the
// boss's signatures (Sunlamp: the light reaches further; Breaker's Edge: blocks just up out of the water take more).
// Icons fall back to a slot's look until painted ones exist.

import type { BaseItem, EffectDef, GearRarity, SetDef } from './gear';

/** The boss's two signature Legendaries' unique effects. */
export type DuskEffectId = 'sunlamp' | 'breakersEdge';

export const DUSK_EFFECTS: Record<DuskEffectId, EffectDef> = {
  sunlamp: { name: 'Daybreak', text: 'Your light reaches 50% further.', signature: true },
  breakersEdge: { name: 'Riptide', text: 'Blocks just out of the water take x3.', signature: true },
};

export type DuskSetId = 'lamplighter';

export const DUSK_SETS: Record<DuskSetId, SetDef> = {
  lamplighter: {
    name: "Lamplighter's",
    pieces: ['wickHood', 'oilskinCoat', 'lampWaders', 'fireflyJar'],
    bonuses: [
      { count: 2, text: '+20% damage on dark blocks' },
      { count: 4, text: 'Blocking a red in water heals 2% HP' },
    ],
  },
};

/** A BASE_ITEMS entry, with Region 4's set and signature effects. */
export interface DuskBaseItem extends Omit<BaseItem, 'set' | 'signature'> {
  set?: DuskSetId;
  signature?: { boss: string; rarity: GearRarity; effect: DuskEffectId };
}

// From Region 4's first act (global act 9) on, a step past Ashfell's bases in what they lean on.
export const DUSK_BASE_ITEMS: DuskBaseItem[] = [
  // weapons
  { id: 'reedSpear', name: 'Reed Spear', slot: 'weapon', icon: 'reedspear', base: [{ stat: 'atk', mult: 1.05 }, { stat: 'critChance', mult: 0.55 }], act: 9 },
  { id: 'lanternMace', name: 'Lantern Mace', slot: 'weapon', icon: 'lanternmace', base: [{ stat: 'atk', mult: 1.2 }, { stat: 'luck', mult: 0.3 }], act: 9 },
  { id: 'peatMaul', name: 'Peat Maul', slot: 'weapon', icon: 'peatmaul', base: [{ stat: 'atk', mult: 1.35 }], act: 10 },
  // helms
  { id: 'snapperHelm', name: 'Snapper Helm', slot: 'helm', icon: 'snapperhelm', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.65 }], act: 10 },
  { id: 'mossCowl', name: 'Moss Cowl', slot: 'helm', icon: 'mosscowl', base: [{ stat: 'hp', mult: 0.5 }, { stat: 'meterGain', mult: 0.6 }], act: 9 },
  // armor
  { id: 'reedMail', name: 'Reed Mail', slot: 'armor', icon: 'reedmail', base: [{ stat: 'hp', mult: 1.25 }, { stat: 'def', mult: 0.7 }], act: 9 },
  { id: 'shellplate', name: 'Shellplate', slot: 'armor', icon: 'shellplate', base: [{ stat: 'hp', mult: 1 }, { stat: 'def', mult: 1.4 }], act: 11 },
  // boots
  { id: 'stiltBoots', name: 'Stilt Boots', slot: 'boots', icon: 'stiltboots', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.35 }], act: 9 },
  { id: 'mudTreads', name: 'Mud Treads', slot: 'boots', icon: 'mudtreads', base: [{ stat: 'def', mult: 0.85 }, { stat: 'steady', mult: 1.05 }], act: 10 },
  // trinkets
  { id: 'tidePearl', name: 'Tide Pearl', slot: 'trinket', icon: 'tidepearl', base: [{ stat: 'critDmg', mult: 1.2 }], act: 10 },
  { id: 'wispCharm', name: 'Wisp Charm', slot: 'trinket', icon: 'wispcharm', base: [{ stat: 'meterGain', mult: 1.2 }], act: 9 },
  // the Lamplighter's set (a lamplighter's working kit)
  { id: 'wickHood', name: 'Wick Hood', slot: 'helm', icon: 'wickhood', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 9, set: 'lamplighter' },
  { id: 'oilskinCoat', name: 'Oilskin Coat', slot: 'armor', icon: 'oilskin', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 0.8 }], act: 9, set: 'lamplighter' },
  { id: 'lampWaders', name: 'Waders', slot: 'boots', icon: 'waders', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.1 }], act: 9, set: 'lamplighter' },
  { id: 'fireflyJar', name: 'Firefly Jar', slot: 'trinket', icon: 'fireflyjar', base: [{ stat: 'hp', mult: 0.6 }], act: 9, set: 'lamplighter' },
  // the boss's signature Legendaries
  { id: 'sunlamp', name: 'Sunlamp', slot: 'trinket', icon: 'sunlamp', base: [{ stat: 'critChance', mult: 1.2 }], act: 11, signature: { boss: 'lighthouse', rarity: 'legendary', effect: 'sunlamp' } },
  { id: 'breakersEdge', name: "Breaker's Edge", slot: 'weapon', icon: 'breakersedge', base: [{ stat: 'atk', mult: 1.4 }], act: 11, signature: { boss: 'lighthouse', rarity: 'legendary', effect: 'breakersEdge' } },
];

/** The boss's signature drops (merged into SIGNATURES; bad-luck protection as for the others). */
export const DUSK_SIGNATURES: Record<string, string[]> = {
  lighthouse: ['sunlamp', 'breakersEdge'],
};
