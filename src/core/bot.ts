// Headless player for balancing (pure; no DOM). It plays the real simulation tick by tick like a person would:
// it aims at whichever block the cursor reaches next (never a purple trap on purpose), taps no faster than a
// thumb can, and only at blocks it has had time to see. Its taps are aimed at the moment the cursor crosses the
// block's center, off by a human timing error in milliseconds (a normal spread, plus the odd lapse), and the real
// judge decides what they hit. So thin blocks, fast reds and a fast cursor are as hard for it as for a person:
// a block it crosses in 60 ms is missed far more often than one it crosses in 150 ms. "Accuracy" names the player:
// the share of plain yellow blocks (nominal width) they hit at the starting cursor speed.
// Sable (two cursors) it plays with two thumbs: each has its own timing error, tap rate and pending tap, aims its own
// cursor at the next block in its half, and a red goes to whichever cursor meets it first (never both thumbs on one).
// It reads telegraphs like a person: it holds off yellow while a shield is raised (as often as its accuracy) and
// waits out a frozen cursor. It swipes the finisher when it would kill, at max stacks, or when holding on for one
// more stack isn't worth the risk of a combo break.
// Between fights it walks the act's map picking nodes at random, takes Full Heal when hurt, otherwise the relic
// that fits its build best (synergy-greedy: most tags shared with what it owns, then the rarest), rests, buys what it
// can afford at shops, and picks event choices at random. It wears the best gear it has found (by item power),
// salvages Common and Uncommon items when the bag fills up, and spends skill points down one branch at a time.

import { eventById } from '../data/events';
import type { NodeType } from '../data/types';
import { SLOT_KEYS, slotOf } from '../data/gear';
import { DT, heroAtk, heroMaxHp, isRed, type Combat, type CombatEvent } from './combat';
import { itemPower, slotOfItem, upgradeCost } from './gear';
import { canLearn, learn, pointsLeft, treeOf, type HeroId } from './heroes';
import { equip, equippedItems, heroProgress, newProfile, salvageAll, upgrade, type Profile } from './profile';
import { rarityRank, sharedTags } from './relics';
import { Rng } from './rng';
import { RARITIES, Run, type BoostOffer } from './run';
import type { Block } from './combat';
import { DEFAULT_SETTINGS, type Settings, type Tuning } from './tuning';

export interface BotOptions {
  accuracy: number; // share of plain yellow blocks hit at the starting cursor speed (0..1); sets the timing spread
  seed: number;
  hero?: HeroId; // who plays (default Rowan); Sable is unlocked for the bot
  gapMs?: number; // fastest tap rate (ms between taps)
  reactMs?: number; // a block must have been on the bar this long before it can be tapped
  lapse?: number; // share of taps that go badly wrong (80-250 ms off): a glance away, a late thumb
  maxStageSec?: number; // a fight running longer than this counts as a loss
}

/** Inverse of the standard normal CDF (Acklam's approximation; |error| < 1e-8 over (0, 1)). */
function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) return -normInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * A player's timing spread (seconds, one standard deviation) from their accuracy: the spread at which they hit
 * `accuracy` of plain yellow blocks (nominal width, plus the cursor's width and the judge's grace) at the starting
 * cursor speed, lapses included.
 */
export function timingSpread(t: Tuning, accuracy: number, lapse = DEFAULT_LAPSE): number {
  const v = 1 / t.cursor.basePassSec;
  const half = (t.blocks.attackWidth + t.cursor.widthFrac) / 2 / v + t.judge.graceMs / 1000;
  const p = Math.min(0.999, Math.max(0.05, accuracy / (1 - lapse)));
  return half / normInv((1 + p) / 2);
}

const DEFAULT_LAPSE = 0.03;

/**
 * The player the difficulty curve is set for: the balance targets (tests/unit/bot.test.ts) are this player's odds.
 * To re-aim the curve at another player, `ACC=0.62 npm run retarget` (it writes docs/retarget.md).
 */
export const TYPICAL_ACCURACY = 0.7;

