// Fizz's and Brann's skill trees as fight hooks (core/hooks.ts): their rule nodes and capstones (the text is in
// src/data/skills-heroes.ts). Merged into SKILL_HOOKS (skill-fx.ts). A node's number is skillN(c.tuning, id); each calls
// c.perkFx(id, ...) when it kicks in. Nodes that change a number inside a kit move set a knob in c.perk at the fight's
// start, which the kit reads (core/kit-fizz-brann.ts: fireExtra, frostLinger, tossBoost, meltdown, tollBoost).
//
// Per-fight state in c.perk:
//   trapHit      1 = the hit being taken now is a trap's (Fume Hood keeps the combo)
//   tosses       tosses so far (Double Toss)
//   bellWard     1 = this Peal's ward is ready
//   innerBell    Perfect blocks toward the next Inner Bell

import { isRed } from './blocks';
import type { Combat } from './combat';
import { skillN } from './heroes';
import type { FightHooks } from './hooks';
import { inFlask, ringToll, setOff, tossFlask } from './kit-fizz-brann';
import { addGuard, bulwark, guardOf } from './styles';

const N = (c: Combat, id: string): number => skillN(c.tuning, id);
/** A node's number as a share (25 -> 0.25). */
const P = (c: Combat, id: string): number => Math.max(0, N(c, id)) / 100;
/** A node's number as a whole count (at least 1). */
const every = (c: Combat, id: string): number => Math.max(1, Math.round(N(c, id)));
const ability = (c: Combat): boolean => c.hero.abilityTimer > 0;

// ---------------------------------------------------------------- Fizz

const FIZZ: Record<string, FightHooks> = {
  // Slow Burn: fire brews burn n s longer
  slowBurn: {
    start: (c) => {
      c.perk.fireExtra = Math.max(0, N(c, 'slowBurn'));
    },
  },
  // Hard Frost: a frost brew also slows the reds that come in the next n s
  hardFrost: {
    start: (c) => {
      c.perk.frostLinger = Math.max(0, N(c, 'hardFrost'));
    },
  },
  // Wildfire (capstone): burning foes take n% more from her flasks (blasts and tosses)
  wildfire: {
    damageTaken: (c, e, source, v) => {
      if (e.burn <= 0 || !inFlask(c, source)) return v;
      c.perkFx('wildfire', 0, e.id);
      return v * (1 + P(c, 'wildfire'));
    },
  },
  // Long Arm: tosses hit n% harder
  longArm: {
    start: (c) => {
      c.perk.tossBoost = P(c, 'longArm');
    },
  },
  // Splash: a toss also splashes every other foe for n% of its blow
  splash: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.perk.tossAt !== c.tick || c.result) return;
      for (const e of c.aliveFoes()) if (e.id !== c.perk.tossFoe) c.strike(e, c.perk.tossDmg * P(c, 'splash'), 'splash');
    },
  },
  // Double Toss (capstone): every nth toss throws the next flask too
  doubleToss: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.perk.tossAt !== c.tick || c.result) return;
      c.perk.tosses = (c.perk.tosses ?? 0) + 1;
      if (c.perk.tosses % every(c, 'doubleToss') !== 0) return;
      const t = tossFlask(c, x.block.pos);
      if (t) c.perkFx('doubleToss', 0, t.id);
    },
  },
  // Meltdown: a fire flask's blast melts the ice patches it reaches
  meltdown: {
    start: (c) => {
      c.perk.meltdown = 1;
    },
  },
  // Fume Hood: a trap no longer breaks the combo or loses the stacks (the meter's progress still drains)
  fumeHood: {
    step: (c) => {
      c.perk.trapHit = 0;
    },
    hurt: (c, amount, source) => {
      if (source === 'trap') c.perk.trapHit = 1;
      return amount;
    },
    comboBreak: (c, x) => {
      if (x.cause !== 'hurt' || !c.perk.trapHit) return;
      c.perk.trapHit = 0;
      x.keepCombo = Math.max(x.keepCombo, x.combo);
      x.keepStacks = Math.max(x.keepStacks, x.stacks);
      c.perkFx('fumeHood', x.combo);
    },
  },
  // Catalyst (capstone): a Perfect hit sets off every flask within a blast's reach of it
  catalyst: {
    afterHit: (c, x) => {
      if (!x.perfect || x.echo || x.block.kind === 'keg' || c.result) return;
      const r = c.mod(c.tuning.styles.kegRadius, (h, v) => h.kegRadius?.(c, v));
      const near = c.blocks.filter((b) => b.kind === 'keg' && Math.abs(b.pos - x.block.pos) <= r + b.width / 2);
      for (const k of near) setOff(c, k);
      if (near.length) c.perkFx('catalyst', near.length, 0, x.block.pos);
    },
  },
};

