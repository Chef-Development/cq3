// Every number the player sees goes through here (pure; no DOM). HP, damage, heals, costs, coins, gems, scrap, XP and
// counts are whole; a decimal shows only where it means something (a multiplier "x1.5", seconds "1.5 s", a small stat
// that would otherwise read 0), at most one, with a trailing ".0" dropped; percentages are rounded. Numbers inside the
// game are often fractional (Defense cuts, heals in shares of max HP, stat multipliers like 1.15 x 1.3), so a screen
// that prints one raw shows "137.35000000000002": the playtester's "massive floating point numbers".
//
// The safety net (guardText) runs on every string about to be drawn (engine/font.ts fontText, the HTML panels'
// text): a number with two or more digits after the point is rounded to one before it is drawn, and the raw string
// is recorded in `textViolations` (window.__cq3.textViolations) so the smoke tests fail on it.

/** n, or 0 when it is NaN or +-Infinity (a broken number never reaches the screen as "NaN"). */
const fin = (n: number): number => (Number.isFinite(n) ? n : 0);

/** Round half away from zero to `digits` decimals, without float noise (1.15 -> 1.2, not 1.1; -2.5 -> -3). */
export function roundTo(n: number, digits = 0): number {
  const k = 10 ** digits;
  const v = fin(n);
  const x = Number((Math.abs(v) * k).toPrecision(12));
  const r = (Math.sign(v) * Math.round(x)) / k;
  return r === 0 ? 0 : r; // never -0
}

const COMPACT: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
];

/** A huge number short: 1234567 -> "1.2M" (never "1e+21"). */
function huge(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e15) return `${sign}999T+`;
  for (const [at, unit] of COMPACT) if (a >= at) return `${sign}${one(a / at)}${unit}`;
  return `${sign}${Math.round(a)}`;
}

/** A whole number: HP, damage, heals, costs, coins, gems, scrap, XP, counts. 12.5 -> "13", -0.4 -> "0", NaN -> "0",
 *  1234567 -> "1.2M". */
export function whole(n: number): string {
  const r = roundTo(n);
  if (Math.abs(r) >= 1e6) return huge(r);
  return `${r}`;
}

/** At most one decimal, a trailing ".0" dropped: 1.25 -> "1.3", 2.04 -> "2", 0.05 -> "0.1". For multipliers, seconds
 *  and small flat stats. */
export function one(n: number): string {
  const r = roundTo(n, 1);
  if (Math.abs(r) >= 1e6) return huge(r);
  return `${r}`;
}

/** A multiplier: 1.5 -> "x1.5", 2 -> "x2", 1.15 * 1.3 -> "x1.5". */
export const mult = (n: number): string => `x${one(n)}`;

/** Seconds: 1.5 -> "1.5 s", 4 -> "4 s". */
export const secs = (n: number): string => `${one(n)} s`;

/** A percentage from a share: 0.153 -> "15%". */
export const pct = (share: number): string => `${whole(fin(share) * 100)}%`;

/** A percentage from a percent: 15.3 -> "15%". */
export const pctOf = (percent: number): string => `${whole(percent)}%`;

/** Odds from a share, where a decimal matters: at most one ("2.5%", "0.4%"); under 0.1% reads "<0.1%" (never "0%"). */
export function odds(share: number): string {
  const p = fin(share) * 100;
  if (p <= 0) return '0%';
  if (p < 0.05) return '<0.1%';
  return p >= 10 ? `${whole(p)}%` : `${one(p)}%`;
}

/** A signed form of any of the above: "+12", "-3", "+4%", "+1.5". The sign follows what is printed (0.2 -> "+0"). */
export function signed(n: number, f: (v: number) => string = whole): string {
  const s = f(n);
  return s.startsWith('-') ? s : `+${s}`;
}

/** A signed percentage from a share: 0.04 -> "+4%". */
export const signedPct = (share: number): string => signed(share, pct);

