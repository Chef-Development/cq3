// Special-move actions (pure; no DOM). An enemy's special (src/data/enemies.ts) is a telegraph followed by a list
// of actions; each action is reusable by any enemy: spawn a block formation, heal, shell (self or an ally),
// summon, split, change the cursor, guard, enter a boss phase, protection while summons live; and the bar rules:
// lay patches (ice, snowdrifts), slide them, turn yellows into holds, set a mirror shard, coat yellows in ice, make
// every Nth yellow a hold, stripe the whole bar; Region 4's: put yellows in the dark, dim the lantern, a surge of water.
// Combat schedules the telegraphs (combat.ts updateSpecials); this file carries the actions out.

import type { ActionDef, FormationEntry, SpecialDef } from '../data/types';
import { isRed, type BlockKind } from './blocks';
import type { Block, Combat, Enemy } from './combat';

/** Carry out every action of a special, in order. */
export function fireSpecial(c: Combat, e: Enemy, sp: SpecialDef): void {
  for (const a of sp.actions) {
    if (c.result) return;
    runAction(c, e, a);
  }
}

export function runAction(c: Combat, e: Enemy, a: ActionDef): void {
  switch (a.type) {
    case 'formation':
      return formation(c, e, a.blocks);
    case 'heal':
      return heal(c, e, a.target, a.frac);
    case 'shell':
      return shell(c, e, a.target, a.mult, a.blocks);
    case 'summon':
      return summon(c, e, a.enemies, !!a.link);
    case 'split':
      return split(c, e, a.into, a.count, a.hpFrac);
    case 'cursor':
      return cursor(c, a.freeze, a.minSpeed);
    case 'guard':
      if (!e.alive) return;
      e.guard = Math.max(e.guard, a.sec);
      c.events.push({ type: 'guardOn', enemyId: e.id, sec: a.sec });
      return;
    case 'phase':
      if (!e.alive) return;
      e.phase = a.phase;
      // patches that belonged to the last phase go with it
      for (const z of c.zones.slice()) if (z.phase && z.phase !== a.phase) c.removeZone(z);
      c.events.push({ type: 'phase', enemyId: e.id, phase: a.phase });
      return;
    case 'zone':
      return zone(c, e, a.kind, a.width, a.life, a.at, a.count ?? 1);
    case 'zoneShift':
      c.shiftZones(a.speed, a.sec);
      return;
    case 'toHold':
      return toHold(c, a.count, a.width);
    case 'mirror':
      return mirror(c, e, a.at, a.life);
    case 'armor':
      return armor(c, a.count, a.taps);
    case 'barRule':
      if (!e.alive) return;
      e.holdEvery = Math.max(0, Math.round(a.holdEvery));
      e.driftEvery = Math.max(0, Math.round(a.driftEvery ?? 0));
      e.linkEvery = Math.max(0, Math.round(a.linkEvery ?? 0));
      e.darkEvery = Math.max(0, Math.round(a.darkEvery ?? 0));
      return;
    case 'toDrift':
      return toDrift(c, a.count, a.speed, a.sec);
    case 'toLink':
      return toLink(c, e, a.count);
    case 'driftShift':
      return driftShift(c, a.mult, a.flip, a.sec);
    case 'stripes':
      return stripes(c, e, a.count, a.life, a.speed ?? 0);
    // Region 4: the lantern and the tide (core/combat.ts)
    case 'darken':
      c.darken(Math.max(0, Math.round(a.count)));
      return;
    case 'snuff':
      c.snuff(a.mult, Math.max(0, a.sec));
      return;
    case 'tide':
      c.surgeTide(a.level, Math.max(0, a.sec), a.from);
      return;
    case 'protect':
      if (!e.alive) return;
      e.protect = a.mult;
      c.events.push({ type: 'protectOn', enemyId: e.id });
      return;
  }
}

// ---------------------------------------------------------------- formation

