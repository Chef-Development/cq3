import { Combat, newHero } from '../../src/core/combat';
import type { HeroId } from '../../src/data/heroes';
import type { BarRules } from '../../src/data/types';
import { defaultBuild } from '../../src/core/heroes';
import { cloneTuning, DEFAULT_SETTINGS, type Settings, type Tuning } from '../../src/core/tuning';

export interface Setup {
  c: Combat;
  t: Tuning;
  s: Settings;
}

/** A combat with no automatic spawns (and no specials unless asked), no crits and no hit-stop, so tests control every block. */
export function setup(
  opts: { enemies?: string[]; tune?: (t: Tuning) => void; settings?: Partial<Settings>; spawning?: boolean; specials?: boolean; hero?: HeroId; stars?: number; bar?: BarRules; row?: number } = {},
): Setup {
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
  t.hero.strengthScale = 0; // heroes' soft strengths off unless a test turns them on
  opts.tune?.(t);
  const s: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  const hero = newHero(t, undefined, defaultBuild(opts.hero ?? 'rowan', opts.stars ?? 1));
  const c = new Combat({ tuning: t, settings: s, hero, enemies: opts.enemies ?? ['slime'], seed: 42, spawning: opts.spawning ?? false, specials: opts.specials, bar: opts.bar, row: opts.row });
  return { c, t, s };
}

/** Sim time when the cursor (at base speed, first pass) is at bar position p. */
export const timeAt = (t: Tuning, p: number): number => p * t.cursor.basePassSec;

/** Beat every wave but the last (each falls to a finisher, then the next walks in); the last wave is left on screen. */
export function toLastWave(c: Combat): void {
  for (let k = 0; k < 30 && c.waveIndex < c.waves.length - 1; k++) {
    for (const e of c.enemies) if (e.alive) (e.uses = e.uses.map(() => 1)), (e.hp = 1);
    c.stacks = Math.max(1, c.stacks);
    c.finisher();
    c.advanceTo(c.time + c.tuning.waves.gapSec + 0.05);
  }
  c.drainEvents();
}
