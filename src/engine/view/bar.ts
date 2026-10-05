// The timing bar: metal frame, blocks (and how they leave), the cursor blade, hit beams and the swipe hint. Sable's
// two cursors: cursor A (blue) sweeps the left half and B (violet) the right one, with a divider at the middle and
// each half faintly tinted in its cursor's colour. A block that changes kind (Chain Reaction) flashes as it turns.
import Phaser from 'phaser';
import { isRed, type Block, type BlockKind, type Combat, type RemoveReason } from '../../core/combat';
import type { FightScene } from '../scene';
import { ICONS } from '../art';
import { buildBarFrame } from '../chrome';
import { brick, ellipse, icon, rows, slab } from './pixels';
import { BLOCK_ICONS, FOE_ICONS } from './icons';
import { BOMB_COL, deepOf, DYING_MS, dyingStyle, ease, INK, kindCol, rand, stackCol, WHITE, type Dying } from './shared';

type G = Phaser.GameObjects.Graphics;

/** Each cursor's colours: Rowan's and Sable's A blue, Sable's B violet. */
const HAND_LOOK = [
  { blade: 0x3a8ae8, core: 0x9ad8ff, deep: 0x1a3c8a, cap: 0xb8c2d8 },
  { blade: 0xb05ae0, core: 0xe8c0ff, deep: 0x5a1a8a, cap: 0xdab0ff },
] as const;

export class BarView {
  g!: G;
  img: Phaser.GameObjects.Image | null = null;
  dying: Dying[] = [];
  private blockSeen = new Map<number, number>(); // block id -> anim time it first appeared
  explodeFx: { x: number; r: number; until: number } | null = null;
  beams: Array<{ x: number; at: number; color: number }> = [];
  private cursorPulseAt = [0, 0];
  private cursorPulseColor = [WHITE, WHITE];
  /** Blocks that just changed kind: id -> anim time (they flash white as they turn). */
  private morphs = new Map<number, number>();
  shakeUntil = 0;

  constructor(private readonly s: FightScene) {}

  /** Regenerate the frame texture for the current bar size. */
  build(): void {
    const B = this.s.bar;
    buildBarFrame(this.s, B.w, B.h);
    this.img?.destroy();
    this.img = this.s.add.image(B.x - 9, B.y - 5, 'barframe').setOrigin(0, 0).setDepth(10.5);
  }

  /** A new fight: forget which blocks were already seen dropping in. */
  newFight(): void {
    this.blockSeen.clear();
    this.morphs.clear();
  }

  /** A block changed kind (Chain Reaction turns yellows green): a flash on it, a ring and chips in its new colour. */
  morph(id: number): void {
    const s = this.s;
    const c = s.app.run.combat;
    const b = c?.blocks.find((x) => x.id === id);
    this.morphs.set(id, s.anim);
    if (!b || !c) return;
    const x = this.x(b.pos);
    const y = s.bar.y + s.bar.h / 2;
    const [base, light] = kindCol(b.kind);
    s.fx.ring(x, y, 10, light, false);
    s.fx.chips(x, s.bar.y - 4, Math.max(6, b.width * s.bar.w), [WHITE, light, base], 6, -1);
  }

  /** Bar position (0..1) to game x. */
  x(pos: number): number {
    return this.s.bar.x + pos * this.s.bar.w;
  }

  /** The cursor that hit (`hand`: Sable's A or B) pulses in a colour. */
  cursorPulse(color: number, hand = 0): void {
    const i = hand > 0 ? 1 : 0;
    this.cursorPulseAt[i] = performance.now();
    this.cursorPulseColor[i] = color;
  }

