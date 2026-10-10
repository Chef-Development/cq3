// The stage behind and in front of the fighters, per act theme. Back to front:
//   back:  backdrop, far life (birds, bats, a shooting star), drifting clouds, framing trees, light rays (the
//          aurora), cloud shadows / mist, light pooled on the ground (the arena, braziers), torch flames,
//          butterflies, drips, far snow and the glints on ice, crystals and gold
//   (the actors)
//   front: falling leaves, rain, snow and spindrift, the grade (vignette, shade toward the camera), near mist,
//          glows, lit motes (pollen in the sunbeams, fireflies, embers, ice dust), the swaying foreground plants,
//          out-of-focus near leaves and snowflakes
// The foreground's last rows hang over the top of the bar's band (fgOver, just above the band's depth).
// Everything animates on the scene clock (s.anim), so hit-stop freezes it and screenshots stay deterministic.
import Phaser from 'phaser';
import type { FightScene } from '../scene';
import { buildBackdrops, FG_FRAMES, type Backdrop, type Theme } from '../backdrop';
import { buildAshBackdrop, isAsh } from '../backdrop-ash';
import { buildDuskBackdrop, isDusk } from '../backdrop-dusk';
import { buildFrostBackdrop, isFrost } from '../backdrop-frost';
import { buildStageArt, buildStageTheme, STAGE_LIGHT } from '../art-stage';
import { GAME_W } from '../layout';
import { rand } from './shared';

type Kind = 'leaf' | 'mote' | 'beam' | 'rain' | 'ember' | 'firefly' | 'drip' | 'splash' | 'near' | 'snow' | 'flake' | 'glint' | 'drift' | 'smoke';

interface Bit {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number; // anim ms
  life: number;
  color: number;
  phase: number;
  floor?: number; // drips and rain stop here
}

const HOLLOW_LEAVES = [0xe0702c, 0xc8402a, 0xf2b040, 0x9a2a2a, 0xf08a3a];
const FIREFLY = 0xe0ff8a;
/** Sunbeams in the forest (x at the top, width), matching the rays texture: pollen drifts inside them. */
const BEAMS: Array<[number, number]> = [
  [40, 13],
  [84, 7],
  [122, 18],
  [178, 9],
];
const BEAM_SLOPE = 0.55;
const FG_MS = 620; // one foreground sway frame
const MAX_BITS = 220;

export class Stage {
  /** The backdrops painted for this layout (Greenmarch's at once, the Frostpeaks' when an act first needs one). */
  private backdrops: Partial<Record<Theme, Backdrop>> = {};
  /** How long each lazily painted theme took (ms, this layout), for the report and tests. */
  readonly paintMs: Partial<Record<Theme, number>> = {};
  private theme: Theme = 'forest';
  private bits: Bit[] = [];
  private nextAmbient = 0;
  private nextDrip = 0;
  private nextVent = 0;
  /** A snowy theme just came on: fill the air with flakes at once (instead of waiting for them to fall in). */
  private prefill = false;
  private clouds: Phaser.GameObjects.Image[] = [];
  private bgImg!: Phaser.GameObjects.Image;
  private frameImg!: Phaser.GameObjects.Image;
  private raysImg!: Phaser.GameObjects.Image;
  private shadeImgs: Phaser.GameObjects.Image[] = [];
  private poolImg!: Phaser.GameObjects.Image;
  private torchPools: Phaser.GameObjects.Image[] = [];
  private torchHalos: Phaser.GameObjects.Image[] = [];
  private gradeImg!: Phaser.GameObjects.Image;
  private mistImgs: Phaser.GameObjects.Image[] = [];
  private fgImg!: Phaser.GameObjects.Image;
  private fgOver: Phaser.GameObjects.Image | null = null;
  private gFar!: Phaser.GameObjects.Graphics;
  private gBack!: Phaser.GameObjects.Graphics;
  private gAmb!: Phaser.GameObjects.Graphics;
  private gGlow!: Phaser.GameObjects.Graphics;
  private gLit!: Phaser.GameObjects.Graphics;
  private gNear!: Phaser.GameObjects.Graphics;

  constructor(private readonly s: FightScene) {}

  clearAmbient(): void {
    this.bits = [];
  }

  /** Regenerate the backdrop and atmosphere textures (before the images are created). */
  buildTextures(): void {
    this.backdrops = buildBackdrops(this.s, GAME_W, this.s.splitY, this.s.ground);
    buildStageArt(this.s, GAME_W, this.s.splitY, this.s.ground);
  }

  /** A theme's backdrop and light for this layout: the Frostpeaks' and Ashfell's are painted the first time an act
   *  needs one. */
  ensure(theme: Theme): void {
    if (this.backdrops[theme] || !(isFrost(theme) || isAsh(theme) || isDusk(theme))) return;
    const t0 = performance.now();
    const [w, h, g] = [GAME_W, this.s.splitY, this.s.ground];
    this.backdrops[theme] = isAsh(theme) ? buildAshBackdrop(this.s, theme, w, h, g) : isDusk(theme) ? buildDuskBackdrop(this.s, theme, w, h, g) : buildFrostBackdrop(this.s, theme, w, h, g);
    buildStageTheme(this.s, GAME_W, this.s.splitY, this.s.ground, theme);
    this.paintMs[theme] = performance.now() - t0;
  }

