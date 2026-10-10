// The Test lab (pure; no DOM): each scenario's profile, built fresh on the lab's own save (never the real profile),
// its practice fight or story, the ratings the playtester gives (Good / Needs work / Broken and a short note) and the
// plain-text report for the planning chat. The scenarios are data (src/data/lab.ts); the list, the rating card and
// the storage switch are engine/lab.ts and engine/storage.ts.

import { BASE_BY_ID, SLOT_KEYS, type SlotKey } from '../data/gear';
import { HERO_IDS, type HeroId } from '../data/heroes';
import { COMPANION_IDS, type CompanionId } from '../data/companions';
import { EVENTS } from '../data/events';
import { FINISHER_REVEAL, revealKey, TIPS } from '../data/tips';
import { LAB_EARLIER, LAB_GROUPS, LAB_NEW, type LabScenario } from '../data/lab';
import { ALL_ACTS, REGIONS } from '../data/regions';
import type { RelicId } from '../data/relics';
import type { BarRules } from '../data/types';
import type { Combat } from './combat';
import type { Tier } from '../data/rarity';
import { itemLevel, makeItem } from './gear';
import { nodeAt, xpForLevel } from './heroes';
import { addItem, equip, newProfile, newRegionLog, type Profile } from './profile';
import { Rng } from './rng';
import { shardsToNext } from './roster';
import { unveilKey } from './world-plan';
import type { Run } from './run';
import type { Tuning } from './tuning';

/** A hero's level when they enter act `act` on a typical first playthrough (Greenmarch ends around 9). */
export const labLevel = (act: number): number => Math.max(1, Math.min(30, 3 + 2 * Math.max(0, act)));

/** The act a scenario plays at (a camp screen: the last act its profile has cleared). */
export function labAct(s: LabScenario): number {
  if (s.setup.kind === 'fight' || s.setup.kind === 'story' || s.setup.kind === 'map' || s.setup.kind === 'gallery') return s.setup.act;
  return Math.max(0, (s.profile?.actsCleared ?? 0) - 1);
}

/** What every lab profile starts from: the story heroes met, the smith met, tips off, the world map's reveals seen (its
 *  first glide, and every later region's unveiling: the lab never glides the view over a secret land). */
export function labBaseProfile(): Profile {
  const p = newProfile();
  p.tipsOff = true;
  p.worldTour = true;
  // (and the later regions' camp tales: they'd play over any lab screen that opens the camp's view, fights too)
  p.seen = [...REGIONS.slice(1).map((r) => unveilKey(r.id)), ...HERO_IDS.map(revealKey), 'magsTale', 'duskCamp'];
  p.smithMet = true;
  p.sableMet = true;
  p.heroes.sable.unlocked = true;
  return p;
}

// a Rare piece per slot, Region 1 bases only (the bag never shows a secret item)
const KIT: Record<SlotKey, string> = { weapon: 'hedgeSaber', helm: 'leatherCap', armor: 'paddedVest', boots: 'wornBoots', trinket1: 'emberLocket', trinket2: 'whetstone' };

/** Dress the profile in a kit of `rarity` (Rare unless a scenario asks for better) at act `act`'s item level (seeded:
 *  the same kit every time). */
