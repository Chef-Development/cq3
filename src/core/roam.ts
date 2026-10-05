// What an act map holds beyond the node types its weights roll (pure; seeded; no DOM). After buildActMap, addExtras
// places the act's extra stops on it: a Coin Rush (the mini-game) and a bounty board (a side quest) take over a
// fight or event node each, and a secret cache hides beside one node. It also sets who roams the map: 1-2 wandering
// packs (more in later acts) and a travelling merchant.
//
// Roamers step along the map's links (forward or back) each time the hero moves, and where each goes next is known a
// step ahead (the map shows it), so meeting one is a choice, not a surprise: stepping onto a roamer's node, or onto
// the node it is about to step to, meets it. A pack met is an ambush (core/run.ts: its foes as extra waves, a better
// reward); the merchant met opens her small shop. Either way that roamer is gone afterwards.
// The rules: roamers never stand on (or step to) the boss, a rest or an elite; two never share a node or a target;
// and after every step the hero can always go on without meeting a pack (at least one of the next nodes is clear),
// with a step of look-ahead so a pack never corners the hero. Everything follows from the map's seed and the path
// walked, so a saved run only needs the path (roamAt replays it).

import type { ActDef, RegionDef } from '../data/types';
import { buildActMap, type ActMap, type MapNode } from './map';
import { Rng } from './rng';
import type { Tuning } from './tuning';

export type RoamerKind = 'pack' | 'merchant';

/** A roamer as the act begins. */
export interface RoamerDef {
  id: number;
  kind: RoamerKind;
  start: number; // the node it starts on
  waves: string[][]; // a pack's foes (an ambush's extra waves); none for the merchant
}

/** The extras on an act's map. */
export interface MapExtras {
  seed: number;
  rush: number[]; // Coin Rush nodes (type 'rush')
  bounty: number[]; // bounty boards (type 'bounty')
  /** The node the secret cache hides beside (-1: none): standing there reveals it. */
  secret: number;
  roamers: RoamerDef[];
}

/** A roamer where it is now. */
export interface RoamerNow {
  id: number;
  kind: RoamerKind;
  at: number; // the node it stands on
  next: number; // where it steps when the hero next moves (=== at: it stays)
  waves: string[][];
}

export interface RoamState {
  /** Roamers still about (a pack beaten or the merchant met is gone). */
  roamers: RoamerNow[];
  /** The roamer met on the path's last step (an ambush or the merchant), if any. */
  met: RoamerNow | null;
}

/** Nodes a roamer may stand on or step to: not the boss, a rest or an elite. */
export const roamable = (n: MapNode | undefined): boolean => !!n && n.type !== 'boss' && n.type !== 'rest' && n.type !== 'elite';

