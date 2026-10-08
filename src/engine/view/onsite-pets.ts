// On the spot, for round 7's four companions (Part 6): each perk shows on what it touched, like view/onsite.ts does for
// the others (it hands their perk events, the batch's events and its two layers to this):
// - Burr's Prickly: he curls up and a fan of spines flies from him into the foe whose red hit you (fighters.perkFx
//   asks `ownBlow` before its usual bolt), the foe flinches, a tan number;
// - Lark's Wake-up Song: a note flies from Lark to the next yellow and stays there, bobbing over it while the yellow
//   glows ('wakeSong'); hit, the note bursts into little notes and "+3" pops by the combo counter ('wakeNote');
// - Gloam's Night Eyes: three claw marks rake across the trap as it turns into a yellow (the bar flashes it: the
//   'morph' event), purple shards fly; while the swat is ready, glints in Gloam's eyes;
// - Nimbus's Tide: a wave rolls along the bar from the left end (its front is the core's c.perk.tideX), each red it
//   reaches splashes and is carried back; Calm Seas: the cursor glows aqua while the combo stays up and each hit
//   ripples; its attack (every foe): a curtain of rain sweeps across the foes, each struck as it reaches it.
// Everything animates from the scene's clock and the seeded Math.random (screenshots stay exact).
import type Phaser from 'phaser';
import { isRed, type Combat, type CombatEvent } from '../../core/combat';
import { signed, whole } from '../../core/format';
import type { FightScene } from '../scene';
import { sparkle } from './bar-kinds';
import { clamp01, ease, INK, mix, pulse, rand, WHITE, type EnemyView } from './shared';

type G = Phaser.GameObjects.Graphics;
type PerkEvent = Extract<CombatEvent, { type: 'perk' }>;

/** Water [white, foam, aqua, deep, deepest]; Lark's note; Gloam's claws; Burr's quills [tip, light, base, root]. */
const WATER = [0xffffff, 0xc8f8ff, 0x6ae8e8, 0x2a9ac8, 0x1a5a8a] as const;
const NOTE = [0xffffff, 0xfff6b0, 0xffd84a, 0xc8841c] as const;
const CLAW = [0xffffff, 0xe8d8ff, 0xb88aff, 0x6a2ab0] as const;
const QUILL = [0xfff0d0, 0xe0b880, 0x86542e, 0x3e2016] as const;
const SHARDS = [0xdab0ff, 0x9a4ad8, 0x6a2aa8] as const;

/** How long things last (ms of scene time). */
const NOTE_FLY_MS = 280;
const SLASH_MS = 460;
const SPINE_MS = 170;
const WAKE_MS = 320;
const POP_MS = 620;

/** An eighth note, 5 x 7 (x: ink-rimmed when drawn). */
const NOTE_ROWS = ['..xx.', '..x.x', '..x..', '..x..', 'xxx..', 'xxx..', '.x...'];

interface Spine {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  at: number;
  arc: number;
}

interface Flight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  at: number;
}

interface Rain {
  x0: number;
  x1: number;
  at: number;
  ms: number;
}

export class PetSite {
  private spines: Spine[] = [];
  private notes: Flight[] = [];
  private pops: Array<{ x: number; y: number; at: number }> = [];
  private slashes: Array<{ pos: number; at: number }> = [];
  private rains: Rain[] = [];
  /** When the song's note lands on its yellow (it shows on the bar from then), by block id. */
  private landAt = new Map<number, number>();
  /** The Tide: the reds the wave has splashed this time, the wave's last front, and when it ended. */
  private splashed = new Set<number>();
  private tideFront = 0;
  private tideEnd = -1e9;
  private rippleAt = -1e9;

  constructor(private readonly s: FightScene) {}

  newFight(): void {
    this.spines = [];
    this.notes = [];
    this.pops = [];
    this.slashes = [];
    this.rains = [];
    this.landAt.clear();
    this.splashed.clear();
    this.tideFront = 0;
    this.tideEnd = -1e9;
  }

  private get c(): Combat | null {
    return this.s.app.run.combat;
  }

  /** Whether a companion is along in this fight. */
  private along(c: Combat, id: string): boolean {
    return c.pets.some((p) => p.id === id);
  }

