// The title screen's key art (art in art-title-key.ts; the logo in art-title.ts): a dusk over the kingdom with the
// world being erased on its right (the land drains into an ink drawing, then blank vellum; a giant quill hangs over
// the blank), the hero on a cliff in the foreground looking out, the logo (built from GAME_NAME) dropping in over a
// glow. Alive: light rays breathe from the low sun, cloud wisps drift, the ink front crawls and sheds flecks of paper,
// the quill's nib glows and draws, motes rise off the land, the hero breathes, Pip flutters. The band below holds
// Continue / New game or the start prompt (no tutorial strip: the first fight teaches). Everything from `now`.
import type Phaser from 'phaser';
import { KEY_H, KEY_HERO, KEY_QUILL, KEY_SUN, KEY_W, keyEdge } from '../art-title-key';
import { buildTitleArt } from '../art-title';
import { HERO_FEET_X, HERO_H, HERO_W } from '../art';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { chevron, GOLD } from './pixels';
import { clamp01, easeBack, mix, pulse, WHITE, type Rect } from './shared';
import type { TextPool } from './ui';
import { glass } from './ui-modern';
import type { FightScene } from '../scene';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

/** When each piece of the title has arrived (ms after it appears). */
export const TITLE_IN = { hero: 260, logo: 560, prompt: 700 };
/** The key art's depths: over the stage and the bar's band, under the menus' graphics (gTop is 30). */
const D_KEY = 29.8;
const D_QUILL = 29.85;
/** A seeded 0..1. */
const rnd = (a: number, b: number) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export class TitleScreen {
  private imgs: Img[] = [];
  private key: Img | null = null;
  private clouds: Img[] = [];
  private quill: Img | null = null;
  private hero: Img | null = null;
  private pip: Img | null = null;
  private logo: Img | null = null;
  private shine: Img | null = null;
  private shineN = 0;
  /** The erasing front's x per row. */
  private readonly edge = Array.from({ length: KEY_H }, (_, y) => keyEdge(y));

  constructor(private readonly s: FightScene) {}

  /** (Re)build the textures and images (a new layout). */
  build(): void {
    const s = this.s;
    this.shineN = buildTitleArt(s);
    for (const o of this.imgs) o.destroy();
    const mk = (key: string, depth: number) => {
      const im = s.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth).setVisible(false);
      this.imgs.push(im);
      return im;
    };
    this.imgs = [];
    this.key = mk('title_key', D_KEY);
    this.clouds = [mk('title_cloud0', D_KEY + 0.01), mk('title_cloud1', D_KEY + 0.01)];
    this.quill = mk('title_quill', D_QUILL);
    this.hero = mk('hero_idle0', 31.3).setOrigin(HERO_FEET_X / HERO_W, (HERO_H - 1) / HERO_H);
    this.pip = mk(s.textures.exists('pip_idle0') ? 'pip_idle0' : 'hero_idle0', 31.31).setOrigin(0.5, 0.5);
    this.logo = mk('title_logo', 31.6);
    this.shine = mk('title_logo_shine_0', 31.7);
  }

  hide(): void {
    for (const o of this.imgs) o.setVisible(false);
  }

  /** The key art, the hero and the logo. `g` is under the hero and the logo, `gc` over the hero (the plates). */
  draw(g: G, gc: G, now: number, since: number): { logoBottom: number } {
    for (const o of this.imgs) o.setVisible(true);
    this.shine?.setVisible(false);
    this.key?.setPosition(0, 0);
    const W = GAME_W;
    // cloud wisps drifting east, slowly, high in the sky (they pass under the blank's paper: drawn only in the colour)
    this.clouds.forEach((c, i) => {
      const span = KEY_W + 80;
      const x = Math.round((((now / 1000) * (1.6 + i * 0.7) + i * 170) % span) - 60);
      const y = i ? 44 : 26;
      c.setPosition(x, y).setVisible(x + c.width < this.edge[y] - 4);
    });
    this.drawRays(g, now);
    this.drawFront(g, now);
    this.drawMotes(g, now);

    // the quill hangs over the blank, bobbing; its nib glows gold and draws a line down the front
    const qb = Math.round(Math.sin(now / 760) * 1.5);
    const qx = KEY_QUILL.x + Math.round(Math.sin(now / 1300) * 1);
    const qy = KEY_QUILL.y + qb;
    this.quill?.setPosition(qx, qy);
    const nx = qx + KEY_QUILL.nibX;
    const ny = qy + KEY_QUILL.nibY;
    const gp = 0.55 + 0.45 * pulse(now, 700);
    g.fillStyle(0xffd860, 0.35 * gp);
    g.fillRect(nx - 2, ny - 1, 5, 3);
    g.fillStyle(0xfff0a0, gp);
    g.fillRect(nx, ny, 1, 1);
    const cyc = (now % 2600) / 2600;
    const len = Math.round(Math.min(1, cyc * 1.6) * 12);
    for (let k = 1; k <= len; k++) {
      const a = (1 - k / 14) * (cyc < 0.85 ? 1 : (1 - cyc) / 0.15);
      g.fillStyle(k % 3 ? 0xf2c230 : 0xfff0a0, a);
      g.fillRect(nx - Math.round(Math.sin(k * 0.6) * 1.5), ny + k, 1, 1);
    }

    // the hero on the cliff, looking out; Pip flutters by his shoulder
    const hk = easeBack(since / TITLE_IN.hero, 1.6);
    const { x: hx, y: hy } = KEY_HERO;
    const four = this.s.textures.exists('hero_idle3');
    const frame = four ? `hero_idle${Math.floor(now / 300) % 4}` : Math.floor(now / 450) % 2 ? 'hero_idle1' : 'hero_idle0';
    this.hero?.setTexture(frame).setPosition(hx, hy - Math.round((1 - hk) * 8)).setAlpha(clamp01(since / 160));
    const pk = clamp01((since - 120) / 300);
    if (this.s.textures.exists('pip_idle1')) this.pip?.setTexture(Math.floor(now / 160) % 2 ? 'pip_idle1' : 'pip_idle0');
    this.pip?.setPosition(hx + 22 + Math.round(Math.sin(now / 900) * 2), hy - 36 + Math.round(Math.sin(now / 340) * 2) - Math.round((1 - pk) * 20)).setAlpha(pk);

    // the logo drops in with a bounce over a glow, bobs gently; a gleam crosses it every few seconds
    const lw = this.logo?.width ?? 160;
    const lh = this.logo?.height ?? 50;
    const lk = easeBack((since - 120) / (TITLE_IN.logo - 120), 1.5);
    const lx = Math.round(W / 2 - lw / 2) - 6;
    const ly = Math.round(14 - (1 - lk) * 70 + Math.sin(now / 700) * 1.2);
    const la = clamp01((since - 120) / 160);
    this.logoGlow(g, lx + lw / 2, ly + lh / 2, lw, lh, now, la);
    this.logo?.setPosition(lx, ly).setAlpha(la);
    const gleam = now % 4200;
    const sf = Math.floor(gleam / 50);
    if (since > TITLE_IN.logo && sf < this.shineN) this.shine?.setTexture(`title_logo_shine_${sf}`).setPosition(lx, ly).setVisible(true);
    const t0 = this.shineN * 50;
    if (since > TITLE_IN.logo && gleam >= t0 && gleam < t0 + 420) {
      const q = (gleam - t0) / 420;
      star(gc, lx + lw - 14, ly + lh - 22, q < 0.4 ? 3 : q < 0.7 ? 2 : 1, 0xfff6c0, 1 - q);
    }
    return { logoBottom: ly + lh };
  }

  /** A dark halo behind the logo (it reads on any sky) and a warm glow breathing in it. */
  private logoGlow(g: G, cx: number, cy: number, lw: number, lh: number, now: number, a: number): void {
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x140c1c, 0.16 * a);
      g.fillEllipse(Math.round(cx), Math.round(cy + 2), lw + 30 - i * 14, lh + 16 - i * 8);
    }
    const p = pulse(now, 1600);
    g.fillStyle(0xffc860, (0.07 + 0.05 * p) * a);
    g.fillEllipse(Math.round(cx), Math.round(cy), lw - 10, lh - 8);
  }

  /** Light rays fanning up from the low sun, breathing (only over the colour: the blank has no light). */
  private drawRays(g: G, now: number): void {
    const { x: sx, y: sy } = KEY_SUN;
    for (let i = 0; i < 7; i++) {
      const base = -Math.PI * (0.16 + i * 0.115) + Math.sin(now / 5000 + i) * 0.03;
      const wid = 0.035 + (i % 2) * 0.02;
      const len = 120 + (i % 3) * 40;
      const a = (0.05 + 0.04 * Math.sin(now / 1300 + i * 1.7)) * (i % 2 ? 0.8 : 1);
      const x1 = sx + Math.cos(base - wid) * len;
      const y1 = sy + Math.sin(base - wid) * len;
      const x2 = sx + Math.cos(base + wid) * len;
      const y2 = sy + Math.sin(base + wid) * len;
      if (Math.max(x1, x2) > this.edge[Math.max(0, Math.min(KEY_H - 1, Math.round(Math.min(y1, y2))))]) continue;
      g.fillStyle(0xffd890, a);
      g.fillTriangle(sx, sy, Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
    }
  }

  /** The erasing front alive: ink crawling along it in a slow wave, flecks of paper peeling off into the colour. */
  private drawFront(g: G, now: number): void {
    const wave = ((now / 22) % (KEY_H + 40)) - 20;
    for (let y = 0; y < KEY_H; y++) {
      const ex = this.edge[y];
      const near = Math.max(0, 1 - Math.abs(y - wave) / 10);
      const flick = rnd(y, Math.floor(now / 140)) < 0.25 + near * 0.5;
      if (!flick) continue;
      const reach = 2 + Math.round(near * 4 + rnd(y, 7) * 2);
      g.fillStyle(0x1a1026, 0.9);
      g.fillRect(ex - reach, y, reach - 1, 1);
    }
    for (let i = 0; i < 16; i++) {
      const per = 2600 + i * 310;
      const q = (((now + i * 977) % per) + per) % per / per;
      const y0 = Math.round(8 + rnd(i, 3) * (KEY_H - 20));
      const x = Math.round(this.edge[y0] - 2 - q * (26 + (i % 4) * 8));
      const y = Math.round(y0 - q * 12 + Math.sin(q * 6 + i) * 2);
      const a = Math.sin(Math.min(1, q * 1.4) * Math.PI);
      g.fillStyle(0xf6f4f8, a);
      g.fillRect(x, y, i % 3 ? 2 : 3, 1);
      g.fillStyle(0x4a3a5e, a * 0.8);
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  /** Gold motes rising off the living land. */
  private drawMotes(g: G, now: number): void {
    for (let i = 0; i < 14; i++) {
      const per = 3000 + i * 420;
      const q = (((now + i * 1531) % per) + per) % per / per;
      const x = Math.round(10 + ((i * 41) % 200) + Math.sin(q * 5 + i) * 3);
      const y = Math.round(128 - ((i * 23) % 40) - q * 30);
      if (x > this.edge[Math.max(0, Math.min(KEY_H - 1, y))] - 6) continue;
      const a = Math.sin(q * Math.PI) * 0.9;
      g.fillStyle(i % 3 ? 0xfff0a0 : 0xffa858, a);
      g.fillRect(x, y, 1, 1);
    }
  }

  /**
   * The start prompt on a glass plate (the Continue / New game buttons are drawn by the overlays).
   */
  drawPrompt(gc: G, texts: TextPool, text: string, cy: number, now: number, alpha: number): void {
    const w = textWidth(text, 2, true);
    const p = pulse(now, 900);
    const cx = Math.round(GAME_W / 2);
    const r: Rect = { x: cx - Math.round(w / 2) - 34, y: cy - 11, w: w + 68, h: 26 }; // (room for the descenders: the p of "Tap")
    glass(gc, r, { alpha: 0.9 * alpha, clear: 0.2 });
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const k = ((now / 600 + i / 3) % 1 + 1) % 1;
        const x = Math.round(cx + side * (w / 2 + 26 - k * 14));
        chevron(gc, x, cy - 5, 11, i === 0 ? GOLD[4] : GOLD[3], alpha * Math.sin(k * Math.PI), -side, true);
      }
    texts.text(text, cx, cy, mix(WHITE, 0xfff0a0, 0.5 * p), { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: alpha * (0.85 + 0.15 * p), extrude: 1, extrudeCol: 0x3a1c18 });
  }

}

/** A four-point twinkle. */
function star(g: G, x: number, y: number, size: number, col: number, alpha: number): void {
  g.fillStyle(col, alpha);
  g.fillRect(x - size, y, size * 2 + 1, 1);
  g.fillRect(x, y - size, 1, size * 2 + 1);
  if (size >= 2) {
    g.fillStyle(WHITE, alpha);
    g.fillRect(x - 1, y - 1, 3, 3);
  }
}
