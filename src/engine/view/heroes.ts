// The hero select (a camp screen: tap the hero chip at the top left, or a hero by the fire). All eight heroes, one at
// a time (docs/ui-style.md, "Hero select"):
//   the stage (left)   the hero full-body at 3x in their fight idle frames, breathing, on a lit stage disc in a
//                      backdrop themed by their style (art-ui-stage.ts), their rarity's aura behind them. Big arrows
//                      either side and a horizontal swipe on the stage page through the heroes: the hero slides out,
//                      the next hops in and lands in a puff of dust. A hero not met yet is a dark silhouette with a
//                      "?" on a dim stage.
//   the top bar        Back, then the strip of faces (each in its rarity's colours; dark for one not met yet) for
//                      quick jumps.
//   the column (right) the name (bold 2) and title; rarity and style chips; the stars (five, a shard meter under
//                      them) and the four mastery seals; the level and its XP meter (or, not met yet, how they're
//                      found); the kit as four icon cards (signature, green ability, passive, finisher); Stats,
//                      Skills (a gold "!" with points to spend) and the big Pick ("Picked" in gold; "Locked" shakes).
// Details live behind a tap, in a Sheet: a kit card (its full line with the numbers, what it does to the bar), the
// stars (what each gives, the shards), the seals (each goal and what it unlocks for everyone), the level (XP, points)
// and the name or chips (the bio, the style's rule, the soft strength). Gear is shared by every hero.
import type Phaser from 'phaser';
import { HERO_IDS, HEROES, type HeroId, type KitPart } from '../../data/heroes';
import { TIER_INFO } from '../../data/rarity';
import { STYLES } from '../../data/styles';
import type { FoeTag } from '../../data/types';
import { kitText, styleText } from '../../core/heroes';
import { masteryOf } from '../../core/meta';
import { selectHero } from '../../core/profile';
import { heroOwned, shardsToNext } from '../../core/roster';
import { HERO_FEET_X, HERO_H, HERO_W } from '../art';
import { ensureStage, STAGE_THEMES } from '../art-ui-stage';
import { textWidth } from '../font';
import { CampKit, D, GOLD_TXT, GREEN, pix, pixSize, STYLE_LOOK } from './camp-kit';
import { padlock } from './items';
import { gauge, glow, GOLD, NAVY } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, tag } from './ui';
import { aura, bigButton, drawStage, enterK, fillEllipse, glass, iconCard, liftDim, pageArrow, pips, pixMap, popK, Sheet, type Face, type SheetLine } from './ui-modern';

type G = Phaser.GameObjects.Graphics;

export { kitText };

type KitWhich = 'signature' | 'ability' | 'passive' | 'finisher';
/** The kit's four cards: a frame, an emblem, the one-word label, the long name the sheet gives it. */
const KIT: Array<{ which: KitWhich; face: Face; name: number; label: string; long: string; map: string[]; pal: Record<string, number> }> = [
  {
    which: 'signature',
    face: [0xffc8f0, 0xb84a9a, 0x8a3478, 0x5a1a4a],
    name: 0xffb8e8,
    label: 'Special',
    long: 'Signature move',
    map: ['...W...', '...P...', '..PWP..', 'WPWWWPW', '..PWP..', '...P...', '...W...'],
    pal: { W: 0xfff4fc, P: 0xff7ad8 },
  },
  {
    which: 'ability',
    face: [0xb4f070, 0x3a9a3a, 0x2e7a30, 0x1a5a26],
    name: 0xb4f070,
    label: 'Green',
    long: 'Green hits',
    map: ['hhhhb', 'hWbbl', 'hbbbl', 'hbbbl', 'hbbbl', 'hbbbl', 'bllll'],
    pal: { h: 0xa8f590, W: WHITE, b: 0x4ccf4a, l: 0x2a9a3a },
  },
  {
    which: 'passive',
    face: [0x9ad8ff, 0x2a62c8, 0x22489c, 0x1a3070],
    name: 0x9ad8ff,
    label: 'Trait',
    long: 'Always on',
    map: ['..lll..', '.lWllb.', 'lWlllbb', 'bllllbd', '.bllbd.', '..bbd..', '...d...'],
    pal: { l: 0x9ad8ff, W: WHITE, b: 0x3a8ae8, d: 0x1a3c8a },
  },
  {
    which: 'finisher',
    face: [0xfff0a0, 0xc88a1c, 0x9a5a14, 0x5a3410],
    name: 0xffe680,
    label: 'Swipe',
    long: 'Finisher (swipe)',
    map: ['...yW', '..yy.', '.yy..', 'yyyyy', '..yy.', '.yy..', 'yy...'],
    pal: { y: 0xffd23a, W: 0xfff0a0 },
  },
];

/** The four mastery seals' emblems (by goal kind): an arrow (a level), a flag (acts cleared), a crown (a boss). */
const SEAL: Record<'level' | 'acts' | 'boss', string[]> = {
  level: ['..w..', '.www.', 'wwwww', '..w..', '..w..'],
  acts: ['wfff.', 'wfff.', 'wff..', 'w....', 'w....'],
  boss: ['w.w.w', 'wwwww', 'wwwww', '.....', 'wwwww'],
};

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
  fire: 'Fire foes',
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

