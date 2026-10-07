// Gear content (plain data, no logic): the 10 hero stats, the six slots, the base items, the two sets, the unique
// effects of Legendary and Mythic items, and the bosses' signature drops. src/core/gear.ts rolls and scales them;
// the numbers that scale them (rarity weights, ranges per item level, forge costs) live in src/core/tuning.ts.

import { TIERS, TIER_INFO, type Tier, type TierInfo } from './rarity';

/** The hero's 10 stats. */
import { ASH_BASE_ITEMS, ASH_EFFECTS, ASH_SETS, ASH_SIGNATURES, type AshEffectId, type AshSetId } from './gear-ash';

export type StatId = 'hp' | 'atk' | 'def' | 'critChance' | 'critDmg' | 'comboPower' | 'meterGain' | 'steady' | 'luck' | 'companion';

export const STAT_IDS: StatId[] = ['hp', 'atk', 'def', 'critChance', 'critDmg', 'comboPower', 'meterGain', 'steady', 'luck', 'companion'];

/** The four the stats screen leads with (a details page shows all ten). */
export const CORE_STATS: StatId[] = ['hp', 'atk', 'def', 'critChance'];

/** How a stat reads: its name, a short name for lists ("+4% Meter fill": plain words), its icon, how to print it, and
 *  what it does. */
export interface StatInfo {
  name: string;
  short: string;
  icon: string; // hudIcon key
  /** 'flat' prints 12, 'pct' prints 12% (the value is a fraction), 'mult' prints x2.3. */
  unit: 'flat' | 'pct' | 'mult';
  desc: string;
}

export const STAT_INFO: Record<StatId, StatInfo> = {
  hp: { name: 'Max HP', short: 'HP', icon: 'heart', unit: 'flat', desc: 'How much damage Rowan can take.' },
  atk: { name: 'Attack', short: 'ATK', icon: 'sword', unit: 'flat', desc: 'Damage of every hit (and the finisher).' },
  def: { name: 'Defense', short: 'DEF', icon: 'shield', unit: 'flat', desc: 'Cuts damage from reds you miss.' },
  critChance: { name: 'Crit Chance', short: 'Crit', icon: 'crit', unit: 'pct', desc: 'Chance a hit crits.' },
  critDmg: { name: 'Crit Damage', short: 'Crit Dmg', icon: 'critx', unit: 'mult', desc: 'How hard a crit hits.' },
  comboPower: { name: 'Combo Power', short: 'Combo', icon: 'bolt', unit: 'flat', desc: 'Finisher damage per attack point.' },
  meterGain: { name: 'Meter Gain', short: 'Meter fill', icon: 'meter', unit: 'pct', desc: 'Fills the finisher meter faster.' },
  steady: { name: 'Steady Cursor', short: 'Slower cursor', icon: 'clock', unit: 'pct', desc: 'Combo speeds the cursor up less.' },
  luck: { name: 'Luck', short: 'Luck', icon: 'clover', unit: 'pct', desc: 'Rarer drops and more coins.' },
  companion: { name: 'Companion Power', short: 'Companion', icon: 'feather', unit: 'flat', desc: 'Companions hit harder.' },
};

export type Slot = 'weapon' | 'helm' | 'armor' | 'boots' | 'trinket';
/** Where an item can be worn: one of each, and two trinkets. */
export type SlotKey = 'weapon' | 'helm' | 'armor' | 'boots' | 'trinket1' | 'trinket2';
export const SLOT_KEYS: SlotKey[] = ['weapon', 'helm', 'armor', 'boots', 'trinket1', 'trinket2'];
export const SLOTS: Slot[] = ['weapon', 'helm', 'armor', 'boots', 'trinket'];
export const SLOT_NAME: Record<Slot, string> = { weapon: 'Weapon', helm: 'Helm', armor: 'Armor', boots: 'Boots', trinket: 'Trinket' };
export const slotOf = (k: SlotKey): Slot => (k === 'trinket1' || k === 'trinket2' ? 'trinket' : k);

/** Gear uses the eight shared tiers (src/data/rarity.ts): Common grey up to Mythic red, then Celestial (a second
 *  unique effect) and Divine (two effects and an aura). */
