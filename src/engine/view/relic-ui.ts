// Relic and perk UI shared by the fight-side screens (the boost pick, the shop, the HUD's relic belt, the relic
// panel, the act clear and the unlock card): relic icons (their art, or a tile in the main tag's colours until the
// art is in), tag icons and chips, the card frame and the relic card, and the names of perks (relics, skill nodes,
// a hero's kit) as fights announce them.
import type Phaser from 'phaser';
import { HEROES } from '../../data/heroes';
import { relicById, TAG_NAME, type RelicId, type RelicRarity, type RelicTag } from '../../data/relics';
import { skillById } from '../../data/skills';
import { relicText, sharedTags } from '../../core/relics';
import type { Tuning } from '../../core/tuning';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { wrapText } from './items';
import { band, glow, rows } from './pixels';
import { INK, mix, pulse, WHITE, type Rect } from './shared';
import { tag, type ImagePool, type TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
export type Face = readonly [number, number, number, number];

export const RELIC_ICON = 12;
export const TAG_ICON = 7;

/** Each tag's colours [hi, base, lo, deep]: its chip, the fallback icon tile, its perk names. */
export const TAG_FACE: Record<RelicTag, Face> = {
  bomb: [0xffb090, 0xe0582a, 0xa83418, 0x5a160a],
  crit: [0xffe090, 0xff9a3a, 0xc8601a, 0x7a3010],
  block: [0xd8e8ff, 0x8aa4d0, 0x50648e, 0x262f4a],
  combo: [0xffc0e8, 0xf05ab0, 0xb02a7a, 0x5e1044],
  finisher: [0xa8e4ff, 0x3a8ae8, 0x2a5ac0, 0x16285e],
  green: [0xc0f590, 0x4ccf4a, 0x2a9a3a, 0x14622a],
  pip: [0xb0f0e4, 0x3ab8a8, 0x1a7a78, 0x0e3a40],
  sustain: [0xffb8c8, 0xf05a78, 0xb02a48, 0x5e1028],
  coins: [0xfff0a0, 0xf2c230, 0xc8861a, 0x7a4a10],
  risk: [0xe4b8ff, 0x9a52d8, 0x6a2aa8, 0x34124e],
  ice: [0xe0faff, 0x8ae0f6, 0x4aa4d0, 0x1e5a80],
  hold: [0xd0e4ff, 0x6a9af0, 0x3a62c0, 0x1a2e6a],
};

/** The rarity look of a card: face [hi, base, lo, deep] and its tag (common has none). */
export const RARITY_FACE: Record<RelicRarity, { face: Face; tag: string }> = {
  common: { face: [0x8af06a, 0x5ad848, 0x3aaa34, 0x247a26], tag: '' },
  rare: { face: [0x8ac8ff, 0x3a8ae8, 0x2a62c8, 0x1a3c8a], tag: 'RARE' },
  epic: { face: [0xf0b8ff, 0xb05ae0, 0x8a3ac0, 0x5a1a8a], tag: 'EPIC' },
};

/** 5x5 marks for the tag icons and the fallback relic tiles (until the painted icons are in). */
const TAG_GLYPH: Record<RelicTag, string[]> = {
  bomb: ['...#.', '.##..', '####.', '####.', '.##..'],
  crit: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  block: ['#####', '#####', '#####', '.###.', '..#..'],
  combo: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  finisher: ['...##', '..##.', '.####', '.##..', '##...'],
  green: ['..###', '.####', '#####', '####.', '#....'],
  pip: ['#...#', '##.##', '#####', '#.#.#', '.###.'],
  sustain: ['##.##', '#####', '#####', '.###.', '..#..'],
  coins: ['.###.', '##.##', '##.##', '##.##', '.###.'],
  risk: ['.###.', '#####', '#.#.#', '#####', '.#.#.'],
  ice: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
  hold: ['#...#', '#####', '#...#', '#####', '#...#'],
};

const at = (rows5: string[], x: number, y: number) => rows5[y]?.[x] === '#';

/** A relic's main tag (its colours). */
export const mainTag = (id: RelicId): RelicTag => relicById(id)?.tags[0] ?? 'combo';

/**
 * A relic's 12x12 icon with its top-left at (x, y): the painted `relic_<id>`, or (until the art is in) a rounded tile
 * in its main tag's colours with the tag's mark. `scale` 2 for the big cards.
 */
export function relicIcon(s: FightScene, pool: ImagePool, g: G, id: RelicId, x: number, y: number, depth: number, alpha = 1, scale = 1): void {
  const key = `relic_${id}`;
  x = Math.round(x);
  y = Math.round(y);
  if (s.textures.exists(key)) {
    pool.scaled(key, x, y, depth, scale, alpha);
    return;
  }
  const [hi, base, lo, deep] = TAG_FACE[mainTag(id)];
  const k = scale;
  const S = RELIC_ICON * k;
  rows(g, x, y, S, S, 2 * k, INK, alpha);
  rows(g, x + k, y + k, S - 2 * k, S - 2 * k, k, lo, alpha);
  band(g, x + k, y + k, S - 2 * k, S - 2 * k, k, 0, Math.round((S - 2 * k) * 0.55), base, alpha);
  band(g, x + k, y + k, S - 2 * k, S - 2 * k, k, 0, k, hi, alpha);
  band(g, x + k, y + k, S - 2 * k, S - 2 * k, k, S - 3 * k, S - 2 * k, deep, alpha);
  const gl = TAG_GLYPH[mainTag(id)];
  const gx = x + 4 * k;
  const gy = y + 4 * k;
  for (let yy = 0; yy < 5; yy++)
    for (let xx = 0; xx < 5; xx++) {
      if (!at(gl, xx, yy)) continue;
      g.fillStyle(deep, alpha);
      g.fillRect(gx + xx * k, gy + (yy + 1) * k, k, k);
    }
  for (let yy = 0; yy < 5; yy++)
    for (let xx = 0; xx < 5; xx++) {
      if (!at(gl, xx, yy)) continue;
      g.fillStyle(yy === 0 || !at(gl, xx, yy - 1) ? WHITE : mix(hi, WHITE, 0.5), alpha);
      g.fillRect(gx + xx * k, gy + yy * k, k, k);
    }
}

/** A tag's 7x7 icon with its top-left at (x, y): the painted `tag_<tag>`, or its mark with an ink outline. */
export function tagIcon(s: FightScene, pool: ImagePool, g: G, t: RelicTag, x: number, y: number, depth: number, alpha = 1): void {
  const key = `tag_${t}`;
  x = Math.round(x);
  y = Math.round(y);
  if (s.textures.exists(key)) {
    pool.at(key, x, y, depth, alpha);
    return;
  }
  const gl = TAG_GLYPH[t];
  const [hi, base] = TAG_FACE[t];
  g.fillStyle(INK, alpha);
  for (let yy = -1; yy <= 5; yy++)
    for (let xx = -1; xx <= 5; xx++) {
      if (at(gl, xx, yy)) continue;
      if (at(gl, xx - 1, yy) || at(gl, xx + 1, yy) || at(gl, xx, yy - 1) || at(gl, xx, yy + 1)) g.fillRect(x + 1 + xx, y + 1 + yy, 1, 1);
    }
  for (let yy = 0; yy < 5; yy++)
    for (let xx = 0; xx < 5; xx++) {
      if (!at(gl, xx, yy)) continue;
      g.fillStyle(yy === 0 || !at(gl, xx, yy - 1) ? hi : base, alpha);
      g.fillRect(x + 1 + xx, y + 1 + yy, 1, 1);
    }
}

/** Width of a tag chip (icon and, with `name`, the tag's name). */
export const chipWidth = (t: RelicTag, name = true): number => (name ? 7 + 2 + textWidth(TAG_NAME[t]) + 2 : 9);
export const CHIP_H = 9;

/**
 * A tag chip with its top-left at (x, y): a rounded tag in the tag's deep colour, its icon, and its name. `hot`: a
 * shared tag (Synergy!) gets a gold rim and a glow. Returns the width.
 */
export function tagChip(s: FightScene, g: G, texts: TextPool, pool: ImagePool, t: RelicTag, x: number, y: number, depth: number, o: { name?: boolean; hot?: boolean; alpha?: number; now?: number } = {}): number {
  const a = o.alpha ?? 1;
  const name = o.name !== false;
  const w = chipWidth(t, name);
  const [hi, base, lo, deep] = TAG_FACE[t];
  const r: Rect = { x: Math.round(x), y: Math.round(y), w, h: CHIP_H };
  if (o.hot) glow(g, r, 0xffd23a, (0.45 + 0.35 * pulse(o.now ?? 0, 700)) * a, 2);
  tag(g, r, o.hot ? [0xfff0a0, mix(deep, base, 0.35), deep, INK] : [mix(lo, deep, 0.3), mix(deep, INK, 0.15), deep, INK], a);
  if (o.hot) {
    g.fillStyle(0xffd23a, a);
    g.fillRect(r.x + 1, r.y - 1, r.w - 2, 1);
    g.fillRect(r.x + 1, r.y + r.h, r.w - 2, 1);
  }
  tagIcon(s, pool, g, t, r.x + 1, r.y + 1, depth, a);
  if (name) texts.text(TAG_NAME[t], r.x + 9, r.y + 4.5, o.hot ? 0xfff0a0 : mix(hi, WHITE, 0.4), { oy: 0.5, alpha: a });
  return w;
}

/**
 * A card's frame: ink outline, a rim in the rarity's colour, a navy body lit on top, and (rare and epic) a soft glow
 * that breathes. `flash` whitens the whole card (a reroll, the pick).
 */
export function cardFrame(g: G, r: Rect, face: Face, rarity: RelicRarity, now: number, alpha = 1): void {
  const [hi, base, , deep] = face;
  if (rarity !== 'common') glow(g, r, base, (0.45 + 0.3 * pulse(now, 900)) * alpha, 3);
  rows(g, r.x - 1, r.y + 3, r.w + 2, r.h, 3, INK, 0.45 * alpha);
  rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 4, INK, alpha);
  rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, base, alpha);
  band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, 0, 1, hi, alpha);
  band(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, r.h + 1, r.h + 2, deep, alpha);
  rows(g, r.x, r.y, r.w, r.h, 2, 0x241d3e, alpha);
  band(g, r.x, r.y, r.w, r.h, 2, 0, Math.round(r.h * 0.45), 0x2f2650, alpha);
  band(g, r.x, r.y, r.w, r.h, 2, r.h - 4, r.h, 0x1b1530, alpha);
  band(g, r.x, r.y, r.w, r.h, 2, 0, 1, mix(0x5e5090, base, 0.35), alpha);
}

