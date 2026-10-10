// Small UI helpers for the menu screens (map, story, shop, events): a pool of bitmap texts reused every frame,
// and a few drawing shortcuts in the game's chrome style (ink outline, rounded corners, bevelled rims).
import { noteTarget } from '../focus';
import type Phaser from 'phaser';
import type { FightScene } from '../scene';
import type { HdText } from './hd-text';
import { FONT_BOLD, fontFor, fontText, isDarkInk, readable } from '../font';
import { band, GOLD, NAVY, rows } from './pixels';
import { INK, mix, shade, tintGrad, WHITE, type Rect } from './shared';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

export interface TextOpts {
  scale?: number;
  ox?: number;
  oy?: number;
  bold?: boolean;
  alpha?: number;
  /** Explicit top/bottom tint instead of the default gentle gradient of `color`. */
  grad?: readonly [number, number];
  /** Px of solid extrusion under the text (a 3D slab, for titles), and its color. */
  extrude?: number;
  extrudeCol?: number;
  /** No ink outline (dark text on a light surface). Default: chosen by the color (isDarkInk). */
  plain?: boolean;
  /** The whole line a typed-out prefix belongs to (the sharper text crops its image instead of painting a new one). */
  full?: string;
}

/** Bitmap texts handed out in draw order each frame; the ones not used this frame are hidden. */
export class TextPool {
  private items: Phaser.GameObjects.BitmapText[] = [];
  private used = 0;
  /** The sharper text (view/hd-text.ts): while a surface sets it, texts the fine layer can take are drawn there and
   *  their bitmaps stay in place, transparent (measuring, focus, tests); null is the old path. */
  hd: HdText | null = null;

  constructor(
    private readonly s: FightScene,
    private readonly depth = 32,
  ) {}

  begin(): void {
    this.used = 0;
  }

  text(str: string, x: number, y: number, color = WHITE, o: TextOpts = {}): Phaser.GameObjects.BitmapText {
    // extrusion: copies stacked under the text, darkest at the bottom (drawn first, so they sit behind it)
    const ex = o.extrude ?? 0;
    for (let i = ex; i >= 1; i--) {
      const c = o.extrudeCol ?? shade(color, 0.3);
      const col = i === 1 && ex > 1 ? mix(c, color, 0.35) : c;
      this.text(str, x, y + i * (o.scale ?? 1), col, { ...o, extrude: 0, grad: [col, col], plain: false });
    }
    let t = this.items[this.used];
    if (!t) {
      t = this.s.add.bitmapText(0, 0, FONT_BOLD, '').setDepth(this.depth);
      this.items.push(t);
    }
    this.used++;
    const plain = o.plain ?? (!o.grad && isDarkInk(color));
    t.setFont(fontFor(!!o.bold, plain))
      .setText(fontText(str))
      .setPosition(Math.round(x), Math.round(y))
      .setScale(o.scale ?? 1)
      .setOrigin(o.ox ?? 0, o.oy ?? 0)
      .setAlpha(o.alpha ?? 1)
      .setVisible(true);
    // outlined text is never dimmer than readable() (an explicit gradient, like an extrusion layer's, is kept as given)
    if (o.grad) t.setTint(o.grad[0], o.grad[0], o.grad[1], o.grad[1]);
    else tintGrad(t, plain ? color : readable(color), !o.bold);
    if (this.hd && !ex && this.hd.text(str, x, y, color, o)) t.setAlpha(0);
    return t;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }
}

/** Images handed out in draw order each frame; the ones not used this frame are hidden. */
export class ImagePool {
  private items: Array<{ img: Img; key: string; depth: number }> = [];
  private used = 0;
  private sizes = new Map<string, [number, number]>();

  constructor(private readonly s: FightScene) {}

  begin(): void {
    this.used = 0;
  }

  size(key: string): [number, number] {
    let z = this.sizes.get(key);
    if (!z) {
      const src = this.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      z = [src.width, src.height];
      this.sizes.set(key, z);
    }
    return z;
  }

