// The first chest (docs/first-10.md): over many Act 1 maps, at which map row a newcomer meets their first treasure
// chest, walking as one would (a chest when one is offered, else a fight, never an elite). Rows are fights before it:
// row 1 = right after the first fight. `npx vitest run --config vitest.balance.config.ts tests/balance/first-chest.run.ts`
import { test } from 'vitest';
import { REGIONS } from '../../src/data/regions';
import { DEFAULT_TUNING } from '../../src/core/tuning';
import { actMap } from '../../src/core/roam';

test('first chest: the row a newcomer reaches it at, over Act 1 maps', () => {
  const N = Number(process.env.MAPS ?? 2000);
  const rows: Record<string, number> = {};
  let offered1 = 0;
  let chests = 0;
  const perRow: Record<string, number> = {};
  for (let seed = 1; seed <= N; seed++) {
    const { map } = actMap(DEFAULT_TUNING, REGIONS[0], 0, (seed * 2654435761) >>> 0);
    let choices = map.rows[0];
    let found = 'none';
    if (map.rows[1].some((id) => map.nodes[id].type === 'treasure')) offered1++;
    const k = `${map.rows[1].filter((id) => map.nodes[id].type === 'treasure').length}/${map.rows[1].length}`;
    perRow[k] = (perRow[k] ?? 0) + 1;
    chests += map.nodes.filter((n) => n.type === 'treasure').length;
    for (let r = 0; r < map.rows.length; r++) {
      const nodes = choices.map((id) => map.nodes[id]);
      const pick = nodes.find((n) => n.type === 'treasure') ?? nodes.find((n) => n.type === 'fight') ?? nodes.find((n) => n.type !== 'elite') ?? nodes[0];
      if (pick.type === 'treasure') {
        found = String(pick.row);
        break;
      }
      choices = pick.next;
      if (!choices.length) break;
    }
    rows[found] = (rows[found] ?? 0) + 1;
  }
  const out = Object.keys(rows)
    .sort()
    .map((k) => `row ${k}: ${((100 * rows[k]) / N).toFixed(1)}%`)
    .join('  ');
  process.stdout.write(`${N} maps; a chest in row 1 at all: ${((100 * offered1) / N).toFixed(1)}%\n${out}\nchests in row 1 (of its nodes): ${JSON.stringify(perRow)}; chests per map: ${(chests / N).toFixed(2)}\n`);
});
