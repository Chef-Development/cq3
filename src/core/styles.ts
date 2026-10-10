// The styles' shared rules as fight hooks (core/hooks.ts). A style is defined by what it rewards, so many heroes can
// share one: Blade (combos and stacks), Shadow (chains of Perfects), Guardian (blocking into damage), Marksman (store
// power, spend it in bursts), Brute (fewer, heavier taps), Controller (bending the bar), Summoner (allies), Bomber
// (your own kegs on the bar). Numbers: tuning.styles; words: src/data/styles.ts. Each hero's kit (core/kit-fx.ts)
// adds to its style through the helpers here (addGuard, addFocus, callAlly...). Per-fight state lives in c.perk.

import { heroDef, type AllyKind, type StyleId } from '../data/heroes';
import { isRed } from './blocks';
import type { Ally, Combat } from './combat';
import type { FightHooks } from './hooks';

const S = (c: Combat) => c.tuning.styles;

// ---------------------------------------------------------------- Shadow: the Chain

/** The current chain of Perfect hits in a row (Shadow). */
export const chainOf = (c: Combat): number => c.perk.chain ?? 0;

// ---------------------------------------------------------------- Guardian: Guard

/** Guard charges stored (Guardian), and the most it can hold (Hollis's 3 stars raise it). */
export const guardOf = (c: Combat): number => c.perk.guard ?? 0;
export const guardMax = (c: Combat): number => (c.heroId === 'hollis' && c.stars >= 3 ? c.tuning.kits.hollis.guardMax3 : S(c).guardMax);

export function addGuard(c: Combat, n: number): void {
  c.perk.guard = Math.min(guardMax(c), guardOf(c) + n);
}

/** Spend every Guard charge: the bonus share of attack it was worth (0 if none). */
export function spendGuard(c: Combat): number {
  const g = guardOf(c);
  c.perk.guard = 0;
  return g * S(c).guardPer;
}

/**
 * A Bulwark: every Guard charge unleashed at once, a blow on every foe (styles.bulwarkPer x attack per charge), with
 * a big hit-stop. The 'bulwark' perk event is the moment (amount: the charges, pos: the block or hit that set it
 * off); each foe's blow is a 'bulwarkBlow' strike. `c.perk.bulwarkNow` is 1 until the next tick (nodes read it).
 */
export function bulwark(c: Combat, pos: number): number {
  const g = guardOf(c);
  if (g <= 0 || c.result) return 0;
  c.perk.guard = 0;
  c.perk.bulwarkNow = 1;
  c.perkFx('bulwark', g, 0, pos);
  const dmg = c.stats().atk * S(c).bulwarkPer * g;
  for (const e of c.aliveFoes()) c.strike(e, dmg, 'bulwarkBlow', false, pos);
  c.hitStopFor(c.tuning.juice.bulwarkStopMs);
  return g;
}

// ---------------------------------------------------------------- Marksman: Focus

export const focusOf = (c: Combat): number => c.perk.focus ?? 0;
export const focusCap = (c: Combat): number =>
  c.stats().atk * S(c).focusCap * (c.heroId === 'vesper' && c.stars >= 3 ? c.tuning.kits.vesper.cap3 : 1) * (c.perk.focusCapMult ?? 1); // (Dell's Full Pouch)

export function addFocus(c: Combat, amount: number): void {
  c.perk.focus = Math.min(focusCap(c), focusOf(c) + Math.max(0, amount));
}

/** Fire every bit of Focus at the target as a Power Shot (Piercing Shot also hits the foe behind it). What the foe
 *  didn't need (it had less HP left, or a phase gate stopped the blow) stays stored as Focus. */
export function powerShot(c: Combat, crit = false): number {
  const f = focusOf(c);
  const target = c.currentTarget();
  c.perk.focus = 0;
  if (f <= 0 || !target) return 0;
  const dmg = f * (crit ? c.stats().critDmg : 1);
  const hp0 = target.hp;
  const mark = c.events.length;
  c.strike(target, dmg, 'powerShot', crit);
  const hurt = c.events.slice(mark).find((e) => e.type === 'enemyHurt' && e.enemyId === target.id);
  const landed = hurt && hurt.type === 'enemyHurt' ? hurt.damage : 0;
  const dealt = hp0 - Math.max(0, target.hp);
  if (landed > 0 && dealt < landed) addFocus(c, f * (1 - dealt / landed));
  if (c.perk.pierce) {
    const behind = c.aliveFoes().find((e) => e !== target);
    if (behind) c.strike(behind, dmg * c.tuning.kits.vesper.pierce, 'pierce');
  }
  return dmg;
}

// ---------------------------------------------------------------- Summoner: allies

