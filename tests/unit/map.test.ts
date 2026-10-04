// Act maps: about 8 rows, 2-3 nodes a row, links that never cross, the boss at the end, every node type present.
import { describe, expect, it } from 'vitest';
import { GREENMARCH } from '../../src/data/greenmarch';
import { buildActMap, validPath, type ActMap } from '../../src/core/map';

const maps = (n: number): Array<[number, ActMap]> =>
  GREENMARCH.acts.flatMap((act, a) => Array.from({ length: n }, (_, i): [number, ActMap] => [a, buildActMap(act, 1000 * a + i * 7 + 1)]));

describe('act maps', () => {
  it('are the same for the same seed', () => {
    expect(buildActMap(GREENMARCH.acts[0], 42)).toEqual(buildActMap(GREENMARCH.acts[0], 42));
    expect(buildActMap(GREENMARCH.acts[0], 42)).not.toEqual(buildActMap(GREENMARCH.acts[0], 43));
  });

  it('about 8 rows deep, 2-3 nodes a row, ending in the boss', () => {
    for (const [a, m] of maps(40)) {
      const act = GREENMARCH.acts[a];
      expect(m.rows).toHaveLength(act.rows + 1);
      for (const row of m.rows.slice(0, -1)) {
        expect(row.length).toBeGreaterThanOrEqual(2);
        expect(row.length).toBeLessThanOrEqual(3);
      }
      expect(m.rows[m.rows.length - 1]).toEqual([m.boss]);
      expect(m.nodes[m.boss].type).toBe('boss');
      expect(m.nodes[m.boss].enemies).toEqual(act.boss);
    }
  });

  it('every node can be reached and leads on; links go to the next row and never cross', () => {
    for (const [, m] of maps(40)) {
      for (const n of m.nodes) {
        if (n.type !== 'boss') expect(n.next.length, `node ${n.id}`).toBeGreaterThan(0);
        for (const id of n.next) expect(m.nodes[id].row).toBe(n.row + 1);
        if (n.row > 0) expect(m.nodes.some((p) => p.next.includes(n.id))).toBe(true);
      }
      for (let r = 0; r + 1 < m.rows.length; r++) {
        const edges = m.rows[r].flatMap((id) => m.nodes[id].next.map((c) => [m.nodes[id].col, m.nodes[c].col]));
        for (const [a, b] of edges) for (const [c, d] of edges) expect((a < c && b > d) || (a > c && b < d)).toBe(false);
      }
    }
  });

  it('most nodes offer two ways on', () => {
    let two = 0;
    let all = 0;
    for (const [, m] of maps(40))
      for (const n of m.nodes)
        if (n.type !== 'boss' && n.row < m.rows.length - 2) {
          all++;
          if (n.next.length >= 2) two++;
        }
    expect(two / all).toBeGreaterThan(0.55);
  });

  it('the first row is all fights, the row before the boss offers a rest, and every node type shows up', () => {
    for (const [a, m] of maps(40)) {
      expect(m.rows[0].every((id) => m.nodes[id].type === 'fight')).toBe(true);
      expect(m.rows[m.rows.length - 2].some((id) => m.nodes[id].type === 'rest')).toBe(true);
      const types = new Set(m.nodes.map((n) => n.type));
      for (const t of ['fight', 'elite', 'treasure', 'rest', 'shop', 'event', 'boss']) expect(types.has(t as never), `act ${a + 1}: ${t}`).toBe(true);
    }
  });

  it('fights and elites name their enemies; events name an event; rests come no earlier than row 4', () => {
    for (const [a, m] of maps(30)) {
      const act = GREENMARCH.acts[a];
      for (const n of m.nodes) {
        if (n.type === 'fight') expect([...act.fights.early, ...act.fights.late].map((g) => g.join('+'))).toContain(n.enemies.join('+'));
        if (n.type === 'elite') expect(act.elites.map((g) => g.join('+'))).toContain(n.enemies.join('+'));
        if (n.type === 'event') expect(n.event).not.toBe('');
        if (n.type === 'rest') expect(n.row).toBeGreaterThanOrEqual(3);
        if (n.type === 'fight' && n.row < 3) expect(act.fights.early.map((g) => g.join('+'))).toContain(n.enemies.join('+'));
      }
    }
  });

  it('validPath follows the links', () => {
    const m = buildActMap(GREENMARCH.acts[0], 5);
    const path = [m.rows[0][0]];
    while (m.nodes[path[path.length - 1]].next.length) path.push(m.nodes[path[path.length - 1]].next[0]);
    expect(validPath(m, path)).toBe(true);
    expect(path[path.length - 1]).toBe(m.boss);
    expect(validPath(m, [m.rows[1][0]])).toBe(false);
    expect(validPath(m, [path[0], path[2]])).toBe(false);
    expect(validPath(m, [])).toBe(true);
  });
});
