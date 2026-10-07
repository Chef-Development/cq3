// Region completion (a camp screen, also opened from the world map: camp.openProgress): the region as a card. Its map,
// hand-drawn on parchment in a wooden frame (art-region-map.ts), its three act sites joined by the road; on it, what's
// done is stamped: a flag on each cleared act's site, under each site a crown seal (its mini-boss) or a skull seal
// (the boss), a scroll seal (its bounty) and a chest seal (its hidden treasure), and three star seals for the region's
// events; what's left is an empty socket. A tap on a seal names it ("Bounties 2/3"). Beside the map: a ring with the
// region's %, and the 100% reward on a pedestal (the region chest, its gems on the plinth), glowing more as the %
// climbs: Claim when it's earned (the chest bursts open), Claimed after. The regions are tabs in the top bar (one not
// reached yet is "???" and its map a fogged sheet: its name and land are a surprise).
import type Phaser from 'phaser';
import { REGIONS, regionStart } from '../../data/regions';
import { claimRegionReward, regionCompletion, regionLog, type CompletionKey } from '../../core/completion';
import { ATLAS_THEME, ensureRegionArt, FRAME_H, FRAME_IN, FRAME_W, PEDESTAL_W, REGION_SITES } from '../art-region-map';
import { STAGE_THEMES } from '../art-ui-stage';
import { textWidth } from '../font';
import { CampKit, D, GEM_TXT, GOLD_TXT } from './camp-kit';
import { padlock } from './items';
import { button3d, glow, GOLD, hudIcon, iconSize } from './pixels';
import { clamp01, easeOut3, inRect, INK, pulse, WHITE, type Rect } from './shared';
import { FACE, isPressed, notePress } from './ui';
import { bigButton, drawStage, enterK, fillEllipse, popK, ring, spotlight, tooltip, waxSeal, type Face } from './ui-modern';

type G = Phaser.GameObjects.Graphics;

/** Each part's seal: its wax, its emblem (5 px wide, '#' = the emblem's colour) and its name on the tooltip. */
const SEALS: Record<Exclude<CompletionKey, 'acts'>, { wax: Face; mark: string[]; ink: number; name: string }> = {
  minis: { wax: [0xfff0a0, 0xf2c230, 0xd8901c, 0x9a5a14], mark: ['#.#.#', '#####', '#####'], ink: 0x6a2e08, name: 'Mini-bosses' },
  boss: { wax: [0xff9a80, 0xd03030, 0x8a1a22, 0x4a0f1a], mark: ['.###.', '#.#.#', '.###.', '.#.#.'], ink: 0xf4ecd8, name: 'Boss' },
  bounties: { wax: [0x9ad8ff, 0x3a8ae8, 0x2a5ac0, 0x1a3070], mark: ['#####', '.#..#', '#####'], ink: 0xe8f4ff, name: 'Bounties' },
  treasures: { wax: [0xb4f070, 0x4cbf44, 0x2e8a34, 0x1a5a26], mark: ['.###.', '#####', '#.#.#', '#####'], ink: 0xfff0a0, name: 'Treasures' },
  events: { wax: [0xdab0ff, 0x9a52d8, 0x6e30a8, 0x40186a], mark: ['..#..', '#####', '.###.', '#...#'], ink: 0xfff0a0, name: 'Events' },
};

/** A seal or a socket on the map: where, what it stands for, whether it's done. */
interface Mark {
  x: number;
  y: number;
  key: CompletionKey;
  done: boolean;
  i: number;
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

  constructor(private readonly kit: CampKit) {}

