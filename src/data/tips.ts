// Tips (plain data, no logic): one short tip, shown once, the moment a system first matters ("teach it slowly").
// src/core/tips.ts decides which tip fires and when (TipCoach); src/engine/view/tips.ts draws the card and points
// at its anchor. Seen tips are kept in the profile.
//
// The teaching order: TIPS is in the order things are taught (the first of two that could show at once goes first),
// and a tip's `after` are the tips it waits for (each seen, or known: below). The first fight teaches the five basics
// in FIRST_FIGHT's order (tap yellow before it begins, then block a red, hit a green, let a purple pass, fire the
// finisher); the per-fight cap never holds one of them back, and when its turn comes and the fight hasn't put its
// block on the bar, the coach places one (`lesson`: Act 1's first foes never bring a purple). A tip is skipped once
// the player has shown they know it (`known`: they've done what it teaches that many times, counted from the fight's
// events into profile.tipsDone). A bar rule's tip (`rule`) and a hero's how-to (`hero`) show on first meeting only.
//
// Each tip: one or two lines (tests/unit/tips.test.ts checks they fit the card at 8x), what it points at (the view
// resolves the anchor to a rect on the screen it's on; none = the card shows centred), and whether it pauses a
// fight (the pre-fight ones show before TAP TO BEGIN, the others stop the fight's clock until they're tapped away).

import type { HeroId } from './heroes';
import type { FormationEntry } from './types';

/** What a tip points at. The view finds it on the screen it's on (when it can't, the card shows without an arrow). */
export type TipAnchor =
  | 'none'
  | 'bar' // the timing bar
  | 'yellowBlock' // the first yellow on the bar
  | 'redBlock' // the red that just came in
  | 'purpleBlock'
  | 'greenBlock'
  | 'meter' // the finisher meter (or the finisher button)
  | 'enemy' // the enemy winding up its special
  | 'relicBelt' // the relics under the hero plate
  | 'mapNodes' // the spots the hero can walk to
  | 'eliteNode' // a reachable elite
  | 'sparkle' // a sparkle glinting on the act map (view/map-life.ts)
  | 'relicCard' // the first relic card of the pick
  | 'synergyCard' // the first card marked Synergy!
  | 'campButton' // the Camp button (the act map, the act clear, a defeat)
  | 'retryButton' // the defeat's Retry
  | 'skillsButton' // the camp's Skills button (elsewhere: the Camp button that leads there)
  | 'campBand' // the camp's buttons (Bag, Forge, Skills, Relics)
  | 'skillsReset' // the skill tree's Reset
  | 'heroTabs' // the hero select's tabs
  | 'roamer' // the first wandering pack on the act map
  | 'secretSpot' // the secret beside the node the hero stands on
  | 'wanderer' // the world map's wandering foe
  | 'holdBlock' // the hold block that just came in
  | 'kegBlock'
  | 'frozenBlock'
  | 'mirrorBlock';

export type TipId =
  | 'tapYellow'
  | 'relicBelt'
  | 'special'
  | 'blockRed'
  | 'purple'
  | 'green'
  | 'finisher'
  | 'comboBreak'
  | 'defeat'
  | 'actClear'
  | 'loot'
  | 'relicPick'
  | 'synergy'
  | 'map'
  | 'elite'
  | 'sparkle'
  | 'shop'
  | 'rest'
  | 'event'
  | 'levelUp'
  | 'camp'
  | 'heroes'
  | 'skills'
  | 'relicLog'
  | 'rush'
  | 'roamer'
  | 'secret'
  | 'bounty'
  | 'merchant'
  | 'skirmish'
  // M5: the new blocks and patches (each the first time one comes), chests, the shrine, companions
  | 'hold'
  | 'ice'
  | 'snow'
  | 'mirror'
  | 'iced'
  | 'keg'
  | 'frozen'
  | 'drift'
  | 'pair'
  // playtest round 8: the fourth region's bar rules
  | 'dark'
  | 'tide'
  | 'mirage'
  | 'heat'
  // playtest round 6: an icicle's mark (where it will drop)
  | 'icicle'
  | 'chest'
  | 'shrine'
  | 'companions'
  // playtest round 5: how each hero plays, before their first fight
  | 'kitSable'
  | 'kitNeve'
  | 'kitMoss'
  | 'kitTam'
  | 'kitHollis'
  | 'kitVesper'
  | 'kitTorva'
  // round 7 (Part 6): the second hero of each style
  | 'kitSolenne'
  | 'kitWren'
  // round 7 (Part 6): the new heroes' how-to cards
  | 'kitYara'
  | 'kitDell'
  // ---- Part 6: Fizz and Brann
  | 'kitFizz'
  | 'kitBrann'
  // ---- Gorm and Tess (Part 6)
  | 'kitGorm'
  | 'kitTess';