/**
 * How strong a Summoner's allies are: 1 for a fresh hero, plus kits.moss.allyComp for every Companion point (the
 * stat companions use) above a fresh hero's (tuning.companion.damage), as a share of it. Thornling jabs and Glowmoth
 * heals scale with it (a Barkback stops one red and a Seedling plants one green, whatever their power: when the
 * Barkback rested less with power, Moss ran far ahead at the bosses).
 */
export function allyPower(c: Combat): number {
  const base = Math.max(1, c.tuning.companion.damage);
  const comp = c.heroId === 'yara' ? c.tuning.kits.yara.allyComp : c.tuning.kits.moss.allyComp;
  return 1 + comp * Math.max(0, (c.stats().companion - base) / base);
}

/** How long a summoned ally stays (Moss's 3 stars: longer; Yara's spirits: her own). */
export const allySec = (c: Combat): number =>
  c.heroId === 'yara' ? c.tuning.kits.yara.allySec : c.heroId === 'moss' && c.stars >= 3 ? c.tuning.kits.moss.allySec3 : c.tuning.kits.moss.allySec;

/** Allies that stand guard: braced, they stop the next red that reaches the hero (Moss's Barkback, Yara's Tortoise). */
export const isBlocker = (kind: AllyKind): boolean => kind === 'barkback' || kind === 'spiritTortoise';

/** The ally kinds this hero calls, in order (Moss's 5 stars add the Seedling). */
export function allyKinds(c: Combat): AllyKind[] {
  const list = heroDef(c.heroId as never).allies ?? ['thornling', 'barkback', 'glowmoth'];
  return c.heroId === 'moss' && c.stars >= 5 ? [...list, 'seedling'] : list;
}

/** When an ally acts first, and then every this many seconds. */
export function allyEvery(c: Combat, kind: AllyKind): number {
  const k = c.tuning.kits.moss;
  const y = c.tuning.kits.yara;
  switch (kind) {
    case 'spiritWolf':
      return y.wolfEvery;
    case 'spiritTortoise':
      return y.shellRest; // (after a block: its shell first comes up shellFirst s after it's called)
    case 'wispSwarm':
      return y.wispEvery;
    case 'spiritStag':
      return y.stagEvery;
  }
  return kind === 'thornling' ? k.thornEvery : kind === 'barkback' ? k.barkEvery : kind === 'glowmoth' ? k.mothEvery : k.seedEvery;
}

/**
 * When a newly called ally acts first: half its time. A Tortoise raises its shell after kits.yara.shellFirst, or when
 * the last one's rest is over (c.perk.shellUp: a new call doesn't skip the rest after a block).
 */
const allyFirst = (c: Combat, kind: AllyKind): number =>
  kind === 'spiritTortoise' ? Math.max(c.tuning.kits.yara.shellFirst, (c.perk.shellUp ?? 0) - c.time) : allyEvery(c, kind) * 0.5;

/**
 * A green hit calls the next ally in order (up to the cap). With every kind out already, it's a Rally: every ally's
 * time is refreshed and they all act at once.
 */
export function callAlly(c: Combat): void {
  const kinds = allyKinds(c);
  const max = Math.min(Math.round(S(c).allyMax) + (kinds.length > 3 ? 1 : 0), kinds.length);
  const missing = kinds.find((k) => !c.allies.some((a) => a.kind === k));
  if (missing && c.allies.length < max) {
    const a: Ally = { id: (c.perk.allyId = (c.perk.allyId ?? 0) + 1), kind: missing, left: allySec(c), timer: allyFirst(c, missing), braced: false };
    c.allies.push(a);
    c.events.push({ type: 'ally', kind: missing, action: 'call', id: a.id, power: allyPower(c) });
    return;
  }
  // a Rally: everyone stays longer and acts now (a Barkback that just took a red keeps resting: one red per rest);
  // c.perk.rallies counts them (Yara's Great Spirit answers one)
  c.events.push({ type: 'ally', kind: kinds[0], action: 'rally', id: 0 });
  c.perkFx('rally');
  c.perk.rallies = (c.perk.rallies ?? 0) + 1;
  for (const a of c.allies) {
    a.left = allySec(c);
    if (isBlocker(a.kind) && !a.braced && a.timer > 0) continue;
    allyAct(c, a);
    a.timer = allyEvery(c, a.kind);
  }
}

