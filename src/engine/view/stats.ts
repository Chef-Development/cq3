// A hero's stats (a camp screen: "Stats" on the hero select). The main page: the hero (and Pip) showcased at 2x, their
// gear power, and their four core stats (HP, ATK, DEF, Crit) as big cards: the icon, the value, and a small stacked
// bar of where it comes from (the hero's base, their level, their skills, what this run has added, the gear; a legend
// at the top right). A tap on a card turns it over: the exact parts. "More stats" opens the other six the same way,
// and what the tapped one does.
import type Phaser from 'phaser';
import { CORE_STATS, STAT_IDS, STAT_INFO, type StatId } from '../../data/gear';
import { HEROES, type HeroId } from '../../data/heroes';
import { heroStats, newHero, type Hero } from '../../core/combat';
import { emptyLoadout, fmtStatShort, fmtTotal, itemPower, statShows, type StatBlock } from '../../core/gear';
import { equippedItems } from '../../core/profile';
import { HERO_FEET_X } from '../art';
import { textWidth } from '../font';
import { CampKit, D, GOLD_TXT, statMark } from './camp-kit';
import { glow, GOLD, hudIcon, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON } from './ui';

type G = Phaser.GameObjects.Graphics;

/** A stat split by where it comes from: the hero's starting value, their level, their skills, the run, the gear. */
interface Parts {
  total: StatBlock;
  base: StatBlock;
  level: StatBlock;
  skills: StatBlock;
  run: StatBlock;
  gear: StatBlock;
}

/** The parts' colors (and the legend's): base, level, skills, run, gear. */
const PART_COL = { base: 0xb8b0dc, level: 0x8af06a, skills: 0xd8a8ff, run: 0x9ad8ff, gear: GOLD_TXT } as const;
const PART_NAME = { base: 'Base', level: 'Lv', skills: 'Skills', run: 'Run', gear: 'Gear' } as const;
type PartKey = keyof typeof PART_COL;
const PART_KEYS = Object.keys(PART_COL) as PartKey[];
/** The six stats past the core four (the "More stats" page). */
const MORE_STATS: StatId[] = STAT_IDS.filter((id) => !CORE_STATS.includes(id));

