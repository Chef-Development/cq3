// Overlays and menus: the title screen (chrome logo, Rowan and Pip showcased, a pulsing start prompt, how-to
// tips), the boost pick (with a reroll; each card shows its stat before and after), the treasure / act-clear chest
// (then the act's accuracy, and Camp / Next buttons), defeat (Camp / Retry), the victory, pause, "TAP TO BEGIN!",
// the fight banner, and the screen flash. Panels pop in with a little overshoot; cards and buttons stagger in.
// Also the small UI glyphs the menus share (bag, heart, coin, warning, tent, tick, padlock, target, arrow).
import Phaser from 'phaser';
import { heroMaxHp } from '../../core/combat';
import { heroDef } from '../../data/heroes';
import { relicById } from '../../data/relics';
import { heroProgress } from '../../core/profile';
import { buildName, relicText, topTags } from '../../core/relics';
import { levelProgress } from '../../core/heroes';
import { boostLabel, boostPreview, isRelicOffer, type BoostOffer, type BoostPreview, type Phase, type Rarity } from '../../core/run';
import { saveLabel } from '../../core/save';
import type { FightScene } from '../scene';
import { HERO_FEET_X, HERO_W } from '../art';
import { buildCrest, buildLogo } from '../chrome';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { band, brick, button3d, chevron, gauge, glow, GOLD, hudIcon, iconSize, NAVY, panel, RAMP, rows } from './pixels';
import { BOOST_ICON, clamp01, COL, easeBack, easeOut3, inRect, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, notePress, ribbon, RIBBON, strip, tag, TextPool } from './ui';
import { cardFrame, cardShine, cardTile, mainTag, relicCard, relicIcon, tagChip, TAG_FACE, type CardCtx } from './relic-ui';
import { wrapText } from './items';

// ------------------------------------------------------------------ small UI glyphs (shared by the menus)

const K = 0x140c1c;

