// Gear art (see docs/art-style.md): an icon for every base item (`item_${icon}`, ITEM_ICON_SIZE square, 1px ink
// outline included, transparent background; the bag draws the rarity frame around it, and the Legendary reveal card
// shows them at 2x). Each icon is a 10x10 character map (light from the top left, hue-shifted ramps) stamped at
// (1, 1); toCanvas adds the outline. Weapons point up and to the right. The two sets share a motif: Greenwarden is
// leaf green with gold veins, Footpad is charcoal purple with a silver glint. Signature drops are gold and glow.
import { BASE_ITEMS } from '../data/gear';
import { grid, stamp, toCanvas, type Pal } from './art';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Item icons are this many px square (outline included). */
export const ITEM_ICON_SIZE = 12;

// One palette for every icon (letters grouped by material, each a short hue-shifted ramp, dark -> light).
const PAL: Pal = {
  k: '#140c1c', // interior ink
  // steel
  1: '#2a2f45', 2: '#4a5272', 3: '#7c86a6', 4: '#b8c2d8', 5: '#eef3fa', W: '#ffffff',
  // gold
  z: '#5a3410', Y: '#9a5a14', y: '#d8901c', g: '#f2c230', G: '#fff0a0',
  // leather
  a: '#2a1810', d: '#4a2c18', h: '#6e4426', H: '#98663a', j: '#c0905a', J: '#e0bc84',
  // red
  x: '#4a0f1a', R: '#8a1a22', r: '#d03030', q: '#f05a48', Q: '#ff9a80',
  // leaf green
  n: '#1e3c2a', N: '#2e5a32', e: '#4a7e36', E: '#78a83c', f: '#b4d058',
  // blue
  b: '#1a3c8a', B: '#2a6ad8', l: '#4aa0f0', L: '#9ad8ff',
  // Footpad charcoal purple
  u: '#1e1828', U: '#2e2640', v: '#463a5c', V: '#63557e', w: '#8e80aa',
  // glowing teal (golem runes)
  s: '#14524e', t: '#22a098', T: '#62e4d4', i: '#d8fff6',
  // stone and moss
  o: '#34344a', O: '#545264', c: '#78747c', C: '#a09a96', D: '#c8c0b2', m: '#2a5230', M: '#447436',
  // cream cloth / ivory
  K: '#6a5a4a', Z: '#a8967a', X: '#d8c8a8', A: '#f4ead4',
  // pendulum brass (yellower than gold)
  6: '#6e4a14', 7: '#b07c22', 8: '#e0b040', 9: '#f8dc70', 0: '#fffad0',
  // fire
  P: '#f27a1c', F: '#ffb02a', I: '#fff8d0',
  // marsh rubber (teal night)
  '%': '#162a32', '&': '#23404a', '+': '#355a60', '=': '#4e7a78',
};

