// Relics as fight hooks (core/hooks.ts). Each relic changes a rule or a decision (src/data/relics.ts has the text);
// its one number is relicN(c.tuning, id). Run-level relics (shops, rests, the map) live in core/run.ts.

import type { RelicId } from '../data/relics';
import type { FightHooks } from './hooks';
import type { Tuning } from './tuning';

/** A relic's live number (tuning.relics.n), or 0. */
export const relicN = (t: Tuning, id: RelicId): number => t.relics.n[id] ?? 0;

export const RELIC_HOOKS: Partial<Record<RelicId, FightHooks>> = {
  // Powder Keg: tapping a bomb also banks a finisher stack
  powderKeg: {
    afterBlock: (c, x) => {
      if (x.block.kind === 'bomb' && !x.cracked) c.bankStacks(1, 'powderKeg');
    },
  },
  // Sharpshooter: Perfects always crit
  sharpshooter: {
    critChance: (_c, x, v) => (x.perfect ? Math.max(v, 1) : v),
  },
  // Hoarder: a miss or a hit costs 1 stack instead of all of them
  hoarder: {
    comboBreak: (_c, x) => {
      x.keepStacks = Math.max(x.keepStacks, x.stacks - 1);
    },
  },
};
