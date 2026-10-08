// The skill trees of every hero but Rowan as fight hooks (core/hooks.ts): their rule nodes and capstones (the text is
// in src/data/skills-heroes.ts; stat nodes are plain stats, see heroes.ts buildBonus). Merged into SKILL_HOOKS
// (skill-fx.ts). A node's number is skillN(c.tuning, id); each calls c.perkFx(id, amount, enemyId) when it kicks in.
// One cursor, always: nodes that move it go through Shadow Dash (which counts ice patches on the way), nodes keyed on
// Perfect hits count a completed hold (a hit, Perfect when its press was), and perkHit never touches a hold.
//
// Per-fight state in c.perk (the view may read it):
//   sureChainWas         the chain going into the hit being judged
//   lunge                1 = the next hit lunges (a Perfect hit came first)
//   phantomAt            the time Phantom Rush is ready again
//   vanish               1 = this smoke's dodge is used
//   coldShoulderAt       the time Cold Shoulder is ready again
//   blackIce             seconds to the next Black Ice patch
//   <node><allyId>       a Moss node's memory of an ally (its timer, or a Barkback's brace)
//   rootCall             reds blocked toward the next Root Call
//   kegHit               the keg hit whose blast perks already ran
//   echoWall / trickShot / wreckingBall / landslide   counters toward the next one

import type { AllyKind } from '../data/heroes';
import { isRed } from './blocks';
import type { Ally, Block, Combat, CombatEvent, Enemy } from './combat';
import { skillN } from './heroes';
import type { FightHooks, HitCtx } from './hooks';
import { gildNext, ignite, isGilded, oathAt, shadowDash, slamShare, sunEvery } from './kit-fx';
import { addFocus, addGuard, allyAct, allyEvery, allyPower, allySec, callAlly, chainOf, dropKeg, focusCap, focusOf, guardOf, powerShot } from './styles';

const DT = 1 / 120;
const N = (c: Combat, id: string): number => skillN(c.tuning, id);
/** A node's number as a share (25 -> 0.25). */
const P = (c: Combat, id: string): number => Math.max(0, N(c, id)) / 100;
/** A node's number as a whole count (at least 1). */
const every = (c: Combat, id: string): number => Math.max(1, Math.round(N(c, id)));

const ability = (c: Combat): boolean => c.hero.abilityTimer > 0;
const reds = (c: Combat): Block[] => c.blocks.filter((b) => isRed(b.kind));
/** Reds that travel (an icicle sits where it landed: it can't be slowed, pinned or pushed). */
const movingReds = (c: Combat): Block[] => c.blocks.filter((b) => isRed(b.kind) && !b.still);
const pinned = (b: Block): boolean => isRed(b.kind) && b.chill > 0 && b.chillMult === 0;

/** Strike every living foe for a share of attack (a perk's area hit). Returns how many it hit. */
function strikeAll(c: Combat, share: number, id: string): number {
  const dmg = c.stats().atk * share;
  const foes = c.aliveFoes();
  for (const e of foes) c.strike(e, dmg, id);
  return foes.length;
}

/** Where this hit's own 'hit' event sits in c.events (pushed during hitAttack, before the afterHit hooks), so a hook
 *  can see what happened since (a dash, a Rally, keg blasts). -1 if it isn't there. */
function hitIndex(c: Combat, x: HitCtx): number {
  for (let i = c.events.length - 1; i >= 0; i--) {
    const e = c.events[i];
    if (e.type === 'hit' && e.pos === x.block.pos && e.kind === x.block.kind && e.echo === x.echo) return i;
  }
  return -1;
}

const since = (c: Combat, from: number): CombatEvent[] => (from < 0 ? [] : c.events.slice(from + 1));

/** The last event, if it's a perk's strike on `e` by one of `ids` (strike() names itself just before the damage). */
function struckBy(c: Combat, e: Enemy, ids: string[]): boolean {
  const ev = c.events[c.events.length - 1];
  return !!ev && ev.type === 'perk' && ids.includes(ev.id) && ev.enemyId === e.id;
}

// ---------------------------------------------------------------- Sable

/** Phantom Rush: after a Perfect hit, the red closest to her (the leftmost) is cut down: blocked for her (a shield
 *  takes all its taps), wherever it is; the cursor stays put. Once every n s. */
function phantom(c: Combat): void {
  if (c.result || c.time < (c.perk.phantomAt ?? -1e9)) return;
  let red: Block | null = null;
  for (const b of reds(c)) if (!red || b.pos < red.pos) red = b;
  if (!red) return;
  c.perk.phantomAt = c.time + Math.max(0, N(c, 'phantomRush'));
  for (let k = 0; k < 4 && c.blocks.includes(red) && !c.result; k++) c.perkBlock(red);
  c.perkFx('phantomRush', 0, red.ownerId, red.pos);
}

const SABLE: Record<string, FightHooks> = {
  // Sure Chain: a hit that isn't Perfect no longer ends the chain (the style's Chain resets it then); it adds no
  // link. Misses and hits taken still end it.
  sureChain: {
    hitMult: (c, x, v) => {
      if (!x.echo) c.perk.sureChainWas = chainOf(c);
      return v;
    },
    afterHit: (c, x) => {
      if (x.echo || x.perfect) return;
      const keep = c.perk.sureChainWas ?? 0;
      if (keep <= chainOf(c)) return;
      c.perk.chain = keep;
      c.perkFx('sureChain', keep, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Deep Cuts: at n+ links (going into the hit), a Perfect hit always crits
  deepCuts: {
    critChance: (c, x, v) => {
      if (x.echo || !x.perfect || chainOf(c) < every(c, 'deepCuts')) return v;
      c.perkFx('deepCuts', chainOf(c), x.target?.id ?? 0, x.block.pos);
      return Math.max(v, 1);
    },
  },
  // Death Mark (capstone): Twin Fang deals n% more per chain link
  deathMark: {
    finisher: (c, _x, v) => {
      const links = chainOf(c);
      if (links <= 0) return v;
      c.perkFx('deathMark', links);
      return v * (1 + P(c, 'deathMark') * links);
    },
  },
  // Lunge: after a Perfect hit (often a dash: Shadow Dash often has no room), the next hit deals n% more (a miss
  // wastes it)
  lunge: {
    hitMult: (c, x, v) => {
      if (x.echo || !c.perk.lunge) return v;
      c.perk.lunge = 0;
      c.perk.lungeHit = x.block.id;
      return v * (1 + P(c, 'lunge'));
    },
    afterHit: (c, x) => {
      if (x.echo) return;
      if (c.perk.lungeHit === x.block.id) {
        c.perk.lungeHit = 0;
        c.perkFx('lunge', x.damage, x.target?.id ?? 0, x.block.pos);
      }
      if (x.perfect) c.perk.lunge = 1;
    },
    miss: (c) => {
      c.perk.lunge = 0;
    },
  },
  // Night Step: a Perfect block dashes too (not a cracked shield: it still stands)
  nightStep: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.echo || x.cracked || c.result || !shadowDash(c)) return;
      c.perkFx('nightStep', 0, 0, c.cursorPos());
    },
  },
  // Phantom Rush (capstone): a Perfect hit cuts down the red closest to her, once every n s
  phantomRush: {
    afterHit: (c, x) => {
      if (x.perfect && !x.echo) phantom(c);
    },
  },
  // Thick Smoke: Smoke Veil lasts n s longer
  thickSmoke: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      c.hero.abilityTimer += Math.max(0, N(c, 'thickSmoke'));
      c.perkFx('thickSmoke');
    },
  },
  // Vanish: in the smoke, the first red (or bomb) to reach her misses (one per smoke)
  vanish: {
    step: (c) => {
      if (!ability(c)) c.perk.vanish = 0;
    },
    impact: (c, b) => {
      if (!ability(c) || c.perk.vanish) return false;
      c.perk.vanish = 1;
      c.perkFx('vanish', 0, b.ownerId, b.pos);
      return true;
    },
  },
  // Night Cloak (capstone): in the smoke, hits crit n% more often
  nightCloak: {
    critChance: (c, x, v) => (ability(c) && !x.echo ? v + P(c, 'nightCloak') : v),
    afterHit: (c, x) => {
      if (x.crit && !x.echo && ability(c) && !x.green) c.perkFx('nightCloak', 0, x.target?.id ?? 0, x.block.pos);
    },
  },
};

