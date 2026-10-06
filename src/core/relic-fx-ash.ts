// Region 3's relics as fight hooks (core/hooks.ts): the Drift relics (blocks that slide along the bar) and the Link
// relics (linked pairs: hit one half, then the other within a beat). Merged into RELIC_HOOKS by relic-fx.ts. Each
// one's number is tuning.relics.n[id]; each calls c.perkFx when it kicks in.

import type { RelicId } from '../data/relics';
import { isRed } from './blocks';
import type { Combat } from './combat';
import type { FightHooks, HitCtx } from './hooks';

const n = (c: Combat, id: RelicId): number => c.tuning.relics.n[id] ?? 0;
/** A hit (not an echo) on a block that was drifting when it was hit. */
const drifted = (x: HitCtx): boolean => !x.echo && x.block.vel !== 0;

export const ASH_RELIC_HOOKS: Partial<Record<RelicId, FightHooks>> = {
  // ---------------------------------------------------------------- Drift

  // Tailwind: hits on drifting blocks deal more
  tailwind: {
    hitMult: (c, x, v) => (drifted(x) ? v * (1 + n(c, 'tailwind') / 100) : v),
  },
  // Weathervane: Perfect hits on drifting blocks always crit
  weathervane: {
    critChance: (_c, x, v) => (drifted(x) && x.perfect ? 1 : v),
    afterHit: (c, x) => {
      if (drifted(x) && x.perfect) c.perkFx('weathervane', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Warm Springs: a drifting block turning at an end heals n HP
  warmSprings: {
    driftTurn: (c) => {
      c.healPerk(n(c, 'warmSprings'), 'warmSprings');
    },
  },
  // Rebound: a drifting block that turns at an end turns green (once each)
  rebound: {
    driftTurn: (c, b) => {
      if (b.kind !== 'yellow' || b.link) return;
      c.morph(b, 'green');
      c.perkFx('rebound', 0, 0, b.pos);
    },
  },
  // Anchor Stone: blocking a red stops every drifting block for n s
  anchorStone: {
    afterBlock: (c, x) => {
      if (x.echo || x.cracked) return;
      if (!c.blocks.some((b) => !isRed(b.kind) && b.vel !== 0)) return;
      c.pauseDrift(n(c, 'anchorStone'));
      c.perkFx('anchorStone', 0, 0, x.block.pos);
    },
  },
  // Slipstream: hitting a drifting block fills the meter like n hits
  slipstream: {
    afterHit: (c, x) => {
      if (!drifted(x)) return;
      c.fillMeter(c.tuning.meter.perHit * Math.max(0, n(c, 'slipstream') - 1), 'hit');
    },
  },
  // Flotsam: each drifting block you hit drops n coins
  flotsam: {
    afterHit: (c, x) => {
      if (!drifted(x)) return;
      const coins = Math.round(n(c, 'flotsam'));
      if (coins <= 0) return;
      c.awardCoins(coins, 'flotsam');
      c.perkFx('flotsam', coins, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Molten Core: drifting blocks go n% faster, and hits on them deal double
  moltenCore: {
    driftMult: (c, v) => v * (1 + n(c, 'moltenCore') / 100),
    hitMult: (_c, x, v) => (drifted(x) ? v * 2 : v),
  },

  // ---------------------------------------------------------------- Link

  // Forged Bond: a finished pair counts n extra combo
  forgedBond: {
    linked: (c, x) => {
      const extra = Math.round(n(c, 'forgedBond'));
      if (extra <= 0) return;
      c.combo += extra;
      c.perkFx('forgedBond', extra, 0, x.pos);
    },
  },
  // Long Fuse: a pair's beat is n% longer
  longFuse: {
    linkBeat: (c, sec) => sec * (1 + n(c, 'longFuse') / 100),
  },
  // Hammer & Tongs: a pair's second half always crits
  hammerTongs: {
    critChance: (c, x, v) => (!x.echo && c.pairHit === 2 ? 1 : v),
    afterHit: (c, x) => {
      if (!x.echo && c.pairHit === 2) c.perkFx('hammerTongs', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Spare Link: once a fight, a broken pair doesn't break the combo
  spareLink: {
    linkBroken: (c, x) => {
      if (c.perk.spareLink) return;
      c.perk.spareLink = 1;
      x.forgive = true;
      c.perkFx('spareLink', 0, 0, x.pos);
    },
  },
  // Coupling: every nth finished pair banks a finisher stack
  coupling: {
    linked: (c, x) => {
      c.perk.coupling = (c.perk.coupling ?? 0) + 1;
      if (c.perk.coupling % Math.max(1, Math.round(n(c, 'coupling'))) !== 0) return;
      if (c.bankStacks(1, 'coupling') > 0) c.perkFx('coupling', 1, 0, x.pos);
    },
  },
  // Gold Rivets: each finished pair drops n coins
  goldRivets: {
    linked: (c, x) => {
      const coins = Math.round(n(c, 'goldRivets'));
      if (coins <= 0) return;
      c.awardCoins(coins, 'goldRivets');
      c.perkFx('goldRivets', coins, 0, x.pos);
    },
  },
  // Snap Back: a finished pair knocks the nearest red back to the far end
  snapBack: {
    linked: (c) => {
      const reds = c.blocks.filter((b) => isRed(b.kind) && !b.still);
      if (!reds.length) return;
      const near = reds.reduce((a, b) => (b.pos < a.pos ? b : a));
      c.pushBack(near, 1 - near.width / 2 - near.pos, c.tuning.blocks.knockbackSec * 2);
      c.perkFx('snapBack', 0, near.ownerId, near.pos);
    },
  },
  // Hair Trigger: finished pairs deal triple, but a broken pair costs n% HP
  hairTrigger: {
    hitMult: (c, x, v) => (!x.echo && c.pairHit > 0 ? v * 3 : v),
    linkBroken: (c) => {
      c.hurtHero(c.maxHp() * (n(c, 'hairTrigger') / 100), 'hairTrigger', false);
    },
  },
};
