// Single-color 7x7 icons ('#' = filled): each enemy's mark (stamped on its red blocks in group fights and
// next to its HP bar), and the marks on the special blocks (spore, ward).
import { ICONS } from '../art';

export const FOE_ICONS: Record<string, string[]> = {
  drop: ICONS.drop,
  tusk: ICONS.tusk,
  mask: ICONS.mask,
  wing: ['.......', '#......', '##....#', '.###.##', '..#####', '...###.', '....#..'],
  arrow: ['....###', '.....##', '....#.#', '...#...', '..#....', '##.....', '#......'],
  spore: ['.#####.', '#######', '##.#.##', '#######', '..###..', '..###..', '..###..'],
  shell: ['..###..', '.#####.', '##.#.##', '#######', '##.#.##', '.#####.', '#.#.#.#'],
  fang: ['#.....#', '##...##', '#######', '.#####.', '.#.#.#.', '.#...#.', '.......'],
  leaf: ['....###', '..#####', '.####.#', '.###.##', '.#.####', '..###..', '##.....'],
  rune: ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  crown: ['.......', '#..#..#', '##.#.##', '#######', '#######', '.......', '.......'],
};

/** Marks on the special blocks: a spore (pop it!) and a shell piece (break it!). */
export const BLOCK_ICONS: Record<'spore' | 'ward', string[]> = {
  spore: FOE_ICONS.spore,
  ward: FOE_ICONS.shell,
};

/** Add a 1 px ink outline ('k') around the filled pixels of an icon map. */
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

const K = 0x140c1c;
const SKULL = ['.WWw.', 'WwwwS', 'KKwKK', 'wKwKS', '.wSS.'];

/** Small multi-color HUD icons (outline included), drawn with hudIcon like the big ones in art.ts. */
export const MINI_ICONS: Record<string, { rows: string[]; pal: Record<string, number> }> = {
  // 7x7: a foe still to fight in this wave
  foe: { rows: outlined(SKULL), pal: { k: K, W: 0xffffff, w: 0xe8e0cc, S: 0xb0a088, K: 0x3a2a3e } },
  // 7x7: a beaten foe (greyed)
  foeDone: { rows: outlined(SKULL), pal: { k: K, W: 0x6a6278, w: 0x564e66, S: 0x423c52, K: 0x1c1626 } },
  // 7x9: the boss of the wave
  boss: {
    rows: outlined(['G.G.G', 'GgGgG', ...SKULL.slice(1)]),
    pal: { k: K, G: 0xffe680, g: 0xd8901c, W: 0xffffff, w: 0xe8e0cc, S: 0xb0a088, K: 0x3a2a3e },
  },
  // 5x8: a revive potion
  potionS: {
    rows: outlined(['.h.', '.a.', 'aWa', 'pPp', 'pPP', '.P.']),
    pal: { k: K, h: 0x98663a, a: 0xc8b0e8, W: 0xffffff, p: 0xff7ac8, P: 0xd03a98 },
  },
  // 7x7: a shell / protection status
  shield: { rows: outlined(['WLLLl', 'WLbLl', 'LbbbL', '.LbL.', '..L..']), pal: { k: K, W: 0xffffff, L: 0x9ad8ff, l: 0x4aa0f0, b: 0x2a6ad8 } },
  // 7x7 stat icons (PLACEHOLDERS until the art pass): crit damage, meter gain, steady, luck, and scrap
  critx: { rows: outlined(['R.R.R', '.RYR.', 'RYWYR', '.RYR.', 'R.R.R']), pal: { k: K, R: 0xf05a48, Y: 0xffd23a, W: 0xffffff } },
  meter: { rows: outlined(['BBBBB', 'BLLLB', 'BLL.B', 'BBBBB']), pal: { k: K, B: 0x2a6ad8, L: 0x9ad8ff } },
  clock: { rows: outlined(['.WWW.', 'W.B.W', 'W.BBW', 'W...W', '.WWW.']), pal: { k: K, W: 0xeef3fa, B: 0x2a6ad8 } },
  clover: { rows: outlined(['.G.G.', 'GgGgG', '.GgG.', 'GgGgG', '..d..']), pal: { k: K, G: 0x78a83c, g: 0xb4d058, d: 0x4a2c18 } },
  scrap: { rows: outlined(['..S..', '.SsS.', 'SsTsS', 'sSTSs']), pal: { k: K, S: 0xb8c2d8, s: 0x7c86a6, T: 0xd8901c } },
  // 7x7: a tiny star (sparkle accents)
  star: { rows: outlined(['..W..', '.WYW.', 'WYYYW', '.WYW.', '..W..']), pal: { k: K, W: 0xffd23a, Y: 0xfff6c0 } },
};
