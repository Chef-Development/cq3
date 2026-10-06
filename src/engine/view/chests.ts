// The chests (a camp screen: tap the chests waiting by the tent). The three kinds side by side, each on its pedestal:
// a hero chest (bosses and bounties), a Rare chest (bought at the shrine) and a region chest (a region at 100%),
// with how many are waiting and an Open button (opening is free); a kind with none waiting says where they come from.
//
// Opening one plays the reveal over the camp (built like the loot screen's reveal card, loot.ts): the dark comes up,
// the chest drops in and shakes harder and harder while its glow (hchest_glow) builds in the prize's rarity colour,
// then it bursts (hchest_burst, a flash, sparks) and the prize card rises out of it in an ornate frame of its rarity:
// a hero card or a companion card, its name, its rarity ribbon, and "New hero!" / "New companion!", or "+10 shards"
// filling a shard bar, with a star-up moment when a star is gained. A tap during the build skips to the burst; a tap
// on the card closes it. A chest hero met for the first time then plays their arrival scene (once: profile.seen).
// Never a reel: one chest, one prize.
import Phaser from 'phaser';
import { COMPANIONS, type CompanionId } from '../../data/companions';
import { HEROES, HERO_IDS, type HeroId } from '../../data/heroes';
import { TIER_INFO, tierIndex } from '../../data/rarity';
import { STORY } from '../../data/story';
import { openChest, type ChestPrize } from '../../core/chests';
import { checkAchievements } from '../../core/meta';
import { CHEST_KINDS, type ChestKind } from '../../core/profile';
import { Rng } from '../../core/rng';
import { meetSceneFor, shardsToNext } from '../../core/roster';
import { textWidth } from '../font';
import { CampKit, D, DIM_TXT, GOLD_TXT, pix } from './camp-kit';
import { ornateFrame, splitName, star } from './loot';
import { gauge, glow, GOLD, hudIcon, rows } from './pixels';
import { clamp01, easeBack, easeOut3, inRect, INK, mix, pulse, WHITE, type Rect } from './shared';
import { FACE, notePress, RIBBON, tag } from './ui';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

export const CHEST_NAME: Record<ChestKind, string> = { hero: 'Hero chest', rare: 'Rare chest', region: 'Region chest' };
const CHEST_FROM: Record<ChestKind, string> = { hero: 'From bosses and bounties', rare: 'Buy one at the shrine', region: 'A region at 100%' };

/** The reveal's timing (ms from the tap). */
const R = {
  drop: 260, // the chest drops in
  ignore: 350, // taps this soon do nothing
  shakeBase: 900, // the build before the burst: longer for rarer prizes
  shakePer: 160, // ...per tier above Common
  cardIn: 380, // the card rises out of the chest
  linesAt: 420, // the name and lines come in after the burst
  starAt: 1100, // the star-up moment
  doneAt: 700, // the card can be closed this long after the burst
  out: 220,
};

interface Reveal {
  kind: ChestKind;
  prize: ChestPrize;
  at: number;
  burstAt: number;
  burstDone: boolean;
  outAt: number;
  /** The hero's or companion's stars and shards before the chest. */
  before: { stars: number; shards: number };
  starPopped: boolean;
  /** The arrival scene to play once the card closes (a chest hero met for the first time). */
  scene: string | null;
}

export class ChestScreen {
  private openAt = 0;
  private reveal: Reveal | null = null;
  private shakeAt: Partial<Record<ChestKind, number>> = {};
  private glowImg: Phaser.GameObjects.Image | null = null;
  private burstImg: Phaser.GameObjects.Image | null = null;
  private chestImg: Phaser.GameObjects.Image | null = null;
  /** What the chests hold (seeded on the first chest opened, never at boot: Math.random is the screenshots' seed). */
  private rng: Rng | null = null;

  constructor(private readonly kit: CampKit) {}

  /** The layout rebuilt the textures: the reveal's own images go with them. */
  build(): void {
    for (const im of [this.glowImg, this.burstImg, this.chestImg]) im?.destroy();
    this.glowImg = this.burstImg = this.chestImg = null;
  }

