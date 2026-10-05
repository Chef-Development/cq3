// Rowan vs Sable on the same tuning (the same seeds, run for run): per act, the first-try clear and the act boss's
// first fight won, at the same accuracies. Sable's kit (tuning.sable) is tuned so the two are within +/-10 points.
// RUNS=150 ACC=0.7,0.85 TUNE='{"sable":{"atkMult":0.7}}' npx vitest run --config vitest.balance.config.ts tests/balance/twin.run.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { balance, type ActRow } from '../../src/core/bot';
import { cloneTuning, mergeKnown } from '../../src/core/tuning';
import { pts, twinTable } from './twin-table';

it('Rowan vs Sable', () => {
  const t = cloneTuning();
  mergeKnown(t, JSON.parse(process.env.TUNE ?? '{}'));
  const acc = (process.env.ACC ?? '0.7,0.85').split(',').map(Number);
  const runs = Number(process.env.RUNS ?? 150);
  const seed = Number(process.env.SEED ?? 1);
  const acts = Number(process.env.ACTS ?? t.acts.length);
  const t0 = Date.now();
  // Rowan's rows don't depend on tuning.sable: ROWAN_CACHE=file keeps them between Sable-only tunings
  const cache = process.env.ROWAN_CACHE;
  const rowan: ActRow[] = cache && existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : balance(t, acc, runs, seed, 6, acts);
  if (cache && !existsSync(cache)) writeFileSync(cache, JSON.stringify(rowan));
  const sable = balance(t, acc, runs, seed, 6, acts, 'sable');
  const worst = Math.max(...rowan.flatMap((r, i) => [Math.abs(sable[i].firstTry - r.firstTry), Math.abs(sable[i].bossFirstTry - r.bossFirstTry) || 0]));
  process.stderr.write(`${twinTable(rowan, sable)}\nworst gap ${pts(worst)} points; sable ${JSON.stringify(t.sable)}; ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
}, 1_800_000);