export interface FightStats {
  act: number;
  row: number;
  type: NodeType; // fight, elite or boss
  enemies: string[];
  boss: boolean;
  won: boolean;
  seconds: number; // sim time from the start of the fight to its end
  damage: number; // HP actually removed from enemies
  finisherDamage: number;
  finishers: number;
  maxStackFinishers: number;
  taps: number;
  misses: number;
  perfects: number;
  traps: number;
  counters: number; // yellow taps countered by a raised shield
  specials: number; // enemy specials fired
  hitsTaken: number;
  heroAtk: number; // attack and combo power going into the fight
  comboPower: number;
  hpStart: number; // hero HP share going in, and coming out
  hpEnd: number;
  /** Boss fights: boss HP divided by what one max-stack finisher would deal at the fight's start. */
  bossVsMaxFinisher?: number;
  /** Boss fights: one max-stack finisher could kill the boss outright (enough damage, and no phase gate to stop it). */
  bossOneShot?: boolean;
}

export interface ActAttempt {
  act: number;
  won: boolean;
  fights: FightStats[];
  nodes: NodeType[]; // the path walked
  revivesUsed: number;
  reachedBoss: boolean;
  lostAt: NodeType | null;
}

const BOT_SETTINGS: Settings = { ...DEFAULT_SETTINGS, mode: 'classic', comboTiers: false, targeting: 'auto', godMode: false };

export interface RunStats {
  /** Per act reached: every attempt (a retry from the act's start follows each defeat) and whether it was cleared. */
  acts: Array<{ act: number; attempts: ActAttempt[]; cleared: boolean }>;
}

/** A new run that skips the opening scenes (ready on Act 1's map, or act `act` to farm it). */
export function botRun(tuning: Tuning, seed: number, profile: Profile = newProfile(), act = 0): Run {
  const run = new Run(tuning, { ...BOT_SETTINGS }, seed, profile);
  run.startAct(act);
  run.skipScenes();
  return run;
}

/** Wear the strongest item found for each slot (the two strongest trinkets); make room when the bag is nearly full. */
export function equipBest(run: Run): void {
  const p = run.profile;
  const T = run.tuning;
  if (p.items.length >= T.gear.bagSize - 4) salvageAll(p, T, ['common', 'uncommon']);
  const ranked = p.items.slice().sort((a, b) => itemPower(T, b) - itemPower(T, a));
  const used = new Set<number>();
  for (const k of SLOT_KEYS) {
    const best = ranked.find((i) => slotOfItem(i) === slotOf(k) && !used.has(i.uid));
    if (!best) continue;
    used.add(best.uid);
    if (p.equipped[k] !== best.uid) {
      // a trinket worn in the other trinket slot moves over
      for (const o of SLOT_KEYS) if (p.equipped[o] === best.uid) p.equipped[o] = 0;
      equip(p, best.uid, k);
    }
  }
  run.refreshGear();
}

/**
 * Play the whole region the way a person would: each act from its start, retrying from the act's start after a
 * defeat (with the hero as they entered it), then on to the next act with the upgrades earned. Gives up on an
 * act after `maxAttempts`.
 */
export function playRun(tuning: Tuning, o: BotOptions, maxAttempts = 6, acts = tuning.acts.length, profile: Profile = newProfile()): RunStats {
  const rng = new Rng(o.seed ^ 0x2545f491);
  if (o.hero && o.hero !== 'rowan') {
    profile.heroes[o.hero].unlocked = true;
    profile.hero = o.hero;
  }
  const run = botRun(tuning, o.seed, profile);
  const out: RunStats = { acts: [] };
  for (let a = 0; a < acts; a++) {
    const entry = { act: a, attempts: [] as ActAttempt[], cleared: false };
    out.acts.push(entry);
    for (let k = 0; k < maxAttempts && !entry.cleared; k++) {
      if (k > 0) run.retry();
      const res = playAct(run, rng, o);
      entry.attempts.push(res);
      entry.cleared = res.won;
    }
    if (!entry.cleared) break;
    if (run.phase === 'actClear') {
      run.nextAct();
      run.skipScenes();
    }
  }
  return out;
}

export interface FarmResult {
  story: RunStats; // the first playthrough, with the gear found on the way
  /** Each replay of the last act (for the Boar King's drops): its boss fight won the first time it came up, and cleared. */
  visits: Array<{ bossWon: boolean | null; cleared: boolean; power: number }>;
}

/**
 * Play the story once (fresh profile), then replay the last act `farms` times to farm the boss, keeping all gear.
 * With `forge`, between replays the bot salvages its spare Common-Rare items and upgrades what it wears.
 */
