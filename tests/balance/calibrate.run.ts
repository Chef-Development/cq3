// npm run calibrate: how the accuracy readout's raw timing spread relates to the bot's (core/accuracy.ts). Bots of
// known accuracy play whole runs; their measured raw spread is paired with their true one. Paste the printed table
// into SD_CALIBRATION.
import { it } from 'vitest';
import { rawSpread } from '../../src/core/accuracy';
import { botRun, GREENMARCH_ACTS, playAct, timingSpread } from '../../src/core/bot';
import { Rng } from '../../src/core/rng';
import { cloneTuning } from '../../src/core/tuning';

const RUNS = Number(process.env.RUNS ?? 12);

it('accuracy calibration', () => {
  const t = cloneTuning();
  const rows: Array<[number, number]> = [];
  for (const acc of [0.25, 0.35, 0.45, 0.55, 0.62, 0.7, 0.78, 0.85, 0.9, 0.95, 0.98]) {
    const errs: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const seed = 5000 + r * 13;
      const run = botRun(t, seed);
      const rng = new Rng(seed ^ 0x77);
      for (let a = 0; a < GREENMARCH_ACTS; a++) {
        playAct(run, rng, { accuracy: acc, seed });
        errs.push(...run.actAims);
        if (run.phase !== 'actClear') break;
        run.nextAct();
        run.skipScenes();
      }
    }
    const raw = rawSpread(errs)!;
    rows.push([Math.round(raw.sd * 10) / 10, Math.round(timingSpread(t, acc) * 10000) / 10]);
    process.stderr.write(`accuracy ${acc}: true ${rows.at(-1)![1]} ms, raw ${rows.at(-1)![0]} ms (n=${raw.n}, bias ${raw.bias.toFixed(1)})\n`);
  }
  rows.sort((a, b) => a[0] - b[0]);
  // keep it monotonic
  for (let i = 1; i < rows.length; i++) if (rows[i][1] < rows[i - 1][1]) rows[i][1] = rows[i - 1][1];
  process.stderr.write(`\nexport const SD_CALIBRATION: Array<[number, number]> = [\n  [0, 0],\n${rows.map(([a, b]) => `  [${a}, ${b}],`).join('\n')}\n];\n`);
}, 1_800_000);
