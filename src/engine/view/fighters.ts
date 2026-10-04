// The fighters: Rowan's choreography (dash, slash, parry, finisher whirlwind), the enemies (walk-in, poses,
// knockback, death burst), Pip the owl, and the finisher's streaked backdrop.
import Phaser from 'phaser';
import type { Combat } from '../../core/combat';
import { FINISHER_BLOW_AT, finisherStrikeAt, finisherStrikes, type ImpactFeel } from '../../core/impact';
import type { FightScene } from '../scene';
import { HERO_FEET_X, HERO_W, ICONS } from '../art';
import { GAME_W } from '../layout';
import { hpBar, icon } from './pixels';
import { FOE_ICONS } from './icons';
import {
  clamp01,
  comboSlashCol,
  DASH_MS,
  DEATH_CHARGE_MS,
  ease,
  ENEMY_COL,
  ENGAGE_MS,
  ENTER_MS,
  FINISHER_NAME,
  inRect,
  LEAP_MS,
  PIP_BACK_MS,
  PIP_SWOOP_MS,
  rand,
  RETURN_MS,
  SPRITE_SCALE,
  INK,
  stackCol,
  superMsFor,
  WHITE,
  type EnemyView,
  type HeroAnim,
} from './shared';

type G = Phaser.GameObjects.Graphics;

export class Fighters {
  h: HeroAnim;
  enemies = new Map<number, EnemyView>();
  private hero!: Phaser.GameObjects.Image;
  private pip!: Phaser.GameObjects.Image;
  private pipAnim = { state: 'idle' as 'idle' | 'swoop' | 'back', t0: 0, x: 0, y: 0, fromX: 0, fromY: 0, toX: 0, toY: 0 };
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostTrail: Array<{ x: number; y: number; tex: string; flip: boolean; at: number }> = [];
  private gShadow!: G;
  private gSuper!: G;
  private superAt = -1e9;
  superMs = superMsFor(1);
  private superStacks = 1;
  superFinalAt = -1e9; // anim time of the finisher's last blow
  burstAt = new Map<number, number>(); // enemy id -> anim time it bursts
  lastBurstAt = -1e9;
  /** Enemies born from a split: id -> the x they pop out from. */
  private splitFrom = new Map<number, number>();

  constructor(private readonly s: FightScene) {
    this.h = this.freshHero();
  }

  freshHero(): HeroAnim {
    const home = this.s.heroHome;
    return {
      state: 'idle',
      x: home,
      y: 0,
      fromX: home,
      toX: home,
      t0: 0,
      pose: 'idle0',
      poseUntil: 0,
      lastAction: 0,
      alt: false,
      hurtUntil: 0,
      flashUntil: 0,
      flashColor: WHITE,
      lungeAt: -1e9,
    };
  }

  /** Create the fighter layers for a new layout (the containers were just emptied). */
  build(): void {
    const s = this.s;
    this.gSuper = s.add.graphics();
    s.back.add(this.gSuper);
    this.gShadow = s.add.graphics();
    s.back.add(this.gShadow);
    this.pip = s.add.image(s.heroHome - 30, s.ground - 24, 'pip_idle0').setOrigin(0.5, 0.5);
    s.actors.add(this.pip);
    this.pipAnim = { state: 'idle', t0: 0, x: s.heroHome - 30, y: s.ground - 24, fromX: 0, fromY: 0, toX: 0, toY: 0 };
    this.ghosts = [0, 1, 2].map(() => s.add.image(0, 0, 'hero_dash').setVisible(false).setTintMode(Phaser.TintModes.FILL));
    s.actors.add(this.ghosts);
    this.ghostTrail = [];
    this.superFinalAt = -1e9;
    this.hero = s.add.image(s.heroHome, s.ground, 'hero_idle0').setScale(SPRITE_SCALE);
    s.actors.add(this.hero);
  }

  /** Forget every enemy view and reset the hero (their images went with the old layout). */
  reset(): void {
    this.enemies.clear();
    this.h = this.freshHero();
  }

  /** A new fight: old enemy views go, the hero starts fresh. */
  newFight(): void {
    for (const v of this.enemies.values()) v.img.destroy();
    this.enemies.clear();
    this.splitFrom.clear();
    this.h = this.freshHero();
    this.superFinalAt = -1e9;
    this.superAt = -1e9;
  }

  /** Where an enemy stands: centered when it fights alone, in a row by slot in a group (summons join the row). */
  private homeFor(slot: number, c: Combat): number {
    if (c.enemies.length === 1) return Math.round(GAME_W / 2 + 44);
    return Math.round(GAME_W / 2 + 16 + slot * 31);
  }