export class StatsScreen {
  page: 'main' | 'all' = 'main';
  /** The core card turned over to its exact parts (-1: none), when it turned, and the last one turned (it turns back). */
  private flipped = -1;
  private flipAt = -1e9;
  private lastFlip = -1;
  /** Whose stats (the picked hero, or another one looked at on the hero select). */
  hero: HeroId = 'rowan';
  private openAt = 0;
  private pageAt = 0;
  private pick = 0; // the stat whose description shows on the "More stats" page (an index into MORE_STATS)
  private pickAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, hero?: HeroId): void {
    this.page = 'main';
    this.flipped = -1;
    this.openAt = now;
    this.pageAt = now;
    this.hero = hero ?? this.kit.profile.hero;
  }

  /** The hero as they'd fight now: the picked one is the run's hero; another one gets the same run and gear. */
  private heroNow(): Hero {
    const kit = this.kit;
    return this.hero === kit.profile.hero ? kit.heroNow() : kit.heroAs(this.hero);
  }

  private parts(): Parts {
    const kit = this.kit;
    const t = kit.tuning;
    const h = this.heroNow();
    const b = h.build;
    const total = heroStats(t, h);
    const noGear = heroStats(t, { ...h, gear: emptyLoadout() });
    const base = heroStats(t, newHero(t, emptyLoadout(), { id: b.id, level: 1, skills: [] }));
    const lv = heroStats(t, newHero(t, emptyLoadout(), { ...b, skills: [] }));
    const sk = heroStats(t, newHero(t, emptyLoadout(), b));
    const level = {} as StatBlock;
    const skills = {} as StatBlock;
    const run = {} as StatBlock;
    const gear = {} as StatBlock;
    for (const id of STAT_IDS) {
      level[id] = lv[id] - base[id];
      skills[id] = sk[id] - lv[id];
      run[id] = noGear[id] - sk[id];
      gear[id] = total[id] - noGear[id];
    }
    return { total, base, level, skills, run, gear };
  }

  // ------------------------------------------------------------------ layout

  private cards(): Rect[] {
    const s = this.kit.s;
    const x0 = s.L + 124;
    const w = Math.floor((s.R - 3 - x0 - 4) / 2);
    const h = Math.min(46, Math.floor((s.B - 3 - 22 - 20 - 4) / 2));
    return CORE_STATS.map((_, i) => ({ x: x0 + (i % 2) * (w + 4), y: 22 + Math.floor(i / 2) * (h + 4), w, h }));
  }

  private allButton(): Rect {
    const c = this.cards();
    const s = this.kit.s;
    return { x: c[0].x, y: Math.min(s.B - 19, c[3].y + c[3].h + 5), w: c[1].x + c[1].w - c[0].x, h: 15 };
  }

  /** The "More stats" rows: two columns of three. */
  private row(i: number): Rect {
    const s = this.kit.s;
    const W = s.R - s.L - 6;
    const w = Math.floor((W - 4) / 2);
    const h = Math.min(26, Math.floor((s.B - 3 - 21 - 26 - 4) / 3));
    return { x: s.L + 3 + (i % 2) * (w + 4), y: 21 + Math.floor(i / 2) * (h + 3), w, h };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      if (this.page === 'all') {
        this.page = 'main';
        this.pageAt = now;
        kit.app.audio.panelClose();
        return;
      }
      return 'back';
    }
    if (this.page === 'main') {
      const b = this.allButton();
      if (inRect(b, x, y, 2)) {
        notePress(b);
        this.page = 'all';
        this.pageAt = now;
        kit.app.audio.panelOpen();
        return;
      }
      // a core card turns over to its exact parts (a second tap turns it back)
      this.cards().forEach((c, i) => {
        if (!inRect(c, x, y)) return;
        notePress(c);
        this.flipped = this.flipped === i ? -1 : i;
        this.flipAt = now;
        kit.app.audio.uiClick();
      });
      return;
    }
    for (let i = 0; i < MORE_STATS.length; i++)
      if (inRect(this.row(i), x, y, 1)) {
        this.pick = i;
        this.pickAt = now;
        notePress(this.row(i));
        kit.app.audio.uiClick();
        return;
      }
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    const name = HEROES[this.hero].name;
    kit.title(g, this.page === 'main' ? name : 'More stats', kit.backRect().x + kit.backRect().w + 4, 4, RIBBON.purple, this.page === 'main' ? `Lv ${kit.level(this.hero).level}` : undefined);
    if (this.page === 'main') this.drawMain(g, now);
    else this.drawAll(g, now);
  }

  /** How a stat splits into its sources (positive parts only): [key, amount]. */
  private split(P: Parts, id: StatId): Array<[PartKey, number]> {
    return PART_KEYS.map((k) => [k, Math.max(0, P[k][id])] as [PartKey, number]).filter(([, v]) => v > 1e-9);
  }

  /** A small stacked bar of where a stat comes from: a segment per source in its colour, a dark trough. */
  private stack(g: G, P: Parts, id: StatId, x: number, y: number, w: number, h: number, alpha = 1): void {
    rows(g, x - 1, y - 1, w + 2, h + 2, 1, INK, alpha);
    g.fillStyle(NAVY[1], alpha);
    g.fillRect(x, y, w, h);
    const parts = this.split(P, id);
    const total = parts.reduce((a, [, v]) => a + v, 0);
    if (total <= 0) return;
    let cx = x;
    parts.forEach(([k], i) => {
      const end = i === parts.length - 1 ? x + w : x + Math.round((w * parts.slice(0, i + 1).reduce((a, [, q]) => a + q, 0)) / total);
      if (end <= cx) return;
      g.fillStyle(PART_COL[k], alpha);
      g.fillRect(cx, y, end - cx, h);
      g.fillStyle(WHITE, 0.35 * alpha);
      g.fillRect(cx, y, end - cx, 1);
      g.fillStyle(INK, 0.35 * alpha);
      if (cx > x) g.fillRect(cx, y, 1, h);
      cx = end;
    });
  }

  /** A swatch of a source's colour (the bars' legend). */
  private swatch(g: G, k: PartKey, x: number, cy: number, alpha = 1): void {
    rows(g, x, Math.round(cy) - 3, 5, 5, 1, INK, alpha);
    g.fillStyle(PART_COL[k], alpha);
    g.fillRect(x + 1, Math.round(cy) - 2, 3, 3);
  }

  /** The exact parts in a line, each named in its colour ("Base 100  Lv +14  Gear +47"). */
  private exact(g: G, P: Parts, id: StatId, x: number, y: number, maxW: number, alpha: number): void {
    const texts = this.kit.texts;
    let cx = x;
    const put = (k: PartKey, txt: string) => {
      const label = `${PART_NAME[k]} ${txt}`;
      const tw = textWidth(label, 1, false) + 7;
      if (cx + tw > x + maxW) return;
      this.swatch(g, k, cx, y, alpha);
      texts.text(label, cx + 7, y, mix(PART_COL[k], WHITE, 0.2), { oy: 0.5, alpha });
      cx += tw + 7;
    };
    put('base', fmtTotal(id, P.base[id]));
    for (const k of ['level', 'skills', 'run', 'gear'] as const) if (statShows(id, P[k][id])) put(k, fmtStatShort(id, P[k][id]));
  }

  /** The bars' legend: a swatch and a name per source, in two rows from (x, y). */
  private legend(g: G, x: number, y: number, alpha: number): void {
    const texts = this.kit.texts;
    const rowsOf: PartKey[][] = [
      ['base', 'level', 'skills'],
      ['run', 'gear'],
    ];
    rowsOf.forEach((ks, r) => {
      let cx = x;
      for (const k of ks) {
        this.swatch(g, k, cx, y + r * 9, alpha);
        texts.text(PART_NAME[k], cx + 7, y + r * 9, mix(PART_COL[k], WHITE, 0.2), { oy: 0.5, alpha });
        cx += 7 + textWidth(PART_NAME[k], 1, false) + 7;
      }
    });
  }

  private drawMain(g: G, now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const texts = kit.texts;
    const P = this.parts();
    const since = now - this.pageAt;
    // Rowan and Pip at 2x on a pool of light
    const hk = easeBack((now - this.openAt) / 300, 1.3);
    const fx = s.L + 70 - Math.round((1 - hk) * 50);
    const fy = Math.min(s.B - 30, 106);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xfff0c0, 0.07);
      const w = 70 - i * 14;
      g.fillRect(fx - w / 2 - 6, fy - 3 + Math.floor(i / 2), w + 12, 3);
    }
    rows(g, fx - 20, fy - 2, 40, 5, 2, INK, 0.35);
    this.showcase(fx, fy, now);
    const pip = Math.floor(now / 110) % 2 ? 'pip_idle1' : 'pip_idle0';
    const [pw, ph] = kit.imgs.size(pip);
    const px = Math.max(s.L + 2, fx - 46 - pw);
    kit.imgs.scaled(pip, px, Math.round(fy - 24 + Math.sin(now / 300) * 3) - ph * 2, D.icons, 2);
    // the gear power under him (the one number that sums the gear up)
    const gp = equippedItems(kit.profile).reduce((a, i) => a + itemPower(kit.tuning, i), 0);
    texts.text(`Gear power ${gp}`, fx - 6, fy + 10, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5 });
    // what the bars' colours mean
    const lk = clamp01((since - 300) / 200);
    if (lk > 0 && fy + 22 + 9 <= s.B - 2) this.legend(g, s.L + 8, fy + 22, lk);

    // the four core stats as cards: icon and name, the value big, where it comes from as a bar (a tap: the numbers)
    this.cards().forEach((c0, i) => {
      const id = CORE_STATS[i];
      const k = easeBack((since - 80 - i * 70) / 260, 1.6);
      if (k <= 0) return;
      const pr = isPressed(c0, now) ? 1 : 0;
      const c = { ...c0, y: c0.y + Math.round((1 - k) * 16) + pr };
      const flip = this.flipped === i;
      // turning over: the card squashes shut and opens again (a quick 160 ms)
      const fk = clamp01((now - this.flipAt) / 160);
      const turning = (flip || i === this.lastFlip) && fk < 1;
      const sq = turning ? Math.abs(1 - fk * 2) : 1;
      const hh = Math.max(2, Math.round(c.h * sq));
      const cr = { ...c, y: c.y + Math.round((c.h - hh) / 2), h: hh };
      if (flip) glow(g, cr, GOLD[3], 0.25 + 0.2 * pulse(now, 900), 2);
      kit.pane(g, cr, { alpha: clamp01(k * 2) });
      if (k < 0.9 || sq < 0.95) return;
      const showBack = turning ? (fk < 0.5 ? !flip : flip) : flip;
      if (!showBack) {
        const ic = STAT_INFO[id].icon;
        const [iw, ih] = iconSize(ic);
        hudIcon(g, ic, c.x + 5 + Math.round((15 - iw) / 2), c.y + 5 + Math.round((13 - ih) / 2));
        const name = textWidth(STAT_INFO[id].name, 1, false) <= c.w - 27 ? STAT_INFO[id].name : STAT_INFO[id].short;
        texts.text(name, c.x + 23, c.y + 11, 0xe8e0ff, { oy: 0.5 });
        const v = fmtTotal(id, P.total[id]);
        const big = textWidth(v, 2, true) <= c.w - 8;
        texts.text(v, c.x + c.w / 2, c.y + 26, WHITE, { bold: true, scale: big ? 2 : 1, ox: 0.5, oy: 0.5, extrude: big ? 1 : 0, extrudeCol: NAVY[1] });
        this.stack(g, P, id, c.x + 7, c.y + c.h - 9, c.w - 14, 3);
        return;
      }
      // the back: each source and its exact amount, a row each (the stat's name and icon make way)
      const parts = this.split(P, id);
      const rh = Math.min(9, Math.floor((c.h - 6) / Math.max(1, parts.length)));
      const y0 = c.y + Math.round((c.h - rh * parts.length) / 2) + rh / 2;
      parts.forEach(([key, amt], j) => {
        const y = y0 + j * rh;
        this.swatch(g, key, c.x + 7, y);
        texts.text(PART_NAME[key], c.x + 15, y, mix(PART_COL[key], WHITE, 0.2), { oy: 0.5 });
        texts.text(key === 'base' ? fmtTotal(id, amt) : fmtStatShort(id, amt), c.x + c.w - 7, y, WHITE, { bold: true, ox: 1, oy: 0.5 });
      });
    });
    if (this.flipped >= 0) this.lastFlip = this.flipped;
    const b = this.allButton();
    const bk = clamp01((since - 360) / 200);
    if (bk > 0) kit.button(g, texts, b, 'More stats', FACE.purple, now, { icon: 'stats', alpha: bk });
  }

  /** The hero standing at 2x with their feet at (fx, fy): their fight idle. */
  private showcase(fx: number, fy: number, now: number): void {
    const kit = this.kit;
    const f = Math.floor(now / 420) % 2;
    if (this.hero === 'rowan') {
      const pose = f ? 'hero_idle1' : 'hero_idle0';
      const [, hh] = kit.imgs.size(pose);
      kit.imgs.scaled(pose, fx - HERO_FEET_X * 2, fy - hh * 2, D.icons, 2);
      return;
    }
    // the other heroes' fight frames share Rowan's frame and feet point (art-sable.ts)
    const key = `${this.hero}_idle${f}`;
    const [, h] = kit.imgs.size(key);
    kit.imgs.scaled(key, fx - HERO_FEET_X * 2, fy - h * 2, D.icons, 2);
  }

  /** The six other stats: a row each (icon, name, value, where it comes from as a bar); the tapped one's text and exact
   *  parts underneath. */
  private drawAll(g: G, now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const texts = kit.texts;
    const P = this.parts();
    const since = now - this.pageAt;
    MORE_STATS.forEach((id, i) => {
      const k = easeBack((since - 40 - i * 40) / 220, 1.5);
      if (k <= 0) return;
      const r0 = this.row(i);
      const r = { ...r0, x: r0.x + Math.round((1 - k) * (i % 2 ? 20 : -20)) };
      const on = i === this.pick;
      const a = clamp01(k * 1.5);
      if (on) glow(g, r, GOLD[3], 0.25 + 0.2 * pulse(now, 900), 2);
      rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, on ? mix(GOLD[3], WHITE, pulse(now, 800) * 0.4) : INK, a);
      rows(g, r.x, r.y, r.w, r.h, 2, on ? 0x3a3070 : NAVY[3], a);
      g.fillStyle(on ? 0x5a4c98 : NAVY[4], a);
      g.fillRect(r.x + 2, r.y, r.w - 4, 1);
      const ic = STAT_INFO[id].icon;
      const [iw, ih] = iconSize(ic);
      if (ih <= r.h - 4) hudIcon(g, ic, r.x + 3 + Math.round((15 - iw) / 2), r.y + Math.round((r.h - ih) / 2), 1, a);
      else statMark(g, id, r.x + 6, r.y + r.h / 2, a);
      texts.text(STAT_INFO[id].name, r.x + 21, r.y + 7, on ? WHITE : 0xe8e0ff, { bold: true, oy: 0.5, alpha: a });
      texts.text(fmtTotal(id, P.total[id]), r.x + r.w - 5, r.y + 7, on ? 0xfff0a0 : WHITE, { bold: true, ox: 1, oy: 0.5, alpha: a });
      this.stack(g, P, id, r.x + 21, r.y + r.h - 8, r.w - 26, 3, a);
    });
    // the picked stat: what it does, and its exact parts
    const last = this.row(MORE_STATS.length - 1);
    const fy = last.y + last.h + 4;
    const fr = { x: s.L + 3, y: fy, w: s.R - s.L - 6, h: Math.max(18, s.B - 3 - fy) };
    kit.pane(g, fr);
    const id: StatId = MORE_STATS[this.pick] ?? MORE_STATS[0];
    const pk = clamp01((now - this.pickAt) / 160);
    const desc = STAT_INFO[id].desc.replace('Rowan', HEROES[this.hero].name);
    const name = `${STAT_INFO[id].name}:`;
    const x0 = fr.x + 7;
    texts.text(name, x0, fr.y + 8, 0xfff0a0, { bold: true, oy: 0.5, alpha: pk });
    texts.text(desc, x0 + textWidth(name, 1, true) + 4, fr.y + 8.5, WHITE, { oy: 0.5, alpha: pk });
    if (fr.h >= 24) this.exact(g, P, id, x0, fr.y + 18, fr.w - 14, pk);
  }
}
