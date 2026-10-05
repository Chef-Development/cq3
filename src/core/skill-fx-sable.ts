// Sable's skill nodes as fight hooks (core/hooks.ts): the rule nodes and capstones of the Crossfire (alternating
// hands), Shadowguard (cross-blocking) and Quicksilver (speed and both hands) branches. Merged into SKILL_HOOKS by
// skill-fx.ts. A node's number is skillN(c.tuning, id). Stat nodes are plain stats (heroes.ts buildBonus).
//
// "Alternating hits in a row" is Combat.altStreak: L R L R = 4 (a hit with the same hand as the one before starts
// over at 1; a miss or a combo break ends the chain). Echoes (Shadow Step, Cross Guard) never count or trigger.

import { heroAtk, type Combat } from './combat';
import type { FightHooks } from './hooks';
import { skillN } from './heroes';

/** A node's whole-number "every n" (at least `min`). */
const every = (c: Combat, id: string, min = 1): number => Math.max(min, Math.round(skillN(c.tuning, id)));

/** The hit being resolved is the n-th, 2n-th... alternating hit in a row. */
const nthAlternating = (c: Combat, id: string): boolean => {
  const n = every(c, id, 2);
  return c.altStreak >= n && c.altStreak % n === 0;
};

/** Afterimage charges: one per half (perk keys afterimage0 = A's, afterimage1 = B's; the view may draw them). */
const AFTERIMAGE = ['afterimage0', 'afterimage1'];

export const SABLE_SKILL_HOOKS: Record<string, FightHooks> = {
  // Flurry (Crossfire): every n-th alternating hit in a row always crits
  flurry: {
    critChance: (c, x, v) => (!x.echo && nthAlternating(c, 'flurry') ? Math.max(v, 1) : v),
    afterHit: (c, x) => {
      if (!x.echo && nthAlternating(c, 'flurry')) c.perkFx('flurry', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Twin Rhythm (Crossfire): an alternating hit counts as 2 combo
  twinRhythm: {
    comboGain: (c, from, _perfect, _hand, n) => {
      if (from !== 'hit' || !c.hitNow?.alternated) return n;
      c.perkFx('twinRhythm', 1);
      return n + 1;
    },
  },
  // Whirling Blades (Crossfire capstone): every n alternating hits in a row start Shadow Step
  whirlingBlades: {
    afterHit: (c, x) => {
      if (x.echo || c.hands < 2 || !nthAlternating(c, 'whirlingBlades')) return;
      c.startAbility();
      c.perkFx('whirlingBlades', 0, 0, x.block.pos);
    },
  },
  // Cross Guard (Shadowguard): a block with one cursor also blocks a red under the other
  crossGuard: {
    afterBlock: (c, x) => {
      if (x.echo || c.hands < 2) return;
      const other = c.otherHand(x.hand);
      const red = c.underCursor(other).red;
      if (!red || red === x.block) return;
      c.perkFx('crossGuard', 0, red.ownerId, red.pos);
      c.perkBlock(red, other);
    },
  },
  // Counter Slash (Shadowguard): a block with the left cursor (A) hits back for n x Sable's hit (its owner, or the
  // target if the owner is gone)
  counterSlash: {
    afterBlock: (c, x) => {
      if (x.echo || x.hand !== 0) return;
      const foe = x.owner?.alive ? x.owner : c.currentTarget();
      if (!foe) return;
      const atkShare = c.hands > 1 ? c.tuning.sable.atkMult : 1;
      c.strike(foe, heroAtk(c.tuning, c.hero) * atkShare * skillN(c.tuning, 'counterSlash'), 'counterSlash');
    },
  },
  // Afterimage (Shadowguard capstone): a block leaves an afterimage in that cursor's half (one charge per half); the
  // next red to reach the hero is blocked by one for free (no damage, no combo break), A's charge first
  afterimage: {
    afterBlock: (c, x) => {
      if (!x.echo) c.perk[AFTERIMAGE[x.hand > 0 ? 1 : 0]] = 1;
    },
    impact: (c, b) => {
      const k = AFTERIMAGE.find((id) => (c.perk[id] ?? 0) > 0);
      if (!k) return false;
      c.perk[k] = 0;
      c.perkFx('afterimage', 0, b.ownerId, b.pos);
      return true;
    },
  },
  // Blur (Quicksilver): at n x cursor speed or faster, every hit crits
  blur: {
    critChance: (c, _x, v) => (c.speedMult() >= skillN(c.tuning, 'blur') - 1e-9 ? Math.max(v, 1) : v),
    afterHit: (c, x) => {
      if (x.echo) return;
      const on = c.speedMult() >= skillN(c.tuning, 'blur') - 1e-9;
      if (on && !c.perk.blur) c.perkFx('blur', 0, 0, x.block.pos); // shown as it kicks in (the crits show themselves)
      c.perk.blur = on ? 1 : 0;
    },
  },
  // Double Down (Quicksilver): a hit within n ms of a hit with the other cursor deals double (the second one; the pair
  // is spent)
  doubleDown: {
    hitMult: (c, x, v) => {
      if (x.echo || c.hands < 2) return v;
      const t = Number.isNaN(c.tapAt) ? c.time : c.tapAt;
      const prev = c.perk[`ddAt${c.otherHand(x.hand)}`];
      if (prev === undefined || Math.abs(t - prev) * 1000 > skillN(c.tuning, 'doubleDown')) return v;
      c.perk.ddHit = x.block.id;
      return v * 2;
    },
    afterHit: (c, x) => {
      if (x.echo || c.hands < 2) return;
      if (c.perk.ddHit === x.block.id) {
        c.perkFx('doubleDown', x.damage, x.target?.id ?? 0, x.block.pos);
        delete c.perk.ddHit;
        delete c.perk.ddAt0;
        delete c.perk.ddAt1;
        return;
      }
      c.perk[`ddAt${x.hand}`] = Number.isNaN(c.tapAt) ? c.time : c.tapAt;
    },
  },
  // Quickening (Quicksilver capstone): every n combo banks a finisher stack
  quickening: {
    combo: (c, before, after) => {
      const n = every(c, 'quickening');
      const crossed = Math.floor(after / n) - Math.floor(before / n);
      if (crossed > 0) c.bankStacks(crossed, 'quickening');
    },
  },
};
