// The heroes (plain data, no logic): who they are and what their kit does, in words. Their numbers live in
// src/core/tuning.ts (tuning.hero for Rowan and the shared hero rules, tuning.sable for Sable's kit), their skill
// trees in src/data/skills.ts, their level and skills in the profile (src/core/heroes.ts).

export type HeroId = 'rowan' | 'sable';
export const HERO_IDS: HeroId[] = ['rowan', 'sable'];

/** How a hero plays the bar: Blade = one cursor over the whole bar; Twin = two cursors, one per half. */
export type HeroFamily = 'blade' | 'twin';

export interface KitPart {
  name: string;
  text: string; // one short line; '{n}' is the kit's tuning number where it has one
  short: string; // the hero select's line: plain words, no numbers
}

export interface HeroDef {
  id: HeroId;
  name: string;
  family: HeroFamily;
  title: string; // "Junior Knight"
  bio: string; // one short line on the hero select
  ability: KitPart; // what a green hit does
  passive?: KitPart;
  finisher: KitPart;
}

export const HEROES: Record<HeroId, HeroDef> = {
  rowan: {
    id: 'rowan',
    name: 'Rowan',
    family: 'blade',
    title: 'Junior Knight',
    bio: 'Slept through the end of time. Oops.',
    ability: { name: 'Battle Focus', text: 'Green hits: +{n}% crit for a few seconds.', short: 'Green hits raise your crit.' },
    finisher: { name: 'Whirlwind', text: 'Swipe: strikes every foe and clears all reds.', short: 'Swipe: hits all, clears reds.' },
  },
  sable: {
    id: 'sable',
    name: 'Sable',
    family: 'twin',
    title: 'Twin-Dagger Ninja',
    bio: 'Tried to rob us. Got caught by an owl.',
    ability: { name: 'Shadow Step', text: 'For {n} s, a hit with one cursor also hits the block under the other.', short: 'Green hits link both cursors.' },
    passive: { name: 'Ambidextrous', text: 'Alternating left and right hits fill the meter {n}% faster.', short: 'Switch hands: faster meter.' },
    finisher: { name: 'Twin Fang', text: 'Swipe: hits the target alone, harder per stack; a kill keeps 1 stack.', short: 'Swipe: one huge hit.' },
  },
};

export const heroDef = (id: HeroId): HeroDef => HEROES[id] ?? HEROES.rowan;
