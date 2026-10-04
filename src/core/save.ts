// Mid-run save (pure; no DOM). iOS often reloads a home-screen web app after you switch away, so the run is
// snapshotted after every stage and whenever the page is hidden, and the title screen offers Continue.
// A saved fight resumes with the same enemy HP, hero and combo, on a fresh bar.

import { newHero, type Hero } from './combat';
import { BOOST_IDS, RARITIES, type BoostOffer, type Run } from './run';
import type { Tuning } from './tuning';

// v2: boost choices carry a rarity, and the hero has a companion bonus. v1 saves still load (as common cards).
export const SAVE_VERSION = 2;

export interface RunSave {
  v: number;
  savedAt: number; // ms since epoch
  levelIndex: number;
  stageIndex: number;
  /** Where to pick up: mid-fight, choosing a boost, at the chest, or on the defeat screen (= retry the level). */
  phase: 'fight' | 'boost' | 'levelClear' | 'defeat';
  hero: Hero;
  /** The hero as they entered this level (a retry starts from here). Missing in older saves: a fresh hero. */
  levelHero?: Hero;
  coins: number;
  enemyHp: number[]; // current stage, front first (0 = dead)
  carry: { combo: number; meter: number; stacks: number; speedStacks: number };
  boostChoices: BoostOffer[];
  pendingBoosts: number;
  random: { seed: number; rng: number };
}

const HERO_KEYS: Array<keyof Hero> = ['hp', 'bonusAtk', 'bonusMaxHp', 'bonusDmg', 'bonusCrit', 'bonusCritDmg', 'bonusComboPower', 'bonusPet', 'revives', 'abilityTimer'];

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
    levelHero: { ...run.levelHero, abilityTimer: 0 },
    coins,
    enemyHp: c.enemies.map((e) => (e.alive ? e.hp : 0)),
    carry: { combo: carry.combo, meter: carry.meter, stacks: carry.stacks, speedStacks: carry.speedStacks },
    boostChoices: run.boostChoices.map((o) => ({ ...o })),
    pendingBoosts: run.pendingBoosts + unbanked.length,
    random: run.randomState,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Bring an older save up to the current shape (v1: plain boost ids, no companion bonus). */
function upgrade(data: unknown): unknown {
  const s = data as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || s.v !== 1) return data;
  const hero = (s.hero && typeof s.hero === 'object' ? { bonusPet: 0, ...(s.hero as object) } : s.hero) as unknown;
  const choices = Array.isArray(s.boostChoices) ? s.boostChoices.map((id) => (typeof id === 'string' ? { id, rarity: 'common' } : id)) : s.boostChoices;
  return { ...s, v: SAVE_VERSION, hero, boostChoices: choices };
}

/** The save in current form, if this build (and these levels) can resume it; otherwise null. */
export function readSave(data: unknown, t: Tuning): RunSave | null {
  const s = upgrade(data) as RunSave;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
  if (!num(s.levelIndex) || !num(s.stageIndex) || !num(s.coins) || !num(s.pendingBoosts) || !num(s.savedAt)) return null;
  const level = t.levels[s.levelIndex];
  if (!level || s.stageIndex < 0 || s.stageIndex >= level.stages.length) return null;
  if (!['fight', 'boost', 'levelClear', 'defeat'].includes(s.phase)) return null;
  if (!s.hero || !HERO_KEYS.every((k) => num(s.hero[k]))) return null;
  if (s.levelHero !== undefined && (!s.levelHero || !HERO_KEYS.every((k) => num(s.levelHero![k])))) return null;
  if (!Array.isArray(s.enemyHp) || s.enemyHp.length !== level.stages[s.stageIndex].length || !s.enemyHp.every(num)) return null;
  if (!s.carry || !num(s.carry.combo) || !num(s.carry.meter) || !num(s.carry.stacks) || !num(s.carry.speedStacks)) return null;
  if (!Array.isArray(s.boostChoices) || !s.boostChoices.every((b) => b && BOOST_IDS.includes(b.id) && RARITIES.includes(b.rarity))) return null;
  if (!s.random || !num(s.random.seed) || !num(s.random.rng)) return null;
  return s;
}

/** Whether `data` is a save this build (and these levels) can resume. */
export function validSave(data: unknown, t: Tuning): boolean {
  return readSave(data, t) !== null;
}

/** Put a run back where the save left it. Returns false (and leaves the run alone) if the save doesn't fit. */
export function restoreRun(run: Run, data: unknown): boolean {
  const s = readSave(data, run.tuning);
  if (!s) return false;
  const levelHero = s.levelHero ? { ...s.levelHero, abilityTimer: 0 } : newHero(run.tuning);
  if (s.phase === 'defeat') {
    // the defeat screen's only way on is a retry: start the level over, as the hero entered it
    run.coins = s.coins;
    run.randomState = s.random;
    run.startLevel(s.levelIndex, 0, levelHero);
    return true;
  }
  run.levelIndex = s.levelIndex;
  run.levelHero = levelHero;
  run.hero = { ...s.hero, abilityTimer: 0 };
  run.coins = s.coins;
  run.startStage(s.stageIndex, { seed: s.random.seed, enemyHp: s.enemyHp, carry: s.carry });
  run.randomState = s.random;
  if (s.phase === 'boost' && s.pendingBoosts > 0) {
    run.boostChoices = s.boostChoices.length ? s.boostChoices.map((o) => ({ ...o })) : run.rollChoices();
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
