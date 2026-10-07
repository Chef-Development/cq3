// The modern menus' shared parts (docs/ui-style.md): a painted, lit stage per screen, the vignette, rarity auras, glass
// plates for detail, icon cards, meters, pips and rings, the big main button, the info button and its detail sheet,
// and the entrance stagger. Every redesigned screen is built from these; a screen that needs a new part appends it
// at the end of this file (one shared set, not a private variant per screen). Drawing is on the camp kit's layers and
// pools (camp-kit.ts); everything animates from `now` (performance.now, faked in screenshot tests).
import type Phaser from 'phaser';
import { TIER_INFO, type Tier } from '../../data/rarity';
import { ensureStage, STAGE_THEMES } from '../art-ui-stage';
import { textWidth } from '../font';
import { D, GOLD_TXT, pix, pixSize, type CampKit, type Layer } from './camp-kit';
import { wrapText } from './items';
import { band, button3d, glow, GOLD, gauge, NAVY, rows } from './pixels';
import { clamp01, easeBack, easeOut3, INK, inRect, mix, pulse, WHITE, type Rect } from './shared';
import { isPressed, type TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
export type Face = readonly [number, number, number, number];

/** The depth a screen's backdrop image sits at: over the camp, under the screen's own graphics (D.ui). */
export const STAGE_DEPTH = D.ui - 0.004;

// ------------------------------------------------------------------ timing

/** The entrance stagger: 0 -> 1 for item `i` of a screen opened at `at` (`dur` ms each, `step` ms apart). */
export function enterK(now: number, at: number, i = 0, step = 40, dur = 240): number {
  return clamp01((now - at - i * step) / dur);
}

/** The same with a slight overshoot (things that pop in). */
export function popK(now: number, at: number, i = 0, step = 40, dur = 260): number {
  const k = (now - at - i * step) / dur;
  return k <= 0 ? 0 : k >= 1 ? 1 : easeBack(k, 1.5);
}

// ------------------------------------------------------------------ shapes

/** A filled ellipse row by row (pixel steps). */
export function fillEllipse(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
  if (rx <= 0 || ry <= 0) return;
  g.fillStyle(color, alpha);
  const ry0 = Math.ceil(ry);
  for (let y = -ry0; y <= ry0; y++) {
    const k = 1 - (y * y) / (ry * ry);
    if (k <= 0) continue;
    const half = Math.round(rx * Math.sqrt(k));
    if (half > 0) g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

/** Darkens the edges and corners of the screen in stepped bands (`k` 0..1: how strong). */
export function vignette(g: G, s: { L: number; R: number; B: number }, k = 1): void {
  const W = 327 + 40;
  const H = 150 + 20;
  const steps = [
    [10, 0.22],
    [6, 0.2],
    [3, 0.18],
  ] as const;
  for (const [d, a] of steps) {
    g.fillStyle(INK, a * k);
    g.fillRect(-20, -10, W, d + 10); // top
    g.fillRect(-20, H - 20 - d, W, d + 10); // bottom
    g.fillRect(-20, -10, d + 20, H); // left
    g.fillRect(W - 40 - d, -10, d + 40, H); // right
  }
  // the corners a little deeper
  g.fillStyle(INK, 0.18 * k);
  for (const [x, y] of [
    [0, 0],
    [W - 40 - 26, 0],
    [0, H - 20 - 18],
    [W - 40 - 26, H - 20 - 18],
  ])
    rows(g, x, y, 26, 18, 6, INK, 0.16 * k);
  void s;
}

/**
 * A light cone from above onto a floor pool: stepped trapezoids in `col` (light from the top, wTop wide at topY,
 * wBot wide at floorY), then the pool on the floor. `a` is the brightest layer's alpha.
 */
export function spotlight(g: G, cx: number, topY: number, floorY: number, wTop: number, wBot: number, col: number, a = 0.1, flicker = 1): void {
  const layers = [1, 0.72, 0.45];
  layers.forEach((s, li) => {
    g.fillStyle(col, a * (0.55 + li * 0.25) * flicker);
    const h = floorY - topY;
    for (let y = 0; y < h; y += 2) {
      const k = y / h;
      const half = Math.round(((wTop + (wBot - wTop) * k) * s) / 2);
      g.fillRect(Math.round(cx - half), topY + y, half * 2, 2);
    }
  });
  // the pool on the floor
  fillEllipse(g, cx, floorY, wBot * 0.62, 5, col, a * 1.2 * flicker);
  fillEllipse(g, cx, floorY, wBot * 0.4, 3, col, a * 1.4 * flicker);
}

/** The stage disc a hero (or a chest) stands on: a rim, a lit top, a dark side. */
export function stageDisc(g: G, cx: number, y: number, rx: number, cols: readonly [number, number, number], alpha = 1): void {
  const [rim, top, side] = cols;
  fillEllipse(g, cx, y + 3, rx + 2, 6, INK, 0.5 * alpha);
  fillEllipse(g, cx, y + 2, rx + 1, 5, INK, alpha);
  fillEllipse(g, cx, y + 2, rx, 4, side, alpha);
  fillEllipse(g, cx, y, rx, 4, rim, alpha);
  fillEllipse(g, cx, y, rx - 1, 3, top, alpha);
  g.fillStyle(mix(rim, WHITE, 0.4), 0.8 * alpha);
  g.fillRect(Math.round(cx - rx * 0.5), Math.round(y - 3), Math.round(rx * 0.5), 1);
}

// ------------------------------------------------------------------ the stage

export interface StageOpts {
  /** Where the stage disc and its light are (none: no disc, no cone). */
  disc?: { x: number; y: number; rx: number };
  /** The light cone's strength (0: none). */
  light?: number;
  /** Drifting motes in the light colour. */
  motes?: boolean;
  /** 0..1: the backdrop's fade-in. */
  alpha?: number;
  /** Darken the backdrop (a locked hero's dim stage, a detail-heavy screen). 0..1. */
  dim?: number;
  vignette?: number;
}

/** A theme's painted backdrop, its light, the stage disc, motes and the vignette (the screen's focal frame). */
export function drawStage(kit: CampKit, theme: string, now: number, o: StageOpts = {}): void {
  const s = kit.s;
  const sp = STAGE_THEMES[theme] ?? STAGE_THEMES.night;
  const key = ensureStage(s, theme);
  const a = o.alpha ?? 1;
  kit.imgs.at(key, 0, 0, STAGE_DEPTH, a);
  const g = kit.gUi;
  if (o.dim) {
    g.fillStyle(INK, o.dim * a);
    g.fillRect(-20, -10, 380, 180);
  }
  const d = o.disc;
  if (d) {
    const flick = 0.9 + 0.1 * pulse(now, 1300) + 0.05 * Math.sin(now / 97);
    if ((o.light ?? 1) > 0) spotlight(g, d.x, -4, d.y, d.rx * 1.1, d.rx * 2.4, sp.light, 0.085 * (o.light ?? 1) * a, flick);
    stageDisc(g, d.x, d.y, d.rx, sp.disc, a);
  }
  if (o.motes !== false) motes(g, sp.light, now, s.L, s.R, 18, sp.floorY, a * 0.8);
  vignette(g, s, (o.vignette ?? 1) * a);
}

/** Slow motes drifting up through the scene (deterministic from `now`). */
export function motes(g: G, col: number, now: number, x0: number, x1: number, y0: number, y1: number, alpha = 1, n = 14): void {
  for (let i = 0; i < n; i++) {
    const period = 7000 + ((i * 1733) % 5000);
    const t = ((now + i * 977) % period) / period;
    const x = x0 + ((i * 89 + Math.sin(now / 1900 + i) * 6) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
    const y = y1 - t * (y1 - y0);
    const a = Math.sin(t * Math.PI) * alpha * (0.4 + 0.6 * pulse(now, 900 + i * 70, i * 300));
    g.fillStyle(col, a);
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (i % 3 === 0) g.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
  }
}

// ------------------------------------------------------------------ rarity aura

/**
 * A rarity's glow behind something rare (a hero, a companion, a chest, a prize): stepped ellipses in the tier's
 * colours that breathe, motes rising through it, and for the top tiers their twinkles (Celestial stars, Divine's
 * prismatic shine). `k` scales it (0..1: entering).
 */
export function aura(kit: CampKit, g: G, cx: number, cy: number, rx: number, ry: number, tier: Tier, now: number, k = 1): void {
  const [hi, base, , deep] = TIER_INFO[tier].face;
  const br = 0.85 + 0.15 * pulse(now, 1400);
  const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'celestial', 'divine'].indexOf(tier);
  const strength = 0.55 + rank * 0.07;
  fillEllipse(g, cx, cy, rx * 1.25 * k, ry * 1.2 * k, deep, 0.18 * strength * br);
  fillEllipse(g, cx, cy, rx * k, ry * k, base, 0.16 * strength * br);
  fillEllipse(g, cx, cy, rx * 0.68 * k, ry * 0.7 * k, hi, 0.14 * strength * br);
  // rising motes
  const n = 6 + rank * 2;
  for (let i = 0; i < n; i++) {
    const period = 1800 + ((i * 431) % 1400);
    const t = ((now + i * 613) % period) / period;
    const x = cx + Math.sin(i * 2.3 + now / 1500) * rx * 0.8;
    const y = cy + ry * 0.8 - t * ry * 2.2;
    g.fillStyle(i % 2 ? hi : WHITE, Math.sin(t * Math.PI) * 0.8 * k);
    g.fillRect(Math.round(x), Math.round(y), 1, i % 4 === 0 ? 2 : 1);
  }
  const info = TIER_INFO[tier];
  if (info.sparkle !== 'none') {
    const c = Math.floor(now / 150) % 4;
    const key = info.sparkle === 'stars' ? 'rarity_sparkle_celestial' : 'rarity_shine_divine';
    if (kit.has(`${key}_${c}`)) {
      kit.imgs.at(`${key}_${c}`, Math.round(cx - rx * 0.8), Math.round(cy - ry * 0.9), D.icons - 0.001, k);
      kit.imgs.at(`${key}_${(c + 2) % 4}`, Math.round(cx + rx * 0.6), Math.round(cy - ry * 0.2), D.icons - 0.001, k);
    }
  }
}

// ------------------------------------------------------------------ plates and cards

export interface GlassOpts {
  alpha?: number;
  /** A coloured rim (the selection, a rarity). */
  rim?: number;
  /** The plate's tint (default deep ink-violet). */
  tint?: number;
  /** How see-through: 0 opaque .. 1 clear (default 0.25). */
  clear?: number;
}

/** The detail plate: a translucent dark body over the scene, a soft shadow, a lit top edge, an optional rim. */
export function glass(g: G, r: Rect, o: GlassOpts = {}): void {
  const a = o.alpha ?? 1;
  const body = o.tint ?? 0x120c22;
  const op = 1 - (o.clear ?? 0.25);
  rows(g, r.x - 1, r.y + 2, r.w + 2, r.h + 1, 3, INK, 0.35 * a);
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, o.rim ?? INK, (o.rim !== undefined ? 0.9 : 0.75) * a);
  rows(g, r.x, r.y, r.w, r.h, 2, body, op * a);
  // a faint lighter top half and the lit top edge
  band(g, r.x, r.y, r.w, r.h, 2, 0, Math.max(2, Math.round(r.h * 0.35)), mix(body, 0x8a7cc0, 0.18), 0.5 * op * a);
  band(g, r.x, r.y, r.w, r.h, 2, 0, 1, mix(body, WHITE, 0.35), 0.8 * a);
  g.fillStyle(WHITE, 0.5 * a);
  g.fillRect(r.x + r.w - 7, r.y + 1, 3, 1);
}

export interface IconCardOpts {
  /** Frame colours [hi, base, lo, deep] (a tier's face, a kit part's colour). */
  face: Face;
  /** Draws the emblem centred on (cx, cy). */
  emblem: (g: G, cx: number, cy: number, alpha: number) => void;
  /** A one-word label under the card (bold). */
  label?: string;
  labelCol?: number;
  selected?: boolean;
  dim?: boolean;
  /** A small badge at the top right ("!", a count). */
  badge?: string;
  badgeGold?: boolean;
  alpha?: number;
}

/**
 * A square card: an emblem in a well, a frame in its colours (lit top-left, shaded bottom-right), a label under it;
 * selected cards lift and glow gold, pressed ones sink. Returns the card's rect as drawn (lifted/sunk).
 */
export function iconCard(kit: CampKit, l: Layer, r: Rect, o: IconCardOpts, now: number): Rect {
  const g = l.g;
  const a = o.alpha ?? 1;
  const pr = isPressed(r, now);
  const lift = o.selected ? -2 : 0;
  const rr = { ...r, y: r.y + (pr ? 1 : lift) };
  const [hi, base, lo, deep] = o.dim ? ([0x6a6078, 0x4a4058, 0x3a3048, 0x2a2438] as const) : o.face;
  if (o.selected) glow(g, rr, 0xffd23a, (0.3 + 0.25 * pulse(now, 1000)) * a, 3);
  rows(g, rr.x - 1, rr.y + 2, rr.w + 2, rr.h + 1, 3, INK, 0.45 * a);
  rows(g, rr.x - 1, rr.y - 1, rr.w + 2, rr.h + 2, 3, INK, a);
  rows(g, rr.x, rr.y, rr.w, rr.h, 2, base, a);
  g.fillStyle(hi, a);
  g.fillRect(rr.x + 2, rr.y, rr.w - 4, 1);
  g.fillRect(rr.x, rr.y + 2, 1, rr.h - 4);
  g.fillStyle(deep, a);
  g.fillRect(rr.x + 2, rr.y + rr.h - 1, rr.w - 4, 1);
  g.fillRect(rr.x + rr.w - 1, rr.y + 2, 1, rr.h - 4);
  g.fillStyle(lo, a);
  g.fillRect(rr.x + 1, rr.y + rr.h - 2, rr.w - 2, 1);
  // the well
  rows(g, rr.x + 2, rr.y + 2, rr.w - 4, rr.h - 4, 1, INK, a);
  g.fillStyle(mix(deep, INK, 0.55), a);
  g.fillRect(rr.x + 3, rr.y + 3, rr.w - 6, rr.h - 6);
  g.fillStyle(mix(deep, base, 0.3), 0.6 * a);
  g.fillRect(rr.x + 3, rr.y + 3, rr.w - 6, Math.round((rr.h - 6) * 0.45));
  if (o.selected) {
    g.fillStyle(GOLD[3], a);
    g.fillRect(rr.x + 2, rr.y - 1, rr.w - 4, 1);
  }
  o.emblem(l.over, rr.x + rr.w / 2, rr.y + rr.h / 2, o.dim ? 0.5 * a : a);
  if (o.label) l.texts.text(o.label, rr.x + rr.w / 2, rr.y + rr.h + 6, o.labelCol ?? (o.selected ? GOLD_TXT : 0xe8e0ff), { bold: true, ox: 0.5, oy: 0.5, alpha: a });
  if (o.badge) kit.bubble(l.over, l.texts, rr.x + rr.w - 2, rr.y - 4, o.badge, now, o.badgeGold);
  return rr;
}

// ------------------------------------------------------------------ meters

export interface MeterOpts {
  ramp?: Face;
  /** An icon (camp-kit pix / HUD icon key) at the left. */
  icon?: string;
  /** A short label over the bar's left end, and the value at its right end (bold). */
  label?: string;
  value?: string;
  valueCol?: number;
  /** Notches every this many px. */
  seg?: number;
  /** Pulse when full. */
  full?: boolean;
  alpha?: number;
}

/** A chunky labelled meter: icon, label, value over the bar; the bar fills `frac` (a full one glows). */
export function meter(g: G, texts: TextPool, r: Rect, frac: number, o: MeterOpts = {}, now = 0): void {
  const a = o.alpha ?? 1;
  let x = r.x;
  if (o.icon) {
    const [iw, ih] = pixSize(o.icon);
    pix(g, o.icon, x, Math.round(r.y + r.h - 3 - ih / 2), a);
    x += iw + 3;
  }
  const barH = 5;
  const by = r.y + r.h - barH;
  const full = o.full ?? frac >= 1;
  gauge(g, x, by, r.x + r.w - x, barH, frac, 0, { ramp: o.ramp, seg: o.seg, glow: full ? 0.3 + 0.4 * pulse(now, 900) : 0 });
  if (o.label) texts.text(o.label, x, by - 5, 0xd8d0f0, { oy: 0.5, alpha: a });
  if (o.value) texts.text(o.value, r.x + r.w, by - 5, o.valueCol ?? WHITE, { bold: true, ox: 1, oy: 0.5, alpha: a });
}

export type PipKind = 'star' | 'seal' | 'dot';

/** `n` pips in a row from (x, y) (top-left), `lit` of them bright, the next one pulsing; returns the row's width. */
export function pips(g: G, x: number, y: number, n: number, lit: number, now: number, o: { kind?: PipKind; size?: number; gap?: number; col?: Face; alpha?: number } = {}): number {
  const kind = o.kind ?? 'dot';
  const sz = o.size ?? (kind === 'star' ? 9 : 7);
  const gap = o.gap ?? 2;
  const a = o.alpha ?? 1;
  const [hi, base, lo, deep] = o.col ?? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]];
  for (let i = 0; i < n; i++) {
    const px = x + i * (sz + gap);
    const on = i < lit;
    const next = i === lit;
    const k = next ? 0.35 + 0.35 * pulse(now, 1100) : 0;
    if (kind === 'star') {
      starShape(g, px + sz / 2, y + sz / 2, sz, on ? [hi, base, lo] : [mix(NAVY[6], hi, k), NAVY[4], NAVY[2]], a);
      continue;
    }
    // a round seal (or a dot): ink rim, a two-tone face, a shine
    fillEllipse(g, px + sz / 2, y + sz / 2, sz / 2 + 1, sz / 2 + 1, INK, a);
    fillEllipse(g, px + sz / 2, y + sz / 2, sz / 2, sz / 2, on ? base : mix(NAVY[3], base, k), a);
    if (on) {
      fillEllipse(g, px + sz / 2, y + sz / 2 + 1, sz / 2 - 1, sz / 2 - 2, lo, a);
      fillEllipse(g, px + sz / 2 - 0.5, y + sz / 2 - 0.5, sz / 2 - 2, sz / 2 - 2, base, a);
      g.fillStyle(hi, a);
      g.fillRect(Math.round(px + sz / 2 - 2), Math.round(y + 1), 2, 1);
      if (kind === 'seal') {
        g.fillStyle(deep, a);
        g.fillRect(Math.round(px + sz / 2 - 1), Math.round(y + sz / 2 - 1), 2, 2);
      }
    }
  }
  return n * sz + (n - 1) * gap;
}