const ICONS: Record<string, string[]> = {
  // ---------------------------------------------------------------- weapons
  shortsword: [
    '........5W',
    '.......543',
    '......543.',
    '.....543..',
    '....543...',
    '.Gg543....',
    '..yg......',
    '.HHyg.....',
    'Hh..y.....',
    'gY........',
  ],
  saber: [
    '.........5',
    '........54',
    '........43',
    '.......543',
    '......543.',
    '....5543..',
    '..gg433...',
    '.gEeg.....',
    'gEe.g.....',
    'yggY......',
  ],
  axe: [
    '.45....j..',
    '4554..jH..',
    '5W44324h..',
    '5544324h..',
    '4543..Hh..',
    '.43...Hh..',
    '......Hh..',
    '......dJ..',
    '......Hh..',
    '......hd..',
  ],
  spear: [
    '........4W',
    '.......543',
    '.....55432',
    '......432.',
    '....gy....',
    '..fHh.....',
    '..HhE.....',
    '.Hh.......',
    'HhE.......',
    'h.........',
  ],
  shiv: [
    '.......W..',
    '......W5W.',
    '.......W21',
    '......521.',
    '.....521..',
    '..w.521...',
    '...w11....',
    '..VvU.....',
    '.Vvu......',
    'wU........',
  ],
  cutlass: [
    '.G.......4',
    'GWG.....45',
    '.G.....454',
    '......4543',
    '....45543.',
    '..y5543...',
    '.gG543....',
    'gGkgy.....',
    'gkhky.....',
    '.gyYz.....',
  ],
  // ---------------------------------------------------------------- helms
  cap: [
    '..........',
    '...jJJH...',
    '..jJJjHh..',
    '.jJjjHhhd.',
    '.jjjjHhhd.',
    '.HHHHhhdd.',
    'dJhJhJhJhd',
    'dhhhhhhhhd',
    '.hd....hd.',
    '.a......a.',
  ],
  pothelm: [
    '..........',
    '...4443...',
    '..454432..',
    '..454432..',
    '..444332..',
    '..k3k3k2..',
    '4555444332',
    '2333322221',
    '..........',
    '..........',
  ],
  plume: [
    '.......AA.',
    '......A.XA',
    '.....AX..X',
    '..qqrAX...',
    '.qqrrrR...',
    '.qrrrrRR..',
    '.yggyyyY..',
    'qqrrrrrRRx',
    '.RRRRRxx..',
    '..........',
  ],
  hood: [
    '....eE....',
    '...eEEe...',
    '..eEgEEe..',
    '.eEgEgEeN.',
    '.EgEnnEgN.',
    'eEEnkknEgN',
    'eEnkkkknEN',
    'gEnkkkknEg',
    'eEgnkkngEN',
    '.NNNNNNNN.',
  ],
  tuskcrown: [
    'A........A',
    'AX......AZ',
    '.AX..G..XZ',
    '.AX.gGg.XZ',
    '..AgGrgYZ.',
    '.gGg.g.gyY',
    '.gGggggyyY',
    '.yrygyyryY',
    '.YYYYYYYYz',
    '..........',
  ],
  // ---------------------------------------------------------------- armor
  vest: [
    '.##....##.',
    '.###..###.',
    '####..####',
    '#####J####',
    '####h#####',
    '#####J####',
    '####h#####',
    '#####J####',
    '##########',
    '..........',
  ],
  ringmail: [
    '...hJJh...',
    '.##h..h##.',
    '##########',
    '##########',
    '.########.',
    '..######..',
    '..dHHHyd..',
    '..######..',
    '..######..',
    '..........',
  ],
  cuirass: [
    '.Hj....jh.',
    'HJeH..Hjhd',
    'HjeEfHjjhd',
    '.HjrEjjhd.',
    '.HjjnEfhd.',
    '..HjjnEd..',
    '.HjjjjnEd.',
    '.dhdhdhrd.',
    '..........',
    '..........',
  ],
  leafmail: [
    '...g..g...',
    '.##g..g##.',
    '##########',
    '##########',
    '.########.',
    '.########.',
    '.########.',
    '.########.',
    '.EnEnEnEn.',
    '..........',
  ],
  golemplate: [
    '.ME....EM.',
    'MfMC..CEMm',
    'DCooCoocOo',
    'CoTToTtocO',
    'CoTiTTtocO',
    '.CoTTtoco.',
    '.CcoToccO.',
    '.CCcoccOo.',
    '.cOoOoOoo.',
    '..........',
  ],
  // ---------------------------------------------------------------- boots
  boots: [
    '....jJjH..',
    '....HjjHh.',
    '....hHHhd.',
    '....hHHhd.',
    '....hHjjd.',
    '...hHHjjd.',
    '.hHHHHHhd.',
    'jHHHHHhhd.',
    'ddddddddd.',
    '..........',
  ],
  hobnail: [
    '....hHhh..',
    '....dhhd..',
    '....dhhda.',
    '....dhhda.',
    '....dhhda.',
    '...dhhhda.',
    '.43dhhhda.',
    '3433dddda.',
    'aaaaaaaaa.',
    '.4.4.4.4..',
  ],
  waders: [
    '...HygHH..',
    '...=++&%..',
    '...=+&&%..',
    '...=+&&%..',
    '...=+&&%..',
    '...=+&&%..',
    '.=++&&&%..',
    'h+hh&&h%..',
    'adadddda..',
    '..........',
  ],
  treads: [
    '...fE.Ef..',
    '...EfgfE..',
    '....eEgn..',
    '....Egen..',
    '....eEgn..',
    '...Egeen..',
    '.eEEgeEn..',
    'EEgEEEen..',
    'nnnnnnnn..',
    '..........',
  ],
  // ---------------------------------------------------------------- trinkets
  clover: [
    '.fE...fE..',
    'fEEe.fEEe.',
    'fEEenEEen.',
    '.eenEnnn..',
    '.fEnEnEe..',
    'fEEenEEen.',
    'fEEe.eEen.',
    '.ee...nhh.',
    '........h.',
    '..........',
  ],
  owlcharm: [
    '....gy....',
    '.L..yY..b.',
    '.LllBBBBb.',
    '.lGglBGgb.',
    '.lgklBgkb.',
    '.lBByYBBb.',
    '..bBBBBb..',
    '...LAAb...',
    '..LAl.lb..',
    '..A....b..',
  ],
  locket: [
    '...yy.....',
    '..y..y....',
    '...yg.....',
    '..gGggyY..',
    '.gGgrrgyY.',
    '.gGrIFryY.',
    '.gyrFPRyY.',
    '..yyRRyY..',
    '...YYYY...',
    '..........',
  ],
  cog: [
    '...g..y...',
    '..gGggyy..',
    '.gGgyygyY.',
    '..gyLbyY..',
    'gGgLBby.YY',
    '.ggybbyyY.',
    '..yyyyyY..',
    '.yYyYYyYY.',
    '...Y..Y...',
    '..........',
  ],
  whetstone: [
    '..hh......',
    '.h..h.....',
    '..34......',
    '.3442.....',
    '.DCCo.....',
    '.DWCco....',
    '.CCWco....',
    '.CCcWo....',
    '.COcco....',
    '..ooo.....',
  ],
  sprig: [
    '.......fE.',
    '......fEe.',
    '..fE..ggn.',
    '.fgEg.h...',
    '.Eeen.h...',
    '....hH....',
    '...hH.fE..',
    '..hH.fgge.',
    '.hH..Eeen.',
    '.h........',
  ],
  die: [
    '....wV....',
    '..wwwwVV..',
    'VwwwWWwwVV',
    'vvwwwwVVuU',
    'vvvvwVuuuU',
    'vWvvvuuWuU',
    'vvvvvuuuuU',
    'vvvvWuuuWU',
    '.vvvvuuuU.',
    '...vvuU...',
  ],
  shard: [
    '...980..G.',
    '..90087GWG',
    '.9AX887.G.',
    '.0XA887...',
    '90AX8I76..',
    '90XI087766',
    '.9A8I876..',
    '.9888776..',
    '..97766...',
    '...76.....',
  ],
};

