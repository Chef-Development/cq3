// The first finisher in the game gets its own moment (round 8, the first 10 minutes: docs/first-10.md). The swipe
// lands, the fight's clock holds (App.holdUntil: nothing moves, taps do nothing) and the stage goes dark behind
// letterbox bars; light gathers on the hero, "FINISHER" pops up and the finisher's name stamps in big, with what it
// does in three words under it. Then the bars open and the hero's usual show (view/finishers.ts) plays. Once per
// hero per profile (revealKey in profile.seen: Rowan's first, then Sable's, a chest hero's); the Test lab's
// first-fight scenario plays Rowan's on its own save.
import type Phaser from 'phaser';
import type { FightScene } from '../scene';
import { GAME_W, GAME_H } from '../layout';
import { textWidth } from '../font';
import { revealKey } from '../../data/tips';
import type { HeroId } from '../../data/heroes';
import { TextPool } from './ui';
import { clamp01, easeBack, easeOut3, INK, WHITE } from './shared';

/** The reveal's length (ms of wall time; the fight's clock is held for it). */
export const REVEAL_MS = 1500;
/** The calm beat after the show (fight seconds): no special and no red, so the bar the finisher cleared stays clear. */
export const REVEAL_CALM_SEC = 2.5;

const GOLD = 0xffd23a;
const DEPTH = 30; // over the HUD and the floaters, under the screen wipes and the tip card

export class FinisherReveal {
  private g: Phaser.GameObjects.Graphics | null = null;
  /** The dark over the stage's backdrop, under the actors (the hero and the foes stay lit): made when a reveal starts,
   *  at the top of the backdrop's container, and gone when it ends. */
  private dim: Phaser.GameObjects.Graphics | null = null;
  private texts: TextPool | null = null;
  private at = -1e9;
  private name = '';
  private line = '';
  private heroX = 60;
  private heroY = 100;

  constructor(private readonly s: FightScene) {}

  build(): void {
    this.g?.destroy();
    this.dim = null; // (the backdrop's container was just emptied)
    this.g = this.s.add.graphics().setDepth(DEPTH);
    this.texts = new TextPool(this.s, DEPTH + 1);
    this.at = -1e9;
  }

  /** Whether this finisher is the player's first in the game (or this hero's first), with tips on (it's part of the teaching: a player who
   *  turned tips off, and the tests, which run with tips off unless they ask, never get it); not at the Training
   *  Dummy, nor in the Test lab's gallery (a Test lab fight whose profile hasn't seen it: its first-fight scenario). */
  wanted(): boolean {
    const app = this.s.app;
    if (app.profile.tipsOff || (app.run.practice && !app.inLab) || this.s.gallery.active) return false;
    return !app.profile.seen.includes(this.key());
  }

  /** The mark of the fighting hero's reveal. */
  private key(): string {
    return revealKey((this.s.app.run.hero.build?.id ?? 'rowan') as HeroId);
  }

  /** Start it (marked seen at once): the clock holds for REVEAL_MS. */
  start(name: string, line: string, heroX: number, heroY: number): void {
    const app = this.s.app;
    app.profile.seen.push(this.key());
    app.saveProfile();
    this.at = performance.now();
    this.name = name.toUpperCase();
    this.line = line;
    this.heroX = heroX;
    this.heroY = heroY;
    app.holdUntil = this.at + REVEAL_MS;
    this.dim?.destroy();
    this.dim = this.s.add.graphics();
    this.s.back.add(this.dim);
    app.syncClock(this.at);
    this.s.later(380, () => app.audio.rareSting(true));
  }

  get active(): boolean {
    return performance.now() - this.at < REVEAL_MS + 200;
  }

