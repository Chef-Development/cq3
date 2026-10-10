// Shared pieces of the camp's screens (home, bag, forge, stats): the drawing layers and pools (all inside the camp's
// depth range 30.95-31.35), the camp's own juice (particles, rings, flying icons, floating numbers, flashes: the
// scene's effects draw under the camp), buttons, the purse and scrap counters that roll to their new values, the
// "before -> after" stat toast, and a few small pixel icons.
import { mult, one, whole } from '../../core/format';
import type Phaser from 'phaser';
import { STAT_INFO, type StatId } from '../../data/gear';
import { HERO_IDS, HEROES, type HeroId, type StyleId } from '../../data/heroes';
import { TIER_INFO, type Tier } from '../../data/rarity';
import { STYLES } from '../../data/styles';
import { heroStats, newHero, type Hero } from '../../core/combat';
import { fmtTotal, type StatBlock } from '../../core/gear';
import { levelProgress, pointsLeft } from '../../core/heroes';
import { heroProgress, profileBuild } from '../../core/profile';
import { heroOwned } from '../../core/roster';
import { PORTRAIT_FACE_AT } from '../art-hero-portraits';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { padlock } from './items';
import { button3d, chevron, gauge, glow, GOLD, hudIcon, iconSize, NAVY, panel, rows } from './pixels';
import { clamp01, easeBack, easeOut3, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { screenCovered } from './hd-text';
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
export const GEM_TXT = 0xf6c8ff;

/** Each style's chip: its icon and colours [hi, base, lo, deep]. */
export const STYLE_LOOK: Record<StyleId, { icon: string; face: Face }> = {
  blade: { icon: 'blade', face: [0x9ad8ff, 0x2a5ac0, 0x22489c, 0x1a3070] },
  shadow: { icon: 'twin', face: [0xdab0ff, 0x6e30a8, 0x5a2490, 0x40186a] },
  guardian: { icon: 'guard', face: [0xb8e0f0, 0x3a7a9a, 0x2a5a78, 0x1a3a50] },
  marksman: { icon: 'bow', face: [0xc8f0a0, 0x3a8a3a, 0x2a6a2a, 0x1a4a1e] },
  brute: { icon: 'hammer', face: [0xffb090, 0xb04a2a, 0x8a3420, 0x5a2014] },
  controller: { icon: 'flake', face: [0xd0f8ff, 0x3aa0c8, 0x2a7aa0, 0x1a5070] },
  summoner: { icon: 'sprout', face: [0xd8f090, 0x5a9a2a, 0x447a20, 0x2a5014] },
  bomber: { icon: 'keg', face: [0xffd890, 0xd0701a, 0xa05010, 0x6a300a] },
};

/** A style chip's width (familyChip). */
export const familyChipW = (family: StyleId): number => pixSize(STYLE_LOOK[family].icon)[0] + 5 + textWidth(STYLES[family].name, 1, false) + 3;

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
  // the other styles: Guardian (a kite shield), Marksman (a bow and arrow), Controller (a snowflake), Summoner (a
  // sprout), Bomber (a keg with a lit fuse); Brute uses the hammer
  guard: {
    rows: outlined(['SWWWS', 'SBWBs', 'SBBBs', '.SBs.', '..s..']),
    pal: { k: K, S: 0xb8c2d8, W: 0xeef3fa, B: 0x2a6ad8, s: 0x6a7496 },
  },
  bow: {
    rows: outlined(['.ww..', 'w..s.', 'w...s', 'wAAAH', 'w...s', 'w..s.', '.ww..']),
    pal: { k: K, w: 0xd09a5e, s: 0xeef3fa, A: 0xb8c2d8, H: 0xffffff },
  },
  flake: {
    rows: outlined(['..W..', 'W.W.W', '.WCW.', 'WCCCW', '.WCW.', 'W.W.W', '..W..']),
    pal: { k: K, W: 0xd0f8ff, C: 0x6ad0f0 },
  },
  sprout: {
    rows: outlined(['LL.ll', 'LLsll', '.Ls..', '..s..', '.ddd.']),
    pal: { k: K, L: 0xb4d058, l: 0x5a9a2a, s: 0x4a7e36, d: 0x6e4426 },
  },
  keg: {
    rows: outlined(['...f.', '..y..', '.bbb.', 'bBbbb', 'bbbbn', '.bnn.']),
    pal: { k: K, f: 0xfff0a0, y: 0xff9a2a, b: 0x4a5272, B: 0xb8c2d8, n: 0x2a2f45 },
  },
  // a paw print (companions)
  paw: {
    rows: outlined(['p.p.p', '.....', '.PPP.', 'PPPPP', '.PPP.']),
    pal: { k: K, p: 0xf0d8c0, P: 0xd8a888 },
  },
  // a little chest (hero chests)
  chest: {
    rows: outlined(['.yyyyy.', 'yBBBBBy', 'yyyGyyy', 'yBBGBBy', 'yBBBBBy']),
    pal: { k: K, y: 0xd8901c, B: 0x8e5a2e, G: 0xfff0a0 },
  },
  // a tent with a pennant (the camp's upgrades)
  tent: {
    rows: outlined(['...r...', '..WWw..', '.WWwww.', 'WWWdwww', 'WWdddww']),
    pal: { k: K, r: 0xd03030, W: 0xe0bc84, w: 0xc0905a, d: 0x4a2c18 },
  },
  // a green flag on a pole (region progress)
  flag: {
    rows: outlined(['pFFFF', 'pFFFf', 'pFFf.', 'p....', 'p....']),
    pal: { k: K, p: 0xb07a44, F: 0x8af06a, f: 0x2a9a3a },
  },
  // a target (practice)
  target: {
    rows: outlined(['.RRR.', 'RWWWR', 'RWRWR', 'RWWWR', '.RRR.']),
    pal: { k: K, R: 0xd03030, W: 0xf4ecd8 },
  },
  // a rule node's rune (a skill without its own icon yet)
  rune: {
    rows: outlined(['...P...', '..PWP..', '.PWPPp.', 'PPPPPpp', '.pPPpp.', '..ppp..', '...p...']),
    pal: { k: K, P: 0xa86ae0, W: 0xf0d8ff, p: 0x6e30a8 },
  },
  // ---- Part 6 companions' perks (the companions screen's cards)
  // a spiky burr of quills (Burr's Prickly)
  spines: {
    rows: outlined(['.t.t.t.', '..BBB..', 'tBWBBdt', '.BBBBd.', 'tBBBddt', '..ddd..', '.t.t.t.']),
    pal: { k: K, t: 0xf0d0a0, B: 0x98663a, W: 0xe0bc84, d: 0x5e3620 },
  },
  // an eighth note (Lark's Wake-up Song)
  note: {
    rows: outlined(['..NN.', '..N.N', '..N..', '..N..', 'NNN..', 'NWN..', '.N...']),
    pal: { k: K, N: 0xffd84a, W: 0xfff6b0 },
  },
  // a crescent moon (Gloam's Night Eyes)
  moon: {
    rows: outlined(['..MMM', '.MMm.', 'MMm..', 'MM...', 'MMm..', '.MMm.', '..MMM']),
    pal: { k: K, M: 0xfff0a8, m: 0xc8a850 },
  },
  // a curling wave (Nimbus's Tide)
  wave: {
    rows: outlined(['..WWW..', '.WAAAW.', 'WAA..W.', 'AA.....', 'AAAAAAA', 'aaaaaaa']),
    pal: { k: K, W: 0xe8fcff, A: 0x6ae8e8, a: 0x2a9ac8 },
  },
  // a calm sea under a twinkle (Nimbus's Calm Seas)
  calm: {
    rows: outlined(['...Y...', '..YWY..', '...Y...', '.......', 'AAaAAaA', 'aAAaAAa']),
    pal: { k: K, Y: 0xffe070, W: 0xfffbe0, A: 0x9af0f0, a: 0x3aaac8 },
  },
};