/** A chunky five-point star of size `sz` centred on (cx, cy) in [light, base, shadow]. */
export function starShape(g: G, cx: number, cy: number, sz: number, col: readonly [number, number, number], alpha = 1): void {
  const R = sz / 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : R * 0.45;
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  const inside = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const x0 = Math.floor(cx - R - 1);
  const y0 = Math.floor(cy - R - 1);
  const n = Math.ceil(sz + 2);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const px = x0 + x + 0.5;
      const py = y0 + y + 0.5;
      if (inside(px, py)) {
        g.fillStyle(px - cx + (py - cy) < -R * 0.2 ? col[0] : px - cx + (py - cy) > R * 0.5 ? col[2] : col[1], alpha);
        g.fillRect(x0 + x, y0 + y, 1, 1);
      } else if (inside(px - 1, py) || inside(px + 1, py) || inside(px, py - 1) || inside(px, py + 1)) {
        g.fillStyle(INK, alpha);
        g.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
}

/** A round meter (completion, pity): a dark ring with `frac` of it lit clockwise from the top, thickness `th`. */
export function ring(g: G, cx: number, cy: number, r: number, frac: number, o: { th?: number; ramp?: Face; alpha?: number; glowNow?: number } = {}): void {
  const th = o.th ?? 3;
  const a = o.alpha ?? 1;
  const [hi, base, lo] = o.ramp ?? [0xc8ff8a, 0x62d444, 0x2e9a34, 0x1a6a2a];
  const f = clamp01(frac);
  for (let y = -r - 1; y <= r + 1; y++)
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 1 || d < r - th - 1) continue;
      const px = Math.round(cx + x);
      const py = Math.round(cy + y);
      if (d > r || d < r - th) {
        g.fillStyle(INK, a);
        g.fillRect(px, py, 1, 1);
        continue;
      }
      const ang = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2);
      const on = f > 0 && ang / (Math.PI * 2) <= f;
      g.fillStyle(on ? (d > r - 1 ? hi : d < r - th + 1 ? lo : base) : d > r - 1 ? NAVY[4] : NAVY[2], a);
      g.fillRect(px, py, 1, 1);
    }
}

