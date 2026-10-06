// Mid-run save (pure; no DOM). iOS often reloads a home-screen web app after you switch away, so the run is
// saved at every node (every phase change) and whenever the page is hidden; the title screen offers Continue.
// A saved fight resumes with the same enemies (summons and boss phases included), hero and seed, on a fresh bar.

import { eventById } from '../data/events';
import { GREENMARCH } from '../data/greenmarch';
import { isRelicId } from '../data/relics';
import type { RegionDef } from '../data/types';
import type { Hero, SavedFoe } from './combat';
import type { AccEntry } from './accuracy';
import { validItem, type Item } from './gear';
import { actSeed, validPath } from './map';
import type { Profile } from './profile';
import { readQuest, type QuestState } from './quests';
import { actMap } from './roam';
import { BOOST_IDS, RARITIES, type Ambush, type BoostOffer, type EventState, type Phase, type PickThen, type Rarity, type Run, type SceneThen, type ShopItem, type TreasureState } from './run';
import type { Tuning } from './tuning';

// v3: Greenmarch's acts and node maps replaced the levels. v4: fights are waves of foes (the save keeps the wave).
// v5: gear. The coins moved to the profile's purse (kept between runs), the loot screen and the act's timing samples
// are saved. v6: relics (the hero's, the act-start checkpoint's, a replay's starting picks left). v7: the map's
// extras (core/roam.ts): whether this act has them, the bounty taken and its progress, the secret opened, an ambush
// being fought, the merchant's shop, a bounty's relic picks to come. The roamers aren't saved: they follow from the
// map's seed and the path (roamAt replays it). A v4 save is migrated (its coins go into the purse), a v5 one (no
// relics yet) and a v6 one (its act goes on without extras: the next act has them); older ones are dropped.
export const SAVE_VERSION = 7;

type SavedPhase = Exclude<Phase, 'title' | 'world' | 'victory' | 'camp'>;
const PHASES: SavedPhase[] = ['scene', 'map', 'fight', 'loot', 'boost', 'treasure', 'rest', 'shop', 'event', 'bounty', 'actClear', 'defeat'];
/** Where a saved pick leads (a skirmish isn't saved: no 'world'). */
type SavedThen = Exclude<PickThen, 'world'>;
const THENS: SavedThen[] = ['map', 'actClear', 'node'];

export interface RunSave {
  v: number;
  savedAt: number; // ms since epoch
  phase: SavedPhase;
  act: number;
  mapSeed: number;
  path: number[]; // node ids visited in this act
  hero: SavedHero;
  actHero: SavedHero; // the hero as they entered the act (a retry starts from here)
  rerolls: number;
  actRerolls: number;
  actSpent: number; // coins spent in the act that a retry refunds
  accuracy: AccEntry | null; // the act's accuracy (on the act-clear screen)
  scenes: string[];
  sceneThen: SceneThen;
  fight: { foes: SavedFoe[]; seed: number; wave: number } | null;
  boost: { choices: BoostOffer[]; min: boolean | Rarity; then: SavedThen } | null;
  shop: ShopItem[];
  event: EventState | null;
  treasure: TreasureState | null;
  loot: { items: Item[]; salvaged: number; min: boolean | Rarity; then: SavedThen } | null;
  aims: number[]; // the act's timing samples so far (its accuracy at the act clear)
  random: { seed: number; rng: number };
  startPicks: number; // a replay's starting relic picks still to make, of how many
  startPicksTotal: number;
  extras: boolean; // this act's map has its extras (false: a v6 save's act, which goes on without them)
  quest: QuestState | null; // the bounty taken in this act
  secret: boolean; // the act's secret cache was opened
  ambush: Ambush | null; // the ambush being fought
  merchant: boolean; // the shop on screen is the travelling merchant's
  bonusPicks: number; // a bounty's relic picks still to come
  pickKind: 'secret' | 'bounty' | null; // the pick on screen is a secret cache's or a bounty's
}

