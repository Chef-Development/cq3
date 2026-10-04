// Generates the PWA / home-screen icons as PNGs with no dependencies. The pixel art (icon-art.mjs: Rowan's
// bust, his sword and the "3" badge) is scaled by the largest integer factor that fits (180 px = 4x) so it
// stays crisp; the background (a sunset-violet radial gradient with soft sunburst rays and a gold glow behind
// his head) is smooth at full resolution. Opaque RGB, since iOS fills transparency with black.
// Run: npm run icons   (optional argument: output directory, default public/icons)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { D, iconArt } from './icon-art.mjs';

const M = 24; // art drawn this far past the design area (fills the maskable icon's wide margin)
const ART = iconArt(M);

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const GLOW = [20, 13]; // glow centre in design px: behind his face and the sword, so the plume sits on violet
/** Background colour stops by distance from the glow centre, in design px. */
const STOPS = [
  [0, '#fff8e0'],
  [7, '#ffe8a0'],
  [12.5, '#ffb45a'],
  [19, '#a058e0'],
  [27, '#5a2cb0'],
  [38, '#26166a'],
  [60, '#120c3a'],
].map(([d, c]) => [d, rgb(c)]);
const RAYS = 14;

function gradient(d) {
  for (let i = 1; i < STOPS.length; i++) {
    const [d0, c0] = STOPS[i - 1];
    const [d1, c1] = STOPS[i];
    if (d <= d1) return mix(c0, c1, smooth((d - d0) / (d1 - d0)));
  }
  return STOPS[STOPS.length - 1][1];
}

/** Background at design coordinates (u, v); `px` = output pixels per design px (for antialiasing the rays). */
function background(u, v, px) {
  const dx = u - GLOW[0];
  const dy = v - GLOW[1];
  const d = Math.hypot(dx, dy);
  // soft-edged sunburst rays, strongest near the glow
  const a = (Math.atan2(dy, dx) / (Math.PI * 2)) * RAYS + 0.25;
  const f = a - Math.floor(a);
  const aa = Math.min(1, 0.5 / Math.max(1e-4, (d * px * Math.PI * 2) / RAYS)); // ~1 output px wide edge
  const ray = smooth((0.25 - Math.abs(f - 0.5)) / aa + 0.5);
  return mix(gradient(d), [255, 255, 255], ray * 0.16 * (1 - smooth((d - 8) / 34)));
}

/** One icon: the art scaled by `scale` around the centre of the design area, over the background. PNG bytes. */
function render(size, scale) {
  const o = Math.floor((size - D * scale) / 2);
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size); // each row starts with filter byte 0 (none)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const art = ART[Math.floor((y - o) / scale) + M]?.[Math.floor((x - o) / scale) + M];
      const c = art ? rgb(art) : background((x + 0.5 - o) / scale, (y + 0.5 - o) / scale, scale);
      for (let k = 0; k < 3; k++) raw[y * stride + 1 + x * 3 + k] = Math.round(c[k]);
    }
  return png(size, raw);
}

// ------------------------------------------------------------------ PNG (8-bit RGB)

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB, no alpha
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ write

// Each icon shows about VIEW design px across (the whole plume arc and the sword tip, the body running off
// the bottom edge), at the largest integer scale that fits.
const VIEW = 45;
const ICONS = [
  // [file, size, design px across]
  ['apple-touch-icon.png', 180, VIEW], // iPhone home screen (60 pt @3x): 4x
  ['icon-192.png', 192, VIEW],
  ['icon-512.png', 512, VIEW],
  // maskable (Android crops to a shape inside the central 80% circle): that circle holds the usual view
  ['icon-maskable-512.png', 512, VIEW / 0.8],
];

const dir = process.argv[2] ?? 'public/icons';
mkdirSync(dir, { recursive: true });
for (const [file, size, view] of ICONS) writeFileSync(`${dir}/${file}`, render(size, Math.floor(size / view)));
console.log(`icons written to ${dir}`);
