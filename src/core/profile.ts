// The player's profile, kept across runs (pure; storage.ts saves it): how far Greenmarch has been cleared, the
// regions restored (`weights`, its old name), and the gear chase: the bag, what Rowan wears, coins and scrap (both carry over
// between runs), each signature drop's bad-luck counter, and the accuracy log. M4a adds the heroes (who is picked,
// each one's XP and skills; Sable is unlocked by a scene after Act 1) and the relics unlocked so far. The tips seen
// so far ("teach it slowly", core/tips.ts), whether tips are off and what the player has done of what each teaches
// (tipsDone: a tip they've shown they know is skipped) are kept too, and the map sparkles picked up
// (core/sparkle.ts) and whether the world map's first-visit reveal has played (still v3: missing reads as none).
//
// v1 was "progress" (acts cleared and regions restored only), v2 the gear; readProfile migrates both.

import { ALL_ACTS } from '../data/regions';
import { isEditId, type EditId } from '../data/edits';
import { heroOwned, petBuilds } from './roster';
import { COMPANION_IDS, isCompanionId, type CompanionId } from '../data/companions';
import { ACHIEVEMENTS, CAMP_UPGRADE_IDS, type AchievementId, type CampUpgradeId } from '../data/meta';
import { SLOT_KEYS, slotOf, type GearRarity, type SlotKey, type StatId } from '../data/gear';
import { RELICS, isRelicId, relicById, type RelicId } from '../data/relics';
import { BASIC_TIPS, isSeenId, isTipId, WELCOME_ID, type SeenId, type TipId } from '../data/tips';
import { newAccuracyLog, readAccuracyLog, type AccuracyLog } from './accuracy';
import { readSparkles } from './sparkle';
import { HERO_IDS, actXp, isHeroId, levelFromXp, newHeroProgress, validSkills, type HeroBuild, type HeroId, type HeroProgress } from './heroes';
import {
  itemPower,
  itemStats,
  loadoutOf,
  rarityIndex,
  rerollBonus,
  rerollCost,
  salvageValue,
  slotOfItem,
  upgradeCost,
  validItem,
  zeroStats,
  type Item,
  type Loadout,
  type StatBlock,
} from './gear';
import type { Rng } from './rng';
import type { Tuning } from './tuning';

export const PROFILE_VERSION = 4;
export const WEIGHTS_TOTAL = 12;

export interface Profile {
  v: 4;
  actsCleared: number; // acts cleared at least once, counted across regions (Greenmarch 0-3, then the next region's)
  weights: number; // regions restored (a region cleared counts once; the field keeps its old name)
  coins: number; // the purse: kept between runs, spent at shops and the forge
  scrap: number; // from salvaging, spent at the forge
  items: Item[]; // the bag (equipped items included)
  equipped: Record<SlotKey, number>; // item uid per slot (0 = empty)
  nextUid: number;
  found: number; // items found so far (numbers them for "sort by new")
  blp: Record<string, number>; // per signature drop: boss kills since it last dropped
  acc: AccuracyLog;
  smithMet: boolean; // the forge's intro scene has played
  hero: HeroId; // the hero picked at the camp (they fight, and earn the XP)
  heroes: Record<HeroId, HeroProgress>; // each hero's XP and skills (gear is shared)
  relics: RelicId[]; // relics unlocked beyond the starting ones
  relicsNew: RelicId[]; // unlocked, not looked at in the relic log yet
  sableMet: boolean; // Sable's scene played (after Act 1): Sable is unlocked
  tips: SeenId[]; // tips already shown (each shows once), and the welcome back once it has played
  tipsOff: boolean; // the gear panel's "Tips: off"
  /** How many times the player has done what a tip teaches (yellows hit, reds blocked, greens hit, purples let pass,
   *  finishers fired; core/tips.ts counts them from the fight's events, up to the tip's `known`): a tip whose count has
   *  reached its `known` is skipped. Still v4: missing reads as none yet. */
  tipsDone: Partial<Record<TipId, number>>;
  sparkles: number[]; // the map sparkles picked up (core/sparkle.ts: their keys, newest last): never paid twice
  /** The Atlas pages found (src/data/atlas-pages.ts: the acts whose hidden treasure held one), in the order found.
   *  Still v4: missing reads as none. */
  pages: number[];
  worldTour: boolean; // the world map's first-visit reveal (a glide over the whole world) has played
  /** The world map's wandering foe (core/skirmish.ts): fights won since the last skirmish, skirmishes so far, and
   *  whether one is on the road now. Still v3: missing reads as none yet. */
  wander: WanderState;
  // ---- v4 (M5): heroes and companions from chests, gems, the shrine, region completion, shared progression
  neveMet: boolean; // the frost mage's scene played (after the next region's first act): she joins
  gems: number; // earned only by playing
  chests: Record<ChestKind, number>; // hero chests waiting to be opened (free)
  pity: { rare: number; top: number }; // Rare chests opened since the last Legendary+ / Celestial+ from one
  pets: Record<CompanionId, PetProgress>;
  petsOn: CompanionId[]; // the companions brought into fights (1; 2 with the Companion Perch)
  camp: CampUpgradeId[]; // camp upgrades bought
  regions: Record<string, RegionLog>; // per region: what the completion tracker counts beyond acts and bosses
  mastery: string[]; // mastery milestones reached (their rewards granted)
  achievements: AchievementId[];
  counts: Record<string, number>; // lifetime counters (holds, bounties, treasures, boss kills...)
  seen: string[]; // one-time scenes played (a chest hero's arrival)
  /** The Mapmaker's Edits (data/edits.ts): the ones drawn into the next act started, and each act's cleared under
   *  which (by global act index; their first-clear gems are paid once). Still v3: missing reads as none. */
  edits: { on: EditId[]; cleared: Record<string, EditId[]> };
  cosmetics: string[]; // camp banners
  allUnlocked: boolean; // debug: "Unlock all heroes and companions"
}

