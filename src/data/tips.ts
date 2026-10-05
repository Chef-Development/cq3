// Tips (plain data, no logic): one short tip, shown once, the moment a system first matters ("teach it slowly").
// src/core/tips.ts decides which tip fires and when (TipCoach); src/engine/view/tips.ts draws the card and points
// at its anchor. The order of TIPS is the priority when two could show at once. Seen tips are kept in the profile.
//
// Each tip: one or two lines (tests/unit/tips.test.ts checks they fit the card at 8x), what it points at (the view
// resolves the anchor to a rect on the screen it's on; none = the card shows centred), and whether it pauses a
// fight (the pre-fight ones show before TAP TO BEGIN, the others stop the fight's clock until they're tapped away).

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
  | 'relicCard' // the first relic card of the pick
  | 'synergyCard' // the first card marked Synergy!
  | 'campButton' // the Camp button (the act map, the act clear, a defeat)
  | 'retryButton' // the defeat's Retry
  | 'skillsButton' // the camp's Skills button (elsewhere: the Camp button that leads there)
  | 'campBand' // the camp's buttons (Bag, Forge, Skills, Relics)
  | 'skillsReset' // the skill tree's Reset
  | 'heroTabs'; // the hero select's tabs

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
  | 'shop'
  | 'rest'
  | 'event'
  | 'levelUp'
  | 'camp'
  | 'heroes'
  | 'skills'
  | 'relicLog';

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
}

/** The widest a tip's line may be (game px, the small font): the card is this plus its margins. */
export const TIP_TEXT_W = 180;

export const TIPS: readonly TipDef[] = [
  // ---- before a fight begins
  { id: 'tapYellow', lines: ['Tap when the cursor is on yellow.', 'Each hit strikes the enemy!'], anchor: 'yellowBlock', fight: 'pre', basic: true },
  { id: 'relicBelt', lines: ['Your relics sit here.', 'Tap one to read what it does.'], anchor: 'relicBelt', fight: 'pre' },
  // ---- in a fight (the fight waits while the tip is up)
  { id: 'special', lines: ['A special move is coming!', 'Watch the enemy closely.'], anchor: 'enemy', fight: 'pause', basic: true },
  { id: 'blockRed', lines: ['Red is an attack coming at you!', 'Tap it like a yellow to block it!'], anchor: 'redBlock', fight: 'pause', basic: true },
  { id: 'purple', lines: ['Purple is a trap: let it pass.', 'Tapping it hurts you.'], anchor: 'purpleBlock', fight: 'pause', basic: true },
  { id: 'green', lines: ['Green powers up your ability.', 'Tap it like a yellow!'], anchor: 'greenBlock', fight: 'pause', basic: true },
  {
    id: 'finisher',
    lines: ['Meter full! Swipe for a finisher.', 'More stacks, bigger finisher.'],
    buttonLines: ['Meter full! Tap for a finisher.', 'More stacks, bigger finisher.'],
    anchor: 'meter',
    fight: 'pause',
    basic: true,
  },
  { id: 'comboBreak', lines: ['A miss or a hit taken breaks your', 'combo and loses your stacks.'], anchor: 'meter', fight: 'pause', basic: true },
  // ---- the run
  { id: 'defeat', lines: ['Back to the start of the act.', 'Found gear and coins are kept.'], anchor: 'retryButton', basic: true },
  { id: 'actClear', lines: ['Act cleared! Gear up at the camp,', 'or press on to the next act.'], anchor: 'campButton', basic: true },
  { id: 'loot', lines: ['New gear goes in your bag.', 'Wear it at the camp.'], anchor: 'none', basic: true },
  { id: 'relicPick', lines: ['Relics change the rules of a fight.', 'Pick the ones that fit your style.'], anchor: 'relicCard' },
  { id: 'synergy', lines: ['Synergy! It shares a tag with a', 'relic you own: a build is forming!'], anchor: 'synergyCard' },
  { id: 'map', lines: ['Pick a path to the boss.', "Spots show what's there."], anchor: 'mapNodes', basic: true },
  { id: 'elite', lines: ['Elites are tougher foes,', 'but they always drop gear.'], anchor: 'eliteNode', basic: true },
  { id: 'shop', lines: ['Spend coins on relics and potions.', 'Unspent coins are kept.'], anchor: 'none', basic: true },
  { id: 'rest', lines: ['The campfire heals you.', 'Rest up before the fights ahead.'], anchor: 'none', basic: true },
  { id: 'event', lines: ['Pick a choice! Some cost coins,', 'some are a gamble.'], anchor: 'none', basic: true },
  { id: 'levelUp', lines: ['Level up! You earned a skill point.', "Spend it at the camp's Skills."], anchor: 'skillsButton' },
  // ---- the camp
  { id: 'camp', lines: ['Bag: wear gear. Forge: upgrade it.', 'Skills: learn new tricks.'], anchor: 'campBand', basic: true },
  { id: 'heroes', lines: ['Heroes share gear, but each one', 'levels up on their own.'], anchor: 'heroTabs' },
  { id: 'skills', lines: ['Learn each branch in order.', 'Resetting is free: try things out!'], anchor: 'skillsReset' },
  { id: 'relicLog', lines: ['Every relic, and how to unlock it.', 'Tap one to read what it does.'], anchor: 'none' },
];

export const TIP_IDS: readonly TipId[] = TIPS.map((t) => t.id);

export const isTipId = (v: unknown): v is TipId => typeof v === 'string' && (TIP_IDS as readonly string[]).includes(v);

export const tipById = (id: string): TipDef | undefined => TIPS.find((t) => t.id === id);

/** The tips a returning player (an act already cleared) has marked seen: the basics, not the new systems. */
export const BASIC_TIPS: readonly TipId[] = TIPS.filter((t) => t.basic).map((t) => t.id);

/**
 * The welcome back: a short scene for a player returning from an earlier version (what's new: relics, levels and
 * skills, Sable), played once over the title. Kept in the profile's seen list with the tips.
 */
export const WELCOME_ID = 'welcomeM4a';
export type SeenId = TipId | typeof WELCOME_ID;
export const isSeenId = (v: unknown): v is SeenId => v === WELCOME_ID || isTipId(v);
