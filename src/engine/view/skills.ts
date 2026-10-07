// The skill tree (a camp screen; docs/ui-style.md, "Skill tree"): the hero's tree growing on their style's stage,
// darker. Three branches grow up from a root at the bottom of the tree area (the hero's style emblem), five nodes each,
// bottom to top: big emblems linked by paths. Unlearned paths are dark grooves; learned ones glow in the branch's
// colour with a light running along them; the next one to learn pulses at the end of a bright dashed path. Capstones
// are crests with a gold rim, slow rays and a sparkle. Tap a node to see it on the glass card at the right (its
// emblem, name, kind and branch, what it does, a stat node's change) with the big Learn button at its foot (or
// "Learned", or what it needs); a second tap on a learnable node learns it too. Learning sends a pulse of energy
// from the last lit node (or the root) along the path into the node, which bursts alight (a ring, particles, a
// rising chime) as the points counter ticks down. The top bar: Back, the hero tabs (another unlocked hero's tree),
// the points (a big star and a number) and Reset (a second tap confirms: every point back).
import type Phaser from 'phaser';
import { HEROES, type HeroId } from '../../data/heroes';
import type { SkillBranch, SkillNode } from '../../data/skills';
import { canLearn, learn, levelFromXp, maxLevel, resetSkills, skillPoints, skillText, treeOf, type LearnCheck } from '../../core/heroes';
import { heroProgress } from '../../core/profile';
import { heroOwned, ownedHeroes } from '../../core/roster';
import { skillStatPreview } from '../../core/run';
import { textWidth } from '../font';
import { CampKit, D, GREEN, pix, pixSize, STYLE_LOOK } from './camp-kit';
import { padlock, wrapText } from './items';
import { chevron, glow, GOLD, NAVY, rows } from './pixels';
import { clamp01, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, tag } from './ui';
import { bigButton, drawStage, enterK, fillEllipse, glass, liftDim, popK, starShape, type Face } from './ui-modern';

type G = Phaser.GameObjects.Graphics;

/** Each branch's colours [hi, base, lo, deep], left to right: ember, azure, leaf. */
const BRANCH_FACE: Face[] = [
  [0xffd8a0, 0xf08a3a, 0xb0521a, 0x5a2410],
  [0xb0e4ff, 0x4a9af0, 0x2a5ac8, 0x14306a],
  [0xd0f8a0, 0x6ad04a, 0x2e9a34, 0x14502a],
];
const KIND_NAME: Record<SkillNode['kind'], string> = { stat: 'Stat', rule: 'Rule', capstone: 'Capstone' };
const KIND_FACE: Record<SkillNode['kind'], Face> = {
  stat: [0x9ad8ff, 0x3a74c8, 0x2a529a, 0x1a2c5a],
  rule: [0xe0b8ff, 0x9050d8, 0x6a30a8, 0x40186a],
  capstone: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14],
};
/** The energy's run from the last lit node into the one learned. */
export const FLOW_MS = 520;
const NODE = 18;
const CAP = 22;

