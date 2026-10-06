// The third region's bar rules, drawn over the blocks (view/bar.ts calls drawBarRules after the static blocks):
// a linked pair's chain (links of iron between the two blocks, above the track), and when one of the pair has been
// hit, it glows and the chain burns down toward its partner as the beat runs out (a visible clock: nothing depends on
// sound). A drifting block wears small chevrons pointing the way it slides.
import type Phaser from 'phaser';
import type { Combat } from '../../core/combat';
import { INK, WHITE } from './shared';

type G = Phaser.GameObjects.Graphics;

const CHAIN = 0xb8b0c8;
const CHAIN_DARK = 0x4a4258;
const LIT = 0xffd060;
const LIT_HOT = 0xfff2b0;

/** Bar geometry, as view/bar.ts has it (scene.bar). */
export interface BarBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawBarRules(g: G, c: Combat, t: number, now: number, B: BarBox, bx: number): void {
  const seen = new Set<number>();
  const L = c.linkLit;
  for (const b of c.blocks) {
    if (b.link && !seen.has(b.id)) {
      const o = c.blocks.find((x) => x.id === b.link);
      if (!o) continue;
      seen.add(b.id);
      seen.add(o.id);
      const [a, z] = c.blockPosAt(b, t) <= c.blockPosAt(o, t) ? [b, o] : [o, b];
      const xa = Math.round(B.x + (c.blockPosAt(a, t) + a.width / 2) * B.w) + bx;
      const xz = Math.round(B.x + (c.blockPosAt(z, t) - z.width / 2) * B.w) + bx;
      const y = B.y - 9;
      const lit = L && (L.id === a.id || L.id === z.id) ? L : null;
      // how much of the beat is left (1 = all of it): the chain burns from the lit block toward its partner
      const left = lit ? Math.max(0, Math.min(1, (lit.until - c.time) / Math.max(0.05, c.tuning.links.beatSec))) : 1;
      const fromLeft = lit ? lit.id === a.id : true;
      const span = Math.max(0, xz - xa);
      // posts rising from each block to the chain
      for (const px of [xa - 3, xz + 2]) {
        g.fillStyle(CHAIN_DARK, 1);
        g.fillRect(px, y, 1, 5);
      }
      for (let i = 0; i <= span; i += 4) {
        const k = span ? i / span : 0;
        // the burnt part (behind the lit block) is gone; what's left glows when a pair is lit
        const burnt = lit && (fromLeft ? k < 1 - left : k > left);
        if (burnt) continue;
        const px = xa + i;
        const up = (i / 4) % 2 === 0;
        g.fillStyle(INK, 0.9);
        g.fillRect(px - 1, y - 1 + (up ? 0 : 1), 4, 3);
        g.fillStyle(lit ? LIT : CHAIN, 1);
        g.fillRect(px, y + (up ? 0 : 1), 2, 1);
      }
      if (lit) {
        // the hit one glows (a pulsing rim), and a spark rides the burning end of the chain
        const hb = lit.id === a.id ? a : z;
        const hx = Math.round(B.x + c.blockPosAt(hb, t) * B.w) + bx;
        const hw = Math.max(6, Math.round(hb.width * B.w));
        const k = 0.5 + 0.5 * Math.sin(now / 60);
        g.lineStyle(1, LIT_HOT, 0.6 + 0.4 * k);
        g.strokeRect(hx - Math.round(hw / 2) - 1, B.y - 6, hw + 1, B.h + 12);
        const sx = Math.round(fromLeft ? xa + span * (1 - left) : xa + span * left);
        g.fillStyle(WHITE, 1);
        g.fillRect(sx - 1, y - 1, 3, 3);
        g.fillStyle(LIT_HOT, 0.7 * k);
        g.fillRect(sx - 2, y - 2, 5, 5);
      }
    } else if (b.vel !== 0 && !b.link && (b.kind === 'yellow' || b.kind === 'green')) {
      // drifting: two small chevrons on the side it's sliding toward
      const x = Math.round(B.x + c.blockPosAt(b, t) * B.w) + bx;
      const half = Math.max(3, Math.round((b.width * B.w) / 2));
      const dir = b.vel > 0 ? 1 : -1;
      const step = Math.floor(now / 160) % 2;
      for (let i = 0; i < 2; i++) {
        const cx = x + dir * (half + 2 + i * 3 + step);
        g.fillStyle(INK, 0.8);
        g.fillRect(cx - 1, B.y + Math.round(B.h / 2) - 2, 3, 5);
        g.fillStyle(WHITE, 0.9 - i * 0.35);
        g.fillRect(cx, B.y + Math.round(B.h / 2) - 1, 1, 1);
        g.fillRect(cx + dir, B.y + Math.round(B.h / 2), 1, 1);
        g.fillRect(cx, B.y + Math.round(B.h / 2) + 1, 1, 1);
      }
    }
  }
}
