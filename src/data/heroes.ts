// The heroes (plain data, no logic). A hero = a style (a shared rule, src/data/styles.ts + core/styles.ts) + a
// signature mechanic + a green-block ability + a passive + their own finisher + a skill tree (src/data/skills.ts) +
// a rarity (Rare to Divine; higher rarity = a richer kit). Their kits work as fight hooks (core/kit-fx.ts); their
// numbers live in src/core/tuning.ts (tuning.hero for the shared hero rules and Rowan, tuning.kits.<id> for the rest);
// their level, skills and stars live in the profile (src/core/heroes.ts). One cursor for every hero, always.

import type { Tier } from './rarity';
import type { FoeTag } from './types';

export type HeroId =
  | 'rowan' | 'sable' | 'neve' | 'moss' | 'tam' | 'hollis' | 'vesper' | 'torva'
  // round 7 (Part 6): a second hero per style; each agent adds its ids after its own marker
  // part6:A
  // part6:B
  // part6:C
  // part6:D
  | 'fizz' | 'brann'
  ;
export const HERO_IDS: HeroId[] = [
  'rowan', 'sable', 'neve', 'moss', 'tam', 'hollis', 'vesper', 'torva',
  // part6:A
  // part6:B
  // part6:C
  // part6:D
  'fizz', 'brann',
];

/** Broad archetypes, defined by what they reward (each can hold many heroes later). */
export type StyleId = 'blade' | 'shadow' | 'guardian' | 'marksman' | 'brute' | 'controller' | 'summoner' | 'bomber';
export const STYLE_IDS: StyleId[] = ['blade', 'shadow', 'guardian', 'marksman', 'brute', 'controller', 'summoner', 'bomber'];

export interface KitPart {
  name: string;
  text: string; // one short line; '{n}' is the kit's tuning number where it has one
  short: string; // the hero select's line: plain words, no numbers
}

/** The finisher: what it does, and what it does to the bar (in a few words, for the hero select). */
export interface FinisherPart extends KitPart {
  bar: string;
}

/** A soft strength: an edge against one kind of foe (never needed to progress). */
export interface Strength {
  tag: FoeTag;
  /** 'dmg': deals n more damage to them; 'guard': takes n less from them. */
  kind: 'dmg' | 'guard';
  n: number;
}

/** Summoner allies: who a green hit calls, and what each one does. */
export type AllyKind = 'thornling' | 'barkback' | 'glowmoth' | 'seedling';

export interface HeroDef {
  id: HeroId;
  name: string;
  style: StyleId;
  rarity: Tier;
  title: string; // "Junior Knight"
  bio: string; // one short line on the hero select
  signature: KitPart;
  ability: KitPart; // what a green hit does
  passive: KitPart;
  finisher: FinisherPart;
  /** Mythic and above: one more kit part on top of the four (round 7's first Mythic heroes; the hero select shows it
   *  as a fifth card). */
  gift?: KitPart;
  strengths: Strength[];
  /** How the hero is first met: the start, a story scene, or a hero chest (whose first reveal plays `meetScene`). */
  joins: 'start' | 'story' | 'chest';
  meetScene?: string;
  /** The moves stars unlock: 3 and 5 stars (2 and 4 stars add stats, the same for everyone). */
  stars: [KitPart, KitPart];
  /** Texture prefix of their fight frames (`${art}_${pose}`; Rowan's are hero_*). */
  art: string;
  /** Summoners: the allies a green hit calls, in order. */
  allies?: AllyKind[];
}

const part = (name: string, text: string, short: string): KitPart => ({ name, text, short });

