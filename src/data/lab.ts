// The Test lab's scenarios (plain data, no logic): short setups (30-90 s each) that drop the playtester straight into
// what is new, to try it and rate it (Good / Needs work / Broken, a short note) in about ten minutes. core/lab.ts
// builds each one's profile (the lab's own save, never the real one) and its practice fight; engine/lab.ts is the
// list, the rating card and the "Copy report".
//
// STANDING RULE (CLAUDE.md): every session adds its new content to LAB_NEW and moves the previous session's items to
// LAB_EARLIER. Region foes, mini-bosses, bosses and story are secret: their items go in the 'spoiler' group (hidden
// until "Show spoilers"), labelled by act number only, never by name. Labels and "what to try" lines are game words,
// one short line each (the playtester reads little).

import type { CompanionId } from './companions';
import type { HeroId } from './heroes';
import type { CampUpgradeId } from './meta';
import type { Tier } from './rarity';
import { FIRST_FIGHT, type TipId } from './tips';
import type { BarRules } from './types';

export type LabGroupId = 'heroes' | 'companions' | 'fights' | 'chests' | 'camp' | 'bar' | 'spoiler';

/** The list's groups, in order. The spoiler group is hidden until "Show spoilers". */
export const LAB_GROUPS: Array<{ id: LabGroupId; name: string; spoiler?: boolean }> = [
  { id: 'heroes', name: 'Heroes' },
  { id: 'companions', name: 'Companions' },
  { id: 'fights', name: 'Fights' },
  { id: 'chests', name: 'Chests and shrine' },
  { id: 'camp', name: 'Camp' },
  { id: 'bar', name: 'Bar rules' },
  { id: 'spoiler', name: 'Spoilers', spoiler: true },
];

/** A camp screen a scenario opens. */
export type LabScreen = 'heroes' | 'skills' | 'chest' | 'chestDemo' | 'shrine' | 'companions' | 'upgrades' | 'completion';

/** What a scenario drops the playtester into. */
export type LabSetup =
  /** A practice fight (no rewards, nothing saved): the hero at `act` (acts are global: 3-5 are Region 2's) with
   *  `stars`, these companions, these waves of foes, the bar rules ('act': the act's own), `stacks` finisher stacks
   *  banked at the start; `safe`: nothing hurts the hero. */
  | { kind: 'fight'; hero: HeroId; stars?: number; pets?: CompanionId[]; act: number; waves: string[][]; bar?: BarRules | 'act'; row?: number; safe?: boolean; stacks?: number }
  /** A camp screen (with `hero` shown first where it has one). 'chestDemo': the chest opening played at these
   *  `tiers` one after another (a demo: nothing is granted), from a chest of kind `chest`. */
  | { kind: 'camp'; screen: LabScreen; hero?: HeroId; tiers?: Tier[]; chest?: 'hero' | 'rare' | 'region' }
  /** Story scenes in a row, over act `act`'s stage. */
  | { kind: 'story'; act: number; scenes: string[] };

/** What the lab's profile holds for a scenario (core/lab.ts builds it on a fresh profile). */
export interface LabProfileSpec {
  actsCleared?: number;
  /** Heroes owned and their stars (Rowan and Sable are always owned; the rest are locked unless listed). */
  heroes?: Partial<Record<HeroId, number>>;
  /** The picked hero. */
  hero?: HeroId;
  /** Every owned hero's level (default: one that fits the scenario's act). */
  level?: number;
  /** Companions owned (Pip always), and the ones brought into fights. */
  pets?: CompanionId[];
  petsOn?: CompanionId[];
  camp?: CampUpgradeId[];
  /** Mastery milestones reached (they make camp upgrades buyable). */
  mastery?: string[];
  coins?: number;
  /** Gems for this many Rare chests at the shrine. */
  shrineChests?: number;
  chests?: { hero?: number; rare?: number; region?: number };
  /** Rare chests until the shrine's guaranteed Legendary. */
  pityLeft?: number;
  /** Region 1's completion tracker: one short of 100%, or at 100% with its reward still to claim; 'all': everything
   *  unlocked (every region's acts cleared and everything logged, every hero and companion unlocked). */
  completion?: 'near' | 'done' | 'all';
  /** Tips still to show (tips on; every other tip seen): a hero's how-to card before the fight. */
  tips?: TipId[];
  /** Skill nodes learned (each node's branch is learned up to it): a tree option to try in a fight. */
  skills?: Partial<Record<HeroId, string[]>>;
}

