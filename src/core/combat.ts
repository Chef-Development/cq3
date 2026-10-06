// Deterministic combat simulation. No Phaser imports: Phaser only renders this state and feeds input.
// Time is in seconds of simulation time, advanced in fixed 1/120 s ticks.

import type { EffectId } from '../data/gear';
import type { RelicId } from '../data/relics';
import type { FormationEntry, SpecialDef } from '../data/types';
import { CODE_KIND, isAttack, isRed, type BlockKind } from './blocks';
import { AIM_WINDOW_MS, ISOLATION_MS } from './accuracy';
import { emptyLoadout, hasEffect, setPieces, type Loadout, type StatBlock } from './gear';
import { buildBonus, defaultBuild, type HeroBuild } from './heroes';
import type { BreakCtx, FightHooks, FinisherCtx, HitCtx, MeterSource, MissCtx, PeckCtx } from './hooks';
import { finisherShowMs } from './impact';
import { KIT_HOOKS } from './kit-fx';
import { RELIC_HOOKS } from './relic-fx';
import { SKILL_HOOKS } from './skill-fx';
import { Rng } from './rng';
import { fireSpecial, placeEntry } from './specials';
import type { BlockCode, Settings, Tuning } from './tuning';

export { CODE_KIND, isAttack, isRed, type BlockKind } from './blocks';

export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;
const HIST = 128; // ~1 s of cursor history for rewinding tap timestamps

export interface Block {
  id: number;
  kind: BlockKind;
  ownerId: number;
  pos: number; // center, 0..1 along the bar
  width: number;
  vel: number; // bar units per (unfrozen) second; negative = sliding left
  taps: number; // taps still needed (Shield starts at 2)
  bornAt: number; // sim time
  life: number; // seconds left (Infinity = until hit)
  impactTimer: number; // -1 = sliding; >=0 = sitting at the left end, about to hit
  push: number; // distance still to slide right (finisher pushback or shield knockback; 0 = none)
  pushSpeed: number; // bar units per second while pushed
  speed: number; // reds: times the normal travel speed (a Charge is 2)
  heal: number; // spores: share of max HP the enemies heal if it expires unbroken
}

export interface Enemy {
  id: number;
  key: string;
  slot: number; // 0 = front (closest to the hero)
  hp: number;
  maxHp: number;
  atk: number; // its red blocks' damage (level-scaled)
  special: number; // its traps' damage (level-scaled)
  alive: boolean;
  spawnTimer: number;
  seq: number;
  phase: number; // boss phase (1 = the start)
  uses: number[]; // per special: times it has fired
  timers: number[]; // per special: seconds until a timed special may start again
  shell: number; // attack-hit damage multiplier while its ward blocks stand (1 = no shell)
  guard: number; // seconds its shield stays raised (yellow taps are countered)
  protect: number; // damage multiplier while its linked summons live (1 = none)
  summoner: number; // id of the enemy that summoned it with a link (0 = none); it flees if that one falls
  split: boolean; // split into smaller enemies (gone, not killed)
  fled: boolean; // its summoner fell and it ran off (gone, not killed)
  wave: number; // the wave it came in with (summons and splits join the wave they appear in)
  member: boolean; // one of its wave's own foes (counted in "foe 3/7"), not a summon or a split
  parent: number; // id of the enemy it split from (0 = none)
}

/** A special being telegraphed: the enemy winds up for `total` seconds, then the special's actions fire. */
export interface Telegraph {
  enemyId: number;
  index: number; // into the enemy's specials
  left: number;
  total: number;
}

/** An enemy as saved mid-fight (see core/save.ts). */
export interface SavedFoe {
  key: string;
  hp: number; // 0 = dead or gone
  maxHp: number;
  phase: number;
  uses: number[];
  summoner: number; // index of its summoner in the saved list (-1 = none)
  protect: number;
  member?: boolean; // one of the wave's own foes (missing in older saves: the first ones in the list)
  parent?: number; // index of the enemy it split from in the saved list (-1 = none)
}

export interface Hero {
  hp: number;
  bonusAtk: number; // flat attack gained from kills
  bonusMaxHp: number;
  bonusDmg: number;
  bonusCrit: number;
  bonusCritDmg: number;
  bonusComboPower: number;
  bonusPet: number; // extra damage on the companion's pecks (Companion Power boosts)
  revives: number;
  abilityTimer: number;
  /** Relics picked this run (saved with the run, like the boosts). Never mutated in place: a copy of the hero
   *  (the act-start checkpoint) shares the array, so adding one makes a new array. */
  relics: RelicId[];
  /** What the equipped gear adds (stats, unique effects, set pieces). Not saved with the run: it comes from the profile. */
  gear: Loadout;
  /** Who is fighting (Rowan or Sable), their level and skills. Not saved with the run: it comes from the profile. */
  build: HeroBuild;
}

export function newHero(t: Tuning, gear: Loadout = emptyLoadout(), build: HeroBuild = defaultBuild()): Hero {
  const h: Hero = {
    hp: 0,
    bonusAtk: 0,
    bonusMaxHp: 0,
    bonusDmg: 0,
    bonusCrit: 0,
    bonusCritDmg: 0,
    bonusComboPower: 0,
    bonusPet: 0,
    revives: t.hero.revivesPerAct,
    abilityTimer: 0,
    relics: [],
    gear,
    build,
  };
  h.hp = heroMaxHp(t, h);
  return h;
}

/** The hero's base max HP (Rowan's or Sable's), before levels, boosts and gear. */
export const heroBaseHp = (t: Tuning, h: Hero): number => (h.build?.id === 'sable' ? t.sable.maxHp : t.hero.maxHp);

/** Max HP: the base and levels, kill gains, boosts and gear (the Greenwarden 2-piece's and skills' shares on top). */
export const heroMaxHp = (t: Tuning, h: Hero): number => {
  const gear = h.gear ?? emptyLoadout();
  const set = setPieces(gear, 'greenwarden') >= 2 ? t.effects.greenwardenHp : 0;
  const b = buildBonus(t, h.build);
  return Math.round((heroBaseHp(t, h) + b.hp + h.bonusMaxHp + gear.stats.hp) * (1 + set + b.hpPct));
};
/** Attack after levels, kill gains, gear, damage boosts and skills. (Sable's hits deal a share of it: kit-fx.ts.) */
export const heroAtk = (t: Tuning, h: Hero): number => {
  const b = buildBonus(t, h.build);
  return (t.hero.atk * (1 + b.levelAtk) + h.bonusAtk + (h.gear?.stats.atk ?? 0)) * (1 + h.bonusDmg + b.atkPct);
};

/** All 10 of the hero's stats as they stand (the stats screen, the HUD and the fight all read them from here). */
export function heroStats(t: Tuning, h: Hero): StatBlock {
  const g = (h.gear ?? emptyLoadout()).stats;
  const b = buildBonus(t, h.build);
  return {
    hp: heroMaxHp(t, h),
    atk: heroAtk(t, h),
    def: g.def + b.def,
    critChance: t.hero.critChance + h.bonusCrit + g.critChance + b.critChance,
    critDmg: t.hero.critDmg + h.bonusCritDmg + g.critDmg,
    comboPower: t.hero.comboPower + h.bonusComboPower + g.comboPower + b.comboPower,
    meterGain: g.meterGain + b.meterGain,
    steady: Math.min(t.gear.steadyCap, g.steady),
    luck: g.luck,
    companion: t.companion.damage + h.bonusPet + g.companion,
  };
}

/**
 * The red speed a fight runs at: the act's (1 = normal). Sable's half-speed cursors ride along with a red on the way
 * back, so a faster red costs her far fewer blocks than Rowan; on her bar the act's extra speed is scaled by
 * tuning.sable.actRedSpeed.
 */
export function redSpeedFor(t: Tuning, hands: number, actRedSpeed: number): number {
  const r = Math.max(0.1, actRedSpeed);
  return hands > 1 ? Math.max(0.1, 1 + (r - 1) * t.sable.actRedSpeed) : r;
}

/** Damage a red you didn't block deals, after Defense. */
export const afterDefense = (t: Tuning, dmg: number, def: number): number => (dmg * t.gear.defScale) / (t.gear.defScale + Math.max(0, def));

/** Coins a kill of `key` drops (Luck and Golden Touch add to them). */
export function killCoins(t: Tuning, h: Hero, key: string): number {
  const base = t.enemies[key]?.coins ?? 0;
  const gear = h.gear ?? emptyLoadout();
  return Math.round(base * (1 + gear.stats.luck + (hasEffect(gear, 'goldTouch') ? t.effects.goldTouch : 0)));
}

export function tierMult(t: Tuning, combo: number): number {
  const c = t.tiers;
  if (combo >= c.t3) return c.m3;
  if (combo >= c.t2) return c.m2;
  if (combo >= c.t1) return c.m1;
  return 1;
}

/** Triangle wave: phase 0..1 goes left->right, 1..2 right->left. */
export function phaseToPos(phase: number): number {
  const p = ((phase % 2) + 2) % 2;
  return p <= 1 ? p : 2 - p;
}

export type RemoveReason = 'hit' | 'bomb' | 'expire' | 'impact' | 'owner' | 'revive' | 'finisher' | 'counter' | 'perk';
export type HurtSource = 'red' | 'bomb' | 'trap' | 'miss' | 'counter' | 'perk';
/** What damaged a foe: a tapped yellow/green, a bomb blast (or a gear effect), the finisher, Pip, or a relic/skill/kit perk. */
export type DamageSource = 'hit' | 'bomb' | 'finisher' | 'pet' | 'perk';

