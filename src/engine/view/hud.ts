// The HUD: hero plate (the fighting hero's portrait and level, the HP bar; under it the coins and a potion lit while a
// revive is left), the relic belt under that (up to five icons, then "+N"; one pulses when it kicks in; a tap opens
// the relic panel), enemy plate (badge, HP, name), the act and foe counters, the combo counter, the finisher strip
// under the bar (meter, banked stacks with Overcharge's countdown, speed) and button, and the coins that fly into
// the coin chip. The fight shows only what you act on: the hero's other stats live in the camp. A stat that went up
// since the last fight (a boost, new gear) gets one line under the plate as the fight starts: the biggest gain.
// Panels are dark navy with a light bevel and an ink outline (see pixels.ts panel); everything slides in with a
// little overshoot when a fight starts.
import Phaser from 'phaser';
import { heroStats, type Combat } from '../../core/combat';
import { fmtStatShort, type StatBlock } from '../../core/gear';
import { STAT_IDS, STAT_INFO, type StatId } from '../../data/gear';
import type { RelicId } from '../../data/relics';
import { relicNumber } from '../../core/relics';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { band, button3d, chevron, gauge, gem, glow, GOLD, hudIcon, iconSize, NAVY, panel, RAMP, rows } from './pixels';
import { FOE_ICONS } from './icons';
import { clamp01, ease, easeBack, ENEMY_COL, inRect, INK, mix, pulse, rand, shade, stackCol, WHITE, type Rect } from './shared';
import { ImagePool, ribbon, tag, TextPool } from './ui';
import { relicIcon } from './relic-ui';
import { statSize } from './items';
import { pix } from './camp-kit';

type G = Phaser.GameObjects.Graphics;

/** 17062 -> "17.1k" (rounded up, so a foe never reads as dead early). */
const kNum = (n: number): string => (n < 10000 ? `${n}` : n < 100000 ? `${Math.ceil(n / 100) / 10}k` : `${Math.ceil(n / 1000)}k`);

/** The fight's foe counter: foes beaten so far and every foe in its waves. */
const foeCount = (c: Combat): { beaten: number; total: number } => ({ beaten: c.foesBeaten, total: c.foesTotal });

/** Where the portrait's face sits inside its 40x40 texture (top-left of the 18x18 window shown in the badge). */
const FACE_AT: Record<string, [number, number]> = { rowan: [12, 6], sable: [14, 8] };
/** The hero plate: the HP plate's height, and the coin row under it (beside the portrait). */
const PLATE_H = 14;
const CHIP_Y = 20;
/** The relic belt shows up to this many icons (more: "+N" after them), 13 px apart, under the portrait and coins. */
const BELT_MAX = 5;
const BELT_Y = 32;
/** Combo milestones past the music's (tuning.music drumsAt / bassAt / leadAt): the counter's progress bar fills
 *  toward the next one, and reaching one plays a flourish. */
const LATE_MARKS = [75, 100];
/** Heals within this long of each other add up in one number under the HP plate. */
const HEAL_MERGE_MS = 650;
/** The name lane: how long a name stays (shorter while others wait), and how many may wait. */
const LANE_MS = 1150;
const LANE_BUSY_MS = 720;
const LANE_QUEUE = 3;
/** The combo flourish: the counter swells, a burst fans out, and (the first time each fight) a "Combo 25!" stamp. */
const FLOURISH_MS = 900;
/** The flourish's colour per milestone (hotter as it climbs; 100 cycles through the rainbow). */
const RAINBOW = [0xff5a5a, 0xffb03a, 0xffe14a, 0x6aff7a, 0x5ad8ff, 0xb07aff];
const tierOf = (n: number): number => (n >= 100 ? 4 : n >= 50 ? 3 : n >= 25 ? 2 : n >= 10 ? 1 : 0);
const TIER_HUE = [WHITE, 0xffd23a, 0xff9a3a, 0xff5ab0, 0xff5ab0];
/** The stamp's ribbon per milestone tier [hi, base, lo, deep]: gold, orange, pink, violet. */
const STAMP_FACE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0xfff0a0, 0xf2c230, 0xd8901c, 0x7a4a10],
  [0xffd0a0, 0xff9a3a, 0xc8601a, 0x6a2a0c],
  [0xffc0e8, 0xf05ab0, 0xb02a7a, 0x5e1044],
  [0xe4b8ff, 0x9a52d8, 0x6a2aa8, 0x34124e],
];

/** A name in the lane under the hero plate: a perk kicking in, a gear effect, a gain since the last fight. */
interface LaneItem {
  text: string;
  col: number;
  /** A relic's icon in front of it, or a texture (a skill node's), or a small up arrow (a stat gain). */
  relic?: RelicId;
  tex?: string;
  up?: boolean;
}

