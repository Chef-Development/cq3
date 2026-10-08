// The Test lab's "Sharper chest reveal" (src/data/lab.ts, setup screen 'chestHd'): the old reveal and the sharper
// one (chest-hd.ts) compared. It opens side by side (the split view: the old reveal centred in the left half, the new
// one in the right half, the same chest playing in sync: one opening drawn twice), with big buttons over the top bar:
// Old / New / Both (the full-size reveal, or both) and Replay (this chest again from its slam). A demo: five chests,
// Rare to Divine, a hero chest, a Rare chest and a region chest, a companion, heroes and a hero's shards; nothing is
// granted. When the five are done it starts over (no summary), so a reveal is always there to compare.
// The buttons are drawn on the fine layer (chest-hd.ts) so they show over both reveals; their taps come first
// (ChestScreen.tap -> ChestOpening.tapExtra).
import { COMPANIONS, COMPANION_IDS } from '../../data/companions';
import { HEROES, HERO_IDS } from '../../data/heroes';
import { TIERS, tierIndex, type Tier } from '../../data/rarity';
import type { ChestKind } from '../../core/profile';
import { shardsToNext } from '../../core/roster';
import { hdTag, mixRgb, type Face4 } from '../art-reveal-hd';
import { hdText, hdTextW } from '../font-hd';
import type { HdLayerRect } from '../hd-layer';
import type { CampKit } from './camp-kit';
import type { ChestOpening, OpenedChest, RevealView } from './chest-opening';
import { inRect, type Rect } from './shared';
import { isPressed, notePress } from './ui';

type Ctx = CanvasRenderingContext2D;

/** The demo's chests: [tier, chest kind, what comes out]. */
const DEMO: Array<[Tier, ChestKind, 'pet' | 'hero' | 'shards']> = [
  ['rare', 'hero', 'pet'],
  ['epic', 'rare', 'hero'],
  ['legendary', 'hero', 'shards'],
  ['mythic', 'region', 'pet'],
  ['divine', 'region', 'hero'],
];

/** The demo's chests as openings (made up: nothing rolled or granted). A hero or companion of the tier when there is
 *  one, else the closest below, shown at the forced tier. */
export function compareItems(kit: CampKit): OpenedChest[] {
  return DEMO.map(([tier, kind, what], i): OpenedChest => {
    const ti = tierIndex(tier);
    const pick = <T extends string>(ids: T[], tierOf: (id: T) => Tier): T => {
      for (let k = ti; k >= 0; k--) {
        const at = ids.filter((id) => tierOf(id) === TIERS[k]);
        if (at.length) return at[i % at.length];
      }
      return ids[0];
    };
    const heroes = HERO_IDS.filter((id) => HEROES[id].joins === 'chest');
    if (what === 'pet') {
      const id = pick(COMPANION_IDS.filter((c) => c !== 'pip'), (c) => COMPANIONS[c].rarity);
      return { kind, prize: { kind: 'pet', id, tier, fresh: true, shards: 0, starsUp: 0 }, before: { stars: 1, shards: 0 }, after: { stars: 1, shards: 0 }, demo: true };
    }
    const id = pick(heroes, (h) => HEROES[h].rarity);
    if (what === 'hero') return { kind, prize: { kind: 'hero', id, tier, fresh: true, shards: 0, starsUp: 0 }, before: { stars: 1, shards: 0 }, after: { stars: 1, shards: 0 }, demo: true };
    // shards: ten, enough for a star (2 -> 3), the bar filling then starting over
    const need = shardsToNext(kit.tuning, 2) ?? 20;
    const before = { stars: 2, shards: Math.max(0, need - 6) };
    return { kind, prize: { kind: 'heroShards', id, tier, shards: 10, starsUp: 1 }, before, after: { stars: 3, shards: before.shards + 10 - need }, demo: true };
  });
}

interface Btn {
  id: RevealView | 'replay';
  label: string;
  r: Rect;
}

const GOLD_FACE: Face4 = [0xfff0a8, 0xffd866, 0xd08c24, 0x6e3c12];
const SLATE_FACE: Face4 = [0x8a80a8, 0x4a4266, 0x342e4c, 0x1c182c];
const GREEN_FACE: Face4 = [0xc8ffb0, 0x8af06a, 0x3a9a2a, 0x1e5a16];

export class ChestCompare {
  private on = false;

