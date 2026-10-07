// The camp (phase 'camp'): the heroes and Pip by a crackling campfire under the night sky (Rowan on his log, Sable on
// the firewood once they've joined, the heroes met since standing round the fire), the companions along, Mags the
// smith at her forge, fireflies, embers and chimney smoke. The buildings and props are tap targets with name plates:
// Bag (the tent), Forge, the Shrine (unlocked: Rare chests for gems), the chests waiting by the tent (when there are
// any), the Camp button (build mode: the upgrades and region progress) and the upgrades built so far, standing in
// the clearing as objects (art-camp-build.ts: the Companion Perch with the second companion on it, the Lucky Stone,
// the Reroll Charm on the tent, the War Table, the Map Table, the Training Dummy for Practice).
// A band along the bottom has Bag, Forge, Skills (a gold "!" when the picked hero has points to spend) and Relics (a
// red count of new ones). The top left shows the picked hero (face, name, level, XP): tapping it, or a hero by the
// fire, opens the hero select; the top right the gems, the purse and the scrap. "Back" (named for where it goes: the
// world map, the next act, a retry) leaves.
// Each opens a screen over the dimmed, still-living camp: bag.ts, forge.ts, heroes.ts (Stats from there: stats.ts),
// skills.ts, relic-log.ts, chests.ts (and the chest reveal), shrine.ts, companions.ts, upgrades.ts, progress.ts. The
// first visit to the forge plays Mags's intro scene, and the first visit after a region's first act plays a story
// hero's arrival (Sable, then Neve: run.campScene); a chest hero's arrival plays after their reveal. While the home
// sits idle, now and then (every 12-20 s) someone by the fire says a one-line quip in a small speech bubble
// (src/data/banter.ts: BANTER, and HERO_BANTER once its speakers are at the camp).
import Phaser from 'phaser';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { HEROES, HERO_IDS, type HeroId } from '../../data/heroes';
import { BANTER, HERO_BANTER, type CampSpeaker } from '../../data/banter';
import { ASH_BANTER, ASH_SCENE_ACT } from '../../data/banter-ash';
import { itemPower } from '../../core/gear';
import { CAMP_UPGRADE_IDS, type CampUpgradeId } from '../../data/meta';
import { hasCamp } from '../../core/meta';
import { equippedItems } from '../../core/profile';
import { heroOwned, petOwned } from '../../core/roster';
import type { FightScene } from '../scene';
import { CAMP_SPOTS } from '../art-camp';
import { BUILD_SPOTS, ensureCampBuildArt, PERCH_SEAT } from '../art-camp-build';
import { SHRINE_AT, SHRINE_GLOW_AT } from '../art-shrine';
import { textWidth } from '../font';
import { BagScreen } from './bag';
import { CampKit, D, GOLD_TXT, pix, pixSize } from './camp-kit';
import { bestWaiting, ChestScreen } from './chests';
import { CompanionsScreen } from './companions';
import { ForgeScreen } from './forge';
import { hasGains, takeGains } from './gains';
import { HeroesScreen } from './heroes';
import { button3d, chevron, gauge, glow, GOLD, rows } from './pixels';
import { ProgressScreen } from './progress';
import { RelicLogScreen } from './relic-log';
import { clamp01, easeBack, inRect, INK, pulse, rand, WHITE, type Rect } from './shared';
import { ShrineScreen } from './shrine';
import { SkillsScreen } from './skills';
import { StatsScreen } from './stats';
import { FACE, isPressed, notePress, RIBBON } from './ui';
import { UpgradesScreen } from './upgrades';
import { wrapText } from './items';

type G = Phaser.GameObjects.Graphics;
export type CampMode = 'home' | 'bag' | 'forge' | 'stats' | 'heroes' | 'skills' | 'relics' | 'chests' | 'shrine' | 'pets' | 'upgrades' | 'progress';
type Spot = 'bag' | 'forge' | 'skills' | 'relics' | 'shrine' | 'leave';
type PlateId = 'bag' | 'forge' | 'shrine' | 'chests' | 'dummy' | 'pet';

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

/** Where the heroes met since stand round the fire (bottom-centre, in the order they fill; `flip` faces them left,
 *  toward the fire, from its right). The picked one takes the first. */
export const HERO_SPOTS: Array<{ x: number; y: number; flip: boolean }> = [
  { x: 199, y: 115, flip: true },
  { x: 143, y: 105, flip: false },
  { x: 110, y: 104, flip: false },
];
/** Companions along (beside Pip, who always perches on the log): where they sit (the second one on the Companion
 *  Perch once it's built: BUILD_SPOTS.perch). */
export const PET_SPOTS: Array<{ x: number; y: number }> = [
  { x: 186, y: 128 },
  { x: 224, y: 128 },
];
/** The props: the chests waiting by the tent, the Training Dummy by the shrine (an upgrade: its spot). */
export const PROP_AT = { chests: { x: 62, y: 128 }, dummy: BUILD_SPOTS.dummy };

export class CampView {
  private bg: Phaser.GameObjects.Image | null = null;
  private shrineImg: Phaser.GameObjects.Image | null = null;
  private shrineGlow: Phaser.GameObjects.Image | null = null;
  readonly kit: CampKit;
  readonly bag: BagScreen;
  readonly forge: ForgeScreen;
  readonly stats: StatsScreen;
  readonly heroes: HeroesScreen;
  readonly skills: SkillsScreen;
  readonly relics: RelicLogScreen;
  readonly chests: ChestScreen;
  readonly shrine: ShrineScreen;
  readonly pets: CompanionsScreen;
  readonly upgrades: UpgradesScreen;
  readonly progress: ProgressScreen;
  mode: CampMode = 'home';
  /** Where a screen's Back goes (Stats and Skills opened from the hero select go back there; the progress opened from
   *  the world map goes back to it). */
  private backTo: CampMode | 'leave' = 'home';
  private modeAt = 0;
  /** Each story hero was on screen last frame (they appear in a puff of smoke when their scene ends). */
  private shown = new Map<HeroId, boolean>();
  private arriveAt = new Map<HeroId, number>();
  private embers: Ember[] = [];
  private puffs: Puff[] = [];
  private lastPuff = 0;
  private lastEmber = 0;
  private fireAt = -1e9;
  private pipAt = -1e9;
  private dummyAt = -1e9;
  private smithSwing = 0;
  private nextSwing = 0;
  /** Rowan's gear power when the home was last on screen: coming back with better gear makes him sparkle. */
  private power = 0;
  /** Banter by the fire: the line on screen (since `at`), when the next may come, the last few said, the last tap. */
  private banter: { line: { who: CampSpeaker; text: string }; at: number } | null = null;
  private banterNext = 0;
  private banterRecent: string[] = [];
  private idleSince = 0;
  /** Anything else on screen that should keep the camp quiet (a tip, say) registers a check here. */
  readonly banterHold: Array<() => boolean> = [];

