// Scratch harness for trying tuning overrides with the bot: TUNE='{"enemies":{"slime":{"hp":700}}}' RUNS=200 npx vitest run --config vitest.balance.config.ts tests/balance/tune.run.ts
import { it } from 'vitest';
import { balance } from '../../src/core/bot';
import { cloneTuning, mergeKnown } from '../../src/core/tuning';
it('tune', () => {
  const t = cloneTuning();
  mergeKnown(t, JSON.parse(process.env.TUNE ?? '{}'));
  const rows = balance(t, [0, 1], (process.env.ACC ?? '0.7,0.85,0.95').split(',').map(Number), Number(process.env.RUNS ?? 200));
  for (const r of rows) process.stderr.write(`acc ${r.accuracy} L${r.level + 1}: win ${(r.winRate * 100).toFixed(1)}% fight ${r.avgFightSec.toFixed(1)}s [${r.stageSec.map((x) => x.toFixed(0)).join(', ')}] fin ${(r.finisherShare * 100).toFixed(0)}% bossMaxFin ${r.bossMaxFinishers.toFixed(2)} ratio ${r.bossVsMaxFinisher.toFixed(2)} oneShot ${(r.bossOneShotRate * 100).toFixed(0)}% miss ${(r.missRate * 100).toFixed(1)}% taken/min ${r.hitsTakenPerMin.toFixed(1)} growth ${r.bossAtkGrowth.toFixed(2)}/${r.bossComboPowerGrowth.toFixed(2)} lost@ ${r.lostAt.join('/')}\n`);
}, 1800000);
