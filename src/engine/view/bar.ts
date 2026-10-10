// The timing bar: metal frame, patches on the track (ice, snowdrifts, slow runes; view/bar-kinds.ts paints them), the
// blocks (and how they leave), the cursor blade, hit beams and the swipe hint. The second region's pieces: a hold's
// notches and fill, a mirror shard standing on the bar (a flash when the cursor bounces), an iced yellow's coat and
// its cracks, an icicle's mark before it lands and its fuse ring once it has, a red's trail of ice-to-be. The heroes'
// pieces: kegs, frozen blocks, chilled and pinned reds, Shadow Dash's streak (its afterimages, the burst where it lands,
// the violet slow patch there), the Rampart wall, Overgrowth's vines,
// Big Bang's kegs flying in, Volley's arrows, Glacier's frost wave and Earthsplitter's crack. A block that changes
// kind (Chain Reaction) flashes as it turns. The cursor leaves a speed streak on ice and drags in snow. What's armed
// shows before it acts (no sound needed): a blocker standing ready at the left end (Rock Wall, a braced Barkback, an
// afterimage), Oil Can's wider Perfect zones on the blocks, Wind-Up's burning cursor, a green ability's window as a
// green sheen on the cursor. A trap a companion's fire burns away chars and smokes off the bar. (The words that pop over
// the bar are view/callouts.ts; what perks, allies and companions do to the blocks is view/onsite.ts.)
import Phaser from 'phaser';
import { isAttack, isRed, unlit, type Block, type BlockKind, type Combat, type RemoveReason } from '../../core/combat';
import type { FightScene } from '../scene';
import { ICONS } from '../art';
import { isAshTheme } from '../region-art';
import { buildBarFrame } from '../chrome';
import { brick, ellipse, icon, rows, slab } from './pixels';
import { BLOCK_ICONS, FOE_ICONS } from './icons';
import { isGilded } from '../../core/kit-fx';
import { drawGilded } from './dawn-roof';
import { brewOf } from '../../core/kit-fizz-brann';
import { paintBarFlask } from './fizz-brann-paint';
import { drawKitBar, drawKitChill } from './bar-gorm-tess';
import { BLOCKER_FACE, cursorGhost, drawBlocker, drawChill, drawFrozen, drawFuse, drawGrow, drawHold, drawIceCoat, drawKeg, drawPatch, drawVines, drawWall, sparkle, type PatchLook } from './bar-kinds';
import { BOMB_COL, clamp01, deepOf, DYING_MS, dyingStyle, ease, INK, kindCol, mix, pulse, rand, stackCol, WHITE, type Dying } from './shared';
import { focusCap, focusOf } from '../../core/styles';
import { ImagePool } from './ui';
import { drawBarRules } from './bar-links';
import { drawDarkShape, drawLantern, drawWater, glisten, lanternRim } from './bar-dusk';
import { drawBlaze, drawHeat, drawMirages } from './bar-noon';
import { A11Y } from '../a11y';

/** The block mark on a plain red: an incoming strike (a down chevron); the thin one for a red too narrow for it. */
const RED_MARK = ['#...#', '.#.#.', '..#..'];
const RED_MARK_THIN = ['#.#', '.#.'];

type G = Phaser.GameObjects.Graphics;

/** The cursor's colours (one cursor for every hero). */
const LOOK = { blade: 0x3a8ae8, core: 0x9ad8ff, deep: 0x1a3c8a } as const;
/** Patches fade in and out over this long (ms of scene time). */
const ZONE_FADE_MS = 240;
/** The green abilities that are a window of a few seconds (Battle Focus, Smoke Veil, Chill, Brace): the cursor is
 *  tinted green while one runs. */
const TIMED_ABILITY = new Set<string>(['rowan', 'sable', 'neve', 'hollis']);
/** Oil Can's sheen on a block's Perfect zone, and Wind-Up's heat round the cursor. */
const OIL = [0xfff0a0, 0xf2c230] as const;
const WINDUP = [0xffd080, 0xff7a3a] as const;
/** Shadow Dash's violets [light, base, deep, dark]. */
const DASH_COL = [0xdab0ff, 0xb070f0, 0x9a52d8, 0x4a2470] as const;
/** A Shadow Dash's streak stays this long after the cursor lands (its tail running in to the landing). */
const DASH_FADE_MS = 340;
/** Fire on the bar (a trap burning away): [white-hot, yellow, orange, red, deep red], and the char it leaves. */
const FIRE = [0xfff0a0, 0xffd060, 0xff8a2a, 0xe0461a, 0x8a1a22] as const;
const CHAR = [0x5a4048, 0x3a2a30, 0x221820] as const;

export class BarView {
  g!: G;
  /** Over the blocks and the bar's sprites: the cursor, the dash streak, flashes and the fx particles. */
  private gTop: G | null = null;
  img: Phaser.GameObjects.Image | null = null;
  /** The bar's sprites (mirror shards, icicle marks). */
  private pool: ImagePool;
  dying: Dying[] = [];
  private blockSeen = new Map<number, number>(); // block id -> anim time it first appeared (or lands)
  explodeFx: { x: number; r: number; until: number; own: boolean } | null = null;
  beams: Array<{ x: number; at: number; color: number }> = [];
  private cursorPulseAt = 0;
  private cursorPulseColor = WHITE;
  /** Blocks that just changed kind: id -> anim time (they flash white as they turn). */
  private morphs = new Map<number, number>();
  /** Blocks that took a red's place where it stood (Turnabout's kegs, Big Freeze's ice): no drop-in; a keg widens in
   *  as the red flips away. id -> how (anim time it shows from is its blockSeen). */
  private turned = new Map<number, 'flip' | 'ice'>();
  shakeUntil = 0;
  /** Patches: when each was first seen (it fades in), its last look (to fade it out when it's gone), the fading. */
  private zoneSeen = new Map<number, number>();
  private zoneLast = new Map<number, PatchLook>();
  private zoneGone: Array<PatchLook & { at: number }> = [];
  /** Where icicles will land (anim time marked, and how long until they land). */
  private marks: Array<{ pos: number; at: number; ms: number }> = [];
  /** Shadow Dash streaks (bar positions, anim time; when the cursor landed at `to`, and when it left each of its three
   *  afterimages behind). */
  private dashes: Array<{ from: number; to: number; at: number; landAt: number; ghosts: number[] }> = [];
  /** Shadow Dash landings (bar position, anim time): a flash where the cursor lands. */
  private dashLands: Array<{ pos: number; at: number; dir: number }> = [];
  /** A still red's fuse when first seen (its ring shrinks from there); an iced block's most taps (its cracks). */
  private fuse0 = new Map<number, number>();
  /** A red frozen solid: how long its freeze was when first seen (it cracks as it thaws). */
  private chill0 = new Map<number, number>();
  private iceTaps = new Map<number, number>();
  /** Mirror bounces (a flash on the shard), and blockers at the left end (a Barkback, Brick, an afterimage). */
  private mirrorFlashes: Array<{ pos: number; at: number }> = [];
  private blockers: Array<{ at: number; face: readonly [number, number, number] }> = [];
  /** Blockers standing ready at the left end: since when (anim time; they pop up as they ready). */
  private readyAt = new Map<string, number>();
  private wallFlashAt = -1e9;
  /** Sweeps across the whole bar: Glacier's frost wave, Earthsplitter's crack. */
  private sweeps: Array<{ kind: 'frost' | 'crack'; at: number }> = [];
  /** Volley's arrows falling onto the reds, and Big Bang's kegs flying onto the bar (screen px from, bar pos to). */
  private arrows: Array<{ pos: number; at: number; ms: number }> = [];
  private flyKegs: Array<{ x0: number; y0: number; pos: number; at: number; ms: number }> = [];

  constructor(private readonly s: FightScene) {
    this.pool = new ImagePool(s);
  }

  /** Regenerate the frame texture for the current bar size. */
  build(): void {
    const B = this.s.bar;
    buildBarFrame(this.s, B.w, B.h);
    this.img?.destroy();
    this.img = this.s.add.image(B.x - 9, B.y - 5, 'barframe').setOrigin(0, 0).setDepth(10.5);
    this.gTop ??= this.s.add.graphics().setDepth(11.3);
    this.pool.destroy();
  }

  /** A new fight: forget which blocks were already seen dropping in, and the bar's passing effects. */
  newFight(): void {
    this.blockSeen.clear();
    this.morphs.clear();
    this.turned.clear();
    this.zoneSeen.clear();
    this.zoneLast.clear();
    this.zoneGone = [];
    this.marks = [];
    this.dashes = [];
    this.dashLands = [];
    this.fuse0.clear();
    this.chill0.clear();
    this.iceTaps.clear();
    this.mirrorFlashes = [];
    this.blockers = [];
    this.readyAt.clear();
    this.sweeps = [];
    this.arrows = [];
    this.flyKegs = [];
    this.wallFlashAt = -1e9;
  }

  /** A block changed kind (Chain Reaction turns yellows green): a flash on it, a ring and chips in its new colour. */
  morph(id: number): void {
    const s = this.s;
    const c = s.app.run.combat;
    const b = c?.blocks.find((x) => x.id === id);
    this.morphs.set(id, s.anim);
    if (!b || !c) return;
    const x = this.x(b.pos);
    const y = this.mid();
    const [base, light] = kindCol(b.kind);
    s.fx.ring(x, y, 10, light, false);
    s.fx.chips(x, s.bar.y - 4, Math.max(6, b.width * s.bar.w), [WHITE, light, base], 6, -1);
  }

  /** Bar position (0..1) to game x. */
  x(pos: number): number {
    return this.s.bar.x + pos * this.s.bar.w;
  }

  private mid(): number {
    return this.s.bar.y + this.s.bar.h / 2;
  }

  /** The cursor pulses in a colour (a hit, a block). */
  cursorPulse(color: number): void {
    this.cursorPulseAt = performance.now();
    this.cursorPulseColor = color;
  }

  /** Ring + vertical beam shooting up from the bar where a block was hit. */
  cursorHit(x: number, color: number): void {
    const fx = this.s.fx;
    const y = this.mid();
    fx.ring(x, y, 18, color, false);
    this.beams.push({ x: Math.round(x), at: performance.now(), color });
    fx.burst(x, y, WHITE, 8, false, 1.3, true);
  }