// ---------------------------------------------------------------- Neve

const inPatch = (c: Combat, pos: number): boolean => c.zones.some((z) => pos >= z.lo && pos <= z.hi);

const NEVE: Record<string, FightHooks> = {
  // Brittle: frozen blocks shatter for n% more
  brittle: {
    hitMult: (c, x, v) => (x.block.kind === 'frozen' ? v * (1 + P(c, 'brittle')) : v),
    afterHit: (c, x) => {
      if (x.block.kind === 'frozen' && !x.echo) c.perkFx('brittle', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Big Freeze: Glacier turns the reds it froze into frozen blocks to smash (hit for damage and meter, like Flash
  // Freeze's) instead of holding them (the kit's afterFinisher froze them solid first; this runs after it)
  bigFreeze: {
    afterFinisher: (c) => {
      if (c.result) return;
      let n = 0;
      for (const b of c.blocks.slice())
        if (isRed(b.kind) && c.freezeRed(b)) n++;
      if (n) c.perkFx('bigFreeze', n);
    },
  },
  // Ice Age (capstone): every block freezes its red (Flash Freeze, which already freezes on a Perfect or by chance)
  iceAge: {
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || x.block.kind === 'bomb' || c.result) return;
      // the kit's Flash Freeze (its afterBlock runs first) may have frozen it already
      for (let i = c.events.length - 1; i >= 0; i--) {
        const e = c.events[i];
        if (e.type === 'iceBlock') return;
        if (e.type === 'block' && e.pos === x.block.pos) break;
      }
      const f = c.spawnBlock('frozen', x.block.pos, x.block.ownerId, Math.max(x.block.width, c.tuning.blocks.attackWidth));
      c.events.push({ type: 'iceBlock', id: f.id, pos: f.pos });
      c.perkFx('iceAge', 0, f.ownerId, f.pos);
    },
  },
  // Long Bend: Bend (a Perfect block slows every red) lasts n s longer
  longBend: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.echo) return;
      const list = movingReds(c);
      for (const b of list) c.chillRed(b, c.tuning.styles.bendSec + Math.max(0, N(c, 'longBend')), c.tuning.styles.bendMult);
      if (list.length) c.perkFx('longBend');
    },
  },
  // Frost Aura: while Chill (her green ability) is on, reds move n% slower
  frostAura: {
    step: (c) => {
      if (!ability(c)) {
        c.perk.frostAura = 0;
        return;
      }
      const list = movingReds(c);
      for (const b of list) c.chillRed(b, DT * 2, 1 - Math.min(1, P(c, 'frostAura')));
      if (list.length && !c.perk.frostAura) {
        c.perk.frostAura = 1;
        c.perkFx('frostAura');
      }
    },
  },
  // Cold Shoulder (capstone): a slowed red that reaches the left end bounces back across the bar, once every n s
  coldShoulder: {
    atWall: (c, b) => {
      if (!(b.chill > 0 && b.chillMult < 1) || c.time < (c.perk.coldShoulderAt ?? -1e9)) return false;
      c.perk.coldShoulderAt = c.time + Math.max(0, N(c, 'coldShoulder'));
      c.perkFx('coldShoulder', 0, b.ownerId, b.pos);
      return true;
    },
  },
  // Skater: hits on a block inside a patch (ice, snowdrift or slow patch) deal n% more
  skater: {
    hitMult: (c, x, v) => (inPatch(c, x.block.pos) ? v * (1 + P(c, 'skater')) : v),
    afterHit: (c, x) => {
      if (!x.echo && inPatch(c, x.block.pos)) c.perkFx('skater', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Frost Trail: a shatter leaves an ice patch where the ice was, for n s (ice bothers her half as much: Cold Snap)
  frostTrail: {
    afterHit: (c, x) => {
      if (x.block.kind !== 'frozen' || x.echo || c.result || N(c, 'frostTrail') <= 0) return;
      c.addZone('ice', x.block.pos, x.block.width * 2, N(c, 'frostTrail'));
      c.perkFx('frostTrail', 0, 0, x.block.pos);
    },
  },
  // Black Ice (capstone): every n s, an ice patch (half as wide as Glacier's slow patch, lasting as long) forms ahead of
  // the cursor
  blackIce: {
    step: (c) => {
      c.perk.blackIce = (c.perk.blackIce ?? every(c, 'blackIce')) - DT;
      if (c.perk.blackIce > 0) return;
      c.perk.blackIce = every(c, 'blackIce');
      if (!c.frontEnemy()) return; // between waves
      const k = c.tuning.kits.neve;
      const z = c.addZone('ice', c.aheadPos(), k.slowWidth / 2, k.slowSec);
      c.perkFx('blackIce', 0, 0, (z.lo + z.hi) / 2);
    },
  },
};

// ---------------------------------------------------------------- Moss

/**
 * Allies of `kind` that acted since this node last looked: an ally's timer jumps back up when it acts (a Rally too),
 * a Barkback braces. Run from a step hook (allies act in the style's step, which runs first; a Rally between steps
 * is seen at the next one). Each node keeps its own memory in c.perk under `key`.
 */
function allyActs(c: Combat, key: string, kind: AllyKind): Ally[] {
  const out: Ally[] = [];
  for (const a of c.allies) {
    if (a.kind !== kind) continue;
    const k = `${key}${a.id}`;
    const now = kind === 'barkback' ? (a.braced ? 1 : 0) : a.timer;
    const was = c.perk[k];
    if (was !== undefined && now > was + 1e-9) out.push(a);
    c.perk[k] = now;
  }
  return out;
}

/** Barkbacks that stopped a red since this node last looked (their brace dropped). */
function barkBlocks(c: Combat, key: string): number {
  let n = 0;
  for (const a of c.allies) {
    if (a.kind !== 'barkback') continue;
    const k = `${key}${a.id}`;
    if (c.perk[k] === 1 && !a.braced) n++;
    c.perk[k] = a.braced ? 1 : 0;
  }
  return n;
}

/** A new ally of `kind` arrived since this node last looked (it names itself then). */
function arrived(c: Combat, key: string, kind: AllyKind): boolean {
  const a = c.allies.find((x) => x.kind === kind);
  if (!a || c.perk[key] === a.id) return false;
  c.perk[key] = a.id;
  return true;
}

/** Pollen Burst: a Rally bursts on every foe, for n% attack per ally out. */
function pollen(c: Combat): void {
  strikeAll(c, P(c, 'pollenBurst') * c.allies.length, 'pollenBurst');
}

const MOSS: Record<string, FightHooks> = {
  // Quick Thorns: Thornlings jab n% faster
  quickThorns: {
    step: (c) => {
      for (const a of c.allies) if (a.kind === 'thornling') a.timer -= DT * P(c, 'quickThorns');
      if (arrived(c, 'quickThornsId', 'thornling')) c.perkFx('quickThorns');
    },
  },
  // Thorn Rush: each Thornling jab fills the meter (n% of a hit's fill)
  thornRush: {
    step: (c) => {
      const n = allyActs(c, 'thornRush', 'thornling').length;
      if (!n || c.result) return;
      c.fillMeter(c.tuning.meter.perHit * P(c, 'thornRush') * n, 'perk');
      c.perkFx('thornRush', n);
    },
  },
  // Rooted (capstone): a Thornling never leaves once called
  rooted: {
    step: (c) => {
      for (const a of c.allies) if (a.kind === 'thornling') a.left = Math.max(a.left, allySec(c));
      if (arrived(c, 'rootedId', 'thornling')) c.perkFx('rooted');
    },
  },
  // Quick Brace: Barkbacks brace n% faster
  quickBrace: {
    step: (c) => {
      for (const a of c.allies) if (a.kind === 'barkback' && !a.braced) a.timer -= DT * P(c, 'quickBrace');
      if (arrived(c, 'quickBraceId', 'barkback')) c.perkFx('quickBrace');
    },
  },
  // Splinters: a Barkback's block hits every foe for n% attack
  splinters: {
    step: (c) => {
      for (let i = barkBlocks(c, 'splinters'); i > 0 && !c.result; i--) strikeAll(c, P(c, 'splinters'), 'splinters');
    },
  },
  // Root Call (capstone): every n reds blocked (a shield counts once, when it breaks) call the next ally (a Rally when
  // all are out)
  rootCall: {
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || c.result) return;
      c.perk.rootCall = (c.perk.rootCall ?? 0) + 1;
      if (c.perk.rootCall < every(c, 'rootCall')) return;
      c.perk.rootCall = 0;
      const from = c.events.length - 1;
      callAlly(c);
      c.perkFx('rootCall', 0, 0, x.block.pos);
      if (c.hasPerk('pollenBurst') && since(c, from).some((e) => e.type === 'perk' && e.id === 'rally')) pollen(c);
    },
  },
  // Bright Moth: Glowmoths heal n% more
  brightMoth: {
    step: (c) => {
      for (let i = allyActs(c, 'brightMoth', 'glowmoth').length; i > 0; i--) c.healPerk(c.maxHp() * c.tuning.kits.moss.mothHeal * P(c, 'brightMoth'), 'brightMoth');
    },
  },
  // Moonglow: a Glowmoth's light slows every red for n s (as much as Overgrowth's vines)
  moonglow: {
    step: (c) => {
      if (!allyActs(c, 'moonglow', 'glowmoth').length) return;
      const list = movingReds(c);
      for (const b of list) c.chillRed(b, Math.max(0, N(c, 'moonglow')), c.tuning.kits.moss.vineMult);
      if (list.length) c.perkFx('moonglow');
    },
  },
  // Pollen Burst (capstone): a Rally (a call with every ally out) bursts on every foe for n% attack per ally
  pollenBurst: {
    afterHit: (c, x) => {
      if (x.green && !x.echo && since(c, hitIndex(c, x)).some((e) => e.type === 'perk' && e.id === 'rally')) pollen(c);
    },
  },
};

