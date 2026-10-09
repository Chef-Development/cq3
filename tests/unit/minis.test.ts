// Every foe that can stand on a map (an act map's fight, elite and boss nodes, a roaming pack, the world map's
// wandering foe and its skirmish card) has its own map-scale mini (src/engine/art-minis.ts): none falls back to the
// crossed swords. Playtest round 7: the second region's act maps showed swords for every foe.
import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../../src/data/enemies';
import { ALL_ACTS, CAMPAIGN, REGIONS } from '../../src/data/regions';
import { actMap } from '../../src/core/roam';
import { newProfile } from '../../src/core/profile';
import { skirmishFor } from '../../src/core/skirmish';
import { cloneTuning } from '../../src/core/tuning';
import { MINIS, MINI_FALLBACK, MINI_MISSES, miniKey } from '../../src/engine/art-minis';
import { DUSK_ENEMIES } from '../../src/data/enemies-dusk';
import { DUSKMIRE } from '../../src/data/duskmire';

const t = cloneTuning();
/** Foes that never stand on a map: the Coin Rush sack (its stop draws the sack prop) and the camp's Training Dummy. */
const OFF_MAP = ['coinSack', 'dummy'];
const spriteOf = (key: string): string => ENEMIES[key]?.sprite ?? key;

/** Every foe an act can put on its map: its fights (early and late rows), elites, boss and roaming packs. */
function actFoes(act: number): string[] {
  const a = ALL_ACTS[act];
  return [...a.fights.early.flat(), ...a.fights.late.flat(), ...a.elites.flat(), ...a.boss, ...(a.packs ?? []).flat(2)];
}

describe('map minis: every foe that can stand on a map has its own', () => {
  it("every act's fights, elites, boss and packs (each region)", () => {
    expect(REGIONS.length).toBeGreaterThanOrEqual(3);
    for (let act = 0; act < ALL_ACTS.length; act++)
      for (const key of actFoes(act)) {
        expect(ENEMIES[key], `act ${act + 1}: ${key}`).toBeDefined();
        expect(MINIS[spriteOf(key)], `act ${act + 1}: ${key} (sprite ${spriteOf(key)}) has no map mini`).toBeDefined();
      }
  });

  it('the maps as built: every fight, elite and boss node and every pack roaming them (several seeds per act)', () => {
    let nodes = 0;
    for (let act = 0; act < ALL_ACTS.length; act++)
      for (let seed = 1; seed <= 6; seed++) {
        const { map, extras } = actMap(t, CAMPAIGN, act, seed * 7919, true);
        const keys = [...map.nodes.flatMap((n) => n.enemies), ...(extras?.roamers ?? []).flatMap((r) => r.waves.flat())];
        nodes += map.nodes.length;
        for (const key of keys) expect(MINIS[spriteOf(key)], `act ${act + 1} (seed ${seed}): ${key}`).toBeDefined();
      }
    expect(nodes).toBeGreaterThan(100);
  });

  it("the world map's wandering foe and its skirmish card, from any cleared act", () => {
    const p = newProfile();
    for (let cleared = 1; cleared <= ALL_ACTS.length; cleared++)
      for (let n = 0; n < 40; n++) {
        p.actsCleared = cleared;
        p.wander.n = n;
        const s = skirmishFor(p, CAMPAIGN);
        for (const key of s.waves.flat()) expect(MINIS[spriteOf(key)], `skirmish from act ${s.act + 1}: ${key}`).toBeDefined();
      }
  });

  it('every foe in the game has one, but the two that never stand on a map (and those never do)', () => {
    for (const key of Object.keys(ENEMIES)) if (!OFF_MAP.includes(key)) expect(MINIS[spriteOf(key)], `${key} (sprite ${spriteOf(key)})`).toBeDefined();
    for (let act = 0; act < ALL_ACTS.length; act++) for (const key of OFF_MAP) expect(actFoes(act), `act ${act + 1}`).not.toContain(key);
  });
});

describe('map minis: drawn to the style guide', () => {
  // (with the regions written but not wired in yet: their bosses are ranked like the others')
  const bosses = new Set([...Object.values(ENEMIES), ...Object.values(DUSK_ENEMIES)].filter((e) => e.boss).map((e) => e.sprite));
  const finals = new Set([...REGIONS, DUSKMIRE].map((r) => (ENEMIES[r.acts[r.acts.length - 1].boss[0]] ?? DUSK_ENEMIES[r.acts[r.acts.length - 1].boss[0]])?.sprite));

  it('1-2 frames of the same size, every pixel from its palette, at least 3 tones, sized to its rank', () => {
    for (const [name, m] of Object.entries(MINIS)) {
      expect(m.frames.length, name).toBeGreaterThanOrEqual(1);
      expect(m.frames.length, name).toBeLessThanOrEqual(2);
      const w = m.frames[0][0].length;
      const h = m.frames[0].length;
      for (const [i, rows] of m.frames.entries()) {
        expect(rows.length, `${name} frame ${i}: height`).toBe(h);
        for (const r of rows) expect(r.length, `${name} frame ${i}: "${r}"`).toBe(w);
        const used = new Set(rows.join('').replace(/\./g, ''));
        for (const ch of used) expect(m.pal[ch], `${name} frame ${i}: '${ch}' is not in its palette`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(new Set([...used].map((ch) => m.pal[ch].toLowerCase())).size, `${name}: at least 3 tones`).toBeGreaterThanOrEqual(3);
        // nothing touches the frame's edge on all four sides (the outline needs its pixel: art-map.ts pads by 1)
        expect(rows.some((r) => r !== '.'.repeat(w)), name).toBe(true);
      }
      // ordinary foes and elites about 7-16 px wide (wings and legs spread); mini-bosses bigger, each region's boss biggest (they stand
      // before their lair)
      if (finals.has(name)) expect(w, `${name} (a region's boss) is the biggest`).toBeGreaterThanOrEqual(15);
      else if (bosses.has(name)) expect(w, `${name} (a mini-boss) is bigger`).toBeGreaterThanOrEqual(11);
      else expect(w, name).toBeLessThanOrEqual(16);
      expect(w, name).toBeLessThanOrEqual(20);
      expect(h, name).toBeLessThanOrEqual(14);
    }
  });
});

describe('miniKey: the one lookup every map view uses', () => {
  it('picks the frame on the 420 ms beat; a one-frame mini always shows its frame', () => {
    expect(miniKey('slime', 0)).toBe('mfoe_slime_0');
    expect(miniKey('slime', 430)).toBe('mfoe_slime_1');
    expect(miniKey('slime', 850)).toBe('mfoe_slime_0');
    expect(miniKey('boar', 430)).toBe('mfoe_boar_0');
  });

  it('never fails silently: a sprite with no mini is recorded (once) and still drawn, as the crossed swords', () => {
    const before = MINI_MISSES.length;
    expect(miniKey('no-such-foe', 0)).toBe(MINI_FALLBACK);
    expect(miniKey('no-such-foe', 500)).toBe(MINI_FALLBACK);
    expect(MINI_MISSES.slice(before)).toEqual(['no-such-foe']);
    MINI_MISSES.splice(before);
  });
});