  /** A removed block plays out on the bar (see drawDying) and throws chips. */
  blockDies(kind: BlockKind, pos: number, width: number, reason: RemoveReason): void {
    const s = this.s;
    const fx = s.fx;
    const style = dyingStyle(kind, reason);
    const x = this.x(pos);
    const w = Math.max(6, Math.round(width * s.bar.w) - 1);
    if (kind !== 'mirror') this.dying.push({ x, w, kind, reason, style, at: s.anim });
    const live = s.app.run.combat?.blocks;
    for (const m of [this.blockSeen, this.fuse0, this.chill0, this.iceTaps, this.morphs, this.turned]) for (const id of m.keys()) if (!live?.some((b) => b.id === id)) m.delete(id);
    if (this.dying.length > 24) this.dying.shift();
    const [base, light] = reason === 'bomb' ? BOMB_COL : kindCol(kind);
    const top = s.bar.y - 5;
    const mid = this.mid();
    if (kind === 'mirror') {
      // the shard cracks and its pieces fall
      fx.chips(x, top, 4, [WHITE, 0xc8d8f0, 0x7a8ab0], 8, 0);
      return;
    }
    if (style === 'pop') {
      fx.chips(x, top, w, [WHITE, light, base], 10, -1);
    } else if (style === 'shatter') {
      fx.chips(x, mid, w, [base, light, WHITE], 12, 0);
      fx.chips(x, mid, w, [0x7ae0ff, WHITE], 4, -1);
    } else if (style === 'crunch') {
      fx.chips(x - w / 2, mid, 4, [base, light, WHITE], 9, 1);
    } else if (style === 'zip') {
      fx.chips(x, mid, w, [WHITE, light], 5, 0);
    } else if (style === 'fly') {
      fx.chips(x, mid, w, [WHITE, light, base], 8, 1);
    }
  }

  // ------------------------------------------------------------------ the bar's own events

  /** A patch was laid: a puff of frost (or snow, or runes' light) over it as it fades in. (A Shadow Dash's landing
   *  slow-down, 'land', comes with its dash: no puff of its own.) */
  zoneOn(kind: string, lo: number, hi: number): void {
    if (kind === 'dash' || kind === 'land') return;
    const s = this.s;
    const x = this.x((lo + hi) / 2);
    const w = Math.max(6, (hi - lo) * s.bar.w);
    const cols = kind === 'ice' ? [WHITE, 0xc8f4ff, 0x8ae0f6] : kind === 'snow' ? [WHITE, 0xe8f0fa] : [0x9ad8ff, 0xe0f6ff];
    s.fx.chips(x, s.bar.y - 2, w, cols, Math.min(14, 4 + Math.round(w / 6)), -1);
  }

  /** A patch went: it fades out where it last was. */
  zoneOff(id: number): void {
    const z = this.zoneLast.get(id);
    this.zoneLast.delete(id);
    this.zoneSeen.delete(id);
    if (z) this.zoneGone.push({ ...z, at: this.s.anim });
  }

  /** A patch's last look (where it was), while it's on the bar. */
  zoneLook(id: number): PatchLook | undefined {
    return this.zoneLast.get(id);
  }

  /**
   * A red just taken off the bar at `pos` turns into block `id` where it stood: Turnabout flips it into a keg (the red
   * narrows to its edge, the keg widens out of it, a puff of smoke), Big Freeze ices it over (ice climbs up the red,
   * a flash, and it's a frozen block). Neither drops in from above.
   */
  turnInto(pos: number, id: number, how: 'flip' | 'ice'): void {
    const s = this.s;
    const x = this.x(pos);
    const style = how === 'flip' ? 'flip' : 'iceOver';
    for (const d of this.dying) if (d.at === s.anim && isRed(d.kind) && Math.abs(d.x - x) < 1.5) d.style = style;
    this.blockSeen.set(id, s.anim + DYING_MS[style]);
    this.turned.set(id, how);
    const y = this.mid();
    if (how === 'flip') {
      s.later(DYING_MS.flip, () => {
        s.fx.chips(x, y, 8, [0x6a6276, 0x3a3444, 0xffb060], 8, -1);
        s.fx.ring(x, y, 12, 0xffb060, false);
      });
    } else {
      s.fx.chips(x, s.bar.y + s.bar.h, 10, [WHITE, 0xe0faff, 0x8ae0f6], 8, -1);
      s.later(DYING_MS.iceOver, () => s.fx.ring(x, y, 13, 0xbff0ff, false));
    }
  }

  /** A trap just taken off the bar at `pos` burns away there instead (a companion's fire: Sunny's Fire Breath), once
   *  the fire reaches it `delay` ms from now (it stands there until then). */
  burnAway(pos: number, delay = 0): void {
    const x = this.x(pos);
    for (const d of this.dying)
      if (d.at === this.s.anim && d.kind === 'purple' && Math.abs(d.x - x) < 1) {
        d.style = 'burn';
        d.at += delay;
      }
  }

  /** An icicle will land at `pos` in `sec`: its mark shows there until then. */
  mark(pos: number, sec: number): void {
    this.marks.push({ pos, at: this.s.anim, ms: Math.max(150, sec * 1000) });
  }

  /** The cursor bounced off a mirror shard: the shard flashes and throws glints. */
  mirror(pos: number): void {
    const x = this.x(pos);
    this.mirrorFlashes.push({ pos, at: this.s.anim });
    this.s.fx.ring(x, this.mid(), 10, 0xe0e8ff, false);
    this.s.fx.chips(x, this.s.bar.y - 6, 4, [WHITE, 0xd8e8ff], 5, -1);
    this.cursorPulse(0xe0e8ff);
  }

  /** Shadow Dash: a streak from where the cursor was to where it bursts to (it kicks off with a violet puff). */
  dash(from: number, to: number): void {
    const s = this.s;
    this.dashes.push({ from, to, at: s.anim, landAt: 0, ghosts: [] });
    if (this.dashes.length > 4) this.dashes.shift();
    const x = this.x(from);
    s.fx.ring(x, this.mid(), 10, DASH_COL[1], false);
    s.fx.chips(x, this.mid(), 4, [WHITE, DASH_COL[1], DASH_COL[2]], 6, 0);
  }

  /** The cursor reached the end of a dash: a burst where it lands (a flash, a ring, a violet starburst, sparks). */
  private dashLanded(to: number, dir: number): void {
    const s = this.s;
    const x = this.x(to);
    const y = this.mid();
    this.dashLands.push({ pos: to, at: s.anim, dir });
    if (this.dashLands.length > 4) this.dashLands.shift();
    s.fx.ring(x, y, 17, DASH_COL[1], false);
    s.fx.ring(x, y, 9, WHITE, false);
    s.fx.stars.push({ x, y, at: s.anim, r: 11, color: DASH_COL[2], world: false });
    s.fx.chips(x, y, 6, [WHITE, DASH_COL[0], DASH_COL[1]], 10, 0);
    this.cursorPulse(DASH_COL[0]);
  }

  /** A hold was pressed (a ring at its start) or let go (done: a ring at its end; slipped: it shatters, "Slip!"). */
  hold(id: number, pos: number, phase: 'start' | 'done' | 'slip', perfect = false): void {
    const s = this.s;
    const c = s.app.run.combat;
    const b = c?.blocks.find((x) => x.id === id);
    const half = b ? b.width / 2 : s.app.tuning.hold.width / 2;
    const dir = c?.holding?.id === id ? c.holding.dir : c ? c.cursorDirAt(c.time) : 1;
    const mid = this.mid();
    if (phase === 'start') {
      const x = this.x(pos - dir * half);
      s.fx.ring(x, mid, 12, perfect ? 0xffe680 : 0x9ad8ff, false);
      s.fx.judge(x, perfect ? 'Perfect hold!' : 'Hold!', perfect ? 0xfff07a : 0x9ad8ff, true);
      this.cursorPulse(perfect ? 0xfff07a : 0x9ad8ff);
    } else if (phase === 'done') {
      const x = this.x(pos + dir * half);
      s.fx.ring(x, mid, 16, 0xe0faff, false);
      s.fx.sparkle(x, mid);
    } else {
      s.fx.judge(this.x(pos), 'Slip!', 0x9ad8ff, true);
      s.fx.chips(this.x(pos), mid, Math.max(8, half * 2 * s.bar.w), [WHITE, 0xb8e8ff, 0x5ab4ec], 16, 0);
      this.shakeUntil = performance.now() + 140;
    }
  }

  /** An iced yellow took a tap (its coat cracks; the last crack breaks it off), or was just coated (`left` taps). */
  chip(id: number, pos: number, left: number): void {
    const s = this.s;
    const x = this.x(pos);
    const mid = this.mid();
    const prev = this.iceTaps.get(id);
    if (prev === undefined || left >= prev) {
      // coated: frost swirls onto it
      this.iceTaps.set(id, left);
      s.fx.ring(x, mid, 11, 0xbff0ff, false);
      s.fx.chips(x, s.bar.y - 4, 8, [WHITE, 0xbff0ff], 6, -1);
      return;
    }
    const off = left <= 1;
    s.fx.judge(x, off ? 'Ice off!' : 'Crack!', 0xbff0ff, true);
    s.fx.chips(x, mid, 10, [WHITE, 0xbff0ff, 0x8ae0f6], off ? 14 : 8, 0);
    s.fx.ring(x, mid, off ? 16 : 11, 0xbff0ff, false);
    this.cursorPulse(0xbff0ff);
    this.cursorHit(x, 0xbff0ff);
  }

  /** A red froze in place (Flash Freeze, Glacier): a burst of frost on it. */
  iceBlock(pos: number): void {
    const s = this.s;
    const x = this.x(pos);
    const mid = this.mid();
    s.fx.ring(x, mid, 14, 0xbff0ff, false);
    s.fx.stars.push({ x, y: mid, at: s.anim, r: 12, color: 0x9ae8ff, world: false });
    s.fx.chips(x, mid, 10, [WHITE, 0xe0faff, 0x8ae0f6], 10, 0);
  }

  /** A red bounced off the Rampart wall. */
  deflect(pos: number): void {
    const s = this.s;
    this.wallFlashAt = s.anim;
    const x = this.x(pos);
    s.fx.judge(x + 10, 'Bounce!', 0x9ad8ff, true);
    s.fx.chips(this.x(0) + 2, this.mid(), 6, [WHITE, 0x9ad8ff, 0xb8c2d8], 10, 1);
    s.fx.ring(this.x(0) + 2, this.mid(), 14, 0x9ad8ff, false);
    this.shakeUntil = performance.now() + 90;
  }

  /** A blocker took a red at the left end (a Barkback, Brick's rock wall, an afterimage): a slab in its colour. */
  blocker(face: readonly [number, number, number]): void {
    const s = this.s;
    this.blockers.push({ at: s.anim, face });
    const x = this.x(0);
    s.fx.chips(x, this.mid(), 6, [WHITE, face[0], face[1]], 10, 1);
    s.fx.ring(x, this.mid(), 14, face[0], false);
    this.shakeUntil = performance.now() + 90;
  }

  /** A sweep across the whole bar: Glacier's frost wave, or Earthsplitter's crack. */
  sweep(kind: 'frost' | 'crack'): void {
    this.sweeps.push({ kind, at: this.s.anim });
    if (kind === 'crack') this.shakeUntil = performance.now() + 380;
  }

  /** Volley: an arrow drops onto every red on the bar (they're pinned). */
  volley(c: Combat): void {
    let i = 0;
    for (const b of c.blocks) if (isRed(b.kind)) this.arrows.push({ pos: b.pos, at: this.s.anim + i++ * 45, ms: 170 });
  }

  /**
   * Big Bang: the kegs it just put on the bar fly there from (x0, y0), one after another, and only show on the bar
   * when they land. Returns how many.
   */
  kegsFly(c: Combat, x0: number, y0: number, delay: number): number {
    let i = 0;
    for (const b of c.blocks) {
      if (b.kind !== 'keg' || this.blockSeen.has(b.id)) continue;
      const at = this.s.anim + delay + i * 110;
      const ms = 300;
      this.flyKegs.push({ x0, y0, pos: b.pos, at, ms });
      this.blockSeen.set(b.id, at + ms); // it drops in when it lands
      i++;
    }
    return i;
  }

