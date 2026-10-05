// The HUD: hero plate (portrait, HP, stats, coins, revives), enemy plate (badge, HP, attack, name), the act and
// foe counters, the combo counter, the finisher strip under the bar (meter, banked stacks, speed) and button,
// plus the kill rewards that fly into it (coins and stat icons). Panels are dark navy with a light bevel and an
// ink outline (see pixels.ts panel); everything slides in with a little overshoot when a fight starts.
import Phaser from 'phaser';
import { heroStats, type Combat } from '../../core/combat';
import { fmtStat, type StatBlock } from '../../core/gear';
import { STAT_INFO, type StatId } from '../../data/gear';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_W } from '../layout';
import { band, button3d, chevron, gauge, gem, glow, GOLD, hudIcon, iconSize, NAVY, panel, RAMP, rows } from './pixels';
import { FOE_ICONS } from './icons';
import { clamp01, ease, easeBack, ENEMY_COL, INK, mix, pulse, rand, shade, stackCol, WHITE, type RainIcon, type Rect } from './shared';
import { tag, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;

/** The stats the plate doesn't show (gear brings them): a gain in one floats up under the plate. */
const HIDDEN: StatId[] = ['def', 'critDmg', 'meterGain', 'steady', 'luck', 'companion'];
const hiddenStats = (st: StatBlock): Record<string, number> => Object.fromEntries(HIDDEN.map((k) => [k, st[k]]));
/** The plate's stats: the row each pulses (statPulse) and how a gain reads. */
const SHOWN: Record<string, { row: number; label: (d: number) => string }> = {
  atk: { row: 0, label: (d) => `+${Math.round(d * 10) / 10}` },
  crit: { row: 1, label: (d) => `+${Math.round(d)}%` },
  cp: { row: 2, label: (d) => `+${Math.round(d * 10) / 10}` },
  hp: { row: 4, label: (d) => `+${Math.round(d)} Max HP` },
};

/** The fight's foe counter: foes beaten so far and every foe in its waves. */
const foeCount = (c: Combat): { beaten: number; total: number } => ({ beaten: c.foesBeaten, total: c.foesTotal });

/** Where the portrait's face sits inside its 40x40 texture (top-left of the 18x18 window shown in the badge). */
const FACE_AT: Record<string, [number, number]> = { rowan: [12, 6] };
/** Combo milestones: the counter's progress bar fills toward the next one. */
const MARKS: Array<[number, string]> = [
  [10, 'Nice!'],
  [25, 'Great!'],
  [50, 'Awesome!'],
  [75, 'Insane!'],
  [100, 'Godlike!'],
];

export class Hud {
  g!: G;
  /** Over the portrait (badges, flashes): drawn above the HUD's images. */
  private gTop: G | null = null;
  private texts: TextPool;
  private portrait: Phaser.GameObjects.Image | null = null;
  heroHpShown = 0;
  /** Stat gains from a kill whose icons are still in the air (the HUD shows them as they land). */
  statPending = { atk: 0, maxHp: 0, comboPower: 0 };
  statPulse = [-1e9, -1e9, -1e9, -1e9, -1e9]; // stat rows 0..3, then the HP bar
  coinsShown = 0;
  coinsPending = 0; // coins from kills whose burst hasn't spawned yet
  private coinFlights: Array<{ x0: number; y0: number; vx: number; vy: number; born: number; value: number }> = [];
  private lastCoinSound = 0;
  private rain: RainIcon[] = [];
  private lastRainNow = 0;
  comboPopAt = 0;
  comboBreakUntil = 0;
  stackPopAt = -1e9;
  stackLostAt = -1e9;
  lastMilestone = 0;
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
  /** The stats as last shown (without timed buffs), and gains waiting to be shown (after the plate slides in). */
  private seen: Record<string, number> | null = null;
  private gains: Array<{ key: string; d: number; at: number }> = [];
  private hiddenAt = -1e9; // the last hidden-stat gain shown, and how many stacked under the plate
  private hiddenN = 0;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, 12);
  }

  /** New layout: anything in flight is dropped and the counters snap to the run. */
  reset(): void {
    const s = this.s;
    this.rain = [];
    this.statPending = { atk: 0, maxHp: 0, comboPower: 0 };
    // the portrait's texture is rebuilt with the layout: a fresh image
    this.portrait?.destroy();
    this.portrait = s.add.image(0, 0, 'portrait_rowan').setOrigin(0, 0).setDepth(10.2).setVisible(false);
    this.gTop ??= s.add.graphics().setDepth(10.3);
  }

  resetCoins(): void {
    this.coinFlights = [];
    this.coinsPending = 0;
    this.coinsShown = this.s.app.run.coins;
    this.coinsPrev = this.coinsShown;
  }

  milestone(combo: number): void {
    for (const [n, label] of MARKS)
      if (combo >= n && this.lastMilestone < n) {
        this.lastMilestone = n;
        const c = this.comboAnchor();
        this.s.fx.addFloater(c.x + 30, c.y - 28, `${n} Combo! ${label}`, 0xffd23a, 1, true, 0, -16, 0, 900, false);
        this.s.fx.sparkle(c.x + 12, c.y - 10);
        this.s.app.audio.ready2();
      }
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

  /** Stat icon centers in the hero plate (the stat rain flies to them). */
  private statSlot(row: number): { x: number; y: number } {
    const x0 = this.s.L + 3;
    if (row === 4) return { x: x0 + 64, y: 7 };
    return { x: x0 + (this.statX[row] ?? 32), y: 19 };
  }
  /** Stat icon centers, relative to the plate's left edge (measured each frame: values change width). */
  private statX = [32, 56, 74];

  // ------------------------------------------------------------------ kill rewards

  /** Stat upgrades rain down where the enemy died, bounce, then fly into their HUD slots and tick the stats up. */
  statRain(enemyId: number, atk: number, maxHp: number, comboPower: number): void {
    const s = this.s;
    const v = s.fighters.enemies.get(enemyId);
    const boss = !!(v && s.app.tuning.enemies[s.app.run.combat?.enemyById(enemyId)?.key ?? '']?.boss);
    const x0 = v ? v.x : GAME_W / 2 + 40;
    const per = boss ? 3 : 2;
    const items: Array<[RainIcon['stat'], string, number, number]> = [];
    // [stat, icon, amount, pulse row]
    if (atk) items.push(['atk', 'sword', atk, 0]);
    if (comboPower) items.push(['comboPower', 'bolt', comboPower, 2]);
    if (maxHp) items.push(['maxHp', 'heart', maxHp, 4]);
    let idx = 0;
    const now = performance.now();
    for (const [stat, key, amt, row] of items) {
      const slot = this.statSlot(row);
      for (let k = 0; k < per; k++) {
        this.rain.push({
          key,
          stat,
          amt: amt / per,
          total: amt,
          x: x0 + rand(-24, 24),
          y: rand(8, 22),
          vx: rand(-20, 20),
          vy: rand(70, 110),
          phase: 'wait',
          t: now,
          delay: idx * 45,
          floor: s.ground - 6 + rand(-2, 2),
          fx: 0,
          fy: 0,
          tx: slot.x,
          ty: slot.y,
          row,
          idx,
          first: k === 0,
        });
        idx++;
      }
    }
  }

  /** Rain icons fall, bounce, rest a beat, then arc into the HUD (screen space, real time). */
  drawRain(g: G, now: number): void {
    const s = this.s;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastRainNow) / 1000));
    this.lastRainNow = now;
    for (let i = this.rain.length - 1; i >= 0; i--) {
      const r = this.rain[i];
      const age = now - r.t;
      if (r.phase === 'wait') {
        if (age < r.delay) continue;
        r.phase = 'fall';
        r.t = now;
      } else if (r.phase === 'fall') {
        r.vy += 900 * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        if (r.y >= r.floor && r.vy > 0) {
          r.y = r.floor;
          if (r.vy > 120) r.vy = -r.vy * 0.38;
          else {
            r.phase = 'rest';
            r.t = now;
            s.fx.burst(r.x, r.y + 5, 0xd8c8a0, 3, true, 0.4);
          }
        }
      } else if (r.phase === 'rest') {
        if (age > 70) {
          r.phase = 'fly';
          r.t = now;
          r.fx = r.x;
          r.fy = r.y;
        }
      } else {
        const k = Math.min(1, age / 320);
        const e = k * k * (3 - 2 * k);
        r.x = r.fx + (r.tx - r.fx) * e;
        r.y = r.fy + (r.ty - r.fy) * e - Math.sin(k * Math.PI) * 26;
        if (k >= 1) {
          this.rain.splice(i, 1);
          this.statPending[r.stat] = Math.max(0, this.statPending[r.stat] - r.amt);
          if (this.statPending[r.stat] < 1e-6) this.statPending[r.stat] = 0;
          this.statPulse[r.row] = now;
          s.fx.sparkle(r.tx, r.ty);
          s.app.audio.statUp(r.idx);
          if (r.first) {
            const label = r.stat === 'maxHp' ? `+${Math.round(r.total)} Max HP` : `+${Math.round(r.total * 10) / 10}`;
            s.fx.addFloater(r.tx + (r.stat === 'maxHp' ? 0 : 4), r.ty + 12, label, 0x9af06a, 1, true, 0, -12, 0, 700, false);
          }
          continue;
        }
      }
      const [w, h] = iconSize(r.key);
      const glowA = r.phase === 'fly' ? 0.5 : 0.25;
      g.fillStyle(WHITE, glowA);
      g.fillCircle(Math.round(r.x), Math.round(r.y), Math.max(w, h) * 0.7);
      hudIcon(g, r.key, Math.round(r.x - w / 2), Math.round(r.y - h / 2));
    }
  }

  dropCoins(x: number, y: number, total: number): void {
    if (total <= 0) return;
    const n = Math.max(3, Math.min(10, Math.round(total / 5)));
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const value = Math.floor(total / n) + (i < total % n ? 1 : 0);
      this.coinFlights.push({ x0: x, y0: y, vx: rand(-60, 60), vy: rand(-110, -60), born: now + i * 25, value });
    }
  }

  /** Coins pop out, then home in on the coin counter; the counter ticks up as each one lands. */
  drawCoins(g: G, now: number): void {
    const s = this.s;
    const tx = s.L + 3 + 5;
    const ty = 3 + 31;
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
    const txt = this.s.txt;
    for (const k of ['level', 'heroHp', 'coins', 'stat0', 'stat1', 'stat2', 'stat3', 'ability', 'enemyName', 'enemyHp', 'enemyAtk', 'combo', 'comboLabel', 'speed', 'tier', 'meterLabel', 'button']) txt[k]?.setVisible(false);
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
    for (const k of ['level', 'heroHp', 'coins', 'stat0', 'stat1', 'stat2', 'stat3', 'ability', 'enemyName', 'enemyHp', 'enemyAtk', 'combo', 'comboLabel', 'speed', 'tier', 'meterLabel']) txt[k]?.setVisible(false);
    this.drawButton(now);
    this.texts.end();
  }

  // ------------------------------------------------------------------ hero plate

  private drawHero(g: G, now: number, dt: number, dx: number): void {
    const s = this.s;
    const run = s.app.run;
    const T = s.app.tuning;
    const H = run.hero;
    const x0 = s.L + 3 + dx;
    const y0 = 3;
    // every number comes from heroStats (kill gains, boosts and gear); gains from a kill show up as their icons land
    // (statPending holds back what's still in the air)
    const st = heroStats(T, H);
    const maxHp = st.hp - this.statPending.maxHp;
    const hpNow = Math.max(0, Math.min(maxHp, H.hp - this.statPending.maxHp));
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

    // plate behind the gauge and stats
    const plate: Rect = { x: X + 16, y: y0 + 1, w: 90, h: 23 };
    if (low) glow(g, plate, 0xff3a3a, 0.5 * beat, 3);
    panel(g, plate, { alpha: 0.94 });
    // Keen Edge: a green timer running along the plate's top edge
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(plate.x + 9, plate.y, Math.round((plate.w - 11) * (H.abilityTimer / Math.max(0.01, T.hero.abilitySec))), 1);
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
    const hpK = (now - Math.max(this.hpPopAt, this.statPulse[4])) / 160;
    const hpBump = hpK >= 0 && hpK < 1 ? -Math.round(2 * (1 - hpK)) : 0;
    const hpCol = this.statPulse[4] > now - 300 ? 0xc8ff9a : hpK >= 0 && hpK < 0.5 ? 0xfff6c0 : WHITE;
    this.texts.text(`${Math.ceil(this.hpNum)}/${maxHp}`, gx + 38, gy + 4 + hpBump, hpCol, { bold: true, ox: 0.5, oy: 0.5 });

    // the Tusk Crown's crit buff: a gold timer along the plate's bottom edge
    const c = run.combat;
    const tusk = c && c.tuskTimer > 0 ? c.tuskCrit : 0;
    if (tusk > 0 && c) {
      g.fillStyle(0xffd23a, c.tuskTimer < 1 && Math.floor(now / 80) % 2 ? 0.4 : 1);
      g.fillRect(plate.x + 9, plate.y + plate.h - 1, Math.round((plate.w - 11) * clamp01(c.tuskTimer / Math.max(0.01, T.effects.tuskSec))), 1);
    }
    // stats: attack, crit (with Keen Edge and the Tusk Crown's buff), combo power (icon + value), each pops when it
    // ticks up; a gain from a boost or new gear pulses and shows how much once the plate is in (trackGains)
    const atk = st.atk - this.statPending.atk * (1 + H.bonusDmg);
    const crit = st.critChance + (H.abilityTimer > 0 ? T.hero.abilityCritBonus : 0) + tusk;
    const cp = st.comboPower - this.statPending.comboPower;
    this.trackGains(now, { atk: Math.round(atk), crit: Math.round(st.critChance * 100), cp: Math.round(cp * 10) / 10, hp: maxHp, ...hiddenStats(st) });
    const stats: Array<[string, string]> = [
      ['sword', `${Math.round(atk)}`],
      ['crit', `${Math.round(crit * 100)}%`],
      ['bolt', `${Math.round(cp * 10) / 10}`],
    ];
    let sx = gx - 1;
    stats.forEach(([icon, val], i) => {
      const [iw, ih] = iconSize(icon);
      const pk = (now - this.statPulse[i]) / 320;
      const hot = pk >= 0 && pk < 1;
      const bump = hot ? -Math.round(2 * Math.sin(pk * Math.PI)) : 0;
      this.statX[i] = sx - x0 + Math.floor(iw / 2);
      if (hot) glow(g, { x: sx, y: y0 + 13, w: iw, h: ih - 1 }, 0x9af06a, 0.8 * (1 - pk), 2);
      hudIcon(g, icon, sx, y0 + 13 + bump);
      const keen = i === 1 && H.abilityTimer > 0;
      const crown = i === 1 && tusk > 0;
      const col = hot ? (Math.floor(pk * 6) % 2 ? WHITE : 0x9af06a) : crown ? 0xffd23a : keen ? 0x9af0a0 : WHITE;
      this.texts.text(val, sx + iw + 1, y0 + 19 + bump, col, { oy: 0.5 });
      sx += iw + 1 + textWidth(val, 1, false) + 4;
    });

    // portrait badge: gold rim, the hero's face; flashes red when hit, beats red at low HP
    const b: Rect = { x: X, y: y0, w: 22, h: 22 };
    const rim: readonly [number, number, number] = low && beat > 0.5 ? [0xffb0a0, 0xe0463c, 0x8a1a22] : [GOLD[4], GOLD[2], GOLD[1]];
    this.badge(g, b, rim, [0x3a5c8e, 0x1a2c52]);
    if (this.portrait) {
      const [fx, fy] = FACE_AT.rowan;
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

    // second row: coins and revives
    const coins = this.coinsShown;
    if (coins !== this.coinsPrev) {
      if (coins > this.coinsPrev) this.coinPopAt = now;
      this.coinsPrev = coins;
    }
    const cw = 13 + textWidth(`${coins}`, 1, true);
    const cr: Rect = { x: X, y: y0 + 26, w: cw, h: 10 };
    const ck = (now - this.coinPopAt) / 200;
    const cpop = ck >= 0 && ck < 1;
    tag(g, cr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.94);
    if (cpop) glow(g, cr, 0xffe680, 0.7 * (1 - ck), 2);
    hudIcon(g, 'coin', cr.x + 1, cr.y + 0 - (cpop ? Math.round(2 * Math.sin(ck * Math.PI)) : 0));
    this.texts.text(`${coins}`, cr.x + 11, cr.y + 5, cpop && ck < 0.5 ? WHITE : 0xffe680, { bold: true, oy: 0.5 });
    const rr: Rect = { x: cr.x + cw + 4, y: cr.y, w: 18, h: 10 };
    tag(g, rr, [NAVY[5], NAVY[3], NAVY[2], NAVY[1]], 0.94);
    hudIcon(g, 'potionS', rr.x + 1, rr.y, 1, H.revives > 0 ? 1 : 0.45);
    this.texts.text(`${H.revives}`, rr.x + 9, rr.y + 5, H.revives > 0 ? 0xffb0e0 : 0x8a84a0, { oy: 0.5, bold: true });
  }

  /**
   * A stat went up since the plate last showed it (a boost picked, new gear worn, a forge upgrade): it pulses and its
   * gain floats up from it (one after another, once the plate has slid in). Kill gains show through their stat rain
   * instead (that pulses the row as it lands), and a drop (a new run, a retry, gear taken off) just resets.
   */
  private trackGains(now: number, vals: Record<string, number>): void {
    const seen = this.seen;
    this.seen = vals;
    const P = this.statPending;
    if (seen && !(P.atk || P.maxHp || P.comboPower)) {
      const start = Math.max(now, this.inAt + 450, this.gains.length ? this.gains[this.gains.length - 1].at + 160 : 0);
      let i = 0;
      for (const [key, v] of Object.entries(vals)) {
        const d = v - (seen[key] ?? v);
        if (d <= 1e-6) continue;
        const shown = SHOWN[key];
        if (shown && now - this.statPulse[shown.row] < 150) continue; // the stat rain just landed it
        this.gains.push({ key, d, at: start + i++ * 160 });
      }
    }
    for (let i = 0; i < this.gains.length; i++) {
      const gn = this.gains[i];
      if (now < gn.at) continue;
      this.gains.splice(i--, 1);
      this.showGain(gn.key, gn.d, now);
    }
  }

  private showGain(key: string, d: number, now: number): void {
    const s = this.s;
    const fx = s.fx;
    const shown = SHOWN[key];
    s.app.audio.statUp(shown?.row ?? 3);
    if (shown) {
      this.statPulse[shown.row] = now;
      const slot = this.statSlot(shown.row);
      fx.sparkle(slot.x, slot.y);
      fx.addFloater(slot.x + (key === 'hp' ? 0 : 4), slot.y + 13, shown.label(d), 0x9af06a, 1, true, 0, -6, 0, 1100, false);
      return;
    }
    // a stat the plate doesn't show: "+3 DEF" floats up under it (several stack)
    const stat = key as StatId;
    this.hiddenN = now - this.hiddenAt < 600 ? this.hiddenN + 1 : 0;
    this.hiddenAt = now;
    const text = `${fmtStat(stat, d)} ${STAT_INFO[stat].short}`;
    const x = s.L + 3 + 50;
    fx.addFloater(x, 50 + this.hiddenN * 9, text, 0x9ad8ff, 1, true, 0, -10, 0, 1300, false);
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
    const hpText = `${Math.ceil(this.foeNum)}/${target.maxHp}`;
    this.texts.text(hpText, gx + 38, gy + 4 - (pk >= 0 && pk < 1 ? Math.round(1.5 * (1 - pk)) : 0), pk >= 0 && pk < 0.4 ? 0xfff0c0 : WHITE, { bold: textWidth(hpText, 1, true) <= 74, ox: 0.5, oy: 0.5 });

    // row 2: the name (rank-colored) on the left, attack on the right toward the badge
    const atk = `${target.atk}`;
    const ax = X - 26 - textWidth(atk, 1, true);
    hudIcon(g, 'sword', ax - 13, y0 + 13);
    this.texts.text(atk, ax, y0 + 19, WHITE, { bold: true, oy: 0.5 });
    const room = ax - 13 - 3 - gx;
    const name = textWidth(def.name, 1, false) <= room ? def.name : (def.name.split(' ').pop() ?? def.name);
    const nameCol = def.boss ? 0xffd23a : def.elite ? 0xffa060 : 0xdcd8f0;
    this.texts.text(name, gx, y0 + 19, nameCol, { oy: 0.5 });
    // a shell or protection halves the damage it takes: a pulsing chip under the badge
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
    const tier = n >= 100 ? 4 : n >= 50 ? 3 : n >= 25 ? 2 : n >= 10 ? 1 : 0;
    const hue = [WHITE, 0xffd23a, 0xff9a3a, 0xff5ab0, 0xff5ab0][tier];
    const rainbow = tier === 4 ? [0xff5a5a, 0xffb03a, 0xffe14a, 0x6aff7a, 0x5ad8ff, 0xb07aff][Math.floor(now / 80) % 6] : hue;
    const col = broke ? 0xff4a4a : pop && pk < 0.35 ? WHITE : rainbow;
    const num = `${n}`;
    const nw = textWidth(num, 2, true);
    // a slanted streak behind the number in the tier color (hotter combos glow)
    if (tier > 0 && !broke) {
      const sw = nw + 30;
      for (let i = 0; i < 3; i++) {
        g.fillStyle(hue, (0.18 + 0.1 * pulse(now, 500)) * (1 - i * 0.3) * alpha);
        g.fillRect(x - 3 + i * 2, y - 13 + i * 3, sw - i * 4, 2);
      }
    }
    this.texts.text(num, x, y + bump, col, { bold: true, scale: 2, oy: 1, alpha, extrude: 1, extrudeCol: broke ? 0x5a0a14 : shade(hue, 0.35) });
    // label and progress toward the next milestone
    const lx = x + nw + 2;
    this.texts.text(broke ? 'Break!' : 'Combo', lx, y - 15, broke ? 0xff6a5a : 0xdcd8f0, { bold: true, alpha });
    if (!broke) {
      const next = MARKS.find(([m]) => n < m);
      const prev = [...MARKS].reverse().find(([m]) => n >= m)?.[0] ?? 0;
      const k = next ? (n - prev) / (next[0] - prev) : 1;
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
      if (next) this.texts.text(`${next[0]}`, lx + bw + 2, by + 1, 0x9a94b0, { oy: 0.5 });
    }
    // combo tiers (a setting): the damage multiplier they give
    if (s.app.settings.comboTiers) {
      const tm = n >= T.tiers.t3 ? T.tiers.m3 : n >= T.tiers.t2 ? T.tiers.m2 : n >= T.tiers.t1 ? T.tiers.m1 : 1;
      if (tm > 1) this.texts.text(`DMG x${tm}`, x, y - 26, 0xffd23a, { alpha });
    }
  }

  // ------------------------------------------------------------------ finisher strip under the bar

  private drawStrip(g: G, now: number, c: Combat, dy: number): void {
    const s = this.s;
    const T = s.app.tuning;
    const m: Rect = { ...s.meter, y: s.meter.y + dy };
    const cy = m.y + m.h / 2;
    const stacks = c.stacks;
    const ready = c.finisherReady;
    const maxed = stacks >= T.meter.maxStacks;
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

    // banked stacks: a gem each (the newest pops in)
    const n = Math.min(6, T.meter.maxStacks);
    const gx = m.x + m.w + 6;
    for (let i = 0; i < n; i++) {
      const lit = i < stacks;
      const newest = lit && i === stacks - 1 && pk >= 0 && pk < 1;
      const bob = newest ? -Math.round(3 * Math.sin(pk * Math.PI)) : 0;
      const x = gx + i * 8;
      if (lit && ready) glow(g, { x, y: cy - 3 + bob, w: 7, h: 7 }, stackCol(i + 1)[1], 0.25 + 0.3 * pulse(now, 520, i * 90), 1);
      gem(g, x, Math.round(cy - 3.5) + bob, lit, stackCol(i + 1));
      if (lk >= 0 && lk < 1 && !lit) {
        g.fillStyle(0xff3030, 0.7 * (1 - lk));
        g.fillRect(x, Math.round(cy - 3.5), 7, 7);
      }
    }
    if (T.meter.maxStacks > n && stacks > 0) this.texts.text(`x${stacks}`, gx + n * 8 + 1, cy, sh, { bold: true, oy: 0.5 });

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
