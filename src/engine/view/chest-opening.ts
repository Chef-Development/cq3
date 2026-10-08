// The chest opening (docs/ui-style.md, "The chest opening"): the screen darkens and the chest slams down (dust, a
// thud, the screen shakes); it shakes in growing pulses while light cracks out of its seams, and its glow climbs the
// rarity colours one step per pulse (grey, green, blue, purple, orange, red, cyan, prismatic) until it reaches the
// prize's tier: a rarer prize takes more steps, shakes harder and holds longer. A last charge, then the lid bursts
// off (a flash, rays, sparks, a boom) and the prize rises out of the light as a dark silhouette rimmed in its tier's
// colour, holds a moment, and is revealed: a white flash, its colours fill in, the rarity banner drops, its name,
// what it means ("New hero!", or shards filling toward the next star), and a fanfare sized to the tier. Never a
// reel: one chest, one prize, built up step by step.
//
// A tap jumps to the next step (the slam, a pulse, the charge, the burst, the reveal); it never skips the reveal
// itself. Several chests open one after another ("Open all"), then a summary of what came out. A chest hero met for
// the first time plays their arrival scene once it's all closed (marked seen when the chest opens: it plays once).
//
// One opening per camp (chestOpening(kit)): the chest screen and the shrine share it, and its random stream
// (reseed: a known prize in tests).
import Phaser from 'phaser';
import { COMPANIONS, COMPANION_IDS, type CompanionId } from '../../data/companions';
import { HEROES, HERO_IDS, type HeroId } from '../../data/heroes';
import { TIERS, TIER_INFO, tierIndex, type Tier } from '../../data/rarity';
import { STORY } from '../../data/story';
import { openChest, type ChestPrize } from '../../core/chests';
import { checkAchievements } from '../../core/meta';
import type { ChestKind } from '../../core/profile';
import { Rng } from '../../core/rng';
import { meetSceneFor, shardsToNext } from '../../core/roster';
import { HERO_FEET_X } from '../art';
import { BIG_CHEST } from '../art-chests';
import { textWidth } from '../font';
import { D, familyChipW, GOLD_TXT, type CampKit } from './camp-kit';
import { ChestHd, REVEAL_STAR_AT, type HdScene } from './chest-hd';
import { loadChestReveal } from '../storage';
import type { HdLayerRect } from '../hd-layer';
import { star } from './loot';
import { chevron, gauge, glow, GOLD, hudIcon, rows } from './pixels';
import { clamp01, easeBack, easeOut3, mix, pulse, WHITE } from './shared';
import { ribbon, tag } from './ui';
import { aura, fillEllipse, glass, vignette } from './ui-modern';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

/** The prism's colours (Divine's light cycles through them). */
const PRISM = [0xff8ab8, 0xffe070, 0x7af0b4, 0x8acbff, 0xc8a2ff];

/** What one chest gave, and how its hero or companion stood before and after (for the shards bar). */
export interface OpenedChest {
  kind: ChestKind;
  prize: ChestPrize;
  before: { stars: number; shards: number };
  after: { stars: number; shards: number };
  /** A demo (the Test lab): nothing was rolled or granted. */
  demo: boolean;
}

// ------------------------------------------------------------------ timing

/** The chest lands this long after it starts to fall. */
const SLAM = 300;

/** One chest's timeline (ms from its start) for a prize of tier index `t`. */
function timeline(t: number) {
  const steps: number[] = [];
  let x = SLAM + 380;
  for (let i = 0; i <= t; i++) {
    steps.push(x);
    x += Math.max(330, 600 - i * 38);
  }
  const charge = x - 120;
  const burst = charge + 420 + 70 * t;
  const reveal = burst + 900 + 90 * t;
  return { steps, charge, burst, reveal, done: reveal + 700 };
}
type Timeline = ReturnType<typeof timeline>;

interface Run {
  item: OpenedChest;
  t: number;
  tl: Timeline;
  /** When it started (performance.now) and how far taps have jumped it ahead (ms). */
  at: number;
  skip: number;
  /** How many of its events have fired. */
  fired: number;
  /** Shakes: [start (local ms), px, ms]. */
  shakes: Array<[number, number, number]>;
  /** The lid's flight: which way it spins. */
  spin: number;
  starPopped: boolean;
  outAt: number;
}

/**
 * Images with every property set on each draw (blend, tint mode, crop, angle...): the opening's own pool (the kit's
 * pools don't set blend modes). It hides what it showed at the start of every frame (the scene's pre-update), so a
 * screen that stops drawing leaves nothing behind.
 */
export class FxImages {
  private items: Phaser.GameObjects.Image[] = [];
  private used = 0;
  private hooked = false;

  constructor(private readonly s: Phaser.Scene) {}

  private reset(): void {
    this.used = 0;
    this.end();
  }

  begin(): void {
    this.used = 0;
  }

  get(
    key: string,
    x: number,
    y: number,
    depth: number,
    o: { ox?: number; oy?: number; sx?: number; sy?: number; angle?: number; alpha?: number; tint?: number; fill?: boolean; add?: boolean; cropH?: number } = {},
  ): Phaser.GameObjects.Image {
    if (!this.hooked) {
      // (the scene's events exist once it has booted: hook the per-frame reset on first use)
      this.s.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.reset, this);
      this.hooked = true;
    }
    let im = this.items[this.used];
    if (!im) {
      im = this.s.add.image(0, 0, key);
      this.items.push(im);
    }
    this.used++;
    // (by identity: a relayout rebuilds the textures under the same keys)
    if (im.texture !== this.s.textures.get(key)) im.setTexture(key);
    im.setOrigin(o.ox ?? 0.5, o.oy ?? 0.5)
      .setPosition(Math.round(x), Math.round(y))
      .setScale(o.sx ?? 1, o.sy ?? o.sx ?? 1)
      .setAngle(o.angle ?? 0)
      .setAlpha(o.alpha ?? 1)
      .setDepth(depth)
      .setVisible(true)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    if (o.tint === undefined) im.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    else im.setTint(o.tint).setTintMode(o.fill ? Phaser.TintModes.FILL : Phaser.TintModes.MULTIPLY);
    if (o.cropH !== undefined) im.setCrop(0, 0, im.width, Math.max(0, o.cropH));
    else im.setCrop();
    return im;
  }

  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }

  destroy(): void {
    if (this.hooked) this.s.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.reset, this);
    this.hooked = false;
    for (const im of this.items) im.destroy();
    this.items = [];
    this.used = 0;
  }
}

// depths (over the screen's own layers, under the camp's effects)
const DD = {
  glow: D.top + 0.001,
  base: D.top + 0.003,
  gap: D.top + 0.004,
  lid: D.top + 0.005,
  leak: D.top + 0.006,
  burst: D.top + 0.007,
  rim: D.top + 0.008,
  prize: D.top + 0.009,
  flash: D.top + 0.0095,
};