  open(now: number, region?: number): void {
    ensureRegionArt(this.kit.s, REGIONS.map((r) => r.id));
    this.openAt = now;
    this.regionAt = now;
    this.tip = null;
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

  /** A tab per region in the top bar, right after Back (hopping over the HTML buttons in its middle). */
  tabs(): Array<{ r: Rect; region: number; label: string }> {
    const kit = this.kit;
    const b = kit.backRect();
    const labels = REGIONS.map((def, i) => (this.reached(i) ? def.name : '???'));
    const widths = labels.map((l, i) => textWidth(l, 1, true) + 10 + (this.reached(i) ? 0 : 9));
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

  /** Every seal and socket on the map, in screen px. */
  private marks(): Mark[] {
    const r = this.region;
    const def = REGIONS[r];
    const sites = REGION_SITES[def.id];
    if (!sites || !this.reached(r)) return [];
    const p = this.kit.profile;
    const log = regionLog(p, r);
    const comp = regionCompletion(p, r);
    const cleared = comp.parts.find((x) => x.key === 'acts')!.have;
    const f = this.frame();
    const mx = f.x + FRAME_IN;
    const my = f.y + FRAME_IN;
    const out: Mark[] = [];
    const n = def.acts.length;
    sites.acts.slice(0, n).forEach(([sx, sy], a) => {
      out.push({ x: mx + sx + 9, y: my + sy - 8, key: 'acts', done: cleared > a, i: out.length });
      const last = a === n - 1;
      out.push({ x: mx + sx - 11, y: my + sy + 9, key: last ? 'boss' : 'minis', done: cleared > a, i: out.length });
      out.push({ x: mx + sx, y: my + sy + 9, key: 'bounties', done: log.bounties.includes(a), i: out.length });
      out.push({ x: mx + sx + 11, y: my + sy + 9, key: 'treasures', done: log.treasures.includes(a), i: out.length });
    });
    const ev = comp.parts.find((x) => x.key === 'events')!;
    for (let e = 0; e < ev.of; e++) out.push({ x: mx + sites.events[0] + (e - (ev.of - 1) / 2) * 12, y: my + sites.events[1], key: 'events', done: e < ev.have, i: out.length });
    return out;
  }

  /** Where the `n`th seal or socket of a part is (screen px; tests tap it), or null. */
  seal(key: CompletionKey, n = 0): { x: number; y: number } | null {
    const m = this.marks().filter((q) => q.key === key)[n];
    return m ? { x: m.x, y: m.y } : null;
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    for (const t of this.tabs())
      if (inRect(t.r, x, y, 2)) {
        notePress(t.r);
        if (this.region !== t.region) {
          this.region = t.region;
          this.regionAt = now;
          this.tip = null;
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
      const d = Math.hypot(x - m.x, y - m.y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) {
      const part = comp.parts.find((q) => q.key === best!.key)!;
      const name = best.key === 'acts' ? 'Acts' : SEALS[best.key].name;
      this.tip = { text: `${name} ${part.have}/${part.of}`, x: best.x, y: best.y - 5, at: now };
      kit.app.audio.uiClick();
    }
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
  }

  private drawTabs(g: G, now: number): void {
    const kit = this.kit;
    this.tabs().forEach((t, i) => {
      const k = popK(now, this.openAt, i, 40, 200);
      if (k <= 0) return;
      const on = t.region === this.region;
      const pr = isPressed(t.r, now) || on;
      const r = { ...t.r, y: t.r.y - Math.round((1 - k) * 6) };
      if (on) glow(g, r, 0xffd23a, 0.25 + 0.15 * pulse(now, 1200), 2);
      button3d(g, r, on ? FACE.gold : FACE.navy, pr);
      const y = r.y + r.h / 2 + (pr ? 2 : 0);
      let x = r.x + 5;
      if (!this.reached(t.region)) {
        padlock(kit.gOver, x, Math.round(y - 4), 1, 0xd8901c);
        x += 9;
      }
      kit.texts.text(t.label, x, y, on ? 0x4a2408 : this.reached(t.region) ? 0xd8d0f0 : 0x9890b8, { bold: true, oy: 0.5 });
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
    kit.imgs.at(key, f.x + FRAME_IN, f.y + FRAME_IN + dy, D.icons - 0.006, clamp01(k * 1.5) * (0.35 + 0.65 * mk));
    kit.imgs.at('rmap_frame', f.x, f.y + dy, D.icons - 0.005, clamp01(k * 1.5));
    if (!reached) {
      kit.texts.text('???', f.x + FRAME_W / 2, f.y + FRAME_H / 2 + dy, 0x6a5a6a, { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: k * mk });
      return;
    }
    if (k < 0.8) return;
    const ov = kit.gOver;
    for (const m of this.marks()) {
      const sk = popK(now, Math.max(this.regionAt, this.openAt + 200), m.i, 45, 220);
      if (sk <= 0) continue;
      if (m.key === 'acts') {
        this.drawFlag(ov, m.x, m.y + 4, m.done, now, sk);
        continue;
      }
      if (!m.done) {
        inkSocket(ov, m.x, m.y, 4, now, sk);
        continue;
      }
      const sl = SEALS[m.key];
      const rad = 4.6 * (sk < 1 ? 1 + (1 - sk) * 0.8 : 1);
      waxSeal(ov, m.x, m.y, rad, sl.wax, Math.min(1, sk * 1.5), (gg, cx, cy, a) => {
        gg.fillStyle(sl.ink, a);
        sl.mark.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && gg.fillRect(Math.round(cx - 2.5 + i), Math.round(cy - sl.mark.length / 2 + j), 1, 1)));
      });
    }
  }

  /** A flag planted on a cleared act's site (it waves), or an empty socket where it will go. */
  private drawFlag(g: G, x: number, y: number, done: boolean, now: number, k: number): void {
    if (!done) {
      inkSocket(g, x, y - 3, 4, now, k);
      return;
    }
    const rise = Math.round((1 - k) * 5);
    const top = y - 12 + rise;
    g.fillStyle(INK, k);
    g.fillRect(x - 1, top - 1, 3, 13 - rise);
    g.fillStyle(0xd09a5e, k);
    g.fillRect(x, top, 1, 12 - rise);
    // the cloth, rippling (two frames)
    const wave = Math.floor(now / 260 + x) % 2;
    const rows = wave ? ['GGGGg', 'GGGgg', 'GGgg.'] : ['GGGG.', 'GGGgg', 'GGGgg'];
    g.fillStyle(INK, k);
    g.fillRect(x + 1, top - 1, 7, 5);
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      g.fillStyle(ch === 'G' ? 0x8af06a : 0x2a9a3a, k);
      g.fillRect(x + 1 + i, top + j, 1, 1);
    }));
    g.fillStyle(0xfff0a0, k);
    g.fillRect(x, top - 1, 1, 1);
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
      const [bw, bh] = iconSize('badge_region');
      hudIcon(kit.gOver, 'badge_region', Math.round(ra.x - bw / 2), Math.round(ra.y - bh / 2 - 4), 1, k);
      texts.text('100%', ra.x, ra.y + 9, GOLD_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: k });
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
      kit.button(g, texts, b, 'Claim', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt });
      padlock(kit.gOver, b.x + 5, b.y + 4, 1, 0xd8901c);
    }
  }
}

/** A socket inked on the parchment (what's left): a faint pressed hollow and a dotted ring that breathes. */
function inkSocket(g: G, cx: number, cy: number, rad: number, now: number, a: number): void {
  fillEllipse(g, cx, cy, rad, rad, 0x8a6a44, 0.22 * a);
  const n = Math.round(rad * 6);
  const k = 0.55 + 0.3 * pulse(now, 2400, cx * 37);
  g.fillStyle(0x4a3018, k * a);
  for (let i = 0; i < n; i += 2) {
    const ang = (i / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(ang) * rad - 0.5), Math.round(cy + Math.sin(ang) * rad - 0.5), 1, 1);
  }
  g.fillStyle(0xfff4d8, 0.35 * a);
  g.fillRect(Math.round(cx + rad * 0.4), Math.round(cy + rad * 0.75), 2, 1);
}