// Procedural materials for '#' pixels, per icon: [x, y] -> a palette letter.
const FILL: Record<string, (x: number, y: number) => string> = {
  // quilted cloth: lit on the left, a diamond lattice of stitched seams one tone darker
  vest: (x, y) => {
    const base = x + y * 0.3 < 3 ? 0 : x < 6 ? 1 : 2;
    const seam = (x + y) % 4 === 1 || (x - y + 40) % 4 === 1;
    return 'AXZK'[Math.min(3, base + (seam ? 1 : 0))];
  },
  // riveted rings: a checker of lit and shaded links, lit on the upper left
  ringmail: (x, y) => {
    const base = x < 3 ? 4 : x < 7 ? 3 : 2;
    return String(((x + y) & 1 ? base : base - 1) - (y > 6 ? 1 : 0));
  },
  // leaf scales: green with a gold midrib and gold chevron veins
  leafmail: (x, y) => {
    if (x === 4 || x === 5) return y < 3 ? 'g' : x === 4 ? 'E' : 'e';
    const vein = (x < 4 ? 4 - x : x - 5) === (y - 2) % 4 + 0;
    if (vein && y > 1) return 'g';
    return x < 2 ? 'f' : x < 5 ? 'E' : x < 8 ? 'e' : 'N';
  },
};

function icon(key: string): HTMLCanvasElement {
  const f = FILL[key];
  const rows = ICONS[key].map((r, y) => [...r].map((ch, x) => (ch === '#' && f ? f(x, y) : ch)).join(''));
  const g = grid(ITEM_ICON_SIZE, ITEM_ICON_SIZE);
  stamp(g, rows, PAL, 1, 1);
  return toCanvas(g);
}

export function buildGearArt(add: Add): void {
  const done = new Set<string>();
  for (const b of BASE_ITEMS) {
    if (done.has(b.icon)) continue;
    done.add(b.icon);
    if (!ICONS[b.icon]) throw new Error(`no icon for ${b.icon}`);
    add(`item_${b.icon}`, icon(b.icon));
  }
}
