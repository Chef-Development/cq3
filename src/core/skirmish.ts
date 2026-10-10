// The world map's wandering foe (pure; no DOM). Once Act 1 has been cleared, a foe from a cleared act shows up on a
// road of the kingdom's map every so often: after tuning.wander.every fights won since the last one. Tapping it
// starts one bonus skirmish (an encounter from that act: a group of its foes, then one of its elites) for a gear
// drop and XP (core/run.ts startSkirmish). Its state lives in the profile, so it can't be farmed by reloading: at
// most one is out at a time, which one it is follows from how many came before, and it is used up the moment its
// fight starts (won or lost).

import type { RegionDef, Theme } from '../data/types';
import type { Profile } from './profile';
import { Rng } from './rng';
import type { Tuning } from './tuning';

export interface Skirmish {
  act: number; // the cleared act it comes from (a revision: the act whose numbers it fights at)
  waves: string[][];
  /** Where it stands on the world map's road (0..1 along it). */
  spot: number;
  /** A Mapmaker's revision (src/data/remixes.ts id), fought in its boss's own lair (`theme`), not a wandering foe. */
  remix?: string;
  theme?: Theme;
}

/** A fight was won in a run: one step closer to the next wandering foe. */
export function noteFightWon(p: Profile): void {
  p.wander.fights = Math.min(1e6, p.wander.fights + 1);
}

/** Whether a wandering foe is on the road now. One comes out (and stays until fought) once enough fights were won. */
export function wanderUp(p: Profile, t: Tuning): boolean {
  if (p.actsCleared < 1) return false;
  if (!p.wander.up && p.wander.fights >= Math.max(1, Math.round(t.wander.every))) p.wander.up = true;
  return p.wander.up;
}

/** The wandering foe that's out (or would be next): seeded by how many came before. */
export function skirmishFor(p: Profile, region: RegionDef): Skirmish {
  const rng = new Rng((Math.imul(p.wander.n + 1, 0x9e3779b1) ^ 0x5a17) >>> 0);
  const cleared = Math.max(1, Math.min(region.acts.length, p.actsCleared));
  const act = rng.int(cleared);
  const a = region.acts[act];
  const group = a.fights.late[rng.int(a.fights.late.length)].slice();
  const elite = a.elites[rng.int(a.elites.length)].slice();
  return { act, waves: [group, elite], spot: 0.15 + 0.7 * rng.next() };
}

/** The skirmish starts: the foe is used up (the caller saves the profile). */
export function useWanderer(p: Profile): void {
  p.wander.up = false;
  p.wander.fights = 0;
  p.wander.n++;
}
