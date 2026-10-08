// Companions' perks as fight hooks (core/hooks.ts). Each equipped companion attacks every N of your hits
// (combat.ts companionTick: data in src/data/companions.ts) and adds the perks below; stars make their numbers a
// step stronger (tuning.pets.perkStep a star). Numbers: tuning.pets. Per-fight state in c.perk (keyed by the pet).

import { COMPANIONS, type CompanionId } from '../data/companions';
import { isRed } from './blocks';
import type { Block, Combat } from './combat';
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
      // Ember Bite: a bite sets its target burning (each foe its own burn: Enemy.burn / burnDps / burnTick): a share
      // of the bite's damage every second for a few seconds (stars: more), so it grows with the companion's level,
      // stars and the Companion stat like the bite; a bite on a burning foe refreshes it. Each tick is an 'emberBite'
      // strike. (c.perk.burnFoe / burnTicks: the last foe bitten, for the view's older flames.)
      return {
        afterPeck: (c, x) => {
          if (x.pet !== 'newt' || !x.target.alive) return;
          const e = x.target;
          const dps = x.damage * P(c).newtBurnShare * k(c);
          if (e.burn <= 0) e.burnTick = 1;
          e.burnDps = e.burn > 0 ? Math.max(e.burnDps, dps) : dps;
          e.burn = Math.max(e.burn, P(c).newtSec);
          c.perk.burnFoe = e.id;
          c.perk.burnTicks = Math.ceil(e.burn - 1e-9);
        },
        step: (c) => {
          for (const e of c.enemies) {
            if (e.burn <= 0) continue;
            if (!e.alive) {
              e.burn = e.burnDps = e.burnTick = 0;
              continue;
            }
            e.burnTick -= DT;
            if (e.burnTick <= 1e-9) {
              e.burnTick += 1;
              c.strike(e, e.burnDps, 'emberBite');
            }
            e.burn = Math.max(0, e.burn - DT);
            if (e.burn <= 1e-9) e.burn = e.burnDps = e.burnTick = 0;
          }
          const f = c.perk.burnFoe ? c.enemyById(c.perk.burnFoe) : undefined;
          c.perk.burnTicks = f && f.alive && f.burn > 0 ? Math.ceil(f.burn - 1e-9) : 0;
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
    // ---- Part 6 companions (round 7)
    case 'burr':
      // Prickly: a red (or bomb) that hits you sends spines back at the foe that threw it (a share of Burr's roll). The
      // spines fly on the next tick, so a hit that ends the fight never also wins it.
      return {
        hurt: (c, amount, source, enemyId) => {
          if (amount <= 0 || (source !== 'red' && source !== 'bomb') || !c.enemyById(enemyId)?.alive) return amount;
          const q = SPINES.get(c) ?? [];
          q.push({ foe: enemyId, dmg: petDamage(c, pet) * P(c).prickly * k(c) });
          SPINES.set(c, q);
          return amount;
        },
        step: (c) => {
          const q = SPINES.get(c);
          if (!q?.length) return;
          SPINES.delete(c);
          for (const x of q) {
            const e = c.enemyById(x.foe);
            if (e?.alive && !c.result) c.strike(e, x.dmg, 'prickly', false, 0);
          }
        },
      };
    case 'lark':
      // Wake-up Song: every N combo the next yellow sings (a note glows on it, 'wakeSong'); hitting it adds more combo
      // ('wakeNote'). One song at a time; a noted yellow gone some other way passes its note to the next yellow.
      return {
        combo: (c, before, after) => {
          const n = Math.max(1, Math.round(P(c).songEvery / k(c)));
          if (Math.floor(after / n) > Math.floor(before / n) && !c.perk.songNote) c.perk.songWant = 1;
        },
        step: (c) => {
          if (c.perk.songNote && !c.blocks.some((b) => b.id === c.perk.songNote)) {
            c.perk.songNote = 0;
            c.perk.songWant = 1;
          }
          if (!c.perk.songWant || c.perk.songNote) return;
          const b = nextOnBar(c, (x) => x.kind === 'yellow' && !x.link);
          if (!b) return;
          c.perk.songWant = 0;
          c.perk.songNote = b.id;
          c.perkFx('wakeSong', 0, 0, b.pos);
        },
        comboGain: (c, from, _perfect, n) => {
          const x = c.hitNow;
          if (from !== 'hit' || !x || x.echo || !c.perk.songNote || x.block.id !== c.perk.songNote) return n;
          c.perk.songNote = 0;
          const more = Math.max(1, Math.round(P(c).songCombo * k(c)));
          c.perkFx('wakeNote', more, 0, x.block.pos);
          return n + more;
        },
      };
    case 'gloam':
      // Night Eyes: every few seconds, the next trap on the bar is swatted into a yellow where it stands (it replaces
      // the trap: nothing is added to the bar). Pip's Owl Watch keeps the trap it has already picked.
      return {
        step: (c) => {
          if (!c.perk.nightReady) {
            c.perk.nightT = (c.perk.nightT ?? 0) + DT;
            if (c.perk.nightT >= P(c).nightEvery / k(c)) {
              c.perk.nightT = 0;
              c.perk.nightReady = 1;
            }
            return;
          }
          const trap = nextOnBar(c, (x) => x.kind === 'purple' && !(c.perk.owlWatch === 1 && c.perk.owlWatchId === x.id));
          if (!trap || c.result) return;
          c.perk.nightReady = 0;
          c.morph(trap, 'yellow');
          c.perkFx('nightEyes', 0, trap.ownerId, trap.pos);
        },
      };
    case 'nimbus':
      // Tide: every few seconds (once a red has come into the bar's near half) a wave crosses the bar from the left
      // end and pushes every red back as its front reaches it ('tide'; c.perk.tideX is the front while it crosses).
      // Calm Seas: at a high combo your hits deal more ('calmSeas' as the combo reaches it).
      return {
        step: (c) => {
          const T = P(c);
          // (the clock runs from one wave's start to the next)
          if (!c.perk.tideReady) {
            c.perk.tideT = (c.perk.tideT ?? 0) + DT;
            if (c.perk.tideT >= T.tideEvery / k(c)) {
              c.perk.tideT = 0;
              c.perk.tideReady = 1;
            }
          }
          if (c.perk.tideX > 0) {
            c.perk.tideX = Math.min(1.01, c.perk.tideX + DT / Math.max(0.05, T.tideSec));
            const wave = c.perk.tideN ?? 0;
            for (const b of c.blocks)
              if (isRed(b.kind) && !b.still && TIDE.get(b) !== wave && b.pos - b.width / 2 <= c.perk.tideX) {
                TIDE.set(b, wave);
                c.pushBack(b, T.tidePush, 0.3);
              }
            if (c.perk.tideX >= 1.01) c.perk.tideX = 0;
            return;
          }
          if (!c.perk.tideReady) return;
          let near: Block | null = null;
          for (const b of c.blocks) if (isRed(b.kind) && !b.still && b.pos < 0.5 && (!near || b.pos < near.pos)) near = b;
          if (!near || c.result) return;
          c.perk.tideReady = 0;
          c.perk.tideN = (c.perk.tideN ?? 0) + 1;
          c.perk.tideX = 1e-6;
          c.perkFx('tide', c.blocks.filter((b) => isRed(b.kind) && !b.still).length, 0, near.pos);
        },
        hitMult: (c, x, v) => (!x.echo && c.combo >= P(c).calmAt ? v * (1 + P(c).calmDmg * k(c)) : v),
        combo: (c, before, after) => {
          const at = P(c).calmAt;
          if (before < at && after >= at) c.perkFx('calmSeas', Math.round(P(c).calmDmg * k(c) * 100), 0, c.hitNow?.block.pos);
        },
      };
  }
}

