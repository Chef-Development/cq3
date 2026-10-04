// The HUD: hero HP and stats, enemy HP, coins, the finisher meter and button, combo counter, plus the kill
// rewards that fly into it (coins and stat icons).
import Phaser from 'phaser';
import type { FightScene } from '../scene';
import { FONT, FONT_BOLD, textWidth } from '../font';
import { GAME_W } from '../layout';
import { button3d, hudBar, hudIcon, iconSize, rows } from './pixels';
import { clamp01, ease, INK, rand, shade, stackCol, WHITE, type RainIcon } from './shared';

type G = Phaser.GameObjects.Graphics;

export class Hud {
  g!: G;
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

  constructor(private readonly s: FightScene) {}

  /** New layout: anything in flight is dropped and the counters snap to the run. */
  reset(): void {
    this.rain = [];
    this.statPending = { atk: 0, maxHp: 0, comboPower: 0 };
  }

  resetCoins(): void {
    this.coinFlights = [];
    this.coinsPending = 0;
    this.coinsShown = this.s.app.run.coins;
  }

  milestone(combo: number): void {
    const marks: Array<[number, string]> = [
      [10, 'Nice!'],
      [25, 'Great!'],
      [50, 'Awesome!'],
      [75, 'Insane!'],
      [100, 'Godlike!'],
    ];
    for (const [n, label] of marks)
      if (combo >= n && this.lastMilestone < n) {
        this.lastMilestone = n;
        this.s.fx.addFloater(GAME_W / 2 + 10, 36, `${n} Combo - ${label}`, 0xffd23a, 1, true, 0, -14, 0, 900, true);
        this.s.app.audio.ready2();
      }
  }

  // ------------------------------------------------------------------ kill rewards