export function playFarm(tuning: Tuning, o: BotOptions, farms: number, forge = false): FarmResult {
  const profile = newProfile();
  const story = playRun(tuning, o, 6, tuning.acts.length, profile);
  const last = tuning.acts.length - 1;
  const visits: FarmResult['visits'] = [];
  const rng = new Rng(o.seed ^ 0x51ed27);
  for (let v = 0; v < farms; v++) {
    if (forge) forgeUp(tuning, profile);
    const run = botRun(tuning, (o.seed + 7919 * (v + 1)) >>> 0, profile, last);
    equipBest(run);
    const power = equippedItems(profile).reduce((n, i) => n + itemPower(tuning, i), 0);
    if (run.actIndex !== last) {
      // the story run never reached the last act: there is nothing to farm (no visit to count)
      visits.push({ bossWon: null, cleared: false, power });
      continue;
    }
    let bossWon: boolean | null = null;
    let cleared = false;
    for (let k = 0; k < 6 && !cleared; k++) {
      if (k > 0) run.retry();
      const res = playAct(run, rng, o);
      const boss = res.fights.find((f) => f.type === 'boss');
      if (bossWon === null && boss) bossWon = boss.won;
      cleared = res.won;
    }
    visits.push({ bossWon, cleared, power });
  }
  return { story, visits };
}

/** The bot at the forge: salvage spare Common to Rare items, then upgrade the worn items, cheapest first. */
export function forgeUp(t: Tuning, p: Profile): void {
  salvageAll(p, t, ['common', 'uncommon', 'rare']);
  for (let guard = 0; guard < 100; guard++) {
    const worn = equippedItems(p)
      .map((i) => ({ i, c: upgradeCost(t, i) }))
      .filter((x) => x.c && x.c.scrap <= p.scrap && x.c.coins <= p.coins)
      .sort((a, b) => a.c!.coins - b.c!.coins);
    if (!worn.length || upgrade(p, t, worn[0].i.uid) !== 'ok') break;
  }
}

/** One attempt at the current act, from wherever the run stands until the act is cleared or lost. */
export function playAct(run: Run, rng: Rng, o: BotOptions): ActAttempt {
  const out: ActAttempt = { act: run.actIndex, won: false, fights: [], nodes: [], revivesUsed: 0, reachedBoss: false, lostAt: null };
  const startRevives = run.hero.revives;
  for (let guard = 0; guard < 200; guard++) {
    const ph = run.phase;
    if (ph === 'scene') run.skipScenes();
    else if (ph === 'map') {
      const ch = run.choices();
      run.chooseNode(ch[rng.int(ch.length)]);
      const n = run.node!;
      out.nodes.push(n.type);
      if (n.type === 'boss') out.reachedBoss = true;
    } else if (ph === 'fight') {
      const st = fight(run, run.combat!, rng, o);
      out.fights.push(st);
      if (run.phase === 'fight') {
        run.phase = 'defeat'; // timed out
      }
    } else if (ph === 'loot') {
      run.collectLoot();
      equipBest(run);
      spendSkills(run, rng);
    } else if (ph === 'boost') run.pickBoost(botPick(run, rng));
    else if (ph === 'treasure') run.openTreasure();
    else if (ph === 'rest') run.rest();
    else if (ph === 'shop') {
      shop(run);
      run.leaveShop();
    } else if (ph === 'event') {
      // a random choice it can afford
      const order = (eventById(run.event?.id ?? '')?.choices ?? []).map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [order[i], order[j]] = [order[j], order[i]];
      }
      for (const i of order) if (run.chooseEvent(i)) break;
      run.endEvent();
      if (run.phase === 'event') {
        run.event = null;
        run.phase = 'map';
      }
    } else if (ph === 'actClear' || ph === 'victory') {
      out.won = true;
      break;
    } else if (ph === 'defeat') {
      out.lostAt = run.node?.type ?? null;
      break;
    } else break;
  }
  out.revivesUsed = startRevives - run.hero.revives;
  return out;
}

/** How much the bot wants a card: a relic by the tags it shares with what it owns (synergy-greedy), then rarity;
 *  a stat card by rarity, below any relic of its rarity. */
export function offerScore(run: Run, o: BoostOffer): number {
  if (o.id === 'relic' && o.relic) return 10 * sharedTags(o.relic, run.hero.relics).length + 2 * rarityRank(o.rarity) + 1;
  return 2 * RARITIES.indexOf(o.rarity);
}

