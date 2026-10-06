// Shared pieces of the camp's screens (home, bag, forge, stats): the drawing layers and pools (all inside the camp's
// depth range 30.95-31.35), the camp's own juice (particles, rings, flying icons, floating numbers, flashes: the
// scene's effects draw under the camp), buttons, the purse and scrap counters that roll to their new values, the
// "before -> after" stat toast, and a few small pixel icons.
import type Phaser from 'phaser';
import { STAT_INFO, type StatId } from '../../data/gear';
import { HERO_IDS, HEROES, type HeroFamily, type HeroId } from '../../data/heroes';
import { heroStats, newHero, type Hero } from '../../core/combat';
import { fmtTotal, type StatBlock } from '../../core/gear';
import { levelProgress, pointsLeft } from '../../core/heroes';
import { heroProgress, profileBuild } from '../../core/profile';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { padlock } from './items';
import { button3d, chevron, gauge, glow, GOLD, hudIcon, iconSize, NAVY, panel, rows } from './pixels';
import { clamp01, easeBack, easeOut3, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, ribbon, RIBBON, tag, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

/** The camp's depths (it owns 30.95-31.35: over the maps, under the node screens, the overlays and the story box). */
export const D = {
  bg: 30.95,
  back: 30.952, // fire glow, smoke, far fireflies (behind the people)
  actors: 30.955,
  front: 30.958, // embers, sparks, name plates, the home bars
  homeText: 30.96,
  ui: 31.0, // a sub-screen: the dim, panels, cell frames, buttons
  icons: 31.02,
  over: 31.04, // marks over icons
  text: 31.06,
  top: 31.1, // popups, toasts
  topIcons: 31.12,
  topOver: 31.13,
  topText: 31.14,
  fx: 31.2,
  fxIcons: 31.22,
  fxText: 31.25,
} as const;

export const GREEN = 0x8af06a;
export const RED = 0xff6a5a;
export const GOLD_TXT = 0xffe680;
export const SCRAP_TXT = 0xcfe0f4;
export const DIM_TXT = 0xa8a0c8;

// ------------------------------------------------------------------ small pixel icons (outline added at build)

const K = 0x140c1c;
function outlined(r: string[]): string[] {
  const w = Math.max(...r.map((s) => s.length)) + 2;
  const at = (x: number, y: number) => {
    const c = r[y - 1]?.[x - 1];
    return c !== undefined && c !== '.' ? c : null;
  };
  const out: string[] = [];
  for (let y = 0; y < r.length + 2; y++) {
    let line = '';
    for (let x = 0; x < w; x++) line += at(x, y) ?? (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'k' : '.');
    out.push(line);
  }
  return out;
}

const PIX: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  bag: {
    rows: outlined(['.t...t.', '..tTt..', '..bBb..', '.bBWBb.', 'bBWBBBd', 'bBBBBBd', 'bBBBBdd', '.bdddd.']),
    pal: { k: K, t: 0xf2c230, T: 0x9a5a14, B: 0xc0905a, W: 0xe0bc84, b: 0x98663a, d: 0x6e4426 },
  },
  hammer: {
    rows: outlined(['SWWWSs', 'SSSSSs', '.ssss.', '..wd..', '..wd..', '..wd..', '..dd..']),
    pal: { k: K, S: 0xb8c2d8, W: 0xeef3fa, s: 0x6a7496, w: 0xd09a5e, d: 0x6e4020 },
  },
  stats: {
    rows: outlined(['.....Gg', '.....Gg', '..BbYGg', '..BbyGg', 'RrBbyGg', 'RrBbyGg']),
    pal: { k: K, R: 0xff7a62, r: 0xc02a2a, B: 0x9ad8ff, b: 0x2a6ad8, G: 0xfff0a0, g: 0xd8901c, Y: 0x9ad8ff, y: 0x2a6ad8 },
  },
  shrine: {
    rows: outlined(['..W..', '.WLl.', '.LLl.', 'WLLll', 'LLlll', '.Lll.', 'sssss']),
    pal: { k: K, W: 0xf0e0ff, L: 0xb48ae8, l: 0x6e3cb0, s: 0x7c86a6 },
  },
  sort: {
    rows: outlined(['.W...', 'WWW..', '.W.y.', '.W.y.', '..yyy', '...y.']),
    pal: { k: K, W: 0xeef3fa, y: 0xf2c230 },
  },
  swap: {
    rows: outlined(['...W..', 'WWWWW.', '...W..', '.y....', 'yyyyy.', '.y....']),
    pal: { k: K, W: 0xeef3fa, y: 0xf2c230 },
  },
  anvil: {
    rows: outlined(['SSWWWWWS.', 'sSSSSSSSs', '..sSSSs..', '...sSs...', '..ssSss..']),
    pal: { k: K, S: 0x7c86a6, W: 0xb8c2d8, s: 0x4a5272 },
  },
  dice: {
    rows: outlined(['WWWWW', 'WrWWW', 'WWWWW', 'WWWrW', 'sssss']),
    pal: { k: K, W: 0xeef3fa, r: 0xd03030, s: 0x9aa4c0 },
  },
  flame: {
    rows: outlined(['..r..', '.rr..', '.ryr.', 'ryyrr', 'rywyr', '.rwr.']),
    pal: { k: K, r: 0xe8441a, y: 0xff9a2a, w: 0xfff0a0 },
  },
  up: {
    rows: outlined(['..G..', '.GGG.', 'GGGGG', '..g..', '..g..']),
    pal: { k: K, G: 0xb4f070, g: 0x4cbf44 },
  },
  heartS: {
    rows: outlined(['.RR.RR.', 'RWRRRrR', 'RRRRRrR', '.RRRrR.', '..RrR..', '...R...']),
    pal: { k: K, R: 0xe2333c, W: 0xffb0a0, r: 0x9a1a22 },
  },
  // a knight's helm with a red plume (the hero select)
  heroes: {
    rows: outlined(['...rR..', '..rRr..', '.SWSSs.', 'SWSSSSs', 'SkkkkSs', 'SSSSSSs', '.SsSsS.']),
    pal: { k: K, r: 0xd03030, R: 0xff7a62, S: 0xb8c2d8, W: 0xeef3fa, s: 0x6a7496 },
  },
  // a gold star (the skill trees)
  skills: {
    rows: outlined(['...W...', '..WYY..', 'WWYYYYd', '.YYYYd.', '..YYd..', '.YYdYd.', '.Yd..d.']),
    pal: { k: K, W: 0xfff0a0, Y: 0xf2c230, d: 0xd8901c },
  },
  // an amulet: a gold chain and a purple gem (the relic log)
  relic: {
    rows: outlined(['c....c', '.c..c.', '..cc..', '.GWGg.', 'GWGGgg', '.GGgg.', '..gg..']),
    pal: { k: K, c: 0xf2c230, G: 0xa86ae0, W: 0xf0d8ff, g: 0x6e30a8 },
  },
  reset: {
    rows: outlined(['.WWW.y', 'W...yy', 'W..yyy', 'W.....', 'W....W', '.WWWW.']),
    pal: { k: K, W: 0xeef3fa, y: 0xf2c230 },
  },
  check: {
    rows: outlined(['.....G', '....GG', 'G..GG.', 'GGGG..', '.GG...']),
    pal: { k: K, G: 0xb4f070 },
  },
  // the families: Blade (one sword) and Twin (two daggers)
  blade: {
    rows: outlined(['....SW', '...SWS', '..SWS.', 'w.WS..', '.wW...', 'ww.w..']),
    pal: { k: K, S: 0xb8c2d8, W: 0xeef3fa, w: 0xd09a5e },
  },
  twin: {
    rows: outlined(['S....S', 'WS..SW', '.WSSW.', '..WW..', '.w..w.', 'w....w']),
    pal: { k: K, S: 0xb8c2d8, W: 0xeef3fa, w: 0xa86ae0 },
  },
  // a rule node's rune (a skill without its own icon yet)
  rune: {
    rows: outlined(['...P...', '..PWP..', '.PWPPp.', 'PPPPPpp', '.pPPpp.', '..ppp..', '...p...']),
    pal: { k: K, P: 0xa86ae0, W: 0xf0d8ff, p: 0x6e30a8 },
  },
};

