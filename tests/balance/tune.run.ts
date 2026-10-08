// Scratch harness for trying tuning overrides with the bot:
// TUNE='{"enemies":{"slime":{"hp":700}}}' RUNS=200 ACC=0.85 ACTS=3 npx vitest run --config vitest.balance.config.ts tests/balance/tune.run.ts
import { it } from 'vitest';
import { balance } from '../../src/core/bot';
import { cloneTuning, mergeKnown } from '../../src/core/tuning';

const pct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(0)}%` : '-');
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-');

it('tune', () => {
  const t = cloneTuning();
  mergeKnown(t, JSON.parse(process.env.TUNE ?? '{}'));
  const t0 = Date.now();
  // ACTS: play only Greenmarch's first ACTS acts (faster when tuning an early act)
  const rows = balance(t, (process.env.ACC ?? '0.7,0.85,0.95').split(',').map(Number), Number(process.env.RUNS ?? 100), Number(process.env.SEED ?? 1), 6, Number(process.env.ACTS ?? 3));
  for (const r of rows)
    process.stderr.write(
      `acc ${r.accuracy} A${r.act + 1} (n=${r.reached}, atk ${f1(r.heroAtk)}): first ${pct(r.firstTry)} clear ${pct(r.clearRate)} tries ${f1(r.attempts)} boss1st ${pct(r.bossFirstTry)} reach ${pct(r.bossReach)} ` +
        `fight ${f1(r.fightSec)}s elite ${f1(r.eliteSec)}s boss ${f1(r.bossSec)}s hp@boss ${pct(r.hpAtBoss)} fin ${pct(r.finisherShare)} ratio ${f1(r.bossVsMaxFinisher)} miss ${pct(r.missRate)} taken/min ${f1(r.hitsTakenPerMin)} sp/min ${f1(r.specialsPerMin)} lost ${JSON.stringify(r.lostAt)}\n`,
    );
  process.stderr.write(`${((Date.now() - t0) / 1000).toFixed(1)} s\n`);
}, 1800000);
