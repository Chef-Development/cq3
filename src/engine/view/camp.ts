// The camp (phase 'camp'): the heroes and Pip by a crackling campfire under the night sky (Rowan, and Sable once
// they've joined), Mags the smith at her forge, fireflies, embers and chimney smoke. The buildings are tap targets
// with name plates (Bag, Forge, and the Shrine, locked for now); a band along the bottom has Bag, Forge, Skills (a
// gold "!" when the picked hero has points to spend) and Relics (a red count of new ones). The top left shows the
// picked hero (face, name, level, XP): tapping it, or a hero by the fire, opens the hero select; the top right the
// purse and the scrap. "Back" (named for where it goes: the world map, the next act, a retry) leaves.
// Each opens a screen over the dimmed, still-living camp: bag.ts, forge.ts, heroes.ts (Stats from there: stats.ts),
// skills.ts, relic-log.ts. The first visit to the forge plays Mags's intro scene, and the first visit after Act 1
// plays Sable's (the story view draws them; input routes taps to them).
import type Phaser from 'phaser';
import { HEROES, type HeroId } from '../../data/heroes';
import { itemPower } from '../../core/gear';
import { equippedItems } from '../../core/profile';
import type { FightScene } from '../scene';
import { CAMP_SPOTS } from '../art-camp';
import { textWidth } from '../font';
import { BagScreen } from './bag';
import { CampKit, D, GOLD_TXT, pix, pixSize } from './camp-kit';
import { ForgeScreen } from './forge';
import { HeroesScreen } from './heroes';
import { padlock } from './items';
import { button3d, chevron, gauge, glow, GOLD, rows } from './pixels';
import { RelicLogScreen } from './relic-log';
import { clamp01, easeBack, inRect, INK, pulse, rand, WHITE, type Rect } from './shared';
import { SkillsScreen } from './skills';
import { StatsScreen } from './stats';
import { FACE, isPressed, notePress } from './ui';

type G = Phaser.GameObjects.Graphics;
type Mode = 'home' | 'bag' | 'forge' | 'stats' | 'heroes' | 'skills' | 'relics';
type Spot = 'bag' | 'forge' | 'skills' | 'relics' | 'shrine' | 'leave';

/** Where Sable sits by the fire (the art's spot once it's drawn; until then across the fire from Rowan). */
const sableSpot = (): { x: number; y: number } => (CAMP_SPOTS as Record<string, { x: number; y: number }>).sable ?? { x: 176, y: 122 };

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  color: number;
  sway: number;
}
interface Puff {
  x: number;
  y: number;
  born: number;
  life: number;
  size: number;
  drift: number;
}

// fireflies: a home spot each, wandering in slow loops and blinking
const FLIES = Array.from({ length: 9 }, (_, i) => ({
  x: 20 + ((i * 97) % 290),
  y: 30 + ((i * 53) % 70),
  ax: 6 + (i % 4) * 3,
  ay: 4 + (i % 3) * 2,
  f1: 0.00031 + (i % 5) * 0.00007,
  f2: 0.00047 + (i % 3) * 0.00009,
  ph: i * 1.7,
  blink: 1800 + (i % 4) * 500,
}));

// the fire's frames in an uneven order (a lively flicker, not a loop)
const FIRE_SEQ = [0, 1, 2, 1, 3, 2, 0, 3, 1, 2];

export class CampView {
  private bg: Phaser.GameObjects.Image | null = null;
  readonly kit: CampKit;
  readonly bag: BagScreen;
  readonly forge: ForgeScreen;
  readonly stats: StatsScreen;
  readonly heroes: HeroesScreen;
  readonly skills: SkillsScreen;
  readonly relics: RelicLogScreen;
  mode: Mode = 'home';
  /** Where a screen's Back goes (Stats opened from the hero select goes back there). */
  private backTo: Mode = 'home';
  private modeAt = 0;
  /** Sable was on screen last frame (they appear in a puff of smoke when their scene ends). */
  private sableShown = false;
  private sableAt = -1e9;
  private embers: Ember[] = [];
  private puffs: Puff[] = [];
  private lastPuff = 0;
  private lastEmber = 0;
  private shrineAt = -1e9;
  private fireAt = -1e9;
  private pipAt = -1e9;
  private smithSwing = 0;
  private nextSwing = 0;
  /** Rowan's gear power when the home was last on screen: coming back with better gear makes him sparkle. */
  private power = 0;

