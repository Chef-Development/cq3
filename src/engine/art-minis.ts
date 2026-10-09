// Every foe's map-scale stand-in (see docs/art-style.md): the little sprite that waits on an act map's fight, elite
// and boss nodes, walks with a roaming pack, paces the world map's road and stands on the skirmish card. Facing left
// (toward the hero), 1-2 frames (an idle bob, a flap, a flicker), drawn from each foe's fight sprite (art-foes.ts,
// art-frost.ts, art-ash.ts) so it reads as that foe: its silhouette, its palette, its signature feature. Ordinary foes
// are about 8-12 px wide (up to 16 with wings or legs spread), elites a little bigger, the later regions' mini-bosses
// bigger again and each region's boss biggest (they stand before their lair).
//
// Pure data and one lookup, no DOM and no Phaser (the unit tests import it: tests/unit/minis.test.ts fails when a foe
// that can stand on a map has none). art-map.ts paints them at boot as `mfoe_${sprite}_${frame}` (each grid gets a
// 1 px ink outline there). The views never pick a texture themselves: `miniKey` does, and a sprite without a mini is
// recorded in MINI_MISSES (the Playwright tests read it as `window.__cq3.miniMisses`) and drawn as the crossed swords.

export type MiniPal = Record<string, string>;

export interface Mini {
  pal: MiniPal;
  /** 1-2 frames of character rows ('.' is clear; every other character is a key of `pal`). */
  frames: string[][];
}

const INK = '#140c1c';

/** Frame 2 of an idle bob: everything above row `drop` sinks a pixel (that row is squeezed out), the feet stay. */
const bob = (rows: string[], drop: number): string[] => ['.'.repeat(rows[0].length), ...rows.slice(0, drop), ...rows.slice(drop + 1)];

// ------------------------------------------------------------------ the first region's foes

const SLIME = { 1: '#14284a', 2: '#1b5464', 3: '#25866e', 4: '#3fb47e', 5: '#7cdc8e', 6: '#d4fac0' };
const CROW = { 0: '#100c20', 1: '#1e1e3c', 2: '#2e3460', 3: '#42548a', 4: '#6488bc', 5: '#9ccce0' };
const FUR = { 1: '#2e1622', 2: '#5a2e26', 3: '#8a4a2c', 4: '#b06a36', 5: '#d8964e' };
const PURP = { 1: '#1e1430', 2: '#36244e', 3: '#523a72', 4: '#7a5a9a', 5: '#a888c8' };
const GOLD_P = { G: '#fff0a0', g: '#f2c230', y: '#d8901c', Y: '#9a5a14' };