function giveKit(p: Profile, t: Tuning, act: number, rarity: Tier = 'rare'): void {
  const rng = new Rng(0x1ab5eed + act * 7919);
  const ilvl = itemLevel(t, act, 3);
  for (const k of SLOT_KEYS) {
    const base = BASE_BY_ID[KIT[k]];
    if (!base) continue;
    const { item, salvaged } = addItem(p, t, makeItem(rng, base, rarity, ilvl));
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
  // (the Finisher gallery shows every hero)
  if (s.setup.kind === 'gallery') for (const id of HERO_IDS) p.heroes[id].unlocked = true;
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
  const pick = spec.hero ?? (s.setup.kind === 'fight' ? s.setup.hero : s.setup.kind === 'camp' || s.setup.kind === 'gallery' || s.setup.kind === 'title' ? s.setup.hero : undefined);
  if (pick && p.heroes[pick].unlocked) p.hero = pick;
  // companions: Pip always, the listed ones, all at a level that fits
  for (const id of spec.pets ?? []) p.pets[id].owned = true;
  for (const id of COMPANION_IDS) if (p.pets[id].owned) p.pets[id].xp = xpForLevel(t, Math.max(1, Math.round(spec.petLevels?.[id] ?? level / 2)));
  // their stars as listed, the shards part way to the next star (so its meter shows)
  for (const [id, stars] of Object.entries(spec.petStars ?? {}) as Array<[CompanionId, number]>) {
    const x = p.pets[id];
    if (!x.owned) continue;
    x.stars = Math.max(1, Math.min(5, Math.round(stars)));
    const need = shardsToNext(t, x.stars);
    x.shards = need === null ? 0 : Math.floor(need * [0.3, 0.55, 0.8][x.stars % 3]);
  }
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
    // Region 1 (every region for 'all') with every bounty, treasure and event logged; 'done': its boss beaten too,
    // 'near': the boss still to go (so the next region isn't reached: its name stays "???" on the progress screen);
    // 'all': everything unlocked (every act cleared, every hero and companion)
    const all = spec.completion === 'all';
    for (const def of all ? REGIONS : REGIONS.slice(0, 1)) {
      const log = newRegionLog();
      const n = def.acts.length;
      log.bounties = Array.from({ length: n }, (_, i) => i);
      log.treasures = Array.from({ length: n }, (_, i) => i);
      log.events = EVENTS.slice(0, 3).map((e) => e.id);
      p.regions[def.id] = log;
    }
    const n = REGIONS[0].acts.length;
    p.actsCleared = all ? ALL_ACTS.length : spec.completion === 'done' ? Math.max(p.actsCleared, n) : n - 1;
    p.weights = all ? REGIONS.length : spec.completion === 'done' ? 1 : 0;
    if (all) {
      p.neveMet = true;
      p.heroes.neve.unlocked = true;
      p.allUnlocked = true;
    }
  }
  if (spec.tips?.length) {
    // these tips still to show (a hero's how-to card), every other one seen: tips on
    p.tipsOff = false;
    p.tips = TIPS.map((d) => d.id).filter((id) => !spec.tips!.includes(id));
    // a scenario that teaches the finisher plays the first finisher's reveal too
    if (spec.tips.includes('finisher')) p.seen = p.seen.filter((k) => k !== FINISHER_REVEAL);
  }
  giveKit(p, t, act, spec.gear);
  return p;
}

// ---------------------------------------------------------------- what a scenario plays

/** A fight scenario's practice fight (run.startPractice's options), plus the finisher stacks banked at the start. */
export interface LabFightPlan {
  hero: HeroId;
  stars?: number;
  waves: string[][];
  act: number;
  /** The act whose stage, music and name show around the fight. */
  stage: number;
  bar?: BarRules;
  row: number;
  safe: boolean;
  stacks: number;
  /** Relics carried into the fight, and whether a won fight ends in a stat card pick. */
  relics: RelicId[];
  pick?: boolean;
}

export function labFight(s: LabScenario): LabFightPlan | null {
  if (s.setup.kind !== 'fight') return null;
  const f = s.setup;
  const bar = f.bar === 'act' ? ALL_ACTS[f.act]?.bar : f.bar;
  return { hero: f.hero, stars: f.stars, waves: f.waves.map((w) => w.slice()), act: f.act, stage: f.stage ?? f.act, bar, row: f.row ?? 9, safe: !!f.safe, stacks: Math.max(0, f.stacks ?? 0), relics: (f.relics ?? []).slice(), pick: !!f.pick };
}

/** The phase a scenario plays in: its fight (the Finisher gallery's too), its scenes, an act's map, or the camp (the
 *  engine opens the camp screen). Once the run leaves it the scenario is over (the rating card comes up). */