// ------------------------------------------------------------------ buttons

/**
 * The screen's main action: the camp's chunky button, taller, with a halo that pulses and a sheen that sweeps across
 * now and then. Same options as kit.button (icon, cost, disabled, shakeAt...).
 */
export function bigButton(kit: CampKit, g: G, texts: TextPool, r: Rect, label: string, face: Face, now: number, o: Parameters<CampKit['button']>[6] = {}): void {
  kit.button(g, texts, r, label, face, now, { glowCol: o.disabled ? undefined : (o.glowCol ?? face[0]), ...o });
  if (o.disabled) return;
  // the sheen: a bright slanted band crossing the face every 2.6 s
  const t = (now % 2600) / 700;
  if (t < 1) {
    const pr = isPressed(r, now) ? 2 : 0;
    const x = Math.round(r.x - 6 + t * (r.w + 12));
    g.fillStyle(WHITE, 0.35);
    for (let y = 1; y < r.h - 2; y++) {
      const sx = x - Math.round(y * 0.5);
      if (sx >= r.x + 1 && sx + 3 <= r.x + r.w - 1) g.fillRect(sx, r.y + y + pr, 3, 1);
    }
  }
}

/** A round "i" button (it opens a Sheet). */
export function infoButton(g: G, texts: TextPool, r: Rect, now: number): void {
  const pr = isPressed(r, now);
  const y = r.y + (pr ? 1 : 0);
  const cx = r.x + r.w / 2;
  const cy = y + r.h / 2;
  const rad = Math.min(r.w, r.h) / 2;
  fillEllipse(g, cx, cy + 1, rad + 1, rad + 1, INK, 0.5);
  fillEllipse(g, cx, cy, rad + 1, rad + 1, INK, 1);
  fillEllipse(g, cx, cy, rad, rad, 0x3a8ae8, 1);
  fillEllipse(g, cx, cy - 1, rad - 1, rad - 2, 0x5aa8f8, 1);
  g.fillStyle(0xc8e8ff, 1);
  g.fillRect(Math.round(cx - 2), Math.round(y + 1), 3, 1);
  texts.text('i', cx, cy, WHITE, { bold: true, ox: 0.5, oy: 0.5 });
}

