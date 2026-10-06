// Life on the act map (art-life.ts draws the critters): small things living their lives at the edges of the map,
// per act theme. The Meadow Road has rabbits slipping out of the bushes, sparrows pecking in the grass, a frog on
// the stream bank, fish leaping and a hawk circling high; the Old Ruins a hedgehog snuffling about, crows on the
// stones and moths round the braziers; the Boar King's Hollow a squirrel, a doe at the edge of the trees and spores
// drifting up from the leaf litter. The Frostbite Pass has a mountain goat stepping out from behind the rocks and
// snow buntings pecking in the snow; the Glimmer Caves glow beetles creeping out from the crystals and pale fish
// gliding under the ice of their pools; Wyrm's Glacier snow hares and a white owl gliding in slow circles. Tapped, a critter startles (the rabbit dives back into its bush, the sparrows
// scatter, the frog leaps into the stream, the hedgehog curls up) and Pip chirps.
//
// Now and then something glints in the grass: a tap picks it up for a coin or two (core/sparkle.ts: at most one per
// map step, never the act's first, the same after a reload, never paid twice).
//
// Life stays at the edges of attention: on open ground (land.ground), off the roads, clear of every node, the secret's
// boulder, the HUD (the bounty tracker too) and the screen's edges. Homes are picked once per map, a few more than are
// shown; each step shows the ones clear of the tags, the roamers, Rowan and the tap circles of the nodes he can walk
// to (the others stay in their cover). A tap only reaches life when no node, button or secret took it (input.ts).
import { claimSparkle, mapSparkle, openSparkle, type Sparkle } from '../../core/sparkle';
import type { Theme } from '../backdrop';
import { GAME_H, GAME_W } from '../layout';
import type { FightScene } from '../scene';
import { Burrow, drawPop, drawSparkle, Flock, LifeLayers, overlaps, POP_MS, rnd, sparkleBox, type BurrowSpec, type Pop, type Pt } from './life';
import type { MapView } from './map';
import type { Rect } from './shared';

// depths (the map owns 30.0-30.9): critters on the ground under the node icons (30.5), the ones in the air under the
// cloud shadows (30.78), the pop under the HUD (30.85)
const D_LOW = 30.25;
const D_CRITTER = 30.3;
const D_HIGH = 30.32;
const D_FLY = 30.74;
const D_POP = 30.83;
const D_TEXT = 30.835;

/** A burrowing critter's kind: its frames, gait and the room it needs out in the open. */
interface BurrowKind {
  spec: Omit<BurrowSpec, 'home' | 'out' | 'period' | 'seed'>;
  /** Period range (s). */
  period: [number, number];
  /** The open box it stands in (w x h, feet at the bottom centre) and how far from its cover it comes out. */
  room: [number, number];
  reach: [number, number];
}

const KINDS: Record<string, BurrowKind> = {
  rabbit: { spec: { sprite: 'rabbit', idle: [0, 1], move: [2], flee: 2, gait: 'hop', moveSec: 0.7 }, period: [11, 15], room: [10, 8], reach: [4, 10] },
  hedgehog: { spec: { sprite: 'hedgehog', idle: [0, 1], move: [0, 1], flee: 0, curl: 2, gait: 'walk', moveSec: 1.8 }, period: [16, 21], room: [12, 6], reach: [4, 10] },
  squirrel: { spec: { sprite: 'squirrel', idle: [0, 1], move: [2], flee: 2, gait: 'hop', moveSec: 0.6 }, period: [10, 13], room: [9, 7], reach: [3, 10] },
  deer: { spec: { sprite: 'deer', idle: [0, 1], move: [0, 2], flee: 2, gait: 'walk', moveSec: 1.6 }, period: [18, 24], room: [11, 7], reach: [4, 13] },
  goat: { spec: { sprite: 'goat', idle: [0, 1], move: [2], flee: 2, gait: 'hop', moveSec: 0.8 }, period: [15, 20], room: [12, 8], reach: [4, 12] },
  beetle: { spec: { sprite: 'beetle', idle: [0, 1], move: [0, 1], flee: 0, gait: 'walk', moveSec: 2.4 }, period: [12, 17], room: [8, 5], reach: [3, 9] },
  hare: { spec: { sprite: 'hare', idle: [0, 1], move: [2], flee: 2, gait: 'hop', moveSec: 0.6 }, period: [11, 15], room: [10, 8], reach: [4, 10] },
};

