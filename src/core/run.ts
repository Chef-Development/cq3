// Level / stage flow, boosts and revive bookkeeping. Pure TypeScript, no Phaser.

import { Combat, heroMaxHp, newHero, type Carry, type Hero } from './combat';
import { Rng } from './rng';
import type { Settings, Tuning } from './tuning';

export type Phase = 'title' | 'fight' | 'boost' | 'levelClear' | 'defeat';

export type BoostId = 'maxHp' | 'damage' | 'crit' | 'critDmg' | 'comboPower' | 'heal';
export const BOOST_IDS: BoostId[] = ['maxHp', 'damage', 'crit', 'critDmg', 'comboPower', 'heal'];

export function boostLabel(t: Tuning, id: BoostId): [string, string] {
  const b = t.boosts;
  switch (id) {
    case 'maxHp':
      return ['Max HP', `+${b.maxHp}`];
    case 'damage':
      return ['Damage', `+${Math.round(b.damage * 100)}%`];
    case 'crit':
      return ['Crit Chance', `+${Math.round(b.crit * 100)}%`];
    case 'critDmg':
      return ['Crit Damage', `+${b.critDmg}x`];
    case 'comboPower':
      return ['Combo Power', `+${b.comboPower}`];
    case 'heal':
      return ['Full Heal', 'HP to max'];
  }
}

export function applyBoost(t: Tuning, h: Hero, id: BoostId): void {
  const b = t.boosts;
  switch (id) {
    case 'maxHp':
      h.bonusMaxHp += b.maxHp;
      h.hp += b.maxHp;
      break;
    case 'damage':
      h.bonusDmg += b.damage;
      break;
    case 'crit':
      h.bonusCrit += b.crit;
      break;
    case 'critDmg':
      h.bonusCritDmg += b.critDmg;
      break;
    case 'comboPower':
      h.bonusComboPower += b.comboPower;
      break;
    case 'heal':
      h.hp = heroMaxHp(t, h);
      break;
  }
  h.hp = Math.min(h.hp, heroMaxHp(t, h));
}

export function rollBoosts(rng: Rng, n = 3): BoostId[] {
  const pool = BOOST_IDS.slice();
  const out: BoostId[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}

export class Run {
  phase: Phase = 'title';
  levelIndex = 0;
  stageIndex = 0;
  hero: Hero;
  combat: Combat | null = null;
  boostChoices: BoostId[] = [];
  pendingBoosts = 0;
  /** Coins collected this session (kept across levels). */
  coins = 0;
  private rng: Rng;
  private seed: number;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
    seed = 1,
  ) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed ^ 0xa5a5a5);
    this.hero = newHero(tuning);
  }

  get level() {
    return this.tuning.levels[this.levelIndex];
  }

  startLevel(levelIndex: number, stageIndex = 0): void {
    this.levelIndex = Math.max(0, Math.min(this.tuning.levels.length - 1, levelIndex));
    this.hero = newHero(this.tuning);
    this.combat = null;
    this.startStage(stageIndex);
  }

  /** Start a stage. `resume` rebuilds a saved one: its seed, the enemies' HP and the combo carried in. */
  startStage(stageIndex: number, resume?: { seed: number; enemyHp: number[]; carry: Partial<Carry> }): void {
    const stages = this.level.stages;
    this.stageIndex = Math.max(0, Math.min(stages.length - 1, stageIndex));
    const prev = this.combat?.carry();
    const carry = resume ? resume.carry : prev ? { combo: prev.combo, meter: prev.meter, stacks: prev.stacks, speedStacks: prev.speedStacks } : undefined;
    this.seed = resume ? resume.seed >>> 0 : (this.seed * 1664525 + 1013904223) >>> 0;
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: stages[this.stageIndex],
      seed: this.seed,
      carry,
      enemyHp: resume?.enemyHp,
    });
    this.boostChoices = [];
    this.pendingBoosts = 0;
    this.phase = 'fight';
  }

  /** The run's random state (stage seeds and boost rolls), for saving. */
  get randomState(): { seed: number; rng: number } {
    return { seed: this.seed, rng: this.rng.state };
  }

  set randomState(v: { seed: number; rng: number }) {
    this.seed = v.seed >>> 0;
    this.rng.state = v.rng;
  }

  /** Call after every combat interaction: moves to boost/defeat phases as needed. */
  sync(): void {
    const c = this.combat;
    if (this.phase !== 'fight' || !c) return;
    if (c.result === 'lost') {
      this.phase = 'defeat';
      return;
    }
    if (c.killQueue.length) {
      for (const id of c.killQueue) this.coins += this.tuning.enemies[c.enemyById(id)?.key ?? '']?.coins ?? 0;
      this.pendingBoosts += c.killQueue.length;
      c.killQueue.length = 0;
      this.boostChoices = rollBoosts(this.rng);
      this.phase = 'boost';
    }
  }

  /** Roll a fresh set of boost choices. */
  rollChoices(): BoostId[] {
    return rollBoosts(this.rng);
  }

  pickBoost(index: number): void {
    if (this.phase !== 'boost') return;
    const id = this.boostChoices[index];
    if (!id) return;
    applyBoost(this.tuning, this.hero, id);
    this.pendingBoosts--;
    if (this.pendingBoosts > 0) {
      this.boostChoices = rollBoosts(this.rng);
      return;
    }
    this.boostChoices = [];
    if (this.combat?.result === 'won') {
      if (this.stageIndex + 1 < this.level.stages.length) this.startStage(this.stageIndex + 1);
      else this.phase = 'levelClear';
    } else this.phase = 'fight';
  }

  nextLevel(): void {
    this.startLevel((this.levelIndex + 1) % this.tuning.levels.length);
  }

  retry(): void {
    this.startLevel(this.levelIndex);
  }
}