const runCache = new Map<string, Array<[number, number, number, number]>>();
/** Draw one of the camp's small icons (or a HUD icon of the same name). */
export function pix(g: G, key: string, x: number, y: number, alpha = 1): void {
  const def = PIX[key];
  if (!def) return hudIcon(g, key, x, y, 1, alpha);
  let runs = runCache.get(key);
  if (!runs) {
    runs = [];
    def.rows.forEach((r, yy) => {
      for (let xx = 0; xx < r.length; ) {
        let n = 1;
        while (xx + n < r.length && r[xx + n] === r[xx]) n++;
        const col = def.pal[r[xx]];
        if (col !== undefined) runs!.push([col, xx, yy, n]);
        xx += n;
      }
    });
    runCache.set(key, runs);
  }
  for (const [col, rx, ry, rw] of runs) {
    g.fillStyle(col, alpha);
    g.fillRect(x + rx, y + ry, rw, 1);
  }
}

export function pixSize(key: string): [number, number] {
  const def = PIX[key];
  if (!def) return iconSize(key);
  return [Math.max(...def.rows.map((r) => r.length)), def.rows.length];
}

// ------------------------------------------------------------------ juice

interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  born: number;
  life: number;
  color: number;
  kind: 'px' | 'chip' | 'spark' | 'star';
}
interface Ring {
  x: number;
  y: number;
  r: number;
  color: number;
  born: number;
  life: number;
}
interface Float {
  text: string;
  x: number;
  y: number;
  rise: number;
  color: number;
  scale: number;
  born: number;
  life: number;
  icon?: string;
}
interface Flash {
  r: Rect;
  color: number;
  born: number;
  life: number;
}
interface Flyer {
  key?: string; // texture to fly (an item icon), else a chip of `color`
  color: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  arc: number;
  born: number;
  life: number;
  done?: () => void;
}

/** The camp's own particles, rings, flashes, flying icons and floating numbers (drawn on the camp's fx layer). */
export class CampFx {
  parts: Part[] = [];
  rings: Ring[] = [];
  floats: Float[] = [];
  flashes: Flash[] = [];
  flyers: Flyer[] = [];

  clear(): void {
    this.parts = [];
    this.rings = [];
    this.floats = [];
    this.flashes = [];
    this.flyers = [];
  }