/** A living ally of the same kind (a wolf's pack mate), if there is one. */
function partnerOf(c: Combat, e: Enemy): Enemy | null {
  return c.enemies.find((x) => x.alive && x !== e && x.key === e.key) ?? null;
}

function formation(c: Combat, e: Enemy, entries: FormationEntry[]): void {
  let prev: Block | null = null;
  let half: Block | null = null; // the first half of a `link` pair placed, waiting for the next `link` entry
  const taken: number[] = [];
  for (const raw of entries) {
    const owner = (raw.partner && partnerOf(c, e)) || e;
    // a spot chosen now (and marked on the bar, so the player can see where it will land), clear of the others
    const entry = raw.spot ? { ...raw, at: spotFor(c, raw, taken), spot: undefined } : raw;
    if (raw.spot) taken.push(entry.at!);
    if (raw.spot) c.events.push({ type: 'mark', pos: entry.at!, sec: Math.max(0, raw.delay ?? 0) });
    if (entry.delay && entry.delay > 0) {
      c.enqueue(owner.id, entry, entry.delay);
      continue;
    }
    const b = placeEntry(c, owner, entry, prev);
    if (b && entry.link && b.kind === 'yellow') {
      if (half && c.blocks.includes(half)) {
        half.link = b.id;
        b.link = half.id;
        half = null;
      } else half = b;
    }
    if (b) prev = b;
    else if (isRed(entry.kind as BlockKind) && entry.at === undefined && !entry.pair) c.enqueue(owner.id, entry, 0.05); // the right end is busy: soon
  }
}

/**
 * Put one formation block on the bar now. Reds come in from the right end (or at `at`, or right in front of the
 * previous block for a pair); other kinds go beside a yellow, at `at`, or to a free spot. Returns the block, or
 * null if there is no room right now.
 */
export function placeEntry(c: Combat, owner: Enemy, entry: FormationEntry, prev: Block | null): Block | null {
  const kind = entry.kind as BlockKind;
  const w = c.widthFor(kind) * (entry.width ?? 1);
  if (isRed(kind)) {
    const clamp = (p: number) => Math.min(1 - w / 2, Math.max(w / 2, p));
    const free = (p: number) => !c.blocks.some((r) => isRed(r.kind) && Math.abs(r.pos - p) < (r.width + w) / 2 - 1e-6);
    let pos = clamp(entry.pair && prev ? prev.pos - (prev.width + w) / 2 : (entry.at ?? 1 - w / 2));
    if (!free(pos)) {
      if (entry.at === undefined && !(entry.pair && prev)) return null;
      // mid-bar: the nearest free spot close by
      const found = nudges(0.12).map((d) => clamp(pos + d)).find(free);
      if (found === undefined) return null;
      pos = found;
    }
    return c.spawnBlock(kind, pos, owner.id, w, { speed: entry.speed, taps: entry.taps, special: true, still: entry.still, fuse: entry.fuse, grow: entry.grow, trail: entry.trail });
  }
  let pos: number | null = null;
  if (entry.beside === 'yellow') pos = besideYellow(c, w, owner);
  if (pos === null && entry.at !== undefined) pos = nudges(0.15).map((d) => (entry.at ?? 0.5) + d).find((p) => staticFits(c, p, w)) ?? null;
  if (pos === null) pos = c.freeSpot(w, 24);
  if (pos === null) return null;
  const drift = kind === 'yellow' && entry.drift && !entry.link ? entry.drift * (c.rand() < 0.5 ? -1 : 1) : 0;
  return c.spawnBlock(kind, pos, owner.id, w, { life: entry.life, heal: entry.heal, special: true, drift, dark: !!entry.dark });
}