/** The hero sprite's scale on the stage (whole numbers keep the pixels crisp). */
export const STAGE_SCALE = 3;
/** Paging: the old hero slides out in OUT_MS, the new one hops in and lands at IN_MS (a puff of dust). */
const OUT_MS = 170;
const IN_MS = 280;
/** A press on the stage that moves more than this is a swipe (as the world map's drag). */
const DRAG_PX = 4;
/** A swipe pages when it went this far (or was a quick flick). */
const SWIPE_PX = 22;

/** Each hero frame's figure (its opaque columns and top row), read once from the texture. */
const FIGURE = new Map<string, { x0: number; x1: number; y0: number }>();

type SheetKind = KitWhich | 'stars' | 'mastery' | 'level' | 'info';

export class HeroesScreen {
  view: HeroId = 'rowan';
  private openAt = 0;
  private viewAt = 0;
  /** The hero sliding out, the way the page turned, where the old one was when it let go (a swipe's offset). */
  private prev: HeroId | null = null;
  private dir = 0;
  private prevFrom = 0;
  private pickAt = -1e9;
  private shakeAt = -1e9;
  private hopAt = -1e9;
  /** A press on the stage (it becomes a swipe once it moves), and a swipe let go short (it snaps back). */
  private press: { x: number; y: number; at: number; drag: boolean } | null = null;
  private dragDx = 0;
  private snap = { at: -1e9, from: 0 };
  readonly sheet = new Sheet();
  sheetKind: SheetKind | null = null;

  constructor(private readonly kit: CampKit) {}

  open(now: number, id?: HeroId): void {
    this.view = id ?? this.kit.profile.hero;
    this.openAt = now;
    this.viewAt = now;
    this.prev = null;
    this.dir = 0;
    this.press = null;
    this.dragDx = 0;
    this.sheet.close(now - 1000);
    this.sheetKind = null;
  }

  // ------------------------------------------------------------------ layout

  private owned(id: HeroId): boolean {
    return heroOwned(this.kit.profile, id);
  }

  /** The strip of faces in the top bar, after Back (one per hero, in order). */
  private strip(): Array<{ id: HeroId; r: Rect; locked: boolean }> {
    const kit = this.kit;
    const b = kit.backRect();
    const x0 = b.x + b.w + 4;
    const ws = HERO_IDS.map(() => 15);
    const rs = kit.topRow(ws, x0, kit.s.R - 3, 2) ?? kit.topRow(ws, x0, 1e9, 2)!;
    return HERO_IDS.map((id, i) => ({ id, r: rs[i], locked: !this.owned(id) }));
  }

  /** The faces in the top bar (the tips point at them). */
  tabs(): Array<{ id: HeroId; r: Rect; locked: boolean }> {
    return this.strip();
  }

  /** The stage: the left part of the screen under the top bar, where the hero stands (and swipes page). */
  stage(): Rect {
    const s = this.kit.s;
    const w = Math.round((s.R - s.L) * 0.46);
    return { x: s.L, y: 19, w, h: s.B - 19 };
  }

  /** The stage disc's top, where the hero's feet are. */
  private floorY(): number {
    return this.kit.s.B - 14;
  }

  /** Where hero `id` stands: their figure centred on the stage (the disc under their feet). */
  private footX(id: HeroId): number {
    const st = this.stage();
    const f = this.figure(id);
    const mid = (f.x0 + f.x1 + 1) / 2;
    const shift = Math.max(-16, Math.min(16, Math.round((HERO_FEET_X + 0.5 - mid) * STAGE_SCALE)));
    return st.x + Math.round(st.w / 2) + shift;
  }

  /** The big arrows either side of the stage, at the hero's knees. */
  arrows(): { prev: Rect; next: Rect } {
    const st = this.stage();
    const y = this.floorY() - 36;
    return { prev: { x: st.x + 3, y, w: 15, h: 24 }, next: { x: st.x + st.w - 18, y, w: 15, h: 24 } };
  }

  /** The column right of the stage. */
  private col(): { x: number; w: number } {
    const st = this.stage();
    const x = st.x + st.w + 4;
    return { x, w: this.kit.s.R - 3 - x };
  }

  /** The column's rows, top to bottom: the name, the chips, the stars and seals, the level, the kit, the buttons. */
  private rowY(): { name: number; chips: number; meters: number; level: number; cards: number; act: number } {
    const s = this.kit.s;
    const act = s.B - 3 - 18;
    const cards = act - 4 - 11 - 22;
    const chips = 45;
    // the stars and the level share what's left between the chips and the cards
    const free = cards - 50 - 14 - 10;
    const gap = Math.max(3, Math.floor(free / 3));
    const meters = 50 + gap;
    return { name: 27, chips, meters, level: meters + 14 + gap, cards, act };
  }

