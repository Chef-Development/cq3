// The act map: a little living world seen from above (art-map.ts paints it per act and per map). Roads run from
// clearing to clearing, left to right, to the boss's lair at the far right. Rowan (with Pip flapping beside him)
// stands where he is; the clearings he can reach next glow and bounce, and their roads shimmer. Tapping one
// walks him along the road to it, then the node opens. Fight nodes show the enemies waiting there.
//
// Each reachable node carries a small tag, icon first, so the map stays about the landscape: a fight's foe count on a
// tiny skull badge (red for an elite), then what it pays out as an icon and one word (a loot bag in the drop's
// rarity colour with "Gear" / "Gear+" / "Loot", a heart "Heal", a coin "Shop", a warning "?", "Boss"). The node's
// own art says what it is. The boss's name stays under its lair. Tags are placed by a tiny solver (below, above,
// right or left of the node, whichever covers the least: other nodes, Rowan, the HUD plates, the other tags).
//
// The map's extras (the roamers and their telegraphs, the secret, the bounty tracker) are drawn by view/map-roam.ts;
// a node a roamer would meet you on shows it on its tag ("Ambush" with the pack's foes counted in, or "Trader").
//
// Performance: the landscape is a pre-rendered texture (LAND_FRAMES frames cycled for the wind sway), rebuilt
// only when the map or the layout changes; each frame moves a few dozen images and draws a few hundred rects.
// Everything animates from draw(now) (and the walk from performance.now()), so screenshots are repeatable.
import type Phaser from 'phaser';
import { whole } from '../../core/format';
import type { MapNode } from '../../core/map';
import { RARITY_INFO } from '../../data/gear';
import type { FightScene } from '../scene';
import type { Theme } from '../backdrop';
import { LAIR_SPOTS, LAND_FRAMES, ROWAN_FEET, paintLand, trail, type Land, type Pt } from '../art-map';
import { miniKey } from '../art-minis';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { heroMaxHp } from '../../core/combat';
import { roamerAt } from '../../core/roam';
import { MapRoam, type MapHost } from './map-roam';
import { bagPal, glyph, glyphSize } from './overlays';
import { band, button3d, hpBar, hudIcon, iconSize, rows } from './pixels';
import { clamp01, hpLabel, inRect, INK, mix, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, notePress, TextPool } from './ui';
import { MapLife } from './map-life';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

/** Walking speed along the road; a walk always takes 500-750 ms. */
const WALK_MS_PER_PX = 17;
const WALK_MIN = 500;
const WALK_MAX = 750;
const SWAY_MS = 420;

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

interface Road {
  a: number; // node id, -1 = the start
  b: number;
  pts: Pt[];
  /** The road's pixels outside the two clearings, as horizontal runs [x, y, w]. */
  runs: Array<[number, number, number]>;
}

/** What a node pays out: a glyph (in the drop's colors) and one word. */
interface Chip {
  text: string;
  col: number;
  icon: string;
  pal?: Record<string, number>;
}

/** A node's tag (its foe badge and reward chip on one pill; the boss's name over its chip), and where it went. */
interface Tag {
  id: number;
  /** The boss's name (a line of its own); '' for the other nodes. */
  label: string;
  labelCol: number;
  /** Foes in the fight (0: not a fight), and whether it's an elite (a red badge). */
  foes: number;
  elite: boolean;
  chip: Chip | null;
  w: number;
  h: number;
  /** Top-left of the block. */
  x: number;
  y: number;
}

const LABEL_H = 8;
const CHIP_H = 11;
/** The tag of a node a roamer would meet you on. */
const AMBUSH_CHIP: Chip = { icon: 'warn', pal: { o: 0xff6a4a, K: 0x3a0a0a }, text: 'Ambush', col: 0xff9a80 };
const TRADER_CHIP: Chip = { icon: 'coin', text: 'Trader', col: 0xffe680 };
/** The foe badge's width: the skull, the count. */
const badgeW = (foes: number): number => (foes > 0 ? 7 + 1 + textWidth(`${foes}`, 1, true) + 3 : 0);
const intersect = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

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

