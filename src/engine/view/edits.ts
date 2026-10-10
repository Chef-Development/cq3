// The Mapmaker's Edits (a camp screen, once a region is restored; also from the world map's act picker): the
// hardships a player can draw into the next act they start (data/edits.ts; core/run.ts applies them). The Atlas
// study's stage behind; down the left, one iron-and-ink plate per Edit (an empty socket round its glyph, or an
// oxblood wax seal stamped with it once drawn in), its name and what it does; a tap draws it in or rubs it out. The
// focal on the right is the ledger: a big seal with how many are drawn in, what the next act pays for them (more XP,
// gems the first time an act is cleared under each) and the seals won so far. Off by default; they stay on (every
// act started) until rubbed out.
import type Phaser from 'phaser';
import { ALL_ACTS, REGIONS } from '../../data/regions';
import { EDITS, type EditDef, type EditId } from '../../data/edits';
import { pct, whole } from '../../core/format';
import { ATLAS_THEME, ensureRegionArt } from '../art-region-map';
import { textWidth } from '../font';
import { CampKit, DIM_TXT, GEM_TXT, GOLD_TXT, pix, pixSize } from './camp-kit';
import { wrapText } from './items';
import { drawStage, enterK, glass, popK, socket, waxSeal, type Face } from './ui-modern';
import { clamp01, inRect, mix, pulse, WHITE, type Rect } from './shared';
import { isPressed, notePress } from './ui';

type G = Phaser.GameObjects.Graphics;

/** Oxblood wax and ink (L8: deep and a little dry, not candy red). */
const OXBLOOD: Face = [0xc88070, 0x8a3430, 0x642428, 0x3a1218];
const INK_RED = 0xb04634;

export class EditsScreen {
  /** It paints its own stage (no dim over the camp). */
  readonly staged = true;
  private openAt = 0;
  /** When each Edit was last drawn in or rubbed out (its seal stamps, its stroke animates). */
  private flipAt = new Map<EditId, number>();

  constructor(private readonly kit: CampKit) {}

  open(now: number): void {
    ensureRegionArt(this.kit.s, REGIONS.map((r) => r.id));
    this.openAt = now;
    this.flipAt.clear();
  }

  // ------------------------------------------------------------------ layout

  /** Edit i's plate. */
  row(i: number): Rect {
    const s = this.kit.s;
    return { x: s.L + 5, y: 21 + i * 25, w: 174, h: 22 };
  }

  /** The ledger on the right (the focal). */
  private pane(): Rect {
    const s = this.kit.s;
    const r0 = this.row(0);
    const x = r0.x + r0.w + 7;
    return { x, y: 21, w: s.R - 5 - x, h: 25 * EDITS.length - 3 };
  }

  private on(id: EditId): boolean {
    return this.kit.profile.edits.on.includes(id);
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    EDITS.forEach((e, i) => {
      const r = this.row(i);
      if (!inRect(r, x, y, 1)) return;
      notePress(r);
      this.toggle(e.id, now);
    });
  }

  /** Draw an Edit in, or rub it out (kept in the profile: every act started from now on). */
  toggle(id: EditId, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const was = p.edits.on.includes(id);
    p.edits.on = was ? p.edits.on.filter((x) => x !== id) : [...p.edits.on, id];
    kit.app.saveProfile();
    this.flipAt.set(id, now);
    kit.app.audio.uiClick();
    if (was) return;
    // the seal is pressed: a thud, flecks of wax
    const r = this.row(EDITS.findIndex((e) => e.id === id));
    const sx = r.x + 12;
    const sy = r.y + r.h / 2;
    kit.after(90, () => {
      kit.app.audio.statUp(2);
      kit.fx.burst(sx, sy, [OXBLOOD[1], OXBLOOD[0], 0x2a0a0c], 10, 0.7, { kind: 'chip', g: 80, life: 420 });
      kit.fx.ring(sx, sy, 11, OXBLOOD[0], 260);
    });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const ek = enterK(now, this.openAt, 0, 0, 240);
    drawStage(kit, ATLAS_THEME, now, { alpha: ek, motes: true, dim: 0.2 });
    kit.drawBack(g, now);
    // the title, short enough to stay clear of the top bar's middle (the gear button)
    const z = kit.hudZone();
    const tx = kit.backRect().x + kit.backRect().w + 4;
    const fits = (t: string) => tx + textWidth(t, 1, true) + 26 < z.x - 2;
    const title = ["The Mapmaker's Edits", "Mapmaker's Edits"].find(fits) ?? 'Edits';
    kit.title(g, title, tx, 4, OXBLOOD);
    EDITS.forEach((e, i) => this.drawRow(g, e, i, now));
    this.drawPane(g, now);
  }

