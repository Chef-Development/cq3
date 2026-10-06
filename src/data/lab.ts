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
import type { BarRules } from './types';

export type LabGroupId = 'heroes' | 'companions' | 'chests' | 'camp' | 'bar' | 'spoiler';

/** The list's groups, in order. The spoiler group is hidden until "Show spoilers". */
export const LAB_GROUPS: Array<{ id: LabGroupId; name: string; spoiler?: boolean }> = [
  { id: 'heroes', name: 'Heroes' },
  { id: 'companions', name: 'Companions' },
  { id: 'chests', name: 'Chests and shrine' },
  { id: 'camp', name: 'Camp' },
  { id: 'bar', name: 'Bar rules' },
  { id: 'spoiler', name: 'Spoilers', spoiler: true },
];

/** A camp screen a scenario opens. */
export type LabScreen = 'heroes' | 'skills' | 'chest' | 'shrine' | 'companions' | 'upgrades' | 'completion';

/** What a scenario drops the playtester into. */
export type LabSetup =
  /** A practice fight (no rewards, nothing saved): the hero at `act` (acts are global: 3-5 are Region 2's) with
   *  `stars`, these companions, these waves of foes, the bar rules ('act': the act's own), `stacks` finisher stacks
   *  banked at the start; `safe`: nothing hurts the hero. */
  | { kind: 'fight'; hero: HeroId; stars?: number; pets?: CompanionId[]; act: number; waves: string[][]; bar?: BarRules | 'act'; row?: number; safe?: boolean; stacks?: number }
  /** A camp screen (with `hero` shown first where it has one). */
  | { kind: 'camp'; screen: LabScreen; hero?: HeroId }
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
  /** Region 1's completion tracker: one short of 100%, or at 100% with its reward still to claim. */
  completion?: 'near' | 'done';
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
  setup: LabSetup;
  profile?: LabProfileSpec;
}

const PERCH: CampUpgradeId[] = ['perch'];

/** A hero's short fight against Region 1 foes: Old Ruins (Act 2) pace, real damage, two finisher stacks banked. */
const heroFight = (id: string, hero: HeroId, label: string, tryLine: string, stars: number, waves: string[][]): LabScenario => ({
  id,
  group: 'heroes',
  label,
  secs: 40,
  try: tryLine,
  setup: { kind: 'fight', hero, stars, act: 1, waves, stacks: 2 },
});

/** Two companions side by side (the Companion Perch) with Rowan, in a Meadow Road fight. */
const petFight = (id: string, pets: [CompanionId, CompanionId], label: string, tryLine: string, waves: string[][], bar?: BarRules): LabScenario => ({
  id,
  group: 'companions',
  label,
  secs: 30,
  try: tryLine,
  setup: { kind: 'fight', hero: 'rowan', stars: 2, pets, act: 0, waves, bar },
  profile: { camp: PERCH, pets, petsOn: pets },
});

/** A bar rule alone against the Training Dummy (nothing hurts). */
const barRule = (id: string, label: string, tryLine: string, bar: BarRules): LabScenario => ({
  id,
  group: 'bar',
  label,
  secs: 30,
  try: tryLine,
  setup: { kind: 'fight', hero: 'rowan', act: 0, waves: [['dummy']], bar, safe: true },
});

/** This session's new content (M5: heroes, companions, chests and the shrine, camp upgrades, completion, the next
 *  region's bar rules; the region itself behind the spoiler toggle). */
