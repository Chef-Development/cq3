// The story scenes' stage (round 8, the fresh-eyes review: "every scene is one still picture"). Who speaks stands on
// the stage: a hero in their fight idle frames (the mature sprites, `${art}_idle0..3`, anchored at the feet like the
// fight view), stepping in the first time they speak; the speaker lit a touch, the others a step darker. Companions
// and the other speakers (the narrator, the Mapmaker, Hesper, Mags) keep their portraits; a boss or foe who speaks
// stands on the right in its fight sprite. A chest hero's arrival shows the chest, and the hero steps out of its light.
//
// It is all derived from the scene's speakers (no staging data; JOINS names the two story heroes' join scenes), drawn
// from `now` and the moments the scene and its boxes began, and uses only sprites already painted.
//
// Where: on the act's own stage (a run's scene, or a boss's scene mid-fight), the hero who is fighting already
// stands there (fighters.ts): the stage lays a lit copy over them and adds the rest. Over the camp (a story hero's
// join, a chest hero's arrival) the camp is dimmed and the cast stands in a pool of light on the same ground line.
// Anywhere else (the title's welcome back, the camp's own scenes, whose speakers the camp already shows) it stays out.
import type Phaser from 'phaser';
import { SPEAKER_NAME, STORY } from '../../data/story';
import { HEROES, heroDef, type HeroId } from '../../data/heroes';
import { TIER_INFO } from '../../data/rarity';
import type { FightScene } from '../scene';
import { GAME_W } from '../layout';
import { HERO_FEET_X, HERO_W } from '../art';
import { clamp01, INK } from './shared';
import { SPRITE_STAND_IN } from './fighters';

type G = Phaser.GameObjects.Graphics;
type Img = Phaser.GameObjects.Image;

/** The two story heroes' join scenes (they come in facing the party); the chest heroes' are `HEROES[id].meetScene`. */
const JOINS: Record<string, HeroId> = { sableJoin: 'sable', neveJoin: 'neve' };

/** Tints: the one speaking, everyone else while they do, and everyone while a voice off the stage speaks. */
const LIT = 0xffffff;
const DIM = 0x8a86a2;
const EVEN = 0xc6c2d6;

/** A step in: how long, how far, and when a chest hero leaves the chest (after the scene starts). */
const STEP_MS = 420;
const STEP_DX = 30;
const CHEST_OUT_MS = 380;
const RISE_MS = 260;
const HOP_MS = 360;

/** Depths: under the story box (32.25), over the scene's dim (32.2) and the stage's shadows and light (32.202). */
const D_GLOW = 32.205;
const D_BEHIND = 32.21;
const D_CHEST = 32.215;
const D_CAST = 32.22;

const isHero = (w: string): w is HeroId => Object.prototype.hasOwnProperty.call(HEROES, w);

/** The hero a scene brings in (they face the party), and whether they come out of a chest. */
function newcomerOf(id: string): { hero: HeroId; chest: boolean } | null {
  if (JOINS[id]) return { hero: JOINS[id], chest: false };
  for (const h of Object.keys(HEROES) as HeroId[]) if (HEROES[h].meetScene === id) return { hero: h, chest: true };
  return null;
}

interface Member {
  id: string;
  kind: 'hero' | 'foe';
  x: number;
  /** Faces left (toward the party), else right (toward the foes). */
  left: boolean;
  enterAt: number;
}

export class StoryStage {
  private g!: G;
  private imgs: Img[] = [];
  private used = 0;
  private sceneKey = '';
  private sceneAt = 0;
  /** When each stage member first showed (-1e9: already there when the scene was opened partway, as after a reload). */
  private enterAt = new Map<string, number>();
  /** A foe speaker's sprite set, by speaker id (null: none painted). */
  private foeSprite = new Map<string, { sprite: string; fly: number } | null>();

  constructor(private readonly s: FightScene) {}

