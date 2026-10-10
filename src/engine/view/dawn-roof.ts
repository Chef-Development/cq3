// Round 7's Solenne and Wren on the fight screen (Part 6), so every part of their kits shows on what it touched:
//   Solenne  a gilded yellow (Gleam, Sunfall) is a gold block on the bar with a sun mark and a glint crossing it
//            (bar.ts calls drawGilded); while Sunrise burns, the cursor is a blade of morning light (a gold column,
//            rays, motes rising) and the reds Radiance slows carry a warm shimmer; the moment it lights, a burst of
//            light on the cursor and on her.
//   Wren     a ready dodge stands at the bar's left end as a mustard slab (BLOCKER_FACE.slip; bar.ts drawReady), the
//            dodge itself puffs smoke off her where she stood; while Smoke Pop hangs, smoke drifts over the bar and
//            the reds in it fade to grey (still there, still blockable).
// view/onsite.ts calls drawDawnRoof every frame and dawnRoofPerk for their perk events. Everything animates from the
// scene clock and fixed seeds (screenshots stay exact).
import type Phaser from 'phaser';
import { isRed, type Combat } from '../../core/combat';
import type { CombatEvent } from '../../core/combat';
import type { FightScene } from '../scene';
import { BLOCKER_FACE, sparkle } from './bar-kinds';
import { INK, mix, pulse, WHITE } from './shared';

type G = Phaser.GameObjects.Graphics;
type PerkEvent = Extract<CombatEvent, { type: 'perk' }>;

/** Solenne's gold: the gilded block's ramp (light, base, shade, deep), and the morning light. */
export const GILD = [0xfffbe0, 0xffd23a, 0xe08a1c, 0x8a3a10] as const;
const DAWN = [0xfff8d0, 0xffe080, 0xffb840, 0xf08a20] as const;
/** Wren's smoke. */
const SMOKE = [0xdcd8e6, 0xaaa6b8, 0x7a7688] as const;

// Wren's ready dodge at the left end (and the slab that pops when it takes a red): mustard
Object.assign(BLOCKER_FACE, { slip: [0xfff08a, 0xd0a024, 0x6a4a10] });

/**
 * A gilded yellow, drawn over the block's own brick (X, Y, W, H as bar.ts placed it): gold through and through with
 * a lit rim, a small white sun in the middle and a glint sweeping across now and then.
 */
export function drawGilded(g: G, X: number, Y: number, W: number, H: number, now: number, id: number): void {
  const [hi, base, lo, deep] = GILD;
  g.fillStyle(deep, 1);
  g.fillRect(X, Y + 1, W, H - 2);
  g.fillRect(X + 1, Y, W - 2, H);
  g.fillStyle(lo, 1);
  g.fillRect(X + 1, Y + 1, W - 2, H - 2);
  g.fillStyle(base, 1);
  g.fillRect(X + 1, Y + 1, W - 3, H - 4);
  g.fillStyle(hi, 1);
  g.fillRect(X + 1, Y + 1, W - 3, 1);
  g.fillRect(X + 1, Y + 1, 1, H - 4);
  // the sun mark: a white heart and four short rays
  const cx = Math.round(X + W / 2);
  const cy = Math.round(Y + H / 2);
  g.fillStyle(lo, 1);
  g.fillRect(cx - 2, cy - 1, 5, 3);
  g.fillRect(cx - 1, cy - 2, 3, 5);
  g.fillStyle(WHITE, 1);
  g.fillRect(cx - 1, cy - 1, 3, 3);
  if (H >= 14) {
    g.fillStyle(hi, 1);
    g.fillRect(cx, cy - 5, 1, 2);
    g.fillRect(cx, cy + 4, 1, 2);
  }
  // a glint crossing it (each block on its own beat)
  const per = 1100;
  const k = ((now + id * 271) % per) / per;
  if (k < 0.35) {
    const gx = Math.round(X - 3 + (W + 6) * (k / 0.35));
    g.fillStyle(WHITE, 0.85);
    for (let j = 1; j < H - 1; j++) {
      const x = gx - Math.round(j / 3);
      if (x > X && x < X + W - 1) g.fillRect(x, Y + j, 1, 1);
    }
  }
  // a twinkle over its top corner
  if (Math.floor((now + id * 97) / 260) % 3 === 0) sparkle(g, X + W - 1, Y - 1, 1, WHITE, 0.9);
}

