// Life on the kingdom's world map, out at sea where a tap means nothing else (world.ts hands life only the taps no
// region, the capital, the plate or the Camp button took): a raft of gulls floating off the coast (tapped, they
// take off and come back a while later) and a pod of dolphins breaking the surface now and then (tapped, one leaps
// clear of the water). Pip chirps at them.
//
// Now and then something glints on the waves: a tap picks it up for a coin or two, into the purse (core/sparkle.ts:
// at most one per visit, and a visit is new only once you've played since; the same after a reload, never paid
// twice). Everything stays on the open sea, clear of the header, the plates, the Camp button, the cloud banks and the
// ships' lanes, and animates from `now` (deterministic for the screenshot tests).
import { claimSparkle, openSparkle, worldSparkle, type Sparkle } from '../../core/sparkle';
import { WORLD_LIFE, worldRegionAt } from '../art-world';
import { GAME_W } from '../layout';
import type { FightScene } from '../scene';
import { drawPop, drawSparkle, Flock, LifeLayers, overlaps, POP_MS, rnd, sparkleBox, type Pop, type Pt } from './life';
import type { Rect } from './shared';

// depths (the world map owns 30.1-30.9): on the sea over the glints (30.13) and under the ships (30.14); the
// sparkle over the vignette (30.3) and under the clouds (30.4); gulls in flight among the clouds; the pop under the
// plates (30.8)
const D_LOW = 30.131;
const D_SEA = 30.135;
const D_HIGH = 30.31;
const D_FLY = 30.41;
const D_POP = 30.79;
const D_TEXT = 30.795;

/** The dolphins: where they surface, which way they swim, and when a tap made one leap. */
interface Pod {
  x: number;
  y: number;
  dir: number;
  period: number;
  phase: number;
  leapAt: number;
  leapFrom: Pt;
  resumeAt: number;
}

const ARC_S = 0.9; // one dolphin's arc out of the water
const ARCS = 3; // arcs per surfacing
const LEAP_MS = 900;

export class WorldLife {
  private readonly L: LifeLayers;
  private placed = '';
  private gulls: Flock | null = null;
  private pod: Pod | null = null;
  private open: Pt[] = [];
  private visit = -1;
  private sparkle: { s: Sparkle; x: number; y: number } | null = null;
  private pop: Pop | null = null;

  constructor(
    private readonly s: FightScene,
    /** Whether a tap at (x, y) is free (no region, capital, plate or button takes it). */
    private readonly tapFree: (x: number, y: number) => boolean,
    /** Greenmarch's plate, as last drawn (it bobs and pops in: life keeps well clear of it). */
    private readonly plate: () => Rect,
  ) {
    this.L = new LifeLayers(s, { low: D_LOW, high: D_HIGH, pop: D_POP, text: D_TEXT });
  }

  build(): void {
    this.L.build();
    this.placed = '';
  }

  hide(): void {
    this.L.hide();
    this.visit = -1;
  }

  /**
   * Whether a whole rect is open sea that no other tap target claims, clear of the cloud bank along the top, the very
   * bottom edge, the moored fishing boat and (with `lanes`) the ships' lanes.
   */
  private seaRect(r: Rect, lanes = true): boolean {
    const s = this.s;
    if (r.x < s.L + 6 || r.x + r.w > s.R - 6 || r.y < 22 || r.y + r.h > Math.min(140, s.B - 6)) return false;
    if (lanes && (overlaps(r, { x: 0, y: 5, w: GAME_W, h: 17 }) || overlaps(r, { x: 0, y: 126, w: GAME_W, h: 16 }))) return false;
    const [bx, by] = WORLD_LIFE.boat;
    if (overlaps(r, { x: bx - 9, y: by - 12, w: 18, h: 15 })) return false;
    // the header panel, the DOM buttons, Greenmarch's plate
    if (overlaps(r, { x: 0, y: 0, w: s.L + 136, h: 40 }) || overlaps(r, { x: GAME_W / 2 - 24, y: 0, w: 48, h: 24 }) || overlaps(r, this.plate(), 10)) return false;
    for (let y = r.y; y <= r.y + r.h; y += 2) for (let x = r.x; x <= r.x + r.w; x += 2) if (worldRegionAt(x, y) || !this.tapFree(x, y)) return false;
    return true;
  }

