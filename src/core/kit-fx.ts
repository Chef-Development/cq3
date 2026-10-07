// The heroes' kits as fight hooks (core/hooks.ts): each hero's signature mechanic, green-block ability, passive,
// finisher twist, star moves (3 and 5 stars) and soft strengths, on top of their style's shared rule
// (core/styles.ts). One cursor for every hero. Numbers: tuning.hero (Rowan) and tuning.kits.<id>; words:
// src/data/heroes.ts.

import { heroDef, type HeroId } from '../data/heroes';
import { isAttack, isRed } from './blocks';
import type { Block, Combat, Enemy } from './combat';
import type { HeroBuild } from './heroes';
import type { FightHooks } from './hooks';
import { addFocus, addGuard, dropKeg, focusCap, focusOf, guardOf, powerShot, spendGuard } from './styles';

const K = (c: Combat) => c.tuning.kits;
const ability = (c: Combat): boolean => c.hero.abilityTimer > 0;

// ---------------------------------------------------------------- shared kit pieces

/** The next block ahead of the cursor in the way it's moving (Shadow Dash's target): any block but traps and
 *  mirrors, the nearest first. */
export function nextBlockAhead(c: Combat, skip?: Block): Block | null {
  const p = c.cursorPos();
  const dir = c.cursorDirAt(c.time);
  let best: Block | null = null;
  let bestD = Infinity;
  for (const b of c.blocks) {
    if (b === skip || b.kind === 'purple' || b.kind === 'mirror') continue;
    const near = b.pos - (dir * b.width) / 2;
    const d = (near - p) * dir;
    if (d > 0 && d < bestD) (best = b), (bestD = d);
  }
  return best;
}

/**
 * Shadow Dash: after a Perfect hit the cursor bursts ahead (tuning.kits.sable.dashMult times its speed) toward the
 * next block, slowing back to normal `lead` seconds of travel before it (counted through any patch on the way), so a
 * chain of Perfects comes fast and risky. The burst is a short-lived 'dash' patch from the cursor to that point (so
 * timing, the bot and the view all see it). Where it lands the cursor slows down for a moment (a 'land' patch at
 * kits.sable.landMult, about landSec long, ending at the block's near edge), so the block it dashed to can be read
 * and hit. It stops short of a red (to block it), ends before a hold's near edge, skips traps, and never runs past a
 * wall.
 */
export function shadowDash(c: Combat, lead = K(c).sable.dashLead): boolean {
  const b = nextBlockAhead(c);
  if (!b) return false;
  for (const z of c.zones.slice()) if (z.kind === 'dash' || z.kind === 'land') c.removeZone(z);
  const dir = c.cursorDirAt(c.time);
  const p = c.cursorPos();
  const edge = b.pos - (dir * b.width) / 2;
  // walk back from the edge until `lead` seconds of normal travel are left (patches change how far that is)
  const v = c.cursorSpeed();
  let target = edge;
  for (let i = 0; i < 24 && c.travelTime(target, edge, dir) < lead; i++) target -= dir * Math.max(0.004, v * c.zoneMultAt(target) * (lead / 24));
  if ((target - p) * dir <= 0.03) return false; // already that close: no dash
  const lo = Math.min(p, target);
  const hi = Math.max(p, target);
  const dashSec = c.travelTime(p, target, dir) / Math.max(1, K(c).sable.dashMult);
  const z = c.addZone('dash', (lo + hi) / 2, hi - lo, 0.05 + dashSec + 0.2);
  z.lo = lo;
  z.hi = hi;
  landing(c, target, edge, dir, dashSec);
  c.events.push({ type: 'dash', from: p, to: target });
  if (c.stars >= 3) c.perk.afterimage = 1; // 3 stars: the dash leaves an afterimage that stops the next red
  return true;
}

/** Where a dash lands, the cursor slows (kits.sable.landMult) for about landSec: a 'land' patch from the landing spot
 *  on, never past the block's near edge. Sable's step hook takes it away once the cursor is through it. */
