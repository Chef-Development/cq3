// Region 5's relic and tag icons (see docs/art-style.md), drawn like art-relics-ash.ts's: a 10x10 character map per
// relic stamped at (1, 1) on a 12x12 square, toCanvas adds the ink outline; 5x5 maps for the two tags' 7x7 chips. The
// Mirage relics are sand and pale haze (things that aren't where they seem), the Heat relics white-hot gold and
// orange; the shade and the water in them are cool and deep (L7: warm light is the accent, shadow is cool).
//
//   relic_${id}   for every relic in data/relics-noon.ts (keyed by id, as relic-ui.ts's relicIcon reads them)
//   tag_mirage, tag_heat
//
// buildNoonRelicArt runs after art-relics.ts's buildRelicArt, so these replace the stand-ins drawn for the same ids
// (they're painted whether or not the region is in play: sixteen small canvases).
import { NOON_RELICS } from '../data/relics-noon';
import { grid, stamp, toCanvas, type Pal } from './art';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

const PAL: Pal = {
  k: '#140c1c',
  W: '#ffffff',
  // sand and aged paper
  1: '#3a2c22', 2: '#5e4a36', 3: '#94785a', 4: '#c4a87e', 5: '#ddc69c',
  // haze (the mirage's pale shimmer)
  C: '#4a7a98', t: '#9ac4d8', T: '#dcf0f6',
  // heat: ember to white-hot
  o: '#8a2a14', O: '#c8501c', p: '#ec8624', P: '#ffbe46', F: '#fff0b0',
  // gold (coins)
  g: '#d8981c', G: '#ffe48a',
  // leaf green
  e: '#24482c', E: '#4a7e36', f: '#8ab048',
  // deep cool water and shade
  A: '#142a40', D: '#2e6890', s: '#86c8e8',
  // the meter's violet
  V: '#8a4cc0', w: '#dab0ff',
  // leather and wood
  d: '#3e2416', h: '#6a4024', H: '#96643a',
  // brass
  y: '#a8781c',
  // crit lemon
  '*': '#ffe840',
};