  open(now: number): void {
    this.openAt = now;
    this.reveal = null;
  }

  /** Reseed what the chests hold (tests: a known prize). */
  reseed(seed: number): void {
    this.rng = new Rng(seed);
  }

  /** A reveal is playing (the camp keeps quiet). */
  get revealing(): boolean {
    return !!this.reveal;
  }

  // ------------------------------------------------------------------ layout

  private card(): Rect {
    const s = this.kit.s;
    return { x: s.L + 3, y: 19, w: s.R - s.L - 6, h: s.B - 22 };
  }

  /** Kind i's column: its pedestal, the chest on it, its name, count and Open button. */
  private slot(i: number): { r: Rect; chest: { x: number; y: number }; open: Rect } {
    const c = this.card();
    const w = Math.floor((c.w - 8) / 3);
    const r = { x: c.x + 4 + i * w, y: c.y + 4, w: w - 4, h: c.h - 8 };
    const open = { x: r.x + Math.round(r.w / 2) - 30, y: r.y + r.h - 19, w: 60, h: 15 };
    return { r, chest: { x: r.x + Math.round(r.w / 2), y: r.y + 52 }, open };
  }

  // ------------------------------------------------------------------ taps

  tap(x: number, y: number, now: number): 'back' | void {
    const kit = this.kit;
    const rv = this.reveal;
    if (rv) {
      const age = now - rv.at;
      if (age < R.ignore || rv.outAt) return;
      if (!rv.burstAt || now < rv.burstAt) {
        // skip the build: burst now
        rv.burstAt = now;
        return;
      }
      if (now - rv.burstAt < R.doneAt) return;
      rv.outAt = now;
      kit.app.audio.panelClose();
      return;
    }
    if (x < 0 || inRect(kit.backRect(), x, y, 3)) {
      notePress(kit.backRect());
      return 'back';
    }
    CHEST_KINDS.forEach((kind, i) => {
      const sl = this.slot(i);
      if (!inRect(sl.open, x, y, 2) && !inRect({ x: sl.chest.x - 20, y: sl.chest.y - 36, w: 40, h: 38 }, x, y)) return;
      notePress(sl.open);
      this.openKind(kind, now);
    });
  }

  /** Open a waiting chest of `kind` (free): the reveal starts. */
  openKind(kind: ChestKind, now: number): boolean {
    const kit = this.kit;
    const p = kit.profile;
    if (p.chests[kind] <= 0) {
      this.shakeAt[kind] = now;
      kit.app.audio.lockToggle();
      return false;
    }
    const snap = new Map<string, { stars: number; shards: number }>();
    for (const id of HERO_IDS) snap.set(`h:${id}`, { stars: p.heroes[id].stars, shards: p.heroes[id].shards });
    for (const id of Object.keys(p.pets) as CompanionId[]) snap.set(`p:${id}`, { stars: p.pets[id].stars, shards: p.pets[id].shards });
    this.rng ??= new Rng((Math.random() * 0xffffffff) >>> 0);
    const prize = openChest(this.rng, kit.tuning, p, kind);
    if (!prize) return false;
    const hero = prize.kind === 'hero' || prize.kind === 'heroShards';
    const before = snap.get(`${hero ? 'h' : 'p'}:${prize.id}`) ?? { stars: 1, shards: 0 };
    // a chest hero's first arrival plays their scene once the card closes (marked seen now: it plays once)
    let scene: string | null = null;
    if (prize.kind === 'hero' && prize.fresh) {
      scene = meetSceneFor(p, prize.id);
      if (scene && STORY[scene]) p.seen.push(scene);
      else scene = null;
    }
    // owning more heroes and companions can earn achievements: shown by the camp once the card closes
    const feats = checkAchievements(p, kit.tuning);
    const g = kit.run.gains;
    g.achievements.push(...feats);
    g.gems += feats.reduce((a, f) => a + f.gems, 0);
    kit.commit();
    const t = tierIndex(prize.tier);
    this.reveal = { kind, prize, at: now, burstAt: now + R.drop + R.shakeBase + R.shakePer * t, burstDone: false, outAt: 0, before, starPopped: false, scene };
    kit.app.audio.whoosh();
    return true;
  }