  build(): void {
    const s = this.s;
    const ADD = Phaser.BlendModes.ADD;
    const img = (key: string, x = 0, y = 0) => s.add.image(x, y, key).setOrigin(0, 0);
    // ---- back
    this.bgImg = img('bg_forest');
    this.gFar = s.add.graphics();
    this.clouds = [0, 1].map((i) => img('clouds', i * GAME_W, 4).setAlpha(0.95));
    // framing trees/canopies drawn over the drifting clouds
    this.frameImg = img('frame_forest');
    this.raysImg = img('st_rays_forest').setBlendMode(ADD);
    this.shadeImgs = [0, 1].map((i) => img('st_cloudshade', i * GAME_W, 0));
    this.poolImg = s.add.image(0, 0, 'st_glow').setBlendMode(ADD);
    this.torchPools = [0, 1, 2].map(() => s.add.image(0, 0, 'st_glow').setBlendMode(ADD).setVisible(false));
    this.gBack = s.add.graphics();
    s.back.add([this.bgImg, this.gFar, ...this.clouds, this.frameImg, this.raysImg, ...this.shadeImgs, this.poolImg, ...this.torchPools, this.gBack]);
    // ---- front
    this.gAmb = s.add.graphics();
    this.gradeImg = img('st_grade_forest').setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.mistImgs = [0, 1].map((i) => img('st_mist_ruins_near', i * GAME_W, 0).setVisible(false));
    this.torchHalos = [0, 1, 2].map(() => s.add.image(0, 0, 'st_glow').setBlendMode(ADD).setVisible(false));
    this.gGlow = s.add.graphics().setBlendMode(ADD);
    this.gLit = s.add.graphics();
    this.fgImg = img('fg_forest_0');
    this.gNear = s.add.graphics();
    s.front.add([this.gAmb, this.gradeImg, ...this.mistImgs, ...this.torchHalos, this.gGlow, this.gLit, this.fgImg, this.gNear]);
    // the foreground's roots hang over the top of the band: just above its depth, outside the world container
    this.fgOver?.destroy();
    this.fgOver = img('fgo_forest_0', 0, s.splitY).setDepth(9.5);
  }

  /** Each act has its own backdrop (Run.theme: forest, ruins, hollow; pass, caves, glacier). */
  applyTheme(): void {
    const theme: Theme = this.s.app.run.theme;
    this.ensure(theme);
    if (!this.backdrops[theme]) return;
    this.theme = theme;
    this.bits = [];
    this.bgImg.setTexture(`bg_${theme}`);
    this.frameImg.setTexture(`frame_${theme}`);
    this.raysImg.setTexture(`st_rays_${theme}`);
    this.gradeImg.setTexture(`st_grade_${theme}`);
    for (const cl of this.clouds) {
      // the hollow's sunset sky has its own painted wisps, the caves a roof, the glacier the aurora: no cumulus there
      cl.setVisible(theme === 'forest' || theme === 'ruins' || theme === 'pass');
      if (theme === 'ruins') cl.setTint(0x6a7090).setAlpha(0.45);
      else if (theme === 'pass') cl.setTint(0xc4c0da).setAlpha(0.5);
      else cl.clearTint().setAlpha(0.95);
    }
    this.prefill = theme === 'pass' || theme === 'glacier' || theme === 'cinder' || theme === 'forge';
    // cloud shadows sweep the meadow; mist banks roll through the ruins and the hollow
    for (const im of this.shadeImgs) {
      im.setTexture(theme === 'forest' ? 'st_cloudshade' : `st_mist_${theme}`);
      im.setBlendMode(theme === 'forest' ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.NORMAL);
    }
    for (const im of this.mistImgs) im.setTexture(`st_mist_${theme === 'forest' ? 'ruins' : theme}_near`).setVisible(theme !== 'forest');
    const L = STAGE_LIGHT[theme];
    // warm light pooled on the ground where the fighters meet
    this.poolImg
      .setTint(L.pool)
      .setAlpha(L.poolAmt)
      .setScale(6.2, 1.1)
      .setPosition(Math.round(GAME_W / 2 + 4), this.s.ground - 3);
    const torches = this.backdrops[theme].torches;
    this.torchPools.forEach((im, i) => im.setVisible(i < torches.length).setTint(0xff9a40));
    this.torchHalos.forEach((im, i) => im.setVisible(i < torches.length).setTint(0xffb050));
    this.applyFg(0);
  }

  private applyFg(frame: number): void {
    this.fgImg.setTexture(`fg_${this.theme}_${frame}`);
    this.fgOver?.setTexture(`fgo_${this.theme}_${frame}`);
  }

  driftClouds(now: number): void {
    const drift = (now * 0.004) % GAME_W;
    this.clouds[0].setX(Math.round(-drift));
    this.clouds[1].setX(Math.round(GAME_W - drift));
  }

  /** Living stage: light breathes and drifts, torches flicker and light the ground, life moves through every layer. */
  drawAmbient(): void {
    const s = this.s;
    const a = s.anim;
    const ground = s.ground;
    const theme = this.theme;
    const W = GAME_W;
    this.gFar.clear();
    this.gBack.clear();
    this.gAmb.clear();
    this.gGlow.clear();
    this.gLit.clear();
    this.gNear.clear();

    // ---- light: the rays breathe and sway a little; the foreground sways; patches drift across the ground
    const breathe = 0.82 + 0.18 * Math.sin(a / 2300) * Math.sin(a / 1700 + 1);
    this.raysImg.setAlpha(breathe).setX(Math.round(Math.sin(a / 4100) * 2));
    this.applyFg(Math.floor(a / FG_MS) % FG_FRAMES);
    // mist drifts; the caves' hangs almost still, the glacier's spindrift races
    const speed = theme === 'forest' ? 0.0035 : theme === 'caves' ? 0.0012 : theme === 'glacier' ? 0.007 : 0.0028;
    const sd = (a * speed) % W;
    this.shadeImgs[0].setX(Math.round(-sd));
    this.shadeImgs[1].setX(Math.round(W - sd));
    const md = (a * (theme === 'glacier' ? 0.014 : theme === 'caves' ? 0.003 : 0.0065)) % W;
    this.mistImgs[0].setX(Math.round(md - W));
    this.mistImgs[1].setX(Math.round(md));
    // the band overhang moves with the world when the camera shakes
    this.fgOver?.setPosition(s.world.x, s.splitY + s.world.y);

    // ---- torches: flames, flickering light on the ground, a halo around each flame, embers
    const gb = this.gBack;
    const torches = this.backdrops[theme]?.torches ?? [];
    torches.forEach((t, i) => {
      const f = Math.sin(a / 70 + t.x) * 0.5 + Math.sin(a / 33 + t.x * 3) * 0.5;
      this.torchPools[i]?.setPosition(t.x + 0.5, ground - 5).setScale(2.3 + f * 0.08, 0.62).setAlpha(0.3 + f * 0.05);
      this.torchHalos[i]?.setPosition(t.x + 0.5, t.y - 4).setScale(1 + f * 0.05).setAlpha(0.32 + f * 0.06);
      const fh = 6 + Math.round(f * 1.5);
      gb.fillStyle(0xe8441a, 1);
      gb.fillRect(t.x - 2, t.y - fh + 2, 5, fh - 1);
      gb.fillStyle(0xff9a2a, 1);
      gb.fillRect(t.x - 1, t.y - fh, 3, fh);
      gb.fillRect(t.x + (Math.floor(a / 90) % 2 ? -2 : 2), t.y - fh + 3, 1, 2);
      gb.fillStyle(0xfff0a0, 1);
      gb.fillRect(t.x, t.y - fh + 2, 1, fh - 3);
      if (Math.random() < 0.05) this.bits.push({ kind: 'ember', x: t.x + rand(-1, 1), y: t.y - fh, vx: rand(-6, 6), vy: rand(-26, -14), born: a, life: rand(600, 1100), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, phase: 0 });
    });

    this.spawn(a, ground);
    this.drawLife(a, ground);
    this.drawBits(a, ground);
    if (this.bits.length > MAX_BITS) this.bits.splice(0, this.bits.length - MAX_BITS);
  }

