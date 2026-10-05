// Region flow (pure; no Phaser): Greenmarch's three acts, each a branching node map (fights, elites, treasure,
// rests, shops, events) ending in a mini-boss or the boss; boosts, gear drops, coins, story scenes, revive and retry.
// Dying sends you back to the act's start with the hero as they entered it (the gear and coins found are kept).
// Between acts (and from the world map) Rowan can visit the camp; cleared acts can be replayed for their drops.
// M4a: the pick after a fight offers mostly relics (core/relics.ts) plus at most one stat card; relics carry and
// reset like boosts. The hero who fights (Rowan or Sable) earns XP from kills and act clears (core/heroes.ts).

import { eventById } from '../data/events';
import { GREENMARCH } from '../data/greenmarch';
import type { ActDef, EventOutcome, RegionDef } from '../data/types';
import { relicById, type RelicId } from '../data/relics';
import { recordActAccuracy, addSamples, type AccEntry } from './accuracy';
import { Combat, heroMaxHp, heroStats, killCoins, newHero, type Hero, type SavedFoe } from './combat';
import { rollDrops, setPieces, type Item, type Loadout } from './gear';
import { actXp, addXp, defaultBuild, killXp, type HeroBuild } from './heroes';
import { actSeed, buildActMap, type ActMap, type MapNode } from './map';
import { addItem, heroProgress, meetSable, newProfile, profileBuild, profileLoadout, recordAct, recordRegion, unlockedRelics, unlockRelic, type Profile } from './profile';
import { relicNumber, rollRelics, unlocksFor } from './relics';
import { Rng } from './rng';
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
  | 'actClear'
  | 'defeat'
  | 'victory';
