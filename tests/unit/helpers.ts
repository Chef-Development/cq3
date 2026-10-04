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
  // Pin the numbers the assertions use so tuning the defaults doesn't break tests.
  t.enemies.slime.hp = 80;
  t.enemies.bandit.hp = 140;
  t.cursor.basePassSec = 1.4;
  t.blocks.attackWidth = 0.1;
  t.blocks.greenWidth = 0.1;
  t.blocks.redWidth = 0.08;
  t.blocks.trapWidth = 0.1;
  t.blocks.minGap = 0.03;
  t.blocks.widthMin = 1; // spawned blocks keep their kind's width unless a test varies it
  t.blocks.widthMax = 1;
  t.blocks.redWidthMin = 1;
  t.blocks.redWidthMax = 1;
  t.meter.finisherHold = 0; // the cursor keeps moving after a finisher unless a test stops it
  t.hero.healOnKill = 0;
  t.companion.everyHits = 0;
  t.kill.atk = 0;
  t.kill.maxHp = 0;
  t.kill.comboPower = 0;
  opts.tune?.(t);
  const s: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const c = new Combat({ tuning: t, settings: s, hero: newHero(t), enemies: opts.enemies ?? ['slime'], seed: 42, spawning: opts.spawning ?? false });
  return { c, t, s };
}

/** Sim time when the cursor (at base speed, first pass) is at bar position p. */
export const timeAt = (t: Tuning, p: number): number => p * t.cursor.basePassSec;