export const HEROES: Record<HeroId, HeroDef> = {
  rowan: {
    id: 'rowan',
    name: 'Rowan',
    style: 'blade',
    rarity: 'rare',
    title: 'Junior Knight',
    bio: 'Slept through the end of time. Oops.',
    signature: part('Whirlwind Sweep', 'His finisher hits every foe at once.', 'Finisher hits every foe.'),
    ability: part('Battle Focus', 'Green hits: +{n}% crit for a few seconds.', 'Green hits raise your crit.'),
    passive: part('Resolve', "The first hit you take each fight doesn't break your combo.", 'Shrugs off a hit.'),
    finisher: { name: 'Whirlwind', text: 'Hits every foe and clears all reds.', short: 'Hits all, clears reds.', bar: 'Clears reds' },
    strengths: [{ tag: 'folk', kind: 'dmg', n: 0.2 }, { tag: 'frost', kind: 'dmg', n: 0.15 }],
    joins: 'start',
    stars: [
      part('Wide Sweep', 'Whirlwind adds 1 combo for every foe it hits.', 'Finisher builds combo.'),
      part('Hero Focus', 'During Battle Focus, every hit counts 2 combo.', 'Focus doubles combo.'),
    ],
    art: 'hero',
  },
  sable: {
    id: 'sable',
    name: 'Sable',
    style: 'shadow',
    rarity: 'epic',
    title: 'Shadow Ninja',
    bio: 'Tried to rob us. Got caught by an owl.',
    signature: part('Shadow Dash', 'A Perfect hit dashes the cursor to the next block, where it slows: tap that block!', 'Perfects dash you ahead.'),
    ability: part('Smoke Veil', "Green hits: for {n} s, a miss doesn't break your combo or Chain.", 'Green hits forgive misses.'),
    passive: part('Silent Step', 'Perfect hits fill the meter {n}% more.', 'Perfects charge the meter.'),
    finisher: { name: 'Twin Fang', text: 'Hits the target alone, harder; a kill keeps 1 stack.', short: 'One huge hit.', bar: 'Clears reds' },
    strengths: [{ tag: 'caster', kind: 'dmg', n: 0.2 }],
    joins: 'story',
    stars: [
      part('Afterimage', 'A dash leaves an afterimage that stops the next red.', 'Dashes leave a blocker.'),
      part('Fang and Claw', 'Twin Fang strikes twice.', 'Finisher strikes twice.'),
    ],
    art: 'sable',
  },
  neve: {
    id: 'neve',
    name: 'Neve',
    style: 'controller',
    rarity: 'legendary',
    title: 'Frost Mage',
    bio: 'Froze herself once. Do not ask.',
    signature: part('Flash Freeze', 'Blocking a red can freeze it; hit the ice to shatter it.', 'Blocks freeze reds to shatter.'),
    ability: part('Chill', 'Green hits: for {n} s, the cursor moves 25% slower.', 'Green hits slow the cursor.'),
    passive: part('Cold Snap', "Ice patches bother her half as much; shattered ice fills {n}% of a hit's meter.", 'Thrives on ice.'),
    finisher: { name: 'Glacier', text: 'Hits all, freezes every red in place, slows the whole bar, then its middle.', short: 'Freezes the bar.', bar: 'Freezes and slows' },
    strengths: [{ tag: 'beast', kind: 'dmg', n: 0.15 }],
    joins: 'story',
    stars: [
      part('Deep Frost', 'Flash Freeze works far more often.', 'Freezes more often.'),
      part('Permafrost', "Glacier's slow covers the whole bar.", 'Finisher slows it all.'),
    ],
    art: 'neve',
  },
  moss: {
    id: 'moss',
    name: 'Moss',
    style: 'summoner',
    rarity: 'epic',
    title: 'Grove Caller',
    bio: 'Talks to plants. Some of them talk back.',
    signature: part('Grove Bond', 'Allies come in order and grow with your Companion stat; with all 3 out, a call is a Rally.', 'Calls a grove of allies.'),
    ability: part('Call', 'Green hits call the next ally: Thornling, Barkback, Glowmoth.', 'Green hits call allies.'),
    passive: part('Deep Roots', 'With 2+ allies out, your hits deal {n}% more.', 'Stronger with friends.'),
    finisher: { name: 'Overgrowth', text: 'Hits all, more per ally; vines slow new reds.', short: 'Hits all, slows reds.', bar: 'Slows reds' },
    strengths: [{ tag: 'swarm', kind: 'dmg', n: 0.25 }],
    joins: 'chest',
    meetScene: 'meetMoss',
    stars: [
      part('Old Growth', 'Allies stay longer.', 'Allies stay longer.'),
      part('Seedling', 'A 4th ally: a Seedling that plants green blocks.', 'A fourth ally.'),
    ],
    art: 'moss',
    allies: ['thornling', 'barkback', 'glowmoth'],
  },
  tam: {
    id: 'tam',
    name: 'Tam',
    style: 'bomber',
    rarity: 'rare',
    title: 'Sapper',
    bio: 'Loves loud noises. Lost her eyebrows.',
    signature: part('Chain Fuse', "A keg's blast sets off every keg near it.", 'Kegs set each other off.'),
    ability: part('Fuse Up', 'Green hits drop a keg on the bar.', 'Green hits drop kegs.'),
    passive: part('Blast Shield', 'Bombs that reach you deal half damage.', 'Shrugs off bombs.'),
    finisher: { name: 'Big Bang', text: 'Hits all foes, then drops 3 kegs on the bar.', short: 'Hits all, adds kegs.', bar: 'Fills it with kegs' },
    strengths: [{ tag: 'armored', kind: 'dmg', n: 0.2 }],
    joins: 'chest',
    meetScene: 'meetTam',
    stars: [
      part('Short Fuses', 'Kegs come more often.', 'More kegs.'),
      part('Big Ones', 'Kegs blast twice as wide.', 'Wider blasts.'),
    ],
    art: 'tam',
  },
  hollis: {
    id: 'hollis',
    name: 'Hollis',
    style: 'guardian',
    rarity: 'rare',
    title: 'Shieldwarden',
    bio: 'Has never once been in a hurry.',
    signature: part('Shield Slam', "Every block slams the red's owner for {n}% attack; a Perfect block slams harder.", 'Blocks hit back.'),
    ability: part('Brace', 'Green hits: for 3 s, blocks give double Guard and meter.', 'Green hits brace the shield.'),
    passive: part('Iron Hide', 'Reds that reach you deal {n}% less.', 'Takes less from reds.'),
    finisher: { name: 'Rampart', text: 'One big hit with all your Guard; reds bounce off the wall.', short: 'Reds bounce back.', bar: 'Walls the left end' },
    strengths: [{ tag: 'brute', kind: 'guard', n: 0.2 }],
    joins: 'chest',
    meetScene: 'meetHollis',
    stars: [
      part('Tall Shield', 'Guard holds more charges.', 'Stores more Guard.'),
      part('Shield Storm', 'Every block slams as hard as a Perfect one.', 'Every slam hits hard.'),
    ],
    art: 'hollis',
  },
  vesper: {
    id: 'vesper',
    name: 'Vesper',
    style: 'marksman',
    rarity: 'legendary',
    title: 'Dusk Ranger',
    bio: 'Never misses. Pretends not to like owls.',
    signature: part('Eagle Eye', 'Perfect hits store double Focus.', 'Perfects store more Focus.'),
    ability: part('Piercing Shot', 'The Power Shot also hits the foe behind for half.', 'Green shots pierce.'),
    passive: part('Patience', 'Focus is kept between waves. At full Focus a green crits; with no green out, a Perfect fires it.', 'Keeps her Focus.'),
    finisher: { name: 'Volley', text: 'Arrows hit every foe, spending Focus; pins every red.', short: 'Rains arrows, pins reds.', bar: 'Pins reds in place' },
    strengths: [{ tag: 'flyer', kind: 'dmg', n: 0.25 }],
    joins: 'chest',
    meetScene: 'meetVesper',
    stars: [
      part('Deep Quiver', 'Focus holds 50% more.', 'Stores more Focus.'),
      part('Long Pin', 'Volley pins reds twice as long.', 'Pins reds longer.'),
    ],
    art: 'vesper',
  },
  torva: {
    id: 'torva',
    name: 'Torva',
    style: 'brute',
    rarity: 'epic',
    title: 'Hammer Brute',
    bio: 'Solves things with a hammer. It works.',
    signature: part('Quake', 'A Perfect hit knocks every red on the bar back.', 'Perfects knock reds back.'),
    ability: part('Wind-Up', 'Green hits: your next hit stuns and smashes for x{n}, more with a higher combo.', 'Green hits wind up a smash.'),
    passive: part('Unstoppable', 'Each hit you take adds {n}% damage this fight (up to 5).', 'Angrier when hurt.'),
    finisher: { name: 'Earthsplitter', text: 'Hits all foes and clears the whole bar.', short: 'Hits all, clears all.', bar: 'Clears everything' },
    strengths: [{ tag: 'construct', kind: 'dmg', n: 0.2 }],
    joins: 'chest',
    meetScene: 'meetTorva',
    stars: [
      part('Aftershock', 'Quake also comes on Perfect blocks.', 'Blocks quake too.'),
      part('Second Swing', 'Earthsplitter keeps 1 stack.', 'Finisher keeps a stack.'),
    ],
    art: 'torva',
  },
  // part6:A
  // part6:B
  // part6:C
  // part6:D
  // ---- Fizz and Brann (Part 6): a second Bomber and a second Guardian
  fizz: {
    id: 'fizz',
    name: 'Fizz',
    style: 'bomber',
    rarity: 'legendary',
    title: 'Alchemist',
    bio: 'Blew up her lab. Took notes.',
    signature: part('Mixed Brew', 'Her kegs are flasks, in turn: fire burns every foe, frost slows the reds, spark blasts bigger.', 'Flasks in three brews.'),
    ability: part('Toss', 'Green hits throw the next flask at the target: x{n} attack, and its brew.', 'Green hits throw a flask.'),
    passive: part('Fume Mask', 'Traps hurt her {n}% less.', 'Shrugs off traps.'),
    finisher: { name: 'Grand Reaction', text: 'Hits all; every flask on the bar goes off, then two new ones land.', short: 'Sets off every flask.', bar: 'Blows flasks, adds 2' },
    strengths: [{ tag: 'frost', kind: 'dmg', n: 0.2 }],
    joins: 'chest',
    meetScene: 'meetFizz',
    stars: [
      part('Potent Brews', 'Every brew burns, chills and blasts half again as much.', 'Stronger brews.'),
      part('Full Rack', 'Grand Reaction lands a flask of every brew.', 'Finisher adds 3 flasks.'),
    ],
    art: 'fizz',
  },
  brann: {
    id: 'brann',
    name: 'Brann',
    style: 'guardian',
    rarity: 'epic',
    title: 'Bellwarden',
    bio: 'Took a vow of silence. Carries a bell.',
    signature: part('Toll', 'Every block rings his bell: each toll adds {n}% to his next hit (up to 3).', 'Blocks ring his bell.'),
    ability: part('Peal', 'Green hits: for {n} s, each red you block echoes back at every foe.', 'Green hits echo blocks.'),
    passive: part('Still Mind', 'Perfect blocks store {n} more Guard.', 'Perfect blocks store more.'),
    finisher: { name: 'Great Bell', text: 'The bell drops on the target with all your Guard; every foe is stunned.', short: 'One huge hit, stuns all.', bar: 'Stops new reds' },
    strengths: [{ tag: 'caster', kind: 'guard', n: 0.2 }],
    joins: 'chest',
    meetScene: 'meetBrann',
    stars: [
      part('Deep Toll', 'The bell holds up to 5 tolls.', 'More tolls.'),
      part('Echoing Bell', 'Great Bell also hits every other foe for half.', 'Finisher hits all.'),
    ],
    art: 'brann',
  },
};

export const heroDef = (id: HeroId): HeroDef => HEROES[id] ?? HEROES.rowan;
export const isHeroId = (v: unknown): v is HeroId => typeof v === 'string' && HERO_IDS.includes(v as HeroId);
