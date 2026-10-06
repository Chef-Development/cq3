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

// ---------------------------------------------------------------- Marksman: Focus

export const focusOf = (c: Combat): number => c.perk.focus ?? 0;
export const focusCap = (c: Combat): number => c.stats().atk * S(c).focusCap * (c.heroId === 'vesper' && c.stars >= 3 ? c.tuning.kits.vesper.cap3 : 1);

export function addFocus(c: Combat, amount: number): void {
  c.perk.focus = Math.min(focusCap(c), focusOf(c) + Math.max(0, amount));
}

/** Fire every bit of Focus at the target as a Power Shot (Piercing Shot also hits the foe behind it). */
export function powerShot(c: Combat, crit = false): number {
  const f = focusOf(c);
  const target = c.currentTarget();
  c.perk.focus = 0;
  if (f <= 0 || !target) return 0;
  const dmg = f * (crit ? c.stats().critDmg : 1);
  c.strike(target, dmg, 'powerShot', crit);
  if (c.perk.pierce) {
    const behind = c.aliveFoes().find((e) => e !== target);
    if (behind) c.strike(behind, dmg * c.tuning.kits.vesper.pierce, 'pierce');
  }
  return dmg;
}

// ---------------------------------------------------------------- Summoner: allies

/** How long a summoned ally stays (Moss's 3 stars: longer). */
export const allySec = (c: Combat): number => (c.heroId === 'moss' && c.stars >= 3 ? c.tuning.kits.moss.allySec3 : c.tuning.kits.moss.allySec);

/** The ally kinds this hero calls, in order (Moss's 5 stars add the Seedling). */
export function allyKinds(c: Combat): AllyKind[] {
  const list = heroDef(c.heroId as never).allies ?? ['thornling', 'barkback', 'glowmoth'];
  return c.heroId === 'moss' && c.stars >= 5 ? [...list, 'seedling'] : list;
}

/** When an ally acts first, and then every this many seconds. */
function allyEvery(c: Combat, kind: AllyKind): number {
  const k = c.tuning.kits.moss;
  return kind === 'thornling' ? k.thornEvery : kind === 'barkback' ? k.barkEvery : kind === 'glowmoth' ? k.mothEvery : k.seedEvery;
}

/**
 * A green hit calls the next ally in order (up to the cap). With every kind out already, it's a Rally: every ally's
 * time is refreshed and they all act at once.
 */
export function callAlly(c: Combat): void {
  const kinds = allyKinds(c);
  const max = Math.min(Math.round(S(c).allyMax) + (kinds.length > 3 ? 1 : 0), kinds.length);
  const missing = kinds.find((k) => !c.allies.some((a) => a.kind === k));
  if (missing && c.allies.length < max) {
    const a: Ally = { id: (c.perk.allyId = (c.perk.allyId ?? 0) + 1), kind: missing, left: allySec(c), timer: allyEvery(c, missing) * 0.5, braced: false };
    c.allies.push(a);
    c.events.push({ type: 'ally', kind: missing, action: 'call', id: a.id });
    return;
  }
  // a Rally: everyone stays longer and acts now
  c.events.push({ type: 'ally', kind: kinds[0], action: 'rally', id: 0 });
  c.perkFx('rally');
  for (const a of c.allies) {
    a.left = allySec(c);
    allyAct(c, a);
    a.timer = allyEvery(c, a.kind);
  }
}

function allyAct(c: Combat, a: Ally): void {
  const k = c.tuning.kits.moss;
  if (a.kind === 'thornling') {
    const t = c.currentTarget();
    if (t) c.strike(t, c.stats().atk * k.thornDmg, 'thornling');
  } else if (a.kind === 'barkback') a.braced = true;
  else if (a.kind === 'glowmoth') c.healPerk(c.maxHp() * k.mothHeal, 'glowmoth');
  else {
    const front = c.frontEnemy();
    if (front && c.trySpawn('green', front.id)) c.perkFx('seedling');
  }
  c.events.push({ type: 'ally', kind: a.kind, action: 'act', id: a.id });
}

function stepAllies(c: Combat, dt: number): void {
  for (const a of c.allies.slice()) {
    a.left -= dt;
    if (a.left <= 0) {
      c.allies.splice(c.allies.indexOf(a), 1);
      c.events.push({ type: 'ally', kind: a.kind, action: 'leave', id: a.id });
      continue;
    }
    if (a.kind === 'barkback' && a.braced) continue; // braced: waits for a red
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
  // Guard: blocks store charges; the next hit unleashes them as bonus damage
  guardian: {
    afterBlock: (c, x) => {
      if (x.cracked) return; // a shield counts once, when it breaks
      const before = guardOf(c);
      addGuard(c, 1);
      if (guardOf(c) > before) c.perkFx('guardUp', guardOf(c), 0, x.block.pos);
    },
    hitMult: (c, x, v) => (x.echo || guardOf(c) <= 0 ? v : v + S(c).guardPer * guardOf(c)),
    afterHit: (c, x) => {
      if (x.echo || guardOf(c) <= 0) return;
      c.perkFx('guard', guardOf(c));
      c.perk.guard = 0;
    },
  },
  // Focus: hits hold some damage back as Focus; a green hit fires it all
  marksman: {
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
  // Call: green hits call allies, who act on their own
  summoner: {
    afterHit: (c, x) => {
      if (x.green && !x.echo) callAlly(c);
    },
    step: (c) => stepAllies(c, DT),
    impact: (c) => {
      // a braced Barkback stops a red that reaches you
      const bark = c.allies.find((a) => a.kind === 'barkback' && a.braced);
      if (!bark) return false;
      bark.braced = false;
      bark.timer = c.tuning.kits.moss.barkEvery;
      c.events.push({ type: 'ally', kind: 'barkback', action: 'block', id: bark.id });
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