export type CombatEvent =
  | { type: 'hit'; kind: BlockKind; pos: number; perfect: boolean; crit: boolean; damage: number; enemyId: number; combo: number; hand: number; echo: boolean }
  | { type: 'block'; kind: BlockKind; pos: number; perfect: boolean; cracked: boolean; ownerId: number; combo: number; knock: number; hand: number; echo: boolean }
  | { type: 'trap'; pos: number; damage: number; enemyId: number }
  | { type: 'counter'; pos: number; damage: number; enemyId: number }
  | { type: 'wardBreak'; pos: number; enemyId: number; left: number; perfect: boolean; combo: number }
  | { type: 'miss'; pos: number; selfDamage: boolean; hand: number }
  | { type: 'remove'; id: number; kind: BlockKind; pos: number; width: number; ownerId: number; reason: RemoveReason }
  | { type: 'spawn'; id: number; kind: BlockKind; ownerId: number; special: boolean }
  | { type: 'windup'; enemyId: number }
  | { type: 'telegraph'; enemyId: number; special: string; name: string; sound: string; sec: number }
  | { type: 'tellCancel'; enemyId: number }
  | { type: 'special'; enemyId: number; special: string }
  | { type: 'enemyHeal'; enemyId: number; amount: number }
  | { type: 'sporeHeal'; pos: number; enemyId: number }
  | { type: 'shellOn'; enemyId: number }
  | { type: 'shellOff'; enemyId: number }
  | { type: 'guardOn'; enemyId: number; sec: number }
  | { type: 'guardOff'; enemyId: number }
  | { type: 'protectOn'; enemyId: number }
  | { type: 'protectOff'; enemyId: number }
  | { type: 'summon'; enemyId: number; ids: number[] }
  | { type: 'split'; enemyId: number; ids: number[] }
  | { type: 'flee'; enemyId: number }
  | { type: 'freeze'; sec: number }
  | { type: 'thaw' }
  | { type: 'cursorFloor'; mult: number }
  | { type: 'phase'; enemyId: number; phase: number }
  | { type: 'heroHurt'; damage: number; source: HurtSource; enemyId: number; perk?: string }
  | { type: 'enemyHurt'; enemyId: number; damage: number; crit: boolean; source: DamageSource }
  | { type: 'heal'; amount: number }
  | { type: 'statGain'; enemyId: number; atk: number; maxHp: number; comboPower: number }
  | { type: 'pet'; enemyId: number; damage: number; crit: boolean }
  | { type: 'kill'; enemyId: number; coins: number }
  | { type: 'gearFx'; fx: EffectId | 'footpad'; amount: number; enemyId: number } // a gear effect kicked in (the view names it)
  // a relic, skill node or hero kit perk kicked in (id: a RelicId, a skill node id, or a kit id like 'shadowStep'; the
  // view names it); amount: damage dealt, HP healed, coins, stacks... (0 = just show the name)
  | { type: 'perk'; id: string; amount: number; enemyId: number; pos?: number }
  | { type: 'coins'; amount: number; id: string } // coins found mid-fight (relics), banked by the run
  | { type: 'morph'; id: number; kind: BlockKind } // a block on the bar changed kind (Chain Reaction: yellow -> green)
  | { type: 'explode'; pos: number; radius: number }
  | { type: 'finisher'; damage: number; combo: number; stacks: number; targets: number[] }
  | { type: 'ability' }
  | { type: 'speedUp'; mult: number }
  | { type: 'comboBreak'; lost: number; lostStacks: number }
  | { type: 'meterFull'; stacks: number }
  | { type: 'revive' }
  | { type: 'defeat' }
  | { type: 'won' }
  | { type: 'waveClear'; index: number } // a wave fell; the next walks in after tuning.waves.gapSec
  | { type: 'wave'; index: number; total: number; ids: number[] } // the next wave walks in
  | { type: 'hitStop'; ms: number }
  | { type: 'cursorReset' };

export type TapOutcome = 'hit' | 'block' | 'crack' | 'trap' | 'counter' | 'ward' | 'miss' | 'none';

export interface TapResult {
  outcome: TapOutcome;
  perfect: boolean;
  cursorPos: number;
  blockId: number;
  hand: number;
}

export interface Carry {
  combo: number;
  meter: number;
  stacks: number;
  speedStacks: number;
  cursorPhase: number;
}

export interface CombatOptions {
  tuning: Tuning;
  settings: Settings;
  hero: Hero;
  enemies: string[]; // enemy keys, front first
  /** Foes that come one wave after another (each wave fights at once); replaces `enemies` when given. */
  waves?: string[][];
  /** Resume at this wave (with `restore` holding that wave's foes). */
  wave?: number;
  seed: number;
  carry?: Partial<Carry>;
  spawning?: boolean; // false = no pattern spawns (tests)
  specials?: boolean; // enemies use their special moves (default: same as spawning)
  /** Resume a saved fight: each enemy's HP (front first); 0 = already dead. */
  enemyHp?: number[];
  /** Resume a saved fight with its summons, phases and used specials (replaces `enemies` / `enemyHp`). */
  restore?: SavedFoe[];
  /** The act's enemy scaling (and the map row's HP ramp). */
  hpMult?: number;
  atkMult?: number;
  /** The act's pace: enemies' spawn intervals are scaled by this (<1 = busier). */
  pace?: number;
  /** The act's red speed: enemy reds cross the bar this much faster (on Sable's bar, scaled by sable.actRedSpeed). */
  redSpeed?: number;
  /** Coin Rush (the mini-game): seconds on the clock. The fight is won when they run out; every hit knocks coins out
   *  of the foe (tuning.rush), misses don't hurt, and only the hero's kit is in play (no relics or skills). */
  rush?: number;
}

/** What happened in a fight, for the side quests (core/quests.ts). */
export interface FightLog {
  blocks: number; // reds blocked (a shield counts once, on its last tap)
  bestCombo: number;
  breaks: number; // misses and hits taken (each one broke the combo)
  cleanWaves: number; // waves cleared without a miss or a hit taken
  kills: number;
}

export class Combat {
  readonly tuning: Tuning;
  readonly settings: Settings;
  readonly hero: Hero;
  tick = 0;
  motionTime = 0; // advances only while not hit-stopped
  hitStop = 0; // seconds of freeze remaining
  cursorPhase = 0;
  combo = 0;
  speedStacks = 0;
  meter = 0; // progress toward the next finisher stack, 0..1
  stacks = 0; // banked finisher stacks
  /** Seconds the cursor stays stopped during the finisher; when it runs out the cursor restarts from the left
   *  (Sable: both cursors stop, then restart from the left end of their halves, A at 0 and B at the middle). */
  cursorHold = 0;
  /** Seconds the cursor stays frozen in place (a Stomp; both of Sable's); taps still count, judged where it stands. */
  freeze = 0;
  /** The cursor speed multiplier never drops below this for the rest of the fight (an enraged boss; both cursors). */
  minSpeed = 0;
  /** The special being telegraphed (one at a time, so each one can be read). */
  telegraph: Telegraph | null = null;
  /** Seconds until the next telegraph may start. */
  tellCooldown = 0;
  /** Formation blocks waiting for their delay (motion time) or for room on the bar. */
  queue: Array<{ at: number; ownerId: number; entry: FormationEntry; tries: number }> = [];
  specialsOn: boolean;
  readonly hpMult: number;
  readonly atkMult: number;
  readonly pace: number;
  /** How much faster than normal enemy reds travel in this fight (the act's red speed; Sable's own scaling on top). */
  readonly redSpeed: number;
  blocks: Block[] = [];
  enemies: Enemy[];
  targetId: number | null = null;
  events: CombatEvent[] = [];
  killQueue: number[] = [];
  result: null | 'won' | 'lost' = null;
  spawning: boolean;
  /** The current wave has more than one enemy (spawns come a little faster). */
  groupFight: boolean;
  /** The fight's waves of foes (a fight without waves is one wave), the one on screen, and the countdown to the next. */
  readonly waves: string[][];
  waveIndex = 0;
  nextWaveIn = -1;
  /** Foes in earlier waves that are no longer in `enemies` (a restored fight). */
  private beatenBefore = 0;
  /** Attack hits since the companion last pecked. */
  petCharge = 0;
  /** Timing errors (ms, + = late) of taps aimed at yellow blocks: the player's accuracy (core/accuracy.ts). */
  aims: number[] = [];
  /** Tusk Crown: extra crit chance, and how long it lasts. */
  tuskCrit = 0;
  tuskTimer = 0;
  /** Footpad set: the fight's first miss was forgiven. Second Wind: used this fight. */
  missForgiven = false;
  secondWindUsed = false;
  /** Opening Blow: foes already hit. */
  private struck = new Set<number>();
  /** The perks in play (the hero's kit, learned skills, relics; core/hooks.ts), and their per-fight state, keyed by
   *  the perk's id (counters, timers). */
  readonly hooks: FightHooks[];
  perk: Record<string, number> = {};
  /** Coins perks found mid-fight (the run banks them with the kills' coins). */
  coinsEarned = 0;
  /** Pip's pecks so far this fight. */
  pecks = 0;
  /** Coin Rush: seconds on the clock (0 = a normal fight), and the coins knocked out so far. */
  readonly rush: number;
  rushCoins = 0;
  /** What happened so far (the side quests read it when the fight is won). */
  log: FightLog = { blocks: 0, bestCombo: 0, breaks: 0, cleanWaves: 0, kills: 0 };
  /** Breaks when the current wave came in (a wave cleared with none since is clean). */
  private waveBreaks = 0;
  /** Cursors on the bar: 1 (Rowan; the Blade family) or 2 (Sable; the Twin family: one per half). */
  readonly hands: number;
  /** The hand of the last attack hit (-1 = none yet): Ambidextrous and the alternating skills read it. */
  lastHand = -1;
  /** Attack hits in a row that alternated hands, this chain's first hit included (L R L = 3; a hit with the same
   *  hand as the one before starts a new chain at 1; a miss or a combo break ends it at 0). Echoes don't count. */
  altStreak = 0;
  /** The attack hit being resolved right now (comboGain and meter hooks read whether it alternated), or null. */
  hitNow: HitCtx | null = null;
  /** The sim time the tap being judged right now happened at (NaN outside a tap): perks that act under the other
   *  cursor (Shadow Step, Cross Guard) and Double Down read it. */
  tapAt = NaN;

  private nextId = 1;
  private refillTimer = 0;
  private spawnRng: Rng;
  private critRng: Rng;
  private hT = new Float64Array(HIST);
  private hPhase = new Float64Array(HIST);
  private hPhaseVel = new Float64Array(HIST);
  private hMotion = new Float64Array(HIST);
  private hMotionVel = new Float64Array(HIST);
  private hHead = 0;
  private hCount = 0;

  constructor(o: CombatOptions) {
    this.tuning = o.tuning;
    this.settings = o.settings;
    this.hero = o.hero;
    const build = o.hero.build ?? defaultBuild();
    this.hands = build.id === 'sable' ? 2 : 1;
    this.rush = Math.max(0, o.rush ?? 0);
    // (Coin Rush is pure aim: the hero's kit only)
    this.hooks = (this.rush ? [KIT_HOOKS[build.id]] : [KIT_HOOKS[build.id], ...build.skills.map((id) => SKILL_HOOKS[id]), ...(o.hero.relics ?? []).map((id) => RELIC_HOOKS[id])]).filter((h): h is FightHooks => !!h);
    this.spawning = o.spawning ?? true;
    this.specialsOn = o.specials ?? this.spawning;
    this.hpMult = o.hpMult ?? 1;
    this.atkMult = o.atkMult ?? 1;
    this.pace = o.pace ?? 1;
    this.redSpeed = redSpeedFor(o.tuning, this.hands, o.redSpeed ?? 1);
    this.spawnRng = new Rng(o.seed);
    this.critRng = new Rng(o.seed ^ 0x5bd1e995);
    this.combo = o.carry?.combo ?? 0;
    this.meter = o.carry?.meter ?? 0;
    this.stacks = o.carry?.stacks ?? 0;
    this.speedStacks = o.carry?.speedStacks ?? 0;
    this.cursorPhase = o.carry?.cursorPhase ?? 0;
    this.waves = o.waves?.length ? o.waves.map((w) => w.slice()) : [o.enemies.slice()];
    this.waveIndex = Math.max(0, Math.min(this.waves.length - 1, Math.round(o.wave ?? 0)));
    for (let i = 0; i < this.waveIndex; i++) this.beatenBefore += this.waves[i].length;
    if (o.restore) {
      this.enemies = o.restore.map((f, slot) => {
        const e = this.makeEnemy(f.key, slot);
        e.member = f.member ?? slot < this.waves[this.waveIndex].length;
        e.maxHp = Math.max(1, Math.round(f.maxHp));
        e.hp = Math.max(0, Math.min(e.maxHp, Math.round(f.hp)));
        e.alive = e.hp > 0;
        e.phase = Math.max(1, Math.round(f.phase));
        f.uses.forEach((u, i) => {
          if (i < e.uses.length) e.uses[i] = Math.max(0, Math.round(u));
        });
        e.protect = f.protect > 0 && f.protect < 1 ? f.protect : 1;
        return e;
      });
      o.restore.forEach((f, i) => {
        const s = this.enemies[f.summoner];
        if (s && f.summoner !== i) this.enemies[i].summoner = s.id;
        const p = this.enemies[f.parent ?? -1];
        if (p && f.parent !== i) this.enemies[i].parent = p.id;
      });
    } else this.enemies = this.waves[this.waveIndex].map((key, slot) => Object.assign(this.makeEnemy(key, slot), { member: true }));
    this.groupFight = this.enemies.length > 1;
    if (o.enemyHp && !o.restore)
      this.enemies.forEach((e, i) => {
        const hp = o.enemyHp![i];
        if (hp === undefined || !Number.isFinite(hp)) return;
        e.hp = Math.max(0, Math.min(e.maxHp, Math.round(hp)));
        e.alive = e.hp > 0;
      });
    if (this.enemies.every((e) => !e.alive)) {
      if (this.waveIndex < this.waves.length - 1) this.nextWaveIn = 0; // saved between waves: the next one comes right in
      else this.result = 'won';
    }
    if (this.spawning && this.frontEnemy()) {
      const front = this.frontEnemy() ?? this.enemies[0];
      for (let i = 0; i < this.tuning.blocks.openingSpawns; i++) this.trySpawn('yellow', front.id);
    }
    if (!this.result) for (const h of this.hooks) h.start?.(this);
    this.record();
  }

