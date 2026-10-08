// The anti-spam report (docs/balance-spam.md): npm run spam. Plays the whole campaign (three regions, a fresh profile
// per run, the same seeds as npm run campaign) at each accuracy and reports, per region:
//  - first-try clears per act and the boss's (or mini-boss's) first fight;
//  - each region's Act 3 (its fights, and its boss on its own): finishers per fight, max-stack finishers per fight,
//    stacks per finisher, the share of the bar the blocks cover (mean and peak), healing per fight as a share of max
//    HP (by source), misses forgiven, statics the crowding limit kept off the bar;
//  - the masher (core/bot.ts mashFrom: no aim, a tap every MASH_GAP_MS) on each region's Act 3 and on its boss, from
//    the hero a 75% player brings there (first try, clear within 6 tries, boss fights won).
//   RUNS=100  ACC=0.7,0.75,0.85  MASH=30 (masher runs per region; 0 = none)  MASHACC=0.75  HERO=rowan  OUT=path
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { MASH_GAP_MS, playCampaign, summarize, type FightStats, type RunStats } from '../../src/core/bot';
import { cloneTuning } from '../../src/core/tuning';
import { REGIONS, regionStart } from '../../src/data/regions';
import type { HeroId } from '../../src/data/heroes';

const RUNS = Number(process.env.RUNS ?? 100);
const ACCS = (process.env.ACC ?? '0.7,0.75,0.85').split(',').filter((x) => x && x !== 'none').map(Number); // ACC=none: the masher only
const MASH = Number(process.env.MASH ?? 30);
const MASHACC = Number(process.env.MASHACC ?? 0.75);
const HERO = (process.env.HERO ?? 'rowan') as HeroId;
const OUT = process.env.OUT ?? '/tmp/cq3-spam.md';

const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const out: string[] = [];
const say = (s: string) => {
  out.push(s);
  process.stderr.write(`${s}\n`);
};
const seedOf = (acc: number, r: number) => (7919 + r * 104729 + Math.round(acc * 1000)) >>> 0; // balanceCampaign's, seed 1
const lastActs = REGIONS.map((_, r) => regionStart(r) + REGIONS[r].acts.length - 1);