  /** A burst of `n` pixels flying out of (x, y). */
  burst(x: number, y: number, colors: readonly number[], n: number, speed = 1, o: { g?: number; life?: number; kind?: Part['kind']; up?: number; spread?: number } = {}): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = (o.up ?? 0) !== 0 ? -Math.PI / 2 + rand(-1, 1) * (o.spread ?? 1.1) : rand(0, Math.PI * 2);
      const v = rand(30, 90) * speed;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - (o.up ?? 0),
        g: o.g ?? 120,
        drag: 2.5,
        born: now - rand(0, 30),
        life: (o.life ?? 600) * rand(0.7, 1.2),
        color: colors[i % colors.length],
        kind: o.kind ?? (i % 3 === 0 ? 'chip' : 'px'),
      });
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  /** Forge sparks: bright streaks spraying up and out, falling under gravity. */
  sparks(x: number, y: number, n: number, dir = 0): void {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + dir * 0.6 + rand(-1.25, 1.25);
      const v = rand(50, 130);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, drag: 1.2, born: now, life: rand(300, 650), color: [0xfff0a0, 0xffd23a, 0xff9a2a, WHITE][i % 4], kind: 'spark' });
    }
  }

  ring(x: number, y: number, r: number, color: number, life = 380): void {
    this.rings.push({ x, y, r, color, born: performance.now(), life });
  }

  /** A number or word that pops and rises (an icon in front of it if given). */
  float(text: string, x: number, y: number, color: number, o: { scale?: number; icon?: string; life?: number; rise?: number; delay?: number } = {}): void {
    this.floats.push({ text, x, y, color, scale: o.scale ?? 1, icon: o.icon, life: o.life ?? 1000, rise: o.rise ?? 16, born: performance.now() + (o.delay ?? 0) });
    if (this.floats.length > 24) this.floats.shift();
  }

  flash(r: Rect, color = WHITE, life = 320): void {
    this.flashes.push({ r: { ...r }, color, born: performance.now(), life });
  }

  /** Something flies from (x0, y0) to (x1, y1) along an arc; `done` runs when it lands. */
  fly(o: { key?: string; color?: number; x0: number; y0: number; x1: number; y1: number; arc?: number; life?: number; delay?: number; done?: () => void }): void {
    this.flyers.push({ key: o.key, color: o.color ?? WHITE, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, arc: o.arc ?? 24, born: performance.now() + (o.delay ?? 0), life: o.life ?? 420, done: o.done });
  }

  draw(g: G, imgs: ImagePool, texts: TextPool, now: number): void {
    // rect flashes (a white pop over a slot, a card)
    this.flashes = this.flashes.filter((f) => now - f.born < f.life);
    for (const f of this.flashes) {
      const k = clamp01((now - f.born) / f.life);
      const grow = Math.round(easeOut3(k) * 3);
      rows(g, f.r.x - 1 - grow, f.r.y - 1 - grow, f.r.w + 2 + grow * 2, f.r.h + 2 + grow * 2, 3, f.color, 0.75 * (1 - k));
    }
    // rings
    this.rings = this.rings.filter((r) => now - r.born < r.life);
    for (const r of this.rings) {
      const k = clamp01((now - r.born) / r.life);
      const rad = r.r * easeOut3(k);
      const n = Math.max(16, Math.round(rad * 4));
      g.fillStyle(r.color, 1 - k);
      const th = k < 0.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        g.fillRect(Math.round(r.x + Math.cos(a) * rad), Math.round(r.y + Math.sin(a) * rad), th, th);
      }
    }
    // particles (positions are closed-form in time: no state to step)
    this.parts = this.parts.filter((p) => now - p.born < p.life);
    for (const p of this.parts) {
      const t = Math.max(0, now - p.born) / 1000;
      const f = p.drag > 0 ? (1 - Math.exp(-p.drag * t)) / p.drag : t;
      const x = p.x + p.vx * f;
      const y = p.y + p.vy * f + 0.5 * p.g * t * t;
      const k = (now - p.born) / p.life;
      const a = 1 - k * k;
      g.fillStyle(p.color, a);
      if (p.kind === 'chip') g.fillRect(Math.round(x), Math.round(y), 2, 2);
      else if (p.kind === 'spark') {
        // a short streak along its motion
        const vx = p.vx * Math.exp(-p.drag * t);
        const vy = p.vy * Math.exp(-p.drag * t) + p.g * t;
        const len = Math.min(4, Math.hypot(vx, vy) / 40);
        g.fillRect(Math.round(x), Math.round(y), 1, 1);
        g.fillRect(Math.round(x - (vx / (Math.hypot(vx, vy) + 1e-6)) * len), Math.round(y - (vy / (Math.hypot(vx, vy) + 1e-6)) * len), 1, 1);
      } else if (p.kind === 'star') {
        const arm = k < 0.4 ? 2 : 1;
        g.fillRect(Math.round(x) - arm, Math.round(y), arm * 2 + 1, 1);
        g.fillRect(Math.round(x), Math.round(y) - arm, 1, arm * 2 + 1);
      } else g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // flyers
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const fl = this.flyers[i];
      if (now < fl.born) continue;
      const k = clamp01((now - fl.born) / fl.life);
      const e = k * k * (3 - 2 * k);
      const x = fl.x0 + (fl.x1 - fl.x0) * e;
      const y = fl.y0 + (fl.y1 - fl.y0) * e - Math.sin(k * Math.PI) * fl.arc;
      if (fl.key) {
        const [w, h] = imgs.size(fl.key);
        imgs.at(fl.key, Math.round(x - w / 2), Math.round(y - h / 2), D.fxIcons);
        // a little trail of sparkles behind it
        if (Math.random() < 0.6) this.parts.push({ x, y, vx: rand(-10, 10), vy: rand(-10, 10), g: 0, drag: 2, born: now, life: 260, color: Math.random() < 0.5 ? 0xfff0a0 : WHITE, kind: 'px' });
      } else {
        g.fillStyle(INK, 1);
        g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
        g.fillStyle(fl.color, 1);
        g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      if (k >= 1) {
        this.flyers.splice(i, 1);
        fl.done?.();
      }
    }
    // floating numbers: pop up (a quick overshoot), hang, then rise and fade
    this.floats = this.floats.filter((f) => now - f.born < f.life);
    for (const f of this.floats) {
      if (now < f.born) continue;
      const age = now - f.born;
      const k = age / f.life;
      const pop = easeBack(age / 180, 2.2);
      const y = f.y - pop * 4 - Math.max(0, k - 0.35) * f.rise * 1.6;
      const a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const col = age < 70 ? WHITE : f.color;
      const w = textWidth(f.text, f.scale, true);
      let x = f.x;
      if (f.icon) {
        const [iw, ih] = pixSize(f.icon);
        pix(g, f.icon, Math.round(x - (w + iw + 2) / 2), Math.round(y - ih / 2), a);
        x += (iw + 2) / 2;
      }
      texts.text(f.text, x, y, col, { bold: true, scale: f.scale, ox: 0.5, oy: 0.5, alpha: a });
    }
  }
}

// ------------------------------------------------------------------ the toast: what just changed, before -> after

export interface ToastLine {
  label: string;
  stat?: StatId;
  from: string;
  to: string;
  /** green (better), red (worse) or neutral (null). */
  good: boolean | null;
}

export interface Toast {
  title: string;
  ribbon: Face;
  lines: ToastLine[];
  at: number;
  cx: number;
  cy: number;
  note?: string;
  /** Plain centred lines under the stat lines (each pops in after the one before). */
  text?: Array<{ text: string; col: number; bold?: boolean }>;
}

/**
 * A stat before -> after as the toasts print it: whole numbers like the totals everywhere else ("16 > 17", "x2.0 >
 * x2.2"), unless that would hide the change (then the precise form: "16.1 > 16.4").
 */
export function statPair(id: StatId, a: number, b: number): [string, string] {
  const sa = fmtTotal(id, a);
  const sb = fmtTotal(id, b);
  if (sa !== sb) return [sa, sb];
  const u = STAT_INFO[id].unit;
  const fine = (v: number) => (u === 'mult' ? `x${v.toFixed(2)}` : u === 'pct' ? `${Math.round(v * 1000) / 10}%` : `${Math.round(v * 10) / 10}`);
  return [fine(a), fine(b)];
}

