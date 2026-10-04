// Content types. src/data holds the game's content as plain data (enemies and their special moves, the
// region's acts and encounters, events, story scenes); src/core reads it. No logic and no imports here.

/** Block codes for an enemy's base pattern: Y yellow attack, G green attack + ability, R red enemy attack,
 *  S shield red (2 taps), B bomb red, F speed red, P purple trap. */
export type BlockCode = 'Y' | 'G' | 'R' | 'S' | 'B' | 'F' | 'P';

/** Every block kind a special can place (adds 'spore', a heal block, and 'ward', a shell block). */
export type FormationKind = 'yellow' | 'green' | 'red' | 'shield' | 'bomb' | 'speed' | 'purple' | 'spore' | 'ward';

/** One block of a formation. Reds come in from the right end unless `at` says where; other kinds go to a free
 *  spot unless `at` or `beside` says where. */
export interface FormationEntry {
  kind: FormationKind;
  at?: number; // bar position (0..1) of the block's center
  beside?: 'yellow'; // placed touching a yellow block (one is added first if none has room)
  delay?: number; // seconds after the action fires
  width?: number; // times the kind's base width
  speed?: number; // reds: times the normal travel speed
  taps?: number; // shields: taps needed
  life?: number; // seconds before it expires (spores)
  heal?: number; // spores: share of max HP the enemy and its allies heal if it expires unbroken
  pair?: boolean; // reds: placed right in front of the previous entry, so the two arrive together
  partner?: boolean; // sent by a living ally of the same kind (a wolf's pack mate), if there is one
}

/** What a special does once its telegraph is over. Every action is reusable by any enemy. */
export type ActionDef =
  | { type: 'formation'; blocks: FormationEntry[] } // spawn a block formation
  | { type: 'heal'; target: 'self' | 'allies' | 'all'; frac: number } // heal (share of each one's max HP)
  | { type: 'shell'; target: 'self' | 'ally'; mult: number; blocks: number } // attack hits deal `mult` until its ward blocks are broken
  | { type: 'summon'; enemies: string[]; link?: boolean } // new enemies join (linked ones flee if the summoner falls)
  | { type: 'split'; into: string; count: number; hpFrac: number } // replaced by `count` smaller enemies
  | { type: 'cursor'; freeze?: number; minSpeed?: number } // freeze the cursor for a moment / floor its speed for the rest of the fight
  | { type: 'guard'; sec: number } // shield raised: tapping yellow is countered like a purple trap
  | { type: 'phase'; phase: number } // a boss enters its next phase
  | { type: 'protect'; mult: number }; // takes `mult` damage while its linked summons live

export interface SpecialDef {
  id: string;
  name: string; // shown over the enemy while it telegraphs ("Charge!")
  tell: number; // telegraph wind-up, seconds (0.6-1.0: long enough to glance up and read it)
  sound: string; // telegraph sound (engine/audio.ts TellSound)
  first?: number; // timed specials: seconds into the fight before the first use...
  every?: number; // ...and between uses
  hpBelow?: number; // instead of a timer: fires once when HP drops below this share
  gate?: boolean; // with hpBelow: damage can't take the enemy past this threshold before it fires (boss phases)
  phases?: number[]; // only in these boss phases (default: every phase)
  actions: ActionDef[];
}

export interface EnemyDef {
  name: string;
  hp: number;
  atk: number; // damage when one of its red blocks reaches the left end
  special: number; // damage when the player taps one of its purple traps (or is countered by its guard)
  interval: number; // seconds between spawns from its pattern
  pattern: string; // block codes, cycled in order
  icon: 'drop' | 'tusk' | 'mask' | 'wing' | 'arrow' | 'spore' | 'shell' | 'fang' | 'leaf' | 'rune' | 'crown';
  sprite: string; // texture prefix (engine/art.ts, engine/art-foes.ts)
  coins: number; // dropped when it dies
  boss?: boolean; // mini-bosses and the boss: crown in the HUD, boss music, a guaranteed rare reward
  elite?: boolean;
  fly?: number; // hovers this many px above the ground
  specials: SpecialDef[];
  phaseScenes?: Record<number, string>; // story scene shown when a boss enters a phase
}

export type NodeType = 'fight' | 'elite' | 'treasure' | 'rest' | 'shop' | 'event' | 'boss';
export type Theme = 'forest' | 'ruins' | 'hollow';

export interface ActDef {
  name: string;
  theme: Theme;
  hpMult: number; // enemy HP in this act is scaled by this...
  atkMult: number; // ...and enemy attack (and trap) damage by this
  rows: number; // map rows before the boss row
  fights: { early: string[][]; late: string[][] }; // early: the first 3 rows
  elites: string[][];
  boss: string[];
  startScene?: string;
  bossScene?: string;
  /** How likely each node type is on the map (the generator then makes sure each appears at least once). */
  weights: Record<Exclude<NodeType, 'boss'>, number>;
}

export interface RegionDef {
  name: string;
  introScene: string;
  victoryScene: string;
  acts: ActDef[];
}

export type Speaker = 'narrator' | 'rowan' | 'pip' | 'captain' | 'golem' | 'boarking';

/** One text box: at most two lines (a '\n' splits them). */
export interface StoryBox {
  who: Speaker;
  text: string;
}

export interface EventOutcome {
  chance?: number; // relative weight among the choice's outcomes (default 1)
  text: string; // what happened (one or two lines)
  coins?: number;
  hp?: number; // flat HP change (a loss never takes the hero below 1)
  heal?: number; // share of max HP healed
  maxHp?: number;
  atk?: number;
  pet?: number; // Pip's peck damage
  boost?: 'common' | 'rare' | 'epic'; // a boost card pick follows
}

export interface EventChoice {
  label: string;
  cost?: number; // coins needed (and spent)
  outcomes: EventOutcome[];
}

export interface EventDef {
  id: string;
  title: string;
  text: string; // two lines at most
  choices: EventChoice[];
}