/** Burr's spines waiting to fly (the tick after the hit). */
const SPINES = new WeakMap<Combat, Array<{ foe: number; dmg: number }>>();
/** The Tide wave each red was last pushed by (once per wave). */
const TIDE = new WeakMap<Block, number>();

/** A companion's attack damage, as combat.ts companionTick deals it (the Companion stat x its share, level, stars). */
function petDamage(c: Combat, pet: PetBuild): number {
  const T = P(c);
  return c.stats().companion * COMPANIONS[pet.id].dmg * (1 + T.levelDmg * (pet.level - 1)) * (1 + T.starDmg * (pet.stars - 1));
}

/** The block the cursor reaches next among those that pass `ok` (it runs to an end and back). */
function nextOnBar(c: Combat, ok: (b: Block) => boolean): Block | null {
  const at = c.cursorPos();
  const dir = c.cursorDirAt(c.time) >= 0 ? 1 : -1;
  let best: Block | null = null;
  let bestD = Infinity;
  for (const b of c.blocks) {
    if (!ok(b)) continue;
    const ahead = (b.pos - at) * dir;
    const d = ahead >= 0 ? ahead : dir > 0 ? 2 - at - b.pos : at + b.pos;
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}

/** The perks the equipped companions bring to a fight. */
export function companionHooks(pets: readonly PetBuild[]): FightHooks[] {
  return pets.map(hooksFor);
}

export type { CompanionId };
