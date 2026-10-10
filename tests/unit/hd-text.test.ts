// The sharper text (view/hd-text.ts, round 8): the switch (one flag per surface, the 'cq3.hdText' setting over the
// defaults, 'off' always the old path) and its lettering's smoothing ('round': a doubled glyph only loses outer
// corners, never gains a pixel, so the small font's '+', 'f' and 'x' keep their shapes).
import { describe, expect, it } from 'vitest';
import { glyphMask } from '../../src/engine/font';
import { hdTextMask, scale2x, type Mask } from '../../src/engine/font-hd';
import { HD_DEFAULT, HD_SURFACES, surfaceOn } from '../../src/engine/hd-switch';
import { loadHdText, readHdText } from '../../src/engine/storage';

const fromRows = (rows: string[]): Mask => ({ w: rows[0].length, h: rows.length, on: (x, y) => rows[y]?.[x] === '#' });
const toRows = (m: Mask): string[] => Array.from({ length: m.h }, (_, y) => Array.from({ length: m.w }, (_, x) => (m.on(x, y) ? '#' : '.')).join(''));

describe('the sharper text: the switch', () => {
  it('has a default for every surface', () => {
    for (const s of HD_SURFACES) expect(typeof HD_DEFAULT[s]).toBe('boolean');
  });

  it("'off' puts every surface on the old path, 'on' turns every one on, an object sets single surfaces", () => {
    for (const s of HD_SURFACES) {
      expect(surfaceOn('off', s)).toBe(false);
      expect(surfaceOn('on', s)).toBe(true);
      expect(surfaceOn(null, s)).toBe(HD_DEFAULT[s]);
    }
    expect(surfaceOn({ story: false }, 'story')).toBe(false);
    expect(surfaceOn({ story: false }, 'tips')).toBe(HD_DEFAULT.tips);
    expect(surfaceOn({ tips: true }, 'tips')).toBe(true);
  });

  it('reads only what it knows from storage (anything else: the defaults)', () => {
    expect(readHdText('off')).toBe('off');
    expect(readHdText('on')).toBe('on');
    expect(readHdText({ story: false })).toEqual({ story: false });
    expect(readHdText('hd')).toBeNull();
    expect(readHdText([true])).toBeNull();
    expect(readHdText(7)).toBeNull();
    expect(loadHdText()).toBeNull(); // no storage here
  });
});

describe("the sharper text: 'round' smoothing", () => {
  it('cuts a stem\'s outer corners like Scale2x but never fills a concave one', () => {
    expect(toRows(scale2x(fromRows(['##', '##', '##']), 'round'))).toEqual(['.##.', '####', '####', '####', '####', '.##.']);
    // the "L": Scale2x fills its inner corner; 'round' leaves it open
    expect(toRows(scale2x(fromRows(['##', '#.']), 'full'))).toEqual(['.###', '####', '###.', '##..']);
    expect(toRows(scale2x(fromRows(['##', '#.']), 'round'))).toEqual(['.###', '####', '##..', '##..']);
  });

  it('only ever removes pixels from the plain 2x (every glyph of both fonts), and keeps the widths', () => {
    const s = "Green hits: +10% crit for a few seconds. Fix x4 Swipe 'Now that is odd.'";
    for (const bold of [false, true]) {
      const g = glyphMask(s, bold);
      const m = hdTextMask(s, 1, bold, 'round');
      expect({ w: m.w, h: m.h }).toEqual({ w: g.w * 2, h: g.h * 2 });
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.on(x, y)) expect(g.on(x >> 1, y >> 1)).toBe(true);
    }
  });

  it("keeps the small font's '+' a cross (Scale2x turns it into a diamond)", () => {
    const g = glyphMask('+', false);
    const full = hdTextMask('+', 1, false, 'full');
    const round = hdTextMask('+', 1, false, 'round');
    // a pixel off in the glyph's 2x but on in the doubled mask: a fill
    const fills = (m: Mask) => {
      let n = 0;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.on(x, y) && !g.on(x >> 1, y >> 1)) n++;
      return n;
    };
    expect(fills(full)).toBeGreaterThan(0);
    expect(fills(round)).toBe(0);
  });
});
