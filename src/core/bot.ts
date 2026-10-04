// Headless player for balancing (pure; no DOM). It plays the real simulation tick by tick like a person would:
// it aims at whichever block the cursor reaches next (never a purple trap on purpose), taps no faster than a
// thumb can, and a share of its taps equal to its accuracy are well timed (landing inside the block, often in
// the perfect zone). The rest are mistimed by 60-200 ms and land wherever they land: empty bar, a trap, another
// block. Accuracy slips a little as the cursor speeds up. It swipes the finisher when it would kill, at max
// stacks, or when holding on for one more stack isn't worth the risk of a combo break losing them all (judged
// from how often its own combos have been breaking).

import { DT, type Combat, type CombatEvent } from './combat';
import { Rng } from './rng';
import { Run } from './run';
import { DEFAULT_SETTINGS, type Settings, type Tuning } from './tuning';

export interface BotOptions {
  accuracy: number; // share of well-timed taps (0..1)
  seed: number;
  gapMs?: number; // fastest tap rate (ms between taps)
  speedPenalty?: number; // accuracy lost per 1x of cursor speed above base
  maxStageSec?: number; // a stage running longer than this counts as a loss
}

export interface StageStats {
  stage: number;
  enemies: string[];
  boss: boolean;
  won: boolean;
  seconds: number; // sim time from the start of the stage to its last kill
  damage: number; // HP actually removed from enemies
  finisherDamage: number;
  finishers: number;
  maxStackFinishers: number;
  taps: number;
  misses: number;
  perfects: number;
  traps: number;
  hitsTaken: number;
  heroAtk: number; // attack and combo power going into the stage (kill growth and boosts included)
  comboPower: number;
  /** Boss stages: boss HP divided by what one max-stack finisher would deal at the stage's start. */
  bossVsMaxFinisher?: number;
}

export interface LevelStats {
  level: number;
  won: boolean;
  stages: StageStats[];
  revivesUsed: number;
}

const BOT_SETTINGS: Settings = { ...DEFAULT_SETTINGS, mode: 'classic', comboTiers: false, targeting: 'auto', godMode: false };

/** Play one level from its first stage with a fresh hero (the way the game starts every level). */
export function playLevel(tuning: Tuning, levelIndex: number, o: BotOptions): LevelStats {
  const rng = new Rng(o.seed ^ 0x2545f491);
  const run = new Run(tuning, { ...BOT_SETTINGS }, o.seed);
  run.startLevel(levelIndex);
  const out: LevelStats = { level: levelIndex, won: false, stages: [], revivesUsed: 0 };
  const startRevives = run.hero.revives;
  let guard = 0;
  while (guard++ < 100) {
    if (run.phase === 'fight') {
      const c = run.combat!;
      let st = out.stages.find((s) => s.stage === run.stageIndex);
      if (!st) {
        st = newStage(run, c);
        out.stages.push(st);
      }
      fight(run, c, st, rng, o);
      if (run.phase === 'fight') break; // timed out
    } else if (run.phase === 'boost') {
      const heal = run.boostChoices.indexOf('heal');
      const hurt = run.hero.hp < (tuning.hero.maxHp + run.hero.bonusMaxHp) * 0.5;
      run.pickBoost(hurt && heal >= 0 ? heal : rng.int(run.boostChoices.length));
    } else {
      out.won = run.phase === 'levelClear';
      break;
    }
  }
  out.revivesUsed = startRevives - run.hero.revives;
  return out;
}

