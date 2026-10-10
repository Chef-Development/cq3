// Region 3's gear (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: not merged into BASE_ITEMS, EFFECTS,
// SETS or SIGNATURES (src/data/gear.ts) until the core has drifting blocks and linked pairs (the set bonuses and the
// boss's signature effects read them). Same shapes as gear.ts entries; merging means adding the effect and set ids to
// the unions there. Icons fall back to a slot's look until painted ones exist (engine/art-gear.ts `item_${icon}`).

import type { BaseItem, EffectDef, GearRarity, SetDef } from './gear';

/** The boss's two signature Legendaries' unique effects. */
export type AshEffectId = 'titanMaul' | 'bellowsHeart';

export const ASH_EFFECTS: Record<AshEffectId, EffectDef> = {
  titanMaul: { name: 'Strike While Hot', text: 'Finished pairs hit every foe.', signature: true },
  bellowsHeart: { name: 'Stoked', text: 'Drifting blocks you hit fill double meter.', signature: true },
};

export type AshSetId = 'emberwright';

export const ASH_SETS: Record<AshSetId, SetDef> = {
  emberwright: {
    name: 'Emberwright',
    pieces: ['wrightCap', 'wrightApron', 'wrightClogs', 'hearthCharm'],
    bonuses: [
      { count: 2, text: '+20% damage on drifting blocks' },
      { count: 4, text: 'Finished pairs heal 2% HP' },
    ],
  },
};

/** A BASE_ITEMS entry, with Region 3's set and signature effects. */
export interface AshBaseItem extends Omit<BaseItem, 'set' | 'signature'> {
  set?: AshSetId;
  signature?: { boss: string; rarity: GearRarity; effect: AshEffectId };
}

// From Region 3's first act (global act 6) on, a step past the Frostpeaks' bases in what they lean on.
export const ASH_BASE_ITEMS: AshBaseItem[] = [
  // weapons
  { id: 'obsidianEdge', name: 'Obsidian Edge', slot: 'weapon', icon: 'obsidian', base: [{ stat: 'atk', mult: 1.05 }, { stat: 'critChance', mult: 0.5 }], act: 6 },
  { id: 'cinderCleaver', name: 'Cinder Cleaver', slot: 'weapon', icon: 'cleaver', base: [{ stat: 'atk', mult: 1.2 }], act: 6 },
  { id: 'basaltSledge', name: 'Basalt Sledge', slot: 'weapon', icon: 'sledge', base: [{ stat: 'atk', mult: 1.3 }], act: 7 },
  // helms
  { id: 'ashVeil', name: 'Ash Veil', slot: 'helm', icon: 'ashveil', base: [{ stat: 'hp', mult: 0.5 }, { stat: 'luck', mult: 0.7 }], act: 6 },
  { id: 'basaltHelm', name: 'Basalt Helm', slot: 'helm', icon: 'basalthelm', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.6 }], act: 7 },
  // armor
  { id: 'ashclothCoat', name: 'Ashcloth Coat', slot: 'armor', icon: 'ashcoat', base: [{ stat: 'hp', mult: 1.2 }, { stat: 'def', mult: 0.7 }], act: 6 },
  { id: 'slagplate', name: 'Slagplate', slot: 'armor', icon: 'slagplate', base: [{ stat: 'hp', mult: 1 }, { stat: 'def', mult: 1.35 }], act: 8 },
  // boots
  { id: 'pumiceSoles', name: 'Pumice Soles', slot: 'boots', icon: 'pumice', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.3 }], act: 6 },
  { id: 'firewalkGreaves', name: 'Firewalk Greaves', slot: 'boots', icon: 'firewalk', base: [{ stat: 'def', mult: 0.8 }, { stat: 'steady', mult: 1.05 }], act: 7 },
  // trinkets
  { id: 'warmCoal', name: 'Warm Coal', slot: 'trinket', icon: 'coal', base: [{ stat: 'meterGain', mult: 1.15 }], act: 6 },
  { id: 'lavaPearl', name: 'Lava Pearl', slot: 'trinket', icon: 'pearl', base: [{ stat: 'critDmg', mult: 1.15 }], act: 7 },
  // the Emberwright set (a smith's working kit)
  { id: 'wrightCap', name: 'Emberwright Cap', slot: 'helm', icon: 'wrightcap', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 6, set: 'emberwright' },
  { id: 'wrightApron', name: 'Emberwright Apron', slot: 'armor', icon: 'wrightapron', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 0.8 }], act: 6, set: 'emberwright' },
  { id: 'wrightClogs', name: 'Emberwright Clogs', slot: 'boots', icon: 'wrightclogs', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.1 }], act: 6, set: 'emberwright' },
  { id: 'hearthCharm', name: 'Hearth Charm', slot: 'trinket', icon: 'hearthcharm', base: [{ stat: 'hp', mult: 0.6 }], act: 6, set: 'emberwright' },
  // the boss's signature Legendaries
  { id: 'titanMaul', name: "Titan's Maul", slot: 'weapon', icon: 'titanmaul', base: [{ stat: 'atk', mult: 1.35 }], act: 8, signature: { boss: 'bellows', rarity: 'legendary', effect: 'titanMaul' } },
  { id: 'bellowsHeart', name: 'Bellows Heart', slot: 'trinket', icon: 'bellowsheart', base: [{ stat: 'meterGain', mult: 1.3 }], act: 8, signature: { boss: 'bellows', rarity: 'legendary', effect: 'bellowsHeart' } },
];

/** The boss's signature drops (merged into SIGNATURES; bad-luck protection as for the others). */
export const ASH_SIGNATURES: Record<string, string[]> = {
  bellows: ['titanMaul', 'bellowsHeart'],
};