export type GearRarity = Tier;
export const GEAR_RARITIES: GearRarity[] = TIERS;

/** Rarity names, bonus stats and frame colors [hi, base, lo, deep] (the shared tier table). */
export const RARITY_INFO: Record<GearRarity, TierInfo> = TIER_INFO;

/** A Legendary or Mythic item's unique effect. Signature items carry their own; other ones roll from the rest. */
export type EffectId =
  | 'cutlass'
  | 'golemheart'
  | 'tuskCrown'
  | 'pendulum'
  | 'opener'
  | 'leech'
  | 'riposte'
  | 'goldTouch'
  | 'owlEye'
  | 'secondWind'
  | 'ramshorn'
  | 'wyrmfang'
  // the third region's (src/data/gear-ash.ts)
  | AshEffectId;

export interface EffectDef {
  name: string;
  text: string; // one line, shown on the item
  signature?: boolean; // only on its boss's signature item
}

export const EFFECTS: Record<EffectId, EffectDef> = {
  cutlass: { name: 'Powder Monkey', text: 'Bombs you tap always crit.', signature: true },
  golemheart: { name: 'Stoneblood', text: 'Blocking a red heals 1 HP.', signature: true },
  tuskCrown: { name: 'Royal Charge', text: 'Each finisher stack spent: +5% crit for 5 s.', signature: true },
  pendulum: { name: 'Tick, Tock', text: 'Every 10th combo hit adds a green block.', signature: true },
  opener: { name: 'Opening Blow', text: 'The first hit on each new foe always crits.' },
  leech: { name: 'Leech', text: 'Crits heal 2 HP.' },
  riposte: { name: 'Riposte', text: 'Blocking a red hits back for half your attack.' },
  goldTouch: { name: 'Golden Touch', text: 'Kills drop 50% more coins.' },
  owlEye: { name: 'Owl Eye', text: 'Pip pecks every 3 hits instead of 4.' },
  secondWind: { name: 'Second Wind', text: 'Once a fight, dropping under 30% HP heals 20%.' },
  ramshorn: { name: 'Toll Paid', text: 'Blocking a red on ice heals 2 HP.', signature: true },
  wyrmfang: { name: 'Hoard Bite', text: 'Finished holds deal double damage.', signature: true },
  ...ASH_EFFECTS,
};

/** A Divine item's aura: a rule that holds for the whole fight. */
export type AuraId = 'radiance' | 'sanctuary' | 'stillness' | 'fortune';
export const AURA_IDS: AuraId[] = ['radiance', 'sanctuary', 'stillness', 'fortune'];

export const AURAS: Record<AuraId, EffectDef> = {
  radiance: { name: 'Radiance', text: 'Aura: foes take 10% more damage.' },
  sanctuary: { name: 'Sanctuary', text: 'Aura: heal 1% of max HP every 4 s.' },
  stillness: { name: 'Stillness', text: 'Aura: combo speeds the cursor up 30% less.' },
  fortune: { name: 'Fortune', text: 'Aura: kills drop 30% more coins.' },
};

/** Effects a non-signature Legendary or Mythic can roll (a Celestial or Divine item rolls two different ones). */
export const GENERAL_EFFECTS: EffectId[] = ['opener', 'leech', 'riposte', 'goldTouch', 'owlEye', 'secondWind'];

export type SetId = 'greenwarden' | 'footpad' | 'rimewalker' | AshSetId;

export interface SetDef {
  name: string;
  pieces: string[]; // base item ids
  bonuses: Array<{ count: number; text: string }>;
}

export const SETS: Record<SetId, SetDef> = {
  greenwarden: {
    name: 'Greenwarden',
    pieces: ['wardenHood', 'wardenMail', 'wardenTreads', 'wardenSprig'],
    bonuses: [
      { count: 2, text: '+10% max HP' },
      { count: 4, text: 'Rests heal 50%; kills heal 3%' },
    ],
  },
  footpad: {
    name: 'Footpad',
    pieces: ['footpadShiv', 'footpadDie'],
    bonuses: [{ count: 2, text: 'The first miss each fight keeps your combo' }],
  },
  rimewalker: {
    name: 'Rimewalker',
    pieces: ['rimeHood', 'rimeCoat', 'rimeBoots', 'rimeLocket'],
    bonuses: [
      { count: 2, text: '+20% damage on ice' },
      { count: 4, text: 'Finished holds heal 2% HP' },
    ],
  },
  ...ASH_SETS,
};

