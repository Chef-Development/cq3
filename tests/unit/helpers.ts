import { Combat, newHero } from '../../src/core/combat';
import { cloneTuning, DEFAULT_SETTINGS, type Settings, type Tuning } from '../../src/core/tuning';

export interface Setup {
  c: Combat;
  t: Tuning;
  s: Settings;
}

/** A combat with no automatic spawns, no crits and no hit-stop, so tests control every block. */
export function setup(opts: { enemies?: string[]; tune?: (t: Tuning) => void; settings?: Partial<Settings>; spawning?: boolean } = {}): Setup {
  const t = cloneTuning();
  t.hero.critChance = 0;
  t.hero.perfectCritBonus = 0;
  t.hero.abilityCritBonus = 0;
  t.juice.hitStopMs = 0;
  t.blocks.openingSpawns = 0;
  opts.tune?.(t);
  const s: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const c = new Combat({ tuning: t, settings: s, hero: newHero(t), enemies: opts.enemies ?? ['slime'], seed: 42, spawning: opts.spawning ?? false });
  return { c, t, s };
}

/** Sim time when the cursor (at base speed, first pass) is at bar position p. */
export const timeAt = (t: Tuning, p: number): number => p * t.cursor.basePassSec;