/** The icon tile at a card's left end, in the rarity's colours. */
export function cardTile(g: G, tile: Rect, face: Face, alpha = 1): void {
  const [hi, base, lo, deep] = face;
  rows(g, tile.x, tile.y, tile.w, tile.h, 2, lo, alpha);
  band(g, tile.x, tile.y, tile.w, tile.h, 2, 0, Math.round(tile.h * 0.5), base, alpha);
  band(g, tile.x, tile.y, tile.w, tile.h, 2, 0, 1, hi, alpha);
  band(g, tile.x, tile.y, tile.w, tile.h, 2, tile.h - 1, tile.h, deep, alpha);
  g.fillStyle(INK, 0.6 * alpha);
  g.fillRect(tile.x + tile.w, tile.y + 1, 1, tile.h - 2);
}

/** Rare and epic cards: a slanted shimmer crossing the face, and (epic) twinkles around the rim. */
export function cardShine(g: G, r: Rect, rarity: RelicRarity, now: number, alpha = 1): void {
  if (rarity === 'common') return;
  const cyc = ((now + r.y * 37) % 1700) / 1700;
  if (cyc < 0.4) {
    const sx = r.x + (r.w + 20) * (cyc / 0.4) - 14;
    g.fillStyle(WHITE, (rarity === 'epic' ? 0.3 : 0.2) * alpha);
    for (let y = 1; y < r.h - 1; y++) {
      const x = Math.round(sx + (r.h - y) * 0.5);
      const x0 = Math.max(r.x + 1, x);
      const x1 = Math.min(r.x + r.w - 1, x + 5);
      if (x1 > x0) g.fillRect(x0, r.y + y, x1 - x0, 1);
    }
  }
  if (rarity === 'epic')
    for (let i = 0; i < 4; i++) {
      const q = (((now / 700 + i * 0.37) % 1) + 1) % 1;
      const px = Math.round(r.x + 4 + ((i * 53 + Math.floor(now / 700) * 17) % (r.w - 8)));
      const py = i % 2 ? r.y - 2 : r.y + r.h + 1;
      const arm = q < 0.5 ? 1 : 0;
      g.fillStyle(q < 0.5 ? WHITE : 0xffe680, (1 - q) * alpha);
      g.fillRect(px - arm, py, arm * 2 + 1, 1);
      g.fillRect(px, py - arm, 1, arm * 2 + 1);
    }
}

