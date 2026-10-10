// The fight stages' mood grade (art-mood.ts, decisions L7 and A2C-1): darker and cooler, never muddy, lights kept.
import { describe, expect, it } from 'vitest';
import { MOOD, moodColour, moodGrade } from '../../src/engine/art-mood';
import { Pix } from '../../src/engine/backdrop';

const luma = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
// the bible's ramps (docs/art-style.md section 2) that the stages are painted from
const RAMPS = [
  [0x12261e, 0x1e3c2a, 0x2e5a32, 0x4a7e36, 0x78a83c, 0xb4d058], // green leaf
  [0x2a1810, 0x4a2c18, 0x6e4426, 0x98663a, 0xc0905a, 0xe0bc84], // earth
  [0x2a2f45, 0x4a5272, 0x7c86a6, 0xb8c2d8, 0xeef3fa], // steel
  [0x16243a, 0x2a4a6e, 0x4a7aa6, 0x86b4d8, 0xc4e2f4, 0xf0faff], // frost
];

describe('the mood grade', () => {
  it('every act of the first three regions has one', () => {
    for (const t of ['forest', 'ruins', 'hollow', 'pass', 'caves', 'glacier', 'cinder', 'glass', 'forge'] as const) expect(MOOD[t], t).toBeDefined();
  });

  it('brings midtones down (about a fifth or more) and never brightens a colour', () => {
    for (const m of Object.values(MOOD))
      for (const r of RAMPS) {
        for (const c of r) expect(luma(moodColour(c, m!))).toBeLessThanOrEqual(luma(c) + 1);
        const mid = r[Math.floor(r.length / 2)];
        expect(luma(moodColour(mid, m!)), mid.toString(16)).toBeLessThan(luma(mid) * 0.86);
      }
  });

  it('is never muddy: a ramp keeps its tones apart and in order', () => {
    for (const m of Object.values(MOOD))
      for (const r of RAMPS) {
        const out = r.map((c) => moodColour(c, m!));
        expect(new Set(out).size).toBe(r.length);
        for (let i = 1; i < out.length; i++) expect(luma(out[i])).toBeGreaterThan(luma(out[i - 1]));
      }
  });

  it('keeps the lights: fire and lava lose far less than a midtone', () => {
    const lava = 0xf08a2a;
    const torch = 0xffd070;
    for (const t of ['cinder', 'forge', 'glass'] as const) {
      const m = MOOD[t]!;
      expect(luma(moodColour(lava, m)), t).toBeGreaterThan(luma(lava) * 0.85);
      expect(luma(moodColour(torch, m)), t).toBeGreaterThan(luma(torch) * 0.85);
    }
  });

  it('leaves a repainted sky alone, keeps transparency, and darkens the strip under the feet', () => {
    const G = 20;
    const p = new Pix(4, 30, 0x4a7e36);
    p.set(0, 0, -1);
    p.set(1, 0, 0x223344);
    const snap = p.buf.slice();
    snap.fill(-2); // nothing matches: grade everything...
    snap[1] = 0x223344; // ...but the "sky" pixel
    moodGrade(p, MOOD.forest!, G, snap);
    expect(p.get(0, 0)).toBe(-1);
    expect(p.get(1, 0)).toBe(0x223344);
    expect(luma(p.get(2, G + 4))).toBeLessThan(luma(p.get(2, 2)));
  });
});
