// Shared progression (pure): gems (earned only by playing), achievements (they pay gems), each hero's mastery
// milestones (they unlock things for everyone: relics in the pool, set pieces, camp upgrades, cosmetics) and the camp
// upgrades (bought with coins; they add options more than numbers). Most power is shared across heroes: gear, relics
// and camp upgrades. Content: src/data/meta.ts; numbers: tuning.gems.

import { HERO_IDS } from '../data/heroes';
import { ACHIEVEMENTS, CAMP_UPGRADES, MASTERY, type AchievementDef, type AchievementId, type CampUpgradeId, type MasteryDef } from '../data/meta';
import { BASE_BY_ID } from '../data/gear';
import { relicById } from '../data/relics';
import { makeItem } from './gear';
import { levelFromXp } from './heroes';
import { addItem, unlockRelic, type Profile } from './profile';
import { ownedHeroes, ownedPets } from './roster';
import { Rng } from './rng';
import type { Tuning } from './tuning';

/** Gems in (counted for the balance report). Returns the amount. */
export function awardGems(p: Profile, n: number): number {
  const g = Math.max(0, Math.round(n));
  p.gems += g;
  p.counts.gemsEarned = (p.counts.gemsEarned ?? 0) + g;
  return g;
}

export const bump = (p: Profile, key: string, n = 1): number => (p.counts[key] = (p.counts[key] ?? 0) + n);

// ---------------------------------------------------------------- achievements

/** What a fight just did (the run passes it in when a fight is won). */
export interface FeatCtx {
  combo?: number;
  finisherStacks?: number;
  bossNoHit?: boolean;
  relics?: number;
  legendary?: boolean;
}

function met(p: Profile, t: Tuning, id: AchievementId, x: FeatCtx): boolean {
  const c = p.counts;
  switch (id) {
    case 'combo50':
      return (c.bestCombo ?? 0) >= 50 || (x.combo ?? 0) >= 50;
    case 'combo100':
      return (c.bestCombo ?? 0) >= 100 || (x.combo ?? 0) >= 100;
    case 'finisher5':
      return (c.bestFinisher ?? 0) >= 5 || (x.finisherStacks ?? 0) >= 5;
    case 'noHitBoss':
      return !!x.bossNoHit || (c.noHitBoss ?? 0) > 0;
    case 'heroes3':
      return ownedHeroes(p).length >= 3;
    case 'heroes6':
      return ownedHeroes(p).length >= 6;
    case 'heroes8':
      return ownedHeroes(p).length >= 8;
    case 'pets3':
      return ownedPets(p).length >= 3;
    case 'pets6':
      return ownedPets(p).length >= 6;
    case 'stars3':
      return HERO_IDS.some((h) => p.heroes[h].stars >= 3);
    case 'level10':
      return HERO_IDS.some((h) => levelFromXp(t, p.heroes[h].xp) >= 10);
    case 'relics20':
      return (x.relics ?? 0) >= 20 || (c.mostRelics ?? 0) >= 20;
    case 'legendary':
      return !!x.legendary || p.items.some((i) => ['legendary', 'mythic', 'celestial', 'divine'].includes(i.rarity));
    case 'bounties5':
      return (c.bounties ?? 0) >= 5;
    case 'treasures3':
      return (c.treasures ?? 0) >= 3;
    case 'holds50':
      return (c.holds ?? 0) >= 50;
    case 'region1':
      return p.weights >= 1;
    case 'region2':
      return p.weights >= 2;
  }
}

/** Achievements newly earned (their gems are paid). The debug unlock-all toggle never earns any. */
export function checkAchievements(p: Profile, t: Tuning, x: FeatCtx = {}): AchievementDef[] {
  if (x.combo) p.counts.bestCombo = Math.max(p.counts.bestCombo ?? 0, x.combo);
  if (x.finisherStacks) p.counts.bestFinisher = Math.max(p.counts.bestFinisher ?? 0, x.finisherStacks);
  if (x.relics) p.counts.mostRelics = Math.max(p.counts.mostRelics ?? 0, x.relics);
  if (x.bossNoHit) bump(p, 'noHitBoss');
  if (p.allUnlocked) return [];
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id) || !met(p, t, a.id, x)) continue;
    p.achievements.push(a.id);
    awardGems(p, a.gems);
    out.push(a);
  }
  return out;
}

// ---------------------------------------------------------------- mastery

function reached(p: Profile, t: Tuning, m: MasteryDef): boolean {
  const h = p.heroes[m.hero];
  if (!h?.unlocked) return false;
  if ('level' in m.goal) return levelFromXp(t, h.xp) >= m.goal.level;
  if ('acts' in m.goal) return h.acts >= m.goal.acts;
  return (p.counts[`boss:${m.hero}`] ?? 0) > 0;
}

/** Mastery milestones newly reached: their rewards are given to everyone (relic unlocked, camp upgrade buyable, set
 *  piece in the bag, cosmetic, gems). */
export function checkMastery(p: Profile, t: Tuning): MasteryDef[] {
  const out: MasteryDef[] = [];
  for (const m of MASTERY) {
    if (p.mastery.includes(m.id) || !reached(p, t, m)) continue;
    p.mastery.push(m.id);
    const r = m.reward;
    if (r.kind === 'relic' && relicById(r.relic)) unlockRelic(p, r.relic);
    else if (r.kind === 'setPiece' && BASE_BY_ID[r.base]) {
      const rng = new Rng((p.found + 7) * 2654435761);
      addItem(p, t, makeItem(rng, BASE_BY_ID[r.base], 'rare', Math.max(1, levelFromXp(t, p.heroes[m.hero].xp) * 2)));
    } else if (r.kind === 'cosmetic' && !p.cosmetics.includes(r.id)) p.cosmetics.push(r.id);
    else if (r.kind === 'gems') awardGems(p, r.n);
    out.push(m);
  }
  return out;
}

/** A hero's milestones with whether each is reached (the hero select's mastery list). */
export const masteryOf = (p: Profile, hero: string): Array<{ def: MasteryDef; done: boolean }> =>
  MASTERY.filter((m) => m.hero === hero).map((def) => ({ def, done: p.mastery.includes(def.id) }));

// ---------------------------------------------------------------- the camp's upgrades

/** Camp upgrades that can be bought: their act requirement met, or granted by a hero's mastery. */
export function campAvailable(p: Profile): CampUpgradeId[] {
  const granted = new Set(MASTERY.filter((m) => p.mastery.includes(m.id) && m.reward.kind === 'camp').map((m) => (m.reward as { upgrade: CampUpgradeId }).upgrade));
  return (Object.keys(CAMP_UPGRADES) as CampUpgradeId[]).filter((id) => {
    const u = CAMP_UPGRADES[id];
    return granted.has(id) || (u.acts !== undefined && p.actsCleared >= u.acts);
  });
}

/** Buy a camp upgrade (coins). */
export function buyCamp(p: Profile, id: CampUpgradeId): boolean {
  const u = CAMP_UPGRADES[id];
  if (!u || p.camp.includes(id) || !campAvailable(p).includes(id) || p.coins < u.cost) return false;
  p.coins -= u.cost;
  p.camp.push(id);
  return true;
}

export const hasCamp = (p: Profile, id: CampUpgradeId): boolean => p.camp.includes(id);
