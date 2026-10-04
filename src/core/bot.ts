// Headless player for balancing (pure; no DOM). It plays the real simulation tick by tick like a person would:
// it aims at whichever block the cursor reaches next (never a purple trap on purpose), taps no faster than a
// thumb can, and a share of its taps equal to its accuracy are well timed (landing inside the block, often in
// the perfect zone). The rest are mistimed by 60-200 ms and land wherever they land: empty bar, a trap, another
// block. Accuracy slips a little as the cursor speeds up. It reads telegraphs like a person: it holds off yellow
// while a shield is raised (as often as its accuracy) and waits out a frozen cursor. It swipes the finisher when
// it would kill, at max stacks, or when holding on for one more stack isn't worth the risk of a combo break.
// Between fights it walks the act's map picking nodes at random, takes Full Heal when hurt (otherwise the rarest
// card), rests, buys what it can afford at shops, and picks event choices at random.

import { eventById } from '../data/events';
import type { NodeType } from '../data/types';
import { DT, heroMaxHp, type Combat, type CombatEvent } from './combat';
import { Rng } from './rng';
import { RARITIES, Run } from './run';
import { DEFAULT_SETTINGS, type Settings, type Tuning } from './tuning';

export interface BotOptions {
  accuracy: number; // share of well-timed taps (0..1)
  seed: number;
  gapMs?: number; // fastest tap rate (ms between taps)
  speedPenalty?: number; // accuracy lost per 1x of cursor speed above base
  maxStageSec?: number; // a fight running longer than this counts as a loss
}

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

/** A new run that skips the opening scenes (ready on Act 1's map). */
export function botRun(tuning: Tuning, seed: number): Run {
  const run = new Run(tuning, { ...BOT_SETTINGS }, seed);
  run.newRun();
  run.skipScenes();
  return run;
}

/**
 * Play the whole region the way a person would: each act from its start, retrying from the act's start after a
 * defeat (with the hero as they entered it), then on to the next act with the upgrades earned. Gives up on an
 * act after `maxAttempts`.
 */
export function playRun(tuning: Tuning, o: BotOptions, maxAttempts = 6, acts = tuning.acts.length): RunStats {
  const rng = new Rng(o.seed ^ 0x2545f491);
  const run = botRun(tuning, o.seed);
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

/** One attempt at the current act, from wherever the run stands until the act is cleared or lost. */
export function playAct(run: Run, rng: Rng, o: BotOptions): ActAttempt {
  const T = run.tuning;
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
    } else if (ph === 'boost') {
      // Full Heal when hurt; otherwise the strongest card, a random one among equals
      const offers = run.boostChoices;
      const heal = offers.findIndex((b) => b.id === 'heal');
      const hurt = run.hero.hp < heroMaxHp(T, run.hero) * 0.5;
      const rank = (i: number) => RARITIES.indexOf(offers[i].rarity);
      const best = Math.max(...offers.map((_, i) => rank(i)));
      const top = offers.map((_, i) => i).filter((i) => rank(i) === best);
      run.pickBoost(hurt && heal >= 0 ? heal : top[rng.int(top.length)]);
    } else if (ph === 'treasure') run.openTreasure();
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

/** Shop policy: a potion when hurt, then the rarest boost cards it can afford. */
function shop(run: Run): void {
  const T = run.tuning;
  const potion = run.shop.findIndex((i) => i.kind === 'potion');
  if (run.hero.hp < heroMaxHp(T, run.hero) * 0.6 && potion >= 0) run.buy(potion);
  const cards = run.shop.map((item, i) => ({ item, i })).filter((x) => x.item.kind === 'boost' && x.item.offer);
  cards.sort((a, b) => RARITIES.indexOf(b.item.offer!.rarity) - RARITIES.indexOf(a.item.offer!.rarity));
  for (const { i } of cards) run.buy(i);
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
    heroAtk: (T.hero.atk + run.hero.bonusAtk) * (1 + run.hero.bonusDmg),
    comboPower: T.hero.comboPower + run.hero.bonusComboPower,
    hpStart: run.hero.hp / heroMaxHp(T, run.hero),
    hpEnd: 0,
  };
  if (boss) {
    const hp = c.enemies.reduce((m, e) => Math.max(m, T.enemies[e.key].boss ? e.hp : 0), 0);
    st.bossVsMaxFinisher = hp / Math.max(1, c.finisherDamage(Math.max(1, Math.round(T.meter.maxStacks))));
  }
  return st;
}