  /** Ring + vertical beam shooting up from the bar where a block was hit. */
  cursorHit(x: number, color: number): void {
    const fx = this.s.fx;
    const y = this.s.bar.y + this.s.bar.h / 2;
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
    this.dying.push({ x, w, kind, reason, style, at: s.anim });
    for (const id of this.blockSeen.keys()) if (!s.app.run.combat?.blocks.some((b) => b.id === id)) this.blockSeen.delete(id);
    if (this.dying.length > 24) this.dying.shift();
    const [base, light] = reason === 'bomb' ? BOMB_COL : kindCol(kind);
    const top = s.bar.y - 5;
    const mid = s.bar.y + s.bar.h / 2;
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

  draw(t: number, now: number): void {
    const s = this.s;
    const g = this.g;
    g.clear();
    const c = s.app.run.combat;
    const B = s.bar;
    const bx = now < this.shakeUntil ? Math.round(rand(-2, 2)) : 0;
    if (!s.fightHud()) return;
    this.img?.setX(B.x - 9 + bx);
    // the left end is where enemy attacks land: a warm warning glow
    g.fillStyle(0xe0463c, 0.85);
    g.fillRect(B.x + bx, B.y + 1, 2, B.h - 2);
    g.fillStyle(0xff9a80, 0.5);
    g.fillRect(B.x + bx + 2, B.y + 1, 1, B.h - 2);
    if (!c) return;
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

    const group = c.enemies.length > 1;
    if (c.hands > 1) this.drawHalves(g, now, bx);
    this.drawGhosts(g, c, now, bx);
    for (const b of c.blocks) if (!isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);
    this.drawGuard(g, c, t, now, bx);
    for (const b of c.blocks) if (isRed(b.kind)) this.drawBlock(g, b, c, t, now, group, bx);

    this.drawDying(g, bx);

    if (this.explodeFx && now < this.explodeFx.until) {
      const k = 1 - (this.explodeFx.until - now) / 260;
      const r = Math.round(this.explodeFx.r * (0.4 + 0.6 * k));
      g.fillStyle(k < 0.5 ? 0xffe680 : 0xff8a3a, 0.8 * (1 - k));
      g.fillRect(Math.round(this.explodeFx.x - r), B.y - 4, r * 2, B.h + 8);
    }

    // the cursor (Sable: one per half, each in its colour)
    for (let hand = 0; hand < Math.min(2, c.hands); hand++) this.drawCursor(g, c, t, now, bx, hand);

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
          g.fillStyle(i < 8 ? WHITE : i < 16 ? hi : col, a * (1 - i / 28));
          g.fillRect(hx - i, hy - (i < 4 ? 1 : 0), 1, i < 4 ? 3 : i < 14 ? 2 : 1);
        }
        g.fillStyle(INK, a);
        g.fillRect(hx + 1, hy - 3, 1, 7);
        g.fillStyle(WHITE, a);
        for (let j = 0; j < 4; j++) {
          g.fillRect(hx + 1 + j, hy - 3 + j, 2, 1);
          g.fillRect(hx + 1 + j, hy + 3 - j, 2, 1);
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
      g.fillStyle(bm.color, 0.9 * (1 - k));
      g.fillRect(bm.x - Math.floor(w / 2), top, w, B.y - top);
      g.fillStyle(WHITE, 0.9 * (1 - k));
      g.fillRect(bm.x, top, 1, B.y - top);
    }
    s.fx.drawRings(g, now, false);
    s.fx.drawParticles(g, now, false);
  }