  build(): void {
    this.g?.destroy();
    for (const i of this.imgs) i.destroy();
    this.imgs = [];
    this.g = this.s.add.graphics().setDepth(32.202);
  }

  private img(key: string, x: number, y: number, depth: number, o: { ox?: number; oy?: number; flip?: boolean; tint?: number; fill?: number; alpha?: number; add?: boolean; sx?: number; sy?: number } = {}): Img {
    let im = this.imgs[this.used];
    if (!im) {
      im = this.s.add.image(0, 0, key);
      this.imgs.push(im);
    }
    this.used++;
    if (im.texture.key !== key) im.setTexture(key);
    im.setOrigin(o.ox ?? 0.5, o.oy ?? 1).setPosition(Math.round(x), Math.round(y)).setDepth(depth).setFlipX(!!o.flip);
    im.setScale(o.sx ?? 1, o.sy ?? o.sx ?? 1).setAlpha(o.alpha ?? 1).setBlendMode(o.add ? 'ADD' : 'NORMAL').setVisible(true);
    // (tint modes as numbers, Phaser.TintModes MULTIPLY 0 / FILL 1: no Phaser value import here)
    if (o.fill !== undefined) im.setTint(o.fill).setTintMode(1);
    else if (o.tint === undefined || o.tint === LIT) im.clearTint().setTintMode(0);
    else im.setTint(o.tint).setTintMode(0);
    return im;
  }

  /** Nothing staged (no scene, or one this stage stays out of). */
  hide(): void {
    this.g?.clear();
    this.sceneKey = '';
    for (const i of this.imgs) i.setVisible(false);
  }

  /** The stage's mode for the scene on screen: the act's stage, a pool of light over the camp, or none. */
  private mode(id: string): 'stage' | 'pool' | null {
    const app = this.s.app;
    const phase = app.run.phase;
    if (!app.storyOverlay) return phase === 'scene' ? 'stage' : null;
    if (phase === 'fight') return 'stage';
    if (phase === 'camp' && newcomerOf(id)) return 'pool';
    return null;
  }

  /** A foe speaker's fight sprite (found by its name in the enemies' data), painted or not there at all. */
  private foeOf(who: string): { sprite: string; fly: number } | null {
    if (this.foeSprite.has(who)) {
      const f = this.foeSprite.get(who) ?? null;
      return f && this.s.textures.exists(`${f.sprite}_idle0`) ? f : null;
    }
    const plain = (n: string) => n.replace(/^The /, '').toLowerCase();
    const name = plain((SPEAKER_NAME as Record<string, string | undefined>)[who] ?? '');
    let found: { sprite: string; fly: number } | null = null;
    if (name)
      for (const def of Object.values(this.s.app.tuning.enemies))
        if (plain(def.name) === name) {
          if (!this.s.textures.exists(`${def.sprite}_idle0`)) this.s.ensureRegionPacks(`${def.sprite}_idle0`);
          let sprite = def.sprite;
          if (!this.s.textures.exists(`${sprite}_idle0`) && SPRITE_STAND_IN[sprite]) sprite = SPRITE_STAND_IN[sprite];
          found = { sprite, fly: def.fly ?? 0 };
          break;
        }
    this.foeSprite.set(who, found);
    return found && this.s.textures.exists(`${found.sprite}_idle0`) ? found : null;
  }

  /** A hero's idle frame (four-frame breath when they have it), offset so the cast doesn't breathe in step. */
  private idleTex(hero: HeroId, t: number): string {
    const art = heroDef(hero).art;
    const tx = this.s.textures;
    if (tx.exists(`${art}_idle2`) && tx.exists(`${art}_idle3`)) return `${art}_idle${Math.floor(t / 300) % 4}`;
    const k = `${art}_idle${Math.floor(t / 420) % 2}`;
    return tx.exists(k) ? k : tx.exists(`${art}_idle0`) ? `${art}_idle0` : 'hero_idle0';
  }

