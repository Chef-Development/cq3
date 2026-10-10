// Region completion (a camp screen, also opened from the world map: camp.openProgress): the region as a card. Its map,
// hand-drawn on parchment in a wooden frame (art-region-map.ts), its three act sites joined by the road; the map is
// bigger than the frame and pans (a press that moves more than DRAG_PX is a drag, as on the world map; one let go in
// place is a tap), gold chevrons on the frame showing where there's more. On it, one mark per thing the tracker counts
// (core/completion.ts regionCompletion's items; where each sits: region-sites.ts regionMarks): under each act's site a
// row of four (a flag seal for the act, a crown seal for its mini-boss or a skull seal for the boss, a scroll seal for
// its bounty, a chest seal for its hidden treasure), and three star seals for the region's events. Done: the wax seal;
// still to do: an inked socket with the seal's emblem ghosted in it. All fifteen are in view when the card opens. A tap
// on one names it ("Bounties 2/3"). Beside the map: a ring with the region's % and N/15, and the 100% reward on a
// pedestal (the region chest, its gems on the plinth), glowing more as the % climbs: Claim when it's earned (the chest
// bursts open), Claimed after. Every count comes from the same regionCompletion. The regions are tabs in the top bar
// (one not reached yet is "???" and its map a fogged sheet: its name and land are a surprise).
import type Phaser from 'phaser';
import { REGIONS, regionStart } from '../../data/regions';
import { claimRegionReward, regionCompletion, regionLog, type CompletionKey } from '../../core/completion';
import { ATLAS_THEME, ensureRegionArt, FRAME_H, FRAME_IN, FRAME_W, PEDESTAL_W } from '../art-region-map';
import { clampCamera, OPENING_CAMERA, REGION_MAP_H, REGION_MAP_W, REGION_VIEW_H, REGION_VIEW_W, regionMarks, SEAL_R, type RegionMark } from '../region-sites';
import { STAGE_THEMES } from '../art-ui-stage';
import { textWidth } from '../font';
import { CampKit, D, GEM_TXT, GOLD_TXT } from './camp-kit';
import { padlock } from './items';
import { button3d, glow, GOLD, hudIcon, iconSize } from './pixels';
import { clamp01, easeOut3, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress } from './ui';
import { bigButton, drawStage, enterK, fillEllipse, popK, ring, Sheet, spotlight, tooltip, waxSeal, type Face, type SheetLine } from './ui-modern';
import { ATLAS_PAGES } from '../../data/atlas-pages';
import { whole } from '../../core/format';

type G = Phaser.GameObjects.Graphics;

/** Each part's seal: its wax, its emblem (5 px wide, '#' = the emblem's colour) and its name on the tooltip. */
const SEALS: Record<CompletionKey, { wax: Face; mark: string[]; ink: number; name: string }> = {
  acts: { wax: [0xb8f4e8, 0x3ac0a8, 0x228a7a, 0x10504a], mark: ['#....', '####.', '###..', '#....'], ink: 0xfff4d8, name: 'Acts' },
  minis: { wax: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14], mark: ['#.#.#', '#####', '#####'], ink: 0x6a2e08, name: 'Mini-bosses' },
  boss: { wax: [0xff9a80, 0xd03030, 0x8a1a22, 0x4a0f1a], mark: ['.###.', '#.#.#', '.###.', '.#.#.'], ink: 0xf4ecd8, name: 'Boss' },
  bounties: { wax: [0x9ad8ff, 0x3a8ae8, 0x2a5ac0, 0x1a3070], mark: ['#####', '.#..#', '#####'], ink: 0xe8f4ff, name: 'Bounties' },
  treasures: { wax: [0xb4f070, 0x4cbf44, 0x2e8a34, 0x1a5a26], mark: ['.###.', '#####', '#.#.#', '#####'], ink: 0xfff0a0, name: 'Treasures' },
  events: { wax: [0xdab0ff, 0x9a52d8, 0x6e30a8, 0x40186a], mark: ['..#..', '#####', '.###.', '#...#'], ink: 0xfff0a0, name: 'Events' },
};

/** A press that moves more than this (game px) is a drag: it pans the map (as on the world map, view/world.ts). */
const DRAG_PX = 4;

/** The open region tab's face: dark antique brass (light lettering on it; the bright gold face put dark gold on
 *  mustard, the top bar's lowest contrast). */
