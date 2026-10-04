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
