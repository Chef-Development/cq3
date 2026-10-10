// The kingdom's world map (between runs): a page of the Great Atlas, a continent about three screens wide and two
// tall (art-world.ts, printed by art-world-atlas.ts), alive, that you drag to explore. The view is a camera over it: a
// press that moves more than a few game px is a drag (it pans the map, with momentum, clamped at the edges, and never
// starts anything); a press that stays put is a tap, judged on release. The map opens on where the story is (the act
// Rowan is on); the very first visit glides in from the far east, so you see how big the world is (a tap skips it).
//
// Every playable act is a landmark: tap one to select it (its card says what playing it means, Play starts it: the
// story, or a cleared act replayed for its drops); Rowan and Pip wait at the current act under a call to action (tap
// it, or Rowan: the run starts, or once an act is cleared the act picker opens with his region's acts). A flag flies
// over each cleared act. Once an act is cleared, a chip at the top right names the region in view and how complete it
// is (a laurel badge at 100%, also beside its boss's landmark); a tap on it opens that region's act picker. A land
// has three looks (core/world-plan.ts): erased (blank vellum with a lit torn edge, until it can be played: then it
// unveils, once, with a short reveal), in the Mapmaker's draft (its colour drained, back only round Rowan and the
// cleared acts) while its region isn't won, and restored (its colour floods back from its boss's landmark, once, on
// the next visit). The seven far isles out in the sea are blank vellum that thins and lifts as regions are won
// (art-world-lands.ts). The header's compass counts the regions restored; the Camp button (bottom left) opens the camp.
// Once Act 1 is cleared, a wandering foe sometimes paces the Meadow Road (view/world-roam.ts).
//
// The HUD (the header, the Camp button, the cards and the act picker) stays put inside the safe areas; everything
// else is drawn in world px less the camera. Everything animates from `now` (deterministic for the screenshot
// tests): the art was pre-rendered at boot, so a frame only moves images, swaps their frames, and draws a modest
// number of rects (only for what's in view).
import { pctOf, whole } from '../../core/format';
import type Phaser from 'phaser';
import { regionBadge, regionCompletion } from '../../core/completion';
import { itemLevel, type Item } from '../../core/gear';
import { WEIGHTS_TOTAL } from '../../core/profile';
import { fogOf, landOpen, markRestored, markUnveiled, planName, planRegion, playableIndex, regionOpen, regionRestored, restorePending, revealed, unveilPending } from '../../core/world-plan';
import { ALL_ACTS, REGIONS, regionOfAct, regionStart } from '../../data/regions';
import { BASE_BY_ID, SIGNATURES } from '../../data/gear';
import type { FightScene } from '../scene';
import {
  CLOUD_KINDS,
  DRAFT_BOXES,
  FLAG_FRAMES,
  FLAG_ORIGIN,
  NOON_BOX,
  SEA_LANES,
  VEIL_BOXES,
  WALKER_KINDS,
  SEA_FRAMES,
  WIND_FRAMES,
  WORLD_ACTS,
  WORLD_BOXES,
  WORLD_CAPITAL,
  WORLD_H,
  WORLD_LIFE,
  WORLD_REGIONS,
  WORLD_ROADS,
  WORLD_SPOTS,
  WORLD_W,
  MAP_W,
  worldArtReady,
  worldRegionAt,
} from '../art-world';
import { ASH_SIGHTS, FAR_ISLES, FROST_SIGHTS } from '../art-world-lands';
import { hash } from '../backdrop';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { cornerInset } from '../chrome';
import { cellIcon, itemCell } from './items';
import { glyph, glyphSize } from './overlays';
import { button3d, chevron, glow, hudIcon, iconSize, NAVY, panel } from './pixels';
import { easeBack, inRect, mix, pulse, INK, WHITE, type Rect } from './shared';
import { FACE, ImagePool, isPressed, notePress, ribbon, RIBBON, TextPool } from './ui';
import { WorldRoam } from './world-roam';
import { WorldLife } from './world-life';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
type Region = (typeof WORLD_REGIONS)[number];
type Pt = [number, number];

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const rnd = (i: number, s: number) => hash(i, s, 977);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

const DEPTH = {
  map: 30.1,
  waves: 30.11,
  far: 30.115,
  surf: 30.12,
  sea: 30.13,
  ship: 30.14,
  isle: 30.15,
  glow: 30.16,
  land: 30.17,
  actor: 30.18,
  pip: 30.19,
  shadow: 30.22,
  veil: 30.23,
  fog: 30.24,
  air: 30.26,
  rim: 30.28,
  vignette: 30.3,
  cloud: 30.4,
  bird: 30.42,
  lock: 30.5,
  ui: 30.8,
  text: 30.9,
  // the act picker, over everything on the world map
  pick: 30.91,
  pickIcon: 30.92,
  pickText: 30.93,
};

// ---- the feel of panning (view numbers, not gameplay)
/** A press that moves more than this (game px) is a drag, not a tap. */
export const DRAG_PX = 4;
/** Momentum after a fling: the speed halves about every 0.25 s; never faster than this (game px/s). */
const FLING_TAU = 0.36;
const FLING_MAX = 900;
/** A press on a map still gliding faster than this (px/s) only stops it. */
const CATCH_SPEED = 60;
/** The first visit's reveal: a short hold, then a glide from the far east to the current act (ms). */
const TOUR_HOLD = 250;
const TOUR_MS = 1700;
/** The camera easing to a landmark or back home (ms). */
const GLIDE_MS = 480;
/** A land's first reveal (ms from its start): the view glides there from the region before (like the tour), its
 *  veil thins away, motes rise off it, and a card names it. */
const REVEAL_VEIL = [450, 1500];
const REVEAL_CARD = [1300, 3000];
const REVEAL_END = REVEAL_CARD[0] + REVEAL_CARD[1];
/** A land restored (its region won): on the next visit its colour floods back over his draft, out from the keystone
 *  (its boss's landmark), once (ms; a tap ends it). When the next land unveils on the same visit, the view holds on
 *  the restored land this long before it glides on. */
const RESTORE_MS = 2600;
/** The Atlas's lettering: each open land's name across it (world px; the text's centre). */
const LAND_NAMES: Record<string, [string, number, number]> = {
  greenmarch: ['G R E E N M A R C H', 344, 128],
  frostpeaks: ['T H E   F R O S T P E A K S', 380, 22],
  ashfell: ['A S H F E L L', 836, 206],
  duskmire: ['T H E   D U S K M I R E', 712, 212],
};
/** The compass rose drawn in the north-west sea (its texture's top-left, world px). */
const COMPASS_AT: Pt = [170, 30];
/** Colour already back round Rowan (wherever he stands: the blank and ink slide off him) and round each cleared act's
 *  landmark, in a land still in his draft (radius, world px). */
const HOLE_ROWAN = 26;
const HOLE_ACT = 32;

/** The act card's height, and the highest its top sits when it hangs over its landmark (clear of the header). */
const CARD_H = 25;
const CARD_TOP = 38;

/** The act picker's rows: one per act, cleared ones to replay (farm), the next to go on with, later ones locked. */
const PICK_ROW_H = 28;

// clouds drifting east across the whole map (world space: they move with the map, like everything on it): most of
// them along its north and south edges and over the sea, a few high over the north and the middle of the land, clear
// of the landmarks' rows (texture, world y, speed px/s, phase px)
const CLOUDS: Array<[number, number, number, number]> = [
  [2, -6, 2.2, 30],
  [0, 4, 2.9, 420],
  [3, 12, 3.6, 760],
  [1, -2, 2.6, 1010],
  [1, 270, 2.6, 80],
  [0, 282, 2.0, 520],
  [3, 274, 3.1, 860],
  [2, 52, 1.8, 300],
  [0, 70, 2.3, 820],
  [3, 96, 2.0, 560],
];
// gull flocks crossing the map (world space): [phase s, the world rows they fly along, one per crossing]
const GULL_FLOCKS: Array<[number, number[]]> = [
  [0, [60, 150, 230]],
  [12, [110, 40, 200]],
  [24, [180, 90, 260]],
];
const GULL_PER = 36; // s from one crossing of a flock to its next...
const GULL_TRIP = 30; // ...of which the crossing itself (about 33 px a second)
// shadows of clouds sweeping across the land (texture, world y, speed, phase)
const SHADOWS: Array<[number, number, number, number]> = [
  [0, 60, 3.4, 60],
  [1, 150, 2.7, 400],
  [0, 230, 3.0, 760],
  [1, 110, 3.2, 1100],
];

/** A rounded rectangle in 2r + 1 rects (corner rows, then one block). */
function rows(g: G, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  const n = Math.min(r, Math.floor(h / 2));
  for (let i = 0; i < n; i++) {
    const k = cornerInset(i, h, r);
    g.fillRect(x + k, y + i, w - k * 2, 1);
    g.fillRect(x + k, y + h - 1 - i, w - k * 2, 1);
  }
  if (h - n * 2 > 0) g.fillRect(x, y + n, w, h - n * 2);
}

/** A 5x5 compass rose (the header's count of regions restored): gold and lit once restored, dim ink before. */
function roseIcon(g: G, x: number, y: number, lit: boolean): void {
  const [o, f, c] = lit ? [0x5a3410, 0xf2c230, 0xfff0a0] : [INK, 0x3a3054, 0x5a5078];
  g.fillStyle(o, 1);
  g.fillRect(x + 1, y + 1, 3, 3);
  g.fillRect(x + 2, y, 1, 5);
  g.fillRect(x, y + 2, 5, 1);
  g.fillStyle(f, 1);
  g.fillRect(x + 2, y + 1, 1, 3);
  g.fillRect(x + 1, y + 2, 3, 1);
  g.fillStyle(c, 1);
  g.fillRect(x + 2, y + 2, 1, 1);
  if (lit) {
    g.fillStyle(0xfff0a0, 1);
    g.fillRect(x + 2, y, 1, 1);
  }
}

/** Plate colours: crisp dark glass with a light inner edge. */
const PLATE = { fill: 0x110e1c, top: 0x1a1628, edge: 0x4e4668, lo: 0x08070e };

/** Where an act's card rests its foot when it hangs over the landmark (world y): above the landmark and its flag. */
function cardFoot(i: number): number {
  const a = WORLD_ACTS[i];
  return Math.min(a.box.y, a.flag[1] - 12) - 4;
}

