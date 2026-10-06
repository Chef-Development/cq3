// Companions' perks as fight hooks (core/hooks.ts). Each equipped companion attacks every N of your hits
// (combat.ts companionTick: data in src/data/companions.ts) and adds the perks below; stars make their numbers a
// step stronger (tuning.pets.perkStep a star). Numbers: tuning.pets. Per-fight state in c.perk (keyed by the pet).

import type { CompanionId } from '../data/companions';
import { isRed } from './blocks';
import type { Combat } from './combat';
import type { FightHooks } from './hooks';
import type { PetBuild } from './roster';

const P = (c: Combat) => c.tuning.pets;
const DT = 1 / 120;

function hooksFor(pet: PetBuild): FightHooks {
  const k = (c: Combat) => 1 + P(c).perkStep * (pet.stars - 1); // a star: perks a step stronger
  switch (pet.id) {
    case 'bun':
      // Lucky Foot: every Nth hit finds a coin
      return {
        afterHit: (c, x) => {
          if (x.echo) return;
          c.perk.bunHits = (c.perk.bunHits ?? 0) + 1;
          if (c.perk.bunHits % Math.max(1, Math.round(P(c).bunEvery / k(c))) === 0) {
            c.awardCoins(1, 'luckyFoot');
            c.perkFx('luckyFoot', 1);
          }
        },
      };
    case 'pip':
      // Owl Watch: the first trap each fight is pecked away
      return {
        spawned: (c, b) => {
          if (b.kind !== 'purple' || c.perk.owlWatch) return;
          c.perk.owlWatch = 1;
          c.perk.owlWatchId = b.id;
        },
        step: (c) => {
          if (c.perk.owlWatch !== 1) return;
          const b = c.blocks.find((x) => x.id === c.perk.owlWatchId);
          c.perk.owlWatch = 2;
          if (!b) return;
          c.removeBlock(b, 'perk');
          c.perkFx('owlWatch', 0, 0, b.pos);
        },
      };
    case 'newt':
      // Ember Bite: bites burn the target for a few seconds
      return {
        afterPeck: (c, x) => {
          if (x.pet !== 'newt') return;
          c.perk.burnFoe = x.target.id;
          c.perk.burnTicks = Math.round(P(c).newtSec); // a burn a second
          c.perk.burnTick = 1;
        },
        step: (c) => {
          if (!(c.perk.burnTicks > 0)) return;
          c.perk.burnTick -= DT;
          if (c.perk.burnTick > 1e-9) return;
          c.perk.burnTick = 1;
          c.perk.burnTicks--;
          const foe = c.enemyById(c.perk.burnFoe);
          if (foe?.alive) c.strike(foe, P(c).newtBurn * k(c), 'emberBite');
        },
      };
    case 'sprocket':
      // Oil Can: every few seconds, the next block has a wider Perfect zone
      return {
        step: (c) => {
          if (c.perk.oil) return;
          c.perk.oilT = (c.perk.oilT ?? 0) + DT;
          if (c.perk.oilT >= P(c).oilEvery / k(c)) {
            c.perk.oilT = 0;
            c.perk.oil = 1;
          }
        },
        perfectFrac: (c, _b, v) => (c.perk.oil ? Math.min(1, v * P(c).oilPerfect) : v),
        afterHit: (c, x) => {
          if (!x.echo && c.perk.oil) {
            c.perk.oil = 0;
            if (x.perfect) c.perkFx('oilCan', 0, 0, x.block.pos);
          }
        },
        afterBlock: (c, x) => {
          if (!x.echo && c.perk.oil) c.perk.oil = 0;
        },
      };
    case 'brick':
      // Rock Wall: every few seconds, blocks a red that reaches you
      return {
        step: (c) => {
          if (c.perk.rockReady) return;
          c.perk.rockT = (c.perk.rockT ?? 0) + DT;
          if (c.perk.rockT >= P(c).rockEvery / k(c)) {
            c.perk.rockT = 0;
            c.perk.rockReady = 1;
          }
        },
        impact: (c) => {
          if (!c.perk.rockReady) return false;
          c.perk.rockReady = 0;
          c.perkFx('rockWall');
          return true;
        },
      };
    case 'flurry':
      // Chill Bite: bites slow the target's reds; Snow Dash: after a block, the next red slows for a moment
      return {
        afterPeck: (c, x) => {
          if (x.pet !== 'flurry') return;
          let first: (typeof c.blocks)[number] | null = null;
          for (const b of c.blocks)
            if (isRed(b.kind) && b.ownerId === x.target.id) {
              c.chillRed(b, P(c).chillSec * k(c), P(c).chillMult);
              if (!first || b.pos < first.pos) first = b;
            }
          if (first) c.perkFx('chillBite', 0, x.target.id, first.pos);
        },
        afterBlock: (c, x) => {
          if (x.echo) return;
          let next: (typeof c.blocks)[number] | null = null;
          for (const b of c.blocks) if (isRed(b.kind) && !b.still && (!next || b.pos < next.pos)) next = b;
          if (next) {
            c.chillRed(next, 1 * k(c), P(c).chillMult);
            c.perkFx('snowDash', 0, 0, next.pos);
          }
        },
      };
    case 'mote':
      // Starlight: every N combo a green appears; Mend: at 10+ combo, heals a little every few seconds
      return {
        combo: (c, before, after) => {
          const n = Math.max(1, Math.round(P(c).starEvery / k(c)));
          if (Math.floor(after / n) > Math.floor(before / n)) {
            const front = c.frontEnemy();
            if (front && c.trySpawn('green', front.id)) c.perkFx('starlight');
          }
        },
        step: (c) => {
          if (c.combo < 10) return;
          c.perk.mendT = (c.perk.mendT ?? 0) + DT;
          if (c.perk.mendT >= P(c).mendSec) {
            c.perk.mendT = 0;
            c.healPerk(c.maxHp() * 0.01 * k(c), 'mend');
          }
        },
      };
    case 'sunny':
      // Gold Hoard: kills drop more coins; Fire Breath: at a high combo its breath burns traps away; Warm Glow: ice under
      // you melts faster
      return {
        kill: (c, e) => {
          const extra = Math.round((c.tuning.enemies[e.key]?.coins ?? 0) * P(c).hoard * k(c));
          if (extra > 0) c.awardCoins(extra, 'goldHoard');
        },
        afterPeck: (c, x) => {
          if (x.pet !== 'sunny' || c.combo < P(c).burnAt) return;
          let n = 0;
          for (const b of c.blocks.slice())
            if (b.kind === 'purple') {
              c.removeBlock(b, 'perk');
              n++;
            }
          if (n) c.perkFx('fireBreath', n);
        },
        step: (c) => {
          const z = c.iceAt(c.cursorPos());
          if (z && z.life !== Infinity) z.life -= DT * (P(c).glow - 1);
        },
      };
  }
}

/** The perks the equipped companions bring to a fight. */
export function companionHooks(pets: readonly PetBuild[]): FightHooks[] {
  return pets.map(hooksFor);
}

export type { CompanionId };