  private shadow(x: number, y: number, w: number, a = 0.42): void {
    const g = this.g;
    g.fillStyle(INK, a * 0.5);
    g.fillEllipse(x + 1, y, w + 6, 5);
    g.fillStyle(INK, a);
    g.fillEllipse(x + 1, y, w, 3);
  }

  /** The speaker's light: a soft warm pool at their feet. */
  private pool(x: number, y: number, w: number): void {
    const g = this.g;
    g.fillStyle(0xffe2b0, 0.07);
    g.fillEllipse(x, y, w + 18, 9);
    g.fillStyle(0xffe2b0, 0.08);
    g.fillEllipse(x, y, w, 5);
  }

  /**
   * Draw the stage for a scene's box (over the scene's dim, under its box: `boxTop`, its top edge). Returns false when
   * this scene isn't staged.
   */
  draw(now: number, id: string, boxIdx: number, boxTop: number): boolean {
    const s = this.s;
    const g = this.g;
    g.clear();
    this.used = 0;
    const mode = this.mode(id);
    const boxes = STORY[id];
    if (!mode || !boxes) {
      this.hide();
      return false;
    }
    if (id !== this.sceneKey) {
      this.sceneKey = id;
      this.sceneAt = now;
      this.enterAt.clear();
    }
    const app = s.app;
    const who = boxes[Math.min(boxIdx, boxes.length - 1)].who;
    const ground = mode === 'pool' ? Math.min(s.ground, boxTop - 8) : s.ground;
    const home = s.heroHome;
    // the hero fighting stands on the act's stage already; over the camp Rowan takes that spot when he speaks
    const base: HeroId | null = mode === 'stage' ? ((app.run.hero.build?.id ?? 'rowan') as HeroId) : null;
    const fresh = newcomerOf(id);
    const foesOut = mode === 'stage' && !!app.storyOverlay; // a boss's scene mid-fight: the foes stand on the right
    // who has spoken so far, in order
    const firstBox = new Map<string, number>();
    for (let i = 0; i <= boxIdx && i < boxes.length; i++) if (!firstBox.has(boxes[i].who)) firstBox.set(boxes[i].who, i);
    if (fresh?.chest) firstBox.set(fresh.hero, Math.min(firstBox.get(fresh.hero) ?? 0, 0));
    const foeWho = !foesOut ? [...firstBox.keys()].find((w) => !isHero(w) && this.foeOf(w)) : undefined;
    const line = foesOut || !!foeWho; // facing the foes, else facing each other
    const members: Member[] = [];
    const seen = (key: string, box: number): number => {
      let t = this.enterAt.get(key);
      if (t === undefined) {
        t = box === boxIdx ? now : -1e9;
        this.enterAt.set(key, t);
      }
      return t;
    };
    // the newcomer faces the party from the first spot on the right (out of the chest: from the scene's start)
    const talk = [home + 48, home + 82, home + 116];
    const lineUp = [home + 30, home - 28, home + 58];
    let nTalk = 0;
    let nLine = 0;
    if (fresh && fresh.hero !== base && firstBox.has(fresh.hero)) {
      members.push({ id: fresh.hero, kind: 'hero', x: talk[nTalk++], left: true, enterAt: fresh.chest ? this.sceneAt + CHEST_OUT_MS : seen(fresh.hero, firstBox.get(fresh.hero)!) });
    }
    for (const [w, b] of firstBox) {
      if (!isHero(w) || w === base || w === fresh?.hero) continue;
      if (mode === 'pool' && w === 'rowan' && !members.some((m) => m.x === home)) {
        members.push({ id: w, kind: 'hero', x: home, left: false, enterAt: seen(w, b) });
        continue;
      }
      if (line && nLine < lineUp.length) members.push({ id: w, kind: 'hero', x: lineUp[nLine++], left: false, enterAt: seen(w, b) });
      else if (!line && nTalk < talk.length) members.push({ id: w, kind: 'hero', x: talk[nTalk++], left: true, enterAt: seen(w, b) });
    }
    if (foeWho) members.push({ id: foeWho, kind: 'foe', x: Math.min(s.R - 34, Math.round(GAME_W / 2 + 60)), left: true, enterAt: seen(`foe:${foeWho}`, firstBox.get(foeWho)!) });
    for (const m of members) m.x = Math.max(s.L + 24, Math.min(s.R - 22, m.x));

    // over the camp: a deeper dim and a pool of light on the ground where the cast stands
    if (mode === 'pool') {
      const k = clamp01((now - this.sceneAt) / 200);
      g.fillStyle(INK, 0.42 * k);
      g.fillRect(-20, -20, s.R + s.L + 1000, s.B + 200);
      const xs = members.map((m) => m.x).concat(fresh?.chest ? [home + 96] : []);
      const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : (s.L + s.R) / 2;
      const span = xs.length ? Math.max(...xs) - Math.min(...xs) + 80 : 120;
      for (let i = 0; i < 4; i++) {
        g.fillStyle(0xffd8a0, 0.035 * k);
        g.fillEllipse(cx, ground, span + 70 - i * 22, 22 - i * 4);
      }
      // a faint shaft of light from above
      g.fillStyle(0xffe6c0, 0.025 * k);
      g.fillRect(cx - span / 2, 0, span, ground);
    }

    const onStage = (w: string): boolean => w === base || w === 'pip' || members.some((m) => m.id === w);
    const tintOf = (w: string): number => (w === who ? LIT : onStage(who) ? DIM : EVEN);

    // on the act's stage: lit copies over the hero who's fighting and the companions (they stand under the dim)
    if (mode === 'stage') {
      const hi = s.fighters.heroImage;
      if (hi.visible && base) {
        const t = tintOf(base);
        if (t === LIT) this.pool(hi.x, ground, 22);
        this.img(hi.texture.key, hi.x, hi.y, D_CAST + 0.002, { ox: hi.originX, oy: hi.originY, flip: hi.flipX, tint: t, alpha: hi.alpha, sx: hi.scaleX, sy: hi.scaleY });
      }
      for (const p of s.fighters.party.pets) {
        if (!p.img.visible) continue;
        this.img(p.img.texture.key, p.img.x, p.img.y, D_CAST + 0.001, { ox: p.img.originX, oy: p.img.originY, flip: p.img.flipX, tint: tintOf(p.id) });
      }
    }

    // the chest a hero arrives in: open, its light in the hero's rarity colour; a flash as they come out
    if (fresh?.chest) {
      const cx = Math.min(s.R - 26, home + 96);
      const col = TIER_INFO[HEROES[fresh.hero].rarity].face;
      const t = now - this.sceneAt;
      const out = t - CHEST_OUT_MS;
      const pulse = 0.55 + 0.15 * Math.sin(t / 260);
      this.shadow(cx, ground, 40, 0.5);
      if (s.textures.exists('hchest_glow')) {
        this.img('hchest_glow', cx, ground - 22, D_GLOW, { oy: 0.5, add: true, tint: col[0], alpha: pulse * (out < 0 ? clamp01(t / 300) : 1), sx: 1.1 });
        // the light pours up out of the open chest
        this.img('hchest_glow', cx, ground - 40, D_GLOW, { oy: 0.5, add: true, tint: col[1], alpha: pulse * 0.6, sx: 0.7, sy: 1.4 });
      }
      if (out >= 0 && out < 520 && s.textures.exists('hchest_burst')) {
        const bk = out / 520;
        this.img('hchest_burst', cx, ground - 26, D_GLOW, { oy: 0.5, add: true, tint: col[0], alpha: (1 - bk) * 0.9, sx: 0.6 + bk * 0.9 });
      }
      if (s.textures.exists('hchest_hero_big_open')) this.img('hchest_hero_big_open', cx, ground + 2, D_CHEST);
      // its open mouth spills light over the rim (so it reads as open, not shut)
      if (s.textures.exists('hchest_glow')) this.img('hchest_glow', cx, ground - 21, D_CHEST + 0.001, { oy: 0.5, add: true, tint: col[0], alpha: Math.min(1, pulse * 1.4), sx: 0.75, sy: 0.22 });
    }

    // the cast: heroes in their idle breath, a foe in its own; each steps in the first time it speaks
    members.forEach((m, i) => {
      const t = now - m.enterAt;
      if (t < 0 && !(fresh?.chest && m.id === fresh.hero)) return;
      const tint = tintOf(m.id);
      if (m.kind === 'foe') {
        const f = this.foeOf(m.id);
        if (!f) return;
        const k = clamp01(t / STEP_MS);
        const e = 1 - (1 - k) ** 3;
        const x = m.x + (1 - e) * STEP_DX;
        const pose = Math.floor((now + i * 230) / 460) % 2 && s.textures.exists(`${f.sprite}_idle1`) ? 'idle1' : 'idle0';
        const key = `${f.sprite}_${pose}`;
        const w = s.textures.get(key).getSourceImage().width;
        this.shadow(x, ground, Math.min(48, w * 0.6), f.fly ? 0.25 : 0.42);
        if (tint === LIT) this.pool(x, ground, Math.min(56, w * 0.7));
        this.img(key, x, ground - f.fly, D_CAST, { tint, alpha: clamp01(t / 140) });
        return;
      }
      const hero = m.id as HeroId;
      const tex = this.idleTex(hero, now + i * 170);
      const ox = (m.left ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W;
      if (fresh?.chest && hero === fresh.hero) {
        // out of the chest: a bright figure rises from its light, hops out to its spot and takes its colours
        const cx = Math.min(s.R - 26, home + 96);
        const col = TIER_INFO[HEROES[hero].rarity].face[0];
        const out = now - (this.sceneAt + CHEST_OUT_MS);
        if (out < 0) return;
        if (out < RISE_MS) {
          const k = out / RISE_MS;
          const y = ground - 4 - (1 - (1 - k) ** 2) * 14;
          this.img(tex, cx, y, D_BEHIND, { ox, flip: m.left, fill: col, alpha: clamp01(k * 2) });
          return;
        }
        const k = clamp01((out - RISE_MS) / HOP_MS);
        const e = 1 - (1 - k) ** 2;
        const x = cx + (m.x - cx) * e;
        const y = ground - 18 * (1 - e) - Math.sin(k * Math.PI) * 8;
        if (k >= 1) {
          this.shadow(m.x, ground, 18);
          if (tint === LIT) this.pool(m.x, ground, 22);
        }
        this.img(tex, x, y, k < 0.35 ? D_BEHIND : D_CAST, { ox, flip: m.left, tint: k < 1 ? LIT : tint });
        // the light leaves them as they land
        if (k < 1) this.img(tex, x, y, (k < 0.35 ? D_BEHIND : D_CAST) + 0.001, { ox, flip: m.left, fill: col, alpha: 1 - k });
        return;
      }
      const k = clamp01(t / STEP_MS);
      const e = 1 - (1 - k) ** 3;
      const x = m.x + (1 - e) * (m.left ? STEP_DX : -STEP_DX);
      const bob = k < 1 && Math.floor(t / 95) % 2 ? 1 : 0;
      this.shadow(x, ground, 18);
      if (tint === LIT && k >= 1) this.pool(x, ground, 22);
      this.img(tex, x, ground - bob, D_CAST, { ox, flip: m.left, tint, alpha: clamp01(t / 140) });
    });

    for (let i = this.used; i < this.imgs.length; i++) this.imgs[i].setVisible(false);
    return true;
  }
}
