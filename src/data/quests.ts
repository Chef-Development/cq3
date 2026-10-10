// Side quests (plain data, no logic): a bounty board on the act map posts one goal for the rest of the act, and
// what finishing it pays. src/core/quests.ts tracks the goal from the fights (core/combat.ts FightLog) and pays out;
// the numbers (how many reds, what combo...) and the coins are tuning.quests. The map shows only the goal's icon and
// its progress ("12/25"), so the words here are short: the notice's heading and one line ('{n}' shows the number).

import type { StyleId } from './heroes';

export type QuestId =
  | 'blocks'
  | 'combo'
  | 'elite'
  | 'healthy'
  | 'flawless'
  | 'kills'
  // the style calls: win fights with a hero of one style (a board posts one only once you own 2+ heroes)
  | 'asBlade'
  | 'asShadow'
  | 'asGuardian'
  | 'asMarksman'
  | 'asBrute'
  | 'asController'
  | 'asSummoner'
  | 'asBomber';
export type QuestReward = 'relic' | 'gear' | 'coins';

export interface QuestDef {
  id: QuestId;
  title: string; // the notice's heading
  text: string; // the goal, one short line
  icon: string; // a HUD icon (engine/view/pixels.ts hudIcon)
  reward: QuestReward;
  /** How progress counts: 'sum' adds up over the act's fights, 'best' is the best single fight, 'once' is 0 or 1. */
  count: 'sum' | 'best' | 'once';
  /** A style call: only fights won with a hero of this style count. */
  style?: StyleId;
}

const call = (id: QuestId, style: StyleId, title: string, name: string): QuestDef => ({ id, title, text: `Win {n} fights as a ${name} hero`, icon: 'star', reward: 'relic', count: 'sum', style });

export const QUESTS: readonly QuestDef[] = [
  { id: 'blocks', title: 'Hold the Line', text: 'Block {n} reds', icon: 'shield', reward: 'gear', count: 'sum' },
  { id: 'combo', title: 'Keep the Beat', text: 'Reach a {n} combo', icon: 'bolt', reward: 'relic', count: 'best' },
  { id: 'elite', title: 'Wanted!', text: 'Beat an elite', icon: 'skull', reward: 'gear', count: 'once' },
  { id: 'healthy', title: 'Not a Scratch', text: 'Win a fight above {n}% HP', icon: 'heart', reward: 'coins', count: 'once' },
  { id: 'flawless', title: 'Clean Sweep', text: 'Clear {n} waves, no misses', icon: 'star', reward: 'relic', count: 'sum' },
  { id: 'kills', title: 'Pest Control', text: 'Beat {n} foes', icon: 'foe', reward: 'coins', count: 'sum' },
  call('asBlade', 'blade', 'Edge Work', 'Blade'),
  call('asShadow', 'shadow', 'Shadow Work', 'Shadow'),
  call('asGuardian', 'guardian', 'Shield Oath', 'Guardian'),
  call('asMarksman', 'marksman', 'Steady Aim', 'Marksman'),
  call('asBrute', 'brute', 'Heavy Hands', 'Brute'),
  call('asController', 'controller', 'Bend the Bar', 'Controller'),
  call('asSummoner', 'summoner', 'Call the Wild', 'Summoner'),
  call('asBomber', 'bomber', 'Powder Keg', 'Bomber'),
];

/** The style call for each style. */
export const STYLE_QUEST: Record<StyleId, QuestId> = Object.fromEntries(QUESTS.filter((q) => q.style).map((q) => [q.style, q.id])) as Record<StyleId, QuestId>;

export const QUEST_IDS: readonly QuestId[] = QUESTS.map((q) => q.id);

/**
 * A region's story bounty: when a board in that region (a RegionDef id) posts `quest`, its notice carries who posted it
 * and why (`frame`), and meeting it shows what came of it (`payoff`), one line each. The bounty itself is unchanged.
 */
export interface QuestStory {
  region: string;
  quest: QuestId;
  frame: string;
  payoff: string;
}

export const QUEST_STORIES: readonly QuestStory[] = [
  { region: 'greenmarch', quest: 'kills', frame: 'Pinned up by the miller, before he slept.', payoff: 'The road is clear for when the miller wakes.' },
  { region: 'frostpeaks', quest: 'blocks', frame: 'From the snow-wall crews: hold the pass.', payoff: 'The pass held. The crews will build again.' },
  { region: 'ashfell', quest: 'healthy', frame: 'A forge-mother asks: come back whole.', payoff: 'She keeps her word: coin, and a hot meal.' },
  { region: 'duskmire', quest: 'elite', frame: "Something big took the fen's night boat.", payoff: "The night boat's crew can sleep again." },
  // ready for when Noonspire joins REGIONS
  { region: 'noonspire', quest: 'combo', frame: "The Order's drummer: keep time for us.", payoff: 'For a moment, the spire has a rhythm again.' },
];

/** The story a region's board gives this bounty, if any. */
export const questStory = (region: string, quest: string | null | undefined): QuestStory | undefined =>
  QUEST_STORIES.find((s) => s.region === region && s.quest === quest);
export const questById = (id: string): QuestDef | undefined => QUESTS.find((q) => q.id === id);
export const isQuestId = (v: unknown): v is QuestId => typeof v === 'string' && (QUEST_IDS as readonly string[]).includes(v);
