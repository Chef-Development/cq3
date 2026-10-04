// Deterministic combat simulation. No Phaser imports: Phaser only renders this state and feeds input.
// Time is in seconds of simulation time, advanced in fixed 1/120 s ticks.

import type { FormationEntry, SpecialDef } from '../data/types';
import { CODE_KIND, isAttack, isRed, type BlockKind } from './blocks';
import { finisherShowMs } from './impact';
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
}

export function newHero(t: Tuning): Hero {
  return {
    hp: t.hero.maxHp,
    bonusAtk: 0,
    bonusMaxHp: 0,
    bonusDmg: 0,
    bonusCrit: 0,
    bonusCritDmg: 0,
    bonusComboPower: 0,
    bonusPet: 0,
    revives: t.hero.revivesPerAct,
    abilityTimer: 0,
  };
}

export const heroMaxHp = (t: Tuning, h: Hero): number => t.hero.maxHp + h.bonusMaxHp;
/** Attack after kill gains and damage boosts. */
export const heroAtk = (t: Tuning, h: Hero): number => (t.hero.atk + h.bonusAtk) * (1 + h.bonusDmg);

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

export type RemoveReason = 'hit' | 'bomb' | 'expire' | 'impact' | 'owner' | 'revive' | 'finisher' | 'counter';
export type HurtSource = 'red' | 'bomb' | 'trap' | 'miss' | 'counter';

export type CombatEvent =
  | { type: 'hit'; kind: BlockKind; pos: number; perfect: boolean; crit: boolean; damage: number; enemyId: number; combo: number }
  | { type: 'block'; kind: BlockKind; pos: number; perfect: boolean; cracked: boolean; ownerId: number; combo: number; knock: number }
  | { type: 'trap'; pos: number; damage: number; enemyId: number }
  | { type: 'counter'; pos: number; damage: number; enemyId: number }
  | { type: 'wardBreak'; pos: number; enemyId: number; left: number; perfect: boolean; combo: number }
  | { type: 'miss'; pos: number; selfDamage: boolean }
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
  | { type: 'heroHurt'; damage: number; source: HurtSource; enemyId: number }
  | { type: 'enemyHurt'; enemyId: number; damage: number; crit: boolean; source: 'hit' | 'bomb' | 'finisher' | 'pet' }
  | { type: 'heal'; amount: number }
  | { type: 'statGain'; enemyId: number; atk: number; maxHp: number; comboPower: number }
  | { type: 'pet'; enemyId: number; damage: number }
  | { type: 'kill'; enemyId: number }
  | { type: 'explode'; pos: number; radius: number }
  | { type: 'finisher'; damage: number; combo: number; stacks: number }
  | { type: 'ability' }
  | { type: 'speedUp'; mult: number }
  | { type: 'comboBreak'; lost: number; lostStacks: number }
  | { type: 'meterFull'; stacks: number }
  | { type: 'revive' }
  | { type: 'defeat' }
  | { type: 'won' }
  | { type: 'hitStop'; ms: number }
  | { type: 'cursorReset' };