export interface LabScenario {
  id: string;
  group: LabGroupId;
  /** A short name (game words; no region names outside the spoiler group, and none in it either). */
  label: string;
  /** About how long it takes, in seconds (30-90). */
  secs: number;
  /** The one line shown before it starts: what to try. */
  try: string;
  /** Region foes, bosses and story: hidden until "Show spoilers". */
  spoiler?: boolean;
  /** Bumped when the scenario is reworked after a playtest: a rating given to an earlier rev asks again. */
  rev?: number;
  setup: LabSetup;
  profile?: LabProfileSpec;
}

const PERCH: CampUpgradeId[] = ['perch'];

/** Each hero's how-to card (src/data/tips.ts), shown before their lab fight. */
const KIT_TIP: Partial<Record<HeroId, TipId>> = { sable: 'kitSable', neve: 'kitNeve', moss: 'kitMoss', tam: 'kitTam', hollis: 'kitHollis', vesper: 'kitVesper', torva: 'kitTorva' };

/** A hero's fight, long enough to feel the kit (playtest round 5: the old two-wave ones ended before it showed): six
 *  waves of Region 1 foes at Act 2's numbers, the last with an elite, real damage, the finisher banked once, the
 *  hero's how-to card first. */
const heroFight = (id: string, hero: HeroId, label: string, tryLine: string, waves: string[][], o: { rev?: number; skills?: string[] } = {}): LabScenario => ({
  id,
  group: 'heroes',
  label,
  secs: 70,
  rev: o.rev ?? 2,
  try: tryLine,
  setup: { kind: 'fight', hero, stars: 2, act: 1, waves, stacks: 1 },
  profile: { tips: KIT_TIP[hero] && !o.skills ? [KIT_TIP[hero]!] : [], ...(o.skills ? { skills: { [hero]: o.skills }, level: 8 } : {}) },
});

/** Two companions side by side (the Companion Perch) with Rowan: four waves at Act 2's numbers. */
const petFight = (id: string, pets: [CompanionId, CompanionId], label: string, tryLine: string, waves: string[][], bar?: BarRules): LabScenario => ({
  id,
  group: 'companions',
  label,
  secs: 50,
  rev: 2,
  try: tryLine,
  setup: { kind: 'fight', hero: 'rowan', stars: 2, pets, act: 1, waves, bar },
  profile: { camp: PERCH, pets, petsOn: pets },
});

/** A bar rule alone against the Training Dummy (nothing hurts), its first-meeting tip on (playtest round 6: the
 *  lab had every tip seen, so the rule came with no word on what it does). */
const barRule = (id: string, label: string, tryLine: string, bar: BarRules, tips: TipId[]): LabScenario => ({
  id,
  group: 'bar',
  label,
  secs: 30,
  rev: 1,
  try: tryLine,
  setup: { kind: 'fight', hero: 'rowan', act: 0, waves: [['dummy']], bar, safe: true },
  profile: { tips },
});

/** This session's new content (playtest round 7: numbers, tips, map sprites and the completion tracker that stay
 *  fixed; the anti-spam balance; a unique finisher per hero; the sharper chest reveal; the companions screen).
 *  Reworked items carry a new rev: a rating given to their earlier version shows as "Reworked" with the old rating. */