/** A screen's focal name: bold at 2x with a 1 px extrusion. */
export function bigName(texts: TextPool, s: string, x: number, y: number, col = WHITE, o: { ox?: number; alpha?: number; ext?: number } = {}): void {
  texts.text(s, x, y, col, { bold: true, scale: 2, ox: o.ox ?? 0, oy: 0.5, extrude: 1, extrudeCol: o.ext ?? NAVY[1], alpha: o.alpha });
}

// ------------------------------------------------------------------ the detail sheet

export interface SheetLine {
  text: string;
  col?: number;
  bold?: boolean;
  /** A small icon in front (camp-kit pix key). */
  icon?: string;
}

/**
 * The detail sheet: details live behind a tap. It slides up over the screen on a glass plate (a title, wrapped body
 * lines), and any tap closes it (a tap inside it too, unless the screen handles it first).
 */
export class Sheet {
  title = '';
  lines: SheetLine[] = [];
  face: Face = [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14];
  private at = -1e9;
  private closeAt = -1e9;
  open = false;
  /** Where it was last drawn. */
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  show(title: string, lines: SheetLine[], now: number, face?: Face): void {
    this.title = title;
    this.lines = lines;
    if (face) this.face = face;
    if (!this.open) this.at = now;
    this.open = true;
  }