export const LAB_NEW: LabScenario[] = [
  // ---- heroes: each new or reworked hero's kit, finisher ready at once
  heroFight('sable', 'sable', 'Sable', 'Chain Perfects to dash. Green: Smoke Veil. Swipe!', 3, [['shaman', 'archer'], ['shaman', 'bandit']]),
  heroFight('neve', 'neve', 'Neve', 'Block reds to freeze them, then smash the ice.', 2, [['crow', 'beetle'], ['wolf', 'wolf']]),
  heroFight('moss', 'moss', 'Moss', 'Greens call allies; a 4th call is a Rally.', 2, [['slime', 'slime'], ['shaman', 'slime']]),
  heroFight('tam', 'tam', 'Tam', 'Hit the kegs: they blast every foe.', 2, [['beetle', 'archer'], ['beetle', 'beetle']]),
  heroFight('hollis', 'hollis', 'Hollis', 'Perfect blocks hit back. Blocks store Guard.', 2, [['boar', 'archer'], ['boar', 'bandit']]),
  heroFight('vesper', 'vesper', 'Vesper', 'Perfects store Focus; a green fires it.', 2, [['crow', 'crow'], ['archer', 'crow']]),
  heroFight('torva', 'torva', 'Torva', 'Green winds up a smash. Perfects push reds.', 3, [['beetle', 'boar'], ['bandit', 'boar']]),

  // ---- companions: all eight, two at a time
  petFight('petsPipBun', ['pip', 'bun'], 'Pip + Bun', 'Pip pecks a trap; Bun finds coins.', [['bandit', 'slime'], ['shaman', 'crow']]),
  petFight('petsNewtSprocket', ['newt', 'sprocket'], 'Newt + Sprocket', 'Newt burns foes; Sprocket widens a Perfect.', [['slime', 'crow'], ['boar', 'bandit']]),
  petFight('petsBrickFlurry', ['brick', 'flurry'], 'Brick + Flurry', 'Let a red through: Brick stops it.', [['boar', 'crow'], ['bandit', 'boar']]),
  petFight('petsMoteSunny', ['mote', 'sunny'], 'Mote + Sunny', 'Build combo: 15 for a star, 25 for fire.', [['bandit', 'shaman'], ['bandit', 'slime']], {
    ice: { every: 9, width: 0.2, life: 6, fromRow: 0, max: 1 },
  }),

  // ---- chests and the shrine (opened at the camp)
  { id: 'chestHero', group: 'chests', label: 'Hero chest', secs: 30, try: 'Open the hero chest at the camp.', setup: { kind: 'camp', screen: 'chest' }, profile: { actsCleared: 1, chests: { hero: 1 } } },
  { id: 'chestRare', group: 'chests', label: 'Rare chest', secs: 30, try: 'Open the Rare chest at the camp.', setup: { kind: 'camp', screen: 'chest' }, profile: { actsCleared: 1, chests: { rare: 1 } } },
  { id: 'shrine', group: 'chests', label: 'Shrine and pity', secs: 30, try: 'Buy two Rare chests. Watch the pity count.', setup: { kind: 'camp', screen: 'shrine' }, profile: { actsCleared: 2, shrineChests: 2, pityLeft: 3 } },

  // ---- the camp's new screens
  {
    id: 'heroSelect',
    group: 'camp',
    label: 'Hero select',
    secs: 30,
    try: 'Browse the heroes, then pick a new one.',
    setup: { kind: 'camp', screen: 'heroes', hero: 'tam' },
    profile: { actsCleared: 3, heroes: { rowan: 2, sable: 3, moss: 1, tam: 4, hollis: 2 } },
  },
  {
    id: 'skillTrees',
    group: 'camp',
    label: 'Skill trees',
    secs: 30,
    try: "Spend a new hero's skill points.",
    setup: { kind: 'camp', screen: 'skills', hero: 'moss' },
    profile: { actsCleared: 2, heroes: { moss: 1, torva: 1 }, hero: 'moss', level: 10 },
  },
  {
    id: 'companions',
    group: 'camp',
    label: 'Companions',
    secs: 30,
    try: 'Bring two companions along.',
    setup: { kind: 'camp', screen: 'companions' },
    profile: { actsCleared: 3, camp: PERCH, pets: ['pip', 'bun', 'newt', 'brick', 'mote', 'sunny'], petsOn: ['pip'] },
  },
  {
    id: 'campUpgrades',
    group: 'camp',
    label: 'Camp upgrades',
    secs: 30,
    try: 'Buy an upgrade. Check a locked one.',
    setup: { kind: 'camp', screen: 'upgrades' },
    profile: { actsCleared: 2, mastery: ['rowanActs3'], coins: 1500 },
  },
  { id: 'completionNear', group: 'camp', label: 'Completion: almost', secs: 30, try: "Check what's left for 100%.", setup: { kind: 'camp', screen: 'completion' }, profile: { actsCleared: 3, completion: 'near' } },
  { id: 'completionDone', group: 'camp', label: 'Completion: 100%', secs: 30, try: 'Claim the 100% reward.', setup: { kind: 'camp', screen: 'completion' }, profile: { actsCleared: 3, completion: 'done' } },

  // ---- the new bar rules, alone against the Training Dummy
  barRule('barIce', 'Ice patches', 'The cursor speeds up on ice: tap early.', { ice: { every: 5, width: 0.22, life: 6, fromRow: 0, max: 2 } }),
  barRule('barHolds', 'Hold blocks', 'Hold from the first notch to the last.', { holds: { share: 0.3, fromRow: 0, width: 1 } }),
  barRule('barSnow', 'Snowdrifts + ice', 'Fast on ice, slow in snow: re-time.', {
    ice: { every: 6, width: 0.2, life: 6, fromRow: 0, max: 2 },
    snow: { every: 7, width: 0.2, life: 6, fromRow: 0, max: 1 },
  }),

  // ---- spoilers (hidden by default): the next region's foes, mini-bosses, boss and story, by act number only
  { id: 'spAct4', group: 'spoiler', spoiler: true, label: 'Act 4 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 3, waves: [['rimeImp', 'yetiCub'], ['icicleBat', 'icicleBat'], ['snowOgre']], bar: 'act', row: 3 } },
  { id: 'spMini4', group: 'spoiler', spoiler: true, label: 'Act 4 mini-boss', secs: 90, try: 'No damage here: see every move.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 3, waves: [['rimehorn']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct5', group: 'spoiler', spoiler: true, label: 'Act 5 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 4, waves: [['frostWeaver', 'iceWraith'], ['hailcaller', 'rimeImp'], ['glacierTortoise']], bar: 'act', row: 3 } },
  { id: 'spMini5', group: 'spoiler', spoiler: true, label: 'Act 5 mini-boss', secs: 90, try: 'No damage here: see every move.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 4, waves: [['matron']], bar: 'act', row: 6, safe: true } },
  { id: 'spAct6', group: 'spoiler', spoiler: true, label: 'Act 6 foes', secs: 90, try: "Meet the act's foes and their moves.", setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 5, waves: [['driftTroll', 'auroraWisp'], ['frostWeaver', 'hailcaller'], ['frostKnight']], bar: 'act', row: 3 } },
  { id: 'spBoss6', group: 'spoiler', spoiler: true, label: 'Act 6 boss', secs: 90, try: 'No damage here: see all three phases.', setup: { kind: 'fight', hero: 'rowan', stars: 2, act: 5, waves: [['glacia']], bar: 'act', row: 6, safe: true } },
  { id: 'spStory4', group: 'spoiler', spoiler: true, label: 'Act 4 story', secs: 60, try: 'Read the scenes.', setup: { kind: 'story', act: 3, scenes: ['frost1', 'rimehorn', 'neveJoin'] } },
  { id: 'spStory5', group: 'spoiler', spoiler: true, label: 'Act 5 story', secs: 45, try: 'Read the scenes.', setup: { kind: 'story', act: 4, scenes: ['frost2', 'matron'] } },
  { id: 'spStory6', group: 'spoiler', spoiler: true, label: 'Act 6 story', secs: 90, try: 'Read the scenes.', setup: { kind: 'story', act: 5, scenes: ['frost3', 'glacia', 'glacia2', 'glacia3', 'frostVictory'] } },
  { id: 'spArrivals', group: 'spoiler', spoiler: true, label: 'Hero arrivals', secs: 60, try: 'Read how each chest hero arrives.', setup: { kind: 'story', act: 1, scenes: ['meetMoss', 'meetTam', 'meetHollis', 'meetVesper', 'meetTorva'] } },
];

/** Earlier sessions' items (still playable; rated before). Empty until the next session moves LAB_NEW here. */
export const LAB_EARLIER: LabScenario[] = [];

export const LAB_SCENARIOS: LabScenario[] = [...LAB_NEW, ...LAB_EARLIER];

export const labScenario = (id: string): LabScenario | undefined => LAB_SCENARIOS.find((s) => s.id === id);