export class MapView implements MapHost {
  /** The roamers, the secret and the bounty tracker (view/map-roam.ts). */
  readonly roam: MapRoam;
  private gGround!: G;
  private gAir!: G;
  private gHud!: G;
  private land: Img | null = null;
  private landKeys: string[] = [];
  private landFor: unknown = null;
  private landLayout = '';
  landGen = 0;
  landData: Land | null = null;
  landTheme: Theme = 'forest';
  private roads: Road[] = [];
  private pool: ImagePool;
  private texts: TextPool;
  private walk: { id: number; pts: Pt[]; at: number; dur: number } | null = null;
  private tagCache: { key: string; tags: Tag[] } | null = null;
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** The critters and the sparkle (view/map-life.ts). */
  readonly life: MapLife;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, D_TEXT);
    this.pool = new ImagePool(s);
    this.roam = new MapRoam(s, this);
    this.life = new MapLife(s, this);
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
    this.roam.build();
    this.life.build();
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

  /** The Camp button (bottom right): the camp mid-act (gear, skills, the hero), then back to this map. */
  campRect(): Rect {
    const s = this.s;
    const [iw] = glyphSize('tent');
    const w = iw + 3 + textWidth('Camp', 1, true) + 14;
    return { x: s.R - 3 - w, y: s.B - 20, w, h: 18 };
  }

  /** The first step's hint ("Tap a glowing spot to travel") between the HP plate and the Camp button, shortened (or
   *  left out) when the screen's safe areas leave too little room. */
  private hint(): { text: string; r: Rect } | null {
    const s = this.s;
    const run = s.app.run;
    if (run.path.length) return null;
    const max = heroMaxHp(run.tuning, run.hero);
    const hpRight = s.L + 3 + 20 + 34 + 6 + textWidth(hpLabel(run.hero.hp, max), 1, false) + 8;
    const right = this.campRect().x - 3;
    for (const text of ['Tap a glowing spot to travel', 'Tap a glowing spot', 'Pick a spot']) {
      const tw = textWidth(text, 1, false) + 14;
      if (right - tw >= hpRight + 3) return { text, r: { x: right - tw, y: s.B - 19, w: tw, h: 16 } };
    }
    return null;
  }

  /** The hero is walking to a node (a tip waits). */
  get walking(): boolean {
    return !!this.walk;
  }

  /** Rowan's walk to a node (the roamers step along with it), or null. */
  get walkInfo(): { id: number; at: number; dur: number } | null {
    return this.walk;
  }

  /** The road's points from node a to node b, either way along a link (null: no road). */
  road(a: number, b: number): Pt[] | null {
    this.ensureLand();
    const fwd = this.roads.find((r) => r.a === a && r.b === b);
    if (fwd) return fwd.pts;
    const back = this.roads.find((r) => r.a === b && r.b === a);
    return back ? back.pts.slice().reverse() : null;
  }

  /** Every road's points. */
  roadPixels(): Pt[] {
    this.ensureLand();
    return this.roads.flatMap((r) => r.pts);
  }

  /** Where a node's art stands. */
  boxOf(n: MapNode): Rect {
    return this.nodeBox(n);
  }

  /** The coins plate (top right; with the rerolls under the coins when there are any). */
  coinPlate(): Rect {
    const s = this.s;
    const run = s.app.run;
    const [cw] = iconSize('coin');
    const coinW = cw + textWidth(whole(run.coins), 1, true) + 14;
    const rr = run.rerolls > 0 ? `Rerolls: ${run.rerolls}` : '';
    const boxW = Math.max(coinW, rr ? textWidth(rr, 1, false) + 12 : 0);
    return { x: s.R - 3 - boxW, y: 3, w: boxW, h: rr ? 25 : 16 };
  }

  /** Where these nodes stand on the map, each with its tag (what a tip points at). */
  nodeRects(ids: number[]): Rect[] {
    const run = this.s.app.run;
    const tags = this.layoutTags();
    return ids.flatMap((id) => {
      const n = run.map.nodes[id];
      if (!n) return [];
      const t = tags.find((q) => q.id === id);
      return t ? [this.nodeBox(n), { x: t.x, y: t.y, w: t.w, h: t.h }] : [this.nodeBox(n)];
    });
  }

  /** Whether a tap lands on the Camp button (not while Rowan walks). */
  campAt(x: number, y: number): boolean {
    if (this.walk || !inRect(this.campRect(), x, y, 2)) return false;
    notePress(this.campRect());
    return true;
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
    // Rowan's footsteps along the road, about one every 150 ms
    const t0 = s.app.audio.ctx?.currentTime;
    if (t0 !== undefined) for (let i = 0; 80 + i * 150 < dur; i++) s.app.audio.footstep(i, t0 + 0.08 + i * 0.15);
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
    // the secret's spot stays clear of scenery
    const secret = this.roam.placeSecret(this.roads.flatMap((r) => r.pts));
    if (secret) zones.push({ x: secret[0] - 9, y: secret[1] - 12, w: 18, h: 14 });
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
    this.roam.hide();
    this.life.hide();
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

    // ---- the roamers (and where they go next), the secret, the bounty tracker
    this.roam.draw(now);

    // ---- Rowan and Pip
    this.hero(now);

    // ---- critters, flames, the weather
    this.ambient(now, theme);
    this.life.draw(now);

    // ---- HUD
    this.hud(now);

    // ---- what the next nodes hold (and the boss)
    this.drawTags(now);

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
      case 'rush': {
        // Coin Rush: a fat coin sack, a coin glinting on its pile
        ellipse(g, x, y + 5, 7, 1.6, 0x000000, 0.3 * alpha);
        const hop = (now + ph) % 1600 < 180 ? 1 : 0;
        P.foot('mn_sack', x, y + 6 - bounce - hop, D_ICON, alpha, tint);
        const t = ((now + ph) % 1500) / 1500;
        if (t < 0.3 && alpha === 1) sparkle(a, x + 5, y + 2 - bounce, 0xfff0a0, Math.sin((t / 0.3) * Math.PI), true);
        return;
      }
      case 'bounty': {
        // the bounty board: a notice on a post board; its pin glints
        ellipse(g, x, y + 5, 7, 1.6, 0x000000, 0.3 * alpha);
        P.foot('mn_board', x, y + 6 - bounce, D_ICON, alpha, tint);
        if ((now + ph) % 1800 < 160 && alpha === 1) sparkle(a, x + 2, y - 6 - bounce, 0xffb0a0, 1, false);
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

  /** An enemy's mini sprite key (frame by time; art-minis.ts records a sprite that has none). */
  private mini(sprite: string, t: number): string {
    return miniKey(sprite, t);
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
      const [halo, core] = spots.glow ?? [0x62e4d4, 0xd8fff6];
      for (const [gx, gy] of spots.glows) {
        const a = 0.35 + 0.35 * Math.sin(now / 260 + gx);
        this.gAir.fillStyle(halo, a);
        this.gAir.fillRect(Math.round(x + gx) - 1, Math.round(footY + gy) - 1, 3, 3);
        this.gAir.fillStyle(core, a);
        this.gAir.fillRect(Math.round(x + gx), Math.round(footY + gy), 1, 1);
      }
    }
    const sprite = run.tuning.enemies[n.enemies[0]]?.sprite ?? '';
    const b = Math.floor(now / 520) % 2;
    ellipse(g, x, y + 7, 8, 2, 0x000000, 0.35);
    this.pool.foot(this.mini(sprite, now), x + 1, y + 7 - b - (next ? Math.round(Math.abs(Math.sin(now / 190)) * 2) : 0), D_ICON);
    // its name (and what it drops) is the boss's tag, drawn with the others
  }

  // ------------------------------------------------------------------ tags: what a node is, and what it pays out

  /** What a node pays out, icon first: the loot bag in the drop's rarity colour, a heart, a coin, a warning. */
  private chip(n: MapNode): Chip {
    const bag = (r: keyof typeof RARITY_INFO) => bagPal(RARITY_INFO[r].face);
    switch (n.type) {
      case 'fight':
        return { icon: 'bag', pal: bag('common'), text: 'Gear', col: 0xd8dcec };
      case 'elite':
        return { icon: 'bag', pal: bag('uncommon'), text: 'Gear+', col: 0xb4f070 };
      case 'treasure':
        return { icon: 'bag', pal: { h: 0xfff0a0, b: 0xf2c230, d: 0x9a5a14 }, text: 'Loot', col: 0xffe680 };
      case 'rest':
        return { icon: 'heart', text: 'Heal', col: 0x9af06a };
      case 'shop':
        return { icon: 'coin', text: 'Shop', col: 0xffe680 };
      case 'event':
        return { icon: 'warn', text: '?', col: 0xffc070 };
      case 'boss':
        return { icon: 'bag', pal: bag('legendary'), text: 'Boss', col: 0xffc070 };
      case 'rush':
        return { icon: 'coin', text: 'Rush', col: 0xffe680 };
      case 'bounty':
        return { icon: 'warn', text: 'Bounty', col: 0xffd890 };
    }
  }

  /** The pill's width: the foe badge (a fight), a divider, the reward's glyph and word. */
  private chipW(c: Chip, foes = 0): number {
    return 2 + (foes ? badgeW(foes) + 3 : 0) + glyphSize(c.icon)[0] + 2 + textWidth(c.text, 1, false) + 3;
  }

  /** Where the node's art stands (its tag avoids it), from its feet at (x, y). */
  nodeBox(n: MapNode): Rect {
    const [x, y] = this.pos(n);
    if (n.type === 'boss') {
      const [lw, lh] = this.pool.size(`maplair_${this.landTheme}`);
      return { x: x - lw / 2, y: y + 2 - lh, w: lw, h: lh + 8 };
    }
    const top = n.type === 'elite' ? 15 : n.type === 'fight' || n.type === 'bounty' || n.type === 'rush' ? 12 : 8;
    return { x: x - 11, y: y - top, w: 21, h: top + 8 };
  }

  /** The HUD plates (the tags keep off them). */
  hudRects(): Rect[] {
    const s = this.s;
    const run = s.app.run;
    const L = s.L + 3;
    const out: Rect[] = [];
    const w = Math.max(textWidth(`Act ${run.actIndex + 1}`, 1, true), textWidth(run.act.name, 1, false)) + 14;
    out.push({ x: L, y: 3, w, h: 25 });
    out.push(this.coinPlate());
    const max = heroMaxHp(run.tuning, run.hero);
    out.push({ x: L, y: s.B - 19, w: 20 + 34 + 6 + textWidth(hpLabel(run.hero.hp, max), 1, false) + 8, h: 16 });
    const camp = this.campRect();
    out.push(camp);
    const hint = this.hint();
    if (hint) out.push(hint.r);
    const tracker = this.roam.trackerRect();
    if (tracker) out.push(tracker);
    // the DOM pause / gear buttons at the top centre
    out.push({ x: GAME_W / 2 - 17, y: 0, w: 34, h: 18 });
    return out;
  }

  /**
   * Lay out the tags of the reachable nodes (and the boss's): each tag tries below, above, right and left of its
   * node, and the combination that covers the least wins (weighted: the HUD plates and the other tags most, then
   * Rowan, the nodes he can reach, and the rest of the map). Cached per map, step and HUD size, so it's computed once
   * per arrival and the tags hold still while Rowan walks.
   */
  layoutTags(): Tag[] {
    const s = this.s;
    const run = s.app.run;
    const map = run.map;
    const hud = this.hudRects();
    const key = `${this.landGen}|${run.path.join(',')}|${run.restShare}|${run.secretFound}|${hud.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';')}`;
    if (this.tagCache?.key === key) return this.tagCache.tags;
    const choices = run.choices();
    const bossNext = choices.includes(map.boss);
    const obstacles: Array<{ r: Rect; w: number; id?: number }> = hud.map((r) => ({ r, w: 6 }));
    // Rowan and Pip, where he stands
    const [hx, hy] = this.pos(run.node);
    obstacles.push({ r: { x: hx - 18, y: hy - 18, w: 27, h: 24 }, w: 4 });
    for (const n of map.nodes) {
      if (run.path.includes(n.id)) {
        const [x, y] = this.pos(n);
        obstacles.push({ r: { x: x - 10, y: y - 6, w: 9, h: 11 }, w: 0.5 });
      } else obstacles.push({ r: this.nodeBox(n), w: choices.includes(n.id) ? 3 : n.type === 'boss' ? 2 : 1.5, id: n.id });
    }
    // the roamers and the secret
    for (const r of this.roam.roamerRects()) obstacles.push({ r, w: 3 });
    const secret = this.roam.secretRect();
    if (secret) obstacles.push({ r: secret, w: 3 });
    const roam = run.roamFor();
    const tags: Tag[] = [];
    const bossNode = map.nodes[map.boss];
    const bossName = run.tuning.enemies[bossNode.enemies[0]]?.name ?? 'Boss';
    if (!bossNext) {
      // the boss's name stays under its lair, as it always has
      const [x, y] = this.pos(bossNode);
      const w = textWidth(bossName, 1, false);
      const t: Tag = { id: map.boss, label: bossName, labelCol: 0xff8a76, foes: 0, elite: false, chip: null, w, h: LABEL_H, x: Math.round(Math.max(s.L + 2, Math.min(s.R - 2 - w, x - w / 2))), y: y + 11 };
      tags.push(t);
      obstacles.push({ r: { x: t.x, y: t.y, w: t.w, h: t.h }, w: 6 });
    }
    // each reachable node's options: [rect, cost of the spot alone]
    const opts: Array<{ tag: Omit<Tag, 'x' | 'y'>; cands: Array<{ r: Rect; cost: number }> }> = [];
    for (const id of choices) {
      const n = map.nodes[id];
      const boss = n.type === 'boss';
      // a roamer met there: an ambush (its foes counted in, a red badge) or the merchant
      const met = roamerAt(roam, id);
      const pack = met?.kind === 'pack' ? met : null;
      const foes = (n.type === 'fight' || n.type === 'elite' ? n.enemies.length : 0) + (pack ? pack.waves.flat().length : 0);
      const label = boss ? bossName : '';
      const chip = pack ? AMBUSH_CHIP : met ? TRADER_CHIP : this.chip(n);
      const w = Math.max(boss ? textWidth(label, 1, false) + 6 : 0, this.chipW(chip, foes));
      const h = boss ? LABEL_H + 1 + CHIP_H : CHIP_H;
      const [x, y] = this.pos(n);
      const box = this.nodeBox(n);
      const spots: Array<[number, number, number]> = [
        [x - w / 2, boss ? y + 11 : y + 9, 0],
        [x - w / 2, box.y - h - 1, 8],
        [box.x + box.w + 1, y - h / 2 - 2, 30],
        [box.x - w - 1, y - h / 2 - 2, 40],
      ];
      const cands = spots.map(([cx, cy, pref]) => {
        const bx = Math.round(Math.max(s.L + 2, Math.min(s.R - 2 - w, cx)));
        const by = Math.round(cy);
        const r: Rect = { x: bx, y: by, w, h };
        let cost = pref + Math.abs(bx - cx) * 2;
        if (by < 1 || by + h > s.B - 1) cost += 1e5;
        // its own node too: a spot pushed back inside the screen mustn't slide over it
        for (const o of obstacles) cost += intersect(r, o.r) * (o.id === id ? 12 : o.w);
        return { r, cost };
      });
      opts.push({ tag: { id, label, labelCol: 0xffb0a0, foes, elite: n.type === 'elite' || !!pack, chip, w, h }, cands });
    }
    // every combination (at most 4^3): the spots' own costs plus the tags covering each other
    let best: number[] = opts.map(() => 0);
    let bestCost = Infinity;
    const pick: number[] = [];
    const search = (i: number, cost: number): void => {
      if (cost >= bestCost) return;
      if (i === opts.length) {
        bestCost = cost;
        best = pick.slice();
        return;
      }
      opts[i].cands.forEach((c, k) => {
        let extra = c.cost;
        for (let j = 0; j < i; j++) {
          const o = opts[j].cands[pick[j]].r;
          extra += intersect(c.r, { x: o.x - 2, y: o.y - 1, w: o.w + 4, h: o.h + 2 }) * 8;
        }
        pick[i] = k;
        search(i + 1, cost + extra);
      });
    };
    search(0, 0);
    opts.forEach((o, i) => {
      const r = o.cands[best[i]].r;
      tags.push({ ...o.tag, x: r.x, y: r.y });
    });
    this.tagCache = { key, tags };
    return tags;
  }

  /** The tags of the nodes Rowan can go to next (the one he walks to keeps its own), and the boss's name. */
  private drawTags(now: number): void {
    const s = this.s;
    const fade = clamp01((now - s.app.phaseSince - 120) / 260);
    const lift = Math.round((1 - fade) * 3);
    for (const t of this.layoutTags()) {
      const chosen = !!t.chip;
      // while Rowan walks, only the tag of the node he walks to stays
      if (chosen && this.walk && this.walk.id !== t.id) continue;
      const a = chosen ? fade : 1;
      const dy = chosen ? lift : 0;
      const cx = t.x + t.w / 2;
      let y = t.y + dy;
      if (t.label) {
        // the boss's name, on a dark pill so it reads over the busiest bit of map
        const ly = y + LABEL_H / 2;
        const lw = textWidth(t.label, 1, false);
        const lx = Math.round(cx - lw / 2);
        const by = Math.round(ly) - 5;
        rows(this.gHud, lx - 3, by + 1, lw + 6, 11, 2, 0x000000, 0.25 * a);
        rows(this.gHud, lx - 3, by, lw + 6, 10, 2, 0x140c1c, 0.62 * a);
        this.texts.text(t.label, lx, ly, t.labelCol, { oy: 0.5, alpha: a });
        y += LABEL_H + 1;
      }
      if (t.chip) this.drawChip(t.chip, t.foes, t.elite, Math.round(cx - this.chipW(t.chip, t.foes) / 2), y, a, now);
    }
  }

  /** A node's pill: a small dark capsule, the foe badge (a skull and the count), a divider, the reward glyph and word. */
  private drawChip(c: Chip, foes: number, elite: boolean, x: number, y: number, alpha: number, now: number): void {
    const g = this.gHud;
    const w = this.chipW(c, foes);
    const h = CHIP_H;
    rows(g, x - 1, y + 1, w + 2, h + 1, 3, 0x000000, 0.3 * alpha);
    rows(g, x - 1, y - 1, w + 2, h + 2, 3, INK, 0.9 * alpha);
    rows(g, x, y, w, h, 2, 0x1a1628, 0.9 * alpha);
    band(g, x, y, w, h, 2, 0, Math.floor(h / 2), 0x241e38, 0.9 * alpha);
    band(g, x, y, w, h, 2, 0, 1, mix(c.col, 0x1a1628, 0.45), alpha);
    let cx = x + 2;
    if (foes > 0) {
      // the foe badge: a skull (red-tinted for an elite) and how many
      const bw = badgeW(foes);
      if (elite) rows(g, cx - 1, y + 1, bw + 1, h - 2, 2, 0x6a1a22, alpha);
      hudIcon(g, 'foe', cx, y + 2, 1, alpha);
      this.texts.text(`${foes}`, cx + 8, y + h / 2 + 0.5, elite ? 0xffa090 : 0xeef0f8, { bold: true, oy: 0.5, alpha });
      cx += bw;
      g.fillStyle(0x3a3256, alpha);
      g.fillRect(cx, y + 2, 1, h - 4);
      cx += 3;
    }
    const [gw, gh] = glyphSize(c.icon);
    glyph(g, c.icon, cx, y + Math.floor((h - gh) / 2), alpha, c.pal);
    // a glint runs across the bag now and then
    if (c.icon === 'bag' && (now + x * 13) % 2200 < 120) {
      g.fillStyle(WHITE, 0.8 * alpha);
      g.fillRect(cx + 2, y + 4, 1, 2);
    }
    this.texts.text(c.text, cx + gw + 2, y + h / 2 + 0.5, c.col, { oy: 0.5, alpha });
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
    // the hero who fights walks the map (each with their own walker: msab_ for Sable, m<id>_ for the others)
    const id = run.hero.build?.id ?? 'rowan';
    const own = id === 'rowan' ? key : key.replace('mrow_', id === 'sable' ? 'msab_' : `m${id}_`);
    const walker = this.s.textures.exists(own) ? own : key;
    this.pool.at(walker, Math.round(x) - ROWAN_FEET[0], Math.round(y) - ROWAN_FEET[1], D_HERO);
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
    // the road lanterns flicker (decision L7: the dusk's light comes from them)
    land.lamps.forEach(([lx, ly], i) => {
      const k = 0.5 + 0.5 * Math.sin(now / 90 + i * 2.3) * Math.sin(now / 37 + i);
      ellipse(this.gGround, lx, ly + 5, 7, 3, 0xff9a40, 0.05 + 0.05 * k);
      a.fillStyle(0xffd070, 0.25 + 0.35 * k);
      a.fillRect(Math.round(lx) - 1, Math.round(ly) - 1, 3, 3);
      a.fillStyle(0xfff0b0, 0.6 + 0.4 * k);
      a.fillRect(Math.round(lx), Math.round(ly), 1, 1);
    });
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
    } else if (theme === 'pass') {
      // snow drifting down over the whole map
      for (let i = 0; i < 30; i++) {
        const speed = 7 + (i % 5) * 1.6;
        const yy = ((t * speed + i * 37) % (H + 10)) - 5;
        const x = ((i * 53.3 + yy * 0.3 + Math.sin(t * 1.2 + i) * 3) % (W + 6)) - 3;
        a.fillStyle(0xffffff, i % 3 ? 0.5 : 0.85);
        a.fillRect(Math.round(x), Math.round(yy), 1, 1);
      }
      // glare winking off the frozen creek
      const wv = land.water;
      if (wv.length)
        for (let j = 0; j < 6; j++) {
          const tw = Math.sin(t * 2.1 + j * 1.9);
          if (tw < 0.4) continue;
          const [x, y] = wv[Math.floor((j * 37.7 + Math.floor(t * 0.33 + j * 0.4) * 53) % wv.length)];
          a.fillStyle(0xffffff, tw);
          a.fillRect(Math.round(x) - 1, Math.round(y), 1, 1);
          if (tw > 0.85) {
            a.fillRect(Math.round(x) - 2, Math.round(y), 3, 1);
            a.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 3);
          }
        }
    } else if (theme === 'caves') {
      // the crystals breathe light; now and then one winks
      land.glows.forEach(([gx, gy, gc], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 1.2 + i * 1.7);
        ellipse(this.gGround, gx, gy + 4, 8, 3.5, gc, 0.05 + 0.06 * k);
        const tw = Math.sin(t * 2.3 + i * 2.9);
        if (tw > 0.9) {
          a.fillStyle(0xf0fcff, (tw - 0.9) * 10);
          a.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 3, 1);
          a.fillRect(Math.round(gx), Math.round(gy) - 2, 1, 3);
        }
      });
      // glimmering dust rising slowly through the dark
      for (let j = 0; j < 16; j++) {
        const x = (j * 61.3 + Math.sin(t * 0.3 + j) * 8 + W) % W;
        const y = H - ((t * (2 + (j % 3)) + j * 29) % (H + 10));
        const tw = 0.5 + 0.5 * Math.sin(t * 2.6 + j * 1.3);
        a.fillStyle(j % 2 ? 0xc8a8ff : 0x9ae4ff, 0.2 + 0.4 * tw);
        a.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // drops from the roof rippling the ice pools
      land.pools.forEach(([px, py], i) => {
        const per = 3.4 + i * 0.9;
        const u = ((t + i * 1.3) % per) / 0.9;
        if (u < 1) ring(this.gGround, px - 4 + ((i * 5) % 9), py, 1 + u * 4, 0.6 + u * 1.6, 0xb4e4f8, 0.55 * (1 - u));
      });
    } else if (theme === 'glacier') {
      // the aurora's light drifting over the ice: broad soft bands of green and violet
      for (let i = 0; i < 2; i++) {
        const [fw] = P.size('ma_fog');
        const x = ((t * (1.6 + i * 0.7) + i * 160) % (W + fw)) - fw;
        P.at('ma_fog', x, 16 + i * 54, D_SKY, 0.09, i ? 0xa070e0 : 0x5ae0a8);
      }
      // spindrift streaking across
      for (let j = 0; j < 10; j++) {
        const speed = 40 + (j % 4) * 12;
        const x = W + 20 - ((t * speed + j * 97) % (W + 40));
        const y = 20 + ((j * 47) % (H - 40)) + Math.sin(t * 2 + j) * 2;
        a.fillStyle(0xe8f4ff, 0.28);
        a.fillRect(Math.round(x), Math.round(y), 4 + (j % 3), 1);
      }
      // the hoard's gold glinting through the ice
      land.glows.forEach(([gx, gy], i) => {
        const tw = Math.sin(t * 1.9 + i * 2.1);
        if (tw < 0.8) return;
        const k = (tw - 0.8) * 5;
        a.fillStyle(0xfff4b0, k);
        a.fillRect(Math.round(gx), Math.round(gy), 1, 1);
        if (k > 0.5) {
          a.fillRect(Math.round(gx) - 1, Math.round(gy), 3, 1);
          a.fillRect(Math.round(gx), Math.round(gy) - 1, 1, 3);
        }
      });
    } else if (theme === 'cinder' || theme === 'forge') {
      // ash drifting down over the whole map; in the forge, sparks streaming up off the hot floor
      for (let i = 0; i < 24; i++) {
        const speed = 4 + (i % 5) * 1.1;
        const yy = ((t * speed + i * 37) % (H + 10)) - 5;
        const x = ((i * 53.3 + yy * 0.25 + Math.sin(t * 0.9 + i) * 4) % (W + 6)) - 3;
        a.fillStyle(i % 3 ? 0x8a7a7c : 0xb0a0a0, i % 3 ? 0.45 : 0.7);
        a.fillRect(Math.round(x), Math.round(yy), 1, 1);
      }
      if (theme === 'forge')
        for (let j = 0; j < 18; j++) {
          const per = 2.6 + (j % 4) * 0.5;
          const u = ((t + j * 0.71) % per) / per;
          const x = (j * 61.7 + Math.sin(u * 6 + j) * 4) % W;
          const y = H - 10 - ((j * 29) % (H - 30)) - u * 22;
          a.fillStyle(u < 0.5 ? 0xffe070 : 0xff7a2a, 1 - u);
          a.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      // the lava shimmers as it flows
      const wv = land.water;
      if (wv.length)
        for (let j = 0; j < 12; j++) {
          const idx = Math.floor((t * 6 + j * 11.3) % wv.length);
          const [x, y] = wv[idx];
          a.fillStyle(j % 3 ? 0xffe070 : 0xfff8d0, 0.5 + 0.4 * Math.sin(t * 4 + j));
          a.fillRect(Math.round(x + ((j * 7) % 3) - 1), Math.round(y), 1, 1);
        }
      // smoke curling off the vents
      for (const [sx, sy] of land.smoke)
        for (let j = 0; j < 3; j++) {
          const q = (t / 2.6 + j / 3) % 1;
          a.fillStyle(q < 0.3 ? 0x6a5a5c : 0x8a7a78, 0.5 * (1 - q));
          const sz = q < 0.4 ? 2 : 3;
          a.fillRect(Math.round(sx + q * 6 + Math.sin(q * 6 + j) * 1), Math.round(sy - 2 - q * 12), sz, sz - 1);
        }
      // braziers (the forge's)
      land.flames.forEach(([fx, fy], i) => {
        const k = 0.5 + 0.5 * Math.sin(now / 80 + i * 2) * Math.sin(now / 31 + i);
        ellipse(this.gGround, fx, fy + 4, 12, 7, 0xff9040, 0.08 + 0.06 * k);
        P.foot(`mn_flame_${Math.floor(now / 100 + i) % 3}`, fx, fy + 1, D_ICON);
      });
      // the glowing scenery (vents, cooling lava, slag, anvils' ingots) breathes
      land.glows.forEach(([gx, gy, gc], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 1.6 + i * 1.9);
        ellipse(this.gGround, gx, gy + 3, 6, 2.5, gc, 0.05 + 0.07 * k);
      });
    } else if (theme === 'glass') {
      // the coloured glass breathes light; now and then a pane winks
      land.glows.forEach(([gx, gy, gc], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 1.1 + i * 1.7);
        ellipse(this.gGround, gx, gy + 4, 8, 3.5, gc, 0.05 + 0.07 * k);
        const tw = Math.sin(t * 2.1 + i * 2.9);
        if (tw > 0.9) {
          a.fillStyle(0xfff8e8, (tw - 0.9) * 10);
          a.fillRect(Math.round(gx) - 1, Math.round(gy) - 1, 3, 1);
          a.fillRect(Math.round(gx), Math.round(gy) - 2, 1, 3);
        }
      });
      // warm motes rising on the heat
      for (let j = 0; j < 16; j++) {
        const x = (j * 61.3 + Math.sin(t * 0.3 + j) * 8 + W) % W;
        const y = H - ((t * (2 + (j % 3)) + j * 29) % (H + 10));
        const tw = 0.5 + 0.5 * Math.sin(t * 2.6 + j * 1.3);
        a.fillStyle([0xffc070, 0xc89aff, 0x9ae89a, 0xff8a7a][j % 4], 0.2 + 0.4 * tw);
        a.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      // bubbles swelling and popping in the magma pools
      land.pools.forEach(([px, py], i) => {
        for (let j = 0; j < 2; j++) {
          const per = 1.8 + i * 0.4 + j * 0.7;
          const u = ((t + i * 0.9 + j * 1.3) % per) / per;
          const bx = Math.round(px - 5 + ((i * 7 + j * 9) % 11));
          if (u < 0.7) {
            a.fillStyle(0xffe070, 0.8);
            a.fillRect(bx, Math.round(py), u > 0.4 ? 2 : 1, 1);
          } else ring(this.gGround, bx, py, 1 + (u - 0.7) * 8, 0.6 + (u - 0.7) * 3, 0xffb040, 0.6 * (1 - (u - 0.7) / 0.3));
        }
      });
      // smoke from the kilns
      for (const [sx, sy] of land.smoke)
        for (let j = 0; j < 3; j++) {
          const q = (t / 2.2 + j / 3) % 1;
          a.fillStyle(0x5a4a5c, 0.5 * (1 - q));
          const sz = q < 0.4 ? 2 : 3;
          a.fillRect(Math.round(sx + q * 5 + Math.sin(q * 6 + j) * 1), Math.round(sy - 2 - q * 12), sz, sz - 1);
        }
    } else if (theme === 'hollow') {
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
    const coins = whole(run.coins);
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
    const hp = hpLabel(H.hp, max);
    const hpW = 20 + 34 + 6 + textWidth(hp, 1, false) + 8;
    const hy = s.B - 19;
    plate(g, L, hy, hpW, 16);
    hudIcon(g, 'heart', L + 3, hy + 1);
    hpBar(g, L + 20, hy + 6, 34, 4, H.hp / max, H.hp / max, 0xe0463c);
    T.text(hp, L + 60, hy + 8, WHITE, { oy: 0.5 });
    // the Camp button (bottom right)
    const camp = this.campRect();
    const pr = isPressed(camp, now);
    button3d(g, camp, FACE.navy, pr);
    const [iw, ih] = glyphSize('tent');
    const dy = pr ? 2 : 0;
    glyph(g, 'tent', camp.x + 7, camp.y + Math.round((camp.h - ih) / 2) + dy);
    T.text('Camp', camp.x + 7 + iw + 3, camp.y + camp.h / 2 + dy, WHITE, { bold: true, oy: 0.5 });
    // the first time on a map: how to travel
    const hint = this.walk ? null : this.hint();
    if (hint) {
      const k = 0.75 + 0.25 * Math.sin(now / 300);
      plate(g, hint.r.x, hy, hint.r.w, 16);
      T.text(hint.text, hint.r.x + hint.r.w / 2, hy + 8, 0xffe680, { ox: 0.5, oy: 0.5, alpha: k });
    }
  }
}
