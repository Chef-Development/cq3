// The title screen's key art (art in art-title.ts): the Great Atlas spread open, fog drifting in from the erased east,
// the hero standing where the colour has come back, a red route drawing itself east into the fog with a quill at its
// tip, the logo (built from GAME_NAME) dropping in with a gleam now and then. The band below (Continue / New game or
// the start prompt, and the legend of blocks) sits on glass plates over the map. Everything animates from `now`.
import type Phaser from 'phaser';
import { buildTitleArt, fogness, TITLE_HERO, TITLE_ROUTE } from '../art-title';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { brick, chevron, GOLD } from './pixels';
import { clamp01, COL, easeBack, easeOut3, INK, mix, pulse, WHITE, type Rect } from './shared';
import type { TextPool } from './ui';
import { glass } from './ui-modern';
import type { FightScene } from '../scene';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

/** When each piece of the title has arrived (ms after it appears). */
export const TITLE_IN = { hero: 260, logo: 560, route: 500, routeMs: 1700, prompt: 700 };
/** The key art's depths: over the stage and the bar's band, under the menus' graphics (gTop is 30). */
const D_ATLAS = 29.8;
const D_FOG = 29.85;

/** The route as points one px apart (for the dashes and the quill). */
function routePts(): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < TITLE_ROUTE.length - 1; i++) {
    const [x0, y0] = TITLE_ROUTE[i];
    const [x1, y1] = TITLE_ROUTE[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k < n; k++) out.push([Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n)]);
  }
  return out;
}

