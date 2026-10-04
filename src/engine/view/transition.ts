// Screen transitions between phases: a diagonal shutter wipe between screens and a diamond iris opening into a
// fight. The new screen is already live underneath (the phase changed on the tap); the cover starts closed and
// sweeps away in about 300 ms, so it never slows play. Overlays that come in over the same scene (the boost
// pick after a fight, the defeat screen, the chest's boost) get no wipe: their panels animate in themselves.
import type Phaser from 'phaser';
import type { Phase } from '../../core/run';
import type { FightScene } from '../scene';
import { GAME_H, GAME_W } from '../layout';
import { GOLD, NAVY } from './pixels';
import { clamp01, INK, WHITE } from './shared';

export type TransitionKind = 'wipe' | 'iris';

/** Total length (ms), and how long the cover holds fully closed before it opens. */
const MS: Record<TransitionKind, number> = { wipe: 300, iris: 330 };
const HOLD = 30;

/** Which transition a phase change gets (null: none). */
export function transitionFor(prev: Phase, next: Phase): TransitionKind | null {
  if (prev === next) return null;
  if (prev === 'fight' && (next === 'boost' || next === 'defeat')) return null;
  if (prev === 'treasure' && next === 'boost') return null;
  if (prev === 'boost' && next === 'actClear') return null;
  if (next === 'fight') return 'iris';
  return 'wipe';
}

export class Transition {
  private g: Phaser.GameObjects.Graphics | null = null;
  private kind: TransitionKind | null = null;
  private at = -1e9;

  constructor(private readonly s: FightScene) {}

  onPhase(prev: Phase, next: Phase): void {
    const k = transitionFor(prev, next);
    if (!k) return;
    this.kind = k;
    this.at = performance.now();
  }

  /** True while a transition covers part of the screen. */
  active(now: number): boolean {
    return !!this.kind && now - this.at < MS[this.kind];
  }

  draw(now: number): void {
    this.g ??= this.s.add.graphics().setDepth(40);
    const g = this.g;
    g.clear();
    if (!this.kind) return;
    const age = now - this.at;
    if (age >= MS[this.kind]) {
      this.kind = null;
      return;
    }
    // fast off the mark, settling at the end (reads as a slash, not a fade to black)
    const t = clamp01((age - HOLD) / (MS[this.kind] - HOLD));
    const k = this.kind === 'wipe' ? 1 - (1 - t) ** 2.2 : Math.sin((t * Math.PI) / 2);
    if (this.kind === 'wipe') this.wipe(g, k);
    else this.iris(g, k, age);
  }

  /** A slanted shutter sweeping off to the right: gold leading edge, speed streaks, echo stripes behind it. */
  private wipe(g: Phaser.GameObjects.Graphics, k: number): void {
    const W = GAME_W;
    const H = GAME_H;
    const slant = 0.45;
    const span = W + H * slant + 30;
    const e = -H * slant - 12 + span * k;
    for (let y = 0; y < H; y++) {
      const x = Math.round(e + (H - y) * slant);
      if (x >= W) continue;
      const x0 = Math.max(0, x);
      // echo stripes in the revealed area
      for (const [d, a] of [
        [10, 0.55],
        [20, 0.25],
      ] as const) {
        const ex = x - d;
        if (ex + 2 > 0 && ex < W) {
          g.fillStyle(GOLD[3], a);
          g.fillRect(Math.max(0, ex), y, 2, 1);
        }
      }
      g.fillStyle(WHITE, 0.95);
      if (x >= 0) g.fillRect(x0, y, 1, 1);
      g.fillStyle(GOLD[3], 1);
      g.fillRect(Math.max(0, x + 1), y, 2, 1);
      g.fillStyle(GOLD[1], 1);
      g.fillRect(Math.max(0, x + 3), y, 1, 1);
      g.fillStyle(INK, 1);
      g.fillRect(Math.max(0, x + 4), y, W, 1);
      // the cover's body: deep navy with slow diagonal bands
      g.fillStyle(NAVY[1], 1);
      g.fillRect(Math.max(0, x + 5), y, W, 1);
    }
    // speed streaks inside the cover, just behind the edge
    g.fillStyle(NAVY[4], 1);
    for (let i = 0; i < 9; i++) {
      const y = Math.round(8 + i * 16.5 + ((i * 7) % 5));
      const x = Math.round(e + (H - y) * slant) + 10 + ((i * 13) % 17);
      const len = 14 + ((i * 29) % 26);
      if (x < W) g.fillRect(Math.max(0, x), y, len, 1);
    }
  }

  /** A diamond opening from the middle of the stage, gold-rimmed, with a white flash at the start. */
  private iris(g: Phaser.GameObjects.Graphics, k: number, age: number): void {
    const W = GAME_W;
    const H = GAME_H;
    const cx = Math.round(W / 2);
    const cy = Math.round(this.s.splitY / 2) + 6;
    const rMax = W / 2 + Math.max(cy, H - cy) * 2 + 8;
    const r = rMax * k;
    for (let y = 0; y < H; y++) {
      const hw = Math.round(r - Math.abs(y - cy) * 2);
      g.fillStyle(NAVY[1], 1);
      if (hw <= 0) {
        g.fillRect(0, y, W, 1);
        continue;
      }
      const l = cx - hw;
      const rr = cx + hw;
      if (l > 0) g.fillRect(0, y, l - 3, 1);
      if (rr < W) g.fillRect(rr + 3, y, W - rr - 3, 1);
      g.fillStyle(GOLD[3], 1);
      g.fillRect(l - 3, y, 2, 1);
      g.fillRect(rr + 1, y, 2, 1);
      g.fillStyle(WHITE, 1);
      g.fillRect(l - 1, y, 1, 1);
      g.fillRect(rr, y, 1, 1);
    }
    // the opening flashes white as it starts to open
    const fk = (age - HOLD) / 120;
    if (fk >= 0 && fk < 1) {
      g.fillStyle(WHITE, 0.7 * (1 - fk));
      for (let y = 0; y < H; y++) {
        const hw = Math.round(r - Math.abs(y - cy) * 2);
        if (hw > 0) g.fillRect(cx - hw, y, hw * 2, 1);
      }
    }
  }
}