  constructor(private readonly s: FightScene) {
    this.kit = new CampKit(s);
    this.bag = new BagScreen(this.kit);
    this.forge = new ForgeScreen(this.kit);
    this.stats = new StatsScreen(this.kit);
    this.heroes = new HeroesScreen(this.kit);
    this.skills = new SkillsScreen(this.kit);
    this.relics = new RelicLogScreen(this.kit);
    this.chests = new ChestScreen(this.kit);
    this.shrine = new ShrineScreen(this.kit);
    this.pets = new CompanionsScreen(this.kit);
    this.upgrades = new UpgradesScreen(this.kit);
    this.progress = new ProgressScreen(this.kit);
  }

  build(): void {
    this.bg?.destroy();
    this.shrineImg?.destroy();
    this.shrineGlow?.destroy();
    this.bg = this.s.add.image(0, 0, 'camp_bg').setOrigin(0, 0).setDepth(D.bg).setVisible(false);
    // the shrine, unlocked: drawn over the locked one painted in the backdrop, its niche breathing violet light
    this.shrineImg = this.s.textures.exists('camp_shrine_open') ? this.s.add.image(SHRINE_AT.x, SHRINE_AT.y, 'camp_shrine_open').setOrigin(0, 0).setDepth(D.bg + 0.0005).setVisible(false) : null;
    this.shrineGlow = this.s.textures.exists('camp_shrine_glow') ? this.s.add.image(SHRINE_GLOW_AT.x, SHRINE_GLOW_AT.y, 'camp_shrine_glow').setDepth(D.bg + 0.001).setBlendMode(Phaser.BlendModes.ADD).setVisible(false) : null;
    this.kit.build();
    this.chests.build();
  }

  onPhase(next: string): void {
    if (next !== 'camp') return;
    ensureCampBuildArt(this.s);
    const now = performance.now();
    this.mode = 'home';
    this.backTo = 'home';
    this.modeAt = now;
    this.kit.syncPurse();
    this.kit.fx.clear();
    this.kit.toastNow = null;
    this.nextSwing = now + 1500;
    this.power = this.gearPower();
    this.banter = null;
    this.banterNext = now + rand(9000, 14000);
    this.idleSince = now;
    // the first visit after a region's first act: a story hero joins (Sable tries to rob the camp; later the frost
    // mage thaws out). Their scene plays over the camp the way Mags's does; skipping it still counts.
    const app = this.s.app;
    const scene = app.run.campScene;
    if (scene) {
      app.run.sableJoined();
      app.saveProfile();
      app.storyBox = 0;
      app.storyOverlay = scene;
    }
    for (const id of HERO_IDS) this.shown.set(id, this.heroHere(id));
    this.arriveAt.clear();
    // back from practice: a word on how it went
    const pe = app.run.practiceEnded;
    if (pe) {
      app.run.practiceEnded = null;
      this.kit.after(350, () => this.kit.toast({ title: 'Practice done!', ribbon: RIBBON.green, lines: [], text: [{ text: pe.won ? 'The dummy is down. Again?' : 'Nice swings!', col: WHITE, bold: true }], cx: (this.s.L + this.s.R) / 2, cy: 60 }));
    }
  }

  /** The world map's region card: the camp opens straight on a region's progress, and Back goes back to the map. */
  openProgress(region: number): void {
    const app = this.s.app;
    if (app.run.phase !== 'camp') app.openCamp();
    const now = performance.now();
    this.go('progress', now);
    this.progress.open(now, region);
    this.backTo = 'leave';
  }

  // ------------------------------------------------------------------ who is here

  /** A hero is at the camp once they've joined (a story hero not while their arrival scene is still playing). */
  private heroHere(id: HeroId): boolean {
    const app = this.s.app;
    if (id === 'rowan') return true;
    if (!heroOwned(app.run.profile, id)) return false;
    return !(id === 'sable' && app.storyOverlay === 'sableJoin') && !(id === 'neve' && app.storyOverlay === 'neveJoin');
  }

  private sableHere(): boolean {
    return this.heroHere('sable');
  }

  /** The heroes met since Sable, standing round the fire: the picked one first, then in order. */
  private standing(): Array<{ id: HeroId; x: number; y: number; flip: boolean }> {
    const p = this.s.app.run.profile;
    const ids = HERO_IDS.filter((id) => id !== 'rowan' && id !== 'sable' && this.heroHere(id));
    ids.sort((a, b) => Number(b === p.hero) - Number(a === p.hero));
    return ids.slice(0, HERO_SPOTS.length).map((id, i) => ({ id, ...HERO_SPOTS[i] }));
  }

  /** Where each hero at the camp is drawn: their sprite's rect. */
  private heroRect(id: HeroId): Rect | null {
    if (id === 'rowan') return this.rowanRect();
    if (id === 'sable') return this.sableHere() ? this.sableRect() : null;
    const st = this.standing().find((h) => h.id === id);
    if (!st) return null;
    const key = `camp_${id}0`;
    const [w, h] = this.kit.has(key) ? this.kit.imgs.size(key) : [32, 38];
    // just the figure (the sprite's box has a few px of air round it)
    return { x: st.x - (w >> 1) + 6, y: st.y - h + 4, w: w - 12, h: h - 4 };
  }

