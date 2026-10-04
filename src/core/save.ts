// Mid-run save (pure; no DOM). iOS often reloads a home-screen web app after you switch away, so the run is
// saved at every node (every phase change) and whenever the page is hidden; the title screen offers Continue.
// A saved fight resumes with the same enemies (summons and boss phases included), hero and seed, on a fresh bar.

import { eventById } from '../data/events';
import { GREENMARCH } from '../data/greenmarch';
import type { RegionDef } from '../data/types';
import type { Hero, SavedFoe } from './combat';
import { actSeed, buildActMap, validPath } from './map';
import { BOOST_IDS, RARITIES, type BoostOffer, type EventState, type Phase, type Rarity, type Run, type SceneThen, type ShopItem } from './run';
import type { Tuning } from './tuning';

// v3: Greenmarch's acts and node maps replaced the levels. v4: fights are waves of foes (the save keeps the wave).
// Older saves can't be resumed and are dropped.
export const SAVE_VERSION = 4;

type SavedPhase = Exclude<Phase, 'title' | 'world' | 'victory'>;
const PHASES: SavedPhase[] = ['scene', 'map', 'fight', 'boost', 'treasure', 'rest', 'shop', 'event', 'actClear', 'defeat'];

export interface RunSave {
  v: number;
  savedAt: number; // ms since epoch
  phase: SavedPhase;
  act: number;
  mapSeed: number;
  path: number[]; // node ids visited in this act
  hero: Hero;
  actHero: Hero; // the hero as they entered the act (a retry starts from here)
  coins: number;
  actCoins: number;
  rerolls: number;
  actRerolls: number;
  scenes: string[];
  sceneThen: SceneThen;
  fight: { foes: SavedFoe[]; seed: number; wave: number } | null;
  boost: { choices: BoostOffer[]; min: boolean | Rarity; then: 'map' | 'actClear' } | null;
  shop: ShopItem[];
  event: EventState | null;
  treasure: { coins: number; opened: boolean } | null;
  random: { seed: number; rng: number };
}

const HERO_KEYS: Array<keyof Hero> = ['hp', 'bonusAtk', 'bonusMaxHp', 'bonusDmg', 'bonusCrit', 'bonusCritDmg', 'bonusComboPower', 'bonusPet', 'revives', 'abilityTimer'];