/** The hero as saved: the gear and the build aren't (they come from the profile when the run resumes). */
export type SavedHero = Omit<Hero, 'gear' | 'build'>;

const HERO_KEYS: Array<keyof SavedHero> = ['hp', 'bonusAtk', 'bonusMaxHp', 'bonusDmg', 'bonusCrit', 'bonusCritDmg', 'bonusComboPower', 'bonusPet', 'revives', 'abilityTimer'];

const savedHero = (h: Hero): SavedHero => {
  const { gear: _gear, build: _build, ...rest } = h;
  return { ...rest, relics: h.relics.slice(), abilityTimer: 0 };
};

/**
 * A save from an older build in this build's form, or the data as it is. v4 -> v5: the run's coins go into the
 * profile's purse (it's mutated; save both afterwards so it happens once).
 */
export function migrateSave(data: unknown, profile: Profile): unknown {
  let s = data as Record<string, unknown> | null;
  if (!s || typeof s !== 'object') return data;
  if (s.v === 4) {
    const coins = typeof s.coins === 'number' && Number.isFinite(s.coins) ? Math.max(0, Math.round(s.coins)) : 0;
    profile.coins += coins;
    const { coins: _c, actCoins: _a, ...rest } = s;
    s = { ...rest, v: 5, loot: null, aims: [], actSpent: 0, accuracy: null };
  }
  if (s.v === 5) {
    // v5 -> v6: no relics yet
    const noRelics = (h: unknown) => (h && typeof h === 'object' ? { ...(h as object), relics: [] } : h);
    s = { ...s, v: 6, hero: noRelics(s.hero), actHero: noRelics(s.actHero), startPicks: 0, startPicksTotal: 0 };
  }
  if (s.v === 6) {
    // v6 -> v7: the act in progress has no roamers, quest, rush or secret (its map was made before them)
    s = { ...s, v: 7, extras: false, quest: null, secret: false, ambush: null, merchant: false, bonusPicks: 0, pickKind: null };
  }
  return s;
}

