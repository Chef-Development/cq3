// The hero's party on the stage: the equipped companions (one or two: Pip's own frames pip_*, the others comp_${id}_*;
// fliers hover like Pip, the rest stand on the ground behind the hero) and a Summoner's allies (ally_${kind}_*: called
// in with a pop and a puff of leaves, a front row at the hero's feet). Each companion plays its act frame when it
// attacks (fliers swoop, walkers dash in; Sunny breathes on every foe) and flares when one of its perks kicks in; each
// ally plays its act frame when it acts (a Barkback holds its bark up while braced and hops in front of the hero to
// take a red), blinks when it's about to leave and goes in a puff. A companion hops when its perk finds a coin (Bun),
// and a called ally pops in when the leaf from the green that called it lands (view/onsite.ts).
import Phaser from 'phaser';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import type { AllyKind } from '../../data/heroes';
import type { FightScene } from '../scene';
import { STAG_H } from '../art-hero-spirits';
import { clamp01, ease, PIP_BACK_MS, PIP_SWOOP_MS, rand } from './shared';

const WHITE_SPARK = 0xf4fcff;

type Img = Phaser.GameObjects.Image;

/** Each companion's colour (its flare ring, its sparks). */
export const PET_COL: Record<CompanionId, number> = {
  bun: 0xf4eef8,
  pip: 0x9ad8ff,
  newt: 0xff8a3a,
  sprocket: 0xf2c230,
  brick: 0xb8a890,
  flurry: 0xe0f6ff,
  mote: 0xfff0a0,
  sunny: 0xffb030,
  // ---- Part 6 companions
  burr: 0xd8a868,
  lark: 0xffd84a,
  gloam: 0xb88aff,
  nimbus: 0x6ae8e8,
};
/** The companion whose perk a perk id is (it flares when the perk kicks in). */
export const PERK_PET: Record<string, CompanionId> = {
  luckyFoot: 'bun',
  owlWatch: 'pip',
  emberBite: 'newt',
  oilCan: 'sprocket',
  rockWall: 'brick',
  starlight: 'mote',
  mend: 'mote',
  goldHoard: 'sunny',
  fireBreath: 'sunny',
  chillBite: 'flurry',
  snowDash: 'flurry',
  // ---- Part 6 companions
  prickly: 'burr',
  wakeSong: 'lark',
  wakeNote: 'lark',
  nightEyes: 'gloam',
  tide: 'nimbus',
  calmSeas: 'nimbus',
};
/** Allies' fixed places in the front row (so they never shuffle as others come and go; the Glowmoth hovers by the
 *  hero's shoulder instead), and their colours. */
const ALLY_SLOT: Record<AllyKind, number> = { thornling: 0, barkback: 1, seedling: 2, glowmoth: 0, spiritWolf: 0, spiritTortoise: 1, wispSwarm: 0, spiritStag: 0 };
export const ALLY_COL: Record<AllyKind, number> = {
  thornling: 0xb4d058,
  barkback: 0xb07a44,
  glowmoth: 0xffe070,
  seedling: 0x9af06a,
  // Yara's spirits (Part 6): spirit-light cyan, jade, star white; the Great Spirit stag a bright cyan
  spiritWolf: 0x7ad8ff,
  spiritTortoise: 0x6af0c0,
  wispSwarm: 0xe8e0ff,
  spiritStag: 0xb0f4ff,
};
/** Allies that hover by the hero's shoulder (the Glowmoth, Yara's Wisps) rather than stand in the front row. */
const hovers = (kind: AllyKind): boolean => kind === 'glowmoth' || kind === 'wispSwarm';
/** Allies that stand guard (braced, they hold their act pose: a Barkback's bark, a Tortoise's shell). */
const guards = (kind: AllyKind): boolean => kind === 'barkback' || kind === 'spiritTortoise';
/** Yara's spirits come and go in spirit light (Moss's allies in leaves). */
export const isSpirit = (kind: AllyKind): boolean => kind === 'spiritWolf' || kind === 'spiritTortoise' || kind === 'wispSwarm' || kind === 'spiritStag';
/** The colour of the puff an ally comes and goes in. */
const puffCol = (kind: AllyKind): number => (isSpirit(kind) ? 0x9ae8ff : 0x78a83c);
const WALK_MS = 170;
/** How high a flying companion hovers over the ground (its centre): low enough that it never crowds the hero's head. */
const FLY_Y = 21;

