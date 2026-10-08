// What a fight, an act clear or a region just gave beyond the loot (run.gains: gems, hero chests, achievements,
// mastery unlocks, a region at 100%), shown briefly: on the loot screen once every item has landed (one-line pills on
// the band under "Tap to continue", a row at a time), on the act-clear screen once the chest has burst (a column on
// the left) and on the victory (rows near the bottom). Each pill pops in after the one before with a sparkle and a
// chime, stays a few seconds and fades. Nothing to tap: it never holds the screen up. Taking them empties run.gains
// (the camp shows any left over as a toast).
import { signed } from '../../core/format';
import type Phaser from 'phaser';
import { HEROES } from '../../data/heroes';
import type { AchievementDef, MasteryDef } from '../../data/meta';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { rows } from './pixels';
import { pix, pixSize } from './camp-kit';
import { star } from './loot';
import { clamp01, easeBack, INK, mix, pulse, WHITE } from './shared';
import { TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

export interface GainLine {
  icon: string;
  sub?: string; // a small line over the text ("Achievement!")
  text: string;
  col: number;
}

export interface Gains {
  gems: number;
  chests: number;
  achievements: AchievementDef[];
  mastery: MasteryDef[];
  region: boolean;
}

export const hasGains = (g: Gains): boolean => g.gems > 0 || g.chests > 0 || g.achievements.length > 0 || g.mastery.length > 0 || g.region;

/** The gains as lines (and empties them). */
export function takeGains(g: Gains): GainLine[] {
  const out: GainLine[] = [];
  if (g.region) out.push({ icon: 'badge_region', sub: 'Region complete!', text: '100%! Region chest', col: 0xdab0ff });
  if (g.chests > 0) out.push({ icon: 'chest', text: g.chests > 1 ? `${g.chests} hero chests!` : 'Hero chest!', col: 0xffe680 });
  if (g.gems > 0) out.push({ icon: 'gem', text: `${signed(g.gems)} gems`, col: 0xf6c8ff });
  for (const a of g.achievements) out.push({ icon: 'skills', sub: 'Achievement!', text: a.name, col: 0xfff0a0 });
  for (const m of g.mastery) out.push({ icon: 'up', sub: `${HEROES[m.hero].name}: mastery!`, text: m.rewardText, col: 0xb4f070 });
  g.gems = 0;
  g.chests = 0;
  g.achievements = [];
  g.mastery = [];
  g.region = false;
  return out;
}

const STEP = 160; // ms between pills
const STAY = 3600; // ms a pill stays (plus a little per extra pill)
const PAGE = 2000; // ms each row of pills stays on the loot screen's band

type Where = 'row' | 'column' | 'band';

interface Pill {
  w: number;
  h: number;
  text: string[];
  sub: string;
}

export class GainsView {
  private g!: G;
  private texts: TextPool;
  private lines: GainLine[] = [];
  private at = 0;
  private chimed = new Set<number>();
  private where: Where = 'row';

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 32.06);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(32.0);
  }

  /** A new screen: the old screen's pills go with it. */
  onPhase(): void {
    this.lines = [];
  }

  /** Whether the screen on view is ready for the pills (and where they go). */
  private ready(): Where | null {
    const s = this.s;
    const app = s.app;
    if (app.storyOverlay || app.tipUp) return null;
    const ph = app.run.phase;
    if (ph === 'loot') return s.loot.revealDone() ? 'band' : null;
    if (ph === 'actClear') return s.overlays.clearOpened() ? 'column' : null;
    if (ph === 'victory') return performance.now() - app.phaseSince > 1800 ? 'row' : null;
    return null;
  }

  draw(now: number): void {
    const g = this.g;
    g.clear();
    this.texts.begin();
    const run = this.s.app.run;
    const where = this.ready();
    if (where && !this.lines.length && hasGains(run.gains)) {
      this.lines = takeGains(run.gains);
      this.at = now;
      this.chimed.clear();
      this.where = where;
    }
    if (this.lines.length) this.drawLines(g, now);
    this.texts.end();
  }

  /** A pill's size and text: an icon, an optional small line over the text, the text (wrapped to `maxW`); `one`
   *  squeezes it into one line (the small line goes in front when there's room). */
  private size(l: GainLine, maxW: number, one: boolean): Pill {
    const [iw] = pixSize(l.icon);
    const room = maxW - iw - 10;
    if (one) {
      const both = l.sub ? `${l.sub} ${l.text}` : l.text;
      const t = textWidth(both, 1, true) <= room ? both : l.text;
      return { w: iw + 10 + Math.min(room, textWidth(t, 1, true)), h: 12, text: [t], sub: '' };
    }
    const text = textWidth(l.text, 1, true) <= room ? [l.text] : wrapBold(l.text, room);
    const tw = Math.max(...text.map((t) => textWidth(t, 1, true)), l.sub ? textWidth(l.sub, 1, false) : 0);
    return { w: iw + 10 + tw, h: 6 + text.length * 8 + (l.sub ? 8 : 0), text, sub: l.sub ?? '' };
  }

  /** Rows of pills that fit across the screen (a column: one row). */
  private rowsOf(sizes: Pill[], span: number, column: boolean): number[][] {
    const out: number[][] = [[]];
    let w = 0;
    sizes.forEach((z, i) => {
      if (!column && w + z.w > span && out[out.length - 1].length) {
        out.push([]);
        w = 0;
      }
      out[out.length - 1].push(i);
      w += z.w + 4;
    });
    return out;
  }

  /** Where each pill sits, and when it comes and goes (ms after the pills started). */
  private place(sizes: Pill[], rs: number[][]): Array<{ x: number; y: number; at: number; until: number }> {
    const s = this.s;
    const pos: Array<{ x: number; y: number; at: number; until: number }> = [];
    const rowW = (idx: number[]) => idx.reduce((a, i) => a + sizes[i].w, 0) + (idx.length - 1) * 4;
    if (this.where === 'column') {
      // down the left under the top bar
      let y = 20;
      sizes.forEach((z, i) => {
        pos[i] = { x: s.L + 4, y, at: i * STEP, until: 1e9 };
        y += z.h + 3;
      });
    } else if (this.where === 'band') {
      // on the band under "Tap to continue", a row at a time
      const y = Math.min(s.splitY + 28, s.B - 14);
      rs.forEach((idx, ri) => {
        let x = Math.round((s.L + s.R) / 2 - rowW(idx) / 2);
        idx.forEach((i, j) => {
          pos[i] = { x, y, at: ri * PAGE + j * STEP, until: ri === rs.length - 1 ? 1e9 : (ri + 1) * PAGE };
          x += sizes[i].w + 4;
        });
      });
    } else {
      // centred rows near the bottom
      let bottom = s.B - 6;
      for (let ri = rs.length - 1; ri >= 0; ri--) {
        const idx = rs[ri];
        const h = Math.max(...idx.map((i) => sizes[i].h));
        let x = Math.round((s.L + s.R) / 2 - rowW(idx) / 2);
        for (const i of idx) {
          pos[i] = { x, y: bottom - h, at: i * STEP, until: 1e9 };
          x += sizes[i].w + 4;
        }
        bottom -= h + 3;
      }
    }
    return pos;
  }

  private drawLines(g: G, now: number): void {
    const s = this.s;
    const audio = s.app.audio;
    const where = this.where;
    const age = now - this.at;
    const span = s.R - s.L - 12;
    const maxW = where === 'column' ? 80 : Math.min(where === 'band' ? 170 : 150, span);
    const sizes = this.lines.map((l) => this.size(l, maxW, where === 'band'));
    const rs = this.rowsOf(sizes, span, where === 'column');
    const life = where === 'band' ? rs.length * PAGE : STAY + this.lines.length * 400;
    if (age > life + 400) {
      this.lines = [];
      return;
    }
    const fade = age > life ? 1 - (age - life) / 400 : 1;
    const pos = this.place(sizes, rs);
    this.lines.forEach((l, i) => {
      const p = pos[i];
      const k = (age - p.at) / 220;
      if (k <= 0) return;
      const gone = age > p.until ? 1 - (age - p.until) / 200 : 1;
      if (gone <= 0) return;
      if (!this.chimed.has(i)) {
        this.chimed.add(i);
        if (l.icon === 'gem') audio.coin();
        else if (l.icon === 'chest' || l.icon === 'badge_region') audio.rareSting(true);
        else audio.statUp(Math.min(2, i));
      }
      const z = sizes[i];
      const pop = easeBack(k, 2);
      const a = clamp01(k * 2) * fade * gone;
      const x = Math.round(where === 'column' ? p.x - (1 - Math.min(1, pop)) * 10 : p.x);
      const y = Math.round(where === 'column' ? p.y : p.y + (1 - Math.min(1, pop)) * 6);
      // a dark glass plate with the line's colour along its top; a white flash as it lands
      rows(g, x - 1, y + 1, z.w + 2, z.h + 2, 2, 0x000000, 0.35 * a);
      rows(g, x - 1, y - 1, z.w + 2, z.h + 2, 2, INK, a);
      rows(g, x, y, z.w, z.h, 2, 0x161226, 0.95 * a);
      g.fillStyle(mix(l.col, 0x161226, 0.35), a);
      g.fillRect(x + 2, y, z.w - 4, 1);
      if (k > 0.4 && k < 1.4) {
        g.fillStyle(WHITE, 0.45 * (1.4 - k) * fade);
        g.fillRect(x, y, z.w, z.h);
      }
      const [iw, ih] = pixSize(l.icon);
      pix(g, l.icon, x + 4, Math.round(y + z.h / 2 - ih / 2), a);
      const tx = x + iw + 7;
      let ty = z.h === 12 ? y + 6 : y + 7;
      if (z.sub) {
        this.texts.text(z.sub, tx, ty - 0.5, 0xc8c0e8, { oy: 0.5, alpha: a });
        ty += 8;
      }
      z.text.forEach((t, j) => this.texts.text(t, tx, ty + j * 8, l.col, { bold: true, oy: 0.5, alpha: a }));
      if (pulse(now, 1100, i * 300) > 0.9) star(g, x + z.w - 2, y + 1, 1, WHITE, a);
    });
  }
}

/** Bold text wrapped to `w`. */
function wrapBold(s: string, w: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (textWidth(t, 1, true) <= w || !cur) cur = t;
    else {
      out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}
