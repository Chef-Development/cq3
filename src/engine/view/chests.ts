// The chests (a camp screen: tap the chests waiting by the tent): a torch-lit vault (the 'vault' stage, art-chests.ts)
// with the three kinds standing big on its floor, one in each alcove: the hero chest (bosses and bounties), the Rare
// chest (the shrine) and the region chest (a region at 100%). A kind with chests waiting glows in its colour under a
// light from above, light leaks from its seams now and then, and a gold badge counts them; a kind with none stands
// open, empty, dark and dusty (a tap says where they come from). Tap a waiting chest to open one (opening is free);
// "Open all" when more than one waits opens them one after another and sums up what came out.
//
// The opening itself (the slam, the build-up through the rarity colours, the burst, the reveal) is
// view/chest-opening.ts, shared with the shrine. Tests: chests.reseed(n) (a known prize), chests.openKind(kind, now),
// chests.revealing; the Test lab: chests.demo(tiers, kind, now) (a forced tier, nothing granted).
import type { Tier } from '../../data/rarity';
import { CHEST_KINDS, type ChestKind } from '../../core/profile';
import { BIG_CHEST, VAULT_SLOT_DX, VAULT_TORCHES } from '../art-chests';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT } from './camp-kit';
import { ChestCompare } from './chest-compare';
import { chestOpening, FxImages, type ChestOpening } from './chest-opening';
import { star } from './loot';
import { clamp01, inRect, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress, RIBBON } from './ui';
import { bigButton, countBadge, drawStage, enterK, fillEllipse, popK, spotlight, stageDisc, vignette } from './ui-modern';

type Face = readonly [number, number, number, number];

export const CHEST_NAME: Record<ChestKind, string> = { hero: 'Hero chest', rare: 'Rare chest', region: 'Region chest' };
/** Where each kind comes from (said when one with none waiting is tapped). */
const CHEST_FROM: Record<ChestKind, string> = { hero: 'From bosses and bounties', rare: 'Buy one at the shrine', region: 'A region at 100%' };
/** Each kind's short name under it, and its light. */
const CHEST_LABEL: Record<ChestKind, string> = { hero: 'Hero', rare: 'Rare', region: 'Region' };
export const CHEST_FACE: Record<ChestKind, Face> = {
  hero: [0xffe680, 0xf2b630, 0xc8841c, 0x8a4e14],
  rare: [0x9ad8ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a],
  region: [0xe0b0ff, 0xb06ae0, 0x7a3cb0, 0x4a2470],
};

export class ChestScreen {
  private openAt = 0;
  private shakeAt: Partial<Record<ChestKind, number>> = {};
  /** When each kind's count last changed (its badge pops). */
  private countAt: Partial<Record<ChestKind, number>> = {};
  private lastCount: Partial<Record<ChestKind, number>> = {};
  private fx: FxImages;
  readonly opening: ChestOpening;
  private cmp: ChestCompare | null = null;

  constructor(private readonly kit: CampKit) {
    this.opening = chestOpening(kit);
    this.fx = new FxImages(kit.s);
  }

  /** The layout rebuilt the textures: the images go with them. */
  build(): void {
    this.opening.build();
    this.fx.destroy();
    this.fx = new FxImages(this.kit.s);
  }

  open(now: number): void {
    this.openAt = now;
    this.lastCount = { ...this.kit.profile.chests };
  }

  /** Reseed what the chests hold (tests: a known prize). */
  reseed(seed: number): void {
    this.opening.reseed(seed);
  }

  /** An opening is playing (the camp keeps quiet). */
  get revealing(): boolean {
    return this.opening.active;
  }

  // ------------------------------------------------------------------ layout

  /** The chests' floor line. */
  private floorY(): number {
    return this.kit.s.B - 40;
  }

  /** Kind i's place: where its chest stands (bottom centre), and its tap area (`open`: the chest and its label). */
  slot(i: number): { x: number; y: number; open: Rect } {
    const s = this.kit.s;
    const x = Math.round((s.L + s.R) / 2) + (i - 1) * VAULT_SLOT_DX;
    const y = this.floorY();
    return { x, y, open: { x: x - 30, y: y - BIG_CHEST.h - 4, w: 60, h: BIG_CHEST.h + 16 } };
  }

