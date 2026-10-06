// Relics as fight hooks (core/hooks.ts). Each relic changes a rule or a decision (src/data/relics.ts has the text);
// its one number is relicN(c.tuning, id). Run-level relics (Field Rations, Tithe, Haggler, Gold Fever's prices,
// Vampiric Fang's rests) live in core/run.ts.
// Per-fight state goes in c.perk (numbers, keyed by the relic's id). A relic that kicks in shows itself with
// c.perkFx(id, amount, enemyId, pos), or through a Combat helper that does (strike, healPerk, bankStacks, loseStacks).
// Echo hits and blocks (another perk's extra ones: a Blast Wave hit, Night Watch's block, Shadow Step) count for what
// a hit or block gives (combo, meter, heals, coins, stacks), but never set off another extra strike (Ricochet, Iron
// Rhythm, Mirror Guard) or use up Weak Spot, so perks can't chain off each other.
// Always-on multipliers (Momentum, Overdrive, Greenhouse's yellows, Shieldbearer) name themselves when they turn on
// or pay off, not on every hit.

import type { RelicId } from '../data/relics';
import { isAttack, isRed, type BlockKind } from './blocks';
import type { Combat, Enemy } from './combat';
import type { FightHooks } from './hooks';
import { Rng } from './rng';
import type { Tuning } from './tuning';

/** A relic's live number (tuning.relics.n), or 0. */
export const relicN = (t: Tuning, id: RelicId): number => t.relics.n[id] ?? 0;

const n = (c: Combat, id: RelicId): number => relicN(c.tuning, id);

/** A perk's own random stream, kept in c.perk: its rolls never disturb the fight's spawn or crit rolls. */
function perkRoll(c: Combat, key: string): number {
  const r = new Rng(0);
  let s = c.perk[key];
  if (s === undefined) {
    s = c.tick + 1;
    for (let i = 0; i < key.length; i++) s = Math.imul(s ^ key.charCodeAt(i), 0x9e3779b1);
  }
  r.state = s;
  const v = r.next();
  c.perk[key] = r.state;
  return v;
}

/** The next living foe after `from` (by slot, back to the front after the last), never `from` itself. */
function nextFoe(c: Combat, from: Enemy): Enemy | null {
  const foes = c.aliveFoes().filter((e) => e !== from);
  return foes.find((e) => e.slot > from.slot) ?? foes[0] ?? null;
}

/** Ricochet: a crit (a hit's or a peck's) also hits the next foe for the same damage. */
function ricochet(c: Combat, from: Enemy | null, dmg: number): void {
  if (!from || dmg <= 0) return;
  const e = nextFoe(c, from);
  if (e) c.strike(e, dmg, 'ricochet', true);
}

/** Lucky Penny: every crit (a hit's or a peck's) drops coins. */
function luckyPenny(c: Combat, enemyId: number): void {
  const coins = Math.round(n(c, 'luckyPenny'));
  if (coins <= 0) return;
  c.awardCoins(coins, 'luckyPenny');
  c.perkFx('luckyPenny', coins, enemyId);
}

/** How likely a yellow is to come as a green with Greenhouse: as many more greens as the owner's pattern has
 *  (greens / yellows), or the average pattern's for a pattern with no greens. */
function greenShare(c: Combat, ownerId: number): number {
  const ratio = (pattern: string): number => {
    const y = pattern.split('Y').length - 1;
    const g = pattern.split('G').length - 1;
    return y > 0 ? g / y : 0;
  };
  const key = c.enemyById(ownerId)?.key ?? '';
  const own = ratio(c.tuning.enemies[key]?.pattern ?? '');
  if (own > 0) return own;
  if (c.perk.greenhouseAvg === undefined) {
    const all = Object.values(c.tuning.enemies)
      .map((d) => ratio(d.pattern))
      .filter((r) => r > 0);
    c.perk.greenhouseAvg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
  }
  return c.perk.greenhouseAvg;
}

/** Fire Echo Strike's pending echo: the same targets again, the dead ones skipped. */
function fireEcho(c: Combat): void {
  delete c.perk.echoStrikeAt;
  for (const k of Object.keys(c.perk)) {
    if (!k.startsWith('echoStrike:')) continue;
    const dmg = c.perk[k];
    delete c.perk[k];
    const e = c.enemyById(Number(k.slice('echoStrike:'.length)));
    if (e?.alive) c.strike(e, dmg, 'echoStrike');
  }
}

