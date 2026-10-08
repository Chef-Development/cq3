// The sharper chest reveal (a test; view/chest-hd.ts): its layer's size and placement over the game canvas for a few
// layouts, the setting's default (the old reveal), and the finer lettering's masks (Scale2x of the game's font).
import { describe, expect, it } from 'vitest';
import { hdTextMask, rampRow, scale2x, type Mask } from '../../src/engine/font-hd';
import { glyphMask } from '../../src/engine/font';
import { HD_K, hdLayerRect, layerToGame, sameLayer, toFine } from '../../src/engine/hd-layer';
import { GAME_H, GAME_W, type ScreenLayout } from '../../src/engine/layout';
import { loadChestReveal, readChestReveal } from '../../src/engine/storage';

/** A layout as computeLayout() makes it for a viewport (CSS px) at a DPR, with safe-area insets in game px. */
function layout(vw: number, vh: number, dpr: number, safe: { l?: number; r?: number; b?: number } = {}): ScreenLayout {
  const fit = Math.min((vw * dpr) / GAME_W, (vh * dpr) / GAME_H);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const cssW = (GAME_W * scale) / dpr;
  const cssH = (GAME_H * scale) / dpr;
  return {
    scale,
    dpr,
    cssW,
    cssH,
    left: Math.round((vw * dpr - GAME_W * scale) / 2) / dpr,
    top: Math.round((vh * dpr - GAME_H * scale) / 2) / dpr,
    safeTop: 0,
    safeBottom: safe.b ?? 0,
    safeLeft: safe.l ?? 0,
    safeRight: safe.r ?? 0,
  };
}

describe('the sharper reveal: its layer', () => {
  it('is k = 2: 654 x 300 fine px', () => {
    expect(HD_K).toBe(2);
  });

  it('sits exactly over the game canvas on an iPhone 16 Pro held sideways (8x): 4 device px per fine px', () => {
    const l = layout(874, 402, 3, { l: 22, r: 22, b: 8 });
    expect(l.scale).toBe(8);
    const r = hdLayerRect(l);
    expect({ left: r.left, top: r.top, cssW: r.cssW, cssH: r.cssH }).toEqual({ left: l.left, top: l.top, cssW: l.cssW, cssH: l.cssH });
    expect({ w: r.w, h: r.h }).toEqual({ w: 654, h: 300 });
    expect(r.devPerFine).toBe(4);
    expect(r.exact).toBe(true);
    // the safe area, in fine px
    expect({ L: r.L, R: r.R, B: r.B }).toEqual({ L: 44, R: (GAME_W - 22) * 2, B: (GAME_H - 8) * 2 });
  });

  it('follows the layout: a desktop window at 3x is uneven (1.5 device px per fine px), 4x is exact', () => {
    const d3 = hdLayerRect(layout(1000, 460, 1));
    expect(d3.devPerFine).toBe(1.5);
    expect(d3.exact).toBe(false);
    const d4 = hdLayerRect(layout(1400, 620, 1));
    expect(d4.devPerFine).toBe(2);
    expect(d4.exact).toBe(true);
    // a tiny window (a fractional fit): finer than the screen, not exact
    const tiny = hdLayerRect(layout(200, 100, 1));
    expect(tiny.exact).toBe(false);
    expect(tiny.w).toBe(GAME_W * 2);
  });

  it('works for any k: k = 4 on the phone is 1308 x 600 at 2 device px per fine px', () => {
    const r = hdLayerRect(layout(874, 402, 3), 4);
    expect({ w: r.w, h: r.h, devPerFine: r.devPerFine, exact: r.exact }).toEqual({ w: 1308, h: 600, devPerFine: 2, exact: true });
  });

  it('maps game px onto whole fine px, and a client point back to the same game px as the game canvas does', () => {
    expect(toFine(10)).toBe(20);
    expect(toFine(10.5)).toBe(21);
    expect(toFine(0.24)).toBe(0);
    const l = layout(874, 402, 3);
    const r = hdLayerRect(l);
    expect(layerToGame(r, l.left, l.top)).toEqual({ x: 0, y: 0 });
    const br = layerToGame(r, l.left + l.cssW, l.top + l.cssH);
    expect(br.x).toBeCloseTo(GAME_W, 6);
    expect(br.y).toBeCloseTo(GAME_H, 6);
  });

  it('knows when the canvas needs no change', () => {
    const a = hdLayerRect(layout(874, 402, 3));
    expect(sameLayer(null, a)).toBe(false);
    expect(sameLayer(a, hdLayerRect(layout(874, 402, 3)))).toBe(true);
    expect(sameLayer(a, hdLayerRect(layout(932, 430, 3)))).toBe(false);
  });
});

