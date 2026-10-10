// Region 5's relics as fight hooks (core/hooks.ts): the Mirage relics (yellows that hop to a spot shown first) and
// the Heat relics (blazing yellows that hit hard and burn; a green cools). Merged into RELIC_HOOKS (relic-fx.ts); the
// relics themselves join RELICS once the region is in play (src/data/flags.ts). Each one's number is
// tuning.relics.n[id] (its data's `n` while the region is out of RELICS); each calls c.perkFx when it kicks in.

import { NOON_RELICS, type NoonRelicId } from '../data/relics-noon';
import type { Combat } from './combat';
import type { FightHooks, HitCtx } from './hooks';

const n = (c: Combat, id: NoonRelicId): number => c.tuning.relics.n[id] ?? NOON_RELICS.find((r) => r.id === id)?.n ?? 0;
/** A hit (not an echo) on a mirage (a yellow that hops). */
const mirageHit = (x: HitCtx): boolean => !x.echo && x.block.hopAt !== Infinity;
/** A hit (not an echo) on a blazing yellow. */
const blazeHit = (x: HitCtx): boolean => !x.echo && x.block.blaze;
/** How soon after its hop a mirage hit counts as "right after" (Haze Lens), seconds. */
const JUST_HOPPED = 1;

export const NOON_RELIC_HOOKS: Record<NoonRelicId, FightHooks> = {
  // ---------------------------------------------------------------- Mirage

  // Oasis Map: hits on mirages deal more
  oasisMap: {
    hitMult: (c, x, v) => (mirageHit(x) ? v * (1 + n(c, 'oasisMap') / 100) : v),
  },
  // Haze Lens: a mirage hit right after its hop always crits
  hazeLens: {
    critChance: (c, x, v) => (mirageHit(x) && c.time - x.block.hoppedAt <= JUST_HOPPED ? 1 : v),
    afterHit: (c, x) => {
      if (mirageHit(x) && c.time - x.block.hoppedAt <= JUST_HOPPED) c.perkFx('hazeLens', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Sand Glass: mirages hop less often
  sandGlass: {
    mirageEvery: (c, sec) => sec / Math.max(0.1, 1 - n(c, 'sandGlass') / 100),
  },
  // Ghost Step: a mirage hit fills the meter like n hits
  ghostStep: {
    afterHit: (c, x) => {
      if (!mirageHit(x)) return;
      c.fillMeter(c.tuning.meter.perHit * Math.max(0, n(c, 'ghostStep') - 1), 'hit', 'ghostStep');
      c.perkFx('ghostStep', 0, 0, x.block.pos);
    },
  },
  // Sand Dollar: each mirage hit drops coins
  sandDollar: {
    afterHit: (c, x) => {
      if (!mirageHit(x)) return;
      const coins = Math.round(n(c, 'sandDollar'));
      if (coins <= 0) return;
      c.awardCoins(coins, 'sandDollar');
      c.perkFx('sandDollar', coins, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Dust Devil: a mirage hit counts extra combo
  dustDevil: {
    afterHit: (c, x) => {
      if (!mirageHit(x)) return;
      const extra = Math.round(n(c, 'dustDevil'));
      if (extra <= 0) return;
      c.combo += extra;
      c.perkFx('dustDevil', extra, 0, x.block.pos);
    },
  },
  // Fata Morgana: mirages hop twice as often, and hits on them deal n times
  fataMorgana: {
    mirageEvery: (_c, sec) => sec / 2,
    hitMult: (c, x, v) => (mirageHit(x) ? v * n(c, 'fataMorgana') : v),
  },

  // ---------------------------------------------------------------- Heat

  // Sunshade: the Heat burns slower
  sunshade: {
    heatDps: (c, v) => v * (1 - n(c, 'sunshade') / 100),
  },
  // Cool Spring: a green that cools you heals
  coolSpring: {
    cooled: (c, by) => {
      if (by !== 'green') return;
      c.healPerk(n(c, 'coolSpring'), 'coolSpring');
    },
  },
  // Kindling: blazing hits fill more meter
  kindling: {
    meter: (c, source, v) => (source === 'hit' && c.hitNow && blazeHit(c.hitNow) ? v * (1 + n(c, 'kindling') / 100) : v),
  },
  // Sun Shard: at full Heat, every hit crits
  sunShard: {
    critChance: (c, x, v) => (!x.echo && c.heat >= Math.max(1, Math.round(c.tuning.heat.max)) ? 1 : v),
    afterHit: (c, x) => {
      if (!x.echo && x.crit && c.heat >= Math.max(1, Math.round(c.tuning.heat.max))) c.perkFx('sunShard', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Sun Purse: each blazing hit drops coins
  sunPurse: {
    afterHit: (c, x) => {
      if (!blazeHit(x)) return;
      const coins = Math.round(n(c, 'sunPurse'));
      if (coins <= 0) return;
      c.awardCoins(coins, 'sunPurse');
      c.perkFx('sunPurse', coins, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Shade Tree: blocking a red cools a stack of Heat
  shadeTree: {
    afterBlock: (c, x) => {
      if (x.echo || x.cracked || c.heat <= 0) return;
      c.easeHeat(Math.round(n(c, 'shadeTree')));
      c.perkFx('shadeTree', 0, 0, x.block.pos);
    },
  },
  // Noonday: the Heat never burns, but blazing hits land only n times (not heat.mult)
  noonday: {
    heatDps: () => 0,
    hitMult: (c, x, v) => (blazeHit(x) ? (v * n(c, 'noonday')) / Math.max(0.01, c.tuning.heat.mult) : v),
  },
};
