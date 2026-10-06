// The skill tree (a camp screen): the picked hero's tree (tabs switch to another unlocked hero's). Points to spend at
// the top. On the left the three branches, each a row: its name and theme, then five nodes left to right joined by
// links (gold once learned), the capstone at the end bigger and gold. On the right the tapped node: its icon, name,
// kind (Stat / Rule / Capstone), what it does in one short text, and for a stat node the change ("ATK 12 > 13");
// then Learn (or why not: "Learn Keen Edge first", "No points: reach Lv 8"). Learning
// flashes the node, lights its link and shows the change; Reset (a second tap confirms) gives every point back.
// (Rows rather than columns so the node card fits beside the tree on the phone.)
import type Phaser from 'phaser';
import { STAT_INFO, type StatId } from '../../data/gear';
import type { HeroId } from '../../data/heroes';
import type { SkillBranch, SkillNode, SkillStat } from '../../data/skills';
import { canLearn, learn, levelFromXp, maxLevel, resetSkills, skillPoints, skillPreview, skillText, treeOf, type LearnCheck } from '../../core/heroes';
import { heroProgress } from '../../core/profile';
import { heroOwned, ownedHeroes } from '../../core/roster';
import { skillStatPreview } from '../../core/run';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GOLD_TXT, GREEN, pix, pixSize, statChanges } from './camp-kit';
import { padlock, wrapText } from './items';
import { chevron, glow, GOLD, iconSize, NAVY, rows } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

/** Node frames by kind [hi, base, lo, deep]. */
const KIND_FACE: Record<SkillNode['kind'], Face> = {
  stat: [0x9ad8ff, 0x3a74c8, 0x2a529a, 0x1a2c5a],
  rule: [0xe0b8ff, 0x9050d8, 0x6a30a8, 0x40186a],
  capstone: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14],
};
const KIND_NAME: Record<SkillNode['kind'], string> = { stat: 'Stat', rule: 'Rule', capstone: 'Capstone' };
const STAT_OF: Record<SkillStat, StatId> = { atkPct: 'atk', critChance: 'critChance', hpPct: 'hp', def: 'def', meterGain: 'meterGain', comboPower: 'comboPower' };
/** Each branch's name color (top to bottom). */
const BRANCH_COL = [0xffc8a0, 0x9ad8ff, 0xb4f070];

export class SkillsScreen {
  hero: HeroId = 'rowan';
  sel = '';
  private openAt = 0;
  private heroAt = 0;
  private selAt = 0;
  private learnAt = new Map<string, number>();
  private resetAt = -1e9;
  private resetFrom: string[] = [];
  private armed = 0; // Reset waits for a second tap until then
  private shakeAt = -1e9;

  constructor(private readonly kit: CampKit) {}

