// Side quests (plain data, no logic): a bounty board on the act map posts one goal for the rest of the act, and
// what finishing it pays. src/core/quests.ts tracks the goal from the fights (core/combat.ts FightLog) and pays out;
// the numbers (how many reds, what combo...) and the coins are tuning.quests. The map shows only the goal's icon and
// its progress ("12/25"), so the words here are short: the notice's heading and one line ('{n}' shows the number).

export type QuestId = 'blocks' | 'combo' | 'elite' | 'healthy' | 'flawless' | 'kills';
export type QuestReward = 'relic' | 'gear' | 'coins';

export interface QuestDef {
  id: QuestId;
  title: string; // the notice's heading
  text: string; // the goal, one short line
  icon: string; // a HUD icon (engine/view/pixels.ts hudIcon)
  reward: QuestReward;
  /** How progress counts: 'sum' adds up over the act's fights, 'best' is the best single fight, 'once' is 0 or 1. */
  count: 'sum' | 'best' | 'once';
}

export const QUESTS: readonly QuestDef[] = [
  { id: 'blocks', title: 'Hold the Line', text: 'Block {n} reds', icon: 'shield', reward: 'gear', count: 'sum' },
  { id: 'combo', title: 'Keep the Beat', text: 'Reach a {n} combo', icon: 'bolt', reward: 'relic', count: 'best' },
  { id: 'elite', title: 'Wanted!', text: 'Beat an elite', icon: 'skull', reward: 'gear', count: 'once' },
  { id: 'healthy', title: 'Not a Scratch', text: 'Win a fight above {n}% HP', icon: 'heart', reward: 'coins', count: 'once' },
  { id: 'flawless', title: 'Clean Sweep', text: 'Clear {n} waves, no misses', icon: 'star', reward: 'relic', count: 'sum' },
  { id: 'kills', title: 'Pest Control', text: 'Defeat {n} foes', icon: 'foe', reward: 'coins', count: 'sum' },
];

export const QUEST_IDS: readonly QuestId[] = QUESTS.map((q) => q.id);
export const questById = (id: string): QuestDef | undefined => QUESTS.find((q) => q.id === id);
export const isQuestId = (v: unknown): v is QuestId => typeof v === 'string' && (QUEST_IDS as readonly string[]).includes(v);