  constructor(private readonly s: FightScene) {
    this.kit = new CampKit(s);
    this.bag = new BagScreen(this.kit);
    this.forge = new ForgeScreen(this.kit);
    this.stats = new StatsScreen(this.kit);
    this.heroes = new HeroesScreen(this.kit);
    this.skills = new SkillsScreen(this.kit);
    this.relics = new RelicLogScreen(this.kit);
  }

  build(): void {
    this.bg?.destroy();
    this.bg = this.s.add.image(0, 0, 'camp_bg').setOrigin(0, 0).setDepth(D.bg).setVisible(false);
    this.kit.build();
  }

  onPhase(next: string): void {
    if (next !== 'camp') return;
    const now = performance.now();
    this.mode = 'home';
    this.modeAt = now;
    this.kit.syncPurse();
    this.kit.fx.clear();
    this.kit.toastNow = null;
    this.nextSwing = now + 1500;
    this.power = this.gearPower();
    // the first visit after Act 1: Sable tries to rob the camp, gets caught by Pip, and joins (their scene plays
    // over the camp the way Mags's does; skipping it still counts)
    const app = this.s.app;
    if (app.run.campScene === 'sableJoin') {
      app.run.sableJoined();
      app.saveProfile();
      app.storyBox = 0;
      app.storyOverlay = 'sableJoin';
    }
    this.sableShown = this.sableHere();
    this.sableAt = -1e9;
  }

  /** Sable sits by the fire once they've joined (not while their arrival scene is still playing). */
  private sableHere(): boolean {
    const app = this.s.app;
    return app.run.profile.sableMet && app.storyOverlay !== 'sableJoin';
  }

  // ------------------------------------------------------------------ layout (home)

  /** Where "Back" goes, as its label: the world map, the next act (after an act clear), or a retry. */
  private leaveLabel(): string {
    const run = this.s.app.run;
    if (run.campFrom === 'defeat') return 'Retry';
    if (run.campFrom === 'actClear') return run.actIndex + 1 < run.region.acts.length ? `Act ${run.actIndex + 2}` : 'Continue';
    return 'World map';
  }

  private band(): Array<{ id: Spot; r: Rect; label: string; icon: string }> {
    const s = this.s;
    const y = s.B - 19;
    const out: Array<{ id: Spot; r: Rect; label: string; icon: string }> = [];
    let x = s.L + 3;
    for (const [id, label, icon] of [
      ['bag', 'Bag', 'bag'],
      ['forge', 'Forge', 'hammer'],
      ['skills', 'Skills', 'skills'],
      ['relics', 'Relics', 'relic'],
    ] as const) {
      const w = textWidth(label, 1, true) + pixSize(icon)[0] + 8;
      out.push({ id, r: { x, y, w, h: 15 }, label, icon });
      x += w + 3;
    }
    const label = this.leaveLabel();
    const w = textWidth(label, 1, true) + 18;
    out.push({ id: 'leave', r: { x: s.R - 3 - w, y, w, h: 15 }, label, icon: '' });
    return out;
  }

  /**
   * Name plate over a building: centred above its rect, kept on screen. A plate that would overlap one before it
   * (buildings close together, or pushed in from the screen's edge) sits on its building's roof instead.
   */
  private plate(id: 'bag' | 'forge' | 'shrine'): Rect {
    const s = this.s;
    const all: Rect[] = [];
    for (const k of ['bag', 'forge', 'shrine'] as const) {
      const b = CAMP_SPOTS[k];
      const label = k === 'bag' ? 'Bag' : k === 'forge' ? 'Forge' : 'Shrine';
      const icon = k === 'bag' ? 'bag' : k === 'forge' ? 'hammer' : 'shrine';
      const w = textWidth(label, 1, true) + pixSize(icon)[0] + 9 + (k === 'shrine' ? 8 : 0);
      const h = 13;
      const x = Math.round(Math.max(s.L + 2, Math.min(s.R - 2 - w, b.x + b.w / 2 - w / 2)));
      let r = { x, y: Math.max(24, b.y - h - 6), w, h };
      if (all.some((o) => r.x < o.x + o.w + 3 && o.x < r.x + r.w + 3 && r.y < o.y + o.h + 3 && o.y < r.y + r.h + 3)) r = { ...r, y: b.y + 4 };
      all.push(r);
      if (k === id) return r;
    }
    return all[0];
  }

