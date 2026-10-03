// Level / stage flow, boosts and revive bookkeeping. Pure TypeScript, no Phaser.

import { Combat, heroMaxHp, newHero, type Hero } from './combat';
import { Rng } from './rng';
import type { Settings, Tuning } from './tuning';

export type Phase = 'title' | 'fight' | 'boost' | 'levelClear' | 'defeat';

export type BoostId = 'maxHp' | 'damage' | 'crit' | 'critDmg' | 'comboPower' | 'heal';
export const BOOST_IDS: BoostId[] = ['maxHp', 'damage', 'crit', 'critDmg', 'comboPower', 'heal'];

export function boostLabel(t: Tuning, id: BoostId): [string, string] {
  const b = t.boosts;
  switch (id) {
    case 'maxHp':
      return ['MAX HP', `+${b.maxHp}`];
    case 'damage':
      return ['DAMAGE', `+${Math.round(b.damage * 100)}%`];
    case 'crit':
      return ['CRIT', `+${Math.round(b.crit * 100)}%`];
    case 'critDmg':
      return ['CRIT DMG', `+${b.critDmg}X`];
    case 'comboPower':
      return ['COMBO PWR', `+${b.comboPower}`];
    case 'heal':
      return ['FULL HEAL', 'HP TO MAX'];
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

  startStage(stageIndex: number): void {
    const stages = this.level.stages;
    this.stageIndex = Math.max(0, Math.min(stages.length - 1, stageIndex));
    const carry = this.combat?.carry();
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: stages[this.stageIndex],
      seed: this.seed,
      carry: carry ? { combo: carry.combo, meter: carry.meter, speedStacks: carry.speedStacks } : undefined,
    });
    this.boostChoices = [];
    this.pendingBoosts = 0;
    this.phase = 'fight';
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
      this.pendingBoosts += c.killQueue.length;
      c.killQueue.length = 0;
      this.boostChoices = rollBoosts(this.rng);
      this.phase = 'boost';
    }
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