/**
 * Which reveal draws (the opening itself is shared: its timeline, taps, sounds and queue): the game's own ('old', the
 * default), the sharper test on a finer grid ('hd', chest-hd.ts; the 'cq3.chestReveal' setting), or both side by
 * side ('split': the Test lab's compare, old in the left half, new in the right).
 */
export type RevealView = 'old' | 'hd' | 'split';

/** What the Test lab draws over the reveal on the fine layer (its buttons), and whether a tap was its. */
export interface RevealExtra {
  draw(ctx: CanvasRenderingContext2D, r: HdLayerRect, now: number): void;
  tap(x: number, y: number, now: number): boolean;
}

const heroPrize = (p: ChestPrize) => p.kind === 'hero' || p.kind === 'heroShards';
const freshPrize = (p: ChestPrize) => (p.kind === 'hero' || p.kind === 'pet') && p.fresh;
export const prizeName = (p: ChestPrize): string => (heroPrize(p) ? HEROES[p.id as HeroId].name : COMPANIONS[p.id as CompanionId].name);

// ------------------------------------------------------------------ the opening

export class ChestOpening {
  private runs: OpenedChest[] = [];
  private cur: Run | null = null;
  /** The summary after "Open all" (what came out), since when. */
  private summary: { items: OpenedChest[]; at: number; outAt: number } | null = null;
  /** Everything opened in this go (for the summary). */
  private opened: OpenedChest[] = [];
  private since = 0;
  private scenes: string[] = [];
  private onDone: (() => void) | null = null;
  private imgs: FxImages;
  private rng: Rng | null = null;
  /** The Test lab's demo: the opened chests are made up, nothing is granted. */
  private demoMode = false;
  /** The sharper reveal (its own canvas over the game's), the reveal on screen, the lab's buttons over it. */
  private readonly hd: ChestHd;
  view: RevealView = loadChestReveal();
  extra: RevealExtra | null = null;

  constructor(private readonly kit: CampKit) {
    this.imgs = new FxImages(kit.s);
    this.hd = new ChestHd(kit);
  }

  /** The reveal the setting picks (the lab's compare is over). */
  resetView(): void {
    this.view = loadChestReveal();
  }

  /** Side by side and a chest is on screen (the summary is always the game's own, full width). */
  get splitShown(): boolean {
    return this.view === 'split' && !!this.cur;
  }

  /** Where the old reveal is centred: the screen's middle, or the left half's (side by side). */
  private oldCentre(): number {
    const s = this.kit.s;
    return this.view === 'split' ? Math.round((s.L + (s.L + s.R) / 2) / 2) : Math.round((s.L + s.R) / 2);
  }

  /** The new reveal's centre: the screen's middle, or the right half's (side by side). */
  private hdCentre(): number {
    const s = this.kit.s;
    return this.view === 'split' ? Math.round(((s.L + s.R) / 2 + s.R) / 2) : Math.round((s.L + s.R) / 2);
  }

  /** The layout rebuilt the textures: the opening's images go with them. */
  build(): void {
    this.imgs.destroy();
    this.imgs = new FxImages(this.kit.s);
  }

  /** Reseed what the chests hold (tests: a known prize). */
  reseed(seed: number): void {
    this.rng = new Rng(seed);
  }

  /** An opening (or its summary) is on screen. */
  get active(): boolean {
    return !!this.cur || !!this.summary;
  }

  /** Where the sequence stands (tests and the Test lab): its phase and the tier it is building to. */
  get state(): { phase: 'idle' | 'build' | 'charge' | 'burst' | 'reveal' | 'done' | 'summary'; tier: Tier | null; left: number } {
    if (this.summary) return { phase: 'summary', tier: null, left: 0 };
    const r = this.cur;
    if (!r) return { phase: 'idle', tier: null, left: 0 };
    const lt = performance.now() - r.at + r.skip;
    const tl = r.tl;
    const phase = lt >= tl.done ? 'done' : lt >= tl.reveal ? 'reveal' : lt >= tl.burst ? 'burst' : lt >= tl.charge ? 'charge' : 'build';
    return { phase, tier: r.item.prize.tier, left: this.runs.length };
  }

  /**
   * Open waiting chests, one of each kind listed (in order; a kind with none waiting is skipped): each is rolled and
   * given now (saved), then they play one after another; several end with a summary. Returns how many opened.
   */
  open(kinds: ChestKind[], now: number, onDone?: () => void): number {
    const kit = this.kit;
    const p = kit.profile;
    const items: OpenedChest[] = [];
    this.rng ??= new Rng((Math.random() * 0xffffffff) >>> 0);
    const g = kit.run.gains;
    for (const kind of kinds) {
      if (p.chests[kind] <= 0) continue;
      const snap = new Map<string, { stars: number; shards: number }>();
      for (const id of HERO_IDS) snap.set(`h:${id}`, { stars: p.heroes[id].stars, shards: p.heroes[id].shards });
      for (const id of Object.keys(p.pets) as CompanionId[]) snap.set(`p:${id}`, { stars: p.pets[id].stars, shards: p.pets[id].shards });
      const prize = openChest(this.rng, kit.tuning, p, kind);
      if (!prize) continue;
      const hero = heroPrize(prize);
      const before = snap.get(`${hero ? 'h' : 'p'}:${prize.id}`) ?? { stars: 1, shards: 0 };
      const prog = hero ? p.heroes[prize.id as HeroId] : p.pets[prize.id as CompanionId];
      const after = prog ? { stars: prog.stars, shards: prog.shards } : { ...before };
      // a chest hero's first arrival plays their scene once it's all closed (marked seen now: it plays once)
      if (prize.kind === 'hero' && prize.fresh) {
        const scene = meetSceneFor(p, prize.id);
        if (scene && STORY[scene]) {
          p.seen.push(scene);
          this.scenes.push(scene);
        }
      }
      // owning more heroes and companions can earn achievements: shown by the camp once back home
      const feats = checkAchievements(p, kit.tuning);
      g.achievements.push(...feats);
      g.gems += feats.reduce((a, f) => a + f.gems, 0);
      items.push({ kind, prize, before, after, demo: false });
    }
    if (!items.length) return 0;
    kit.commit();
    this.demoMode = false;
    this.begin(items, now, onDone);
    return items.length;
  }

