import { describe, expect, it } from 'vitest';
import { pageStrip, stripWindow, type StripPage, type StripRow } from '../../src/engine/view/camp-kit';

// The top bar's strip of sixteen hero faces pages in a window when it doesn't fit (camp-kit stripRow).
describe('a strip too long for the top bar', () => {
  it('keeps the one on view in its window, from either end', () => {
    const page: StripPage = { first: 0, sel: -1 };
    for (const sel of [0, 15, 7, 3, 12, 0]) {
      const first = stripWindow(16, 9, sel, page);
      expect(sel).toBeGreaterThanOrEqual(first);
      expect(sel).toBeLessThan(first + 9);
      expect(first + 9).toBeLessThanOrEqual(16);
    }
  });

  it('pages by a window with the arrows, clamped, and the view does not pull it back until it changes', () => {
    const page: StripPage = { first: 0, sel: -1 };
    stripWindow(16, 9, 0, page);
    const row: StripRow = { cells: Array(16).fill(null), prev: null, next: null, k: 9 };
    pageStrip(page, row, 1);
    expect(stripWindow(16, 9, 0, page)).toBe(7); // the end: the last nine
    pageStrip(page, row, 1);
    expect(page.first).toBe(7);
    pageStrip(page, row, -1);
    expect(stripWindow(16, 9, 0, page)).toBe(0);
    pageStrip(page, row, 1);
    expect(stripWindow(16, 9, 2, page)).toBe(2); // a new view off the window brings it back in
  });
});
