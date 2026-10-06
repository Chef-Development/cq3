// The styles (plain data, no logic): broad archetypes defined by what they reward, so each can hold many heroes.
// Each style's shared rule is a set of fight hooks (core/styles.ts) with its numbers in tuning.styles.

import type { StyleId } from './heroes';

export interface StyleDef {
  name: string;
  rewards: string; // what it rewards, a few words (the hero select)
  rule: { name: string; text: string }; // the shared rule, one line ('{n}' = its main number)
}

export const STYLES: Record<StyleId, StyleDef> = {
  blade: { name: 'Blade', rewards: 'Combos and finisher stacks', rule: { name: 'Edge', text: 'At 20+ combo, the meter fills {n}% faster.' } },
  shadow: { name: 'Shadow', rewards: 'Chains of Perfect hits', rule: { name: 'Chain', text: 'Each Perfect in a row: +{n}% damage (up to 5).' } },
  guardian: { name: 'Guardian', rewards: 'Blocking turns into damage', rule: { name: 'Guard', text: 'Blocks store Guard; your next hit unleashes it.' } },
  marksman: { name: 'Marksman', rewards: 'Store power, spend in bursts', rule: { name: 'Focus', text: 'Hits store Focus; a green fires it (none wasted).' } },
  brute: { name: 'Brute', rewards: 'Fewer, heavier taps', rule: { name: 'Heavy', text: 'Fewer, wider yellows; every hit deals x{n}.' } },
  controller: { name: 'Controller', rewards: 'Bending the bar', rule: { name: 'Bend', text: 'A Perfect block slows every red for 1 s.' } },
  summoner: { name: 'Summoner', rewards: 'Allies that fight for you', rule: { name: 'Call', text: 'More greens come; each calls an ally (up to 3).' } },
  bomber: { name: 'Bomber', rewards: 'Blasts from your own kegs', rule: { name: 'Powder', text: 'Kegs show up on the bar; hit one to blast every foe.' } },
};