  /** Where the gulls float and the dolphins swim (once per layout). */
  private place(): void {
    const s = this.s;
    const p = this.plate();
    if (!p.w) return;
    const key = `${s.L},${s.R},${s.B}|${p.w}`;
    if (key === this.placed) return;
    this.placed = key;
    const sea = [...WORLD_LIFE.sea].sort((a, b) => rnd(a[0], a[1], 41) - rnd(b[0], b[1], 41));
    const taken: Rect[] = [];
    this.gulls = null;
    this.pod = null;
    // the dolphins: a stretch of open sea they arc along (they'll swim a ship's lane if there's no other room)
    const grid: Pt[] = [];
    for (let y = 22; y < 142; y += 3) for (let x = 0; x < GAME_W; x += 3) grid.push([x, y]);
    grid.sort((a, b) => rnd(a[0], a[1], 47) - rnd(b[0], b[1], 47));
    for (const lanes of [true, false])
      for (const [x, y] of grid) {
        if (this.pod) break;
        const dir = rnd(x, y, 45) < 0.5 ? -1 : 1;
        const r = this.podRect(x, y, dir);
        if (!this.seaRect(r, lanes)) continue;
        this.pod = { x, y, dir, period: 13, phase: rnd(x, y, 46) * 13, leapAt: -1e9, leapFrom: [x, y], resumeAt: -1e9 };
        taken.push(r);
      }
    // the gulls: near a coast (some land within 24 px), on a patch of sea of their own (in a ship's lane if need be)
    for (const lanes of [true, false])
      for (const [x, y] of grid) {
        if (this.gulls) break;
        const coast = [-24, -12, 12, 24].some((d) => worldRegionAt(x + d, y) || worldRegionAt(x, y + d));
        if (!coast) continue;
        const f = new Flock({ sprite: 'gull', fly: ['wm_bird0', 'wm_bird1'], center: [x, y], n: 3, rx: 6, ry: 2, seed: rnd(x, y, 43), water: true });
        const b = f.box();
        // the birds float on open water; their tap box (thumb-sized) may reach over the shore, where the land's taps win
        const water: Rect = { x: x - 10, y: y - 7, w: 20, h: 10 };
        if (!this.seaRect(water, lanes) || taken.some((t) => overlaps(water, t, 6))) continue;
        this.gulls = f;
        taken.push(b);
      }
    // the sparkle's spots: open sea, clear of the rest (out of the ships' way if there's room)
    this.open = [];
    for (const lanes of [true, false])
      for (const [x, y] of sea) {
        if (this.open.length >= (lanes ? 40 : 6)) break;
        const b = sparkleBox(x, y);
        if (taken.some((t) => overlaps(b, t, 4)) || !this.seaRect(b, lanes) || this.open.some(([ox, oy]) => ox === x && oy === y)) continue;
        this.open.push([x, y]);
      }
  }

  /** The water the dolphins break (their arcs and splashes). */
  private podRect(x: number, y: number, dir: number): Rect {
    const len = ARCS * 9 + 7;
    return { x: dir > 0 ? x - 4 : x - len + 4, y: y - 9, w: len, h: 12 };
  }

  /** The visit's sparkle (new each time the world map comes up; the same one until you've played). */
  private visitUpdate(): void {
    const app = this.s.app;
    if (this.visit === app.phaseSince) return;
    this.visit = app.phaseSince;
    this.sparkle = null;
    const sp = openSparkle(app.profile, worldSparkle(app.profile, app.tuning.life));
    if (!sp || !this.open.length) return;
    const [x, y] = this.open[Math.min(this.open.length - 1, Math.floor(sp.spot * this.open.length))];
    this.sparkle = { s: sp, x, y };
  }

  private shownSparkle(now: number): { x: number; y: number; age: number } | null {
    const sp = this.sparkle;
    if (!sp) return null;
    const age = now - this.s.app.phaseSince - sp.s.delayMs;
    return age >= 0 ? { x: sp.x, y: sp.y, age } : null;
  }

