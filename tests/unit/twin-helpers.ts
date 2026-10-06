// Test helpers for Sable (the Twin family: two cursors, one per half of the bar).
import { Combat, newHero } from '../../src/core/combat';
import { emptyLoadout } from '../../src/core/gear';
import type { Settings, Tuning } from '../../src/core/tuning';
import { setup, type Setup } from './helpers';

/** Sable's kit numbers pinned, so tuning the defaults doesn't break the tests. */
export function pinSable(t: Tuning): void {
  t.sable.atkMult = 0.65;
  t.sable.maxHp = 100;
  t.sable.widthMult = 0.5;
  t.sable.redWidthMult = 0.8;
  t.sable.ambidextrous = 0.25;
  t.sable.shadowSec = 3;
  t.sable.fangMult = 1.3;
  t.sable.fangKeep = 1;
}

/** Like helpers.setup (no spawns, crits or hit-stop unless asked; pinned numbers), with Sable fighting. */
export function setupTwin(
  opts: { skills?: string[]; enemies?: string[]; waves?: string[][]; tune?: (t: Tuning) => void; settings?: Partial<Settings>; spawning?: boolean; specials?: boolean; seed?: number } = {},
): Setup {
  const { t, s } = setup({
    settings: opts.settings,
    tune: (t) => {
      pinSable(t);
      opts.tune?.(t);
    },
  });
  const hero = newHero(t, emptyLoadout(), { id: 'sable', level: 1, skills: opts.skills ?? [] });
  const c = new Combat({ tuning: t, settings: s, hero, enemies: opts.enemies ?? ['slime'], waves: opts.waves, seed: opts.seed ?? 42, spawning: opts.spawning ?? false, specials: opts.specials });
  return { c, t, s };
}

/** Sim time when cursor `hand` (first pass, base speed, from the fight's start) is at bar position p. */
export const twinTimeAt = (t: Tuning, hand: number, p: number): number => ((p - (hand > 0 ? 0.5 : 0)) / 0.5) * t.cursor.basePassSec;

/** Step the fight until cursor `hand` is over bar position p (within a tick's travel), then tap with that hand there. */
export function tapOver(c: Combat, hand: number, p: number, maxSec = 5): ReturnType<Combat['tap']> {
  const end = c.time + maxSec;
  while (c.time < end) {
    const now = c.cursorPosAt(c.time, hand);
    const next = c.cursorPosAt(c.time + 1 / 120, hand);
    if (Math.abs(now - p) <= Math.abs(next - now) / 2 + 1e-9) return c.tap(c.time, hand);
    c.step();
  }
  throw new Error(`cursor ${hand} never reached ${p}`);
}
