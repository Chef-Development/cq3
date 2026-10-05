// The tip card ("teach it slowly"): one short tip at a time, the moment a system first matters (core/tips.ts picks
// it, src/data/tips.ts has the words). A small navy panel with a gold TIP tab, one or two lines (block colours named
// in the text are lit in their colour), "Tap to continue"; the screen dims around what the tip is about, a gold ring
// pulses round it and an arrow points at it. When that can't be found (the layout moved it, it's off screen) the
// card shows on its own, centred. A tip only comes up at a safe moment (no scene, screen wipe, card, toast, panel or
// tutorial in the way, the screen settled), is marked seen (and the profile saved) the moment it shows, and goes
// with its screen. In a fight it stops the clock (App.tipUp; a pre-fight tip shows before TAP TO BEGIN). While it's
// up a tap only dismisses it (input.ts): never a bar tap, a finisher, or a press of what's under it.
import type Phaser from 'phaser';
import { tipById, type TipAnchor } from '../../data/tips';
import type { TipCue, TipMoment } from '../../core/tips';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { GOLD, NAVY, panel } from './pixels';
import { clamp01, COL, easeBack, INK, mix, pulse, WHITE, type Rect } from './shared';
import { tag, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Dir = 'up' | 'down' | 'left' | 'right';

/** Over everything but the debug panel (the screen wipe is 40, toasts and flying cards 41). */
const DEPTH = 44;
/** A tap this soon after the card comes up is swallowed but doesn't dismiss it (a tap already on its way). */
const DISMISS_MS = 350;
/** How long a screen must have been settled (nothing in the way) before a tip comes up on it (ms). */
const SETTLE: Record<string, number> = { fight: 450, map: 500, boost: 800, loot: 250, actClear: 1300, defeat: 300, shop: 600, rest: 600, event: 600, camp: 450 };
/** After a tip stops a fight, the fight waits this long before it goes on (ms; a tap starts it at once). */
const RESUME_MS = 350;
/** Words lit in their colour on the card. */
const KEYWORDS: Array<[RegExp, number]> = [
  [/\byellow\b/i, COL.yellow[1]],
  [/\bred\b/i, COL.red[1]],
  [/\bpurple\b/i, COL.purple[1]],
  [/\bgreen\b/i, COL.green[1]],
  [/Synergy!/, 0xffd23a],
];
const TEXT = 0xf0ecff;
const HINT = 'Tap to continue';

export class TipsView {
  private g: G | null = null;
  private texts: TextPool;
  /** The tip on screen (null: none), when it came up, and the screen it belongs to. */
  private cue: TipCue | null = null;
  private at = 0;
  private cueScreen = '';
  /** The screen on view, and since when nothing has been in a tip's way on it. */
  private screen = '';
  private combatN = 0;
  private lastCombat: unknown = null;
  private okSince = 0;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, DEPTH + 0.5);
  }

  build(): void {
    this.g?.destroy();
    this.g = this.s.add.graphics().setDepth(DEPTH);
  }

  /** The tip on screen, if any (tests). */
  get current(): string | null {
    return this.cue?.id ?? null;
  }

  // ------------------------------------------------------------------ when

  /** A key for the screen on view: the phase, the camp's screen, the fight. */
  private screenKey(): string {
    const run = this.s.app.run;
    if (run.combat !== this.lastCombat) {
      this.lastCombat = run.combat;
      this.combatN++;
    }
    const ph = run.phase;
    return `${ph}|${ph === 'camp' ? this.s.camp.mode : ''}|${ph === 'fight' ? this.combatN : 0}`;
  }

  /** Nothing else is in a tip's way, and the screen's own content is in. */
  private clear(now: number): boolean {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const ph = run.phase;
    if (!app.sceneReady || app.hidden || app.panelOpen || app.calibrating || app.userPaused || app.storyId) return false;
    if (s.transition.active(now) || s.overlays.unlockActive()) return false;
    const peek = s.overlays.tipPeek();
    if (peek.toast) return false;
    // a "New relic unlocked!" card still to come on this screen
    if (run.newRelics.length && (ph === 'boost' || ph === 'map' || ph === 'actClear' || ph === 'event')) return false;
    switch (ph) {
      case 'fight': {
        const c = run.combat;
        if (!c || c.result) return false;
        if (app.awaitingBegin) return !s.overlays.twinTutorial();
        // the fight is running, and no finisher show is playing out
        return app.active() && s.fighters.superFinalAt <= s.anim && s.fighters.h.state !== 'super';
      }
      case 'map':
        return !s.mapView.walking;
      case 'loot':
        return s.loot.revealDone();
      case 'actClear':
        return !!peek.clear;
      case 'defeat':
        return !!peek.defeat;
      case 'boost':
      case 'shop':
      case 'rest':
      case 'event':
      case 'camp':
        return true;
      default:
        return false;
    }
  }

  private moment(safe: boolean): TipMoment {
    const app = this.s.app;
    const sparkle = app.run.phase === 'map' && !!this.s.mapView.life.sparkleRect();
    return { run: app.run, safe, preFight: app.run.phase === 'fight' && app.awaitingBegin, campMode: this.s.camp.mode, sparkle };
  }

  // ------------------------------------------------------------------ the frame

  draw(now: number): void {
    const s = this.s;
    const app = s.app;
    const g = this.g;
    if (!g) return;
    g.clear();
    this.texts.begin();
    const key = this.screenKey();
    if (key !== this.screen) {
      this.screen = key;
      this.okSince = 0;
    }
    // the tip goes with its screen (or was put away: a new phase)
    if (this.cue && (!app.tipUp || key !== this.cueScreen)) this.hide(now, false);
    const ok = !this.cue && this.clear(now);
    if (!ok) this.okSince = 0;
    else if (!this.okSince) this.okSince = now;
    const settle = app.run.phase === 'fight' && !app.awaitingBegin ? 0 : (SETTLE[app.run.phase] ?? 500);
    const m = this.moment(ok && now - this.okSince >= settle);
    const cue = app.tips.next(m);
    if (cue && !this.cue) this.show(cue, m, now);
    if (this.cue) this.drawCard(g, now);
    this.texts.end();
  }

  private show(cue: TipCue, m: TipMoment, now: number): void {
    const app = this.s.app;
    this.cue = cue;
    this.at = now;
    this.cueScreen = this.screen;
    // seen the moment it shows: a reload never brings it back
    app.tips.shown(cue, m);
    app.saveProfile();
    app.tipUp = true;
    app.syncClock(now);
    app.audio.panelOpen();
  }

  /** A tap while the card is up: it goes (unless it only just came up). */
  tap(now: number): void {
    if (!this.cue) {
      this.s.app.tipUp = false;
      return;
    }
    if (now - this.at < DISMISS_MS) return;
    this.hide(now, true);
  }

  private hide(now: number, tapped: boolean): void {
    const app = this.s.app;
    const midFight = app.run.phase === 'fight' && !app.awaitingBegin;
    this.cue = null;
    app.tipUp = false;
    if (tapped) {
      app.audio.panelClose();
      // the fight takes a breath before it goes on
      if (midFight) app.introUntil = Math.max(app.introUntil, now + RESUME_MS);
    }
    app.syncClock(now);
  }

  // ------------------------------------------------------------------ where

  /** The rect the tip points at on this screen (null: not found; the card shows on its own). */
  private anchorRect(cue: TipCue, anchor: TipAnchor): Rect | null {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const ph = run.phase;
    const c = run.combat;
    const blockRect = (pred: (b: { id: number; kind: string }) => boolean): Rect | null => {
      if (!c || ph !== 'fight') return null;
      const b = c.blocks.filter(pred).sort((a, z) => a.pos - z.pos)[0];
      if (!b) return null;
      const w = Math.max(4, Math.round(b.width * s.bar.w));
      return { x: Math.round(s.barView.x(b.pos) - w / 2), y: s.bar.y, w, h: s.bar.h };
    };
    const kindBlock = (kind: string) => blockRect((b) => b.id === cue.block) ?? blockRect((b) => b.kind === kind) ?? (ph === 'fight' ? { ...s.bar } : null);
    const camp = () => {
      if (ph === 'map') return s.mapView.campRect();
      const peek = s.overlays.tipPeek();
      return peek.clear?.camp ?? peek.defeat?.camp ?? null;
    };
    const band = (ids: string[]) => (ph === 'camp' && s.camp.mode === 'home' ? union(s.camp.band().filter((b) => ids.includes(b.id)).map((b) => b.r)) : null);
    switch (anchor) {
      case 'none':
        return null;
      case 'bar':
        return ph === 'fight' ? { ...s.bar } : null;
      case 'yellowBlock':
        return kindBlock('yellow');
      case 'redBlock':
        return kindBlock('red');
      case 'purpleBlock':
        return kindBlock('purple');
      case 'greenBlock':
        return kindBlock('green');
      case 'meter':
        if (ph !== 'fight') return null;
        return app.settings.finisherInput === 'button' ? { ...s.button } : { x: s.meter.x - 2, y: s.meter.y - 1, w: s.meter.w + 4, h: s.meter.h + 2 };
      case 'enemy': {
        const v = s.fighters.enemies.get(cue.enemy ?? -1);
        if (!v || v.dieAt || ph !== 'fight') return null;
        const b = v.img.getBounds();
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      }
      case 'relicBelt':
        return ph === 'fight' ? (s.hud.relicBelt()?.r ?? null) : null;
      case 'mapNodes':
      case 'eliteNode': {
        if (ph !== 'map') return null;
        // the spots and their tags (what's there)
        const ids = run.choices().filter((id) => anchor === 'mapNodes' || run.map.nodes[id]?.type === 'elite');
        return union(s.mapView.nodeRects(ids.slice(0, anchor === 'eliteNode' ? 1 : ids.length)));
      }
      case 'sparkle':
        return ph === 'map' ? s.mapView.life.sparkleRect() : null;
      case 'relicCard':
      case 'synergyCard':
        if (ph !== 'boost' || cue.card === undefined) return null;
        // the card, and its "Synergy!" badge on the top edge
        return grow(s.overlays.cardRect(cue.card), 0, anchor === 'synergyCard' ? 8 : 0);
      case 'campButton':
        return camp();
      case 'skillsButton':
        return ph === 'camp' ? band(['skills']) : camp();
      case 'retryButton':
        return s.overlays.tipPeek().defeat?.retry ?? null;
      case 'campBand':
        return band(['bag', 'forge', 'skills', 'relics']);
      case 'skillsReset':
        return ph === 'camp' && s.camp.mode === 'skills' ? s.camp.skills.resetRect() : null;
      case 'heroTabs':
        return ph === 'camp' && s.camp.mode === 'heroes' ? union(s.camp.heroes.tabs().map((t) => t.r)) : null;
    }
    return null;
  }

  /** Where the card (its tabs included) may go on this screen: clear of the HUD's plates and, in a fight, of the bar. */
  private zone(): Rect {
    const s = this.s;
    const ph = s.app.run.phase;
    const x = s.L + 4;
    const w = s.R - 4 - x;
    if (ph === 'fight') {
      // an elite's or a boss's banner holds across the stage until the fight begins: the card stays under it
      const type = s.app.run.node?.type;
      const top = s.app.awaitingBegin && (type === 'elite' || type === 'boss') ? 45 : 29;
      return { x, y: top, w, h: s.splitY - 2 - top };
    }
    if (ph === 'map') return { x, y: 30, w, h: s.B - 23 - 30 };
    if (ph === 'camp' && s.camp.mode === 'home') return { x, y: 27, w, h: s.B - 23 - 27 };
    return { x, y: 20, w, h: s.B - 3 - 20 };
  }

  /** What else the card keeps off in a fight: the chips under the hero's and the enemy's plates, the relic belt. */
  private keepOut(anchor: Rect | null): Rect[] {
    const s = this.s;
    const out: Rect[] = [];
    if (s.app.run.phase === 'fight') {
      // the coin and revive chips under the hero plate; the enemy's attack (and shell) chips under its plate
      const coins = 3 + 13 + textWidth(`${s.hud.coinsShown}`, 1, true) + 4 + 18 + 2;
      out.push({ x: s.L, y: 0, w: coins, h: 41 }, { x: s.R - 42, y: 0, w: 42, h: 53 });
      const belt = s.hud.relicBelt()?.r;
      if (belt && !(anchor && overlap(belt, anchor, 0))) out.push(belt);
    }
    return out;
  }

  /**
   * Where the card goes (`r` is its whole box, tabs included): next to the anchor, above or below it first (left or
   * right when those don't fit), inside the zone, clear of the keep-outs, with room for the arrow. In a fight a tip
   * about the bar sits at the top of the stage (the fighters stay in view) and its arrow reaches down. With no
   * anchor, centred; with no room anywhere, where it covers the anchor least, without an arrow.
   */
  private place(w: number, h: number, a: Rect | null): { r: Rect; dir: Dir | null } {
    const s = this.s;
    const z = this.zone();
    const keep = this.keepOut(a);
    const centred = { r: { x: Math.round(z.x + (z.w - w) / 2), y: Math.round(z.y + (z.h - h) / 2), w, h }, dir: null };
    if (!a) return centred;
    const gap = 12;
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const clampX = (x: number) => Math.round(Math.max(z.x, Math.min(z.x + z.w - w, x)));
    const clampY = (y: number) => Math.round(Math.max(z.y, Math.min(z.y + z.h - h, y)));
    const onBar = s.app.run.phase === 'fight' && a.y >= s.splitY;
    // a tip about the bar: at the top of the stage, between the HUD's chips when it fits there, else just under them
    const gx0 = Math.max(...keep.filter((k) => k.x <= s.L).map((k) => k.x + k.w + 2), z.x);
    const gx1 = Math.min(...keep.filter((k) => k.x + k.w >= s.R).map((k) => k.x - 2), z.x + z.w) - w;
    const top = gx1 >= gx0 ? { r: { x: Math.round(Math.max(gx0, Math.min(gx1, cx - w / 2))), y: z.y, w, h }, dir: 'down' as Dir } : null;
    const above = { r: { x: clampX(cx - w / 2), y: onBar ? clampY(44) : clampY(a.y - gap - h), w, h }, dir: 'down' as Dir };
    const below = { r: { x: clampX(cx - w / 2), y: clampY(a.y + a.h + gap), w, h }, dir: 'up' as Dir };
    const left = { r: { x: clampX(a.x - gap - w), y: clampY(cy - h / 2), w, h }, dir: 'right' as Dir };
    const right = { r: { x: clampX(a.x + a.w + gap), y: clampY(cy - h / 2), w, h }, dir: 'left' as Dir };
    const low = cy > z.y + z.h / 2;
    const tries = [...(onBar && top ? [top] : []), ...(low ? [above, below] : [below, above]), ...(cx > z.x + z.w / 2 ? [left, right] : [right, left])];
    for (const t of tries) {
      if (overlap(t.r, a, 3) || keep.some((k) => overlap(t.r, k, 2))) continue;
      // the arrow needs room between the card and the anchor
      const room = t.dir === 'down' ? a.y - (t.r.y + h) : t.dir === 'up' ? t.r.y - (a.y + a.h) : t.dir === 'right' ? a.x - (t.r.x + w) : t.r.x - (a.x + a.w);
      if (room >= 7) return t;
    }
    const cover = (r: Rect) => area(r, a) * 4 + keep.reduce((n, k) => n + area(r, k), 0);
    const best = [...tries, centred].sort((p, q) => cover(p.r) - cover(q.r))[0];
    return { r: best.r, dir: null };
  }

  // ------------------------------------------------------------------ drawing

  private lines(): readonly string[] {
    const def = tipById(this.cue?.id ?? '');
    if (!def) return [];
    return this.s.app.settings.finisherInput === 'button' && def.buttonLines ? def.buttonLines : def.lines;
  }

  private drawCard(g: G, now: number): void {
    const s = this.s;
    const cue = this.cue!;
    const def = tipById(cue.id);
    if (!def) return;
    const lines = this.lines();
    const since = now - this.at;
    const fade = clamp01(since / 140);
    const tipW = textWidth('TIP', 1, true) + 10;
    const hintW = textWidth(HINT, 1, false) + 10;
    // the panel: the lines with a margin, and room for the TIP tab (top left) and the hint tab (bottom right)
    const w = Math.max(...lines.map((l) => textWidth(l, 1, false)), tipW + hintW - 4) + 16;
    const h = 12 + lines.length * 10;
    const a = this.anchorRect(cue, def.anchor);
    const box = this.place(w, h + 12, a);
    const r: Rect = { x: box.r.x, y: box.r.y + 6, w, h };
    // the dim, with a window over what the tip is about
    const hole = a ? { x: a.x - 3, y: a.y - 3, w: a.w + 6, h: a.h + 6 } : null;
    dimAround(g, hole, (s.app.run.phase === 'fight' ? 0.5 : 0.55) * fade);
    if (hole) {
      const p = pulse(now, 900);
      // a soft halo outside the window (never over what it shows), an ink line, and the pulsing gold ring
      for (let i = 4; i >= 2; i--) ring(g, { x: hole.x - i, y: hole.y - i, w: hole.w + i * 2, h: hole.h + i * 2 }, 0xffe680, (0.12 + 0.18 * p) * fade * (5 - i) * 0.5);
      ring(g, { x: hole.x - 1, y: hole.y - 1, w: hole.w + 2, h: hole.h + 2 }, INK, 0.8 * fade);
      ring(g, hole, mix(GOLD[3], WHITE, 0.45 * p), fade);
    }
    // the card pops in
    const k = easeBack(since / 220, 1.6);
    const sc = 0.82 + 0.18 * Math.min(1, k);
    const cr: Rect = { x: Math.round(r.x + (w * (1 - sc)) / 2), y: Math.round(r.y + (h * (1 - sc)) / 2), w: Math.round(w * sc), h: Math.round(h * sc) };
    if (box.dir && hole && k > 0.6) this.arrow(g, box.r, hole, box.dir, now, fade);
    panel(g, cr, { trim: 'full', alpha: fade, tones: [NAVY[5], NAVY[3], NAVY[2]] });
    if (k < 0.92) return;
    // the gold TIP tab on the top edge, the lines, and "Tap to continue" on a tab under the bottom edge
    const tr: Rect = { x: r.x + 7, y: r.y - 6, w: tipW, h: 11 };
    tag(g, tr, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]]);
    this.texts.text('TIP', tr.x + tipW / 2, tr.y + 5.5, 0x3a1e08, { bold: true, ox: 0.5, oy: 0.5 });
    lines.forEach((line, i) => this.line(line, r.x + 8, r.y + 11 + i * 10));
    const hr: Rect = { x: r.x + w - 7 - hintW, y: r.y + h - 5, w: hintW, h: 11 };
    tag(g, hr, [NAVY[6], NAVY[4], NAVY[3], NAVY[1]]);
    const live = since > DISMISS_MS;
    this.texts.text(HINT, hr.x + hintW / 2, hr.y + 5.5, 0xffd23a, { ox: 0.5, oy: 0.5, alpha: live ? 0.7 + 0.3 * pulse(now, 900) : 0.4 });
  }

  /** One line of the card, its colour words lit (each part drawn where it falls in the whole line). */
  private line(text: string, x: number, y: number): void {
    const parts: Array<{ t: string; col: number }> = [];
    let rest = text;
    while (rest.length) {
      let best: { i: number; len: number; col: number } | null = null;
      for (const [re, col] of KEYWORDS) {
        const m = re.exec(rest);
        if (m && (!best || m.index < best.i)) best = { i: m.index, len: m[0].length, col };
      }
      if (!best) {
        parts.push({ t: rest, col: TEXT });
        break;
      }
      if (best.i > 0) parts.push({ t: rest.slice(0, best.i), col: TEXT });
      parts.push({ t: rest.slice(best.i, best.i + best.len), col: best.col });
      rest = rest.slice(best.i + best.len);
    }
    let cx = x;
    for (const p of parts) {
      // a leading or trailing space has no ink: measure it as part of the text before it
      if (p.t.trim().length) this.texts.text(p.t, cx, y, p.col, { oy: 0.5 });
      cx += textWidth(p.t, 1, false) - 1;
    }
  }

  /** A gold arrow from the card to the anchor, nudging toward it. */
  private arrow(g: G, card: Rect, hole: Rect, dir: Dir, now: number, alpha: number): void {
    const bob = Math.round(Math.sin(now / 170) * 1.5 + 1.5);
    let tipX: number;
    let tipY: number;
    let len: number;
    if (dir === 'down' || dir === 'up') {
      tipX = Math.round(Math.max(card.x + 10, Math.min(card.x + card.w - 10, hole.x + hole.w / 2)));
      if (dir === 'down') {
        tipY = hole.y - 2 - (3 - bob);
        len = tipY - 4 - (card.y + card.h);
      } else {
        tipY = hole.y + hole.h + 1 + (3 - bob);
        len = card.y - (tipY + 4);
      }
    } else {
      tipY = Math.round(Math.max(card.y + 8, Math.min(card.y + card.h - 8, hole.y + hole.h / 2)));
      if (dir === 'right') {
        tipX = hole.x - 2 - (3 - bob);
        len = tipX - 4 - (card.x + card.w);
      } else {
        tipX = hole.x + hole.w + 1 + (3 - bob);
        len = card.x - (tipX + 4);
      }
    }
    len = Math.max(0, len);
    // the shape pointing down, its tip at (0, 0): the head (4 rows) and the stem behind it
    const shape: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 4; i++) shape.push([-i, -i, i * 2 + 1, 1]);
    if (len > 0) shape.push([-1, -3 - len, 3, len]);
    const put = (dx: number, dy: number, w: number, h: number, color: number, a: number) => {
      g.fillStyle(color, a);
      if (dir === 'down') g.fillRect(tipX + dx, tipY + dy, w, h);
      else if (dir === 'up') g.fillRect(tipX + dx, tipY - dy - h + 1, w, h);
      else if (dir === 'right') g.fillRect(tipX + dy, tipY + dx, h, w);
      else g.fillRect(tipX - dy - h + 1, tipY + dx, h, w);
    };
    for (const [dx, dy, w, h] of shape) put(dx - 1, dy - 1, w + 2, h + 2, INK, alpha);
    for (const [dx, dy, w, h] of shape) put(dx, dy, w, h, GOLD[3], alpha);
    // a light edge down one side
    for (let i = 1; i < 4; i++) put(-i, -i, 1, 1, GOLD[4], alpha);
    if (len > 0) put(-1, -3 - len, 1, len, GOLD[4], alpha);
  }
}

