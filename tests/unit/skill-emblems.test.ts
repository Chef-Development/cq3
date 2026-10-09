// Skill nodes without a painted icon get the emblem their name is about (art-skill-emblems.ts; the art audit found
// half of them on one generic rune). Every emblem is a 10x10 map in the icon palette, and every rule node and
// capstone of the later heroes either has its own map or finds an emblem.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SKILL_NODES } from '../../src/data/skills';
import { capstoneOf, emblemFor, SKILL_EMBLEMS } from '../../src/engine/art-skill-emblems';

describe('skill emblems', () => {
  it('every emblem is a 10x10 map (a capstone keeps the size)', () => {
    for (const [k, rows] of Object.entries(SKILL_EMBLEMS)) {
      expect(rows.length, k).toBe(10);
      for (const r of rows) expect(r.length, `${k}: ${r}`).toBe(10);
      for (const r of capstoneOf(rows)) expect(r.length, k).toBe(10);
    }
  });

  it('names pick the emblem they are about', () => {
    expect(emblemFor('frostTrail', 'Frost Trail')).toBe('ice');
    expect(emblemFor('stunningToll', 'Stunning Toll')).toBe('bell');
    expect(emblemFor('luckyBounce', 'Lucky Bounce')).toBe('luck');
    expect(emblemFor('pinningShot', 'Pinning Shot')).toBe('arrow');
    expect(emblemFor('zzz', 'Plain')).toBeNull();
  });

  it('almost every rule node and capstone without a painted map finds an emblem', () => {
    const src = readFileSync('src/engine/art-relics.ts', 'utf8');
    const own = new Set([...src.matchAll(/^ {2}([a-zA-Z]+): \[$/gm)].map((m) => m[1]));
    const left = SKILL_NODES.filter((n) => n.kind !== 'stat' && !own.has(n.id) && !emblemFor(n.id, n.name)).map((n) => n.id);
    // the aliases (Sable's old art) and a few names about nothing drawable keep the rune
    expect(left.length, left.join(', ')).toBeLessThanOrEqual(12);
  });
});
