// Special-move actions (pure; no DOM). An enemy's special (src/data/enemies.ts) is a telegraph followed by a list
// of actions; each action is reusable by any enemy: spawn a block formation, heal, shell (self or an ally),
// summon, split, change the cursor, guard, enter a boss phase, protection while summons live.
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
      c.events.push({ type: 'phase', enemyId: e.id, phase: a.phase });
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
  for (const entry of entries) {
    const owner = (entry.partner && partnerOf(c, e)) || e;
    if (entry.delay && entry.delay > 0) {
      c.enqueue(owner.id, entry, entry.delay);
      continue;
    }
    const b = placeEntry(c, owner, entry, prev);
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
    return c.spawnBlock(kind, pos, owner.id, w, { speed: entry.speed, taps: entry.taps, special: true });
  }
  let pos: number | null = null;
  if (entry.beside === 'yellow') pos = besideYellow(c, w, owner);
  if (pos === null && entry.at !== undefined) pos = nudges(0.15).map((d) => (entry.at ?? 0.5) + d).find((p) => staticFits(c, p, w)) ?? null;
  if (pos === null) pos = c.freeSpot(w, 24);
  if (pos === null) return null;
  return c.spawnBlock(kind, pos, owner.id, w, { life: entry.life, heal: entry.heal, special: true });
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
    if (k) kids.push(k);
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
