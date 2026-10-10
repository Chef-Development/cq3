// Every hero's fight frames (docs/art-style.md section 7): the bible's poses for each of the sixteen, Rowan on the
// shared rig like the rest (his head no taller than his peers'), and a four-frame idle whose secondary motion is real
// (the third and fourth frames differ from the first two).
import { describe, expect, test } from 'vitest';
import { grid, HERO_H, HERO_W, type Grid } from '../../src/engine/art';
import { HERO_POSE_KEYS, RIG_HEROES } from '../../src/engine/art-heroes';
import { paintRig, type Rig } from '../../src/engine/art-rig';
import { ROWAN_RIG } from '../../src/engine/art-hero-rowan';
import { NEVE_RIG } from '../../src/engine/art-hero-neve';
import { SOLENNE_RIG } from '../../src/engine/art-hero-solenne';
import { HOLLIS_RIG } from '../../src/engine/art-hero-hollis';
import { paintSable, SABLE_POSES } from '../../src/engine/art-sable';
import { HEROES } from '../../src/data/heroes';

const key = (g: Grid) => g.map((r) => r.map((c) => c ?? '.').join('')).join('\n');

describe('hero frames', () => {
  test('every hero with rig art has every pose (Sable: hers, with fin and cast)', () => {
    for (const [art, { poses }] of Object.entries(RIG_HEROES)) for (const k of HERO_POSE_KEYS) expect(poses[k], `${art}_${k}`).toBeDefined();
    for (const k of HERO_POSE_KEYS) expect(SABLE_POSES[k], `sable_${k}`).toBeDefined();
    // every hero in the data has art: the rig's registry or Sable's own
    for (const h of Object.values(HEROES)) expect(h.art in RIG_HEROES || h.art === 'sable', h.art).toBe(true);
  });

  test("the idle's last two frames are their own (the secondary motion), and every frame paints the figure", () => {
    for (const [art, { rig, poses }] of Object.entries(RIG_HEROES)) {
      const frames = HERO_POSE_KEYS.map((k) => {
        const g = grid(HERO_W, HERO_H);
        paintRig(g, rig, poses[k]);
        return g;
      });
      const idle = frames.slice(0, 4).map(key);
      expect(idle[2], `${art}_idle2`).not.toBe(idle[1]);
      expect(idle[3], `${art}_idle3`).not.toBe(idle[0]);
      for (const g of frames) expect(g.some((r) => r.some((c) => c !== null))).toBe(true);
      // (a letter missing from a palette paints magenta)
      for (const [i, g] of frames.entries()) expect(key(g).includes('#ff00ff'), `${art}_${HERO_POSE_KEYS[i]}`).toBe(false);
    }
    const sable = Object.keys(SABLE_POSES).map((k) => {
      const g = grid(HERO_W, HERO_H);
      paintSable(g, SABLE_POSES[k]);
      return key(g);
    });
    for (const f of sable) expect(f.includes('#ff00ff')).toBe(false);
    expect(sable[2]).not.toBe(sable[1]);
    expect(sable[3]).not.toBe(sable[0]);
  });

  test('Rowan (the reference for the mature look, decision L8) stands on the shared feet line, about three heads tall', () => {
    const extent = (rig: Rig) => {
      const g = grid(HERO_W, HERO_H);
      // (no hands: the figure alone)
      paintRig(g, rig, { near: { at: [0, 12], hidden: true }, far: { at: [0, 12], hidden: true } });
      const rows = g.map((r) => r.some((c) => c !== null));
      return { top: rows.indexOf(true), feet: rows.lastIndexOf(true) };
    };
    const rowan = extent(ROWAN_RIG);
    for (const peer of [NEVE_RIG, SOLENNE_RIG, HOLLIS_RIG]) expect(rowan.feet).toBe(extent(peer).feet);
    const head = ROWAN_RIG.heads.base.length;
    expect(head).toBeLessThanOrEqual(11);
    expect((rowan.feet - rowan.top + 1) / head).toBeGreaterThanOrEqual(3);
  });
});