/** A stat an item grants before any bonus rolls: `mult` x the stat's base value for the slot. */
export interface BaseStat {
  stat: StatId;
  mult: number;
}

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  icon: string; // texture key suffix: engine/art-gear.ts draws `item_${icon}`
  base: BaseStat[];
  act: number; // the first act (0-based) it can drop in
  set?: SetId; // a set piece (drops at Rare or Epic)
  /** A boss's signature drop: only that boss drops it, always at this rarity, with this effect. */
  signature?: { boss: string; rarity: GearRarity; effect: EffectId };
}

// Base stats per slot: weapons Attack, helms HP and a little Defense, armor HP and Defense, boots Defense and
// Steady; trinkets each lean on one stat. `mult` scales the slot's usual amount (an axe hits harder than a dagger).
export const BASE_ITEMS: BaseItem[] = [
  // weapons
  { id: 'shortsword', name: 'Squire Shortsword', slot: 'weapon', icon: 'shortsword', base: [{ stat: 'atk', mult: 1 }], act: 0 },
  { id: 'hedgeSaber', name: 'Hedge Saber', slot: 'weapon', icon: 'saber', base: [{ stat: 'atk', mult: 1.05 }], act: 0 },
  { id: 'logAxe', name: 'Woodcutter Axe', slot: 'weapon', icon: 'axe', base: [{ stat: 'atk', mult: 1.15 }], act: 1 },
  { id: 'thornSpear', name: 'Thornspear', slot: 'weapon', icon: 'spear', base: [{ stat: 'atk', mult: 1.1 }, { stat: 'critChance', mult: 0.5 }], act: 2 },
  { id: 'footpadShiv', name: 'Footpad Shiv', slot: 'weapon', icon: 'shiv', base: [{ stat: 'atk', mult: 0.9 }, { stat: 'critChance', mult: 0.6 }], act: 0, set: 'footpad' },
  {
    id: 'captainsCutlass',
    name: "Captain's Cutlass",
    slot: 'weapon',
    icon: 'cutlass',
    base: [{ stat: 'atk', mult: 1.2 }],
    act: 0,
    signature: { boss: 'captain', rarity: 'legendary', effect: 'cutlass' },
  },
  // helms
  { id: 'leatherCap', name: 'Leather Cap', slot: 'helm', icon: 'cap', base: [{ stat: 'hp', mult: 0.6 }, { stat: 'def', mult: 0.3 }], act: 0 },
  { id: 'potHelm', name: 'Iron Pot Helm', slot: 'helm', icon: 'pothelm', base: [{ stat: 'hp', mult: 0.6 }, { stat: 'def', mult: 0.5 }], act: 1 },
  { id: 'featherHat', name: 'Plumed Hat', slot: 'helm', icon: 'plume', base: [{ stat: 'hp', mult: 0.5 }, { stat: 'luck', mult: 0.6 }], act: 0 },
  { id: 'wardenHood', name: 'Greenwarden Hood', slot: 'helm', icon: 'hood', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 0, set: 'greenwarden' },
  {
    id: 'tuskCrown',
    name: 'Tusk Crown',
    slot: 'helm',
    icon: 'tuskcrown',
    base: [{ stat: 'hp', mult: 0.7 }, { stat: 'critChance', mult: 0.6 }],
    act: 2,
    signature: { boss: 'boarKing', rarity: 'legendary', effect: 'tuskCrown' },
  },
  // armor
  { id: 'paddedVest', name: 'Padded Vest', slot: 'armor', icon: 'vest', base: [{ stat: 'hp', mult: 1 }, { stat: 'def', mult: 0.8 }], act: 0 },
  { id: 'ringmail', name: 'Ringmail', slot: 'armor', icon: 'ringmail', base: [{ stat: 'hp', mult: 0.9 }, { stat: 'def', mult: 1.1 }], act: 1 },
  { id: 'brambleCuirass', name: 'Bramble Cuirass', slot: 'armor', icon: 'cuirass', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 1 }], act: 2 },
  { id: 'wardenMail', name: 'Greenwarden Mail', slot: 'armor', icon: 'leafmail', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 0.8 }], act: 0, set: 'greenwarden' },
  {
    id: 'golemheartPlate',
    name: 'Golemheart Plate',
    slot: 'armor',
    icon: 'golemplate',
    base: [{ stat: 'hp', mult: 1.2 }, { stat: 'def', mult: 1.3 }],
    act: 1,
    signature: { boss: 'golem', rarity: 'legendary', effect: 'golemheart' },
  },
  // boots
  { id: 'wornBoots', name: 'Worn Boots', slot: 'boots', icon: 'boots', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1 }], act: 0 },
  { id: 'hobnails', name: 'Hobnail Boots', slot: 'boots', icon: 'hobnail', base: [{ stat: 'def', mult: 0.7 }, { stat: 'steady', mult: 1 }], act: 1 },
  { id: 'waders', name: 'Marsh Waders', slot: 'boots', icon: 'waders', base: [{ stat: 'hp', mult: 0.4 }, { stat: 'steady', mult: 1.2 }], act: 2 },
  { id: 'wardenTreads', name: 'Greenwarden Treads', slot: 'boots', icon: 'treads', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.1 }], act: 0, set: 'greenwarden' },
  // trinkets
  { id: 'clover', name: 'Four-leaf Clover', slot: 'trinket', icon: 'clover', base: [{ stat: 'luck', mult: 1 }], act: 0 },
  { id: 'owlCharm', name: 'Owl-feather Charm', slot: 'trinket', icon: 'owlcharm', base: [{ stat: 'companion', mult: 1 }], act: 0 },
  { id: 'emberLocket', name: 'Ember Locket', slot: 'trinket', icon: 'locket', base: [{ stat: 'critDmg', mult: 1 }], act: 0 },
  { id: 'cogBrooch', name: 'Cog Brooch', slot: 'trinket', icon: 'cog', base: [{ stat: 'meterGain', mult: 1 }], act: 1 },
  { id: 'whetstone', name: 'Whetstone Pendant', slot: 'trinket', icon: 'whetstone', base: [{ stat: 'critChance', mult: 1 }], act: 1 },
  { id: 'wardenSprig', name: 'Greenwarden Sprig', slot: 'trinket', icon: 'sprig', base: [{ stat: 'hp', mult: 0.6 }], act: 0, set: 'greenwarden' },
  { id: 'footpadDie', name: "Footpad's Loaded Die", slot: 'trinket', icon: 'die', base: [{ stat: 'luck', mult: 0.8 }], act: 0, set: 'footpad' },
  {
    id: 'pendulumShard',
    name: 'Pendulum Shard',
    slot: 'trinket',
    icon: 'shard',
    base: [{ stat: 'comboPower', mult: 1.5 }],
    act: 2,
    signature: { boss: 'boarKing', rarity: 'mythic', effect: 'pendulum' },
  },
];

