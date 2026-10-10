// The critters that bring the maps to life (view/map-life.ts on the act maps, view/world-life.ts on the kingdom's
// world map; see docs/art-style.md). Original pixel art from character maps, all facing right (the views flip them):
// a rabbit, sparrows and a frog on the Meadow Road; a hedgehog and crows in the Old Ruins; a squirrel and a doe in
// the Boar King's Hollow; a hawk and leaping fish overhead and in the stream; a mountain goat and snow buntings in the
// Frostbite Pass; glow beetles and pale cave fish in the Glimmer Caves; snow hares and a white owl on Wyrm's Glacier;
// lava lizards and a fire beetle on the Cinder Flats (ash moths flutter round its vents: drawn by the view); glass
// snails and glow bats in the Glass Warrens; soot sprites in the Black Forge (its sparks are the view's);
// gulls floating on the sea and dolphins for the world map. Ground critters wear a 1 px ink outline like the map's other sprites, muted so they stay at the
// edge of attention; the ones in the air or the water have none (they're drawn small and pale).
//
// Textures: `life_<critter>_<frame>`, built once (buildLifeArt is a no-op when they exist).
import { grid, stamp, toCanvas, type Pal } from './art';

const INK = '#140c1c';

interface Critter {
  pal: Pal;
  frames: string[][];
  /** No ink outline (it flies or swims). */
  raw?: boolean;
}

// earth and fur ramps (docs/art-style.md: earth, wood) with hue-shifted shadows
const RABBIT: Pal = { 1: '#4a2c18', 2: '#6e4426', 3: '#98663a', 4: '#c0905a', 5: '#e0bc84', W: '#f4ecd8', k: INK };
const SPARROW: Pal = { 1: '#4a2c18', 2: '#6e4426', 3: '#98663a', 4: '#c0905a', 5: '#e8d0a0', y: '#d8901c', k: INK };
const CROW: Pal = { 1: '#100c20', 2: '#1e1e3c', 3: '#2e3460', 4: '#42548a', y: '#2a2440', k: '#9ccce0' };
const FROG: Pal = { 1: '#1e3c2a', 2: '#2e5a32', 3: '#4a7e36', 4: '#78a83c', 5: '#b4d058', k: INK, w: '#e8f0c0' };
const HEDGEHOG: Pal = { 1: '#2a1e1c', 2: '#4a3830', 3: '#6e5848', 4: '#a8906e', f: '#e0c8a0', F: '#b08a68', k: INK };
const SQUIRREL: Pal = { 1: '#5a2018', 2: '#8a3420', 3: '#b8542a', 4: '#e07a3a', 5: '#f4a858', W: '#f4dcb0', k: INK };
const DEER: Pal = { 2: '#6a3a24', 3: '#985a34', 4: '#c08048', 5: '#e0aa70', W: '#f4e8d4', k: INK };
const HAWK: Pal = { 2: '#5a3a24', 3: '#8e5a2e', 4: '#c0905a' };
const FISH: Pal = { 1: '#5aa2d4', 2: '#d4f0f6', 3: '#8ccce6' };
// the Frostpeaks': white winter coats shaded violet-blue, so they read on the snow by their outline
const GOAT: Pal = { 1: '#4e587c', 2: '#7c86a8', 3: '#b4bcd4', 4: '#e2e6f0', 5: '#ffffff', h: '#2e2430', w: '#c8ccd8', k: INK };
const BUNTING: Pal = { 1: '#2e2a30', 2: '#6a5a4e', 3: '#c4bcb2', 4: '#f2f0ec', 5: '#ffffff', y: '#d8a040', k: INK };
const BEETLE: Pal = { 1: '#10142a', 2: '#202a48', 3: '#34466a', g: '#3ed8c0', G: '#c8fff0', k: INK };
const CAVEFISH: Pal = { 1: '#4a78a0', 2: '#c4e6f2', 3: '#86b6d0' };
const HARE: Pal = { 1: '#545e84', 2: '#949ec0', 3: '#ccd4e8', 4: '#f0f4fa', 5: '#ffffff', W: '#ffffff', e: INK, k: INK };
const OWL: Pal = { 2: '#7c86a4', 3: '#c8d0e2', 4: '#f4f8ff' };
// Ashfell's: black crust with a glow in it, coloured glass, soot; each carries a warm spot so it reads on the ash
const LIZARD: Pal = { 1: '#140e12', 2: '#2e2024', 3: '#4e3630', 4: '#6e4e3a', o: '#e0501c', O: '#ffb040', e: '#ffe070', k: INK };
const FIREBEETLE: Pal = { 1: '#140c10', 2: '#2a1814', q: '#a0221a', x: '#e0501c', X: '#ffb040', Z: '#fff0a0', k: INK };
const SNAIL: Pal = { 1: '#4a4458', 2: '#7a7488', 3: '#aaa4b6', g: '#1e8a48', G: '#46c06a', W: '#d8ffd0', e: INK, k: INK };
const GLOWBAT: Pal = { 1: '#1a1024', 2: '#3e1a6e', 3: '#9a5ad8', 4: '#e4c8ff', O: '#fff4c0' };
const SOOT: Pal = { 1: '#0e0a0e', 2: '#221a20', 3: '#3a2e34', W: '#ffffff', e: INK, o: '#ff8a24', k: INK };
// the Duskmire's: a bog frog with a lantern-orange throat, a mud crab, a dusk moth (muted, under the land's tones)
const BOGFROG: Pal = { 1: '#16201e', 2: '#243426', 3: '#3a4a2c', 4: '#5a6634', 5: '#7e8040', k: INK, w: '#c8c4a0', o: '#c8702e' };
const MUDCRAB: Pal = { 1: '#24121a', 2: '#4a2224', 3: '#6e3a2c', 4: '#94583a', k: INK, e: '#d8d0c0' };
const DUSKMOTH: Pal = { 1: '#241e2c', 2: '#3e3648', 3: '#5c5266', 4: '#80768a', p: '#8a62a8', k: INK };
// Noonspire's: a jerboa (sand and shadow), a dune beetle (dull brass), a vulture circling (seen from below)
const JERBOA: Pal = { 1: '#2a2228', 2: '#4a3c36', 3: '#6e5a48', 4: '#8a7458', W: '#b8a888', k: INK };
const DUNEBEETLE: Pal = { 1: '#1a1210', 2: '#3a2a16', 3: '#5e4420', 4: '#82602c', k: INK };
const VULTURE: Pal = { 2: '#2a2228', 3: '#4a3e40', 4: '#7a6e6a' };
const HERON: Pal = { 2: '#4a4c66', 3: '#767a96', 4: '#a8aac0' };
const GULL: Pal = { 2: '#7c86a6', 3: '#b8c2d8', 4: '#eef3fa', y: '#f2c230', k: INK };
const DOLPHIN: Pal = { 2: '#4a6890', 3: '#7896bc', 4: '#b4d0ea' };

