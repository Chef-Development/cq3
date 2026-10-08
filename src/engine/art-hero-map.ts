// The M5 heroes at map scale (see art-map.ts, where Rowan and Sable are drawn the same way): `m${id}_idle0/1` and
// a four-step walk `m${id}_walk0..3`, each ROWAN_W x ROWAN_H (13x16) with the feet at ROWAN_FEET (6, 14), facing
// right. A top map (head to hem, 11 wide) over two rows of legs; idle1 sits a pixel lower, the passing steps
// (walk1, walk3) bob a pixel up, and the back edge of a cape, braid or cloak flaps on the long steps.
import { grid, stamp, toCanvas, type Pal } from './art';
import { SOLENNE_WALKER } from './art-hero-solenne';
import { WREN_WALKER } from './art-hero-wren';

type Add = (key: string, c: HTMLCanvasElement) => void;

const W = 13;
const H = 16;

interface Walker {
  pal: Pal;
  top: string[]; // 10 rows, 11 wide
  legs: Record<'stand' | 'a' | 'pass' | 'b', string[]>; // 2 rows each
  flap?: [string[], number, number]; // drawn on the long steps: rows, x, y relative to the top map
}

const WALKERS: Record<string, Walker> = {
  // silver braid, pale-blue robe with a fur collar and hem, the staff and its crystal held at her side
  neve: {
    pal: {
      c: '#7a84ae', d: '#aeb8da', e: '#eef3fc', B: '#9ea6c8', S: '#fcd0b0', s: '#e8a888', k: '#1a6ab0',
      w: '#ffffff', v: '#b8c8e4', R: '#8ab8ec', r: '#5a8ad0', q: '#3a5aa0', n: '#18245a',
      g: '#e4eefc', G: '#94a6d0', t: '#4c4470', F: '#c4f6ff', E: '#6ad8fa', D: '#28a4e4',
    },
    top: [
      '...cddc...F',
      '..cdeedc.FE',
      '.cdeddddc.D',
      '.cdcSkSkS.t',
      '.Bcd.SSSs.t',
      '.B.vwwwwvSt',
      '.B.RrRrrqst',
      '...qnnnnq.t',
      '...Rrrrrq.t',
      '..wwwwwwwvt',
    ],
    legs: {
      stand: ['...gG.gG..t', '...GG.GG..t'],
      a: ['..gG...gG.t', '.GG.....GGt'],
      pass: ['....gGG...t', '....GGG...t'],
      b: ['..Gg...Gg.t', '.GG.....GGt'],
    },
    flap: [['B.', 'BB'], -1, 7],
  },
  // white fluff and a twig crown, the big nose, the leaf cloak, the seed staff
  moss: {
    pal: {
      t: '#8e5a2e', u: '#c8f070', U: '#f8a0c0', w: '#f4efe2', W: '#d8d0be', S: '#ffd0a4', k: '#140c1c', N: '#f49a80',
      l: '#78a83c', L: '#4a7e36', m: '#2e5a32', y: '#ffc040', Y: '#fff0a0', h: '#b07a44', b: '#6e4020', B: '#4e2c16',
    },
    top: [
      '...........',
      '..u..U..Y..',
      '..t.tt.tyY.',
      '.wwwwwww.h.',
      'wwwwSkSk.h.',
      'wWwSSSNN.h.',
      '.wwwwwww.h.',
      '.lLlLlLlSh.',
      '.LlLlLlLmh.',
      'lLlLlLlLmh.',
    ],
    legs: {
      stand: ['...bb.bb.h.', '...BB.BB.h.'],
      a: ['..bb...bbh.', '.BB.....BB.'],
      pass: ['....bbb..h.', '....BBB..h.'],
      b: ['..BB...BBh.', '.bb.....bb.'],
    },
  },
  // orange bandana, brass goggles up, apron, a lit keg in hand
  tam: {
    pal: {
      o: '#e0661c', O: '#ff9a3a', q: '#a03a14', b: '#f2c230', g: '#5ac8b4', h: '#3a2418', S: '#f4c08a', s: '#d8925e',
      k: '#140c1c', w: '#e8e0d0', W: '#beb4a8', a: '#74442a', A: '#9a643c', p: '#46444e', d: '#4e2c1c', D: '#2e1a14',
      K: '#1e1c28', f: '#ffb02a', F: '#fff0a0',
    },
    top: [
      '...........',
      '...OOooo...',
      '..Oooooooq.',
      '.qoooobgbg.',
      '.hhhSkSSkS.',
      '.hhhSSSSs..',
      '..wwwwwww.F',
      '.WwwaaAaSKf',
      '.Ww.aAaaKK.',
      '...aaaaa...',
    ],
    legs: {
      stand: ['...pp.pp...', '...dD.dD...'],
      a: ['..pp...pp..', '.dD.....dD.'],
      pass: ['....ppp....', '....dDD....'],
      b: ['..pp...pp..', '.Dd.....Dd.'],
    },
  },
  // close-cropped hair and beard, steel and royal blue, the tower shield held in front
  hollis: {
    pal: {
      a: '#2e2834', A: '#463e4c', S: '#925a38', s: '#6e3e26', k: '#140c1c', W: '#f4ece4', d: '#1e1824',
      m: '#b8c2d8', M: '#7c86a6', c: '#2a5ac0', C: '#1a3c8a', V: '#ffffff', X: '#f2c230', l: '#4e2c1c',
      R: '#b8c2d8', r: '#7c86a6', B: '#4a84e0', b: '#2a5ac0', n: '#1a3c8a',
    },
    top: [
      '...aaaaa...',
      '..aAaaaaa..',
      '.aaaSSSSS..',
      '.aasSWkSWk.',
      '..adSdddd..',
      '.mmmmVmRRRr',
      '.MmccVRBVbn',
      '..cccVRBVbn',
      '..lllXRbbbn',
      '..cCcccRrrr',
    ],
    legs: {
      stand: ['...mm.mm...', '..MMm.MMm..'],
      a: ['..mm...mm..', '.MMm...MMm.'],
      pass: ['....mmm....', '...MMMm....'],
      b: ['..Mm...Mm..', '.MMm...MMm.'],
    },
  },
  // raven hair and a long pointed ear, the purple cloak lined with gold, green leathers, the silver longbow
  vesper: {
    pal: {
      h: '#262a40', H: '#3a4262', E: '#f8c49c', S: '#f8c49c', s: '#e09a74', k: '#140c1c', c: '#4e3480', C: '#33205a',
      G: '#f2c040', t: '#38644a', T: '#24483a', y: '#9a643c', l: '#74442a', p: '#24483a', b: '#4e2c1c', B: '#2e1a14',
      i: '#eef3fa', I: '#b8c2d8', f: '#ffffff',
    },
    top: [
      '...hHHh..i.',
      '..hHhhhh.iI',
      'EEhhhSSSS.I',
      '.hhhSkSSk.I',
      '..hhSSSSs.I',
      '.cGctttGcSI',
      'cC.ttyTt..I',
      'cC.tytTt..I',
      'C..llll...I',
      '...tTtt..iI',
    ],
    legs: {
      stand: ['...pp.pp...', '...bB.bB...'],
      a: ['..pp...pp..', '.bB.....bB.'],
      pass: ['....ppp....', '....bBB....'],
      b: ['..pp...pp..', '.Bb.....Bb.'],
    },
    flap: [['c.', 'cG'], -1, 8],
  },
  // red hair and braid, the stone hammer on her shoulder, fur pauldrons, the harness
  torva: {
    pal: {
      h: '#c83a24', H: '#ec6a34', r: '#8a2020', S: '#f4b47c', s: '#d88a5a', k: '#140c1c', g: '#3aa04a', o: '#2a5a7a',
      x: '#c4bcae', X: '#6e6a74', Z: '#96908e', y: '#9a6438', u: '#b8b2b8', U: '#8a8490', l: '#74442a', L: '#4e2c1c',
      q: '#5e3630', p: '#443e5a', b: '#4e2c1c', B: '#2e1a14',
    },
    top: [
      'xZX.hHhh...',
      'ZZXhHhhhh..',
      'XXyhhhSSSS.',
      '..yrhSkSSk.',
      '.rhyhSSSSS.',
      '.ruuyssuuu.',
      'ruuuoLLsuUs',
      '..sssssss..',
      '..lllLlll..',
      '..qqqqqqq..',
    ],
    legs: {
      stand: ['...pp.pp...', '..bbB.bbB..'],
      a: ['..pp...pp..', '.bbB...bbB.'],
      pass: ['....ppp....', '...bbBB....'],
      b: ['..pp...pp..', '.bBB...bBB.'],
    },
  },
  // ---- Yara (Part 6): dark hair with beads, the starry indigo shawl, the white tunic and beaded sash, bare feet, the
  // carved staff with its spirit stone
  yara: {
    pal: {
      h: '#2c2036', H: '#5e4a6c', O: '#f08a30', R: '#d84a3a', S: '#cc8a58', s: '#a8643c', k: '#140c1c', F: '#cc8a58',
      c: '#2c2c8c', C: '#1e1a5a', '*': '#fff6d8', w: '#eeeef8', W: '#cacae0', o: '#f08a30', y: '#f2c230', q: '#3ac8b8',
      r: '#d84a3a', t: '#9a6a3e', T: '#74482a', e: '#7ae4f8', E: '#ffffff', f: '#a8643c',
    },
    top: [
      '...hhhh..Ee',
      '..hHhhhh.et',
      '.hhhhhSSS.t',
      '.hOhSkSSk.T',
      '.hRhSSSSs.t',
      '.cc*ccccSFt',
      'cC*wwwwcc.T',
      '.c.wwwwWw.t',
      '...oryqow.t',
      '...wwwwWw.t',
    ],
    legs: {
      stand: ['...ss.ss..T', '...ff.ff...'],
      a: ['..ss...ss.T', '.ff.....ff.'],
      pass: ['....sss...T', '....fff....'],
      b: ['..ss...ss.T', '.ff.....ff.'],
    },
    flap: [['c.', 'C*'], -1, 6],
  },
  // ---- Dell (Part 6): the straw hat and its red band, ginger hair, the red neckerchief, patched overalls, the
  // slingshot in hand
  dell: {
    pal: {
      Y: '#fff0a0', y: '#f2cc5a', u: '#d0a030', r: '#d03030', h: '#c0602e', S: '#fcd0b0', s: '#eeaa86', k: '#140c1c',
      f: '#c8704a', n: '#d03030', N: '#f05a48', d: '#345496', D: '#22366a', B: '#f2c230', P: '#f05a48', e: '#e4d6b4',
      w: '#9a6438', W: '#c8945a', b: '#4e2c1c', c: '#4c76bc',
    },
    top: [
      '...........',
      '...yYYy....',
      '..yYYYYy...',
      '.urrrrrru..',
      'uyyyyyyyyyu',
      '..hSSSSSS..',
      '..hSkSSkS..',
      '..eNnnnNe.W',
      '.eddBddBdeW',
      '..ddddPPd..',
    ],
    legs: {
      stand: ['...dd.dd...', '...bb.bb...'],
      a: ['..dd...dd..', '.bb.....bb.'],
      pass: ['....ddd....', '....bbb....'],
      b: ['..dd...dd..', '.bb.....bb.'],
    },
    flap: [['n.', 'N.'], 0, 7],
  },
  // ---- Part 6. Fizz: wild teal hair under the scorched cap and its red lens, the cream lab coat with its bandolier,
  // the ladle on her shoulder
  fizz: {
    pal: {
      h: '#1aa896', H: '#4cdcbc', c: '#5e3a26', C: '#845a38', L: '#f2c230', R: '#e03a3a', S: '#fccaa0', s: '#eaa47e', k: '#140c1c',
      w: '#eee4c8', W: '#bcae94', b: '#3a2218', r: '#ff6a4a', o: '#62b0ff', g: '#7ae25a', t: '#8e5a2e', T: '#b8c2d8', p: '#2a2634', e: '#563826', E: '#36201a',
    },
    top: [
      '.T..cccC...',
      'TThcccccLR.',
      '.thhccccLL.',
      'hhHhSSSSSS.',
      '.hhtSSkSSk.',
      'hhhtSSSSSs.',
      '..wtbwwwsS.',
      '.wwwwbrwSs.',
      '..wwwwbow..',
      '..WwwwwwwW.',
    ],
    legs: {
      stand: ['...pp.pp...', '..eeE.eeE..'],
      a: ['..pp...pp..', '.eeE...eeE.'],
      pass: ['....ppp....', '...eeEE....'],
      b: ['..pp...pp..', '.eEE...eEE.'],
    },
    flap: [['W.', 'WW'], -1, 8],
  },
  // Brann: the shaved head, grey brows and beard, the saffron robe over maroon, the beads, the big bronze bell on his back
  brann: {
    pal: {
      B: '#cc8c40', b: '#9a5a24', G: '#eec070', s: '#f6d8c6', S: '#e0b8a8', n: '#aeaebc', k: '#140c1c', d: '#80808e', D: '#aeaebc',
      y: '#ea861c', Y: '#ffb43c', o: '#4a2a1a', m: '#701e2c', M: '#943240', h: '#b45610', e: '#6e4426',
    },
    top: [
      '.GB..sss...',
      'GBBbsssss..',
      'BBBbsSSnSn.',
      'BGBbsSSkSk.',
      'BBBbSSSSSS.',
      'BBBbdDddDd.',
      '.YyyyddyyY.',
      'YyyyoyyoyyY',
      '..mmmommM..',
      '..mmmmmmM..',
    ],
    legs: {
      stand: ['..hhhhhhh..', '...ee.ee...'],
      a: ['..hhhhhhh..', '..ee...ee..'],
      pass: ['..hhhhhhh..', '....eee....'],
      b: ['..hhhhhhh..', '..ee...ee..'],
    },
  },
};

