// Deterministic combat simulation. No Phaser imports: Phaser only renders this state and feeds input.
// Time is in seconds of simulation time, advanced in fixed 1/120 s ticks.

import type { EffectId } from '../data/gear';
import type { RelicId } from '../data/relics';
import type { AllyKind } from '../data/heroes';
import type { BarRules, FormationEntry, SpecialDef, ZoneKind } from '../data/types';
import { CODE_KIND, isAttack, isRed, untappable, type BlockKind } from './blocks';
import { AIM_WINDOW_MS, ISOLATION_MS } from './accuracy';
import { emptyLoadout, hasAura, hasEffect, setPieces, type Loadout, type StatBlock } from './gear';
import { buildBonus, defaultBuild, type HeroBuild } from './heroes';
import { heroDef } from '../data/heroes';
import type { BreakCtx, FightHooks, FinisherCtx, HitCtx, MeterSource, MissCtx, PeckCtx, LinkCtx } from './hooks';
import { finisherShowMs } from './impact';
import { kitHooks } from './kit-fx';
import { companionHooks } from './companion-fx';
import { COMPANIONS } from '../data/companions';
import type { PetBuild } from './roster';
import { RELIC_HOOKS } from './relic-fx';
import { SKILL_HOOKS } from './skill-fx';
import { STYLE_HOOKS } from './styles';
import { Rng } from './rng';
import { fireSpecial, placeEntry } from './specials';
import type { BlockCode, Settings, Tuning } from './tuning';

export { CODE_KIND, isAttack, isRed, untappable, type BlockKind } from './blocks';

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
  still: boolean; // a red that sits where it landed (an icicle) and strikes when its fuse (impactTimer) runs out
  grow: number; // reds: widens by this share of its starting width per second (up to x2)
  baseWidth: number; // the width it spawned at
  trail: ZoneKind | null; // reds: leaves a patch over the stretch it crossed when it's gone
  from: number; // where it spawned (a trail starts there)
  chill: number; // seconds a red stays slowed (Bend, Overgrowth) or pinned (Volley: chillMult 0)
  chillMult: number;
  /** A linked pair: the other block's id (0 = not linked). Hit one, then the other within a beat. */
  link: number;
  /** A drifting block: seconds it keeps drifting (Infinity = for good). */
  driftSec: number;
}

/** A patch on the bar that changes the cursor's speed inside it: ice speeds it up, snowdrifts and slow patches
 *  slow it. Patches can overlap (their speeds multiply) and slide (an Aurora's Shimmer). */
export interface Zone {
  id: number;
  kind: ZoneKind | 'slow' | 'dash'; // 'dash': Shadow Dash's burst of speed toward the next block (drawn as a streak)
  lo: number;
  hi: number;
  mult: number;
  life: number; // seconds left (Infinity: until the phase or the fight ends)
  vel: number; // bar units per second while sliding (bounces off the ends)
  slide: number; // seconds left sliding
  phase: number; // 0, or the boss phase it belongs to (gone when the phase changes)
}

/** A Summoner's ally: what it is, how long it stays, when it acts next. */
export interface Ally {
  id: number;
  kind: AllyKind;
  left: number;
  timer: number;
  braced: boolean; // a Barkback ready to stop the next red
}