  /** What Rowan's worn gear adds up to (the bag's "Gear power"). */
  private gearPower(): number {
    const p = this.s.app.run.profile;
    return equippedItems(p).reduce((a, i) => a + itemPower(this.s.app.run.tuning, i), 0);
  }

  private rowanRect(): Rect {
    const [w, h] = this.kit.imgs.size('camp_rowan0');
    const p = CAMP_SPOTS.rowan;
    const W = Math.max(w + 8, 18);
    const H = Math.max(h + 8, 24);
    return { x: p.x - W / 2, y: p.y - H + 3, w: W, h: H };
  }

  /** Sable's sprite: their own once drawn, else Rowan's camp pose as a shadow turned to face the fire. */
  private sableArt(f: number): { key: string; own: boolean } {
    const own = this.kit.has(`camp_sable${f}`);
    return { key: own ? `camp_sable${f}` : `camp_rowan${f}`, own };
  }

  private sableRect(): Rect {
    const [w, h] = this.kit.imgs.size(this.sableArt(0).key);
    const p = sableSpot();
    const W = Math.max(w + 8, 18);
    const H = Math.max(h + 8, 24);
    return { x: p.x - W / 2, y: p.y - H + 3, w: W, h: H };
  }

  /** The hero chip, top left: the picked hero's face, name, level and XP (tap: the hero select). */
  private chipRect(): Rect {
    const id = this.s.app.run.profile.hero;
    const lv = this.kit.level(id).level;
    const tw = textWidth(HEROES[id].name, 1, true) + 4 + textWidth(`Lv ${lv}`, 1, false);
    return { x: this.s.L + 3, y: 3, w: 23 + Math.max(tw, 52) + 6, h: 21 };
  }

  /** The name plate over a hero by the fire. */
  private heroPlate(id: HeroId): Rect {
    const rr = id === 'sable' ? this.sableRect() : this.rowanRect();
    const picked = this.s.app.run.profile.hero === id;
    const w = textWidth(HEROES[id].name, 1, false) + 6 + (picked ? 8 : 0);
    return { x: Math.round(rr.x + rr.w / 2 - w / 2), y: Math.round(rr.y - 9), w, h: 9 };
  }

  private pipRect(): Rect {
    const [w, h] = this.kit.imgs.size('camp_pip0');
    const p = CAMP_SPOTS.pip;
    return { x: p.x - w / 2 - 3, y: p.y - h - 3, w: w + 6, h: h + 6 };
  }

  private fireRect(): Rect {
    const [w, h] = this.kit.imgs.size('camp_fire0');
    const p = CAMP_SPOTS.fire;
    return { x: p.x - w / 2 - 3, y: p.y - h - 2, w: w + 6, h: h + 4 };
  }

  private smithRect(): Rect {
    const [w, h] = this.kit.imgs.size('smith_idle0');
    const p = CAMP_SPOTS.smith;
    return { x: p.x - w / 2 - 2, y: p.y - h - 2, w: w + 4, h: h + 4 };
  }

  // ------------------------------------------------------------------ taps

