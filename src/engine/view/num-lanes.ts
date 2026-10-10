// Where a fight's floating words go (pure: no Phaser, unit-tested in tests/unit/num-lanes.test.ts).
// Round 8's review: two blows landing together popped their numbers at one spot ("18" + "44" read as "1844", three
// foes' "367" as "36?367"), and a foe's special name ("Frost Breath!") was printed over by them and started under the
// wave pips. Every number, and every shout, now takes a box no other live one holds: the free spot nearest where it
// wants to be (a number moves up first, then sideways, then down; a shout sideways first), kept off the HUD's plates.
// Also the foe plate's HP readout, which kept switching formats mid-fight.
import { compact, hpNow, one, whole } from '../../core/format';
import { textWidth } from '../font';

/** A box, top-left and size (game px). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlaceOpts {
  /** The box must stay inside this area. */
  area: Box;
  /** How far the box may move up, down and to each side (px). */
  up: number;
  down: number;
  side: number;
  /** The cost of a px moved up, down and sideways: the cheapest free spot wins. */
  costUp?: number;
  costDown?: number;
  costSide?: number;
  /** The gap kept from every obstacle (px). */
  gap?: number;
  /** The search's step (px). */
  step?: number;
}

/** Do a and b overlap (with `gap` px kept between them)? */
export function overlaps(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** How much of a lies over the obstacles (px², summed). */
function covered(a: Box, obstacles: readonly Box[], gap: number): number {
  let sum = 0;
  for (const b of obstacles) {
    const w = Math.min(a.x + a.w, b.x + b.w + gap) - Math.max(a.x, b.x - gap);
    const h = Math.min(a.y + a.h, b.y + b.h + gap) - Math.max(a.y, b.y - gap);
    if (w > 0 && h > 0) sum += w * h;
  }
  return sum;
}

/** `want` moved inside the area (as far as it fits). */
export function clampBox(want: Box, area: Box): Box {
  const x = Math.max(area.x, Math.min(area.x + area.w - want.w, want.x));
  const y = Math.max(area.y, Math.min(area.y + area.h - want.h, want.y));
  return { ...want, x, y };
}

/**
 * The free spot for `want` nearest where it wants to be (the cheapest move by the costs), inside the area and clear of
 * every obstacle; when no spot within reach is free, the one least covered (then the cheapest).
 */
export function placeBox(want: Box, obstacles: readonly Box[], o: PlaceOpts): Box {
  const gap = o.gap ?? 1;
  const step = Math.max(1, o.step ?? 1);
  const cu = o.costUp ?? 1;
  const cd = o.costDown ?? 2;
  const cs = o.costSide ?? 1.5;
  const home = clampBox(want, o.area);
  if (!obstacles.some((b) => overlaps(home, b, gap))) return home;
  let best: Box | null = null;
  let bestCost = Infinity;
  let least: Box = home;
  let leastCover = covered(home, obstacles, gap);
  let leastCost = 0;
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (let dx = -o.side; dx <= o.side; dx += step) xs.add(clampBox({ ...want, x: want.x + dx }, o.area).x);
  for (let dy = -o.up; dy <= o.down; dy += step) ys.add(clampBox({ ...want, y: want.y + dy }, o.area).y);
  for (const y of ys) {
    const dy = y - want.y;
    const cy = dy < 0 ? -dy * cu : dy * cd;
    for (const x of xs) {
      const cost = cy + Math.abs(x - want.x) * cs;
      if (cost >= bestCost) continue;
      const c: Box = { x, y, w: want.w, h: want.h };
      const cover = covered(c, obstacles, gap);
      if (cover === 0) {
        best = c;
        bestCost = cost;
      } else if (cover < leastCover || (cover === leastCover && cost < leastCost)) {
        least = c;
        leastCover = cover;
        leastCost = cost;
      }
    }
  }
  return best ?? least;
}

/**
 * A finisher's blows summed into one number that counts up, a step per blow (`steps`: the running totals, e.g. three
 * foes of 367 each: 367, 734, 1101). `k` runs 0..1 over the count; returns the number to show and which blow it's on
 * (the view swells the number as each lands).
 */
export function countSteps(steps: readonly number[], k: number): { value: number; step: number } {
  if (!steps.length) return { value: 0, step: 0 };
  const n = steps.length;
  const q = Math.max(0, Math.min(1, k)) * n;
  const i = Math.min(n - 1, Math.floor(q));
  const from = i === 0 ? 0 : steps[i - 1];
  // each step eases in fast (the blow lands) and settles on its total
  const f = Math.min(1, (q - i) * 2.2);
  return { value: Math.round(from + (steps[i] - from) * (1 - (1 - f) ** 2)), step: i };
}

/** The running totals of a set of blows (a finisher on several foes). */
export function runningTotals(blows: readonly number[]): number[] {
  let sum = 0;
  return blows.map((b) => (sum += b));
}

/**
 * A foe plate's HP readout: "71/90", or both halves compact ("12.3k/12.3k") when the full max wouldn't fit the gauge
 * (72 px) in the bold letters. Decided by the max alone, so one plate keeps one format the whole fight (review round 8:
 * a boss's "12.3k/12.3k" turned into "7619/12288" mid-fight).
 */
export function foeHpText(hp: number, maxHp: number): string {
  const fits = textWidth(`${whole(maxHp)}/${whole(maxHp)}`, 1, true) <= 72;
  if (fits) return `${hpNow(hp)}/${whole(maxHp)}`;
  // both halves in thousands ("7.7k/12.3k"), rounded up so a sliver never reads 0
  const k = (n: number): string => (n >= 100000 ? compact(n) : n >= 1000 ? `${one(Math.ceil(n / 100) / 10)}k` : hpNow(n));
  return `${k(hp)}/${k(maxHp)}`;
}