  /** A bar position's centre on screen. */
  private barPt(pos: number): { x: number; y: number } {
    const B = this.s.bar;
    return { x: this.s.barView.x(Math.max(0, Math.min(1, pos))), y: B.y + B.h / 2 };
  }

  /** A companion's place on screen (null when it isn't out). */
  private petScreen(id: 'burr' | 'lark' | 'gloam' | 'nimbus'): { x: number; y: number } | null {
    const party = this.s.fighters.party;
    const p = party.visible(id) ? party.petPos(id) : null;
    return p ? { x: p.x + this.s.world.x, y: p.y + this.s.world.y } : null;
  }

  // ------------------------------------------------------------------ events

  /** Every event of a batch (onsite.onEvent): a hit while the seas are calm ripples where it landed. */
  onEvent(e: CombatEvent): void {
    const c = this.c;
    if (e.type !== 'hit' || !c || e.echo || !this.along(c, 'nimbus') || e.combo < c.tuning.pets.calmAt) return;
    const s = this.s;
    if (s.anim - this.rippleAt < 220) return;
    this.rippleAt = s.anim;
    const p = this.barPt(e.pos);
    s.fx.ring(p.x, p.y, 9, WATER[2], false);
    s.later(90, () => s.fx.ring(p.x, p.y, 14, WATER[1], false));
    s.fx.chips(p.x, s.bar.y - 3, 6, [WHITE, WATER[1], WATER[2]], 5, -1);
  }

  /** A perk event (onsite.perk): the looks of this round's companions' perks. */
  perk(e: PerkEvent): void {
    const s = this.s;
    const c = this.c;
    if (!c) return;
    const fx = s.fx;
    switch (e.id) {
      case 'wakeSong': {
        // a note flies from Lark down to the yellow and settles over it
        if (e.pos === undefined) break;
        const to = this.barPt(e.pos);
        const from = this.petScreen('lark') ?? { x: to.x - 40, y: s.bar.y - 40 };
        this.notes.push({ x0: from.x + 5, y0: from.y - 2, x1: to.x, y1: s.bar.y + Math.round((s.bar.h - 7) / 2), at: s.anim });
        if (c.perk.songNote) this.landAt.set(c.perk.songNote, s.anim + NOTE_FLY_MS);
        s.app.audio.critterChirp();
        break;
      }
      case 'wakeNote': {
        // the singing yellow hit: its note bursts into little notes, "+3" by the combo counter
        const p = this.barPt(e.pos ?? c.cursorPos());
        for (let i = 0; i < 3; i++) this.pops.push({ x: p.x + (i - 1) * 6, y: s.bar.y - 8, at: s.anim + i * 50 });
        if (this.pops.length > 12) this.pops.splice(0, this.pops.length - 12);
        fx.ring(p.x, p.y, 14, NOTE[2], false);
        fx.chips(p.x, s.bar.y - 4, 10, [WHITE, NOTE[1], NOTE[2]], 10, -1);
        const r = s.hud.comboRect;
        if (r && e.amount > 0) fx.addFloater(r.x + r.w + 8, r.y + r.h / 2 - 2, signed(e.amount), NOTE[2], 1, true, 0, -14, 0, 900, false);
        s.app.audio.sparklePop();
        break;
      }
      case 'nightEyes': {
        // Gloam's swat: claw marks rake across the trap as it turns yellow, purple shards fly off it
        if (e.pos === undefined) break;
        this.slashes.push({ pos: e.pos, at: s.anim });
        if (this.slashes.length > 4) this.slashes.shift();
        const p = this.barPt(e.pos);
        const src = this.petScreen('gloam');
        if (src) fx.bolt(src.x + 8 - s.world.x, src.y - 4 - s.world.y, p.x - s.world.x, s.bar.y - 4 - s.world.y, 110, CLAW[2]);
        fx.chips(p.x, s.bar.y - 2, 10, SHARDS, 12, 0);
        fx.ring(p.x, p.y, 12, CLAW[2], false);
        s.app.audio.swish();
        break;
      }
      case 'tide': {
        // the wave rises at the left end (Nimbus calls it: a stream of water from it to there)
        this.splashed.clear();
        this.tideFront = 0;
        const p = this.barPt(0);
        const src = this.petScreen('nimbus');
        if (src) fx.bolt(src.x + 4 - s.world.x, src.y - 4 - s.world.y, p.x + 2 - s.world.x, s.bar.y - 6 - s.world.y, 160, WATER[2]);
        fx.chips(p.x + 4, s.bar.y - 2, 10, [WHITE, WATER[1], WATER[2]], 14, 1);
        fx.ring(p.x + 4, p.y, 14, WATER[1], false);
        s.app.audio.whoosh();
        break;
      }
      case 'calmSeas': {
        // the sea calms: ripples run out along the bar from the cursor
        const p = this.barPt(c.cursorPos());
        for (let i = 0; i < 4; i++) s.later(i * 70, () => fx.ring(p.x, p.y, 10 + i * 6, i % 2 ? WATER[1] : WATER[2], false));
        fx.chips(p.x, s.bar.y - 4, 18, [WHITE, WATER[1], WATER[2]], 10, -1);
        break;
      }
    }
  }