const RELIC_ICONS: Record<string, string[]> = {
  // ---------------------------------------------------------------- Mirage
  // a scrap of map with an oasis drawn on it: a palm and a pool
  oasisMap: ['.44444444.', '4555E55554', '45EfffE554', '45E5h5E554', '4555h55554', '4555h55554', '45DDDDDD54', '4DssssssD4', '45DDDDDD54', '.44444444.'],
  // a brass lens, the haze wavering through it, a crit's spark
  hazeLens: ['..yyyy..*.', '.yTttTy***', 'yTtCtCty*.', 'ytCtCtCy..', 'yTtCtCty..', '.yTttTy...', '..yyyyH...', '......HH..', '.......HH.', '........Hd'],
  // an hourglass holding its sand (the mirages wait longer)
  sandGlass: ['.dhHHHHhd.', '..T3443T..', '..T4444T..', '...T44T...', '....TT....', '...T4.T...', '..T.4..T..', '..T.34.T..', '.dhHHHHhd.', '..........'],
  // a footprint in the sand and its ghost a step ahead, the meter's violet
  ghostStep: ['......V.V.', '......VwV.', '......VVV.', '.......VV.', '...t...VV.', '.2.2..t...', '.232......', '.222......', '..22......', '..22......'],
  // a sand dollar, five petals, a glint of gold
  sandDollar: ['...3333...', '.33G42433.', '.34442443.', '3442444243', '34444k4443', '3444444443', '3442444243', '.34444443.', '.33444433.', '...3333...'],
  // a whirl of sand and haze twisting up off the dunes (no foot: an hourglass is the Sand Glass)
  dustDevil: ['..43344334', '...t4334t.', '...3443...', '....t43...', '....34....', '...t4.....', '...43.....', '....3.....', '..2.3.2...', '.2.2322.2.'],
  // a castle standing in the air over the dunes, the haze under it
  fataMorgana: ['.T.T..T.T.', '.TTT..TTT.', '.TCTTTTCT.', '.TTTkkTTT.', '..t.t.t.t.', '.t.t.t.t..', '..........', '....33....', '..334443..', '3344444433'],
  // ---------------------------------------------------------------- Heat
  // a parasol and the cool pool of shade under it
  sunshade: ['...oOOo...', '..oOpOpo..', '.oOpOpOpo.', '..o..h..o.', '.....h....', '.....h....', '.....h....', '.....h....', '..AAAhAA..', '.AAAAAAAA.'],
  // a drop of spring water over its pool, a green heal
  coolSpring: ['...s....E.', '..sDs..EfE', '..sDs...E.', '.sDDDs....', '.DDsDD....', '..ADA.....', '..........', '..s.DD.s..', '.ADDDDDDA.', '..AAAAAA..'],
  // a flame on crossed sticks, the meter's spark
  kindling: ['....P.....', '...PFP..w.', '...pFp.wVw', '..pPFPp.w.', '..OpPpO...', '..oOpOo...', 'Hh.oOo.hH.', '.HHh.hHH..', '..hHHHh...', '.hd....dh.'],
  // a shard of the sun, white-hot at its heart, sparking
  sunShard: ['....P.....', '...PF..*..', '...PFF***.', '..pPFWF*..', '..pPFWF...', '..pPPFF...', '..opPF....', '...oPF....', '...oO.....', '....o.....'],
  // a leather purse with a sun on it, a coin at its foot
  sunPurse: ['...h..h...', '....hh....', '...dhhd...', '..dHHHHd..', '.dHHPHHHd.', '.dHPFPHHd.', '.dHHPHHHd.', '.dhHHHHhd.', '..dddddgG.', '.......gg.'],
  // a palm and the deep shade it throws
  shadeTree: ['..eE.Ee...', '.eEfEfEe..', 'eE.EhE.Ee.', 'e...h...e.', '....h.....', '.....h....', '.....h....', '.....h....', '.AAAAhAAA.', '..AAAAAA..'],
  // the sun at the top of the sky, a nail driven through it
  noonday: ['....P.....', '.P..k..P..', '..PFkFP...', '..FWkWF...', 'PFWWkWWFP.', '..FWkWF...', '..PFkFP...', '.P..k..P..', '....k.....', '....k.....'],
};

const TAG_ICONS: Record<string, string[]> = {
  mirage: ['.tt..', 't..tt', '.....', '.TT..', 'T..TT'],
  heat: ['..P..', '.PFP.', 'pPFPp', 'OpPpO', '.OOO.'],
};

/** Stamp a map of `n` x `n` at (1, 1) on a square `n + 2` wide; toCanvas adds the outline. */
function icon(rows: string[], n: number, key: string): HTMLCanvasElement {
  if (rows.length !== n || rows.some((r) => r.length !== n)) throw new Error(`${key}: the map must be ${n}x${n}`);
  const g = grid(n + 2, n + 2);
  stamp(g, rows, PAL, 1, 1);
  return toCanvas(g);
}

/** Region 5's relic icons (`relic_${id}`) and its two tags' chips (`tag_mirage`, `tag_heat`). */
export function buildNoonRelicArt(add: Add): void {
  for (const r of NOON_RELICS) {
    const rows = RELIC_ICONS[r.id];
    if (rows) add(`relic_${r.id}`, icon(rows, 10, `relic_${r.id}`));
  }
  for (const [tag, rows] of Object.entries(TAG_ICONS)) add(`tag_${tag}`, icon(rows, 5, `tag_${tag}`));
}

/** The relic ids painted here, and the maps (a unit test checks every Region 5 relic has a 10x10 one). */
export const NOON_RELIC_ICONS: Readonly<Record<string, string[]>> = RELIC_ICONS;
export const NOON_TAG_ICONS: Readonly<Record<string, string[]>> = TAG_ICONS;
