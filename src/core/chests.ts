// Hero chests (pure): what one holds and opening it. A hero chest (bosses, bounties, rarely elites; opened free)
// holds a hero or a companion, weighted toward the low tiers, or shards for one you own. The shrine sells Rare chests
// for gems: better odds and pity (a Legendary or better within tuning.chests.pity chests, with soft pity climbing
// before it; a Celestial or better within topPity). A region at 100% gives a region chest (Epic or better).
// Story heroes (Sable, the frost mage) and the starter never come out of chests as new heroes, but owned ones can
// get shards. A tier with nothing in it yet (no Mythic heroes so far) falls to the best tier below that has some.

import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../data/companions';
import { HEROES, HERO_IDS, type HeroId } from '../data/heroes';
import { TIERS, tierIndex, type Tier } from '../data/rarity';
import type { ChestKind, Profile } from './profile';
import type { Rng } from './rng';
import { addShards, grantHero, grantPet, heroOwned, ownedHeroes, ownedPets, petOwned } from './roster';
import type { Tuning } from './tuning';

export type ChestPrize =
  | { kind: 'hero'; id: HeroId; tier: Tier; fresh: boolean; shards: number; starsUp: number }
  | { kind: 'pet'; id: CompanionId; tier: Tier; fresh: boolean; shards: number; starsUp: number }
  | { kind: 'heroShards'; id: HeroId; tier: Tier; shards: number; starsUp: number }
  | { kind: 'petShards'; id: CompanionId; tier: Tier; shards: number; starsUp: number };

/** Heroes a chest can bring as new ones (the chest heroes). */
export const CHEST_HEROES: HeroId[] = HERO_IDS.filter((id) => HEROES[id].joins === 'chest');

/** A chest kind's tier weights (Common to Divine); the shrine's Rare chest with its soft pity applied. */
export function chestWeights(t: Tuning, kind: ChestKind, pity = 0): number[] {
  const w = (t.chests[kind] as number[]).slice(0, TIERS.length).map((x) => Math.max(0, x));
  while (w.length < TIERS.length) w.push(0);
  if (kind === 'rare' && pity >= t.chests.softPity) {
    // soft pity: Legendary and up climb a step for every chest past the soft line
    const k = 1 + t.chests.softStep * (pity - t.chests.softPity + 1) * 10;
    for (let i = tierIndex('legendary'); i < w.length; i++) w[i] *= k;
  }
  return w;
}

/** The chance (0..1) each tier comes up, for the shrine's odds display. */
export function chestOdds(t: Tuning, kind: ChestKind, pity = 0): number[] {
  const w = chestWeights(t, kind, pity);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x) => x / sum);
}

/** How many more Rare chests until each pity tier is guaranteed (1 = the next one). */
export function pityLeft(p: Profile, t: Tuning): { legendary: number; top: number } {
  return { legendary: Math.max(1, Math.round(t.chests.pity) - p.pity.rare), top: Math.max(1, Math.round(t.chests.topPity) - p.pity.top) };
}

function rollTier(rng: Rng, w: number[], min: Tier): Tier {
  const lo = tierIndex(min);
  const ws = w.map((x, i) => (i < lo ? 0 : x));
  const sum = ws.reduce((a, b) => a + b, 0);
  if (sum <= 0) return min;
  let x = rng.next() * sum;
  for (let i = 0; i < ws.length; i++) if ((x -= ws[i]) < 0) return TIERS[i];
  return min;
}

/** The candidates at a tier, or at the best tier below it that has any (never below `floor`). */
function pickAt<T extends string>(rng: Rng, tier: Tier, floor: Tier, pool: T[], tierOf: (id: T) => Tier): { id: T; tier: Tier } | null {
  for (let i = tierIndex(tier); i >= tierIndex(floor); i--) {
    const at = pool.filter((id) => tierOf(id) === TIERS[i]);
    if (at.length) return { id: at[rng.int(at.length)], tier: TIERS[i] };
  }
  // nothing at or below: the lowest tier above that has some
  for (let i = tierIndex(tier) + 1; i < TIERS.length; i++) {
    const at = pool.filter((id) => tierOf(id) === TIERS[i]);
    if (at.length) return { id: at[rng.int(at.length)], tier: TIERS[i] };
  }
  return null;
}

