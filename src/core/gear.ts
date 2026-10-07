// Gear (pure; no DOM): items, their stats, drops and the forge's prices. Content (base items, sets, effects,
// signature drops) is in src/data/gear.ts; every number is in tuning.gear / tuning.forge.
//
// An item has a base (which says its slot and its base stat), a rarity, an item level (from the act it dropped in),
// a forge level (+0 to +10), 0-4 bonus stats and (Legendary and Mythic) a unique effect. Bonus stats are stored as
// where in their range they rolled (0..1), so the values follow the tuning.

import {
  AURA_IDS,
  BASE_BY_ID,
  BASE_ITEMS,
  GEAR_RARITIES,
  GENERAL_EFFECTS,
  RARITY_INFO,
  SETS,
  SIGNATURES,
  STAT_IDS,
  STAT_INFO,
  type BaseItem,
  type AuraId,
  type EffectId,
  type GearRarity,
  type SetId,
  type Slot,
  type StatId,
} from '../data/gear';
import type { NodeType } from '../data/types';
import type { Rng } from './rng';
import type { Tuning } from './tuning';

export interface BonusRoll {
  stat: StatId;
  q: number; // where in the stat's roll range it landed (0 = the low end, 1 = the high end)
}

export interface Item {
  uid: number; // unique in the profile (0 until it's added)
  base: string; // base item id (src/data/gear.ts)
  rarity: GearRarity;
  ilvl: number;
  plus: number; // forge level
  bonus: BonusRoll[];
  effect: EffectId | null;
  /** Celestial and Divine: a second unique effect (never the same as the first). */
  effect2?: EffectId | null;
  /** Divine: an aura, a rule for the whole fight. */
  aura?: AuraId | null;
  locked: boolean; // kept out of "salvage all" (and salvage)
  fresh: boolean; // not looked at in the bag yet
  rerolls: number; // bonus rerolls bought on this item (each one costs double)
  found: number; // the order items were found in (sort by new)
}

export type StatBlock = Record<StatId, number>;

export const zeroStats = (): StatBlock => ({ hp: 0, atk: 0, def: 0, critChance: 0, critDmg: 0, comboPower: 0, meterGain: 0, steady: 0, luck: 0, companion: 0 });

/** What the equipped gear adds up to: stats, unique effects, and pieces worn per set. */
export interface Loadout {
  stats: StatBlock;
  effects: EffectId[];
  sets: Partial<Record<SetId, number>>;
  /** Divine items' auras (missing = none). */
  auras?: AuraId[];
}

export const emptyLoadout = (): Loadout => ({ stats: zeroStats(), effects: [], sets: {}, auras: [] });

export const rarityIndex = (r: GearRarity): number => GEAR_RARITIES.indexOf(r);

const G = (t: Tuning) => t.gear;

/** A stat's usual amount on an item at level 0 (tuning.gear.atk, .hp, ...). */
export const statAmount = (t: Tuning, s: StatId): number => G(t)[s];

/** How much bigger a rarity's base stat is than a Common's. */
export function rarityMult(t: Tuning, r: GearRarity): number {
  const g = G(t);
  return [g.rCommon, g.rUncommon, g.rRare, g.rEpic, g.rLegendary, g.rMythic, g.rCelestial, g.rDivine][rarityIndex(r)] ?? 1;
}

/** Stats grow with item level. */
export const levelMult = (t: Tuning, ilvl: number): number => 1 + Math.max(0, ilvl) * G(t).levelScale;

export const baseOf = (item: Item): BaseItem | undefined => BASE_BY_ID[item.base];
export const slotOfItem = (item: Item): Slot => baseOf(item)?.slot ?? 'trinket';

export interface StatLine {
  stat: StatId;
  value: number;
}

/** The base stat(s), with the forge's levels on top. */
export function baseStats(t: Tuning, item: Item, plus = item.plus): StatLine[] {
  const b = baseOf(item);
  if (!b) return [];
  const k = levelMult(t, item.ilvl) * rarityMult(t, item.rarity) * (1 + t.forge.upgradeStep * plus);
  return b.base.map((s) => ({ stat: s.stat, value: statAmount(t, s.stat) * s.mult * k }));
}

