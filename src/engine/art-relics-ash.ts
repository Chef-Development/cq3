// Region 3's relic and tag icons (see docs/art-style.md), drawn like art-relics.ts's: a 10x10 character map per relic
// stamped at (1, 1) on a 12x12 square, toCanvas adds the ink outline; 5x5 maps for the two tags' 7x7 chips. The Drift
// relics share ash grey and amber chevrons (things that slide), the Link relics iron chain glowing molten at the joints;
// each also carries its second tag's colour, as the other relics do.
//
//   relic_${id}   for every relic in data/relics-ash.ts (keyed by id, as relic-ui.ts's relicIcon reads them)
//   tag_drift, tag_link
//
// buildAshRelicArt runs after art-relics.ts's buildRelicArt, so these replace any stand-ins drawn for the same ids.
import { ASH_RELICS } from '../data/relics-ash';
import { grid, stamp, toCanvas, type Pal } from './art';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

const PAL: Pal = {
  k: '#140c1c',
  // steel
  1: '#2a2f45', 2: '#4a5272', 3: '#7c86a6', 4: '#b8c2d8', 5: '#eef3fa', W: '#ffffff',
  // gold (coins)
  z: '#5a3410', Y: '#9a5a14', y: '#d8901c', g: '#f2c230', G: '#fff0a0',
  // leather and wood
  a: '#2a1810', d: '#4a2c18', h: '#6e4426', H: '#98663a', j: '#c0905a',
  // red (a red block)
  x: '#4a0f1a', R: '#8a1a22', r: '#d03030', q: '#f05a48', Q: '#ff9a80',
  // leaf green
  n: '#1e3c2a', N: '#2e5a32', e: '#4a7e36', E: '#78a83c', f: '#b4d058',
  // fire
  o: '#a8241c', O: '#e0461c', p: '#f87a1e', P: '#ffb02a', F: '#ffe070', I: '#fff8d0',
  // combo: cyan
  c: '#0e3a5a', C: '#1a7aa8', t: '#3ac0e0', T: '#9af0ff',
  // finisher: violet
  u: '#2a1440', U: '#4a2470', v: '#7a3cb0', V: '#a86ae0', w: '#dab0ff',
  // sustain: heart pink
  6: '#5a1430', 7: '#a8284a', 8: '#e0506a', 9: '#ff8aa0', 0: '#ffd0dc',
  // block: steel blue
  b: '#1a2a4a', B: '#2a4a7a', l: '#4a7ab0', L: '#8ab8e0', m: '#d0ecff',
  // risk: crimson and black
  '!': '#1a0a12', '@': '#3a0a1a', '#': '#7a0f26', $: '#c0203a', '%': '#ff5a6a',
  // crit: lemon
  '^': '#8a6a10', '&': '#d0b020', '*': '#ffe840', '+': '#fffcc0',
  // Drift: ash grey and amber chevrons
  '{': '#2e2628', '}': '#5a4c4e', '~': '#948480', '<': '#a85a1a', '>': '#f09a3a', '?': '#ffd890',
  // Link: chain iron
  '(': '#1a1620', ')': '#3a3442', '[': '#6a6274', ']': '#a8a0b4',
  // water (the warm spring)
  A: '#1a3c5a', D: '#3a78a8', s: '#8ad0f0',
};