  // ------------------------------------------------------------------ spawning

  private spawn(a: number, ground: number): void {
    const theme = this.theme;
    const W = GAME_W;
    const bottom = ground + 4;
    while (a >= this.nextAmbient) {
      if (this.nextAmbient === 0) this.nextAmbient = a;
      const r = Math.random();
      if (theme === 'forest') {
        if (r < 0.26)
          this.bits.push({ kind: 'leaf', x: rand(0, W), y: -2, vx: rand(4, 14), vy: rand(10, 18), born: a, life: 9000, color: [0x5aa84c, 0x8ac850, 0xe8c048][Math.floor(Math.random() * 3)], phase: rand(0, 6) });
        else if (r < 0.72) {
          // pollen glinting inside a sunbeam
          const [x0, wid] = BEAMS[Math.floor(Math.random() * BEAMS.length)];
          const y = rand(14, ground - 8);
          this.bits.push({ kind: 'beam', x: x0 + y * BEAM_SLOPE + rand(-wid / 2, wid / 2), y, vx: rand(-2, 3), vy: rand(-3, 2), born: a, life: rand(2600, 4600), color: Math.random() < 0.6 ? 0xfffbe0 : 0xffe890, phase: rand(0, 6) });
        } else if (r < 0.96)
          this.bits.push({ kind: 'mote', x: rand(20, W - 20), y: rand(30, bottom), vx: rand(-3, 3), vy: rand(-6, -2), born: a, life: rand(2500, 4500), color: Math.random() < 0.6 ? 0xffffff : 0xfff0a0, phase: rand(0, 6) });
        else this.nearLeaf(a, [0x1e3a1a, 0x2a4a1e, 0x16301a]);
        this.nextAmbient += 240;
      } else if (theme === 'hollow') {
        // autumn leaves tumbling from the canopy; fireflies waking low over the floor; warm dust in the low sun
        if (r < 0.44)
          this.bits.push({ kind: 'leaf', x: rand(-10, W - 30), y: -2, vx: rand(6, 16), vy: rand(9, 16), born: a, life: 10000, color: HOLLOW_LEAVES[Math.floor(Math.random() * HOLLOW_LEAVES.length)], phase: rand(0, 6) });
        else if (r < 0.74)
          this.bits.push({ kind: 'firefly', x: rand(24, W - 24), y: rand(ground - 40, ground - 4), vx: rand(-4, 4), vy: rand(-4, 1), born: a, life: rand(3000, 5200), color: Math.random() < 0.7 ? FIREFLY : 0xffd870, phase: rand(0, 6) });
        else if (r < 0.96) this.bits.push({ kind: 'mote', x: rand(20, W * 0.6), y: rand(24, bottom - 20), vx: rand(1, 5), vy: rand(-4, -1), born: a, life: rand(2500, 4000), color: 0xffc890, phase: rand(0, 6) });
        else this.nearLeaf(a, [0x3a0e14, 0x4a1418, 0x2a0a10]);
        this.nextAmbient += 240;
      } else if (theme === 'pass' || theme === 'caves' || theme === 'glacier') {
        this.spawnFrost(a, ground, r);
      } else if (isAsh(theme)) {
        this.spawnAsh(a, ground, r);
      } else if (isDusk(theme)) {
        this.spawnDusk(a, ground, r);
      } else {
        // rain: most of it far, a few heavy streaks close to the camera
        const near = r < 0.06;
        this.bits.push({ kind: near ? 'near' : 'rain', x: rand(-20, W), y: rand(-10, 20), vx: near ? 70 : 50, vy: near ? 380 : 260, born: a, life: 900, color: near ? 0x6a84a8 : 0x9ab8e8, phase: 0, floor: near ? 200 : ground - rand(-2, 8) });
        if (r > 0.985) this.bits.push({ kind: 'mote', x: rand(30, W - 30), y: rand(ground - 30, ground - 4), vx: rand(-3, 3), vy: rand(-5, -1), born: a, life: rand(2000, 3500), color: 0xffc070, phase: rand(0, 6) });
        this.nextAmbient += 22;
      }
    }
    // drops gather on the caves' icicles and fall with a splash; in the Glass Warrens, beads of molten glass
    const icicles = theme === 'caves' || theme === 'glass' ? (this.backdrops[theme]?.drips ?? []) : [];
    if (icicles.length && a >= this.nextDrip) {
      if (this.nextDrip === 0) this.nextDrip = a;
      const d = icicles[Math.floor(Math.random() * icicles.length)];
      this.bits.push({ kind: 'drip', x: d.x, y: d.y, vx: 0, vy: 0, born: a, life: 2600, color: theme === 'glass' ? 0xffa040 : 0xc8eeff, phase: rand(300, 700), floor: ground + Math.round(rand(-3, 4)) });
      this.nextDrip += (theme === 'glass' ? 900 : 360) + Math.random() * 600;
    }
    // smoke puffing off the Cinder Flats' vents
    const vents = this.backdrops[theme]?.vents ?? [];
    if (vents.length && a >= this.nextVent) {
      if (this.nextVent === 0) this.nextVent = a;
      const v = vents[Math.floor(Math.random() * vents.length)];
      this.bits.push({ kind: 'smoke', x: v.x + rand(-1, 1), y: v.y, vx: rand(2, 5), vy: rand(-7, -4), born: a, life: rand(2400, 3400), color: 0x5a4a4c, phase: rand(0, 6) });
      this.nextVent += 260 + Math.random() * 300;
    }
    // the ruins drip: drops gather under the canopy and the arches and fall with a splash
    if (theme === 'ruins' && a >= this.nextDrip) {
      if (this.nextDrip === 0) this.nextDrip = a;
      const spots = [18, 36, 58, 74, 252, 270, 292, 306];
      const x = spots[Math.floor(Math.random() * spots.length)] + Math.round(rand(-2, 2));
      this.bits.push({ kind: 'drip', x, y: 14 + rand(0, 10), vx: 0, vy: 0, born: a, life: 2400, color: 0xb8d4f0, phase: rand(200, 500), floor: ground + Math.round(rand(-1, 4)) });
      this.nextDrip += 420 + Math.random() * 700;
    }
  }

