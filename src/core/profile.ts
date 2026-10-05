// The player's profile, kept across runs (pure; storage.ts saves it): how far Greenmarch has been cleared, the
// Great Pendulum's weights home, and the gear chase: the bag, what Rowan wears, coins and scrap (both carry over
// between runs), each signature drop's bad-luck counter, and the accuracy log.
//
// v1 was "progress" (acts cleared and weights only); readProfile migrates it.

import { SLOT_KEYS, slotOf, type GearRarity, type SlotKey, type StatId } from '../data/gear';
import { newAccuracyLog, readAccuracyLog, type AccuracyLog } from './accuracy';
import {
  itemPower,
  itemStats,
  loadoutOf,
  rarityIndex,
  rerollBonus,
  rerollCost,
  salvageValue,
  slotOfItem,
  upgradeCost,
  validItem,
  zeroStats,
  type Item,
  type Loadout,
  type StatBlock,
} from './gear';
import type { Rng } from './rng';
import type { Tuning } from './tuning';

export const PROFILE_VERSION = 2;
export const WEIGHTS_TOTAL = 12;

export interface Profile {
  v: 2;
  actsCleared: number; // Greenmarch's acts cleared at least once (0-3)
  weights: number; // pendulum weights recovered (a region cleared brings one home)
  coins: number; // the purse: kept between runs, spent at shops and the forge
  scrap: number; // from salvaging, spent at the forge
  items: Item[]; // the bag (equipped items included)
  equipped: Record<SlotKey, number>; // item uid per slot (0 = empty)
  nextUid: number;
  found: number; // items found so far (numbers them for "sort by new")
  blp: Record<string, number>; // per signature drop: boss kills since it last dropped
  acc: AccuracyLog;
  smithMet: boolean; // the forge's intro scene has played
}

/** @deprecated the old name (progress across runs); a profile is a superset of it. */
export type Progress = Profile;

const noSlots = (): Record<SlotKey, number> => ({ weapon: 0, helm: 0, armor: 0, boots: 0, trinket1: 0, trinket2: 0 });

export function newProfile(): Profile {
  return { v: 2, actsCleared: 0, weights: 0, coins: 0, scrap: 0, items: [], equipped: noSlots(), nextUid: 1, found: 0, blp: {}, acc: newAccuracyLog(), smithMet: false };
}

const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo);

/** A saved profile in current form: v2 is checked, v1 (progress) is migrated, anything else starts over. */
export function readProfile(data: unknown): Profile {
  const d = data as Record<string, unknown> | null;
  const p = newProfile();
  if (!d || typeof d !== 'object') return p;
  if (d.v !== 1 && d.v !== 2) return p;
  p.actsCleared = int(d.actsCleared, 0, 3);
  p.weights = int(d.weights, 0, WEIGHTS_TOTAL);
  if (d.v === 1) return p; // v1 -> v2: progress kept, the gear starts empty
  p.coins = int(d.coins, 0, 1e9);
  p.scrap = int(d.scrap, 0, 1e9);
  const seen = new Set<number>();
  p.items = (Array.isArray(d.items) ? d.items : []).filter((i): i is Item => validItem(i) && i.uid > 0 && !seen.has(i.uid) && !!seen.add(i.uid)).map((i) => ({ ...i, bonus: i.bonus.map((b) => ({ ...b })) }));
  const eq = (d.equipped ?? {}) as Record<string, unknown>;
  for (const k of SLOT_KEYS) {
    const uid = int(eq[k], 0, 1e9);
    const it = p.items.find((i) => i.uid === uid);
    p.equipped[k] = it && slotOfItem(it) === slotOf(k) ? uid : 0;
  }
  if (p.equipped.trinket1 && p.equipped.trinket1 === p.equipped.trinket2) p.equipped.trinket2 = 0;
  p.nextUid = Math.max(int(d.nextUid, 1, 1e9), ...p.items.map((i) => i.uid + 1));
  p.found = Math.max(int(d.found, 0, 1e9), ...p.items.map((i) => i.found));
  const blp = (d.blp ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(blp)) p.blp[k] = int(blp[k], 0, 1e6);
  p.acc = readAccuracyLog(d.acc);
  p.smithMet = d.smithMet === true;
  return p;
}