  open(now: number, hero?: HeroId): void {
    this.openAt = now;
    this.armed = 0;
    this.learnAt.clear();
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

  // ------------------------------------------------------------------ layout

  private get W(): number {
    const s = this.kit.s;
    return s.R - s.L - 6;
  }

  private treeRect(): Rect {
    const s = this.kit.s;
    const tw = Math.max(124, Math.round(this.W * 0.45));
    return { x: s.L + 3, y: 20, w: tw, h: s.B - 23 };
  }

  private panelRect(): Rect {
    const s = this.kit.s;
    const t = this.treeRect();
    const x = t.x + t.w + 4;
    return { x, y: 20, w: s.R - 3 - x, h: s.B - 23 };
  }

  private tabs() {
    return this.kit.heroTabs(false, this.pointsRect().x - 4);
  }

  /** Many heroes: the tabs are faces and the top bar's points and Reset go compact (a number, an icon). */
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

  private pointsText(): string {
    const n = this.kit.level(this.hero).points;
    if (this.crowded()) return `${n}`;
    return n > 0 ? `${n} point${n > 1 ? 's' : ''}` : 'No points';
  }

  private pointsW(): number {
    return textWidth(this.pointsText(), 1, true) + 18;
  }

  private pointsRect(): Rect {
    const r = this.resetRect();
    const w = this.pointsW();
    return { x: r.x - 5 - w, y: 3, w, h: 13 };
  }

  /** Branch i's block in the tree panel. */
  private block(i: number): Rect {
    const t = this.treeRect();
    const h = Math.min(40, Math.floor((t.h - 4) / 3));
    const gap = Math.floor((t.h - 4 - h * 3) / 2);
    return { x: t.x + 4, y: t.y + 2 + i * (h + gap), w: t.w - 8, h };
  }

  /** Node j of branch i. */
  private nodeRect(i: number, j: number): Rect {
    const b = this.block(i);
    const cap = j === 4;
    const n = cap ? 20 : 16;
    const x0 = b.x + 10;
    const x1 = b.x + b.w - 12;
    const cx = Math.round(x0 + ((x1 - x0) * j) / 4);
    const cy = b.y + b.h - 11;
    return { x: cx - n / 2, y: cy - n / 2, w: n, h: n };
  }

  private learnRect(): Rect {
    const p = this.panelRect();
    return { x: p.x + 6, y: p.y + p.h - 20, w: p.w - 12, h: 15 };
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
        if (inRect(this.nodeRect(i, j), x, y, 4)) {
          const id = tree[i].nodes[j].id;
          if (id !== this.sel) this.select(id, now);
          else if (this.check(id) === 'ok') this.doLearn(now); // a second tap on a learnable node learns it
          return;
        }
  }

  private where(id: string): { i: number; j: number } | null {
    const tree = this.tree();
    for (let i = 0; i < tree.length; i++) {
      const j = tree[i].nodes.findIndex((n) => n.id === id);
      if (j >= 0) return { i, j };
    }
    return null;
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
    const node = this.tree().flatMap((b) => b.nodes).find((n) => n.id === id)!;
    const picked = kit.profile.hero === this.hero;
    const before = picked ? kit.stats() : null;
    const prev = skillStatPreview(t, kit.heroAs(this.hero), id);
    if (!learn(t, this.hero, this.prog(), id)) return;
    kit.commit();
    this.armed = 0;
    this.learnAt.set(id, now);
    // the payoff: the hammer-and-chime of the forge's upgrade, the node bursts, its link lights up
    kit.app.audio.forgeUpgrade();
    for (let i = 0; i < 3; i++) kit.after(90 + i * 70, () => kit.app.audio.statUp(i + 2));
    const at = this.where(id)!;
    const r = this.nodeRect(at.i, at.j);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const cols = node.kind === 'capstone' ? [0xfff0a0, 0xffd23a, WHITE, 0xff9a2a] : node.kind === 'rule' ? [0xe0b8ff, WHITE, 0xfff0a0] : [0x9ad8ff, WHITE, 0xfff0a0];
    kit.fx.flash(r, WHITE, 420);
    kit.fx.ring(cx, cy, node.kind === 'capstone' ? 26 : 18, 0xfff0a0, 460);
    kit.fx.burst(cx, cy, cols, node.kind === 'capstone' ? 34 : 20, 1.1, { kind: 'star', g: 40, life: 650 });
    kit.fx.sparks(cx, cy, 10);
    if (node.kind === 'capstone')
      kit.after(140, () => {
        kit.fx.ring(cx, cy, 36, 0xffd23a, 600);
        kit.app.audio.rareSting(true);
      });
    const pr = this.pointsRect();
    kit.fx.float('-1', pr.x + pr.w / 2, pr.y + pr.h + 8, 0xffb0a0, { icon: 'skills', life: 900, rise: -6 });
    // what changed: the hero's stats before -> after (a stat node), or what the rule does now
    const after = picked ? kit.stats() : null;
    const lines = before && after ? statChanges(before, after, Object.values(STAT_OF)) : [];
    const t2 = this.treeRect();
    const pv = skillPreview(t, node);
    kit.after(160, () =>
      kit.toast({
        title: `${node.name}!`,
        ribbon: node.kind === 'capstone' ? RIBBON.gold : node.kind === 'rule' ? RIBBON.purple : RIBBON.blue,
        lines: lines.length ? lines : prev ? [{ label: prev.stat, from: prev.before, to: prev.after, good: true }] : [],
        text: 'after' in pv ? wrapText(pv.after, Math.max(90, t2.w - 30)).map((l) => ({ text: l, col: 0xd8ffc0 })) : undefined,
        cx: t2.x + t2.w / 2,
        cy: t2.y + t2.h / 2,
      }),
    );
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
    kit.app.audio.whoosh();
    kit.after(120, () => kit.app.audio.coin());
    // every learned node pops back to a point that flies to the counter
    const pr = this.pointsRect();
    learned.forEach((id, k) => {
      const at = this.where(id);
      if (!at) return;
      const r = this.nodeRect(at.i, at.j);
      kit.fx.burst(r.x + r.w / 2, r.y + r.h / 2, [0xb8c2d8, WHITE, 0xfff0a0], 8, 0.7, { life: 420 });
      kit.fx.fly({ color: 0xffd23a, x0: r.x + r.w / 2, y0: r.y + r.h / 2, x1: pr.x + 8, y1: pr.y + 6, arc: 16, life: 380 + k * 40, delay: k * 40 });
    });
    kit.fx.float(`+${n} point${n > 1 ? 's' : ''}`, pr.x + pr.w / 2, pr.y + pr.h + 9, GREEN, { life: 1500, delay: 300 });
    this.setHero(this.hero, now, true);
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    // the hero tabs name the screen (whose tree it is); points and Reset on the right
    kit.drawHeroTabs(g, this.tabs(), this.hero, now);
    this.drawTop(g, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k <= 0) return;
    const t0 = this.treeRect();
    const t = { ...t0, x: t0.x - Math.round((1 - k) * 24) };
    kit.pane(g, t, { alpha: clamp01(k * 2) });
    const p0 = this.panelRect();
    const p = { ...p0, x: p0.x + Math.round((1 - k) * 24) };
    kit.pane(g, p, { alpha: clamp01(k * 2) });
    if (k < 0.9) return;
    this.drawTree(g, now);
    this.drawNode(g, p0, now);
  }

  /** Points to spend (glowing when there are some) and Reset. */
  private drawTop(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const n = kit.level(this.hero).points;
    const r = this.pointsRect();
    if (n > 0) glow(g, r, 0xffd23a, 0.25 + 0.3 * pulse(now, 1000), 3);
    tag(g, r, n > 0 ? [GOLD[4], GOLD[3], GOLD[2], GOLD[0]] : [NAVY[6], NAVY[3], NAVY[2], NAVY[1]]);
    pix(g, 'skills', r.x + 2, r.y + 1, n > 0 ? 1 : 0.5);
    texts.text(this.pointsText(), r.x + 14, r.y + 6.5, n > 0 ? 0x5a2a08 : 0xa8a0c8, { bold: true, oy: 0.5 });
    const armed = this.armed > now;
    const rr = this.resetRect();
    const none = !this.prog().skills.length;
    kit.button(g, texts, rr, this.resetLabel(), armed ? FACE.red : FACE.navy, now, { icon: 'reset', disabled: none, glowCol: armed ? 0xff5a48 : undefined, shakeAt: none ? this.shakeAt : undefined });
  }

  private nodeIcon(node: SkillNode): string {
    if (this.kit.has(`skill_${node.id}`)) return `skill_${node.id}`;
    return '';
  }

  /** A node's fallback icon (until its own art is drawn): its stat's icon, a rune, or a star. */
  private fallbackIcon(node: SkillNode): string {
    if (node.kind === 'stat' && node.stat) {
      if (node.stat === 'hpPct') return 'heartS';
      const ic = STAT_INFO[STAT_OF[node.stat]].icon;
      const [w, h] = iconSize(ic);
      return w <= 13 && h <= 13 ? ic : 'up';
    }
    return node.kind === 'capstone' ? 'skills' : 'rune';
  }

  private drawTree(g: G, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const over = kit.gOver;
    const prog = this.prog();
    const hk = clamp01((now - this.heroAt) / 200);
    this.tree().forEach((br, i) => {
      const b = this.block(i);
      const bk = clamp01((now - this.heroAt - i * 60) / 200);
      // the branch: name (and how much of it is learned) over its theme
      const have = br.nodes.filter((n) => prog.skills.includes(n.id)).length;
      texts.text(br.name, b.x + 2, b.y + 5, BRANCH_COL[i] ?? WHITE, { bold: true, oy: 0.5, alpha: bk });
      texts.text(`${have}/5`, b.x + b.w, b.y + 5, have === 5 ? GOLD_TXT : DIM_TXT, { ox: 1, oy: 0.5, alpha: bk });
      texts.text(br.theme, b.x + 2, b.y + 13, 0xb0a8d0, { oy: 0.5, alpha: bk });
      if (i > 0) {
        g.fillStyle(NAVY[1], 0.8);
        g.fillRect(b.x, b.y - 2, b.w, 1);
      }
      // links, then nodes
      br.nodes.forEach((node, j) => {
        if (j === 0) return;
        const a = this.nodeRect(i, j - 1);
        const c = this.nodeRect(i, j);
        const x0 = a.x + a.w + 1;
        const x1 = c.x - 1;
        const y = Math.round(a.y + a.h / 2) - 1;
        const lit = prog.skills.includes(node.id);
        const open = !lit && prog.skills.includes(br.nodes[j - 1].id);
        g.fillStyle(INK, 1);
        g.fillRect(x0, y - 1, x1 - x0, 4);
        if (lit) {
          // the link lights from left to right when the node is learned
          const lk = easeOut3((now - (this.learnAt.get(node.id) ?? -1e9)) / 260);
          const w = Math.round((x1 - x0) * lk);
          g.fillStyle(GOLD[3], 1);
          g.fillRect(x0, y, w, 2);
          g.fillStyle(GOLD[4], 1);
          g.fillRect(x0, y, w, 1);
          if (lk < 1) glow(g, { x: x0, y, w, h: 2 }, 0xfff0a0, 0.6, 2);
        } else {
          g.fillStyle(NAVY[3], 1);
          g.fillRect(x0, y, x1 - x0, 2);
          if (open) {
            // the next step: a dashed line with a light running along it
            const run = (now / 900) % 1;
            g.fillStyle(GOLD[1], 1);
            for (let x = x0; x < x1; x += 3) g.fillRect(x, y, 2, 1);
            g.fillStyle(GOLD[4], 0.8);
            g.fillRect(Math.round(x0 + (x1 - x0 - 2) * run), y, 2, 2);
          }
        }
      });
      br.nodes.forEach((node, j) => this.drawNodeCell(g, over, this.nodeRect(i, j), node, now, bk * hk));
    });
  }

  private drawNodeCell(g: G, over: G, r0: Rect, node: SkillNode, now: number, alpha: number, inCard = false): void {
    const kit = this.kit;
    const prog = this.prog();
    const learned = prog.skills.includes(node.id);
    const why = this.check(node.id);
    const on = node.id === this.sel && !inCard;
    const face = KIND_FACE[node.kind];
    const lk = now - (this.learnAt.get(node.id) ?? -1e9);
    const pop = lk >= 0 && lk < 300 ? Math.round(Math.sin((lk / 300) * Math.PI) * 2) : 0;
    // just reset: the node blinks white as its point flies back
    const unlit = this.resetFrom.includes(node.id) ? 1 - clamp01((now - this.resetAt) / 350) : 0;
    const r = { x: r0.x - pop, y: r0.y - pop - (on ? 1 : 0), w: r0.w + pop * 2, h: r0.h + pop * 2 };
    const a = alpha;
    const locked = why === 'order';
    if (learned) glow(g, r, face[1], (node.kind === 'capstone' ? 0.5 : 0.3) * a, node.kind === 'capstone' ? 3 : 2);
    // one to learn now: a green halo that breathes (and a green rim unless it's the selected one)
    const ok = why === 'ok' && !inCard;
    if (ok) glow(g, r, 0x8af06a, (0.45 + 0.45 * pulse(now, 900)) * a, 3);
    if (on) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, mix(GOLD[4], WHITE, pulse(now, 700)), a);
    else if (ok) rows(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 3, mix(0x3aaa34, 0xb4f070, pulse(now, 900)), a);
    rows(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 3, INK, a);
    const lit = learned;
    const grey = [0x6a6478, 0x4a4458, 0x3a3448, 0x26222e] as const;
    // out of reach: grey (a capstone keeps a dull gold, so the branch's goal still stands out)
    const fr = locked ? (node.kind === 'capstone' ? ([mix(face[0], grey[0], 0.6), mix(face[1], grey[1], 0.65), mix(face[2], grey[2], 0.65), grey[3]] as const) : grey) : lit ? face : ([mix(face[0], NAVY[5], 0.5), mix(face[1], NAVY[3], 0.55), mix(face[2], NAVY[2], 0.55), face[3]] as const);
    rows(g, r.x, r.y, r.w, r.h, 2, fr[1], a);
    g.fillStyle(fr[0], a);
    g.fillRect(r.x + 2, r.y, r.w - 4, 1);
    g.fillStyle(fr[3], a);
    g.fillRect(r.x + 2, r.y + r.h - 1, r.w - 4, 1);
    // the well: bright when learned, dark otherwise
    const well = lit ? mix(face[2], INK, 0.25) : mix(NAVY[1], INK, 0.3);
    g.fillStyle(well, a);
    g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    if (lit) {
      g.fillStyle(mix(face[1], WHITE, 0.15), 0.5 * a);
      g.fillRect(r.x + 1, r.y + 1, r.w - 2, Math.round((r.h - 2) * 0.4));
    }
    // the icon (dim until learned, a shadow when its branch hasn't reached it)
    const ia = a * (lit ? 1 : locked ? 0.75 : 0.85);
    const key = this.nodeIcon(node);
    if (key) {
      // the card shows the node's icon at 2x; out of reach, the icon is a dim shadow
      const sc = inCard ? 2 : 1;
      const [w, h] = kit.imgs.size(key);
      kit.sprites.draw(key, r.x + Math.round((r.w - w * sc) / 2), r.y + Math.round((r.h - h * sc) / 2), D.icons, { alpha: ia, scale: sc, tint: locked ? 0x6a6288 : lit ? undefined : 0xb8b0d0 });
    } else {
      const ic = this.fallbackIcon(node);
      const [w, h] = pixSize(ic);
      pix(over, ic, r.x + Math.round((r.w - w) / 2), r.y + Math.round((r.h - h) / 2), ia);
    }
    if (lit) {
      // a small check in the corner
      over.fillStyle(INK, a);
      over.fillRect(r.x + r.w - 5, r.y + r.h - 5, 6, 6);
      over.fillStyle(GREEN, a);
      over.fillRect(r.x + r.w - 4, r.y + r.h - 4, 4, 4);
      over.fillStyle(WHITE, a);
      over.fillRect(r.x + r.w - 3, r.y + r.h - 3, 2, 1);
    } else if (locked && node.kind === 'capstone') padlock(over, r.x + r.w - 5, r.y + r.h - 6, a * 0.9, 0xd8901c);
    if (lk >= 0 && lk < 400) rows(over, r.x, r.y, r.w, r.h, 2, WHITE, 0.8 * (1 - lk / 400));
    if (unlit > 0) rows(over, r.x, r.y, r.w, r.h, 2, WHITE, 0.7 * unlit);
  }

