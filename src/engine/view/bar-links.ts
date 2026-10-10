// The third region's bar rules, drawn over the blocks (view/bar.ts calls drawBarRules after the static blocks):
// a linked pair's chain (links of iron between the two blocks, above the track), and when one of the pair has been
// hit, it glows and the chain burns down toward its partner as the beat runs out (a visible clock: nothing depends on
// sound). A drifting block wears small chevrons pointing the way it slides.
// (Review round 8: the chain was a 1 px dashed line and the chevrons 2 px marks, invisible at phone size: the chain's
// links are now 3x2 with an ink rim, each linked yellow wears a link glyph on its face, the partner of a hit block
// pulses with a 2 px rim, and a drifting block has bold chevrons ahead of it and speed lines trailing it.)
import type Phaser from 'phaser';
import { unlit, type Combat } from '../../core/combat';
import { chevron } from './pixels';
import { INK, kindCol, WHITE } from './shared';

type G = Phaser.GameObjects.Graphics;

const CHAIN = 0xe0d8f0;
const CHAIN_DARK = 0x6a6278;
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
        g.fillStyle(INK, 0.95);
        g.fillRect(px - 1, y - 2 + (up ? 0 : 1), 5, 4);
        g.fillStyle(lit ? LIT : CHAIN, 1);
        g.fillRect(px, y - 1 + (up ? 0 : 1), 3, 2);
      }
      // each of the pair wears a link on its face (a yellow: nothing else is drawn there)
      for (const p of [a, z]) if (p.kind === 'yellow' && !unlit(p)) linkGlyph(g, Math.round(B.x + c.blockPosAt(p, t) * B.w) + bx, B.y + Math.round(B.h / 2) - 2, lit ? LIT_HOT : WHITE);
      if (lit) {
        // the hit one glows (a pulsing rim), its partner, the one to hit now, pulses brighter (2 px), and a spark rides
        // the burning end of the chain
        const k = 0.5 + 0.5 * Math.sin(now / 60);
        for (const p of [a, z]) {
          const hx = Math.round(B.x + c.blockPosAt(p, t) * B.w) + bx;
          const hw = Math.max(6, Math.round(p.width * B.w));
          const partner = p.id !== lit.id;
          g.lineStyle(partner ? 2 : 1, LIT_HOT, partner ? 0.55 + 0.45 * k : 0.4 + 0.3 * k);
          g.strokeRect(hx - Math.round(hw / 2) - (partner ? 2 : 1), B.y - (partner ? 7 : 6), hw + (partner ? 3 : 1), B.h + (partner ? 14 : 12));
        }
        const sx = Math.round(fromLeft ? xa + span * (1 - left) : xa + span * left);
        g.fillStyle(WHITE, 1);
        g.fillRect(sx - 1, y - 1, 3, 3);
        g.fillStyle(LIT_HOT, 0.7 * k);
        g.fillRect(sx - 2, y - 2, 5, 5);
      }
    } else if (b.vel !== 0 && !b.link && (b.kind === 'yellow' || b.kind === 'green')) {
      // drifting: two bold chevrons ahead of it (7 rows, 2 px thick, ink-rimmed) and speed lines trailing it in its
      // own colour
      const x = Math.round(B.x + c.blockPosAt(b, t) * B.w) + bx;
      const half = Math.max(3, Math.round((b.width * B.w) / 2));
      const dir = b.vel > 0 ? 1 : -1;
      const step = Math.floor(now / 160) % 2;
      const cy = B.y + Math.round(B.h / 2) - 3;
      for (let i = 0; i < 2; i++) {
        const cx = x + dir * (half + 3 + i * 4 + step) - (dir > 0 ? 0 : 1);
        chevron(g, dir > 0 ? cx : cx + 1, cy, 7, i ? 0xfff0a0 : WHITE, 1 - i * 0.3, dir, true);
      }
      const [, light] = kindCol(b.kind);
      for (let r = 0; r < 3; r++) {
        const len = 6 - r * 2 + ((Math.floor(now / 120) + r) % 2);
        const tx = x - dir * (half + 2);
        const ly = B.y + 2 + r * 4;
        g.fillStyle(INK, 0.6);
        g.fillRect(dir > 0 ? tx - len - 1 : tx, ly - 1, len + 1, 3);
        g.fillStyle(light, 0.85 - r * 0.15);
        g.fillRect(dir > 0 ? tx - len : tx, ly, len, 1);
      }
    }
  }
}

/** Two interlocked links (9x6, ink-rimmed, the right one a row lower and through the left): a linked pair's mark on
 *  each of its blocks. */
function linkGlyph(g: G, cx: number, y: number, col: number): void {
  g.fillStyle(INK, 0.95);
  g.fillRect(cx - 5, y - 1, 11, 8);
  const ring = (lx: number, ly: number) => {
    g.fillRect(lx + 1, ly, 3, 1);
    g.fillRect(lx + 1, ly + 4, 3, 1);
    g.fillRect(lx, ly + 1, 1, 3);
    g.fillRect(lx + 4, ly + 1, 1, 3);
  };
  g.fillStyle(col, 1);
  ring(cx - 4, y);
  ring(cx - 1, y + 1);
  // the left link passes over the right one at the top: a gap cut in the right ring there
  g.fillStyle(INK, 0.95);
  g.fillRect(cx, y + 1, 1, 1);
}