  /** A tap on the camp (x < 0: the keyboard's default action). */
  tap(x: number, y: number): void {
    const app = this.s.app;
    const now = performance.now();
    if (now - this.modeAt < 180) return;
    if (this.mode !== 'home') {
      const res = this.screen().tap(x, y, now);
      if (res === 'back') this.go(this.mode === 'stats' ? this.backTo : 'home', now);
      else if (res === 'stats') this.go('stats', now, this.heroes.view);
      return;
    }
    if (x < 0) {
      app.audio.uiClick();
      app.leaveCamp();
      return;
    }
    for (const b of this.band())
      if (inRect(b.r, x, y, 2)) {
        notePress(b.r);
        return this.open(b.id, now);
      }
    for (const id of ['bag', 'forge', 'shrine'] as const) if (inRect(this.plate(id), x, y, 3)) return this.open(id, now);
    const chip = this.chipRect();
    if (inRect(chip, x, y, 2)) {
      notePress(chip);
      return this.go('heroes', now);
    }
    if (this.sableHere() && (inRect(this.sableRect(), x, y) || inRect(this.heroPlate('sable'), x, y, 2))) return this.go('heroes', now, 'sable');
    if (inRect(this.rowanRect(), x, y) || inRect(this.heroPlate('rowan'), x, y, 2)) return this.go('heroes', now, 'rowan');
    if (inRect(this.pipRect(), x, y)) {
      this.pipAt = now;
      app.audio.textBlip();
      const r = this.pipRect();
      this.kit.fx.float('Hoo!', r.x + r.w / 2, r.y - 6, 0x9ad8ff, { life: 900 });
      return;
    }
    if (inRect(this.fireRect(), x, y)) {
      this.fireAt = now;
      app.audio.swish();
      const p = CAMP_SPOTS.fire;
      for (let i = 0; i < 24; i++) this.ember(now, p.x + rand(-4, 4), p.y - rand(4, 10), rand(-30, 30), rand(-70, -35));
      return;
    }
    if (inRect(this.smithRect(), x, y)) return this.open('forge', now);
    for (const id of ['bag', 'forge', 'shrine'] as const) {
      const b = CAMP_SPOTS[id];
      if (inRect(b, x, y)) return this.open(id, now);
    }
  }

  private open(id: Spot, now: number): void {
    if (id === 'skills' || id === 'relics') return this.go(id, now);
    const app = this.s.app;
    if (id === 'leave') {
      app.audio.uiClick();
      app.leaveCamp();
      return;
    }
    if (id === 'shrine') {
      this.shrineAt = now;
      app.audio.lockToggle();
      return;
    }
    this.go(id, now);
  }

  /** The screen on view (not the home). */
  private screen(): { tap(x: number, y: number, now: number): 'back' | 'stats' | void; draw(now: number): void } {
    switch (this.mode) {
      case 'bag':
        return this.bag;
      case 'forge':
        return this.forge;
      case 'heroes':
        return this.heroes;
      case 'skills':
        return this.skills;
      case 'relics':
        return this.relics;
      default:
        return this.stats;
    }
  }

  go(mode: Mode, now: number, hero?: HeroId): void {
    const app = this.s.app;
    const p = app.run.profile;
    this.backTo = mode === 'stats' && this.mode === 'heroes' ? 'heroes' : 'home';
    const from = this.mode;
    this.mode = mode;
    this.modeAt = now;
    this.kit.toastNow = null;
    if (from === 'stats' && mode === 'heroes') {
      // back from a hero's stats: the hero select as it was
      app.audio.panelClose();
      return;
    }
    if (mode === 'home') {
      app.audio.panelClose();
      // back by the fire in new gear: Rowan sparkles and his gear power pops
      const gp = this.gearPower();
      if (gp !== this.power) {
        const d = gp - this.power;
        this.power = gp;
        const r = this.rowanRect();
        this.kit.after(260, () => {
          this.kit.fx.burst(r.x + r.w / 2, r.y + r.h / 2, d > 0 ? [0xfff0a0, 0xffd23a, WHITE, 0x8af06a] : [0xb0a8c8, WHITE], 20, 0.8, { kind: 'star', g: -20, life: 900 });
          this.kit.fx.ring(r.x + r.w / 2, r.y + r.h / 2, 18, d > 0 ? 0xfff0a0 : 0xb0a8c8, 500);
          this.kit.fx.float(`Gear power ${d > 0 ? '+' : ''}${d}!`, r.x + r.w / 2, r.y - 12, d > 0 ? 0x8af06a : 0xff8a7a, { life: 1800 });
          if (d > 0) app.audio.coin();
        });
      }
      return;
    }
    app.audio.panelOpen();
    if (mode === 'bag') this.bag.open(now);
    else if (mode === 'stats') this.stats.open(now, hero);
    else if (mode === 'heroes') this.heroes.open(now, hero);
    else if (mode === 'skills') this.skills.open(now);
    else if (mode === 'relics') this.relics.open(now);
    else if (mode === 'forge') {
      this.forge.open(now);
      if (!p.smithMet) {
        // the first visit: Mags introduces herself (the story view draws it over the forge)
        p.smithMet = true;
        app.saveProfile();
        app.storyBox = 0;
        app.storyOverlay = 'smith';
      }
    }
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const s = this.s;
    const kit = this.kit;
    if (s.app.run.phase !== 'camp') {
      this.bg?.setVisible(false);
      kit.hide();
      return;
    }
    kit.begin(now);
    this.bg?.setVisible(true);
    this.drawScene(now);
    if (this.mode === 'home') this.drawHome(now);
    else {
      const k = clamp01((now - this.modeAt) / 160);
      kit.dim(kit.gUi, 0.62 * k);
      this.screen().draw(now);
    }
    kit.end(now);
  }