// The next region's bases (from its first act, global act 3). Icons fall back to a slot's look until painted ones exist.
BASE_ITEMS.push(
  { id: 'icicleRapier', name: 'Icicle Rapier', slot: 'weapon', icon: 'rapier', base: [{ stat: 'atk', mult: 1.05 }, { stat: 'critChance', mult: 0.4 }], act: 3 },
  { id: 'frostbrand', name: 'Frostbrand', slot: 'weapon', icon: 'frostbrand', base: [{ stat: 'atk', mult: 1.15 }], act: 3 },
  { id: 'glacierMaul', name: 'Glacier Maul', slot: 'weapon', icon: 'maul', base: [{ stat: 'atk', mult: 1.25 }], act: 4 },
  { id: 'furHood', name: 'Fur Hood', slot: 'helm', icon: 'furhood', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 3 },
  { id: 'rimeglassVisor', name: 'Rimeglass Visor', slot: 'helm', icon: 'visor', base: [{ stat: 'hp', mult: 0.5 }, { stat: 'critDmg', mult: 0.6 }], act: 4 },
  { id: 'yakCoat', name: 'Yak-wool Coat', slot: 'armor', icon: 'yakcoat', base: [{ stat: 'hp', mult: 1.2 }, { stat: 'def', mult: 0.7 }], act: 3 },
  { id: 'frostplate', name: 'Frostplate', slot: 'armor', icon: 'frostplate', base: [{ stat: 'hp', mult: 1 }, { stat: 'def', mult: 1.3 }], act: 5 },
  { id: 'snowshoes', name: 'Snowshoe Boots', slot: 'boots', icon: 'snowshoes', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.3 }], act: 3 },
  { id: 'cramponGreaves', name: 'Crampon Greaves', slot: 'boots', icon: 'crampons', base: [{ stat: 'def', mult: 0.8 }, { stat: 'steady', mult: 1 }], act: 4 },
  { id: 'snowflakeLocket', name: 'Snowflake Locket', slot: 'trinket', icon: 'snowflake', base: [{ stat: 'meterGain', mult: 1.1 }], act: 3 },
  { id: 'icePrism', name: 'Ice Prism', slot: 'trinket', icon: 'prism', base: [{ stat: 'critDmg', mult: 1.1 }], act: 4 },
  // the Rimewalker set
  { id: 'rimeHood', name: 'Rimewalker Hood', slot: 'helm', icon: 'rimehood', base: [{ stat: 'hp', mult: 0.7 }, { stat: 'def', mult: 0.3 }], act: 3, set: 'rimewalker' },
  { id: 'rimeCoat', name: 'Rimewalker Coat', slot: 'armor', icon: 'rimecoat', base: [{ stat: 'hp', mult: 1.1 }, { stat: 'def', mult: 0.8 }], act: 3, set: 'rimewalker' },
  { id: 'rimeBoots', name: 'Rimewalker Boots', slot: 'boots', icon: 'rimeboots', base: [{ stat: 'def', mult: 0.5 }, { stat: 'steady', mult: 1.1 }], act: 3, set: 'rimewalker' },
  { id: 'rimeLocket', name: 'Snowflake Charm', slot: 'trinket', icon: 'rimelocket', base: [{ stat: 'hp', mult: 0.6 }], act: 3, set: 'rimewalker' },
  // the next region's signature Legendaries
  { id: 'ramshornHelm', name: 'Ramshorn Helm', slot: 'helm', icon: 'ramshorn', base: [{ stat: 'hp', mult: 0.8 }, { stat: 'def', mult: 0.6 }], act: 3, signature: { boss: 'rimehorn', rarity: 'legendary', effect: 'ramshorn' } },
  { id: 'wyrmfang', name: 'Wyrmfang', slot: 'weapon', icon: 'wyrmfang', base: [{ stat: 'atk', mult: 1.3 }], act: 5, signature: { boss: 'glacia', rarity: 'legendary', effect: 'wyrmfang' } },
);

// the third region's bases (from its first act, global act 6), its Emberwright set and signature Legendaries
BASE_ITEMS.push(...(ASH_BASE_ITEMS as BaseItem[]));

export const BASE_BY_ID: Record<string, BaseItem> = Object.fromEntries(BASE_ITEMS.map((b) => [b.id, b]));

/**
 * Each boss's signature drops, rolled on every kill with bad-luck protection (core/gear.ts): the chance starts at
 * tuning.gear.sigChance (a Mythic: mythicChance) and rises by sigStep (mythicStep) with every kill that didn't drop
 * it, back to the start when it drops. Only that boss drops them.
 */
export const SIGNATURES: Record<string, string[]> = {
  captain: ['captainsCutlass'],
  golem: ['golemheartPlate'],
  boarKing: ['tuskCrown', 'pendulumShard'],
  rimehorn: ['ramshornHelm'],
  glacia: ['wyrmfang'],
  ...ASH_SIGNATURES,
};
