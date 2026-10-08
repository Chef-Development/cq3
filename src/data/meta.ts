// The shared progression's content (plain data, no logic): camp upgrades (they add options more than numbers), each
// hero's mastery milestones (they unlock things for everyone: relics in the pool, set pieces, camp upgrades,
// cosmetics), and achievements (they pay gems). core/meta.ts checks and grants them. Gems are earned only by playing.

import type { HeroId } from './heroes';
import type { RelicId } from './relics';

export type CampUpgradeId = 'perch' | 'luckyStone' | 'warTable' | 'rerollCharm' | 'dummy' | 'mapTable';
export const CAMP_UPGRADE_IDS: CampUpgradeId[] = ['perch', 'luckyStone', 'warTable', 'rerollCharm', 'dummy', 'mapTable'];

export interface CampUpgradeDef {
  id: CampUpgradeId;
  name: string;
  text: string; // what it adds, one short line
  cost: number; // coins
  /** Available to buy once: the first act cleared count reaches this, or a hero's mastery milestone grants it. */
  acts?: number;
}

export const CAMP_UPGRADES: Record<CampUpgradeId, CampUpgradeDef> = {
  perch: { id: 'perch', name: 'Companion Perch', text: 'Bring a second companion into fights.', cost: 600, acts: 3 },
  luckyStone: { id: 'luckyStone', name: 'Lucky Stone', text: 'Once an act, a relic pick shows 4 cards.', cost: 450 },
  warTable: { id: 'warTable', name: 'War Table', text: 'Each new run starts with a free relic pick.', cost: 500 },
  rerollCharm: { id: 'rerollCharm', name: 'Reroll Charm', text: 'One free reroll of a relic pick each act.', cost: 450 },
  dummy: { id: 'dummy', name: 'Training Dummy', text: 'Practice with any hero at camp, no risk.', cost: 250, acts: 1 },
  mapTable: { id: 'mapTable', name: 'Map Table', text: 'Each act map shows its hidden treasure.', cost: 350 },
};

/** What a mastery milestone unlocks for everyone. */
export type MasteryReward =
  | { kind: 'relic'; relic: RelicId }
  | { kind: 'camp'; upgrade: CampUpgradeId }
  | { kind: 'setPiece'; base: string }
  | { kind: 'cosmetic'; id: string; name: string }
  | { kind: 'gems'; n: number };

export interface MasteryDef {
  id: string;
  hero: HeroId;
  /** Reach this level with the hero, or clear this many acts with them, or beat a region's boss with them. */
  goal: { level: number } | { acts: number } | { boss: true };
  text: string; // the goal, short ("Reach level 5")
  reward: MasteryReward;
  rewardText: string; // what everyone gets, short
}

const lv = (hero: HeroId, level: number, reward: MasteryReward, rewardText: string): MasteryDef => ({ id: `${hero}Lv${level}`, hero, goal: { level }, text: `Reach level ${level}`, reward, rewardText });
const acts = (hero: HeroId, n: number, reward: MasteryReward, rewardText: string): MasteryDef => ({ id: `${hero}Acts${n}`, hero, goal: { acts: n }, text: `Clear ${n} acts`, reward, rewardText });
const boss = (hero: HeroId, reward: MasteryReward, rewardText: string): MasteryDef => ({ id: `${hero}Boss`, hero, goal: { boss: true }, text: "Beat a region's boss", reward, rewardText });