  // ------------------------------------------------------------------ drawing

  draw(now: number): void {
    const kit = this.kit;
    const g = kit.gUi;
    kit.drawBack(g, now);
    const s = kit.s;
    kit.title(g, 'Chests', kit.backRect().x + kit.backRect().w + 2, 3, RIBBON.purple);
    kit.gemsTag(g, kit.texts, s.R - 3, 4, now);
    const k = easeBack((now - this.openAt) / 260, 1.4);
    if (k > 0) {
      const c0 = this.card();
      const c = { ...c0, y: c0.y + Math.round((1 - k) * 20) };
      kit.pane(g, c, { alpha: clamp01(k * 2) });
      if (k >= 0.9) CHEST_KINDS.forEach((kind, i) => this.drawSlot(g, kind, i, now));
    }
    if (this.reveal) this.drawReveal(now, this.reveal);
    else this.hideImgs();
  }

  private drawSlot(g: G, kind: ChestKind, i: number, now: number): void {
    const kit = this.kit;
    const texts = kit.texts;
    const sl = this.slot(i);
    const n = kit.profile.chests[kind];
    const have = n > 0;
    const ik = clamp01((now - this.openAt - 100 - i * 70) / 200);
    if (ik <= 0) return;
    const r = sl.r;
    // a dark well with the chest's colour glowing low in it when one is waiting
    rows(g, r.x, r.y, r.w, r.h, 2, 0x120e1e, 0.75 * ik);
    if (have) {
      const col = kind === 'hero' ? 0xffd23a : kind === 'rare' ? 0x4aa0f0 : 0xb06ae0;
      g.fillStyle(col, (0.1 + 0.06 * pulse(now, 1400, i * 300)) * ik);
      g.fillCircle(sl.chest.x, sl.chest.y - 14, 22);
    }
    texts.text(CHEST_NAME[kind], r.x + r.w / 2, r.y + 8, have ? WHITE : DIM_TXT, { bold: true, ox: 0.5, oy: 0.5, alpha: ik });
    // the pedestal and the chest (it bobs and twinkles when one is waiting)
    const px = sl.chest.x;
    const py = sl.chest.y;
    rows(g, px - 20, py - 1, 40, 6, 2, INK, ik);
    rows(g, px - 19, py, 38, 4, 1, 0x4a4058, ik);
    g.fillStyle(0x6a6078, ik);
    g.fillRect(px - 18, py, 36, 1);
    const sh = now - (this.shakeAt[kind] ?? -1e9);
    const dx = sh < 300 ? Math.round(Math.sin(sh / 20) * 2 * (1 - sh / 300)) : 0;
    const bob = have ? Math.round(Math.sin(now / 420 + i) * 1) : 0;
    kit.imgs.foot(`hchest_${kind}_closed`, px + dx, py + 1 - Math.max(0, bob), D.icons, have ? ik : 0.45 * ik, have ? undefined : 0x5a5070);
    if (have && pulse(now, 900, i * 250) > 0.85) star(kit.gOver, px + 10 - i * 3, py - 26, 1, WHITE, ik);
    // how many are waiting
    if (have) kit.bubble(kit.gOver, texts, px + 18, py - 34, `${n}`, now);
    const ly = py + 13;
    if (have) texts.text(n === 1 ? '1 waiting' : `${n} waiting`, px, ly, GOLD_TXT, { ox: 0.5, oy: 0.5, alpha: ik });
    else
      for (const [j, l] of splitName(CHEST_FROM[kind], r.w - 6).entries()) texts.text(l, px, ly + j * 8, DIM_TXT, { ox: 0.5, oy: 0.5, alpha: ik });
    if (have) kit.button(g, texts, sl.open, 'Open', FACE.green, now, { glowCol: 0x8af06a, icon: 'chest' });
    else kit.button(g, texts, sl.open, 'Open', FACE.grey, now, { disabled: true, shakeAt: this.shakeAt[kind] });
  }

