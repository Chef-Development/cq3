// The act map: a little living world seen from above (art-map.ts paints it per act and per map). Roads run from
// clearing to clearing, left to right, to the boss's lair at the far right. Rowan (with Pip flapping beside him)
// stands where he is; the clearings he can reach next glow and bounce, and their roads shimmer. Tapping one
// walks him along the road to it, then the node opens. Fight nodes show the enemies waiting there.
//
// Performance: the landscape is a pre-rendered texture (LAND_FRAMES frames cycled for the wind sway), rebuilt
// only when the map or the layout changes; each frame moves a few dozen images and draws a few hundred rects.
// Everything animates from draw(now) (and the walk from performance.now()), so screenshots are repeatable.
import type Phaser from 'phaser';
import type { MapNode } from '../../core/map';
import type { FightScene } from '../scene';
import type { Theme } from '../backdrop';
import { LAIR_SPOTS, LAND_FRAMES, MINI_FOES, ROWAN_FEET, paintLand, trail, type Land, type Pt } from '../art-map';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { heroMaxHp } from '../../core/combat';
import { hpBar, hudIcon, iconSize, rows } from './pixels';
import { clamp01, INK, WHITE, type Rect } from './shared';
import { TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

/** Walking speed along the road; a walk always takes 500-750 ms. */
const WALK_MS_PER_PX = 17;
const WALK_MIN = 500;
const WALK_MAX = 750;
const SWAY_MS = 420;
/** What each node type is called (the label under the next nodes). */
const NODE_NAME: Record<string, string> = { fight: 'Fight', elite: 'Elite', treasure: 'Treasure', rest: 'Rest', shop: 'Shop', event: '?', boss: 'Boss' };
const NODE_COL: Record<string, number> = { fight: 0xeef3fa, elite: 0xff8a76, treasure: 0xffe680, rest: 0xffb070, shop: 0xa8f590, event: 0x9ad8ff, boss: 0xff8a76 };

// depths (the map owns 30.0-30.9)
const D_LAND = 30.05;
const D_GROUND = 30.2;
const D_LAIR = 30.42;
const D_ICON = 30.5;
const D_HERO = 30.6;
const D_AIR = 30.7;
const D_SKY = 30.78;
const D_HUD = 30.85;
const D_TEXT = 30.9;

/** Images handed out in draw order each frame; the ones not used this frame are hidden. */
class ImagePool {
  private items: Array<{ img: Img; key: string; depth: number }> = [];
  private used = 0;
  private sizes = new Map<string, [number, number]>();

  constructor(private readonly s: FightScene) {}

  begin(): void {
    this.used = 0;
  }

  size(key: string): [number, number] {
    let z = this.sizes.get(key);
    if (!z) {
      const src = this.s.textures.get(key).getSourceImage() as HTMLCanvasElement;
      z = [src.width, src.height];
      this.sizes.set(key, z);
    }
    return z;
  }

  /** A sprite with its top-left at (x, y), whole pixels. */
  at(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    let it = this.items[this.used];
    if (!it) {
      it = { img: this.s.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth), key, depth };
      this.items.push(it);
    }
    this.used++;
    if (it.key !== key) {
      it.img.setTexture(key);
      it.key = key;
    }
    if (it.depth !== depth) {
      it.img.setDepth(depth);
      it.depth = depth;
    }
    it.img.setPosition(Math.round(x), Math.round(y)).setAlpha(alpha).setVisible(true);
    if (tint === undefined) it.img.clearTint();
    else it.img.setTint(tint);
    return it.img;
  }

  /** A sprite standing with its bottom centre at (x, y). */
  foot(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    const [w, h] = this.size(key);
    return this.at(key, Math.round(x) - (w >> 1), Math.round(y) - h, depth, alpha, tint);
  }

  /** A sprite centred on (x, y). */
  mid(key: string, x: number, y: number, depth: number, alpha = 1, tint?: number): Img {
    const [w, h] = this.size(key);
    return this.at(key, Math.round(x) - (w >> 1), Math.round(y) - (h >> 1), depth, alpha, tint);
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].img.setVisible(false);
  }

  hide(): void {
    this.begin();
    this.end();
  }

  /** Drop every image (the textures are rebuilt on a new layout). */
  destroy(): void {
    for (const it of this.items) it.img.destroy();
    this.items = [];
    this.used = 0;
    this.sizes.clear();
  }
}

interface Road {
  a: number; // node id, -1 = the start
  b: number;
  pts: Pt[];
  /** The road's pixels outside the two clearings, as horizontal runs [x, y, w]. */
  runs: Array<[number, number, number]>;
}

/** Pixel ellipse (filled), row by row. */
function ellipse(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  for (let y = -Math.floor(ry); y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (half > 0) g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2, 1);
  }
}

