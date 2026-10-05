// A hero's stats (a camp screen: "Stats" on the hero select). The main page: the hero (and Pip) showcased at 2x,
// their level, and their four core stats as big cards (each with how much of it the gear gives). "All stats" opens
// a page with all ten: each one's value and where it comes from (the hero's base, their level, their skills, what
// this run has added, the gear: colored parts, with a legend on top), and what the tapped one does.
import type Phaser from 'phaser';
import { CORE_STATS, STAT_IDS, STAT_INFO, type StatId } from '../../data/gear';
import { HEROES, type HeroId } from '../../data/heroes';
import { heroStats, newHero, type Hero } from '../../core/combat';
import { emptyLoadout, fmtStat, itemPower, type StatBlock } from '../../core/gear';
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
const PART_COL = { base: 0xd0c8f0, level: 0x8af06a, skills: 0xd8a8ff, run: 0x9ad8ff, gear: GOLD_TXT } as const;
const PART_NAME = { base: 'Base', level: 'Lv', skills: 'Skills', run: 'Run', gear: 'Gear' } as const;

export class StatsScreen {
  page: 'main' | 'all' = 'main';
  /** Whose stats (the picked hero, or another one looked at on the hero select). */
  hero: HeroId = 'rowan';
  private openAt = 0;
  private pageAt = 0;
  private pick = 0; // the stat whose description shows on the "all" page
  private pickAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, hero?: HeroId): void {
    this.page = 'main';
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

  private row(i: number): Rect {
    const s = this.kit.s;
    const W = s.R - s.L - 6;
    const w = Math.floor((W - 4) / 2);
    const h = Math.min(19, Math.floor((s.B - 3 - 21 - 24) / 5));
    return { x: s.L + 3 + (i % 2) * (w + 4), y: 21 + Math.floor(i / 2) * (h + 2), w, h };
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
      // a core card shows its stat on the "all" page
      this.cards().forEach((c, i) => {
        if (!inRect(c, x, y)) return;
        notePress(c);
        this.page = 'all';
        this.pageAt = now;
        this.pick = STAT_IDS.indexOf(CORE_STATS[i]);
        this.pickAt = now;
        kit.app.audio.panelOpen();
      });
      return;
    }
    for (let i = 0; i < STAT_IDS.length; i++)
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
    kit.title(g, this.page === 'main' ? name : 'All stats', kit.backRect().x + kit.backRect().w + 4, 4, RIBBON.purple, this.page === 'main' ? `Lv ${kit.level(this.hero).level}` : undefined);
    if (this.page === 'main') this.drawMain(g, now);
    else {
      // the legend for the colored parts, top right (right of the top bar's HTML buttons; "Base" goes if it's tight)
      const keys = Object.keys(PART_COL) as Array<keyof typeof PART_COL>;
      const w = (ks: typeof keys) => ks.reduce((a, k) => a + textWidth(PART_NAME[k], 1, false) + 5, -5);
      const z = kit.hudZone();
      const shown = w(keys) <= kit.s.R - 4 - (z.x + z.w + 2) ? keys : keys.slice(1);
      let x = kit.s.R - 4 - w(shown);
      for (const k of shown) {
        kit.texts.text(PART_NAME[k], x, 9.5, PART_COL[k], { oy: 0.5 });
        x += textWidth(PART_NAME[k], 1, false) + 5;
      }
      this.drawAll(g, now);
    }
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
    // name and gear power under him
    const gp = equippedItems(kit.profile).reduce((a, i) => a + itemPower(kit.tuning, i), 0);
    texts.text(`Gear power ${gp}`, fx - 6, fy + 9, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5 });
    const n = this.heroNow().build.skills.length;
    texts.text(`${n} skill${n === 1 ? '' : 's'}${kit.run.campFrom === 'world' ? ' + gear' : ', run + gear'}`, fx - 6, fy + 19, 0xc8c0e8, { ox: 0.5, oy: 0.5 });

    // the four core stats as cards
    this.cards().forEach((c0, i) => {
      const id = CORE_STATS[i];
      const k = easeBack((since - 80 - i * 70) / 260, 1.6);
      if (k <= 0) return;
      const pr = isPressed(c0, now) ? 1 : 0;
      const c = { ...c0, y: c0.y + Math.round((1 - k) * 16) + pr };
      kit.pane(g, c, { alpha: clamp01(k * 2) });
      if (k < 0.9) return;
      const ic = STAT_INFO[id].icon;
      const [iw, ih] = iconSize(ic);
      hudIcon(g, ic, c.x + 5 + Math.round((15 - iw) / 2), c.y + 5 + Math.round((13 - ih) / 2));
      const name = textWidth(STAT_INFO[id].name, 1, false) <= c.w - 27 ? STAT_INFO[id].name : STAT_INFO[id].short;
      texts.text(name, c.x + 23, c.y + 11, 0xe8e0ff, { oy: 0.5 });
      const v = fmtStat(id, P.total[id], false);
      const big = textWidth(v, 2, true) <= c.w - 8;
      texts.text(v, c.x + c.w / 2, c.y + 27, WHITE, { bold: true, scale: big ? 2 : 1, ox: 0.5, oy: 0.5, extrude: big ? 1 : 0, extrudeCol: NAVY[1] });
      const gv = P.gear[id];
      const has = Math.abs(gv) > 1e-9 && fmtStat(id, gv) !== '+0';
      texts.text(has ? `${fmtStat(id, gv)} gear` : 'no gear', c.x + c.w / 2, c.y + c.h - 7, has ? GOLD_TXT : 0x8a84a8, { ox: 0.5, oy: 0.5 });
    });
    const b = this.allButton();
    const bk = clamp01((since - 360) / 200);
    if (bk > 0) kit.button(g, texts, b, 'All stats', FACE.purple, now, { icon: 'stats', alpha: bk });
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

  private drawAll(g: G, now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const texts = kit.texts;
    const P = this.parts();
    const since = now - this.pageAt;
    STAT_IDS.forEach((id, i) => {
      const k = easeBack((since - 40 - i * 30) / 220, 1.5);
      if (k <= 0) return;
      const r0 = this.row(i);
      const r = { ...r0, x: r0.x + Math.round((1 - k) * (i % 2 ? 20 : -20)) };
      const on = i === this.pick;
      const a = clamp01(k * 1.5);
      if (on) glow(g, r, GOLD[3], 0.25 + 0.2 * pulse(now, 900), 2);
      rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, on ? mix(GOLD[3], WHITE, pulse(now, 800) * 0.4) : INK, a);
      rows(g, r.x, r.y, r.w, r.h, 2, on ? 0x3a3070 : i % 4 === 0 || i % 4 === 3 ? NAVY[3] : NAVY[2], a);
      g.fillStyle(on ? 0x5a4c98 : NAVY[4], a);
      g.fillRect(r.x + 2, r.y, r.w - 4, 1);
      const ic = STAT_INFO[id].icon;
      const [iw, ih] = iconSize(ic);
      if (ih <= r.h - 4) hudIcon(g, ic, r.x + 3 + Math.round((15 - iw) / 2), r.y + Math.round((r.h - ih) / 2), 1, a);
      else statMark(g, id, r.x + 6, r.y + r.h / 2, a);
      texts.text(STAT_INFO[id].name, r.x + 21, r.y + 5, on ? WHITE : 0xe8e0ff, { bold: true, oy: 0.5, alpha: a });
      texts.text(fmtStat(id, P.total[id], false), r.x + r.w - 4, r.y + 5, on ? 0xfff0a0 : WHITE, { bold: true, ox: 1, oy: 0.5, alpha: a });
      // where it comes from: base, +run, +gear
      let x = r.x + 21;
      const y = r.y + r.h - 4;
      const part = (txt: string, col: number) => {
        texts.text(txt, x, y, col, { oy: 0.5, alpha: a });
        x += textWidth(txt, 1, false) + 3;
      };
      part(fmtStat(id, P.base[id], false), PART_COL.base);
      for (const k of ['level', 'skills', 'run', 'gear'] as const) if (Math.abs(P[k][id]) > 1e-9 && fmtStat(id, P[k][id]) !== '+0') part(fmtStat(id, P[k][id]), PART_COL[k]);
    });
    // the picked stat's description
    const last = this.row(STAT_IDS.length - 1);
    const fy = last.y + last.h + 3;
    const fr = { x: s.L + 3, y: fy, w: s.R - s.L - 6, h: Math.max(14, s.B - 3 - fy) };
    kit.pane(g, fr);
    const id: StatId = STAT_IDS[this.pick];
    const pk = clamp01((now - this.pickAt) / 160);
    const desc = STAT_INFO[id].desc.replace('Rowan', HEROES[this.hero].name);
    const name = `${STAT_INFO[id].name}:`;
    const tw = textWidth(name, 1, true) + 4 + textWidth(desc, 1, false);
    const x0 = Math.round(fr.x + fr.w / 2 - tw / 2);
    const cy = fr.y + fr.h / 2;
    texts.text(name, x0, cy, 0xfff0a0, { bold: true, oy: 0.5, alpha: pk });
    texts.text(desc, x0 + textWidth(name, 1, true) + 4, cy + 0.5, WHITE, { oy: 0.5, alpha: pk });
  }
}