interface Pending {
  at: number; // sim time of the tap
  blockId: number;
}

/** Run the fight until it is won (the reward phase comes up), lost, or it times out. */
function fight(run: Run, c: Combat, rng: Rng, o: BotOptions): FightStats {
  const T = run.tuning;
  const st = newFight(run, c);
  const gap = (o.gapMs ?? 120) / 1000;
  const maxSec = o.maxStageSec ?? 600;
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
      else if (e.type === 'summon' || e.type === 'split') for (const id of e.ids) hpLeft.set(id, c.enemyById(id)?.hp ?? 0);
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
    if (!pending && t >= busyUntil && c.cursorHold <= 0 && c.freeze <= 0) pending = plan(c, rng, o, gauss, readsGuard && guardSeen > 0);
    tally(c.drainEvents());
    st.seconds = t;
    run.sync();
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
  const max = Math.max(1, Math.round(M.maxStacks));
  if (c.stacks >= max) return true;
  const target = c.currentTarget();
  if (target && c.finisherDamage() >= target.hp) return true;
  const hitsNeeded = Math.max(1, (1 - c.meter) / Math.max(0.01, M.perHit));
  const survive = Math.pow(1 - Math.min(0.95, risk), hitsNeeded);
  return survive * (c.finisherDamage(c.stacks + 1) / Math.max(1, c.finisherDamage())) < 1;
}

/** Pick the next block the cursor will reach (not a trap; not a yellow while a raised shield is read) and schedule a tap. */
function plan(c: Combat, rng: Rng, o: BotOptions, gauss: () => number, avoidYellow: boolean): Pending | null {
  const t = c.time;
  const cpos = c.cursorPosAt(t);
  const phase = ((c.phaseAt(t) % 2) + 2) % 2;
  const dir = phase < 1 ? 1 : -1;
  const v = c.cursorSpeed();
  const toWall = dir > 0 ? (1 - cpos) / v : cpos / v;
  const guarded = avoidYellow && !!c.guarder();
  let best: { tau: number; id: number; hw: number; rel: number } | null = null;
  for (const b of c.blocks) {
    if (b.kind === 'purple' || (guarded && b.kind === 'yellow')) continue;
    const rel = v * dir - b.vel; // closing speed (bar units/s)
    const tau = (b.pos - cpos) / rel;
    if (!(tau >= 0) || tau > Math.min(toWall, 0.6)) continue;
    if (!best || tau < best.tau) best = { tau, id: b.id, hw: b.width / 2, rel: Math.abs(rel) };
  }
  if (!best) return null;
  const acc = Math.max(0, o.accuracy - (o.speedPenalty ?? 0.06) * (c.speedMult() - 1));
  if (rng.next() < acc) {
    // well timed: lands inside the block, closer to its center the better the player
    const sd = best.hw * Math.max(0.15, 1.3 - o.accuracy);
    const err = Math.max(-0.9 * best.hw, Math.min(0.9 * best.hw, gauss() * sd));
    return { at: Math.max(t + DT, t + best.tau + err / best.rel), blockId: best.id };
  }
  // mistimed: 60-200 ms early or late
  const off = (rng.next() < 0.5 ? -1 : 1) * (0.06 + rng.next() * 0.14);
  return { at: Math.max(t + DT, t + best.tau + off), blockId: best.id };
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
  bossOneShotRate: number; // share of boss fights a single max-stack finisher could win
  hpAtBoss: number; // hero HP share going into the boss
  missRate: number;
  counterRate: number; // countered yellow taps per guard seen... per fight with a knight
  hitsTakenPerMin: number;
  specialsPerMin: number;
  heroAtk: number; // hero attack entering the act
  lostAt: Record<string, number>; // lost attempts by node type
}

/** Play `runs` whole runs per accuracy and summarise every act. */
export function balance(tuning: Tuning, accuracies: number[], runs: number, seed = 1, maxAttempts = 6, acts = tuning.acts.length): ActRow[] {
  const rows: ActRow[] = [];
  for (const acc of accuracies) {
    const results = Array.from({ length: runs }, (_, r) => playRun(tuning, { accuracy: acc, seed: (seed * 7919 + r * 104729 + Math.round(acc * 1000)) >>> 0 }, maxAttempts, acts));
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
                if (f.bossVsMaxFinisher <= 1) oneShot++;
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
