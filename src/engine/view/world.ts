// The kingdom's world map (between runs): the painted island (art-world.ts), Greenmarch glowing and ready, the
// other regions behind padlocks, a flag per Greenmarch act cleared, and the Great Pendulum's weights counter.
// Tap Greenmarch to start a run; a locked region just rattles its padlock.
import type Phaser from 'phaser';
import { WEIGHTS_TOTAL } from '../../core/progress';
import type { FightScene } from '../scene';
import { GREENMARCH_FLAGS, WORLD_CAPITAL, WORLD_REGIONS } from '../art-world';
import { textWidth } from '../font';
import { GAME_H } from '../layout';
import { rows } from './pixels';
import { INK, WHITE } from './shared';
import { darkPanel, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

export class WorldView {
  private g!: G;
  private map: Phaser.GameObjects.Image | null = null;
  private locks: Phaser.GameObjects.Image[] = [];
  private flags: Phaser.GameObjects.Image[] = [];
  private texts: TextPool;
  private rattle = new Map<string, number>();
  private chosenAt = 0;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 31);
  }

  build(): void {
    const s = this.s;
    this.map?.destroy();
    this.map = s.add.image(0, 0, 'world_map').setOrigin(0, 0).setDepth(30.1).setVisible(false);
    for (const i of [...this.locks, ...this.flags]) i.destroy();
    this.locks = WORLD_REGIONS.filter((r) => r.locked).map(() => s.add.image(0, 0, 'padlock').setOrigin(0.5, 0.5).setDepth(30.6).setVisible(false));
    this.flags = GREENMARCH_FLAGS.map(() => s.add.image(0, 0, 'flag_off').setOrigin(0.5, 1).setDepth(30.6).setVisible(false));
    this.g?.destroy();
    this.g = s.add.graphics().setDepth(30.4);
  }

  /** Greenmarch's spot on the map (tests tap it). */
  greenmarch(): { x: number; y: number } {
    return { x: WORLD_REGIONS[0].x, y: WORLD_REGIONS[0].y };
  }

  private regionAt(x: number, y: number) {
    let best: (typeof WORLD_REGIONS)[number] | null = null;
    let bestD = 26;
    for (const r of WORLD_REGIONS) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD) (best = r), (bestD = d);
    }
    return best;
  }

  /** A tap on the world map (x < 0: the keyboard picks Greenmarch). */
  tap(x: number, y: number): void {
    const s = this.s;
    const r = x < 0 ? WORLD_REGIONS[0] : this.regionAt(x, y);
    if (!r || this.chosenAt) return;
    if (r.locked) {
      this.rattle.set(r.id, performance.now());
      s.app.audio.uiClick();
      return;
    }
    // into Greenmarch: a flash of light over the region, then the run begins
    this.chosenAt = performance.now();
    s.app.audio.mapSelect();
    s.fx.ring(r.x, r.y, 24, 0xfff0a0, false);
    s.fx.burst(r.x, r.y, 0xfff0a0, 14, false, 1.2, true);
    window.setTimeout(() => {
      this.chosenAt = 0;
      if (s.app.run.phase === 'world') s.app.startRegion();
    }, 420);
  }

  private hide(): void {
    this.g.clear();
    this.map?.setVisible(false);
    for (const i of [...this.locks, ...this.flags]) i.setVisible(false);
    this.texts.hide();
  }

  draw(now: number): void {
    const s = this.s;
    if (s.app.run.phase !== 'world') return this.hide();
    const g = this.g;
    g.clear();
    this.texts.begin();
    this.map?.setVisible(true);
    const P = s.app.progress;

    // regions: Greenmarch glows and bobs a "Play" plate; the locked ones wear padlocks
    let li = 0;
    for (const r of WORLD_REGIONS) {
      if (r.locked) {
        const since = now - (this.rattle.get(r.id) ?? -1e9);
        const shake = since < 300 ? Math.round(Math.sin(since / 25) * 2) : 0;
        this.locks[li++]?.setPosition(r.x + shake, r.y - 2).setVisible(true);
        this.label(g, r.name, r.x, r.y + 13, since < 900 ? 0xff9a8a : 0xc8ccd8, since < 900 ? 'Locked' : '');
        continue;
      }
      const k = (now % 1100) / 1100;
      g.fillStyle(0xfff0a0, 0.45 - 0.35 * k);
      g.fillCircle(r.x, r.y, 12 + 8 * k);
      const bob = Math.floor(now / 350) % 2;
      this.label(g, r.name, r.x, r.y - 20 - bob, 0xffe680, P.actsCleared >= 3 ? 'Cleared!' : P.actsCleared > 0 ? `Act ${P.actsCleared + 1} next` : 'Tap to begin');
    }
    // a flag on Greenmarch per act cleared
    GREENMARCH_FLAGS.forEach((f, i) => {
      this.flags[i]?.setTexture(i < P.actsCleared ? 'flag_on' : 'flag_off').setPosition(f.x, f.y).setVisible(true);
    });
    // the Great Pendulum
    const c = WORLD_CAPITAL;
    this.label(g, 'Great Pendulum', c.x, c.y + 11, 0xf2c230, '');

    // header: the kingdom and the weights recovered
    const L = s.L + 4;
    darkPanel(g, { x: L, y: 4, w: 100, h: 24 }, 0x1e1630, 0.92);
    this.texts.text('The Kingdom', L + 8, 11, WHITE, { bold: true, oy: 0.5 });
    this.texts.text(`Weights home: ${P.weights}/${WEIGHTS_TOTAL}`, L + 8, 21, 0xf2c230, { oy: 0.5 });
    this.texts.end();
  }

  /** A small dark name plate (and an optional second line under it). */
  private label(g: G, name: string, x: number, y: number, color: number, sub: string): void {
    const w = Math.max(textWidth(name, 1, true), sub ? textWidth(sub, 1, false) : 0) + 10;
    const h = sub ? 21 : 13;
    const lx = Math.round(Math.max(this.s.L + 2, Math.min(this.s.R - w - 2, x - w / 2)));
    const ly = Math.round(Math.max(2, Math.min(GAME_H - h - 2, y - h / 2)));
    rows(g, lx - 1, ly + 1, w + 2, h + 2, 2, INK, 0.4);
    rows(g, lx - 1, ly - 1, w + 2, h + 2, 2, INK, 0.9);
    rows(g, lx, ly, w, h, 2, 0x2a2240, 0.92);
    this.texts.text(name, lx + w / 2, ly + 6.5, color, { bold: true, ox: 0.5, oy: 0.5 });
    if (sub) this.texts.text(sub, lx + w / 2, ly + 15, WHITE, { ox: 0.5, oy: 0.5 });
  }
}
