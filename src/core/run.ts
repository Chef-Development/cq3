// Level / stage flow, boosts and revive bookkeeping. Pure TypeScript, no Phaser.

import { Combat, heroMaxHp, newHero, type Carry, type Hero } from './combat';
import { Rng } from './rng';
import type { Settings, Tuning } from './tuning';

export type Phase = 'title' | 'fight' | 'boost' | 'levelClear' | 'defeat';

export type BoostId = 'maxHp' | 'damage' | 'crit' | 'critDmg' | 'comboPower' | 'pet' | 'heal';
export const BOOST_IDS: BoostId[] = ['maxHp', 'damage', 'crit', 'critDmg', 'comboPower', 'pet', 'heal'];

/** Boost cards come in three strengths: common (green), rare (blue, x2) and epic (gold, x3). */
export type Rarity = 'common' | 'rare' | 'epic';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];

export interface BoostOffer {
  id: BoostId;
  rarity: Rarity;
}

/** How many times stronger than common a card of this rarity is. */
export function rarityMult(t: Tuning, r: Rarity): number {
  return r === 'epic' ? t.boosts.epicMult : r === 'rare' ? t.boosts.rareMult : 1;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Max HP a Full Heal card adds on top of the heal (rare and epic only). */
const healBonusHp = (t: Tuning, r: Rarity) => Math.round(t.boosts.maxHp * (rarityMult(t, r) - 1) * 0.5);

export function boostLabel(t: Tuning, o: BoostOffer): [string, string] {
  const b = t.boosts;
  const m = rarityMult(t, o.rarity);
  switch (o.id) {
    case 'maxHp':
      return ['Max HP', `+${Math.round(b.maxHp * m)}`];
    case 'damage':
      return ['Damage', `+${Math.round(b.damage * m * 100)}%`];
    case 'crit':
      return ['Crit Chance', `+${Math.round(b.crit * m * 100)}%`];
    case 'critDmg':
      return ['Crit Damage', `+${round1(b.critDmg * m)}x`];
    case 'comboPower':
      return ['Combo Power', `+${round1(b.comboPower * m)}`];
    case 'pet':
      return ['Companion Power', `Pip +${Math.round(b.pet * m)} dmg`];
    case 'heal':
      return ['Full Heal', o.rarity === 'common' ? 'HP to max' : `+${healBonusHp(t, o.rarity)} max HP`];
  }
}

export function applyBoost(t: Tuning, h: Hero, o: BoostOffer): void {
  const b = t.boosts;
  const m = rarityMult(t, o.rarity);
  switch (o.id) {
    case 'maxHp':
      h.bonusMaxHp += Math.round(b.maxHp * m);
      h.hp += Math.round(b.maxHp * m);
      break;
    case 'damage':
      h.bonusDmg += b.damage * m;
      break;
    case 'crit':
      h.bonusCrit += b.crit * m;
      break;
    case 'critDmg':
      h.bonusCritDmg += b.critDmg * m;
      break;
    case 'comboPower':
      h.bonusComboPower += b.comboPower * m;
      break;
    case 'pet':
      h.bonusPet += Math.round(b.pet * m);
      break;
    case 'heal':
      h.bonusMaxHp += healBonusHp(t, o.rarity);
      h.hp = heroMaxHp(t, h);
      break;
  }
  h.hp = Math.min(h.hp, heroMaxHp(t, h));
}

/**
 * Three different boosts, each rolled common, rare or epic (tuning boosts.rareChance / epicChance).
 * `atLeastRare` (a boss kill) upgrades one card to rare if none came up rare or better.
 */
export function rollBoosts(rng: Rng, t: Tuning, atLeastRare = false, n = 3): BoostOffer[] {
  const pool = BOOST_IDS.slice();
  const out: BoostOffer[] = [];
  while (out.length < n && pool.length) {
    const id = pool.splice(rng.int(pool.length), 1)[0];
    const r = rng.next();
    const rarity: Rarity = r < t.boosts.epicChance ? 'epic' : r < t.boosts.epicChance + t.boosts.rareChance ? 'rare' : 'common';
    out.push({ id, rarity });
  }
  if (atLeastRare && out.length && out.every((o) => o.rarity === 'common')) out[rng.int(out.length)].rarity = 'rare';
  return out;
}

/**
 * A hero who has fought their way to `levelIndex`/`stageIndex`: every earlier kill's rewards plus one common boost
 * per kill (taken in turn). The debug panel's "Jump to" uses it so later stages aren't tried with a fresh hero.
 */
export function heroFor(t: Tuning, levelIndex: number, stageIndex: number): Hero {
  const h = newHero(t);
  const order: BoostId[] = ['damage', 'maxHp', 'comboPower', 'crit', 'pet', 'critDmg'];
  let kills = 0;
  t.levels.forEach((lvl, li) =>
    lvl.stages.forEach((stage, si) => {
      if (li < levelIndex || (li === levelIndex && si < stageIndex)) kills += stage.length;
    }),
  );
  for (let k = 0; k < kills; k++) {
    h.bonusAtk += t.kill.atk;
    h.bonusMaxHp += t.kill.maxHp;
    h.bonusComboPower += t.kill.comboPower;
    applyBoost(t, h, { id: order[k % order.length], rarity: 'common' });
  }
  h.hp = heroMaxHp(t, h);
  return h;
}

export class Run {
  phase: Phase = 'title';
  levelIndex = 0;
  stageIndex = 0;
  hero: Hero;
  /** The hero as they entered the current level: a retry starts from here. */
  levelHero: Hero;
  combat: Combat | null = null;
  boostChoices: BoostOffer[] = [];
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
    this.levelHero = { ...this.hero };
  }

  get level() {
    return this.tuning.levels[this.levelIndex];
  }

  /** Start a level. `hero` carries a hero (and their upgrades) in from the last level; default a fresh one. */
  startLevel(levelIndex: number, stageIndex = 0, hero?: Hero): void {
    this.levelIndex = Math.max(0, Math.min(this.tuning.levels.length - 1, levelIndex));
    this.hero = hero ? { ...hero, abilityTimer: 0, revives: this.tuning.hero.revivesPerLevel } : newHero(this.tuning);
    this.levelHero = { ...this.hero };
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
      hpMult: this.level.hpMult,
      atkMult: this.level.atkMult,
    });
    this.boostChoices = [];
    this.pendingBoosts = 0;
    this.phase = 'fight';
  }

  /** A boss is alive on screen (the music switches to the boss theme). */
  get bossFight(): boolean {
    const c = this.combat;
    return this.phase === 'fight' && !!c && c.enemies.some((e) => e.alive && !!this.tuning.enemies[e.key]?.boss);
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
      let boss = false;
      for (const id of c.killQueue) {
        const def = this.tuning.enemies[c.enemyById(id)?.key ?? ''];
        this.coins += def?.coins ?? 0;
        boss ||= !!def?.boss;
      }
      this.pendingBoosts += c.killQueue.length;
      c.killQueue.length = 0;
      this.boostChoices = rollBoosts(this.rng, this.tuning, boss); // a boss always leaves something rare
      this.phase = 'boost';
    }
  }

  /** Roll a fresh set of boost choices. */
  rollChoices(): BoostOffer[] {
    return rollBoosts(this.rng, this.tuning);
  }

  pickBoost(index: number): void {
    if (this.phase !== 'boost') return;
    const offer = this.boostChoices[index];
    if (!offer) return;
    applyBoost(this.tuning, this.hero, offer);
    this.pendingBoosts--;
    if (this.pendingBoosts > 0) {
      this.boostChoices = rollBoosts(this.rng, this.tuning);
      return;
    }
    this.boostChoices = [];
    if (this.combat?.result === 'won') {
      if (this.stageIndex + 1 < this.level.stages.length) this.startStage(this.stageIndex + 1);
      else this.phase = 'levelClear';
    } else this.phase = 'fight';
  }

  /** On to the next level: the hero keeps every upgrade and rests to full HP at the chest. After the last
   *  level the run starts over with a fresh hero. */
  nextLevel(): void {
    const next = (this.levelIndex + 1) % this.tuning.levels.length;
    if (next === 0) return this.startLevel(0);
    this.startLevel(next, 0, { ...this.hero, hp: heroMaxHp(this.tuning, this.hero) });
  }

  /** After a defeat: the level again, with the hero as they entered it. */
  retry(): void {
    this.startLevel(this.levelIndex, 0, this.levelHero);
  }
}