  close(now: number): void {
    if (!this.open) return;
    this.open = false;
    this.closeAt = now;
  }

  /** A tap while it's open closes it (returns true: the tap is used up). */
  tap(now: number): boolean {
    if (!this.open) return false;
    this.close(now);
    return true;
  }

  inside(x: number, y: number): boolean {
    return this.open && inRect(this.rect, x, y);
  }

  /** Draw it in `area` (it takes the width, and the height its lines need, sitting at the area's bottom). */
  draw(kit: CampKit, area: Rect, now: number): void {
    const out = !this.open;
    const k = out ? 1 - clamp01((now - this.closeAt) / 160) : easeOut3((now - this.at) / 220);
    if (k <= 0) return;
    const l = kit.layer(true);
    const g = l.g;
    const pad = 6;
    const wrapped: Array<{ l: SheetLine; s: string; first: boolean }> = [];
    for (const ln of this.lines) {
      const iw = ln.icon ? pixSize(ln.icon)[0] + 3 : 0;
      wrapText(ln.text, area.w - pad * 2 - iw).forEach((s, i) => wrapped.push({ l: ln, s, first: i === 0 }));
    }
    const h = 16 + wrapped.length * 9 + 4;
    const r = { x: area.x, y: Math.round(area.y + area.h - h + (1 - k) * 18), w: area.w, h };
    this.rect = r;
    // a dim over the rest
    g.fillStyle(INK, 0.35 * k);
    g.fillRect(-20, -10, 380, 180);
    glass(g, r, { alpha: k, rim: this.face[2], clear: 0.1 });
    // the title on a ribbon tab
    const tw = textWidth(this.title, 1, true) + 12;
    const tr = { x: r.x + 6, y: r.y - 5, w: tw, h: 11 };
    rows(g, tr.x - 1, tr.y - 1, tr.w + 2, tr.h + 2, 2, INK, k);
    button3d(g, tr, this.face);
    l.texts.text(this.title, tr.x + tr.w / 2, tr.y + 5.5, isDark(this.face[1]) ? WHITE : 0x3a1e08, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
    let y = r.y + 12;
    for (const w of wrapped) {
      let x = r.x + pad;
      if (w.l.icon) {
        const [iw, ih] = pixSize(w.l.icon);
        if (w.first) pix(g, w.l.icon, x, Math.round(y + 4 - ih / 2), k);
        x += iw + 3;
      }
      l.texts.text(w.s, x, y + 4, w.l.col ?? 0xe8e0ff, { bold: !!w.l.bold, oy: 0.5, alpha: k });
      y += 9;
    }
  }
}

const isDark = (c: number) => ((c >> 16) & 255) * 0.299 + ((c >> 8) & 255) * 0.587 + (c & 255) * 0.114 < 140;

// ------------------------------------------------------------------ appended: the hero select and the skill tree

/**
 * A screen that paints its own full backdrop (drawStage): the camp's dim, drawn on gUi just before the screen, would
 * sit OVER that backdrop (the image is under gUi). Call first thing in the screen's draw: it moves the dim under the
 * backdrop (onto gFront, over the camp's people), so the stage keeps its colours and still fades in over a dim camp.
 */
export function liftDim(kit: CampKit, k: number): void {
  kit.gUi.clear();
  kit.dim(kit.gFront, 0.62 * clamp01(k));
}

/**
 * A little character map (an emblem) drawn at a whole-number `scale`, centred on (cx, cy), with a crisp 1 px ink
 * outline round it at any scale. '.' (or a space) is empty; `pal` colours the other characters.
 */
export function pixMap(g: G, map: readonly string[], pal: Record<string, number>, cx: number, cy: number, scale = 1, alpha = 1, outline = true): void {
  const h = map.length;
  const w = Math.max(...map.map((r) => r.length));
  const x0 = Math.round(cx - (w * scale) / 2);
  const y0 = Math.round(cy - (h * scale) / 2);
  const on = (x: number, y: number) => {
    const c = map[y]?.[x];
    return c !== undefined && c !== '.' && c !== ' ';
  };
  if (outline) {
    g.fillStyle(INK, alpha);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!on(x, y)) continue;
        const px = x0 + x * scale;
        const py = y0 + y * scale;
        if (!on(x - 1, y)) g.fillRect(px - 1, py, 1, scale);
        if (!on(x + 1, y)) g.fillRect(px + scale, py, 1, scale);
        if (!on(x, y - 1)) g.fillRect(px, py - 1, scale, 1);
        if (!on(x, y + 1)) g.fillRect(px, py + scale, scale, 1);
        if (!on(x - 1, y - 1) && !on(x - 1, y) && !on(x, y - 1)) g.fillRect(px - 1, py - 1, 1, 1);
        if (!on(x + 1, y - 1) && !on(x + 1, y) && !on(x, y - 1)) g.fillRect(px + scale, py - 1, 1, 1);
        if (!on(x - 1, y + 1) && !on(x - 1, y) && !on(x, y + 1)) g.fillRect(px - 1, py + scale, 1, 1);
        if (!on(x + 1, y + 1) && !on(x + 1, y) && !on(x, y + 1)) g.fillRect(px + scale, py + scale, 1, 1);
      }
  }
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; ) {
      const c = row[x];
      let n = 1;
      while (x + n < row.length && row[x + n] === c) n++;
      if (c !== '.' && c !== ' ') {
        g.fillStyle(pal[c] ?? WHITE, alpha);
        g.fillRect(x0 + x * scale, y0 + y * scale, n * scale, scale);
      }
      x += n;
    }
  }
}

