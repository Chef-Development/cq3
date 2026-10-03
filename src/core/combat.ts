// Deterministic combat simulation. No Phaser imports: Phaser only renders this state and feeds input.
// Time is in seconds of simulation time, advanced in fixed 1/120 s ticks.

import { Rng } from './rng';
import type { BlockCode, Settings, Tuning } from './tuning';

export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;
const HIST = 128; // ~1 s of cursor history for rewinding tap timestamps

export type BlockKind = 'yellow' | 'green' | 'red' | 'shield' | 'bomb' | 'speed' | 'purple';

export const CODE_KIND: Record<BlockCode, BlockKind> = {
  Y: 'yellow',
  G: 'green',
  R: 'red',
  S: 'shield',
  B: 'bomb',
  F: 'speed',
  P: 'purple',
};

export const isRed = (k: BlockKind): boolean => k === 'red' || k === 'shield' || k === 'bomb' || k === 'speed';
export const isAttack = (k: BlockKind): boolean => k === 'yellow' || k === 'green';

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
  push: number; // distance still to slide right after a finisher (0 = none)
}

export interface Enemy {
  id: number;
  key: string;
  slot: number; // 0 = front (closest to the hero)
  hp: number;
  maxHp: number;
  alive: boolean;
  spawnTimer: number;
  seq: number;
}

export interface Hero {
  hp: number;
  bonusMaxHp: number;
  bonusDmg: number;
  bonusCrit: number;
  bonusCritDmg: number;
  bonusComboPower: number;
  revives: number;
  abilityTimer: number;
}

export function newHero(t: Tuning): Hero {
  return {
    hp: t.hero.maxHp,
    bonusMaxHp: 0,
    bonusDmg: 0,
    bonusCrit: 0,
    bonusCritDmg: 0,
    bonusComboPower: 0,
    revives: t.hero.revivesPerLevel,
    abilityTimer: 0,
  };
}

export const heroMaxHp = (t: Tuning, h: Hero): number => t.hero.maxHp + h.bonusMaxHp;

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

export type RemoveReason = 'hit' | 'bomb' | 'expire' | 'impact' | 'owner' | 'revive';

export type CombatEvent =
  | { type: 'hit'; kind: BlockKind; pos: number; perfect: boolean; crit: boolean; damage: number; enemyId: number; combo: number }
  | { type: 'block'; kind: BlockKind; pos: number; perfect: boolean; cracked: boolean; ownerId: number; combo: number }
  | { type: 'trap'; pos: number; damage: number; enemyId: number }
  | { type: 'miss'; pos: number; selfDamage: boolean }
  | { type: 'remove'; id: number; kind: BlockKind; pos: number; ownerId: number; reason: RemoveReason }
  | { type: 'spawn'; id: number; kind: BlockKind; ownerId: number }
  | { type: 'windup'; enemyId: number }
  | { type: 'heroHurt'; damage: number; source: 'red' | 'bomb' | 'trap' | 'miss'; enemyId: number }
  | { type: 'enemyHurt'; enemyId: number; damage: number; crit: boolean; source: 'hit' | 'bomb' | 'finisher' }
  | { type: 'kill'; enemyId: number }
  | { type: 'explode'; pos: number; radius: number }
  | { type: 'finisher'; damage: number; combo: number }
  | { type: 'ability' }
  | { type: 'speedUp'; mult: number }
  | { type: 'comboBreak'; lost: number }
  | { type: 'meterFull' }
  | { type: 'revive' }
  | { type: 'defeat' }
  | { type: 'won' }
  | { type: 'hitStop'; ms: number };

export type TapOutcome = 'hit' | 'block' | 'crack' | 'trap' | 'miss' | 'none';

export interface TapResult {
  outcome: TapOutcome;
  perfect: boolean;
  cursorPos: number;
  blockId: number;
}