export interface TipDef {
  id: TipId;
  /** One or two lines (about 46 characters each at most; at most TIP_TEXT_W px wide in the small font). */
  lines: readonly string[];
  /** The lines when the finisher is a button (the debug panel's Finisher: Button), if they differ. */
  buttonLines?: readonly string[];
  anchor: TipAnchor;
  /** 'pre': shown in a fight before TAP TO BEGIN; 'pause': stops the fight's clock until tapped away. */
  fight?: 'pre' | 'pause';
  /** A basic (it was in the game before relics, skills and heroes): a returning player has it marked seen. */
  basic?: boolean;
  /** A hero's how-to: shown before their first fight (pre-fight), only when they're the one fighting. */
  hero?: HeroId;
  /** The tips this one waits for (the teaching order): each must be seen or known first. */
  after?: readonly TipId[];
  /** Known after the player has done what it teaches this many times (yellows hit, reds blocked...: core/tips.ts
   *  counts them into profile.tipsDone): it's skipped from then on. */
  known?: number;
  /** One of the first fight's lessons: when its turn comes (its `after` learned) and nothing on the bar shows it for a
   *  moment, the coach places this block, or ('stack') fills the meter to a finisher stack, so its tip comes as soon as
   *  the gap since the last one allows (one at a time, a few times per fight at most). */
  lesson?: FormationEntry | 'stack';
  /** A bar rule's (or a hero's block's) first meeting: shown when it first comes, never held back by the per-fight cap. */
  rule?: boolean;
  /** The quiet start: a new player (no act cleared) gets it only once they've won this many fights (profile.counts.wins,
   *  core/tips.ts), so the first fights teach the basics and the first chest without the map's extras in between. */
  wins?: number;
}

/** Fights a new player wins before the quiet start's tips (the roaming packs, the relic belt, Synergy!, a level's
 *  skill point, the first sparkle) may come: the first two fights and the first chest teach the basics alone. */
export const QUIET_WINS = 3;

/** The widest a tip's line may be (game px, the small font): the card is this plus its margins. */
export const TIP_TEXT_W = 180;

/** The first fight's lessons, in teaching order: each is shown (or known) before or during the player's first fight,
 *  each after the one before it (their `after`). */
export const FIRST_FIGHT: readonly TipId[] = ['tapYellow', 'blockRed', 'green', 'purple', 'finisher'];

/** What waits for the five basics: the bar rules and the rest of the fight's tips come after the finisher. */
const BASICS: readonly TipId[] = ['finisher'];

