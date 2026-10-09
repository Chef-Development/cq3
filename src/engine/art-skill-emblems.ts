// Emblems for the skill nodes that have no painted icon of their own (art-relics.ts skillIcon): about half the rule
// nodes and capstones of the fifteen later heroes showed one generic rune or star (the art audit's worst score,
// docs/art-audit/README.md). Each node now gets the emblem its name is about (smoke, ice, thorns, a bomb, a flame, a
// shield, an arrow, a rock, a fist, an hourglass, a bell, the sun, a clover, a dagger, the moon), in that thing's own
// colours, like the relic families; a capstone adds gold corners. A node whose name matches nothing keeps the rune.
// Pure data (10x10 character maps in art-relics.ts's palette; toCanvas adds the ink outline), no DOM.

/** The emblems, 10x10, lit from the top left. */
export const SKILL_EMBLEMS: Record<string, string[]> = {
  // a puff of smoke, pale on top, dark underneath
  smoke: [
    '....~~....',
    '..~~ww~...',
    '.~wwww~~~.',
    '~wwww~~ww~',
    '~ww~~~~w~}',
    '~~~~}}~~}}',
    '.}}}}}}}}.',
    '..{{}}{{..',
    '...{{..{..',
    '..........',
  ],
  // three ice shards growing from a base
  ice: [
    '....T.....',
    '...WTC....',
    '...WTC..T.',
    '.T.WTC.WC.',
    'WTCWTCWTC.',
    'WTCWTCWTC.',
    'WTCtTCtTC.',
    '.tCtTCtC..',
    '..cttCCc..',
    '...cccc...',
  ],
  // a sprout in a mound of earth (thorns, roots, pollen)
  thorn: [
    '..........',
    '.ff....fE.',
    '.fEE..fEe.',
    '..EEe.Eee.',
    '...eeNeN..',
    '.....N....',
    '....dN....',
    '...hHHd...',
    '..hJHHhd..',
    '...dddd...',
  ],
  // a round bomb, its fuse lit
  bomb: [
    '.......IF.',
    '......Fp..',
    '.....dh...',
    '...3442...',
    '..345432..',
    '.34W54322.',
    '.34544322.',
    '.23443221.',
    '..222211..',
    '...1111...',
  ],
  // a flame, white at the heart
  flame: [
    '....I.....',
    '...IF.....',
    '...FP..I..',
    '..FPp..F..',
    '..FPpPPF..',
    '.FPpIPpPF.',
    '.PpOIIppP.',
    '.pOOooOpp.',
    '..OooooO..',
    '...oooo...',
  ],
  // a kite shield with a pale stripe
  shield: [
    '.mLLLLLll.',
    'mLLmmLlllB',
    'mLLmmLlllB',
    'mLLmmLllBB',
    'LLlmmlllBB',
    '.LllmlllB.',
    '.LlllllBb.',
    '..lllBBb..',
    '...lBBb...',
    '....bb....',
  ],
  // an arrow flying up and to the right, red fletching
  arrow: [
    '......4555',
    '.......445',
    '......H.45',
    '.....H...4',
    '....H.....',
    '...H......',
    'q.H.......',
    'qrH.......',
    'rrr.......',
    '.RR.......',
  ],
  // a boulder with a crack
  rock: [
    '..........',
    '....JJj...',
    '..JJJjjH..',
    '.JJjjjHHh.',
    '.JjjdjHhh.',
    'JjjjHdhHhd',
    'jjjHHhdhhd',
    '.jHHhhhdd.',
    '..hhhddd..',
    '..........',
  ],
  // a clenched fist: knuckles on top, a thumb across
  fist: [
    '..........',
    '..JJjJjJh.',
    '.JJjJjJjhh',
    '.JjHjHjHhh',
    '.JjjjjjjHh',
    'JJjJJjjjHh',
    'JjjjJjjHHh',
    '.jjjjjHHh.',
    '..hhhhhh..',
    '...dddd...',
  ],
  // an hourglass, gold sand running
  time: [
    '.gggggggg.',
    '.g555544g.',
    '.g4GGgy3g.',
    '..g4Gy3g..',
    '...g5yg...',
    '...gy4g...',
    '..g4yG3g..',
    '.g4GGgy3g.',
    '.g444433g.',
    '.yyyyyyyy.',
  ],
  // a bell
  bell: [
    '....gg....',
    '...gGGg...',
    '..gGGggy..',
    '..gGgggy..',
    '..gGgggy..',
    '.gGggggyy.',
    '.gggggyyY.',
    'gggggyyyYY',
    '.YYYYYYYY.',
    '....zz....',
  ],
  // the sun and its rays
  sun: [
    '....G.....',
    '.G..G...G.',
    '..gGGGgy..',
    '..GFFGgy..',
    'GGGFFGggyy',
    '..GGGggy..',
    '..gggyyy..',
    '.y..y...y.',
    '....y.....',
    '..........',
  ],
  // a four-leaf clover
  luck: [
    '..EE..EE..',
    '.EffEEfEe.',
    '.EfEEEEee.',
    '..EEeeEe..',
    '.EEeNNeEe.',
    'EfEeNNeeeN',
    '.EEee.eeN.',
    '..ee.N.ee.',
    '.....N....',
    '....N.....',
  ],
  // a dagger, point up and to the right
  dagger: [
    '.........5',
    '........54',
    '.......543',
    '......543.',
    '.....543..',
    '..g.543...',
    '..gg43....',
    '...ggg....',
    '..hg.gg...',
    '.hh...g...',
  ],
  // a crescent moon and a twinkle
  moon: [
    '...wwww...',
    '..wwVV....',
    '.wwVV.....',
    '.wVV....+.',
    'wwVV...+*+',
    'wVVv....+.',
    'wVVv......',
    '.VVvv...v.',
    '..vvvvvv..',
    '...vvvv...',
  ],
};