// ---- Solenne and Wren (Part 6): drawn in their own art files
Object.assign(WALKERS, { solenne: SOLENNE_WALKER, wren: WREN_WALKER });

function walkerFrame(w: Walker, legs: keyof Walker['legs'], bob: number, flap: boolean): HTMLCanvasElement {
  const g = grid(W, H);
  const top = H - 2 - 2 - w.top.length + bob;
  if (flap && w.flap) stamp(g, w.flap[0], w.pal, 1 + w.flap[1], top + w.flap[2]);
  stamp(g, w.top, w.pal, 1, top);
  stamp(g, w.legs[legs], w.pal, 1, H - 2 - 2);
  return toCanvas(g);
}

export function buildHeroWalkers(add: Add): void {
  for (const [id, w] of Object.entries(WALKERS)) {
    add(`m${id}_idle0`, walkerFrame(w, 'stand', 0, false));
    add(`m${id}_idle1`, walkerFrame(w, 'stand', 1, false));
    add(`m${id}_walk0`, walkerFrame(w, 'a', 0, true));
    add(`m${id}_walk1`, walkerFrame(w, 'pass', -1, false));
    add(`m${id}_walk2`, walkerFrame(w, 'b', 0, true));
    add(`m${id}_walk3`, walkerFrame(w, 'pass', -1, false));
  }
}