// ---------------------------------------------------------------- Tam

/** Whether the damage being dealt now comes from one of her keg blasts (the nearest blast-like event back is an own
 *  explosion, not an enemy bomb's or a Riposte). */
function inKegBlast(c: Combat): boolean {
  for (let i = c.events.length - 1, k = 0; i >= 0 && k < 256; i--, k++) {
    const e = c.events[i];
    if (e.type === 'explode') return !!e.own;
    if (e.type === 'gearFx') return false;
  }
  return false;
}

/**
 * What follows her keg blasts (from c.events index `from` on; `at` adds the tapped keg's spot): Shrapnel hits the
 * yellows in reach, Shockwave pushes every red back, Kaboom fills the meter per blast; Packed and Heavy Powder name
 * themselves.
 */
function blastPerks(c: Combat, from: number, at: number[]): void {
  const evs = since(c, from);
  const blasts = evs.filter((e) => e.type === 'explode' && e.own).length;
  if (!blasts || c.result) return;
  const spots = [...at, ...evs.filter((e): e is Extract<CombatEvent, { type: 'remove' }> => e.type === 'remove' && e.kind === 'keg' && e.reason === 'bomb').map((e) => e.pos)];
  if (c.hasPerk('packedPowder')) c.perkFx('packedPowder', blasts);
  if (c.hasPerk('heavyPowder')) c.perkFx('heavyPowder', blasts);
  if (c.hasPerk('shrapnel')) {
    const r = c.mod(c.tuning.styles.kegRadius, (h, v) => h.kegRadius?.(c, v));
    const hit = c.blocks.filter((b) => b.kind === 'yellow' && spots.some((p) => Math.abs(b.pos - p) <= r));
    for (const b of hit) c.perkHit(b);
    if (hit.length) c.perkFx('shrapnel', hit.length);
  }
  if (c.hasPerk('shockwave') && !c.result) {
    let n = 0;
    for (const b of movingReds(c).sort((a, b) => b.pos - a.pos)) if (c.pushBack(b, P(c, 'shockwave')) > 0) n++;
    if (n) c.perkFx('shockwave', n);
  }
  if (c.hasPerk('kaboom') && !c.result) {
    c.fillMeter(P(c, 'kaboom') * blasts, 'perk');
    c.perkFx('kaboom', blasts);
  }
}

/** A keg she hit (once per hit, whichever of her keg nodes gets there first, so the order they were learned in
 *  doesn't matter): Powder Line sets off the rest, Restock drops a new one, then the blast perks. */
function kegHit(c: Combat, x: HitCtx): void {
  if (x.block.kind !== 'keg' || x.echo || c.perk.kegHit === x.block.id) return;
  c.perk.kegHit = x.block.id;
  const from = hitIndex(c, x);
  if (c.hasPerk('powderLine') && !c.result) {
    let n = 0;
    for (const k of c.blocks.filter((b) => b.kind === 'keg'))
      if (c.blocks.includes(k)) {
        c.removeBlock(k, 'bomb');
        c.kegBlast(k);
        n++;
      }
    if (n) c.perkFx('powderLine', n, 0, x.block.pos);
  }
  if (c.hasPerk('restock') && x.perfect && !c.result && dropKeg(c)) c.perkFx('restock', 0, 0, x.block.pos);
  blastPerks(c, from, [x.block.pos]);
}

const kegNode = (): FightHooks => ({ afterHit: kegHit });