  /**
   * The Frostpeaks' air. The pass: snow drifting down out of the frozen afternoon (far flakes behind the fighters,
   * near ones in front, now and then a big soft flake right past the lens). The caves: ice dust glinting as it drifts,
   * crystals catching the light. The glacier: spindrift racing low over the ice and snow grains blown along with it,
   * the hoard and the seracs glinting.
   */
  private spawnFrost(a: number, ground: number, r: number): void {
    const theme = this.theme;
    const W = GAME_W;
    const h = this.s.splitY;
    const glints = this.backdrops[theme]?.glints ?? [];
    const glint = () => {
      if (!glints.length) return;
      const g = glints[Math.floor(Math.random() * glints.length)];
      this.bits.push({ kind: 'glint', x: g.x, y: g.y, vx: 0, vy: 0, born: a, life: rand(500, 900), color: g.c, phase: 0 });
    };
    if (this.prefill) {
      // the air is already full of snow when the act comes on
      this.prefill = false;
      for (let i = 0; i < (theme === 'pass' ? 60 : 24); i++) {
        const f = this.flake(a, ground, h);
        if (theme === 'glacier') {
          f.vx = -rand(40, 70);
          f.vy = rand(5, 12);
        }
        f.x = rand(0, W);
        f.y = rand(-4, f.floor ?? ground);
        f.born = a - rand(0, 3000);
        f.x -= (f.vx * (a - f.born)) / 1000;
        f.y -= (f.vy * (a - f.born)) / 1000;
        this.bits.push(f);
      }
    }
    if (theme === 'pass') {
      if (r < 0.92) this.bits.push(this.flake(a, ground, h));
      else if (r < 0.985) glint();
      else this.bits.push({ kind: 'flake', x: rand(-10, W * 0.8), y: -6, vx: rand(10, 18), vy: rand(22, 30), born: a, life: 9000, color: 0xeef2fa, phase: rand(0, 6) });
      this.nextAmbient += 75;
    } else if (theme === 'caves') {
      if (r < 0.5) {
        const c = [0x9ae4ff, 0xc8a8ff, 0xe8f8ff][Math.floor(Math.random() * 3)];
        this.bits.push({ kind: 'mote', x: rand(20, W - 20), y: rand(26, ground + 2), vx: rand(-2, 2), vy: rand(-3, -0.5), born: a, life: rand(3200, 5600), color: c, phase: rand(0, 6) });
      } else if (r < 0.82) glint();
      else {
        // dust turning in the light from the roof
        const y = rand(14, ground - 10);
        this.bits.push({ kind: 'beam', x: W * 0.38 + y * 0.28 + rand(-4, 4), y, vx: rand(-1, 2), vy: rand(-2, 2), born: a, life: rand(2600, 4200), color: 0xd8f4ff, phase: rand(0, 6) });
      }
      this.nextAmbient += 230;
    } else {
      if (r < 0.42) this.bits.push({ kind: 'drift', x: W + rand(0, 10), y: rand(ground - 26, ground + 6), vx: -rand(80, 130), vy: rand(-3, 2), born: a, life: 5000, color: 0xdceaf6, phase: rand(4, 9) });
      else if (r < 0.86) {
        const f = this.flake(a, ground, h);
        f.x = W + rand(0, 10);
        f.y = rand(-4, ground);
        f.vx = -rand(40, 70);
        f.vy = rand(5, 12);
        this.bits.push(f);
      } else glint();
      this.nextAmbient += 80;
    }
  }