/** The "Synergy!" badge: a small gold ribbon tag. Returns its rect. */
export function synergyBadge(g: G, texts: TextPool, x: number, y: number, now: number, alpha = 1): Rect {
  const label = 'Synergy!';
  const w = textWidth(label, 1, false) + 8;
  const r: Rect = { x: Math.round(x), y: Math.round(y), w, h: 9 };
  glow(g, r, 0xffd23a, (0.5 + 0.4 * pulse(now, 600)) * alpha, 2);
  tag(g, r, [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14], alpha);
  texts.text(label, r.x + 4, r.y + 4.5, 0x3a1e08, { oy: 0.5, alpha });
  // a twinkle on its corner
  const q = (now % 900) / 900;
  if (q < 0.5) {
    const arm = q < 0.25 ? 2 : 1;
    g.fillStyle(WHITE, alpha * (1 - q * 2));
    g.fillRect(r.x + r.w - 1 - arm, r.y - 1, arm * 2 + 1, 1);
    g.fillRect(r.x + r.w - 1, r.y - 1 - arm, 1, arm * 2 + 1);
  }
  return r;
}

export interface CardCtx {
  s: FightScene;
  g: G;
  texts: TextPool;
  pool: ImagePool;
  depth: number; // the icons' depth (over g, under the texts)
}