/** Pixel ellipse outline, `t` px thick. */
function ring(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  for (let y = -Math.floor(ry); y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    const inner = Math.abs(y) >= Math.floor(ry) ? 0 : Math.round((rx - 1.6) * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry - 1) * (ry - 1)))));
    if (half <= 0) continue;
    if (inner <= 0 || Math.abs(y) >= ry - 1) g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2, 1);
    else {
      g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half - inner, 1);
      g.fillRect(Math.round(cx) + inner, Math.round(cy) + y, half - inner, 1);
    }
  }
}

/** A 4-point sparkle (white core, coloured arms). */
function sparkle(g: G, x: number, y: number, color: number, alpha: number, big = false): void {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle(color, alpha);
  g.fillRect(x - 1, y, 3, 1);
  g.fillRect(x, y - 1, 1, 3);
  if (big) {
    g.fillRect(x - 2, y, 1, 1);
    g.fillRect(x + 2, y, 1, 1);
    g.fillRect(x, y - 2, 1, 1);
    g.fillRect(x, y + 2, 1, 1);
  }
  g.fillStyle(WHITE, alpha);
  g.fillRect(x, y, 1, 1);
}

/** A crisp dark plate: drop shadow, ink rim, a 1px light inner edge, a two-tone fill and a top highlight. */
function plate(g: G, x: number, y: number, w: number, h: number): void {
  rows(g, x, y + 2, w, h, 2, 0x000000, 0.4);
  rows(g, x, y, w, h, 2, INK, 1);
  rows(g, x + 1, y + 1, w - 2, h - 2, 1, 0x58507a, 1);
  rows(g, x + 2, y + 2, w - 4, h - 4, 1, 0x1a1628, 1);
  g.fillStyle(0x221d34, 1);
  g.fillRect(x + 2, y + 2, w - 4, Math.floor((h - 4) / 2));
  g.fillStyle(0x9a90c8, 1);
  g.fillRect(x + 3, y + 1, w - 6, 1);
}