export interface Carry {
  combo: number;
  meter: number;
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
  meter = 0;
  blocks: Block[] = [];
  enemies: Enemy[];
  targetId: number | null = null;
  events: CombatEvent[] = [];
  killQueue: number[] = [];
  result: null | 'won' | 'lost' = null;
  spawning: boolean;
  readonly groupFight: boolean;

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
    this.spawnRng = new Rng(o.seed);
    this.critRng = new Rng(o.seed ^ 0x5bd1e995);
    this.combo = o.carry?.combo ?? 0;
    this.meter = o.carry?.meter ?? 0;
    this.speedStacks = o.carry?.speedStacks ?? 0;
    this.cursorPhase = o.carry?.cursorPhase ?? 0;
    this.groupFight = o.enemies.length > 1;
    this.enemies = o.enemies.map((key, slot) => {
      const def = this.tuning.enemies[key];
      if (!def) throw new Error(`Unknown enemy ${key}`);
      return {
        id: this.nextId++,
        key,
        slot,
        hp: def.hp,
        maxHp: def.hp,
        alive: true,
        spawnTimer: def.interval * 0.6 + slot * 0.35,
        seq: 0,
      };
    });
    if (this.spawning) {
      for (let i = 0; i < this.tuning.blocks.openingSpawns; i++) this.trySpawn('yellow', this.enemies[0].id);
    }
    this.record();
  }

  get time(): number {
    return this.tick * DT;
  }

  // ---------------------------------------------------------------- speed & history

  speedMult(): number {
    const c = this.tuning.cursor;
    const m = (1 + c.speedPerHit * this.combo) * (1 + c.speedBlockBonus * this.speedStacks);
    return Math.min(c.maxSpeedMult, m);
  }

  /** Cursor speed in bar-widths per second (one pass = 1 unit of phase). */
  cursorSpeed(): number {
    return this.speedMult() / this.tuning.cursor.basePassSec;
  }

  private phaseVelNow(): number {
    return this.hitStop > 0 || this.result ? 0 : this.cursorSpeed();
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
    this.cursorPhase += this.cursorSpeed() * DT;
    if (this.hero.abilityTimer > 0) this.hero.abilityTimer = Math.max(0, this.hero.abilityTimer - DT);
    this.updateBlocks();
    if (this.spawning && !this.result) this.updateSpawners();
    this.record();
  }

  private updateBlocks(): void {
    const B = this.tuning.blocks;
    for (const b of this.blocks.slice()) {
      if (this.result) return;
      if (isRed(b.kind)) {
        const half = b.width / 2;
        if (b.push > 0) {
          // Finisher pushback: slide right, then resume the normal leftward travel.
          const T = this.tuning.meter;
          const speed = T.pushbackSec > 0 ? T.finisherPushback / T.pushbackSec : Infinity;
          const d = Math.min(b.push, speed * DT);
          b.push -= d;
          if (b.push < 1e-9) b.push = 0;
          b.pos = Math.min(1 - half, b.pos + d);
          b.vel = b.push > 0 ? speed : -(1 - b.width) / B.redTravelSec;
        } else if (b.impactTimer < 0) {
          b.vel = -(1 - b.width) / B.redTravelSec;
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
        if (b.life <= 0) this.removeBlock(b, 'expire');
      }
    }
  }

  private impact(b: Block): void {
    this.removeBlock(b, 'impact');
    const owner = this.enemyById(b.ownerId);
    const atk = owner ? this.tuning.enemies[owner.key].atk : 0;
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
      if (!e.alive) continue;
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

  /** Spawn a block from a pattern (random free position for static blocks, right end for reds). */
  trySpawn(kind: BlockKind, ownerId: number): boolean {
    const B = this.tuning.blocks;
    if (isRed(kind)) {
      const w = B.redWidth;
      const reds = this.blocks.filter((b) => isRed(b.kind));
      if (reds.length >= B.maxRed) return false;
      const p = 1 - w / 2;
      if (reds.some((r) => Math.abs(r.pos - p) < (r.width + w) / 2 + B.minGap)) return false;
      this.spawnBlock(kind, p, ownerId);
      return true;
    }
    const w = kind === 'purple' ? B.trapWidth : B.attackWidth;
    const statics = this.blocks.filter((b) => !isRed(b.kind));
    if (statics.length >= B.maxStatic) return false;
    const lo = B.edgeMargin + w / 2;
    const hi = 1 - B.edgeMargin - w / 2;
    if (hi < lo) return false;
    for (let tries = 0; tries < 16; tries++) {
      const p = this.spawnRng.range(lo, hi);
      if (statics.every((s) => Math.abs(s.pos - p) >= (s.width + w) / 2 + B.minGap)) {
        this.spawnBlock(kind, p, ownerId);
        return true;
      }
    }
    return false;
  }

  /** Place a block directly (also used by tests and the debug panel). */
  spawnBlock(kind: BlockKind, pos: number, ownerId: number = this.enemies[0]?.id ?? 0): Block {
    const B = this.tuning.blocks;
    const width = isRed(kind) ? B.redWidth : kind === 'purple' ? B.trapWidth : B.attackWidth;
    const b: Block = {
      id: this.nextId++,
      kind,
      ownerId,
      pos: Math.min(1 - width / 2, Math.max(width / 2, pos)),
      width,
      vel: isRed(kind) ? -(1 - width) / B.redTravelSec : 0,
      taps: kind === 'shield' ? Math.max(1, Math.round(B.shieldHits)) : 1,
      bornAt: this.time,
      life: kind === 'purple' ? B.trapLifeSec : isAttack(kind) && B.attackLifeSec > 0 ? B.attackLifeSec : Infinity,
      impactTimer: -1,
      push: 0,
    };
    this.blocks.push(b);
    this.events.push({ type: 'spawn', id: b.id, kind, ownerId });
    if (isRed(kind)) this.events.push({ type: 'windup', enemyId: ownerId });
    return b;
  }

  private removeBlock(b: Block, reason: RemoveReason): void {
    const i = this.blocks.indexOf(b);
    if (i < 0) return;
    this.blocks.splice(i, 1);
    this.events.push({ type: 'remove', id: b.id, kind: b.kind, pos: b.pos, ownerId: b.ownerId, reason });
  }

  // ---------------------------------------------------------------- input

  /**
   * Judge a bar tap that happened at sim time `t` (already corrected by calibration).
   * Positions are rewound to `t`; effects apply to the current state.
   */
  tap(t: number): TapResult {
    const none: TapResult = { outcome: 'none', perfect: false, cursorPos: 0, blockId: 0 };
    if (this.result) return none;
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
    // Purple only triggers when nothing else is under the cursor.
    const chosen = best ?? trap;
    if (!chosen) {
      this.miss(cpos);
      return { outcome: 'miss', perfect: false, cursorPos: cpos, blockId: 0 };
    }
    const d = chosen === best ? bestD : trapD;
    const perfect = d <= (J.perfectFrac * chosen.width) / 2;
    let outcome: TapOutcome;
    if (chosen.kind === 'purple') outcome = this.triggerTrap(chosen);
    else if (isRed(chosen.kind)) outcome = this.blockRed(chosen, perfect);
    else outcome = this.hitAttack(chosen, perfect);
    return { outcome, perfect: outcome === 'trap' ? false : perfect, cursorPos: cpos, blockId: chosen.id };
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
    const damage = Math.max(1, Math.round(T.hero.atk * (1 + H.bonusDmg) * mult * (crit ? T.hero.critDmg + H.bonusCritDmg : 1)));
    this.events.push({ type: 'hit', kind: b.kind, pos: b.pos, perfect, crit, damage, enemyId: target?.id ?? 0, combo: this.combo });
    if (green) {
      H.abilityTimer = T.hero.abilitySec;
      this.events.push({ type: 'ability' });
    }
    if (crit) this.startHitStop();
    if (target) this.damageEnemy(target, damage, crit, 'hit');
    return 'hit';
  }

  private blockRed(b: Block, perfect: boolean): TapOutcome {
    const T = this.tuning;
    this.combo++;
    this.addMeter(T.meter.perBlock + (perfect ? T.meter.perfectBonus : 0));
    if (b.taps > 1) {
      b.taps--;
      this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: true, ownerId: b.ownerId, combo: this.combo });
      return 'crack';
    }
    this.removeBlock(b, 'hit');
    this.events.push({ type: 'block', kind: b.kind, pos: b.pos, perfect, cracked: false, ownerId: b.ownerId, combo: this.combo });
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

  private triggerTrap(b: Block): TapOutcome {
    this.removeBlock(b, 'hit');
    const owner = this.enemyById(b.ownerId);
    const damage = owner ? this.tuning.enemies[owner.key].special : 0;
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

  /** Fire the finisher if the meter is full. */
  finisher(): boolean {
    if (this.result || this.meter < 1) return false;
    const T = this.tuning;
    const combo = this.combo;
    let dmg = combo * (T.hero.comboPower + this.hero.bonusComboPower);
    if (this.settings.comboTiers) dmg *= tierMult(T, combo);
    dmg = Math.round(dmg);
    // Push every red block back, keeping them spaced out so they don't pile up at the right end.
    const reds = this.blocks.filter((b) => isRed(b.kind)).sort((a, b) => b.pos + b.push - (a.pos + a.push));
    let limit = 1;
    for (const b of reds) {
      const from = b.pos;
      let target = Math.min(from + b.push + T.meter.finisherPushback, limit - b.width / 2);
      target = Math.max(target, from);
      limit = target - b.width / 2 - T.blocks.minGap;
      b.impactTimer = -1;
      if (T.meter.pushbackSec > 0) {
        b.push = target - from;
        b.vel = b.push > 0 ? T.meter.finisherPushback / T.meter.pushbackSec : -(1 - b.width) / T.blocks.redTravelSec;
      } else {
        b.pos = target;
        b.push = 0;
        b.vel = -(1 - b.width) / T.blocks.redTravelSec;
      }
    }
    this.meter = 0;
    this.combo = 0;
    this.speedStacks = 0;
    this.events.push({ type: 'finisher', damage: dmg, combo });
    this.startHitStop();
    if (dmg > 0) for (const e of this.enemies) if (e.alive) this.damageEnemy(e, dmg, false, 'finisher');
    return true;
  }

  get finisherReady(): boolean {
    return this.meter >= 1 && !this.result;
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

  private addMeter(x: number): void {
    const before = this.meter;
    this.meter = Math.min(1, this.meter + x);
    if (before < 1 && this.meter >= 1) this.events.push({ type: 'meterFull' });
  }

  private startHitStop(): void {
    const s = this.tuning.juice.hitStopMs / 1000;
    if (s <= 0) return;
    this.hitStop = Math.max(this.hitStop, s);
    this.events.push({ type: 'hitStop', ms: this.tuning.juice.hitStopMs });
  }

  private breakCombo(): void {
    if (this.combo > 0) this.events.push({ type: 'comboBreak', lost: this.combo });
    this.combo = 0;
  }

  private heroDamage(amount: number, source: 'red' | 'bomb' | 'trap' | 'miss', enemyId: number): void {
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

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, source: 'hit' | 'bomb' | 'finisher'): void {
    if (!e.alive) return;
    e.hp = Math.max(0, e.hp - dmg);
    this.events.push({ type: 'enemyHurt', enemyId: e.id, damage: dmg, crit, source });
    if (e.hp > 0) return;
    e.alive = false;
    for (const b of this.blocks.slice()) if (b.ownerId === e.id && !isAttack(b.kind)) this.removeBlock(b, 'owner');
    this.events.push({ type: 'kill', enemyId: e.id });
    this.killQueue.push(e.id);
    if (this.enemies.every((x) => !x.alive)) {
      this.result = 'won';
      this.events.push({ type: 'won' });
    }
  }

  carry(): Carry {
    return { combo: this.combo, meter: this.meter, speedStacks: this.speedStacks, cursorPhase: this.cursorPhase };
  }

  drainEvents(): CombatEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