/** What lives on each act's map, and how many of each show at once. */
const THEME_LIFE: Record<Theme, { burrows: Array<[string, number]>; flock: { sprite: string; n: number } | null }> = {
  forest: { burrows: [['rabbit', 2]], flock: { sprite: 'sparrow', n: 4 } },
  ruins: { burrows: [['hedgehog', 1]], flock: { sprite: 'crow', n: 3 } },
  hollow: { burrows: [['squirrel', 1], ['deer', 1]], flock: null },
  pass: { burrows: [['goat', 1]], flock: { sprite: 'bunting', n: 4 } },
  caves: { burrows: [['beetle', 2]], flock: null },
  glacier: { burrows: [['hare', 2]], flock: null },
};

/** The rustle in the cover a critter dove into: leaves, or snow (and frost) shaken loose. */
const RUSTLE: Record<Theme, number> = { forest: 0xb4d058, ruins: 0xb4d058, hollow: 0xb4d058, pass: 0xeef2fa, caves: 0x9ad8f0, glacier: 0xeef2fa };

interface Placed<T> {
  it: T;
  kind: string;
  /** At most this many of its kind show at once (more are placed, so a step whose tags cover one shows another). */
  cap: number;
  /** Everything it covers (out, cover, its tap box): on a step where a tag or Rowan comes near, it stays hidden. */
  area: Rect;
  on: boolean;
}

interface Hawk {
  c: Pt;
  r: number;
  /** The hawk over the meadow, the white owl over the glacier. */
  sprite: string;
}

export class MapLife {
  private readonly L: LifeLayers;
  private placedFor = '';
  private stepFor = '';
  /** Critters with a hiding place (the frog's is the stream). */
  private burrows: Array<Placed<Burrow>> = [];
  private flocks: Array<Placed<Flock>> = [];
  private fish: Array<Placed<Pt>> = [];
  private hawks: Array<Placed<Hawk>> = [];
  private spores: Array<Placed<Pt>> = [];
  /** Open spots the sparkle could be on (feet), and whether each is away from the nodes (preferred). */
  private open: Array<{ at: Pt; calm: boolean }> = [];
  private sparkle: { s: Sparkle; x: number; y: number } | null = null;
  private pop: Pop | null = null;

  constructor(
    private readonly s: FightScene,
    private readonly map: MapView,
  ) {
    this.L = new LifeLayers(s, { low: D_LOW, high: D_HIGH, pop: D_POP, text: D_TEXT });
  }

  build(): void {
    this.L.build();
    this.placedFor = '';
    this.stepFor = '';
  }

  hide(): void {
    this.L.hide();
  }

  // ------------------------------------------------------------------ where things live

  /** The rects life keeps clear of on every step: the HUD, every node's art (`m` px round it), the start, the
   *  secret, the screen's edges. */
  private staticKeep(m = 3): Rect[] {
    const s = this.s;
    const run = s.app.run;
    const out = this.map.hudRects().map((r) => ({ x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }));
    for (const n of run.map.nodes) {
      const b = this.map.nodeBox(n);
      out.push({ x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 });
    }
    const [sx, sy] = this.map.pos(null);
    out.push({ x: sx - 20, y: sy - 24, w: 36, h: 32 });
    // the secret's boulder beside its node (its glow, and the chevron over it when it can be opened)
    const sec = this.map.roam.placeSecret(this.map.roadPixels());
    if (sec) out.push({ x: sec[0] - 14, y: sec[1] - 24, w: 28, h: 30 });
    // the screen's edges (the framing foliage, the island, the rounded corners, the home bar)
    out.push({ x: 0, y: 0, w: GAME_W, h: 13 }, { x: 0, y: s.B - 14, w: GAME_W, h: GAME_H }, { x: 0, y: 0, w: s.L + 9, h: GAME_H }, { x: s.R - 9, y: 0, w: GAME_W, h: GAME_H });
    return out;
  }