export type ChestKind = 'hero' | 'rare' | 'region';
export const CHEST_KINDS: ChestKind[] = ['hero', 'rare', 'region'];

/** A companion's progress: owned, its XP (from fights it was in), stars and shards. */
export interface PetProgress {
  owned: boolean;
  xp: number;
  stars: number;
  shards: number;
}

/** What a region's completion tracker counts besides acts and bosses (those come from actsCleared). */
export interface RegionLog {
  bounties: number[]; // acts whose bounty was finished
  treasures: number[]; // acts whose hidden treasure was found
  events: string[]; // events finished in the region
  chest: boolean; // the 100% chest was given
}

export const newRegionLog = (): RegionLog => ({ bounties: [], treasures: [], events: [], chest: false });

export interface WanderState {
  fights: number;
  n: number;
  up: boolean;
}

/** @deprecated the old name (progress across runs); a profile is a superset of it. */
export type Progress = Profile;

const noSlots = (): Record<SlotKey, number> => ({ weapon: 0, helm: 0, armor: 0, boots: 0, trinket1: 0, trinket2: 0 });

export const newHeroes = (): Record<HeroId, HeroProgress> => Object.fromEntries(HERO_IDS.map((id) => [id, newHeroProgress(id === 'rowan')])) as Record<HeroId, HeroProgress>;

export const newPets = (): Record<CompanionId, PetProgress> =>
  Object.fromEntries(COMPANION_IDS.map((id) => [id, { owned: id === 'pip', xp: 0, stars: 1, shards: 0 }])) as Record<CompanionId, PetProgress>;

export function newProfile(): Profile {
  return {
    v: 4,
    actsCleared: 0,
    weights: 0,
    coins: 0,
    scrap: 0,
    items: [],
    equipped: noSlots(),
    nextUid: 1,
    found: 0,
    blp: {},
    acc: newAccuracyLog(),
    smithMet: false,
    hero: 'rowan',
    heroes: newHeroes(),
    relics: [],
    relicsNew: [],
    sableMet: false,
    tips: [WELCOME_ID], // a new player has nothing to be welcomed back to
    tipsOff: false,
    tipsDone: {},
    sparkles: [],
    pages: [],
    worldTour: false,
    wander: { fights: 0, n: 0, up: false },
    neveMet: false,
    gems: 0,
    chests: { hero: 0, rare: 0, region: 0 },
    pity: { rare: 0, top: 0 },
    pets: newPets(),
    petsOn: ['pip'],
    camp: [],
    regions: {},
    mastery: [],
    achievements: [],
    counts: {},
    seen: [],
    edits: { on: [], cleared: {} },
    cosmetics: [],
    allUnlocked: false,
  };
}

