// Sparkles (pure; no DOM): now and then something glints on the act map or the kingdom's world map, and a tap on it
// pays a coin or two into the purse (view/map-life.ts and view/world-life.ts draw it and take the tap). Tiny, and
// not farmable:
//   - at most one per act-map step, never on an act's first step (a fresh run can't fish for one), and at most one
//     per visit to the world map, where a visit is new only once you've played since (found gear, earned XP,
//     cleared an act; coming back from a reload or the title is the same visit);
//   - whether there is one, where (a 0..1 pick the view maps onto its open spots), when it starts to glint and what
//     it pays all come from a hash of its key, so a reload shows the same one;
//   - a claimed key is kept in the profile (the last `life.keep`), so a reload or a retry never pays it twice.
// The numbers are `tuning.life`.

import type { Profile } from './profile';
import type { Tuning } from './tuning';

export type LifeTuning = Tuning['life'];

/** The most claimed keys a profile keeps (the slider's top). */
export const MAX_KEPT = 64;

export interface Sparkle {
  key: number;
  /** Where (0..1): the view picks one of its open spots by this. */
  spot: number;
  /** ms after the screen comes up before it starts to glint. */
  delayMs: number;
  /** What it pays. */
  coins: number;
}

/** A 32-bit integer hash (avalanching: neighbouring inputs land far apart). */
function mix32(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A 0..1 roll of a key (a different one per salt). */
const roll = (key: number, salt: number): number => mix32((key ^ Math.imul(salt, 0x9e3779b9)) >>> 0) / 4294967296;

/** An act map step's key: its map (the act's map seed) and how many nodes Rowan has walked on it. */
export function mapSparkleKey(mapSeed: number, step: number): number {
  return mix32((Math.imul(mapSeed >>> 0, 0x27d4eb2d) ^ Math.imul(step + 1, 0x165667b1) ^ 0x5a1e) >>> 0);
}

/** A world map visit's key: what you've done so far (it only changes by playing). */
export function worldSparkleKey(p: Pick<Profile, 'found' | 'actsCleared' | 'weights' | 'heroes'>): number {
  const xp = Object.values(p.heroes).reduce((a, h) => a + Math.round(h?.xp ?? 0), 0);
  let h = mix32((p.found >>> 0) ^ 0x3c6ef372);
  h = mix32((h ^ Math.imul(p.actsCleared + 1, 0x85ebca6b) ^ Math.imul(p.weights + 1, 0xc2b2ae35)) >>> 0);
  return mix32((h ^ (xp >>> 0) ^ 0xb5297a4d) >>> 0);
}

/** The sparkle a key holds (null: none, `chance` of the time). */
export function rollSparkle(key: number, chance: number, t: LifeTuning): Sparkle | null {
  if (roll(key, 1) >= chance) return null;
  const lo = Math.max(0, Math.round(Math.min(t.coinsMin, t.coinsMax)));
  const hi = Math.max(0, Math.round(Math.max(t.coinsMin, t.coinsMax)));
  const d0 = Math.max(0, Math.min(t.delayMin, t.delayMax));
  const d1 = Math.max(0, t.delayMin, t.delayMax);
  return {
    key,
    spot: roll(key, 2),
    delayMs: Math.round((d0 + roll(key, 3) * (d1 - d0)) * 1000),
    coins: lo + Math.min(hi - lo, Math.floor(roll(key, 4) * (hi - lo + 1))),
  };
}

/** The sparkle on an act map at this step, if there is one (never at the act's start). */
export function mapSparkle(mapSeed: number, step: number, t: LifeTuning): Sparkle | null {
  if (step < 1) return null;
  return rollSparkle(mapSparkleKey(mapSeed, step), t.mapChance, t);
}

/** The sparkle on the world map this visit, if there is one. */
export function worldSparkle(p: Pick<Profile, 'found' | 'actsCleared' | 'weights' | 'heroes'>, t: LifeTuning): Sparkle | null {
  return rollSparkle(worldSparkleKey(p), t.worldChance, t);
}

/** Whether this sparkle was picked up already. */
export const sparkleClaimed = (p: Pick<Profile, 'sparkles'>, key: number): boolean => p.sparkles.includes(key);

/** A sparkle still there to pick up (null: none, or claimed already). */
export const openSparkle = (p: Pick<Profile, 'sparkles'>, s: Sparkle | null): Sparkle | null => (s && !sparkleClaimed(p, s.key) ? s : null);

/**
 * Pick it up: its coins go in the purse and its key is remembered (the last `keep`). Returns the coins paid: 0 when it
 * was picked up already. The caller saves the profile.
 */
export function claimSparkle(p: Pick<Profile, 'coins' | 'sparkles'>, s: Sparkle, t: LifeTuning): number {
  if (sparkleClaimed(p, s.key)) return 0;
  p.coins = Math.max(0, Math.round(p.coins + s.coins));
  const keep = Math.max(1, Math.min(MAX_KEPT, Math.round(t.keep)));
  p.sparkles = [...p.sparkles, s.key].slice(-keep);
  return s.coins;
}

/** The claimed keys as saved (32-bit integers only, the newest kept); missing reads as none. */
export function readSparkles(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((k): k is number => typeof k === 'number' && Number.isInteger(k) && k >= 0 && k <= 0xffffffff).slice(-MAX_KEPT);
}