/** The bot's pick: Full Heal when hurt; otherwise the card it wants most (a random one among equals). */
export function botPick(run: Run, rng: Rng): number {
  const offers = run.boostChoices;
  const heal = offers.findIndex((b) => b.id === 'heal');
  if (heal >= 0 && run.hero.hp < heroMaxHp(run.tuning, run.hero) * 0.5) return heal;
  const score = offers.map((o) => offerScore(run, o));
  const best = Math.max(...score);
  const top = offers.map((_, i) => i).filter((i) => score[i] === best);
  return top[rng.int(top.length)];
}

/**
 * Spend skill points down one branch at a time, finishing it before the next (a player's focus). The focus is the
 * branch of the first node the hero learned: rolled once per profile when the first point comes (so bots spread
 * evenly over the three branches), then read back from the profile; after it, the next branches in tree order.
 */
export function spendSkills(run: Run, rng: Rng): void {
  const p = run.profile;
  const hero = p.hero;
  const prog = heroProgress(p);
  if (pointsLeft(run.tuning, prog) <= 0) return;
  const tree = treeOf(hero);
  if (!tree.length) return;
  const focus = tree.findIndex((b) => b.nodes.some((n) => n.id === prog.skills[0]));
  const first = focus >= 0 ? focus : rng.int(tree.length);
  for (let k = 0; k < tree.length && pointsLeft(run.tuning, prog) > 0; k++) {
    const branch = tree[(first + k) % tree.length];
    for (const node of branch.nodes) if (canLearn(run.tuning, hero, prog, node.id) === 'ok') learn(run.tuning, hero, prog, node.id);
  }
  run.refreshGear();
}

/** Shop policy: Haggler's free buy on the dearest card, a potion when hurt, then the cards it wants most that it can
 *  afford. */
function shop(run: Run): void {
  const T = run.tuning;
  const cards = run.shop.map((item, i) => ({ item, i })).filter((x) => x.item.kind === 'boost' && x.item.offer);
  cards.sort((a, b) => offerScore(run, b.item.offer!) - offerScore(run, a.item.offer!));
  if (run.shopFree && cards.length) run.buy(cards.reduce((a, b) => (b.item.price > a.item.price ? b : a)).i);
  const potion = run.shop.findIndex((i) => i.kind === 'potion');
  if (run.hero.hp < heroMaxHp(T, run.hero) * 0.6 && potion >= 0) run.buy(potion);
  for (const { i } of cards) run.buy(i);
}

/**
 * Whether the bot aims at a block at all: never a purple trap, never a yellow while a raised shield is read. With
 * relics it plays them like a person: Purple Pact makes a trap a stack for a few HP (worth it while HP is above half
 * and a stack would bank); with Short Fuse a bomb left alone blows up on the enemies anyway, so it lets bombs come
 * (unless Powder Keg pays a stack for tapping one).
 */
export function wantsBlock(c: Combat, b: Block, guarded: boolean): boolean {
  if (b.kind === 'purple') return c.hasPerk('purplePact') && c.hero.hp > c.maxHp() * 0.5 && c.stacks < c.maxStacks();
  if (guarded && b.kind === 'yellow') return false;
  if (b.kind === 'bomb' && c.hasPerk('shortFuse') && !c.hasPerk('powderKeg')) return false;
  return true;
}

function newFight(run: Run, c: Combat): FightStats {
  const T = run.tuning;
  const n = run.node!;
  const boss = c.enemies.some((e) => T.enemies[e.key].boss);
  const st: FightStats = {
    act: run.actIndex,
    row: n.row,
    type: n.type,
    enemies: c.enemies.map((e) => e.key),
    boss,
    won: false,
    seconds: 0,
    damage: 0,
    finisherDamage: 0,
    finishers: 0,
    maxStackFinishers: 0,
    taps: 0,
    misses: 0,
    perfects: 0,
    traps: 0,
    counters: 0,
    specials: 0,
    hitsTaken: 0,
    heroAtk: heroAtk(T, run.hero),
    comboPower: T.hero.comboPower + run.hero.bonusComboPower,
    hpStart: run.hero.hp / heroMaxHp(T, run.hero),
    hpEnd: 0,
  };
  if (boss) {
    const b = c.enemies.find((e) => T.enemies[e.key].boss)!;
    const maxFin = Math.max(1, c.finisherDamage(Math.max(1, Math.round(T.meter.maxStacks))));
    st.bossVsMaxFinisher = b.hp / maxFin;
    st.bossOneShot = c.hpFloor(b) <= 0 && c.damageTaken(b, maxFin, 'finisher') >= b.hp;
  }
  return st;
}