  /** A sprite with its top-left at (x, y), whole pixels. */
  at(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    let it = this.items[this.used];
    if (!it) {
      it = { img: this.s.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth), key, depth };
      this.items.push(it);
    }
    this.used++;
    if (it.key !== key) {
      it.img.setTexture(key);
      it.key = key;
    }
    if (it.depth !== depth) {
      it.img.setDepth(depth);
      it.depth = depth;
    }
    it.img.setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setScale(1).setVisible(true);
    if (tint === undefined) it.img.clearTint();
    else it.img.setTint(tint);
    return it.img;
  }

  /** A sprite standing with its bottom centre at (x, y). */
  foot(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    const [w, h] = this.size(key);
    return this.at(key, Math.round(x) - (w >> 1), Math.round(y) - h, depth, alpha, tint);
  }

  /** A sprite scaled by `scale` (whole numbers keep the pixels crisp), its top-left at (x, y). */
  scaled(key: string, x: number, y: number, depth: number, scale: number, alpha = 1, tint?: number): Img {
    return this.at(key, x, y, depth, alpha, tint).setScale(scale);
  }

  /** A sprite centred on (x, y). */
  mid(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    const [w, h] = this.size(key);
    return this.at(key, Math.round(x) - (w >> 1), Math.round(y) - (h >> 1), depth, alpha, tint);
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].img.setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }

  /** Drop every image (the textures are rebuilt on a new layout). */
  destroy(): void {
    for (const it of this.items) it.img.destroy();
    this.items = [];
    this.used = 0;
    this.sizes.clear();
  }
}

/** A dark panel with a gold inner line (story text box, name plates). */
export function darkPanel(g: G, r: Rect, fill = 0x231a33, alpha = 1): void {
  rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 2, 3, INK, 0.45 * alpha);
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK, alpha);
  rows(g, r.x, r.y, r.w, r.h, 2, 0x4a3c66, alpha);
  rows(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 2, fill, alpha);
  g.fillStyle(0xd8901c, alpha);
  g.fillRect(r.x + 3, r.y + 2, r.w - 6, 1);
  g.fillRect(r.x + 3, r.y + r.h - 3, r.w - 6, 1);
  g.fillRect(r.x + 2, r.y + 3, 1, r.h - 6);
  g.fillRect(r.x + r.w - 3, r.y + 3, 1, r.h - 6);
  g.fillStyle(0xf2c230, alpha);
  for (const [x, y] of [
    [r.x + 2, r.y + 2],
    [r.x + r.w - 3, r.y + 2],
    [r.x + 2, r.y + r.h - 3],
    [r.x + r.w - 3, r.y + r.h - 3],
  ])
    g.fillRect(x, y, 1, 1);
}

/** Parchment fill (the map, event notes) with darker edges. */
export function parchment(g: G, r: Rect, speckles: Array<[number, number, number]> = []): void {
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, 0x6a4a2a);
  rows(g, r.x, r.y, r.w, r.h, 2, 0xe2c992);
  g.fillStyle(0xecd8aa, 1);
  g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  g.fillStyle(0xf4e6c0, 1);
  g.fillRect(r.x + 6, r.y + 5, r.w - 12, r.h - 10);
  g.fillStyle(0xd2b47a, 1);
  g.fillRect(r.x + 1, r.y + r.h - 3, r.w - 2, 2);
  g.fillRect(r.x + r.w - 3, r.y + 1, 2, r.h - 2);
  for (const [x, y, c] of speckles) {
    g.fillStyle(c, 1);
    g.fillRect(r.x + x, r.y + y, 1, 1);
  }
}

/** Faces for menu buttons: [hi, base, lo, deep]. */
/** Button faces [hi, base, lo, deep] (L7/L8: the mood's accents, deep and a little desaturated: moss, brass,
 *  oxblood, iron, steel blue, leather, plum, ink; not candy colours). */
export const FACE = {
  green: [0x8cb87a, 0x4c8646, 0x356638, 0x1e3e24],
  gold: [0xe6c886, 0xbe8e3a, 0x8c6224, 0x553812],
  red: [0xd8907e, 0xa4403a, 0x782828, 0x481418],
  grey: [0x7e8296, 0x5e6276, 0x4a4e60, 0x323442],
  blue: [0x88aed4, 0x3c6aa4, 0x2c4e82, 0x182a4c],
  wood: [0xc4925e, 0x95603a, 0x74462a, 0x46240e],
  purple: [0xbea0d6, 0x7a54a6, 0x5a3c84, 0x34204e],
  navy: [0x5a5280, 0x342c54, 0x262040, 0x16122a],
} as const;

