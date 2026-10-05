// Act maps (pure; seeded): a branching node map about 8 rows deep. Each row holds 2-3 nodes; every node links
// to 1-2 nodes in the next row (the links never cross), the first row is all fights, the row before the boss
// always offers a rest, and the last row is the act's boss. Node types follow the act's weights
// (src/data/greenmarch.ts), and each type shows up at least once per act.

import { EVENT_IDS } from '../data/events';
import type { ActDef, NodeType, RolledNode } from '../data/types';
import { Rng } from './rng';

export interface MapNode {
  id: number; // index into ActMap.nodes
  row: number;
  col: number; // position in its row (0 = top)
  of: number; // nodes in its row
  type: NodeType;
  next: number[]; // ids in the next row
  waves: string[][]; // fight, elite and boss nodes: the foes, one wave after another (each wave fights at once)
  enemies: string[]; // every foe in its waves, in order
  event: string; // event nodes
}

export interface ActMap {
  nodes: MapNode[];
  rows: number[][]; // node ids per row, the boss row last
  boss: number; // id of the boss node
}

type Pick = RolledNode;

/** Rows each node type may appear in (row 0 is always fights). */
function allowed(type: Pick, row: number, rows: number): boolean {
  switch (type) {
    case 'fight':
      return true;
    case 'elite':
      return row >= 2 && row <= rows - 2;
    case 'treasure':
    case 'event':
      return row >= 1;
    case 'shop':
      return row >= 2;
    case 'rest':
      return row >= 3;
  }
}

/** Whether two edges (a -> b) and (c -> d) between the same two rows cross. */
const crosses = (a: number, b: number, c: number, d: number) => (a < c && b > d) || (a > c && b < d);

export function buildActMap(act: ActDef, seed: number): ActMap {
  const rng = new Rng(seed);
  const R = Math.max(2, Math.round(act.rows));
  const nodes: MapNode[] = [];
  const rows: number[][] = [];
  const node = (row: number, col: number, of: number): MapNode => {
    const n: MapNode = { id: nodes.length, row, col, of, type: 'fight', next: [], waves: [], enemies: [], event: '' };
    nodes.push(n);
    return n;
  };
  for (let r = 0; r < R; r++) {
    const of = rng.next() < 0.5 ? 2 : 3;
    rows.push(Array.from({ length: of }, (_, c) => node(r, c, of).id));
  }
  const boss = node(R, 0, 1);
  boss.type = 'boss';
  rows.push([boss.id]);

  // links: overlapping slices of the two rows, then extra non-crossing links so most nodes offer two ways on
  for (let r = 0; r < R; r++) {
    const a = rows[r].map((id) => nodes[id]);
    const b = rows[r + 1].map((id) => nodes[id]);
    const edges: Array<[number, number]> = [];
    a.forEach((_p, i) =>
      b.forEach((_c, j) => {
        if (i / a.length < (j + 1) / b.length - 1e-9 && j / b.length < (i + 1) / a.length - 1e-9) edges.push([i, j]);
      }),
    );
    const order = a.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const i of order) {
      if (edges.filter(([x]) => x === i).length >= 2 || b.length < 2) continue;
      const mine = edges.filter(([x]) => x === i).map(([, y]) => y);
      const cands = [Math.min(...mine) - 1, Math.max(...mine) + 1].filter((j) => j >= 0 && j < b.length);
      if (rng.next() < 0.5) cands.reverse();
      const j = cands.find((jj) => !edges.some(([x, y]) => crosses(i, jj, x, y)));
      if (j !== undefined) edges.push([i, j]);
    }
    for (const [i, j] of edges) a[i].next.push(b[j].id);
    for (const p of a) p.next.sort((x, y) => nodes[x].col - nodes[y].col);
  }

  // node types
  const parents = (n: MapNode) => nodes.filter((p) => p.next.includes(n.id));
  const types = Object.keys(act.weights) as Pick[];
  const roll = (row: number): Pick => {
    const ok = types.filter((t) => allowed(t, row, R) && act.weights[t] > 0);
    const total = ok.reduce((s, t) => s + act.weights[t], 0);
    let x = rng.next() * total;
    for (const t of ok) if ((x -= act.weights[t]) <= 0) return t;
    return 'fight';
  };
  for (let r = 1; r < R; r++)
    for (const id of rows[r]) {
      const n = nodes[id];
      for (let k = 0; k < 10; k++) {
        const t = roll(r);
        // no two of the same special node back to back (rest after rest, shop after shop...)
        if (t !== 'fight' && parents(n).some((p) => p.type === t)) continue;
        n.type = t;
        break;
      }
    }
  // the row before the boss always offers a rest
  const last = rows[R - 1].map((id) => nodes[id]);
  if (!last.some((n) => n.type === 'rest')) last[rng.int(last.length)].type = 'rest';
  // every type at least once per act
  for (const t of ['elite', 'treasure', 'rest', 'shop', 'event'] as Pick[]) {
    if (nodes.some((n) => n.type === t)) continue;
    const spots = nodes.filter((n) => n.type === 'fight' && n.row > 0 && allowed(t, n.row, R) && !parents(n).some((p) => p.type === t) && !n.next.some((c) => nodes[c].type === t));
    if (spots.length) spots[rng.int(spots.length)].type = t;
  }

  // what each node holds: fights get waves of foes (more the deeper the row), an elite comes after an escort
  let events: string[] = [];
  const W = act.waves;
  const wavesAt = (r: number) => Math.max(1, Math.round(W.first + ((W.last - W.first) * r) / Math.max(1, R - 1)));
  /** `n` groups from `pool`, never the same group twice in a row. */
  const pickWaves = (pool: string[][], n: number): string[][] => {
    const out: string[][] = [];
    for (let i = 0; i < n; i++) {
      const prev = out[i - 1]?.join('+');
      const ok = pool.filter((p) => p.join('+') !== prev);
      out.push((ok.length ? ok : pool)[rng.int((ok.length ? ok : pool).length)].slice());
    }
    return out;
  };
  for (let r = 0; r <= R; r++) {
    const used: string[] = [];
    for (const id of rows[r]) {
      const n = nodes[id];
      if (n.type === 'boss') n.waves = [act.boss.slice()];
      else if (n.type === 'fight') n.waves = pickWaves(r < 3 ? act.fights.early : act.fights.late, wavesAt(r));
      else if (n.type === 'elite') {
        // a different elite on each node of the row where it can be
        const fresh = act.elites.filter((p) => !used.includes(p.join('+')));
        const elite = (fresh.length ? fresh : act.elites)[rng.int((fresh.length ? fresh : act.elites).length)];
        used.push(elite.join('+'));
        n.waves = [...pickWaves(act.fights.late, Math.max(0, Math.round(W.eliteEscort))), elite.slice()];
      } else if (n.type === 'event') {
        if (!events.length) events = EVENT_IDS.slice();
        n.event = events.splice(rng.int(events.length), 1)[0];
      }
      n.enemies = n.waves.flat();
    }
  }
  return { nodes, rows, boss: boss.id };
}

/** Each act's map seed, from the run's map seed. */
export const actSeed = (mapSeed: number, act: number): number => (mapSeed + Math.imul(act + 1, 0x85ebca6b)) >>> 0;

/** Whether `path` (node ids from row 0 on) follows the map's links. */
export function validPath(map: ActMap, path: number[]): boolean {
  for (let i = 0; i < path.length; i++) {
    const n = map.nodes[path[i]];
    if (!n || n.row !== i) return false;
    if (i > 0 && !map.nodes[path[i - 1]].next.includes(n.id)) return false;
  }
  return true;
}
