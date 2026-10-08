// Gorm's and Tess's skill trees as fight hooks (Part 6; the words are in src/data/skills-heroes.ts): their rule nodes
// and capstones, merged into HERO_SKILL_HOOKS (skill-fx-heroes.ts). A node's number is skillN(c.tuning, id); each calls
// c.perkFx(id, ...) when it kicks in. The kits they build on are in kit-fx.ts (Rockfall, Roar, Thick Skin; the
// Stopwatch, Slow Time, Rewind), which leave what the nodes read in c.perk:
//   rockHit / rockRed     the hit that was a Rockfall, and the red it shoved (0: none)
//   skinWave / skinNow    the wave whose Thick Skin is used (wave index + 1), and the tick it covered a hit
//   stop / stops / stopHit   seconds of stopped time left, Stopwatches so far, the hit that set the last one off
// and these nodes keep their own:
//   skinMore          the wave (+1) whose Second Skin cover is used up, skinCount how many it covered
//   warCry            reds blocked toward the next War Cry
//   loopSeen / pauseSeen   the Stopwatches Time Loop and Long Pause have counted

import { isRed } from './blocks';
import type { Block, Combat } from './combat';
import { skillN } from './heroes';
import type { FightHooks } from './hooks';
import { holdReds, nearestRed, rewindReds, roar, stopEvery, stopwatch } from './kit-fx';

const N = (c: Combat, id: string): number => skillN(c.tuning, id);
/** A node's number as a share (25 -> 0.25). */
const P = (c: Combat, id: string): number => Math.max(0, N(c, id)) / 100;
/** A node's number as a whole count (at least 1). */
const every = (c: Combat, id: string): number => Math.max(1, Math.round(N(c, id)));
const ability = (c: Combat): boolean => c.hero.abilityTimer > 0;
/** This hit was a Rockfall (the kit marks it before the nodes' afterHit runs). */
const rocked = (c: Combat, id: number): boolean => c.perk.rockHit === id && id > 0;
/** Thick Skin covered the hit being taken right now (this tick). */
const skinned = (c: Combat): boolean => c.perk.skinNow === c.tick;
/** A red slowed but still moving (Slow Time, Bend, a Roar): not held still. */
const slowed = (b: Block): boolean => isRed(b.kind) && b.chill > 0 && b.chillMult > 0 && b.chillMult < 1;

// ---------------------------------------------------------------- Gorm

