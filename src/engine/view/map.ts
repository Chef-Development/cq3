// The act map: a parchment chart on a wooden board, rows of node icons left to right joined by dotted trails,
// the boss at the far right, Rowan's helmet marking where he stands. The nodes he can reach next glow and bob;
// tapping one walks the marker there and enters it.
import type Phaser from 'phaser';
import type { MapNode } from '../../core/map';
import type { FightScene } from '../scene';
import { buildBoard } from '../chrome';
import { textWidth } from '../font';
import { heroMaxHp } from '../../core/combat';
import { hpBar, hudIcon } from './pixels';
import { clamp01, ease, INK, WHITE, type Rect } from './shared';
import { parchment, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

const HOP_MS = 380;
/** What each node type is called (the label under the next nodes, and the boss). */
const NODE_NAME: Record<string, string> = { fight: 'Fight', elite: 'Elite', treasure: 'Treasure', rest: 'Rest', shop: 'Shop', event: '?', boss: 'Boss' };

export class MapView {
  private g!: G;
  private board: Phaser.GameObjects.Image | null = null;
  private marker: Phaser.GameObjects.Image | null = null;
  private icons: Phaser.GameObjects.Image[] = [];
  private iconsFor: unknown = null;
  private texts: TextPool;
  private speckles: Array<[number, number, number]> = [];
  private hop: { from: [number, number]; to: [number, number]; at: number } | null = null;
  rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 31);
  }

  /** New layout: the board texture is sized to the safe area. */
  build(): void {
    const s = this.s;
    this.rect = { x: s.L + 2, y: 2, w: s.R - s.L - 4, h: s.B - 4 };
    buildBoard(s, 'board_map', this.rect.w, this.rect.h);
    this.board?.destroy();
    this.board = s.add.image(this.rect.x, this.rect.y, 'board_map').setOrigin(0, 0).setDepth(30.2).setVisible(false);
    this.g?.destroy();
    this.g = s.add.graphics().setDepth(30.4);
    this.marker?.destroy();
    this.marker = s.add.image(0, 0, 'mapmarker').setOrigin(0.5, 1).setDepth(30.8).setVisible(false);
    for (const i of this.icons) i.destroy();
    this.icons = [];
    this.iconsFor = null;
    // a few fibres and stains in the paper, the same every time
    this.speckles = [];
    const p = this.paper();
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < (p.w * p.h) / 60; i++) this.speckles.push([4 + Math.floor(rnd() * (p.w - 8)), 4 + Math.floor(rnd() * (p.h - 8)), rnd() < 0.5 ? 0xe0c48e : 0xd8ba82]);
  }

  private paper(): Rect {
    const r = this.rect;
    return { x: r.x + 5, y: r.y + 5, w: r.w - 10, h: r.h - 10 };
  }

  /** Where a node sits on the chart (game px). Row -1 is the start, on the left edge. */
  pos(n: MapNode | null): [number, number] {
    const p = this.paper();
    const run = this.s.app.run;
    const cols = run.map.rows.length + 1;
    const dx = (p.w - 30) / (cols - 1);
    const top = p.y + 28;
    const bottom = p.y + p.h - 20;
    if (!n) return [Math.round(p.x + 15), Math.round((top + bottom) / 2)];
    const jitter = (k: number) => (((n.id * 97 + k * 31) % 7) - 3) * 0.8;
    const x = p.x + 15 + (n.row + 1) * dx + (n.type === 'boss' ? 0 : jitter(1));
    const y = n.type === 'boss' ? (top + bottom) / 2 : top + ((n.col + 0.5) * (bottom - top)) / n.of + jitter(2);
    return [Math.round(x), Math.round(y)];
  }

  /** The reachable node under a tap, if any. */
  nodeAt(x: number, y: number): number | null {
    if (this.hop) return null;
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

  /** Walk the marker to node `id`, then enter it. */
  choose(id: number): void {
    const s = this.s;
    const run = s.app.run;
    if (this.hop || !run.choices().includes(id)) return;
    this.hop = { from: this.pos(run.node), to: this.pos(run.map.nodes[id]), at: performance.now() };
    s.app.audio.mapSelect();
    window.setTimeout(() => {
      this.hop = null;
      if (s.app.run.phase === 'map') s.app.setPhase(() => s.app.run.chooseNode(id));
    }, HOP_MS);
  }

  private hide(): void {
    this.g.clear();
    this.board?.setVisible(false);
    this.marker?.setVisible(false);
    for (const i of this.icons) i.setVisible(false);
    this.texts.hide();
  }

  draw(now: number): void {
    const s = this.s;
    const run = s.app.run;
    if (run.phase !== 'map') return this.hide();
    const g = this.g;
    g.clear();
    this.texts.begin();
    const map = run.map;
    if (this.iconsFor !== map) {
      for (const i of this.icons) i.destroy();
      this.icons = map.nodes.map((n) => s.add.image(0, 0, `mapicon_${n.type}`).setOrigin(0.5, 0.5).setDepth(30.6));
      this.iconsFor = map;
    }
    // the world fades behind the board
    g.fillStyle(INK, 0.6);
    g.fillRect(0, 0, s.R + s.L + 1000, s.B + 200);
    this.board?.setVisible(true);
    const p = this.paper();
    parchment(g, p, this.speckles);

    // the act (top left), coins (top right), HP (bottom left); the pause and gear buttons sit at the top center
    const act = run.act;
    this.texts.text(`Act ${run.actIndex + 1}`, p.x + 6, p.y + 7, 0x5a3418, { bold: true, oy: 0.5 });
    this.texts.text(act.name, p.x + 6, p.y + 17, 0x7a5432, { oy: 0.5 });
    const H = run.hero;
    const max = heroMaxHp(run.tuning, H);
    const hy = p.y + p.h - 9;
    hudIcon(g, 'heart', p.x + 3, hy - 6);
    hpBar(g, p.x + 20, hy - 2, 34, 4, H.hp / max, H.hp / max, 0xe0463c);
    this.texts.text(`${H.hp}/${max}`, p.x + 58, hy, 0x5a3418, { oy: 0.5 });
    hudIcon(g, 'coin', p.x + p.w - 36, p.y + 3);
    this.texts.text(`${run.coins}`, p.x + p.w - 24, p.y + 7, 0x7a4a10, { bold: true, oy: 0.5 });
    if (run.rerolls > 0) this.texts.text(`Rerolls: ${run.rerolls}`, p.x + p.w - 6, p.y + 17, 0x3a5a9a, { ox: 1, oy: 0.5 });

    // trails
    const path = run.path;
    const here = run.node;
    const choices = run.choices();
    const onPath = (a: number, b: number) => {
      const i = path.indexOf(a);
      return i >= 0 && path[i + 1] === b;
    };
    const dots = (a: [number, number], b: [number, number], col: number, step: number, phase = 0, size = 1) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.floor(len / step);
      for (let k = 1; k < n; k++) {
        const t = (k + phase) / n;
        if (t <= 0.12 || t >= 0.88) continue; // leave room around the icons
        g.fillStyle(col, 1);
        g.fillRect(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), size, size);
      }
    };
    const start = this.pos(null);
    for (const id of map.rows[0]) {
      const live = path.length === 0;
      dots(start, this.pos(map.nodes[id]), live ? 0xb8781a : path[0] === id ? 0x9a3a22 : 0xc8a878, live ? 3 : 3, live ? (now / 300) % 1 : 0, path[0] === id ? 2 : 1);
    }
    for (const n of map.nodes)
      for (const c of n.next) {
        const visited = onPath(n.id, c);
        const live = here?.id === n.id;
        dots(this.pos(n), this.pos(map.nodes[c]), visited ? 0x9a3a22 : live ? 0xb8781a : 0xc8a878, 3, live ? (now / 300) % 1 : 0, visited ? 2 : 1);
      }

    // nodes
    const row = here ? here.row : -1;
    map.nodes.forEach((n, i) => {
      const img = this.icons[i];
      const [x, y] = this.pos(n);
      const visited = path.includes(n.id);
      const next = choices.includes(n.id);
      const passed = !visited && n.row <= row;
      let bob = 0;
      if (next) {
        // a pulsing glow under the nodes Rowan can go to
        const k = (now % 900) / 900;
        g.fillStyle(0xfff0a0, 0.55 - 0.35 * k);
        g.fillCircle(x, y, 9 + 3 * k);
        g.fillStyle(WHITE, 0.5);
        g.fillCircle(x, y, 8);
        bob = Math.floor(now / 300) % 2;
        this.texts.text(NODE_NAME[n.type] ?? '', x, y + 11, 0x5a3418, { ox: 0.5, oy: 0.5 });
      }
      if (n.type === 'boss') {
        g.fillStyle(0x9a2a2a, 0.25 + 0.1 * Math.sin(now / 300));
        g.fillCircle(x, y, 12);
        const name = run.tuning.enemies[n.enemies[0]]?.name ?? 'Boss';
        // keep the boss's name on the paper
        const half = textWidth(name, 1, false) / 2;
        if (!next) this.texts.text(name, Math.min(x, p.x + p.w - half - 4), y + 13, 0x7a1a1a, { ox: 0.5, oy: 0.5 });
      }
      img.setPosition(x, y - bob).setVisible(true).setAlpha(passed ? 0.35 : 1);
      if (visited) {
        // a red ink tick: been here
        g.fillStyle(0x9a2a1a, 1);
        g.fillRect(x + 5, y + 4, 1, 2);
        g.fillRect(x + 6, y + 5, 1, 2);
        g.fillRect(x + 7, y + 3, 1, 3);
        g.fillRect(x + 8, y + 1, 1, 3);
      }
    });

    // Rowan's marker: on the current node (or the start), hopping along the trail when moving
    let [mx, my] = this.pos(here);
    if (this.hop) {
      const k = ease(clamp01((performance.now() - this.hop.at) / HOP_MS));
      mx = this.hop.from[0] + (this.hop.to[0] - this.hop.from[0]) * k;
      my = this.hop.from[1] + (this.hop.to[1] - this.hop.from[1]) * k - Math.sin(k * Math.PI) * 8;
    }
    const mbob = this.hop ? 0 : Math.round(Math.sin(now / 250));
    g.fillStyle(0x6a4a2a, 0.35);
    g.fillRect(Math.round(mx) - 4, Math.round(my) - 1, 9, 2);
    this.marker?.setPosition(Math.round(mx), Math.round(my) - 7 + mbob).setVisible(true);

    if (!path.length) this.texts.text('Tap a glowing spot to travel', p.x + p.w - 6, p.y + p.h - 9, 0x7a5a32, { ox: 1, oy: 0.5 });
    this.texts.end();
  }
}