const RELIC_ICONS: Record<string, string[]> = {
  // ---------------------------------------------------------------- Drift
  // a yellow block sliding along on a gust, chevrons showing the way
  tailwind: [
    '..~~~}....',
    '.....~}...',
    '.ggg......',
    'gGggY.>.>.',
    'gggyY..>.>',
    'gyyyY.>.>.',
    '.YYY......',
    '...~~~~}..',
    '.......~}.',
    '..........',
  ],
  // a weathervane's arrow swinging on its pole, a crit star at its tip
  weathervane: [
    '.*........',
    '*+*.......',
    '.*?>>.....',
    '..?<>>>>..',
    '.?<..1.>>.',
    '.....3....',
    '.....3....',
    '....131...',
    '...11311..',
    '..~~~~~}..',
  ],
  // a hot spring steaming, a heart in the steam
  warmSprings: [
    '.9.9.~..~.',
    '.989..~..~',
    '..8..~..~.',
    '.....~..~.',
    '..AADDDA..',
    '.ADsssDDA.',
    'ADssDsDDDA',
    '.ADDDDDDA.',
    '..AAAAAA..',
    '..........',
  ],
  // a block bouncing back off the bar's end, turning green
  rebound: [
    '........44',
    '.EEE....43',
    'EfEEe...43',
    'EEEen...43',
    '.een....43',
    '...<....43',
    '..<.>>..43',
    '.<....>.43',
    '..<..>>.43',
    '........11',
  ],
  // an anchor of stone and steel, holding fast
  anchorStone: [
    '....LL....',
    '...LmmB...',
    '....LB....',
    '..lLLLBB..',
    '....lB....',
    'l...lB...B',
    'Ll..lB..lB',
    '.Ll.lB.lB.',
    '..LLlBBB..',
    '....BB....',
  ],
  // a streamlined drop racing along, speed lines behind it
  slipstream: [
    '..........',
    '.....wV...',
    '.~~.wVVU..',
    '...wVvvU..',
    '.~wVvvvvU.',
    '...wvvvU..',
    '.~~.UvU...',
    '.....U....',
    '..~~~}....',
    '..........',
  ],
  // a coin bobbing along on the drift
  flotsam: [
    '...yyY....',
    '..yGgyY...',
    '..ygGyY...',
    '..yggyY...',
    '...YYY....',
    '.sD..sD...',
    'DsDDsDsDDs',
    'ADDADDADDA',
    '.AA.AA.AA.',
    '..........',
  ],
  // a molten orb, its crust cracking, a crimson rim
  moltenCore: [
    '...@##@...',
    '..@$pp$@..',
    '.@$FIIp$@.',
    '.#pIIIFp#.',
    '.#FIIFpo#.',
    '.@$FppO$@.',
    '..@$oo$@..',
    '...@##@...',
    '..>....<..',
    '.>......<.',
  ],
  // ---------------------------------------------------------------- Link
  // two chain links forged together, a spark of combo at the joint
  forgedBond: [
    '..........',
    '.]]]].....',
    '](..)]....',
    ']....]....',
    ']...[]))).',
    '.[[[[T..).',
    '...T)...).',
    '....)...).',
    '.....)))).',
    '..........',
  ],
  // a slow match: a coil of cord, its end smouldering
  slowMatch: [
    '.......PF.',
    '......pI..',
    '.....hp...',
    '..jHHh....',
    '.jh..Hh...',
    'jh.jj.Hh..',
    'jh.hh.Hh..',
    '.jh..Hh...',
    '..hHHh....',
    '..........',
  ],
  // a hammer and tongs crossed over a crit spark
  hammerTongs: [
    '.344....3.',
    '.3443..3..',
    '..44h.3...',
    '....h3....',
    '...3*h....',
    '..3*+*h...',
    '.3..*..h..',
    '3......Hh.',
    '........Hh',
    '.........h',
  ],
  // a spare link with a heart in its eye
  spareLink: [
    '..]]]]]...',
    '.](...)]..',
    '](.....)].',
    '](.989.)].',
    '](.888.)].',
    '](..8..)].',
    '](.....)].',
    '.[(...)[..',
    '..[[[[[...',
    '..........',
  ],
  // a coupling: two hooks linked, a violet stack banked between them
  coupling: [
    '..]]......',
    '.]..].....',
    '.]..].....',
    '..]].]....',
    '.....]wV..',
    '....VvU[..',
    '..[[.U[...',
    '.[..[.....',
    '.[..[.....',
    '..[[......',
  ],
  // gold rivets driven through a plate of iron
  goldRivets: [
    '..........',
    '.[[[[[[[).',
    '.[gY]]gY).',
    '.[Yz]]Yz).',
    '.[]]]]]]).',
    '.[gY]]gY).',
    '.[Yz]]Yz).',
    '.[]]]]]]).',
    '.)))))))).',
    '..........',
  ],
  // a chain snapping back, flinging a red away
  snapBack: [
    '..........',
    '..rq....lB',
    '.rQqr..lB.',
    '..rq..lB..',
    '.....lB...',
    '..]].B..L.',
    '.](.]...l.',
    '.]..]..lB.',
    '..]].]]B..',
    '.....](...',
  ],
  // a fuse on a hair-thin trigger, a crimson skull of a risk
  hairTrigger: [
    '.......F..',
    '......pI..',
    '.....].p..',
    '....]..)..',
    '...]...)..',
    '.$$$$..)..',
    '$%$%$$.)..',
    '$!$!$$))..',
    '.$$$$.....',
    '.$.$......',
  ],
};

const TAG_ICONS: Record<string, string[]> = {
  drift: ['>.>..', '.>.>.', '..>.>', '.>.>.', '>.>..'],
  link: [']]...', '](]..', '.]]))', '..)()', '..)))'],
};

/** Stamp a map of `n` x `n` at (1, 1) on a square `n + 2` wide; toCanvas adds the outline. */
function icon(rows: string[], n: number, key: string): HTMLCanvasElement {
  if (rows.length !== n || rows.some((r) => r.length !== n)) throw new Error(`${key}: the map must be ${n}x${n}`);
  const g = grid(n + 2, n + 2);
  stamp(g, rows, PAL, 1, 1);
  return toCanvas(g);
}

/** Region 3's relic icons (`relic_${id}`) and its two tags' chips (`tag_drift`, `tag_link`). */
export function buildAshRelicArt(add: Add): void {
  for (const r of ASH_RELICS) {
    const rows = RELIC_ICONS[r.id];
    if (rows) add(`relic_${r.id}`, icon(rows, 10, `relic_${r.id}`));
  }
  for (const [tag, rows] of Object.entries(TAG_ICONS)) add(`tag_${tag}`, icon(rows, 5, `tag_${tag}`));
}

/** The relic ids painted here (tests check every Region 3 relic has one). */
export const ASH_RELIC_ICON_IDS = Object.keys(RELIC_ICONS);