const TAB_ON: Face = [0xb08a4c, 0x7a5624, 0x5e401a, 0x3a240c];

/** A seal or a socket on the screen: what it stands for, whether it's done, where (screen px), its place in the list,
 *  and how much of it shows (it fades out at the frame's edge as the map pans). */
interface Mark extends RegionMark {
  i: number;
  vis: number;
}

/** Each region's emblem on its tab (7 x 6, '#' = the tab's ink): a tree, a snowcapped peak, a smoking cone, a moon over
 *  water, a sun on a spire. The open tab shows the emblem and the region's full name; the others the emblem alone (four
 *  names never fit a phone's top bar, and "Green" / "Frost" read as colours, not places). */
const EMBLEM: Record<string, string[]> = {
  greenmarch: ['..###..', '.#####.', '#######', '.#####.', '...#...', '...#...'],
  frostpeaks: ['...#...', '..###..', '.##.##.', '.#####.', '#######', '#######'],
  ashfell: ['...##..', '..#....', '..###..', '.##.##.', '#######', '#######'],
  duskmire: ['..###..', '.##....', '.##....', '..###..', '.......', '#.#.#.#'],
  noonspire: ['#.#.#..', '.###...', '#####..', '.###.#.', '#.#.###', '....###'],
};

/** A tab's emblem at (x, y) top-left, with an ink shadow under it. */
function emblem(g: G, id: string, x: number, y: number, col: number, a: number): void {
  const rows = EMBLEM[id];
  if (!rows) return;
  for (const [dy, c, k] of [
    [1, INK, 0.8],
    [0, col, 1],
  ] as const) {
    g.fillStyle(c, a * k);
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && g.fillRect(x + i, y + j + dy, 1, 1)));
  }
}

export class ProgressScreen {
  region = 0;
  /** It draws its own stage (the camp skips its dim behind it). */
  readonly staged = true;
  private openAt = 0;
  private regionAt = 0;
  private claimAt = -1e9;
  private shakeAt = -1e9;
  private tip: { text: string; x: number; y: number; at: number } | null = null;
  /** The region's Atlas pages found, read from a treasure seal (src/data/atlas-pages.ts; profile.pages). */
  private readonly sheet = new Sheet();
  /** The camera on the map (map px at the window's top-left), and a press on the map (it may become a drag). */
  private cam: { x: number; y: number } = { ...OPENING_CAMERA };
  private press: { x: number; y: number; cx: number; cy: number; drag: boolean } | null = null;

  constructor(private readonly kit: CampKit) {}

  open(now: number, region?: number): void {
    ensureRegionArt(this.kit.s, REGIONS.map((r) => r.id));
    this.openAt = now;
    this.regionAt = now;
    this.tip = null;
    this.sheet.close(now - 1000);
    this.press = null;
    this.cam = { ...OPENING_CAMERA };
    this.region = Math.max(0, Math.min(REGIONS.length - 1, region ?? this.current()));
  }

  /** The region the player is in now (the furthest reached). */
  current(): number {
    const p = this.kit.profile;
    let r = 0;
    for (let i = 0; i < REGIONS.length; i++) if (p.actsCleared >= regionStart(i)) r = i;
    return r;
  }

  /** Whether region `r` has been reached (its name can show). */
  reached(r: number): boolean {
    return this.kit.profile.actsCleared >= regionStart(r);
  }

  // ------------------------------------------------------------------ layout

  /** A tab per region in the top bar, right after Back (hopping over the HTML buttons in its middle): the open one its
   *  emblem and full name, the others their emblem alone (a padlock for one not reached). */
  tabs(): Array<{ r: Rect; region: number; label: string }> {
    const kit = this.kit;
    const b = kit.backRect();
    const labels = REGIONS.map((def, i) => (!this.reached(i) ? '???' : def.name));
    const widths = REGIONS.map((_, i) => (i === this.region && this.reached(i) ? textWidth(labels[i], 1, true) + 21 : 16));
    const rs = kit.topRow(widths, b.x + b.w + 4, kit.s.R - 3) ?? kit.topRow(widths, b.x + b.w + 4, 1e9)!;
    return labels.map((label, i) => ({ r: rs[i], region: i, label }));
  }