describe('the sharper reveal: the setting', () => {
  it('defaults to the old reveal: only a stored "hd" picks the new one', () => {
    expect(readChestReveal(null)).toBe('old');
    expect(readChestReveal(undefined)).toBe('old');
    expect(readChestReveal('new')).toBe('old');
    expect(readChestReveal(true)).toBe('old');
    expect(readChestReveal('hd')).toBe('hd');
    // no storage at all (here): the old one
    expect(loadChestReveal()).toBe('old');
  });
});

const fromRows = (rows: string[]): Mask => ({ w: rows[0].length, h: rows.length, on: (x, y) => rows[y]?.[x] === '#' });
const toRows = (m: Mask): string[] => Array.from({ length: m.h }, (_, y) => Array.from({ length: m.w }, (_, x) => (m.on(x, y) ? '#' : '.')).join(''));

describe('the sharper reveal: its lettering (Scale2x of the game font)', () => {
  it('doubles a lone pixel into a 2x2 block, and a stem into a stem twice as wide with rounded ends', () => {
    expect(toRows(scale2x(fromRows(['#'])))).toEqual(['##', '##']);
    // (its ends' convex corners are cut: a stem's end comes out rounded)
    expect(toRows(scale2x(fromRows(['##', '##', '##'])))).toEqual(['.##.', '####', '####', '####', '####', '.##.']);
  });

  it('rounds a diagonal step instead of leaving a staircase of blocks', () => {
    expect(toRows(scale2x(fromRows(['#.', '.#'])))).toEqual(['##..', '###.', '.###', '..##']);
    // a convex corner gets a cut (an "L" of three pixels keeps its inner corner filled)
    expect(toRows(scale2x(fromRows(['##', '#.'])))).toEqual(['.###', '####', '###.', '##..']);
  });

  it('keeps the game font\'s widths: level 1 is 2x (14 px caps, bold scale 1), level 2 is 4x (28 px caps)', () => {
    for (const s of ['Legendary', 'New hero!', 'Vesper', 'Next (4)']) {
      const g = glyphMask(s, true);
      const m1 = hdTextMask(s, 1);
      const m2 = hdTextMask(s, 2);
      expect({ w: m1.w, h: m1.h, cap: m1.cap }).toEqual({ w: g.w * 2, h: g.h * 2, cap: 14 });
      expect({ w: m2.w, h: m2.h, cap: m2.cap }).toEqual({ w: g.w * 4, h: g.h * 4, cap: 28 });
    }
    expect(hdTextMask('Max', 1, false).cap).toBe(10);
  });

  it('lights the top of a glyph and deepens its foot', () => {
    const lum = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);
    const col = 0xffa030;
    const deep = 0x8a3a0a;
    const rows = Array.from({ length: 14 }, (_, y) => lum(rampRow(y, 14, col, deep)));
    expect(rows[0]).toBeGreaterThan(rows[3]);
    expect(rows[3]).toBeGreaterThanOrEqual(rows[8]);
    expect(rows[8]).toBeGreaterThan(rows[13]);
  });
});
