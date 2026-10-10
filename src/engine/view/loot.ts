// The loot screen (phase 'loot', after a won fight or a treasure chest). The stage dims, a ball of light swells where
// the last foe fell (or in the open chest), and the items burst out of it one after another, rarest last: each one
// arcs out with a trail, lands in a row with a squash and a flash, and a pillar of light in its rarity's colour
// shoots up through it (Common faint; Uncommon and up brighter and wider, with sparkles rising in the beam; Epic and
// up with rays and a shimmer; Mythic red, flickering and wild). Under each: its name in the rarity's colour, a NEW
// badge, and a green arrow when it beats what Rowan wears. A Legendary or Mythic stops the show for a full-screen
// reveal card (rays, the icon at 2x in an ornate frame, its name, rarity ribbon, kind, stats and unique effect);
// a tap dismisses each card. Then "Tap to continue" collects the loot (it is already in the bag) and the boost pick
// follows. Taps in the first moment are ignored; a tap during the burst lands everything at once.
import { whole } from '../../core/format';
import Phaser from 'phaser';
import { BASE_BY_ID, EFFECTS, RARITY_INFO } from '../../data/gear';
import { itemPower, rarityIndex, type Item } from '../../core/gear';
import { itemByUid, replaces } from '../../core/profile';
import type { FightScene } from '../scene';
import { textWidth } from '../font';
import { GAME_H, GAME_W } from '../layout';
import { cellIcon, itemCell, itemKind, itemLines, itemName, rarityFace, rarityText, statSize } from './items';
import { band, chevron, glow, GOLD, hudIcon, iconSize, rows } from './pixels';
import { clamp01, easeBack, easeOut3, INK, mix, pulse, rand, WHITE, type Rect } from './shared';
import { hdFor, screenCovered } from './hd-text';
import { ImagePool, ribbon, strip, tag, TextPool } from './ui';

type G = Phaser.GameObjects.Graphics;
type Face = readonly [number, number, number, number];

// depths: the loot screen owns 31.6-31.95 (over the fight HUD and the bar, under the story box)
const D = {
  back: 31.6, // the dim, rays
  light: 31.61, // beams, halos, glows (additive)
  cells: 31.65,
  icons: 31.7,
  front: 31.72, // flashes, badges, motes
  text: 31.75,
  cardBack: 31.8, // the card's dark
  cardLight: 31.805, // its rays and bloom (additive)
  card: 31.83, // the frame, ribbon, panels
  cardIcon: 31.85,
  cardFront: 31.87,
  cardText: 31.9,
};

/** Timing (ms). */
const T = {
  ignore: 400, // taps this soon after the screen comes up do nothing
  firstLaunch: 380, // the ball of light swells, then the first item bursts out
  step: 180, // between items
  fly: 480, // an item's flight to its slot
  cardAfter: 700, // a Legendary or Mythic's card comes up this long after it lands (its burst plays first)
  cardAfterFast: 350,
  cardIn: 450, // a card ignores taps while it pops in
  cardOut: 200,
  doneWait: 250, // "Tap to continue" shows (and works) this long after the last item
};

/** Per rarity (Common .. Mythic): the beam's width at its flash, how bright it stays, sparkles rising in it per second. */
const BEAM_W = [3, 4, 5, 7, 10, 12];
const BEAM_REST = [0.0, 0.4, 0.55, 0.68, 0.82, 0.9];
const MOTES_PER_S = [0, 1.5, 3, 6, 11, 16];
const CELL = 22;

interface Drop {
  item: Item;
  r: number; // rarity index 0..5
  face: Face;
  slot: number;
  x: number; // slot centre
  launchAt: number; // performance.now it burst out (0 = not yet)
  landAt: number;
  landed: boolean; // its landing (flash, sound) has played
  carded: boolean; // its reveal card was dismissed (Legendary and Mythic)
  cardAfter: number;
  salvaged: boolean; // the bag was full: it went straight to scrap
  upgrade: boolean; // better than what Rowan wears in its slot
  worn: boolean; // it went straight on (an empty slot: run.lootWorn)
  lines: string[]; // its name, in one or two lines
  moteAt: number; // the next sparkle in its beam
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  born: number;
  life: number;
  color: number;
  kind: 'spark' | 'dot' | 'ember';
}

export class LootView {
  private g!: G; // dim, rays, the ball of light
  private gl!: G; // additive light: beams, halos
  private gc!: G; // the item cells
  private gf!: G; // flashes, badges, motes, prompt
  private gCardB!: G;
  private gCardL!: G;
  private gCard!: G;
  private gCardF!: G;
  private texts: TextPool;
  private cardTexts: TextPool;
  private pool: ImagePool;
  private chest: Phaser.GameObjects.Image | null = null;

  private drops: Drop[] = [];
  private startAt = 0;
  private next = 0; // the next drop to burst out
  private nextAt = 0;
  private card: { d: Drop; at: number; outAt: number } | null = null;
  private doneAt = 0;
  private src = { x: GAME_W / 2, y: 80 };
  private fromChest = false;
  private motes: Mote[] = [];
  private cardMotes: Mote[] = [];
  private orbPopAt = 0; // the ball of light bursts after the last item leaves it
  private shakeUntil = 0;
  private shakeMag = 0;
  private flashAt = -1e9;
  private flashCol = WHITE;
  private leaving = false;

  constructor(private readonly s: FightScene) {
    this.texts = new TextPool(s, D.text);
    this.cardTexts = new TextPool(s, D.cardText);
    this.pool = new ImagePool(s);
  }

  build(): void {
    for (const g of this.layers()) g?.destroy();
    const add = (d: number, additive = false) => {
      const g = this.s.add.graphics().setDepth(d);
      if (additive) g.setBlendMode(Phaser.BlendModes.ADD);
      return g;
    };
    this.g = add(D.back);
    this.gl = add(D.light, true);
    this.gc = add(D.cells);
    this.gf = add(D.front);
    this.gCardB = add(D.cardBack);
    this.gCardL = add(D.cardLight, true);
    this.gCard = add(D.card);
    this.gCardF = add(D.cardFront);
    this.pool.destroy();
    // the layout rebuilt the textures: a chest on screen comes back with the next phase change
    this.chest?.destroy();
    this.chest = null;
  }

  private layers(): G[] {
    return [this.g, this.gl, this.gc, this.gf, this.gCardB, this.gCardL, this.gCard, this.gCardF];
  }

  onPhase(next: string, prev = ''): void {
    if (next !== 'loot') {
      this.chest?.destroy();
      this.chest = null;
      this.drops = [];
      this.card = null;
      this.motes = [];
      this.cardMotes = [];
      if (next !== 'boost') this.exiting = null;
      return;
    }
    this.exiting = null;
    this.start(prev === 'treasure');
  }

