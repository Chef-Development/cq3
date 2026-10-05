// The act map's extras (core/roam.ts): the Coin Rush and bounty stops, the secret, and the roamers (wandering packs
// and the travelling merchant): where they start, how they step, when the hero meets them, and that they never
// corner the hero or touch the boss, a rest or an elite.
import { describe, expect, it } from 'vitest';
import { GREENMARCH } from '../../src/data/greenmarch';
import { buildActMap, type ActMap } from '../../src/core/map';
import { actMap, addExtras, packAt, packCount, roamAt, roamable, roamerAt, type MapExtras } from '../../src/core/roam';
import { Rng } from '../../src/core/rng';
import { cloneTuning } from '../../src/core/tuning';

const T = cloneTuning();
const acts = GREENMARCH.acts.length;
const maps = (n: number): Array<{ act: number; seed: number; map: ActMap; x: MapExtras }> =>
  GREENMARCH.acts.flatMap((_, a) =>
    Array.from({ length: n }, (_, i) => {
      const seed = 1000 * a + i * 7 + 1;
      const { map, extras } = actMap(T, GREENMARCH, a, seed);
      return { act: a, seed, map, x: extras! };
    }),
  );

/** Every path from the start to the boss (the maps are small). */
function allPaths(map: ActMap): number[][] {
  const out: number[][] = [];
  const walk = (path: number[]) => {
    const here = path.length ? map.nodes[path[path.length - 1]] : null;
    const next = here ? here.next : map.rows[0];
    if (!next.length) return void out.push(path);
    for (const id of next) walk([...path, id]);
  };
  walk([]);
  return out;
}

describe('map extras', () => {
  it('leave the map itself as buildActMap made it, but for the stops they take over', () => {
    for (const { map, seed, act } of maps(20)) {
      const plain = buildActMap(GREENMARCH.acts[act], seed);
      expect(map.nodes.map((n) => n.next)).toEqual(plain.nodes.map((n) => n.next));
      map.nodes.forEach((n, i) => {
        if (n.type !== 'rush' && n.type !== 'bounty') expect(n).toEqual(plain.nodes[i]);
      });
    }
  });

  it('each act gets a Coin Rush mid-act on a fight node, a bounty board early, and a secret beside a node', () => {
    for (const { map, x, seed, act } of maps(30)) {
      const plain = buildActMap(GREENMARCH.acts[act], seed);
      const R = map.rows.length - 1;
      expect(x.rush, `act ${act} seed ${seed}`).toHaveLength(1);
      expect(x.bounty).toHaveLength(1);
      for (const id of x.rush) {
        expect(map.nodes[id].type).toBe('rush');
        // a fight mid-act (a map with no fight there: one near either end, or a spare chest or event)
        expect(['fight', 'event', 'treasure']).toContain(plain.nodes[id].type);
        expect(map.nodes[id].row).toBeGreaterThanOrEqual(1);
        expect(map.nodes[id].row).toBeLessThanOrEqual(R - 1);
        expect(map.nodes[id].waves).toEqual([]);
      }
      if (map.nodes.some((n, i) => plain.nodes[i].type === 'fight' && n.row >= 2 && n.row <= R - 2)) {
        for (const id of x.rush) expect(plain.nodes[id].type).toBe('fight');
      }
      for (const id of x.bounty) {
        expect(map.nodes[id].type).toBe('bounty');
        expect(['fight', 'event']).toContain(plain.nodes[id].type);
        expect(map.nodes[id].row).toBeGreaterThanOrEqual(1);
        expect(map.nodes[id].row).toBeLessThanOrEqual(3);
      }
      expect(x.secret).toBeGreaterThanOrEqual(0);
      expect(map.nodes[x.secret].type).not.toBe('boss');
      // every type the weights roll is still there
      for (const t of ['elite', 'treasure', 'rest', 'shop'] as const) expect(map.nodes.some((n) => n.type === t), t).toBe(true);
    }
  });

  it('the same seed gives the same extras; tuning turns them off', () => {
    const a = actMap(T, GREENMARCH, 1, 77);
    const b = actMap(T, GREENMARCH, 1, 77);
    expect(a).toEqual(b);
    const off = cloneTuning();
    off.extras.rush = 0;
    off.extras.bounty = 0;
    off.extras.secret = 0;
    off.roam.packsFirst = off.roam.packsLast = 0;
    off.roam.merchant = 0;
    const none = actMap(off, GREENMARCH, 1, 77);
    expect(none.extras).toEqual({ seed: 77, rush: [], bounty: [], secret: -1, roamers: [] });
    expect(none.map).toEqual(buildActMap(GREENMARCH.acts[1], 77));
    expect(actMap(T, GREENMARCH, 1, 77, false).extras).toBeNull();
  });

  it('later acts have more packs, each one of its act packs', () => {
    expect([0, 1, 2].map((a) => packCount(T, a, acts))).toEqual([1, 2, 2]);
    for (const { x, act } of maps(20)) {
      const packs = x.roamers.filter((r) => r.kind === 'pack');
      expect(packs).toHaveLength(packCount(T, act, acts));
      for (const p of packs) expect(GREENMARCH.acts[act].packs).toContainEqual(p.waves);
      expect(x.roamers.filter((r) => r.kind === 'merchant')).toHaveLength(1);
    }
  });
});