/** The value a bonus roll comes to on this item. */
export function bonusValue(t: Tuning, item: Item, roll: BonusRoll): number {
  const g = G(t);
  const share = g.bonusLo + (g.bonusHi - g.bonusLo) * Math.max(0, Math.min(1, roll.q));
  return statAmount(t, roll.stat) * share * levelMult(t, item.ilvl) * rarityMult(t, item.rarity);
}

export const bonusStats = (t: Tuning, item: Item): StatLine[] => item.bonus.map((r) => ({ stat: r.stat, value: bonusValue(t, item, r) }));

/** Everything the item gives (base and bonus stats summed). */
export function itemStats(t: Tuning, item: Item): StatBlock {
  const out = zeroStats();
  for (const l of [...baseStats(t, item), ...bonusStats(t, item)]) out[l.stat] += l.value;
  return out;
}

// How much a point of each stat is worth, relative to its usual amount on an item (attack counts most). The bag's
// "power" number and the balance bot's choices both use it.
const POWER_WEIGHT: Record<StatId, number> = { hp: 1, atk: 1.6, def: 0.8, critChance: 1, critDmg: 0.7, comboPower: 0.8, meterGain: 0.8, steady: 0.6, luck: 0.4, companion: 0.4 };

/** One number for how strong a set of stats is (a Common item's base stat at level 0 is about 10). */
export function statPower(t: Tuning, s: StatBlock): number {
  let p = 0;
  for (const id of STAT_IDS) p += (s[id] / Math.max(1e-9, statAmount(t, id))) * 10 * POWER_WEIGHT[id];
  return p;
}

/** An item's power: its stats, plus a unique effect's worth. */
export function itemPower(t: Tuning, item: Item): number {
  const fx = (item.effect ? 1 : 0) + (item.effect2 ? 1 : 0) + (item.aura ? 1.5 : 0);
  return Math.round(statPower(t, itemStats(t, item)) + fx * 12 * levelMult(t, item.ilvl));
}

/** Add up the equipped items. */
export function loadoutOf(t: Tuning, items: Item[]): Loadout {
  const L = emptyLoadout();
  for (const it of items) {
    const s = itemStats(t, it);
    for (const id of STAT_IDS) L.stats[id] += s[id];
    for (const e of [it.effect, it.effect2]) if (e && !L.effects.includes(e)) L.effects.push(e);
    if (it.aura && !L.auras!.includes(it.aura)) L.auras!.push(it.aura);
    const set = baseOf(it)?.set;
    if (set) L.sets[set] = (L.sets[set] ?? 0) + 1;
  }
  return L;
}

export const hasEffect = (L: Loadout | undefined, e: EffectId): boolean => !!L && L.effects.includes(e);
export const hasAura = (L: Loadout | undefined, a: AuraId): boolean => !!L && (L.auras ?? []).includes(a);
export const setPieces = (L: Loadout | undefined, s: SetId): number => L?.sets[s] ?? 0;