function landing(c: Combat, at: number, edge: number, dir: number, dashSec: number): void {
  const S = K(c).sable;
  if (S.landSec <= 0 || S.landMult >= 1 || S.landMult <= 0) return;
  const room = (edge - at) * dir;
  if (room <= 0.002) return;
  const d = Math.min(room, S.landSec * c.cursorSpeed() * c.zoneMultAt(at) * S.landMult);
  const lo = Math.min(at, at + dir * d);
  const hi = Math.max(at, at + dir * d);
  const z = c.addZone('land', (lo + hi) / 2, hi - lo, dashSec + S.landSec * 2 + 0.3);
  z.lo = lo;
  z.hi = hi;
  c.perk.landDir = dir;
}

/** Torva's Wind-Up smash multiplier right now: a base, plus a step for every combo, up to a cap (the view can show
 *  it on the armed mark). */
export function windUpMult(c: Combat): number {
  const k = K(c).torva;
  return Math.max(1, Math.min(k.windUpMax, k.windUpBase + k.windUpStep * Math.max(0, c.combo)));
}

/** Glacier: every red on the bar freezes solid where it is (it waits, still a red to block), and the bar slows: all of
 *  it for a moment (kits.neve.glacierBarSec), then the middle patch for the rest of slowSec (5 stars: all of it). */
function glacier(c: Combat): void {
  const k = K(c).neve;
  let n = 0;
  for (const b of c.blocks)
    if (isRed(b.kind)) {
      c.holdRed(b, k.glacierSec);
      n++;
    }
  const w = c.stars >= 5 ? 1 : Math.max(0, Math.min(1, k.slowWidth));
  if (w > 0) c.addZone('slow', 0.5, w, k.slowSec);
  const side = (1 - w) / 2;
  if (side > 0.01 && k.glacierBarSec > 0) {
    c.addZone('slow', side / 2, side, k.glacierBarSec);
    c.addZone('slow', 1 - side / 2, side, k.glacierBarSec);
  }
  c.perkFx('glacier', n);
}

/** Whether the cursor can get to block b: no mirror shard (it bounces the cursor back) between them. */
const reachable = (c: Combat, b: Block): boolean => {
  const p = c.cursorPos();
  return !c.blocks.some((m) => m.kind === 'mirror' && (m.pos - p) * (b.pos - m.pos) > 0);
};

/** A Shield Slam's share of attack: a plain block's, or a Perfect block's (any block's at 5 stars). */
export const slamShare = (c: Combat, perfect: boolean): number => (perfect || c.stars >= 5 ? K(c).hollis.slamPerfect : K(c).hollis.slam);

/** Soft strengths: an edge against some kinds of foes (more damage to them, or less from them). */
function strengthHooks(id: HeroId): FightHooks {
  const list = heroDef(id).strengths;
  const tagged = (c: Combat, e: Enemy | undefined, kind: 'dmg' | 'guard'): number => {
    if (!e) return 0;
    const tags = c.tuning.enemies[e.key]?.tags ?? [];
    let n = 0;
    for (const s of list) if (s.kind === kind && tags.includes(s.tag)) n += s.n;
    return n * c.tuning.hero.strengthScale;
  };
  return {
    damageTaken: (c, e, _src, v) => v * (1 + tagged(c, e, 'dmg')),
    hurt: (c, amount, source, enemyId) => (source === 'miss' || source === 'perk' ? amount : amount * (1 - tagged(c, c.enemyById(enemyId), 'guard'))),
  };
}

// ---------------------------------------------------------------- the kits

