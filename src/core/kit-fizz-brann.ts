// Part 6's second Bomber and second Guardian as fight hooks (core/hooks.ts), merged into KIT_HOOKS (core/kit-fx.ts).
// Numbers: tuning.kits.fizz / tuning.kits.brann; words: src/data/heroes.ts.
//
// Fizz, Alchemist (Bomber, Legendary): her kegs are flasks in three brews, in turn from her bandolier (fire, frost,
// spark: `c.perk.brew` is the next one's index). Each flask's brew is kept per block (`brewOf`) so the bar can paint it.
// A flask goes off like any keg (it blasts every foe and knocks the reds near it off the bar), and its brew adds:
// fire sets every foe burning (Enemy.burn, like Newt's Ember Bite: ticked here unless Newt is along to tick it), frost
// slows every red on the bar, spark blasts wider and harder. Toss (green): the next flask flies straight at the
// target. Fume Mask: traps hurt her less. Grand Reaction: every flask on the bar goes off, then new ones land.
//
// Brann, Bellwarden (Guardian, Epic): every block rings his bell (`c.perk.toll`, up to tollMax): his next hit deals
// more per toll and spends them. Peal (green): for a few seconds, a blocked red's blow echoes at every foe. Still
// Mind: a Perfect block stores more Guard. Great Bell: one huge hit on the target with all the Guard, and every foe
// is stunned (no new reds) for a moment.
//
// Per-fight state in c.perk (the view reads some of it):
//   brew        the next brew in Fizz's bandolier (0 fire, 1 frost, 2 spark)
//   brewForce   1 + the brew the next flask must be (Full Rack), else 0
//   blastBrew   1 + the brew of the flask going off now in Grand Reaction (its spark blast), else 0
//   tossBrew    1 + the brew of her last toss (the view paints the flying flask in it)
//   tossAt / tossFoe / tossDmg   the tick, target and damage of her last toss (Splash reads them)
//   flaskNow    1 while a toss's flask is striking (Wildfire's damage reads it)
//   toll        Brann's tolls rung toward his next hit
//   tollSpent / tollBonus   the tolls the hit being judged spent, and the share they added (Resound reads them)
// and knobs her and his skill nodes set at the fight's start (core/skill-fx-fizz-brann.ts): fireExtra (Slow Burn),
// frostLinger (Hard Frost; frostUntil: new reds slow until then), tossBoost (Long Arm), meltdown, tollBoost (Loud Toll).

import { isRed } from './blocks';
import type { Block, Combat, Enemy } from './combat';
import type { FightHooks } from './hooks';
import { addGuard, guardOf, spendGuard } from './styles';

const DT = 1 / 120;
const ability = (c: Combat): boolean => c.hero.abilityTimer > 0;

// ---------------------------------------------------------------- Fizz: the brews

export type Brew = 'fire' | 'frost' | 'spark';
/** The bandolier's order: the flasks (and tosses) come in this order, round and round. */
export const BREWS: readonly Brew[] = ['fire', 'frost', 'spark'];

const brews = new WeakMap<Block, Brew>();

/** A flask's brew (undefined: a plain keg, not one of Fizz's). */
export const brewOf = (b: Block): Brew | undefined => brews.get(b);

/** The next brew in her bandolier (the next flask's, or the next toss's). */
export const nextBrew = (c: Combat): Brew => BREWS[Math.abs(Math.round(c.perk.brew ?? 0)) % BREWS.length];

/** Take the next brew off the bandolier. */
function takeBrew(c: Combat): Brew {
  const b = nextBrew(c);
  c.perk.brew = (BREWS.indexOf(b) + 1) % BREWS.length;
  return b;
}

const F = (c: Combat) => c.tuning.kits.fizz;
/** 3 stars (Potent Brews): every brew works this much more. */
const potency = (c: Combat): number => (c.heroId === 'fizz' && c.stars >= 3 ? Math.max(1, F(c).potent) : 1);

/** The brew of the flask going off right now: one of Grand Reaction's (blastBrew), else the flask just hit. */
function blastingBrew(c: Combat): Brew | undefined {
  if (c.perk.blastBrew) return BREWS[c.perk.blastBrew - 1];
  const b = c.hitNow?.block;
  return b && b.kind === 'keg' ? brewOf(b) : undefined;
}