interface Pending {
  at: number; // sim time of the tap
  blockId: number;
  err?: number; // Sable's thumbs: the timing error (s) it is aimed with, kept when it is re-aimed
}

/** Run the fight until it is won (the reward phase comes up), lost, or it times out. */
export function fight(run: Run, c: Combat, rng: Rng, o: BotOptions): FightStats {
  const T = run.tuning;
  const st = newFight(run, c);
  const gap = (o.gapMs ?? 140) / 1000;
  const maxSec = o.maxStageSec ?? 600;
  const react = (o.reactMs ?? 250) / 1000;
  const aim: Aim = { sigma: timingSpread(T, o.accuracy, o.lapse ?? DEFAULT_LAPSE), react, reactRed: react * 0.7, gap, lapse: o.lapse ?? DEFAULT_LAPSE };
  const hpLeft = new Map(c.enemies.map((e) => [e.id, e.hp]));
  let pending: Pending | null = null;
  let busyUntil = c.time;
  let breaks = 0;
  let combos = 0; // combo-building actions (hits and blocks), to estimate how risky waiting is
  // whether it reads the current raised shield and holds off yellow (a person mostly does)
  let readsGuard = true;
  let guardSeen = 0;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

  const tally = (events: CombatEvent[]) => {
    for (const e of events) {
      if (e.type === 'enemyHurt') {
        const left = hpLeft.get(e.enemyId) ?? 0;
        const dealt = Math.min(left, e.damage);
        hpLeft.set(e.enemyId, left - dealt);
        st.damage += dealt;
        if (e.source === 'finisher') st.finisherDamage += dealt;
      } else if (e.type === 'enemyHeal') hpLeft.set(e.enemyId, (hpLeft.get(e.enemyId) ?? 0) + e.amount);
      else if (e.type === 'summon' || e.type === 'split' || e.type === 'wave') for (const id of e.ids) hpLeft.set(id, c.enemyById(id)?.hp ?? 0);
      else if (e.type === 'finisher') {
        st.finishers++;
        if (e.stacks >= Math.round(T.meter.maxStacks)) st.maxStackFinishers++;
      } else if (e.type === 'comboBreak') breaks++;
      else if (e.type === 'miss') st.misses++;
      else if (e.type === 'trap') st.traps++;
      else if (e.type === 'counter') st.counters++;
      else if (e.type === 'special') st.specials++;
      else if (e.type === 'guardOn') {
        guardSeen++;
        readsGuard = rng.next() < o.accuracy;
      } else if (e.type === 'heroHurt' && e.source !== 'miss') st.hitsTaken++;
      if ((e.type === 'hit' || e.type === 'block' || e.type === 'wardBreak') && e.perfect) st.perfects++;
      if (e.type === 'hit' || e.type === 'block' || e.type === 'wardBreak') combos++;
    }
  };

  if (c.hands > 1) {
    // Sable: two thumbs, each with its own pending tap and tap rate, aiming its own cursor
    const thumbs: Thumb[] = [0, 1].map((hand) => ({ hand, pending: null, busyUntil: c.time }));
    while (run.phase === 'fight' && c.time < maxSec) {
      c.step();
      const t = c.time;
      for (const th of thumbs.slice().sort((a, b) => (a.pending?.at ?? Infinity) - (b.pending?.at ?? Infinity))) {
        const p = th.pending;
        if (!p) continue;
        if (!c.blocks.some((b) => b.id === p.blockId)) th.pending = null; // it's gone (bomb, finisher, the other thumb's echo)
        else if (t >= p.at) {
          c.tap(p.at, th.hand);
          st.taps++;
          th.busyUntil = p.at + gap;
          th.pending = null;
          // a person watches the cursor, not a clock: the other thumb's tap follows its cursor if this hit sped it
          // up or stopped the bar for a moment (a crit's hit-stop)
          const next = thumbs[1 - th.hand].pending;
          const aimed = next && c.blocks.find((x) => x.id === next.blockId);
          const tau = aimed ? meetTime(c, 1 - th.hand, aimed, t) : null;
          if (next && tau !== null && next.at > t) next.at = Math.max(t + DT, t + tau + (next.err ?? 0));
        }
      }
      const risk = (breaks + 3 * (1 - o.accuracy)) / (combos + 3);
      const free = thumbs.find((th) => !th.pending && t >= th.busyUntil);
      if (free && c.finisherReady && wantsFinisher(c, risk)) {
        c.finisher();
        free.busyUntil = t + 0.3; // the swipe itself takes a moment
        for (const th of thumbs) th.pending = null; // the cursors stop: both thumbs wait for them
      }
      if (c.cursorHold <= 0 && c.freeze <= 0)
        for (const th of thumbs) {
          if (th.pending || t < th.busyUntil) continue;
          const other = thumbs[1 - th.hand];
          th.pending = planTwin(c, th.hand, other, rng, aim, gauss, readsGuard && guardSeen > 0);
        }
      tally(c.drainEvents());
      st.seconds = t;
      run.sync();
    }
  } else {
    while (run.phase === 'fight' && c.time < maxSec) {
      c.step();
      const t = c.time;
      if (pending) {
        if (!c.blocks.some((b) => b.id === pending!.blockId)) pending = null; // it's gone (bomb, finisher): don't tap
        else if (t >= pending.at) {
          c.tap(pending.at);
          st.taps++;
          busyUntil = pending.at + gap;
          pending = null;
        }
      }
      // break risk per combo action: what has happened so far, starting from a guess based on accuracy
      const risk = (breaks + 3 * (1 - o.accuracy)) / (combos + 3);
      if (!pending && t >= busyUntil && c.finisherReady && wantsFinisher(c, risk)) {
        c.finisher();
        busyUntil = t + 0.3; // the swipe itself takes a moment
      }
      // wait out a finisher's stopped cursor and a frozen one
      if (!pending && t >= busyUntil && c.cursorHold <= 0 && c.freeze <= 0) pending = plan(c, rng, aim, gauss, readsGuard && guardSeen > 0);
      tally(c.drainEvents());
      st.seconds = t;
      run.sync();
    }
  }
  st.won = run.phase !== 'defeat' && c.result === 'won';
  st.hpEnd = run.hero.hp / heroMaxHp(T, run.hero);
  return st;
}