/** A hold block being held: which, the way the cursor crosses it, whether the press was Perfect. */
export interface Holding {
  id: number;
  dir: number;
  perfect: boolean;
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
  stun: number; // seconds it stops attacking (Wind-Up)
  holdEvery: number; // every Nth yellow it sends comes as a hold (0 = none; a boss phase's bar rule)
  yellows: number; // yellows it has sent (for holdEvery)
  driftEvery: number; // every Nth yellow it sends drifts (0 = none; a bar rule from a special)
  linkEvery: number; // every Nth yellow it sends comes as a linked pair (0 = none)
  sent: number; // yellows it has sent (for driftEvery / linkEvery)
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

/** The hero's base max HP (tuning.hero for Rowan, tuning.kits.<id> for the rest), before levels, boosts and gear. */
export const heroBaseHp = (t: Tuning, h: Hero): number => kitBase(t, h.build?.id ?? 'rowan').hp;

/** A hero's base HP and attack share (Rowan: tuning.hero.maxHp and 1). */
export function kitBase(t: Tuning, id: string): { hp: number; atk: number } {
  const k = (t.kits as Record<string, { hp?: number; atk?: number }>)[id];
  return { hp: k?.hp ?? t.hero.maxHp, atk: k?.atk ?? 1 };
}

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
  const share = kitBase(t, h.build?.id ?? 'rowan').atk;
  return (t.hero.atk * share * (1 + b.levelAtk) + h.bonusAtk + (h.gear?.stats.atk ?? 0)) * (1 + h.bonusDmg + b.atkPct);
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

/** The red speed a fight runs at: the act's (1 = normal). */
export const redSpeedFor = (actRedSpeed: number): number => Math.max(0.1, actRedSpeed);

/** Damage a red you didn't block deals, after Defense. */
export const afterDefense = (t: Tuning, dmg: number, def: number): number => (dmg * t.gear.defScale) / (t.gear.defScale + Math.max(0, def));

/** Coins a kill of `key` drops (Luck and Golden Touch add to them). */
export function killCoins(t: Tuning, h: Hero, key: string): number {
  const base = t.enemies[key]?.coins ?? 0;
  const gear = h.gear ?? emptyLoadout();
  return Math.round(base * (1 + gear.stats.luck + (hasEffect(gear, 'goldTouch') ? t.effects.goldTouch : 0) + (hasAura(gear, 'fortune') ? t.effects.fortune : 0)));
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
  | { type: 'hit'; kind: BlockKind; pos: number; perfect: boolean; crit: boolean; damage: number; enemyId: number; combo: number; echo: boolean }
  | { type: 'block'; kind: BlockKind; pos: number; perfect: boolean; cracked: boolean; ownerId: number; combo: number; knock: number; echo: boolean }
  | { type: 'trap'; pos: number; damage: number; enemyId: number }
  | { type: 'counter'; pos: number; damage: number; enemyId: number }
  | { type: 'wardBreak'; pos: number; enemyId: number; left: number; perfect: boolean; combo: number }
  | { type: 'miss'; pos: number; selfDamage: boolean }
  | { type: 'remove'; id: number; kind: BlockKind; pos: number; width: number; ownerId: number; reason: RemoveReason }
  | { type: 'spawn'; id: number; kind: BlockKind; ownerId: number; special: boolean; drift?: boolean }
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
  | { type: 'pet'; pet: string; enemyId: number; damage: number; crit: boolean }
  | { type: 'kill'; enemyId: number; coins: number }
  | { type: 'gearFx'; fx: EffectId | 'footpad'; amount: number; enemyId: number } // a gear effect kicked in (the view names it)
  // a relic, skill node or hero kit perk kicked in (id: a RelicId, a skill node id, or a kit id like 'shadowStep'; the
  // view names it); amount: damage dealt, HP healed, coins, stacks... (0 = just show the name)
  | { type: 'perk'; id: string; amount: number; enemyId: number; pos?: number }
  | { type: 'coins'; amount: number; id: string } // coins found mid-fight (relics), banked by the run
  | { type: 'morph'; id: number; kind: BlockKind } // a block on the bar changed kind (Chain Reaction: yellow -> green)
  | { type: 'explode'; pos: number; radius: number; own?: boolean } // own: a hero's keg
  | { type: 'zoneOn'; id: number; kind: Zone['kind']; lo: number; hi: number }
  | { type: 'zoneOff'; id: number; kind: Zone['kind'] }
  | { type: 'mark'; pos: number; sec: number } // where an icicle (a still red) will land, and when
  | { type: 'mirror'; pos: number } // the cursor bounced off a mirror shard
  | { type: 'dash'; from: number; to: number } // Shadow Dash: the cursor jumped ahead
  | { type: 'holdStart'; id: number; pos: number; perfect: boolean }
  | { type: 'holdEnd'; id: number; pos: number; ok: boolean }
  | { type: 'linkStart'; id: number; partner: number; pos: number } // one of a linked pair hit: it lights, waiting
  | { type: 'linkDone'; ids: number[]; pos: number } // ...its partner hit in time: both land, harder
  | { type: 'linkBroken'; ids: number[]; pos: number } // ...the beat ran out: both break, a miss
  | { type: 'driftOn'; count: number } // a special set yellows drifting
  | { type: 'linkOn'; count: number } // a special chained pairs
  | { type: 'pairOn'; id: number; partner: number } // a linked pair came onto the bar (or was chained)
  | { type: 'driftShift'; flip: boolean; mult: number } // a special turned or sped up every drifting block
  | { type: 'chip'; id: number; pos: number; left: number } // an iced yellow took a tap (it needs more)
  | { type: 'iceBlock'; id: number; pos: number } // a red froze in place (Flash Freeze, Glacier)
  | { type: 'ally'; kind: AllyKind; action: 'call' | 'act' | 'leave' | 'rally' | 'block'; id: number }
  | { type: 'stun'; enemyId: number; sec: number }
  | { type: 'deflect'; pos: number } // a red bounced off the left end (Rampart)
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

/** 'hold': a hold block was pressed (it completes, or slips, later); 'chip': an iced yellow took a tap. */
export type TapOutcome = 'hit' | 'block' | 'crack' | 'trap' | 'counter' | 'ward' | 'hold' | 'chip' | 'link' | 'miss' | 'none';

export interface TapResult {
  outcome: TapOutcome;
  perfect: boolean;
  cursorPos: number;
  blockId: number;
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
  /** The act's bar rules (patches, holds) and the map row the fight is on (each rule starts from a row). */
  bar?: BarRules;
  row?: number;
  /** A practice fight: nothing hurts the hero (the camp's Training Dummy). */
  practice?: boolean;
}

/** What happened in a fight, for the side quests (core/quests.ts). */
export interface FightLog {
  blocks: number; // reds blocked (a shield counts once, on its last tap)
  bestCombo: number;
  breaks: number; // misses and hits taken (each one broke the combo)
  cleanWaves: number; // waves cleared without a miss or a hit taken
  kills: number;
  hits: number; // hits taken from foes (reds, bombs, traps, counters)
  holds: number; // holds finished
  bestFinisher: number; // the most stacks a finisher spent
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
  /** Attack hits since each companion last attacked. */
  petCharges: number[] = [];
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
  log: FightLog = { blocks: 0, bestCombo: 0, breaks: 0, cleanWaves: 0, kills: 0, hits: 0, holds: 0, bestFinisher: 0 };
  /** Breaks when the current wave came in (a wave cleared with none since is clean). */
  private waveBreaks = 0;
  /** The attack hit being resolved right now (comboGain and meter hooks read whether it was Perfect), or null. */
  hitNow: HitCtx | null = null;
  /** The sim time the tap being judged right now happened at (NaN outside a tap). */
  tapAt = NaN;
  /** Patches on the bar (ice, snowdrifts, slow patches). */
  zones: Zone[] = [];
  /** The hold block being held (null: none). */
  holding: Holding | null = null;
  /** One of a linked pair that was hit and waits for its partner until `until` (sim time); null: none. */
  linkLit: { id: number; partner: number; until: number; perfect: boolean } | null = null;
  /** True while the two hits of a completed linked pair land (they hit harder). */
  private linkBonus = false;
  /** Every drifting block moves this much faster for `driftMultSec` more seconds (a driftShift special). */
  driftMult = 1;
  driftMultSec = 0;
  /** Seconds every drifting block stays stopped (Anchor Stone). */
  driftPause = 0;
  /** Which half of a linked pair the hit landing now is (1 = the first, 2 = the second; 0 = not a pair). */
  pairHit = 0;
  /** A Summoner's allies on the field. */
  allies: Ally[] = [];
  /** A practice fight (the camp's Training Dummy): nothing hurts the hero. */
  readonly practice: boolean;
  /** The act's bar rules and the map row (patches and holds start from a row). */
  readonly bar: BarRules | null;
  readonly row: number;
  private barTimers: Record<string, number> = {};

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
    this.rush = Math.max(0, o.rush ?? 0);
    // the hero's style rule, then their kit (signature, ability, passive, finisher, stars, strengths), skills, relics
    // (Coin Rush is pure aim: the style and kit only)
    const kit = [STYLE_HOOKS[heroDef(build.id).style], ...kitHooks(build)];
    // the companions' perks (only when the build names its companions: a profile's always does)
    const pets = build.pets ? companionHooks(build.pets) : [];
    this.hooks = (this.rush ? kit : [...kit, ...pets, ...build.skills.map((id) => SKILL_HOOKS[id]), ...(o.hero.relics ?? []).map((id) => RELIC_HOOKS[id])]).filter((h): h is FightHooks => !!h);
    this.bar = o.bar ?? null;
    this.row = Math.max(0, o.row ?? 0);
    this.practice = !!o.practice;
    this.spawning = o.spawning ?? true;
    this.specialsOn = o.specials ?? this.spawning;
    this.hpMult = o.hpMult ?? 1;
    this.atkMult = o.atkMult ?? 1;
    this.pace = o.pace ?? 1;
    this.redSpeed = redSpeedFor(o.redSpeed ?? 1);
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

  /** The fighting hero's id, and their stars (1-5). */
  get heroId(): string {
    return this.hero.build?.id ?? 'rowan';
  }

  get stars(): number {
    return Math.max(1, this.hero.build?.stars ?? 1);
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

  /** A perk hits a yellow/green on the bar as if it were tapped (Blast Wave). Never a hold. */
  perkHit(b: Block, perfect = false): void {
    if (!this.blocks.includes(b) || !isAttack(b.kind) || b.kind === 'hold' || b.link || this.result) return;
    this.hitAttack(b, perfect, true);
  }

  /** A perk blocks a red on the bar as if it were tapped (Night Watch, an afterimage). */
  perkBlock(b: Block): void {
    if (!this.blocks.includes(b) || !isRed(b.kind) || this.result) return;
    this.blockRed(b, false, true);
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
  fillMeter(x: number, source: MeterSource = 'perk'): void {
    this.addMeter(x, source);
  }

  /** A perk counts a yellow/green a bomb's blast already took off the bar as a hit of yours (Blast Wave). */
  perkHitCleared(b: Block): void {
    if (this.blocks.includes(b) || !isAttack(b.kind) || b.kind === 'hold' || this.result) return;
    this.hitAttack(b, false, true);
  }

  /** Living foes, front first. */
  aliveFoes(): Enemy[] {
    return this.enemies.filter((e) => e.alive).sort((a, b) => a.slot - b.slot);
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
      stun: 0,
      holdEvery: 0,
      yellows: 0,
      driftEvery: 0,
      linkEvery: 0,
      sent: 0,
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
    // a Divine item's Stillness aura: the combo speeds the cursor up less
    const still = hasAura(this.hero.gear, 'stillness') ? 1 - this.tuning.effects.stillness : 1;
    const m = (1 + c.speedPerHit * (1 - steady) * still * this.combo) * (1 + c.speedBlockBonus * this.speedStacks);
    return Math.max(this.minSpeed, Math.min(c.maxSpeedMult, m));
  }

  /** Cursor speed in passes per second (one pass = 1 unit of phase = one bar width), before patches on the bar.
   *  Perks may change it (Chill slows it). */
  cursorSpeed(): number {
    return (this.speedMult() / this.tuning.cursor.basePassSec) * this.mod(1, (h, v) => h.cursorMult?.(this, v));
  }

  /** The cursor's speed in bar units per second right now (patches included). */
  barSpeed(): number {
    return this.cursorSpeed() * this.zoneMultAt(this.cursorPos());
  }

  /** How patches change the cursor's speed at `pos` (1 = none; overlapping patches multiply). */
  zoneMultAt(pos: number): number {
    let m = 1;
    for (const z of this.zones) if (pos >= z.lo && pos <= z.hi) m *= this.zoneMult(z);
    return m;
  }

  /** A patch's speed multiplier as this hero feels it (Neve: ice bothers her half as much). */
  zoneMult(z: Zone): number {
    return Math.max(0.1, this.mod(z.mult, (h, v) => h.zoneMult?.(this, z, v)));
  }

  /** The ice patch under bar position `pos`, if any. */
  iceAt(pos: number): Zone | null {
    return this.zones.find((z) => z.kind === 'ice' && pos >= z.lo && pos <= z.hi) ?? null;
  }

  /** Where the cursor is now (0..1). */
  cursorPos(): number {
    return phaseToPos(this.cursorPhase);
  }

  /** Seconds the cursor takes to get from `from` to `to` moving `dir` (no wall turns), at today's speed, through the
   *  patches on the way. The bot and Shadow Dash use it to time blocks on ice and in snowdrifts. */
  travelTime(from: number, to: number, dir = this.cursorDirAt(this.time)): number {
    const v = this.cursorSpeed();
    if (v <= 0) return Infinity;
    const d = (to - from) * dir;
    if (d <= 0) return 0;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    if (!this.zones.length) return d / v;
    // split the stretch at every patch edge inside it; each piece runs at the speed of its middle
    const cuts = [lo, hi];
    for (const z of this.zones) for (const e of [z.lo, z.hi]) if (e > lo && e < hi) cuts.push(e);
    cuts.sort((a, b) => a - b);
    let t = 0;
    for (let i = 0; i < cuts.length - 1; i++) t += (cuts[i + 1] - cuts[i]) / (v * this.zoneMultAt((cuts[i] + cuts[i + 1]) / 2));
    return t;
  }

  private phaseVelNow(): number {
    return this.hitStop > 0 || this.result || this.cursorHold > 0 || this.freeze > 0 ? 0 : this.cursorSpeed() * this.zoneMultAt(this.cursorPos());
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

  /** Where the cursor is at sim time t (0..1). */
  cursorPosAt(t: number): number {
    return phaseToPos(this.phaseAt(t));
  }

  /** The cursor's direction at sim time t: 1 = moving right, -1 = left. */
  cursorDirAt(t: number): number {
    return ((this.phaseAt(t) % 2) + 2) % 2 < 1 ? 1 : -1;
  }

  motionAt(t: number): number {
    if (t >= this.time) return this.motionTime + this.motionVelNow() * (t - this.time);
    const i = this.histIndex(t);
    return this.hMotion[i] + this.hMotionVel[i] * Math.max(0, t - this.hT[i]);
  }

  blockPosAt(b: Block, t: number): number {
    const p = b.pos + this.velOf(b) * (this.motionAt(t) - this.motionTime);
    return Math.min(1 - b.width / 2, Math.max(b.width / 2, p));
  }

  /** A block's speed along the bar right now (a drifting block's, with a driftShift's multiplier). */
  velOf(b: Block): number {
    return isRed(b.kind) ? b.vel : this.driftPause > 0 ? 0 : b.vel * this.driftMult * this.mod(1, (h, v) => h.driftMult?.(this, v));
  }

  /** Every drifting block stops for `sec` seconds (Anchor Stone). */
  pauseDrift(sec: number): void {
    this.driftPause = Math.max(this.driftPause, sec);
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
    } else this.moveCursor();
    if (this.holding) this.updateHold();
    if (this.hero.abilityTimer > 0) this.hero.abilityTimer = Math.max(0, this.hero.abilityTimer - DT);
    this.updateZones();
    if (this.bar && !this.rush) this.updateBarRules();
    if (hasAura(this.hero.gear, 'sanctuary') && this.tick % Math.max(1, Math.round(this.tuning.effects.sanctuarySec * SIM_HZ)) === 0)
      this.healPerk(this.maxHp() * this.tuning.effects.sanctuaryHeal, 'sanctuary');
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

  // ---------------------------------------------------------------- the bar: patches, mirrors, holds, dashes

  /** The cursor moves one tick, at its speed times the patch it's in; a mirror shard it reaches bounces it back. */
  private moveCursor(): void {
    const before = this.cursorPos();
    const dir = this.cursorDirAt(this.time);
    this.cursorPhase += this.cursorSpeed() * this.zoneMultAt(before) * DT;
    const after = this.cursorPos();
    if (this.cursorDirAt(this.time + DT) !== dir) return; // it turned at a wall this tick
    for (const m of this.blocks) {
      if (m.kind !== 'mirror') continue;
      if ((m.pos - before) * dir > 1e-9 && (after - m.pos) * dir >= -1e-9) {
        this.setCursor(m.pos, -dir);
        this.events.push({ type: 'mirror', pos: m.pos });
        break;
      }
    }
  }

  /** Put the cursor at `pos` moving `dir` (a mirror's bounce, a dash). */
  setCursor(pos: number, dir: number): void {
    const p = Math.max(0, Math.min(1, pos));
    const q = ((this.cursorPhase % 2) + 2) % 2;
    const base = this.cursorPhase - q;
    this.cursorPhase = base + (dir > 0 ? p : 2 - p);
  }

  /** Shadow Dash: the cursor jumps ahead to `pos` (same direction). */
  dashTo(pos: number): void {
    const from = this.cursorPos();
    this.setCursor(pos, this.cursorDirAt(this.time));
    this.events.push({ type: 'dash', from, to: this.cursorPos() });
  }

  /** Lay a patch on the bar centred at `center` (clamped to the bar). Returns it. */
  addZone(kind: Zone['kind'], center: number, width: number, life: number, phase = 0): Zone {
    const B = this.tuning.bar;
    const w = Math.max(0.02, Math.min(1, width));
    const c = Math.max(w / 2, Math.min(1 - w / 2, center));
    const mult = kind === 'ice' ? B.iceMult : kind === 'snow' ? B.snowMult : kind === 'dash' ? this.tuning.kits.sable.dashMult : B.slowMult;
    const z: Zone = { id: this.nextId++, kind, lo: c - w / 2, hi: c + w / 2, mult, life: life > 0 ? life : Infinity, vel: 0, slide: 0, phase };
    this.zones.push(z);
    this.events.push({ type: 'zoneOn', id: z.id, kind, lo: z.lo, hi: z.hi });
    return z;
  }

  removeZone(z: Zone): void {
    const i = this.zones.indexOf(z);
    if (i < 0) return;
    this.zones.splice(i, 1);
    this.events.push({ type: 'zoneOff', id: z.id, kind: z.kind });
  }

  /** Where the cursor is heading: a little ahead of it, the way it's moving (patches and marks laid "ahead"). */
  aheadPos(dist = this.tuning.bar.ahead): number {
    const p = this.cursorPos();
    const dir = this.cursorDirAt(this.time);
    let q = p + dir * dist;
    if (q > 0.92) q = Math.max(0.08, 2 * 0.92 - q);
    if (q < 0.08) q = Math.min(0.92, 2 * 0.08 - q);
    return q;
  }

  /** Patches run out; sliding ones move (and bounce off the ends). */
  private updateZones(): void {
    for (const z of this.zones.slice()) {
      if (z.slide > 0) {
        z.slide -= DT;
        let d = z.vel * DT;
        if (z.hi + d > 1 || z.lo + d < 0) {
          z.vel = -z.vel;
          d = -d;
        }
        z.lo += d;
        z.hi += d;
      }
      if (z.life !== Infinity && (z.life -= DT) <= 1e-9) this.removeZone(z);
    }
  }

  /** Every patch on the bar slides for `sec` seconds (an Aurora's Shimmer). */
  shiftZones(speed: number, sec: number): void {
    for (const z of this.zones) {
      z.vel = (this.rand() < 0.5 ? -1 : 1) * Math.abs(speed);
      z.slide = Math.max(z.slide, sec);
    }
  }

  /** The act's bar rules: patches come and go from their map row on. */
  private updateBarRules(): void {
    const bar = this.bar!;
    for (const kind of ['ice', 'snow'] as const) {
      const r = bar[kind];
      if (!r || this.row < r.fromRow || r.every <= 0) continue;
      const left = (this.barTimers[kind] ?? r.every * 0.5) - DT;
      this.barTimers[kind] = left;
      if (left > 0) continue;
      this.barTimers[kind] = r.every;
      if (this.zones.filter((z) => z.kind === kind && z.phase === 0).length >= r.max) continue;
      this.addZone(kind, this.freeZoneSpot(r.width), r.width, r.life);
    }
  }

  /** A patch centre that overlaps the others as little as it can (a few tries). */
  freeZoneSpot(w: number): number {
    let best = 0.5;
    let bestOver = Infinity;
    for (let k = 0; k < 6; k++) {
      const c = this.rand() * (1 - w - 0.16) + 0.08 + w / 2;
      let over = 0;
      for (const z of this.zones) over += Math.max(0, Math.min(z.hi, c + w / 2) - Math.max(z.lo, c - w / 2));
      if (over < bestOver) (best = c), (bestOver = over);
      if (over <= 0) break;
    }
    return best;
  }

  /** Whether a yellow from this owner should come as a hold (the act's share, or a boss phase's every-Nth rule). */
  private wantsHold(ownerId: number): boolean {
    const e = this.enemyById(ownerId);
    if (e?.holdEvery) {
      e.yellows++;
      if (e.yellows % e.holdEvery === 0) return true;
    }
    const h = this.bar?.holds;
    return !!h && this.row >= h.fromRow && this.spawnRng.next() < h.share;
  }

  /** The hold being held: done once the cursor is past its far end; a turn before then (a wall, a mirror) lets go. */
  private updateHold(): void {
    const H = this.holding!;
    const b = this.blocks.find((x) => x.id === H.id);
    if (!b) {
      this.holding = null;
      return;
    }
    if (this.cursorHold > 0 || this.hitStop > 0) return;
    const p = this.cursorPos();
    const exit = b.pos + (H.dir * b.width) / 2;
    if ((p - exit) * H.dir >= 0) return this.endHold(b, true);
    if (this.cursorDirAt(this.time) !== H.dir) {
      // turned back inside it: held long enough counts, else it slips
      const done = (p - (b.pos - (H.dir * b.width) / 2)) * H.dir;
      this.endHold(b, done >= b.width * this.tuning.hold.turnDone);
    }
  }

  /** The finger came off: a hold let go before its far end (beyond a small grace) is a miss. */
  release(t: number): void {
    const H = this.holding;
    if (!H || this.result) return;
    const b = this.blocks.find((x) => x.id === H.id);
    if (!b) {
      this.holding = null;
      return;
    }
    const tt = this.clampTap(t);
    const p = this.cursorPosAt(tt);
    const exit = b.pos + (H.dir * b.width) / 2;
    const left = (exit - p) * H.dir; // bar units still to go
    const v = Math.max(1e-6, this.speedAtTime(tt));
    this.endHold(b, (left / v) * 1000 <= this.tuning.hold.releaseGraceMs);
  }

  private endHold(b: Block, ok: boolean): void {
    const H = this.holding!;
    this.holding = null;
    this.events.push({ type: 'holdEnd', id: b.id, pos: b.pos, ok });
    if (ok) {
      this.log.holds++;
      this.hitAttack(b, H.perfect);
      return;
    }
    this.removeBlock(b, 'expire');
    this.miss(b.pos, true);
  }

  /** A press on a hold block: on (or just before) its near edge starts the hold; a press deep inside it is a miss. */
  private pressHold(b: Block, t: number): TapOutcome {
    const tt = this.clampTap(t);
    const dir = this.cursorDirAt(tt);
    const p = this.cursorPosAt(tt);
    const entry = b.pos - (dir * b.width) / 2;
    const v = Math.max(1e-6, this.speedAtTime(tt));
    const lateMs = (((p - entry) * dir) / v) * 1000;
    if (lateMs > this.tuning.hold.lateMs) {
      this.miss(p);
      return 'miss';
    }
    const perfect = Math.abs(lateMs) <= this.tuning.hold.perfectMs;
    this.holding = { id: b.id, dir, perfect };
    this.events.push({ type: 'holdStart', id: b.id, pos: b.pos, perfect });
    return 'hold';
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
      if (!e.alive || e.stun > 0) continue;
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
    if (this.driftMultSec > 0 && (this.driftMultSec -= DT) <= 0) {
      this.driftMultSec = 0;
      this.driftMult = 1;
    }
    if (this.driftPause > 0) this.driftPause = Math.max(0, this.driftPause - DT);
    const B = this.tuning.blocks;
    for (const b of this.blocks.slice()) {
      if (this.result) return;
      if (!this.blocks.includes(b)) continue; // gone mid-loop (a blast that reached the hero, a revive)
      if (isRed(b.kind) && b.still) {
        // an icicle: sits where it landed until blocked, or its fuse runs out
        b.impactTimer -= DT;
        if (b.impactTimer <= 1e-9) this.impact(b);
      } else if (isRed(b.kind)) {
        if (b.grow > 0 && b.width < b.baseWidth * 2) b.width = Math.min(b.baseWidth * 2, b.width + b.baseWidth * b.grow * DT);
        if (b.chill > 0) b.chill = Math.max(0, b.chill - DT);
        const half = b.width / 2;
        if (b.push > 0) {
          // Pushed back (finisher or shield knockback): slide right, then resume the normal leftward travel.
          const d = Math.min(b.push, b.pushSpeed * DT);
          b.push -= d;
          if (b.push < 1e-9) b.push = 0;
          b.pos = Math.min(1 - half, b.pos + d);
          b.vel = b.push > 0 ? b.pushSpeed : this.redVel(b.width, b.speed);
        } else if (b.impactTimer < 0) {
          b.vel = this.redVel(b.width, b.speed) * (b.chill > 0 ? b.chillMult : 1);
          b.pos += b.vel * DT;
          if (b.pos <= half) {
            b.pos = half;
            b.vel = 0;
            if (this.claim((h) => h.atWall?.(this, b))) {
              // the left end is walled (Rampart): it bounces back across the bar
              this.events.push({ type: 'deflect', pos: b.pos });
              this.knockBack(b, 1, B.knockbackSec * 3);
            } else b.impactTimer = B.impactGraceMs / 1000;
          }
        } else {
          b.impactTimer -= DT;
          if (b.impactTimer <= 1e-9) this.impact(b);
        }
      } else {
        if (b.vel !== 0) this.driftBlock(b);
        if (b.life !== Infinity) {
          b.life -= DT;
          if (b.life <= 0) {
            this.removeBlock(b, 'expire');
            if (b.kind === 'spore') this.sporeHeal(b);
          }
        }
      }
    }
    // a lit link whose beat ran out: both break
    const L = this.linkLit;
    if (L && this.time >= L.until - 1e-9 && !this.result) this.breakLink();
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
      const min = Math.round(this.mod(B.minAttack, (h, v) => h.minAttack?.(this, v)));
      if (front && attacks < min && this.trySpawn('yellow', front.id)) this.refillTimer = 0.12;
    }
    for (const e of this.enemies) {
      if (!e.alive || this.telegraph?.enemyId === e.id) continue; // busy winding up a special
      if (e.stun > 0) {
        // stunned (Wind-Up): no attacks until it shakes it off
        e.stun = Math.max(0, e.stun - DT);
        continue;
      }
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
        // perks can space out the static blocks (Heavy: fewer, wider yellows)
        const gap = isRed(kind) ? 1 : this.mod(1, (h, v) => h.staticGap?.(this, v));
        e.spawnTimer = Math.max(e.spawnTimer, 0) + def.interval * B.spawnRateMult * groupMult * this.pace * gap;
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
    if (kind === 'yellow' && this.wantsHold(ownerId)) kind = 'hold';
    // blocks come in varied widths: some small, some big, for every kind
    const [vLo, vHi] = isRed(kind) ? [B.redWidthMin, B.redWidthMax] : [B.widthMin, B.widthMax];
    const w0 = this.widthFor(kind) * (kind === 'hold' ? 1 : this.spawnRng.range(Math.min(vLo, vHi), Math.max(vLo, vHi)));
    const w = this.mod(w0, (h, v) => h.blockWidth?.(this, kind, v));
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
    // the region's bar rules: a yellow may come as a linked pair, or drifting (the random draws only happen in an
    // act that has these rules, so other acts play exactly as before)
    const R = this.bar;
    // a foe's own bar rule (a special's barRule): every Nth yellow it sends drifts or comes as a pair
    const owner = this.enemyById(ownerId);
    let callLink = false;
    let callDrift = false;
    if (kind === 'yellow' && owner && (owner.driftEvery || owner.linkEvery)) {
      owner.sent++;
      if (owner.linkEvery && owner.sent % owner.linkEvery === 0) callLink = true;
      else if (owner.driftEvery && owner.sent % owner.driftEvery === 0) callDrift = true;
    }
    if (kind === 'yellow' && (callLink || (R?.links && this.row >= R.links.fromRow && this.spawnRng.next() < R.links.share)) && statics.length + 2 <= B.maxStatic) {
      if (this.spawnPair(w, ownerId)) return true;
    }
    let drift = 0;
    const speed = R?.drift?.speed ?? this.tuning.drift.speed;
    if (kind === 'yellow' && (callDrift || (R?.drift && this.row >= R.drift.fromRow && this.spawnRng.next() < R.drift.share))) drift = speed * (this.spawnRng.next() < 0.5 ? -1 : 1);
    const p = this.freeSpot(w);
    if (p === null) return false;
    this.spawnBlock(kind, p, ownerId, w, drift ? { drift } : {});
    return true;
  }

  /** A linked pair: two yellows a short way apart, chained (each knows the other). False if there's no room. */
  spawnPair(w: number, ownerId: number): boolean {
    const B = this.tuning.blocks;
    const L = this.tuning.links;
    const statics = this.blocks.filter((b) => !isRed(b.kind) || b.still);
    const lo = B.edgeMargin + w / 2;
    const hi = 1 - B.edgeMargin - w / 2;
    const fits = (q: number) => q >= lo && q <= hi && statics.every((s) => Math.abs(s.pos - q) >= (s.width + w) / 2 + B.minGap);
    const gap = w + this.spawnRng.range(Math.min(L.gapMin, L.gapMax), Math.max(L.gapMin, L.gapMax));
    // a few tries: a free spot for one half, and room for the other a gap away (either side)
    for (let k = 0; k < 12; k++) {
      const p = this.freeSpot(w, 4);
      if (p === null) continue;
      const first = this.spawnRng.next() < 0.5 ? 1 : -1;
      for (const dir of [first, -first]) {
        const q = p + dir * gap;
        if (!fits(q)) continue;
        const a = this.spawnBlock('yellow', p, ownerId, w);
        const b = this.spawnBlock('yellow', q, ownerId, w);
        a.link = b.id;
        b.link = a.id;
        this.events.push({ type: 'pairOn', id: a.id, partner: b.id });
        return true;
      }
    }
    return false;
  }

  /** A drifting block slides along the bar, turning back at the ends and at the blocks beside it. */
  private driftBlock(b: Block): void {
    const B = this.tuning.blocks;
    const half = b.width / 2;
    const lo = B.edgeMargin + half;
    const hi = 1 - B.edgeMargin - half;
    if (b.driftSec !== Infinity && (b.driftSec -= DT) <= 0) {
      // its drift (from a special) has run out: it settles where it is
      b.vel = 0;
      b.driftSec = Infinity;
      return;
    }
    const v = this.velOf(b);
    if (v === 0) return;
    let next = b.pos + v * DT;
    const blocked = this.blocks.some((s) => s !== b && (!isRed(s.kind) || s.still) && (s.pos - b.pos) * v > 0 && Math.abs(s.pos - next) < (s.width + b.width) / 2 + B.minGap / 2);
    const end = next < lo || next > hi;
    if (end || blocked) {
      b.vel = -b.vel;
      next = Math.min(hi, Math.max(lo, b.pos - v * DT));
    }
    b.pos = next;
    if (end) for (const h of this.hooks) h.driftTurn?.(this, b);
  }

  /** Make a block drift at `speed` (sign = direction) for `sec` seconds (Infinity = for good). Not reds. */
  setDrift(b: Block, speed: number, sec = Infinity): void {
    if (isRed(b.kind) || !this.blocks.includes(b)) return;
    b.vel = speed === 0 ? 0 : speed;
    b.driftSec = speed === 0 ? Infinity : sec;
  }

  /** A random spot (block center) where a static block of width w fits without touching the others, or null. */
  freeSpot(w: number, tries = 16): number | null {
    const B = this.tuning.blocks;
    const statics = this.blocks.filter((b) => !isRed(b.kind) || b.still);
    const lo = B.edgeMargin + w / 2;
    const hi = 1 - B.edgeMargin - w / 2;
    if (hi < lo) return null;
    for (let k = 0; k < tries; k++) {
      const p = this.spawnRng.range(lo, hi);
      if (statics.every((s) => Math.abs(s.pos - p) >= (s.width + w) / 2 + B.minGap)) return p;
    }
    return null;
  }

  /** A kind's base width (spawns vary around it, see trySpawn). */
  widthFor(kind: BlockKind): number {
    const B = this.tuning.blocks;
    if (kind === 'hold') return this.tuning.hold.width;
    if (kind === 'mirror') return 0.012;
    return isRed(kind) ? B.redWidth : kind === 'purple' ? B.trapWidth : kind === 'green' ? B.greenWidth : B.attackWidth;
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
    o: { speed?: number; taps?: number; life?: number; heal?: number; special?: boolean; still?: boolean; fuse?: number; grow?: number; trail?: ZoneKind; drift?: number } = {},
  ): Block {
    const B = this.tuning.blocks;
    const speed = o.speed ?? 1;
    const still = !!o.still && isRed(kind);
    const b: Block = {
      id: this.nextId++,
      kind,
      ownerId,
      pos: Math.min(1 - width / 2, Math.max(width / 2, pos)),
      width,
      vel: isRed(kind) && !still ? this.redVel(width, speed) : 0,
      taps: o.taps ?? (kind === 'shield' ? Math.max(1, Math.round(B.shieldHits)) : 1),
      bornAt: this.time,
      life: o.life ?? (kind === 'purple' ? B.trapLifeSec : kind === 'frozen' ? B.frozenLifeSec : isAttack(kind) && B.attackLifeSec > 0 ? B.attackLifeSec : Infinity),
      impactTimer: still ? Math.max(0.1, o.fuse ?? 1.5) : -1,
      push: 0,
      pushSpeed: 0,
      speed,
      heal: o.heal ?? 0,
      still,
      grow: o.grow ?? 0,
      baseWidth: width,
      trail: o.trail ?? null,
      from: Math.min(1 - width / 2, Math.max(width / 2, pos)),
      chill: 0,
      chillMult: 1,
      link: 0,
      driftSec: Infinity,
    };
    if (o.drift && !isRed(kind)) b.vel = o.drift;
    for (const h of this.hooks) h.spawned?.(this, b);
    this.blocks.push(b);
    this.events.push({ type: 'spawn', id: b.id, kind: b.kind, ownerId, special: !!o.special, drift: b.vel !== 0 && !isRed(kind) });
    if (isRed(kind) && !o.special) this.events.push({ type: 'windup', enemyId: ownerId });
    return b;
  }

  removeBlock(b: Block, reason: RemoveReason): void {
    const i = this.blocks.indexOf(b);
    if (i < 0) return;
    this.blocks.splice(i, 1);
    if (this.holding?.id === b.id) this.holding = null;
    if (b.link) {
      // a linked block gone some other way (a blast, a finisher, its time up): its partner is a plain yellow now
      const o = this.blocks.find((x) => x.id === b.link);
      if (o) o.link = 0;
      if (this.linkLit && (this.linkLit.id === b.id || this.linkLit.partner === b.id)) this.linkLit = null;
      b.link = 0;
    }
    this.events.push({ type: 'remove', id: b.id, kind: b.kind, pos: b.pos, width: b.width, ownerId: b.ownerId, reason });
    // a red with a trail leaves a patch over the stretch it crossed
    if (b.trail && Math.abs(b.from - b.pos) > 0.04) this.addZone(b.trail, (b.from + b.pos) / 2, Math.abs(b.from - b.pos), this.tuning.bar.trailLife);
  }

  /** Freeze a red in place: it becomes a frozen block that sits still until hit (it shatters) or it melts. */
  freezeRed(b: Block): Block | null {
    if (!isRed(b.kind)) return null;
    const pos = b.pos;
    const w = Math.max(b.width, this.tuning.blocks.attackWidth);
    if (this.blocks.includes(b)) this.removeBlock(b, 'perk');
    const f = this.spawnBlock('frozen', pos, b.ownerId, w);
    this.events.push({ type: 'iceBlock', id: f.id, pos: f.pos });
    return f;
  }

  /** Slow a red for `sec` (mult 0: pinned in place). */
  chillRed(b: Block, sec: number, mult: number): void {
    if (!isRed(b.kind) || b.still) return;
    // a slow still running keeps the stronger of the two; an expired one doesn't linger into the next
    const was = b.chill > 0;
    b.chill = Math.max(b.chill, sec);
    b.chillMult = was ? Math.min(b.chillMult, Math.max(0, mult)) : Math.max(0, mult);
  }

  /** Stun a foe: it stops attacking for `sec`. */
  stun(e: Enemy, sec: number): void {
    if (!e.alive || sec <= 0) return;
    e.stun = Math.max(e.stun, sec);
    if (this.telegraph?.enemyId === e.id) {
      this.telegraph = null;
      this.events.push({ type: 'tellCancel', enemyId: e.id });
    }
    this.events.push({ type: 'stun', enemyId: e.id, sec });
  }

  // ---------------------------------------------------------------- input

  /**
   * Judge a bar tap that happened at sim time `t` (already corrected by calibration).
   * Positions are rewound to `t`; effects apply to the current state.
   */
  tap(t: number): TapResult {
    const none: TapResult = { outcome: 'none', perfect: false, cursorPos: 0, blockId: 0 };
    if (this.result || this.cursorHold > 0) return none; // taps don't count while the finisher has the cursor stopped
    this.tapAt = this.clampTap(t);
    try {
      return this.judge(t);
    } finally {
      this.tapAt = NaN;
    }
  }

  private judge(t: number): TapResult {
    const J = this.tuning.judge;
    const { chosen, d, cpos } = this.pick(t);
    this.recordAim(t, chosen, cpos);
    if (!chosen) {
      this.miss(cpos);
      return { outcome: 'miss', perfect: false, cursorPos: cpos, blockId: 0 };
    }
    const perfect = d <= (this.mod(J.perfectFrac, (h, v) => h.perfectFrac?.(this, chosen, v)) * chosen.width) / 2;
    let outcome: TapOutcome;
    if (chosen.kind === 'purple') outcome = this.triggerTrap(chosen);
    else if (isRed(chosen.kind)) outcome = this.blockRed(chosen, perfect);
    else if (chosen.kind === 'yellow' && this.guarder()) outcome = this.counter(chosen);
    else if (chosen.kind === 'ward') outcome = this.breakWard(chosen, perfect);
    else if (chosen.kind === 'hold') outcome = this.pressHold(chosen, t);
    else if (chosen.taps > 1 && isAttack(chosen.kind)) outcome = this.chip(chosen);
    else if (chosen.link) outcome = this.tapLinked(chosen, perfect);
    else outcome = this.hitAttack(chosen, perfect);
    const p = outcome === 'trap' || outcome === 'counter' || outcome === 'miss' ? false : outcome === 'hold' ? !!this.holding?.perfect : perfect;
    // (a 'link' tap: the pair's first, lit and waiting)
    return { outcome, perfect: p, cursorPos: cpos, blockId: chosen.id };
  }

  /**
   * One of a linked pair tapped. The first lights up and waits (nothing lands yet); its partner tapped within
   * tuning.links.beatSec lands both, harder (x links.bonus). If the beat runs out, both break: a miss.
   */
  private tapLinked(b: Block, perfect: boolean): TapOutcome {
    const L = this.linkLit;
    if (L && L.id === b.id) return 'link'; // the lit one again: nothing more happens
    if (L && L.id === b.link) {
      const first = this.blocks.find((x) => x.id === L.id);
      this.linkLit = null;
      b.link = 0;
      if (first) first.link = 0;
      this.events.push({ type: 'linkDone', ids: [L.id, b.id], pos: b.pos });
      this.linkBonus = true;
      let out: TapOutcome;
      try {
        this.pairHit = 1;
        if (first) this.hitAttack(first, L.perfect);
        this.pairHit = 2;
        out = this.hitAttack(b, perfect);
      } finally {
        this.linkBonus = false;
        this.pairHit = 0;
      }
      const x: LinkCtx = { pos: b.pos, forgive: false };
      for (const h of this.hooks) h.linked?.(this, x);
      // the Emberwright set's 4 pieces: a finished pair heals
      if (setPieces(this.hero.gear, 'emberwright') >= 4) this.healPerk(this.maxHp() * this.tuning.effects.emberHeal, 'emberwright');
      return out;
    }
    const partner = this.blocks.find((x) => x.id === b.link);
    if (!partner) {
      b.link = 0;
      return this.hitAttack(b, perfect);
    }
    if (L) this.breakLink(); // another pair was waiting: it breaks
    this.linkLit = { id: b.id, partner: partner.id, until: this.time + this.mod(this.tuning.links.beatSec, (h, v) => h.linkBeat?.(this, v)), perfect };
    this.events.push({ type: 'linkStart', id: b.id, partner: partner.id, pos: b.pos });
    return 'link';
  }

  /** The lit link's beat ran out (or another pair was started): both blocks break, and it counts as a miss. */
  private breakLink(): void {
    const L = this.linkLit;
    if (!L) return;
    this.linkLit = null;
    const pair = this.blocks.filter((x) => x.id === L.id || x.id === L.partner);
    for (const x of pair) x.link = 0;
    for (const x of pair) this.removeBlock(x, 'expire');
    const pos = pair[0]?.pos ?? this.cursorPos();
    this.events.push({ type: 'linkBroken', ids: [L.id, L.partner], pos });
    const x: LinkCtx = { pos, forgive: false };
    for (const h of this.hooks) h.linkBroken?.(this, x);
    if (!x.forgive) this.miss(pos, true);
  }

  /** An iced yellow takes a tap: its coat cracks (it needs `taps` in all); the combo holds, nothing else happens. */
  private chip(b: Block): TapOutcome {
    b.taps--;
    this.events.push({ type: 'chip', id: b.id, pos: b.pos, left: b.taps });
    return 'chip';
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
  private pick(t: number): { chosen: Block | null; d: number; cpos: number } {
    const r = this.reach(t);
    if (r.red) return { chosen: r.red, d: r.redD, cpos: r.cpos };
    if (r.best) return { chosen: r.best, d: r.bestD, cpos: r.cpos };
    return { chosen: r.trap, d: r.trapD, cpos: r.cpos };
  }

  /**
   * What the cursor reaches at time t (rewound like a tap): the nearest attack (red, shield, bomb, speed), the nearest
   * other block (and the nearest yellow/green among those), the nearest trap. Never a mirror, nor the hold being held.
   */
  private reach(t: number) {
    const J = this.tuning.judge;
    t = this.clampTap(t);
    const phase = this.phaseAt(t);
    const cpos = this.cursorPosAt(t);
    // the grace is a time window: it scales with the speed the cursor and the block close at (a red racing at
    // the cursor gets as many milliseconds as a still yellow; never less space than the cursor's own speed gives)
    const v = this.speedAtTime(t);
    const vSigned = ((phase % 2) + 2) % 2 < 1 ? v : -v;
    const cursorHalf = this.tuning.cursor.widthFrac / 2;
    let red: Block | null = null;
    let redD = Infinity;
    let best: Block | null = null;
    let bestD = Infinity;
    let attack: Block | null = null;
    let attackD = Infinity;
    let trap: Block | null = null;
    let trapD = Infinity;
    for (const b of this.blocks) {
      if (b.bornAt > t + 1e-9 || untappable(b.kind) || b.id === this.holding?.id) continue;
      const d = Math.abs(cpos - this.blockPosAt(b, t));
      const graceDist = Math.max(v, Math.abs(vSigned - b.vel)) * ((isRed(b.kind) ? J.redGraceMs : J.graceMs) / 1000);
      // a hold is pressed at its near edge: it's in reach from just before that edge, and a little way in
      if (b.kind === 'hold') {
        const dir = vSigned >= 0 ? 1 : -1;
        const edge = b.pos - (dir * b.width) / 2;
        const into = (cpos - edge) * dir;
        const lateMax = v * (this.tuning.hold.lateMs / 1000) * 2;
        if (into < -(cursorHalf + graceDist) || into > b.width) continue;
        const dd = into <= lateMax ? Math.abs(into) : b.width;
        if (dd < bestD) (best = b), (bestD = dd);
        if (dd < attackD) (attack = b), (attackD = dd);
        continue;
      }
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

  /** The red and the yellow/green under the cursor at time t (default: the tap being judged, else now), by the
   *  judge's reach; never a trap. */
  underCursor(t = Number.isNaN(this.tapAt) ? this.time : this.tapAt): { red: Block | null; attack: Block | null } {
    const r = this.reach(t);
    return { red: r.red, attack: r.attack };
  }

  /**
   * The tap's timing error against the yellow block it was aimed at (the one it hit, or for a miss the nearest
   * block if that's a yellow): ms after (+) or before (-) the cursor crossed the block's center.
   */
  private recordAim(t: number, chosen: Block | null, cpos: number): void {
    t = this.clampTap(t);
    const v = this.speedAtTime(t);
    if (v <= 0 || this.freeze > 0) return;
    let target: Block | null = chosen;
    if (!target) {
      let best = Infinity;
      for (const b of this.blocks) {
        if (b.bornAt > t + 1e-9) continue;
        const dd = Math.abs(cpos - this.blockPosAt(b, t));
        if (dd < best) (best = dd), (target = b);
      }
    }
    if (!target || target.kind !== 'yellow') return;
    const phase = ((this.phaseAt(t) % 2) + 2) % 2;
    const dir = phase < 1 ? 1 : -1;
    const err = ((cpos - this.blockPosAt(target, t)) * dir) / v;
    // only clear-cut samples: a yellow with no other block (or wall turn, or patch) near it, so the tap can't have
    // been meant for something else
    const tp = this.blockPosAt(target, t);
    if ((Math.min(tp, 1 - tp) / v) * 1000 < ISOLATION_MS) return;
    if (this.zones.some((z) => tp >= z.lo - 0.05 && tp <= z.hi + 0.05)) return;
    for (const b of this.blocks) if (b !== target && b.bornAt <= t + 1e-9 && (Math.abs(this.blockPosAt(b, t) - tp) / v) * 1000 < ISOLATION_MS) return;
    if (Math.abs(err) * 1000 <= AIM_WINDOW_MS) this.aims.push(Math.round(err * 1000));
  }

  /** Whether a tap at time t would land on nothing (lets input hold back a would-be miss that may be a swipe). */
  wouldMiss(t: number): boolean {
    return !this.result && this.cursorHold <= 0 && !this.pick(t).chosen;
  }

  /** The cursor's speed (bar units/s, patches included) that was in effect at time t. */
  speedAtTime(t: number): number {
    if (t >= this.time) return this.phaseVelNow() || this.cursorSpeed() * this.zoneMultAt(this.cursorPos());
    const i = this.histIndex(t);
    return this.hPhaseVel[i] || this.cursorSpeed();
  }

  private hitAttack(b: Block, perfect: boolean, echo = false): TapOutcome {
    const T = this.tuning;
    const H = this.hero;
    const st = heroStats(T, H);
    this.removeBlock(b, 'hit');
    const green = b.kind === 'green';
    const target = this.currentTarget();
    const x: HitCtx = { block: b, perfect, green, target, crit: false, damage: 0, echo };
    const outer = this.hitNow; // an echo resolves inside the hit that caused it
    this.hitNow = x;
    this.comboUp('hit', perfect);
    // Bellows Heart: a drifting block you hit fills more meter
    const stoked = b.vel !== 0 && !echo && this.has('bellowsHeart') ? T.effects.bellowsMeter : 1;
    this.addMeter(((green ? T.meter.perGreen : T.meter.perHit) + (perfect ? T.meter.perfectBonus : 0)) * stoked, green ? 'green' : 'hit');
    // a completed hold and a shattered frozen block hit harder
    let mult = green ? T.hero.greenMult : b.kind === 'hold' ? T.hold.mult : b.kind === 'frozen' ? T.blocks.frozenMult : 1;
    if (this.linkBonus) mult *= T.links.bonus; // a linked pair, both hit in time
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
    // the next region's gear: Wyrmfang (finished holds), the Rimewalker set's 2 pieces (hits on ice)
    if (b.kind === 'hold' && this.has('wyrmfang')) mult *= T.effects.wyrmfang;
    if (setPieces(this.hero.gear, 'rimewalker') >= 2 && this.iceAt(b.pos)) mult *= 1 + T.effects.rimeIce;
    // the third region's: the Emberwright set's 2 pieces (hits on drifting blocks)
    if (b.vel !== 0 && setPieces(this.hero.gear, 'emberwright') >= 2) mult *= 1 + T.effects.emberDrift;
    const damage = Math.max(1, Math.round(st.atk * mult));
    x.damage = damage;
    this.events.push({ type: 'hit', kind: b.kind, pos: b.pos, perfect, crit, damage, enemyId: target?.id ?? 0, combo: this.combo, echo });
    if (this.rush) this.rushPay(this.rushHitCoins(perfect));
    if (crit && this.has('leech')) this.healHero(this.tuning.effects.leechHp, 'leech');
    if (green) {
      H.abilityTimer = this.abilitySec();
      this.events.push({ type: 'ability' });
    }
    if (crit) this.startHitStop();
    if (target) this.damageEnemy(target, damage, crit, 'hit');
    if (b.kind === 'keg') this.kegBlast(b);
    // the Rimewalker set's 4 pieces: a finished hold heals
    if (b.kind === 'hold' && setPieces(this.hero.gear, 'rimewalker') >= 4) this.healPerk(this.maxHp() * T.effects.rimeHeal, 'rimewalker');
    // Titan's Maul: a finished pair's hits strike every other foe too
    if (this.pairHit && !echo && this.has('titanMaul') && target)
      for (const e of this.aliveFoes()) if (e !== target) this.damageEnemy(e, x.damage, x.crit, 'hit');
    if (!echo) this.companionTick();
    this.pendulumTick();
    for (const h of this.hooks) h.afterHit?.(this, x);
    this.hitNow = outer;
    return 'hit';
  }

  /** A keg goes off: it blasts every foe and knocks the reds near it off the bar; with Chain Fuse, kegs near it go
   *  off too. */
  kegBlast(keg: Block): void {
    const T = this.tuning;
    const r = this.mod(T.styles.kegRadius, (h, v) => h.kegRadius?.(this, v));
    this.events.push({ type: 'explode', pos: keg.pos, radius: r, own: true });
    const chained: Block[] = [];
    for (const o of this.blocks.slice()) {
      if (Math.abs(o.pos - keg.pos) > r) continue;
      if (isRed(o.kind)) {
        this.removeBlock(o, 'bomb');
        this.log.blocks++;
      } else if (o.kind === 'purple') this.removeBlock(o, 'bomb');
      else if (o.kind === 'keg' && this.perk.chainFuse) chained.push(o);
    }
    const dmg = Math.max(1, Math.round(heroAtk(T, this.hero) * T.styles.kegMult));
    for (const e of this.enemies) if (e.alive) this.damageEnemy(e, dmg, false, 'bomb');
    for (const k of chained) {
      if (!this.blocks.includes(k)) continue;
      this.removeBlock(k, 'bomb');
      this.kegBlast(k);
    }
  }

  /** How long the green ability lasts (the hero's kit: tuning.hero.abilitySec for Rowan, tuning.kits.<id>.abilitySec). */
  abilitySec(): number {
    const k = (this.tuning.kits as Record<string, { abilitySec?: number }>)[this.heroId];
    return k?.abilitySec ?? this.tuning.hero.abilitySec;
  }

  /** Start the green ability without a green hit. */
  startAbility(): void {
    this.hero.abilityTimer = Math.max(this.hero.abilityTimer, this.abilitySec());
    this.events.push({ type: 'ability' });
  }

  /** The combo goes up (normally by 1; perks may change that), and perks that watch it hear about it. */
  private comboUp(from: 'hit' | 'block' | 'ward', perfect: boolean): void {
    const before = this.combo;
    const n = Math.max(0, Math.round(this.mod(1, (h, v) => h.comboGain?.(this, from, perfect, v))));
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

  private blockRed(b: Block, perfect: boolean, echo = false): TapOutcome {
    const T = this.tuning;
    const owner = this.enemyById(b.ownerId);
    this.comboUp('block', perfect);
    this.addMeter(T.meter.perBlock + (perfect ? T.meter.perfectBonus : 0), 'block');
    if (this.has('golemheart')) this.healHero(T.effects.golemHeal, 'golemheart');
    if (this.has('ramshorn') && this.iceAt(b.pos)) this.healHero(T.effects.ramshornHeal, 'ramshorn');
    if (b.taps > 1) {
      b.taps--;
      // a still red (an ice wall) takes its taps where it stands; a travelling shield is knocked back
      const knock = b.still ? 0 : this.knockBack(b, T.blocks.shieldKnockback, T.blocks.knockbackSec);
      this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: true, ownerId: b.ownerId, combo: this.combo, knock, echo });
      this.pendulumTick();
      for (const h of this.hooks) h.afterBlock?.(this, { block: b, perfect, cracked: true, owner, echo });
      return 'crack';
    }
    this.removeBlock(b, 'hit');
    this.log.blocks++;
    this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: false, ownerId: b.ownerId, combo: this.combo, knock: 0, echo });
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
    for (const h of this.hooks) h.afterBlock?.(this, { block: b, perfect, cracked: false, owner, echo });
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
  private breakWard(b: Block, perfect: boolean): TapOutcome {
    const T = this.tuning;
    this.removeBlock(b, 'hit');
    this.comboUp('ward', perfect);
    this.addMeter(T.meter.perHit + (perfect ? T.meter.perfectBonus : 0), 'ward');
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

  private miss(pos: number, slip = false): void {
    if (!this.missForgiven && setPieces(this.hero.gear, 'footpad') >= 2) {
      // Footpad set: the fight's first miss doesn't break the combo (or hurt)
      this.missForgiven = true;
      this.events.push({ type: 'miss', pos, selfDamage: false });
      this.events.push({ type: 'gearFx', fx: 'footpad', amount: 0, enemyId: 0 });
      return;
    }
    const classic = this.settings.mode === 'classic';
    const x: MissCtx = { slip, damage: classic && !this.rush ? this.tuning.judge.missSelfDamage : 0, breaks: true };
    for (const h of this.hooks) h.miss?.(this, x);
    this.events.push({ type: 'miss', pos, selfDamage: x.damage > 0 });
    if (x.damage > 0) this.heroDamage(x.damage, 'miss', 0, !x.breaks);
    else if (x.breaks) this.breakCombo('miss');
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
    const x: FinisherCtx = { stacks, combo, damage: this.finisherDamage(stacks), targets: this.enemies.filter((e) => e.alive), killed: 0, keepCombo: false, reds: 'clear' };
    const dmg = Math.round(x.damage * this.mod(1, (h, v) => h.finisher?.(this, x, v)));
    x.damage = dmg;
    // Every red block on the bar is knocked off it (or the kit keeps them: frozen, pinned; or clears everything); the
    // enemies keep attacking on their normal schedule.
    for (const b of this.blocks.slice())
      if (x.reds === 'all' ? b.kind !== 'mirror' : isRed(b.kind) && x.reds === 'clear') this.removeBlock(b, 'finisher');
    this.meter = 0;
    this.stacks = 0;
    if (!x.keepCombo) {
      this.combo = 0;
      this.speedStacks = 0;
    }
    this.events.push({ type: 'finisher', damage: dmg, combo, stacks, targets: x.targets.map((e) => e.id) });
    this.log.bestFinisher = Math.max(this.log.bestFinisher, stacks);
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
    // not between waves (it would hit nobody), and never while a hold is held (a hold is not a swipe)
    return this.stacks >= 1 && !this.result && !this.holding && this.enemies.some((e) => e.alive);
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
  private addMeter(x: number, source: MeterSource = 'perk'): void {
    const max = this.maxStacks();
    x = this.mod(x, (h, v) => h.meter?.(this, source, v));
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
  private breakCombo(cause: BreakCtx['cause']): void {
    this.log.breaks++;
    const x: BreakCtx = { combo: this.combo, stacks: this.stacks, meter: this.meter, keepCombo: 0, keepStacks: 0, keepMeter: 0, cause };
    for (const h of this.hooks) h.comboBreak?.(this, x);
    const combo = Math.max(0, Math.min(this.combo, Math.round(x.keepCombo)));
    const stacks = Math.max(0, Math.min(this.stacks, Math.round(x.keepStacks)));
    const meter = Math.max(0, Math.min(this.meter, x.keepMeter));
    if (this.combo > combo || this.stacks > stacks || this.meter > meter) this.events.push({ type: 'comboBreak', lost: this.combo - combo, lostStacks: this.stacks - stacks });
    this.combo = combo;
    this.meter = stacks >= this.maxStacks() ? 1 : meter;
    this.stacks = stacks;
  }

  private heroDamage(amount: number, source: HurtSource, enemyId: number, keepCombo = false, perk?: string): void {
    const H = this.hero;
    // Defense cuts the damage of reds (and bombs) that got through
    const cut = source === 'red' || source === 'bomb' ? afterDefense(this.tuning, amount, heroStats(this.tuning, H).def) : amount;
    const hooked = this.mod(cut, (h, v) => h.hurt?.(this, v, source, enemyId));
    const dmg = this.settings.godMode || this.practice ? 0 : Math.max(0, Math.round(hooked));
    if (source !== 'miss' && source !== 'perk' && dmg > 0) this.log.hits++;
    H.hp = Math.max(0, H.hp - dmg);
    if (!keepCombo) {
      this.breakCombo(source === 'miss' ? 'miss' : source === 'perk' ? 'perk' : 'hurt');
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

  /** The companions in this fight (Pip alone when the build names none: tests and old callers). */
  get pets(): PetBuild[] {
    return this.hero.build?.pets ?? [{ id: 'pip', level: 1, stars: 1 }];
  }

  /** Each companion attacks after every N attack hits (Pip's N is companion.everyHits; 0 = no companions): the target,
   *  or every foe (Sunny's breath). Its damage: the companion stat x its own share, its level and stars. */
  private companionTick(): void {
    const P = this.tuning.companion;
    if (P.everyHits <= 0 || this.result) return;
    const base = heroStats(this.tuning, this.hero).companion;
    this.pets.forEach((pet, i) => {
      const def = COMPANIONS[pet.id];
      if (!def) return;
      let every = pet.id === 'pip' ? P.everyHits : def.every;
      // Owl Eye: Pip pecks more often; 3 stars: one hit sooner
      if (pet.id === 'pip' && this.has('owlEye')) every = Math.min(every, Math.max(1, Math.round(this.tuning.effects.owlEvery)));
      if (pet.stars >= 3) every = Math.max(2, every - 1);
      this.petCharges[i] = (this.petCharges[i] ?? 0) + 1;
      if (this.petCharges[i] < every) return;
      this.petCharges[i] = 0;
      const target = this.currentTarget();
      const T = this.tuning.pets;
      const dmg = Math.round(base * def.dmg * (1 + T.levelDmg * (pet.level - 1)) * (1 + T.starDmg * (pet.stars - 1)));
      if (!target || dmg <= 0) return;
      this.pecks++;
      const x: PeckCtx = { pet: pet.id, target, damage: dmg, crit: false, count: this.pecks };
      for (const h of this.hooks) h.peck?.(this, x);
      this.events.push({ type: 'pet', pet: pet.id, enemyId: target.id, damage: x.damage, crit: x.crit });
      this.damageEnemy(target, x.damage, x.crit, 'pet');
      if (def.allFoes) for (const e of this.aliveFoes()) if (e !== target) this.damageEnemy(e, x.damage, x.crit, 'pet');
      for (const h of this.hooks) h.afterPeck?.(this, x);
    });
  }

  /** Damage after shells (attack hits) and summon protection. */
  damageTaken(e: Enemy, dmg: number, source: DamageSource): number {
    let mult = hasAura(this.hero.gear, 'radiance') ? 1 + this.tuning.effects.radiance : 1;
    if (source === 'hit' && e.shell < 1) mult *= e.shell;
    if (e.protect < 1 && this.summonsAlive(e.id)) mult *= e.protect;
    mult = this.mod(mult, (h, v) => h.damageTaken?.(this, e, source, v));
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