export const RELIC_HOOKS: Partial<Record<RelicId, FightHooks>> = {
  // ---------------------------------------------------------------- Bomb

  // Powder Keg: tapping a bomb also banks a finisher stack
  powderKeg: {
    afterBlock: (c, x) => {
      if (x.block.kind === 'bomb' && !x.cracked) c.bankStacks(1, 'powderKeg');
    },
  },
  // Short Fuse: a bomb that reaches you blows up on the enemies instead (no damage, no combo break)
  shortFuse: {
    impact: (c, b) => {
      if (b.kind !== 'bomb') return false;
      c.perkFx('shortFuse', 0, b.ownerId, b.pos);
      c.blowUp(b);
      return true;
    },
  },
  // Sapper's Fuse: every n-th red an enemy's pattern sends comes as a bomb
  sapper: {
    spawnKind: (c, kind, ownerId) => {
      if (kind !== 'red') return kind;
      const every = Math.max(1, Math.round(n(c, 'sapper')));
      const seq = c.enemyById(ownerId)?.seq ?? -1;
      const at = `sapper@${ownerId}`;
      const bomb = `sapper#${ownerId}`;
      // a red the spawn point turned away comes back with the same pattern step: decided once
      if (c.perk[at] === seq) return c.perk[bomb] ? 'bomb' : kind;
      c.perk[at] = seq;
      c.perk.sapper = (c.perk.sapper ?? 0) + 1;
      c.perk[bomb] = c.perk.sapper % every === 0 ? 1 : 0;
      return c.perk[bomb] ? 'bomb' : kind;
    },
    spawned: (c, b) => {
      const bomb = `sapper#${b.ownerId}`;
      if (b.kind !== 'bomb' || c.perk[bomb] !== 1) return;
      c.perk[bomb] = 2; // shown once
      c.perkFx('sapper', 0, b.ownerId, b.pos);
    },
  },
  // Blast Wave: the yellows (and greens) a bomb's blast clears count as your hits (damage, combo, meter)
  blastWave: {
    explode: (c, bomb, cleared) => {
      const hits = cleared.filter((b) => isAttack(b.kind));
      if (!hits.length || c.result) return;
      c.perkFx('blastWave', hits.length, 0, bomb.pos);
      for (const b of hits) c.perkHitCleared(b);
    },
  },
  // Parting Gift: after a finisher, a bomb rolls onto the bar
  partingGift: {
    afterFinisher: (c) => {
      const front = c.frontEnemy();
      if (front && c.trySpawn('bomb', front.id)) c.perkFx('partingGift', 0, front.id);
    },
  },

  // ---------------------------------------------------------------- Crit

  // Sharpshooter: Perfects always crit
  sharpshooter: {
    critChance: (_c, x, v) => (x.perfect ? Math.max(v, 1) : v),
    afterHit: (c, x) => {
      if (x.perfect && x.crit) c.perkFx('sharpshooter', 0, x.target?.id ?? 0);
    },
  },
  // Glass Edge: crits deal double, but a miss costs n HP more
  glassEdge: {
    critMult: (_c, _x, v) => v * 2,
    afterHit: (c, x) => {
      if (x.crit) c.perkFx('glassEdge', x.damage, x.target?.id ?? 0);
    },
    miss: (c, x) => {
      const cost = n(c, 'glassEdge');
      if (cost <= 0) return;
      x.damage += cost;
      c.perkFx('glassEdge');
    },
  },
  // Last Stand: below n% HP, every hit crits
  lastStand: {
    critChance: (c, _x, v) => {
      const low = c.hero.hp < (c.maxHp() * n(c, 'lastStand')) / 100;
      if (low && !c.perk.lastStand) c.perkFx('lastStand'); // named as it turns on
      c.perk.lastStand = low ? 1 : 0;
      return low ? Math.max(v, 1) : v;
    },
  },
  // Weak Spot: your first hit after a block (a crack counts) always crits
  weakSpot: {
    afterBlock: (c) => {
      c.perk.weakSpot = 1;
    },
    critChance: (c, x, v) => (c.perk.weakSpot && !x.echo ? Math.max(v, 1) : v),
    afterHit: (c, x) => {
      if (x.echo || !c.perk.weakSpot) return;
      c.perk.weakSpot = 0;
      c.perkFx('weakSpot', 0, x.target?.id ?? 0);
    },
  },
  // Ricochet: a crit also hits the next foe for the same damage (not off echo hits)
  ricochet: {
    afterHit: (c, x) => {
      if (x.crit && !x.echo) ricochet(c, x.target, x.damage);
    },
    afterPeck: (c, x) => {
      if (x.crit) ricochet(c, x.target, x.damage);
    },
  },
  // Hunting Owl: Pip's pecks roll your crit chance and deal your crit damage
  huntingOwl: {
    peck: (c, x) => {
      const st = c.stats();
      if (x.crit || perkRoll(c, 'huntingOwl') >= st.critChance + c.tuskCrit) return;
      x.crit = true;
      x.damage = Math.max(1, Math.round(x.damage * st.critDmg * (c.hasPerk('glassEdge') ? 2 : 1)));
      c.perkFx('huntingOwl', x.damage, x.target.id);
    },
  },
  // Lucky Penny: every crit (a peck's too) drops n coin
  luckyPenny: {
    afterHit: (c, x) => {
      if (x.crit) luckyPenny(c, x.target?.id ?? 0);
    },
    afterPeck: (c, x) => {
      if (x.crit) luckyPenny(c, x.target.id);
    },
  },

  // ---------------------------------------------------------------- Block

  // Iron Rhythm: every 3rd block in a row (since your last hit, miss or hurt; a crack counts) counterattacks for n x attack
  ironRhythm: {
    afterBlock: (c, x) => {
      if (x.echo) return;
      c.perk.ironRhythm = (c.perk.ironRhythm ?? 0) + 1;
      if (c.perk.ironRhythm % 3 !== 0) return;
      const e = x.owner?.alive ? x.owner : c.frontEnemy();
      if (e) c.strike(e, c.stats().atk * n(c, 'ironRhythm'), 'ironRhythm');
    },
    afterHit: (c, x) => {
      if (!x.echo) c.perk.ironRhythm = 0;
    },
    miss: (c) => {
      c.perk.ironRhythm = 0;
    },
    hurt: (c, v, source) => {
      if (source !== 'perk') c.perk.ironRhythm = 0;
      return v;
    },
  },
  // Mirror Guard: a Perfect block throws the attack back at its owner (the red's own damage; a bomb's hits harder)
  mirrorGuard: {
    afterBlock: (c, x) => {
      const o = x.owner;
      if (!x.perfect || x.cracked || x.echo || !o?.alive) return;
      c.strike(o, o.atk * (x.block.kind === 'bomb' ? c.tuning.blocks.bombHitMult : 1), 'mirrorGuard');
    },
  },
  // Turtle Shell: shield reds need one tap less (the Golem's 3-tap wall too)
  turtleShell: {
    spawned: (c, b) => {
      if (b.kind !== 'shield' || b.taps <= 1) return;
      b.taps--;
      c.perk[`turtleShell:${b.id}`] = 1;
    },
    afterBlock: (c, x) => {
      const k = `turtleShell:${x.block.id}`;
      if (x.cracked || !c.perk[k]) return;
      delete c.perk[k];
      c.perkFx('turtleShell', 0, x.block.ownerId, x.block.pos); // a shield down a tap early
    },
  },
  // Shieldbearer: only blocks fill the meter, but n x as much
  shieldbearer: {
    meter: (c, source, v) => {
      if (source === 'block') {
        c.perk.shieldbearer = c.stacks;
        return v * n(c, 'shieldbearer');
      }
      return source === 'perk' ? v : 0;
    },
    afterBlock: (c) => {
      const before = c.perk.shieldbearer;
      delete c.perk.shieldbearer;
      if (before !== undefined && c.stacks > before) c.perkFx('shieldbearer', c.stacks - before); // a block banked a stack
    },
  },
  // Night Watch: every n-th peck, Pip also blocks the red closest to you
  nightWatch: {
    afterPeck: (c, x) => {
      const every = Math.max(1, Math.round(n(c, 'nightWatch')));
      if (x.count % every !== 0) return;
      let near: (typeof c.blocks)[number] | null = null;
      for (const b of c.blocks) if (isRed(b.kind) && (!near || b.pos < near.pos)) near = b;
      if (!near) return;
      c.perkFx('nightWatch', 0, near.ownerId, near.pos);
      c.perkBlock(near);
    },
  },

  // ---------------------------------------------------------------- Combo

  // Chain Reaction: every n combo, all yellows on the bar turn green
  chainReaction: {
    combo: (c, before, after) => {
      const every = Math.max(1, Math.round(n(c, 'chainReaction')));
      if (Math.floor(after / every) <= Math.floor(before / every)) return;
      const yellows = c.blocks.filter((b) => b.kind === 'yellow');
      for (const b of yellows) c.morph(b, 'green');
      c.perkFx('chainReaction', yellows.length);
    },
  },
  // Momentum: hit damage grows with the cursor's speed, +n% at its max
  momentum: {
    hitMult: (c, x, v) => {
      const max = c.tuning.cursor.maxSpeedMult;
      const frac = max > 1 ? Math.min(1, Math.max(0, (c.speedMult() - 1) / (max - 1))) : 0;
      if (frac >= 1 && !c.perk.momentum) c.perkFx('momentum', n(c, 'momentum'), x.target?.id ?? 0); // at full speed
      c.perk.momentum = frac >= 1 ? 1 : 0;
      return v * (1 + (n(c, 'momentum') / 100) * frac);
    },
  },
  // Crescendo: the finisher deals +n% per combo it was fired at
  crescendo: {
    finisher: (c, x, v) => {
      if (x.combo <= 0) return v;
      const pct = n(c, 'crescendo') * x.combo;
      c.perkFx('crescendo', pct);
      return v * (1 + pct / 100);
    },
  },
  // Clutch: a miss no longer breaks the combo, but costs (at least) n HP
  clutch: {
    miss: (c, x) => {
      x.breaks = false;
      x.damage = Math.max(x.damage, Math.round((c.maxHp() * n(c, 'clutch')) / 100));
      c.perkFx('clutch');
    },
  },
  // Overdrive: at n+ combo, you deal double damage and take double (not a relic's own price)
  overdrive: {
    combo: (c, before, after) => {
      const at = n(c, 'overdrive');
      if (before < at && after >= at) c.perkFx('overdrive');
    },
    hitMult: (c, _x, v) => (c.combo >= n(c, 'overdrive') ? v * 2 : v),
    hurt: (c, v, source) => (source !== 'perk' && c.combo >= n(c, 'overdrive') ? v * 2 : v),
  },
  // Gold Fever: +1 coin every 10 combo (its shop prices are in run.ts)
  goldFever: {
    combo: (c, before, after) => {
      const coins = Math.floor(after / 10) - Math.floor(before / 10);
      if (coins <= 0) return;
      c.awardCoins(coins, 'goldFever');
      c.perkFx('goldFever', coins);
    },
  },

  // ---------------------------------------------------------------- Finisher

  // Sweeper: the finisher doesn't reset the combo
  sweeper: {
    finisher: (_c, x, v) => {
      x.keepCombo = true;
      return v;
    },
    afterFinisher: (c, x) => {
      if (x.combo > 0) c.perkFx('sweeper', x.combo);
    },
  },
  // Hoarder: a miss or a hit costs 1 stack instead of all of them
  hoarder: {
    comboBreak: (c, x) => {
      if (x.stacks < 2 || x.keepStacks >= x.stacks - 1) return;
      x.keepStacks = x.stacks - 1;
      c.perkFx('hoarder', x.keepStacks);
    },
  },
  // Overcharge: +2 max stacks, but n s without an attack hit while holding stacks loses one (the wait restarts)
  overcharge: {
    maxStacks: (_c, v) => v + 2,
    step: (c) => {
      if (c.stacks <= 0) {
        delete c.perk.overcharge;
        return;
      }
      const since = (c.perk.overcharge ??= c.motionTime);
      if (c.motionTime - since < n(c, 'overcharge') - 1e-9) return;
      c.loseStacks(1, 'overcharge');
      c.perk.overcharge = c.motionTime;
    },
    afterHit: (c) => {
      c.perk.overcharge = c.motionTime;
    },
  },
  // Quick Draw: a 1-stack finisher deals n x damage
  quickDraw: {
    finisher: (c, x, v) => {
      if (x.stacks !== 1) return v;
      c.perkFx('quickDraw');
      return v * n(c, 'quickDraw');
    },
  },
  // Echo Strike: n% of the finisher's damage hits the same foes again a moment later (tuning.relics.echoDelay)
  echoStrike: {
    afterFinisher: (c, x) => {
      if (c.perk.echoStrikeAt !== undefined) fireEcho(c); // one still waiting goes off now
      const dmg = Math.round((x.damage * n(c, 'echoStrike')) / 100);
      if (dmg <= 0) return;
      for (const e of x.targets) c.perk[`echoStrike:${e.id}`] = dmg;
      c.perk.echoStrikeAt = c.motionTime + Math.max(0, c.tuning.relics.echoDelay);
    },
    step: (c) => {
      if (c.perk.echoStrikeAt !== undefined && c.motionTime >= c.perk.echoStrikeAt - 1e-9) fireEcho(c);
    },
  },
  // Blood Price: the finisher deals double but costs n% of max HP (keeps the combo; never kills)
  bloodPrice: {
    finisher: (c, _x, v) => {
      const cost = Math.min(Math.round((c.maxHp() * n(c, 'bloodPrice')) / 100), c.hero.hp - 1);
      c.perkFx('bloodPrice', cost);
      if (cost > 0) c.hurtHero(cost, 'bloodPrice');
      return v * 2;
    },
  },
  // Purple Pact: a tapped trap doesn't trigger: you take n damage (the combo stays) and bank a stack
  purplePact: {
    trap: (c, b) => {
      if (!c.bankStacks(1, 'purplePact')) c.perkFx('purplePact', 0, b.ownerId, b.pos);
      const cost = n(c, 'purplePact');
      if (cost > 0) c.hurtHero(cost, 'purplePact');
      return true;
    },
  },

  // ---------------------------------------------------------------- Green

  // Greenhouse: greens come twice as often (some yellows come green), but yellows deal n% less
  greenhouse: {
    spawnKind: (c, kind, ownerId): BlockKind => {
      c.perk.greenhouseFx = 0;
      if (kind !== 'yellow') return kind;
      // a running share instead of a roll: exactly as many extra greens as the patterns' own
      c.perk.greenhouse = (c.perk.greenhouse ?? 0) + greenShare(c, ownerId);
      if (c.perk.greenhouse < 1 - 1e-9) return kind;
      c.perk.greenhouse -= 1;
      c.perk.greenhouseFx = 1;
      return 'green';
    },
    spawned: (c, b) => {
      if (!c.perk.greenhouseFx || b.kind !== 'green') return;
      c.perk.greenhouseFx = 0;
      c.perkFx('greenhouse', 0, b.ownerId, b.pos);
    },
    hitMult: (c, x, v) => (x.green ? v : v * Math.max(0, 1 - n(c, 'greenhouse') / 100)),
  },
  // Verdant Surge: a green hit banks a whole finisher stack
  verdantSurge: {
    afterHit: (c, x) => {
      if (x.green) c.bankStacks(1, 'verdantSurge');
    },
  },
  // Evergreen: while the green ability is on, a Perfect (hit or block) restarts it
  evergreen: {
    afterHit: (c, x) => {
      if (!x.perfect || x.green || c.hero.abilityTimer <= 0) return;
      c.hero.abilityTimer = c.abilitySec();
      c.perkFx('evergreen', 0, x.target?.id ?? 0);
    },
    afterBlock: (c, x) => {
      if (!x.perfect || c.hero.abilityTimer <= 0) return;
      c.hero.abilityTimer = c.abilitySec();
      c.perkFx('evergreen');
    },
  },
  // Photosynthesis: a green hit heals n% of max HP
  photosynthesis: {
    afterHit: (c, x) => {
      if (x.green) c.healPerk((c.maxHp() * n(c, 'photosynthesis')) / 100, 'photosynthesis');
    },
  },

  // ---------------------------------------------------------------- Pip

  // Treasure Nose: each peck steals n coin
  treasureNose: {
    afterPeck: (c, x) => {
      const coins = Math.round(n(c, 'treasureNose'));
      if (coins <= 0) return;
      c.awardCoins(coins, 'treasureNose');
      c.perkFx('treasureNose', coins, x.target.id);
    },
  },
  // Wingman: a peck fills the meter like a hit
  wingman: {
    afterPeck: (c, x) => {
      c.fillMeter(c.tuning.meter.perHit, 'peck');
      c.perkFx('wingman', 0, x.target.id);
    },
  },

  // ---------------------------------------------------------------- Sustain

  // Vampiric Fang: every attack hit heals n HP (rests heal nothing: run.ts)
  vampiricFang: {
    afterHit: (c) => {
      c.healPerk(n(c, 'vampiricFang'), 'vampiricFang');
    },
  },
};