  /** The companions along besides Pip (Pip always perches on the log), where they sit. */
  private petsAlong(): Array<{ id: CompanionId; x: number; y: number; perch?: boolean }> {
    const p = this.s.app.run.profile;
    const now = performance.now();
    // the second companion along sits on the Companion Perch (once it stands there)
    const perched = this.upgrades.objectAlpha('perch', now) >= 1 && p.petsOn[1] && p.petsOn[1] !== 'pip' && petOwned(p, p.petsOn[1]) ? p.petsOn[1] : null;
    const out: Array<{ id: CompanionId; x: number; y: number; perch?: boolean }> = p.petsOn
      .filter((id) => id !== 'pip' && id !== perched && petOwned(p, id))
      .slice(0, PET_SPOTS.length)
      .map((id, i) => ({ id, ...PET_SPOTS[i] }));
    if (perched) out.push({ id: perched, x: BUILD_SPOTS.perch.x, y: BUILD_SPOTS.perch.y - PERCH_SEAT, perch: true });
    return out;
  }

  private petRect(id: CompanionId): Rect | null {
    if (id === 'pip') return this.pipRect();
    const at = this.petsAlong().find((q) => q.id === id);
    if (!at) return null;
    const fly = COMPANIONS[id].flies && !at.perch;
    return { x: at.x - 11, y: at.y - (fly ? 30 : 20), w: 22, h: fly ? 22 : 20 };
  }

  /** Who can talk by the fire now. */
  private speakers(): Set<CampSpeaker> {
    const out = new Set<CampSpeaker>(['rowan', 'pip', 'smith']);
    if (this.sableHere()) out.add('sable');
    for (const h of this.standing()) out.add(h.id as CampSpeaker);
    return out;
  }

  // ------------------------------------------------------------------ layout (home)

  /** Where "Back" goes, as its label: the world map, the next act (after an act clear), or a retry. */
  private leaveLabel(): string {
    const run = this.s.app.run;
    if (run.campFrom === 'defeat') return 'Retry';
    if (run.campFrom === 'actClear') return run.actIndex + 1 < run.region.acts.length ? `Act ${run.actIndex + 2}` : 'Continue';
    if (run.campFrom === 'map') return `Act ${run.actIndex + 1} map`;
    return 'World map';
  }