/** Current HP as shown, "96": whole, rounded up (a sliver left reads 1, never 0; float noise just over a whole
 *  number, 61.0000001, still reads 61), never below 0 and never above `max` when given. */
export function hpNow(hp: number, max?: number): string {
  const up = Math.max(0, Math.ceil(fin(hp) - 1e-6));
  return whole(max === undefined ? up : Math.min(roundTo(max), up));
}

/** "96/101": current HP over max HP, both whole. */
export const hpOf = (hp: number, max: number): string => `${hpNow(hp, max)}/${whole(max)}`;

/** A big number short enough for a plate: "9999", "12.4k", "124k", "1.2M" (rounded up: a foe's HP never reads less
 *  than it is). */
export function compact(n: number): string {
  const v = Math.ceil(fin(n) - 1e-6);
  if (v < 10000) return whole(v);
  if (v < 100000) return `${one(Math.ceil(v / 100) / 10)}k`;
  if (v < 1e6) return `${whole(Math.ceil(v / 1000))}k`;
  return whole(v);
}

/**
 * A data text with its number filled in ('{n}': relics, skill nodes, kits, styles, bounties): a percent ("{n}%") or
 * an amount of HP or coins ("{n} HP", "{n} coin") is whole; anything else (seconds, multipliers, combo power) keeps
 * at most one decimal.
 */
export function fillN(text: string, n: number): string {
  return text.replace(/\{n\}(?=(%| HP| coin)?)/g, (_m, unit: string | undefined) => (unit ? whole(n) : one(n)));
}

// ---------------------------------------------------------------------------------------------------- the safety net

/**
 * A long decimal: a number with two or more digits after the point ("137.35", "61.0004", "0.15"). Not caught: a
 * dotted run (a version "1.2.10", a date "08.10.2026": no digit or dot right before it, no digit or ".digit" right
 * after it), times ("1:05") and dates with dashes or slashes (no point at all), one decimal ("x1.5").
 */
export const LONG_DECIMAL = /(?<![\d.])\d+\.\d{2,}(?!\d|\.\d)/g;
/** Broken numbers drawn as text: "NaN", "Infinity", an exponent ("1e+21", "1.5e-7"). Recorded, not rewritten. */
const BROKEN = /\bNaN\b|\bInfinity\b|\d(?:\.\d+)?e[+-]\d+/;

/** The raw strings that reached the drawing code with a long decimal or a broken number (each once, the first 200). */
export const textViolations: string[] = [];
const seenViolations = new Set<string>();
const violationListeners: Array<(raw: string) => void> = [];

/** Hear about each new violation as it is recorded (the engine forwards them to the smoke tests). */
export function onTextViolation(fn: (raw: string) => void): void {
  violationListeners.push(fn);
}

/** Forget the violations recorded so far (a test that checks screen by screen). */
export function clearTextViolations(): void {
  textViolations.length = 0;
  seenViolations.clear();
}

function noteViolation(raw: string): void {
  if (seenViolations.has(raw)) return;
  seenViolations.add(raw);
  if (textViolations.length < 200) textViolations.push(raw);
  for (const f of violationListeners) f(raw);
}

/**
 * The safety net, run on every string about to be drawn: a long decimal is rounded to at most one decimal (and the
 * raw string recorded); "NaN", "Infinity" and exponents are recorded. Cheap: a string without a point or one of
 * those words comes back at once.
 */
export function guardText(s: string): string {
  if (!s) return s;
  const dot = s.indexOf('.') >= 0;
  if (!dot && s.indexOf('NaN') < 0 && s.indexOf('Infinity') < 0 && s.indexOf('e+') < 0 && s.indexOf('e-') < 0) return s;
  let out = s;
  if (dot) {
    LONG_DECIMAL.lastIndex = 0;
    if (LONG_DECIMAL.test(s)) {
      LONG_DECIMAL.lastIndex = 0;
      out = s.replace(LONG_DECIMAL, (m) => one(Number(m)));
      noteViolation(s);
      return out;
    }
  }
  if (BROKEN.test(s)) noteViolation(s);
  return out;
}
