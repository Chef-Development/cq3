// Content types. src/data holds the game's content as plain data (enemies and their special moves, the
// region's acts and encounters, events, story scenes); src/core reads it. No logic and no imports here.

/** Block codes for an enemy's base pattern: Y yellow attack, G green attack + ability, R red enemy attack,
 *  S shield red (2 taps), B bomb red, F speed red, P purple trap. */
export type BlockCode = 'Y' | 'G' | 'R' | 'S' | 'B' | 'F' | 'P';

/** Every block kind a special can place (adds 'spore', a heal block, 'ward', a shell block, and 'hold', a frozen block
 *  you hold your finger on from its start to its end). */
export type FormationKind = 'yellow' | 'green' | 'red' | 'shield' | 'bomb' | 'speed' | 'purple' | 'spore' | 'ward' | 'hold';

/** What kind of foe an enemy is: heroes' soft strengths are edges against some of these. */
export type FoeTag = 'folk' | 'beast' | 'flyer' | 'caster' | 'armored' | 'construct' | 'swarm' | 'brute' | 'frost' | 'fire';

/** A patch on the bar that changes the cursor's speed while it's inside: ice speeds it up, snowdrifts slow it. */
export type ZoneKind = 'ice' | 'snow';

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
  spot?: 'random' | 'ahead'; // where it lands, chosen (and marked on the bar) when the action fires: anywhere, or where the cursor is heading
  still?: boolean; // reds: sits where it lands instead of travelling...
  fuse?: number; // ...and strikes after this many seconds unless blocked
  grow?: number; // reds: widens by this share of its width per second as it travels (up to x2)
  trail?: ZoneKind; // reds: leaves a patch over the stretch of bar it crossed when it's gone
  // Region 3 (not in play yet: needs core; docs/content-bible.md section 6)
  drift?: number; // yellows: placed drifting along the bar at this speed (bar widths a second)
  link?: boolean; // yellows: this entry and the next `link` entry come as a linked pair
  // Region 4 (docs/content-bible.md section 7)
  dark?: boolean; // yellows, greens, traps: placed dark (unlit until the cursor's lantern reaches it)
  // Region 5 (docs/content-bible.md section 8)
  mirage?: boolean; // yellows: placed as a mirage (it hops to another spot now and then, its landing spot shown first)
  blaze?: boolean; // yellows: placed blazing (a hit on it lands harder, but gives the hero Heat)
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
  | { type: 'protect'; mult: number } // takes `mult` damage while its linked summons live
  | { type: 'zone'; kind: ZoneKind; width: number; life: number; at?: number | 'ahead'; count?: number } // lay patches on the bar (life 0 = until the phase ends)
  | { type: 'zoneShift'; speed: number; sec: number } // every patch on the bar slides along it for a while
  | { type: 'toHold'; count: number; width?: number } // yellows on the bar become holds
  | { type: 'mirror'; at?: number | 'ahead'; life: number; every?: number } // a mirror shard: the cursor bounces back when it reaches it
  | { type: 'armor'; count: number; taps: number } // yellows on the bar get an ice coat: they take `taps` taps
  | { type: 'barRule'; holdEvery: number; driftEvery?: number; linkEvery?: number; darkEvery?: number; blazeEvery?: number } // from now on every Nth yellow this foe sends is a hold (0 = none); Region 3: ...drifts, ...comes as a linked pair; Region 4: ...comes dark; Region 5: ...blazes
  | { type: 'stripes'; count: number; life: number; speed?: number } // the bar becomes alternating stripes of ice and snowdrift
  // Region 3 (not in play yet: needs core; docs/content-bible.md section 6)
  | { type: 'toDrift'; count: number; speed: number; sec?: number } // up to `count` yellows on the bar (0 = every one) drift at `speed` for `sec` s (none = for good)
  | { type: 'toLink'; count: number; drift?: number } // up to `count` pairs of yellows on the bar are chained into linked pairs (drifting together at `drift`, if set)
  | { type: 'driftShift'; mult?: number; flip?: boolean; sec?: number } // every drifting block turns around (`flip`) and/or moves `mult` x as fast for `sec` s (none = for good; mult 0 = they settle)
  // Region 4 (docs/content-bible.md section 7)
  | { type: 'darken'; count: number } // up to `count` yellows on the bar outside the lantern's light go dark (they keep their kind)
  | { type: 'snuff'; mult: number; sec: number } // the lantern dims (its reach x `mult`, never below dark.floorSec) for `sec` s (0 = for good); lit dark blocks outside it go dark again
  | { type: 'tide'; level: number; sec: number; from?: TideFrom } // a surge: the water rises to `level` (share of the bar, at most 0.5) from `from` (default: the act's end, else the right) and holds `sec` s (0 = for good, a flood)
  // Region 5 (docs/content-bible.md section 8)
  | { type: 'hop'; count: number } // up to `count` yellows on the bar (0 = every one) become mirages and hop soon (their landing spots shown first)
  | { type: 'blaze'; count: number }; // up to `count` yellows on the bar (0 = every one) start blazing

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
  icon: 'drop' | 'tusk' | 'mask' | 'wing' | 'arrow' | 'spore' | 'shell' | 'fang' | 'leaf' | 'rune' | 'crown' | 'sack';
  tags?: FoeTag[]; // what kind of foe it is (heroes' soft strengths)
  sprite: string; // texture prefix (engine/art.ts, engine/art-foes.ts)
  coins: number; // dropped when it dies
  boss?: boolean; // mini-bosses and the boss: crown in the HUD, boss music, a guaranteed rare reward
  elite?: boolean;
  fly?: number; // hovers this many px above the ground
  specials: SpecialDef[];
  phaseScenes?: Record<number, string>; // story scene shown when a boss enters a phase
}