/** Set a foe burning: dps damage a second for sec seconds (a hotter or longer burn wins; a fresh one ticks in 1 s). */
export function ignite(e: Enemy, dps: number, sec: number): void {
  if (!e.alive || dps <= 0 || sec <= 0) return;
  if (e.burn <= 0) e.burnTick = 1;
  e.burnDps = e.burn > 0 ? Math.max(e.burnDps, dps) : dps;
  e.burn = Math.max(e.burn, sec);
}

/** Whether Newt is along to tick the burns (his Ember Bite's step does; never in a Coin Rush, which has no companions). */
const newtAlong = (c: Combat): boolean => !c.rush && (c.hero.build?.pets ?? []).some((p) => p.id === 'newt');

/**
 * A brew bursts at bar position `pos`: fire sets every foe burning (a toss: its target), frost slows every red on the
 * bar (a toss: its target's reds), spark names itself (its bigger blast is the keg's own, kegRadius/damageTaken).
 */
function brewBurst(c: Combat, brew: Brew, pos: number, toss?: Enemy): void {
  if (c.result) return;
  const k = F(c);
  const pot = potency(c);
  if (brew === 'fire') {
    const foes = toss ? [toss].filter((e) => e.alive) : c.aliveFoes();
    const dps = c.stats().atk * k.fireDps * pot;
    const extra = Math.max(0, c.perk.fireExtra ?? 0);
    for (const e of foes) ignite(e, dps, k.fireSec + extra);
    if (foes.length) c.perkFx('fireBrew', foes.length, toss?.id ?? 0, pos);
    if (foes.length && extra > 0) c.perkFx('slowBurn', foes.length, toss?.id ?? 0);
    // Meltdown: a fire flask's blast melts the ice patches it reaches
    if (!toss && c.perk.meltdown) {
      const r = c.mod(c.tuning.styles.kegRadius, (h, v) => h.kegRadius?.(c, v));
      let melted = 0;
      for (const z of c.zones.slice())
        if (z.kind === 'ice' && z.hi >= pos - r && z.lo <= pos + r) {
          c.removeZone(z);
          melted++;
        }
      if (melted) c.perkFx('meltdown', melted, 0, pos);
    }
  } else if (brew === 'frost') {
    let n = 0;
    for (const b of c.blocks)
      if (isRed(b.kind) && !b.still && (!toss || b.ownerId === toss.id)) {
        c.chillRed(b, k.frostSec * pot, k.frostMult);
        n++;
      }
    c.perkFx('frostBrew', n, toss?.id ?? 0, pos);
    // Hard Frost: the reds that come in the next few seconds slow too
    if (c.perk.frostLinger > 0) c.perk.frostUntil = Math.max(c.perk.frostUntil ?? 0, c.time + c.perk.frostLinger);
  } else c.perkFx('sparkBrew', 0, toss?.id ?? 0, pos);
}

/** Whether the damage being dealt now comes from one of her flasks: a flask's blast (tapped, or one of Grand
 *  Reaction's, or set off by a perk) or a toss. */
export function inFlask(c: Combat, source: 'hit' | 'bomb' | 'finisher' | 'pet' | 'perk'): boolean {
  if (source === 'perk') return !!c.perk.flaskNow;
  return source === 'bomb' && (!!c.perk.blastBrew || c.hitNow?.block.kind === 'keg');
}

/** Set off a flask on the bar where it stands (Grand Reaction, Catalyst): it blasts like a hit keg, with its brew. */
export function setOff(c: Combat, k: Block): void {
  if (!c.blocks.includes(k) || c.result) return;
  const brew = brewOf(k) ?? 'spark';
  c.removeBlock(k, 'bomb');
  c.perk.blastBrew = BREWS.indexOf(brew) + 1;
  c.kegBlast(k);
  c.perk.blastBrew = 0;
  brewBurst(c, brew, k.pos);
}

/**
 * Toss: the next flask off her bandolier flies straight at the target (from bar position `pos`, the green): it strikes
 * for tossMult x attack (a spark flask harder; Long Arm more) and bursts with its brew there. Returns its target, or
 * null when nobody is left.
 */