const GREENMARCH_MINIS: Record<string, Mini> = {
  slime: {
    pal: { ...SLIME, W: '#ffffff', k: INK },
    frames: [
      ['...5555...', '..566654..', '.56W65544.', '.5k55k444.', '45k55k4443', '4555554433', '3444443332', '.22222221.'],
      ['..........', '...55554..', '.556W6544.', '45k55k5443', '45k55k4443', '4555544433', '3444443332', '2222222221'],
    ],
  },
  slimelet: {
    pal: { ...SLIME, W: '#ffffff', k: INK },
    frames: [
      ['..555..', '.56W54.', '5k5k443', '4555433', '.22221.'],
      ['.......', '.5565..', '5k5k543', '4555433', '2222221'],
    ],
  },
  bigslime: {
    pal: { ...SLIME, ...GOLD_P, W: '#ffffff', k: INK },
    frames: [
      ['.....g.g.g...', '.....gyGyg...', '...5555555...', '..566666554..', '.56W66655544.', '.5k55k555444.', '45k55k5554443', '4555555544433', '3444444443332', '.22222222221.'],
      ['.............', '.....g.g.g...', '.....gyGyg...', '..555555554..', '.566W6665544.', '45k55k5554443', '45k55k5554443', '4555555544433', '3444444443332', '2222222222221'],
    ],
  },
  crow: {
    pal: { ...CROW, ...GOLD_P, E: '#ff4a3a', k: INK },
    frames: [
      ['...........', '..443......', '.45433.....', 'ggE33332...', '.y3333222..', '..33222221.', '...2222.111', '....y..y...'],
      ['......4....', '..443.43...', '.454334....', 'ggE33332...', '.y3333222..', '..33222221.', '...2222.111', '....y..y...'],
    ],
  },
  boar: {
    pal: { ...FUR, W: '#fff4e0', p: '#d88078', P: '#a85458', k: INK, h: '#2a1c24' },
    frames: [['.....1.1.1..', '...13444321.', '..345444433.', '.3k44444332.', 'pp444444332.', 'PW343333221.', '.W.h1..h1...']],
  },
  bandit: {
    pal: { ...PURP, S: '#f2b888', s: '#d88a5a', k: INK, A: '#eef3fa', a: '#7c86a6', d: '#2a1810', D: '#4a2c18' },
    frames: [['...443...', '..45443..', '.4kkkk3..', '.4SkSs3..', '..3s432..', '.433332..', 'A4433322.', 'a.43332..', '..3.32...', '..d..d...']],
  },
  knight: {
    pal: { 1: '#2a3440', 2: '#465462', 3: '#6e7e8a', 4: '#a4b2b4', 5: '#e2ead8', k: INK, E: '#d8ff6a', L: '#b4d058', l: '#78a83c', f: '#4a7e36', F: '#2e5a32', g: '#f2c230', y: '#d8901c' },
    frames: [['...lL4...', '..L4543..', '..4kEk3..', '..33332..', 'gLlf432..', 'yllff332.', 'yfff4332.', '.yff3332.', '..y.3.2..', '...2..2..']],
  },
  captain: {
    pal: { ...PURP, ...GOLD_P, W: '#ffffff', w: '#ece6f8', S: '#f2b888', s: '#d88a5a', k: INK, R: '#8a1a22', q: '#d03030', m: '#2a1810', d: '#2a1810' },
    frames: [['.....wW....', '...4444w...', '.g44554gg..', '..gyyyyy...', '...kSSs....', '...Smms....', '..qqqqR....', '.3qR4432...', '.334g4332..', '..33g332...', '..3.3.3....', '..d...d....']],
  },
  archer: {
    pal: { 1: '#14262a', 2: '#204630', 3: '#3a6e34', 4: '#68a03c', 5: '#a4d04e', h: '#6e4024', H: '#986434', j: '#48261e', E: '#ffe04a', k: INK, o: '#6e4020', a: '#b07a44', s: '#e8e0c8', c: '#4e344c', C: '#704a60', d: '#2a1810' },
    frames: [['...HHh...', '..HhhhH..', '.54Ek4h..', '5544442h.', '.a.43jh..', 'a.cCCCc..', 'as.cCCc..', '.a.cCc...', '..ac.c...', '...d.d...']],
  },
  shaman: {
    pal: { 1: '#501650', 2: '#7e1e68', 3: '#ac2c7c', 4: '#d85a92', 5: '#ff9cb4', O: '#fff4e4', g: '#3e1438', f: '#2e1a30', E: '#eaff8a', w: '#e8f0d8', r: '#2c7064', R: '#4c967a', t: '#1e5050', s: '#8e5a2e', S: '#4e2c16', L: '#f4ffc8', l: '#b4f05a' },
    frames: [['l...........', 'Ls.444......', '.s45O443....', '.443444O32..', '.s3444443321', '.sggggggg1..', '.s.fEfE.....', '.s.wwww.....', '.s.rRRrt....', '.s.rRrtt....', '.s..rrt.....', '.S..t.t.....']],
  },
  beetle: {
    pal: { 1: '#123a4a', 2: '#1a6066', 3: '#2a8c84', 4: '#58c0a2', 5: '#c4f4c8', b: '#dca444', B: '#a86a26', u: '#30223c', E: '#ff6a3a', k: INK },
    frames: [['.....4443....', '...445543332.', '..4554433322.', '.u45433333221', 'uEbbbbbbbbbB.', '.uu.u..u..u..']],
  },
  golem: {
    pal: { 1: '#34344a', 2: '#545264', 3: '#78747c', 4: '#a09a96', 5: '#c8c0b2', C: '#447436', D: '#6e9c3c', E: '#a8c850', t: '#22a098', u: '#62e4d4', U: '#d8fff6', k: INK },
    frames: [['....DEDC....', '...45543....', '...4uU42....', '.DE443332E..', '45542u33221.', '4544u3332321', '.442333322..', '..43333321..', '..432..321..', '.4432..3321.']],
  },
  wolf: {
    pal: { 1: '#28304c', 2: '#404c6e', 3: '#5e6e92', 4: '#8a9cb8', 5: '#c0ccd8', W: '#f6f4ee', w: '#b4bccc', E: '#ffd84a', k: INK },
    frames: [['..4.4.......', '..444.......', '.4E443...44.', 'k44444333421', '.wW4433333..', '..w43332221.', '...4.3..3.2.', '...4.3..3.2.']],
  },
  boarking: {
    pal: { 1: '#3a1a22', 2: '#5e3030', 3: '#844a38', 4: '#a86a48', 5: '#c88e5e', m: '#1e1018', n: '#2e1622', o: '#46222e', ...GOLD_P, W: '#fff4e0', w: '#d8c8a8', p: '#d88078', P: '#a85458', e: '#ff5a3a', k: INK, h: '#2a1c24' },
    frames: [
      ['....g.g.g.......', '....gGgGg.......', '....yyyyynnm....', '...34444onnnmm..', '..3e44443onnnmm.', '.34444443oonnm..', 'pp4444443332221.', 'PW344443333221..', 'W.w33333322221..', '..h21..h2..h21..'],
    ],
  },
  piglet: {
    pal: { 1: '#7a4430', 2: '#a8683e', 3: '#d08e52', 4: '#f0b870', p: '#d88078', k: INK, h: '#2a1c24' },
    frames: [['..4.....', '.4433333', 'pk433322', 'p3332221', '.h1..h1.']],
  },
};

// ------------------------------------------------------------------ the second region's foes (art-frost.ts)

// shared ramps from the fight art (dark to light, hue-shifted)
const ICE = { a: '#2a4c8c', b: '#3c7cbc', c: '#68b2dc', d: '#a8e0f2', I: '#e8fbff' };
const SNOWFUR = { 1: '#5a5e8a', 2: '#878eb6', 3: '#b2bcd8', 4: '#dae2f2', 5: '#ffffff' };
const AMBER = '#ffb02a';