const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo);

/**
 * A saved profile in current form: v3 is checked; v2 (gear, no heroes) and v1 (progress only) are migrated:
 * Rowan gets the XP of the acts already cleared and their relics are unlocked. Anything else starts over.
 * A profile from before the tips that has cleared an act has the basics' tips marked seen (readTips).
 */
/** The Atlas pages found, as saved: whole act numbers, each once (anything else is dropped). */
export function readPages(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const a of v) if (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < 1000 && !out.includes(a)) out.push(a);
  return out;
}

/** Keep an Atlas page found (act `act`'s): true the first time. */
export function findPage(p: Profile, act: number): boolean {
  if (p.pages.includes(act)) return false;
  p.pages.push(act);
  return true;
}

export function readProfile(data: unknown, t?: Tuning): Profile {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object' || (d.v !== 1 && d.v !== 2 && d.v !== 3 && d.v !== 4)) return newProfile();
  const p = readFields(d, t);
  readTips(p, d);
  p.sparkles = readSparkles(d.sparkles); // still v3: missing reads as none
  p.pages = readPages(d.pages); // still v4: missing reads as none found
  p.worldTour = d.worldTour === true; // still v3: missing reads as not yet (the bigger world map shows itself once)
  readV4(p, d);
  return p;
}

/**
 * v4 (M5): chests, gems, companions, camp upgrades, region logs, mastery, achievements. A v3 (or older) profile gets
 * the defaults, Pip as its companion, and Region 1's events counted from the event relics it has unlocked (the only
 * event record a v3 profile kept).
 */
function readV4(p: Profile, d: Record<string, unknown>): void {
  p.neveMet = d.neveMet === true;
  if (p.neveMet) p.heroes.neve.unlocked = true;
  p.gems = int(d.gems, 0, 1e9);
  const ch = (d.chests ?? {}) as Record<string, unknown>;
  for (const k of CHEST_KINDS) p.chests[k] = int(ch[k], 0, 1e4);
  const pity = (d.pity ?? {}) as Record<string, unknown>;
  p.pity = { rare: int(pity.rare, 0, 1e4), top: int(pity.top, 0, 1e5) };
  const pets = (d.pets ?? {}) as Record<string, unknown>;
  for (const id of COMPANION_IDS) {
    const x = (pets[id] ?? {}) as Record<string, unknown>;
    p.pets[id] = { owned: id === 'pip' || x.owned === true, xp: int(x.xp, 0, 1e9), stars: Math.max(1, int(x.stars, 1, 5)), shards: int(x.shards, 0, 1e6) };
  }
  const on = Array.isArray(d.petsOn) ? [...new Set(d.petsOn.filter((x): x is CompanionId => isCompanionId(x) && p.pets[x].owned))] : [];
  p.petsOn = on.length ? on.slice(0, 2) : ['pip'];
  p.camp = Array.isArray(d.camp) ? [...new Set(d.camp.filter((x): x is CampUpgradeId => CAMP_UPGRADE_IDS.includes(x as CampUpgradeId)))] : [];
  if (!p.camp.includes('perch')) p.petsOn = p.petsOn.slice(0, 1);
  const regs = (d.regions ?? {}) as Record<string, unknown>;
  for (const id of Object.keys(regs)) {
    const r = (regs[id] ?? {}) as Record<string, unknown>;
    const nums = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0))] : []);
    p.regions[id] = { bounties: nums(r.bounties), treasures: nums(r.treasures), events: Array.isArray(r.events) ? [...new Set(r.events.filter((x): x is string => typeof x === 'string'))] : [], chest: r.chest === true };
  }
  const strs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : []);
  p.mastery = strs(d.mastery);
  p.achievements = strs(d.achievements).filter((x): x is AchievementId => ACHIEVEMENTS.some((a) => a.id === x));
  const counts = (d.counts ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(counts)) p.counts[k] = int(counts[k], 0, 1e9);
  p.seen = strs(d.seen);
  const ed = (d.edits ?? {}) as { on?: unknown; cleared?: unknown };
  p.edits = { on: strs(ed.on).filter(isEditId), cleared: {} };
  if (ed.cleared && typeof ed.cleared === 'object')
    for (const [k, v] of Object.entries(ed.cleared as Record<string, unknown>)) if (/^\d+$/.test(k)) p.edits.cleared[k] = strs(v).filter(isEditId);
  p.cosmetics = strs(d.cosmetics);
  p.allUnlocked = d.allUnlocked === true;
  if (p.allUnlocked && isHeroId(d.hero)) p.hero = d.hero; // the debug toggle lets any hero be picked
  if (d.v !== 4) {
    // Region 1's progress counts: the events whose relic was unlocked were finished there
    const done = [...new Set(RELICS.filter((r) => r.unlock?.kind === 'event' && p.relics.includes(r.id)).map((r) => (r.unlock as { event: string }).event))];
    if (done.length) (p.regions.greenmarch ??= newRegionLog()).events = done;
  }
}