  /** Add a view for every living enemy that doesn't have one yet (they walk in from the right). */
  addEnemies(c: Combat): void {
    const s = this.s;
    for (const e of c.enemies) {
      if (this.enemies.has(e.id) || !e.alive) continue;
      const def = s.app.tuning.enemies[e.key];
      const img = s.add.image(0, 0, `${def.sprite}_idle0`).setOrigin(0.5, 1).setScale(SPRITE_SCALE);
      s.actors.add(img);
      const x = this.homeFor(e.slot, c);
      const from = this.splitFrom.get(e.id);
      this.splitFrom.delete(e.id);
      this.enemies.set(e.id, {
        id: e.id,
        sprite: def.sprite,
        img,
        homeX: x,
        x,
        y: s.ground + (c.enemies.length > 1 ? (e.slot % 2) * 3 : 0) - (def.fly ?? 0),
        pose: 'idle0',
        poseUntil: 0,
        flashUntil: 0,
        knockUntil: 0,
        kickAt: -1e9,
        kickDist: 0,
        numAt: -1e9,
        numLevel: 0,
        lunge: null,
        dieAt: 0,
        phase: Math.random() * 1000,
        hpShown: e.hp,
        enterAt: s.anim + (from === undefined ? Math.min(2, e.slot) * 120 : 0),
        fly: def.fly ?? 0,
        tellAt: 0,
        tellUntil: 0,
        fleeAt: 0,
        popAt: 0,
        enterFrom: from ?? GAME_W + 30,
      });
    }
  }

  enemyAt(x: number, y: number): number | null {
    for (const v of this.enemies.values()) {
      if (v.dieAt) continue;
      const b = v.img.getBounds();
      if (inRect({ x: b.x, y: b.y, w: b.width, h: b.height }, x, y, 6)) return v.id;
    }
    return null;
  }

  // ------------------------------------------------------------------ choreography

  setHeroPose(pose: string, ms: number): void {
    this.h.pose = pose;
    this.h.poseUntil = this.s.anim + ms;
  }

  setEnemyPose(v: EnemyView, pose: string, ms: number): void {
    v.pose = pose;
    v.poseUntil = this.s.anim + ms;
  }

  private standX(v: EnemyView): number {
    return Math.round(v.homeX - v.img.displayWidth / 2 - 12);
  }