/**
 * A big paging arrow (either side of a stage): a tall glass lozenge with a gold chevron that nudges the way it
 * points now and then; it sinks when pressed. `dir` -1 points left, 1 right.
 */
export function pageArrow(g: G, r: Rect, dir: number, now: number, alpha = 1): void {
  const pr = isPressed(r, now);
  const y = r.y + (pr ? 1 : 0);
  const rr = { ...r, y };
  rows(g, rr.x - 1, rr.y + 2, rr.w + 2, rr.h + 1, 3, INK, 0.35 * alpha);
  rows(g, rr.x - 1, rr.y - 1, rr.w + 2, rr.h + 2, 3, INK, 0.85 * alpha);
  rows(g, rr.x, rr.y, rr.w, rr.h, 2, pr ? 0x3a2c64 : 0x1e1636, 0.82 * alpha);
  band(g, rr.x, rr.y, rr.w, rr.h, 2, 0, 1, 0x8a7cc0, 0.9 * alpha);
  band(g, rr.x, rr.y, rr.w, rr.h, 2, rr.h - 1, rr.h, 0x0c0a16, alpha);
  const nudge = Math.round(Math.max(0, Math.sin((now % 1300) / 1300 * Math.PI * 2)) * 1.5) * dir;
  const ch = Math.min(11, rr.h - 6);
  const cx = Math.round(rr.x + rr.w / 2 - (dir > 0 ? 2 : 3) + nudge);
  chevronBig(g, cx, Math.round(rr.y + (rr.h - ch) / 2), ch, dir, alpha);
}

/** A thick (3 px) chevron of height `h` (odd) with its back at x, in gold with an ink rim. */
function chevronBig(g: G, x: number, y: number, h: number, dir: number, alpha: number): void {
  const half = (h - 1) / 2;
  for (let i = 0; i < h; i++) {
    const off = half - Math.abs(i - half);
    const px = dir > 0 ? x + off : x + half - off;
    g.fillStyle(INK, alpha);
    g.fillRect(px - 1, y + i - 1, 5, 3);
  }
  for (let i = 0; i < h; i++) {
    const off = half - Math.abs(i - half);
    const px = dir > 0 ? x + off : x + half - off;
    g.fillStyle(i < half ? GOLD[4] : i === half ? GOLD[3] : GOLD[2], alpha);
    g.fillRect(px, y + i, 3, 1);
  }
}

// ------------------------------------------------------------------ appended: the chests and the shrine (S)

/**
 * A count badge: a round (or pill) token in `face` colours with a bold number, an ink rim and a shine; it bobs
 * gently, and pops when `popAt` (when the count last changed) is recent. Centred on (cx, cy).
 */
export function countBadge(g: G, texts: TextPool, cx: number, cy: number, label: string, now: number, o: { face?: Face; alpha?: number; popAt?: number } = {}): void {
  const a = o.alpha ?? 1;
  const [hi, base, lo, deep] = o.face ?? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]];
  const tw = textWidth(label, 1, true);
  const pk = o.popAt !== undefined ? clamp01((now - o.popAt) / 260) : 1;
  const pop = pk < 1 ? Math.round(Math.sin(pk * Math.PI) * 2) : 0;
  const bob = Math.round(Math.sin(now / 420) * 0.6);
  const h = 11 + pop;
  const w = Math.max(h, tw + 7 + pop);
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2) + bob;
  rows(g, x - 1, y + 1, w + 2, h + 1, 4, INK, 0.45 * a);
  rows(g, x - 1, y - 1, w + 2, h + 2, 4, INK, a);
  rows(g, x, y, w, h, 3, base, a);
  band(g, x, y, w, h, 3, 0, 2, hi, a);
  band(g, x, y, w, h, 3, h - 2, h, lo, a);
  g.fillStyle(deep, a);
  g.fillRect(x + 3, y + h - 1, w - 6, 1);
  g.fillStyle(WHITE, 0.8 * a);
  g.fillRect(x + 2, y + 1, 2, 1);
  const dark = ((base >> 16) & 255) * 0.299 + ((base >> 8) & 255) * 0.587 + (base & 255) * 0.114 > 150;
  texts.text(label, x + w / 2, y + h / 2 + 0.5, dark ? 0x3a1e08 : WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a, plain: dark });
}

// ================================================================== appended: the camp screens' parts (companions,
// the camp's build mode, the region card): round tokens, text cards, wax seals and sockets, a tooltip, sprite boxes.

const BOXES = new Map<string, Rect>();

