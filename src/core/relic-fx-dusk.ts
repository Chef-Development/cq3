// Region 4's relics as fight hooks (core/hooks.ts): the Light relics (dark blocks and the cursor's lantern) and the
// Tide relics (the water at the bar's ends), merged into RELIC_HOOKS (relic-fx.ts). Each one's number is tuning.relics.n[id] (its data's `n`); each calls c.perkFx when it kicks in.

import { duskN, type DuskRelicId } from '../data/relics-dusk';
import { isRed } from './blocks';
import type { Combat } from './combat';
import type { FightHooks, HitCtx } from './hooks';

/** A relic's live number (tuning.relics.n; its data's `n` if a tuning from before the region lacks it). */
const n = (c: Combat, id: DuskRelicId): number => c.tuning.relics.n[id] ?? duskN(id);
/** A hit (not an echo) on a block that came dark. */
const darkHit = (x: HitCtx): boolean => !x.echo && x.block.dark;
/** How long after coming up a block still counts as just surfaced (Driftwood). */
const SURFACED_SEC = 1.5;
/** How close to the waterline a hit counts as "right by the water" (Spring Tide), share of the bar. */
const SHORE = 0.08;
/** Moonpull's knock back, share of the bar. */
const MOON_KNOCK = 0.15;

/** Whether bar position p is dry but within SHORE of the water's edge. */
function byWater(c: Combat, p: number): boolean {
  if (c.wet(p)) return false;
  return (c.waterL > 0 && p - c.waterL <= SHORE) || (c.waterR > 0 && 1 - c.waterR - p <= SHORE);
}

export const DUSK_RELIC_HOOKS: Record<DuskRelicId, FightHooks> = {
  // ---------------------------------------------------------------- Light

  // Moth Wing: hits on dark blocks deal more
  mothWing: {
    hitMult: (c, x, v) => (darkHit(x) ? v * (1 + n(c, 'mothWing') / 100) : v),
  },
  // Wick Trimmer: Perfect hits on dark blocks always crit
  wickTrimmer: {
    critChance: (_c, x, v) => (darkHit(x) && x.perfect ? 1 : v),
    afterHit: (c, x) => {
      if (darkHit(x) && x.perfect) c.perkFx('wickTrimmer', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Night Owl: the lantern reaches further
  nightOwl: {
    lightReach: (c, r) => r * (1 + n(c, 'nightOwl') / 100),
  },
  // Lantern Oil: each dark block the light reaches fills a little meter
  lanternOil: {
    lit: (c, b) => {
      c.fillMeter((c.tuning.meter.perHit * n(c, 'lanternOil')) / 100, 'perk', 'lanternOil');
      c.perkFx('lanternOil', 0, 0, b.pos);
    },
  },
  // Glow Worms: each dark block hit drops a coin
  glowWorms: {
    afterHit: (c, x) => {
      if (!darkHit(x)) return;
      c.awardCoins(n(c, 'glowWorms'), 'glowWorms');
      c.perkFx('glowWorms', n(c, 'glowWorms'), 0, x.block.pos);
    },
  },
  // Ember Jar: the light burns dark traps away as it reaches them
  emberJar: {
    lit: (c, b) => {
      if (b.kind !== 'purple') return;
      c.removeBlock(b, 'perk');
      c.perkFx('emberJar', 0, 0, b.pos);
    },
  },
  // Blindfold: the lantern reaches less far, but hits on dark blocks deal triple
  blindfold: {
    lightReach: (c, r) => r * (1 - n(c, 'blindfold') / 100),
    hitMult: (_c, x, v) => (darkHit(x) ? v * 3 : v),
  },

  // ---------------------------------------------------------------- Tide

  // Wading Boots: blocking a red in the water heals
  wadingBoots: {
    afterBlock: (c, x) => {
      if (x.echo || !c.wet(x.block.pos)) return;
      c.healPerk(n(c, 'wadingBoots'), 'wadingBoots');
    },
  },
  // Driftwood: a block that just came up out of the water crits
  driftwood: {
    critChance: (c, x, v) => (!x.echo && c.time - x.block.surfacedAt <= SURFACED_SEC ? 1 : v),
    afterHit: (c, x) => {
      if (!x.echo && c.time - x.block.surfacedAt <= SURFACED_SEC) c.perkFx('driftwood', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Undertow Charm: reds wade slower
  undertowCharm: {
    wadeMult: (c, m) => m * (1 - n(c, 'undertowCharm') / 100),
  },
  // Low Water: the water comes less far
  lowWater: {
    tideMult: (c, m) => m * (1 - n(c, 'lowWater') / 100),
  },
  // Tidepool: each block that comes up out of the water drops a coin
  tidepool: {
    surfaced: (c, b) => {
      c.awardCoins(n(c, 'tidepool'), 'tidepool');
      c.perkFx('tidepool', n(c, 'tidepool'), 0, b.pos);
    },
  },
  // Spring Tide: hits right by the water deal more
  springTide: {
    hitMult: (c, x, v) => (!x.echo && byWater(c, x.block.pos) ? v * (1 + n(c, 'springTide') / 100) : v),
  },
  // Moonpull: blocking a red in the water knocks the next red on the bar back, but the water comes further
  moonpull: {
    tideMult: (c, m) => m * (1 + n(c, 'moonpull') / 100),
    afterBlock: (c, x) => {
      if (x.echo || x.cracked || !c.wet(x.block.pos)) return;
      let next = null;
      for (const r of c.blocks) if (isRed(r.kind) && !r.still && r !== x.block && (!next || r.pos < next.pos)) next = r;
      if (!next) return;
      c.pushBack(next, MOON_KNOCK);
      c.perkFx('moonpull', 0, 0, next.pos);
    },
  },
};