/** A closed sea lane resampled to one point per px (ships sail it). */
function lanePath(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  const loop = [...pts, pts[0]];
  for (let i = 0; i < loop.length - 1; i++) {
    const [ax, ay] = loop[i];
    const [bx, by] = loop[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

export class WorldView {
  private g!: G; // UI plates (screen)
  private gSea!: G; // glints, wakes, whales (world)
  private gLand!: G; // smoke, windows, pendulum, pennants, rings (world)
  private gAir!: G; // snow, embers, wisps, motes (world)
  private imgs: Img[] = [];
  private base!: Img;
  private sea!: Img;
  private farSea!: Img;
  private farWave!: Img;
  private wind!: Img;
  private isle!: Img;
  private isleVeil!: Img;
  private lava!: Img;
  private lamp!: Img;
  private rim!: Img;
  private mills: Img[] = [];
  private hero!: Img;
  private pip!: Img;
  private veils: Array<{ id: string; img: Img }> = [];
  private flags: Img[] = [];
  private locks: Img[] = [];
  private pool: ImagePool; // ships, boats, travellers, clouds, birds, puffs, fog (pooled, only what's in view)
  private texts: TextPool;
  private rattle = new Map<string, number>();
  private info: { id: string; at: number } | null = null;
  private chosenAt = 0;
  /** Greenmarch's plate (the call to action over Rowan), as last drawn (screen). */
  plate = { x: 0, y: 0, w: 0, h: 0 };
  /** The act picker (open since `at`, performance.now; `region`: whose acts it lists), and a locked row shaking. */
  private picker: { at: number; region: number } | null = null;
  /** A land's first reveal, playing since `at`. */
  private reveal: { id: string; at: number } | null = null;
  /** A land's restoring (its colour flooding back), playing since `at`. */
  private restore: { id: string; at: number } | null = null;
  /** The strips his drafts are drawn in (cropped round the colour already back), and the compass rose. */
  private strips: Img[] = [];
  private stripN = 0;
  private compass!: Img;
  private nameTexts: TextPool;
  private pickShake: { act: number; at: number } | null = null;
  private gPick!: G;
  private pickTexts: TextPool;
  private pickIcons: ImagePool;
  /** The wandering foe on the road, and its skirmish card. */
  readonly roam: WorldRoam;
  /** Gulls, dolphins and the sparkle out at sea (view/world-life.ts): only the taps nothing else takes. */
  readonly life: WorldLife;

  // ---- the camera (world px at the screen's top-left), and what moves it
  private cam = { x: 0, y: 0 };
  /** The camera as drawn this frame (whole px). */
  ox = 0;
  oy = 0;
  private vel = { x: 0, y: 0 };
  private visit = -1;
  private last = 0;
  private press: { x: number; y: number; cx: number; cy: number; drag: boolean; skip: boolean; samples: Array<[number, number, number]> } | null = null;
  private tour: { at: number; from: Pt; to: Pt; hold: number } | null = null;
  private glideTo: { at: number; from: Pt; to: Pt } | null = null;
  /** The act landmark selected (its card is up), and the moment the screen settled after the tour. */
  private sel: { act: number; at: number } | null = null;
  private uiAt = 0;
  private lanes = SEA_LANES.map(lanePath);
  private whale: { c: number; x: number; y: number } | null = null;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, DEPTH.text);
    this.nameTexts = new TextPool(s, DEPTH.land + 0.004);
    this.pickTexts = new TextPool(s, DEPTH.pickText);
    this.pickIcons = new ImagePool(s);
    this.pool = new ImagePool(s);
    this.roam = new WorldRoam(s, () => ({ x: this.ox, y: this.oy }));
    this.life = new WorldLife(
      s,
      (wx, wy) => !this.targetAt(wx - this.ox, wy - this.oy) && !inRect(this.campButton(), wx - this.ox, wy - this.oy, 3),
      () => this.plateZone(),
      () => ({ x: this.ox, y: this.oy }),
      () => this.home(),
    );
  }

  /** The view's images exist (the world map's textures are painted after boot, view/scene ensureWorldArt). */
  private ready = false;

  build(): void {
    const s = this.s;
    for (const i of this.imgs) i.destroy();
    this.imgs = [];
    this.ready = worldArtReady();
    if (!this.ready) return;
    const img = (key: string, depth: number, ox = 0, oy = 0) => {
      const i = s.add.image(0, 0, key).setOrigin(ox, oy).setDepth(depth).setVisible(false);
      this.imgs.push(i);
      return i;
    };
    this.base = img('world_map', DEPTH.map);
    this.sea = img('wm_sea0', DEPTH.waves);
    this.farSea = img('wm_farsea', DEPTH.map);
    this.farWave = img('wm_farwave0', DEPTH.waves);
    this.wind = img('wm_wind0', DEPTH.surf);
    this.isle = img('wm_isle', DEPTH.isle);
    this.isleVeil = img('wm_isle_veil', DEPTH.veil);
    this.lava = img('wm_lava', DEPTH.glow);
    this.lamp = img('wm_lamp', DEPTH.glow);
    this.mills = WORLD_SPOTS.mills.map(() => img('wm_mill0', DEPTH.land, 0.5, 0.5));
    this.flags = WORLD_ACTS.map(() => img('flag_off0', DEPTH.land, FLAG_ORIGIN.x, FLAG_ORIGIN.y));
    this.hero = img('wm_hero0', DEPTH.actor, 0.5, 1);
    this.pip = img('wm_pip0', DEPTH.pip, 0.5, 0.5);
    this.veils = Object.keys(VEIL_BOXES).map((id) => ({ id, img: img(`wm_veil_${id}`, DEPTH.veil) }));
    this.rim = img('wm_rim', DEPTH.rim);
    this.compass = img('wm_compass', DEPTH.waves + 0.002);
    for (const st of this.strips) st.destroy();
    this.strips = [];
    img('wm_vignette', DEPTH.vignette);
    this.locks = WORLD_REGIONS.filter((r) => r.locked).map(() => img('wm_lock', DEPTH.lock, 0.5, 0.5));
    for (const g of [this.g, this.gSea, this.gLand, this.gAir, this.gPick]) g?.destroy();
    this.gSea = s.add.graphics().setDepth(DEPTH.sea);
    this.gLand = s.add.graphics().setDepth(DEPTH.land);
    this.gAir = s.add.graphics().setDepth(DEPTH.air);
    this.g = s.add.graphics().setDepth(DEPTH.ui);
    this.gPick = s.add.graphics().setDepth(DEPTH.pick);
    this.pickIcons.destroy();
    this.pool.destroy();
    this.roam.build();
    this.life.build();
  }

  // ------------------------------------------------------------------ the camera

  /** The act Rowan is on (the next one to play; the last once all are cleared). */
  private actNow(): number {
    return Math.max(0, Math.min(WORLD_ACTS.length - 1, this.s.app.progress.actsCleared));
  }

  private clampCam(x: number, y: number): Pt {
    return [Math.max(0, Math.min(MAP_W - GAME_W, x)), Math.max(0, Math.min(WORLD_H - GAME_H, y))];
  }

  /** The camera that frames the current act (where the map opens). */
  home(): Pt {
    const [vx, vy] = WORLD_ACTS[this.actNow()].view;
    return this.clampCam(Math.round(vx - GAME_W / 2), Math.round(vy - GAME_H / 2));
  }

  /** A new visit: the camera starts home (the first ever visit: on the far east, gliding home). */
  private arrive(now: number): void {
    const app = this.s.app;
    this.visit = app.phaseSince;
    this.last = now;
    this.vel = { x: 0, y: 0 };
    this.press = null;
    this.glideTo = null;
    this.sel = null;
    this.info = null;
    this.whale = null;
    const h = this.home();
    // a land restored since the last visit: its colour floods back (remembered at once); then a land opened since the
    // last visit: its first reveal (remembered at once, like the tour), after the restoring when both are due
    const rest = restorePending(app.profile);
    this.restore = rest && DRAFT_BOXES[rest] ? { id: rest, at: now } : null;
    if (rest) markRestored(app.profile, rest);
    const hold = this.restore ? RESTORE_MS : TOUR_HOLD;
    const pend = unveilPending(app.profile);
    this.reveal = pend ? { id: pend, at: now + hold - TOUR_HOLD } : null;
    if (pend) markUnveiled(app.profile, pend);
    if (rest || pend) app.saveProfile();
    const firstVisit = !app.profile.worldTour;
    if (firstVisit || pend) {
      app.profile.worldTour = true;
      app.saveProfile();
      // (from this frame on: the first one may have waited for the world's painting to finish); a land's reveal
      // glides in from the last act of the region before it (the very first visit: from the far east)
      const r = pend ? playableIndex(pend) : -1;
      const prev = r > 0 ? WORLD_ACTS[regionStart(r) - 1]?.view : undefined;
      const from = prev && !firstVisit ? this.clampCam(Math.round(prev[0] - GAME_W / 2), Math.round(prev[1] - GAME_H / 2)) : this.clampCam(MAP_W, 0);
      this.tour = { at: now, from, to: h, hold };
      this.cam = { x: from[0], y: from[1] };
      this.uiAt = now + hold + TOUR_MS;
    } else {
      this.tour = null;
      this.cam = { x: h[0], y: h[1] };
      this.uiAt = app.phaseSince;
    }
  }

  /** Whether the first visit's reveal (or a land's first reveal) is playing. */
  get touring(): boolean {
    return !!this.tour;
  }

  /** The land whose colour is flooding back (tests), or null. */
  get restoring(): string | null {
    return this.restore?.id ?? null;
  }

  /** The land whose first reveal is playing (tests), or null. */
  get revealing(): string | null {
    return this.reveal?.id ?? null;
  }

  /** How thick a land's veil is: 1 while locked, 0 once open (thinning away during its first reveal). */
  private veilOf(id: string, now: number): number {
    if (!landOpen(this.s.app.progress, id)) return 1;
    const rv = this.reveal;
    if (!rv || rv.id !== id) return 0;
    return 1 - smooth((now - rv.at - REVEAL_VEIL[0]) / REVEAL_VEIL[1]);
  }

  /** Whether act `i`'s land is open (its landmark shows and takes taps). */
  private actOpen(i: number): boolean {
    return regionOpen(this.s.app.progress, regionOfAct(i));
  }

  /** Whether a land on the continent is still locked (its veil, padlock and name card). */
  private locked(r: Region): boolean {
    return r.locked && !landOpen(this.s.app.progress, r.id);
  }

  /** Ease the camera to frame a world point. */
  private glide(wx: number, wy: number, now: number): void {
    const to = this.clampCam(Math.round(wx - GAME_W / 2), Math.round(wy - GAME_H / 2));
    if (Math.abs(to[0] - this.cam.x) < 2 && Math.abs(to[1] - this.cam.y) < 2) return;
    this.glideTo = { at: now, from: [this.cam.x, this.cam.y], to };
    this.vel = { x: 0, y: 0 };
  }

  /** Move the camera for this frame: the reveal, a glide, a drag (set by the pointer), or momentum. */
  private moveCamera(now: number): void {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.tour) {
      const k = (now - this.tour.at - this.tour.hold) / TOUR_MS;
      const e = smooth(k);
      this.cam.x = this.tour.from[0] + (this.tour.to[0] - this.tour.from[0]) * e;
      this.cam.y = this.tour.from[1] + (this.tour.to[1] - this.tour.from[1]) * e;
      if (k >= 1) this.tour = null;
    } else if (this.glideTo) {
      const k = (now - this.glideTo.at) / GLIDE_MS;
      const e = 1 - (1 - clamp01(k)) ** 3;
      this.cam.x = this.glideTo.from[0] + (this.glideTo.to[0] - this.glideTo.from[0]) * e;
      this.cam.y = this.glideTo.from[1] + (this.glideTo.to[1] - this.glideTo.from[1]) * e;
      if (k >= 1) this.glideTo = null;
    } else if (!this.press?.drag && (this.vel.x || this.vel.y)) {
      this.cam.x += this.vel.x * dt;
      this.cam.y += this.vel.y * dt;
      const f = Math.exp(-dt / FLING_TAU);
      this.vel.x *= f;
      this.vel.y *= f;
      if (Math.hypot(this.vel.x, this.vel.y) < 6) this.vel = { x: 0, y: 0 };
    }
    const [cx, cy] = this.clampCam(this.cam.x, this.cam.y);
    if (cx !== this.cam.x) this.vel.x = 0;
    if (cy !== this.cam.y) this.vel.y = 0;
    this.cam.x = cx;
    this.cam.y = cy;
    this.ox = Math.round(cx);
    this.oy = Math.round(cy);
  }

  /** A finger (or the mouse) goes down on the map (screen game px). */
  pressAt(x: number, y: number, now: number): void {
    const moving = Math.hypot(this.vel.x, this.vel.y) > CATCH_SPEED || !!this.glideTo;
    const skip = !!this.tour || moving;
    // a tap ends a restoring at once (the colour all back)
    this.restore = null;
    if (this.tour) {
      // any tap skips the reveal: straight to where it was going (a land's veil gone, its card still up a moment)
      this.cam = { x: this.tour.to[0], y: this.tour.to[1] };
      this.tour = null;
      this.uiAt = Math.min(this.uiAt, now);
      if (this.reveal) this.reveal.at = Math.min(this.reveal.at, now - REVEAL_VEIL[0] - REVEAL_VEIL[1]);
    }
    this.glideTo = null;
    this.vel = { x: 0, y: 0 };
    this.press = { x, y, cx: this.cam.x, cy: this.cam.y, drag: false, skip, samples: [[now, x, y]] };
  }

  /** The finger moves: past DRAG_PX it's a drag, and the map follows it (no card or picker is up). */
  dragTo(x: number, y: number, now: number): void {
    const p = this.press;
    if (!p) return;
    p.samples.push([now, x, y]);
    while (p.samples.length > 2 && now - p.samples[0][0] > 90) p.samples.shift();
    if (!p.drag) {
      if (Math.hypot(x - p.x, y - p.y) <= DRAG_PX || this.modal) return;
      // from here on it's a drag: start from where the finger is now (no jump)
      p.drag = true;
      p.x = x;
      p.y = y;
      p.cx = this.cam.x;
      p.cy = this.cam.y;
      this.sel = null;
      this.info = null;
    }
    const [cx, cy] = this.clampCam(p.cx - (x - p.x), p.cy - (y - p.y));
    this.cam = { x: cx, y: cy };
  }

  /** The finger lifts: a drag flings the map on; a press that stayed put is a tap. */
  releaseAt(x: number, y: number, now: number): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.drag) {
      const old = p.samples.find(([t]) => now - t <= 90) ?? p.samples[0];
      const dt = (now - old[0]) / 1000;
      if (dt > 0.008) {
        const vx = -(x - old[1]) / dt;
        const vy = -(y - old[2]) / dt;
        const v = Math.hypot(vx, vy);
        const k = v > FLING_MAX ? FLING_MAX / v : 1;
        this.vel = { x: vx * k, y: vy * k };
      }
      return;
    }
    if (p.skip) return;
    this.tap(x, y);
  }

  /** The press was lost (the pointer was cancelled). */
  cancelPress(): void {
    this.press = null;
  }

  /** Whether the map is being dragged right now. */
  get dragging(): boolean {
    return !!this.press?.drag;
  }

  /** A card or the picker is up: the map holds still. */
  private get modal(): boolean {
    return !!this.picker || this.roam.open || !!this.chosenAt;
  }

  /** The camera (world px at the screen's top-left), for tests. */
  camera(): { x: number; y: number } {
    return { x: this.ox, y: this.oy };
  }

  /** Put the camera somewhere (tests and the screenshot of the locked lands). */
  lookAt(wx: number, wy: number): void {
    const [x, y] = this.clampCam(Math.round(wx - GAME_W / 2), Math.round(wy - GAME_H / 2));
    this.cam = { x, y };
    this.vel = { x: 0, y: 0 };
    this.glideTo = null;
    this.tour = null;
  }

  // ------------------------------------------------------------------ what's where (screen px unless noted)

  /** Greenmarch's call to action (the plate over Rowan, or Rowan himself) on screen (tests tap it). */
  greenmarch(): { x: number; y: number } {
    const p = this.plate;
    if (p.w) return { x: Math.round(p.x + p.w / 2), y: Math.round(p.y + p.h / 2) };
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    return { x: hx - this.ox, y: hy - 6 - this.oy };
  }

  /** Where Rowan and his plate stand (world px). */
  private plateZone(): Rect {
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    return { x: hx - 42, y: hy - 58, w: 84, h: 64 };
  }

  /** Act `i`'s landmark on screen (its centre; tests tap it). */
  actSpot(i: number): { x: number; y: number } {
    const a = WORLD_ACTS[i];
    return { x: Math.round(a.box.x + a.box.w / 2 - this.ox), y: Math.round(a.box.y + a.box.h / 2 - this.oy) };
  }

  /** The selected act (its card is up), or null. */
  get selected(): number | null {
    return this.sel?.act ?? null;
  }

  /** What a tap at screen (x, y) points at: the plate or Rowan, an open land's act landmark, the capital, a locked
   *  land, a far land beyond the sea. */
  private targetAt(x: number, y: number): Region | 'capital' | 'plate' | { act: number } | { far: string } | null {
    const p = this.plate;
    if (p.w && x >= p.x - 2 && x < p.x + p.w + 2 && y >= p.y - 2 && y < p.y + p.h + 6) return 'plate';
    const wx = x + this.ox;
    const wy = y + this.oy;
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    if (Math.abs(wx - hx) < 9 && wy > hy - 22 && wy < hy + 5) return 'plate';
    for (let i = 0; i < WORLD_ACTS.length; i++) if (this.actOpen(i) && inRect(WORLD_ACTS[i].box, wx, wy, 2)) return { act: i };
    if (inRect(WORLD_CAPITAL.box, wx, wy)) return 'capital';
    // a locked land: its padlock, Noonspire's island, or anywhere on its land
    for (const r of WORLD_REGIONS) if (this.locked(r) && Math.hypot(r.x - wx, r.y - wy) < 9) return r;
    const bob = Math.round(Math.sin((performance.now() / 1000) * 0.7) * 1.4);
    if (inRect({ ...NOON_BOX, y: NOON_BOX.y + bob }, wx, wy)) return WORLD_REGIONS.find((r) => r.id === 'noonspire') ?? null;
    // a far land: its silhouette (and the fog round it)
    for (const f of FAR_ISLES) if (inRect(f.box, wx, wy, 3)) return { far: f.id };
    const id = worldRegionAt(wx, wy);
    const r = WORLD_REGIONS.find((q) => q.id === id);
    return r && this.locked(r) ? r : null;
  }

  /** The playable region nearest the view's centre among the open ones (the region chip names it). */
  private regionInView(): number {
    const P = this.s.app.progress;
    const cx = this.ox + GAME_W / 2;
    const cy = this.oy + GAME_H / 2;
    let best = 0;
    let bd = Infinity;
    REGIONS.forEach((reg, r) => {
      if (!regionOpen(P, r)) return;
      const start = regionStart(r);
      const views = reg.acts.map((_, i) => WORLD_ACTS[start + i]?.view).filter((v): v is Pt => !!v);
      if (!views.length) return;
      const vx = views.reduce((a, v) => a + v[0], 0) / views.length;
      const vy = views.reduce((a, v) => a + v[1], 0) / views.length;
      const d = Math.hypot(vx - cx, vy - cy);
      if (d < bd) (bd = d), (best = r);
    });
    return best;
  }

  /** The region chip (top right, once an act is cleared and the map has settled): the region in view, how complete
   *  it is ("65%", or the laurel badge at 100%); a tap opens that region's act picker. */
  regionChip(): { r: Rect; region: number; name: string; pct: number; done: boolean } | null {
    const P = this.s.app.progress;
    if (P.actsCleared === 0 || this.tour) return null;
    const region = this.regionInView();
    const name = REGIONS[region].name;
    const c = regionCompletion(P, region);
    const right = c.done ? iconSize('badge_region')[0] : textWidth(pctOf(c.pct), 1, false);
    const w = textWidth(name, 1, true) + right + 16;
    const s = this.s;
    return { r: { x: s.R - w - 5, y: 5, w, h: 16 }, region, name, pct: c.pct, done: c.done };
  }

  /** Open the act picker on region `r`'s acts. */
  private openPicker(r: number, now: number): void {
    this.picker = { at: now, region: r };
    this.info = null;
    this.sel = null;
    this.s.app.audio.uiClick();
  }

  // ------------------------------------------------------------------ the Camp button, the act card, the act picker

  /** The Camp button: bottom left. */
  campButton(): Rect {
    const s = this.s;
    return { x: s.L + 5, y: s.B - 21, w: 56, h: 16 };
  }

  /** The selected act's card (screen): over its landmark, kept on screen and clear of the header. */
  private cardRect(): Rect | null {
    const sel = this.sel;
    if (!sel) return null;
    const s = this.s;
    const { name, status } = this.cardText(sel.act);
    const w = Math.max(textWidth(name, 1, true), textWidth(status, 1, false)) + 12 + 40;
    const h = CARD_H;
    const a = WORLD_ACTS[sel.act];
    let x = Math.round(a.box.x + a.box.w / 2 - this.ox - w / 2);
    let y = Math.round(cardFoot(sel.act) - this.oy - h);
    x = Math.max(s.L + 3, Math.min(s.R - w - 3, x));
    if (y < 36) y = Math.round(a.box.y + a.box.h - this.oy + 4);
    y = Math.max(22, Math.min(s.B - h - 24, y));
    return { x, y, w, h };
  }

  /** The act card's Play button (screen; tests tap it). */
  cardPlay(): Rect | null {
    const r = this.cardRect();
    return r ? { x: r.x + r.w - 40, y: r.y + 5, w: 36, h: 15 } : null;
  }

  private cardText(i: number): { name: string; status: string; col: number } {
    const app = this.s.app;
    const cleared = i < app.profile.actsCleared;
    const name = ALL_ACTS[i]?.name ?? '';
    if (cleared) return { name, status: 'Play again', col: 0x9af06a };
    return { name, status: app.profile.actsCleared > 0 ? 'Continue the story' : 'Begin the story', col: 0xffe680 };
  }

  /** The region the act picker lists (Rowan's, until a region is picked). */
  private pickRegion(): number {
    return this.picker?.region ?? regionOfAct(this.actNow());
  }

  /** The act picker's panel. */
  private pickPanel(): Rect {
    const s = this.s;
    const w = Math.min(272, s.R - s.L - 8);
    const n = REGIONS[this.pickRegion()].acts.length;
    const h = 14 + n * (PICK_ROW_H + 2) + 3;
    return { x: Math.round((s.L + s.R) / 2 - w / 2), y: Math.max(24, Math.round((s.B - h) / 2) + 6), w, h };
  }

  private pickRow(i: number): Rect {
    const p = this.pickPanel();
    return { x: p.x + 6, y: p.y + 13 + i * (PICK_ROW_H + 2), w: p.w - 12, h: PICK_ROW_H };
  }

  playButton(i: number): Rect {
    const r = this.pickRow(i);
    return { x: r.x + r.w - 40, y: r.y + 5, w: 36, h: 16 };
  }

  private closeButton(): Rect {
    const p = this.pickPanel();
    return { x: p.x + p.w - 12, y: p.y - 6, w: 15, h: 15 };
  }

  /** The picker's ribbon (the region's name and completion): a tap opens the region's progress at the camp. */
  private ribbonRect(): Rect {
    const p = this.pickPanel();
    const cx = p.x + p.w / 2;
    return { x: Math.round(cx - 60), y: p.y - 7, w: 120, h: 14 };
  }

  /** Whether the act picker is open (tests and the keyboard look). */
  get pickerOpen(): boolean {
    return !!this.picker;
  }

  /** The keyboard's Escape: close the act picker, or put away the act's card or a land's note. False: nothing was up. */
  escape(): boolean {
    if (this.chosenAt) return false;
    if (!this.picker && !this.sel && !this.info) return false;
    this.picker = null;
    this.sel = null;
    this.info = null;
    this.s.app.audio.uiClick();
    return true;
  }

  /** The keyboard's focus ring: the open acts' landmarks on screen and Rowan's plate (drawn without a button). */
  focusTargets(): Rect[] {
    if (this.picker || this.chosenAt) return [];
    const out: Rect[] = [];
    for (let i = 0; i < WORLD_ACTS.length; i++) {
      if (!this.actOpen(i) || i >= this.s.app.run.playableActs) continue;
      const b = WORLD_ACTS[i].box;
      out.push({ x: b.x - this.ox, y: b.y - this.oy, w: b.w, h: b.h });
    }
    const p = this.plate;
    if (p.w) out.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    return out;
  }

  /** The region (index into REGIONS) whose acts the open picker lists, or null (tests). */
  get pickerRegion(): number | null {
    return this.picker?.region ?? null;
  }

  /** A tap while the act picker is open: an act's row (or its Play button), the close button, or outside it. */
  private pickTap(x: number, y: number): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const now = performance.now();
    if (now - (this.picker?.at ?? 0) < 200) return;
    const close = () => {
      this.picker = null;
      app.audio.uiClick();
    };
    // (rows are the region's acts; each starts its global act)
    const r = this.pickRegion();
    const start = regionStart(r);
    const n = REGIONS[r].acts.length;
    if (x < 0) return this.startAct(Math.max(start, Math.min(start + n, run.playableActs) - 1));
    if (inRect(this.closeButton(), x, y, 3)) {
      notePress(this.closeButton());
      return close();
    }
    if (app.profile.actsCleared >= 1 && inRect(this.ribbonRect(), x, y, 1)) {
      // the region's progress (every part of it, and its 100% reward) at the camp; Back comes back here
      this.picker = null;
      app.audio.uiClick();
      s.camp.openProgress(r);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (!inRect(this.pickRow(i), x, y, 1)) continue;
      if (start + i >= run.playableActs) {
        this.pickShake = { act: i, at: now };
        app.audio.uiClick();
        return;
      }
      notePress(this.playButton(i));
      return this.startAct(start + i);
    }
    if (!inRect(this.pickPanel(), x, y, 2)) close();
  }

  /** Into act `i`: the button sinks, Rowan hops, then the run starts there (a first run: the intro first). */
  private startAct(i: number): void {
    const s = this.s;
    this.chosenAt = performance.now();
    s.app.audio.mapSelect();
    const first = s.app.profile.actsCleared === 0;
    window.setTimeout(
      () => {
        this.chosenAt = 0;
        this.picker = null;
        this.sel = null;
        if (s.app.run.phase !== 'world') return;
        if (first) s.app.startRegion();
        else s.app.startAct(i);
      },
      first ? 420 : 260,
    );
  }

  /** A tap on the world map at screen (x, y) (x < 0: the keyboard picks the current act). */
  tap(x: number, y: number): void {
    const s = this.s;
    const app = s.app;
    if (this.chosenAt) return;
    if (this.picker) return this.pickTap(x, y);
    // the wandering foe (and its card)
    if (this.roam.tap(x, y)) return;
    const now = performance.now();
    if (x < 0) return this.callToAction(now);
    if (inRect(this.campButton(), x, y, 3)) {
      notePress(this.campButton());
      app.audio.uiClick();
      app.openCamp();
      return;
    }
    // the region chip: that region's act picker
    const chip = this.regionChip();
    if (chip && inRect(chip.r, x, y, 3)) {
      notePress(chip.r);
      return this.openPicker(chip.region, now);
    }
    // the selected act's card: Play starts it; anywhere else puts it away (and goes on below)
    const play = this.cardPlay();
    if (play && inRect(play, x, y, 3)) {
      notePress(play);
      return this.startAct(this.sel!.act);
    }
    const card = this.cardRect();
    if (card && inRect(card, x, y, 1)) return;
    // Rowan's marker at the screen's edge (he's off screen): back to him
    const mk = this.homeMarker();
    if (mk && inRect(mk, x, y, 3)) {
      app.audio.uiClick();
      const [hx, hy] = WORLD_ACTS[this.actNow()].view;
      this.glide(hx, hy, now);
      return;
    }
    const t = this.targetAt(x, y);
    const had = this.sel;
    this.sel = null;
    if (!t) {
      if (!had) this.life.tap(x + this.ox, y + this.oy, now);
      return;
    }
    if (t === 'plate') return this.callToAction(now);
    if (t === 'capital') {
      this.info = { id: 'capital', at: now };
      app.audio.uiClick();
      return;
    }
    if ('far' in t) {
      // a far land: its fog thins a moment, a card says what little is known
      this.rattle.set(t.far, now);
      this.info = { id: `far:${t.far}`, at: now };
      app.audio.uiClick();
      return;
    }
    if ('act' in t) {
      const i = t.act;
      if (i >= app.run.playableActs) {
        this.rattle.set(`act${i}`, now);
        this.info = { id: `act${i}`, at: now };
        app.audio.uiClick();
        return;
      }
      if (had?.act === i) return this.startAct(i);
      this.sel = { act: i, at: now };
      this.info = null;
      app.audio.uiClick();
      // frame it with room above for its card (clear of the header)
      const a = WORLD_ACTS[i];
      this.glide(a.box.x + a.box.w / 2, Math.min(a.box.y + a.box.h / 2 - 8, cardFoot(i) - CARD_H - CARD_TOP + GAME_H / 2), now);
      return;
    }
    this.rattle.set(t.id, now);
    this.info = { id: t.id, at: now };
    app.audio.uiClick();
  }

  /** The call to action over Rowan: into the story (a first run), or once an act is cleared the act picker on the
   *  acts of his region. */
  private callToAction(now: number): void {
    const app = this.s.app;
    if (app.profile.actsCleared > 0) return this.openPicker(regionOfAct(this.actNow()), now);
    // into Greenmarch: Rowan hops, rings of light spread from his feet, then the run begins
    this.chosenAt = now;
    this.info = null;
    app.audio.mapSelect();
    window.setTimeout(() => {
      this.chosenAt = 0;
      if (app.run.phase === 'world') app.startRegion();
    }, 420);
  }

  private hide(): void {
    for (const g of [this.g, this.gSea, this.gLand, this.gAir, this.gPick]) g?.clear();
    for (const i of this.imgs) i.setVisible(false);
    this.pool.hide();
    this.texts.hide();
    this.nameTexts.hide();
    for (const st of this.strips) st.setVisible(false);
    this.pickTexts.hide();
    this.pickIcons.hide();
    this.picker = null;
    this.sel = null;
    this.press = null;
    this.reveal = null;
    this.restore = null;
    this.visit = -1;
    this.roam.hide();
    this.life.hide();
  }

  // ------------------------------------------------------------------ the frame

  /** Whether a world point (with a margin) is on screen. */
  private seen(wx: number, wy: number, m = 12): boolean {
    const x = wx - this.ox;
    const y = wy - this.oy;
    return x > -m && x < GAME_W + m && y > -m && y < GAME_H + m;
  }

  /** Place a world-space image (whole px). */
  private at(img: Img, wx: number, wy: number): Img {
    return img.setPosition(Math.round(wx) - this.ox, Math.round(wy) - this.oy);
  }

  draw(now: number): void {
    const s = this.s;
    if (s.app.run.phase !== 'world') return this.hide();
    if (!this.ready) {
      s.ensureWorldArt();
      now = performance.now();
    }
    if (this.visit !== s.app.phaseSince) this.arrive(now);
    if (this.reveal && now - this.reveal.at > REVEAL_END) this.reveal = null;
    if (this.restore && now - this.restore.at > RESTORE_MS) this.restore = null;
    this.moveCamera(now);
    for (const g of [this.g, this.gSea, this.gLand, this.gAir, this.gPick]) g.clear();
    for (const g of [this.gSea, this.gLand, this.gAir]) g.setPosition(-this.ox, -this.oy);
    this.texts.begin();
    this.nameTexts.begin();
    this.pool.begin();
    for (const i of this.imgs) i.setVisible(true);
    const t = now / 1000;

    this.at(this.base, 0, 0);
    this.drawAtlas(now, t);
    this.drawSea(now, t);
    this.drawSky(t);
    this.drawGreenmarch(now, t);
    this.drawCapital(t);
    this.drawLocked(now, t);
    this.drawFar(now, t);
    this.drawUi(now, t);
    this.roam.draw(now);
    this.life.draw(now);
    this.pool.end();
    this.texts.end();
    this.nameTexts.end();
    this.pickTexts.begin();
    this.pickIcons.begin();
    if (this.picker) this.drawPicker(now);
    this.pickIcons.end();
    this.pickTexts.end();
  }

  // ------------------------------------------------------------------ the Atlas: his drafts, the colour coming back

  /** Whether a land is still in his draft (no colour: its region not restored yet), or its colour is flooding back. */
  private drafted(id: string): boolean {
    if (this.restore?.id === id) return true;
    return !regionRestored(this.s.app.progress, playableIndex(id));
  }

  /** The next strip image for this frame (a pooled image of a draft, cropped by the caller). */
  private strip(key: string): Img {
    let im = this.strips[this.stripN];
    if (!im) {
      im = this.s.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.map + 0.005);
      this.strips.push(im);
    }
    this.stripN++;
    if (im.texture.key !== key) im.setTexture(key);
    return im.setVisible(true);
  }

  /**
   * The Atlas over the printed map: the compass rose; each land still in his draft drawn over its colour (in rows of
   * 2 px, cut round the colour already back: round Rowan and each cleared act, and the restoring's growing circle with
   * a ragged edge and a front of gold ink); each open land's name lettered across it.
   */
  private drawAtlas(now: number, t: number): void {
    const P = this.s.app.progress;
    const g = this.gLand;
    this.stripN = 0;
    this.at(this.compass, COMPASS_AT[0], COMPASS_AT[1]);
    const vx0 = this.ox;
    const vy0 = this.oy;
    const vx1 = this.ox + GAME_W;
    const vy1 = this.oy + GAME_H;
    const rs = this.restore;
    const rk = rs ? clamp01((now - rs.at) / RESTORE_MS) : 0;
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    for (const [id, b] of Object.entries(DRAFT_BOXES)) {
      if (!this.drafted(id)) continue;
      const x0 = Math.max(b.x, vx0);
      const x1 = Math.min(b.x + b.w, vx1);
      const y0 = Math.max(b.y, vy0);
      const y1 = Math.min(b.y + b.h, vy1);
      if (x0 >= x1 || y0 >= y1) continue;
      const holes: Array<[number, number, number]> = [[hx, hy - 6, HOLE_ROWAN]];
      const r = playableIndex(id);
      if (r >= 0) {
        const start = regionStart(r);
        REGIONS[r].acts.forEach((_, k) => {
          const a = WORLD_ACTS[start + k];
          if (a && start + k < P.actsCleared) holes.push([a.x, a.y, HOLE_ACT]);
        });
      }
      let front: [number, number, number] | null = null;
      if (rs && rs.id === id && r >= 0) {
        const boss = WORLD_ACTS[regionStart(r) + REGIONS[r].acts.length - 1] ?? WORLD_ACTS[regionStart(r)];
        const corners: Pt[] = [
          [b.x, b.y],
          [b.x + b.w, b.y],
          [b.x, b.y + b.h],
          [b.x + b.w, b.y + b.h],
        ];
        const far = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - boss.x, cy - boss.y)));
        front = [boss.x, boss.y, smooth(clamp01((rk - 0.1) / 0.8)) * (far + 10)];
        holes.push(front);
      }
      const key = `wm_draft_${id}`;
      let blk: Rect | null = null;
      const flush = () => {
        if (blk) this.strip(key).setPosition(b.x - this.ox, b.y - this.oy).setCrop(blk.x - b.x, blk.y - b.y, blk.w, blk.h);
        blk = null;
      };
      for (let y = y0 - ((y0 - b.y) % 2); y < y1; y += 2) {
        const yy = Math.max(y, y0);
        const hh = Math.min(y + 2, y1) - yy;
        const cuts: Array<[number, number]> = [];
        for (const [cx, cy, cr] of holes) {
          const rr = cr * (1 + (rnd((y >> 1) * 7 + Math.round(cx), 91) - 0.5) * 0.14);
          const dy = y + 1 - cy;
          if (Math.abs(dy) >= rr) continue;
          const half = Math.sqrt(rr * rr - dy * dy);
          cuts.push([Math.round(cx - half), Math.round(cx + half)]);
          // the front of the colour coming back: gold ink where it meets his draft
          if (front && cr === front[2] && rk < 0.95) {
            const a = Math.min(1, (0.95 - rk) * 6);
            // a band of warm light just inside the front: the colour arriving
            const band = Math.min(10, Math.round(half));
            g.fillStyle(0xffd890, 0.22 * a);
            g.fillRect(Math.round(cx - half), y, band, 2);
            g.fillRect(Math.round(cx + half) - band, y, band, 2);
            g.fillStyle(0xf2c230, a);
            g.fillRect(Math.round(cx - half) - 1, y, 2, 2);
            g.fillRect(Math.round(cx + half) - 1, y, 2, 2);
            if (rnd(y, Math.floor(now / 90)) < 0.25) {
              g.fillStyle(0xfff0a0, a);
              g.fillRect(Math.round(cx - half) - 2, y, 1, 1);
              g.fillRect(Math.round(cx + half) + 1, y + 1, 1, 1);
            }
          }
        }
        cuts.sort((p, q) => p[0] - q[0]);
        let cur = x0;
        const segs: Array<[number, number]> = [];
        for (const [a, c] of cuts) {
          if (a > cur) segs.push([cur, Math.min(a, x1)]);
          cur = Math.max(cur, c);
          if (cur >= x1) break;
        }
        if (cur < x1) segs.push([cur, x1]);
        const whole = segs.length === 1 && segs[0][0] === x0 && segs[0][1] === x1;
        const open = blk as Rect | null;
        if (whole && open && open.y + open.h === yy) {
          open.h += hh;
          continue;
        }
        flush();
        if (whole) {
          blk = { x: x0, y: yy, w: x1 - x0, h: hh };
          continue;
        }
        for (const [a, c] of segs) if (c > a) this.strip(key).setPosition(b.x - this.ox, b.y - this.oy).setCrop(a - b.x, yy - b.y, c - a, hh);
      }
      flush();
      // motes of gold rising off the land as its colour comes back
      if (front && rk < 1) {
        const ga = this.gAir;
        for (let m = 0; m < 40; m++) {
          const ang = rnd(m, 92) * TAU;
          const rad = front[2] * (0.35 + rnd(m, 93) * 0.65);
          const per = 0.9 + rnd(m, 94) * 0.8;
          const u = frac(t / per + rnd(m, 95));
          const x = Math.round(front[0] + Math.cos(ang) * rad);
          const y = Math.round(front[1] + Math.sin(ang) * rad * 0.8 - u * 10);
          if (!this.seen(x, y, 0)) continue;
          ga.fillStyle(m % 3 ? 0xfff0a0 : WHITE, Math.sin(u * Math.PI) * Math.min(1, (1 - rk) * 4));
          ga.fillRect(x, y, 1, 1);
        }
      }
    }
    for (let i = this.stripN; i < this.strips.length; i++) this.strips[i].setVisible(false);
    // the lettering: each land's name across it once it's drawn
    for (const [id, [name, x, y]] of Object.entries(LAND_NAMES)) {
      if (!(id === 'greenmarch' || this.veilOf(id, now) < 1) || !this.seen(x, y, 90)) continue;
      // (pale lettering with the font's ink edge: it reads on the painted land, drained or restored)
      this.nameTexts.text(name, x - this.ox, y - this.oy, 0xecdcb4, { bold: true, ox: 0.5, oy: 0.5, alpha: id === 'greenmarch' ? 1 : 1 - this.veilOf(id, now) });
    }
  }

  // ------------------------------------------------------------------ the sea

  private drawSea(now: number, t: number): void {
    const g = this.gSea;
    // wave marks crest and break; the surf rolls in over three frames, then the beach foam lingers
    this.at(this.sea, 0, 0).setTexture(`wm_sea${Math.floor(now / 250) % SEA_FRAMES}`);
    // the far sea past the continent's east coast (painted on its own), its wave marks in step
    const farSeen = this.ox + GAME_W > WORLD_W;
    this.at(this.farSea, WORLD_W, 0).setVisible(farSeen);
    this.at(this.farWave, WORLD_W, 0).setTexture(`wm_farwave${Math.floor(now / 250) % SEA_FRAMES}`).setVisible(farSeen);

    // sun glints popping on the open sea (a sparse grid of cells over what's in view)
    const open = WORLD_LIFE.open;
    // (never on a far land's silhouette, nor a whale there)
    const farIn = FAR_ISLES.filter((f) => this.seen(f.box.x + f.box.w / 2, f.box.y + f.box.h / 2, f.box.w)).map((f) => f.box);
    if (open.length) {
      const CW = 18;
      const CH = 13;
      for (let cy = Math.floor(this.oy / CH); cy <= Math.floor((this.oy + GAME_H) / CH); cy++)
        for (let cx = Math.floor(this.ox / CW); cx <= Math.floor((this.ox + GAME_W) / CW); cx++) {
          const k = cx * 131 + cy;
          if (rnd(k, 0) > 0.3) continue;
          const per = 2.2 + rnd(k, 1) * 1.6;
          const u = frac(t / per + rnd(k, 2));
          if (u > 0.3) continue;
          const c = Math.floor(t / per + rnd(k, 2));
          const x = cx * CW + Math.floor(rnd(k * 7 + c, 3) * CW);
          const y = cy * CH + Math.floor(rnd(k * 5 + c, 4) * CH);
          // (the far sea past the continent is all open water)
          if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= WORLD_H - 1 || (x < WORLD_W && !open[y * WORLD_W + x])) continue;
          if (farIn.length && farIn.some((b) => inRect(b, x, y, 2))) continue;
          // (on the Atlas: a little ink ripple drawn and fading, not a glint of sun)
          const big = u > 0.08 && u < 0.22;
          g.fillStyle(0x7a6a78, big ? 0.75 : 0.45);
          g.fillRect(x - 1, y, big ? 3 : 2, 1);
          if (big) {
            g.fillStyle(0x7a6a78, 0.45);
            g.fillRect(x - 2, y + 1, 1, 1);
            g.fillRect(x + 2, y - 1, 1, 1);
          }
        }
    }

    // ships: each lane carries a cog or two at their own pace
    this.lanes.forEach((path, li) => {
      for (let j = 0; j < (li === 1 ? 2 : 1); j++) {
        const speed = 3 + li * 0.4;
        const n = path.length;
        const d = (t * speed + j * (n / 2) + li * 97) % n;
        const i0 = Math.floor(d);
        const [x0, y0] = path[i0];
        const [x1] = path[(i0 + 4) % n];
        if (!this.seen(x0, y0, 20)) continue;
        const dir = x1 >= x0 ? 1 : -1;
        const x = Math.round(x0);
        const y = Math.round(y0);
        const bob = Math.floor(t * 1.4 + j * 0.5 + li) % 2;
        this.at(this.pool.foot(`wm_ship${Math.floor(t * 1.8 + j + li) % 2}`, 0, 0, DEPTH.ship), x - 7, y + bob - 12).setFlipX(dir < 0);
        // the wake: foam peeling off the stern, fading
        for (let k = 1; k <= 4; k++) {
          const wx = x - dir * (6 + k * 3) + (k % 2 ? 0 : dir);
          const on = (Math.floor(t * 4) + k) % 2 === 0;
          g.fillStyle(0xf8ecc8, (1 - k / 5) * (on ? 0.9 : 0.6));
          g.fillRect(wx, y - 1 + (k % 2), on ? 2 : 1, 1);
        }
        g.fillStyle(0xf8ecc8, 0.8);
        g.fillRect(x + dir * 7, y - 1, 1, 1);
      }
    });

    // a whale surfaces and spouts now and then (somewhere in view, when there's deep water there)
    const deep = WORLD_LIFE.deep;
    const per = 12;
    const c = Math.floor(t / per);
    if (!this.whale || this.whale.c !== c) {
      const near = deep.filter(([x, y]) => this.seen(x, y, -24) && !FAR_ISLES.some((f) => inRect(f.fog, x, y, 10)));
      const sp = near.length ? near[Math.floor(rnd(c, 7) * near.length)] : null;
      this.whale = sp ? { c, x: sp[0], y: sp[1] } : { c, x: -999, y: -999 };
    }
    const u = (t - c * per) / 3.4;
    if (u < 1 && this.whale.x > 0) {
      const { x, y } = this.whale;
      const rise = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
      g.fillStyle(0xbfe4f8, 0.7 * rise);
      g.fillRect(x - 7, y + 1, 3, 1);
      g.fillRect(x + 5, y + 1, 3, 1);
      g.fillRect(x - 4, y + 2, 9, 1);
      if (rise > 0.3) {
        g.fillStyle(0x08101e, 1);
        g.fillRect(x - 5, y - 1, 11, 2);
        g.fillRect(x - 3, y - 2, 7, 1);
        g.fillStyle(0x2e4a72, 1);
        g.fillRect(x - 4, y - 1, 8, 1);
        g.fillStyle(0x5a7ab0, 1);
        g.fillRect(x - 2, y - 2, 4, 1);
        g.fillStyle(0x9ab8e0, 1);
        g.fillRect(x - 1, y - 2, 1, 1);
      }
      const sp = (u - 0.2) / 0.4;
      if (sp > 0 && sp < 1) {
        const hgt = Math.round(Math.sin(sp * Math.PI) * 6);
        g.fillStyle(WHITE, 0.9);
        g.fillRect(x - 1, y - 2 - hgt, 1, hgt);
        if (sp > 0.35) {
          g.fillStyle(0xd8f0ff, 0.85 * (1 - sp));
          g.fillRect(x - 3, y - 2 - hgt, 2, 1);
          g.fillRect(x, y - 2 - hgt, 2, 1);
          g.fillRect(x - 4, y - hgt, 1, 1);
          g.fillRect(x + 2, y - hgt, 1, 1);
        }
      }
      if (u > 0.68 && u < 0.92) {
        g.fillStyle(0x0c1830, 1);
        g.fillRect(x + 4, y - 3, 3, 1);
        g.fillRect(x + 5, y - 2, 1, 2);
      }
    }

    // fishing boats rock at their piers
    WORLD_LIFE.boats.forEach(([bx, by], i) => {
      if (!this.seen(bx, by)) return;
      const img = this.pool.foot(`wm_boat${Math.floor(t * 0.9 + i) % 2}`, 0, 0, DEPTH.ship);
      this.at(img, bx - 4, by - 6 + (Math.floor(t * 1.3 + i) % 2));
    });
  }

  // ------------------------------------------------------------------ clouds, cloud shadows, birds

  private drawSky(t: number): void {
    const W = WORLD_W;
    SHADOWS.forEach(([k, y, speed, ph]) => {
      const span = W + 120;
      const x = Math.round(((ph + t * speed) % span) - 60);
      if (!this.seen(x + 30, y + 8, 60)) return;
      this.at(this.pool.at(`wm_shadow${k}`, 0, 0, DEPTH.shadow, 0.18), x, y);
    });
    CLOUDS.forEach(([k, y, speed, ph], i) => {
      const span = W + 140;
      const x = Math.round(((ph + t * speed) % span) - 70);
      const sy = y + Math.round(Math.sin(t * 0.5 + i) * 0.6);
      if (!this.seen(x + 30, sy + 10, 60)) return;
      this.at(this.pool.at(`wm_cloudsh${k % CLOUD_KINDS}`, 0, 0, DEPTH.shadow, 0.24), x + 6, sy + 13);
      // (L7: dusk clouds, a muted lavender grey rather than bright white)
      this.at(this.pool.at(`wm_cloud${k % CLOUD_KINDS}`, 0, 0, DEPTH.cloud, 0.85, 0xa49cb4), x, sy);
    });
    // (the painted map's cloud band along the far north: not on the Atlas, whose sheet ends in its neatline)
    this.rim.setVisible(false);

    // gulls: flocks of three crossing the whole map (in world space, so a drag never carries them along), staggered
    // so that one crosses the view every so often wherever you look
    GULL_FLOCKS.forEach(([ph, rows], i) => {
      const c = Math.floor((t + ph) / GULL_PER);
      const u = ((t + ph) / GULL_PER - c) * (GULL_PER / GULL_TRIP);
      if (u >= 1) return;
      const dir = (c + i) % 2 ? -1 : 1;
      const lead = -30 + u * (WORLD_W + 60);
      const y0 = rows[c % rows.length];
      if (!this.seen(dir > 0 ? lead : WORLD_W - lead, y0, 20)) return;
      for (let k = 0; k < 3; k++) {
        const x = dir > 0 ? lead + [0, -6, -6][k] : WORLD_W - lead + [0, 6, 6][k];
        const y = y0 + [0, -4, 4][k] + Math.sin(u * TAU * 4) * 4;
        this.pool.mid(`wm_bird${Math.floor(t * 5 + k * 0.7) % 2}`, Math.round(x) - this.ox, Math.round(y) - this.oy, DEPTH.bird);
      }
    });
    // crows circling over the forests
    WORLD_LIFE.birds.forEach(([bx, by], i) => {
      if (!this.seen(bx, by, 30)) return;
      for (let k = 0; k < 2; k++) {
        const a = t * (0.5 + i * 0.07) + k * Math.PI + i;
        const x = bx + Math.cos(a) * (12 + k * 3);
        const y = by - 10 + Math.sin(a) * 4;
        this.at(this.pool.mid(`wm_crow${Math.floor(t * 4 + k + i) % 2}`, 0, 0, DEPTH.bird, 0.9), x - 3, y - 2);
      }
    });
  }

  // ------------------------------------------------------------------ Greenmarch: Rowan, Pip, the acts, the villages

  private drawGreenmarch(now: number, t: number): void {
    const g = this.gLand;
    const app = this.s.app;
    const P = app.progress;
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;

    // Rowan: breathing; hops when an act is chosen
    const since = this.chosenAt ? now - this.chosenAt : -1;
    const hop = since >= 0 ? Math.round(Math.sin(Math.min(1, since / 300) * Math.PI) * 5) : 0;
    g.fillStyle(0x0c1410, 0.45);
    g.fillRect(hx - 3, hy, 7, 1);
    g.fillRect(hx - 2, hy + 1, 5, 1);
    this.at(this.hero, hx, hy + 1 - hop).setTexture(`wm_hero${Math.floor(t * 1.7) % 2}`);
    // Pip circles Rowan, passing behind him and back in front (once they've met: Pip joins at the start of Act 1)
    this.pip.setVisible(P.actsCleared > 0);
    const pa = t * 1.5;
    this.at(this.pip, hx + Math.cos(pa) * 10, hy - 12 + Math.sin(pa) * 2.5 + Math.sin(t * 5.3) * 0.8 - hop * 1.5)
      .setTexture(`wm_pip${Math.floor(t * 7) % 2}`)
      .setDepth(Math.sin(pa) > 0 ? DEPTH.pip : DEPTH.actor - 0.005);
    // a beacon ring at Rowan's feet: "start here"
    if (!this.chosenAt) {
      const k = frac(t / 1.6);
      this.ellipse(g, hx + 0.5, hy + 0.5, 4 + k * 9, 1.5 + k * 3.5, 0xfff0a0, (1 - k) * 0.8);
    } else {
      const k = clamp01(since / 400);
      this.ellipse(g, hx + 0.5, hy + 0.5, 4 + k * 22, 1.5 + k * 9, 0xffffff, 1 - k);
      this.ellipse(g, hx + 0.5, hy + 0.5, 2 + k * 14, 1 + k * 6, 0xfff0a0, 1 - k);
    }
    // golden motes drift up round the hero (this is where the adventure is)
    const ga = this.gAir;
    for (let k = 0; k < 10; k++) {
      const per = 2.6 + rnd(k, 11) * 1.8;
      const u = frac(t / per + rnd(k, 12));
      const c = Math.floor(t / per + rnd(k, 12));
      const x = Math.round(hx - 26 + rnd(k * 7 + c, 13) * 52 + Math.sin(u * TAU + k) * 1.5);
      const y = Math.round(hy + 6 - rnd(k * 5 + c, 14) * 18 - u * 12);
      ga.fillStyle(k % 3 ? 0xfff0a0 : WHITE, Math.sin(u * Math.PI) * 0.9);
      ga.fillRect(x, y, 1, 1);
    }

    // the act to play next: a soft ring breathes round its landmark ("here's your next adventure")
    if (!this.sel && !this.tour && P.actsCleared > 0 && P.actsCleared < WORLD_ACTS.length && this.actOpen(P.actsCleared)) {
      const a = WORLD_ACTS[P.actsCleared];
      const k = pulse(now, 1400);
      this.ellipse(g, a.box.x + a.box.w / 2, a.box.y + a.box.h - 3, a.box.w / 2 + 1, 5, 0xfff0a0, 0.25 + 0.3 * k);
    }
    // the selected act: a gold ring breathes round its landmark
    if (this.sel) {
      const a = WORLD_ACTS[this.sel.act];
      const k = pulse(now, 900);
      const pop = easeBack((now - this.sel.at) / 260, 1.6);
      const cx = a.box.x + a.box.w / 2;
      const cy = a.box.y + a.box.h - 3;
      this.ellipse(g, cx, cy + 1, (a.box.w / 2 + 2) * pop, 5 * pop, 0x9a5a14, 0.5 + 0.3 * k);
      this.ellipse(g, cx, cy, (a.box.w / 2 + 2) * pop, 5 * pop, 0xfff0a0, 0.7 + 0.3 * k);
      this.ellipse(g, cx, cy, (a.box.w / 2 - 1) * pop, 3.8 * pop, 0xf2c230, 0.4 + 0.3 * k);
    }

    // now and then a gust of wind rolls east over the meadows and the forest
    const gust = Math.floor(((t + 2) % 8) / 0.16);
    const wb = WORLD_BOXES.wind;
    if (gust < WIND_FRAMES && !this.drafted('greenmarch') && this.seen(wb.x + wb.w / 2, wb.y + wb.h / 2, 260)) this.at(this.wind, wb.x, wb.y).setTexture(`wm_wind${gust}`);
    else this.wind.setVisible(false);
    // the windmills turn
    WORLD_SPOTS.mills.forEach(([mx, my], i) => this.at(this.mills[i], mx, my).setTexture(`wm_mill${Math.floor(t * 4 + i) % 2}`).setVisible(this.seen(mx, my)));
    // chimney smoke curls up and east
    WORLD_LIFE.chimneys.forEach(([cx, cy], i) => {
      if (!this.seen(cx, cy)) return;
      for (let j = 0; j < 3; j++) {
        const u = frac(t / 2.6 + j / 3 + rnd(i, 21));
        const x = Math.round(cx + u * 3 + Math.sin(u * 5 + i) * 1);
        const y = Math.round(cy - u * 9);
        g.fillStyle(u < 0.4 ? 0xe8e4ec : 0xb8b6c8, (1 - u) * 0.85);
        const sz = u < 0.55 ? 2 : 1;
        g.fillRect(x, y, sz, sz);
      }
    });
    // windows: lamps lit inside, flickering now and then
    WORLD_LIFE.windows.forEach(([x, y], i) => {
      if (!this.seen(x, y, 2)) return;
      if (frac(t / (5 + rnd(i, 31) * 6) + rnd(i, 32)) >= 0.7) return;
      g.fillStyle(rnd(i + Math.floor(t * 6), 33) < 0.08 ? 0xffb040 : 0xffd860, 1);
      g.fillRect(x, y, 1, 1);
    });
    // fires: campfires and torches flicker, their smoke rising
    WORLD_SPOTS.fires.forEach(([fx, fy], i) => {
      if (!this.seen(fx, fy)) return;
      const f = Math.floor(t * 9 + i * 1.7) % 3;
      g.fillStyle(0xff5a1e, 1);
      g.fillRect(fx - 1, fy - 1, 3, 1);
      g.fillStyle(0xffb02a, 1);
      g.fillRect(fx - (f === 1 ? 1 : 0), fy - 2, f === 1 ? 2 : 1, 1);
      g.fillStyle(0xfff0a0, 1);
      g.fillRect(fx + (f === 2 ? 1 : 0), fy - 3 + (f === 0 ? 1 : 0), 1, 1);
      g.fillStyle(0xffd060, 0.18 + 0.08 * f);
      g.fillRect(fx - 3, fy - 3, 7, 4);
      for (let j = 0; j < 2; j++) {
        const u = frac(t / 2.2 + j / 2 + rnd(i, 41));
        g.fillStyle(0xa8a4b4, (1 - u) * 0.6);
        g.fillRect(Math.round(fx + u * 2 + Math.sin(u * 6 + i)), Math.round(fy - 4 - u * 8), 1, 1);
      }
    });
    // the runes at the Old Ruins breathe; the eyes in the Boar King's den blink
    const rk = 0.5 + 0.5 * Math.sin(t * 1.8);
    WORLD_SPOTS.glows.forEach(([x, y], i) => {
      if (!this.seen(x, y)) return;
      g.fillStyle(0x62e4d4, 0.25 * rk);
      g.fillRect(x - 1, y - 2, 3, 3);
      g.fillStyle(0xd8fff6, 0.5 + 0.5 * Math.sin(t * 1.8 + i));
      g.fillRect(x, y, 1, 1);
    });
    if (frac(t / 4.3) > 0.06)
      WORLD_SPOTS.eyes.forEach(([x, y]) => {
        if (!this.seen(x, y)) return;
        g.fillStyle(0xff8a5a, 0.35 + 0.25 * Math.sin(t * 3));
        g.fillRect(x - 1, y, 3, 1);
        g.fillStyle(0xffd0a0, 1);
        g.fillRect(x, y, 1, 1);
      });
    // the forest waterfall pours, mist where it lands
    const fl = WORLD_SPOTS.falls;
    if (this.seen(fl.x, fl.y0))
      for (let j = 0; j < 4; j++) {
        const y = fl.y0 + ((t * 16 + j * 3) % (fl.y1 - fl.y0 - 1));
        g.fillStyle(WHITE, 0.85);
        g.fillRect(fl.x + (j % 2), Math.round(y), 1, 2);
        const m = frac(t * 0.8 + j / 4);
        g.fillStyle(0xe8f8ff, 0.6 * (1 - m));
        g.fillRect(Math.round(fl.x - 2 + j * 1.5 + m * (j - 1.5) * 2), Math.round(fl.y1 + 1 - m * 3), 1, 1);
      }
    // travellers: the merchant's cart and folk on foot go back and forth along the roads
    this.travellers(t);
    // sheep graze in the paddocks
    for (const [sp, n] of [
      [WORLD_SPOTS.sheep, 5],
      [WORLD_SPOTS.sheep2, 4],
    ] as const) {
      if (!this.seen(sp.x + sp.w / 2, sp.y + sp.h / 2)) continue;
      for (let k = 0; k < n; k++) {
        const ax = t * (0.09 + rnd(k, 61) * 0.06) + k * 2.3;
        const ay = t * (0.07 + rnd(k, 62) * 0.05) + k;
        const x = Math.round(sp.x + 3 + rnd(k + sp.x, 63) * (sp.w - 8) + Math.sin(ax) * 2.5);
        const y = Math.round(sp.y + 3 + rnd(k + sp.y, 64) * (sp.h - 7) + Math.sin(ay) * 1.5);
        const face = Math.cos(ax) >= 0 ? 1 : -1;
        const graze = frac(t / (3 + rnd(k, 65) * 2) + rnd(k, 66)) < 0.4 ? 1 : 0;
        g.fillStyle(0x0c1c10, 0.35);
        g.fillRect(x, y + 2, 3, 1);
        g.fillStyle(0xf4f0e8, 1);
        g.fillRect(x, y, 3, 2);
        g.fillStyle(0xc4c0d0, 1);
        g.fillRect(face > 0 ? x : x + 2, y + 1, 1, 1);
        g.fillStyle(0x3a3040, 1);
        g.fillRect(face > 0 ? x + 3 : x - 1, y + graze, 1, 1);
      }
    }
    // the lighthouse lamp flashes, its beam sweeping out to sea
    const lh = WORLD_SPOTS.lighthouse;
    const lk = frac(t / 2.6);
    if (lk < 0.3 && this.seen(lh.x, lh.y, 20)) {
      const a = Math.sin((lk / 0.3) * Math.PI);
      g.fillStyle(0xfff6c0, 0.35 * a);
      g.fillRect(lh.x - 1, lh.y - 1, 4, 3);
      g.fillStyle(WHITE, a);
      g.fillRect(lh.x, lh.y, 2, 1);
      const side = Math.floor(t / 2.6) % 2 ? 1 : -1;
      for (let k = 1; k <= 7; k++) {
        g.fillStyle(0xfff0a0, 0.7 * a * (1 - k / 8));
        g.fillRect(side > 0 ? lh.x + 1 + k : lh.x - k, lh.y, 1, 1);
      }
    }
    // a flag per act cleared waves proudly; the others hang pale (a small padlock on the ones still out of reach);
    // a veiled land shows none
    WORLD_ACTS.forEach((a, i) => {
      if (!this.actOpen(i)) {
        this.flags[i].setVisible(false);
        return;
      }
      const on = i < P.actsCleared;
      const fr = Math.floor(t * (on ? 6 : 3) + i * 1.3) % FLAG_FRAMES;
      this.at(this.flags[i], a.flag[0], a.flag[1]).setTexture(`${on ? 'flag_on' : 'flag_off'}${fr}`);
      if (i >= app.run.playableActs && this.seen(a.flag[0], a.flag[1])) {
        const since2 = now - (this.rattle.get(`act${i}`) ?? -1e9);
        const shake = since2 < 320 ? Math.round(Math.sin(since2 / 22) * 2) : 0;
        this.at(this.pool.mid('wm_lock', 0, 0, DEPTH.lock), a.flag[0] + 6 + shake, a.flag[1] - 3);
      }
    });
    // the second region's landmarks once its veil lifts: prayer flags flutter at the pass, crystals glint in the
    // cave mouth, the wyrm circles her keep
    const vf = this.veilOf('frostpeaks', now);
    if (vf < 1) {
      const F = FROST_SIGHTS;
      if (this.seen(F.prayer.x + 13, F.prayer.y + 5, 30)) this.at(this.pool.at(`wm_prayer${Math.floor(t * 2.5) % 2}`, 0, 0, DEPTH.land + 0.001), F.prayer.x, F.prayer.y);
      if (this.seen(F.cave.x + 7, F.cave.y + 5, 30)) {
        this.at(this.pool.at('wm_cave', 0, 0, DEPTH.land + 0.001), F.cave.x, F.cave.y);
        F.glints.forEach(([x, y], i) => {
          const k = 0.5 + 0.5 * Math.sin(t * 2.3 + i * 2.1);
          g.fillStyle(i % 2 ? 0xd8fbff : 0x7ae0ff, 0.3 + 0.7 * k);
          g.fillRect(x, y, 1, 1);
        });
      }
      const w = F.wyrm;
      if (this.seen(w.x, w.y, 50)) {
        const a = t * 0.42;
        const img = this.pool.mid(`wm_wyrm${Math.floor(t * 2.6) % 2}`, 0, 0, DEPTH.bird, 1 - vf);
        this.at(img, w.x + Math.cos(a) * w.rx - img.width / 2, w.y + Math.sin(a) * w.ry - img.height / 2).setFlipX(Math.sin(a) < 0);
      }
    }
    // the third region's landmarks once its veil lifts (it never does until the region is in play): the half-paved
    // road, the glass glinting in the cave mouth, the forge on the rim breathing, its chain glowing across the crater
    const va = this.veilOf('ashfell', now);
    if (va < 1) {
      const A = ASH_SIGHTS;
      if (this.seen(A.road.x + 13, A.road.y + 4, 30)) this.at(this.pool.at('wm_ashroad', 0, 0, DEPTH.land + 0.001), A.road.x, A.road.y);
      if (this.seen(A.cave.x + 7, A.cave.y + 5, 30)) {
        this.at(this.pool.at('wm_glasscave', 0, 0, DEPTH.land + 0.001), A.cave.x, A.cave.y);
        A.glints.forEach(([x, y], i) => {
          const k = 0.5 + 0.5 * Math.sin(t * 2.1 + i * 1.9);
          g.fillStyle([0xffd070, 0x9ae89a, 0xc89aff, 0xff8a7a][i % 4], 0.3 + 0.7 * k);
          g.fillRect(x, y, 1, 1);
        });
      }
      if (this.seen(A.forge.x + 6, A.forge.y + 5, 40)) {
        this.at(this.pool.at(`wm_forge${Math.floor(t * 1.6) % 2}`, 0, 0, DEPTH.land + 0.001), A.forge.x, A.forge.y);
        const { a, b, sag } = A.chain;
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          const x = Math.round(a[0] + (b[0] - a[0]) * u);
          const y = Math.round(a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * sag);
          const hot = 0.6 + 0.4 * Math.sin(t * 2 + k * 0.7);
          g.fillStyle(k % 2 ? 0xff8a24 : 0x5a4236, k % 2 ? hot : 1);
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    // a laurel badge beside the boss's flag of each region done to 100%
    REGIONS.forEach((reg, r) => {
      if (!regionOpen(P, r) || !regionBadge(P, r)) return;
      const a = WORLD_ACTS[regionStart(r) + reg.acts.length - 1];
      if (!a || !this.seen(a.flag[0], a.flag[1], 20)) return;
      hudIcon(g, 'badge_region', a.flag[0] + 6, a.flag[1] - 15 + Math.round(Math.sin(t * 1.6 + r) * 0.8));
    });
  }

  /** The merchant's cart and walkers, each pacing a road back and forth (resting a moment at each end). */
  private travellers(t: number): void {
    const roads = WORLD_ROADS;
    if (!roads.length) return;
    const walkers: Array<{ road: number; speed: number; phase: number; key: (moving: boolean, f: number) => string; w: number }> = [
      { road: 2, speed: 5, phase: 30, key: (m, f) => `wm_cart${m ? f : 0}`, w: 4 },
      { road: 0, speed: 4.2, phase: 10, key: (m, f) => `wm_walk0_${m ? f : 0}`, w: 2 },
      { road: 1, speed: 3.6, phase: 4, key: (m, f) => `wm_walk2_${m ? f : 0}`, w: 2 },
      { road: 2, speed: 4.4, phase: 70, key: (m, f) => `wm_walk1_${m ? f : 0}`, w: 2 },
      { road: 3, speed: 3.2, phase: 12, key: (m, f) => `wm_walk3_${m ? f : 0}`, w: 2 },
      { road: 4, speed: 3.8, phase: 6, key: (m, f) => `wm_walk${WALKER_KINDS - 2}_${m ? f : 0}`, w: 2 },
    ];
    walkers.forEach((wk, i) => {
      const path = roads[wk.road % roads.length];
      const n = path.length;
      const leg = n / wk.speed;
      const T = leg * 2 + 6;
      const c = (t + wk.phase) % T;
      let idx: number;
      let dir: number;
      if (c < 3) (idx = 0), (dir = 1);
      else if (c < 3 + leg) (idx = (c - 3) * wk.speed), (dir = 1);
      else if (c < 6 + leg) (idx = n - 1), (dir = -1);
      else (idx = n - 1 - (c - 6 - leg) * wk.speed), (dir = -1);
      const moving = !(c < 3 || (c >= 3 + leg && c < 6 + leg));
      const [x0, y0] = path[Math.max(0, Math.min(n - 1, Math.round(idx)))];
      const ahead = path[Math.max(0, Math.min(n - 1, Math.round(idx) + dir * 3))];
      const flip = ahead[0] < x0 || (ahead[0] === x0 && dir < 0);
      if (!this.seen(x0, y0)) return;
      const f = Math.floor(t * 6 + i) % 2;
      const hop = moving && wk.w > 3 ? Math.floor(t * 4) % 2 : 0;
      this.at(this.pool.foot(wk.key(moving, f), 0, 0, DEPTH.land + 0.002), x0 - (wk.w > 3 ? 5 : 2), y0 - (wk.w > 3 ? 5 : 5) - hop).setFlipX(flip);
    });
  }

  /** A pixel ellipse outline (rings on the ground). */
  private ellipse(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
    if (alpha <= 0.02 || rx <= 0) return;
    g.fillStyle(color, alpha);
    const n = Math.max(12, Math.round((rx + ry) * 2.2));
    let lx = 1e9;
    let ly = 1e9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const x = Math.round(cx + Math.cos(a) * rx - 0.5);
      const y = Math.round(cy + Math.sin(a) * ry - 0.5);
      if (x === lx && y === ly) continue;
      g.fillRect(x, y, 1, 1);
      lx = x;
      ly = y;
    }
  }

  // ------------------------------------------------------------------ the capital and the Atlas Hall

  private drawCapital(t: number): void {
    const g = this.gLand;
    const P = this.s.app.progress;
    const pv = WORLD_SPOTS.pendulum;
    if (!this.seen(pv.x, pv.y, 60)) return;
    // the Atlas's light glowing in the Hall's three windows under the dome: faint while its lines fade, brighter the
    // more regions are restored (docs/story-bible.md section 9)
    const lit = 0.3 + 0.7 * (P.weights / WEIGHTS_TOTAL);
    const breathe = 0.82 + 0.18 * Math.sin(t * 1.7);
    for (const dx of [-3, 0, 3]) {
      g.fillStyle(0xf2c230, lit * breathe);
      g.fillRect(pv.x + dx, pv.y + 1, 1, 3);
      g.fillStyle(0xfff0a0, lit * breathe);
      g.fillRect(pv.x + dx, pv.y, 1, 1);
    }
    // pennants on the turrets
    WORLD_SPOTS.turrets.forEach(([tx, ty], i) => {
      const fr = Math.floor(t * 5 + i) % 2;
      g.fillStyle(0x4a5272, 1);
      g.fillRect(tx, ty - 4, 1, 4);
      g.fillStyle(0xd03030, 1);
      g.fillRect(tx + 1, ty - 4, 2, 1);
      g.fillRect(tx + 1, ty - 3, fr ? 3 : 2, 1);
      g.fillStyle(0x8a1a22, 1);
      g.fillRect(tx + 3, ty - (fr ? 4 : 3), 1, 1);
    });
    // a glint runs over the lantern's gold finial now and then
    const k = frac(t / 4.5);
    if (k < 0.12) {
      g.fillStyle(WHITE, 1 - k / 0.12);
      g.fillRect(pv.x, pv.y - 13, 1, 1);
      g.fillRect(pv.x - 1, pv.y - 12, 3, 1);
    }
    // the town's smoke: a few columns drifting east over the roofs
    WORLD_SPOTS.capitalSmoke.forEach(([cx, cy], i) => {
      for (let j = 0; j < 4; j++) {
        const u = frac(t / 3.4 + j / 4 + rnd(i, 81));
        g.fillStyle(u < 0.4 ? 0xe8e4ec : 0xb8b6c8, (1 - u) * 0.7);
        const sz = u < 0.5 ? 2 : 1;
        g.fillRect(Math.round(cx + u * 6 + Math.sin(u * 4 + i)), Math.round(cy - u * 14), sz, sz);
      }
    });
  }

  // ------------------------------------------------------------------ the locked lands: alive under their fog

  private drawLocked(now: number, t: number): void {
    const ga = this.gAir;
    const g = this.gLand;
    // the veils drift a little; a tapped land's fog thins for a moment ("a peek"); an open land's is gone (it thins
    // away during the land's first reveal, motes of light rising off it)
    for (const v of this.veils) {
      const b = VEIL_BOXES[v.id];
      const since = now - (this.rattle.get(v.id) ?? -1e9);
      const peek = since < 2200 ? Math.sin(Math.min(1, since / 2200) * Math.PI) : 0;
      const thick = this.veilOf(v.id, now);
      if (thick <= 0) {
        v.img.setVisible(false);
        continue;
      }
      // (erased land is blank paper: it lies still; a peek thins it to show the impression's land beneath)
      this.at(v.img, b.x, b.y).setAlpha((1 - 0.55 * peek) * thick);
    }
    if (this.reveal) this.revealMotes(now, t);
    // Frostpeaks: snow falling over the range (what's in view), a plume blown off the highest summit
    const fb = VEIL_BOXES.frostpeaks;
    // (nothing moves on erased land: each land's life only once it's drawn back)
    const live = (id: string) => this.veilOf(id, now) < 1;
    if (live('frostpeaks') && this.seen(fb.x + fb.w / 2, fb.y + fb.h / 2, 280))
      for (let k = 0; k < 60; k++) {
        const x0 = fb.x + rnd(k, 41) * fb.w;
        const vy = 5 + rnd(k, 42) * 5;
        const H = 100;
        const y = Math.round(4 + ((t * vy + rnd(k, 43) * H) % H));
        const x = Math.round(x0 + Math.sin(t * 1.1 + k) * 2 + ((t * 2) % 4));
        if (!this.seen(x, y, 0)) continue;
        ga.fillStyle(WHITE, k % 4 ? 0.85 : 0.6);
        ga.fillRect(x, y, 1, 1);
      }
    for (let k = 0; k < 6 && live('frostpeaks'); k++) {
      const u = frac(t / 2.2 + k / 6);
      const x = Math.round(380 + u * 18 + Math.sin(u * 7 + k));
      const y = Math.round(8 - Math.sin(u * Math.PI) * 2 + u * 3);
      if (!this.seen(x, y)) continue;
      ga.fillStyle(WHITE, (1 - u) * 0.8);
      ga.fillRect(x, y, u < 0.4 ? 2 : 1, 1);
    }
    // Ashfell: the volcano breathes (the glow swells, smoke puffs roll off east, embers spit), steam off the coast
    const cr = WORLD_SPOTS.crater;
    const lb = WORLD_BOXES.lava;
    this.at(this.lava, lb.x, lb.y).setAlpha(0.45 + 0.35 * Math.sin(t * 1.9) + 0.12 * Math.sin(t * 7.3)).setVisible(live('ashfell'));
    if (live('ashfell') && this.seen(cr.x, cr.y, 80)) {
      for (let j = 0; j < 7; j++) {
        const u = frac(t / 4.6 + j / 7);
        const x = cr.x + u * 34 + Math.sin(u * 6 + j) * 1.5;
        const y = cr.y - 3 - u * 16 + u * u * 7;
        const img = this.pool.mid(`wm_puff${u < 0.2 ? 0 : u < 0.55 ? 1 : 2}`, 0, 0, DEPTH.air, Math.min(1, u * 8, (1 - u) * 1.6) * 0.95);
        this.at(img, x - img.width / 2, y - img.height / 2);
      }
      for (let k = 0; k < 6; k++) {
        const u = frac(t / 1.4 + k / 6 + rnd(k, 51));
        const c = Math.floor(t / 1.4 + k / 6 + rnd(k, 51));
        const x = Math.round(cr.x + (rnd(k * 9 + c, 52) - 0.5) * 8 + u * (rnd(c, k) - 0.3) * 8);
        const y = Math.round(cr.y - u * 11 + u * u * 6);
        ga.fillStyle(u < 0.5 ? 0xffe070 : 0xff7a2a, 1 - u);
        ga.fillRect(x, y, 1, 1);
      }
    }
    WORLD_SPOTS.steam.forEach(([sx, sy], i) => {
      if (!live('ashfell') || !this.seen(sx, sy, 20)) return;
      for (let j = 0; j < 3; j++) {
        const u = frac(t / 3 + j / 3 + i * 0.4);
        const img = this.pool.mid(`wm_steam${u < 0.3 ? 0 : 1}`, 0, 0, DEPTH.air, (1 - u) * 0.7);
        this.at(img, sx + u * 6 - img.width / 2, sy - u * 10 - img.height / 2);
      }
    });
    // Duskmire: mist banks drift to and fro, wisps wander, the Mirelight pulses
    WORLD_SPOTS.fog.forEach(([fx, fy], i) => {
      const x = fx + Math.sin(t * 0.18 + i * 2) * 8;
      if (!live('duskmire') || !this.seen(x, fy, 30)) return;
      const img = this.pool.mid(`wm_fog${i % 2}`, 0, 0, DEPTH.fog, 0.32 + 0.1 * Math.sin(t * 0.4 + i));
      this.at(img, x - img.width / 2, fy + Math.sin(t * 0.3 + i) * 0.8 - img.height / 2);
    });
    WORLD_SPOTS.wisps.forEach(([wx, wy], i) => {
      const a = clamp01(0.5 + Math.sin(t * 0.8 + i * 2.1) * 0.9);
      if (a <= 0 || !live('duskmire') || !this.seen(wx, wy, 14)) return;
      const x = Math.round(wx + Math.sin(t * 0.6 + i * 2) * 10);
      const y = Math.round(wy + Math.sin(t * 1.3 + i) * 3 - Math.abs(Math.sin(t * 2.2 + i)) * 2);
      const tx = Math.round(wx + Math.sin(t * 0.6 + i * 2 - 0.25) * 10);
      ga.fillStyle(0x4ad8a0, 0.35 * a);
      ga.fillRect(x - 1, y, 3, 1);
      ga.fillRect(x, y - 1, 1, 3);
      ga.fillStyle(0x9af0c8, 0.4 * a);
      ga.fillRect(tx, y + 1, 1, 1);
      ga.fillStyle(0xe0fff0, a);
      ga.fillRect(x, y, 1, 1);
    });
    const mb = WORLD_BOXES.lamp;
    this.at(this.lamp, mb.x, mb.y).setAlpha(0.55 + 0.45 * Math.sin(t * 2.4)).setVisible(live('duskmire'));
    // Noonspire: the island floats, its waterfall pours, the sun on its spire twinkles
    const dy = Math.round(Math.sin(t * 0.7) * 1.4);
    const io = WORLD_SPOTS.isle;
    this.at(this.isle, io.x, io.y + dy);
    const nsince = now - (this.rattle.get('noonspire') ?? -1e9);
    const npeek = nsince < 2200 ? Math.sin(Math.min(1, nsince / 2200) * Math.PI) : 0;
    this.at(this.isleVeil, io.x, io.y + dy).setAlpha(1 - 0.5 * npeek);
    const fl = WORLD_SPOTS.isleFalls;
    if (this.seen(fl.x, fl.y0, 30))
      for (let j = 0; j < 4; j++) {
        const y = fl.y0 + ((t * 18 + j * 5.5) % (fl.y1 - fl.y0 - 4));
        g.fillStyle(WHITE, 0.9);
        g.fillRect(fl.x + (j % 2), Math.round(y) + dy, 1, 2);
      }
    const sun = WORLD_SPOTS.sun;
    if (this.seen(sun.x, sun.y)) {
      const diag = Math.floor(t * 1.6) % 2 === 1;
      ga.fillStyle(0xfff0a0, 0.9);
      const rays = diag
        ? [
            [-3, -3],
            [3, -3],
            [-4, 2],
            [4, 2],
          ]
        : [
            [0, -4],
            [-4, -1],
            [4, -1],
            [-3, 3],
            [3, 3],
          ];
      for (const [rx, ry] of rays) ga.fillRect(sun.x + rx, sun.y + ry + dy, 1, 1);
    }

    // small padlocks: a glint sweeps each now and then; a tap rattles it (an open land's fades with its veil)
    let li = 0;
    for (const r of WORLD_REGIONS) {
      if (!r.locked) continue;
      const thick = this.veilOf(r.id, now);
      if (thick <= 0) {
        this.locks[li++].setVisible(false);
        continue;
      }
      const since = now - (this.rattle.get(r.id) ?? -1e9);
      const shake = since < 320 ? Math.round(Math.sin(since / 22) * 2) : 0;
      const ly = r.y + (r.id === 'noonspire' ? dy : 0);
      this.at(this.locks[li], r.x + shake, ly).setAlpha(thick);
      const k = frac(t / 3.8 + li * 0.27);
      if (k < 0.1 && thick >= 1 && this.seen(r.x, ly)) {
        g.fillStyle(WHITE, 1 - k / 0.1);
        g.fillRect(r.x + shake - 2, ly - 1, 1, 1);
        g.fillRect(r.x + shake - 3, ly, 3, 1);
      }
      li++;
    }
  }

  /** Motes of light rising off a land as its veil thins away (its first reveal), over its landmarks. */
  private revealMotes(now: number, t: number): void {
    const rv = this.reveal!;
    const r = playableIndex(rv.id);
    const k = (now - rv.at - REVEAL_VEIL[0]) / (REVEAL_VEIL[1] + 600);
    if (r < 0 || k <= 0 || k >= 1) return;
    const start = regionStart(r);
    const boxes = REGIONS[r].acts.map((_, i) => WORLD_ACTS[start + i]?.box).filter((b): b is Rect => !!b);
    if (!boxes.length) return;
    const x0 = Math.min(...boxes.map((b) => b.x)) - 30;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + 30;
    const y0 = Math.min(...boxes.map((b) => b.y)) - 10;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + 10;
    const ga = this.gAir;
    const fade = Math.sin(k * Math.PI);
    for (let m = 0; m < 30; m++) {
      const per = 1.4 + rnd(m, 71) * 1.2;
      const u = frac(t / per + rnd(m, 72));
      const c = Math.floor(t / per + rnd(m, 72));
      const x = Math.round(x0 + rnd(m * 7 + c, 73) * (x1 - x0));
      const y = Math.round(y1 - rnd(m * 5 + c, 74) * (y1 - y0) - u * 14);
      if (!this.seen(x, y, 0)) continue;
      const a = Math.sin(u * Math.PI) * fade;
      ga.fillStyle(m % 3 ? 0xfff0a0 : WHITE, a);
      ga.fillRect(x, y, 1, 1);
      if (m % 4 === 0 && u > 0.3 && u < 0.7) {
        ga.fillStyle(0xd8f0ff, a * 0.7);
        ga.fillRect(x - 1, y, 1, 1);
        ga.fillRect(x + 1, y, 1, 1);
        ga.fillRect(x, y - 1, 1, 1);
        ga.fillRect(x, y + 1, 1, 1);
      }
    }
  }

  // ------------------------------------------------------------------ the far lands beyond the sea

  /** The far lands: dim silhouettes at the map's edges, each under a fog bank that thins as weights come home
   *  (core/world-plan.ts); a tapped one's fog thins for a moment. */
  private drawFar(now: number, t: number): void {
    const weights = this.s.app.progress.weights;
    FAR_ISLES.forEach((f, i) => {
      const b = f.fog;
      if (!this.seen(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + 8)) return;
      const plan = planRegion(f.id);
      const fog = plan ? fogOf(weights, plan) : 1;
      const since = now - (this.rattle.get(f.id) ?? -1e9);
      const peek = since < 2200 ? Math.sin(Math.min(1, since / 2200) * Math.PI) : 0;
      // the land: hazy while fogged, clear once its fog lifts
      this.at(this.pool.at(`wm_far_${f.id}`, 0, 0, DEPTH.far, Math.min(1, 0.82 + 0.18 * (1 - fog) + 0.1 * peek)), f.box.x, f.box.y);
      if (fog <= 0) return;
      // its fog bank drifts to and fro
      const dx = Math.round(Math.sin(t * 0.21 + i * 1.7) * 2);
      const dy = Math.round(Math.sin(t * 0.17 + i) * 0.8);
      this.at(this.pool.at(`wm_farfog_${f.id}`, 0, 0, DEPTH.fog, fog * (1 - 0.55 * peek)), b.x + dx, b.y + dy);
    });
  }

  // ------------------------------------------------------------------ plates: header, the call to action, cards

  /** Rowan's marker at the screen's edge, while he's off screen (a tap brings the view back to him). */
  private homeMarker(): Rect | null {
    if (this.tour || this.glideTo) return null;
    const s = this.s;
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    const x = hx - this.ox;
    const y = hy - 8 - this.oy;
    if (x > s.L + 4 && x < s.R - 4 && y > 4 && y < s.B - 4) return null;
    const w = 15;
    const h = 17;
    const cx = Math.max(s.L + 64, Math.min(s.R - w - 4, x - w / 2));
    const cy = Math.max(36, Math.min(s.B - h - 4, y - h / 2));
    return { x: Math.round(cx), y: Math.round(cy), w, h };
  }

  private drawUi(now: number, t: number): void {
    const s = this.s;
    const g = this.g;
    const P = s.app.progress;
    const phase = now - this.uiAt;

    // the call to action over Rowan: his region (Greenmarch), and a glossy "Tap to begin!" button (hidden while a
    // card is up)
    const [hx, hy] = WORLD_ACTS[this.actNow()].stand;
    const sub = P.actsCleared > 0 ? 'Pick an act' : 'Tap to begin!';
    const name = REGIONS[regionOfAct(this.actNow())].name;
    const bw = textWidth(sub, 1, true) + 8;
    const w = Math.max(textWidth(name, 1, true) + 12, bw + 6);
    const ph = 28;
    // (only before the first act is cleared: after that the landmarks are the call to action)
    const pop = this.tour || this.sel || P.actsCleared > 0 ? 0 : clamp01(phase / 260);
    const bob = this.chosenAt ? 0 : Math.round(Math.sin(t * 3.2) * 1);
    const x = Math.round(hx - this.ox - w / 2);
    const y = Math.round(hy - this.oy - 20 - ph - 4 + bob + (1 - pop) * 6);
    const onScreen = x > s.L - w + 8 && x < s.R - 8 && y > -ph && y < s.B;
    this.plate = pop > 0 && onScreen ? { x, y, w, h: ph } : { x: 0, y: 0, w: 0, h: 0 };
    if (pop > 0 && onScreen) {
      this.panel(g, x, y, w, ph, pop);
      // the tail points down at Rowan
      const tx = Math.round(hx - this.ox);
      g.fillStyle(INK, pop);
      g.fillRect(tx - 3, y + ph, 7, 1);
      g.fillRect(tx - 2, y + ph + 1, 5, 1);
      g.fillRect(tx - 1, y + ph + 2, 3, 1);
      g.fillRect(tx, y + ph + 3, 1, 1);
      g.fillStyle(PLATE.fill, pop);
      g.fillRect(tx - 2, y + ph, 5, 1);
      g.fillRect(tx - 1, y + ph + 1, 3, 1);
      g.fillRect(tx, y + ph + 2, 1, 1);
      this.texts.text(name, x + w / 2, y + 7, 0xffe680, { bold: true, ox: 0.5, oy: 0.5, alpha: pop });
      const bx = Math.round(x + (w - bw) / 2);
      const by = y + 13;
      const press = this.chosenAt ? 1 : 0;
      this.button(g, bx, by + press, bw, 12, t, pop);
      this.texts.text(sub, bx + bw / 2, by + 6 + press, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: pop });
    }

    // the selected act's card: its name, what playing it means, Play
    const card = this.cardRect();
    if (card && this.sel) {
      const a = clamp01((now - this.sel.at) / 140);
      const { name: an, status, col } = this.cardText(this.sel.act);
      const k = easeBack((now - this.sel.at) / 220, 1.5);
      const cy = card.y + Math.round((1 - k) * 5);
      this.panel(g, card.x, cy, card.w, card.h, a);
      this.texts.text(an, card.x + 6, cy + 7, WHITE, { bold: true, oy: 0.5, alpha: a });
      this.texts.text(status, card.x + 6, cy + 17, col, { oy: 0.5, alpha: a });
      const b0 = this.cardPlay()!;
      const b = { ...b0, y: b0.y + cy - card.y };
      const pr = isPressed(b0, now) || this.chosenAt > 0;
      glow(g, b, 0xffe680, (0.3 + 0.35 * pulse(now, 900)) * a, 2);
      button3d(g, b, this.sel.act < P.actsCleared ? FACE.green : FACE.gold, pr);
      this.texts.text('Play', b.x + b.w / 2, b.y + b.h / 2 + (pr ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
    }

    // header: the Great Atlas and the regions restored (a small compass rose per region, lit once restored;
    // docs/story-bible.md section 9)
    const L = s.L + 4;
    const restored = `Regions restored: ${whole(P.weights)}/${whole(WEIGHTS_TOTAL)}`;
    const hw = Math.max(textWidth('The Great Atlas', 1, true), textWidth(restored, 1, false), WEIGHTS_TOTAL * 7 - 2) + 14;
    this.panel(g, L, 4, hw, 29, 1);
    this.texts.text('The Great Atlas', L + 7, 10, WHITE, { bold: true, oy: 0.5 });
    this.texts.text(restored, L + 7, 19, 0xf2c230, { oy: 0.5 });
    for (let i = 0; i < WEIGHTS_TOTAL; i++) roseIcon(g, L + 7 + i * 7, 24, i < P.weights);

    // the region chip (top right): the region in view and how complete it is; a tap opens its act picker
    const chip = this.regionChip();
    if (chip) {
      const ca = clamp01(phase / 260);
      const ck = easeBack(phase / 260, 1.6);
      const r = { ...chip.r, y: chip.r.y - Math.round((1 - ck) * 8) };
      const pr = isPressed(chip.r, now);
      button3d(g, r, FACE.navy, pr);
      const dy = pr ? 2 : 0;
      const tw = textWidth(chip.name, 1, true);
      this.texts.text(chip.name, r.x + 6, r.y + r.h / 2 + dy, WHITE, { bold: true, oy: 0.5, alpha: ca });
      if (chip.done) {
        const [, ih] = iconSize('badge_region');
        hudIcon(g, 'badge_region', r.x + 10 + tw, r.y + Math.round((r.h - ih) / 2) + dy, 1, ca);
      } else this.texts.text(pctOf(chip.pct), r.x + 10 + tw, r.y + r.h / 2 + dy, 0xffe680, { oy: 0.5, alpha: ca });
    }

    // a land's first reveal: a card names it as its veil thins away
    const rv = this.reveal;
    if (rv) {
      const age = now - rv.at - REVEAL_CARD[0];
      if (age > 0 && age < REVEAL_CARD[1]) {
        const a = Math.min(1, age / 160, (REVEAL_CARD[1] - age) / 300);
        const title = REGIONS[playableIndex(rv.id)]?.name ?? '';
        const line = 'A new land!';
        const iw = Math.max(textWidth(title, 1, true), textWidth(line, 1, false)) + 20;
        const ih = 23;
        const k = easeBack(age / 260, 1.6);
        // (low on the screen: the land and its landmarks stay in view above it)
        const ix = Math.round((s.L + s.R) / 2 - iw / 2);
        const iy = s.B - ih - 16 + Math.round((1 - k) * 6);
        this.panel(g, ix, iy, iw, ih, a);
        glow(g, { x: ix, y: iy, w: iw, h: ih }, 0xffe680, (0.25 + 0.25 * pulse(now, 900)) * a, 2);
        this.texts.text(title, ix + iw / 2, iy + 7, 0xffe680, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
        this.texts.text(line, ix + iw / 2, iy + 16, WHITE, { ox: 0.5, oy: 0.5, alpha: a });
      }
    }

    // a land restored: its card as the colour comes back
    const rs = this.restore;
    if (rs) {
      const age = now - rs.at - RESTORE_MS * 0.4;
      const span = RESTORE_MS * 0.6 + 500;
      if (age > 0 && age < span) {
        const a = Math.min(1, age / 160, (span - age) / 300);
        const title = REGIONS[playableIndex(rs.id)]?.name ?? '';
        const line = 'Restored!';
        const iw = Math.max(textWidth(title, 1, true), textWidth(line, 1, false)) + 20;
        const ih = 23;
        const k = easeBack(age / 260, 1.6);
        const ix = Math.round((s.L + s.R) / 2 - iw / 2);
        const iy = s.B - ih - 16 + Math.round((1 - k) * 6);
        this.panel(g, ix, iy, iw, ih, a);
        glow(g, { x: ix, y: iy, w: iw, h: ih }, 0xffe680, (0.25 + 0.25 * pulse(now, 900)) * a, 2);
        this.texts.text(title, ix + iw / 2, iy + 7, 0xffe680, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
        this.texts.text(line, ix + iw / 2, iy + 16, 0x8af06a, { ox: 0.5, oy: 0.5, alpha: a });
      }
    }

    // the Camp button (bottom left): a tent and "Camp" on a navy key
    const cb = this.campButton();
    const cpop = clamp01((now - s.app.phaseSince - 120) / 260);
    if (cpop > 0) {
      const ck = easeBack((now - s.app.phaseSince - 120) / 260, 1.6);
      const r = { ...cb, y: cb.y + Math.round((1 - ck) * 10) };
      const pr = isPressed(cb, now);
      button3d(g, r, FACE.navy, pr);
      const [iw, ih] = glyphSize('tent');
      const tw = textWidth('Camp', 1, true);
      const x0 = Math.round(r.x + (r.w - iw - 3 - tw) / 2);
      const dy = pr ? 2 : 0;
      glyph(g, 'tent', x0, r.y + Math.round((r.h - ih) / 2) + dy, cpop);
      this.texts.text('Camp', x0 + iw + 3, r.y + r.h / 2 + dy, WHITE, { bold: true, oy: 0.5, alpha: cpop });
    }

    // Rowan's marker at the edge while he's off screen: a chip with his face and an arrow toward him
    const mk = this.homeMarker();
    if (mk) {
      const pr = isPressed(mk, now);
      button3d(g, mk, FACE.navy, pr);
      this.pool.at('wm_hero0', mk.x + 2, mk.y + 1 + (pr ? 2 : 0), DEPTH.ui + 0.01, 1);
      const [hx2, hy2] = WORLD_ACTS[this.actNow()].stand;
      const ang = Math.atan2(hy2 - this.oy - (mk.y + mk.h / 2), hx2 - this.ox - (mk.x + mk.w / 2));
      const ax = Math.round(mk.x + mk.w / 2 + Math.cos(ang) * 11);
      const ay = Math.round(mk.y + mk.h / 2 + Math.sin(ang) * 11);
      g.fillStyle(INK, 1);
      g.fillRect(ax - 2, ay - 2, 5, 5);
      g.fillStyle(0xffe680, 0.6 + 0.4 * pulse(now, 800));
      g.fillRect(ax - 1, ay - 1, 3, 3);
    }

    // a card after a tap: a locked land's name, an act out of reach, or the Pendulum's state
    const inf = this.info;
    if (inf) {
      const age = now - inf.at;
      if (age > 1900) this.info = null;
      else {
        const a = Math.min(1, age / 90, (1900 - age) / 250);
        let title: string;
        let line: string;
        let ax: number;
        let ay: number;
        let col = 0xff9a8a;
        if (inf.id === 'capital') {
          title = 'The Great Atlas';
          line = P.weights === 0 ? 'Its lines are fading.' : P.weights >= WEIGHTS_TOTAL ? 'Whole again.' : `${whole(P.weights)} of ${whole(WEIGHTS_TOTAL)} regions restored.`;
          ax = WORLD_CAPITAL.x;
          ay = WORLD_CAPITAL.y + 16;
          col = 0xffe680;
        } else if (inf.id.startsWith('act')) {
          const i = Number(inf.id.slice(3));
          title = ALL_ACTS[i]?.name ?? '';
          line = `Clear Act ${i} first`;
          ax = WORLD_ACTS[i].flag[0];
          ay = WORLD_ACTS[i].flag[1] - 16;
          col = 0xc8c0e8;
        } else if (inf.id.startsWith('far:')) {
          // a far land: no name until its fog lifts (and none yet after)
          const f = FAR_ISLES.find((q) => `far:${q.id}` === inf.id)!;
          const plan = planRegion(f.id);
          const fog = plan ? fogOf(P.weights, plan) : 1;
          const open = !!plan && revealed(P.weights, plan);
          // (erased land until its name is revealed: docs/story-bible.md section 9)
          const name = open && plan ? planName(P.weights, plan) : '?';
          title = name !== '?' ? name : 'Erased land';
          line = open ? 'Beyond the sea' : fog < 1 ? 'Something is being drawn here.' : 'Restore more regions to bring it back.';
          ax = f.box.x + f.box.w / 2;
          ay = f.box.y + f.box.h + 14;
          col = 0xb8d0f0;
        } else {
          const r = WORLD_REGIONS.find((q) => q.id === inf.id)!;
          // a land still blank: which land to restore first (the one before it, named only once the player can see
          // it), or just erased
          const ri = playableIndex(r.id);
          title = r.name;
          line = ri > 0 && regionOpen(this.s.app.progress, ri - 1) ? `Restore ${REGIONS[ri - 1].name} first` : 'Erased land';
          ax = r.x;
          ay = r.y + 23;
        }
        const iw = Math.max(textWidth(title, 1, true), textWidth(line, 1, false)) + 14;
        const ih = 22;
        let ix = Math.round(Math.max(s.L + 3, Math.min(s.R - iw - 3, ax - this.ox - iw / 2)));
        let iy = Math.round(Math.max(36, Math.min(s.B - ih - 24, ay - this.oy - ih / 2)));
        // never over Greenmarch's plate (its texts would show through): slide right of it, or below it
        const p = this.plate;
        const hits = () => p.w > 0 && ix < p.x + p.w + 3 && p.x < ix + iw + 3 && iy < p.y + p.h + 6 && p.y < iy + ih + 3;
        if (hits()) ix = Math.round(Math.min(s.R - iw - 3, p.x + p.w + 4));
        if (hits()) iy = Math.round(Math.min(GAME_H - ih - 4, p.y + p.h + 8));
        iy += Math.round((1 - Math.min(1, age / 120)) * 3);
        this.panel(g, ix, iy, iw, ih, a);
        this.texts.text(title, ix + iw / 2, iy + 7, col, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
        this.texts.text(line, ix + iw / 2, iy + 16, WHITE, { ox: 0.5, oy: 0.5, alpha: a });
      }
    }
  }

  // ------------------------------------------------------------------ the act picker

  /**
   * The act picker: a navy panel popping in over the dimmed map, one row per act (staggered in): its number badge
   * (a tick once cleared, a padlock while locked), its name and what playing it means ("Play again", "Continue the
   * story"), the gear level its drops have, its boss's signature drops in their rarity frames (a tick on the ones in
   * the bag), and Play.
   */
  private drawPicker(now: number): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const g = this.gPick;
    const T = this.pickTexts;
    const since = now - (this.picker?.at ?? now);
    g.fillStyle(0x05040a, 0.55 * clamp01(since / 140));
    g.fillRect(0, 0, GAME_W, GAME_H);
    const p0 = this.pickPanel();
    const k = easeBack(since / 240, 1.5);
    const sc = 0.8 + 0.2 * k;
    const p: Rect = { x: Math.round(p0.x + (p0.w * (1 - sc)) / 2), y: Math.round(p0.y + (p0.h * (1 - sc)) / 2), w: Math.round(p0.w * sc), h: Math.round(p0.h * sc) };
    if (since < 40) return;
    panel(g, p, { trim: 'full', alpha: clamp01(since / 120) });
    if (k < 0.98) return;
    const cx = p.x + p.w / 2;
    // the ribbon names the region and how complete it is (the laurel badge at 100%)
    const region = this.pickRegion();
    const start = regionStart(region);
    const comp = regionCompletion(app.profile, region);
    const rname = REGIONS[region].name;
    const tw = textWidth(rname, 1, true);
    const [bw, bh] = iconSize('badge_region');
    const rw = comp.done ? bw : textWidth(pctOf(comp.pct), 1, false);
    const tot = tw + 5 + rw;
    ribbon(g, cx, p.y - 6, Math.max(104, tot + 26), 13, RIBBON.green);
    const tx0 = Math.round(cx - tot / 2);
    T.text(rname, tx0, p.y + 0.5, WHITE, { bold: true, oy: 0.5 });
    if (comp.done) hudIcon(g, 'badge_region', tx0 + tw + 5, Math.round(p.y + 0.5 - bh / 2));
    else T.text(pctOf(comp.pct), tx0 + tw + 5, p.y + 0.5, 0xfff0a0, { oy: 0.5 });
    // a small arrow: the ribbon opens the region's progress
    if (app.profile.actsCleared >= 1) chevron(g, tx0 + tot + 4, Math.round(p.y - 2), 5, 0xfff0a0, 0.9, 1);
    // close: a red key with an X
    const cb = this.closeButton();
    const cpr = isPressed(cb, now);
    button3d(g, cb, FACE.red, cpr);
    const xy = cb.y + (cpr ? 2 : 0);
    for (let i = 0; i < 5; i++) {
      g.fillStyle(INK, 1);
      g.fillRect(cb.x + 4 + i, xy + 4 + i, 3, 2);
      g.fillRect(cb.x + 8 - i, xy + 4 + i, 3, 2);
    }
    for (let i = 0; i < 5; i++) {
      g.fillStyle(WHITE, 1);
      g.fillRect(cb.x + 5 + i, xy + 4 + i, 1, 1);
      g.fillRect(cb.x + 9 - i, xy + 4 + i, 1, 1);
    }
    const owned = new Set(app.profile.items.map((it) => it.base));
    REGIONS[region].acts.forEach((act, i) => {
      const gi = start + i; // the act's global number
      const ck = easeBack((since - 110 - i * 70) / 240, 1.4);
      if (ck <= 0) return;
      const a = clamp01(ck * 1.5);
      const r0 = this.pickRow(i);
      const sh = this.pickShake && this.pickShake.act === i && now - this.pickShake.at < 260 ? Math.round(Math.sin((now - this.pickShake.at) / 18) * 2) : 0;
      const ox = Math.round((1 - ck) * 50) + sh;
      const r: Rect = { ...r0, x: r0.x + ox };
      const cleared = gi < app.profile.actsCleared;
      const locked = gi >= run.playableActs;
      const next = !locked && !cleared;
      const rim = next ? 0xf2c230 : cleared ? 0x5ad848 : NAVY[5];
      if (next) glow(g, r, 0xf2c230, (0.22 + 0.22 * pulse(now, 1000)) * a, 2);
      // the row: a darker inset card with a colored edge
      g.fillStyle(INK, a);
      g.fillRect(r.x + 1, r.y - 1, r.w - 2, r.h + 2);
      g.fillRect(r.x - 1, r.y + 1, r.w + 2, r.h - 2);
      g.fillStyle(locked ? NAVY[1] : NAVY[2], a);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(locked ? NAVY[2] : NAVY[3], a);
      g.fillRect(r.x, r.y, r.w, Math.round(r.h * 0.45));
      g.fillStyle(mix(rim, NAVY[3], 0.45), a);
      g.fillRect(r.x + 1, r.y, r.w - 2, 1);
      g.fillStyle(rim, a);
      g.fillRect(r.x, r.y + 1, 2, r.h - 2);
      // the act's badge: its number on a shield-like key
      const face = locked ? FACE.grey : next ? FACE.gold : FACE.green;
      const bx = r.x + 6;
      const by = r.y + 5;
      g.fillStyle(INK, a);
      g.fillRect(bx - 1, by, 18, 18);
      g.fillRect(bx, by - 1, 16, 20);
      g.fillStyle(face[1], a);
      g.fillRect(bx, by, 16, 18);
      g.fillStyle(face[0], a);
      g.fillRect(bx, by, 16, 6);
      g.fillStyle(face[3], a);
      g.fillRect(bx, by + 16, 16, 2);
      g.fillStyle(WHITE, 0.8 * a);
      g.fillRect(bx + 11, by + 1, 3, 1);
      if (locked) glyph(g, 'lock', bx + 4, by + 5, a);
      else T.text(`${gi + 1}`, bx + 8, by + 9, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      if (cleared) glyph(g, 'check', bx + 10, by + 12, a);
      // name, and what playing it means
      const tx = bx + 23;
      T.text(act.name, tx, r.y + 9, locked ? 0x8a84a0 : WHITE, { bold: true, oy: 0.5, alpha: a });
      const status = cleared ? 'Play again' : next ? 'Continue the story' : `Clear Act ${gi} first`;
      T.text(status, tx, r.y + 20, cleared ? 0x9af06a : next ? 0xffe680 : 0x8a84a0, { oy: 0.5, alpha: a });
      // the gear its drops have, and the boss's own drops ("Boss drop": round 8's review found "signature" jargon)
      const mx = r.x + 134;
      const lo = itemLevel(run.tuning, gi, 0);
      const hi = itemLevel(run.tuning, gi, act.rows);
      T.text(`Gear Lv ${whole(lo)}-${whole(hi)}`, mx, r.y + 7, locked ? 0x8a84a0 : 0xc8c0e8, { oy: 0.5, alpha: a });
      const sigs = act.boss.flatMap((b) => SIGNATURES[b] ?? []);
      sigs.forEach((id, j) => {
        const base = BASE_BY_ID[id];
        if (!base?.signature) return;
        const cell: Rect = { x: mx + j * 15, y: r.y + 12, w: 14, h: 14 };
        itemCell(g, cell, base.signature.rarity, { dim: locked, alpha: a });
        const item: Item = { uid: 0, base: id, rarity: base.signature.rarity, ilvl: hi, plus: 0, bonus: [], effect: null, locked: false, fresh: false, rerolls: 0, found: 0 };
        cellIcon(this.pickIcons, item, cell, DEPTH.pickIcon, 1, locked ? 0.35 * a : a);
        if (owned.has(id)) {
          // in the bag already: a small green tick on the frame's corner
          g.fillStyle(INK, a);
          g.fillRect(cell.x + cell.w - 5, cell.y - 2, 7, 6);
          g.fillStyle(0x8af06a, a);
          g.fillRect(cell.x + cell.w - 4, cell.y + 1, 1, 1);
          g.fillRect(cell.x + cell.w - 3, cell.y + 2, 1, 1);
          g.fillRect(cell.x + cell.w - 2, cell.y + 1, 1, 1);
          g.fillRect(cell.x + cell.w - 1, cell.y, 1, 1);
          g.fillRect(cell.x + cell.w, cell.y - 1, 1, 1);
        }
      });
      if (sigs.length) {
        T.text('Boss drop', mx + sigs.length * 15 + 1, r.y + 19, locked ? 0x6a6480 : 0xffb060, { oy: 0.5, alpha: a });
      }
      // Play
      if (!locked) {
        const b0 = this.playButton(i);
        const b = { ...b0, x: b0.x + ox };
        const pr = isPressed(b0, now);
        if (next) glow(g, b, 0xffe680, (0.3 + 0.35 * pulse(now, 900)) * a, 2);
        button3d(g, b, next ? FACE.gold : FACE.green, pr);
        T.text('Play', b.x + b.w / 2, b.y + b.h / 2 + (pr ? 2 : 0), WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
      }
    });
  }

  /** A crisp dark plate: soft drop shadow, ink rim, a 1px light inner edge on top, a darker base. */
  private panel(g: G, x: number, y: number, w: number, h: number, a: number): void {
    rows(g, x, y + 2, w, h, 2, 0x000000, 0.35 * a);
    rows(g, x - 1, y - 1, w + 2, h + 2, 2, INK, a);
    rows(g, x, y, w, h, 2, PLATE.fill, 0.96 * a);
    g.fillStyle(PLATE.top, 0.96 * a);
    g.fillRect(x + 2, y, w - 4, 1);
    g.fillRect(x + 1, y + 1, w - 2, 1);
    g.fillRect(x, y + 2, w, Math.round(h / 2) - 2);
    g.fillStyle(PLATE.edge, a);
    g.fillRect(x + 2, y, w - 4, 1);
    g.fillRect(x, y + 2, 1, Math.round(h / 2) - 2);
    g.fillStyle(0xffffff, 0.18 * a);
    g.fillRect(x + 2, y + 1, w - 4, 1);
    g.fillStyle(PLATE.lo, a);
    g.fillRect(x + 2, y + h - 1, w - 4, 1);
  }

  /** The glossy green call-to-action button, a highlight sweeping across it every couple of seconds. */
  private button(g: G, x: number, y: number, w: number, h: number, t: number, a: number): void {
    // (L8: the mood's moss, a narrow lit lip and a soft sheen, not a candy-green bubble)
    rows(g, x - 1, y - 1, w + 2, h + 2, 2, INK, a);
    rows(g, x, y, w, h, 2, 0x2a5a30, a);
    rows(g, x, y, w, h - 2, 2, 0x467e42, a);
    g.fillStyle(0x8cb87a, a);
    g.fillRect(x + 2, y, w - 4, 1);
    g.fillStyle(0x5a9452, a);
    g.fillRect(x + 1, y + 1, w - 2, 1);
    g.fillStyle(0x1a3c22, a);
    g.fillRect(x + 2, y + h - 1, w - 4, 1);
    const k = frac(t / 2.2);
    if (k < 0.35) {
      const sx = Math.round(x - 4 + (k / 0.35) * (w + 8));
      g.fillStyle(WHITE, 0.22 * a);
      for (let j = 0; j < h - 2; j++) {
        const xx = sx + Math.round((h - j) / 3);
        if (xx >= x + 1 && xx < x + w - 2) g.fillRect(xx, y + 1 + j, 2, 1);
      }
    }
  }
}