export class MapView {
  private gGround!: G;
  private gAir!: G;
  private gHud!: G;
  private land: Img | null = null;
  private landKeys: string[] = [];
  private landFor: unknown = null;
  private landLayout = '';
  private landGen = 0;
  private landData: Land | null = null;
  private landTheme: Theme = 'forest';
  private roads: Road[] = [];
  private pool: ImagePool;
  private texts: TextPool;
  private walk: { id: number; pts: Pt[]; at: number; dur: number } | null = null;
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, D_TEXT);
    this.pool = new ImagePool(s);
  }

  /** New layout: everything is rebuilt on the next draw. */
  build(): void {
    const s = this.s;
    this.rect = { x: s.L, y: 0, w: s.R - s.L, h: s.B };
    this.gGround?.destroy();
    this.gAir?.destroy();
    this.gHud?.destroy();
    this.gGround = s.add.graphics().setDepth(D_GROUND);
    this.gAir = s.add.graphics().setDepth(D_AIR);
    this.gHud = s.add.graphics().setDepth(D_HUD);
    this.land?.destroy();
    this.land = null;
    this.landFor = null;
    this.pool.destroy();
  }

  // ------------------------------------------------------------------ layout

  /** The span the columns of nodes spread over: the start (left) to the boss (right). */
  private span() {
    const s = this.s;
    return { x0: s.L + 18, x1: s.R - 27, top: 37, bottom: s.B - 25 };
  }

  /** Where a node sits on the map (game px). Null is the start, on the left edge. */
  pos(n: MapNode | null): [number, number] {
    const { x0, x1, top, bottom } = this.span();
    const run = this.s.app.run;
    const cols = run.map.rows.length + 1;
    const dx = (x1 - x0) / (cols - 1);
    if (!n) return [Math.round(x0), Math.round((top + bottom) / 2)];
    const jitter = (k: number) => (((n.id * 97 + k * 31) % 7) - 3) * 0.8;
    const x = x0 + (n.row + 1) * dx + (n.type === 'boss' ? 0 : jitter(1));
    const y = n.type === 'boss' ? (top + bottom) / 2 : top + ((n.col + 0.5) * (bottom - top)) / n.of + jitter(2);
    return [Math.round(x), Math.round(y)];
  }

  /** The reachable node under a tap, if any. */
  nodeAt(x: number, y: number): number | null {
    if (this.walk) return null;
    const run = this.s.app.run;
    let best: number | null = null;
    let bestD = 15;
    for (const id of run.choices()) {
      const [nx, ny] = this.pos(run.map.nodes[id]);
      const d = Math.hypot(nx - x, ny - y);
      if (d < bestD) (best = id), (bestD = d);
    }
    return best;
  }

  /** Walk Rowan along the road to node `id`, then enter it. */
  choose(id: number): void {
    const s = this.s;
    const run = s.app.run;
    if (this.walk || !run.choices().includes(id)) return;
    this.ensureLand();
    const from = run.node?.id ?? -1;
    const road = this.roads.find((r) => r.a === from && r.b === id);
    const pts = road ? road.pts : [this.pos(run.node), this.pos(run.map.nodes[id])];
    const dur = Math.max(WALK_MIN, Math.min(WALK_MAX, pts.length * WALK_MS_PER_PX));
    this.walk = { id, pts, at: performance.now(), dur };
    s.app.audio.mapSelect();
    window.setTimeout(() => {
      this.walk = null;
      if (s.app.run.phase === 'map') s.app.setPhase(() => s.app.run.chooseNode(id));
    }, dur + 40);
  }

  // ------------------------------------------------------------------ the landscape

  /** (Re)paint the landscape when the map or the layout changed. */
  private ensureLand(): void {
    const s = this.s;
    const run = s.app.run;
    const map = run.map;
    const layout = `${s.L},${s.R},${s.B}`;
    if (this.landFor === map && this.landLayout === layout && this.land) return;
    this.landFor = map;
    this.landLayout = layout;
    const theme = (run.act.theme ?? 'forest') as Theme;
    this.landTheme = theme;
    // the roads: the start to the first row, then every link
    this.roads = [];
    const start = this.pos(null);
    const add = (a: number, b: number, pa: Pt, pb: Pt) => this.roads.push({ a, b, pts: trail(pa, pb, (a + 7) * 131 + b * 17 + run.actIndex * 7), runs: [] });
    for (const id of map.rows[0]) add(-1, id, start, this.pos(map.nodes[id]));
    for (const n of map.nodes) for (const c of n.next) add(n.id, c, this.pos(n), this.pos(map.nodes[c]));
    const pads = [
      { x: start[0], y: start[1], r: 8, start: true },
      ...map.nodes.map((n) => {
        const [x, y] = this.pos(n);
        return { x, y, r: n.type === 'boss' ? 16 : 9 };
      }),
    ];
    // each road's own pixels, outside the clearings at both ends
    for (const r of this.roads) {
      const pa = r.a < 0 ? start : this.pos(map.nodes[r.a]);
      const pb = this.pos(map.nodes[r.b]);
      const rb = map.nodes[r.b].type === 'boss' ? 16 : 9;
      const seen = new Set<number>();
      const runs = new Map<number, number[]>();
      for (const [x, y] of r.pts) {
        if (Math.hypot((x - pa[0]) / 9, (y - pa[1] - 2) / 5.4) < 1 || Math.hypot((x - pb[0]) / rb, (y - pb[1] - 2) / (rb * 0.6)) < 1) continue;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            if (Math.abs(i) + Math.abs(j) > 1) continue;
            const px = Math.round(x) + i;
            const py = Math.round(y) + j;
            const k = py * 1000 + px;
            if (seen.has(k)) continue;
            seen.add(k);
            if (!runs.has(py)) runs.set(py, []);
            runs.get(py)!.push(px);
          }
      }
      for (const [y, xs] of runs) {
        xs.sort((a, b) => a - b);
        let x0 = xs[0];
        let prev = xs[0];
        for (let i = 1; i <= xs.length; i++) {
          if (i < xs.length && xs[i] === prev + 1) {
            prev = xs[i];
            continue;
          }
          r.runs.push([x0, y, prev - x0 + 1]);
          if (i < xs.length) x0 = prev = xs[i];
        }
      }
    }
    const cols: number[] = [];
    const { x0, x1 } = this.span();
    const n = map.rows.length + 1;
    for (let i = 0; i < n; i++) cols.push(x0 + ((x1 - x0) * i) / (n - 1));
    // the icons standing on the clearings, their labels, Rowan at the start, the lair: no scenery over them
    const zones = [{ x: start[0] - 15, y: start[1] - 20, w: 24, h: 24 }];
    for (const n of map.nodes) {
      const [x, y] = this.pos(n);
      if (n.type === 'boss') {
        const [lw, lh] = this.pool.size(`maplair_${theme}`);
        zones.push({ x: x - lw / 2 - 1, y: y + 2 - lh, w: lw + 2, h: lh + 2 }, { x: x - 30, y: y + 10, w: 60, h: 10 });
      } else zones.push({ x: x - 9, y: y - 13, w: 18, h: 14 }, { x: x - 13, y: y + 9, w: 26, h: 8 });
    }
    const keep = [
      { x: s.L, y: 0, w: 116, h: 32 },
      { x: s.R - 56, y: 0, w: 56, h: 32 },
      { x: GAME_W / 2 - 22, y: 0, w: 44, h: 20 },
      { x: s.L, y: s.B - 22, w: 96, h: 22 },
      { x: s.R - 140, y: s.B - 22, w: 140, h: 22 },
      // the landmarks belong in sight: not behind the island, the rounded corners or the home bar
      { x: 0, y: 0, w: s.L + 6, h: GAME_H },
      { x: s.R - 6, y: 0, w: GAME_W - s.R + 6, h: GAME_H },
      { x: 0, y: s.B - 6, w: GAME_W, h: GAME_H - s.B + 6 },
    ];
    const land = paintLand({ theme, w: GAME_W, h: GAME_H, pads, trails: this.roads.map((r) => r.pts), cols, keep, zones, seed: (run.mapSeedFor(run.actIndex) % 9973) + 1 });
    this.landData = land;
    const old = this.landKeys;
    this.landGen++;
    this.landKeys = land.frames.map((c, i) => {
      const key = `mapland_${this.landGen}_${i}`;
      s.textures.addCanvas(key, c);
      return key;
    });
    if (!this.land) this.land = s.add.image(0, 0, this.landKeys[0]).setOrigin(0, 0).setDepth(D_LAND);
    else this.land.setTexture(this.landKeys[0]);
    for (const k of old) if (s.textures.exists(k)) s.textures.remove(k);
  }

  private hide(): void {
    this.gGround.clear();
    this.gAir.clear();
    this.gHud.clear();
    this.land?.setVisible(false);
    this.pool.hide();
    this.texts.hide();
  }

  // ------------------------------------------------------------------ frame

  draw(now: number): void {
    const s = this.s;
    const run = s.app.run;
    if (run.phase !== 'map') return this.hide();
    this.ensureLand();
    const gg = this.gGround;
    const ga = this.gAir;
    gg.clear();
    ga.clear();
    this.gHud.clear();
    this.pool.begin();
    this.texts.begin();
    const map = run.map;
    const theme = this.landTheme;
    const frame = this.landKeys[Math.floor(now / SWAY_MS) % LAND_FRAMES];
    if (this.land && this.land.texture.key !== frame) this.land.setTexture(frame);
    this.land?.setVisible(true);

    const path = run.path;
    const here = run.node;
    const hereId = here?.id ?? -1;
    const choices = run.choices();
    const row = here ? here.row : -1;
    const walked = (a: number, b: number) => (a < 0 ? path[0] === b : path.indexOf(a) >= 0 && path[path.indexOf(a) + 1] === b);

    // ---- roads: the way behind is worn and trodden, the ways ahead shimmer, the roads not taken fade
    for (const r of this.roads) {
      if (walked(r.a, r.b)) {
        gg.fillStyle(0x3a1a08, 0.38);
        for (const [x, y, w] of r.runs) gg.fillRect(x, y, w, 1);
        this.footprints(gg, r.pts);
      } else if (r.a === hereId && !this.walk) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 260);
        gg.fillStyle(0xfff0a0, 0.16 + 0.14 * pulse);
        for (const [x, y, w] of r.runs) gg.fillRect(x, y, w, 1);
        this.shimmer(gg, r.pts, now);
      }
    }
    if (this.walk && this.walk.id >= 0) {
      // the road being walked lights up behind Rowan
      const r = this.roads.find((q) => q.a === hereId && q.b === this.walk!.id);
      if (r) {
        gg.fillStyle(0xfff0a0, 0.25);
        for (const [x, y, w] of r.runs) gg.fillRect(x, y, w, 1);
      }
    }

    // ---- nodes
    map.nodes.forEach((n) => {
      const [x, y] = this.pos(n);
      const visited = path.includes(n.id);
      const next = choices.includes(n.id) && !this.walk;
      const target = this.walk?.id === n.id;
      const passed = !visited && n.row <= row;
      if (n.type === 'boss') return this.boss(n, x, y, now, next || target);
      const dim = passed ? 0.5 : 1;
      const tint = passed ? 0x8a8a9a : undefined;
      // the glow under a clearing Rowan can go to
      let bounce = 0;
      if (next || target) {
        const k = (now % 1000) / 1000;
        ellipse(gg, x, y + 2, 10, 6, 0xfff0a0, 0.34 - 0.14 * k);
        ring(gg, x, y + 2, 9 + 4 * k, 5.4 + 2.4 * k, 0xfff8c0, 0.8 * (1 - k));
        ring(gg, x, y + 2, 10, 6, 0xffe680, 0.9);
        bounce = target ? 0 : Math.abs(Math.sin(now / 190)) * 2.4;
        this.label(NODE_NAME[n.type] ?? '', x, y + 13, NODE_COL[n.type] ?? WHITE);
      }
      if (visited) {
        // been here: Rowan's pennant, and what's left (an open chest, embers, the stall)
        this.pool.foot('mn_flag', x - 7, y + 4, D_ICON, 0.95);
        const left = n.type === 'treasure' ? 'mn_chest_open' : n.type === 'rest' ? 'mn_embers' : n.type === 'shop' ? 'mn_stall' : '';
        if (left && n.id !== hereId) this.pool.foot(left, x + 1, y + 6, D_ICON - 0.01, 0.8);
        return;
      }
      this.nodeIcon(n, x, y, now, Math.round(bounce), dim, tint, next);
    });

    // ---- Rowan and Pip
    this.hero(now);

    // ---- critters, flames, the weather
    this.ambient(now, theme);

    // ---- HUD
    this.hud(now);

    this.pool.end();
    this.texts.end();
  }

  /** Boot prints along a road (2 px long, alternating sides). */
  private footprints(g: G, pts: Pt[]): void {
    const [ax, ay] = pts[0];
    const [bx, by] = pts[pts.length - 1];
    for (let i = 2, k = 0; i < pts.length - 2; i += 4, k++) {
      const [x, y] = pts[i];
      if (Math.hypot(x - ax, (y - ay) * 1.6) < 9 || Math.hypot(x - bx, (y - by) * 1.6) < 9) continue;
      const [x2, y2] = pts[Math.min(pts.length - 1, i + 1)];
      const nx = -(y2 - y);
      const ny = x2 - x;
      const side = k % 2 ? 0.6 : -0.6;
      const px = Math.round(x + nx * side);
      const py = Math.round(y + ny * side);
      g.fillStyle(0x24100a, 0.75);
      g.fillRect(px, py, 2, 1);
      g.fillStyle(0xe0bc84, 0.35);
      g.fillRect(px, py + 1, 2, 1);
    }
  }

  /** Sparkles travelling along a road toward the node it leads to. */
  private shimmer(g: G, pts: Pt[], now: number): void {
    const len = pts.length;
    const lo = 8;
    const hi = len - 9;
    if (hi <= lo) return;
    const span = hi - lo;
    const n = Math.max(2, Math.round(span / 9));
    for (let j = 0; j < n; j++) {
      const t = ((now / 1000) * 0.9 + j / n) % 1;
      const i = Math.floor(lo + t * span);
      const fade = Math.min(1, t * 5, (1 - t) * 5);
      const [x, y] = pts[i];
      sparkle(g, x, y, 0xffe680, 0.9 * fade, false);
    }
  }

  private label(str: string, x: number, y: number, color: number): void {
    const s = this.s;
    const w = textWidth(str, 1, false);
    const lx = Math.max(s.L + 2 + w / 2, Math.min(s.R - 2 - w / 2, x));
    this.texts.text(str, lx, y, color, { ox: 0.5, oy: 0.5 });
  }

  /** What waits at a node: the enemies, a campfire, a chest, the stall, a "?". */
  private nodeIcon(n: MapNode, x: number, y: number, now: number, bounce: number, alpha: number, tint: number | undefined, next: boolean): void {
    const P = this.pool;
    const g = this.gGround;
    const a = this.gAir;
    const ph = n.id * 377;
    switch (n.type) {
      case 'fight':
      case 'elite': {
        const sprites = n.enemies.map((k) => this.s.app.tuning.enemies[k]?.sprite ?? k);
        const lead = sprites[0];
        const second = sprites[1];
        if (n.type === 'elite') {
          const k = 0.5 + 0.5 * Math.sin((now + ph) / 300);
          ellipse(g, x, y + 4, 8, 3.5, 0xd03030, (0.3 + 0.2 * k) * alpha);
        }
        ellipse(g, x, y + 5, 6, 1.6, 0x000000, 0.3 * alpha);
        if (second) {
          const b2 = Math.floor((now + ph + 200) / 420) % 2;
          P.foot(this.mini(second, now + ph + 200), x - 5, y + 3 - b2 - bounce, D_ICON - 0.01, alpha, tint);
        }
        const b = Math.floor((now + ph) / 420) % 2;
        const img = P.foot(this.mini(lead, now + ph), x + (second ? 2 : 0), y + 5 - b - bounce, D_ICON, alpha, tint);
        if (n.type === 'elite') P.foot('mn_skull', x + (second ? 2 : 0) + 5, img.y - 1 + (Math.floor(now / 500) % 2), D_ICON + 0.01, alpha, tint);
        return;
      }
      case 'treasure': {
        ellipse(g, x, y + 5, 6, 1.5, 0x000000, 0.3 * alpha);
        P.foot('mn_chest', x, y + 5 - bounce, D_ICON, alpha, tint);
        // a glint skips across the lid
        const t = ((now + ph) % 1400) / 1400;
        if (t < 0.35 && alpha === 1) sparkle(a, x - 4 + Math.round(t * 22), y - 3 - bounce, 0xfff0a0, Math.sin((t / 0.35) * Math.PI), true);
        return;
      }
      case 'rest': {
        const flick = Math.floor((now + ph) / 110) % 3;
        const k = 0.5 + 0.5 * Math.sin((now + ph) / 90) * Math.sin((now + ph) / 37);
        ellipse(g, x, y + 3, 9, 4.5, 0xff9a2a, (0.14 + 0.08 * k) * alpha);
        P.foot('mn_logs', x, y + 6 - bounce, D_ICON, alpha, tint);
        P.foot(`mn_flame_${flick}`, x, y + 3 - bounce, D_ICON + 0.01, alpha, tint);
        if (alpha === 1)
          for (let j = 0; j < 3; j++) {
            const t = ((now + ph) / 900 + j / 3) % 1;
            a.fillStyle(t < 0.5 ? 0xffe680 : 0xff9a2a, 1 - t);
            a.fillRect(Math.round(x + Math.sin(t * 7 + j) * 2), Math.round(y - 3 - bounce - t * 9), 1, 1);
          }
        return;
      }
      case 'shop': {
        ellipse(g, x, y + 5, 7, 1.6, 0x000000, 0.3 * alpha);
        P.foot('mn_stall', x, y + 6 - bounce, D_ICON, alpha, tint);
        const t = ((now + ph) % 1700) / 1700;
        if (t < 0.25 && alpha === 1) sparkle(a, x, y - 1 - bounce, 0xfff0a0, Math.sin((t / 0.25) * Math.PI), true);
        return;
      }
      case 'event': {
        const float = Math.round(Math.sin((now + ph) / 300) * 1.5);
        const beat = (now + ph) % 1100 < 160;
        ellipse(g, x, y + 5, 3 + (float < 0 ? 0 : 1), 1.2, 0x000000, 0.3 * alpha);
        if (next || beat) ellipse(g, x, y + 1 - bounce + float, beat ? 7 : 6, beat ? 7 : 6, 0x9ad8ff, (beat ? 0.3 : 0.15) * alpha);
        P.foot(beat ? 'mn_q_1' : 'mn_q_0', x, y + 5 - bounce + float + (beat ? 1 : 0), D_ICON, alpha, tint);
        return;
      }
    }
  }

  /** An enemy's mini sprite key (frame by time), or the crossed swords when it has none. */
  private mini(sprite: string, t: number): string {
    if (!MINI_FOES.includes(sprite)) return 'mapicon_fight';
    const f = `mfoe_${sprite}_1`;
    return this.s.textures.exists(f) && Math.floor(t / 420) % 2 ? f : `mfoe_${sprite}_0`;
  }

  /** The boss's lair at the far right: the lair, a pulsing red aura, the boss waiting in front. */
  private boss(n: MapNode, x: number, y: number, now: number, next: boolean): void {
    const run = this.s.app.run;
    const theme = this.landTheme;
    const g = this.gGround;
    const k = 0.5 + 0.5 * Math.sin(now / 340);
    ellipse(g, x, y + 3, 17, 8, 0xb01828, 0.18 + 0.14 * k);
    ring(g, x, y + 3, 16 + k * 2, 7.5 + k, 0xff5a3a, 0.25 + 0.2 * k);
    if (next) {
      const q = (now % 1000) / 1000;
      ring(g, x, y + 3, 18 + 4 * q, 9 + 2 * q, 0xfff8c0, 0.8 * (1 - q));
      ring(g, x, y + 3, 18, 9, 0xffe680, 0.9);
    }
    const lairKey = `maplair_${theme}`;
    const footY = y + 2;
    this.pool.foot(lairKey, x, footY, D_LAIR);
    const spots = LAIR_SPOTS[theme];
    if (spots) {
      spots.flames.forEach(([fx, fy], i) => this.pool.foot(`mn_flame_${Math.floor(now / 100 + i) % 3}`, x + fx, footY + fy + 1, D_LAIR + 0.01));
      for (const [gx, gy] of spots.glows) {
        const a = 0.35 + 0.35 * Math.sin(now / 260 + gx);
        this.gAir.fillStyle(0x62e4d4, a);
        this.gAir.fillRect(Math.round(x + gx) - 1, Math.round(footY + gy) - 1, 3, 3);
        this.gAir.fillStyle(0xd8fff6, a);
        this.gAir.fillRect(Math.round(x + gx), Math.round(footY + gy), 1, 1);
      }
    }
    const sprite = run.tuning.enemies[n.enemies[0]]?.sprite ?? '';
    const b = Math.floor(now / 520) % 2;
    ellipse(g, x, y + 7, 8, 2, 0x000000, 0.35);
    this.pool.foot(this.mini(sprite, now), x + 1, y + 7 - b - (next ? Math.round(Math.abs(Math.sin(now / 190)) * 2) : 0), D_ICON);
    const name = run.tuning.enemies[n.enemies[0]]?.name ?? 'Boss';
    this.label(name, x, y + 15, next ? 0xffb0a0 : 0xff8a76);
  }

  // ------------------------------------------------------------------ Rowan

  private hero(now: number): void {
    const run = this.s.app.run;
    const g = this.gGround;
    let [x, y] = this.pos(run.node);
    y += 4;
    let key = `mrow_idle${Math.floor(now / 520) % 2}`;
    let pipLag: Pt = [x, y];
    let walking = false;
    if (this.walk) {
      const w = this.walk;
      const t = clamp01((performance.now() - w.at) / w.dur);
      const k = t * 0.6 + t * t * (3 - 2 * t) * 0.4;
      const at = (q: number) => {
        const i = Math.min(w.pts.length - 1, Math.max(0, q * (w.pts.length - 1)));
        const a = w.pts[Math.floor(i)];
        const b = w.pts[Math.min(w.pts.length - 1, Math.floor(i) + 1)];
        const f = i - Math.floor(i);
        return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + 4] as Pt;
      };
      [x, y] = at(k);
      pipLag = at(Math.max(0, k - 0.12));
      const step = Math.floor((performance.now() - w.at) / 95);
      key = `mrow_walk${step % 4}`;
      walking = true;
      // dust kicked up behind him
      for (let j = 1; j <= 3; j++) {
        const q = Math.max(0, k - j * 0.06);
        const [dx, dy] = at(q);
        this.gAir.fillStyle(0xe8d8b0, 0.5 - j * 0.14);
        this.gAir.fillRect(Math.round(dx) - 2 - j, Math.round(dy) - 1 - (j >> 1), 2, 1);
      }
    } else pipLag = [x, y];
    ellipse(g, x, y, 4, 1.4, 0x000000, 0.35);
    this.pool.at(key, Math.round(x) - ROWAN_FEET[0], Math.round(y) - ROWAN_FEET[1], D_HERO);
    // Pip flaps along beside him, a little behind
    const flap = Math.floor(now / (walking ? 90 : 160)) % 2;
    const px = pipLag[0] - 9;
    const py = pipLag[1] - 15 + Math.round(Math.sin(now / 330) * 1.5);
    ellipse(g, px, pipLag[1] + 1, 2, 0.8, 0x000000, 0.2);
    this.pool.mid(`mpip_${flap}`, px, py, D_HERO + 0.01);
  }

  // ------------------------------------------------------------------ ambient

  private ambient(now: number, theme: Theme): void {
    const land = this.landData;
    if (!land) return;
    const P = this.pool;
    const a = this.gAir;
    const t = now / 1000;
    const W = GAME_W;
    const H = GAME_H;
    if (theme === 'forest') {
      // cloud shadows drifting over the meadow
      for (let i = 0; i < 2; i++) {
        const [cw] = P.size(`ma_cloud_${i}`);
        const x = ((t * (3 + i) + i * 190) % (W + cw)) - cw;
        P.at(`ma_cloud_${i}`, x, i ? 92 : 24, D_SKY, 0.12, 0x0a1a10);
      }
      // the stream glitters as it flows
      const wv = land.water;
      if (wv.length)
        for (let j = 0; j < 14; j++) {
          const idx = Math.floor((t * 16 + j * 11.3) % wv.length);
          const [x, y] = wv[idx];
          a.fillStyle(j % 3 ? 0xd4f0f6 : WHITE, 0.55 + 0.35 * Math.sin(t * 5 + j));
          a.fillRect(Math.round(x + ((j * 7) % 3) - 1), Math.round(y), j % 2 ? 2 : 1, 1);
        }
      for (const [mx, my] of land.mills) P.mid(`ma_sails_${Math.floor(now / 240) % 3}`, mx, my, D_AIR);
      for (const [sx, sy] of land.smoke)
        for (let j = 0; j < 3; j++) {
          const q = (t / 2.2 + j / 3) % 1;
          a.fillStyle(0xe8e4dc, 0.55 * (1 - q));
          const sz = q < 0.4 ? 2 : 3;
          a.fillRect(Math.round(sx + q * 5 + Math.sin(q * 6 + j) * 1), Math.round(sy - 2 - q * 12), sz, sz - 1);
        }
      // butterflies over the open grass
      const tints = [0xffffff, 0xfff0a0, 0xffb0d0, 0xb0e0ff];
      land.spots.slice(0, 4).forEach(([bx, by], i) => {
        const x = bx + Math.sin(t * 0.7 + i * 2.1) * 10 + Math.sin(t * 1.9 + i) * 3;
        const y = by - 4 + Math.sin(t * 1.3 + i * 1.7) * 5;
        P.mid(`ma_fly_${Math.floor(now / 110 + i) % 2}`, x, y, D_AIR, 1, tints[i]);
      });
      // birds crossing now and then, their shadows racing over the ground
      for (let i = 0; i < 2; i++) {
        const cyc = W + 160;
        const x = ((t * 30 + i * 230) % cyc) - 40;
        if (x > W + 10) continue;
        const y = 14 + i * 16 + Math.sin(t * 2 + i) * 2;
        P.mid(`ma_bird_${Math.floor(now / 170 + i) % 2}`, x, y, D_SKY, 1, 0x2a2440);
        a.fillStyle(0x000000, 0.18);
        a.fillRect(Math.round(x + 14), Math.round(y + 34), 3, 1);
      }
    } else if (theme === 'ruins') {
      // braziers
      land.flames.forEach(([fx, fy], i) => {
        const k = 0.5 + 0.5 * Math.sin(now / 80 + i * 2) * Math.sin(now / 31 + i);
        ellipse(this.gGround, fx, fy + 4, 12, 7, 0xff9040, 0.08 + 0.06 * k);
        P.foot(`mn_flame_${Math.floor(now / 100 + i) % 3}`, fx, fy + 1, D_ICON);
      });
      // fog banks drifting low over the stones
      for (let i = 0; i < 3; i++) {
        const [fw] = P.size('ma_fog');
        const x = ((t * (2.5 + i * 0.8) + i * 140) % (W + fw)) - fw;
        P.at('ma_fog', x, 30 + i * 38, D_SKY, 0.13, 0xc8dce0);
      }
      // dust motes in the dusk air
      for (let j = 0; j < 16; j++) {
        const x = (j * 53.7 + t * (2 + (j % 3))) % W;
        const y = (j * 37.3 + 200 - t * (1.5 + (j % 2))) % H;
        const tw = 0.5 + 0.5 * Math.sin(t * 2.3 + j * 1.9);
        a.fillStyle(0xd8e4e0, 0.25 + 0.4 * tw);
        a.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // bats flitting about
      for (let i = 0; i < 3; i++) {
        const cx = W * (0.3 + i * 0.22);
        const x = cx + Math.sin(t * 0.8 + i * 2) * 42 + Math.sin(t * 2.6 + i) * 6;
        const y = 14 + i * 7 + Math.sin(t * 1.7 + i * 1.3) * 6 + Math.abs(Math.sin(t * 5 + i)) * 2;
        P.mid(`ma_bat_${Math.floor(now / 85 + i) % 2}`, x, y, D_SKY, 1, 0x1a1428);
      }
    } else {
      // fireflies blinking in the dusk
      const spots = land.spots;
      for (let j = 0; j < 12; j++) {
        const [bx, by] = spots[j % Math.max(1, spots.length)] ?? [W / 2, H / 2];
        const x = bx + Math.sin(t * 0.5 + j * 1.3) * 14 + Math.sin(t * 1.7 + j) * 3;
        const y = by + Math.sin(t * 0.7 + j * 2.1) * 8;
        const blink = Math.max(0, Math.sin(t * 1.6 + j * 1.7));
        if (blink < 0.15) continue;
        a.fillStyle(0xfff07a, blink * 0.25);
        a.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        a.fillStyle(0xfffbd0, blink);
        a.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // leaves drifting down across the whole map
      for (let i = 0; i < 14; i++) {
        const speed = 9 + (i % 5) * 1.6;
        const yy = ((t * speed + i * 41) % (H + 20)) - 10;
        const x = ((i * 67.3 + yy * 0.35 + Math.sin(t * 1.4 + i) * 5) % (W + 10)) - 5;
        P.mid(`ma_leaf_${Math.floor(now / 230 + i) % 3}`, x, yy, D_SKY);
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  private hud(now: number): void {
    const s = this.s;
    const run = s.app.run;
    const g = this.gHud;
    const T = this.texts;
    const L = s.L + 3;
    // the act (top left)
    const act = run.act;
    const actName = act.name;
    const w = Math.max(textWidth(`Act ${run.actIndex + 1}`, 1, true), textWidth(actName, 1, false)) + 14;
    plate(g, L, 3, w, 25);
    T.text(`Act ${run.actIndex + 1}`, L + 7, 10, 0xf2c230, { bold: true, oy: 0.5 });
    T.text(actName, L + 7, 20, 0xe8e0f4, { oy: 0.5 });
    // coins (top right) and rerolls
    const coins = `${run.coins}`;
    const [cw] = iconSize('coin');
    const coinW = cw + textWidth(coins, 1, true) + 14;
    const rr = run.rerolls > 0 ? `Rerolls: ${run.rerolls}` : '';
    const boxW = Math.max(coinW, rr ? textWidth(rr, 1, false) + 12 : 0);
    const cx = s.R - 3 - boxW;
    plate(g, cx, 3, boxW, rr ? 25 : 16);
    hudIcon(g, 'coin', cx + 5, 6);
    T.text(coins, cx + 7 + cw, 11, 0xffe680, { bold: true, oy: 0.5 });
    if (rr) T.text(rr, cx + 6, 21, 0x9ad8ff, { oy: 0.5 });
    // HP (bottom left)
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const hp = `${H.hp}/${max}`;
    const hpW = 20 + 34 + 6 + textWidth(hp, 1, false) + 8;
    const hy = s.B - 19;
    plate(g, L, hy, hpW, 16);
    hudIcon(g, 'heart', L + 3, hy + 1);
    hpBar(g, L + 20, hy + 6, 34, 4, H.hp / max, H.hp / max, 0xe0463c);
    T.text(hp, L + 60, hy + 8, WHITE, { oy: 0.5 });
    // the first time on a map: how to travel
    if (!run.path.length && !this.walk) {
      const hint = 'Tap a glowing spot to travel';
      const tw = textWidth(hint, 1, false) + 14;
      const k = 0.75 + 0.25 * Math.sin(now / 300);
      plate(g, s.R - 3 - tw, hy, tw, 16);
      T.text(hint, s.R - 3 - tw / 2, hy + 8, 0xffe680, { ox: 0.5, oy: 0.5, alpha: k });
    }
  }
}
