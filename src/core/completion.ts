// Region completion (pure): what a region's tracker counts, and its 100% reward. Acts, mini-bosses and the boss come
// from the acts cleared (so Region 1 progress made before the tracker counts); bounties, hidden treasures and events
// are logged per region in the profile (profile.regions). 100% gives a guaranteed high-rarity hero chest (and gems)
// once, and a badge on the world map.
//
// One source for every count: regionCompletion lists each counted thing as an item (an act, its mini-boss or the boss,
// its bounty, its hidden treasure, an event), done or not, and the parts, the totals and the % are counted from those
// items, so the region card's seals (one per item), its ring, its N/15 and the world map's chip always agree.

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

/** One thing the tracker counts (the region card stamps a seal for it, or shows its empty socket). */
export interface CompletionItem {
  key: CompletionKey;
  /** The act it belongs to (0-based, in the region); an event's: its number (0-2). */
  n: number;
  done: boolean;
}

export interface Completion {
  /** Every counted thing, by part (acts, mini-bosses, the boss, bounties, treasures, events), each act's in act order. */
  items: CompletionItem[];
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

/** The parts in order, with their names. */
export const COMPLETION_PARTS: ReadonlyArray<{ key: CompletionKey; label: string }> = [
  { key: 'acts', label: 'Acts cleared' },
  { key: 'minis', label: 'Mini-bosses beaten' },
  { key: 'boss', label: 'Boss beaten' },
  { key: 'bounties', label: 'Bounties done' },
  { key: 'treasures', label: 'Hidden treasures' },
  { key: 'events', label: 'Events seen' },
];

/** Region `r`'s tracker: every item, and the parts, totals and % counted from them. */
export function regionCompletion(p: Profile, r: number): Completion {
  const def = REGIONS[r];
  const n = def.acts.length;
  const cleared = Math.max(0, Math.min(n, p.actsCleared - regionStart(r)));
  const log = p.regions[def.id] ?? newRegionLog();
  const acts = Array.from({ length: n }, (_, a) => a);
  const items: CompletionItem[] = [
    ...acts.map((a): CompletionItem => ({ key: 'acts', n: a, done: cleared > a })),
    // each act but the last ends in a mini-boss, the last in the boss
    ...acts.slice(0, -1).map((a): CompletionItem => ({ key: 'minis', n: a, done: cleared > a })),
    { key: 'boss', n: n - 1, done: cleared >= n },
    // a bounty and a hidden treasure per act (logged by the act's place in the region)
    ...acts.map((a): CompletionItem => ({ key: 'bounties', n: a, done: log.bounties.includes(a) })),
    ...acts.map((a): CompletionItem => ({ key: 'treasures', n: a, done: log.treasures.includes(a) })),
    // events: any different ones finished in the region, up to EVENTS_PER_REGION
    ...Array.from({ length: EVENTS_PER_REGION }, (_, e): CompletionItem => ({ key: 'events', n: e, done: e < log.events.length })),
  ];
  const parts: CompletionPart[] = COMPLETION_PARTS.map(({ key, label }) => {
    const mine = items.filter((it) => it.key === key);
    return { key, label, have: mine.filter((it) => it.done).length, of: mine.length };
  });
  const have = items.filter((it) => it.done).length;
  const of = items.length;
  const done = have >= of;
  return { items, parts, have, of, pct: done ? 100 : Math.floor((have / of) * 100), done };
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
