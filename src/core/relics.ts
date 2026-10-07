// Relic offers and builds (pure; no DOM). The 1-of-3 pick after a fight offers mostly relics plus at most one stat
// card; relics you already own are never offered again, locked ones never at all; the offer leans toward tags you
// already own so builds form (a card that shares a tag with what you own is marked "Synergy!"). The act-clear
// screen names the build from the top tags. Unlocks: the first clear of an act, the first elite won in an act, a
// choice at an event (src/data/relics.ts says which).

import { HEROES } from '../data/heroes';
import { MASTERY } from '../data/meta';
import { eventById } from '../data/events';
import { BUILD_NAME, PAIR_NAME, RELIC_TAGS, RELICS, relicById, type RelicDef, type RelicId, type RelicRarity, type RelicTag } from '../data/relics';
import type { Rng } from './rng';
import type { Tuning } from './tuning';

export { RELICS, relicById, type RelicId, type RelicTag } from '../data/relics';

const RARITY_RANK: Record<RelicRarity, number> = { common: 0, rare: 1, epic: 2 };
export const rarityRank = (r: RelicRarity): number => RARITY_RANK[r] ?? 0;

/** A relic's live number (tuning.relics.n), or its data default. */
export const relicNumber = (t: Tuning, id: RelicId): number => t.relics.n[id] ?? relicById(id)?.n ?? 0;

/** A relic's text with its number filled in. */
export function relicText(t: Tuning, id: RelicId): string {
  const r = relicById(id);
  if (!r) return '';
  const n = relicNumber(t, id);
  return r.text.replace('{n}', `${Math.round(n * 100) / 100}`);
}

/** How many owned relics carry each tag. */
export function tagCounts(owned: readonly RelicId[]): Record<RelicTag, number> {
  const out = Object.fromEntries(RELIC_TAGS.map((t) => [t, 0])) as Record<RelicTag, number>;
  for (const id of owned) for (const tag of relicById(id)?.tags ?? []) out[tag]++;
  return out;
}

/** The tags of `id` that something you own also has. */
export function sharedTags(id: RelicId, owned: readonly RelicId[]): RelicTag[] {
  const have = tagCounts(owned.filter((o) => o !== id));
  return (relicById(id)?.tags ?? []).filter((t) => have[t] > 0);
}

/** "Synergy!": the relic shares a tag with one you own. */
export const isSynergy = (id: RelicId, owned: readonly RelicId[]): boolean => sharedTags(id, owned).length > 0;

/** Owned tags, most common first (ties in the tag list's order); only tags you have. */
export function topTags(owned: readonly RelicId[]): RelicTag[] {
  const c = tagCounts(owned);
  return RELIC_TAGS.filter((t) => c[t] > 0).sort((a, b) => c[b] - c[a] || RELIC_TAGS.indexOf(a) - RELIC_TAGS.indexOf(b));
}

/** The build's name from its top tags: a pair's name when the top two lead together (2+ each), else the top tag's. */
export function buildName(owned: readonly RelicId[]): string {
  const top = topTags(owned);
  if (!top.length) return 'Freshly Armed';
  const c = tagCounts(owned);
  if (top.length > 1 && c[top[1]] >= 2) {
    const pair = PAIR_NAME.find(([a, b]) => (a === top[0] && b === top[1]) || (a === top[1] && b === top[0]));
    if (pair) return pair[2];
  }
  return BUILD_NAME[top[0]];
}

/** How likely a relic is to be offered: its rarity's weight, leaning toward the tags you own. */
export function relicWeight(t: Tuning, r: RelicDef, owned: readonly RelicId[]): number {
  const R = t.relics;
  const base = r.rarity === 'epic' ? R.epicW : r.rarity === 'rare' ? R.rareW : R.commonW;
  return Math.max(0, base) * (1 + Math.max(0, R.synergy) * sharedTags(r.id, owned).length);
}

/**
 * Pick `n` different relics from `pool` (the unlocked ones), never one you own, weighted by relicWeight. With
 * `min`, at least one is that rare (if the pool has one).
 */
export function rollRelics(rng: Rng, t: Tuning, pool: readonly RelicId[], owned: readonly RelicId[], n: number, min?: RelicRarity): RelicId[] {
  const left = pool.map((id) => relicById(id)).filter((r): r is RelicDef => !!r && !owned.includes(r.id));
  const out: RelicId[] = [];
  const draw = (from: RelicDef[]): RelicDef | null => {
    const ws = from.map((r) => relicWeight(t, r, owned));
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return from.length ? from[rng.int(from.length)] : null;
    let x = rng.next() * total;
    for (let i = 0; i < from.length; i++) if ((x -= ws[i]) <= 0) return from[i];
    return from[from.length - 1];
  };
  if (min && rarityRank(min) > 0) {
    const rare = left.filter((r) => rarityRank(r.rarity) >= rarityRank(min));
    const r = draw(rare);
    if (r) {
      out.push(r.id);
      left.splice(left.indexOf(r), 1);
    }
  }
  while (out.length < n && left.length) {
    const r = draw(left)!;
    out.push(r.id);
    left.splice(left.indexOf(r), 1);
  }
  // the guaranteed one shouldn't always sit first
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Relics a first act clear, a first elite win in an act, or an event choice unlocks. */
export function unlocksFor(kind: 'act' | 'elite', act: number): RelicId[];
export function unlocksFor(kind: 'event', event: string, choice: number): RelicId[];
export function unlocksFor(kind: 'act' | 'elite' | 'event', a: number | string, choice?: number): RelicId[] {
  return RELICS.filter((r) => {
    const u = r.unlock;
    if (!u || u.kind !== kind) return false;
    if (u.kind === 'event') return u.event === a && u.choice === choice;
    return u.act === a;
  }).map((r) => r.id);
}

/** How a locked relic is unlocked, in words (the relic log). */
export function unlockHint(id: RelicId): string {
  const u = relicById(id)?.unlock;
  if (!u) return 'Unlocked from the start';
  if (u.kind === 'act') return `Clear Act ${u.act + 1}`;
  if (u.kind === 'elite') return `Beat an elite in Act ${u.act + 1}`;
  if (u.kind === 'mastery') {
    const m = MASTERY.find((x) => x.reward.kind === 'relic' && x.reward.relic === id);
    return m ? `${HEROES[m.hero].name}: ${m.text.toLowerCase()}` : "A hero's mastery";
  }
  const ev = eventById(u.event);
  const choice = ev?.choices[u.choice]?.label;
  return ev ? `${ev.title}: ${choice ?? 'an event'}` : 'Found at an event';
}