export type TapOutcome = 'hit' | 'block' | 'crack' | 'trap' | 'counter' | 'ward' | 'miss' | 'none';

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
  /** Seconds the cursor stays stopped during the finisher; when it runs out the cursor restarts from the left. */
  cursorHold = 0;
  /** Seconds the cursor stays frozen in place (a Stomp); taps still count, judged where it stands. */
  freeze = 0;
  /** The cursor speed multiplier never drops below this for the rest of the fight (an enraged boss). */
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
  blocks: Block[] = [];
  enemies: Enemy[];
  targetId: number | null = null;
  events: CombatEvent[] = [];
  killQueue: number[] = [];
  result: null | 'won' | 'lost' = null;
  spawning: boolean;
  /** The fight started with more than one enemy (spawns come a little faster). */
  readonly groupFight: boolean;
  /** Attack hits since the companion last pecked. */
  petCharge = 0;

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
    this.spawning = o.spawning ?? true;
    this.specialsOn = o.specials ?? this.spawning;
    this.hpMult = o.hpMult ?? 1;
    this.atkMult = o.atkMult ?? 1;
    this.spawnRng = new Rng(o.seed);
    this.critRng = new Rng(o.seed ^ 0x5bd1e995);
    this.combo = o.carry?.combo ?? 0;
    this.meter = o.carry?.meter ?? 0;
    this.stacks = o.carry?.stacks ?? 0;
    this.speedStacks = o.carry?.speedStacks ?? 0;
    this.cursorPhase = o.carry?.cursorPhase ?? 0;
    if (o.restore) {
      this.enemies = o.restore.map((f, slot) => {
        const e = this.makeEnemy(f.key, slot);
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
      });
    } else this.enemies = o.enemies.map((key, slot) => this.makeEnemy(key, slot));
    this.groupFight = this.enemies.length > 1;
    if (o.enemyHp && !o.restore)
      this.enemies.forEach((e, i) => {
        const hp = o.enemyHp![i];
        if (hp === undefined || !Number.isFinite(hp)) return;
        e.hp = Math.max(0, Math.min(e.maxHp, Math.round(hp)));
        e.alive = e.hp > 0;
      });
    if (this.enemies.every((e) => !e.alive)) this.result = 'won';
    if (this.spawning) {
      const front = this.frontEnemy() ?? this.enemies[0];
      for (let i = 0; i < this.tuning.blocks.openingSpawns; i++) this.trySpawn('yellow', front.id);
    }
    this.record();
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
    const m = (1 + c.speedPerHit * this.combo) * (1 + c.speedBlockBonus * this.speedStacks);
    return Math.max(this.minSpeed, Math.min(c.maxSpeedMult, m));
  }

  /** Cursor speed in bar-widths per second (one pass = 1 unit of phase). */
  cursorSpeed(): number {
    return this.speedMult() / this.tuning.cursor.basePassSec;
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

  cursorPosAt(t: number): number {
    return phaseToPos(this.phaseAt(t));
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
    if (!this.result && this.enemies.every((x) => !x.alive)) {
      this.result = 'won';
      this.events.push({ type: 'won' });
    }
  }

  private updateBlocks(): void {
    const B = this.tuning.blocks;
    for (const b of this.blocks.slice()) {
      if (this.result) return;
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

  /** Red travel velocity (bar units per second, leftward) for a block of width w at `speed` times normal. */
  redVel(w: number, speed = 1): number {
    return (-(1 - w) / this.tuning.blocks.redTravelSec) * Math.max(0.1, speed);
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
        e.spawnTimer = Math.max(e.spawnTimer, 0) + def.interval * B.spawnRateMult * groupMult;
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

  /** A random spot (block center) where a static block of width w fits without touching the others, or null. */
  freeSpot(w: number, tries = 16): number | null {
    const B = this.tuning.blocks;
    const statics = this.blocks.filter((b) => !isRed(b.kind));
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
    o: { speed?: number; taps?: number; life?: number; heal?: number; special?: boolean } = {},
  ): Block {
    const B = this.tuning.blocks;
    const speed = o.speed ?? 1;
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
    this.blocks.push(b);
    this.events.push({ type: 'spawn', id: b.id, kind, ownerId, special: !!o.special });
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
  tap(t: number): TapResult {
    const none: TapResult = { outcome: 'none', perfect: false, cursorPos: 0, blockId: 0 };
    if (this.result || this.cursorHold > 0) return none; // taps don't count while the finisher has the cursor stopped
    const J = this.tuning.judge;
    const { chosen, d, cpos } = this.pick(t);
    if (!chosen) {
      this.miss(cpos);
      return { outcome: 'miss', perfect: false, cursorPos: cpos, blockId: 0 };
    }
    const perfect = d <= (J.perfectFrac * chosen.width) / 2;
    let outcome: TapOutcome;
    if (chosen.kind === 'purple') outcome = this.triggerTrap(chosen);
    else if (isRed(chosen.kind)) outcome = this.blockRed(chosen, perfect);
    else if (chosen.kind === 'yellow' && this.guarder()) outcome = this.counter(chosen);
    else if (chosen.kind === 'ward') outcome = this.breakWard(chosen, perfect);
    else outcome = this.hitAttack(chosen, perfect);
    return { outcome, perfect: outcome === 'trap' || outcome === 'counter' ? false : perfect, cursorPos: cpos, blockId: chosen.id };
  }

  /** The block a tap at time t would land on (nearest under the cursor; purple only if nothing else is). */
  private pick(t: number): { chosen: Block | null; d: number; cpos: number } {
    const J = this.tuning.judge;
    const now = this.time;
    t = Math.min(now + DT, Math.max(now - J.maxRewindMs / 1000, t));
    const cpos = this.cursorPosAt(t);
    const graceDist = this.speedAtTime(t) * (J.graceMs / 1000);
    const cursorHalf = this.tuning.cursor.widthFrac / 2;
    let best: Block | null = null;
    let bestD = Infinity;
    let trap: Block | null = null;
    let trapD = Infinity;
    for (const b of this.blocks) {
      if (b.bornAt > t + 1e-9) continue;
      const d = Math.abs(cpos - this.blockPosAt(b, t));
      if (d > b.width / 2 + cursorHalf + graceDist) continue;
      if (b.kind === 'purple') {
        if (d < trapD) (trap = b), (trapD = d);
      } else if (d < bestD) (best = b), (bestD = d);
    }
    const chosen = best ?? trap;
    return { chosen, d: chosen === best ? bestD : trapD, cpos };
  }

  /** Whether a tap at time t would land on nothing (lets input hold back a would-be miss that may be a swipe). */
  wouldMiss(t: number): boolean {
    return !this.result && this.cursorHold <= 0 && !this.pick(t).chosen;
  }

  /** Cursor speed (bar units/s) that was in effect at time t. */
  private speedAtTime(t: number): number {
    if (t >= this.time) return this.cursorSpeed();
    const i = this.histIndex(t);
    return this.hPhaseVel[i] || this.cursorSpeed();
  }

  private hitAttack(b: Block, perfect: boolean): TapOutcome {
    const T = this.tuning;
    const H = this.hero;
    this.removeBlock(b, 'hit');
    this.combo++;
    const green = b.kind === 'green';
    this.addMeter((green ? T.meter.perGreen : T.meter.perHit) + (perfect ? T.meter.perfectBonus : 0));
    const target = this.currentTarget();
    let mult = green ? T.hero.greenMult : 1;
    if (this.settings.comboTiers) mult *= tierMult(T, this.combo);
    const critChance =
      T.hero.critChance + H.bonusCrit + (H.abilityTimer > 0 ? T.hero.abilityCritBonus : 0) + (perfect ? T.hero.perfectCritBonus : 0);
    const crit = this.critRng.next() < critChance;
    const damage = Math.max(1, Math.round(heroAtk(T, H) * mult * (crit ? T.hero.critDmg + H.bonusCritDmg : 1)));
    this.events.push({ type: 'hit', kind: b.kind, pos: b.pos, perfect, crit, damage, enemyId: target?.id ?? 0, combo: this.combo });
    if (green) {
      H.abilityTimer = T.hero.abilitySec;
      this.events.push({ type: 'ability' });
    }
    if (crit) this.startHitStop();
    if (target) this.damageEnemy(target, damage, crit, 'hit');
    this.companionTick();
    return 'hit';
  }

  private blockRed(b: Block, perfect: boolean): TapOutcome {
    const T = this.tuning;
    this.combo++;
    this.addMeter(T.meter.perBlock + (perfect ? T.meter.perfectBonus : 0));
    if (b.taps > 1) {
      b.taps--;
      const knock = this.knockBack(b, T.blocks.shieldKnockback, T.blocks.knockbackSec);
      this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: true, ownerId: b.ownerId, combo: this.combo, knock });
      return 'crack';
    }
    this.removeBlock(b, 'hit');
    this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: false, ownerId: b.ownerId, combo: this.combo, knock: 0 });
    if (b.kind === 'speed') {
      this.speedStacks++;
      this.events.push({ type: 'speedUp', mult: this.speedMult() });
    }
    if (b.kind === 'bomb') this.explode(b);
    return 'block';
  }

  private explode(bomb: Block): void {
    const r = this.tuning.blocks.bombRadius;
    this.events.push({ type: 'explode', pos: bomb.pos, radius: r });
    for (const o of this.blocks.slice()) {
      if (Math.abs(o.pos - bomb.pos) <= r) this.removeBlock(o, 'bomb');
    }
    const dmg = Math.round(this.tuning.blocks.bombDamage);
    if (dmg > 0) for (const e of this.enemies) if (e.alive) this.damageEnemy(e, dmg, false, 'bomb');
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
    this.combo++;
    this.addMeter(T.meter.perHit + (perfect ? T.meter.perfectBonus : 0));
    const left = this.blocks.filter((x) => x.kind === 'ward' && x.ownerId === b.ownerId).length;
    this.events.push({ type: 'wardBreak', pos: b.pos, enemyId: b.ownerId, left, perfect, combo: this.combo });
    const owner = this.enemyById(b.ownerId);
    if (owner && left === 0) this.endShell(owner);
    return 'ward';
  }

  private triggerTrap(b: Block): TapOutcome {
    this.removeBlock(b, 'hit');
    const owner = this.enemyById(b.ownerId);
    const damage = owner ? owner.special : 0;
    this.events.push({ type: 'trap', pos: b.pos, damage, enemyId: b.ownerId });
    this.heroDamage(damage, 'trap', b.ownerId);
    return 'trap';
  }

  private miss(pos: number): void {
    const classic = this.settings.mode === 'classic';
    this.events.push({ type: 'miss', pos, selfDamage: classic });
    if (classic) this.heroDamage(this.tuning.judge.missSelfDamage, 'miss', 0);
    else this.breakCombo();
  }

  /** Damage the finisher would deal right now (0 if no stacks are banked). */
  finisherDamage(stacks = this.stacks): number {
    if (stacks < 1) return 0;
    const T = this.tuning;
    const H = this.hero;
    let dmg = heroAtk(T, H) * (T.hero.comboPower + H.bonusComboPower) * Math.pow(stacks, T.meter.stackExp);
    if (this.settings.comboTiers) dmg *= tierMult(T, this.combo);
    return Math.round(dmg);
  }

  /** Fire the finisher with every banked stack. */
  finisher(): boolean {
    if (this.result || this.stacks < 1) return false;
    const combo = this.combo;
    const stacks = this.stacks;
    const dmg = this.finisherDamage(stacks);
    // Every red block on the bar is knocked off it; the enemies keep attacking on their normal schedule.
    for (const b of this.blocks.slice()) if (isRed(b.kind)) this.removeBlock(b, 'finisher');
    this.meter = 0;
    this.stacks = 0;
    this.combo = 0;
    this.speedStacks = 0;
    this.events.push({ type: 'finisher', damage: dmg, combo, stacks });
    // the cursor stops while the finisher plays out, then restarts from the left
    this.cursorHold = (finisherShowMs(stacks) / 1000) * Math.max(0, this.tuning.meter.finisherHold);
    this.startHitStop();
    if (dmg > 0) for (const e of this.enemies) if (e.alive) this.damageEnemy(e, dmg, false, 'finisher');
    return true;
  }

  get finisherReady(): boolean {
    return this.stacks >= 1 && !this.result;
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
  private addMeter(x: number): void {
    const max = Math.max(1, Math.round(this.tuning.meter.maxStacks));
    if (this.stacks >= max) {
      this.meter = 1;
      return;
    }
    this.meter += x;
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

  /** A miss or a hit taken breaks the combo and loses every banked stack and the meter. */
  private breakCombo(): void {
    if (this.combo > 0 || this.stacks > 0 || this.meter > 0) this.events.push({ type: 'comboBreak', lost: this.combo, lostStacks: this.stacks });
    this.combo = 0;
    this.meter = 0;
    this.stacks = 0;
  }

  private heroDamage(amount: number, source: HurtSource, enemyId: number): void {
    const H = this.hero;
    const dmg = this.settings.godMode ? 0 : Math.max(0, Math.round(amount));
    H.hp = Math.max(0, H.hp - dmg);
    this.breakCombo();
    this.speedStacks = 0;
    this.events.push({ type: 'heroHurt', damage: dmg, source, enemyId });
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
    if (P.everyHits <= 0 || this.result) return;
    this.petCharge++;
    if (this.petCharge < P.everyHits) return;
    this.petCharge = 0;
    const target = this.currentTarget();
    const dmg = Math.round(P.damage + this.hero.bonusPet);
    if (!target || dmg <= 0) return;
    this.events.push({ type: 'pet', enemyId: target.id, damage: dmg });
    this.damageEnemy(target, dmg, false, 'pet');
  }

  /** Damage after shells (attack hits) and summon protection. */
  damageTaken(e: Enemy, dmg: number, source: 'hit' | 'bomb' | 'finisher' | 'pet'): number {
    let mult = 1;
    if (source === 'hit' && e.shell < 1) mult *= e.shell;
    if (e.protect < 1 && this.summonsAlive(e.id)) mult *= e.protect;
    return mult === 1 ? dmg : Math.max(1, Math.round(dmg * mult));
  }

  /** HP an enemy can't be taken below yet: a boss phase change (a gated special) has to fire first. */
  hpFloor(e: Enemy): number {
    let floor = 0;
    this.specialsOf(e).forEach((sp, i) => {
      if (sp.gate && sp.hpBelow !== undefined && !e.uses[i]) floor = Math.max(floor, Math.ceil(sp.hpBelow * e.maxHp) - 1);
    });
    return floor;
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, source: 'hit' | 'bomb' | 'finisher' | 'pet'): void {
    if (!e.alive) return;
    dmg = this.damageTaken(e, dmg, source);
    const floor = Math.min(e.hp, this.hpFloor(e));
    const dealt = Math.min(dmg, e.hp - floor);
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
    this.events.push({ type: 'kill', enemyId: e.id });
    // kill rewards: permanent stat gains for the rest of the run
    const K = this.tuning.kill;
    if (this.hero.hp > 0 && (K.atk || K.maxHp || K.comboPower)) {
      this.hero.bonusAtk += K.atk;
      this.hero.bonusMaxHp += K.maxHp;
      this.hero.hp += K.maxHp;
      this.hero.bonusComboPower += K.comboPower;
      this.events.push({ type: 'statGain', enemyId: e.id, atk: K.atk, maxHp: K.maxHp, comboPower: K.comboPower });
    }
    const heal = Math.min(heroMaxHp(this.tuning, this.hero) - this.hero.hp, Math.round(heroMaxHp(this.tuning, this.hero) * this.tuning.hero.healOnKill));
    if (heal > 0 && this.hero.hp > 0) {
      this.hero.hp += heal;
      this.events.push({ type: 'heal', amount: heal });
    }
    this.killQueue.push(e.id);
    // linked summons run off when their summoner falls
    for (const x of this.enemies) if (x.alive && x.summoner === e.id) this.retire(x, 'fled');
    this.checkWon();
  }

  /** The enemies as they stand, for a mid-fight save (summons and splits included; gone ones saved with 0 HP). */
  saveFoes(): SavedFoe[] {
    return this.enemies.map((e) => ({
      key: e.key,
      hp: e.alive ? e.hp : 0,
      maxHp: e.maxHp,
      phase: e.phase,
      uses: e.uses.slice(),
      summoner: e.summoner ? this.enemies.findIndex((x) => x.id === e.summoner) : -1,
      protect: e.protect,
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