export class Hud {
  g!: G;
  /** Over the portrait (badges, flashes): drawn above the HUD's images. */
  private gTop: G | null = null;
  private texts: TextPool;
  private portrait: Phaser.GameObjects.Image | null = null;
  heroHpShown = 0;
  /** The HP readout pulses green (a heal, a max HP gain); the plate glows green with a gain line. */
  hpPulseAt = -1e9;
  private plateGlowAt = -1e9;
  coinsShown = 0;
  coinsPending = 0; // coins from kills whose burst hasn't spawned yet
  private coinFlights: Array<{ x0: number; y0: number; vx: number; vy: number; born: number; value: number }> = [];
  private lastCoinSound = 0;
  comboPopAt = 0;
  comboBreakUntil = 0;
  stackPopAt = -1e9;
  stackLostAt = -1e9;
  lastMilestone = 0;
  /** Heals merged per moment: their sum shows small and green under the HP plate's right end. */
  private heal: { sum: number; last: number } | null = null;
  /** The name lane: what's showing (since `at`, for `ms`) and what waits. */
  private lane: LaneItem[] = [];
  private laneNow: (LaneItem & { at: number; ms: number }) | null = null;
  private laneFight: unknown = null;
  /** The combo flourish playing (it starts on the music's next beat), and the milestones stamped this fight. */
  private flourish: { n: number; at: number; stamp: boolean; played: boolean } | null = null;
  private stamped = new Set<number>();
  private stampFight: unknown = null;
  // animation state
  private wasShown = false;
  private inAt = -1e9; // the HUD slid in (a fight started)
  private lastNow = 0;
  private hpNum = 0; // the HP number ticks toward the real value
  private hpPopAt = -1e9;
  private hpPrev = 0;
  private hurtAt = -1e9;
  private healAt = -1e9;
  private ghostHoldUntil = 0;
  private coinPopAt = -1e9;
  private coinsPrev = 0;
  private targetId = -1;
  private targetAt = -1e9;
  private foeNum = 0; // the enemy's HP number ticks too
  private foeNumPopAt = -1e9;
  private foePrev = 0;
  private foePopAt = -1e9;
  private lastCombo = 0;
  private comboInAt = -1e9;
  private meterPrev = 0;
  private sparkAt = 0;
  /** The hero's stats as of the last fight (kill gains in a fight are silent), the fight they belong to, and the
   *  one gain line waiting for the plate to slide in. */
  private seen: StatBlock | null = null;
  private seenFight: unknown = null;
  private seenHero = '';
  private gain: { text: string; hp: boolean; at: number } | null = null;
  /** Relic icons on the belt (over the HUD panels, under its flashes). */
  private pool: ImagePool;
  /** When each perk last kicked in (performance.now), and how often this fight (the relic panel says). */
  private perkAt = new Map<string, number>();
  private perkN = new Map<string, number>();
  private perkFight: unknown = null;
  /** Relics the belt has shown (a new one pops in), and when the belt first showed each. */
  private beltSeen = new Map<RelicId, number>();

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 12);
    this.pool = new ImagePool(s);
  }

  /** New layout: anything in flight is dropped and the counters snap to the run. */
  reset(): void {
    const s = this.s;
    this.gain = null;
    // the portrait's texture is rebuilt with the layout: a fresh image
    this.portrait?.destroy();
    this.portrait = s.add.image(0, 0, 'portrait_rowan').setOrigin(0, 0).setDepth(10.2).setVisible(false);
    this.gTop ??= s.add.graphics().setDepth(10.3);
    this.pool.destroy();
  }

  // ------------------------------------------------------------------ relics

  /** A perk kicked in: its relic's icon on the belt pulses, and the relic panel counts it. */
  perkKicked(id: string): void {
    const c = this.s.app.run.combat;
    if (c !== this.perkFight) {
      this.perkFight = c;
      this.perkN.clear();
    }
    this.perkAt.set(id, performance.now());
    this.perkN.set(id, (this.perkN.get(id) ?? 0) + 1);
  }

  /** How strongly a relic's icon pulses now (1 just kicked in, 0 at rest). */
  relicPulseK(id: string, now: number): number {
    const k = (now - (this.perkAt.get(id) ?? -1e9)) / 420;
    return k >= 0 && k < 1 ? Math.sin(Math.min(1, k * 2.2) * Math.PI) * (1 - k * 0.5) : 0;
  }

  /** How often a perk kicked in this fight. */
  perkCount(id: string): number {
    return this.s.app.run.combat === this.perkFight ? (this.perkN.get(id) ?? 0) : 0;
  }

  /** The relic belt's rect and its icon slots (`more`: relics not shown, counted in the last slot). */
  relicBelt(dx = 0): { r: Rect; slots: Array<{ id: RelicId; r: Rect }>; more: number } | null {
    const owned = this.s.app.run.hero.relics;
    if (!owned.length) return null;
    const shown = Math.min(BELT_MAX, owned.length);
    const more = owned.length - shown;
    const x0 = this.s.L + 3 + dx;
    const w = (shown + (more ? 1 : 0)) * 13 + 1;
    const slots = owned.slice(0, shown).map((id, i) => ({ id, r: { x: x0 + 1 + i * 13, y: BELT_Y + 1, w: 12, h: 12 } }));
    return { r: { x: x0, y: BELT_Y, w, h: 14 }, slots, more };
  }

  /** Which relic a tap on the belt hits (its index in the hero's relics; the "+N" slot opens the first not shown). */
  relicAt(x: number, y: number): number {
    const b = this.relicBelt();
    if (!b || !inRect(b.r, x, y, 2)) return -1;
    return Math.max(0, Math.min(b.slots.length - (b.more ? 0 : 1), Math.floor((x - b.r.x - 1) / 13)));
  }

  /** The relic belt: a navy strip under the coin chip, an icon per relic; one bobs and flashes when it kicks in. */
  private drawBelt(g: G, now: number, dx: number): void {
    const s = this.s;
    const b = this.relicBelt(dx);
    if (!b) return;
    tag(g, b.r, [NAVY[5], NAVY[2], NAVY[1], NAVY[0]], 0.94);
    const gt = this.gTop!;
    b.slots.forEach(({ id, r }, i) => {
      // a relic the belt hasn't shown yet pops in (once the plate has slid in)
      let seen = this.beltSeen.get(id);
      if (seen === undefined) this.beltSeen.set(id, (seen = Math.max(now, this.inAt + 380 + i * 60)));
      const pk = (now - seen) / 300;
      if (pk < 0) return;
      const pop = pk < 1 ? Math.round(Math.sin(pk * Math.PI) * 3) : 0;
      const k = this.relicPulseK(id, now);
      const bump = Math.round(k * 3) + pop;
      if (k > 0) glow(g, { x: r.x, y: r.y - bump, w: 12, h: 12 }, 0xffe680, 0.8 * k, 2);
      relicIcon(s, this.pool, g, id, r.x, r.y - bump, 10.25, pk < 1 ? clamp01(pk * 3) : 1);
      if (k > 0.3) rows(gt, r.x, r.y - bump, 12, 12, 2, WHITE, 0.55 * (k - 0.3));
    });
    if (b.more) {
      const x = b.r.x + 1 + b.slots.length * 13;
      this.texts.text(`+${b.more}`, x + 6, b.r.y + 7, 0xe8e4ff, { bold: true, ox: 0.5, oy: 0.5 });
    }
  }

  resetCoins(): void {
    this.coinFlights = [];
    this.coinsPending = 0;
    this.coinsShown = this.s.app.run.coins;
    this.coinsPrev = this.coinsShown;
  }

  /** The combo milestones: the music's layers (drums, bass, lead join there), then 75 and 100. */
  marks(): number[] {
    const m = this.s.app.tuning.music;
    return [...new Set([m.drumsAt, m.bassAt, m.leadAt, ...LATE_MARKS].filter((n) => n > 0))].sort((a, b) => a - b);
  }

  /**
   * The combo reached `combo`: a milestone it just passed plays the flourish. One the music marks lands on the beat
   * its layer joins on (the band's next beat), so the swell, the burst and the stamp hit with the drums, the bass or
   * the lead. The "Combo 25!" stamp shows the first time each fight; after a break, the counter just swells.
   */
  milestone(combo: number): void {
    const s = this.s;
    const c = s.app.run.combat;
    if (c !== this.stampFight) {
      this.stampFight = c;
      this.stamped.clear();
      this.flourish = null;
    }
    const marks = this.marks();
    // the combo was spent (a finisher) or broken: the milestones under it count again
    if (combo < this.lastMilestone) this.lastMilestone = marks.filter((n) => n <= combo).pop() ?? 0;
    for (const n of marks)
      if (combo >= n && this.lastMilestone < n) {
        this.lastMilestone = n;
        const m = s.app.tuning.music;
        const musical = n === m.drumsAt || n === m.bassAt || n === m.leadAt;
        const wait = musical ? Math.max(0, Math.min(700, s.app.audio.msToNextBeat())) : 0;
        const stamp = !this.stamped.has(n);
        this.stamped.add(n);
        this.flourish = { n, at: performance.now() + wait, stamp, played: false };
      }
  }

  // ------------------------------------------------------------------ heals and the name lane

  /** A heal: its number joins the one showing (heals in the same moment add up), and the HP readout pulses green. */
  healPop(amount: number): void {
    if (amount <= 0) return;
    const now = performance.now();
    const h = this.heal;
    if (h && now - h.last < HEAL_MERGE_MS) {
      h.sum += amount;
      h.last = now;
    } else this.heal = { sum: amount, last: now };
    this.hpPulseAt = now;
  }

  /** A name for the lane under the hero plate (one at a time; a few may wait their turn, the oldest give way). */
  announce(text: string, col: number, o: { relic?: RelicId; tex?: string; up?: boolean } = {}): void {
    if (this.laneNow?.text === text || this.lane.some((q) => q.text === text)) return;
    this.lane.push({ text, col, ...o });
    if (this.lane.length > LANE_QUEUE) this.lane.shift();
  }

  /** The heal number: small, green, right-aligned under the HP plate; it bumps as heals add up, then fades. */
  private drawHeal(g: G, plate: Rect, now: number): void {
    const h = this.heal;
    if (!h) return;
    const age = now - h.last;
    const life = 1000;
    if (age > life) {
      this.heal = null;
      return;
    }
    const bump = age < 140 ? -Math.round(2 * (1 - age / 140)) : 0;
    const out = clamp01((age - (life - 300)) / 300);
    const a = 1 - out;
    const txt = `+${h.sum}`;
    const right = plate.x + plate.w - 1;
    const y = plate.y + plate.h + 6 + bump - Math.round(out * 3);
    const tw = textWidth(txt, 1, true);
    this.texts.text(txt, right, y, age < 80 ? 0xe8ffd8 : 0x9af06a, { bold: true, ox: 1, oy: 0.5, alpha: a });
    // a small heart in front of it
    const hx = right - tw - 7;
    const hy = Math.round(y) - 3;
    g.fillStyle(INK, a);
    g.fillRect(hx, hy, 2, 1);
    g.fillRect(hx + 3, hy, 2, 1);
    g.fillRect(hx - 1, hy + 1, 7, 2);
    g.fillRect(hx, hy + 3, 5, 1);
    g.fillRect(hx + 1, hy + 4, 3, 1);
    g.fillRect(hx + 2, hy + 5, 1, 1);
    g.fillStyle(0x5ad848, a);
    g.fillRect(hx, hy + 1, 2, 1);
    g.fillRect(hx + 3, hy + 1, 2, 1);
    g.fillRect(hx, hy + 2, 5, 1);
    g.fillRect(hx + 1, hy + 3, 3, 1);
    g.fillRect(hx + 2, hy + 4, 1, 1);
    g.fillStyle(0xd8ffb0, a);
    g.fillRect(hx, hy + 1, 1, 1);
  }

  /**
   * The name lane: under the hero plate (under the relic belt when there is one), one name at a time on a small
   * navy pill, its relic's icon in front. It slides out from the plate, holds, and fades; the next one follows.
   * It never covers the act and foe counters in the middle.
   */
  private drawLane(g: G, now: number, dx: number): void {
    const s = this.s;
    const c = s.app.run.combat;
    if (c !== this.laneFight) {
      this.laneFight = c;
      this.lane = [];
      this.laneNow = null;
    }
    let cur = this.laneNow;
    if (cur && now - cur.at > cur.ms) cur = this.laneNow = null;
    if (!cur && this.lane.length) {
      const next = this.lane.shift()!;
      cur = this.laneNow = { ...next, at: now, ms: this.lane.length ? LANE_BUSY_MS : LANE_MS };
    }
    // a name waiting cuts the one showing short (it has been read for a while)
    if (cur && this.lane.length && now - cur.at < cur.ms - 200 && now - cur.at > LANE_BUSY_MS - 200) cur.ms = now - cur.at + 200;
    if (!cur) return;
    const age = now - cur.at;
    const ik = easeBack(age / 180, 1.4);
    const out = clamp01((age - (cur.ms - 200)) / 200);
    const a = clamp01(age / 90) * (1 - out);
    const iconW = cur.relic || cur.tex ? 13 : cur.up ? 8 : 4;
    const tw = textWidth(cur.text, 1, true);
    const w = iconW + tw + 7;
    const y = (this.relicBelt() ? BELT_Y + 16 : CHIP_Y + 13) - Math.round(out * 3);
    const x = s.L + 3 + dx + Math.round((1 - ik) * -14);
    const r: Rect = { x, y, w, h: 12 };
    rows(g, r.x - 1, r.y + 1, r.w + 2, r.h + 1, 2, INK, 0.35 * a);
    tag(g, r, [NAVY[5], NAVY[2], NAVY[1], NAVY[0]], 0.94 * a);
    // a strip of the name's colour along the left edge
    g.fillStyle(cur.col, a);
    g.fillRect(r.x + 1, r.y + 2, 1, r.h - 4);
    if (age < 160) glow(g, r, cur.col, 0.5 * (1 - age / 160), 2);
    let tx = r.x + 4;
    if (cur.relic) {
      relicIcon(s, this.pool, g, cur.relic, tx - 1, r.y, 10.25, a);
      tx += 13;
    } else if (cur.tex && s.textures.exists(cur.tex)) {
      const [iw, ih] = this.pool.size(cur.tex);
      const k = Math.min(1, 12 / Math.max(iw, ih));
      this.pool.at(cur.tex, tx - 1, r.y + Math.round((12 - ih * k) / 2), 10.25, a).setScale(k);
      tx += 13;
    } else if (cur.up) {
      pix(g, 'up', tx - 1, r.y + 2, a);
      tx += 8;
    }
    this.texts.text(cur.text, tx, r.y + 6, cur.col, { bold: true, oy: 0.5, alpha: a });
  }

  // ------------------------------------------------------------------ layout

  /** Slide-in offsets: the hero side comes from the left, the enemy side from the right, the strip from below. */
  private slide(now: number): { l: number; r: number; d: number } {
    const k = easeBack((now - this.inAt) / 380, 1.3);
    const k2 = easeBack((now - this.inAt - 60) / 380, 1.3);
    return { l: Math.round((1 - k) * -130), r: Math.round((1 - k2) * 130), d: Math.round((1 - k) * 18) };
  }

  /** Bottom-left corner of the combo counter (on the ground, just above the bar's band). */
  private comboAnchor(): { x: number; y: number } {
    return { x: this.s.L + 5, y: this.s.splitY - 5 };
  }

  // ------------------------------------------------------------------ coins

  /** Coins pop out at (x, y) and fly to the coin chip (`count`: how many coins show; by default 3 to 10). */
  dropCoins(x: number, y: number, total: number, count?: number): void {
    if (total <= 0) return;
    const n = Math.max(1, Math.round(count ?? Math.max(3, Math.min(10, Math.round(total / 5)))));
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const value = Math.floor(total / n) + (i < total % n ? 1 : 0);
      this.coinFlights.push({ x0: x, y0: y, vx: rand(-60, 60), vy: rand(-110, -60), born: now + i * 25, value });
    }
  }

  /** Coins pop out, then home in on the coin counter; the counter ticks up as each one lands. */
  drawCoins(g: G, now: number): void {
    const s = this.s;
    const tx = s.L + 3 + 27 + 5;
    const ty = CHIP_Y + 5;
    for (let i = this.coinFlights.length - 1; i >= 0; i--) {
      const f = this.coinFlights[i];
      const age = (now - f.born) / 1000;
      if (age < 0) continue;
      const T1 = 0.28;
      const T2 = 0.42;
      let x: number;
      let y: number;
      const pop = (t: number) => ({ x: f.x0 + f.vx * t, y: f.y0 + f.vy * t + 260 * t * t });
      if (age < T1) ({ x, y } = pop(age));
      else {
        const p = pop(T1);
        const k = ease(clamp01((age - T1) / T2));
        x = p.x + (tx - p.x) * k;
        y = p.y + (ty - p.y) * k;
        if (k >= 1) {
          this.coinFlights.splice(i, 1);
          this.coinsShown += f.value;
          if (now - this.lastCoinSound > 55) {
            this.lastCoinSound = now;
            s.app.audio.coin();
          }
          continue;
        }
      }
      // a spinning gold coin: 5 px face that narrows to its edge and back
      const X = Math.round(x);
      const Y = Math.round(y);
      const spin = [2, 1, 0, 1][Math.floor(now / 70 + i) % 4];
      rows(g, X - spin - 1, Y - 3, spin * 2 + 3, 7, spin > 0 ? 2 : 1, INK);
      g.fillStyle(spin === 0 ? 0xb07e18 : 0xf2c230, 1);
      g.fillRect(X - spin, Y - 2, spin * 2 + 1, 5);
      if (spin > 0) {
        g.fillStyle(0xfff0a0, 1);
        g.fillRect(X - spin, Y - 2, 1, 3);
        g.fillStyle(0xd8901c, 1);
        g.fillRect(X + spin, Y - 1, 1, 3);
        g.fillRect(X - spin + 1, Y + 2, spin * 2, 1);
      }
    }
    // the run banks coins when the phase moves on (after the kill animation), so never count down to it
    if (!this.coinFlights.length && this.coinsPending <= 0) this.coinsShown = Math.max(this.coinsShown, s.app.run.coins);
  }

  // ------------------------------------------------------------------ the frame

  private hideAll(): void {
    this.portrait?.setVisible(false);
    this.gTop?.clear();
    this.texts.hide();
    this.pool.hide();
    const txt = this.s.txt;
    for (const k of ['level', 'heroHp', 'coins', 'ability', 'enemyName', 'enemyHp', 'combo', 'comboLabel', 'speed', 'tier', 'meterLabel', 'button']) txt[k]?.setVisible(false);
  }

  drawPanel(now: number): void {
    const s = this.s;
    const g = this.g;
    g.clear();
    // the band casts a soft shadow onto the stage above it
    for (let i = 1; i <= 3; i++) {
      g.fillStyle(INK, 0.12 * (4 - i));
      g.fillRect(0, s.splitY - i, GAME_W, 1);
    }
    // the fight HUD shows in fights (and over the boost pick and defeat that follow one)
    const shown = s.fightHud();
    s.barView.img?.setVisible(shown);
    if (!shown) {
      this.wasShown = false;
      this.hideAll();
      return;
    }
    if (!this.wasShown) {
      this.wasShown = true;
      if (s.app.run.phase === 'fight') this.inAt = now;
      this.hpNum = s.app.run.hero.hp;
      this.hpPrev = s.app.run.hero.hp;
      this.coinsPrev = this.coinsShown;
    }
    const dt = Math.min(0.1, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    this.texts.begin();
    this.pool.begin();
    this.gTop!.clear();
    const sl = this.slide(now);
    this.drawHero(g, now, dt, sl.l);
    const c = s.app.run.combat;
    if (c) {
      this.drawEnemy(g, now, dt, c, sl.r);
      this.drawTop(g, now, c);
      this.drawCombo(g, now, c, sl.l);
      this.drawStrip(g, now, c, sl.d);
    }
  }

  drawTexts(now: number): void {
    const s = this.s;
    const S = s.app.settings;
    const d = s.app.lastTap;
    s.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, GAME_W / 2, s.splitY - 9, 0xc8c8d4, 1, 0.5, 0, s.app.panelOpen && s.fightHud());
    if (!s.fightHud()) return;
    const txt = s.txt;
    for (const k of ['level', 'heroHp', 'coins', 'ability', 'enemyName', 'enemyHp', 'combo', 'comboLabel', 'speed', 'tier', 'meterLabel']) txt[k]?.setVisible(false);
    this.drawButton(now);
    this.texts.end();
    this.pool.end();
  }

  // ------------------------------------------------------------------ hero plate

  private drawHero(g: G, now: number, dt: number, dx: number): void {
    const s = this.s;
    const run = s.app.run;
    const T = s.app.tuning;
    const H = run.hero;
    const x0 = s.L + 3 + dx;
    const y0 = 3;
    // every number comes from heroStats (kill gains, boosts and gear)
    const st = heroStats(T, H);
    const maxHp = st.hp;
    const hpNow = Math.max(0, Math.min(maxHp, H.hp));
    this.trackGains(now, st);
    // damage: the ghost holds a beat, then drains; healing: the bar jumps and the gain flashes
    if (H.hp < this.hpPrev) {
      this.hurtAt = now;
      this.ghostHoldUntil = now + 380;
    } else if (H.hp > this.hpPrev) this.healAt = now;
    this.hpPrev = H.hp;
    if (hpNow > this.heroHpShown) this.heroHpShown = hpNow;
    else if (now > this.ghostHoldUntil) this.heroHpShown += (hpNow - this.heroHpShown) * Math.min(1, dt * 7);
    const prevNum = Math.ceil(this.hpNum);
    this.hpNum += (hpNow - this.hpNum) * Math.min(1, dt * 14);
    if (Math.abs(this.hpNum - hpNow) < 0.5) this.hpNum = hpNow;
    if (Math.ceil(this.hpNum) !== prevNum) this.hpPopAt = now;
    const frac = hpNow / maxHp;
    const low = frac <= 0.3 && hpNow > 0;
    const beat = low ? pulse(now, 620) : 0;
    const hurtK = (now - this.hurtAt) / 260;
    const shake = hurtK >= 0 && hurtK < 1 ? Math.round(Math.sin(hurtK * 30) * 2 * (1 - hurtK)) : 0;
    const X = x0 + shake;

    // the plate: just the HP gauge, beside the portrait
    const plate: Rect = { x: X + 16, y: y0 + 1, w: 90, h: PLATE_H };
    if (low) glow(g, plate, 0xff3a3a, 0.5 * beat, 3);
    const gk = (now - this.plateGlowAt) / 600;
    if (gk >= 0 && gk < 1) glow(g, plate, 0x9af06a, 0.6 * (1 - gk), 2);
    panel(g, plate, { alpha: 0.94 });
    // Keen Edge: a green timer running along the plate's top edge
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      const sec = run.combat?.abilitySec() ?? T.hero.abilitySec;
      g.fillRect(plate.x + 9, plate.y, Math.round((plate.w - 11) * clamp01(H.abilityTimer / Math.max(0.01, sec))), 1);
    }
    // HP gauge (segment notches every 10% of max HP) and the number over it
    const gx = X + 26;
    const gy = y0 + 4;
    const healK = (now - this.healAt) / 400;
    gauge(g, gx, gy, 76, 8, frac, this.heroHpShown / maxHp, {
      ramp: low ? RAMP.hpLow : RAMP.hp,
      seg: 76 / 10 >= 3 ? Math.round(76 / 10) : 0,
      glow: low ? beat * 0.6 : healK >= 0 && healK < 1 ? 1 - healK : 0,
    });
    const hpK = (now - Math.max(this.hpPopAt, this.hpPulseAt)) / 160;
    const hpBump = hpK >= 0 && hpK < 1 ? -Math.round(2 * (1 - hpK)) : 0;
    const hpCol = this.hpPulseAt > now - 300 ? 0xc8ff9a : hpK >= 0 && hpK < 0.5 ? 0xfff6c0 : WHITE;
    this.texts.text(`${Math.ceil(this.hpNum)}/${maxHp}`, gx + 38, gy + 4 + hpBump, hpCol, { bold: true, ox: 0.5, oy: 0.5 });
    this.drawHeal(g, plate, now);

    // the Tusk Crown's crit buff: a gold timer along the plate's bottom edge
    const c = run.combat;
    if (c && c.tuskTimer > 0 && c.tuskCrit > 0) {
      g.fillStyle(0xffd23a, c.tuskTimer < 1 && Math.floor(now / 80) % 2 ? 0.4 : 1);
      g.fillRect(plate.x + 9, plate.y + plate.h - 1, Math.round((plate.w - 11) * clamp01(c.tuskTimer / Math.max(0.01, T.effects.tuskSec))), 1);
    }

    // portrait badge: gold rim, the hero's face; flashes red when hit, beats red at low HP
    const b: Rect = { x: X, y: y0, w: 22, h: 22 };
    const rim: readonly [number, number, number] = low && beat > 0.5 ? [0xffb0a0, 0xe0463c, 0x8a1a22] : [GOLD[4], GOLD[2], GOLD[1]];
    this.badge(g, b, rim, [0x3a5c8e, 0x1a2c52]);
    const heroId = H.build?.id ?? 'rowan';
    if (this.portrait) {
      const key = s.textures.exists(`portrait_${heroId}`) ? `portrait_${heroId}` : 'portrait_rowan';
      if (this.portrait.texture.key !== key) this.portrait.setTexture(key);
      const [fx, fy] = FACE_AT[heroId] ?? FACE_AT.rowan;
      const p = this.portrait.setCrop(fx, fy, 18, 18).setPosition(b.x + 2 - fx, b.y + 2 - fy).setVisible(true);
      if (hurtK >= 0 && hurtK < 0.6 && Math.floor(hurtK * 10) % 2 === 0) p.setTintMode(Phaser.TintModes.FILL).setTint(0xff6a5a);
      else p.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    }
    const gt = this.gTop!;
    if (hurtK >= 0 && hurtK < 1) {
      gt.fillStyle(0xff3030, 0.35 * (1 - hurtK));
      gt.fillRect(b.x + 2, b.y + 2, 18, 18);
    }
    // a soft vignette inside the frame
    gt.fillStyle(INK, 0.35);
    gt.fillRect(b.x + 2, b.y + 19, 18, 1);
    gt.fillRect(b.x + 19, b.y + 2, 1, 17);
    // the hero's level: a small gold chip on the badge's bottom corner
    const lv = `${H.build?.level ?? 1}`;
    const lw = textWidth(lv, 1, false) + 5;
    const lr: Rect = { x: b.x + b.w - lw + 1, y: b.y + b.h - 6, w: lw, h: 8 };
    tag(gt, lr, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]]);
    this.texts.text(lv, lr.x + 3, lr.y + 4, 0x3a1e08, { oy: 0.5 });

    // under the plate, beside the portrait: coins, and a potion (lit while a revive is left)
    const coins = this.coinsShown;
    if (coins !== this.coinsPrev) {
      if (coins > this.coinsPrev) this.coinPopAt = now;
      this.coinsPrev = coins;
    }
    const cr = this.coinChip(X, coins);
    const ck = (now - this.coinPopAt) / 200;
    const cpop = ck >= 0 && ck < 1;
    tag(g, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.94);
    if (cpop) glow(g, cr, 0xffe680, 0.7 * (1 - ck), 2);
    hudIcon(g, 'coin', cr.x + 1, cr.y + 0 - (cpop ? Math.round(2 * Math.sin(ck * Math.PI)) : 0));
    this.texts.text(`${coins}`, cr.x + 11, cr.y + 5, cpop && ck < 0.5 ? WHITE : 0xffe680, { bold: true, oy: 0.5 });
    const [pw] = iconSize('potionS');
    const rr: Rect = { x: cr.x + cr.w + 3, y: cr.y, w: pw + 4, h: 10 };
    const lit = H.revives > 0;
    tag(g, rr, lit ? [NAVY[5], NAVY[3], NAVY[2], NAVY[1]] : [NAVY[3], NAVY[1], NAVY[1], NAVY[0]], lit ? 0.94 : 0.7);
    hudIcon(g, 'potionS', rr.x + 2, rr.y, 1, lit ? 1 : 0.3);
    this.drawBelt(g, now, dx);
    this.drawLane(g, now, dx);
  }

  /** The coin chip under the HP plate, right of the portrait (the coins fly into it). */
  private coinChip(X: number, coins: number): Rect {
    return { x: X + 27, y: CHIP_Y, w: 13 + textWidth(`${coins}`, 1, true), h: 10 };
  }

  /**
   * The stats went up since the last fight (a boost picked, new gear worn, a forge upgrade): as the plate slides in,
   * one line under it names the biggest gain ("+3 ATK"); nothing when nothing went up. Gains in a fight (kills) are
   * silent, and a drop (a new run, a retry, gear taken off) or another hero just resets.
   */
  private trackGains(now: number, st: StatBlock): void {
    const run = this.s.app.run;
    const c = run.combat;
    // boosts picked over the HUD (after a fight) wait for the next fight
    if (run.phase !== 'fight' || !c) return;
    if (c !== this.seenFight) {
      this.seenFight = c;
      this.gain = null;
      // (another hero's stats aren't a gain)
      const hero = run.hero.build?.id ?? 'rowan';
      const seen = hero === this.seenHero ? this.seen : null;
      this.seenHero = hero;
      if (seen) {
        let best: { id: StatId; d: number; p: number } | null = null;
        for (const id of STAT_IDS) {
          const d = st[id] - seen[id];
          if (d <= 1e-6) continue;
          const p = statSize(this.s.app.tuning, id, d);
          if (!best || p > best.p) best = { id, d, p };
        }
        if (best) this.gain = { text: `${fmtStatShort(best.id, best.d)} ${best.id === 'hp' ? STAT_INFO.hp.name : STAT_INFO[best.id].short}`, hp: best.id === 'hp', at: Math.max(now, this.inAt + 450) };
      }
    }
    this.seen = st;
    if (this.gain && now >= this.gain.at) {
      this.showGain(this.gain.text, this.gain.hp, now);
      this.gain = null;
    }
  }

  /** The gain line: it slides out in the name lane under the plate, and the plate glows. */
  private showGain(text: string, hp: boolean, now: number): void {
    this.s.app.audio.statUp(0);
    this.plateGlowAt = now;
    if (hp) this.hpPulseAt = now;
    this.announce(text, 0x9af06a, { up: true });
  }

  /** A framed square badge: ink outline, a 2-tone metal rim, an ink line and a dark gradient well. */
  private badge(g: G, b: Rect, rim: readonly [number, number, number], well: readonly [number, number]): void {
    rows(g, b.x - 1, b.y + 2, b.w + 2, b.h, 3, INK, 0.5);
    rows(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, 3, INK);
    rows(g, b.x, b.y, b.w, b.h, 2, rim[1]);
    band(g, b.x, b.y, b.w, b.h, 2, 0, 1, rim[0]);
    g.fillStyle(rim[0], 1);
    g.fillRect(b.x, b.y + 2, 1, b.h - 5);
    band(g, b.x, b.y, b.w, b.h, 2, b.h - 1, b.h, rim[2]);
    g.fillStyle(rim[2], 1);
    g.fillRect(b.x + b.w - 1, b.y + 3, 1, b.h - 5);
    g.fillStyle(INK, 1);
    g.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    g.fillStyle(well[1], 1);
    g.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    g.fillStyle(well[0], 1);
    g.fillRect(b.x + 2, b.y + 2, b.w - 4, Math.round((b.h - 4) * 0.55));
    g.fillStyle(mix(well[0], well[1], 0.5), 1);
    g.fillRect(b.x + 2, b.y + 2 + Math.round((b.h - 4) * 0.55), b.w - 4, 2);
    g.fillStyle(WHITE, 0.9);
    g.fillRect(b.x + b.w - 5, b.y + 1, 2, 1);
  }

  // ------------------------------------------------------------------ enemy plate

  private drawEnemy(g: G, now: number, dt: number, c: Combat, dx: number): void {
    const s = this.s;
    const run = s.app.run;
    const T = s.app.tuning;
    const target = run.phase === 'fight' ? (c.currentTarget() ?? null) : null;
    if (!target) return;
    if (target.id !== this.targetId) {
      // a new target: its plate flips in
      if (this.targetId !== -1) this.targetAt = now;
      this.targetId = target.id;
      this.foeNum = target.hp;
    }
    const tk = clamp01((now - this.targetAt) / 220);
    const R = s.R - 3 + dx + Math.round((1 - easeBack(tk, 1.2)) * 40);
    const y0 = 3;
    const def = T.enemies[target.key];
    const v = s.fighters.enemies.get(target.id);
    const shownHp = s.anim < s.fighters.superFinalAt && v ? v.hpShown : target.hp;
    const ghost = (v?.hpShown ?? target.hp) / target.maxHp;
    const hitK = v ? (s.anim - v.kickAt) / 220 : 1;
    const shake = hitK >= 0 && hitK < 1 ? Math.round(Math.sin(hitK * 28) * 1.5 * (1 - hitK)) : 0;
    const X = R + shake;

    const plate: Rect = { x: X - 106, y: y0 + 1, w: 90, h: 23 };
    if (def.boss) glow(g, plate, 0xb070ff, 0.35 + 0.25 * pulse(now, 900), 3);
    panel(g, plate, { alpha: 0.94 });
    const gx = X - 102;
    const gy = y0 + 4;
    gauge(g, gx, gy, 76, 8, shownHp / target.maxHp, ghost, { ramp: def.boss ? RAMP.boss : RAMP.foe, mirror: true, seg: 8 });
    const prevNum = Math.ceil(this.foeNum);
    this.foeNum += (shownHp - this.foeNum) * Math.min(1, dt * 16);
    if (Math.abs(this.foeNum - shownHp) < 0.5) this.foeNum = shownHp;
    if (Math.ceil(this.foeNum) !== prevNum) this.foeNumPopAt = now;
    const pk = (now - this.foeNumPopAt) / 140;
    // big numbers (late bosses) shorten to "17.1k" so the readout stays bold and inside the gauge
    const full = `${Math.ceil(this.foeNum)}/${target.maxHp}`;
    const hpText = textWidth(full, 1, true) <= 72 ? full : `${kNum(Math.ceil(this.foeNum))}/${kNum(target.maxHp)}`;
    this.texts.text(hpText, gx + 38, gy + 4 - (pk >= 0 && pk < 1 ? Math.round(1.5 * (1 - pk)) : 0), pk >= 0 && pk < 0.4 ? 0xfff0c0 : WHITE, { bold: textWidth(hpText, 1, true) <= 74, ox: 0.5, oy: 0.5 });

    // row 2: the name (rank-colored), bold when it fits, the whole width of the plate
    const nameBold = textWidth(def.name, 1, true) <= 76;
    const name = nameBold || textWidth(def.name, 1, false) <= 76 ? def.name : (def.name.split(' ').pop() ?? def.name);
    const nameCol = def.boss ? 0xffd23a : def.elite ? 0xffa060 : 0xdcd8f0;
    this.texts.text(name, gx, y0 + 18, nameCol, { bold: nameBold, oy: 0.5 });
    // a shell or protection (halves the damage it takes) pulses in a chip under the badge
    if (target.shell < 1 || (target.protect < 1 && c.summonsAlive(target.id))) {
      const k = pulse(now, 600);
      const sr: Rect = { x: X - 33, y: y0 + 26, w: 33, h: 10 };
      tag(g, sr, [0x4aa0f0, 0x1a3c8a, 0x16306e, 0x10204a], 0.94);
      glow(g, sr, 0x9ad8ff, 0.3 + 0.4 * k, 2);
      hudIcon(g, 'shield', sr.x + 1, sr.y + 1);
      this.texts.text('x1/2', sr.x + 10, sr.y + 5, 0xcfeeff, { oy: 0.5 });
    }

    // badge: the foe's mark in its color (a red rim for elites, a crown for bosses)
    const b: Rect = { x: X - 22, y: y0, w: 22, h: 22 };
    const rim: readonly [number, number, number] = def.boss ? [0xe0b0ff, 0x9a52d8, 0x4a2470] : def.elite ? [0xffb090, 0xe0603c, 0x8a2a1a] : [0xeef3fa, 0x9aa4be, 0x4a5272];
    this.badge(g, b, rim, def.boss ? [0x4a2470, 0x24123a] : [0x5a2a3a, 0x2a1220]);
    const icon = FOE_ICONS[def.icon];
    if (icon) {
      const col = ENEMY_COL[def.sprite] ?? 0xd8d0e0;
      const ix = b.x + 4;
      const iy = b.y + 4;
      icon.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          if (row[xx] !== '#') continue;
          g.fillStyle(INK, 1);
          g.fillRect(ix + xx * 2 + 1, iy + yy * 2 + 1, 2, 2);
        }
      });
      icon.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          if (row[xx] !== '#') continue;
          const lit = yy === 0 || row[xx - 1] !== '#' || icon[yy - 1]?.[xx] !== '#';
          g.fillStyle(lit ? shade(col, 1.35) : col, 1);
          g.fillRect(ix + xx * 2, iy + yy * 2, 2, 2);
        }
      });
    }
    if (def.boss) hudIcon(g, 'crown', b.x + 4, b.y - 5);
    if (hitK >= 0 && hitK < 0.5) {
      this.gTop!.fillStyle(WHITE, 0.6 * (1 - hitK * 2));
      this.gTop!.fillRect(b.x + 2, b.y + 2, 18, 18);
    }
  }

  // ------------------------------------------------------------------ act and foe counters (top center)

  private drawTop(g: G, now: number, c: Combat): void {
    const s = this.s;
    const run = s.app.run;
    const cx = Math.round(GAME_W / 2);
    const node = run.node;
    const act = `Act ${run.actIndex + 1}`;
    const where = node ? `${node.row + 1}/${run.map.rows.length}` : '';
    const w = textWidth(act, 1, false) + (where ? textWidth(where, 1, false) + 5 : 0) + 8;
    const r: Rect = { x: Math.round(cx - w / 2), y: 20, w, h: 9 };
    tag(g, r, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.92);
    this.texts.text(act, r.x + 4, r.y + 4.5, 0xffd23a, { oy: 0.5 });
    if (where) {
      g.fillStyle(NAVY[6], 1);
      g.fillRect(r.x + 4 + textWidth(act, 1, false) + 1, r.y + 3, 1, 3);
      this.texts.text(where, r.x + r.w - 4, r.y + 4.5, 0xdcd8f0, { ox: 1, oy: 0.5 });
    }
    if (run.phase !== 'fight') return;
    const { beaten, total } = foeCount(c);
    this.drawFoes(g, now, beaten, total, cx, 33);
  }

  /** The wave counter: a skull per foe (beaten ones greyed, the current one lit and bobbing), or "Foe 3/11". */
  drawFoes(g: G, now: number, beaten: number, total: number, cx: number, y: number): void {
    if (total <= 1) return;
    const cur = Math.min(total, beaten + 1);
    if (beaten !== this.foePrev) {
      if (beaten > this.foePrev) this.foePopAt = now;
      this.foePrev = beaten;
    }
    const pk = (now - this.foePopAt) / 360;
    const popping = pk >= 0 && pk < 1;
    if (total <= 8) {
      const step = 8;
      const w = total * step + 3;
      const x0 = Math.round(cx - w / 2);
      tag(g, { x: x0, y: y - 2, w, h: 10 }, [NAVY[4], NAVY[2], NAVY[1], NAVY[0]], 0.8);
      for (let i = 0; i < total; i++) {
        const x = x0 + 2 + i * step;
        const isCur = i === cur - 1;
        const done = i < beaten;
        let dy = 0;
        if (isCur) dy = popping ? -Math.round(4 * Math.sin(pk * Math.PI)) : Math.floor(now / 300) % 2 ? -1 : 0;
        if (isCur) glow(g, { x, y: y - 1 + dy, w: 7, h: 7 }, 0xffd23a, 0.6 + 0.3 * pulse(now, 700), 2);
        hudIcon(g, done ? 'foeDone' : 'foe', x, y - 1 + dy, 1, done || isCur ? 1 : 0.8);
        if (done && popping && i === beaten - 1) {
          // the foe just beaten: a quick white flash as it greys out
          g.fillStyle(WHITE, 0.8 * (1 - pk));
          g.fillRect(x, y - 1, 7, 7);
        }
      }
    } else {
      const label = `Foe ${cur}/${total}`;
      const w = textWidth(label, 1, true) + 14;
      const x0 = Math.round(cx - w / 2);
      tag(g, { x: x0, y: y - 2, w, h: 11 }, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.92);
      if (popping) glow(g, { x: x0, y: y - 2, w, h: 11 }, 0xffd23a, 0.7 * (1 - pk), 2);
      hudIcon(g, 'foe', x0 + 2, y - 0 - (popping ? Math.round(3 * Math.sin(pk * Math.PI)) : 0));
      this.texts.text(label, x0 + 11, y + 3.5, popping && pk < 0.5 ? 0xfff6c0 : WHITE, { bold: true, oy: 0.5 });
    }
  }

  // ------------------------------------------------------------------ combo counter

  private drawCombo(g: G, now: number, c: Combat, dx: number): void {
    const s = this.s;
    const T = s.app.tuning;
    const combo = c.combo;
    const broke = now < this.comboBreakUntil;
    if (combo > 0 && this.lastCombo === 0) this.comboInAt = now;
    if (combo > 0) this.lastCombo = combo;
    else if (!broke) this.lastCombo = 0;
    const n = combo > 0 ? combo : broke ? this.lastCombo : 0;
    // the flourish (on the music's beat): its sound and a spray of sparks the moment it lands
    const fl = this.flourish;
    const ft = fl ? now - fl.at : -1;
    if (fl && ft >= 0 && !fl.played) {
      fl.played = true;
      s.app.audio.ready2();
    }
    if (fl && ft > FLOURISH_MS) this.flourish = null;
    if (n <= 0) return;
    const a = this.comboAnchor();
    // appear: slides up out of the band; break: shakes, turns red, drops and fades
    const ink = easeBack((now - this.comboInAt) / 260, 1.8);
    const bk = broke ? 1 - (this.comboBreakUntil - now) / 420 : 0;
    const x = a.x + dx + (broke ? Math.round(Math.sin(bk * 40) * 3 * (1 - bk)) : 0);
    const y = a.y + Math.round((1 - ink) * 14) + (broke ? Math.round(10 * bk * bk) : 0);
    const alpha = broke ? 1 - bk : 1;
    const pk = (now - this.comboPopAt) / 150;
    const pop = pk >= 0 && pk < 1 && !broke;
    const bump = pop ? -Math.round(3 * (1 - pk) ** 2) : 0;
    const tier = tierOf(n);
    const hue = TIER_HUE[tier];
    const rainbow = tier === 4 ? RAINBOW[Math.floor(now / 80) % 6] : hue;
    const num = `${n}`;
    const nw = textWidth(num, 2, true);
    // the flourish: the counter swells to 3x for a beat, flashing white, and a burst fans up from it
    const live = fl && ft >= 0 && !broke;
    const swell = live && ft < 130;
    const fhue = fl ? (tierOf(fl.n) === 4 ? RAINBOW[Math.floor(now / 80) % 6] : TIER_HUE[tierOf(fl.n)]) : hue;
    if (live) this.drawBurst(this.gTop!, x + nw / 2 + 4, y - 8, ft, fhue);
    const col = broke ? 0xff4a4a : swell || (pop && pk < 0.35) ? WHITE : rainbow;
    // a slanted streak behind the number in the tier color (hotter combos glow)
    if (tier > 0 && !broke) {
      const sw = nw + 30;
      for (let i = 0; i < 3; i++) {
        g.fillStyle(hue, (0.18 + 0.1 * pulse(now, 500) + (live ? 0.3 * (1 - ft / FLOURISH_MS) : 0)) * (1 - i * 0.3) * alpha);
        g.fillRect(x - 3 + i * 2, y - 13 + i * 3, sw - i * 4, 2);
      }
    }
    this.texts.text(num, x, y + bump, col, { bold: true, scale: swell ? 3 : 2, oy: 1, alpha, extrude: 1, extrudeCol: broke ? 0x5a0a14 : shade(swell ? fhue : hue, 0.35) });
    // label and progress toward the next milestone (hidden while the number swells over them)
    const lx = x + nw + 2;
    if (!swell) this.texts.text(broke ? 'Break!' : 'Combo', lx, y - 15, broke ? 0xff6a5a : 0xdcd8f0, { bold: true, alpha });
    if (!broke && !swell) {
      const marks = this.marks();
      const next = marks.find((m) => n < m);
      const prev = [...marks].reverse().find((m) => n >= m) ?? 0;
      const k = next ? (n - prev) / (next - prev) : 1;
      const bw = 30;
      const by = y - 4;
      rows(g, lx - 1, by - 1, bw + 2, 5, 1, INK, 0.9);
      g.fillStyle(NAVY[1], 0.9);
      g.fillRect(lx, by, bw, 3);
      const fw = Math.round(bw * k);
      if (fw > 0) {
        g.fillStyle(next ? shade(rainbow, 0.8) : rainbow, 1);
        g.fillRect(lx, by, fw, 3);
        g.fillStyle(WHITE, 0.6);
        g.fillRect(lx, by, fw, 1);
      }
      if (next) this.texts.text(`${next}`, lx + bw + 2, by + 1, 0x9a94b0, { oy: 0.5 });
    }
    if (live && fl.stamp) this.drawStamp(g, x + Math.round((nw + 34) / 2), y - 18, ft, fl.n);
    // combo tiers (a setting): the damage multiplier they give
    if (s.app.settings.comboTiers) {
      const tm = n >= T.tiers.t3 ? T.tiers.m3 : n >= T.tiers.t2 ? T.tiers.m2 : n >= T.tiers.t1 ? T.tiers.m1 : 1;
      if (tm > 1 && !(live && fl.stamp)) this.texts.text(`DMG x${tm}`, x, y - 26, 0xffd23a, { alpha });
    }
  }

  /** The flourish's burst (over the HUD's panels, under its text): a ring and a fan of bold rays opening up and to the
   *  right of the counter (never down over the bar). */
  private drawBurst(g: G, cx: number, cy: number, t: number, col: number): void {
    const k = clamp01(t / 420);
    if (k >= 1) return;
    const e = 1 - (1 - k) ** 3;
    const a = 1 - k * k;
    // the ring (its upper part), thick at first
    const rr = 6 + e * 26;
    const th = k < 0.35 ? 2 : 1;
    g.fillStyle(mix(col, WHITE, 0.3), 0.9 * a);
    for (let i = 0; i <= 30; i++) {
      const ang = Math.PI * 1.15 + (i / 30) * Math.PI * 0.8;
      g.fillRect(Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr * 0.75), th, th);
    }
    // rays: 2 px dashes flying outward, alternating white and the milestone's colour
    for (let i = 0; i < 9; i++) {
      const ang = Math.PI * 1.17 + (i / 8) * Math.PI * 0.76;
      const r0 = 8 + e * 24;
      const len = 3 + 7 * (1 - k);
      for (let d = r0; d < r0 + len; d += 1) {
        g.fillStyle(i % 2 ? WHITE : col, a);
        g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d * 0.75), 2, 2);
      }
    }
    // a flash on the counter as it lands
    if (t < 120) glow(g, { x: Math.round(cx - 14), y: Math.round(cy - 10), w: 28, h: 18 }, col, 0.9 * (1 - t / 120), 4);
  }

  /** "Combo 25!": a small ribbon over the counter in the milestone's colour, slammed in (a white flash, a size
   *  bump), then rising away. */
  private drawStamp(g: G, cx: number, by: number, t: number, n: number): void {
    const label = `Combo ${n}!`;
    const face = STAMP_FACE[Math.min(STAMP_FACE.length - 1, Math.max(0, tierOf(n) - 1))];
    const out = clamp01((t - (FLOURISH_MS - 240)) / 240);
    const a = 1 - out;
    const slam = clamp01(t / 110);
    const grow = Math.round((1 - slam) * 6);
    const tw = textWidth(label, 1, true);
    const w = tw + 12 + grow * 2;
    const h = 11 + Math.round(grow / 2);
    const y = Math.round(by - h - out * 6);
    // (kept clear of the screen's left edge, tails and all)
    cx = Math.max(this.s.L + 12 + w / 2, cx);
    ribbon(g, cx, y, w, h, face, a, slam > 0.6);
    if (t < 110) rows(g, Math.round(cx - w / 2), y, w, h, 1, WHITE, 0.7 * (1 - slam));
    this.texts.text(label, cx, y + h / 2, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a, extrude: 1, extrudeCol: face[3] });
  }

  // ------------------------------------------------------------------ finisher strip under the bar

  private drawStrip(g: G, now: number, c: Combat, dy: number): void {
    const s = this.s;
    const T = s.app.tuning;
    const m: Rect = { ...s.meter, y: s.meter.y + dy };
    const cy = m.y + m.h / 2;
    const stacks = c.stacks;
    const ready = c.finisherReady;
    const maxStacks = c.maxStacks();
    const maxed = stacks >= maxStacks;
    const frac = maxed ? 1 : clamp01(c.meter);
    const [fc, fh, fl] = stackCol(maxed ? stacks : stacks + 1);
    const [sc, sh] = stackCol(Math.max(1, stacks));
    const p = pulse(now, 520);

    // the bolt: the meter's emblem (glows once a finisher is banked)
    if (ready) glow(g, { x: s.L + 4, y: cy - 5, w: 9, h: 10 }, sh, 0.5 + 0.4 * p, 3);
    hudIcon(g, 'bolt', s.L + 4, Math.round(cy - 6));

    // casing: ink, a navy rim lit on top, a deep trough with quarter ticks
    if (ready) glow(g, { x: m.x - 2, y: m.y - 2, w: m.w + 4, h: m.h + 4 }, sh, 0.35 + 0.45 * p, 3);
    rows(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, 2, INK);
    rows(g, m.x - 1, m.y - 1, m.w + 2, m.h + 2, 1, NAVY[4]);
    g.fillStyle(NAVY[7], 1);
    g.fillRect(m.x, m.y - 1, m.w, 1);
    g.fillStyle(NAVY[2], 1);
    g.fillRect(m.x, m.y + m.h, m.w, 1);
    g.fillStyle(0x0a0716, 1);
    g.fillRect(m.x, m.y, m.w, m.h);
    g.fillStyle(0x05030a, 1);
    g.fillRect(m.x, m.y, m.w, 1);
    g.fillStyle(NAVY[3], 1);
    for (const q of [0.25, 0.5, 0.75]) g.fillRect(Math.round(m.x + m.w * q), m.y + 1, 1, m.h - 2);
    const fw = Math.round(m.w * frac);
    if (!ready && frac < 0.42) this.texts.text('FINISHER', m.x + m.w / 2, cy, NAVY[6], { ox: 0.5, oy: 0.5 });
    if (fw > 0) {
      const deep = shade(fl, 0.65);
      g.fillStyle(fc, 1);
      g.fillRect(m.x, m.y, fw, m.h);
      g.fillStyle(fh, 1);
      g.fillRect(m.x, m.y, fw, 2);
      g.fillStyle(fl, 1);
      g.fillRect(m.x, m.y + m.h - 2, fw, 1);
      g.fillStyle(deep, 1);
      g.fillRect(m.x, m.y + m.h - 1, fw, 1);
      // energy flowing along the fill: slanted light streaks drifting right
      const period = 7;
      const off = Math.floor(now / 26) % period;
      g.fillStyle(WHITE, ready || maxed ? 0.42 : 0.26);
      for (let sx = off - m.h - period; sx < fw; sx += period)
        for (let row = 2; row < m.h - 1; row++) {
          const px = sx + (m.h - row);
          if (px >= 0 && px < fw - 2) g.fillRect(m.x + px, m.y + row, 2, 1);
        }
      g.fillStyle(WHITE, 0.6);
      g.fillRect(m.x + 1, m.y, Math.max(0, fw - 3), 1);
      for (const q of [0.25, 0.5, 0.75]) {
        const qx = Math.round(m.x + m.w * q);
        if (qx < m.x + fw - 1) {
          g.fillStyle(deep, 0.7);
          g.fillRect(qx, m.y + 2, 1, m.h - 3);
        }
      }
      if (frac < 1) {
        // the charging head: a hot white edge with a halo
        const hx = m.x + fw;
        rows(g, hx - 3, m.y - 2, 6, m.h + 4, 2, fh, 0.3 + 0.2 * p);
        g.fillStyle(WHITE, 0.95);
        g.fillRect(hx - 1, m.y, 1, m.h);
        // sparks when it charges
        if (c.meter > this.meterPrev + 0.0005 && now - this.sparkAt > 40) {
          this.sparkAt = now;
          for (let i = 0; i < 2; i++)
            s.fx.particles.push({ x: hx, y: cy + rand(-3, 3), vx: rand(-40, -10), vy: rand(-50, -10), g: 120, born: now, life: rand(180, 320), color: i ? WHITE : fh, size: 1, world: false, streak: false });
        }
      } else if (ready) {
        // full: a bright band sweeping across
        const sx = ((now / (3 - Math.min(4, stacks) * 0.4)) % (m.w + 24)) - 12;
        g.fillStyle(WHITE, 0.6);
        for (let i = 0; i < 5; i++) {
          const px = Math.round(sx + i - 2);
          if (px >= 0 && px < m.w) g.fillRect(m.x + px, m.y, 1, m.h);
        }
      }
    }
    this.meterPrev = c.meter;
    // flash when a stack is banked; red when stacks are lost
    const pk = (now - this.stackPopAt) / 260;
    if (pk >= 0 && pk < 1) rows(g, m.x - 3, m.y - 3, m.w + 6, m.h + 6, 3, WHITE, 0.55 * (1 - pk));
    const lk = (now - this.stackLostAt) / 380;
    if (lk >= 0 && lk < 1) {
      g.fillStyle(0xff3030, 0.6 * (1 - lk));
      g.fillRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
    }

    // banked stacks: a gem each (the newest pops in); seven (Overcharge) sit a little closer
    const n = Math.min(7, maxStacks);
    const step = n > 6 ? 7 : 8;
    const gx = m.x + m.w + 6;
    for (let i = 0; i < n; i++) {
      const lit = i < stacks;
      const newest = lit && i === stacks - 1 && pk >= 0 && pk < 1;
      const bob = newest ? -Math.round(3 * Math.sin(pk * Math.PI)) : 0;
      const x = gx + i * step;
      if (lit && ready) glow(g, { x, y: cy - 3 + bob, w: 7, h: 7 }, stackCol(i + 1)[1], 0.25 + 0.3 * pulse(now, 520, i * 90), 1);
      gem(g, x, Math.round(cy - 3.5) + bob, lit, stackCol(i + 1));
      if (lk >= 0 && lk < 1 && !lit) {
        g.fillStyle(0xff3030, 0.7 * (1 - lk));
        g.fillRect(x, Math.round(cy - 3.5), 7, 7);
      }
    }
    if (maxStacks > n && stacks > 0) this.texts.text(`x${stacks}`, gx + n * step + 1, cy, sh, { bold: true, oy: 0.5 });
    this.drawOvercharge(g, now, c, gx + (Math.min(n, stacks) - 1) * step, Math.round(cy - 3.5));

    // cursor speed: three chevrons that light up (and burn orange at the cap)
    const sp = c.speedMult();
    const maxSp = T.cursor.maxSpeedMult;
    const hot = sp >= maxSp - 0.01 || c.minSpeed > 0;
    const lit = sp <= 1.01 ? 0 : Math.min(3, 1 + Math.floor(((sp - 1) / Math.max(0.01, maxSp - 1)) * 2.999));
    const vx = s.R - 17;
    for (let i = 0; i < 3; i++) {
      const on = i < lit;
      const col = hot ? (Math.floor(now / 120) % 2 ? 0xff5a2a : 0xffd080) : [0x9ad8ff, 0xffe680, 0xff9a3a][i];
      chevron(g, vx + i * 5, Math.round(cy - 3), 7, on ? col : NAVY[5], 1, 1, true);
    }
    if (ready && s.app.run.phase === 'fight') {
      const label = s.app.settings.finisherInput === 'swipe' ? 'SWIPE!' : 'FINISHER!';
      this.texts.text(label, m.x + m.w / 2, cy, Math.floor(now / 150) % 2 ? WHITE : stackCol(stacks)[1], { bold: true, ox: 0.5, oy: 0.5 });
      if (stacks > 1) this.texts.text(`x${stacks}`, m.x + m.w / 2 + textWidth(label, 1, true) / 2 + 3, cy, sc, { bold: true, oy: 0.5 });
    }
  }

  /**
   * Overcharge (you lose a stack after n s without a hit): a tiny countdown under the newest gem, draining, and
   * blinking red in the last two seconds. c.perk.overcharge is the fight's motion time of the last hit.
   */
  private drawOvercharge(g: G, now: number, c: Combat, x: number, y: number): void {
    const since = c.perk.overcharge;
    if (!c.hasPerk('overcharge') || typeof since !== 'number' || c.stacks <= 0) return;
    const n = Math.max(0.1, relicNumber(this.s.app.tuning, 'overcharge'));
    const left = Math.max(0, Math.min(n, n - (c.motionTime - since)));
    const frac = left / n;
    const urgent = left < 2;
    const blink = urgent && Math.floor(now / 120) % 2 === 0;
    // (over the gem: under it is the screen's edge)
    g.fillStyle(INK, 1);
    g.fillRect(x - 1, y - 5, 9, 4);
    g.fillStyle(NAVY[1], 1);
    g.fillRect(x, y - 4, 7, 2);
    g.fillStyle(urgent ? (blink ? WHITE : 0xff5a3a) : 0xffb030, 1);
    g.fillRect(x, y - 4, Math.max(1, Math.round(7 * frac)), 2);
    if (urgent) {
      g.fillStyle(0xff3030, blink ? 0.5 : 0.2);
      g.fillRect(x, y, 7, 7);
    }
  }

  /** Button mode: the finisher button on the band, gray until a stack is banked, then the color of its stacks. */
  private drawButton(now: number): void {
    const s = this.s;
    const c = s.app.run.combat;
    if (!c || s.app.settings.finisherInput === 'swipe' || s.app.run.phase !== 'fight') return;
    const g = this.g;
    const b = s.button;
    const ready = c.finisherReady;
    const stacks = c.stacks;
    const pulsing = ready && Math.floor(now / (160 - stacks * 15)) % 2 === 0;
    const [sc, sh, sd] = stackCol(Math.max(1, stacks));
    const face = ready
      ? stacks <= 1
        ? pulsing
          ? ([0xfff6c0, 0xffe066, 0xf2b030, 0xb07018] as const)
          : ([0xffe680, 0xf2c230, 0xd8901c, 0x9a5a14] as const)
        : ([pulsing ? WHITE : sh, sc, sd, shade(sd, 0.7)] as const)
      : ([0x6e5fa8, 0x4a3f78, 0x342b56, 0x1b1530] as const);
    if (ready)
      for (let r = 0; r < Math.min(3, stacks); r++) {
        const k = ((now + r * 180) % 560) / 560;
        rows(g, b.x - 3 - Math.round(k * 4), b.y - 3 - Math.round(k * 4), b.w + 6 + Math.round(k * 8), b.h + 6 + Math.round(k * 8), 4, stacks <= 1 ? 0xffe066 : sh, 0.45 * (1 - k));
      }
    button3d(g, { ...b, h: b.h - 2 }, face, false, ready);
    const label = ready ? (stacks > 1 ? `x${stacks}` : 'GO!') : 'Finish';
    this.texts.text(label, b.x + b.w / 2, b.y + (b.h - 2) / 2, ready ? WHITE : 0xc8c0e8, { bold: true, scale: ready ? 2 : 1, ox: 0.5, oy: 0.5 });
  }
}
