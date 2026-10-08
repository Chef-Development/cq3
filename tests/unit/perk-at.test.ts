// Every perk the core fires shows itself on the thing it affects (the playtester's rule, round 6): view/perk-at.ts
// says where, for every perk id. This reads the core's sources for the perks it fires (perkFx, strike, healPerk,
// bankStacks, loseStacks, strikeAll) and the coins it awards, and checks each has an entry, so a new perk can't come
// in as only a word over the bar. (A perk missing here still shows on its block, its foe or the hero at run time:
// perkTargets' fallback.)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COIN_FROM, PERK_ALLY, PERK_AT, PERK_SPAWN, perkTargets } from '../../src/engine/view/perk-at';

const CORE = join(__dirname, '../../src/core');

/** The string literal a call names its perk with: perkFx's first argument, the helpers' last. */
function calls(src: string, fn: string, which: 'first' | 'last'): string[] {
  const ids: string[] = [];
  const re = new RegExp(`\\b${fn}\\(`, 'g');
  for (let m = re.exec(src); m; m = re.exec(src)) {
    // the call's arguments, to its closing parenthesis
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
    }
    const args = src.slice(start, i - 1);
    const lits = [...args.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)].map((x) => x[1]);
    if (!lits.length) continue; // a definition, or an id held in a variable
    ids.push(which === 'first' ? lits[0] : lits[lits.length - 1]);
  }
  return ids;
}

const sources = readdirSync(CORE)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(join(CORE, f), 'utf8'));
const fired = new Set<string>();
const coins = new Set<string>();
for (const src of sources) {
  for (const id of calls(src, 'perkFx', 'first')) fired.add(id);
  for (const fn of ['strike', 'healPerk', 'bankStacks', 'loseStacks', 'strikeAll']) for (const id of calls(src, fn, 'last')) fired.add(id);
  for (const id of calls(src, 'awardCoins', 'last')) coins.add(id);
}

describe('every perk shows on the thing it affects (view/perk-at.ts)', () => {
  it('finds the perks the core fires', () => {
    // (a sanity check on the scan itself)
    for (const id of ['luckyFoot', 'starlight', 'mend', 'emberBite', 'fireBreath', 'quake', 'sharpshooter', 'thornling', 'ricochet']) expect(fired.has(id), id).toBe(true);
    expect(coins.has('goldHoard')).toBe(true);
  });

  it('every perk the core fires has a place to show', () => {
    const missing = [...fired].filter((id) => !PERK_AT[id]).sort();
    expect(missing, `add these to PERK_AT in src/engine/view/perk-at.ts (and docs/fight-events.md, "View coverage")`).toEqual([]);
  });

  it('every source of coins says what they come out of', () => {
    const missing = [...coins].filter((id) => !COIN_FROM[id]).sort();
    expect(missing, 'add these to COIN_FROM in src/engine/view/perk-at.ts').toEqual([]);
  });

  it('the tables agree', () => {
    for (const [id, t] of Object.entries(PERK_AT)) {
      expect(t.length, id).toBeGreaterThan(0);
      if (t.includes('spawn')) expect(PERK_SPAWN[id], `${id}: what it spawns`).toBeDefined();
      if (t.includes('ally')) expect(PERK_ALLY[id], `${id}: whose ally`).toBeDefined();
      if (t.includes('coins')) expect(COIN_FROM[id], `${id}: where its coins come from`).toBeDefined();
    }
  });

  it('a perk not in the table still shows: on its block, its foe, or the hero', () => {
    expect(perkTargets('somethingNew', { pos: 0.4 })).toEqual(['bar']);
    expect(perkTargets('somethingNew', { enemyId: 3 })).toEqual(['foe']);
    expect(perkTargets('somethingNew', { pos: 0.4, enemyId: 3 })).toEqual(['bar', 'foe']);
    expect(perkTargets('somethingNew', {})).toEqual(['hero']);
  });
});
