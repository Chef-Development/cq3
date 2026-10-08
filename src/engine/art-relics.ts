// Relic, tag and skill icons (see docs/art-style.md), drawn like the gear icons (art-gear.ts): a character map per icon
// stamped at (1, 1) on a transparent square, toCanvas adds the 1px ink outline. Light from the top left, short
// hue-shifted ramps.
//
//   relic_${id}   ITEM_ICON_SIZE (12x12) for every RelicId: the main tag's colour is the accent, so a build reads as a
//                 family (bomb orange, crit lemon, block steel blue, combo cyan, finisher violet, green leaf, Pip
//                 brown and cream, sustain pink, coins gold, risk crimson and black)
//   tag_${tag}    7x7 chips for the 10 RelicTags (bomb, star, shield, chevrons, swoosh, leaf, owl, heart, coin, skull)
//   skill_${id}   12x12 for every skill node; each branch has a look (Rowan: Blade steel and gold, Bulwark steel blue,
//                 Momentum a cyan and violet swirl; Sable's old two-cursor tree: crossed daggers and red, smoky
//                 purple, silver and teal, which her new tree borrows) and the capstones get a gold rim and glints.
//                 The other heroes' nodes have stand-ins for now (skillIcon: their stat's icon, a rune, a star)
import { RELIC_IDS, RELIC_TAGS, relicById } from '../data/relics';
import { SKILL_NODES, type SkillNode, type SkillStat } from '../data/skills';
import { grid, stamp, toCanvas, type Pal } from './art';
import { ITEM_ICON_SIZE } from './art-gear';

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Tag chips are this many px square (outline included). */
export const TAG_ICON_SIZE = 7;

const PAL: Pal = {
  k: '#140c1c', // interior ink
  // steel
  1: '#2a2f45', 2: '#4a5272', 3: '#7c86a6', 4: '#b8c2d8', 5: '#eef3fa', W: '#ffffff',
  // gold (coins)
  z: '#5a3410', Y: '#9a5a14', y: '#d8901c', g: '#f2c230', G: '#fff0a0',
  // leather and wood
  a: '#2a1810', d: '#4a2c18', h: '#6e4426', H: '#98663a', j: '#c0905a', J: '#e0bc84',
  // red
  x: '#4a0f1a', R: '#8a1a22', r: '#d03030', q: '#f05a48', Q: '#ff9a80',
  // leaf green
  n: '#1e3c2a', N: '#2e5a32', e: '#4a7e36', E: '#78a83c', f: '#b4d058',
  // bomb: fire orange
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
  // Pip: cream feathers, owl eyes
  '=': '#8a7660', '-': '#c8b496', ':': '#efe2c4', ';': '#fff8e6', i: '#ffd84a', s: '#e89a20',
  // Quicksilver: teal
  '(': '#14524e', ')': '#22a098', '[': '#62e4d4', ']': '#d8fff6',
  // Shadowguard: smoke
  '{': '#3a3048', '}': '#6a5a80', '~': '#a898bc',
  // night sky
  A: '#0e1630', D: '#1c2a52',
};

// ------------------------------------------------------------------ relics (10x10 maps)