/** Hero stat changes as toast lines (core stats first), before -> after. */
export function statChanges(before: StatBlock, after: StatBlock, order: StatId[]): ToastLine[] {
  const out: ToastLine[] = [];
  for (const id of order) {
    const [a, b] = statPair(id, before[id], after[id]);
    if (a === b) continue;
    out.push({ label: STAT_INFO[id].short, stat: id, from: a, to: b, good: after[id] > before[id] });
  }
  return out;
}

// ------------------------------------------------------------------ sprites that need a crop, a flip or a tint

/** Where each hero's face sits inside their 40x40 portrait (top-left of an 18x18 window), as the fight HUD shows it. */
export const FACE_AT: Record<string, [number, number]> = { rowan: [12, 6], sable: [14, 8] }; // as hud.ts frames them

export interface SpriteOpts {
  /** A window on the texture [x, y, w, h]: (x, y) then places the window's top-left. */
  crop?: [number, number, number, number];
  flip?: boolean;
  tint?: number;
  scale?: number;
  alpha?: number;
}

/** Like ImagePool, but every draw sets the crop, flip, tint and scale afresh (a reused image never keeps them). */
export class SpritePool {
  private items: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(private readonly s: FightScene) {}

  begin(): void {
    this.used = 0;
  }

  draw(key: string, x: number, y: number, depth: number, o: SpriteOpts = {}): Phaser.GameObjects.Image {
    let img = this.items[this.used];
    if (!img) {
      img = this.s.add.image(0, 0, key).setOrigin(0, 0);
      this.items.push(img);
    }
    this.used++;
    if (img.texture.key !== key) img.setTexture(key);
    const sc = o.scale ?? 1;
    img.setDepth(depth).setScale(sc).setFlipX(!!o.flip).setAlpha(o.alpha ?? 1).setVisible(true);
    if (o.crop) {
      const [cx, cy, cw, ch] = o.crop;
      img.setCrop(cx, cy, cw, ch).setPosition(Math.round(x) - cx * sc, Math.round(y) - cy * sc);
    } else img.setCrop().setPosition(Math.round(x), Math.round(y));
    if (o.tint === undefined) img.clearTint();
    else img.setTint(o.tint);
    return img;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }

  destroy(): void {
    for (const img of this.items) img.destroy();
    this.items = [];
    this.used = 0;
  }
}

/** A hero's level standing: level, XP into it and needed (0 at the max), points to spend. */
export interface HeroLevel {
  level: number;
  into: number;
  need: number;
  points: number;
}

// ------------------------------------------------------------------ the kit

/** Frames go on g, icons at depth `icons`, marks over the icons on `over`, text in `texts`. */
export interface Layer {
  g: G;
  over: G;
  icons: number;
  texts: TextPool;
}

export class CampKit {
  gBack!: G;
  gFront!: G;
  gUi!: G;
  gOver!: G;
  gTop!: G;
  gTopOver!: G;
  gFx!: G;
  readonly homeTexts: TextPool;
  readonly texts: TextPool;
  readonly topTexts: TextPool;
  readonly fxTexts: TextPool;
  readonly imgs: ImagePool;
  readonly sprites: SpritePool;
  readonly fx = new CampFx();
  toastNow: Toast | null = null;
  coinsShown = 0;
  scrapShown = 0;
  private lastCoins = -1;
  private lastScrap = -1;
  coinPulse = { at: -1e9, dir: 0 };
  scrapPulse = { at: -1e9, dir: 0 };
  private lastNow = 0;
  private timers: Array<{ at: number; fn: () => void }> = [];

  constructor(readonly s: FightScene) {
    this.homeTexts = new TextPool(s, D.homeText);
    this.texts = new TextPool(s, D.text);
    this.topTexts = new TextPool(s, D.topText);
    this.fxTexts = new TextPool(s, D.fxText);
    this.imgs = new ImagePool(s);
    this.sprites = new SpritePool(s);
  }

  build(): void {
    const s = this.s;
    for (const g of [this.gBack, this.gFront, this.gUi, this.gOver, this.gTop, this.gTopOver, this.gFx]) g?.destroy();
    this.gBack = s.add.graphics().setDepth(D.back);
    this.gFront = s.add.graphics().setDepth(D.front);
    this.gUi = s.add.graphics().setDepth(D.ui);
    this.gOver = s.add.graphics().setDepth(D.over);
    this.gTop = s.add.graphics().setDepth(D.top);
    this.gTopOver = s.add.graphics().setDepth(D.topOver);
    this.gFx = s.add.graphics().setDepth(D.fx);
    this.imgs.destroy();
    this.sprites.destroy();
    this.fx.clear();
  }

  /** A hero's level, XP and points to spend. */
  level(id: HeroId): HeroLevel {
    const h = heroProgress(this.profile, id);
    const lp = levelProgress(this.tuning, h.xp);
    return { ...lp, points: pointsLeft(this.tuning, h) };
  }

  get app() {
    return this.s.app;
  }
  get run() {
    return this.s.app.run;
  }
  get profile() {
    return this.s.app.run.profile;
  }
  get tuning() {
    return this.s.app.run.tuning;
  }

  /** The picked hero as the stats show them: mid-run, the run's hero; from the world map, the hero at their level
   *  and skills in the shared gear. */
  heroNow(): Hero {
    const run = this.run;
    return run.campFrom !== 'world' ? run.hero : newHero(run.tuning, run.gear, run.build);
  }

  /** A hero as the skill screen previews them: the picked hero's run and gear, with `id`'s level and skills. */
  heroAs(id: HeroId): Hero {
    return { ...this.heroNow(), build: profileBuild(this.profile, this.tuning, id) };
  }

  /** Whether a texture has been drawn (art that lands later falls back to what exists). */
  has(key: string): boolean {
    return this.s.textures.exists(key);
  }

  /** A hero's card art (40x48), or a stand-in until it's drawn: their story portrait, else Rowan's as a shadow. */
  heroArt(id: HeroId): { key: string; shadow: boolean } {
    if (this.has(`hero_card_${id}`)) return { key: `hero_card_${id}`, shadow: false };
    if (this.has(`portrait_${id}`)) return { key: `portrait_${id}`, shadow: false };
    return { key: 'portrait_rowan', shadow: true };
  }