export const labHomePhase = (s: LabScenario): 'fight' | 'scene' | 'map' | 'camp' | 'title' =>
  s.setup.kind === 'fight' || s.setup.kind === 'gallery' ? 'fight' : s.setup.kind === 'story' ? 'scene' : s.setup.kind === 'map' ? 'map' : s.setup.kind === 'title' ? 'title' : 'camp';

/** Where a scenario plays on the lab's run: its practice fight (then back to the lab's camp), its story scenes, an
 *  act's map, or the lab's camp (the engine opens the camp screen). The run must be the lab's, built on labProfile. */
export function startLabScenario(run: Run, s: LabScenario, seed: number): void {
  run.campFrom = 'world';
  run.phase = 'camp';
  const f = labFight(s);
  if (f) {
    run.startPractice({ hero: f.hero, stars: f.stars, waves: f.waves, act: f.act, bar: f.bar, row: f.row, safe: f.safe, then: 'camp', seed, relics: f.relics.length ? f.relics : undefined, pick: f.pick });
    run.actIndex = f.stage; // the act's stage, music and name around the fight
    // the finisher is ready to try at once
    if (f.stacks && run.combat) run.combat.bankStacks(f.stacks, 'testLab');
  } else if (s.setup.kind === 'gallery') galleryFight(run, s, s.setup.hero ?? galleryHeroes()[0], seed);
  else if (s.setup.kind === 'story') run.enterAct(s.setup.act, s.setup.scenes);
  else if (s.setup.kind === 'map') run.enterAct(s.setup.act);
  else if (s.setup.kind === 'title') run.phase = 'title';
}

// ---------------------------------------------------------------- the Finisher gallery

/** Every hero the gallery offers: all of them (a hero added to HEROES shows up here by itself). */
export const galleryHeroes = (): HeroId[] => HERO_IDS.slice();

/**
 * The gallery's stage for one hero: a practice fight against the scenario's foes that never plays on its own (no
 * blocks come, the foes use no specials, nothing hurts the hero; the engine holds its clock between shows). Called
 * again to switch heroes (a fresh fight as that hero: their own finisher hooks).
 */
export function galleryFight(run: Run, s: LabScenario, hero: HeroId, seed: number): void {
  if (s.setup.kind !== 'gallery') return;
  const g = s.setup;
  run.actIndex = g.act;
  run.startPractice({ hero, stars: 1, waves: [g.foes.slice()], act: g.act, row: 3, safe: true, then: 'camp', seed });
  const c = run.combat;
  if (!c) return;
  c.spawning = false;
  c.specialsOn = false;
  for (const b of c.blocks.slice()) c.removeBlock(b, 'expire');
  c.drainEvents(); // (its opening blocks never showed)
}

/**
 * Before each Play: the bar cleared, then two reds and a yellow put on it (to see what this finisher does to them),
 * every foe at full health with far more than the finisher deals (nobody dies), `stacks` banked (1 to max). Returns
 * whether the finisher can fire.
 */
export function galleryArm(c: Combat, stacks: number): boolean {
  for (const b of c.blocks.slice()) c.removeBlock(b, 'expire');
  const foes = c.enemies.filter((e) => e.alive);
  if (!foes.length) return false;
  const n = Math.max(1, Math.min(c.maxStacks(), Math.round(stacks)));
  const dmg = Math.max(1, c.finisherDamage(n));
  for (const e of foes) {
    e.maxHp = Math.max(e.maxHp, dmg * 8);
    e.hp = e.maxHp;
  }
  c.spawnBlock('yellow', 0.3);
  c.spawnBlock('red', 0.55, foes[0].id);
  c.spawnBlock('red', 0.8, foes[foes.length - 1].id);
  c.stacks = n;
  c.meter = 0;
  return c.finisherReady;
}

/** After a show: the foes healed back to full (the gallery never wears them down). */
export function galleryRest(c: Combat): void {
  for (const e of c.enemies) if (e.alive) e.hp = e.maxHp;
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