  /** Pick homes for this map's critters (once per map and layout). */
  private place(): void {
    const s = this.s;
    const run = s.app.run;
    const land = this.map.landData;
    if (!land) return;
    const key = `${this.map.landGen}|${s.L},${s.R},${s.B}`;
    if (key === this.placedFor) return;
    this.placedFor = key;
    this.stepFor = '';
    this.burrows = [];
    this.flocks = [];
    this.fish = [];
    this.hawks = [];
    this.spores = [];
    const W = GAME_W;
    const H = GAME_H;
    const g = land.ground;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : g[y * W + x]);
    // summed areas of open ground: whether a box is all open in O(1)
    const sat = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) {
      let row = 0;
      for (let x = 0; x < W; x++) {
        row += g[y * W + x] === 1 ? 1 : 0;
        sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
      }
    }
    /** Whether a box is open ground (all of it, or at least `need` of it: a leaf pile or a tuft can be underfoot). */
    const openBox = (x: number, y: number, w: number, h: number, need = 1) => {
      const x0 = Math.round(x);
      const y0 = Math.round(y);
      if (x0 < 0 || y0 < 0 || x0 + w > W || y0 + h > H) return false;
      const S = (xx: number, yy: number) => sat[yy * (W + 1) + xx];
      return S(x0 + w, y0 + h) - S(x0, y0 + h) - S(x0 + w, y0) + S(x0, y0) >= Math.ceil(w * h * need);
    };
    // the critters would rather live away from the nodes (the calm), and settle nearer only when the map is crowded
    const keep = this.staticKeep();
    const calmKeep = this.staticKeep(12);
    const clear = (r: Rect, calm = false) => !(calm ? calmKeep : keep).some((k) => overlaps(r, k));
    const seed = (run.mapSeedFor(run.actIndex) % 100003) + 7;
    const taken: Rect[] = [];
    const free = (r: Rect, gap: number) => !taken.some((t) => overlaps(r, t, gap));
    const theme = this.map.landTheme;
    const life = THEME_LIFE[theme];
    /** Grid spots in a seeded order (the same map always gets the same homes). */
    const spots = (step: number): Pt[] => {
      const out: Pt[] = [];
      for (let y = 14; y < H - 12; y += step) for (let x = 8; x < W - 8; x += step) out.push([x, y]);
      return out.sort((a, b) => rnd(a[0], a[1], seed) - rnd(b[0], b[1], seed));
    };
    const grid = spots(2);
    /** The grid twice: calm spots first, then any. */
    const passes: Array<[Pt, boolean]> = [true, false].flatMap((calm) => grid.map((p): [Pt, boolean] => [p, calm]));

    // critters with a hiding place: an open spot with cover (a bush, a tree, a stone) a few px to one side
    for (const [kind, cap] of life.burrows) {
      const K = KINDS[kind];
      const [rw, rh] = K.room;
      for (const [[x, y], calm] of passes) {
        if (this.burrows.filter((b) => b.kind === kind).length >= cap * 2) break;
        if (!openBox(x - rw / 2, y - rh, rw, rh, 0.85) || at(x, y - 1) !== 1) continue;
        const dir = rnd(x, y, seed + 3) < 0.5 ? -1 : 1;
        let found: Pt | null = null;
        for (const d of [dir, -dir]) {
          let k = 2;
          while (k <= K.reach[1] && at(x + d * k, y - 1) === 1) k++;
          if (k >= K.reach[0] && k <= K.reach[1] && at(x + d * k, y - 1) === 2) {
            found = [Math.round(x + d * (k + 2)), y];
            break;
          }
        }
        if (!found) continue;
        const area: Rect = { x: Math.min(x, found[0]) - 8, y: y - rh - 6, w: Math.abs(found[0] - x) + 16, h: rh + 9 };
        if (!clear(area, calm) || !free(area, 12)) continue;
        taken.push(area);
        const i = this.burrows.length;
        const P = K.period[0] + rnd(i, 1, seed) * (K.period[1] - K.period[0]);
        this.burrows.push({ it: new Burrow({ ...K.spec, home: found, out: [x, y], period: P, seed: rnd(i, 2, seed) }), kind, cap, area, on: true });
      }
    }

    // a flock pecking about on a patch of open ground
    if (life.flock) {
      const f = life.flock;
      for (const [[x, y], calm] of passes) {
        if (this.flocks.length >= 2) break;
        if (!openBox(x - 9, y - 6, 18, 8, 0.85)) continue;
        const fl = new Flock({ sprite: f.sprite, fly: [`life_${f.sprite}_2`, `life_${f.sprite}_3`], center: [x, y], n: f.n, rx: 6, ry: 2, seed: rnd(x, y, seed + 5) });
        const area = fl.box();
        if (!clear(area, calm) || !free(area, 12)) continue;
        taken.push(area);
        this.flocks.push({ it: fl, kind: f.sprite, cap: 1, area, on: true });
      }
    }

    // the Meadow Road's stream: a frog on the bank, fish leaping where no bridge crosses
    if (theme === 'forest' && land.water.length) {
      const wet = (x: number, y: number) => [-4, -2, 0, 2, 4].every((d) => at(Math.round(x), y + d) === 3);
      const banks = land.water.filter(([, y]) => y > 16 && y < H - 16).sort((a, b) => rnd(a[1], 1, seed) - rnd(b[1], 1, seed));
      for (const [mx, y] of banks) {
        if (this.fish.length >= 3) break;
        if (!wet(mx, y)) continue;
        const area: Rect = { x: Math.round(mx) - 6, y: y - 9, w: 12, h: 12 };
        if (!clear(area) || this.fish.some((f) => overlaps(area, f.area, 8))) continue;
        this.fish.push({ it: [Math.round(mx), y], kind: 'fish', cap: 2, area, on: true });
      }
      for (const [mx, y] of banks) {
        if (this.burrows.filter((b) => b.kind === 'frog').length >= 2) break;
        if (!wet(mx, y)) continue;
        const side = rnd(y, 2, seed) < 0.5 ? -1 : 1;
        for (const d of [side, -side]) {
          const ox = Math.round(mx + d * 7);
          if (!openBox(ox - 3, y - 4, 6, 4)) continue;
          const area: Rect = { x: Math.min(mx, ox) - 8, y: y - 10, w: Math.abs(ox - mx) + 16, h: 14 };
          if (!clear(area) || !free(area, 12) || this.fish.some((f) => overlaps(area, f.area, 4))) continue;
          taken.push(area);
          const P = 9 + rnd(y, 3, seed) * 4;
          const frog = new Burrow({ sprite: 'frog', idle: [0], move: [1], flee: 1, gait: 'leap', moveSec: 0.5, home: [Math.round(mx), y], out: [ox, y], period: P, seed: rnd(y, 4, seed) });
          this.burrows.push({ it: frog, kind: 'frog', cap: 1, area, on: true });
          break;
        }
      }
    }

    // a hawk circling high over the meadow, a white owl over the glacier (its faint shadow far below may cross a road)
    if (theme === 'forest' || theme === 'glacier')
      for (const [x, y] of spots(4)) {
        if (this.hawks.length >= 3) break;
        const area: Rect = { x: x - 18, y: y - 8, w: 36, h: 16 };
        if (!clear(area) || this.hawks.some((h) => overlaps(area, h.area, 20))) continue;
        this.hawks.push({ it: { c: [x, y], r: 12, sprite: theme === 'forest' ? 'hawk' : 'owl' }, kind: 'hawk', cap: 1, area, on: true });
      }

    // pale fish gliding under the ice of the caves' pools
    if (theme === 'caves')
      for (const [px, py] of land.pools) {
        const area: Rect = { x: px - 9, y: py - 6, w: 18, h: 12 };
        if (!clear(area)) continue;
        for (let j = 0; j < 2; j++) this.fish.push({ it: [px, py], kind: 'cavefish', cap: 4, area, on: true });
      }

    // spores drifting up from the leaf litter in the Hollow
    if (theme === 'hollow')
      for (const [[x, y], calm] of passes) {
        if (this.spores.length >= 6) break;
        if (!openBox(x - 2, y - 2, 4, 3)) continue;
        const area: Rect = { x: x - 5, y: y - 16, w: 10, h: 18 };
        if (!clear(area, calm) || !free(area, 12)) continue;
        taken.push(area);
        this.spores.push({ it: [x, y], kind: 'spores', cap: 3, area, on: true });
      }

    // the sparkle's candidate spots: small open patches clear of everything above (the calm ones marked)
    this.open = [];
    for (const [x, y] of grid) {
      if (this.open.length >= 60) break;
      if (!openBox(x - 3, y - 3, 6, 4, 0.8)) continue;
      const box = sparkleBox(x, y);
      if (!clear(box) || !free(box, 4) || this.open.some((o) => Math.abs(o.at[0] - x) < 10 && Math.abs(o.at[1] - y) < 8)) continue;
      this.open.push({ at: [x, y], calm: clear(box, true) });
    }
  }

  /** This step's keep-outs (the tags, the HUD, the roamers, Rowan and Pip, the nodes he can walk to) and its sparkle. */
  private stepUpdate(): void {
    const s = this.s;
    const app = s.app;
    const run = app.run;
    const tags = this.map.layoutTags();
    // (the HUD again: the coin plate widens as the purse grows, the bounty tracker comes and goes) and the roamers
    const rects = [...tags, ...this.map.hudRects(), ...this.map.roam.roamerRects()];
    const key = `${this.placedFor}|${run.path.join(',')}|${rects.map((t) => `${t.x},${t.y},${t.w},${t.h}`).join(';')}`;
    if (key === this.stepFor) return;
    this.stepFor = key;
    const keep: Rect[] = rects.map((t) => ({ x: t.x - 3, y: t.y - 3, w: t.w + 6, h: t.h + 6 }));
    const [hx, hy] = this.map.pos(run.node);
    keep.push({ x: hx - 22, y: hy - 26, w: 36, h: 34 });
    for (const id of run.choices()) {
      const [x, y] = this.map.pos(run.map.nodes[id]);
      keep.push({ x: x - 17, y: y - 17, w: 34, h: 34 });
    }
    const ok = (r: Rect) => !keep.some((k) => overlaps(r, k));
    for (const list of [this.burrows, this.flocks, this.fish, this.hawks, this.spores] as Array<Array<Placed<unknown>>>) {
      const shown = new Map<string, number>();
      for (const p of list) {
        const n = shown.get(p.kind) ?? 0;
        p.on = n < p.cap && ok(p.area);
        if (p.on) shown.set(p.kind, n + 1);
      }
    }
    // the sparkle this step (if any, and not picked up already), on an open spot clear of all that
    this.sparkle = null;
    const sp = openSparkle(app.profile, mapSparkle(run.mapSeedFor(run.actIndex), run.path.length, app.tuning.life));
    if (!sp) return;
    const near = (r: Rect) => [...this.burrows, ...this.flocks].some((p) => p.on && overlaps(r, p.area, 2));
    const fit = this.open.filter((o) => ok(sparkleBox(o.at[0], o.at[1])) && !near(sparkleBox(o.at[0], o.at[1])));
    const calm = fit.filter((o) => o.calm);
    const spots = calm.length ? calm : fit;
    if (!spots.length) return;
    const [x, y] = spots[Math.min(spots.length - 1, Math.floor(sp.spot * spots.length))].at;
    this.sparkle = { s: sp, x, y };
  }

  /** The sparkle on screen now (it shows once its delay has passed and Rowan stands still), and how long it's been up. */
  private shownSparkle(now: number): { x: number; y: number; age: number } | null {
    const sp = this.sparkle;
    if (!sp || this.map.walking || this.s.app.run.phase !== 'map') return null;
    const age = now - this.s.app.phaseSince - sp.s.delayMs;
    return age >= 0 ? { x: sp.x, y: sp.y, age } : null;
  }

  /** Where the sparkle is (a tip points at it), or null when none is showing. */
  sparkleRect(now = performance.now()): Rect | null {
    const sh = this.shownSparkle(now);
    return sh ? sparkleBox(sh.x, sh.y) : null;
  }

  // ------------------------------------------------------------------ taps

  /** A tap no node or button took: the sparkle (picked up), or a critter (startled). True if it was theirs. */
  tap(x: number, y: number, now = performance.now()): boolean {
    const s = this.s;
    const app = s.app;
    if (app.run.phase !== 'map') return false;
    this.place();
    this.stepUpdate();
    const sh = this.shownSparkle(now);
    if (sh && this.sparkle) {
      const b = sparkleBox(sh.x, sh.y);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const paid = claimSparkle(app.profile, this.sparkle.s, app.tuning.life);
        this.sparkle = null;
        if (paid > 0) {
          this.pop = { x: sh.x, y: sh.y, at: now, coins: paid };
          app.saveProfile();
          app.audio.sparklePop();
        }
        return true;
      }
    }
    const hide = app.tuning.life.hideSec * 1000;
    for (const p of this.flocks)
      if (p.on && p.it.tap(x, y, now, hide)) {
        app.audio.critterFlutter();
        this.pipChirp();
        return true;
      }
    for (const p of this.burrows)
      if (p.on && p.it.tap(this.L, x, y, now, hide)) {
        app.audio.critterFlutter(true);
        this.pipChirp();
        return true;
      }
    return false;
  }

  /** Pip chirps at the commotion, a moment later. */
  private pipChirp(): void {
    const t = this.s.app.audio.ctx?.currentTime;
    if (t !== undefined) this.s.app.audio.critterChirp(t + 0.14);
  }

  // ------------------------------------------------------------------ frame

  draw(now: number): void {
    const L = this.L;
    L.begin();
    this.place();
    this.stepUpdate();
    const t = now / 1000;
    const hide = this.s.app.tuning.life.hideSec * 1000;
    const low = L.low;
    const hg = L.high;

    // the critters with a hiding place (the frog's splash as it dives, a rustle in the bush a rabbit dove into)
    for (const p of this.burrows) {
      if (!p.on) continue;
      const pose = p.it.pose(now);
      if (pose) {
        low.fillStyle(0x000000, 0.22 * pose.alpha);
        low.fillRect(Math.round(pose.x) - 2, Math.round(pose.y), 5, 1);
        L.pose(pose, D_CRITTER);
        if (p.kind === 'beetle') {
          // its tail end glows softly on the floor
          const bx = Math.round(pose.x) + (pose.flip ? 2 : -3);
          low.fillStyle(0x3ed8c0, (0.16 + 0.1 * Math.sin(t * 3 + p.it.spec.seed * 9)) * pose.alpha);
          low.fillRect(bx - 1, Math.round(pose.y) - 3, 4, 3);
        }
      }
      const since = now - p.it.startledAt;
      const [hx, hy] = p.it.spec.home;
      if (p.kind === 'frog') {
        if (since >= 300 && since < 900) this.ring(hx, hy, (since - 300) / 600, 0xd4f0f6);
      } else if (since >= 0 && since < 360 && p.it.spec.curl === undefined) {
        hg.fillStyle(RUSTLE[this.map.landTheme], 0.7 * (1 - since / 360));
        hg.fillRect(hx - 2 + (Math.floor(since / 60) % 2), hy - 5, 1, 1);
        hg.fillRect(hx + 2 - (Math.floor(since / 60) % 2), hy - 6, 1, 1);
      }
    }

    // flocks pecking about, or flying off and back
    for (const p of this.flocks) {
      if (!p.on) continue;
      const f = p.it;
      for (const b of f.poses(now, hide)) {
        const flying = b.key === f.spec.fly[0] || b.key === f.spec.fly[1];
        if (flying) L.mid(b.key, b.x, b.y, D_FLY, b.flip, b.alpha);
        else {
          low.fillStyle(0x000000, 0.2 * b.alpha);
          low.fillRect(Math.round(b.x) - 1, Math.round(b.y), 3, 1);
          L.pose(b, D_CRITTER);
        }
      }
    }

    // fish leaping in the stream (a ripple where they jump and where they land); cave fish circling under the ice
    this.fish.forEach((p, i) => {
      if (!p.on) return;
      if (p.kind === 'cavefish') {
        const [px, py] = p.it;
        const a = t * (0.35 + (i % 2) * 0.12) * (i % 2 ? -1 : 1) + i * 2.3;
        const fx = px + Math.cos(a) * (5 + (i % 2) * 2);
        const fy = py + Math.sin(a) * 2;
        const dirRight = (i % 2 ? -1 : 1) * -Math.sin(a) > 0;
        L.mid(`life_cavefish_${Math.floor(t * 3 + i) % 2}`, fx, fy, D_CRITTER, !dirRight, 0.7);
        if ((t + i * 1.7) % 5.5 < 0.6) this.ring(fx, fy, ((t + i * 1.7) % 5.5) / 0.6, 0xb4e4f8);
        return;
      }
      const per = 6.5 + i * 1.7;
      const u = ((t + i * 2.9) % per) / 0.75;
      const [x, y] = p.it;
      const dir = i % 2 ? -1 : 1;
      if (u < 1) {
        const fx = x - dir * 2 + dir * u * 4;
        const fy = y - Math.sin(u * Math.PI) * 5;
        L.foot(`life_fish_${u < 0.5 ? 0 : 1}`, fx, fy + 1, D_CRITTER, dir < 0, 0.95);
        if (u < 0.25) this.ring(x - dir * 2, y, u / 0.25, 0xd4f0f6);
      } else if (u < 1.6) this.ring(x + dir * 2, y, (u - 1) / 0.6, 0xd4f0f6);
    });

    // the hawk: a slow wide circle, gliding, a few wingbeats now and then; its faint shadow sweeps the grass below
    for (const p of this.hawks) {
      if (!p.on) continue;
      const { c, r } = p.it;
      const a = t * 0.32;
      const x = c[0] + Math.cos(a) * r;
      const y = c[1] + Math.sin(a) * r * 0.45;
      const flap = t % 5.5 < 0.6 && Math.floor(t * 6) % 2 === 0;
      L.mid(`life_${p.it.sprite}_${flap ? 1 : 0}`, x, y, D_FLY, false, 0.8);
      low.fillStyle(p.it.sprite === 'owl' ? 0x0a1430 : 0x0a1a10, 0.13);
      low.fillRect(Math.round(x + 2), Math.round(y + 17), 5, 1);
      low.fillRect(Math.round(x + 3), Math.round(y + 16), 3, 1);
    }

    // spores rising from the leaf litter
    this.spores.forEach((p, i) => {
      if (!p.on) return;
      const [x, y] = p.it;
      for (let j = 0; j < 3; j++) {
        const u = (t / 4.2 + j / 3 + i * 0.37) % 1;
        hg.fillStyle(j % 2 ? 0xffd0f0 : 0xe8a0d8, 0.5 * Math.sin(u * Math.PI));
        hg.fillRect(Math.round(x + Math.sin(u * 6 + j * 2) * 2), Math.round(y - u * 13), 1, 1);
      }
    });

    // moths round the braziers in the ruins
    if (this.map.landTheme === 'ruins')
      this.map.landData?.flames.forEach(([fx, fy], i) => {
        for (let j = 0; j < 2; j++) {
          const a = t * (2.2 + j * 0.7) + i * 1.9 + j * Math.PI;
          const x = fx + Math.cos(a) * (3 + j);
          const y = fy - 5 + Math.sin(a * 1.3) * 2;
          hg.fillStyle(0xf0e6c8, 0.45 + 0.35 * Math.abs(Math.sin(t * 9 + j)));
          hg.fillRect(Math.round(x), Math.round(y), 1, 1);
        }
      });

    // the sparkle, and the pop when it's picked up
    const sh = this.shownSparkle(now);
    if (sh) drawSparkle(hg, sh.x, sh.y, sh.age, now);
    if (this.pop) {
      if (now - this.pop.at >= POP_MS) this.pop = null;
      else drawPop(L, this.pop, now);
    }
    L.end();
  }

  /** A ripple ring on the water spreading out (k 0..1). */
  private ring(x: number, y: number, k: number, col: number): void {
    const g = this.L.low;
    const rx = Math.round(1 + k * 3);
    g.fillStyle(col, 0.6 * (1 - k));
    g.fillRect(Math.round(x) - rx, Math.round(y), 1, 1);
    g.fillRect(Math.round(x) + rx, Math.round(y), 1, 1);
    g.fillRect(Math.round(x) - rx + 1, Math.round(y) - 1, rx * 2 - 1, 1);
    g.fillRect(Math.round(x) - rx + 1, Math.round(y) + 1, rx * 2 - 1, 1);
  }
}