function readFields(d: Record<string, unknown>, t?: Tuning): Profile {
  const p = newProfile();
  // (a profile from before v4 only knew Greenmarch's three acts)
  p.actsCleared = int(d.actsCleared, 0, (d.v as number) < 4 ? 3 : ALL_ACTS.length);
  p.weights = int(d.weights, 0, WEIGHTS_TOTAL);
  const v = d.v as number;
  if (v < 3) migrateHeroes(p, t);
  if (d.v === 1) return p; // v1 -> v3: progress kept, the gear starts empty
  p.coins = int(d.coins, 0, 1e9);
  p.scrap = int(d.scrap, 0, 1e9);
  const seen = new Set<number>();
  p.items = (Array.isArray(d.items) ? d.items : []).filter((i): i is Item => validItem(i) && i.uid > 0 && !seen.has(i.uid) && !!seen.add(i.uid)).map((i) => ({ ...i, bonus: i.bonus.map((b) => ({ ...b })) }));
  const eq = (d.equipped ?? {}) as Record<string, unknown>;
  for (const k of SLOT_KEYS) {
    const uid = int(eq[k], 0, 1e9);
    const it = p.items.find((i) => i.uid === uid);
    p.equipped[k] = it && slotOfItem(it) === slotOf(k) ? uid : 0;
  }
  if (p.equipped.trinket1 && p.equipped.trinket1 === p.equipped.trinket2) p.equipped.trinket2 = 0;
  p.nextUid = Math.max(int(d.nextUid, 1, 1e9), ...p.items.map((i) => i.uid + 1));
  p.found = Math.max(int(d.found, 0, 1e9), ...p.items.map((i) => i.found));
  const blp = (d.blp ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(blp)) p.blp[k] = int(blp[k], 0, 1e6);
  p.acc = readAccuracyLog(d.acc);
  p.smithMet = d.smithMet === true;
  if (v < 3) return p; // v2 -> v3: the heroes and relics were filled in by migrateHeroes
  const hs = (d.heroes ?? {}) as Record<string, unknown>;
  for (const id of HERO_IDS) {
    const h = (hs[id] ?? {}) as Record<string, unknown>;
    p.heroes[id] = {
      unlocked: id === 'rowan' || h.unlocked === true,
      xp: int(h.xp, 0, 1e9),
      skills: validSkills(id, h.skills),
      stars: Math.max(1, int(h.stars, 1, 5)),
      shards: int(h.shards, 0, 1e6),
      acts: int(h.acts, 0, 1e6),
    };
  }
  p.hero = isHeroId(d.hero) && p.heroes[d.hero].unlocked ? d.hero : 'rowan';
  const ids = (v: unknown): RelicId[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is RelicId => isRelicId(x) && !!relicById(x)?.unlock))] : []);
  p.relics = ids(d.relics);
  p.relicsNew = ids(d.relicsNew).filter((id) => p.relics.includes(id));
  p.sableMet = d.sableMet === true;
  const w = (d.wander ?? {}) as Record<string, unknown>;
  p.wander = { fights: int(w.fights, 0, 1e6), n: int(w.n, 0, 1e6), up: w.up === true };
  return p;
}