  /** The right column: the ring, the pedestal, the button. */
  private side(): Rect {
    const s = this.kit.s;
    return { x: s.R - 75, y: 19, w: 72, h: s.B - 19 };
  }

  /** The frame's top-left (the map sits FRAME_IN inside it), centred in the room left of the side column. */
  private frame(): { x: number; y: number } {
    const s = this.kit.s;
    const x0 = s.L + 2;
    const x1 = this.side().x - 2;
    const y0 = 19;
    const y1 = s.B - 1;
    return { x: Math.round(x0 + Math.max(0, (x1 - x0 - FRAME_W) / 2)), y: Math.round(y0 + Math.max(0, (y1 - y0 - FRAME_H) / 2)) };
  }

  private ringAt(): { x: number; y: number; r: number } {
    const sd = this.side();
    return { x: sd.x + sd.w / 2, y: sd.y + 26, r: 24 };
  }

  /** The pedestal's top surface (where the chest stands), centre x. */
  private pedestalAt(): { x: number; y: number } {
    const sd = this.side();
    return { x: Math.round(sd.x + sd.w / 2), y: this.kit.s.B - 39 };
  }

  claimRect(): Rect {
    const sd = this.side();
    return { x: sd.x + 3, y: this.kit.s.B - 19, w: sd.w - 6, h: 17 };
  }

  /** The window the frame shows of the map (screen px). */
  mapRect(): Rect {
    const f = this.frame();
    return { x: f.x + FRAME_IN, y: f.y + FRAME_IN, w: REGION_VIEW_W, h: REGION_VIEW_H };
  }

  /** Every seal and socket on the map (one per item regionCompletion counts), in screen px. */
  private marks(): Mark[] {
    const r = this.region;
    if (!this.reached(r)) return [];
    const win = this.mapRect();
    const comp = regionCompletion(this.kit.profile, r);
    return regionMarks(REGIONS[r].id, comp.items).map((m, i) => {
      const x = win.x + m.x - this.cam.x;
      const y = win.y + m.y - this.cam.y;
      // fully shown a seal's width in from the frame's edge, gone at the edge
      const edge = Math.min(x - win.x, win.x + win.w - x, y - win.y, win.y + win.h - y);
      return { ...m, x, y, i, vis: clamp01((edge - SEAL_R + 1) / 4) };
    });
  }

  /** The marks as drawn (tests: one per counted item; `vis` > 0 when in view). */
  markList(): Array<{ key: CompletionKey; n: number; done: boolean; x: number; y: number; vis: number }> {
    return this.marks().map(({ key, n, done, x, y, vis }) => ({ key, n, done, x, y, vis }));
  }

  /** Where the `n`th seal or socket of a part is (screen px; tests tap it), or null. */
  seal(key: CompletionKey, n = 0): { x: number; y: number } | null {
    const m = this.marks().filter((q) => q.key === key)[n];
    return m ? { x: m.x, y: m.y } : null;
  }

  /** The camera on the map (map px at the window's top-left), for tests. */
  camera(): { x: number; y: number } {
    return { ...this.cam };
  }

  /** What the seal tapped last says ("Bounties 2/3"; null: none up), for tests. */
  tipText(): string | null {
    return this.tip?.text ?? null;
  }

  // ------------------------------------------------------------------ the map pans (tap vs drag, like the world map)

  /** A press: on the map it's held (a drag pans it; let go in place, it's a tap). Returns whether it's taken. */
  pressAt(x: number, y: number, _now: number): boolean {
    if (!this.reached(this.region) || !inRect(this.mapRect(), x, y)) return false;
    this.press = { x, y, cx: this.cam.x, cy: this.cam.y, drag: false };
    return true;
  }

  /** The finger moves: past DRAG_PX it's a drag, and the map follows it (kept within its edges). */
  dragTo(x: number, y: number, _now: number): void {
    const p = this.press;
    if (!p) return;
    if (!p.drag) {
      if (Math.hypot(x - p.x, y - p.y) <= DRAG_PX) return;
      // a drag from here on, starting where the finger is now (no jump)
      p.drag = true;
      p.x = x;
      p.y = y;
      p.cx = this.cam.x;
      p.cy = this.cam.y;
      this.tip = null;
    }
    this.cam = clampCamera(p.cx - (x - p.x), p.cy - (y - p.y));
  }