  constructor(
    private readonly kit: CampKit,
    private readonly op: ChestOpening,
  ) {}

  get active(): boolean {
    return this.on;
  }

  /** Start comparing: side by side, the demo playing (and starting over when it's done). */
  start(now: number): void {
    this.on = true;
    this.op.view = 'split';
    this.op.extra = this;
    this.play(now);
  }

  /** Stop: the reveal goes back to the setting's, the buttons go. */
  end(): void {
    if (!this.on) return;
    this.on = false;
    this.op.extra = null;
    this.op.resetView();
  }

  private play(now: number): void {
    if (!this.on) return;
    this.op.playDemo(compareItems(this.kit), now, () => {
      if (this.on) this.kit.after(1, () => this.play(performance.now()));
    });
  }

  /** The buttons (game px): Old / New / Both at the top left, Replay at the top right. */
  buttons(): Btn[] {
    const s = this.kit.s;
    const h = 16;
    const y = 3;
    const out: Btn[] = [];
    let x = s.L + 4;
    for (const [id, label] of [
      ['old', 'Old'],
      ['hd', 'New'],
      ['split', 'Both'],
    ] as const) {
      const w = Math.max(30, Math.ceil(hdTextW(label) / 2) + 12);
      out.push({ id, label, r: { x, y, w, h } });
      x += w + 3;
    }
    const rw = Math.ceil(hdTextW('Replay') / 2) + 14;
    out.push({ id: 'replay', label: 'Replay', r: { x: s.R - 4 - rw, y, w: rw, h } });
    return out;
  }

  /** A tap: on a button, it's taken. */
  tap(x: number, y: number, now: number): boolean {
    for (const b of this.buttons()) {
      if (!inRect(b.r, x, y, 2)) continue;
      notePress(b.r);
      this.kit.app.audio.lockToggle();
      if (b.id === 'replay') {
        if (!this.op.replay(now)) this.play(now);
      } else this.op.view = b.id;
      return true;
    }
    return false;
  }

  /** The buttons and, side by side, the divider and its two labels (on the fine layer). */
  draw(ctx: Ctx, r: HdLayerRect, now: number): void {
    const F = r.k;
    const s = this.kit.s;
    if (this.op.view === 'split' && this.op.splitShown) {
      const mid = Math.round(((s.L + s.R) / 2) * F);
      // the divider: a lit line between two ink ones
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#140c1c';
      ctx.fillRect(mid - 2, 0, 4, r.h);
      ctx.fillStyle = '#c8bce0';
      ctx.fillRect(mid - 1, 0, 2, r.h);
      ctx.globalAlpha = 1;
      for (const [label, right] of [
        ['Old', true],
        ['New', false],
      ] as const) {
        const t = hdText(label, { color: 0xfff0c0 });
        const w = t.w + 12;
        const x = right ? mid - 6 - w : mid + 6;
        const y = 21 * F;
        ctx.drawImage(hdTag(w, 22, right ? SLATE_FACE : GREEN_FACE), x - 1, y - 1);
        ctx.drawImage(right ? t.canvas : hdText(label, { color: 0x1e3a14, plain: true }).canvas, Math.round(x + (w - t.w) / 2) + (right ? 0 : 1), y + 4 + (right ? 0 : 1));
      }
    }
    for (const b of this.buttons()) {
      const sel = b.id === this.op.view;
      const pressed = isPressed(b.r, now);
      const x = Math.round(b.r.x * F);
      const y = Math.round(b.r.y * F) + (pressed ? 2 : 0);
      const w = Math.round(b.r.w * F);
      const h = Math.round(b.r.h * F);
      const face = b.id === 'replay' ? GREEN_FACE : sel ? GOLD_FACE : SLATE_FACE;
      if (sel) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(now / 300);
        ctx.fillStyle = '#ffd866';
        ctx.fillRect(x - 3, y - 2, w + 6, h + 4);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(hdTag(w, h, face), x - 1, y - 1);
      const dark = b.id === 'replay' || sel;
      const t = hdText(b.label, dark ? { color: mixRgb(face[3], 0x000000, 0.3), plain: true } : { color: 0xf0e8ff });
      ctx.drawImage(t.canvas, Math.round(x + (w - t.w) / 2), Math.round(y + (h - t.cap) / 2 - t.capTop));
    }
  }
}
