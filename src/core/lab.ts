// The Test lab (pure; no DOM): each scenario's profile, built fresh on the lab's own save (never the real profile),
// its practice fight or story, the ratings the playtester gives (Good / Needs work / Broken and a short note) and the
// plain-text report for the planning chat. The scenarios are data (src/data/lab.ts); the list, the rating card and
// the storage switch are engine/lab.ts and engine/storage.ts.

import { BASE_BY_ID, SLOT_KEYS, type SlotKey } from '../data/gear';
import { HERO_IDS, type HeroId } from '../data/heroes';
import { COMPANION_IDS, type CompanionId } from '../data/companions';
import { EVENTS } from '../data/events';
import { TIPS } from '../data/tips';
import { LAB_EARLIER, LAB_GROUPS, LAB_NEW, type LabScenario } from '../data/lab';
import { ALL_ACTS, REGIONS } from '../data/regions';
import type { BarRules } from '../data/types';
import { itemLevel, makeItem } from './gear';
import { nodeAt, xpForLevel } from './heroes';
import { addItem, equip, newProfile, newRegionLog, type Profile } from './profile';
import { Rng } from './rng';
import { unveilKey } from './world-plan';
import type { Run } from './run';
import type { Tuning } from './tuning';

/** A hero's level when they enter act `act` on a typical first playthrough (Greenmarch ends around 9). */
export const labLevel = (act: number): number => Math.max(1, Math.min(30, 3 + 2 * Math.max(0, act)));

/** The act a scenario plays at (a camp screen: the last act its profile has cleared). */
export function labAct(s: LabScenario): number {
  if (s.setup.kind === 'fight' || s.setup.kind === 'story') return s.setup.act;
  return Math.max(0, (s.profile?.actsCleared ?? 0) - 1);
}

/** What every lab profile starts from: the story heroes met, the smith met, tips off, the world map's reveals seen (its
 *  first glide, and every later region's unveiling: the lab never glides the view over a secret land). */
export function labBaseProfile(): Profile {
  const p = newProfile();
  p.tipsOff = true;
  p.worldTour = true;
  p.seen = REGIONS.slice(1).map((r) => unveilKey(r.id));
  p.smithMet = true;
  p.sableMet = true;
  p.heroes.sable.unlocked = true;
  return p;
}

// a Rare piece per slot, Region 1 bases only (the bag never shows a secret item)
const KIT: Record<SlotKey, string> = { weapon: 'hedgeSaber', helm: 'leatherCap', armor: 'paddedVest', boots: 'wornBoots', trinket1: 'emberLocket', trinket2: 'whetstone' };

/** Dress the profile in a Rare kit at act `act`'s item level (seeded: the same kit every time). */
function giveKit(p: Profile, t: Tuning, act: number): void {
  const rng = new Rng(0x1ab5eed + act * 7919);
  const ilvl = itemLevel(t, act, 3);
  for (const k of SLOT_KEYS) {
    const base = BASE_BY_ID[KIT[k]];
    if (!base) continue;
    const { item, salvaged } = addItem(p, t, makeItem(rng, base, 'rare', ilvl));
    if (!salvaged) {
      item.fresh = false;
      equip(p, item.uid, k);
    }
  }
}

/**
 * The lab's profile for a scenario: a fresh one (never the real profile) with just what the scenario needs: the acts
 * cleared, heroes owned at their stars and levels, companions, camp upgrades, coins, gems, chests, the shrine's pity,
 * Region 1's completion log, and a Rare kit at the scenario's act.
 */