  /**
   * A perk's blow that this draws itself (fighters.perkFx asks before its usual bolt): Burr's spines fly from him into
   * the foe, which flinches as they land, a tan number. True when it's one of these.
   */
  ownBlow(id: string, v: EnemyView, amount: number): boolean {
    if (id !== 'prickly') return false;
    const s = this.s;
    const party = s.fighters.party;
    const src = party.visible('burr') ? party.petPos('burr') : null;
    const x0 = src ? src.x + 4 : s.fighters.h.x + 6;
    const y0 = src ? src.y - 2 : s.ground - 22;
    const tx = v.x - v.img.displayWidth * 0.25;
    const ty = v.y - v.img.displayHeight / 2;
    for (let i = 0; i < 6; i++) this.spines.push({ x0: x0 + rand(-3, 3), y0: y0 + rand(-4, 2), x1: tx + rand(-5, 5), y1: ty + rand(-7, 7), at: s.anim + i * 22, arc: 6 + i * 2 + rand(0, 4) });
    if (this.spines.length > 30) this.spines.splice(0, this.spines.length - 30);
    s.app.audio.swish();
    s.later(SPINE_MS, () => {
      const fx = s.fx;
      v.flashUntil = s.anim + 60;
      v.kickAt = s.anim;
      v.kickDist = 5;
      if (!v.dieAt) s.fighters.setEnemyPose(v, 'hurt', 140);
      fx.sparks.push({ x: tx, y: ty, at: s.anim, size: 11, color: QUILL[1] });
      fx.burst(tx, ty, QUILL[1], 8, true, 1.1, true);
      fx.stars.push({ x: tx, y: ty, at: s.anim, r: 14, color: QUILL[0] });
      fx.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), QUILL[1], 2);
      s.app.audio.hit(0, false);
    });
    return true;
  }

  /** Nimbus's spray on every foe: a curtain of rain sweeps across them from the nearest to the farthest; each is
   *  struck (`strike`) as the rain reaches it. */
  spraySweep(views: EnemyView[], strike: (v: EnemyView) => void): void {
    const s = this.s;
    const list = views.filter((v) => !v.dieAt).sort((a, b) => a.x - b.x);
    if (!list.length) return;
    const x0 = Math.min(...list.map((v) => v.x - v.img.displayWidth / 2)) - 8;
    const x1 = Math.max(...list.map((v) => v.x + v.img.displayWidth / 2)) + 6;
    const start = 170;
    const ms = Math.max(200, Math.min(420, (x1 - x0) * 3.4));
    this.rains.push({ x0, x1, at: s.anim + start, ms });
    if (this.rains.length > 3) this.rains.shift();
    for (const v of list) {
      const k = clamp01((v.x - x0) / Math.max(1, x1 - x0));
      s.later(start + ms * k, () => {
        if (v.dieAt && s.anim - v.dieAt > 50) return;
        strike(v);
        const cx = v.x;
        const cy = v.y - v.img.displayHeight / 2;
        s.fx.burst(cx, cy, WATER[2], 10, true, 1, false);
        s.fx.burst(cx, cy - 4, WATER[0], 5, true, 1.2, true);
        s.fx.glow(cx, cy, 14, WATER[3], 240, v.fly ? undefined : s.ground);
      });
    }
  }

  // ------------------------------------------------------------------ the bar (screen space)

  /** Over the blocks (`g`) and over everything on the bar (`gf`). */
  drawBar(g: G, gf: G, c: Combat, now: number): void {
    const s = this.s;
    const t = s.app.renderTime(now);
    if (c.perk.songNote && this.along(c, 'lark')) this.drawSong(g, gf, c, t, now);
    this.drawNotes(gf, now);
    this.drawPops(gf);
    this.drawSlashes(g);
    if (this.along(c, 'nimbus')) {
      this.drawTide(g, gf, c, now);
      if (c.combo >= c.tuning.pets.calmAt && s.app.run.phase === 'fight') this.drawCalm(g, c, t, now);
    }
  }

  /** The singing yellow: it glows, a golden rim breathing round it, and the note bobs over it. */
  private drawSong(g: G, gf: G, c: Combat, t: number, now: number): void {
    const s = this.s;
    const B = s.bar;
    const id = c.perk.songNote;
    const b = c.blocks.find((x) => x.id === id);
    if (!b || s.anim < (this.landAt.get(id) ?? -1e9)) return;
    const x = Math.round(this.barPt(c.blockPosAt(b, t)).x);
    const w = Math.max(6, Math.round(b.width * B.w));
    const p = pulse(now, 700);
    const x0 = x - Math.round(w / 2) - 2;
    // a soft gold glow round the block, then a breathing rim
    gf.fillStyle(NOTE[2], 0.14 + 0.12 * p);
    gf.fillRect(x0 - 2, B.y - 4, w + 8, B.h + 8);
    const rim = mix(NOTE[2], WHITE, p * 0.7);
    gf.fillStyle(INK, 0.7);
    gf.fillRect(x0, B.y - 3, w + 4, 1);
    gf.fillRect(x0, B.y + B.h + 2, w + 4, 1);
    gf.fillStyle(rim, 0.95);
    gf.fillRect(x0 + 1, B.y - 2, w + 2, 1);
    gf.fillRect(x0 + 1, B.y + B.h + 1, w + 2, 1);
    gf.fillRect(x0, B.y - 1, 1, B.h + 2);
    gf.fillRect(x0 + w + 3, B.y - 1, 1, B.h + 2);
    // the note on it (white on the yellow, bobbing), a sparkle at its corner now and then
    const bob = Math.round(Math.sin(now / 260));
    this.note(gf, x - 2, B.y + Math.round((B.h - 7) / 2) + bob, mix(NOTE[1], WHITE, p));
    if (Math.floor(now / 230) % 3 === 0) sparkle(gf, x + Math.round(w / 2), B.y - 1, 1, WHITE, 0.9);
    void g;
  }

  /** An eighth note at (x, y) (its top-left), ink-rimmed, its head lit. */
  private note(g: G, x: number, y: number, col: number, a = 1): void {
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle(INK, 0.9 * a);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      NOTE_ROWS.forEach((r, yy) => {
        for (let xx = 0; xx < r.length; xx++) if (r[xx] === 'x') g.fillRect(x + xx + dx, y + yy + dy, 1, 1);
      });
    g.fillStyle(col, a);
    NOTE_ROWS.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; xx++) if (r[xx] === 'x') g.fillRect(x + xx, y + yy, 1, 1);
    });
    g.fillStyle(WHITE, a);
    g.fillRect(x, y + 4, 1, 1);
  }

  /** Lark's note on its way down to the yellow. */
  private drawNotes(g: G, now: number): void {
    const s = this.s;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const f = this.notes[i];
      const k = (s.anim - f.at) / NOTE_FLY_MS;
      if (k >= 1) {
        this.notes.splice(i, 1);
        s.fx.ring(f.x1, f.y1 + 6, 10, NOTE[2], false);
        s.fx.chips(f.x1, f.y1 + 4, 8, [WHITE, NOTE[1], NOTE[2]], 6, -1);
        continue;
      }
      if (k < 0) continue;
      const e = ease(k);
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 14;
      // a sparkling trail behind it
      for (let j = 1; j <= 4; j++) {
        const q = Math.max(0, k - j * 0.06);
        const qe = ease(q);
        const tx = f.x0 + (f.x1 - f.x0) * qe;
        const ty = f.y0 + (f.y1 - f.y0) * qe - Math.sin(q * Math.PI) * 14;
        g.fillStyle(j < 2 ? NOTE[1] : NOTE[2], 0.8 * (1 - j / 5));
        g.fillRect(Math.round(tx) + 1, Math.round(ty) + 4, 2, 2);
      }
      this.note(g, x - 2, y, NOTE[2]);
      if (Math.floor(now / 60) % 2) sparkle(g, Math.round(x) + 4, Math.round(y) - 1, 1, WHITE, 0.9);
    }
  }

  /** The note bursting into little notes that float up and fade. */
  private drawPops(g: G): void {
    const s = this.s;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      const k = (s.anim - p.at) / POP_MS;
      if (k >= 1) {
        this.pops.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      this.note(g, p.x - 2 + Math.sin(k * 6 + p.x) * 2, p.y - 18 * ease(k), mix(NOTE[2], NOTE[1], k), a);
    }
  }

  /** Gloam's claw marks raking across the block it swatted: three white-hot slashes that draw on fast and fade. */
  private drawSlashes(g: G): void {
    const s = this.s;
    const B = s.bar;
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      const k = (s.anim - sl.at) / SLASH_MS;
      if (k >= 1) {
        this.slashes.splice(i, 1);
        continue;
      }
      const x = this.barPt(sl.pos).x;
      const grow = clamp01(k / 0.25);
      const a = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
      const len = B.h + 12;
      for (let j = 0; j < 3; j++) {
        const sx = x - 6 + j * 5;
        const sy = B.y - 6;
        const n = Math.round(len * grow);
        for (const ink of [true, false])
          for (let q = 0; q < n; q++) {
            const px = Math.round(sx + q * 0.45);
            const py = sy + q;
            const mid = q > len * 0.25 && q < len * 0.75;
            if (ink) {
              g.fillStyle(INK, 0.6 * a);
              g.fillRect(px - 1, py, mid ? 4 : 3, 1);
            } else {
              g.fillStyle(mid ? CLAW[0] : CLAW[1], a);
              g.fillRect(px, py, mid ? 2 : 1, 1);
              if (mid) {
                g.fillStyle(CLAW[2], a * 0.8);
                g.fillRect(px + 2, py, 1, 1);
              }
            }
          }
      }
    }
  }

  /** The Tide: a curling wave rolling along the bar (the core's front), foam and bubbles in its wake; each red it reaches
   *  splashes as the wave carries it back. The wake goes on `g` (over the blocks), the crest on `gf` (over the cursor). */
  private drawTide(g: G, gf: G, c: Combat, now: number): void {
    const s = this.s;
    const B = s.bar;
    const front = c.perk.tideX ?? 0;
    if (front > 0) {
      this.tideFront = Math.min(1, front);
      // the reds it reaches splash
      for (const b of c.blocks)
        if (isRed(b.kind) && !b.still && !this.splashed.has(b.id) && b.pos - b.width / 2 <= front) {
          this.splashed.add(b.id);
          const p = this.barPt(b.pos);
          s.fx.chips(p.x, B.y - 2, 12, [WHITE, WATER[1], WATER[2]], 12, 1);
          s.fx.ring(p.x, p.y, 13, WATER[1], false);
        }
    } else if (this.tideFront > 0) {
      this.tideFront = 0;
      this.tideEnd = s.anim;
    }
    const wake = front > 0 ? 1 : 1 - clamp01((s.anim - this.tideEnd) / WAKE_MS);
    if (wake <= 0) return;
    const fx = Math.round(this.barPt(front > 0 ? Math.min(1, front) : 1).x);
    // the wake: rippling foam along the bar's top and bottom edges, bubbles rising through it
    for (let x = B.x + 2; x < fx - 6; x += 2) {
      const k = (x - B.x) / Math.max(1, fx - B.x);
      const up = Math.sin(x * 0.55 - now / 70) > 0 ? 1 : 0;
      g.fillStyle(WATER[2], (0.35 + 0.5 * k) * wake);
      g.fillRect(x, B.y - 2 - up, 2, 2);
      g.fillRect(x, B.y + B.h + up, 2, 2);
      g.fillStyle(WATER[0], (0.3 + 0.6 * k) * wake);
      g.fillRect(x, B.y - 2 - up, 1, 1);
      if ((x * 7) % 11 === 0) {
        const by = B.y + B.h - 2 - ((now / 30 + x * 3) % Math.max(4, B.h - 2));
        g.fillStyle(WATER[1], 0.7 * k * wake);
        g.fillRect(x, Math.round(by), 1, 1);
      }
    }
    if (front <= 0) return;
    // the crest: a wall of water standing over the bar, its foam curling forward over the top, spray off the lip
    const top = B.y - 12;
    const bot = B.y + B.h + 3;
    const px: Array<[number, number, number]> = [];
    for (let y = top + 3; y <= bot; y++) {
      const t = (y - top) / (bot - top);
      const wBody = Math.round(3 + 5 * t);
      for (let dx = -wBody; dx <= 0; dx++) px.push([fx + dx, y, dx === 0 ? WATER[1] : dx >= -2 ? WATER[2] : WATER[3]]);
    }
    for (const [dx, dy, col] of [
      [-3, 0, WATER[0]],
      [-2, 0, WATER[0]],
      [-1, 0, WATER[0]],
      [-4, 1, WATER[0]],
      [-3, 1, WATER[1]],
      [-2, 1, WATER[0]],
      [-1, 1, WATER[0]],
      [0, 1, WATER[0]],
      [1, 1, WATER[0]],
      [-4, 2, WATER[1]],
      [-3, 2, WATER[2]],
      [1, 2, WATER[0]],
      [2, 2, WATER[0]],
      [2, 3, WATER[1]],
      [3, 3, WATER[0]],
      [3, 4, WATER[0]],
    ] as const)
      px.push([fx + dx, top + dy, col]);
    gf.fillStyle(INK, 0.85);
    for (const [x, y] of px) gf.fillRect(x - 1, y - 1, 3, 3);
    for (const [x, y, col] of px) {
      gf.fillStyle(col, 1);
      gf.fillRect(x, y, 1, 1);
    }
    // spray flying off the lip, foam at its foot
    for (let i = 0; i < 6; i++) {
      const ph = (now / 80 + i * 1.7) % 3;
      gf.fillStyle(i % 2 ? WATER[0] : WATER[1], 1 - ph / 3);
      gf.fillRect(Math.round(fx + 3 + ((i * 3) % 5) - ph), Math.round(top - 1 - ph * 2.5 - (i % 2)), 1, 1);
    }
    gf.fillStyle(WATER[0], 0.9);
    for (let i = 0; i < 4; i++) gf.fillRect(fx - 9 - i * 3, bot - (i % 2), 2, 1);
  }

  /** Calm Seas while the combo stays up: a soft aqua glow round the cursor, a little wave riding over its cap. */
  private drawCalm(g: G, c: Combat, t: number, now: number): void {
    const s = this.s;
    const B = s.bar;
    const x = Math.round(this.barPt(c.cursorPosAt(t)).x);
    const p = pulse(now, 1100);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(WATER[2], (0.16 + 0.1 * p) * (1 - i * 0.3));
      g.fillRect(x - 3 - i * 2, B.y - 6 - i, 7 + i * 4, B.h + 12 + i * 2);
    }
    // a little wave crest riding over the cursor's top cap
    const y = B.y - 12 - Math.round(p);
    g.fillStyle(INK, 0.8);
    g.fillRect(x - 4, y - 1, 9, 4);
    g.fillStyle(WATER[2], 1);
    g.fillRect(x - 3, y + 1, 7, 1);
    g.fillStyle(WATER[1], 1);
    g.fillRect(x - 3, y, 3, 1);
    g.fillRect(x + 1, y, 2, 1);
    g.fillStyle(WATER[0], 1);
    g.fillRect(x + 2, y - 1 + (Math.floor(now / 300) % 2), 1, 1);
  }

  // ------------------------------------------------------------------ the stage (world space)

  /** Burr's spines in flight, Nimbus's rain over the foes, the glint in Gloam's eyes while its swat is ready. */
  drawWorld(g: G, c: Combat, now: number): void {
    this.drawSpines(g);
    this.drawRain(g, now);
    if (c.perk.nightReady && this.along(c, 'gloam')) this.drawEyes(g, now);
  }

  private drawSpines(g: G): void {
    const s = this.s;
    for (let i = this.spines.length - 1; i >= 0; i--) {
      const sp = this.spines[i];
      const k = (s.anim - sp.at) / SPINE_MS;
      if (k >= 1) {
        this.spines.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const at = (q: number) => [sp.x0 + (sp.x1 - sp.x0) * q, sp.y0 + (sp.y1 - sp.y0) * q - Math.sin(q * Math.PI) * sp.arc] as const;
      const [x, y] = at(k);
      const [px, py] = at(Math.max(0, k - 0.12));
      // a needle along its path: ink rim, a dark root, a pale tip
      const dx = x - px;
      const dy = y - py;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const ux = dx / d;
      const uy = dy / d;
      for (const ink of [true, false])
        for (let q = 0; q < 7; q++) {
          const X = Math.round(x - ux * (6 - q));
          const Y = Math.round(y - uy * (6 - q));
          if (ink) {
            g.fillStyle(INK, 0.85);
            g.fillRect(X - 1, Y - 1, 3, 3);
          } else {
            g.fillStyle(q >= 6 ? WHITE : q >= 4 ? QUILL[0] : q >= 2 ? QUILL[1] : QUILL[2], 1);
            g.fillRect(X, Y, 1, 1);
          }
        }
    }
  }

  /** The rain: drops streaking down over the foes behind the curtain's front, splashing at their feet. */
  private drawRain(g: G, now: number): void {
    const s = this.s;
    const ground = s.ground;
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      const t = s.anim - r.at;
      const LINGER = 260;
      if (t > r.ms + LINGER) {
        this.rains.splice(i, 1);
        continue;
      }
      if (t < 0) continue;
      const front = r.x0 + (r.x1 - r.x0) * ease(clamp01(t / r.ms));
      for (let x = Math.floor(r.x0); x <= front; x += 3) {
        const passed = t - r.ms * clamp01((x - r.x0) / Math.max(1, r.x1 - r.x0));
        const life = 1 - clamp01(passed / LINGER);
        if (life <= 0) continue;
        // two drops per column, falling (each column its own phase)
        for (let j = 0; j < 2; j++) {
          const ph = ((now / 7 + x * 13 + j * 23) % 48) / 48;
          const y = Math.round(ground - 52 + ph * 52);
          g.fillStyle(WATER[3], 0.7 * life);
          g.fillRect(x, y - 4, 1, 4);
          g.fillStyle(WATER[1], 0.9 * life);
          g.fillRect(x, y, 1, 2);
          if (ph > 0.9) {
            g.fillStyle(WATER[0], 0.8 * life);
            g.fillRect(x - 1, ground - 1, 3, 1);
          }
        }
      }
      // the curtain's front: a bright sheet of water
      if (t <= r.ms) {
        const fx = Math.round(front);
        g.fillStyle(WATER[1], 0.85);
        g.fillRect(fx - 1, ground - 54, 2, 54);
        g.fillStyle(WATER[0], 0.9);
        g.fillRect(fx, ground - 46, 1, 40);
      }
    }
  }

  /** Night Eyes ready: a violet glint pulsing in each of Gloam's eyes. */
  private drawEyes(g: G, now: number): void {
    const P = this.s.fighters.party.pets.find((p) => p.id === 'gloam');
    if (!P || !P.img.visible || P.state !== 'idle') return;
    // (its eyes sit at about (21..26, 9) in its 36 x 24 frame, drawn with origin (0.5, 1))
    const x = Math.round(P.img.x - 18 + 21);
    const y = Math.round(P.img.y - 24 + 9);
    const r = Math.floor(now / 160) % 4 === 0 ? 3 : 2;
    g.fillStyle(CLAW[2], 0.18 + 0.12 * pulse(now, 600));
    g.fillCircle(x + 2, y, 3);
    sparkle(g, x, y, r, mix(CLAW[2], WHITE, pulse(now, 600)), 0.95);
    sparkle(g, x + 4, y, r - 1, mix(CLAW[2], WHITE, pulse(now, 600, 200)), 0.85);
  }
}
