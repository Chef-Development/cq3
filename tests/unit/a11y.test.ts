import { describe, expect, it } from 'vitest';
import { DEFAULT_A11Y, flashShare, lessMotion, parseA11y } from '../../src/core/a11y';

describe('accessibility settings', () => {
  it('defaults: block marks on, motion follows the device', () => {
    expect(DEFAULT_A11Y).toEqual({ marks: true, motion: 'auto' });
    expect(parseA11y(undefined)).toEqual(DEFAULT_A11Y);
    expect(parseA11y(null)).toEqual(DEFAULT_A11Y);
    expect(parseA11y('nonsense')).toEqual(DEFAULT_A11Y);
  });

  it('keeps what was stored and repairs what is broken', () => {
    expect(parseA11y({ marks: false, motion: 'less' })).toEqual({ marks: false, motion: 'less' });
    expect(parseA11y({ marks: 'yes', motion: 'fast' })).toEqual(DEFAULT_A11Y);
    expect(parseA11y({ motion: 'full' })).toEqual({ marks: true, motion: 'full' });
  });

  it("less motion: the setting, or on 'auto' the device's preference", () => {
    expect(lessMotion({ marks: true, motion: 'auto' }, true)).toBe(true);
    expect(lessMotion({ marks: true, motion: 'auto' }, false)).toBe(false);
    expect(lessMotion({ marks: true, motion: 'less' }, false)).toBe(true);
    expect(lessMotion({ marks: true, motion: 'full' }, true)).toBe(false);
  });

  it('screen flashes play shorter with less motion', () => {
    expect(flashShare(false)).toBe(1);
    expect(flashShare(true)).toBeLessThan(0.5);
  });
});