// ---------------------------------------------------------------- Brann

const BRANN: Record<string, FightHooks> = {
  // Loud Toll: each toll adds n% more
  loudToll: {
    start: (c) => {
      c.perk.tollBoost = P(c, 'loudToll');
    },
  },
  // Double Toll: a Perfect block rings the bell twice
  doubleToll: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo || c.result) return;
      ringToll(c, x.block.pos);
      c.perkFx('doubleToll', 0, 0, x.block.pos);
    },
  },
  // Resound (capstone): a hit that spends n+ tolls rings out at every other foe (for what the tolls added to it)
  resound: {
    afterHit: (c, x) => {
      if (x.echo || (c.perk.tollSpent ?? 0) < every(c, 'resound') || c.result) return;
      const share = c.perk.tollBonus / (1 + c.perk.tollBonus);
      for (const e of c.aliveFoes()) if (e !== x.target) c.strike(e, x.damage * share, 'resound', false, x.block.pos);
    },
  },
  // Long Peal: Peal rings n s longer
  longPeal: {
    afterHit: (c, x) => {
      if (!x.green || x.echo) return;
      c.hero.abilityTimer += Math.max(0, N(c, 'longPeal'));
      c.perkFx('longPeal');
    },
  },
  // Resonance: during Peal, each block stores n more Guard
  resonance: {
    afterBlock: (c, x) => {
      if (!ability(c) || x.cracked || x.echo || c.result) return;
      const before = guardOf(c);
      addGuard(c, Math.max(0, Math.round(N(c, 'resonance'))));
      if (guardOf(c) > before) c.perkFx('resonance', guardOf(c) - before, 0, x.block.pos);
    },
  },
  // Bell Ward (capstone): during Peal, the first red to reach him is rung away (each Peal: one)
  bellWard: {
    afterHit: (c, x) => {
      if (x.green && !x.echo) c.perk.bellWard = 1;
    },
    step: (c) => {
      if (!ability(c)) c.perk.bellWard = 0;
    },
    impact: (c, b) => {
      if (!ability(c) || !c.perk.bellWard || !isRed(b.kind)) return false;
      c.perk.bellWard = 0;
      c.perkFx('bellWard', 0, b.ownerId);
      return true;
    },
  },
  // Unshaken: a red that hits him still rings the bell
  unshaken: {
    hurt: (c, amount, source) => {
      if ((source === 'red' || source === 'bomb') && !c.result) {
        ringToll(c, 0);
        c.perkFx('unshaken');
      }
      return amount;
    },
  },
  // Stunning Toll: a Perfect block stuns the red's foe for n s
  stunningToll: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo || !x.owner?.alive || c.result) return;
      c.stun(x.owner, Math.max(0, N(c, 'stunningToll')));
      c.perkFx('stunningToll', 0, x.owner.id, x.block.pos);
    },
  },
  // Inner Bell (capstone): every nth Perfect block sets off a Bulwark with the Guard stored, at once
  innerBell: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo || c.result) return;
      c.perk.innerBell = (c.perk.innerBell ?? 0) + 1;
      if (c.perk.innerBell < every(c, 'innerBell') || guardOf(c) <= 0) return;
      c.perk.innerBell = 0;
      c.perkFx('innerBell', guardOf(c), 0, x.block.pos);
      bulwark(c, x.block.pos);
    },
  },
};

export const FIZZ_BRANN_SKILL_HOOKS: Record<string, FightHooks> = { ...FIZZ, ...BRANN };
