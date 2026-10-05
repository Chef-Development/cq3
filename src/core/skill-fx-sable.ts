// Sable's skill nodes as fight hooks (core/hooks.ts): the rule nodes and capstones of the Crossfire (alternating
// hands), Shadowguard (cross-blocking) and Quicksilver (speed and both hands) branches. Merged into SKILL_HOOKS by
// skill-fx.ts. A node's number is skillN(c.tuning, id).

import type { FightHooks } from './hooks';

export const SABLE_SKILL_HOOKS: Record<string, FightHooks> = {};