  /** The hero's face: an 18x18 window on their portrait (top-left at x, y). */
  face(id: HeroId, x: number, y: number, depth: number, o: { size?: number; tint?: number; alpha?: number } = {}): void {
    const own = this.has(`portrait_${id}`);
    const [fx, fy] = FACE_AT[own ? id : 'rowan'] ?? FACE_AT.rowan;
    const n = o.size ?? 18;
    const d = Math.round((18 - n) / 2);
    this.sprites.draw(own ? `portrait_${id}` : 'portrait_rowan', x, y, depth, { crop: [fx + d, fy + d, n, n], tint: own ? o.tint : (o.tint ?? 0x2a2040), alpha: o.alpha });
  }

  stats(): StatBlock {
    return heroStats(this.tuning, this.heroNow());
  }

  /** The profile changed: save it and dress the hero in what's equipped now. */
  commit(): void {
    this.app.saveProfile();
    this.app.run.refreshGear();
  }

  /** Run `fn` in `ms` (camp time: performance.now). */
  after(ms: number, fn: () => void): void {
    this.timers.push({ at: performance.now() + ms, fn });
  }

  /** The purse and scrap counters jump to the profile's values (opening the camp). */
  syncPurse(): void {
    this.coinsShown = this.lastCoins = this.profile.coins;
    this.scrapShown = this.lastScrap = this.profile.scrap;
  }

  begin(now: number): void {
    const dt = Math.min(100, Math.max(0, now - (this.lastNow || now)));
    this.lastNow = now;
    for (let i = 0; i < this.timers.length; i++) {
      const t = this.timers[i];
      if (now >= t.at) {
        this.timers.splice(i--, 1);
        t.fn();
      }
    }
    for (const g of [this.gBack, this.gFront, this.gUi, this.gOver, this.gTop, this.gTopOver, this.gFx]) g.clear();
    this.homeTexts.begin();
    this.texts.begin();
    this.topTexts.begin();
    this.fxTexts.begin();
    this.imgs.begin();
    this.sprites.begin();
    // counters roll toward the real values; a change pulses them (green up, red down)
    const p = this.profile;
    if (this.lastCoins < 0) this.syncPurse();
    if (p.coins !== this.lastCoins) {
      this.coinPulse = { at: now, dir: Math.sign(p.coins - this.lastCoins) };
      this.lastCoins = p.coins;
    }
    if (p.scrap !== this.lastScrap) {
      this.scrapPulse = { at: now, dir: Math.sign(p.scrap - this.lastScrap) };
      this.lastScrap = p.scrap;
    }
    const roll = (shown: number, to: number) => {
      const d = to - shown;
      if (Math.abs(d) < 0.5) return to;
      return shown + d * Math.min(1, dt / 90) + Math.sign(d) * Math.min(Math.abs(d), dt / 60);
    };
    this.coinsShown = roll(this.coinsShown, p.coins);
    this.scrapShown = roll(this.scrapShown, p.scrap);
  }

  end(now: number): void {
    this.drawToast(now);
    this.fx.draw(this.gFx, this.imgs, this.fxTexts, now);
    this.homeTexts.end();
    this.texts.end();
    this.topTexts.end();
    this.fxTexts.end();
    this.imgs.end();
    this.sprites.end();
  }

  hide(): void {
    for (const g of [this.gBack, this.gFront, this.gUi, this.gOver, this.gTop, this.gTopOver, this.gFx]) g?.clear();
    this.homeTexts.hide();
    this.texts.hide();
    this.topTexts.hide();
    this.fxTexts.hide();
    this.imgs.hide();
    this.sprites.hide();
    this.toastNow = null;
    this.fx.clear();
    this.timers = [];
  }

  // ------------------------------------------------------------------ drawing helpers