export class SkillsScreen {
  hero: HeroId = 'rowan';
  sel = '';
  private openAt = 0;
  private heroAt = 0;
  private selAt = 0;
  /** When each node was learned (its energy runs, then it bursts alight). */
  private learnAt = new Map<string, number>();
  private resetAt = -1e9;
  private resetFrom: string[] = [];
  private armed = 0; // Reset waits for a second tap until then
  private shakeAt = -1e9;
  private tickAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, hero?: HeroId): void {
    this.openAt = now;
    this.armed = 0;
    this.learnAt.clear();
    this.resetFrom = [];
    this.setHero(hero ?? this.kit.profile.hero, now, true);
  }

  /** Show `id`'s tree, its most useful node selected (one to learn now, else the next in a branch). */
  setHero(id: HeroId, now: number, quiet = false): void {
    const kit = this.kit;
    if (!heroOwned(kit.profile, id)) id = 'rowan';
    this.hero = id;
    this.heroAt = now;
    this.armed = 0;
    const nodes = this.tree().flatMap((b) => b.nodes);
    const pick = nodes.find((n) => this.check(n.id) === 'ok') ?? nodes.find((n) => this.check(n.id) === 'points') ?? nodes[0];
    this.sel = pick?.id ?? '';
    this.selAt = now;
    if (!quiet) kit.app.audio.uiClick();
  }

  select(id: string, now: number): void {
    this.sel = id;
    this.selAt = now;
    this.kit.fadeToast();
    this.kit.app.audio.uiClick();
  }

  private tree(): SkillBranch[] {
    return treeOf(this.hero);
  }

  private prog() {
    return heroProgress(this.kit.profile, this.hero);
  }

  private check(id: string): LearnCheck {
    return canLearn(this.kit.tuning, this.hero, this.prog(), id);
  }

  /** Learned, and its energy has arrived (it shows lit). */
  private lit(id: string, now: number): boolean {
    return this.prog().skills.includes(id) && now - (this.learnAt.get(id) ?? -1e9) >= FLOW_MS;
  }

  // ------------------------------------------------------------------ layout

  /** The detail card (glass) on the right. */
  cardRect(): Rect {
    const s = this.kit.s;
    const w = 100;
    return { x: s.R - 3 - w, y: 20, w, h: s.B - 3 - 20 };
  }

  /** The tree's area: left of the card, under the top bar. */
  treeRect(): Rect {
    const s = this.kit.s;
    const c = this.cardRect();
    return { x: s.L + 3, y: 20, w: c.x - 4 - (s.L + 3), h: s.B - 3 - 20 };
  }

  private tabs() {
    return this.kit.heroTabs(false, this.pointsRect().x - 4);
  }

  /** Many heroes: the tabs are faces and Reset goes to its icon. */
  private crowded(): boolean {
    return ownedHeroes(this.kit.profile).length > 4;
  }

  resetRect(): Rect {
    const s = this.kit.s;
    const label = this.resetLabel();
    const w = (label ? textWidth(label, 1, true) + 4 : 0) + pixSize('reset')[0] + 10;
    return { x: s.R - 3 - w, y: 3, w, h: 13 };
  }

  private resetLabel(): string {
    if (this.armed > performance.now()) return 'Sure?';
    if (this.crowded()) return '';
    // the label goes when the top bar is full (the icon stays): right of the HTML buttons in its middle
    const z = this.kit.hudZone();
    const room = this.kit.s.R - 3 - (z.x + z.w) - this.pointsW() - 5;
    return room >= textWidth('Reset', 1, true) + 4 + pixSize('reset')[0] + 10 ? 'Reset' : '';
  }

  /** The points counter: a big star and the number of points to spend (shown before an energy run lands). */
  private shownPoints(now: number): number {
    const pending = [...this.learnAt.values()].filter((t) => now - t < FLOW_MS).length;
    return this.kit.level(this.hero).points + pending;
  }

  private pointsW(): number {
    return textWidth(`${this.shownPoints(performance.now())}`, 1, true) + 23;
  }

  private pointsRect(): Rect {
    const r = this.resetRect();
    const w = this.pointsW();
    return { x: r.x - 5 - w, y: 2, w, h: 15 };
  }

  /**
   * Where the tree's parts are: the root, and node j of branch i (centres). The branches rise in three columns that
   * lean outward as they climb, each node stepping to the other side of its column, so every link is a diagonal long
   * enough to see (there's only room for ~19 px of height per node on the phone).
   */
  private geo(): { cx: number; rootY: number; at: (i: number, j: number) => { x: number; y: number } } {
    const t = this.treeRect();
    const cx = t.x + Math.round(t.w / 2);
    const rootY = t.y + t.h - 9;
    const capY = t.y + 13;
    const n1 = rootY - 24;
    const step = (n1 - capY) / 4;
    const colW = (t.w - 24) / 3;
    const a = Math.min(13, Math.round(colW * 0.22));
    const zig = [-1, 1, -1, 1, -0.5];
    return {
      cx,
      rootY,
      at: (i, j) => {
        const side = i - 1;
        // the side columns lean out as they rise; each column zigzags (outward first)
        const col = cx + side * Math.round(colW * (0.98 + j * 0.03));
        const dir = side === 0 ? 1 : side;
        // the middle column sways less (its neighbours lean away from it)
        const amp = side === 0 ? a * 0.7 : a;
        return { x: Math.round(col + zig[j] * amp * dir), y: Math.round(n1 - j * step) };
      },
    };
  }

  /** Node j of branch i: its emblem's rect. */
  private nodeRect(i: number, j: number): Rect {
    const p = this.geo().at(i, j);
    const n = j === 4 ? CAP : NODE;
    return { x: p.x - n / 2, y: p.y - n / 2, w: n, h: n };
  }

  /** The big Learn button at the card's foot. */
  learnRect(): Rect {
    const c = this.cardRect();
    return { x: c.x + 5, y: c.y + c.h - 23, w: c.w - 10, h: 18 };
  }

  private where(id: string): { i: number; j: number } | null {
    const tree = this.tree();
    for (let i = 0; i < tree.length; i++) {
      const j = tree[i].nodes.findIndex((n) => n.id === id);
      if (j >= 0) return { i, j };
    }
    return null;
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (const { id, r } of this.tabs()) {
      if (!inRect(r, x, y, 2)) continue;
      notePress(r);
      if (id !== this.hero) this.setHero(id, now);
      return;
    }
    const rr = this.resetRect();
    if (inRect(rr, x, y, 2)) {
      notePress(rr);
      return this.doReset(now);
    }
    if (inRect(this.learnRect(), x, y, 2)) {
      notePress(this.learnRect());
      return this.doLearn(now);
    }
    const tree = this.tree();
    for (let i = 0; i < tree.length; i++)
      for (let j = 0; j < tree[i].nodes.length; j++)
        if (inRect(this.nodeRect(i, j), x, y, 3)) {
          notePress(this.nodeRect(i, j));
          const id = tree[i].nodes[j].id;
          if (id !== this.sel) this.select(id, now);
          else if (this.check(id) === 'ok') this.doLearn(now); // a second tap on a learnable node learns it
          return;
        }
  }

  private doLearn(now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const id = this.sel;
    const why = this.check(id);
    if (why !== 'ok') {
      this.shakeAt = now;
      kit.app.audio.uiClick();
      return;
    }
    const at = this.where(id)!;
    const node = this.tree()[at.i].nodes[at.j];
    const prev = skillStatPreview(t, kit.heroAs(this.hero), id);
    if (!learn(t, this.hero, this.prog(), id)) return;
    kit.commit();
    this.armed = 0;
    this.learnAt.set(id, now);
    // the energy sets off (a rising swell), then lands: the node bursts alight
    kit.app.audio.whoosh();
    const r = this.nodeRect(at.i, at.j);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const face = BRANCH_FACE[at.i] ?? BRANCH_FACE[0];
    const cap = node.kind === 'capstone';
    const heroAt = this.heroAt;
    kit.after(FLOW_MS, () => {
      if (this.heroAt !== heroAt || kit.app.run.phase !== 'camp') return;
      this.tickAt = performance.now();
      kit.app.audio.forgeUpgrade();
      for (let k = 0; k < 3; k++) kit.after(60 + k * 70, () => kit.app.audio.statUp(k + 2));
      kit.fx.flash(r, WHITE, 380);
      kit.fx.ring(cx, cy, cap ? 26 : 18, face[0], 460);
      kit.fx.burst(cx, cy, [face[0], face[1], WHITE, 0xfff0a0], cap ? 36 : 22, 1.1, { kind: 'star', g: 40, life: 650 });
      kit.fx.sparks(cx, cy, cap ? 14 : 8);
      if (cap)
        kit.after(140, () => {
          kit.fx.ring(cx, cy, 40, 0xffd23a, 640);
          kit.app.audio.rareSting(true);
        });
      // what it gave, rising off the node
      if (prev) kit.fx.float(`${prev.stat} ${prev.after}`, cx, r.y - 4, GREEN, { life: 1300 });
      const pr = this.pointsRect();
      kit.fx.float('-1', pr.x + pr.w / 2, pr.y + pr.h + 7, 0xffb0a0, { life: 900, rise: -6 });
    });
  }

  private doReset(now: number): void {
    const kit = this.kit;
    const prog = this.prog();
    if (!prog.skills.length) {
      this.shakeAt = now;
      kit.app.audio.uiClick();
      const r = this.resetRect();
      kit.fx.float('Nothing to reset', r.x + r.w / 2 - 20, r.y + r.h + 9, 0xd8d0f0, { life: 1100 });
      return;
    }
    if (this.armed < now) {
      this.armed = now + 2600;
      kit.app.audio.lockToggle();
      const r = this.resetRect();
      kit.fx.float('Tap again: all points back', Math.min(r.x + r.w / 2, kit.s.R - 70), r.y + r.h + 9, 0xfff0a0, { life: 1500 });
      return;
    }
    this.armed = 0;
    const learned = prog.skills.slice();
    const n = resetSkills(prog);
    kit.commit();
    this.resetAt = now;
    this.resetFrom = learned;
    this.learnAt.clear();
    kit.app.audio.whoosh(true);
    kit.after(120, () => kit.app.audio.coin());
    // every learned node pops back to a point that flies to the counter
    const pr = this.pointsRect();
    learned.forEach((id, k) => {
      const at = this.where(id);
      if (!at) return;
      const r = this.nodeRect(at.i, at.j);
      kit.fx.burst(r.x + r.w / 2, r.y + r.h / 2, [0xb8c2d8, WHITE, 0xfff0a0], 8, 0.7, { life: 420 });
      kit.fx.fly({ color: 0xffd23a, x0: r.x + r.w / 2, y0: r.y + r.h / 2, x1: pr.x + 8, y1: pr.y + 7, arc: 16, life: 380 + k * 40, delay: k * 40 });
    });
    kit.fx.float(`+${n} point${n > 1 ? 's' : ''}`, pr.x + pr.w / 2, pr.y + pr.h + 9, GREEN, { life: 1500, delay: 300 });
    this.setHero(this.hero, now, true);
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    liftDim(kit, (now - this.openAt) / 160);
    // the hero's stage, darker: the tree glows on it
    drawStage(kit, HEROES[this.hero].style, now, { alpha: enterK(now, this.openAt, 0, 0, 220), dim: 0.58, light: 0, motes: true });
    kit.drawBack(g, now);
    kit.drawHeroTabs(g, this.tabs(), this.hero, now);
    this.drawTop(g, now);
    this.drawTree(now);
    this.drawCard(now);
  }

  /** Points to spend (a big star and a number, glowing when there are some) and Reset. */
  private drawTop(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const n = this.shownPoints(now);
    const r = this.pointsRect();
    const tick = clamp01(1 - (now - this.tickAt) / 360);
    if (n > 0) glow(g, r, 0xffd23a, 0.25 + 0.3 * pulse(now, 1000), 3);
    tag(g, r, n > 0 ? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]] : [NAVY[6], NAVY[3], NAVY[2], NAVY[1]]);
    if (tick > 0) rows(g, r.x, r.y, r.w, r.h, 2, WHITE, 0.6 * tick);
    const sz = 11 + Math.round(tick * 2);
    starShape(kit.gOver, r.x + 8, r.y + r.h / 2, sz, n > 0 ? [0xfff8d0, 0xffd23a, 0xd8901c] : [0x9a90b8, 0x6a6088, 0x4a4068]);
    texts.text(`${n}`, r.x + 17, r.y + r.h / 2 - Math.round(tick * 2), n > 0 ? 0x5a2a08 : 0xa8a0c8, { bold: true, oy: 0.5 });
    const armed = this.armed > now;
    const rr = this.resetRect();
    const none = !this.prog().skills.length;
    kit.button(g, texts, rr, this.resetLabel(), armed ? FACE.red : FACE.navy, now, { icon: 'reset', disabled: none, glowCol: armed ? 0xff5a48 : undefined, shakeAt: none ? this.shakeAt : undefined });
  }

  /** The tree: the root, the paths (grooves, glowing, the next one dashed, an energy run), the nodes. */
  private drawTree(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const G2 = this.geo();
    const tree = this.tree();
    const prog = this.prog();
    const k0 = enterK(now, Math.max(this.openAt, this.heroAt), 0, 0, 260);
    // a soft glow round the root, the tree's light source
    const any = kit.level(this.hero).points > 0;
    fillEllipse(g, G2.cx, G2.rootY, 34, 14, any ? 0xffd890 : 0x8a7cc0, (0.08 + 0.05 * pulse(now, 1400)) * k0);
    fillEllipse(g, G2.cx, G2.rootY, 18, 8, any ? 0xffe8a0 : 0xa898d8, (0.1 + 0.06 * pulse(now, 1400)) * k0);
    // the paths, root to capstone, branch by branch (each grows in, in turn)
    tree.forEach((br, i) => {
      const face = BRANCH_FACE[i] ?? BRANCH_FACE[0];
      const bk = enterK(now, Math.max(this.openAt, this.heroAt), 1 + i, 70, 320);
      let from = { x: G2.cx, y: G2.rootY - 4 };
      br.nodes.forEach((node, j) => {
        const to = G2.at(i, j);
        const learned = prog.skills.includes(node.id);
        const prevLit = j === 0 || prog.skills.includes(br.nodes[j - 1].id);
        const why = this.check(node.id);
        const la = this.learnAt.get(node.id);
        const flowing = la !== undefined && now - la < FLOW_MS;
        // the segment grows in from its start as the screen opens
        const gk = clamp01(bk * 5 - j);
        if (gk > 0) {
          const end = { x: from.x + (to.x - from.x) * gk, y: from.y + (to.y - from.y) * gk };
          if (learned && !flowing) this.pathLit(g, from, end, face, now, i * 400 + j * 160);
          else if (prevLit && (why === 'ok' || why === 'points' || flowing)) this.pathNext(g, from, end, face, now, why === 'ok' || flowing);
          else this.pathGroove(g, from, end, face);
          if (flowing) this.energy(g, from, to, face, (now - la) / FLOW_MS);
        }
        from = to;
      });
    });
    this.drawRoot(g, G2.cx, G2.rootY, now, k0);
    // the nodes, popping in branch by branch
    tree.forEach((br, i) =>
      br.nodes.forEach((node, j) => {
        const pk = popK(now, Math.max(this.openAt, this.heroAt), 2 + i * 2 + j, 30, 220);
        if (pk <= 0) return;
        this.drawNode(this.nodeRect(i, j), node, i, now, pk);
      }),
    );
  }

  /** The root: the hero's style emblem in a gold socket. */
  private drawRoot(g: G, cx: number, cy: number, now: number, a: number): void {
    const kit = this.kit;
    const look = STYLE_LOOK[HEROES[this.hero].style];
    fillEllipse(g, cx, cy + 1, 9, 7, INK, 0.5 * a);
    fillEllipse(g, cx, cy, 9, 7, INK, a);
    fillEllipse(g, cx, cy, 8, 6, GOLD[2], a);
    fillEllipse(g, cx, cy - 1, 7, 5, GOLD[3], a);
    fillEllipse(g, cx, cy, 5, 4, look.face[3], a);
    g.fillStyle(GOLD[4], a);
    g.fillRect(cx - 4, cy - 6, 4, 1);
    const [iw, ih] = pixSize(look.icon);
    pix(kit.gOver, look.icon, Math.round(cx - iw / 2), Math.round(cy - ih / 2), a);
    // a gentle shimmer when there are points to spend
    if (kit.level(this.hero).points > 0) {
      const t = (now % 1600) / 1600;
      kit.gOver.fillStyle(WHITE, 0.6 * Math.sin(t * Math.PI) * a);
      kit.gOver.fillRect(Math.round(cx - 6 + t * 12), cy - 5, 1, 1);
    }
  }

  /** A dark groove (a path not walked yet), faintly in its branch's colour. */
  private pathGroove(g: G, a: { x: number; y: number }, b: { x: number; y: number }, face: Face): void {
    line(g, a, b, 5, INK, 0.8);
    line(g, a, b, 3, mix(face[3], NAVY[3], 0.5), 1);
    line(g, a, b, 1, mix(face[3], INK, 0.35), 1);
  }

  /** A learned path: glowing in the branch's colour, a slow light running along it. */
  private pathLit(g: G, a: { x: number; y: number }, b: { x: number; y: number }, face: Face, now: number, phase: number): void {
    line(g, a, b, 7, face[1], 0.18 + 0.08 * pulse(now, 1400, phase));
    line(g, a, b, 5, INK, 0.8);
    line(g, a, b, 3, face[1], 1);
    line(g, a, b, 1, face[0], 1);
    const t = ((now + phase) % 1800) / 1800;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    g.fillStyle(WHITE, 0.8 * Math.sin(t * Math.PI));
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }

  /** The path to the next node: bright dashes marching toward it (dimmer when there's no point to spend). */
  private pathNext(g: G, a: { x: number; y: number }, b: { x: number; y: number }, face: Face, now: number, ready: boolean): void {
    line(g, a, b, 5, INK, 0.8);
    line(g, a, b, 3, mix(face[3], NAVY[3], 0.5), 1);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const off = ((now / 60) % 5) | 0;
    const col = ready ? mix(face[0], WHITE, 0.3 * pulse(now, 900)) : mix(face[2], NAVY[4], 0.4);
    for (let d = off; d < len; d += 5) {
      const d1 = Math.min(len, d + 3);
      line(g, { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len }, { x: a.x + ((b.x - a.x) * d1) / len, y: a.y + ((b.y - a.y) * d1) / len }, 1, col, ready ? 1 : 0.8);
    }
  }

  /** The energy's run along a path: the path lights behind a blazing head, sparks flying off it. */
  private energy(g: G, a: { x: number; y: number }, b: { x: number; y: number }, face: Face, k: number): void {
    const e = k < 1 ? 1 - (1 - k) ** 2 : 1;
    const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const h = at(e);
    // the lit trail behind the head
    line(g, a, h, 9, face[1], 0.25);
    line(g, a, h, 5, face[1], 0.9);
    line(g, a, h, 3, face[0], 1);
    line(g, a, h, 1, WHITE, 1);
    // the head: a halo, a bright core, a short comet tail
    fillEllipse(g, h.x, h.y, 9, 9, face[0], 0.22);
    fillEllipse(g, h.x, h.y, 6, 6, face[0], 0.45);
    for (let i = 3; i >= 0; i--) {
      const p = at(Math.max(0, e - i * 0.05));
      const s = 6 - i;
      g.fillStyle(i === 0 ? WHITE : mix(face[0], WHITE, 0.4), 1 - i * 0.18);
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    if (Math.random() < 0.8) this.kit.fx.burst(h.x, h.y, [face[0], WHITE, 0xfff0a0], 2, 0.45, { kind: Math.random() < 0.5 ? 'star' : 'px', g: 30, life: 360 });
  }

  /** A node: a badge (a crest for a capstone) in its branch's colours when lit, a dark socket when not. */
  private drawNode(r0: Rect, node: SkillNode, branch: number, now: number, pk: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const over = kit.gOver;
    const face = BRANCH_FACE[branch] ?? BRANCH_FACE[0];
    const lit = this.lit(node.id, now);
    const why = this.check(node.id);
    const sel = node.id === this.sel;
    const cap = node.kind === 'capstone';
    const la = now - (this.learnAt.get(node.id) ?? -1e9) - FLOW_MS;
    const pop = la >= 0 && la < 300 ? Math.round(Math.sin((la / 300) * Math.PI) * 2) : 0;
    const unlit = this.resetFrom.includes(node.id) ? 1 - clamp01((now - this.resetAt) / 350) : 0;
    const press = isPressed(r0, now) ? 1 : 0;
    const sc = pk < 1 ? pk : 1;
    const grow = Math.round((1 - sc) * (r0.w / 2));
    const r = { x: r0.x - pop + grow, y: r0.y - pop - (sel ? 1 : 0) + press + grow, w: r0.w + pop * 2 - grow * 2, h: r0.h + pop * 2 - grow * 2 };
    if (r.w < 4) return;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const ready = why === 'ok' && !lit;
    // light behind it: a lit node glows in its colour, the next to learn breathes
    if (lit) fillEllipse(g, cx, cy, r.w * 0.85, r.h * 0.85, face[1], (cap ? 0.3 : 0.2) + 0.08 * pulse(now, 1400, branch * 300));
    if (ready) fillEllipse(g, cx, cy, r.w * 0.95, r.h * 0.95, face[0], 0.15 + 0.2 * pulse(now, 900));
    // a capstone's rays turn slowly behind its crest
    if (cap) {
      const n = 10;
      const rot = now / 4000;
      for (let k = 0; k < n; k++) {
        const ang = rot + (k / n) * Math.PI * 2;
        for (let d = r.w / 2 + 2; d < r.w / 2 + (k % 2 ? 5 : 9); d++) {
          g.fillStyle(lit ? GOLD[4] : mix(GOLD[2], NAVY[4], 0.35), lit ? 0.9 : 0.6);
          g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), 1, 1);
        }
      }
    }
    // the selection: a gold ring that pulses
    if (sel) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, cap ? 6 : 5, mix(GOLD[4], WHITE, pulse(now, 700)), 1);
    else if (ready) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, cap ? 6 : 5, mix(face[2], face[0], pulse(now, 900)), 1);
    // the badge: ink, a rim in the branch's colours (gold for a capstone), a well
    const rad = cap ? 5 : 4;
    const dullGold: Face = [0xc8a860, 0x8a6a34, 0x6a4e24, 0x3a2a14];
    const rim: Face = lit ? (cap ? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]] : face) : cap ? dullGold : why === 'order' ? [0x5a5470, 0x3e3a50, 0x302c40, 0x221e30] : [mix(face[0], NAVY[5], 0.5), mix(face[1], NAVY[3], 0.6), mix(face[2], NAVY[2], 0.6), face[3]];
    rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 1, rad + 1, INK, 0.5);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, rad + 1, INK, 1);
    rows(g, r.x, r.y, r.w, r.h, rad, rim[1], 1);
    g.fillStyle(rim[0], 1);
    g.fillRect(r.x + rad, r.y, r.w - rad * 2, 1);
    g.fillRect(r.x, r.y + rad, 1, r.h - rad * 2);
    g.fillStyle(rim[3], 1);
    g.fillRect(r.x + rad, r.y + r.h - 1, r.w - rad * 2, 1);
    g.fillRect(r.x + r.w - 1, r.y + rad, 1, r.h - rad * 2);
    const wi = cap ? 3 : 2;
    rows(g, r.x + wi, r.y + wi, r.w - wi * 2, r.h - wi * 2, Math.max(1, rad - 2), INK, 1);
    const well = lit ? mix(face[3], INK, 0.2) : 0x0e0a18;
    rows(g, r.x + wi + 1, r.y + wi + 1, r.w - wi * 2 - 2, r.h - wi * 2 - 2, Math.max(1, rad - 3), well, 1);
    if (lit) {
      g.fillStyle(mix(face[1], WHITE, 0.15), 0.35);
      g.fillRect(r.x + wi + 1, r.y + wi + 1, r.w - wi * 2 - 2, Math.round((r.h - wi * 2 - 2) * 0.45));
    }
    // the emblem: lit in colour, a shadow until then
    const key = kit.has(`skill_${node.id}`) ? `skill_${node.id}` : '';
    if (key && r.w >= 14) {
      const [w, h] = kit.imgs.size(key);
      kit.sprites.draw(key, Math.round(cx - w / 2), Math.round(cy - h / 2), D.icons, { alpha: lit ? 1 : why === 'order' ? 0.55 : 0.9, tint: lit ? undefined : why === 'order' ? 0x4a4468 : 0x9a90c0 });
    }
    // a capstone not reachable yet keeps a padlock; a capstone lit sparkles now and then
    if (cap && why === 'order') padlock(over, r.x + r.w - 6, r.y + r.h - 7, 0.95, 0xd8901c);
    if (cap && lit) {
      const t = (now % 2200) / 2200;
      if (t < 0.25) {
        const s = Math.round(Math.sin((t / 0.25) * Math.PI) * 3);
        over.fillStyle(WHITE, 0.95);
        over.fillRect(r.x + 3 - s, r.y + 3, s * 2 + 1, 1);
        over.fillRect(r.x + 3, r.y + 3 - s, 1, s * 2 + 1);
      }
    }
    // the moment it lights: a white flash; a reset: a white blink as its point flies back
    if (la >= 0 && la < 380) rows(over, r.x, r.y, r.w, r.h, rad, WHITE, 0.85 * (1 - la / 380));
    if (unlit > 0) rows(over, r.x, r.y, r.w, r.h, rad, WHITE, 0.7 * unlit);
  }

  /** The glass card: the node's emblem, kind and branch, name, what it does, a stat node's change, Learn. */
  private drawCard(now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const g = kit.gUi;
    const texts = kit.texts;
    const c0 = this.cardRect();
    const ck = enterK(now, this.openAt, 2, 0, 260);
    const c = { ...c0, x: c0.x + Math.round((1 - easeOut3(ck)) * 20) };
    const at = this.where(this.sel);
    if (!at) return;
    const br = this.tree()[at.i];
    const node = br.nodes[at.j];
    const face = BRANCH_FACE[at.i] ?? BRANCH_FACE[0];
    glass(g, c, { alpha: ck, rim: mix(face[2], INK, 0.3), clear: 0.18 });
    if (ck < 0.6) return;
    const k = clamp01((now - this.selAt) / 160) * clamp01((ck - 0.6) / 0.4);
    const dx = Math.round((1 - easeOut3(clamp01((now - this.selAt) / 200))) * 6);
    const ix = c.x + 5 + dx;
    const iw = c.w - 10;
    const why = this.check(node.id);
    const learned = why === 'learned';
    // the emblem at 2x in its badge
    const em = { x: ix, y: c.y + 5, w: 28, h: 28 };
    const lit = this.lit(node.id, now);
    rows(g, em.x - 1, em.y - 1, em.w + 2, em.h + 2, 5, INK, k);
    rows(g, em.x, em.y, em.w, em.h, 4, lit ? (node.kind === 'capstone' ? GOLD[3] : face[1]) : NAVY[4], k);
    rows(g, em.x + 2, em.y + 2, em.w - 4, em.h - 4, 3, lit ? mix(face[3], INK, 0.2) : 0x0e0a18, k);
    g.fillStyle(lit ? face[0] : NAVY[6], k);
    g.fillRect(em.x + 4, em.y, em.w - 8, 1);
    const key = kit.has(`skill_${node.id}`) ? `skill_${node.id}` : '';
    if (key) {
      const [w, h] = kit.imgs.size(key);
      kit.sprites.draw(key, em.x + Math.round((em.w - w * 2) / 2), em.y + Math.round((em.h - h * 2) / 2), D.icons, { scale: 2, alpha: k * (lit ? 1 : 0.85), tint: lit ? undefined : 0xa8a0d0 });
    }
    // kind chip and branch, beside the emblem
    const kx = em.x + em.w + 5;
    const kind = KIND_NAME[node.kind];
    const kw = textWidth(kind, 1, true) + 6;
    tag(g, { x: kx, y: em.y + 2, w: kw, h: 10 }, KIND_FACE[node.kind], k);
    texts.text(kind, kx + kw / 2, em.y + 7, node.kind === 'capstone' ? 0x5a2a08 : WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
    const bName = textWidth(br.name, 1, true) <= c.x + c.w - 4 - kx ? br.name : '';
    if (bName) texts.text(bName, kx, em.y + 21, face[0], { bold: true, oy: 0.5, alpha: k });
    // the name (bold; two lines if it must)
    let y = em.y + em.h + 7;
    const nameLines = wrapText(node.name, iw, true);
    for (const l of nameLines.slice(0, 2)) {
      texts.text(l, ix, y, WHITE, { bold: true, oy: 0.5, alpha: k });
      y += 10;
    }
    // what it does
    y += 1;
    const lines = wrapText(skillText(t, node), iw);
    const stat = skillStatPreview(t, kit.heroAs(this.hero), node.id);
    const room = this.learnRect().y - 4 - (stat ? 14 : 0);
    for (const l of lines) {
      if (y + 3 > room) break;
      texts.text(l, ix, y, 0xe8e2ff, { oy: 0.5, alpha: k });
      y += 8;
    }
    // a stat node: before > after
    if (stat) {
      const sy = this.learnRect().y - 11;
      rows(g, ix - 2, sy - 6, iw + 4, 12, 2, NAVY[1], 0.8 * k);
      texts.text(stat.stat, ix, sy, 0xd8d0f0, { bold: true, oy: 0.5, alpha: k });
      const x = ix + iw;
      const bw = textWidth(stat.after, 1, true);
      texts.text(stat.after, x, sy, GREEN, { bold: true, ox: 1, oy: 0.5, alpha: k });
      chevron(g, x - bw - 8, sy - 3, 7, GREEN, k, 1, true);
      texts.text(stat.before, x - bw - 11, sy, 0xb0a8c8, { bold: true, ox: 1, oy: 0.5, alpha: k });
    }
    // Learn, or why not
    const b = this.learnRect();
    const bb = { ...b, x: b.x + Math.round((1 - easeOut3(ck)) * 20) };
    if (learned) {
      kit.button(g, texts, bb, 'Learned', FACE.gold, now, { icon: 'check' });
      return;
    }
    const prev = at.j > 0 ? br.nodes[at.j - 1] : null;
    const bw = b.w - 8;
    const reason = why === 'order' && prev ? fit([`${prev.name} first`, `Needs ${prev.name}`, 'Learn the one below'], bw) : why === 'points' ? this.noPoints(bw) : '';
    if (reason) {
      const sk = clamp01(1 - (now - this.shakeAt) / 450);
      kit.button(g, texts, bb, reason, FACE.grey, now, { disabled: true, bold: textWidth(reason, 1, true) <= bw, shakeAt: this.shakeAt, labelCol: sk > 0 ? mix(0xff9a8a, WHITE, 1 - sk) : undefined });
      return;
    }
    bigButton(kit, g, texts, bb, 'Learn', FACE.green, now, { icon: 'up', shakeAt: this.shakeAt });
  }

  /** "Lv 8 for a point" (the next level that brings one), or "No points left" at the max level. */
  private noPoints(w: number): string {
    const t = this.kit.tuning;
    const lv = levelFromXp(t, this.prog().xp);
    let next = lv + 1;
    while (next <= maxLevel(t) && skillPoints(t, next) <= skillPoints(t, lv)) next++;
    if (next > maxLevel(t)) return 'No points left';
    return fit([`Point at Lv ${next}`, `Lv ${next}`], w);
  }
}