  /** Stats, Skills and Pick along the column's foot (Pick the biggest, at the right). */
  buttons(): { pick: Rect; skills: Rect; stats: Rect } {
    const c = this.col();
    const y = this.rowY().act;
    const stats = { x: c.x, y, w: 19, h: 18 };
    const sw = textWidth('Skills', 1, true) + pixSize('skills')[0] + 12;
    const skills = { x: stats.x + stats.w + 4, y, w: sw, h: 18 };
    // a hero not met yet has only "Locked", the column's width
    const px = this.owned(this.view) ? skills.x + skills.w + 4 : c.x;
    return { pick: { x: px, y, w: c.x + c.w - px, h: 18 }, skills, stats };
  }

  /** The four kit cards. */
  kitCards(): Array<{ which: KitWhich; r: Rect }> {
    const c = this.col();
    const y = this.rowY().cards;
    const w = 32;
    const gap = Math.floor((c.w - 4 * w) / 3);
    return KIT.map((q, i) => ({ which: q.which, r: { x: c.x + i * (w + gap), y, w, h: 22 } }));
  }

  /** The stars (and their shard meter), and the mastery seals, on one row. */
  private starsRect(): Rect {
    const c = this.col();
    return { x: c.x, y: this.rowY().meters, w: 5 * 11 + 4 * 2, h: 14 };
  }

  private sealsRect(): Rect {
    const c = this.col();
    const w = 4 * 13 + 3 * 2;
    return { x: c.x + c.w - w, y: this.rowY().meters, w, h: 13 };
  }

  private levelRect(): Rect {
    const c = this.col();
    return { x: c.x, y: this.rowY().level, w: c.w, h: 10 };
  }

  /** The name, the title and the chips (a tap: who they are, the style's rule, their strength). */
  private infoRect(): Rect {
    const c = this.col();
    return { x: c.x, y: 17, w: c.w, h: this.rowY().chips + 5 - 17 };
  }

  /** Where the hero's figure is on the stage (taps on it: a hop). */
  private heroRect(): Rect {
    const f = this.figure(this.view);
    const x = this.footX(this.view) - HERO_FEET_X * STAGE_SCALE;
    const top = this.floorY() + 1 - (HERO_H - 1) * STAGE_SCALE;
    return { x: x + f.x0 * STAGE_SCALE, y: top + f.y0 * STAGE_SCALE, w: (f.x1 - f.x0 + 1) * STAGE_SCALE, h: (HERO_H - 1 - f.y0) * STAGE_SCALE };
  }

  private sheetArea(): Rect {
    const c = this.col();
    const s = this.kit.s;
    return { x: c.x - 2, y: 20, w: c.w + 2, h: s.B - 3 - 20 };
  }

  // ------------------------------------------------------------------ the hero's art

  private artKey(id: HeroId, frame: string): string {
    const key = `${HEROES[id].art}_${frame}`;
    return this.kit.has(key) ? key : `hero_${frame}`;
  }

  /** The figure inside the hero box (its opaque columns, its top row), read once from the idle frame. */
  private figure(id: HeroId): { x0: number; x1: number; y0: number } {
    const key = this.artKey(id, 'idle0');
    let f = FIGURE.get(key);
    if (f) return f;
    f = { x0: 11, x1: 45, y0: 12 };
    try {
      const src = this.kit.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      const ctx = src.getContext?.('2d');
      if (ctx) {
        const d = ctx.getImageData(0, 0, src.width, src.height).data;
        let x0 = src.width;
        let x1 = -1;
        let y0 = src.height;
        for (let y = 0; y < src.height; y++)
          for (let x = 0; x < src.width; x++)
            if (d[(y * src.width + x) * 4 + 3] > 0) {
              x0 = Math.min(x0, x);
              x1 = Math.max(x1, x);
              y0 = Math.min(y0, y);
            }
        if (x1 >= x0) f = { x0, x1, y0 };
      }
    } catch {
      /* the default box */
    }
    FIGURE.set(key, f);
    return f;
  }

  // ------------------------------------------------------------------ input

  /** A press on the stage might be a swipe: true takes it (judged when it's let go: a tap if it stayed put). */
  pressAt(x: number, y: number, now: number): boolean {
    if (this.sheet.open || !inRect(this.stage(), x, y)) return false;
    const a = this.arrows();
    if (inRect(a.prev, x, y, 3) || inRect(a.next, x, y, 3) || inRect(this.kit.backRect(), x, y, 3)) return false;
    this.press = { x, y, at: now, drag: false };
    return true;
  }

  /** The finger moves: past DRAG_PX it's a swipe, and the hero follows it sideways. */
  dragTo(x: number, y: number, now: number): void {
    const p = this.press;
    if (!p) return;
    if (!p.drag && Math.hypot(x - p.x, y - p.y) <= DRAG_PX) return;
    if (!p.drag) p.at = now;
    p.drag = true;
    const dx = x - p.x;
    // a little resistance past the swipe distance
    this.dragDx = Math.abs(dx) <= 40 ? dx : Math.sign(dx) * (40 + (Math.abs(dx) - 40) * 0.4);
  }

  /** Let go: a swipe far enough (or a flick) pages that way, a short one snaps back; true when it was a tap. */
  releaseAt(x: number, _y: number, now: number): boolean {
    const p = this.press;
    this.press = null;
    if (!p) return false;
    if (!p.drag) return true;
    const dx = x - p.x;
    const from = this.dragDx;
    this.dragDx = 0;
    const flick = Math.abs(dx) >= 10 && Math.abs(dx) / Math.max(1, now - p.at) > 0.12;
    if (Math.abs(dx) >= SWIPE_PX || flick) this.page(dx < 0 ? 1 : -1, now, from);
    else this.snap = { at: now, from };
    return false;
  }