  band(): Array<{ id: Spot; r: Rect; label: string; icon: string }> {
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

  /** What each plate says and where it points: the picked hero by the fire, the buildings, the props there now and
   *  the companion along. */
  private plateDefs(): Array<{ id: PlateId; label: string; icon: string; target: Rect; roof: boolean }> {
    const p = this.s.app.run.profile;
    const out: Array<{ id: PlateId; label: string; icon: string; target: Rect; roof: boolean }> = [];
    out.push({ id: 'bag', label: 'Bag', icon: 'bag', target: CAMP_SPOTS.bag, roof: true });
    out.push({ id: 'forge', label: 'Forge', icon: 'hammer', target: CAMP_SPOTS.forge, roof: true });
    out.push({ id: 'shrine', label: 'Shrine', icon: 'shrine', target: CAMP_SPOTS.shrine, roof: true });
    if (bestWaiting(p)) out.push({ id: 'chests', label: 'Chests', icon: 'chest', target: this.propRect('chests'), roof: false });
    if (hasCamp(p, 'dummy')) out.push({ id: 'dummy', label: 'Practice', icon: 'target', target: this.propRect('dummy'), roof: false });
    const pet = p.petsOn[0] ?? 'pip';
    const pr = this.petRect(pet);
    if (pr) out.push({ id: 'pet', label: COMPANIONS[pet].name, icon: 'paw', target: pr, roof: false });
    return out;
  }

  /**
   * The name plates, laid out once a frame: each centred above what it names and kept on screen. A building's plate
   * that would overlap one before it sits on its roof instead; the others slide aside (their tail still points at
   * what they name), then up, until they're clear.
   */
  private plates(): Array<{ id: PlateId; label: string; icon: string; r: Rect; tailX: number }> {
    const s = this.s;
    const out: Array<{ id: PlateId; label: string; icon: string; r: Rect; tailX: number }> = [];
    const hit = (r: Rect) => out.some((o) => r.x < o.r.x + o.r.w + 2 && o.r.x < r.x + r.w + 2 && r.y < o.r.y + o.r.h + 2 && o.r.y < r.y + r.h + 2);
    const clampX = (x: number, w: number) => Math.round(Math.max(s.L + 2, Math.min(s.R - 2 - w, x)));
    for (const d of this.plateDefs()) {
      const w = textWidth(d.label, 1, true) + pixSize(d.icon)[0] + 9;
      const h = 13;
      const b = d.target;
      const cx = b.x + b.w / 2;
      let r = { x: clampX(cx - w / 2, w), y: Math.max(24, b.y - h - (d.roof ? 6 : 4)), w, h };
      if (d.roof) {
        if (hit(r)) r = { ...r, y: b.y + 4 };
      } else if (hit(r)) {
        // aside (left, then right, as long as the tail can still reach what it names), then up
        const tries = [cx - w + 6, cx - 6].map((x) => ({ ...r, x: clampX(x, w) }));
        const free = tries.find((t) => !hit(t));
        if (free) r = free;
        else for (let i = 0; i < 4 && hit(r); i++) r = { ...r, y: r.y - h - 2 };
      }
      out.push({ id: d.id, label: d.label, icon: d.icon, r, tailX: cx });
    }
    return out;
  }

  /** The Camp button, top left beside the hero chip (the upgrades and the region progress). */
  campRect(): Rect {
    const c = this.chipRect();
    return { x: c.x + c.w + 4, y: 5, w: textWidth('Camp', 1, true) + pixSize('tent')[0] + 14, h: 15 };
  }

  /** A prop's tap area. */
  private propRect(id: 'chests' | 'dummy'): Rect {
    const at = PROP_AT[id];
    const key = id === 'chests' ? `hchest_${bestWaiting(this.s.app.run.profile) ?? 'hero'}_closed` : 'dummy_idle0';
    const [w, h] = this.kit.has(key) ? this.kit.imgs.size(key) : [24, 28];
    return { x: at.x - (w >> 1) + 2, y: at.y - h + 2, w: w - 4, h: h - 2 };
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

  /** Sable on the firewood: just their sprite (a wider pad would reach the fire's and the forge's tap areas). */
  private sableRect(): Rect {
    const [w, h] = this.kit.imgs.size('camp_sable0');
    const p = CAMP_SPOTS.sable;
    return { x: p.x - (w >> 1), y: p.y - h, w: w - 3, h };
  }

  /** The hero chip, top left: the picked hero's face, name, level and XP (tap: the hero select). */
  private chipRect(): Rect {
    const id = this.s.app.run.profile.hero;
    const tw = textWidth(HEROES[id].name, 1, true);
    return { x: this.s.L + 3, y: 3, w: 23 + Math.max(tw, 52) + 6, h: 21 };
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
    this.idleSince = now;
    if (now - this.modeAt < 180) return;
    if (this.mode !== 'home') return this.screenTap(x, y, now);
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
    for (const pl of this.plates())
      if (inRect(pl.r, x, y, 3)) {
        notePress(pl.r);
        return this.openPlate(pl.id, now);
      }
    const chip = this.chipRect();
    if (inRect(chip, x, y, 2)) {
      notePress(chip);
      return this.go('heroes', now);
    }
    const cb = this.campRect();
    if (inRect(cb, x, y, 2)) {
      notePress(cb);
      return this.go('upgrades', now);
    }
    // the companions along (Pip hops and hoots on the way)
    if (inRect(this.pipRect(), x, y)) {
      this.pipAt = now;
      app.audio.textBlip();
      const r = this.pipRect();
      this.kit.fx.float('Hoo!', r.x + r.w / 2, r.y - 6, 0x9ad8ff, { life: 900 });
      return this.go('pets', now, undefined, 'pip');
    }
    for (const q of this.petsAlong()) {
      const r = this.petRect(q.id);
      if (r && inRect(r, x, y)) return this.go('pets', now, undefined, q.id);
    }
    // the upgrades built (the perch: the companions; the dummy: practice; the others: their card in build mode)
    for (const id of CAMP_UPGRADE_IDS) {
      if (this.upgrades.objectAlpha(id, now) < 1 || !inRect(this.upgrades.objectRect(id), x, y, 1)) continue;
      if (id === 'dummy') return this.openPlate('dummy', now);
      if (id === 'perch') return this.go('pets', now);
      return this.openUpgrade(id, now);
    }
    // the heroes (front to back), then the props
    const heroes = (['rowan', 'sable', ...this.standing().map((h) => h.id)] as HeroId[]).filter((id) => this.heroRect(id)).sort((a, b) => this.heroRect(b)!.y + this.heroRect(b)!.h - (this.heroRect(a)!.y + this.heroRect(a)!.h));
    for (const id of heroes) if (inRect(this.heroRect(id)!, x, y)) return this.go('heroes', now, id);
    const p = app.run.profile;
    if (bestWaiting(p) && inRect(this.propRect('chests'), x, y)) return this.openPlate('chests', now);
    if (hasCamp(p, 'dummy') && inRect(this.propRect('dummy'), x, y)) return this.openPlate('dummy', now);
    if (inRect(this.fireRect(), x, y)) {
      this.fireAt = now;
      app.audio.swish();
      const f = CAMP_SPOTS.fire;
      for (let i = 0; i < 24; i++) this.ember(now, f.x + rand(-4, 4), f.y - rand(4, 10), rand(-30, 30), rand(-70, -35));
      return;
    }
    if (inRect(this.smithRect(), x, y)) return this.open('forge', now);
    for (const id of ['bag', 'forge', 'shrine'] as const) {
      const b = CAMP_SPOTS[id];
      if (inRect(b, x, y)) return this.open(id, now);
    }
  }

  /** A tap on the screen on view (not the home): where its Back and its other buttons lead. */
  private screenTap(x: number, y: number, now: number): void {
    const res = this.screen().tap(x, y, now);
    if (!res) return;
    if (res === 'back') {
      if (this.backTo === 'leave') {
        this.s.app.audio.uiClick();
        this.s.app.leaveCamp();
        return;
      }
      return this.go(this.backTo, now);
    }
    if (res === 'stats') return this.go('stats', now, this.heroes.view);
    if (res === 'skills') return this.go('skills', now, this.heroes.view);
    if (res === 'openRare') {
      this.go('chests', now);
      this.backTo = 'shrine';
      this.chests.openKind('rare', now);
      return;
    }
    if (res === 'practice') return this.practice(now);
    if (res === 'pets') {
      this.go('pets', now);
      this.backTo = 'upgrades';
      return;
    }
    if (res === 'progress') {
      this.go('progress', now);
      this.backTo = 'upgrades';
      return;
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
    this.go(id === 'shrine' ? 'shrine' : id, now);
  }

  private openPlate(id: PlateId, now: number): void {
    switch (id) {
      case 'bag':
      case 'forge':
      case 'shrine':
        return this.open(id, now);
      case 'chests':
        return this.go('chests', now);
      case 'dummy':
        return this.practice(now);
      case 'pet':
        return this.go('pets', now);
    }
  }

  /** The Training Dummy: a practice fight with the picked hero (no risk, no rewards), back here when it ends. */
  practice(now: number): void {
    const app = this.s.app;
    if (!hasCamp(app.run.profile, 'dummy')) return;
    this.dummyAt = now;
    app.audio.uiClick();
    app.startPractice();
  }

  /** Build mode, with upgrade `id`'s card open (a built object tapped by the fire). */
  openUpgrade(id: CampUpgradeId, now: number): void {
    this.go('upgrades', now);
    this.upgrades.select(id, now);
  }

  /** The screen on view (not the home). */
  private screen(): { tap(x: number, y: number, now: number): string | void; draw(now: number): void } {
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
      case 'chests':
        return this.chests;
      case 'shrine':
        return this.shrine;
      case 'pets':
        return this.pets;
      case 'upgrades':
        return this.upgrades;
      case 'progress':
        return this.progress;
      default:
        return this.stats;
    }
  }

  go(mode: CampMode, now: number, hero?: HeroId, pet?: CompanionId): void {
    const app = this.s.app;
    const p = app.run.profile;
    const from = this.mode;
    this.backTo = (mode === 'stats' || mode === 'skills') && from === 'heroes' ? 'heroes' : 'home';
    this.mode = mode;
    this.modeAt = now;
    this.kit.toastNow = null;
    this.banter = null;
    this.banterNext = Math.max(this.banterNext, now + 8000);
    if ((from === 'stats' || from === 'skills') && mode === 'heroes') {
      // back from a hero's stats or skills: the hero select as it was
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
    else if (mode === 'skills') this.skills.open(now, hero);
    else if (mode === 'relics') this.relics.open(now);
    else if (mode === 'chests') this.chests.open(now);
    else if (mode === 'shrine') this.shrine.open(now);
    else if (mode === 'pets') this.pets.open(now, pet);
    else if (mode === 'upgrades') this.upgrades.open(now);
    else if (mode === 'progress') this.progress.open(now);
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
      this.shrineImg?.setVisible(false);
      this.shrineGlow?.setVisible(false);
      kit.hide();
      this.chests.hide();
      return;
    }
    kit.begin(now);
    this.bg?.setVisible(true);
    this.shrineImg?.setVisible(true);
    this.shrineGlow?.setVisible(true).setAlpha(0.35 + 0.25 * pulse(now, 2200));
    this.drawScene(now);
    if (this.mode === 'home') {
      this.drawHome(now);
      this.drawBanter(now);
      this.showGains();
    } else {
      // a screen that paints its own stage (`staged`) needs no dim over the camp behind it
      const scr = this.screen();
      const k = clamp01((now - this.modeAt) / 160);
      if (!(scr as { staged?: boolean }).staged) kit.dim(kit.gUi, 0.62 * k);
      scr.draw(now);
    }
    kit.end(now);
  }

  /** What the run gave that the loot and act-clear screens didn't get to show (or a chest's achievements): a toast. */
  private showGains(): void {
    const app = this.s.app;
    const kit = this.kit;
    if (kit.toastNow || app.storyOverlay || app.tipUp || !hasGains(app.run.gains)) return;
    const lines = takeGains(app.run.gains);
    kit.toast({
      title: 'Rewards!',
      ribbon: RIBBON.purple,
      lines: [],
      text: lines.slice(0, 5).map((l) => ({ text: l.sub ? `${l.sub} ${l.text}` : l.text, col: l.col, bold: true })),
      cx: (this.s.L + this.s.R) / 2,
      cy: 62,
    });
    app.audio.rareSting(true);
  }

  private ember(now: number, x: number, y: number, vx: number, vy: number): void {
    const c = [0xffb03a, 0xffe680, 0xff6a2a, 0xfff0a0];
    this.embers.push({ x, y, vx, vy, born: now, life: rand(700, 1500), color: c[Math.floor(Math.random() * c.length)], sway: rand(0, 6) });
    if (this.embers.length > 90) this.embers.shift();
  }

  /** The living camp: fire, glow, embers, smoke, fireflies, the heroes, Pip and the companions, Mags, the props. */
  private drawScene(now: number): void {
    const kit = this.kit;
    const gb = kit.gBack;
    const gf = kit.gFront;
    const im = kit.imgs;
    const S = CAMP_SPOTS;
    const p = this.s.app.run.profile;
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
    for (const pf of this.puffs) {
      const k = (now - pf.born) / pf.life;
      if (k >= 1) continue;
      const x = pf.x + k * pf.drift * 4 + Math.sin(now / 600 + pf.born) * 1.5;
      const y = pf.y - k * 34;
      const r = pf.size + k * 6;
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
    // everyone and everything standing on the ground, drawn back to front (by their feet)
    const draws: Array<{ y: number; fn: () => void }> = [];
    const sitting = this.mode !== 'forge';
    draws.push({ y: S.rowan.y, fn: () => im.foot(Math.floor(now / 680) % 2 ? 'camp_rowan1' : 'camp_rowan0', S.rowan.x, S.rowan.y, D.actors) });
    // a hero appears in a puff of smoke the moment they join (a story hero when their arrival scene ends, a chest
    // hero when the camp is back on view after their reveal)
    if (this.mode === 'home')
      for (const id of HERO_IDS) {
        if (id === 'rowan') continue;
        const here = this.heroHere(id);
        if (here && this.shown.get(id) === false) this.arrives(id, now);
        this.shown.set(id, here);
      }
    if (this.sableHere()) draws.push({ y: S.sable.y, fn: () => im.foot(Math.floor((now + 340) / 720) % 2 ? 'camp_sable1' : 'camp_sable0', S.sable.x, S.sable.y, D.actors, clamp01((now - (this.arriveAt.get('sable') ?? -1e9)) / 300)) });
    this.standing().forEach((h, i) => {
      const k0 = `camp_${h.id}0`;
      if (!kit.has(k0)) return;
      const key = Math.floor((now + i * 230) / (640 + i * 40)) % 2 ? `camp_${h.id}1` : k0;
      const a = clamp01((now - (this.arriveAt.get(h.id) ?? -1e9)) / 300);
      draws.push({ y: h.y, fn: () => this.footFlip(key, h.x, h.y, h.flip, a) });
    });
    const hop = now - this.pipAt < 320 ? Math.round(Math.sin(((now - this.pipAt) / 320) * Math.PI) * 5) : 0;
    const pipF = hop || Math.floor(now / 2200) % 3 === 0 ? 'camp_pip1' : 'camp_pip0';
    draws.push({ y: S.pip.y, fn: () => im.foot(pipF, S.pip.x, S.pip.y - hop, D.actors) });
    for (const q of this.petsAlong()) {
      const def = COMPANIONS[q.id];
      const fly = def.flies;
      const per = fly ? 140 : 360;
      const key = `comp_${q.id}_idle${Math.floor(now / per) % 2}`;
      if (!kit.has(key)) continue;
      // on the perch: it sits on the platform (a flier settles there too), drawn just after the perch
      const hover = fly && !q.perch;
      const bob = hover ? Math.round(Math.sin(now / 300 + q.x) * 2) : 0;
      draws.push({ y: q.perch ? BUILD_SPOTS.perch.y + 0.5 : q.y, fn: () => this.footFlip(key, q.x, q.y + 1 - (hover ? 8 : 0) + bob, false, 1) });
    }
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
      draws.push({ y: S.smith.y, fn: () => im.foot(smith, S.smith.x, S.smith.y, D.actors) });
    }
    // the props: the chests waiting by the tent (they wobble now and then), the notice board, the dummy
    const best = bestWaiting(p);
    if (best) {
      const at = PROP_AT.chests;
      const wob = Math.floor(now / 2600) % 3 === 0 && now % 2600 < 300 ? Math.round(Math.sin((now % 2600) / 30) * 1) : 0;
      gb.fillStyle(best === 'hero' ? 0xffd23a : best === 'rare' ? 0x4aa0f0 : 0xb06ae0, 0.1 + 0.06 * pulse(now, 1500));
      gb.fillCircle(at.x, at.y - 14, 20);
      draws.push({ y: at.y, fn: () => im.foot(`hchest_${best}_closed`, at.x + wob, at.y, D.actors) });
    }
    // the upgrades built so far, standing in the clearing (one being built rises out of its dust)
    this.drawUpgrades(draws, now);
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.fn();
    // the campfire's flames (taller when poked)
    im.foot(`camp_fire${FIRE_SEQ[Math.floor(now / 85) % FIRE_SEQ.length]}`, S.fire.x, S.fire.y, D.actors + 0.0005);
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

  /** The camp's upgrades as objects (art-camp-build.ts), queued with everything else on the ground by their feet. */
  private drawUpgrades(draws: Array<{ y: number; fn: () => void }>, now: number): void {
    const kit = this.kit;
    const im = kit.imgs;
    const gb = kit.gBack;
    for (const id of CAMP_UPGRADE_IDS) {
      const a = this.upgrades.objectAlpha(id, now);
      if (a <= 0) continue;
      const at = BUILD_SPOTS[id];
      const rise = Math.round((1 - a) * 4);
      switch (id) {
        case 'dummy': {
          if (!kit.has('dummy_idle0')) break;
          const k = now - this.dummyAt;
          const key = k < 300 ? 'dummy_hurt' : Math.floor(now / 900) % 2 ? 'dummy_idle1' : 'dummy_idle0';
          draws.push({ y: at.y, fn: () => im.foot(key, at.x, at.y + rise, D.actors, a) });
          break;
        }
        case 'perch':
          draws.push({ y: at.y, fn: () => im.foot('cb_perch', at.x, at.y + rise, D.actors, a) });
          break;
        case 'luckyStone': {
          // its clover glows and fades, a soft green light on the grass round it
          const gl = pulse(now, 2200);
          gb.fillStyle(0x8af06a, (0.05 + 0.07 * gl) * a);
          gb.fillCircle(at.x, at.y - 6, 9 + gl * 2);
          draws.push({ y: at.y, fn: () => im.foot(gl > 0.6 ? 'cb_lucky1' : 'cb_lucky0', at.x, at.y + rise, D.actors, a) });
          break;
        }
        case 'rerollCharm': {
          // it turns in the wind, now faster, now slower, and swings a little on its cord
          const spin = Math.floor((now / 210) * (0.75 + 0.25 * Math.sin(now / 1700))) % 4;
          const [w] = kit.has('cb_charm0') ? im.size('cb_charm0') : [9, 18];
          const sway = Math.round(Math.sin(now / 900) * 1);
          draws.push({ y: at.y, fn: () => kit.sprites.draw(`cb_charm${spin}`, at.x - (w >> 1) + sway, at.y - rise, D.actors, { alpha: a }) });
          break;
        }
        case 'warTable':
          draws.push({ y: at.y, fn: () => im.foot('cb_wartable', at.x, at.y + rise, D.actors, a) });
          break;
        case 'mapTable': {
          // its lantern's warm light, flickering
          const fl = 0.85 + 0.15 * Math.sin(now / 83) * Math.sin(now / 131);
          gb.fillStyle(0xffd060, 0.1 * fl * a);
          gb.fillCircle(at.x + 5, at.y - 16, 11);
          gb.fillStyle(0xffd060, 0.12 * fl * a);
          gb.fillCircle(at.x + 5, at.y - 16, 6);
          draws.push({ y: at.y, fn: () => im.foot('cb_maptable', at.x, at.y + rise, D.actors, a) });
          break;
        }
      }
    }
  }

  /** A sprite standing with its bottom centre at (x, y), facing left when `flip`. */
  private footFlip(key: string, x: number, y: number, flip: boolean, alpha: number): void {
    const [w, h] = this.kit.imgs.size(key);
    this.kit.sprites.draw(key, Math.round(x) - (w >> 1), Math.round(y) - h, D.actors, { flip, alpha });
  }

  /** A story hero shows up by the fire: a puff of smoke, a sting, "Sable joined!". */
  private arrives(id: HeroId, now: number): void {
    const kit = this.kit;
    const app = this.s.app;
    this.arriveAt.set(id, now);
    const r = this.heroRect(id);
    if (!r) return;
    const x = r.x + r.w / 2;
    const y = r.y + r.h / 2;
    const col = id === 'sable' ? 0xdab0ff : id === 'neve' ? 0x9ae8ff : 0xfff0a0;
    kit.fx.burst(x, y, [0x6a6478, 0x9a94a8, 0xd8d0f0, 0x4a4458], 34, 1.1, { kind: 'chip', g: -20, life: 800 });
    kit.fx.burst(x, y, [col, WHITE], 12, 0.9, { kind: 'star', g: 20, life: 700 });
    kit.fx.ring(x, y, 20, col, 500);
    kit.fx.float(`${HEROES[id].name} joined!`, x, r.y - 22, col, { life: 2200 });
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
    g.fillStyle(HEROES[id].style === 'shadow' ? 0x3a2458 : 0x1a2c52, 1);
    g.fillRect(fx + 1, fy + 1, 15, 15);
    kit.face(id, fx + 1, fy + 1, D.homeText - 0.001, { size: 15 });
    const L = kit.level(id);
    const name = HEROES[id].name;
    texts.text(name, c.x + 23, c.y + 7, WHITE, { bold: true, oy: 0.5 });
    // the level, and the XP bar after it
    const lv = `Lv ${L.level}`;
    const lw = textWidth(lv, 1, false);
    texts.text(lv, c.x + 23, c.y + 15.5, GOLD_TXT, { oy: 0.5 });
    gauge(g, c.x + 23 + lw + 3, c.y + 14, c.w - 23 - lw - 3 - 5, 3, L.need ? L.into / L.need : 1, 0, { ramp: [0xe0f6ff, 0x4aa0f0, 0x2a6ad8, 0x1a3c8a] });
  }

  /** The home's UI: the hero chip, gems, purse and scrap, the name plates, the band of buttons. */
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
    // top right: the gems, the purse and the scrap
    const pr = kit.purse(g, texts, s.R - 3, ty + 1, now, true);
    kit.gemsTag(g, texts, pr.coins.x - 3, ty + 1, now);

    // the Camp button beside the chip
    const cb = this.campRect();
    kit.button(g, texts, { ...cb, y: cb.y + ty - 3 }, 'Camp', FACE.green, now, { icon: 'tent', glowCol: this.upgrades.canBuild() ? 0xffd23a : undefined });
    if (this.upgrades.canBuild()) kit.bubble(g, texts, cb.x + cb.w - 1, cb.y + ty - 6, '!', now, true);
    // name plates over the buildings, the props and the companion along (they bob)
    const fresh = p.items.filter((i) => i.fresh).length;
    const waiting = p.chests.hero + p.chests.rare + p.chests.region;
    const cost = Math.round(s.app.run.tuning.chests.rareCost);
    this.plates().forEach((pl, i) => {
      const k = easeBack((since - 120 - i * 60) / 260, 1.8);
      if (k <= 0) return;
      const bob = Math.round(Math.sin(now / 520 + i * 1.3) * 1);
      const r = { ...pl.r, y: pl.r.y + bob - Math.round((1 - k) * 8) };
      // a chest waiting, or gems enough for one at the shrine: the plate glows
      const hot = (pl.id === 'chests' && waiting > 0) || (pl.id === 'shrine' && p.gems >= cost);
      if (hot) glow(g, r, pl.id === 'chests' ? 0xffd23a : 0xd070ff, 0.25 + 0.3 * pulse(now, 1000, i * 200), 2);
      this.glass(g, r.x, r.y, r.w, r.h, clamp01(k * 2), true, pl.tailX);
      const [iw, ih] = pixSize(pl.icon);
      pix(g, pl.icon, r.x + 3, r.y + Math.round((r.h - ih) / 2));
      texts.text(pl.label, r.x + iw + 5, r.y + r.h / 2, pl.id === 'shrine' ? 0xe8d0ff : WHITE, { bold: true, oy: 0.5 });
      if (pl.id === 'bag' && fresh > 0) kit.bubble(g, texts, r.x + r.w - 2, r.y - 3, `${fresh}`, now);
      if (pl.id === 'chests' && waiting > 0) kit.bubble(g, texts, r.x + r.w - 2, r.y - 3, `${waiting}`, now);
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
      const prs = isPressed(b.r, now) ? 2 : 0;
      if (b.id === 'leave') {
        glow(g, r, 0x8af06a, 0.3 + 0.3 * pulse(now, 1000), 3);
        button3d(g, r, FACE.green, prs > 0);
        texts.text(b.label, r.x + 6, r.y + r.h / 2 + prs, WHITE, { bold: true, oy: 0.5 });
        chevron(g, r.x + r.w - 8, r.y + 4 + prs, 7, WHITE, 1, 1, true);
        continue;
      }
      // Skills: a gold "!" (and a glow) when the picked hero has points to spend; Relics: how many are new
      const points = b.id === 'skills' && kit.level(p.hero).points > 0;
      if (points) glow(g, r, 0xffd23a, 0.3 + 0.35 * pulse(now, 900), 3);
      button3d(g, r, b.id === 'forge' ? FACE.wood : b.id === 'skills' ? FACE.purple : b.id === 'relics' ? FACE.red : FACE.blue, prs > 0);
      const [iw, ih] = pixSize(b.icon);
      pix(g, b.icon, r.x + 4, r.y + Math.round((r.h - ih) / 2) + prs - 1);
      texts.text(b.label, r.x + iw + 6, r.y + r.h / 2 + prs, WHITE, { bold: true, oy: 0.5 });
      if (b.id === 'bag' && fresh > 0) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, `${fresh}`, now);
      if (points) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, '!', now, true);
      if (b.id === 'relics' && p.relicsNew.length) kit.bubble(g, texts, r.x + r.w - 1, r.y - 3, `${p.relicsNew.length}`, now);
    }
  }

  // ------------------------------------------------------------------ banter by the fire

  /** The lines that can be said now: the camp's own (Sable's once they're here) and the new heroes' once their
   *  speakers (and whoever the line is to) are at the camp. */
  private banterLines(): Array<{ who: CampSpeaker; text: string }> {
    const here = this.speakers();
    const sable = here.has('sable');
    const base = BANTER.filter((l) => (l.who !== 'sable' && !l.sable) || sable);
    const more = HERO_BANTER.filter((l) => here.has(l.who) && (l.with ?? []).every((w) => here.has(w)));
    // the third region's lines wait for the story to reach their scene (they'd spoil it)
    const p = this.s.app.run.profile;
    const ash = ASH_BANTER.filter((l) => here.has(l.who) && (p.seen.includes(l.after) || p.actsCleared >= (ASH_SCENE_ACT[l.after] ?? 99)));
    return [...base, ...more, ...ash];
  }

  /** Where a speaker's bubble points: the top of their name plate or their head. */
  private banterAnchor(who: CampSpeaker): { x: number; y: number } {
    if (who === 'pip') {
      const r = this.pipRect();
      return { x: r.x + r.w / 2, y: r.y + 2 };
    }
    if (who === 'smith') {
      const r = this.smithRect();
      return { x: r.x + r.w / 2 - 2, y: r.y + 6 };
    }
    const r = this.heroRect(who as HeroId) ?? this.rowanRect();
    return { x: r.x + r.w / 2, y: r.y + 1 };
  }

  /**
   * Every 12-20 s while the camp home sits idle (no tap for a few seconds, no story scene, no toast, nothing holding
   * it), someone by the fire says a line: a cream speech bubble with a tail, over the speaker; it pops in, stays 3 s
   * and fades. Never the same line twice in a row of five.
   */
  private drawBanter(now: number): void {
    const app = this.s.app;
    // quiet during a story scene, a toast, a tip card, or right after a screen change
    const quiet = !!app.storyOverlay || app.tipUp || !!this.kit.toastNow || now - this.modeAt < 1200 || this.banterHold.some((f) => f());
    if (quiet) {
      this.banter = null;
      this.banterNext = Math.max(this.banterNext, now + 4000);
      return;
    }
    if (!this.banter && now >= this.banterNext && now - this.idleSince > 2500) {
      const pool = this.banterLines().filter((l) => !this.banterRecent.includes(l.text));
      const line = pool[Math.floor(Math.random() * pool.length)];
      if (line) {
        this.banter = { line, at: now };
        this.banterRecent = [...this.banterRecent, line.text].slice(-5);
        app.audio.textBlip();
      }
    }
    const b = this.banter;
    if (!b) return;
    const age = now - b.at;
    const LIFE = 3000;
    if (age > LIFE) {
      this.banter = null;
      this.banterNext = now + rand(12000, 20000);
      return;
    }
    const s = this.s;
    const g = this.kit.gTop;
    const texts = this.kit.topTexts;
    const a = Math.min(1, age / 140) * (1 - clamp01((age - (LIFE - 260)) / 260));
    const pop = easeBack(age / 220, 2);
    const lines = wrapText(b.line.text, 104);
    const w = Math.max(...lines.map((l) => textWidth(l, 1, false))) + 10;
    const h = lines.length * 8 + 6;
    const anc = this.banterAnchor(b.line.who);
    // the bubble sits above the speaker and above any name plate under it (never over one), leaning left for Pip;
    // its tail tapers down to the speaker
    const lean = b.line.who === 'pip' ? -0.75 : 0;
    const x = Math.round(Math.max(s.L + 3, Math.min(s.R - 3 - w, anc.x - w / 2 + lean * w * 0.5)));
    let base = anc.y - 4;
    for (const pl of this.plates()) if (pl.r.y < anc.y && pl.r.y + pl.r.h > base - h - 2 && pl.r.x < x + w + 2 && x < pl.r.x + pl.r.w + 2) base = Math.min(base, pl.r.y - 5);
    const y = Math.round(Math.max(27, base - h) + (1 - pop) * 3);
    const tx = Math.round(Math.max(x + 6, Math.min(x + w - 7, anc.x + (b.line.who === 'pip' ? -8 : 0))));
    // the tail: from the bubble's bottom edge (5 px wide) to a point by the speaker
    const tip = { x: Math.round(anc.x - (b.line.who === 'pip' ? 2 : 0)), y: Math.round(anc.y - 1) };
    const len = Math.max(3, tip.y - (y + h));
    for (let i = 0; i <= len; i++) {
      const k = i / len;
      const cx = Math.round(tx + (tip.x - tx) * k);
      const half = Math.max(0, Math.round(2 * (1 - k)));
      g.fillStyle(INK, a);
      g.fillRect(cx - half - 1, y + h + i, half * 2 + 3, 1);
    }
    for (let i = 0; i < len; i++) {
      const k = i / len;
      const cx = Math.round(tx + (tip.x - tx) * k);
      const half = Math.max(0, Math.round(2 * (1 - k)));
      g.fillStyle(i < 1 ? 0xfff4dc : 0xe8d4b0, a);
      g.fillRect(cx - half, y + h - 1 + i, half * 2 + 1, 1);
    }
    // the bubble: an ink rim, a cream body with a warm shade along its bottom, a little shine
    rows(g, x - 1, y + 2, w + 2, h, 3, INK, 0.3 * a);
    rows(g, x - 1, y - 1, w + 2, h + 2, 3, INK, a);
    rows(g, x, y, w, h, 2, 0xfff4dc, a);
    g.fillStyle(0xe8d4b0, a);
    g.fillRect(x + 2, y + h - 1, w - 4, 1);
    g.fillStyle(0xfff4dc, a);
    g.fillRect(tx - 1, y + h - 1, 3, 1);
    g.fillStyle(WHITE, 0.8 * a);
    g.fillRect(x + 2, y + 1, 3, 1);
    lines.forEach((l, i) => texts.text(l, x + w / 2, y + 7 + i * 8, 0x2a1e3a, { ox: 0.5, oy: 0.5, alpha: a }));
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