/** Node types. 'rush' (Coin Rush, the mini-game) and 'bounty' (a side quest's notice board) are placed on the map
 *  after it is built (core/roam.ts), not by the act's weights. */
export type NodeType = 'fight' | 'elite' | 'treasure' | 'rest' | 'shop' | 'event' | 'boss' | 'rush' | 'bounty';
/** The node types the map generator rolls from an act's weights. */
export type RolledNode = Exclude<NodeType, 'boss' | 'rush' | 'bounty'>;
/** An act's look: Greenmarch's meadow, ruins and hollow; the Frostpeaks' mountain pass, ice caves and glacier;
 *  Ashfell's cinder flats, glass warrens and black forge (not in play yet). */
export type Theme = 'forest' | 'ruins' | 'hollow' | 'pass' | 'caves' | 'glacier' | 'cinder' | 'glass' | 'forge' | 'fen' | 'causeway' | 'mere';

export interface ActDef {
  name: string;
  theme: Theme;
  hpMult: number; // enemy HP in this act is scaled by this...
  atkMult: number; // ...and enemy attack (and trap) damage by this
  pace: number; // enemies' spawn intervals are scaled by this (<1 = a busier bar)
  /** Enemy reds (shields, bombs, speed blocks) cross the bar this much faster (1 = 2.8 s): fewer passes of the cursor
   *  to block each, so a skilled player gets hit in later acts too. */
  redSpeed: number;
  rows: number; // map rows before the boss row
  /**
   * A fight node's foes come in waves, one after another ("foe 3/7"): `first` waves in the first row, ramping to
   * `last` in the row before the boss. An elite comes after `eliteEscort` waves of ordinary foes; the boss alone.
   * Each wave is one group from the fight pools (most are a single enemy).
   */
  waves: { first: number; last: number; eliteEscort: number };
  fights: { early: string[][]; late: string[][] }; // early: the first 3 rows
  elites: string[][];
  boss: string[];
  startScene?: string;
  bossScene?: string;
  /** A scene after the act's first fight is won (after its loot and pick, before the map), once per profile: Act 1's
   *  is Pip's road scene (docs/first-10.md). */
  winScene?: string;
  /** How likely each node type is on the map (the generator then makes sure each appears at least once). */
  weights: Record<RolledNode, number>;
  /** A chest offered on this map row whichever way the hero comes (every node of the row before links to one): Act
   *  1's is row 1, so a newcomer's first chest comes right after their first fight (docs/first-10.md). */
  chestRow?: number;
  /**
   * Wandering packs on the act map (core/roam.ts): each pack is one of these, its foes coming as extra waves of an
   * ambush (later acts: tougher packs). How many packs roam an act is tuning (roam.packsFirst / packsLast).
   */
  packs?: string[][][];
  /** The region's bar rules for this act (introduced gradually: each from a map row on). */
  bar?: BarRules;
}