export const TIPS: readonly TipDef[] = [
  // ---- the first fight's five lessons (FIRST_FIGHT), in order: yellow before TAP TO BEGIN, then (the fight waits
  // while each is up) the first red, a green, a purple (placed if none comes), and the full meter
  { id: 'tapYellow', lines: ['Tap when the cursor is on yellow.', 'Each hit strikes the foe!'], anchor: 'yellowBlock', fight: 'pre', basic: true, known: 10 },
  { id: 'blockRed', lines: ['Red is an attack coming at you!', 'Tap it like a yellow to block it!'], anchor: 'redBlock', fight: 'pause', basic: true, after: ['tapYellow'], known: 3, lesson: { kind: 'red' } },
  { id: 'green', lines: ['Green powers up your ability.', 'Tap it like a yellow!'], anchor: 'greenBlock', fight: 'pause', basic: true, after: ['blockRed'], known: 3, lesson: { kind: 'green' } },
  { id: 'purple', lines: ['Purple is a trap: let it pass.', 'Tapping it hurts you.'], anchor: 'purpleBlock', fight: 'pause', basic: true, after: ['green'], known: 3, lesson: { kind: 'purple' } },
  {
    id: 'finisher',
    lines: ['Meter full! Swipe for a finisher.', 'More stacks, bigger finisher.'],
    buttonLines: ['Meter full! Tap for a finisher.', 'More stacks, bigger finisher.'],
    anchor: 'meter',
    fight: 'pause',
    basic: true,
    after: ['purple'],
    known: 1,
    lesson: 'stack',
  },
  // ---- before a fight begins: a hero's how-to (what their kit does, the first time they fight; Rowan's is the
  // basics), the relic belt, a Coin Rush
  { id: 'kitSable', hero: 'sable', lines: ['Sable: a Perfect makes you dash.', 'It slows at the next block: tap it!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitNeve', hero: 'neve', lines: ['Neve: blocked reds can freeze.', 'Shatter the ice: double damage!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitMoss', hero: 'moss', lines: ['Moss: greens come often.', 'Each calls an ally. 3 out? A Rally!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitTam', hero: 'tam', lines: ['Tam: kegs show up on the bar.', 'Hit one to blast every foe!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitHollis', hero: 'hollis', lines: ['Hollis: every block hits back.', 'Full Guard? Next tap hits all foes!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitVesper', hero: 'vesper', lines: ['Vesper: hits store Focus.', 'Hit a green to fire it all!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitTorva', hero: 'torva', lines: ['Torva: a green winds up a smash.', 'It grows with your combo!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  // part6:A
  { id: 'kitSolenne', hero: 'solenne', lines: ['Solenne: 15 combo? Blade on fire!', 'A green gilds a yellow: hit it!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitWren', hero: 'wren', lines: ['Wren: 4 Perfects ready a dodge.', 'Greens pop smoke: reds hit soft.'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  // part6:B
  { id: 'kitYara', hero: 'yara', lines: ['Yara: greens call spirits, in turn.', 'All 3 out? A Rally calls the stag!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitDell', hero: 'dell', lines: ['Dell: greens fire your Focus.', 'A Perfect one crits and bounces!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  // part6:C
  { id: 'kitGorm', hero: 'gorm', lines: ['Gorm: every few hits lands heavy', 'and shoves the nearest red back!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitTess', hero: 'tess', lines: ['Tess: hits wind her Stopwatch.', 'When it rings, the reds stand still!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  // part6:D
  { id: 'kitFizz', hero: 'fizz', lines: ['Fizz: kegs are flasks: fire, frost,', 'spark. A green throws one!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'kitBrann', hero: 'brann', lines: ['Brann: every block rings his bell.', 'Rings power up his next hit!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  { id: 'relicBelt', lines: ['Your relics sit here.', 'Tap one to read what it does.'], anchor: 'relicBelt', fight: 'pre', after: ['tapYellow'], wins: QUIET_WINS },
  { id: 'rush', lines: ['Coin Rush! Hits knock out coins.', 'Keep your combo going for more!'], anchor: 'bar', fight: 'pre', after: ['tapYellow'] },
  // ---- in a fight, once the basics are in (the fight waits while the tip is up; a couple per fight at most)
  { id: 'special', lines: ['A special move is coming!', 'Watch the foe!'], anchor: 'enemy', fight: 'pause', basic: true, after: BASICS },
  { id: 'comboBreak', lines: ['A miss or a hit taken breaks your', 'combo and loses your stacks.'], anchor: 'meter', fight: 'pause', basic: true, after: BASICS },
  // ---- a bar rule's (or a hero's block's) first meeting: when it first comes, never capped per fight
  { id: 'hold', lines: ['Hold block! Press at its start', 'and hold it to its end.'], anchor: 'holdBlock', fight: 'pause', rule: true, after: BASICS },
  { id: 'ice', lines: ['Ice! The cursor speeds up on it:', 'tap blocks on ice a bit early.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'snow', lines: ['Snow slows the cursor:', 'wait a beat for blocks in snow.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'mirror', lines: ['A mirror! The cursor', 'bounces back off it.'], anchor: 'mirrorBlock', fight: 'pause', rule: true, after: BASICS },
  { id: 'iced', lines: ['An iced yellow takes a few taps.', 'Each tap cracks the ice.'], anchor: 'yellowBlock', fight: 'pause', rule: true, after: BASICS },
  { id: 'keg', lines: ['A keg! Hit it like a yellow', 'and it blasts every foe.'], anchor: 'kegBlock', fight: 'pause', rule: true, after: BASICS },
  { id: 'frozen', lines: ['A frozen red: hit it like a yellow', 'to shatter it for a big hit!'], anchor: 'frozenBlock', fight: 'pause', rule: true, after: BASICS },
  { id: 'drift', lines: ['Some blocks drift along the bar.', "Watch which way they're heading!"], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'pair', lines: ['A pair: hit one, then the other.', 'Too slow? Both count as misses.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'dark', lines: ['A dark shape! Your light shows', 'what it is. Some are traps!'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'tide', lines: ["The tide! Blocks under water", "can't be hit. Reds wade slowly."], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'mirage', lines: ['A mirage! It jumps to its ghost.', 'Watch for the outline.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'heat', lines: ['A blazing block hits hard,', 'but it burns you. Greens cool you.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  { id: 'icicle', lines: ['An icicle will drop on the mark.', 'Block it like a red when it lands.'], anchor: 'bar', fight: 'pause', rule: true, after: BASICS },
  // ---- the run
  { id: 'defeat', lines: ['Back to the start of the act.', 'Found gear and coins are kept.'], anchor: 'retryButton', basic: true },
  { id: 'actClear', lines: ['Act cleared! Gear up at camp,', 'or go on to the next act.'], anchor: 'campButton', basic: true },
  { id: 'loot', lines: ['Gear for a free slot goes on.', 'Spares wait in your bag at camp.'], anchor: 'none', basic: true },
  { id: 'relicPick', lines: ['Relics change the rules of a fight.', 'Pick ones that fit your style.'], anchor: 'relicCard' },
  { id: 'synergy', lines: ['Synergy! It shares a tag with', 'a relic you own: a build forms!'], anchor: 'synergyCard', wins: QUIET_WINS },
  { id: 'map', lines: ['Pick a path to the boss.', "Icons show what's there."], anchor: 'mapNodes', basic: true },
  { id: 'elite', lines: ['Elites are tougher foes,', 'but they always drop gear.'], anchor: 'eliteNode', basic: true },
  { id: 'roamer', lines: ["Red prints: a pack's next step.", 'Meet it: an ambush, more loot!'], anchor: 'roamer', wins: QUIET_WINS },
  { id: 'secret', lines: ['Something glints in that rock!', 'Tap it: hidden treasure!'], anchor: 'secretSpot' },
  { id: 'sparkle', lines: ['A stray coin is glinting!', 'Tap it to pick it up.'], anchor: 'sparkle', wins: QUIET_WINS },
  { id: 'shop', lines: ['Spend coins on relics and potions.', 'Unspent coins are kept.'], anchor: 'none', basic: true },
  { id: 'rest', lines: ['The campfire heals you.', 'Rest before the fights ahead.'], anchor: 'none', basic: true },
  { id: 'event', lines: ['Pick one! Some cost coins,', 'some are a gamble.'], anchor: 'none', basic: true },
  { id: 'bounty', lines: ['Finish this bounty for its reward.', 'The map keeps count, top right.'], anchor: 'none' },
  { id: 'merchant', lines: ['A traveling trader: rare relics,', 'a bit cheaper than a shop.'], anchor: 'none' },
  { id: 'levelUp', lines: ['Level up! You got a skill point.', 'Spend it in Skills at camp.'], anchor: 'skillsButton', wins: QUIET_WINS },
  // ---- the camp
  { id: 'camp', lines: ['Bag: wear gear. Forge: upgrade it.', 'Skills: learn new tricks.'], anchor: 'campBand', basic: true },
  { id: 'heroes', lines: ['Heroes share gear, but each', 'levels up on their own.'], anchor: 'heroTabs' },
  { id: 'skills', lines: ['Learn each branch in order.', 'Resetting is free: try things out!'], anchor: 'skillsReset' },
  { id: 'chest', lines: ['A hero chest! Opening it is free:', 'a hero, a companion, or shards.'], anchor: 'none' },
  { id: 'shrine', lines: ['Gems buy Rare chests here.', 'A Legendary within 30, for sure.'], anchor: 'none' },
  { id: 'companions', lines: ['A companion fights beside you.', 'Each one helps in its own way.'], anchor: 'none' },
  { id: 'relicLog', lines: ['Every relic, and how to unlock it.', 'Tap one to read what it does.'], anchor: 'none' },
  // ---- the world map
  { id: 'skirmish', lines: ['A foe wanders the road!', 'Tap it to fight for gear and XP.'], anchor: 'wanderer' },
];

export const TIP_IDS: readonly TipId[] = TIPS.map((t) => t.id);

/** The first finisher in the game is revealed by name before its show (view/finisher-reveal.ts): its one-time mark in
 *  profile.seen. The Test lab's profiles have it seen unless a scenario teaches the finisher (its tips list it). */
export const FINISHER_REVEAL = 'finisherReveal';

export const isTipId = (v: unknown): v is TipId => typeof v === 'string' && (TIP_IDS as readonly string[]).includes(v);

export const tipById = (id: string): TipDef | undefined => TIPS.find((t) => t.id === id);

/** The tips a returning player (an act already cleared) has marked seen: the basics, not the new systems. */
export const BASIC_TIPS: readonly TipId[] = TIPS.filter((t) => t.basic).map((t) => t.id);

/**
 * The welcome back: a short scene for a player returning from an earlier version (round 8: the new story, the living
 * map and the Mapmaker), played once over the title. Kept in the profile's seen list with the tips. A new id replays
 * it for every returning player (an older id is dropped when the profile is read): round 8's is 'welcomeR8' (it was
 * 'welcomeM4a', relics, levels and Sable).
 */
export const WELCOME_ID = 'welcomeR8';
export type SeenId = TipId | typeof WELCOME_ID;
export const isSeenId = (v: unknown): v is SeenId => v === WELCOME_ID || isTipId(v);
