// The hero select (a camp screen: tap the hero chip at the top left, or a hero by the fire). All eight heroes, one at
// a time, paged with the strip of faces in the top bar (each in its rarity's colours; dark for one not met yet) or its
// arrows. The card: the hero's card art in a frame of their rarity's colours, their name, title and style (its chip,
// and what it rewards), their rarity, stars (and shards toward the next), level and XP; then three tabs:
//   Kit      the signature, ability (what a green hit does), passive and finisher (and what it does to the bar),
//            one plain line each (a tap shows the full line with its number), and their soft strength
//   Stars    what 2 to 5 stars give (3 and 5 unlock moves), the shards toward the next star
//   Mastery  four goals, each unlocking something for everyone (a relic, a camp upgrade, a set piece, a banner)
// "Pick" makes them the hero who fights (and earns the XP); "Skills" opens their skill tree; the chart icon their
// stats. A hero not met yet is a dark silhouette with how they're found ("Joins in the story" / "Found in hero
// chests"); their kit, stars and mastery can still be read. Gear is shared by every hero. Text wraps to fit at 8x.
import type Phaser from 'phaser';
import { HERO_IDS, HEROES, type HeroId, type KitPart } from '../../data/heroes';
import { STYLES } from '../../data/styles';
import type { FoeTag } from '../../data/types';
import { kitText } from '../../core/heroes';
import { masteryOf } from '../../core/meta';
import { selectHero } from '../../core/profile';
import { heroOwned, shardsToNext } from '../../core/roster';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, familyChipW, GOLD_TXT, GREEN, pix, pixSize } from './camp-kit';
import { padlock, wrapText } from './items';
import { brick, chevron, gauge, glow, GOLD, hudIcon, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

export { kitText };

export type HeroTab = 'kit' | 'stars' | 'mastery';
const TABS: Array<{ id: HeroTab; label: string }> = [
  { id: 'kit', label: 'Kit' },
  { id: 'stars', label: 'Stars' },
  { id: 'mastery', label: 'Mastery' },
];

type KitWhich = 'signature' | 'ability' | 'passive' | 'finisher';
/** The kit's four parts: a tile's colours and mark, and the name's colour. */
const KIT: Array<{ which: KitWhich; face: Face; name: number }> = [
  { which: 'signature', face: [0xffc8f0, 0xb84a9a, 0x8a3478, 0x5a1a4a], name: 0xffb8e8 },
  { which: 'ability', face: [0xb4f070, 0x3a9a3a, 0x2e7a30, 0x1a5a26], name: 0xb4f070 },
  { which: 'passive', face: [0x9ad8ff, 0x2a62c8, 0x22489c, 0x1a3070], name: 0x9ad8ff },
  { which: 'finisher', face: [0xfff0a0, 0xc88a1c, 0x9a5a14, 0x5a3410], name: 0xffe680 },
];

/** The foe kinds as the soft strengths name them. */
export const FOE_KIND: Record<FoeTag, string> = {
  folk: 'Folk',
  beast: 'Beasts',
  flyer: 'Flyers',
  caster: 'Casters',
  armored: 'Armored foes',
  construct: 'Constructs',
  swarm: 'Swarms',
  brute: 'Brutes',
  frost: 'Frost foes',
};

/** A hero's soft strength in plain words ("+20% damage to Folk", "Takes 20% less from Brutes"). */
export function strengthText(id: HeroId): string {
  return HEROES[id].strengths.map((s) => (s.kind === 'dmg' ? `+${Math.round(s.n * 100)}% damage to ${FOE_KIND[s.tag]}` : `Takes ${Math.round(s.n * 100)}% less from ${FOE_KIND[s.tag]}`)).join(', ');
}

/** How a hero not met yet joins. */
export const howFound = (id: HeroId): string => (HEROES[id].joins === 'chest' ? 'Found in hero chests' : 'Joins in the story');

/** The narrowest width that fits `s` in two lines (the best place to break it). */
export function twoLineW(s: string): number {
  const words = s.split(' ');
  let best = textWidth(s, 1, false);
  for (let i = 1; i < words.length; i++) best = Math.min(best, Math.max(textWidth(words.slice(0, i).join(' '), 1, false), textWidth(words.slice(i).join(' '), 1, false)));
  return best;
}

/** A kit column's width (an icon tile and name, its short line in two lines at most). */
export function kitColW(part: KitPart, bold: boolean): number {
  return Math.max(17 + textWidth(part.name, 1, bold), twoLineW(part.short) + 2);
}

/** Word-wrap with a shorter first line (text that follows a label on the same line). */
export function wrapFlow(s: string, firstW: number, restW: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    const test = cur ? `${cur} ${w}` : w;
    if (textWidth(test, 1, false) <= (out.length ? restW : firstW)) cur = test;
    else {
      out.push(cur); // '' when not even one word fits after the label: the text starts on the next line
      cur = w;
    }
  }
  out.push(cur);
  return out;
}

