// The Rowan vs Sable table (shared by tests/balance/twin.run.ts and balance.run.ts).
import type { ActRow } from '../../src/core/bot';

const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '-');
export const pts = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${Math.round(v * 100)}` : '-');
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-');

/** The comparison table (markdown): Rowan, Sable and the difference in points. */
export function twinTable(rowan: ActRow[], sable: ActRow[]): string {
  const head = '| Player | Act | First-try clear: Rowan / Sable (diff) | Boss first fight won: Rowan / Sable (diff) | Misses per tap | Hits taken per min | Fight s |';
  const sep = '|---|---|---|---|---|---|---|';
  const body = rowan.map((r, i) => {
    const s = sable[i];
    return `| ${pct(r.accuracy)} | ${r.act + 1} | ${pct(r.firstTry)} / ${pct(s.firstTry)} (**${pts(s.firstTry - r.firstTry)}**) | ${pct(r.bossFirstTry)} / ${pct(s.bossFirstTry)} (**${pts(s.bossFirstTry - r.bossFirstTry)}**) | ${pct(r.missRate)} / ${pct(s.missRate)} | ${f1(r.hitsTakenPerMin)} / ${f1(s.hitsTakenPerMin)} | ${f1(r.fightSec)} / ${f1(s.fightSec)} |`;
  });
  return [head, sep, ...body].join('\n');
}