export function tossFlask(c: Combat, pos: number, at?: Enemy | null): Enemy | null {
  const t = at?.alive ? at : c.currentTarget();
  if (!t || c.result) return null;
  const brew = takeBrew(c);
  const k = F(c);
  c.perk.tossBrew = BREWS.indexOf(brew) + 1;
  const dmg = c.stats().atk * k.tossMult * (1 + Math.max(0, c.perk.tossBoost ?? 0)) * (brew === 'spark' ? k.sparkMult * potency(c) : 1);
  c.perk.tossAt = c.tick;
  c.perk.tossFoe = t.id;
  c.perk.tossDmg = dmg;
  c.perk.flaskNow = 1;
  c.strike(t, dmg, 'toss', false, pos);
  c.perk.flaskNow = 0;
  if (c.perk.tossBoost > 0) c.perkFx('longArm', 0, t.id);
  brewBurst(c, brew, pos, t);
  return t;
}

/** Put a flask on the bar at a free spot (`brew`: that brew, not the bandolier's next). Null if there's no room. */
function dropFlask(c: Combat, brew?: Brew): Block | null {
  const front = c.frontEnemy();
  if (!front) return null;
  const p = c.freeSpot(c.widthFor('keg'));
  if (p === null) return null;
  c.perk.brewForce = brew ? BREWS.indexOf(brew) + 1 : 0;
  const b = c.spawnBlock('keg', p, front.id);
  c.perk.brewForce = 0;
  return b;
}

/** Grand Reaction: every flask on the bar goes off, one after another, each with its brew. Returns how many. */
function reaction(c: Combat): number {
  let n = 0;
  for (const k of c.blocks.filter((b) => b.kind === 'keg')) {
    if (c.result) break;
    if (!c.blocks.includes(k)) continue; // a blast took it already
    setOff(c, k);
    n++;
  }
  return n;
}

export const FIZZ_KIT: FightHooks = {
  // Mixed Brew: every flask takes the next brew off her bandolier as it lands (Full Rack picks its own)
  spawned: (c, b) => {
    // (Hard Frost: a red that comes while the frost lingers is slowed as it lands)
    if (isRed(b.kind) && !b.still && c.time < (c.perk.frostUntil ?? -1)) {
      c.chillRed(b, c.perk.frostUntil - c.time + F(c).frostSec * 0.5, F(c).frostMult);
      c.perkFx('hardFrost', 0, b.ownerId, b.pos);
    }
    if (b.kind !== 'keg' || brews.has(b)) return;
    const forced = c.perk.brewForce ? BREWS[c.perk.brewForce - 1] : undefined;
    brews.set(b, forced ?? takeBrew(c));
  },
  // ...a spark flask blasts wider and harder
  kegRadius: (c, r) => (blastingBrew(c) === 'spark' ? r * F(c).sparkRadius * (potency(c) > 1 ? 1.25 : 1) : r),
  damageTaken: (c, _e, source, v) => (source === 'bomb' && blastingBrew(c) === 'spark' ? v * F(c).sparkMult * potency(c) : v),
  afterHit: (c, x) => {
    // a flask went off (tapped, or hit for her by a perk): its brew bursts
    if (x.block.kind === 'keg') {
      const brew = brewOf(x.block);
      if (brew) brewBurst(c, brew, x.block.pos);
      return;
    }
    // Toss: a green hit throws the next flask straight at the target
    if (x.green && !x.echo && !c.result) tossFlask(c, x.block.pos, x.target);
  },
  // the burns tick once a second (Newt's Ember Bite ticks them when he's along)
  step: (c) => {
    if (newtAlong(c)) return;
    for (const e of c.enemies) {
      if (e.burn <= 0) continue;
      if (!e.alive) {
        e.burn = e.burnDps = e.burnTick = 0;
        continue;
      }
      e.burnTick -= DT;
      if (e.burnTick <= 1e-9) {
        e.burnTick += 1;
        c.strike(e, e.burnDps, 'brewBurn');
      }
      e.burn = Math.max(0, e.burn - DT);
      if (e.burn <= 1e-9) e.burn = e.burnDps = e.burnTick = 0;
    }
  },
  // Fume Mask: traps hurt her less
  hurt: (c, amount, source) => {
    if (source !== 'trap' || amount <= 0) return amount;
    const cut = Math.min(1, Math.max(0, F(c).fumeMask));
    c.perkFx('fumeMask', amount * cut);
    return amount * (1 - cut);
  },
  // Grand Reaction: hits every foe; every flask on the bar goes off with its brew; then new flasks land (5 stars: one
  // of each brew)
  finisher: (c, _x, v) => v * F(c).grandMult,
  afterFinisher: (c) => {
    const blown = reaction(c);
    let landed = 0;
    if (c.stars >= 5) {
      for (const b of BREWS) if (dropFlask(c, b)) landed++;
    } else for (let i = 0; i < Math.round(F(c).bangFlasks); i++) if (dropFlask(c)) landed++;
    c.perkFx('grandReaction', blown + landed);
  },
};