  // ---------------------------------------------------------------- perks (core/hooks.ts)

  /** Run a number through every hook that changes it. */
  mod(v: number, f: (h: FightHooks, v: number) => number | undefined): number {
    for (const h of this.hooks) v = f(h, v) ?? v;
    return v;
  }

  /** The first hook that claims something (returns true) handles it alone. */
  claim(f: (h: FightHooks) => boolean | undefined | void): boolean {
    for (const h of this.hooks) if (f(h) === true) return true;
    return false;
  }

  /** Whether a perk (relic, skill node or kit) is in play. */
  hasPerk(id: string): boolean {
    return (this.hero.relics ?? []).includes(id as RelicId) || (this.hero.build?.skills ?? []).includes(id) || this.hero.build?.id === id;
  }

  /** A perk kicked in: the view names it (and shows the amount). */
  perkFx(id: string, amount = 0, enemyId = 0, pos?: number): void {
    this.events.push({ type: 'perk', id, amount: Math.round(amount), enemyId, pos });
  }

  /** The hero's max HP right now. */
  maxHp(): number {
    return heroMaxHp(this.tuning, this.hero);
  }

  /** Heal the hero for a perk (up to max HP). Returns how much. */
  healPerk(amount: number, id: string): number {
    const H = this.hero;
    const heal = Math.min(this.maxHp() - H.hp, Math.max(0, Math.round(amount)));
    if (heal <= 0 || H.hp <= 0) return 0;
    H.hp += heal;
    this.perkFx(id, heal);
    return heal;
  }

  /** The hero takes damage from a perk's cost (Glass Edge, Blood Price, Purple Pact...). `keepCombo`: it doesn't break the combo. */
  hurtHero(amount: number, id: string, keepCombo = true): void {
    this.heroDamage(amount, 'perk', 0, keepCombo, id);
  }

  /** Coins found mid-fight (banked by the run). */
  awardCoins(n: number, id: string): void {
    const c = Math.max(0, Math.round(n));
    if (c <= 0) return;
    this.coinsEarned += c;
    this.events.push({ type: 'coins', amount: c, id });
  }

  /** Bank finisher stacks (up to the max). Returns how many were added. */
  bankStacks(n: number, id: string): number {
    const max = this.maxStacks();
    let added = 0;
    while (added < n && this.stacks < max) {
      this.stacks++;
      added++;
      this.events.push({ type: 'meterFull', stacks: this.stacks });
    }
    if (this.stacks >= max) this.meter = 1;
    if (added) this.perkFx(id, added);
    return added;
  }

  /** Lose finisher stacks (Overcharge). */
  loseStacks(n: number, id: string): void {
    const lost = Math.min(this.stacks, Math.max(0, n));
    if (lost <= 0) return;
    this.stacks -= lost;
    if (this.meter >= 1) this.meter = 0;
    this.events.push({ type: 'comboBreak', lost: 0, lostStacks: lost });
    this.perkFx(id, -lost);
  }

  /** Max finisher stacks right now. */
  maxStacks(): number {
    return Math.max(1, Math.round(this.mod(this.tuning.meter.maxStacks, (h, v) => h.maxStacks?.(this, v))));
  }

  /** A perk strikes a foe (a counterattack, a ricochet, an echo): no shell, no crit roll. */
  strike(e: Enemy, dmg: number, id: string, crit = false): void {
    if (!e.alive || dmg <= 0) return;
    const d = Math.max(1, Math.round(dmg));
    this.perkFx(id, d, e.id);
    this.damageEnemy(e, d, crit, 'perk');
  }

  /** A perk hits a yellow/green on the bar as if it were tapped (Shadow Step, Blast Wave). */
  perkHit(b: Block, hand: number, perfect = false): void {
    if (!this.blocks.includes(b) || !isAttack(b.kind) || this.result) return;
    this.hitAttack(b, perfect, hand, true);
  }

  /** A perk blocks a red on the bar as if it were tapped (Night Watch, Cross Guard). */
  perkBlock(b: Block, hand: number): void {
    if (!this.blocks.includes(b) || !isRed(b.kind) || this.result) return;
    this.blockRed(b, false, hand, true);
  }

  /** A bomb blows up on the enemies without being tapped (Short Fuse). */
  blowUp(b: Block): void {
    this.removeBlock(b, 'perk');
    this.explode(b);
  }

  /** Turn a block on the bar into another kind (Chain Reaction: yellows go green). */
  morph(b: Block, kind: BlockKind): void {
    if (!this.blocks.includes(b) || b.kind === kind) return;
    b.kind = kind;
    this.events.push({ type: 'morph', id: b.id, kind });
  }

  /** Push a red back to the right (Parry). Returns the distance. */
  pushBack(b: Block, dist: number, sec = this.tuning.blocks.knockbackSec): number {
    return isRed(b.kind) ? this.knockBack(b, dist, sec) : 0;
  }

  /** The hero's stats as they stand (perks read attack, crit chance and crit damage from here). */
  stats(): StatBlock {
    return heroStats(this.tuning, this.hero);
  }

  /** Fill the meter for a perk, as if from `source` (Wingman: a peck fills it like a hit). */
  fillMeter(x: number, source: MeterSource = 'perk', hand = 0): void {
    this.addMeter(x, source, hand);
  }

  /** A perk counts a yellow/green a bomb's blast already took off the bar as a hit of yours (Blast Wave). */
  perkHitCleared(b: Block, hand = 0): void {
    if (this.blocks.includes(b) || !isAttack(b.kind) || this.result) return;
    this.hitAttack(b, false, hand, true);
  }

  /** Living foes, front first. */
  aliveFoes(): Enemy[] {
    return this.enemies.filter((e) => e.alive).sort((a, b) => a.slot - b.slot);
  }

  /** The bar's range for a cursor: [0, 1] for one cursor; Sable's A sweeps [0, 0.5] and B [0.5, 1]. */
  handRange(hand: number): [number, number] {
    if (this.hands < 2) return [0, 1];
    return hand <= 0 ? [0, 0.5] : [0.5, 1];
  }

  /** How much of the bar a cursor sweeps (1 for one cursor, 0.5 for each of Sable's): each half is a small bar of
   *  its own, so the cursor's width, the edge margins and the gaps between static blocks scale with it. */
  handSpan(hand = 0): number {
    const [lo, hi] = this.handRange(hand);
    return hi - lo;
  }

  /** Which cursor a bar position belongs to. */
  handOf(pos: number): number {
    return this.hands < 2 ? 0 : pos < 0.5 ? 0 : 1;
  }

  /** The other cursor (Sable); Rowan's only one is its own other. */
  otherHand(hand: number): number {
    return this.hands < 2 ? 0 : hand > 0 ? 0 : 1;
  }

  /** A fresh enemy of kind `key` (scaled by this fight's HP and attack multipliers). */
  private makeEnemy(key: string, slot: number, hp?: number): Enemy {
    const def = this.tuning.enemies[key];
    if (!def) throw new Error(`Unknown enemy ${key}`);
    const max = Math.max(1, Math.round(hp ?? def.hp * this.hpMult));
    return {
      id: this.nextId++,
      key,
      slot,
      hp: max,
      maxHp: max,
      atk: Math.round(def.atk * this.atkMult),
      special: Math.round(def.special * this.atkMult),
      alive: true,
      spawnTimer: def.interval * 0.6 + slot * 0.35,
      seq: 0,
      phase: 1,
      uses: def.specials.map(() => 0),
      timers: def.specials.map((sp) => (sp.every !== undefined ? (sp.first ?? sp.every) : 0)),
      shell: 1,
      guard: 0,
      protect: 1,
      summoner: 0,
      split: false,
      fled: false,
      wave: this.waveIndex,
      member: false,
      parent: 0,
    };
  }

  /**
   * Bring a new enemy into the fight (a summon or a split). Returns null when the screen is full
   * (tuning.specials.maxEnemies). It takes the first free slot, unless `slot` asks for one.
   */
  addEnemy(key: string, o: { summoner?: number; hp?: number; slot?: number } = {}): Enemy | null {
    if (this.result || !this.tuning.enemies[key]) return null;
    const alive = this.enemies.filter((e) => e.alive);
    if (alive.length >= Math.max(1, Math.round(this.tuning.specials.maxEnemies))) return null;
    let slot = o.slot ?? -1;
    if (slot < 0 || alive.some((e) => e.slot === slot)) {
      slot = 0;
      while (alive.some((e) => e.slot === slot)) slot++;
    }
    const e = this.makeEnemy(key, slot, o.hp);
    e.summoner = o.summoner ?? 0;
    e.spawnTimer = this.tuning.enemies[key].interval * 0.8;
    this.enemies.push(e);
    return e;
  }

  get time(): number {
    return this.tick * DT;
  }

  // ---------------------------------------------------------------- speed & history

  speedMult(): number {
    const c = this.tuning.cursor;
    // Steady (gear) slows how fast the cursor speeds up with the combo
    const steady = Math.min(this.tuning.gear.steadyCap, Math.max(0, this.hero.gear?.stats.steady ?? 0));
    const m = (1 + c.speedPerHit * (1 - steady) * this.combo) * (1 + c.speedBlockBonus * this.speedStacks);
    return Math.max(this.minSpeed, Math.min(c.maxSpeedMult, m));
  }