const ROW = 9; // a content row's height

export class HeroesScreen {
  view: HeroId = 'rowan';
  tab: HeroTab = 'kit';
  private openAt = 0;
  private viewAt = 0;
  private dir = 0; // the way the last page turned (the card slides in from that side)
  private tabAt = 0;
  private pickAt = -1e9;
  private shakeAt = -1e9;
  /** The XP numbers show beside the level bar after a tap on it. */
  private xpShown = false;
  /** A kit row tapped open shows its full text (with the numbers); where the rows were drawn. */
  private kitOpen: KitWhich | null = null;
  private kitRows: Array<{ which: KitWhich; r: Rect }> = [];

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: HeroId): void {
    this.view = id ?? this.kit.profile.hero;
    this.openAt = now;
    this.viewAt = now;
    this.dir = 0;
    this.kitOpen = null;
  }

  // ------------------------------------------------------------------ layout

  private owned(id: HeroId): boolean {
    return heroOwned(this.kit.profile, id);
  }

  /** The strip of faces in the top bar (one per hero, in order), with its arrows either side when they fit. */
  private strip(): { tabs: Array<{ id: HeroId; r: Rect; locked: boolean }>; prev: Rect | null; next: Rect | null } {
    const kit = this.kit;
    const s = kit.s;
    const b = kit.backRect();
    const x0 = b.x + b.w + 4;
    const right = s.R - 3;
    const ws = HERO_IDS.map(() => 15);
    // arrows, then the faces, then the other arrow; without the arrows if they don't fit
    const all = kit.topRow([13, ...ws, 13], x0, right, 2);
    const rs = all ? all.slice(1, -1) : (kit.topRow(ws, x0, right, 2) ?? kit.topRow(ws, x0, 1e9, 2)!);
    return {
      tabs: HERO_IDS.map((id, i) => ({ id, r: rs[i], locked: !this.owned(id) })),
      prev: all ? all[0] : null,
      next: all ? all[all.length - 1] : null,
    };
  }

  /** The faces in the top bar (the tips point at them). */
  tabs(): Array<{ id: HeroId; r: Rect; locked: boolean }> {
    return this.strip().tabs;
  }

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  private frame(): Rect {
    const c = this.card();
    return { x: c.x + 5, y: c.y + 4, w: 46, h: 50 };
  }

  /** The text column right of the art. */
  private col(): { x: number; w: number } {
    const c = this.card();
    const f = this.frame();
    const x = f.x + f.w + 7;
    return { x, w: c.x + c.w - 6 - x };
  }

  private buttons(): { pick: Rect; skills: Rect; stats: Rect } {
    const c = this.card();
    const picked = this.kit.profile.hero === this.view;
    const owned = this.owned(this.view);
    const pw = (picked ? textWidth('Picked', 1, true) + pixSize('check')[0] + 2 : owned ? textWidth('Pick', 1, true) + 4 : textWidth('Locked', 1, true) + 11) + 14;
    const pick = { x: c.x + c.w - 6 - pw, y: c.y + 5, w: pw, h: 14 };
    const sw = textWidth('Skills', 1, true) + pixSize('skills')[0] + 14;
    const skills = { x: pick.x - 4 - sw, y: pick.y, w: sw, h: 14 };
    const stats = { x: skills.x - 4 - 17, y: pick.y, w: 17, h: 14 };
    return { pick, skills, stats };
  }

  /** The level row: "Lv 8" and its bar, right-aligned on the stars' row. */
  private levelRect(): Rect {
    const c = this.card();
    return { x: c.x + c.w - 6 - 64, y: c.y + 44, w: 64, h: 10 };
  }

  private tabRects(): Array<{ id: HeroTab; label: string; r: Rect }> {
    const f = this.frame();
    let x = f.x;
    const y = f.y + f.h + 3;
    return TABS.map((t) => {
      const w = textWidth(t.label, 1, true) + 12;
      const r = { x, y, w, h: 12 };
      x += w + 3;
      return { ...t, r };
    });
  }

  /** Where a tab's content goes: the whole width under the art and the tabs. */
  private body(): Rect {
    const c = this.card();
    const t = this.tabRects()[0].r;
    const y = t.y + t.h + 3;
    return { x: c.x + 6, y, w: c.w - 12, h: c.y + c.h - 3 - y };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | 'stats' | 'skills' | void {
    const kit = this.kit;
    const app = kit.app;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    const st = this.strip();
    for (const { id, r } of st.tabs) {
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      this.show(id, now);
      return;
    }
    for (const [r, d] of [
      [st.prev, -1],
      [st.next, 1],
    ] as const) {
      if (!r || !inRect(r, x, y, 2)) continue;
      notePress(r);
      const i = HERO_IDS.indexOf(this.view);
      this.show(HERO_IDS[(i + d + HERO_IDS.length) % HERO_IDS.length], now, d);
      return;
    }
    for (const t of this.tabRects())
      if (inRect(t.r, x, y, 2)) {
        notePress(t.r);
        if (this.tab !== t.id) {
          this.tab = t.id;
          this.tabAt = now;
          this.kitOpen = null;
          app.audio.uiClick();
        }
        return;
      }
    const b = this.buttons();
    const owned = this.owned(this.view);
    if (owned && inRect(b.stats, x, y, 2)) {
      notePress(b.stats);
      return 'stats';
    }
    if (owned && inRect(b.skills, x, y, 2)) {
      notePress(b.skills);
      return 'skills';
    }
    if (inRect(b.pick, x, y, 2)) {
      notePress(b.pick);
      return this.pick(now);
    }
    if (owned && inRect(this.levelRect(), x, y, 3)) {
      this.xpShown = !this.xpShown;
      app.audio.uiClick();
      return;
    }
    if (this.tab === 'kit') {
      const row = this.kitRows.find((q) => inRect(q.r, x, y, 1));
      if (row) {
        this.kitOpen = this.kitOpen === row.which ? null : row.which;
        app.audio.uiClick();
        return;
      }
    }
    // tapping the art: a little hop (or a shake for one not met yet)
    if (inRect(this.frame(), x, y, 2)) {
      if (!owned) return this.refuse(now);
      this.pickAt = now - 200;
      app.audio.textBlip();
    }
  }

  /** Page to hero `id` (`dir`: which way it turned, for the slide). */
  show(id: HeroId, now: number, dir = 0): void {
    if (this.view === id) return;
    const from = HERO_IDS.indexOf(this.view);
    this.dir = dir || Math.sign(HERO_IDS.indexOf(id) - from);
    this.view = id;
    this.viewAt = now;
    this.kitOpen = null;
    this.kit.fadeToast();
    this.kit.app.audio.uiClick();
  }

  private refuse(now: number): void {
    this.shakeAt = now;
    this.kit.app.audio.lockToggle();
    const f = this.frame();
    this.kit.fx.float(howFound(this.view), f.x + f.w / 2 + 30, f.y + 12, 0xffb0a0, { life: 1400 });
  }

  private pick(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.view;
    if (!this.owned(id)) return this.refuse(now);
    if (p.hero === id) {
      kit.app.audio.uiClick();
      const b = this.buttons().pick;
      kit.fx.float('Already picked', b.x + b.w / 2 - 10, b.y + b.h + 8, 0xd8d0f0, { life: 1000 });
      return;
    }
    if (!selectHero(p, id)) return;
    kit.commit();
    this.pickAt = now;
    kit.app.audio.equip();
    for (let i = 0; i < 3; i++) kit.after(120 + i * 70, () => kit.app.audio.statUp(i));
    const f = this.frame();
    kit.fx.flash(f, WHITE, 420);
    kit.fx.ring(f.x + f.w / 2, f.y + f.h / 2, 30, 0xfff0a0, 480);
    kit.fx.burst(f.x + f.w / 2, f.y + f.h / 2, [0xfff0a0, 0xffd23a, WHITE, GREEN], 26, 1.1, { kind: 'star', g: 30, life: 700 });
    const c = this.card();
    kit.after(200, () =>
      kit.toast({
        title: `${HEROES[id].name} picked!`,
        ribbon: RIBBON.green,
        lines: [],
        text: [
          { text: `${HEROES[id].name} fights next`, col: WHITE, bold: true },
          { text: 'Same gear, their own level', col: 0xc8c0e8 },
        ],
        cx: c.x + c.w / 2,
        cy: c.y + 84,
      }),
    );
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    this.drawStrip(g, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    this.drawCard(g, now);
  }

  /** The faces along the top (the one on view lifted and gold), and the arrows either side. */
  private drawStrip(g: G, now: number): void {
    const kit = this.kit;
    const st = this.strip();
    for (const t of st.tabs) {
      if (t.id === this.view) glow(g, t.r, 0xffd23a, 0.3 + 0.2 * pulse(now, 1000), 2);
      kit.faceTab(g, t.r, t.id, t.id === this.view, t.locked, now);
    }
    for (const [r, d] of [
      [st.prev, -1],
      [st.next, 1],
    ] as const) {
      if (!r) continue;
      const pr = isPressed(r, now);
      kit.button(g, kit.texts, r, '', FACE.navy, now);
      chevron(g, r.x + (d < 0 ? 4 : 5), r.y + 3 + (pr ? 2 : 0), 7, GOLD[3], 1, d, true);
    }
  }

  private drawCard(g: G, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const texts = kit.texts;
    const id = this.view;
    const def = HEROES[id];
    const owned = this.owned(id);
    const c = this.card();
    const col = this.col();
    // the page slides in from the side it turned to
    const vk = clamp01((now - this.viewAt) / 200);
    const a = vk;
    const dx = Math.round((1 - vk) * 8 * this.dir);
    this.drawArt(g, now, !owned);
    // the name, big; Stats, Skills and Pick on the right
    const b = this.buttons();
    const nameCol = owned ? WHITE : 0x9a90b8;
    const nameW = textWidth(def.name, 2, true);
    const big = col.x + nameW <= b.stats.x - 4;
    texts.text(def.name, col.x + dx, c.y + 12, nameCol, { bold: true, scale: big ? 2 : 1, oy: 0.5, extrude: 1, extrudeCol: NAVY[1], alpha: a });
    if (owned) {
      kit.button(g, texts, b.stats, '', FACE.purple, now, { icon: 'stats' });
      kit.button(g, texts, b.skills, 'Skills', FACE.blue, now, { icon: 'skills', glowCol: kit.level(id).points > 0 ? 0xffd23a : undefined });
      if (kit.level(id).points > 0) kit.bubble(g, texts, b.skills.x + b.skills.w - 1, b.skills.y - 3, '!', now, true);
      if (p.hero === id) kit.button(g, texts, b.pick, 'Picked', FACE.gold, now, { icon: 'check' });
      else kit.button(g, texts, b.pick, 'Pick', FACE.green, now, { glowCol: 0x8af06a });
    } else {
      kit.button(g, texts, b.pick, 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
      padlock(kit.gOver, b.pick.x + 5, b.pick.y + 4, 1, 0xd8901c);
    }
    // the title and the style's chip; what the style rewards under them
    let y = c.y + 26;
    texts.text(def.title, col.x + dx, y, owned ? 0xffd890 : 0xa898b8, { oy: 0.5, alpha: a });
    const tw = textWidth(def.title, 1, false);
    const st = STYLES[def.style];
    const chipX = col.x + tw + 6;
    const chipW = familyChipW(def.style);
    // what it rewards: after the chip when there's room, else on its own line
    const rewardsInline = chipX + chipW + 5 + textWidth(st.rewards, 1, false) <= c.x + c.w - 6;
    kit.familyChip(g, texts, def.style, chipX + dx, y, a);
    if (rewardsInline) {
      texts.text(st.rewards, chipX + chipW + 5 + dx, y, 0xc8c0e8, { oy: 0.5, alpha: a });
      // the line under it has room for their one-line joke
      if (textWidth(def.bio, 1, false) <= col.w) texts.text(def.bio, col.x + dx, y + 9, 0x9a90c0, { oy: 0.5, alpha: a });
    } else
      for (const [i, l] of wrapText(st.rewards, col.w).slice(0, 1).entries()) texts.text(l, col.x + dx, y + 9 + i * 8, 0xc8c0e8, { oy: 0.5, alpha: a });
    // the rarity, the stars and shards; the level on the right (or how they're found)
    y = c.y + 49;
    let x = col.x + dx;
    x += kit.rarityTag(g, texts, def.rarity, x, y, a) + 5;
    const prog = p.heroes[id];
    if (owned) {
      x += kit.starRow(g, x, y - 4, prog.stars, { alpha: a }) + 4;
      const need = shardsToNext(kit.tuning, prog.stars);
      hudIcon(g, 'shard', x, y - 6, 1, a);
      texts.text(need === null ? 'Max' : `${prog.shards}/${need}`, x + 11, y, need === null ? GOLD_TXT : 0xe0d0ff, { bold: true, oy: 0.5, alpha: a });
      this.drawLevel(g, a);
    } else {
      const msg = howFound(id);
      const w = textWidth(msg, 1, true) + 16;
      const r = { x: Math.min(c.x + c.w - 6 - w, x), y: y - 6, w, h: 12 };
      glow(g, r, GOLD[3], 0.2 + 0.25 * pulse(now, 1200), 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
      padlock(kit.gOver, r.x + 3, r.y + 2, a, 0xfff0a0);
      texts.text(msg, r.x + 12, r.y + 6, 0x5a2a08, { bold: true, oy: 0.5, alpha: a });
    }
    this.drawTabs(g, now);
    const body = this.body();
    kit.divider(g, body.x, body.y - 3, body.w);
    const ms = now - Math.max(this.viewAt, this.tabAt);
    if (this.tab === 'kit') this.drawKit(g, body, ms);
    else if (this.tab === 'stars') this.drawStars(g, body, ms);
    else this.drawMastery(g, body, ms);
  }

  /** "Lv 8" in a gold chip, its XP bar (and the numbers after a tap on it). */
  private drawLevel(g: G, a: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const L = kit.level(this.view);
    const r = this.levelRect();
    const lv = `Lv ${L.level}`;
    const lw = textWidth(lv, 1, true) + 8;
    tag(g, { x: r.x, y: r.y, w: lw, h: 10 }, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], a);
    texts.text(lv, r.x + lw / 2, r.y + 5, 0x3a1e08, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    const bx = r.x + lw + 3;
    const bw = r.x + r.w - bx;
    gauge(g, bx, r.y + 2, bw, 6, L.need ? L.into / L.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a] });
    if (this.xpShown) {
      const t = L.need ? `${L.into}/${L.need} XP` : 'Max level';
      const w = textWidth(t, 1, false) + 8;
      const tr = { x: r.x + r.w - w, y: r.y - 11, w, h: 10 };
      tag(g, tr, [NAVY[6], NAVY[3], NAVY[2], NAVY[1]]);
      texts.text(t, tr.x + w / 2, tr.y + 5, 0xc8e0ff, { ox: 0.5, oy: 0.5 });
    }
  }

  private drawTabs(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const body = this.body();
    for (const t of this.tabRects()) {
      const on = t.id === this.tab;
      const pr = isPressed(t.r, now) ? 1 : 0;
      const r = { ...t.r, y: t.r.y + pr - (on ? 1 : 0) };
      if (on) glow(g, r, 0xffd23a, 0.25 + 0.15 * pulse(now, 1200), 2);
      tag(g, r, on ? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]] : [NAVY[6], NAVY[4], NAVY[3], NAVY[1]]);
      texts.text(t.label, r.x + r.w / 2, r.y + r.h / 2, on ? 0x4a2408 : 0xd8d0f0, { bold: true, ox: 0.5, oy: 0.5 });
    }
    // beside the tabs: what the tab's rows are about
    const last = this.tabRects()[TABS.length - 1].r;
    const x0 = last.x + last.w + 8;
    const cy = last.y + 6;
    const right = body.x + body.w;
    const tk = clamp01((now - Math.max(this.viewAt, this.tabAt)) / 180);
    if (this.tab === 'kit') {
      // the soft strength: a sword and its line
      const s = strengthText(this.view);
      if (!s) return;
      const [iw, ih] = iconSize('sword');
      const lines = wrapText(s, right - x0 - iw - 3);
      if (lines.length === 1) {
        hudIcon(g, 'sword', x0, Math.round(cy - ih / 2), 1, tk);
        texts.text(s, x0 + iw + 3, cy, 0xb4f070, { oy: 0.5, alpha: tk });
      }
    } else if (this.tab === 'mastery') {
      const t = 'Each one unlocks for everyone';
      const tt = textWidth(t, 1, false) <= right - x0 ? t : 'Unlocks for everyone';
      if (textWidth(tt, 1, false) <= right - x0) texts.text(tt, x0, cy, 0xffd890, { oy: 0.5, alpha: tk });
    } else {
      const t = 'Duplicates from chests give shards';
      const tt = textWidth(t, 1, false) <= right - x0 ? t : 'Duplicates give shards';
      if (textWidth(tt, 1, false) <= right - x0) texts.text(tt, x0, cy, 0xe0d0ff, { oy: 0.5, alpha: tk });
    }
  }

  /** The art in its rarity frame (a hop when picked); `dark` draws it as a silhouette. */
  private drawArt(g: G, now: number, dark: boolean): void {
    const kit = this.kit;
    const id = this.view;
    const sh = now - this.shakeAt;
    const dx = sh < 300 ? Math.round(Math.sin(sh / 20) * 2 * (1 - sh / 300)) : 0;
    const f0 = this.frame();
    const f = { ...f0, x: f0.x + dx };
    const picked = kit.profile.hero === id && !dark;
    if (picked) glow(g, f, 0xffd23a, 0.3 + 0.25 * pulse(now, 1100), 3);
    kit.rarityFrame(g, f, HEROES[id].rarity, now, { dark });
    // the card art, cropped to the frame (a hop when just picked)
    const pk = now - this.pickAt;
    const hop = pk >= 0 && pk < 380 ? Math.round(Math.sin((pk / 380) * Math.PI) * 4) : 0;
    const art = kit.heroArt(id);
    const [w, h] = kit.imgs.size(art.key);
    const inner = { x: f.x + 3, y: f.y + 3, w: f.w - 6, h: f.h - 6 };
    const ax = inner.x + Math.round((inner.w - w) / 2);
    const ay = inner.y - hop;
    const cropH = Math.min(h, inner.h + hop);
    kit.sprites.draw(art.key, ax, ay, D.icons, { crop: [Math.max(0, inner.x - ax), 0, Math.min(w, inner.w), cropH], tint: dark ? 0x241c3a : art.shadow ? 0x3a2c58 : undefined, alpha: dark ? 0.95 : 1 });
    if (dark) kit.texts.text('?', f.x + f.w / 2, f.y + f.h / 2, 0x8a7cc0, { bold: true, scale: 2, ox: 0.5, oy: 0.5 });
  }

  /** The kit: a row per part (a tile, the name, one plain line; tapped open, the full line), the finisher's effect
   *  on the bar under it. */
  private drawKit(g: G, body: Rect, ms: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const id = this.view;
    const def = HEROES[id];
    let y = body.y;
    const bottom = body.y + body.h;
    this.kitRows = [];
    // names share one column when that leaves the lines room, else each line follows its own name
    const nameWs = KIT.map((q) => textWidth(def[q.which].name, 1, false));
    const colW = Math.max(...nameWs) + 6;
    const textX = body.x + 12;
    const aligned = KIT.every((q) => textWidth(this.kitOpen === q.which ? kitText(kit.tuning, id, q.which) : def[q.which].short, 1, false) <= body.w - 12 - colW);
    KIT.forEach((q, i) => {
      const part = def[q.which];
      const ik = clamp01((ms - i * 40) / 140);
      if (ik <= 0) return;
      const open = this.kitOpen === q.which;
      const text = open ? kitText(kit.tuning, id, q.which) : part.short;
      const nx = textX;
      const lx = aligned ? textX + colW : textX + nameWs[i] + 5;
      const lines = wrapFlow(text, body.x + body.w - lx, body.w - 12);
      // the finisher's effect on the bar: after its line when there's room, else under it
      const barText = `Bar: ${def.finisher.bar}`;
      const lastW = textWidth(lines[lines.length - 1], 1, false) + (lines.length === 1 ? lx : textX);
      const barInline = q.which === 'finisher' && lastW + 8 + 14 + textWidth(barText, 1, false) <= body.x + body.w;
      const rowH = Math.max(ROW, lines.length * 8 + 1) + (q.which === 'finisher' && !barInline ? 8 : 0);
      const r = { x: body.x, y: y - 1, w: body.w, h: rowH };
      if (y + 8 > bottom + 2) return;
      this.kitRows.push({ which: q.which, r });
      if (open) rows(g, r.x - 2, r.y, r.w + 4, r.h, 2, NAVY[4], 0.7 * ik);
      const tile = { x: body.x, y, w: 9, h: 9 };
      tag(g, tile, q.face, ik);
      this.kitIcon(g, q.which, tile, ik);
      texts.text(part.name, nx, y + 4.5, q.name, { oy: 0.5, alpha: ik });
      lines.forEach((l, j) => {
        if (!l) return;
        texts.text(l, j === 0 ? lx : textX, y + 4.5 + j * 8, open ? 0xfff0c0 : 0xd8d0f0, { oy: 0.5, alpha: ik });
      });
      if (q.which === 'finisher') {
        // what it does to the bar: a little bar with a block on it, then the words
        const by = barInline ? y + 4.5 + (lines.length - 1) * 8 : y + 4.5 + lines.length * 8;
        const bx = barInline ? lastW + 8 : textX;
        rows(g, bx, Math.round(by - 3), 11, 6, 1, INK, ik);
        g.fillStyle(0x2a2440, ik);
        g.fillRect(bx + 1, Math.round(by - 2), 9, 4);
        g.fillStyle(0xffd23a, ik);
        g.fillRect(bx + 6, Math.round(by - 2), 2, 4);
        texts.text(barText, bx + 14, by, 0xffe680, { oy: 0.5, alpha: ik });
      }
      y += rowH;
    });
    // the soft strength, when it didn't fit beside the tabs
    const s = strengthText(id);
    const last = this.tabRects()[TABS.length - 1].r;
    const besideW = body.x + body.w - (last.x + last.w + 8) - iconSize('sword')[0] - 3;
    if (s && wrapText(s, besideW).length > 1 && y + 8 <= bottom + 2) {
      const tk = clamp01((ms - 160) / 140);
      const [iw, ih] = iconSize('sword');
      hudIcon(g, 'sword', body.x, Math.round(y + 4.5 - ih / 2), 1, tk);
      texts.text(s, body.x + iw + 3, y + 4.5, 0xb4f070, { oy: 0.5, alpha: tk });
    }
  }

  /** A kit part's mark on its tile: a star (the signature), a green block (what a green hit does), the meter (a
   *  passive), a bolt (the finisher). */
  private kitIcon(g: G, which: KitWhich, t: Rect, alpha: number): void {
    if (which === 'ability') {
      brick(g, t.x + 2, t.y + 1, 5, 7, [0xa8f590, 0x4ccf4a, 0x2a9a3a, 0x14622a], alpha);
      return;
    }
    if (which === 'signature') {
      g.fillStyle(0xfff0a0, alpha);
      g.fillRect(t.x + 4, t.y + 1, 1, 7);
      g.fillRect(t.x + 1, t.y + 4, 7, 1);
      g.fillStyle(WHITE, alpha);
      g.fillRect(t.x + 3, t.y + 3, 3, 3);
      return;
    }
    const key = which === 'passive' ? 'meter' : 'bolt';
    const [w, h] = iconSize(key);
    if (w > t.w + 2 || h > t.h + 2) {
      g.fillStyle(0xffe680, alpha);
      g.fillRect(t.x + 4, t.y + 1, 2, 4);
      g.fillRect(t.x + 3, t.y + 4, 3, 1);
      g.fillRect(t.x + 3, t.y + 5, 2, 3);
      return;
    }
    hudIcon(g, key, t.x + Math.round((t.w - w) / 2), t.y + Math.round((t.h - h) / 2), 1, alpha);
  }

  /** Stars: what 2 to 5 stars give, the ones reached lit; the shards toward the next star. */
  private drawStars(g: G, body: Rect, ms: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const id = this.view;
    const def = HEROES[id];
    const owned = this.owned(id);
    const stars = owned ? kit.profile.heroes[id].stars : 0;
    const T = kit.tuning.levels;
    const rowsDef: Array<{ n: number; name: string; text: string }> = [
      { n: 2, name: 'Stronger', text: `+${Math.round(T.star2Atk * 100)}% attack` },
      { n: 3, name: def.stars[0].name, text: def.stars[0].text },
      { n: 4, name: 'Tougher', text: `+${Math.round(T.star4Hp * 100)}% max HP` },
      { n: 5, name: def.stars[1].name, text: def.stars[1].text },
    ];
    let y = body.y;
    const bottom = body.y + body.h;
    rowsDef.forEach((r, i) => {
      const ik = clamp01((ms - i * 40) / 140);
      if (ik <= 0 || y + 8 > bottom + 2) return;
      const got = stars >= r.n;
      const a = ik * (got ? 1 : 0.75);
      // "3" and a star, then the name and its line
      texts.text(`${r.n}`, body.x + 4, y + 4.5, got ? GOLD_TXT : DIM_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: ik });
      hudIcon(g, got ? 'star_on' : 'star_off', body.x + 8, y, 1, ik);
      const nx = body.x + 20;
      const nw = textWidth(r.name, 1, false);
      texts.text(r.name, nx, y + 4.5, got ? 0xfff0c0 : 0xb8b0d0, { oy: 0.5, alpha: a });
      const lines = wrapFlow(r.text, body.x + body.w - (nx + nw + 5), body.w - 20);
      lines.forEach((l, j) => l && texts.text(l, j === 0 ? nx + nw + 5 : nx, y + 4.5 + j * 8, got ? 0xd8d0f0 : DIM_TXT, { oy: 0.5, alpha: a }));
      if (got) pix(kit.gOver, 'check', body.x + body.w - 8, y);
      y += Math.max(ROW, lines.length * 8 + 1);
    });
  }

  /** Mastery: four goals with this hero, each unlocking something for everyone (done ones checked and gold). */
  private drawMastery(g: G, body: Rect, ms: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const list = masteryOf(kit.profile, this.view);
    let y = body.y;
    const bottom = body.y + body.h;
    const goalW = Math.max(...list.map((m) => textWidth(m.def.text, 1, false))) + 6;
    list.forEach((m, i) => {
      const ik = clamp01((ms - i * 40) / 140);
      if (ik <= 0 || y + 8 > bottom + 2) return;
      const box = { x: body.x, y, w: 9, h: 9 };
      rows(g, box.x, box.y, box.w, box.h, 2, INK, ik);
      rows(g, box.x + 1, box.y + 1, box.w - 2, box.h - 2, 1, m.done ? 0x3a9a3a : NAVY[2], ik);
      if (m.done) pix(kit.gOver, 'check', box.x, box.y + 1, ik);
      const gx = body.x + 13;
      texts.text(m.def.text, gx, y + 4.5, m.done ? 0xd8f0c0 : 0xd8d0f0, { oy: 0.5, alpha: ik });
      const ax = gx + goalW;
      chevron(g, ax, y + 1, 7, m.done ? GREEN : NAVY[7], ik, 1, true);
      const rx = ax + 8;
      const lines = wrapText(m.def.rewardText, body.x + body.w - rx);
      lines.forEach((l, j) => texts.text(l, rx, y + 4.5 + j * 8, m.done ? GOLD_TXT : 0xc8b8e8, { bold: m.done, oy: 0.5, alpha: ik }));
      y += Math.max(ROW + 1, lines.length * 8 + 2);
    });
  }
}