/** Snapshot of a run in progress (null on the title screen, the world map and after the victory: nothing to resume). */
export function snapshotRun(run: Run, now = Date.now()): RunSave | null {
  if (run.phase === 'title' || run.phase === 'world' || run.phase === 'victory') return null;
  const c = run.combat;
  let phase: SavedPhase = run.phase;
  let coins = run.coins;
  let fight: RunSave['fight'] = null;
  if (run.phase === 'fight' && c) {
    // kills whose reward is still waiting for the kill animation: bank their coins now
    coins += c.killQueue.reduce((n, id) => n + (run.tuning.enemies[c.enemyById(id)?.key ?? '']?.coins ?? 0), 0);
    if (c.result === 'lost') phase = 'defeat';
    else fight = { foes: c.saveFoes(), seed: run.fightSeed, wave: c.waveIndex };
  }
  return {
    v: SAVE_VERSION,
    savedAt: now,
    phase,
    act: run.actIndex,
    mapSeed: run.mapSeed,
    path: run.path.slice(),
    hero: { ...run.hero, abilityTimer: 0 },
    actHero: { ...run.actHero, abilityTimer: 0 },
    coins,
    actCoins: run.actCoins,
    rerolls: run.rerolls,
    actRerolls: run.actRerolls,
    scenes: run.sceneQueue.slice(),
    sceneThen: run.sceneThen,
    fight,
    boost: run.phase === 'boost' ? { choices: run.boostChoices.map((o) => ({ ...o })), min: run.boostMin, then: run.boostThen } : null,
    shop: run.phase === 'shop' ? run.shop.map((i) => ({ ...i, offer: i.offer ? { ...i.offer } : null })) : [],
    event: run.phase === 'event' && run.event ? { ...run.event } : null,
    treasure: run.phase === 'treasure' && run.treasure ? { ...run.treasure } : null,
    random: run.randomState,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const heroOk = (h: unknown): h is Hero => !!h && typeof h === 'object' && HERO_KEYS.every((k) => num((h as Hero)[k]));
const offerOk = (o: unknown): o is BoostOffer => !!o && BOOST_IDS.includes((o as BoostOffer).id) && RARITIES.includes((o as BoostOffer).rarity);

/** The save, if this build (and this region's data) can resume it; otherwise null. */
export function readSave(data: unknown, t: Tuning, region: RegionDef = GREENMARCH): RunSave | null {
  const s = data as RunSave;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
  if (![s.act, s.mapSeed, s.coins, s.actCoins, s.rerolls, s.actRerolls, s.savedAt].every(num)) return null;
  if (!PHASES.includes(s.phase) || !heroOk(s.hero) || !heroOk(s.actHero)) return null;
  const act = region.acts[s.act];
  if (!act) return null;
  if (!Array.isArray(s.path) || !s.path.every(num)) return null;
  if (!Array.isArray(s.scenes) || !s.scenes.every((x) => typeof x === 'string') || !['map', 'fight', 'victory'].includes(s.sceneThen)) return null;
  if (!s.random || !num(s.random.seed) || !num(s.random.rng)) return null;
  const map = buildActMap(act, actSeed(s.mapSeed, s.act));
  if (!validPath(map, s.path)) return null;
  const node = s.path.length ? map.nodes[s.path[s.path.length - 1]] : null;
  const needsNode: SavedPhase[] = ['fight', 'boost', 'treasure', 'rest', 'shop', 'event', 'actClear'];
  if (needsNode.includes(s.phase) && !node) return null;
  if (s.phase === 'fight') {
    const f = s.fight;
    if (!f || !num(f.seed) || !num(f.wave) || f.wave < 0 || f.wave >= Math.max(1, node!.waves.length) || !Array.isArray(f.foes) || !f.foes.length) return null;
    for (const e of f.foes) if (!e || !t.enemies[e.key] || ![e.hp, e.maxHp, e.phase, e.summoner, e.protect].every(num) || !Array.isArray(e.uses) || !e.uses.every(num)) return null;
  }
  if (s.phase === 'boost' && (!s.boost || !Array.isArray(s.boost.choices) || !s.boost.choices.every(offerOk) || !['map', 'actClear'].includes(s.boost.then))) return null;
  if (s.phase === 'shop' && (!Array.isArray(s.shop) || !s.shop.every((i) => i && ['boost', 'potion', 'reroll'].includes(i.kind) && num(i.price) && (i.kind !== 'boost' || offerOk(i.offer))))) return null;
  if (s.phase === 'event' && (!s.event || !eventById(s.event.id) || !num(s.event.outcome) || !num(s.event.choice))) return null;
  if (s.phase === 'treasure' && (!s.treasure || !num(s.treasure.coins))) return null;
  return s;
}

/** Whether `data` is a save this build can resume. */
export function validSave(data: unknown, run: Run): boolean {
  return readSave(data, run.tuning, run.region) !== null;
}

/** Put a run back where the save left it. Returns false (and leaves the run alone) if the save doesn't fit. */
export function restoreRun(run: Run, data: unknown): boolean {
  const s = readSave(data, run.tuning, run.region);
  if (!s) return false;
  run.mapSeed = s.mapSeed >>> 0;
  run.coins = s.coins;
  run.rerolls = s.rerolls;
  run.hero = { ...s.hero, abilityTimer: 0 };
  // rebuild the act (map, checkpoint), then put the details back
  run.enterAct(s.act);
  run.path = s.path.slice();
  run.actHero = { ...s.actHero, abilityTimer: 0 };
  run.actCoins = s.actCoins;
  run.actRerolls = s.actRerolls;
  run.coins = s.coins;
  run.rerolls = s.rerolls;
  run.hero = { ...s.hero, abilityTimer: 0 };
  run.randomState = s.random;
  switch (s.phase) {
    case 'scene':
      run.playScenes(s.scenes, s.sceneThen);
      break;
    case 'map':
      run.phase = 'map';
      break;
    case 'fight':
      run.startFight(s.fight!);
      run.randomState = s.random;
      run.sync(); // saved between the last kill and the reward: move on to it
      break;
    case 'boost':
      run.boostMin = s.boost!.min;
      run.boostThen = s.boost!.then;
      run.boostChoices = s.boost!.choices.length ? s.boost!.choices.map((o) => ({ ...o })) : run.rollChoices();
      run.phase = 'boost';
      break;
    case 'treasure':
      run.treasure = { ...s.treasure! };
      run.phase = 'treasure';
      break;
    case 'rest':
      run.phase = 'rest';
      break;
    case 'shop':
      run.shop = s.shop.map((i) => ({ ...i, offer: i.offer ? { ...i.offer } : null }));
      run.phase = 'shop';
      break;
    case 'event':
      run.event = { ...s.event! };
      run.phase = 'event';
      break;
    case 'actClear':
      run.phase = 'actClear';
      break;
    case 'defeat':
      // the defeat screen's only way on is a retry: the act from its start
      run.retry();
      break;
  }
  return true;
}

/** "Act 1 - 3/8" for the Continue button. */
export function saveLabel(s: RunSave, run: Run): string {
  const act = run.region.acts[s.act];
  if (!act) return '';
  if (s.phase === 'actClear') return `Act ${s.act + 1} clear`;
  return `Act ${s.act + 1} - ${Math.max(1, s.path.length)}/${act.rows + 1}`;
}