// ---------------------------------------------------------------- Brann: the bell

const B = (c: Combat) => c.tuning.kits.brann;

/** Tolls rung toward Brann's next hit, and the most the bell holds (3 stars: more). */
export const tollOf = (c: Combat): number => c.perk.toll ?? 0;
export const tollMax = (c: Combat): number => Math.max(1, Math.round(c.heroId === 'brann' && c.stars >= 3 ? B(c).tollMax3 : B(c).tollMax));

/** Ring the bell once more (a block). Returns the tolls now. */
export function ringToll(c: Combat, pos: number): number {
  const before = tollOf(c);
  c.perk.toll = Math.min(tollMax(c), before + 1);
  c.perkFx('toll', c.perk.toll, 0, pos);
  return c.perk.toll;
}

export const BRANN_KIT: FightHooks = {
  afterBlock: (c, x) => {
    if (x.cracked || x.echo || c.result) return; // (a shield rings once, when it breaks)
    // Still Mind: a Perfect block stores more Guard (on top of the style's one)
    if (x.perfect) {
      const before = guardOf(c);
      addGuard(c, Math.max(0, Math.round(B(c).stillMind)));
      if (guardOf(c) > before) c.perkFx('stillMind', guardOf(c) - before, 0, x.block.pos);
    }
    // Toll: every block rings the bell
    ringToll(c, x.block.pos);
    // Peal: while the green ability is on, the blocked red's blow echoes at every foe
    if (ability(c) && x.owner) {
      const dmg = x.owner.atk * B(c).pealShare;
      if (dmg > 0) for (const e of c.aliveFoes()) c.strike(e, dmg, 'peal', false, x.block.pos);
    }
  },
  // ...and his next hit spends the tolls
  hitMult: (c, x, v) => {
    c.perk.tollSpent = 0;
    c.perk.tollBonus = 0;
    const n = tollOf(c);
    if (x.echo || n <= 0) return v;
    // (Loud Toll: each toll adds more)
    const boost = Math.max(0, c.perk.tollBoost ?? 0);
    const bonus = B(c).tollPer * (1 + boost) * n;
    c.perk.toll = 0;
    c.perk.tollSpent = n;
    c.perk.tollBonus = bonus;
    c.perkFx('tollHit', n, x.target?.id ?? 0, x.block.pos);
    if (boost > 0) c.perkFx('loudToll', n, x.target?.id ?? 0, x.block.pos);
    return v * (1 + bonus);
  },
  // Great Bell: the bell drops on the target with all the Guard; every foe is stunned (no new reds) for a moment; 5
  // stars: the others take half the blow
  finisher: (c, x, v) => {
    const target = c.currentTarget();
    if (target) x.targets = [target];
    return guardOf(c) > 0 ? v * (1 + spendGuard(c) * B(c).bellGuard) : v;
  },
  afterFinisher: (c, x) => {
    if (c.stars >= 5 && x.damage > 0) for (const e of c.aliveFoes()) if (!x.targets.includes(e)) c.strike(e, x.damage * B(c).echo5, 'echoingBell');
    let n = 0;
    for (const e of c.aliveFoes()) {
      c.stun(e, B(c).bellStun);
      n++;
    }
    c.perkFx('greatBell', n, x.targets[0]?.id ?? 0);
  },
};