/**
 * Swipe when it kills the current target, at max stacks, or when waiting for one more stack is a worse bet than
 * cashing in now: P(no break over the hits the next stack needs) x (damage with n+1 stacks / with n) < 1.
 */
function wantsFinisher(c: Combat, risk: number): boolean {
  const M = c.tuning.meter;
  const max = c.maxStacks(); // relics can raise it (Overcharge)
  if (c.stacks >= max) return true;
  const target = c.currentTarget();
  const kit = c.hands > 1 ? c.tuning.sable.fangMult : 1; // Twin Fang hits the target harder
  if (target && c.finisherDamage() * kit >= target.hp) return true;
  const hitsNeeded = Math.max(1, (1 - c.meter) / Math.max(0.01, M.perHit));
  const survive = Math.pow(1 - Math.min(0.95, risk), hitsNeeded);
  return survive * (c.finisherDamage(c.stacks + 1) / Math.max(1, c.finisherDamage())) < 1;
}

interface Aim {
  sigma: number; // timing spread (s)
  react: number; // s a block must have been visible for
  reactRed: number; // the same for reds
  gap: number; // s between taps
  lapse: number;
}

/**
 * Pick the next block the cursor will reach (not a trap; not a yellow while a raised shield is read; not one that
 * appeared too recently to react to) and schedule a tap at the moment the cursor crosses its center, plus a human
 * timing error. The judge decides what the tap actually lands on.
 */
function plan(c: Combat, rng: Rng, aim: Aim, gauss: () => number, avoidYellow: boolean): Pending | null {
  const t = c.time;
  const cpos = c.cursorPosAt(t);
  const phase = ((c.phaseAt(t) % 2) + 2) % 2;
  const dir = phase < 1 ? 1 : -1;
  const v = c.cursorSpeed();
  const toWall = dir > 0 ? (1 - cpos) / v : cpos / v;
  const guarded = avoidYellow && !!c.guarder();
  let best: { tau: number; id: number } | null = null;
  let red: { tau: number; id: number } | null = null;
  for (const b of c.blocks) {
    if (!wantsBlock(c, b, guarded)) continue;
    const rel = v * dir - b.vel; // closing speed (bar units/s)
    const tau = (b.pos - cpos) / rel;
    if (!(tau >= 0) || tau > Math.min(toWall, 0.6)) continue;
    // it popped up right in front of the cursor: no time to react (reds always come in from the right end, where
    // a player is watching for them, so they are noticed a little sooner)
    if (b.bornAt > t + tau - (isRed(b.kind) ? aim.reactRed : aim.react)) continue;
    if (!best || tau < best.tau) best = { tau, id: b.id };
    if (isRed(b.kind) && (!red || tau < red.tau)) red = { tau, id: b.id };
  }
  if (!best) return null;
  // defence first: skip a block if tapping it would leave no time to block the red right behind it
  if (red && red.id !== best.id && red.tau - best.tau < aim.gap) best = red;
  const err = rng.next() < aim.lapse ? (rng.next() < 0.5 ? -1 : 1) * (0.08 + rng.next() * 0.17) : gauss() * aim.sigma;
  return { at: Math.max(t + DT, t + best.tau + err), blockId: best.id };
}