/** An ally acts now (its own timer, a Rally, or a node that sends it in: Yara's Hunting Call). */
export function allyAct(c: Combat, a: Ally): void {
  const k = c.tuning.kits.moss;
  const power = allyPower(c);
  let amount = 0;
  if (a.kind === 'thornling') {
    const t = c.currentTarget();
    if (t) {
      amount = Math.max(1, Math.round(c.stats().atk * k.thornDmg * power));
      c.strike(t, amount, 'thornling');
    }
  } else if (a.kind === 'barkback') a.braced = true;
  else if (a.kind === 'glowmoth') amount = c.healPerk(c.maxHp() * k.mothHeal * power, 'glowmoth');
  else if (a.kind === 'spiritWolf') {
    // Yara's Spirit Wolf bites the target
    const t = c.currentTarget();
    if (t) {
      amount = Math.max(1, Math.round(c.stats().atk * c.tuning.kits.yara.wolfDmg * power * (c.perk.wolfMult ?? 1))); // (Long Fang)
      c.strike(t, amount, 'spiritWolf');
    }
  } else if (a.kind === 'spiritTortoise') {
    // ...her Spirit Tortoise raises its shell (it stops the next red; at 3 stars, the next two)
    a.braced = true;
    c.perk[`shell${a.id}`] = c.heroId === 'yara' && c.stars >= 3 ? Math.max(1, Math.round(c.tuning.kits.yara.shell3)) : 1;
  } else if (a.kind === 'wispSwarm') {
    // ...her Wisp Swarm fills the meter a little (never a heal)
    c.fillMeter(c.tuning.meter.perHit * c.tuning.kits.yara.wispMeter * power * (c.perk.wispMult ?? 1), 'perk'); // (Bright Wisps)
    c.perkFx('wispSwarm');
  } else {
    const front = c.frontEnemy();
    if (front && c.trySpawn('green', front.id)) c.perkFx('seedling');
  }
  c.events.push({ type: 'ally', kind: a.kind, action: 'act', id: a.id, amount, power });
}

function stepAllies(c: Combat, dt: number): void {
  for (const a of c.allies.slice()) {
    a.left -= dt;
    if (a.left <= 0) {
      if (a.kind === 'spiritTortoise' && !a.braced) c.perk.shellUp = c.time + a.timer; // (its rest carries on)
      c.allies.splice(c.allies.indexOf(a), 1);
      c.events.push({ type: 'ally', kind: a.kind, action: 'leave', id: a.id });
      continue;
    }
    if (isBlocker(a.kind) && a.braced) continue; // braced: waits for a red
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = allyEvery(c, a.kind);
      allyAct(c, a);
    }
  }
}

// ---------------------------------------------------------------- Bomber: kegs

/** Every Nth yellow comes as a keg (Tam's 3 stars: more often). */
export const kegEvery = (c: Combat): number => Math.max(2, Math.round(c.heroId === 'tam' && c.stars >= 3 ? c.tuning.kits.tam.kegEvery3 : S(c).kegEvery));

/** Drop a keg on the bar at a free spot. */
export function dropKeg(c: Combat): boolean {
  const front = c.frontEnemy();
  if (!front) return false;
  const p = c.freeSpot(c.widthFor('keg'));
  if (p === null) return false;
  c.spawnBlock('keg', p, front.id);
  return true;
}

// ---------------------------------------------------------------- the rules

const DT = 1 / 120;

