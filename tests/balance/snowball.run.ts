// The snowball report: how the hero's growth (gear, levels, skills, relics, boost cards, kill gains) compares with
// the acts' enemies, on a fresh first playthrough and for a veteran (a full playthrough, then FARMS replays of Act 3
// with the forge, then Acts 1-3 replayed). Per act and node type: HP lost per fight (share of max HP), fight length,
// damage per second against the foes' HP, combo; and an ablation per source (the same seeds without it).
// RUNS=100 ACC=0.85,0.7 FARMS=6 ABL=1 npx vitest run --config vitest.balance.config.ts tests/balance/snowball.run.ts
import { it } from 'vitest';
import { botRun, equipBest, forgeUp, GREENMARCH_ACTS, playAct, playRun, type ActAttempt, type BotOptions, type FightStats } from '../../src/core/bot';
import { itemPower } from '../../src/core/gear';
import { equippedItems, heroProgress, newProfile, type Profile } from '../../src/core/profile';
import { levelFromXp } from '../../src/core/heroes';
import { Rng } from '../../src/core/rng';
import { cloneTuning, mergeKnown, type Tuning } from '../../src/core/tuning';

const RUNS = Number(process.env.RUNS ?? 100);
const ACCS = (process.env.ACC ?? '0.85,0.7').split(',').map(Number);
const FARMS = Number(process.env.FARMS ?? 6);
const ABL = process.env.ABL !== '0';
const VET = process.env.VET !== '0';
const ROWS = process.env.ROWS === '1';
const HERO = (process.env.HERO ?? 'rowan') as BotOptions['hero'];
const AVOID = (process.env.AVOID ?? '').split(',').filter(Boolean) as BotOptions['avoid'];