// ------------------------------------------------------------------ helpers

function union(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** r grown by dx on both sides and by dy at the top. */
function grow(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x - dx, y: r.y - dy, w: r.w + dx * 2, h: r.h + dy };
}

/** How much of b a covers (square px). */
function area(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function overlap(a: Rect, b: Rect, pad: number): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/** A 1 px outline round r (its corners cut). */
function ring(g: G, r: Rect, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.fillRect(r.x + 1, r.y, r.w - 2, 1);
  g.fillRect(r.x + 1, r.y + r.h - 1, r.w - 2, 1);
  g.fillRect(r.x, r.y + 1, 1, r.h - 2);
  g.fillRect(r.x + r.w - 1, r.y + 1, 1, r.h - 2);
}

/** The screen dimmed, except a window (rounded by a step at its corners). */
function dimAround(g: G, hole: Rect | null, alpha: number): void {
  const W = GAME_W + 2;
  const H = GAME_H + 2;
  g.fillStyle(INK, alpha);
  if (!hole) {
    g.fillRect(-1, -1, W, H);
    return;
  }
  const x0 = Math.max(-1, hole.x);
  const x1 = Math.min(W, hole.x + hole.w);
  g.fillRect(-1, -1, W, hole.y + 1);
  g.fillRect(-1, hole.y + hole.h, W, H - hole.y - hole.h);
  g.fillRect(-1, hole.y, x0 + 1, hole.h);
  g.fillRect(x1, hole.y, W - x1, hole.h);
  // the window's corners
  for (const [cx, cy] of [
    [hole.x, hole.y],
    [hole.x + hole.w - 1, hole.y],
    [hole.x, hole.y + hole.h - 1],
    [hole.x + hole.w - 1, hole.y + hole.h - 1],
  ])
    g.fillRect(cx, cy, 1, 1);
}