/** Which emblem a node's id and name call for: the first rule that matches (order matters: "Frost Trail" is ice). */
const EMBLEM_RULES: Array<[RegExp, string]> = [
  [/time|tick|pause|clock|borrow|windback|backspin|standstill|loop|linger|quicken/, 'time'],
  [/bell|toll|peal|reson|resound|ringer/, 'bell'],
  [/smoke|haze|fume|chok|blind|cloak/, 'smoke'],
  [/fire|flare|burn|melt|kindle|ember|ignit/, 'flame'],
  [/ice|frost|freez|cold|hail|brittle|skat|bend|aura|avalanche|chill|snow/, 'ice'],
  [/powder|shrapnel|kaboom|mine|shock|blast|splash|catalyst|toss|keg|boom/, 'bomb'],
  [/thorn|root|pollen|bloom|vine|sprout|seed/, 'thorn'],
  [/guard|ward|shell|wall|rampart|skin|unshaken|shrug|retaliat|untouchable|oath|echo|brace/, 'shield'],
  [/luck|leaf|pouch|restock|pinball|turnabout/, 'luck'],
  [/shot|draw|quiver|pinning|steady|watch|expos|deadfall|aim|arrow/, 'arrow'],
  [/slam|rock|stone|fault|landslide|bedrock|ruptur|wreck|rain|quake|hoof|split|bounce/, 'rock'],
  [/haymaker|pulver|knock|shove|payback|seeth|berserk|roar|cry/, 'fist'],
  [/sun|light|gleam|gilt|morning|solar|midas/, 'sun'],
  [/fang|bite|stab|knife|nimble|tumble|slip/, 'dagger'],
  [/moth|moon|wisp|bond|hunting|call|glow/, 'moon'],
];

/** The emblem for a node (by its id and name), or null: it keeps the rune. */
export function emblemFor(id: string, name: string): string | null {
  const s = `${id} ${name}`.toLowerCase().replace(/\s+/g, '');
  for (const [re, key] of EMBLEM_RULES) if (re.test(s)) return key;
  return null;
}

/** A capstone's emblem: the same picture with gold corners (like the painted capstones' rims). */
export function capstoneOf(rows: string[]): string[] {
  const out = rows.map((r) => [...r]);
  out[0][0] = 'G';
  out[0][9] = 'G';
  out[9][0] = 'y';
  out[9][9] = 'y';
  out[0][1] = out[0][1] === '.' ? 'g' : out[0][1];
  out[1][0] = out[1][0] === '.' ? 'g' : out[1][0];
  out[0][8] = out[0][8] === '.' ? 'g' : out[0][8];
  out[1][9] = out[1][9] === '.' ? 'g' : out[1][9];
  out[9][1] = out[9][1] === '.' ? 'y' : out[9][1];
  out[8][0] = out[8][0] === '.' ? 'y' : out[8][0];
  out[9][8] = out[9][8] === '.' ? 'y' : out[9][8];
  out[8][9] = out[8][9] === '.' ? 'y' : out[8][9];
  return out.map((r) => r.join(''));
}
