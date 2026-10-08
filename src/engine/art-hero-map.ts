// The M5 heroes at map scale (see art-map.ts, where Rowan and Sable are drawn the same way): `m${id}_idle0/1` and
// a four-step walk `m${id}_walk0..3`, each ROWAN_W x ROWAN_H (13x16) with the feet at ROWAN_FEET (6, 14), facing
// right. A top map (head to hem, 11 wide) over two rows of legs; idle1 sits a pixel lower, the passing steps
// (walk1, walk3) bob a pixel up, and the back edge of a cape, braid or cloak flaps on the long steps.
import { grid, stamp, toCanvas, type Pal } from './art';

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
  // ---- Gorm and Tess (Part 6)
  // the moss tuft and the big jaw, grey-green and broad, the stone gauntlets hanging at his sides
  gorm: {
    pal: {
      h: '#689a3a', H: '#a2c84e', s: '#67766a', S: '#889684', z: '#4b5854', k: '#140c1c', t: '#ece4c8', l: '#6a4224',
      o: '#aba396', g: '#837e7e', G: '#aba396', d: '#3c3a48', p: '#52464a', P: '#383036', f: '#4b5854', F: '#67766a',
    },
    top: [
      '....hHh....',
      '...hSSSs...',
      '...sSkSk...',
      '...sSSSSs..',
      '...ztsstz..',
      '.SSSssssSS.',
      'SSlsssssls.',
      'GGsslolssGG',
      'GgdssssszGg',
      'dd.lllll.dd',
    ],
    legs: {
      stand: ['...pp.pp...', '..FFf.FFf..'],
      a: ['..pp...pp..', '.FFf...FFf.'],
      pass: ['....ppp....', '...FFff....'],
      b: ['..pp...pp..', '.Fff...Fff.'],
    },
  },
  // the grey bun and its gear, round brass spectacles, the teal waistcoat, the pocket watch on its staff
  tess: {
    pal: {
      G: '#ecbc34', b: '#a2a2b0', h: '#cacad2', s: '#f2c8ac', Y: '#c88a1c', k: '#140c1c', c: '#f6eed8', v: '#309686',
      V: '#1e6c68', B: '#ecbc34', l: '#6e4426', q: '#4c3c4c', Q: '#362a38', K: '#2a2028', w: '#966236', O: '#fff0a0',
      W: '#f6eed8',
    },
    top: [
      '.........G.',
      '.Gb.....GOG',
      'Gbbhhh..GWG',
      '.bhhhhhh.Gw',
      '..hhsYkYk.w',
      '..hhsssss.w',
      '...ccvcc..w',
      '..cvvBvvcsw',
      '...lllll..w',
      '..qqqqqqq.w',
    ],
    legs: {
      stand: ['..qqqqqqq.w', '...KK.KK..w'],
      a: ['..qqqqqqqqw', '..KK...KK.w'],
      pass: ['..qqqqqqq.w', '....KKK...w'],
      b: ['.qqqqqqqq.w', '..KK...KK.w'],
    },
  },
};

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