  /** The dolphins this frame: each one's back (x, y, arched) while they're up. */
  private dolphins(now: number): Array<{ x: number; y: number; arched: boolean; splash: number }> {
    const p = this.pod;
    if (!p) return [];
    const out: Array<{ x: number; y: number; arched: boolean; splash: number }> = [];
    const sinceLeap = now - p.leapAt;
    if (sinceLeap < LEAP_MS) {
      // the leap: clear of the water in a high arc, a splash where it lands
      const k = sinceLeap / LEAP_MS;
      const [lx, ly] = p.leapFrom;
      out.push({ x: lx + p.dir * k * 10, y: ly - Math.sin(k * Math.PI) * 8, arched: k > 0.2 && k < 0.8, splash: k > 0.85 ? (k - 0.85) / 0.15 : -1 });
      return out;
    }
    if (now < p.resumeAt) return out;
    const t = now / 1000 + p.phase;
    const u = t % p.period;
    for (let j = 0; j < 2; j++) {
      const v = u - j * 0.35;
      if (v < 0 || v >= ARCS * ARC_S) continue;
      const arc = Math.floor(v / ARC_S);
      const q = (v % ARC_S) / ARC_S;
      if (q < 0.12 || q > 0.88) continue;
      const x = p.x + p.dir * (arc * 9 + q * 8) - p.dir * j * 3;
      out.push({ x, y: p.y + j - Math.sin(q * Math.PI) * 1.5, arched: q > 0.35 && q < 0.65, splash: q < 0.25 ? q / 0.25 : -1 });
    }
    return out;
  }

  // ------------------------------------------------------------------ taps

  /** A tap nothing else on the world map took: the sparkle, the gulls or the dolphins. True if it was theirs. */
  tap(x: number, y: number, now = performance.now()): boolean {
    const app = this.s.app;
    this.place();
    this.visitUpdate();
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
    if (this.gulls?.tap(x, y, now, hide)) {
      app.audio.critterFlutter();
      this.chirp();
      return true;
    }
    const p = this.pod;
    if (p) {
      const d = this.dolphins(now).find((q) => Math.abs(q.x - x) <= 8 && Math.abs(q.y - 1 - y) <= 7);
      if (d && now - p.leapAt >= LEAP_MS) {
        p.leapAt = now;
        p.leapFrom = [d.x, p.y];
        // they dive and stay down a while, then come back up at the start of a surfacing
        const t = (now + hide) / 1000 + p.phase;
        p.resumeAt = (Math.ceil(t / p.period) * p.period - p.phase) * 1000;
        app.audio.critterFlutter(true);
        this.chirp();
        return true;
      }
    }
    return false;
  }

  private chirp(): void {
    const t = this.s.app.audio.ctx?.currentTime;
    if (t !== undefined) this.s.app.audio.critterChirp(t + 0.14);
  }

  // ------------------------------------------------------------------ frame

  draw(now: number): void {
    const L = this.L;
    L.begin();
    this.place();
    this.visitUpdate();
    const hide = this.s.app.tuning.life.hideSec * 1000;
    const low = L.low;

    // the gulls, floating (ripples round them) or flying off
    const f = this.gulls;
    if (f)
      for (const b of f.poses(now, hide)) {
        const flying = b.key === f.spec.fly[0] || b.key === f.spec.fly[1];
        if (flying) L.mid(b.key, b.x, b.y, D_FLY, b.flip, b.alpha);
        else {
          const k = Math.floor(now / 500 + b.x) % 2;
          low.fillStyle(0xbfe4f8, 0.45 * b.alpha);
          low.fillRect(Math.round(b.x) - 3 - k, Math.round(b.y), 2, 1);
          low.fillRect(Math.round(b.x) + 2 + k, Math.round(b.y), 2, 1);
          L.foot(b.key, b.x, b.y + 1, D_SEA, b.flip, b.alpha);
        }
      }

    // the dolphins
    for (const d of this.dolphins(now)) {
      L.foot(`life_dolphin_${d.arched ? 1 : 0}`, d.x, d.y + 1, D_SEA, this.pod!.dir < 0, 1);
      if (d.splash >= 0) {
        const r = Math.round(1 + d.splash * 3);
        low.fillStyle(0xd4eeec, 0.8 * (1 - d.splash));
        low.fillRect(Math.round(d.x) - r, Math.round(this.pod!.y) + 1, 1, 1);
        low.fillRect(Math.round(d.x) + r, Math.round(this.pod!.y) + 1, 1, 1);
        low.fillRect(Math.round(d.x) - 1, Math.round(this.pod!.y) - Math.round(d.splash * 3), 1, 1);
      }
    }

    // the sparkle on the waves, and the pop when it's picked up
    const sh = this.shownSparkle(now);
    if (sh) drawSparkle(L.high, sh.x, sh.y, sh.age, now, true);
    if (this.pop) {
      if (now - this.pop.at >= POP_MS) this.pop = null;
      else drawPop(L, this.pop, now);
    }
    L.end();
  }
}