/** The bar's marks for Solenne and Wren (screen space, over the blocks, under the cursor). */
export function drawDawnRoof(s: FightScene, g: G, c: Combat, now: number): void {
  if (s.app.run.phase !== 'fight') return;
  if (c.heroId === 'solenne' && (c.perk.sunrise ?? 0) > 0) drawSunrise(s, g, c, now);
  if (c.heroId === 'wren' && c.hero.abilityTimer > 0) drawSmokeOver(s, g, c, now);
}

/** Sunrise burning: the cursor a column of morning light (brighter as it starts, flickering as it runs out), rays off
 *  its caps, motes rising; every red Radiance slows shimmers warm along its top. */
function drawSunrise(s: FightScene, g: G, c: Combat, now: number): void {
  const B = s.bar;
  const t = s.app.renderTime(now);
  const left = c.perk.sunrise;
  const fade = left < 0.8 && Math.floor(now / 90) % 2 === 0 ? 0.45 : 1;
  const x = Math.round(B.x + c.cursorPosAt(t) * B.w);
  const p = pulse(now, 360);
  // a column of light round the cursor, in steps: amber outside, pale gold, a white-gold heart
  for (let i = 0; i < 4; i++) {
    g.fillStyle([DAWN[3], DAWN[2], DAWN[1], DAWN[0]][i], [0.3, 0.42, 0.6, 0.85][i] * (0.8 + 0.2 * p) * fade);
    g.fillRect(x - 6 + i * 2 - (i === 3 ? 1 : 0), B.y - 10 + i, 13 - i * 4 + (i === 3 ? 2 : 0), B.h + 20 - i * 2);
  }
  // rays fanning off the top cap
  for (let k = 0; k < 5; k++) {
    const ang = Math.PI * (0.15 + 0.175 * k);
    const len = 4 + ((k + Math.floor(now / 120)) % 3);
    for (let d = 2; d < len + 2; d++) {
      g.fillStyle(d < 4 ? DAWN[0] : DAWN[2], (d < 4 ? 0.9 : 0.6) * fade);
      g.fillRect(Math.round(x - Math.cos(ang) * d), Math.round(B.y - 9 - Math.sin(ang) * d), 1, 1);
    }
  }
  // motes rising off the blade
  for (let m = 0; m < 4; m++) {
    const ph = ((now / 700 + m * 0.27) % 1 + 1) % 1;
    g.fillStyle(m % 2 ? DAWN[0] : DAWN[1], (1 - ph) * fade);
    g.fillRect(x - 3 + ((m * 5) % 7), Math.round(B.y + B.h - ph * (B.h + 16)), 1, 1);
  }
  // Radiance: the slowed reds shimmer warm along their top edge
  for (const b of c.blocks) {
    if (!isRed(b.kind) || !(b.chill > 0) || b.chillMult <= 0 || b.chillMult >= 1) continue;
    const pos = c.blockPosAt(b, t);
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const bx = Math.round(B.x + pos * B.w - w / 2);
    const sh = Math.floor((now / 80 + b.id) % w);
    g.fillStyle(DAWN[1], 0.75 * fade);
    g.fillRect(bx, B.y - 6, w, 1);
    g.fillStyle(WHITE, 0.9 * fade);
    g.fillRect(bx + sh, B.y - 6, 2, 1);
  }
}

/** Smoke Pop hanging over the bar: soft clouds drifting along it, and every red under it veiled grey (it's still there
 *  and still blocked like any red: only its colour fades). */
