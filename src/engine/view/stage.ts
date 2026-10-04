// The stage behind the fighters: per-level backdrop, drifting clouds, framing trees, and ambient life
// (flickering torches, leaves, motes, rain, embers).
import Phaser from 'phaser';
import type { FightScene } from '../scene';
import { buildBackdrops, type Backdrop, type Theme } from '../backdrop';
import { GAME_W } from '../layout';
import { rand, type Ambient } from './shared';

export class Stage {
  private backdrops = {} as Record<Theme, Backdrop>;
  private theme: Theme = 'forest';
  private ambient: Ambient[] = [];
  private nextAmbient = 0;
  private clouds: Phaser.GameObjects.Image[] = [];
  private bgImg!: Phaser.GameObjects.Image;
  private fgImg!: Phaser.GameObjects.Image;
  private frameImg!: Phaser.GameObjects.Image;
  private gBack!: Phaser.GameObjects.Graphics;
  private gAmb!: Phaser.GameObjects.Graphics;

  constructor(private readonly s: FightScene) {}

  clearAmbient(): void {
    this.ambient = [];
  }

  /** Regenerate the backdrop textures (before the images are created). */
  buildTextures(): void {
    this.backdrops = buildBackdrops(this.s, GAME_W, this.s.splitY, this.s.ground);
  }

  /** Backdrop, clouds, framing trees and the torch layer go in the back container; the foreground in front. */
  build(): void {
    const s = this.s;
    this.bgImg = s.add.image(0, 0, 'bg_forest').setOrigin(0, 0);
    s.back.add(this.bgImg);
    this.clouds = [0, 1].map((i) => s.add.image(i * GAME_W, 4, 'clouds').setOrigin(0, 0).setAlpha(0.95));
    s.back.add(this.clouds);
    // framing trees/canopies drawn over the drifting clouds
    this.frameImg = s.add.image(0, 0, 'frame_forest').setOrigin(0, 0);
    s.back.add(this.frameImg);
    this.gBack = s.add.graphics();
    s.back.add(this.gBack);
    this.fgImg = s.add.image(0, 0, 'fg_forest').setOrigin(0, 0);
    this.gAmb = s.add.graphics();
    s.front.add([this.gAmb, this.fgImg]);
  }

  /** Each level has its own backdrop (tuning.levels[i].theme; default: forest first, then ruins). */
  applyTheme(): void {
    const run = this.s.app.run;
    const theme: Theme = run.level.theme ?? (run.levelIndex === 0 ? 'forest' : 'ruins');
    if (!this.backdrops[theme]) return;
    this.theme = theme;
    this.ambient = [];
    this.bgImg.setTexture(`bg_${theme}`);
    this.fgImg.setTexture(`fg_${theme}`);
    this.frameImg.setTexture(`frame_${theme}`);
    for (const cl of this.clouds) {
      if (theme === 'ruins') cl.setTint(0x6a7090).setAlpha(0.45);
      else cl.clearTint().setAlpha(0.95);
    }
  }

  driftClouds(now: number): void {
    const drift = (now * 0.004) % GAME_W;
    this.clouds[0].setX(Math.round(-drift));
    this.clouds[1].setX(Math.round(GAME_W - drift));
  }