  /** Every item has landed and no reveal card is up ("Tap to continue" is showing): a tip may come up (view/tips.ts). */
  revealDone(): boolean {
    return !!this.doneAt && !this.card;
  }

  /** Collected: the items fly off into Rowan's bag (his portrait), over the boost pick coming up. */
  private exiting: { at: number; items: Array<{ item: Item; x: number; y: number; face: Face; done: boolean }> } | null = null;

  private drawExit(now: number): void {
    const ex = this.exiting;
    if (!ex) return;
    const s = this.s;
    const tx = s.L + 14;
    const ty = 14;
    let alive = false;
    ex.items.forEach((it, i) => {
      const k = (now - ex.at - i * 45) / 340;
      if (k < 0) return void (alive = true);
      if (k >= 1) {
        if (!it.done) {
          it.done = true;
          s.app.audio.coinTick(i * 2);
          this.burst(tx, ty, it.face, 8, 0.6);
        }
        return;
      }
      alive = true;
      const e = k * k;
      const x = it.x + (tx - it.x) * e;
      const y = it.y + (ty - it.y) * e - Math.sin(k * Math.PI) * 14;
      const size = Math.max(6, Math.round(CELL - (CELL - 8) * e));
      const r: Rect = { x: Math.round(x - size / 2), y: Math.round(y - size / 2), w: size, h: size };
      this.gl.fillStyle(it.face[1], 0.22 * (1 - e));
      this.gl.fillCircle(Math.round(x), Math.round(y), Math.round(size * 0.8));
      itemCell(this.gc, r, it.item.rarity);
      if (size >= 12) cellIcon(this.pool, it.item, r, D.icons);
      if (Math.random() < 0.7) this.motes.push({ x, y, vx: rand(-12, 12), vy: rand(-12, 12), g: 0, born: now, life: rand(160, 300), color: Math.random() < 0.5 ? it.face[0] : WHITE, kind: 'dot' });
    });
    this.drawMoteList(this.gf, this.motes, now);
    if (!alive && !this.motes.length) this.exiting = null;
  }

