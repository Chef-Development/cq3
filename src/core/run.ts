// Region flow (pure; no Phaser): Greenmarch's three acts, each a branching node map (fights, elites, treasure,
// rests, shops, events) ending in a mini-boss or the boss; boosts, coins, story scenes, revive and retry.
// Dying sends you back to the act's start with the hero as they entered it.

import { eventById } from '../data/events';
import { GREENMARCH } from '../data/greenmarch';
import type { ActDef, EventOutcome, RegionDef } from '../data/types';
import { Combat, heroMaxHp, newHero, type Hero, type SavedFoe } from './combat';
import { actSeed, buildActMap, type ActMap, type MapNode } from './map';
import { Rng } from './rng';
import type { ActScale, Settings, Tuning } from './tuning';

export type Phase = 'title' | 'world' | 'scene' | 'map' | 'fight' | 'boost' | 'treasure' | 'rest' | 'shop' | 'event' | 'actClear' | 'defeat' | 'victory';
/** Where a run of story scenes leads. */
export type SceneThen = 'map' | 'fight' | 'victory';

export type BoostId = 'maxHp' | 'damage' | 'crit' | 'critDmg' | 'comboPower' | 'pet' | 'heal';
export const BOOST_IDS: BoostId[] = ['maxHp', 'damage', 'crit', 'critDmg', 'comboPower', 'pet', 'heal'];

/** Boost cards come in three strengths: common (green), rare (blue, x2) and epic (gold, x3). */
export type Rarity = 'common' | 'rare' | 'epic';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic'];

export interface BoostOffer {
  id: BoostId;
  rarity: Rarity;
}

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

/** What a shop sells: three boost cards, a potion, and a reroll of the next 1-of-3 boost pick. */
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
 * A hero who has fought through `act` acts: the kill rewards and boosts a typical run earns per act
 * (the debug panel's "Jump to" uses it so later acts aren't tried with a fresh hero).
 */