export function labProfile(t: Tuning, s: LabScenario): Profile {
  const p = labBaseProfile();
  const spec = s.profile ?? {};
  const act = labAct(s);
  p.actsCleared = Math.max(0, Math.min(ALL_ACTS.length, spec.actsCleared ?? (s.setup.kind === 'camp' ? 1 : act)));
  if (p.actsCleared >= 3) p.weights = Math.max(p.weights, 1);
  if (p.actsCleared >= 4) {
    // the frost mage has joined by then (her scene never plays over the lab's camp)
    p.neveMet = true;
    p.heroes.neve.unlocked = true;
  }
  // heroes: Rowan and Sable always; the listed ones at their stars; the fight's hero
  for (const [id, stars] of Object.entries(spec.heroes ?? {}) as Array<[HeroId, number]>) {
    p.heroes[id].unlocked = true;
    p.heroes[id].stars = Math.max(1, Math.min(5, Math.round(stars)));
  }
  if (s.setup.kind === 'fight') p.heroes[s.setup.hero].unlocked = true;
  const level = spec.level ?? labLevel(act);
  for (const id of HERO_IDS) if (p.heroes[id].unlocked) p.heroes[id].xp = xpForLevel(t, level);
  // skill nodes learned (a tree option to try): each with the nodes before it in its branch
  for (const [id, nodes] of Object.entries(spec.skills ?? {}) as Array<[HeroId, string[]]>) {
    const h = p.heroes[id];
    for (const n of nodes) {
      const at = nodeAt(id, n);
      if (!at) continue;
      for (const prev of at.branch.nodes.slice(0, at.index + 1)) if (!h.skills.includes(prev.id)) h.skills.push(prev.id);
    }
  }
  const pick = spec.hero ?? (s.setup.kind === 'fight' ? s.setup.hero : s.setup.kind === 'camp' ? s.setup.hero : undefined);
  if (pick && p.heroes[pick].unlocked) p.hero = pick;
  // companions: Pip always, the listed ones, all at a level that fits
  for (const id of spec.pets ?? []) p.pets[id].owned = true;
  for (const id of COMPANION_IDS) if (p.pets[id].owned) p.pets[id].xp = xpForLevel(t, Math.max(1, Math.round(level / 2)));
  p.camp = [...new Set(spec.camp ?? [])];
  const slots = p.camp.includes('perch') ? 2 : 1;
  const on = (spec.petsOn ?? ['pip']).filter((id: CompanionId) => p.pets[id].owned);
  p.petsOn = (on.length ? [...new Set(on)] : (['pip'] as CompanionId[])).slice(0, slots);
  p.mastery = [...new Set(spec.mastery ?? [])];
  p.coins = Math.max(0, Math.round(spec.coins ?? 200));
  p.gems = Math.max(0, Math.round((spec.shrineChests ?? 0) * t.chests.rareCost));
  p.chests = { hero: spec.chests?.hero ?? 0, rare: spec.chests?.rare ?? 0, region: spec.chests?.region ?? 0 };
  if (spec.pityLeft !== undefined) p.pity.rare = Math.max(0, Math.round(t.chests.pity) - Math.max(1, Math.round(spec.pityLeft)));
  if (spec.completion) {
    // Region 1 with every bounty, treasure and event logged; 'done': its boss beaten too, 'near': the boss still to go
    // (so the next region isn't reached: its name stays "???" on the progress screen)
    const log = newRegionLog();
    const n = REGIONS[0].acts.length;
    log.bounties = Array.from({ length: n }, (_, i) => i);
    log.treasures = Array.from({ length: n }, (_, i) => i);
    log.events = EVENTS.slice(0, 3).map((e) => e.id);
    p.regions[REGIONS[0].id] = log;
    p.actsCleared = spec.completion === 'done' ? Math.max(p.actsCleared, n) : n - 1;
    p.weights = spec.completion === 'done' ? 1 : 0;
  }
  if (spec.tips?.length) {
    // these tips still to show (a hero's how-to card), every other one seen: tips on
    p.tipsOff = false;
    p.tips = TIPS.map((d) => d.id).filter((id) => !spec.tips!.includes(id));
  }
  giveKit(p, t, act);
  return p;
}

// ---------------------------------------------------------------- what a scenario plays