/** Ribbon colors [hi, base, lo, deep]. */
export const RIBBON = {
  gold: [0xecd08e, 0xc69a42, 0x966a26, 0x5c3c14],
  red: [0xe0907a, 0xb03c38, 0x82242a, 0x4e1018],
  blue: [0x90b8e0, 0x3e70b0, 0x2c5090, 0x1a2c5a],
  purple: [0xc6a2e0, 0x7e50ae, 0x5c3488, 0x361a56],
  green: [0xa2c886, 0x4e8c48, 0x346838, 0x1c4224],
} as const;

/**
 * A banner ribbon centered on cx (title plates, headers): the band with a lit top and shaded bottom, and two
 * notched tails folded behind it. Returns the band's rect.
 */
export function ribbon(g: G, cx: number, y: number, w: number, h: number, col: readonly [number, number, number, number], alpha = 1, tails = true): Rect {
  const x = Math.round(cx - w / 2);
  const [hi, base, lo, deep] = col;
  if (tails) {
    const tw = 9;
    const notch = (i: number) => Math.max(0, 3 - Math.round(Math.abs(i - (h - 1) / 2) * (6 / h)));
    for (const side of [-1, 1]) {
      const tx = side < 0 ? x - tw + 2 : x + w - 2;
      const ty = y + 3;
      // tail: ink rim, darker body, a V notch cut into the outer end
      for (let i = -1; i <= h; i++) {
        const d = notch(Math.max(0, Math.min(h - 1, i)));
        const x0 = side < 0 ? tx + d : tx;
        const x1 = side < 0 ? tx + tw : tx + tw - d;
        g.fillStyle(INK, alpha);
        g.fillRect(x0 - 1, ty + i, x1 - x0 + 2, 1);
        if (i < 0 || i >= h) continue;
        g.fillStyle(i >= h - 2 ? deep : lo, alpha);
        g.fillRect(x0, ty + i, x1 - x0, 1);
      }
      // the fold: a dark wedge where the tail tucks behind the band
      g.fillStyle(mix(deep, INK, 0.5), alpha);
      g.fillRect(side < 0 ? x : x + w - 3, y + h, 3, 3);
    }
  }
  rows(g, x - 1, y + 2, w + 2, h, 1, INK, 0.4 * alpha);
  rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK, alpha);
  g.fillStyle(base, alpha);
  g.fillRect(x, y, w, h);
  g.fillStyle(hi, alpha);
  g.fillRect(x, y, w, 1);
  g.fillStyle(mix(hi, base, 0.5), alpha);
  g.fillRect(x, y + 1, w, 1);
  g.fillStyle(lo, alpha);
  g.fillRect(x, y + h - 2, w, 1);
  g.fillStyle(deep, alpha);
  g.fillRect(x, y + h - 1, w, 1);
  g.fillStyle(WHITE, 0.8 * alpha);
  g.fillRect(x + w - 6, y + 1, 3, 1);
  return { x, y, w, h };
}

/** A small rounded tag (rarity labels, counters): ink rim and a two-tone fill. */
export function tag(g: G, r: Rect, col: readonly [number, number, number, number], alpha = 1): void {
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, INK, alpha);
  rows(g, r.x, r.y, r.w, r.h, 1, col[1], alpha);
  band(g, r.x, r.y, r.w, r.h, 1, 0, 1, col[0], alpha);
  band(g, r.x, r.y, r.w, r.h, 1, r.h - 1, r.h, col[3], alpha);
}

/** A dark translucent strip across the screen (behind big prompts): soft edges, a gold hairline top and bottom. */
export function strip(g: G, x: number, y: number, w: number, h: number, alpha = 0.6, gold = true): void {
  g.fillStyle(INK, alpha * 0.45);
  g.fillRect(x, y - 2, w, 2);
  g.fillRect(x, y + h, w, 2);
  g.fillStyle(INK, alpha);
  g.fillRect(x, y, w, h);
  if (gold) {
    g.fillStyle(GOLD[2], alpha);
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y + h - 1, w, 1);
  }
}

/** The last button pressed (taps call notePress) shows sunk for a moment: tactile feedback. */
const press = { key: '', at: -1e9 };
const rectKey = (r: Rect) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)}`;
export function notePress(r: Rect): void {
  press.key = rectKey(r);
  press.at = performance.now();
}
export function isPressed(r: Rect, now: number, ms = 140): boolean {
  noteTarget(r); // (every button drawn asks this each frame: the keyboard's focus ring finds the screen's buttons here)
  return now - press.at < ms && press.key === rectKey(r);
}

export { NAVY, GOLD };
