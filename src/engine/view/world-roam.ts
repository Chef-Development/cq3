// The world map's wandering foe (core/skirmish.ts), drawn over the kingdom (view/world.ts calls in): once one is out,
// it paces a stretch of the Meadow Road (world px; drawn less the camera), a red "!" bobbing over it and a ring at its
// feet. A tap on it brings up a
// small card: who it is (its foes' mini sprites), what beating it pays (a gear bag and XP), "Fight" or "Later".
// Fight starts the skirmish (core/run.ts startSkirmish); afterwards the run comes back to the world map.
import type Phaser from 'phaser';
import { RARITY_INFO } from '../../data/gear';
import type { Skirmish } from '../../core/skirmish';
import { miniKey } from '../art-minis';
import { MEADOW_ROAD } from '../art-world';
import type { FightScene } from '../scene';
import { bagPal, glyph, glyphSize } from './overlays';
import { button3d, glow, hudIcon, iconSize, panel } from './pixels';
import { clamp01, easeBack, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, notePress, ribbon, RIBBON, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

// over the world map's land and actors, under its plates (view/world.ts DEPTH)
const D_FOE = 30.185;
const D_MARK = 30.26;
const D_CARD = 30.88;
const D_CARD_TEXT = 30.89;

export class WorldRoam {
  private g!: G;
  private gCard!: G;
  private pool: ImagePool;
  private cardPool: ImagePool;
  private texts: TextPool;
  /** The card is up (since, performance.now). */
  private card: { at: number } | null = null;
  private fightAt = 0;

  constructor(
    private readonly s: FightScene,
    /** The world map's camera (world px at the screen's top-left). */
    private readonly cam: () => { x: number; y: number },
  ) {
    this.pool = new ImagePool(s);
    this.cardPool = new ImagePool(s);
    this.texts = new TextPool(s, D_CARD_TEXT);
  }

  build(): void {
    this.g?.destroy();
    this.gCard?.destroy();
    this.g = this.s.add.graphics().setDepth(D_MARK);
    this.gCard = this.s.add.graphics().setDepth(D_CARD);
    this.pool.destroy();
    this.cardPool.destroy();
  }

  hide(): void {
    this.g?.clear();
    this.gCard?.clear();
    this.pool.hide();
    this.cardPool.hide();
    this.texts.hide();
    this.card = null;
  }

  /** The foe out on the road (null: none). */
  private foe(): Skirmish | null {
    return this.s.app.run.wanderer;
  }

  /** Where it stands (world px): a spot along the Meadow Road (pacing a little either way). */
  private feet(now: number, f: Skirmish): [number, number] {
    // the stretch between the village and the Bandit Captain's camp (Rowan is further on once Act 1 is cleared)
    const road = MEADOW_ROAD.filter(([x]) => x >= 156 && x <= 194);
    if (!road.length) return [170, 250];
    const i = Math.round(f.spot * (road.length - 1));
    const pace = Math.round(Math.sin(now / 1300) * 4);
    const [x, y] = road[Math.max(0, Math.min(road.length - 1, i + pace))];
    return [x, y];
  }

  /** The foe's box on screen (a tap there opens the card; a tip points at it). */
  foeRect(now = performance.now()): Rect | null {
    const f = this.foe();
    if (!f) return null;
    const [x, y] = this.feet(now, f);
    const c = this.cam();
    return { x: x - c.x - 8, y: y - c.y - 22, w: 16, h: 24 };
  }

  /** Whether the card is up (the world map waits for it). */
  get open(): boolean {
    return !!this.card;
  }

  /** The card: 150 px wide, wider when its foes need it at 2x (the later regions' elites are wide) with what it pays
   *  beside them. */
  private cardRect(): Rect {
    const s = this.s;
    const f = this.foe();
    const l = f ? this.lineup(f, 0) : null;
    const w = Math.min(s.R - s.L - 16, Math.max(150, l ? 20 + l.span + l.half[l.half.length - 1] + 58 : 0));
    const h = 66;
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: Math.round((s.B - h) / 2) + 8, w, h };
  }

  /** The card's foes in a row at 2x (the elite last): each one's mini, half its drawn width, and the steps between
   *  their middles (24 px, more for wide ones). */
  private lineup(f: Skirmish, now: number): { texs: string[]; half: number[]; steps: number[]; span: number } {
    const texs = f.waves.flat().map((key, i) => this.mini(key, now + i * 170));
    const half = texs.map((tex) => this.cardPool.size(tex)[0]);
    const steps = half.slice(1).map((hw, i) => Math.max(24, half[i] + hw));
    return { texs, half, steps, span: steps.reduce((a, d) => a + d, 0) };
  }

  /** The card's Fight (0) and Later (1). */
  btn(i: number): Rect {
    const c = this.cardRect();
    const w = 62;
    return { x: c.x + c.w / 2 - w - 4 + i * (w + 8), y: c.y + c.h - 21, w, h: 15 };
  }

  /** A tap on the world map: the card's buttons (or outside it: it closes), or the foe (the card opens). True: used. */
  tap(x: number, y: number): boolean {
    const s = this.s;
    const app = s.app;
    if (this.fightAt) return true;
    const now = performance.now();
    if (this.card) {
      if (now - this.card.at < 200) return true;
      if (x < 0 || inRect(this.btn(0), x, y, 3)) {
        notePress(this.btn(0));
        this.fightAt = now;
        app.audio.mapSelect();
        window.setTimeout(() => {
          this.fightAt = 0;
          this.card = null;
          if (app.run.phase === 'world') app.setPhase(() => app.run.startSkirmish());
        }, 260);
        return true;
      }
      if (inRect(this.btn(1), x, y, 3)) notePress(this.btn(1));
      this.card = null;
      app.audio.panelClose();
      return true;
    }
    const r = this.foeRect(now);
    if (!r || x < 0 || !inRect(r, x, y, 4)) return false;
    this.card = { at: now };
    app.audio.panelOpen();
    return true;
  }

  draw(now: number): void {
    this.g.clear();
    this.gCard.clear();
    this.pool.begin();
    this.cardPool.begin();
    this.texts.begin();
    const f = this.foe();
    if (f) {
      this.drawFoe(now, f);
      if (this.card) this.drawCard(now, f);
    } else this.card = null;
    this.pool.end();
    this.cardPool.end();
    this.texts.end();
  }

  /** A foe's mini sprite key (by enemy key; art-minis.ts records a sprite that has none). */
  private mini(key: string, t: number): string {
    return miniKey(this.s.app.tuning.enemies[key]?.sprite ?? key, t);
  }

  /** The foe on the road: its lead sprite, a ring at its feet, a red "!" bobbing over it. */
  private drawFoe(now: number, f: Skirmish): void {
    const g = this.g;
    const c = this.cam();
    g.setPosition(-c.x, -c.y);
    const [x, y] = this.feet(now, f);
    const k = (now % 1200) / 1200;
    g.fillStyle(0xff5a3a, 0.7 * (1 - k));
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      g.fillRect(Math.round(x + Math.cos(a) * (4 + k * 6)), Math.round(y + 1 + Math.sin(a) * (1.5 + k * 2)), 1, 1);
    }
    g.fillStyle(0x0c1410, 0.45);
    g.fillRect(x - 3, y, 7, 1);
    const lead = f.waves[f.waves.length - 1][0];
    const face = Math.sin(now / 1300 + 0.6) > 0 ? 1 : -1;
    const img = this.pool.foot(this.mini(lead, now), x - c.x, y + 1 - c.y, D_FOE);
    img.setFlipX(face < 0);
    // the "!" over it
    const by = Math.round(y - img.height - 8 - Math.abs(Math.sin(now / 240)) * 2);
    g.fillStyle(INK, 1);
    g.fillRect(x - 2, by - 1, 5, 10);
    g.fillStyle(0xff5a3a, 1);
    g.fillRect(x - 1, by, 3, 5);
    g.fillRect(x - 1, by + 6, 3, 2);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(x - 1, by, 1, 2);
  }

  /** The card: "Skirmish!", the foes, what it pays, Fight / Later. */
  private drawCard(now: number, f: Skirmish): void {
    const s = this.s;
    const g = this.gCard;
    const T = this.texts;
    const since = now - (this.card?.at ?? now);
    g.fillStyle(0x05040a, 0.45 * clamp01(since / 150));
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    const c0 = this.cardRect();
    const k = easeBack(since / 220, 1.5);
    const sc = 0.8 + 0.2 * k;
    const c: Rect = { x: Math.round(c0.x + (c0.w * (1 - sc)) / 2), y: Math.round(c0.y + (c0.h * (1 - sc)) / 2), w: Math.round(c0.w * sc), h: Math.round(c0.h * sc) };
    panel(g, c, { trim: 'full', alpha: clamp01(k * 2) });
    if (k < 0.98) return;
    ribbon(g, c.x + c.w / 2, c.y - 6, 84, 12, RIBBON.red);
    T.text('Skirmish!', c.x + c.w / 2, c.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    // the foes: one mini sprite per foe at 2x (the elite last), standing on a strip (the card widens for wide ones;
    // past the screen's width they squeeze together, the elite on top, rather than run into what it pays)
    const keys = f.waves.flat();
    const x0 = Math.round(c.x + 10);
    const fy = c.y + 34;
    const { texs, half, steps, span } = this.lineup(f, now);
    const room = c.x + c.w - 58 - half[half.length - 1] - (x0 + 10); // (the gear bag stands at c.w - 52)
    const squeeze = span > room ? room / span : 1;
    const cx = [x0 + 10];
    for (const d of steps) cx.push(cx[cx.length - 1] + d * squeeze);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(x0 - 2, fy, Math.round(cx[cx.length - 1] + Math.max(12, half[half.length - 1]) - (x0 - 2)), 2);
    keys.forEach((key, i) => {
      const elite = !!s.app.tuning.enemies[key]?.elite;
      const [w, h] = this.cardPool.size(texs[i]);
      this.cardPool.scaled(texs[i], Math.round(cx[i]) - w, fy + 1 - h * 2 - (elite ? Math.floor(now / 300) % 2 : 0), D_CARD + 0.005, 2);
    });
    // what it pays: a gear bag and XP
    const rx = c.x + c.w - 52;
    const [gw, gh] = glyphSize('bag');
    glyph(g, 'bag', rx, fy - 14 - Math.round(gh / 2), 1, bagPal(RARITY_INFO.uncommon.face));
    T.text('Gear', rx + gw + 3, fy - 14, 0xb4f070, { bold: true, oy: 0.5 });
    const [sw, sh] = iconSize('star');
    hudIcon(g, 'star', rx, fy - 2 - Math.round(sh / 2));
    T.text('XP', rx + sw + 3, fy - 2, 0xffe680, { bold: true, oy: 0.5 });
    // Fight / Later
    (['Fight', 'Later'] as const).forEach((label, i) => {
      const r = this.btn(i);
      const pr = isPressed(r, now) || (i === 0 && this.fightAt > 0);
      if (i === 0) glow(g, r, 0xff8a5a, 0.3 + 0.3 * pulse(now, 800), 3);
      button3d(g, r, i === 0 ? FACE.red : FACE.navy, pr);
      T.text(label, r.x + r.w / 2, r.y + r.h / 2 + (pr ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    });
  }
}
