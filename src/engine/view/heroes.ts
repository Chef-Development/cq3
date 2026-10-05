// The hero select (a camp screen: tap the hero chip at the top left, or a hero by the fire). A tab per hero along
// the top (the picked one wears a gold check, a locked one a padlock); the card below shows the hero: their card art
// in a gold frame, name, family (Blade / Twin), title and bio, level and XP, and their kit (ability, passive,
// finisher) with the numbers filled in. "Pick" makes them the hero who fights (and earns the XP); "Stats" opens
// their stats. Before Sable joins, their card is a dark silhouette: "Clear Act 1". Gear is shared by every hero.
import type Phaser from 'phaser';
import { HEROES, type HeroId, type KitPart } from '../../data/heroes';
import { selectHero } from '../../core/profile';
import type { Tuning } from '../../core/tuning';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GOLD_TXT, GREEN, pix, pixSize } from './camp-kit';
import { padlock, wrapText } from './items';
import { glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeBack, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;

/** A kit part's text with its tuning number filled in. */
export function kitText(t: Tuning, id: HeroId, which: 'ability' | 'passive' | 'finisher'): string {
  const part = HEROES[id][which];
  if (!part) return '';
  const n = id === 'rowan' ? (which === 'ability' ? t.hero.abilityCritBonus * 100 : 0) : which === 'ability' ? t.sable.shadowSec : which === 'passive' ? t.sable.ambidextrous * 100 : 0;
  return part.text.replace('{n}', `${Math.round(n * 100) / 100}`);
}

const KIT: Array<{ which: 'ability' | 'passive' | 'finisher'; label: string; face: readonly [number, number, number, number]; name: number }> = [
  { which: 'ability', label: 'Ability', face: [0xb4f070, 0x3a9a3a, 0x2e7a30, 0x1a5a26], name: 0xb4f070 },
  { which: 'passive', label: 'Passive', face: [0x9ad8ff, 0x2a62c8, 0x22489c, 0x1a3070], name: 0x9ad8ff },
  { which: 'finisher', label: 'Finisher', face: [0xfff0a0, 0xc88a1c, 0x9a5a14, 0x5a3410], name: 0xffe680 },
];

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

export class HeroesScreen {
  view: HeroId = 'rowan';
  private openAt = 0;
  private viewAt = 0;
  private pickAt = -1e9;
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: HeroId): void {
    this.view = id ?? this.kit.profile.hero;
    this.openAt = now;
    this.viewAt = now;
  }

  // ------------------------------------------------------------------ layout

  private unlocked(id: HeroId): boolean {
    return !!this.kit.profile.heroes[id]?.unlocked;
  }

  private tabs() {
    return this.kit.heroTabs(true);
  }

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 20, w: s.R - s.L - 6, h: s.B - 23 };
  }

  private frame(): Rect {
    const c = this.card();
    return { x: c.x + 5, y: c.y + 4, w: 44, h: 52 };
  }

  private buttons(): { stats: Rect; pick: Rect } {
    const c = this.card();
    const picked = this.kit.profile.hero === this.view;
    const pw = (picked ? textWidth('Picked', 1, true) + pixSize('check')[0] + 2 : !this.unlocked(this.view) ? textWidth('Locked', 1, true) + 9 : textWidth('Pick', 1, true)) + 14;
    const sw = textWidth('Stats', 1, true) + pixSize('stats')[0] + 14;
    const pick = { x: c.x + c.w - 6 - pw, y: c.y + 6, w: pw, h: 14 };
    return { pick, stats: { x: pick.x - 4 - sw, y: pick.y, w: sw, h: 14 } };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | 'stats' | void {
    const kit = this.kit;
    const app = kit.app;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (const { id, r } of this.tabs()) {
      if (!inRect(r, x, y, 2)) continue;
      notePress(r);
      if (this.view !== id) {
        this.view = id;
        this.viewAt = now;
        kit.fadeToast();
        app.audio.uiClick();
      }
      return;
    }
    const b = this.buttons();
    if (inRect(b.stats, x, y, 2) && this.unlocked(this.view)) {
      notePress(b.stats);
      return 'stats';
    }
    if (inRect(b.pick, x, y, 2)) {
      notePress(b.pick);
      return this.pick(now);
    }
    // tapping the art: a little hop
    if (inRect(this.frame(), x, y, 2)) {
      if (!this.unlocked(this.view)) return this.refuse(now);
      this.pickAt = now - 200;
      app.audio.textBlip();
    }
  }

  private refuse(now: number): void {
    this.shakeAt = now;
    this.kit.app.audio.lockToggle();
    const f = this.frame();
    this.kit.fx.float('Clear Act 1!', f.x + f.w / 2, f.y + 10, 0xffb0a0, { life: 1200 });
  }

  private pick(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.view;
    if (!this.unlocked(id)) return this.refuse(now);
    if (p.hero === id) {
      kit.app.audio.uiClick();
      const b = this.buttons().pick;
      kit.fx.float('Already picked', b.x + b.w / 2, b.y + b.h + 8, 0xd8d0f0, { life: 1000 });
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
    const s = kit.s;
    kit.drawBack(g, now);
    // the hero tabs name the screen; top right, the shared-gear note (right of the top bar's HTML buttons)
    kit.drawHeroTabs(g, this.tabs(), this.view, now);
    const z = kit.hudZone();
    const note = ['Gear is shared by all', 'Gear is shared', 'Shared gear'].find((n) => textWidth(n, 1, false) + 11 <= s.R - 4 - (z.x + z.w));
    if (note) {
      const nw = textWidth(note, 1, false);
      pix(g, 'bag', s.R - 4 - nw - 12, 4);
      kit.texts.text(note, s.R - 4, 9.5, 0xc8c0e8, { ox: 1, oy: 0.5 });
    }
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const c0 = this.card();
    const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
    kit.pane(g, c, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    if (this.unlocked(this.view)) this.drawHero(g, c, now);
    else this.drawLocked(g, c, now);
  }

  /** The art in its gold frame (a hop when picked); `dark` draws it as a silhouette. */
  private drawArt(g: G, now: number, dark: boolean): void {
    const kit = this.kit;
    const id = this.view;
    const sh = now - this.shakeAt;
    const dx = sh < 300 ? Math.round(Math.sin(sh / 20) * 2 * (1 - sh / 300)) : 0;
    const f0 = this.frame();
    const f = { ...f0, x: f0.x + dx };
    const picked = kit.profile.hero === id && !dark;
    if (picked) glow(g, f, 0xffd23a, 0.3 + 0.25 * pulse(now, 1100), 3);
    // gold frame
    rows(g, f.x - 1, f.y + 2, f.w + 2, f.h + 1, 3, INK, 0.5);
    rows(g, f.x - 1, f.y - 1, f.w + 2, f.h + 2, 3, INK);
    rows(g, f.x, f.y, f.w, f.h, 2, dark ? 0x4a4058 : GOLD[2]);
    g.fillStyle(dark ? 0x6a6078 : GOLD[4], 1);
    g.fillRect(f.x + 2, f.y, f.w - 4, 1);
    g.fillStyle(dark ? 0x2a2438 : GOLD[0], 1);
    g.fillRect(f.x + 2, f.y + f.h - 1, f.w - 4, 1);
    // a backdrop in the family's colors
    const twin = HEROES[id].family === 'twin';
    const [top, bot] = dark ? [0x1e1830, 0x0e0a18] : twin ? [0x5a3a8a, 0x1e1236] : [0x3a6aa8, 0x1a2c52];
    rows(g, f.x + 2, f.y + 2, f.w - 4, f.h - 4, 1, INK);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(mix(top, bot, i / 5), 1);
      g.fillRect(f.x + 3, f.y + 3 + i * 8, f.w - 6, Math.min(8, f.h - 6 - i * 8));
    }
    g.fillStyle(WHITE, dark ? 0.03 : 0.08);
    g.fillCircle(f.x + f.w / 2, f.y + f.h / 2 - 4, 16);
    // the art (a hop when just picked)
    const pk = now - this.pickAt;
    const hop = pk >= 0 && pk < 380 ? Math.round(Math.sin((pk / 380) * Math.PI) * 4) : 0;
    const art = kit.heroArt(id);
    const [w, h] = kit.imgs.size(art.key);
    const ax = f.x + Math.round((f.w - w) / 2);
    const ay = f.y + f.h - 2 - Math.min(h, f.h - 4) - hop;
    const cropH = Math.min(h, f.h - 4 + hop);
    kit.sprites.draw(art.key, ax, ay, D.icons, { crop: [0, 0, w, cropH], tint: dark ? 0x3a3058 : art.shadow ? 0x3a2c58 : undefined, alpha: dark ? 0.9 : 1 });
    if (dark) kit.texts.text('?', f.x + f.w / 2, f.y + f.h / 2, 0x8a7cc0, { bold: true, scale: 2, ox: 0.5, oy: 0.5 });
    // corner studs
    g.fillStyle(dark ? 0x8a80a0 : GOLD[4], 1);
    g.fillRect(f.x + 1, f.y + 1, 1, 1);
    g.fillRect(f.x + f.w - 2, f.y + 1, 1, 1);
  }

  private drawHero(g: G, c: Rect, now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const p = kit.profile;
    const texts = kit.texts;
    const id = this.view;
    const def = HEROES[id];
    const vk = clamp01((now - this.viewAt) / 180);
    const a = vk;
    this.drawArt(g, now, false);
    const f = this.frame();
    const tx = f.x + f.w + 6;
    const tw = c.x + c.w - 6 - tx;
    // the name, big; Stats and Pick on the right
    texts.text(def.name, tx, c.y + 12, WHITE, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: NAVY[1], alpha: a });
    const b = this.buttons();
    const picked = p.hero === id;
    kit.button(g, texts, b.stats, 'Stats', FACE.purple, now, { icon: 'stats' });
    if (picked) kit.button(g, texts, b.pick, 'Picked', FACE.gold, now, { icon: 'check' });
    else kit.button(g, texts, b.pick, 'Pick', FACE.green, now, { glowCol: 0x8af06a });
    // family and title
    let y = c.y + 27;
    const cw = kit.familyChip(g, texts, def.family, tx, y, a);
    texts.text(def.title, tx + cw + 5, y, 0xffd890, { oy: 0.5, alpha: a });
    // the bio (two lines at most)
    y += 10;
    for (const line of wrapText(def.bio, tw).slice(0, 2)) {
      texts.text(line, tx, y, 0xc8c0e8, { oy: 0.5, alpha: a });
      y += 8;
    }
    // level and XP, and points to spend
    const L = kit.level(id);
    // the XP row needs "Lv n", a bar of 30 px and "into/need XP": the pill says "n points" when "n skill points" crowds it
    const xpNeed = textWidth(`Lv ${L.level}`, 1, true) + 38 + textWidth(L.need ? `${L.into}/${L.need} XP` : 'Max level', 1, false);
    const s = L.points > 1 ? 's' : '';
    const long = `${L.points} skill point${s}`;
    const pts = L.points <= 0 ? '' : tw - (textWidth(long, 1, false) + 22) >= xpNeed ? long : `${L.points} point${s}`;
    const pw = pts ? textWidth(pts, 1, false) + 16 : 0;
    const xr = { x: tx, y: c.y + 48, w: Math.min(150, tw - (pw ? pw + 6 : 0)), h: 9 };
    kit.xpBar(g, texts, id, xr, { alpha: a });
    if (pts) {
      const r = { x: c.x + c.w - 6 - pw, y: xr.y - 1, w: pw, h: 10 };
      glow(g, r, 0xffd23a, 0.2 + 0.3 * pulse(now, 1000), 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]]);
      pix(g, 'skills', r.x + 1, r.y);
      texts.text(pts, r.x + 13, r.y + 5, 0x5a2a08, { oy: 0.5 });
    }
    // the kit: a chip, the name, the text flowing after it
    const kx = c.x + 6;
    const kw = c.w - 12;
    y = f.y + f.h + 3;
    kit.divider(g, kx, y, kw);
    y += 6;
    const parts = KIT.filter((q) => def[q.which]);
    parts.forEach((q, i) => {
      const part = def[q.which] as KitPart;
      const ik = clamp01((now - this.viewAt - 60 - i * 60) / 160);
      if (ik <= 0) return;
      const ia = ik;
      const lw = textWidth(q.label, 1, false) + 6;
      const chip = { x: kx + Math.round((1 - ik) * 8), y: y - 4, w: lw, h: 9 };
      tag(g, chip, q.face, ia);
      texts.text(q.label, chip.x + 3, y + 0.5, WHITE, { oy: 0.5, alpha: ia });
      const nx = chip.x + lw + 4;
      texts.text(part.name, nx, y, q.name, { bold: true, oy: 0.5, alpha: ia });
      const ex = nx + textWidth(part.name, 1, true) + 4;
      const lines = wrapFlow(kitText(t, id, q.which), kx + kw - ex, kw);
      lines.forEach((l, j) => {
        if (l) texts.text(l, j ? kx : ex, y + j * 8, 0xe8e0ff, { oy: 0.5, alpha: ia });
      });
      y += lines.length * 8 + 2;
    });
    // the skills learned, as icons (when the card has room under the kit)
    const learned = p.heroes[id]?.skills ?? [];
    if (y + 12 <= c.y + c.h - 5) {
      y += 4;
      kit.divider(g, kx, y - 6, kw);
      texts.text('Skills', kx, y, 0xc8c0e8, { bold: true, oy: 0.5, alpha: a });
      let x = kx + textWidth('Skills', 1, true) + 5;
      if (!learned.length) texts.text(L.points ? 'none yet: tap Skills at the camp' : 'none yet', x, y, DIM_TXT, { oy: 0.5, alpha: a });
      for (const sid of learned) {
        if (x + 13 > kx + kw) break;
        if (kit.has(`skill_${sid}`)) kit.sprites.draw(`skill_${sid}`, x, y - 6, D.icons, { alpha: a });
        x += 14;
      }
    }
  }

  /** Sable before they join: a silhouette, and how to meet them. */
  private drawLocked(g: G, c: Rect, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    this.drawArt(g, now, true);
    const f = this.frame();
    const tx = f.x + f.w + 6;
    texts.text('???', tx, c.y + 12, 0x8a80a8, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: NAVY[1] });
    const b = this.buttons();
    kit.button(g, texts, b.pick, 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
    padlock(kit.gOver, b.pick.x + 4, b.pick.y + 4, 1, 0xd8901c);
    for (const [i, l] of wrapText('Someone is watching the camp from the trees.', c.x + c.w - 6 - tx).slice(0, 2).entries()) texts.text(l, tx, c.y + 29 + i * 8, 0xa8a0c8, { oy: 0.5 });
    // the lock: a dark well with a padlock and "Clear Act 1"
    const w = { x: c.x + 6, y: f.y + f.h + 5, w: c.w - 12, h: c.y + c.h - 6 - (f.y + f.h + 5) };
    rows(g, w.x, w.y, w.w, w.h, 2, NAVY[1]);
    g.fillStyle(INK, 1);
    g.fillRect(w.x + 2, w.y, w.w - 4, 1);
    const cy = w.y + w.h / 2;
    const msg = 'Clear Act 1';
    const mw = textWidth(msg, 2, true);
    const [lw, lh] = kit.imgs.size('padlock');
    const x0 = Math.round(w.x + w.w / 2 - (mw + lw + 6) / 2);
    kit.imgs.at('padlock', x0, Math.round(cy - 6 - lh / 2), D.icons);
    texts.text(msg, x0 + lw + 6, cy - 6, GOLD_TXT, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: 0x7a3a0a, alpha: 0.75 + 0.25 * pulse(now, 1200) });
    texts.text('to meet a new hero', w.x + w.w / 2, cy + 9, 0xc8c0e8, { ox: 0.5, oy: 0.5 });
  }
}
