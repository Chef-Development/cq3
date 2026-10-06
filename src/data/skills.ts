// Skill trees (plain data, no logic): each hero has 3 branches of 5 nodes, learned in order (a point each; a point
// every 2 levels). The first two nodes of a branch add a stat; the 3rd and 4th change a rule; the 5th, the capstone,
// changes how you play. '{n}' in a text is the node's number (the live value is tuning.skills.n[id]). Rowan's tree is
// here, the other seven heroes' in skills-heroes.ts. src/core/heroes.ts learns and resets them, src/core/skill-fx.ts
// (Rowan) and skill-fx-heroes.ts (the rest) make the rule nodes work in fights.

import type { HeroId } from './heroes';
import { HERO_TREES } from './skills-heroes';

/** What a stat node adds (n in these units: 8 = +8% attack, 5 = +5% crit chance, 8 = +8 Defense). */
export type SkillStat = 'atkPct' | 'critChance' | 'hpPct' | 'def' | 'meterGain' | 'comboPower';

export interface SkillNode {
  id: string; // unique across every tree
  name: string;
  kind: 'stat' | 'rule' | 'capstone';
  text: string; // one short line
  n?: number;
  stat?: SkillStat; // stat nodes
  before?: string; // rule nodes and capstones: how it works now...
  after?: string; // ...and once learned
}

export interface SkillBranch {
  id: string;
  name: string;
  theme: string; // a few words under the branch name
  nodes: SkillNode[]; // 5, learned top to bottom
}

const stat = (id: string, name: string, s: SkillStat, n: number, text: string): SkillNode => ({ id, name, kind: 'stat', stat: s, n, text });
const rule = (id: string, name: string, text: string, before: string, after: string, n?: number): SkillNode => ({ id, name, kind: 'rule', text, before, after, n });
const cap = (id: string, name: string, text: string, before: string, after: string, n?: number): SkillNode => ({ id, name, kind: 'capstone', text, before, after, n });

export const SKILL_TREES: Record<HeroId, SkillBranch[]> = {
  rowan: [
    {
      id: 'blade',
      name: 'Blade',
      theme: 'Attack and crits',
      nodes: [
        stat('keenEdge', 'Keen Edge', 'atkPct', 12, '+{n}% attack.'),
        stat('steadyAim', 'Steady Aim', 'critChance', 8, '+{n}% crit chance.'),
        rule('followThrough', 'Follow-Through', "A kill's leftover damage hits the next foe.", 'Damage past a kill is lost.', 'It carries on to the next foe.'),
        rule('whetstone', 'Whetstone', 'Every {n}th hit of a combo always crits.', 'Crits come by chance.', 'Every {n}th combo hit crits.', 5),
        cap('executioner', 'Executioner', 'Foes under {n}% HP take double damage from yellows.', 'Yellows hit every foe the same.', 'Yellows deal x2 to foes under {n}% HP.', 35),
      ],
    },
    {
      id: 'bulwark',
      name: 'Bulwark',
      theme: 'Blocking',
      nodes: [
        stat('stout', 'Stout', 'hpPct', 12, '+{n}% max HP.'),
        stat('plateTraining', 'Plate Training', 'def', 10, '+{n} Defense.'),
        rule('parry', 'Parry', 'A Perfect block knocks every other red back.', 'A block stops one red.', 'A Perfect block pushes all reds back.'),
        rule('shieldBash', 'Shield Bash', 'Breaking a shield red stuns its owner for {n} s.', 'Shield reds just break.', 'Its owner stops attacking for {n} s.', 1),
        cap('shieldWall', 'Shield Wall', 'Every {n} reds you block charge a fresh bubble that absorbs a hit.', 'Every red you miss hurts.', 'Every {n} blocks, a bubble eats a missed red.', 6),
      ],
    },
    {
      id: 'momentum',
      name: 'Momentum',
      theme: 'Combo and finisher',
      nodes: [
        stat('rhythm', 'Rhythm', 'meterGain', 10, '+{n}% meter gain.'),
        stat('powerStance', 'Power Stance', 'comboPower', 1.5, '+{n} combo power.'),
        rule('doubleTime', 'Double Time', 'Perfect hits count as 2 combo.', 'Every hit is 1 combo.', 'A Perfect hit is 2 combo.'),
        rule('chargedUp', 'Charged Up', 'Every fight starts with {n} finisher stack.', 'Fights start with an empty meter.', 'Fights start with {n} stack banked.', 1),
        cap('unbroken', 'Unbroken', 'A combo break halves your combo and stacks.', 'A break zeroes combo and stacks.', 'A break only halves them.'),
      ],
    },
  ],
  // the other heroes' trees (src/data/skills-heroes.ts)
  ...HERO_TREES,
};

export const SKILL_NODES: SkillNode[] = Object.values(SKILL_TREES).flatMap((bs) => bs.flatMap((b) => b.nodes));
const BY_ID = new Map(SKILL_NODES.map((n) => [n.id, n]));
export const skillById = (id: string): SkillNode | undefined => BY_ID.get(id);
/** The hero whose tree holds the node. */
export const skillHero = (id: string): HeroId | undefined => (Object.keys(SKILL_TREES) as HeroId[]).find((h) => SKILL_TREES[h].some((b) => b.nodes.some((n) => n.id === id)));