/** How a relic card's text wraps in a card of width w (two lines fit every relic at 170 px and up). */
export const relicLines = (t: Tuning, id: RelicId, w: number): string[] => wrapText(relicText(t, id), w - 33);

/**
 * A relic card (the boost pick, the shop's detail card): the frame in the rarity's colours, the icon on a tile, the
 * name, its tag chips (a shared tag lit gold), the rarity tag, a "Synergy!" badge on the top edge when it shares a
 * tag with a relic you own, and its text in two lines. Best at 30-32 px tall and 220+ wide; `chips` collects where
 * its tag chips went (the pick draws a line from a shared one to the relic it matches).
 */
export function relicCard(
  c: CardCtx,
  r: Rect,
  id: RelicId,
  o: { owned: readonly RelicId[]; tuning: Tuning; now: number; flash?: number; alpha?: number; chips?: Array<{ tag: RelicTag; r: Rect; hot: boolean }> },
): void {
  const def = relicById(id);
  if (!def) return;
  const { s, g, texts, pool } = c;
  const a = o.alpha ?? 1;
  const look = RARITY_FACE[def.rarity];
  const face = look.face;
  cardFrame(g, r, face, def.rarity, o.now, a);
  const tile: Rect = { x: r.x + 2, y: r.y + 2, w: 22, h: r.h - 4 };
  cardTile(g, tile, face, a);
  relicIcon(s, pool, g, id, tile.x + 5, tile.y + Math.round((tile.h - RELIC_ICON) / 2), c.depth, a);
  // row 1: the name, the tag chips, the rarity
  const nx = r.x + 28;
  texts.text(def.name, nx, r.y + 2, WHITE, { bold: true, alpha: a });
  let right = r.x + r.w - 3;
  if (look.tag) {
    const tw = textWidth(look.tag, 1, false) + 6;
    const tr: Rect = { x: right - tw, y: r.y + 3, w: tw, h: 9 };
    tag(g, tr, face, a);
    texts.text(look.tag, tr.x + 3, tr.y + 4.5, WHITE, { oy: 0.5, alpha: a });
    right = tr.x - 3;
  }
  const shared = sharedTags(id, o.owned);
  let cx = nx + textWidth(def.name, 1, true) + 4;
  const named = cx + def.tags.reduce((sum, t) => sum + chipWidth(t) + 3, 0) <= right;
  for (const t of def.tags) {
    if (cx + chipWidth(t, named) > right) break;
    const w = tagChip(s, g, texts, pool, t, cx, r.y + 3, c.depth, { name: named, hot: shared.includes(t), alpha: a, now: o.now });
    o.chips?.push({ tag: t, r: { x: cx, y: r.y + 3, w, h: CHIP_H }, hot: shared.includes(t) });
    cx += w + 3;
  }
  // rows 2-3: what it does (a little tighter on a 30 px card)
  const [ty, lh] = r.h >= 32 ? [14, 9] : [13, 8];
  relicLines(o.tuning, id, r.w).slice(0, 2).forEach((line, i) => texts.text(line, nx, r.y + ty + i * lh, 0xe8e2ff, { alpha: a }));
  cardShine(g, r, def.rarity, o.now, a);
  // "Synergy!" sits on the top edge, at the right end
  if (shared.length) synergyBadge(g, texts, r.x + r.w - textWidth('Synergy!', 1, false) - 9, r.y - 7, o.now, a);
  if (o.flash && o.flash > 0) {
    g.fillStyle(WHITE, o.flash * a);
    g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
  }
}