/** Turnabout: every red on the bar becomes one of her kegs where it is (hit it: it blasts every foe). The red goes
 *  ('remove', reason 'perk'), a keg takes its place ('spawn'); its 'perk' event names each one (pos: where). */
function turnReds(c: Combat): number {
  let n = 0;
  for (const r of reds(c)) {
    if (c.result) break;
    const pos = r.pos;
    c.removeBlock(r, 'perk');
    c.spawnBlock('keg', pos, r.ownerId, Math.max(c.widthFor('keg'), Math.min(r.width, c.widthFor('keg') * 1.4)));
    c.perkFx('turnabout', 0, r.ownerId, pos);
    n++;
  }
  return n;
}

const TAM: Record<string, FightHooks> = {
  // Turnabout: Big Bang turns every red on the bar into a keg (instead of knocking them off)
  turnabout: {
    finisher: (_c, x, v) => {
      x.reds = 'keep';
      return v;
    },
    afterFinisher: (c) => {
      turnReds(c);
    },
  },
  // Restock: a Perfect hit on a keg drops a new keg
  restock: kegNode(),
  // Minefield (capstone): a red that runs into a keg sets it off (an icicle that lands on one too)
  minefield: {
    step: (c) => {
      for (const r of reds(c)) {
        if (c.result) return;
        if (!c.blocks.includes(r)) continue; // a blast already took it
        const keg = c.blocks.find((k) => k.kind === 'keg' && Math.abs(k.pos - r.pos) < (k.width + r.width) / 2);
        if (!keg) continue;
        const from = c.events.length - 1;
        c.removeBlock(keg, 'bomb');
        c.kegBlast(keg);
        c.perkFx('minefield', 0, r.ownerId, keg.pos);
        blastPerks(c, from, []);
      }
    },
  },
  // Packed Powder: keg blasts reach n% wider
  packedPowder: { kegRadius: (c, r) => r * (1 + P(c, 'packedPowder')), afterHit: kegHit },
  // Shrapnel: a keg blast also hits the yellows it reaches (never a hold)
  shrapnel: kegNode(),
  // Powder Line (capstone): hitting a keg sets off every keg on the bar
  powderLine: kegNode(),
  // Heavy Powder: keg blasts deal n% more
  heavyPowder: {
    damageTaken: (c, _e, source, v) => (source === 'bomb' && inKegBlast(c) ? v * (1 + P(c, 'heavyPowder')) : v),
    afterHit: kegHit,
  },
  // Shockwave: a keg blast knocks every red on the bar back n% of the bar
  shockwave: kegNode(),
  // Kaboom (capstone): every keg blast fills n% of the meter
  kaboom: kegNode(),
};

// ---------------------------------------------------------------- Hollis

/** Avalanche: the Bulwark that just went off stuns every foe for n s. */
function avalanche(c: Combat, pos: number): void {
  if (!c.perk.bulwarkNow || c.result) return;
  c.perk.bulwarkNow = 0;
  const foes = c.aliveFoes();
  for (const e of foes) c.stun(e, Math.max(0, N(c, 'avalanche')));
  if (foes.length) c.perkFx('avalanche', foes.length, 0, pos);
}

const HOLLIS: Record<string, FightHooks> = {
  // Sure Guard: a Perfect block stores n more Guard
  sureGuard: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo) return;
      addGuard(c, Math.max(0, Math.round(N(c, 'sureGuard'))));
      c.perkFx('sureGuard', guardOf(c), 0, x.block.pos);
    },
  },
  // Deep Guard: the Bulwark (full Guard unleashed on every foe) hits n% harder (named once it has landed)
  deepGuard: {
    damageTaken: (c, e, source, v) => (source === 'perk' && struckBy(c, e, ['bulwarkBlow']) ? v * (1 + P(c, 'deepGuard')) : v),
    afterBlock: (c, x) => {
      if (c.perk.bulwarkNow) c.perkFx('deepGuard', 0, 0, x.block.pos);
    },
    afterHit: (c, x) => {
      if (c.perk.bulwarkNow && !x.echo) c.perkFx('deepGuard', 0, 0, x.block.pos);
    },
  },
  // Avalanche (capstone): a Bulwark also stuns every foe for n s (the style sets c.perk.bulwarkNow when one goes off,
  // before this node's hooks run)
  avalanche: {
    afterBlock: (c, x) => avalanche(c, x.block.pos),
    afterHit: (c, x) => {
      if (!x.echo) avalanche(c, x.block.pos);
    },
  },
  // Heavy Slam: Shield Slam hits n% harder (named once the slam has landed: every block slams)
  heavySlam: {
    damageTaken: (c, e, source, v) => (source === 'perk' && struckBy(c, e, ['shieldSlam']) ? v * (1 + P(c, 'heavySlam')) : v),
    afterBlock: (c, x) => {
      if (!x.echo && x.owner) c.perkFx('heavySlam', 0, x.owner.id, x.block.pos);
    },
  },
  // Wide Slam: Shield Slam (every block's) also hits every other foe for n% of it
  wideSlam: {
    afterBlock: (c, x) => {
      if (x.echo || !x.owner || c.result) return;
      const dmg = c.stats().atk * slamShare(c, x.perfect) * P(c, 'wideSlam');
      for (const e of c.aliveFoes()) if (e !== x.owner) c.strike(e, dmg, 'wideSlam', false, x.block.pos);
    },
  },
  // Retaliate (capstone): each Guard charge stored makes Shield Slam n% stronger (the block's own charge counts; a
  // Bulwark spends them all first)
  retaliate: {
    damageTaken: (c, e, source, v) => (source === 'perk' && guardOf(c) > 0 && struckBy(c, e, ['shieldSlam']) ? v * (1 + P(c, 'retaliate') * guardOf(c)) : v),
    afterBlock: (c, x) => {
      if (!x.echo && x.owner && guardOf(c) > 0) c.perkFx('retaliate', guardOf(c), x.owner.id, x.block.pos);
    },
  },
  // Long Rampart: Rampart's wall stands n s longer
  longRampart: {
    afterFinisher: (c) => {
      if (!(c.perk.rampart > 0)) return;
      c.perk.rampart += Math.max(0, N(c, 'longRampart'));
      c.perkFx('longRampart');
    },
  },
  // Wall Up: a green hit raises the wall (reds bounce off the left end) for n s
  wallUp: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      c.perk.rampart = Math.max(c.perk.rampart ?? 0, N(c, 'wallUp'));
      c.perkFx('wallUp');
    },
  },
  // Echo Wall (capstone): every n reds that bounce off the wall bank a finisher stack. A red that just bounced sits
  // at the left end with its push still to go (the step hooks run before the blocks move).
  echoWall: {
    step: (c) => {
      if (!(c.perk.rampart > 0)) return;
      for (const b of movingReds(c)) {
        if (b.push <= 0 || b.pos > b.width / 2 + 1e-9) continue;
        c.perk.echoWall = (c.perk.echoWall ?? 0) + 1;
        if (c.perk.echoWall < every(c, 'echoWall')) continue;
        c.perk.echoWall = 0;
        c.bankStacks(1, 'echoWall');
      }
    },
  },
};

// ---------------------------------------------------------------- Vesper

