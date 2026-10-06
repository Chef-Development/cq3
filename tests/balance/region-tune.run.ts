// Tuning a later region fast: npm run region-tune. Plays Greenmarch once per seed and hero (cached in CACHE as the
// end-of-region profiles), then replays only region REGION from those profiles with the numbers in TUNE applied
// (paths into the tuning, e.g. TUNE='{"acts.3.hpMult":3.2,"enemies.rimehorn.hp":5200}'), and prints each act's
// first-try clear and boss first fight per hero (with the gap to Rowan), plus gems earned by the end of each region.
//   HEROES=rowan,sable  RUNS=100  ACC=0.85  REGION=1  CACHE=path  TUNE=json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { playRegion, playRun, summarize, TYPICAL_ACCURACY, type RunStats } from '../../src/core/bot';
import { treeOf } from '../../src/core/heroes';
import { newProfile, type Profile } from '../../src/core/profile';
import { cloneTuning, setPath } from '../../src/core/tuning';
import { HERO_IDS, type HeroId } from '../../src/data/heroes';
import { REGIONS, regionStart } from '../../src/data/regions';

const RUNS = Number(process.env.RUNS ?? 100);
const ACC = Number(process.env.ACC ?? TYPICAL_ACCURACY);
const REGION = Number(process.env.REGION ?? 1);
const HERO_LIST = (process.env.HEROES ? process.env.HEROES.split(',') : HERO_IDS) as HeroId[];
const CACHE = process.env.CACHE ?? `/tmp/cq3-region${REGION}-profiles-${Math.round(ACC * 100)}.json`;
const BRANCHES = !!process.env.BRANCHES;
const branchOf = (h: HeroId, skill: string | undefined): string => treeOf(h).find((b) => b.nodes.some((n) => n.id === skill))?.id ?? 'none';
const TUNE: Record<string, number> = process.env.TUNE ? JSON.parse(process.env.TUNE) : {};

const seedOf = (h: HeroId, r: number) => (7919 * (HERO_IDS.indexOf(h) + 1) + r * 104729 + Math.round(ACC * 1000)) >>> 0;
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%`.padStart(4) : '   -');

it('region tune', () => {
  const base = cloneTuning();
  const cache: Record<string, { profiles: Array<Profile | null>; gems: number[]; r1: RunStats[]; branches: string[] }> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  let dirty = false;
  for (const h of HERO_LIST) {
    const c = cache[h];
    if (c && c.profiles.length >= RUNS) continue;
    const profiles: Array<Profile | null> = [];
    const gems: number[] = [];
    const r1: RunStats[] = [];
    const branches: string[] = [];
    for (let r = 0; r < RUNS; r++) {
      const p = newProfile();
      const st = playRun(base, { accuracy: ACC, seed: seedOf(h, r), hero: h }, 6, regionStart(REGION), p);
      const won = st.acts.length === regionStart(REGION) && st.acts.every((a) => a.cleared);
      profiles.push(won ? JSON.parse(JSON.stringify(p)) : null);
      gems.push(p.counts.gemsEarned ?? 0);
      r1.push(st);
      branches.push(branchOf(h, p.heroes[h].skills[0]));
    }
    cache[h] = { profiles, gems, r1, branches };
    dirty = true;
    console.log(`cached ${h}`);
  }
  if (dirty) writeFileSync(CACHE, JSON.stringify(cache));

  const t = cloneTuning();
  for (const [k, v] of Object.entries(TUNE)) setPath(t, k, v);
  const lines: string[] = [];
  const firsts: Record<string, number[]> = {};
  for (const h of HERO_LIST) {
    const c = cache[h];
    const results: RunStats[] = [];
    const resultBranch: string[] = [];
    const gemsAfter: number[] = [];
    c.profiles.slice(0, RUNS).forEach((p0, r) => {
      if (!p0) return;
      const p = JSON.parse(JSON.stringify(p0)) as Profile;
      results.push(playRegion(t, { accuracy: ACC, seed: seedOf(h, r), hero: h }, p, REGION));
      resultBranch.push(c.branches[r]);
      gemsAfter.push(p.counts.gemsEarned ?? 0);
    });
    const acts = Array.from({ length: REGIONS[REGION].acts.length }, (_, i) => regionStart(REGION) + i);
    const rows = summarize(results, ACC, results.length, acts);
    const r1rows = summarize(c.r1.slice(0, RUNS), ACC, Math.min(RUNS, c.r1.length), Array.from({ length: regionStart(REGION) }, (_, i) => i));
    firsts[h] = [...r1rows, ...rows].map((r) => r.firstTry);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    lines.push(
      `${h.padEnd(7)} R1 ${r1rows.map((r) => `${pct(r.firstTry)}/${pct(r.bossFirstTry)}`).join(' ')} | won R1 ${results.length}/${Math.min(RUNS, c.profiles.length)} | ` +
        rows.map((r) => `A${r.act + 1} ${pct(r.firstTry)} boss ${pct(r.bossFirstTry)} clr ${pct(r.clearRate)} f${Math.round(r.fightSec)}s e${Math.round(r.eliteSec)}s b${Math.round(r.bossSec)}s hp>b ${pct(r.hpAtBoss)} lv ${r.levelAtBoss.toFixed(1)}`).join(' | ') +
        ` | gems R1 ${avg(c.gems.slice(0, RUNS)).toFixed(0)} R2 ${(avg(gemsAfter) - avg(c.gems.slice(0, RUNS))).toFixed(0)}`,
    );
    if (BRANCHES) {
      // by the branch the hero went down first (both regions' acts)
      const all = c.r1.slice(0, RUNS).map((st, i) => ({ st, b: c.branches[i] }));
      for (const b of [...new Set(c.branches.slice(0, RUNS))]) {
        const mine = all.filter((x) => x.b === b);
        const r1b = summarize(mine.map((x) => x.st), ACC, mine.length, Array.from({ length: regionStart(REGION) }, (_, i) => i));
        const idx = results.map((_, i) => i).filter((i) => resultBranch[i] === b);
        const r2b = summarize(idx.map((i) => results[i]), ACC, idx.length, acts);
        lines.push(`  ${h} ${b.padEnd(10)} n=${String(mine.length).padStart(3)} ` + [...r1b, ...r2b].map((r) => `${pct(r.firstTry)}/${pct(r.bossFirstTry)}`).join(' '));
      }
    }
  }
  if (firsts.rowan)
    for (const h of HERO_LIST)
      if (h !== 'rowan') lines.push(`  gap ${h.padEnd(7)} ${firsts[h].map((v, i) => `${Math.round((v - firsts.rowan[i]) * 100)}`.padStart(4)).join(' ')}`);
  console.log(`TUNE ${JSON.stringify(TUNE)}\n` + lines.join('\n'));
});