  /** The finger lifts: true when it was a tap (the camp then taps there as usual). */
  releaseAt(_x: number, _y: number, _now: number): boolean {
    const p = this.press;
    this.press = null;
    return !!p && !p.drag;
  }

  cancelPress(): void {
    this.press = null;
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    // the Atlas pages open: a tap anywhere closes them
    if (this.sheet.open) return void this.sheet.tap(now);
    for (const t of this.tabs())
      if (inRect(t.r, x, y, 2)) {
        notePress(t.r);
        if (this.region !== t.region) {
          this.region = t.region;
          this.regionAt = now;
          this.tip = null;
          this.cam = { ...OPENING_CAMERA };
          kit.app.audio.uiClick();
        }
        return;
      }
    const p = kit.profile;
    const comp = regionCompletion(p, this.region);
    const cr = this.claimRect();
    if (this.reached(this.region) && inRect(cr, x, y, 2)) {
      notePress(cr);
      if (regionLog(p, this.region).chest) return kit.app.audio.uiClick();
      if (!comp.done) {
        this.shakeAt = now;
        kit.app.audio.lockToggle();
        kit.fx.float('Reach 100%', cr.x + cr.w / 2, cr.y - 6, 0xffd890, { life: 1200 });
        return;
      }
      return this.claim(now);
    }
    // a seal: name it and its count
    let best: Mark | null = null;
    let bd = 8;
    for (const m of this.marks()) {
      if (m.vis <= 0.3) continue;
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) {
      const part = comp.parts.find((q) => q.key === best!.key)!;
      const name = SEALS[best.key].name;
      this.tip = { text: `${name} ${part.have}/${part.of}`, x: best.x, y: best.y - 5, at: now };
      kit.app.audio.uiClick();
      // a treasure seal reads the Atlas page found in that act's hidden treasure
      if (best.key === 'treasures') this.showPage(now, best.n);
    }
  }

  /** The Atlas page found in act `n`'s hidden treasure (n: the act in this region), in a sheet; not found yet: nothing
   *  opens (the seal's tip has its count). */
  private showPage(now: number, n: number): void {
    const act = regionStart(this.region) + n;
    const pg = ATLAS_PAGES.find((x) => x.act === act);
    if (!pg || !this.kit.profile.pages.includes(act)) return;
    const lines: SheetLine[] = [{ text: `Act ${whole(act + 1)}`, bold: true, col: 0xffe8a0 }, ...pg.lines.map((text) => ({ text, col: 0xf0e8ff }))];
    this.tip = null;
    this.sheet.show(pg.title, lines, now);
  }

  /** The 100% reward: the chest bursts open, gems and a region chest. */
  private claim(now: number): void {
    const kit = this.kit;
    if (!claimRegionReward(kit.profile, kit.tuning, this.region)) return;
    kit.commit();
    this.claimAt = now;
    kit.app.audio.shopBuy();
    kit.after(160, () => kit.app.audio.rareSting(true));
    const pd = this.pedestalAt();
    const cy = pd.y - 16;
    kit.fx.flash({ x: pd.x - 20, y: cy - 18, w: 40, h: 36 }, WHITE, 300);
    kit.fx.burst(pd.x, cy, [0xfff0a0, 0xffd23a, WHITE, 0xb06ae0, 0xdab0ff], 44, 1.3, { kind: 'star', g: 40, life: 1000 });
    kit.fx.burst(pd.x, cy, [0xf6c8ff, 0xd070ff], 16, 1, { kind: 'chip', g: 90, life: 800, up: 40 });
    kit.fx.ring(pd.x, cy, 34, 0xfff0a0, 520);
    kit.after(120, () => kit.fx.ring(pd.x, cy, 22, 0xdab0ff, 420));
    kit.fx.float('Region chest!', pd.x, cy - 26, 0xdab0ff, { life: 1800 });
    kit.fx.float(`+${Math.round(kit.tuning.gems.region)}`, pd.x, cy - 14, GEM_TXT, { icon: 'gem', life: 1800, delay: 300 });
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    const ek = enterK(now, this.openAt, 0, 0, 240);
    drawStage(kit, ATLAS_THEME, now, { alpha: ek, motes: true });
    this.drawTabs(g, now);
    this.drawMap(now);
    this.drawSide(g, now);
    kit.drawBack(g, now);
    if (this.tip) {
      const s = kit.s;
      tooltip(kit.layer(true), this.tip.text, this.tip.x, this.tip.y, now, this.tip.at, s.L + 2, s.R - 2);
    }
    const s = kit.s;
    this.sheet.draw(kit, { x: s.L + 10, y: 20, w: s.R - s.L - 20, h: s.B - 23 }, now);
  }