export const KIT_HOOKS: Record<HeroId, FightHooks> = {
  rowan: {
    // Battle Focus: while the green ability is on, hits crit more often (5 stars: and count 2 combo)
    critChance: (c, _x, v) => (ability(c) ? v + c.tuning.hero.abilityCritBonus : v),
    comboGain: (c, from, _p, n) => (from === 'hit' && ability(c) && c.stars >= 5 ? n + 1 : n),
    // Knight's Resolve: the first hit taken each fight doesn't break the combo
    comboBreak: (c, x) => {
      if (x.cause !== 'hurt' || c.perk.resolve) return;
      c.perk.resolve = 1;
      x.keepCombo = x.combo;
      x.keepStacks = x.stacks;
      x.keepMeter = x.meter;
      c.perkFx('resolve');
    },
    // Whirlwind hits every foe (the core's default); 3 stars: +1 combo per foe it hits
    afterFinisher: (c, x) => {
      if (c.stars >= 3 && x.targets.length) {
        c.combo += x.targets.length;
        c.perkFx('wideSweep', x.targets.length);
      }
    },
  },
  sable: {
    // Shadow Dash: a Perfect hit dashes the cursor ahead
    afterHit: (c, x) => {
      if (!x.echo && x.perfect && !c.result) shadowDash(c);
    },
    // Smoke Veil: while the green ability is on, a miss doesn't break the combo (or the chain)
    step: (c) => {
      c.perk.veil = ability(c) ? 1 : 0;
      // a dash's landing slow-down is over once the cursor is through it (or has turned)
      for (const z of c.zones)
        if (z.kind === 'land') {
          const d = c.perk.landDir || 1;
          const p = c.cursorPos();
          if ((d > 0 ? p > z.hi + 1e-6 : p < z.lo - 1e-6) || c.cursorDirAt(c.time) !== d) c.removeZone(z);
          break;
        }
    },
    miss: (c, x) => {
      if (!ability(c)) return;
      x.breaks = false;
      x.damage = 0;
      c.perkFx('smokeVeil');
    },
    // Silent Step: Perfect hits fill the meter more
    meter: (c, source, v) => ((source === 'hit' || source === 'green') && c.hitNow?.perfect && !c.hitNow.echo ? v * (1 + K(c).sable.silentStep) : v),
    // 3 stars: the afterimage a dash leaves stops the next red that reaches her
    impact: (c) => {
      if (!c.perk.afterimage) return false;
      c.perk.afterimage = 0;
      c.perkFx('afterimage');
      return true;
    },
    // Twin Fang: the finisher strikes the target alone, harder; a kill keeps a stack; 5 stars: it strikes twice
    finisher: (c, x, v) => {
      const target = c.currentTarget();
      if (target) x.targets = [target];
      return v * K(c).sable.fangMult;
    },
    afterFinisher: (c, x) => {
      if (c.stars >= 5) {
        const t = x.targets.find((e) => e.alive);
        if (t) c.strike(t, x.damage * 0.5, 'fangAndClaw');
      }
      if (x.killed > 0 && (c.enemies.some((e) => e.alive) || c.nextWaveIn >= 0)) c.bankStacks(Math.round(K(c).sable.fangKeep), 'twinFang');
    },
  },
  neve: {
    // Flash Freeze: blocking a red can freeze it in place (always on a Perfect block)
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || x.block.kind === 'bomb' || c.result) return;
      const chance = c.stars >= 3 ? K(c).neve.freeze3 : K(c).neve.freeze;
      if (!x.perfect && c.rand() >= chance) return;
      const f = c.spawnBlock('frozen', x.block.pos, x.block.ownerId, Math.max(x.block.width, c.tuning.blocks.attackWidth));
      c.events.push({ type: 'iceBlock', id: f.id, pos: f.pos });
      c.perkFx('flashFreeze', 0, 0, f.pos);
    },
    // Cold Snap: ice patches bother her half as much; shattered ice fills only part of a hit's meter (it used to fill
    // a green's: playtest round 6 found her meter filling too fast)
    zoneMult: (c, z, v) => (z.kind === 'ice' ? 1 + (v - 1) * K(c).neve.iceResist : v),
    meter: (c, source, v) => (source === 'hit' && c.hitNow?.block.kind === 'frozen' && !c.hitNow.echo ? v * K(c).neve.iceMeter : v),
    // Chill: while the green ability is on, the cursor moves slower
    cursorMult: (c, v) => (ability(c) ? v * K(c).neve.chill : v),
    // Glacier: hits every foe (a little less), freezes every red on the bar solid, slows the bar (all of it for a
    // moment, then the middle); her Big Freeze node turns the frozen reds into ice to smash instead
    finisher: (c, x, v) => {
      x.reds = 'keep';
      return v * K(c).neve.glacierMult;
    },
    afterFinisher: (c) => glacier(c),
  },
  moss: {
    // Deep Roots: with 2+ allies out, hits deal more
    hitMult: (c, x, v) => (!x.echo && c.allies.length >= 2 ? v * (1 + K(c).moss.roots) : v),
    // Overgrowth: hits every foe, more per ally out; vines slow the reds that come in the next few seconds
    finisher: (c, _x, v) => v * (1 + K(c).moss.overgrowth * c.allies.length),
    afterFinisher: (c) => {
      c.perk.vines = K(c).moss.vineSec;
    },
    step: (c) => {
      if (c.perk.vines > 0) c.perk.vines = Math.max(0, c.perk.vines - 1 / 120);
    },
    spawned: (c, b) => {
      if (c.perk.vines > 0 && isRed(b.kind)) c.chillRed(b, c.perk.vines + 1, K(c).moss.vineMult);
    },
  },
  tam: {
    start: (c) => {
      c.perk.chainFuse = 1; // Chain Fuse: kegs set each other off
    },
    // Fuse Up: green hits drop a keg on the bar
    afterHit: (c, x) => {
      if (x.green && !x.echo && dropKeg(c)) c.perkFx('fuseUp');
    },
    // Blast Shield: enemy bombs that reach you deal half
    hurt: (c, amount, source) => (source === 'bomb' ? amount * (1 - K(c).tam.blastShield) : amount),
    // 5 stars: kegs blast twice as wide
    kegRadius: (c, r) => (c.stars >= 5 ? r * K(c).tam.wide5 : r),
    // Big Bang: hits every foe, then drops kegs on the bar
    afterFinisher: (c) => {
      let n = 0;
      for (let i = 0; i < Math.round(K(c).tam.bangKegs); i++) if (dropKeg(c)) n++;
      if (n) c.perkFx('bigBang', n);
    },
  },
  hollis: {
    // Shield Slam: every block hits the red's owner back (a Perfect one harder; 5 stars: every one as hard), with a
    // hit-stop of its own
    afterBlock: (c, x) => {
      if (x.echo) return;
      // Brace: while the green ability is on, blocks store double Guard
      if (ability(c) && !x.cracked) addGuard(c, 1);
      if (!x.owner?.alive || c.result) return;
      c.strike(x.owner, c.stats().atk * slamShare(c, x.perfect), 'shieldSlam', false, x.block.pos);
      c.hitStopFor(c.tuning.juice.slamStopMs);
    },
    meter: (c, source, v) => (source === 'block' && ability(c) ? v * 2 : v),
    // Iron Hide: reds that reach you deal less
    hurt: (c, amount, source) => (source === 'red' || source === 'bomb' ? amount * (1 - K(c).hollis.ironHide) : amount),
    // Rampart: one big hit with all the Guard; then reds bounce off the left end for a while
    finisher: (c, x, v) => {
      const target = c.currentTarget();
      if (target) x.targets = [target];
      const g = guardOf(c);
      return g > 0 ? v * (1 + spendGuard(c) * K(c).hollis.rampartGuard) : v;
    },
    afterFinisher: (c) => {
      c.perk.rampart = K(c).hollis.rampartSec;
    },
    step: (c) => {
      if (c.perk.rampart > 0) c.perk.rampart = Math.max(0, c.perk.rampart - 1 / 120);
    },
    atWall: (c) => c.perk.rampart > 0,
  },
  vesper: {
    start: (c) => {
      c.perk.eagle = 1; // Eagle Eye: Perfects store double Focus
      c.perk.pierce = 1; // Piercing Shot: the Power Shot also hits the foe behind
      c.perk.patience = 1; // Patience: Focus is kept between waves; a full Focus crits
    },
    // Patience, on a crowded bar: at full Focus with no green out to fire it (none on the bar, or only behind a mirror
    // shard the cursor bounces off), a Perfect hit fires it (a crit)
    afterHit: (c, x) => {
      if (x.echo || x.green || !x.perfect || c.result || focusCap(c) <= 0) return;
      if (focusOf(c) < focusCap(c) * 0.999 || c.blocks.some((b) => b.kind === 'green' && reachable(c, b))) return;
      const dmg = powerShot(c, true);
      if (dmg > 0) c.perkFx('patience', dmg, 0, x.block.pos);
    },
    // Volley: arrows on every foe (Focus spent, x1.5), and every red on the bar is pinned in place
    finisher: (c, x, v) => {
      x.reds = 'keep';
      const f = focusOf(c);
      if (f <= 0 || x.damage <= 0) return v;
      c.perk.focus = 0;
      c.perkFx('volley', f);
      return v * (1 + (f * K(c).vesper.volleyFocus) / Math.max(1, x.damage * Math.max(1, x.targets.length)));
    },
    afterFinisher: (c) => {
      // (an icicle is pinned too: its fuse waits, like a red's strike at the left end)
      const sec = K(c).vesper.pinSec * (c.stars >= 5 ? 2 : 1);
      for (const b of c.blocks) if (isRed(b.kind)) c.holdRed(b, sec);
      addFocus(c, 0);
    },
  },
  torva: {
    // Quake: a Perfect hit (3 stars: or block) knocks every red back
    afterHit: (c, x) => {
      if (x.echo) return;
      if (x.perfect) quake(c);
      // Wind-Up: a green hit winds up the next one
      if (x.green) c.perk.windUp = 1;
    },
    afterBlock: (c, x) => {
      if (c.stars >= 3 && x.perfect && !x.echo) quake(c);
    },
    // ...the smash grows with the combo (windUpMult); its perk event's amount is the multiplier x100
    hitMult: (c, x, v) => {
      if (x.echo || x.green || !c.perk.windUp) return v;
      c.perk.windUp = 0;
      const m = windUpMult(c);
      if (x.target) c.stun(x.target, K(c).torva.stunSec);
      c.perkFx('windUp', m * 100, x.target?.id ?? 0, x.block.pos);
      return v * m;
    },
    // Unstoppable: each hit taken adds damage for the rest of the fight
    hurt: (c, amount, source) => {
      if (amount > 0 && source !== 'miss' && source !== 'perk') c.perk.unstoppable = Math.min(K(c).torva.unstoppableMax, (c.perk.unstoppable ?? 0) + 1);
      return amount;
    },
    damageTaken: (c, _e, source, v) => (source === 'hit' && c.perk.unstoppable ? v * (1 + K(c).torva.unstoppable * c.perk.unstoppable) : v),
    // Earthsplitter: hits every foe, clears every block off the bar, and no reds come for a moment; 5 stars: keeps a
    // stack
    finisher: (_c, x, v) => {
      x.reds = 'all';
      return v;
    },
    afterFinisher: (c) => {
      for (const e of c.enemies) if (e.alive) e.spawnTimer = Math.max(e.spawnTimer, K(c).torva.calmSec);
      if (c.stars >= 5) c.bankStacks(1, 'secondSwing');
    },
  },
};

function quake(c: Combat): void {
  let n = 0;
  for (const b of c.blocks)
    if (isRed(b.kind) && !b.still) {
      c.pushBack(b, K(c).torva.quake);
      n++;
    }
  if (n) c.perkFx('quake', 0);
}

/** The hooks a hero's kit brings to a fight: the kit itself, their stars' stat steps, their soft strengths. */
export function kitHooks(build: HeroBuild): FightHooks[] {
  return [KIT_HOOKS[build.id] ?? KIT_HOOKS.rowan, strengthHooks(build.id)];
}

/** Whether a block is one of your own attack blocks a perk may hit for you (never a hold, nor half a linked pair). */
export const perkHittable = (b: Block): boolean => isAttack(b.kind) && b.kind !== 'hold' && !b.link;
