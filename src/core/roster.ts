// Heroes and companions you own (pure): ownership (with the debug "Unlock all heroes and companions" toggle),
// duplicates becoming shards, shards raising stars (1-5), companions' levels (from the XP your hero earns while they
// are equipped) and the companion slots (a second one with the Companion Perch). A fight reads the equipped
// companions as PetBuilds inside the hero's build (core/companion-fx.ts).

import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../data/companions';
import { HEROES, HERO_IDS, type HeroId } from '../data/heroes';
import type { Profile } from './profile';
import type { Tuning } from './tuning';
import { levelFromXp } from './heroes';

/** A companion as a fight reads it. */
export interface PetBuild {
  id: CompanionId;
  level: number;
  stars: number;
}

export const heroOwned = (p: Profile, id: HeroId): boolean => p.allUnlocked || !!p.heroes[id]?.unlocked;
export const petOwned = (p: Profile, id: CompanionId): boolean => p.allUnlocked || !!p.pets[id]?.owned;
export const ownedHeroes = (p: Profile): HeroId[] => HERO_IDS.filter((id) => heroOwned(p, id));
export const ownedPets = (p: Profile): CompanionId[] => COMPANION_IDS.filter((id) => petOwned(p, id));

/** Shards a hero or companion at `stars` needs for the next star (null at 5 stars). */
export function shardsToNext(t: Tuning, stars: number): number | null {
  if (stars >= 5) return null;
  return Math.max(1, Math.round(t.stars.need[Math.max(0, stars - 1)] ?? 999));
}

/** Add shards; every time enough are banked, a star (up to 5). Returns the stars gained. */
export function addShards(t: Tuning, prog: { stars: number; shards: number }, n: number): number {
  prog.shards += Math.max(0, Math.round(n));
  let up = 0;
  for (let need = shardsToNext(t, prog.stars); need !== null && prog.shards >= need; need = shardsToNext(t, prog.stars)) {
    prog.shards -= need;
    prog.stars++;
    up++;
  }
  if (prog.stars >= 5) prog.shards = 0;
  return up;
}

export interface Grant {
  fresh: boolean; // a new hero/companion (else a duplicate turned into shards)
  shards: number;
  starsUp: number;
}

/** A hero comes out of a chest: a new one joins; a duplicate becomes shards. */
export function grantHero(p: Profile, t: Tuning, id: HeroId): Grant {
  const h = p.heroes[id];
  if (!h.unlocked) {
    h.unlocked = true;
    return { fresh: true, shards: 0, starsUp: 0 };
  }
  const n = Math.round(t.chests.dupShards);
  return { fresh: false, shards: n, starsUp: addShards(t, h, n) };
}

/** A companion comes out of a chest: new, or shards. */
export function grantPet(p: Profile, t: Tuning, id: CompanionId): Grant {
  const x = p.pets[id];
  if (!x.owned) {
    x.owned = true;
    return { fresh: true, shards: 0, starsUp: 0 };
  }
  const n = Math.round(t.chests.dupShards);
  return { fresh: false, shards: n, starsUp: addShards(t, x, n) };
}

/** Companion slots: one, two with the Companion Perch. */
export const petSlots = (p: Profile): number => (p.camp.includes('perch') ? 2 : 1);

/** Put companion `id` in slot `slot` (it leaves any other slot); `null` empties the slot (never the last one). */
export function equipPet(p: Profile, slot: number, id: CompanionId | null): boolean {
  if (slot < 0 || slot >= petSlots(p)) return false;
  const on = p.petsOn.slice(0, petSlots(p));
  if (id === null) {
    if (on.length <= 1) return false;
    on.splice(slot, 1);
    p.petsOn = on;
    return true;
  }
  if (!petOwned(p, id)) return false;
  const without = on.filter((x) => x !== id);
  if (slot >= without.length) without.push(id);
  else without[slot] = id;
  p.petsOn = [...new Set(without)].slice(0, petSlots(p));
  return true;
}

/** A companion's level from its XP (the hero XP curve, capped at tuning.pets.maxLevel). */
export const petLevel = (t: Tuning, xp: number): number => Math.min(Math.max(1, Math.round(t.pets.maxLevel)), levelFromXp(t, xp));

/** The equipped companions earn the XP the hero earned with them along. */
export function addPetXp(p: Profile, xp: number): void {
  for (const id of p.petsOn) if (p.pets[id]) p.pets[id].xp = Math.max(0, Math.round(p.pets[id].xp + Math.max(0, xp)));
}

/** The companions a fight brings, as builds. */
export function petBuilds(p: Profile, t: Tuning): PetBuild[] {
  return p.petsOn.filter((id) => petOwned(p, id) && COMPANIONS[id]).slice(0, petSlots(p)).map((id) => ({ id, level: petLevel(t, p.pets[id].xp), stars: p.pets[id].stars }));
}

/** Debug: "Unlock all heroes and companions" (a toggle: turning it off puts things back as they were). */
export function setAllUnlocked(p: Profile, on: boolean): void {
  p.allUnlocked = on;
  if (!on) {
    if (!heroOwned(p, p.hero)) p.hero = 'rowan';
    p.petsOn = p.petsOn.filter((id) => petOwned(p, id));
    if (!p.petsOn.length) p.petsOn = ['pip'];
  }
}

/** The chest heroes not met yet whose arrival scene should play (once each). */
export const meetSceneFor = (p: Profile, id: HeroId): string | null => {
  const s = HEROES[id].meetScene;
  return s && !p.seen.includes(s) ? s : null;
};
