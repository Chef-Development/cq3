// The heroes' kits as fight hooks (core/hooks.ts): what a green hit does (the ability), passives, and the finisher's
// twist. Rowan (Blade): Battle Focus, green hits add crit for a few seconds; the finisher hits every foe.
// Sable (Twin): hits deal a share of Rowan's; Ambidextrous (alternating hands fill the meter faster); Shadow Step
// (a hit with one cursor also hits the block under the other); Twin Fang (the finisher hits the target alone, harder,
// and a kill keeps a stack). Numbers: tuning.hero (Rowan) and tuning.sable.

import type { HeroId } from '../data/heroes';
import type { FightHooks } from './hooks';

export const KIT_HOOKS: Record<HeroId, FightHooks> = {
  rowan: {
    // Battle Focus: while the green ability is on, hits crit more often
    critChance: (c, _x, v) => (c.hero.abilityTimer > 0 ? v + c.tuning.hero.abilityCritBonus : v),
  },
  sable: {
    // two light daggers: each hit deals a share of Rowan's
    hitMult: (c, _x, v) => v * c.tuning.sable.atkMult,
    // Ambidextrous: a hit with the other hand than the last one fills the meter faster
    meter: (c, source, v, hand) => ((source === 'hit' || source === 'green') && c.hands > 1 && c.perk.ambiLast !== undefined && c.perk.ambiLast !== hand ? v * (1 + c.tuning.sable.ambidextrous) : v),
    afterHit: (c, x) => {
      if (!x.echo) c.perk.ambiLast = x.hand;
    },
    // Twin Fang: the finisher strikes the target alone, harder; a kill keeps a stack
    finisher: (c, x, v) => {
      const target = c.currentTarget();
      if (target) x.targets = [target];
      return v * c.tuning.sable.fangMult;
    },
    afterFinisher: (c, x) => {
      if (x.killed > 0 && c.enemies.some((e) => e.alive)) c.bankStacks(Math.round(c.tuning.sable.fangKeep), 'twinFang');
    },
  },
};