  /**
   * The Test lab's demo (and a way to see any tier): plays the opening of a `kind` chest with a prize forced to
   * each tier in `tiers` (one after another, then the summary, like "Open all"), WITHOUT rolling or granting
   * anything: the profile is untouched. The prize shown is a hero or companion of that tier when there is one (else
   * the closest below, shown at the forced tier), always as "New".
   *   camp.go('chests', now); camp.chests.demo(['rare', 'legendary', 'divine'], 'rare', now)
   */
  demo(tiers: Tier | Tier[], kind: ChestKind, now: number, onDone?: () => void): void {
    const list = Array.isArray(tiers) ? tiers : [tiers];
    const items = list.map((tier, i): OpenedChest => {
      const ti = tierIndex(tier);
      const heroes = HERO_IDS.filter((id) => HEROES[id].joins === 'chest');
      const pick = <T extends string>(ids: T[], tierOf: (id: T) => Tier): T | null => {
        for (let k = ti; k >= 0; k--) {
          const at = ids.filter((id) => tierOf(id) === TIERS[k]);
          if (at.length) return at[i % at.length];
        }
        return null;
      };
      const asHero = i % 2 === 0 && ti >= tierIndex('rare');
      const h = asHero ? pick(heroes, (id) => HEROES[id].rarity) : null;
      const prize: ChestPrize = h
        ? { kind: 'hero', id: h, tier, fresh: true, shards: 0, starsUp: 0 }
        : { kind: 'pet', id: pick(COMPANION_IDS, (id) => COMPANIONS[id].rarity) ?? 'bun', tier, fresh: true, shards: 0, starsUp: 0 };
      return { kind, prize, before: { stars: 1, shards: 0 }, after: { stars: 1, shards: 0 }, demo: true };
    });
    if (!items.length) return;
    this.demoMode = true;
    this.begin(items, now, onDone);
  }

  /** The Test lab's compare: these made-up chests one after another (nothing rolled or granted), no summary. */
  playDemo(items: OpenedChest[], now: number, onDone?: () => void): void {
    if (!items.length) return;
    this.demoMode = true;
    this.noSummary = true;
    this.begin(items, now, onDone);
  }
  private noSummary = false;

  /** The chest on screen again from its slam (the lab's Replay). False when none is playing. */
  replay(now: number): boolean {
    const r = this.cur;
    if (!r) return false;
    Object.assign(r, { at: now, skip: 0, fired: 0, shakes: [], starPopped: false, outAt: 0 });
    this.kit.app.audio.whoosh();
    return true;
  }

  /** A tap the lab's buttons take first (true: taken). */
  tapExtra(x: number, y: number, now: number): boolean {
    return !!this.extra?.tap(x, y, now);
  }

  private begin(items: OpenedChest[], now: number, onDone?: () => void): void {
    if (!this.active) {
      this.since = now;
      this.opened = [];
    }
    this.runs.push(...items);
    this.onDone = onDone ?? null;
    this.summary = null;
    if (!this.cur) this.next(now);
  }

  private next(now: number): void {
    const item = this.runs.shift();
    if (!item) {
      this.cur = null;
      if (this.opened.length > 1 && !this.noSummary) {
        this.summary = { items: this.opened, at: now, outAt: 0 };
        this.kit.app.audio.panelOpen();
      } else this.finish();
      return;
    }
    const t = tierIndex(item.prize.tier);
    this.cur = { item, t, tl: timeline(t), at: now, skip: 0, fired: 0, shakes: [], spin: this.opened.length % 2 ? -1 : 1, starPopped: false, outAt: 0 };
    if (this.view !== 'old' || this.extra) this.hd.prepare(item.kind, item.prize.tier);
    this.opened.push(item);
    this.kit.app.audio.whoosh();
  }

