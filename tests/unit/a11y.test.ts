import { describe, expect, it } from 'vitest';
import { bigFits, DEFAULT_A11Y, flashShare, lessMotion, parseA11y } from '../../src/core/a11y';
import { textWidth } from '../../src/engine/font';
import { STORY } from '../../src/data/story';

describe('accessibility settings', () => {
  it('defaults: block marks on, motion follows the device', () => {
    expect(DEFAULT_A11Y).toEqual({ marks: true, motion: 'auto', bigText: false });
    expect(parseA11y(undefined)).toEqual(DEFAULT_A11Y);
    expect(parseA11y(null)).toEqual(DEFAULT_A11Y);
    expect(parseA11y('nonsense')).toEqual(DEFAULT_A11Y);
  });

  it('keeps what was stored and repairs what is broken', () => {
    expect(parseA11y({ marks: false, motion: 'less', bigText: true })).toEqual({ marks: false, motion: 'less', bigText: true });
    expect(parseA11y({ marks: 'yes', motion: 'fast' })).toEqual(DEFAULT_A11Y);
    expect(parseA11y({ motion: 'full' })).toEqual({ marks: true, motion: 'full', bigText: false });
  });

  it("less motion: the setting, or on 'auto' the device's preference", () => {
    const a = (motion: 'auto' | 'less' | 'full') => ({ marks: true, motion, bigText: false });
    expect(lessMotion(a('auto'), true)).toBe(true);
    expect(lessMotion(a('auto'), false)).toBe(false);
    expect(lessMotion(a('less'), false)).toBe(true);
    expect(lessMotion(a('full'), true)).toBe(false);
  });

  it('screen flashes play shorter with less motion', () => {
    expect(flashShare(false)).toBe(1);
    expect(flashShare(true)).toBeLessThan(0.5);
  });

  it('larger text: a box takes the bold letters only when every line fits; most story boxes do', () => {
    const w = (l: string, bold: boolean) => textWidth(l, 1, bold);
    expect(bigFits(['Short line.', 'Another.'], 256, w)).toBe(true);
    expect(bigFits(['W'.repeat(60)], 256, w)).toBe(false);
    const boxes = Object.values(STORY).flat() as Array<{ text: string }>;
    const big = boxes.filter((b) => bigFits(b.text.split('\n'), 256, w)).length;
    expect(big / boxes.length).toBeGreaterThan(0.8);
  });
});