/** Bar rules an act brings to every fight: patches that come and go, and a share of yellows that come as holds. */
export interface BarRules {
  ice?: PatchRule;
  snow?: PatchRule;
  holds?: { share: number; fromRow: number; width: number };
  /** Region 3 (not in play yet): a share of yellows drift slowly along the bar (`speed`: bar widths a second),
   *  turning back at the ends. */
  drift?: { share: number; fromRow: number; speed: number };
  /** Region 3 (not in play yet): a share of yellows come as linked pairs: hit one, then the other within a beat,
   *  or both count as misses. */
  links?: { share: number; fromRow: number };
  /** Region 4: a share of yellows, greens and traps come dark (unlit until the cursor's lantern reaches them); of the
   *  dark yellows, `traps` are traps in disguise. */
  dark?: { share: number; fromRow: number; traps: number };
  /** Region 4: water covers one end of the bar, swelling from `low` to `high` (shares of the bar) and back over
   *  `period` s, starting at low water. Still blocks under it are sunk (out of reach); reds wade (tide.drag). */
  tide?: { fromRow: number; low: number; high: number; period: number; from: TideFrom };
  /** Region 5: a share of yellows are mirages: every `every` s (or so) one hops to another spot on the bar, its
   *  landing spot shown `mirage.warnSec` first, never while the cursor is close to either spot. */
  mirage?: { share: number; fromRow: number; every: number };
  /** Region 5: a share of yellows blaze: a hit on one lands harder but gives the hero a stack of Heat (it burns a
   *  little HP a second for a while; a green cools it). */
  heat?: { share: number; fromRow: number };
}

/** Which end of the bar the water comes from ('both': each end). */
export type TideFrom = 'left' | 'right' | 'both';

export interface PatchRule {
  every: number; // a new patch every this many seconds...
  width: number; // ...this wide (share of the bar)...
  life: number; // ...lasting this long
  fromRow: number; // only from this map row on (0 = every fight)
  max: number; // at most this many at once
}

export interface RegionDef {
  id: string;
  name: string;
  introScene: string;
  victoryScene: string;
  acts: ActDef[];
}

export type Speaker =
  | 'narrator'
  | 'rowan'
  | 'pip'
  // the living-map story (docs/story-bible.md): the Mapmaker and the High Keeper (portraits: art team)
  | 'mapmaker'
  | 'keeper'
  // Region 4's speakers (src/data/story-dusk.ts; portraits: Team 3)
  | 'bellybog'
  | 'sluiceKeeper'
  // Region 5's (src/data/story-noon.ts; portrait: the art for its mini-boss)
  | 'sphinx'
  // Region 6's, drafted ahead (src/data/story-hush.ts)
  | 'hollowfang'
  // Regions 7-8's, drafted ahead (src/data/story-reach.ts, story-wick.ts)
  | 'squall'
  | 'press'
  // Region 9's, drafted ahead (src/data/story-salt.ts)
  | 'gale'
  // the Mapmaker under his own name, from the late beat on (src/data/story-end.ts)
  | 'ambrose'
  | 'captain'
  | 'golem'
  | 'boarking'
  | 'smith'
  | 'sable'
  // M5: the new heroes, and Region 2's speakers (docs/content-bible.md)
  | 'neve'
  | 'moss'
  | 'tam'
  | 'hollis'
  | 'vesper'
  | 'torva'
  // part6:A
  | 'solenne'
  | 'wren'
  // part6:B
  | 'yara'
  | 'dell'
  // part6:C
  | 'gorm'
  | 'tess'
  // part6:D
  | 'fizz'
  | 'brann'
  | 'rimehorn'
  | 'matron'
  | 'glacia'
  // Region 3's speakers (docs/content-bible.md section 6; not in play yet)
  | 'rumbleback'
  | 'hobnob'
  | 'bellows';

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