/** The late-act measures over a set of fights. */
function lateRow(label: string, fs: FightStats[]): string {
  const n = Math.max(1, fs.length);
  const heal = avg(fs.map((f) => Object.values(f.healBy).reduce((a, b) => a + b, 0) / Math.max(1, f.maxHp)));
  const by: Record<string, number> = {};
  for (const f of fs) for (const [k, v] of Object.entries(f.healBy)) by[k] = (by[k] ?? 0) + v / Math.max(1, f.maxHp);
  const top = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k} ${pct(v / n)}`)
    .join(', ');
  const fin = fs.reduce((a, f) => a + f.finishers, 0);
  return `| ${label} | ${fs.length} | ${f2(fin / n)} | **${f2(fs.reduce((a, f) => a + f.maxStackFinishers, 0) / n)}** | ${f2(fs.reduce((a, f) => a + f.finAtMax, 0) / n)} | ${f1(fs.reduce((a, f) => a + f.stacksSpent, 0) / Math.max(1, fin))} | ${pct(avg(fs.map((f) => f.coverMean)))} / ${pct(avg(fs.map((f) => f.coverPeak)))} / ${pct(Math.max(0, ...fs.map((f) => f.coverPeak)))} | **${pct(heal)}** (${top || '-'}) | ${pct(avg(fs.map((f) => f.healCut / Math.max(1, f.maxHp))))} | ${f2(fs.reduce((a, f) => a + f.forgiven, 0) / n)} / ${f2(fs.reduce((a, f) => a + f.softened, 0) / n)} | ${f1(fs.reduce((a, f) => a + f.misses, 0) / n)} | ${f1(fs.reduce((a, f) => a + f.refused, 0) / n)} | ${pct(avg(fs.map((f) => f.hpLost / Math.max(1, f.maxHp))))} | ${f1(avg(fs.filter((f) => f.won).map((f) => f.seconds)))} |`;
}

it('anti-spam report', () => {
  const t = cloneTuning();
  const t0 = Date.now();
  say(`# Anti-spam measures (${HERO}, ${RUNS} runs per accuracy; masher ${MASH} runs per region at ${MASH_GAP_MS} ms)`);
  for (const acc of ACCS) {
    const results: RunStats[] = Array.from({ length: RUNS }, (_, r) => playCampaign(t, { accuracy: acc, seed: seedOf(acc, r), hero: HERO }, REGIONS.length));
    const rows = summarize(results, acc, RUNS, Array.from({ length: regionStart(REGIONS.length) }, (_, i) => i));
    say(`\n## ${pct(acc)} player (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
    say('| Act | Reached | First try | Clear (6 tries) | Boss first fight | Fight s | Boss s |');
    say('|---|---|---|---|---|---|---|');
    for (const r of rows) say(`| ${r.act + 1} | ${pct(r.reached / r.runs)} | **${pct(r.firstTry)}** | ${pct(r.clearRate)} | ${pct(r.bossFirstTry)} | ${f1(r.fightSec)} | ${f1(r.bossSec)} |`);
    say('\nEach region\'s Act 3 (every fight of every attempt): finishers per fight; with 5+ stacks; at the max the hero had; stacks per finisher; bar covered mean / mean peak / highest; healed per fight (share of max HP; top sources); cut by the heal rules; misses forgiven / breaks softened per fight; misses; statics refused; HP lost; won fights\' length.\n');
    say('| Act 3 of | Fights | Finishers | **Max-stack** | At max | Stacks each | Covered | **Healed** | Heal cut | Forgiven / softened | Misses | Refused | HP lost | s |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [r, act] of lastActs.entries()) {
      const fs = results.flatMap((x) => x.acts.find((a) => a.act === act)?.attempts.flatMap((a) => a.fights) ?? []);
      say(lateRow(`region ${r + 1}: fights`, fs.filter((f) => f.type !== 'boss')));
      say(lateRow(`region ${r + 1}: boss`, fs.filter((f) => f.type === 'boss')));
    }
  }
  if (MASH > 0) {
    say(`\n## The masher (a tap every ${MASH_GAP_MS} ms, no aim), from the hero a ${pct(MASHACC)} player brings\n`);
    say('| Region | Act 3: runs that got there | first try | cleared (6 tries) | its boss fights won | Boss alone (the act played by the aiming bot): first fight won | every try | Masher misses per tap | taps/s |');
    say('|---|---|---|---|---|---|---|---|---|');
    for (let r = 0; r < REGIONS.length; r++) {
      const act = lastActs[r];
      const runs = Array.from({ length: MASH }, (_, k) => playCampaign(t, { accuracy: MASHACC, seed: seedOf(MASHACC, k), hero: HERO, mashFrom: act }, r + 1));
      const boss = Array.from({ length: MASH }, (_, k) => playCampaign(t, { accuracy: MASHACC, seed: seedOf(MASHACC, k), hero: HERO, mashFrom: act, mashBoss: true }, r + 1));
      const at = runs.map((x) => x.acts.find((a) => a.act === act)).filter((a) => !!a);
      const fights = at.flatMap((a) => a!.attempts.flatMap((x) => x.fights)).filter((f) => f.mashed);
      const bossFights = fights.filter((f) => f.type === 'boss');
      const alone = boss
        .map((x) => x.acts.find((a) => a.act === act))
        .flatMap((a) => a?.attempts.flatMap((x) => x.fights) ?? [])
        .filter((f) => f.type === 'boss' && f.mashed);
      const firsts = boss.map((x) => x.acts.find((a) => a.act === act)?.attempts.flatMap((y) => y.fights).find((f) => f.type === 'boss' && f.mashed)).filter((f) => !!f);
      const taps = fights.reduce((a, f) => a + f.taps, 0);
      say(
        `| ${r + 1} | ${at.length} | **${pct(at.filter((a) => a!.attempts[0]?.won).length / Math.max(1, at.length))}** | ${pct(at.filter((a) => a!.cleared).length / Math.max(1, at.length))} | ${bossFights.filter((f) => f.won).length} of ${bossFights.length} | **${firsts.filter((f) => f!.won).length} of ${firsts.length}** | ${alone.filter((f) => f.won).length} of ${alone.length} | ${pct(fights.reduce((a, f) => a + f.misses, 0) / Math.max(1, taps))} | ${f1(taps / Math.max(1, fights.reduce((a, f) => a + f.seconds, 0)))} |`,
      );
    }
  }
  say(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  writeFileSync(OUT, out.join('\n') + '\n');
});
