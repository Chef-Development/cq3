// Side quests (pure; no DOM): a bounty board on the act map posts one goal for the rest of the act (src/data/quests.ts
// has the goals). Taking it puts a tiny tracker on the map (its icon and "12/25"). Progress comes from the fights won
// (Combat.log: reds blocked, the best combo, clean waves, kills; whether it was an elite, the HP left), counted when
// the fight is won (a Coin Rush doesn't count). When the goal is met the run pays the reward (core/run.ts): a relic
// pick, an item, or coins. A defeat restarts the act, quest and all. A style call counts wins with a hero of one
// style (heroes can be switched at camp mid-act).

import { QUESTS, STYLE_QUEST, questById, type QuestDef, type QuestId } from '../data/quests';
import type { StyleId } from '../data/heroes';
import type { FightLog } from './combat';
import { fillN } from './format';
import type { ActMap } from './map';
import { Rng } from './rng';
import type { Tuning } from './tuning';

export interface QuestState {
  id: QuestId;
  n: number; // progress so far
  goal: number;
  done: boolean; // met (and paid)
}

/** What it takes: the goal's count (tuning.quests). */
export function questGoal(t: Tuning, id: QuestId): number {
  const Q = t.quests;
  switch (id) {
    case 'blocks':
      return Math.max(1, Math.round(Q.blocks));
    case 'combo':
      return Math.max(1, Math.round(Q.combo));
    case 'flawless':
      return Math.max(1, Math.round(Q.flawless));
    case 'kills':
      return Math.max(1, Math.round(Q.kills));
    case 'elite':
    case 'healthy':
      return 1;
    default:
      return Math.max(1, Math.round(Q.styleWins)); // a style call
  }
}

/** The goal in words, its number filled in ("Block 25 reds", "Win a fight above 80% HP"). */
export function questText(t: Tuning, def: QuestDef): string {
  const n = def.id === 'healthy' ? t.quests.healthy * 100 : questGoal(t, def.id);
  return fillN(def.text, n);
}

export function newQuest(t: Tuning, id: QuestId): QuestState {
  return { id, n: 0, goal: questGoal(t, id), done: false };
}

/** Whether an elite can still be reached from `node` (its descendants). */
function eliteAhead(map: ActMap, node: number): boolean {
  const seen = new Set<number>();
  const stack = [...(map.nodes[node]?.next ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (map.nodes[id].type === 'elite') return true;
    stack.push(...map.nodes[id].next);
  }
  return false;
}

/**
 * The quest a board on `node` posts (seeded by the map and the node): one that can still be done from there. With
 * `styles` (the styles of the heroes you own, when you own 2 or more) it sometimes calls for one of them instead
 * (`styleShare` of the time): a reason to switch heroes at camp.
 */
export function questFor(map: ActMap, node: number, seed: number, styles: readonly StyleId[] = [], styleShare = 0): QuestId {
  const rng = new Rng((seed ^ Math.imul(node + 7, 0x2c1b3c6d)) >>> 0);
  const ok = QUESTS.filter((q) => !q.style && (q.id !== 'elite' || eliteAhead(map, node)));
  const pick = ok[rng.int(ok.length)].id;
  if (!styles.length) return pick;
  return rng.next() < styleShare ? STYLE_QUEST[styles[rng.int(styles.length)]] : pick;
}

/** A won fight, as a quest sees it. */
export interface FightDone {
  log: FightLog;
  elite: boolean; // an elite node's fight
  hpShare: number; // the hero's HP left, as a share of max
  style?: StyleId; // the style of the hero who won it
}

/** Count a won fight toward the quest. Returns true when this fight met the goal (the caller pays the reward). */
export function questProgress(t: Tuning, q: QuestState, f: FightDone): boolean {
  if (q.done) return false;
  switch (q.id) {
    case 'blocks':
      q.n += f.log.blocks;
      break;
    case 'combo':
      q.n = Math.max(q.n, f.log.bestCombo);
      break;
    case 'flawless':
      q.n += f.log.cleanWaves;
      break;
    case 'kills':
      q.n += f.log.kills;
      break;
    case 'elite':
      if (f.elite) q.n = 1;
      break;
    case 'healthy':
      if (f.hpShare >= t.quests.healthy - 1e-9) q.n = 1;
      break;
    default:
      // a style call: a win with a hero of its style
      if (f.style && questById(q.id)?.style === f.style) q.n += 1;
  }
  q.n = Math.min(q.n, q.goal);
  if (q.n < q.goal) return false;
  q.done = true;
  return true;
}

/** A saved quest, if it is one this build knows (else null). */
export function readQuest(t: Tuning, v: unknown): QuestState | null {
  const q = v as QuestState | null;
  if (!q || typeof q !== 'object' || !questById(q.id)) return null;
  if (typeof q.n !== 'number' || !Number.isFinite(q.n)) return null;
  const goal = questGoal(t, q.id);
  return { id: q.id, n: Math.max(0, Math.min(goal, Math.round(q.n))), goal, done: q.done === true };
}