  /**
   * Ashfell's air. The Cinder Flats: ash drifting down out of the smoke, embers spat up off the plain. The Glass
   * Warrens: warm motes rising on the heat, the coloured glass glinting. The Black Forge: sparks streaming up off the
   * floor's hot seams and the furnace, ash falling, glints on the anvils and the citadel's windows.
   */
  private spawnAsh(a: number, ground: number, r: number): void {
    const theme = this.theme;
    const W = GAME_W;
    const h = this.s.splitY;
    const glints = this.backdrops[theme]?.glints ?? [];
    const glint = () => {
      if (!glints.length) return;
      const g = glints[Math.floor(Math.random() * glints.length)];
      this.bits.push({ kind: 'glint', x: g.x, y: g.y, vx: 0, vy: 0, born: a, life: rand(500, 900), color: g.c, phase: 0 });
    };
    const ember = (x: number, y: number) =>
      this.bits.push({ kind: 'ember', x, y, vx: rand(-4, 6), vy: rand(-22, -10), born: a, life: rand(900, 1600), color: Math.random() < 0.5 ? 0xffb03a : 0xffe680, phase: 0 });
    if (this.prefill) {
      // the air is already full of ash when the act comes on
      this.prefill = false;
      for (let i = 0; i < 30; i++) {
        const f = this.ashFlake(a, ground, h);
        f.x = rand(0, W);
        f.y = rand(-4, f.floor ?? ground);
        f.born = a - rand(0, 3000);
        f.x -= (f.vx * (a - f.born)) / 1000;
        f.y -= (f.vy * (a - f.born)) / 1000;
        this.bits.push(f);
      }
    }
    if (theme === 'cinder') {
      if (r < 0.62) this.bits.push(this.ashFlake(a, ground, h));
      else if (r < 0.86) ember(rand(20, W - 20), ground - rand(10, 16));
      else glint();
      this.nextAmbient += 140;
    } else if (theme === 'glass') {
      if (r < 0.55) {
        const c = [0xffc070, 0xff8a5a, 0xc89aff, 0x9ae89a][Math.floor(Math.random() * 4)];
        this.bits.push({ kind: 'mote', x: rand(20, W - 20), y: rand(26, ground + 2), vx: rand(-2, 2), vy: rand(-5, -1.5), born: a, life: rand(3200, 5600), color: c, phase: rand(0, 6) });
      } else glint();
      this.nextAmbient += 210;
    } else {
      if (r < 0.5) ember(rand(10, W - 10), ground - rand(-2, 12));
      else if (r < 0.62) ember(W * 0.5 + rand(-14, 14), ground - 16);
      else if (r < 0.88) this.bits.push(this.ashFlake(a, ground, h));
      else glint();
      this.nextAmbient += 110;
    }
  }

  /**
   * The Duskmire's air. Lanternfen: fireflies waking over the pools, a will-o'-wisp's cold green light bobbing low far
   * off, the lanterns and lit windows glinting. The Drowned Causeway: sea haze motes drifting along the flats, a gull's
   * glint, the water catching the light. The Gloaming Mere: moths and dusk motes rising, the lamp's glints on the lake.
   */
  private spawnDusk(a: number, ground: number, r: number): void {
    const theme = this.theme;
    const W = GAME_W;
    const glints = this.backdrops[theme]?.glints ?? [];
    const glint = () => {
      if (!glints.length) return;
      const g = glints[Math.floor(Math.random() * glints.length)];
      this.bits.push({ kind: 'glint', x: g.x, y: g.y, vx: 0, vy: 0, born: a, life: rand(500, 900), color: g.c, phase: 0 });
    };
    const fly = (y0: number, y1: number, c: number) => this.bits.push({ kind: 'firefly', x: rand(24, W - 24), y: rand(y0, y1), vx: rand(-4, 4), vy: rand(-3, 1), born: a, life: rand(3000, 5200), color: c, phase: rand(0, 6) });
    if (theme === 'fen') {
      if (r < 0.5) fly(ground - 40, ground - 4, Math.random() < 0.7 ? 0xe0ff8a : 0xffd870);
      else if (r < 0.62) fly(ground - 30, ground - 22, 0x8affd0); // a wisp far over the water
      else if (r < 0.84) this.bits.push({ kind: 'mote', x: rand(20, W - 20), y: rand(26, ground), vx: rand(-2, 2), vy: rand(-4, -1), born: a, life: rand(2600, 4200), color: 0xe8b0c8, phase: rand(0, 6) });
      else glint();
      this.nextAmbient += 230;
    } else if (theme === 'causeway') {
      if (r < 0.5) this.bits.push({ kind: 'mote', x: rand(-10, W - 40), y: rand(30, ground), vx: rand(4, 9), vy: rand(-1, 1), born: a, life: rand(3200, 5200), color: Math.random() < 0.6 ? 0xc8d0f0 : 0xf0c0d0, phase: rand(0, 6) });
      else if (r < 0.66) fly(ground - 36, ground - 6, 0xffd870);
      else glint();
      this.nextAmbient += 240;
    } else {
      if (r < 0.4) this.bits.push({ kind: 'mote', x: rand(20, W - 20), y: rand(30, ground + 2), vx: rand(-2, 3), vy: rand(-5, -2), born: a, life: rand(3000, 5000), color: Math.random() < 0.5 ? 0xffb090 : 0xc8a0d8, phase: rand(0, 6) });
      else if (r < 0.62) fly(ground - 44, ground - 8, 0xffe0a0);
      else glint();
      this.nextAmbient += 220;
    }
  }

  /** A flake of ash: grey, drifting down slowly (far ones settle behind the fighters). */
  private ashFlake(a: number, ground: number, h: number): Bit {
    const f = this.flake(a, ground, h);
    const near = f.floor !== undefined && f.floor > ground;
    f.vx *= 0.7;
    f.vy *= 0.55;
    f.color = near ? (Math.random() < 0.5 ? 0xb0a0a0 : 0x8a7a7c) : Math.random() < 0.5 ? 0x6e6064 : 0x5a4c50;
    return f;
  }

  /** A snowflake: far ones (small, dim, behind the fighters) settle somewhere behind them, near ones fall to the foot. */
  private flake(a: number, ground: number, h: number): Bit {
    const near = Math.random() < 0.3;
    return {
      kind: 'snow',
      x: rand(-40, GAME_W),
      y: rand(-6, -1),
      vx: near ? rand(6, 12) : rand(3, 8),
      vy: near ? rand(14, 20) : rand(7, 12),
      born: a,
      life: 16000,
      color: near ? 0xffffff : Math.random() < 0.5 ? 0xd8e0f2 : 0xc4cce6,
      phase: rand(0, 6),
      floor: near ? h + 2 : rand(ground - 22, ground - 2),
    };
  }

