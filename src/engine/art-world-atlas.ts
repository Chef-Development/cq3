// The Great Atlas look for the world map: a PROTOTYPE (playtest round 8, team 2), not wired into the game yet. It
// takes the painted world (`world_map`) and redraws it as a page of the Atlas: the sea becomes a pale watercolour wash
// on parchment with ink ripple lines following the coast, the land is printed on the paper (its colours warmed toward
// parchment), every coast gets a 1 px ink line, and the sheet a double neatline. Erased land (the veils) and the
// restoring animation are the next steps (docs/art-audit/README.md, "Next"). Pure canvas work, hard pixels only.

/** The parchment, the sea wash on it (deep to foam) and the atlas ink (docs/art-style.md section 2). */
const PARCH = [0x6e4a2a, 0xa8804e, 0xd2b07a, 0xead2a0, 0xf8ecc8];
const WASH = [0x6f9aaa, 0x8aaeb6, 0xa8c2bc, 0xc6d2bc, 0xe2dcbe];
const INK = [0x1a1026, 0x2e2240, 0x4a3a5e, 0x7a6e7e];

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mixC = (a: number, b: number, k: number): number => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
};
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number, v: number) => v * 16 > BAYER4[(y & 3) * 4 + (x & 3)] + 0.5;

/** Whether a painted pixel is water (blue-cyan clearly over red; snow, ice and the mountains' lavender shade stay land). */
function isWater(r: number, g: number, b: number): boolean {
  return b > r + 38 && g > r + 15 && b > 70 && !(r > 200 && g > 200);
}

/** The painted world (a canvas) as a page of the Atlas (a new canvas of the same size). */
export function atlasWorld(src: HTMLCanvasElement): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const sctx = src.getContext('2d')!;
  const d = sctx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const water = new Uint8Array(N);
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = d[i * 4];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    water[i] = isWater(r, g, b) ? 1 : 0;
    lum[i] = (0.3 * r + 0.55 * g + 0.15 * b) / 255;
  }
  // the open sea only: water that is mostly water round about (not a river or a shadow), joined to the map's edge;
  // then grown back to the shore. Lakes and rivers keep their painted look.
  const sw = W + 1;
  const sat = new Int32Array(sw * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += water[y * W + x];
      sat[(y + 1) * sw + x + 1] = sat[y * sw + x + 1] + row;
    }
  }
  const R = 4;
  const open = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - R);
      const y0 = Math.max(0, y - R);
      const x1 = Math.min(W, x + R + 1);
      const y1 = Math.min(H, y + R + 1);
      const n = sat[y1 * sw + x1] - sat[y0 * sw + x1] - sat[y1 * sw + x0] + sat[y0 * sw + x0];
      open[y * W + x] = water[y * W + x] && n >= (x1 - x0) * (y1 - y0) * 0.8 ? 1 : 0;
    }
  const sea = new Uint8Array(N);
  {
    const st: number[] = [];
    for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
    while (st.length) {
      const i = st.pop()!;
      if (sea[i] || !open[i]) continue;
      sea[i] = 1;
      const x = i % W;
      if (x > 0) st.push(i - 1);
      if (x < W - 1) st.push(i + 1);
      if (i >= W) st.push(i - W);
      if (i < N - W) st.push(i + W);
    }
    // grow back over the water the test trimmed off along the shore
    for (let pass = 0; pass < R + 1; pass++) {
      const grow: number[] = [];
      for (let i = 0; i < N; i++) {
        if (sea[i] || !water[i]) continue;
        const x = i % W;
        if ((x > 0 && sea[i - 1]) || (x < W - 1 && sea[i + 1]) || (i >= W && sea[i - W]) || (i < N - W && sea[i + W])) grow.push(i);
      }
      for (const i of grow) sea[i] = 1;
    }
  }
  water.set(sea);
  // distance from the land over the water (for the wash's depth and the ripple lines), a breadth-first walk
  const dist = new Int16Array(N).fill(-1);
  const q = new Int32Array(N);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < N; i++) if (!water[i]) (dist[i] = 0), (q[qt++] = i);
  while (qh < qt) {
    const i = q[qh++];
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (dist[j] >= 0) continue;
      dist[j] = dist[i] + 1;
      q[qt++] = j;
    }
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(W, H);
  const o = img.data;
  const put = (i: number, c: number) => {
    o[i * 4] = (c >> 16) & 255;
    o[i * 4 + 1] = (c >> 8) & 255;
    o[i * 4 + 2] = c & 255;
    o[i * 4 + 3] = 255;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (water[i]) {
        // the wash: paler near the coast, deeper offshore, in stepped bands dithered at their joins
        const k = Math.min(1, Math.sqrt(dist[i] / 46));
        const v = 4 - k * 4;
        const lo = Math.floor(v);
        let c = WASH[Math.max(0, Math.min(4, dither(x, y, v - lo) ? lo + 1 : lo))];
        // ripple lines along the coast (dashed), fainter further out
        const dd = dist[i];
        if ((dd === 3 || dd === 7 || dd === 12) && (x + y * 3) % 9 < 5) c = dd === 3 ? INK[3] : mixC(INK[3], c, dd === 7 ? 0.4 : 0.65);
        // the painted sea's own crests and shallows still show, as a faint lighter tone
        if (lum[i] > 0.62 && dd > 1) c = mixC(c, PARCH[4], 0.5);
        put(i, c);
      } else {
        // the land, printed on the paper: warmed toward parchment, its shadows kept
        const r = d[i * 4];
        const g = d[i * 4 + 1];
        const b = d[i * 4 + 2];
        const c = (r << 16) | (g << 8) | b;
        put(i, mixC(c, PARCH[3], 0.16));
      }
    }
  // the coast in ink: land touching water, and a pressure dot where a coast turns sharply
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (water[i]) continue;
      const n = water[i - 1] + water[i + 1] + water[i - W] + water[i + W];
      if (n > 0) put(i, n >= 3 ? INK[0] : INK[1]);
    }
  // the sheet's double neatline and its burnt edge
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      const i = y * W + x;
      if (e === 0) put(i, PARCH[0]);
      else if (e === 1) put(i, PARCH[1]);
      else if (e === 4) put(i, INK[1]);
      else if (e === 6) put(i, INK[2]);
    }
  octx.putImageData(img, 0, 0);
  return out;
}