/** The first option that fits `w` in bold (else the plain font's), or the last. */
function fit(options: string[], w: number): string {
  return options.find((o) => textWidth(o, 1, true) <= w) ?? options.find((o) => textWidth(o, 1, false) <= w) ?? options[options.length - 1];
}

/** A straight line `th` px thick from a to b, stepped along its long axis (crisp pixels). */
function line(g: G, a: { x: number; y: number }, b: { x: number; y: number }, th: number, col: number, alpha: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  if (n < 0.5) return;
  g.fillStyle(col, alpha);
  const half = Math.floor(th / 2);
  if (Math.abs(dy) >= Math.abs(dx)) {
    const y0 = Math.round(Math.min(a.y, b.y));
    const y1 = Math.round(Math.max(a.y, b.y));
    for (let y = y0; y <= y1; y++) {
      const x = a.x + (dx * (y - a.y)) / (dy || 1);
      g.fillRect(Math.round(x) - half, y, th, 1);
    }
  } else {
    const x0 = Math.round(Math.min(a.x, b.x));
    const x1 = Math.round(Math.max(a.x, b.x));
    for (let x = x0; x <= x1; x++) {
      const y = a.y + (dy * (x - a.x)) / (dx || 1);
      g.fillRect(x, Math.round(y) - half, 1, th);
    }
  }
}