  /** The loot screen comes up: lay out the row, find where the items burst from. */
  private start(fromChest: boolean): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const now = performance.now();
    this.startAt = now;
    this.next = 0;
    this.nextAt = now + T.firstLaunch;
    this.card = null;
    this.doneAt = 0;
    this.motes = [];
    this.cardMotes = [];
    this.orbPopAt = 0;
    this.leaving = false;
    this.fromChest = fromChest;
    // rarest last: the best one gets the last word (and its card)
    const items = run.loot.map((item, i) => ({ item, i })).sort((a, b) => rarityIndex(a.item.rarity) - rarityIndex(b.item.rarity) || a.i - b.i);
    // slots as wide as their names need (names split in two lines when the row is crowded), centred as a row
    const n = items.length;
    const L = s.L + 4;
    const R = s.R - 4;
    const even = Math.min(84, Math.floor((R - L) / Math.max(1, n)));
    const lines = items.map(({ item }) => splitName(itemName(item), even - 6));
    const need = lines.map((ls) => Math.max(...ls.map((l) => textWidth(l, 1, false))) + 6);
    let widths = need.map((w) => Math.max(even, w));
    if (widths.reduce((a, b) => a + b, 0) > R - L) widths = need.map((w) => Math.max(CELL + 10, w));
    const total = widths.reduce((a, b) => a + b, 0);
    let left = Math.round((L + R) / 2 - total / 2);
    const xs = widths.map((w) => {
      const x = Math.round(left + w / 2);
      left += w;
      return x;
    });
    this.drops = items.map(({ item }, slot) => {
      const r = rarityIndex(item.rarity);
      const inBag = !!itemByUid(app.profile, item.uid);
      const cur = inBag ? replaces(app.profile, app.tuning, item).item : undefined;
      return {
        item,
        r,
        face: rarityFace(item.rarity),
        slot,
        x: xs[slot],
        launchAt: 0,
        landAt: 0,
        landed: false,
        carded: r < 4,
        cardAfter: T.cardAfter,
        salvaged: !inBag,
        upgrade: inBag && (!cur || itemPower(app.tuning, item) > itemPower(app.tuning, cur)),
        worn: inBag && app.run.lootWorn.includes(item.uid),
        lines: lines[slot],
        moteAt: 0,
      };
    });
    // where they burst from: the open chest, or where the last foe fell
    this.chest?.destroy();
    this.chest = null;
    if (fromChest) {
      this.chest = s.add.image(GAME_W / 2, s.ground, 'chest_open').setOrigin(0.5, 1).setScale(2);
      s.actors.add(this.chest);
      this.src = { x: Math.round(GAME_W / 2), y: s.ground - 22 };
    } else {
      let best: { x: number; y: number; at: number } | null = null;
      for (const v of s.fighters.enemies.values()) {
        if (!v.dieAt || (best && v.dieAt < best.at)) continue;
        best = { x: v.x, y: v.y - v.img.displayHeight / 2, at: v.dieAt };
      }
      this.src = best ? { x: Math.round(best.x), y: Math.round(Math.min(best.y, s.ground - 14)) } : { x: Math.round(GAME_W / 2 + 44), y: s.ground - 16 };
    }
  }

  // ------------------------------------------------------------------ layout

  private rowY(): number {
    return Math.round(Math.min(56, this.s.ground - 34));
  }

  private cellRect(d: Drop, size = CELL): Rect {
    const y = this.rowY();
    return { x: Math.round(d.x - size / 2), y: Math.round(y - size / 2), w: size, h: size };
  }

  // ------------------------------------------------------------------ taps

  /** A tap on the loot screen: fast-forward the burst, dismiss a reveal card, or collect and move on. */
  tap(_x: number, _y: number): void {
    const s = this.s;
    const app = s.app;
    const now = performance.now();
    if (this.leaving || now - this.startAt < T.ignore) return;
    if (this.card) {
      if (!this.card.outAt && now - this.card.at > T.cardIn) {
        this.card.outAt = now;
        app.audio.panelClose();
      }
      return;
    }
    if (!this.doneAt) {
      // land everything that's still to come, right now (the cards still come up, one after another)
      let best = -1;
      for (const d of this.drops) {
        if (d.landed) {
          // a Legendary waiting for its card: bring the card up now
          if (!d.carded) d.cardAfter = Math.min(d.cardAfter, Math.max(0, now - d.landAt));
          continue;
        }
        if (!d.launchAt) {
          d.launchAt = now - T.fly;
          best = Math.max(best, d.r);
        }
        d.landAt = Math.min(d.landAt || now, now);
        d.cardAfter = T.cardAfterFast;
      }
      if (this.next < this.drops.length) this.orbPopAt = now;
      this.next = this.drops.length;
      if (best >= 0) app.audio.lootDrop(best);
      return;
    }
    if (now - this.doneAt < T.doneWait) return;
    this.leaving = true;
    app.audio.uiClick();
    const y = this.rowY();
    const items = this.drops.filter((d) => !d.salvaged).map((d) => ({ item: d.item, x: d.x, y, face: d.face, done: false }));
    app.setPhase(() => app.run.collectLoot());
    this.exiting = items.length ? { at: now, items } : null;
  }

  // ------------------------------------------------------------------ the show

  /** Bursts, landings and cards, as time passes. */
  private update(now: number): void {
    const s = this.s;
    const audio = s.app.audio;
    // a Legendary or Mythic out and its card not yet dismissed holds the rest back
    const held = this.drops.some((d) => d.launchAt && !d.carded);
    if (!held && this.next < this.drops.length && now >= this.nextAt) {
      const d = this.drops[this.next++];
      d.launchAt = now;
      d.landAt = now + T.fly;
      this.nextAt = now + T.step;
      audio.lootDrop(d.r);
      this.burst(this.src.x, this.src.y, d.face, 10 + d.r * 4, 1);
      if (this.next >= this.drops.length) this.orbPopAt = d.landAt - 120;
    }
    for (const d of this.drops) {
      if (!d.launchAt || d.landed || now < d.landAt) continue;
      d.landed = true;
      this.land(d, now);
    }
    if (!this.card) {
      const c = this.drops.find((d) => d.landed && !d.carded && now >= d.landAt + d.cardAfter);
      if (c) {
        this.card = { d: c, at: now, outAt: 0 };
        audio.legendaryReveal(c.r >= 5);
        this.flashAt = now;
        this.flashCol = c.face[0];
      }
    } else if (this.card.outAt && now - this.card.outAt >= T.cardOut) {
      this.card.d.carded = true;
      this.card = null;
      this.nextAt = Math.max(this.nextAt, now + 260);
    }
    if (!this.doneAt && this.next >= this.drops.length && !this.card && this.drops.every((d) => d.landed && d.carded)) this.doneAt = now;
  }

  /** An item lands in its slot: a flash, a ring of sparks, the beam shoots up; Epic and up get a sting. */
  private land(d: Drop, now: number): void {
    const audio = this.s.app.audio;
    const y = this.rowY();
    if (d.r >= 3) audio.lootSting(d.r);
    this.burst(d.x, y, d.face, 8 + d.r * 5, 0.8 + d.r * 0.12);
    if (d.r >= 4) {
      this.flashAt = now;
      this.flashCol = d.face[0];
    }
    // the big ones land with a jolt (the row and the stage behind it)
    if (d.r >= 5) {
      this.shakeUntil = now + 320;
      this.shakeMag = 2;
      this.s.fx.shake(3, 320);
    } else if (d.r >= 4) {
      this.shakeUntil = now + 160;
      this.shakeMag = 1;
      this.s.fx.shake(2, 180);
    }
  }

  /** Sparks and dots flung out in an item's colours. */
  private burst(x: number, y: number, face: Face, n: number, speed: number): void {
    const now = performance.now();
    const cols = [face[0], face[1], WHITE, mix(face[0], WHITE, 0.5)];
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(30, 110) * speed;
      this.motes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 160, born: now, life: rand(260, 560), color: cols[i % cols.length], kind: i % 3 === 0 ? 'spark' : 'dot' });
    }
    if (this.motes.length > 500) this.motes.splice(0, this.motes.length - 500);
  }

  // ------------------------------------------------------------------ the frame

  draw(now: number): void {
    const s = this.s;
    const run = s.app.run;
    for (const g of this.layers()) g.clear();
    this.texts.begin();
    this.cardTexts.begin();
    this.pool.begin();
    // the sharper text (view/hd-text.ts): the row's names under a reveal card go the old way, the card's stay sharp
    const covered = screenCovered(s, now);
    this.texts.hd = hdFor(s, 'cards', covered || !!this.card);
    this.cardTexts.hd = hdFor(s, 'cards', covered);
    if (run.phase === 'loot' && this.drops.length) {
      this.update(now);
      this.drawScreen(now);
      if (this.card) this.drawCard(now, this.card);
    } else if (this.exiting) this.drawExit(now);
    this.pool.end();
    this.texts.end();
    this.cardTexts.end();
  }

  /** The row: dim, title, the ball of light, flights, beams, cells, names, badges, motes, and the prompt. */
  private drawScreen(now: number): void {
    const s = this.s;
    const g = this.g;
    const gl = this.gl;
    const since = now - this.startAt;
    const sh = now < this.shakeUntil ? Math.round(rand(-this.shakeMag, this.shakeMag)) : 0;
    // the dim, darker toward the edges; a mythic on screen pulses red around them
    const da = 0.6 * easeOut3(since / 260);
    g.fillStyle(0x05040a, da);
    g.fillRect(0, 0, GAME_W, GAME_H);
    // the bar's band sinks further back (nothing to do there now)
    g.fillStyle(0x05040a, da * 0.6);
    g.fillRect(0, s.splitY, GAME_W, GAME_H - s.splitY);
    const mythic = this.drops.some((d) => d.r >= 5 && d.landed);
    for (let i = 0; i < 5; i++) {
      const c = mythic ? mix(0x05040a, 0x8a0a1a, 0.6 * pulse(now, 1300)) : 0x05040a;
      g.fillStyle(c, da * 0.3);
      g.fillRect(0, 0, GAME_W, 3 + i * 3);
      g.fillRect(0, GAME_H - 3 - i * 3, GAME_W, 3 + i * 3);
      g.fillRect(0, 0, 5 + i * 5, GAME_H);
      g.fillRect(GAME_W - 5 - i * 5, 0, 5 + i * 5, GAME_H);
    }
    // the title drops in on a ribbon (under the HUD buttons at the top)
    const cx = Math.round((s.L + s.R) / 2);
    const tk = easeBack((since - 80) / 320, 1.6);
    if (tk > 0) {
      const title = this.fromChest ? 'Treasure!' : 'Loot!';
      const tw = textWidth(title, 1, true) + 26;
      const ty = Math.round(19 - (1 - Math.min(1, tk)) * 30);
      ribbon(g, cx, ty, tw, 13, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]], 1, tk > 0.9);
      this.texts.text(title, cx, ty + 6.5, WHITE, { bold: true, ox: 0.5, oy: 0.5, grad: [WHITE, 0xfff0a0] });
    }
    this.drawOrb(now);
    const y = this.rowY();
    // beams first (behind everything else in the row), then flights and cells
    for (const d of this.drops) if (d.landed) this.drawBeam(gl, d, d.x + sh, y, now);
    for (const d of this.drops) {
      if (!d.launchAt) continue;
      if (now < d.landAt) this.drawFlight(d, now);
      else this.drawCell(d, now, sh);
    }
    this.drawMoteList(this.gf, this.motes, now);
    // the flash of a big landing (and of a reveal card coming up)
    const fk = (now - this.flashAt) / 260;
    if (fk >= 0 && fk < 1) {
      this.gf.fillStyle(this.flashCol, 0.45 * (1 - fk));
      this.gf.fillRect(0, 0, GAME_W, GAME_H);
    }
    if (this.doneAt) this.drawPrompt(now);
  }

  /** The ball of light where the items come from: it swells, crackles while they burst out, then pops. */
  private drawOrb(now: number): void {
    const since = now - this.startAt;
    const { x, y } = this.src;
    const best = this.drops.reduce((m, d) => Math.max(m, d.r), 0);
    const tint = best >= 3 ? this.drops[this.drops.length - 1].face : ([0xfff6d0, 0xffe680, 0xd8901c, 0x9a5a14] as const);
    const pk = this.orbPopAt ? (now - this.orbPopAt) / 260 : -1;
    if (pk >= 1) return;
    const grow = easeBack(since / T.firstLaunch, 2);
    const rad = Math.max(0, (pk >= 0 ? 1 + pk * 1.6 : grow) * (5 + Math.min(4, best)) + Math.sin(now / 45) * 0.8);
    const a = pk >= 0 ? 1 - pk : clamp01(since / 120);
    const gl = this.gl;
    for (let i = 0; i < 4; i++) {
      gl.fillStyle(i < 2 ? tint[1] : tint[0], 0.16 * a);
      gl.fillCircle(x, y, Math.max(1, rad * (2.6 - i * 0.45)));
    }
    gl.fillStyle(WHITE, 0.7 * a);
    gl.fillCircle(x, y, Math.max(1, rad * 0.6));
    this.g.fillStyle(WHITE, 0.85 * a);
    this.g.fillCircle(x, y, Math.max(1, Math.round(rad * 0.45)));
    // sparks crackling off it, in the best item's colour once it's Epic or better (a tell: something big inside)
    if (pk < 0 && Math.random() < 0.5) {
      const ang = rand(0, Math.PI * 2);
      this.motes.push({ x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad, vx: Math.cos(ang) * rand(20, 50), vy: Math.sin(ang) * rand(20, 50) - 10, g: 40, born: now, life: rand(200, 380), color: Math.random() < 0.5 ? tint[0] : WHITE, kind: 'spark' });
    }
  }

  /** An item in the air: a small framed cell arcing from the source to its slot, a glowing trail behind it. */
  private drawFlight(d: Drop, now: number): void {
    const k = clamp01((now - d.launchAt) / (d.landAt - d.launchAt));
    const y1 = this.rowY();
    const arc = 26 + d.r * 4;
    const at = (q: number) => {
      const e = 1 - (1 - q) * (1 - q) * 0.6 - 0.4 * (1 - q); // fast off the mark, easing in
      return { x: this.src.x + (d.x - this.src.x) * e, y: this.src.y + (y1 - this.src.y) * q - Math.sin(q * Math.PI) * arc };
    };
    const gl = this.gl;
    for (let j = 6; j >= 1; j--) {
      const p = at(Math.max(0, k - j * 0.035));
      gl.fillStyle(j < 3 ? d.face[0] : d.face[1], 0.5 * (1 - j / 7));
      gl.fillCircle(Math.round(p.x), Math.round(p.y), Math.max(1, 4 - j * 0.5));
    }
    const p = at(k);
    gl.fillStyle(d.face[1], 0.35);
    gl.fillCircle(Math.round(p.x), Math.round(p.y), 9);
    const size = 14 + Math.round(k * 4);
    const r: Rect = { x: Math.round(p.x - size / 2), y: Math.round(p.y - size / 2), w: size, h: size };
    itemCell(this.gc, r, d.item.rarity);
    cellIcon(this.pool, d.item, r, D.icons);
    if (Math.random() < 0.6) this.motes.push({ x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), vx: rand(-10, 10), vy: rand(-10, 10), g: 0, born: now, life: rand(160, 300), color: Math.random() < 0.5 ? d.face[0] : WHITE, kind: 'dot' });
  }

  /** A pillar of light in the rarity's colour through a landed item: it shoots up on landing, flares, then settles
   *  (a Common's fades away). Sparkles rise in it; a shimmer runs up it; Epic and up get rays behind the item. */
  private drawBeam(gl: G, d: Drop, x: number, y: number, now: number): void {
    const s = this.s;
    const age = now - d.landAt;
    const r = d.r;
    const [hi, base] = d.face;
    let I = age < 80 ? age / 80 : 1 + (BEAM_REST[r] - 1) * easeOut3((age - 80) / (r === 0 ? 500 : 1000));
    if (r === 0) I *= 0.55;
    if (r >= 5) I *= 0.85 + 0.3 * Math.random(); // a Mythic flickers
    if (I <= 0.01) return;
    const w = BEAM_W[r] * (0.65 + 0.35 * Math.min(1, I)) * (age < 160 ? 1 + 0.6 * (1 - age / 160) : 1);
    const top = Math.round(y - (y + 2) * easeOut3(age / 130));
    const bottom = s.ground + 1;
    const ww = Math.max(1, Math.round(w));
    const wm = Math.max(1, Math.round(w * 0.55));
    const wc = Math.max(1, Math.round(w * 0.2));
    for (let yy = top; yy < bottom; yy += 2) {
      const f = yy < y ? 0.25 + 0.75 * Math.pow((yy - top) / Math.max(1, y - top), 0.8) : 1 - (0.75 * (yy - y)) / Math.max(1, bottom - y);
      const a = I * f;
      gl.fillStyle(base, 0.22 * a);
      gl.fillRect(Math.round(x - ww - 2), yy, ww * 2 + 5, 2);
      gl.fillStyle(base, 0.3 * a);
      gl.fillRect(Math.round(x - ww), yy, ww * 2 + 1, 2);
      gl.fillStyle(hi, 0.38 * a);
      gl.fillRect(Math.round(x - wm), yy, wm * 2 + 1, 2);
      gl.fillStyle(WHITE, 0.45 * a);
      gl.fillRect(Math.round(x - wc), yy, wc * 2 + 1, 2);
    }
    // where the pillar meets the ground
    for (let i = 0; i < 3; i++) {
      gl.fillStyle(base, 0.18 * Math.min(1, I));
      gl.fillEllipse(Math.round(x), bottom - 1, Math.round((ww * 2 + 8) * (1 - i * 0.28)), 4 - i);
    }
    // a halo around the item
    for (let i = 0; i < 3; i++) {
      gl.fillStyle(i ? hi : base, (0.1 + 0.02 * r) * Math.min(1, I + 0.2));
      gl.fillCircle(Math.round(x), y, 9 + r * 2.5 - i * 3 + (r >= 3 ? pulse(now, 1200) * 2 : 0));
    }
    // a shimmer running up the beam
    if (r >= 2) {
      const per = 1500 - r * 120;
      const q = ((age + d.slot * 400) % per) / per;
      if (q < 0.5) {
        const sy = Math.round(y - (y - 4) * (q / 0.5));
        gl.fillStyle(WHITE, 0.4 * (1 - q * 2) * Math.min(1, I + 0.3));
        gl.fillRect(Math.round(x - wm), sy - 5, wm * 2 + 1, 10);
      }
    }
    // rays behind the item (Epic and up); a Mythic's are jagged, flicker and turn both ways
    if (r >= 3) {
      const n = r === 3 ? 8 : r === 4 ? 10 : 12;
      const rad = 24 + (r - 3) * 7 + 2 * pulse(now, 900);
      const ray = (rot: number, len: number, half: number, col: number, a: number) => {
        for (let i = 0; i < n; i++) {
          const a0 = rot + (i / n) * Math.PI * 2;
          const L = len * (r >= 5 ? 0.7 + 0.5 * Math.abs(Math.sin(now / 90 + i * 1.7)) : 1);
          gl.fillStyle(col, a);
          gl.fillTriangle(x, y, Math.round(x + Math.cos(a0 - half) * L), Math.round(y + Math.sin(a0 - half) * L), Math.round(x + Math.cos(a0 + half) * L), Math.round(y + Math.sin(a0 + half) * L));
        }
      };
      const a = 0.3 * Math.min(1, I + 0.2) * clamp01(age / 200);
      ray(now / 1700, rad, 0.11, hi, a);
      if (r >= 5) ray(-now / 1100, rad * 0.8, 0.08, base, a * 1.2);
    }
    // sparkles rising in the beam
    const rate = MOTES_PER_S[r];
    if (rate > 0) {
      d.moteAt ||= now;
      while (d.moteAt <= now) {
        d.moteAt += 1000 / rate;
        const ember = r >= 5 && Math.random() < 0.4;
        this.motes.push({
          x: x + rand(-w, w),
          y: y + rand(-4, 14),
          vx: ember ? rand(-30, 30) : rand(-3, 3),
          vy: ember ? rand(-60, -30) : rand(-34, -16),
          g: ember ? 30 : 0,
          born: now,
          life: rand(500, 1000),
          color: Math.random() < 0.35 ? WHITE : Math.random() < 0.5 ? hi : base,
          kind: ember ? 'ember' : Math.random() < 0.4 ? 'spark' : 'dot',
        });
      }
    }
  }

  /** A landed item: its framed cell (a squash and a flash as it lands), name, NEW badge and upgrade arrow. */
  private drawCell(d: Drop, now: number, sh: number): void {
    const age = now - d.landAt;
    const gc = this.gc;
    const gf = this.gf;
    const sq = age < 180 ? Math.sin((age / 180) * Math.PI) * 4 : 0;
    const base = this.cellRect(d);
    const r: Rect = { x: base.x - Math.round(sq / 2) + sh, y: base.y + Math.round(sq / 2), w: base.w + Math.round(sq), h: base.h - Math.round(sq) };
    if (d.r >= 1 && !d.salvaged) glow(gc, r, d.face[1], (0.35 + 0.25 * pulse(now, 1100, d.slot * 300)) * Math.min(1, 0.4 + d.r * 0.15), 2 + Math.min(2, d.r >> 1));
    itemCell(gc, r, d.item.rarity, { dim: d.salvaged });
    cellIcon(this.pool, d.item, r, D.icons, 1, d.salvaged ? 0.5 : 1);
    // Epic and up: a shimmer slanting across the face now and then
    if (d.r >= 3 && !d.salvaged) {
      const q = ((now + d.slot * 517) % 1800) / 1800;
      if (q < 0.3) {
        const sx = r.x - 8 + (r.w + 16) * (q / 0.3);
        gf.fillStyle(WHITE, 0.35);
        for (let yy = 1; yy < r.h - 1; yy++) {
          const x0 = Math.max(r.x + 1, Math.round(sx + (r.h - yy) * 0.5));
          const x1 = Math.min(r.x + r.w - 1, x0 + 3);
          if (x1 > x0) gf.fillRect(x0, r.y + yy, x1 - x0, 1);
        }
      }
    }
    if (age < 220) {
      gf.fillStyle(WHITE, 0.9 * (1 - age / 220));
      rows(gf, r.x - 1, r.y - 1, r.w + 2, r.h + 2, 2, WHITE, 0.9 * (1 - age / 220));
    }
    // twinkles on the frame (Rare and up)
    if (d.r >= 2 && !d.salvaged)
      for (let i = 0; i < d.r - 1; i++) {
        const q = ((now / 800 + i * 0.37 + d.slot * 0.21) % 1 + 1) % 1;
        if (q > 0.5) continue;
        // somewhere on the frame's edge, a new spot each time it twinkles
        const per = 2 * (r.w + r.h);
        const p = Math.floor((((i * 53 + Math.floor(now / 800 + i * 0.37) * 29) % per) + per) % per);
        const [px, py] =
          p < r.w ? [r.x + p, r.y - 1] : p < r.w + r.h ? [r.x + r.w, r.y + p - r.w] : p < 2 * r.w + r.h ? [r.x + r.w - (p - r.w - r.h), r.y + r.h] : [r.x - 1, r.y + r.h - (p - 2 * r.w - r.h)];
        star(gf, px, py, q < 0.25 ? 2 : 1, q < 0.25 ? WHITE : d.face[0], 1 - q * 2);
      }
    // the name (one or two lines), sliding up into place
    const nk = clamp01((age - 60) / 200);
    if (nk > 0) {
      const ny = base.y + base.h + 7 + Math.round((1 - easeOut3(nk)) * 4);
      const col = d.salvaged ? 0x8a84a0 : rarityText(d.item.rarity);
      // a dark plate under the name keeps it readable over the stage
      const nLines = d.lines.length + (d.r >= 2 && !d.salvaged ? 1 : 0);
      const pw = Math.max(...d.lines.map((l) => textWidth(l, 1, false))) + 6;
      rows(gc, Math.round(d.x + sh - pw / 2), ny - 5, pw, nLines * 8 + 2, 2, 0x05040a, 0.55 * nk);
      d.lines.forEach((line, i) => this.texts.text(line, d.x + sh, ny + i * 8, col, { ox: 0.5, oy: 0.5, alpha: nk }));
      if (d.r >= 2 && !d.salvaged) {
        const label = RARITY_INFO[d.item.rarity].name;
        const ly = ny + d.lines.length * 8;
        this.texts.text(label, d.x + sh, ly, mix(d.face[0], WHITE, 0.3), { ox: 0.5, oy: 0.5, alpha: nk * 0.75 });
      }
    }
    // NEW (or "Worn" for one that went straight on, "Scrap" for one the full bag couldn't take): a tag on the
    // top-right corner that pops on
    const bk = easeBack((age - 120) / 220, 2.2);
    if (bk > 0) {
      const label = d.salvaged ? 'Scrap' : d.worn ? 'Worn' : 'NEW';
      const tw = textWidth(label, 1, false) + 4;
      const tr: Rect = { x: base.x + base.w - tw + 5 + sh, y: base.y - 5 - Math.round((1 - Math.min(1, bk)) * 4), w: tw, h: 8 };
      tag(gf, tr, d.salvaged ? [0xb8c2d8, 0x7c86a6, 0x4a5272, 0x2a2f45] : d.worn ? [0xb4f070, 0x4caf3c, 0x2c7a2a, 0x164a1a] : [0xff9a80, 0xe0463c, 0xa8202c, 0x6a0f1e]);
      if (!d.salvaged && pulse(now, 900, d.slot * 200) > 0.8) {
        gf.fillStyle(WHITE, 0.35);
        gf.fillRect(tr.x, tr.y, tr.w, tr.h);
      }
      this.texts.text(label, tr.x + tr.w / 2, tr.y + 4, WHITE, { ox: 0.5, oy: 0.5 });
    }
    // better than what Rowan wears: a green arrow bobbing on the top-left corner
    if (d.upgrade && bk > 0) {
      const ax = base.x - 4 + sh;
      const ay = base.y - 4 - (Math.floor(now / 260) % 2);
      upArrow(gf, ax, ay);
    }
  }

  /** Sparks, dots and embers flying (the row's on the row's layer, the card's over its dark). */
  private drawMoteList(g: G, list: Mote[], now: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      const age = (now - m.born) / 1000;
      const k = (age * 1000) / m.life;
      if (k >= 1) {
        this.motes.splice(i, 1);
        continue;
      }
      if (k < 0) continue;
      const x = Math.round(m.x + m.vx * age);
      const y = Math.round(m.y + m.vy * age + 0.5 * m.g * age * age);
      const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      if (m.kind === 'spark') {
        star(g, x, y, k < 0.4 ? 1 : 0, m.color, a);
      } else if (m.kind === 'ember') {
        g.fillStyle(m.color, a);
        g.fillRect(x, y, 1, 2);
      } else {
        g.fillStyle(m.color, a);
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  /** "Tap to continue" on a strip over the band, with chevrons sliding in; a note if the bag was full. */
  private drawPrompt(now: number): void {
    const s = this.s;
    const g = this.gf;
    const k = clamp01((now - this.doneAt) / 220);
    const cy = Math.round(s.splitY + 16);
    const text = 'Tap to continue';
    const w = textWidth(text, 1, true);
    const cx = Math.round((s.L + s.R) / 2);
    strip(g, 0, cy - 9, GAME_W, 18, 0.85 * k);
    const p = pulse(now, 900);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const q = ((now / 600 + i / 3) % 1 + 1) % 1;
        const x = Math.round(cx + side * (w / 2 + 22 - q * 12));
        chevron(g, x, cy - 4, 9, i === 0 ? GOLD[4] : GOLD[3], k * Math.sin(q * Math.PI), -side, true);
      }
    this.texts.text(text, cx, cy + 0.5, mix(0xfff07a, WHITE, 0.5 * p), { bold: true, ox: 0.5, oy: 0.5, alpha: k * (0.8 + 0.2 * p) });
    const scrap = this.s.app.run.lootSalvaged;
    if (scrap > 0) {
      const line = `Bag full! Salvaged into ${whole(scrap)} scrap`;
      const lw = textWidth(line, 1, false) + 16;
      const tr: Rect = { x: Math.round(cx - lw / 2), y: s.splitY - 13, w: lw, h: 10 };
      tag(g, tr, [0xff9a80, 0x7a1a22, 0x5a1020, 0x3a0a14], k);
      hudIcon(g, 'scrap', tr.x + 3, tr.y + 2, 1, k);
      this.texts.text(line, tr.x + 13, tr.y + 5, 0xffd0c0, { oy: 0.5, alpha: k });
    }
  }

  // ------------------------------------------------------------------ the reveal card

  /** A Legendary or Mythic, full screen: the dark, rays turning in its colour, the icon at 2x in an ornate frame with
   *  the rarity's ribbon across its foot, "Signature drop!" beside it, then the name, what it is, its stats and its
   *  unique effect. (Everything sits under the HUD buttons at the top centre.) */
  private drawCard(now: number, c: { d: Drop; at: number; outAt: number }): void {
    const s = this.s;
    const d = c.d;
    const item = d.item;
    const face = d.face;
    const [hi, base, lo, deep] = face;
    const mythic = d.r >= 5;
    const g = this.gCard;
    const gl = this.gCardL;
    const gf = this.gCardF;
    const k = now - c.at;
    const out = c.outAt ? clamp01((now - c.outAt) / T.cardOut) : 0;
    const A = 1 - out;
    const cx = Math.round((s.L + s.R) / 2);
    const cy = 42; // the frame's centre
    const FR = 36; // the frame's well
    // the dark, tinted with the rarity's deepest tone
    const gb = this.gCardB;
    gb.fillStyle(mix(0x05040a, deep, 0.3), 0.92 * easeOut3(k / 200) * A);
    gb.fillRect(0, 0, GAME_W, GAME_H);
    // rays turning behind the frame (a Mythic's: a third set turning against them, jagged and flickering)
    const rk = easeOut3((k - 60) / 500) * A;
    const rays = (n: number, rot: number, half: number, col: number, a: number, jag: boolean) => {
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * Math.PI * 2;
        const L = 260 * (jag ? 0.45 + 0.55 * Math.abs(Math.sin(now / 130 + i * 2.1)) : 1);
        gl.fillStyle(col, a);
        gl.fillTriangle(cx, cy, Math.round(cx + Math.cos(a0 - half) * L), Math.round(cy + Math.sin(a0 - half) * L), Math.round(cx + Math.cos(a0 + half) * L), Math.round(cy + Math.sin(a0 + half) * L));
      }
    };
    rays(16, now / 3200, 0.07, base, 0.1 * rk, false);
    rays(16, now / 3200 + Math.PI / 16, 0.035, hi, 0.08 * rk, false);
    if (mythic) rays(9, -now / 1700, 0.06, mix(base, WHITE, 0.25), (0.07 + 0.07 * Math.random()) * rk, true);
    // a bloom behind the frame
    for (let i = 0; i < 4; i++) {
      gl.fillStyle(i < 2 ? base : hi, 0.09 * rk);
      gl.fillCircle(cx, cy, 40 - i * 8 + 2 * pulse(now, 1000));
    }
    // embers drifting up (a Mythic throws more, redder)
    if (A > 0.5 && Math.random() < (mythic ? 0.9 : 0.5))
      this.cardMotes.push({ x: rand(s.L, s.R), y: GAME_H + 2, vx: rand(-8, 8), vy: rand(-60, -30), g: 0, born: now, life: rand(1400, 2600), color: Math.random() < 0.5 ? hi : base, kind: mythic ? 'ember' : 'dot' });
    this.drawMoteList(gb, this.cardMotes, now);
    // the frame pops in, with the icon at 2x
    const pk = easeBack(k / 320, 1.8) * (1 + 0.15 * out);
    const size = Math.max(2, Math.round(FR * pk));
    if (pk > 0.05) {
      ornateFrame(g, cx, cy, size, face, A);
      const iconScale = Math.max(0.5, 2 * Math.min(1, pk));
      const isz = 12 * iconScale;
      cellIcon(this.pool, item, { x: Math.round(cx - isz / 2), y: Math.round(cy - isz / 2), w: isz, h: isz }, D.cardIcon, iconScale, A);
      // a shimmer across the frame now and then, and twinkles orbiting it
      const q = ((k + 300) % 1600) / 1600;
      if (q < 0.25 && k > 320) {
        const sx = cx - size / 2 - 10 + (size + 20) * (q / 0.25);
        gf.fillStyle(WHITE, 0.3 * A);
        for (let yy = -size / 2 + 1; yy < size / 2 - 1; yy++) {
          const x0 = Math.max(cx - size / 2 + 1, Math.round(sx + (size / 2 - yy) * 0.5));
          const x1 = Math.min(cx + size / 2 - 1, x0 + 5);
          if (x1 > x0) gf.fillRect(x0, Math.round(cy + yy), x1 - x0, 1);
        }
      }
      for (let i = 0; i < 6; i++) {
        const ang = now / (mythic ? 520 : 760) + (i / 6) * Math.PI * 2;
        const rr = size * 0.5 + 10 + 2 * Math.sin(now / 200 + i);
        const tw = pulse(now, 600, i * 170);
        star(gf, Math.round(cx + Math.cos(ang) * rr), Math.round(cy + Math.sin(ang) * rr * 0.9), tw > 0.6 ? 2 : 1, tw > 0.6 ? WHITE : hi, A * (0.5 + 0.5 * tw));
      }
    }
    // the rarity's ribbon unfurls across the frame's foot
    const rib = easeOut3((k - 140) / 220);
    const label = RARITY_INFO[item.rarity].name.toUpperCase();
    const ry = cy + FR / 2 - 2;
    if (rib > 0) {
      const rw = Math.round((textWidth(label, 1, true) + 30) * rib);
      if (rw > 8) ribbon(g, cx, ry, rw, 13, [hi, base, lo, deep], A, rib > 0.85);
      if (rib > 0.8) this.cardTexts.text(label, cx, ry + 6.5, WHITE, { bold: true, ox: 0.5, oy: 0.5, alpha: A, grad: [WHITE, mix(hi, WHITE, 0.5)] });
    }
    // a boss's signature drop: a gold badge beside the frame
    const sig = BASE_BY_ID[item.base]?.signature;
    const sb = easeBack((k - 520) / 280, 2.4);
    if (sig && sb > 0) {
      const t = 'Signature drop!';
      const sw = textWidth(t, 1, true) + 18;
      const tr: Rect = { x: cx + FR / 2 + 14, y: cy - 12 - Math.round((1 - Math.min(1, sb)) * 8), w: sw, h: 12 };
      const a = clamp01(sb) * A;
      glow(g, tr, GOLD[3], (0.4 + 0.3 * pulse(now, 700)) * a, 2);
      tag(g, tr, [GOLD[4], GOLD[3], GOLD[2], GOLD[1]], a);
      hudIcon(g, 'star', tr.x + 3, tr.y + 2, 1, a);
      this.cardTexts.text(t, tr.x + 14, tr.y + 6, 0x5a3410, { bold: true, oy: 0.5, alpha: a, grad: [0x6a3a10, 0x4a2a08], plain: true });
      const q = ((now / 900) % 1 + 1) % 1;
      if (q < 0.4) star(gf, tr.x + 6 + Math.round((tr.w - 10) * (q / 0.4)), tr.y, 1, WHITE, a * (1 - q / 0.4));
    }
    // the name, big, then what it is, its stats and its effect, one after another
    const line = (at: number) => clamp01((k - at) / 160) * A;
    let y = ry + 22;
    const nameA = line(220);
    if (nameA > 0) {
      const name = itemName(item);
      const sc = textWidth(name, 2, true) <= s.R - s.L - 12 ? 2 : 1;
      this.cardTexts.text(name, cx, y + Math.round((1 - nameA) * 6), rarityText(item.rarity), { bold: true, scale: sc, ox: 0.5, oy: 0.5, alpha: nameA, extrude: 1, extrudeCol: deep });
    }
    y += 14;
    const kindA = line(330);
    if (kindA > 0) this.cardTexts.text(itemKind(item), cx, y, 0xdcd8f0, { ox: 0.5, oy: 0.5, alpha: kindA });
    y += 10;
    const statA = line(400);
    // (the big HUD icons, like the heart, don't fit the line: those stats go without one); more than three: the three
    // biggest, then "+N more" (the bag lists them all)
    const all = itemLines(s.app.tuning, item)
      .filter((l) => l.stat)
      .map((l) => (l.icon && iconSize(l.icon)[1] > 9 ? { ...l, icon: undefined } : l));
    const big = (l: (typeof all)[number]) => statSize(s.app.tuning, l.stat!, l.value ?? 0);
    const stats = all.length > 3 ? [...[...all].sort((a, b) => big(b) - big(a)).slice(0, 3), { text: `+${all.length - 3} more`, color: 0xa8a0c8 }] : all;
    if (statA > 0 && stats.length) {
      const parts = stats;
      const iw = (p: (typeof parts)[number]) => (p.icon ? iconSize(p.icon)[0] + 2 : 0);
      const total = parts.reduce((a, p) => a + iw(p) + textWidth(p.text, 1, false), 0) + (parts.length - 1) * 8;
      let x = Math.round(cx - total / 2);
      for (const p of parts) {
        if (p.icon) {
          const [w, h] = iconSize(p.icon);
          hudIcon(gf, p.icon, x, Math.round(y - h / 2), 1, statA);
          x += w + 2;
        }
        this.cardTexts.text(p.text, x, y, p.color, { oy: 0.5, alpha: statA });
        x += textWidth(p.text, 1, false) + 8;
      }
    }
    y += 11;
    const eff = item.effect ? EFFECTS[item.effect] : null;
    const effA = line(480);
    if (eff && effA > 0) {
      // "Name: what it does" on one line if it fits inside the safe area, else the name over the text (split in two
      // if it's still too wide)
      const nm = `${eff.name}:`;
      const nw = textWidth(nm, 1, true);
      const room = s.R - s.L - 16;
      const one = nw + 4 + textWidth(eff.text, 1, false) <= room;
      const textLines = one ? [eff.text] : splitName(eff.text, room);
      const tws = textLines.map((t) => textWidth(t, 1, false));
      const w = one ? nw + 4 + tws[0] : Math.max(nw, ...tws);
      const h = one ? 13 : 13 + textLines.length * 9;
      const er: Rect = { x: Math.round(cx - w / 2) - 5, y: y - 6, w: w + 10, h };
      rows(g, er.x - 1, er.y - 1, er.w + 2, er.h + 2, 3, INK, 0.9 * effA);
      rows(g, er.x, er.y, er.w, er.h, 2, mix(deep, INK, 0.4), effA);
      band(g, er.x, er.y, er.w, er.h, 2, 0, 1, mix(base, INK, 0.1), effA);
      if (one) {
        const ex = Math.round(cx - w / 2);
        this.cardTexts.text(nm, ex, y + 0.5, 0xffb060, { bold: true, oy: 0.5, alpha: effA });
        this.cardTexts.text(eff.text, ex + nw + 4, y + 0.5, WHITE, { oy: 0.5, alpha: effA });
      } else {
        this.cardTexts.text(nm, cx, y + 0.5, 0xffb060, { bold: true, ox: 0.5, oy: 0.5, alpha: effA });
        textLines.forEach((t, i) => this.cardTexts.text(t, cx, y + 11 + i * 9, WHITE, { ox: 0.5, oy: 0.5, alpha: effA }));
      }
    }
    // the hint, once it can be dismissed
    if (k > T.cardIn + 250 && !c.outAt) {
      const hy = Math.min(s.B, GAME_H) - 5;
      this.cardTexts.text('Tap to continue', cx, hy, 0xfff0c0, { bold: true, ox: 0.5, oy: 0.5, alpha: 0.8 + 0.2 * pulse(now, 900) });
    }
  }
}
// ------------------------------------------------------------------ drawing helpers

