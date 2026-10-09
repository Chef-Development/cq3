// The title's logo is set from GAME_NAME (src/data/brand.ts) by logoRows: whatever the final name is, it must come
// out as rows that fit the screen (art-title.ts paints them).
import { describe, expect, it } from 'vitest';
import { logoRows } from '../../src/engine/art-title';
import { GAME_NAME } from '../../src/data/brand';
import { glyphMask } from '../../src/engine/font';

const width = (t: string, k: number) => glyphMask(t).w * k;

describe('the title logo, from the name', () => {
  it('sets a short name in one row of big letters, a leading "The" small above it', () => {
    expect(logoRows('Quillheart')).toEqual([{ text: 'Quillheart', scale: 3, kind: 'main' }]);
    expect(logoRows('The Living Map')).toEqual([
      { text: 'The', scale: 2, kind: 'article' },
      { text: 'Living Map', scale: 3, kind: 'main' },
    ]);
  });

  it('puts what follows a colon or a dash under the main words, as a subtitle', () => {
    const rows = logoRows('Inkbound: Atlas of the Lost Kingdom');
    expect(rows.map((r) => [r.text, r.kind])).toEqual([
      ['Inkbound', 'main'],
      ['Atlas of the Lost Kingdom', 'sub'],
    ]);
    expect(logoRows('Inkbound - Atlas').map((r) => r.text)).toEqual(['Inkbound', 'Atlas']);
  });

  it('steps a long name down a size, then splits it in two even rows', () => {
    const rows = logoRows('The Cartographer and the Endless Fog');
    expect(rows.filter((r) => r.kind === 'main').length).toBe(2);
    expect(rows[0]).toEqual({ text: 'The', scale: 1, kind: 'article' });
  });

  it('every row of the real name (and of some long ones) fits the screen', () => {
    for (const name of [GAME_NAME, 'The Cartographer and the Endless Fog', 'Inkbound: Atlas of the Lost Kingdom', 'Atlas']) {
      for (const r of logoRows(name)) expect(width(r.text, r.scale), `${name}: ${r.text}`).toBeLessThanOrEqual(283);
    }
  });
});