  /** An out-of-focus leaf tumbling past right in front of the camera. */
  private nearLeaf(a: number, colors: number[]): void {
    const fromLeft = Math.random() < 0.6;
    this.bits.push({ kind: 'near', x: fromLeft ? -8 : GAME_W * rand(0.2, 0.8), y: fromLeft ? rand(30, 70) : -6, vx: rand(26, 44), vy: rand(14, 24), born: a, life: 7000, color: colors[Math.floor(Math.random() * colors.length)], phase: rand(0, 6) });
  }

  // ------------------------------------------------------------------ analytic life (no state: from the clock)

  /** Butterflies in the meadow, birds and bats crossing the far sky (paths from the clock, deterministic). */
  private drawLife(a: number, ground: number): void {
    const g = this.gBack;
    const far = this.gFar;
    const theme = this.theme;
    if (theme === 'forest') {
      // two butterflies wandering over the meadow behind the fighters
      for (const [i, c1, c2] of [
        [0, 0xfff4e0, 0xf2d060],
        [1, 0x9ad0ff, 0x4a8ad8],
      ] as const) {
        const t = a / 1000 + i * 37;
        const x = Math.round(40 + (Math.sin(t * 0.21 + i) * 0.5 + 0.5) * 250 + Math.sin(t * 1.3 + i * 2) * 8);
        const y = Math.round(ground - 24 + Math.sin(t * 0.7 + i * 3) * 9 + Math.sin(t * 2.9) * 2);
        const open = Math.floor(a / 70 + i * 3) % 3 !== 0;
        g.fillStyle(0x1a1020, 1);
        g.fillRect(x, y, 1, 2);
        g.fillStyle(c1, 1);
        if (open) {
          g.fillRect(x - 2, y - 1, 2, 2);
          g.fillRect(x + 1, y - 1, 2, 2);
          g.fillStyle(c2, 1);
          g.fillRect(x - 2, y + 1, 1, 1);
          g.fillRect(x + 2, y + 1, 1, 1);
        } else {
          g.fillRect(x - 1, y - 2, 1, 2);
          g.fillRect(x + 1, y - 2, 1, 2);
        }
      }
      // a small flock crossing the far sky now and then
      const period = 16000;
      const k = (a % period) / 9000;
      if (k < 1) {
        const n = Math.floor(a / period);
        const y0 = 22 + ((n * 13) % 18);
        for (let b = 0; b < 4; b++) {
          const bx = Math.round(-10 + k * (GAME_W + 30) - b * 7 - (b % 2) * 3);
          const by = Math.round(y0 + (b % 2) * 3 + b + Math.sin(a / 300 + b) * 1.2);
          const up = Math.floor(a / 140 + b) % 2 === 0;
          far.fillStyle(0x3a5a78, 0.85);
          far.fillRect(bx, by, 1, 1);
          far.fillRect(bx - 1, by - (up ? 1 : 0), 1, 1);
          far.fillRect(bx + 1, by - (up ? 1 : 0), 1, 1);
        }
      }
    } else if (theme === 'ruins') {
      // a bat flitting across the moonlit sky
      const period = 11000;
      const k = (a % period) / 5200;
      if (k < 1) {
        const n = Math.floor(a / period);
        const dir = n % 2 ? 1 : -1;
        const bx = Math.round(dir > 0 ? -8 + k * (GAME_W + 16) : GAME_W + 8 - k * (GAME_W + 16));
        const by = Math.round(18 + ((n * 17) % 22) + Math.sin(k * 19) * 4 + Math.sin(k * 7) * 6);
        const up = Math.floor(a / 60) % 2 === 0;
        far.fillStyle(0x05060c, 1);
        far.fillRect(bx - 1, by, 3, 2);
        far.fillRect(bx - 3, by - (up ? 2 : -1), 2, 1);
        far.fillRect(bx + 2, by - (up ? 2 : -1), 2, 1);
        far.fillRect(bx - 2, by - (up ? 1 : 0), 1, 1);
        far.fillRect(bx + 2, by - (up ? 1 : 0), 1, 1);
      }
    } else if (theme === 'pass') {
      // a pair of choughs riding the wind high over the pass
      for (let i = 0; i < 2; i++) {
        const t = a / 1000 + i * 5;
        const bx = Math.round(GAME_W * 0.55 + Math.cos(t * 0.22 + i * 2.6) * (60 + i * 20));
        const by = Math.round(38 + i * 5 + Math.sin(t * 0.3 + i * 2.6) * 6);
        const up = Math.floor(a / 220 + i) % 3 === 0;
        far.fillStyle(0x2a2a44, 0.8);
        far.fillRect(bx - 1, by, 3, 1);
        far.fillRect(bx - 3, by - (up ? 1 : 0), 2, 1);
        far.fillRect(bx + 2, by - (up ? 1 : 0), 2, 1);
      }
    } else if (theme === 'glacier') {
      // now and then a shooting star streaks across the aurora
      const period = 13000;
      const k = (a % period) / 700;
      if (k < 1) {
        const n = Math.floor(a / period);
        const x0 = 40 + ((n * 97) % 220);
        const y0 = 10 + ((n * 31) % 22);
        const hx = x0 + k * 46;
        const hy = y0 + k * 14;
        for (let j = 0; j < 9; j++) {
          far.fillStyle(0xe8f4ff, (1 - j / 9) * (1 - k) * 0.9);
          far.fillRect(Math.round(hx - j * 2.6), Math.round(hy - j * 0.8), j === 0 ? 2 : 1, 1);
        }
      }
    } else if (theme === 'cinder') {
      // a pair of cinder kites riding the hot air over the volcano, their edges glowing
      for (let i = 0; i < 2; i++) {
        const t = a / 1000 + i * 7;
        const bx = Math.round(GAME_W * 0.63 + Math.cos(t * 0.28 + i * 2.6) * (26 + i * 14));
        const by = Math.round(24 + i * 5 + Math.sin(t * 0.28 + i * 2.6) * 5);
        const up = Math.floor(a / 200 + i) % 3 === 0;
        far.fillStyle(0x1a1016, 0.9);
        far.fillRect(bx - 1, by, 3, 1);
        far.fillRect(bx - 3, by - (up ? 1 : 0), 2, 1);
        far.fillRect(bx + 2, by - (up ? 1 : 0), 2, 1);
        far.fillStyle(0xff8a3a, 0.8);
        far.fillRect(bx + (i ? -3 : 3), by - (up ? 1 : 0), 1, 1);
      }
    } else if (theme === 'glass') {
      // a little bat flitting across the gap in the far wall, black against the lake's glow
      const period = 12000;
      const k = (a % period) / 6000;
      if (k < 1) {
        const n = Math.floor(a / period);
        const dir = n % 2 ? 1 : -1;
        const bx = Math.round(dir > 0 ? GAME_W * 0.24 + k * GAME_W * 0.56 : GAME_W * 0.8 - k * GAME_W * 0.56);
        const by = Math.round(30 + ((n * 13) % 14) + Math.sin(k * 17) * 3 + Math.sin(k * 6) * 4);
        const up = Math.floor(a / 60) % 2 === 0;
        far.fillStyle(0x08040a, 1);
        far.fillRect(bx - 1, by, 3, 2);
        far.fillRect(bx - 3, by - (up ? 2 : -1), 2, 1);
        far.fillRect(bx + 2, by - (up ? 2 : -1), 2, 1);
      }
    } else if (theme === 'hollow') {
      // crows wheeling high over the den
      for (let i = 0; i < 2; i++) {
        const t = a / 1000 + i * 9;
        const bx = Math.round(GAME_W * 0.62 + Math.cos(t * 0.35 + i * 2.4) * (40 + i * 16));
        const by = Math.round(26 + i * 6 + Math.sin(t * 0.35 + i * 2.4) * 7);
        const up = Math.floor(a / 160 + i) % 2 === 0;
        far.fillStyle(0x1a0814, 0.9);
        far.fillRect(bx - 1, by, 3, 1);
        far.fillRect(bx - 3, by - (up ? 1 : -1), 2, 1);
        far.fillRect(bx + 2, by - (up ? 1 : -1), 2, 1);
      }
    }
  }