interface PetView {
  id: CompanionId;
  img: Img;
  rim: Img;
  flies: boolean;
  state: 'idle' | 'swoop' | 'back' | 'breathe';
  t0: number;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Its act frame shows until this anim time (a perk's flare, a breath). */
  actUntil: number;
  /** A happy hop (Bun's Lucky Foot finding a coin): anim time it started; one waiting for it to be home. */
  hopAt: number;
  hopWant?: boolean;
}

interface AllyView {
  id: number;
  kind: AllyKind;
  img: Img;
  bornAt: number;
  actAt: number;
  hopAt: number; // a Barkback hopping in front of the hero to block (anim time)
  leaveAt: number; // 0 = still here
  x: number;
}

export class Party {
  pets: PetView[] = [];
  allies = new Map<number, AllyView>();
  private petKey = '';

  constructor(private readonly s: FightScene) {}

  /** A new layout: the images went with the containers. */
  build(): void {
    this.pets = [];
    this.allies.clear();
    this.petKey = '';
  }

  /** A new fight: the allies go (the companions stay). */
  newFight(): void {
    for (const a of this.allies.values()) a.img.destroy();
    this.allies.clear();
  }

  /** Who is coming along: the hero build's companions (Pip alone when it names none). */
  private petIds(): CompanionId[] {
    const pets = this.s.app.run.combat?.pets ?? this.s.app.run.hero.build?.pets;
    const ids = (pets ?? []).map((p) => p.id).filter((id) => !!COMPANIONS[id]);
    return ids.length ? ids.slice(0, 2) : ['pip'];
  }

  /** Make the companion views match who's coming along. */
  syncPets(makeRim: () => Img): void {
    const ids = this.petIds();
    const key = ids.join(',');
    if (key === this.petKey && this.pets.length) return;
    this.petKey = key;
    const s = this.s;
    const old = new Map(this.pets.map((p) => [p.id, p]));
    this.pets = ids.map((id, i) => {
      const keep = old.get(id);
      if (keep) {
        old.delete(id);
        return keep;
      }
      const flies = COMPANIONS[id].flies;
      const img = s.add.image(0, 0, id === 'pip' ? 'pip_idle0' : `comp_${id}_idle0`).setOrigin(0.5, flies ? 0.5 : 1);
      const rim = makeRim();
      // behind the hero (like Pip always was), each with its rim light right above it
      if (rim.parentContainer) rim.parentContainer.remove(rim);
      s.actors.addAt([img, rim], i * 2);
      const x = s.heroHome - 30 - i * 24;
      return { id, img, rim, flies, state: 'idle', t0: 0, x, y: flies ? s.ground - FLY_Y : s.ground, fromX: 0, fromY: 0, toX: 0, toY: 0, actUntil: 0, hopAt: -1e9 } as PetView;
    });
    for (const p of old.values()) {
      p.img.destroy();
      p.rim.destroy();
    }
  }

  /** A texture for a companion's pose. */
  private tex(id: CompanionId, pose: 'idle0' | 'idle1' | 'act'): string {
    if (id === 'pip') return pose === 'act' ? 'pip_dive' : `pip_${pose}`;
    return `comp_${id}_${pose}`;
  }