/** @deprecated use newProfile / readProfile. */
export const newProgress = newProfile;
export const readProgress = readProfile;

/** Act `act` (0-based) was just cleared. Returns true if that's new. */
export function recordAct(p: Profile, act: number): boolean {
  if (act + 1 <= p.actsCleared) return false;
  p.actsCleared = act + 1;
  return true;
}

/** The region was cleared: its weight is home (once). */
export function recordRegion(p: Profile): boolean {
  if (p.weights >= 1) return false;
  p.weights = 1;
  return true;
}

// ---------------------------------------------------------------- the bag

export const itemByUid = (p: Profile, uid: number): Item | undefined => p.items.find((i) => i.uid === uid);

export const isEquipped = (p: Profile, uid: number): boolean => uid > 0 && SLOT_KEYS.some((k) => p.equipped[k] === uid);

/** The item worn in a slot. */
export const equippedIn = (p: Profile, k: SlotKey): Item | undefined => (p.equipped[k] ? itemByUid(p, p.equipped[k]) : undefined);

export const equippedItems = (p: Profile): Item[] => SLOT_KEYS.map((k) => equippedIn(p, k)).filter((i): i is Item => !!i);

/** What Rowan's gear adds up to. */
export const profileLoadout = (p: Profile, t: Tuning): Loadout => loadoutOf(t, equippedItems(p));

export interface AddResult {
  item: Item;
  /** Scrap it was salvaged into because the bag was full (0 = it went in the bag). */
  salvaged: number;
}

/** A drop goes in the bag (numbered); if the bag is full it is salvaged into scrap instead. */
export function addItem(p: Profile, t: Tuning, drop: Item): AddResult {
  const item: Item = { ...drop, bonus: drop.bonus.map((b) => ({ ...b })), uid: p.nextUid++, found: ++p.found, fresh: true };
  if (p.items.length >= Math.max(1, Math.round(t.gear.bagSize))) {
    const salvaged = salvageValue(t, item);
    p.scrap += salvaged;
    return { item, salvaged };
  }
  p.items.push(item);
  return { item, salvaged: 0 };
}

/**
 * Wear an item. A trinket goes in `slot` if given, else an empty trinket slot, else the first. Whatever was there
 * goes back in the bag. Returns the slot it went in (null if it can't go there).
 */
export function equip(p: Profile, uid: number, slot?: SlotKey): SlotKey | null {
  const it = itemByUid(p, uid);
  if (!it) return null;
  const kind = slotOfItem(it);
  let k: SlotKey | undefined = slot;
  if (k && slotOf(k) !== kind) return null;
  if (!k) k = kind === 'trinket' ? (p.equipped.trinket1 === uid ? 'trinket1' : p.equipped.trinket2 === uid ? 'trinket2' : !p.equipped.trinket1 ? 'trinket1' : !p.equipped.trinket2 ? 'trinket2' : 'trinket1') : kind;
  for (const s of SLOT_KEYS) if (p.equipped[s] === uid) p.equipped[s] = 0; // a trinket moving between its two slots
  p.equipped[k] = uid;
  it.fresh = false;
  return k;
}

export function unequip(p: Profile, k: SlotKey): void {
  p.equipped[k] = 0;
}

export function toggleLock(p: Profile, uid: number): boolean {
  const it = itemByUid(p, uid);
  if (!it) return false;
  it.locked = !it.locked;
  return it.locked;
}

/** Salvage one item into scrap (not a locked or equipped one). Returns the scrap gained. */
export function salvage(p: Profile, t: Tuning, uid: number): number {
  const it = itemByUid(p, uid);
  if (!it || it.locked || isEquipped(p, uid)) return 0;
  const v = salvageValue(t, it);
  p.scrap += v;
  p.items = p.items.filter((i) => i.uid !== uid);
  return v;
}

