// Accessibility settings (team 4, round 8): pure, no DOM. Kept in storage.ts under their own key (not the game's
// settings, so they never travel with a run or the tuning) and read live by the views through engine/a11y.ts.
//   marks: every block kind tells itself apart without colour (a red gets a mark: the only kind that differed from a
//          yellow by colour alone). On by default: one small glyph on the reds.
//   motion: 'auto' follows the device's "reduce motion"; 'less' turns the screen shake, the camera's kick and the
//          white impact frames off and the screen flashes down; 'full' always plays them.
//   bigText: the story boxes and the tips in the bold display letters (caps 7 px, not 5) wherever a box's lines fit
//          its text area in them (most do); off by default.

export type MotionPref = 'auto' | 'less' | 'full';

export interface A11ySettings {
  marks: boolean;
  motion: MotionPref;
  bigText: boolean;
}

export const DEFAULT_A11Y: Readonly<A11ySettings> = { marks: true, motion: 'auto', bigText: false };

const MOTIONS: readonly MotionPref[] = ['auto', 'less', 'full'];

/** Whatever was stored (anything at all), as settings: unknown or broken fields take their default. */
export function parseA11y(raw: unknown): A11ySettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    marks: typeof o.marks === 'boolean' ? o.marks : DEFAULT_A11Y.marks,
    motion: MOTIONS.includes(o.motion as MotionPref) ? (o.motion as MotionPref) : DEFAULT_A11Y.motion,
    bigText: typeof o.bigText === 'boolean' ? o.bigText : DEFAULT_A11Y.bigText,
  };
}

/** Whether to play less motion: the setting, or on 'auto' the device's own preference. */
export function lessMotion(s: A11ySettings, deviceReduces: boolean): boolean {
  return s.motion === 'less' || (s.motion === 'auto' && deviceReduces);
}

/** Larger text for a box of lines: only when every line fits `width` in the bold letters (`widthOf(line, bold)`). */
export function bigFits(lines: readonly string[], width: number, widthOf: (line: string, bold: boolean) => number): boolean {
  return lines.every((l) => widthOf(l, true) <= width);
}

/** How much of a screen flash plays (its length; the overlay's fade follows from it). */
export const flashShare = (less: boolean): number => (less ? 0.3 : 1);