  private drawTabs(g: G, now: number): void {
    const kit = this.kit;
    this.tabs().forEach((t, i) => {
      const k = popK(now, this.openAt, i, 40, 200);
      if (k <= 0) return;
      const on = t.region === this.region;
      const pr = isPressed(t.r, now) || on;
      const r = { ...t.r, y: t.r.y - Math.round((1 - k) * 6) };
      if (on) glow(g, r, 0xd8a040, 0.18 + 0.1 * pulse(now, 1200), 2);
      // the open tab a dark brass plate with light lettering; the others ink
      button3d(g, r, on ? TAB_ON : FACE.navy, pr);
      const y = r.y + r.h / 2 + (pr ? 2 : 0);
      const reached = this.reached(t.region);
      if (!reached) {
        padlock(kit.gOver, Math.round(r.x + r.w / 2 - 3), Math.round(y - 4), 1, 0xb88a3a);
        return;
      }
      const col = on ? 0xffe8b0 : 0xb8b0d0;
      const ex = on ? r.x + 5 : Math.round(r.x + (r.w - 7) / 2);
      emblem(kit.gOver, REGIONS[t.region].id, ex, Math.round(y - 3), col, k);
      if (on) kit.texts.text(t.label, ex + 10, y, 0xfff0d0, { bold: true, oy: 0.5 });
    });
  }

