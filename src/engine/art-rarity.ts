// Rarity overlays for the two top tiers (docs/content-bible.md section 1): Celestial is pale cyan with star sparkles,
// Divine is prismatic gold. The frame itself is drawn like every other rarity's (view/items.ts itemCell with the
// rarity's face colours; suggested faces below); these small textures go on top of it, animated by cycling frames.
// None wears an ink outline (they are light), and all are 4-frame loops.
//
//   rarity_sparkle_celestial_0..3   7x7 corner twinkle: a pale-cyan four-point star that grows, peaks and fades
//   rarity_shine_divine_0..3        7x7 corner glint: a gold four-point star whose tips cycle through the rainbow
//   rarity_ring_celestial_${s}_0..3 s x s (14, 22): tiny twinkles that drift along a cell's 1px frame
//   rarity_ring_divine_${s}_0..3    s x s (14, 22): prismatic dashes (rose, mint, sky, lilac) crawling round the frame
//
// The rings cover exactly the pixels itemCell paints as the frame (corners cut like rows(..., r = 2)): draw one with
// its top-left on the cell's (r.x, r.y). rarityRing() makes one for any other size.

type Add = (key: string, canvas: HTMLCanvasElement) => void;

/** Suggested frame colours [hi, base, lo, deep] for RARITY_INFO (src/data/gear.ts). */
export const TOP_RARITY_FACE = {
  celestial: [0xe8fdff, 0x9ae8f6, 0x56b4dc, 0x24628e],
  divine: [0xfff8d0, 0xffd04a, 0xd8961c, 0x8a4c10],
} as const;

/** Cell sizes that get ready-made rings (the bag and relic log's 14 px cells, the loot row's 22 px ones). */
export const RARITY_RING_SIZES = [14, 22] as const;

export type TopRarity = 'celestial' | 'divine';

const PRISM = ['#ff8ab8', '#7af0b4', '#8acbff', '#c8a2ff']; // rose, mint, sky, lilac

type Px = [number, number, string, number]; // x, y, colour, alpha

function canvasOf(w: number, h: number, px: Px[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (const [x, y, col, a] of px) {
    const n = parseInt(col.slice(1), 16);
    ctx.fillStyle = `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
    ctx.fillRect(x, y, 1, 1);
  }
  return c;
}

/** A four-point star centred in a 7x7 box: `arm` px long, coloured from the centre out by `cols`. */
function star4(arm: number, cols: (k: number, dir: number) => [string, number], diag?: [string, number]): Px[] {
  const out: Px[] = [];
  const [c0, a0] = cols(0, 0);
  out.push([3, 3, c0, a0]);
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  dirs.forEach(([dx, dy], d) => {
    for (let k = 1; k <= arm; k++) {
      const [c, a] = cols(k, d);
      out.push([3 + dx * k, 3 + dy * k, c, a]);
    }
  });
  if (diag)
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ])
      out.push([3 + dx, 3 + dy, diag[0], diag[1]]);
  return out;
}

/** Celestial twinkle, frame f: a dot, a small cross, the full star, then fading. */
function sparkle(f: number): HTMLCanvasElement {
  const C = ['#ffffff', '#c8f6ff', '#7ad8f0'];
  const frames: Px[][] = [
    star4(1, () => ['#c8f6ff', 0.9]),
    star4(2, (k) => [C[k], 1], ['#a8ecfa', 0.55]),
    star4(3, (k) => [C[Math.min(2, k === 3 ? 2 : k)], k === 3 ? 0.75 : 1], ['#c8f6ff', 0.85]),
    star4(2, (k) => [C[k + (k ? 0 : 1)], k === 2 ? 0.35 : 0.65]),
  ];
  return canvasOf(7, 7, frames[f]);
}

/** Divine glint, frame f: a gold four-point star, its tips in the prism's colours turning a quarter each frame. */
function shine(f: number): HTMLCanvasElement {
  const arm = f % 2 ? 2 : 3;
  return canvasOf(
    7,
    7,
    star4(
      arm,
      (k, d) => (k === 0 ? ['#ffffff', 1] : k < arm ? ['#ffe680', 1] : [PRISM[(d + f) % 4], 1]),
      f % 2 ? ['#fff0a0', 0.8] : undefined,
    ),
  );
}

/** The frame pixels of a w x h cell (corners cut like rows(r = 2)), in order round the edge from the top left. */
function perimeter(w: number, h: number): Array<[number, number]> {
  const p: Array<[number, number]> = [];
  for (let x = 2; x <= w - 3; x++) p.push([x, 0]);
  for (let y = 2; y <= h - 3; y++) p.push([w - 1, y]);
  for (let x = w - 3; x >= 2; x--) p.push([x, h - 1]);
  for (let y = h - 3; y >= 2; y--) p.push([0, y]);
  return p;
}

/** A ring overlay for a w x h cell, frame f (0..3). */
export function rarityRing(kind: TopRarity, w: number, h: number, f: number): HTMLCanvasElement {
  const p = perimeter(w, h);
  const P = p.length;
  const px: Px[] = [];
  if (kind === 'divine') {
    // dashes of the prism, one every ~8 px, crawling a quarter of a dash-gap each frame (seamless over 4 frames)
    const n = Math.max(1, Math.round(P / 8));
    p.forEach(([x, y], i) => {
      const ph = ((i / P) * n + f / 4) % 1;
      const k = Math.floor(ph * 8);
      if (k < 4) px.push([x, y, PRISM[k], 0.95]);
      else if (k === 4) px.push([x, y, '#fffbe0', 0.9]);
    });
  } else {
    // twinkles every ~10 px: a white spark with pale cyan either side along the frame
    const n = Math.max(1, Math.round(P / 10));
    p.forEach(([x, y], i) => {
      const ph = ((i / P) * n + f / 4) % 1;
      const k = Math.floor(ph * 10);
      if (k === 0) px.push([x, y, '#ffffff', 1]);
      else if (k === 1 || k === 9) px.push([x, y, '#c8f6ff', 0.8]);
    });
  }
  return canvasOf(w, h, px);
}

export function buildRarityArt(add: Add): void {
  for (let f = 0; f < 4; f++) {
    add(`rarity_sparkle_celestial_${f}`, sparkle(f));
    add(`rarity_shine_divine_${f}`, shine(f));
    for (const s of RARITY_RING_SIZES) {
      add(`rarity_ring_celestial_${s}_${f}`, rarityRing('celestial', s, s, f));
      add(`rarity_ring_divine_${s}_${f}`, rarityRing('divine', s, s, f));
    }
  }
}