export const LAB_NEW: LabScenario[] = [
  // ---- tips and completion
  // Act 1's first fight with the fight's tips fresh (tips on, every other tip seen): the five basics in order
  {
    id: 'tipsFirstFight',
    group: 'fights',
    label: 'Tips: first fight',
    secs: 60,
    try: 'Tap to begin at once. Do the tips come in order?',
    setup: { kind: 'fight', hero: 'rowan', act: 0, waves: [['slime'], ['crow'], ['boar']], row: 0 },
    profile: { tips: [...FIRST_FIGHT, 'special', 'comboBreak'] },
  },
  // the region card reworked (rev 2): every one of the 15 a seal or a socket, the map pans, one count everywhere
  { id: 'completionNear', group: 'camp', label: 'Completion: almost', secs: 30, rev: 2, try: "Count the seals: what's left? Drag the map.", setup: { kind: 'camp', screen: 'completion' }, profile: { completion: 'near' } },
  // (a region at 100% means the next one is reached: the progress screen names it, so these wait behind spoilers)
  { id: 'completionDone', group: 'spoiler', spoiler: true, label: 'Completion: 100%', secs: 30, rev: 2, try: 'All 15 seals lit? Claim the reward.', setup: { kind: 'camp', screen: 'completion' }, profile: { completion: 'done' } },
  { id: 'completionAll', group: 'spoiler', spoiler: true, label: 'Completion: all', secs: 45, try: 'Every region at 100%: check each tab, drag each map.', setup: { kind: 'camp', screen: 'completion' }, profile: { completion: 'all' } },
];

/** Earlier sessions' items (still playable; rated before): round 6's heroes, companions, menus, chests and bar rules,
 *  the first region's Act 1 fight and the later regions (spoilers). */