  /** Off the camp: the reveal's images hide. */
  hide(): void {
    this.hideImgs();
  }

  private hideImgs(): void {
    for (const im of [this.glowImg, this.burstImg, this.chestImg]) im?.setVisible(false);
  }

  private img(which: 'glow' | 'burst' | 'chest', key: string, depth: number): Phaser.GameObjects.Image {
    const field = which === 'glow' ? 'glowImg' : which === 'burst' ? 'burstImg' : 'chestImg';
    let im = this[field];
    if (!im) {
      im = this.kit.s.add.image(0, 0, key);
      if (which !== 'chest') im.setBlendMode(Phaser.BlendModes.ADD);
      this[field] = im;
    }
    if (im.texture.key !== key) im.setTexture(key);
    return im.setDepth(depth).setVisible(true);
  }

  /** The reveal: the chest shakes while its glow builds, bursts, and the prize card rises out of it. */
  private drawReveal(now: number, rv: Reveal): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gTop;
    const gf = kit.gTopOver;
    const texts = kit.topTexts;
    const face = TIER_INFO[rv.prize.tier].face as Face;
    const [hi, base, , deep] = face;
    const t = tierIndex(rv.prize.tier);
    const age = now - rv.at;
    const out = rv.outAt ? clamp01((now - rv.outAt) / R.out) : 0;
    const A = 1 - out;
    if (out >= 1) {
      this.close(rv);
      return;
    }
    const cx = Math.round((s.L + s.R) / 2);
    // the dark, tinted with the prize's deepest tone once it's out
    const burst = now >= rv.burstAt;
    const since = now - rv.burstAt;
    g.fillStyle(burst ? mix(0x05040a, deep, 0.28) : 0x05040a, 0.94 * easeOut3(age / 220) * A);
    g.fillRect(0, 0, s.R + s.L + 400, s.B + 200);
    // the chest: drops in, then shakes harder and harder; the glow behind it builds in the prize's colour
    const groundY = s.B - 22;
    const drop = easeBack(age / R.drop, 1.3);
    const build = burst ? 1 : clamp01((age - R.drop) / (rv.burstAt - rv.at - R.drop));
    const amp = burst ? 0 : build * build * (2 + t * 0.6);
    const jx = amp ? Math.round(Math.sin(now / 28) * amp) : 0;
    const jy = amp > 1.2 && Math.floor(now / 60) % 2 ? -1 : 0;
    const chestY = Math.round(groundY - (1 - Math.min(1, drop)) * 80) + jy;
    const chestA = burst ? A * (1 - clamp01(since / 500)) : A;
    if (!rv.burstDone && burst) this.burstNow(rv, cx, chestY - 34, face, now);
    const gl = this.img('glow', 'hchest_glow', D.top + 0.002);
    const gk = burst ? Math.max(0, 1 - since / 700) : build;
    gl.setPosition(cx, chestY - 34).setScale(1.2 + gk * 1.4 + (burst ? since / 400 : 0) + 0.06 * Math.sin(now / 90)).setTint(base).setAlpha((0.25 + 0.75 * gk) * A * (burst ? 1 : 0.6 + 0.4 * pulse(now, 300 - t * 25)));
    const ch = this.img('chest', `hchest_${rv.kind}_${burst ? 'open' : 'closed'}`, D.top + 0.004);
    ch.setOrigin(0.5, 1).setScale(2).setPosition(cx + jx, chestY).setAlpha(chestA).setAngle(amp ? Math.sin(now / 45) * amp * 0.8 : 0);
    // motes of light drawn into the chest as it builds (more and faster as it nears the burst)
    if (!burst && age > R.drop) {
      const n = 6 + Math.round(build * 10);
      for (let i = 0; i < n; i++) {
        const per = 700 - build * 300;
        const q = ((age / per + i / n) % 1 + 1) % 1;
        const ang = i * 2.39996 + Math.floor(age / per + i / n) * 1.3;
        const d = 46 * (1 - q * q);
        const x = Math.round(cx + Math.cos(ang) * d);
        const y = Math.round(chestY - 34 + Math.sin(ang) * d * 0.7);
        star(gf, x, y, q > 0.7 ? 0 : 1, i % 3 ? hi : WHITE, (0.3 + 0.7 * q) * build * A);
      }
    }
    // the burst: a starburst turning and growing, then fading
    const bi = this.img('burst', 'hchest_burst', D.top + 0.003);
    if (burst && since < 650) {
      const bk = since / 650;
      bi.setPosition(cx, chestY - 30).setScale(0.4 + easeOut3(bk) * (2.4 + t * 0.25)).setAngle(since / 6).setTint(mix(base, WHITE, 0.3)).setAlpha((1 - bk) * A);
    } else bi.setVisible(false);
    // the flash
    if (burst && since < 240) {
      gf.fillStyle(mix(hi, WHITE, 0.5), 0.75 * (1 - since / 240));
      gf.fillRect(0, 0, s.R + s.L + 400, s.B + 200);
    }
    if (!burst) {
      // "?" pulses over the chest while it builds
      texts.text('Tap!', cx, groundY + 9, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.5 + 0.4 * pulse(now, 700) });
      return;
    }
    this.drawPrize(now, rv, cx, A);
  }

  /** The chest bursts open: sound, sparks, rings. */
  private burstNow(rv: Reveal, x: number, y: number, face: Face, now: number): void {
    const kit = this.kit;
    const audio = kit.app.audio;
    const t = tierIndex(rv.prize.tier);
    rv.burstDone = true;
    rv.burstAt = Math.min(rv.burstAt, now);
    audio.explode();
    if (t >= tierIndex('legendary')) audio.legendaryReveal(t >= tierIndex('mythic'));
    else if (t >= tierIndex('rare')) kit.after(120, () => audio.lootSting(Math.min(5, t)));
    else kit.after(120, () => audio.lootDrop(t));
    kit.fx.burst(x, y, [face[0], face[1], WHITE, GOLD[3]], 40 + t * 8, 1.4, { kind: 'star', g: 60, life: 900 });
    kit.fx.burst(x, y, [face[0], WHITE], 24, 1.0, { kind: 'spark', g: 120, life: 700 });
    kit.fx.ring(x, y, 40 + t * 4, face[0], 520);
    kit.fx.ring(x, y, 26, WHITE, 380);
  }

  /** The prize: its card rising out of the chest into an ornate frame of its rarity (left of centre), and beside it
   *  its rarity, name and what it is: "New hero!" / "New companion!", or the shards filling their bar (and a star
   *  gained). */
  private drawPrize(now: number, rv: Reveal, cx: number, A: number): void {
    const kit = this.kit;
    const s = kit.s;
    const g = kit.gTop;
    const gf = kit.gTopOver;
    const texts = kit.topTexts;
    const pz = rv.prize;
    const face = TIER_INFO[pz.tier].face as Face;
    const [hi, base, , deep] = face;
    const since = now - rv.burstAt;
    const hero = pz.kind === 'hero' || pz.kind === 'heroShards';
    const name = hero ? HEROES[pz.id as HeroId].name : COMPANIONS[pz.id as CompanionId].name;
    const fx = cx - 50;
    const fy = 64;
    // rays turning behind the card
    const rk = easeOut3(since / 500) * A;
    for (let i = 0; i < 14; i++) {
      const a0 = now / 3000 + (i / 14) * Math.PI * 2;
      g.fillStyle(i % 2 ? base : hi, (i % 2 ? 0.1 : 0.07) * rk);
      const L = 260;
      g.fillTriangle(fx, fy, Math.round(fx + Math.cos(a0 - 0.06) * L), Math.round(fy + Math.sin(a0 - 0.06) * L), Math.round(fx + Math.cos(a0 + 0.06) * L), Math.round(fy + Math.sin(a0 + 0.06) * L));
    }
    // the card rises out of the chest and pops into its frame
    const ck = clamp01(since / R.cardIn);
    const e = easeOut3(ck);
    const ccx = Math.round(cx + (fx - cx) * e);
    const ccy = Math.round(s.B - 50 + (fy - (s.B - 50)) * e);
    const size = Math.round(56 * Math.min(1.08, Math.max(0.2, easeBack(ck, 1.8))));
    ornateFrame(g, ccx, ccy, size, face, A);
    const key = hero ? kit.heroArt(pz.id as HeroId).key : `comp_card_${pz.id}`;
    if (kit.has(key) && ck > 0.3) {
      const [w, h] = kit.imgs.size(key);
      const ch = Math.min(h, size - 4);
      kit.sprites.draw(key, ccx - Math.round(w / 2), ccy - Math.round(ch / 2), D.topIcons, { crop: [0, Math.max(0, h - ch), w, ch], alpha: A * clamp01((ck - 0.3) / 0.3) });
    }
    // twinkles orbiting the frame
    for (let i = 0; i < 6; i++) {
      const ang = now / 760 + (i / 6) * Math.PI * 2;
      const rr = size * 0.55 + 9 + 2 * Math.sin(now / 200 + i);
      const tw = pulse(now, 600, i * 170);
      star(gf, Math.round(ccx + Math.cos(ang) * rr), Math.round(ccy + Math.sin(ang) * rr * 0.9), tw > 0.6 ? 2 : 1, tw > 0.6 ? WHITE : hi, A * (0.5 + 0.5 * tw) * ck);
    }
    // beside it: the rarity, the name (big), what it is
    const line = (at: number) => clamp01((since - at) / 160) * A;
    const tx = cx - 12;
    const ra = line(200);
    if (ra > 0) kit.rarityTag(g, texts, pz.tier, tx + Math.round((1 - ra) * 6), 34, ra);
    const na = line(R.linesAt);
    if (na > 0) {
      const sc = tx + textWidth(name, 2, true) <= s.R - 4 ? 2 : 1;
      texts.text(name, tx + Math.round((1 - na) * 6), 50, mix(hi, WHITE, 0.15), { bold: true, scale: sc, oy: 0.5, alpha: na, extrude: 1, extrudeCol: deep });
    }
    const sub = hero ? HEROES[pz.id as HeroId].title : COMPANIONS[pz.id as CompanionId].kind;
    const sa = line(R.linesAt + 60);
    if (sa > 0) texts.text(sub, tx, 64, 0xdcd8f0, { oy: 0.5, alpha: sa });
    const fresh = (pz.kind === 'hero' || pz.kind === 'pet') && pz.fresh;
    const ka = line(R.linesAt + 160);
    if (ka > 0) {
      if (fresh) {
        const what = hero ? 'New hero!' : 'New companion!';
        const w = textWidth(what, 1, true) + 20;
        const k = easeBack((since - R.linesAt - 160) / 260, 2.2);
        const r = { x: tx, y: 72 - Math.round((1 - Math.min(1, k)) * 4), w, h: 14 };
        glow(g, r, GOLD[3], (0.35 + 0.3 * pulse(now, 700)) * ka, 3);
        tag(g, r, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]], ka);
        texts.text(what, r.x + w / 2, r.y + 7, 0x5a2a08, { bold: true, ox: 0.5, oy: 0.5, alpha: ka, plain: true });
        if (pulse(now, 900) > 0.8) star(gf, r.x + w - 3, r.y + 1, 1, WHITE, ka);
        // a new hero's style, a new companion's first perk
        const y = 96;
        if (hero) kit.familyChip(g, texts, HEROES[pz.id as HeroId].style, tx, y, ka);
        else {
          const pk = COMPANIONS[pz.id as CompanionId].perks[0];
          for (const [j, l] of splitName(`${pk.name}: ${pk.text}`, s.R - 6 - tx).entries()) texts.text(l, tx, y + j * 8, 0xb4f070, { oy: 0.5, alpha: ka });
        }
      } else this.drawShards(g, now, rv, tx, 79, ka);
    }
    // the hint, once it can be closed
    if (since > R.doneAt + 200 && !rv.outAt) texts.text(rv.scene ? 'Tap to meet them!' : 'Tap to continue', cx, s.B - 6, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.8 + 0.2 * pulse(now, 900) });
  }

  /** "+10 shards": the stars and the shard bar filling from before to after; a star gained pops in with a burst. */
  private drawShards(g: G, now: number, rv: Reveal, x: number, y: number, a: number): void {
    const kit = this.kit;
    const texts = kit.topTexts;
    const pz = rv.prize;
    const hero = pz.kind === 'hero' || pz.kind === 'heroShards';
    const prog = hero ? kit.profile.heroes[pz.id as HeroId] : kit.profile.pets[pz.id as CompanionId];
    const since = now - rv.burstAt;
    hudIcon(g, 'shard', x, y - 6, 1, a);
    texts.text(`+${pz.shards} shards`, x + 12, y, 0xe8d0ff, { bold: true, oy: 0.5, alpha: a });
    // the stars, and the bar toward the next one
    const sy = y + 9;
    const starsShown = pz.starsUp > 0 && since < R.starAt ? rv.before.stars : prog.stars;
    const sw = kit.starRow(g, x, sy, starsShown, { alpha: a });
    const bx = x + sw + 5;
    const need = shardsToNext(kit.tuning, starsShown);
    const fk = easeOut3((since - R.linesAt - 200) / 600);
    let frac: number;
    if (pz.starsUp > 0 && since < R.starAt) {
      const n0 = shardsToNext(kit.tuning, rv.before.stars) ?? 1;
      frac = (rv.before.shards + (n0 - rv.before.shards) * clamp01(fk)) / n0;
    } else if (need === null) frac = 1;
    else {
      const from = pz.starsUp > 0 ? 0 : rv.before.shards;
      frac = (from + (prog.shards - from) * clamp01(pz.starsUp > 0 ? (since - R.starAt) / 400 : fk)) / need;
    }
    gauge(g, bx, sy + 2, 40, 5, clamp01(frac), 0, { ramp: [0xf0d8ff, 0xc08af0, 0x8a4ad0, 0x4a2080] });
    const shown = pz.starsUp > 0 && since < R.starAt ? `${shardsToNext(kit.tuning, rv.before.stars) ?? 0}/${shardsToNext(kit.tuning, rv.before.stars) ?? 0}` : need === null ? 'Max' : `${prog.shards}/${need}`;
    texts.text(shown, bx + 44, sy + 4.5, 0xe0d0ff, { oy: 0.5, alpha: a });
    // the star-up moment
    if (pz.starsUp > 0 && since >= R.starAt) {
      const sx = x + (prog.stars - 1) * 9 + 4;
      if (!rv.starPopped) {
        rv.starPopped = true;
        kit.fx.burst(sx, sy + 4, [0xfff0a0, 0xffd23a, WHITE], 24, 1, { kind: 'star', g: 40, life: 800 });
        kit.fx.ring(sx, sy + 4, 16, 0xfff0a0, 420);
        kit.fx.flash({ x: x - 1, y: sy - 1, w: sw + 2, h: 11 }, 0xfff0a0, 360);
        for (let i = 0; i < 3; i++) kit.after(i * 90, () => kit.app.audio.statUp(i));
      }
      const k = clamp01((since - R.starAt) / 200);
      const t = `Star up! ${prog.stars} stars`;
      pix(kit.gTopOver, 'skills', x, sy + 12, a * k);
      texts.text(t, x + 11, sy + 16 - Math.round((1 - easeBack(k, 2)) * 4), GOLD_TXT, { bold: true, oy: 0.5, alpha: a * k });
    }
  }

  /** The card closed: an arrival scene to play (over the camp), and the chest screen again. */
  private close(rv: Reveal): void {
    const kit = this.kit;
    this.reveal = null;
    this.hideImgs();
    if (rv.scene) {
      kit.app.storyBox = 0;
      kit.app.storyOverlay = rv.scene;
    }
  }
}

/** The best kind of chest waiting (the camp shows that one), or null. */
export function bestWaiting(p: { chests: Record<ChestKind, number> }): ChestKind | null {
  return (['region', 'rare', 'hero'] as ChestKind[]).find((k) => p.chests[k] > 0) ?? null;
}
