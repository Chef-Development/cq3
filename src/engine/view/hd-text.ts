// The sharper text (round 8: the chest reveal's fine layer, hd-layer.ts + font-hd.ts, rolled out to what the player
// reads most). A surface that opts in hands its TextPool this layer; while it does, the pool's texts are drawn on a
// DOM canvas laid over the game canvas at HD_K x its resolution: the game font doubled with its outer corners rounded
// (font-hd.ts Smooth 'round': stroke ends and bends soften, nothing fills in, so '+', 'f' and 'x' keep their shapes),
// at the game text's weight (a 1 game px ink outline and drop shadow), in the same places and widths. The bitmap text
// stays where it was, transparent, for measuring, focus and tests. Text the fine path can't take (an extrusion, an
// explicit gradient, several lines, a scale above 2) goes the old way, untouched.
//
// The switch is central: one flag per surface (hd-switch.ts, docs/decisions.md A20), overridden by the 'cq3.hdText'
// setting ('off', 'on', or per surface: storage.ts). A surface turns it off for any frame something covers it (a
// wipe, a tip card, a sheet over a screen), since the fine layer sits above the whole game canvas. The layer only
// shows on frames that draw on it (HdLayer), so leaving a screen leaves nothing.
import Phaser from 'phaser';
import { FONT_BOLD_H, FONT_H, isDarkInk, readable, textWidth } from '../font';
import { hdText, hdTextW } from '../font-hd';
import { HD_K } from '../hd-layer';
import type { FightScene } from '../scene';
import { surfaceOn, type HdSurface } from '../hd-switch';
import { loadHdText, type HdTextSetting } from '../storage';
import { HdLayer } from '../hd-canvas';
import type { TextOpts } from './ui';

let setting: HdTextSetting | undefined;

/** Is this surface's text drawn sharper (the setting, else the default; hd-switch.ts)? */
export function hdSurfaceOn(surface: HdSurface): boolean {
  if (setting === undefined) setting = loadHdText();
  return surfaceOn(setting, surface);
}

/** True while something covers a screen's whole canvas from above (a wipe, a tip card, the finisher reveal; `under`:
 *  a story box too, for a screen a scene can play over): no fine text under it. */
export function screenCovered(s: FightScene, now: number, under = false): boolean {
  return s.transition.active(now) || s.app.tipUp || s.reveal.active || (under && !!s.app.storyId);
}

type Ctx = CanvasRenderingContext2D;

const quant = (c: number): number => {
  const ch = (sh: number) => Math.min(255, Math.round(((c >> sh) & 255) / 8) * 8);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** The fine layer the sharper texts draw on: one per scene, cleared once a frame (on its first text). */
export class HdText {
  private readonly layer: HdLayer;
  private ctx: Ctx | null = null;
  private fresh = true;
  /** Texts drawn this frame (tests, the perf check). */
  count = 0;

  constructor(s: FightScene) {
    this.layer = new HdLayer(s, () => s.app.layout, 'hd-text');
    s.events.on(Phaser.Scenes.Events.PRE_UPDATE, () => {
      this.fresh = true;
      this.count = 0;
    });
  }

  get visible(): boolean {
    return this.layer.visible;
  }

  private frame(): Ctx {
    if (this.fresh || !this.ctx) {
      this.ctx = this.layer.begin().ctx;
      this.fresh = false;
    }
    return this.ctx;
  }

  /**
   * A TextPool text drawn on the fine grid where the bitmap would have stood (true), or false when it can't be
   * (the caller draws it the old way). `o.full`: the whole line a typed-out prefix belongs to (its image is cropped,
   * so typing doesn't paint a new image every letter).
   */
  text(str: string, x: number, y: number, color: number, o: TextOpts & { full?: string }): boolean {
    const scale = o.scale ?? 1;
    if ((scale !== 1 && scale !== 2) || o.grad || o.extrude || str.includes('\n')) return false;
    if (!str.length) return true;
    const bold = !!o.bold;
    const plain = o.plain ?? isDarkInk(color);
    // colours to 5 bits a channel: a text whose colour pulses reuses a handful of images instead of a new one a frame
    const col = quant(plain ? color : readable(color));
    const level = scale as 1 | 2;
    const full = o.full && o.full.startsWith(str) ? o.full : str;
    // the game text's weight: a 1 game px outline and drop shadow (2 fine px; 3 at scale 2, a touch lighter than 4)
    const outline = level === 1 ? 2 : 3;
    const img = hdText(full, { level, bold, color: col, plain, outline, smooth: 'round' });
    const W = textWidth(str, scale, bold);
    const H = (bold ? FONT_BOLD_H : FONT_H) * scale;
    const left = Math.round(x) - (o.ox ?? 0) * W;
    const top = Math.round(y) - (o.oy ?? 0) * H;
    // the fill's first column and the cap line land where the bitmap's do (its frame: 1 px of outline, times scale)
    const fx = Math.round((left + scale) * HD_K) - img.capTop;
    const fy = Math.round((top + scale) * HD_K) - img.capTop;
    const cw = full === str ? img.w : Math.min(img.w, hdTextW(str, level, bold, plain, outline));
    const ctx = this.frame();
    const a = o.alpha ?? 1;
    if (a <= 0) return true;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(img.canvas, 0, 0, cw, img.h, fx, fy, cw, img.h);
    ctx.globalAlpha = 1;
    this.count++;
    return true;
  }
}

const layers = new WeakMap<FightScene, HdText>();

/** The scene's fine text layer. */
export function hdTextOf(s: FightScene): HdText {
  let l = layers.get(s);
  if (!l) {
    l = new HdText(s);
    layers.set(s, l);
  }
  return l;
}

/** What a surface hands its TextPool this frame: the fine layer when it's on and nothing covers it, else null. */
export function hdFor(s: FightScene, surface: HdSurface, covered = false): HdText | null {
  return !covered && hdSurfaceOn(surface) ? hdTextOf(s) : null;
}
