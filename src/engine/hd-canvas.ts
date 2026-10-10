// The fine-grid DOM canvas over the game canvas (the sharper chest reveal's layer, and the sharper text's): placed and
// sized with the layout, cleared each frame it's drawn on, hidden on frames it isn't. Its own small file so the sharper
// text (view/hd-text.ts) can use it without pulling the chest reveal's chunk (view/chest-hd.ts, loaded on its own)
// back into the main chunk, or into an import cycle with the camp's kit.
import type Phaser from 'phaser';

// Phaser's scene event names as strings (PRE_UPDATE / POST_UPDATE): a value import of Phaser here
// would pull the engine into the unit tests that measure text through view/heroes.ts -> hd-text.ts.
const PRE_UPDATE = 'preupdate';
const POST_UPDATE = 'postupdate';
import { HD_K, hdLayerRect, sameLayer, type HdLayerRect } from './hd-layer';
import type { ScreenLayout } from './layout';

type Ctx = CanvasRenderingContext2D;

/** The fine-grid canvas over the game: placed and sized with the layout, cleared each frame it's drawn on, hidden on
 *  frames it isn't. */
export class HdLayer {
  private cv: HTMLCanvasElement | null = null;
  private ctx: Ctx | null = null;
  private rect: HdLayerRect | null = null;
  private drawn = false;
  private shown = false;
  private hooked = false;

  constructor(
    private readonly s: Phaser.Scene,
    private readonly layout: () => ScreenLayout,
    /** The canvas's DOM id (the sharper text's own layer is 'hd-text', view/hd-text.ts). */
    private readonly id = 'hd-layer',
  ) {}

  /** The canvas (tests). */
  get canvas(): HTMLCanvasElement | null {
    return this.cv;
  }

  get visible(): boolean {
    return this.shown;
  }

  private hook(): void {
    if (this.hooked) return;
    this.hooked = true;
    this.s.events.on(PRE_UPDATE, this.preUpdate, this);
    this.s.events.on(POST_UPDATE, this.postUpdate, this);
  }

  private preUpdate(): void {
    this.drawn = false;
  }

  private postUpdate(): void {
    if (!this.drawn && this.shown) this.hide();
  }

  /** A frame on the layer: placed over the game canvas, cleared. */
  begin(): { ctx: Ctx; r: HdLayerRect } {
    this.hook();
    if (!this.cv) {
      const cv = document.createElement('canvas');
      cv.id = this.id;
      cv.setAttribute('aria-hidden', 'true');
      const st = cv.style;
      st.position = 'absolute';
      st.pointerEvents = 'none';
      st.imageRendering = 'pixelated';
      st.margin = '0';
      st.display = 'none';
      (document.getElementById('game') ?? document.body).appendChild(cv);
      this.cv = cv;
      this.ctx = cv.getContext('2d');
    }
    const cv = this.cv;
    const ctx = this.ctx!;
    const r = hdLayerRect(this.layout(), HD_K);
    if (!sameLayer(this.rect, r)) {
      const st = cv.style;
      st.left = `${r.left}px`;
      st.top = `${r.top}px`;
      st.width = `${r.cssW}px`;
      st.height = `${r.cssH}px`;
      if (cv.width !== r.w) cv.width = r.w;
      if (cv.height !== r.h) cv.height = r.h;
      this.rect = r;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, r.w, r.h);
    if (!this.shown) {
      cv.style.display = 'block';
      this.shown = true;
    }
    this.drawn = true;
    return { ctx, r };
  }

  hide(): void {
    if (this.cv && this.shown) this.cv.style.display = 'none';
    this.shown = false;
  }

  destroy(): void {
    if (this.hooked) {
      this.s.events.off(PRE_UPDATE, this.preUpdate, this);
      this.s.events.off(POST_UPDATE, this.postUpdate, this);
    }
    this.hooked = false;
    this.cv?.remove();
    this.cv = null;
    this.ctx = null;
    this.rect = null;
    this.shown = false;
  }
}