  private finish(): void {
    this.cur = null;
    this.summary = null;
    this.opened = [];
    this.demoMode = false;
    this.noSummary = false;
    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  /** A tap while it plays: the next step (never past the reveal); once revealed, the next chest or the summary. */
  tap(now: number): void {
    const sm = this.summary;
    if (sm) {
      if (now - sm.at > 350 && !sm.outAt) {
        sm.outAt = now;
        this.kit.app.audio.panelClose();
      }
      return;
    }
    const r = this.cur;
    if (!r || r.outAt) return;
    const lt = now - r.at + r.skip;
    if (lt < 140) return; // (the tap that opened it)
    const tl = r.tl;
    if (lt >= tl.done) {
      r.outAt = now;
      this.kit.app.audio.panelClose();
      return;
    }
    const marks = [SLAM, ...tl.steps, tl.charge, tl.burst, tl.reveal, tl.done];
    const nextMark = marks.find((m) => m > lt + 1) ?? tl.done;
    r.skip += nextMark - lt;
  }

  /** Off the camp: the images hide. */
  hide(): void {
    this.imgs.begin();
    this.imgs.end();
    this.hd.hide();
  }

  // ------------------------------------------------------------------ events

  /** The tier's colours at step i (Divine's cycle through the prism). */
  private stepFace(i: number, now: number): Face {
    if (i >= 7) {
      const c = PRISM[Math.floor(now / 110) % PRISM.length];
      return [mix(c, WHITE, 0.5), c, mix(c, 0x000000, 0.25), mix(c, 0x000000, 0.55)];
    }
    return TIER_INFO[TIERS[Math.max(0, i)]].face as Face;
  }

  /** Fire what the timeline has reached: the slam, each step, the charge, the burst, the reveal. */
  private fire(r: Run, lt: number, cx: number, chestMid: number, prizeMid: number, now: number): void {
    const kit = this.kit;
    const audio = kit.app.audio;
    // (the new reveal draws its own particles: the camp's only for the old one)
    const fx = this.view === 'hd' ? null : kit.fx;
    const tl = r.tl;
    const events: Array<[number, () => void]> = [
      [
        SLAM,
        () => {
          audio.chestSlam();
          r.shakes.push([SLAM, 4, 260]);
          const fy = chestMid + BIG_CHEST.h;
          for (const side of [-1, 1]) fx?.burst(cx + side * 40, fy - 2, [0x6a5a7a, 0x8a7a92, 0x4a4058, 0xb0a4b8], 14, 0.9, { kind: 'chip', g: 160, up: 50, spread: 0.9, life: 650 });
        },
      ],
      ...tl.steps.map((at, i): [number, () => void] => [
        at,
        () => {
          audio.tierStep(i);
          r.shakes.push([at, 1.5 + i * 0.55, 300]);
          const face = this.stepFace(i, now);
          fx?.ring(cx, chestMid, 30 + i * 5, face[0], 420);
          fx?.burst(cx, chestMid + 8, [face[0], face[1], WHITE], 6 + i * 2, 0.8, { kind: 'spark', g: 140, life: 520 });
          if (i >= 2 && i % 2 === 0) kit.after(90, () => audio.chestCrack(i / 7));
        },
      ]),
      [
        tl.charge,
        () => {
          audio.chestCrack(1);
          r.shakes.push([tl.charge, 1 + r.t * 0.3, tl.burst - tl.charge]);
        },
      ],
      [
        tl.burst,
        () => {
          audio.chestBurst(r.t);
          r.shakes.push([tl.burst, 3 + r.t * 0.7, 380 + r.t * 30]);
          const face = this.stepFace(r.t, now);
          const by = chestMid;
          fx?.burst(cx, by, [face[0], face[1], WHITE, GOLD[3]], 34 + r.t * 8, 1.5, { kind: 'star', g: 70, life: 1000 });
          fx?.burst(cx, by, [face[0], WHITE], 22 + r.t * 3, 1.2, { kind: 'spark', g: 130, life: 760 });
          fx?.burst(cx, by, [face[1], face[2]], 16, 1.1, { kind: 'chip', g: 220, up: 70, life: 900 });
          fx?.ring(cx, by, 44 + r.t * 5, face[0], 560);
          fx?.ring(cx, by, 26, WHITE, 400);
        },
      ],
      [
        tl.reveal,
        () => {
          audio.fanfare(r.t);
          const face = TIER_INFO[r.item.prize.tier].face as Face;
          fx?.burst(cx, prizeMid, [face[0], WHITE, face[1]], 24 + r.t * 6, 1.2, { kind: 'star', g: 30, life: 1100 });
          fx?.ring(cx, prizeMid, 40 + r.t * 4, face[0], 600);
          if (fx && r.t >= tierIndex('legendary')) kit.after(160, () => fx.ring(cx, prizeMid, 60 + r.t * 4, WHITE, 700));
        },
      ],
    ];
    while (r.fired < events.length && lt >= events[r.fired][0]) {
      events[r.fired][1]();
      r.fired++;
    }
  }

  /** The screen shake now (whole px), from the shakes still running. */
  private shake(r: Run, lt: number): [number, number] {
    let m = 0;
    for (const [at, px, ms] of r.shakes) {
      const k = (lt - at) / ms;
      if (k >= 0 && k < 1) m = Math.max(m, px * (1 - k));
    }
    if (m < 0.5) return [0, 0];
    return [Math.round(Math.sin(lt / 23) * m), Math.round(Math.cos(lt / 31) * m * 0.6)];
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    this.imgs.begin();
    if (this.cur && this.cur.outAt && now - this.cur.outAt >= 200) this.next(now);
    if (this.summary && this.summary.outAt && now - this.summary.outAt >= 200) this.finish();
    if (!this.active) {
      this.imgs.end();
      if (this.view !== 'old') this.hd.warmChests();
      this.hd.frame(null, this.extraDraw(now));
      // the arrival scenes of the chest heroes met, one after another
      const app = kit.app;
      if (this.scenes.length && !app.storyOverlay) {
        app.storyBox = 0;
        app.storyOverlay = this.scenes.shift()!;
      }
      return;
    }
    const s = kit.s;
    const g = kit.gTop;
    const k = easeOut3((now - this.since) / 220);
    const out = this.summary?.outAt ? clamp01((now - this.summary.outAt) / 200) : 0;
    // the game's own reveal on the game canvas, the new one on its finer layer over it (side by side: both; the
    // summary then is the game's own, full width)
    const old = this.view !== 'hd';
    if (old) {
      g.fillStyle(0x05030a, 0.93 * k * (1 - out));
      g.fillRect(-20, -10, s.R + s.L + 400, s.B + 200);
    }
    if (this.cur) {
      if (this.view !== 'hd') this.drawRun(now, this.cur);
      else this.fireOnly(now, this.cur);
    } else if (this.summary && old) this.drawSummary(now, this.summary);
    if (old) vignette(g, s, k * (1 - out));
    let sc: HdScene | null = null;
    if (this.cur && this.view !== 'old') sc = this.hdScene(now, this.cur, k);
    else if (this.summary && this.view === 'hd') {
      const sm = this.summary;
      sc = { now, veil: k * (1 - out), run: null, cx: this.hdCentre(), clip: null, opaque: false, summary: { items: sm.items, at: sm.at, outAt: sm.outAt, title: this.demoMode ? 'Demo' : 'Opened' } };
    }
    this.hd.frame(sc, this.extraDraw(now));
    this.imgs.end();
  }

  /** The lab's buttons on the fine layer, if any. */
  private extraDraw(now: number): ((ctx: CanvasRenderingContext2D, r: HdLayerRect) => void) | null {
    const ex = this.extra;
    return ex ? (ctx, r) => ex.draw(ctx, r, now) : null;
  }

  /** The new reveal only: the timeline's events still fire (sounds, shakes) and a gained star still chimes. */
  private fireOnly(now: number, r: Run): void {
    const s = this.kit.s;
    const lt = now - r.at + r.skip;
    const ground = s.B - 6;
    const footY = s.B - 39;
    this.fire(r, lt, this.oldCentre(), ground - BIG_CHEST.h, footY - 36, now);
    const since = lt - r.tl.reveal;
    if (r.item.prize.starsUp > 0 && !freshPrize(r.item.prize) && since >= REVEAL_STAR_AT && !r.starPopped) {
      r.starPopped = true;
      for (let i = 0; i < 3; i++) this.kit.after(i * 90, () => this.kit.app.audio.statUp(i));
    }
  }

  /** The chest on screen as the new reveal draws it. */
  private hdScene(now: number, r: Run, veil: number): HdScene {
    const s = this.kit.s;
    const it = r.item;
    const split = this.view === 'split';
    const mid = (s.L + s.R) / 2;
    return {
      now,
      veil,
      cx: this.hdCentre(),
      clip: split ? { x0: mid, x1: s.R + s.L + 400 } : null,
      opaque: split,
      hint: split ? { x: mid + 4, y: 41, ox: 0 } : undefined,
      run: {
        kind: it.kind,
        prize: it.prize,
        before: it.before,
        after: it.after,
        t: r.t,
        tl: r.tl,
        slam: SLAM,
        lt: now - r.at + r.skip,
        shakes: r.shakes,
        spin: r.spin,
        A: r.outAt ? 1 - clamp01((now - r.outAt) / 200) : 1,
        left: this.runs.length,
        closing: !!r.outAt,
      },
    };
  }

  private drawRun(now: number, r: Run): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gTop;
    const im = this.imgs;
    const tl = r.tl;
    const t = r.t;
    const lt = now - r.at + r.skip;
    const A = r.outAt ? 1 - clamp01((now - r.outAt) / 200) : 1;
    const kind = r.item.kind;
    const pz = r.item.prize;
    const [shx, shy] = this.shake(r, lt);
    const cx0 = this.oldCentre();
    const cx = cx0 + shx;
    const ground = s.B - 6 + shy;
    const SC = 2;
    const H = BIG_CHEST.h * SC;
    // where the prize stands once it has risen, and where its middle is
    const footY = s.B - 39 + shy;
    const prizeMid = footY - 36;
    // ---- the chest: falls, slams, hops on each step, recoils into the floor after the burst and sinks away
    const burst = lt >= tl.burst;
    const revealed = lt >= tl.reveal;
    let chestY = ground;
    if (lt < SLAM) {
      const q = lt / SLAM;
      chestY = Math.round(ground - (1 - q * q) * (ground + 40));
    }
    if (burst) chestY += Math.round(easeOut3((lt - tl.burst) / 280) * 34);
    if (revealed) chestY += Math.round(clamp01((lt - tl.reveal) / 420) ** 2 * 90);
    const chestMid = chestY - H / 2;
    this.fire(r, lt, cx0, ground - H / 2, prizeMid, now);
    let step = -1;
    tl.steps.forEach((at, i) => {
      if (lt >= at) step = i;
    });
    const sinceStep = step >= 0 ? lt - tl.steps[step] : 1e9;
    const charging = lt >= tl.charge && !burst;
    const ck = charging ? clamp01((lt - tl.charge) / (tl.burst - tl.charge)) : 0;
    const face = step >= 0 ? this.stepFace(step, now) : (TIER_INFO.common.face as Face);
    const [hi, base] = face;
    // the slam's squash
    let sx = SC;
    let sy = SC;
    if (lt >= SLAM && lt < SLAM + 150) {
      const b = 1 - (lt - SLAM) / 150;
      sy = SC * (1 - 0.09 * b);
      sx = SC * (1 + 0.06 * b);
    }
    // each step jolts it: a hop of the lid, a jitter; the charge rattles it without rest
    const hopK = sinceStep < 170 ? Math.sin((sinceStep / 170) * Math.PI) : 0;
    let lift = Math.round(hopK * (1.5 + step * 0.4));
    let jx = sinceStep < 300 ? Math.round(Math.sin(sinceStep / 18) * (1 + step * 0.35) * (1 - sinceStep / 300)) : 0;
    let jy = -Math.round(hopK * 1.5);
    if (charging) {
      const amp = 1 + t * 0.25 + ck * 2;
      jx = Math.round(Math.sin(lt / 17) * amp);
      jy = Math.floor(lt / 55) % 2 ? -1 : 0;
      lift = Math.floor(lt / 70) % 2 ? Math.round(1 + ck * 2) : 0;
    }
    // the glow behind it, the tier's colour, swelling step by step (and the light pooling on the floor)
    const glowK = burst ? Math.max(0, 1 - (lt - tl.burst) / 900) : step < 0 ? 0.15 : 0.45 + (step / 7) * 0.4 + ck * 0.3;
    if (glowK > 0) {
      const pk = sinceStep < 220 ? 1 - sinceStep / 220 : 0;
      im.get('hchest_glow_l', cx, chestMid, DD.glow, { sx: (1.7 + step * 0.16 + ck * 0.6 + pk * 0.35 + 0.05 * Math.sin(now / 90)) / 3, tint: base, add: true, alpha: Math.min(1, glowK * (0.75 + 0.25 * pulse(now, 420)) + pk * 0.3) * A });
      // the tier's aura in clear, stepped rings (the shared rarity glow), then a brighter heart in its light colour
      if (step >= 0 && !burst) aura(kit, g, cx, chestMid, 58 + step * 3 + pk * 6, 50 + step * 3 + pk * 6, TIERS[step], now, 1);
      im.get('hchest_glow_l', cx, chestMid, DD.glow, { sx: (1.25 + step * 0.1 + ck * 0.35 + pk * 0.25) / 3, tint: hi, add: true, alpha: Math.min(1, glowK * 0.85 + pk * 0.3) * A });
      fillEllipse(g, cx, ground + 2, 46 + step * 3, 7, base, 0.16 * glowK * A);
    }
    // the tiers climbed so far: a gem lights up per step (the ones above stay dark: will it go further?)
    const rowA = (burst ? 1 - clamp01((lt - tl.burst) / 260) : clamp01((lt - SLAM) / 300)) * A;
    if (rowA > 0) this.tierRow(now, cx0, step, sinceStep, rowA);
    // the floor's shadow under it
    if (!burst) fillEllipse(g, cx, ground + 1, 44 * (lt < SLAM ? clamp01(lt / SLAM) : 1), 4, 0x000000, 0.5 * A);
    // dust puffs from the slam
    const dk = (lt - SLAM) / 600;
    if (dk >= 0 && dk < 1)
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const d = 30 + i * 9 + easeOut3(dk) * (18 + i * 8);
          fillEllipse(g, cx0 + side * d, ground - 3 - i * 2 - dk * 6, 7 - i, 4 - i * 0.6, 0x8a7a92, 0.45 * (1 - dk) * A);
        }
    const keyB = `hchest_${kind}_big`;
    const cyB = chestY + jy;
    im.get(`${keyB}_base`, cx + jx, cyB, DD.base, { ox: 0.5, oy: 1, sx, sy, alpha: A });
    // light in the gap (shows when the lid lifts) and, after the burst, pouring from the mouth
    const gapA = burst ? 1 : step < 0 ? 0 : 0.5 + 0.5 * (step / Math.max(1, t)) + ck * 0.5;
    if (gapA > 0) im.get(`${keyB}_gap`, cx + jx, cyB, DD.gap, { ox: 0.5, oy: 1, sx, sy, tint: burst ? mix(TIER_INFO[pz.tier].face[0], WHITE, 0.3) : hi, add: true, alpha: Math.min(1, gapA) * A });
    // the lid: on, or flying off after the burst
    if (!burst) im.get(`${keyB}_lid`, cx + jx, cyB - lift * SC, DD.lid, { ox: 0.5, oy: 1, sx, sy, alpha: A });
    else {
      const ft = (lt - tl.burst) / 1000;
      if (ft < 1.2) {
        const lidCy = cyB - (BIG_CHEST.h - BIG_CHEST.lidCy) * SC;
        im.get(`${keyB}_lid`, cx + r.spin * ft * 90, lidCy - 430 * ft + 280 * ft * ft, DD.lid, { ox: 0.5, oy: BIG_CHEST.lidCy / BIG_CHEST.h, sx: SC, angle: r.spin * ft * 560, alpha: A * clamp01(1.4 - ft) });
      }
    }
    // cracks of light: the seam, then cracks spreading over the lid and the box as the steps climb
    if (step >= 0 && !burst) {
      const n = charging ? 2 : Math.min(2, Math.floor((step * 3) / (t + 1)));
      const flick = sinceStep < 200 ? 0.35 * (1 - sinceStep / 200) : 0;
      const la = Math.min(1, 0.45 + 0.4 * (step / Math.max(1, t)) + flick + ck * 0.4 + 0.12 * Math.sin(now / 60)) * A;
      const lc = mix(hi, WHITE, 0.25);
      im.get(`${keyB}_leakB${n}`, cx + jx, cyB, DD.leak, { ox: 0.5, oy: 1, sx, sy, tint: lc, add: true, alpha: la });
      im.get(`${keyB}_leakL${n}`, cx + jx, cyB - lift * SC, DD.leak, { ox: 0.5, oy: 1, sx, sy, tint: lc, add: true, alpha: la });
    }
    // motes of light drawn into the chest while it charges (more and faster near the burst)
    if (charging || (step >= 0 && !burst)) {
      const m = charging ? 8 + Math.round(ck * 14) : 3 + step;
      for (let i = 0; i < m; i++) {
        const per = charging ? 620 - ck * 300 : 900;
        const q = (((lt / per + i / m) % 1) + 1) % 1;
        const ang = i * 2.39996 + Math.floor(lt / per + i / m) * 1.3;
        const d = 70 * (1 - q * q);
        star(kit.gTopOver, Math.round(cx + Math.cos(ang) * d), Math.round(chestMid + Math.sin(ang) * d * 0.7), q > 0.7 ? 0 : 1, i % 3 ? hi : WHITE, (0.3 + 0.7 * q) * A * (charging ? 1 : 0.5));
      }
    }
    // ---- the burst: a flash, a starburst, rays turning behind, a column of light from the mouth
    const pFace = TIER_INFO[pz.tier].face as Face;
    if (burst) {
      const since = lt - tl.burst;
      const rayX = cx;
      const rayY = revealed ? prizeMid : Math.round(chestMid + (prizeMid - chestMid) * easeOut3((lt - tl.burst - 160) / 700));
      this.rays(g, rayX, rayY, now, t, easeOut3(since / 500) * A);
      // the column of light rising from the mouth
      const mouthY = cyB - (BIG_CHEST.h - BIG_CHEST.mouth) * SC;
      const ca = (revealed ? Math.max(0, 1 - (lt - tl.reveal) / 500) : 1) * A;
      if (ca > 0)
        for (let y = mouthY; y > -10; y -= 2) {
          const k = (mouthY - y) / (mouthY + 10);
          const half = Math.round(30 + k * 26);
          g.fillStyle(mix(pFace[0], WHITE, 0.3), 0.16 * (1 - k) * ca);
          g.fillRect(cx - half, y, half * 2, 2);
          g.fillStyle(WHITE, 0.1 * (1 - k) * ca);
          g.fillRect(cx - Math.round(half * 0.4), y, Math.round(half * 0.8), 2);
        }
      if (since < 650) {
        const bk = since / 650;
        im.get('hchest_burst_l', cx, chestMid, DD.burst, { sx: (0.5 + easeOut3(bk) * (2.6 + t * 0.3)) / 2, angle: since / 5, tint: mix(pFace[1], WHITE, 0.3), add: true, alpha: (1 - bk) * A });
      }
      if (since < 260) {
        kit.gTopOver.fillStyle(mix(pFace[0], WHITE, 0.55), 0.85 * (1 - since / 260) * A);
        kit.gTopOver.fillRect(-20, -10, s.R + s.L + 400, s.B + 200);
      }
      this.drawPrize(now, r, lt, cx, footY, A);
    }
    // the fast-forward mark while it builds, "Tap" once it can be closed
    if (!revealed) {
      const fa = (0.35 + 0.3 * pulse(now, 800)) * A;
      chevron(kit.gTopOver, s.R - 15, s.B - 12, 7, 0xfff0c0, fa, 1, true);
      chevron(kit.gTopOver, s.R - 10, s.B - 12, 7, 0xfff0c0, fa, 1, true);
    } else if (lt >= tl.done && !r.outAt) {
      const more = this.runs.length;
      kit.topTexts.text(more ? `Next (${more})` : 'Tap', s.R - 4, s.B - 7, 0xfff0c0, { bold: true, ox: 1, oy: 0.5, alpha: 0.6 + 0.4 * pulse(now, 900) });
    }
  }

  /** Eight small gems, Common to Divine, under the top bar's middle: lit up to the step reached, the newest popping. */
  private tierRow(now: number, cx: number, step: number, sinceStep: number, a: number): void {
    const go = this.kit.gTopOver;
    const n = TIERS.length;
    const gap = 10;
    const x0 = Math.round(cx - (n * gap - 3) / 2);
    const y = 23;
    for (let i = 0; i < n; i++) {
      const lit = i <= step;
      const f = this.stepFace(i, now);
      const pop = lit && i === step && sinceStep < 260 ? Math.round(Math.sin((sinceStep / 260) * Math.PI)) : 0;
      const x = x0 + i * gap - pop;
      const yy = y - pop;
      const s = 7 + pop * 2;
      if (lit && i === step) rows(go, x - 3, yy - 3, s + 6, s + 6, 3, f[1], (0.3 + 0.25 * pulse(now, 500)) * a);
      rows(go, x - 1, yy - 1, s + 2, s + 2, 2, 0x05030a, a);
      rows(go, x, yy, s, s, 2, lit ? f[1] : 0x241c34, a);
      go.fillStyle(lit ? f[0] : 0x3a3050, a);
      go.fillRect(x + 1, yy + 1, Math.max(2, s - 4), 1);
      go.fillStyle(lit ? f[3] : 0x140e20, a);
      go.fillRect(x + 2, yy + s - 1, s - 4, 1);
      if (lit && i >= 6 && pulse(now, 700, i * 200) > 0.8) star(go, x + s - 1, yy, 1, WHITE, a);
    }
  }

  /** Rays turning round (x, y) in the prize's colours (Divine's in the prism's, Celestial's twinkling). */
  private rays(g: G, x: number, y: number, now: number, t: number, a: number): void {
    if (a <= 0) return;
    const face = TIER_INFO[TIERS[t]].face;
    const n = 12 + t * 2;
    const L = 320;
    for (let i = 0; i < n; i++) {
      const a0 = now / (3600 - t * 200) + (i / n) * Math.PI * 2;
      const w = 0.05 + (i % 2 ? 0 : 0.025);
      const col = t >= 7 ? PRISM[i % PRISM.length] : i % 2 ? face[1] : face[0];
      g.fillStyle(col, (i % 2 ? 0.09 : 0.06 + t * 0.008) * a);
      g.fillTriangle(x, y, Math.round(x + Math.cos(a0 - w) * L), Math.round(y + Math.sin(a0 - w) * L), Math.round(x + Math.cos(a0 + w) * L), Math.round(y + Math.sin(a0 + w) * L));
    }
    // a soft heart of light
    fillEllipse(g, x, y, 34 + t * 2, 30 + t * 2, face[1], 0.1 * a);
    fillEllipse(g, x, y, 20 + t, 18 + t, face[0], 0.12 * a);
  }

  /** The prize: rising out of the light as a silhouette rimmed in its tier's colour, then revealed. */
  private drawPrize(now: number, r: Run, lt: number, cx: number, footY: number, A: number): void {
    const kit = this.kit;
    const s = kit.s;
    const im = this.imgs;
    const tl = r.tl;
    const pz = r.item.prize;
    const hero = heroPrize(pz);
    const face = TIER_INFO[pz.tier].face as Face;
    const [hi, , , deep] = face;
    const revealed = lt >= tl.reveal;
    const art = hero ? HEROES[pz.id as HeroId].art : '';
    const frame = (n: number) => (hero ? `${art}_idle${n}` : pz.id === 'pip' ? `pip_idle${n}` : `comp_${pz.id}_idle${n}`);
    const f = revealed ? Math.floor((lt - tl.reveal) / (hero ? 480 : 340)) % 2 : 0;
    let key = frame(f);
    if (!kit.has(key)) key = frame(0);
    if (!kit.has(key)) return;
    const [w] = kit.imgs.size(key);
    const SC = hero ? 2 : 3;
    const flies = !hero && !!COMPANIONS[pz.id as CompanionId]?.flies;
    const ox = hero ? (HERO_FEET_X + 0.5) / w : 0.5;
    // it rises out of the chest's mouth to stand (or hover) over it
    const rise = easeOut3((lt - tl.burst - 160) / 650);
    if (rise <= 0) return;
    const startY = s.B + 20;
    const bob = revealed ? Math.round(Math.sin((lt - tl.reveal) / 380) * (flies ? 2 : 1)) : 0;
    const y = Math.round(startY + (footY - startY) * rise) - (flies ? 6 : 0) + bob + SC;
    const o = { ox, oy: 1, sx: SC };
    // the rim of light: the silhouette in the tier's colour, a game px out each way
    const rimA = (revealed ? Math.max(0.35, 1 - (lt - tl.reveal) / 600) : 0.75 + 0.25 * pulse(now, 500)) * A;
    const rimCol = pz.tier === 'divine' ? PRISM[Math.floor(now / 120) % PRISM.length] : mix(hi, WHITE, 0.2);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      im.get(key, cx + dx, y + dy, DD.rim, { ...o, tint: rimCol, fill: true, add: true, alpha: rimA });
    if (!revealed) {
      im.get(key, cx, y, DD.prize, { ...o, tint: 0x0a0612, fill: true, alpha: A });
      return;
    }
    // revealed: a white flash, the colours filling in
    const rk = clamp01((lt - tl.reveal) / 360);
    im.get(key, cx, y, DD.prize, { ...o, alpha: A });
    if (rk < 1) im.get(key, cx, y, DD.flash, { ...o, tint: WHITE, fill: true, alpha: (1 - rk) * A });
    this.drawLines(now, r, lt, cx, footY, A, face, hi, deep);
  }

  /** The rarity banner over the prize, its name under it, and what it means. */
  private drawLines(now: number, r: Run, lt: number, cx: number, footY: number, A: number, face: Face, hi: number, deep: number): void {
    const kit = this.kit;
    const go = kit.gTopOver;
    const texts = kit.topTexts;
    const tl = r.tl;
    const pz = r.item.prize;
    const since = lt - tl.reveal;
    // the banner drops in from above with a bounce
    const bk = easeBack((since - 60) / 300, 2);
    if (since > 60) {
      const info = TIER_INFO[pz.tier];
      const tw = textWidth(info.name, 1, true);
      const bw = tw + 30;
      const by = 21 - Math.round((1 - Math.min(1, bk)) * 8);
      const rr = ribbon(go, cx, by, bw, 13, face, A, true);
      texts.text(info.name, cx, rr.y + 6.5, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: A });
      if (info.sparkle !== 'none') {
        const c = Math.floor(now / 150) % 4;
        const sk = info.sparkle === 'stars' ? 'rarity_sparkle_celestial' : 'rarity_shine_divine';
        if (kit.has(`${sk}_${c}`)) {
          this.imgs.get(`${sk}_${c}`, rr.x - 2, rr.y + 1, D.topOver + 0.001, { ox: 0, oy: 0, alpha: A });
          this.imgs.get(`${sk}_${(c + 2) % 4}`, rr.x + rr.w - 5, rr.y + 6, D.topOver + 0.001, { ox: 0, oy: 0, alpha: A });
        }
      } else if (pulse(now, 900) > 0.8) star(go, rr.x + rr.w - 4, rr.y + 2, 1, WHITE, A);
    }
    // the name
    const na = clamp01((since - 220) / 180) * A;
    if (na > 0) {
      const name = prizeName(pz);
      const ny = footY + 11 + Math.round((1 - na) * 5);
      texts.text(name, cx, ny, mix(hi, WHITE, 0.25), { bold: true, scale: 2, ox: 0.5, oy: 0.5, alpha: na, extrude: 1, extrudeCol: deep });
    }
    // what it means
    const ka = clamp01((since - 420) / 180) * A;
    if (ka <= 0) return;
    const y = footY + 27;
    if (freshPrize(pz)) {
      const hero = heroPrize(pz);
      const what = hero ? 'New hero!' : 'New companion!';
      const w = textWidth(what, 1, true) + 14;
      const chipW = hero ? familyChipW(HEROES[pz.id as HeroId].style) + 4 : 0;
      const x0 = Math.round(cx - (w + chipW) / 2);
      const pk = easeBack((since - 420) / 260, 2.2);
      const tr = { x: x0, y: y - 6 - Math.round((1 - Math.min(1, pk)) * 4), w, h: 13 };
      glow(go, tr, GOLD[3], (0.35 + 0.3 * pulse(now, 700)) * ka, 3);
      tag(go, tr, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]], ka);
      texts.text(what, tr.x + w / 2, tr.y + 6.5, 0x5a2a08, { bold: true, ox: 0.5, oy: 0.5, alpha: ka, plain: true });
      if (pulse(now, 900) > 0.8) star(go, tr.x + w - 3, tr.y + 1, 1, WHITE, ka);
      if (hero) kit.familyChip(go, texts, HEROES[pz.id as HeroId].style, x0 + w + 4, y, ka);
    } else this.drawShards(r, since, cx, y, ka);
  }

  /** "+10" shards: the stars and the shard bar filling from before to after; a star gained pops in with a burst. */
  private drawShards(r: Run, since: number, cx: number, y: number, a: number): void {
    const kit = this.kit;
    const go = kit.gTopOver;
    const texts = kit.topTexts;
    const { prize: pz, before, after } = r.item;
    const up = pz.starsUp > 0;
    const STAR_AT = 1000;
    const starsShown = up && since < STAR_AT ? before.stars : after.stars;
    const label = `+${pz.shards}`;
    const lw = 10 + textWidth(label, 1, true);
    const sw = 5 * 9;
    const barW = 40;
    // (the row is laid out for its widest end text, so it doesn't jump when the star pops)
    const tailW = up ? textWidth('Star up!', 1, true) : 24;
    const total = lw + 6 + sw + 4 + barW + 4 + tailW;
    let x = Math.round(cx - total / 2);
    hudIcon(go, 'shard', x, y - 6, 1, a);
    texts.text(label, x + 10, y, 0xe8d0ff, { bold: true, oy: 0.5, alpha: a });
    x += lw + 6;
    const sx0 = x;
    kit.starRow(go, x, y - 4, starsShown, { alpha: a });
    x += sw + 4;
    const need = shardsToNext(kit.tuning, starsShown);
    const fk = easeOut3((since - 600) / 600);
    let frac: number;
    let shown: string;
    if (up && since < STAR_AT) {
      const n0 = shardsToNext(kit.tuning, before.stars) ?? 1;
      frac = (before.shards + (n0 - before.shards) * clamp01(fk)) / n0;
      shown = `${n0}/${n0}`;
    } else if (need === null) {
      frac = 1;
      shown = 'Max';
    } else {
      const from = up ? 0 : before.shards;
      frac = (from + (after.shards - from) * clamp01(up ? (since - STAR_AT) / 400 : fk)) / need;
      shown = `${after.shards}/${need}`;
    }
    gauge(go, x, y - 2, barW, 5, clamp01(frac), 0, { ramp: [0xf0d8ff, 0xc08af0, 0x8a4ad0, 0x4a2080] });
    if (!(up && since >= STAR_AT)) texts.text(shown, x + barW + 4, y + 0.5, 0xe0d0ff, { oy: 0.5, alpha: a });
    else {
      const px = sx0 + (after.stars - 1) * 9 + 4;
      if (!r.starPopped) {
        r.starPopped = true;
        kit.fx.burst(px, y, [0xfff0a0, 0xffd23a, WHITE], 24, 1, { kind: 'star', g: 40, life: 800 });
        kit.fx.ring(px, y, 16, 0xfff0a0, 420);
        for (let i = 0; i < 3; i++) kit.after(i * 90, () => kit.app.audio.statUp(i));
      }
      // the count gives way to "Star up!", popping in gold
      const k = clamp01((since - STAR_AT) / 200);
      texts.text('Star up!', x + barW + 4, y + 0.5 - Math.round((1 - easeBack(k, 2)) * 3), GOLD_TXT, { bold: true, oy: 0.5, alpha: a * k });
    }
  }

  /** What came out of "Open all": a tile per chest on a glass plate, in the order they opened. */
  private drawSummary(now: number, sm: { items: OpenedChest[]; at: number; outAt: number }): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gTop;
    const go = kit.gTopOver;
    const texts = kit.topTexts;
    const out = sm.outAt ? clamp01((now - sm.outAt) / 200) : 0;
    const k = easeBack((now - sm.at) / 280, 1.5);
    const A = clamp01((now - sm.at) / 160) * (1 - out);
    const n = Math.min(16, sm.items.length);
    const perRow = Math.min(8, n);
    const rowsN = Math.ceil(n / perRow);
    const TW = 26;
    const TH = 34;
    const w = Math.min(s.R - s.L - 12, perRow * (TW + 6) + 18);
    const h = rowsN * (TH + 6) + 30;
    const cx = Math.round((s.L + s.R) / 2);
    const r = { x: Math.round(cx - w / 2), y: Math.round((s.B - h) / 2 + 4 + (1 - Math.min(1, k)) * 14), w, h };
    // the light behind the plate in the best prize's colours
    const best = sm.items.reduce((b, it) => (tierIndex(it.prize.tier) > tierIndex(b) ? it.prize.tier : b), 'common' as Tier);
    this.rays(g, cx, r.y + r.h / 2, now, tierIndex(best), 0.6 * A);
    glass(g, r, { alpha: A, rim: TIER_INFO[best].face[2], clear: 0.1 });
    const title = this.demoMode ? 'Demo' : 'Opened';
    const tw = textWidth(title, 1, true) + 24;
    const rb = ribbon(go, cx, r.y - 6, tw, 13, TIER_INFO[best].face as Face, A, true);
    texts.text(title, cx, rb.y + 6.5, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: A });
    // which chests: each kind's badge and how many
    const kinds = (['hero', 'rare', 'region'] as ChestKind[]).map((kind) => ({ kind, n: sm.items.filter((it) => it.kind === kind).length })).filter((q) => q.n > 0);
    const kw = kinds.map((q) => 17 + 2 + textWidth(`x${q.n}`, 1, true));
    let kx = Math.round(cx - (kw.reduce((a, b) => a + b, 0) + (kinds.length - 1) * 8) / 2);
    kinds.forEach((q, i) => {
      const key = `hchest_${q.kind}_icon`;
      if (kit.has(key)) kit.imgs.at(key, kx, r.y + 7, D.topIcons, A);
      texts.text(`x${q.n}`, kx + 19, r.y + 15, 0xe8e0ff, { bold: true, oy: 0.5, alpha: A });
      kx += kw[i] + 8;
    });
    sm.items.slice(0, n).forEach((it, i) => {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const x = Math.round(cx - (inRow * (TW + 6) - 6) / 2 + (i % perRow) * (TW + 6));
      const y = r.y + 28 + row * (TH + 6);
      const ik = easeBack((now - sm.at - 120 - i * 60) / 240, 2);
      if (ik <= 0) return;
      const ty = y + Math.round((1 - Math.min(1, ik)) * 6);
      const tr = { x, y: ty, w: TW, h: TW };
      const pz = it.prize;
      const face = TIER_INFO[pz.tier].face;
      if (tierIndex(pz.tier) >= tierIndex('epic')) glow(g, tr, face[1], (0.25 + 0.2 * pulse(now, 900, i * 120)) * A, 2);
      kit.rarityFrame(g, tr, pz.tier, now, { alpha: A, depth: D.topIcons });
      if (heroPrize(pz)) kit.face(pz.id as HeroId, x + 4, ty + 4, D.topIcons, { alpha: A });
      else {
        const key = pz.id === 'pip' ? 'pip_idle0' : `comp_${pz.id}_idle0`;
        if (kit.has(key)) kit.sprites.draw(key, x + 3, ty + 3, D.topIcons, { crop: [7, 2, 20, 20], alpha: A });
      }
      const fresh = freshPrize(pz);
      texts.text(fresh ? 'New' : `+${pz.shards}`, x + TW / 2, ty + TW + 5, fresh ? GOLD_TXT : 0xe8d0ff, { bold: true, ox: 0.5, oy: 0.5, alpha: A });
      if (fresh && pulse(now, 1000, i * 200) > 0.85) star(go, x + TW - 2, ty + 1, 1, WHITE, A);
    });
    if (sm.items.length > n) texts.text(`+${sm.items.length - n} more`, cx, r.y + r.h - 5, 0xd8d0f0, { ox: 0.5, oy: 0.5, alpha: A });
    if (now - sm.at > 600 && !sm.outAt) texts.text('Tap', s.R - 4, s.B - 7, 0xfff0c0, { bold: true, ox: 1, oy: 0.5, alpha: 0.6 + 0.4 * pulse(now, 900) });
  }
}

const OPENINGS = new WeakMap<CampKit, ChestOpening>();

/** The camp's one chest opening (the chest screen and the shrine share it). */
export function chestOpening(kit: CampKit): ChestOpening {
  let o = OPENINGS.get(kit);
  if (!o) {
    o = new ChestOpening(kit);
    OPENINGS.set(kit, o);
  }
  return o;
}