  /** Living backdrop: torches flicker; leaves, motes, rain and embers drift through the scene. */
  drawAmbient(): void {
    const a = this.s.anim;
    const ground = this.s.ground;
    const gb = this.gBack;
    const g = this.gAmb;
    gb.clear();
    g.clear();
    const theme = this.theme;
    for (const t of this.backdrops[theme]?.torches ?? []) {
      const f = Math.sin(a / 70 + t.x) * 0.5 + Math.sin(a / 33 + t.x * 3) * 0.5;
      gb.fillStyle(0xffa040, 0.1);
      gb.fillCircle(t.x + 0.5, t.y - 2, 15 + f * 2);
      gb.fillStyle(0xffc060, 0.14);
      gb.fillCircle(t.x + 0.5, t.y - 2, 9 + f);
      const fh = 6 + Math.round(f * 1.5);
      gb.fillStyle(0xe8441a, 1);
      gb.fillRect(t.x - 2, t.y - fh + 2, 5, fh - 1);
      gb.fillStyle(0xff9a2a, 1);
      gb.fillRect(t.x - 1, t.y - fh, 3, fh);
      gb.fillRect(t.x + (Math.floor(a / 90) % 2 ? -2 : 2), t.y - fh + 3, 1, 2);
      gb.fillStyle(0xfff0a0, 1);
      gb.fillRect(t.x, t.y - fh + 2, 1, fh - 3);
      if (Math.random() < 0.04) this.ambient.push({ kind: 'ember', x: t.x + rand(-1, 1), y: t.y - fh, vx: rand(-6, 6), vy: rand(-26, -14), born: a, life: rand(500, 900), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, phase: 0 });
    }
    // spawn
    const W = GAME_W;
    const top = 0;
    const bottom = ground + 4;
    while (a >= this.nextAmbient) {
      if (this.nextAmbient === 0) this.nextAmbient = a;
      if (theme === 'forest') {
        if (Math.random() < 0.3)
          this.ambient.push({ kind: 'leaf', x: rand(0, W), y: top - 2, vx: rand(4, 14), vy: rand(10, 18), born: a, life: 9000, color: [0x5aa84c, 0x8ac850, 0xe8c048][Math.floor(Math.random() * 3)], phase: rand(0, 6) });
        else this.ambient.push({ kind: 'mote', x: rand(20, W - 20), y: rand(30, bottom), vx: rand(-3, 3), vy: rand(-6, -2), born: a, life: rand(2500, 4500), color: Math.random() < 0.6 ? 0xffffff : 0xfff0a0, phase: rand(0, 6) });
        this.nextAmbient += 260;
      } else {
        this.ambient.push({ kind: 'rain', x: rand(-20, W), y: rand(-10, 20), vx: 50, vy: 260, born: a, life: 900, color: 0x9ab8e8, phase: 0 });
        this.nextAmbient += 22;
      }
    }
    for (let i = this.ambient.length - 1; i >= 0; i--) {
      const p = this.ambient[i];
      const age = a - p.born;
      const t = age / 1000;
      let x = p.x + p.vx * t;
      const y = p.y + p.vy * t;
      if (age > p.life || y > bottom + 6 || x > W + 10) {
        if (p.kind === 'rain' && y > bottom - 10) {
          g.fillStyle(0xb8d0f0, 0.5);
          g.fillRect(Math.round(x) - 1, Math.round(ground - rand(0, 8)), 1, 1);
          g.fillRect(Math.round(x) + 1, Math.round(ground - rand(0, 8)), 1, 1);
        }
        this.ambient.splice(i, 1);
        continue;
      }
      if (p.kind === 'leaf') {
        x += Math.sin(t * 2.4 + p.phase) * 6;
        const flat = Math.floor(t * 4 + p.phase) % 2 === 0;
        g.fillStyle(p.color, 1);
        g.fillRect(Math.round(x), Math.round(y), flat ? 2 : 1, flat ? 1 : 2);
      } else if (p.kind === 'mote') {
        const k = age / p.life;
        g.fillStyle(p.color, Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(t * 6 + p.phase)));
        g.fillRect(Math.round(x + Math.sin(t * 1.5 + p.phase) * 3), Math.round(y), 1, 1);
      } else if (p.kind === 'rain') {
        g.fillStyle(p.color, 0.45);
        g.fillRect(Math.round(x), Math.round(y), 1, 3);
        g.fillRect(Math.round(x + 1), Math.round(y + 3), 1, 2);
      } else {
        const k = age / p.life;
        g.fillStyle(p.color, 1 - k);
        g.fillRect(Math.round(x + Math.sin(t * 8 + p.x) * 1.5), Math.round(y), 1, 1);
      }
    }
    if (this.ambient.length > 160) this.ambient.splice(0, this.ambient.length - 160);
  }
}
