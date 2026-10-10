// The fighters: Rowan's choreography (dash, slash, parry, finisher whirlwind), the enemies (walk-in, poses,
// knockback, death burst), Pip the owl, and the finisher's streaked backdrop. Every fighter stands in the act's
// light: a soft contact shadow cast away from it, and a rim of its colour along the edges that face it.
// Rowan wears his gear where you can see it: his weapon's rarity colours his slashes and the glint on his blade, a
// Legendary or Mythic piece gives him an aura, the Tusk Crown's crit buff a golden glow; and every gear effect that
// kicks in mid-fight shows a visual that fits it (and its name, the first time each fight). So does every perk (a
// relic, a skill node, a kit part): its damage, heal or stacks (its name with the relic's icon the first time each
// fight; after that its icon pulses on the HUD's belt); Shield Wall's charged bubble sits
// round the hero. Every hero fights in their own frames (`${art}_${pose}`, HEROES[id].art: Rowan's are hero_*), falling
// back to Rowan's for a pose they don't have; the green ability shows their `cast` pose and the finisher their `fin`,
// each in its own show (view/finishers.ts). The party (the companions and a Summoner's allies) is view/party.ts. A
// boss shows its phase's look (`${sprite}${phase}_*`, when it has one) and a stunned foe sees stars. What each perk did
// to its target (a mark on the foe, a box on the block, a burning foe's flames, Sunny's sweep) is view/onsite.ts.
import Phaser from 'phaser';
import { isAshArtKey } from '../art-ash';
import { isDuskArtKey } from '../art-dusk';
import { rimMask, STAGE_LIGHT } from '../art-stage';
import { whole } from '../../core/format';
import type { Combat } from '../../core/combat';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { heroDef, type AllyKind, type HeroId } from '../../data/heroes';
import { EFFECTS, RARITY_INFO, type EffectId } from '../../data/gear';
import { relicById } from '../../data/relics';
import { rarityIndex } from '../../core/gear';
import { equippedIn, equippedItems } from '../../core/profile';
import type { ImpactFeel } from '../../core/impact';
import type { Tier } from '../../data/rarity';
import type { FightScene } from '../scene';
import { HERO_FEET_X, HERO_W, ICONS } from '../art';
import { ROWAN_SWORD_TIP } from '../art-heroes';
import { GAME_W } from '../layout';
import { textWidth } from '../font';
import { hpBar, icon } from './pixels';
import { perkColor, perkName, perkSource, TAG_FACE } from './relic-ui';
import { FOE_ICONS } from './icons';
import { ALLY_COL, Party, PERK_PET } from './party';
import { BLOCKER_FACE } from './bar-kinds';
import { PERK_ALLY, PERK_AT } from './perk-at';
import { FinisherShow } from './finishers';
import type { HeroMotion } from './finisher-signatures';
import {
  clamp01,
  comboSlashCol,
  DASH_MS,
  DEATH_CHARGE_MS,
  ease,
  ENEMY_COL,
  ENGAGE_MS,
  ENTER_MS,
  inRect,
  LEAP_MS,
  rand,
  RETURN_MS,
  SPRITE_SCALE,
  INK,
  mix,
  pulse,
  stackCol,
  superMsFor,
  WHITE,
  type EnemyView,
  type HeroAnim,
} from './shared';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];
/** A colour lifted halfway to white (damage numbers in a perk's colour). */
const mixWhite = (c: number) => mix(c, WHITE, 0.4);
/** The four-frame idle's step (a 1.2 s loop: docs/art-style.md section 7). */
const IDLE_STEP_MS = 300;
/** Squash and stretch never lasts longer than this. */
const SQUASH_MS = 100;
/** A new wave's enemies hop (or drop) in over this long. */
const WAVE_IN_MS = 460;
/** The frame to use for a pose a hero doesn't have (their own first, then Rowan's). */
const HERO_ALT: Record<string, string> = { slashX: 'slashB', fang: 'slashA', down: 'hurt', fin: 'slashB', cast: 'windup' };
/** Perks that never name themselves in the lane (the allies' own doings, shown on them). */
const QUIET_PERKS = new Set(['thornling', 'glowmoth', 'seedling', 'rally', 'spiritWolf', 'wispSwarm', 'spiritStag']);
/** Allies whose perk is a blow or a heal: the bolt starts at the ally (not the hero). */
const ALLY_PERK = new Set(['thornling', 'glowmoth', 'seedling', 'spiritWolf', 'spiritStag']);
/** Perks that heal (their amount is HP; any relic tagged Sustain does too). */
const HEAL_PERKS = new Set(['photosynthesis', 'vampiricFang', 'glowmoth', 'mend', 'rimewalker', 'sanctuary', 'hotCocoa']);

export class Fighters {
  h: HeroAnim;
  enemies = new Map<number, EnemyView>();
  private hero!: Phaser.GameObjects.Image;
  /** The companions and a Summoner's allies. */
  readonly party: Party;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private ghostTrail: Array<{ x: number; y: number; tex: string; flip: boolean; at: number }> = [];
  private gShadow!: G;
  private gSuper!: G;
  superMs = superMsFor(1);
  superFinalAt = -1e9; // anim time of the finisher's last blow
  burstAt = new Map<number, number>(); // enemy id -> anim time it bursts
  lastBurstAt = -1e9;
  /** Enemies born from a split: id -> the x they pop out from. */
  private splitFrom = new Map<number, number>();
  /** Enemies arriving with a new wave (hop in from the right, or drop in for fliers): id -> landed yet. */
  private waveIn = new Map<number, boolean>();
  /** Rim-light companions (ADD), drawn right above their fighter. */
  private heroRim!: Phaser.GameObjects.Image;
  /** The title screen shows big showcase versions of Rowan and Pip: the stage's own stay hidden (rims and shadows too). */
  private get showcase(): boolean {
    return this.s.app.run.phase === 'title';
  }
  private enemyRims = new Map<number, Phaser.GameObjects.Image>();
  private hurtSeen = 0;
  /** Anim times of the last blow taken and the last landing (squash and stretch), and the last frame's lift. */
  private hurtAt = -1e9;
  private landAt = -1e9;
  private lastLift = 0;
  /** Gear light under and around Rowan (additive, behind the actors), and a glowing silhouette just behind him. */
  private gAura!: G;
  private heroGlow!: Phaser.GameObjects.Image;
  private glintAt = -1e9; // anim time of the last slash's glint
  private auraMoteAt = 0;
  /** Effect and perk names shown this fight: each name shows the first time it kicks in, then only what it does. */
  private named = new Set<string>();
  private namedFight: unknown = null;
  /** The finisher show (each hero's own: their style's kit, their signature moment, their rarity's scale). */
  readonly show: FinisherShow;
  /** The Test lab's Finisher gallery shows a finisher at another rarity than the hero's own (null: their own). */
  showTier: Tier | null = null;
  /** The hero is hidden by the show (a tornado, a shadow stands in for them). */
  private showHidden = false;
  /** Shield Wall's bubble as last drawn (charged or not), and when it changed. */
  private bubble = false;
  private bubbleAt = -1e9;