/** A stat value as the UI prints it ("+12", "+4.5%", "x0.15"). */
export function fmtStat(stat: StatId, v: number, signed = true): string {
  const u = STAT_INFO[stat].unit;
  const sign = signed && v >= 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (u === 'pct') {
    const pct = a * 100;
    return `${sign}${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
  }
  if (u === 'mult') return `${sign}${(Math.round(a * 100) / 100).toFixed(2)}x`;
  if (stat === 'hp') return `${sign}${Math.round(a)}`;
  return `${sign}${a >= 20 ? Math.round(a) : Math.round(a * 10) / 10}`;
}

/**
 * A stat as lists print it: whole numbers in plain units ("+4", "+5%", and crit damage as a percent too: "+16%"). A
 * flat stat under 1 keeps one decimal and a percent is at least 1%, so a small stat never reads "+0". (fmtStat keeps
 * the precise form for the forge's before -> after and the hero's totals.)
 */
export function fmtStatShort(stat: StatId, v: number, signed = true): string {
  const sign = signed && v >= 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (STAT_INFO[stat].unit !== 'flat') return `${sign}${a > 0 ? Math.max(1, Math.round(a * 100)) : 0}%`;
  return `${sign}${a > 0 && a < 0.95 ? Math.max(0.1, Math.round(a * 10) / 10) : Math.round(a)}`;
}

/** A hero's total as lists print it: like fmtStatShort unsigned, but crit damage stays a multiplier ("x2.2"). */
export function fmtTotal(stat: StatId, v: number): string {
  if (STAT_INFO[stat].unit === 'mult') return `x${(Math.round(v * 10) / 10).toFixed(1)}`;
  return fmtStatShort(stat, v, false);
}

/** Whether a part of a stat is big enough to print (it wouldn't round away). */
export const statShows = (stat: StatId, v: number): boolean => Math.abs(v) >= (STAT_INFO[stat].unit === 'flat' ? 0.05 : 0.0005);

// ---------------------------------------------------------------- rolling items

/** The item level of drops in act `act` (0-based) on map row `row`. */
export function itemLevel(t: Tuning, act: number, row: number): number {
  const g = G(t);
  // Region 1's acts have their own levels; later acts climb ilvlPerAct per act from Act 3's
  const base = act <= 2 ? [g.ilvlAct1, g.ilvlAct2, g.ilvlAct3][Math.max(0, act)] : g.ilvlAct3 + (act - 2) * g.ilvlPerAct;
  return Math.max(1, Math.round(base + Math.max(0, row) * g.ilvlPerRow));
}

/** Rarity weights, common first, shifted toward the rare end by Luck. */
export function rarityWeights(t: Tuning, luck: number): number[] {
  const g = G(t);
  const w = [g.wCommon, g.wUncommon, g.wRare, g.wEpic, g.wLegendary, g.wMythic, g.wCelestial, g.wDivine];
  return w.map((x, i) => Math.max(0, x) * (1 + Math.max(0, luck) * g.luckShift * i));
}

/** Roll a rarity (never below `min`). */
export function rollRarity(rng: Rng, t: Tuning, luck: number, min: GearRarity = 'common'): GearRarity {
  const w = rarityWeights(t, luck).map((x, i) => (i < rarityIndex(min) ? 0 : x));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return min;
  let x = rng.next() * total;
  for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return GEAR_RARITIES[i];
  return min;
}

// slots come up evenly, a little more often for trinkets (Rowan wears two)
const SLOT_WEIGHT: Record<Slot, number> = { weapon: 1, helm: 1, armor: 1, boots: 1, trinket: 1.5 };

/** Bonus stats: `n` different stats, none the item's base stat (if there are enough to choose from). */
function rollBonus(rng: Rng, base: BaseItem, n: number): BonusRoll[] {
  const own = base.base.map((s) => s.stat);
  const pool = STAT_IDS.filter((s) => !own.includes(s));
  const out: BonusRoll[] = [];
  while (out.length < n && pool.length) out.push({ stat: pool.splice(rng.int(pool.length), 1)[0], q: rng.next() });
  return out;
}

/** A new item (uid 0: the profile numbers it). */
export function makeItem(rng: Rng, base: BaseItem, rarity: GearRarity, ilvl: number): Item {
  const info = RARITY_INFO[rarity];
  const effect = base.signature ? base.signature.effect : info.effects >= 1 ? GENERAL_EFFECTS[rng.int(GENERAL_EFFECTS.length)] : null;
  const item: Item = { uid: 0, base: base.id, rarity, ilvl, plus: 0, bonus: rollBonus(rng, base, info.bonus), effect, locked: false, fresh: true, rerolls: 0, found: 0 };
  if (info.effects >= 2) {
    // Celestial and Divine: a second, different effect
    const pool = GENERAL_EFFECTS.filter((e) => e !== effect);
    item.effect2 = pool[rng.int(pool.length)];
  }
  if (info.aura) item.aura = AURA_IDS[rng.int(AURA_IDS.length)];
  return item;
}

/** A random drop for act `act`: a slot, a base that can drop there, a rarity (shifted by Luck), its bonus stats. */
export function rollItem(rng: Rng, t: Tuning, act: number, ilvl: number, luck: number, min: GearRarity = 'common'): Item {
  const rarity = rollRarity(rng, t, luck, min);
  const slots = Object.keys(SLOT_WEIGHT) as Slot[];
  let x = rng.next() * slots.reduce((a, s) => a + SLOT_WEIGHT[s], 0);
  let slot: Slot = slots[slots.length - 1];
  for (const s of slots) if ((x -= SLOT_WEIGHT[s]) < 0) {
    slot = s;
    break;
  }
  const plain = BASE_ITEMS.filter((b) => b.slot === slot && !b.signature && !b.set && b.act <= act);
  let base = plain[rng.int(plain.length)] ?? BASE_ITEMS.find((b) => b.slot === slot && !b.signature)!;
  if ((rarity === 'rare' || rarity === 'epic') && rng.next() < G(t).setChance) {
    const sets = BASE_ITEMS.filter((b) => b.slot === slot && !!b.set && b.act <= act);
    if (sets.length) base = sets[rng.int(sets.length)];
  }
  return makeItem(rng, base, rarity, ilvl);
}

/** Where a fight was won, for its drops. */
export interface DropContext {
  act: number;
  row: number;
  type: NodeType | 'treasure';
  /** The boss beaten (a boss node): rolls its signature drops. */
  boss?: string;
  /** The region's last boss (more items than a mini-boss). */
  finalBoss?: boolean;
  luck: number;
}

/**
 * The items a node gives: a fight 50% one, an elite one (Uncommon or better), a treasure chest 1-2, a mini-boss 2
 * and the boss 3, each plus its signature rolls. `blp` counts each signature's kills without the drop (bad-luck
 * protection); it is updated here.
 */
export function rollDrops(rng: Rng, t: Tuning, ctx: DropContext, blp: Record<string, number>): Item[] {
  const g = G(t);
  const ilvl = itemLevel(t, ctx.act, ctx.row);
  const out: Item[] = [];
  const roll = (n: number, min: GearRarity = 'common') => {
    for (let i = 0; i < n; i++) out.push(rollItem(rng, t, ctx.act, ilvl, ctx.luck, min));
  };
  switch (ctx.type) {
    case 'fight':
      if (rng.next() < g.fightChance) roll(1);
      break;
    case 'elite':
      roll(Math.round(g.eliteItems), 'uncommon');
      break;
    case 'treasure': {
      const lo = Math.round(Math.min(g.treasureMin, g.treasureMax));
      const hi = Math.round(Math.max(g.treasureMin, g.treasureMax));
      roll(lo + rng.int(hi - lo + 1));
      break;
    }
    case 'boss':
      roll(Math.round(ctx.finalBoss ? g.bossItems : g.miniBossItems));
      break;
  }
  if (ctx.type === 'boss' && ctx.boss) out.push(...rollSignatures(rng, t, ctx.boss, ilvl, blp));
  return out;
}

/** The signature drop's chance on this kill (bad-luck protection: it grows with every kill that missed it). */
export function signatureChance(t: Tuning, id: string, misses: number): number {
  const g = G(t);
  const mythic = BASE_BY_ID[id]?.signature?.rarity === 'mythic';
  return Math.min(1, (mythic ? g.mythicChance : g.sigChance) + Math.max(0, misses) * (mythic ? g.mythicStep : g.sigStep));
}

/** Roll a boss's signature drops; `blp` keeps each one's misses (reset to 0 when it drops). */
export function rollSignatures(rng: Rng, t: Tuning, boss: string, ilvl: number, blp: Record<string, number>): Item[] {
  const out: Item[] = [];
  for (const id of SIGNATURES[boss] ?? []) {
    const base = BASE_BY_ID[id];
    if (!base?.signature) continue;
    if (rng.next() < signatureChance(t, id, blp[id] ?? 0)) {
      blp[id] = 0;
      out.push(makeItem(rng, base, base.signature.rarity, ilvl));
    } else blp[id] = (blp[id] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------- the forge

function costMult(t: Tuning, r: GearRarity): number {
  const f = t.forge;
  return [f.costCommon, f.costUncommon, f.costRare, f.costEpic, f.costLegendary, f.costMythic, f.costCelestial, f.costDivine][rarityIndex(r)] ?? 1;
}

/** What upgrading the item one more level costs (null at the max). */
export function upgradeCost(t: Tuning, item: Item): { scrap: number; coins: number } | null {
  const f = t.forge;
  if (item.plus >= Math.round(f.maxPlus)) return null;
  const k = Math.pow(f.upgradeGrowth, item.plus) * costMult(t, item.rarity);
  return { scrap: Math.max(1, Math.round(f.upgradeScrap * k)), coins: Math.max(0, Math.round(f.upgradeCoins * k)) };
}

/** Coins to reroll one of the item's bonus stats (doubles with every reroll on it). */
export const rerollCost = (t: Tuning, item: Item): number => Math.round(t.forge.rerollCoins * Math.pow(2, item.rerolls));

/** Scrap the item salvages into: by rarity and level, plus half the scrap its upgrades cost. */
export function salvageValue(t: Tuning, item: Item): number {
  const f = t.forge;
  const base = [f.scrapCommon, f.scrapUncommon, f.scrapRare, f.scrapEpic, f.scrapLegendary, f.scrapMythic, f.scrapCelestial, f.scrapDivine][rarityIndex(item.rarity)] ?? 1;
  let spent = 0;
  for (let p = 0; p < item.plus; p++) spent += upgradeCost(t, { ...item, plus: p })?.scrap ?? 0;
  return Math.max(1, Math.round(base * (1 + item.ilvl / 25)) + Math.floor(spent / 2));
}

/** Reroll bonus line `line` into a different stat (not one the item already has) at a fresh roll. */
export function rerollBonus(rng: Rng, item: Item, line: number): boolean {
  const base = baseOf(item);
  if (!base || !item.bonus[line]) return false;
  const taken = [...base.base.map((s) => s.stat), ...item.bonus.filter((_, i) => i !== line).map((r) => r.stat)];
  const pool = STAT_IDS.filter((s) => !taken.includes(s));
  if (!pool.length) return false;
  item.bonus[line] = { stat: pool[rng.int(pool.length)], q: rng.next() };
  return true;
}

/** An item's name as shown: "Hedge Saber +3". */
export function itemName(item: Item): string {
  const b = baseOf(item);
  return `${b?.name ?? 'Unknown'}${item.plus > 0 ? ` +${item.plus}` : ''}`;
}

/** The sets an item belongs to (for the bag's set text). */
export const setOf = (item: Item): SetId | undefined => baseOf(item)?.set;
export { SETS };

/** Whether `data` is a well-formed item (save loading drops anything else). */
export function validItem(data: unknown): data is Item {
  const i = data as Item;
  const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  return (
    !!i &&
    typeof i === 'object' &&
    !!BASE_BY_ID[i.base] &&
    GEAR_RARITIES.includes(i.rarity) &&
    [i.uid, i.ilvl, i.plus, i.rerolls, i.found].every(n) &&
    Array.isArray(i.bonus) &&
    i.bonus.every((r) => r && STAT_IDS.includes(r.stat) && n(r.q)) &&
    (i.effect === null || typeof i.effect === 'string') &&
    (i.effect2 === undefined || i.effect2 === null || typeof i.effect2 === 'string') &&
    (i.aura === undefined || i.aura === null || AURA_IDS.includes(i.aura)) &&
    typeof i.locked === 'boolean' &&
    typeof i.fresh === 'boolean'
  );
}