  /** The framed map, the flags and seals stamped on it (a fogged sheet with "???" for a region not reached). */
  private drawMap(now: number): void {
    const kit = this.kit;
    const r = this.region;
    const reached = this.reached(r);
    const f = this.frame();
    const k = popK(now, this.openAt, 1, 40, 300);
    const mk = enterK(now, this.regionAt, 0, 0, 220);
    const dy = Math.round((1 - k) * 14);
    const key = reached && kit.has(`rmap_${REGIONS[r].id}`) ? `rmap_${REGIONS[r].id}` : 'rmap_fog';
    // a shadow on the wall, the map (it fades in when the tab changes), the frame
    const g = kit.gUi;
    const fl = 0.9 + 0.1 * pulse(now, 1700) + 0.04 * Math.sin(now / 113);
    fillEllipse(g, f.x + FRAME_W / 2, f.y + FRAME_H / 2, FRAME_W * 0.72, FRAME_H * 0.85, 0xffc070, 0.05 * k * fl);
    fillEllipse(g, f.x + FRAME_W / 2, f.y + FRAME_H / 2, FRAME_W * 0.6, FRAME_H * 0.7, 0xffc070, 0.05 * k * fl);
    g.fillStyle(INK, 0.45 * k);
    g.fillRect(f.x + 2, f.y + 4 + dy, FRAME_W, FRAME_H);
    // the window on the map: the camera's view of it (the map is bigger than the frame)
    const win = this.mapRect();
    kit.sprites.draw(key, win.x, win.y + dy, D.icons - 0.006, { crop: [this.cam.x, this.cam.y, REGION_VIEW_W, REGION_VIEW_H], alpha: clamp01(k * 1.5) * (0.35 + 0.65 * mk) });
    kit.imgs.at('rmap_frame', f.x, f.y + dy, D.icons - 0.005, clamp01(k * 1.5));
    if (!reached) {
      kit.texts.text('???', f.x + FRAME_W / 2, f.y + FRAME_H / 2 + dy, 0x6a5a6a, { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: k * mk });
      return;
    }
    if (k < 0.8) return;
    const ov = kit.gOver;
    vignetteIn(ov, { ...win, y: win.y + dy }, k);
    for (const m of this.marks()) {
      const sk = popK(now, Math.max(this.regionAt, this.openAt + 200), m.i, 45, 220);
      if (sk <= 0 || m.vis <= 0) continue;
      const sl = SEALS[m.key];
      const stamp = (gg: G, cx: number, cy: number, col: number, a: number) => {
        gg.fillStyle(col, a);
        sl.mark.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && gg.fillRect(Math.round(cx - 2.5 + i), Math.round(cy - sl.mark.length / 2 + j), 1, 1)));
      };
      if (!m.done) {
        inkSocket(ov, m.x, m.y, SEAL_R - 0.5, now, sk * m.vis, (cx, cy, a) => stamp(ov, cx, cy, 0xa08458, a));
        continue;
      }
      const rad = (SEAL_R - 0.4) * (sk < 1 ? 1 + (1 - sk) * 0.8 : 1);
      // the emblem pressed into the wax: its shadow in the wax's deepest tone, then the emblem (two tones: it reads)
      waxSeal(ov, m.x, m.y, rad, sl.wax, Math.min(1, sk * 1.5) * m.vis, (gg, cx, cy, a) => {
        stamp(gg, cx, cy + 1, sl.wax[3], a);
        stamp(gg, cx, cy, sl.ink, a);
      });
    }
    this.drawChevrons(ov, f, dy, now, k);
  }

  /** Gold chevrons on the frame where the map goes on past the window (pulsing; gone at that edge). */
  private drawChevrons(g: G, f: { x: number; y: number }, dy: number, now: number, k: number): void {
    const maxX = REGION_MAP_W - REGION_VIEW_W;
    const maxY = REGION_MAP_H - REGION_VIEW_H;
    const a = (0.6 + 0.4 * pulse(now, 1100)) * k;
    const cx = Math.round(f.x + FRAME_W / 2);
    const cy = Math.round(f.y + FRAME_H / 2 + dy);
    // a thick arrowhead pointing right (3 x 5), turned for each edge; inked under, gold with a lit tip
    const RIGHT = ['X..', 'XX.', '.XX', 'XX.', 'X..'];
    const chevron = (x0: number, y0: number, dir: 'l' | 'r' | 'u' | 'd') => {
      const cells: Array<[number, number]> = [];
      RIGHT.forEach((row, j) =>
        [...row].forEach((ch, i) => {
          if (ch !== 'X') return;
          const ii = i - 1;
          const jj = j - 2;
          cells.push(dir === 'r' ? [ii, jj] : dir === 'l' ? [-ii, jj] : dir === 'd' ? [jj, ii] : [jj, -ii]);
        }),
      );
      g.fillStyle(INK, a * 0.85);
      for (const [i, j] of cells) g.fillRect(x0 + i - 1, y0 + j - 1, 3, 3);
      g.fillStyle(0xffd23a, a);
      for (const [i, j] of cells) g.fillRect(x0 + i, y0 + j, 1, 1);
      g.fillStyle(0xfff4c0, a);
      const tip = dir === 'r' ? [1, 0] : dir === 'l' ? [-1, 0] : dir === 'd' ? [0, 1] : [0, -1];
      g.fillRect(x0 + tip[0], y0 + tip[1], 1, 1);
    };
    const mid = Math.floor(FRAME_IN / 2);
    if (this.cam.x > 0) chevron(f.x + mid, cy, 'l');
    if (this.cam.x < maxX) chevron(f.x + FRAME_W - 1 - mid, cy, 'r');
    if (this.cam.y > 0) chevron(cx, f.y + mid + dy, 'u');
    if (this.cam.y < maxY) chevron(cx, f.y + FRAME_H - 1 - mid + dy, 'd');
  }

  /** The ring with the %, and the 100% reward on its pedestal; Claim / Claimed under it. */
  private drawSide(g: G, now: number): void {
    const kit = this.kit;
    const p = kit.profile;
    const texts = kit.texts;
    const r = this.region;
    const reached = this.reached(r);
    const comp = regionCompletion(p, r);
    const log = regionLog(p, r);
    const k = popK(now, this.openAt, 2, 40, 280);
    if (k <= 0) return;
    const ra = this.ringAt();
    const ck = easeOut3((now - Math.max(this.regionAt, this.openAt + 120)) / 800);
    const frac = reached ? (comp.pct / 100) * ck : 0;
    const done = reached && comp.done;
    const theme = STAGE_THEMES[ATLAS_THEME];
    // the ring: a soft disc behind, the meter, the % in the middle (counting up)
    fillEllipse(g, ra.x, ra.y, ra.r + 3, ra.r + 3, INK, 0.35 * k);
    if (done) fillEllipse(g, ra.x, ra.y, ra.r + 6, ra.r + 6, 0xffd23a, (0.12 + 0.1 * pulse(now, 1200)) * k);
    ring(g, ra.x, ra.y, ra.r, frac, { th: 5, alpha: k, ramp: done ? [GOLD[4], GOLD[3], GOLD[2], GOLD[1]] : undefined });
    fillEllipse(g, ra.x, ra.y, ra.r - 6, ra.r - 6, 0x1a1226, 0.85 * k);
    if (!reached) texts.text('?', ra.x, ra.y, 0x9890b8, { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: k });
    else if (done) {
      // the badge, 100%, and the count (the same N/15 as before it was done: every count agrees)
      const [bw] = iconSize('badge_region');
      hudIcon(kit.gOver, 'badge_region', Math.round(ra.x - bw / 2), Math.round(ra.y - 15), 1, k);
      texts.text('100%', ra.x, ra.y + 3, GOLD_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
      texts.text(`${comp.have}/${comp.of}`, ra.x, ra.y + 11, 0xe8d8a0, { ox: 0.5, oy: 0.5, alpha: k });
    } else {
      const pct = `${Math.round(comp.pct * ck)}`;
      const nw = textWidth(pct, 2, true);
      const pw = textWidth('%', 1, true);
      const x0 = Math.round(ra.x - (nw + pw) / 2);
      texts.text(pct, x0, ra.y - 2, WHITE, { bold: true, scale: 2, oy: 0.5, alpha: k });
      texts.text('%', x0 + nw, ra.y + 1, 0xd8d0f0, { bold: true, oy: 0.5, alpha: k });
      texts.text(`${comp.have}/${comp.of}`, ra.x, ra.y + 11, 0xb8b0d8, { ox: 0.5, oy: 0.5, alpha: k });
    }
    // the pedestal under a light, the chest on it glowing as the % climbs (open once claimed)
    const pd = this.pedestalAt();
    const pk = popK(now, this.openAt, 4, 40, 300);
    if (pk <= 0) return;
    const glowK = reached ? 0.25 + 0.75 * (comp.pct / 100) * ck : 0.1;
    spotlight(g, pd.x, ra.y + ra.r + 2, pd.y + 2, 14, 40, theme.light, 0.06 * pk, 0.9 + 0.1 * pulse(now, 1300));
    const cy = pd.y - 16;
    for (const [rx, a] of [
      [30, 0.12],
      [22, 0.18],
      [14, 0.24],
    ] as const)
      fillEllipse(g, pd.x, cy, rx * (0.7 + 0.3 * glowK), rx * (0.7 + 0.3 * glowK), 0xb06ae0, a * glowK * pk * (0.85 + 0.15 * pulse(now, 1400)));
    if (done && !log.chest) {
      // rays turning slowly behind a chest that's ready
      const rays = 8;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2 + now / 2200;
        for (let d = 10; d < 26; d += 2) {
          g.fillStyle(0xfff0a0, (0.22 * (1 - (d - 10) / 16) + 0.05) * pk);
          g.fillRect(Math.round(pd.x + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d), 2, 2);
        }
      }
    }
    // motes rising off it, more as the % climbs
    const nm = Math.round(2 + 8 * glowK);
    for (let i = 0; i < nm; i++) {
      const per = 1600 + ((i * 337) % 900);
      const t = ((now + i * 431) % per) / per;
      const x = pd.x + Math.sin(i * 2.1 + now / 900) * 12;
      const y = cy + 6 - t * 30;
      g.fillStyle(i % 2 ? 0xdab0ff : 0xfff0a0, Math.sin(t * Math.PI) * 0.8 * pk * glowK);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    kit.imgs.at('rmap_pedestal', pd.x - PEDESTAL_W / 2, pd.y - 3 + Math.round((1 - pk) * 8), D.icons - 0.004, pk);
    const ckey = log.chest ? 'hchest_region_open' : 'hchest_region_closed';
    if (kit.has(ckey)) {
      const sh = done && !log.chest ? Math.round(Math.sin(now / 60) * (Math.floor(now / 1400) % 3 === 0 ? 1 : 0)) : 0;
      const bob = done && !log.chest ? -Math.round(Math.abs(Math.sin(now / 500)) * 2) : 0;
      kit.imgs.foot(ckey, pd.x + sh, pd.y + 1 + bob + Math.round((1 - pk) * 12), D.icons - 0.003, pk, reached ? undefined : 0x3a3048);
    }
    // the gems on the plinth's face
    if (reached) {
      const gems = `+${Math.round(kit.tuning.gems.region)}`;
      const gw = textWidth(gems, 1, false) + 10;
      texts.text(gems, pd.x - gw / 2, pd.y + 9, log.chest ? 0x9890b8 : GEM_TXT, { oy: 0.5, alpha: pk });
      hudIcon(kit.gOver, 'gem', Math.round(pd.x - gw / 2 + textWidth(gems, 1, false) + 1), pd.y + 5, 1, pk * (log.chest ? 0.5 : 1));
    }
    // Claim (gold, glowing, when earned), Claimed after, padlocked before
    if (!reached) return;
    const cr = this.claimRect();
    const bk = popK(now, this.openAt, 5, 40, 240);
    const b = { ...cr, y: cr.y + Math.round((1 - bk) * 10) };
    if (log.chest) {
      kit.button(g, texts, b, 'Claimed', FACE.green, now, { icon: 'check', disabled: false });
      const ck2 = now - this.claimAt;
      if (ck2 < 1500 && pulse(now, 300) > 0.5) {
        g.fillStyle(WHITE, 1 - ck2 / 1500);
        g.fillRect(b.x + b.w - 6, b.y - 2, 1, 5);
        g.fillRect(b.x + b.w - 8, b.y, 5, 1);
      }
    } else if (done) bigButton(kit, g, texts, b, 'Claim', FACE.gold, now);
    else {
      kit.button(g, texts, b, 'At 100%', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
    }
  }
}

/** A socket inked on the parchment (what's still to do): a dark pressed hole with a solid ink ring that breathes, and
 *  the seal's emblem ghosted pale in it (so an empty one still says what goes there, and reads as a hole, not a
 *  tan smudge on tan paper). */
function inkSocket(g: G, cx: number, cy: number, rad: number, now: number, a: number, emblem: (cx: number, cy: number, a: number) => void): void {
  fillEllipse(g, cx, cy, rad, rad, 0x1e120a, 0.62 * a);
  fillEllipse(g, cx + 0.5, cy + 0.5, rad - 1.5, rad - 1.5, 0x2e1c10, 0.5 * a);
  const n = Math.round(rad * 8);
  const k = 0.75 + 0.25 * pulse(now, 2400, cx * 37);
  g.fillStyle(0x120a06, k * a);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(ang) * rad - 0.5), Math.round(cy + Math.sin(ang) * rad - 0.5), 1, 1);
  }
  emblem(cx, cy, 0.7 * a);
  // the paper's lit lip on the hole's lower right
  g.fillStyle(0xc8a874, 0.45 * a);
  g.fillRect(Math.round(cx + rad * 0.3), Math.round(cy + rad + 0.5), 3, 1);
}

