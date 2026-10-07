// Region flow (pure; no Phaser): Greenmarch's three acts, each a branching node map (fights, elites, treasure,
// rests, shops, events) ending in a mini-boss or the boss; boosts, gear drops, coins, story scenes, revive and retry.
// Dying sends you back to the act's start with the hero as they entered it (the gear and coins found are kept).
// Between acts (and from the world map) Rowan can visit the camp; cleared acts can be replayed for their drops.
// M4a: the pick after a fight offers mostly relics (core/relics.ts) plus at most one stat card; relics carry and
// reset like boosts. The hero who fights (Rowan or Sable) earns XP from kills and act clears (core/heroes.ts).
// Map content (core/roam.ts): wandering packs (meeting one is an ambush: its foes as extra waves, a better reward)
// and a travelling merchant (her small shop) roam each act map; a Coin Rush stop (the mini-game: core/combat.ts rush
// mode), a bounty board (a side quest for the act: core/quests.ts) and a secret cache beside one node. Between runs,
// the world map's wandering foe offers a bonus skirmish (core/skirmish.ts).

import { eventById } from '../data/events';
import { CAMPAIGN, REGIONS, actInRegion, lastActOfRegion, regionOfAct } from '../data/regions';
import { questById, type QuestId } from '../data/quests';
import type { ActDef, BarRules, EventOutcome, RegionDef } from '../data/types';
import { HEROES, type HeroId } from '../data/heroes';
import type { PetBuild } from './roster';
import { RELICS, relicById, type RelicId } from '../data/relics';
import { skillById } from '../data/skills';
import { recordActAccuracy, addSamples, type AccEntry } from './accuracy';
import { Combat, heroMaxHp, heroStats, killCoins, newHero, type Hero, type SavedFoe } from './combat';
import { itemLevel, rollDrops, rollItem, setPieces, type Item, type Loadout } from './gear';
import { actXp, addXp, defaultBuild, killXp, type HeroBuild } from './heroes';
import { actSeed, buildActMap, type ActMap, type MapNode } from './map';
import { addItem, heroProgress, meetNeve, meetSable, newProfile, profileBuild, profileLoadout, recordAct, recordRegion, unlockedRelics, unlockRelic, type ChestKind, type Profile } from './profile';
import { claimRegionReward, logBounty, logEvent, logTreasure } from './completion';
import { awardGems, bump, checkAchievements, checkMastery, hasCamp, type FeatCtx } from './meta';
import { addPetXp, ownedHeroes } from './roster';
import type { AchievementDef, MasteryDef } from '../data/meta';
import { newQuest, questFor, questProgress, type QuestState } from './quests';
import { relicNumber, rollRelics, unlocksFor } from './relics';
import { Rng } from './rng';
import { actMap, ambushWaves, roamAt, type MapExtras, type RoamState } from './roam';
import { noteFightWon, skirmishFor, useWanderer, wanderUp, type Skirmish } from './skirmish';
import type { ActScale, Settings, Tuning } from './tuning';

export type Phase =
  | 'title'
  | 'world'
  | 'camp'
  | 'scene'
  | 'map'
  | 'fight'
  | 'loot'
  | 'boost'
  | 'treasure'
  | 'rest'
  | 'shop'
  | 'event'
  | 'bounty'
  | 'actClear'
  | 'defeat'
  | 'victory';
/** Where the camp was opened from (and goes back to): the world map, an act clear, a defeat, or the act map mid-act. */
export type CampFrom = 'world' | 'actClear' | 'defeat' | 'map';
/** Where a run of story scenes leads. */
export type SceneThen = 'map' | 'fight' | 'victory';
/** Where the loot and the 1-of-3 pick lead: the map, the act clear, the node's own stop (after an ambush on a
 *  non-fight node), or the world map (after a skirmish: no pick). */
export type PickThen = 'map' | 'actClear' | 'node' | 'world';
export const PICK_THENS: PickThen[] = ['map', 'actClear', 'node', 'world'];

/** An ambush being fought: the pack met, the fight's waves, and whether the node's own stop opens after it. */
export interface Ambush {
  roamer: number;
  waves: string[][];
  then: 'map' | 'node';
}

/** A secret cache is a treasure chest (`secret`: the richer one, with a pick of every relic). */
export interface TreasureState {
  coins: number;
  opened: boolean;
  secret?: boolean;
}

export type BoostId = 'maxHp' | 'damage' | 'crit' | 'critDmg' | 'comboPower' | 'pet' | 'heal';
export const BOOST_IDS: BoostId[] = ['maxHp', 'damage', 'crit', 'critDmg', 'comboPower', 'pet', 'heal'];

/** Boost cards come in three strengths: common (green), rare (blue, x2) and epic (gold, x3). */
export type Rarity = 'common' | 'rare' | 'epic';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];

/** A card in the 1-of-3 pick (or the shop): a stat card (id = a BoostId), or a relic (id = 'relic'). */
export interface BoostOffer {
  id: BoostId | 'relic';
  rarity: Rarity;
  relic?: RelicId; // id === 'relic'
}

export const isRelicOffer = (o: BoostOffer): o is BoostOffer & { id: 'relic'; relic: RelicId } => o.id === 'relic' && !!o.relic;