  /** The dim over the camp behind a sub-screen, darker at the edges. */
  dim(g: G, a: number): void {
    const s = this.s;
    const W = s.R + s.L + 400;
    g.fillStyle(0x07050e, a);
    g.fillRect(0, 0, W, s.B + 200);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0x07050e, a * 0.25);
      g.fillRect(0, 0, W, 3 + i * 3);
      g.fillRect(0, s.B + 200 - 3 - i * 3, W, 3 + i * 3);
    }
  }

  /**
   * A chunky button with an optional icon in front of its label. `pressed` shows it sunk (notePress on the tap);
   * `shakeAt` rattles it (a refused tap); `glowCol` pulses a halo around it. `cost`: what it costs, as icons and
   * numbers after the label (a number you're short of in red): the price sits on the button you pay with.
   */
  button(
    g: G,
    texts: TextPool,
    r: Rect,
    label: string,
    face: Face,
    now: number,
    o: {
      icon?: string;
      disabled?: boolean;
      glowCol?: number;
      shakeAt?: number;
      bold?: boolean;
      alpha?: number;
      labelCol?: number;
      sub?: string;
      subCol?: number;
      cost?: Array<{ icon: string; n: number; short?: boolean }>;
    } = {},
  ): void {
    const sh = now - (o.shakeAt ?? -1e9);
    const dx = sh < 280 ? Math.round(Math.sin(sh / 18) * 2 * (1 - sh / 280)) : 0;
    const rr = { ...r, x: r.x + dx };
    const pr = isPressed(r, now);
    if (o.glowCol !== undefined && !o.disabled) glow(g, rr, o.glowCol, 0.3 + 0.35 * pulse(now, 900), 3);
    button3d(g, rr, o.disabled ? FACE.grey : face, pr);
    const py = pr ? 2 : 0;
    const bold = o.bold !== false;
    const tw = label ? textWidth(label, 1, bold) : 0;
    const [iw, ih] = o.icon ? pixSize(o.icon) : [0, 0];
    const gap = o.icon && label ? 2 : 0;
    // the price: a dark inset after the label, an icon and a number per currency
    const cost = o.cost ?? [];
    const pieceW = (c: { icon: string; n: number }) => pixSize(c.icon)[0] + 2 + textWidth(`${c.n}`, 1, true);
    const costW = cost.length ? cost.reduce((a, c) => a + pieceW(c), 0) + (cost.length - 1) * 5 + 8 : 0;
    const total = tw + iw + gap + (costW ? costW + 6 : 0);
    const x0 = Math.round(rr.x + (rr.w - total) / 2);
    const cy = rr.y + (o.sub ? rr.h / 2 - 3 : rr.h / 2) + py;
    if (o.icon) pix(g, o.icon, x0, Math.round(cy - ih / 2), o.disabled ? 0.55 : 1);
    if (label) texts.text(label, x0 + iw + gap, cy, o.labelCol ?? (o.disabled ? 0xc8ccd8 : WHITE), { bold, oy: 0.5, alpha: o.alpha });
    if (costW) {
      const cr = { x: x0 + iw + gap + tw + 6, y: Math.round(cy - 5), w: costW, h: 10 };
      rows(g, cr.x, cr.y, cr.w, cr.h, 2, INK, 0.45);
      let cx = cr.x + 4;
      for (const c of cost) {
        const [cw, ch] = pixSize(c.icon);
        pix(g, c.icon, cx, Math.round(cy - ch / 2), o.disabled ? 0.7 : 1);
        cx += cw + 2;
        texts.text(`${c.n}`, cx, cy, c.short ? 0xff8a7a : c.icon === 'coin' ? GOLD_TXT : SCRAP_TXT, { bold: true, oy: 0.5, alpha: o.alpha });
        cx += textWidth(`${c.n}`, 1, true) + 5;
      }
    }
    if (o.sub) texts.text(o.sub, rr.x + rr.w / 2, cy + 8, o.disabled ? 0xc8ccd8 : (o.subCol ?? 0xfff0c0), { ox: 0.5, oy: 0.5 });
  }

  /** A sub-screen's Back button (top left). */
  backRect(): Rect {
    return { x: this.s.L + 3, y: 3, w: 38, h: 13 };
  }

  drawBack(g: G, now: number): void {
    const r = this.backRect();
    const pr = isPressed(r, now) ? 2 : 0;
    button3d(g, r, FACE.navy, pr > 0);
    chevron(g, r.x + 6, r.y + 3 + pr, 7, GOLD[3], 1, -1, true);
    this.texts.text('Back', r.x + 11, r.y + r.h / 2 + pr, WHITE, { bold: true, oy: 0.5 });
  }

  /** A title ribbon whose left end sits at x; returns its right end. */
  title(g: G, text: string, x: number, y: number, col: Face = RIBBON.blue, sub?: string): number {
    const tw = textWidth(text, 1, true);
    const sw = sub ? textWidth(sub, 1, false) + 4 : 0;
    const w = tw + sw + 14;
    ribbon(g, x + w / 2 + 6, y, w, 12, col, 1, false);
    this.texts.text(text, x + 13, y + 6, WHITE, { bold: true, oy: 0.5 });
    if (sub) this.texts.text(sub, x + 13 + tw + 4, y + 6.5, 0xfff0c0, { oy: 0.5 });
    return x + w + 12;
  }

  /** A counter tag at r: icon and a number that rolls; pulses green when it grows and red when it shrinks. */
  private counter(g: G, texts: TextPool, r: Rect, icon: string, value: number, pulseAt: { at: number; dir: number }, col: number, now: number): void {
    const txt = `${Math.round(value)}`;
    const k = clamp01((now - pulseAt.at) / 500);
    const hot = k < 1 ? 1 - k : 0;
    tag(g, r, [NAVY[6], NAVY[3], NAVY[2], NAVY[1]]);
    if (hot > 0) rows(g, r.x, r.y, r.w, r.h, 1, pulseAt.dir >= 0 ? 0x5ad848 : 0xd03030, 0.55 * hot);
    const [iw, ih] = pixSize(icon);
    pix(g, icon, r.x + 2, Math.round(r.y + (r.h - ih) / 2));
    const bump = hot > 0.6 ? -1 : 0;
    texts.text(txt, r.x + iw + 4, r.y + 6 + bump, hot > 0 ? mix(col, pulseAt.dir >= 0 ? 0xb4f070 : 0xff8a7a, hot) : col, { bold: true, oy: 0.5 });
  }

  /** Where the coin and scrap tags sit, right-aligned at `right` (for effects that fly to them). */
  purseRects(right: number, y: number): { coins: Rect; scrap: Rect } {
    const sw = Math.max(30, textWidth(`${Math.round(this.scrapShown)}`, 1, true) + 16);
    const cw = Math.max(30, textWidth(`${Math.round(this.coinsShown)}`, 1, true) + 16);
    const scrap = { x: right - sw, y, w: sw, h: 12 };
    return { coins: { x: scrap.x - 4 - cw, y, w: cw, h: 12 }, scrap };
  }

  /** Coins and scrap, right-aligned at `right` (returns their tags). */
  purse(g: G, texts: TextPool, right: number, y: number, now: number): { coins: Rect; scrap: Rect } {
    const r = this.purseRects(right, y);
    this.counter(g, texts, r.scrap, 'scrap', this.scrapShown, this.scrapPulse, SCRAP_TXT, now);
    this.counter(g, texts, r.coins, 'coin', this.coinsShown, this.coinPulse, GOLD_TXT, now);
    return r;
  }

  /** The layers a screen draws on: the screen itself, or a popup over it. */
  layer(top = false): Layer {
    return top
      ? { g: this.gTop, over: this.gTopOver, icons: D.topIcons, texts: this.topTexts }
      : { g: this.gUi, over: this.gOver, icons: D.icons, texts: this.texts };
  }

  /** A soft-edged section panel (navy, gold trim). */
  pane(g: G, r: Rect, o: { warm?: boolean; alpha?: number } = {}): void {
    panel(g, r, { trim: 'full', alpha: o.alpha, tones: o.warm ? [0x4a2e2a, 0x3a2226, 0x2a181e] : undefined, bevel: o.warm ? 0x8a5a3a : undefined });
  }

  /** A thin divider line inside a panel. */
  divider(g: G, x: number, y: number, w: number): void {
    g.fillStyle(NAVY[1], 1);
    g.fillRect(x, y, w, 1);
    g.fillStyle(NAVY[5], 0.7);
    g.fillRect(x, y + 1, w, 1);
  }

  /** A counter bubble centred on (x, y): red for new things, gold for "!" (something to do). It bobs. */
  bubble(g: G, texts: TextPool, x: number, y: number, txt: string, now: number, gold = false): void {
    const w = Math.max(9, textWidth(txt, 1, gold) + 4);
    const bump = Math.round(Math.abs(Math.sin(now / 300)) * -1);
    const r = { x: Math.round(x - w / 2), y: y + bump, w, h: 9 };
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK);
    rows(g, r.x, r.y, r.w, r.h, 2, gold ? GOLD[3] : 0xd8303a);
    g.fillStyle(gold ? GOLD[4] : 0xff8a7a, 1);
    g.fillRect(r.x + 2, r.y, r.w - 4, 1);
    g.fillStyle(gold ? GOLD[2] : 0x9a1a22, 1);
    g.fillRect(r.x + 2, r.y + r.h - 1, r.w - 4, 1);
    texts.text(txt, r.x + r.w / 2, r.y + 4.5, gold ? 0x5a2a08 : WHITE, { bold: gold, ox: 0.5, oy: 0.5 });
  }

  /** A hero family's chip ("Blade" with a sword, "Twin" with two daggers) with its left end at x; returns its width. */
  familyChip(g: G, texts: TextPool, family: HeroFamily, x: number, cy: number, alpha = 1): number {
    const label = family === 'twin' ? 'Twin' : 'Blade';
    const icon = family === 'twin' ? 'twin' : 'blade';
    const [iw, ih] = pixSize(icon);
    const w = iw + 5 + textWidth(label, 1, false) + 3;
    const r = { x, y: Math.round(cy - 5), w, h: 10 };
    tag(g, r, family === 'twin' ? [0xdab0ff, 0x6e30a8, 0x5a2490, 0x40186a] : [0x9ad8ff, 0x2a5ac0, 0x22489c, 0x1a3070], alpha);
    pix(g, icon, r.x + 1, Math.round(cy - ih / 2), alpha);
    texts.text(label, r.x + iw + 3, cy, WHITE, { oy: 0.5, alpha });
    return w;
  }

  /** "Lv 7" and an XP bar with "120/300 XP" (or "Max level") in the rect; returns the bar's rect. */
  xpBar(g: G, texts: TextPool, id: HeroId, r: Rect, o: { alpha?: number; small?: boolean } = {}): Rect {
    const L = this.level(id);
    const lv = `Lv ${L.level}`;
    const lw = textWidth(lv, 1, true);
    texts.text(lv, r.x, r.y + r.h / 2, GOLD_TXT, { bold: true, oy: 0.5, alpha: o.alpha });
    const xp = L.need ? `${L.into}/${L.need} XP` : 'Max level';
    const xw = o.small ? 0 : textWidth(xp, 1, false);
    const bx = r.x + lw + 4;
    const bw = Math.max(8, r.w - lw - 4 - (xw ? xw + 4 : 0));
    const bar = { x: bx, y: Math.round(r.y + r.h / 2 - 2), w: bw, h: 4 };
    gauge(g, bar.x, bar.y, bar.w, bar.h, L.need ? L.into / L.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a] });
    if (xw) texts.text(xp, r.x + r.w, r.y + r.h / 2, 0xc8e0ff, { ox: 1, oy: 0.5, alpha: o.alpha });
    return bar;
  }

  /** The hero's name and title: HEROES data. */
  hero(id: HeroId) {
    return HEROES[id];
  }

  /**
   * The top bar's hero tabs, right after Back (they name the screen): `all` shows locked heroes too, as "???" with
   * a padlock. They stay left of the HTML buttons in the top bar's middle (hudZone).
   */
  heroTabs(all: boolean): Array<{ id: HeroId; r: Rect; locked: boolean }> {
    const p = this.profile;
    const b = this.backRect();
    let x = b.x + b.w + 4;
    const out: Array<{ id: HeroId; r: Rect; locked: boolean }> = [];
    for (const id of HERO_IDS) {
      const locked = !p.heroes[id]?.unlocked;
      if (locked && !all) continue;
      const mark = id === p.hero || locked ? 9 : 0;
      const w = textWidth(locked ? '???' : HEROES[id].name, 1, true) + 9 + mark;
      out.push({ id, r: { x, y: 3, w, h: 13 }, locked });
      x += w + 3;
    }
    return out;
  }

  /** The hero tabs: the one on view gold and sunk, the picked one with a check, a locked one with a padlock. */
  drawHeroTabs(g: G, tabs: Array<{ id: HeroId; r: Rect; locked: boolean }>, view: HeroId, now: number): void {
    for (const { id, r, locked } of tabs) {
      const on = view === id;
      const pr = isPressed(r, now) || on;
      if (on) glow(g, r, 0xffd23a, 0.25, 2);
      button3d(g, r, on ? FACE.gold : FACE.navy, pr);
      const y = r.y + r.h / 2 + (pr ? 2 : 0);
      let x = r.x + 5;
      if (id === this.profile.hero) {
        pix(g, 'check', x - 1, Math.round(y - 4));
        x += 9;
      } else if (locked) {
        padlock(g, x, Math.round(y - 4), 1, 0xd8901c);
        x += 9;
      }
      this.texts.text(locked ? '???' : HEROES[id].name, x, y, on ? WHITE : locked ? 0x9890b8 : 0xd8d0f0, { bold: true, oy: 0.5 });
    }
  }

  /**
   * Where the tuning panel's gear button sits in the top bar's middle (an HTML button over the canvas, right of the
   * hidden pause button: style.css #hud): keep the top bar clear of it.
   */
  hudZone(): Rect {
    const l = this.app.layout;
    const vw = typeof window !== 'undefined' ? window.innerWidth : l.cssW;
    const cx = ((vw / 2 - l.left) * GAME_W) / l.cssW;
    return { x: Math.floor(cx - 1), y: 0, w: 19, h: 19 };
  }

  /** Show a toast (what just changed) centred on (cx, cy). */
  toast(t: Omit<Toast, 'at'>): void {
    this.toastNow = { ...t, at: performance.now() };
  }

  /** The player moved on: a toast that has been read for a while fades out now. */
  fadeToast(): void {
    const t = this.toastNow;
    if (!t) return;
    const life = 2400 + (t.lines.length + (t.text?.length ?? 0)) * 220;
    const age = performance.now() - t.at;
    if (age > 700 && age < life - 300) t.at = performance.now() - (life - 300);
  }

  private drawToast(now: number): void {
    const t = this.toastNow;
    if (!t) return;
    const g = this.gTop;
    const texts = this.topTexts;
    const n = t.lines.length;
    const life = 2400 + (n + (t.text?.length ?? 0)) * 220;
    const age = now - t.at;
    if (age > life) {
      this.toastNow = null;
      return;
    }
    const a = age > life - 300 ? (life - age) / 300 : 1;
    const k = easeBack(age / 260, 1.7);
    // columns: icon, label, from, arrow, to
    const lw = Math.max(0, ...t.lines.map((l) => textWidth(l.label, 1, false)));
    const fw = Math.max(0, ...t.lines.map((l) => textWidth(l.from, 1, true)));
    const tw2 = Math.max(0, ...t.lines.map((l) => textWidth(l.to, 1, true)));
    const titleW = textWidth(t.title, 1, true) + 30;
    const noteW = t.note ? textWidth(t.note, 1, false) + 12 : 0;
    const extra = t.text ?? [];
    const textW = Math.max(0, ...extra.map((l) => textWidth(l.text, 1, !!l.bold) + 16));
    const w = Math.max(titleW, noteW, textW, n ? 16 + lw + 4 + fw + 14 + tw2 + 14 : 0);
    const h = 14 + n * 11 + extra.length * 10 + (t.note ? 10 : 0) + 4;
    const sc = 0.7 + 0.3 * Math.min(1, k);
    const s = this.s;
    const cx = Math.max(s.L + 3 + w / 2, Math.min(s.R - 3 - w / 2, t.cx));
    const r = { x: Math.round(cx - (w * sc) / 2), y: Math.round(t.cy - (h * sc) / 2), w: Math.round(w * sc), h: Math.round(h * sc) };
    panel(g, r, { trim: 'full', alpha: a });
    if (k < 0.95) return;
    ribbon(g, r.x + r.w / 2, r.y - 6, titleW, 12, t.ribbon, a, false);
    texts.text(t.title, r.x + r.w / 2, r.y, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    t.lines.forEach((l, i) => {
      const lk = clamp01((age - 110 - i * 110) / 160);
      if (lk <= 0) return;
      const y = r.y + 13 + i * 11 + Math.round((1 - lk) * 4);
      const la = a * lk;
      let x = r.x + 6;
      if (l.stat) statMark(g, l.stat, x, y, la);
      x += 12;
      texts.text(l.label, x, y, 0xd8d0f0, { oy: 0.5, alpha: la });
      x += lw + 4;
      texts.text(l.from, x, y, 0xb0a8c8, { bold: true, oy: 0.5, alpha: la });
      x += fw + 3;
      const col = l.good === null ? WHITE : l.good ? GREEN : RED;
      chevron(g, x + 1, y - 3, 7, col, la, 1, true);
      x += 9;
      const tk = clamp01((age - 200 - i * 110) / 140);
      const flashC = tk < 1 ? mix(WHITE, col, tk) : col;
      texts.text(l.to, x, y - (tk < 1 ? Math.round((1 - tk) * 2) : 0), flashC, { bold: true, oy: 0.5, alpha: la * tk });
      if (l.good !== null && tk >= 1) {
        // an arrow next to the new value (it bounces once)
        const bx = x + textWidth(l.to, 1, true) + 2;
        const by = y - 3 - Math.round(Math.sin(clamp01((age - 340 - i * 110) / 380) * Math.PI) * 2);
        g.fillStyle(col, la);
        if (l.good) {
          g.fillRect(bx + 2, by, 1, 1);
          g.fillRect(bx + 1, by + 1, 3, 1);
          g.fillRect(bx, by + 2, 5, 1);
        } else {
          g.fillRect(bx, by + 1, 5, 1);
          g.fillRect(bx + 1, by + 2, 3, 1);
          g.fillRect(bx + 2, by + 3, 1, 1);
        }
      }
    });
    extra.forEach((l, i) => {
      const lk = clamp01((age - 110 - (n + i) * 160) / 160);
      if (lk <= 0) return;
      const y = r.y + 13 + n * 11 + i * 10 + Math.round((1 - lk) * 3);
      texts.text(l.text, r.x + r.w / 2, y, lk < 1 ? mix(WHITE, l.col, lk) : l.col, { bold: !!l.bold, ox: 0.5, oy: 0.5, alpha: a * lk });
    });
    if (t.note) texts.text(t.note, r.x + r.w / 2, r.y + r.h - 8, 0xfff0c0, { ox: 0.5, oy: 0.5, alpha: a });
  }
}

