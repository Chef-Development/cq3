// The kingdom's world map (between runs): the painted island (art-world.ts), alive. The sea glints and laps at
// the coast, ships cross, a whale surfaces now and then; clouds and their shadows drift over the land and gulls
// fly by. Greenmarch is where Rowan and Pip wait under a bobbing call to action, its windmill turning and
// chimneys smoking; the locked regions breathe under their haze (snow on Frostpeaks, the volcano puffing over
// Ashfell, mist and wisps over Duskmire, Noonspire's island bobbing in the sky) behind padlocks. The Great
// Pendulum's swing grows with the weights brought home; a flag flies over each Greenmarch act cleared.
// Tap Greenmarch (anywhere on its land, Rowan or the plate) to start a run; a locked region rattles its padlock
// and shows its name; the capital tells how many weights are home.
//
// Everything animates from `now` (deterministic for the screenshot tests): textures were pre-rendered at boot,
// so a frame only moves images, swaps their frames, and draws a modest number of rects.
import type Phaser from 'phaser';
import { WEIGHTS_TOTAL } from '../../core/progress';
import type { FightScene } from '../scene';
import {
  CLOUD_KINDS,
  FLAG_FRAMES,
  FLAG_ORIGIN,
  GREENMARCH_FLAGS,
  SURF_FRAMES,
  WAVE_FRAMES,
  WIND_FRAMES,
  WORLD_BOXES,
  WORLD_CAPITAL,
  WORLD_LIFE,
  WORLD_REGIONS,
  WORLD_ROAD,
  WORLD_SPOTS,
  worldRegionAt,
} from '../art-world';
import { hash } from '../backdrop';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { cornerInset } from '../chrome';
import { INK, WHITE } from './shared';
import { TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;
type Region = (typeof WORLD_REGIONS)[number];

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const rnd = (i: number, s: number) => hash(i, s, 977);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const DEPTH = {
  map: 30.1,
  waves: 30.11,
  surf: 30.12,
  sea: 30.13,
  ship: 30.14,
  isle: 30.15,
  glow: 30.16,
  land: 30.17,
  actor: 30.18,
  pip: 30.19,
  shadow: 30.22,
  fog: 30.24,
  air: 30.26,
  vignette: 30.3,
  cloud: 30.4,
  bird: 30.42,
  frame: 30.45,
  lock: 30.5,
  ui: 30.8,
  text: 30.9,
};

// clouds drifting along the top and bottom of the map (texture, y, speed px/s, phase px)
const CLOUDS: Array<[number, number, number, number]> = [
  [2, -4, 2.2, 30],
  [0, 3, 2.9, 250],
  [3, 15, 3.6, 150],
  [1, 128, 2.6, 80],
  [0, 136, 2.0, 280],
  [3, 122, 3.1, 360],
];
// shadows of clouds high overhead sweeping across the whole map (texture, y, speed, phase)
const SHADOWS: Array<[number, number, number, number]> = [
  [0, 38, 3.4, 60],
  [1, 92, 2.7, 300],
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

/** Plate colours: crisp dark glass with a light inner edge. */
const PLATE = { fill: 0x161226, top: 0x221c38, edge: 0x6a5c98, lo: 0x0c0a16 };

export class WorldView {
  private g!: G; // UI plates
  private gSea!: G; // glints, wakes, whales
  private gLand!: G; // smoke, windows, pendulum, pennants, shadows, rings
  private gAir!: G; // snow, embers, wisps, motes, sparkles
  private imgs: Img[] = [];
  private waves!: Img;
  private surf!: Img;
  private wind!: Img;
  private isle!: Img;
  private lava!: Img;
  private lamp!: Img;
  private mill!: Img;
  private hero!: Img;
  private pip!: Img;
  private ships: Img[] = [];
  private boat!: Img;
  private cart!: Img;
  private flags: Img[] = [];
  private locks: Img[] = [];
  private clouds: Img[] = [];
  private cloudShadows: Img[] = [];
  private bigShadows: Img[] = [];
  private puffs: Img[] = [];
  private fogs: Img[] = [];
  private birds: Img[] = [];
  private frame!: Img;
  private texts: TextPool;
  private rattle = new Map<string, number>();
  private info: { id: string; at: number } | null = null;
  private chosenAt = 0;
  private plate = { x: 0, y: 0, w: 0, h: 0 };
  private road: Array<[number, number]> = [];

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, DEPTH.text);
  }

  build(): void {
    const s = this.s;
    for (const i of this.imgs) i.destroy();
    this.imgs = [];
    const img = (key: string, depth: number, ox = 0, oy = 0) => {
      const i = s.add.image(0, 0, key).setOrigin(ox, oy).setDepth(depth).setVisible(false);
      this.imgs.push(i);
      return i;
    };
    img('world_map', DEPTH.map);
    this.waves = img('wm_wave0', DEPTH.waves);
    this.surf = img('wm_surf0', DEPTH.surf);
    this.wind = img('wm_wind0', DEPTH.surf).setPosition(WORLD_BOXES.wind.x, WORLD_BOXES.wind.y);
    this.ships = [img('wm_ship0', DEPTH.ship, 0.5, 1), img('wm_ship0', DEPTH.ship, 0.5, 1)];
    this.boat = img('wm_boat0', DEPTH.ship, 0.5, 1);
    this.isle = img('wm_isle', DEPTH.isle);
    this.cart = img('wm_cart0', DEPTH.land, 0.5, 1);
    this.lava = img('wm_lava', DEPTH.glow).setPosition(WORLD_BOXES.lava.x, WORLD_BOXES.lava.y);
    this.lamp = img('wm_lamp', DEPTH.glow).setPosition(WORLD_BOXES.lamp.x, WORLD_BOXES.lamp.y);
    this.mill = img('wm_mill0', DEPTH.land, 0.5, 0.5);
    this.flags = GREENMARCH_FLAGS.map(() => img('flag_off0', DEPTH.land, FLAG_ORIGIN.x, FLAG_ORIGIN.y));
    this.hero = img('wm_hero0', DEPTH.actor, 0.5, 1);
    this.pip = img('wm_pip0', DEPTH.pip, 0.5, 0.5);
    this.bigShadows = SHADOWS.map(([k]) => img(`wm_shadow${k}`, DEPTH.shadow));
    this.cloudShadows = CLOUDS.map(([k]) => img(`wm_cloudsh${k % CLOUD_KINDS}`, DEPTH.shadow));
    this.fogs = WORLD_SPOTS.fog.map((_, i) => img(`wm_fog${i % 2}`, DEPTH.fog, 0.5, 0.5));
    this.puffs = Array.from({ length: 6 }, () => img('wm_puff0', DEPTH.air, 0.5, 0.5));
    this.clouds = CLOUDS.map(([k]) => img(`wm_cloud${k % CLOUD_KINDS}`, DEPTH.cloud));
    this.birds = Array.from({ length: 5 }, () => img('wm_bird0', DEPTH.bird, 0.5, 0.5));
    this.frame = img('wm_frame', DEPTH.frame);
    img('wm_vignette', DEPTH.vignette);
    this.locks = WORLD_REGIONS.filter((r) => r.locked).map(() => img('padlock', DEPTH.lock, 0.5, 0.5));
    for (const g of [this.g, this.gSea, this.gLand, this.gAir]) g?.destroy();
    this.gSea = s.add.graphics().setDepth(DEPTH.sea);
    this.gLand = s.add.graphics().setDepth(DEPTH.land);
    this.gAir = s.add.graphics().setDepth(DEPTH.air);
    this.g = s.add.graphics().setDepth(DEPTH.ui);
    // the cart's stretch of road: from past Rowan to the capital's gate
    this.road = WORLD_ROAD.filter(([rx]) => rx >= 80);
  }

  /** Greenmarch's spot on the map (tests tap it). */
  greenmarch(): { x: number; y: number } {
    return { x: WORLD_REGIONS[0].x, y: WORLD_REGIONS[0].y };
  }

  /** What a tap at (x, y) points at: a region (its padlock, its land, Noonspire's island) or the capital. */
  private targetAt(x: number, y: number): Region | 'capital' | null {
    const p = this.plate;
    if (x >= p.x - 2 && x < p.x + p.w + 2 && y >= p.y - 2 && y < p.y + p.h + 6) return WORLD_REGIONS[0];
    const h = WORLD_SPOTS.hero;
    if (Math.abs(x - h.x) < 10 && y > h.y - 24 && y < h.y + 5) return WORLD_REGIONS[0];
    if (Math.abs(x - WORLD_CAPITAL.x) < 13 && y > 27 && y < 66) return 'capital';
    let best: Region | null = null;
    let bestD = 14;
    for (const r of WORLD_REGIONS) {
      const d = Math.hypot(r.x - x, r.y - y);
      if (d < bestD) (best = r), (bestD = d);
    }
    if (best) return best;
    const id = worldRegionAt(x, y) ?? (x > 274 && y > 34 && y < 100 ? 'noonspire' : null);
    return WORLD_REGIONS.find((r) => r.id === id) ?? null;
  }

  /** A tap on the world map (x < 0: the keyboard picks Greenmarch). */
  tap(x: number, y: number): void {
    const s = this.s;
    if (this.chosenAt) return;
    const t = x < 0 ? WORLD_REGIONS[0] : this.targetAt(x, y);
    if (!t) return;
    const now = performance.now();
    if (t === 'capital') {
      this.info = { id: 'capital', at: now };
      s.app.audio.uiClick();
      return;
    }
    if (t.locked) {
      this.rattle.set(t.id, now);
      this.info = { id: t.id, at: now };
      s.app.audio.uiClick();
      return;
    }
    // into Greenmarch: Rowan hops, rings of light spread from his feet, then the run begins
    this.chosenAt = now;
    this.info = null;
    s.app.audio.mapSelect();
    window.setTimeout(() => {
      this.chosenAt = 0;
      if (s.app.run.phase === 'world') s.app.startRegion();
    }, 420);
  }

  private hide(): void {
    for (const g of [this.g, this.gSea, this.gLand, this.gAir]) g.clear();
    for (const i of this.imgs) i.setVisible(false);
    this.texts.hide();
  }

  draw(now: number): void {
    const s = this.s;
    if (s.app.run.phase !== 'world') return this.hide();
    for (const g of [this.g, this.gSea, this.gLand, this.gAir]) g.clear();
    this.texts.begin();
    for (const i of this.imgs) i.setVisible(true);
    const t = now / 1000;

    this.drawSea(now, t);
    this.drawSky(t);
    this.drawGreenmarch(now, t);
    this.drawCapital(t);
    this.drawLocked(now, t);
    this.drawUi(now, t);
    this.texts.end();
  }

  // ------------------------------------------------------------------ the sea

  private drawSea(now: number, t: number): void {
    const g = this.gSea;
    this.waves.setTexture(`wm_wave${Math.floor(now / 230) % WAVE_FRAMES}`);
    // the surf rolls in over three frames, then the beach foam lingers
    const sc = (now % 1500) / 1500;
    this.surf.setTexture(`wm_surf${sc < 0.2 ? 0 : sc < 0.4 ? 1 : sc < 0.6 ? 2 : SURF_FRAMES - 1}`);

    // sun glints popping on the open sea
    const sea = WORLD_LIFE.sea;
    if (sea.length)
      for (let k = 0; k < 9; k++) {
        const per = 2.2 + rnd(k, 1) * 1.6;
        const c = Math.floor(t / per + rnd(k, 2));
        const u = frac(t / per + rnd(k, 2));
        if (u > 0.3) continue;
        const [x, y] = sea[Math.floor(rnd(k * 31 + c, 3) * sea.length)];
        const big = u > 0.08 && u < 0.22;
        g.fillStyle(WHITE, big ? 1 : 0.7);
        g.fillRect(x, y, 1, 1);
        if (big) {
          g.fillStyle(0xbfe4f8, 0.85);
          g.fillRect(x - 1, y, 1, 1);
          g.fillRect(x + 1, y, 1, 1);
          g.fillRect(x, y - 1, 1, 1);
          g.fillRect(x, y + 1, 1, 1);
        }
      }

    // ships: a cog along the south coast heading east, a smaller one far north heading west
    const W = GAME_W;
    const routes: Array<[number, number, number, number]> = [
      [138, 3.2, 1, 120],
      [17, 2.2, -1, 40],
    ];
    routes.forEach(([y0, speed, dir, ph], i) => {
      const span = W + 40;
      const d = (ph + t * speed) % span;
      const x = Math.round(dir > 0 ? d - 20 : W + 20 - d);
      const bob = Math.floor(t * 1.4 + i * 0.5) % 2;
      const sh = this.ships[i];
      sh.setTexture(`wm_ship${Math.floor(t * 1.8 + i) % 2}`).setFlipX(dir < 0).setPosition(x, y0 + bob);
      // the wake: foam peeling off the stern, fading
      for (let k = 1; k <= 4; k++) {
        const wx = x - dir * (6 + k * 3) + (k % 2 ? 0 : dir);
        const on = (Math.floor(t * 4) + k) % 2 === 0;
        g.fillStyle(0xd4eeec, (1 - k / 5) * (on ? 0.9 : 0.6));
        g.fillRect(wx, y0 - 1 + (k % 2), on ? 2 : 1, 1);
      }
      g.fillStyle(0xd4eeec, 0.8);
      g.fillRect(x + dir * 7, y0 - 1, 1, 1);
    });

    // a whale surfaces and spouts now and then; between, a fish leaps
    const deep = WORLD_LIFE.deep;
    if (deep.length) {
      const per = 12;
      const c = Math.floor(t / per);
      const u = (t - c * per) / 3.4;
      if (u < 1) {
        const [x, y] = deep[Math.floor(rnd(c, 7) * deep.length)];
        const rise = u < 0.15 ? u / 0.15 : u > 0.8 ? (1 - u) / 0.2 : 1;
        // ripples round its back
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
        // the spout: a column of spray that blooms and rains back
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
        // the tail flukes as it dives
        if (u > 0.68 && u < 0.92) {
          const fx = x + 5;
          g.fillStyle(0x0c1830, 1);
          g.fillRect(fx - 1, y - 3, 3, 1);
          g.fillRect(fx, y - 2, 1, 2);
        }
      }
      const fc = Math.floor(t / 4.7);
      const fu = (t - fc * 4.7) / 0.9;
      if (fu < 1 && fc % 3 !== 0) {
        const [x, y] = deep[Math.floor(rnd(fc, 9) * deep.length)];
        const fx = x + Math.round(fu * 8);
        const fy = y - Math.round(Math.sin(fu * Math.PI) * 6);
        g.fillStyle(0xd8e4f0, 1);
        g.fillRect(fx, fy, 2, 1);
        g.fillStyle(0x7a8ab0, 1);
        g.fillRect(fx + (fu < 0.5 ? 0 : 1), fy + 1, 1, 1);
        if (fu < 0.2 || fu > 0.8) {
          g.fillStyle(WHITE, 0.8);
          const sx = fu < 0.2 ? x : x + 8;
          g.fillRect(sx - 1, y, 1, 1);
          g.fillRect(sx + 2, y, 1, 1);
          g.fillRect(sx, y - 1, 2, 1);
        }
      }
    }
  }

  // ------------------------------------------------------------------ clouds, cloud shadows, gulls

  private drawSky(t: number): void {
    const W = GAME_W;
    SHADOWS.forEach(([, y, speed, ph], i) => {
      const im = this.bigShadows[i];
      const span = W + im.width + 20;
      im.setPosition(Math.round(((ph + t * speed) % span) - im.width - 10), y).setAlpha(0.2);
    });
    CLOUDS.forEach(([, y, speed, ph], i) => {
      const im = this.clouds[i];
      const span = W + im.width + 30;
      const x = Math.round(((ph + t * speed) % span) - im.width - 15);
      const bob = Math.round(Math.sin(t * 0.5 + i) * 0.6);
      im.setPosition(x, y + bob);
      this.cloudShadows[i].setPosition(x + 6, y + 13).setAlpha(0.26);
    });
    // the framing cloud banks breathe a little
    this.frame.setPosition(Math.round(Math.sin(t * 0.25) * 1.5), Math.round(Math.sin(t * 0.33 + 1) * 1));

    // gulls: a flock of three crossing every so often, and two circling over the forest
    const per = 15;
    const c = Math.floor(t / per);
    const u = (t - c * per) / 11;
    const dir = c % 2 ? -1 : 1;
    const y0 = [46, 78, 124, 60][c % 4];
    for (let k = 0; k < 5; k++) {
      const b = this.birds[k];
      let x: number;
      let y: number;
      if (k < 3) {
        if (u >= 1) {
          b.setVisible(false);
          continue;
        }
        const lead = -20 + u * (W + 40);
        const off = [0, -6, -6][k];
        const side = [0, -4, 4][k];
        x = dir > 0 ? lead + off : W - lead - off;
        y = y0 + side + Math.sin(u * TAU * 1.5) * 4;
      } else {
        const a = t * 0.55 + (k - 3) * Math.PI;
        x = 64 + Math.cos(a) * 14;
        y = 50 + Math.sin(a) * 5;
      }
      b.setTexture(`wm_bird${Math.floor(t * 5 + k * 0.7) % 2}`).setPosition(Math.round(x), Math.round(y));
    }
  }

  // ------------------------------------------------------------------ Greenmarch: Rowan, Pip, the windmill, the village

  private drawGreenmarch(now: number, t: number): void {
    const g = this.gLand;
    const P = this.s.app.progress;
    const h = WORLD_SPOTS.hero;

    // Rowan: breathing; hops when Greenmarch is chosen
    const since = this.chosenAt ? now - this.chosenAt : -1;
    const hop = since >= 0 ? Math.round(Math.sin(Math.min(1, since / 300) * Math.PI) * 5) : 0;
    g.fillStyle(0x0c1410, 0.45);
    g.fillRect(h.x - 3, h.y, 7, 1);
    g.fillRect(h.x - 2, h.y + 1, 5, 1);
    this.hero.setTexture(`wm_hero${Math.floor(t * 1.7) % 2}`).setPosition(h.x, h.y + 1 - hop);
    // Pip circles Rowan, passing behind him and back in front
    const pa = t * 1.5;
    const px = h.x + Math.cos(pa) * 10;
    const py = h.y - 12 + Math.sin(pa) * 2.5 + Math.sin(t * 5.3) * 0.8 - hop * 1.5;
    this.pip
      .setTexture(`wm_pip${Math.floor(t * 7) % 2}`)
      .setPosition(Math.round(px), Math.round(py))
      .setDepth(Math.sin(pa) > 0 ? DEPTH.pip : DEPTH.actor - 0.005);
    // a beacon ring at Rowan's feet: "start here"
    if (!this.chosenAt) {
      const k = frac(t / 1.6);
      this.ellipse(g, h.x + 0.5, h.y + 0.5, 4 + k * 9, 1.5 + k * 3.5, 0xfff0a0, (1 - k) * 0.8);
    } else {
      const k = clamp01(since / 400);
      this.ellipse(g, h.x + 0.5, h.y + 0.5, 4 + k * 22, 1.5 + k * 9, 0xffffff, 1 - k);
      this.ellipse(g, h.x + 0.5, h.y + 0.5, 2 + k * 14, 1 + k * 6, 0xfff0a0, 1 - k);
    }
    // golden motes drift up round the hero (this is where the adventure is)
    const ga = this.gAir;
    for (let k = 0; k < 10; k++) {
      const per = 2.6 + rnd(k, 11) * 1.8;
      const u = frac(t / per + rnd(k, 12));
      const c = Math.floor(t / per + rnd(k, 12));
      const x = Math.round(h.x - 26 + rnd(k * 7 + c, 13) * 52 + Math.sin(u * TAU + k) * 1.5);
      const y = Math.round(h.y + 6 - rnd(k * 5 + c, 14) * 18 - u * 12);
      ga.fillStyle(k % 3 ? 0xfff0a0 : WHITE, Math.sin(u * Math.PI) * 0.9);
      ga.fillRect(x, y, 1, 1);
    }

    // now and then a gust of wind rolls east over the meadows and the forest
    const gust = Math.floor(((t + 2) % 7) / 0.15);
    if (gust < WIND_FRAMES) this.wind.setTexture(`wm_wind${gust}`);
    else this.wind.setVisible(false);
    // the windmill turns
    this.mill.setTexture(`wm_mill${Math.floor(t * 4) % 2}`).setPosition(WORLD_SPOTS.mill.x, WORLD_SPOTS.mill.y);
    // chimney smoke curls up and east
    WORLD_LIFE.chimneys.forEach(([cx, cy], i) => {
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
      const lit = frac(t / (5 + rnd(i, 31) * 6) + rnd(i, 32)) < 0.7;
      if (!lit) return;
      g.fillStyle(rnd(i + Math.floor(t * 6), 33) < 0.08 ? 0xffb040 : 0xffd860, 1);
      g.fillRect(x, y, 1, 1);
    });
    // the fishing boat rocks at the pier
    const [bx, by] = WORLD_LIFE.boat;
    this.boat.setTexture(`wm_boat${Math.floor(t * 0.9) % 2}`).setPosition(bx, by + 1 + (Math.floor(t * 1.3) % 2));
    // the merchant's cart rolls between the meadows and the capital's gate, resting at each end
    const road = this.road;
    if (road.length > 1) {
      const n = road.length;
      const leg = n / 5;
      const T = leg * 2 + 8;
      const c = (t + 6) % T;
      let idx: number;
      let dir: number;
      if (c < 4) (idx = 0), (dir = 1);
      else if (c < 4 + leg) (idx = (c - 4) * 5), (dir = 1);
      else if (c < 8 + leg) (idx = n - 1), (dir = -1);
      else (idx = n - 1 - (c - 8 - leg) * 5), (dir = -1);
      const moving = !(c < 4 || (c >= 4 + leg && c < 8 + leg));
      const [cx, cy] = road[Math.max(0, Math.min(n - 1, Math.round(idx)))];
      const hop = moving ? Math.floor(t * 4) % 2 : 0;
      this.cart
        .setTexture(`wm_cart${moving ? Math.floor(t * 6) % 2 : 0}`)
        .setFlipX(dir < 0)
        .setPosition(cx, cy + 1 - hop);
    }
    // sheep graze in the paddock, ambling about
    const sp = WORLD_SPOTS.sheep;
    for (let k = 0; k < 5; k++) {
      const ax = t * (0.09 + rnd(k, 61) * 0.06) + k * 2.3;
      const ay = t * (0.07 + rnd(k, 62) * 0.05) + k;
      const x = Math.round(sp.x + 3 + rnd(k, 63) * (sp.w - 8) + Math.sin(ax) * 2.5);
      const y = Math.round(sp.y + 3 + rnd(k, 64) * (sp.h - 7) + Math.sin(ay) * 2);
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
    // the lighthouse lamp flashes
    const lh = WORLD_SPOTS.lighthouse;
    const lk = frac(t / 2.6);
    if (lk < 0.3) {
      const a = Math.sin((lk / 0.3) * Math.PI);
      g.fillStyle(0xfff6c0, 0.35 * a);
      g.fillRect(lh.x - 1, lh.y - 1, 4, 3);
      g.fillStyle(WHITE, a);
      g.fillRect(lh.x, lh.y, 2, 1);
      const side = Math.floor(t / 2.6) % 2 ? 1 : -1;
      for (let k = 1; k <= 5; k++) {
        g.fillStyle(0xfff0a0, 0.7 * a * (1 - k / 6));
        g.fillRect(side > 0 ? lh.x + 1 + k : lh.x - k, lh.y, 1, 1);
      }
    }
    // a flag per act cleared waves proudly; the others hang pale
    GREENMARCH_FLAGS.forEach((f, i) => {
      const on = i < P.actsCleared;
      const fr = Math.floor(t * (on ? 6 : 3) + i * 1.3) % FLAG_FRAMES;
      this.flags[i].setTexture(`${on ? 'flag_on' : 'flag_off'}${fr}`).setPosition(f.x, f.y);
    });
  }

  /** A pixel ellipse outline (rings on the ground). */
  private ellipse(g: G, cx: number, cy: number, rx: number, ry: number, color: number, alpha: number): void {
    if (alpha <= 0.02) return;
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

  // ------------------------------------------------------------------ the capital and the Great Pendulum

  private drawCapital(t: number): void {
    const g = this.gLand;
    const P = this.s.app.progress;
    // the pendulum: hangs still while its weights are missing; swings wider the more come home
    const pv = WORLD_SPOTS.pendulum;
    const amp = P.weights / WEIGHTS_TOTAL;
    const off = Math.round(Math.sin(t * TAU * 0.6) * 2.4 * amp);
    g.fillStyle(0xd8901c, 1);
    for (let k = 0; k < 3; k++) g.fillRect(pv.x + Math.round((off * k) / 4), pv.y + k, 1, 1);
    g.fillStyle(0xf2c230, 1);
    g.fillRect(pv.x + off - 1, pv.y + 3, 3, 2);
    g.fillStyle(0xfff0a0, 1);
    g.fillRect(pv.x + off - 1, pv.y + 3, 1, 1);
    g.fillStyle(0x9a5a14, 1);
    g.fillRect(pv.x + off + 1, pv.y + 4, 1, 1);
    // pennants on the turrets
    WORLD_SPOTS.turrets.forEach((tp, i) => {
      const fr = Math.floor(t * 5 + i) % 2;
      g.fillStyle(0x4a5272, 1);
      g.fillRect(tp.x, tp.y - 4, 1, 4);
      g.fillStyle(0xd03030, 1);
      g.fillRect(tp.x + 1, tp.y - 4, 2, 1);
      g.fillRect(tp.x + 1, tp.y - 3, fr ? 3 : 2, 1);
      g.fillStyle(0x8a1a22, 1);
      g.fillRect(tp.x + 3, tp.y - (fr ? 4 : 3), 1, 1);
    });
    // a glint runs up the spire's gold finial now and then
    const k = frac(t / 4.5);
    if (k < 0.12) {
      g.fillStyle(WHITE, 1 - k / 0.12);
      g.fillRect(WORLD_CAPITAL.x, 29, 1, 1);
      g.fillRect(WORLD_CAPITAL.x - 1, 30, 3, 1);
    }
  }

  // ------------------------------------------------------------------ the locked regions: alive under their haze

  private drawLocked(now: number, t: number): void {
    const ga = this.gAir;
    const g = this.gLand;
    // Frostpeaks: snow falling over the range
    for (let k = 0; k < 30; k++) {
      const x0 = 116 + rnd(k, 41) * 114;
      const vy = 5 + rnd(k, 42) * 5;
      const H = 40;
      const y = Math.round(16 + ((t * vy + rnd(k, 43) * H) % H));
      const x = Math.round(x0 + Math.sin(t * 1.1 + k) * 2 + ((t * 2) % 4));
      ga.fillStyle(WHITE, k % 4 ? 0.85 : 0.6);
      ga.fillRect(x, y, 1, 1);
    }
    // the wind blows a plume of snow off the highest summit
    for (let k = 0; k < 6; k++) {
      const u = frac(t / 2.2 + k / 6);
      const x = Math.round(205 + u * 16 + Math.sin(u * 7 + k) * 1);
      const y = Math.round(18 - Math.sin(u * Math.PI) * 2 + u * 3);
      ga.fillStyle(WHITE, (1 - u) * 0.8);
      ga.fillRect(x, y, u < 0.4 ? 2 : 1, 1);
    }
    // Ashfell: the volcano breathes: the glow swells, smoke puffs roll off east, embers spit
    const cr = WORLD_SPOTS.crater;
    this.lava.setAlpha(0.45 + 0.35 * Math.sin(t * 1.9) + 0.12 * Math.sin(t * 7.3));
    this.puffs.forEach((pf, j) => {
      const u = frac(t / 4.2 + j / this.puffs.length);
      const x = cr.x + u * 26 + Math.sin(u * 6 + j) * 1.2;
      const y = cr.y - 3 - u * 11 + u * u * 5;
      pf.setTexture(`wm_puff${u < 0.2 ? 0 : u < 0.55 ? 1 : 2}`)
        .setPosition(Math.round(x), Math.round(y))
        .setAlpha(Math.min(1, u * 8, (1 - u) * 1.6) * 0.95);
    });
    for (let k = 0; k < 4; k++) {
      const u = frac(t / 1.4 + k / 4 + rnd(k, 51));
      const c = Math.floor(t / 1.4 + k / 4 + rnd(k, 51));
      const x = Math.round(cr.x + (rnd(k * 9 + c, 52) - 0.5) * 6 + u * (rnd(c, k) - 0.3) * 6);
      const y = Math.round(cr.y - u * 9 + u * u * 5);
      ga.fillStyle(u < 0.5 ? 0xffe070 : 0xff7a2a, 1 - u);
      ga.fillRect(x, y, 1, 1);
    }
    // Duskmire: mist banks drift to and fro, wisps wander, the Mirelight pulses
    WORLD_SPOTS.fog.forEach((f, i) => {
      this.fogs[i].setPosition(Math.round(f.x + Math.sin(t * 0.18 + i * 2) * 8), Math.round(f.y + Math.sin(t * 0.3 + i) * 0.8)).setAlpha(0.32 + 0.1 * Math.sin(t * 0.4 + i));
    });
    WORLD_SPOTS.wisps.forEach((w, i) => {
      const a = clamp01(0.5 + Math.sin(t * 0.8 + i * 2.1) * 0.9);
      if (a <= 0) return;
      const x = Math.round(w.x + Math.sin(t * 0.6 + i * 2) * 10);
      const y = Math.round(w.y + Math.sin(t * 1.3 + i) * 3 - Math.abs(Math.sin(t * 2.2 + i)) * 2);
      const tx = Math.round(w.x + Math.sin(t * 0.6 + i * 2 - 0.25) * 10);
      ga.fillStyle(0x4ad8a0, 0.35 * a);
      ga.fillRect(x - 1, y, 3, 1);
      ga.fillRect(x, y - 1, 1, 3);
      ga.fillStyle(0x9af0c8, 0.4 * a);
      ga.fillRect(tx, y + 1, 1, 1);
      ga.fillStyle(0xe0fff0, a);
      ga.fillRect(x, y, 1, 1);
    });
    this.lamp.setAlpha(0.55 + 0.45 * Math.sin(t * 2.4));
    // Noonspire: the island floats, its waterfall pours, the sun on its spire twinkles
    const dy = Math.round(Math.sin(t * 0.7) * 1.4);
    const io = WORLD_SPOTS.isle;
    this.isle.setPosition(io.x, io.y + dy);
    const fl = WORLD_SPOTS.falls;
    for (let j = 0; j < 4; j++) {
      const y = fl.y0 + ((t * 18 + j * 5.5) % (fl.y1 - fl.y0 - 6));
      g.fillStyle(WHITE, 0.9);
      g.fillRect(fl.x + (j % 2), Math.round(y) + dy, 1, 2);
    }
    const sun = WORLD_SPOTS.sun;
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

    // padlocks: a glint sweeps each now and then; a tap rattles it
    let li = 0;
    for (const r of WORLD_REGIONS) {
      if (!r.locked) continue;
      const since = now - (this.rattle.get(r.id) ?? -1e9);
      const shake = since < 320 ? Math.round(Math.sin(since / 22) * 2) : 0;
      const lx = r.x + shake;
      const ly = r.y - 2;
      this.locks[li].setPosition(lx, ly);
      const k = frac(t / 3.8 + li * 0.27);
      if (k < 0.1) {
        this.g.fillStyle(WHITE, 1 - k / 0.1);
        this.g.fillRect(lx - 3, ly, 1, 1);
        this.g.fillRect(lx - 4, ly + 1, 3, 1);
        this.g.fillRect(lx - 3, ly + 2, 1, 1);
      }
      li++;
    }
  }

  // ------------------------------------------------------------------ plates: header, the call to action, region info

  private drawUi(now: number, t: number): void {
    const s = this.s;
    const g = this.g;
    const P = s.app.progress;
    const phase = now - s.app.phaseSince;

    // the call to action over Rowan: Greenmarch, and a glossy "Tap to begin!" button
    const h = WORLD_SPOTS.hero;
    const sub = P.actsCleared >= 3 ? 'Play again!' : P.actsCleared > 0 ? `Act ${P.actsCleared + 1} next` : 'Tap to begin!';
    const name = 'Greenmarch';
    const bw = textWidth(sub, 1, true) + 8;
    const w = Math.max(textWidth(name, 1, true) + 12, bw + 6);
    const ph = 28;
    const pop = clamp01(phase / 260);
    const bob = this.chosenAt ? 0 : Math.round(Math.sin(t * 3.2) * 1);
    const x = Math.round(Math.max(s.L + 3, Math.min(s.R - w - 3, h.x - w / 2)));
    const y = Math.round(h.y - 20 - ph - 4 + bob + (1 - pop) * 6);
    this.plate = { x, y, w, h: ph };
    if (pop > 0) {
      this.panel(g, x, y, w, ph, pop);
      // the tail points down at Rowan
      const tx = Math.round(h.x);
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
      // the button: green, glossy, pulsing a highlight across
      const bx = Math.round(x + (w - bw) / 2);
      const by = y + 13;
      const press = this.chosenAt ? 1 : 0;
      this.button(g, bx, by + press, bw, 12, t, pop);
      this.texts.text(sub, bx + bw / 2, by + 6 + press, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: pop });
    }

    // header: the kingdom and the weights brought home (a pip per weight)
    const L = s.L + 4;
    const hw = Math.max(textWidth('The Kingdom', 1, true), textWidth(`Weights home: ${P.weights}/${WEIGHTS_TOTAL}`, 1, false), WEIGHTS_TOTAL * 7 - 2) + 14;
    this.panel(g, L, 4, hw, 29, 1);
    this.texts.text('The Kingdom', L + 7, 10, WHITE, { bold: true, oy: 0.5 });
    this.texts.text(`Weights home: ${P.weights}/${WEIGHTS_TOTAL}`, L + 7, 19, 0xf2c230, { oy: 0.5 });
    for (let i = 0; i < WEIGHTS_TOTAL; i++) {
      const wx = L + 7 + i * 7;
      const home = i < P.weights;
      g.fillStyle(INK, 1);
      g.fillRect(wx, 24, 5, 5);
      g.fillStyle(home ? 0xf2c230 : 0x3a3054, 1);
      g.fillRect(wx + 1, 25, 3, 3);
      g.fillStyle(home ? 0xfff0a0 : 0x4e4470, 1);
      g.fillRect(wx + 1, 25, 1, 1);
      if (home) {
        g.fillStyle(0x9a5a14, 1);
        g.fillRect(wx + 3, 27, 1, 1);
      }
    }

    // region info after a tap: a locked region's name, or the Pendulum's state
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
          title = 'The Great Pendulum';
          line = P.weights === 0 ? 'Stopped. Its weights are lost.' : P.weights >= WEIGHTS_TOTAL ? 'Ticking again!' : `${P.weights} of ${WEIGHTS_TOTAL} weights home`;
          ax = WORLD_CAPITAL.x + 14;
          ay = WORLD_CAPITAL.y + 15;
          col = 0xffe680;
        } else {
          const r = WORLD_REGIONS.find((q) => q.id === inf.id)!;
          title = r.name;
          line = 'Locked';
          ax = r.x;
          ay = r.y + 22;
        }
        const iw = Math.max(textWidth(title, 1, true), textWidth(line, 1, false)) + 14;
        const ih = 22;
        const ix = Math.round(Math.max(s.L + 3, Math.min(s.R - iw - 3, ax - iw / 2)));
        const iy = Math.round(Math.max(3, Math.min(GAME_H - ih - 4, ay - ih / 2)) + (1 - Math.min(1, age / 120)) * 3);
        this.panel(g, ix, iy, iw, ih, a);
        this.texts.text(title, ix + iw / 2, iy + 7, col, { bold: true, ox: 0.5, oy: 0.5, alpha: a });
        this.texts.text(line, ix + iw / 2, iy + 16, WHITE, { ox: 0.5, oy: 0.5, alpha: a });
      }
    }
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
    rows(g, x - 1, y - 1, w + 2, h + 2, 2, INK, a);
    rows(g, x, y, w, h, 2, 0x2e9a34, a);
    rows(g, x, y, w, h - 2, 2, 0x4cc840, a);
    g.fillStyle(0x8af06a, a);
    g.fillRect(x + 2, y, w - 4, 1);
    g.fillStyle(0x6ade52, a);
    g.fillRect(x + 1, y + 1, w - 2, 3);
    g.fillStyle(0x1e6a26, a);
    g.fillRect(x + 2, y + h - 1, w - 4, 1);
    const k = frac(t / 2.2);
    if (k < 0.35) {
      const sx = Math.round(x - 4 + (k / 0.35) * (w + 8));
      g.fillStyle(WHITE, 0.45 * a);
      for (let j = 0; j < h - 2; j++) {
        const xx = sx + Math.round((h - j) / 3);
        if (xx >= x + 1 && xx < x + w - 2) g.fillRect(xx, y + 1 + j, 2, 1);
      }
    }
  }
}