export const LAB_EARLIER: LabScenario[] = [
  // ======== playtest round 6 (the overnight polish run): rated last round
  // ---- heroes: each kit reworked or made easier to see (rev 2), the how-to card first
  heroFight('sable', 'sable', 'Sable', 'Perfect: you dash, then slow. Tap the next one.', [['shaman', 'archer'], ['wolf', 'wolf'], ['shaman', 'boar'], ['bandit', 'crow'], ['archer', 'shaman'], ['knight', 'shaman']]),
  heroFight('neve', 'neve', 'Neve', 'Block reds to freeze them. Swipe: freeze all.', [['wolf', 'wolf'], ['boar', 'crow'], ['beetle', 'archer'], ['wolf', 'wolf', 'shaman'], ['boar', 'bandit'], ['knight', 'wolf']]),
  heroFight('moss', 'moss', 'Moss', 'Greens call allies. Watch what each one does.', [['slime', 'slime'], ['shaman', 'slime'], ['wolf', 'crow'], ['boar', 'slime'], ['archer', 'slime'], ['bigSlime', 'shaman']]),
  heroFight('tam', 'tam', 'Tam', 'Hit the kegs: each blasts every foe.', [['beetle', 'archer'], ['wolf', 'wolf', 'archer'], ['beetle', 'boar'], ['wolf', 'wolf', 'shaman'], ['crow', 'crow', 'bandit'], ['knight', 'beetle']]),
  heroFight('hollis', 'hollis', 'Hollis', 'Every block hits back. Fill Guard: Bulwark!', [['boar', 'archer'], ['bandit', 'boar'], ['wolf', 'wolf'], ['beetle', 'boar'], ['archer', 'bandit'], ['bigSlime', 'boar']]),
  heroFight('vesper', 'vesper', 'Vesper', 'Fill Focus, then hit a target green.', [['crow', 'crow'], ['archer', 'crow'], ['wolf', 'wolf'], ['boar', 'crow'], ['crow', 'shaman'], ['knight', 'archer']]),
  heroFight('torva', 'torva', 'Torva', 'Green, then hit: a smash. More combo, bigger smash.', [['boar', 'bandit'], ['wolf', 'wolf'], ['beetle', 'boar'], ['bandit', 'archer'], ['boar', 'boar'], ['knight', 'wolf']]),
  // ---- the two new skill-tree options, already learned
  heroFight('neveBigFreeze', 'neve', 'Neve: Big Freeze', 'Swipe: every red turns to ice. Shatter it.', [['wolf', 'wolf'], ['boar', 'archer'], ['beetle', 'crow'], ['wolf', 'shaman'], ['boar', 'bandit'], ['knight', 'wolf']], { rev: 0, skills: ['bigFreeze'] }),
  heroFight('tamTurnabout', 'tam', 'Tam: Turnabout', 'Swipe: every red turns into a keg.', [['beetle', 'archer'], ['wolf', 'wolf'], ['boar', 'archer'], ['wolf', 'shaman'], ['crow', 'bandit'], ['knight', 'beetle']], { rev: 0, skills: ['turnabout'] }),

  // ---- companions: each one's effect now shows on what it touches (rev 2)
  petFight('petsPipBun', ['pip', 'bun'], 'Pip + Bun', 'Bun: every 10th hit pops a coin.', [['bandit', 'slime'], ['shaman', 'crow'], ['archer', 'beetle'], ['bandit', 'shaman']]),
  petFight('petsNewtSprocket', ['newt', 'sprocket'], 'Newt + Sprocket', 'Newt sets foes on fire. Watch it burn.', [['slime', 'crow'], ['boar', 'bandit'], ['beetle', 'archer'], ['shaman', 'boar']]),
  petFight('petsBrickFlurry', ['brick', 'flurry'], 'Brick + Flurry', 'Let a red through: Brick stops it. Flurry chills.', [['boar', 'crow'], ['bandit', 'boar'], ['archer', 'beetle'], ['boar', 'archer']]),
  petFight('petsMoteSunny', ['mote', 'sunny'], 'Mote + Sunny', 'Combo 15: a star. Combo 25: fire.', [['bandit', 'shaman'], ['bandit', 'slime'], ['archer', 'shaman'], ['beetle', 'bandit']], {
    ice: { every: 9, width: 0.2, life: 6, fromRow: 0, max: 1 },
  }),

  // ---- Act 2's foes are tougher now (more HP each)
  { id: 'foesAct2', group: 'fights', label: 'Tougher foes: Act 2', secs: 60, rev: 2, try: 'A late Act 2 fight: tougher foes now.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 1, waves: [['beetle', 'archer'], ['shaman', 'bandit'], ['crow', 'archer'], ['beetle', 'shaman'], ['archer'], ['beetle']], row: 5 } },

  // ---- chests: new art, a build-up to the reveal (tap to speed it up), open all; the shrine as a place
  { id: 'chestDemo', group: 'chests', label: 'Chest rarities', secs: 60, try: 'Rare to Divine, one after another.', setup: { kind: 'camp', screen: 'chestDemo', tiers: ['rare', 'epic', 'legendary', 'mythic', 'divine'], chest: 'rare' }, profile: { actsCleared: 1 } },
  { id: 'chestOpenAll', group: 'chests', label: 'Open all', secs: 40, try: 'Tap Open all. Tap to speed it up.', setup: { kind: 'camp', screen: 'chest' }, profile: { actsCleared: 1, chests: { hero: 2, rare: 1 } } },
  { id: 'shrine', group: 'chests', label: 'Shrine and pity', secs: 30, rev: 1, try: 'Open two chests at the altar. Watch the vial.', setup: { kind: 'camp', screen: 'shrine' }, profile: { actsCleared: 2, shrineChests: 2, pityLeft: 3 } },

  // ---- the camp's screens, redesigned
  {
    id: 'heroSelect',
    group: 'camp',
    label: 'Hero select',
    secs: 30,
    rev: 1,
    try: 'Swipe through the heroes. Tap a kit card. Pick one.',
    setup: { kind: 'camp', screen: 'heroes', hero: 'tam' },
    profile: { actsCleared: 2, heroes: { rowan: 2, sable: 3, moss: 1, tam: 4, hollis: 2 } },
  },
  {
    id: 'skillTrees',
    group: 'camp',
    label: 'Skill trees',
    secs: 30,
    rev: 1,
    try: 'Learn a few nodes. Watch the path light up.',
    setup: { kind: 'camp', screen: 'skills', hero: 'moss' },
    profile: { actsCleared: 2, heroes: { moss: 1, torva: 1 }, hero: 'moss', level: 10 },
  },
  {
    id: 'companions',
    group: 'camp',
    label: 'Companions',
    secs: 30,
    rev: 1,
    try: 'Read each one. Bring two along.',
    setup: { kind: 'camp', screen: 'companions' },
    profile: { actsCleared: 2, camp: PERCH, pets: ['pip', 'bun', 'newt', 'brick', 'mote', 'sunny'], petsOn: ['pip'] },
  },
  {
    id: 'campUpgrades',
    group: 'camp',
    label: 'Camp upgrades',
    secs: 30,
    rev: 1,
    try: 'Tap a hammer: build it. Tap a locked one.',
    setup: { kind: 'camp', screen: 'upgrades' },
    profile: { actsCleared: 2, mastery: ['rowanActs3'], coins: 1500 },
  },

  // ---- the bar rules, now with their first-meeting tip
  barRule('barIce', 'Ice patches', 'The cursor speeds up on ice: tap early.', { ice: { every: 5, width: 0.22, life: 6, fromRow: 0, max: 2 } }, ['ice']),
  barRule('barHolds', 'Hold blocks', 'Hold from the first notch to the last.', { holds: { share: 0.3, fromRow: 0, width: 1 } }, ['hold']),
  barRule(
    'barSnow',
    'Snowdrifts + ice',
    'Fast on ice, slow in snow: re-time.',
    {
      ice: { every: 6, width: 0.2, life: 6, fromRow: 0, max: 2 },
      snow: { every: 7, width: 0.2, life: 6, fromRow: 0, max: 1 },
    },
    ['ice', 'snow'],
  ),

  // ======== earlier rounds
  // the single chests (Open all in New plays both kinds; these were rated last round, so they ask again too)
  { id: 'chestHero', group: 'chests', label: 'Hero chest', secs: 30, rev: 1, try: 'Open the hero chest.', setup: { kind: 'camp', screen: 'chest' }, profile: { actsCleared: 1, chests: { hero: 1 } } },
  { id: 'chestRare', group: 'chests', label: 'Rare chest', secs: 30, rev: 1, try: 'Open the Rare chest.', setup: { kind: 'camp', screen: 'chest' }, profile: { actsCleared: 1, chests: { rare: 1 } } },
  { id: 'foesAct1', group: 'fights', label: 'More foes: Act 1', secs: 45, try: 'A late Act 1 fight: five waves now.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 0, waves: [['bandit'], ['slime', 'crow'], ['boar', 'slime'], ['bandit', 'crow'], ['boar']], row: 5 } },

  // ---- spoilers (hidden by default): the next region's foes, mini-bosses, boss and story, by act number only
  { id: 'spAct4', group: 'spoiler', spoiler: true, label: 'Act 4 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 3, waves: [['rimeImp', 'yetiCub'], ['icicleBat', 'icicleBat'], ['snowOgre']], bar: 'act', row: 3 } },
  { id: 'spMini4', group: 'spoiler', spoiler: true, label: 'Act 4 mini-boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 3, waves: [['rimehorn']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct5', group: 'spoiler', spoiler: true, label: 'Act 5 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 4, waves: [['frostWeaver', 'iceWraith'], ['hailcaller', 'rimeImp'], ['glacierTortoise']], bar: 'act', row: 3 } },
  { id: 'spMini5', group: 'spoiler', spoiler: true, label: 'Act 5 mini-boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 4, waves: [['matron']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct6', group: 'spoiler', spoiler: true, label: 'Act 6 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 5, waves: [['driftTroll', 'auroraWisp'], ['frostWeaver', 'hailcaller'], ['frostKnight']], bar: 'act', row: 3 } },
  { id: 'spBoss6', group: 'spoiler', spoiler: true, label: 'Act 6 boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 5, waves: [['glacia']], bar: 'act', row: 6, safe: true } },
  { id: 'spStory4', group: 'spoiler', spoiler: true, label: 'Act 4 story', secs: 60, try: 'Read the scenes.', setup: { kind: 'story', act: 3, scenes: ['frost1', 'rimehorn', 'neveJoin'] } },
  { id: 'spStory5', group: 'spoiler', spoiler: true, label: 'Act 5 story', secs: 45, try: 'Read the scenes.', setup: { kind: 'story', act: 4, scenes: ['frost2', 'matron'] } },
  { id: 'spStory6', group: 'spoiler', spoiler: true, label: 'Act 6 story', secs: 90, try: 'Read the scenes.', setup: { kind: 'story', act: 5, scenes: ['frost3', 'glacia', 'glacia2', 'glacia3', 'frostVictory'] } },
  { id: 'spArrivals', group: 'spoiler', spoiler: true, label: 'Hero arrivals', secs: 60, try: 'Read how each chest hero arrives.', setup: { kind: 'story', act: 1, scenes: ['meetMoss', 'meetTam', 'meetHollis', 'meetVesper', 'meetTorva'] } },
  // ---- spoilers: the third region (acts 7-9): its two bar rules, foes, mini-bosses, boss and story
  { id: 'spBar7', group: 'spoiler', spoiler: true, rev: 1, label: 'Act 7 bar rule', secs: 45, try: 'Watch the blocks move. Nothing hurts.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 6, waves: [['dummy']], bar: { drift: { share: 0.6, fromRow: 0, speed: 0.07 } }, safe: true }, profile: { tips: ['drift'] } },
  { id: 'spBar8', group: 'spoiler', spoiler: true, rev: 1, label: 'Act 8 bar rule', secs: 45, try: 'Hit one, then the other. Nothing hurts.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 7, waves: [['dummy']], bar: { links: { share: 0.5, fromRow: 0 } }, safe: true }, profile: { tips: ['pair'] } },
  { id: 'spAct7', group: 'spoiler', spoiler: true, label: 'Act 7 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 6, waves: [['cinderling', 'cragCrab'], ['cinderKite', 'cinderKite'], ['obsidianOx']], bar: 'act', row: 3 } },
  { id: 'spMini7', group: 'spoiler', spoiler: true, label: 'Act 7 mini-boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 6, waves: [['rumbleback']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct8', group: 'spoiler', spoiler: true, label: 'Act 8 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 7, waves: [['glassblower', 'prismBat'], ['glassMantis', 'cinderKite'], ['kilnWarden']], bar: 'act', row: 3 } },
  { id: 'spMini8', group: 'spoiler', spoiler: true, label: 'Act 8 mini-boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 7, waves: [['hobnob']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct9', group: 'spoiler', spoiler: true, label: 'Act 9 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 8, waves: [['stokerImp', 'forgeHand'], ['magmaEel', 'glassblower'], ['chainSentinel']], bar: 'act', row: 3 } },
  { id: 'spBoss9', group: 'spoiler', spoiler: true, label: 'Act 9 boss', secs: 90, try: 'No damage here: watch its moves.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 8, waves: [['bellows']], bar: 'act', row: 6, safe: true } },
  { id: 'spStory7', group: 'spoiler', spoiler: true, label: 'Act 7 story', secs: 60, try: 'Read the scenes.', setup: { kind: 'story', act: 6, scenes: ['ash1', 'rumbleback', 'magsTale'] } },
  { id: 'spStory8', group: 'spoiler', spoiler: true, label: 'Act 8 story', secs: 45, try: 'Read the scenes.', setup: { kind: 'story', act: 7, scenes: ['ash2', 'hobnob'] } },
  { id: 'spStory9', group: 'spoiler', spoiler: true, label: 'Act 9 story', secs: 90, try: 'Read the scenes.', setup: { kind: 'story', act: 8, scenes: ['ash3', 'bellows', 'bellows2', 'bellows3', 'ashVictory'] } },
];


export const LAB_SCENARIOS: LabScenario[] = [...LAB_NEW, ...LAB_EARLIER];

export const labScenario = (id: string): LabScenario | undefined => LAB_SCENARIOS.find((s) => s.id === id);