  /** The selected node's card. */
  private drawNode(g: G, p: Rect, now: number): void {
    const kit = this.kit;
    const t = kit.tuning;
    const texts = kit.texts;
    const node = this.tree().flatMap((b) => b.nodes).find((n) => n.id === this.sel);
    if (!node) return;
    const at = this.where(node.id)!;
    const br = this.tree()[at.i];
    const k = easeBack((now - this.selAt) / 200, 1.6);
    const a = clamp01((now - this.selAt) / 120);
    const sx = Math.round((1 - k) * 6);
    const ix = p.x + 6 + sx;
    const iw = p.w - 12;
    const why = this.check(node.id);
    const learned = why === 'learned';
    // header: the node at 2x in its frame, the name (in the plain font if the bold one is too wide), kind and branch
    const cell = { x: ix, y: p.y + 5, w: 26, h: 26 };
    this.drawNodeCell(g, kit.gOver, cell, node, now, a, true);
    const nx = cell.x + cell.w + 6;
    const nw = p.x + p.w - 6 - nx;
    texts.text(node.name, nx, p.y + 11, WHITE, { bold: textWidth(node.name, 1, true) <= nw, oy: 0.5, alpha: a });
    const kind = KIND_NAME[node.kind];
    const kw = textWidth(kind, 1, false) + 6;
    const chip = { x: nx, y: p.y + 18, w: kw, h: 9 };
    tag(g, chip, KIND_FACE[node.kind], a);
    texts.text(kind, chip.x + 3, chip.y + 4.5, node.kind === 'capstone' ? 0x5a2a08 : WHITE, { oy: 0.5, alpha: a });
    if (textWidth(br.name, 1, false) <= nw - kw - 4) texts.text(br.name, chip.x + kw + 4, chip.y + 4.5, BRANCH_COL[at.i] ?? DIM_TXT, { oy: 0.5, alpha: a });
    // what it does, then what changes; spaced out when there's room above the button, tighter when not
    const text = wrapText(skillText(t, node), iw);
    const stat = skillStatPreview(t, kit.heroAs(this.hero), node.id);
    const body = text.length * 9 + (stat ? 13 : 0);
    const room = this.learnRect().y - 4 - (p.y + 35);
    const roomy = body + 13 <= room;
    let y = p.y + (roomy ? 41 : 37);
    for (const l of text) {
      texts.text(l, ix, y, 0xe8e2ff, { oy: 0.5, alpha: a });
      y += 9;
    }
    if (stat && roomy) {
      y += 2;
      kit.divider(g, ix, y, iw);
      y += 7;
    } else if (stat) y += 3;
    if (stat) {
      const row = { x: ix - 2, y: y - 6, w: iw + 4, h: 13 };
      rows(g, row.x, row.y, row.w, row.h, 2, NAVY[1], a);
      const id = node.stat ? STAT_OF[node.stat] : 'atk';
      const ic = STAT_INFO[id].icon;
      const [icw, ich] = iconSize(ic);
      const big = ich <= 11;
      if (big) pix(g, ic, ix, Math.round(y - ich / 2));
      let x = ix + (big ? icw + 3 : 0);
      texts.text(stat.stat, x, y, 0xd8d0f0, { bold: true, oy: 0.5, alpha: a });
      x = ix + iw;
      const bw = textWidth(stat.after, 1, true);
      texts.text(stat.after, x, y, GREEN, { bold: true, ox: 1, oy: 0.5, alpha: a });
      chevron(g, x - bw - 8, y - 3, 7, GREEN, a, 1, true);
      texts.text(stat.before, x - bw - 11, y, 0xb0a8c8, { bold: true, ox: 1, oy: 0.5, alpha: a });
    }
    // Learn, or why not
    const b = this.learnRect();
    const prev = at.j > 0 ? br.nodes[at.j - 1] : null;
    if (learned) {
      kit.button(g, texts, b, 'Learned', FACE.gold, now, { icon: 'check' });
      return;
    }
    // a node that can't be learned yet says why on its (grey) button: "Learn Keen Edge first", "No points: reach Lv 8"
    const bw = b.w - 10;
    const reason = why === 'order' && prev ? this.fitReason([`Learn ${prev.name} first`, `${prev.name} first`, `Needs ${prev.name}`, prev.name], bw) : why === 'points' ? this.noPoints(bw) : '';
    if (reason) {
      const sk = clamp01(1 - (now - this.shakeAt) / 450);
      kit.button(g, texts, b, reason, FACE.grey, now, { disabled: true, bold: false, shakeAt: this.shakeAt, labelCol: sk > 0 ? mix(0xff9a8a, WHITE, 1 - sk) : undefined });
      return;
    }
    kit.button(g, texts, b, 'Learn', FACE.green, now, { icon: 'up', glowCol: 0x8af06a, shakeAt: this.shakeAt });
  }

  private fitReason(options: string[], w: number): string {
    return options.find((o) => textWidth(o, 1, false) <= w) ?? options[0];
  }

  /** "No points: reach Lv 8" (the next level that brings one), or "No points left" at the max level. */
  private noPoints(w: number): string {
    const t = this.kit.tuning;
    const lv = levelFromXp(t, this.prog().xp);
    let next = lv + 1;
    while (next <= maxLevel(t) && skillPoints(t, next) <= skillPoints(t, lv)) next++;
    if (next > maxLevel(t)) return 'No points left';
    return this.fitReason([`No points: reach Lv ${next}`, `Points at Lv ${next}`, 'No points: level up'], w);
  }
}