/** Where a spotted entry lands: where the cursor is heading, or a random spot clear of the other still blocks. */
function spotFor(c: Combat, entry: FormationEntry, taken: number[] = []): number {
  if (entry.spot === 'ahead') return c.aheadPos();
  const w = c.widthFor(entry.kind as BlockKind) * (entry.width ?? 1);
  // spots of one formation sit at least a quarter of the bar apart (each its own tap)
  const apart = (p: number) => taken.every((q) => Math.abs(q - p) >= 0.25);
  for (let k = 0; k < 24; k++) {
    const p = 0.12 + c.rand() * 0.76;
    if (apart(p) && c.blocks.every((b) => (isRed(b.kind) && !b.still) || Math.abs(b.pos - p) >= (b.width + w) / 2)) return p;
  }
  for (let k = 0; k < 24; k++) {
    const p = 0.12 + c.rand() * 0.76;
    if (apart(p)) return p;
  }
  return 0.12 + c.rand() * 0.76;
}

/** 0, then +/- steps of 0.01 out to `max`. */
function nudges(max: number): number[] {
  const out = [0];
  for (let d = 0.01; d <= max + 1e-9; d += 0.01) out.push(d, -d);
  return out;
}

function staticFits(c: Combat, p: number, w: number): boolean {
  const m = c.tuning.blocks.edgeMargin;
  if (p - w / 2 < m * 0.5 || p + w / 2 > 1 - m * 0.5) return false;
  return c.blocks.every((s) => isRed(s.kind) || Math.abs(s.pos - p) >= (s.width + w) / 2 - 1e-6);
}

/** A spot touching a yellow block (the trap hides right beside it). If no yellow has room, one is added first. */
function besideYellow(c: Combat, w: number, owner: Enemy): number | null {
  const yellows = c.blocks.filter((b) => b.kind === 'yellow');
  // shuffle so the traps don't always pick the same yellow
  for (let i = yellows.length - 1; i > 0; i--) {
    const j = Math.floor(c.rand() * (i + 1));
    [yellows[i], yellows[j]] = [yellows[j], yellows[i]];
  }
  for (const y of yellows) {
    const sides = c.rand() < 0.5 ? [1, -1] : [-1, 1];
    for (const side of sides) {
      const p = y.pos + (side * (y.width + w)) / 2;
      if (staticFits(c, p, w)) return p;
    }
  }
  const yw = c.widthFor('yellow');
  const mid = c.freeSpot(yw + w, 24);
  if (mid === null) return null;
  const right = c.rand() < 0.5;
  // the pair fills [mid - (yw + w) / 2, mid + (yw + w) / 2]: the yellow on one side, the trap on the other
  const yPos = right ? mid - w / 2 : mid + w / 2;
  c.spawnBlock('yellow', yPos, owner.id, yw, { special: true });
  return right ? mid + yw / 2 : mid - yw / 2;
}

// ---------------------------------------------------------------- the other actions

function heal(c: Combat, e: Enemy, target: 'self' | 'allies' | 'all', frac: number): void {
  const who = c.enemies.filter((x) => x.alive && (target === 'all' || (target === 'self' ? x === e : x !== e)));
  for (const x of who) c.healEnemy(x, x.maxHp * frac);
}

/** Attack hits on the target deal `mult` until its ward blocks are all broken. */
function shell(c: Combat, e: Enemy, target: 'self' | 'ally', mult: number, blocks: number): void {
  let t: Enemy | null = e.alive ? e : null;
  if (target === 'ally') {
    const allies = c.enemies.filter((x) => x.alive && x !== e).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    t = allies[0] ?? t;
  }
  if (!t) return;
  const have = c.blocks.filter((b) => b.kind === 'ward' && b.ownerId === t!.id).length;
  const w = c.widthFor('ward');
  let placed = 0;
  for (let i = have; i < blocks; i++) {
    const p = c.freeSpot(w, 24);
    if (p === null) break;
    c.spawnBlock('ward', p, t.id, w, { special: true });
    placed++;
  }
  if (have + placed === 0) return; // no room for a single ward: no shell
  t.shell = Math.min(t.shell, mult);
  c.events.push({ type: 'shellOn', enemyId: t.id });
}