export const CRITTERS: Record<string, Critter> = {
  // sit, nibble (head down), hop
  rabbit: {
    pal: RABBIT,
    frames: [
      ['.....4..', '....43..', '....43..', '..33455.', 'W3334k45', 'W333332.', '.22..22.'],
      ['........', '........', '...44...', '..3345..', 'W33345..', 'W3333k45', '.22..222'],
      ['......4.', '.....43.', '.3334455', 'W33334k4', '.22..2..', '2.....2.'],
    ],
  },
  // head up, pecking; flying (wings up, wings down)
  sparrow: {
    pal: SPARROW,
    frames: [
      ['..44..', '23344y', '.3355.', '..2.2.'],
      ['......', '2334..', '.33544', '..2.4y'],
      ['..4...', '..34..', '23344y', '..2...'],
      ['......', '23344y', '..34..', '..4...'],
    ],
  },
  crow: {
    pal: CROW,
    frames: [
      ['...44..', '12334ky', '.2333..', '..1.1..'],
      ['.......', '1233...', '.23344.', '..1.4ky'],
      ['..4....', '..34...', '12333ky', '..2....'],
      ['.......', '12333ky', '..34...', '..4....'],
    ],
  },
  // sitting, leaping
  frog: {
    pal: FROG,
    frames: [
      ['...5k.', '.3445w', '43344.', '3.2.3.'],
      ['....5k', '..3445', '.334..', '3....3'],
    ],
  },
  // snuffling (two steps), curled up in a ball
  hedgehog: {
    pal: HEDGEHOG,
    frames: [
      ['..4.4.4..', '.43434344', '432323233f', '22222222Ffk', '.F....F...'],
      ['..4.4.4..', '.43434344', '432323233f', '22222222Ffk', '..F....F..'],
      ['.4.4.4.', '4343434', '3232323', '.22222.'],
    ],
  },
  // sitting up, nibbling an acorn, dashing
  squirrel: {
    pal: SQUIRREL,
    frames: [
      ['45.....', '543..5.', '.43.454', '.4344k4', '.44W33.', '..3.3..'],
      ['45......', '543.....', '.43.....', '.43.454.', '.44334k4', '..3W3.3.'],
      ['.......', '45.....5', '5433.454', '.43334k4', '..3...3.'],
    ],
  },
  // standing, grazing, bounding
  deer: {
    pal: DEER,
    frames: [
      ['........5.5', '........454', '........44k', '.......44..', 'W4444444...', '.3333333...', '.3.3..3.3..', '.2.2..2.2..'],
      ['...........', '...........', '...........', '...........', 'W44444444..', '.33333333..', '.3.3..3.44.', '.2.2..2.4k5'],
      ['.........5.5', '.........454', '.........44k', '........44..', 'W44444444...', '.3333333....', '3.3.....3.3.', '2.........2.'],
    ],
  },
  // seen from below, gliding and beating its wings
  hawk: {
    pal: HAWK,
    raw: true,
    frames: [
      ['23.......32', '.2333.3332.', '...23432...', '....343....', '.....3.....'],
      ['...........', '22333.33322', '...23432...', '....343....', '.....3.....'],
    ],
  },
  // leaping up, diving back
  fish: {
    pal: FISH,
    raw: true,
    frames: [
      ['.2.', '231'],
      ['32', '21', '.1'],
    ],
  },
  // standing, grazing, bounding
  goat: {
    pal: GOAT,
    frames: [
      ['........hh.', '.......h44.', '.......444k', '.34444443w.', '344444443w.', '.3333333...', '.2.2..2.2..', '.h.h..h.h..'],
      ['...........', '...........', '.344444....', '34444444hh.', '.33333344k.', '.2.2..2.4w.', '.2.2..2.2..', '.h.h..h.h..'],
      ['.........h.', '........hh4', '.344444444k', '34444444w..', '.333333....', '2.2.....2.2', 'h.h.....h.h'],
    ],
  },
  // head up, pecking; flying (wings up, wings down)
  bunting: {
    pal: BUNTING,
    frames: [
      ['..44..', '13444y', '.4455.', '..1.1.'],
      ['......', '1344..', '.44544', '..1.4y'],
      ['..1...', '..14..', '13444y', '..2...'],
      ['......', '13444y', '..14..', '..1...'],
    ],
  },
  // creeping (two steps), its tail end glowing
  beetle: {
    pal: BEETLE,
    frames: [
      ['.2332..', 'Gg3332k', '.1.1.1.'],
      ['.2332..', 'Gg3332k', '1.1.1..'],
    ],
  },
  // seen from above, gliding under the ice (tail one way, then the other)
  cavefish: {
    pal: CAVEFISH,
    raw: true,
    frames: [
      ['1.22.', '.2232', '1.22.'],
      ['.122.', '.2232', '.122.'],
    ],
  },
  // sitting, nibbling, hopping: a white winter coat, black ear tips
  hare: {
    pal: HARE,
    frames: [
      ['.....e..', '....43..', '....43..', '..33455.', 'W3334k45', 'W333332.', '.22..22.'],
      ['........', '........', '...ee...', '..3345..', 'W33345..', 'W3333k45', '.22..222'],
      ['......e.', '.....43.', '.3334455', 'W33334k4', '.22..2..', '2.....2.'],
    ],
  },
  // a snowy owl seen from below, gliding and beating its wings
  owl: {
    pal: OWL,
    raw: true,
    frames: [
      ['34.......43', '.3443.3443.', '...34443...', '....444....', '....3.3....'],
      ['...........', '33443.34433', '...34443...', '....444....', '....3.3....'],
    ],
  },
  // basking, looking up, scuttling: a lava lizard, glowing down its back and at its tail's tip
  lizard: {
    pal: LIZARD,
    frames: [
      ['.......33e.', 'O3o33o3334k', '...2.2.2.2.'],
      ['........33e', 'O3o33o33344', '...2.2..2.2'],
      ['.......33e.', 'Oo3o33o334k', '..2...2..2.'],
    ],
  },
  // creeping (two steps), its shell glowing like a coal
  firebeetle: {
    pal: FIREBEETLE,
    frames: [
      ['.qxXq..', 'qxXZXx2', '.1.1.1.'],
      ['.qxXq..', 'qxXZXx2', '1.1.1..'],
    ],
  },
  // sliding along under its shell of green glass (head in, head out)
  snail: {
    pal: SNAIL,
    frames: [
      ['..ggg...', '.gGWGg..', '.gGgGg..', '1222223.'],
      ['..ggg..e', '.gGWGg.3', '.gGgGg23', '12222233'],
    ],
  },
  // a glow bat in flight seen from below, wings up and down, its eyes and wing edges aglow
  glowbat: {
    pal: GLOWBAT,
    raw: true,
    frames: [
      ['4.......4', '32..1..23', '.321O123.', '...111...'],
      ['.........', '...111...', '4321O1234', '...1.1...'],
    ],
  },
  // a soot sprite: a ball of soot with big eyes; sitting, blinking, hopping
  soot: {
    pal: SOOT,
    frames: [
      ['..3.3..', '.33333.', '3W3W332', '3e3e322', '.22221.', '..1.1..'],
      ['..3.3..', '.33333.', '3333332', '3e3e322', '.22221.', '..1.1..'],
      ['.3...3.', '..333..', '.W3W33.', '3e3e322', '.22221.', '.......'],
    ],
  },
  // a jerboa: sitting up, ears twitching, a long hop
  jerboa: {
    pal: JERBOA,
    frames: [
      ['.33.....', '3433....', '.k443...', '..3443..', '..2332.4', '..2.2..3'],
      ['.3......', '3433....', '.k443...', '..3443..', '..2332.4', '..2.2..3'],
      ['........', '.33...4.', '3k4443.3', '..33332.', '.2....2.'],
    ],
  },
  // a dune beetle trundling (two steps), its dull brass back
  dunebeetle: {
    pal: DUNEBEETLE,
    frames: [
      ['.344..', '34443k', '.1.1.1'],
      ['.344..', '34443k', '1.1.1.'],
    ],
  },
  // a vulture circling high over the road, wings level then tipped
  vulture: {
    pal: VULTURE,
    raw: true,
    frames: [
      ['2..............2', '23333.44.33332..', '..2223443222....', '......33........'],
      ['................', '3333.44.333332..', '2.22234432222..2', '......33........'],
    ],
  },
  // a heron flying over the fen seen from below: its neck folded forward, legs trailing, wings up and down
  heron: {
    pal: HERON,
    raw: true,
    frames: [
      ['...3.......3..', '....33...33...', '44.344443332222', '.......33......'],
      ['...............', '..33333.33333..', '44.344443332222', '.......33......'],
    ],
  },
  // sitting (its throat puffed, then not), leaping
  bogfrog: {
    pal: BOGFROG,
    frames: [
      ['..w..w..', '.3k33k3.', '3444443.', 'oo44332.', '.3.33.3.'],
      ['..w..w..', '.3k33k3.', '3444443.', '.o44332.', '.3.33.3.'],
      ['.w..w....', '3k33k33..', '.4444433.', '..o3432.3', '.3.....3.'],
    ],
  },
  // a mud crab: claws up, claws down, scuttling sideways
  mudcrab: {
    pal: MUDCRAB,
    frames: [
      ['4.....4', '34.e.43', '.3k3k3.', '2333332', '.2.2.2.'],
      ['.......', '4..e..4', '33k3k33', '2333332', '2.2.2.2'],
      ['4.....4', '34.e.43', '.3k3k3.', '2333332', '2..2..2'],
    ],
  },
  // a moth on a stone: wings spread, wings folded, taking off
  duskmoth: {
    pal: DUSKMOTH,
    frames: [
      ['4p...p4', '3443443', '.32k23.', '..2.2..'],
      ['...4...', '..343..', '..3k3..', '..2.2..'],
      ['p4...4p', '.34k43.', '..323..', '.......'],
    ],
  },
  // floating on the sea (bobbing)
  gull: {
    pal: GULL,
    frames: [
      ['..4k', '23344y', '.344.'],
      ['..4k.', '233444y', '.3344.'],
    ],
  },
  // a back breaking the surface, arching over
  dolphin: {
    pal: DOLPHIN,
    raw: true,
    frames: [
      ['....3...', '..34333.', '.3.....2'],
      ['..3343..', '.34443.2', '3......2'],
    ],
  },
};

/** A sprite without an outline (raw pixels from the rows). */
function rawCanvas(rows: string[], pal: Pal): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = rows.length;
  const ctx = c.getContext('2d')!;
  rows.forEach((r, y) =>
    [...r].forEach((ch, x) => {
      if (ch === '.' || !pal[ch]) return;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

/** Every critter frame as a texture (once: later layouts reuse them). */
export function buildLifeArt(add: (key: string, c: HTMLCanvasElement) => void, has: (key: string) => boolean): void {
  if (has('life_crow_3')) return;
  for (const [name, cr] of Object.entries(CRITTERS))
    cr.frames.forEach((rows, i) => {
      if (cr.raw) return add(`life_${name}_${i}`, rawCanvas(rows, cr.pal));
      const w = Math.max(...rows.map((r) => r.length));
      const g = grid(w + 2, rows.length + 2);
      stamp(g, rows, cr.pal, 1, 1);
      add(`life_${name}_${i}`, toCanvas(g));
    });
}