/**
 * The tips seen (known ids only, once each) and whether tips are off. A profile saved before tips existed (no list)
 * comes from an earlier version: if it has cleared an act it already knows the basics (their tips are marked seen,
 * so a returning player only meets the tips for the newer systems: relics, skills, heroes), and if it has any
 * progress, the welcome back is still to play. A list that's there, even empty ("Show tips again"), is kept.
 */
function readTips(p: Profile, d: Record<string, unknown>): void {
  if (Array.isArray(d.tips)) p.tips = [...new Set(d.tips.filter(isSeenId))];
  else {
    p.tips = p.actsCleared >= 1 ? BASIC_TIPS.slice() : [];
    if (!hasProgress(p)) p.tips.push(WELCOME_ID); // nothing to come back to: no welcome back
  }
  p.tipsOff = d.tipsOff === true;
  // what the player has done of what each tip teaches (still v4: missing reads as none; known tips, small counts)
  const done = (d.tipsDone ?? {}) as Record<string, unknown>;
  if (done && typeof done === 'object')
    for (const k of Object.keys(done)) {
      const n = int(done[k], 0, 999);
      if (isTipId(k) && n > 0) p.tipsDone[k] = n;
    }
}

/** Whether the player has played before: an act cleared, any hero XP, or any gear found. */
export const hasProgress = (p: Profile): boolean => p.actsCleared >= 1 || p.found > 0 || HERO_IDS.some((id) => (p.heroes[id]?.xp ?? 0) > 0);

/** v1/v2 -> v3: Rowan earns the XP of the acts already cleared (first clears), and their act relics unlock. */
function migrateHeroes(p: Profile, t?: Tuning): void {
  if (t) for (let a = 0; a < p.actsCleared; a++) p.heroes.rowan.xp += actXp(t, a, true);
  for (const r of RELICS) if (r.unlock?.kind === 'act' && r.unlock.act < p.actsCleared) p.relics.push(r.id);
}

/** Anything a New game would erase: the title then offers Continue / New game instead of "Tap to start!". */
export function anythingToErase(p: Profile): boolean {
  return (
    p.actsCleared > 0 ||
    p.items.length > 0 ||
    p.coins > 0 ||
    p.scrap > 0 ||
    p.smithMet ||
    p.sableMet ||
    p.relics.length > 0 ||
    HERO_IDS.some((id) => (p.heroes[id]?.xp ?? 0) > 0)
  );
}

/** The title's Continue line without a run in progress: the hero's level and the acts cleared ("Lv 7 - 2 acts"). */
export function progressLabel(p: Profile, t: Tuning): string {
  const lv = levelFromXp(t, heroProgress(p).xp);
  const acts = p.actsCleared > 0 ? ` - ${p.actsCleared} act${p.actsCleared > 1 ? 's' : ''}` : '';
  return `Lv ${lv}${acts}`;
}

// ---------------------------------------------------------------- heroes

/** The picked hero's progress. */
export const heroProgress = (p: Profile, id: HeroId = p.hero): HeroProgress => p.heroes[id] ?? p.heroes.rowan;

/** Who fights, at what level, with which skills: what a fight reads from the profile (like the gear's loadout). */
export function profileBuild(p: Profile, t: Tuning, id: HeroId = p.hero): HeroBuild {
  const h = heroProgress(p, id);
  return { id: p.heroes[id] ? id : 'rowan', level: levelFromXp(t, h.xp), skills: h.skills.slice(), stars: h.stars ?? 1, pets: petBuilds(p, t) };
}

/** Pick the hero who fights next (an unlocked one, or any with the debug unlock-all toggle). */
export function selectHero(p: Profile, id: HeroId): boolean {
  if (!heroOwned(p, id)) return false;
  p.hero = id;
  return true;
}

/** Sable joins (their scene played). */
export function meetSable(p: Profile): boolean {
  if (p.sableMet) return false;
  p.sableMet = true;
  p.heroes.sable.unlocked = true;
  return true;
}

/** Neve joins (her scene played, after the next region's first act). */
export function meetNeve(p: Profile): boolean {
  if (p.neveMet) return false;
  p.neveMet = true;
  p.heroes.neve.unlocked = true;
  return true;
}

// ---------------------------------------------------------------- relics