const FROST_MINIS: Record<string, Mini> = {
  // a small cobalt imp: a frosted horn sweeping up and back, big amber eyes, a fanged grin, a red knit scarf
  rimeimp: (() => {
    const f0 = [
      '......cI..',
      '.....bc...',
      '..445b....',
      '.4555443..',
      '.4O4O443..',
      '.4mmt332..',
      'qQQqqqRy..',
      '.R44332qy.',
      '..43322.y.',
      '..3...2...',
      '.21..21...',
    ];
    return { pal: { 1: '#24266c', 2: '#34449e', 3: '#4a6aca', 4: '#7a9ce8', 5: '#b4d0ff', ...ICE, O: AMBER, m: '#2a0c24', t: '#f4f0e8', q: '#c42a2e', Q: '#ee5440', R: '#7a1622', y: '#f4e8d0' }, frames: [f0, bob(f0, 8)] };
  })(),
  // a pale bat on wide ice-blue wings, icicles hanging off them
  iciclebat: {
    pal: { 1: '#463e6c', 2: '#6e6696', 3: '#9a94c0', 4: '#c8c6e2', 5: '#f2f2fc', ...ICE, O: AMBER, t: '#ffffff' },
    frames: [
      ['d...........d', 'cd..4...4..dc', 'bcd.45554.dcb', 'abcc4O4O4ccba', '.abb3t4t3bba.', '..I.b.3.b.I..', '..d.......d..'],
      ['.............', '....4...4....', '.ddc45554cdd.', 'dccb4O4O4bccd', 'cbba3t4t3abbc', 'Ia.a.333.a.aI', 'd...........d'],
    ],
  },
  // a round white yeti kid, a peach face, a snowball held out in front
  yeticub: (() => {
    const f0 = [
      '.....4.554..',
      '...45555554.',
      '..455PPPP543',
      '..45PkPPk443',
      '.wv4PPmmP433',
      'wWWv4pPPp433',
      'wWvv34444332',
      '.vv..122122.',
    ];
    return { pal: { ...SNOWFUR, P: '#f0b890', p: '#d48a6c', k: INK, m: '#5e2e34', w: '#ffffff', W: '#d0e4f6', v: '#8aa4d0' }, frames: [f0, bob(f0, 6)] };
  })(),
  // elite: a hulking blue-grey ogre, a white tuft, a brown pelt over its hunched back, an ice club held low
  snowogre: (() => {
    const f0 = [
      '...hIh.......',
      '..h5544.rPp..',
      '..4O444rPPPp.',
      '..t4433PPPPr.',
      '.4443333pppr2',
      '445433333332.',
      '4543.3333332.',
      '43d..pPPPpp1.',
      '.cId.433.332.',
      '.bdc.43...32.',
      '..ba.32...32.',
      '...a221..221.',
    ];
    return { pal: { 1: '#323c62', 2: '#4e5e88', 3: '#7084a8', 4: '#98aec8', 5: '#c8d8e6', h: '#dae2f2', p: '#7e4426', P: '#a86a36', r: '#52281e', ...ICE, O: AMBER, t: '#f4f0e8' }, frames: [f0, bob(f0, 7)] };
  })(),
  // a white spider, ice crystals on its back, legs arched high, a cluster of ember eyes
  frostweaver: {
    pal: { 1: '#56488c', 2: '#878eb6', 3: '#b2bcd8', 4: '#dae2f2', 5: '#ffffff', ...ICE, O: '#ff7a3a', l: '#7a6aae', L: '#56488c' },
    frames: [
      [
        '........dI.d...',
        '.......cdcdI...',
        '..l...c455543..',
        '.l.l.34555544..',
        'l.43l344444443.',
        'lO443.4444433l.',
        '.O32.l.43332..l',
        '.l..l..l...l..l',
        'L..L...L...L..L',
      ],
    ],
  },
  // a floating hood of frost, a gold-rimmed mirror for a face, icy wisps for a tail
  icewraith: {
    pal: { 1: '#1a1a44', 2: '#262c64', 3: '#354686', 4: '#4a66a8', 5: '#6a8cc8', M: '#d4e0f0', m: '#a8b8d4', W: '#ffffff', g: '#f2c230', ...ICE },
    frames: [
      ['....54..', '...5432.', '..54432.', '.5gWM32.', '.5MmM321', '.4mMm321', '..gg3321', '.d.3321.', '..cb.c1.', '...d..c.', '....I...'],
      ['....54..', '...5432.', '..54432.', '.5gWM32.', '.5MmM321', '.4mMm321', '..gg3321', '..d3321.', '.c.bc1..', '..d.c...', '.I...d..'],
    ],
  },
  // a hooded goblin in a rust parka, a white fur trim, an ice-orb staff
  hailcaller: (() => {
    const f0 = [
      'Id.......',
      'dcI.4455.',
      '.s.45554.',
      '.s41G3432',
      'GGGOG3432',
      '.sgGg4432',
      '.s.g44332',
      '.sw443332',
      '.sWWWWWw.',
      '.s.11.11.',
    ];
    return { pal: { 1: '#2a1210', 2: '#5a2418', 3: '#8e3c1e', 4: '#c0602a', 5: '#e08a44', g: '#2e6e48', G: '#86c45e', O: AMBER, w: '#b2bcd8', W: '#ffffff', s: '#6e4020', ...ICE }, frames: [f0, bob(f0, 7)] };
  })(),
  // elite: a tortoise whose shell is a glacier: an ice dome with crystal spikes, a sprout on top
  glaciertortoise: (() => {
    const f0 = [
      '.......G...I...',
      '....I.cg..Id...',
      '...dccbbbbcb.I.',
      '..dcIcbbbbbbbd.',
      '.dccbbbbbbbbaa.',
      '43ccbbbbbbbaaaa',
      '4O3AAAAAAAAAAA.',
      '.32.h4h4..h4h4.',
      '....hhh...hhh..',
    ];
    return { pal: { 2: '#7a5032', 3: '#a67a46', 4: '#cca868', h: '#7a5032', ...ICE, A: '#1c2a5a', O: INK, g: '#3a7a3a', G: '#7ac850' }, frames: [f0, bob(f0, 6)] };
  })(),
  // a shaggy white snow troll with a big pink nose, a shovel in hand
  drifttroll: (() => {
    const f0 = [
      '....4554...',
      '...455554..',
      '..45555543.',
      '..kO555443.',
      '.Pp45544432',
      'PPp45544332',
      '.ut4544332.',
      '.S44444332.',
      '.S433333321',
      'mSm.ut..ut.',
      'MmM.11..11.',
    ];
    return { pal: { 1: '#4e4e78', 2: '#7a7ea6', 3: '#a6aecc', 4: '#c4cce4', 5: '#e8eef8', k: INK, O: '#5a5e8a', p: '#c87878', P: '#f0a8a0', t: '#7c8aa2', u: '#56627e', S: '#8e5a2e', m: '#b8c2d8', M: '#7c86a6' }, frames: [f0, bob(f0, 7)] };
  })(),
  // a ribbon of aurora light round a small bright core
  aurorawisp: {
    pal: { a: '#2a9a62', A: '#6ae890', b: '#1a8aa0', B: '#5ad8e8', c: '#8a2a9a', C: '#e070c8', d: '#5a1a6a', W: '#ffffff', Y: '#fff0a0', y: '#f2c230', o: '#ff9a3a', h: '#fff8d0' },
    frames: [
      ['..CAAC...', '.cA..Ac..', '...hYh...', '..hYWYh..', '...yoy...', '..aBAb...', '.a.B.ba..', '.B..b..B.', 'c...C...c', '.....d...'],
      ['..cAAC...', '.CA..Ac..', '...hYh...', '..YWWYh..', '...yoy...', '..bABa...', '..aB.bB..', '.c..b..a.', '..C..c..B', 'd........'],
    ],
  },
  // elite: a dark-steel knight sealed in ice: crystals on the helm and shoulders, a red tabard, an ice sword
  frostknight: (() => {
    const f0 = [
      '...dI.d...',
      '...c4dc...',
      '..4543....',
      '..kOk3....',
      'dc4332cd..',
      'cb3RR32bc.',
      '.I3Rr322..',
      '.d33332...',
      '.c.3.32...',
      '.b.32.32..',
      '...11.11..',
    ];
    return { pal: { 1: '#20283e', 2: '#343f5c', 3: '#4e5c7c', 4: '#76869e', 5: '#a8b8c8', k: INK, R: '#c42a2e', r: '#7a1622', O: '#ffd84a', ...ICE }, frames: [f0, bob(f0, 7)] };
  })(),
  // mini-boss: a colossal mountain ram: grey-white fleece, a slate face, a great golden curled horn, a bell
  rimehorn: (() => {
    const f0 = [
      '....hHHh........',
      '...hHyYHh.......',
      '..sHy..Hh4554...',
      '.ssHY.yH455554..',
      'ssOsYHh45555543.',
      'ssssssr44554433.',
      '.wss.gr44444433.',
      '..s..g344444333.',
      '....33.3333333..',
      '....22.22..22...',
      '....22.22..22...',
      '....11.11..11...',
    ];
    return { pal: { 1: '#3a3852', 2: '#56566e', 3: '#b6bcd8', 4: '#dce2f2', 5: '#ffffff', s: '#3a3852', h: '#a87436', y: '#d0a05a', Y: '#7a4a26', H: '#ecc88a', O: AMBER, r: '#c42a2e', g: '#f2c230', w: '#f4f0e8' }, frames: [f0, bob(f0, 8)] };
  })(),
  // mini-boss: the loom matron, a giant plum spider: a lattice-patterned abdomen, a white bonnet, gold eyes, a lantern
  matron: (() => {
    const f0 = [
      '..WW.......34443..',
      '.W55W.....3545453.',
      '.4gg4....345L4L443',
      '..442l..34L4L4L442',
      '.l.l.l.l3L4L4L4442',
      'l..l..ll.4L4L4L432',
      'l.Y.l..l..4433332.',
      'l.g..l..l..l...l.l',
      '..Y..l..l...l..l.l',
      '.L...L..L...L..L.L',
    ];
    return { pal: { 1: '#34204e', 2: '#523474', 3: '#74509a', 4: '#9a78c0', 5: '#c8a8e0', L: '#a8e0f2', W: '#ffffff', g: '#f2c230', Y: '#fff0a0', l: '#8a6ab8' }, frames: [f0, bob(f0, 5)] };
  })(),
  // the boss: the rime wyrm, coiled on her hoard: ice-blue scales, a white belly, an ice crest, gold beneath
  glacia: (() => {
    const f0 = [
      '......cI............',
      '....45cdI...........',
      '..4555c.......I.....',
      '.455O5444....dI..I..',
      '4444w444....cdcd.dI.',
      'w.ww.444...ccdcdcd..',
      '.....w444.4555555443',
      '......w44455555544.3',
      '.......w444555444332',
      '...ww...w44444443332',
      '..w44ww..ww44443322.',
      '.w4433wwwwww4333221.',
      'gggy43332222333222gg',
      'gGgygGwwwwwwwwwgyGgg',
    ];
    return { pal: { 1: '#162a5a', 2: '#22468a', 3: '#306eb4', 4: '#4e9ad4', 5: '#8acaec', w: '#e8ecf4', O: '#ffd84a', ...ICE, ...GOLD_P }, frames: [f0, bob(f0, 9)] };
  })(),
};