/** Snapshot of a run in progress (null on the title screen, the world map and after the victory: nothing to resume). */
export function snapshotRun(run: Run, now = Date.now()): RunSave | null {
  // the camp saves as the screen it goes back to (from the world map: no run to save); so does a skirmish (it's
  // the world map's: it was used up when it began)
  const ph = run.phase === 'camp' ? (run.campFrom === 'world' ? 'world' : run.campFrom) : run.phase;
  if (ph === 'title' || ph === 'world' || ph === 'victory' || run.skirmish) return null;
  const c = run.combat;
  let phase: SavedPhase = ph;
  let fight: RunSave['fight'] = null;
  if (ph === 'fight' && c) {
    // kills whose reward is still waiting for the kill animation: bank their coins now
    run.bankKills();
    if (c.result === 'lost') phase = 'defeat';
    // a Coin Rush interrupted is over: the coins knocked out so far are kept (no second go by reloading)
    else if (c.rush) phase = 'map';
    else fight = { foes: c.saveFoes(), seed: run.fightSeed, wave: c.waveIndex };
  }
  const then = (t: PickThen): SavedThen => (t === 'world' ? 'map' : t);
  return {
    v: SAVE_VERSION,
    savedAt: now,
    phase,
    act: run.actIndex,
    mapSeed: run.mapSeed,
    path: run.path.slice(),
    hero: savedHero(run.hero),
    actHero: savedHero(run.actHero),
    rerolls: run.rerolls,
    actRerolls: run.actRerolls,
    actSpent: run.actSpent,
    accuracy: phase === 'actClear' && run.actAccuracy ? { ...run.actAccuracy } : null,
    scenes: run.sceneQueue.slice(),
    sceneThen: run.sceneThen,
    fight,
    boost: run.phase === 'boost' ? { choices: run.boostChoices.map((o) => ({ ...o })), min: run.boostMin, then: then(run.boostThen) } : null,
    shop: run.phase === 'shop' ? run.shop.map((i) => ({ ...i, offer: i.offer ? { ...i.offer } : null })) : [],
    event: run.phase === 'event' && run.event ? { ...run.event } : null,
    treasure: run.phase === 'treasure' && run.treasure ? { ...run.treasure } : null,
    loot: run.phase === 'loot' ? { items: run.loot.map((i) => ({ ...i, bonus: i.bonus.map((b) => ({ ...b })) })), salvaged: run.lootSalvaged, min: run.boostMin, then: then(run.boostThen) } : null,
    aims: run.actAims.slice(-1500),
    random: run.randomState,
    startPicks: run.startPicks,
    startPicksTotal: run.startPicksTotal,
    extras: !!run.extras,
    quest: run.quest ? { ...run.quest } : null,
    secret: run.secretFound,
    ambush: phase === 'fight' && run.ambush ? { ...run.ambush, waves: run.ambush.waves.map((w) => w.slice()) } : null,
    merchant: run.phase === 'shop' && run.merchant,
    bonusPicks: run.bonusPicks,
    pickKind: run.phase === 'boost' || run.phase === 'loot' || run.phase === 'treasure' ? run.pickKind : null,
  };
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const heroOk = (h: unknown): h is Hero => !!h && typeof h === 'object' && HERO_KEYS.every((k) => num((h as Hero)[k])) && Array.isArray((h as Hero).relics);
const offerOk = (o: unknown): o is BoostOffer => {
  const b = o as BoostOffer;
  if (!b || !RARITIES.includes(b.rarity)) return false;
  return b.id === 'relic' ? isRelicId(b.relic) : BOOST_IDS.includes(b.id);
};
/** Known relics only (one dropped from the game is dropped from the save), each once. */
const relicsOf = (h: SavedHero) => [...new Set(h.relics.filter(isRelicId))];

/** The save, if this build (and this region's data) can resume it; otherwise null. */
export function readSave(data: unknown, t: Tuning, region: RegionDef = GREENMARCH): RunSave | null {
  const s = data as RunSave;
  if (!s || typeof s !== 'object' || s.v !== SAVE_VERSION) return null;
  if (![s.act, s.mapSeed, s.rerolls, s.actRerolls, s.actSpent, s.savedAt].every(num)) return null;
  if (s.accuracy !== null && (!s.accuracy || ![s.accuracy.acc, s.accuracy.n, s.accuracy.act].every(num))) return null;
  if (!Array.isArray(s.aims) || !s.aims.every(num)) return null;
  if (!PHASES.includes(s.phase) || !heroOk(s.hero) || !heroOk(s.actHero)) return null;
  const act = region.acts[s.act];
  if (!act) return null;
  if (!Array.isArray(s.path) || !s.path.every(num)) return null;
  if (!Array.isArray(s.scenes) || !s.scenes.every((x) => typeof x === 'string') || !['map', 'fight', 'victory'].includes(s.sceneThen)) return null;
  if (!s.random || !num(s.random.seed) || !num(s.random.rng)) return null;
  if (!num(s.startPicks) || !num(s.startPicksTotal)) return null;
  if (typeof s.extras !== 'boolean' || typeof s.secret !== 'boolean' || typeof s.merchant !== 'boolean' || !num(s.bonusPicks)) return null;
  if (s.quest !== null && !readQuest(t, s.quest)) return null;
  if (![null, 'secret', 'bounty'].includes(s.pickKind)) return null;
  const known = (w: unknown) => Array.isArray(w) && w.length > 0 && w.every((g) => Array.isArray(g) && g.length > 0 && g.every((k) => typeof k === 'string' && !!t.enemies[k]));
  if (s.ambush !== null && (!s.ambush || !num(s.ambush.roamer) || !known(s.ambush.waves) || !['map', 'node'].includes(s.ambush.then))) return null;
  const map = actMap(t, region, s.act, actSeed(s.mapSeed, s.act), s.extras).map;
  if (!validPath(map, s.path)) return null;
  const node = s.path.length ? map.nodes[s.path[s.path.length - 1]] : null;
  const needsNode: SavedPhase[] = ['fight', 'boost', 'treasure', 'rest', 'shop', 'event', 'bounty', 'actClear'];
  // a replay's starting relic picks come before the first node
  const startPick = s.phase === 'boost' && s.startPicks > 0 && s.boost?.then === 'map';
  if (needsNode.includes(s.phase) && !node && !startPick) return null;
  if (s.phase === 'fight') {
    const f = s.fight;
    const waves = s.ambush ? s.ambush.waves.length : node!.waves.length;
    if (!f || !num(f.seed) || !num(f.wave) || f.wave < 0 || f.wave >= Math.max(1, waves) || !Array.isArray(f.foes) || !f.foes.length) return null;
    for (const e of f.foes) if (!e || !t.enemies[e.key] || ![e.hp, e.maxHp, e.phase, e.summoner, e.protect].every(num) || !Array.isArray(e.uses) || !e.uses.every(num)) return null;
  }
  if (s.phase === 'boost' && (!s.boost || !Array.isArray(s.boost.choices) || !s.boost.choices.every(offerOk) || !THENS.includes(s.boost.then))) return null;
  if (s.phase === 'shop' && (!Array.isArray(s.shop) || !s.shop.every((i) => i && ['boost', 'potion', 'reroll'].includes(i.kind) && num(i.price) && (i.kind !== 'boost' || offerOk(i.offer))))) return null;
  if (s.phase === 'event' && (!s.event || !eventById(s.event.id) || !num(s.event.outcome) || !num(s.event.choice))) return null;
  if (s.phase === 'treasure' && (!s.treasure || !num(s.treasure.coins))) return null;
  if (s.phase === 'loot' && (!s.loot || !Array.isArray(s.loot.items) || !s.loot.items.every(validItem) || !num(s.loot.salvaged) || !THENS.includes(s.loot.then))) return null;
  if (s.phase === 'bounty' && node?.type !== 'bounty') return null;
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
  run.rerolls = s.rerolls;
  const gear = run.gear;
  const build = run.build;
  run.hero = { ...s.hero, relics: relicsOf(s.hero), abilityTimer: 0, gear, build };
  // rebuild the act (map, checkpoint), then put the details back
  run.startPicks = 0;
  run.enterAct(s.act, [], s.extras);
  run.path = s.path.slice();
  run.quest = s.quest ? readQuest(run.tuning, s.quest) : null;
  run.secretFound = s.secret;
  run.ambush = s.ambush ? { ...s.ambush, waves: s.ambush.waves.map((w) => w.slice()) } : null;
  run.merchant = s.phase === 'shop' && s.merchant;
  run.bonusPicks = Math.max(0, Math.round(s.bonusPicks));
  run.pickKind = s.pickKind;
  run.actHero = { ...s.actHero, relics: relicsOf(s.actHero), abilityTimer: 0, gear, build };
  run.actRerolls = s.actRerolls;
  run.actSpent = Math.max(0, s.actSpent);
  run.rerolls = s.rerolls;
  run.hero = { ...s.hero, relics: relicsOf(s.hero), abilityTimer: 0, gear, build };
  run.startPicks = Math.max(0, Math.round(s.startPicks));
  run.startPicksTotal = Math.max(run.startPicks, Math.round(s.startPicksTotal));
  run.actAims = s.aims.slice();
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
    case 'loot':
      run.loot = s.loot!.items.map((i) => ({ ...i, bonus: i.bonus.map((b) => ({ ...b })) }));
      run.lootSalvaged = s.loot!.salvaged;
      run.boostMin = s.loot!.min;
      run.boostThen = s.loot!.then;
      run.phase = 'loot';
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
    case 'bounty':
      run.phase = 'bounty';
      break;
    case 'actClear':
      run.phase = 'actClear';
      run.actAccuracy = s.accuracy ? { ...s.accuracy } : null;
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