  draw(now: number): void {
    const g = this.g;
    const T = this.texts;
    if (!g || !T) return;
    g.clear();
    T.begin();
    const t = now - this.at;
    if (t < 0 || t > REVEAL_MS + 200) {
      this.dim?.destroy();
      this.dim = null;
      return T.end();
    }
    const k = t / REVEAL_MS;
    // the bars and the dark: in over 180 ms, out over the last 200 (the show's sky takes over from there)
    const open = t > REVEAL_MS ? 1 - clamp01((t - REVEAL_MS) / 200) : easeOut3(clamp01(t / 180));
    const bar = Math.round(24 * open);
    // the stage behind the actors goes dark; the HUD and the bar dim a little (over them)
    this.dim?.clear().fillStyle(INK, 0.6 * open).fillRect(-20, -20, GAME_W + 40, GAME_H + 40);
    g.fillStyle(INK, 0.3 * open);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // light gathering on the hero: rays drawn in toward them, a glow that swells
    const hx = this.heroX;
    const hy = this.heroY;
    if (t < REVEAL_MS) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + i * 0.37;
        const q = (k * 1.6 + i * 0.13) % 1; // each ray slides in, then the next
        const r0 = 130 * (1 - q) + 10;
        const r1 = r0 + 18 + 10 * (i % 3);
        g.lineStyle(i % 2 ? 1 : 2, i % 3 ? GOLD : WHITE, 0.25 + 0.5 * q * open);
        g.lineBetween(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0 * 0.7, hx + Math.cos(a) * r1, hy + Math.sin(a) * r1 * 0.7);
      }
      // rings closing in on the hero, one after another (never a fill over them: they stay lit)
      for (let i = 0; i < 3; i++) {
        const q = (k * 2.2 + i / 3) % 1;
        const r = 34 * (1 - easeOut3(q)) + 12;
        g.lineStyle(1, i % 2 ? WHITE : GOLD, 0.7 * q * open);
        g.strokeEllipse(hx, hy, r * 1.4, r * 1.9);
      }
      // and behind them, a pool of light on the ground (in the backdrop's dark, under the actors)
      const swell = 10 + 16 * easeOut3(clamp01(k / 0.8));
      this.dim?.fillStyle(GOLD, 0.22 * open).fillEllipse(hx, hy, swell * 2.4, swell * 3.2);
      this.dim?.fillStyle(WHITE, 0.18 * open).fillEllipse(hx, hy + 2, swell * 1.2, swell * 1.8);
    }
    // the HUD's plates poking out under the top bar fade further back
    g.fillStyle(INK, 0.5 * open);
    g.fillRect(0, bar, GAME_W, Math.max(0, 38 - bar));
    // the letterbox
    g.fillStyle(0x000000, 1);
    g.fillRect(0, 0, GAME_W, bar);
    g.fillRect(0, GAME_H - bar, GAME_W, bar);
    g.fillStyle(GOLD, open);
    g.fillRect(0, bar, GAME_W, 1);
    g.fillRect(0, GAME_H - bar - 1, GAME_W, 1);
    const cx = Math.round(GAME_W / 2 + 34); // (over the foes' side, clear of the hero)
    // "FINISHER" first, then the name stamps in (big, over-shooting back to size) with a white flash, then the line
    if (t > 150) {
      const a = clamp01((t - 150) / 120) * open;
      T.text('FINISHER', cx, 31, GOLD, { bold: true, ox: 0.5, oy: 0.5, alpha: a, scale: 1 });
    }
    const stamp = 380;
    if (t > stamp) {
      const q = clamp01((t - stamp) / 260);
      const fit = Math.max(1, Math.min(3, Math.floor((GAME_W - 150) / Math.max(1, textWidth(this.name, 1, true)))));
      const sc = Math.max(1, Math.round(fit * (1 + 0.8 * (1 - easeBack(q)))));
      T.text(this.name, cx, 50, 0xfff07a, { bold: true, ox: 0.5, oy: 0.5, alpha: open, scale: sc, extrude: 2, extrudeCol: 0x8a4a10 });
      if (t - stamp < 90) {
        g.fillStyle(WHITE, 0.5 * (1 - (t - stamp) / 90));
        g.fillRect(0, 0, GAME_W, GAME_H);
      }
    }
    if (t > 760 && this.line) T.text(this.line, cx, 69, WHITE, { ox: 0.5, oy: 0.5, alpha: clamp01((t - 760) / 160) * open });
    T.end();
  }
}