/** Whether a relic can be offered: one from the start, or one unlocked since. */
export const relicUnlocked = (p: Profile, id: RelicId): boolean => !relicById(id)?.unlock || p.relics.includes(id);

export const unlockedRelics = (p: Profile): RelicId[] => RELICS.filter((r) => relicUnlocked(p, r.id)).map((r) => r.id);

/** Unlock a relic ("New relic unlocked!"). Returns true if it's new. */
export function unlockRelic(p: Profile, id: RelicId): boolean {
  if (!relicById(id)?.unlock || p.relics.includes(id)) return false;
  p.relics.push(id);
  p.relicsNew.push(id);
  return true;
}

/** @deprecated use newProfile / readProfile. */
export const newProgress = newProfile;
export const readProgress = readProfile;

/** Act `act` (0-based) was just cleared. Returns true if that's new. */
export function recordAct(p: Profile, act: number): boolean {
  if (act + 1 <= p.actsCleared) return false;
  p.actsCleared = act + 1;
  return true;
}

/** Region `r` (0 = Greenmarch) was cleared: it is restored (once each). */
export function recordRegion(p: Profile, r = 0): boolean {
  if (p.weights >= r + 1) return false;
  p.weights = Math.min(WEIGHTS_TOTAL, r + 1);
  return true;
}

// ---------------------------------------------------------------- the bag

export const itemByUid = (p: Profile, uid: number): Item | undefined => p.items.find((i) => i.uid === uid);

export const isEquipped = (p: Profile, uid: number): boolean => uid > 0 && SLOT_KEYS.some((k) => p.equipped[k] === uid);

/** The item worn in a slot. */
export const equippedIn = (p: Profile, k: SlotKey): Item | undefined => (p.equipped[k] ? itemByUid(p, p.equipped[k]) : undefined);

export const equippedItems = (p: Profile): Item[] => SLOT_KEYS.map((k) => equippedIn(p, k)).filter((i): i is Item => !!i);

/** What Rowan's gear adds up to. */
export const profileLoadout = (p: Profile, t: Tuning): Loadout => loadoutOf(t, equippedItems(p));

export interface AddResult {
  item: Item;
  /** Scrap it was salvaged into because the bag was full (0 = it went in the bag). */
  salvaged: number;
}

/** A drop goes in the bag (numbered); if the bag is full it is salvaged into scrap instead. */
export function addItem(p: Profile, t: Tuning, drop: Item): AddResult {
  const item: Item = { ...drop, bonus: drop.bonus.map((b) => ({ ...b })), uid: p.nextUid++, found: ++p.found, fresh: true };
  if (p.items.length >= Math.max(1, Math.round(t.gear.bagSize))) {
    const salvaged = salvageValue(t, item);
    p.scrap += salvaged;
    return { item, salvaged };
  }
  p.items.push(item);
  return { item, salvaged: 0 };
}

/**
 * Wear an item. A trinket goes in `slot` if given, else an empty trinket slot, else the first. Whatever was there
 * goes back in the bag. Returns the slot it went in (null if it can't go there).
 */
export function equip(p: Profile, uid: number, slot?: SlotKey): SlotKey | null {
  const it = itemByUid(p, uid);
  if (!it) return null;
  const kind = slotOfItem(it);
  let k: SlotKey | undefined = slot;
  if (k && slotOf(k) !== kind) return null;
  if (!k) k = kind === 'trinket' ? (p.equipped.trinket1 === uid ? 'trinket1' : p.equipped.trinket2 === uid ? 'trinket2' : !p.equipped.trinket1 ? 'trinket1' : !p.equipped.trinket2 ? 'trinket2' : 'trinket1') : kind;
  for (const s of SLOT_KEYS) if (p.equipped[s] === uid) p.equipped[s] = 0; // a trinket moving between its two slots
  p.equipped[k] = uid;
  it.fresh = false;
  return k;
}

export function unequip(p: Profile, k: SlotKey): void {
  p.equipped[k] = 0;
}

export function toggleLock(p: Profile, uid: number): boolean {
  const it = itemByUid(p, uid);
  if (!it) return false;
  it.locked = !it.locked;
  return it.locked;
}