/** The box of a texture's visible pixels (cached): to centre, crop or seat a sprite on what it actually shows. */
export function opaqueBox(kit: CampKit, key: string): Rect {
  let b = BOXES.get(key);
  if (b) return b;
  const [w, h] = kit.imgs.size(key);
  b = { x: 0, y: 0, w, h };
  const src = kit.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const ctx = typeof src.getContext === 'function' ? src.getContext('2d') : null;
  if (ctx) {
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
    if (x1 >= 0) b = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  BOXES.set(key, b);
  return b;
}

export interface TokenOpts {
  /** The ring's colours [hi, base, lo, deep] (a rarity's face). */
  face: Face;
  /** A sprite shown in the well: an 11 x 11 window of `key` with its top-left at `at` (texture px). */
  sprite?: { key: string; at: [number, number]; tint?: number };
  /** Or an emblem drawn centred in the well. */
  emblem?: (g: G, cx: number, cy: number, alpha: number) => void;
  selected?: boolean;
  /** Greyed out (not met yet): a dark ring. */
  dim?: boolean;
  /** A green check at the top right (equipped, done). */
  check?: boolean;
  /** A padlock over the well. */
  locked?: boolean;
  alpha?: number;
  /** The well's colour (default: deep ink). */
  well?: number;
}

/**
 * A round token, 17 x 17 (the companions' strip, the sockets they go in): a dark well holding an 11 x 11 sprite window
 * (or an emblem), a ring in its colours lit from the top left and outlined in ink, drawn over the window's corners so
 * it reads round. Selected tokens lift 2 px with a gold halo and a gold ring; pressed ones sink. Returns the rect drawn.
 */
export function token(kit: CampKit, l: Layer, r: Rect, o: TokenOpts, now: number): Rect {
  const a = o.alpha ?? 1;
  const pr = isPressed(r, now);
  const rr = { ...r, y: r.y + (pr ? 1 : o.selected ? -2 : 0) };
  const cx = rr.x + rr.w / 2;
  const cy = rr.y + rr.h / 2;
  const R = rr.w / 2;
  const [hi, base, lo, deep] = o.dim ? ([0x6a6078, 0x4a4058, 0x3a3048, 0x2a2438] as const) : o.face;
  const g = l.g;
  const ov = l.over;
  if (o.selected) {
    fillEllipse(g, cx, cy, R + 3, R + 3, 0xffd23a, (0.18 + 0.14 * pulse(now, 1000)) * a);
    fillEllipse(g, cx, cy, R + 2, R + 2, 0xffd23a, (0.2 + 0.12 * pulse(now, 1000)) * a);
  }
  fillEllipse(g, cx, cy + 2, R + 0.5, R + 0.5, INK, 0.45 * a);
  fillEllipse(g, cx, cy, R - 1.5, R - 1.5, o.well ?? mix(deep, INK, 0.6), a);
  fillEllipse(g, cx, cy - 2, R - 3, R - 4, mix(deep, base, 0.35), 0.5 * a);
  if (o.sprite && kit.has(o.sprite.key)) {
    const [sx, sy] = o.sprite.at;
    kit.sprites.draw(o.sprite.key, Math.round(cx - 5.5), Math.round(cy - 5.5), l.icons, { crop: [sx, sy, 11, 11], tint: o.sprite.tint, alpha: a });
  }
  if (o.emblem) o.emblem(ov, cx, cy, o.dim ? 0.5 * a : a);
  // the ring (over the window's corners) and its ink rim, pixel by pixel
  const ring = o.selected ? ([GOLD[4], GOLD[3], GOLD[2], GOLD[1]] as const) : [hi, base, lo, deep];
  for (let y = Math.floor(rr.y - 1); y <= rr.y + rr.h; y++)
    for (let x = Math.floor(rr.x - 1); x <= rr.x + rr.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R + 0.7 || d < R - 2.3) continue;
      let c: number;
      if (d > R - 0.3) c = INK;
      else if (d < R - 1.6) c = INK;
      else {
        const lit = -dx - dy; // top-left is lit
        c = lit > R * 0.6 ? ring[0] : lit < -R * 0.6 ? ring[3] : lit < 0 ? ring[2] : ring[1];
      }
      ov.fillStyle(c, a);
      ov.fillRect(x, y, 1, 1);
    }
  if (o.locked) {
    ov.fillStyle(INK, 0.45 * a);
    ov.fillRect(Math.round(cx - 4), Math.round(cy - 3), 9, 8);
    padlockAt(ov, Math.round(cx - 3), Math.round(cy - 4), a);
  }
  if (o.check) pix(ov, 'check', Math.round(rr.x + rr.w - 6), Math.round(rr.y - 3), a);
  return rr;
}

/** A small gold padlock (6 x 8) with its top-left at (x, y). */
export function padlockAt(g: G, x: number, y: number, a = 1): void {
  g.fillStyle(INK, a);
  g.fillRect(x + 1, y, 4, 1);
  g.fillRect(x, y + 1, 1, 3);
  g.fillRect(x + 5, y + 1, 1, 3);
  g.fillRect(x - 1, y + 3, 8, 6);
  g.fillStyle(0xb8c2d8, a);
  g.fillRect(x + 1, y + 1, 4, 1);
  g.fillStyle(GOLD[3], a);
  g.fillRect(x, y + 4, 6, 4);
  g.fillStyle(GOLD[4], a);
  g.fillRect(x, y + 4, 6, 1);
  g.fillStyle(GOLD[1], a);
  g.fillRect(x + 2, y + 5, 2, 2);
}

export interface TextCardOpts {
  /** An icon (camp-kit pix / HUD icon key) on a round disc at the left, the disc in `iconCol`. */
  icon?: string;
  iconCol?: number;
  title: string;
  titleCol?: number;
  body: string;
  /** Body in the bold face (bigger) or the small one. */
  bold?: boolean;
  bodyCol?: number;
  /** Greyed (a companion not met yet: still readable). */
  dim?: boolean;
  rim?: number;
  alpha?: number;
}

/** Where a text card's body wraps (its lines) for a card `w` wide. */
export function textCardLines(w: number, o: Pick<TextCardOpts, 'icon' | 'body' | 'bold'>): string[] {
  return wrapText(o.body, w - (o.icon ? 20 : 8), !!o.bold);
}

