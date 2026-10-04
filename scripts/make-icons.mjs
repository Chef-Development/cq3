// Generates the placeholder PWA icons (original pixel art) as PNGs with no dependencies.
// Run: npm run icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  bg: hex('#1e1b3a'),
  ink: hex('#0a0812'),
  bar: hex('#2a2440'),
  y: hex('#f2c230'),
  Y: hex('#ffe680'),
  r: hex('#e0463c'),
  R: hex('#ff8a7a'),
  w: hex('#ffffff'),
  m: hex('#dfe6f2'),
  M: hex('#8890a8'),
  g: hex('#f2c230'),
  h: hex('#7a4a24'),
};

/** 32x32 art as a 2D array of RGBA. */
function art() {
  const N = 32;
  const px = Array.from({ length: N }, () => Array.from({ length: N }, () => C.bg));
  const rect = (x, y, w, h, c) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < N && j < N) px[j][i] = c;
  };
  // sword (diagonal, tip up-right)
  for (let k = 0; k < 11; k++) {
    rect(14 + k, 15 - k, 2, 1, C.m);
    rect(14 + k, 16 - k, 1, 1, C.M);
  }
  rect(11, 14, 1, 5, C.g); // crossguard
  rect(10, 16, 5, 1, C.g);
  rect(9, 17, 2, 2, C.h); // handle
  rect(8, 19, 1, 1, C.g);
  // bar
  rect(2, 21, 28, 8, C.ink);
  rect(3, 22, 26, 6, C.bar);
  rect(7, 23, 6, 4, C.y);
  rect(7, 23, 6, 1, C.Y);
  rect(20, 23, 5, 4, C.r);
  rect(20, 23, 5, 1, C.R);
  // cursor
  rect(9, 19, 4, 12, C.ink);
  rect(10, 20, 2, 10, C.w);
  return px;
}

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const TABLE = crcTable();
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

function png(size, pad) {
  const src = art();
  const inner = size - pad * 2;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ix = Math.floor(((x - pad) / inner) * 32);
      const iy = Math.floor(((y - pad) / inner) * 32);
      const c = ix >= 0 && iy >= 0 && ix < 32 && iy < 32 ? src[iy][ix] : C.bg;
      raw.set(c, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192, 0));
writeFileSync('public/icons/icon-512.png', png(512, 0));
writeFileSync('public/icons/icon-maskable-512.png', png(512, 96));
writeFileSync('public/icons/apple-touch-icon.png', png(180, 10));
console.log('icons written');