/** Salvage one item into scrap (not a locked or equipped one). Returns the scrap gained. */
export function salvage(p: Profile, t: Tuning, uid: number): number {
  const it = itemByUid(p, uid);
  if (!it || it.locked || isEquipped(p, uid)) return 0;
  const v = salvageValue(t, it);
  p.scrap += v;
  p.items = p.items.filter((i) => i.uid !== uid);
  return v;
}

/** Salvage every unlocked, unworn item of these rarities ("salvage all Common/Uncommon"). */
export function salvageAll(p: Profile, t: Tuning, rarities: GearRarity[] = ['common', 'uncommon']): { count: number; scrap: number } {
  let count = 0;
  let scrap = 0;
  for (const it of p.items.slice()) {
    if (!rarities.includes(it.rarity) || it.locked || isEquipped(p, it.uid)) continue;
    scrap += salvage(p, t, it.uid);
    count++;
  }
  return { count, scrap };
}

export type ForgeFail = 'max' | 'scrap' | 'coins' | 'none';

/** Forge an item one level up (+1), paying scrap and coins. */
export function upgrade(p: Profile, t: Tuning, uid: number): ForgeFail | 'ok' {
  const it = itemByUid(p, uid);
  if (!it) return 'none';
  const c = upgradeCost(t, it);
  if (!c) return 'max';
  if (p.scrap < c.scrap) return 'scrap';
  if (p.coins < c.coins) return 'coins';
  p.scrap -= c.scrap;
  p.coins -= c.coins;
  it.plus++;
  return 'ok';
}

/** Reroll one bonus stat for coins (the price doubles with each reroll on the item). */
export function reroll(p: Profile, t: Tuning, uid: number, line: number, rng: Rng): ForgeFail | 'ok' {
  const it = itemByUid(p, uid);
  if (!it || !it.bonus[line]) return 'none';
  const c = rerollCost(t, it);
  if (p.coins < c) return 'coins';
  if (!rerollBonus(rng, it, line)) return 'none';
  p.coins -= c;
  it.rerolls++;
  return 'ok';
}

export type SortMode = 'rarity' | 'slot' | 'new';
const SLOT_ORDER = ['weapon', 'helm', 'armor', 'boots', 'trinket'];

/** The bag in display order. */
export function sortItems(t: Tuning, items: Item[], mode: SortMode): Item[] {
  const power = new Map(items.map((i) => [i.uid, itemPower(t, i)]));
  const byRarity = (a: Item, b: Item) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || power.get(b.uid)! - power.get(a.uid)! || b.found - a.found;
  return items.slice().sort((a, b) => {
    if (mode === 'new') return Number(b.fresh) - Number(a.fresh) || b.found - a.found;
    if (mode === 'slot') return SLOT_ORDER.indexOf(slotOfItem(a)) - SLOT_ORDER.indexOf(slotOfItem(b)) || byRarity(a, b);
    return byRarity(a, b);
  });
}

/** The worn item an item would replace: its slot's, or for a trinket the weaker of the two (an empty slot first). */
export function replaces(p: Profile, t: Tuning, item: Item): { slot: SlotKey; item: Item | undefined } {
  const kind = slotOfItem(item);
  if (kind !== 'trinket') return { slot: kind, item: equippedIn(p, kind) };
  for (const k of ['trinket1', 'trinket2'] as SlotKey[]) if (p.equipped[k] === item.uid) return { slot: k, item };
  const a = equippedIn(p, 'trinket1');
  const b = equippedIn(p, 'trinket2');
  if (!a) return { slot: 'trinket1', item: undefined };
  if (!b) return { slot: 'trinket2', item: undefined };
  return itemPower(t, a) <= itemPower(t, b) ? { slot: 'trinket1', item: a } : { slot: 'trinket2', item: b };
}

/** Stat changes if `item` replaced what it would replace (green up, red down in the bag's compare panel). */
export function compareStats(p: Profile, t: Tuning, item: Item): Array<{ stat: StatId; delta: number }> {
  const cur = replaces(p, t, item).item;
  const now: StatBlock = cur ? itemStats(t, cur) : zeroStats();
  const next = itemStats(t, item);
  return (Object.keys(next) as StatId[]).map((stat) => ({ stat, delta: next[stat] - now[stat] })).filter((d) => Math.abs(d.delta) > 1e-9);
}