/** A name in one line, or two (split at the space nearest the middle) when it is wider than `w`. */
export function splitName(name: string, w: number): string[] {
  if (textWidth(name, 1, false) <= w || !name.includes(' ')) return [name];
  const words = name.split(' ');
  let best: string[] = [name];
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const m = Math.max(textWidth(a, 1, false), textWidth(b, 1, false));
    if (m < bestW) [best, bestW] = [[a, b], m];
  }
  return best;
}

/** A four-point twinkle (size 0 = a single pixel). */
export function star(g: G, x: number, y: number, size: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  if (size <= 0) return void g.fillRect(x, y, 1, 1);
  g.fillRect(x - size, y, size * 2 + 1, 1);
  g.fillRect(x, y - size, 1, size * 2 + 1);
  if (size >= 2) {
    g.fillStyle(WHITE, alpha);
    g.fillRect(x - 1, y - 1, 3, 3);
  }
}

/** A small green arrow pointing up, ink-outlined (an upgrade). */
function upArrow(g: G, x: number, y: number): void {
  const shape = ['..#..', '.###.', '#####', '.###.', '.###.'];
  g.fillStyle(INK, 1);
  shape.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) if (row[xx] === '#') g.fillRect(x + xx - 1, y + yy - 1, 3, 3);
  });
  shape.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      if (row[xx] !== '#') continue;
      g.fillStyle(yy < 2 || xx === 1 ? 0xc8ff8a : yy >= 4 ? 0x2e9a34 : 0x62d444, 1);
      g.fillRect(x + xx, y + yy, 1, 1);
    }
  });
}

