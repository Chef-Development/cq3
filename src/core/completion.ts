// Region completion (pure): what a region's tracker counts, and its 100% reward. Acts, mini-bosses and the boss come
// from the acts cleared (so Region 1 progress made before the tracker counts); bounties, hidden treasures and events
// are logged per region in the profile (profile.regions). 100% gives a guaranteed high-rarity hero chest (and gems)
// once, and a badge on the world map.

import { REGIONS, actInRegion, regionOfAct, regionStart } from '../data/regions';
import { newRegionLog, type Profile, type RegionLog } from './profile';
import type { Tuning } from './tuning';

export type CompletionKey = 'acts' | 'minis' | 'boss' | 'bounties' | 'treasures' | 'events';

export interface CompletionPart {
  key: CompletionKey;
  label: string; // plain game words ("Hidden treasures")
  have: number;
  of: number;
}

export interface Completion {
  parts: CompletionPart[];
  have: number;
  of: number;
  /** 0-100, rounded down (100 only when everything is done). */
  pct: number;
  done: boolean;
}

/** Events to finish per region (different ones; each act's map has one or two). */
export const EVENTS_PER_REGION = 3;

export const regionLog = (p: Profile, r: number): RegionLog => (p.regions[REGIONS[r]?.id ?? 'greenmarch'] ??= newRegionLog());

/** Region `r`'s tracker. */
export function regionCompletion(p: Profile, r: number): Completion {
  const def = REGIONS[r];
  const n = def.acts.length;
  const cleared = Math.max(0, Math.min(n, p.actsCleared - regionStart(r)));
  const log = p.regions[def.id] ?? newRegionLog();
  const parts: CompletionPart[] = [
    { key: 'acts', label: 'Acts cleared', have: cleared, of: n },
    { key: 'minis', label: 'Mini-bosses beaten', have: Math.min(n - 1, cleared), of: n - 1 },
    { key: 'boss', label: 'Boss beaten', have: cleared >= n ? 1 : 0, of: 1 },
    { key: 'bounties', label: 'Bounties done', have: Math.min(n, log.bounties.length), of: n },
    { key: 'treasures', label: 'Hidden treasures', have: Math.min(n, log.treasures.length), of: n },
    { key: 'events', label: 'Events seen', have: Math.min(EVENTS_PER_REGION, log.events.length), of: EVENTS_PER_REGION },
  ];
  const have = parts.reduce((a, x) => a + x.have, 0);
  const of = parts.reduce((a, x) => a + x.of, 0);
  const done = have >= of;
  return { parts, have, of, pct: done ? 100 : Math.floor((have / of) * 100), done };
}

/** A bounty finished in act `act` counts for its region (once per act). */
export function logBounty(p: Profile, act: number): boolean {
  const log = regionLog(p, regionOfAct(act));
  const a = actInRegion(act);
  if (log.bounties.includes(a)) return false;
  log.bounties.push(a);
  return true;
}

/** A hidden treasure found in act `act` (once per act). */
export function logTreasure(p: Profile, act: number): boolean {
  const log = regionLog(p, regionOfAct(act));
  const a = actInRegion(act);
  if (log.treasures.includes(a)) return false;
  log.treasures.push(a);
  return true;
}

/** An event finished in act `act` (each event counts once per region). */
export function logEvent(p: Profile, act: number, event: string): boolean {
  const log = regionLog(p, regionOfAct(act));
  if (log.events.includes(event)) return false;
  log.events.push(event);
  return true;
}

/** A region at 100% gives its reward once: a region hero chest and gems. Returns whether it was just given. */
export function claimRegionReward(p: Profile, t: Tuning, r: number): boolean {
  const c = regionCompletion(p, r);
  const log = regionLog(p, r);
  if (!c.done || log.chest) return false;
  log.chest = true;
  p.chests.region++;
  p.gems += Math.max(0, Math.round(t.gems.region));
  return true;
}

/** Whether region `r` shows its 100% badge on the world map. */
export const regionBadge = (p: Profile, r: number): boolean => regionCompletion(p, r).done;