export class TitleScreen {
  private imgs: Img[] = [];
  private atlas: Img | null = null;
  private fogR: Img | null = null;
  private fogR2: Img | null = null;
  private fogT: Img | null = null;
  private hero: Img | null = null;
  private pip: Img | null = null;
  private logo: Img | null = null;
  private shine: Img | null = null;
  private shineN = 0;
  private readonly route = routePts();
  /** The route's fade into the fog, per point (0..1 opacity). */
  private readonly routeA = this.route.map(([x, y]) => 1 - clamp01((fogness(x, y) - 0.25) / 0.4));

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
    this.atlas = mk('title_atlas', D_ATLAS);
    this.fogR2 = mk('title_fog_r', D_FOG).setFlipY(true).setAlpha(0.5);
    this.fogR = mk('title_fog_r', D_FOG + 0.01);
    this.fogT = mk('title_fog_t', D_FOG + 0.02);
    this.hero = mk('mrow_idle0', 31.3).setOrigin(6 / 13, 14 / 16).setScale(2);
    this.pip = mk(s.textures.exists('mpip_0') ? 'mpip_0' : 'mrow_idle0', 31.31).setOrigin(0.5, 0.5).setScale(2);
    this.logo = mk('title_logo', 31.6);
    this.shine = mk('title_logo_shine_0', 31.7);
  }

  hide(): void {
    for (const o of this.imgs) o.setVisible(false);
  }

  /** The picked hero's map walker (Rowan's when there is none). */
  private walker(): string {
    const id = this.s.app.profile.hero ?? 'rowan';
    const key = id === 'rowan' ? 'mrow' : id === 'sable' ? 'msab' : `m${id}`;
    return this.s.textures.exists(`${key}_idle0`) ? key : 'mrow';
  }

  /** The key art, the hero and the logo. `g` is under the hero and the logo, `gc` over the hero (the plates). */
  draw(g: G, gc: G, now: number, since: number): { logoBottom: number } {
    for (const o of this.imgs) o.setVisible(true);
    this.shine?.setVisible(false);
    this.atlas?.setPosition(0, 0);
    // the fog banks drift in and out of the east edge, a second layer out of step; wisps cross the top
    const W = GAME_W;
    this.fogR?.setPosition(W - 88 + Math.round(Math.sin(now / 2700) * 4), 0);
    this.fogR2?.setPosition(W - 74 + Math.round(Math.sin(now / 3900 + 2) * 6), 0);
    this.fogT?.setPosition(-30 + Math.round(Math.sin(now / 3300) * 10), 0);
    this.drawFlecks(g, now);
    this.drawBloom(g, now, since);
    this.drawRoute(g, gc, now, since);

    // the hero, standing where the colour came back: drops onto the map and lands with a puff
    const hk = easeBack(since / TITLE_IN.hero, 1.6);
    const { x: hx, y: hy } = TITLE_HERO;
    const lift = Math.round((1 - hk) * 26);
    g.fillStyle(INK, 0.32 * clamp01(hk));
    g.fillRect(hx - 7, hy, 14, 2);
    g.fillRect(hx - 5, hy + 2, 10, 1);
    const key = this.walker();
    const frame = since > TITLE_IN.hero && Math.floor(now / 520) % 2 ? 'idle1' : 'idle0';
    this.hero?.setTexture(`${key}_${frame}`).setPosition(hx, hy - lift).setAlpha(clamp01(since / 120));
    if (since > TITLE_IN.hero && since < TITLE_IN.hero + 260) {
      const k = (since - TITLE_IN.hero) / 260;
      g.fillStyle(0xf8ecc8, 0.8 * (1 - k));
      for (const side of [-1, 1]) g.fillRect(Math.round(hx + side * (6 + k * 8)) - 1, hy - Math.round(k * 3), 3, 2);
    }
    // Pip flutters above his shoulder
    const pk = clamp01((since - 120) / 300);
    const px = hx + 15 + Math.round(Math.sin(now / 900) * 3);
    const py = hy - 34 + Math.round(Math.sin(now / 320) * 2) - Math.round((1 - pk) * 30);
    if (this.s.textures.exists('mpip_0')) this.pip?.setTexture(Math.floor(now / 140) % 2 ? 'mpip_1' : 'mpip_0');
    this.pip?.setPosition(px, py).setAlpha(pk);

    // the logo drops in with a bounce, bobs gently; a gleam crosses it every few seconds, ending in a twinkle
    const lw = this.logo?.width ?? 160;
    const lh = this.logo?.height ?? 50;
    const lk = easeBack((since - 120) / (TITLE_IN.logo - 120), 1.5);
    const lx = Math.round(W / 2 - lw / 2) + 4;
    const ly = Math.round(18 - (1 - lk) * 70 + Math.sin(now / 700) * 1.2);
    this.logo?.setPosition(lx, ly).setAlpha(clamp01((since - 120) / 160));
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

  /**
   * The colour coming back: now and then a ring of green light spreads from the hero's feet to the bloom's edge,
   * and gold motes rise off the coloured land (closed form in time: the same every run).
   */
  private drawBloom(g: G, now: number, since: number): void {
    const { x: hx, y: hy } = TITLE_HERO;
    const cyc = (now + 2600) % 6400;
    if (since > TITLE_IN.hero + 300 && cyc < 1500) {
      const k = cyc / 1500;
      const rx = 8 + easeOut3(k) * 62;
      const ry = rx * 0.55;
      const a = 0.55 * (1 - k);
      for (let i = 0; i < 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const x = Math.round(hx + Math.cos(t) * rx);
        const y = Math.round(hy + Math.sin(t) * ry);
        g.fillStyle(i % 2 ? 0xb4d058 : 0xfff0a0, a);
        g.fillRect(x, y, 2, 1);
      }
    }
    for (let i = 0; i < 9; i++) {
      const period = 2600 + i * 410;
      const q = (((now + i * 977) % period) + period) % period / period;
      const x = Math.round(14 + ((i * 37) % 84) + Math.sin(q * 6 + i) * 3);
      const y = Math.round(118 - ((i * 23) % 50) - q * 26);
      const a = Math.sin(q * Math.PI) * 0.9;
      g.fillStyle(i % 3 ? 0xfff0a0 : 0xf2c230, a);
      g.fillRect(x, y, 1, 1);
      if (i % 3 === 0 && q > 0.3 && q < 0.6) g.fillRect(x - 1, y, 3, 1);
    }
  }

  /** Flecks of fog blown off the erased east, drifting west and thinning out. */
  private drawFlecks(g: G, now: number): void {
    for (let i = 0; i < 12; i++) {
      const period = 5200 + i * 630;
      const q = (((now + i * 1531) % period) + period) % period / period;
      const x = Math.round(312 - q * (70 + (i % 4) * 14));
      const y = Math.round(14 + ((i * 41) % 124) + Math.sin(q * 5 + i) * 4);
      const a = Math.sin(q * Math.PI) * 0.7;
      g.fillStyle(0xece8f0, a);
      g.fillRect(x, y, i % 3 === 0 ? 3 : 2, 1);
      g.fillStyle(0x9a94a8, a * 0.6);
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  /**
   * The route: red dashes drawn in from the hero east toward the fog by a quill (as the title opens), fading where
   * the fog has erased the land; then a gold glint runs along it every few seconds.
   */
  private drawRoute(g: G, gc: G, now: number, since: number): void {
    const pts = this.route;
    const k = easeOut3(clamp01((since - TITLE_IN.route) / TITLE_IN.routeMs));
    const n = Math.floor(pts.length * k);
    for (let i = 0; i < n; i++) {
      if (i % 5 > 2) continue;
      const [x, y] = pts[i];
      const a = this.routeA[i];
      if (a <= 0.05) continue;
      g.fillStyle(0x8a1a22, a * 0.9);
      g.fillRect(x, y + 1, 1, 1);
      g.fillStyle(0xd03030, a);
      g.fillRect(x, y, 1, 1);
    }
    // the quill at the tip while it draws: a white feather leaning back, a gold nib on the line
    if (k > 0 && k < 1) {
      const [qx, qy] = pts[Math.max(0, n - 1)];
      const a = this.routeA[Math.max(0, n - 1)];
      quill(gc, qx, qy, now, a);
    }
    // a glint runs along the drawn route
    if (k >= 1) {
      const cyc = now % 5200;
      if (cyc < 1400) {
        const i = Math.floor((cyc / 1400) * pts.length);
        for (let j = Math.max(0, i - 6); j <= i && j < pts.length; j++) {
          const [x, y] = pts[j];
          const a = this.routeA[j] * (1 - (i - j) / 7);
          g.fillStyle(j === i ? 0xffffff : 0xfff0a0, a);
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  /**
   * The band under the map: a glass plate behind the start prompt (or the Continue / New game buttons, drawn by the
   * overlays), and the legend of blocks (what to tap) on its own plate at the foot.
   */
  drawPrompt(gc: G, texts: TextPool, text: string, cy: number, now: number, alpha: number): void {
    const w = textWidth(text, 2, true);
    const p = pulse(now, 900);
    const cx = Math.round(GAME_W / 2);
    const r: Rect = { x: cx - Math.round(w / 2) - 34, y: cy - 11, w: w + 68, h: 22 };
    glass(gc, r, { alpha: 0.9 * alpha, clear: 0.2 });
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const k = ((now / 600 + i / 3) % 1 + 1) % 1;
        const x = Math.round(cx + side * (w / 2 + 26 - k * 14));
        chevron(gc, x, cy - 5, 11, i === 0 ? GOLD[4] : GOLD[3], alpha * Math.sin(k * Math.PI), -side, true);
      }
    texts.text(text, cx, cy + 1, mix(WHITE, 0xfff0a0, 0.5 * p), { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: alpha * (0.85 + 0.15 * p), extrude: 1, extrudeCol: 0x3a1c18 });
  }

  /** The legend: the three blocks a first fight teaches, as a map's key on a small plate. */
  drawLegend(gc: G, texts: TextPool, ty: number, alpha: number): void {
    const tips: Array<[readonly number[], string, number]> = [
      [COL.yellow, 'Tap yellow', 0xfff0c0],
      [COL.red, 'Tap red to block', 0xffb0a0],
      [COL.purple, 'Avoid purple', 0xdab0ff],
    ];
    const widths = tips.map(([, t]) => textWidth(t, 1, false) + 10);
    const total = widths.reduce((a, b) => a + b, 0) + (tips.length - 1) * 12;
    const cx = Math.round(GAME_W / 2);
    let x = Math.round(cx - total / 2);
    glass(gc, { x: x - 6, y: ty - 7, w: total + 12, h: 15 }, { alpha: 0.85 * alpha, clear: 0.25 });
    tips.forEach(([col, t, tc], i) => {
      const [base, light, dark] = col;
      brick(gc, x, ty - 4, 6, 9, [light, base, dark, mix(dark, INK, 0.4)], alpha);
      texts.text(t, x + 9, ty + 1, tc, { oy: 0.5, alpha });
      x += widths[i] + 12;
      if (i < tips.length - 1) {
        gc.fillStyle(GOLD[2], alpha);
        gc.fillRect(x - 7, ty - 1, 2, 2);
      }
    });
  }
}

/** A quill drawing at (x, y): the nib on the point, the feather leaning up and back, bobbing as it writes. */
function quill(g: G, x: number, y: number, now: number, a: number): void {
  const bob = Math.round(Math.sin(now / 70) * 1);
  const ox = x;
  const oy = y + bob;
  // the nib (gold, ink tip)
  g.fillStyle(INK, a);
  g.fillRect(ox, oy, 1, 1);
  g.fillStyle(0xd8901c, a);
  g.fillRect(ox + 1, oy - 1, 1, 1);
  g.fillStyle(0xf2c230, a);
  g.fillRect(ox + 1, oy - 2, 2, 1);
  // the shaft and vane: a diagonal up to the right, light on the upper edge
  for (let i = 0; i < 12; i++) {
    const sx = ox + 2 + i;
    const sy = oy - 3 - i;
    const vane = i > 2 ? Math.min(3, Math.floor((i - 1) / 2)) : 0;
    g.fillStyle(INK, a);
    g.fillRect(sx - 1, sy, 1, 1);
    g.fillRect(sx + vane + 1, sy, 1, 1);
    g.fillStyle(0xeef3fa, a);
    g.fillRect(sx, sy, Math.max(1, vane), 1);
    if (vane > 1) {
      g.fillStyle(0xb8c2d8, a);
      g.fillRect(sx + vane - 1, sy, 1, 1);
    }
  }
  g.fillStyle(INK, a);
  g.fillRect(ox + 13, oy - 15, 2, 1);
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