  private drawRow(g: G, e: EditDef, i: number, now: number): void {
    const kit = this.kit;
    const T = kit.texts;
    const ck = enterK(now, this.openAt, i, 45, 260);
    if (ck <= 0) return;
    const a = clamp01(ck * 1.5);
    const r0 = this.row(i);
    const pr = isPressed(r0, now) ? 1 : 0; // (also a plate the keyboard's focus ring can land on)
    const r: Rect = { ...r0, x: r0.x - Math.round((1 - ck) * 16), y: r0.y + pr };
    const on = this.on(e.id);
    // iron and ink: a dark plate; drawn in, an oxblood rim and a warm tint
    glass(g, r, { alpha: a, rim: on ? OXBLOOD[1] : undefined, tint: on ? 0x26100f : 0x0f0d16, clear: 0.12 });
    // the seal at the left: an empty socket round the glyph, or the oxblood seal stamped with it
    const sx = r.x + 12;
    const sy = r.y + r.h / 2;
    const [iw, ih] = pixSize(e.icon);
    const at = this.flipAt.get(e.id) ?? -1e9;
    if (on) {
      // stamped: it comes down from a little bigger
      const rad = 8 + Math.round((1 - Math.min(1, popK(now, at, 0, 0, 200))) * 4);
      waxSeal(g, sx, sy, rad, OXBLOOD, a);
      pix(g, e.icon, Math.round(sx - iw / 2), Math.round(sy - ih / 2), a);
    } else {
      socket(g, sx, sy, 8, now, a, 0x8a7a6a);
      pix(g, e.icon, Math.round(sx - iw / 2), Math.round(sy - ih / 2), 0.55 * a);
    }
    // its name and what it does
    const tx = r.x + 25;
    T.text(e.name, tx, r.y + 7, on ? 0xffd8c8 : 0xe8e0f0, { bold: true, oy: 0.5, alpha: a });
    T.text(e.line, tx, r.y + 16, on ? 0xe0bcb0 : DIM_TXT, { oy: 0.5, alpha: a });
    // how hard: one or two notches of red ink at the right end
    for (let k = 0; k < e.weight; k++) {
      const nx = r.x + r.w - 8 - k * 5;
      g.fillStyle(0x000000, 0.5 * a);
      g.fillRect(nx, r.y + 4, 3, 5);
      g.fillStyle(on ? INK_RED : 0x4a4050, a);
      g.fillRect(nx, r.y + 4, 3, 4);
    }
    // the stroke under the words: drawn across as it goes in, wiped as it comes out
    const fk = clamp01((now - at) / 200);
    if (fk < 1) {
      g.fillStyle(INK_RED, 0.85 * a);
      g.fillRect(tx, r.y + r.h - 3, Math.round((r.w - 30) * (on ? fk : 1 - fk)), 1);
    }
  }

  /** The ledger: how many are drawn in (a big seal), what the next act pays, the seals won so far. */
  private drawPane(g: G, now: number): void {
    const kit = this.kit;
    const T = kit.texts;
    const p = kit.profile;
    const E = kit.app.run.tuning.edits;
    const a = clamp01(enterK(now, this.openAt, 3, 60, 260) * 1.5);
    if (a <= 0) return;
    const r = this.pane();
    glass(g, r, { alpha: a, tint: 0x100c14, clear: 0.1 });
    const cx = Math.round(r.x + r.w / 2);
    const tw = r.w - 10;
    const on = p.edits.on;
    const weight = on.reduce((n, id) => n + (EDITS.find((e) => e.id === id)?.weight ?? 0), 0);
    T.text('The next act', cx, r.y + 7, GOLD_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    // the big seal: the count drawn in, stamped again whenever it changes
    const sy = r.y + 28;
    if (on.length) {
      const last = Math.max(-1e9, ...this.flipAt.values());
      const rad = 12 + Math.round((1 - Math.min(1, popK(now, last, 0, 0, 240))) * 3);
      waxSeal(g, cx, sy, rad, OXBLOOD, a);
      T.text(whole(on.length), cx, sy, 0xffe8dc, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    } else {
      socket(g, cx, sy, 12, now, a, 0x8a7a6a);
    }
    let y = sy + 20;
    const lines = (s: string) => {
      for (const l of wrapText(s, tw)) {
        T.text(l, cx, y, DIM_TXT, { ox: 0.5, oy: 0.5, alpha: a });
        y += 8;
      }
    };
    if (weight) {
      // what it pays: XP from every fight and the clear, gems the first time each act is cleared under each Edit
      const lit = 0.8 + 0.2 * pulse(now, 1100);
      const xp = `XP +${pct(Math.max(0, E.xpPer) * weight)}`;
      T.text(xp, cx, y, mix(0xb4f070, WHITE, 1 - lit), { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      y += 11;
      const gems = `+${whole(Math.max(0, E.gemsPer) * weight)}`;
      const gi = pixSize('gem')[0] + 2;
      const gx = Math.round(cx - (gi + textWidth(gems, 1, true)) / 2);
      pix(g, 'gem', gx, y - 4, a);
      T.text(gems, gx + gi, y, GEM_TXT, { bold: true, oy: 0.5, alpha: a });
      y += 10;
      lines('when an act is first cleared under them');
    } else {
      lines('As drawn. Tap an Edit: harder acts pay more.');
    }
    // the foot: the seals won (one per Edit an act was cleared under)
    const seals = Object.values(p.edits.cleared).reduce((n, ids) => n + ids.length, 0);
    const fy = r.y + r.h - 8;
    g.fillStyle(0x000000, 0.3 * a);
    g.fillRect(r.x + 4, fy - 6, r.w - 8, 1);
    const txt = `${whole(seals)}/${whole(ALL_ACTS.length * EDITS.length)}`;
    const lw = textWidth('Seals', 1, false);
    const x0 = Math.round(cx - (lw + 4 + textWidth(txt, 1, true)) / 2);
    T.text('Seals', x0, fy, DIM_TXT, { oy: 0.5, alpha: a });
    T.text(txt, x0 + lw + 4, fy, seals ? GOLD_TXT : DIM_TXT, { bold: true, oy: 0.5, alpha: a });
  }
}