const RELIC_ICONS: Record<string, string[]> = {
  // ---------------------------------------------------------------- bomb
  // a little powder barrel, its fuse lit
  powderKeg: [
    '.......FI.',
    '......Pp..',
    '.....hd...',
    '..JJJdjh..',
    '.45444332.',
    '.JjjHhhhd.',
    '.jjHHhhhd.',
    '.45444332.',
    '.jHHhhhda.',
    '..hhddda..',
  ],
  // a bomb with a stub of fuse and a big flame
  shortFuse: [
    '.....F..F.',
    '...F..IF..',
    '....FIIIF.',
    '...PIIIp..',
    '....ppO...',
    '..@#hd....',
    '.@#$$#@...',
    '@#%$##@!..',
    '@#$##@@!..',
    '.@@@@!!...',
  ],
  // a bomb planted in a fresh mound of earth
  sapper: [
    '.......IF.',
    '......Fp..',
    '.....hd...',
    '...1221...',
    '..123221..',
    '..152211..',
    '..122211..',
    '.jj1111hd.',
    'jJHhhhhhda',
    'Hhhhddddaa',
  ],
  // a blast throwing out cyan shock waves
  blastWave: [
    '..........',
    '...pOOp...',
    '.t.PFFP.t.',
    't.pFIIFp.t',
    'TOFIIIIFOT',
    'TOFIIIIFOT',
    't.pFIIFp.t',
    '.t.PFFP.t.',
    '...pOOp...',
    '..........',
  ],
  // a present in orange paper with a violet bow, a fuse poking out
  partingGift: [
    '.......IF.',
    '......Fp..',
    '..wV.hV...',
    '..VwVwvU..',
    '.ppPvVpOo.',
    '.pPPvVpOo.',
    '.wVVwVvvU.',
    '.pPPvVpOo.',
    '.ppPvVpOo.',
    '.oooUUooo.',
  ],
  // ---------------------------------------------------------------- crit
  // an arrow in the bullseye
  sharpshooter: [
    '.......Q.Q',
    '..xrrrx.qQ',
    '.r55555Hq.',
    'r5&**&H5r.',
    'r5*++H*5r.',
    'r5*+h+*5r.',
    'r5&***&5r.',
    '.r55555r..',
    '..xrrrx...',
    '..........',
  ],
  // a glass blade, snapped across
  glassEdge: [
    '........mW',
    '.......mWT',
    '......mWTl',
    '.....mWTl.',
    '......Bl..',
    '...mT.....',
    '..mWTl....',
    '.%$Tl.....',
    '..#$......',
    '.@!.#.....',
  ],
  // a cracked heart run through by a sword
  lastStand: [
    '....5.....',
    '...g4g....',
    '.$$.4.$$..',
    '$%$$4$$#@.',
    '$%$!4!$#@.',
    '.$$#4$!#..',
    '..$#4#@...',
    '...#4@....',
    '....3.....',
    '..........',
  ],
  // a shield cracking under a crit star
  weakSpot: [
    '......*...',
    '.....*+*..',
    'LLLl**+**.',
    'Lmm&*+++*&',
    'LmL.*+*b..',
    'LmLl*b*lB.',
    '.LmLblBB..',
    '.LLlbBB...',
    '..LlBB....',
    '...BB.....',
  ],
  // a crit star bouncing on to a second foe
  ricochet: [
    '..&.......',
    '.&*&......',
    '&*+*&.....',
    '.&*&&&....',
    '.&.&.&&...',
    '.......&..',
    '.......*..',
    '......*+*.',
    '.....*+++*',
    '......*.*.',
  ],
  // a fierce owl with a star in its eye
  huntingOwl: [
    '.h.....*..',
    '.Hh...*+*.',
    '.HhhHhh*..',
    'H:-hh:-h..',
    'H:ik:ik:h.',
    'H:sk:sk:h.',
    'Hh::y::hh.',
    '.Hh:s:hh..',
    '..Hhhhh...',
    '...ss.s...',
  ],
  // a penny stamped with a star, glinting
  luckyPenny: [
    '..yyyY..+.',
    '.yGGggY+*+',
    'yGgg&ggY+.',
    'yGg&*&gyY.',
    'yg&*+*&yY.',
    'ygg&*&gyY.',
    'yggg&gyyY.',
    '.yggyyyY..',
    '..YYYYz...',
    '..........',
  ],
  // ---------------------------------------------------------------- block
  // a shield with a music note
  ironRhythm: [
    'lmmmmLLLlB',
    'lmLLLL5lBB',
    'lmLLLL55lB',
    'lmLLLL5L5B',
    'lmLLLL5lBB',
    '.lLL555lB.',
    '.lL5555lB.',
    '..lL55lB..',
    '...llBB...',
    '....BB....',
  ],
  // a mirror-bright round shield throwing a red bolt back
  mirrorGuard: [
    '...BBBB...',
    '.BlLLLlB..',
    'BlmWmmLlB.',
    'BLWmmmLlBq',
    'lLmmmLLlrQ',
    'lLmmLLlBqr',
    'BlLLLllBB.',
    '.BlllBBB..',
    '...BBBB...',
    '..........',
  ],
  // a domed shell of riveted plates
  turtleShell: [
    '..........',
    '...lLLl...',
    '..lmLBLl..',
    '.lLBmLBlB.',
    '.mLBLLBlB.',
    'lLlBlLBlBB',
    'mLLLLLlllB',
    'BBBBBBBBBB',
    '.hH....hH.',
    '..........',
  ],
  // a tower shield with a violet gem
  shieldbearer: [
    '.lLLLLllB.',
    'lmLLLLLllB',
    'lmLLwVlllB',
    'lmLwVvUllB',
    'lmLVvvUllB',
    'lmLLUULllB',
    'lmLLLLLllB',
    'lmLLLLlllB',
    '.lllllllB.',
    '..BBBBBB..',
  ],
  // an owl's eye open in the night, under the moon
  nightWatch: [
    '..ADDDDA..',
    '.ADDDDGgA.',
    'ADD--DDgDA',
    'AD-:;:-DDA',
    'D-:iii:-DA',
    'D-iikii-DA',
    'D-:iii:-DA',
    'AD-:::-DDA',
    '.ADD--DDA.',
    '..AAAAAA..',
  ],
  // ---------------------------------------------------------------- combo
  // two chain links, sparking green
  chainReaction: [
    '.tTt...f..',
    'tC.Ct.fEf.',
    'T...Tt.f..',
    'tC..tTt...',
    '.tCtC.Ct..',
    '...tC..Ct.',
    '....T...T.',
    '.....tC.t.',
    '......tTt.',
    '..........',
  ],
  // an arrow with speed lines
  momentum: [
    '.....T....',
    '.....tT...',
    'tt..CttT..',
    '...CtTttT.',
    'TTCttTTttT',
    '...CttttT.',
    'tt..CttT..',
    '.....tT...',
    '.....T....',
    '..........',
  ],
  // rising bars, the last one violet
  crescendo: [
    '........wV',
    '........Vv',
    '......TtVv',
    '......tCVv',
    '....TtTtVv',
    '....tCtCVv',
    '..TttCtCVU',
    '..tCtCtCVU',
    'TttCtCtCvU',
    'CCCCCCCCUU',
  ],
  // a chain link tied back together with a red cord
  clutch: [
    '.tTt......',
    'tC.Ct.....',
    'T...Tt....',
    'tC.$%$t...',
    '.tC$#$Ct..',
    '...$#$.Ct.',
    '....tC..T.',
    '.....tC.t.',
    '......tTt.',
    '..........',
  ],
  // a gauge with its needle in the red
  overdrive: [
    '..CtttT$..',
    '.Ct....%$.',
    'Ct.....k$#',
    'Ct....k.%#',
    'C....k..$@',
    'C...55...@',
    '...5225...',
    '1222222221',
    '.11111111.',
    '..........',
  ],
  // a coin running hot, flames licking off it
  goldFever: [
    '...P....P.',
    '..pP.P.pP.',
    '..pFpPpFp.',
    '..oyggyyo.',
    '.yGGgggyY.',
    'yGgyYYgyyY',
    'yGgYggYyyY',
    'yggyYYyyYY',
    '.yyyyyyYY.',
    '..YYYYYz..',
  ],
  // ---------------------------------------------------------------- finisher
  // a broom with a violet swoosh
  sweeper: [
    '........H.',
    '.......Hh.',
    '..V...Hh..',
    '.Vw..Hh...',
    'Vw..Hh....',
    'V..gGg....',
    '..jJjJj...',
    '.jJjJjjd..',
    'jJjJjjdd..',
    'jjjjddd...',
  ],
  // a sack stuffed with coins and violet gems
  hoarder: [
    '...wV.g...',
    '..VwvgGy..',
    '..vUyg.Vw.',
    '...hjjhvU.',
    '..hJjjjh..',
    '.hJjjjjhd.',
    'hJjjjjjhhd',
    'hjjjjjhhdd',
    '.hhhhhddd.',
    '..........',
  ],
  // a violet bolt with a red spark
  overcharge: [
    '.....wVV..',
    '....wVvU..',
    '...wVvU...',
    '..wVvvVVV.',
    '..UUUwVvU.',
    '....wVvU..',
    '...wVvU...',
    '..wVU..$%.',
    '..VU..$%$.',
    '..U....$..',
  ],
  // a blade flashing out of its sheath
  quickDraw: [
    '........5W',
    '.......543',
    '......543.',
    '.V...543..',
    'V.V.Gg3...',
    '.V..dgy...',
    '...dhd....',
    '..dhd.....',
    '.dhd......',
    'dhd.......',
  ],
  // a slash and its echo
  echoStrike: [
    '....wV....',
    '.vv...wV..',
    '...v...wV.',
    '....v...wV',
    '....V...wV',
    '....v...wV',
    '...v...wV.',
    '.vv...wV..',
    '....wV....',
    '..........',
  ],
  // a violet blade shedding a drop of blood
  bloodPrice: [
    '........ww',
    '.......wVv',
    '......wVv.',
    '.....wVv..',
    '..g.wVv...',
    '...gVv..%.',
    '...yg..%$.',
    '..dhy.%$$#',
    '.dhd..$$#@',
    'dhd....@@.',
  ],
  // a violet contract under a red wax seal
  purplePact: [
    '.wwwwwwV..',
    'wVwwwwwVU.',
    '.wvvvvwV..',
    '.wwwwwwV..',
    '.wvvvwwV..',
    '.wwwwwwV..',
    '.wvvw$#$..',
    '.www$%$#$.',
    'wVww#$#@..',
    '.UUUU@....',
  ],
  // ---------------------------------------------------------------- green
  // a little glasshouse with a sprout
  greenhouse: [
    '....hh....',
    '...hmLh...',
    '..hmLLLh..',
    '.hmLLLLLh.',
    'hhhhhhhhhh',
    'hmLfELLLLh',
    'hmLEeLLLLh',
    'hmLLeLLLLh',
    'hNNNeNNNNh',
    'hhhhhhhhhh',
  ],
  // a leaf riding a violet surge
  verdantSurge: [
    '.....fE...',
    '....fEEe..',
    '...fEEeeN.',
    '..fEEeNeN.',
    '..EEeNeeN.',
    '.wEeNeeN..',
    'wV.NeeN...',
    'V.wVNN....',
    '.wVv......',
    'wV........',
  ],
  // an evergreen with a Perfect's sparkle
  evergreen: [
    '....E...+.',
    '...fEe.+*+',
    '..fEEen.+.',
    '...EeN....',
    '..fEEeN...',
    '.fEEEeeN..',
    '...EeeN...',
    '..fEEeeNN.',
    '.fEEEEeeeN',
    '....hd....',
  ],
  // a leaf in the sun, a heart in its veins
  photosynthesis: [
    'G.g.......',
    '.gGg......',
    'gGGGg.....',
    '.gGg......',
    'G.g..fE...',
    '....fEEe..',
    '...fEEeeN.',
    '..fEE98eN.',
    '..EEe87N..',
    '.h.NNN....',
  ],
  // ---------------------------------------------------------------- Pip
  // Pip with a stolen coin in the beak
  treasureNose: [
    '.h......h.',
    '.Hh....hH.',
    '.HhhhhhhH.',
    'H:-hhh:-hH',
    'H:ik:ik:hH',
    'H:sk:sk:h.',
    '.H::s::h..',
    '..hgGgy...',
    '...gGgy...',
    '....yY....',
  ],
  // an owl's wing beating up a violet spark
  wingman: [
    '.......w..',
    '......wVw.',
    '...hhHh.w.',
    '..hHHjJh..',
    '.hHjjJJ:h.',
    'hHj:J:;::.',
    'Hj:J:;:;..',
    'j:J:;:;...',
    ':J.;.;....',
    '.:........',
  ],
  // ---------------------------------------------------------------- sustain and coins
  // a fang dripping
  vampiricFang: [
    '.!@###@!..',
    '.:;;;;;-..',
    '..;;;;:-..',
    '..:;;;:...',
    '...;;:....',
    '...:;-....',
    '....-..8..',
    '......898.',
    '.....8998.',
    '......77..',
  ],
  // a loaf of field bread and a heart
  fieldRations: [
    '.......9..',
    '......989.',
    '.......8..',
    '..jJJJj...',
    '.jJJjJJjh.',
    'jJjJJjJjhh',
    'jjhjjhjhhd',
    'hhhhhhhhdd',
    '.ddddddda.',
    '..........',
  ],
  // an offering bowl of coins under a heart
  tithe: [
    '...90.90..',
    '...99899..',
    '....989...',
    '.....8....',
    '..gGy.gy..',
    '.gGgyygGy.',
    'jJjJjjjhhd',
    '.jJjjjhhd.',
    '..jjjhhd..',
    '...hddd...',
  ],
  // a price tag struck through: free
  haggler: [
    '....JJJ...',
    '...J:::J..',
    '..J::k::J.',
    '.J:::::::J',
    'J::gGg::$J',
    'J:gGgg:$:J',
    'J:ggy:$::J',
    '.J:y$Y::J.',
    '..J$:::J..',
    '...JJJJ...',
  ],
};