function drawSmokeOver(s: FightScene, g: G, c: Combat, now: number): void {
  const B = s.bar;
  const t = s.app.renderTime(now);
  const left = c.hero.abilityTimer;
  const a = Math.min(1, left / 0.6);
  for (let i = 0; i < 9; i++) {
    const ph = (now / 2600 + i / 9) % 1;
    const x = Math.round(B.x + ((i * 0.117 + ph * 0.3) % 1) * B.w);
    const y = Math.round(B.y + B.h / 2 - 4 + ((i * 5) % 9));
    const r = 4 + (i % 3);
    // a cloud of stepped rows drifting along the track (no smoothing: pixels)
    g.fillStyle(SMOKE[i % 2 ? 1 : 2], 0.5 * a);
    g.fillRect(x - r, y - 1, r * 2 + 1, 4);
    g.fillRect(x - r + 1, y - 2, r * 2 - 1, 6);
    g.fillRect(x - r + 3, y - 3, r * 2 - 5, 8);
    g.fillStyle(SMOKE[0], 0.45 * a);
    g.fillRect(x - r + 2, y - 2, r * 2 - 4, 2);
  }
  for (const b of c.blocks) {
    if (!isRed(b.kind)) continue;
    const pos = c.blockPosAt(b, t);
    const w = Math.max(6, Math.round(b.width * B.w) - 1);
    const bx = Math.round(B.x + pos * B.w - w / 2);
    g.fillStyle(mix(SMOKE[1], INK, 0.2), 0.42 * a);
    g.fillRect(bx, B.y - 5, w, B.h + 10);
    g.fillStyle(SMOKE[0], 0.5 * a);
    for (let j = 0; j < 3; j++) g.fillRect(bx + ((j * 3 + Math.floor(now / 160)) % Math.max(1, w - 1)), B.y - 7 + j, 2, 1);
  }
}

/** The moments with a show of their own: Sunrise lighting, a dodge, the smoke popping. */
export function dawnRoofPerk(s: FightScene, e: PerkEvent, c: Combat): void {
  const fx = s.fx;
  const h = s.fighters.h;
  const B = s.bar;
  switch (e.id) {
    case 'sunrise': {
      // a burst of light off the cursor and round her, a ring of dawn
      const x = Math.round(B.x + c.cursorPos() * B.w);
      fx.chips(x, B.y - 4, 10, [WHITE, DAWN[0], DAWN[1], DAWN[2]], 10, -1);
      fx.ring(h.x + 2, s.ground - 18, 18, DAWN[1], true);
      fx.glow(h.x + 2, s.ground - 18, 22, DAWN[2], 420, s.ground);
      fx.burst(h.x + 2, s.ground - 24, DAWN[1], 10, true, 1, true);
      break;
    }
    case 'slip':
    case 'roofHop': {
      // she was there a moment ago: smoke where she stood, a streak where she went
      if (e.id === 'slip') {
        for (let i = 0; i < 5; i++) fx.puffs.push({ x: h.x - 6 + i * 3, y: s.ground - 8 - ((i * 7) % 14), r: 3 + (i % 3), at: s.anim + i * 25, life: 520, color: i % 2 ? SMOKE[1] : SMOKE[0] });
        fx.bolt(h.x - 14, s.ground - 20, h.x + 4, s.ground - 26, 140, 0xfff08a);
      } else fx.ring(h.x + 2, s.ground - 16, 14, 0xfff08a, true);
      break;
    }
    case 'smokePop': {
      // the smoke ball bursts over the bar
      const x = e.pos !== undefined ? Math.round(B.x + e.pos * B.w) : Math.round(B.x + c.cursorPos() * B.w);
      fx.chips(x, B.y - 6, 14, [SMOKE[0], SMOKE[1], SMOKE[2]], 10, -1);
      break;
    }
  }
}