/** A fight scenario's practice fight (run.startPractice's options), plus the finisher stacks banked at the start. */
export interface LabFightPlan {
  hero: HeroId;
  stars?: number;
  waves: string[][];
  act: number;
  bar?: BarRules;
  row: number;
  safe: boolean;
  stacks: number;
}

export function labFight(s: LabScenario): LabFightPlan | null {
  if (s.setup.kind !== 'fight') return null;
  const f = s.setup;
  const bar = f.bar === 'act' ? ALL_ACTS[f.act]?.bar : f.bar;
  return { hero: f.hero, stars: f.stars, waves: f.waves.map((w) => w.slice()), act: f.act, bar, row: f.row ?? 9, safe: !!f.safe, stacks: Math.max(0, f.stacks ?? 0) };
}

/** The phase a scenario plays in: its fight, its scenes, or the camp (the engine opens the camp screen). Once the
 *  run leaves it the scenario is over (the rating card comes up). */
export const labHomePhase = (s: LabScenario): 'fight' | 'scene' | 'camp' => (s.setup.kind === 'fight' ? 'fight' : s.setup.kind === 'story' ? 'scene' : 'camp');

/** Where a scenario plays on the lab's run: its practice fight (then back to the lab's camp), its story scenes, or
 *  the lab's camp (the engine opens the camp screen). The run must be the lab's, built on labProfile. */
export function startLabScenario(run: Run, s: LabScenario, seed: number): void {
  run.campFrom = 'world';
  run.phase = 'camp';
  const f = labFight(s);
  if (f) {
    run.actIndex = f.act; // the act's stage, music and name around the fight
    run.startPractice({ hero: f.hero, stars: f.stars, waves: f.waves, act: f.act, bar: f.bar, row: f.row, safe: f.safe, then: 'camp', seed });
    // the finisher is ready to try at once
    if (f.stacks && run.combat) run.combat.bankStacks(f.stacks, 'testLab');
  } else if (s.setup.kind === 'story') run.enterAct(s.setup.act, s.setup.scenes);
}


// ---------------------------------------------------------------- the list

/** The scenarios the list shows: every group in order, the spoiler group only when spoilers are shown. */
export function labVisible(spoilers: boolean, list: LabScenario[] = [...LAB_NEW, ...LAB_EARLIER]): LabScenario[] {
  return list.filter((s) => spoilers || !s.spoiler);
}

/** Seconds the visible "New" scenarios take in all (the lab aims for about ten minutes). */
export const labMinutes = (spoilers = false): number => Math.round(labVisible(spoilers, LAB_NEW).reduce((a, s) => a + s.secs, 0) / 60);

// ---------------------------------------------------------------- ratings

export type LabRating = 'good' | 'work' | 'broken';
export const LAB_RATINGS: LabRating[] = ['good', 'work', 'broken'];
export const RATING_NAME: Record<LabRating, string> = { good: 'Good', work: 'Needs work', broken: 'Broken' };

export interface LabEntry {
  rating: LabRating;
  note: string;
  at: number;
  /** The scenario's rev when it was rated (a reworked scenario asks for a new rating). */
  rev?: number;
}

/** What the lab keeps (in its own storage key, apart from both saves): the ratings and whether spoilers show. */
export interface LabState {
  ratings: Record<string, LabEntry>;
  spoilers: boolean;
}

export const newLabState = (): LabState => ({ ratings: {}, spoilers: false });

export const NOTE_MAX = 280;

/** A saved lab state in current form (junk dropped; spoilers hidden unless it says otherwise). */
export function readLabState(data: unknown): LabState {
  const d = data as Record<string, unknown> | null;
  const st = newLabState();
  if (!d || typeof d !== 'object') return st;
  st.spoilers = d.spoilers === true;
  const r = (d.ratings ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(r)) {
    const e = r[id] as Record<string, unknown> | null;
    if (!e || !LAB_RATINGS.includes(e.rating as LabRating)) continue;
    const entry: LabEntry = { rating: e.rating as LabRating, note: typeof e.note === 'string' ? e.note.slice(0, NOTE_MAX) : '', at: typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : 0 };
    if (typeof e.rev === 'number' && Number.isFinite(e.rev) && e.rev > 0) entry.rev = Math.round(e.rev);
    st.ratings[id] = entry;
  }
  return st;
}