// ------------------------------------------------------------------ tag chips (5x5 maps)

const TAG_ICONS: Record<string, string[]> = {
  bomb: ['...pF', '.12h.', '1521.', '1221.', '.11..'],
  crit: ['..&..', '.&*&.', '&*+*&', '.&*&.', '.&.&.'],
  block: ['lmLlB', 'lmLlB', 'lmLlB', '.lLB.', '..B..'],
  combo: ['Tt.T.', '.Tt.T', '..tTt', '.Tt.T', 'Tt.T.'],
  finisher: ['.wV..', '...wV', '....V', '...wV', '.wV..'],
  green: ['...fE', '..fEe', '.fEeN', 'fEeN.', 'hNN..'],
  pip: ['h...h', 'hHHHh', 'iki:k', 'H:s:h', '.HhH.'],
  sustain: ['89.97', '99887', '98887', '.887.', '..7..'],
  coins: ['.ygy.', 'yGgyY', 'yGyyY', 'ygyyY', '.YYY.'],
  risk: ['.;;:.', ';;;;:', '$:$:-', ':;:;-', '.:-:.'],
};

// ------------------------------------------------------------------ skills (10x10 maps)

const SKILL_ICONS: Record<string, string[]> = {
  // ---------------------------------------------------------------- Rowan: Blade (steel and gold)
  // a sword with a gleam running along the edge
  keenEdge: [
    '......W.5W',
    '.....WGW43',
    '......W43.',
    '.....543..',
    '....543...',
    '.Gg543....',
    '..yg......',
    '.HHyg.....',
    'Hh..y.....',
    'gY........',
  ],
  // a sword's point in the crosshair
  steadyAim: [
    '...gyy....',
    '..g...y.5W',
    '.g..y.4543',
    '.y.yy543y.',
    '.y..543.y.',
    '..y543.y..',
    '.Gg5yyy...',
    '..yg......',
    '.HHyg.....',
    'Hh..y.....',
  ],
  // a slash carrying on to the next foe
  followThrough: [
    '.....gg...',
    '...gg..y..',
    '..g.....y.',
    '.g......Gy',
    '.g.....GgY',
    '5W......y.',
    '543.......',
    '.543......',
    '..54gy....',
    '...yHh....',
  ],
  // a whetstone throwing sparks off the edge
  whetstone: [
    '.......5W.',
    '..G...543.',
    '.GWG.543..',
    '..G.543...',
    '...543.G..',
    '.jJ43y....',
    'jJJj3y....',
    'JjjjjH....',
    'jjjjHd....',
    '.HHHd.....',
  ],
  // capstone: the executioner's axe, gold-rimmed
  executioner: [
    'G.gggggg.G',
    '.g.45.Hhg.',
    'g.4554Hh.g',
    'g455543h.g',
    'g455432h.g',
    'g.4432Hh.g',
    'g...2.Hh.g',
    'g.....Hh.g',
    '.y....jJy.',
    'G.yyyyyy.G',
  ],
  // ---------------------------------------------------------------- Rowan: Bulwark (steel blue)
  // a sturdy shield with a heart on it
  stout: [
    'lmmmmLLLlB',
    'lmLLLLLllB',
    'lmL98L97lB',
    'lmL9888lBB',
    'lmLL887lBB',
    '.lLLL7llB.',
    '.lLLLLllB.',
    '..lLLLlB..',
    '...llBB...',
    '....BB....',
  ],
  // a breastplate
  plateTraining: [
    '.lm....lB.',
    'lmLl..lLlB',
    'lmmLLLLllB',
    '.lmLLLLlB.',
    '.lmLLLllB.',
    '.lmLLLllB.',
    '..lmLLlB..',
    '..lLLLlB..',
    '..lllllB..',
    '...BBBB...',
  ],
  // a shield shoving reds away
  parry: [
    'r.........',
    'qr..lLLl..',
    '.r.lmLLlB.',
    '...lmLLlB.',
    'r..lmLLlB.',
    'qr.lmLLlB.',
    '.r..lLlB..',
    '.....lB...',
    'r.........',
    'qr........',
  ],
  // a shield bashing, stars flying
  shieldBash: [
    '.......*..',
    '..lLL.*+*.',
    '.lmLLl.*..',
    '.lmLLlB...',
    '.lmLLlB*..',
    '.lmLLlB+*.',
    '..lLLlB*..',
    '...lB.....',
    '.*........',
    '*+*.......',
  ],
  // capstone: a shield bubble, gold-rimmed
  shieldWall: [
    '..GgggggG.',
    '.gLmmmLLLg',
    'gLmmLLLLlg',
    'gmmLlLLLlg',
    'gmLlmLlLlg',
    'gLLLlmLLlg',
    'gLLLLlLllg',
    'yLLLLLlllY',
    '.ylllllBY.',
    '..yYYYYY..',
  ],
  // ---------------------------------------------------------------- Rowan: Momentum (cyan and violet swirl)
  // a swirl and a note
  rhythm: [
    '...tTTt...',
    '..t....T..',
    '.t..wV..T.',
    '.t.V..V.t.',
    '.C.V.w..t.',
    '.C..VV.C..',
    '..C...C...',
    '...CCC..5.',
    '.......55.',
    '......55..',
  ],
  // a gauntlet clenched in a swirl
  powerStance: [
    '..tTTt....',
    '.t....T...',
    't.4554.T..',
    'C45544.t..',
    'C45443.t..',
    'C.4433.C..',
    '.C.322C...',
    '..C..C....',
    '...VVwV...',
    '....UV....',
  ],
  // two chevrons: one hit counts twice
  doubleTime: [
    '..........',
    'Tt..Tt....',
    '.tT..tT...',
    '..tT..tT..',
    '...tT..tT.',
    '..CtV.CtV.',
    '.CtV.CtV..',
    'CtV.CtV...',
    'VV..VV....',
    '..........',
  ],
  // a violet orb ringed with a cyan swirl
  chargedUp: [
    '...tTTt...',
    '..t.wV.T..',
    '.t.wVVv.T.',
    '.CwVVvvU..',
    'C.VvvvvU.t',
    '..VvvvUU.t',
    'C..UUUU.t.',
    '.C.....t..',
    '..CCtt....',
    '..........',
  ],
  // capstone: an unbroken loop, gold-rimmed
  unbroken: [
    'G.gggggg.G',
    '.gtTT.VVg.',
    'gt..TV..wg',
    'gt...V..wg',
    'gC..Vt..Vg',
    'gC.V..t.Vg',
    'gCV....tVg',
    '.gCC.UUUg.',
    'G.yyyyyy.G',
    '..........',
  ],
  // ---------------------------------------------------------------- Sable: Crossfire (crossed daggers, red)
  // a dagger with speed lines
  quickHands: [
    '.......4W.',
    '......4AL.',
    'qr...4L3..',
    '....4L3...',
    '.qr.gL3...',
    '...gyg....',
    'qr.hy.....',
    '..hd......',
    '.Hd.......',
    '..........',
  ],
  // a light grip and a red glint
  lightGrip: [
    '......4W..',
    '.....4L3q.',
    '....4L3qQq',
    '...4L3..q.',
    '..gL3.....',
    '.gyg......',
    '..hy......',
    '.hd.......',
    'Hd........',
    '..........',
  ],
  // three quick red slashes
  flurry: [
    '.......qQ.',
    '......qr..',
    '..qQ.qr...',
    '.qr..r.qQ.',
    'qr..r.qr..',
    'r..r.qr...',
    '...r.r....',
    '..xr.r....',
    '..R..R....',
    '..........',
  ],
  // left, right: two daggers trading places
  twinRhythm: [
    '.4W....W4.',
    '4L3....3L4',
    'L3......3L',
    'g.qr..rq.g',
    'yqrr..rrqy',
    'h.qr..rq.h',
    '..........',
    '...r..r...',
    '..rr..rr..',
    '...r..r...',
  ],
  // capstone: two daggers whirling, gold-rimmed
  whirlingBlades: [
    'G.gggggg.G',
    '.g4W..qrg.',
    'g4L3...rqg',
    'gL3.....rg',
    'gg..xx..gg',
    'gr..xx..3g',
    'grr....3Lg',
    'g.rq..3L4g',
    '.g....W4g.',
    'G.yyyyyy.G',
  ],
  // ---------------------------------------------------------------- Sable: Shadowguard (smoky purple)
  // a wiry purple heart
  wiry: [
    '.vV..vV...',
    'vwVvvwVv..',
    'vVvvvvvU..',
    'vvvvvvUU..',
    '.vvvvUU.~.',
    '..vvUU.~}.',
    '...vU.}~..',
    '....U.}...',
    '.......{..',
    '..........',
  ],
  // a smoky shape slipping aside
  evasion: [
    '...~~.....',
    '..~}}~....',
    '.~}{{}...v',
    '.~}{{}..vV',
    '..}{{.vvVw',
    '..}{..vVw.',
    '.}{{.vVvw.',
    '.{{..vvV..',
    '.{...vUv..',
    '.....U.U..',
  ],
  // crossed daggers over a purple shield
  crossGuard: [
    'W.......W.',
    '43.vVV.34.',
    '.43wVv34..',
    '.v43v34U..',
    '.vV433vU..',
    '.vVg33gU..',
    '.vgVvUyU..',
    '..yvvUhU..',
    '..hUvU.d..',
    '....U.....',
  ],
  // a shield with a red counter-slash leaping off it
  counterSlash: [
    '.vVVvU..qQ',
    'vwVVvU.qr.',
    'vwVvvUqr..',
    'vwVvqrU...',
    'vwVqrvU...',
    '.vqrvU....',
    '.qrvU.....',
    '.r.U......',
    '..........',
    '..........',
  ],
  // capstone: a shield and its afterimage, gold-rimmed
  afterimage: [
    'G.gggggg.G',
    '.g~}}vVVg.',
    'g~}{vwVvUg',
    'g~}{vwVvUg',
    'g~}{vwVvUg',
    'g.~}vwVvUg',
    'g..~.vVUg.',
    '.g....vUg.',
    'G.yyyyyy.G',
    '..........',
  ],
  // ---------------------------------------------------------------- Sable: Quicksilver (silver and teal)
  // a winged boot
  fleet: [
    '..........',
    '..544.....',
    ']]543.....',
    '[)543.....',
    '.]543.....',
    '.)5433....',
    '..54443322',
    '..5444333.',
    '..1111111.',
    '..........',
  ],
  // an eye narrowed in focus
  sharpFocus: [
    '..........',
    '.]......].',
    '..]....]..',
    '..553345..',
    '.53[)(335.',
    '53[)((]335',
    '.53)((335.',
    '..553345..',
    '..]....]..',
    '.]......].',
  ],
  // a dagger blurred with speed
  blur: [
    '.......45W',
    '......45L.',
    '[)...45L..',
    '....45L...',
    '.[).g5L...',
    '...gyg....',
    '[).hy.....',
    '..hd......',
    '.Hd.......',
    '..........',
  ],
  // two blades striking the same spot together
  doubleDown: [
    '5W......W5',
    '453....354',
    '.453..354.',
    '..45]]54..',
    '...][[]...',
    '...][[]...',
    '..gy]]yg..',
    '.hy....yh.',
    'hd......dh',
    '..........',
  ],
  // capstone: a quicksilver hourglass, gold-rimmed
  quickening: [
    'G.gggggg.G',
    '.g555544g.',
    '.g4[[[)3g.',
    '..g4[)3g..',
    '...g])g...',
    '...g)(g...',
    '..g4)(3g..',
    '.g4[[)(3g.',
    '.g444433g.',
    'G.yyyyyy.G',
  ],
};