/** Add a 1 px ink outline ('k') around the filled pixels of a glyph map. */
function outlined(map: string[]): string[] {
  const w = Math.max(...map.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => {
    const c = map[y - 1]?.[x - 1];
    return c !== undefined && c !== '.' ? c : null;
  };
  const out: string[] = [];
  for (let y = 0; y < map.length + 2; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += at(x, y) ?? (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'k' : '.');
    out.push(r);
  }
  return out;
}

interface Glyph {
  rows: string[];
  pal: Record<string, number>;
}

/** Glyphs, outline included. The bag's h/b/d (light, base, dark) take a rarity's colors (glyph's `pal` argument). */
export const GLYPHS: Record<string, Glyph> = {
  // 7x8: a loot bag, tied at the neck
  bag: { rows: outlined(['t...t', '.ttt.', '.hbb.', 'hhbbb', 'hbbbd', '.bdd.']), pal: { k: K, t: 0xd8901c, h: 0xd0d4e0, b: 0x9aa0b4, d: 0x464a5c } },
  // 7x7: a heart (rest)
  heart: { rows: outlined(['rr.rr', 'rWrrr', 'rrrrd', '.rrd.', '..d..']), pal: { k: K, r: 0xf05a48, W: 0xffd0c0, d: 0xa01828 } },
  // 7x7: a coin (shop)
  coin: { rows: outlined(['.yyy.', 'yWyyy', 'yyoyd', 'yyoyd', '.ddd.']), pal: { k: K, y: 0xf2c230, W: 0xfff0a0, o: 0xd8901c, d: 0x9a5a14 } },
  // 7x7: a warning sign (risky)
  warn: { rows: outlined(['..o..', '.oKo.', '.oKo.', 'ooooo', 'ooKoo']), pal: { k: K, o: 0xffb030, K: 0x3a1a0a } },
  // 9x8: a tent with a pennant (the camp)
  tent: { rows: outlined(['...f...', '...pr..', '..RpR..', '.RRdRr.', 'RRddRrr', 'RRddRrr']), pal: { k: K, f: 0xf2c230, p: 0x6e4020, R: 0xe0463c, r: 0xa8202c, d: 0x2a0e14 } },
  // 9x7: a tick (cleared)
  check: { rows: outlined(['......G', '.....GG', 'G...GG.', 'GG.GG..', '.GGG...']), pal: { k: K, G: 0x8af06a } },
  // 7x8: a padlock (locked)
  lock: { rows: outlined(['.sss.', 's...s', 's...s', 'GGGGG', 'GGkGG', 'ggggg']), pal: { k: K, s: 0x9aa0b4, G: 0xf2c230, g: 0xd8901c } },
  // 7x7: a target (accuracy)
  target: { rows: outlined(['.rrr.', 'rWWWr', 'rWrWr', 'rWWWr', '.rrr.']), pal: { k: K, r: 0xf05a48, W: 0xffffff } },
  // 9x9: a chunky right arrow ("before -> after"), lit on top
  arrow: { rows: outlined(['...a...', '...aa..', 'aaaaaa.', 'aaaaaaa', 'AAAAAA.', '...AA..', '...A...']), pal: { k: K, a: 0xffe680, A: 0xd8901c } },
  // 9x11: a hand tapping (index finger up; the tap-zone hints)
  hand: {
    rows: outlined(['..W....', '.WWs...', '.WWs...', '.WWWsWs', 'sWWWWWW', 'WWWWWWW', 'WWWWWWs', '.WWWWs.', '..cCc..']),
    pal: { k: K, W: 0xf2b888, s: 0xd88a5a, c: 0x2a6ad8, C: 0x4aa0f0 },
  },
};

export const glyphSize = (key: string): [number, number] => {
  const r = GLYPHS[key].rows;
  return [r[0].length, r.length];
};

/** Draw a glyph with its top-left at (x, y); `pal` overrides colors (a bag in a rarity's colors); `scale` whole px. */
export function glyph(g: Phaser.GameObjects.Graphics, key: string, x: number, y: number, alpha = 1, pal?: Record<string, number>, scale = 1): void {
  const gl = GLYPHS[key];
  if (!gl) return;
  const P = pal ? { ...gl.pal, ...pal } : gl.pal;
  gl.rows.forEach((r, yy) => {
    for (let xx = 0; xx < r.length; ) {
      const col = P[r[xx]];
      let n = 1;
      while (xx + n < r.length && r[xx + n] === r[xx]) n++;
      if (col !== undefined) {
        g.fillStyle(col, alpha);
        g.fillRect(Math.round(x) + xx * scale, Math.round(y) + yy * scale, n * scale, scale);
      }
      xx += n;
    }
  });
}

/** A bag's colors from a face [hi, base, lo, deep]. */
export const bagPal = (face: readonly [number, number, number, number]) => ({ h: face[0], b: face[1], d: face[3] });

/** Width of a "stat before -> after" line (see previewLine). */
export function previewWidth(p: BoostPreview, stat = true): number {
  return (stat ? textWidth(p.stat, 1, false) + 3 : 0) + textWidth(p.before, 1, true) + 2 + glyphSize('arrow')[0] + 2 + textWidth(p.after, 1, true);
}

/**
 * "ATK 14 -> 16": the stat (dim), the value now, an arrow, and the value after the boost (bright, in `col`),
 * vertically centered on y. Returns the width.
 */
export function previewLine(g: Phaser.GameObjects.Graphics, texts: TextPool, p: BoostPreview, x: number, y: number, col: number, alpha = 1, stat = true): number {
  let cx = x;
  if (stat) {
    texts.text(p.stat, cx, y + 0.5, 0xb8b0dc, { oy: 0.5, alpha });
    cx += textWidth(p.stat, 1, false) + 3;
  }
  texts.text(p.before, cx, y, 0xe0dcf0, { bold: true, oy: 0.5, alpha });
  cx += textWidth(p.before, 1, true) + 2;
  glyph(g, 'arrow', cx, Math.round(y) - 5, alpha, { a: col, A: mix(col, 0x2a1840, 0.35) });
  cx += glyphSize('arrow')[0] + 2;
  texts.text(p.after, cx, y, col, { bold: true, oy: 0.5, alpha });
  return cx + textWidth(p.after, 1, true) - x;
}

/** Boost card looks per rarity: button face [hi, base, lo, deep], icon well [fill, top line], tag. */
export const CARD: Record<Rarity, { face: readonly [number, number, number, number]; well: [number, number]; tag: string }> = {
  common: { face: [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26], well: [0x2a8a2e, 0x1e6a24], tag: '' },
  rare: { face: [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a], well: [0x2456b0, 0x1a3c8a], tag: 'RARE' },
  epic: { face: [0xf0b8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a], well: [0x6a2aa8, 0x4a1a7a], tag: 'EPIC' },
};

type G = Phaser.GameObjects.Graphics;

/** A relic's card colours by its rarity (the boost cards' common / rare / epic). */
const RARITY_FACE_OF = (r: Rarity) => CARD[r].face;
/** A colour lifted toward white (letters on dark panels). */
const mixLight = (c: number) => mix(c, WHITE, 0.45);

/** Title entrance: when each piece has arrived (ms after the title appears). */
const TITLE_IN = { heroes: 340, logo: 420, ribbon: 460, prompt: 420 };

export class Overlays {
  gCards!: G;
  private texts: TextPool;
  /** The picked boost card flies off above everything (even the screen transition). */
  private gFly: G | null = null;
  private flyTexts: TextPool;
  private logo: Phaser.GameObjects.Image | null = null;
  private shine: Phaser.GameObjects.Image | null = null;
  private shineFrames = 0;
  private heroBig: Phaser.GameObjects.Image | null = null;
  private pipBig: Phaser.GameObjects.Image | null = null;
  private chest: Phaser.GameObjects.Image | null = null;
  private chestAt = 0;
  private chestOpenAt = 0;
  private banner = '';
  private bannerAt = -1e9;
  private bannerUntil = 0;
  private bannerWaited = false;
  /** New run over a saved one needs a second tap within this time. */
  private newRunArmedUntil = 0;
  private lastPhase: Phase | null = null;
  private phaseAt = 0; // when the current phase started drawing (performance.now)
  private picked: { offer: BoostOffer; preview: BoostPreview; r: Rect; at: number } | null = null;
  private rerollAt2 = -1e9;
  /** The phase before the current one (onPhase's): back from the camp, the act-clear chest is already open. */
  private shownPhase: Phase | null = null;
  /** Act clear and defeat: shown straight away (no entrance) when coming back from the camp. */
  private backFromCamp = false;
  /** The accuracy's count-up starts here (anim ms). */
  private accAt = 0;
  /** Relic icons over the cards and panels (over gCards, under the texts), and over the flying card and toasts. */
  private pool: ImagePool;
  private flyPool: ImagePool;
  /** The relic panel (a fight paused from the HUD's relic belt): the relic shown in detail (null = closed). */
  relicSel: number | null = null;
  private relicAt = 0;
  /** "New relic unlocked!": when the card on screen popped in (0 = not yet). */
  private unlockAt = 0;
  /** "Level up!" toast after a fight (the loot or the pick): the level reached, and when (performance.now). */
  private levelToast: { level: number; at: number } | null = null;
  /** Act clear: the XP bar's level as last shown (its "Level up!" plays as the bar crosses into the next). */
  private xpLevel = 0;
  private xpUpAt = -1e9;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32);
    this.flyTexts = new TextPool(s, 41.5);
    this.pool = new ImagePool(s);
    this.flyPool = new ImagePool(s);
  }

  createTexts(): void {
    // texts come from the pools on demand
  }

  /** Regenerate the logo and the title's showcase sprites for a new layout. */
  build(): void {
    const s = this.s;
    buildCrest(s);
    this.shineFrames = buildLogo(s);
    for (const o of [this.logo, this.shine, this.heroBig, this.pipBig]) o?.destroy();
    this.heroBig = s.add.image(0, 0, 'hero_idle0').setOrigin(HERO_FEET_X / HERO_W, 1).setScale(2).setDepth(31.3).setVisible(false);
    this.pipBig = s.add.image(0, 0, 'pip_idle0').setOrigin(0.5, 0.5).setScale(2).setDepth(31.3).setVisible(false);
    this.logo = s.add.image(0, 0, 'logo').setOrigin(0, 0).setDepth(31.6).setVisible(false);
    this.shine = s.add.image(0, 0, 'logo_shine_0').setOrigin(0, 0).setDepth(31.7).setVisible(false);
    this.gFly?.destroy();
    this.gFly = s.add.graphics().setDepth(41);
    this.pool.destroy();
    this.flyPool.destroy();
  }

  showBanner(text: string): void {
    this.banner = text;
    this.bannerAt = performance.now();
    this.bannerUntil = this.bannerAt + 1700;
  }

  onPhase(next: Phase): void {
    const s = this.s;
    const prev = this.shownPhase;
    this.shownPhase = next;
    this.backFromCamp = prev === 'camp';
    this.unlockAt = 0;
    if (next !== 'fight') this.relicSel = null;
    // levels the fight's kills brought: a toast as the loot (or the pick) comes up; the act clear's bar shows its own
    if ((next === 'loot' || next === 'boost') && s.app.run.takeLevelUps() > 0) {
      this.levelToast = { level: this.heroLevel(), at: performance.now() };
      s.later(150, () => s.app.audio.rareSting(true));
    }
    if (next === 'actClear' && !this.backFromCamp) {
      s.app.run.takeLevelUps();
      this.xpLevel = levelProgress(s.app.tuning, this.xpBefore()).level;
      this.xpUpAt = -1e9;
    }
    if (next === 'boost') {
      // a rare or epic card on offer gets a sting
      const best = s.app.run.boostChoices.reduce((m, o) => (o.rarity === 'epic' ? 2 : o.rarity === 'rare' ? Math.max(m, 1) : m), 0);
      if (best > 0) s.later(120, () => s.app.audio.rareSting(best === 2));
    }
    if (next === 'actClear' || next === 'treasure') {
      this.chest?.destroy();
      const reopen = next === 'actClear' && this.backFromCamp;
      this.chest = s.add.image(GAME_W / 2, -30, reopen ? 'chest_open' : 'chest_closed').setOrigin(0.5, 1).setScale(2);
      s.actors.add(this.chest);
      // back from the camp: the chest stands open where it was, the accuracy and the buttons are already up
      this.chestAt = reopen ? s.anim - 2000 : s.anim;
      this.chestOpenAt = reopen ? s.anim - 2000 : 0;
      this.accAt = reopen ? s.anim - 5000 : 0;
    } else if (this.chest) {
      this.chest.destroy();
      this.chest = null;
    }
  }

  /** Treasure: the first tap bursts the chest open and spills its coins; then the boost pick comes up. */
  treasureTap(): void {
    const s = this.s;
    if (this.chestOpenAt || !this.levelClearTap()) return;
    if (!this.chestOpenAt) return;
    const coins = s.app.run.treasure?.coins ?? 0;
    const x = this.chest?.x ?? 0;
    s.hud.dropCoins(x, s.ground - 20, coins);
    s.fx.iconFloat(x + 18, s.ground - 44, `+${coins}`, 0xffe066, 'coin');
    s.later(900, () => {
      if (s.app.run.phase === 'treasure') s.app.setPhase(() => s.app.run.openTreasure());
    });
  }

  /** Act clear (and treasure): the first tap bursts the chest open (returns true = consumed); the next one moves on. */
  levelClearTap(): boolean {
    const s = this.s;
    if (!this.chest) return false;
    if (!this.chestOpenAt) {
      if (s.anim - this.chestAt < 550) return true;
      this.chestOpenAt = s.anim;
      this.accAt = s.anim;
      this.chest.setTexture('chest_open');
      const x = this.chest.x;
      const y = s.ground - 18;
      s.fx.burst(x, y, 0xf2c230, 30, true, 1.6);
      s.fx.burst(x, y, 0x5ae070, 12, true, 1.4);
      s.fx.burst(x, y, WHITE, 10, true, 1.2, true);
      s.fx.ring(x, y, 34, 0xffe680, true);
      s.fx.shake(s.app.tuning.juice.shakeMaxPx, 160);
      s.app.audio.kill();
      return true;
    }
    return s.anim - this.chestOpenAt < 400;
  }

  /** The chest drops in and bounces; sparkles rise from it until it is opened. */
  updateChest(now: number): void {
    const s = this.s;
    if (!this.chest) return;
    const k = clamp01((s.anim - this.chestAt) / 600);
    const bounce = k < 0.6 ? (k / 0.6) ** 2 : 1 - Math.abs(Math.sin((k - 0.6) * Math.PI * 2.5)) * 0.12 * (1 - k);
    this.chest.setY(Math.round(-30 + (s.ground + 30) * bounce));
    if (!this.chestOpenAt && Math.random() < 0.25) {
      const sx = this.chest.x + rand(-20, 20);
      const sy = this.chest.y - rand(4, 30);
      s.fx.particles.push({ x: sx, y: sy, vx: 0, vy: -12, g: 0, born: now, life: 420, color: Math.random() < 0.5 ? 0xfff0a0 : WHITE, size: 1, world: true, streak: false });
    }
  }

  // ------------------------------------------------------------------ layout and taps

  /** Title screen with a saved run: Continue (left) and New run (right), on the band. */
  private titleButtons(): { cont: Rect; fresh: Rect } {
    const cx = Math.round(GAME_W / 2);
    const y = this.s.splitY - 6;
    return { cont: { x: cx - 112, y, w: 120, h: 22 }, fresh: { x: cx + 16, y, w: 96, h: 22 } };
  }

  /** Which title button a tap hits. New run arms on the first tap and only fires on the second. */
  titleTap(x: number, y: number): 'continue' | 'new' | null {
    const b = this.titleButtons();
    if (inRect(b.cont, x, y, 3)) {
      notePress(b.cont);
      return 'continue';
    }
    if (inRect(b.fresh, x, y, 3)) {
      notePress(b.fresh);
      const now = performance.now();
      if (now < this.newRunArmedUntil) return 'new';
      this.newRunArmedUntil = now + 2500;
      this.s.app.audio.uiClick();
    }
    return null;
  }

  // ---- act clear: the accuracy plate on the stage, Camp / Next on the console under it

  /** When the act-clear extras come in (anim ms after the chest burst): the accuracy, then the two buttons. */
  private static readonly CLEAR_ACC_MS = 380;
  private static readonly CLEAR_BTN_MS = 620;

  private clearButtons(): { camp: Rect; next: Rect } {
    const s = this.s;
    const cx = Math.round((s.L + s.R) / 2);
    const y = s.splitY + 24;
    return { camp: { x: cx - 92, y, w: 70, h: 16 }, next: { x: cx - 14, y, w: 106, h: 16 } };
  }

  /** The act-clear buttons are up (the chest has burst and they've popped in). */
  private clearReady(): boolean {
    return !!this.chestOpenAt && this.s.anim - this.chestOpenAt >= Overlays.CLEAR_BTN_MS;
  }

  /**
   * A tap on the act-clear screen (x < 0: the keyboard): the first bursts the chest; then Camp or Next. Taps
   * anywhere else do nothing, so nobody skips past the screen by accident.
   */
  actClearTap(x: number, y: number): 'camp' | 'next' | null {
    if (!this.chestOpenAt) {
      this.levelClearTap();
      return null;
    }
    if (!this.clearReady()) return null;
    const b = this.clearButtons();
    if (x < 0) return 'next';
    for (const k of ['camp', 'next'] as const)
      if (inRect(b[k], x, y, 3)) {
        notePress(b[k]);
        this.s.app.audio.uiClick();
        return k;
      }
    return null;
  }

  // ---- defeat: Camp and Retry the act, side by side

  private defeatButtons(): { camp: Rect; retry: Rect } {
    const cx = Math.round(GAME_W / 2);
    const y = 68;
    return { camp: { x: cx - 96, y, w: 70, h: 18 }, retry: { x: cx - 18, y, w: 114, h: 18 } };
  }

  /** A tap on the defeat screen (x < 0: the keyboard retries): Camp, Retry the act, or nothing. */
  defeatTap(x: number, y: number): 'camp' | 'retry' | null {
    if (performance.now() - this.phaseAt < 700 && !this.backFromCamp) return null;
    if (x < 0) return 'retry';
    const b = this.defeatButtons();
    for (const k of ['camp', 'retry'] as const)
      if (inRect(b[k], x, y, 3)) {
        notePress(b[k]);
        this.s.app.audio.uiClick();
        return k;
      }
    return null;
  }

  /** Boost choices: a navy panel with three stacked cards (hit-tested by index). */
  private boostPanel(): Rect {
    return { x: Math.round(GAME_W / 2 - 128), y: 25, w: 256, h: 116 };
  }

  cardRect(i: number): Rect {
    const p = this.boostPanel();
    return { x: p.x + 8, y: p.y + 10 + i * 34, w: p.w - 16, h: 32 };
  }

  /** The reroll button on the boost panel's top edge (shown while the run has rerolls bought at a shop). */
  private rerollRect(): Rect {
    const p = this.boostPanel();
    return { x: p.x + 6, y: p.y - 6, w: 54, h: 12 };
  }

  rerollAt(x: number, y: number): boolean {
    const hit = this.s.app.run.rerolls > 0 && inRect(this.rerollRect(), x, y, 3);
    if (hit) {
      notePress(this.rerollRect());
      this.rerollAt2 = performance.now();
    }
    return hit;
  }

  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++)
      if (inRect(this.cardRect(i), x, y)) {
        const run = this.s.app.run;
        const offer = run.boostChoices[i];
        if (offer) this.picked = { offer, preview: boostPreview(run.tuning, run.hero, offer), r: this.cardRect(i), at: performance.now() };
        return i;
      }
    return -1;
  }

  // ------------------------------------------------------------------ drawing helpers

  /**
   * A boost card. A relic: its icon, name, tag chips (a tag shared with a relic you own lit gold, and a "Synergy!"
   * badge), rarity and what it does (relic-ui.ts relicCard). A stat card: the icon tile, the name, and what it does to
   * the hero's stat right now ("ATK 14 -> 16").
   */
  private card(c: CardCtx, r: Rect, offer: BoostOffer, preview: BoostPreview, now: number, flash = 0, alpha = 1): void {
    const s = this.s;
    if (isRelicOffer(offer)) {
      relicCard(c, r, offer.relic, { owned: s.app.run.hero.relics, tuning: s.app.tuning, now, flash, alpha });
      return;
    }
    const { g, texts } = c;
    const look = CARD[offer.rarity];
    const [hi] = look.face;
    cardFrame(g, r, look.face, offer.rarity, now, alpha);
    const tile: Rect = { x: r.x + 2, y: r.y + 2, w: 22, h: r.h - 4 };
    cardTile(g, tile, look.face, alpha);
    const icon = BOOST_ICON[offer.id];
    const [iw, ih] = iconSize(icon);
    hudIcon(g, icon, tile.x + ((tile.w - iw) >> 1), tile.y + ((tile.h - ih) >> 1), 1, alpha);
    const [name] = boostLabel(s.app.tuning, offer);
    texts.text(name, r.x + 29, r.y + 9, WHITE, { bold: true, oy: 0.5, alpha });
    // the stat as it stands, and after this card: a dark inset strip under the name
    const showStat = preview.stat !== name; // "Max HP 100 -> 120" under "Max HP" says it twice
    const pw = previewWidth(preview, showStat);
    rows(g, r.x + 27, r.y + 16, pw + 6, 11, 2, NAVY[1], 0.85 * alpha);
    band(g, r.x + 27, r.y + 16, pw + 6, 11, 2, 0, 1, INK, alpha);
    previewLine(g, texts, preview, r.x + 30, r.y + 21.5, offer.rarity === 'common' ? 0xb4f070 : mix(hi, WHITE, 0.25), alpha, showStat);
    if (look.tag) {
      const tw = textWidth(look.tag, 1, false) + 6;
      const tr: Rect = { x: r.x + r.w - tw - 3, y: r.y + 4, w: tw, h: 9 };
      tag(g, tr, look.face, alpha);
      texts.text(look.tag, tr.x + 3, tr.y + 4.5, WHITE, { oy: 0.5, alpha });
    }
    cardShine(g, r, offer.rarity, now, alpha);
    if (flash > 0) {
      g.fillStyle(WHITE, flash * alpha);
      g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
  }

  /** A four-point twinkle. */
  private star(g: G, x: number, y: number, size: number, color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.fillRect(x - size, y, size * 2 + 1, 1);
    g.fillRect(x, y - size, 1, size * 2 + 1);
    if (size >= 2) {
      g.fillStyle(WHITE, alpha);
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  /** A big prompt on a dark strip with chevrons sliding in from both sides (TAP TO BEGIN, tap to start). */
  private prompt(g: G, text: string, cy: number, now: number, color = WHITE, alpha = 1): void {
    const w = textWidth(text, 2, true);
    const p = pulse(now, 900);
    strip(g, 0, cy - 12, GAME_W, 24, 0.55 * alpha);
    const cx = Math.round(GAME_W / 2);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const k = ((now / 600 + i / 3) % 1 + 1) % 1;
        const x = Math.round(cx + side * (w / 2 + 30 - k * 18));
        chevron(g, x, cy - 5, 11, i === 0 ? GOLD[4] : GOLD[3], alpha * Math.sin(k * Math.PI), -side, true);
      }
    this.texts.text(text, cx, cy + 1, mix(color, WHITE, 0.4 * p), { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: alpha * (0.8 + 0.2 * p), extrude: 1, extrudeCol: 0x2a2046 });
  }

  // ------------------------------------------------------------------ the frame

  draw(now: number): void {
    const s = this.s;
    const g = s.gTop;
    const gc = this.gCards;
    const txt = s.txt;
    g.clear();
    gc.clear();
    this.gFly?.clear();
    this.texts.begin();
    this.flyTexts.begin();
    this.pool.begin();
    this.flyPool.begin();
    const run = s.app.run;
    const ph = run.phase;
    if (ph !== this.lastPhase) {
      this.lastPhase = ph;
      this.phaseAt = now;
    }
    if (now < s.fx.screenFlashUntil) {
      // scene only: the bar must stay readable
      g.fillStyle(s.fx.screenFlashColor, Math.min(0.6, (s.fx.screenFlashUntil - now) / 260));
      g.fillRect(0, 0, GAME_W, s.splitY);
    }
    if (now < s.fx.impactFlashUntil || s.fx.impactFlashPending) {
      // heavy impact: the scene goes white for a frame or two
      s.fx.impactFlashPending = false;
      g.fillStyle(WHITE, 0.82);
      g.fillRect(0, 0, GAME_W, s.splitY);
    }
    // the old named texts are no longer used by the overlays
    for (const k of ['ovTitle', 'ovSub', 'ovLine1', 'ovLine2', 'ovLine3', 'begin', 'banner', 'tCont', 'tContSub', 'tNew']) txt[k]?.setVisible(false);
    const titleOn = ph === 'title';
    this.logo?.setVisible(titleOn);
    this.shine?.setVisible(false);
    this.heroBig?.setVisible(titleOn);
    this.pipBig?.setVisible(titleOn);
    const since = now - this.phaseAt;
    if (ph === 'fight') this.drawBanner(g, now);
    if (ph === 'title') this.drawTitle(g, gc, now, since);
    else if (ph === 'boost') this.drawBoost(g, gc, now, since);
    else if (ph === 'actClear') this.drawChestScreen(g, gc, now, true);
    else if (ph === 'treasure') this.drawChestScreen(g, gc, now, false);
    else if (ph === 'defeat') this.drawDefeat(g, gc, now, since);
    else if (ph === 'victory') this.drawVictory(g, gc, now, since);
    else if (ph === 'fight' && s.app.storyOverlay) {
      // a boss's scene: the story view draws it
    } else if (ph === 'fight' && s.app.awaitingBegin && !s.app.userPaused) {
      if (this.twinTutorial()) this.drawTwinTutorial(g, gc, now);
      else this.prompt(g, 'TAP TO BEGIN!', now < this.bannerUntil ? 56 : 50, now);
    } else if (ph === 'fight' && s.app.userPaused) {
      if (this.relicSel !== null && run.hero.relics.length) this.drawRelicPanel(g, gc, now);
      else this.drawPause(g, gc, now);
    }
    if (ph !== 'fight' || !s.app.userPaused) this.relicSel = null;
    this.drawPicked(now);
    if (this.gFly) {
      this.drawLevelToast(this.gFly, now);
      if (this.unlockActive()) this.drawUnlock(this.gFly, now);
    }
    this.texts.end();
    this.flyTexts.end();
    this.pool.end();
    this.flyPool.end();
  }

  /** The dim behind menus, darker toward the edges (a vignette) so the middle stays lit. */
  private dim(g: G, a: number, color = 0x05040a): void {
    g.fillStyle(color, a);
    g.fillRect(0, 0, GAME_W, GAME_H);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(color, a * 0.22);
      g.fillRect(0, 0, GAME_W, 4 + i * 4);
      g.fillRect(0, GAME_H - 4 - i * 4, GAME_W, 4 + i * 4);
      g.fillRect(0, 0, 6 + i * 6, GAME_H);
      g.fillRect(GAME_W - 6 - i * 6, 0, 6 + i * 6, GAME_H);
    }
  }

  // ------------------------------------------------------------------ title

  private drawTitle(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const L = s.L;
    const R = s.R;
    const cx = Math.round(GAME_W / 2);
    // the sky darkens toward the top behind the logo; the stage dims a touch
    g.fillStyle(0x05040a, 0.14);
    g.fillRect(0, 0, GAME_W, s.splitY);
    for (let y = 0; y < 72; y += 4) {
      g.fillStyle(0x0a0618, 0.42 * (1 - y / 72) ** 1.6);
      g.fillRect(0, y, GAME_W, 4);
    }
    // (the stage's own hero and owl stay hidden on the title: fighters.ts makes way for these big showcase versions)

    // Rowan and Pip, 2x, slide in from the left; Rowan flourishes his sword now and then
    const hk = easeBack(since / TITLE_IN.heroes, 1.2);
    const slide = Math.round((1 - hk) * -140);
    const hx = L + 82 + slide;
    const cyc = now % 3600;
    const pose = cyc < 140 ? 'windup' : cyc < 340 ? 'slashA' : Math.floor(now / 420) % 2 ? 'idle1' : 'idle0';
    // a soft spotlight on the ground under them
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xfff0c0, 0.06);
      const w = 70 - i * 14;
      g.fillRect(hx - w / 2 - 8, s.ground - 3 + Math.floor(i / 2), w + 16, 3);
    }
    rows(g, hx - 22, s.ground - 2, 44, 5, 2, INK, 0.35);
    this.heroBig?.setTexture(`hero_${pose}`).setPosition(hx, s.ground);
    const px = L + 38 + slide;
    const py = Math.round(s.ground - 46 + Math.sin(now / 300) * 3);
    this.pipBig?.setTexture(Math.floor(now / 110) % 2 ? 'pip_idle1' : 'pip_idle0').setPosition(px, py);
    if (cyc >= 140 && cyc < 420) {
      const k = (cyc - 140) / 280;
      this.star(gc, hx + 44, s.ground - 52 + Math.round(k * 10), k < 0.5 ? 3 : 2, 0xfff0a0, 1 - k);
    }

    // the logo drops in with a bounce, bobs gently, and a gleam sweeps across it every few seconds
    const lw = this.logo?.width ?? 150;
    const lk = easeBack((since - 60) / (TITLE_IN.logo - 60), 1.4);
    const lx = Math.round(Math.min(R - 6 - lw, Math.max(cx - lw / 2, hx + 52)));
    const ly = Math.round(Math.max(18, s.ground - 78) - (1 - lk) * 90 + Math.sin(now / 650) * 1.5);
    this.logo?.setPosition(lx, ly);
    const sf = Math.floor(((now - this.phaseAt) % 2800) / 34);
    if (since > TITLE_IN.logo && sf < this.shineFrames) this.shine?.setTexture(`logo_shine_${sf}`).setPosition(lx, ly).setVisible(true);
    // twinkles around the crest
    for (let i = 0; i < 3; i++) {
      const q = ((now / 900 + i * 0.33) % 1 + 1) % 1;
      const sx = lx + lw - 46 + ((i * 31) % 44);
      const sy = ly + 12 + ((i * 17) % 40);
      if (q < 0.5 && lk >= 1) this.star(gc, sx, sy, q < 0.25 ? 2 : 1, 0xfff0a0, 1 - q * 2);
    }
    // region ribbon unfurls under the logo
    const rk = easeOut3((since - 220) / (TITLE_IN.ribbon - 220));
    const label = 'Region 1: Greenmarch';
    const rw = Math.round((textWidth(label, 1, true) + 16) * rk);
    if (rw > 6) {
      ribbon(gc, lx + 70, ly + 58, rw, 11, RIBBON.red, 1, rk > 0.8);
      if (rk >= 1) this.texts.text(label, lx + 70, ly + 63.5, 0xfff0a0, { bold: true, ox: 0.5, oy: 0.5 });
    }
    // drifting golden motes
    if (Math.random() < 0.2)
      s.fx.particles.push({ x: rand(L, R), y: s.ground - rand(0, 30), vx: rand(-4, 4), vy: rand(-14, -6), g: 0, born: now, life: rand(1400, 2400), color: Math.random() < 0.5 ? 0xfff0a0 : 0xffd23a, size: 1, world: true, streak: false });

    // the band: Continue / New run (with a save), or the start prompt; how-to tips in the tray under it
    const save = s.app.savedRun;
    const pa = clamp01((since - 260) / (TITLE_IN.prompt - 260));
    if (save) {
      const { cont, fresh } = this.titleButtons();
      const armed = now < this.newRunArmedUntil;
      const ck = easeBack((since - 200) / 260, 1.6);
      const dy = Math.round((1 - ck) * 30);
      if (ck > 0) {
        glow(gc, { ...cont, y: cont.y + dy }, 0x8af06a, 0.35 + 0.3 * pulse(now, 900), 3);
        button3d(gc, { ...cont, y: cont.y + dy }, FACE.green, isPressed(cont, now));
        button3d(gc, { ...fresh, y: fresh.y + dy }, armed ? FACE.red : FACE.navy, isPressed(fresh, now));
        const pc = isPressed(cont, now) ? 2 : 0;
        this.texts.text('Continue', cont.x + cont.w / 2, cont.y + dy + 7 + pc, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
        this.texts.text(saveLabel(save, s.app.run), cont.x + cont.w / 2, cont.y + dy + 16 + pc, 0xfff07a, { ox: 0.5, oy: 0.5 });
        const pf = isPressed(fresh, now) ? 2 : 0;
        this.texts.text(armed ? 'Tap again' : 'New run', fresh.x + fresh.w / 2, fresh.y + dy + fresh.h / 2 + pf, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      }
    } else if (pa > 0) this.prompt(g, 'Tap to start!', s.splitY + 16, now, WHITE, pa);
    if (pa > 0) {
      const ty = s.splitY + 32 + Math.round((GAME_H - s.splitY - 32 - (GAME_H - s.B)) / 2);
      const tips: Array<[readonly number[], string]> = [
        [COL.yellow, 'Tap on blocks'],
        [COL.red, 'Tap red to block'],
        [COL.purple, 'Avoid purple'],
      ];
      const widths = tips.map(([, t]) => textWidth(t, 1, false) + 10);
      const total = widths.reduce((a, b) => a + b, 0) + (tips.length - 1) * 12;
      let x = Math.round(cx - total / 2);
      tips.forEach(([col, t], i) => {
        const [base, light, dark] = col;
        brick(gc, x, ty - 4, 6, 9, [light, base, dark, mix(dark, INK, 0.4)], pa);
        this.texts.text(t, x + 9, ty + 1, i === 0 ? 0xfff0c0 : i === 1 ? 0xffb0a0 : 0xdab0ff, { oy: 0.5, alpha: pa });
        x += widths[i] + 12;
        if (i < tips.length - 1) {
          gc.fillStyle(NAVY[5], pa);
          gc.fillRect(x - 7, ty - 1, 2, 2);
        }
      });
    }
  }

  // ------------------------------------------------------------------ boost pick

  private drawBoost(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const run = s.app.run;
    this.dim(g, 0.45);
    // the panel pops in (grows with a little overshoot), then the cards slide in one after another
    const p0 = this.boostPanel();
    const k = easeBack(since / 240, 1.5);
    const sc = 0.75 + 0.25 * k;
    const p: Rect = { x: Math.round(p0.x + (p0.w * (1 - sc)) / 2), y: Math.round(p0.y + (p0.h * (1 - sc)) / 2), w: Math.round(p0.w * sc), h: Math.round(p0.h * sc) };
    if (since < 60) return;
    panel(gc, p, { trim: 'full', alpha: clamp01(since / 120) });
    if (k < 0.98) return;
    // a replay's opening draft counts its picks; a pick with a relic in it is a relic pick
    const title = run.startPick ? `Starting relic ${run.startPicksTotal - run.startPicks + 1}/${run.startPicksTotal}` : run.boostChoices.some(isRelicOffer) ? 'Choose a Relic' : 'Choose a Boost';
    ribbon(gc, p.x + p.w / 2, p.y - 6, Math.max(112, textWidth(title, 1, true) + 22), 13, RIBBON.purple);
    this.texts.text(title, p.x + p.w / 2, p.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const ctx: CardCtx = { s, g: gc, texts: this.texts, pool: this.pool, depth: 31.55 };
    run.boostChoices.forEach((offer, i) => {
      const ck = easeBack((since - 120 - i * 70) / 260, 1.4);
      if (ck <= 0) return;
      const r0 = this.cardRect(i);
      const r = { ...r0, x: r0.x + Math.round((1 - ck) * 70) };
      const rr = (now - this.rerollAt2) / 300;
      this.card(ctx, r, offer, boostPreview(run.tuning, run.hero, offer), now + i * 300, rr >= 0 && rr < 1 ? 0.7 * (1 - rr) : 0, clamp01(ck * 1.5));
    });
    if (run.rerolls > 0) {
      const rr = this.rerollRect();
      const pr = isPressed(rr, now);
      button3d(gc, rr, FACE.blue, pr);
      this.texts.text(`Reroll x${run.rerolls}`, rr.x + rr.w / 2, rr.y + rr.h / 2 + (pr ? 2 : 0), WHITE, { ox: 0.5, oy: 0.5 });
    }
  }

  /** The picked card lifts, flashes and fades out over whatever comes next (even the screen wipe). */
  private drawPicked(now: number): void {
    const g = this.gFly;
    if (!g) return;
    const p = this.picked;
    if (p) {
      const k = (now - p.at) / 340;
      if (k >= 1 || this.s.app.run.phase === 'boost') {
        if (k >= 1) this.picked = null;
      } else {
        const r = { ...p.r, y: p.r.y - Math.round(easeOut3(k) * 10) };
        glow(g, r, CARD[p.offer.rarity].face[0], 0.8 * (1 - k), 4);
        this.card({ s: this.s, g, texts: this.flyTexts, pool: this.flyPool, depth: 41.2 }, r, p.offer, p.preview, now, Math.max(0, 0.8 - k * 2), 1 - k * k);
      }
    }
  }

  // ------------------------------------------------------------------ chest screens, defeat, victory, pause

  private drawChestScreen(g: G, gc: G, now: number, actClear: boolean): void {
    const s = this.s;
    const run = s.app.run;
    const cx = Math.round(GAME_W / 2);
    const opened = !!this.chestOpenAt;
    const since = now - this.phaseAt;
    const k = easeBack(since / 300, 1.5);
    // a banner (the big title on a ribbon) drops in under the HUD buttons; the hint sits under it
    const y = Math.round(20 - (1 - k) * 50);
    g.fillStyle(0x0a0618, 0.22);
    g.fillRect(0, 0, GAME_W, 54);
    const clear = actClear && opened;
    const ok = clear ? Math.min(1, easeBack((s.anim - this.chestOpenAt) / 320, 1.8)) : 1;
    const title = clear ? `Act ${run.actIndex + 1} Clear!` : actClear ? run.act.name : 'Treasure!';
    const look = clear ? RIBBON.gold : actClear ? RIBBON.blue : RIBBON.gold;
    const tw = textWidth(title, 2, true);
    ribbon(gc, cx, y, Math.round((tw + 24) * (clear ? ok : 1)), 22, look, 1, ok > 0.9);
    if (ok > 0.5)
      this.texts.text(title, cx, y + 11, clear ? 0xfff6c0 : actClear ? WHITE : 0xfff6c0, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: clear || !actClear ? 0x7a3a0a : 0x10204a });
    if (clear) this.drawXp(gc, now);
    else this.drawStatus(gc, now);
    if (!clear) this.texts.text(actClear ? 'Tap the chest to continue' : 'Tap the chest', cx, y + 32, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    if (clear) {
      for (let i = 0; i < 4; i++) {
        const q = ((now / 900 + i * 0.27) % 1 + 1) % 1;
        if (q < 0.45) this.star(gc, Math.round(cx - tw / 2 - 6 + ((i * 47) % (tw + 12))), y - 3 + ((i * 13) % 28), q < 0.2 ? 2 : 1, 0xfff0a0, 1 - q / 0.45);
      }
      this.drawClearExtras(gc, now);
      this.drawBuild(gc, now);
    } else if (this.chest && s.anim - this.chestAt > 600) {
      // a bouncing arrow beside the chest, pointing at it
      const ax = Math.round(this.chest.x + 30 + Math.abs(Math.sin(now / 220)) * 5);
      const ay = Math.round(this.chest.y - 20);
      chevron(gc, ax, ay - 5, 11, GOLD[3], 1, -1, true);
      chevron(gc, ax + 4, ay - 5, 11, GOLD[4], 1, -1, true);
    }
  }

  /**
   * After the act-clear chest bursts: the act's accuracy on a plate under the title (the number counts up), then
   * Camp and Next on the console, popping in one after the other.
   */
  private drawClearExtras(gc: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const since = s.anim - this.chestOpenAt;
    const cx = Math.round(GAME_W / 2);
    // ---- accuracy
    const ak = easeBack((since - Overlays.CLEAR_ACC_MS) / 300, 1.6);
    if (ak > 0) {
      const a = clamp01((since - Overlays.CLEAR_ACC_MS) / 160);
      const e = run.actAccuracy;
      const [gw] = glyphSize('target');
      let w: number;
      if (e) {
        const count = clamp01((s.anim - this.accAt - Overlays.CLEAR_ACC_MS - 120) / 650);
        const pct = `${Math.round(e.acc * 100 * easeOut3(count))}%`;
        const full = `${Math.round(e.acc * 100)}%`;
        const l1 = 'Accuracy this act:';
        const l3 = `(${e.n} taps)`;
        w = gw + 4 + textWidth(l1, 1, false) + 3 + textWidth(full, 1, true) + 3 + textWidth(l3, 1, false) + 12;
        const r: Rect = { x: Math.round(cx - w / 2), y: 44 + Math.round((1 - ak) * -8), w, h: 13 };
        panel(gc, r, { alpha: a, r: 3, bevel: NAVY[7] });
        let x = r.x + 6;
        glyph(gc, 'target', x, r.y + 3, a);
        x += gw + 4;
        this.texts.text(l1, x, r.y + 7, 0xe8e4ff, { oy: 0.5, alpha: a });
        x += textWidth(l1, 1, false) + 3;
        // the number pops gold as it lands on the final value
        const done = count >= 1;
        this.texts.text(pct, x, r.y + 6.5, done ? 0xffe066 : WHITE, { bold: true, oy: 0.5, alpha: a });
        x += textWidth(full, 1, true) + 3;
        this.texts.text(l3, x, r.y + 7, 0xa8a0c8, { oy: 0.5, alpha: a });
        if (done && s.anim - this.accAt - Overlays.CLEAR_ACC_MS - 770 < 400) {
          const k = clamp01((s.anim - this.accAt - Overlays.CLEAR_ACC_MS - 770) / 400);
          glow(gc, r, 0xffe066, 0.5 * (1 - k), 3);
        }
      } else {
        const l = 'Accuracy: play more to measure';
        w = gw + 4 + textWidth(l, 1, false) + 12;
        const r: Rect = { x: Math.round(cx - w / 2), y: 44 + Math.round((1 - ak) * -8), w, h: 13 };
        panel(gc, r, { alpha: a, r: 3, bevel: NAVY[7] });
        glyph(gc, 'target', r.x + 6, r.y + 3, a * 0.6);
        this.texts.text(l, r.x + 6 + gw + 4, r.y + 7, 0xc8c0e8, { oy: 0.5, alpha: a });
      }
    }
    // ---- Camp and Next
    const b = this.clearButtons();
    const last = run.actIndex + 1 >= run.region.acts.length;
    const items: Array<{ r: Rect; face: readonly [number, number, number, number]; label: string; icon: string; delay: number }> = [
      { r: b.camp, face: FACE.navy, label: 'Camp', icon: 'tent', delay: 0 },
      { r: b.next, face: last ? FACE.gold : FACE.green, label: last ? 'Finish' : `Next: Act ${run.actIndex + 2}`, icon: '', delay: 90 },
    ];
    for (const it of items) {
      const k = easeBack((since - Overlays.CLEAR_BTN_MS + 140 - it.delay) / 260, 1.7);
      if (k <= 0) continue;
      const r = { ...it.r, y: it.r.y + Math.round((1 - k) * 14) };
      const pr = isPressed(it.r, now);
      if (it.icon === '' && k >= 1) glow(gc, r, it.face[0], 0.3 + 0.35 * pulse(now, 900), 3);
      button3d(gc, r, it.face, pr);
      const dy = pr ? 2 : 0;
      const tw = textWidth(it.label, 1, true);
      if (it.icon) {
        const [iw, ih] = glyphSize(it.icon);
        const x0 = Math.round(r.x + (r.w - iw - 3 - tw) / 2);
        glyph(gc, it.icon, x0, r.y + Math.round((r.h - ih) / 2) + dy);
        this.texts.text(it.label, x0 + iw + 3, r.y + r.h / 2 + dy, WHITE, { bold: true, oy: 0.5 });
      } else {
        // the way on: label and a pair of chevrons nudging right
        const x0 = Math.round(r.x + (r.w - tw - 10) / 2);
        this.texts.text(it.label, x0, r.y + r.h / 2 + dy, WHITE, { bold: true, oy: 0.5 });
        const nudge = Math.round(pulse(now, 700) * 2);
        chevron(gc, x0 + tw + 2 + nudge, r.y + 4 + dy, 7, WHITE, 1, 1, true);
      }
    }
  }

  /** Between fights the console shows the hero's status: HP, coins and revives. */
  private drawStatus(gc: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const dy = Math.round((1 - easeBack((now - this.phaseAt - 80) / 300, 1.4)) * 30);
    const y = s.splitY + 9 + dy;
    const coins = `${s.hud.coinsShown}`;
    const cw = textWidth(coins, 1, true) + 15;
    const total = 16 + 104 + 8 + cw + 6 + 20;
    let x = Math.round((s.L + s.R) / 2 - total / 2);
    hudIcon(gc, 'heart', x, y - 1);
    x += 18;
    gauge(gc, x, y + 1, 100, 8, H.hp / max, H.hp / max, { ramp: H.hp / max <= 0.3 ? RAMP.hpLow : RAMP.hp, seg: 10 });
    this.texts.text(`${H.hp}/${max}`, x + 50, y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    x += 110;
    const cr: Rect = { x, y, w: cw, h: 11 };
    tag(gc, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    hudIcon(gc, 'coin', cr.x + 2, cr.y + 1);
    this.texts.text(coins, cr.x + 12, cr.y + 5.5, 0xffe680, { bold: true, oy: 0.5 });
    x += cw + 6;
    const rr: Rect = { x, y, w: 20, h: 11 };
    tag(gc, rr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    hudIcon(gc, 'potionS', rr.x + 2, rr.y + 1, 1, H.revives > 0 ? 1 : 0.45);
    this.texts.text(`${H.revives}`, rr.x + 11, rr.y + 5.5, H.revives > 0 ? 0xffb0e0 : 0x8a84a0, { bold: true, oy: 0.5 });
  }

  private drawDefeat(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.55, 0x12030a);
    // a red pulse around the edges
    const p = pulse(now, 1400);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xa01828, (0.12 + 0.08 * p) * (1 - i / 4));
      g.fillRect(0, i * 3, GAME_W, 3);
      g.fillRect(0, GAME_H - (i + 1) * 3, GAME_W, 3);
    }
    // back from the camp: no entrance, the buttons are live at once
    const t = this.backFromCamp ? since + 1000 : since;
    const k = easeBack(t / 380, 1.6);
    const y = Math.round(36 - (1 - k) * 30);
    this.texts.text('DEFEATED', cx, y, 0xff5a5a, { bold: true, scale: 3, ox: 0.5, oy: 0.5, extrude: 3, extrudeCol: 0x4a0a14, alpha: clamp01(t / 150) });
    if (t > 250) {
      const sub = `${heroDef(s.app.run.hero.build?.id ?? 'rowan').name} falls... back to the start of Act ${s.app.run.actIndex + 1}`;
      strip(gc, cx - textWidth(sub) / 2 - 8, y + 16, textWidth(sub) + 16, 12, 0.7, false);
      this.texts.text(sub, cx, y + 22, 0xffe8e0, { ox: 0.5, oy: 0.5 });
      // Camp (equip what you found before trying again) and Retry, popping in one after the other
      const b = this.defeatButtons();
      const live = t > 700;
      const items: Array<{ r: Rect; face: readonly [number, number, number, number]; label: string; icon: string; delay: number }> = [
        { r: b.camp, face: live ? FACE.navy : FACE.grey, label: 'Camp', icon: 'tent', delay: 0 },
        { r: b.retry, face: live ? FACE.gold : FACE.grey, label: 'Retry the act', icon: '', delay: 80 },
      ];
      for (const it of items) {
        const bk = easeBack((t - 260 - it.delay) / 260, 1.7);
        if (bk <= 0) continue;
        const r = { ...it.r, y: it.r.y + Math.round((1 - bk) * 12) };
        const pr = isPressed(it.r, now);
        if (!it.icon && live) glow(gc, r, 0xffd23a, 0.3 + 0.4 * pulse(now, 800), 3);
        button3d(gc, r, it.face, pr);
        const dy = pr ? 2 : 0;
        const tw = textWidth(it.label, 1, true);
        if (it.icon) {
          const [iw, ih] = glyphSize(it.icon);
          const x0 = Math.round(r.x + (r.w - iw - 3 - tw) / 2);
          glyph(gc, it.icon, x0, r.y + Math.round((r.h - ih) / 2) + dy, live ? 1 : 0.6);
          this.texts.text(it.label, x0 + iw + 3, r.y + r.h / 2 + dy, WHITE, { bold: true, oy: 0.5 });
        } else this.texts.text(it.label, r.x + r.w / 2, r.y + r.h / 2 + dy, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
      }
    }
  }

  private drawVictory(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.5);
    // slow golden rays behind the title
    const ox = cx;
    const oy = 34;
    const rot = now / 4000;
    for (let i = 0; i < 12; i++) {
      const a0 = rot + (i / 12) * Math.PI * 2;
      const a1 = a0 + Math.PI / 18;
      g.fillStyle(i % 2 ? 0xffe680 : 0xfff6c0, 0.09);
      g.fillTriangle(ox, oy, Math.round(ox + Math.cos(a0) * 260), Math.round(oy + Math.sin(a0) * 260), Math.round(ox + Math.cos(a1) * 260), Math.round(oy + Math.sin(a1) * 260));
    }
    const k = easeBack(since / 420, 1.5);
    ribbon(gc, cx, 44, Math.round(220 * Math.min(1, k)), 12, RIBBON.gold, 1, k > 0.9);
    this.texts.text('Greenmarch is saved!', cx, 32 - Math.round((1 - Math.min(1, k)) * 12), 0xffd23a, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 2, extrudeCol: 0x5a3410 });
    if (since > 400) {
      this.texts.text('The first weight is home. Eleven to go.', cx, 49.5, 0x3a1e08, { bold: false, ox: 0.5, oy: 0.5, grad: [WHITE, 0xfff6d8] });
      const next = 'Next: the Frostpeaks (coming soon)';
      strip(gc, cx - textWidth(next) / 2 - 8, 60, textWidth(next) + 16, 12, 0.7, false);
      this.texts.text(next, cx, 66, 0xb8e4ff, { ox: 0.5, oy: 0.5 });
    }
    if (since > 1500) this.prompt(g, 'Tap to continue', 88, now, 0xfff07a);
    // a little shower of golden sparks
    if (Math.random() < 0.5) s.fx.particles.push({ x: rand(20, GAME_W - 20), y: -2, vx: rand(-10, 10), vy: rand(20, 40), g: 30, born: now, life: 2200, color: Math.random() < 0.5 ? 0xffe680 : WHITE, size: 1, world: true, streak: false });
    for (let i = 0; i < 5; i++) {
      const q = ((now / 1100 + i * 0.21) % 1 + 1) % 1;
      if (q < 0.4) this.star(gc, Math.round(cx - 110 + ((i * 53) % 220)), 20 + ((i * 23) % 36), q < 0.2 ? 2 : 1, 0xfff0a0, 1 - q / 0.4);
    }
  }

  private drawPause(g: G, gc: G, now: number): void {
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.55);
    const r: Rect = { x: cx - 60, y: 30, w: 120, h: 50 };
    panel(gc, r, { trim: 'full' });
    this.texts.text('Paused', cx, r.y + 17, WHITE, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: NAVY[0] });
    this.texts.text('Tap to resume', cx, r.y + 37, 0xffd23a, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.7 + 0.3 * pulse(now, 900) });
  }

  /** ELITE! / the boss's name: a banner sweeping in across the stage, holding, then sweeping out. */
  private drawBanner(g: G, now: number): void {
    // while the fight waits for its first tap the banner holds (above the TAP TO BEGIN prompt); the tap sends it off
    const waiting = this.s.app.awaitingBegin;
    if (waiting && now < this.bannerUntil) this.bannerUntil = Math.max(this.bannerUntil, now + 600);
    else if (this.bannerWaited && !waiting) this.bannerUntil = Math.min(this.bannerUntil, now + 240);
    this.bannerWaited = waiting && now < this.bannerUntil;
    if (now >= this.bannerUntil) return;
    const t = now - this.bannerAt;
    const total = this.bannerUntil - this.bannerAt;
    const inK = easeOut3(t / 220);
    const outK = clamp01((t - (total - 240)) / 240);
    const y = 30;
    const h = 24;
    const elite = this.banner === 'ELITE!';
    const col = elite ? 0x8a1a22 : 0x4a2470;
    const wIn = Math.round(GAME_W * inK);
    const x0 = Math.round(GAME_W * outK);
    const x1 = Math.min(GAME_W, wIn);
    if (x1 <= x0) return;
    g.fillStyle(INK, 0.5);
    g.fillRect(x0, y - h / 2 - 2, x1 - x0, h + 4);
    g.fillStyle(col, 0.85);
    g.fillRect(x0, y - h / 2, x1 - x0, h);
    g.fillStyle(mix(col, WHITE, 0.25), 0.9);
    g.fillRect(x0, y - h / 2, x1 - x0, 2);
    g.fillStyle(GOLD[3], 1);
    g.fillRect(x0, y - h / 2 - 1, x1 - x0, 1);
    g.fillRect(x0, y + h / 2, x1 - x0, 1);
    // speed streaks
    g.fillStyle(WHITE, 0.25);
    for (let i = 0; i < 6; i++) {
      const sx = Math.round(((now * 0.4 + i * 67) % (GAME_W + 60)) - 30);
      if (sx > x0 && sx < x1) g.fillRect(GAME_W - sx, y - 8 + ((i * 5) % 16), 18, 1);
    }
    const tx = Math.round(GAME_W / 2 + (1 - inK) * 120 - outK * 160);
    this.texts.text(this.banner, tx, y + 1, elite ? 0xffd0c0 : 0xffe680, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 2, extrudeCol: elite ? 0x4a0a10 : 0x2a1040 });
  }

  // ------------------------------------------------------------------ levels and XP

  /** The fighting hero's level now. */
  private heroLevel(): number {
    const app = this.s.app;
    return levelProgress(app.tuning, heroProgress(app.profile).xp).level;
  }

  /** The hero's XP before this act (the act-clear bar fills from here). */
  private xpBefore(): number {
    const app = this.s.app;
    return Math.max(0, heroProgress(app.profile).xp - app.run.actXpGained);
  }

  /** "Level up! Lv 7": a gold ribbon sliding out under the hero plate after a fight, over whatever is on screen. */
  private drawLevelToast(g: G, now: number): void {
    const t = this.levelToast;
    if (!t) return;
    const age = now - t.at;
    if (age > 2800) {
      this.levelToast = null;
      return;
    }
    const s = this.s;
    const k = easeBack(age / 320, 1.6);
    const a = 1 - clamp01((age - 2400) / 400);
    const label = `Level up! Lv ${t.level}`;
    const w = textWidth(label, 1, true) + 16;
    const x = s.L + 13 + Math.round((1 - k) * -(w + 24));
    const y = 6; // over the hero plate: clear of the pick's cards and the loot
    glow(g, { x, y, w, h: 13 }, 0xffe680, (0.35 + 0.3 * pulse(now, 500)) * a, 3);
    ribbon(g, x + w / 2, y, w, 13, RIBBON.gold, a, k > 0.9);
    this.flyTexts.text(label, x + w / 2, y + 6.5, 0xfffbe0, { bold: true, ox: 0.5, oy: 0.5, alpha: a, extrude: 1, extrudeCol: 0x7a3a0a });
    for (let i = 0; i < 3; i++) {
      const q = (((now / 700 + i * 0.33) % 1) + 1) % 1;
      if (q < 0.5) this.star(g, x + 4 + ((i * 37) % (w - 8)), y - 2 + ((i * 11) % 16), q < 0.25 ? 2 : 1, 0xfff0a0, a * (1 - q * 2));
    }
  }

  /**
   * The act clear's console: the hero's level and an XP bar filling with the act's XP ("+120 XP"); crossing into the
   * next level flashes it gold and pops "Level up!" over the level chip. Then the coins.
   */
  private drawXp(gc: G, now: number): void {
    const s = this.s;
    const app = s.app;
    const T = app.tuning;
    const since = s.anim - this.chestOpenAt;
    const dy = Math.round((1 - easeBack((now - this.phaseAt - 80) / 300, 1.4)) * 30);
    const y = s.splitY + 9 + dy;
    const after = heroProgress(app.profile).xp;
    const before = this.xpBefore();
    const k = easeOut3(clamp01((since - Overlays.CLEAR_ACC_MS - 200) / 1100));
    const xp = Math.round(before + (after - before) * k);
    const lp = levelProgress(T, xp);
    if (lp.level > this.xpLevel) {
      // the bar just crossed into a new level
      this.xpLevel = lp.level;
      this.xpUpAt = now;
      app.audio.lootSting(4);
    }
    const upK = (now - this.xpUpAt) / 500;
    const leveled = this.xpUpAt > 0;
    const coins = `${s.hud.coinsShown}`;
    const cw = textWidth(coins, 1, true) + 15;
    const lv = `Lv ${lp.level}`;
    const lw = textWidth(lv, 1, true) + 8;
    const gw = 100;
    const total = lw + 4 + gw + 8 + cw;
    let x = Math.round((s.L + s.R) / 2 - total / 2);
    // the level chip (gold once the act levelled the hero up)
    const lr: Rect = { x, y, w: lw, h: 11 };
    if (leveled) glow(gc, lr, 0xffd23a, 0.4 + 0.35 * pulse(now, 600), 3);
    tag(gc, lr, leveled ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : [NAVY[6], NAVY[4], NAVY[3], NAVY[2]]);
    this.texts.text(lv, lr.x + lw / 2, lr.y + 5.5, leveled ? 0x3a1e08 : 0xffe680, { bold: true, ox: 0.5, oy: 0.5 });
    if (upK >= 0 && upK < 1) rows(gc, lr.x - 2, lr.y - 2, lr.w + 4, lr.h + 4, 3, WHITE, 0.7 * (1 - upK));
    x += lw + 4;
    // the XP bar
    const frac = lp.need > 0 ? lp.into / lp.need : 1;
    gauge(gc, x, y + 1, gw, 8, frac, frac, { ramp: [0xd0f8ff, 0x5ad0f0, 0x2a8ac8, 0x1a4a8a], seg: 10, glow: upK >= 0 && upK < 1 ? 1 - upK : 0 });
    const gain = app.run.actXpGained;
    const label = lp.need > 0 ? (gain > 0 ? `+${Math.round(gain * k)} XP` : `${lp.into}/${lp.need} XP`) : 'Max level';
    this.texts.text(label, x + gw / 2, y + 5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    if (leveled) {
      // "Level up!" pops out over the level chip and stays while the screen is up
      const rk = easeBack((now - this.xpUpAt) / 300, 1.8);
      const t = 'Level up!';
      const rw = Math.round((textWidth(t, 1, true) + 12) * Math.min(1, rk));
      if (rw > 8) {
        ribbon(gc, lr.x + lr.w / 2 + 14, y - 15, rw, 11, RIBBON.gold, 1, rk > 0.9);
        if (rk > 0.8) this.texts.text(t, lr.x + lr.w / 2 + 14, y - 9.5, 0xfffbe0, { bold: true, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
      }
      if (upK >= 0 && upK < 0.1) s.fx.burst(lr.x + lr.w / 2, lr.y + 5, 0xffe680, 14, false, 1.2);
    }
    x += gw + 8;
    const cr: Rect = { x, y, w: cw, h: 11 };
    tag(gc, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    hudIcon(gc, 'coin', cr.x + 2, cr.y + 1);
    this.texts.text(coins, cr.x + 12, cr.y + 5.5, 0xffe680, { bold: true, oy: 0.5 });
  }

  /**
   * Act clear: the build the relics make, on a card on the right of the stage: its name from the top tags (a gold
   * title), those tags' icons, and every relic collected.
   */
  private drawBuild(gc: G, now: number): void {
    const s = this.s;
    const owned = s.app.run.hero.relics;
    const since = s.anim - this.chestOpenAt;
    const t0 = Overlays.CLEAR_ACC_MS + 160;
    const k = easeBack((since - t0) / 320, 1.5);
    if (k <= 0) return;
    const a = clamp01((since - t0) / 160);
    const w = Math.min(132, s.R - 196);
    const r: Rect = { x: s.R - w - 4 + Math.round((1 - k) * 50), y: 61, w, h: 33 };
    panel(gc, r, { alpha: a, r: 3, trim: true, bevel: NAVY[7] });
    // the build's name, with its top tags' icons after it when they fit
    const name = buildName(owned);
    const tags = topTags(owned).slice(0, 2);
    const nw = textWidth(name, 1, true);
    const room = r.w - 10 - nw;
    const fits = tags.length && room >= tags.length * 10 + 2;
    const nx = r.x + 5;
    this.texts.text(name, nx, r.y + 9, 0xffd23a, { bold: true, oy: 0.5, alpha: a });
    if (fits) tags.forEach((t, i) => tagChip(s, gc, this.texts, this.pool, t, nx + nw + 3 + i * 10, r.y + 4.5, 31.55, { name: false, alpha: a, now }));
    // the relics collected (the newest pops in last); more than fit: "+N"
    const per = Math.floor((r.w - 8) / 13);
    const n = owned.length;
    if (!n) {
      this.texts.text('No relics yet', nx, r.y + 24, 0xa8a0c8, { oy: 0.5, alpha: a });
      return;
    }
    const shown = n <= per ? n : per - 1;
    for (let i = 0; i < shown; i++) {
      const ik = easeBack((since - t0 - 160 - i * 50) / 240, 1.8);
      if (ik <= 0) continue;
      const ix = r.x + 4 + i * 13;
      const iy = r.y + 18 + Math.round((1 - ik) * 6);
      relicIcon(s, this.pool, gc, owned[i], ix, iy, 31.55, a * clamp01(ik * 2));
    }
    if (n > shown) {
      const label = `+${n - shown}`;
      this.texts.text(label, r.x + 4 + shown * 13 + 6, r.y + 24, 0xe8e4ff, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    }
  }

  // ------------------------------------------------------------------ new relics unlocked

  /** "New relic unlocked!" is up: an act's first clear, an elite's first win (after its loot), an event choice. */
  unlockActive(): boolean {
    const run = this.s.app.run;
    if (!run.newRelics.length) return false;
    const ph = run.phase;
    if (ph === 'boost' || ph === 'map') return performance.now() - this.phaseAt > 260;
    if (ph === 'actClear') return this.clearReady() && this.s.anim - this.chestOpenAt > Overlays.CLEAR_BTN_MS + 1700;
    if (ph === 'event') return (run.event?.outcome ?? -1) >= 0;
    return false;
  }

  /** A tap on the unlock card: the next one (or back to the screen under it). */
  unlockTap(): void {
    if (performance.now() - this.unlockAt < 400) return;
    this.s.app.run.newRelics.shift();
    this.unlockAt = 0;
    this.s.app.audio.uiClick();
  }

  private unlockCard(): Rect {
    return { x: Math.round(GAME_W / 2 - 118), y: 46, w: 236, h: 48 };
  }

  /** The unlock card: a gold-trimmed panel with the relic's icon (big, on rays), name, tags and text. */
  private drawUnlock(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const id = run.newRelics[0];
    const def = relicById(id);
    if (!def) {
      run.newRelics.shift();
      return;
    }
    if (!this.unlockAt) {
      this.unlockAt = now;
      s.app.audio.lootSting(3);
    }
    const since = now - this.unlockAt;
    const k = easeBack(since / 300, 1.6);
    this.dim(g, 0.55 * clamp01(since / 160));
    const r0 = this.unlockCard();
    const sc = 0.7 + 0.3 * Math.min(1, k);
    const r: Rect = { x: Math.round(r0.x + (r0.w * (1 - sc)) / 2), y: Math.round(r0.y + (r0.h * (1 - sc)) / 2), w: Math.round(r0.w * sc), h: Math.round(r0.h * sc) };
    const face = RARITY_FACE_OF(def.rarity);
    // slow rays behind the card, in the relic's colour
    const [, base] = TAG_FACE[mainTag(id)];
    const ox = r0.x + 24;
    const oy = r0.y + 25;
    for (let i = 0; i < 10; i++) {
      const a0 = now / 3000 + (i / 10) * Math.PI * 2;
      const a1 = a0 + Math.PI / 16;
      g.fillStyle(i % 2 ? base : 0xfff0a0, 0.09 * clamp01(k));
      g.fillTriangle(ox, oy, Math.round(ox + Math.cos(a0) * 90), Math.round(oy + Math.sin(a0) * 90), Math.round(ox + Math.cos(a1) * 90), Math.round(oy + Math.sin(a1) * 90));
    }
    glow(g, r, face[1], 0.5 + 0.3 * pulse(now, 800), 4);
    panel(g, r, { trim: 'full', rim: face[3] });
    if (k < 0.95) return;
    const title = 'New relic unlocked!';
    ribbon(g, r.x + r.w / 2, r.y - 7, textWidth(title, 1, true) + 20, 13, RIBBON.gold);
    this.flyTexts.text(title, r.x + r.w / 2, r.y - 0.5, 0xfffbe0, { bold: true, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
    if (run.newRelics.length > 1) this.flyTexts.text(`1/${run.newRelics.length}`, r.x + r.w - 6, r.y + 7, 0xc8c0e8, { ox: 1, oy: 0.5 });
    const tile: Rect = { x: r.x + 7, y: r.y + 9, w: 32, h: 32 };
    cardTile(g, tile, face);
    relicIcon(s, this.flyPool, g, id, tile.x + 4, tile.y + 4, 41.2, 1, 2);
    const tx = tile.x + tile.w + 7;
    this.flyTexts.text(def.name, tx, r.y + 9, WHITE, { bold: true });
    let cx = tx + textWidth(def.name, 1, true) + 4;
    for (const t of def.tags) cx += tagChip(s, g, this.flyTexts, this.flyPool, t, cx, r.y + 10, 41.2, { now }) + 3;
    wrapText(relicText(s.app.tuning, id), r.x + r.w - tx - 6)
      .slice(0, 2)
      .forEach((line, i) => this.flyTexts.text(line, tx, r.y + 22 + i * 9, 0xe8e2ff));
    // twinkles round the tile, and the way on
    for (let i = 0; i < 3; i++) {
      const q = (((now / 800 + i * 0.33) % 1) + 1) % 1;
      if (q < 0.5) this.star(g, tile.x + ((i * 23) % tile.w), tile.y + ((i * 17) % tile.h), q < 0.25 ? 2 : 1, 0xfff0a0, 1 - q * 2);
    }
    if (since > 400) {
      const hint = 'Tap to continue';
      const hw = textWidth(hint, 1, true);
      strip(g, r.x + r.w / 2 - hw / 2 - 10, r.y + r.h + 4, hw + 20, 12, 0.85);
      this.flyTexts.text(hint, r.x + r.w / 2, r.y + r.h + 10, 0xffd23a, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.7 + 0.3 * pulse(now, 900) });
    }
  }

  // ------------------------------------------------------------------ Sable's first fight

  /** Sable's first fight shows the two tap zones before TAP TO BEGIN (once: profile.twinTaught). */
  twinTutorial(): boolean {
    const app = this.s.app;
    return app.run.phase === 'fight' && app.awaitingBegin && !app.storyOverlay && app.run.hero.build?.id === 'sable' && !app.profile.twinTaught;
  }

  /** The tap that closes the tutorial (the next one begins the fight). */
  twinTutorialTap(): void {
    const app = this.s.app;
    if (performance.now() - this.phaseAt < 500) return;
    app.profile.twinTaught = true;
    app.saveProfile();
    app.audio.uiClick();
  }

  /** The two tap zones: the left half is cursor A, the right half cursor B (a hand on each), a swipe is the finisher. */
  private drawTwinTutorial(g: G, gc: G, now: number): void {
    const s = this.s;
    const since = now - this.phaseAt;
    this.dim(g, 0.5 * clamp01(since / 200));
    const mid = Math.round(GAME_W / 2);
    const top = 21;
    const bottom = s.B - 3;
    const zones = [
      { x0: s.L + 3, x1: mid - 2, letter: 'A', label: 'Left cursor', col: 0x4aa0f0, deep: 0x1a3c8a, cursor: 0 },
      { x0: mid + 2, x1: s.R - 3, letter: 'B', label: 'Right cursor', col: 0xc070f0, deep: 0x4a2470, cursor: 1 },
    ];
    zones.forEach((z, i) => {
      const k = easeBack((since - 80 - i * 120) / 300, 1.5);
      if (k <= 0) return;
      const a = clamp01(k);
      const w = z.x1 - z.x0;
      const r: Rect = { x: z.x0, y: top, w, h: bottom - top };
      // the zone: a tinted field with a dashed rim that marches
      rows(gc, r.x, r.y, r.w, r.h, 3, z.col, 0.16 * a);
      const off = Math.floor(now / 90) % 4;
      gc.fillStyle(z.col, 0.85 * a);
      for (let x = r.x + 3 + off; x < r.x + r.w - 3; x += 4) {
        gc.fillRect(x, r.y, 2, 1);
        gc.fillRect(x, r.y + r.h - 1, 2, 1);
      }
      for (let y = r.y + 3 + off; y < r.y + r.h - 3; y += 4) {
        gc.fillRect(r.x, y, 1, 2);
        gc.fillRect(r.x + r.w - 1, y, 1, 2);
      }
      const cx = Math.round(r.x + r.w / 2);
      const dy = Math.round((1 - k) * 12);
      this.texts.text(z.letter, cx, 40 + dy, mixLight(z.col), { bold: true, scale: 3, ox: 0.5, oy: 0.5, alpha: a, extrude: 1, extrudeCol: mix(z.col, z.deep, 0.6) });
      this.texts.text(z.label, cx, 59 + dy, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      // a hand tapping in the zone
      const tapK = ((now + i * 450) % 900) / 900;
      const press = tapK < 0.18 ? 2 : 0;
      const [hw] = glyphSize('hand');
      glyph(gc, 'hand', cx - hw + 8, 66 + press + dy, a, { c: z.deep, C: z.col }, 2);
      if (tapK < 0.3) {
        const rr = 3 + tapK * 30;
        gc.fillStyle(WHITE, 0.6 * (1 - tapK / 0.3) * a);
        for (let j = 0; j < 12; j++) {
          const ang = (j / 12) * Math.PI * 2;
          gc.fillRect(Math.round(cx - 1 + Math.cos(ang) * rr), Math.round(68 + Math.sin(ang) * rr * 0.6), 1, 1);
        }
      }
      // under it, which half of the bar this zone plays
      const bar = s.bar;
      const bx0 = Math.round(bar.x + (z.cursor ? bar.w / 2 : 0));
      gc.fillStyle(z.col, (0.22 + 0.16 * pulse(now, 700)) * a);
      gc.fillRect(bx0 + 1, bar.y - 2, Math.round(bar.w / 2) - 2, bar.h + 4);
      gc.fillStyle(mixLight(z.col), 0.9 * a);
      gc.fillRect(bx0 + 1, bar.y - 3, Math.round(bar.w / 2) - 2, 1);
      gc.fillRect(bx0 + 1, bar.y + bar.h + 2, Math.round(bar.w / 2) - 2, 1);
    });
    // the finisher, and the way on
    if (since > 400) {
      const t = 'Swipe = finisher';
      const tw = textWidth(t, 1, true);
      strip(gc, mid - tw / 2 - 26, s.splitY - 16, tw + 52, 13, 0.8);
      this.texts.text(t, mid + 8, s.splitY - 9.5, 0xffe680, { bold: true, ox: 0.5, oy: 0.5 });
      // a swipe streak sweeping right
      const cyc = (now % 1000) / 1000;
      const hx = Math.round(mid - tw / 2 - 18 + cyc * 14);
      for (let i = 0; i < 10; i++) {
        gc.fillStyle(i < 3 ? WHITE : 0x9ad8ff, 0.9 * (1 - i / 10));
        gc.fillRect(hx - i, s.splitY - 10, 1, i < 3 ? 2 : 1);
      }
      const hint = 'Tap to continue';
      const hw = textWidth(hint, 1, true);
      const hy = s.meter.y + Math.round(s.meter.h / 2);
      strip(gc, mid - hw / 2 - 10, hy - 6, hw + 20, 12, 0.85);
      this.texts.text(hint, mid, hy, 0xffd23a, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.7 + 0.3 * pulse(now, 900) });
    }
  }

  // ------------------------------------------------------------------ the relic panel (fight paused)

  /** Open the relic panel on relic `i` (the fight is paused by the caller). */
  openRelics(i: number): void {
    this.relicSel = i;
    this.relicAt = performance.now();
    this.s.app.audio.panelOpen();
  }

  private relicPanelRect(): Rect {
    return { x: Math.round(GAME_W / 2 - 135), y: 25, w: 270, h: 112 };
  }

  private relicCols(): number {
    return this.s.app.run.hero.relics.length > 36 ? 8 : 6;
  }

  relicSocket(i: number): Rect {
    const p = this.relicPanelRect();
    const cols = this.relicCols();
    return { x: p.x + 7 + (i % cols) * 16, y: p.y + 11 + Math.floor(i / cols) * 16, w: 14, h: 14 };
  }

  relicResume(): Rect {
    const p = this.relicPanelRect();
    return { x: p.x + p.w - 62, y: p.y + p.h - 19, w: 54, h: 14 };
  }

  /** A tap on the relic panel: another relic shows; the Resume button, the relic shown or a tap outside closes it. */
  relicPanelTap(x: number, y: number): 'close' | 'stay' {
    const run = this.s.app.run;
    for (let i = 0; i < run.hero.relics.length; i++)
      if (inRect(this.relicSocket(i), x, y, 1)) {
        if (i === this.relicSel) break;
        this.relicSel = i;
        this.s.app.audio.uiClick();
        return 'stay';
      }
    const rr = this.relicResume();
    if (inRect(rr, x, y, 3)) notePress(rr);
    else if (inRect(this.relicPanelRect(), x, y) && !run.hero.relics.some((_, i) => inRect(this.relicSocket(i), x, y, 1))) return 'stay';
    this.relicSel = null;
    this.s.app.audio.panelClose();
    return 'close';
  }

  /**
   * The relic panel: every relic carried in a grid of sockets (the one shown in detail lit gold), and that one's big
   * icon, name, rarity, tags, text, and how often it kicked in this fight. Resume (or a tap outside) goes back.
   */
  private drawRelicPanel(g: G, gc: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const owned = run.hero.relics;
    const sel = Math.max(0, Math.min(owned.length - 1, this.relicSel ?? 0));
    this.relicSel = sel;
    this.dim(g, 0.6);
    const since = now - this.relicAt;
    const p0 = this.relicPanelRect();
    const k = easeBack(since / 240, 1.5);
    const sc = 0.8 + 0.2 * Math.min(1, k);
    const p: Rect = { x: Math.round(p0.x + (p0.w * (1 - sc)) / 2), y: Math.round(p0.y + (p0.h * (1 - sc)) / 2), w: Math.round(p0.w * sc), h: Math.round(p0.h * sc) };
    panel(gc, p, { trim: 'full', alpha: clamp01(since / 100) });
    if (k < 0.98) return;
    const title = `Relics (${owned.length})`;
    ribbon(gc, p.x + p.w / 2, p.y - 6, textWidth(title, 1, true) + 24, 13, RIBBON.purple);
    this.texts.text(title, p.x + p.w / 2, p.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    // the grid: four rows of sockets at least (the empty ones dark wells), a relic in each one filled
    const cols = this.relicCols();
    const slots = Math.max(cols * 4, Math.ceil(owned.length / cols) * cols);
    for (let i = owned.length; i < slots; i++) {
      const r = this.relicSocket(i);
      rows(gc, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, INK, 0.7);
      rows(gc, r.x, r.y, r.w, r.h, 1, NAVY[1], 0.7);
      band(gc, r.x, r.y, r.w, r.h, 1, r.h - 1, r.h, NAVY[3], 0.7);
    }
    owned.forEach((id, i) => {
      const r = this.relicSocket(i);
      const on = i === sel;
      if (on) glow(gc, r, 0xffd23a, 0.45 + 0.3 * pulse(now, 700), 2);
      rows(gc, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, on ? GOLD[3] : INK);
      rows(gc, r.x, r.y, r.w, r.h, 1, on ? NAVY[4] : NAVY[1]);
      band(gc, r.x, r.y, r.w, r.h, 1, 0, 1, on ? GOLD[4] : INK);
      const bump = s.hud.relicPulseK(id, now);
      relicIcon(s, this.pool, gc, id, r.x + 1, r.y + 1 - Math.round(bump * 2), 31.55);
      if (bump > 0) rows(gc, r.x + 1, r.y + 1, 12, 12, 2, WHITE, 0.5 * bump);
    });
    // the build's name under the grid (while the grid leaves room for it)
    const gridBottom = this.relicSocket(slots - 1).y + 16;
    if (gridBottom + 18 <= p.y + p.h - 4) {
      this.texts.text('Build', p.x + 8, p.y + p.h - 22, 0xa8a0c8, { oy: 0.5 });
      this.texts.text(buildName(owned), p.x + 8, p.y + p.h - 12, 0xffd23a, { bold: true, oy: 0.5 });
    }
    // the detail: a divider, then the relic shown
    const dx = p.x + 7 + cols * 16 + 4;
    gc.fillStyle(NAVY[1], 1);
    gc.fillRect(dx, p.y + 9, 1, p.h - 16);
    gc.fillStyle(NAVY[5], 1);
    gc.fillRect(dx + 1, p.y + 9, 1, p.h - 16);
    const id = owned[sel];
    const def = relicById(id);
    if (!def) return;
    const x0 = dx + 7;
    const w = p.x + p.w - 8 - x0;
    const face = RARITY_FACE_OF(def.rarity);
    const tile: Rect = { x: x0, y: p.y + 10, w: 30, h: 30 };
    glow(gc, tile, face[1], 0.4, 2);
    cardTile(gc, tile, face);
    relicIcon(s, this.pool, gc, id, tile.x + 3, tile.y + 3, 31.55, 1, 2);
    const tx = tile.x + tile.w + 6;
    this.texts.text(def.name, tx, p.y + 11, WHITE, { bold: true });
    let cx = tx;
    for (const t of def.tags) cx += tagChip(s, gc, this.texts, this.pool, t, cx, p.y + 25, 31.55, { now }) + 3;
    // rare and epic relics say so after their tags
    const look = CARD[def.rarity];
    if (look.tag && cx + textWidth(look.tag, 1, false) + 6 <= p.x + p.w - 8) {
      const tr: Rect = { x: cx + 1, y: p.y + 25, w: textWidth(look.tag, 1, false) + 6, h: 9 };
      tag(gc, tr, look.face);
      this.texts.text(look.tag, tr.x + 3, tr.y + 4.5, WHITE, { oy: 0.5 });
    }
    const lines = wrapText(relicText(s.app.tuning, id), w);
    lines.slice(0, 4).forEach((line, i) => this.texts.text(line, x0, p.y + 45 + i * 9, 0xe8e2ff));
    const n = s.hud.perkCount(id);
    if (n > 0) this.texts.text(n === 1 ? 'Kicked in once this fight' : `Kicked in ${n} times this fight`, x0, p.y + 46 + Math.min(4, lines.length) * 9, 0x9af0a0, { oy: 0 });
    // Resume
    const rr = this.relicResume();
    const pr = isPressed(rr, now);
    glow(gc, rr, 0x8af06a, 0.3 + 0.3 * pulse(now, 900), 3);
    button3d(gc, rr, FACE.green, pr);
    this.texts.text('Resume', rr.x + rr.w / 2, rr.y + rr.h / 2 + (pr ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5 });
  }
}