const GORM: Record<string, FightHooks> = {
  // Big Shove: Rockfall shoves its red n% further
  bigShove: {
    afterHit: (c, x) => {
      if (!rocked(c, x.block.id) || !c.perk.rockRed) return;
      const r = c.blocks.find((b) => b.id === c.perk.rockRed);
      if (r && c.pushBack(r, c.tuning.kits.gorm.shove * P(c, 'bigShove')) > 0) c.perkFx('bigShove', 0, 0, r.pos);
    },
  },
  // Split Rock: a Rockfall also hits every other foe for n% of its blow
  splitRock: {
    afterHit: (c, x) => {
      if (!rocked(c, x.block.id) || c.result) return;
      for (const e of c.aliveFoes()) if (e !== x.target) c.strike(e, x.damage * P(c, 'splitRock'), 'splitRock', false, x.block.pos);
    },
  },
  // Stone Rain (capstone): a Rockfall shoves every red on the bar back, not just the nearest
  stoneRain: {
    afterHit: (c, x) => {
      if (!rocked(c, x.block.id)) return;
      let n = 0;
      for (const b of c.blocks.filter((r) => isRed(r.kind) && !r.still && r.id !== c.perk.rockRed).sort((a, b) => b.pos - a.pos))
        if (c.pushBack(b, c.tuning.kits.gorm.shove) > 0) n++;
      if (n) c.perkFx('stoneRain', n);
    },
  },
  // Long Roar: a Roar slows the reds n s longer (the green ability, and the reds it slowed)
  longRoar: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result) return;
      const extra = Math.max(0, N(c, 'longRoar'));
      c.hero.abilityTimer += extra;
      let n = 0;
      for (const b of c.blocks)
        if (isRed(b.kind) && !b.still) {
          c.chillRed(b, c.abilitySec() + extra, c.tuning.kits.gorm.roarMult);
          n++;
        }
      if (n) c.perkFx('longRoar', n);
    },
  },
  // Ear Ringer: a Roar stuns every foe for n s
  earRinger: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result) return;
      for (const e of c.aliveFoes()) {
        c.stun(e, N(c, 'earRinger'));
        c.perkFx('earRinger', 0, e.id);
      }
    },
  },
  // War Cry (capstone): every n-th red blocked lets out a Roar (the slow, for the green ability's length)
  warCry: {
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || c.result) return;
      c.perk.warCry = (c.perk.warCry ?? 0) + 1;
      if (c.perk.warCry % every(c, 'warCry') !== 0) return;
      roar(c);
      c.perkFx('warCry', 0, 0, x.block.pos);
    },
  },
  // Second Skin: Thick Skin covers the first n hits each wave (the kit covers the first; this the rest)
  secondSkin: {
    hurt: (c, amount, source) => {
      if (amount <= 0 || source === 'miss' || source === 'perk' || skinned(c) || c.perk.skinWave !== c.waveIndex + 1) return amount;
      if (c.perk.skinMore !== c.waveIndex + 1) {
        c.perk.skinMore = c.waveIndex + 1;
        c.perk.skinCount = 1; // the kit's own
      }
      if (c.perk.skinCount >= every(c, 'secondSkin')) return amount;
      c.perk.skinCount++;
      c.perk.skinNow = c.tick;
      const cut = amount * c.tuning.kits.gorm.skin;
      c.perkFx('secondSkin', cut);
      return amount - cut;
    },
  },
  // Shrug It Off: a hit Thick Skin covered doesn't break the combo (nor lose the stacks or the meter)
  shrugOff: {
    comboBreak: (c, x) => {
      if (x.cause !== 'hurt' || !skinned(c)) return;
      x.keepCombo = x.combo;
      x.keepStacks = x.stacks;
      x.keepMeter = x.meter;
      c.perkFx('shrugOff');
    },
  },
  // Bedrock (capstone): while this wave's Thick Skin is unused, hits deal n% more
  bedrock: {
    hitMult: (c, x, v) => {
      if (x.echo || c.perk.skinWave === c.waveIndex + 1) return v;
      c.perk.bedrock = x.block.id;
      return v * (1 + P(c, 'bedrock'));
    },
    afterHit: (c, x) => {
      if (c.perk.bedrock !== x.block.id) return;
      c.perk.bedrock = 0;
      c.perkFx('bedrock', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
};

// ---------------------------------------------------------------- Tess

const TESS: Record<string, FightHooks> = {
  // Long Pause: every Stopwatch holds the reds n s longer (it looks once a tick: a Stopwatch may come from the kit,
  // a node or a star)
  longPause: {
    step: (c) => {
      const stops = c.perk.stops ?? 0;
      if ((c.perk.pauseSeen ?? 0) >= stops) return;
      c.perk.pauseSeen = stops;
      if (!(c.perk.stop > 0) || c.result) return;
      c.perk.stop += Math.max(0, N(c, 'longPause'));
      c.perkFx('longPause', holdReds(c, c.perk.stop));
    },
  },
  // Quick Tick: while time is stopped, hits deal n% more
  quickTick: {
    hitMult: (c, x, v) => {
      if (x.echo || !(c.perk.stop > 0)) return v;
      c.perk.quickTick = x.block.id;
      return v * (1 + P(c, 'quickTick'));
    },
    afterHit: (c, x) => {
      if (c.perk.quickTick !== x.block.id) return;
      c.perk.quickTick = 0;
      c.perkFx('quickTick', x.damage, x.target?.id ?? 0, x.block.pos);
    },
  },
  // Perfect Time (capstone): a Perfect hit counts twice toward the Stopwatch
  perfectTime: {
    afterHit: (c, x) => {
      if (!x.perfect || x.echo || c.result) return;
      c.perk.tick = (c.perk.tick ?? 0) + 1;
      c.perkFx('perfectTime', c.perk.tick, 0, x.block.pos);
      if (c.perk.tick < stopEvery(c)) return;
      c.perk.tick = 0;
      c.perk.stopHit = x.block.id;
      stopwatch(c, x.block.pos);
    },
  },
  // Lingering: Slow Time lasts n s longer (its reds stay slowed while it runs: the kit keeps them so)
  lingering: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result) return;
      c.hero.abilityTimer += Math.max(0, N(c, 'lingering'));
      for (const b of c.blocks) if (slowed(b)) b.chill = Math.max(b.chill, c.hero.abilityTimer);
      c.perkFx('lingering', 0, 0, x.block.pos);
    },
  },
  // Borrowed Time: blocking a slowed red while Slow Time runs puts n s back on it (up to its full length)
  borrowedTime: {
    afterBlock: (c, x) => {
      if (x.cracked || x.echo || !ability(c) || !slowed(x.block)) return;
      const full = c.abilitySec() + (c.hasPerk('lingering') ? Math.max(0, N(c, 'lingering')) : 0);
      const before = c.hero.abilityTimer;
      c.hero.abilityTimer = Math.min(Math.max(before, full), before + Math.max(0, N(c, 'borrowedTime')));
      if (c.hero.abilityTimer <= before) return;
      for (const b of c.blocks) if (slowed(b)) b.chill = Math.max(b.chill, c.hero.abilityTimer);
      c.perkFx('borrowedTime', 0, 0, x.block.pos);
    },
  },
  // Standstill (capstone): a green hit stops time as well as slowing it
  standstill: {
    afterHit: (c, x) => {
      if (!x.green || x.echo || c.result || c.perk.stopHit === x.block.id) return;
      stopwatch(c, x.block.pos, 'standstill');
    },
  },
  // Wind Back: Rewind deals n% more for every red on the bar it winds back
  windBack: {
    finisher: (c, _x, v) => {
      const n = c.blocks.filter((b) => isRed(b.kind)).length;
      c.perk.windBack = n;
      return n ? v * (1 + P(c, 'windBack') * n) : v;
    },
    afterFinisher: (c) => {
      if (c.perk.windBack) c.perkFx('windBack', c.perk.windBack);
      c.perk.windBack = 0;
    },
  },
  // Backspin: a Perfect block winds the nearest red left on the bar back to where it started
  backspin: {
    afterBlock: (c, x) => {
      if (!x.perfect || x.cracked || x.echo || c.result) return;
      const r = nearestRed(c);
      if (!r) return;
      const at = r.pos;
      if (c.pushBack(r, r.from - r.pos - r.push, c.tuning.kits.tess.rewindSec) > 0) c.perkFx('backspin', 0, 0, at);
    },
  },
  // Time Loop (capstone): every n-th Stopwatch also winds every red back (it looks once a tick: the Stopwatch may come
  // from the kit, a node or a star)
  timeLoop: {
    step: (c) => {
      const stops = c.perk.stops ?? 0;
      while ((c.perk.loopSeen ?? 0) < stops) {
        c.perk.loopSeen = (c.perk.loopSeen ?? 0) + 1;
        if (c.perk.loopSeen % every(c, 'timeLoop') === 0 && !c.result) c.perkFx('timeLoop', rewindReds(c));
      }
    },
  },
};

/** Gorm's and Tess's rule nodes and capstones (skill-fx-heroes.ts adds them to HERO_SKILL_HOOKS). */
export const GORM_TESS_SKILL_HOOKS: Record<string, FightHooks> = { ...GORM, ...TESS };