/** How many times stronger than common a card of this rarity is. */
export function rarityMult(t: Tuning, r: Rarity): number {
  return r === 'epic' ? t.boosts.epicMult : r === 'rare' ? t.boosts.rareMult : 1;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Max HP a Full Heal card adds on top of the heal (rare and epic only). */
const healBonusHp = (t: Tuning, r: Rarity) => Math.round(t.boosts.maxHp * (rarityMult(t, r) - 1) * 0.5);

export function boostLabel(t: Tuning, o: BoostOffer): [string, string] {
  const b = t.boosts;
  const m = rarityMult(t, o.rarity);
  switch (o.id) {
    case 'relic':
      return [relicById(o.relic ?? '')?.name ?? 'Relic', ''];
    case 'maxHp':
      return ['Max HP', `+${Math.round(b.maxHp * m)}`];
    case 'damage':
      return ['Damage', `+${Math.round(b.damage * m * 100)}%`];
    case 'crit':
      return ['Crit Chance', `+${Math.round(b.crit * m * 100)}%`];
    case 'critDmg':
      return ['Crit Damage', `+${round1(b.critDmg * m)}x`];
    case 'comboPower':
      return ['Combo Power', `+${round1(b.comboPower * m)}`];
    case 'pet':
      return ['Companion Power', `+${Math.round(b.pet * m)}`];
    case 'heal':
      return ['Full Heal', o.rarity === 'common' ? 'HP to max' : `+${healBonusHp(t, o.rarity)} max HP`];
  }
}

export function applyBoost(t: Tuning, h: Hero, o: BoostOffer): void {
  const b = t.boosts;
  const m = rarityMult(t, o.rarity);
  switch (o.id) {
    case 'relic':
      // a new array: the act-start checkpoint shares the old one
      if (o.relic && !h.relics.includes(o.relic)) h.relics = [...h.relics, o.relic];
      break;
    case 'maxHp':
      h.bonusMaxHp += Math.round(b.maxHp * m);
      h.hp += Math.round(b.maxHp * m);
      break;
    case 'damage':
      h.bonusDmg += b.damage * m;
      break;
    case 'crit':
      h.bonusCrit += b.crit * m;
      break;
    case 'critDmg':
      h.bonusCritDmg += b.critDmg * m;
      break;
    case 'comboPower':
      h.bonusComboPower += b.comboPower * m;
      break;
    case 'pet':
      h.bonusPet += Math.round(b.pet * m);
      break;
    case 'heal':
      h.bonusMaxHp += healBonusHp(t, o.rarity);
      h.hp = heroMaxHp(t, h);
      break;
  }
  h.hp = Math.min(h.hp, heroMaxHp(t, h));
}

/** What a boost card changes, as the card shows it: "ATK 14 -> 16". */
export interface BoostPreview {
  stat: string;
  before: string;
  after: string;
}

/** Whole numbers, unless that would hide the change (then one decimal). */
function pair(a: number, b: number, fmt: (v: string) => string = (v) => v): [string, string] {
  const r0 = Math.round(a);
  const r1 = Math.round(b);
  if (r0 !== r1 || Math.abs(b - a) < 1e-9) return [fmt(`${r0}`), fmt(`${r1}`)];
  const d = (v: number) => `${Math.round(v * 10) / 10}`;
  return [fmt(d(a)), fmt(d(b))];
}

/**
 * The stat a boost card changes, before and after picking it, computed from the hero's real stats (heroStats, gear
 * included) on a copy with the boost applied. Full Heal shows HP (it heals to the new max).
 */
export function boostPreview(t: Tuning, hero: Hero, offer: BoostOffer): BoostPreview {
  const after: Hero = { ...hero };
  applyBoost(t, after, offer);
  const s0 = heroStats(t, hero);
  const s1 = heroStats(t, after);
  const one = (v: number) => `${Math.round(v * 10) / 10}`;
  switch (offer.id) {
    case 'relic':
      return { stat: '', before: '', after: '' }; // a relic changes a rule, not a stat (the card shows its text)
    case 'maxHp': {
      const [a, b] = pair(s0.hp, s1.hp);
      return { stat: 'Max HP', before: a, after: b };
    }
    case 'damage': {
      const [a, b] = pair(s0.atk, s1.atk);
      return { stat: 'ATK', before: a, after: b };
    }
    case 'crit': {
      const [a, b] = pair(s0.critChance * 100, s1.critChance * 100, (v) => `${v}%`);
      return { stat: 'Crit', before: a, after: b };
    }
    case 'critDmg':
      return { stat: 'Crit dmg', before: `x${s0.critDmg.toFixed(1)}`, after: `x${s1.critDmg.toFixed(1)}` };
    case 'comboPower':
      return { stat: 'Combo', before: one(s0.comboPower), after: one(s1.comboPower) };
    case 'pet': {
      const [a, b] = pair(s0.companion, s1.companion);
      return { stat: 'Companion', before: a, after: b };
    }
    case 'heal':
      return { stat: 'HP', before: `${hero.hp}`, after: `${after.hp}` };
  }
}

/**
 * A stat skill node's change, as the skill screen shows it ("ATK 12 -> 13"), from the hero's real stats with and
 * without it. Pass the hero with the build of the tree being looked at ({ ...run.hero, build: profileBuild(p, t, id) }).
 * Null for rule nodes (they show their before/after text: heroes.ts skillPreview).
 */
export function skillStatPreview(t: Tuning, hero: Hero, nodeId: string): BoostPreview | null {
  const node = skillById(nodeId);
  if (!node || node.kind !== 'stat' || !node.stat) return null;
  const learned = hero.build.skills.includes(nodeId);
  const without: Hero = { ...hero, build: { ...hero.build, skills: hero.build.skills.filter((id) => id !== nodeId) } };
  const withIt: Hero = { ...hero, build: { ...hero.build, skills: learned ? hero.build.skills.slice() : [...hero.build.skills, nodeId] } };
  const s0 = heroStats(t, without);
  const s1 = heroStats(t, withIt);
  switch (node.stat) {
    case 'atkPct': {
      const [a, b] = pair(s0.atk, s1.atk);
      return { stat: 'ATK', before: a, after: b };
    }
    case 'critChance': {
      const [a, b] = pair(s0.critChance * 100, s1.critChance * 100, (v) => `${v}%`);
      return { stat: 'Crit', before: a, after: b };
    }
    case 'hpPct': {
      const [a, b] = pair(s0.hp, s1.hp);
      return { stat: 'Max HP', before: a, after: b };
    }
    case 'def': {
      const [a, b] = pair(s0.def, s1.def);
      return { stat: 'DEF', before: a, after: b };
    }
    case 'meterGain': {
      const [a, b] = pair(s0.meterGain * 100, s1.meterGain * 100, (v) => `+${v}%`);
      return { stat: 'Meter', before: a, after: b };
    }
    case 'comboPower':
      return { stat: 'Combo', before: `${Math.round(s0.comboPower * 10) / 10}`, after: `${Math.round(s1.comboPower * 10) / 10}` };
  }
}

/**
 * Three different boosts, each rolled common, rare or epic (tuning boosts.rareChance / epicChance).
 * `min` (an elite, a boss, a treasure chest) upgrades one card if none came up at least that rare
 * (true = rare).
 */
export function rollBoosts(rng: Rng, t: Tuning, min: boolean | Rarity = false, n = 3): BoostOffer[] {
  const pool = BOOST_IDS.slice();
  const out: BoostOffer[] = [];
  while (out.length < n && pool.length) {
    const id = pool.splice(rng.int(pool.length), 1)[0];
    const r = rng.next();
    const rarity: Rarity = r < t.boosts.epicChance ? 'epic' : r < t.boosts.epicChance + t.boosts.rareChance ? 'rare' : 'common';
    out.push({ id, rarity });
  }
  const want: Rarity = min === true ? 'rare' : min === false ? 'common' : min;
  const rank = (r: Rarity) => RARITIES.indexOf(r);
  if (out.length && !out.some((o) => rank(o.rarity) >= rank(want))) out[rng.int(out.length)].rarity = want;
  return out;
}

/**
 * The 1-of-3 pick: mostly relics (unlocked, not owned; leaning toward your tags), plus at most one stat card
 * (tuning.relics.statCard). `min` (elites, bosses, treasure) makes one card at least that rare (a stat card of that
 * rarity when no relic that rare is left to offer). `relicsOnly`: no stat card (a replay's starting picks). Stat cards
 * fill in when the relics run out.
 */
export function rollPick(rng: Rng, t: Tuning, pool: readonly RelicId[], owned: readonly RelicId[], min: boolean | Rarity = false, o: { n?: number; relicsOnly?: boolean } = {}): BoostOffer[] {
  const n = o.n ?? 3;
  const want: Rarity = min === true ? 'rare' : min === false ? 'common' : min;
  const meets = (x: BoostOffer) => RARITIES.indexOf(x.rarity) >= RARITIES.indexOf(want);
  const stat = !o.relicsOnly && rng.next() < t.relics.statCard ? 1 : 0;
  const relics = t.relics.on ? rollRelics(rng, t, pool, owned, n - stat, want === 'common' ? undefined : want) : [];
  const out: BoostOffer[] = relics.map((id) => ({ id: 'relic', rarity: relicById(id)!.rarity, relic: id }));
  // no relic that rare to offer: a stat card of that rarity takes a relic's place
  if (!o.relicsOnly && !stat && out.length && !out.some(meets)) out.splice(rng.int(out.length), 1);
  const stats = n - out.length;
  if (stats > 0) {
    const cards = rollBoosts(rng, t, out.some(meets) ? false : want, stats);
    // the stat card goes in a random spot
    for (const c of cards) out.splice(rng.int(out.length + 1), 0, c);
  }
  return out;
}

/** What a shop sells: three cards (relics and at most one stat card), a potion, and a reroll of the next pick. */
export interface ShopItem {
  kind: 'boost' | 'potion' | 'reroll';
  offer: BoostOffer | null;
  price: number;
  sold: boolean;
}

/** An event node in progress: still choosing (outcome -1), or showing what happened. */
export interface EventState {
  id: string;
  choice: number;
  outcome: number;
  boost: Rarity | null; // a boost pick follows
}

export function cardPrice(t: Tuning, r: Rarity): number {
  return r === 'epic' ? t.map.priceEpic : r === 'rare' ? t.map.priceRare : t.map.priceCommon;
}

/**
 * A hero who has fought through `act` acts: the boosts and kill gains a typical run has by then (tuning.kit, measured
 * with the bot), plus `gear`. Replaying a cleared act starts with it; so does the debug panel's "Jump to".
 */
export function heroFor(t: Tuning, act: number, gear?: Loadout, build: HeroBuild = defaultBuild()): Hero {
  const h = newHero(t, gear, build);
  const K = t.kit;
  h.bonusAtk += K.atk * act;
  h.bonusMaxHp += Math.round(K.maxHp * act);
  h.bonusDmg += K.dmg * act;
  h.bonusCrit += K.crit * act;
  h.bonusCritDmg += K.critDmg * act;
  h.bonusComboPower += K.comboPower * act;
  h.bonusPet += Math.round(K.pet * act);
  h.hp = heroMaxHp(t, h);
  return h;
}

export class Run {
  phase: Phase = 'title';
  /** Every region's acts in one list (acts are numbered globally: Greenmarch 0-2, the next region 3-5...). */
  readonly region: RegionDef = CAMPAIGN;
  actIndex = 0;
  map: ActMap;
  /** Node ids visited in this act, from row 0 (the last one is where Rowan is). */
  path: number[] = [];
  hero: Hero;
  /** The hero as they entered the current act: dying starts the act over from here. */
  actHero: Hero;
  combat: Combat | null = null;
  /** The current fight's seed (saved, so a resumed fight plays out the same way). */
  fightSeed = 0;
  boostChoices: BoostOffer[] = [];
  /** The rarity the current boost pick guarantees (true = rare), and where it leads. */
  boostMin: boolean | Rarity = false;
  boostThen: PickThen = 'map';
  /** Items just found (the loot screen shows them), scrap from any the full bag salvaged, and the boost pick after. */
  loot: Item[] = [];
  lootSalvaged = 0;
  /** The profile (kept across runs): the purse, the bag, the gear worn, progress, the accuracy log. */
  profile: Profile;
  /** Where the camp goes back to. */
  campFrom: CampFrom = 'world';
  /** Timing errors of this act's taps at yellows (its accuracy on the act-clear screen), and the act's entry. */
  actAims: number[] = [];
  actAccuracy: AccEntry | null = null;
  /** Rerolls bought at shops, spent on a boost pick. */
  rerolls = 0;
  /** The camp's Reroll Charm: a free reroll this act. The Lucky Stone: its four-card pick used this act. */
  freeReroll = false;
  luckyUsed = false;

  /** Rerolls the pick on screen can use (bought ones and the Reroll Charm's). */
  get rerollsLeft(): number {
    return this.rerolls + (this.freeReroll ? 1 : 0);
  }

  /** The camp's Map Table: every act map shows where its hidden treasure is. */
  get treasureShown(): boolean {
    return hasCamp(this.profile, 'mapTable');
  }
  actRerolls = 0;
  /** Coins spent in this act on what a defeat undoes (shop buys, event costs): a retry refunds them. */
  actSpent = 0;
  shop: ShopItem[] = [];
  event: EventState | null = null;
  treasure: TreasureState | null = null;
  /** This act's map content (core/roam.ts): its Coin Rush and bounty stops, the secret, who roams. Null: an act begun
   *  before there was any (a save from an older build), which has none. */
  extras: MapExtras | null = null;
  /** The side quest taken at this act's bounty board (null: none). */
  quest: QuestState | null = null;
  /** The act's secret cache was opened. */
  secretFound = false;
  /** The ambush being fought (or whose reward is on screen). */
  ambush: Ambush | null = null;
  /** The shop on screen is the travelling merchant's (leaving it opens the node). */
  merchant = false;
  /** Relic picks still to come after the one on screen (a bounty paid in relics). */
  bonusPicks = 0;
  /** What the pick on screen is: a secret cache's (every relic, locked ones too: the one picked unlocks), a bounty's
   *  reward (relics only), or the usual one (null). */
  pickKind: 'secret' | 'bounty' | null = null;
  /** A bounty was just met (the map shows it once; the view empties it). */
  questDone: QuestId | null = null;
  /** The world map's skirmish being fought, and the run as it was before it (put back after). */
  skirmish: { foe: Skirmish; hero: Hero; act: number; map: ActMap; path: number[]; extras: MapExtras | null } | null = null;
  private roamCache: { key: string; state: RoamState } | null = null;
  /** A replayed act starts with relic picks (tuning.kit.relicPicks per act behind): how many are left, of how many. */
  startPicks = 0;
  startPicksTotal = 0;
  /** Relics unlocked since the screen last showed it ("New relic unlocked!"); the view empties it. */
  newRelics: RelicId[] = [];
  /** XP the fighting hero earned in the current act, and levels gained not yet shown ("Level up!"). */
  actXpGained = 0;
  levelUps = 0;
  /** Coins spent in this shop visit (Haggler: the first thing bought is free). */
  shopBuys = 0;
  /** Story scenes still to show (the first is on screen), then where they lead. */
  sceneQueue: string[] = [];
  sceneThen: SceneThen = 'map';
  /** Seed of the region's maps (each act's map is built from it). */
  mapSeed: number;
  private rng: Rng;
  private seed: number;

  constructor(
    readonly tuning: Tuning,
    readonly settings: Settings,
    seed = 1,
    profile: Profile = newProfile(),
  ) {
    this.profile = profile;
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed ^ 0xa5a5a5);
    this.mapSeed = (Math.imul(this.seed, 0x9e3779b1) ^ 0x1234567) >>> 0;
    this.hero = newHero(tuning, profileLoadout(profile, tuning), profileBuild(profile, tuning));
    this.actHero = { ...this.hero };
    this.map = buildActMap(this.region.acts[0], this.mapSeedFor(0));
  }

  get act(): ActDef {
    return this.region.acts[this.actIndex];
  }

  /** The region the current act belongs to (its index in REGIONS, and its data). */
  get regionIndex(): number {
    return regionOfAct(this.actIndex);
  }

  get regionDef(): RegionDef {
    return REGIONS[this.regionIndex];
  }

  /** The purse: coins are kept between runs (in the profile). */
  get coins(): number {
    return this.profile.coins;
  }

  set coins(v: number) {
    this.profile.coins = Math.max(0, Math.round(v));
  }

  /** What the equipped gear adds up to. */
  get gear(): Loadout {
    return profileLoadout(this.profile, this.tuning);
  }

  /** Who fights (the hero picked at the camp), their level and skills. */
  get build(): HeroBuild {
    return profileBuild(this.profile, this.tuning);
  }

  /** The gear (or the hero, their level or skills) changed, or a fight is starting: the hero (and the act-start
   *  checkpoint) wear what's equipped now, as the hero picked at the camp. */
  refreshGear(): void {
    const g = this.gear;
    const b = this.build;
    this.hero.gear = g;
    this.hero.build = b;
    this.actHero.gear = g;
    this.actHero.build = b;
    this.hero.hp = Math.min(this.hero.hp, heroMaxHp(this.tuning, this.hero));
  }

  /** Relics that can be offered: unlocked ones. */
  get relicPool(): RelicId[] {
    // the Ice and Hold relics wait for the region that has ice and holds
    return unlockedRelics(this.profile).filter((id) => (relicById(id)?.from ?? 0) <= this.actIndex);
  }

  /** Unlock relics (a first act clear, a first elite win, an event choice); the new ones are shown. */
  private unlock(ids: RelicId[]): void {
    for (const id of ids) if (unlockRelic(this.profile, id)) this.newRelics.push(id);
  }

  /** XP for the hero who's fighting. */
  private grantXp(xp: number): void {
    if (xp <= 0) return;
    this.actXpGained += xp;
    this.levelUps += addXp(this.tuning, heroProgress(this.profile), xp);
    addPetXp(this.profile, xp); // the companions along earn it too
  }

  /** What a fight, an act clear or a stop just gave beyond the usual loot (the loot and act-clear screens show it;
   *  the view empties it). */
  gains: { gems: number; chests: number; achievements: AchievementDef[]; mastery: MasteryDef[]; region: boolean } = { gems: 0, chests: 0, achievements: [], mastery: [], region: false };

  private gem(n: number): void {
    this.gains.gems += awardGems(this.profile, n);
  }

  private chest(kind: ChestKind = 'hero'): void {
    this.profile.chests[kind]++;
    if (kind === 'hero') this.gains.chests++;
  }

  private feats(x: FeatCtx = {}): void {
    this.gains.achievements.push(...checkAchievements(this.profile, this.tuning, { relics: this.hero.relics.length, ...x }));
    this.gains.mastery.push(...checkMastery(this.profile, this.tuning));
  }

  /** The scene the camp should play first, if any: after a region's first act, Sable's arrival (Greenmarch), Neve's
   *  (the Frostpeaks), Mags's tale (Ashfell). */
  get campScene(): string | null {
    if (this.profile.actsCleared >= 1 && !this.profile.sableMet) return 'sableJoin';
    if (this.profile.actsCleared >= 4 && !this.profile.neveMet) return 'neveJoin';
    if (this.profile.actsCleared >= 7 && !this.profile.seen.includes('magsTale')) return 'magsTale';
    return null;
  }

  /** The camp played its scene (campScene): a story hero joins, or the tale is told (it plays once). */
  sableJoined(): void {
    if (!this.profile.sableMet) meetSable(this.profile);
    else if (!this.profile.neveMet) meetNeve(this.profile);
    else if (!this.profile.seen.includes('magsTale')) this.profile.seen.push('magsTale');
  }

  /** The act's live-tuned enemy scaling. */
  get actScale(): ActScale {
    return this.tuning.acts[this.actIndex] ?? { name: this.act.name, hpMult: 1, atkMult: 1, pace: 1, redSpeed: 1 };
  }

  get theme() {
    return this.act.theme;
  }

  /** The node Rowan is on (null at the act's start). */
  get node(): MapNode | null {
    return this.path.length ? this.map.nodes[this.path[this.path.length - 1]] : null;
  }

  /** The act's quest, secret, ambush and picks start over (a new act, a retry). */
  private resetActExtras(): void {
    this.quest = null;
    this.questDone = null;
    this.secretFound = false;
    this.ambush = null;
    this.merchant = false;
    this.bonusPicks = 0;
    this.pickKind = null;
    this.roamCache = null;
  }

  /** Who roams the map after walking `path` (default: the path walked), and who was met on its last step. */
  roamFor(path: readonly number[] = this.path): RoamState {
    if (!this.extras) return { roamers: [], met: null };
    const key = `${this.actIndex}|${this.extras.seed}|${path.join(',')}`;
    if (this.roamCache?.key === key) return this.roamCache.state;
    const state = roamAt(this.map, this.extras, path);
    this.roamCache = { key, state };
    return state;
  }

  /** The secret cache beside the node Rowan stands on, still to be opened (it shows on the map: tap it). */
  get secretHere(): boolean {
    return this.phase === 'map' && !!this.extras && !this.secretFound && this.extras.secret >= 0 && this.node?.id === this.extras.secret;
  }

  /** Open the secret cache beside this node: a richer chest (coins, a Rare+ item, a pick of every relic). */
  openSecret(): boolean {
    if (!this.secretHere) return false;
    this.secretFound = true;
    if (logTreasure(this.profile, this.actIndex)) bump(this.profile, 'treasures');
    this.gem(this.tuning.gems.treasure);
    const coins = Math.round(this.tuning.map.treasureCoins * this.tuning.secret.coinsMult * (0.8 + 0.4 * this.rng.next()) * (1 + this.gear.stats.luck));
    this.treasure = { coins, opened: false, secret: true };
    this.phase = 'treasure';
    return true;
  }

  /** The quest the bounty board on this node posts. */
  get bountyOffer(): QuestId | null {
    const n = this.node;
    if (!n || n.type !== 'bounty' || !this.extras) return null;
    // a style call names one of the styles you own (once you own 2+ heroes)
    const owned = ownedHeroes(this.profile);
    const styles = owned.length >= 2 ? [...new Set(owned.map((h) => HEROES[h].style))] : [];
    return questFor(this.map, n.id, this.extras.seed, styles, this.tuning.quests.styleShare);
  }

  /** Take the bounty board's quest (it replaces one taken earlier in the act), then back to the map. */
  takeQuest(): boolean {
    const id = this.bountyOffer;
    if (this.phase !== 'bounty' || !id || !questById(id)) return false;
    this.quest = newQuest(this.tuning, id);
    this.phase = 'map';
    return true;
  }

  /** Leave the bounty board without taking its quest. */
  passQuest(): void {
    if (this.phase === 'bounty') this.phase = 'map';
  }

  mapSeedFor(act: number): number {
    return actSeed(this.mapSeed, act);
  }

  /** Node ids Rowan can go to next. */
  choices(): number[] {
    const n = this.node;
    return n ? n.next.slice() : this.map.rows[0].slice();
  }

  /** The kingdom's world map (between runs): pick a region. */
  toWorld(): void {
    this.combat = null;
    this.phase = 'world';
    wanderUp(this.profile, this.tuning);
  }

  /** The camp's War Table: a new run starts with a free relic pick. */
  get warTablePicks(): number {
    return hasCamp(this.profile, 'warTable') && this.tuning.relics.on ? 1 : 0;
  }

  /** A new run: the intro, Act 1's opening scene, then the map. */
  newRun(): void {
    this.hero = newHero(this.tuning, this.gear, this.build);
    this.rerolls = 0;
    this.startPicks = this.startPicksTotal = this.warTablePicks;
    this.enterAct(0, [REGIONS[0].introScene, this.region.acts[0].startScene ?? '']);
  }

  /** Acts the world map lets you start at: every act cleared, and the next one. */
  get playableActs(): number {
    return Math.min(this.region.acts.length, this.profile.actsCleared + 1);
  }

  /**
   * A run from act `act` (replaying a cleared act to farm its drops, or going on with the story). Rowan starts
   * with the boosts and kill gains a run typically has by then (heroFor), plus his gear.
   */
  startAct(act: number): void {
    const a = Math.max(0, Math.min(this.playableActs - 1, act));
    if (a === 0) return this.newRun();
    this.hero = heroFor(this.tuning, a, this.gear, this.build);
    this.rerolls = 0;
    // ...and drafts the relics a run would have by then (relic-only picks before the map)
    // (a region starts a fresh run: relic picks count only the acts behind within the region)
    this.startPicks = this.startPicksTotal = this.tuning.relics.on ? Math.max(0, Math.round(this.tuning.kit.relicPicks * actInRegion(a))) + this.warTablePicks : 0;
    this.enterAct(a, [this.region.acts[a].startScene ?? '']);
  }

  /** Open the camp (from the world map, an act clear or a defeat; it goes back there). */
  toCamp(): void {
    if (this.phase === 'camp' || this.phase === 'boost') return;
    this.campFrom = this.phase === 'actClear' ? 'actClear' : this.phase === 'defeat' ? 'defeat' : this.phase === 'map' ? 'map' : 'world';
    this.combat = this.phase === 'defeat' ? this.combat : null;
    this.phase = 'camp';
  }

  /** Back from the camp, wearing whatever was equipped there. */
  leaveCamp(): void {
    if (this.phase !== 'camp') return;
    this.refreshGear();
    this.phase = this.campFrom;
  }

  /** Start act `i` (its map and what else it holds, a revive, the act-start checkpoint), after its opening scenes.
   *  `extras` false: the map without the rush, bounty, secret and roamers (a save from before them goes on so). */
  enterAct(i: number, scenes: string[] = [], extras = true): void {
    this.actIndex = Math.max(0, Math.min(this.region.acts.length - 1, i));
    const built = actMap(this.tuning, this.region, this.actIndex, this.mapSeedFor(this.actIndex), extras);
    this.map = built.map;
    this.extras = built.extras;
    this.resetActExtras();
    this.path = [];
    this.combat = null;
    this.hero = { ...this.hero, abilityTimer: 0, revives: this.tuning.hero.revivesPerAct, gear: this.gear, build: this.build };
    this.actHero = { ...this.hero };
    this.actRerolls = this.rerolls;
    this.freeReroll = hasCamp(this.profile, 'rerollCharm');
    this.luckyUsed = false;
    this.actSpent = 0;
    this.actAims = [];
    this.actAccuracy = null;
    this.actXpGained = 0;
    this.playScenes(scenes, 'map');
  }

  playScenes(ids: string[], then: SceneThen): void {
    this.sceneQueue = ids.filter((id) => !!id);
    this.sceneThen = then;
    if (this.sceneQueue.length) this.phase = 'scene';
    else this.finishScenes();
  }

  /** The current scene is over (its last box was tapped). */
  advanceScene(): void {
    if (this.phase !== 'scene') return;
    this.sceneQueue.shift();
    if (!this.sceneQueue.length) this.finishScenes();
  }

  skipScenes(): void {
    if (this.phase !== 'scene') return;
    this.sceneQueue = [];
    this.finishScenes();
  }

  private finishScenes(): void {
    if (this.sceneThen === 'fight') this.startFight();
    else if (this.sceneThen === 'map' && this.startPicks > 0 && !this.path.length) this.offerStartPick();
    else {
      this.phase = this.sceneThen;
      if (this.phase === 'victory') {
        recordRegion(this.profile, this.regionIndex);
        this.feats();
      }
    }
  }

  /** Walk to a node in the next row and see what's there. */
  chooseNode(id: number): boolean {
    if (this.phase !== 'map' || !this.choices().includes(id)) return false;
    this.path.push(id);
    if (this.hero.relics.includes('fieldRations')) {
      // Field Rations: every step on the map heals a little
      const H = this.hero;
      H.hp = Math.min(heroMaxHp(this.tuning, H), H.hp + Math.round((heroMaxHp(this.tuning, H) * relicNumber(this.tuning, 'fieldRations')) / 100));
    }
    this.enterNode();
    return true;
  }

  /** Arriving at a node: a roamer met on the way first (an ambush, the merchant), then the node's own stop. */
  private enterNode(): void {
    const n = this.node!;
    const met = this.roamFor().met;
    if (met?.kind === 'pack') {
      // an ambush: on a fight node the pack joins its fight as extra waves; anywhere else it's fought first
      this.ambush = { roamer: met.id, waves: ambushWaves(n, met), then: n.type === 'fight' ? 'map' : 'node' };
      return this.startFight();
    }
    if (met?.kind === 'merchant') {
      this.shop = this.rollMerchant();
      this.shopBuys = 0;
      this.merchant = true;
      this.phase = 'shop';
      return;
    }
    this.enterStop();
  }

  /** The node's own stop: its fight, chest, campfire, shop, event, Coin Rush or bounty board. */
  private enterStop(): void {
    const n = this.node!;
    this.ambush = null;
    this.merchant = false;
    switch (n.type) {
      case 'fight':
      case 'elite':
        return this.startFight();
      case 'rush':
        return this.startRush();
      case 'bounty':
        this.phase = 'bounty';
        return;
      case 'boss':
        return this.playScenes([this.act.bossScene ?? ''], 'fight');
      case 'treasure':
        this.treasure = { coins: Math.round(this.tuning.map.treasureCoins * (0.6 + 0.8 * this.rng.next()) * (1 + this.gear.stats.luck)), opened: false };
        this.phase = 'treasure';
        return;
      case 'rest':
        this.phase = 'rest';
        return;
      case 'shop':
        this.shop = this.rollShop();
        this.shopBuys = 0;
        this.phase = 'shop';
        return;
      case 'event':
        this.event = { id: n.event, choice: -1, outcome: -1, boost: null };
        this.phase = 'event';
        return;
    }
  }

  /** The foes of the fight on this node, wave by wave (an ambush's include the pack). */
  get fightWaves(): string[][] {
    const n = this.node;
    if (this.ambush) return this.ambush.waves;
    return n ? (n.waves.length ? n.waves : [n.enemies]) : [];
  }

  /** The current node's fight (or the ambush on it). `restore` resumes a saved one. */
  startFight(restore?: { foes: SavedFoe[]; seed: number; wave?: number }): void {
    const n = this.node;
    if (!n) return;
    if (n.type === 'rush' && !this.ambush) return this.startRush(restore);
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.fightSeed = restore ? restore.seed >>> 0 : this.seed;
    this.refreshGear();
    const waves = this.fightWaves;
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: waves.flat(),
      waves,
      wave: restore?.wave,
      seed: this.fightSeed,
      restore: restore?.foes,
      hpMult: this.actScale.hpMult * (1 + this.tuning.map.rowHp * n.row),
      atkMult: this.actScale.atkMult,
      pace: this.actScale.pace,
      redSpeed: this.actScale.redSpeed,
      bar: this.act.bar,
      row: n.row,
    });
    this.boostChoices = [];
    this.phase = 'fight';
  }

  /** Coin Rush: the coin sack on the bar for tuning.rush.sec seconds (a resumed one starts its clock over). */
  private startRush(restore?: { seed: number }): void {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.fightSeed = restore ? restore.seed >>> 0 : this.seed;
    this.refreshGear();
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: ['coinSack'],
      seed: this.fightSeed,
      rush: Math.max(1, this.tuning.rush.sec),
    });
    this.boostChoices = [];
    this.phase = 'fight';
  }

  /** The fight on screen is a Coin Rush. */
  get rushing(): boolean {
    return this.phase === 'fight' && !!this.combat?.rush;
  }

  /** A boss (or mini-boss) is alive on screen (the music switches to the boss theme). */
  get bossFight(): boolean {
    const c = this.combat;
    return this.phase === 'fight' && !!c && c.enemies.some((e) => e.alive && !!this.tuning.enemies[e.key]?.boss);
  }

  /** The run's random state (fight seeds, boost and event rolls), for saving. */
  get randomState(): { seed: number; rng: number } {
    return { seed: this.seed, rng: this.rng.state };
  }

  set randomState(v: { seed: number; rng: number }) {
    this.seed = v.seed >>> 0;
    this.rng.state = v.rng;
  }

  /** Bank the coins of kills still waiting for their animation, and the fight's timing samples. */
  bankKills(): void {
    const c = this.combat;
    if (!c) return;
    for (const id of c.killQueue) {
      const key = c.enemyById(id)?.key ?? '';
      this.coins += killCoins(this.tuning, this.hero, key);
      this.grantXp(killXp(this.tuning, key, this.actIndex));
    }
    c.killQueue.length = 0;
    if (c.coinsEarned > 0) {
      this.coins += c.coinsEarned;
      c.coinsEarned = 0;
    }
    if (c.aims.length) {
      this.actAims.push(...c.aims);
      if (this.actAims.length > 3000) this.actAims.splice(0, this.actAims.length - 3000);
      addSamples(this.profile.acc, c.aims);
      c.aims.length = 0;
    }
  }

  /** Call after every combat interaction: banks coins from kills, and moves on to the loot, the reward or defeat. */
  sync(): void {
    const c = this.combat;
    if (this.phase !== 'fight' || !c) return;
    if (this.practice) {
      // a practice fight pays nothing; it ends when the fight does. Its taps still count toward the accuracy readout
      // (the Training Dummy, the Test lab's fights: the lab's profile carries the lab's own log, engine/app.ts)
      c.killQueue.length = 0;
      c.coinsEarned = 0;
      if (c.aims.length) addSamples(this.profile.acc, c.aims);
      c.aims.length = 0;
      if (c.result) this.endPractice(c.result === 'won');
      return;
    }
    this.bankKills();
    if (this.skirmish) return this.syncSkirmish(c);
    if (c.result === 'lost') this.phase = 'defeat';
    else if (c.result === 'won') {
      // Coin Rush: its coins were banked hit by hit; back to the map
      if (c.rush) {
        this.phase = 'map';
        return;
      }
      noteFightWon(this.profile);
      const n = this.node;
      const type = n?.type ?? 'fight';
      const ambush = this.ambush;
      this.ambush = null;
      // the drops (into the bag), then a boost pick; elites and bosses always offer something rare
      const boss = type === 'boss' ? c.enemies.find((e) => this.tuning.enemies[e.key]?.boss)?.key : undefined;
      const row = n?.row ?? 0;
      const items = rollDrops(this.rng, this.tuning, { act: this.actIndex, row, type: ambush ? 'fight' : type, boss, finalBoss: lastActOfRegion(this.actIndex), luck: this.gear.stats.luck }, this.profile.blp);
      let min: boolean | Rarity = type === 'elite' || type === 'boss';
      if (type === 'elite') this.unlock(unlocksFor('elite', this.actIndex));
      this.fightRewards(c, type, boss, items);
      if (ambush) {
        // an ambush pays better: coins, an extra item or two, a rarer pick
        const R = this.tuning.roam;
        this.coins += Math.round(R.ambushCoins * (this.actIndex + 1));
        items.push(...this.extraItems(Math.round(R.ambushItems), 'uncommon', row));
        min = R.ambushPick >= 2 ? 'epic' : R.ambushPick >= 1 ? 'rare' : false;
      }
      this.bountyAfter(c, type === 'elite' && !ambush, items);
      this.showLoot(items, min, type === 'boss' ? 'actClear' : ambush?.then === 'node' ? 'node' : 'map');
    }
  }

  /** Gems and hero chests a won fight pays (bosses: more on a first kill), the companions' and heroes' counters, and
   *  the achievements it earns. */
  private fightRewards(c: Combat, type: string, boss: string | undefined, items: Item[]): void {
    const P = this.profile;
    const C = this.tuning.chests;
    const G = this.tuning.gems;
    bump(P, 'holds', c.log.holds);
    if (boss) {
      const first = bump(P, `kill:${boss}`) === 1;
      const final = lastActOfRegion(this.actIndex);
      this.gem(first ? (final ? G.bossFirst : G.miniFirst) : G.bossAgain);
      if (first || this.rng.next() < (final ? C.bossChest : C.miniChest)) this.chest();
      if (final) bump(P, `boss:${this.build.id}`);
    } else if (type === 'elite') {
      if (this.rng.next() < C.eliteChest) this.chest();
      if (this.rng.next() < G.pouch) this.gem(G.pouchGems);
    }
    this.feats({ combo: c.log.bestCombo, finisherStacks: c.log.bestFinisher, bossNoHit: !!boss && c.log.hits === 0, legendary: items.some((i) => ['legendary', 'mythic', 'celestial', 'divine'].includes(i.rarity)) });
  }

  /** `n` items of at least `min` rarity at this act's item level. */
  private extraItems(n: number, min: 'uncommon' | 'rare', row: number): Item[] {
    const ilvl = itemLevel(this.tuning, this.actIndex, row);
    return Array.from({ length: Math.max(0, n) }, () => rollItem(this.rng, this.tuning, this.actIndex, ilvl, this.gear.stats.luck, min));
  }

  /** A won fight counts toward the act's bounty; meeting it pays at once (coins), with the drops (an item), or with
   *  a relic pick after this fight's. */
  private bountyAfter(c: Combat, elite: boolean, items: Item[]): void {
    const q = this.quest;
    if (!q || q.done) return;
    const style = HEROES[this.hero.build?.id ?? 'rowan']?.style;
    if (!questProgress(this.tuning, q, { log: c.log, elite, hpShare: this.hero.hp / Math.max(1, heroMaxHp(this.tuning, this.hero)), style })) return;
    this.questDone = q.id;
    logBounty(this.profile, this.actIndex);
    bump(this.profile, 'bounties');
    this.gem(this.tuning.gems.bounty);
    if (this.rng.next() < this.tuning.chests.bountyChest) this.chest();
    const reward = questById(q.id)?.reward;
    if (reward === 'coins') this.coins += Math.round(this.tuning.quests.coins * (this.actIndex + 1));
    else if (reward === 'gear') items.push(...this.extraItems(1, 'rare', this.node?.row ?? 0));
    else if (reward === 'relic') this.bonusPicks++;
  }

  // ------------------------------------------------------------------ the world map's skirmish

  /** The world map's wandering foe, if one is out. */
  get wanderer(): Skirmish | null {
    return this.profile.actsCleared >= 1 && this.profile.wander.up ? skirmishFor(this.profile, this.region) : null;
  }

  /** Fight the world map's wandering foe: one skirmish, as a hero who has been through that act (heroFor). It is used
   *  up now, won or lost. The run as it was comes back after it. */
  startSkirmish(): boolean {
    const foe = this.wanderer;
    if (this.phase !== 'world' || this.skirmish || !foe) return false;
    useWanderer(this.profile);
    this.skirmish = { foe, hero: this.hero, act: this.actIndex, map: this.map, path: this.path, extras: this.extras };
    this.actIndex = foe.act;
    this.path = [];
    this.hero = heroFor(this.tuning, foe.act, this.gear, this.build);
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.fightSeed = this.seed;
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: foe.waves.flat(),
      waves: foe.waves,
      seed: this.fightSeed,
      hpMult: this.actScale.hpMult * (1 + this.tuning.map.rowHp * 3),
      atkMult: this.actScale.atkMult,
      pace: this.actScale.pace,
      redSpeed: this.actScale.redSpeed,
      bar: this.act.bar,
      row: 3,
    });
    this.boostChoices = [];
    this.phase = 'fight';
    return true;
  }

  // ------------------------------------------------------------------ practice fights (the camp's Training Dummy,
  // and the Test lab's scenarios)

  /** A practice fight on screen: the run as it was (put back after), where it goes back to, and when it ended. */
  practice: { hero: Hero; combat: Combat | null; actIndex: number; phase: Phase; then: Phase } | null = null;
  /** The last practice fight just ended (won or not): the view shows what comes next and empties it. */
  practiceEnded: { won: boolean } | null = null;

  /**
   * A practice fight: no rewards, no XP, nothing saved. By default against the Training Dummy, as the picked hero,
   * with nothing able to hurt the hero (`safe`); the Test lab sets the hero, stars, companions, foes, act and bar rules.
   */
  startPractice(o: { hero?: HeroId; stars?: number; pets?: PetBuild[]; enemies?: string[]; waves?: string[][]; act?: number; bar?: BarRules; row?: number; safe?: boolean; then?: Phase; seed?: number; relics?: RelicId[] } = {}): void {
    if (!this.practice) this.practice = { hero: this.hero, combat: this.combat, actIndex: this.actIndex, phase: this.phase === 'fight' ? 'camp' : this.phase, then: o.then ?? (this.phase === 'fight' ? 'camp' : this.phase) };
    else this.practice.then = o.then ?? this.practice.then;
    const act = Math.max(0, Math.min(this.region.acts.length - 1, o.act ?? 0));
    const id = o.hero ?? this.profile.hero;
    const base = profileBuild(this.profile, this.tuning, id);
    const build: HeroBuild = { ...base, id, stars: o.stars ?? base.stars, pets: o.pets ?? base.pets };
    this.hero = heroFor(this.tuning, act, this.gear, build);
    if (o.relics) this.hero.relics = o.relics.slice();
    const scale = this.tuning.acts[act];
    const waves = o.waves ?? [o.enemies ?? ['dummy']];
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: waves.flat(),
      waves,
      seed: (o.seed ?? this.seed + 77) >>> 0,
      hpMult: scale?.hpMult ?? 1,
      atkMult: scale?.atkMult ?? 1,
      pace: scale?.pace ?? 1,
      redSpeed: scale?.redSpeed ?? 1,
      bar: o.bar,
      row: o.row ?? 9,
      practice: o.safe ?? true,
    });
    this.practiceEnded = null;
    this.boostChoices = [];
    this.phase = 'fight';
  }

  /** Leave a practice fight now (won, lost, or walked away from): the run as it was. */
  endPractice(won = false): void {
    const pr = this.practice;
    if (!pr) return;
    this.hero = pr.hero;
    this.combat = pr.combat;
    this.actIndex = pr.actIndex;
    this.practice = null;
    this.practiceEnded = { won };
    this.phase = pr.then;
  }

  /** The skirmish is over: won, its drops and XP (then the world map); lost, straight back to the world map. */
  private syncSkirmish(c: Combat): void {
    const sk = this.skirmish!;
    if (c.result === 'lost') return this.endSkirmish();
    if (c.result !== 'won') return;
    this.grantXp(Math.round(this.tuning.wander.xp * (sk.foe.act + 1)));
    this.showLoot(this.extraItems(Math.round(this.tuning.wander.items), 'uncommon', 3), false, 'world');
  }

  /** Back to the world map, the run as it was before the skirmish. */
  private endSkirmish(): void {
    const sk = this.skirmish;
    if (sk) {
      this.hero = sk.hero;
      this.actIndex = sk.act;
      this.map = sk.map;
      this.path = sk.path;
      this.extras = sk.extras;
    }
    this.skirmish = null;
    this.combat = null;
    this.boostChoices = [];
    this.loot = [];
    this.phase = 'world';
  }

  /** Put drops in the bag and show them (the loot screen), then the boost pick; straight to the pick if none. */
  private showLoot(items: Item[], min: boolean | Rarity, then: PickThen): void {
    this.loot = [];
    this.lootSalvaged = 0;
    for (const it of items) {
      const r = addItem(this.profile, this.tuning, it);
      this.loot.push(r.item);
      this.lootSalvaged += r.salvaged;
    }
    this.boostMin = min;
    this.boostThen = then;
    if (this.loot.length) this.phase = 'loot';
    else this.offerBoosts(min, then);
  }

  /** Done looking at the loot: the boost pick. */
  collectLoot(): void {
    if (this.phase !== 'loot') return;
    this.loot = [];
    this.lootSalvaged = 0;
    this.offerBoosts(this.boostMin, this.boostThen);
  }

  offerBoosts(min: boolean | Rarity, then: PickThen): void {
    if (then === 'world') return this.endSkirmish(); // a skirmish has no pick (relics are for runs)
    this.boostMin = min;
    this.boostThen = then;
    this.boostChoices = this.rollChoices();
    this.phase = 'boost';
  }

  /** A replay's starting relic pick (relics only), then the next one or the map. */
  private offerStartPick(): void {
    this.boostMin = false;
    this.boostThen = 'map';
    this.boostChoices = this.rollChoices();
    this.phase = 'boost';
  }

  /** Whether the pick on screen is one of a replay's starting relic picks ("Starting relic 2/4"). */
  get startPick(): boolean {
    return this.startPicks > 0 && !this.path.length && this.boostThen === 'map';
  }

  pickBoost(index: number): void {
    if (this.phase !== 'boost') return;
    const offer = this.boostChoices[index];
    if (!offer) return;
    applyBoost(this.tuning, this.hero, offer);
    // a secret cache's relic stays unlocked
    if (this.pickKind === 'secret' && isRelicOffer(offer)) this.unlock([offer.relic]);
    this.pickKind = null;
    this.boostChoices = [];
    if (this.startPick) {
      this.startPicks--;
      // the drafted relics are part of how the hero enters the act (a retry keeps them)
      this.actHero = { ...this.hero };
      if (this.startPicks > 0) return this.offerStartPick();
    }
    if (this.bonusPicks > 0) {
      // a bounty's relic pick follows (relics only, rare or better)
      this.bonusPicks--;
      this.pickKind = 'bounty';
      this.boostMin = 'rare';
      this.boostChoices = this.rollChoices();
      return;
    }
    this.goOn(this.boostThen);
  }

  /** After the loot and the pick: the map, the act clear, the node's own stop (an ambush fought first), the world map. */
  private goOn(then: PickThen): void {
    if (then === 'world') return this.endSkirmish();
    if (then === 'node') return this.enterStop();
    this.phase = then;
    if (then === 'actClear') this.clearAct();
  }

  /** The act's boss is down: progress, XP, relics a first clear unlocks, and the act's accuracy for the act-clear screen. */
  private clearAct(): void {
    const first = recordAct(this.profile, this.actIndex);
    if (first) this.unlock(unlocksFor('act', this.actIndex));
    this.grantXp(actXp(this.tuning, this.actIndex, first));
    this.actAccuracy = recordActAccuracy(this.tuning, this.profile.acc, this.actIndex, this.actAims);
    if (first) this.gem(this.tuning.gems.actFirst);
    heroProgress(this.profile).acts++; // mastery counts acts cleared with each hero
    this.feats();
    // the region's tracker at 100%: its chest and gems, once
    if (claimRegionReward(this.profile, this.tuning, this.regionIndex)) {
      this.gains.region = true;
      this.gains.gems += Math.round(this.tuning.gems.region);
    }
  }

  /** Spend a reroll (bought at a shop) on a fresh set of cards. */
  rerollBoosts(): boolean {
    if (this.phase !== 'boost' || this.rerollsLeft <= 0) return false;
    // the Reroll Charm's free reroll goes first
    if (this.freeReroll) this.freeReroll = false;
    else this.rerolls--;
    this.boostChoices = this.rollChoices();
    return true;
  }

  /** Roll a fresh set of choices for the pick on screen (also: a save from before the cards were rolled). */
  rollChoices(): BoostOffer[] {
    const pool = this.pickKind === 'secret' ? RELICS.filter((r) => (r.from ?? 0) <= this.actIndex).map((r) => r.id) : this.relicPool;
    // the Lucky Stone: once an act, a pick shows four cards
    const lucky = hasCamp(this.profile, 'luckyStone') && !this.luckyUsed;
    if (lucky) this.luckyUsed = true;
    return rollPick(this.rng, this.tuning, pool, this.hero.relics, this.boostMin, { relicsOnly: this.startPick || this.pickKind !== null, n: lucky ? 4 : 3 });
  }

  /** Levels gained since the screen last showed them (the view calls this once to show "Level up!"). */
  takeLevelUps(): number {
    const n = this.levelUps;
    this.levelUps = 0;
    return n;
  }

  /** Treasure: coins and 1-2 items, then a rare-or-better boost pick. A secret cache: more coins, Rare+ items, and
   *  a pick of every relic (tuning.secret). */
  openTreasure(): void {
    if (this.phase !== 'treasure' || !this.treasure || this.treasure.opened) return;
    this.treasure.opened = true;
    this.coins += this.treasure.coins;
    if (this.treasure.secret) {
      const S = this.tuning.secret;
      this.pickKind = 'secret';
      return this.showLoot(this.extraItems(Math.round(S.items), 'rare', this.node?.row ?? 0), S.pick >= 2 ? 'epic' : S.pick >= 1 ? 'rare' : false, 'map');
    }
    const items = rollDrops(this.rng, this.tuning, { act: this.actIndex, row: this.node?.row ?? 0, type: 'treasure', luck: this.gear.stats.luck }, this.profile.blp);
    this.showLoot(items, 'rare', 'map');
  }

  /** Share of max HP a rest heals (the Greenwarden 4-piece heals more). */
  get restShare(): number {
    return Math.max(this.tuning.map.restHeal, setPieces(this.gear, 'greenwarden') >= 4 ? this.tuning.effects.greenwardenRest : 0);
  }

  /** Rest: heal a share of max HP. Returns how much. */
  rest(): number {
    if (this.phase !== 'rest') return 0;
    const H = this.hero;
    const max = heroMaxHp(this.tuning, H);
    let share = this.restShare;
    const tithe = relicNumber(this.tuning, 'tithe');
    if (this.hero.relics.includes('tithe') && this.coins >= tithe && H.hp < max) {
      // Tithe: the rest costs coins but heals fully
      this.coins -= tithe;
      this.actSpent += tithe;
      share = 1;
    } else if (this.hero.relics.includes('vampiricFang')) share = 0; // Vampiric Fang: rests heal nothing
    const heal = Math.min(max - H.hp, Math.round(max * share));
    H.hp += Math.max(0, heal);
    this.phase = 'map';
    return Math.max(0, heal);
  }

  /** What shop items cost with the relics carried (Gold Fever: more). */
  shopPrice(base: number): number {
    return this.hero.relics.includes('goldFever') ? Math.round(base * (1 + relicNumber(this.tuning, 'goldFever') / 100)) : base;
  }

  /** Haggler: the first thing bought in each shop is free. */
  get shopFree(): boolean {
    return this.hero.relics.includes('haggler') && this.shopBuys === 0;
  }

  /** What shop item `i` costs right now (0 = free). */
  priceOf(item: ShopItem): number {
    return this.shopFree ? 0 : item.price;
  }

  private rollShop(): ShopItem[] {
    const M = this.tuning.map;
    const T = this.tuning;
    const cards = rollPick(this.rng, T, this.relicPool, this.hero.relics).map(
      (offer): ShopItem => ({ kind: 'boost', offer, price: this.shopPrice(Math.round(cardPrice(T, offer.rarity) * (offer.id === 'relic' ? T.relics.price : 1))), sold: false }),
    );
    return [...cards, { kind: 'potion', offer: null, price: this.shopPrice(M.pricePotion), sold: false }, { kind: 'reroll', offer: null, price: this.shopPrice(M.priceReroll), sold: false }];
  }

  /** Buy shop item `i`. Returns false if it's sold out or Rowan can't afford it. */
  buy(i: number): boolean {
    const item = this.shop[i];
    if (this.phase !== 'shop' || !item || item.sold) return false;
    const price = this.priceOf(item);
    if (this.coins < price) return false;
    this.coins -= price;
    this.actSpent += price;
    this.shopBuys++;
    item.sold = true;
    if (item.kind === 'boost' && item.offer) applyBoost(this.tuning, this.hero, item.offer);
    else if (item.kind === 'potion') {
      const H = this.hero;
      H.hp = Math.min(heroMaxHp(this.tuning, H), H.hp + Math.round(heroMaxHp(this.tuning, H) * this.tuning.map.potionHeal));
    } else this.rerolls++;
    return true;
  }

  /** The travelling merchant's small shop: a relic or two (rare or better, ones a shop rarely has) and a potion, a
   *  little cheaper than a shop's (tuning.roam). */
  private rollMerchant(): ShopItem[] {
    const T = this.tuning;
    const k = Math.max(0, T.roam.merchantPrice);
    const n = Math.max(0, Math.round(T.roam.merchantRelics));
    const pool = this.relicPool.filter((id) => relicById(id)?.rarity !== 'common');
    const cards = (n ? rollPick(this.rng, T, pool.length ? pool : this.relicPool, this.hero.relics, 'rare', { n, relicsOnly: true }) : []).map(
      (offer): ShopItem => ({ kind: 'boost', offer, price: this.shopPrice(Math.round(cardPrice(T, offer.rarity) * (offer.id === 'relic' ? T.relics.price : 1) * k)), sold: false }),
    );
    return [...cards, { kind: 'potion', offer: null, price: this.shopPrice(Math.round(T.map.pricePotion * k)), sold: false }];
  }

  /** Leave the shop: back to the map (from the merchant's, on to the node's own stop). */
  leaveShop(): void {
    if (this.phase !== 'shop') return;
    if (this.merchant) return this.enterStop();
    this.phase = 'map';
  }

  /** Pick event choice `i`. Returns false if Rowan can't afford it. */
  chooseEvent(i: number): boolean {
    const ev = this.event;
    const def = ev ? eventById(ev.id) : undefined;
    if (this.phase !== 'event' || !ev || !def || ev.outcome >= 0) return false;
    const ch = def.choices[i];
    if (!ch || this.coins < (ch.cost ?? 0)) return false;
    this.coins -= ch.cost ?? 0;
    this.actSpent += ch.cost ?? 0;
    const total = ch.outcomes.reduce((s, o) => s + (o.chance ?? 1), 0);
    let x = this.rng.next() * total;
    let k = 0;
    while (k < ch.outcomes.length - 1 && (x -= ch.outcomes[k].chance ?? 1) > 0) k++;
    ev.choice = i;
    ev.outcome = k;
    this.applyOutcome(ch.outcomes[k]);
    this.unlock(unlocksFor('event', ev.id, i));
    logEvent(this.profile, this.actIndex, ev.id);
    return true;
  }

  private applyOutcome(o: EventOutcome): void {
    const T = this.tuning;
    const H = this.hero;
    if (o.coins) this.coins = Math.max(0, this.coins + o.coins);
    if (o.maxHp) {
      H.bonusMaxHp += o.maxHp;
      H.hp += o.maxHp;
    }
    if (o.atk) H.bonusAtk += o.atk;
    if (o.pet) H.bonusPet += o.pet;
    if (o.heal) H.hp += Math.round(heroMaxHp(T, H) * o.heal);
    if (o.hp) H.hp = o.hp < 0 ? Math.max(1, H.hp + o.hp) : H.hp + o.hp;
    H.hp = Math.min(H.hp, heroMaxHp(T, H));
    if (o.boost && this.event) this.event.boost = o.boost;
  }

  /** Done reading what happened: a boost pick if the event gave one, otherwise back to the map. */
  endEvent(): void {
    const ev = this.event;
    if (this.phase !== 'event' || !ev || ev.outcome < 0) return;
    this.event = null;
    if (ev.boost) this.offerBoosts(ev.boost, 'map');
    else this.phase = 'map';
  }

  /** After the act's boss: rest to full HP and on to the next act, or (after the last) the victory scene. */
  nextAct(): void {
    if (this.phase !== 'actClear') return;
    this.hero.build = this.build; // the act clear's XP may have levelled the hero up
    this.hero.hp = heroMaxHp(this.tuning, this.hero);
    // after a region's first act, the night at camp: a story hero joins (unless the camp already played it)
    const sable = this.campScene ? [this.campScene] : [];
    if (sable.length) this.sableJoined();
    // the region's last act cleared: its victory scene (the weight comes home); else on to its next act
    if (!lastActOfRegion(this.actIndex) && this.actIndex + 1 < this.region.acts.length) this.enterAct(this.actIndex + 1, [...sable, this.region.acts[this.actIndex + 1].startScene ?? '']);
    else this.playScenes([this.regionDef.victoryScene], 'victory');
  }

  /**
   * Debug (the tuning panel's "Jump to"): a fight against `enemies` in act `act`, on a node of that type
   * (a fight node mid-act, an elite, or the boss), with `hero`.
   */
  debugFight(act: number, enemies: string[], type: 'fight' | 'elite' | 'boss', hero: Hero): void {
    this.hero = { ...hero, gear: this.gear, build: this.build };
    this.startPicks = 0;
    this.enterAct(act);
    const m = this.map;
    const target = type === 'boss' ? m.nodes[m.boss] : (m.nodes.find((n) => n.type === type && n.row >= 3) ?? m.nodes.find((n) => n.row === 3)!);
    if (target.type === 'rush' || target.type === 'bounty') target.type = type;
    target.enemies = enemies.slice();
    target.waves = [enemies.slice()];
    const path = [target.id];
    while (m.nodes[path[0]].row > 0) path.unshift(m.nodes.find((p) => p.next.includes(path[0]))!.id);
    this.path = path;
    this.startFight();
  }

  /**
   * After a defeat: the act again from its start, with the hero as they entered it. Coins and gear found are kept;
   * coins spent in the act (on boosts, potions, rerolls and events that the retry undoes) are refunded.
   */
  retry(): void {
    this.resetActExtras();
    this.hero = { ...this.actHero, abilityTimer: 0, gear: this.gear, build: this.build };
    this.rerolls = this.actRerolls;
    // what the act's shops and events cost comes back with the hero as he entered (coins found are kept)
    this.coins += this.actSpent;
    this.actSpent = 0;
    this.path = [];
    this.combat = null;
    this.boostChoices = [];
    this.phase = 'map';
  }
}