/** Focus a hit (or a block) stores: the style's share of attack, double for a Perfect with Eagle Eye. */
const focusStored = (c: Combat, perfect: boolean): number => c.stats().atk * c.tuning.styles.focusStore * (perfect && c.perk.eagle ? 2 : 1);

const VESPER: Record<string, FightHooks> = {
  // Full Draw: hits store n% more Focus
  fullDraw: {
    afterHit: (c, x) => {
      if (!x.echo && !x.green) addFocus(c, focusStored(c, x.perfect) * P(c, 'fullDraw'));
    },
  },
  // Steady Hand: at n% Focus or more (of what it can hold), every hit crits
  steadyHand: {
    critChance: (c, x, v) => {
      if (x.echo || focusCap(c) <= 0 || focusOf(c) < focusCap(c) * Math.min(1, P(c, 'steadyHand')) - 1e-9) return v;
      c.perkFx('steadyHand', 0, x.target?.id ?? 0, x.block.pos);
      return Math.max(v, 1);
    },
  },
  // Full Quiver (capstone): when a hit fills Focus up, it fires itself as a Power Shot that crits (a full Focus does,
  // with Patience) and fills n% of the meter
  fullQuiver: {
    afterHit: (c, x) => {
      if (x.green || x.echo || c.result || focusCap(c) <= 0 || focusOf(c) < focusCap(c) * 0.999) return;
      const dmg = powerShot(c, true);
      c.fillMeter(P(c, 'fullQuiver'), 'perk');
      c.perkFx('fullQuiver', dmg, 0, x.block.pos);
    },
  },
  // Clean Shot: Perfect hits aren't held back by Focus (they deal in full; greens always do)
  cleanShot: {
    hitMult: (c, x, v) => (x.perfect && !x.green && !x.echo && c.tuning.styles.focusShare > 0 ? v / c.tuning.styles.focusShare : v),
    afterHit: (c, x) => {
      if (x.perfect && !x.green && !x.echo) c.perkFx('cleanShot', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Watchful: a Perfect block stores Focus like a Perfect hit
  watchful: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo) return;
      const before = focusOf(c);
      addFocus(c, focusStored(c, true));
      if (focusOf(c) > before) c.perkFx('watchful', focusOf(c) - before, 0, x.block.pos);
    },
  },
  // Trick Shot (capstone): every n-th Perfect hit (not a green: it fires anyway) fires the Focus as a Power Shot that
  // crits
  trickShot: {
    afterHit: (c, x) => {
      if (!x.perfect || x.green || x.echo || c.result) return;
      c.perk.trickShot = (c.perk.trickShot ?? 0) + 1;
      if (c.perk.trickShot % every(c, 'trickShot') !== 0 || focusOf(c) <= 0) return;
      c.perkFx('trickShot', powerShot(c, true), 0, x.block.pos);
    },
  },
  // Pinning Shot: a green hit pins every red in place for n s
  pinningShot: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      const list = movingReds(c);
      for (const b of list) c.chillRed(b, Math.max(0, N(c, 'pinningShot')), 0);
      if (list.length) c.perkFx('pinningShot', list.length);
    },
  },
  // Exposed: a foe with a pinned red on the bar takes n% more damage
  exposed: {
    damageTaken: (c, e, _s, v) => (c.blocks.some((b) => b.ownerId === e.id && pinned(b)) ? v * (1 + P(c, 'exposed')) : v),
    afterHit: (c, x) => {
      const t = x.target;
      if (t && !x.echo && c.blocks.some((b) => b.ownerId === t.id && pinned(b))) c.perkFx('exposed', 0, t.id, x.block.pos);
    },
  },
  // Deadfall (capstone): blocking a pinned red hits every foe for n% attack
  deadfall: {
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || !pinned(x.block)) return;
      strikeAll(c, P(c, 'deadfall'), 'deadfall');
    },
  },
};

// ---------------------------------------------------------------- Torva

/** A Quake happened: her kit quakes on every Perfect hit (and, at 3 stars, every Perfect block). */
const quakeHit = (x: HitCtx): boolean => x.perfect && !x.echo;
const quakeBlock = (c: Combat, perfect: boolean, echo: boolean): boolean => c.stars >= 3 && perfect && !echo;

function faultLine(c: Combat): void {
  const d = c.tuning.kits.torva.quake * P(c, 'faultLine');
  let n = 0;
  for (const b of movingReds(c).sort((a, b) => b.pos - a.pos)) if (c.pushBack(b, d) > 0) n++;
  if (n) c.perkFx('faultLine', n);
}

function rupture(c: Combat): void {
  if (!c.result) strikeAll(c, P(c, 'rupture'), 'rupture');
}

/** Landslide: every n-th Quake knocks every red off the bar. */
function landslide(c: Combat): void {
  c.perk.landslide = (c.perk.landslide ?? 0) + 1;
  if (c.perk.landslide % every(c, 'landslide') !== 0 || c.result) return;
  const list = reds(c);
  for (const b of list) c.removeBlock(b, 'perk');
  c.perkFx('landslide', list.length);
}