/** Salvage every unlocked, unworn item of these rarities ("salvage all Common/Uncommon"). */
export function salvageAll(p: Profile, t: Tuning, rarities: GearRarity[] = ['common', 'uncommon']): { count: number; scrap: number } {
  let count = 0;
  let scrap = 0;
  for (const it of p.items.slice()) {
    if (!rarities.includes(it.rarity) || it.locked || isEquipped(p, it.uid)) continue;
    scrap += salvage(p, t, it.uid);
    count++;
  }
  return { count, scrap };
}

export type ForgeFail = 'max' | 'scrap' | 'coins' | 'none';

/** Forge an item one level up (+1), paying scrap and coins. */
export function upgrade(p: Profile, t: Tuning, uid: number): ForgeFail | 'ok' {
  const it = itemByUid(p, uid);
  if (!it) return 'none';
  const c = upgradeCost(t, it);
  if (!c) return 'max';
  if (p.scrap < c.scrap) return 'scrap';
  if (p.coins < c.coins) return 'coins';
  p.scrap -= c.scrap;
  p.coins -= c.coins;
  it.plus++;
  return 'ok';
}

/** Reroll one bonus stat for coins (the price doubles with each reroll on the item). */
export function reroll(p: Profile, t: Tuning, uid: number, line: number, rng: Rng): ForgeFail | 'ok' {
  const it = itemByUid(p, uid);
  if (!it || !it.bonus[line]) return 'none';
  const c = rerollCost(t, it);
  if (p.coins < c) return 'coins';
  if (!rerollBonus(rng, it, line)) return 'none';
  p.coins -= c;
  it.rerolls++;
  return 'ok';
}

export type SortMode = 'rarity' | 'slot' | 'new';
const SLOT_ORDER = ['weapon', 'helm', 'armor', 'boots', 'trinket'];

/** The bag in display order. */
export function sortItems(t: Tuning, items: Item[], mode: SortMode): Item[] {
  const power = new Map(items.map((i) => [i.uid, itemPower(t, i)]));
  const byRarity = (a: Item, b: Item) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || power.get(b.uid)! - power.get(a.uid)! || b.found - a.found;
  return items.slice().sort((a, b) => {
    if (mode === 'new') return Number(b.fresh) - Number(a.fresh) || b.found - a.found;
    if (mode === 'slot') return SLOT_ORDER.indexOf(slotOfItem(a)) - SLOT_ORDER.indexOf(slotOfItem(b)) || byRarity(a, b);
    return byRarity(a, b);
  });
}

/** The worn item an item would replace: its slot's, or for a trinket the weaker of the two (an empty slot first). */
export function replaces(p: Profile, t: Tuning, item: Item): { slot: SlotKey; item: Item | undefined } {
  const kind = slotOfItem(item);
  if (kind !== 'trinket') return { slot: kind, item: equippedIn(p, kind) };
  for (const k of ['trinket1', 'trinket2'] as SlotKey[]) if (p.equipped[k] === item.uid) return { slot: k, item };
  const a = equippedIn(p, 'trinket1');
  const b = equippedIn(p, 'trinket2');
  if (!a) return { slot: 'trinket1', item: undefined };
  if (!b) return { slot: 'trinket2', item: undefined };
  return itemPower(t, a) <= itemPower(t, b) ? { slot: 'trinket1', item: a } : { slot: 'trinket2', item: b };
}

/** Stat changes if `item` replaced what it would replace (green up, red down in the bag's compare panel). */
export function compareStats(p: Profile, t: Tuning, item: Item): Array<{ stat: StatId; delta: number }> {
  const cur = replaces(p, t, item).item;
  const now: StatBlock = cur ? itemStats(t, cur) : zeroStats();
  const next = itemStats(t, item);
  return (Object.keys(next) as StatId[]).map((stat) => ({ stat, delta: next[stat] - now[stat] })).filter((d) => Math.abs(d.delta) > 1e-9);
}
