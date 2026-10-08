// The act map's extras, drawn over the map (view/map.ts calls in): the wandering packs and the travelling merchant
// (core/roam.ts), each standing beside its node with its next step telegraphed (marching prints along the road and
// an arrowhead: red for a pack, gold for the merchant; a ring on the node it will step to), and stepping along with
// the hero's walk. The secret cache beside its node (a mossy boulder: shown when its node is in reach, its crack lit
// and tappable while the hero stands there). The bounty's tracker: a tiny plate beside the act's (the goal's icon and
// "12/25", a tick once met). Everything animates from `now` (the walk from performance.now()), like the map.
import Phaser from 'phaser';
import { questById } from '../../data/quests';
import type { MapNode } from '../../core/map';
import type { RoamerNow, RoamState } from '../../core/roam';
import type { Pt } from '../art-map';
import { miniKey } from '../art-minis';
import { textWidth } from '../font';
import type { FightScene } from '../scene';
import { glyph, glyphSize } from './overlays';
import { hudIcon, iconSize, rows } from './pixels';
import { clamp01, inRect, INK, WHITE, type Rect } from './shared';
import { ImagePool, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** What the map view lends the extras: where things are, the roads, Rowan's walk. */
export interface MapHost {
  pos(n: MapNode | null): [number, number];
  /** The road's points from node a to node b (either way along a link), or null. */
  road(a: number, b: number): Pt[] | null;
  /** Rowan walking to node `id` since `at` (performance.now) for `dur` ms, or null. */
  readonly walkInfo: { id: number; at: number; dur: number } | null;
  /** Every road pixel (the secret keeps off them). */
  roadPixels(): Pt[];
  /** Where the node's art stands. */
  boxOf(n: MapNode): Rect;
  /** The coins plate (top right): the bounty tracker sits beside it. */
  coinPlate(): Rect;
}

// depths (the map owns 30.0-30.9)
const D_MARK = 30.21; // telegraphs on the ground
const D_ROAMER = 30.52; // the roamers, over the node props
const D_HUD = 30.86;
const D_TEXT = 30.91;

const PACK_COL = 0xff5a3a;
const PACK_DARK = 0x6a1414;
const MERCH_COL = 0xffd23a;
const MERCH_DARK = 0x6a4a10;

/** Where a roamer stands beside its node's clearing (feet), from the node's position. */
const BESIDE: Pt = [-11, -7];

export class MapRoam {
  private g!: G; // telegraphs
  private gAir!: G; // glows and sparkles over the props
  private gHud!: G;
  private pool: ImagePool;
  /** A pack's red outline: its sprites again, filled red, a pixel out each way. */
  private glowPool: ImagePool;
  private texts: TextPool;
  private secretPos: { key: string; at: Pt } | null = null;
  private secretTapAt = 0;
  /** A bounty just met: the tracker flashes gold (since, performance.now). */
  private doneAt = -1e9;

  constructor(
    private readonly s: FightScene,
    private readonly host: MapHost,
  ) {
    this.pool = new ImagePool(s);
    this.glowPool = new ImagePool(s);
    this.texts = new TextPool(s, D_TEXT);
  }

  build(): void {
    this.g?.destroy();
    this.gAir?.destroy();
    this.gHud?.destroy();
    this.g = this.s.add.graphics().setDepth(D_MARK);
    this.gAir = this.s.add.graphics().setDepth(D_ROAMER + 0.05);
    this.gHud = this.s.add.graphics().setDepth(D_HUD);
    this.pool.destroy();
    this.glowPool.destroy();
    this.secretPos = null;
  }

  hide(): void {
    this.g?.clear();
    this.gAir?.clear();
    this.gHud?.clear();
    this.pool.hide();
    this.glowPool.hide();
    this.texts.hide();
  }

  // ------------------------------------------------------------------ where things are (the tags and tips use these)

  /** The roam state on show (while Rowan walks, the step isn't taken yet: the roamers walk theirs with him). */
  private state(): RoamState {
    return this.s.app.run.roamFor();
  }

  /** Where a roamer stands (its feet) on node `id`. */
  private standAt(id: number): Pt {
    const [x, y] = this.host.pos(this.s.app.run.map.nodes[id]);
    return [x + BESIDE[0], y + BESIDE[1]];
  }

  /** The roamers' boxes (the tags keep off them; a tip points at the first pack). */
  roamerRects(kind?: 'pack' | 'merchant'): Rect[] {
    return this.state()
      .roamers.filter((r) => !kind || r.kind === kind)
      .map((r) => {
        const [x, y] = this.standAt(r.at);
        return { x: x - 8, y: y - 13, w: 16, h: 14 };
      });
  }

  /** The secret's spot beside its node (the map keeps the landscape clear there: it calls this with the roads
   *  before it paints, so it mustn't ask for them itself). */
  placeSecret(roads: Pt[]): Pt | null {
    return this.secretSpot(roads);
  }

  /** The secret's spot beside its node: the clearest of a few spots round it (off the roads and the other nodes). */
  private secretSpot(roadPts?: Pt[]): Pt | null {
    const run = this.s.app.run;
    const x = run.extras;
    if (!x || x.secret < 0) return null;
    const key = `${run.mapSeed}|${run.actIndex}|${x.secret}|${this.s.L},${this.s.R},${this.s.B}`;
    if (this.secretPos?.key === key) return this.secretPos.at;
    const host = run.map.nodes[x.secret];
    const [hx, hy] = this.host.pos(host);
    const roads = roadPts ?? this.host.roadPixels();
    const boxes = run.map.nodes.filter((n) => n.id !== host.id).map((n) => this.host.boxOf(n));
    const offs: Pt[] = [
      [0, -16],
      [12, -12],
      [-12, -12],
      [14, 2],
      [-14, 2],
      [0, 15],
      [12, 13],
      [-12, 13],
    ];
    let best: Pt = [hx + offs[0][0], hy + offs[0][1]];
    let bestScore = -Infinity;
    for (const [dx, dy] of offs) {
      const p: Pt = [hx + dx, hy + dy];
      if (p[0] < this.s.L + 8 || p[0] > this.s.R - 8 || p[1] < 34 || p[1] > this.s.B - 26) continue;
      let clear = Infinity;
      for (const [rx, ry] of roads) clear = Math.min(clear, Math.hypot(rx - p[0], (ry - p[1]) * 1.4));
      for (const b of boxes) if (inRect(b, p[0], p[1] - 3, 6)) clear = Math.min(clear, 0);
      const score = Math.min(clear, 12) - Math.hypot(dx, dy) * 0.05;
      if (score > bestScore) (bestScore = score), (best = p);
    }
    this.secretPos = { key, at: best };
    return best;
  }

  /** The secret is in sight (its node in reach), and whether it can be tapped now (Rowan stands at its node). */
  private secretShown(): { at: Pt; live: boolean } | null {
    const run = this.s.app.run;
    const x = run.extras;
    if (!x || x.secret < 0 || run.secretFound) return null;
    const at = this.secretSpot();
    if (!at) return null;
    const here = run.node?.id === x.secret && !this.host.walkInfo;
    return here || run.choices().includes(x.secret) ? { at, live: here && run.secretHere } : null;
  }

  /** The secret's box (a tip points at it), when it can be tapped. */
  secretRect(): Rect | null {
    const sh = this.secretShown();
    if (!sh?.live) return null;
    return { x: sh.at[0] - 8, y: sh.at[1] - 10, w: 16, h: 12 };
  }

  /** Whether a tap lands on the secret (when it can be opened). */
  secretAt(x: number, y: number): boolean {
    const r = this.secretRect();
    return !!r && inRect(r, x, y, 5);
  }

  /** Tap: the rock cracks open, then the cache (a chest) opens. */
  openSecret(): void {
    const s = this.s;
    const sh = this.secretShown();
    if (!sh?.live || this.secretTapAt) return;
    this.secretTapAt = performance.now();
    s.app.audio.mapSelect();
    s.fx.burst(sh.at[0], sh.at[1] - 4, 0x9af0ff, 14, false, 1, true);
    window.setTimeout(() => {
      this.secretTapAt = 0;
      if (s.app.run.phase === 'map') s.app.setPhase(() => s.app.run.openSecret());
    }, 380);
  }

  /** The bounty tracker's plate (in the top row, left of the coins), or null with no bounty taken. */
  trackerRect(): Rect | null {
    const run = this.s.app.run;
    const q = run.quest;
    if (!q) return null;
    const [iw] = iconSize(questById(q.id)?.icon ?? 'star');
    const w = 4 + iw + 3 + (q.done ? glyphSize('check')[0] : textWidth(`${q.n}/${q.goal}`, 1, true)) + 6;
    return { x: this.host.coinPlate().x - w - 3, y: 3, w, h: 16 };
  }

  // ------------------------------------------------------------------ the frame

  draw(now: number): void {
    const s = this.s;
    const run = s.app.run;
    this.g.clear();
    this.gAir.clear();
    this.gHud.clear();
    this.pool.begin();
    this.glowPool.begin();
    this.texts.begin();
    if (run.questDone) {
      // a bounty met in the fight just won: the tracker celebrates once
      run.questDone = null;
      this.doneAt = now;
      s.app.audio.rareSting(false);
    }
    const st = this.state();
    const walk = this.host.walkInfo;
    const k = walk ? clamp01((performance.now() - walk.at) / walk.dur) : 0;
    for (const r of st.roamers) this.drawRoamer(r, now, walk ? k : -1);
    this.drawSecret(now);
    this.drawTracker(now);
    this.pool.end();
    this.glowPool.end();
    this.texts.end();
  }

  /** A roamer beside its node: its telegraph first (unless it's walking), then itself. `k` >= 0: mid-step. */
  private drawRoamer(r: RoamerNow, now: number, k: number): void {
    const pack = r.kind === 'pack';
    const moving = r.next !== r.at;
    const from = this.standAt(r.at);
    const to = this.standAt(r.next);
    const road = moving ? this.host.road(r.at, r.next) : null;
    let feet: Pt = from;
    if (k >= 0 && moving) {
      // stepping along with Rowan: along the road's middle, from beside one node to beside the other
      const e = k * k * (3 - 2 * k);
      feet = road ? this.along(road, e) : [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
    } else if (moving) this.telegraph(r, road, now);
    // the shadow, and a pulse of its colour underfoot (a pack's is a red danger zone)
    const g = this.g;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260 + r.id);
    if (pack) {
      g.fillStyle(PACK_COL, 0.2 + 0.12 * pulse);
      this.ellipse(g, feet[0], feet[1], 10, 4);
      g.fillStyle(PACK_COL, 0.75);
      this.ring(g, feet[0], feet[1], 10 + pulse, 4 + pulse * 0.5, false);
    } else {
      g.fillStyle(MERCH_COL, 0.16 + 0.12 * pulse);
      this.ellipse(g, feet[0], feet[1], 7, 2.6);
    }
    g.fillStyle(0x000000, 0.32);
    this.ellipse(g, feet[0], feet[1], 5, 1.6);
    const step = Math.floor((now + r.id * 210) / (k >= 0 ? 140 : 420)) % 2;
    // it faces where it goes
    const [nx] = this.host.pos(this.s.app.run.map.nodes[r.next]);
    const [ax] = this.host.pos(this.s.app.run.map.nodes[r.at]);
    const right = nx > ax;
    if (pack) {
      // the pack: its lead foe up front, a second one behind, a red "!" bobbing over them: it's hunting
      const sprites = r.waves.flat().map((key) => this.s.app.tuning.enemies[key]?.sprite ?? key);
      const lead = this.mini(sprites[0], now + r.id * 300);
      const second = sprites.find((x, i) => i > 0 && x !== sprites[0]) ?? sprites[1];
      const dir = right ? -1 : 1;
      const glow = 0.55 + 0.45 * pulse;
      const outlined = (key: string, x: number, y: number, depth: number) => {
        for (const [ox, oy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ])
          this.glowPool.foot(key, x + ox, y + oy, depth - 0.005, glow, PACK_COL).setTintMode(Phaser.TintModes.FILL).setFlipX(right);
        return this.pool.foot(key, x, y, depth).setFlipX(right);
      };
      if (second) outlined(this.mini(second, now + 200 + r.id * 300), feet[0] + 4 * dir, feet[1] - 1 - step, D_ROAMER - 0.01);
      const img = outlined(lead, feet[0] - 2 * dir, feet[1] + 1 - (1 - step), D_ROAMER);
      this.bang(feet[0] - 2 * dir, img.y - 9 - Math.round(Math.abs(Math.sin(now / 240)) * 2), PACK_COL);
    } else {
      this.pool.foot(`mn_merch_${k >= 0 ? step : Math.floor(now / 700) % 2 ? 0 : 1}`, feet[0], feet[1] + 1, D_ROAMER);
      // her lantern glows
      const a = this.gAir;
      a.fillStyle(0xffd27a, 0.18 + 0.1 * Math.sin(now / 140));
      a.fillRect(Math.round(feet[0]) + 3, Math.round(feet[1]) - 10, 5, 5);
    }
  }

  /** The way it goes next: prints marching along the road, an arrowhead, and a ring on the node it will step to. */
  private telegraph(r: RoamerNow, road: Pt[] | null, now: number): void {
    const g = this.g;
    const pack = r.kind === 'pack';
    const col = pack ? PACK_COL : MERCH_COL;
    const dark = pack ? PACK_DARK : MERCH_DARK;
    const from = this.standAt(r.at);
    const to = this.standAt(r.next);
    const pts: Pt[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) pts.push(road ? this.along(road, i / n) : [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
    // a dotted line the whole way (dots marching toward where it goes), from the roamer to the arrowhead
    const len = pts.length - 1;
    const shift = Math.floor(now / 120) % 3;
    for (let i = Math.round(len * 0.2) + shift; i < len * 0.66; i += 3) {
      const [x, y] = pts[i];
      const px = Math.round(x);
      const py = Math.round(y);
      g.fillStyle(INK, 0.55);
      g.fillRect(px - 1, py, 3, 2);
      g.fillStyle(col, 1);
      g.fillRect(px - 1, py - 1, 2, 2);
    }
    // the arrowhead, near the end, pointing along the road
    const [ax, ay] = pts[Math.round(len * 0.76)];
    const [bx, by] = pts[Math.round(len * 0.66)];
    const dx = ax - bx;
    const dy = ay - by;
    const dl = Math.hypot(dx, dy) || 1;
    const ux = dx / dl;
    const uy = dy / dl;
    const head = (size: number, c: number, grow: number) => {
      g.fillStyle(c, 1);
      for (let i = 0; i < size; i++)
        for (let w = -i; w <= i; w++) g.fillRect(Math.round(ax - ux * (i - grow) - uy * w * 0.85), Math.round(ay - uy * (i - grow) + ux * w * 0.85), 1, 1);
    };
    head(6, INK, 1);
    head(5, dark, 0);
    head(4, col, 0);
    // a ring round the node it steps to (a pack: you'd meet it there)
    const [tx, ty] = this.host.pos(this.s.app.run.map.nodes[r.next]);
    const k = 0.5 + 0.5 * Math.sin(now / 200);
    g.fillStyle(dark, 0.6);
    this.ring(g, tx, ty + 4, 11, 5.5, !pack);
    g.fillStyle(col, 0.6 + 0.4 * k);
    this.ring(g, tx, ty + 3, 11, 5.5, !pack);
  }

  /** A point a share `t` along a road (node to node), eased onto it from the spot beside the start node and off it
   *  to the spot beside the end node. */
  private along(road: Pt[], t: number): Pt {
    const i = Math.min(road.length - 1, Math.max(0, t * (road.length - 1)));
    const a = road[Math.floor(i)];
    const b = road[Math.min(road.length - 1, Math.floor(i) + 1)];
    const f = i - Math.floor(i);
    const side = 1 - Math.min(1, t * 4, (1 - t) * 4);
    return [a[0] + (b[0] - a[0]) * f + BESIDE[0] * side, a[1] + (b[1] - a[1]) * f + BESIDE[1] * side];
  }

  /** A small "!" (a pack on the hunt). */
  private bang(x: number, y: number, col: number): void {
    const g = this.gAir;
    x = Math.round(x);
    y = Math.round(y);
    rows(g, x - 2, y - 1, 5, 9, 1, INK, 0.9);
    g.fillStyle(col, 1);
    g.fillRect(x - 1, y, 3, 4);
    g.fillRect(x - 1, y + 5, 3, 2);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(x - 1, y, 1, 2);
  }

  /** The secret: a mossy boulder beside its node; its crack lit (and sparkling) while it can be opened. */
  private drawSecret(now: number): void {
    const sh = this.secretShown();
    if (!sh) return;
    const [x, y] = sh.at;
    const g = this.g;
    g.fillStyle(0x000000, 0.3);
    this.ellipse(g, x, y, 6, 1.6);
    if (!sh.live) {
      this.pool.foot('mn_rock', x, y + 1, D_ROAMER - 0.02);
      // now and then a faint glint in the crack: something's in there
      if ((now % 3200) < 240) {
        this.gAir.fillStyle(0xd8fff6, 0.8 * Math.sin(((now % 3200) / 240) * Math.PI));
        this.gAir.fillRect(Math.round(x), Math.round(y) - 6, 1, 1);
      }
      return;
    }
    const tap = this.secretTapAt ? clamp01((performance.now() - this.secretTapAt) / 380) : 0;
    const k = 0.5 + 0.5 * Math.sin(now / 180);
    // a glow on the ground round it, brighter as it's tapped
    g.fillStyle(0x62e4d4, 0.3 + 0.2 * k + tap * 0.4);
    this.ellipse(g, x, y - 1, 10 + tap * 6, 4 + tap * 3);
    const bob = tap > 0 ? Math.round(Math.sin(tap * 30)) : 0;
    this.pool.foot('mn_rock_lit', x + bob, y + 1, D_ROAMER - 0.02);
    // sparkles drifting up out of the crack
    for (let j = 0; j < 3; j++) {
      const t = (now / 900 + j / 3) % 1;
      this.gAir.fillStyle(j % 2 ? 0xd8fff6 : 0x9af0ff, 1 - t);
      this.gAir.fillRect(Math.round(x - 2 + j * 2 + Math.sin(t * 6 + j) * 1.5), Math.round(y - 7 - t * 10), 1, 1);
    }
    // a bouncing tap hint: a gold chevron over it
    const by = Math.round(y - 16 - Math.abs(Math.sin(now / 220)) * 3);
    const a = this.gAir;
    a.fillStyle(INK, 1);
    a.fillRect(x - 3, by - 1, 7, 1);
    a.fillRect(x - 2, by, 5, 2);
    a.fillRect(x - 1, by + 2, 3, 1);
    a.fillRect(x, by + 3, 1, 1);
    a.fillStyle(0xffd23a, 1);
    a.fillRect(x - 2, by, 5, 1);
    a.fillRect(x - 1, by + 1, 3, 1);
    a.fillRect(x, by + 2, 1, 1);
  }

  /** The bounty's tracker: the goal's icon and its progress ("12/25"), a tick once met. */
  private drawTracker(now: number): void {
    const run = this.s.app.run;
    const q = run.quest;
    const r = this.trackerRect();
    if (!q || !r) return;
    const g = this.gHud;
    const flash = clamp01(1 - (now - this.doneAt) / 900);
    rows(g, r.x, r.y + 2, r.w, r.h, 2, 0x000000, 0.4);
    rows(g, r.x, r.y, r.w, r.h, 2, INK, 1);
    rows(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 1, q.done ? 0x9a7a2a : 0x58507a, 1);
    rows(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 1, q.done ? 0x3a2a10 : 0x1a1628, 1);
    if (flash > 0) {
      g.fillStyle(0xfff0a0, 0.7 * flash);
      g.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    }
    const icon = questById(q.id)?.icon ?? 'star';
    const [iw, ih] = iconSize(icon);
    hudIcon(g, icon, r.x + 4, r.y + Math.round((r.h - ih) / 2));
    const tx = r.x + 4 + iw + 3;
    if (q.done) glyph(g, 'check', tx, r.y + Math.round((r.h - glyphSize('check')[1]) / 2));
    else this.texts.text(`${q.n}/${q.goal}`, tx, r.y + r.h / 2 + 0.5, q.n > 0 ? 0xffe680 : 0xe8e0f4, { bold: true, oy: 0.5 });
  }

  // ------------------------------------------------------------------ helpers

  /** An enemy's mini sprite key (frame by time; art-minis.ts records a sprite that has none). */
  private mini(sprite: string, t: number): string {
    return miniKey(sprite, t);
  }

  /** A filled pixel ellipse in the current fill. */
  private ellipse(g: G, cx: number, cy: number, rx: number, ry: number): void {
    for (let y = -Math.floor(ry); y <= ry; y++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (half > 0) g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2, 1);
    }
  }

  /** A pixel ellipse outline (1 px) in the current fill, dashed or whole. */
  private ring(g: G, cx: number, cy: number, rx: number, ry: number, dashed = true): void {
    const n = Math.max(24, Math.round(Math.max(rx, ry) * 10));
    let lx = 1e9;
    let ly = 1e9;
    for (let i = 0; i < n; i++) {
      if (dashed && Math.floor((i / n) * 12) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      if (x === lx && y === ly) continue;
      g.fillRect(x, y, 1, 1);
      lx = x;
      ly = y;
    }
  }
}