// ------------------------------------------------------------------ perks

/** The kit parts' ids (core/kit-fx.ts) and their names. */
const KIT_NAME: Record<string, string> = {
  battleFocus: HEROES.rowan.ability.name,
  whirlwind: HEROES.rowan.finisher.name,
  shadowStep: HEROES.sable.ability.name,
  ambidextrous: HEROES.sable.passive?.name ?? 'Ambidextrous',
  twinFang: HEROES.sable.finisher.name,
};

export type PerkSource = 'relic' | 'skill' | 'kit';

export function perkSource(id: string): PerkSource {
  if (relicById(id)) return 'relic';
  if (skillById(id)) return 'skill';
  return 'kit';
}

/** A perk's name: the relic's, the skill node's, or the kit part's ("shadowStep" -> "Shadow Step" at worst). */
export function perkName(id: string): string {
  return relicById(id)?.name ?? skillById(id)?.name ?? KIT_NAME[id] ?? id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/** The colour a perk's name shows in: a relic in its main tag's light colour, a skill node blue, a kit part violet. */
export function perkColor(id: string): number {
  const r = relicById(id);
  if (r) return mix(TAG_FACE[r.tags[0]][0], 0xffe680, 0.35);
  return skillById(id) ? 0x9ad8ff : 0xd8b0ff;
}