  cancelPress(): void {
    if (this.press?.drag) this.snap = { at: performance.now(), from: this.dragDx };
    this.press = null;
    this.dragDx = 0;
  }

  /** The next (d = 1) or the previous hero (d = -1); `from`: where a swipe left the hero on view. */
  private page(d: number, now: number, from = 0): void {
    const i = HERO_IDS.indexOf(this.view);
    this.show(HERO_IDS[(i + d + HERO_IDS.length) % HERO_IDS.length], now, d, from);
  }

  tap(x: number, y: number, now: number): 'back' | 'stats' | 'skills' | void {
    const kit = this.kit;
    const app = kit.app;
    if (this.sheet.open) {
      // a tap anywhere closes the sheet (Back too goes back)
      this.sheet.tap(now);
      this.sheetKind = null;
      app.audio.panelClose();
      if (!(x < 0 || inRect(kit.backRect(), x, y, 3))) return;
    }
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (const { id, r } of this.strip()) {
      if (!inRect(r, x, y, 1)) continue;
      notePress(r);
      this.show(id, now);
      return;
    }
    const a = this.arrows();
    for (const [r, d] of [
      [a.prev, -1],
      [a.next, 1],
    ] as const) {
      if (!inRect(r, x, y, 3)) continue;
      notePress(r);
      this.page(d, now);
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
    for (const c of this.kitCards())
      if (inRect(c.r, x, y, 2) || inRect({ ...c.r, y: c.r.y + c.r.h, h: 11 }, x, y)) {
        notePress(c.r);
        return this.openSheet(c.which, now);
      }
    if (inRect(this.starsRect(), x, y, 3)) return this.openSheet('stars', now);
    if (inRect(this.sealsRect(), x, y, 3)) return this.openSheet('mastery', now);
    if (inRect(this.levelRect(), x, y, 3)) return owned ? this.openSheet('level', now) : this.refuse(now);
    if (inRect(this.infoRect(), x, y)) return this.openSheet('info', now);
    // tapping the hero: a hop (or a shake for one not met yet)
    if (inRect(this.heroRect(), x, y, 4)) {
      if (!owned) return this.refuse(now);
      this.hopAt = now;
      app.audio.textBlip();
      const r = this.heroRect();
      kit.fx.burst(r.x + r.w / 2, r.y + 10, [0xfff0a0, WHITE, TIER_HI(this.view)], 8, 0.6, { kind: 'star', g: 20, life: 500 });
    }
  }

  /** Page to hero `id` (`dir`: which way it turned, for the slide; `from`: a swipe's offset when it let go). */
  show(id: HeroId, now: number, dir = 0, from = 0): void {
    if (this.view === id) return;
    const kit = this.kit;
    const i0 = HERO_IDS.indexOf(this.view);
    this.prev = this.view;
    this.prevFrom = from;
    this.dir = dir || Math.sign(HERO_IDS.indexOf(id) - i0);
    this.view = id;
    this.viewAt = now;
    this.press = null;
    this.dragDx = 0;
    this.snap = { at: -1e9, from: 0 };
    if (this.sheet.open) this.sheet.close(now);
    this.sheetKind = null;
    kit.fadeToast();
    kit.app.audio.swish();
    // the landing: a puff of dust either side of their feet (and a soft thud)
    const at = now;
    kit.after(IN_MS, () => {
      if (this.viewAt !== at || kit.app.run.phase !== 'camp') return;
      const x = this.footX(id);
      const y = this.floorY() + 1;
      const dust = this.owned(id) ? [0xd8ccb0, 0xb0a48c, 0x8a7e6c, 0xece4d0] : [0x6a6478, 0x4a4458];
      kit.fx.burst(x - 10, y, dust, 7, 0.45, { kind: 'chip', up: 16, spread: 0.9, g: 220, life: 380 });
      kit.fx.burst(x + 10, y, dust, 7, 0.45, { kind: 'chip', up: 16, spread: 0.9, g: 220, life: 380 });
      kit.app.audio.footstep(1);
    });
  }

  private refuse(now: number): void {
    this.shakeAt = now;
    this.kit.app.audio.lockToggle();
    const r = this.heroRect();
    this.kit.fx.float(howFound(this.view), Math.max(this.kit.s.L + 50, r.x + r.w / 2), r.y - 4, 0xffd890, { life: 1400 });
  }

  private pick(now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const id = this.view;
    if (!this.owned(id)) return this.refuse(now);
    if (p.hero === id) {
      kit.app.audio.uiClick();
      const b = this.buttons().pick;
      kit.fx.float('Already picked', b.x + b.w / 2, b.y - 6, 0xd8d0f0, { life: 1000 });
      return;
    }
    if (!selectHero(p, id)) return;
    kit.commit();
    this.pickAt = now;
    this.hopAt = now;
    kit.app.audio.equip();
    for (let i = 0; i < 3; i++) kit.after(120 + i * 70, () => kit.app.audio.statUp(i));
    const r = this.heroRect();
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    kit.fx.ring(cx, cy, 34, 0xfff0a0, 520);
    kit.after(90, () => kit.fx.ring(cx, cy, 48, TIER_HI(id), 600));
    kit.fx.burst(cx, cy, [0xfff0a0, 0xffd23a, WHITE, GREEN, TIER_HI(id)], 30, 1.2, { kind: 'star', g: 30, life: 760 });
    kit.fx.burst(this.footX(id), this.floorY(), [0xfff0a0, 0xffd23a, WHITE], 14, 0.8, { up: 60, spread: 0.7, g: 160, life: 700 });
    const b = this.buttons().pick;
    kit.fx.flash(b, WHITE, 360);
    kit.fx.float('Fights next!', cx, r.y - 2, GREEN, { life: 1500 });
  }

  // ------------------------------------------------------------------ sheets

  private openSheet(kind: SheetKind, now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const id = this.view;
    const def = HEROES[id];
    const owned = this.owned(id);
    let title = '';
    let lines: SheetLine[] = [];
    let face: Face | undefined;
    const q = KIT.find((k) => k.which === kind);
    if (q) {
      const part = def[q.which];
      title = part.name;
      face = q.face;
      lines = [{ text: q.long, col: q.name, bold: true }, { text: kitText(t, id, q.which) }];
      if (q.which === 'finisher') lines.push({ text: `Bar: ${def.finisher.bar}`, col: GOLD_TXT, bold: true });
    } else if (kind === 'stars') {
      const prog = kit.profile.heroes[id];
      const stars = owned ? prog.stars : 0;
      const T = t.levels;
      title = 'Stars';
      face = [GOLD[4], GOLD[3], GOLD[2], GOLD[1]];
      const rowsDef: Array<[number, string]> = [
        [2, `+${Math.round(T.star2Atk * 100)}% attack`],
        [3, `${def.stars[0].name}: ${def.stars[0].text}`],
        [4, `+${Math.round(T.star4Hp * 100)}% max HP`],
        [5, `${def.stars[1].name}: ${def.stars[1].text}`],
      ];
      lines = rowsDef.map(([n, text]) => ({ text: `${n}: ${text}`, icon: stars >= n ? 'star_on' : 'star_off', col: stars >= n ? 0xfff0c0 : 0xb8b0d0, bold: stars >= n }));
      const need = owned ? shardsToNext(t, prog.stars) : null;
      lines.push({ text: owned && need !== null ? `Shards ${prog.shards}/${need}: dupes from chests` : owned ? 'All five stars!' : 'Dupes from chests give shards', col: 0xc8e0ff, icon: 'shard' });
    } else if (kind === 'mastery') {
      title = 'Mastery';
      face = [0xe0b8ff, 0x9050d8, 0x6a30a8, 0x40186a];
      lines = masteryOf(kit.profile, id).map((m) => ({ text: `${m.def.text}: ${m.def.rewardText}`, col: m.done ? GREEN : 0xe0d8f8, bold: m.done, icon: m.done ? 'check' : undefined }));
      lines.push({ text: 'Each one unlocks for everyone', col: 0xffd890 });
    } else if (kind === 'level') {
      const L = kit.level(id);
      title = `Lv ${L.level}`;
      face = [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a];
      lines = [
        { text: L.need ? `${L.into}/${L.need} XP to Lv ${L.level + 1}` : 'Max level', bold: true, col: 0xc8e0ff },
        { text: L.points > 0 ? `${L.points} skill point${L.points > 1 ? 's' : ''} to spend` : 'A skill point every 2 levels', col: L.points > 0 ? GOLD_TXT : 0xd8d0f0, bold: L.points > 0, icon: 'skills' },
        { text: 'Each hero levels up on their own', col: 0xb8b0d0 },
      ];
    } else {
      const st = STYLES[def.style];
      title = def.name;
      face = TIER_INFO_FACE(id);
      lines = [
        { text: def.title, col: 0xffd890, bold: true },
        { text: def.bio },
        { text: `${st.name}: ${st.rewards}`, col: STYLE_LOOK[def.style].face[0], bold: true, icon: STYLE_LOOK[def.style].icon },
        { text: `${st.rule.name}: ${styleText(t, id)}` },
      ];
      const s = strengthText(id);
      if (s) lines.push({ text: s, col: 0xb4f070, icon: 'sword' });
      if (!owned) lines.push({ text: howFound(id), col: GOLD_TXT, bold: true });
    }
    this.sheet.show(title, lines, now, face);
    this.sheetKind = kind;
    kit.app.audio.panelOpen();
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    liftDim(kit, (now - this.openAt) / 160);
    this.drawBackdrop(now);
    this.drawHeroes(now);
    // the arrows sit over the hero (on the layer above the sprites)
    const ak = enterK(now, this.openAt, 3);
    const a = this.arrows();
    pageArrow(kit.gOver, { ...a.prev, x: a.prev.x - Math.round((1 - ak) * 10) }, -1, now, ak);
    pageArrow(kit.gOver, { ...a.next, x: a.next.x + Math.round((1 - ak) * 10) }, 1, now, ak);
    kit.drawBack(g, now);
    this.drawStrip(g, now);
    this.drawColumn(now);
    this.sheet.draw(kit, this.sheetArea(), now);
  }

  /** The style's stage (the old one fading out after a page turn), its light on the disc, motes, the vignette. */
  private drawBackdrop(now: number): void {
    const kit = this.kit;
    const id = this.view;
    const owned = this.owned(id);
    const theme = HEROES[id].style;
    const fx = this.footX(id);
    const fy = this.floorY();
    const lock = owned ? 0 : 1;
    drawStage(kit, theme, now, { disc: { x: fx, y: fy, rx: 30 }, light: owned ? 1.15 : 0.35, alpha: enterK(now, this.openAt, 0, 0, 220), dim: lock * 0.42 });
    // a page turn: the last hero's stage fades out over the new one
    const k = clamp01((now - this.viewAt) / 260);
    if (this.prev && k < 1) {
      const key = ensureStage(kit.s, HEROES[this.prev].style);
      kit.imgs.at(key, 0, 0, D.ui - 0.0035, 1 - k);
    }
    // the hero's shadow on the disc
    fillEllipse(kit.gUi, fx, fy + 1, 17, 3, INK, 0.4);
  }

  /** The hero on view (and the one sliding out), their aura, the "?" over one not met yet. */
  private drawHeroes(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const t = now - this.viewAt;
    // the old hero slides out the way the page turned
    if (this.prev && t < OUT_MS) {
      const k = t / OUT_MS;
      const off = this.prevFrom + (-this.dir * 110 - this.prevFrom) * k * k;
      this.drawHero(this.prev, Math.round(off), 0, 1 - k * 0.6, now);
    }
    const id = this.view;
    const owned = this.owned(id);
    // the new one hops in from the other side (or, opening the screen, rises onto the stage)
    let off = 0;
    let lift = 0;
    let alpha = 1;
    if (this.dir !== 0 && t < IN_MS) {
      const k = clamp01(t / IN_MS);
      off = Math.round(this.dir * 100 * (1 - easeOut3(k)));
      lift = Math.round(Math.sin(k * Math.PI) * 12);
      alpha = clamp01(k * 3);
    } else if (this.dir === 0) {
      const k = popK(now, this.openAt, 1, 40, 320);
      lift = -Math.round((1 - k) * 16);
      alpha = clamp01(k * 1.5);
    }
    if (this.press?.drag) {
      off += this.dragDx;
      alpha *= 1 - Math.min(0.5, Math.abs(this.dragDx) / 160);
    }
    const sk = (now - this.snap.at) / 240;
    if (sk >= 0 && sk < 1) off += Math.round(this.snap.from * (1 - easeBack(sk, 1.8)));
    // a hop when tapped or picked
    const hk = (now - this.hopAt) / 360;
    if (hk >= 0 && hk < 1) lift += Math.round(Math.sin(hk * Math.PI) * 8);
    // the shake of a refused tap
    const sh = now - this.shakeAt;
    if (sh < 300) off += Math.round(Math.sin(sh / 20) * 3 * (1 - sh / 300));
    // the aura breathes behind them (faint for one not met yet)
    const fx = this.footX(id);
    const fy = this.floorY();
    const top = fy - (HERO_H - 1 - this.figure(id).y0) * STAGE_SCALE;
    const ak = (this.dir === 0 ? popK(now, this.openAt, 2, 40, 360) : clamp01(t / IN_MS)) * (owned ? 1 : 0.35);
    if (ak > 0) aura(kit, g, fx + Math.round(off * 0.5), Math.round((top + fy) / 2) + 4, 40, Math.round((fy - top) / 2) + 10, HEROES[id].rarity, now, ak);
    this.drawHero(id, off, lift, alpha, now);
    if (!owned) {
      const qa = alpha * (0.65 + 0.35 * pulse(now, 1200));
      kit.texts.text('?', fx + off, Math.round((top + fy) / 2) - 2 - lift, 0xb8a8f0, { bold: true, scale: 3, ox: 0.5, oy: 0.5, alpha: qa });
    }
  }

  /** One hero at 3x with their feet on the disc (shifted `off` px, lifted `lift` px), kept inside the stage. */
  private drawHero(id: HeroId, off: number, lift: number, alpha: number, now: number): void {
    const kit = this.kit;
    const owned = this.owned(id);
    const S = STAGE_SCALE;
    // the two idle frames: breathing
    const key = this.artKey(id, Math.floor(now / 520) % 2 ? 'idle1' : 'idle0');
    const X = this.footX(id) + off - HERO_FEET_X * S;
    const Y = this.floorY() + 1 - (HERO_H - 1) * S - lift;
    // crop to the stage, so a hero sliding in or out never walks over the column
    const st = this.stage();
    const c0 = Math.max(0, Math.ceil((st.x - X) / S));
    const c1 = Math.min(HERO_W, Math.floor((st.x + st.w + 2 - X) / S));
    if (c1 - c0 <= 0) return;
    const crop: [number, number, number, number] = [c0, 0, c1 - c0, HERO_H];
    if (!owned) {
      // not met yet: a dark silhouette, its top and left edges rimmed by the stage's light
      const rim = STAGE_THEMES[HEROES[id].style]?.light ?? 0xc8c0e8;
      kit.sprites.draw(key, X + c0 * S - 1, Y - 2, D.icons - 0.001, { crop, scale: S, alpha: alpha * 0.55, fill: mix(rim, 0x6a5aa0, 0.35) });
      kit.sprites.draw(key, X + c0 * S, Y, D.icons, { crop, scale: S, alpha, fill: 0x120c22 });
      return;
    }
    kit.sprites.draw(key, X + c0 * S, Y, D.icons, { crop, scale: S, alpha });
  }

  /** The faces along the top (the one on view lifted and gold). */
  private drawStrip(g: G, now: number): void {
    const kit = this.kit;
    this.strip().forEach((t, i) => {
      const k = enterK(now, this.openAt, i, 25, 180);
      if (k <= 0) return;
      if (t.id === this.view) glow(g, t.r, 0xffd23a, 0.3 + 0.2 * pulse(now, 1000), 2);
      kit.faceTab(g, { ...t.r, y: t.r.y - Math.round((1 - k) * 6) }, t.id, t.id === this.view, t.locked, now);
    });
  }

  /** The column: name, chips, stars and seals, level, the kit, the buttons (each slides in, in turn). */
  private drawColumn(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const texts = kit.texts;
    const p = kit.profile;
    const id = this.view;
    const def = HEROES[id];
    const owned = this.owned(id);
    const c = this.col();
    const ry = this.rowY();
    const at = Math.max(this.openAt, this.viewAt);
    const kOf = (i: number) => enterK(now, at, i, 35, 200);
    const dxOf = (i: number) => Math.round((1 - easeOut3(kOf(i))) * 10 * (this.dir || 1));
    // a glass plate behind the hero's details
    const pk = enterK(now, this.openAt, 1, 0, 220);
    glass(g, { x: c.x - 4, y: 18, w: c.w + 6, h: ry.level + 14 - 18 }, { alpha: pk, rim: owned ? mix(TIER_HI(id), INK, 0.45) : undefined, clear: 0.3 });
    // the name (bold 2) and their title after it
    let k = kOf(0);
    let dx = dxOf(0);
    const name = def.name;
    const nameW = textWidth(name, 2, true);
    texts.text(name, c.x + dx, ry.name, owned ? WHITE : 0xa898c8, { bold: true, scale: 2, oy: 0.5, extrude: 1, extrudeCol: NAVY[1], alpha: k });
    const titleX = c.x + nameW + 5;
    if (titleX + textWidth(def.title, 1, false) <= c.x + c.w) texts.text(def.title, titleX + dx, ry.name + 3, owned ? 0xffd890 : 0x9a90b8, { oy: 0.5, alpha: k });
    // the rarity and the style
    k = kOf(1);
    dx = dxOf(1);
    let x = c.x + dx;
    x += kit.rarityTag(g, texts, def.rarity, x, ry.chips, k) + 4;
    this.styleChip(g, def.style, x, ry.chips, k);
    // the stars (and the shards toward the next one) and the mastery seals
    k = kOf(2);
    dx = dxOf(2);
    const prog = p.heroes[id];
    const sr = this.starsRect();
    const stars = owned ? prog.stars : 0;
    const spr = isPressed(sr, now) ? 1 : 0;
    pips(g, sr.x + dx, sr.y + spr, 5, stars, now, { kind: 'star', size: 11, gap: 2, alpha: k });
    if (owned) {
      const need = shardsToNext(kit.tuning, prog.stars);
      gauge(g, sr.x + dx + 1, sr.y + 12, sr.w - 2, 3, need === null ? 1 : prog.shards / need, 0, { ramp: [0xf0e0ff, 0xb48ae8, 0x7a3cb0, 0x4a2470] });
    }
    this.drawSeals(g, now, dx, k);
    // the level and its XP meter; not met yet: how they're found
    k = kOf(3);
    dx = dxOf(3);
    const lr = this.levelRect();
    if (owned) {
      const L = kit.level(id);
      const lv = `Lv ${L.level}`;
      const lw = textWidth(lv, 1, true);
      texts.text(lv, lr.x + dx, lr.y + 5, GOLD_TXT, { bold: true, oy: 0.5, alpha: k });
      const bx = lr.x + dx + lw + 4;
      gauge(g, bx, lr.y + 2, lr.x + lr.w - bx, 6, L.need ? L.into / L.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a], seg: 8, glow: L.points > 0 ? 0.25 + 0.25 * pulse(now, 1000) : 0 });
    } else {
      const msg = howFound(id);
      const w = textWidth(msg, 1, true) + 16;
      const r = { x: lr.x + dx, y: lr.y - 1, w: Math.min(w, lr.w), h: 12 };
      glow(g, r, GOLD[3], (0.2 + 0.25 * pulse(now, 1200)) * k, 2);
      tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[0]], k);
      padlock(kit.gOver, r.x + 3, r.y + 2, k, 0xfff0a0);
      texts.text(msg, r.x + 12, r.y + 6, 0x5a2a08, { bold: true, oy: 0.5, alpha: k });
    }
    // the kit: four cards
    const l = kit.layer();
    this.kitCards().forEach((card, i) => {
      const q = KIT[i];
      const ck = popK(now, this.openAt, 4 + i, 35, 240);
      if (ck <= 0) return;
      const on = this.sheet.open && this.sheetKind === q.which;
      iconCard(kit, l, { ...card.r, y: card.r.y + Math.round((1 - ck) * 6) }, { face: q.face, emblem: (gg, cx, cy, a) => pixMap(gg, q.map, q.pal, cx, cy, 2, a), label: q.label, labelCol: q.name, selected: on, alpha: clamp01(ck) }, now);
    });
    // Stats, Skills and Pick
    k = enterK(now, this.openAt, 8, 35, 200);
    const b = this.buttons();
    const lift = Math.round((1 - easeOut3(k)) * 8);
    const mv = (r: Rect) => ({ ...r, y: r.y + lift });
    if (owned) {
      const pts = kit.level(id).points;
      kit.button(g, texts, mv(b.stats), '', FACE.purple, now, { icon: 'stats', alpha: k });
      kit.button(g, texts, mv(b.skills), 'Skills', FACE.blue, now, { icon: 'skills', glowCol: pts > 0 ? 0xffd23a : undefined, alpha: k });
      if (pts > 0) kit.bubble(kit.gOver, texts, b.skills.x + b.skills.w - 2, b.skills.y - 2 + lift, '!', now, true);
      if (p.hero === id) {
        const pk2 = clamp01((now - this.pickAt) / 400);
        kit.button(g, texts, mv(b.pick), 'Picked', FACE.gold, now, { icon: 'check', glowCol: pk2 < 1 ? 0xfff0a0 : undefined, alpha: k });
      } else bigButton(kit, g, texts, mv(b.pick), 'Pick', FACE.green, now, { alpha: k });
    } else {
      bigButton(kit, g, texts, mv(b.pick), 'Locked', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt, alpha: k });
      const pw = textWidth('Locked', 1, true);
      padlock(kit.gOver, Math.round(b.pick.x + b.pick.w / 2 - pw / 2 - 11), b.pick.y + 5 + lift, k, 0xd8901c);
    }
  }

  /** A style chip in bold: its icon and name in the style's colours. */
  private styleChip(g: G, style: keyof typeof STYLE_LOOK, x: number, cy: number, alpha: number): number {
    const look = STYLE_LOOK[style];
    const label = STYLES[style].name;
    const [iw, ih] = pixSize(look.icon);
    const w = iw + 5 + textWidth(label, 1, true) + 4;
    const r = { x, y: Math.round(cy - 5), w, h: 10 };
    tag(g, r, look.face, alpha);
    pix(g, look.icon, r.x + 1, Math.round(cy - ih / 2), alpha);
    this.kit.texts.text(label, r.x + iw + 3, cy, WHITE, { bold: true, oy: 0.5, alpha });
    return w;
  }

  /** The four mastery goals as wax seals: lit gold when done (with their emblem), dark sockets when not. */
  private drawSeals(g: G, now: number, dx: number, alpha: number): void {
    const r = this.sealsRect();
    const list = masteryOf(this.kit.profile, this.view);
    const pr = isPressed(r, now) ? 1 : 0;
    list.slice(0, 4).forEach((m, i) => {
      const cx = r.x + dx + i * 15 + 6.5;
      const cy = r.y + 6.5 + pr;
      const kind = 'level' in m.def.goal ? 'level' : 'acts' in m.def.goal ? 'acts' : 'boss';
      if (m.done) {
        fillEllipse(g, cx, cy + 1, 7, 7, INK, alpha * 0.5);
        fillEllipse(g, cx, cy, 7, 7, INK, alpha);
        fillEllipse(g, cx, cy, 6, 6, 0xb83a3a, alpha);
        fillEllipse(g, cx - 0.5, cy - 0.5, 5, 5, 0xd85048, alpha);
        g.fillStyle(0xff9a80, alpha);
        g.fillRect(Math.round(cx - 3), Math.round(cy - 5), 3, 1);
        pixMap(this.kit.gOver, SEAL[kind], { w: 0xfff0c0, f: GOLD[3] }, cx, cy, 1, alpha, false);
      } else {
        const k = 0.5 + 0.2 * pulse(now, 1600, i * 300);
        fillEllipse(g, cx, cy, 7, 7, INK, alpha);
        fillEllipse(g, cx, cy, 6, 6, NAVY[2], alpha);
        fillEllipse(g, cx, cy + 1, 5, 5, NAVY[1], alpha);
        pixMap(this.kit.gOver, SEAL[kind], { w: mix(NAVY[4], 0x8a7cc0, k), f: NAVY[4] }, cx, cy, 1, alpha, false);
      }
    });
  }
}

/** A hero's rarity colours (its frame face), and their brightest. */
const TIER_INFO_FACE = (id: HeroId): Face => TIER_INFO[HEROES[id].rarity].face;
const TIER_HI = (id: HeroId): number => TIER_INFO[HEROES[id].rarity].face[0];