  /** Cursor speed in passes per second (one pass = 1 unit of phase; for Rowan, bar-widths per second). Both of
   *  Sable's cursors run at this many passes of their own half (barSpeed gives bar units per second). */
  cursorSpeed(): number {
    return this.speedMult() / this.tuning.cursor.basePassSec;
  }

  /** Cursor `hand`'s speed in bar units per second right now (Sable's cursors cover half a bar per pass). */
  barSpeed(hand = 0): number {
    return this.cursorSpeed() * this.handSpan(hand);
  }

  private phaseVelNow(): number {
    return this.hitStop > 0 || this.result || this.cursorHold > 0 || this.freeze > 0 ? 0 : this.cursorSpeed();
  }

  private motionVelNow(): number {
    return this.hitStop > 0 || this.result ? 0 : 1;
  }

  private record(): void {
    const i = this.hHead;
    this.hT[i] = this.time;
    this.hPhase[i] = this.cursorPhase;
    this.hPhaseVel[i] = this.phaseVelNow();
    this.hMotion[i] = this.motionTime;
    this.hMotionVel[i] = this.motionVelNow();
    this.hHead = (i + 1) % HIST;
    this.hCount = Math.min(HIST, this.hCount + 1);
  }

  /** Index of the newest snapshot at or before t (or the oldest one). */
  private histIndex(t: number): number {
    let idx = -1;
    for (let k = 0; k < this.hCount; k++) {
      idx = (this.hHead - 1 - k + HIST) % HIST;
      if (this.hT[idx] <= t + 1e-9) return idx;
    }
    return idx;
  }

  /** Cursor phase at sim time t: rewinds through history for past times, extrapolates for t >= now. */
  phaseAt(t: number): number {
    if (t >= this.time) return this.cursorPhase + this.phaseVelNow() * (t - this.time);
    const i = this.histIndex(t);
    return this.hPhase[i] + this.hPhaseVel[i] * Math.max(0, t - this.hT[i]);
  }

  /**
   * Where cursor `hand` is at sim time t, as a position on the whole bar (0..1). Sable's two cursors share one phase
   * (one speed, one finisher stop, one freeze): A sweeps [0, 0.5] and B [0.5, 1] side by side, always half a bar
   * apart, both moving right from the left end of their half, then both back.
   */
  cursorPosAt(t: number, hand = 0): number {
    if (this.hands < 2) return phaseToPos(this.phaseAt(t));
    const [lo, hi] = this.handRange(hand);
    return lo + (hi - lo) * phaseToPos(this.phaseAt(t));
  }

  /** The cursor's direction at sim time t: 1 = moving right, -1 = left (both of Sable's cursors move together). */
  cursorDirAt(t: number): number {
    return ((this.phaseAt(t) % 2) + 2) % 2 < 1 ? 1 : -1;
  }

  motionAt(t: number): number {
    if (t >= this.time) return this.motionTime + this.motionVelNow() * (t - this.time);
    const i = this.histIndex(t);
    return this.hMotion[i] + this.hMotionVel[i] * Math.max(0, t - this.hT[i]);
  }

  blockPosAt(b: Block, t: number): number {
    const p = b.pos + b.vel * (this.motionAt(t) - this.motionTime);
    return Math.min(1 - b.width / 2, Math.max(b.width / 2, p));
  }

  // ---------------------------------------------------------------- stepping

  advanceTo(t: number): void {
    let guard = SIM_HZ * 5;
    while ((this.tick + 1) * DT <= t + 1e-9 && guard-- > 0) this.step();
  }