interface Thumb {
  hand: number; // 0 = Sable's left cursor (A), 1 = the right one (B)
  pending: Pending | null;
  busyUntil: number;
}

/** When cursor `hand` meets block b (s from now), if it does before it turns at its half's end (or 0.6 s); else null.
 *  A hit-stop still running holds everything for that long first. */
function meetTime(c: Combat, hand: number, b: Block, t: number): number | null {
  const [lo, hi] = c.handRange(hand);
  const cpos = c.cursorPosAt(t, hand);
  const dir = c.cursorDirAt(t);
  const v = c.barSpeed(hand);
  const toWall = dir > 0 ? (hi - cpos) / v : (cpos - lo) / v;
  const tau = (b.pos - cpos) / (v * dir - b.vel);
  return tau >= 0 && tau <= Math.min(toWall, 0.6) ? tau + c.hitStop : null;
}

/**
 * Sable's plan for one thumb: the next block its own cursor reaches in its own half, or a red it meets before the
 * other cursor does (the other thumb takes a red it meets first, unless that thumb is tied up then; never both on
 * one red). Then defence first, as for Rowan, and the thumb's own timing error.
 */
function planTwin(c: Combat, hand: number, other: Thumb, rng: Rng, aim: Aim, gauss: () => number, avoidYellow: boolean): Pending | null {
  const t = c.time;
  const guarded = avoidYellow && !!c.guarder();
  let best: { tau: number; id: number } | null = null;
  let red: { tau: number; id: number } | null = null;
  for (const b of c.blocks) {
    if (!wantsBlock(c, b, guarded)) continue;
    const isR = isRed(b.kind);
    if (!isR && c.handOf(b.pos) !== hand) continue;
    if (other.pending?.blockId === b.id) continue; // the other thumb has it
    const tau = meetTime(c, hand, b, t);
    if (tau === null) continue;
    if (b.bornAt > t + tau - (isR ? aim.reactRed : aim.react)) continue;
    if (isR) {
      // the other cursor meets it first and that thumb is free by then to take it: leave it
      const to = meetTime(c, other.hand, b, t);
      if (to !== null && to < tau && other.busyUntil <= t + to && (!other.pending || other.pending.at + aim.gap <= t + to)) continue;
    }
    if (!best || tau < best.tau) best = { tau, id: b.id };
    if (isR && (!red || tau < red.tau)) red = { tau, id: b.id };
  }
  if (!best) return null;
  if (red && red.id !== best.id && red.tau - best.tau < aim.gap) best = red;
  const err = rng.next() < aim.lapse ? (rng.next() < 0.5 ? -1 : 1) * (0.08 + rng.next() * 0.17) : gauss() * aim.sigma;
  return { at: Math.max(t + DT, t + best.tau + err), blockId: best.id, err };
}

export interface ActRow {
  accuracy: number;
  act: number;
  runs: number;
  reached: number; // runs that got to this act
  firstTry: number; // cleared on the first attempt (of those that reached it)
  clearRate: number; // cleared within the attempts allowed
  attempts: number; // average attempts to clear it (of those that cleared)
  bossFirstTry: number; // the first fight against the act's boss was won (of runs that ever reached the boss)
  bossReach: number; // first attempts that reached the boss
  fightSec: number; // average seconds per won fight, by node type
  eliteSec: number;
  bossSec: number;
  finisherShare: number; // finisher damage / all damage
  bossVsMaxFinisher: number; // boss HP / one max-stack finisher at the hero's stats when the boss appears
  bossOneShotRate: number; // share of boss fights a single max-stack finisher could win (phase gates stop one)
  hpAtBoss: number; // hero HP share going into the boss
  missRate: number;
  counterRate: number; // countered yellow taps per guard seen... per fight with a knight
  hitsTakenPerMin: number;
  specialsPerMin: number;
  heroAtk: number; // hero attack entering the act
  lostAt: Record<string, number>; // lost attempts by node type
}