// ------------------------------------------------------------------ the third region's foes (art-ash.ts)

// the glow every foe here carries (as art-ash.ts's HOT: red, orange, gold, white-hot) and its smoke; Ashfell is black
// and grey, so each mini keeps something hot or bright to read against the ash
const HOT = { Q: '#a0221a', q: '#e0501c', x: '#ff8a24', X: '#ffc84a', Z: '#fff4b8', s: '#d8d0dc', S: '#a49aac', u: '#6e6476' };
const COAL = { 1: '#1c1620', 2: '#2c2228', 3: '#40302e', 4: '#5a4236', 5: '#7a5a42' };

const ASH_MINIS: Record<string, Mini> = {
  // a walking lump of glowing coal: ember eyes and mouth, a flickering flame tuft, stubby legs
  cinderling: {
    pal: { ...COAL, 6: '#9a7a5a', ...HOT },
    frames: [
      ['....x....', '...xXq...', '..65Zx5..', '.6554432.', '.5X54X31.', '.43qxq21.', '.3332221.', '..22221..', '..1..1...'],
      ['...q.....', '....Xx...', '..65xZ5..', '.6554432.', '.5X54X31.', '.43qxq21.', '.3332221.', '..22221..', '..1..1...'],
    ],
  },
  // a ragged kite of soot-black feathers with glowing edges, a smoking tail streamer
  cinderkite: {
    pal: { 1: '#1e1826', 2: '#2e2636', 3: '#443a4e', 4: '#625468', 5: '#86748a', ...HOT, b: '#8e6a3a', E: '#ffc84a' },
    frames: [
      ['.....x........', '....x43x......', '...x4322x.....', 'bEx33222221Sus', '...x2211q1uS..', '....x21q......', '.....q........'],
      ['..............', '....x43xx.....', '..xx43322x....', 'bEx33222221Sus', '...xq2211quS..', '.....qq.......', '..............'],
    ],
  },
  // a squat red crab under a cluster of basalt columns, one big claw, steam at the joints
  cragcrab: (() => {
    const f0 = [
      '.......nM....',
      '.....nMmMm.s.',
      '..k..MmCmCs..',
      '..E..MmCmC...',
      '45.234mCmC2..',
      '453444433332.',
      '.32.23332221.',
      '....2.2..2.2.',
    ];
    return { pal: { 1: '#5a1a16', 2: '#8e2e1c', 3: '#c04a26', 4: '#e07a3a', 5: '#f8b070', C: '#3e3e4c', m: '#5a5866', M: '#7c7884', n: '#a8a2aa', k: INK, E: '#ffd040', ...HOT }, frames: [f0, bob(f0, 4)] };
  })(),
  // elite: a huge ox of black volcanic glass: glowing cracks, a bone horn curling over its head, a brass nose ring
  obsidianox: (() => {
    const f0 = [
      '..HHh..........',
      '.H..hh..4554...',
      '.H...44455544..',
      '..h4X44455x4443',
      '.4444x433344443',
      '44443333x333332',
      'g44.333333x3322',
      'yg..33.23..332.',
      '....22.1...22..',
      '....11.1...11..',
    ];
    return { pal: { 1: '#120f1e', 2: '#201c34', 3: '#322e50', 4: '#504c7e', 5: '#8c8ac0', h: '#c8b48e', H: '#ece0c0', g: '#f2c230', y: '#c8901c', ...HOT }, frames: [f0, bob(f0, 7)] };
  })(),
  // mini-boss: a colossal armadillo: banded basalt plates, a dented cauldron for a hard hat, a striped sash
  rumbleback: (() => {
    const f0 = [
      '...I..............',
      '..iwi....3444443..',
      '.iiIii.345454544..',
      '.iiiii34545454543.',
      'jHHk.343O45454543.',
      'jHHHH34345o545442.',
      '.HhHh3343434O4o42.',
      '..h..33333333o322.',
      '....hJ.hJ...hJ....',
      '....JJ.JJ...JJ....',
    ];
    return { pal: { 1: '#2c2a32', 2: '#423f48', 3: '#5e5a64', 4: '#827c86', 5: '#aca4ac', h: '#7a4a46', H: '#a46c5c', j: '#cc9478', J: '#4e2c30', i: '#34323c', I: '#76747e', w: '#b0aeb8', o: '#f27a1c', O: '#ffb05a', k: INK }, frames: [f0, bob(f0, 7)] };
  })(),
  // a goblin glassblower: goggles pushed up, cheeks puffed, a blowpipe with a glowing glass bubble
  glassblower: (() => {
    const f0 = [
      '......45..',
      '....455445',
      '...4LlgL43',
      '...544443.',
      '..554443..',
      '...p.aAAa.',
      '..p..aAAa.',
      'Xp...aAAd.',
      'ZX...a.a..',
    ];
    return { pal: { 2: '#2c6234', 3: '#488a3e', 4: '#74b44e', 5: '#b0dc74', l: '#5ad8e8', L: '#d8fbff', g: '#f2c230', a: '#6e4426', A: '#98663a', d: '#4a2c18', p: '#7c86a6', ...HOT }, frames: [f0, bob(f0, 5)] };
  })(),
  // a bat with stained-glass wings: red and amber panes on one, green and blue on the other, in black leading
  prismbat: {
    pal: { 2: '#30283c', 3: '#463a54', 4: '#62546e', r: '#d03a30', R: '#ff8a70', a: '#f0a020', A: '#ffe070', g: '#3aa84a', G: '#9ae87a', b: '#3a7ad0', B: '#9ad0ff', L: '#1a1420', E: '#ffd8f0' },
    frames: [
      ['R.............B', 'rR...4...4...Bb', 'rrRL.43334.LbBb', 'aRrrL4E4E4LbbBg', 'AaaLL33433LLGgg', '.AaL..323..LGg.', '..a....2....g..'],
      ['...............', '.....4...4.....', 'RrRrL43334LbBbB', 'raRrL4E4E4LbbGg', 'AaaLL33433LLGgg', '.aaL..323..Lgg.', '..A....2....G..'],
    ],
  },
  // a praying mantis of green bottle glass: big eyes, see-through scythe arms folded, long legs
  glassmantis: (() => {
    const f0 = [
      '.4..4.....',
      '..4.4.....',
      '..E44.....',
      '.E443.....',
      '...32.....',
      '..C32.....',
      'WC.32.....',
      'C.C332....',
      '...3334432',
      '...2.33221',
      '..2..2..2.',
      '..2..2...2',
      '.1...1...1',
    ];
    return { pal: { 1: '#124a2a', 2: '#1e7038', 3: '#3a9a4a', 4: '#72c46a', C: '#b4ead0', W: '#e4fff0', E: '#e8ff70' }, frames: [f0, bob(f0, 8)] };
  })(),
  // elite: a walking brick kiln: chimney smoke, a glowing furnace door, glass-bottle pauldrons
  kilnwarden: (() => {
    const f0 = [
      '.......sS...',
      '......sS....',
      '......21....',
      '...455421...',
      '.Gg45454322.',
      'Gg454545433b',
      '.g4iiii432Bb',
      '..4iXZXi32b.',
      '..4ixXxi321.',
      '..3iqxqi321.',
      '..3iiii3221.',
      '..32222221..',
      '...21..21...',
      '..111.111...',
    ];
    return { pal: { 1: '#4e1c18', 2: '#783022', 3: '#a04a2e', 4: '#c4704a', 5: '#e4a070', i: '#34323c', g: '#3aa84a', G: '#a8f0a0', b: '#3a7ad0', B: '#a8d8ff', ...HOT }, frames: [f0, bob(f0, 11)] };
  })(),
  // mini-boss: the forge's two-headed lava hound: two heads (one with a stick), a glowing chain collar, a flaming tail
  hobnob: (() => {
    const f0 = [
      '...4.4...........',
      '..44544.......X..',
      '.4X4443......xZ..',
      '5444433......q...',
      '...4.4X3.....3...',
      '..44544X44443.3..',
      '.4X4443X4444x43..',
      '5t44433X3344x332.',
      'wwww33X3333333322',
      '....33.32..33.2..',
      '....22.21..22.2..',
      '....11.11..11....',
    ];
    return { pal: { 1: '#1e1820', 2: '#302628', 3: '#46383a', 4: '#625048', 5: '#86705c', t: '#f4ead8', w: '#b07a44', ...HOT }, frames: [f0, bob(f0, 9)] };
  })(),
  // a little ember-red imp with smoking horns and a coal shovel bigger than itself
  stokerimp: (() => {
    const f0 = [
      '.....s.s..',
      '....hS.hS.',
      '....h44h..',
      'Ii..4X4X3.',
      'IxI.4tt43.',
      'IiIw4443..',
      '...w4332..',
      '...3w323.3',
      '..33.w2.3.',
      '..2...w33.',
      '.11..11...',
    ];
    return { pal: { 1: '#5a1420', 2: '#8e2226', 3: '#c4342c', 4: '#ea5e3a', h: '#34282c', t: '#fff4dc', w: '#6e4020', i: '#504e58', I: '#76747e', ...HOT }, frames: [f0, bob(f0, 7)] };
  })(),
  // a long eel of cooling lava (black crust, orange beneath) rising from a glowing channel
  magmaeel: {
    pal: { 2: '#30201e', 3: '#463024', 4: '#62442c', 5: '#80603a', ...HOT },
    frames: [
      ['.4543.....', '4X4432....', '.3332xX...', '....2xX...', '.....3xX..', '.....3xX..', '.....3xX..', '....3xXq..', '..q3xXqq..', 'qxXZXxXZxq', '.qqxxxxqq.'],
      ['..4543....', '.4X4432...', '..3332xX..', '....32xX..', '.....3xX..', '.....3xX..', '.....3xX..', '....3xXq..', '..q3xXqq..', 'qxZXxXZXxq', '.qqxxxxqq.'],
    ],
  },
  // a stocky soot-faced forge worker: welding mask pushed up, a scorched leather apron, a hammer
  forgehand: (() => {
    const f0 = [
      '...mMMm...',
      '..mWMMmm..',
      '..433332..',
      '..h4k3k2..',
      '...3332...',
      '.lAAAAAa..',
      '3lAllAAa3.',
      'w.lAAAAa2.',
      'Iw.lAAAa..',
      'Ii.a..a...',
      '...dd.dd..',
    ];
    return { pal: { 2: '#9e5a3c', 3: '#c88058', 4: '#e8a878', h: '#2e2628', k: INK, m: '#7c86a6', M: '#b8c2d8', W: '#eef3fa', a: '#4a2c18', A: '#6e4426', l: '#98663a', w: '#8e5a2e', i: '#4a5272', I: '#b8c2d8', d: '#2a1810' }, frames: [f0, bob(f0, 5)] };
  })(),
  // elite: an empty suit of chain links, a black helm with a glowing eye slit, a chain flail
  chainsentinel: (() => {
    const f0 = [
      '..NNNN.....',
      '..NnnN.....',
      '..XxnN.....',
      '..NNNN.NN..',
      '.343434NnN.',
      '.4343433N2.',
      '.3434343432',
      '.2.34343.2.',
      '.2.43434...',
      'B2.343.43..',
      'BB.34..34..',
      '...23..23..',
      '..112.112..',
    ];
    return { pal: { 1: '#2e3244', 2: '#4a5068', 3: '#727a94', 4: '#a4acc4', n: '#1e1c24', N: '#34323c', B: '#504e58', ...HOT }, frames: [f0, bob(f0, 7)] };
  })(),
  // the boss: a giant old smith of basalt and fire: an ash-grey beard, a furnace in his chest, a door-sized hammer
  bellows: (() => {
    const f0 = [
      '.....4554.........',
      '....455543........',
      '...4X44X432.......',
      '...cCCCCc32443....',
      '..4cCBBCc4455443..',
      '.44cBBBBcnxnxn43..',
      '.4.cBbbBcnXnXn432.',
      '43.cBbbBcnxnxn432.',
      'ggycbBbBcAAAAA432.',
      'iIyw.cbcAAAAAA32..',
      'iiyw..cAAAAAAA22..',
      '...w..3AAA..AA2...',
      '...w..32.....32...',
      '.....221....221...',
    ];
    return { pal: { 1: '#26222c', 2: '#3a3540', 3: '#524c58', 4: '#6e6672', 5: '#958c96', b: '#6a666e', B: '#928e96', c: '#bcb8be', C: '#e6e2e4', A: '#241e24', n: '#0a080c', g: '#f2c230', y: '#c8901c', w: '#6e4020', i: '#34323c', I: '#76747e', ...HOT }, frames: [f0, bob(f0, 9)] };
  })(),
};

