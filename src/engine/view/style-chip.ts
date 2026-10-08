// The style readout chip: what the fighting hero's style has stored right now. Shadow: the Chain (x2..x5, glowing at
// its longest); Guardian: Guard charges as pips; Marksman: Focus as a small bar (glowing gold when full: the next green
// crits); Torva: Unstoppable stacks; a Summoner: a pip per ally out, in its colour (all out: the next call is a Rally);
// Gorm: hits toward the next Rockfall; Tess: hits toward the next Stopwatch.
// Drawn twice: beside the potion on the hero plate (view/hud.ts) and as a tab on the bar's left end (view/callouts.ts),
// where the player's eyes are. Values come from the fight (core/styles.ts helpers, c.perk), never stored here.
import type Phaser from 'phaser';
import type { Combat } from '../../core/combat';
import { rockEvery, stopEvery } from '../../core/kit-fx';
import { allyKinds, chainOf, focusCap, focusOf, guardMax, guardOf } from '../../core/styles';
import { heroDef, type HeroId } from '../../data/heroes';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { FOE_ICONS as GLYPHS } from './icons';
import { ALLY_COL } from './party';
import { glow, hudIcon, icon, NAVY, rows } from './pixels';
import { clamp01, INK, pulse, WHITE, type Rect } from './shared';
import { tag, type TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** What a style stores right now, as a short key (it changes exactly when the chip's look does: the bar's tab pulses
 *  then). Null when the hero's style has nothing to show. `empty`: nothing stored yet. */
export function styleState(s: FightScene, c: Combat): { key: string; empty: boolean } | null {
  const style = heroDef(c.heroId as HeroId).style;
  if (style === 'shadow') {
    const n = chainOf(c);
    return { key: `chain${n < 2 ? 0 : n}`, empty: n < 2 };
  }
  if (style === 'guardian') return { key: `guard${guardOf(c)}/${guardMax(c)}`, empty: guardOf(c) <= 0 };
  if (style === 'marksman') {
    const k = clamp01(focusOf(c) / Math.max(1, focusCap(c)));
    // (the gauge's 18 px: a pulse each time it visibly fills, and when it's full)
    return { key: `focus${Math.round(18 * k)}${k >= 0.999 ? 'full' : ''}`, empty: focusOf(c) <= 0 };
  }
  if (c.heroId === 'torva') {
    const n = c.perk.unstoppable ?? 0;
    return { key: `unstoppable${n}`, empty: n <= 0 };
  }
  // ---- Gorm and Tess (Part 6): hits toward the next Rockfall; toward the next Stopwatch (or time stopped)
  if (c.heroId === 'gorm') {
    const n = c.perk.rockfall ?? 0;
    return { key: `rockfall${n}`, empty: n <= 0 };
  }
  if (c.heroId === 'tess') {
    const n = c.perk.stop > 0 ? -1 : (c.perk.tick ?? 0);
    return { key: `stopwatch${n}`, empty: n === 0 };
  }
  if (style === 'summoner') {
    const out = allyKinds(c).filter((k) => c.allies.some((a) => a.kind === k));
    return { key: `allies${out.join(',')}`, empty: out.length <= 0 };
  }
  void s;
  return null;
}

/**
 * Draw the chip with its top-left at (x, y): 10 px tall, as wide as what it shows. Returns its rect, or null when
 * there's nothing to draw. `empty`: draw it even with nothing stored (dimmed: the pips or the gauge waiting to fill);
 * `alpha` fades it as a whole.
 */
export function drawStyleChip(s: FightScene, g: G, texts: TextPool, c: Combat, x: number, y: number, now: number, o: { empty?: boolean; alpha?: number } = {}): Rect | null {
  const style = heroDef(c.heroId as HeroId).style;
  const A = o.alpha ?? 1;
  const chip = (w: number, hot: number | null): Rect => {
    const r: Rect = { x, y, w, h: 10 };
    if (hot !== null) glow(g, r, hot, (0.45 + 0.35 * pulse(now, 420)) * A, 2);
    tag(g, r, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.94 * A);
    return r;
  };
  if (style === 'shadow') {
    const n = chainOf(c);
    if (n < 2 && !o.empty) return null;
    const max = Math.round(s.app.tuning.styles.chainMax);
    const txt = `x${Math.max(1, n)}`;
    const dim = n < 2;
    const r = chip(12 + textWidth(txt, 1, true), n >= max ? 0xdab0ff : null);
    // two links of a chain
    const link = dim ? NAVY[6] : 0xdab0ff;
    g.fillStyle(link, A);
    for (const [lx, ly] of [
      [r.x + 2, r.y + 2],
      [r.x + 5, r.y + 4],
    ])
      rows(g, lx, ly, 5, 4, 1, link, A);
    g.fillStyle(NAVY[3], A);
    g.fillRect(r.x + 3, r.y + 3, 3, 2);
    g.fillRect(r.x + 6, r.y + 5, 3, 2);
    texts.text(txt, r.x + 11, r.y + 5, dim ? 0x9a94b0 : n >= max ? WHITE : 0xe0c8ff, { bold: true, oy: 0.5, alpha: A });
    return r;
  }
  if (style === 'guardian') {
    const n = guardOf(c);
    const max = guardMax(c);
    if (n <= 0 && !o.empty) return null;
    const r = chip(10 + max * 3, n >= max ? 0x9ad8ff : null);
    hudIcon(g, 'shield', r.x + 1, r.y + 1, 1, n > 0 ? A : 0.6 * A);
    for (let i = 0; i < max; i++) {
      g.fillStyle(i < n ? 0x9ad8ff : NAVY[1], A);
      g.fillRect(r.x + 9 + i * 3, r.y + 3, 2, 4);
      if (i < n) {
        g.fillStyle(WHITE, A);
        g.fillRect(r.x + 9 + i * 3, r.y + 3, 2, 1);
      }
    }
    return r;
  }
  if (style === 'marksman') {
    const f = focusOf(c);
    if (f <= 0 && !o.empty) return null;
    const k = clamp01(f / Math.max(1, focusCap(c)));
    const full = k >= 0.999;
    const r = chip(30, full ? 0xffe680 : null);
    icon(g, GLYPHS.arrow, r.x + 2, r.y + 1, full ? 0xfff0a0 : f > 0 ? 0xd8c8f0 : 0x8a84a8);
    const bx = r.x + 10;
    const bw = 18;
    g.fillStyle(INK, A);
    g.fillRect(bx - 1, r.y + 2, bw + 2, 6);
    g.fillStyle(NAVY[1], A);
    g.fillRect(bx, r.y + 3, bw, 4);
    const fw = Math.round(bw * k);
    if (fw > 0) {
      g.fillStyle(full ? 0xf2c230 : 0xb07ae0, A);
      g.fillRect(bx, r.y + 3, fw, 4);
      g.fillStyle(full ? 0xfff0a0 : 0xdab0ff, A);
      g.fillRect(bx, r.y + 3, fw, 1);
      if (full && Math.floor(now / 140) % 2) {
        g.fillStyle(WHITE, 0.8 * A);
        g.fillRect(bx + ((Math.floor(now / 40) % bw) | 0), r.y + 3, 2, 4);
      }
    }
    return r;
  }
  if (c.heroId === 'torva') {
    const n = c.perk.unstoppable ?? 0;
    if (n <= 0 && !o.empty) return null;
    const max = Math.round(s.app.tuning.kits.torva.unstoppableMax);
    const txt = `x${n}`;
    const r = chip(11 + textWidth(txt, 1, true), n >= max ? 0xff7a4a : null);
    // a flame: angrier with every hit taken
    g.fillStyle(0xd03030, A);
    g.fillRect(r.x + 2, r.y + 3, 5, 5);
    g.fillRect(r.x + 3, r.y + 1, 2, 2);
    g.fillRect(r.x + 5, r.y + 2, 1, 1);
    g.fillStyle(0xff9a3a, A);
    g.fillRect(r.x + 3, r.y + 4, 3, 3);
    g.fillStyle(0xffe070, A);
    g.fillRect(r.x + 4, r.y + 5, 1, 2);
    texts.text(txt, r.x + 10, r.y + 5, n >= max ? WHITE : 0xffb090, { bold: true, oy: 0.5, alpha: A });
    return r;
  }
  // ---- Gorm and Tess (Part 6)
  if (c.heroId === 'gorm') {
    // a boulder and a pip per hit toward the next Rockfall (the last one lit: the next hit lands heavy)
    const every = rockEvery(c);
    const n = Math.min(every - 1, c.perk.rockfall ?? 0);
    if (n <= 0 && !o.empty) return null;
    const ready = n >= every - 1;
    const r = chip(11 + (every - 1) * 4, ready ? 0xe0d0b0 : null);
    // a round boulder, lit from the top left, a tuft of moss
    g.fillStyle(INK, A);
    g.fillRect(r.x + 2, r.y + 2, 7, 7);
    g.fillStyle(0x5c5864, A);
    g.fillRect(r.x + 3, r.y + 2, 5, 7);
    g.fillRect(r.x + 2, r.y + 3, 7, 5);
    g.fillStyle(0x96908e, A);
    g.fillRect(r.x + 3, r.y + 3, 4, 4);
    g.fillStyle(0xd6cdb8, A);
    g.fillRect(r.x + 3, r.y + 3, 2, 1);
    g.fillRect(r.x + 3, r.y + 4, 1, 1);
    g.fillStyle(0xa2c84e, A);
    g.fillRect(r.x + 6, r.y + 2, 2, 1);
    for (let i = 0; i < every - 1; i++) {
      const on = i < n;
      g.fillStyle(on ? (ready ? 0xfff0c8 : 0xc4bcae) : 0x4a4858, A);
      g.fillRect(r.x + 11 + i * 4, r.y + 3, 3, 4);
      if (on) {
        g.fillStyle(WHITE, 0.8 * A);
        g.fillRect(r.x + 11 + i * 4, r.y + 3, 3, 1);
      }
    }
    return r;
  }
  if (c.heroId === 'tess') {
    // a pocket watch, and a brass gauge filling hit by hit toward the next Stopwatch (full and glowing while time is
    // stopped)
    const stopped = c.perk.stop > 0;
    const k = stopped ? 1 : clamp01((c.perk.tick ?? 0) / Math.max(1, stopEvery(c)));
    if (k <= 0 && !o.empty) return null;
    const r = chip(28, stopped ? 0xffe08a : null);
    g.fillStyle(0xd8a83a, A);
    g.fillRect(r.x + 2, r.y + 2, 6, 6);
    g.fillRect(r.x + 4, r.y + 1, 2, 1);
    g.fillStyle(0xfff8e8, A);
    g.fillRect(r.x + 3, r.y + 3, 4, 4);
    g.fillStyle(INK, A);
    const a = k * Math.PI * 2 - Math.PI / 2;
    g.fillRect(r.x + 5, r.y + 5, 1, 1);
    g.fillRect(r.x + 5 + Math.round(Math.cos(a) * 1.5), r.y + 5 + Math.round(Math.sin(a) * 1.5), 1, 1);
    const bx = r.x + 10;
    const bw = 16;
    g.fillStyle(INK, A);
    g.fillRect(bx - 1, r.y + 2, bw + 2, 6);
    g.fillStyle(NAVY[1], A);
    g.fillRect(bx, r.y + 3, bw, 4);
    const fw = Math.round(bw * k);
    if (fw > 0) {
      g.fillStyle(stopped ? 0xffe08a : 0xd8a83a, A);
      g.fillRect(bx, r.y + 3, fw, 4);
      g.fillStyle(0xfff0c0, A);
      g.fillRect(bx, r.y + 3, fw, 1);
      if (stopped && Math.floor(now / 140) % 2) {
        g.fillStyle(WHITE, 0.8 * A);
        g.fillRect(bx + ((Math.floor(now / 40) % bw) | 0), r.y + 3, 2, 4);
      }
    }
    return r;
  }
  if (style === 'summoner') {
    const kinds = allyKinds(c);
    const n = c.allies.length;
    if (n <= 0 && !o.empty) return null;
    const all = kinds.every((k) => c.allies.some((a) => a.kind === k));
    const r = chip(10 + kinds.length * 5, all ? 0xffe680 : null);
    icon(g, GLYPHS.leaf, r.x + 1, r.y + 1, n > 0 ? 0x9af06a : 0x5a8a4a);
    kinds.forEach((k, i) => {
      const out = c.allies.some((a) => a.kind === k);
      const px = r.x + 10 + i * 5;
      g.fillStyle(out ? ALLY_COL[k] : NAVY[1], A);
      g.fillRect(px, r.y + 3, 3, 4);
      if (out) {
        g.fillStyle(WHITE, 0.8 * A);
        g.fillRect(px, r.y + 3, 3, 1);
      }
    });
    return r;
  }
  return null;
}