/** A text card's height for its wrapped body. */
export function textCardH(lines: number, bold: boolean, tight = false): number {
  return (tight ? 11 : 12) + lines * (bold ? 10 : 8) + (tight ? 1 : 2);
}

/**
 * A card that is read (a companion's perk, an upgrade): a glass plate, an icon on a coloured disc at the left, the
 * title bold in its colour, the body wrapped under it (bold, or small for long ones). `tight` packs it a little.
 */
export function textCard(_kit: CampKit, l: Layer, r: Rect, o: TextCardOpts, now: number, tight = false): void {
  const a = o.alpha ?? 1;
  const g = l.g;
  const pr = isPressed(r, now);
  const rr = { ...r, y: r.y + (pr ? 1 : 0) };
  glass(g, rr, { alpha: a, rim: o.rim, clear: 0.2 });
  let x = rr.x + 4;
  if (o.icon) {
    const col = o.dim ? 0x4a4058 : (o.iconCol ?? 0x3a5a8a);
    const cx = rr.x + 9;
    const cy = rr.y + 8;
    fillEllipse(g, cx, cy, 7, 7, INK, a);
    fillEllipse(g, cx, cy, 6, 6, col, a);
    fillEllipse(g, cx - 1, cy - 1, 4, 4, mix(col, WHITE, 0.25), 0.6 * a);
    const [iw, ih] = pixSize(o.icon);
    pix(l.over, o.icon, Math.round(cx - iw / 2), Math.round(cy - ih / 2), (o.dim ? 0.6 : 1) * a);
    x = rr.x + 18;
  }
  const ty = rr.y + (tight ? 1 : 2);
  l.texts.text(o.title, x, ty, o.dim ? 0x9a90b8 : (o.titleCol ?? GOLD_TXT), { bold: true, alpha: a });
  const lines = textCardLines(rr.w, o);
  const lh = o.bold ? 10 : 8;
  lines.forEach((s, i) => l.texts.text(s, x, ty + (tight ? 9 : 10) + i * lh, o.dim ? 0x9a90b8 : (o.bodyCol ?? 0xe8e0f8), { bold: !!o.bold, alpha: a }));
}

/** A wax seal stamped with an emblem (the region card: done things): a blob of wax in `col` with a lit rim. */
export function waxSeal(g: G, cx: number, cy: number, rad: number, col: Face, alpha = 1, emblem?: (g: G, cx: number, cy: number, alpha: number) => void): void {
  const [hi, base, lo, deep] = col;
  fillEllipse(g, cx, cy + 1.5, rad + 1, rad, INK, 0.4 * alpha);
  // the wax blob, with a few drips round its edge
  fillEllipse(g, cx, cy, rad + 1, rad + 1, INK, alpha);
  for (const [dx, dy] of [
    [-rad, -2],
    [rad - 1, 2],
    [-2, rad],
  ]) {
    g.fillStyle(INK, alpha);
    g.fillRect(Math.round(cx + dx) - 1, Math.round(cy + dy) - 1, 3, 3);
    g.fillStyle(lo, alpha);
    g.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
  }
  fillEllipse(g, cx, cy, rad, rad, lo, alpha);
  fillEllipse(g, cx - 0.5, cy - 0.5, rad - 0.5, rad - 0.5, base, alpha);
  // the pressed ring and the stamped centre
  fillEllipse(g, cx, cy, rad - 2, rad - 2, deep, alpha);
  fillEllipse(g, cx, cy, rad - 2.5, rad - 2.5, base, alpha);
  g.fillStyle(hi, alpha);
  g.fillRect(Math.round(cx - rad * 0.6), Math.round(cy - rad + 1), Math.max(1, Math.round(rad * 0.6)), 1);
  if (emblem) emblem(g, cx, cy, alpha);
}

/** An empty socket (what's left to do): a dim hollow with a dashed rim that breathes slowly. */
export function socket(g: G, cx: number, cy: number, rad: number, now: number, alpha = 1, col = 0x8a7cc0): void {
  fillEllipse(g, cx, cy, rad + 0.5, rad + 0.5, INK, 0.5 * alpha);
  fillEllipse(g, cx, cy, rad - 0.5, rad - 0.5, 0x000000, 0.25 * alpha);
  const n = Math.max(8, Math.round(rad * 2.4));
  const k = 0.35 + 0.25 * pulse(now, 2400, cx * 37);
  g.fillStyle(col, k * alpha);
  for (let i = 0; i < n; i += 2) {
    const ang = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(ang) * rad - 0.5), Math.round(cy + Math.sin(ang) * rad - 0.5), 1, 1);
  }
}

/**
 * A short label on a small glass plate with a tail down to (x, y) (a tapped seal names itself): it pops in and
 * fades out over `life` ms from `at`. Kept inside [x0, x1].
 */
export function tooltip(l: Layer, text: string, x: number, y: number, now: number, at: number, x0: number, x1: number, life = 1600): void {
  const age = now - at;
  if (age < 0 || age > life) return;
  const k = popK(now, at, 0, 0, 180);
  const a = Math.min(1, (life - age) / 220);
  const w = textWidth(text, 1, true) + 8;
  const h = 12;
  const bx = Math.round(Math.max(x0, Math.min(x1 - w, x - w / 2)));
  const by = Math.round(y - h - 4 - (1 - k) * 3);
  glass(l.g, { x: bx, y: by, w, h }, { alpha: a, rim: GOLD[2], clear: 0.05 });
  l.g.fillStyle(INK, a);
  l.g.fillRect(Math.round(x) - 2, by + h + 1, 5, 1);
  l.g.fillRect(Math.round(x) - 1, by + h + 2, 3, 1);
  l.g.fillRect(Math.round(x), by + h + 3, 1, 1);
  l.texts.text(text, bx + w / 2, by + h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
}
