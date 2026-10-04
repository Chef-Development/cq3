// Mid-run save (pure; no DOM). iOS often reloads a home-screen web app after you switch away, so the run is
// snapshotted after every stage and whenever the page is hidden, and the title screen offers Continue.
// A saved fight resumes with the same enemy HP, hero and combo, on a fresh bar.

import type { Hero } from './combat';
import { BOOST_IDS, type BoostId, type Run } from './run';
import type { Tuning } from './tuning';

export const SAVE_VERSION = 1;

export interface RunSave {
  v: number;
  savedAt: number; // ms since epoch
  levelIndex: number;
  stageIndex: number;
  /** Where to pick up: mid-fight, choosing a boost, at the chest, or on the defeat screen (= retry the level). */
  phase: 'fight' | 'boost' | 'levelClear' | 'defeat';
  hero: Hero;
  coins: number;
  enemyHp: number[]; // current stage, front first (0 = dead)
  carry: { combo: number; meter: number; stacks: number; speedStacks: number };
  boostChoices: BoostId[];
  pendingBoosts: number;
  random: { seed: number; rng: number };
}

const HERO_KEYS: Array<keyof Hero> = ['hp', 'bonusAtk', 'bonusMaxHp', 'bonusDmg', 'bonusCrit', 'bonusCritDmg', 'bonusComboPower', 'revives', 'abilityTimer'];

/** Snapshot of a run in progress (null on the title screen, where there's nothing to save). */
export function snapshotRun(run: Run, now = Date.now()): RunSave | null {
  const c = run.combat;
  if (run.phase === 'title' || !c) return null;
  const hero = { ...run.hero, abilityTimer: 0 };
  const carry = c.carry();
  // kills whose boost choice is still waiting for the kill animation: bank their coins and boosts now
  const unbanked = c.killQueue;
  const coins = unbanked.reduce((n, id) => n + (run.tuning.enemies[c.enemyById(id)?.key ?? '']?.coins ?? 0), run.coins);
  return {
    v: SAVE_VERSION,
    savedAt: now,
    levelIndex: run.levelIndex,
    stageIndex: run.stageIndex,
    phase: unbanked.length && run.phase === 'fight' ? 'boost' : run.phase,
    hero,
    coins,
    enemyHp: c.enemies.map((e) => (e.alive ? e.hp : 0)),
    carry: { combo: carry.combo, meter: carry.meter, stacks: carry.stacks, speedStacks: carry.speedStacks },
    boostChoices: run.boostChoices.slice(),
    pendingBoosts: run.pendingBoosts + unbanked.length,
    random: run.randomState,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Whether `data` is a save this build (and these levels) can resume. */
export function validSave(data: unknown, t: Tuning): data is RunSave {
  const s = data as RunSave;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return false;
  if (!num(s.levelIndex) || !num(s.stageIndex) || !num(s.coins) || !num(s.pendingBoosts) || !num(s.savedAt)) return false;
  const level = t.levels[s.levelIndex];
  if (!level || s.stageIndex < 0 || s.stageIndex >= level.stages.length) return false;
  if (!['fight', 'boost', 'levelClear', 'defeat'].includes(s.phase)) return false;
  if (!s.hero || !HERO_KEYS.every((k) => num(s.hero[k]))) return false;
  if (!Array.isArray(s.enemyHp) || s.enemyHp.length !== level.stages[s.stageIndex].length || !s.enemyHp.every(num)) return false;
  if (!s.carry || !num(s.carry.combo) || !num(s.carry.meter) || !num(s.carry.stacks) || !num(s.carry.speedStacks)) return false;
  if (!Array.isArray(s.boostChoices) || !s.boostChoices.every((b) => BOOST_IDS.includes(b))) return false;
  if (!s.random || !num(s.random.seed) || !num(s.random.rng)) return false;
  return true;
}

/** Put a run back where the save left it. Returns false (and leaves the run alone) if the save doesn't fit. */
export function restoreRun(run: Run, data: unknown): boolean {
  if (!validSave(data, run.tuning)) return false;
  const s = data;
  if (s.phase === 'defeat') {
    // the defeat screen's only way on is a retry: start the level over
    run.levelIndex = s.levelIndex;
    run.coins = s.coins;
    run.randomState = s.random;
    run.retry();
    return true;
  }
  run.levelIndex = s.levelIndex;
  run.hero = { ...s.hero, abilityTimer: 0 };
  run.coins = s.coins;
  run.startStage(s.stageIndex, { seed: s.random.seed, enemyHp: s.enemyHp, carry: s.carry });
  run.randomState = s.random;
  if (s.phase === 'boost' && s.pendingBoosts > 0) {
    run.boostChoices = s.boostChoices.length ? s.boostChoices.slice() : run.rollChoices();
    run.pendingBoosts = s.pendingBoosts;
    run.phase = 'boost';
  } else if (s.phase === 'levelClear') run.phase = 'levelClear';
  else if (run.combat?.result === 'won') {
    // saved between the last kill and the boost choice: move on as the boost would have
    if (run.stageIndex + 1 < run.level.stages.length) run.startStage(run.stageIndex + 1);
    else run.phase = 'levelClear';
  }
  return true;
}

/** "Level 1 - 3/4" for the Continue button. */
export function saveLabel(s: RunSave, t: Tuning): string {
  const level = t.levels[s.levelIndex];
  if (!level) return '';
  if (s.phase === 'levelClear') return `${level.name} clear`;
  return level.stages.length > 1 ? `${level.name} - ${s.stageIndex + 1}/${level.stages.length}` : level.name;
}
