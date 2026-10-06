// The kingdom's regions in play order (plain data). Acts are numbered globally across regions: Greenmarch's are acts
// 0-2, the next region's 3-5, and so on, so everything that grows with the act (item levels, XP, the replay kit, coins)
// keeps growing region after region. The world map plans 12 regions (one per Pendulum weight); the rest come later.

import { ASHFELL } from './ashfell';
import { FROSTPEAKS } from './frostpeaks';
import { GREENMARCH } from './greenmarch';
import type { ActDef, RegionDef } from './types';

export const REGIONS: RegionDef[] = [GREENMARCH, FROSTPEAKS, ASHFELL];

/** Every playable act, in order (index = the global act number). */
export const ALL_ACTS: ActDef[] = REGIONS.flatMap((r) => r.acts);

/** The region an act belongs to (index into REGIONS). */
export function regionOfAct(act: number): number {
  let a = Math.max(0, act);
  for (let r = 0; r < REGIONS.length; r++) {
    if (a < REGIONS[r].acts.length) return r;
    a -= REGIONS[r].acts.length;
  }
  return REGIONS.length - 1;
}

/** The global number of a region's first act. */
export function regionStart(r: number): number {
  let n = 0;
  for (let i = 0; i < Math.min(r, REGIONS.length); i++) n += REGIONS[i].acts.length;
  return n;
}

/** An act's place within its region (0 = the region's first act). */
export const actInRegion = (act: number): number => act - regionStart(regionOfAct(act));

/** Whether an act is its region's last (the region's boss). */
export const lastActOfRegion = (act: number): boolean => actInRegion(act) === REGIONS[regionOfAct(act)].acts.length - 1;

/** The kingdom as one long campaign: every region's acts in order (the run walks it act by act). */
export const CAMPAIGN: RegionDef = { id: 'kingdom', name: 'The Kingdom', introScene: GREENMARCH.introScene, victoryScene: GREENMARCH.victoryScene, acts: ALL_ACTS };