/** Skill nodes drawn with another node's icon until they get their own: Sable's rebuilt (one-cursor) tree keeps her
 *  old art where it fits; every other node without a map of its own shows its stat's icon (Rowan's stat nodes), and
 *  a rule node or capstone the stand-ins below. */
const SKILL_ICON_ALIAS: Record<string, string> = {
  sureChain: 'twinRhythm',
  deepCuts: 'flurry',
  deathMark: 'whirlingBlades',
  lunge: 'blur',
  nightStep: 'crossGuard',
  phantomRush: 'afterimage',
  vanish: 'evasion',
  nightCloak: 'quickening',
};
const STAT_ICON: Record<SkillStat, string> = { atkPct: 'keenEdge', critChance: 'steadyAim', hpPct: 'stout', def: 'plateTraining', meterGain: 'rhythm', comboPower: 'powerStance' };
const KIND_ICON: Record<'rule' | 'capstone', string[]> = {
  // a violet rune stone, its mark an arrow up: a rule that changes
  rule: [
    '.wwwwwwvv.',
    'wwVVVVVVvU',
    'wVVVVWVVvU',
    'wVVVWWWVvU',
    'wVVWVWVWvU',
    'wVVVVWVVvU',
    'wVVVVWVVvU',
    'wVVVVVVVvU',
    'VvvvvvvvvU',
    '.UUUUUUUU.',
  ],
  // capstone: a star, gold-rimmed
  capstone: [
    'G.gggggg.G',
    '.g..+*..g.',
    'g...+*...g',
    'g+++**&&^g',
    'g.+***&^.g',
    'g..*&&^..g',
    'g.*&^.&^.g',
    'g*&....&^g',
    '.y......y.',
    'G.yyyyyy.G',
  ],
};