/** A stat's dot color (for rows too tight for its big HUD icon). */
const DOT: Record<StatId, number> = {
  hp: 0xe2333c,
  atk: 0xb8c2d8,
  def: 0x4aa0f0,
  critChance: 0x5ad04a,
  critDmg: 0xf05a48,
  comboPower: 0x9ad8ff,
  meterGain: 0x2a6ad8,
  steady: 0xeef3fa,
  luck: 0x78a83c,
  companion: 0x6aaef0,
};
export const statDot = (id: StatId): number => DOT[id];

/** A stat's icon if it's small enough for a tight row (<= 9 px tall), else null. */
export function smallStatIcon(id: StatId): string | null {
  const ic = STAT_INFO[id].icon;
  return iconSize(ic)[1] <= 9 ? ic : null;
}

/** Draw a stat's marker in a tight row: its small icon, or a colored gem for the big ones. Returns its width. */
export function statMark(g: G, id: StatId, x: number, cy: number, alpha = 1): number {
  const small = smallStatIcon(id);
  if (small) {
    const [iw, ih] = iconSize(small);
    hudIcon(g, small, x + Math.round((9 - iw) / 2), Math.round(cy - ih / 2), 1, alpha);
  } else {
    const c = statDot(id);
    g.fillStyle(INK, alpha);
    g.fillRect(x + 1, Math.round(cy) - 4, 7, 7);
    g.fillStyle(c, alpha);
    g.fillRect(x + 2, Math.round(cy) - 3, 5, 5);
    g.fillStyle(mix(c, INK, 0.4), alpha);
    g.fillRect(x + 2, Math.round(cy) + 1, 5, 1);
    g.fillStyle(WHITE, 0.7 * alpha);
    g.fillRect(x + 2, Math.round(cy) - 3, 2, 1);
  }
  return 9;
}