/** Rate a scenario (a new rating replaces the old; the note is trimmed to one short paragraph). `rev`: the
 *  scenario's rev now (labScenario(id).rev), so a later rework asks again. */
export function rateScenario(st: LabState, id: string, rating: LabRating, note = '', now = Date.now(), rev = 0): void {
  const e: LabEntry = { rating, note: note.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX), at: now };
  if (rev > 0) e.rev = rev;
  st.ratings[id] = e;
}

/** A scenario's rating, if it was given to the scenario as it is now (not to an earlier version of it). */
export function ratingOf(st: LabState, s: LabScenario): LabEntry | undefined {
  const e = st.ratings[s.id];
  return e && (e.rev ?? 0) === (s.rev ?? 0) ? e : undefined;
}

/** A rating given before the scenario was reworked (the list says "Reworked"; the report shows it as before). */
export function staleRating(st: LabState, s: LabScenario): LabEntry | undefined {
  const e = st.ratings[s.id];
  return e && (e.rev ?? 0) !== (s.rev ?? 0) ? e : undefined;
}

// ---------------------------------------------------------------- the report

/**
 * "Copy report": every rating and note, grouped like the list (spoiler items only when shown or rated), the accuracy
 * line (as the gear panel's Copy builds it) and the build label, as plain text for the planning chat.
 */
export function labReport(o: { state: LabState; accuracy: string; build: string; now?: number; scenarios?: { fresh: LabScenario[]; earlier: LabScenario[] } }): string {
  const { state } = o;
  const fresh = o.scenarios?.fresh ?? LAB_NEW;
  const earlier = o.scenarios?.earlier ?? LAB_EARLIER;
  const date = new Date(o.now ?? Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const shown = (s: LabScenario) => state.spoilers || !s.spoiler || !!state.ratings[s.id];
  const all = [...fresh, ...earlier].filter(shown);
  const rated = all.filter((s) => ratingOf(state, s));
  const count = (r: LabRating) => rated.filter((s) => ratingOf(state, s)!.rating === r).length;
  const lines: string[] = [`CQ3 Test lab report, ${date}`, `Version ${o.build}`];
  lines.push(`Rated ${rated.length} of ${all.length}: ${count('good')} good, ${count('work')} needs work, ${count('broken')} broken`);
  const row = (s: LabScenario) => {
    const e = ratingOf(state, s);
    const old = staleRating(state, s);
    const name = `${s.spoiler ? '[spoiler] ' : ''}${s.label}`;
    if (e) return `- ${name}: ${RATING_NAME[e.rating]}${e.note ? ` - "${e.note}"` : ''}`;
    return old ? `- ${name}: not tried since the rework (before: ${RATING_NAME[old.rating]}${old.note ? ` - "${old.note}"` : ''})` : `- ${name}: not tried`;
  };
  const section = (title: string, list: LabScenario[]) => {
    const items = list.filter(shown);
    if (!items.length) return;
    lines.push('', title);
    for (const g of LAB_GROUPS) {
      const inGroup = items.filter((s) => s.group === g.id);
      if (!inGroup.length) continue;
      lines.push(`${g.name}:`);
      lines.push(...inGroup.map(row));
    }
  };
  section('NEW', fresh);
  section('EARLIER', earlier);
  const hidden = [...fresh, ...earlier].filter((s) => !shown(s)).length;
  if (hidden) lines.push('', `(${hidden} spoiler items hidden, not tried)`);
  lines.push('', o.accuracy);
  return lines.join('\n');
}