  step(): void {
    this.tick++;
    if (this.result) return this.record();
    if (this.rush > 0 && this.time >= this.rush - 1e-9) {
      // Coin Rush: time's up
      this.result = 'won';
      this.events.push({ type: 'won' });
      return this.record();
    }
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - DT);
      return this.record();
    }
    this.motionTime += DT;
    if (this.cursorHold > 0) {
      // stopped for the finisher; then back to the start, moving right
      this.cursorHold -= DT;
      if (this.cursorHold <= 1e-9) {
        this.cursorHold = 0;
        this.cursorPhase = 0;
        this.events.push({ type: 'cursorReset' });
      }
    } else if (this.freeze > 0) {
      // frozen by a Stomp: it stays where it is, then moves on
      this.freeze -= DT;
      if (this.freeze <= 1e-9) {
        this.freeze = 0;
        this.events.push({ type: 'thaw' });
      }
    } else this.cursorPhase += this.cursorSpeed() * DT;
    if (this.hero.abilityTimer > 0) this.hero.abilityTimer = Math.max(0, this.hero.abilityTimer - DT);
    if (this.tuskTimer > 0 && (this.tuskTimer -= DT) <= 1e-9) {
      this.tuskTimer = 0;
      this.tuskCrit = 0;
    }
    if (this.nextWaveIn >= 0 && (this.nextWaveIn -= DT) <= 1e-9) this.nextWave();
    for (const h of this.hooks) h.step?.(this);
    if (this.result) return this.record();
    this.updateBlocks();
    if (!this.result) this.updateStatuses();
    if (!this.result) this.updateQueue();
    if (this.specialsOn && !this.result) this.updateSpecials();
    if (this.spawning && !this.result) this.updateSpawners();
    this.record();
  }

  // ---------------------------------------------------------------- specials

  specialsOf(e: Enemy): SpecialDef[] {
    return this.tuning.enemies[e.key]?.specials ?? [];
  }

  /** Whether special `i` of enemy `e` can be used in the enemy's current phase. */
  inPhase(e: Enemy, i: number): boolean {
    const sp = this.specialsOf(e)[i];
    return !!sp && (!sp.phases || sp.phases.includes(e.phase));
  }

  /** Statuses run out: a raised guard drops, a shell with no ward blocks left ends, protection ends with its summons. */
  private updateStatuses(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.guard > 0) {
        e.guard -= DT;
        if (e.guard <= 1e-9) {
          e.guard = 0;
          this.events.push({ type: 'guardOff', enemyId: e.id });
        }
      }
      if (e.shell < 1 && !this.blocks.some((b) => b.kind === 'ward' && b.ownerId === e.id)) this.endShell(e);
      if (e.protect < 1 && !this.summonsAlive(e.id)) {
        e.protect = 1;
        this.events.push({ type: 'protectOff', enemyId: e.id });
      }
    }
  }

  /** Delayed formation blocks land (or wait for room). */
  private updateQueue(): void {
    for (const q of this.queue.slice()) {
      if (this.motionTime + 1e-9 < q.at) continue;
      const owner = this.enemyById(q.ownerId);
      if (!owner || !owner.alive) {
        this.queue.splice(this.queue.indexOf(q), 1);
        continue;
      }
      if (placeEntry(this, owner, q.entry, null) || q.tries++ >= 40) this.queue.splice(this.queue.indexOf(q), 1);
      else q.at = this.motionTime + 0.05; // no room yet (a red at the spawn point): try again shortly
    }
  }

  /** A telegraph counts down and fires; specials whose time has come start telegraphing. */
  private updateSpecials(): void {
    const tg = this.telegraph;
    if (tg) {
      const e = this.enemyById(tg.enemyId);
      if (!e || !e.alive) {
        this.telegraph = null;
        this.events.push({ type: 'tellCancel', enemyId: tg.enemyId });
      } else {
        tg.left -= DT;
        if (tg.left <= 1e-9) {
          this.telegraph = null;
          this.tellCooldown = this.tuning.specials.tellGap;
          this.useSpecial(e, tg.index);
        }
      }
    }
    if (this.tellCooldown > 0) this.tellCooldown = Math.max(0, this.tellCooldown - DT);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sps = this.specialsOf(e);
      for (let i = 0; i < sps.length; i++) {
        const sp = sps[i];
        if (!this.inPhase(e, i)) continue;
        if (sp.hpBelow !== undefined) {
          if (!e.uses[i] && e.hp < sp.hpBelow * e.maxHp && this.canTelegraph(e, i)) this.startTelegraph(e, i);
        } else if (sp.every !== undefined) {
          if (this.telegraph?.enemyId !== e.id) e.timers[i] -= DT;
          if (e.timers[i] <= 0 && this.canTelegraph(e, i)) this.startTelegraph(e, i);
        }
      }
    }
  }

  private canTelegraph(e: Enemy, i: number): boolean {
    if (this.telegraph || this.result) return false;
    // a boss phase change cuts in line; everything else waits for the gap after the last special
    const sp = this.specialsOf(e)[i];
    return this.tellCooldown <= 0 || !!sp?.gate;
  }

  /** Start winding up special `i`: the view shows the pose, the name and plays the sound; the actions follow. */
  startTelegraph(e: Enemy, i: number): void {
    const sp = this.specialsOf(e)[i];
    if (!sp || !e.alive) return;
    const sec = Math.max(0, sp.tell);
    this.telegraph = { enemyId: e.id, index: i, left: sec, total: sec };
    this.events.push({ type: 'telegraph', enemyId: e.id, special: sp.id, name: sp.name, sound: sp.sound, sec });
    if (sec <= 0) {
      this.telegraph = null;
      this.useSpecial(e, i);
    }
  }

  /** Fire special `i` now (after its telegraph; tests call it directly). */
  useSpecial(e: Enemy, i: number): void {
    const sp = this.specialsOf(e)[i];
    if (!sp || !e.alive || this.result) return;
    e.uses[i]++;
    if (sp.every !== undefined) {
      const j = this.tuning.specials.jitter;
      e.timers[i] = sp.every * (1 + j * (2 * this.spawnRng.next() - 1));
    }
    this.events.push({ type: 'special', enemyId: e.id, special: sp.id });
    fireSpecial(this, e, sp);
  }

  /** Random number from the fight's spawn stream (formation placement uses it). */
  rand(): number {
    return this.spawnRng.next();
  }

  /** Whether `id` has living linked summons. */
  summonsAlive(id: number): boolean {
    return this.enemies.some((x) => x.alive && x.summoner === id);
  }

  /** Heal an enemy (never above its max HP). */
  healEnemy(e: Enemy, amount: number): void {
    if (!e.alive) return;
    const heal = Math.min(e.maxHp - e.hp, Math.max(0, Math.round(amount)));
    if (heal <= 0) return;
    e.hp += heal;
    this.events.push({ type: 'enemyHeal', enemyId: e.id, amount: heal });
  }

  endShell(e: Enemy): void {
    if (e.shell >= 1) return;
    e.shell = 1;
    for (const b of this.blocks.slice()) if (b.kind === 'ward' && b.ownerId === e.id) this.removeBlock(b, 'owner');
    this.events.push({ type: 'shellOff', enemyId: e.id });
  }

  /** Remove an enemy without a kill (it split, or fled): its pending attacks go with it, or to `heir`. */
  retire(e: Enemy, how: 'split' | 'fled', heir?: Enemy): void {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    if (how === 'split') e.split = true;
    else e.fled = true;
    if (this.telegraph?.enemyId === e.id) this.telegraph = null;
    for (const b of this.blocks.slice()) {
      if (b.ownerId !== e.id || isAttack(b.kind)) continue;
      if (heir) b.ownerId = heir.id;
      else this.removeBlock(b, 'owner');
    }
    this.queue = this.queue.filter((q) => q.ownerId !== e.id || !!heir);
    for (const q of this.queue) if (q.ownerId === e.id && heir) q.ownerId = heir.id;
    if (how === 'fled') this.events.push({ type: 'flee', enemyId: e.id });
    this.checkWon();
  }

  private checkWon(): void {
    if (this.result || this.nextWaveIn >= 0 || !this.enemies.every((x) => !x.alive)) return;
    if (this.log.breaks === this.waveBreaks) this.log.cleanWaves++;
    this.waveBreaks = this.log.breaks;
    if (this.waveIndex < this.waves.length - 1) {
      // the wave fell: a short breath, then the next one walks in
      this.nextWaveIn = Math.max(0, this.tuning.waves.gapSec);
      this.events.push({ type: 'waveClear', index: this.waveIndex });
      return;
    }
    this.result = 'won';
    this.events.push({ type: 'won' });
  }

  /** The next wave walks in (its foes take the front slots). */
  private nextWave(): void {
    this.nextWaveIn = -1;
    this.waveIndex++;
    this.telegraph = null;
    const ids: number[] = [];
    this.waves[this.waveIndex].forEach((key, slot) => {
      const e = this.makeEnemy(key, slot);
      e.member = true;
      this.enemies.push(e);
      ids.push(e.id);
    });
    this.groupFight = ids.length > 1;
    this.events.push({ type: 'wave', index: this.waveIndex, total: this.waves.length, ids });
  }

  /** Every foe in the fight's waves (summons and splits not counted). */
  get foesTotal(): number {
    return this.waves.reduce((n, w) => n + w.length, 0);
  }

  /** Foes beaten so far: gone (killed, fled, or split with none of its pieces left). */
  get foesBeaten(): number {
    const lives = (id: number): boolean => this.enemies.some((x) => x.alive && (x.id === id || (x.parent !== 0 && this.descends(x, id))));
    return this.beatenBefore + this.enemies.filter((e) => e.member && !lives(e.id)).length;
  }

  private descends(e: Enemy, ancestor: number): boolean {
    for (let p = e.parent, guard = 0; p && guard < 16; guard++) {
      if (p === ancestor) return true;
      p = this.enemyById(p)?.parent ?? 0;
    }
    return false;
  }

  private updateBlocks(): void {
    const B = this.tuning.blocks;
    for (const b of this.blocks.slice()) {
      if (this.result) return;
      if (!this.blocks.includes(b)) continue; // gone mid-loop (a blast that reached the hero, a revive)
      if (isRed(b.kind)) {
        const half = b.width / 2;
        if (b.push > 0) {
          // Pushed back (finisher or shield knockback): slide right, then resume the normal leftward travel.
          const d = Math.min(b.push, b.pushSpeed * DT);
          b.push -= d;
          if (b.push < 1e-9) b.push = 0;
          b.pos = Math.min(1 - half, b.pos + d);
          b.vel = b.push > 0 ? b.pushSpeed : this.redVel(b.width, b.speed);
        } else if (b.impactTimer < 0) {
          b.vel = this.redVel(b.width, b.speed);
          b.pos += b.vel * DT;
          if (b.pos <= half) {
            b.pos = half;
            b.vel = 0;
            b.impactTimer = B.impactGraceMs / 1000;
          }
        } else {
          b.impactTimer -= DT;
          if (b.impactTimer <= 1e-9) this.impact(b);
        }
      } else if (b.life !== Infinity) {
        b.life -= DT;
        if (b.life <= 0) {
          this.removeBlock(b, 'expire');
          if (b.kind === 'spore') this.sporeHeal(b);
        }
      }
    }
  }

  /** Red travel velocity (bar units per second, leftward) for a block of width w at `speed` times normal (and the
   *  act's red speed). */
  redVel(w: number, speed = 1): number {
    return (-(1 - w) / this.tuning.blocks.redTravelSec) * Math.max(0.1, speed) * this.redSpeed;
  }

  /** A spore left unbroken: its enemy and that enemy's allies heal. */
  private sporeHeal(b: Block): void {
    const owner = this.enemyById(b.ownerId);
    if (!owner || !owner.alive || b.heal <= 0) return;
    this.events.push({ type: 'sporeHeal', pos: b.pos, enemyId: owner.id });
    for (const e of this.enemies) if (e.alive) this.healEnemy(e, e.maxHp * b.heal);
  }

  private impact(b: Block): void {
    this.removeBlock(b, 'impact');
    if (this.claim((h) => h.impact?.(this, b))) return;
    const owner = this.enemyById(b.ownerId);
    const atk = owner ? owner.atk : 0;
    const bomb = b.kind === 'bomb';
    this.heroDamage(atk * (bomb ? this.tuning.blocks.bombHitMult : 1), bomb ? 'bomb' : 'red', b.ownerId);
  }

  private updateSpawners(): void {
    const B = this.tuning.blocks;
    const groupMult = this.groupFight ? B.groupSpawnMult : 1;
    // Keep the bar stocked: a fast player should never stare at an empty bar.
    this.refillTimer -= DT;
    if (this.refillTimer <= 0) {
      const attacks = this.blocks.reduce((n, b) => n + (isAttack(b.kind) ? 1 : 0), 0);
      const front = this.frontEnemy();
      if (front && attacks < B.minAttack && this.trySpawn('yellow', front.id)) this.refillTimer = 0.12;
    }
    for (const e of this.enemies) {
      if (!e.alive || this.telegraph?.enemyId === e.id) continue; // busy winding up a special
      e.spawnTimer -= DT;
      if (e.spawnTimer > 0) continue;
      const def = this.tuning.enemies[e.key];
      if (!def.pattern.length) {
        e.spawnTimer = 1;
        continue;
      }
      const kind = CODE_KIND[def.pattern[e.seq % def.pattern.length] as BlockCode];
      if (!kind) {
        e.seq++;
        continue;
      }
      if (this.trySpawn(kind, e.id)) {
        e.seq++;
        e.spawnTimer = Math.max(e.spawnTimer, 0) + def.interval * B.spawnRateMult * groupMult * this.pace;
      } else if (isRed(kind)) {
        e.spawnTimer = 0.1; // spawn point busy or too many reds: retry shortly
      } else {
        e.seq++; // bar full of static blocks: skip this one
        e.spawnTimer = 0.15;
      }
    }
  }

  /** Spawn a block from a pattern (random free position for static blocks, right end for reds), at a random width. */
  trySpawn(kind: BlockKind, ownerId: number): boolean {
    const B = this.tuning.blocks;
    for (const h of this.hooks) if (h.spawnKind) kind = h.spawnKind(this, kind, ownerId);
    // blocks come in varied widths: some small, some big, for every kind
    const [vLo, vHi] = isRed(kind) ? [B.redWidthMin, B.redWidthMax] : [B.widthMin, B.widthMax];
    const w = this.widthFor(kind) * this.spawnRng.range(Math.min(vLo, vHi), Math.max(vLo, vHi));
    if (isRed(kind)) {
      const reds = this.blocks.filter((b) => isRed(b.kind));
      if (reds.length >= B.maxRed) return false;
      const p = 1 - w / 2;
      if (reds.some((r) => Math.abs(r.pos - p) < (r.width + w) / 2 + B.minGap)) return false;
      this.spawnBlock(kind, p, ownerId, w);
      return true;
    }
    const statics = this.blocks.filter((b) => !isRed(b.kind));
    if (statics.length >= B.maxStatic) return false;
    const p = this.freeSpot(w);
    if (p === null) return false;
    this.spawnBlock(kind, p, ownerId, w);
    return true;
  }

  /**
   * A random spot (block center) where a static block of width w fits without touching the others, or null.
   * Sable's bar: inside one half, never straddling the middle (each half keeps its own edge margins, scaled to the
   * half); the half with fewer yellows and greens gets it, so both thumbs stay busy (a coin flip when even).
   */
  freeSpot(w: number, tries = 16): number | null {
    const B = this.tuning.blocks;
    const statics = this.blocks.filter((b) => !isRed(b.kind));
    if (this.hands > 1) return this.freeSpotTwin(statics, w, tries);
    const lo = B.edgeMargin + w / 2;
    const hi = 1 - B.edgeMargin - w / 2;
    if (hi < lo) return null;
    for (let k = 0; k < tries; k++) {
      const p = this.spawnRng.range(lo, hi);
      if (statics.every((s) => Math.abs(s.pos - p) >= (s.width + w) / 2 + B.minGap)) return p;
    }
    return null;
  }

  private freeSpotTwin(statics: Block[], w: number, tries: number): number | null {
    const B = this.tuning.blocks;
    const span = this.handSpan(0);
    const margin = B.edgeMargin * span;
    const gap = B.minGap * span;
    const count = (h: number) => statics.reduce((n, s) => n + (isAttack(s.kind) && this.handOf(s.pos) === h ? 1 : 0), 0);
    const c0 = count(0);
    const c1 = count(1);
    const first = c0 === c1 ? (this.spawnRng.next() < 0.5 ? 0 : 1) : c0 < c1 ? 0 : 1;
    for (const h of [first, 1 - first]) {
      const [a, b] = this.handRange(h);
      const lo = a + margin + w / 2;
      const hi = b - margin - w / 2;
      if (hi < lo) continue;
      for (let k = 0; k < tries; k++) {
        const p = this.spawnRng.range(lo, hi);
        if (statics.every((s) => Math.abs(s.pos - p) >= (s.width + w) / 2 + gap)) return p;
      }
    }
    return null;
  }

  /** Sable's bar: a static block centred at `pos` moved (if it has to be) to sit wholly inside the half its centre is
   *  in, clear of the middle (specials place some by position: beside a yellow, or at a set spot). */
  private inHalf(pos: number, w: number): number {
    const m = this.tuning.blocks.edgeMargin * this.handSpan(0) * 0.5;
    return this.handOf(pos) === 0 ? Math.min(0.5 - m - w / 2, pos) : Math.max(0.5 + m + w / 2, pos);
  }

  /** A kind's base width (spawns vary around it, see trySpawn). Sable's bar: x tuning.sable.widthMult (statics) or
   *  redWidthMult (reds), so her half-speed cursors cross a block in about the time Rowan's does. */
  widthFor(kind: BlockKind): number {
    const B = this.tuning.blocks;
    const w = isRed(kind) ? B.redWidth : kind === 'purple' ? B.trapWidth : kind === 'green' ? B.greenWidth : B.attackWidth;
    if (this.hands < 2) return w;
    return w * (isRed(kind) ? this.tuning.sable.redWidthMult : this.tuning.sable.widthMult);
  }

  /** Queue a formation block to land after `delay` seconds (motion time). */
  enqueue(ownerId: number, entry: FormationEntry, delay: number): void {
    this.queue.push({ at: this.motionTime + Math.max(0, delay), ownerId, entry, tries: 0 });
  }

  /** Place a block directly (also used by tests and the debug panel). Width defaults to the kind's base width. */
  spawnBlock(
    kind: BlockKind,
    pos: number,
    ownerId: number = this.enemies[0]?.id ?? 0,
    width = this.widthFor(kind),
    o: { speed?: number; taps?: number; life?: number; heal?: number; special?: boolean } = {},
  ): Block {
    const B = this.tuning.blocks;
    const speed = o.speed ?? 1;
    if (this.hands > 1 && !isRed(kind)) pos = this.inHalf(pos, width);
    const b: Block = {
      id: this.nextId++,
      kind,
      ownerId,
      pos: Math.min(1 - width / 2, Math.max(width / 2, pos)),
      width,
      vel: isRed(kind) ? this.redVel(width, speed) : 0,
      taps: o.taps ?? (kind === 'shield' ? Math.max(1, Math.round(B.shieldHits)) : 1),
      bornAt: this.time,
      life: o.life ?? (kind === 'purple' ? B.trapLifeSec : isAttack(kind) && B.attackLifeSec > 0 ? B.attackLifeSec : Infinity),
      impactTimer: -1,
      push: 0,
      pushSpeed: 0,
      speed,
      heal: o.heal ?? 0,
    };
    for (const h of this.hooks) h.spawned?.(this, b);
    this.blocks.push(b);
    this.events.push({ type: 'spawn', id: b.id, kind: b.kind, ownerId, special: !!o.special });
    if (isRed(kind) && !o.special) this.events.push({ type: 'windup', enemyId: ownerId });
    return b;
  }

  removeBlock(b: Block, reason: RemoveReason): void {
    const i = this.blocks.indexOf(b);
    if (i < 0) return;
    this.blocks.splice(i, 1);
    this.events.push({ type: 'remove', id: b.id, kind: b.kind, pos: b.pos, width: b.width, ownerId: b.ownerId, reason });
  }

  // ---------------------------------------------------------------- input

  /**
   * Judge a bar tap that happened at sim time `t` (already corrected by calibration).
   * Positions are rewound to `t`; effects apply to the current state.
   */
  tap(t: number, hand = 0): TapResult {
    hand = this.hands < 2 ? 0 : hand > 0 ? 1 : 0;
    const none: TapResult = { outcome: 'none', perfect: false, cursorPos: 0, blockId: 0, hand };
    if (this.result || this.cursorHold > 0) return none; // taps don't count while the finisher has the cursors stopped
    this.tapAt = this.clampTap(t);
    try {
      return this.judge(t, hand);
    } finally {
      this.tapAt = NaN;
    }
  }

  private judge(t: number, hand: number): TapResult {
    const J = this.tuning.judge;
    const { chosen, d, cpos } = this.pick(t, hand);
    this.recordAim(t, chosen, cpos, hand);
    if (!chosen) {
      this.miss(cpos, hand);
      return { outcome: 'miss', perfect: false, cursorPos: cpos, blockId: 0, hand };
    }
    const perfect = d <= (J.perfectFrac * chosen.width) / 2;
    let outcome: TapOutcome;
    if (chosen.kind === 'purple') outcome = this.triggerTrap(chosen);
    else if (isRed(chosen.kind)) outcome = this.blockRed(chosen, perfect, hand);
    else if (chosen.kind === 'yellow' && this.guarder()) outcome = this.counter(chosen);
    else if (chosen.kind === 'ward') outcome = this.breakWard(chosen, perfect, hand);
    else outcome = this.hitAttack(chosen, perfect, hand);
    return { outcome, perfect: outcome === 'trap' || outcome === 'counter' ? false : perfect, cursorPos: cpos, blockId: chosen.id, hand };
  }

  /** A tap's time as the judge uses it: no further back than maxRewindMs, no later than the next tick. */
  private clampTap(t: number): number {
    const now = this.time;
    return Math.min(now + DT, Math.max(now - this.tuning.judge.maxRewindMs / 1000, t));
  }

  /**
   * The block a tap at time t would land on: an attack (a red, shield, bomb or speed block) under the cursor always
   * comes first, even over a nearer block, so a tap never hits a yellow while an attack it overlaps gets through;
   * then the nearest other block; a purple trap only if nothing else is there.
   */
  private pick(t: number, hand = 0): { chosen: Block | null; d: number; cpos: number } {
    const r = this.reach(t, hand);
    if (r.red) return { chosen: r.red, d: r.redD, cpos: r.cpos };
    if (r.best) return { chosen: r.best, d: r.bestD, cpos: r.cpos };
    return { chosen: r.trap, d: r.trapD, cpos: r.cpos };
  }

  /**
   * What cursor `hand` reaches at time t (rewound like a tap): the nearest attack (red, shield, bomb, speed), the
   * nearest other block (and the nearest yellow/green among those), the nearest trap. Sable's cursors reach the
   * static blocks of their own half only; a red is fair game for whichever cursor it is under.
   */
  private reach(t: number, hand: number) {
    const J = this.tuning.judge;
    t = this.clampTap(t);
    const phase = this.phaseAt(t);
    const cpos = this.cursorPosAt(t, hand);
    // the grace is a time window: it scales with the speed the cursor and the block close at (a red racing at
    // the cursor gets as many milliseconds as a still yellow; never less space than the cursor's own speed gives)
    const span = this.handSpan(hand);
    const v = this.speedAtTime(t) * span;
    const vSigned = ((phase % 2) + 2) % 2 < 1 ? v : -v;
    const cursorHalf = (this.tuning.cursor.widthFrac * span) / 2;
    const twin = this.hands > 1;
    let red: Block | null = null;
    let redD = Infinity;
    let best: Block | null = null;
    let bestD = Infinity;
    let attack: Block | null = null;
    let attackD = Infinity;
    let trap: Block | null = null;
    let trapD = Infinity;
    for (const b of this.blocks) {
      if (b.bornAt > t + 1e-9) continue;
      if (twin && !isRed(b.kind) && this.handOf(b.pos) !== hand) continue;
      const d = Math.abs(cpos - this.blockPosAt(b, t));
      const graceDist = Math.max(v, Math.abs(vSigned - b.vel)) * ((isRed(b.kind) ? J.redGraceMs : J.graceMs) / 1000);
      if (d > b.width / 2 + cursorHalf + graceDist) continue;
      if (isRed(b.kind)) {
        if (d < redD) (red = b), (redD = d);
      } else if (b.kind === 'purple') {
        if (d < trapD) (trap = b), (trapD = d);
      } else {
        if (d < bestD) (best = b), (bestD = d);
        if (isAttack(b.kind) && d < attackD) (attack = b), (attackD = d);
      }
    }
    return { cpos, red, redD, best, bestD, attack, trap, trapD };
  }

  /**
   * The red and the yellow/green under cursor `hand` at time t (default: the tap being judged, else now), by the
   * judge's reach; never a trap. Perks that strike under the other cursor use it (Shadow Step, Cross Guard).
   */
  underCursor(hand: number, t = Number.isNaN(this.tapAt) ? this.time : this.tapAt): { red: Block | null; attack: Block | null } {
    const r = this.reach(t, this.hands < 2 ? 0 : hand > 0 ? 1 : 0);
    return { red: r.red, attack: r.attack };
  }

  /**
   * The tap's timing error against the yellow block it was aimed at (the one it hit, or for a miss the nearest
   * block if that's a yellow): ms after (+) or before (-) the cursor crossed the block's center. Sable: against
   * the cursor of the hand that tapped, among the blocks that cursor can reach.
   */
  private recordAim(t: number, chosen: Block | null, cpos: number, hand = 0): void {
    t = this.clampTap(t);
    const v = this.speedAtTime(t) * this.handSpan(hand);
    if (v <= 0 || this.freeze > 0) return;
    // where a block stands as this cursor sees it: Sable's two halves laid over each other (the cursors run side by
    // side, half a bar apart), so the readout picks clear-cut samples from as busy a bar as Rowan's
    const twin = this.hands > 1;
    const seen = (b: Block) => {
      const p = this.blockPosAt(b, t);
      return !twin || this.handOf(p) === hand ? p : p + (hand > 0 ? 0.5 : -0.5);
    };
    let target: Block | null = chosen;
    if (!target) {
      let best = Infinity;
      for (const b of this.blocks) {
        if (b.bornAt > t + 1e-9) continue;
        const dd = Math.abs(cpos - seen(b));
        if (dd < best) (best = dd), (target = b);
      }
    }
    if (!target || target.kind !== 'yellow' || (twin && this.handOf(target.pos) !== hand)) return;
    const phase = ((this.phaseAt(t) % 2) + 2) % 2;
    const dir = phase < 1 ? 1 : -1;
    const err = ((cpos - this.blockPosAt(target, t)) * dir) / v;
    // only clear-cut samples: a yellow with no other block (or wall turn) near it, so the tap can't have been
    // meant for something else
    const tp = this.blockPosAt(target, t);
    const [lo, hi] = this.handRange(hand);
    if ((Math.min(tp - lo, hi - tp) / v) * 1000 < ISOLATION_MS) return;
    for (const b of this.blocks) if (b !== target && b.bornAt <= t + 1e-9 && (Math.abs(seen(b) - tp) / v) * 1000 < ISOLATION_MS) return;
    if (Math.abs(err) * 1000 <= AIM_WINDOW_MS) this.aims.push(Math.round(err * 1000));
  }

  /** Whether a tap at time t would land on nothing (lets input hold back a would-be miss that may be a swipe). */
  wouldMiss(t: number, hand = 0): boolean {
    return !this.result && this.cursorHold <= 0 && !this.pick(t, this.hands < 2 ? 0 : hand > 0 ? 1 : 0).chosen;
  }

  /** Cursor speed (passes/s, as cursorSpeed; x handSpan for bar units/s) that was in effect at time t. */
  private speedAtTime(t: number): number {
    if (t >= this.time) return this.cursorSpeed();
    const i = this.histIndex(t);
    return this.hPhaseVel[i] || this.cursorSpeed();
  }

  private hitAttack(b: Block, perfect: boolean, hand = 0, echo = false): TapOutcome {
    const T = this.tuning;
    const H = this.hero;
    const st = heroStats(T, H);
    this.removeBlock(b, 'hit');
    const green = b.kind === 'green';
    const alternated = this.hands > 1 && !echo && this.lastHand >= 0 && this.lastHand !== hand;
    if (!echo) {
      this.lastHand = hand;
      if (this.hands > 1) this.altStreak = alternated ? this.altStreak + 1 : 1;
    }
    const target = this.currentTarget();
    const x: HitCtx = { block: b, hand, perfect, green, target, crit: false, damage: 0, alternated, echo };
    const outer = this.hitNow; // an echo resolves inside the hit that caused it
    this.hitNow = x;
    this.comboUp('hit', perfect, hand);
    this.addMeter((green ? T.meter.perGreen : T.meter.perHit) + (perfect ? T.meter.perfectBonus : 0), green ? 'green' : 'hit', hand);
    let mult = green ? T.hero.greenMult : 1;
    if (this.settings.comboTiers) mult *= tierMult(T, this.combo);
    const critChance = this.mod(st.critChance + (perfect ? T.hero.perfectCritBonus : 0) + this.tuskCrit, (h, v) => h.critChance?.(this, x, v));
    let crit = this.critRng.next() < critChance;
    if (target && this.has('opener') && !this.struck.has(target.id)) {
      // Opening Blow: the first hit on each foe always crits
      if (!crit) this.events.push({ type: 'gearFx', fx: 'opener', amount: 0, enemyId: target.id });
      crit = true;
    }
    if (target) this.struck.add(target.id);
    x.crit = crit;
    if (crit) mult *= this.mod(st.critDmg, (h, v) => h.critMult?.(this, x, v));
    mult = this.mod(mult, (h, v) => h.hitMult?.(this, x, v));
    const damage = Math.max(1, Math.round(st.atk * mult));
    x.damage = damage;
    this.events.push({ type: 'hit', kind: b.kind, pos: b.pos, perfect, crit, damage, enemyId: target?.id ?? 0, combo: this.combo, hand, echo });
    if (this.rush) this.rushPay(this.rushHitCoins(perfect));
    if (crit && this.has('leech')) this.healHero(this.tuning.effects.leechHp, 'leech');
    if (green) {
      H.abilityTimer = this.abilitySec();
      this.events.push({ type: 'ability' });
    }
    if (crit) this.startHitStop();
    if (target) this.damageEnemy(target, damage, crit, 'hit');
    if (!echo) this.companionTick();
    this.pendulumTick();
    for (const h of this.hooks) h.afterHit?.(this, x);
    this.hitNow = outer;
    return 'hit';
  }

  /** How long the green ability lasts (Rowan's Battle Focus, Sable's Shadow Step). */
  abilitySec(): number {
    return this.hands > 1 ? this.tuning.sable.shadowSec : this.tuning.hero.abilitySec;
  }

  /** Start the green ability without a green hit (Whirling Blades starts Shadow Step). */
  startAbility(): void {
    this.hero.abilityTimer = Math.max(this.hero.abilityTimer, this.abilitySec());
    this.events.push({ type: 'ability' });
  }

  /** The combo goes up (normally by 1; perks may change that), and perks that watch it hear about it. */
  private comboUp(from: 'hit' | 'block' | 'ward', perfect: boolean, hand: number): void {
    const before = this.combo;
    const n = Math.max(0, Math.round(this.mod(1, (h, v) => h.comboGain?.(this, from, perfect, hand, v))));
    this.combo += n;
    this.log.bestCombo = Math.max(this.log.bestCombo, this.combo);
    if (this.combo > before) for (const h of this.hooks) h.combo?.(this, before, this.combo);
  }

  /** Whether the hero's gear has a unique effect. */
  has(e: EffectId): boolean {
    return hasEffect(this.hero.gear, e);
  }

  /** Heal the hero (gear effects), up to max HP. */
  private healHero(amount: number, fx: EffectId): void {
    const H = this.hero;
    const heal = Math.min(heroMaxHp(this.tuning, H) - H.hp, Math.max(0, Math.round(amount)));
    if (heal <= 0 || H.hp <= 0) return;
    H.hp += heal;
    this.events.push({ type: 'gearFx', fx, amount: heal, enemyId: 0 });
  }

  /** Pendulum Shard: every Nth combo hit spawns a green block. */
  private pendulumTick(): void {
    const n = Math.max(2, Math.round(this.tuning.effects.pendulumEvery));
    if (!this.has('pendulum') || this.combo <= 0 || this.combo % n !== 0) return;
    const front = this.frontEnemy();
    if (front && this.trySpawn('green', front.id)) this.events.push({ type: 'gearFx', fx: 'pendulum', amount: 0, enemyId: 0 });
  }

  private blockRed(b: Block, perfect: boolean, hand = 0, echo = false): TapOutcome {
    const T = this.tuning;
    const owner = this.enemyById(b.ownerId);
    this.comboUp('block', perfect, hand);
    this.addMeter(T.meter.perBlock + (perfect ? T.meter.perfectBonus : 0), 'block', hand);
    if (this.has('golemheart')) this.healHero(T.effects.golemHeal, 'golemheart');
    if (b.taps > 1) {
      b.taps--;
      const knock = this.knockBack(b, T.blocks.shieldKnockback, T.blocks.knockbackSec);
      this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: true, ownerId: b.ownerId, combo: this.combo, knock, hand, echo });
      this.pendulumTick();
      for (const h of this.hooks) h.afterBlock?.(this, { block: b, hand, perfect, cracked: true, owner, echo });
      return 'crack';
    }
    this.removeBlock(b, 'hit');
    this.log.blocks++;
    this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: false, ownerId: b.ownerId, combo: this.combo, knock: 0, hand, echo });
    this.pendulumTick();
    if (owner?.alive && this.has('riposte') && b.kind !== 'bomb') {
      // Riposte: the blocked blow goes back at its owner
      const dmg = Math.max(1, Math.round(heroAtk(T, this.hero) * T.effects.riposte));
      this.events.push({ type: 'gearFx', fx: 'riposte', amount: dmg, enemyId: owner.id });
      this.damageEnemy(owner, dmg, false, 'bomb');
    }
    if (b.kind === 'speed') {
      this.speedStacks++;
      this.events.push({ type: 'speedUp', mult: this.speedMult() });
    }
    if (b.kind === 'bomb') this.explode(b);
    for (const h of this.hooks) h.afterBlock?.(this, { block: b, hand, perfect, cracked: false, owner, echo });
    return 'block';
  }

  private explode(bomb: Block): void {
    const r = this.tuning.blocks.bombRadius;
    this.events.push({ type: 'explode', pos: bomb.pos, radius: r });
    const cleared: Block[] = [];
    for (const o of this.blocks.slice()) {
      if (Math.abs(o.pos - bomb.pos) <= r) {
        this.removeBlock(o, 'bomb');
        cleared.push(o);
      }
    }
    // Captain's Cutlass: bombs you tap always crit
    const crit = this.has('cutlass');
    const dmg = Math.round(this.tuning.blocks.bombDamage * (crit ? heroStats(this.tuning, this.hero).critDmg : 1));
    if (crit) this.events.push({ type: 'gearFx', fx: 'cutlass', amount: dmg, enemyId: 0 });
    if (dmg > 0) for (const e of this.enemies) if (e.alive) this.damageEnemy(e, dmg, crit, 'bomb');
    for (const h of this.hooks) h.explode?.(this, bomb, cleared);
  }

  /**
   * Knock a red block back to the right by `dist` (bar units) over `sec`, stopping short of the next red block
   * behind it. Returns the distance it will travel.
   */
  private knockBack(b: Block, dist: number, sec: number): number {
    const gap = this.tuning.blocks.minGap;
    let limit = 1 - b.width / 2;
    for (const o of this.blocks) {
      if (o === b || !isRed(o.kind)) continue;
      const oPos = o.pos + o.push;
      if (oPos > b.pos) limit = Math.min(limit, oPos - (o.width + b.width) / 2 - gap);
    }
    const target = Math.max(b.pos, Math.min(b.pos + b.push + dist, limit));
    const moved = target - b.pos;
    b.impactTimer = -1;
    b.push = moved;
    if (sec > 0 && b.push > 0) {
      b.pushSpeed = dist / sec;
      b.vel = b.pushSpeed;
    } else {
      b.pos = target;
      b.push = 0;
      b.vel = this.redVel(b.width, b.speed);
    }
    return moved;
  }

  /** The living enemy whose shield is raised (Guard), if any. */
  guarder(): Enemy | null {
    return this.enemies.find((e) => e.alive && e.guard > 0) ?? null;
  }

  /** A yellow tapped while a shield is raised: countered like a purple trap. */
  private counter(b: Block): TapOutcome {
    const g = this.guarder()!;
    this.removeBlock(b, 'counter');
    this.events.push({ type: 'counter', pos: b.pos, damage: g.special, enemyId: g.id });
    this.heroDamage(g.special, 'counter', g.id);
    return 'counter';
  }

  /** A shell block broken: counts toward the combo; when the last one goes, the shell is off. */
  private breakWard(b: Block, perfect: boolean, hand = 0): TapOutcome {
    const T = this.tuning;
    this.removeBlock(b, 'hit');
    this.comboUp('ward', perfect, hand);
    this.addMeter(T.meter.perHit + (perfect ? T.meter.perfectBonus : 0), 'ward', hand);
    const left = this.blocks.filter((x) => x.kind === 'ward' && x.ownerId === b.ownerId).length;
    this.events.push({ type: 'wardBreak', pos: b.pos, enemyId: b.ownerId, left, perfect, combo: this.combo });
    const owner = this.enemyById(b.ownerId);
    if (owner && left === 0) this.endShell(owner);
    return 'ward';
  }

  private triggerTrap(b: Block): TapOutcome {
    this.removeBlock(b, 'hit');
    if (this.claim((h) => h.trap?.(this, b))) return 'trap';
    const owner = this.enemyById(b.ownerId);
    const damage = owner ? owner.special : 0;
    this.events.push({ type: 'trap', pos: b.pos, damage, enemyId: b.ownerId });
    this.heroDamage(damage, 'trap', b.ownerId);
    return 'trap';
  }

  private miss(pos: number, hand = 0): void {
    this.altStreak = 0;
    if (!this.missForgiven && setPieces(this.hero.gear, 'footpad') >= 2) {
      // Footpad set: the fight's first miss doesn't break the combo (or hurt)
      this.missForgiven = true;
      this.events.push({ type: 'miss', pos, selfDamage: false, hand });
      this.events.push({ type: 'gearFx', fx: 'footpad', amount: 0, enemyId: 0 });
      return;
    }
    const classic = this.settings.mode === 'classic';
    const x: MissCtx = { hand, damage: classic && !this.rush ? this.tuning.judge.missSelfDamage : 0, breaks: true };
    for (const h of this.hooks) h.miss?.(this, x);
    this.events.push({ type: 'miss', pos, selfDamage: x.damage > 0, hand });
    if (x.damage > 0) this.heroDamage(x.damage, 'miss', 0, !x.breaks);
    else if (x.breaks) this.breakCombo();
  }

  /** Damage the finisher would deal right now (0 if no stacks are banked). */
  finisherDamage(stacks = this.stacks): number {
    if (stacks < 1) return 0;
    const T = this.tuning;
    const st = heroStats(T, this.hero);
    let dmg = st.atk * st.comboPower * Math.pow(stacks, T.meter.stackExp);
    if (this.settings.comboTiers) dmg *= tierMult(T, this.combo);
    return Math.round(dmg);
  }

  /** Fire the finisher with every banked stack. */
  finisher(): boolean {
    if (!this.finisherReady) return false;
    const combo = this.combo;
    const stacks = this.stacks;
    const x: FinisherCtx = { stacks, combo, damage: this.finisherDamage(stacks), targets: this.enemies.filter((e) => e.alive), killed: 0, keepCombo: false };
    const dmg = Math.round(x.damage * this.mod(1, (h, v) => h.finisher?.(this, x, v)));
    x.damage = dmg;
    // Every red block on the bar is knocked off it; the enemies keep attacking on their normal schedule.
    for (const b of this.blocks.slice()) if (isRed(b.kind)) this.removeBlock(b, 'finisher');
    this.meter = 0;
    this.stacks = 0;
    if (!x.keepCombo) {
      this.combo = 0;
      this.speedStacks = 0;
    }
    this.events.push({ type: 'finisher', damage: dmg, combo, stacks, targets: x.targets.map((e) => e.id) });
    if (this.has('tuskCrown') && stacks > 0) {
      // Tusk Crown: every stack spent adds crit for a few seconds
      this.tuskCrit = this.tuning.effects.tuskCrit * stacks;
      this.tuskTimer = this.tuning.effects.tuskSec;
      this.events.push({ type: 'gearFx', fx: 'tuskCrown', amount: Math.round(this.tuskCrit * 100), enemyId: 0 });
    }
    // the cursor stops while the finisher plays out, then restarts from the left
    this.cursorHold = (finisherShowMs(stacks) / 1000) * Math.max(0, this.tuning.meter.finisherHold);
    this.startHitStop();
    if (dmg > 0)
      for (const e of x.targets)
        if (e.alive) {
          this.damageEnemy(e, dmg, false, 'finisher');
          if (!e.alive) x.killed++;
        }
    for (const h of this.hooks) h.afterFinisher?.(this, x);
    if (this.rush && stacks > 0) this.rushPay(Math.round(this.tuning.rush.perStack * stacks));
    return true;
  }

  /** Coin Rush: the coins a hit knocks out (more the longer the combo, a little more for a perfect). */
  rushHitCoins(perfect: boolean): number {
    const R = this.tuning.rush;
    return Math.max(0, Math.round(R.perHit + Math.floor(this.combo / Math.max(1, R.comboStep)) + (perfect ? R.perfect : 0)));
  }

  private rushPay(n: number): void {
    if (n <= 0) return;
    this.rushCoins += n;
    this.awardCoins(n, 'rush');
  }

  get finisherReady(): boolean {
    return this.stacks >= 1 && !this.result && this.enemies.some((e) => e.alive); // not between waves: it would hit nobody
  }

  // ---------------------------------------------------------------- targeting

  frontEnemy(): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) if (e.alive && (!best || e.slot < best.slot)) best = e;
    return best;
  }

  currentTarget(): Enemy | null {
    if (this.settings.targeting === 'tap' && this.targetId !== null) {
      const e = this.enemyById(this.targetId);
      if (e && e.alive) return e;
    }
    return this.frontEnemy();
  }

  setTarget(enemyId: number): boolean {
    const e = this.enemyById(enemyId);
    if (!e || !e.alive) return false;
    this.targetId = enemyId;
    return true;
  }

  enemyById(id: number): Enemy | undefined {
    return this.enemies.find((e) => e.id === id);
  }

  // ---------------------------------------------------------------- damage

  /** Fill the meter; every time it fills, bank a stack (up to meter.maxStacks; the last one stays full). */
  private addMeter(x: number, source: MeterSource = 'perk', hand = 0): void {
    const max = this.maxStacks();
    x = this.mod(x, (h, v) => h.meter?.(this, source, v, hand));
    if (this.stacks >= max) {
      this.meter = 1;
      return;
    }
    if (x <= 0) return;
    this.meter += x * (1 + Math.max(0, heroStats(this.tuning, this.hero).meterGain));
    while (this.meter >= 1 - 1e-9 && this.stacks < max) {
      this.stacks++;
      this.meter = this.stacks >= max ? 1 : Math.max(0, this.meter - 1);
      this.events.push({ type: 'meterFull', stacks: this.stacks });
    }
  }

  private startHitStop(): void {
    const s = this.tuning.juice.hitStopMs / 1000;
    if (s <= 0) return;
    this.hitStop = Math.max(this.hitStop, s);
    this.events.push({ type: 'hitStop', ms: this.tuning.juice.hitStopMs });
  }

  /** A miss or a hit taken breaks the combo and loses every banked stack and the meter (perks may keep some). */
  private breakCombo(): void {
    this.log.breaks++;
    const x: BreakCtx = { combo: this.combo, stacks: this.stacks, meter: this.meter, keepCombo: 0, keepStacks: 0, keepMeter: 0 };
    for (const h of this.hooks) h.comboBreak?.(this, x);
    const combo = Math.max(0, Math.min(this.combo, Math.round(x.keepCombo)));
    const stacks = Math.max(0, Math.min(this.stacks, Math.round(x.keepStacks)));
    const meter = Math.max(0, Math.min(this.meter, x.keepMeter));
    if (this.combo > combo || this.stacks > stacks || this.meter > meter) this.events.push({ type: 'comboBreak', lost: this.combo - combo, lostStacks: this.stacks - stacks });
    this.combo = combo;
    this.meter = stacks >= this.maxStacks() ? 1 : meter;
    this.stacks = stacks;
    this.altStreak = 0;
  }

  private heroDamage(amount: number, source: HurtSource, enemyId: number, keepCombo = false, perk?: string): void {
    const H = this.hero;
    // Defense cuts the damage of reds (and bombs) that got through
    const cut = source === 'red' || source === 'bomb' ? afterDefense(this.tuning, amount, heroStats(this.tuning, H).def) : amount;
    const hooked = this.mod(cut, (h, v) => h.hurt?.(this, v, source, enemyId));
    const dmg = this.settings.godMode ? 0 : Math.max(0, Math.round(hooked));
    H.hp = Math.max(0, H.hp - dmg);
    if (!keepCombo) {
      this.breakCombo();
      this.speedStacks = 0;
    }
    this.events.push({ type: 'heroHurt', damage: dmg, source, enemyId, perk });
    const max = heroMaxHp(this.tuning, H);
    if (H.hp > 0 && !this.secondWindUsed && this.has('secondWind') && H.hp < max * this.tuning.effects.secondWindAt) {
      this.secondWindUsed = true;
      this.healHero(max * this.tuning.effects.secondWindHeal, 'secondWind');
    }
    if (H.hp > 0) return;
    if (H.revives > 0) {
      H.revives--;
      H.hp = Math.max(1, Math.round(heroMaxHp(this.tuning, H) * this.tuning.hero.reviveHpFrac));
      for (const b of this.blocks.slice()) if (isRed(b.kind)) this.removeBlock(b, 'revive');
      this.events.push({ type: 'revive' });
    } else {
      this.result = 'lost';
      this.events.push({ type: 'defeat' });
    }
  }

  /** The companion pecks the current target after every `companion.everyHits` attack hits. */
  private companionTick(): void {
    const P = this.tuning.companion;
    // Owl Eye: Pip pecks more often
    const every = this.has('owlEye') ? Math.min(P.everyHits, Math.max(1, Math.round(this.tuning.effects.owlEvery))) : P.everyHits;
    if (every <= 0 || this.result) return;
    this.petCharge++;
    if (this.petCharge < every) return;
    this.petCharge = 0;
    const target = this.currentTarget();
    const dmg = Math.round(heroStats(this.tuning, this.hero).companion);
    if (!target || dmg <= 0) return;
    this.pecks++;
    const x: PeckCtx = { target, damage: dmg, crit: false, count: this.pecks };
    for (const h of this.hooks) h.peck?.(this, x);
    this.events.push({ type: 'pet', enemyId: target.id, damage: x.damage, crit: x.crit });
    this.damageEnemy(target, x.damage, x.crit, 'pet');
    for (const h of this.hooks) h.afterPeck?.(this, x);
  }

  /** Damage after shells (attack hits) and summon protection. */
  damageTaken(e: Enemy, dmg: number, source: DamageSource): number {
    let mult = 1;
    if (source === 'hit' && e.shell < 1) mult *= e.shell;
    if (e.protect < 1 && this.summonsAlive(e.id)) mult *= e.protect;
    return mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));
  }

  /** HP an enemy can't be taken below yet: a boss phase change (a gated special) has to fire first. */
  hpFloor(e: Enemy): number {
    if (this.rush) return 1; // the coin sack can't be emptied: the clock ends the rush
    let floor = 0;
    this.specialsOf(e).forEach((sp, i) => {
      if (sp.gate && sp.hpBelow !== undefined && !e.uses[i]) floor = Math.max(floor, Math.ceil(sp.hpBelow * e.maxHp) - 1);
    });
    return floor;
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, source: DamageSource): void {
    if (!e.alive) return;
    dmg = this.damageTaken(e, dmg, source);
    const floor = Math.min(e.hp, this.hpFloor(e));
    const dealt = Math.min(dmg, e.hp - floor);
    const overkill = Math.max(0, dmg - dealt);
    e.hp -= dealt;
    this.events.push({ type: 'enemyHurt', enemyId: e.id, damage: dmg, crit, source });
    if (e.hp > 0) return;
    e.alive = false;
    if (this.telegraph?.enemyId === e.id) {
      this.telegraph = null;
      this.events.push({ type: 'tellCancel', enemyId: e.id });
    }
    for (const b of this.blocks.slice()) if (b.ownerId === e.id && !isAttack(b.kind)) this.removeBlock(b, 'owner');
    this.queue = this.queue.filter((q) => q.ownerId !== e.id);
    this.log.kills++;
    this.events.push({ type: 'kill', enemyId: e.id, coins: killCoins(this.tuning, this.hero, e.key) });
    // kill rewards: permanent stat gains for the rest of the run
    const K = this.tuning.kill;
    if (this.hero.hp > 0 && (K.atk || K.maxHp || K.comboPower)) {
      this.hero.bonusAtk += K.atk;
      this.hero.bonusMaxHp += K.maxHp;
      this.hero.hp += K.maxHp;
      this.hero.bonusComboPower += K.comboPower;
      this.events.push({ type: 'statGain', enemyId: e.id, atk: K.atk, maxHp: K.maxHp, comboPower: K.comboPower });
    }
    // kills heal a little (more with the Greenwarden 4-piece)
    const healShare = Math.max(this.tuning.hero.healOnKill, setPieces(this.hero.gear, 'greenwarden') >= 4 ? this.tuning.effects.greenwardenKillHeal : 0);
    const heal = Math.min(heroMaxHp(this.tuning, this.hero) - this.hero.hp, Math.round(heroMaxHp(this.tuning, this.hero) * healShare));
    if (heal > 0 && this.hero.hp > 0) {
      this.hero.hp += heal;
      this.events.push({ type: 'heal', amount: heal });
    }
    this.killQueue.push(e.id);
    // linked summons run off when their summoner falls
    for (const x of this.enemies) if (x.alive && x.summoner === e.id) this.retire(x, 'fled');
    for (const h of this.hooks) h.kill?.(this, e, overkill, source);
    this.checkWon();
  }

  /** The enemies as they stand, for a mid-fight save (summons and splits included; gone ones saved with 0 HP). */
  saveFoes(): SavedFoe[] {
    // the current wave's foes, with its summons and splits (earlier waves are all beaten)
    const list = this.enemies.filter((e) => e.wave === this.waveIndex);
    return list.map((e) => ({
      key: e.key,
      hp: e.alive ? e.hp : 0,
      maxHp: e.maxHp,
      phase: e.phase,
      uses: e.uses.slice(),
      summoner: e.summoner ? list.findIndex((x) => x.id === e.summoner) : -1,
      protect: e.protect,
      member: e.member,
      parent: e.parent ? list.findIndex((x) => x.id === e.parent) : -1,
    }));
  }

  carry(): Carry {
    return { combo: this.combo, meter: this.meter, stacks: this.stacks, speedStacks: this.speedStacks, cursorPhase: this.cursorPhase };
  }

  drainEvents(): CombatEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
