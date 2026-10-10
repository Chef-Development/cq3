// Skill nodes as fight hooks (core/hooks.ts): the rule nodes and capstones of every hero's tree (src/data/skills.ts
// has the text; stat nodes are plain stats, see heroes.ts buildBonus). A node's number is skillN(c.tuning, id).
// Rowan's nodes are here; the other heroes' are in skill-fx-heroes.ts. Each one calls c.perkFx(id, amount, enemyId) when it
// kicks in, so the view can name it.
//
// Per-fight state in c.perk (the view may read it):
//   whetstone        the combo at which the last Whetstone crit is due (-1 = none)
//   shieldWall       1 = a bubble is charged (it eats the next red or bomb that reaches Rowan), 0 = none
//   shieldWallCharge reds blocked toward the next bubble (0..n-1; it stays 0 while a bubble is held)

import type { FightHooks } from './hooks';
import type { Combat } from './combat';
import { isRed } from './blocks';
import { skillN } from './heroes';
import { HERO_SKILL_HOOKS } from './skill-fx-heroes';
import { FIZZ_BRANN_SKILL_HOOKS } from './skill-fx-fizz-brann';

/** Shield Wall: blocks needed per bubble (at least 1). */
const wallEvery = (c: Combat): number => Math.max(1, Math.round(skillN(c.tuning, 'shieldWall')));

export const SKILL_HOOKS: Record<string, FightHooks> = {
  // the other heroes' nodes (skill-fx-heroes.ts)
  ...HERO_SKILL_HOOKS,
  // ---- Fizz and Brann (Part 6): skill-fx-fizz-brann.ts
  ...FIZZ_BRANN_SKILL_HOOKS,

  // ---------------------------------------------------------------- Blade (attack and crits)

  // Follow-Through: a kill's leftover damage hits the next foe (once: a carry that kills doesn't carry again; the
  // finisher already hits every foe, so its overkill doesn't carry)
  followThrough: {
    kill: (c, _e, overkill, source) => {
      if (source === 'finisher' || overkill < 1 || c.perk.followThroughBusy) return;
      const next = c.currentTarget();
      if (!next) return;
      c.perk.followThroughBusy = 1;
      c.strike(next, overkill, 'followThrough');
      c.perk.followThroughBusy = 0;
    },
  },
  // Whetstone: every n-th hit of a combo always crits (the hit that brings the combo to a multiple of n, or past one
  // when a Perfect counts double)
  whetstone: {
    combo: (c, before, after) => {
      const n = Math.max(1, Math.round(skillN(c.tuning, 'whetstone')));
      c.perk.whetstone = Math.floor(after / n) > Math.floor(before / n) ? after : -1;
    },
    critChance: (c, x, v) => {
      if (c.perk.whetstone !== c.combo || c.combo <= 0) return v;
      c.perk.whetstone = -1;
      c.perkFx('whetstone', 0, x.target?.id ?? 0, x.block.pos);
      return Math.max(v, 1);
    },
  },
  // Executioner (capstone): foes under n% HP take double damage from yellows (not greens)
  executioner: {
    hitMult: (c, x, v) => {
      if (x.green || !x.target || x.target.hp >= (skillN(c.tuning, 'executioner') / 100) * x.target.maxHp) return v;
      c.perk.executioner = x.block.id;
      return v * 2;
    },
    afterHit: (c, x) => {
      if (c.perk.executioner !== x.block.id) return;
      c.perk.executioner = 0;
      c.perkFx('executioner', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },

  // ---------------------------------------------------------------- Bulwark (blocking)

  // Parry: a Perfect block also knocks every other red on the bar back (as far as a cracked shield goes)
  parry: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.echo) return;
      // the ones furthest back first, so each has room to slide behind the next
      const reds = c.blocks.filter((b) => b !== x.block && isRed(b.kind)).sort((a, b) => b.pos - a.pos);
      let pushed = 0;
      for (const b of reds) if (c.pushBack(b, c.tuning.blocks.shieldKnockback) > 0) pushed++;
      if (pushed) c.perkFx('parry', 0, 0, x.block.pos);
    },
  },
  // Shield Bash: breaking a shield red (its last tap) stuns its owner for n s: its pattern and timed specials wait
  shieldBash: {
    afterBlock: (c, x) => {
      const e = x.owner;
      if (x.block.kind !== 'shield' || x.cracked || !e?.alive) return;
      const sec = Math.max(0, skillN(c.tuning, 'shieldBash'));
      if (sec <= 0) return;
      e.spawnTimer = Math.max(0, e.spawnTimer) + sec;
      c.specialsOf(e).forEach((sp, i) => {
        if (sp.every !== undefined) e.timers[i] = Math.max(0, e.timers[i]) + sec;
      });
      c.perkFx('shieldBash', sec, e.id, x.block.pos);
    },
  },
  // Shield Wall (capstone): every n reds blocked (a shield counts once, when it breaks) charge a bubble (one held at
  // a time) that eats the next red or bomb that reaches Rowan: no damage, no combo break; then it charges again.
  // perkFx amount 1 = charged, 0 = popped.
  shieldWall: {
    start: (c) => {
      c.perk.shieldWall = 0;
      c.perk.shieldWallCharge = 0;
    },
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || c.perk.shieldWall) return;
      c.perk.shieldWallCharge = (c.perk.shieldWallCharge ?? 0) + 1;
      if (c.perk.shieldWallCharge < wallEvery(c)) return;
      c.perk.shieldWallCharge = 0;
      c.perk.shieldWall = 1;
      c.perkFx('shieldWall', 1, 0, x.block.pos);
    },
    impact: (c, b) => {
      if (!c.perk.shieldWall) return false;
      c.perk.shieldWall = 0;
      c.perkFx('shieldWall', 0, b.ownerId, b.pos);
      return true;
    },
  },

  // ---------------------------------------------------------------- Momentum (combo and finisher)

  // Double Time: a Perfect hit counts as 2 combo (hits only, not blocks)
  doubleTime: {
    comboGain: (c, from, perfect, n) => {
      if (from !== 'hit' || !perfect) return n;
      c.perkFx('doubleTime', n + 1);
      return n + 1;
    },
  },
  // Charged Up: every fight starts with n finisher stacks banked
  chargedUp: {
    start: (c) => {
      c.bankStacks(Math.max(0, Math.round(skillN(c.tuning, 'chargedUp'))), 'chargedUp');
    },
  },
  // Unbroken (capstone): a combo break halves your combo and stacks instead of zeroing them
  unbroken: {
    comboBreak: (c, x) => {
      const combo = Math.floor(x.combo / 2);
      const stacks = Math.floor(x.stacks / 2);
      x.keepCombo = Math.max(x.keepCombo, combo);
      x.keepStacks = Math.max(x.keepStacks, stacks);
      if (combo > 0 || stacks > 0) c.perkFx('unbroken', combo);
    },
  },
};