/** Four milestones per hero. Relics they unlock join everyone's pool; camp upgrades become buyable; set pieces go in the bag. */
export const MASTERY: MasteryDef[] = [
  lv('rowan', 5, { kind: 'relic', relic: 'skateBlades' }, 'Relic: Skate Blades'),
  acts('rowan', 3, { kind: 'camp', upgrade: 'warTable' }, 'Camp: War Table'),
  lv('rowan', 10, { kind: 'setPiece', base: 'rimeHood' }, 'Set piece: Rimewalker Hood'),
  boss('rowan', { kind: 'cosmetic', id: 'bannerRowan', name: "Rowan's banner" }, 'A banner for the camp'),
  lv('sable', 5, { kind: 'relic', relic: 'tether' }, 'Relic: Tether'),
  acts('sable', 3, { kind: 'camp', upgrade: 'luckyStone' }, 'Camp: Lucky Stone'),
  lv('sable', 10, { kind: 'setPiece', base: 'rimeCoat' }, 'Set piece: Rimewalker Coat'),
  boss('sable', { kind: 'cosmetic', id: 'bannerSable', name: "Sable's banner" }, 'A banner for the camp'),
  lv('neve', 5, { kind: 'relic', relic: 'glacierHeart' }, 'Relic: Glacier Heart'),
  acts('neve', 3, { kind: 'camp', upgrade: 'mapTable' }, 'Camp: Map Table'),
  lv('neve', 10, { kind: 'setPiece', base: 'rimeBoots' }, 'Set piece: Rimewalker Boots'),
  boss('neve', { kind: 'cosmetic', id: 'bannerNeve', name: "Neve's banner" }, 'A banner for the camp'),
  lv('moss', 5, { kind: 'relic', relic: 'hotCocoa' }, 'Relic: Hot Cocoa'),
  acts('moss', 3, { kind: 'camp', upgrade: 'perch' }, 'Camp: Companion Perch'),
  lv('moss', 10, { kind: 'setPiece', base: 'rimeLocket' }, 'Set piece: Snowflake Locket'),
  boss('moss', { kind: 'cosmetic', id: 'bannerMoss', name: "Moss's banner" }, 'A banner for the camp'),
  lv('tam', 5, { kind: 'relic', relic: 'snowplow' }, 'Relic: Snowplow'),
  acts('tam', 3, { kind: 'camp', upgrade: 'rerollCharm' }, 'Camp: Reroll Charm'),
  lv('tam', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('tam', { kind: 'cosmetic', id: 'bannerTam', name: "Tam's banner" }, 'A banner for the camp'),
  lv('hollis', 5, { kind: 'relic', relic: 'holdFast' }, 'Relic: Hold Fast'),
  acts('hollis', 3, { kind: 'camp', upgrade: 'dummy' }, 'Camp: Training Dummy'),
  lv('hollis', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('hollis', { kind: 'cosmetic', id: 'bannerHollis', name: "Hollis's banner" }, 'A banner for the camp'),
  lv('vesper', 5, { kind: 'relic', relic: 'longNote' }, 'Relic: Long Note'),
  acts('vesper', 3, { kind: 'gems', n: 30 }, '30 gems'),
  lv('vesper', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('vesper', { kind: 'cosmetic', id: 'bannerVesper', name: "Vesper's banner" }, 'A banner for the camp'),
  lv('torva', 5, { kind: 'relic', relic: 'icebreaker' }, 'Relic: Icebreaker'),
  acts('torva', 3, { kind: 'gems', n: 30 }, '30 gems'),
  lv('torva', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('torva', { kind: 'cosmetic', id: 'bannerTorva', name: "Torva's banner" }, 'A banner for the camp'),
  // part6:A
  // part6:B
  // part6:C
  lv('gorm', 5, { kind: 'relic', relic: 'echoStrike' }, 'Relic: Echo Strike'),
  acts('gorm', 3, { kind: 'gems', n: 30 }, '30 gems'),
  lv('gorm', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('gorm', { kind: 'cosmetic', id: 'bannerGorm', name: "Gorm's banner" }, 'A banner for the camp'),
  lv('tess', 5, { kind: 'relic', relic: 'crampons' }, 'Relic: Crampons'),
  acts('tess', 3, { kind: 'gems', n: 30 }, '30 gems'),
  lv('tess', 10, { kind: 'gems', n: 40 }, '40 gems'),
  boss('tess', { kind: 'cosmetic', id: 'bannerTess', name: "Tess's banner" }, 'A banner for the camp'),
  // part6:D
];

export type AchievementId =
  | 'combo50'
  | 'combo100'
  | 'finisher5'
  | 'noHitBoss'
  | 'heroes3'
  | 'heroes6'
  | 'heroes8'
  | 'pets3'
  | 'pets6'
  | 'stars3'
  | 'level10'
  | 'relics20'
  | 'legendary'
  | 'bounties5'
  | 'treasures3'
  | 'holds50'
  | 'region1'
  | 'region2';

export interface AchievementDef {
  id: AchievementId;
  name: string;
  text: string;
  gems: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'combo50', name: 'On a Roll', text: 'Reach a 50 combo.', gems: 15 },
  { id: 'combo100', name: 'Unstoppable', text: 'Reach a 100 combo.', gems: 25 },
  { id: 'finisher5', name: 'Full Swing', text: 'Land a 5-stack finisher.', gems: 15 },
  { id: 'noHitBoss', name: 'Untouched', text: 'Beat a boss without taking a hit.', gems: 30 },
  { id: 'heroes3', name: 'A Little Band', text: 'Have 3 heroes.', gems: 15 },
  { id: 'heroes6', name: 'A Proper Party', text: 'Have 6 heroes.', gems: 25 },
  { id: 'heroes8', name: 'Everyone Came', text: 'Have all 8 heroes.', gems: 40 },
  { id: 'pets3', name: 'Pet Friends', text: 'Have 3 companions.', gems: 15 },
  { id: 'pets6', name: 'A Small Zoo', text: 'Have 6 companions.', gems: 30 },
  { id: 'stars3', name: 'Rising Star', text: 'Raise a hero to 3 stars.', gems: 20 },
  { id: 'level10', name: 'Seasoned', text: 'Reach level 10 with any hero.', gems: 15 },
  { id: 'relics20', name: 'Pack Rat', text: 'Carry 20 relics at once.', gems: 15 },
  { id: 'legendary', name: 'Shiny!', text: 'Find a Legendary item.', gems: 15 },
  { id: 'bounties5', name: 'Bounty Hunter', text: 'Finish 5 bounties.', gems: 15 },
  { id: 'treasures3', name: 'Treasure Nose', text: 'Find 3 hidden treasures.', gems: 15 },
  { id: 'holds50', name: 'Steady Hands', text: 'Finish 50 holds.', gems: 15 },
  { id: 'region1', name: 'One Down', text: 'Bring the first weight home.', gems: 30 },
  { id: 'region2', name: 'Two Ticks', text: 'Bring the second weight home.', gems: 40 },
];