/** Where the camp was opened from (and goes back to). */
export type CampFrom = 'world' | 'actClear' | 'defeat';
/** Where a run of story scenes leads. */
export type SceneThen = 'map' | 'fight' | 'victory';

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
      return ['Companion Power', `Pip +${Math.round(b.pet * m)} dmg`];
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
      return { stat: 'Pip', before: a, after: b };
    }
    case 'heal':
      return { stat: 'HP', before: `${hero.hp}`, after: `${after.hp}` };
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
 * (tuning.relics.statCard). `min` (elites, bosses, treasure) makes one card at least that rare. `relicsOnly`: no stat
 * card (a replay's starting picks). Stat cards fill in when the relics run out.
 */
export function rollPick(rng: Rng, t: Tuning, pool: readonly RelicId[], owned: readonly RelicId[], min: boolean | Rarity = false, o: { n?: number; relicsOnly?: boolean } = {}): BoostOffer[] {
  const n = o.n ?? 3;
  const want: Rarity = min === true ? 'rare' : min === false ? 'common' : min;
  const stat = !o.relicsOnly && rng.next() < t.relics.statCard ? 1 : 0;
  const relics = rollRelics(rng, t, pool, owned, n - stat, want === 'common' ? undefined : want);
  const out: BoostOffer[] = relics.map((id) => ({ id: 'relic', rarity: relicById(id)!.rarity, relic: id }));
  const stats = n - out.length;
  if (stats > 0) {
    const cards = rollBoosts(rng, t, out.some((x) => RARITIES.indexOf(x.rarity) >= RARITIES.indexOf(want)) ? false : want, stats);
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
  readonly region: RegionDef = GREENMARCH;
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
  boostThen: 'map' | 'actClear' = 'map';
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
  actRerolls = 0;
  /** Coins spent in this act on what a defeat undoes (shop buys, event costs): a retry refunds them. */
  actSpent = 0;
  shop: ShopItem[] = [];
  event: EventState | null = null;
  treasure: { coins: number; opened: boolean } | null = null;
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
    return unlockedRelics(this.profile);
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
  }

  /** The scene the camp should play first, if any: Sable's arrival, once Act 1 is cleared. */
  get campScene(): string | null {
    return this.profile.actsCleared >= 1 && !this.profile.sableMet ? 'sableJoin' : null;
  }

  /** The camp played Sable's scene: Sable joins. */
  sableJoined(): void {
    meetSable(this.profile);
  }

  /** The act's live-tuned enemy scaling. */
  get actScale(): ActScale {
    return this.tuning.acts[this.actIndex] ?? { name: this.act.name, hpMult: 1, atkMult: 1, pace: 1 };
  }

  get theme() {
    return this.act.theme;
  }

  /** The node Rowan is on (null at the act's start). */
  get node(): MapNode | null {
    return this.path.length ? this.map.nodes[this.path[this.path.length - 1]] : null;
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
  }

  /** A new run: the intro, Act 1's opening scene, then the map. */
  newRun(): void {
    this.hero = newHero(this.tuning, this.gear, this.build);
    this.rerolls = 0;
    this.startPicks = this.startPicksTotal = 0;
    this.enterAct(0, [this.region.introScene, this.region.acts[0].startScene ?? '']);
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
    this.startPicks = this.startPicksTotal = Math.max(0, Math.round(this.tuning.kit.relicPicks * a));
    this.enterAct(a, [this.region.acts[a].startScene ?? '']);
  }

  /** Open the camp (from the world map, an act clear or a defeat; it goes back there). */
  toCamp(): void {
    if (this.phase === 'camp' || this.phase === 'boost') return;
    this.campFrom = this.phase === 'actClear' ? 'actClear' : this.phase === 'defeat' ? 'defeat' : 'world';
    this.combat = this.phase === 'defeat' ? this.combat : null;
    this.phase = 'camp';
  }

  /** Back from the camp, wearing whatever was equipped there. */
  leaveCamp(): void {
    if (this.phase !== 'camp') return;
    this.refreshGear();
    this.phase = this.campFrom;
  }

  /** Start act `i` (its map, a revive, the act-start checkpoint), after its opening scenes. */
  enterAct(i: number, scenes: string[] = []): void {
    this.actIndex = Math.max(0, Math.min(this.region.acts.length - 1, i));
    this.map = buildActMap(this.act, this.mapSeedFor(this.actIndex));
    this.path = [];
    this.combat = null;
    this.hero = { ...this.hero, abilityTimer: 0, revives: this.tuning.hero.revivesPerAct, gear: this.gear, build: this.build };
    this.actHero = { ...this.hero };
    this.actRerolls = this.rerolls;
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
      if (this.phase === 'victory') recordRegion(this.profile);
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

  private enterNode(): void {
    const n = this.node!;
    switch (n.type) {
      case 'fight':
      case 'elite':
        return this.startFight();
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

  /** The current node's fight. `restore` resumes a saved one. */
  startFight(restore?: { foes: SavedFoe[]; seed: number; wave?: number }): void {
    const n = this.node;
    if (!n) return;
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.fightSeed = restore ? restore.seed >>> 0 : this.seed;
    this.refreshGear();
    this.combat = new Combat({
      tuning: this.tuning,
      settings: this.settings,
      hero: this.hero,
      enemies: n.enemies,
      waves: n.waves.length ? n.waves : [n.enemies],
      wave: restore?.wave,
      seed: this.fightSeed,
      restore: restore?.foes,
      hpMult: this.actScale.hpMult * (1 + this.tuning.map.rowHp * n.row),
      atkMult: this.actScale.atkMult,
      pace: this.actScale.pace,
    });
    this.boostChoices = [];
    this.phase = 'fight';
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
    this.bankKills();
    if (c.result === 'lost') this.phase = 'defeat';
    else if (c.result === 'won') {
      const n = this.node;
      const type = n?.type ?? 'fight';
      // the drops (into the bag), then a boost pick; elites and bosses always offer something rare
      const boss = type === 'boss' ? c.enemies.find((e) => this.tuning.enemies[e.key]?.boss)?.key : undefined;
      const items = rollDrops(this.rng, this.tuning, { act: this.actIndex, row: n?.row ?? 0, type, boss, finalBoss: this.actIndex === this.region.acts.length - 1, luck: this.gear.stats.luck }, this.profile.blp);
      if (type === 'elite') this.unlock(unlocksFor('elite', this.actIndex));
      this.showLoot(items, type === 'elite' || type === 'boss', type === 'boss' ? 'actClear' : 'map');
    }
  }

  /** Put drops in the bag and show them (the loot screen), then the boost pick; straight to the pick if none. */
  private showLoot(items: Item[], min: boolean | Rarity, then: 'map' | 'actClear'): void {
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

  offerBoosts(min: boolean | Rarity, then: 'map' | 'actClear'): void {
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
    this.boostChoices = [];
    if (this.startPick) {
      this.startPicks--;
      // the drafted relics are part of how the hero enters the act (a retry keeps them)
      this.actHero = { ...this.hero };
      if (this.startPicks > 0) return this.offerStartPick();
    }
    this.phase = this.boostThen;
    if (this.phase === 'actClear') this.clearAct();
  }

  /** The act's boss is down: progress, XP, relics a first clear unlocks, and the act's accuracy for the act-clear screen. */
  private clearAct(): void {
    const first = recordAct(this.profile, this.actIndex);
    if (first) this.unlock(unlocksFor('act', this.actIndex));
    this.grantXp(actXp(this.tuning, this.actIndex, first));
    this.actAccuracy = recordActAccuracy(this.tuning, this.profile.acc, this.actIndex, this.actAims);
  }

  /** Spend a reroll (bought at a shop) on a fresh set of cards. */
  rerollBoosts(): boolean {
    if (this.phase !== 'boost' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.boostChoices = this.rollChoices();
    return true;
  }

  /** Roll a fresh set of choices for the pick on screen (also: a save from before the cards were rolled). */
  rollChoices(): BoostOffer[] {
    return rollPick(this.rng, this.tuning, this.relicPool, this.hero.relics, this.boostMin, { relicsOnly: this.startPick });
  }

  /** Levels gained since the screen last showed them (the view calls this once to show "Level up!"). */
  takeLevelUps(): number {
    const n = this.levelUps;
    this.levelUps = 0;
    return n;
  }

  /** Treasure: coins and 1-2 items, then a rare-or-better boost pick. */
  openTreasure(): void {
    if (this.phase !== 'treasure' || !this.treasure || this.treasure.opened) return;
    this.treasure.opened = true;
    this.coins += this.treasure.coins;
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

  leaveShop(): void {
    if (this.phase === 'shop') this.phase = 'map';
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
    // after Act 1, the night at camp: Sable tries to rob it and joins (unless the camp already played it)
    const sable = this.campScene ? [this.campScene] : [];
    if (sable.length) this.sableJoined();
    if (this.actIndex + 1 < this.region.acts.length) this.enterAct(this.actIndex + 1, [...sable, this.region.acts[this.actIndex + 1].startScene ?? '']);
    else this.playScenes([this.region.victoryScene], 'victory');
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