  private ember(now: number, x: number, y: number, vx: number, vy: number): void {
    const c = [0xffb03a, 0xffe680, 0xff6a2a, 0xfff0a0];
    this.embers.push({ x, y, vx, vy, born: now, life: rand(700, 1500), color: c[Math.floor(Math.random() * c.length)], sway: rand(0, 6) });
    if (this.embers.length > 90) this.embers.shift();
  }

  /** The living camp: fire, glow, embers, smoke, fireflies, Rowan, Pip and Mags. */
  private drawScene(now: number): void {
    const kit = this.kit;
    const gb = kit.gBack;
    const gf = kit.gFront;
    const im = kit.imgs;
    const S = CAMP_SPOTS;
    // the fire's warm glow (flaring when poked)
    const flare = clamp01(1 - (now - this.fireAt) / 700);
    const fx = S.fire.x;
    const fy = S.fire.y - 6;
    for (const [r, a] of [
      [44, 0.05],
      [30, 0.07],
      [19, 0.1],
      [11, 0.12],
    ] as const) {
      gb.fillStyle(0xff9a3a, a + 0.025 * Math.sin(now / 95 + r) + flare * 0.05);
      gb.fillCircle(fx, fy, r + Math.sin(now / 70 + r) * 1.5 + flare * 6);
    }
    // smoke from the forge's chimney (its top right), rising and spreading
    const chimney = { x: S.forge.x + Math.round(S.forge.w * 0.78), y: S.forge.y + 2 };
    if (now - this.lastPuff > 420) {
      this.lastPuff = now;
      this.puffs.push({ x: chimney.x + rand(-1, 1), y: chimney.y, born: now, life: rand(2600, 3400), size: rand(2, 3), drift: rand(3, 7) });
      if (this.puffs.length > 14) this.puffs.shift();
    }
    for (const p of this.puffs) {
      const k = (now - p.born) / p.life;
      if (k >= 1) continue;
      const x = p.x + k * p.drift * 4 + Math.sin(now / 600 + p.born) * 1.5;
      const y = p.y - k * 34;
      const r = p.size + k * 6;
      const a = 0.32 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      gb.fillStyle(0x6a6478, a);
      gb.fillCircle(x, y, r);
      gb.fillStyle(0x9a94a8, a * 0.6);
      gb.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.6);
    }
    // fireflies drifting in loops, blinking
    for (const f of FLIES) {
      const x = f.x + Math.sin(now * f.f1 + f.ph) * f.ax * 2;
      const y = f.y + Math.cos(now * f.f2 + f.ph) * f.ay * 2;
      const b = pulse(now, f.blink, f.ph * 300);
      if (b < 0.25) continue;
      const a = (b - 0.25) / 0.75;
      gb.fillStyle(0xd8ff8a, 0.18 * a);
      gb.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      gb.fillStyle(0xf0ffc0, a);
      gb.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // the people: Rowan breathing by the fire, Pip perched (a hop when poked), Mags at her anvil
    const sitting = this.mode !== 'forge';
    im.foot(Math.floor(now / 680) % 2 ? 'camp_rowan1' : 'camp_rowan0', S.rowan.x, S.rowan.y, D.actors);
    // Sable across the fire once they've joined (they appear in a puff of smoke the moment their scene ends)
    const here = this.sableHere();
    if (here && !this.sableShown) this.sableArrives(now);
    this.sableShown = here;
    if (here) {
      const art = this.sableArt(Math.floor((now + 340) / 720) % 2);
      const [w, h] = im.size(art.key);
      const sp = sableSpot();
      kit.sprites.draw(art.key, sp.x - (w >> 1), sp.y - h, D.actors, { flip: !art.own, tint: art.own ? undefined : 0x6a5a9a, alpha: clamp01((now - this.sableAt) / 300) });
    }
    const hop = now - this.pipAt < 320 ? Math.round(Math.sin(((now - this.pipAt) / 320) * Math.PI) * 5) : 0;
    const pipF = hop || Math.floor(now / 2200) % 3 === 0 ? 'camp_pip1' : 'camp_pip0';
    im.foot(pipF, S.pip.x, S.pip.y - hop, D.actors);
    if (sitting) {
      let smith = Math.floor(now / 560) % 2 ? 'smith_idle1' : 'smith_idle0';
      if (now > this.nextSwing) {
        this.smithSwing = now;
        this.nextSwing = now + 3800 + Math.random() * 2600;
      }
      const sw = now - this.smithSwing;
      if (sw < 330) {
        const f = sw < 110 ? 0 : sw < 200 ? 1 : 2;
        smith = `smith_hammer${f}`;
        if (f === 2 && sw - 200 < 20) {
          const [w, h] = im.size('smith_idle0');
          const ax = S.smith.x + Math.round(w * 0.45);
          const ay = S.smith.y - Math.round(h * 0.3);
          for (let i = 0; i < 6; i++) this.ember(now, ax, ay, rand(-40, 40), rand(-60, -20));
        }
      }
      im.foot(smith, S.smith.x, S.smith.y, D.actors);
    }
    // the campfire's flames (taller when poked)
    im.foot(`camp_fire${FIRE_SEQ[Math.floor(now / 85) % FIRE_SEQ.length]}`, S.fire.x, S.fire.y, D.actors);
    // embers rising from the fire
    if (now - this.lastEmber > 70) {
      this.lastEmber = now;
      this.ember(now, fx + rand(-4, 4), S.fire.y - rand(6, 12), rand(-6, 6), rand(-34, -18));
    }
    this.embers = this.embers.filter((e) => now - e.born < e.life);
    for (const e of this.embers) {
      const t = (now - e.born) / 1000;
      const k = (now - e.born) / e.life;
      const x = e.x + e.vx * t + Math.sin(t * 4 + e.sway) * 2;
      const y = e.y + e.vy * t + 18 * t * t * (e.vy > -40 ? 0 : 1);
      gf.fillStyle(e.color, 1 - k * k);
      gf.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  /** Sable shows up by the fire: a puff of smoke, a sting, "Sable joined!". */
  private sableArrives(now: number): void {
    const kit = this.kit;
    const app = this.s.app;
    const sp = sableSpot();
    this.sableAt = now;
    kit.fx.burst(sp.x, sp.y - 12, [0x6a6478, 0x9a94a8, 0xd8d0f0, 0x4a4458], 34, 1.1, { kind: 'chip', g: -20, life: 800 });
    kit.fx.burst(sp.x, sp.y - 12, [0xdab0ff, WHITE], 12, 0.9, { kind: 'star', g: 20, life: 700 });
    kit.fx.ring(sp.x, sp.y - 12, 20, 0xdab0ff, 500);
    kit.fx.float('Sable joined!', sp.x, sp.y - 44, 0xdab0ff, { life: 2200 });
    app.audio.whoosh();
    kit.after(160, () => app.audio.rareSting(true));
  }

  /** The hero chip: the picked hero's face in a gold frame, name, level and an XP bar. */
  private drawChip(g: G, ty: number, now: number): void {
    const kit = this.kit;
    const texts = kit.homeTexts;
    const id = this.s.app.run.profile.hero;
    const c0 = this.chipRect();
    const c = { ...c0, y: ty + (isPressed(c0, now) ? 1 : 0) };
    this.glass(g, c.x, c.y, c.w, c.h, 1);
    const fx = c.x + 2;
    const fy = c.y + 2;
    rows(g, fx - 1, fy - 1, 19, 19, 2, INK);
    rows(g, fx, fy, 17, 17, 1, GOLD[2]);
    g.fillStyle(GOLD[4], 1);
    g.fillRect(fx + 1, fy, 15, 1);
    g.fillStyle(HEROES[id].family === 'twin' ? 0x3a2458 : 0x1a2c52, 1);
    g.fillRect(fx + 1, fy + 1, 15, 15);
    kit.face(id, fx + 1, fy + 1, D.homeText - 0.001, { size: 15 });
    const L = kit.level(id);
    const name = HEROES[id].name;
    texts.text(name, c.x + 23, c.y + 7, WHITE, { bold: true, oy: 0.5 });
    texts.text(`Lv ${L.level}`, c.x + 23 + textWidth(name, 1, true) + 4, c.y + 7.5, GOLD_TXT, { oy: 0.5 });
    gauge(g, c.x + 23, c.y + 14, c.w - 23 - 5, 3, L.need ? L.into / L.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a] });
  }

