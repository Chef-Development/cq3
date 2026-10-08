// Region 2's relics as fight hooks (core/hooks.ts): the Ice relics (patches of ice on the bar speed the cursor up)
// and the Hold relics (hold blocks). Merged into RELIC_HOOKS by relic-fx.ts. Each one's number is
// tuning.relics.n[id]; each calls c.perkFx when it kicks in.

import type { RelicId } from '../data/relics';
import { isRed } from './blocks';
import type { Combat } from './combat';
import type { FightHooks } from './hooks';

const n = (c: Combat, id: RelicId): number => c.tuning.relics.n[id] ?? 0;
const held = (c: Combat): boolean => c.hitNow?.block.kind === 'hold' && !c.hitNow.echo;

export const FROST_RELIC_HOOKS: Partial<Record<RelicId, FightHooks>> = {
  // ---------------------------------------------------------------- Ice

  // Skate Blades: hits on ice deal more
  skateBlades: {
    hitMult: (c, x, v) => (!x.echo && c.iceAt(x.block.pos) ? v * (1 + n(c, 'skateBlades') / 100) : v),
  },
  // Frost Rune: Perfect hits on ice always crit
  frostRune: {
    critChance: (c, x, v) => (!x.echo && x.perfect && c.iceAt(x.block.pos) ? 1 : v),
    afterHit: (c, x) => {
      if (!x.echo && x.perfect && c.iceAt(x.block.pos)) c.perkFx('frostRune', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Hot Cocoa: when an ice patch melts, heal n HP
  hotCocoa: {
    step: (c) => {
      const ice = c.zones.filter((z) => z.kind === 'ice').length;
      const before = c.perk.cocoaIce ?? 0;
      if (ice < before) for (let i = 0; i < before - ice; i++) c.healPerk(n(c, 'hotCocoa'), 'hotCocoa');
      c.perk.cocoaIce = ice;
    },
  },
  // Icebreaker: blocking a red on ice knocks the next red back to the far end
  icebreaker: {
    afterBlock: (c, x) => {
      if (x.echo || !c.iceAt(x.block.pos)) return;
      let next: (typeof c.blocks)[number] | null = null;
      for (const b of c.blocks) if (isRed(b.kind) && !b.still && (!next || b.pos < next.pos)) next = b;
      if (!next) return;
      c.pushBack(next, 1);
      c.perkFx('icebreaker', 0, next.ownerId, next.pos);
    },
  },
  // Snowplow: the finisher clears every patch and deals more per patch cleared
  snowplow: {
    finisher: (c, _x, v) => {
      const k = c.zones.length;
      c.perk.plowed = k;
      return v * (1 + (n(c, 'snowplow') / 100) * k);
    },
    afterFinisher: (c) => {
      for (const z of c.zones.slice()) c.removeZone(z);
      if (c.perk.plowed) c.perkFx('snowplow', c.perk.plowed);
      c.perk.plowed = 0;
    },
  },
  // Glacier Heart: reds crossing ice slow down
  glacierHeart: {
    step: (c) => {
      for (const b of c.blocks) if (isRed(b.kind) && !b.still && c.iceAt(b.pos)) c.chillRed(b, 0.1, 1 - n(c, 'glacierHeart') / 100);
    },
  },
  // Frostbite: ice speeds you up more, but hits on ice deal double
  frostbite: {
    zoneMult: (c, z, v) => (z.kind === 'ice' ? v * (1 + n(c, 'frostbite') / 100) : v),
    hitMult: (c, x, v) => (!x.echo && c.iceAt(x.block.pos) ? v * 2 : v),
  },
  // Melt: yellows that land on ice turn green
  melt: {
    spawned: (c, b) => {
      if (b.kind === 'yellow' && c.iceAt(b.pos)) {
        b.kind = 'green';
        c.perkFx('melt', 0, 0, b.pos);
      }
    },
  },

  // ---------------------------------------------------------------- Hold

  // Steady Grip: a finished hold fills the meter like n hits
  steadyGrip: {
    meter: (c, source, v) => (source === 'hit' && held(c) ? v * Math.max(1, n(c, 'steadyGrip')) : v),
  },
  // Long Note: a finished hold counts n extra combo
  longNote: {
    comboGain: (c, from, _p, v) => (from === 'hit' && held(c) ? v + Math.round(n(c, 'longNote')) : v),
  },
  // Hold Fast: while holding, reds that reach you deal half
  holdFast: {
    hurt: (c, amount, source) => (c.holding && (source === 'red' || source === 'bomb') ? amount * 0.5 : amount),
  },
  // Release Valve: every n-th finished hold banks a finisher stack
  releaseValve: {
    afterHit: (c, x) => {
      if (x.echo || x.block.kind !== 'hold') return;
      c.perk.holds = (c.perk.holds ?? 0) + 1;
      if (c.perk.holds % Math.max(1, Math.round(n(c, 'releaseValve'))) === 0) c.bankStacks(1, 'releaseValve');
    },
  },
  // Tether: a hold pressed Perfectly always crits
  tether: {
    critChance: (_c, x, v) => (!x.echo && x.block.kind === 'hold' && x.perfect ? 1 : v),
  },
  // Lucky Mitten: each finished hold drops n coin
  luckyMitten: {
    afterHit: (c, x) => {
      if (x.echo || x.block.kind !== 'hold') return;
      c.awardCoins(n(c, 'luckyMitten'), 'luckyMitten');
      c.perkFx('luckyMitten', n(c, 'luckyMitten'), 0, x.block.pos);
    },
  },
  // Crampons: once a fight, a slipped hold doesn't break the combo
  crampons: {
    miss: (c, x) => {
      if (!x.slip || c.perk.crampons || !c.canForgive()) return;
      c.perk.crampons = 1;
      x.breaks = false;
      x.damage = 0;
      c.perkFx('crampons');
    },
  },
};