export const STYLE_HOOKS: Record<StyleId, FightHooks> = {
  // Edge: a long combo charges the meter faster
  blade: {
    meter: (c, source, v) => (c.combo >= S(c).bladeCombo && (source === 'hit' || source === 'green' || source === 'block') ? v * (1 + S(c).bladeFill) : v),
  },
  // Chain: each Perfect in a row adds damage to the next hit; anything else starts it over
  shadow: {
    hitMult: (c, x, v) => (x.echo ? v : v * (1 + S(c).chainStep * chainOf(c))),
    afterHit: (c, x) => {
      if (x.echo) return;
      const before = chainOf(c);
      c.perk.chain = x.perfect ? Math.min(Math.round(S(c).chainMax), before + 1) : 0;
      if (x.perfect && c.perk.chain > before && c.perk.chain >= 2) c.perkFx('chain', c.perk.chain);
    },
    miss: (c) => {
      if (!c.perk.veil) c.perk.chain = 0;
    },
    comboBreak: (c) => {
      if (!c.perk.veil) c.perk.chain = 0;
    },
  },
  // Guard: blocks store charges; at full Guard the next block or hit unleashes them all as a Bulwark on every foe
  // (playtest round 6: spent on every hit, Guard never built to anything)
  guardian: {
    step: (c) => {
      c.perk.bulwarkNow = 0;
    },
    afterBlock: (c, x) => {
      if (x.cracked) return; // a shield counts once, when it breaks
      if (!x.echo && guardOf(c) >= guardMax(c)) bulwark(c, x.block.pos);
      const before = guardOf(c);
      addGuard(c, 1);
      if (guardOf(c) > before) c.perkFx('guardUp', guardOf(c), 0, x.block.pos);
    },
    afterHit: (c, x) => {
      if (!x.echo && guardOf(c) >= guardMax(c)) bulwark(c, x.block.pos);
    },
  },
  // Focus: hits hold some damage back as Focus; a green hit fires it all. Greens are the targets that fire it: they
  // come wider and carry `target` (the view draws them as targets)
  marksman: {
    blockWidth: (c, kind, w) => (kind === 'green' ? w * S(c).targetWidth : w),
    spawned: (_c, b) => {
      if (b.kind !== 'green') return;
      b.target = true;
      // a target lights itself (never dark) and stands above the tide on its post (Combat.canSink)
      b.dark = false;
      b.litAt = 0;
    },
    hitMult: (c, x, v) => (x.echo || x.green ? v : v * S(c).focusShare),
    afterHit: (c, x) => {
      if (x.echo) return;
      if (x.green) {
        // a full Focus (Patience) makes the shot crit
        const full = c.perk.patience && focusOf(c) >= focusCap(c) * 0.999;
        powerShot(c, full || x.crit);
        return;
      }
      addFocus(c, c.stats().atk * S(c).focusStore * (x.perfect && c.perk.eagle ? 2 : 1));
    },
    step: (c) => {
      // Focus fades between waves (Patience keeps it)
      if (c.perk.focusWave !== c.waveIndex) {
        if (!c.perk.patience) c.perk.focus = 0;
        c.perk.focusWave = c.waveIndex;
      }
    },
  },
  // Heavy: fewer, wider yellows, and every hit lands hard
  brute: {
    hitMult: (c, x, v) => (x.echo ? v : v * S(c).heavyMult),
    staticGap: (c, v) => v * S(c).heavyGap,
    minAttack: (c, n) => Math.min(n, Math.round(S(c).heavyMin)),
    blockWidth: (c, kind, w) => (kind === 'yellow' || kind === 'green' ? w * S(c).heavyWidth : w),
  },
  // Bend: a Perfect block slows every red on the bar
  controller: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.echo) return;
      let n = 0;
      for (const b of c.blocks)
        if (isRed(b.kind) && !b.still) {
          c.chillRed(b, S(c).bendSec, S(c).bendMult);
          n++;
        }
      if (n) c.perkFx('bend', 0);
    },
  },
  // Call: green hits call allies, who act on their own; every Nth yellow comes green, so the calls keep coming
  summoner: {
    spawnKind: (c, kind) => {
      if (kind !== 'yellow') return kind;
      c.perk.callYellows = (c.perk.callYellows ?? 0) + 1;
      return c.perk.callYellows % Math.max(2, Math.round(S(c).callEvery)) === 0 ? 'green' : kind;
    },
    afterHit: (c, x) => {
      if (x.green && !x.echo) callAlly(c);
    },
    step: (c) => stepAllies(c, DT),
    impact: (c, b) => {
      // a braced Barkback (or Yara's Tortoise, its shell up) stops a red that reaches you
      const bark = c.allies.find((a) => isBlocker(a.kind) && a.braced);
      if (!bark) return false;
      c.events.push({ type: 'ally', kind: bark.kind, action: 'block', id: bark.id });
      if (bark.kind === 'spiritTortoise') {
        // (a shell with a block left in it stays up: 3 stars)
        // (Yara's Shell nodes count the blocks and whose red it was)
        c.perk.shellBlocks = (c.perk.shellBlocks ?? 0) + 1;
        c.perk.shellOwner = b.ownerId;
        const left = (c.perk[`shell${bark.id}`] ?? 1) - 1;
        c.perk[`shell${bark.id}`] = left;
        if (left <= 0) {
          bark.braced = false;
          bark.timer = allyEvery(c, bark.kind);
        }
        c.perkFx('spiritTortoise');
        // the shell takes kits.yara.shellSoak of the red; the rest still lands (Yara's kit: hurt), the combo holds
        const soak = c.tuning.kits.yara.shellSoak;
        if (soak >= 1) return true;
        c.perk.shellSoak = soak;
        c.perk.shellSoakAt = c.time;
        return false;
      }
      bark.braced = false;
      bark.timer = allyEvery(c, 'barkback');
      c.perkFx('barkback');
      return true;
    },
  },
  // Powder: kegs show up on the bar by themselves; a hit sets one off
  bomber: {
    spawnKind: (c, kind) => {
      if (kind !== 'yellow') return kind;
      c.perk.yellows = (c.perk.yellows ?? 0) + 1;
      return c.perk.yellows % kegEvery(c) === 0 ? 'keg' : kind;
    },
  },
};