const mix = (seed: number, k: number): number => (seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;

function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many packs roam act `act` (of `acts`): tuning roam.packsFirst ramping to packsLast. */
export function packCount(t: Tuning, act: number, acts: number): number {
  const R = t.roam;
  const k = acts > 1 ? act / (acts - 1) : 0;
  return Math.max(0, Math.round(R.packsFirst + (R.packsLast - R.packsFirst) * k));
}

/**
 * Place act `act`'s extras on its freshly built map (the rush and bounty nodes change type in place) and set who
 * roams it. Seeded from the act's map seed, so the same map always gets the same extras. Uses its own random
 * stream: the map itself comes out exactly as buildActMap made it.
 */
export function addExtras(map: ActMap, def: ActDef, act: number, acts: number, seed: number, t: Tuning): MapExtras {
  const rng = new Rng(mix(seed, 0x51ce7));
  const R = map.rows.length - 1; // rows before the boss's
  const parents = (n: MapNode) => map.nodes.filter((p) => p.next.includes(n.id));
  const near = (a: MapNode, b: MapNode) => a.next.includes(b.id) || b.next.includes(a.id);
  const pick = (cands: MapNode[]): MapNode | null => (cands.length ? cands[rng.int(cands.length)] : null);
  const out: MapExtras = { seed, rush: [], bounty: [], secret: -1, roamers: [] };
  const turn = (n: MapNode, type: 'rush' | 'bounty') => {
    n.type = type;
    n.waves = [];
    n.enemies = [];
    n.event = '';
  };
  // the bounty board early (rows 1-3: the quest has the act to be done in), on an event if the act has a spare one
  for (let i = 0; i < Math.round(t.extras.bounty); i++) {
    const early = map.nodes.filter((n) => n.row >= 1 && n.row <= Math.min(3, R - 2));
    const events = map.nodes.filter((n) => n.type === 'event');
    const n = pick(events.length >= 2 ? early.filter((x) => x.type === 'event') : []) ?? pick(early.filter((x) => x.type === 'fight' && !parents(x).some((p) => p.type === 'bounty')));
    if (!n) break;
    turn(n, 'bounty');
    out.bounty.push(n.id);
  }
  // Coin Rush mid-act, on a fight node (never next to the board or another rush)
  for (let i = 0; i < Math.round(t.extras.rush); i++) {
    const mid = map.nodes.filter((x) => x.type === 'fight' && x.row >= 2 && x.row <= R - 2);
    const spare = (type: string) => map.nodes.filter((x) => x.type === type).length >= 2;
    const n =
      pick(mid.filter((x) => !map.nodes.some((o) => (o.type === 'rush' || o.type === 'bounty') && near(o, x)))) ??
      pick(mid) ??
      // (a map with no fight mid-act: a fight near either end, else a spare chest or event)
      pick(map.nodes.filter((x) => x.type === 'fight' && x.row >= 1)) ??
      pick(map.nodes.filter((x) => (x.type === 'event' || x.type === 'treasure') && spare(x.type) && x.row >= 1 && x.row <= R - 1));
    if (!n) break;
    turn(n, 'rush');
    out.rush.push(n.id);
  }
  // the secret, beside a node in the middle of the map
  if (Math.round(t.extras.secret) > 0) out.secret = pick(map.nodes.filter((n) => n.row >= 1 && n.row <= R - 2 && n.type !== 'boss'))?.id ?? -1;
  // who roams: the packs (from the act's), then the merchant; never two on one node
  const taken = new Set<number>();
  const startAt = (lo: number): MapNode | null => {
    const n = pick(map.nodes.filter((x) => roamable(x) && x.row >= lo && x.row <= R - 2 && !taken.has(x.id)));
    if (n) taken.add(n.id);
    return n;
  };
  const pool = (def.packs ?? []).slice();
  for (let i = 0; i < packCount(t, act, acts) && pool.length; i++) {
    const n = startAt(2);
    if (!n) break;
    const waves = pool.splice(rng.int(pool.length), 1)[0];
    out.roamers.push({ id: out.roamers.length, kind: 'pack', start: n.id, waves: waves.map((w) => w.slice()) });
  }
  for (let i = 0; i < Math.round(t.roam.merchant); i++) {
    const n = startAt(1);
    if (!n) break;
    out.roamers.push({ id: out.roamers.length, kind: 'merchant', start: n.id, waves: [] });
  }
  return out;
}

/** An act's map as a run plays it: buildActMap, then its extras (none when `extras` is off: a save from before them). */
export function actMap(t: Tuning, region: RegionDef, act: number, seed: number, extras = true): { map: ActMap; extras: MapExtras | null } {
  const def = region.acts[act];
  const map = buildActMap(def, seed);
  return { map, extras: extras ? addExtras(map, def, act, region.acts.length, seed, t) : null };
}

/** The nodes linked to `id` (forward and back) that a roamer may step to. */
function neighbours(map: ActMap, id: number): number[] {
  const n = map.nodes[id];
  const back = map.nodes.filter((p) => p.next.includes(id)).map((p) => p.id);
  return [...n.next, ...back].filter((x) => roamable(map.nodes[x]));
}

interface Live extends RoamerNow {
  alive: boolean;
}

/** The nodes the hero can go to from `here` (null: the start). */
const choicesFrom = (map: ActMap, here: number | null): number[] => (here === null ? map.rows[0] : map.nodes[here].next);

/**
 * Each roamer's next step, given the hero at `here` (null: the act's start), for the hero's `step`-th move. Seeded per
 * step. Moving beats staying; then the hero must keep a way on that meets no pack (now, and a step ahead if it can be
 * done). If no plan leaves a clear way on, a pack in the way wanders off the map.
 */
function planSteps(map: ActMap, x: MapExtras, rs: Live[], here: number | null, step: number): void {
  const rng = new Rng(mix(x.seed, step));
  for (let guard = 0; guard < 8; guard++) {
    const alive = rs.filter((r) => r.alive);
    if (!alive.length) return;
    const cands = alive.map((r) => [...shuffle(neighbours(map, r.at).filter((n) => n !== here), rng), r.at]);
    const C = choicesFrom(map, here);
    const pick: number[] = alive.map((r) => r.at);
    // the first plan (in the shuffled order) that leaves the hero a clear way on now and a step ahead, else one
    // that does so now
    const best: { firm: number[] | null; loose: number[] | null } = { firm: null, loose: null };
    const judge = () => {
      const packs = alive.map((r, i) => [r, i] as const).filter(([r]) => r.kind === 'pack');
      const danger = new Set<number>(packs.flatMap(([r, i]) => [r.at, pick[i]]));
      if (!C.some((c) => !danger.has(c))) return;
      if (!best.loose) best.loose = pick.slice();
      const after = new Set<number>(packs.map(([, i]) => pick[i]));
      if (C.every((c) => map.nodes[c].next.some((d) => !after.has(d)))) best.firm = pick.slice();
    };
    const search = (i: number): void => {
      if (best.firm) return;
      if (i === alive.length) return judge();
      for (const n of cands[i]) {
        // never two roamers on (or heading to) one node
        let clash = false;
        for (let j = 0; j < alive.length && !clash; j++) if (j !== i && (alive[j].at === n || (j < i && pick[j] === n))) clash = true;
        if (clash) continue;
        pick[i] = n;
        search(i + 1);
        if (best.firm) return;
      }
    };
    search(0);
    const plan = best.firm ?? best.loose;
    if (plan) {
      alive.forEach((r, i) => (r.next = plan[i]));
      return;
    }
    // cornered: the pack standing in the way wanders off
    const blocker = alive.find((r) => r.kind === 'pack' && C.includes(r.at)) ?? alive.find((r) => r.kind === 'pack');
    if (!blocker) return;
    blocker.alive = false;
  }
}

/** The roamers as the act begins (their first steps planned). */
function startRoam(map: ActMap, x: MapExtras): Live[] {
  const rs: Live[] = x.roamers.map((r) => ({ id: r.id, kind: r.kind, at: r.start, next: r.start, waves: r.waves.map((w) => w.slice()), alive: true }));
  planSteps(map, x, rs, null, 0);
  return rs;
}

/** The roamer the hero meets stepping onto `node`: one standing there, or one about to step there. */
function meets(rs: Live[], node: number): Live | undefined {
  return rs.find((r) => r.alive && (r.at === node || r.next === node));
}

/** Where everyone roams to after the hero walks `path` (node ids from row 0), and who was met on its last step. */
export function roamAt(map: ActMap, x: MapExtras, path: readonly number[]): RoamState {
  const rs = startRoam(map, x);
  let met: Live | null = null;
  for (let k = 0; k < path.length; k++) {
    const node = path[k];
    const hit = meets(rs, node);
    for (const r of rs) if (r.alive) r.at = r.next;
    met = null;
    if (hit) {
      hit.alive = false;
      hit.at = hit.next = node;
      met = hit;
    }
    planSteps(map, x, rs, node, k + 1);
  }
  const now = (r: Live): RoamerNow => ({ id: r.id, kind: r.kind, at: r.at, next: r.next, waves: r.waves.map((w) => w.slice()) });
  return { roamers: rs.filter((r) => r.alive).map(now), met: met ? now(met) : null };
}

/** The pack that stepping onto `node` from where the hero stands now would meet (null: none). */
export function packAt(state: RoamState, node: number): RoamerNow | null {
  return state.roamers.find((r) => r.kind === 'pack' && (r.at === node || r.next === node)) ?? null;
}

/** The roamer (pack or merchant) that stepping onto `node` would meet. */
export function roamerAt(state: RoamState, node: number): RoamerNow | null {
  return state.roamers.find((r) => r.at === node || r.next === node) ?? null;
}

/** An ambush's waves on `node`: a fight node's own foes, then the pack; anywhere else the pack alone. */
export function ambushWaves(node: MapNode, pack: RoamerNow): string[][] {
  const own = node.type === 'fight' ? node.waves.map((w) => w.slice()) : [];
  return [...own, ...pack.waves.map((w) => w.slice())];
}
