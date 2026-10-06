// The heroes' kits as fight hooks (core/hooks.ts): what a green hit does (the ability), passives, and the finisher's
// twist. Rowan (Blade): Battle Focus, green hits add crit for a few seconds; the finisher hits every foe.
// Sable (Twin): hits deal a share of Rowan's; Ambidextrous (alternating hands fill the meter faster); Shadow Step
// (a hit with one cursor also hits the block under the other); Twin Fang (the finisher hits the target alone, harder,
// and a kill keeps a stack). Numbers: tuning.hero (Rowan) and tuning.sable.

import type { HeroId } from '../data/heroes';
import type { Combat } from './combat';
import type { FightHooks } from './hooks';

/**
 * Shadow Step: the other cursor strikes too, at the tap's moment, by the judge's reach: a red under it is blocked
 * (an attack under a cursor always comes first, as for a tap), else a yellow or green under it is hit. Never a trap.
 * The extra block or hit is an echo (perks don't chain off it).
 */
export function shadowStrike(c: Combat, hand: number): void {
  const other = c.otherHand(hand);
  if (other === hand) return;
  const { red, attack } = c.underCursor(other);
  if (red) {
    c.perkFx('shadowStep', 0, red.ownerId, red.pos);
    c.perkBlock(red, other);
  } else if (attack) {
    c.perkFx('shadowStep', 0, c.currentTarget()?.id ?? 0, attack.pos);
    c.perkHit(attack, other);
  }
}

export const KIT_HOOKS: Record<HeroId, FightHooks> = {
  rowan: {
    // Battle Focus: while the green ability is on, hits crit more often
    critChance: (c, _x, v) => (c.hero.abilityTimer > 0 ? v + c.tuning.hero.abilityCritBonus : v),
  },
  sable: {
    // two light daggers: each hit deals a share of Rowan's
    hitMult: (c, _x, v) => v * c.tuning.sable.atkMult,
    // Ambidextrous: a hit with the other hand than the last hit fills the meter faster (echoes never alternate)
    meter: (c, source, v) => ((source === 'hit' || source === 'green') && c.hitNow?.alternated ? v * (1 + c.tuning.sable.ambidextrous) : v),
    // Shadow Step: while the green ability is on, a hit with one cursor also strikes under the other
    afterHit: (c, x) => {
      if (!x.echo && c.hero.abilityTimer > 0 && c.hands > 1) shadowStrike(c, x.hand);
    },
    // Twin Fang: the finisher strikes the target alone, harder; a kill keeps a stack (for the next foe, or the next
    // wave)
    finisher: (c, x, v) => {
      const target = c.currentTarget();
      if (target) x.targets = [target];
      return v * c.tuning.sable.fangMult;
    },
    afterFinisher: (c, x) => {
      if (x.killed > 0 && (c.enemies.some((e) => e.alive) || c.nextWaveIn >= 0)) c.bankStacks(Math.round(c.tuning.sable.fangKeep), 'twinFang');
    },
  },
};