/** Roll what a chest holds (and give it: new heroes join, duplicates and shards go toward stars). */
export function rollChest(rng: Rng, t: Tuning, p: Profile, kind: ChestKind): ChestPrize {
  const C = t.chests;
  // a plain hero chest sometimes holds shards for one you own instead
  const owned: Array<{ who: 'hero' | 'pet'; id: string }> = [...ownedHeroes(p).map((id) => ({ who: 'hero' as const, id })), ...ownedPets(p).map((id) => ({ who: 'pet' as const, id }))];
  if (kind === 'hero' && owned.length && rng.next() < C.shardChance) {
    const o = owned[rng.int(owned.length)];
    const n = C.shardsMin + rng.int(Math.max(1, C.shardsMax - C.shardsMin + 1));
    if (o.who === 'hero') {
      const id = o.id as HeroId;
      return { kind: 'heroShards', id, tier: HEROES[id].rarity, shards: n, starsUp: addShards(t, p.heroes[id], n) };
    }
    const id = o.id as CompanionId;
    return { kind: 'petShards', id, tier: COMPANIONS[id].rarity, shards: n, starsUp: addShards(t, p.pets[id], n) };
  }
  // the tier (the shrine's pity can force the top ones)
  let min: Tier = 'common';
  if (kind === 'rare') {
    if (p.pity.top + 1 >= C.topPity) min = 'celestial';
    else if (p.pity.rare + 1 >= C.pity) min = 'legendary';
  }
  const tier = rollTier(rng, chestWeights(t, kind, p.pity.rare), min);
  const hero = rng.next() < C.heroShare;
  let prize: ChestPrize | null = null;
  if (hero) {
    // heroes come at Rare or better
    const h = pickAt(rng, tierIndex(tier) < tierIndex('rare') ? 'rare' : tier, 'rare', CHEST_HEROES, (id) => HEROES[id].rarity);
    if (h) {
      const g = grantHero(p, t, h.id);
      prize = { kind: 'hero', id: h.id, tier: h.tier, ...g };
    }
  }
  if (!prize) {
    const c = pickAt(rng, tier, 'common', COMPANION_IDS, (id) => COMPANIONS[id].rarity)!;
    const g = grantPet(p, t, c.id);
    prize = { kind: 'pet', id: c.id, tier: c.tier, ...g };
  }
  if (kind === 'rare') {
    const got = tierIndex(prize.tier);
    // pity counts what the roll was allowed: a forced top tier with nothing in it yet still resets its counter
    p.pity.rare = got >= tierIndex('legendary') || min !== 'common' ? 0 : p.pity.rare + 1;
    p.pity.top = got >= tierIndex('celestial') || min === 'celestial' ? 0 : p.pity.top + 1;
  }
  return prize;
}

/** Open a waiting chest of `kind` (free). Null if there is none. */
export function openChest(rng: Rng, t: Tuning, p: Profile, kind: ChestKind): ChestPrize | null {
  if (p.chests[kind] <= 0) return null;
  p.chests[kind]--;
  p.counts.chests = (p.counts.chests ?? 0) + 1;
  return rollChest(rng, t, p, kind);
}

/** The shrine: buy a Rare chest with gems (it waits to be opened). */
export function buyRareChest(p: Profile, t: Tuning): boolean {
  const cost = Math.max(0, Math.round(t.chests.rareCost));
  if (p.gems < cost) return false;
  p.gems -= cost;
  p.chests.rare++;
  return true;
}

/** Whether the chest's hero or companion is one you own (for the reveal: "New!" or "+10 shards"). */
export const prizeOwned = (p: Profile, prize: ChestPrize): boolean =>
  prize.kind === 'hero' || prize.kind === 'heroShards' ? heroOwned(p, prize.id as HeroId) : petOwned(p, prize.id as CompanionId);