/** The frame's window darkened toward its edges and corners (stepped bands), so the eye stays on the middle and the
 *  seals; drawn over the map, under the seals. */
function vignetteIn(g: G, r: Rect, k: number): void {
  const bands: Array<[number, number]> = [
    [0, 0.26],
    [2, 0.18],
    [5, 0.11],
    [9, 0.06],
  ];
  for (const [d, a] of bands) {
    g.fillStyle(0x140a04, a * k);
    const bw = d === 0 ? 2 : d === 2 ? 3 : d === 5 ? 4 : 5;
    g.fillRect(r.x + d, r.y + d, r.w - d * 2, bw);
    g.fillRect(r.x + d, r.y + r.h - d - bw, r.w - d * 2, bw);
    g.fillRect(r.x + d, r.y + d + bw, bw, r.h - (d + bw) * 2);
    g.fillRect(r.x + r.w - d - bw, r.y + d + bw, bw, r.h - (d + bw) * 2);
  }
  // the corners a step deeper
  g.fillStyle(0x140a04, 0.16 * k);
  for (const [x, y] of [
    [r.x, r.y],
    [r.x + r.w - 10, r.y],
    [r.x, r.y + r.h - 10],
    [r.x + r.w - 10, r.y + r.h - 10],
  ])
    g.fillRect(x, y, 10, 10);
}
