// Region 3's relics (SPOILERS: docs/content-bible.md section 6). NOT IN PLAY YET: not merged into RELICS
// (src/data/relics.ts) until the core has drifting blocks, linked pairs and the hooks below. Same shape as RELICS
// entries (one rule each, at most one number, 1-2 tags, an unlock, `from` the region's first act), with two new tags:
// Drift (blocks that slide along the bar) and Link (linked pairs: in the game's words, a "pair", hit one half then the
// other within a beat). Merging them means adding the two tags and these ids to the unions in relics.ts (TAG_NAME,
// BUILD_NAME, the tag chips' faces and glyphs in engine/view/relic-ui.ts and relic-log.ts).
//
// What each needs from the core is noted beside it: "hooks" = works with the hooks there are (core/hooks.ts) once a
// block knows it drifts (`b.drift`) or which pair it is in; "needs core" = a new hook point:
//   - driftTurn(c, b): a drifting block turned at an end of the bar
//   - driftMult(c, b, mult): a drifting block's speed for this hero
//   - linked(c, pair): a pair finished (both halves hit within the beat); linkBroken(c, pair): a pair broke (return
//     true to forgive the combo break)
//   - linkBeat(c, sec): the beat a pair gives you to hit its second half
//   - a way to pause every drifting block for a while (c.pauseDrift(sec))

import type { RelicDef, RelicRarity, RelicTag, RelicUnlock } from './relics';

export type AshRelicTag = 'drift' | 'link';
export const ASH_RELIC_TAGS: AshRelicTag[] = ['drift', 'link'];
export const ASH_TAG_NAME: Record<AshRelicTag, string> = { drift: 'Drift', link: 'Link' };

export type AshRelicId =
  | 'tailwind'
  | 'weathervane'
  | 'warmSprings'
  | 'rebound'
  | 'anchorStone'
  | 'slipstream'
  | 'flotsam'
  | 'moltenCore'
  | 'forgedBond'
  | 'slowMatch'
  | 'hammerTongs'
  | 'spareLink'
  | 'coupling'
  | 'goldRivets'
  | 'snapBack'
  | 'hairTrigger';

/** A RELICS entry, with Region 3's ids and tags (merged into RelicId / RelicTag when the hooks exist). */
export interface AshRelicDef extends Omit<RelicDef, 'id' | 'tags'> {
  id: AshRelicId;
  tags: Array<RelicTag | AshRelicTag>;
}

/** Region 3's first act, as a global act index (Greenmarch 0-2, the Frostpeaks 3-5). */
export const ASH_FIRST_ACT = 6;

/** A Region 3 relic (offered from its first act on). */
const A = (id: AshRelicId, name: string, tags: Array<RelicTag | AshRelicTag>, rarity: RelicRarity, text: string, n?: number, unlock?: RelicUnlock): AshRelicDef => ({ id, name, tags, rarity, text, n, unlock, from: ASH_FIRST_ACT });

export const ASH_RELICS: AshRelicDef[] = [
  // Drift: a share of yellows slide slowly along the bar, turning back at the ends
  A('tailwind', 'Tailwind', ['drift'], 'common', 'Hits on drifting blocks deal +{n}%.', 40), // hooks: hitMult
  A('weathervane', 'Weathervane', ['drift', 'crit'], 'rare', 'Perfect hits on drifting blocks always crit.', undefined, { kind: 'act', act: 6 }), // hooks: critChance
  A('warmSprings', 'Warm Springs', ['drift', 'sustain'], 'common', 'When a drifting block turns at an end, heal {n} HP.', 2, { kind: 'elite', act: 6 }), // needs core: driftTurn
  A('rebound', 'Rebound', ['drift', 'green'], 'common', 'A drifting block that turns at an end turns green.', undefined, { kind: 'act', act: 6 }), // needs core: driftTurn
  A('anchorStone', 'Anchor Stone', ['drift', 'block'], 'rare', 'Blocking a red stops every drifting block for {n} s.', 3, { kind: 'elite', act: 6 }), // needs core: pauseDrift
  A('slipstream', 'Slipstream', ['drift', 'finisher'], 'rare', 'Hitting a drifting block fills the meter like {n} hits.', 2, { kind: 'act', act: 8 }), // hooks: afterHit
  A('flotsam', 'Flotsam', ['drift', 'coins'], 'common', 'Each drifting block you hit drops {n} coin.', 1), // hooks: afterHit
  A('moltenCore', 'Molten Core', ['drift', 'risk'], 'epic', 'Drifting blocks go {n}% faster, but hits on them deal double.', 50, { kind: 'elite', act: 8 }), // needs core: driftMult (+ hitMult)
  // Link: a share of yellows come as linked pairs; hit one half, then the other within a beat, or both are misses
  A('forgedBond', 'Forged Bond', ['link', 'combo'], 'common', 'A finished pair counts {n} extra combo.', 2), // needs core: linked
  A('slowMatch', 'Slow Match', ['link'], 'rare', "{n}% more time for a pair's second half.", 50, { kind: 'act', act: 7 }), // needs core: linkBeat
  A('hammerTongs', 'Hammer & Tongs', ['link', 'crit'], 'rare', "A pair's second half always crits.", undefined, { kind: 'act', act: 8 }), // hooks: critChance (the block knows it's a second half)
  A('spareLink', 'Spare Link', ['link', 'sustain'], 'rare', "Once a fight, a broken pair doesn't break your combo.", undefined, { kind: 'elite', act: 7 }), // needs core: linkBroken
  A('coupling', 'Coupling', ['link', 'finisher'], 'rare', 'Every {n}rd finished pair banks a finisher stack.', 3, { kind: 'act', act: 7 }), // needs core: linked
  A('goldRivets', 'Gold Rivets', ['link', 'coins'], 'common', 'Each finished pair drops {n} coins.', 2), // needs core: linked
  A('snapBack', 'Snap Back', ['link', 'block'], 'rare', 'A finished pair knocks the nearest red back to the far end.', undefined, { kind: 'elite', act: 7 }), // needs core: linked
  A('hairTrigger', 'Hair Trigger', ['link', 'risk'], 'epic', 'Finished pairs deal triple, but a broken pair costs {n}% HP.', 5, { kind: 'act', act: 8 }), // needs core: linked + linkBroken
];

/** The build the act-clear screen names (merged into BUILD_NAME / PAIR_NAME). */
export const ASH_BUILD_NAME: Record<AshRelicTag, string> = {
  drift: 'Firewalker',
  link: 'Chainsmith',
};

export const ASH_PAIR_NAME: Array<[RelicTag | AshRelicTag, RelicTag | AshRelicTag, string]> = [
  ['drift', 'link', 'Forgemaster'],
  ['drift', 'crit', 'Wildfire'],
  ['link', 'finisher', 'Anvil Breaker'],
];