  /** Rowan dashes in and slashes (`ward`: he cracks a shell block, so no hit sound and no damage number). */
  heroAttack(enemyId: number, damage: number, crit: boolean, perfect: boolean, combo: number, ward = false): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    const h = this.h;
    h.lastAction = s.anim;
    h.alt = !h.alt;
    const slash = h.alt ? 'slashA' : 'slashB';
    // the blow's sound and weight land together, when the sword connects
    const land = () => {
      if (!ward) s.app.audio.hit(combo, crit, perfect);
      return s.fx.impact(s.fx.weight(crit ? 'crit' : perfect ? 'perfect' : 'hit'));
    };
    if (!v) {
      this.setHeroPose(slash, 110);
      land();
      return;
    }
    const target = this.standX(v);
    let arrive = 0;
    if (h.state === 'idle' || h.state === 'return' || Math.abs(target - h.x) > 6) {
      h.state = 'dash';
      h.fromX = h.x;
      h.toX = target;
      h.t0 = s.anim;
      arrive = Math.abs(target - h.x) > 6 ? DASH_MS : 0;
      s.fx.burst(h.x - 6, s.ground - 2, 0xc8b090, 4, true, 0.5);
      if (arrive) s.app.audio.swish(); // the tap's instant feedback while the dash closes in
    }
    s.later(arrive, () => {
      if (h.state === 'dash') {
        h.state = 'engaged';
        h.x = h.toX;
      }
      this.setHeroPose(slash, 110);
      h.lungeAt = s.anim;
      this.enemyHurtFx(enemyId, damage, crit, perfect, land());
    });
  }

  /**
   * The enemy shows a blow: white flash and knockback sized by the impact's feel, sparks, slash, number.
   * (The impact itself, hit-stop, shake and sound, is applied once by the caller, even when several enemies are hit.)
   */
  enemyHurtFx(enemyId: number, damage: number, crit: boolean, perfect: boolean, feel: ImpactFeel, finisher = false, scale = 0): void {
    const s = this.s;
    const fx = s.fx;
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const combo = s.app.run.combat?.combo ?? 0;
    const cy = v.y - v.img.displayHeight / 2;
    const big = crit || finisher;
    v.flashUntil = s.anim + feel.flashMs;
    v.knockUntil = s.anim + (big ? 140 : 90);
    v.kickAt = s.anim;
    v.kickDist = feel.knockPx;
    if (!v.dieAt) this.setEnemyPose(v, 'hurt', 160);
    const col = finisher ? 0xff8a2a : crit ? 0xffb020 : perfect ? 0xfff07a : 0xffe040;
    // contact point: the enemy's front edge, at chest height
    const hx = Math.round(v.x - v.img.displayWidth * 0.3);
    if (big) fx.stars.push({ x: v.x, y: cy - 8, at: s.anim, r: finisher ? 34 : 24, color: finisher ? 0xffb03a : 0xfff07a });
    fx.sparks.push({ x: hx, y: cy, at: s.anim, size: finisher ? 18 : crit ? 14 : 10, color: big ? 0xfff07a : 0xbfe8ff });
    const numScale = scale || (finisher ? 3 : 2);
    // quick successive numbers cascade upward and alternate sides instead of piling on each other
    const recent = s.anim - v.numAt < 260;
    v.numLevel = recent ? (v.numLevel + 1) % 3 : 0;
    v.numAt = s.anim;
    if (damage > 0) fx.floatNum(v.x + (v.numLevel % 2 ? 8 : -6) + rand(-2, 2), v.y - v.img.displayHeight - 10 - v.numLevel * 11, `${damage}`, col, numScale);
    const tier = combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;
    fx.slashes.push({ x: v.x, y: cy, at: s.anim, big: big || tier >= 2, dir: this.h.alt ? 1 : -1, color: crit ? 0xffd23a : comboSlashCol(combo) });
    fx.burst(hx, cy, WHITE, (big ? 14 : 8) + tier * 2, true, big ? 1.6 : 1.1, true);
    fx.chips(hx, cy, 6, [WHITE, col, ENEMY_COL[v.sprite] ?? WHITE], big ? 10 : 5, 0);
    if (big) fx.ring(v.x, cy, 28, col, true);
    // the camera jolts along with the knockback
    fx.kick(Math.round(1 + feel.knockPx * 0.2), 60 + feel.hitStopMs * 0.3);
  }

  heroParry(ownerId: number, cracked: boolean, perfect: boolean): void {
    const s = this.s;
    const fx = s.fx;
    const h = this.h;
    h.lastAction = s.anim;
    this.setHeroPose('parry', 150);
    s.app.audio.block(cracked, perfect);
    const feel = fx.impact(fx.weight('block') * (cracked ? 0.9 : 1));
    const sx = h.x + 10;
    const sy = s.ground - 22;
    fx.burst(sx, sy, 0x7ae0ff, cracked ? 6 : 10, true, 1, true);
    fx.burst(sx, sy, WHITE, 4, true, 0.8, true);
    fx.ring(sx, sy, 14, 0x7ae0ff, true);
    const v = this.enemies.get(ownerId);
    if (v && !v.dieAt) {
      v.knockUntil = s.anim + 80;
      v.kickAt = s.anim;
      v.kickDist = feel.knockPx * 0.5; // the parried enemy is shoved back a little
      this.setEnemyPose(v, 'attack', 90);
    }
  }

  /**
   * The finisher show, scaled by the stacks spent: the hero dashes in and whirls through the enemies with a
   * flurry of strikes (more stacks = more strikes, a longer show and a hotter backdrop), then lands one huge
   * blow whose number counts up. Kills and the HP bars wait for that last blow.
   */
  heroFinisher(damage: number, stacks: number): void {
    const s = this.s;
    const fx = s.fx;
    const h = this.h;
    const n = Math.max(1, Math.min(5, stacks));
    const views = [...this.enemies.values()].filter((v) => !v.dieAt);
    const front = views.slice().sort((a, b) => a.homeX - b.homeX)[0];
    this.superMs = superMsFor(n);
    this.superStacks = n;
    const ms = this.superMs;
    h.state = 'super';
    h.fromX = h.x;
    h.toX = front ? front.homeX - 8 : h.x + 80;
    h.t0 = s.anim;
    h.lastAction = s.anim + ms;
    this.superAt = s.anim;
    const finalK = FINISHER_BLOW_AT;
    this.superFinalAt = s.anim + ms * finalK;
    const [col, hi] = stackCol(n);
    fx.addFloater(GAME_W / 2, 42, FINISHER_NAME[n] ?? 'Finisher!', n === 1 ? 0xffe680 : hi, n >= 2 ? 3 : 2, true, 0, -6, 0, ms * 0.95, true);
    // the flurry: 1 + 2n quick strikes between 30% and 70% of the show
    const strikes = finisherStrikes(n);
    for (let st = 0; st < strikes; st++) {
      const k = finisherStrikeAt(st, strikes);
      s.later(ms * k, () => {
        for (const v of views) {
          const cy = v.y - v.img.displayHeight / 2 + rand(-6, 4);
          v.flashUntil = s.anim + 40;
          v.kickAt = s.anim;
          v.kickDist = 4;
          fx.slashes.push({ x: v.x + rand(-4, 4), y: cy, at: s.anim, big: st % 2 === 1, dir: st % 2 ? 1 : -1, color: st % 3 === 2 ? hi : col });
          fx.sparks.push({ x: v.x + rand(-8, 4), y: cy, at: s.anim, size: 8, color: hi });
          fx.burst(v.x, cy, WHITE, 5, true, 1.3, true);
        }
        s.app.audio.finisherStrike(st, strikes);
        fx.kick(st % 2 ? 2 : -2, 60);
        fx.freeze(25);
      });
    }
    // the last blow
    s.later(ms * finalK, () => {
      s.app.audio.finisherBoom(n);
      const feel = fx.impact(fx.weight('finisher', n));
      for (const v of views) {
        this.enemyHurtFx(v.id, damage, false, false, feel, true, 3);
        // the damage number (the floater enemyHurtFx just made) counts up over the enemy, hangs longer, rises slowly
        const num = fx.floaters[fx.floaters.length - 1];
        if (num && damage > 0) {
          num.y = Math.max(34, v.y - v.img.displayHeight / 2 - 4);
          num.count = { to: damage, dur: 260 + 50 * n };
          num.life = 1300 + 100 * n;
          num.vy = -28;
          num.g = 20;
          num.vx = 0;
        }
        const cy = v.y - v.img.displayHeight / 2;
        for (let r = 0; r < n; r++) s.later(r * 70, () => fx.ring(v.x, cy, 30 + r * 14, r % 2 ? hi : col, true));
        fx.stars.push({ x: v.x, y: cy - 6, at: s.anim, r: 30 + n * 6, color: col });
        fx.burst(v.x, cy, col, 16 + n * 8, true, 1.6 + n * 0.15);
      }
      fx.screenFlash(n >= 3 ? 0xfff0c0 : WHITE, performance.now(), 160 + 40 * n);
      fx.kick(6, 160);
    });
  }

  /** An enemy dies: it flashes and swells, then bursts into its own pixels with a flash, smoke and coins. */
  enemyDeath(id: number, coins: number, boss: boolean): void {
    const s = this.s;
    const fx = s.fx;
    const v = this.enemies.get(id);
    if (!v) {
      s.hud.coinsPending -= coins;
      return;
    }
    v.dieAt = s.anim;
    s.later(DEATH_CHARGE_MS, () => {
      s.app.audio.enemyPop(boss);
      fx.impact(fx.weight(boss ? 'bossKill' : 'kill'));
      const cy = v.y - v.img.displayHeight / 2;
      const col = ENEMY_COL[v.sprite] ?? WHITE;
      fx.explodePixels(v, boss);
      fx.flashes.push({ x: v.x, y: cy, r: boss ? 34 : 20, at: s.anim });
      for (let i = 0; i < (boss ? 10 : 6); i++) {
        const a = (i / (boss ? 10 : 6)) * Math.PI * 2 + rand(-0.3, 0.3);
        const d = rand(4, boss ? 18 : 10);
        fx.puffs.push({ x: v.x + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6, r: rand(4, boss ? 10 : 7), at: s.anim + rand(0, 60), life: rand(380, 560), color: i % 3 === 0 ? 0xffffff : 0xd8d4e0 });
      }
      fx.stars.push({ x: v.x, y: cy, at: s.anim, r: boss ? 40 : 26, color: col });
      fx.burst(v.x, cy, WHITE, boss ? 24 : 12, true, 1.5, true);
      fx.ring(v.x, cy, boss ? 52 : 36, 0xffe680, true);
      if (boss) {
        for (const [ms, r, c2] of [
          [90, 48, 0xff8a2a],
          [180, 64, 0xffd23a],
          [270, 80, 0xff5a3a],
        ] as const)
          s.later(ms, () => fx.ring(v.x, cy, r, c2, true));
        fx.screenFlash(0xffe0a0, performance.now(), 240);
      }
      s.hud.coinsPending -= coins;
      s.hud.dropCoins(v.x, cy, coins);
      if (coins > 0) s.later(120, () => fx.iconFloat(v.x + 22, cy - 26, `+${coins}`, 0xffe066, 'coin'));
      fx.kick(5, 140);
      s.later(140, () => s.app.audio.kill());
    });
  }

  petAttack(enemyId: number, damage: number): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const P = this.pipAnim;
    Object.assign(P, { state: 'swoop', t0: s.anim, fromX: P.x, fromY: P.y, toX: v.homeX - v.img.displayWidth / 2 - 2, toY: v.y - v.img.displayHeight * 0.6 });
    s.later(PIP_SWOOP_MS, () => {
      const cy = v.y - v.img.displayHeight / 2;
      v.flashUntil = s.anim + 50;
      v.knockUntil = s.anim + 60;
      s.fx.floatNum(v.x + rand(-4, 4), v.y - v.img.displayHeight - 8, `${damage}`, 0x6aff5a, 1);
      s.fx.burst(v.x - 6, cy, 0xb8e4ff, 8, true, 1, true);
      s.app.audio.pet();
      Object.assign(P, { state: 'back', t0: s.anim, fromX: P.x, fromY: P.y });
    });
  }

  /** An enemy winds up its special: the 'tell' pose, a countdown ring, a "!" and the special's name. */
  telegraph(enemyId: number, name: string, sec: number): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v || v.dieAt) return;
    v.tellAt = s.anim;
    v.tellUntil = s.anim + sec * 1000;
    s.fx.addFloater(v.homeX, Math.max(30, v.y - v.img.displayHeight - 16), name, 0xff9a3a, 1, true, 0, -6, 0, sec * 1000 + 250, true);
  }

  tellOver(enemyId: number): void {
    const v = this.enemies.get(enemyId);
    if (v) v.tellUntil = 0;
  }

  /** The special fires: the enemy strikes a pose. */
  special(enemyId: number): void {
    const v = this.enemies.get(enemyId);
    if (!v || v.dieAt) return;
    v.tellUntil = 0;
    this.setEnemyPose(v, 'attack', 240);
    v.kickAt = this.s.anim;
    v.kickDist = -3;
  }

  /** A slime splits: it bursts with a splat and its children pop out where it stood. */
  splitApart(enemyId: number, ids: number[]): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v) return;
    v.popAt = s.anim;
    for (const id of ids) this.splitFrom.set(id, v.x);
    const cy = v.y - v.img.displayHeight / 2;
    s.fx.burst(v.x, cy, ENEMY_COL[v.sprite] ?? WHITE, 18, true, 1.3);
    s.fx.burst(v.x, cy, WHITE, 8, true, 1.1, true);
    s.fx.ring(v.x, cy, 22, ENEMY_COL[v.sprite] ?? WHITE, true);
    s.app.audio.split();
  }

  /** A linked summon runs off when its summoner falls. */
  flee(enemyId: number): void {
    const v = this.enemies.get(enemyId);
    if (v && !v.dieAt) v.fleeAt = this.s.anim;
  }

  heroReturn(): void {
    const h = this.h;
    if (h.state === 'idle') return;
    h.state = 'return';
    h.fromX = h.x;
    h.toX = this.s.heroHome;
    h.t0 = this.s.anim;
  }

  enemyLunge(id: number, strength: number): void {
    const v = this.enemies.get(id);
    if (!v || v.dieAt) return;
    const reach = Math.max(10, v.homeX - v.img.displayWidth / 2 - (this.h.x + 20));
    v.lunge = { t0: this.s.anim, dist: reach * strength, ms: 260 };
    this.setEnemyPose(v, 'attack', 200);
  }

  // ------------------------------------------------------------------ per frame

  updatePip(): void {
    const s = this.s;
    const P = this.pipAnim;
    const a = s.anim;
    const homeX = this.h.x - 30;
    const homeY = s.ground - 24 + Math.sin(a / 260) * 2;
    let tex = Math.floor(a / 110) % 2 ? 'pip_idle1' : 'pip_idle0';
    if (P.state === 'swoop') {
      const k = clamp01((a - P.t0) / PIP_SWOOP_MS);
      P.x = P.fromX + (P.toX - P.fromX) * ease(k);
      P.y = P.fromY + (P.toY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 10;
      tex = 'pip_dive';
    } else if (P.state === 'back') {
      const k = clamp01((a - P.t0) / PIP_BACK_MS);
      P.x = P.fromX + (homeX - P.fromX) * ease(k);
      P.y = P.fromY + (homeY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 14;
      if (k >= 1) P.state = 'idle';
    } else {
      P.x += (homeX - P.x) * 0.12;
      P.y = homeY;
    }
    // Pip joins in Act 1's opening scene, not before
    const beforePip = s.app.storyId === 'intro';
    this.pip.setTexture(tex).setPosition(Math.round(P.x), Math.round(P.y)).setVisible(s.app.tuning.companion.everyHits > 0 && !beforePip);
  }

  updateHero(): void {
    const s = this.s;
    const h = this.h;
    const a = s.anim;
    let yOff = 0;
    if (h.state === 'dash') {
      const k = clamp01((a - h.t0) / DASH_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      if (k >= 1) h.state = 'engaged';
    } else if (h.state === 'leap') {
      const k = clamp01((a - h.t0) / LEAP_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      yOff = -Math.sin(k * Math.PI) * 24;
      if (k >= 1) h.state = 'engaged';
    } else if (h.state === 'super') {
      const k = clamp01((a - h.t0) / this.superMs);
      if (k < 0.3) h.x = h.fromX + (h.toX - h.fromX) * ease(k / 0.3);
      else if (k < 0.75) h.x = h.toX + Math.sin(a / 25) * 3;
      else h.x = h.toX + (s.heroHome - h.toX) * ease((k - 0.75) / 0.25);
      if (k >= 1) {
        h.state = 'idle';
        h.x = s.heroHome;
      }
    } else if (h.state === 'return') {
      const k = clamp01((a - h.t0) / RETURN_MS);
      h.x = h.fromX + (h.toX - h.fromX) * ease(k);
      if (k >= 1) {
        h.state = 'idle';
        h.x = s.heroHome;
      }
    } else if (h.state === 'engaged' && a - h.lastAction > ENGAGE_MS) this.heroReturn();

    let pose: string;
    let flip = false;
    if (a < h.hurtUntil) pose = 'hurt';
    else if (h.state === 'leap') pose = a - h.t0 < LEAP_MS * 0.7 ? 'leap' : 'slashA';
    else if (a < h.poseUntil) pose = h.pose;
    else if (h.state === 'dash') pose = 'dash';
    else if (h.state === 'return') {
      pose = 'dash';
      flip = true;
    } else if (h.state === 'engaged') pose = 'windup';
    else pose = Math.floor(a / 420) % 2 ? 'idle1' : 'idle0';
    const knock = a < h.hurtUntil ? -4 : 0;
    h.y = yOff;
    const spinning = h.state === 'super' && a - h.t0 > this.superMs * 0.06 && a - h.t0 < this.superMs * 0.94;
    this.hero.setVisible(!spinning);
    this.hero.setTexture(`hero_${pose}`);
    this.hero.setFlipX(flip);
    this.hero.setOrigin((flip ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W, 1);
    // a small forward lunge on every slash
    const lk = (a - h.lungeAt) / 90;
    const lunge = lk >= 0 && lk < 1 ? Math.round(4 * Math.sin(lk * Math.PI)) : 0;
    this.hero.setPosition(Math.round(h.x + knock + lunge), Math.round(s.ground + yOff));
    // afterimages while dashing, returning or leaping
    const moving = (h.state === 'dash' || h.state === 'return' || h.state === 'leap' || (h.state === 'super' && !spinning)) && this.hero.visible;
    const last = this.ghostTrail[this.ghostTrail.length - 1];
    if (moving && (!last || a - last.at > 22)) {
      this.ghostTrail.push({ x: this.hero.x, y: this.hero.y, tex: `hero_${pose}`, flip, at: a });
      if (this.ghostTrail.length > 3) this.ghostTrail.shift();
    }
    this.ghosts.forEach((gh, i) => {
      const tr = this.ghostTrail[this.ghostTrail.length - 1 - i];
      const age = tr ? a - tr.at : 1e9;
      if (!tr || age > 140) return void gh.setVisible(false);
      gh.setTexture(tr.tex).setFlipX(tr.flip).setOrigin(this.hero.originX, 1).setPosition(tr.x, tr.y);
      gh.setTint(i === 0 ? 0xbfe8ff : 0x6ab4ff).setAlpha((0.5 - i * 0.14) * (1 - age / 140)).setVisible(true);
    });
    if (a < h.flashUntil) this.hero.setTint(h.flashColor).setTintMode(Phaser.TintModes.FILL);
    else this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  clearShadows(): void {
    this.gShadow.clear();
  }

  /** Ground shadows, the Keen Edge sparkle, and every enemy (walk-in, lunge, knockback, squash, death charge, HP bars). */
  drawActors(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const c = run.combat;
    const sh = this.gShadow;
    const shadow = (x: number, w: number, alpha = 0.35) => {
      sh.fillStyle(0x000000, alpha);
      sh.fillRect(Math.round(x - w / 2), s.ground - 1, Math.round(w), 2);
      sh.fillRect(Math.round(x - w / 2 + 2), s.ground + 1, Math.round(w - 4), 1);
    };
    shadow(this.h.x + 1, 16 * (1 + this.h.y / 60), 0.3);
    if (run.hero.abilityTimer > 0 && Math.floor(now / 90) % 2 === 0) {
      g.fillStyle(0x9af0a0, 1);
      for (let i = 0; i < 2; i++) g.fillRect(Math.round(this.h.x + rand(-11, 11)), Math.round(s.ground - rand(3, 30)), 1, 2);
    }
    if (!c) return;
    const target = c.currentTarget();
    const a = s.anim;
    for (const v of this.enemies.values()) {
      const e = c.enemyById(v.id);
      if (!e) continue;
      // summons and splits rearrange the row: everyone slides to their new spot
      if (e.alive && !v.dieAt) v.homeX += (this.homeFor(e.slot, c) - v.homeX) * 0.12;
      let x = v.homeX;
      let walkBob = 0;
      if (v.enterAt) {
        const k = (a - v.enterAt) / (v.enterFrom < GAME_W ? 260 : ENTER_MS);
        if (k >= 1) v.enterAt = 0;
        else {
          x = v.enterFrom + (v.homeX - v.enterFrom) * ease(clamp01(k));
          walkBob = v.enterFrom < GAME_W ? Math.round(Math.sin(clamp01(k) * Math.PI) * 8) : Math.floor(a / 90) % 2;
        }
      }
      if (v.popAt) {
        // split apart: a quick white swell, then gone
        const q = (a - v.popAt) / 160;
        if (q >= 1) {
          v.img.setVisible(false);
          continue;
        }
        v.img.setTexture(`${v.sprite}_flash`).setScale(SPRITE_SCALE * (1 + 0.5 * q), SPRITE_SCALE * (1 - 0.3 * q)).setPosition(Math.round(x), v.y).setAlpha(1 - q);
        continue;
      }
      if (v.fleeAt) {
        // runs off to the right, facing away
        const q = (a - v.fleeAt) / 600;
        if (q >= 1) {
          v.img.setVisible(false);
          continue;
        }
        const fx = x + (GAME_W + 40 - x) * q * q;
        v.img.setTexture(`${v.sprite}_${Math.floor(a / 80) % 2 ? 'idle0' : 'attack'}`).setFlipX(true).setScale(SPRITE_SCALE).setPosition(Math.round(fx), v.y - (Math.floor(a / 70) % 2)).setAlpha(1);
        if (Math.random() < 0.3) s.fx.burst(fx - 4, s.ground - 1, 0xd8c8a0, 1, true, 0.4);
        continue;
      }
      if (v.lunge) {
        const k = (a - v.lunge.t0) / v.lunge.ms;
        if (k >= 1) v.lunge = null;
        else x -= v.lunge.dist * (k < 0.3 ? ease(k / 0.3) : 1 - ease((k - 0.3) / 0.7));
      }
      // spring knockback: pushed away from the hero, overshoots back, settles
      const kk = (a - v.kickAt) / 260;
      if (kk >= 0 && kk < 1) x += Math.round(v.kickDist * Math.exp(-4.5 * kk) * Math.cos(kk * Math.PI * 2.2));
      v.x = x;
      const flash = a < v.flashUntil;
      let pose = a < v.poseUntil ? v.pose : Math.floor((a + v.phase) / 380) % 2 ? 'idle1' : 'idle0';
      const has = (p: string) => s.textures.exists(`${v.sprite}_${p}`);
      // a special's wind-up, a raised guard and a closed shell hold their own poses
      if (a < v.tellUntil && has('tell')) pose = 'tell';
      else if (e.guard > 0 && has('guard') && pose !== 'hurt') pose = 'guard';
      else if (e.shell < 1 && has('shell') && pose !== 'hurt') pose = 'shell';
      if (flash) pose = 'flash';
      if (v.dieAt) {
        // charge: flicker between white and hurt, swell and tremble, then burst (the pixels take over)
        const q = (a - v.dieAt) / DEATH_CHARGE_MS;
        if (q >= 1) {
          v.img.setVisible(false);
          continue;
        }
        const flick = Math.floor((a - v.dieAt) / 35) % 2 === 0;
        v.img.setTexture(`${v.sprite}_${flick ? 'flash' : 'hurt'}`).setAlpha(1).setVisible(true);
        v.img.setScale(SPRITE_SCALE * (1 + 0.2 * q), SPRITE_SCALE * (1 + 0.14 * q));
        v.img.setPosition(Math.round(x + rand(-1.5, 1.5)), v.y);
        continue;
      }
      // squash on impact: wide and short for a few frames, then a little stretch back
      const sq = (a - v.kickAt) / 150;
      const amt = sq >= 0 && sq < 1 ? Math.sin(sq * Math.PI) * (sq < 0.5 ? 0.16 : -0.06) * Math.min(1.6, v.kickDist / 8) : 0;
      const hover = v.fly ? Math.round(Math.sin((a + v.phase) / 260) * 2) : 0;
      const tellK = a < v.tellUntil ? (a - v.tellAt) / Math.max(1, v.tellUntil - v.tellAt) : -1;
      const tremble = tellK > 0.6 ? Math.round(Math.sin(a / 18)) : 0; // shakes as the special is about to land
      v.img.setTexture(`${v.sprite}_${pose}`).setFlipX(false).setPosition(Math.round(x) + tremble, v.y - walkBob + hover).setScale(SPRITE_SCALE * (1 + amt), SPRITE_SCALE * (1 - amt)).setAlpha(1);
      // the boss enraged: a red pulse
      if (e.phase >= 3) v.img.setTint(Math.floor(a / 160) % 2 ? 0xffb0a0 : 0xffffff);
      else v.img.clearTint();
      shadow(x, v.img.displayWidth * (v.fly ? 0.5 : 0.8), v.fly ? 0.2 : 0.3);
      const cy = v.y - v.img.displayHeight / 2;
      if (tellK >= 0) {
        // the countdown: a ring closing in on the enemy, and a bouncing "!"
        const r = Math.round(8 + (1 - tellK) * 18 + v.img.displayWidth * 0.3);
        const col = Math.floor(a / 90) % 2 ? 0xff5a3a : 0xffd23a;
        g.fillStyle(col, 0.35 + 0.5 * tellK);
        const n = Math.max(16, r * 2);
        for (let i = 0; i < n; i++) {
          if (i % 3 === 2) continue;
          const ang = (i / n) * Math.PI * 2 + a / 400;
          g.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.7), 2, 1);
        }
        const ex = Math.round(x);
        const ey = Math.round(v.y - v.img.displayHeight - 8 - Math.abs(Math.sin(a / 110)) * 3);
        g.fillStyle(INK, 1);
        g.fillRect(ex - 2, ey - 1, 5, 8);
        g.fillRect(ex - 2, ey + 8, 5, 4);
        g.fillStyle(col, 1);
        g.fillRect(ex - 1, ey, 3, 6);
        g.fillRect(ex - 1, ey + 9, 3, 2);
      }
      if (e.protect < 1 && c.summonsAlive(e.id)) {
        // shielded by its summons: a golden aura
        const n = 40;
        const rx = v.img.displayWidth * 0.62;
        const ry = v.img.displayHeight * 0.62;
        for (let i = 0; i < n; i++) {
          if ((i + Math.floor(a / 120)) % 4 >= 2) continue;
          const ang = (i / n) * Math.PI * 2;
          g.fillStyle(0xffe680, 0.7);
          g.fillRect(Math.round(x + Math.cos(ang) * rx), Math.round(cy + Math.sin(ang) * ry), 1, 1);
        }
      }
      if (e.shell < 1) {
        // a shell bubble while its ward blocks stand
        g.fillStyle(0x7af0e0, 0.25 + 0.15 * Math.sin(a / 150));
        g.fillCircle(Math.round(x), Math.round(cy), Math.round(v.img.displayWidth * 0.55));
      }
      if (a >= this.superFinalAt) v.hpShown += (e.hp - v.hpShown) * 0.25;
      if (c.enemies.length > 1 && e.alive) {
        const bw = Math.max(26, Math.round(v.img.displayWidth * 0.7));
        const bx = Math.round(v.homeX - bw / 2);
        const by = Math.round(v.y - v.img.displayHeight - 8);
        hpBar(g, bx, by, bw, 3, e.hp / e.maxHp, v.hpShown / e.maxHp, 0xe0463c);
        const def = s.app.tuning.enemies[e.key];
        const isTarget = target?.id === e.id;
        icon(g, FOE_ICONS[def.icon] ?? ICONS.drop, bx - 9, by - 2, 0xff8a7a);
        if (isTarget) {
          const tx = Math.round(v.homeX);
          const ty = by - 8 + (Math.floor(now / 250) % 2);
          g.fillStyle(WHITE, 1);
          g.fillRect(tx - 3, ty, 7, 1);
          g.fillRect(tx - 2, ty + 1, 5, 1);
          g.fillRect(tx - 1, ty + 2, 3, 1);
          g.fillRect(tx, ty + 3, 1, 1);
        }
      }
    }
  }

  /**
   * Finisher special: the sky swaps to a streaked backdrop while the hero whirls through the enemies. Its colors
   * heat up with the stacks spent (blue, violet, gold, crimson, then a cycling rainbow), with radial speed lines.
   */
  drawSuper(now: number): void {
    const s = this.s;
    const g = this.gSuper;
    g.clear();
    const k = (s.anim - this.superAt) / this.superMs;
    if (k < 0 || k >= 1) return;
    const n = this.superStacks;
    const alpha = k < 0.08 ? k / 0.08 : k > 0.86 ? (1 - k) / 0.14 : 1;
    const bottom = s.ground - 8;
    const PAL: Record<number, number[]> = {
      1: [0x1022a8, 0x1a3cc8, 0x2a62dc, 0x3a8ae8, 0x48b4f0, 0x5ad8f4],
      2: [0x2a0e6a, 0x441a9a, 0x6a2ac8, 0x8a4ae0, 0xb07af0, 0xd8b0ff],
      3: [0x6a2a08, 0x9a420a, 0xc86a10, 0xe8941a, 0xf8c040, 0xffe890],
      4: [0x5a0a1e, 0x8a1230, 0xb81c3e, 0xe0344e, 0xf86a6a, 0xffb0a0],
    };
    let bands = PAL[Math.min(4, n)];
    if (n >= 5) {
      // white-hot: cycle through every palette
      const cyc = [PAL[1], PAL[2], PAL[3], PAL[4]];
      bands = cyc[Math.floor(s.anim / 90) % cyc.length];
    }
    const bh = Math.ceil(bottom / bands.length);
    bands.forEach((col, i) => {
      g.fillStyle(col, alpha);
      g.fillRect(0, i * bh, GAME_W, Math.min(bh, bottom - i * bh));
    });
    const lines = 14 + n * 4;
    const hiCol = stackCol(n)[1];
    for (let i = 0; i < lines; i++) {
      const y = 4 + ((i * 37) % Math.max(1, bottom - 8));
      const len = 18 + ((i * 53) % 46) + n * 4;
      const speed = 0.5 + (i % 3) * 0.25 + n * 0.08;
      const x = ((((i * 97 - now * speed) % (GAME_W + 80)) + GAME_W + 80) % (GAME_W + 80)) - 40;
      g.fillStyle(i % 3 === 0 ? hiCol : WHITE, alpha * (i % 2 ? 0.85 : 0.5));
      g.fillRect(Math.round(x), y, len, i % 4 === 0 ? 2 : 1);
    }
    // whirlwind where the hero is
    const h = this.h;
    if (h.state !== 'super') return;
    const fx = s.gFx;
    const cx = h.x + 2;
    const [c1, c2] = stackCol(n);
    // a tornado: stacked spinning rings, wider at the top (taller with more stacks)
    for (let arc = 0; arc < 4 + n; arc++) {
      const base = s.anim / 30 + arc * 1.7;
      const r = 7 + arc * 4;
      const cy = s.ground - 4 - arc * 6;
      for (let j = 0; j < 18; j++) {
        const ang = base + j * 0.17;
        fx.fillStyle(j < 6 ? WHITE : j < 12 ? c2 : c1, 1 - j / 20);
        fx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.35), 3, 2);
      }
    }
    if (Math.random() < 0.5) s.fx.burst(cx, s.ground - 2, 0xd8c8a0, 1, true, 0.6);
  }
}