  /** The home's UI: the hero chip, purse and scrap, the name plates, the band of buttons. */
  private drawHome(now: number): void {
    const s = this.s;
    const kit = this.kit;
    const g = kit.gFront;
    const texts = kit.homeTexts;
    const since = now - this.modeAt;
    const p = s.app.run.profile;
    // top left: the picked hero (the hero select)
    const tk = easeBack(since / 280, 1.4);
    const ty = Math.round(3 - (1 - tk) * 24);
    this.drawChip(g, ty, now);
    // top right: the purse and the scrap
    kit.purse(g, texts, s.R - 3, ty + 1, now);

    // name plates over the buildings (they bob; the shrine's is padlocked)
    const fresh = p.items.filter((i) => i.fresh).length;
    (['bag', 'forge', 'shrine'] as const).forEach((id, i) => {
      const k = easeBack((since - 120 - i * 70) / 260, 1.8);
      if (k <= 0) return;
      const r0 = this.plate(id);
      const bob = Math.round(Math.sin(now / 520 + i * 1.3) * 1);
      const r = { ...r0, y: r0.y + bob - Math.round((1 - k) * 8) };
      const locked = id === 'shrine';
      const rattle = locked && now - this.shrineAt < 360 ? Math.round(Math.sin((now - this.shrineAt) / 25) * 2) : 0;
      this.glass(g, r.x + rattle, r.y, r.w, r.h, clamp01(k * 2), true, CAMP_SPOTS[id].x + CAMP_SPOTS[id].w / 2);
      const icon = id === 'bag' ? 'bag' : id === 'forge' ? 'hammer' : 'shrine';
      const [iw, ih] = pixSize(icon);
      pix(g, icon, r.x + 3 + rattle, r.y + Math.round((r.h - ih) / 2), locked ? 0.6 : 1);
      const label = id === 'bag' ? 'Bag' : id === 'forge' ? 'Forge' : 'Shrine';
      texts.text(label, r.x + iw + 5 + rattle, r.y + r.h / 2, locked ? 0xa8a0c0 : WHITE, { bold: true, oy: 0.5 });
      if (locked) padlock(g, r.x + r.w - 9 + rattle, r.y + 3, 1, 0xd8901c);
      if (id === 'bag' && fresh > 0) kit.bubble(g, texts, r.x + r.w - 2, r.y - 3, `${fresh}`, now);
    });
    // the shrine: a padlock on it, rattling when tapped, and its plate
    const sh = CAMP_SPOTS.shrine;
    const ssince = now - this.shrineAt;
    const shake = ssince < 360 ? Math.round(Math.sin(ssince / 22) * 2) : 0;
    const lx = Math.min(s.R - 8, sh.x + sh.w / 2);
    kit.imgs.mid('padlock', lx + shake, sh.y + sh.h / 2, D.actors + 0.001);
    if (ssince < 2200) {
      const a = Math.min(1, ssince / 100, (2200 - ssince) / 300);
      const title = 'The Shrine';
      const sub = 'Coming soon!';
      const w = Math.max(textWidth(title, 1, true), textWidth(sub, 1, false)) + 16;
      const x = Math.round(Math.min(s.R - 3 - w, lx - w / 2));
      const y = Math.round(sh.y + sh.h / 2 + 10 - (1 - easeBack(ssince / 220, 2)) * 4);
      this.glass(g, x, y, w, 22, a);
      texts.text(title, x + w / 2, y + 7, 0xdab0ff, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      texts.text(sub, x + w / 2, y + 16, WHITE, { ox: 0.5, oy: 0.5, alpha: a });
    }
    // name plates over the heroes by the fire (the picked one gold, with a check): the hero select
    const rk = easeBack((since - 330) / 260, 1.8);
    if (rk > 0)
      (['rowan', 'sable'] as const).forEach((id, i) => {
        if (id === 'sable' && !this.sableHere()) return;
        const r0 = this.heroPlate(id);
        const rr = id === 'sable' ? this.sableRect() : this.rowanRect();
        const picked = p.hero === id;
        const y = Math.round(r0.y + Math.sin(now / 480 + i * 1.7) * 1 - (1 - rk) * 5);
        this.glass(g, r0.x, y, r0.w, r0.h, clamp01(rk * 2), true, rr.x + rr.w / 2);
        if (picked) pix(g, 'check', r0.x + 2, y + 1);
        texts.text(HEROES[id].name, r0.x + (picked ? 10 : 3), y + 4.5, picked ? GOLD_TXT : 0xc8e8ff, { oy: 0.5 });
      });

    // the band of buttons along the bottom
    const bk = easeBack((since - 60) / 300, 1.5);
    const dy = Math.round((1 - bk) * 26);
    g.fillStyle(0x07050e, 0.55);
    g.fillRect(0, s.B - 23 + dy, s.R + s.L + 400, 40);
    g.fillStyle(GOLD[1], 0.8);
    g.fillRect(0, s.B - 23 + dy, s.R + s.L + 400, 1);
    for (const b of this.band()) {
      const r = { ...b.r, y: b.r.y + dy };
      const pr = isPressed(b.r, now) ? 2 : 0;
      if (b.id === 'leave') {
        glow(g, r, 0x8af06a, 0.3 + 0.3 * pulse(now, 1000), 3);
        button3d(g, r, FACE.green, pr > 0);
        texts.text(b.label, r.x + 6, r.y + r.h / 2 + pr, WHITE, { bold: true, oy: 0.5 });
        chevron(g, r.x + r.w - 8, r.y + 4 + pr, 7, WHITE, 1, 1, true);
        continue;
      }
      // Skills: a gold "!" (and a glow) when the picked hero has points to spend; Relics: how many are new
      const points = b.id === 'skills' && kit.level(p.hero).points > 0;
      if (points) glow(g, r, 0xffd23a, 0.3 + 0.35 * pulse(now, 900), 3);
      button3d(g, r, b.id === 'forge' ? FACE.wood : b.id === 'skills' ? FACE.purple : b.id === 'relics' ? FACE.red : FACE.blue, pr > 0);
      const [iw, ih] = pixSize(b.icon);
      pix(g, b.icon, r.x + 4, r.y + Math.round((r.h - ih) / 2) + pr - 1);
      texts.text(b.label, r.x + iw + 6, r.y + r.h / 2 + pr, WHITE, { bold: true, oy: 0.5 });
      if (b.id === 'bag' && fresh > 0) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, `${fresh}`, now);
      if (points) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, '!', now, true);
      if (b.id === 'relics' && p.relicsNew.length) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, `${p.relicsNew.length}`, now);
    }
  }

  /** A crisp dark glass plate (like the world map's), optionally with a tail pointing down at `tailX`. */
  private glass(g: G, x: number, y: number, w: number, h: number, a: number, tail = false, tailX = 0): void {
    rows(g, x, y + 2, w, h, 2, 0x000000, 0.35 * a);
    rows(g, x - 1, y - 1, w + 2, h + 2, 2, INK, a);
    rows(g, x, y, w, h, 2, 0x161226, 0.94 * a);
    g.fillStyle(0x221c38, 0.96 * a);
    g.fillRect(x + 1, y + 1, w - 2, Math.round(h / 2) - 1);
    g.fillStyle(0x6a5c98, a);
    g.fillRect(x + 2, y, w - 4, 1);
    g.fillStyle(0x0c0a16, a);
    g.fillRect(x + 2, y + h - 1, w - 4, 1);
    if (tail) {
      const tx = Math.round(Math.max(x + 4, Math.min(x + w - 4, tailX)));
      g.fillStyle(INK, a);
      g.fillRect(tx - 2, y + h, 5, 1);
      g.fillRect(tx - 1, y + h + 1, 3, 1);
      g.fillRect(tx, y + h + 2, 1, 1);
      g.fillStyle(0x161226, a);
      g.fillRect(tx - 1, y + h, 3, 1);
      g.fillRect(tx, y + h + 1, 1, 1);
    }
  }
}