  /** "Open all" (when more than one chest waits). */
  allRect(): Rect {
    const s = this.kit.s;
    const w = textWidth('Open all', 1, true) + 34;
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: s.B - 21, w, h: 18 };
  }

  private waiting(): number {
    const c = this.kit.profile.chests;
    return c.hero + c.rare + c.region;
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (this.opening.tapExtra(x, y, now)) return;
    if (this.opening.active) return this.opening.tap(now);
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    if (this.waiting() > 1 && inRect(this.allRect(), x, y, 2)) {
      notePress(this.allRect());
      this.openAll(now);
      return;
    }
    CHEST_KINDS.forEach((kind, i) => {
      const sl = this.slot(i);
      if (!inRect(sl.open, x, y)) return;
      notePress(sl.open);
      this.openKind(kind, now);
    });
  }

  /** Open a waiting chest of `kind` (free): the opening plays. A kind with none shakes and says where they come from. */
  openKind(kind: ChestKind, now: number): boolean {
    const kit = this.kit;
    if (kit.profile.chests[kind] <= 0) {
      this.shakeAt[kind] = now;
      kit.app.audio.lockToggle();
      const sl = this.slot(CHEST_KINDS.indexOf(kind));
      kit.fx.float(CHEST_FROM[kind], sl.x, sl.y - BIG_CHEST.h - 6, 0xd8d0f0, { life: 1500 });
      return false;
    }
    return this.opening.open([kind], now) > 0;
  }

  /** Open every waiting chest, one after another, then sum up. */
  openAll(now: number): number {
    const p = this.kit.profile;
    const kinds: ChestKind[] = [];
    for (const k of CHEST_KINDS) for (let i = 0; i < p.chests[k]; i++) kinds.push(k);
    return this.opening.open(kinds, now);
  }

  /** The Test lab's demo: the opening at forced tiers, nothing rolled or granted (ChestOpening.demo). */
  demo(tiers: Tier | Tier[], kind: ChestKind = 'rare', now = performance.now()): void {
    this.opening.demo(tiers, kind, now);
  }

  /** The Test lab's "Sharper chest reveal": the old reveal and the new one side by side (chest-compare.ts). */
  compare(now = performance.now()): ChestCompare {
    this.cmp ??= new ChestCompare(this.kit, this.opening);
    this.cmp.start(now);
    return this.cmp;
  }

  endCompare(): void {
    this.cmp?.end();
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gUi;
    // the vault covers the camp: the camp's dim isn't needed under it
    g.clear();
    this.fx.begin();
    const a = enterK(now, this.openAt, 0, 0, 220);
    drawStage(kit, 'vault', now, { alpha: a, vignette: 0 });
    this.drawTorches(now, a);
    const p = kit.profile;
    CHEST_KINDS.forEach((kind, i) => {
      const n = p.chests[kind];
      if (this.lastCount[kind] !== undefined && this.lastCount[kind] !== n) this.countAt[kind] = now;
      this.lastCount[kind] = n;
      this.drawChest(kind, i, now);
    });
    vignette(g, s, a);
    // the top bar: Back, the title, the gems
    kit.drawBack(g, now);
    kit.title(g, 'Chests', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.purple);
    kit.gemsTag(g, kit.texts, s.R - 3, 4, now);
    // Open all, or a word on what to do
    const w = this.waiting();
    const bk = enterK(now, this.openAt, 4, 60, 260);
    if (w > 1) {
      const r = this.allRect();
      bigButton(kit, g, kit.texts, { ...r, y: r.y + Math.round((1 - bk) * 10) }, 'Open all', FACE.gold, now, { icon: 'chest', alpha: bk });
    } else
      // (once one has been opened, the vault isn't new: none are waiting, not "none yet")
      kit.texts.text(w === 1 ? 'Tap the chest!' : (kit.profile.counts.chests ?? 0) > 0 ? 'No chests waiting' : 'No chests yet', Math.round((s.L + s.R) / 2), s.B - 11, w === 1 ? 0xfff0c0 : DIM_TXT, {
        bold: true,
        ox: 0.5,
        oy: 0.5,
        alpha: bk * (w === 1 ? 0.65 + 0.35 * pulse(now, 900) : 0.8),
      });
    this.opening.draw(now);
    this.fx.end();
  }

  /** The torches on the side pillars: their flames, their warm light on the wall and the floor. */
  private drawTorches(now: number, a: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    VAULT_TORCHES.forEach((t, i) => {
      const fl = 0.85 + 0.15 * Math.sin(now / 83 + i * 2) + 0.08 * Math.sin(now / 37 + i);
      fillEllipse(g, t.x, t.y - 4, 26 * fl, 22 * fl, 0xff9a40, 0.06 * a);
      fillEllipse(g, t.x, t.y - 4, 14 * fl, 12 * fl, 0xffc060, 0.08 * a);
      fillEllipse(g, t.x, this.floorY() + 6, 30, 5, 0xffa040, 0.06 * a * fl);
      const f = [0, 1, 2, 1, 3, 2, 0, 3][Math.floor((now + i * 170) / 95) % 8];
      kit.imgs.at(`vault_flame${f}`, t.x - 3, t.y - 12, D.icons, a);
      // a spark now and then
      const sp = ((now + i * 700) % 1400) / 1400;
      if (sp < 0.5) {
        g.fillStyle(0xffd080, (1 - sp * 2) * a);
        g.fillRect(Math.round(t.x + Math.sin(now / 200 + i) * 3), Math.round(t.y - 12 - sp * 24), 1, 1);
      }
    });
  }

  /** One kind's chest on its dais: lit and glowing with a count badge when some wait, open and dusty when none. */
  private drawChest(kind: ChestKind, i: number, now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const go = kit.gOver;
    const texts = kit.texts;
    const sl = this.slot(i);
    const n = kit.profile.chests[kind];
    const have = n > 0;
    const face = CHEST_FACE[kind];
    const ik = popK(now, this.openAt, i + 1, 70, 320);
    if (ik <= 0) return;
    const fade = clamp01(ik * 1.5);
    const x = sl.x;
    const y = sl.y;
    // light from above onto its dais (bright when one waits, a dim grey wash when none)
    const flick = 0.92 + 0.08 * pulse(now, 1300, i * 400);
    spotlight(g, x, -4, y, 16, 58, have ? face[0] : 0x8a80a0, (have ? 0.075 : 0.03) * fade, flick);
    stageDisc(g, x, y, 27, have ? [mix(face[2], 0x8a7a92, 0.5), 0x3a3048, 0x241c30] : [0x5a5068, 0x2e2638, 0x1c1624], fade);
    if (have) {
      // its glow: a soft aura in its colour and motes rising
      const br = 0.8 + 0.2 * pulse(now, 1400, i * 300);
      fillEllipse(g, x, y - 22, 34 * br, 26 * br, face[3], 0.16 * fade);
      fillEllipse(g, x, y - 22, 26 * br, 20 * br, face[1], 0.12 * fade);
      fillEllipse(g, x, y - 22, 16 * br, 13 * br, face[0], 0.1 * fade);
      for (let k = 0; k < 7; k++) {
        const per = 1900 + ((k * 431) % 1300);
        const q = ((now + k * 613 + i * 250) % per) / per;
        g.fillStyle(k % 2 ? face[0] : WHITE, Math.sin(q * Math.PI) * 0.8 * fade);
        g.fillRect(Math.round(x + Math.sin(k * 2.3 + now / 1500) * 22), Math.round(y - 6 - q * 52), 1, k % 3 === 0 ? 2 : 1);
      }
    }
    // the chest: drops in, bobs when waiting, sinks when pressed, rattles when refused, peeks (lid lifts, light
    // spills) now and then
    const drop = Math.round((1 - Math.min(1, ik)) * -14);
    const pressed = isPressed(sl.open, now);
    const sh = now - (this.shakeAt[kind] ?? -1e9);
    const dx = sh < 320 ? Math.round(Math.sin(sh / 20) * 2 * (1 - sh / 320)) : 0;
    const bob = have ? Math.round(Math.sin(now / 520 + i * 1.7) * 1) : 0;
    const cy = y + 2 + drop + (pressed ? 1 : 0) - Math.max(0, bob);
    const cx = x + dx;
    const key = `hchest_${kind}_big`;
    if (have) {
      const per = 3200;
      const ph = (now + i * 1070) % per;
      const peek = ph < 360 ? Math.sin((ph / 360) * Math.PI) : 0;
      const lift = Math.round(peek * 2);
      this.fx.get(`${key}_base`, cx, cy, D.icons, { ox: 0.5, oy: 1, alpha: fade });
      this.fx.get(`${key}_gap`, cx, cy, D.icons + 0.001, { ox: 0.5, oy: 1, tint: face[0], add: true, alpha: (0.5 + 0.5 * peek) * fade });
      this.fx.get(`${key}_lid`, cx, cy - lift, D.icons + 0.002, { ox: 0.5, oy: 1, alpha: fade });
      const la = (0.25 + 0.55 * peek + 0.1 * pulse(now, 900, i * 200)) * fade;
      this.fx.get(`${key}_leakB0`, cx, cy, D.icons + 0.003, { ox: 0.5, oy: 1, tint: face[0], add: true, alpha: la });
      this.fx.get(`${key}_leakL0`, cx, cy - lift, D.icons + 0.003, { ox: 0.5, oy: 1, tint: face[0], add: true, alpha: la });
      if (pressed) this.fx.get(key, cx, cy, D.icons + 0.004, { ox: 0.5, oy: 1, tint: WHITE, fill: true, add: true, alpha: 0.35 });
      // a glint across its top now and then
      if (pulse(now, 1700, i * 500) > 0.88) star(go, cx + 14 - i * 5, cy - BIG_CHEST.h + 14, 1, WHITE, fade);
      countBadge(go, texts, cx + 22, cy - BIG_CHEST.h + 12, `${n}`, now, { alpha: fade, popAt: this.countAt[kind] });
    } else {
      // open, empty, dark: dust and a cobweb
      this.fx.get(`${key}_open`, cx, cy, D.icons, { ox: 0.5, oy: 1, tint: 0x6e6680, alpha: fade });
      const wx = cx - 22;
      const wy = cy - 33;
      go.fillStyle(0xc8c0d8, 0.28 * fade);
      for (let k = 0; k < 6; k++) go.fillRect(wx + k, wy + k, 1, 1);
      for (let k = 0; k < 7; k++) go.fillRect(wx + k, wy, 1, 1);
      for (let k = 0; k < 7; k++) go.fillRect(wx, wy + k, 1, 1);
      for (const [px, py] of [
        [wx + 3, wy + 1],
        [wx + 1, wy + 3],
        [wx + 5, wy + 2],
        [wx + 2, wy + 5],
      ])
        go.fillRect(px, py, 1, 1);
      for (let k = 0; k < 4; k++) {
        const per = 5200 + k * 900;
        const q = ((now + k * 1300 + i * 600) % per) / per;
        go.fillStyle(0xb0a8c0, Math.sin(q * Math.PI) * 0.5 * fade);
        go.fillRect(Math.round(cx - 18 + k * 11 + Math.sin(now / 900 + k) * 3), Math.round(cy - 6 - q * 30), 1, 1);
      }
    }
    // its name under it
    const la = clamp01((ik - 0.6) * 2.5);
    texts.text(CHEST_LABEL[kind], x, y + 10, have ? mix(face[0], WHITE, 0.3) : DIM_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: la });
  }

  /** Off the camp: the images hide. */
  hide(): void {
    this.fx.begin();
    this.fx.end();
    this.opening.hide();
  }
}

/** The best kind of chest waiting (the camp shows that one), or null. */
export function bestWaiting(p: { chests: Record<ChestKind, number> }): ChestKind | null {
  return (['region', 'rare', 'hero'] as ChestKind[]).find((k) => p.chests[k] > 0) ?? null;
}