  /**
   * A cursor: a glowing blade with silver caps (a trail at speed, a pulse on hits). Blue for Rowan and Sable's A,
   * violet for Sable's B; orange-hot at top speed, icy when a Stomp froze it.
   */
  private drawCursor(g: G, c: Combat, t: number, now: number, bx: number, hand: number): void {
    const s = this.s;
    const B = s.bar;
    const speed = c.speedMult();
    const hot = speed >= s.app.tuning.cursor.maxSpeedMult - 0.01 || c.minSpeed > 0;
    const frozen = c.freeze > 0;
    const look = HAND_LOOK[hand > 0 ? 1 : 0];
    const blade = frozen ? 0xbfe8ff : hot ? 0xff8a2a : look.blade;
    const core = frozen ? WHITE : hot ? 0xffd080 : look.core;
    if (speed > 1.2) {
      for (let i = 1; i <= 3; i++) {
        const px = Math.round(B.x + c.cursorPosAt(t - i * 0.01, hand) * B.w) + bx;
        g.fillStyle(core, 0.35 / i);
        g.fillRect(px - 1, B.y, 3, B.h);
      }
    }
    const cx = Math.round(B.x + c.cursorPosAt(t, hand) * B.w) + bx;
    const pk = (now - this.cursorPulseAt[hand > 0 ? 1 : 0]) / 160;
    if (pk < 1) {
      const pw = Math.round(2 + 6 * (1 - pk));
      g.fillStyle(this.cursorPulseColor[hand > 0 ? 1 : 0], 0.6 * (1 - pk));
      g.fillRect(cx - pw, B.y - 3, pw * 2 + 1, B.h + 6);
    }
    if (frozen) {
      // frozen by a Stomp: an icy halo and frost flakes
      g.fillStyle(0xbfe8ff, 0.35);
      g.fillRect(cx - 4, B.y - 4, 9, B.h + 8);
      if (Math.random() < 0.5) s.fx.particles.push({ x: cx + rand(-4, 4), y: B.y + rand(0, B.h), vx: rand(-10, 10), vy: rand(-14, -4), g: 0, born: now, life: 300, color: WHITE, size: 1, world: false, streak: false });
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
    g.fillStyle(hot ? 0xa0400a : look.deep, 1);
    g.fillRect(cx + 1, top + 2, 1, len - 4);
    // sparkle caps: 4-point stars with an ink rim (Sable's in her cursors' colours)
    const cap = c.hands > 1 && !hot && !frozen ? look.cap : 0xb8c2d8;
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

  /** Two cursors: each half of the track faintly in its cursor's colour, and a divider at the middle. */
  private drawHalves(g: G, now: number, bx: number): void {
    const B = this.s.bar;
    const mid = Math.round(B.x + B.w / 2) + bx;
    const half = Math.round(B.w / 2);
    g.fillStyle(HAND_LOOK[0].blade, 0.13);
    g.fillRect(B.x + bx + 3, B.y + 1, half - 4, B.h - 2);
    g.fillStyle(HAND_LOOK[1].blade, 0.13);
    g.fillRect(mid + 2, B.y + 1, B.w - half - 3, B.h - 2);
    // the divider: an ink seam with a lit edge, and gold studs above and below the track
    g.fillStyle(INK, 1);
    g.fillRect(mid - 1, B.y - 3, 3, B.h + 6);
    g.fillStyle(0xd8c890, 0.9);
    g.fillRect(mid, B.y - 2, 1, B.h + 4);
    for (const sy of [B.y - 5, B.y + B.h + 3]) {
      g.fillStyle(INK, 1);
      g.fillRect(mid - 2, sy - 1, 5, 4);
      g.fillStyle(0xf2c230, 1);
      g.fillRect(mid - 1, sy, 3, 2);
      g.fillStyle(0xfff0a0, 1);
      g.fillRect(mid - 1, sy, 1, 1);
    }
    void now;
  }

  private drawBlock(g: G, b: Block, c: Combat, t: number, now: number, group: boolean, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const pos = c.blockPosAt(b, t);
    // Chunky bricks that stick out above and below the track; 1px seam when they touch.
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const x = Math.round(B.x + pos * B.w - w / 2) + bx;
    const h = B.h + 10;
    const y = B.y - 5;
    if ((b.kind === 'purple' || b.kind === 'spore') && b.life < 1 && Math.floor(now / 90) % 2 === 0) return;
    const [base, light, dark] = kindCol(b.kind);
    if (b.push > 0)
      for (let i = 1; i <= 3; i++) {
        g.fillStyle(light, 0.4 / i);
        g.fillRect(x - i * 6, y + 3, w, h - 6);
      }
    const impacting = b.impactTimer >= 0 && Math.floor(now / 40) % 2 === 0;
    // fresh blocks drop in from above and land with a little squash (scene time, so it plays before TAP TO BEGIN too)
    let seen = this.blockSeen.get(b.id);
    if (seen === undefined) this.blockSeen.set(b.id, (seen = s.anim));
    const age = (s.anim - seen) / 160;
    const fall = age < 0.7 ? Math.round(-14 * (1 - age / 0.7) ** 2) : 0;
    const squash = age >= 0.7 && age < 1 ? Math.round(2 * Math.sin(((age - 0.7) / 0.3) * Math.PI)) : 0;
    const X = x - squash;
    const Y = y + fall + squash;
    const W = w + squash * 2;
    const H = h - squash;
    brick(g, X, Y, W, H, impacting ? [WHITE, WHITE, light, base] : [light, base, dark, deepOf(b.kind)]);
    // it just changed kind: a white flash fading off it
    const mk = (s.anim - (this.morphs.get(b.id) ?? -1e9)) / 280;
    if (mk >= 0 && mk < 1) rows(g, X, Y, W, H, 2, WHITE, 0.85 * (1 - mk));
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
      if (variant) {
        icon(g, variant, cx, ownerIcon ? Y + 12 : cy, b.kind === 'speed' ? 0xffe680 : INK);
        if (ownerIcon) icon(g, ownerIcon, cx, Y + 3, WHITE);
      } else if (ownerIcon) icon(g, ownerIcon, cx, cy, WHITE);
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
  }

  /**
   * While a special winds up, show where its reds will land (blinking outlines), and warn the yellows when a
   * shield is going up or is up (tapping them is countered).
   */
  private drawGhosts(g: G, c: Combat, now: number, bx: number): void {
    const s = this.s;
    const B = s.bar;
    const blink = Math.floor(now / 110) % 2 === 0;
    const tg = c.telegraph;
    const owner = tg ? c.enemyById(tg.enemyId) : undefined;
    const sp = owner ? c.specialsOf(owner)[tg!.index] : undefined;
    if (sp && blink) {
      for (const a of sp.actions) {
        if (a.type !== 'formation') continue;
        let prev: { pos: number; w: number } | null = null;
        for (const e of a.blocks) {
          const kind = e.kind as BlockKind;
          if (!isRed(kind)) continue;
          const w = c.widthFor(kind) * (e.width ?? 1);
          const pos: number = e.pair && prev ? prev.pos - (prev.w + w) / 2 : (e.at ?? 1 - w / 2);
          prev = { pos, w };
          const px = Math.round(B.x + pos * B.w - (w * B.w) / 2) + bx;
          const pw = Math.max(6, Math.round(w * B.w) - 1);
          const col = kind === 'bomb' ? 0xf28a2a : 0xff5a3a;
          g.fillStyle(col, 0.35);
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
      if (k < 0) continue;
      const [base, light, dark] = d.reason === 'bomb' ? BOMB_COL : kindCol(d.kind);
      const x = d.x + bx;
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