  // ------------------------------------------------------------------ particles

  private drawBits(a: number, ground: number): void {
    const W = GAME_W;
    const bottom = ground + 4;
    const amb = this.gAmb;
    const lit = this.gLit;
    const glow = this.gGlow;
    const near = this.gNear;
    const back = this.gBack;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const p = this.bits[i];
      const age = a - p.born;
      const t = age / 1000;
      let x = p.x + p.vx * t;
      let y = p.y + p.vy * t;
      if (p.kind === 'drip') {
        // gathers (a growing bead), then falls under gravity and splashes
        const fall = Math.max(0, age - p.phase) / 1000;
        y = p.y + 0.5 * 420 * fall * fall;
        if (y >= (p.floor ?? ground)) {
          this.bits[i] = { kind: 'splash', x: p.x, y: p.floor ?? ground, vx: 0, vy: 0, born: a, life: 220, color: p.color, phase: 0 };
          continue;
        }
        back.fillStyle(p.color, fall > 0 ? 0.75 : 0.35 + 0.4 * (age / p.phase));
        back.fillRect(Math.round(x), Math.round(y), 1, fall > 0.12 ? 2 : 1);
        continue;
      }
      if (p.kind === 'smoke') {
        // a puff of smoke rising off a vent, swelling and thinning as it goes
        const q = age / p.life;
        if (q >= 1) {
          this.bits.splice(i, 1);
          continue;
        }
        const r = 1 + q * 4;
        const sx = Math.round(x + Math.sin(t * 1.2 + p.phase) * 1.5);
        const sy = Math.round(y);
        back.fillStyle(p.color, 0.45 * Math.sin(Math.min(1, q * 4) * Math.PI * 0.5) * (1 - q));
        back.fillCircle(sx + 0.5, sy + 0.5, r);
        back.fillStyle(0x8a7672, 0.25 * (1 - q));
        back.fillCircle(sx - r * 0.3, sy - r * 0.3, r * 0.55);
        continue;
      }
      if (p.kind === 'snow' || p.kind === 'flake' || p.kind === 'drift' || p.kind === 'glint') {
        if (this.drawFrostBit(p, age, ground)) this.bits.splice(i, 1);
        continue;
      }
      const dead = age > p.life || x > W + 12 || (p.kind !== 'near' && y > bottom + 6) || y > 160;
      if (dead || (p.floor !== undefined && y >= p.floor && p.kind === 'rain')) {
        if (p.kind === 'rain' && !dead) this.bits[i] = { kind: 'splash', x, y: p.floor!, vx: 0, vy: 0, born: a, life: 160, color: 0xb8d0f0, phase: 1 };
        else this.bits.splice(i, 1);
        continue;
      }
      const k = age / p.life;
      if (p.kind === 'leaf') {
        x += Math.sin(t * 2.4 + p.phase) * 6;
        const flat = Math.floor(t * 4 + p.phase) % 2 === 0;
        amb.fillStyle(p.color, 1);
        amb.fillRect(Math.round(x), Math.round(y), flat ? 2 : 1, flat ? 1 : 2);
      } else if (p.kind === 'near') {
        if (p.vy > 200) {
          // heavy rain right in front of the lens
          near.fillStyle(p.color, 0.5);
          near.fillRect(Math.round(x), Math.round(y), 1, 6);
          near.fillRect(Math.round(x + 1), Math.round(y + 6), 1, 3);
        } else {
          // a big, dark, out-of-focus leaf tumbling past
          x += Math.sin(t * 1.6 + p.phase) * 10;
          y += Math.sin(t * 2.3 + p.phase) * 4;
          const f = Math.floor(t * 3 + p.phase) % 4;
          const lx = Math.round(x);
          const ly = Math.round(y);
          near.fillStyle(p.color, 0.92);
          if (f === 0) near.fillRect(lx - 2, ly, 5, 2);
          else if (f === 2) near.fillRect(lx, ly - 2, 2, 5);
          else {
            near.fillRect(lx - 1, ly - 1, 3, 3);
            near.fillRect(lx + (f === 1 ? 2 : -2), ly + (f === 1 ? -2 : 2), 1, 1);
          }
        }
      } else if (p.kind === 'splash') {
        const q = age / p.life;
        if (q >= 1) {
          this.bits.splice(i, 1);
          continue;
        }
        const sx = Math.round(p.x);
        const sy = Math.round(p.y);
        const spread = 1 + Math.round(q * 2);
        amb.fillStyle(p.color, 0.6 * (1 - q));
        amb.fillRect(sx - spread, sy - 1 - (q < 0.5 ? 1 : 0), 1, 1);
        amb.fillRect(sx + spread, sy - 1 - (q < 0.5 ? 1 : 0), 1, 1);
        if (q < 0.4) amb.fillRect(sx, sy - 2, 1, 1);
      } else if (p.kind === 'rain') {
        amb.fillStyle(p.color, 0.42);
        amb.fillRect(Math.round(x), Math.round(y), 1, 3);
        amb.fillRect(Math.round(x + 1), Math.round(y + 3), 1, 2);
      } else if (p.kind === 'mote' || p.kind === 'beam' || p.kind === 'firefly') {
        let al = Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(t * 6 + p.phase));
        const mx = Math.round(x + Math.sin(t * 1.5 + p.phase) * 3);
        const my = Math.round(y);
        if (p.kind === 'beam') {
          // brighter while it sits inside the beam it was born in
          al = Math.sin(k * Math.PI) * (0.65 + 0.35 * Math.sin(t * 4 + p.phase));
          glow.fillStyle(0xfff0c0, al * 0.16);
          glow.fillRect(mx - 1, my - 1, 3, 3);
        } else if (p.kind === 'firefly') {
          // a soft green-gold halo around the firefly
          glow.fillStyle(p.color, al * 0.22);
          glow.fillCircle(mx + 0.5, my + 0.5, 3);
          glow.fillStyle(p.color, al * 0.3);
          glow.fillRect(mx - 1, my, 3, 1);
          glow.fillRect(mx, my - 1, 1, 3);
        }
        lit.fillStyle(p.color, al);
        lit.fillRect(mx, my, 1, 1);
      } else {
        // embers: rise, flicker, glow
        const ex = Math.round(x + Math.sin(t * 8 + p.x) * 1.5);
        const ey = Math.round(y);
        glow.fillStyle(0xff8a2a, (1 - k) * 0.3);
        glow.fillRect(ex - 1, ey - 1, 3, 3);
        lit.fillStyle(p.color, 1 - k);
        lit.fillRect(ex, ey, 1, 1);
      }
    }
  }

  /** Snow, big near flakes, spindrift and glints; true when the bit is done. */
  private drawFrostBit(p: Bit, age: number, ground: number): boolean {
    const t = age / 1000;
    let x = p.x + p.vx * t;
    const y = p.y + p.vy * t;
    if (age > p.life || x < -16 || x > GAME_W + 16) return true;
    if (p.kind === 'glint') {
      // a four-pointed twinkle: a cross that swells and fades
      const s = Math.sin((age / p.life) * Math.PI);
      const g = this.gBack;
      const gx = Math.round(p.x);
      const gy = Math.round(p.y);
      g.fillStyle(p.color, s);
      g.fillRect(gx, gy, 1, 1);
      if (s > 0.45) {
        const arm = s > 0.8 ? 2 : 1;
        g.fillStyle(p.color, s * 0.7);
        g.fillRect(gx - arm, gy, arm, 1);
        g.fillRect(gx + 1, gy, arm, 1);
        g.fillRect(gx, gy - arm, 1, arm);
        g.fillRect(gx, gy + 1, 1, arm);
      }
      this.gGlow.fillStyle(p.color, s * 0.16);
      this.gGlow.fillRect(gx - 2, gy - 2, 5, 5);
      return false;
    }
    if (p.kind === 'drift') {
      // a streak of spindrift skimming the ice, rising and falling on the wind
      const yy = Math.round(y + Math.sin(t * 3 + p.phase) * 2);
      const len = Math.round(p.phase);
      const al = Math.min(1, t * 3) * 0.32;
      this.gAmb.fillStyle(p.color, al);
      this.gAmb.fillRect(Math.round(x), yy, len, 1);
      this.gAmb.fillStyle(p.color, al * 0.5);
      this.gAmb.fillRect(Math.round(x) + len, yy - 1, Math.round(len * 0.6), 1);
      return false;
    }
    x += Math.sin(t * 1.4 + p.phase) * (p.kind === 'flake' ? 6 : 3);
    if (p.kind === 'flake') {
      // a big soft flake drifting right past the lens
      if (y > 170) return true;
      const fx = Math.round(x);
      const fy = Math.round(y);
      this.gNear.fillStyle(p.color, 0.5);
      this.gNear.fillRect(fx - 1, fy, 3, 1);
      this.gNear.fillRect(fx, fy - 1, 1, 3);
      this.gNear.fillStyle(p.color, 0.85);
      this.gNear.fillRect(fx, fy, 1, 1);
      return false;
    }
    const floor = p.floor ?? ground;
    if (y >= floor) return true;
    const far = floor < ground - 1;
    // far flakes fade as they settle among the trees behind the fighters
    const al = far ? 0.75 * Math.min(1, (floor - y) / 6) : 0.9;
    const g = far ? this.gBack : this.gAmb;
    g.fillStyle(p.color, al);
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
    if (!far && p.vy > 17) g.fillRect(Math.round(x), Math.round(y) + 1, 1, 1);
    return false;
  }
}