  // ------------------------------------------------------------------ frame

  draw(t: number, now: number): void {
    const s = this.s;
    const g = this.g;
    const gt = this.gTop!;
    g.clear();
    gt.clear();
    this.pool.begin();
    const c = s.app.run.combat;
    const B = s.bar;
    const bx = now < this.shakeUntil ? Math.round(rand(-2, 2)) : 0;
    if (!s.fightHud()) return this.pool.end();
    this.img?.setX(B.x - 9 + bx);
    // the left end is where enemy attacks land: a warm warning glow
    g.fillStyle(0xe0463c, 0.85);
    g.fillRect(B.x + bx, B.y + 1, 2, B.h - 2);
    g.fillStyle(0xff9a80, 0.5);
    g.fillRect(B.x + bx + 2, B.y + 1, 1, B.h - 2);
    if (!c) return this.pool.end();
    if (c.finisherReady && s.app.run.phase === 'fight') {
      // a finisher is banked: the capsule glows in the stacks' color, pulsing faster with more stacks
      const [, hi] = stackCol(c.stacks);
      const k = 0.5 - 0.5 * Math.cos((now / (520 - Math.min(4, c.stacks) * 60)) * Math.PI * 2);
      for (let i = 0; i < 2; i++) {
        g.fillStyle(hi, (0.85 - i * 0.4) * (0.45 + 0.55 * k));
        g.fillRect(B.x - 4 + bx, B.y - 7 - i, B.w + 8, 1);
        g.fillRect(B.x - 4 + bx, B.y + B.h + 6 + i, B.w + 8, 1);
        g.fillRect(B.x - 11 - i + bx, B.y - 1, 1, B.h + 2);
        g.fillRect(B.x + B.w + 11 + i + bx, B.y - 1, 1, B.h + 2);
      }
    }

    this.drawZones(g, c, bx);
    drawLantern(g, c, t, now, s.bar, bx); // the fourth region's lantern: dusk on the track, a glow round the cursor
    this.drawTrails(g, c, t, bx);
    this.drawMarks(g, gt, now, bx);
    const group = c.enemies.length > 1;
    this.drawGhosts(g, c, now, bx);
    // (what can't sink is drawn over the water with the reds: ice floats, a Marksman's target stands on its post)
    const afloat = (b: Block) => !isRed(b.kind) && !c.canSink(b) && (c.waterL > 0 || c.waterR > 0);
    for (const b of c.blocks) if (!isRed(b.kind) && !afloat(b)) this.drawBlock(g, b, c, t, now, group, bx);
    drawBarRules(g, c, t, now, s.bar, bx); // linked pairs' chains, drifting blocks' chevrons
    drawWater(g, c, t, now, s.bar, bx); // the tide: over the still blocks (they lie under it), under the reds
    drawMirages(g, c, t, now, s.bar, bx); // the fifth region's mirages: their shimmer and landing ghosts
    drawHeat(g, c, s.fighters.h.x, s.ground, now); // ...and the hero's Heat
    this.drawGuard(g, c, t, now, bx);
    for (const b of c.blocks) if (isRed(b.kind) || afloat(b)) this.drawBlock(g, b, c, t, now, group, bx);
    this.drawLandTarget(g, c, t, now, bx);

    this.drawDying(g, bx);
    this.drawLeftEnd(g, c, bx, now);
    drawKitBar(g, c, B, bx, (p) => B.x + p * B.w, now); // Gorm's rubble, Tess's stopped clock and rewinds (Part 6)

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 260;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 4, r * 2, B.h + 8);
      if (this.explodeFx.own) {
        // a keg: a ring of soot and sparks blown out of it
        g.fillStyle(0x3a3444, 0.6 * (1 - k));
        g.fillRect(Math.round(this.explodeFx.x - r), B.y - 6, r * 2, 2);
        g.fillRect(Math.round(this.explodeFx.x - r), B.y + B.h + 4, r * 2, 2);
      }
    }
    this.drawSweeps(gt, bx);

    // over the blocks: the dash streak, the cursor (one for every hero), the mirror flashes
    this.drawDashes(gt, c, t, bx);
    this.drawCursor(gt, c, t, now, bx);
    this.drawFlights(gt);

    // swipe hint: an arrow streak sweeping across above the bar while a finisher is banked
    if (c.finisherReady && s.app.settings.finisherInput === 'swipe') {
      const cyc = (now % 1100) / 1100;
      if (cyc < 0.65) {
        const k = ease(cyc / 0.65);
        const [col, hi] = stackCol(c.stacks);
        const hx = Math.round(B.x + 10 + (B.w - 40) * k);
        const hy = B.y - 13;
        const a = cyc < 0.1 ? cyc / 0.1 : cyc > 0.5 ? (0.65 - cyc) / 0.15 : 1;
        for (let i = 0; i < 26; i++) {
          gt.fillStyle(i < 8 ? WHITE : i < 16 ? hi : col, a * (1 - i / 28));
          gt.fillRect(hx - i, hy - (i < 4 ? 1 : 0), 1, i < 4 ? 3 : i < 14 ? 2 : 1);
        }
        gt.fillStyle(INK, a);
        gt.fillRect(hx + 1, hy - 3, 1, 7);
        gt.fillStyle(WHITE, a);
        for (let j = 0; j < 4; j++) {
          gt.fillRect(hx + 1 + j, hy - 3 + j, 2, 1);
          gt.fillRect(hx + 1 + j, hy + 3 - j, 2, 1);
        }
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i];
      const k = (now - bm.at) / 200;
      if (k >= 1) {
        this.beams.splice(i, 1);
        continue;
      }
      const top = Math.round(s.ground - 40 - 30 * k);
      const w = Math.max(1, Math.round(4 * (1 - k)));
      gt.fillStyle(bm.color, 0.9 * (1 - k));
      gt.fillRect(bm.x - Math.floor(w / 2), top, w, B.y - top);
      gt.fillStyle(WHITE, 0.9 * (1 - k));
      gt.fillRect(bm.x, top, 1, B.y - top);
    }
    s.fx.drawRings(gt, now, false);
    s.fx.drawParticles(gt, now, false);
    this.pool.end();
  }

  // ------------------------------------------------------------------ patches, trails, marks

  /** The patches on the track (fading in when new, out when gone); a dash's burst is drawn as its streak instead. */
  private drawZones(g: G, c: Combat, bx: number): void {
    const s = this.s;
    const a = s.anim;
    const B = s.bar;
    for (const z of c.zones) {
      if (z.kind === 'dash') continue;
      let seen = this.zoneSeen.get(z.id);
      if (seen === undefined) this.zoneSeen.set(z.id, (seen = a));
      // (a dash's landing slow-down knows which way the cursor runs through it: it brakes toward the block)
      const look = { id: z.id, kind: z.kind, lo: z.lo, hi: z.hi, slide: z.slide, vel: z.vel, dir: z.kind === 'land' ? c.perk.landDir || 1 : 0 };
      this.zoneLast.set(z.id, look);
      drawPatch(g, look, B, bx, a, clamp01((a - seen) / ZONE_FADE_MS));
    }
    for (let i = this.zoneGone.length - 1; i >= 0; i--) {
      const z = this.zoneGone[i];
      const k = (a - z.at) / ZONE_FADE_MS;
      if (k >= 1) {
        this.zoneGone.splice(i, 1);
        continue;
      }
      if (z.kind !== 'dash') drawPatch(g, { ...z, slide: 0 }, B, bx, a, 1 - k);
    }
  }

  /** A red that leaves ice behind it shows the frost-to-be on the track over the stretch it has crossed. */
  private drawTrails(g: G, c: Combat, t: number, bx: number): void {
    const B = this.s.bar;
    for (const b of c.blocks) {
      if (!b.trail || !isRed(b.kind)) continue;
      const p = c.blockPosAt(b, t);
      const x0 = Math.round(B.x + Math.min(p, b.from) * B.w) + bx;
      const x1 = Math.round(B.x + Math.max(p, b.from) * B.w) + bx;
      for (let x = x0; x < x1; x++) {
        if ((x >> 1) % 2) continue;
        g.fillStyle(0xbff0ff, 0.55);
        g.fillRect(x, B.y + B.h - 3, 1, 2);
        if (x % 9 === 0) {
          g.fillStyle(WHITE, 0.8);
          g.fillRect(x, B.y + 2 + ((x >> 3) % 3) * 2, 1, 1);
        }
      }
    }
  }

  /** Where an icicle will land: a blinking target on the bar and the icicle dropping toward it from above. */
  private drawMarks(g: G, gt: G, now: number, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const c = s.app.run.combat;
    const w = Math.max(6, Math.round((c?.widthFor('red') ?? 0.09) * B.w) - 1);
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      const k = (s.anim - m.at) / m.ms;
      if (k >= 1) {
        this.marks.splice(i, 1);
        continue;
      }
      const x = Math.round(B.x + m.pos * B.w) + bx;
      const blink = Math.floor(now / 100) % 2 === 0;
      // the target: a dashed outline where it will stick, filling as it comes
      const px = x - (w >> 1);
      g.fillStyle(0xbff0ff, 0.18 + 0.3 * k);
      g.fillRect(px, B.y - 5, w, B.h + 10);
      g.fillStyle(blink ? WHITE : 0x8ae0f6, 0.95);
      for (let xx = px; xx < px + w; xx += 2) {
        g.fillRect(xx, B.y - 6, 1, 1);
        g.fillRect(xx, B.y + B.h + 5, 1, 1);
      }
      for (let y = B.y - 6; y < B.y + B.h + 6; y += 2) {
        g.fillRect(px, y, 1, 1);
        g.fillRect(px + w - 1, y, 1, 1);
      }
      // the icicle itself (in Ashfell an ember), falling in with a little streak above it
      const iy = Math.round(B.y - 17 + 10 * ease(k));
      const drop = isAshTheme(s.app.run.theme) && s.textures.exists('ember_mark') ? 'ember_mark' : 'icicle_mark';
      if (s.textures.exists(drop)) this.pool.foot(drop, x, iy, 11.15);
      gt.fillStyle(WHITE, 0.5);
      gt.fillRect(x, iy - 12, 1, 4);
    }
  }

  // ------------------------------------------------------------------ blocks

  private drawBlock(g: G, b: Block, c: Combat, t: number, now: number, group: boolean, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const pos = c.blockPosAt(b, t);
    // Chunky bricks that stick out above and below the track; 1px seam when they touch.
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const x = Math.round(B.x + pos * B.w - w / 2) + bx;
    const h = B.h + 10;
    const y = B.y - 5;
    // a dark block the lantern hasn't reached: a shape that doesn't show what it is
    if (unlit(b)) return drawDarkShape(g, x, y, w, h, now, b.id);
    if ((b.kind === 'purple' || b.kind === 'spore') && b.life < 1 && Math.floor(now / 90) % 2 === 0) return;
    if (b.kind === 'mirror') return this.drawMirror(g, b, c, x + (w >> 1), y, h, now);
    const [base, light, dark] = kindCol(b.kind);
    if (b.push > 0)
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(light, 0.4 / i);
        g.fillRect(x - i * 6, y + 3, w, h - 6);
      }
    const impacting = b.impactTimer >= 0 && !b.still && Math.floor(now / 40) % 2 === 0;
    // fresh blocks drop in from above and land with a little squash (scene time, so it plays before TAP TO BEGIN too)
    let seen = this.blockSeen.get(b.id);
    if (seen === undefined) this.blockSeen.set(b.id, (seen = s.anim));
    if (s.anim < seen) return; // still flying in (Big Bang's kegs)
    const age = (s.anim - seen) / 160;
    const turned = this.turned.get(b.id);
    const fall = age < 0.7 && !turned ? Math.round(-14 * (1 - age / 0.7) ** 2) : 0;
    const squash = age >= 0.7 && age < 1 && !turned ? Math.round(2 * Math.sin(((age - 0.7) / 0.3) * Math.PI)) : 0;
    // (a keg Turnabout flipped a red into widens out of its edge)
    const flipW = turned === 'flip' && s.anim - seen < 130 ? Math.max(1, Math.round(w * ease((s.anim - seen) / 130))) : w;
    const X = x - squash + Math.round((w - flipW) / 2);
    const Y = y + fall + squash;
    const W = flipW + squash * 2;
    const H = h - squash;
    // a Marksman's target (a green that fires the stored Focus): a soft halo behind it
    if (b.target && b.kind === 'green') this.targetHalo(g, c, X, Y, W, H, now, b.id);
    if (b.kind === 'keg' && brewOf(b)) paintBarFlask(g, X, Y, W, H, brewOf(b)!, now); // (Part 6: Fizz's flasks)
    else if (b.kind === 'keg') drawKeg(g, X, Y, W, H, now);
    else if (b.kind === 'frozen') drawFrozen(g, X, Y, W, H, now, b.life, b.id);
    else if (b.kind === 'hold') {
      const held = c.holding?.id === b.id;
      drawHold(g, X, Y, W, H, this.holdEntry(c, b, t), held ? Math.round(B.x + c.cursorPosAt(t) * B.w) + bx : null, held && c.holding!.perfect, now);
    } else brick(g, X, Y, W, H, impacting ? [WHITE, WHITE, light, base] : [light, base, dark, deepOf(b.kind)]);
    if (b.kind === 'yellow' && isGilded(b)) drawGilded(g, X, Y, W, H, now, b.id); // (Solenne's gold: view/dawn-roof.ts)
    if (b.blaze) drawBlaze(g, b, X, Y, W, H, now); // (the fifth region's blazing yellows: view/bar-noon.ts)
    // it just changed kind: a white flash fading off it
    const mk = (s.anim - (this.morphs.get(b.id) ?? -1e9)) / 280;
    if (mk >= 0 && mk < 1) rows(g, X, Y, W, H, 2, WHITE, 0.85 * (1 - mk));
    // in the lantern's light: its top edge catches the light (the fourth region; view/bar-dusk.ts)
    if (!impacting) lanternRim(g, c, t, pos, X, Y, W);
    // a dark block the lantern just reached: its colour floods in behind a warm flash
    if (b.dark) {
      const lk = (c.time - b.litAt) / 0.3;
      if (lk >= 0 && lk < 1) rows(g, X, Y, W, H, 2, 0xffe6a8, 0.85 * (1 - lk));
    }
    // a block just come up out of the water glistens: drips running off it, a glint on its top
    const sk = (c.time - b.surfacedAt) / 0.6;
    if (sk >= 0 && sk < 1) glisten(g, X, Y, W, H, sk);
    // Oil Can ready (Sprocket): every block's Perfect zone shows, wider, in gold, until the next hit
    if (c.perk.oil === 1 && !b.still && (isRed(b.kind) || (isAttack(b.kind) && b.kind !== 'hold'))) this.drawOil(g, c, b, X, Y, W, H, now);
    if (b.kind === 'shield') {
      g.fillStyle(0xdfe6f2, 1);
      g.fillRect(X + 1, Y + 2, 2, H - 5);
      g.fillRect(X + W - 3, Y + 2, 2, H - 5);
      if (b.taps <= 1) {
        g.fillStyle(INK, 1);
        g.fillRect(X + 5, Y + 3, 1, 5);
        g.fillRect(X + 6, Y + 8, 1, 4);
        g.fillRect(X + 5, Y + 12, 1, 4);
      }
    }
    const cx = Math.round(X + W / 2 - 3.5);
    const cy = Math.round(Y + H / 2 - 3.5);
    if (isRed(b.kind)) {
      const variant = b.kind === 'red' ? null : ICONS[b.kind];
      const owner = c.enemyById(b.ownerId);
      const ownerIcon = group && owner ? (FOE_ICONS[s.app.tuning.enemies[owner.key].icon] ?? null) : null;
      if (b.grow > 0) drawGrow(g, X, Y, W, H, b.width < b.baseWidth * 2 - 1e-3, b.id);
      if (variant && !b.still) {
        icon(g, variant, cx, ownerIcon ? Y + 12 : cy, b.kind === 'speed' ? 0xffe680 : INK);
        if (ownerIcon) icon(g, ownerIcon, cx, Y + 3, WHITE);
      } else if (ownerIcon && !b.still) icon(g, ownerIcon, cx, cy, WHITE);
      // (block marks: a plain red is told from a yellow by a mark, not by its colour alone; engine/a11y.ts)
      else if (A11Y.marks && !b.still) {
        const m = W >= 7 ? RED_MARK : RED_MARK_THIN;
        icon(g, m, Math.round(X + W / 2 - m[0].length / 2), Math.round(Y + H / 2 - m.length / 2), INK);
      }
      if (b.chill > 0) {
        // (frozen solid: how much of its freeze is left, so it cracks as it thaws)
        let c0 = this.chill0.get(b.id) ?? 0;
        if (b.chill > c0) this.chill0.set(b.id, (c0 = b.chill));
        if (!drawKitChill(g, c, b, X, Y, W, H, now, b.chill / Math.max(0.1, c0))) drawChill(g, X, Y, W, H, this.chillStyle(c, b), now, b.chill / Math.max(0.1, c0), b.chill, b.id);
      } else this.chill0.delete(b.id);
      if (b.still) {
        // an icicle (or an ice wall): it strikes when its fuse runs out
        let f0 = this.fuse0.get(b.id);
        if (f0 === undefined) this.fuse0.set(b.id, (f0 = Math.max(0.1, b.impactTimer)));
        drawFuse(g, X, Y, W, H, b.impactTimer / f0, now, b.kind === 'red');
        if (b.taps > 1) this.tapPips(g, X, Y, W, b.taps);
      }
    } else if (b.kind === 'spore' || b.kind === 'ward') {
      // a spore to pop before it heals the enemies; a shell piece to break
      icon(g, BLOCK_ICONS[b.kind], cx, cy, WHITE);
      if (b.kind === 'spore' && Math.floor(now / 200) % 2 === 0) {
        g.fillStyle(0xffd0f0, 0.6);
        g.fillRect(X + 1, Y - 2 - (Math.floor(now / 100) % 3), 1, 1);
        g.fillRect(X + W - 2, Y - 1 - (Math.floor(now / 130) % 3), 1, 1);
      }
    } else if (b.kind === 'purple' || b.kind === 'green') {
      // white symbol with a dark rim: "+" heals, "!" is a trap
      const mx = Math.round(X + W / 2);
      const my = Math.round(Y + H / 2);
      const parts: Array<[number, number, number, number]> =
        b.kind === 'green'
          ? [
              [mx - 1, my - 4, 2, 8],
              [mx - 4, my - 1, 8, 2],
            ]
          : [
              [mx - 1, my - 5, 2, 6],
              [mx - 1, my + 3, 2, 2],
            ];
      g.fillStyle(deepOf(b.kind), 1);
      for (const [x0, y0, w0, h0] of parts) g.fillRect(x0 - 1, y0 - 1, w0 + 2, h0 + 2);
      g.fillStyle(WHITE, 1);
      for (const [x0, y0, w0, h0] of parts) g.fillRect(x0, y0, w0, h0);
    }
    if (b.target && b.kind === 'green') this.targetMarks(g, c, X, Y, W, H, now, b.id);
    // an iced yellow (or green): its coat, its cracks, a pip per tap still needed
    if (isAttack(b.kind) && b.kind !== 'hold' && b.taps > 1) {
      const most = Math.max(this.iceTaps.get(b.id) ?? b.taps, b.taps);
      this.iceTaps.set(b.id, most);
      drawIceCoat(g, X, Y, W, H, b.taps, most - b.taps, now);
    }
  }

  /**
   * A block's Perfect zone while Oil Can makes it wider: ink lines at its edges with a white sheen between them (they
   * read on any block's colour), gold brackets sticking out above and below the block, a glint running down it.
   */
  private drawOil(g: G, c: Combat, b: Block, X: number, Y: number, W: number, H: number, now: number): void {
    const frac = c.mod(this.s.app.tuning.judge.perfectFrac, (h, v) => h.perfectFrac?.(c, b, v));
    const zw = Math.max(3, Math.min(W - 2, Math.round(frac * b.width * this.s.bar.w)));
    const zx = Math.round(X + W / 2 - zw / 2);
    const p = pulse(now, 420);
    g.fillStyle(WHITE, 0.22 + 0.16 * p);
    g.fillRect(zx + 1, Y + 2, zw - 2, H - 4);
    g.fillStyle(INK, 0.85);
    g.fillRect(zx, Y + 2, 1, H - 4);
    g.fillRect(zx + zw - 1, Y + 2, 1, H - 4);
    // the brackets: over the block's top and under its bottom, in gold with an ink rim
    for (const [by, dir] of [
      [Y - 3, 1],
      [Y + H + 1, -1],
    ] as const) {
      g.fillStyle(INK, 1);
      g.fillRect(zx - 1, by - 1, zw + 2, 4);
      g.fillStyle(OIL[1], 1);
      g.fillRect(zx, by + (dir > 0 ? 0 : 1), zw, 1);
      g.fillRect(zx, by, 1, 2);
      g.fillRect(zx + zw - 1, by, 1, 2);
      g.fillStyle(OIL[0], 0.6 + 0.4 * p);
      g.fillRect(zx + 1, by + (dir > 0 ? 0 : 1), Math.max(1, zw - 2), 1);
    }
    if (zw > 2) {
      g.fillStyle(WHITE, 0.8);
      g.fillRect(zx + 1, Y + 2 + (Math.floor(now / 45) % (H - 4)), zw - 2, 1);
    }
  }

  /** A Marksman's target: a soft halo behind the green (gold and quicker when the Focus is full: it will crit). */
  private targetHalo(g: G, c: Combat, X: number, Y: number, W: number, H: number, now: number, id: number): void {
    const full = focusCap(c) > 0 && focusOf(c) >= focusCap(c) * 0.999;
    const p = pulse(now, full ? 360 : 760, id * 97);
    rows(g, X - 3, Y - 3, W + 6, H + 6, 3, full ? 0xffd23a : 0x9af06a, (full ? 0.35 : 0.22) + 0.2 * p);
  }

  /**
   * A Marksman's target, over the green: a bullseye ring round its "+", and corner brackets just outside it that breathe
   * in and out (gold when the Focus is full: the shot will crit), so it stands out on a flooded bar.
   */
  private targetMarks(g: G, c: Combat, X: number, Y: number, W: number, H: number, now: number, id: number): void {
    const full = focusCap(c) > 0 && focusOf(c) >= focusCap(c) * 0.999;
    const p = pulse(now, full ? 360 : 760, id * 97);
    const col = full ? 0xffe680 : 0xd8ffc0;
    const mx = Math.round(X + W / 2);
    const my = Math.round(Y + H / 2);
    // the bullseye: a ring round the "+" (ink under, then its colour)
    const r = Math.max(4, Math.min(6, Math.floor(W / 2) - 1));
    const n = Math.max(20, r * 7);
    for (const [col2, rr, a] of [
      [INK, r + 1, 0.8],
      [col, r, 1],
    ] as const) {
      g.fillStyle(col2, a);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        g.fillRect(Math.round(mx + Math.cos(t) * rr), Math.round(my + Math.sin(t) * rr), 1, 1);
      }
    }
    // brackets at its corners, breathing out
    const out = 2 + Math.round(p * 2);
    const arm = 3;
    for (const [cx, cy, sx, sy] of [
      [X - out, Y - out, 1, 1],
      [X + W - 1 + out, Y - out, -1, 1],
      [X - out, Y + H - 1 + out, 1, -1],
      [X + W - 1 + out, Y + H - 1 + out, -1, -1],
    ] as const) {
      g.fillStyle(INK, 0.9);
      g.fillRect(Math.min(cx, cx + sx * arm) - 1, cy - 1, arm + 3, 3);
      g.fillRect(cx - 1, Math.min(cy, cy + sy * arm) - 1, 3, arm + 3);
      g.fillStyle(full ? mix(col, WHITE, p * 0.5) : col, 1);
      g.fillRect(Math.min(cx, cx + sx * arm), cy, arm + 1, 1);
      g.fillRect(cx, Math.min(cy, cy + sy * arm), 1, arm + 1);
    }
    if (full && Math.floor(now / 200) % 3 === 0) sparkle(g, X + W - 1, Y + 1, 2);
  }

  /** Small pips over a block: one per tap it still needs. */
  private tapPips(g: G, X: number, Y: number, W: number, taps: number): void {
    const pw = taps * 3 - 1;
    const px = Math.round(X + W / 2 - pw / 2);
    for (let i = 0; i < taps; i++) {
      g.fillStyle(INK, 1);
      g.fillRect(px + i * 3 - 1, Y - 5, 4, 4);
      g.fillStyle(0xe0faff, 1);
      g.fillRect(px + i * 3, Y - 4, 2, 2);
    }
  }

  /** How a chilled red looks: Moss's vines, a Volley's arrow (pinned), Neve's Glacier (frozen solid in a block of
   *  ice), else frost (icier when pinned). */
  private chillStyle(c: Combat, b: Block): 'frost' | 'pin' | 'vine' | 'arrow' | 'solid' {
    if (c.heroId === 'moss' && b.chillMult > 0) return 'vine';
    if (b.chillMult <= 0) return c.heroId === 'vesper' ? 'arrow' : c.heroId === 'neve' ? 'solid' : 'pin';
    return 'frost';
  }

  /** The side a hold will be entered from: the way it's being held, else the way the cursor will next come to it. */
  private holdEntry(c: Combat, b: Block, t: number): number {
    if (c.holding?.id === b.id) return c.holding.dir;
    const dir = c.cursorDirAt(t);
    const p = c.cursorPosAt(t);
    const lo = b.pos - b.width / 2;
    const hi = b.pos + b.width / 2;
    if (dir > 0) return p < lo + 0.004 ? 1 : -1;
    return p > hi - 0.004 ? -1 : 1;
  }

  /** A mirror shard standing on the bar: a pale glow behind it, the shard (blinking out at the end of its time). */
  private drawMirror(g: G, b: Block, c: Combat, x: number, y: number, h: number, now: number): void {
    const s = this.s;
    const fading = b.life < 1 && Math.floor(now / 90) % 2 === 0;
    // a pane of mirror-light behind it: silvery lavender glass with bright edges, slanted glare and a glint climbing
    // it, and arrows either side (the cursor turns back here)
    g.fillStyle(INK, 0.8);
    g.fillRect(x - 5, y - 1, 11, h + 2);
    g.fillStyle(0x8a9ad8, 0.85);
    g.fillRect(x - 4, y, 9, h);
    g.fillStyle(0xc8d4ff, 0.9);
    g.fillRect(x - 4, y, 9, Math.round(h * 0.45));
    g.fillStyle(WHITE, 0.55);
    for (let i = 0; i < h; i++) {
      const gx = x - 4 + ((i + 9) % 12);
      if (gx <= x + 4) g.fillRect(gx, y + i, 1, 1);
    }
    g.fillStyle(0xeef3ff, 1);
    g.fillRect(x - 4, y, 1, h);
    g.fillRect(x - 4, y, 9, 1);
    const gy = y + h - 2 - Math.floor((now / 40) % h);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(x - 3, gy, 7, 1);
    if (Math.floor(now / 300) % 4 === 0) sparkle(g, x + 3, y + 2, 1);
    const my = y + Math.round(h / 2);
    for (const d of [-1, 1]) {
      const ax = x + d * 7;
      g.fillStyle(INK, 0.8);
      g.fillRect(ax - (d < 0 ? 1 : 0), my - 2, 2, 5);
      g.fillStyle(WHITE, 0.95);
      g.fillRect(ax, my - 1, 1, 3);
      g.fillRect(ax + d, my, 1, 1);
    }
    let flash = 0;
    for (const f of this.mirrorFlashes) if (Math.abs(f.pos - b.pos) < 0.01) flash = Math.max(flash, 1 - (s.anim - f.at) / 220);
    if (flash > 0) {
      g.fillStyle(WHITE, 0.85 * flash);
      g.fillRect(x - 5, y - 3, 11, h + 6);
    }
    if (!fading) {
      // a sliver of mirror (in Ashfell a pane of coloured glass)
      const pane = isAshTheme(s.app.run.theme) && s.textures.exists('glass_pane') ? 'glass_pane' : 'mirror_shard';
      if (s.textures.exists(pane)) this.pool.foot(pane, x, y + h - 1, 11.15);
      else slab(g, x, y + 2, 5, h - 4, 0xc8d8f0, WHITE, 0x7a8ab0);
    }
    void c;
  }

  // ------------------------------------------------------------------ the left end, sweeps, dashes, flights

  /** Rampart's wall, the blockers that just took a red, and Overgrowth's vines along the bar. */
  private drawLeftEnd(g: G, c: Combat, bx: number, now: number): void {
    const s = this.s;
    const B = s.bar;
    if (c.perk.vines > 0) drawVines(g, B, bx, c.perk.vines, now);
    if (c.perk.rampart > 0) drawWall(g, B, bx, c.perk.rampart, s.app.tuning.kits.hollis.rampartSec, clamp01(1 - (s.anim - this.wallFlashAt) / 200), now);
    else this.drawReady(g, c, bx, now);
    for (let i = this.blockers.length - 1; i >= 0; i--) {
      const k = (s.anim - this.blockers[i].at) / 420;
      if (k >= 1) this.blockers.splice(i, 1);
      else drawBlocker(g, B, bx, k, this.blockers[i].face);
    }
    for (let i = this.mirrorFlashes.length - 1; i >= 0; i--) if (s.anim - this.mirrorFlashes[i].at > 240) this.mirrorFlashes.splice(i, 1);
  }

  /**
   * Blockers standing ready at the left end, where reds land, so the player sees them coming without a sound: Brick's
   * Rock Wall charged, a braced Barkback, Sable's afterimage. A slim slab each in the colours of the slab that pops up
   * when it takes the red (BLOCKER_FACE), rising out of the frame as it readies, then breathing with a glint running
   * down it.
   */
  private drawReady(g: G, c: Combat, bx: number, now: number): void {
    const s = this.s;
    const B = s.bar;
    // (in the order they'd take a red: the style's ally, the kit's afterimage, then the companion; the first nearest)
    const ready: string[] = [];
    if (c.allies.some((a) => a.kind === 'barkback' && a.braced)) ready.push('barkback');
    if (c.allies.some((a) => a.kind === 'spiritTortoise' && a.braced)) ready.push('spiritTortoise'); // (Yara's, Part 6)
    if (c.perk.afterimage) ready.push('afterimage');
    if ((c.perk.slip ?? 0) > 0 && c.heroId === 'wren') ready.push('slip'); // (Wren's ready dodge)
    if (c.perk.rockReady) ready.push('rockWall');
    for (const id of [...this.readyAt.keys()]) if (!ready.includes(id)) this.readyAt.delete(id);
    ready.forEach((id, i) => {
      let at = this.readyAt.get(id);
      if (at === undefined) this.readyAt.set(id, (at = s.anim));
      const k = clamp01((s.anim - at) / 180);
      const face = BLOCKER_FACE[id];
      // (as tall as a block, standing on the frame's cap)
      const H = B.h + 10;
      const h = Math.max(2, Math.round(H * ease(k)));
      const x = B.x - 6 - i * 7 + bx;
      const y = B.y + B.h + 5 - h;
      // a soft halo in its colour, breathing
      const p = pulse(now, 640, i * 200);
      g.fillStyle(face[0], (0.22 + 0.3 * p) * k);
      g.fillRect(x - 2, y - 2, 9, h + 4);
      g.fillStyle(INK, 1);
      g.fillRect(x - 1, y - 1, 7, h + 2);
      g.fillStyle(face[1], 1);
      g.fillRect(x, y, 5, h);
      g.fillStyle(face[0], 1);
      g.fillRect(x, y, 5, 2);
      g.fillRect(x, y, 1, h);
      g.fillStyle(face[2], 1);
      g.fillRect(x + 4, y + 2, 1, h - 2);
      if (k >= 1) {
        // a glint running down it, and its top lit as it breathes
        const gy = y + 2 + (Math.floor(now / 70 + i * 5) % (h + 8));
        if (gy < y + h - 1) {
          g.fillStyle(WHITE, 0.8);
          g.fillRect(x + 1, gy, 3, 1);
        }
        g.fillStyle(WHITE, 0.35 + 0.5 * p);
        g.fillRect(x + 1, y, 3, 1);
      } else {
        g.fillStyle(WHITE, 0.8 * (1 - k));
        g.fillRect(x - 1, y - 1, 7, h + 2);
      }
    });
  }

  /** Glacier's frost wave (a bright band sweeping across, leaving glints) and Earthsplitter's crack across the track. */
  private drawSweeps(g: G, bx: number): void {
    const s = this.s;
    const B = s.bar;
    for (let i = this.sweeps.length - 1; i >= 0; i--) {
      const sw = this.sweeps[i];
      const k = (s.anim - sw.at) / (sw.kind === 'frost' ? 420 : 900);
      if (k >= 1) {
        this.sweeps.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      if (sw.kind === 'frost') {
        const hx = Math.round(B.x + B.w * ease(k)) + bx;
        for (let j = 0; j < 18; j++) {
          g.fillStyle(j < 3 ? WHITE : 0x9ae8ff, (1 - j / 18) * 0.8);
          g.fillRect(hx - j * 3, B.y - 7, 3, B.h + 14);
        }
        g.fillStyle(WHITE, 1);
        for (let j = 0; j < 5; j++) sparkle(g, hx - 6 - j * 13, B.y - 3 + ((j * 7) % (B.h + 6)), j % 2 ? 1 : 2);
      } else {
        // a jagged crack across the track, white-hot at first, then dark, fading
        const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const col = k < 0.15 ? WHITE : 0x2a1810;
        let y = B.y + B.h / 2;
        for (let x = 0; x < B.w; x += 2) {
          y = B.y + B.h / 2 + Math.round(3 * Math.sin(x * 0.37) + 2 * Math.sin(x * 0.11));
          g.fillStyle(col, a);
          g.fillRect(B.x + x + bx, y, 2, 1);
          if (x % 23 === 0) g.fillRect(B.x + x + bx, y - 2, 1, 2);
        }
        if (k < 0.3) {
          g.fillStyle(0xffd890, 0.5 * (1 - k / 0.3));
          g.fillRect(B.x + bx, B.y - 6, B.w, B.h + 12);
        }
      }
    }
  }

  /**
   * Shadow Dash: a bright violet streak along the cursor's path, from where it dashed to where it is (its white-hot
   * core brightest at the head); three afterimages of the cursor left behind along the way (each fading from when the
   * cursor passed it); a burst where it lands, then the streak's tail runs in to the landing and it fades.
   */
  private drawDashes(g: G, c: Combat, t: number, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const a = s.anim;
    const cpos = c.cursorPosAt(t);
    const my = Math.round(B.y + B.h / 2);
    for (let i = this.dashes.length - 1; i >= 0; i--) {
      const d = this.dashes[i];
      const dir = d.to >= d.from ? 1 : -1;
      const span = Math.abs(d.to - d.from);
      // the head follows the cursor through its burst; it lands at the far end
      const into = (cpos - d.from) * dir;
      if (!d.landAt && (into >= span - 0.002 || a - d.at > 700)) {
        d.landAt = a;
        this.dashLanded(d.to, dir);
      }
      const since = d.landAt ? a - d.landAt : 0;
      if (since > DASH_FADE_MS) {
        this.dashes.splice(i, 1);
        continue;
      }
      const head = d.landAt ? d.to : d.from + dir * Math.max(0, Math.min(span, into));
      const tail = d.from + (head - d.from) * (d.landAt ? ease(clamp01(since / DASH_FADE_MS)) : 0);
      const fade = d.landAt ? 1 - since / DASH_FADE_MS : 1;
      const xt = Math.round(B.x + tail * B.w) + bx;
      const xh = Math.round(B.x + head * B.w) + bx;
      const lo = Math.min(xt, xh);
      const hi = Math.max(xt, xh);
      for (let x = lo; x <= hi; x++) {
        // brighter toward the head
        const q = Math.abs(x - xt) / Math.max(1, hi - lo);
        const qq = (0.3 + 0.7 * q) * fade;
        g.fillStyle(DASH_COL[3], 0.55 * qq);
        g.fillRect(x, my - 5, 1, 11);
        g.fillStyle(DASH_COL[2], 0.85 * qq);
        g.fillRect(x, my - 3, 1, 7);
        g.fillStyle(DASH_COL[0], qq);
        g.fillRect(x, my - 2, 1, 5);
        g.fillStyle(WHITE, q * q * fade);
        g.fillRect(x, my - 1, 1, 3);
      }
      // speed lines over and under the blocks, dashed, running the way it went
      if (hi - lo > 6) {
        const off = Math.floor(a / 30) % 6;
        g.fillStyle(DASH_COL[0], 0.85 * fade);
        for (let x = lo + 2; x < hi - 2; x++) {
          if (((x - off * dir) % 6 + 6) % 6 < 4) g.fillRect(x, B.y - 9, 1, 1);
          if (((x + 3 - off * dir) % 6 + 6) % 6 < 4) g.fillRect(x, B.y + B.h + 8, 1, 1);
        }
      }
      // the afterimages: where it was, and a third and two thirds of the way; each is left as the cursor passes it
      for (let j = 0; j < 3; j++) {
        const p = d.from + (d.to - d.from) * (j / 3);
        if ((head - p) * dir < -1e-4) continue;
        d.ghosts[j] ??= a;
        const age = (a - d.ghosts[j]) / 420;
        if (age < 1) cursorGhost(g, B.x + p * B.w + bx, B, (1 - age) * (0.55 + 0.15 * j), DASH_COL);
      }
    }
    // the landing: a white flash where it lands, narrowing, with sparks skidding on along the frame
    for (let i = this.dashLands.length - 1; i >= 0; i--) {
      const l = this.dashLands[i];
      const k = (a - l.at) / 220;
      if (k >= 1) {
        this.dashLands.splice(i, 1);
        continue;
      }
      const x = Math.round(B.x + l.pos * B.w) + bx;
      const w = Math.max(1, Math.round(5 * (1 - k)));
      g.fillStyle(DASH_COL[1], 0.7 * (1 - k));
      g.fillRect(x - w - 2, B.y - 10, w * 2 + 5, B.h + 20);
      g.fillStyle(WHITE, 0.9 * (1 - k));
      g.fillRect(x - w, B.y - 8, w * 2 + 1, B.h + 16);
      const run = Math.round(4 + 10 * ease(k));
      g.fillStyle(DASH_COL[0], 1 - k);
      for (const y of [B.y - 9, B.y + B.h + 8]) g.fillRect(l.dir > 0 ? x + 3 : x - 3 - run, y, run, 1);
    }
  }

  /**
   * Sable's landing: while the cursor brakes in a 'land' patch, the block the dash aimed at (it starts where the patch
   * ends) is lit: violet brackets round it, pulsing, so it's the one to tap.
   */
  private drawLandTarget(g: G, c: Combat, t: number, now: number, bx: number): void {
    const z = c.zones.find((x) => x.kind === 'land');
    if (!z) return;
    const B = this.s.bar;
    const dir = c.perk.landDir || 1;
    const end = dir > 0 ? z.hi : z.lo;
    let best: Block | null = null;
    let bestD = 0.02;
    for (const b of c.blocks) {
      const near = c.blockPosAt(b, t) - (dir * b.width) / 2;
      const d = Math.abs(near - end);
      if (d < bestD) (best = b), (bestD = d);
    }
    if (!best) return;
    const w = Math.max(6, Math.round(best.width * B.w) - 1);
    const x = Math.round(B.x + c.blockPosAt(best, t) * B.w - w / 2) + bx;
    const out = 2 + Math.round(pulse(now, 220));
    const x0 = x - out - 1;
    const x1 = x + w + out;
    const y0 = B.y - 6 - out;
    const y1 = B.y + B.h + 5 + out;
    const arm = 3;
    for (const [cx, cy, sx, sy] of [
      [x0, y0, 1, 1],
      [x1, y0, -1, 1],
      [x0, y1, 1, -1],
      [x1, y1, -1, -1],
    ] as const) {
      g.fillStyle(INK, 0.9);
      g.fillRect(Math.min(cx, cx + sx * arm) - 1, cy - 1, arm + 3, 3);
      g.fillRect(cx - 1, Math.min(cy, cy + sy * arm) - 1, 3, arm + 3);
      g.fillStyle(DASH_COL[0], 1);
      g.fillRect(Math.min(cx, cx + sx * arm), cy, arm + 1, 1);
      g.fillRect(cx, Math.min(cy, cy + sy * arm), 1, arm + 1);
    }
  }

  /** Big Bang's kegs arcing onto the bar, and Volley's arrows dropping onto the reds. */
  private drawFlights(g: G): void {
    const s = this.s;
    const B = s.bar;
    for (let i = this.flyKegs.length - 1; i >= 0; i--) {
      const f = this.flyKegs[i];
      const k = (s.anim - f.at) / f.ms;
      if (k >= 1) {
        this.flyKegs.splice(i, 1);
        s.fx.chips(this.x(f.pos), B.y - 4, 8, [0xffb060, 0x3a3444, WHITE], 6, -1);
        continue;
      }
      if (k < 0) continue;
      const tx = this.x(f.pos);
      const ty = B.y - 5;
      const x = f.x0 + (tx - f.x0) * k;
      const y = f.y0 + (ty - f.y0) * k - Math.sin(k * Math.PI) * 34;
      drawKeg(g, Math.round(x - 7), Math.round(y), 14, 20, s.anim);
    }
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const ar = this.arrows[i];
      const k = (s.anim - ar.at) / ar.ms;
      if (k >= 1) {
        this.arrows.splice(i, 1);
        s.fx.chips(this.x(ar.pos), B.y - 5, 6, [WHITE, 0xd8dce8], 5, -1);
        continue;
      }
      if (k < 0) continue;
      const x = Math.round(this.x(ar.pos)) + 2;
      const y = Math.round(B.y - 60 + 52 * k);
      g.fillStyle(INK, 1);
      g.fillRect(x - 1, y - 12, 3, 14);
      g.fillStyle(0xd8dce8, 1);
      g.fillRect(x, y - 11, 1, 12);
      g.fillStyle(WHITE, 1);
      g.fillRect(x - 1, y - 11, 1, 3);
      g.fillRect(x + 1, y - 11, 1, 3);
      g.fillStyle(0xdab0ff, 0.5);
      g.fillRect(x, y - 24, 1, 10);
    }
  }

  /**
   * The cursor: a glowing blade with silver caps (a trail at speed, a pulse on hits), orange-hot at top speed, icy when
   * a Stomp froze it. On ice it leaves a cyan speed streak; through a dash, a violet one; in a snowdrift or a slow
   * patch it drags: frosted, a little snow piling up in front of it, flakes falling off.
   */
  private drawCursor(g: G, c: Combat, t: number, now: number, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const speed = c.speedMult();
    const hot = speed >= s.app.tuning.cursor.maxSpeedMult - 0.01 || c.minSpeed > 0;
    const frozen = c.freeze > 0;
    const p = c.cursorPosAt(t);
    let onIce = false;
    let inSnow = false;
    let inDash = false;
    let inLand = false;
    for (const z of c.zones) {
      if (p < z.lo || p > z.hi) continue;
      const kind = z.kind;
      if (kind === 'ice') onIce = true;
      else if (kind === 'dash') inDash = true;
      else if (kind === 'land') inLand = true;
      else inSnow = true;
    }
    const moving = c.cursorHold <= 0 && !frozen;
    const blade = frozen ? 0xbfe8ff : hot ? 0xff8a2a : inSnow ? 0x8ab8e0 : LOOK.blade;
    const core = frozen ? WHITE : hot ? 0xffd080 : inSnow ? 0xe8f4ff : LOOK.core;
    if (speed > 1.2) {
      for (let i = 1; i <= 3; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.01) * B.w) + bx;
        g.fillStyle(core, 0.35 / i);
        g.fillRect(px - 1, B.y, 3, B.h);
      }
    }
    const cx = Math.round(B.x + p * B.w) + bx;
    if (moving && (onIce || inDash)) {
      // a speed streak: copies trailing behind, and speed lines over and under the track
      const col = inDash ? 0xdab0ff : 0xc8f4ff;
      for (let i = 1; i <= 6; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.009) * B.w) + bx;
        g.fillStyle(col, 0.5 / i);
        g.fillRect(px - 1, B.y - 2, 3, B.h + 4);
      }
      const back = Math.round(B.x + c.cursorPosAt(t - 0.06) * B.w) + bx;
      g.fillStyle(WHITE, 0.6);
      g.fillRect(Math.min(back, cx), B.y - 3, Math.abs(cx - back), 1);
      g.fillRect(Math.min(back, cx), B.y + B.h + 2, Math.abs(cx - back), 1);
    }
    if (moving && inSnow) {
      // dragging: a smear lagging behind, snow piling up in front, flakes falling off
      const lag = Math.round(B.x + c.cursorPosAt(t - 0.035) * B.w) + bx;
      g.fillStyle(0xe8f4ff, 0.3);
      g.fillRect(Math.min(lag, cx) - 2, B.y, Math.abs(cx - lag) + 5, B.h);
      const dir = c.cursorDirAt(t);
      g.fillStyle(WHITE, 0.95);
      g.fillRect(cx + dir * 3 - 1, B.y + B.h - 3, 3, 2);
      g.fillRect(cx + dir * 4, B.y + B.h - 4, 1, 1);
      if (Math.random() < 0.3) s.fx.particles.push({ x: cx + rand(-2, 2), y: B.y + rand(0, 4), vx: rand(-6, 6), vy: rand(8, 20), g: 30, born: now, life: 380, color: WHITE, size: 1, world: false, streak: false });
    }
    if (inLand) {
      // braking after a dash: a violet glow round the blade, a short smear pressed up behind it
      const back = Math.round(B.x + c.cursorPosAt(t - 0.05) * B.w) + bx;
      g.fillStyle(DASH_COL[2], 0.35);
      g.fillRect(Math.min(back, cx) - 1, B.y - 2, Math.abs(cx - back) + 3, B.h + 4);
      g.fillStyle(DASH_COL[0], 0.3 + 0.2 * pulse(now, 160));
      g.fillRect(cx - 4, B.y - 6, 9, B.h + 12);
    }
    const pk = (now - this.cursorPulseAt) / 160;
    if (pk < 1) {
      const pw = Math.round(2 + 6 * (1 - pk));
      g.fillStyle(this.cursorPulseColor, 0.6 * (1 - pk));
      g.fillRect(cx - pw, B.y - 3, pw * 2 + 1, B.h + 6);
    }
    if (frozen) {
      // frozen by a Stomp: an icy halo and frost flakes
      g.fillStyle(0xbfe8ff, 0.35);
      g.fillRect(cx - 4, B.y - 4, 9, B.h + 8);
      if (Math.random() < 0.5) s.fx.particles.push({ x: cx + rand(-4, 4), y: B.y + rand(0, B.h), vx: rand(-10, 10), vy: rand(-14, -4), g: 0, born: now, life: 300, color: WHITE, size: 1, world: false, streak: false });
    }
    // holding a hold: a glow round the blade
    if (c.holding) {
      g.fillStyle(c.holding.perfect ? 0xffe680 : 0x9ad8ff, 0.35 + 0.15 * Math.sin(now / 60));
      g.fillRect(cx - 4, B.y - 8, 9, B.h + 16);
    }
    // a green ability's window running (Battle Focus, Smoke Veil, Chill, Brace): a green sheen round the blade,
    // blinking out over its last moments
    const abil = c.hero.abilityTimer;
    if (abil > 0 && TIMED_ABILITY.has(c.heroId) && !(abil < 0.6 && Math.floor(now / 90) % 2 === 0)) {
      g.fillStyle(0x9af0a0, 0.26 + 0.14 * pulse(now, 520));
      g.fillRect(cx - 4, B.y - 6, 9, B.h + 12);
      g.fillStyle(0xc8ffd0, 0.6);
      g.fillRect(cx - 3, B.y - 3, 1, B.h + 6);
      g.fillRect(cx + 3, B.y - 3, 1, B.h + 6);
    }
    // Wind-Up primed (Torva): the next yellow hit is the smash, so the blade burns, embers rising off its top
    const windUp = c.perk.windUp === 1 && c.heroId === 'torva';
    if (windUp) {
      const k = pulse(now, 300);
      rows(g, cx - 7, B.y - 10, 15, B.h + 20, 3, WINDUP[1], 0.22 + 0.18 * k);
      rows(g, cx - 5, B.y - 8, 11, B.h + 16, 2, WINDUP[1], 0.35 + 0.3 * k);
      g.fillStyle(WINDUP[0], 0.7 + 0.3 * k);
      g.fillRect(cx - 3, B.y - 5, 1, B.h + 10);
      g.fillRect(cx + 3, B.y - 5, 1, B.h + 10);
      for (let i = 0; i < 4; i++) {
        const q = ((now / 9 + i * 29) % 40) / 40;
        g.fillStyle(i % 2 ? WINDUP[0] : WINDUP[1], 1 - q * q);
        g.fillRect(cx - 3 + i * 2, Math.round(B.y - 11 - q * 12), i % 2 ? 1 : 2, 2);
      }
    }
    // a glowing blade: ink capsule, lit left edge, white-hot core, deep right edge
    const top = B.y - 7;
    const len = B.h + 14;
    rows(g, cx - 2, top, 5, len, 1, INK);
    g.fillStyle(blade, 1);
    g.fillRect(cx - 1, top + 1, 3, len - 2);
    g.fillStyle(core, 1);
    g.fillRect(cx - 1, top + 2, 1, len - 4);
    g.fillStyle(WHITE, 1);
    g.fillRect(cx, top + 3, 1, len - 6);
    g.fillStyle(hot ? 0xa0400a : LOOK.deep, 1);
    g.fillRect(cx + 1, top + 2, 1, len - 4);
    // sparkle caps: 4-point stars with an ink rim (frosted in a snowdrift, red-hot while Wind-Up is primed)
    const cap = windUp ? WINDUP[1] : inSnow ? 0xe0f0ff : 0xb8c2d8;
    for (const sy of [top - 1, top + len]) {
      g.fillStyle(INK, 1);
      g.fillRect(cx - 4, sy - 1, 9, 3);
      g.fillRect(cx - 1, sy - 4, 3, 9);
      g.fillRect(cx - 2, sy - 2, 5, 5);
      g.fillStyle(cap, 1);
      g.fillRect(cx - 3, sy, 7, 1);
      g.fillRect(cx, sy - 3, 1, 7);
      g.fillRect(cx - 1, sy - 1, 3, 3);
      g.fillStyle(WHITE, 1);
      g.fillRect(cx - 2, sy, 4, 1);
      g.fillRect(cx, sy - 2, 1, 4);
    }
  }

  /**
   * While a special winds up, show what it will do to the bar: where its reds will land (blinking outlines; an
   * icicle's spot is marked once it's chosen), the patches it lays (a dashed outline in the patch's colour), a mirror
   * shard's spot, the yellows it ices or turns into holds; and warn the yellows when a shield is going up or is up
   * (tapping them is countered).
   */
  private drawGhosts(g: G, c: Combat, now: number, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const blink = Math.floor(now / 110) % 2 === 0;
    const tg = c.telegraph;
    const owner = tg ? c.enemyById(tg.enemyId) : undefined;
    const sp = owner ? c.specialsOf(owner)[tg!.index] : undefined;
    if (!sp || !blink) return;
    const dashed = (px: number, pw: number, col: number, fill: number) => {
      g.fillStyle(col, fill);
      g.fillRect(px, B.y - 5, pw, B.h + 10);
      g.fillStyle(col, 0.9);
      for (let x = px; x < px + pw; x += 2) {
        g.fillRect(x, B.y - 6, 1, 1);
        g.fillRect(x, B.y + B.h + 5, 1, 1);
      }
      for (let y = B.y - 6; y < B.y + B.h + 6; y += 2) {
        g.fillRect(px, y, 1, 1);
        g.fillRect(px + pw - 1, y, 1, 1);
      }
    };
    for (const a of sp.actions) {
      if (a.type === 'formation') {
        let prev: { pos: number; w: number } | null = null;
        for (const e of a.blocks) {
          const kind = e.kind as BlockKind;
          if (!isRed(kind) || e.spot) continue;
          const w = c.widthFor(kind) * (e.width ?? 1);
          const pos: number = e.pair && prev ? prev.pos - (prev.w + w) / 2 : (e.at ?? 1 - w / 2);
          prev = { pos, w };
          const px = Math.round(B.x + pos * B.w - (w * B.w) / 2) + bx;
          const pw = Math.max(6, Math.round(w * B.w) - 1);
          dashed(px, pw, kind === 'bomb' ? 0xf28a2a : 0xff5a3a, 0.35);
        }
      } else if (a.type === 'zone' && (a.count ?? 1) === 1 && a.at !== undefined) {
        const pos = a.at === 'ahead' ? c.aheadPos() : a.at;
        const w = Math.max(0.02, Math.min(1, a.width));
        const lo = Math.max(0, Math.min(1 - w, pos - w / 2));
        dashed(Math.round(B.x + lo * B.w) + bx, Math.round(w * B.w), a.kind === 'ice' ? 0x9ae8ff : 0xe8f0ff, 0.15);
      } else if (a.type === 'mirror') {
        const pos = Math.max(0.15, Math.min(0.85, a.at === 'ahead' ? c.aheadPos(s.app.tuning.bar.ahead * 1.5) : (a.at ?? 0.5)));
        dashed(Math.round(B.x + pos * B.w) - 3 + bx, 7, 0xe0e8ff, 0.3);
      } else if (a.type === 'armor' || a.type === 'toHold') {
        const col = a.type === 'armor' ? 0xbff0ff : 0x5ab4ec;
        let n = 0;
        for (const b of c.blocks) {
          if (b.kind !== 'yellow' || n >= a.count) continue;
          n++;
          const w = Math.max(6, Math.round(b.width * B.w) - 1);
          dashed(Math.round(B.x + b.pos * B.w - w / 2) + bx, w, col, 0.25);
        }
      }
    }
  }

  /** A shield going up (blinking) or up: the yellows are off limits, so each one gets a steel shield mark. */
  private drawGuard(g: G, c: Combat, t: number, now: number, bx: number): void {
    const B = this.s.bar;
    const tg = c.telegraph;
    const owner = tg ? c.enemyById(tg.enemyId) : undefined;
    const sp = owner ? c.specialsOf(owner)[tg!.index] : undefined;
    const guardSoon = !!sp && sp.actions.some((a) => a.type === 'guard');
    if (c.guarder() || (guardSoon && Math.floor(now / 110) % 2 === 0)) {
      for (const b of c.blocks) {
        if (b.kind !== 'yellow') continue;
        const x = Math.round(B.x + c.blockPosAt(b, t) * B.w) + bx;
        const y = B.y + B.h / 2;
        g.fillStyle(0x3a1a60, c.guarder() ? 0.55 : 0.3);
        const w = Math.max(6, Math.round(b.width * B.w) - 1);
        g.fillRect(Math.round(x - w / 2), B.y - 5, w, B.h + 10);
        if (!c.guarder()) continue;
        g.fillStyle(INK, 1);
        g.fillRect(x - 4, y - 5, 9, 8);
        g.fillRect(x - 3, y + 3, 7, 2);
        g.fillRect(x - 1, y + 5, 3, 1);
        g.fillStyle(0xc8d0e0, 1);
        g.fillRect(x - 3, y - 4, 7, 6);
        g.fillRect(x - 2, y + 2, 5, 2);
        g.fillRect(x, y + 4, 1, 1);
        g.fillStyle(0x6a2aa8, 1);
        g.fillRect(x - 3, y - 1, 7, 1);
        g.fillRect(x, y - 4, 1, 7);
      }
    }
  }

  private drawDying(g: G, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const H0 = B.h + 10;
    const mid = B.y + B.h / 2;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      const k = (s.anim - d.at) / DYING_MS[d.style];
      if (k >= 1) {
        this.dying.splice(i, 1);
        continue;
      }
      const [base, light, dark] = d.reason === 'bomb' ? BOMB_COL : kindCol(d.kind);
      const x = d.x + bx;
      if (k < 0) {
        // (a trap waiting for the fire that burns it: it stands as it was)
        if (d.style === 'burn') brick(g, Math.round(x - d.w / 2), B.y - 5, d.w, H0, [light, base, dark, deepOf(d.kind)]);
        continue;
      }
      switch (d.style) {
        case 'pop': {
          // white swell, then the brick stretches into a tall pillar of light and pinches out
          const A = 0.14;
          ellipse(g, x, mid + 2, d.w / 2 + 4 + 16 * ease(k), 4 + 6 * ease(k), light, 1 - k, k < 0.5 ? 2 : 1);
          if (k < A) {
            const q = k / A;
            const sc = 1 + 0.3 * q;
            slab(g, x, mid - (H0 * sc) / 2, d.w * sc, H0 * sc, WHITE, WHITE, light);
          } else {
            const q = (k - A) / (1 - A);
            const w = d.w * 1.3 * (1 - q) ** 1.6;
            const h = H0 * (1.25 + 1.5 * ease(q));
            const bottom = mid + H0 * 0.65 * (1 - q * 0.6);
            const fill = q < 0.3 ? light : base;
            slab(g, x, bottom - h, w, h, fill, q < 0.3 ? WHITE : light, dark, 1 - q * 0.45);
            if (w > 3) {
              g.fillStyle(WHITE, 1 - q);
              g.fillRect(Math.round(x - w * 0.15), Math.round(bottom - h + 2), Math.max(1, Math.round(w * 0.3)), Math.round(h - 4));
            }
          }
          break;
        }
        case 'shatter': {
          // flash, then the brick splits in two halves that tumble apart and fall
          const A = 0.12;
          const flash = d.reason === 'bomb' ? 0xffe8b0 : 0xd8f8ff;
          if (k < A) {
            const sc = 1 + 0.18 * (k / A);
            slab(g, x, mid - (H0 * sc) / 2, d.w * sc, H0 * sc, flash, WHITE, light);
            break;
          }
          // the halves pop up and apart, spin, shrink away and fall (fully opaque until the very end)
          const q = (k - A) / (1 - A);
          const alpha = q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2;
          const hw = d.w / 2;
          const sc = 1 - 0.75 * q;
          for (const side of [-1, 1]) {
            const cx = x + side * (hw / 2 + 2 + 22 * ease(q));
            const cy = mid - 20 * Math.sin(Math.min(1, q * 1.4) * Math.PI * 0.5) + 34 * q * q;
            const rot = side * 2.2 * q;
            const quad = (pad: number) => {
              const pts: Phaser.Math.Vector2[] = [];
              for (const [ux, uy] of [
                [-1, -1],
                [1, -1],
                [1, 1],
                [-1, 1],
              ]) {
                const px = ux * ((hw / 2) * sc + pad);
                const py = uy * ((H0 / 2) * sc + pad);
                pts.push(new Phaser.Math.Vector2(Math.round(cx + px * Math.cos(rot) - py * Math.sin(rot)), Math.round(cy + px * Math.sin(rot) + py * Math.cos(rot))));
              }
              return pts;
            };
            g.fillStyle(INK, alpha);
            g.fillPoints(quad(1), true);
            g.fillStyle(q < 0.15 ? flash : base, alpha);
            g.fillPoints(quad(0), true);
            if (sc > 0.4) {
              g.fillStyle(light, alpha);
              g.fillPoints(quad(-Math.max(1, Math.round(2 * sc))), true);
              g.fillStyle(base, alpha);
              g.fillPoints(quad(-Math.max(2, Math.round(3 * sc))), true);
            }
          }
          break;
        }
        case 'crunch': {
          // the attack slams into the left end: squashes flat against it with a red-white flash
          const left = x - d.w / 2;
          const w = 2 + (d.w - 2) * (1 - ease(k));
          const h = H0 * (1 + 0.4 * Math.sin(k * Math.PI));
          slab(g, left + w / 2, mid - h / 2, w, h, k < 0.35 ? WHITE : base, k < 0.35 ? WHITE : light, dark, 1 - k * 0.5);
          break;
        }
        case 'fade': {
          // shrinks and drops away, blinking
          if (k > 0.4 && Math.floor(s.anim / 45) % 2 === 0) break;
          const sc = 1 - ease(k) * 0.85;
          slab(g, x, mid - (H0 * sc) / 2 + 6 * k, d.w * sc, H0 * sc, dark, base, INK, 1 - k * 0.4);
          break;
        }
        case 'zip': {
          // closes like an eye: flattens to a bright line
          const h = H0 * (1 - ease(k));
          slab(g, x, mid - h / 2, d.w * (1 + 0.25 * k), Math.max(1, h), k < 0.4 ? WHITE : light, WHITE, base, 1 - k * 0.3);
          break;
        }
        case 'flip': {
          // Turnabout: the red turns edge-on (narrowing to a line, a flash at its edge), and the keg widens out of it
          const w = Math.max(1, d.w * (1 - ease(k)));
          slab(g, x, mid - H0 / 2, w, H0, k < 0.5 ? base : light, light, dark);
          if (k > 0.6) {
            g.fillStyle(WHITE, (k - 0.6) / 0.4);
            g.fillRect(Math.round(x), Math.round(mid - H0 / 2), 1, H0);
          }
          break;
        }
        case 'iceOver': {
          // Big Freeze: ice climbs up over the red from its foot, then it flashes white and is a frozen block
          slab(g, x, mid - H0 / 2, d.w, H0, base, light, dark);
          const ih = Math.round(H0 * ease(Math.min(1, k * 1.25)));
          const x0 = Math.round(x - d.w / 2);
          g.fillStyle(0x8ae0f6, 0.85);
          g.fillRect(x0, Math.round(mid + H0 / 2 - ih), Math.round(d.w), ih);
          g.fillStyle(WHITE, 0.9);
          g.fillRect(x0, Math.round(mid + H0 / 2 - ih), Math.round(d.w), 1);
          if (k > 0.75) {
            g.fillStyle(WHITE, (k - 0.75) / 0.25);
            g.fillRect(x0 - 1, Math.round(mid - H0 / 2) - 1, Math.round(d.w) + 2, H0 + 2);
          }
          break;
        }
        case 'burn': {
          // burnt off the bar (Sunny's Fire Breath): the fire arrives (it glows white-hot, then orange), it chars from the
          // top down while flames lick up off it, and the last of it smokes away
          const top0 = mid - H0 / 2;
          const half = Math.max(3, d.w / 2);
          if (k < 0.18) {
            const q = k / 0.18;
            slab(g, x, top0 - 1, d.w + 2, H0 + 2, q < 0.4 ? WHITE : FIRE[1], WHITE, FIRE[2]);
          } else {
            const q = (k - 0.18) / 0.82;
            const h = Math.max(2, Math.round(H0 * (1 - 0.85 * ease(q))));
            const y = mid + H0 / 2 - h;
            slab(g, x, y, d.w * (1 - 0.25 * q), h, CHAR[1], CHAR[0], CHAR[2], 1 - q * 0.3);
            // its burning top edge
            g.fillStyle(q < 0.5 ? FIRE[1] : FIRE[2], 1 - q * 0.6);
            g.fillRect(Math.round(x - half + 1), Math.round(y), Math.max(1, Math.round(d.w - 2)), 1);
            // flames off it: three tongues, flickering, dying down
            for (let j = 0; j < 3; j++) {
              const fx = Math.round(x - half + ((j + 0.5) * d.w) / 3);
              const fl = (Math.floor(s.anim / 60) + j * 2) % 3;
              const fh = Math.round((7 + fl + (j === 1 ? 3 : 0)) * (1 - q * 0.75));
              if (fh < 2) continue;
              g.fillStyle(FIRE[4], 0.8);
              g.fillRect(fx - 2, y - fh, 4, fh);
              g.fillStyle(FIRE[3], 1);
              g.fillRect(fx - 1, y - fh, 2, fh);
              g.fillStyle(FIRE[2], 1);
              g.fillRect(fx - 1, y - fh + 2, 2, fh - 2);
              g.fillStyle(FIRE[0], 1);
              g.fillRect(fx, y - fh + 1 - (fl % 2), 1, Math.max(1, fh - 4));
            }
            // smoke rising off what's left
            if (q > 0.4) {
              const sq = (q - 0.4) / 0.6;
              g.fillStyle(0x6a6276, 0.6 * (1 - sq));
              g.fillCircle(Math.round(x - 2), Math.round(y - 6 - sq * 10), Math.round(2 + sq * 2));
              g.fillCircle(Math.round(x + 2), Math.round(y - 9 - sq * 12), Math.round(1 + sq * 2));
            }
          }
          break;
        }
        case 'fly': {
          // knocked off the bar by the finisher: flies right and up out of the bar, tumbling, with a trail
          const fx = x + (s.R + 20 - x) * k * k;
          const fy = mid - 40 * Math.sin(k * Math.PI * 0.6) * (0.6 + 0.4 * ((d.x * 7) % 1));
          const w = d.w * (1 - 0.5 * k);
          const h = H0 * (1 - 0.4 * k) * Math.abs(Math.cos(k * Math.PI * 1.5)) + 3;
          for (let tr = 1; tr <= 3; tr++) {
            g.fillStyle(light, 0.25 / tr);
            g.fillRect(Math.round(fx - tr * 7 - w / 2), Math.round(fy - h / 2), Math.round(w), Math.round(h));
          }
          slab(g, fx, fy - h / 2, w, h, k < 0.2 ? WHITE : base, light, dark, 1 - k * 0.5);
          break;
        }
      }
    }
  }
}