// ------------------------------------------------------------------ the fourth region's foes (their fight sprites: art-dusk.ts, to come)

// a marsh at dusk: every mini keeps something lit (a lantern's amber, a wisp's green, the moon on water) to read
// against the violet dusk of its act maps
const LAMP = { L: '#ffe6a8', l: '#ffc870', o: '#e08a2a', O: '#a8501c' };
const MOSS = { 1: '#16201c', 2: '#22362a', 3: '#33503a', 4: '#4c6e48', 5: '#6e8e58', 6: '#9cb46e' };
const VIOL = { 1: '#1a1424', 2: '#2a2038', 3: '#3e3052', 4: '#5a4870', 5: '#7e6a94', 6: '#a894b8' };
const WAVE = { b: '#1b4f6e', B: '#3a86a8', c: '#9fe0f0' };

const DUSK_MINIS: Record<string, Mini> = {
  // a will-o'-wisp: a blue-green flame with a sly face and a tail of sparks
  bogwisp: {
    pal: { W: '#e0fff0', w: '#6ae8b0', g: '#2a9a76', G: '#16604e', k: INK },
    frames: [
      ['....W....', '...WwW...', '..WwwwWg.', '.WwkwkwgG', '.WwwwwwgG', '.wwkkkwgG', '..wwwwgG.', '...wggG..', '....g..w.'],
      ['.....W...', '...WwW...', '..WwwwWg.', '.WwkwkwgG', '.WwwwwwgG', '.wwkkkwgG', '..wwwwgG.', '...wggG.w', '....g....'],
    ],
  },
  // a fat olive toad with a lantern-orange throat sac and lazy, half-shut eyes
  miretoad: (() => {
    const f0 = ['...55...55..', '..5kE5.5kE5.', '.55555555544', 'lo5555555443', 'loo555554433', '.oo444444332', '..3...33..2.'];
    return { pal: { ...MOSS, ...LAMP, E: '#ffe680', k: INK }, frames: [f0, bob(f0, 3)] };
  })(),
  // a little reed-man: a cattail for a hat, a reed pipe
  reedling: (() => {
    const f0 = ['....O....', '...OOo...', '...OOo...', '....4....', '..4555...', '..5k5k4..', '..45554..', 'yy44443..', '..4.4.3..', '..3.3.2..'];
    return { pal: { ...MOSS, O: '#7a4a2a', o: '#4e2c1c', y: '#d8b070', k: INK }, frames: [f0, bob(f0, 7)] };
  })(),
  // elite: a hulking golem of peat and roots with a caged lantern for a heart
  peatgolem: (() => {
    const f0 = [
      '....33333.....',
      '...3444443....',
      '..34E44E4432..',
      '..3444444432..',
      '.233MMMMM3322.',
      '2333MlLlM33322',
      '233.MLlLM.3322',
      '23..MMMMM..322',
      '....33333.....',
      '...333.333....',
      '...22...22....',
    ];
    return { pal: { 1: '#1a120e', 2: '#2e2018', 3: '#4a3424', 4: '#6a4c34', 5: '#8e6a48', M: '#5a5866', E: '#ffc870', ...LAMP }, frames: [f0, bob(f0, 8)] };
  })(),
  // mini-boss: a toad the size of a hut, glowing from inside with every lantern he swallowed
  bellybog: (() => {
    const f0 = [
      '....55.....55.....',
      '...5kE5...5kE5....',
      '..555555555555544.',
      '.5555555555555444.',
      'oo55lLl555lLl54443',
      'ooo5LLL555LLL54443',
      '.oo55l55l55l554433',
      '.o555555555555443.',
      '..4444444444444332',
      '..33.33.....33.32.',
      '.333.333...333.33.',
    ];
    return { pal: { ...MOSS, ...LAMP, E: '#ffe680', k: INK }, frames: [f0, bob(f0, 8)] };
  })(),
  // a goggle-eyed mudskipper standing on its fins, a cheeky grin
  mudskipper: (() => {
    const f0 = ['.EE.........', 'EkkE........', '.55555544...', 'k5555555443.', '.R5555544433', '..554444332.', '..5.4..3.32.', 'bBbBbBbBbBbB'];
    return { pal: { 2: '#2c3a4a', 3: '#40566a', 4: '#5a7a8e', 5: '#84a4b2', E: '#ffe680', R: '#d04a3a', k: INK, ...WAVE }, frames: [f0, bob(f0, 6)] };
  })(),
  // a tall heron in a ferryman's coat, on long legs, a punt-pole spear
  stiltheron: (() => {
    const f0 = ['...444....', '..4E44....', 'yy4444....', '...44.....', '...cc....s', '..cCCc..s.', '..CCCCcs..', '..CCCCc...', '...cCc....', '...y.y....', '...y.y....', '..yy.yy...'];
    return { pal: { 4: '#c8d0dc', E: '#ffe680', y: '#e0a040', c: '#2e3a5a', C: '#46587e', s: '#9a7a4a', k: INK }, frames: [f0, bob(f0, 8)] };
  })(),
  // a hunched little lamplighter: a hood like a candle snuffer, a long wick-pole alight
  lamplighter: (() => {
    const f0 = ['L.........', 'ls...5....', '.s..555...', '.s.55555..', '.s5kE554..', '.s.55554..', '.sh44444..', '..h44443..', '...4443...', '...3.3....'];
    return { pal: { ...VIOL, ...LAMP, E: '#ffe680', h: '#d8b090', s: '#7a5a3a', k: INK }, frames: [f0, ['l.........', 'Ls...4....', ...f0.slice(2)]] };
  })(),
  // elite: a mossy snapping turtle the size of a cart, its shell a sunken island
  oldsnapper: (() => {
    const f0 = ['......66655....', '....665555544..', '...55545554443.', '..5455455444433', 'kE.44444444433.', 'yyy44333333332.', '.y.443.33..332.', '...33..22..22..'];
    return { pal: { ...MOSS, E: '#ffe680', y: '#c8a050', k: INK }, frames: [f0, bob(f0, 5)] };
  })(),
  // mini-boss: a beaver engineer in a brass diving helmet, a clipboard, a flat tail
  sluicekeeper: (() => {
    const f0 = [
      '.....gggg.......',
      '....gMMMMg......',
      '...gMcccMg......',
      '...gMcEcMg......',
      '...gMMMMMg......',
      '....gggg333.....',
      '..pp.3333333....',
      '..pP33333333.TT.',
      '..pp33333333TTTT',
      '....3333333.TTT.',
      '....33...33.....',
      '...222..222.....',
    ];
    return { pal: { g: '#d8a040', M: '#a87028', c: '#9fe0f0', E: '#ffe680', 3: '#7a4a2a', 2: '#4e2c1c', p: '#e8e0c8', P: '#a89a7a', T: '#3e2a20' }, frames: [f0, bob(f0, 9)] };
  })(),
  // a long black eel with glowing violet spots, rising out of the water
  inkeel: {
    pal: { 2: '#2e2640', 3: '#4e4068', v: '#c090ff', E: '#ffe680', ...WAVE },
    frames: [
      ['.22...........', '2E32..........', '.2v32.....232.', '..2332...32v2.', '...2v32223322.', '....2332v32...', 'bBbBbBbBbBbBbB'],
      ['..............', '.22...........', '2E32......232.', '.2v32....32v2.', '..2332.233322.', '...2v32v332...', 'bBbBbBbBbBbBbB'],
    ],
  },
  // a cloud of grey-violet moths round a stolen lantern
  duskmoths: {
    pal: { m: '#7e6a94', M: '#d0c0e8', ...LAMP },
    frames: [
      ['..m.....m...', '.mMm...mMm..', '..m..L...m..', '....lLl.....', '.m..LLL..mM.', 'mMm.lol.mMm.', '.m...o....m.', '...mMm......', '....m.......'],
      ['.m.....m....', 'mMm...mMm...', '.m...L..m...', '....lLl...m.', '..m.LLL..mMm', '.mMmlol...m.', '..m..o..m...', '.......mMm..', '........m...'],
    ],
  },
  // a mossy marsh hag stirring a kettle on a stick, a lantern-jaw grin
  boghag: (() => {
    const f0 = ['....444....', '...44544...', '..4kE5544..', '..45WW544..', '...44444...', 's.3333333..', 's33333333..', 'sK3333333..', 'KKK3333332.', 'KKK.333332.', '...2...2...'];
    return { pal: { ...MOSS, E: '#ffe680', W: '#f0f0d0', s: '#7a5a3a', K: '#3a3a44', k: INK }, frames: [f0, bob(f0, 6)] };
  })(),
  // elite: a knight's armour full of marsh water, weed for a plume, a drowned lantern
  sunkensentinel: (() => {
    const f0 = [
      '...ww........',
      '..ww.........',
      '..AAAA.......',
      '.AAbbAA......',
      '.AAbcAA......',
      '..AAAA.......',
      '.AAAAAAA.....',
      'AAbAAAbAA.l..',
      'AbbbAbbbAAlL.',
      'AAAAAAAAA.l..',
      '.aA...aA.....',
      '.aA...aA.....',
      'bBbBbBbBbBbBb',
    ];
    return { pal: { A: '#6a7484', a: '#3e4654', w: '#4c8e48', ...WAVE, ...LAMP }, frames: [f0, bob(f0, 10)] };
  })(),
  // the boss: a lighthouse wading on stone legs, the sun shut in its lamp, its door a mouth
  lighthouse: {
    pal: { k: INK, L: '#ffe6a8', Z: '#fffbe0', R: '#c03a30', S: '#c8c0b8', s: '#8a8078', ...WAVE },
    frames: [
      [
        '.....kkkk.......',
        '....kLLLLk......',
        '...kLLZZLLk.....',
        '....kLLLLk......',
        '....RRRRRR......',
        '.....SSss.......',
        '....RRRRRR......',
        '....SSSSss......',
        '....SkkSss......',
        '...SSkkSsss.....',
        '...RRRRRRRR.....',
        '...SS....ss.....',
        '..SS......ss....',
        'bBbBbBbBbBbBbBbB',
      ],
      [
        '.....kkkk.......',
        'LL..kLLLLk......',
        'ZLLkLLZZLLk.....',
        'LL..kLLLLk......',
        '....RRRRRR......',
        '.....SSss.......',
        '....RRRRRR......',
        '....SSSSss......',
        '....SkkSss......',
        '...SSkkSsss.....',
        '...RRRRRRRR.....',
        '...SS....ss.....',
        '..SS......ss....',
        'BbBbBbBbBbBbBbBb',
      ],
    ],
  },
};

/** Every foe sprite's map-scale stand-in: `mfoe_${sprite}_${frame}`. */
export const MINIS: Record<string, Mini> = { ...GREENMARCH_MINIS, ...FROST_MINIS, ...ASH_MINIS, ...DUSK_MINIS };

/** What's drawn for a sprite with no mini (and recorded in MINI_MISSES): the crossed swords. */
export const MINI_FALLBACK = 'mapicon_fight';
/** Every sprite asked for that has no mini (each once): `window.__cq3.miniMisses`, read by the Playwright tests. */
export const MINI_MISSES: string[] = [];

/** A foe sprite's mini texture at time `t` (ms: frame 2 on every other 420 ms beat, the views' bob), or the crossed
 *  swords for a sprite that has none, recorded in MINI_MISSES. Every view that draws a foe on a map asks here. */
export function miniKey(sprite: string, t: number): string {
  const m = MINIS[sprite];
  if (!m) {
    if (!MINI_MISSES.includes(sprite)) MINI_MISSES.push(sprite);
    return MINI_FALLBACK;
  }
  return `mfoe_${sprite}_${m.frames.length > 1 && Math.floor(t / 420) % 2 ? 1 : 0}`;
}
