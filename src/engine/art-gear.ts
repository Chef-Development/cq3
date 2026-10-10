// Gear art (see docs/art-style.md): an icon for every base item (`item_${icon}`, ITEM_ICON_SIZE square, 1px ink
// outline included, transparent background; the bag draws the rarity frame around it, and the Legendary reveal card
// shows them at 2x). Each icon is a 10x10 character map (light from the top left, hue-shifted ramps) stamped at
// (1, 1); toCanvas adds the outline. Weapons point up and to the right. The two sets share a motif: Greenwarden is
// leaf green with gold veins, Footpad is charcoal purple with a silver glint, Emberwright soot-black leather stitched in
// ember orange with brass fittings. Signature drops are gold and glow.
import { BASE_ITEMS } from '../data/gear';
import { ASH_BASE_ITEMS } from '../data/gear-ash';
import { NOON_BASE_ITEMS } from '../data/gear-noon';
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
  // brass and the Atlas's gold ink (yellower than gold)
  6: '#6e4a14', 7: '#b07c22', 8: '#e0b040', 9: '#f8dc70', 0: '#fffad0',
  // fire
  P: '#f27a1c', F: '#ffb02a', I: '#fff8d0',
  // marsh rubber (teal night)
  '%': '#162a32', '&': '#23404a', '+': '#355a60', '=': '#4e7a78',
  // Region 3: obsidian (black glass, a violet sheen), ash cloth, the deep red of a lava crust
  '(': '#0c0812', ')': '#1e1628', '[': '#3e305a', ']': '#7a68a8',
  '{': '#3a3234', '}': '#5c5052', '~': '#8a7a78', '^': '#b8aaa2', '@': '#5a0e0e',
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
  // the Keystone Shard (story bible section 9): a broken wedge of the keystone's stone, the line he drew hardest still
  // glowing gold along its crack and dripping from its point (not the old pendulum weight)
  shard: [
    '.oCCDDDCo.',
    '.oCCD9CCo.',
    '..oC09COo.',
    '..oCC09Oo.',
    '...oC0Oo..',
    '...oC9Oo..',
    '....o90o..',
    '....oO0...',
    '.....o0G..',
    '......W...',
  ],
  // ---------------------------------------------------------------- Region 3 (data/gear-ash.ts)
  // a blade knapped from black glass, its edge chipped and gleaming violet; a leather-wrapped grip
  obsidian: [
    '........]W',
    '.......][)',
    '......][)(',
    '.....][)(.',
    '....][)(..',
    '.dd][)(...',
    '..H)(.....',
    '.HhH......',
    'Hh..d.....',
    'hd........',
  ],
  // a heavy cleaver of dark iron, its edge still glowing from the forge
  cleaver: [
    '..1222223.',
    '..1333334.',
    '..1333334.',
    '..1333334.',
    '..PPPPPPF.',
    '...hH.....',
    '..hH......',
    '.hH.......',
    'hH........',
    'h.........',
  ],
  // a sledge with a head of basalt, a hexagonal column on an ash-wood haft
  sledge: [
    '.....cC...',
    '....cCDc..',
    '...OcCDCc.',
    '....OcCCco',
    '.....OcCo.',
    '....jhOo..',
    '...jh.....',
    '..jh......',
    '.jh.......',
    'hh........',
  ],
  // a veil of grey ash cloth, a hood with a dark opening
  ashveil: [
    '...}}}}...',
    '..}~^~}{..',
    '.}~~}}}}{.',
    '.}~)))}{{.',
    '.}~)(()}{.',
    '.}}))))}{.',
    '..}}}}}{..',
    '.}~}}}}}{.',
    '}~}}}}}}{{',
    '{{{{{{{{{.',
  ],
  // a helm built of hexagonal basalt plates, a slit glowing across its visor
  basalthelm: [
    '...cCCc...',
    '..cCDDCc..',
    '.cCDCCcco.',
    '.OcCcccoo.',
    '.oOOOOOoo.',
    '.oPFPFPPo.',
    '.oOOOOOoo.',
    '.OO.oo.oo.',
    '..........',
    '..........',
  ],
  // a long coat of grey ashcloth, its collar turned up
  ashcoat: [
    '..}^..^}..',
    '.}~~}}~~}.',
    '}~~}{{}~}{',
    '}~}}{{}}}{',
    '.}~}{{}}{.',
    '.}~}{{}}{.',
    '.}}}{{}}{.',
    '.}}}{{}}{.',
    '.{{{..{{{.',
    '..........',
  ],
  // armour of black slag plates, molten seams between them
  slagplate: [
    '.cO....Oc.',
    'cCcO..OcCc',
    'cCCcOOcCCo',
    '.cC@PP@co.',
    '.cCcccCco.',
    '.c@PFFP@o.',
    '.cCcccCco.',
    '.cC@PP@co.',
    '..cccccc..',
    '..........',
  ],
  // light soles of grey pumice, full of little holes
  pumice: [
    '..........',
    '..}~~.....',
    '..}~^.....',
    '..}{~.....',
    '..}~~~....',
    '.}{~^~~...',
    '.}~{~{~^}.',
    '.{}~}~}~}.',
    '.{{{{{{{{.',
    '..........',
  ],
  // iron greaves, flames licking round the feet
  firewalk: [
    '..23......',
    '..343.....',
    '..343.....',
    '..343.....',
    '..3432....',
    '.234432...',
    '.2344432F.',
    'P1222221FP',
    'FPFPFPFPF.',
    '.I.F.I....',
  ],
  // a lump of coal, still glowing warm inside
  coal: [
    '..........',
    '...uUV....',
    '..uUVVU...',
    '.uPUVUUu..',
    '.uFPUUPu..',
    'uUIFPUFPu.',
    'uUFPUUPUu.',
    '.uUUPUUu..',
    '..uuuuu...',
    '..........',
  ],
  // a pearl of lava in a gold setting, glowing like a coal
  pearl: [
    '...yy.....',
    '..y..y....',
    '...yg.....',
    '..gGFgy...',
    '.gFIIFPy..',
    '.gFIFPRy..',
    '.gPFPRRy..',
    '..yPRRy...',
    '...yyy....',
    '..........',
  ],
  // ---- the Emberwright set: a smith's working kit, soot-black leather stitched in ember orange, brass fittings
  // a leather cap, brass goggles pushed up on it
  wrightcap: [
    '...dddd...',
    '..dHHHHd..',
    '.dHhhhhHd.',
    '.dhhhhhhd.',
    '.68788787.',
    '.7LL77LL7.',
    '.dhhhhhhd.',
    '.PaPaPaPa.',
    '..........',
    '..........',
  ],
  // a smith's apron, a brass buckle, a pocket of tools
  wrightapron: [
    '..6....6..',
    '..a....a..',
    '.ahhhhhha.',
    '.aHhhhhha.',
    '.aHh78hha.',
    '.aHhhhhha.',
    '.aHhaaaha.',
    '.aHha3aha.',
    '.ahhhhhha.',
    '.PaPaPaPa.',
  ],
  // wooden clogs with iron toes, stitched in ember orange
  wrightclogs: [
    '..........',
    '..........',
    '..HHj.....',
    '..Hhj.....',
    '..Hhjj....',
    '.HhhHjjj..',
    '.HhPhPhjP.',
    '.33hhhhhh.',
    '.1111111..',
    '..........',
  ],
  // a brass charm of a little hearth, its fire glowing
  hearthcharm: [
    '....66....',
    '...6..6...',
    '....67....',
    '..778877..',
    '.78PFFP87.',
    '.78FIIF87.',
    '.78PFFP87.',
    '.77777777.',
    '..6....6..',
    '..........',
  ],
  // ---- the boss's signature drops: gold and glowing
  // the titan's maul: a block of a head bound in gold bands, molten at its striking face
  titanmaul: [
    '.....1g...',
    '....12gF..',
    '...112gFI.',
    '....112FFI',
    '.....11gF.',
    '....jh11..',
    '...jh.....',
    '..jh......',
    '.jh.......',
    'hh........',
  ],
  // a furnace heart: a glowing ember of a heart in a cage of gold
  bellowsheart: [
    '.y.y..y.y.',
    'yPPy..yPPy',
    'yFIPyyPFPy',
    'yFIIPPFFPy',
    'yPFIIFFPPy',
    '.yPFFFPPy.',
    '..yPFPPy..',
    '...yPPy...',
    '....yy....',
    '..........',
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

/** Region 4's bases (reeds, marsh rubber, shell and lantern light; the Lighthouse's two signatures glowing),
 *  replacing the slot icons they borrowed (its Waders share Region 1's). */
const DUSK_ICONS: Record<string, string[]> = {
  reedspear: ['.........5', '........45', '.......34.', '......E3..', '.....Ee...', '....fe....', '...Ee.....', '..Ee......', '.fe.......', 'Ee........'],
  lanternmace: ['......2...', '.....2222.', '.....2FP2.', '.....2IF2.', '.....2222.', '....hH....', '...hH.....', '..hH......', '.hH.......', 'dh........'],
  peatmaul: ['....adddda', '....dhHhhd', '....dhhhhd', '....addMda', '.....h....', '....hH....', '...hH.....', '..hH......', '.hH.......', 'hh........'],
  snapperhelm: ['...nNNn...', '..nNeeNn..', '.nNeEEeNn.', '.NeEnnEeN.', '.NeeEEeeN.', '.kkkkkkkk.', '..N.kk.N..', '..NnkknN..', '...n..n...', '..........'],
  mosscowl: ['...MMMM...', '..MmMMmM..', '.MmMMMMmM.', '.MMkkkkMM.', '.MkkkkkkM.', '.MkTkkTkM.', '.MMkkkkMM.', 'MmMMMMMMmM', 'mMmMmMmMmM', '.m.m..m.m.'],
  reedmail: ['.EE....EE.', 'EeEeffeEeE', '.eEeEEeEe.', '.EeEeEeEe.', '.eEeEeEeE.', '.EeEeEeEe.', '.ZXZXZXZX.', '.eEeEeEeE.', '.EeEeEeEe.', '..eeeeee..'],
  shellplate: ['.=+....+=.', '=++=&&=++=', '.+=D++D=+.', '.=++==++=.', '.+==++==+.', '.=++==++=.', '.+==++==+.', '..=++++=..', '..&====&..', '...&&&&...'],
  stiltboots: ['..dhh.....', '..dhH.....', '..dhH.....', '..dhHhh...', '..ddhhhd..', '...h..h...', '...h..h...', '...H..H...', '...h..h...', '..dd.dd...'],
  mudtreads: ['..&++.....', '..&+=.....', '..&+=.....', '..&+=.....', '..&++=....', '..&+++=...', '..&++++=..', '..adhhhda.', '.adhadhhda', '..aa.aa.a.'],
  tidepearl: ['..........', '...cCCc...', '..cCDDCc..', '.cuuuuuuc.', '.uuDAAuuu.', '.uDAWADuu.', '.cuDAADuc.', 'cCcCcCcCcC', '.cCCCCCCc.', '..cccccc..'],
  wispcharm: ['...h..h...', '....hh....', '...2332...', '..31tt13..', '..3tTTt3..', '..3TiiT3..', '..3tTTt3..', '..31tt13..', '...2332...', '..........'],
  wickhood: ['....F.....', '....P.....', '....h.....', '...hHh....', '..hHHHh...', '.hHkkkHh..', '.hkkkkkh..', '.hkkkkkh..', 'hHHkkkHHh.', 'hhhhhhhhh.'],
  oilskin: ['.YY....YY.', 'YygYaaYygY', 'Yyyyyyyyyz', '.YyyayyYz.', '.YyyayyYz.', '.YyyayyYz.', '.YgyayyYz.', '.YyyayyYz.', 'YYyyayyYzz', 'zzzzazzzzz'],
  fireflyjar: ['...hhhh...', '..2hHHh2..', '..311113..', '.311F1113.', '.31F11P13.', '.311I1113.', '.31P11F13.', '.311F1113.', '..333333..', '..........'],
  sunlamp: ['....66....', '...6776...', '..677776..', '..2F00F2..', '..2I00I2..', '..2F00F2..', '..677776..', '...6776...', '....66....', '.9..99..9.'],
  breakersedge: ['.........i', '........Ti', '.......tT.', '......tT..', '.....tT=..', '..g.tT....', '...gy.....', '..hyg.....', '.hH.......', 'hH........'],
};
Object.assign(ICONS, DUSK_ICONS);

/** Region 5's bases (sand-worn linen and brass under a pinned sun; the Gnomon's two signatures gold and glowing),
 *  painted whether or not the region is in play. */
const NOON_ICONS: Record<string, string[]> = {
  dialspear: ['........90', '.......987', '......987.', '.....6Y...', '....hH....', '...hH.....', '..hH......', '.hH.......', 'hH........', 'h.........'],
  sunsaber: ['.........W', '........45', '.......45.', '......34..', '.....34...', '..g.34....', '...gy.....', '..hyg.....', '.hH.......', 'hH........'],
  spirehammer: ['......7...', '.....CDC..', '....CDDDC.', '.....CDDDC', '......CDC.', '.....h.C..', '....hH....', '...hH.....', '..hH......', '.hH.......'],
  veilhood: ['...ZZZZ...', '..ZXXXXZ..', '.ZXXXXXXZ.', '.ZXkkkkXZ.', '.ZkgkkgkZ.', '.ZXXXXXXZ.', 'ZXAXXAXXXZ', 'ZXXXXXXXXZ', 'ZKXKXXKXKZ', '.KKKKKKKK.'],
  brassvisor: ['...6776...', '..678876..', '.67889876.', '.6kkkkkk6.', '.67888876.', '.67k88k76.', '.67888876.', '..677776..', '..66..66..', '..........'],
  dustmail: ['.ZZ....ZZ.', 'ZXZ3443ZXZ', 'ZZ343434ZZ', '.Z434343Z.', '..343434..', '..434343..', '..343434..', '..434343..', '..KZKZKZ..', '..ZKZKZK..'],
  sunplate: ['.33....33.', '3443223443', '.34444443.', '.34489443.', '.34899843.', '.34489443.', '.34444443.', '..344443..', '..233332..', '...2222...'],
  dunestriders: ['...KZXZ...', '...ZXZK...', '...KZXZ...', '...ZXZK...', '...KZXZ...', '...dhHh...', '...dhHhh..', '...dhHHhh.', '...ddhhhhd', '...aaaaaa.'],
  stairtreads: ['..dhh.....', '..dhH.....', '..dhH.....', '..dhH.....', '..dhHh....', '..dhHHh...', '..dhHHhh..', '..dhhhh78.', '..ddddd788', '..a6a6a6a.'],
  noonpearl: ['....78....', '...7887...', '..ZXAAXZ..', '.ZXAWWAXZ.', '.XAWWAAAX.', '.XAAAAAXZ.', '.ZXAAAXZK.', '..ZXXXZK..', '...KZZK...', '..........'],
  hazeglass: ['....hh....', '....hh....', '....33....', '...3TT3...', '..3TiiT3..', '..3tTTt3..', '..3stts3..', '..3tTTt3..', '...3ss3...', '....33....'],
  sunhat: ['..........', '...ZXXZ...', '..ZXJXXZ..', '..ZXXXXZ..', '..RrrrrR..', 'ZZXXXXXXZZ', 'KZZXXXXZZK', '.KKZZZZKK.', '..........', '..........'],
  linenrobe: ['..ZXZZXZ..', '.ZXXkkXXZ.', 'ZXXXXXXXXZ', 'ZXXXXXXXXZ', '.ZXXRRXXZ.', '..ZXXXXZ..', '..ZXXXXZ..', '..ZXXXXZ..', '.ZXXXXXXZ.', '.KZZZZZZK.'],
  sandals: ['..........', '..........', '...h.h....', '...hh.....', '...h.h....', '...h..h...', '...h...h..', '.hHHHHHHh.', '.dddddddd.', '..........'],
  waterskin: ['....hh....', '...h..h...', '....dd....', '...dhHd...', '..dhHHjd..', '.dhHHHjhd.', '.dhHHHHhd.', '.dhhHHhhd.', '..dhhhhd..', '...dddd.L.'],
  sunstone: ['....9.....', '.9..8..9..', '...888....', '..8g0g8...', '98g000g89.', '..8g0g8...', '...888....', '.9..8..9..', '....9.....', '..........'],
  gnomonhand: ['.........0', '........99', '.......989', '......9887', '.....9877.', '...6y87...', '..y6y.....', '..hy......', '.hH.......', 'hH........'],
};
Object.assign(ICONS, NOON_ICONS);

/** The look an item borrows until its own icon is painted. */
const SLOT_FALLBACK: Record<string, string> = { weapon: 'saber', helm: 'hood', armor: 'ringmail', boots: 'hobnail', trinket: 'locket' };

export function buildGearArt(add: Add): void {
  const done = new Set<string>();
  // Region 3's bases are drawn too (not in BASE_ITEMS until the region is in play; then they're simply skipped here)
  for (const b of [...BASE_ITEMS, ...ASH_BASE_ITEMS, ...NOON_BASE_ITEMS]) {
    if (done.has(b.icon)) continue;
    done.add(b.icon);
    // an item without a painted icon yet borrows its slot's look
    add(`item_${b.icon}`, icon(ICONS[b.icon] ? b.icon : SLOT_FALLBACK[b.slot]));
  }
}
