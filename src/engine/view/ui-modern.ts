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
      const on = ang / (Math.PI * 2) <= f;
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