describe('roamers', () => {
  it('start apart on open nodes (packs from row 2: the first steps are always clear)', () => {
    for (const { map, x } of maps(30)) {
      const at = x.roamers.map((r) => r.start);
      expect(new Set(at).size).toBe(at.length);
      for (const r of x.roamers) {
        expect(roamable(map.nodes[r.start])).toBe(true);
        expect(map.nodes[r.start].row).toBeGreaterThanOrEqual(r.kind === 'pack' ? 2 : 1);
      }
      const s = roamAt(map, x, []);
      for (const id of map.rows[0]) expect(packAt(s, id)).toBeNull();
    }
  });

  it('step along the links each move, one step at a time, and say where they go next', () => {
    for (const { map, x } of maps(10)) {
      const rng = new Rng(x.seed);
      const path: number[] = [];
      let s = roamAt(map, x, path);
      while (true) {
        const here = path.length ? map.nodes[path[path.length - 1]] : null;
        const next = here ? here.next : map.rows[0];
        if (!next.length) break;
        // walk on, clear of the packs
        const clear = next.filter((id) => !packAt(s, id));
        path.push(clear[rng.int(clear.length)]);
        const after = roamAt(map, x, path);
        for (const r of after.roamers) {
          const was = s.roamers.find((q) => q.id === r.id);
          if (!was) continue; // (a merchant met)
          expect(r.at, 'it went where it said').toBe(was.next);
          const linked = (a: number, b: number) => a === b || map.nodes[a].next.includes(b) || map.nodes[b].next.includes(a);
          expect(linked(r.at, r.next), 'one link at a time').toBe(true);
        }
        s = after;
      }
    }
  });

  it('never stand on, or step to, the boss, a rest or an elite; never two on one node', () => {
    for (const { map, x } of maps(15))
      for (const path of allPaths(map))
        for (let k = 0; k <= path.length; k++) {
          const s = roamAt(map, x, path.slice(0, k));
          for (const r of s.roamers) {
            expect(roamable(map.nodes[r.at])).toBe(true);
            expect(roamable(map.nodes[r.next])).toBe(true);
          }
          const spots = s.roamers.flatMap((r) => (r.at === r.next ? [r.at] : [r.at, r.next]));
          expect(new Set(spots).size).toBe(spots.length);
        }
  });

  it('never block the way: wherever the hero stands, at least one next node meets no pack', () => {
    for (const { map, x } of maps(25))
      for (const path of allPaths(map))
        for (let k = 0; k < path.length; k++) {
          const s = roamAt(map, x, path.slice(0, k));
          const here = k ? map.nodes[path[k - 1]] : null;
          const next = here ? here.next : map.rows[0];
          expect(
            next.some((id) => !packAt(s, id)),
            `seed ${x.seed}, path ${path.slice(0, k).join(',')}`,
          ).toBe(true);
        }
  });

  it('meeting one: stepping onto its node, or onto the node it steps to; then it is gone', () => {
    let ambushes = 0;
    let merchants = 0;
    for (const { map, x } of maps(10))
      for (const path of allPaths(map))
        for (let k = 1; k <= path.length; k++) {
          const before = roamAt(map, x, path.slice(0, k - 1));
          const after = roamAt(map, x, path.slice(0, k));
          const node = path[k - 1];
          const want = roamerAt(before, node);
          expect(after.met?.id ?? null).toBe(want?.id ?? null);
          if (!want) continue;
          if (want.kind === 'pack') ambushes++;
          else merchants++;
          expect(after.met!.at).toBe(node);
          expect(after.roamers.some((r) => r.id === want.id)).toBe(false);
        }
    expect(ambushes).toBeGreaterThan(50);
    expect(merchants).toBeGreaterThan(20);
  });

  it('a hero who walks at random runs into a pack now and then, not every time', () => {
    let met = 0;
    let runs = 0;
    for (const { map, x } of maps(40)) {
      const rng = new Rng(x.seed ^ 99);
      const path: number[] = [];
      let packs = 0;
      while (true) {
        const here = path.length ? map.nodes[path[path.length - 1]] : null;
        const next = here ? here.next : map.rows[0];
        if (!next.length) break;
        path.push(next[rng.int(next.length)]);
        if (roamAt(map, x, path).met?.kind === 'pack') packs++;
      }
      runs++;
      met += packs;
    }
    const perAct = met / runs;
    expect(perAct).toBeGreaterThan(0.2);
    expect(perAct).toBeLessThan(1.6);
  });

  it('the same path always replays the same way', () => {
    const { map, x } = maps(1)[2];
    const path = [map.rows[0][0], map.nodes[map.rows[0][0]].next[0]];
    expect(roamAt(map, x, path)).toEqual(roamAt(map, x, path));
    expect(addExtras(buildActMap(GREENMARCH.acts[2], x.seed), GREENMARCH.acts[2], 2, acts, x.seed, T)).toEqual(x);
  });
});