/** A skill node's icon map: its own, else a stand-in (see SKILL_ICON_ALIAS). */
function skillIcon(node: SkillNode): string[] {
  const own = SKILL_ICONS[node.id] ?? SKILL_ICONS[SKILL_ICON_ALIAS[node.id] ?? ''];
  if (own) return own;
  if (node.kind === 'stat' && node.stat) return SKILL_ICONS[STAT_ICON[node.stat]];
  return KIND_ICON[node.kind === 'capstone' ? 'capstone' : 'rule'];
}

// ------------------------------------------------------------------ build

/** Stamp a map of `n` x `n` at (1, 1) on a square `n + 2` wide; toCanvas adds the outline. */
function icon(rows: string[], n: number, key: string): HTMLCanvasElement {
  if (rows.length !== n || rows.some((r) => r.length !== n)) throw new Error(`${key}: the map must be ${n}x${n}`);
  const g = grid(n + 2, n + 2);
  stamp(g, rows, PAL, 1, 1);
  return toCanvas(g);
}

/** A stand-in icon (until a painted one is drawn): a 5x5 glyph doubled into an n x n map, in a tag's ramp. */
function standIn(glyph: string[], n: number, ramp: string): string[] {
  const rows: string[] = [];
  const k = n >= 10 ? 2 : 1; // doubled on relic tiles, as is on tag chips
  const off = Math.floor((n - 5 * k) / 2);
  for (let y = 0; y < n; y++) {
    let r = '';
    for (let x = 0; x < n; x++) {
      const gx = Math.floor((x - off) / k);
      const gy = Math.floor((y - off) / k);
      const on = glyph[gy]?.[gx] === '#';
      r += on ? ramp[(x + y) % 2 === 0 ? 0 : 1] : '.';
    }
    rows.push(r);
  }
  return rows;
}

