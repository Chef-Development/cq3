// Overlays and menus: the title screen (chrome logo, Rowan and Pip showcased, a pulsing start prompt, how-to
// tips), the boost pick (with a reroll; each card shows its stat before and after), the treasure / act-clear chest
// (then the act's accuracy, and Camp / Next buttons), defeat (Camp / Retry), the victory, pause, "TAP TO BEGIN!",
// the fight banner, and the screen flash. Panels pop in with a little overshoot; cards and buttons stagger in.
// Also the small UI glyphs the menus share (bag, heart, coin, warning, tent, tick, padlock, target, arrow).
import Phaser from 'phaser';
import { heroMaxHp } from '../../core/combat';
import { relicById, type RelicId, type RelicTag } from '../../data/relics';
import { heroProgress, progressLabel } from '../../core/profile';
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
import { BOOST_ICON, clamp01, COL, easeBack, easeInOut, easeOut3, inRect, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, notePress, ribbon, RIBBON, strip, tag, TextPool } from './ui';
import { cardFrame, cardShine, cardTile, mainTag, relicCard, relicIcon, tagChip, TAG_FACE, type CardCtx } from './relic-ui';
import { wrapText } from './items';
import { pix } from './camp-kit';

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
  /** Sable on the title, beside Rowan and Pip, once they've joined. */
  private sableBig: Phaser.GameObjects.Image | null = null;
  private chest: Phaser.GameObjects.Image | null = null;
  private chestAt = 0;
  private chestOpenAt = 0;
  private banner = '';
  private bannerAt = -1e9;
  private bannerUntil = 0;
  private bannerWaited = false;
  /** New game (it erases everything) needs a second tap within this time. */
  private newRunArmedUntil = 0;
  private lastPhase: Phase | null = null;
  private phaseAt = 0; // when the current phase started drawing (performance.now)
  private picked: { offer: BoostOffer; preview: BoostPreview; r: Rect; at: number; owned: RelicId[] } | null = null;
  /** A relic pick waits for its card to fly into the tray: then this moves the run on. */
  private pickThen: (() => void) | null = null;
  private landedSound = false;
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
  private levelToast: { level: number; at: number; sting: boolean } | null = null;
  /** Act clear: the XP bar's level as last shown (its "Level up!" plays as the bar crosses into the next). */
  private xpLevel = 0;
  private xpUpAt = -1e9;
  /** The coins the run had as its act's map first showed (the act clear counts up from them), and that map. */
  private coinsAtAct = 0;
  private coinMap: unknown = null;
  /** The act clear's coin count-up: the last value shown (a tick sounds as it climbs). */
  private coinTickShown = -1;

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
    for (const o of [this.logo, this.shine, this.heroBig, this.pipBig, this.sableBig]) o?.destroy();
    this.heroBig = s.add.image(0, 0, 'hero_idle0').setOrigin(HERO_FEET_X / HERO_W, 1).setScale(2).setDepth(31.3).setVisible(false);
    this.sableBig = s.add.image(0, 0, s.textures.exists('sable_idle0') ? 'sable_idle0' : 'hero_idle0').setOrigin(HERO_FEET_X / HERO_W, 1).setScale(2).setDepth(31.29).setVisible(false);
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
    if (s.app.run.map !== this.coinMap && next === 'map') {
      this.coinMap = s.app.run.map;
      this.coinsAtAct = s.app.run.coins;
    }
    if (next !== 'fight') this.relicSel = null;
    // levels the fight's kills brought: a toast as the loot (or the pick) comes up; the act clear's bar shows its own
    if ((next === 'loot' || next === 'boost') && s.app.run.takeLevelUps() > 0) {
      this.levelToast = { level: this.heroLevel(), at: performance.now(), sting: false };
    }
    if (next === 'actClear' && !this.backFromCamp) {
      s.app.run.takeLevelUps();
      this.xpLevel = levelProgress(s.app.tuning, this.xpBefore()).level;
      this.xpUpAt = -1e9;
      this.coinTickShown = -1;
      if (s.app.run.map !== this.coinMap) this.coinsAtAct = s.app.run.coins;
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

  /** Title screen with anything earned: Continue (left) and New game (right), on the band. */
  private titleButtons(): { cont: Rect; fresh: Rect } {
    const cx = Math.round(GAME_W / 2);
    const y = this.s.splitY - 6;
    return { cont: { x: cx - 112, y, w: 120, h: 22 }, fresh: { x: cx + 16, y, w: 96, h: 22 } };
  }

  /** Which title button a tap hits. New game (it erases everything) arms on the first tap and only fires on the second. */
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

  /** When the act-clear extras come in (anim ms after the chest burst): the line under the title and the build, the XP
   *  count-up (then the coins'), the two buttons. */
  private static readonly CLEAR_ACC_MS = 300;
  private static readonly CLEAR_BTN_MS = 620;
  private static readonly CLEAR_XP_MS = 420;
  private static readonly CLEAR_XP_LEN = 800;
  private static readonly CLEAR_COIN_LEN = 600;

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

  /** Camp and Retry sit where the act clear's Camp and Next do: on the console, the same size. */
  private defeatButtons(): { camp: Rect; retry: Rect } {
    const b = this.clearButtons();
    return { camp: b.camp, retry: b.next };
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

  /** Boost choices: a navy panel with three stacked cards and, along its bottom, the relics the hero carries. */
  private boostPanel(): Rect {
    const h = 121;
    return { x: Math.round(GAME_W / 2 - 128), y: Math.min(24, this.s.B + 1 - h), w: 256, h };
  }

  cardRect(i: number): Rect {
    const p = this.boostPanel();
    return { x: p.x + 8, y: p.y + 8 + i * 32, w: p.w - 16, h: 30 };
  }

  /** The tray along the pick panel's bottom: an amulet, then the relics carried (the pick lands in the next slot). */
  private trayRect(): Rect {
    const p = this.boostPanel();
    return { x: p.x + 8, y: p.y + p.h - 18, w: p.w - 16, h: 14 };
  }

  /** The tray's slots: up to `max` relics shown (the last slot "+N" when there are more). */
  private traySlots(n: number): { slots: Rect[]; more: number } {
    const t = this.trayRect();
    const max = Math.floor((t.w - 16) / 14);
    const shown = n <= max ? n : max - 1;
    return { slots: Array.from({ length: Math.min(max, n + 1) }, (_, i) => ({ x: t.x + 15 + i * 14, y: t.y + 1, w: 12, h: 12 })), more: n - shown };
  }

  /** The deal: when the pick's cards started coming (the phase, or a reroll: then they just flip over in place). */
  private dealStart(): { at: number; reroll: boolean } {
    const rerolled = this.rerollAt2 > this.phaseAt;
    return { at: rerolled ? this.rerollAt2 : this.phaseAt, reroll: rerolled };
  }

  /** Card i's deal: when it leaves the deck, lands (and starts to flip), and is face up (ms after the deal starts). */
  private dealTimes(i: number, reroll: boolean): { start: number; land: number; up: number } {
    if (reroll) return { start: i * 60, land: i * 60, up: i * 60 + 120 };
    const start = 110 + i * 85;
    return { start, land: start + 160, up: start + 270 };
  }

  /** The reroll button on the boost panel's top edge (shown while the run has rerolls bought at a shop). */
  private rerollRect(): Rect {
    const p = this.boostPanel();
    return { x: p.x + 6, y: p.y - 6, w: 54, h: 12 };
  }

  rerollAt(x: number, y: number): boolean {
    const hit = this.s.app.run.rerolls > 0 && !this.pickThen && inRect(this.rerollRect(), x, y, 3);
    if (hit) {
      notePress(this.rerollRect());
      this.rerollAt2 = performance.now();
    }
    return hit;
  }

  /** Whether card i has been dealt face up (a tap on it picks it). */
  cardLive(i: number): boolean {
    const deal = this.dealStart();
    return performance.now() - deal.at >= this.dealTimes(i, deal.reroll).up;
  }

  /** The card a tap picks: only a card that is face up (each one is live the moment it has flipped over). */
  boostCardAt(x: number, y: number): number {
    for (let i = 0; i < 3; i++) if (inRect(this.cardRect(i), x, y)) return this.takeCard(i);
    return -1;
  }

  /** Take card i if it's live (and nothing is being picked already): it becomes the picked card. Returns i or -1. */
  takeCard(i: number): number {
    const run = this.s.app.run;
    const offer = run.boostChoices[i];
    if (!offer || !this.cardLive(i) || this.pickThen) return -1;
    this.picked = { offer, preview: boostPreview(run.tuning, run.hero, offer), r: this.cardRect(i), at: performance.now(), owned: run.hero.relics.slice() };
    this.landedSound = false;
    return i;
  }

  /**
   * After a card is taken: a relic first flies into the tray (Overlays.RELIC_FLY_MS, the screen stays meanwhile and
   * takes no other pick), then `then` moves on; a stat card moves on at once (it lifts and fades over what's next).
   */
  afterPick(then: () => void): void {
    const p = this.picked;
    if (!p || !isRelicOffer(p.offer)) return then();
    this.pickThen = then;
    this.s.app.audio.uiClick();
  }

  /** A relic's flight into the tray: it lands at RELIC_LAND_MS and the screen moves on at RELIC_FLY_MS. */
  private static readonly RELIC_LAND_MS = 380;
  private static readonly RELIC_FLY_MS = 500;

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
    // a relic picked has flown into the tray: the run moves on
    if (this.pickThen && (ph !== 'boost' || !this.picked || now - this.picked.at >= Overlays.RELIC_FLY_MS)) {
      const then = this.pickThen;
      this.pickThen = null;
      if (ph === 'boost') then();
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
    this.sableBig?.setVisible(titleOn && this.sableOnTitle());
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
    } else if (ph === 'fight' && s.app.awaitingBegin && !s.app.userPaused && !s.app.tipUp) {
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

  /** Sable stands on the title once they've joined (and their frames are drawn). */
  private sableOnTitle(): boolean {
    return !!this.s.app.profile.sableMet && this.s.textures.exists('sable_idle0');
  }

  /**
   * A few leaves drifting down across the title, swaying (closed-form in time: no state, the same every run): a
   * little life that never crowds the logo.
   */
  private drawLeaves(g: G, now: number): void {
    const s = this.s;
    const cols = [
      [0x78a83c, 0xb4d058],
      [0xd8901c, 0xf2c230],
      [0x4a7e36, 0x78a83c],
    ] as const;
    for (let i = 0; i < 6; i++) {
      const period = 7000 + i * 1300;
      const q = (((now + i * 2900) % period) + period) % period / period;
      const x = Math.round(s.L + ((i * 89 + 23) % Math.max(1, s.R - s.L)) + Math.sin(q * Math.PI * 4 + i) * 10 - q * 30);
      const y = Math.round(-6 + q * (s.splitY + 4));
      if (y > s.splitY - 2) continue;
      const a = q < 0.08 ? q / 0.08 : q > 0.9 ? (1 - q) / 0.1 : 1;
      const [lo, hi] = cols[i % 3];
      const flip = Math.sin(q * Math.PI * 6 + i) > 0;
      g.fillStyle(lo, 0.9 * a);
      g.fillRect(x, y + 1, 3, 1);
      g.fillRect(flip ? x + 1 : x - 1, y, 2, 1);
      g.fillStyle(hi, 0.9 * a);
      g.fillRect(flip ? x : x + 1, y, 1, 1);
      g.fillRect(flip ? x + 2 : x, y + 2, 1, 1);
    }
  }

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

    // Rowan and Pip (and Sable, once they've joined), 2x, slide in from the left; Rowan flourishes his sword now and
    // then, Sable flips a dagger
    const sable = this.sableOnTitle();
    const hk = easeBack(since / TITLE_IN.heroes, 1.2);
    const slide = Math.round((1 - hk) * -140);
    const hx = L + (sable ? 100 : 82) + slide;
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
    if (sable) {
      // Sable a step behind, to his left: idle, and a quick dagger flourish out of step with his
      const sx = hx - 56;
      const sc = (now + 1800) % 4400;
      const sp = sc < 120 ? 'windup' : sc < 300 ? 'slashX' : Math.floor((now + 210) / 450) % 2 ? 'idle1' : 'idle0';
      rows(g, sx - 20, s.ground - 2, 40, 5, 2, INK, 0.3);
      this.sableBig?.setTexture(s.textures.exists(`sable_${sp}`) ? `sable_${sp}` : 'sable_idle0').setPosition(sx, s.ground);
      if (sc >= 120 && sc < 360) this.star(gc, sx + 30, s.ground - 30 - Math.round(((sc - 120) / 240) * 6), sc < 240 ? 2 : 1, 0xd8b0ff, 1 - (sc - 120) / 240);
    }
    const px = L + (sable ? 70 : 38) + slide;
    const py = Math.round(s.ground - (sable ? 64 : 46) + Math.sin(now / 300) * 3);
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
    // the gleam sweeps across the letters every 3.6 s (gently: about two thirds of a second), ending in a twinkle
    const gleam = (now - this.phaseAt) % 3600;
    const sf = Math.floor(gleam / 55);
    if (since > TITLE_IN.logo && sf < this.shineFrames) this.shine?.setTexture(`logo_shine_${sf}`).setPosition(lx, ly).setVisible(true);
    const tw0 = this.shineFrames * 55;
    if (since > TITLE_IN.logo && gleam >= tw0 && gleam < tw0 + 360) {
      const q = (gleam - tw0) / 360;
      this.star(gc, lx + lw - 50, ly + 6, q < 0.4 ? 3 : q < 0.7 ? 2 : 1, 0xfff6c0, 1 - q);
    }
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
    this.drawLeaves(gc, now);
    // drifting golden motes
    if (Math.random() < 0.2)
      s.fx.particles.push({ x: rand(L, R), y: s.ground - rand(0, 30), vx: rand(-4, 4), vy: rand(-14, -6), g: 0, born: now, life: rand(1400, 2400), color: Math.random() < 0.5 ? 0xfff0a0 : 0xffd23a, size: 1, world: true, streak: false });

    // the band: Continue / New game (with anything earned), or the start prompt; how-to tips in the tray under it
    const save = s.app.savedRun;
    const pa = clamp01((since - 260) / (TITLE_IN.prompt - 260));
    if (s.app.canContinue) {
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
        const where = save ? saveLabel(save, s.app.run) : progressLabel(s.app.profile, s.app.tuning);
        this.texts.text(where, cont.x + cont.w / 2, cont.y + dy + 16 + pc, 0xfff07a, { ox: 0.5, oy: 0.5 });
        const pf = isPressed(fresh, now) ? 2 : 0;
        // a new game erases everything (gear, levels, relics, coins; the settings stay): armed by the first tap
        this.texts.text(armed ? 'Tap again' : 'New game', fresh.x + fresh.w / 2, fresh.y + dy + 7 + pf, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
        this.texts.text('Erases all', fresh.x + fresh.w / 2, fresh.y + dy + 16 + pf, armed ? 0xffe0a0 : 0xc8c0e8, { ox: 0.5, oy: 0.5 });
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

  /**
   * The pick: the panel pops in, then the three cards are dealt from a little deck at its bottom (each slides up to
   * its place and flips face up; a card is live the moment it has flipped). Along the bottom, the relics carried; a
   * card that shares a tag with one of them (Synergy!) runs a glowing line from its lit tag to that relic.
   */
  private drawBoost(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const run = s.app.run;
    this.dim(g, 0.45);
    const p0 = this.boostPanel();
    const k = easeBack(since / 200, 1.5);
    const sc = 0.75 + 0.25 * k;
    const p: Rect = { x: Math.round(p0.x + (p0.w * (1 - sc)) / 2), y: Math.round(p0.y + (p0.h * (1 - sc)) / 2), w: Math.round(p0.w * sc), h: Math.round(p0.h * sc) };
    if (since < 40) return;
    panel(gc, p, { trim: 'full', alpha: clamp01(since / 100) });
    if (k < 0.98) return;
    // a replay's opening draft counts its picks; a pick with a relic in it is a relic pick
    const title = run.startPick
      ? `Starting relic ${run.startPicksTotal - run.startPicks + 1}/${run.startPicksTotal}`
      : run.pickKind === 'bounty'
        ? 'Bounty Reward'
        : run.pickKind === 'secret'
          ? 'Secret Relic'
          : run.boostChoices.some(isRelicOffer)
            ? 'Choose a Relic'
            : 'Choose a Boost';
    ribbon(gc, p.x + p.w / 2, p.y - 6, Math.max(112, textWidth(title, 1, true) + 22), 13, RIBBON.purple);
    this.texts.text(title, p.x + p.w / 2, p.y + 0.5, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    const owned = run.hero.relics;
    // a relic being picked flies into the tray (drawPicked); once it lands it sits in its slot
    const pk = this.pickThen && this.picked ? this.picked : null;
    const landing = pk && isRelicOffer(pk.offer) && now - pk.at >= Overlays.RELIC_LAND_MS ? pk.offer.relic : null;
    this.drawTray(gc, this.texts, this.pool, 31.55, landing ? [...owned, landing] : owned, now, 1, landing ? new Set([landing]) : undefined);
    const ctx: CardCtx = { s, g: gc, texts: this.texts, pool: this.pool, depth: 31.55 };
    const deal = this.dealStart();
    const dt = now - deal.at;
    // the deck the cards come from: a little stack of card backs at the panel's bottom middle, gone once dealt
    const deck: Rect = { x: Math.round(p0.x + p0.w / 2 - 15), y: p0.y + p0.h - 26, w: 30, h: 18 };
    const left = run.boostChoices.filter((_, i) => dt < this.dealTimes(i, deal.reroll).start).length;
    const lastOut = this.dealTimes(run.boostChoices.length - 1, deal.reroll).start;
    const da = deal.reroll ? 0 : left ? 1 : 1 - clamp01((dt - lastOut) / 160);
    if (da > 0) for (let j = Math.max(1, left) - 1; j >= 0; j--) this.cardBack(gc, { ...deck, x: deck.x + j, y: deck.y - j * 2 }, da);
    const synergy: Array<{ chip: Rect; tag: RelicTag; card: Rect; at: number }> = [];
    run.boostChoices.forEach((offer, i) => {
      const T = this.dealTimes(i, deal.reroll);
      const t = dt - T.start;
      if (t < 0 || (pk && pk.offer === offer)) return;
      const slot = this.cardRect(i);
      if (dt < T.land) {
        // on its way: a card back sliding (and growing) from the deck to its place
        const e = easeOut3(t / (T.land - T.start));
        const r = { x: Math.round(deck.x + (slot.x - deck.x) * e), y: Math.round(deck.y + (slot.y - deck.y) * e), w: Math.round(deck.w + (slot.w - deck.w) * e), h: Math.round(deck.h + (slot.h - deck.h) * e) };
        this.cardBack(gc, r, 1);
        return;
      }
      if (dt < T.up) {
        // the flip: the back folds shut (a squash toward its middle line), then the face opens out
        const fk = (dt - T.land) / (T.up - T.land);
        const hh = fk < 0.45 ? 1 - fk / 0.45 : easeBack((fk - 0.45) / 0.55, 1.8);
        const h = Math.max(1, Math.round(slot.h * hh));
        const r = { ...slot, y: Math.round(slot.y + (slot.h - h) / 2), h };
        if (fk < 0.45) this.cardBack(gc, r, 1);
        else this.cardFace(gc, r, offer, now);
        return;
      }
      // face up: the whole card (a flash as it lands; a reroll flashes them all)
      const flash = Math.max(0, 0.6 * (1 - (dt - T.up) / 160));
      const chips: Array<{ tag: RelicTag; r: Rect; hot: boolean }> = [];
      if (isRelicOffer(offer)) relicCard(ctx, slot, offer.relic, { owned, tuning: s.app.tuning, now: now + i * 300, flash, chips });
      else this.card(ctx, slot, offer, boostPreview(run.tuning, run.hero, offer), now + i * 300, flash);
      for (const c of chips) if (c.hot) synergy.push({ chip: c.r, tag: c.tag, card: slot, at: deal.at + T.up });
    });
    // Synergy!: a line from each lit tag to the relics carried that share it
    if (!pk) for (const sy of synergy) this.synergyLine(gc, sy, owned, now);
    if (run.rerolls > 0) {
      const rr = this.rerollRect();
      const pr = isPressed(rr, now);
      button3d(gc, rr, FACE.blue, pr);
      this.texts.text(`Reroll x${run.rerolls}`, rr.x + rr.w / 2, rr.y + rr.h / 2 + (pr ? 2 : 0), WHITE, { ox: 0.5, oy: 0.5 });
    }
  }

  /** A card's back: navy with a gold double rim, a diamond lattice and a gold emblem in the middle. */
  private cardBack(g: G, r: Rect, alpha: number): void {
    if (r.h < 2) return;
    rows(g, r.x - 1, r.y + 2, r.w + 2, r.h, 3, INK, 0.4 * alpha);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK, alpha);
    rows(g, r.x, r.y, r.w, r.h, 2, GOLD[2], alpha);
    band(g, r.x, r.y, r.w, r.h, 2, 0, 1, GOLD[4], alpha);
    if (r.h < 5) return;
    rows(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1, 0x2a1f52, alpha);
    band(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1, 0, Math.round((r.h - 2) * 0.45), 0x34286a, alpha);
    // the lattice: rows of small diamonds
    g.fillStyle(0x4a3c8a, alpha);
    for (let y = r.y + 3; y < r.y + r.h - 3; y += 4)
      for (let x = r.x + 3 + ((y - r.y) % 8 === 3 ? 0 : 3); x < r.x + r.w - 4; x += 6) {
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y + 1, 3, 1);
        g.fillRect(x + 1, y + 2, 1, 1);
      }
    if (r.h < 9) return;
    // the emblem: a gold diamond with a lit core
    const cx = Math.round(r.x + r.w / 2);
    const cy = Math.round(r.y + r.h / 2);
    const d = Math.min(5, Math.floor((r.h - 4) / 2));
    for (let i = -d - 1; i <= d + 1; i++) {
      const w = (d + 1 - Math.abs(i)) * 2 + 1;
      g.fillStyle(INK, alpha);
      g.fillRect(cx - (w >> 1) - 1, cy + i, w + 2, 1);
    }
    for (let i = -d; i <= d; i++) {
      const w = (d - Math.abs(i)) * 2 + 1;
      g.fillStyle(i < 0 ? GOLD[3] : GOLD[2], alpha);
      g.fillRect(cx - (w >> 1), cy + i, w, 1);
    }
    g.fillStyle(GOLD[4], alpha);
    g.fillRect(cx, cy - 1, 1, 2);
  }

  /** A card's face while it flips open: its frame and tile in the rarity's colours (the text lands with the card). */
  private cardFace(g: G, r: Rect, offer: BoostOffer, now: number): void {
    const face = isRelicOffer(offer) ? RARITY_FACE_OF(relicById(offer.relic)?.rarity ?? offer.rarity) : CARD[offer.rarity].face;
    cardFrame(g, r, face, 'common', now);
    if (r.h >= 6) cardTile(g, { x: r.x + 2, y: r.y + 2, w: 22, h: r.h - 4 }, face);
  }

  /**
   * The relics carried, in a dark tray (an amulet at its left end): `extra` (a relic being picked) gets the next slot
   * once it has landed; an empty socket marks where the next one goes.
   */
  private drawTray(g: G, texts: TextPool, pool: ImagePool, depth: number, owned: readonly RelicId[], now: number, alpha: number, glowIds: ReadonlySet<RelicId> = new Set()): void {
    const t = this.trayRect();
    rows(g, t.x, t.y, t.w, t.h, 2, NAVY[0], 0.85 * alpha);
    band(g, t.x, t.y, t.w, t.h, 2, 0, 1, INK, alpha);
    band(g, t.x, t.y, t.w, t.h, 2, t.h - 1, t.h, NAVY[3], alpha);
    pix(g, 'relic', t.x + 3, t.y + 3, 0.85 * alpha);
    const { slots, more } = this.traySlots(owned.length);
    const shown = owned.length - more;
    slots.forEach((r, i) => {
      if (i < shown) {
        const id = owned[i];
        if (glowIds.has(id)) glow(g, r, 0xffd23a, (0.5 + 0.4 * pulse(now, 600)) * alpha, 2);
        relicIcon(this.s, pool, g, id, r.x, r.y, depth, alpha);
      } else if (i === shown && !more) {
        // the next socket: a dashed outline
        g.fillStyle(NAVY[5], 0.8 * alpha);
        for (let k = 0; k < 12; k += 3) {
          g.fillRect(r.x + k, r.y, 2, 1);
          g.fillRect(r.x + k, r.y + 11, 2, 1);
          g.fillRect(r.x, r.y + k, 1, 2);
          g.fillRect(r.x + 11, r.y + k, 1, 2);
        }
      }
    });
    if (more) texts.text(`+${more}`, slots[shown].x + 6, t.y + 7, 0xe8e4ff, { bold: true, ox: 0.5, oy: 0.5, alpha });
  }

  /**
   * Synergy!: a spark flies from a card's lit tag chip to each relic carried that shares the tag (an arc out over the
   * panel's left side, a short glittering tail), and the relic lights up as it lands; then again every 1.4 s. The
   * matching relics keep a gold rim meanwhile. Motion, not lines: nothing stays drawn over the cards.
   */
  private synergyLine(g: G, sy: { chip: Rect; tag: RelicTag; card: Rect; at: number }, owned: readonly RelicId[], now: number): void {
    const p = this.boostPanel();
    const { slots, more } = this.traySlots(owned.length);
    const shown = owned.length - more;
    const age = now - sy.at - 80;
    if (age < 0) return;
    const x0 = sy.chip.x + 4;
    const y0 = sy.chip.y + 4;
    let n = 0;
    owned.forEach((id, i) => {
      if (i >= shown || !relicById(id)?.tags.includes(sy.tag)) return;
      const slot = slots[i];
      const x1 = slot.x + 6;
      const y1 = slot.y + 6;
      // the arc's pull: out toward the panel's left margin, so it sweeps round rather than straight across
      const qx = p.x - 10;
      const qy = (y0 + y1) / 2;
      const bez = (k: number): [number, number] => {
        const u = 1 - k;
        return [u * u * x0 + 2 * u * k * qx + k * k * x1, u * u * y0 + 2 * u * k * qy + k * k * y1];
      };
      const cyc = (age + n * 220) % 1400;
      n++;
      const FLY = 460;
      rows(g, slot.x - 1, slot.y - 1, slot.w + 2, slot.h + 2, 2, GOLD[3], 0.55);
      if (cyc < FLY) {
        const k = easeInOut(cyc / FLY);
        const [hx, hy] = bez(k);
        glow(g, { x: Math.round(hx) - 3, y: Math.round(hy) - 3, w: 6, h: 6 }, 0xffd23a, 0.7, 3);
        for (let j = 14; j >= 0; j--) {
          const kk = k - j * 0.022;
          if (kk < 0) continue;
          const [x, y] = bez(kk);
          const sz = j < 3 ? 3 : j < 8 ? 2 : 1;
          g.fillStyle(j < 3 ? WHITE : j < 8 ? 0xfff0a0 : GOLD[3], 1 - j / 15);
          g.fillRect(Math.round(x) - (sz >> 1), Math.round(y) - (sz >> 1), sz, sz);
        }
      } else if (cyc < FLY + 320) {
        // landed: the relic flashes gold and a ring opens round it
        const k = (cyc - FLY) / 320;
        glow(g, slot, 0xffd23a, 0.9 * (1 - k), 3);
        rows(g, slot.x - 1 - Math.round(k * 3), slot.y - 1 - Math.round(k * 3), slot.w + 2 + Math.round(k * 6), slot.h + 2 + Math.round(k * 6), 3, 0xfff0a0, 0.6 * (1 - k));
      }
    });
  }

  /**
   * The picked card. A relic: the card flashes and folds shut, its icon pops out and flies to the next slot of the
   * relic tray (drawn over whatever comes next, even the screen wipe), lands with a ring, and the tray fades. A
   * stat card lifts, flashes and fades out.
   */
  private drawPicked(now: number): void {
    const g = this.gFly;
    if (!g) return;
    const p = this.picked;
    if (!p) return;
    const relic = isRelicOffer(p.offer) ? p.offer.relic : null;
    const life = relic ? Overlays.RELIC_FLY_MS + 200 : 340;
    const age = now - p.at;
    if (age >= life) {
      this.picked = null;
      return;
    }
    const fly: CardCtx = { s: this.s, g, texts: this.flyTexts, pool: this.flyPool, depth: 41.2 };
    if (!relic) {
      if (this.s.app.run.phase === 'boost') return;
      const k = age / life;
      const r = { ...p.r, y: p.r.y - Math.round(easeOut3(k) * 10) };
      glow(g, r, CARD[p.offer.rarity].face[0], 0.8 * (1 - k), 4);
      this.card(fly, r, p.offer, p.preview, now, Math.max(0, 0.8 - k * 2), 1 - k * k);
      return;
    }
    // (the pick screen stays while it flies: drawBoost draws the tray, and the relic in its slot once it lands)
    if (this.s.app.run.phase !== 'boost') {
      this.picked = null;
      return;
    }
    const landAt = Overlays.RELIC_LAND_MS;
    const { slots } = this.traySlots(p.owned.length);
    const target = slots[Math.min(slots.length - 1, p.owned.length)];
    // the card flashes and folds shut
    if (age < 140) {
      const k = age / 140;
      const h = Math.max(1, Math.round(p.r.h * (1 - k)));
      const r = { ...p.r, y: Math.round(p.r.y + (p.r.h - h) / 2), h };
      glow(g, r, 0xffe680, 0.8 * (1 - k), 4);
      this.cardFace(g, r, p.offer, now);
      g.fillStyle(WHITE, 0.7 * (1 - k));
      g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    }
    // the icon: pops out of the card's tile at 2x, then flies (shrinking to 1x) along an arc to its slot
    const x0 = p.r.x + 1;
    const y0 = p.r.y + p.r.h / 2 - 12;
    if (age < landAt) {
      const k = clamp01((age - 60) / (landAt - 60));
      const e = k * k * (3 - 2 * k);
      const big = k < 0.45;
      const x = x0 + (target.x - (big ? 6 : 0) - x0) * e;
      const y = y0 + (target.y - (big ? 6 : 0) - y0) * e - Math.sin(k * Math.PI) * 18;
      if (k > 0.05) this.s.fx.particles.push({ x: x + (big ? 12 : 6), y: y + (big ? 12 : 6), vx: rand(-14, 14), vy: rand(-14, 14), g: 0, born: now, life: 280, color: Math.random() < 0.5 ? 0xfff0a0 : WHITE, size: 1, world: false, streak: false });
      glow(g, { x: Math.round(x), y: Math.round(y), w: big ? 24 : 12, h: big ? 24 : 12 }, 0xffe680, 0.55, 3);
      relicIcon(this.s, this.flyPool, g, relic, x, y, 41.2, 1, big ? 2 : 1);
    } else {
      // landed: a ring opens round the slot
      if (!this.landedSound) {
        this.landedSound = true;
        this.s.app.audio.statUp(2);
      }
      const k = clamp01((age - landAt) / 240);
      rows(g, target.x - 1 - Math.round(k * 5), target.y - 1 - Math.round(k * 5), target.w + 2 + Math.round(k * 10), target.h + 2 + Math.round(k * 10), 3, 0xfff0a0, 0.75 * (1 - k));
    }
  }

  // ------------------------------------------------------------------ chest screens, defeat, victory, pause

  /**
   * The chest screens. Treasure: "Treasure!" and the chest to tap. The act clear: the act's name over the chest, then
   * (the chest burst) one headline, "Act 1 Clear!", and one line under it (where the road goes next); the build card
   * on the right; on the console the level, the XP bar counting up and the coins counting up; a small accuracy chip
   * in the top-left corner; Camp and Next.
   */
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
    const title = clear ? `Act ${run.actIndex + 1} Clear!` : actClear ? run.act.name : run.treasure?.secret ? 'Secret Cache!' : 'Treasure!';
    const look = clear ? RIBBON.gold : actClear ? RIBBON.blue : RIBBON.gold;
    const tw = textWidth(title, 2, true);
    ribbon(gc, cx, y, Math.round((tw + 24) * (clear ? ok : 1)), 22, look, 1, ok > 0.9);
    if (ok > 0.5)
      this.texts.text(title, cx, y + 11, clear ? 0xfff6c0 : actClear ? WHITE : 0xfff6c0, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: clear || !actClear ? 0x7a3a0a : 0x10204a });
    if (clear) this.drawXp(gc, now);
    else this.drawStatus(gc, now);
    if (!clear) this.subLine(gc, actClear ? 'Tap the chest to continue' : 'Tap the chest', cx, y + 32, 1, true);
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

  /** The one line under a screen's headline: plain text on a soft dark strip (`bold` for a call to act). */
  private subLine(g: G, text: string, cx: number, cy: number, alpha = 1, bold = false, col = 0xf0e8ff): void {
    const w = textWidth(text, 1, bold);
    strip(g, Math.round(cx - w / 2 - 10), Math.round(cy - 6), w + 20, 12, 0.62 * alpha, false);
    this.texts.text(text, cx, cy, col, { bold, ox: 0.5, oy: 0.5, alpha });
  }

  /**
   * After the act-clear chest bursts: the line under the title (where the road goes next), the accuracy as a small
   * chip in the top-left corner (the number counts up), then Camp and Next on the console, popping in one after the
   * other.
   */
  private drawClearExtras(gc: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const since = s.anim - this.chestOpenAt;
    const cx = Math.round(GAME_W / 2);
    // ---- the line under the headline
    const lk = clamp01((since - 160) / 220);
    if (lk > 0) {
      const next = run.region.acts[run.actIndex + 1];
      const line = next ? `The road to ${next.name} is open` : `${run.region.name} is safe again`;
      this.subLine(gc, line, cx, 49 - Math.round((1 - lk) * 3), lk);
    }
    // ---- accuracy: a small, quiet chip in the top-left corner (the planning chat reads it off the act clear)
    const ak = clamp01((since - Overlays.CLEAR_ACC_MS) / 220);
    if (ak > 0) {
      const e = run.actAccuracy;
      const [gw] = glyphSize('target');
      const count = clamp01((s.anim - this.accAt - Overlays.CLEAR_ACC_MS - 80) / 600);
      const full = e ? `${Math.round(e.acc * 100)}%` : '';
      const label = e ? 'accuracy' : 'Accuracy: not yet';
      const w = gw + 3 + (e ? textWidth(full, 1, true) + 3 : 0) + textWidth(label, 1, false) + 6;
      const r: Rect = { x: s.L + 4, y: 4 - Math.round((1 - ak) * 4), w, h: 11 };
      tag(gc, r, [NAVY[5], NAVY[2], NAVY[1], NAVY[0]], 0.85 * ak);
      let x = r.x + 2;
      glyph(gc, 'target', x, r.y + 1, ak * (e ? 1 : 0.6));
      x += gw + 3;
      if (e) {
        const done = count >= 1;
        this.texts.text(`${Math.round(e.acc * 100 * easeOut3(count))}%`, x, r.y + 5.5, done ? 0xffe066 : WHITE, { bold: true, oy: 0.5, alpha: ak });
        x += textWidth(full, 1, true) + 3;
      }
      this.texts.text(label, x, r.y + 6, 0xb0a8cc, { oy: 0.5, alpha: ak });
    }
    // ---- Camp and Next
    const b = this.clearButtons();
    const last = run.actIndex + 1 >= run.region.acts.length;
    this.consoleButtons(gc, now, since - Overlays.CLEAR_BTN_MS + 140, [
      { r: b.camp, face: FACE.navy, label: 'Camp', icon: 'tent', delay: 0 },
      { r: b.next, face: last ? FACE.gold : FACE.green, label: last ? 'Finish' : `Next: Act ${run.actIndex + 2}`, icon: '', delay: 90 },
    ]);
  }

  /** A pair of console buttons (Camp and the way on), popping in one after the other; the way on glows and nudges. */
  private consoleButtons(gc: G, now: number, t: number, items: Array<{ r: Rect; face: readonly [number, number, number, number]; label: string; icon: string; delay: number }>, live = true): void {
    for (const it of items) {
      const k = easeBack((t - it.delay) / 260, 1.7);
      if (k <= 0) continue;
      const r = { ...it.r, y: it.r.y + Math.round((1 - k) * 14) };
      const pr = isPressed(it.r, now);
      if (it.icon === '' && k >= 1 && live) glow(gc, r, it.face[0], 0.3 + 0.35 * pulse(now, 900), 3);
      button3d(gc, r, live ? it.face : FACE.grey, pr);
      const dy = pr ? 2 : 0;
      const tw = textWidth(it.label, 1, true);
      if (it.icon) {
        const [iw, ih] = glyphSize(it.icon);
        const x0 = Math.round(r.x + (r.w - iw - 3 - tw) / 2);
        glyph(gc, it.icon, x0, r.y + Math.round((r.h - ih) / 2) + dy, live ? 1 : 0.6);
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

  /**
   * Defeat, in the act clear's hierarchy: one headline on a red ribbon, one line under it, and Camp / Retry on the
   * console (the bar fades back under a dark band). The knocked-out hero stays in view on the stage.
   */
  private drawDefeat(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.5, 0x12030a);
    // a red pulse around the edges
    const p = pulse(now, 1400);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xa01828, (0.12 + 0.08 * p) * (1 - i / 4));
      g.fillRect(0, i * 3, GAME_W, 3);
      g.fillRect(0, GAME_H - (i + 1) * 3, GAME_W, 3);
    }
    // back from the camp: no entrance, the buttons are live at once
    const t = this.backFromCamp ? since + 1000 : since;
    // the console: a dark band over the bar, for the buttons
    const ck = clamp01(t / 260);
    g.fillStyle(0x07040c, 0.62 * ck);
    g.fillRect(0, s.splitY, GAME_W, GAME_H - s.splitY);
    g.fillStyle(0xa01828, 0.5 * ck);
    g.fillRect(0, s.splitY, GAME_W, 1);
    const k = easeBack(t / 380, 1.6);
    const y = Math.round(20 - (1 - k) * 50);
    const title = 'Defeated';
    const tw = textWidth(title, 2, true);
    ribbon(gc, cx, y, tw + 24, 22, RIBBON.red, clamp01(t / 150), k > 0.9);
    this.texts.text(title, cx, y + 11, 0xffe8e0, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: 0x4a0a14, alpha: clamp01(t / 150) });
    if (t > 220) this.subLine(gc, `Back to the start of Act ${s.app.run.actIndex + 1}. Your gear stays.`, cx, 49 - Math.round((1 - clamp01((t - 220) / 200)) * 3), clamp01((t - 220) / 200), false, 0xffe8e0);
    // Camp (equip what you found before trying again) and Retry, popping in one after the other
    const b = this.defeatButtons();
    const live = t > 700;
    this.consoleButtons(gc, now, t - 300, [
      { r: b.camp, face: FACE.navy, label: 'Camp', icon: 'tent', delay: 0 },
      { r: b.retry, face: FACE.gold, label: 'Retry the act', icon: '', delay: 80 },
    ], live);
  }

  /**
   * The region saved, in the same hierarchy: one headline on a gold ribbon over slow golden rays, one line under it,
   * and the way on (where the road goes next, coming soon) on the console under "Tap to continue".
   */
  private drawVictory(g: G, gc: G, now: number, since: number): void {
    const s = this.s;
    const cx = Math.round(GAME_W / 2);
    this.dim(g, 0.45);
    // slow golden rays behind the title
    const ox = cx;
    const oy = 31;
    const rot = now / 4000;
    for (let i = 0; i < 12; i++) {
      const a0 = rot + (i / 12) * Math.PI * 2;
      const a1 = a0 + Math.PI / 18;
      g.fillStyle(i % 2 ? 0xffe680 : 0xfff6c0, 0.09);
      g.fillTriangle(ox, oy, Math.round(ox + Math.cos(a0) * 260), Math.round(oy + Math.sin(a0) * 260), Math.round(ox + Math.cos(a1) * 260), Math.round(oy + Math.sin(a1) * 260));
    }
    // the console: a dark band
    g.fillStyle(0x07040c, 0.5 * clamp01(since / 300));
    g.fillRect(0, s.splitY, GAME_W, GAME_H - s.splitY);
    const k = easeBack(since / 420, 1.5);
    const title = `${s.app.run.region.name} is saved!`;
    const tw = textWidth(title, 2, true);
    const y = Math.round(20 - (1 - k) * 50);
    ribbon(gc, cx, y, Math.round((tw + 24) * Math.min(1, k)), 22, RIBBON.gold, 1, k > 0.9);
    if (k > 0.5) this.texts.text(title, cx, y + 11, 0xfff6c0, { bold: true, scale: 2, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
    if (since > 400) this.subLine(gc, 'The first weight is home. Eleven to go.', cx, 49, clamp01((since - 400) / 250));
    if (since > 1500) {
      this.prompt(g, 'Tap to continue', s.splitY + 16, now, 0xfff07a);
      this.texts.text('Next: the Frostpeaks (coming soon)', cx, s.splitY + 34, 0xa8c8e8, { ox: 0.5, oy: 0.5, alpha: clamp01((since - 1500) / 300) });
    }
    // a little shower of golden sparks
    if (Math.random() < 0.5) s.fx.particles.push({ x: rand(20, GAME_W - 20), y: -2, vx: rand(-10, 10), vy: rand(20, 40), g: 30, born: now, life: 2200, color: Math.random() < 0.5 ? 0xffe680 : WHITE, size: 1, world: true, streak: false });
    for (let i = 0; i < 5; i++) {
      const q = ((now / 1100 + i * 0.21) % 1 + 1) % 1;
      if (q < 0.4) this.star(gc, Math.round(cx - 110 + ((i * 53) % 220)), 14 + ((i * 23) % 36), q < 0.2 ? 2 : 1, 0xfff0a0, 1 - q / 0.4);
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

  /**
   * "Level up! Lv 7": a gold ribbon sliding out under the hero plate after a fight, over whatever is on screen. One
   * at a time: while a "New relic unlocked!" card is up it waits, and plays once that card is gone.
   */
  private drawLevelToast(g: G, now: number): void {
    const t = this.levelToast;
    if (!t) return;
    if (this.unlockActive()) {
      t.at = now;
      return;
    }
    if (!t.sting && now - t.at >= 150) {
      t.sting = true;
      this.s.app.audio.rareSting(true);
    }
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
   * The act clear's console: the hero's level, an XP bar filling as "+120 XP" counts up (crossing into the next level
   * flashes the bar, pops the level chip and raises "Level up!" over it), then the coins counting up from what the
   * act started with, a tick per step. Each count takes under a second.
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
    const k = easeOut3(clamp01((since - Overlays.CLEAR_XP_MS) / Overlays.CLEAR_XP_LEN));
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
    // the coins count up once the XP has
    const coinsNow = app.run.coins;
    const from = Math.min(coinsNow, this.coinsAtAct);
    const ck = easeOut3(clamp01((since - Overlays.CLEAR_XP_MS - Overlays.CLEAR_XP_LEN + 100) / Overlays.CLEAR_COIN_LEN));
    const shown = Math.round(from + (coinsNow - from) * ck);
    if (this.coinTickShown >= 0 && shown > this.coinTickShown) app.audio.coinTick(Math.min(12, Math.round(ck * 12)));
    const coinPop = this.coinTickShown >= 0 && shown > this.coinTickShown;
    this.coinTickShown = shown;
    const coins = `${shown}`;
    const cw = textWidth(`${coinsNow}`, 1, true) + 15;
    const lv = `Lv ${lp.level}`;
    const lw = textWidth(lv, 1, true) + 8;
    const gw = 100;
    const total = lw + 4 + gw + 8 + cw;
    let x = Math.round((s.L + s.R) / 2 - total / 2);
    // the level chip (gold once the act levelled the hero up; it pops as the bar crosses over)
    const pop = upK >= 0 && upK < 0.5 ? Math.round(Math.sin((upK / 0.5) * Math.PI) * 2) : 0;
    const lr: Rect = { x: x - pop, y: y - pop, w: lw + pop * 2, h: 11 + pop * 2 };
    if (leveled) glow(gc, lr, 0xffd23a, 0.4 + 0.35 * pulse(now, 600), 3);
    tag(gc, lr, leveled ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : [NAVY[6], NAVY[4], NAVY[3], NAVY[2]]);
    this.texts.text(lv, lr.x + lr.w / 2, lr.y + lr.h / 2, leveled ? 0x3a1e08 : 0xffe680, { bold: true, ox: 0.5, oy: 0.5 });
    if (upK >= 0 && upK < 1) rows(gc, lr.x - 2, lr.y - 2, lr.w + 4, lr.h + 4, 3, WHITE, 0.7 * (1 - upK));
    x += lw + 4;
    // the XP bar
    const frac = lp.need > 0 ? lp.into / lp.need : 1;
    gauge(gc, x, y + 1, gw, 8, frac, frac, { ramp: [0xd0f8ff, 0x5ad0f0, 0x2a8ac8, 0x1a4a8a], seg: 10, glow: upK >= 0 && upK < 1 ? 1 - upK : 0 });
    const gain = app.run.actXpGained;
    const label = lp.need > 0 ? (gain > 0 ? `+${Math.round(gain * k)} XP` : `${lp.into}/${lp.need} XP`) : 'Max level';
    this.texts.text(label, x + gw / 2, y + 5, k > 0 && k < 1 ? 0xe0f6ff : WHITE, { bold: true, ox: 0.5, oy: 0.5 });
    if (leveled && !this.unlockActive()) {
      // "Level up!" pops out over the level chip and stays while the screen is up (hidden while a "New relic
      // unlocked!" card is up: one at a time)
      const rk = easeBack((now - this.xpUpAt) / 300, 1.8);
      const t = 'Level up!';
      const rw = Math.round((textWidth(t, 1, true) + 12) * Math.min(1, rk));
      if (rw > 8) {
        ribbon(gc, x - 4 + 14 - lw / 2, y - 15, rw, 11, RIBBON.gold, 1, rk > 0.9);
        if (rk > 0.8) this.texts.text(t, x - 4 + 14 - lw / 2, y - 9.5, 0xfffbe0, { bold: true, ox: 0.5, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a });
      }
      if (upK >= 0 && upK < 0.1) s.fx.burst(lr.x + lr.w / 2, lr.y + 5, 0xffe680, 14, false, 1.2);
    }
    x += gw + 8;
    const cr: Rect = { x, y, w: cw, h: 11 };
    tag(gc, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]]);
    if (coinPop) glow(gc, cr, 0xffe680, 0.6, 2);
    hudIcon(gc, 'coin', cr.x + 2, cr.y + 1 - (coinPop ? 1 : 0));
    this.texts.text(coins, cr.x + 12, cr.y + 5.5, coinPop ? WHITE : 0xffe680, { bold: true, oy: 0.5 });
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

  // ------------------------------------------------------------------ for the tips (view/tips.ts)

  /** What the tips need: whether a toast or a flying card of ours is up, and the act clear's and the defeat's
   *  buttons once they're in (null before). */
  tipPeek(): { toast: boolean; clear: { camp: Rect; next: Rect } | null; defeat: { camp: Rect; retry: Rect } | null } {
    const ph = this.s.app.run.phase;
    return {
      toast: !!this.levelToast || !!this.picked,
      clear: ph === 'actClear' && this.clearReady() ? this.clearButtons() : null,
      defeat: ph === 'defeat' && (this.backFromCamp || performance.now() - this.phaseAt > 900) ? this.defeatButtons() : null,
    };
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