  /**
   * Every frame: the companions follow the hero (Pip and the fliers hover and bob; walkers scoot along the ground with
   * a little hop), play their attack, and the allies hold their places in front, acting, blinking out, puffing away.
   * `visible`: the stage's party shows (not before Pip joins, not on the title's showcase).
   */
  update(heroX: number, visible: boolean, makeRim: () => Img, syncRim: (src: Img, rim: Img) => void): void {
    const s = this.s;
    this.syncPets(makeRim);
    const a = s.anim;
    this.pets.forEach((P, i) => {
      const homeX = heroX - 30 - i * 24;
      const flier = P.flies;
      const homeY = flier ? s.ground - FLY_Y + Math.sin((a + i * 400) / 260) * 2 : s.ground;
      const period = P.id === 'pip' ? 110 : flier ? 130 : 340;
      let tex = this.tex(P.id, Math.floor((a + (P.id === 'pip' ? 0 : i * 170)) / period) % 2 ? 'idle1' : 'idle0');
      if (P.state === 'swoop') {
        const ms = flier ? PIP_SWOOP_MS : WALK_MS;
        const k = clamp01((a - P.t0) / ms);
        P.x = P.fromX + (P.toX - P.fromX) * ease(k);
        P.y = flier ? P.fromY + (P.toY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 10 : P.toY - Math.abs(Math.sin(k * Math.PI * 2)) * 3;
        tex = this.tex(P.id, flier || k > 0.6 ? 'act' : tex.endsWith('idle1') ? 'idle1' : 'idle0');
      } else if (P.state === 'back') {
        const k = clamp01((a - P.t0) / PIP_BACK_MS);
        P.x = P.fromX + (homeX - P.fromX) * ease(k);
        P.y = flier ? P.fromY + (homeY - P.fromY) * ease(k) - Math.sin(k * Math.PI) * 14 : homeY - Math.abs(Math.sin(k * Math.PI * 2)) * 3;
        if (k >= 1) P.state = 'idle';
      } else {
        const dx = homeX - P.x;
        P.x += dx * 0.12;
        P.y = flier ? homeY : homeY - (Math.abs(dx) > 2 ? Math.abs(Math.sin(a / 55)) * 2 : 0);
        if (P.state === 'breathe' && a >= P.actUntil) P.state = 'idle';
      }
      if (a < P.actUntil) tex = this.tex(P.id, 'act');
      if (!s.textures.exists(tex)) tex = this.tex(P.id, 'idle0');
      // a happy hop (a coin found): up and down twice, the second smaller (once it's home from an attack), a glint of
      // gold over it
      if (P.hopWant && P.state === 'idle' && Math.abs(P.x - homeX) < 4) {
        P.hopWant = false;
        P.hopAt = a;
        const hy = flier ? P.y - 8 : P.y - 18;
        s.fx.ring(P.x, hy + 6, 10, 0xffe680, true);
        s.fx.chips(P.x, hy, 6, [0xfff0a0, 0xf2c230, 0xffffff], 6, -1);
      }
      const hk = (a - P.hopAt) / 360;
      const hop = hk >= 0 && hk < 1 ? Math.round(Math.abs(Math.sin(hk * Math.PI * 2)) * (hk < 0.5 ? 7 : 3)) : 0;
      P.img.setTexture(tex).setPosition(Math.round(P.x), Math.round(P.y) - hop).setVisible(visible);
      syncRim(P.img, P.rim);
    });
    // allies: the front row at the hero's feet
    const c = s.app.run.combat;
    for (const v of this.allies.values()) {
      const slot = ALLY_SLOT[v.kind] ?? 0;
      const moth = hovers(v.kind);
      const stag = v.kind === 'spiritStag';
      const homeX = this.allyHomeX(v.kind);
      v.x += (homeX - v.x) * 0.2;
      const ally = c?.allies.find((x) => x.id === v.id);
      let pose = Math.floor((a + slot * 130) / (moth ? 140 : 320)) % 2 ? '1' : '0';
      if (a - v.actAt < 260 || (guards(v.kind) && ally?.braced)) pose = 'act';
      let x = v.x;
      let y = moth ? s.ground - 34 + Math.sin(a / 230) * 2 : s.ground + 4;
      if (stag) {
        // the Great Spirit (not one of c.allies): it rears and lunges toward the foes as it strikes
        pose = Math.floor(a / 300) % 2 ? '1' : '0';
        const sk = (a - v.actAt) / 300;
        if (sk >= 0 && sk < 1) {
          pose = 'act';
          x += Math.round(Math.sin(sk * Math.PI) * 8);
        }
      }
      // a Barkback hopping in front of the hero to take a red
      const hk = (a - v.hopAt) / 380;
      if (hk >= 0 && hk < 1) {
        const out = hk < 0.5 ? ease(hk / 0.5) : 1 - ease((hk - 0.5) / 0.5);
        x += (heroX + 16 - v.x) * out;
        y -= Math.sin(Math.min(1, hk * 2) * Math.PI) * 6;
        pose = 'act';
      }
      // called in: a pop with a little overshoot
      const bk = (a - v.bornAt) / 220;
      const sc = bk < 1 ? Math.max(0.1, bk < 0.7 ? (bk / 0.7) * 1.2 : 1.2 - 0.2 * ((bk - 0.7) / 0.3)) : 1;
      let alpha = 1;
      if (v.leaveAt) {
        const lk = (a - v.leaveAt) / 240;
        if (lk >= 1) {
          v.img.destroy();
          this.allies.delete(v.id);
          continue;
        }
        alpha = 1 - lk;
      } else if (ally && ally.left < 1.5 && Math.floor(a / 110) % 2 === 0) alpha = 0.35; // about to leave
      else if (stag && (c?.perk.stag ?? 0) < 1 && Math.floor(a / 110) % 2 === 0) alpha = 0.35;
      // (the spirits shimmer a little: spirit light)
      if (isSpirit(v.kind)) alpha *= 0.86 + 0.14 * Math.sin(a / 170 + v.id);
      const key = `ally_${v.kind}_${pose}`;
      v.img
        .setTexture(s.textures.exists(key) ? key : `ally_${v.kind}_0`)
        .setPosition(Math.round(x), Math.round(y))
        .setScale(sc)
        .setAlpha(alpha)
        .setVisible(visible && a >= v.bornAt); // (a called ally pops in when the leaf that calls it lands)
    }
  }

  /** Where an ally stands (the walkers in a row at the hero's feet; the Glowmoth by the hero's shoulder). */
  private allyHomeX(kind: AllyKind): number {
    const s = this.s;
    if (kind === 'spiritStag') return s.heroHome - 8;
    return hovers(kind) ? s.heroHome + 12 : s.heroHome - 19 - (ALLY_SLOT[kind] ?? 0) * 17;
  }

  /** The middle of an ally's place (where it pops in when called). */
  allyHome(kind: AllyKind): { x: number; y: number } {
    return { x: this.allyHomeX(kind), y: hovers(kind) ? this.s.ground - 34 : kind === 'spiritStag' ? this.s.ground - 18 : this.s.ground - 6 };
  }

  /** Where a companion is (for a ring, a bolt). */
  petPos(id: CompanionId): { x: number; y: number } | null {
    const p = this.pets.find((x) => x.id === id);
    if (!p) return null;
    return { x: p.x, y: p.flies ? p.y : p.y - 10 };
  }

  /** Whether a companion is out on the stage now. */
  visible(id: CompanionId): boolean {
    return !!this.pets.find((x) => x.id === id)?.img.visible;
  }

  /** A companion's happy hop (Bun's Lucky Foot found a coin): it hops where it stands (once it's back from an attack
   *  that came with it), a glint of gold over it. */
  hop(id: CompanionId): void {
    const P = this.pets.find((p) => p.id === id);
    if (P) P.hopWant = true;
  }

  /** Where an ally is (the middle of its sprite). */
  allyPos(kind: AllyKind): { x: number; y: number } | null {
    for (const v of this.allies.values()) if (v.kind === kind && !v.leaveAt) return { x: v.img.x, y: v.img.y - (hovers(v.kind) ? 0 : v.kind === 'spiritStag' ? 24 : 10) };
    return null;
  }

  /** Ground shadows under the party (walkers solid, fliers small and faint). */
  shadows(shadow: (x: number, feetY: number, w: number, lift?: number, alpha?: number) => void): void {
    const s = this.s;
    for (const p of this.pets) {
      if (!p.img.visible) continue;
      if (p.flies) shadow(p.x, s.ground, 12, s.ground - p.y - 8, 0.75);
      else shadow(p.x, s.ground, 14, Math.max(0, s.ground - p.y));
    }
    for (const v of this.allies.values()) {
      if (!v.img.visible || v.leaveAt) continue;
      if (hovers(v.kind)) shadow(v.img.x, s.ground, 8, 30, 0.5);
      else if (v.kind === 'spiritStag') shadow(v.img.x, s.ground + 4, 26, 0, 0.6);
      else shadow(v.img.x, s.ground + 4, 10, Math.max(0, s.ground + 4 - v.img.y));
    }
  }

  /**
   * A companion attacks: fliers swoop at the target, walkers dash in along the ground (a hop up at a flier), both in
   * their act frame; Sunny breathes fire at every foe from where it hovers. `land` runs when the blow lands.
   */
  attack(id: CompanionId, target: { x: number; y: number; w: number; h: number; fly: number }, all: Array<{ x: number; y: number }> | null, land: () => void): void {
    const s = this.s;
    const P = this.pets.find((p) => p.id === id) ?? this.pets[0];
    if (!P) return land();
    if (all && id === 'nimbus') {
      // Nimbus's spray: a spout from its blowhole arcs over onto every foe, drops flying (the rain over them that
      // strikes each is view/onsite-pets.ts)
      P.state = 'breathe';
      P.actUntil = s.anim + 460;
      const bx = P.x + 3;
      const by = P.y - 7;
      const foes = all.length ? all : [{ x: target.x, y: target.y - target.h / 2 }];
      foes.forEach((f, j) => {
        s.later(j * 30, () => s.fx.bolt(bx, by, f.x - 2, f.y - 30, 160, 0x6ae8e8));
        s.later(60 + j * 30, () => s.fx.bolt(bx + 1, by - 1, f.x + 2, f.y - 26, 150, 0xc8f8ff));
      });
      for (let w = 0; w < 3; w++)
        s.later(w * 60, () => {
          for (let i = 0; i < 8; i++)
            s.fx.particles.push({ x: bx + rand(-1, 1), y: by, vx: rand(10, 90), vy: rand(-170, -110), g: 420, born: performance.now(), life: rand(320, 460), color: i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xc8f8ff : 0x6ae8e8, size: i % 4 === 0 ? 2 : 1, world: true, streak: false, shape: 'chip' });
        });
      s.later(150, land);
      return;
    }
    if (all) {
      // a breath over the whole enemy line: streams of fire from its mouth to every foe, flames spraying
      P.state = 'breathe';
      P.actUntil = s.anim + 460;
      const mx = P.x + 12;
      const my = P.y - 2;
      const foes = all.length ? all : [{ x: target.x, y: target.y - target.h / 2 }];
      foes.forEach((f, j) => {
        s.fx.bolt(mx, my, f.x - 4, f.y, 150, 0xff8a2a);
        s.later(40 + j * 20, () => s.fx.bolt(mx, my + 2, f.x - 2, f.y + 3, 130, 0xffe080));
      });
      for (let w = 0; w < 4; w++)
        s.later(w * 60, () => {
          for (let i = 0; i < 7; i++) {
            const f = foes[i % foes.length];
            const d = Math.max(1, Math.hypot(f.x - mx, f.y - my));
            const sp = rand(200, 300);
            const spread = rand(-0.25, 0.25);
            const ux = (f.x - mx) / d;
            const uy = (f.y - my) / d;
            s.fx.particles.push({ x: mx, y: my, vx: (ux - uy * spread) * sp, vy: (uy + ux * spread) * sp, g: -60, born: performance.now(), life: rand(240, 380), color: i % 3 === 0 ? 0xfff0a0 : i % 3 === 1 ? 0xffb030 : 0xff5a1a, size: 2, world: true, streak: false, shape: i % 2 ? 'shard' : 'chip' });
          }
        });
      s.later(150, land);
      return;
    }
    Object.assign(P, {
      state: 'swoop',
      t0: s.anim,
      fromX: P.x,
      fromY: P.y,
      toX: target.x - target.w / 2 - (P.flies ? 2 : 8),
      toY: P.flies ? target.y - target.h * 0.6 : s.ground - Math.min(10, target.fly),
    });
    s.later(P.flies ? PIP_SWOOP_MS : WALK_MS, () => {
      land();
      Object.assign(P, { state: 'back', t0: s.anim, fromX: P.x, fromY: P.y });
    });
  }

  /** A companion's perk kicked in: it flares (its act frame for a moment, a ring and sparks in its colour). */
  flare(id: CompanionId): void {
    const s = this.s;
    const P = this.pets.find((p) => p.id === id);
    if (!P || !P.img.visible) return;
    P.actUntil = s.anim + 240;
    const y = P.flies ? P.y : P.y - 10;
    s.fx.ring(P.x, y, 12, PET_COL[id], true);
    s.fx.burst(P.x, y - 4, PET_COL[id], 6, true, 0.7);
  }

  /** A Summoner's ally came (after `delay` ms: the leaf from the green that called it lands), acted, left, rallied or
   *  blocked. */
  ally(kind: AllyKind, action: 'call' | 'act' | 'leave' | 'rally' | 'block', id: number, delay = 0): void {
    const s = this.s;
    const col = ALLY_COL[kind];
    if (action === 'call') {
      const x = this.allyHomeX(kind);
      const img = s.add.image(x, s.ground + 4, `ally_${kind}_0`).setOrigin(0.5, hovers(kind) ? 0.5 : kind === 'spiritStag' ? (STAG_H - 2) / STAG_H : 20 / 22).setVisible(false);
      // (the Great Spirit stands tall behind the hero)
      if (kind === 'spiritStag') s.actors.addAt(img, 0);
      else s.actors.add(img);
      this.allies.set(id, { id, kind, img, bornAt: s.anim + delay, actAt: -1e9, hopAt: -1e9, leaveAt: 0, x });
      const y = hovers(kind) ? s.ground - 34 : kind === 'spiritStag' ? s.ground - 20 : s.ground - 4;
      if (kind === 'spiritStag') {
        // the Great Spirit comes down in a column of starlight
        s.fx.glow(x, s.ground - 20, 30, col, 520, s.ground);
        s.fx.ring(x, s.ground - 20, 26, col, true);
        s.fx.burst(x, s.ground - 30, WHITE_SPARK, 16, true, 1.2, true);
        s.fx.dust(x, s.ground + 4, 8, 0, 1.2);
        return;
      }
      s.later(delay, () => {
        s.fx.burst(x, y, puffCol(kind), 10, true, 0.8);
        s.fx.burst(x, y, col, 5, true, 0.6);
        s.fx.ring(x, y, 12, col, true);
        s.fx.dust(x, s.ground + 4, 4, 0, 0.8);
      });
      return;
    }
    if (action === 'rally') {
      // everyone springs up together
      for (const v of this.allies.values()) {
        v.actAt = s.anim;
        s.fx.ring(v.img.x, v.img.y - 8, 14, 0xffe680, true);
      }
      s.fx.addFloater(s.heroHome - 30, s.ground - 40, 'Rally!', 0xffe680, 1, true, 0, -16, 0, 700, true);
      return;
    }
    const v = this.allies.get(id);
    if (!v) return;
    if (action === 'leave') {
      v.leaveAt = s.anim;
      s.fx.burst(v.img.x, v.img.y - 8, puffCol(kind), 8, true, 0.7);
      s.fx.dust(v.img.x, s.ground + 4, 5, 0, 0.9);
      return;
    }
    if (action === 'block') {
      v.hopAt = s.anim;
      s.later(190, () => s.fx.burst(this.s.fighters.h.x + 16, s.ground - 12, col, 8, true, 1));
      return;
    }
    // act: its act frame, and a little glow in its colour
    v.actAt = s.anim;
    if (kind === 'glowmoth') s.fx.glow(v.img.x, v.img.y, 10, 0xffe070, 260);
    else if (kind === 'wispSwarm') s.fx.glow(v.img.x, v.img.y, 9, col, 240);
    else if (kind === 'spiritStag') s.fx.glow(v.img.x + 8, v.img.y - 20, 18, col, 260);
    else if (kind === 'seedling') s.fx.burst(v.img.x + 6, v.img.y - 6, 0x9af06a, 6, true, 0.7);
  }
}
