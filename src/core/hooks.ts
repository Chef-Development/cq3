// Fight hooks (pure; no DOM): how relics (core/relic-fx.ts), skill nodes (core/skill-fx.ts) and a hero's kit
// (core/kit-fx.ts) change the rules of a fight without growing combat.ts. Combat collects the hooks of what the
// hero carries when the fight starts (relics, learned skills, the hero's kit) and calls them at fixed points.
// A hook that changes a number gets the current value and returns the new one; hooks run in a fixed order
// (kit, then skills, then relics, each in list order). Per-fight state goes in `c.perk` (a scratch map of
// numbers, keyed by the perk's id). A perk that kicks in shows itself with `c.perkFx(id, amount, enemyId)`.

import type { BlockKind } from './blocks';
import type { Block, Combat, Enemy, HurtSource } from './combat';

/** A yellow or green hit. `crit` is decided before hitMult runs; `damage` is final in afterHit. */
export interface HitCtx {
  block: Block; // the block hit (already off the bar)
  hand: number; // which cursor: 0 (Rowan's only one, or Sable's left one, A), 1 (Sable's right one, B)
  perfect: boolean;
  green: boolean;
  target: Enemy | null;
  crit: boolean;
  damage: number;
  /** Twin: this hit came from the other hand than the hit before it (Ambidextrous). */
  alternated: boolean;
  /** A Shadow Step echo or another perk's extra hit (perks shouldn't chain off these). */
  echo: boolean;
}

/** A red (or shield, bomb, speed) blocked. `cracked`: a shield took a tap but still stands. */
export interface BlockCtx {
  block: Block;
  hand: number;
  perfect: boolean;
  cracked: boolean;
  owner: Enemy | undefined;
  /** Another perk's extra block (Cross Guard, Night Watch): perks shouldn't chain off these. */
  echo: boolean;
}

export interface FinisherCtx {
  stacks: number;
  combo: number; // the combo when it was fired
  damage: number; // per foe (afterFinisher: what it dealt to each)
  targets: Enemy[]; // who it hits (every living foe for Rowan; Sable's Twin Fang: the target alone)
  killed: number; // afterFinisher: foes it killed
  keepCombo: boolean; // set by a hook: the finisher doesn't reset the combo (Sweeper)
}

export interface PeckCtx {
  target: Enemy;
  damage: number;
  crit: boolean;
  count: number; // pecks so far this fight (this one included)
}

/** Where meter fill comes from. */
export type MeterSource = 'hit' | 'green' | 'block' | 'ward' | 'peck' | 'perk';

/** What a combo break leaves: hooks may keep some of it (Hoarder, Unbroken). */
export interface BreakCtx {
  combo: number; // before the break
  stacks: number;
  meter: number;
  keepCombo: number; // what's left after it (0 = all lost)
  keepStacks: number;
  keepMeter: number;
}

/** A miss: how much it hurts and whether it breaks the combo (hooks change both). */
export interface MissCtx {
  hand: number;
  damage: number; // Classic mode: tuning.judge.missSelfDamage; Relaxed: 0
  breaks: boolean;
}

export interface FightHooks {
  /** The fight starts (after the opening blocks are placed). */
  start?(c: Combat): void;
  /** Every 1/120 s tick the fight runs (not during hit-stop). */
  step?(c: Combat): void;
  /** A block spawned from an enemy's pattern (or the refill): change its kind (Greenhouse, Sapper's Fuse). */
  spawnKind?(c: Combat, kind: BlockKind, ownerId: number): BlockKind;
  /** Any block just landed on the bar (patterns, specials, perks): change it (Turtle Shell: fewer shield taps). */
  spawned?(c: Combat, b: Block): void;
  /** Combo gained by a hit or a block (normally 1). */
  comboGain?(c: Combat, from: 'hit' | 'block' | 'ward', perfect: boolean, hand: number, n: number): number;
  /** The combo went up from `before` to `after` (Chain Reaction, Gold Fever, Quickening). */
  combo?(c: Combat, before: number, after: number): void;
  critChance?(c: Combat, x: HitCtx, chance: number): number;
  /** The crit damage multiplier (heroStats critDmg) for this hit. */
  critMult?(c: Combat, x: HitCtx, mult: number): number;
  /** The hit's damage multiplier (green, tiers and the crit already in `mult`). */
  hitMult?(c: Combat, x: HitCtx, mult: number): number;
  afterHit?(c: Combat, x: HitCtx): void;
  afterBlock?(c: Combat, x: BlockCtx): void;
  /** Meter fill (before Meter Gain). */
  meter?(c: Combat, source: MeterSource, amount: number, hand: number): number;
  maxStacks?(c: Combat, n: number): number;
  /** Damage the hero is about to take (after Defense). */
  hurt?(c: Combat, amount: number, source: HurtSource, enemyId: number): number;
  /** A red reached the hero. Return true if a perk dealt with it (no damage, no combo break). */
  impact?(c: Combat, b: Block): boolean;
  miss?(c: Combat, x: MissCtx): void;
  /** A purple trap was tapped. Return true if a perk dealt with it (the trap doesn't fire). */
  trap?(c: Combat, b: Block): boolean;
  /** A combo break: change what's kept. */
  comboBreak?(c: Combat, x: BreakCtx): void;
  /** The finisher's damage multiplier per foe; before it fires (set targets here to change who it hits). */
  finisher?(c: Combat, x: FinisherCtx, mult: number): number;
  afterFinisher?(c: Combat, x: FinisherCtx): void;
  /** Pip is about to peck (change damage or crit). */
  peck?(c: Combat, x: PeckCtx): void;
  afterPeck?(c: Combat, x: PeckCtx): void;
  /** A foe died; `overkill` is the damage past its last HP. */
  kill?(c: Combat, e: Enemy, overkill: number, source: string): void;
  /** A bomb was tapped and blew up; `cleared` are the blocks the blast took off the bar. */
  explode?(c: Combat, bomb: Block, cleared: Block[]): void;
}

export type HookName = keyof FightHooks;