function newStage(run: Run, c: Combat): StageStats {
  const T = run.tuning;
  const boss = c.enemies.some((e) => T.enemies[e.key].boss);
  const st: StageStats = {
    stage: run.stageIndex,
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
    hitsTaken: 0,
    heroAtk: (T.hero.atk + run.hero.bonusAtk) * (1 + run.hero.bonusDmg),
    comboPower: T.hero.comboPower + run.hero.bonusComboPower,
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

/** Run the fight until the stage's next kill is banked (phase leaves 'fight'), it is lost, or it times out. */
function fight(run: Run, c: Combat, st: StageStats, rng: Rng, o: BotOptions): void {
  const T = run.tuning;
  const gap = (o.gapMs ?? 120) / 1000;
  const maxSec = o.maxStageSec ?? 600;
  const hpLeft = new Map(c.enemies.map((e) => [e.id, e.hp]));
  let pending: Pending | null = null;
  let busyUntil = c.time;
  let breaks = 0;
  let combos = 0; // combo-building actions (hits and blocks), to estimate how risky waiting is
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());

  const tally = (events: CombatEvent[]) => {
    for (const e of events) {
      if (e.type === 'enemyHurt') {
        const left = hpLeft.get(e.enemyId) ?? 0;
        const dealt = Math.min(left, e.damage);
        hpLeft.set(e.enemyId, left - dealt);
        st.damage += dealt;
        if (e.source === 'finisher') st.finisherDamage += dealt;
      } else if (e.type === 'finisher') {
        st.finishers++;
        if (e.stacks >= Math.round(T.meter.maxStacks)) st.maxStackFinishers++;
      } else if (e.type === 'comboBreak') breaks++;
      else if (e.type === 'miss') st.misses++;
      else if (e.type === 'trap') st.traps++;
      else if (e.type === 'heroHurt' && e.source !== 'miss') st.hitsTaken++;
      if ((e.type === 'hit' || e.type === 'block') && e.perfect) st.perfects++;
      if (e.type === 'hit' || e.type === 'block') combos++;
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
    if (!pending && t >= busyUntil) pending = plan(c, rng, o, gauss);
    tally(c.drainEvents());
    st.seconds = t;
    run.sync();
  }
  st.won = c.enemies.every((e) => !e.alive);
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

/** Pick the next block the cursor will reach (not a trap) and schedule a tap for it. */
function plan(c: Combat, rng: Rng, o: BotOptions, gauss: () => number): Pending | null {
  const t = c.time;
  const cpos = c.cursorPosAt(t);
  const phase = ((c.phaseAt(t) % 2) + 2) % 2;
  const dir = phase < 1 ? 1 : -1;
  const v = c.cursorSpeed();
  const toWall = dir > 0 ? (1 - cpos) / v : cpos / v;
  let best: { tau: number; id: number; hw: number; rel: number } | null = null;
  for (const b of c.blocks) {
    if (b.kind === 'purple') continue;
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

export interface BalanceRow {
  accuracy: number;
  level: number;
  runs: number;
  winRate: number;
  avgFightSec: number; // per stage, stages that were won
  minFightSec: number; // shortest stage average
  maxFightSec: number; // longest stage average
  finisherShare: number; // finisher damage / all damage
  bossMaxFinishers: number; // average max-stack finishers used in won boss fights
  bossVsMaxFinisher: number; // average boss HP / one max-stack finisher (needs >= 2 when this is >= ~1.5-2)
  bossOneShotRate: number; // share of boss fights a single max-stack finisher could win
  stageSec: number[]; // average seconds per stage index (won stages)
  missRate: number; // misses per tap
  perfectRate: number;
  tapsPerSec: number;
  hitsTakenPerMin: number; // enemy attacks (and traps) that landed
  bossAtkGrowth: number; // hero attack going into the boss / at the start of the level
  bossComboPowerGrowth: number;
  lostAt: number[]; // runs lost, per stage index
}

/** Play `runs` levels per accuracy and summarise. */
export function balance(tuning: Tuning, levels: number[], accuracies: number[], runs: number, seed = 1): BalanceRow[] {
  const rows: BalanceRow[] = [];
  for (const acc of accuracies)
    for (const level of levels) {
      let wins = 0;
      let dmg = 0;
      let fin = 0;
      let taps = 0;
      let misses = 0;
      let perfects = 0;
      const stageSum: number[] = [];
      const stageN: number[] = [];
      let bossFights = 0;
      let bossMax = 0;
      let bossRatio = 0;
      let bossRatioN = 0;
      let oneShot = 0;
      let secs = 0;
      let taken = 0;
      let atkGrowth = 0;
      let cpGrowth = 0;
      let growthN = 0;
      const lostAt: number[] = [];
      for (let r = 0; r < runs; r++) {
        const res = playLevel(tuning, level, { accuracy: acc, seed: (seed * 7919 + r * 104729 + level * 31 + Math.round(acc * 1000)) >>> 0 });
        if (res.won) wins++;
        else {
          const last = res.stages[res.stages.length - 1]?.stage ?? 0;
          lostAt[last] = (lostAt[last] ?? 0) + 1;
        }
        const first = res.stages[0];
        for (const s of res.stages) {
          secs += s.seconds;
          taken += s.hitsTaken + s.traps;
          if (s.boss && first) {
            atkGrowth += s.heroAtk / first.heroAtk;
            cpGrowth += s.comboPower / first.comboPower;
            growthN++;
          }
          dmg += s.damage;
          fin += s.finisherDamage;
          taps += s.taps;
          misses += s.misses;
          perfects += s.perfects;
          if (s.won) {
            stageSum[s.stage] = (stageSum[s.stage] ?? 0) + s.seconds;
            stageN[s.stage] = (stageN[s.stage] ?? 0) + 1;
          }
          if (s.bossVsMaxFinisher !== undefined) {
            bossRatio += s.bossVsMaxFinisher;
            bossRatioN++;
            if (s.bossVsMaxFinisher <= 1) oneShot++;
            if (s.won) {
              bossFights++;
              bossMax += s.maxStackFinishers;
            }
          }
        }
      }
      const stageSec = stageSum.map((v, i) => v / Math.max(1, stageN[i]));
      const wonStages = stageN.reduce((a, b) => a + (b ?? 0), 0);
      rows.push({
        accuracy: acc,
        level,
        runs,
        winRate: wins / runs,
        avgFightSec: stageSum.reduce((a, b) => a + (b ?? 0), 0) / Math.max(1, wonStages),
        minFightSec: Math.min(...stageSec),
        maxFightSec: Math.max(...stageSec),
        finisherShare: dmg ? fin / dmg : 0,
        bossMaxFinishers: bossFights ? bossMax / bossFights : NaN,
        bossVsMaxFinisher: bossRatioN ? bossRatio / bossRatioN : NaN,
        bossOneShotRate: bossRatioN ? oneShot / bossRatioN : NaN,
        stageSec,
        missRate: taps ? misses / taps : 0,
        perfectRate: taps ? perfects / taps : 0,
        tapsPerSec: secs ? taps / secs : 0,
        hitsTakenPerMin: secs ? (taken / secs) * 60 : 0,
        bossAtkGrowth: growthN ? atkGrowth / growthN : NaN,
        bossComboPowerGrowth: growthN ? cpGrowth / growthN : NaN,
        lostAt: Array.from({ length: stageSec.length }, (_, i) => lostAt[i] ?? 0),
      });
    }
  return rows;
}