const TORVA: Record<string, FightHooks> = {
  // Pulverize: stunned foes take n% more from her (Wind-Up stuns before its blow lands, so it counts)
  pulverize: {
    damageTaken: (c, e, _s, v) => (e.stun > 0 ? v * (1 + P(c, 'pulverize')) : v),
    afterHit: (c, x) => {
      if (x.target && x.target.stun > 0 && !x.echo) c.perkFx('pulverize', 0, x.target.id, x.block.pos);
    },
  },
  // Haymaker: a Wound-Up hit deals n% more (the kit spends the Wind-Up in its hitMult, so look before it: critChance)
  haymaker: {
    critChance: (c, x, v) => {
      c.perk.haymaker = c.perk.windUp && !x.green && !x.echo ? x.block.id : 0;
      return v;
    },
    hitMult: (c, x, v) => (c.perk.haymaker === x.block.id ? v * (1 + P(c, 'haymaker')) : v),
    afterHit: (c, x) => {
      if (c.perk.haymaker !== x.block.id) return;
      c.perk.haymaker = 0;
      c.perkFx('haymaker', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Wrecking Ball (capstone): every n-th Perfect hit (not a green) winds up the next one, like Wind-Up
  wreckingBall: {
    afterHit: (c, x) => {
      if (!x.perfect || x.green || x.echo) return;
      c.perk.wreckingBall = (c.perk.wreckingBall ?? 0) + 1;
      if (c.perk.wreckingBall % every(c, 'wreckingBall') !== 0) return;
      c.perk.windUp = 1;
      c.perkFx('wreckingBall', 0, 0, x.block.pos);
    },
  },
  // Fault Line: Quakes knock reds n% further
  faultLine: {
    afterHit: (c, x) => {
      if (quakeHit(x)) faultLine(c);
    },
    afterBlock: (c, x) => {
      if (quakeBlock(c, x.perfect, x.echo)) faultLine(c);
    },
  },
  // Rupture: a Quake also hits every foe for n% attack
  rupture: {
    afterHit: (c, x) => {
      if (quakeHit(x)) rupture(c);
    },
    afterBlock: (c, x) => {
      if (quakeBlock(c, x.perfect, x.echo)) rupture(c);
    },
  },
  // Landslide (capstone): every n-th Quake clears every red off the bar
  landslide: {
    afterHit: (c, x) => {
      if (quakeHit(x)) landslide(c);
    },
    afterBlock: (c, x) => {
      if (quakeBlock(c, x.perfect, x.echo)) landslide(c);
    },
  },
  // Seething: each hit she takes adds n Unstoppable stacks (the kit adds 1; still up to its limit)
  seething: {
    hurt: (c, amount, source) => {
      if (amount <= 0 || source === 'miss' || source === 'perk') return amount;
      const max = c.tuning.kits.torva.unstoppableMax;
      const before = c.perk.unstoppable ?? 0;
      c.perk.unstoppable = Math.min(max, before + Math.max(0, Math.round(N(c, 'seething')) - 1));
      if (c.perk.unstoppable > before) c.perkFx('seething', c.perk.unstoppable);
      return amount;
    },
  },
  // Payback: a red (or bomb) that hits her winds up her next hit, like Wind-Up (a smash that grows with the combo, and
  // a stun)
  payback: {
    hurt: (c, amount, source) => {
      if (amount <= 0 || (source !== 'red' && source !== 'bomb')) return amount;
      c.perk.windUp = 1;
      c.perkFx('payback');
      return amount;
    },
  },
  // Berserk (capstone): under half HP, her hits deal n% more
  berserk: {
    hitMult: (c, x, v) => {
      if (x.echo || c.hero.hp >= c.maxHp() * 0.5) return v;
      c.perk.berserk = x.block.id;
      return v * (1 + P(c, 'berserk'));
    },
    afterHit: (c, x) => {
      if (c.perk.berserk !== x.block.id) return;
      c.perk.berserk = 0;
      c.perkFx('berserk', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
};

/** Every hero's rule nodes and capstones but Rowan's (skill-fx.ts merges them into SKILL_HOOKS). */
export const HERO_SKILL_HOOKS: Record<string, FightHooks> = { ...SABLE, ...NEVE, ...MOSS, ...TAM, ...HOLLIS, ...VESPER, ...TORVA };

// ---- Solenne and Wren (Part 6)
//   sunLits / flareSeen / mornSeen   Sunrise's lightings, and the ones Solar Flare and Long Morning have answered
//   giltHit                          the gilded hit Gilt Strike made stronger
//   slips / tumbleSeen               Slip's dodges, and the ones Tumble has hit back for
//   backstabHit                      the hit Backstab made stronger

/** Sunrise lit since a node last looked (c.perk[seen] counts the ones it answered). */
function sunLitSince(c: Combat, seen: string): boolean {
  const lits = c.perk.sunLits ?? 0;
  if (lits <= (c.perk[seen] ?? 0)) return false;
  c.perk[seen] = lits;
  return true;
}

/** Solar Flare: as Sunrise lights, a flare hits every foe for n% attack. */
function solarFlare(c: Combat): void {
  if (!c.result && sunLitSince(c, 'flareSeen')) strikeAll(c, P(c, 'solarFlare'), 'solarFlare');
}

/** Long Morning: Sunrise burns n s longer (the kit adds c.perk.sunBonus to its burn); it names itself as it lights. */
function longMorning(c: Combat): void {
  if (sunLitSince(c, 'mornSeen')) c.perkFx('longMorning', N(c, 'longMorning'));
}

const SOLENNE: Record<string, FightHooks> = {
  // Early Light: Sunrise comes every n combo (the kit reads c.perk.sunEvery)
  earlyLight: {
    start: (c) => {
      c.perk.sunEvery = Math.max(2, Math.round(N(c, 'earlyLight')));
    },
    combo: (c, before, after) => {
      const n = sunEvery(c);
      const base = Math.max(2, Math.round(c.tuning.kits.solenne.sunEvery));
      if (Math.floor(after / n) > Math.floor(before / n) && Math.floor(after / base) <= Math.floor(before / base)) c.perkFx('earlyLight', after);
    },
  },
  // Long Morning: Sunrise burns n s longer
  longMorning: {
    start: (c) => {
      c.perk.sunBonus = Math.max(0, N(c, 'longMorning'));
    },
    combo: (c) => longMorning(c),
    comboBreak: (c) => longMorning(c),
    step: (c) => longMorning(c),
  },
  // Solar Flare (capstone): as Sunrise lights, a flare hits every foe (the kit lights it on a combo step; Rekindle on a
  // break; a step catches any other)
  solarFlare: {
    combo: (c) => solarFlare(c),
    comboBreak: (c) => solarFlare(c),
    step: (c) => solarFlare(c),
  },
  // Twin Gleam: a green gilds n yellows (the kit reads c.perk.gleams)
  twinGleam: {
    start: (c) => {
      c.perk.gleams = Math.max(1, Math.round(N(c, 'twinGleam')));
    },
    afterHit: (c, x) => {
      if (x.green && !x.echo) c.perkFx('twinGleam', 0, 0, x.block.pos);
    },
  },
  // Gilt Strike: a gilded hit deals n% more
  giltStrike: {
    hitMult: (c, x, v) => {
      if (x.echo || !isGilded(x.block)) return v;
      c.perk.giltHit = x.block.id;
      return v * (1 + P(c, 'giltStrike'));
    },
    afterHit: (c, x) => {
      if (c.perk.giltHit !== x.block.id) return;
      c.perk.giltHit = 0;
      c.perkFx('giltStrike', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Midas Touch (capstone): a Perfect on a gilded yellow gilds the next one (the kit notes the gilded hit)
  midasTouch: {
    afterHit: (c, x) => {
      if (x.echo || !x.perfect || c.perk.gildedHit !== x.block.id || c.result) return;
      const b = gildNext(c);
      if (b) c.perkFx('midasTouch', 0, 0, b.pos);
    },
  },
  // Firm Oath: Dawn Oath holds from n combo (the kit reads c.perk.oathAt); it names itself when it kept a combo the
  // kit alone wouldn't have
  firmOath: {
    start: (c) => {
      c.perk.oathAt = Math.max(1, Math.round(N(c, 'firmOath')));
    },
    comboBreak: (c, x) => {
      if (x.cause === 'miss' && x.combo >= oathAt(c) && x.combo < c.tuning.kits.solenne.oathAt && x.keepCombo > 0) c.perkFx('firmOath', x.keepCombo);
    },
  },
  // Sun Ward: while Sunrise burns, reds (and bombs) that reach her deal n% less
  sunWard: {
    hurt: (c, amount, source) => {
      if (!(c.perk.sunrise > 0) || (source !== 'red' && source !== 'bomb') || amount <= 0) return amount;
      const cut = amount * Math.min(1, P(c, 'sunWard'));
      c.perkFx('sunWard', cut);
      return amount - cut;
    },
  },
  // Rekindle (capstone): losing rekindleAt+ combo lights Sunrise for n s (a combo built first: tapping wild earns none)
  rekindle: {
    comboBreak: (c, x) => {
      if (x.combo < Math.max(1, c.tuning.kits.solenne.rekindleAt) || c.result) return;
      ignite(c, Math.max(0, N(c, 'rekindle')));
      c.perkFx('rekindle', N(c, 'rekindle'));
    },
  },
};

const WREN: Record<string, FightHooks> = {
  // Nimble: the Chain survives n Good hits between Perfects (the kit reads c.perk.feet)
  nimble: {
    start: (c) => {
      c.perk.feet = Math.max(0, Math.round(N(c, 'nimble')));
    },
    afterHit: (c, x) => {
      if (!x.echo && c.perk.feetHit === x.block.id && (c.perk.feetUsed ?? 0) > c.tuning.kits.wren.feet) c.perkFx('nimble', chainOf(c), x.target?.id ?? 0, x.block.pos);
    },
  },
  // Backstab: at full Chain (going into the hit), her hits deal n% more
  backstab: {
    hitMult: (c, x, v) => {
      if (x.echo || chainOf(c) < Math.round(c.tuning.styles.chainMax)) return v;
      c.perk.backstabHit = x.block.id;
      return v * (1 + P(c, 'backstab'));
    },
    afterHit: (c, x) => {
      if (c.perk.backstabHit !== x.block.id) return;
      c.perk.backstabHit = 0;
      c.perkFx('backstab', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Knife Storm (capstone): a Perfect at full Chain (going into it) also hits every foe for n% attack
  knifeStorm: {
    afterHit: (c, x) => {
      if (x.echo || !x.perfect || c.result || (c.perk.feetWas ?? 0) < Math.round(c.tuning.styles.chainMax)) return;
      strikeAll(c, P(c, 'knifeStorm'), 'knifeStorm');
    },
  },
  // Quick Slip: Slip readies after n Perfects in a row (the kit reads c.perk.slipEvery)
  quickSlip: {
    start: (c) => {
      c.perk.slipEvery = Math.max(1, Math.round(N(c, 'quickSlip')));
    },
    afterHit: (c, x) => {
      if (!x.echo && c.perk.slipReadyHit === x.block.id) c.perkFx('quickSlip', 0, 0, x.block.pos);
    },
  },
  // Tumble: a dodge hits the red's owner for n% attack (the kit counts the dodges: c.perk.slips)
  tumble: {
    step: (c) => {
      const n = c.perk.slips ?? 0;
      if (n <= (c.perk.tumbleSeen ?? 0)) return;
      c.perk.tumbleSeen = n;
      const e = c.enemyById(c.perk.slipOwner ?? 0);
      if (e?.alive && !c.result) c.strike(e, c.stats().atk * P(c, 'tumble'), 'tumble', false, 0);
    },
  },
  // Untouchable (capstone): Slip holds up to n dodges (the kit reads c.perk.slipMax)
  untouchable: {
    start: (c) => {
      c.perk.slipMax = Math.max(1, Math.round(N(c, 'untouchable')));
    },
    afterHit: (c, x) => {
      if (!x.echo && c.perk.slipReadyHit === x.block.id && (c.perk.slip ?? 0) >= 2) c.perkFx('untouchable', c.perk.slip, 0, x.block.pos);
    },
  },
  // Long Haze: Smoke Pop lasts n s longer
  longHaze: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      c.hero.abilityTimer += Math.max(0, N(c, 'longHaze'));
      c.perkFx('longHaze', N(c, 'longHaze'), 0, x.block.pos);
    },
  },
  // Choking Smoke: reds in the smoke (on the bar when it pops, or coming while it hangs) move n% slower
  chokingSmoke: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      const list = movingReds(c);
      for (const b of list) c.chillRed(b, c.hero.abilityTimer, 1 - Math.min(1, P(c, 'chokingSmoke')));
      if (list.length) c.perkFx('chokingSmoke', list.length);
    },
    spawned: (c, b) => {
      if (ability(c) && isRed(b.kind)) c.chillRed(b, c.hero.abilityTimer, 1 - Math.min(1, P(c, 'chokingSmoke')));
    },
  },
  // Blinding Smoke (capstone): a green blinds every foe: no reds (they're stunned) for n s
  blindingSmoke: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result) return;
      const foes = c.aliveFoes();
      for (const e of foes) c.stun(e, Math.max(0, N(c, 'blindingSmoke')));
      if (foes.length) c.perkFx('blindingSmoke', foes.length);
    },
  },
};

Object.assign(HERO_SKILL_HOOKS, SOLENNE, WREN);

// ---- Yara (Part 6): one branch per spirit (her Wolf, her Tortoise, her Wisps and the Great Spirit stag)
//   wolfMult / wispMult      Long Fang's and Bright Wisps' share on the Wolf's bites and the Wisps' fill (styles.ts)
//   huntingCall              Perfect hits toward the next Hunting Call
//   <node><allyId>           a node's memory of a spirit (its timer, its time left: Long Bond)
//   spikedShell / thunderhoof   the shell blocks and the stag's strikes seen so far

/** Every living foe but the current target: who a Twin Bite hits (the next one in line). */
const otherFoe = (c: Combat): Enemy | undefined => {
  const t = c.currentTarget();
  return c.aliveFoes().find((e) => e !== t);
};

/** A Wolf's bite now (what styles.ts allyAct deals): its share of attack, its power, Long Fang. */
const wolfBite = (c: Combat): number => c.stats().atk * c.tuning.kits.yara.wolfDmg * allyPower(c) * (c.perk.wolfMult ?? 1);

/** A Tortoise with its shell up (braced). */
const shellUp = (c: Combat): boolean => c.allies.some((a) => a.kind === 'spiritTortoise' && a.braced);

const YARA: Record<string, FightHooks> = {
  // Long Fang: the Wolf's bites hit n% harder (named on each bite, on the Wolf)
  longFang: {
    start: (c) => {
      c.perk.wolfMult = (c.perk.wolfMult ?? 1) * (1 + P(c, 'longFang'));
    },
    step: (c) => {
      if (allyActs(c, 'longFang', 'spiritWolf').length) c.perkFx('longFang');
    },
  },
  // Twin Bite: a wolf bite also hits another foe (the next in line) for n% of it
  twinBite: {
    step: (c) => {
      for (let i = allyActs(c, 'twinBite', 'spiritWolf').length; i > 0 && !c.result; i--) {
        const e = otherFoe(c);
        if (e) c.strike(e, wolfBite(c) * P(c, 'twinBite'), 'twinBite');
      }
    },
  },
  // Hunting Call (capstone): every n-th Perfect hit sends the Wolf in to bite at once (its own timer starts over)
  huntingCall: {
    afterHit: (c, x) => {
      if (!x.perfect || x.echo || c.result) return;
      c.perk.huntingCall = (c.perk.huntingCall ?? 0) + 1;
      if (c.perk.huntingCall % every(c, 'huntingCall') !== 0) return;
      const wolf = c.allies.find((a) => a.kind === 'spiritWolf');
      if (!wolf) return;
      allyAct(c, wolf);
      wolf.timer = allyEvery(c, 'spiritWolf');
      c.perkFx('huntingCall', 0, c.currentTarget()?.id ?? 0, x.block.pos);
    },
  },
  // Quick Shell: the Tortoise's shell comes up n% sooner (on arrival and after each block)
  quickShell: {
    step: (c) => {
      for (const a of c.allies) if (a.kind === 'spiritTortoise' && !a.braced) a.timer -= DT * P(c, 'quickShell');
      if (arrived(c, 'quickShellId', 'spiritTortoise')) c.perkFx('quickShell');
    },
  },
  // Spiked Shell: a shell block hits the red's owner (else the front foe) for n% attack
  spikedShell: {
    step: (c) => {
      const n = c.perk.shellBlocks ?? 0;
      const seen = c.perk.spikedShell ?? 0;
      c.perk.spikedShell = n;
      if (n <= seen || c.result) return;
      const owner = c.enemyById(c.perk.shellOwner ?? 0);
      const e = owner?.alive ? owner : c.frontEnemy();
      if (e) c.strike(e, c.stats().atk * P(c, 'spikedShell') * (n - seen), 'spikedShell', false, 0);
    },
  },
  // Stone Ward (capstone): with the shell up, a Perfect block hits every foe for n% attack
  stoneWard: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo || c.result || !shellUp(c)) return;
      strikeAll(c, P(c, 'stoneWard'), 'stoneWard');
    },
  },
  // Bright Wisps: the Wisps fill n% more meter (named as they do)
  brightWisps: {
    start: (c) => {
      c.perk.wispMult = (c.perk.wispMult ?? 1) * (1 + P(c, 'brightWisps'));
    },
    step: (c) => {
      if (allyActs(c, 'brightWisps', 'wispSwarm').length) c.perkFx('brightWisps');
    },
  },
  // Long Bond: spirits stay n s longer (each time they're called or rallied: their time left jumps back up)
  longBond: {
    step: (c) => {
      let n = 0;
      for (const a of c.allies) {
        const k = `longBond${a.id}`;
        const was = c.perk[k];
        if (was === undefined || a.left > was + 1e-6) {
          a.left += Math.max(0, N(c, 'longBond'));
          n++;
        }
        c.perk[k] = a.left;
      }
      if (n) c.perkFx('longBond', n);
    },
  },
  // Thunderhoof (capstone): each Great Spirit strike knocks every red on the bar back n% of the bar
  thunderhoof: {
    step: (c) => {
      const n = c.perk.stagStrikes ?? 0;
      const seen = c.perk.thunderhoof ?? 0;
      c.perk.thunderhoof = n;
      if (n <= seen || c.result) return;
      let k = 0;
      for (const b of movingReds(c).sort((a, b) => b.pos - a.pos)) if (c.pushBack(b, P(c, 'thunderhoof')) > 0) k++;
      if (k) c.perkFx('thunderhoof', k);
    },
  },
};

// ---- Dell (Part 6): his Ricochet (kit-fx.ts reads c.perk.ricochetShare, pinball and luckyBounce, set here at the
// start), his Focus pouch, his Pebble Storm (c.perk.stormKnock)
//   luckyStreak     crits left from the last Lucky Shot

/** A Power Shot's bounce (kit-fx.ts ricochet's 'ricochetShot' strikes) happened since the green's own hit. */
const bounced = (c: Combat, x: HitCtx): boolean => since(c, hitIndex(c, x)).some((e) => e.type === 'perk' && e.id === 'ricochetShot');

const DELL: Record<string, FightHooks> = {
  // Hard Bounce: Ricochet bounces for n% of the shot (not half)
  hardBounce: {
    start: (c) => {
      c.perk.ricochetShare = P(c, 'hardBounce');
    },
    afterHit: (c, x) => {
      if (x.green && !x.echo && bounced(c, x)) c.perkFx('hardBounce', 0, 0, x.block.pos);
    },
  },
  // Lucky Bounce: a crit Power Shot's bounces crit too
  luckyBounce: {
    start: (c) => {
      c.perk.luckyBounce = 1;
    },
    afterHit: (c, x) => {
      if (x.green && !x.echo && x.crit && bounced(c, x)) c.perkFx('luckyBounce', 0, 0, x.block.pos);
    },
  },
  // Pinball (capstone): Ricochet bounces on to every other foe
  pinball: {
    start: (c) => {
      c.perk.pinball = 1;
    },
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      const n = since(c, hitIndex(c, x)).filter((e) => e.type === 'perk' && e.id === 'ricochetShot').length;
      if (n >= 2) c.perkFx('pinball', n, 0, x.block.pos);
    },
  },
  // Full Pouch: Focus holds n% more (styles.ts focusCap reads c.perk.focusCapMult)
  fullPouch: {
    start: (c) => {
      c.perk.focusCapMult = (c.perk.focusCapMult ?? 1) * (1 + P(c, 'fullPouch'));
    },
    afterHit: (c, x) => {
      // (named the first time a hit stores Focus past what it used to hold)
      if (x.echo || x.green || c.perk.fullPouchShown || focusCap(c) <= 0) return;
      if (focusOf(c) > focusCap(c) / (c.perk.focusCapMult ?? 1) + 1e-9) {
        c.perk.fullPouchShown = 1;
        c.perkFx('fullPouch', 0, 0, x.block.pos);
      }
    },
  },
  // Four Leaf: Perfect hits store n% more Focus
  fourLeaf: {
    afterHit: (c, x) => {
      if (!x.perfect || x.green || x.echo) return;
      const before = focusOf(c);
      addFocus(c, c.stats().atk * c.tuning.styles.focusStore * P(c, 'fourLeaf'));
      if (focusOf(c) > before) c.perkFx('fourLeaf', focusOf(c) - before, 0, x.block.pos);
    },
  },
  // Lucky Streak (capstone): after a Lucky Shot (a Perfect green), the next n hits crit; a miss ends it
  luckyStreak: {
    critChance: (c, x, v) => (!x.echo && !x.green && (c.perk.luckyStreak ?? 0) > 0 ? Math.max(v, 1) : v),
    afterHit: (c, x) => {
      if (x.echo) return;
      if (x.green) {
        if (x.perfect) c.perk.luckyStreak = every(c, 'luckyStreak');
        return;
      }
      if ((c.perk.luckyStreak ?? 0) <= 0) return;
      c.perk.luckyStreak--;
      c.perkFx('luckyStreak', c.perk.luckyStreak, x.target?.id ?? 0, x.block.pos);
    },
    miss: (c) => {
      c.perk.luckyStreak = 0;
    },
  },
  // Hailstones: Pebble Storm hits n% harder
  hailstones: {
    finisher: (c, _x, v) => {
      c.perkFx('hailstones');
      return v * (1 + P(c, 'hailstones'));
    },
  },
  // Big Knock: Pebble Storm knocks the reds n% further (kit-fx.ts reads c.perk.stormKnock)
  bigKnock: {
    start: (c) => {
      c.perk.stormKnock = (c.perk.stormKnock ?? 1) * (1 + P(c, 'bigKnock'));
    },
    afterFinisher: (c) => {
      if (movingReds(c).length) c.perkFx('bigKnock');
    },
  },
  // Pelt (capstone): a Power Shot knocks its foe's reds back (half as far as Pebble Storm)
  pelt: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result) return;
      const shot = since(c, hitIndex(c, x)).find((e): e is Extract<CombatEvent, { type: 'perk' }> => e.type === 'perk' && e.id === 'powerShot');
      if (!shot) return;
      let n = 0;
      for (const b of movingReds(c).filter((r) => r.ownerId === shot.enemyId).sort((a, b) => b.pos - a.pos)) if (c.pushBack(b, c.tuning.kits.dell.stormKnock / 2) > 0) n++;
      if (n) c.perkFx('pelt', n, shot.enemyId);
    },
  },
};

Object.assign(HERO_SKILL_HOOKS, YARA, DELL);