function summon(c: Combat, e: Enemy, keys: string[], link: boolean): void {
  const ids: number[] = [];
  for (const key of keys) {
    const x = c.addEnemy(key, { summoner: link ? e.id : 0 });
    if (x) ids.push(x.id);
  }
  if (ids.length) c.events.push({ type: 'summon', enemyId: e.id, ids });
}

/** The enemy is replaced by `count` smaller ones, each with hpFrac of its HP; its pending attacks pass to the first. */
function split(c: Combat, e: Enemy, into: string, count: number, hpFrac: number): void {
  if (!e.alive) return;
  const hp = Math.max(1, Math.round(e.hp * hpFrac));
  e.alive = false; // frees its place on screen for the first child
  const kids: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const k = c.addEnemy(into, { hp, slot: i === 0 ? e.slot : undefined });
    if (k) {
      k.parent = e.id;
      kids.push(k);
    }
  }
  e.alive = true;
  c.retire(e, 'split', kids[0]);
  c.events.push({ type: 'split', enemyId: e.id, ids: kids.map((k) => k.id) });
}

function cursor(c: Combat, freeze?: number, minSpeed?: number): void {
  if (freeze && freeze > 0) {
    c.freeze = Math.max(c.freeze, freeze);
    c.events.push({ type: 'freeze', sec: freeze });
  }
  if (minSpeed && minSpeed > 0) {
    c.minSpeed = Math.max(c.minSpeed, minSpeed);
    c.events.push({ type: 'cursorFloor', mult: minSpeed });
  }
}

// ---------------------------------------------------------------- the bar rules

/** Lay `count` patches; life 0 = until the boss's phase ends (or the fight, for a foe without phases). */
function zone(c: Combat, e: Enemy, kind: 'ice' | 'snow', width: number, life: number, at: number | 'ahead' | undefined, count: number): void {
  for (let i = 0; i < count; i++) {
    const pos = at === 'ahead' ? c.aheadPos() : at !== undefined ? at : c.freeZoneSpot(width);
    const phase = life > 0 ? 0 : Math.max(1, e.phase);
    // a phase's standing patch is laid once (a timer that comes round again doesn't stack it)
    if (phase && c.zones.some((z) => z.kind === kind && z.phase === phase && pos >= z.lo && pos <= z.hi)) continue;
    c.addZone(kind, pos, width, life, phase);
  }
}

/** Yellows on the bar become holds (widened around their centre, if there's room). */
function toHold(c: Combat, count: number, width?: number): void {
  const w = c.widthFor('hold') * (width ?? 1);
  const yellows = c.blocks.filter((b) => b.kind === 'yellow');
  let n = 0;
  for (const y of yellows) {
    if (n >= count) break;
    const lo = Math.max(c.tuning.blocks.edgeMargin + w / 2, Math.min(1 - c.tuning.blocks.edgeMargin - w / 2, y.pos));
    const clear = c.blocks.every((b) => b === y || isRed(b.kind) || Math.abs(b.pos - lo) >= (b.width + w) / 2);
    if (!clear) continue;
    c.removeBlock(y, 'perk');
    c.spawnBlock('hold', lo, y.ownerId, w, { special: true });
    n++;
  }
  // too few yellows with room: new holds in free spots
  for (; n < count; n++) {
    const p = c.freeSpot(w, 24);
    const front = c.frontEnemy();
    if (p === null || !front) break;
    c.spawnBlock('hold', p, front.id, w, { special: true });
  }
}

/** A mirror shard on the bar: the cursor bounces back when it reaches it (it never takes a tap). */
function mirror(c: Combat, e: Enemy, at: number | 'ahead' | undefined, life: number): void {
  const pos = at === 'ahead' ? c.aheadPos(c.tuning.bar.ahead * 1.5) : (at ?? 0.5);
  c.spawnBlock('mirror', Math.max(0.15, Math.min(0.85, pos)), e.id, undefined, { life, special: true });
}

