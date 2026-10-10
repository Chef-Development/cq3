// Currency and rating icons in the HUD icons' style (see art.ts HUD_ICONS: native-size character maps with the ink
// outline included, drawn with view/pixels.ts hudIcon(g, key, x, y)). art.ts spreads these into HUD_ICONS, so
// hudIcon and iconSize take the keys like any other HUD icon. This module imports nothing from art.ts (HUD_ICONS is
// built while the modules load).
//
//   gem           11x10  a faceted pink-violet gem
//   shard         9x12   a hero shard: a sliver of crystal
//   star_on       9x9    a filled gold star (hero / companion star ratings)
//   star_off      9x9    the same star, empty (a dim slate socket)
//   badge_region  13x12  a laurel badge: a gold medal in a green wreath (a region at 100%)

const K = 0x140c1c;

/** Add a 1px ink outline ('k') around the filled pixels of an icon map. */
function outlined(rows: string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => {
    const c = rows[y - 1]?.[x - 1];
    return c !== undefined && c !== '.' ? c : null;
  };
  const out: string[] = [];
  for (let y = 0; y < rows.length + 2; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += at(x, y) ?? (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'k' : '.');
    out.push(r);
  }
  return out;
}

const STAR = ['...G...', '..GGg..', 'GGGWggy', '.GggyY.', '..gyy..', '.gy.yY.', '.y...Y.'];

export const CURRENCY_ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  // a brilliant-cut gem: a flat table, the crown's facets, the girdle, the pavilion narrowing to a point
  gem: {
    rows: outlined([
      '..WWLLl..',
      '.WWLLlpP.',
      'WLLLlppPP',
      'LLllpppPD',
      '.LlppPPD.',
      '..lpPPD..',
      '...pPD...',
      '....D....',
    ]),
    pal: { k: K, W: 0xfff0fa, L: 0xff9ae0, l: 0xf05ac8, p: 0xc03aa8, P: 0x8a2a9a, D: 0x541a6e },
  },
  // a sliver of crystal, tip up and to the right, lit along its left face
  shard: {
    rows: outlined(['......W', '.....WL', '....WLl', '...WLlb', '..WLlbB', '..LlbB.', '.LlbB..', '.lbB...', 'lbB....', 'B......']),
    pal: { k: K, W: 0xe0faff, L: 0x8ae0ff, l: 0x3aa8f4, b: 0x1e6ad0, B: 0x123a7a },
  },
  star_on: { rows: outlined(STAR), pal: { k: K, W: 0xffffff, G: 0xfff0a0, g: 0xf2c230, y: 0xd8901c, Y: 0x9a5a14 } },
  star_off: { rows: outlined(STAR), pal: { k: K, W: 0x5e5874, G: 0x5e5874, g: 0x48425c, y: 0x38334a, Y: 0x2a2638 } },
  // two laurel branches curving up round a gold medal with a white star
  badge_region: {
    rows: outlined([
      'e.........e',
      'Ee.GGGgg.eE',
      '.EGGWGggyE.',
      'EeGWWWggyeE',
      '.EGGWgyyyE.',
      'EeGggyyyYeE',
      '.Ee.yyYY.eE',
      '..Ee....eE.',
      '...EerreE..',
      '....rRRr...',
    ]),
    pal: { k: K, E: 0x8ad050, e: 0x3e8a3a, G: 0xfff0a0, g: 0xf2c230, y: 0xd8901c, Y: 0x9a5a14, W: 0xffffff, r: 0xe04848, R: 0x9a1a2a },
  },
};