const runCache = new Map<string, Array<[number, number, number, number]>>();
/** Draw one of the camp's small icons (or a HUD icon of the same name), `scale` times its size. */
export function pix(g: G, key: string, x: number, y: number, alpha = 1, scale = 1): void {
  const def = PIX[key];
  if (!def) return hudIcon(g, key, x, y, scale, alpha);
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
    g.fillRect(x + rx * scale, y + ry * scale, rw * scale, scale);
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
 * A stat before -> after as the toasts print it: whole numbers like the totals everywhere else ("16 > 17", "x2 >
 * x2.2"), unless that would hide the change (then one decimal: "16.1 > 16.4", "4.5% > 4.8%"; never more: a change
 * too small to show at one decimal isn't listed). HP is always whole. (core/format.ts)
 */
export function statPair(id: StatId, a: number, b: number): [string, string] {
  const sa = fmtTotal(id, a);
  const sb = fmtTotal(id, b);
  if (sa !== sb || id === 'hp') return [sa, sb];
  const u = STAT_INFO[id].unit;
  const fine = (v: number) => (u === 'mult' ? mult(v) : u === 'pct' ? `${one(v * 100)}%` : one(v));
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
export const FACE_AT: Record<string, [number, number]> = { rowan: [14, 7], sable: [14, 8], ...PORTRAIT_FACE_AT }; // as hud.ts frames them

export interface SpriteOpts {
  /** A window on the texture [x, y, w, h]: (x, y) then places the window's top-left. */
  crop?: [number, number, number, number];
  flip?: boolean;
  tint?: number;
  /** A flat colour in place of the texture's (a silhouette's rim light, a white flash); wins over `tint`. */
  fill?: number;
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
    // (tint modes as numbers, Phaser.TintModes MULTIPLY 0 / FILL 1: this file stays free of a Phaser value import)
    if (o.fill !== undefined) img.setTint(o.fill).setTintMode(1);
    else if (o.tint === undefined) img.clearTint();
    else img.setTint(o.tint).setTintMode(0);
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

/** Which part of a top-bar strip too long to show whole is on view (`CampKit.stripRow`): it follows the one on view
 *  (`sel`) and its arrows page it. Each screen keeps its own. */
export interface StripPage {
  first: number;
  sel: number;
}

/** A top-bar strip laid out: tab i's rect (null when it's off the window), and the paging arrows (null when every tab
 *  fits). */
export interface StripRow {
  cells: Array<Rect | null>;
  prev: Rect | null;
  next: Rect | null;
  /** How many tabs the window holds. */
  k: number;
}

/** A strip's paging arrow: as tall as a tab. */
export const STRIP_ARROW_W = 9;

/** The first tab of a strip's window of `k` tabs (of `n`): it moves only to bring `sel` into view when `sel` changed
 *  since the last call (paging by the arrows leaves it alone), and never past either end. Pure. */
export function stripWindow(n: number, k: number, sel: number, page: StripPage): number {
  if (page.sel !== sel) {
    if (sel >= 0 && sel < page.first) page.first = sel;
    else if (sel >= page.first + k) page.first = sel - k + 1;
    page.sel = sel;
  }
  page.first = Math.max(0, Math.min(n - k, page.first));
  return page.first;
}

/** Turn a strip's page by `dir` windows (clamped to the ends). */
export function pageStrip(page: StripPage, row: StripRow, dir: number): void {
  page.first = Math.max(0, Math.min(row.cells.length - row.k, page.first + dir * row.k));
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
  gemsShown = 0;
  private lastGems = -1;
  gemPulse = { at: -1e9, dir: 0 };
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
    this.gemsShown = this.lastGems = this.profile.gems;
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
    // the sharper text is a screen's to turn on, frame by frame (view/hd-text.ts)
    this.texts.hd = this.topTexts.hd = null;
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
    if (this.lastGems >= 0 && p.gems !== this.lastGems) {
      this.gemPulse = { at: now, dir: Math.sign(p.gems - this.lastGems) };
      this.lastGems = p.gems;
    }
    const roll = (shown: number, to: number) => {
      const d = to - shown;
      if (Math.abs(d) < 0.5) return to;
      return shown + d * Math.min(1, dt / 90) + Math.sign(d) * Math.min(Math.abs(d), dt / 60);
    };
    this.coinsShown = roll(this.coinsShown, p.coins);
    this.scrapShown = roll(this.scrapShown, p.scrap);
    this.gemsShown = roll(this.gemsShown, p.gems);
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
    const pieceW = (c: { icon: string; n: number }) => pixSize(c.icon)[0] + 2 + textWidth(whole(c.n), 1, true);
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
        texts.text(whole(c.n), cx, cy, c.short ? 0xff8a7a : c.icon === 'coin' ? GOLD_TXT : c.icon === 'gem' ? GEM_TXT : SCRAP_TXT, { bold: true, oy: 0.5, alpha: o.alpha });
        cx += textWidth(whole(c.n), 1, true) + 5;
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
    const txt = whole(value);
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
  purseRects(right: number, y: number, tight = false): { coins: Rect; scrap: Rect } {
    const t = tight ? 1 : 0;
    const sw = Math.max(30 - 2 * t, textWidth(whole(this.scrapShown), 1, true) + 16 - t);
    const cw = Math.max(30 - 2 * t, textWidth(whole(this.coinsShown), 1, true) + 16 - t);
    const scrap = { x: right - sw, y, w: sw, h: 12 };
    return { coins: { x: scrap.x - 4 + t - cw, y, w: cw, h: 12 }, scrap };
  }

  /** Just the coins, in `r`. */
  coinsTag(g: G, texts: TextPool, r: Rect, now: number): void {
    this.counter(g, texts, r, 'coin', this.coinsShown, this.coinPulse, GOLD_TXT, now);
  }

  /** Coins and scrap, right-aligned at `right` (returns their tags); `tight` packs them closer (the camp's top bar,
   *  which holds the gems too). */
  purse(g: G, texts: TextPool, right: number, y: number, now: number, tight = false): { coins: Rect; scrap: Rect } {
    const r = this.purseRects(right, y, tight);
    this.counter(g, texts, r.scrap, 'scrap', this.scrapShown, this.scrapPulse, SCRAP_TXT, now);
    this.counter(g, texts, r.coins, 'coin', this.coinsShown, this.coinPulse, GOLD_TXT, now);
    return r;
  }

  /** Something over the whole camp screen this frame (a wipe, a tip, a story box, the finisher reveal, a toast): no
   *  sharper text under it (view/hd-text.ts). */
  hdCovered(now: number): boolean {
    return !!this.toastNow || screenCovered(this.s, now, true);
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
  /** A count bubble on a button's top-right corner, kept inside its right edge (it sat half over the next button). */
  bubbleOn(g: G, texts: TextPool, r: Rect, txt: string, now: number, gold = false): void {
    const w = Math.max(9, textWidth(txt, 1, gold) + 4);
    this.bubble(g, texts, r.x + r.w - 1 - Math.max(0, Math.ceil(w / 2) - 2), r.y - 3, txt, now, gold);
  }

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

  /** A hero style's chip ("Blade" with a sword, "Shadow" with two daggers...) with its left end at x; returns its width. */
  familyChip(g: G, texts: TextPool, family: StyleId, x: number, cy: number, alpha = 1): number {
    const label = STYLES[family].name;
    const look = STYLE_LOOK[family];
    const [iw, ih] = pixSize(look.icon);
    const w = familyChipW(family);
    const r = { x, y: Math.round(cy - 5), w, h: 10 };
    tag(g, r, look.face, alpha);
    pix(g, look.icon, r.x + 1, Math.round(cy - ih / 2), alpha);
    texts.text(label, r.x + iw + 3, cy, WHITE, { oy: 0.5, alpha });
    return w;
  }

  /**
   * A frame in a rarity's colours round a card (heroes and companions): ink, a band lit top-left and shaded
   * bottom-right, a dark well. Celestial and Divine get their corner twinkles (art-rarity.ts). `dark` greys it out.
   */
  rarityFrame(g: G, r: Rect, tier: Tier, now: number, o: { dark?: boolean; alpha?: number; depth?: number } = {}): void {
    const a = o.alpha ?? 1;
    const [hi, base, lo, deep] = o.dark ? ([0x6a6078, 0x4a4058, 0x3a3048, 0x2a2438] as const) : TIER_INFO[tier].face;
    rows(g, r.x - 1, r.y + 2, r.w + 2, r.h + 1, 3, INK, 0.5 * a);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK, a);
    rows(g, r.x, r.y, r.w, r.h, 2, base, a);
    g.fillStyle(hi, a);
    g.fillRect(r.x + 2, r.y, r.w - 4, 1);
    g.fillRect(r.x, r.y + 2, 1, r.h - 4);
    g.fillStyle(deep, a);
    g.fillRect(r.x + 2, r.y + r.h - 1, r.w - 4, 1);
    g.fillRect(r.x + r.w - 1, r.y + 2, 1, r.h - 4);
    g.fillStyle(lo, a);
    g.fillRect(r.x + 1, r.y + r.h - 2, r.w - 2, 1);
    rows(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 1, INK, a);
    g.fillStyle(mix(deep, INK, o.dark ? 0.7 : 0.55), a);
    g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
    // corner studs
    g.fillStyle(o.dark ? 0x8a80a0 : mix(hi, WHITE, 0.4), a);
    g.fillRect(r.x + 1, r.y + 1, 1, 1);
    g.fillRect(r.x + r.w - 2, r.y + 1, 1, 1);
    // the top tiers twinkle at two corners
    const info = TIER_INFO[tier];
    if (!o.dark && info.sparkle !== 'none') {
      const c = Math.floor(now / 150) % 4;
      const key = info.sparkle === 'stars' ? 'rarity_sparkle_celestial' : 'rarity_shine_divine';
      if (this.has(`${key}_${c}`)) {
        this.imgs.at(`${key}_${c}`, r.x - 3, r.y - 3, (o.depth ?? D.icons) + 0.002, a);
        this.imgs.at(`${key}_${(c + 2) % 4}`, r.x + r.w - 4, r.y + r.h - 4, (o.depth ?? D.icons) + 0.002, a);
      }
    }
  }

  /** Stars 1-5 as star icons (lit ones gold); returns the row's width. */
  starRow(g: G, x: number, y: number, stars: number, o: { alpha?: number; max?: number; step?: number } = {}): number {
    const max = o.max ?? 5;
    const step = o.step ?? 9;
    for (let i = 0; i < max; i++) hudIcon(g, i < stars ? 'star_on' : 'star_off', x + i * step, y, 1, o.alpha ?? 1);
    return (max - 1) * step + 9;
  }

  /** A rarity's name as a small tag in its colours; returns its width. */
  rarityTag(g: G, texts: TextPool, tier: Tier, x: number, cy: number, alpha = 1): number {
    const info = TIER_INFO[tier];
    const w = textWidth(info.name, 1, true) + 8;
    tag(g, { x, y: Math.round(cy - 5), w, h: 10 }, info.face, alpha);
    texts.text(info.name, x + w / 2, cy, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha });
    return w;
  }

  /** The gems counter (the shrine's currency), right-aligned at `right`; returns its rect. */
  gemsTag(g: G, texts: TextPool, right: number, y: number, now: number): Rect {
    const p = this.profile;
    if (this.lastGems < 0) this.gemsShown = this.lastGems = p.gems;
    const w = Math.max(28, textWidth(whole(this.gemsShown), 1, true) + 18);
    const r = { x: right - w, y, w, h: 12 };
    this.counter(g, texts, r, 'gem', this.gemsShown, this.gemPulse, GEM_TXT, now);
    return r;
  }

  /** "Lv 7" and an XP bar with "120/300 XP" (or "Max level") in the rect; returns the bar's rect. */
  xpBar(g: G, texts: TextPool, id: HeroId, r: Rect, o: { alpha?: number; small?: boolean } = {}): Rect {
    const L = this.level(id);
    const lv = `Lv ${L.level}`;
    const lw = textWidth(lv, 1, true);
    texts.text(lv, r.x, r.y + r.h / 2, GOLD_TXT, { bold: true, oy: 0.5, alpha: o.alpha });
    const xp = L.need ? `${whole(L.into)}/${whole(L.need)} XP` : 'Max level';
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
   * Boxes of `widths` laid out in a row from x0, `gap` apart, hopping over the HTML buttons in the top bar's middle
   * (hudZone). Null if they don't all fit before `right`.
   */
  topRow(widths: number[], x0: number, right: number, gap = 3, y = 3, h = 13): Rect[] | null {
    const z = this.hudZone();
    let x = x0;
    const out: Rect[] = [];
    for (const w of widths) {
      if (x < z.x + z.w + 2 && x + w > z.x - 2) x = z.x + z.w + 3;
      if (x + w > right) return null;
      out.push({ x, y, w, h });
      x += w + gap;
    }
    return out;
  }

  /**
   * A strip of `n` tabs in the top bar from x0, hopping over the HTML buttons in its middle (hudZone) and never past
   * `right`: 15 px tabs 2 apart, else 13 px tabs 1 apart; when even those don't all fit (sixteen heroes beside a
   * Dynamic Island), as many 13 px tabs as fit between two small arrows that page them, the window following `sel`
   * (the one on view) whenever that changes.
   */
  stripRow(n: number, x0: number, right: number, sel: number, page: StripPage): StripRow {
    for (const [w, gap] of [
      [15, 2],
      [13, 1],
    ] as const) {
      const rs = this.topRow(Array(n).fill(w), x0, right, gap);
      if (rs) return { cells: rs, prev: null, next: null, k: n };
    }
    const A = STRIP_ARROW_W;
    let k = n - 1;
    let rs: Rect[] | null = null;
    while (k > 1 && !(rs = this.topRow([A, ...Array(k).fill(13), A], x0, right, 1))) k--;
    rs ??= this.topRow([A, 13, A], x0, 1e9, 1)!;
    k = rs.length - 2;
    stripWindow(n, k, sel, page);
    const cells: Array<Rect | null> = Array(n).fill(null);
    for (let i = 0; i < k; i++) cells[page.first + i] = rs[1 + i];
    return { cells, prev: rs[0], next: rs[k + 1], k };
  }

  /**
   * The top bar's hero tabs, right after Back (they name the screen): `all` shows locked heroes too (dark faces, a
   * padlock). Named tabs while they fit before `right` (hopping over the HTML buttons in the bar's middle: hudZone);
   * when there are too many heroes for names, each tab is the hero's face, and when the faces don't all fit, a window
   * of them pages between two arrows (`stripRow`: `view` is the hero on view, `page` the screen's window).
   */
  heroTabs(all: boolean, right: number, view: HeroId, page: StripPage): { tabs: Array<{ id: HeroId; r: Rect; locked: boolean; face: boolean }>; row: StripRow | null } {
    const p = this.profile;
    const b = this.backRect();
    const ids = HERO_IDS.filter((id) => all || heroOwned(p, id));
    const locked = (id: HeroId) => !heroOwned(p, id);
    const named = ids.map((id) => textWidth(locked(id) ? '???' : HEROES[id].name, 1, true) + 9 + (id === p.hero || locked(id) ? 9 : 0));
    const x0 = b.x + b.w + 4;
    const rs = ids.length <= 4 ? this.topRow(named, x0, right) : null;
    if (rs) return { tabs: ids.map((id, i) => ({ id, r: rs[i], locked: locked(id), face: false })), row: null };
    const row = this.stripRow(ids.length, x0, right, ids.indexOf(view), page);
    const tabs = ids.flatMap((id, i) => (row.cells[i] ? [{ id, r: row.cells[i]!, locked: locked(id), face: true }] : []));
    return { tabs, row };
  }

  /** The hero tabs: the one on view gold and sunk, the picked one with a check, a locked one with a padlock (named
   *  tabs) or a dark face (face tabs). */
  drawHeroTabs(g: G, tabs: Array<{ id: HeroId; r: Rect; locked: boolean; face: boolean }>, view: HeroId, now: number): void {
    for (const { id, r, locked, face } of tabs) {
      const on = view === id;
      const pr = isPressed(r, now) || on;
      if (on) glow(g, r, 0xffd23a, 0.25, 2);
      if (face) {
        this.faceTab(g, r, id, on, locked, now);
        continue;
      }
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

  /** A hero as a small tab: their face in a frame of their rarity's colours (gold and lifted when it's on view), a
   *  check in the corner for the picked one, dark for one not met yet. */
  faceTab(g: G, r: Rect, id: HeroId, on: boolean, locked: boolean, now: number): void {
    const pr = isPressed(r, now);
    const y = r.y + (on ? -1 : pr ? 1 : 0);
    const face = locked ? ([0x6a6078, 0x4a4058, 0x3a3048, 0x2a2438] as const) : TIER_INFO[HEROES[id].rarity].face;
    rows(g, r.x - 1, y - 1, r.w + 2, r.h + 2, 2, INK);
    rows(g, r.x, y, r.w, r.h, 2, on ? GOLD[3] : face[1]);
    g.fillStyle(on ? GOLD[4] : face[0], 1);
    g.fillRect(r.x + 2, y, r.w - 4, 1);
    g.fillStyle(on ? GOLD[1] : face[3], 1);
    g.fillRect(r.x + 2, y + r.h - 1, r.w - 4, 1);
    g.fillStyle(locked ? 0x120e1e : 0x1a2c52, 1);
    g.fillRect(r.x + 2, y + 1, r.w - 4, r.h - 3);
    const n = Math.min(r.w - 4, r.h - 3);
    this.face(id, r.x + 2, y + 1, D.icons, { size: n, tint: locked ? 0x2a2040 : undefined });
    if (id === this.profile.hero && !locked) pix(this.gOver, 'check', r.x + r.w - 6, y - 3);
  }

  /**
   * Where the tuning panel's gear button sits in the top bar's middle (an HTML button over the canvas, right of the
   * hidden pause button: style.css #hud), and the Test lab's Done beside it while a scenario plays: keep the top bar
   * clear of them.
   */
  hudZone(): Rect {
    const l = this.app.layout;
    const vw = typeof window !== 'undefined' ? window.innerWidth : l.cssW;
    const cx = ((vw / 2 - l.left) * GAME_W) / l.cssW;
    const z = { x: Math.floor(cx - 1), y: 0, w: 19, h: 19 };
    // the Test lab's Done button sits right of the gear while a scenario plays: keep the top bar clear of it too
    const done = typeof document !== 'undefined' ? document.getElementById('btn-lab-done') : null;
    if (done && !done.hidden) {
      const right = ((done.getBoundingClientRect().right - l.left) * GAME_W) / l.cssW;
      if (right > z.x + z.w) z.w = Math.ceil(right - z.x);
    }
    return z;
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