const STAND_IN: Record<string, string[]> = {
  ice: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
  hold: ['#...#', '#####', '#...#', '#####', '#...#'],
  skill: ['..#..', '.###.', '#####', '.###.', '..#..'],
};

export function buildRelicArt(add: Add): void {
  const n = ITEM_ICON_SIZE - 2;
  // the ramp keys a stand-in uses: the first two palette keys of the icon palette
  const ramp = '34'; // light steel
  for (const id of RELIC_IDS) {
    const tag = relicById(id)?.tags[0] ?? 'skill';
    const rows = RELIC_ICONS[id] ?? standIn(STAND_IN[tag] ?? STAND_IN.skill, n, ramp);
    add(`relic_${id}`, icon(rows, n, `relic_${id}`));
  }
  for (const tag of RELIC_TAGS) {
    const rows = TAG_ICONS[tag] ?? standIn(STAND_IN[tag] ?? STAND_IN.skill, TAG_ICON_SIZE - 2, ramp);
    add(`tag_${tag}`, icon(rows, TAG_ICON_SIZE - 2, `tag_${tag}`));
  }
  for (const node of SKILL_NODES) add(`skill_${node.id}`, icon(skillIcon(node), n, `skill_${node.id}`));
}

// ---- Solenne and Wren (Part 6): their rule nodes and capstones (Solenne's in sunrise gold and fire, Wren's in
// mustard, smoke and knife steel; capstones gold-rimmed like Rowan's)
Object.assign(SKILL_ICONS, {
  // a sun coming up over the horizon, early
  earlyLight: ['....P.....', '.P..F..P..', '..P.F.P...', '....I.....', 'P..FIIF..P', '..FIIIIF..', '.FIIIIIIF.', 'PFIIIIIIFP', 'zYYYYYYYYz', '.zzzzzzzz.'],
  // an hourglass running with sunlight
  longMorning: ['yyyyyyyyyy', '.g......g.', '.gFIIIIFg.', '..gFIIFg..', '...gFFg...', '...gPPg...', '..g.PP.g..', '.g..FF..g.', '.gPFIIFPg.', 'yyyyyyyyyy'],
  // capstone: a sun flaring
  solarFlare: ['G.gggggg.G', '.gP.FF.Pg.', 'gP.FIIF.Pg', 'g.FIIIIF.g', 'gFIIWWIIFg', 'gFIIWWIIFg', 'g.FIIIIF.g', 'gP.FIIF.Pg', '.yP.FF.Py.', 'G.yyyyyy.G'],
  // two gilded blocks, sparkling
  twinGleam: ['..+.......', '.+*+..+...', '..+..+*+..', 'yyyy..+...', 'gGGy.yyyy.', 'gGWy.gGGy.', 'gggY.gGWy.', 'YYYY.gggY.', '.....YYYY.', '..........'],
  // a sword striking a gilded block
  giltStrike: ['.......5W.', '......543.', '.....543..', '....543...', '.+.543....', '+*+43.....', '.+gGGGy...', '..gGWGy...', '..ggggY...', '..YYYY....'],
  // capstone: a gilded block passing its gold on to the next
  midasTouch: ['G.gggggg.G', '.g......g.', 'gyyyy...+g', 'ggGGy..+*g', 'ggWGy...+g', 'ggggYGGyyg', 'gYYYY.gGGg', 'g.....gWGg', '.y....gggy', 'G.yyyyyyyG'],
  // a gold-trimmed shield with a sun on it: the oath holds
  firmOath: ['yyyyyyyyyy', 'y45555554y', 'y455FF554y', 'y45FIIF54y', 'y45FIIF54y', '.y455F54y.', '.y455554y.', '..y4554y..', '...y44y...', '....yy....'],
  // a steel shield in a sun's rays
  sunWard: ['.P..F..P..', '..P.F.P...', 'P..lmmB..P', '.P.lmLB.P.', 'FF.lLLB.FF', '.P.lLlB.P.', 'P...lB...P', '..P.F.P...', '.P..F..P..', '..........'],
  // capstone: a flame kindled again from its embers
  rekindle: ['G.gggggg.G', '.g..P...g.', 'g...PF...g', 'g..PFFP..g', 'g.PFIFP..g', 'g.PFIIFP.g', 'g.pPIIPp.g', 'g.ooppoo.g', '.yo.oo.oy.', 'G.yyyyyy.G'],
  // a mustard feather: light feet
  nimble: ['........gG', '.......gGy', '......gGy.', '.....gGy..', '....gGy...', '...gGy....', '..gGy.....', '.gGy......', '.yy.......', 'y.........'],
  // a curved knife from behind, a red mark
  backstab: ['.......45W', '......454.', '.....454..', '....454...', '...454.r..', '..g4..rq..', '.gYg.rq...', '.Hg..q....', 'H.........', 'h.........'],
  // capstone: knives flying out every way
  knifeStorm: ['G.gggggg.G', '.g.5..5.g.', 'g5.4..4.5g', 'g.4.WW.4.g', 'g..W33W..g', 'g..W33W..g', 'g.4.WW.4.g', 'g5.4..4.5g', '.y.5..5.y.', 'G.yyyyyy.G'],
  // a quick sidestep: an afterimage of smoke beside a mustard slab
  quickSlip: ['..........', '.{}~..gg..', '{}~..gGGy.', '.{}~.gGGy.', '..{}~gGGy.', '.{}~.gGGy.', '..{}~ggYy.', '.{}~.YYYY.', '{}~.......', '..........'],
  // a dodge that hits back: a curling arrow round into a knife
  tumble: ['...ggg....', '..g...g...', '.g.....g..', '.g.....gg.', '.g....gGg.', '..g....g..', '...5......', '..545.....', '.545......', 'Hg........'],
  // capstone: two dodges standing ready
  untouchable: ['G.gggggg.G', '.g......g.', 'g.gg..gg.g', 'g.Gy..Gy.g', 'g.Gy..Gy.g', 'g.Gy..Gy.g', 'g.yY..yY.g', 'g.YY..YY.g', '.y......y.', 'G.yyyyyy.G'],
  // a cloud of smoke that lingers
  longHaze: ['..........', '...{{}....', '..{}}~}...', '.{}~~~~}..', '{}~~~~~~}.', '{}~~~~~~~}', '.{}}}}}}}.', '..........', '..{}~~}...', '...{}}....'],
  // a red slowed in the smoke
  chokingSmoke: ['..{}~.....', '.{}~~}....', '{}~~~~}...', '.{}}}}.qq.', '......rqqr', '..{}..rqqR', '.{}~}.RrrR', '..{}...RR.', '..........', '..........'],
  // capstone: an eye clouded with smoke
  blindingSmoke: ['G.gggggg.G', '.g{}~~}.g.', 'g{}~~~~}.g', 'g.555554.g', 'g54WkkW45g', 'g54WkkW45g', 'g.455544.g', 'g.{}~~}..g', '.y.{}}..y.', 'G.yyyyyy.G'],
});