/** The reveal card's frame: ink, a gold band with lit and shaded edges, the rarity's rim, a dark well, gold studs at
 *  the corners and a gem in the rarity's colour on top. `size` is the well's side (it can grow as the card pops). */
export function ornateFrame(g: G, cx: number, cy: number, size: number, face: Face, alpha: number): void {
  const [hi, base, lo, deep] = face;
  const x = Math.round(cx - size / 2);
  const y = Math.round(cy - size / 2);
  rows(g, x - 5, y - 3, size + 10, size + 10, 4, INK, 0.5 * alpha); // drop shadow
  rows(g, x - 5, y - 5, size + 10, size + 10, 4, INK, alpha);
  rows(g, x - 4, y - 4, size + 8, size + 8, 3, GOLD[2], alpha);
  band(g, x - 4, y - 4, size + 8, size + 8, 3, 0, 1, GOLD[4], alpha);
  band(g, x - 4, y - 4, size + 8, size + 8, 3, 1, 2, GOLD[3], alpha);
  band(g, x - 4, y - 4, size + 8, size + 8, 3, size + 6, size + 8, GOLD[1], alpha);
  rows(g, x - 2, y - 2, size + 4, size + 4, 2, INK, alpha);
  rows(g, x - 1, y - 1, size + 2, size + 2, 2, base, alpha);
  band(g, x - 1, y - 1, size + 2, size + 2, 2, 0, 1, hi, alpha);
  band(g, x - 1, y - 1, size + 2, size + 2, 2, size + 1, size + 2, deep, alpha);
  // the well: dark, a little of the rarity's colour toward the top
  g.fillStyle(mix(deep, INK, 0.55), alpha);
  g.fillRect(x + 1, y + 1, size - 2, size - 2);
  g.fillStyle(mix(lo, INK, 0.45), alpha);
  g.fillRect(x + 1, y + 1, size - 2, Math.round((size - 2) * 0.45));
  g.fillStyle(mix(lo, INK, 0.3), alpha);
  g.fillRect(x + 1, y + 1, size - 2, Math.max(1, Math.round((size - 2) * 0.15)));
  if (size < 12) return;
  // gold studs at the corners (little diamonds) and the gem on top
  const stud = (sx: number, sy: number) => {
    g.fillStyle(INK, alpha);
    g.fillRect(sx - 2, sy - 1, 5, 3);
    g.fillRect(sx - 1, sy - 2, 3, 5);
    g.fillStyle(GOLD[3], alpha);
    g.fillRect(sx - 1, sy, 3, 1);
    g.fillRect(sx, sy - 1, 1, 3);
    g.fillStyle(GOLD[4], alpha);
    g.fillRect(sx, sy, 1, 1);
  };
  stud(x - 4, y - 4);
  stud(x + size + 3, y - 4);
  stud(x - 4, y + size + 3);
  stud(x + size + 3, y + size + 3);
  const gx = Math.round(cx);
  const gy = y - 5;
  g.fillStyle(INK, alpha);
  g.fillRect(gx - 3, gy - 2, 7, 5);
  g.fillRect(gx - 2, gy - 3, 5, 7);
  g.fillStyle(base, alpha);
  g.fillRect(gx - 2, gy - 1, 5, 3);
  g.fillRect(gx - 1, gy - 2, 3, 5);
  g.fillStyle(hi, alpha);
  g.fillRect(gx - 1, gy - 1, 2, 1);
  g.fillStyle(WHITE, alpha);
  g.fillRect(gx - 1, gy - 1, 1, 1);
  g.fillStyle(deep, alpha);
  g.fillRect(gx, gy + 1, 2, 1);
}
