// On the spot: every perk, ally, companion and relic effect shows itself at the moment it happens ON the thing it
// affects (the playtester's rule, round 6), not only as a callout word (view/callouts.ts) or a name in the HUD's lane
// (fighters.ts perkLabel). view/perk-at.ts says where each perk lands; this draws it:
// - on the bar (screen space, over the blocks, under the cursor): a box flashing out of the block it touched, every red
//   it slowed or pushed, the spot a miss was forgiven (a puff of smoke), a glow kicking up the cursor;
// - flights from the stage down to the bar (over everything on the bar): Mote's star landing on the green it made, the
//   Seedling's seed, a companion's streak to the block it touched, Sunny's fire onto the traps it burns, a leaf from the
//   green that called an ally up to where it pops in, a mote into the style tab;
// - on the stage (the world layer, shaken with it): marks closing in on a foe, rings on the hero, a heal's twinkling
//   stars and its +N, a burning foe's flames (Newt's Ember Bite: they burn while the ticks come), Sunny's sweep of fire
//   across every foe, gold out of a dying foe (Gold Hoard);
// - coins popping out of what dropped them (the block just hit, the foe, the combo counter) into the coin counter.
// Small, short, bold shapes; each kind is throttled so a busy fight never floods. Everything animates from the scene's
// clock and the seeded Math.random (screenshots stay exact).
import type Phaser from 'phaser';
import { isRed, type BlockKind, type Combat, type CombatEvent } from '../../core/combat';
import { mult, signed, whole } from '../../core/format';
import { windUpMult } from '../../core/kit-fx';
import { guardMax, guardOf } from '../../core/styles';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { heroDef, type AllyKind, type HeroId } from '../../data/heroes';
import { relicById } from '../../data/relics';
import type { FightScene } from '../scene';
import { STYLE_LOOK } from './camp-kit';
import { dawnRoofPerk, drawDawnRoof } from './dawn-roof';
import { BLOCKER_FACE, sparkle } from './bar-kinds';
import { ALLY_COL, PERK_PET, PET_COL } from './party';
import { PetSite } from './onsite-pets';
import { COIN_FROM, PERK_ALLY, PERK_SPAWN, perkTargets, type PerkTarget } from './perk-at';
import { perkSource, TAG_FACE } from './relic-ui';
import { clamp01, ease, INK, mix, pulse, rand, WHITE, type EnemyView } from './shared';
import { TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type PerkEvent = Extract<CombatEvent, { type: 'perk' }>;

/** How long each thing lasts (ms of scene time). */
const BOX_MS = 320;
const MARK_MS = 420;
const KICK_MS = 240;
const SMOKE_MS = 620;
const TWINKLE_MS = 380;
const HEAL_MS = 760;
/** A burn tick keeps the flames up this long (the ticks come every second). */
const BURN_HOLD_MS = 1250;
/** Perks that come with nearly every tap are shown at most this often (ms). */
const GAP: Record<string, number> = { snowDash: 1100, vampiricFang: 300, guardUp: 120, chain: 120 };
/** The same kind of mark on the same thing at most this often (ms). */
const KIND_GAP: Partial<Record<PerkTarget, number>> = { hero: 350, cursor: 300, reds: 300, combo: 280, meter: 150, foes: 300, target: 200 };
/** Fire, gold, a heal's greens. */
const FIRE = [0xfff0a0, 0xffd060, 0xff8a2a, 0xe0461a, 0x8a1a22] as const;
const GOLD = [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14] as const;
const HEAL = [0xe8ffd8, 0x9af06a, 0x5ad848] as const;
/** Hollis's steel (Shield Slam, the Bulwark) [white-hot, light, base, deep]; Wind-Up's heat. */
const STEEL = [0xf4f8ff, 0xc8d8f0, 0x8aa4d0, 0x3a4a72] as const;
const HEAT = [0xfff0a0, 0xffb060, 0xff7a3a] as const;
/** Sable's violet (her dash, her smoke). */
const SMOKE = [0xe0d0f0, 0xb8a8d0, 0x8a78a8] as const;

type FlyLook = 'star' | 'seed' | 'leaf' | 'spark' | 'fire' | 'mote' | 'rock';

interface Box {
  x0: number;
  x1: number;
  /** The block it flashes (it follows it along the bar while it's there), or -1. */
  id: number;
  col: number;
  at: number;
  ms: number;
  /** A small one (every red at once): no pop, no sparkles. */
  small: boolean;
}

interface Fly {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  at: number;
  ms: number;
  col: number;
  look: FlyLook;
  /** How high it arcs on the way (px). */
  arc: number;
  land?: () => void;
}

interface Twinkle {
  x: number;
  y: number;
  at: number;
  col: number;
  r: number;
}

interface Mark {
  id: number;
  col: number;
  at: number;
}

interface HeroSpark {
  at: number;
  /** Each star: an offset from the hero's middle, a delay, a colour. */
  stars: Array<{ dx: number; dy: number; delay: number; col: number }>;
}

/** A Shield Slam's shield flying from the hero's guard to the red's owner (world px, scene time). */
interface Bash {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  at: number;
  ms: number;
  perfect: boolean;
  /** Wide Slam's: a smaller shield. */
  small: boolean;
}

/** A Bulwark: a great shield sweeping from the hero across every foe (world px, scene time). */
interface Wave {
  x0: number;
  x1: number;
  y: number;
  at: number;
  ms: number;
}

interface Sweep {
  x0: number;
  x1: number;
  at: number;
  ms: number;
}

/** What this batch of events has said so far (where the tap landed, what it spawned or cleared...). */
interface Batch {
  hitPos: number | null;
  hitFoe: number;
  /** The last block in the batch was a Perfect one (its Shield Slam is the bigger one). */
  blockPerfect: boolean;
  tapPos: number | null;
  missPos: number | null;
  holdPos: number | null;
  spawned: Array<{ id: number; kind: BlockKind; pos: number }>;
  cleared: Array<{ pos: number; w: number; kind: BlockKind }>;
  kills: number[];
  blasts: number[];
  gone: Array<{ lo: number; hi: number }>;
}

const freshBatch = (): Batch => ({ hitPos: null, hitFoe: 0, blockPerfect: false, tapPos: null, missPos: null, holdPos: null, spawned: [], cleared: [], kills: [], blasts: [], gone: [] });

export class OnSite {
  /** Over the blocks, under the cursor: boxes, smoke, the cursor's kick, twinkles. */
  private gBar: G | null = null;
  /** Over the bar, the cursor and the callout words: things flying from the stage down to the bar. */
  private gFly: G | null = null;
  private boxes: Box[] = [];
  private flights: Fly[] = [];
  private twinkles: Twinkle[] = [];
  private smokes: Array<{ x: number; at: number }> = [];
  private kicks: Array<{ col: number; at: number }> = [];
  private marks: Mark[] = [];
  private sparks: HeroSpark[] = [];
  private sweeps: Sweep[] = [];
  private bashes: Bash[] = [];
  private waves: Wave[] = [];
  /** A Summoner's allies' strength (their 'ally' events say it: 1 = a fresh hero's); bigger jabs and heals read so. */
  allyPower = 1;
  /** When Heavy Slam or Retaliate last made a Shield Slam hit harder (anim ms): the slam landing then lands heavier. */
  private slamBoost = -1e9;
  /** Words drawn with the bar (Wind-Up's live multiplier over the cursor). */
  private texts: TextPool;
  /** Burning foes: id -> scene time the flames hold until (refreshed by each tick), and when it last ticked. */
  private burnUntil = new Map<number, number>();
  private burnTickAt = new Map<number, number>();
  private emberAt = 0;
  /** When each perk (and each kind of mark) last showed. */
  private last = new Map<string, number>();
  /** The heal on the hero merging into one +N. */
  private heal: { sum: number; at: number } | null = null;
  private b: Batch = freshBatch();
  /** Round 7's companions (Burr, Lark, Gloam, Nimbus): their looks live in view/onsite-pets.ts. */
  readonly p6: PetSite;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 11.36);
    this.p6 = new PetSite(s);
  }

  /** A new layout: the graphics (kept across layouts), nothing in flight. */
  build(): void {
    this.gBar ??= this.s.add.graphics().setDepth(11.25);
    this.gFly ??= this.s.add.graphics().setDepth(25.3);
    this.newFight();
  }

  /** A new fight: nothing in flight, nothing burning. */
  newFight(): void {
    this.boxes = [];
    this.flights = [];
    this.twinkles = [];
    this.smokes = [];
    this.kicks = [];
    this.marks = [];
    this.sparks = [];
    this.sweeps = [];
    this.bashes = [];
    this.waves = [];
    this.allyPower = 1;
    this.burnUntil.clear();
    this.burnTickAt.clear();
    this.last.clear();
    this.heal = null;
    this.b = freshBatch();
    this.p6.newFight();
  }

  // ------------------------------------------------------------------ the batch's context

  /** Every event of a batch comes through here first (scene.onEvents), so a perk later in it knows where the tap was,
   *  what it spawned or cleared, who died. */
  onEvent(e: CombatEvent): void {
    const s = this.s;
    const c = s.app.run.combat;
    const b = this.b;
    this.p6.onEvent(e);
    switch (e.type) {
      case 'hit':
        b.hitPos = e.pos;
        b.hitFoe = e.enemyId;
        b.tapPos = e.pos;
        break;
      case 'block':
        b.tapPos = e.pos;
        b.blockPerfect = e.perfect;
        break;
      case 'chip':
      case 'wardBreak':
      case 'counter':
      case 'trap':
        b.tapPos = e.pos;
        break;
      case 'miss':
        b.missPos = e.pos;
        b.tapPos = e.pos;
        break;
      case 'holdStart':
      case 'holdEnd':
        b.holdPos = e.pos;
        break;
      case 'spawn': {
        const blk = c?.blocks.find((x) => x.id === e.id);
        if (blk) b.spawned.push({ id: e.id, kind: blk.kind, pos: blk.pos });
        break;
      }
      case 'remove':
        if (e.reason === 'perk') b.cleared.push({ pos: e.pos, w: e.width, kind: e.kind });
        break;
      case 'kill':
        b.kills.push(e.enemyId);
        break;
      case 'explode':
        b.blasts.push(e.pos);
        break;
      case 'zoneOff': {
        const z = s.barView.zoneLook(e.id);
        if (z) b.gone.push({ lo: z.lo, hi: z.hi });
        break;
      }
    }
  }

  /** The batch is done. */
  endBatch(): void {
    this.b = freshBatch();
  }

  /** Whether `key` may show now (at most every `gap` ms); marks it shown. */
  private allowed(key: string, gap: number): boolean {
    const a = this.s.anim;
    if (a - (this.last.get(key) ?? -1e9) < gap) return false;
    this.last.set(key, a);
    return true;
  }

  // ------------------------------------------------------------------ where things are

  private get c(): Combat | null {
    return this.s.app.run.combat;
  }

  /** A bar position's centre on screen. */
  private barPt(pos: number): { x: number; y: number } {
    const B = this.s.bar;
    return { x: this.s.barView.x(Math.max(0, Math.min(1, pos))), y: B.y + B.h / 2 };
  }

  /** A world point on screen (the world layer shakes). */
  private screen(x: number, y: number): { x: number; y: number } {
    return { x: x + this.s.world.x, y: y + this.s.world.y };
  }

  /** A block's width on screen at a bar position (the block there, else a yellow's). */
  private widthAt(pos: number, w?: number): number {
    const s = this.s;
    const c = this.c;
    if (w === undefined && c) w = this.blockAt(pos)?.width ?? c.widthFor('yellow');
    return Math.max(6, Math.round((w ?? 0.06) * s.bar.w) - 1);
  }

  /** The block standing at a bar position, if any (the nearest). */
  private blockAt(pos: number): { id: number; width: number } | null {
    const c = this.c;
    let best: { d: number; id: number; width: number } | null = null;
    for (const b of c?.blocks ?? []) {
      const d = Math.abs(b.pos - pos);
      if (d < b.width / 2 + 0.01 && (!best || d < best.d)) best = { d, id: b.id, width: b.width };
    }
    return best;
  }

  /** A foe's view (alive and not dying). */
  private foe(id: number): EnemyView | null {
    const v = id ? this.s.fighters.enemies.get(id) : undefined;
    return v && !v.dieAt ? v : null;
  }

  private chest(v: EnemyView): { x: number; y: number } {
    return { x: v.x, y: v.y - v.img.displayHeight / 2 };
  }

  /** The perk's colour: its companion's, its ally's, its relic tag's, a skill node's blue, or the hero's style. */
  colOf(id: string): number {
    const pet = PERK_PET[id];
    if (pet) return PET_COL[pet];
    if (id in ALLY_COL) return ALLY_COL[id as AllyKind];
    const relic = relicById(id);
    if (relic) return mix(TAG_FACE[relic.tags[0]][1], TAG_FACE[relic.tags[0]][0], 0.4);
    if (perkSource(id) === 'skill') return 0x9ad8ff;
    const c = this.c;
    return c ? STYLE_LOOK[heroDef(c.heroId as HeroId).style].face[0] : 0xd8b0ff;
  }

  // ------------------------------------------------------------------ perks

  /**
   * A perk kicked in: show it on what it affects (view/perk-at.ts). Its name (the lane), its blow's bolt, its heal's
   * readout and its stacks are fighters.perkFx's; the companion's flare is party.flare.
   */
  perk(e: PerkEvent): void {
    const s = this.s;
    const c = this.c;
    if (!c) return;
    const id = e.id;
    if (GAP[id] && !this.allowed(`perk:${id}`, GAP[id])) return;
    const targets = perkTargets(id, e);
    const col = this.colOf(id);
    const pet = PERK_PET[id] as CompanionId | undefined;
    this.special(e);
    this.p6.perk(e);
    const has = (t: PerkTarget) => targets.includes(t);
    // what lands on the bar (when its companion sends a streak there first, it lands with the streak)
    const onBar = () => {
      if (has('bar') && e.pos !== undefined) this.box(e.pos, col);
      if (has('left') && !BLOCKER_FACE[id]) this.box(0, col, 8);
      if (has('foeReds')) this.redsOf(col, e.enemyId);
    };
    if (has('pet') && pet) this.petStreak(pet, id, e, col, onBar);
    else onBar();
    for (const t of targets)
      switch (t) {
        case 'tab':
          this.toTab(e.pos ?? this.b.tapPos, col);
          break;
        case 'foe':
          if (this.foe(e.enemyId)) this.mark(e.enemyId, col);
          else if (!e.enemyId && e.pos === undefined) this.heroRing(col);
          break;
        case 'hero':
          if (this.allowed(`hero:${id}`, KIND_GAP.hero!)) this.heroRing(col);
          break;
        case 'heal': {
          // a companion's heal (Mote's Mend): a mote of starlight drifts from it to the hero first
          const src = pet && s.fighters.party.visible(pet) ? s.fighters.party.petPos(pet) : null;
          if (src) {
            const h = s.fighters.h;
            s.fx.bolt(src.x + 3, src.y, h.x + 1, s.ground - 22, 220, PET_COL[pet!]);
            s.later(220, () => this.healOnHero(e.amount, PET_COL[pet!]));
          } else this.healOnHero(e.amount, undefined, id === 'glowmoth' ? this.allyPower : 1);
          break;
        }
        case 'meter':
          if (this.allowed(`meter:${id}`, KIND_GAP.meter!)) this.meter(col);
          break;
        case 'combo':
          if (this.allowed(`combo:${id}`, KIND_GAP.combo!)) this.combo(col);
          break;
        case 'cursor':
          if (this.allowed(`cursor:${id}`, KIND_GAP.cursor!)) this.cursorKick(col);
          break;
        case 'reds':
          if (this.allowed(`reds:${id}`, KIND_GAP.reds!)) this.redsOf(col);
          break;
        case 'foes':
          if (this.allowed(`foes:${id}`, KIND_GAP.foes!)) for (const v of s.fighters.enemies.values()) if (!v.dieAt) this.mark(v.id, col);
          break;
        case 'target': {
          const tid = this.foe(this.b.hitFoe) ? this.b.hitFoe : (c.currentTarget()?.id ?? 0);
          if (tid && this.allowed(`target:${id}`, KIND_GAP.target!)) this.mark(tid, col);
          break;
        }
        case 'miss':
          this.missSpot(id, col);
          break;
        case 'hold': {
          const p = e.pos ?? this.b.holdPos;
          if (p !== null && p !== undefined) this.box(p, col);
          break;
        }
        case 'patches':
          for (const z of this.b.gone) this.span(z.lo, z.hi, col);
          break;
        case 'spawn':
          this.spawned(id, col, pet);
          break;
        case 'blast':
          for (const p of this.b.blasts) this.box(p, col);
          break;
        case 'cleared':
          if (!has('pet')) for (const x of this.b.cleared) this.box(x.pos, col, this.widthAt(x.pos, x.w));
          break;
        case 'ally': {
          const kind = PERK_ALLY[id];
          const p = kind ? s.fighters.party.allyPos(kind) : null;
          if (p) {
            s.fx.ring(p.x, p.y - 2, 12, ALLY_COL[kind], true);
            s.fx.burst(p.x, p.y - 4, ALLY_COL[kind], 6, true, 0.7);
          }
          break;
        }
        case 'burn':
          this.burnTick(e.enemyId, e.amount);
          break;
      }
  }

  /** The perks with a show of their own on what they touch (round 6: Hollis's Bulwark, Neve's Glacier and Big Freeze,
   *  Tam's Turnabout, Torva's Wind-Up multiplier, Vesper's Patience). */
  private special(e: PerkEvent): void {
    const s = this.s;
    const c = this.c;
    if (!c) return;
    dawnRoofPerk(s, e, c); // (Solenne's and Wren's moments: view/dawn-roof.ts)
    switch (e.id) {
      case 'bulwark':
        this.bulwark(e.pos);
        break;
      case 'heavySlam':
      case 'retaliate':
        // the slam they made stronger lands heavier (shieldSlam reads this as it lands)
        this.slamBoost = s.anim;
        break;
      case 'turnabout': {
        // each red flips into one of Tam's kegs where it stood
        if (e.pos === undefined) break;
        const keg = this.b.spawned.filter((x) => x.kind === 'keg').find((x) => Math.abs(x.pos - e.pos!) < 0.002);
        if (keg) s.barView.turnInto(e.pos, keg.id, 'flip');
        break;
      }
      case 'bigFreeze': {
        // every red Glacier froze is iced over into a block to smash
        for (const r of this.b.cleared) {
          if (!isRed(r.kind)) continue;
          const ice = this.b.spawned.find((x) => x.kind === 'frozen' && Math.abs(x.pos - r.pos) < 0.002);
          if (ice) s.barView.turnInto(r.pos, ice.id, 'ice');
        }
        break;
      }
      case 'glacier':
        // every red on the bar freezes solid: a burst of frost off each (its ice coat stays while it's frozen)
        for (const b of c.blocks)
          if (isRed(b.kind)) {
            const p = this.barPt(b.pos);
            s.fx.chips(p.x, s.bar.y - 4, 8, [WHITE, 0xe0faff, 0x8ae0f6], 6, -1);
          }
        break;
      case 'windUp': {
        // Torva's smash lands: its multiplier over the foe it struck ("x2.6!"), hot
        const v = this.foe(e.enemyId);
        if (!v || e.amount <= 0) break;
        // (beside the foe, left of where its damage number rises)
        s.fx.addFloater(Math.max(30, v.x - v.img.displayWidth / 2 - 24), Math.max(36, v.y - v.img.displayHeight / 2 - 4), `${mult(e.amount / 100)}!`, HEAT[1], 2, true, 0, -12, 0, 900, true);
        break;
      }
      case 'patience': {
        // Vesper's full Focus fired by a Perfect (no green in reach): gold on the hit and on the foe it struck
        const t = this.foe(this.b.hitFoe) ? this.b.hitFoe : (c.currentTarget()?.id ?? 0);
        const v = this.foe(t);
        if (v) {
          const { x, y } = this.chest(v);
          s.fx.stars.push({ x, y, at: s.anim, r: 20, color: 0xffd23a });
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Hollis: Shield Slam and the Bulwark

  /**
   * A Shield Slam: a shield flies from the hero's guard into the red's owner and lands with a clang (the 'slam'
   * impact tier, `audio.shieldCounter`), steel sparks and a chunky steel number (brighter and with a starburst for a
   * Perfect block's). Wide Slam's on the other foes: a smaller shield, no impact of its own.
   */
  shieldSlam(v: EnemyView, amount: number, wide: boolean): void {
    const s = this.s;
    const h = s.fighters.h;
    const perfect = this.b.blockPerfect;
    const x0 = h.x + 12;
    const y0 = s.ground - 20;
    const x1 = v.x - v.img.displayWidth * 0.3;
    const y1 = v.y - v.img.displayHeight / 2;
    const ms = wide ? 120 : 90;
    this.bashes.push({ x0, y0, x1, y1, at: s.anim, ms, perfect, small: wide });
    if (this.bashes.length > 8) this.bashes.shift();
    s.later(ms, () => {
      const fx = s.fx;
      if (!wide) {
        const feel = fx.impact(fx.weight('slam') * (perfect ? 1.15 : 1));
        s.app.audio.shieldCounter(perfect);
        v.kickDist = feel.knockPx + (perfect ? 3 : 1);
      } else v.kickDist = 4;
      v.flashUntil = s.anim + (perfect ? 80 : 60);
      v.kickAt = s.anim;
      v.knockUntil = s.anim + 100;
      if (!v.dieAt) s.fighters.setEnemyPose(v, 'hurt', 150);
      fx.sparks.push({ x: x1, y: y1, at: s.anim, size: perfect ? 15 : wide ? 9 : 12, color: STEEL[1] });
      fx.burst(x1, y1, STEEL[1], perfect ? 12 : 8, true, 1.2, true);
      fx.chips(x1, y1, 6, [WHITE, STEEL[1], STEEL[2]], perfect ? 10 : 6, 0);
      fx.glow(x1, y1, perfect ? 16 : 11, 0xc8e0ff, 170, v.fly ? undefined : s.ground);
      if (perfect) {
        fx.stars.push({ x: x1 + 2, y: y1 - 2, at: s.anim, r: 18, color: STEEL[1] });
        fx.ring(x1, y1, 22, STEEL[0], true);
      }
      // Heavy Slam / Retaliate made this one hit harder: a heavier landing (a ground shock, a hot-steel starburst)
      if (!wide && s.anim - this.slamBoost <= ms + 40) {
        v.kickDist += 2;
        fx.stars.push({ x: x1 - 2, y: y1 + 2, at: s.anim, r: 22, color: 0xffd0a0 });
        if (!v.fly) fx.shock(v.x, s.ground, 24, STEEL[1]);
      }
      const big = perfect && !wide;
      fx.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), big ? STEEL[0] : wide ? STEEL[2] : STEEL[1], wide ? 1 : 2);
    });
  }

  /** How long until a Bulwark's sweeping shield reaches a foe (ms; 0 without a Bulwark going). */
  bulwarkReach(v: EnemyView): number {
    const w = this.waves[this.waves.length - 1];
    if (!w) return 0;
    const k = clamp01((v.x - v.img.displayWidth * 0.3 - w.x0) / Math.max(1, w.x1 - w.x0));
    return Math.max(0, w.at - this.s.anim) + w.ms * ease(k) * 0.9;
  }

  /** One foe's Bulwark blow, as the shield reaches it: a big steel hit and a big number. */
  bulwarkHit(v: EnemyView, amount: number): void {
    const s = this.s;
    const fx = s.fx;
    const { x, y } = this.chest(v);
    v.flashUntil = s.anim + 110;
    v.kickAt = s.anim;
    v.kickDist = 12;
    v.knockUntil = s.anim + 160;
    if (!v.dieAt) s.fighters.setEnemyPose(v, 'hurt', 220);
    fx.sparks.push({ x: x - 4, y, at: s.anim, size: 18, color: STEEL[1] });
    fx.stars.push({ x, y: y - 4, at: s.anim, r: 26, color: STEEL[1] });
    fx.burst(x, y, STEEL[0], 14, true, 1.5, true);
    fx.chips(x, y, 10, [WHITE, STEEL[1], STEEL[2]], 12, 0);
    fx.ring(x, y, 30, STEEL[1], true);
    if (!v.fly) fx.shock(v.x, s.ground, 34, 0xd8e8ff);
    fx.floatNum(v.x + 4, v.y - v.img.displayHeight - 12, whole(amount), STEEL[0], 3);
  }

  /**
   * The Bulwark (full Guard unleashed on every foe): the hero slams their shield down (the 'bulwark' impact tier, two
   * white frames, the music ducks, `audio.bulwark`), a great shield sweeps out across every foe (each struck as it
   * reaches them: bulwarkHit), the ground shakes, and on the bar the Guard tab's pips burst out and a steel flash runs
   * the bar's length.
   */
  private bulwark(pos?: number): void {
    const s = this.s;
    const fx = s.fx;
    const h = s.fighters.h;
    const foes = [...s.fighters.enemies.values()].filter((v) => !v.dieAt);
    const x0 = h.x + 10;
    const x1 = Math.max(x0 + 60, ...foes.map((v) => v.x + v.img.displayWidth / 2 + 14));
    this.waves.push({ x0, x1, y: s.ground - 16, at: s.anim + 40, ms: 300 });
    if (this.waves.length > 3) this.waves.shift();
    fx.impact(fx.weight('bulwark'));
    s.app.audio.bulwark();
    fx.screenFlash(0xd8e8ff, performance.now(), 220);
    fx.ring(h.x + 4, s.ground - 18, 26, STEEL[0], true);
    s.later(70, () => fx.ring(h.x + 4, s.ground - 18, 40, STEEL[1], true));
    fx.burst(h.x + 8, s.ground - 18, STEEL[1], 16, true, 1.4, true);
    fx.glow(h.x + 8, s.ground - 18, 30, 0xc8e0ff, 420, s.ground);
    fx.shock(h.x + 8, s.ground, 70, 0xd8e8ff);
    fx.dust(h.x + 6, s.ground, 10, 0, 1.4);
    fx.shake(4, 260);
    // the bar: a steel flash along it, the Guard tab bursting
    this.span(0, 1, STEEL[1]);
    if (pos !== undefined) this.box(pos, STEEL[0]);
    const tab = s.callouts.tab;
    if (tab) {
      fx.chips(tab.x + tab.w / 2, tab.y + tab.h / 2, tab.w, [WHITE, STEEL[1], 0x9ad8ff], 14, 0);
      fx.ring(tab.x + tab.w / 2, tab.y + tab.h / 2, 16, STEEL[0], false);
    }
  }

  /** A 'bounce' perk's blow starts at the foe the tap just hit (a ricochet, a pierce, a shatter): where, if it does. */
  bounceFrom(e: PerkEvent): { x: number; y: number } | undefined {
    if (!perkTargets(e.id, e).includes('bounce')) return undefined;
    const from = this.b.hitFoe !== e.enemyId ? (this.s.fighters.enemies.get(this.b.hitFoe) ?? null) : null;
    if (from) return { x: from.x + from.img.displayWidth * 0.2, y: from.y - from.img.displayHeight / 2 };
    // a kill's leftover (Follow-Through): from the foe that just died
    const dead = this.b.kills.length ? this.s.fighters.enemies.get(this.b.kills[this.b.kills.length - 1]) : undefined;
    return dead && dead.id !== e.enemyId ? { x: dead.x, y: dead.y - dead.img.displayHeight / 2 } : undefined;
  }

  // ------------------------------------------------------------------ coins

  /**
   * Coins a perk found (the 'coins' event; `after`: the perk event that names it, with its foe or bar position): they pop
   * out of what dropped them and fly into the coin counter.
   */
  coins(e: Extract<CombatEvent, { type: 'coins' }>, after?: CombatEvent): void {
    const s = this.s;
    const c = this.c;
    const hud = s.hud;
    const perk = after?.type === 'perk' && after.id === e.id ? after : null;
    const from = COIN_FROM[e.id] ?? 'foe';
    const n = Math.min(4, e.amount);
    const label = signed(e.amount);
    if (from === 'block') {
      // Bun's Lucky Foot: Bun hops, a coin pops up out of the block just hit
      const pos = this.b.hitPos ?? c?.cursorPos() ?? 0.5;
      const p = this.barPt(pos);
      hud.dropCoins(p.x, s.bar.y - 3, e.amount, n, label);
      this.twinkle(p.x, s.bar.y - 2, GOLD[1], 3);
      s.fighters.party.hop('bun');
      return;
    }
    if (from === 'pos' || (from === 'foe' && perk?.pos !== undefined && !perk.enemyId)) {
      const pos = perk?.pos ?? this.b.holdPos ?? this.b.tapPos ?? c?.cursorPos() ?? 0.5;
      const p = this.barPt(pos);
      hud.dropCoins(p.x, s.bar.y - 3, e.amount, n, label);
      this.twinkle(p.x, s.bar.y - 2, GOLD[1], 2);
      return;
    }
    if (from === 'combo') {
      const r = hud.comboRect;
      const x = r ? r.x + Math.min(14, r.w / 2) : s.L + 14;
      const y = r ? r.y + r.h / 2 : s.splitY - 14;
      hud.comboPopAt = performance.now();
      hud.dropCoins(x, y, e.amount, n, label);
      return;
    }
    if (from === 'kill') {
      // Sunny's Gold Hoard: gold bursts out of the foe as it bursts (its own coins come with it)
      const id = this.b.kills[this.b.kills.length - 1] ?? 0;
      const v = s.fighters.enemies.get(id);
      if (!v) {
        hud.dropCoins(s.fighters.h.x + 20, s.ground - 24, e.amount, n, label);
        return;
      }
      hud.coinsPending += e.amount;
      const at = s.fighters.burstAt.get(id) ?? s.anim;
      s.later(Math.max(0, at - s.anim), () => {
        hud.coinsPending -= e.amount;
        this.goldBurst(v, e.amount);
      });
      return;
    }
    // a foe dropped them (Lucky Penny's crit, Pip's Treasure Nose); in a Coin Rush, each hit's haul off the sack
    const t = perk?.enemyId ? this.foe(perk.enemyId) : null;
    const v = t ?? (c?.currentTarget() ? this.s.fighters.enemies.get(c.currentTarget()!.id) : undefined);
    const x = v ? v.x : s.fighters.h.x + 20;
    const y = v ? v.y - v.img.displayHeight / 2 : s.ground - 24;
    hud.dropCoins(x, y, e.amount, n, from === 'sack' ? undefined : label);
    if (from === 'sack' && v) s.fx.iconFloat(x + rand(-6, 6), v.y - v.img.displayHeight - 8, label, 0xffe066, 'coin');
    else if (v) s.fx.ring(x, y, 12, GOLD[1], true);
  }

  /** Gold Hoard's gold out of a dying foe: a gold starburst, a fountain of coins, "+N" with a coin over it. */
  private goldBurst(v: EnemyView, amount: number): void {
    const s = this.s;
    const fx = s.fx;
    const { x, y } = this.chest(v);
    fx.stars.push({ x, y: y - 4, at: s.anim, r: 18, color: GOLD[1] });
    fx.ring(x, y, 24, GOLD[0], true);
    s.later(80, () => fx.ring(x, y, 32, GOLD[2], true));
    fx.chips(x, y - 6, 14, [GOLD[0], GOLD[1], WHITE], 12, -1);
    s.hud.dropCoins(x, y - 4, amount, Math.max(3, Math.min(6, amount)), signed(amount));
    fx.iconFloat(x - 4, Math.max(34, v.y - v.img.displayHeight - 14), signed(amount), 0xffe066, 'coin');
  }

  // ------------------------------------------------------------------ companions and allies

  /** A companion attacked: Newt's bite sets its foe burning (its ticks keep it burning). */
  pet(e: Extract<CombatEvent, { type: 'pet' }>): void {
    if (e.pet === 'newt') {
      this.burnUntil.set(e.enemyId, this.s.anim + BURN_HOLD_MS);
      this.burnTickAt.set(e.enemyId, this.s.anim + 120);
    }
  }

  /**
   * Sunny's breath on every foe: a wall of fire sweeps across them from the nearest to the farthest; each is struck
   * (`strike`) as the fire reaches it.
   */
  fireSweep(views: EnemyView[], strike: (v: EnemyView) => void): void {
    const s = this.s;
    const list = views.filter((v) => !v.dieAt).sort((a, b) => a.x - b.x);
    if (!list.length) return;
    const x0 = Math.min(...list.map((v) => v.x - v.img.displayWidth / 2)) - 10;
    const x1 = Math.max(...list.map((v) => v.x + v.img.displayWidth / 2)) + 8;
    const start = 110;
    const ms = Math.max(170, Math.min(380, (x1 - x0) * 3.2));
    this.sweeps.push({ x0, x1, at: s.anim + start, ms });
    for (const v of list) {
      const k = clamp01((v.x - x0) / Math.max(1, x1 - x0));
      s.later(start + ms * k, () => {
        if (v.dieAt && s.anim - v.dieAt > 50) return;
        strike(v);
        const { x, y } = this.chest(v);
        s.fx.burst(x, y + 4, FIRE[2], 10, true, 1, false);
        s.fx.burst(x, y, FIRE[0], 5, true, 1.2, true);
        s.fx.glow(x, y, 16, 0xff8a2a, 260, v.fly ? undefined : s.ground);
      });
    }
  }

  /** A Summoner's ally came, acted, left, rallied or blocked: the party shows the ally; this shows what it touched. */
  ally(e: Extract<CombatEvent, { type: 'ally' }>): void {
    const s = this.s;
    const party = s.fighters.party;
    if (e.power) this.allyPower = e.power;
    if (e.action === 'call') {
      // the green that called it sends a leaf up to where it pops in
      const from = this.b.hitPos ?? this.b.tapPos;
      if (from !== null) {
        const p = this.barPt(from);
        const home = party.allyHome(e.kind);
        const to = this.screen(home.x, home.y);
        const ms = 200;
        this.fly(p.x, s.bar.y - 4, to.x, to.y, ms, 0x9af06a, 'leaf', 18);
        party.ally(e.kind, 'call', e.id, ms);
        return;
      }
    }
    party.ally(e.kind, e.action, e.id);
    if (e.action === 'act' && e.kind === 'barkback') {
      // braced: it sets its bark against the bar's left end, where it will take the next red
      const p = party.allyPos('barkback');
      if (p) {
        const sp = this.screen(p.x, p.y);
        const to = this.barPt(0);
        this.fly(sp.x, sp.y, to.x - 2, to.y, 220, ALLY_COL.barkback, 'mote', 10);
      }
    }
  }

  /** A gear effect with a foe of its own (Opening Blow's sure crit): marked on it. */
  gearFx(e: Extract<CombatEvent, { type: 'gearFx' }>): void {
    if (e.fx === 'opener' && this.foe(e.enemyId)) this.mark(e.enemyId, 0xffb060);
  }

  /** A companion's streak from where it is to what its perk touched (the block, the left end, the traps, a new green);
   *  `land` runs as it lands. */
  private petStreak(pet: CompanionId, id: string, e: PerkEvent, col: number, land: () => void): void {
    const s = this.s;
    const src = s.fighters.party.petPos(pet);
    const targets = perkTargets(id, e);
    if (!src || !s.fighters.party.visible(pet)) return land();
    const from = this.screen(src.x + (COMPANIONS[pet].flies ? 4 : 6), src.y - (COMPANIONS[pet].flies ? 0 : 2));
    if (targets.includes('cleared')) {
      // Sunny's Fire Breath: fire onto every trap it burns off the bar (each burns away there)
      const traps = this.b.cleared.filter((x) => x.kind === 'purple');
      traps.forEach((t, i) => {
        const p = this.barPt(t.pos);
        const ms = 150 + i * 30;
        // (the trap stays on the bar until the fire reaches it, then burns away)
        s.barView.burnAway(t.pos, ms);
        this.fly(from.x + 6, from.y, p.x, s.bar.y - 2, ms, FIRE[2], 'fire', 12, () => this.box(t.pos, FIRE[2], this.widthAt(t.pos, t.w)));
      });
      return land();
    }
    if (targets.includes('spawn')) return land(); // its star or seed flies with the block (spawned)
    let to: { x: number; y: number } | null = null;
    if (targets.includes('left')) to = this.barPt(0);
    else if (e.pos !== undefined) to = this.barPt(e.pos);
    if (!to) return land();
    const look: FlyLook = pet === 'brick' ? 'rock' : 'spark';
    this.fly(from.x, from.y, to.x, to.y - 2, pet === 'brick' ? 140 : 190, col, look, pet === 'brick' ? 10 : 26, land);
  }

  /** The blocks a 'spawn' perk just put on the bar: each lands with a twinkle, flying in from its companion (Mote's
   *  star) or its ally (the Seedling's seed) when it has one. */
  private spawned(id: string, col: number, pet?: CompanionId): void {
    const s = this.s;
    const c = this.c;
    const kind = PERK_SPAWN[id];
    if (!kind || !c) return;
    let list = this.b.spawned.filter((x) => x.kind === kind);
    if (!list.length) {
      // (not in this batch: the newest of its kind on the bar)
      const newest = c.blocks.filter((x) => x.kind === kind).sort((a, b) => b.id - a.id)[0];
      if (newest) list = [{ id: newest.id, kind, pos: newest.pos }];
    }
    list = list.slice(-1);
    const party = s.fighters.party;
    const src = pet && party.visible(pet) ? party.petPos(pet) : id === 'seedling' ? party.allyPos('seedling') : null;
    for (const blk of list) {
      const p = this.barPt(blk.pos);
      const tw = kind === 'green' ? (pet === 'mote' ? PET_COL.mote : HEAL[1]) : col;
      if (!src) {
        this.twinkle(p.x, s.bar.y - 2, tw, 4);
        continue;
      }
      const from = this.screen(src.x, src.y);
      const look: FlyLook = pet === 'mote' ? 'star' : 'seed';
      this.fly(from.x, from.y, p.x, s.bar.y - 1, look === 'star' ? 240 : 260, tw, look, look === 'star' ? 16 : 26, () => {
        this.twinkle(p.x, s.bar.y - 2, tw, look === 'star' ? 5 : 4);
        s.fx.ring(p.x, p.y, 13, tw, false);
        s.fx.chips(p.x, s.bar.y - 3, 8, look === 'star' ? [WHITE, PET_COL.mote, HEAL[1]] : [HEAL[1], 0x78a83c, WHITE], 8, -1);
      });
    }
  }

  // ------------------------------------------------------------------ the bar's marks

  /** A box flashing out of the block at `pos` (`w` screen px; the block's own width by default). */
  box(pos: number, col: number, w?: number, small = false): void {
    const x = this.barPt(pos).x;
    const bw = w ?? this.widthAt(pos);
    const id = this.blockAt(pos)?.id ?? -1;
    this.boxes.push({ x0: Math.round(x - bw / 2), x1: Math.round(x + bw / 2), id, col, at: this.s.anim, ms: small ? 240 : BOX_MS, small });
    if (!small) this.s.fx.chips(x, this.s.bar.y - 5, Math.max(6, bw - 2), [WHITE, col, mix(col, WHITE, 0.5)], 6, -1);
    if (this.boxes.length > 24) this.boxes.shift();
  }

  /** A box over a stretch of the bar (a patch it cleared). */
  private span(lo: number, hi: number, col: number): void {
    const a = this.barPt(lo).x;
    const b = this.barPt(hi).x;
    this.boxes.push({ x0: Math.round(a), x1: Math.round(b), id: -1, col, at: this.s.anim, ms: BOX_MS, small: false });
  }

  /** Every red on the bar (or every red of one foe) flashes. */
  private redsOf(col: number, owner = 0): void {
    const c = this.c;
    if (!c) return;
    for (const b of c.blocks) if (isRed(b.kind) && (!owner || b.ownerId === owner)) this.box(b.pos, col, this.widthAt(b.pos, b.width), true);
  }

  /** A miss forgiven (Smoke Veil, Clutch): smoke (or a flash) where it was. */
  private missSpot(id: string, col: number): void {
    const pos = this.b.missPos ?? this.c?.cursorPos();
    if (pos === undefined || pos === null) return;
    if (id === 'smokeVeil') {
      this.smokes.push({ x: this.barPt(pos).x, at: this.s.anim });
      if (this.smokes.length > 6) this.smokes.shift();
    } else this.box(pos, col);
  }

  /** The cursor glows and kicks (a column of light round it, a ring, sparks off its caps). */
  private cursorKick(col: number): void {
    const s = this.s;
    const c = this.c;
    if (!c) return;
    s.barView.cursorPulse(col);
    this.kicks.push({ col, at: s.anim });
    const p = this.barPt(c.cursorPos());
    s.fx.ring(p.x, p.y, 13, col, false);
    s.fx.chips(p.x, s.bar.y - 8, 4, [WHITE, col], 6, -1);
  }

  /** A mote flies from a bar position into the style tab (what was stored there: Guard, Focus, the Chain). */
  private toTab(pos: number | null | undefined, col: number): void {
    const s = this.s;
    const tab = s.callouts.tab;
    // (no tap: it came from a red that reached the hero, at the bar's left end)
    pos ??= 0;
    const p = this.barPt(pos);
    if (!tab) return this.box(pos, col, undefined, true);
    this.fly(p.x, s.bar.y - 2, tab.x + tab.w / 2, tab.y + tab.h / 2, 200, col, 'mote', 10, () => s.fx.ring(tab.x + tab.w / 2, tab.y + tab.h / 2, 10, col, false));
  }

  /** A star's twinkle (a landing): a 4-point sparkle that grows and shrinks, with rays. */
  private twinkle(x: number, y: number, col: number, r: number): void {
    this.twinkles.push({ x, y, at: this.s.anim, col, r });
    if (this.twinkles.length > 12) this.twinkles.shift();
  }

  /** The meter: a burst of sparks where it's filled to. */
  private meter(col: number): void {
    const s = this.s;
    const c = this.c;
    const m = s.meter;
    const k = c ? (c.finisherReady ? 1 : clamp01(c.meter)) : 0.5;
    const x = m.x + m.w * k;
    s.fx.chips(x, m.y + m.h / 2, 10, [WHITE, col, mix(col, WHITE, 0.5)], 8, -1);
    s.fx.ring(x, m.y + m.h / 2, 9, col, false);
  }

  /** The combo counter: it swells, a ring and sparks in the perk's colour. */
  private combo(col: number): void {
    const s = this.s;
    const r = s.hud.comboRect;
    s.hud.comboPopAt = performance.now();
    if (!r) return;
    const x = r.x + Math.min(12, r.w / 2);
    const y = r.y + r.h / 2;
    s.fx.ring(x, y, 14, col, false);
    s.fx.chips(x, y - 4, 10, [WHITE, col], 6, -1);
  }

  // ------------------------------------------------------------------ the stage's marks

  /** Brackets closing in on a foe, and a ring (the perk landed on it). */
  mark(enemyId: number, col: number): void {
    const v = this.foe(enemyId);
    if (!v) return;
    const s = this.s;
    if (this.marks.some((m) => m.id === enemyId && s.anim - m.at < 120)) return;
    this.marks.push({ id: enemyId, col, at: s.anim });
    const { x, y } = this.chest(v);
    s.fx.ring(x, y, 18, col, true);
    if (this.marks.length > 10) this.marks.shift();
  }

  /** A ring and sparks on the hero. */
  heroRing(col: number): void {
    const s = this.s;
    const h = s.fighters.h;
    s.fx.ring(h.x + 1, s.ground - 18, 18, col, true);
    s.fx.burst(h.x + 1, s.ground - 20, col, 8, true, 0.8);
    s.fx.glow(h.x + 1, s.ground - 18, 14, col, 240, s.ground);
  }

  /** A heal on the hero: green stars twinkling up round them (Mote's in its starlight), and a +N over them that merges
   *  the heals of a moment. */
  private healOnHero(amount: number, tint?: number, power = 1): void {
    const s = this.s;
    const a = s.anim;
    if (amount <= 0) return;
    const h = s.fighters.h;
    if (!this.sparks.length || a - this.sparks[this.sparks.length - 1].at > 260) {
      const cols = tint ? [tint, HEAL[1], WHITE] : [HEAL[1], HEAL[0], HEAL[2]];
      // (an ally's heal grows with its power: more stars)
      const stars = Array.from({ length: 7 + Math.round(Math.max(0, power - 1) * 8) }, (_, i) => ({ dx: rand(-13, 13), dy: rand(-30, -2), delay: i * 40, col: cols[i % cols.length] }));
      this.sparks.push({ at: a, stars });
      if (this.sparks.length > 4) this.sparks.shift();
      s.fx.glow(h.x + 1, s.ground - 18, 14, tint ?? HEAL[1], 320);
    }
    const sum = this.heal && a - this.heal.at < 900 ? this.heal.sum + amount : amount;
    this.heal = { sum, at: a };
    s.fx.replaceFloater('onsiteHeal', () => s.fx.addFloater(h.x - 19, s.ground - 34, `+${whole(Math.max(1, sum))}`, HEAL[1], 1, true, 0, -14, 0, 800, true));
  }

  /** Newt's Ember Bite ticked on a foe: its flames flare, a small orange number. */
  burnTick(enemyId: number, damage: number): void {
    const s = this.s;
    const v = this.foe(enemyId);
    if (!v) return;
    this.burnUntil.set(enemyId, s.anim + BURN_HOLD_MS);
    this.burnTickAt.set(enemyId, s.anim);
    v.flashUntil = Math.max(v.flashUntil, s.anim + 40);
    const { x, y } = this.chest(v);
    s.fx.burst(x - 2, y + 4, FIRE[2], 6, true, 0.7);
    s.fx.burst(x - 2, y, FIRE[0], 3, true, 0.9, true);
    if (damage > 0) s.fx.floatNum(x + rand(-5, 5), v.y - v.img.displayHeight - 6, whole(damage), 0xffa040, 1);
  }

  /** Whether a foe is burning now (its own burn field once the core has one; else the ticks and Newt's bite). */
  burning(id: number): boolean {
    const c = this.c;
    const e = c?.enemyById(id);
    if (e && typeof e.burn === 'number') return e.burn > 0;
    if (this.s.anim < (this.burnUntil.get(id) ?? -1e9)) return true;
    return !!c && c.perk.burnTicks > 0 && c.perk.burnFoe === id;
  }

  // ------------------------------------------------------------------ flights

  private fly(x0: number, y0: number, x1: number, y1: number, ms: number, col: number, look: FlyLook, arc: number, land?: () => void): void {
    this.flights.push({ x0, y0, x1, y1, at: this.s.anim, ms, col, look, arc, land });
    if (this.flights.length > 16) {
      const f = this.flights.shift();
      f?.land?.();
    }
  }

  // ------------------------------------------------------------------ frame

  /** The bar's marks and the flights (screen space). */
  drawBar(now: number): void {
    const s = this.s;
    const g = this.gBar;
    const gf = this.gFly;
    if (!g || !gf) return;
    g.clear();
    gf.clear();
    const c = this.c;
    if (!c || !s.fightHud()) {
      this.flights = [];
      return;
    }
    this.texts.begin();
    this.drawReady(g, c, now);
    this.drawBoxes(g, c, s.app.renderTime(now));
    this.drawSmoke(g);
    this.drawKicks(g, c);
    this.drawTwinkles(g);
    this.drawWindUp(g, c, now);
    drawDawnRoof(s, g, c, now); // (Solenne's Sunrise, Wren's smoke: view/dawn-roof.ts)
    this.p6.drawBar(g, gf, c, now);
    this.drawFlights(gf, now);
    this.texts.end();
  }

  /**
   * Bulwark ready (a Guardian at full Guard: the next block or hit sets it off): the Guard tab glows steel and breathes,
   * and the cursor is armed (a steel aura, a shield bobbing over it), so the payoff is waiting where the eyes are.
   */
  private drawReady(g: G, c: Combat, now: number): void {
    const s = this.s;
    if (s.app.run.phase !== 'fight' || heroDef(c.heroId as HeroId).style !== 'guardian' || guardOf(c) < guardMax(c)) return;
    const B = s.bar;
    const p = pulse(now, 520);
    const tab = s.callouts.tab;
    if (tab) {
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(STEEL[1], (0.5 - i * 0.1) * (0.6 + 0.4 * p));
        g.fillRect(tab.x - i - 1, tab.y - i - 1, tab.w + 2 * i + 2, tab.h + 2 * i + 2);
      }
      // a bright steel rim round it, breathing
      g.fillStyle(mix(STEEL[1], WHITE, p), 0.55 + 0.45 * p);
      g.fillRect(tab.x - 1, tab.y - 1, tab.w + 2, 1);
      g.fillRect(tab.x - 1, tab.y + tab.h, tab.w + 2, 1);
      g.fillRect(tab.x - 1, tab.y, 1, tab.h);
      g.fillRect(tab.x + tab.w, tab.y, 1, tab.h);
      // a glint running round the rim
      const per = 2 * (tab.w + tab.h);
      const d = Math.floor((now / 12) % per);
      const gx = d < tab.w ? tab.x + d : d < tab.w + tab.h ? tab.x + tab.w : d < 2 * tab.w + tab.h ? tab.x + tab.w - (d - tab.w - tab.h) : tab.x - 1;
      const gy = d < tab.w ? tab.y - 1 : d < tab.w + tab.h ? tab.y + (d - tab.w) : d < 2 * tab.w + tab.h ? tab.y + tab.h : tab.y + tab.h - (d - 2 * tab.w - tab.h);
      sparkle(g, gx, gy, 2, WHITE, 0.9);
    }
    // the cursor (the next block or hit sets it off) is armed: a steel aura round the blade, breathing, and a shield
    // bobbing over its top cap, a glint crossing it now and then
    const x = Math.round(this.barPt(c.cursorPosAt(s.app.renderTime(now))).x);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(mix(STEEL[1], WHITE, 0.3), (0.26 + 0.16 * p) * (1 - i * 0.28));
      g.fillRect(x - 3 - i * 2, B.y - 8 - i, 7 + i * 4, B.h + 16 + i * 2);
    }
    const sy = B.y - 17 - Math.round(p * 2);
    g.fillStyle(STEEL[1], 0.25 + 0.2 * p);
    g.fillRect(x - 6, sy - 7, 13, 14);
    this.shield(g, x + 0.5, sy, 11, 1, mix(STEEL[1], WHITE, p * 0.6));
    if (Math.floor(now / 260) % 4 === 0) sparkle(g, x + 3, sy - 3, 2, WHITE, 1);
  }

  /** Torva's Wind-Up armed: its smash multiplier right now ("x2.6"), riding over the cursor, hot, growing with the
   *  combo. */
  private drawWindUp(g: G, c: Combat, now: number): void {
    const s = this.s;
    if (c.heroId !== 'torva' || c.perk.windUp !== 1 || s.app.run.phase !== 'fight') return;
    const B = s.bar;
    const x = Math.round(this.barPt(c.cursorPosAt(s.app.renderTime(now))).x);
    const txt = mult(windUpMult(c));
    const y = B.y - 18 - Math.round(pulse(now, 300));
    this.texts.text(txt, x, y, mix(HEAT[1], HEAT[0], pulse(now, 300)), { bold: true, ox: 0.5, oy: 0.5 });
    void g;
  }

  private drawBoxes(g: G, c: Combat, t: number): void {
    const s = this.s;
    const B = s.bar;
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const bx = this.boxes[i];
      const k = (s.anim - bx.at) / bx.ms;
      if (k >= 1) {
        this.boxes.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      // (it follows its block along the bar while the block is there)
      const blk = bx.id >= 0 ? c.blocks.find((b) => b.id === bx.id) : undefined;
      if (blk) {
        const w = bx.x1 - bx.x0;
        bx.x0 = Math.round(this.barPt(c.blockPosAt(blk, t)).x - w / 2);
        bx.x1 = bx.x0 + w;
      }
      const a = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
      const grow = bx.small ? 0 : Math.round(3 * ease(Math.min(1, k * 2.5)));
      const x0 = bx.x0 - 2 - grow;
      const x1 = bx.x1 + 2 + grow;
      const y0 = B.y - 7 - grow;
      const y1 = B.y + B.h + 7 + grow;
      // a white flash over the block first
      if (k < 0.3) {
        g.fillStyle(WHITE, 0.55 * (1 - k / 0.3));
        g.fillRect(bx.x0, B.y - 5, bx.x1 - bx.x0, B.h + 10);
      }
      // the box: an ink rim, then its colour (thick as it pops), corners cut
      const th = k < 0.35 && !bx.small ? 2 : 1;
      const w = x1 - x0;
      const h = y1 - y0;
      g.fillStyle(INK, 0.8 * a);
      g.fillRect(x0 + 1, y0 - 1, w - 2, th + 2);
      g.fillRect(x0 + 1, y1 - th - 1, w - 2, th + 2);
      g.fillRect(x0 - 1, y0 + 1, th + 2, h - 2);
      g.fillRect(x1 - th - 1, y0 + 1, th + 2, h - 2);
      g.fillStyle(k < 0.15 ? mix(bx.col, WHITE, 0.6) : bx.col, a);
      g.fillRect(x0 + 1, y0, w - 2, th);
      g.fillRect(x0 + 1, y1 - th, w - 2, th);
      g.fillRect(x0, y0 + 1, th, h - 2);
      g.fillRect(x1 - th, y0 + 1, th, h - 2);
      // sparkles flying off its corners
      if (!bx.small && k < 0.8) {
        const d = Math.round(2 + 5 * ease(k));
        const r = k < 0.4 ? 1 : 0;
        for (const [cx, cy, sx, sy] of [
          [x0, y0, -1, -1],
          [x1, y0, 1, -1],
          [x0, y1, -1, 1],
          [x1, y1, 1, 1],
        ] as const)
          sparkle(g, cx + sx * d, cy + sy * d, r, k < 0.3 ? WHITE : bx.col, a);
      }
    }
  }

  /** Smoke Veil's puff where the miss was: soft lilac puffs swelling and rising off the bar. */
  private drawSmoke(g: G): void {
    const s = this.s;
    const B = s.bar;
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      const k = (s.anim - sm.at) / SMOKE_MS;
      if (k >= 1) {
        this.smokes.splice(i, 1);
        continue;
      }
      const a = k < 0.3 ? 1 : 1 - (k - 0.3) / 0.7;
      for (let j = 0; j < 5; j++) {
        const ang = (j / 5) * Math.PI * 2 + 0.6;
        const d = 3 + 9 * ease(k);
        const x = Math.round(sm.x + Math.cos(ang) * d);
        const y = Math.round(B.y + B.h / 2 + Math.sin(ang) * d * 0.5 - 10 * k);
        const r = Math.max(1, Math.round(3 + 3 * ease(k) - (j % 2)));
        g.fillStyle(SMOKE[2], 0.6 * a);
        g.fillCircle(x + 1, y + 1, r);
        g.fillStyle(SMOKE[1], 0.75 * a);
        g.fillCircle(x, y, r);
        g.fillStyle(SMOKE[0], 0.8 * a);
        g.fillCircle(x - 1, y - 1, Math.max(1, r - 2));
      }
    }
  }

  /** The cursor's kick: a column of light round the blade that narrows as it fades. */
  private drawKicks(g: G, c: Combat): void {
    const s = this.s;
    const B = s.bar;
    if (!this.kicks.length) return;
    const x = Math.round(this.barPt(c.cursorPosAt(s.app.renderTime(performance.now()))).x);
    for (let i = this.kicks.length - 1; i >= 0; i--) {
      const kk = this.kicks[i];
      const k = (s.anim - kk.at) / KICK_MS;
      if (k >= 1) {
        this.kicks.splice(i, 1);
        continue;
      }
      const w = Math.max(1, Math.round(6 * (1 - k)));
      const ext = Math.round(10 * ease(Math.min(1, k * 3)));
      g.fillStyle(kk.col, 0.45 * (1 - k));
      g.fillRect(x - w - 2, B.y - 8 - ext, w * 2 + 5, B.h + 16 + ext * 2);
      g.fillStyle(mix(kk.col, WHITE, 0.6), 0.7 * (1 - k));
      g.fillRect(x - Math.max(1, w - 2), B.y - 8 - ext, Math.max(1, w - 2) * 2 + 1, B.h + 16 + ext * 2);
    }
  }

  private drawTwinkles(g: G): void {
    const s = this.s;
    for (let i = this.twinkles.length - 1; i >= 0; i--) {
      const t = this.twinkles[i];
      const k = (s.anim - t.at) / TWINKLE_MS;
      if (k >= 1) {
        this.twinkles.splice(i, 1);
        continue;
      }
      const r = Math.round(t.r * Math.sin(Math.min(1, k * 1.4) * Math.PI));
      if (r <= 0) continue;
      const x = Math.round(t.x);
      const y = Math.round(t.y);
      // an ink cross under it, then the star: its colour, a white heart
      g.fillStyle(INK, 0.8);
      g.fillRect(x - r - 1, y - 1, r * 2 + 3, 3);
      g.fillRect(x - 1, y - r - 1, 3, r * 2 + 3);
      sparkle(g, x, y, r, t.col);
      sparkle(g, x, y, Math.max(0, r - 2), WHITE);
      // diagonal glints
      if (r >= 3) {
        g.fillStyle(t.col, 0.9);
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const)
          g.fillRect(x + dx * (r - 1), y + dy * (r - 1), 1, 1);
      }
    }
  }

  private drawFlights(g: G, now: number): void {
    const s = this.s;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      const k = (s.anim - f.at) / f.ms;
      if (k >= 1) {
        this.flights.splice(i, 1);
        f.land?.();
        continue;
      }
      if (k < 0) continue;
      const at = (q: number) => {
        const e = clamp01(q);
        const m = e * e * (3 - 2 * e) * 0.35 + e * 0.65; // eases in a little
        return [f.x0 + (f.x1 - f.x0) * m, f.y0 + (f.y1 - f.y0) * m - Math.sin(e * Math.PI) * f.arc] as const;
      };
      // the trail: thick and bright behind the head, thinning and fading
      const small = f.look === 'mote' || f.look === 'rock';
      const trail = small ? 5 : 10;
      const step = small ? 0.06 : 0.045;
      const tcol = f.look === 'leaf' || f.look === 'seed' ? HEAL[1] : f.col;
      // (an ink rim under it first, so it reads over the sky, the hero, anything)
      for (const ink of [true, false])
        for (let j = trail; j >= 1; j--) {
          if (k - j * step < 0) continue;
          const [x, y] = at(k - j * step);
          const fade = 1 - j / (trail + 1);
          const col = f.look === 'fire' ? FIRE[Math.min(4, (j + 1) >> 1)] : j <= 2 ? mix(tcol, WHITE, 0.5) : tcol;
          const sz = small ? (j < 2 ? 2 : 1) : j <= 3 ? 3 : j <= 6 ? 2 : 1;
          const X = Math.round(x) - (sz >> 1);
          const Y = Math.round(y) - (sz >> 1);
          if (ink) {
            g.fillStyle(INK, 0.45 * fade);
            g.fillRect(X - 1, Y - 1, sz + 2, sz + 2);
            continue;
          }
          g.fillStyle(col, 0.95 * fade);
          g.fillRect(X, Y, sz, sz);
          // a star's trail glitters
          if (f.look === 'star' && j % 2 === 0 && Math.floor(now / 50 + j) % 2) sparkle(g, Math.round(x) + (j % 4 ? 2 : -2), Math.round(y) - 3, 1, WHITE, fade);
        }
      const [hx, hy] = at(k);
      this.drawHead(g, f, Math.round(hx), Math.round(hy), now);
    }
  }

  /** A flight's head: a star, a seed, a leaf, a spark, a fireball, a mote, a pebble (each with an ink rim). */
  private drawHead(g: G, f: Fly, x: number, y: number, now: number): void {
    const blink = Math.floor(now / 60) % 2;
    switch (f.look) {
      case 'star': {
        // a four-point star, 9 px across: a soft glow, an ink rim, its colour's arms, a white heart; it twinkles
        g.fillStyle(f.col, 0.3);
        g.fillCircle(x, y, 6);
        g.fillStyle(INK, 0.95);
        g.fillRect(x - 5, y - 1, 11, 3);
        g.fillRect(x - 1, y - 5, 3, 11);
        g.fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle(f.col, 1);
        g.fillRect(x - 4, y, 9, 1);
        g.fillRect(x, y - 4, 1, 9);
        g.fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle(WHITE, 1);
        g.fillRect(x - 2, y, 5, 1);
        g.fillRect(x, y - 2, 1, 5);
        if (blink) {
          g.fillStyle(WHITE, 0.9);
          for (const [dx, dy] of [
            [-3, -3],
            [3, -3],
            [-3, 3],
            [3, 3],
          ] as const)
            g.fillRect(x + dx, y + dy, 1, 1);
        }
        break;
      }
      case 'seed': {
        // a fat brown seed with a green sprout
        g.fillStyle(INK, 1);
        g.fillRect(x - 3, y - 2, 6, 6);
        g.fillRect(x - 1, y - 5, 4, 4);
        g.fillStyle(0x8e5a2e, 1);
        g.fillRect(x - 2, y - 1, 4, 4);
        g.fillStyle(0xd09a5e, 1);
        g.fillRect(x - 2, y - 1, 2, 2);
        g.fillStyle(0x4e2c16, 1);
        g.fillRect(x + 1, y + 2, 1, 1);
        g.fillStyle(HEAL[1], 1);
        g.fillRect(x, y - 4, 1, 3);
        g.fillRect(x + 1, y - 4, 1, 1);
        break;
      }
      case 'leaf': {
        // a spinning leaf: it flips between its face and its edge
        g.fillStyle(INK, 1);
        if (blink) {
          g.fillRect(x - 4, y - 2, 8, 5);
          g.fillStyle(0x4a7e36, 1);
          g.fillRect(x - 3, y - 1, 6, 3);
          g.fillStyle(0xb4d058, 1);
          g.fillRect(x - 3, y - 1, 4, 1);
          g.fillStyle(0x2e5a32, 1);
          g.fillRect(x - 2, y, 4, 1);
        } else {
          g.fillRect(x - 2, y - 4, 5, 8);
          g.fillStyle(0x4a7e36, 1);
          g.fillRect(x - 1, y - 3, 3, 6);
          g.fillStyle(0xb4d058, 1);
          g.fillRect(x - 1, y - 3, 1, 4);
        }
        break;
      }
      case 'fire': {
        g.fillStyle(FIRE[4], 0.9);
        g.fillCircle(x, y, 4);
        g.fillStyle(FIRE[3], 1);
        g.fillCircle(x, y, 3);
        g.fillStyle(FIRE[2], 1);
        g.fillCircle(x, y, 2);
        g.fillStyle(FIRE[0], 1);
        g.fillRect(x - 1, y - 1, 2, 2);
        break;
      }
      case 'rock': {
        g.fillStyle(INK, 1);
        g.fillRect(x - 3, y - 2, 6, 5);
        g.fillRect(x - 2, y - 3, 4, 7);
        g.fillStyle(0x9a9080, 1);
        g.fillRect(x - 2, y - 2, 4, 4);
        g.fillStyle(0xd8d0c0, 1);
        g.fillRect(x - 2, y - 2, 2, 1);
        g.fillRect(x - 2, y - 1, 1, 1);
        g.fillStyle(0x5a5448, 1);
        g.fillRect(x + 1, y + 1, 1, 1);
        break;
      }
      case 'mote': {
        g.fillStyle(INK, 0.85);
        g.fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle(f.col, 1);
        g.fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle(WHITE, 1);
        g.fillRect(x - 1, y - 1, 2, 1);
        g.fillRect(x - 1, y, 1, 1);
        break;
      }
      default: {
        // a spark: a bright diamond in the companion's colour, a white heart
        g.fillStyle(f.col, 0.3);
        g.fillCircle(x, y, 5);
        g.fillStyle(INK, 0.9);
        g.fillRect(x - 3, y - 1, 7, 3);
        g.fillRect(x - 1, y - 3, 3, 7);
        g.fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle(f.col, 1);
        g.fillRect(x - 2, y, 5, 1);
        g.fillRect(x, y - 2, 1, 5);
        g.fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle(WHITE, 1);
        g.fillRect(x, y - 1, 1, 3);
        g.fillRect(x - 1, y, 3, 1);
      }
    }
  }

  /** The stage's marks (the world layer, after the actors): burning foes, the fire sweep, marks on foes, the hero's
   *  heal stars. */
  drawWorld(g: G, now: number): void {
    const s = this.s;
    const c = this.c;
    if (!c || !s.fightHud()) return;
    this.drawBurns(g, c, now);
    this.drawSweeps(g);
    this.drawWaves(g);
    this.drawBashes(g);
    this.drawMarks(g);
    this.drawHeal(g);
    this.drawAllyPower(g, now);
    this.p6.drawWorld(g, c, now);
  }

  /** A heater shield (its point down), `h` px tall, centred on (x, y): ink rim, steel face lit on the left, a boss. */
  private shield(g: G, x: number, y: number, h: number, a: number, face: number = STEEL[1]): void {
    const w = Math.max(3, Math.round(h * 0.75));
    const top = Math.round(y - h / 2);
    const rowW = (i: number) => (i < h * 0.55 ? w : Math.max(1, Math.round(w * (1 - (i - h * 0.55) / (h * 0.45)))));
    for (const [col, pad] of [
      [INK, 1],
      [face, 0],
    ] as const) {
      g.fillStyle(col, a);
      for (let i = -pad; i < h + pad; i++) {
        const rw = rowW(Math.max(0, Math.min(h - 1, i))) + pad * 2;
        g.fillRect(Math.round(x - rw / 2), top + i, rw, 1);
      }
    }
    g.fillStyle(STEEL[0], a);
    g.fillRect(Math.round(x - w / 2), top, 1, Math.round(h * 0.55));
    g.fillRect(Math.round(x - w / 2), top, w, 1);
    g.fillStyle(STEEL[3], a);
    g.fillRect(Math.round(x), top + 2, 1, h - 4);
    g.fillStyle(WHITE, a);
    g.fillRect(Math.round(x) - 1, Math.round(y - h * 0.15), 2, 2);
  }

  /** Shield Slams in flight: the shield spinning edge-on and back as it flies, a steel streak behind it. */
  private drawBashes(g: G): void {
    const s = this.s;
    for (let i = this.bashes.length - 1; i >= 0; i--) {
      const b = this.bashes[i];
      const k = (s.anim - b.at) / b.ms;
      if (k >= 1.6) {
        this.bashes.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const q = Math.min(1, k);
      const x = b.x0 + (b.x1 - b.x0) * ease(q);
      const y = b.y0 + (b.y1 - b.y0) * ease(q) - Math.sin(q * Math.PI) * 4;
      if (k < 1) {
        for (let j = 1; j <= 5; j++) {
          const qq = Math.max(0, q - j * 0.08);
          const tx = b.x0 + (b.x1 - b.x0) * ease(qq);
          const ty = b.y0 + (b.y1 - b.y0) * ease(qq) - Math.sin(qq * Math.PI) * 4;
          g.fillStyle(j < 2 ? STEEL[0] : STEEL[1], 0.8 * (1 - j / 6));
          g.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3 - (j >> 1), 3 - (j >> 1));
        }
        this.shield(g, x, y, b.small ? 7 : b.perfect ? 11 : 9, 1, b.perfect ? STEEL[0] : STEEL[1]);
      } else {
        // the bash: its imprint flashes on the foe and fades
        const a = 1 - (k - 1) / 0.6;
        this.shield(g, b.x1, b.y1, (b.small ? 9 : b.perfect ? 15 : 12) + Math.round((k - 1) * 8), 0.75 * a, WHITE);
      }
    }
  }

  /** The Bulwark's great shield sweeping across every foe, with its afterimages, a steel wall of light behind it. */
  private drawWaves(g: G): void {
    const s = this.s;
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      const k = (s.anim - w.at) / w.ms;
      if (k >= 1.25) {
        this.waves.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const q = Math.min(1, k);
      const x = w.x0 + (w.x1 - w.x0) * ease(q);
      const fade = k < 1 ? 1 : 1 - (k - 1) / 0.25;
      // the wall of light it leaves: a band of steel along the foes' line, brightest at the shield
      for (let xx = Math.round(w.x0); xx < x; xx += 2) {
        const qq = (xx - w.x0) / Math.max(1, x - w.x0);
        g.fillStyle(STEEL[1], 0.28 * qq * fade);
        g.fillRect(xx, w.y - 18, 2, 34);
        g.fillStyle(WHITE, 0.35 * qq * qq * fade);
        g.fillRect(xx, w.y - 4, 2, 8);
      }
      // afterimages, then the shield itself (tall as a foe)
      for (let j = 3; j >= 1; j--) this.shield(g, x - j * 10, w.y, 26 - j * 2, 0.22 * (4 - j) * fade, STEEL[2]);
      this.shield(g, x, w.y, 28, fade, STEEL[1]);
    }
  }

  /** A Summoner's allies glow with their power (the Companion stat): a soft aura under each from x1.2. */
  private drawAllyPower(g: G, now: number): void {
    const s = this.s;
    const k = clamp01((this.allyPower - 1.15) / 0.5);
    if (k <= 0) return;
    for (const v of s.fighters.party.allies.values()) {
      if (!v.img.visible || v.leaveAt) continue;
      const p = pulse(now, 900, v.id * 170);
      g.fillStyle(ALLY_COL[v.kind], (0.1 + 0.12 * k) * (0.6 + 0.4 * p));
      g.fillCircle(Math.round(v.img.x), Math.round(v.img.y - (v.kind === 'glowmoth' ? 0 : 9)), 9 + Math.round(3 * k));
    }
  }

  /**
   * A burning foe (Newt's Ember Bite): flames licking up its front, flaring as each tick lands, embers rising. They
   * keep burning while the ticks come (and while its own burn lasts, once the core keeps one per foe).
   */
  private drawBurns(g: G, c: Combat, now: number): void {
    const s = this.s;
    const a = s.anim;
    let any = false;
    for (const v of s.fighters.enemies.values()) {
      if (v.dieAt || !v.img.visible || !this.burning(v.id)) continue;
      const e = c.enemyById(v.id);
      if (!e?.alive) continue;
      any = true;
      const W = v.img.displayWidth;
      const H = v.img.displayHeight;
      const flare = clamp01(1 - (a - (this.burnTickAt.get(v.id) ?? -1e9)) / 260);
      // (a hotter burn, more damage a second for its size, burns taller: up to half again at 3% of its HP a second)
      const hot = 1 + 0.5 * clamp01((e.burnDps ?? 0) / Math.max(1, e.maxHp * 0.03));
      const n = W > 30 ? 5 : 4;
      const x0 = v.x - W * 0.36;
      const base = v.y - Math.round(H * 0.12);
      for (let i = 0; i < n; i++) {
        const fx = Math.round(x0 + i * ((W * 0.62) / (n - 1)));
        const flick = (Math.floor(a / 70) + i * 2) % 4;
        const h = Math.round((5 + ((i * 3) % 4) + flick) * (1 + 0.6 * flare) * hot);
        const fy = base - Math.round(((i * 5) % 7) * (H / 40));
        flame(g, fx, fy, h, flick, flare > 0.3);
      }
      // a warm light on it
      if (flare > 0) {
        g.fillStyle(0xff8a2a, 0.18 * flare);
        g.fillCircle(Math.round(v.x), Math.round(v.y - H * 0.4), Math.round(W * 0.5));
      }
    }
    // embers rising off the burning foes (a few a second)
    if (any && a - this.emberAt > 90) {
      this.emberAt = a;
      for (const v of s.fighters.enemies.values()) {
        if (v.dieAt || !this.burning(v.id)) continue;
        s.fx.particles.push({ x: v.x + rand(-v.img.displayWidth * 0.35, v.img.displayWidth * 0.25), y: v.y - rand(4, v.img.displayHeight * 0.5), vx: rand(-6, 6), vy: rand(-36, -20), g: 0, born: now, life: rand(300, 520), color: Math.random() < 0.5 ? FIRE[1] : FIRE[2], size: 1, world: true, streak: false, shape: 'spark' });
      }
    }
  }

  /** Sunny's sweep: a wall of fire running along the foes' line, licking up their bodies, dying down behind it. */
  private drawSweeps(g: G): void {
    const s = this.s;
    const a = s.anim;
    const ground = s.ground;
    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const sw = this.sweeps[i];
      const t = a - sw.at;
      const LINGER = 260;
      if (t > sw.ms + LINGER) {
        this.sweeps.splice(i, 1);
        continue;
      }
      if (t < 0) continue;
      const front = sw.x0 + (sw.x1 - sw.x0) * ease(clamp01(t / sw.ms));
      const y0 = ground + 2;
      for (let x = Math.floor(sw.x0); x <= front; x++) {
        // how long ago the front passed here: the flames are tallest just behind it and die down
        const passed = t - sw.ms * clamp01((x - sw.x0) / Math.max(1, sw.x1 - sw.x0));
        const life = 1 - clamp01(passed / LINGER);
        if (life <= 0) continue;
        // tongues of fire: peaks every few px, flickering and running along
        const wave = 0.5 + 0.5 * Math.sin(x * 1.25 + a / 45) * Math.cos(x * 0.43 - a / 70);
        const hot = front - x < 8 ? 1.25 : 1;
        const h = Math.max(1, Math.round((3 + 11 * life) * (0.35 + 0.65 * wave) * hot));
        const al = 0.9 * Math.min(1, life * 1.6);
        g.fillStyle(FIRE[4], al);
        g.fillRect(x, y0 - h - 1, 1, 1);
        g.fillStyle(FIRE[3], al);
        g.fillRect(x, y0 - h, 1, h);
        g.fillStyle(FIRE[2], al);
        g.fillRect(x, y0 - Math.round(h * 0.75), 1, Math.round(h * 0.75));
        g.fillStyle(FIRE[1], al);
        g.fillRect(x, y0 - Math.round(h * 0.45), 1, Math.round(h * 0.45));
        if (life > 0.6) {
          g.fillStyle(FIRE[0], al);
          g.fillRect(x, y0 - Math.round(h * 0.2), 1, Math.round(h * 0.2));
        }
      }
      // the front: a white-hot edge licking up
      if (t <= sw.ms) {
        const fx = Math.round(front);
        g.fillStyle(FIRE[1], 0.95);
        g.fillRect(fx - 1, y0 - 17, 2, 17);
        g.fillStyle(WHITE, 0.9);
        g.fillRect(fx, y0 - 13, 1, 13);
      }
    }
  }

  /** Brackets closing in on a marked foe (its chest), fading. */
  private drawMarks(g: G): void {
    const s = this.s;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      const k = (s.anim - m.at) / MARK_MS;
      const v = s.fighters.enemies.get(m.id);
      if (k >= 1 || !v) {
        this.marks.splice(i, 1);
        continue;
      }
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      const { x, y } = this.chest(v);
      const half = Math.max(8, Math.round(Math.min(v.img.displayWidth, v.img.displayHeight) * 0.38));
      const r = Math.round(half + 8 * (1 - ease(Math.min(1, k * 3))));
      const arm = 4;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const cx = Math.round(x + sx * r);
        const cy = Math.round(y + sy * r * 0.8);
        // an L in the perk's colour, ink-rimmed
        g.fillStyle(INK, 0.85 * a);
        g.fillRect(Math.min(cx, cx - sx * arm) - 1, cy - 1, arm + 3, 3);
        g.fillRect(cx - 1, Math.min(cy, cy - sy * arm) - 1, 3, arm + 3);
        g.fillStyle(k < 0.2 ? WHITE : m.col, a);
        g.fillRect(Math.min(cx, cx - sx * arm), cy, arm + 1, 1);
        g.fillRect(cx, Math.min(cy, cy - sy * arm), 1, arm + 1);
      }
    }
  }

  /** The heal's stars twinkling up round the hero. */
  private drawHeal(g: G): void {
    const s = this.s;
    const h = s.fighters.h;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      const t = s.anim - sp.at;
      if (t > HEAL_MS + 300) {
        this.sparks.splice(i, 1);
        continue;
      }
      for (const st of sp.stars) {
        const k = (t - st.delay) / HEAL_MS;
        if (k < 0 || k >= 1) continue;
        const x = Math.round(h.x + 1 + st.dx);
        const y = Math.round(s.ground - 16 + st.dy - 10 * ease(k));
        const r = Math.round(2.5 * Math.sin(k * Math.PI));
        g.fillStyle(INK, 0.6 * (1 - k));
        g.fillRect(x - r - 1, y - 1, r * 2 + 3, 3);
        g.fillRect(x - 1, y - r - 1, 3, r * 2 + 3);
        sparkle(g, x, y, r, st.col, 1 - k * 0.5);
        g.fillStyle(WHITE, 1 - k);
        g.fillRect(x, y, 1, 1);
      }
    }
  }
}

/**
 * A tongue of fire `h` px tall standing on (x, baseY): a 3-px body tapering to a swaying 1-px tip, a deep red rim, an
 * orange body, a yellow heart; a white-hot tip when it flares.
 */
function flame(g: G, x: number, baseY: number, h: number, flick: number, hot: boolean): void {
  const body = Math.max(2, Math.round(h * 0.6));
  const tip = Math.max(1, h - body);
  const sway = (flick % 3) - 1;
  g.fillStyle(FIRE[4], 0.85);
  g.fillRect(x - 2, baseY - body, 5, body + 1);
  g.fillRect(x - 1 + sway, baseY - h - 1, 3, tip + 1);
  g.fillStyle(FIRE[3], 1);
  g.fillRect(x - 1, baseY - body, 3, body);
  g.fillRect(x + sway, baseY - h, 1, tip);
  g.fillStyle(FIRE[2], 1);
  g.fillRect(x - 1, baseY - body + 1, 3, body - 1);
  g.fillStyle(FIRE[1], 1);
  g.fillRect(x, baseY - body + 1, 1, Math.max(1, body - 2));
  g.fillStyle(hot ? WHITE : FIRE[0], 1);
  g.fillRect(x + sway, baseY - h, 1, 1);
}