const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const f0 = (v: number) => (Number.isFinite(v) ? `${Math.round(v)}` : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const out = (s: string) => process.stderr.write(`${s}\n`);

interface Played {
  acts: Array<{ act: number; attempts: ActAttempt[] }>;
}

/** Per act and node type: what a fight costs and how it goes (every fight of every attempt; lengths of won ones). */
function fightTable(label: string, runs: Played[], acts = 3): string[] {
  const lines: string[] = [];
  lines.push(`\n### ${label}`);
  lines.push('| Act | Type | n | First try | HP lost / fight | of which reds | Healed | Fight s (won) | DPS | Foe HP | Avg / peak combo | Crit rate | Finisher | Reds taken/min | Max HP | ATK | DEF | Crit | Combo pwr | Level | Relics |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (let a = 0; a < acts; a++) {
    const entries = runs.map((r) => r.acts.find((x) => x.act === a)).filter((e) => !!e);
    const first = entries.filter((e) => e!.attempts[0]?.won).length / Math.max(1, entries.length);
    for (const type of ['fight', 'elite', 'boss']) {
      const fs: FightStats[] = entries.flatMap((e) => e!.attempts.flatMap((x) => x.fights)).filter((f) => f.type === type);
      if (!fs.length) continue;
      const won = fs.filter((f) => f.won);
      const secs = won.reduce((n, f) => n + f.seconds, 0);
      const dmg = won.reduce((n, f) => n + f.damage, 0);
      lines.push(
        `| ${a + 1} | ${type} | ${fs.length} | ${type === 'fight' ? pct(first) : ''} | **${pct(avg(fs.map((f) => f.hpLost / f.maxHp)))}** | ${pct(avg(fs.map((f) => f.hpRed / f.maxHp)))} | ${pct(avg(fs.map((f) => f.healed / f.maxHp)))} | ${f1(avg(won.map((f) => f.seconds)))} | ${f0(dmg / secs)} | ${f0(avg(fs.map((f) => f.enemyHp)))} | ${f1(avg(fs.map((f) => f.avgCombo)))} / ${f0(avg(fs.map((f) => f.peakCombo)))} | ${pct(fs.reduce((n, f) => n + f.crits, 0) / Math.max(1, fs.reduce((n, f) => n + f.hits, 0)))} | ${pct(fs.reduce((n, f) => n + f.finisherDamage, 0) / Math.max(1, fs.reduce((n, f) => n + f.damage, 0)))} | ${f1((fs.reduce((n, f) => n + f.redsTaken, 0) / Math.max(1, fs.reduce((n, f) => n + f.seconds, 0))) * 60)} | ${f0(avg(fs.map((f) => f.maxHp)))} | ${f1(avg(fs.map((f) => f.stats.atk)))} | ${f1(avg(fs.map((f) => f.stats.def)))} | ${pct(avg(fs.map((f) => f.stats.critChance)))} | ${f1(avg(fs.map((f) => f.stats.comboPower)))} | ${f1(avg(fs.map((f) => f.level)))} | ${f1(avg(fs.map((f) => f.relics.length)))} |`,
      );
    }
  }
  lines.push('\nNormal fights: damage by source, hits per second, DPS per ATK, reds:');
  for (let a = 0; a < acts; a++) {
    const fs = runs.flatMap((r) => r.acts.find((x) => x.act === a)?.attempts.flatMap((x) => x.fights) ?? []).filter((f) => f.type === 'fight' && f.won);
    const dmg = fs.reduce((n, f) => n + f.damage, 0);
    const secs = fs.reduce((n, f) => n + f.seconds, 0);
    const by: Record<string, number> = {};
    for (const f of fs) for (const [k, v] of Object.entries(f.dmgBy)) by[k] = (by[k] ?? 0) + v;
    const spawned = fs.reduce((n, f) => n + f.redsSpawned, 0);
    lines.push(
      `- Act ${a + 1}: ${Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v / dmg)}`).join(', ')}; hits/s ${f1(fs.reduce((n, f) => n + f.hits, 0) / secs)}; DPS/ATK ${f1(dmg / secs / avg(fs.map((f) => f.stats.atk)))}; reds/fight ${f1(spawned / fs.length)}, blocked ${f1(fs.reduce((n, f) => n + f.redsBlocked, 0) / fs.length)}, landed ${f1(fs.reduce((n, f) => n + f.redsTaken, 0) / fs.length)} (${pct(fs.reduce((n, f) => n + f.redsTaken, 0) / Math.max(1, spawned))})`,
    );
  }
  lines.push('\nWhere the stats come from (each act\'s fights, average going in):');
  for (let a = 0; a < acts; a++) {
    const fs = runs.flatMap((r) => r.acts.find((x) => x.act === a)?.attempts.flatMap((x) => x.fights) ?? []);
    const P = (k: string) => avg(fs.map((f) => f.parts[k]));
    lines.push(
      `- Act ${a + 1}: ATK ${f1(avg(fs.map((f) => f.stats.atk)))} = (base 10 + level ${f1(P('levelAtk'))} + run ${f1(P('runAtk'))} + gear ${f1(P('gearAtk'))}) x (1 + run ${pct(P('runDmg'))} + skills ${pct(P('skillAtkPct'))}); ` +
        `HP ${f0(avg(fs.map((f) => f.maxHp)))} = (base + level ${f0(P('levelHp'))} + run ${f0(P('runHp'))} + gear ${f0(P('gearHp'))}) x (1 + skills ${pct(P('skillHpPct'))} + set); ` +
        `DEF ${f1(avg(fs.map((f) => f.stats.def)))} (gear ${f1(P('gearDef'))}, skills ${f1(P('skillDef'))}); crit ${pct(avg(fs.map((f) => f.stats.critChance)))} (run ${pct(P('runCrit'))}, gear ${pct(P('gearCrit'))}, skills ${pct(P('skillCrit'))}); ` +
        `crit dmg x${f1(avg(fs.map((f) => f.stats.critDmg)))} (run ${f1(P('runCritDmg'))}, gear ${f1(P('gearCritDmg'))}); combo power ${f1(avg(fs.map((f) => f.stats.comboPower)))} (run ${f1(P('runCombo'))}, gear ${f1(P('gearCombo'))}); meter +${pct(avg(fs.map((f) => f.stats.meterGain)))}`,
    );
  }
  lines.push('\nHP lost per fight by source (share of max HP; all node types):');
  for (let a = 0; a < acts; a++) {
    const fs = runs.flatMap((r) => r.acts.find((x) => x.act === a)?.attempts.flatMap((x) => x.fights) ?? []);
    const by: Record<string, number> = {};
    for (const f of fs) for (const [k, v] of Object.entries(f.hpBy)) by[k] = (by[k] ?? 0) + v / f.maxHp;
    lines.push(`- Act ${a + 1}: ${Object.entries(by).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(100 * v / Math.max(1, fs.length)).toFixed(1)}%`).join(', ')}`);
    const bf = fs.filter((f) => f.type === 'boss');
    const bb: Record<string, number> = {};
    for (const f of bf) for (const [k, v] of Object.entries(f.hpBy)) bb[k] = (bb[k] ?? 0) + v / f.maxHp;
    lines.push(`  boss: ${Object.entries(bb).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(100 * v / Math.max(1, bf.length)).toFixed(1)}%`).join(', ')}; healed ${pct(avg(bf.map((f) => f.healed / f.maxHp)))}; ${f1(avg(bf.map((f) => f.seconds)))}s; reds ${f1(avg(bf.map((f) => f.redsSpawned)))} landed ${f1(avg(bf.map((f) => f.redsTaken)))}`);
  }
  if (ROWS) {
    lines.push('\nNormal fights by map row (HP lost / fight, fight s, DPS / foe HP):');
    for (let a = 0; a < acts; a++) {
      const fs = runs.flatMap((r) => r.acts.find((x) => x.act === a)?.attempts.flatMap((x) => x.fights) ?? []).filter((f) => f.type === 'fight');
      const cells: string[] = [];
      for (let row = 0; row < 7; row++) {
        const rf = fs.filter((f) => f.row === row);
        if (!rf.length) continue;
        cells.push(`r${row}: ${pct(avg(rf.map((f) => f.hpLost / f.maxHp)))} ${f1(avg(rf.filter((f) => f.won).map((f) => f.seconds)))}s ${f0(avg(rf.map((f) => f.enemyHp)))}hp`);
      }
      lines.push(`- Act ${a + 1}: ${cells.join(' | ')}`);
    }
  }
  return lines;
}

/** A first playthrough per seed (a fresh profile). */
function story(t: Tuning, acc: number, o: Partial<BotOptions> = {}): Played[] {
  return Array.from({ length: RUNS }, (_, r) => playRun(t, { accuracy: acc, seed: (1 * 7919 + r * 104729 + Math.round(acc * 1000)) >>> 0, hero: HERO, avoid: AVOID, ...o }));
}

/** The veteran: the story, FARMS replays of Act 3 (forging between them), then Acts 1-3 replayed once each. */
function veteran(t: Tuning, acc: number): { played: Played[]; level: number; power: number; farmWon: number[] } {
  const played: Played[] = [];
  let level = 0;
  let power = 0;
  const farmWon: number[] = Array.from({ length: FARMS }, () => 0);
  for (let r = 0; r < RUNS; r++) {
    const seed = (31337 + r * 7907 + Math.round(acc * 1000)) >>> 0;
    const o: BotOptions = { accuracy: acc, seed, hero: HERO, avoid: AVOID };
    const profile: Profile = newProfile();
    playRun(t, o, 6, GREENMARCH_ACTS, profile);
    const rng = new Rng(seed ^ 0x51ed27);
    const replay = (act: number, k: number): ActAttempt[] => {
      forgeUp(t, profile);
      const run = botRun(t, (seed + 7919 * (k + 1)) >>> 0, profile, act);
      equipBest(run);
      const atts: ActAttempt[] = [];
      if (run.actIndex !== act) return atts;
      for (let i = 0; i < 6; i++) {
        if (i > 0) run.retry();
        const res = playAct(run, rng, o);
        atts.push(res);
        if (res.won) break;
      }
      return atts;
    };
    for (let v = 0; v < FARMS; v++) {
      const atts = replay(2, v);
      const boss = atts.flatMap((a) => a.fights).find((f) => f.type === 'boss');
      if (boss?.won) farmWon[v]++;
    }
    const acts = [0, 1, 2].map((a) => ({ act: a, attempts: replay(a, 100 + a) }));
    played.push({ acts });
    level += levelFromXp(t, heroProgress(profile).xp);
    power += equippedItems(profile).reduce((n, i) => n + itemPower(t, i), 0);
  }
  return { played, level: level / RUNS, power: power / RUNS, farmWon: farmWon.map((w) => w / RUNS) };
}

/** Act 3 by the skill branch the hero focused (its first node) and by relic carried: the act's boss first fight
 *  won, and its normal fights' HP lost and length. */
function byPick(runs: Played[]): string[] {
  const lines: string[] = [];
  const firstNode: Record<string, string> = { keenEdge: 'Blade', stout: 'Bulwark', rhythm: 'Momentum', quickHands: 'Crossfire', wiry: 'Shadowguard', fleet: 'Quicksilver' };
  const stat = (fs: FightStats[], bossFs: FightStats[]) =>
    `boss won ${pct(bossFs.filter((f) => f.won).length / Math.max(1, bossFs.length))} (${bossFs.length}), fights ${pct(avg(fs.map((f) => f.hpLost / f.maxHp)))} HP ${f1(avg(fs.filter((f) => f.won).map((f) => f.seconds)))}s`;
  const act3 = runs.map((r) => r.acts.find((x) => x.act === 2)).filter((e) => !!e);
  const groups: Record<string, { fs: FightStats[]; boss: FightStats[] }> = {};
  for (const e of act3) {
    const all = e!.attempts.flatMap((a) => a.fights);
    const boss = all.find((f) => f.type === 'boss');
    const nf = all.filter((f) => f.type === 'fight');
    const keys = new Set<string>();
    const any = boss ?? nf[0];
    if (!any) continue;
    keys.add(`branch ${firstNode[any.skills[0]] ?? '(none)'}`);
    for (const k of any.skills.filter((k) => ['followThrough', 'whetstone', 'executioner', 'parry', 'shieldBash', 'shieldWall', 'doubleTime', 'chargedUp', 'unbroken', 'flurry', 'twinRhythm', 'whirlingBlades', 'crossGuard', 'counterSlash', 'afterimage', 'blur', 'doubleDown', 'quickening'].includes(k))) keys.add(`node ${k}`);
    for (const r of any.relics) keys.add(`relic ${r}`);
    for (const k of keys) {
      const g = (groups[k] ??= { fs: [], boss: [] });
      g.fs.push(...nf);
      if (boss) g.boss.push(boss);
    }
  }
  lines.push(`\nAct 3 by pick (all runs: ${stat(act3.flatMap((e) => e!.attempts.flatMap((a) => a.fights)).filter((f) => f.type === 'fight'), act3.map((e) => e!.attempts.flatMap((a) => a.fights).find((f) => f.type === 'boss')).filter((f): f is FightStats => !!f))}):`);
  for (const [k, g] of Object.entries(groups).sort((a, b) => b[1].boss.length - a[1].boss.length)) if (g.boss.length >= Math.max(5, act3.length * 0.05)) lines.push(`- ${k}: ${stat(g.fs, g.boss)}`);
  return lines;
}

/** First-try clear, boss first fight, HP lost per normal fight and normal fight length, per act. */
function summary(runs: Played[]): string {
  return [0, 1, 2]
    .map((a) => {
      const entries = runs.map((r) => r.acts.find((x) => x.act === a)).filter((e) => !!e);
      const first = entries.filter((e) => e!.attempts[0]?.won).length / Math.max(1, entries.length);
      const clear = entries.filter((e) => e!.attempts.some((x) => x.won)).length / Math.max(1, runs.length);
      const fights = entries.flatMap((e) => e!.attempts.flatMap((x) => x.fights));
      const boss = entries.map((e) => e!.attempts.flatMap((x) => x.fights).find((f) => f.type === 'boss')).filter((f) => !!f);
      const nf = fights.filter((f) => f.type === 'fight');
      const foes = (f: FightStats) => ((f.hpBy.red ?? 0) + (f.hpBy.bomb ?? 0) + (f.hpBy.trap ?? 0) + (f.hpBy.counter ?? 0)) / f.maxHp;
      return `A${a + 1} first ${pct(first)} clear ${pct(clear)} boss1st ${pct(boss.filter((f) => f!.won).length / Math.max(1, boss.length))} hpLost/fight ${pct(avg(nf.map((f) => f.hpLost / f.maxHp)))} (foes ${(100 * avg(nf.map(foes))).toFixed(1)}%, landed ${f1(avg(nf.map((f) => f.redsTaken)))}) elite ${pct(avg(fights.filter((f) => f.type === 'elite').map((f) => f.hpLost / f.maxHp)))} boss ${pct(avg(boss.map((f) => f!.hpLost / f!.maxHp)))} fight ${f1(avg(nf.filter((f) => f.won).map((f) => f.seconds)))}s`;
    })
    .join(' | ');
}

it('snowball report', () => {
  const base = cloneTuning();
  mergeKnown(base, JSON.parse(process.env.TUNE ?? '{}'));
  const t0 = Date.now();
  for (const acc of ACCS) {
    const fresh = story(base, acc);
    out(fightTable(`Fresh first playthrough, ${Math.round(acc * 100)}% player (${RUNS} runs)`, fresh).join('\n'));
    out(`summary ${Math.round(acc * 100)}%: ${summary(fresh)}`);
    if (process.env.PICKS === '1') out(byPick(fresh).join('\n'));
    if (ABL) {
      const variants: Array<[string, (t: Tuning) => void, Partial<BotOptions>?]> = [
        ['no gear', () => {}, { noGear: true }],
        ['no level stats', (t) => Object.assign(t.levels, { hpPer: 0, atkPer: 0 })],
        ['no skills', (t) => Object.assign(t.levels, { pointEvery: 999 })],
        ['stat cards for relics', (t) => Object.assign(t.relics, { on: 0 })],
        ['no stat cards', (t) => Object.assign(t.boosts, { maxHp: 0, damage: 0, crit: 0, critDmg: 0, comboPower: 0, pet: 0 })],
        ['no picks', (t) => (Object.assign(t.relics, { on: 0 }), Object.assign(t.boosts, { maxHp: 0, damage: 0, crit: 0, critDmg: 0, comboPower: 0, pet: 0 }))],
        ['no kill gains', (t) => Object.assign(t.kill, { atk: 0, maxHp: 0 })],
      ];
      for (const [name, f, o] of variants) {
        const t = cloneTuning(base);
        f(t);
        out(`  without ${name.padEnd(22)}: ${summary(story(t, acc, o))}`);
      }
    }
    if (VET) {
      const v = veteran(base, acc);
      out(fightTable(`Veteran ${Math.round(acc * 100)}%: story + ${FARMS} forged Act 3 farms, then Acts 1-3 replayed (level ${f1(v.level)}, gear power ${f0(v.power)}; farm boss wins ${v.farmWon.map(pct).join(' ')})`, v.played).join('\n'));
      out(`veteran summary ${Math.round(acc * 100)}%: ${summary(v.played)}`);
    }
  }
  out(`${((Date.now() - t0) / 1000).toFixed(0)} s`);
}, 3_600_000);
