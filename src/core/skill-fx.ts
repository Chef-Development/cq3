// Skill nodes as fight hooks (core/hooks.ts): the rule nodes and capstones of both heroes' trees (src/data/skills.ts
// has the text; stat nodes are plain stats, see heroes.ts buildBonus). A node's number is skillN(c.tuning, id).
// Rowan's nodes are here; Sable's are in skill-fx-sable.ts.

import type { FightHooks } from './hooks';
import { skillN } from './heroes';
import { SABLE_SKILL_HOOKS } from './skill-fx-sable';

export const SKILL_HOOKS: Record<string, FightHooks> = {
  ...SABLE_SKILL_HOOKS,
  // Executioner (Rowan, Blade capstone): foes under n% HP take double damage from yellows
  executioner: {
    hitMult: (c, x, v) => (!x.green && x.target && x.target.hp < (skillN(c.tuning, 'executioner') / 100) * x.target.maxHp ? v * 2 : v),
  },
  // Unbroken (Rowan, Momentum capstone): a combo break halves your combo and stacks instead of zeroing them
  unbroken: {
    comboBreak: (_c, x) => {
      x.keepCombo = Math.max(x.keepCombo, Math.floor(x.combo / 2));
      x.keepStacks = Math.max(x.keepStacks, Math.floor(x.stacks / 2));
    },
  },
};