/** Yellows on the bar get an ice coat: `taps` taps each (the first ones crack it). */
function armor(c: Combat, count: number, taps: number): void {
  let n = 0;
  for (const b of c.blocks) {
    if (n >= count) break;
    if (b.kind !== 'yellow' || b.taps > 1) continue;
    b.taps = Math.max(2, Math.round(taps));
    c.events.push({ type: 'chip', id: b.id, pos: b.pos, left: b.taps });
    n++;
  }
}

/**
 * Yellows on the bar start drifting (up to `count`; 0 = every one), each away from its nearest still neighbour, at
 * `speed` for `sec` seconds (none: for good). Linked halves stay put.
 */
function toDrift(c: Combat, count: number, speed: number, sec?: number): void {
  const yellows = c.blocks.filter((b) => b.kind === 'yellow' && !b.link && b.vel === 0);
  let n = 0;
  for (const y of yellows) {
    if (count > 0 && n >= count) break;
    const others = c.blocks.filter((b) => b !== y && (!isRed(b.kind) || b.still));
    const near = others.reduce<Block | null>((m, b) => (!m || Math.abs(b.pos - y.pos) < Math.abs(m.pos - y.pos) ? b : m), null);
    const dir = near ? (near.pos > y.pos ? -1 : 1) : c.rand() < 0.5 ? -1 : 1;
    c.setDrift(y, dir * Math.abs(speed), sec && sec > 0 ? sec : Infinity);
    n++;
  }
  if (n) c.events.push({ type: 'driftOn', count: n });
}

/** Up to `count` pairs of yellows on the bar are chained: neighbours close enough, or a new partner beside one. */
function toLink(c: Combat, e: Enemy, count: number): void {
  let made = 0;
  const free = () => c.blocks.filter((b) => b.kind === 'yellow' && !b.link && b.taps <= 1 && b.vel === 0 && b.id !== c.linkLit?.id).sort((a, b) => a.pos - b.pos);
  // neighbours first
  const ys = free();
  for (let i = 0; i + 1 < ys.length && made < count; i++) {
    const a = ys[i];
    const b = ys[i + 1];
    if (b.pos - a.pos > 0.3 || a.link || b.link) continue;
    a.link = b.id;
    b.link = a.id;
    made++;
    i++;
  }
  // then a new pair in a free stretch
  for (; made < count; made++) {
    const front = c.frontEnemy() ?? e;
    if (!c.spawnPair(c.widthFor('yellow'), front.id)) break;
  }
  if (made) c.events.push({ type: 'linkOn', count: made });
}

/** Every drifting block turns around (`flip`) and/or moves `mult` x as fast for `sec` s (none: for good; mult 0 settles them). */
function driftShift(c: Combat, mult?: number, flip?: boolean, sec?: number): void {
  const drifting = c.blocks.filter((b) => !isRed(b.kind) && b.vel !== 0);
  if (flip) for (const b of drifting) b.vel = -b.vel;
  if (mult !== undefined) {
    if (sec && sec > 0) {
      c.driftMult = Math.max(0, mult);
      c.driftMultSec = sec;
    } else for (const b of drifting) c.setDrift(b, b.vel * Math.max(0, mult), b.driftSec);
  }
  c.events.push({ type: 'driftShift', flip: !!flip, mult: mult ?? 1 });
}

/** The whole bar becomes alternating stripes of ice and snowdrift (sliding slowly if `speed`). */
function stripes(c: Combat, e: Enemy, count: number, life: number, speed: number): void {
  const n = Math.max(2, Math.round(count));
  const w = 1 / n;
  const phase = life > 0 ? 0 : Math.max(1, e.phase);
  for (let i = 0; i < n; i++) {
    const z = c.addZone(i % 2 === 0 ? 'ice' : 'snow', w * (i + 0.5), w, life, phase);
    if (speed > 0) {
      z.vel = (i % 2 === 0 ? 1 : -1) * speed;
      z.slide = life > 0 ? life : 1e9;
    }
  }
}