export function heroFor(t: Tuning, act: number): Hero {
  const h = newHero(t);
  const order: BoostId[] = ['damage', 'maxHp', 'comboPower', 'crit', 'pet', 'critDmg'];
  const kills = 9 * act;
  const boosts = 7 * act;
  h.bonusAtk += t.kill.atk * kills;
  h.bonusMaxHp += t.kill.maxHp * kills;
  h.bonusComboPower += t.kill.comboPower * kills;
  for (let k = 0; k < boosts; k++) applyBoost(t, h, { id: order[k % order.length], rarity: k % 7 === 6 ? 'rare' : 'common' });
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
  /** Coins collected this run. */
  coins = 0;
  actCoins = 0;
  /** Rerolls bought at shops, spent on a boost pick. */
  rerolls = 0;
  actRerolls = 0;
  shop: ShopItem[] = [];
  event: EventState | null = null;
  treasure: { coins: number; opened: boolean } | null = null;
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
  ) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed ^ 0xa5a5a5);
    this.mapSeed = (Math.imul(this.seed, 0x9e3779b1) ^ 0x1234567) >>> 0;
    this.hero = newHero(tuning);
    this.actHero = { ...this.hero };
    this.map = buildActMap(this.region.acts[0], this.mapSeedFor(0));
  }

  get act(): ActDef {
    return this.region.acts[this.actIndex];
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
    this.hero = newHero(this.tuning);
    this.coins = 0;
    this.rerolls = 0;
    this.enterAct(0, [this.region.introScene, this.region.acts[0].startScene ?? '']);
  }

  /** Start act `i` (its map, a revive, the act-start checkpoint), after its opening scenes. */
  enterAct(i: number, scenes: string[] = []): void {
    this.actIndex = Math.max(0, Math.min(this.region.acts.length - 1, i));
    this.map = buildActMap(this.act, this.mapSeedFor(this.actIndex));
    this.path = [];
    this.combat = null;
    this.hero = { ...this.hero, abilityTimer: 0, revives: this.tuning.hero.revivesPerAct };
    this.actHero = { ...this.hero };
    this.actCoins = this.coins;
    this.actRerolls = this.rerolls;
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
    else this.phase = this.sceneThen;
  }

  /** Walk to a node in the next row and see what's there. */
  chooseNode(id: number): boolean {
    if (this.phase !== 'map' || !this.choices().includes(id)) return false;
    this.path.push(id);
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
        this.treasure = { coins: Math.round(this.tuning.map.treasureCoins * (0.6 + 0.8 * this.rng.next())), opened: false };
        this.phase = 'treasure';
        return;
      case 'rest':
        this.phase = 'rest';
        return;
      case 'shop':
        this.shop = this.rollShop();
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

  /** Call after every combat interaction: banks coins from kills, and moves on to the reward or defeat. */
  sync(): void {
    const c = this.combat;
    if (this.phase !== 'fight' || !c) return;
    for (const id of c.killQueue) this.coins += this.tuning.enemies[c.enemyById(id)?.key ?? '']?.coins ?? 0;
    c.killQueue.length = 0;
    if (c.result === 'lost') this.phase = 'defeat';
    else if (c.result === 'won') {
      const type = this.node?.type;
      // a fight leaves a boost pick; elites and bosses always offer something rare
      this.offerBoosts(type === 'elite' || type === 'boss', type === 'boss' ? 'actClear' : 'map');
    }
  }

  offerBoosts(min: boolean | Rarity, then: 'map' | 'actClear'): void {
    this.boostMin = min;
    this.boostThen = then;
    this.boostChoices = rollBoosts(this.rng, this.tuning, min);
    this.phase = 'boost';
  }

  pickBoost(index: number): void {
    if (this.phase !== 'boost') return;
    const offer = this.boostChoices[index];
    if (!offer) return;
    applyBoost(this.tuning, this.hero, offer);
    this.boostChoices = [];
    this.phase = this.boostThen;
  }

  /** Spend a reroll (bought at a shop) on a fresh set of cards. */
  rerollBoosts(): boolean {
    if (this.phase !== 'boost' || this.rerolls <= 0) return false;
    this.rerolls--;
    this.boostChoices = rollBoosts(this.rng, this.tuning, this.boostMin);
    return true;
  }

  /** Roll a fresh set of boost choices (a save from before the cards were rolled). */
  rollChoices(): BoostOffer[] {
    return rollBoosts(this.rng, this.tuning, this.boostMin);
  }

  /** Treasure: coins, then a rare-or-better boost pick. */
  openTreasure(): void {
    if (this.phase !== 'treasure' || !this.treasure || this.treasure.opened) return;
    this.treasure.opened = true;
    this.coins += this.treasure.coins;
    this.offerBoosts('rare', 'map');
  }

  /** Rest: heal a share of max HP. Returns how much. */
  rest(): number {
    if (this.phase !== 'rest') return 0;
    const H = this.hero;
    const heal = Math.min(heroMaxHp(this.tuning, H) - H.hp, Math.round(heroMaxHp(this.tuning, H) * this.tuning.map.restHeal));
    H.hp += Math.max(0, heal);
    this.phase = 'map';
    return Math.max(0, heal);
  }

  private rollShop(): ShopItem[] {
    const M = this.tuning.map;
    const cards = rollBoosts(this.rng, this.tuning).map((offer): ShopItem => ({ kind: 'boost', offer, price: cardPrice(this.tuning, offer.rarity), sold: false }));
    return [...cards, { kind: 'potion', offer: null, price: M.pricePotion, sold: false }, { kind: 'reroll', offer: null, price: M.priceReroll, sold: false }];
  }

  /** Buy shop item `i`. Returns false if it's sold out or Rowan can't afford it. */
  buy(i: number): boolean {
    const item = this.shop[i];
    if (this.phase !== 'shop' || !item || item.sold || this.coins < item.price) return false;
    this.coins -= item.price;
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
    const total = ch.outcomes.reduce((s, o) => s + (o.chance ?? 1), 0);
    let x = this.rng.next() * total;
    let k = 0;
    while (k < ch.outcomes.length - 1 && (x -= ch.outcomes[k].chance ?? 1) > 0) k++;
    ev.choice = i;
    ev.outcome = k;
    this.applyOutcome(ch.outcomes[k]);
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
    this.hero.hp = heroMaxHp(this.tuning, this.hero);
    if (this.actIndex + 1 < this.region.acts.length) this.enterAct(this.actIndex + 1, [this.region.acts[this.actIndex + 1].startScene ?? '']);
    else this.playScenes([this.region.victoryScene], 'victory');
  }

  /**
   * Debug (the tuning panel's "Jump to"): a fight against `enemies` in act `act`, on a node of that type
   * (a fight node mid-act, an elite, or the boss), with `hero`.
   */
  debugFight(act: number, enemies: string[], type: 'fight' | 'elite' | 'boss', hero: Hero): void {
    this.hero = { ...hero };
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

  /** After a defeat: the act again from its start, with the hero (and coins) as they entered it. */
  retry(): void {
    this.hero = { ...this.actHero, abilityTimer: 0 };
    this.coins = this.actCoins;
    this.rerolls = this.actRerolls;
    this.path = [];
    this.combat = null;
    this.boostChoices = [];
    this.phase = 'map';
  }
}