/** Play `runs` whole runs per accuracy and summarise every act (as `hero`: Rowan by default; the same seeds for
 *  either hero, so the two compare run for run). */
export function balance(tuning: Tuning, accuracies: number[], runs: number, seed = 1, maxAttempts = 6, acts = tuning.acts.length, hero?: HeroId): ActRow[] {
  const rows: ActRow[] = [];
  for (const acc of accuracies) {
    const results = Array.from({ length: runs }, (_, r) => playRun(tuning, { accuracy: acc, seed: (seed * 7919 + r * 104729 + Math.round(acc * 1000)) >>> 0, hero }, maxAttempts, acts));
    for (let act = 0; act < acts; act++) {
      const entries = results.map((res) => res.acts[act]).filter((e) => !!e);
      const n = Math.max(1, entries.length);
      const sum = { fin: 0, dmg: 0, taps: 0, misses: 0, secs: 0, taken: 0, specials: 0, counters: 0, knightFights: 0 };
      const by: Record<string, { s: number; n: number }> = { fight: { s: 0, n: 0 }, elite: { s: 0, n: 0 }, boss: { s: 0, n: 0 } };
      let bossRatio = 0;
      let bossRatioN = 0;
      let oneShot = 0;
      let hpAtBoss = 0;
      let hpAtBossN = 0;
      let bossFirstN = 0;
      let bossFirstWon = 0;
      let atk = 0;
      const lostAt: Record<string, number> = {};
      for (const e of entries) {
        atk += e.attempts[0]?.fights[0]?.heroAtk ?? 0;
        let bossSeen = false;
        for (const att of e.attempts) {
          if (!att.won && att.lostAt) lostAt[att.lostAt] = (lostAt[att.lostAt] ?? 0) + 1;
          for (const f of att.fights) {
            sum.fin += f.finisherDamage;
            sum.dmg += f.damage;
            sum.taps += f.taps;
            sum.misses += f.misses;
            sum.secs += f.seconds;
            sum.taken += f.hitsTaken + f.traps + f.counters;
            sum.specials += f.specials;
            if (f.enemies.includes('knight')) {
              sum.knightFights++;
              sum.counters += f.counters;
            }
            if (f.won && by[f.type]) {
              by[f.type].s += f.seconds;
              by[f.type].n++;
            }
            if (f.type === 'boss') {
              if (f.bossVsMaxFinisher !== undefined) {
                bossRatio += f.bossVsMaxFinisher;
                bossRatioN++;
                if (f.bossOneShot) oneShot++;
              }
              hpAtBoss += f.hpStart;
              hpAtBossN++;
              if (!bossSeen) {
                bossSeen = true;
                bossFirstN++;
                if (f.won) bossFirstWon++;
              }
            }
          }
        }
      }
      const cleared = entries.filter((e) => e.cleared);
      rows.push({
        accuracy: acc,
        act,
        runs,
        reached: entries.length,
        firstTry: entries.filter((e) => e.attempts[0]?.won).length / n,
        clearRate: cleared.length / n,
        attempts: cleared.length ? cleared.reduce((a, e) => a + e.attempts.length, 0) / cleared.length : NaN,
        bossFirstTry: bossFirstN ? bossFirstWon / bossFirstN : NaN,
        bossReach: entries.filter((e) => e.attempts[0]?.reachedBoss).length / n,
        fightSec: by.fight.n ? by.fight.s / by.fight.n : NaN,
        eliteSec: by.elite.n ? by.elite.s / by.elite.n : NaN,
        bossSec: by.boss.n ? by.boss.s / by.boss.n : NaN,
        finisherShare: sum.dmg ? sum.fin / sum.dmg : 0,
        bossVsMaxFinisher: bossRatioN ? bossRatio / bossRatioN : NaN,
        bossOneShotRate: bossRatioN ? oneShot / bossRatioN : NaN,
        hpAtBoss: hpAtBossN ? hpAtBoss / hpAtBossN : NaN,
        missRate: sum.taps ? sum.misses / sum.taps : 0,
        counterRate: sum.knightFights ? sum.counters / sum.knightFights : 0,
        hitsTakenPerMin: sum.secs ? (sum.taken / sum.secs) * 60 : 0,
        specialsPerMin: sum.secs ? (sum.specials / sum.secs) * 60 : 0,
        heroAtk: atk / n,
        lostAt,
      });
    }
  }
  return rows;
}
