// The eight rarity tiers (plain data, no logic), shared by gear, heroes and companions. Each tier above Mythic adds
// something new rather than bigger numbers: Celestial gear carries a second unique effect, Divine gear two effects and
// an aura (a fight-wide rule); Celestial and Divine heroes and companions get an extra kit part. Celestial and Divine
// are a post-story chase: tiny drop odds in Regions 1-3 (tuning.gear) and the shrine's top pity tier only.

export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'celestial' | 'divine';
export const TIERS: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial', 'divine'];

export interface TierInfo {
  name: string;
  /** Gear: bonus stats rolled. */
  bonus: number;
  /** Gear: unique effects carried (Legendary and Mythic 1, Celestial and Divine 2). */
  effects: number;
  /** Gear: carries an aura (Divine). */
  aura: boolean;
  /** Frame colours [hi, base, lo, deep]. */
  face: readonly [number, number, number, number];
  /** How the frame sparkles: Celestial with star twinkles, Divine with a prismatic sheen. */
  sparkle: 'none' | 'stars' | 'prism';
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  common: { name: 'Common', bonus: 0, effects: 0, aura: false, face: [0xd0d4e0, 0x9aa0b4, 0x6e7488, 0x464a5c], sparkle: 'none' },
  uncommon: { name: 'Uncommon', bonus: 1, effects: 0, aura: false, face: [0xb4f070, 0x5ad848, 0x3aaa34, 0x1e6a24], sparkle: 'none' },
  rare: { name: 'Rare', bonus: 2, effects: 0, aura: false, face: [0x9ad8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a], sparkle: 'none' },
  epic: { name: 'Epic', bonus: 3, effects: 0, aura: false, face: [0xe8b8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a], sparkle: 'none' },
  legendary: { name: 'Legendary', bonus: 3, effects: 1, aura: false, face: [0xffe0a0, 0xffa030, 0xd86a14, 0x8a3a0a], sparkle: 'none' },
  mythic: { name: 'Mythic', bonus: 4, effects: 1, aura: false, face: [0xffb0a0, 0xf03c3c, 0xb81e2a, 0x6a0a18], sparkle: 'none' },
  celestial: { name: 'Celestial', bonus: 4, effects: 2, aura: false, face: [0xf0ffff, 0xa8eef8, 0x6cc4dc, 0x2e7090], sparkle: 'stars' },
  divine: { name: 'Divine', bonus: 5, effects: 2, aura: true, face: [0xfffbe0, 0xffe070, 0xe0a828, 0x8a5a10], sparkle: 'prism' },
};

export const tierIndex = (t: Tier): number => TIERS.indexOf(t);
export const isTier = (v: unknown): v is Tier => typeof v === 'string' && TIERS.includes(v as Tier);
/** Whether `a` is at least as rare as `b`. */
export const tierAtLeast = (a: Tier, b: Tier): boolean => tierIndex(a) >= tierIndex(b);