  /** Stat upgrades rain down where the enemy died, bounce, then fly into their HUD slots and tick the stats up. */
  statRain(enemyId: number, atk: number, maxHp: number, comboPower: number): void {
    const s = this.s;
    const v = s.fighters.enemies.get(enemyId);
    const boss = !!(v && s.app.tuning.enemies[s.app.run.combat?.enemyById(enemyId)?.key ?? '']?.boss);
    const x0 = v ? v.x : GAME_W / 2 + 40;
    const per = boss ? 3 : 2;
    const items: Array<[RainIcon['stat'], string, number, number, number, number]> = [];
    // [stat, icon, amount, target x, target y, pulse row]
    if (atk) items.push(['atk', 'sword', atk, s.L + 9, 24, 0]);
    if (comboPower) items.push(['comboPower', 'bolt', comboPower, s.L + 9, 54, 2]);
    if (maxHp) items.push(['maxHp', 'heart', maxHp, s.L + 9, 8, 4]);
    let idx = 0;
    const now = performance.now();
    for (const [stat, key, amt, tx, ty, row] of items)
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
          tx,
          ty,
          row,
          idx,
          first: k === 0,
        });
        idx++;
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
            const label = r.stat === 'maxHp' ? `+${Math.round(r.total)} HP` : `+${Math.round(r.total * 10) / 10}`;
            s.fx.addFloater(r.stat === 'maxHp' ? s.L + 100 : s.L + 46, r.ty, label, 0x9af06a, 1, true, 0, -14, 0, 700, false);
          }
          continue;
        }
      }
      const [w, h] = iconSize(r.key);
      const glow = r.phase === 'fly' ? 0.5 : 0.25;
      g.fillStyle(WHITE, glow);
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
    const tx = s.L + 95;
    const ty = 7;
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

  // ------------------------------------------------------------------ panel

  drawPanel(now: number): void {
    const s = this.s;
    const g = this.g;
    const run = s.app.run;
    const c = run.combat;
    const T = s.app.tuning;
    g.clear();
    // the fight HUD shows in fights (and over the boost pick and defeat that follow one)
    const shown = s.fightHud();
    s.barView.img?.setVisible(shown);
    if (!shown) return;
    // hero: heart + HP bar, stat column
    const H = run.hero;
    // stat gains from a kill show up as their icons land (statPending holds back what's still in the air)
    const maxHp = T.hero.maxHp + H.bonusMaxHp - this.statPending.maxHp;
    const hpNow = Math.min(maxHp, H.hp - this.statPending.maxHp);
    this.heroHpShown += (hpNow - this.heroHpShown) * 0.2;
    hudBar(g, s.L + 19, 4, 66, 8, hpNow / maxHp, this.heroHpShown / maxHp);
    const hp = (now - this.statPulse[4]) / 300;
    hudIcon(g, 'heart', s.L + 2, hp >= 0 && hp < 1 && Math.floor(hp * 6) % 2 === 0 ? 0 : 1);
    ['sword', 'crit', 'bolt', 'potion'].forEach((k, i) => {
      const [w, h] = iconSize(k);
      hudIcon(g, k, s.L + 3 + ((12 - w) >> 1), Math.round(24.5 + i * 15 - h / 2));
    });
    hudIcon(g, 'coin', s.L + 92, 2);
    if (H.abilityTimer > 0) {
      g.fillStyle(0x9af0a0, 1);
      g.fillRect(s.L + 18, 15, Math.round(68 * (H.abilityTimer / Math.max(0.01, T.hero.abilitySec))), 1);
    }
    if (!c) return;
    // enemy (the current target): HP bar with a skull, attack stat below
    const target = run.phase === 'fight' ? (c.currentTarget() ?? null) : null;
    if (target) {
      const v = s.fighters.enemies.get(target.id);
      const bx = s.R - 86;
      const shownHp = s.anim < s.fighters.superFinalAt && v ? v.hpShown : target.hp;
      hudBar(g, bx + 1, 13, 66, 8, shownHp / target.maxHp, (v?.hpShown ?? target.hp) / target.maxHp, { mirror: true });
      hudIcon(g, 'skull', s.R - 14, 8);
      if (T.enemies[target.key].boss) hudIcon(g, 'crown', s.R - 14, 2);
      // statuses: a shell or protection halves the damage it takes
      if (target.shell < 1 || (target.protect < 1 && c.summonsAlive(target.id))) {
        const k = Math.floor(now / 300) % 2;
        g.fillStyle(k ? 0x9ad8ff : 0x4aa0f0, 1);
        g.fillRect(bx - 6, 14, 4, 5);
        g.fillRect(bx - 5, 19, 2, 1);
      }
      hudIcon(g, 'sword', s.R - 15, 25);
    }

    // finisher button on the wooden band: gray until a stack is banked, then the color of the stacks it holds
    const b = s.button;
    const ready = c.finisherReady;
    const stacks = c.stacks;
    const swipe = s.app.settings.finisherInput === 'swipe';
    const pulse = ready && Math.floor(now / (160 - stacks * 15)) % 2 === 0;
    const [sc, sh, sd] = stackCol(Math.max(1, stacks));
    const face = ready
      ? stacks <= 1
        ? pulse
          ? ([0xfff6c0, 0xffe066, 0xf2b030, 0xb07018] as const)
          : ([0xffe680, 0xf2c230, 0xd8901c, 0x9a5a14] as const)
        : ([pulse ? WHITE : sh, sc, sd, shade(sd, 0.7)] as const)
      : swipe
        ? ([0x5a5e70, 0x464a5c, 0x363a4a, 0x26283a] as const)
        : ([0x8a90a6, 0x6e7488, 0x585e72, 0x3e4254] as const);
    if (!swipe) button3d(g, b, face, false, ready);
    if (ready && !swipe) {
      // pulsing glow rings: one more ring per stack
      for (let r = 0; r < Math.min(3, stacks); r++) {
        const k = ((now + r * 180) % 560) / 560;
        rows(g, b.x - 3 - Math.round(k * 4), b.y - 3 - Math.round(k * 4), b.w + 6 + Math.round(k * 8), b.h + 6 + Math.round(k * 8), 4, stacks <= 1 ? 0xffe066 : sh, 0.45 * (1 - k));
      }
    }

    // finisher meter on the stone strip: the next stack fills over the color of the banked ones
    const m = s.meter;
    const maxed = stacks >= T.meter.maxStacks;
    const [fc, fh, fl] = stackCol(maxed ? stacks : stacks + 1);
    const [bc, bh, bl] = stackCol(stacks);
    hudBar(g, m.x, m.y, m.w, m.h, c.meter, c.meter, {
      fill: fc,
      hi: fh,
      lo: fl,
      bg: stacks > 0 ? bc : 0x161624,
      bgHi: stacks > 0 ? bh : 0x22223a,
      bgLo: stacks > 0 ? bl : 0x0e0e18,
      frame: false,
    });
    if (stacks > 0) {
      // the banked layer is dimmed so the filling layer reads on top of it
      g.fillStyle(INK, 0.35);
      g.fillRect(m.x + Math.round(m.w * c.meter), m.y, m.w - Math.round(m.w * c.meter), m.h);
    }
    if (ready) {
      // shimmer sweeping across, faster with more stacks
      const sx = m.x + ((now / (3.2 - stacks * 0.4)) % (m.w + 20)) - 10;
      g.fillStyle(WHITE, 0.55);
      for (let i = 0; i < 4; i++) if (sx + i - 2 >= m.x && sx + i - 2 < m.x + m.w) g.fillRect(Math.round(sx + i - 2), m.y, 2, m.h);
    }
    // flash when a stack is banked
    const pk = (now - this.stackPopAt) / 240;
    if (pk >= 0 && pk < 1) rows(g, m.x - 2, m.y - 2, m.w + 4, m.h + 4, 2, WHITE, 0.7 * (1 - pk));
    // red flash when stacks are lost
    const lk = (now - this.stackLostAt) / 360;
    if (lk >= 0 && lk < 1) {
      g.fillStyle(0xff3030, 0.6 * (1 - lk));
      g.fillRect(m.x, m.y, m.w, m.h);
    }
    hudIcon(g, 'bolt', m.x - 11, m.y - 2);
  }

  drawTexts(now: number): void {
    const s = this.s;
    const run = s.app.run;
    const c = run.combat;
    const S = s.app.settings;
    const H = run.hero;
    const T = s.app.tuning;
    const txt = s.txt;
    const maxHp = T.hero.maxHp + H.bonusMaxHp - this.statPending.maxHp;
    const node = run.node;
    const where = node ? ` - ${node.row + 1}/${run.map.rows.length}` : '';
    s.setText('level', `Act ${run.actIndex + 1}${where}`, GAME_W / 2, 17, 0xf2f4fa, 1, 0.5, 0, run.phase === 'fight');
    const hpPulse = now - this.statPulse[4] < 300;
    s.setText('heroHp', `${Math.ceil(Math.min(maxHp, H.hp - this.statPending.maxHp))}/${maxHp}`, s.L + 52, 8.5, hpPulse ? 0xc8ff9a : WHITE, 1, 0.5, 0.5);
    s.setText('coins', `${this.coinsShown}`, s.L + 103, 7, 0xffe680, 1, 0, 0.5);
    const crit = T.hero.critChance + H.bonusCrit + (H.abilityTimer > 0 ? T.hero.abilityCritBonus : 0);
    const cp = T.hero.comboPower + H.bonusComboPower - this.statPending.comboPower;
    const stats = [
      `${Math.round((T.hero.atk + H.bonusAtk - this.statPending.atk) * (1 + H.bonusDmg))}`,
      `${Math.round(crit * 100)}%`,
      `${Math.round(cp * 10) / 10}`,
      `${H.revives}`,
    ];
    stats.forEach((v, i) => {
      const pulse = (now - this.statPulse[i]) / 320;
      const col = pulse >= 0 && pulse < 1 ? (Math.floor(pulse * 6) % 2 ? WHITE : 0x9af06a) : i === 1 && H.abilityTimer > 0 ? 0x9af0a0 : WHITE;
      s.setText(`stat${i}`, v, s.L + 20, 24.5 + i * 15, col, 1, 0, 0.5);
    });
    s.setText('ability', 'Keen Edge', s.L + 20 + textWidth(stats[1], 1, true) + 4, 39.5, 0x9af0a0, 1, 0, 0.5, H.abilityTimer > 0);
    const target = c && run.phase === 'fight' ? c.currentTarget() : null;
    if (target && c) {
      const def = T.enemies[target.key];
      s.setText('enemyName', def.name, s.R - 52, 2, def.boss ? 0xffd23a : def.elite ? 0xffa060 : WHITE, 1, 0.5, 0);
      const tv = s.fighters.enemies.get(target.id);
      const hpNow = s.anim < s.fighters.superFinalAt && tv ? tv.hpShown : target.hp;
      s.setText('enemyHp', `${Math.ceil(hpNow)}/${target.maxHp}`, s.R - 52, 17.5, WHITE, 1, 0.5, 0.5);
      s.setText('enemyAtk', `${target.atk}`, s.R - 17, 31, WHITE, 1, 1, 0.5);
    } else ['enemyName', 'enemyHp', 'enemyAtk'].forEach((k) => txt[k].setVisible(false));

    const combo = c?.combo ?? 0;
    const broke = now < this.comboBreakUntil;
    const pk = (now - this.comboPopAt) / 140;
    const pop = pk < 1 && !broke ? 3 : 2;
    const comboCol = broke ? 0xff5a5a : combo >= 50 ? 0xff6a3a : combo >= 25 ? 0xffa03a : combo >= 10 ? 0xffd23a : WHITE;
    const my = s.meter.y + s.meter.h / 2;
    s.setText('combo', broke ? 'X' : `${combo}`, s.L + 4, s.B, comboCol, pop, 0, 1);
    txt.comboLabel.setVisible(false);
    const sp = c ? c.speedMult() : 1;
    s.setText('speed', `SPD x${sp.toFixed(2)}`, s.R - 2, my, sp > 1.01 ? 0xffd080 : 0xc8c8d4, 1, 1, 0.5);
    if (S.comboTiers && c) {
      const tm = combo >= T.tiers.t3 ? T.tiers.m3 : combo >= T.tiers.t2 ? T.tiers.m2 : combo >= T.tiers.t1 ? T.tiers.m1 : 1;
      s.setText('tier', `DMG x${tm}`, s.meter.x + s.meter.w, s.meter.y - 6, tm > 1 ? 0xffd23a : 0xc8c8d4, 1, 1, 0.5);
    } else txt.tier.setVisible(false);

    const ready = !!c?.finisherReady;
    const b = s.button;
    const fight = run.phase === 'fight';
    const swipeMode = S.finisherInput === 'swipe';
    const stacks = c?.stacks ?? 0;
    s.setText(
      'meterLabel',
      `${swipeMode ? 'SWIPE!' : 'FINISHER'} x${stacks}`,
      s.meter.x + s.meter.w / 2,
      s.meter.y + s.meter.h / 2,
      Math.floor(now / 150) % 2 ? WHITE : stackCol(stacks)[1],
      1,
      0.5,
      0.5,
      ready && fight,
    );
    const label = S.finisherInput === 'button' ? (ready ? (stacks > 1 ? `x${stacks}` : 'GO!') : 'Finish') : ready ? `x${stacks}` : 'Swipe';
    txt.button.setFont(ready ? FONT_BOLD : FONT);
    s.setText('button', label, b.x + b.w / 2, b.y + b.h / 2, ready ? WHITE : 0xd0d4e0, ready ? 2 : 1, 0.5, 0.5, fight && !swipeMode);

    const d = s.app.lastTap;
    s.setText('debug', d ? `TAP ${d.outcome} ${d.cursorPos.toFixed(3)}  CAL ${S.calibrationMs}MS` : `CAL ${S.calibrationMs}MS`, GAME_W / 2, s.meter.y + 9, 0xc8c8d4, 1, 0.5, 0, s.app.panelOpen);

    if (!s.fightHud())
      for (const k of ['level', 'heroHp', 'coins', 'stat0', 'stat1', 'stat2', 'stat3', 'ability', 'enemyName', 'enemyHp', 'enemyAtk', 'combo', 'speed', 'tier', 'meterLabel', 'button']) txt[k].setVisible(false);
  }
}