  constructor(private readonly s: FightScene) {
    this.h = this.freshHero();
    this.party = new Party(s);
    this.show = new FinisherShow(s);
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
      down: false,
    };
  }

  /** Who is fighting. */
  private heroId(): string {
    return this.s.app.run.hero.build?.id ?? 'rowan';
  }

  /** The hero's frame for a pose: their own (`${art}_${pose}`, or their nearest pose), else Rowan's (hero_*). */
  heroTex(pose: string): string {
    const t = this.s.textures;
    const art = heroDef(this.heroId() as HeroId).art;
    const alt = HERO_ALT[pose];
    if (t.exists(`${art}_${pose}`)) return `${art}_${pose}`;
    if (alt && t.exists(`${art}_${alt}`)) return `${art}_${alt}`;
    if (t.exists(`hero_${pose}`)) return `hero_${pose}`;
    return `hero_${alt ?? 'idle0'}`;
  }

  /** Whether the hero has their own frame for a pose. */
  private hasPose(pose: string): boolean {
    return this.s.textures.exists(`${heroDef(this.heroId() as HeroId).art}_${pose}`);
  }

  /** Create the fighter layers for a new layout (the containers were just emptied). */
  build(): void {
    const s = this.s;
    this.gSuper = s.add.graphics();
    s.back.add(this.gSuper);
    this.gShadow = s.add.graphics();
    s.back.add(this.gShadow);
    this.gAura = s.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    s.back.add(this.gAura);
    this.party.build();
    this.party.syncPets(() => this.makeRim());
    this.ghosts = [0, 1, 2].map(() => s.add.image(0, 0, 'hero_dash').setVisible(false).setTintMode(Phaser.TintModes.FILL));
    s.actors.add(this.ghosts);
    this.ghostTrail = [];
    this.superFinalAt = -1e9;
    this.heroGlow = s.add.image(0, 0, 'hero_idle0').setBlendMode(Phaser.BlendModes.ADD).setTintMode(Phaser.TintModes.FILL).setVisible(false);
    this.hero = s.add.image(s.heroHome, s.ground, 'hero_idle0').setScale(SPRITE_SCALE);
    this.heroRim = this.makeRim();
    s.actors.add([this.heroGlow, this.hero, this.heroRim]);
    this.show.build();
  }

  private makeRim(): Phaser.GameObjects.Image {
    return this.s.add.image(0, 0, '__DEFAULT').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  /** The rim-light mask of a sprite frame for the current theme (painted the first time it is needed). */
  private rimKey(key: string): string | null {
    if (key.endsWith('_flash') || key.startsWith('__')) return null;
    const theme = this.s.app.run.theme;
    const rk = `${key}~rim_${theme}`;
    const tex = this.s.textures;
    if (tex.exists(rk)) return rk;
    if (!tex.exists(key)) return null;
    const L = STAGE_LIGHT[theme];
    const src = tex.get(key).getSourceImage() as HTMLCanvasElement;
    const mask = src instanceof HTMLCanvasElement ? rimMask(src, L.rimLeft, L.rimTop) : null;
    if (!mask) return null;
    tex.addCanvas(rk, mask);
    return rk;
  }

  /** Lay a fighter's rim light over it (same frame, place, origin and scale), or hide it. */
  private syncRim(src: Phaser.GameObjects.Image, rim: Phaser.GameObjects.Image | undefined, on = true): void {
    if (!rim) return;
    const rk = on && src.visible && !src.flipX && src.alpha > 0 ? this.rimKey(src.texture.key) : null;
    if (!rk) return void rim.setVisible(false);
    const L = STAGE_LIGHT[this.s.app.run.theme];
    rim.setTexture(rk).setPosition(src.x, src.y).setOrigin(src.originX, src.originY).setScale(src.scaleX, src.scaleY);
    rim.setTint(L.rim).setAlpha(src.alpha * L.rimAmt).setVisible(true);
  }

  /** Forget every enemy view and reset the hero (their images went with the old layout). */
  reset(): void {
    this.enemies.clear();
    this.enemyRims.clear();
    this.waveIn.clear();
    this.h = this.freshHero();
  }

  /** A new fight: old enemy views go, the hero starts fresh. */
  newFight(): void {
    for (const v of this.enemies.values()) v.img.destroy();
    for (const r of this.enemyRims.values()) r.destroy();
    this.enemies.clear();
    this.enemyRims.clear();
    this.waveIn.clear();
    this.splitFrom.clear();
    this.h = this.freshHero();
    this.superFinalAt = -1e9;
    this.show.reset();
    this.bubble = false;
    this.party.newFight();
  }

  /** Where an enemy stands: centered when it fights alone, in a row by slot in a group (summons join the row). */
  private homeFor(slot: number, c: Combat): number {
    if (c.enemies.length === 1) return Math.round(GAME_W / 2 + 44);
    return Math.round(GAME_W / 2 + 16 + slot * 31);
  }

  /**
   * Add a view for every living enemy that doesn't have one yet (they walk in from the right). `walkIn`: a new wave
   * arriving: they hop in quickly from off-screen right (fliers drop in from above) and land with a dust puff.
   */
  addEnemies(c: Combat, walkIn = false): void {
    const s = this.s;
    let n = 0;
    for (const e of c.enemies) {
      if (this.enemies.has(e.id) || !e.alive) continue;
      const def = s.app.tuning.enemies[e.key];
      // the third region's foes are painted in idle time after boot: one that's needed sooner is finished now
      if (!s.textures.exists(`${def.sprite}_idle0`) && isAshArtKey(`${def.sprite}_idle0`)) s.ensureAshArt();
      if (!s.textures.exists(`${def.sprite}_idle0`) && isDuskArtKey(`${def.sprite}_idle0`)) s.ensureDuskArt();
      const img = s.add.image(0, 0, `${def.sprite}_idle0`).setOrigin(0.5, 1).setScale(SPRITE_SCALE);
      const rim = this.makeRim();
      s.actors.add([img, rim]);
      this.enemyRims.set(e.id, rim);
      const x = this.homeFor(e.slot, c);
      const from = this.splitFrom.get(e.id);
      this.splitFrom.delete(e.id);
      const wave = walkIn && from === undefined;
      if (wave) this.waveIn.set(e.id, false);
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
        enterAt: s.anim + (wave ? n++ * 110 : from === undefined ? Math.min(2, e.slot) * 120 : 0),
        fly: def.fly ?? 0,
        tellAt: 0,
        tellUntil: 0,
        fleeAt: 0,
        popAt: 0,
        enterFrom: from ?? GAME_W + (wave ? 20 : 30),
        stunUntil: 0,
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

  /**
   * The hero dashes in and slashes (`ward`: a shell block cracks, so no hit sound and no damage number), alternating
   * their two strikes (an echo: both of Sable's daggers at once).
   */
  heroAttack(enemyId: number, damage: number, crit: boolean, perfect: boolean, combo: number, ward = false, echo = false): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    const h = this.h;
    h.lastAction = s.anim;
    h.alt = !h.alt;
    const slash = echo && this.heroId() === 'sable' ? 'slashX' : h.alt ? 'slashA' : 'slashB';
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
      // he pushes off: dust thrown back behind his heels
      s.fx.dust(h.x - 4, s.ground, 4, -1, 0.9);
      if (arrive) s.app.audio.swish(); // the tap's instant feedback while the dash closes in
    }
    s.later(arrive, () => {
      if (h.state === 'dash') {
        h.state = 'engaged';
        h.x = h.toX;
        s.fx.dust(h.x + 6, s.ground, 3, 1, 0.7); // skids to a stop
      }
      this.setHeroPose(slash, 110);
      h.lungeAt = s.anim;
      this.glintAt = s.anim;
      this.enemyHurtFx(enemyId, damage, crit, perfect, land());
    });
  }

  // ------------------------------------------------------------------ gear on Rowan

  /** The weapon Rowan wears, when it's better than Common: its rarity's colours tint his slashes and blade glint. */
  weaponLook(): { r: number; face: Face } | null {
    const w = equippedIn(this.s.app.profile, 'weapon');
    const r = w ? rarityIndex(w.rarity) : 0;
    return w && r >= 1 ? { r, face: RARITY_INFO[w.rarity].face } : null;
  }

  /** The rarest piece Rowan wears if it's Legendary or Mythic (it gives him an aura). */
  auraLook(): { r: number; face: Face } | null {
    let best: { r: number; face: Face } | null = null;
    for (const it of equippedItems(this.s.app.profile)) {
      const r = rarityIndex(it.rarity);
      if (r >= 4 && (!best || r > best.r)) best = { r, face: RARITY_INFO[it.rarity].face };
    }
    return best;
  }

  /** Whether `key`'s name may show now: the first time it kicks in each fight (it is marked shown). */
  firstName(key: string): boolean {
    const c = this.s.app.run.combat;
    if (c !== this.namedFight) {
      this.namedFight = c;
      this.named.clear();
    }
    if (this.named.has(key)) return false;
    this.named.add(key);
    return true;
  }

  /** An effect's name in the HUD's name lane (under the hero plate), the first time it kicks in each fight. Returns
   *  whether it showed. */
  private gearName(key: string, name: string): boolean {
    if (!this.firstName(key)) return false;
    this.s.hud.announce(name, 0xffb060);
    return true;
  }

  /**
   * A piece of gear's unique effect kicked in: its name (in the HUD's name lane, the first time each fight) and a
   * visual that fits it. Heals add up in one small number under the HP plate (hud.healPop), so a long fight never
   * fills up with text. `at`: where on the bar the miss (Footpad) or the bomb (Captain's Cutlass) was.
   */
  gearFx(fx: EffectId | 'footpad', amount: number, enemyId: number, at: { missX?: number; bombX?: number } = {}): void {
    const s = this.s;
    const F = s.fx;
    const h = this.h;
    const audio = s.app.audio;
    const now = performance.now();
    const name = fx === 'footpad' ? 'Footpad: saved!' : EFFECTS[fx].name;
    const barY = s.bar.y + s.bar.h / 2;
    switch (fx) {
      case 'golemheart':
      case 'ramshorn':
      case 'leech': {
        // a green glint on him, and the heal by the HP bar (blocks and crits come fast: the heals add up in one number)
        if (amount <= 0) break;
        s.hud.healPop(amount);
        F.burst(h.x + 2, s.ground - 18, 0x9af06a, 5, true, 0.6);
        if (this.gearName(fx, name)) audio.gearProc(0.3);
        break;
      }
      case 'secondWind': {
        // the big one: a green flash, rings of light round him, the heal by the HP bar
        F.screenFlash(0x9af06a, now, 420);
        s.hud.healPop(amount);
        F.ring(h.x, s.ground - 18, 30, 0x9af06a, true);
        s.later(90, () => F.ring(h.x, s.ground - 18, 44, 0xc8ff8a, true));
        F.burst(h.x, s.ground - 18, 0x9af06a, 18, true, 1.2);
        F.burst(h.x, s.ground - 18, WHITE, 8, true, 1, true);
        F.glow(h.x, s.ground - 18, 26, 0x9af06a, 520, s.ground);
        this.named.delete(fx); // the big one always names itself
        this.gearName(fx, `${name}!`);
        audio.heal();
        audio.gearProc(1);
        break;
      }
      case 'riposte': {
        // a spark flies back from Rowan's guard to the foe and hits it
        const v = this.enemies.get(enemyId);
        if (!v) break;
        const sx = h.x + 10;
        const sy = s.ground - 22;
        const tx = v.x - v.img.displayWidth * 0.25;
        const ty = v.y - v.img.displayHeight / 2;
        const ms = 130;
        F.bolt(sx, sy, tx, ty, ms, 0x9ad8ff);
        F.burst(sx, sy, 0x9ad8ff, 4, true, 0.8, true);
        s.later(ms, () => {
          v.flashUntil = s.anim + 60;
          v.kickAt = s.anim;
          v.kickDist = 5;
          if (!v.dieAt) this.setEnemyPose(v, 'hurt', 140);
          F.sparks.push({ x: tx, y: ty, at: s.anim, size: 11, color: 0x9ad8ff });
          F.burst(tx, ty, 0x9ad8ff, 8, true, 1.2, true);
          F.glow(tx, ty, 12, 0x9ad8ff, 160);
          F.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), 0x9ad8ff, 2);
          audio.hit(0, false);
        });
        this.gearName(fx, name);
        break;
      }
      case 'cutlass': {
        // the tapped bomb crits: an orange starburst on the bar where it blew (its name in the lane)
        const x = at.bombX ?? s.bar.x + s.bar.w / 2;
        F.stars.push({ x, y: barY, at: s.anim, r: 18, color: 0xff8a2a, world: false });
        F.ring(x, barY, 24, 0xffb060, false);
        F.chips(x, barY, 10, [0xffb060, 0xff8a2a, WHITE], 14, -1);
        this.gearName(fx, `${name}!`);
        audio.gearProc(0.8);
        break;
      }
      case 'tuskCrown': {
        // the crit buff: a golden ring (and his golden glow while it lasts: drawActors; the plate's gold timer), its
        // name in the lane the first time each fight
        F.ring(h.x, s.ground - 18, 26, 0xffd23a, true);
        F.burst(h.x, s.ground - 18, 0xffe680, 14, true, 1.1);
        this.gearName(fx, name);
        audio.gearProc(1);
        break;
      }
      case 'pendulum': {
        // the new green block: a brass tick-tock ring on it
        const c = s.app.run.combat;
        let b = null as { pos: number; id: number } | null;
        for (const x of c?.blocks ?? []) if (x.kind === 'green' && (!b || x.id > b.id)) b = x;
        const x = b ? s.barView.x(b.pos) : s.bar.x + s.bar.w / 2;
        F.ring(x, barY, 12, 0xd8a040, false);
        s.later(160, () => F.ring(x, barY, 18, 0xf2c230, false));
        F.chips(x, barY, 6, [0xf2c230, 0xd8a040, WHITE], 6, -1);
        this.gearName(fx, name);
        audio.tickTock();
        break;
      }
      case 'opener': {
        // the first hit on a new foe is a sure crit: its name in the lane
        if (this.enemies.has(enemyId) && this.gearName(fx, `${name}!`)) audio.gearProc(0.6);
        break;
      }
      case 'footpad': {
        // the fight's first miss is forgiven: "Saved!" over the bar where it happened
        const x = at.missX ?? s.bar.x + s.bar.w / 2;
        F.judge(x, 'Saved!', 0x9af06a, true);
        F.chips(x, barY, 8, [0x9af06a, WHITE], 8, -1);
        F.ring(x, barY, 14, 0x9af06a, false);
        this.gearName(fx, name);
        audio.gearProc(0.4);
        break;
      }
    }
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
    // (a finisher's last blow brings its style's own burst and cut: view/finishers.ts)
    if (big && !finisher) fx.stars.push({ x: v.x, y: cy - 8, at: s.anim, r: 24, color: 0xfff07a });
    fx.sparks.push({ x: hx, y: cy, at: s.anim, size: finisher ? 18 : crit ? 14 : 10, color: big ? 0xfff07a : 0xbfe8ff });
    const numScale = scale || (finisher ? 3 : 2);
    // quick successive numbers cascade upward and alternate sides instead of piling on each other
    const recent = s.anim - v.numAt < 260;
    v.numLevel = recent ? (v.numLevel + 1) % 3 : 0;
    v.numAt = s.anim;
    // (a Coin Rush counts coins, not damage: the coins float up instead, from onsite.coins)
    if (damage > 0 && !s.app.run.combat?.rush) fx.floatNum(v.x + (v.numLevel % 2 ? 8 : -6) + rand(-2, 2), v.y - v.img.displayHeight - 10 - v.numLevel * 11, whole(damage), col, numScale);
    const tier = combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;
    const slashCol = crit ? 0xffd23a : comboSlashCol(combo);
    // a weapon better than Common slashes in its rarity's colours (the combo's heat still shows in the inner band)
    const wl = finisher ? null : this.weaponLook();
    if (wl) {
      const [hi, base, , deep] = wl.face;
      fx.slashes.push({ x: v.x, y: cy, at: s.anim, big: big || tier >= 2, dir: this.h.alt ? 1 : -1, color: crit ? hi : base, rim: deep, core: mix(tier > 0 || crit ? slashCol : hi, WHITE, 0.45) });
    } else if (!finisher) fx.slashes.push({ x: v.x, y: cy, at: s.anim, big: big || tier >= 2, dir: this.h.alt ? 1 : -1, color: slashCol });
    fx.burst(hx, cy, WHITE, (big ? 14 : 8) + tier * 2, true, big ? 1.6 : 1.1, true);
    fx.chips(hx, cy, 6, [WHITE, col, ENEMY_COL[v.sprite] ?? WHITE], big ? 10 : 5, 0);
    if (big) fx.ring(v.x, cy, 28, col, true);
    // light: a bloom at the contact point that also lights the ground; the enemy's feet scrape back in the dust
    const I = s.app.tuning.impact;
    const heavy = clamp01((feel.knockPx - I.knockLight) / Math.max(1, I.knockHeavy - I.knockLight));
    const feet = v.y + v.fly;
    fx.glow(hx, cy, 9 + heavy * 14 + (big ? 4 : 0), big ? 0xffc060 : 0xfff0c0, 150 + heavy * 120, v.fly ? undefined : feet);
    if (!v.fly) fx.dust(v.x + v.img.displayWidth * 0.3, feet, 2 + Math.round(heavy * 5), 1, 0.7 + heavy * 0.6);
    if (heavy > 0.3 || finisher) {
      fx.rubble(v.x, s.ground, 3 + Math.round(heavy * 7), 0.7 + heavy * 0.5);
      fx.shock(v.x, s.ground, 18 + heavy * 22, big ? 0xffd890 : 0xfff0c0);
    }
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
    fx.glow(sx, sy, cracked ? 12 : 16, 0x7ae0ff, 170, s.ground);
    if (cracked) fx.dust(h.x - 4, s.ground, 4, -1, 1); // shoved back on his heels
    const v = this.enemies.get(ownerId);
    if (v && !v.dieAt) {
      v.knockUntil = s.anim + 80;
      v.kickAt = s.anim;
      v.kickDist = feel.knockPx * 0.5; // the parried enemy is shoved back a little
      this.setEnemyPose(v, 'attack', 90);
    }
  }

  /**
   * The finisher show (view/finishers.ts), each hero's own: their style's kit (its sky, strikes and last blow), their
   * signature moment, scaled by their rarity (the Test lab's gallery can pick another: `showTier`) and the stacks spent
   * (more strikes, rings and sky). It always fits the envelope the core holds the cursor for (finisherShowMs). The last
   * blow lands here: the hit on every target and its number counting up. Kills and the HP bars wait for it.
   */
  heroFinisher(damage: number, stacks: number, targets: number[] = []): void {
    const s = this.s;
    const fx = s.fx;
    const h = this.h;
    // who it hits: every foe, or the one target (Twin Fang, Rampart)
    const all = [...this.enemies.values()].filter((v) => !v.dieAt);
    const hit = targets.length ? all.filter((v) => targets.includes(v.id)) : all;
    const views = hit.length ? hit : all;
    const id = this.heroId();
    const c = this.show.start({
      hero: id,
      tier: this.showTier ?? heroDef(id as HeroId).rarity,
      stacks,
      views,
      heroX: h.x,
      damage,
      heroTex: (pose) => this.heroTex(pose),
      heroAt: () => ({ x: this.h.x, lift: -this.h.y }),
    });
    const n = c.n;
    this.superMs = c.tl.ms;
    const ms = this.superMs;
    h.state = 'super';
    h.fromX = h.x;
    h.toX = c.toX;
    h.t0 = s.anim;
    h.lastAction = s.anim + ms;
    const finalK = c.tl.blow;
    this.superFinalAt = s.anim + ms * finalK;
    const [, hi] = stackCol(n);
    const name = heroDef(id as HeroId).finisher.name;
    const title = n > 1 ? `${name} x${n}!` : `${name}!`;
    // (over the HUD, not in the world: the act's name and the foe pips sat on top of it; it doesn't shake either)
    // (a long name steps down a size so the title stays on screen: Part 6's "Spirit Stampede x3!" ran off it)
    const big = n >= 2 ? 3 : 2;
    const fit = Math.max(1, Math.min(big, Math.floor((GAME_W - 12) / Math.max(1, textWidth(title, 1, true)))));
    fx.addFloater(GAME_W / 2, 42, title, n === 1 ? 0xffe680 : hi, fit, true, 0, -6, 0, ms * 0.95, false);
    // the last blow (three or more foes side by side: smaller numbers, so they read)
    const crowd = views.length > 2;
    let row = 0;
    s.later(ms * finalK, () => {
      s.app.audio.finisherBoom(n);
      const feel = fx.impact(fx.weight('finisher', n));
      for (const v of views) {
        this.enemyHurtFx(v.id, damage, false, false, feel, true, crowd ? 2 : 3);
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
        // (side by side: every other number a row higher, all spread a little apart, so they never pile up)
        if (num && damage > 0 && crowd) {
          num.y -= (row % 2) * 18;
          num.x += (row - (views.length - 1) / 2) * 6;
          row++;
        }
        fx.burst(v.x, v.y - v.img.displayHeight / 2, c.pal.light, 10 + n * 6, true, 1.4 + n * 0.15);
      }
      // the style's last blow and the signature's (a cut, fangs, a shattering glacier, a toppling wall...)
      this.show.blow();
    });
  }

  /** The green ability kicked in: the hero's `cast` pose (once the slash is through) and a green glint on them. */
  cast(): void {
    const s = this.s;
    if (!this.hasPose('cast')) return;
    s.fx.ring(this.h.x + 2, s.ground - 20, 16, 0x9af0a0, true);
    s.later(120, () => {
      if (this.h.state !== 'super' && !this.h.down) this.setHeroPose('cast', 260);
    });
  }

  /** The hero is knocked out (the defeat): the KO pose (Sable's; Rowan just stays hurt) until the next fight. */
  heroDown(): void {
    this.h.down = true;
  }

  // ------------------------------------------------------------------ perks (relics, skill nodes, kit parts)

  /** A perk's name in the HUD's name lane (its relic's or skill node's icon in front), the first time it kicks in
   *  each fight. */
  private perkLabel(id: string): boolean {
    // the allies' own doings (a jab, a glow, a seed, a Rally) show on the allies themselves: no name in the lane, so
    // three allies out never flood it
    if (QUIET_PERKS.has(id)) return false;
    if (!this.firstName(`perk-${id}`)) return false;
    const relic = relicById(id);
    this.s.hud.announce(perkName(id), perkColor(id), { relic: relic?.id, tex: relic ? undefined : `skill_${id}` });
    return true;
  }

  /**
   * A perk kicked in (a relic, a skill node, a kit part): its relic's icon pulses on the belt, its name shows in the
   * name lane under the hero plate (only the first time each fight, so a perk that fires on every Perfect doesn't
   * flood the screen), and what it did: a blow (`strike`: its enemyHurt follows; a bolt flies to the foe and hits), a
   * heal (the HP by the HP bar, merged like the gear's), stacks banked (`stacks`: the meter's events came first), a
   * ring where it happened on the bar. Coins (`coins`) already flew from the 'coins' event. Returns
   * true when it showed a blow (so its enemyHurt isn't shown twice).
   */
  perkFx(id: string, amount: number, enemyId: number, o: { strike?: boolean; stacks?: boolean; coins?: boolean; pos?: number; from?: { x: number; y: number } } = {}): boolean {
    const s = this.s;
    const F = s.fx;
    const h = this.h;
    s.hud.perkKicked(id);
    const relic = relicById(id);
    // (a node's blow that one of Yara's spirits strikes starts at that spirit too: PERK_ALLY)
    const kin = PERK_AT[id]?.includes('bolt') ? PERK_ALLY[id] : undefined;
    const ally = ALLY_PERK.has(id) ? this.party.allyPos(id as AllyKind) : kin ? this.party.allyPos(kin) : null;
    const col = relic ? TAG_FACE[relic.tags[0]][1] : ally && ALLY_PERK.has(id) ? ALLY_COL[id as AllyKind] : perkSource(id) === 'skill' ? 0x9ad8ff : 0xc8a0ff;
    const v = enemyId ? this.enemies.get(enemyId) : undefined;
    // a companion's perk: it flares; a blocker took a red at the bar's left end: its slab there
    const pet = PERK_PET[id];
    if (pet) this.party.flare(pet);
    const face = BLOCKER_FACE[id];
    if (face) s.barView.blocker(face);
    if (o.coins) {
      this.perkLabel(id);
      return false;
    }
    if (PERK_AT[id]?.includes('burn')) {
      // a burn's tick (Ember Bite): no bolt; its flames flare on the foe and its number shows there (view/onsite.ts)
      this.perkLabel(id);
      return !!o.strike;
    }
    if (o.strike && v && amount > 0 && !v.dieAt && (id === 'shieldSlam' || id === 'wideSlam')) {
      // Hollis's Shield Slam (every block): a shield flies into the red's owner (view/onsite.ts)
      s.onsite.shieldSlam(v, amount, id === 'wideSlam');
      this.perkLabel(id);
      return true;
    }
    if (o.strike && v && amount > 0 && !v.dieAt && s.onsite.p6.ownBlow(id, v, amount)) {
      // a blow with a look of its own (Burr's spines: view/onsite-pets.ts)
      this.perkLabel(id);
      return true;
    }
    if (o.strike && v && amount > 0 && !v.dieAt && (id === 'toss' || id === 'peal') && s.app.run.combat) {
      // ---- Part 6: Fizz's toss (a flask flies to the foe and shatters), Brann's peal (arcs of sound roll to it)
      s.onsite.p6d.strike(id, v, amount, s.app.run.combat);
      this.perkLabel(id);
      return true;
    }
    if (o.strike && v && amount > 0 && id === 'bulwarkBlow') {
      // a Bulwark's blow lands as its great shield reaches the foe (the 'bulwark' perk event came first)
      s.later(s.onsite.bulwarkReach(v), () => s.onsite.bulwarkHit(v, amount));
      return true;
    }
    if (o.strike && v && amount > 0 && !v.dieAt) {
      // a blow: a bolt in the perk's colour from the hero (or the ally that struck, or the foe it bounced off) to the
      // foe, then the hit (an ally's grows with its power: a second bolt, bigger sparks, from x1.4 a big number)
      const sx = o.from ? o.from.x : ally ? ally.x + 6 : h.x + 10;
      const sy = o.from ? o.from.y : ally ? ally.y : s.ground - 24;
      const tx = v.x - v.img.displayWidth * 0.25;
      const ty = v.y - v.img.displayHeight / 2;
      const ms = 120;
      const pw = ally ? Math.max(1, s.onsite.allyPower) : 1;
      F.bolt(sx, sy, tx, ty, ms, col);
      if (pw >= 1.2) F.bolt(sx, sy - 2, tx, ty - 2, ms, mixWhite(col));
      F.burst(sx, sy, col, 4, true, 0.8, true);
      s.later(ms, () => {
        v.flashUntil = s.anim + 60;
        v.kickAt = s.anim;
        v.kickDist = 5 * Math.min(1.6, pw);
        if (!v.dieAt) this.setEnemyPose(v, 'hurt', 140);
        F.sparks.push({ x: tx, y: ty, at: s.anim, size: Math.round(11 * Math.min(1.5, pw)), color: col });
        F.burst(tx, ty, col, Math.round(8 * pw), true, 1.2, true);
        F.glow(tx, ty, 12 * pw, col, 160);
        // (an ally's jabs come often: small numbers, unless it hits hard)
        F.floatNum(v.x + 6, v.y - v.img.displayHeight - 10, whole(amount), mixWhite(col), ally && pw < 1.4 ? 1 : 2);
        s.app.audio.hit(0, false);
      });
      if (this.perkLabel(id)) s.app.audio.gearProc(0.5);
      return true;
    }
    const heal = amount > 0 && (HEAL_PERKS.has(id) || !!relic?.tags.includes('sustain'));
    if (heal) {
      s.hud.healPop(amount);
      F.burst(h.x + 2, s.ground - 18, 0x9af06a, 5, true, 0.6);
      // a heal from an ally (a Glowmoth's lantern): a mote of light drifts from it to the hero
      if (ally) F.bolt(ally.x, ally.y, h.x + 2, s.ground - 20, 200, 0xffe070);
    } else if (o.stacks && amount > 0) {
      // stacks banked: a burst of the stack colour off the meter
      const m = s.meter;
      F.chips(m.x + m.w, m.y + m.h / 2, 10, [WHITE, 0x9ad8ff, col], 8, -1);
    }
    // (what it did on the bar, to a foe, the cursor or the hero shows there: view/onsite.ts)
    // Shield Wall: amount 1 = the bubble charged (it grows round the hero), 0 = it took a hit for him
    if (id === 'shieldWall' && amount <= 0) this.bubblePop();
    if (this.perkLabel(id)) s.app.audio.gearProc(0.35);
    return false;
  }

  /** A perk's cost in HP (Glass Edge, Blood Price, Purple Pact...): its name, and the HP it took in violet. */
  perkHurt(id: string, damage: number): void {
    const s = this.s;
    const h = this.h;
    h.flashUntil = s.anim + 120;
    h.flashColor = 0xc070ff;
    if (damage > 0) s.fx.floatNum(h.x, s.ground - 40, `-${whole(damage)}`, 0xd890ff, 1);
    s.fx.burst(h.x + 4, s.ground - 16, 0xc070ff, 6, true, 0.8);
    this.perkLabel(id);
  }

  /** Shield Wall's bubble breaks (it took a hit for the hero): shards fly. */
  private bubblePop(): void {
    const s = this.s;
    const h = this.h;
    const cy = s.ground - 18;
    s.fx.ring(h.x + 1, cy, 22, 0x9af0ff, true);
    s.fx.chips(h.x + 1, cy, 22, [WHITE, 0x9af0ff, 0x4ac8f0], 16, 0);
    s.fx.burst(h.x + 1, cy, 0xc8f8ff, 10, true, 1.2, true);
    s.fx.addFloater(h.x + 2, s.ground - 52, 'Blocked!', 0x9af0ff, 1, true, 0, -16, 0, 700, true);
    this.bubble = false;
    this.bubbleAt = s.anim;
  }

  /** Shield Wall's charged bubble round the hero: a shimmering shell with a lit rim (it pops in when it charges). */
  private drawBubble(g: G, c: Combat | null): void {
    const s = this.s;
    const on = !!c && c.perk.shieldWall === 1 && s.app.run.phase === 'fight';
    const a = s.anim;
    if (on !== this.bubble) {
      this.bubble = on;
      this.bubbleAt = a;
      if (on) {
        s.fx.ring(this.h.x + 1, s.ground - 18, 20, 0x9af0ff, true);
        s.fx.sparkle(this.h.x + 1, s.ground - 34);
      }
    }
    if (!on || !this.hero.visible) return;
    const k = clamp01((a - this.bubbleAt) / 220);
    const grow = 0.6 + 0.4 * (1 - (1 - k) * (1 - k));
    const cx = Math.round(this.hero.x + 1);
    const cy = Math.round(s.ground - 19);
    const rx = Math.round(17 * grow);
    const ry = Math.round(22 * grow);
    g.fillStyle(0x4ac8f0, 0.12 + 0.05 * pulse(a, 900));
    g.fillEllipse(cx, cy, rx * 2, ry * 2);
    // the shell's rim: a solid ring, lit on the top left, deeper on the bottom right
    const rim = 0.6 + 0.25 * pulse(a, 700);
    for (let i = 0; i < 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      const lit = Math.cos(t - 3.9) > 0.3;
      g.fillStyle(lit ? 0xd8fcff : 0x6ad8f0, rim);
      g.fillRect(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1);
    }
    // a glint running round the rim, and a highlight on the top left
    const ang = a / 300;
    g.fillStyle(WHITE, 0.9);
    g.fillRect(Math.round(cx + Math.cos(ang) * rx), Math.round(cy + Math.sin(ang) * ry), 2, 1);
    g.fillStyle(WHITE, 0.55);
    g.fillRect(cx - rx + 4, cy - ry + 6, 2, 3);
    g.fillRect(cx - rx + 6, cy - ry + 4, 3, 2);
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
      fx.glow(v.x, cy, boss ? 44 : 28, 0xfff0c0, boss ? 420 : 300, s.ground);
      fx.dust(v.x, s.ground, boss ? 14 : 8, 0, boss ? 1.6 : 1.1);
      fx.rubble(v.x, s.ground, boss ? 14 : 6, boss ? 1.3 : 0.9);
      fx.shock(v.x, s.ground, boss ? 70 : 42);
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
      fx.kick(5, 140);
      s.later(140, () => s.app.audio.kill());
    });
  }

  /**
   * A companion attacks (its act frame: a flier swoops, a walker dashes in; Sunny breathes on every foe): the number
   * and a burst on the target (Sunny's breath: a wall of fire sweeps across every foe, each struck as it reaches it:
   * view/onsite.ts).
   */
  petAttack(pet: string, enemyId: number, damage: number, crit = false): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v) return;
    const def = COMPANIONS[pet as CompanionId];
    const all = !!def?.allFoes;
    // (Nimbus sprays water, not fire)
    const wet = def?.id === 'nimbus';
    const strikeOne = (u: EnemyView, fire: boolean) => {
      const cy = u.y - u.img.displayHeight / 2;
      u.flashUntil = s.anim + 50;
      u.knockUntil = s.anim + 60;
      s.fx.floatNum(u.x + rand(-4, 4), u.y - u.img.displayHeight - 8, whole(damage), crit ? 0xffb020 : wet ? 0x9af0ff : fire ? 0xffc060 : 0x6aff5a, crit ? 2 : 1);
      s.fx.burst(u.x - 6, cy, wet ? 0x6ae8e8 : fire ? 0xff8a2a : crit ? 0xffe070 : 0xb8e4ff, crit ? 14 : 8, true, 1, true);
      if (crit) s.fx.stars.push({ x: u.x - 4, y: cy, at: s.anim, r: 16, color: 0xfff07a });
    };
    const views = all ? [...this.enemies.values()].filter((u) => !u.dieAt) : [];
    const foes = all ? views.map((u) => ({ x: u.x, y: u.y - u.img.displayHeight / 2 })) : null;
    if (all && wet) s.onsite.p6.spraySweep(views, (u) => strikeOne(u, true));
    else if (all) s.onsite.fireSweep(views, (u) => strikeOne(u, true));
    this.party.attack((def?.id ?? 'pip') as CompanionId, { x: v.homeX, y: v.y, w: v.img.displayWidth, h: v.img.displayHeight, fly: v.fly }, foes, () => {
      if (!all) strikeOne(v, false);
      s.app.audio.pet();
    });
  }

  /** A foe is stunned (Wind-Up): stars circle its head for `sec`. */
  stun(enemyId: number, sec: number): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v || v.dieAt) return;
    v.stunUntil = s.anim + sec * 1000;
    s.fx.ring(v.x, v.y - v.img.displayHeight, 12, 0xffe680, true);
    s.fx.addFloater(v.homeX, Math.max(38, v.y - v.img.displayHeight - 12), 'Stunned!', 0xffe680, 1, true, 0, -10, 0, 700, true);
  }

  /** An enemy winds up its special: the 'tell' pose, a countdown ring, a "!" and the special's name. */
  telegraph(enemyId: number, name: string, sec: number): void {
    const s = this.s;
    const v = this.enemies.get(enemyId);
    if (!v || v.dieAt) return;
    v.tellAt = s.anim;
    v.tellUntil = s.anim + sec * 1000;
    // (over a huge foe's head it would sit under the HUD's plates: it stays below them)
    s.fx.addFloater(v.homeX, Math.max(38, v.y - v.img.displayHeight - 16), name, 0xff9a3a, 1, true, 0, -6, 0, sec * 1000 + 250, true);
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
    if (!v.fly) this.s.fx.dust(v.x + v.img.displayWidth * 0.3, v.y, 3, 1, 0.8); // it kicks off toward Rowan
  }

  // ------------------------------------------------------------------ per frame

  /** The party every frame: the companions (Pip joins in Act 1's opening scene, not before) and the allies. */
  updatePip(): void {
    const s = this.s;
    const beforePip = s.app.storyId === 'intro';
    const visible = s.app.tuning.companion.everyHits > 0 && !beforePip && !this.showcase;
    this.party.update(
      this.h.x,
      visible,
      () => this.makeRim(),
      (src, rim) => this.syncRim(src, rim),
    );
  }

  updateHero(): void {
    const s = this.s;
    const h = this.h;
    const a = s.anim;
    let yOff = 0;
    let sm: HeroMotion | null = null;
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
      // the finisher show moves the hero (view/finishers.ts: their style's way in, their signature's own moves)
      const k = clamp01((a - h.t0) / this.superMs);
      sm = this.show.motion(a, s.heroHome);
      if (sm) {
        h.x = sm.x;
        yOff = -sm.lift;
      }
      if (k >= 1) {
        h.state = 'idle';
        h.x = s.heroHome;
        yOff = 0;
        sm = null;
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
    if (h.down) pose = 'down';
    else if (a < h.hurtUntil) pose = 'hurt';
    else if (sm) {
      pose = sm.pose === 'cast' && !this.hasPose('cast') ? 'windup' : sm.pose;
      flip = sm.flip;
    } else if (h.state === 'leap') pose = a - h.t0 < LEAP_MS * 0.7 ? 'leap' : 'slashA';
    else if (a < h.poseUntil) pose = h.pose;
    else if (h.state === 'dash') pose = 'dash';
    else if (h.state === 'return') {
      pose = 'dash';
      flip = true;
    } else if (h.state === 'engaged') pose = 'windup';
    else pose = this.idlePose(a);
    const knock = a < h.hurtUntil ? -4 : 0;
    if (knock && h.hurtUntil !== this.hurtSeen) {
      // knocked back a step: his heels scuff the dust
      this.hurtSeen = h.hurtUntil;
      this.hurtAt = a;
      s.fx.dust(h.x - 4, s.ground, 3, -1, 0.8);
    }
    // a landing (a show's leap coming down): squash on the touch-down
    if (this.lastLift > 3 && yOff > -1) this.landAt = a;
    this.lastLift = -yOff;
    h.y = yOff;
    // (a show can hide the hero: a tornado, a shadow stands in for them) or fade them (into the shadows)
    const hidden = !!sm && sm.hidden;
    this.showHidden = hidden;
    this.hero.setVisible(!hidden && !this.showcase);
    this.hero.setAlpha(sm ? sm.alpha : 1);
    this.hero.setTexture(this.heroTex(pose));
    this.hero.setFlipX(flip);
    this.hero.setOrigin((flip ? HERO_W - HERO_FEET_X : HERO_FEET_X) / HERO_W, 1);
    // a small forward lunge on every slash
    const lk = (a - h.lungeAt) / 90;
    const lunge = lk >= 0 && lk < 1 ? Math.round(4 * Math.sin(lk * Math.PI)) : 0;
    this.hero.setPosition(Math.round(h.x + knock + lunge), Math.round(s.ground + yOff));
    const st = this.squash(a, !!sm);
    this.hero.setScale(SPRITE_SCALE * st, SPRITE_SCALE / st);
    // afterimages while dashing, returning or leaping
    const moving = (h.state === 'dash' || h.state === 'return' || h.state === 'leap' || (h.state === 'super' && !hidden)) && this.hero.visible;
    const last = this.ghostTrail[this.ghostTrail.length - 1];
    if (moving && (!last || a - last.at > 22)) {
      this.ghostTrail.push({ x: this.hero.x, y: this.hero.y, tex: this.heroTex(pose), flip, at: a });
      if (this.ghostTrail.length > 3) this.ghostTrail.shift();
    }
    this.ghosts.forEach((gh, i) => {
      const tr = this.ghostTrail[this.ghostTrail.length - 1 - i];
      const age = tr ? a - tr.at : 1e9;
      if (!tr || age > 140) return void gh.setVisible(false);
      gh.setTexture(tr.tex).setFlipX(tr.flip).setOrigin(this.hero.originX, 1).setPosition(tr.x, tr.y);
      // (in a finisher show they take its style's colour)
      const tint = h.state === 'super' ? this.show.look.ghost : i === 0 ? 0xbfe8ff : 0x6ab4ff;
      gh.setTint(tint).setAlpha((0.5 - i * 0.14) * (1 - age / 140) * (sm ? sm.alpha : 1)).setVisible(true);
    });
    const flashing = a < h.flashUntil;
    if (flashing) this.hero.setTint(h.flashColor).setTintMode(Phaser.TintModes.FILL);
    else this.hero.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    this.syncRim(this.hero, this.heroRim, !flashing);
  }

  clearShadows(): void {
    this.gShadow.clear();
  }

  /** The idle: four frames at IDLE_STEP_MS (the breath, the plume, cape, hair or weapon settling a frame behind) when
   *  the hero has them, else the two-frame breath. */
  private idlePose(a: number): string {
    if (this.hasPose('idle2') && this.hasPose('idle3')) return `idle${Math.floor(a / IDLE_STEP_MS) % 4}`;
    return Math.floor(a / 420) % 2 ? 'idle1' : 'idle0';
  }

  /**
   * Squash and stretch (docs/art-style.md section 7: at most 100 ms, volume kept): the hero's width factor (the height
   * is its inverse). A cut stretches him forward, a blow taken squashes him, a landing squashes him wide.
   */
  private squash(a: number, inShow: boolean): number {
    const bump = (t0: number, ms: number) => {
      const k = (a - t0) / ms;
      return k >= 0 && k < 1 ? Math.sin(k * Math.PI) : 0;
    };
    const land = bump(this.landAt, SQUASH_MS);
    if (inShow) return 1 + 0.14 * land;
    return 1 + 0.14 * land + 0.08 * bump(this.h.lungeAt, 90) + 0.1 * bump(this.hurtAt, SQUASH_MS);
  }

  /**
   * A soft contact shadow on the ground under a fighter: layered ellipses, darkest at the core, cast away from the
   * act's light (offset and stretched). `lift`: how high above the ground it is (the shadow shrinks and fades).
   */
  private shadow(x: number, feetY: number, w: number, lift = 0, alpha = 1): void {
    const L = STAGE_LIGHT[this.s.app.run.theme];
    const sh = this.gShadow;
    const k = clamp01(1 - lift / 50);
    const sw = Math.max(4, w * (0.5 + 0.5 * k) * L.shadowLen);
    const a = alpha * (0.3 + 0.7 * k);
    const cx = Math.round(x + L.shadowDx * (0.5 + 0.5 * k));
    const y = Math.round(feetY) - 1;
    sh.fillStyle(L.shadow, 0.2 * a);
    sh.fillEllipse(cx, y, Math.round(sw + 10), 6);
    sh.fillStyle(L.shadow, 0.28 * a);
    sh.fillEllipse(cx, y, Math.round(sw + 3), 4);
    sh.fillStyle(L.shadow, 0.4 * a);
    sh.fillEllipse(cx - 1, y, Math.round(sw * 0.66), 3);
  }

  /** Ground shadows, the Keen Edge sparkle, and every enemy (walk-in, lunge, knockback, squash, death charge, HP bars). */
  drawActors(g: G, now: number): void {
    const s = this.s;
    const run = s.app.run;
    const c = run.combat;
    // Rowan (hidden while he whirls: the tornado stands on the ground instead), and Pip's small, faint shadow below him
    const spin = this.showHidden && this.h.state === 'super';
    if (!this.showcase) this.shadow(this.h.x + 1, s.ground, spin ? 26 : 15, -this.h.y, spin ? 0.8 : 1);
    this.party.shadows((x, y, w, lift, alpha) => this.shadow(x, y, w, lift, alpha));
    if (run.hero.abilityTimer > 0 && Math.floor(now / 90) % 2 === 0) {
      g.fillStyle(0x9af0a0, 1);
      for (let i = 0; i < 2; i++) g.fillRect(Math.round(this.h.x + rand(-11, 11)), Math.round(s.ground - rand(3, 30)), 1, 2);
    }
    this.drawGear(g, now, c);
    this.drawBubble(g, c);
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
      const wave = this.waveIn.get(v.id);
      if (v.enterAt) {
        const k = (a - v.enterAt) / (wave !== undefined ? WAVE_IN_MS : v.enterFrom < GAME_W ? 260 : ENTER_MS);
        if (k >= 1) {
          v.enterAt = 0;
          if (wave === false) {
            // a wave lands: a puff of dust (and a soft thump of air under a flier)
            this.waveIn.delete(v.id);
            s.fx.dust(x, v.y + v.fly, v.fly ? 4 : 7, 0, v.fly ? 0.8 : 1.1);
            if (!v.fly) s.fx.shock(x, s.ground, 16, 0xe8dcc0);
          }
        } else if (wave !== undefined) {
          const q = clamp01(k);
          if (v.fly) {
            // fliers drop in from above the stage, swinging in from the right a little
            x = v.homeX + (1 - ease(q)) * 36;
            walkBob = Math.round((1 - ease(q)) * (v.y + 30));
          } else {
            // walkers come in from off-screen right in three quick hops
            x = v.enterFrom + (v.homeX - v.enterFrom) * ease(q);
            walkBob = Math.round(Math.abs(Math.sin(q * Math.PI * 3)) * 6 * (1 - q * 0.4));
          }
        } else {
          x = v.enterFrom + (v.homeX - v.enterFrom) * ease(clamp01(k));
          walkBob = v.enterFrom < GAME_W ? Math.round(Math.sin(clamp01(k) * Math.PI) * 8) : Math.floor(a / 90) % 2;
        }
      }
      const rim = this.enemyRims.get(v.id);
      if (v.popAt) {
        // split apart: a quick white swell, then gone
        const q = (a - v.popAt) / 160;
        rim?.setVisible(false);
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
          rim?.setVisible(false);
          continue;
        }
        const fx = x + (GAME_W + 40 - x) * q * q;
        v.img.setTexture(`${v.sprite}_${Math.floor(a / 80) % 2 ? 'idle0' : 'attack'}`).setFlipX(true).setScale(SPRITE_SCALE).setPosition(Math.round(fx), v.y - (Math.floor(a / 70) % 2)).setAlpha(1);
        rim?.setVisible(false);
        if (!v.fly) this.shadow(fx, v.y, v.img.displayWidth * 0.8);
        if (Math.random() < 0.25) s.fx.dust(fx - 4, s.ground, 1, -1, 0.6);
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
      // a boss's phase look (glacia2_*, glacia3_*) when it has one
      const phased = e.phase > 1 && s.textures.exists(`${v.sprite}${e.phase}_idle0`);
      const look = phased ? `${v.sprite}${e.phase}` : v.sprite;
      const has = (p: string) => s.textures.exists(`${look}_${p}`);
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
          rim?.setVisible(false);
          continue;
        }
        const flick = Math.floor((a - v.dieAt) / 35) % 2 === 0;
        v.img.setTexture(`${look}_${flick ? 'flash' : 'hurt'}`).setAlpha(1).setVisible(true);
        v.img.setScale(SPRITE_SCALE * (1 + 0.2 * q), SPRITE_SCALE * (1 + 0.14 * q));
        v.img.setPosition(Math.round(x + rand(-1.5, 1.5)), v.y);
        this.syncRim(v.img, rim);
        this.shadow(x, v.y + v.fly, v.img.displayWidth * (v.fly ? 0.5 : 0.8), v.fly);
        continue;
      }
      // squash on impact: wide and short for a few frames, then a little stretch back
      const sq = (a - v.kickAt) / 150;
      const amt = sq >= 0 && sq < 1 ? Math.sin(sq * Math.PI) * (sq < 0.5 ? 0.16 : -0.06) * Math.min(1.6, v.kickDist / 8) : 0;
      const hover = v.fly ? Math.round(Math.sin((a + v.phase) / 260) * 2) : 0;
      const tellK = a < v.tellUntil ? (a - v.tellAt) / Math.max(1, v.tellUntil - v.tellAt) : -1;
      const tremble = tellK > 0.6 ? Math.round(Math.sin(a / 18)) : 0; // shakes as the special is about to land
      v.img.setTexture(`${look}_${pose}`).setFlipX(false).setPosition(Math.round(x) + tremble, v.y - walkBob + hover).setScale(SPRITE_SCALE * (1 + amt), SPRITE_SCALE * (1 - amt)).setAlpha(1);
      // the boss enraged: a red pulse (unless its phase has a look of its own)
      if (e.phase >= 3 && !phased) v.img.setTint(Math.floor(a / 160) % 2 ? 0xffb0a0 : 0xffffff);
      else v.img.clearTint();
      this.syncRim(v.img, rim, !flash);
      this.shadow(x, v.y + v.fly, v.img.displayWidth * (v.fly ? 0.5 : 0.8), v.fly + walkBob - hover);
      const cy = v.y - v.img.displayHeight / 2;
      if (tellK >= 0) {
        // the countdown: a ring closing in on the enemy, and a bouncing "!"
        const r = Math.round(8 + (1 - tellK) * 18 + v.img.displayWidth * 0.3);
        // (a huge foe's ring flattens so it never climbs into the HUD at the top)
        const ry = Math.min(r * 0.7, Math.max(8, cy - 36));
        const col = Math.floor(a / 90) % 2 ? 0xff5a3a : 0xffd23a;
        g.fillStyle(col, 0.35 + 0.5 * tellK);
        const n = Math.max(16, r * 2);
        for (let i = 0; i < n; i++) {
          if (i % 3 === 2) continue;
          const ang = (i / n) * Math.PI * 2 + a / 400;
          g.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * ry), 2, 1);
        }
        const ex = Math.round(x);
        const ey = Math.max(30, Math.round(v.y - v.img.displayHeight - 8 - Math.abs(Math.sin(a / 110)) * 3));
        g.fillStyle(INK, 1);
        g.fillRect(ex - 2, ey - 1, 5, 8);
        g.fillRect(ex - 2, ey + 8, 5, 4);
        g.fillStyle(col, 1);
        g.fillRect(ex - 1, ey, 3, 6);
        g.fillRect(ex - 1, ey + 9, 3, 2);
      }
      if (a < v.stunUntil) {
        // stunned: three stars circling over its head
        const hy = Math.max(32, v.y - v.img.displayHeight - 3);
        for (let i = 0; i < 3; i++) {
          const ang = a / 180 + (i / 3) * Math.PI * 2;
          const sx = Math.round(x + Math.cos(ang) * 9);
          const sy = Math.round(hy + Math.sin(ang) * 2);
          g.fillStyle(INK, 1);
          g.fillRect(sx - 2, sy - 1, 5, 3);
          g.fillRect(sx - 1, sy - 2, 3, 5);
          g.fillStyle(Math.sin(ang) > 0 ? 0xfff0a0 : 0xd8901c, 1);
          g.fillRect(sx - 1, sy, 3, 1);
          g.fillRect(sx, sy - 1, 1, 3);
        }
      }
      // (burning, Newt's Ember Bite: its flames are view/onsite.ts drawBurns)
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
   * Rowan's gear, every frame: a Legendary or Mythic piece's aura (light pooled at his feet, a soft glow, motes
   * rising; a Mythic's flicker like embers), the Tusk Crown's golden glow while its crit buff lasts, and his blade's
   * glint in his weapon's rarity colour (now and then at rest, and on every slash).
   */
  private drawGear(g: G, now: number, c: Combat | null): void {
    const s = this.s;
    const ga = this.gAura;
    ga.clear();
    const hero = this.hero;
    const glow = this.heroGlow;
    glow.setVisible(false);
    if (!hero.visible || this.showcase) return;
    const hx = Math.round(hero.x);
    const gy = s.ground;
    const aura = this.auraLook();
    const tusk = c && c.tuskTimer > 0 ? c.tuskTimer : 0;
    // the glowing silhouette: gold while the Tusk Crown's buff lasts, else the rarest piece's colour, breathing
    if ((tusk > 0 || aura) && hero.alpha > 0) {
      const fade = tusk > 0 && tusk < 1 ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1;
      const col = tusk > 0 ? 0xffd23a : aura!.face[1];
      const a = tusk > 0 ? (0.5 + 0.3 * pulse(now, 500)) * fade : (0.22 + 0.14 * pulse(now, aura!.r >= 5 ? 900 : 1600)) * (aura!.r >= 5 ? 0.8 + 0.2 * Math.random() : 1);
      glow
        .setTexture(hero.texture.key)
        .setFlipX(hero.flipX)
        .setOrigin(hero.originX, 1)
        .setPosition(hero.x, hero.y + 1)
        .setScale(1.14, 1.07)
        .setTint(col)
        .setAlpha(a)
        .setVisible(true);
    }
    if (aura) {
      const [hi, base] = aura.face;
      const mythic = aura.r >= 5;
      const p = pulse(now, mythic ? 900 : 1400) * (mythic ? 0.7 + 0.3 * Math.random() : 1);
      ga.fillStyle(base, 0.1 + 0.06 * p);
      ga.fillEllipse(hx, gy - 1, 36, 6);
      ga.fillStyle(hi, 0.08 + 0.05 * p);
      ga.fillEllipse(hx, gy - 1, 20, 4);
      ga.fillStyle(base, 0.05 + 0.04 * p);
      ga.fillEllipse(hx + 1, gy - 15, 30, 38);
      // motes rising around him
      const every = mythic ? 70 : 120;
      if (now - this.auraMoteAt > every) {
        this.auraMoteAt = now;
        const ember = mythic && Math.random() < 0.5;
        s.fx.particles.push({
          x: hx + rand(-10, 10),
          y: gy - rand(0, 26),
          vx: ember ? rand(-8, 8) : rand(-3, 3),
          vy: ember ? rand(-40, -24) : rand(-26, -14),
          g: 0,
          born: now,
          life: rand(500, 900),
          color: Math.random() < 0.3 ? WHITE : Math.random() < 0.5 ? hi : base,
          size: 1,
          world: true,
          streak: false,
          shape: ember ? 'chip' : Math.random() < 0.4 ? 'spark' : 'chip',
        });
      }
    }
    // the Tusk Crown's crit buff: a golden glow and a ring of sparks turning around him (it flickers as it runs out)
    if (tusk > 0) {
      const fade = tusk < 1 ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1;
      const p = pulse(now, 500);
      ga.fillStyle(0xffd23a, (0.08 + 0.06 * p) * fade);
      ga.fillEllipse(hx + 1, gy - 15, 34, 42);
      ga.fillStyle(0xfff0a0, (0.06 + 0.05 * p) * fade);
      ga.fillEllipse(hx + 1, gy - 15, 22, 30);
      ga.fillStyle(0xffd23a, 0.16 * fade);
      ga.fillEllipse(hx, gy - 1, 40, 6);
      const n = 10;
      for (let i = 0; i < n; i++) {
        const ang = now / 260 + (i / n) * Math.PI * 2;
        const front = Math.sin(ang) > 0;
        const x = Math.round(hx + Math.cos(ang) * 15);
        const y = Math.round(gy - 13 + Math.sin(ang) * 4);
        g.fillStyle(front ? 0xfff0a0 : 0xd8901c, (front ? 1 : 0.6) * fade);
        g.fillRect(x, y, front ? 2 : 1, 1);
      }
      if (Math.random() < 0.35 * fade) s.fx.particles.push({ x: hx + rand(-12, 12), y: gy - rand(4, 30), vx: 0, vy: rand(-30, -16), g: 0, born: now, life: rand(300, 600), color: Math.random() < 0.5 ? 0xffe680 : WHITE, size: 1, world: true, streak: false, shape: 'spark' });
    }
    // the blade's glint, in the weapon's rarity colour
    const wl = this.weaponLook();
    const tip = hero.texture.key.startsWith('hero_') ? ROWAN_SWORD_TIP[hero.texture.key.slice(5)] : undefined;
    if (wl && tip && !hero.flipX) {
      const a = s.anim;
      const period = 2600 - wl.r * 260;
      const sk = (a - this.glintAt) / 200;
      const k = sk >= 0 && sk < 1 ? sk : (a % period) < 320 ? (a % period) / 320 : -1;
      if (k >= 0) {
        const big = sk >= 0 && sk < 1;
        const size = Math.round((k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65) * (big ? 4 : 2 + (wl.r >= 4 ? 1 : 0)));
        const x = Math.round(hero.x + tip[0]);
        const y = Math.round(hero.y + tip[1]);
        if (size > 0) {
          g.fillStyle(INK, 0.5);
          g.fillRect(x - size - 1, y - 1, size * 2 + 3, 3);
          g.fillRect(x - 1, y - size - 1, 3, size * 2 + 3);
          g.fillStyle(wl.face[0], 1);
          g.fillRect(x - size, y, size * 2 + 1, 1);
          g.fillRect(x, y - size, 1, size * 2 + 1);
          g.fillStyle(WHITE, 1);
          g.fillRect(x, y, 1, 1);
          if (size >= 3) g.fillRect(x - 1, y - 1, 3, 3);
          ga.fillStyle(wl.face[1], 0.3);
          ga.fillCircle(x, y, size + 3);
        }
      }
    }
  }

  /**
   * The finisher show's frame: its style's sky behind the actors (it takes over the stage's sky, more fully for a rarer
   * hero), the signature moment and the marks on and round the foes, the rarity's layers (view/finishers.ts).
   */
  drawSuper(now: number): void {
    const g = this.gSuper;
    g.clear();
    this.show.draw(g, this.s.gFx, now);
  }
}
