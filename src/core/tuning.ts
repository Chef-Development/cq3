// THE tuning file. Every system number lives here; content (enemies and their specials, the region's acts,
// events, story) lives in src/data/ and is pulled in below (enemies, act scaling) so the debug panel can edit
// it live. Numbers were balanced with the headless bot (npm run balance, docs/balance.md).
// The debug panel edits a live copy of this object; "Copy tuning as JSON" exports it.

import { ENEMIES } from '../data/enemies';
import { ALL_ACTS } from '../data/regions';
import { RELICS } from '../data/relics';
import { SKILL_NODES } from '../data/skills';
import type { ActDef } from '../data/types';

export type { BlockCode, EnemyDef, ActDef } from '../data/types';

/** The acts' enemy scaling, as tuned live (structure and encounters stay in src/data/greenmarch.ts). */
export interface ActScale {
  name: string;
  hpMult: number;
  atkMult: number;
  pace: number;
  redSpeed: number;
}

export const DEFAULT_TUNING = {
  cursor: {
    basePassSec: 1.1, // seconds for one left->right pass at base speed
    speedPerHit: 0.02, // +2% speed per combo hit (linear)
    maxSpeedMult: 2.5, // cap on total cursor speed multiplier
    speedBlockBonus: 0.15, // +15% per blocked Speed block, until you take damage
    widthFrac: 0.012, // cursor width as a fraction of the bar
  },
  judge: {
    perfectFrac: 0.3, // central 30% of a block = PERFECT
    graceMs: 20, // extra hit window on each side, in time (at the speed the cursor and the block close at)
    redGraceMs: 40, // the same for blocking red attacks: defending is forgiving, attacking stays sharp
    maxRewindMs: 300, // how far back a tap timestamp may be judged
    missSelfDamage: 1, // Classic mode: damage for tapping empty bar
  },
  blocks: {
    attackWidth: 0.07, // yellow width (fraction of bar); narrow like the reference, timing has to be sharp
    greenWidth: 0.05,
    redWidth: 0.09, // red attacks (and shields, bombs, speed) move, so they stay wider...
    trapWidth: 0.06,
    widthMin: 0.7, // every spawned block's width is its kind's width times a random factor in [widthMin, widthMax]
    widthMax: 1.4,
    redWidthMin: 0.9, // ...and vary less: never thin enough to slip through
    redWidthMax: 1.25,
    redTravelSec: 2.8, // right end -> left end
    impactGraceMs: 60, // red block sits at the left end this long (still blockable) before hitting
    trapLifeSec: 4,
    attackLifeSec: 0, // 0 = yellow/green stay until hit
    frozenLifeSec: 6, // a frozen red melts after this long...
    frozenMult: 2, // ...and shatters for this x a hit's damage
    shieldHits: 2,
    shieldKnockback: 0.2, // a cracked shield is knocked back this fraction of the bar...
    knockbackSec: 0.14, // ...over this long, then resumes its travel
    bombRadius: 0.2, // fraction of bar, measured from the bomb's center
    bombDamage: 40, // to every enemy when a bomb is tapped
    bombHitMult: 1.5, // bomb that reaches you hits this much harder
    maxStatic: 7, // max yellow/green/purple on the bar
    minAttack: 2, // if fewer yellow/green than this are on the bar, add one right away
    maxRed: 3,
    spawnRateMult: 1, // >1 = slower spawns
    groupSpawnMult: 0.8, // spawn interval multiplier when 2+ enemies share the screen (<1 = busier)
    openingSpawns: 3, // yellow blocks placed at the start of a fight
    minGap: 0, // min empty space between static blocks (0 = they may touch)
    edgeMargin: 0.02,
  },
  hero: {
    maxHp: 100,
    atk: 10,
    greenMult: 1.5,
    critChance: 0.05,
    critDmg: 2, // crit damage multiplier
    perfectCritBonus: 0.25, // added crit chance on a PERFECT hit
    abilityCritBonus: 0.1, // Rowan's green ability: +10% crit chance...
    abilitySec: 3, // ...for 3 s
    comboPower: 5, // finisher damage = attack x comboPower x stacks ^ meter.stackExp
    reviveHpFrac: 0.5,
    revivesPerAct: 1, // a revive per act (refilled at each act's start)
    healOnKill: 0.01, // fraction of max HP restored by every kill (tiny: HP carries from node to node, rests matter)
    strengthScale: 1, // x every hero's soft strength (src/data/heroes.ts: +15-25% against some kinds of foes)
  },
  meter: {
    // The meter fills once per stack; keep the combo going to bank more stacks (a combo break loses them all).
    perHit: 0.16,
    perGreen: 0.24,
    perBlock: 0.12,
    perfectBonus: 0.03,
    maxStacks: 5,
    stackExp: 1.7, // finisher damage grows as stacks ^ stackExp (2 stacks = 3.2x, 3 = 6.5x, 5 = 15x)
    finisherHold: 1, // during the finisher the cursor stops for this share of the show, then restarts from the left (0 = keeps moving)
  },
  tiers: {
    // Combo tiers (toggle in settings): damage multiplier at combo thresholds
    t1: 10,
    m1: 1.5,
    t2: 25,
    m2: 2,
    t3: 50,
    m3: 3,
  },
  kill: {
    // Every kill permanently raises the hero's stats for the rest of the run (quietly: the HP readout ticks up).
    // Small: an act has many kills (and later acts send more foes per fight), so it adds up: at 0.25 / 1 it was half
    // the hero's attack by Act 3 (playtest round 4 trimmed it; the acts' numbers came down with it).
    atk: 0.15,
    maxHp: 0.6,
    comboPower: 0, // finisher growth comes from boosts only, so max-stack finishers never outgrow the bosses
  },
  companion: {
    // Pip the owl: swoops in for a peck after every N attack hits (0 = no companion)
    everyHits: 4,
    damage: 6,
  },
  boosts: {
    maxHp: 20,
    damage: 0.15, // +15% damage
    crit: 0.05,
    critDmg: 0.5,
    comboPower: 0.5,
    pet: 4, // Companion Power: Pip's pecks hit this much harder
    rareChance: 0.15, // each card's chance to be rare (blue, rareMult x stronger)...
    epicChance: 0.04, // ...or epic (gold, epicMult x). A boss kill always offers at least one rare.
    rareMult: 2,
    epicMult: 3,
  },
  swipe: {
    minDistPx: 36, // CSS px in any direction
    maxMs: 350,
  },
  juice: {
    hitStopMs: 40, // the simulation (cursor and reds) freezes this long on crits and finishers
    shakeMinPx: 2, // small shakes outside the impact tiers (a miss)
    shakeMaxPx: 4, // big shakes outside the impact tiers (taking a hit, the chest)
    shakeMs: 120,
    flashMs: 70, // the hero's red flash when hurt
  },
  impact: {
    // Every impact has a weight from 0 (lightest) to 1 (heaviest); its sound and visuals scale with it.
    hit: 0.1,
    perfect: 0.18,
    block: 0.3,
    crit: 0.4,
    bomb: 0.5,
    finisher: 0.55, // 1 stack...
    finisherStack: 0.06, // ...plus this per extra stack (5 stacks = 0.79)
    kill: 0.85,
    bossKill: 1,
    hurt: 0.45, // taking a hit (sound only)
    curve: 1.3, // visual ramps follow weight ^ curve (higher keeps light hits subtler)
    // visuals, from the lightest impact to the heaviest
    hitStopLight: 28, // ms the scene freezes (the bar keeps running)
    hitStopHeavy: 150,
    shakeLight: 0.5, // px
    shakeHeavy: 7,
    shakeMsLight: 60,
    shakeMsHeavy: 450,
    knockLight: 5, // px the enemy is knocked back
    knockHeavy: 20,
    flashLight: 45, // ms the enemy flashes white
    flashHeavy: 150,
    frameFlash1: 0.4, // from this weight, a 1-frame white impact flash...
    frameFlash2: 0.75, // ...and 2 frames from this one
    duckFrom: 0.4, // impacts at least this heavy duck the music...
    duckDepth: 0.75, // ...by up to this much...
    duckMs: 380, // ...and it comes back over about this long
    // sound layers (also in the Sound lab)
    crack: 1, // 0-5 ms transient
    body: 1, // 120-600 Hz saturated thump: carries the weight on phone speakers
    tail: 1, // noise and debris tail
    sub: 0.5, // deep sine: only adds on headphones
    combo: 0.5, // the musical blip that climbs with the combo
    drive: 1, // body saturation
    bodyHzLight: 320, // the body's pitch drop ends here...
    bodyHzHeavy: 140,
    bodyMsLight: 70, // ...and it lasts this long
    bodyMsHeavy: 320,
    tailMsLight: 90,
    tailMsHeavy: 750,
    variation: 0.04, // +/- random pitch and timing, so repeats never sound identical
    music: 0.18, // music volume
  },
  specials: {
    tellGap: 0.5, // seconds after one telegraph's action before the next telegraph may start (one at a time)
    jitter: 0.15, // +/- share of a timed special's interval, so they don't tick like clockwork
    maxEnemies: 4, // summons and splits stop at this many enemies on screen
  },
  waves: {
    gapSec: 1.2, // a fight's foes come one wave after another: the next walks in this long after a wave falls
  },
  map: {
    restHeal: 0.3, // a rest node heals this share of max HP
    treasureCoins: 25, // a treasure chest holds this many coins (+/- 40%) and a rare-or-better boost card
    rowHp: 0.04, // enemies get this much more HP per map row (the act's fights ramp up)
    priceCommon: 30, // shop prices
    priceRare: 60,
    priceEpic: 110,
    pricePotion: 35, // a potion heals potionHeal of max HP
    potionHeal: 0.4,
    priceReroll: 20, // one reroll of the next 1-of-3 boost pick
  },
  extras: {
    // What else an act map holds (core/roam.ts places it after the map is built): stops per act...
    rush: 1, // ...Coin Rush (the mini-game: a fight against a coin sack that never attacks)
    bounty: 1, // ...a bounty board (a side quest for the rest of the act)
    secret: 1, // ...a secret cache, hidden beside a node (revealed when the hero stands there)
  },
  roam: {
    // Wandering packs and the travelling merchant on the act map (core/roam.ts): they step along the links each
    // time the hero moves, their next step shown. Meeting a pack is an ambush: its foes come as extra waves.
    packsFirst: 1, // packs on Act 1's map...
    packsLast: 2, // ...ramping to this many on the last act's
    merchant: 1, // travelling merchants per act map (0 = none)
    ambushCoins: 15, // an ambush won pays this x (act + 1) coins on top of the kills...
    ambushItems: 1, // ...this many extra items (Uncommon or better)...
    ambushPick: 1, // ...and its 1-of-3 pick is at least rare (1) or epic (2)
    merchantRelics: 1, // the merchant sells this many relics (rare or better) and a potion...
    merchantPrice: 0.85, // ...at a shop's prices x this
  },
  rush: {
    // Coin Rush (core/combat.ts rush mode): seconds on the bar against a coin sack; every hit drops coins
    sec: 12,
    perHit: 1, // coins per hit...
    comboStep: 15, // ...+1 for every this many combo
    perfect: 1, // ...+this for a perfect hit
    perStack: 4, // a finisher pays this x the stacks spent
  },
  quests: {
    // Bounties (core/quests.ts): each goal's number, and what a coins bounty pays (x (act + 1))
    blocks: 25, // block this many reds in the act
    combo: 40, // reach this combo in one fight
    healthy: 0.8, // win a fight with HP above this share
    flawless: 2, // clear this many waves without a miss or a hit taken
    kills: 15, // defeat this many foes in the act
    styleWins: 2, // a style call: win this many fights with a hero of its style
    styleShare: 0.35, // a board calls for a style this often (once you own 2+ heroes)
    coins: 50,
  },
  secret: {
    coinsMult: 2, // a secret cache holds this x a treasure chest's coins...
    items: 1, // ...this many items (Rare or better)...
    pick: 2, // ...and a relic pick at least rare (1) or epic (2), from every relic (a locked one unlocks)
  },
  wander: {
    // The world map's wandering foe (core/skirmish.ts): it shows up once this many fights have been won since the
    // last one (an act cleared at least once); beating it in a skirmish drops gear and gives XP
    every: 8,
    xp: 40, // XP x (act + 1), on top of the kills'
    items: 1, // items it drops (Uncommon or better)
  },
  gear: {
    // Drops (core/gear.ts). Rarity weights, common to mythic; Luck shifts them toward the rare end: each step above
    // common is weighted x (1 + luck x luckShift x step), so 20% Luck makes a Mythic 2x as likely.
    wCommon: 55,
    wUncommon: 28,
    wRare: 12,
    wEpic: 4,
    wLegendary: 0.9,
    wMythic: 0.1,
    wCelestial: 0.01, // Celestial and Divine: a post-story chase (about 1 in 10,000 and 1 in 50,000 drops here)
    wDivine: 0.002,
    luckShift: 1,
    fightChance: 0.5, // a fight node drops an item this often...
    eliteItems: 1, // ...an elite always drops this many (Uncommon or better)...
    treasureMin: 1, // ...a treasure chest holds 1-2...
    treasureMax: 2,
    miniBossItems: 2, // ...a mini-boss (Acts 1-2) this many plus its signature roll, the boss this many plus its
    bossItems: 3, // signature rolls
    setChance: 0.25, // a Rare or Epic drop is a set piece (of its slot) this often
    sigChance: 0.2, // a boss's signature Legendary drops this often on a kill...
    sigStep: 0.1, // ...plus this for every kill that didn't drop it (bad-luck protection)
    mythicChance: 0.05, // the same for the Boar King's Mythic (the Pendulum Shard)
    mythicStep: 0.03,
    // Item level comes from the act (and creeps up along its map rows); stats grow x(1 + level x levelScale).
    ilvlAct1: 1,
    ilvlAct2: 10,
    ilvlAct3: 20,
    ilvlPerAct: 10, // later acts: Act 3's level + this per act beyond it
    ilvlPerRow: 0.6,
    levelScale: 0.08,
    // the base stat's size per rarity (a Mythic's is 1.8x a Common's)
    rCommon: 1,
    rUncommon: 1.12,
    rRare: 1.25,
    rEpic: 1.4,
    rLegendary: 1.6,
    rMythic: 1.8,
    rCelestial: 2.05,
    rDivine: 2.3,
    // a stat's usual amount on an item at level 0 (slot base stats and bonus rolls scale from these)
    atk: 1.2,
    hp: 8,
    def: 3.2,
    critChance: 0.016,
    critDmg: 0.08,
    comboPower: 0.32,
    meterGain: 0.032,
    steady: 0.04,
    luck: 0.04,
    companion: 1.6,
    bonusLo: 0.4, // a bonus stat rolls between these shares of that amount
    bonusHi: 0.9,
    defScale: 100, // damage from a red you didn't block is x defScale / (defScale + Defense)
    steadyCap: 0.75, // Steady can slow the cursor's speed-up by at most this much
    bagSize: 60, // items the bag holds; drops past it are salvaged into scrap
  },
  forge: {
    upgradeStep: 0.08, // each + raises the base stat 8%
    maxPlus: 10,
    upgradeScrap: 3, // +0 -> +1 costs this much scrap and these coins (x the rarity's cost)...
    upgradeCoins: 15,
    upgradeGrowth: 1.35, // ...and each level costs this much more than the last
    rerollCoins: 40, // rerolling a bonus stat; doubles with each reroll on the same item
    // the rarity's cost multiplier (upgrades) and the scrap salvaging gives (x(1 + level / 25), plus half the scrap
    // spent on its upgrades)
    costCommon: 1,
    costUncommon: 1.25,
    costRare: 1.5,
    costEpic: 2,
    costLegendary: 2.5,
    costMythic: 3,
    costCelestial: 4,
    costDivine: 5,
    scrapCommon: 1,
    scrapUncommon: 2,
    scrapRare: 4,
    scrapEpic: 8,
    scrapLegendary: 20,
    scrapMythic: 40,
    scrapCelestial: 80,
    scrapDivine: 150,
  },
  kit: {
    // Replaying an act from the world map: Rowan starts with what a typical run has gained by then (boosts and kill
    // gains, per act behind him; measured with the bot), plus his gear. The debug panel's "Jump to" uses it too.
    // Re-measured in playtest round 4 (an 85% story run entering Acts 2 and 3): relics replaced most stat cards in M4a,
    // so a run gains almost no damage, crit or combo power from cards; the old stat-card numbers (+22% damage, +8.5%
    // crit, +0.77 crit damage, +0.82 combo power, +68 HP per act) made every farmed replay far stronger than the story.
    atk: 3.7,
    maxHp: 16,
    dmg: 0.005,
    crit: 0.003,
    critDmg: 0.025,
    comboPower: 0.035,
    pet: 1,
    relicPicks: 3, // ...and picks this many relics (1 of 3 each) per act behind him before the map
  },
  relics: {
    // The 1-of-3 pick after a fight (and the shop) offers mostly relics, plus at most one stat card (core/relics.ts).
    on: 1, // 0 = no relics: every card is a stat card, as before M4a (the balance report's control)
    statCard: 0.55, // chance one of the three cards is a stat card (never more than one)
    commonW: 1, // a relic's offer weight by rarity...
    rareW: 0.45,
    epicW: 0.14,
    synergy: 1.2, // ...times (1 + synergy x the number of its tags you already own), so builds form
    price: 1.25, // shops: a relic costs the boost card price of its rarity x this
    echoDelay: 1, // Echo Strike: seconds (of motion) between the finisher and its echo
    // each relic's one number (src/data/relics.ts has the text; '{n}' shows it)
    n: Object.fromEntries(RELICS.filter((r) => r.n !== undefined).map((r) => [r.id, r.n as number])) as Record<string, number>,
  },
  styles: {
    // Each style's shared rule (core/styles.ts; src/data/styles.ts has the words).
    bladeCombo: 20, // Blade (Edge): at this combo or more...
    bladeFill: 0.2, // ...the meter fills this much faster
    chainStep: 0.08, // Shadow (Chain): each Perfect in a row adds this much damage...
    chainMax: 5, // ...up to this many links
    guardPer: 0.3, // Guardian (Guard): each red blocked stores this share of your attack...
    guardMax: 5, // ...up to this many charges; the next hit unleashes them
    focusShare: 0.8, // Marksman (Focus): hits deal this share...
    focusStore: 0.35, // ...and store this share of your attack as Focus...
    focusCap: 6, // ...up to this many times your attack; a green hit fires it all
    heavyMult: 1.6, // Brute (Heavy): every hit deals this much...
    heavyGap: 1.45, // ...static blocks come this much further apart...
    heavyWidth: 1.3, // ...yellows are this much wider...
    heavyMin: 1, // ...and the bar keeps at least this many yellows
    bendSec: 1, // Controller (Bend): a Perfect block slows every red for this long...
    bendMult: 0.5, // ...to this share of its speed
    allyMax: 3, // Summoner (Call): allies at once
    kegEvery: 5, // Bomber (Powder): every Nth yellow comes as a keg...
    kegMult: 1.2, // ...whose blast hits every foe for this x your attack...
    kegRadius: 0.12, // ...and knocks reds this close off the bar
  },
  kits: {
    // Each hero's own numbers (core/kit-fx.ts; src/data/heroes.ts has the words). hp: base max HP; atk: share of
    // Rowan's base attack. Rowan's are tuning.hero. Tuned with the bot to stay within +/-10 points of Rowan.
    sable: { hp: 110, atk: 1, abilitySec: 3, silentStep: 0.25, dashLead: 0.15, dashMult: 2.5, fangMult: 1.4, fangKeep: 1 },
    neve: { hp: 108, atk: 0.95, abilitySec: 3, freeze: 0.35, freeze3: 0.6, chill: 0.75, iceResist: 0.5, glacierMult: 0.7, slowSec: 4, slowWidth: 0.34 },
    moss: { hp: 105, atk: 0.7, abilitySec: 3, allySec: 8, allySec3: 14, thornEvery: 1.5, thornDmg: 0.3, barkEvery: 6, mothEvery: 3, mothHeal: 0.006, seedEvery: 5, roots: 0.08, overgrowth: 0.15, vineSec: 3, vineMult: 0.5 },
    tam: { hp: 100, atk: 0.9, abilitySec: 3, kegEvery3: 4, blastShield: 0.5, bangKegs: 3, wide5: 2 },
    hollis: { hp: 100, atk: 0.9, abilitySec: 3, slam: 0.5, ironHide: 0.2, rampartSec: 3, rampartGuard: 1.2, guardMax3: 7 },
    vesper: { hp: 110, atk: 1.1, abilitySec: 3, pierce: 0.5, volleyFocus: 1.7, pinSec: 2, cap3: 1.5 },
    torva: { hp: 114, atk: 0.9, abilitySec: 3, quake: 0.15, windUp: 2.5, stunSec: 1.5, unstoppable: 0.08, unstoppableMax: 5, calmSec: 2 },
  },
  chests: {
    // Hero chests (core/chests.ts): a hero or a companion, weighted toward the low tiers, or shards for one you own.
    // Weights per tier, Common to Divine (a hero is never below Rare: a Common/Uncommon hero roll becomes Rare).
    hero: [40, 30, 20, 8, 1.8, 0.15, 0.04, 0.01],
    rare: [0, 0, 60, 30, 8.5, 1.2, 0.25, 0.05], // the shrine's Rare chest (gems)
    region: [0, 0, 0, 55, 35, 8, 1.6, 0.4], // a region at 100%: Epic or better
    heroShare: 0.5, // a chest holds a hero this often (else a companion)
    shardChance: 0.25, // ...or, this often (once you own something), shards for one you own
    shardsMin: 3,
    shardsMax: 6,
    dupShards: 10, // a duplicate becomes this many shards
    pity: 30, // the shrine: a Legendary or better within this many Rare chests...
    softPity: 20, // ...the Legendary+ odds climb from this many on...
    softStep: 0.05, // ...by this much a chest
    topPity: 120, // ...and a Celestial or better within this many (the top pity tier)
    rareCost: 240, // gems for one Rare chest at the shrine (a story run earns about this much per region: docs/balance.md)
    // drops
    bossChest: 0.35, // a region boss drops a hero chest this often (its first kill always does)
    miniChest: 0.25, // a mini-boss this often (its first kill always does)
    bountyChest: 0.3, // a bounty paid this often
    eliteChest: 0.04, // an elite, rarely
  },
  gems: {
    // Gems: earned only by playing (core/meta.ts)
    actFirst: 15, // an act's first clear
    miniFirst: 15, // a mini-boss's first kill...
    bossFirst: 35, // ...a region boss's...
    bossAgain: 3, // ...and later kills of either
    bounty: 5, // a bounty finished
    treasure: 8, // a hidden treasure found
    region: 60, // a region at 100% completion
    pouch: 0.08, // an elite drops a gem pouch this often...
    pouchGems: 5, // ...of this many
  },
  pets: {
    // Companions (core/companion-fx.ts, core/roster.ts): their level from the XP your hero earns with them along
    maxLevel: 20,
    levelDmg: 0.04, // +4% damage a level
    starDmg: 0.12, // +12% damage a star (and perks a step stronger)
    perkStep: 0.15, // each star above 1: perks this much stronger
    newtBurn: 3, // Newt: burn damage a second...
    newtSec: 3, // ...for this long
    bunEvery: 10, // Bun: a coin every this many hits
    oilEvery: 8, // Sprocket: every this many seconds...
    oilPerfect: 2, // ...the next block's Perfect zone is this much wider
    rockEvery: 15, // Brick: blocks a red every this many seconds
    chillSec: 2, // Flurry: bites slow the target's reds this long...
    chillMult: 0.6, // ...to this share of their speed; Snow Dash: after a block the next red slows for 1 s
    starEvery: 15, // Mote: a green every this many combo...
    mendSec: 5, // ...and at 10+ combo heals 1% every this many seconds
    hoard: 0.15, // Sunny: kills drop this much more coins...
    burnAt: 25, // ...at this combo its breath burns away traps...
    glow: 2, // ...and ice patches under you melt this much faster
  },
  stars: {
    // Shards raise a hero's or companion's stars (1-5): shards for the next star
    need: [10, 20, 40, 80],
  },
  bar: {
    // Patches on the bar (core/combat.ts zones): the cursor's speed inside them.
    iceMult: 1.6, // ice: faster (taps on ice come earlier)
    snowMult: 0.6, // snowdrifts: slower
    slowMult: 0.6, // a hero's slow patch (Glacier)
    ahead: 0.22, // "where the cursor is heading": this far ahead of it
    trailLife: 6, // s a red's trail of ice stays
  },
  hold: {
    // Hold blocks: press at the near edge, hold until the cursor is past the far edge.
    width: 0.16, // a hold's length (share of the bar)
    mult: 1.6, // a completed hold hits this much harder than a yellow
    lateMs: 70, // a press later than this past the near edge is a miss
    perfectMs: 35, // a press within this of the near edge is Perfect
    releaseGraceMs: 60, // letting go up to this early still completes it
    turnDone: 0.8, // the cursor turning back inside it: done if this much was held
  },
  drift: {
    // Drifting blocks (Region 3's bar rule): a foe's own drift rule (barRule driftEvery) uses this speed when the
    // act sets none (bar widths a second)
    speed: 0.06,
  },
  links: {
    // Linked pairs (Region 3's bar rule, core/combat.ts tapLinked): hit one, then the other within a beat
    beatSec: 0.8, // the beat: the partner must be hit within this long
    bonus: 1.5, // both hits land this much harder
    gapMin: 0.05, // the space between the two (on top of a block's width), share of the bar
    gapMax: 0.12,
  },
  levels: {
    // Heroes level up from kills and act clears (core/heroes.ts): small base-stat gains, a skill point every 2 levels.
    // Paced with the bot (a typical 70% player): a first playthrough of Greenmarch ends around level 9 (Acts 1-3:
    // ~5 / 7 / 9), six replays of Act 3 add ~5 more, and level 30 is ~80 clean Act 3 replays away (later regions
    // give more per kill).
    max: 30,
    xpBase: 12, // XP from level L to L+1: xpBase x L ^ xpExp (12, 48, 108... 972 at level 9)
    xpExp: 2,
    hpPer: 2, // max HP per level above 1
    atkPer: 0.015, // base attack +1.5% per level above 1
    pointEvery: 2, // a skill point every this many levels (levels 2, 4, 6...: 15 at level 30)
    xpKill: 5, // a kill gives this x (1 + act) (elites xpElite, mini-bosses and the boss xpBoss instead)
    xpElite: 25,
    xpBoss: 100,
    xpAct: 100, // clearing an act: this x (act + 1), doubled the first time
    star2Atk: 0.06, // 2 stars: +6% attack
    star4Hp: 0.08, // 4 stars: +8% max HP
  },
  skills: {
    // each skill node's number (src/data/skills.ts has the text; '{n}' shows it)
    n: Object.fromEntries(SKILL_NODES.filter((k) => k.n !== undefined).map((k) => [k.id, k.n as number])) as Record<string, number>,
  },
  effects: {
    // Set bonuses and the unique effects of Legendary and Mythic gear (src/data/gear.ts has the text)
    greenwardenHp: 0.1, // Greenwarden 2-piece: +10% max HP
    greenwardenRest: 0.5, // Greenwarden 4-piece: rests heal this much...
    greenwardenKillHeal: 0.03, // ...and kills heal this much
    tuskCrit: 0.05, // Tusk Crown: +5% crit per finisher stack spent...
    tuskSec: 5, // ...for this long
    pendulumEvery: 10, // Pendulum Shard: every Nth combo hit spawns a green block
    golemHeal: 1, // Golemheart Plate: HP healed per red blocked
    leechHp: 2, // Leech: HP per crit
    riposte: 0.5, // Riposte: a blocked red hits its owner for this share of your attack
    goldTouch: 0.5, // Golden Touch: +50% coins from kills
    owlEvery: 3, // Owl Eye: Pip pecks every N hits
    secondWindAt: 0.3, // Second Wind: once a fight, dropping under this share of max HP...
    secondWindHeal: 0.2, // ...heals this share
    ramshornHeal: 2, // Ramshorn Helm: blocking a red on ice heals this much
    wyrmfang: 2, // Wyrmfang: finished holds deal this much more
    rimeIce: 0.2, // Rimewalker 2-piece: hits on ice deal this much more...
    rimeHeal: 0.02, // ...4-piece: a finished hold heals this share of max HP
    // Divine auras
    radiance: 0.1, // Radiance: foes take this much more damage
    sanctuarySec: 4, // Sanctuary: every this many seconds...
    sanctuaryHeal: 0.01, // ...heal this share of max HP
    stillness: 0.3, // Stillness: the combo speeds the cursor up this much less
    fortune: 0.3, // Fortune: kills drop this much more coins
  },
  music: {
    // Fight music: its layers join as the combo climbs (on the next beat) and drop back on a combo break. Under
    // the first one, the fight arrangement plays its base (pads, arpeggio, percussion, the melody on a bell).
    drumsAt: 10, // combo the drums join at...
    bassAt: 25, // ...then the bass...
    leadAt: 50, // ...then the lead
    layerIn: 0.05, // s: a layer fades in this fast, landing on its beat
    layerOut: 0.6, // s: and fades out over this long when the combo breaks
    finisherHold: 2, // s the layers stay up after a finisher spends the combo
    crossfade: 1.5, // s: an act theme's calm and fight arrangements crossfade over about this long (whole beats)
    ringOut: 0.8, // s: when another piece takes over, the last one fades over this long
  },
  life: {
    // The living maps (view/map-life.ts, view/world-life.ts): critters startle when tapped, and a rare sparkle pays a
    // coin or two (core/sparkle.ts). Tiny and not farmable: at most one per act-map step (never an act's first step)
    // and one per world-map visit, the same one after a reload, never paid twice.
    mapChance: 0.25, // an act map step has a sparkle this often...
    worldChance: 0.5, // ...a new visit to the world map this often
    coinsMin: 1, // what one pays
    coinsMax: 2,
    delayMin: 1.5, // s after the screen comes up before it starts to glint (at the earliest...
    delayMax: 6, // ...and at the latest)
    keep: 32, // the last this many picked up are remembered (a reload or a retry never pays one twice)
    hideSec: 9, // s a startled critter stays away
  },
  enemies: cloneData(ENEMIES),
  acts: ALL_ACTS.map((a: ActDef): ActScale => ({ name: a.name, hpMult: a.hpMult, atkMult: a.atkMult, pace: a.pace, redSpeed: a.redSpeed })),
};

export type Tuning = typeof DEFAULT_TUNING;

export interface Settings {
  mode: 'classic' | 'relaxed'; // empty-bar tap: self-damage + combo break, or combo break only
  finisherInput: 'button' | 'swipe';
  comboTiers: boolean;
  targeting: 'auto' | 'tap';
  godMode: boolean;
  calibrationMs: number; // average tap lateness; subtracted from tap timestamps
  audioIgnoresSilentSwitch: boolean;
  muted: boolean;
  music: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  finisherInput: 'swipe',
  comboTiers: false,
  targeting: 'auto',
  godMode: false,
  calibrationMs: 0,
  audioIgnoresSilentSwitch: true,
  muted: false,
  music: true,
};

function cloneData<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function cloneTuning(t: Tuning = DEFAULT_TUNING): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}

/** Deep-merge `src` onto `dst`, only for keys that exist in `dst` with the same primitive type. */
export function mergeKnown(dst: unknown, src: unknown): void {
  if (!isObj(dst) || !isObj(src)) return;
  for (const key of Object.keys(dst)) {
    if (!(key in src)) continue;
    const d = dst[key];
    const s = src[key];
    if (Array.isArray(d)) {
      // arrays keep their shape (acts, specials, formations): merge element by element
      if (Array.isArray(s))
        d.forEach((item, i) => {
          if (isObj(item)) mergeKnown(item, s[i]);
          else if (typeof item === typeof s[i] && !(typeof s[i] === 'number' && !Number.isFinite(s[i]))) d[i] = s[i];
        });
      continue;
    }
    if (isObj(d)) {
      if (key === 'enemies' && isObj(s)) {
        // keep enemy set fixed, merge per-enemy values
        for (const ek of Object.keys(d)) mergeKnown(d[ek], s[ek]);
      } else mergeKnown(d, s);
    } else if (typeof d === typeof s) {
      if (typeof s === 'number' && !Number.isFinite(s)) continue;
      dst[key] = s;
    }
  }
}

/** Only the values in `t` that differ from `base` (so saved tuning doesn't pin old defaults). */
export function tuningDiff(t: unknown, base: unknown): unknown {
  if (Array.isArray(t) || !isObj(t) || !isObj(base)) return JSON.stringify(t) === JSON.stringify(base) ? undefined : t;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(t)) {
    const d = tuningDiff(t[k], base[k]);
    if (d !== undefined) out[k] = d;
  }
  return Object.keys(out).length ? out : undefined;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- Slider metadata for the debug panel (same file so every number stays in one place) ----

export interface SliderDef {
  path: string; // dot path into Tuning
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface SliderGroup {
  title: string;
  sliders: SliderDef[];
}

const s = (path: string, label: string, min: number, max: number, step: number): SliderDef => ({
  path,
  label,
  min,
  max,
  step,
});

/** The impact sound-layer levels: in the Impact group and in the gear panel's Sound lab. */
export const IMPACT_SOUND_SLIDERS: SliderDef[] = [
  s('impact.crack', 'Layer: crack', 0, 2, 0.05),
  s('impact.body', 'Layer: body', 0, 2, 0.05),
  s('impact.tail', 'Layer: tail', 0, 2, 0.05),
  s('impact.sub', 'Layer: sub (headphones)', 0, 2, 0.05),
  s('impact.combo', 'Layer: combo notes', 0, 2, 0.05),
  s('impact.drive', 'Body drive', 0, 3, 0.05),
  s('impact.variation', 'Variation (+/-)', 0, 0.15, 0.005),
  s('impact.music', 'Music volume', 0, 0.6, 0.01),
];

export function sliderGroups(t: Tuning): SliderGroup[] {
  const groups: SliderGroup[] = [
    {
      title: 'Cursor',
      sliders: [
        s('cursor.basePassSec', 'Base pass (s)', 0.5, 3, 0.05),
        s('cursor.speedPerHit', 'Speed per hit', 0, 0.1, 0.005),
        s('cursor.maxSpeedMult', 'Max speed x', 1, 4, 0.1),
        s('cursor.speedBlockBonus', 'Speed block bonus', 0, 0.5, 0.01),
        s('cursor.widthFrac', 'Cursor width', 0, 0.05, 0.002),
      ],
    },
    {
      title: 'Judgment',
      sliders: [
        s('judge.perfectFrac', 'Perfect zone', 0.05, 1, 0.05),
        s('judge.graceMs', 'Grace (ms)', 0, 80, 1),
        s('judge.redGraceMs', 'Red grace (ms)', 0, 120, 1),
        s('judge.maxRewindMs', 'Max rewind (ms)', 0, 600, 10),
        s('judge.missSelfDamage', 'Miss self-dmg', 0, 20, 1),
      ],
    },
    {
      title: 'Blocks',
      sliders: [
        s('blocks.attackWidth', 'Yellow width', 0.02, 0.25, 0.005),
        s('blocks.greenWidth', 'Green width', 0.02, 0.25, 0.005),
        s('blocks.redWidth', 'Red width', 0.02, 0.25, 0.005),
        s('blocks.trapWidth', 'Trap width', 0.02, 0.25, 0.005),
        s('blocks.widthMin', 'Width varies from x', 0.3, 1, 0.05),
        s('blocks.widthMax', '...to x', 1, 2.5, 0.05),
        s('blocks.redWidthMin', 'Red width varies from x', 0.3, 1.5, 0.05),
        s('blocks.redWidthMax', '...to x (red)', 0.5, 2.5, 0.05),
        s('blocks.redTravelSec', 'Red travel (s)', 0.8, 6, 0.1),
        s('blocks.impactGraceMs', 'Impact grace (ms)', 0, 200, 5),
        s('blocks.trapLifeSec', 'Trap life (s)', 1, 10, 0.5),
        s('blocks.attackLifeSec', 'Attack life (s, 0=inf)', 0, 12, 0.5),
        s('blocks.shieldHits', 'Shield taps', 1, 4, 1),
        s('blocks.shieldKnockback', 'Shield knockback', 0, 0.6, 0.01),
        s('blocks.knockbackSec', 'Knockback time (s)', 0, 0.5, 0.01),
        s('blocks.bombRadius', 'Bomb radius', 0.05, 0.6, 0.01),
        s('blocks.bombDamage', 'Bomb dmg', 0, 80, 1),
        s('blocks.bombHitMult', 'Bomb hit x', 1, 3, 0.1),
        s('blocks.maxStatic', 'Max static', 1, 8, 1),
        s('blocks.minAttack', 'Min attack blocks', 0, 6, 1),
        s('blocks.maxRed', 'Max red', 1, 6, 1),
        s('blocks.spawnRateMult', 'Spawn interval x', 0.3, 3, 0.05),
        s('blocks.groupSpawnMult', 'Group interval x', 0.5, 4, 0.1),
        s('blocks.openingSpawns', 'Opening blocks', 0, 4, 1),
        s('blocks.minGap', 'Min gap', 0, 0.1, 0.005),
        s('blocks.edgeMargin', 'Edge margin', 0, 0.2, 0.01),
      ],
    },
    {
      title: 'Hero (Rowan)',
      sliders: [
        s('hero.maxHp', 'Max HP', 10, 400, 5),
        s('hero.atk', 'Attack', 1, 60, 1),
        s('hero.greenMult', 'Green x', 1, 4, 0.1),
        s('hero.critChance', 'Crit chance', 0, 1, 0.01),
        s('hero.critDmg', 'Crit dmg x', 1, 5, 0.1),
        s('hero.perfectCritBonus', 'Perfect crit +', 0, 1, 0.01),
        s('hero.abilityCritBonus', 'Ability crit +', 0, 1, 0.01),
        s('hero.abilitySec', 'Ability (s)', 0, 10, 0.5),
        s('hero.comboPower', 'Combo power', 0, 20, 0.5),
        s('hero.reviveHpFrac', 'Revive HP', 0.1, 1, 0.05),
        s('hero.revivesPerAct', 'Revives/act', 0, 3, 1),
        s('hero.healOnKill', 'Heal on kill', 0, 1, 0.05),
        s('hero.strengthScale', 'Soft strengths x', 0, 2, 0.05),
      ],
    },
    {
      title: 'Meter / Finisher',
      sliders: [
        s('meter.perHit', 'Per hit', 0, 0.5, 0.01),
        s('meter.perGreen', 'Per green', 0, 0.5, 0.01),
        s('meter.perBlock', 'Per block', 0, 0.5, 0.01),
        s('meter.perfectBonus', 'Perfect bonus', 0, 0.3, 0.01),
        s('meter.maxStacks', 'Max stacks', 1, 9, 1),
        s('meter.stackExp', 'Stack exponent', 1, 3, 0.05),
        s('meter.finisherHold', 'Cursor stop during finisher', 0, 1.5, 0.05),
      ],
    },
    {
      title: 'Combo tiers',
      sliders: [
        s('tiers.t1', 'Tier 1 at', 1, 100, 1),
        s('tiers.m1', 'Tier 1 x', 1, 5, 0.1),
        s('tiers.t2', 'Tier 2 at', 1, 150, 1),
        s('tiers.m2', 'Tier 2 x', 1, 5, 0.1),
        s('tiers.t3', 'Tier 3 at', 1, 200, 1),
        s('tiers.m3', 'Tier 3 x', 1, 8, 0.1),
      ],
    },
    {
      title: 'Boosts',
      sliders: [
        s('boosts.maxHp', 'Max HP +', 0, 100, 5),
        s('boosts.damage', 'Damage +', 0, 1, 0.05),
        s('boosts.crit', 'Crit +', 0, 0.3, 0.01),
        s('boosts.critDmg', 'Crit dmg +', 0, 2, 0.1),
        s('boosts.comboPower', 'Combo power +', 0, 5, 0.5),
        s('boosts.pet', 'Companion power +', 0, 20, 1),
        s('boosts.rareChance', 'Rare card chance', 0, 1, 0.01),
        s('boosts.epicChance', 'Epic card chance', 0, 1, 0.01),
        s('boosts.rareMult', 'Rare x', 1, 5, 0.25),
        s('boosts.epicMult', 'Epic x', 1, 6, 0.25),
      ],
    },
    {
      title: 'Swipe finisher',
      sliders: [s('swipe.minDistPx', 'Min dist (px)', 10, 200, 5), s('swipe.maxMs', 'Max time (ms)', 80, 800, 10)],
    },
    {
      title: 'Kill rewards',
      sliders: [s('kill.atk', 'Attack +', 0, 5, 0.25), s('kill.maxHp', 'Max HP +', 0, 20, 1), s('kill.comboPower', 'Combo power +', 0, 3, 0.25)],
    },
    {
      title: 'Companion (Pip)',
      sliders: [s('companion.everyHits', 'Peck every N hits', 0, 12, 1), s('companion.damage', 'Peck damage', 0, 60, 1)],
    },
    {
      title: 'Impact',
      sliders: [
        s('impact.hit', 'Weight: hit', 0, 1, 0.01),
        s('impact.perfect', 'Weight: perfect', 0, 1, 0.01),
        s('impact.block', 'Weight: block', 0, 1, 0.01),
        s('impact.crit', 'Weight: crit', 0, 1, 0.01),
        s('impact.bomb', 'Weight: bomb', 0, 1, 0.01),
        s('impact.finisher', 'Weight: finisher x1', 0, 1, 0.01),
        s('impact.finisherStack', 'Weight: per extra stack', 0, 0.25, 0.01),
        s('impact.kill', 'Weight: kill', 0, 1, 0.01),
        s('impact.bossKill', 'Weight: boss kill', 0, 1, 0.01),
        s('impact.hurt', 'Weight: hurt (sound)', 0, 1, 0.01),
        s('impact.curve', 'Visual curve', 0.5, 3, 0.05),
        s('impact.hitStopLight', 'Hit-stop light (ms)', 0, 200, 1),
        s('impact.hitStopHeavy', 'Hit-stop heavy (ms)', 0, 300, 5),
        s('impact.shakeLight', 'Shake light (px)', 0, 8, 0.1),
        s('impact.shakeHeavy', 'Shake heavy (px)', 0, 12, 0.5),
        s('impact.shakeMsLight', 'Shake light (ms)', 0, 400, 10),
        s('impact.shakeMsHeavy', 'Shake heavy (ms)', 0, 1000, 10),
        s('impact.knockLight', 'Knockback light (px)', 0, 30, 1),
        s('impact.knockHeavy', 'Knockback heavy (px)', 0, 40, 1),
        s('impact.flashLight', 'Enemy flash light (ms)', 0, 200, 5),
        s('impact.flashHeavy', 'Enemy flash heavy (ms)', 0, 400, 5),
        s('impact.frameFlash1', '1-frame flash from', 0, 1.05, 0.01),
        s('impact.frameFlash2', '2-frame flash from', 0, 1.05, 0.01),
        s('impact.duckFrom', 'Music duck from', 0, 1.05, 0.01),
        s('impact.duckDepth', 'Music duck depth', 0, 1, 0.05),
        s('impact.duckMs', 'Music duck (ms)', 50, 1500, 10),
        ...IMPACT_SOUND_SLIDERS,
        s('impact.bodyHzLight', 'Body pitch light (Hz)', 60, 700, 5),
        s('impact.bodyHzHeavy', 'Body pitch heavy (Hz)', 40, 700, 5),
        s('impact.bodyMsLight', 'Body light (ms)', 20, 400, 5),
        s('impact.bodyMsHeavy', 'Body heavy (ms)', 20, 1000, 10),
        s('impact.tailMsLight', 'Tail light (ms)', 20, 600, 10),
        s('impact.tailMsHeavy', 'Tail heavy (ms)', 50, 2000, 10),
      ],
    },
    {
      title: 'Juice',
      sliders: [
        s('juice.hitStopMs', 'Sim freeze: crit/fin (ms)', 0, 200, 5),
        s('juice.shakeMinPx', 'Shake: miss (px)', 0, 8, 1),
        s('juice.shakeMaxPx', 'Shake: hurt (px)', 0, 8, 1),
        s('juice.shakeMs', 'Shake: hurt (ms)', 0, 400, 10),
        s('juice.flashMs', 'Hero hurt flash (ms)', 0, 200, 5),
      ],
    },
  ];
  groups.push(
    {
      title: 'Specials',
      sliders: [
        s('specials.tellGap', 'Gap between telegraphs (s)', 0, 3, 0.05),
        s('specials.jitter', 'Interval jitter +/-', 0, 0.5, 0.01),
        s('specials.maxEnemies', 'Max enemies on screen', 1, 5, 1),
      ],
    },
    {
      title: 'Waves',
      sliders: [s('waves.gapSec', 'Next wave after (s)', 0, 3, 0.05)],
    },
    {
      title: 'Map and nodes',
      sliders: [
        s('map.restHeal', 'Rest heals', 0, 1, 0.05),
        s('map.treasureCoins', 'Treasure coins', 0, 200, 5),
        s('map.rowHp', 'Enemy HP + per row', 0, 0.2, 0.01),
        s('map.priceCommon', 'Shop: common card', 0, 300, 5),
        s('map.priceRare', 'Shop: rare card', 0, 300, 5),
        s('map.priceEpic', 'Shop: epic card', 0, 400, 5),
        s('map.pricePotion', 'Shop: potion', 0, 200, 5),
        s('map.potionHeal', 'Potion heals', 0, 1, 0.05),
        s('map.priceReroll', 'Shop: reroll', 0, 200, 5),
      ],
    },
    {
      title: 'Map extras (per act)',
      sliders: [
        s('extras.rush', 'Coin Rush stops', 0, 3, 1),
        s('extras.bounty', 'Bounty boards', 0, 2, 1),
        s('extras.secret', 'Secret caches', 0, 1, 1),
        s('roam.packsFirst', 'Packs: Act 1', 0, 3, 1),
        s('roam.packsLast', 'Packs: last act', 0, 3, 1),
        s('roam.merchant', 'Travelling merchants', 0, 1, 1),
        s('roam.ambushCoins', 'Ambush coins x act', 0, 100, 1),
        s('roam.ambushItems', 'Ambush extra items', 0, 3, 1),
        s('roam.ambushPick', 'Ambush pick: rare 1, epic 2', 0, 2, 1),
        s('roam.merchantRelics', 'Merchant: relics for sale', 0, 3, 1),
        s('roam.merchantPrice', 'Merchant prices x', 0.2, 1.5, 0.05),
      ],
    },
    {
      title: 'Coin Rush',
      sliders: [
        s('rush.sec', 'Seconds', 4, 30, 1),
        s('rush.perHit', 'Coins per hit', 0, 5, 1),
        s('rush.comboStep', '+1 coin every combo', 2, 50, 1),
        s('rush.perfect', 'Perfect hit +coins', 0, 5, 1),
        s('rush.perStack', 'Finisher coins x stack', 0, 20, 1),
      ],
    },
    {
      title: 'Bounties, secrets, skirmishes',
      sliders: [
        s('quests.blocks', 'Bounty: reds to block', 1, 80, 1),
        s('quests.combo', 'Bounty: combo to reach', 5, 150, 1),
        s('quests.healthy', 'Bounty: win above HP', 0.1, 1, 0.05),
        s('quests.flawless', 'Bounty: clean waves', 1, 10, 1),
        s('quests.kills', 'Bounty: foes to defeat', 1, 60, 1),
        s('quests.coins', 'Bounty coins x act', 0, 300, 5),
        s('secret.coinsMult', 'Secret: coins x treasure', 0, 6, 0.25),
        s('secret.items', 'Secret: items (Rare+)', 0, 3, 1),
        s('secret.pick', 'Secret pick: rare 1, epic 2', 0, 2, 1),
        s('wander.every', 'Skirmish after fights won', 1, 40, 1),
        s('wander.xp', 'Skirmish XP x act', 0, 300, 5),
        s('wander.items', 'Skirmish items', 0, 3, 1),
      ],
    },
  );
  groups.push(
    {
      title: 'Gear drops',
      sliders: [
        s('gear.wCommon', 'Weight: Common', 0, 100, 1),
        s('gear.wUncommon', 'Weight: Uncommon', 0, 100, 1),
        s('gear.wRare', 'Weight: Rare', 0, 100, 0.5),
        s('gear.wEpic', 'Weight: Epic', 0, 50, 0.5),
        s('gear.wLegendary', 'Weight: Legendary', 0, 20, 0.1),
        s('gear.wMythic', 'Weight: Mythic', 0, 5, 0.05),
        s('gear.wCelestial', 'Weight: Celestial', 0, 1, 0.001),
        s('gear.wDivine', 'Weight: Divine', 0, 1, 0.001),
        s('gear.luckShift', 'Luck shift', 0, 5, 0.1),
        s('gear.fightChance', 'Fight: item chance', 0, 1, 0.05),
        s('gear.eliteItems', 'Elite: items', 0, 4, 1),
        s('gear.treasureMin', 'Treasure: items from', 0, 4, 1),
        s('gear.treasureMax', '...to', 0, 5, 1),
        s('gear.miniBossItems', 'Mini-boss: items', 0, 5, 1),
        s('gear.bossItems', 'Boss: items', 0, 6, 1),
        s('gear.setChance', 'Set piece chance (Rare/Epic)', 0, 1, 0.05),
        s('gear.sigChance', 'Signature chance', 0, 1, 0.01),
        s('gear.sigStep', 'Signature +per miss', 0, 0.5, 0.01),
        s('gear.mythicChance', 'Mythic signature chance', 0, 1, 0.01),
        s('gear.mythicStep', 'Mythic +per miss', 0, 0.5, 0.01),
        s('gear.bagSize', 'Bag size', 10, 120, 1),
      ],
    },
    {
      title: 'Gear stats',
      sliders: [
        s('gear.ilvlAct1', 'Item level: Act 1', 1, 40, 1),
        s('gear.ilvlAct2', 'Item level: Act 2', 1, 40, 1),
        s('gear.ilvlAct3', 'Item level: Act 3', 1, 40, 1),
        s('gear.ilvlPerAct', 'Item level per later act', 1, 30, 1),
        s('gear.ilvlPerRow', 'Item level per map row', 0, 2, 0.1),
        s('gear.levelScale', 'Stats per item level', 0, 0.3, 0.005),
        s('gear.rCommon', 'Base stat: Common x', 0.5, 3, 0.05),
        s('gear.rUncommon', 'Base stat: Uncommon x', 0.5, 3, 0.05),
        s('gear.rRare', 'Base stat: Rare x', 0.5, 3, 0.05),
        s('gear.rEpic', 'Base stat: Epic x', 0.5, 3, 0.05),
        s('gear.rLegendary', 'Base stat: Legendary x', 0.5, 3, 0.05),
        s('gear.rMythic', 'Base stat: Mythic x', 0.5, 3, 0.05),
        s('gear.rCelestial', 'Base stat: Celestial x', 0.5, 4, 0.05),
        s('gear.rDivine', 'Base stat: Divine x', 0.5, 4, 0.05),
        s('gear.atk', 'Attack per item', 0, 10, 0.1),
        s('gear.hp', 'HP per item', 0, 60, 1),
        s('gear.def', 'Defense per item', 0, 30, 0.5),
        s('gear.critChance', 'Crit per item', 0, 0.2, 0.005),
        s('gear.critDmg', 'Crit dmg per item', 0, 1, 0.01),
        s('gear.comboPower', 'Combo power per item', 0, 3, 0.05),
        s('gear.meterGain', 'Meter gain per item', 0, 0.3, 0.005),
        s('gear.steady', 'Steady per item', 0, 0.3, 0.005),
        s('gear.luck', 'Luck per item', 0, 0.3, 0.005),
        s('gear.companion', 'Companion per item', 0, 20, 0.5),
        s('gear.bonusLo', 'Bonus roll from x', 0, 2, 0.05),
        s('gear.bonusHi', '...to x', 0, 3, 0.05),
        s('gear.defScale', 'Defense scale', 10, 500, 5),
        s('gear.steadyCap', 'Steady cap', 0, 1, 0.05),
      ],
    },
    {
      title: 'Forge',
      sliders: [
        s('forge.upgradeStep', 'Upgrade: +stat per level', 0, 0.3, 0.01),
        s('forge.maxPlus', 'Max +', 1, 20, 1),
        s('forge.upgradeScrap', 'Upgrade scrap (+1)', 0, 30, 1),
        s('forge.upgradeCoins', 'Upgrade coins (+1)', 0, 200, 1),
        s('forge.upgradeGrowth', 'Upgrade cost growth', 1, 2.5, 0.05),
        s('forge.rerollCoins', 'Reroll coins (doubles)', 0, 300, 5),
        s('forge.costCommon', 'Cost x: Common', 0.2, 6, 0.05),
        s('forge.costUncommon', 'Cost x: Uncommon', 0.2, 6, 0.05),
        s('forge.costRare', 'Cost x: Rare', 0.2, 6, 0.05),
        s('forge.costEpic', 'Cost x: Epic', 0.2, 6, 0.05),
        s('forge.costLegendary', 'Cost x: Legendary', 0.2, 6, 0.05),
        s('forge.costMythic', 'Cost x: Mythic', 0.2, 6, 0.05),
        s('forge.costCelestial', 'Cost x: Celestial', 0.2, 8, 0.05),
        s('forge.costDivine', 'Cost x: Divine', 0.2, 10, 0.05),
        s('forge.scrapCommon', 'Salvage: Common', 0, 50, 1),
        s('forge.scrapUncommon', 'Salvage: Uncommon', 0, 50, 1),
        s('forge.scrapRare', 'Salvage: Rare', 0, 100, 1),
        s('forge.scrapEpic', 'Salvage: Epic', 0, 200, 1),
        s('forge.scrapLegendary', 'Salvage: Legendary', 0, 300, 1),
        s('forge.scrapMythic', 'Salvage: Mythic', 0, 500, 1),
        s('forge.scrapCelestial', 'Salvage: Celestial', 0, 800, 1),
        s('forge.scrapDivine', 'Salvage: Divine', 0, 1200, 1),
      ],
    },
  );
  groups.push({
    title: 'Replay kit (per act behind)',
    sliders: [
      s('kit.atk', 'Attack +', 0, 30, 0.1),
      s('kit.maxHp', 'Max HP +', 0, 300, 1),
      s('kit.dmg', 'Damage +', 0, 1, 0.01),
      s('kit.crit', 'Crit +', 0, 0.5, 0.005),
      s('kit.critDmg', 'Crit dmg +', 0, 3, 0.01),
      s('kit.comboPower', 'Combo power +', 0, 5, 0.01),
      s('kit.pet', 'Companion +', 0, 40, 0.1),
    ],
  });
  groups.push(
    {
      title: 'Relic offers',
      sliders: [
        s('relics.on', 'Relics on (0 = stat cards only)', 0, 1, 1),
        s('relics.statCard', 'Stat card in a pick', 0, 1, 0.05),
        s('relics.commonW', 'Weight: common relic', 0, 3, 0.05),
        s('relics.rareW', 'Weight: rare relic', 0, 3, 0.05),
        s('relics.epicW', 'Weight: epic relic', 0, 3, 0.01),
        s('relics.synergy', 'Synergy lean', 0, 5, 0.1),
        s('relics.price', 'Shop: relic price x', 0.2, 4, 0.05),
        s('relics.echoDelay', 'Echo Strike: delay (s)', 0.2, 3, 0.05),
        s('kit.relicPicks', 'Replay: relic picks per act', 0, 6, 1),
      ],
    },
    {
      title: 'Relic numbers',
      sliders: Object.keys(t.relics.n).map((id) => s(`relics.n.${id}`, id, 0, Math.max(10, t.relics.n[id] * 4), t.relics.n[id] % 1 ? 0.05 : 1)),
    },
    {
      title: 'Styles',
      sliders: Object.keys(t.styles).map((k) => s(`styles.${k}`, k, 0, Math.max(2, (t.styles as Record<string, number>)[k] * 4), (t.styles as Record<string, number>)[k] % 1 ? 0.01 : 1)),
    },
    ...Object.entries(t.kits).map(([id, kit]) => ({
      title: `Hero: ${id}`,
      sliders: Object.keys(kit).map((k) => {
        const v = (kit as Record<string, number>)[k];
        return s(`kits.${id}.${k}`, k, 0, Math.max(2, v * 4), v % 1 ? 0.01 : 1);
      }),
    })),
    {
      title: 'Chests and gems',
      sliders: [
        s('chests.heroShare', 'Chest: hero share', 0, 1, 0.05),
        s('chests.shardChance', 'Chest: shards chance', 0, 1, 0.05),
        s('chests.dupShards', 'Duplicate: shards', 1, 40, 1),
        s('chests.pity', 'Shrine pity (Legendary+)', 5, 100, 1),
        s('chests.softPity', 'Shrine soft pity from', 1, 100, 1),
        s('chests.softStep', 'Soft pity step', 0, 0.2, 0.01),
        s('chests.topPity', 'Top pity (Celestial+)', 20, 400, 5),
        s('chests.rareCost', 'Rare chest: gems', 10, 600, 5),
        s('chests.bossChest', 'Boss drops a chest', 0, 1, 0.05),
        s('chests.miniChest', 'Mini-boss drops a chest', 0, 1, 0.05),
        s('chests.bountyChest', 'Bounty pays a chest', 0, 1, 0.05),
        s('chests.eliteChest', 'Elite drops a chest', 0, 0.5, 0.01),
        s('gems.actFirst', 'Gems: first act clear', 0, 100, 1),
        s('gems.miniFirst', 'Gems: first mini-boss', 0, 100, 1),
        s('gems.bossFirst', 'Gems: first boss', 0, 200, 1),
        s('gems.bossAgain', 'Gems: boss again', 0, 30, 1),
        s('gems.bounty', 'Gems: bounty', 0, 50, 1),
        s('gems.treasure', 'Gems: hidden treasure', 0, 50, 1),
        s('gems.region', 'Gems: region at 100%', 0, 300, 5),
        s('gems.pouch', 'Gem pouch chance (elite)', 0, 1, 0.01),
        s('gems.pouchGems', 'Gem pouch gems', 0, 50, 1),
      ],
    },
    {
      title: 'Companions',
      sliders: Object.keys(t.pets).map((k) => {
        const v = (t.pets as Record<string, number>)[k];
        return s(`pets.${k}`, k, 0, Math.max(2, v * 4), v % 1 ? 0.01 : 1);
      }),
    },
    {
      title: 'Bar patches and holds',
      sliders: [
        s('bar.iceMult', 'Ice: cursor speed x', 1, 3, 0.05),
        s('bar.snowMult', 'Snowdrift: cursor speed x', 0.2, 1, 0.05),
        s('bar.slowMult', 'Slow patch: cursor speed x', 0.2, 1, 0.05),
        s('bar.ahead', 'Laid ahead of the cursor by', 0, 0.6, 0.01),
        s('bar.trailLife', 'Ice trail lasts (s)', 0, 20, 0.5),
        s('drift.speed', 'Drift speed (bar/s)', 0, 0.2, 0.005),
        s('links.beatSec', 'Pair: beat (s)', 0.2, 2, 0.05),
        s('links.bonus', 'Pair: damage x', 1, 3, 0.05),
        s('links.gapMin', 'Pair: gap min', 0, 0.3, 0.01),
        s('links.gapMax', 'Pair: gap max', 0, 0.3, 0.01),
        s('hold.width', 'Hold length', 0.06, 0.4, 0.01),
        s('hold.mult', 'Hold damage x', 0.5, 4, 0.05),
        s('hold.lateMs', 'Hold: late press (ms)', 0, 200, 5),
        s('hold.perfectMs', 'Hold: Perfect press (ms)', 0, 120, 5),
        s('hold.releaseGraceMs', 'Hold: early release grace (ms)', 0, 200, 5),
        s('hold.turnDone', 'Hold: done when turned at', 0.3, 1, 0.05),
        s('blocks.frozenLifeSec', 'Frozen block melts (s)', 1, 20, 0.5),
        s('blocks.frozenMult', 'Frozen block damage x', 0.5, 5, 0.05),
      ],
    },
    {
      title: 'Hero levels',
      sliders: [
        s('levels.max', 'Max level', 1, 60, 1),
        s('levels.xpBase', 'XP to level 2', 1, 200, 1),
        s('levels.xpExp', 'XP curve exponent', 0.5, 3, 0.05),
        s('levels.hpPer', 'Max HP per level', 0, 20, 0.5),
        s('levels.star2Atk', '2 stars: attack +', 0, 0.5, 0.01),
        s('levels.star4Hp', '4 stars: max HP +', 0, 0.5, 0.01),
        s('levels.atkPer', 'Attack % per level', 0, 0.1, 0.005),
        s('levels.pointEvery', 'Skill point every N levels', 1, 5, 1),
        s('levels.xpKill', 'XP per kill (x act)', 0, 20, 0.5),
        s('levels.xpElite', 'XP per elite (x act)', 0, 60, 1),
        s('levels.xpBoss', 'XP per boss (x act)', 0, 200, 1),
        s('levels.xpAct', 'XP per act clear (x act)', 0, 300, 5),
      ],
    },
    {
      title: 'Skill numbers',
      sliders: Object.keys(t.skills.n).map((id) => s(`skills.n.${id}`, id, 0, Math.max(10, t.skills.n[id] * 4), t.skills.n[id] % 1 ? 0.05 : 1)),
    },
  );
  groups.push({
    title: 'Gear effects and sets',
    sliders: [
      s('effects.greenwardenHp', 'Greenwarden 2: max HP +', 0, 0.5, 0.01),
      s('effects.greenwardenRest', 'Greenwarden 4: rest heals', 0, 1, 0.05),
      s('effects.greenwardenKillHeal', 'Greenwarden 4: kill heals', 0, 0.2, 0.01),
      s('effects.tuskCrit', 'Tusk Crown: crit per stack', 0, 0.3, 0.01),
      s('effects.tuskSec', 'Tusk Crown: seconds', 0, 20, 0.5),
      s('effects.pendulumEvery', 'Pendulum Shard: every N hits', 2, 30, 1),
      s('effects.golemHeal', 'Golemheart: HP per block', 0, 10, 1),
      s('effects.leechHp', 'Leech: HP per crit', 0, 20, 1),
      s('effects.riposte', 'Riposte: x attack', 0, 3, 0.05),
      s('effects.goldTouch', 'Golden Touch: coins +', 0, 3, 0.05),
      s('effects.owlEvery', 'Owl Eye: peck every N', 1, 10, 1),
      s('effects.secondWindAt', 'Second Wind: below HP', 0, 1, 0.05),
      s('effects.secondWindHeal', 'Second Wind: heals', 0, 1, 0.05),
      s('effects.ramshornHeal', 'Ramshorn Helm: heal on ice block', 0, 20, 1),
      s('effects.wyrmfang', 'Wyrmfang: hold damage x', 1, 5, 0.1),
      s('effects.rimeIce', 'Rimewalker 2: damage on ice +', 0, 1, 0.05),
      s('effects.rimeHeal', 'Rimewalker 4: hold heals', 0, 0.2, 0.005),
      s('effects.radiance', 'Aura Radiance: foes take +', 0, 1, 0.01),
      s('effects.sanctuarySec', 'Aura Sanctuary: every (s)', 1, 20, 0.5),
      s('effects.sanctuaryHeal', 'Aura Sanctuary: heals', 0, 0.1, 0.005),
      s('effects.stillness', 'Aura Stillness: combo speed-up less', 0, 1, 0.05),
      s('effects.fortune', 'Aura Fortune: coins +', 0, 1, 0.05),
    ],
  });
  groups.push({
    title: 'Music',
    sliders: [
      s('music.drumsAt', 'Drums join at combo', 0, 100, 1),
      s('music.bassAt', 'Bass joins at combo', 0, 150, 1),
      s('music.leadAt', 'Lead joins at combo', 0, 200, 1),
      s('music.layerIn', 'Layer fade in (s)', 0.01, 1, 0.01),
      s('music.layerOut', 'Layer fade out (s)', 0.05, 3, 0.05),
      s('music.finisherHold', 'Layers stay after a finisher (s)', 0, 8, 0.25),
      s('music.crossfade', 'Calm <-> fight crossfade (s)', 0.2, 4, 0.1),
      s('music.ringOut', 'Piece change fade (s)', 0.1, 3, 0.05),
    ],
  });
  groups.push({
    title: 'Living maps (sparkles, critters)',
    sliders: [
      s('life.mapChance', 'Sparkle per act map step', 0, 1, 0.01),
      s('life.worldChance', 'Sparkle per world map visit', 0, 1, 0.01),
      s('life.coinsMin', 'Sparkle coins: min', 0, 10, 1),
      s('life.coinsMax', 'Sparkle coins: max', 0, 10, 1),
      s('life.delayMin', 'Glints after (s): earliest', 0, 20, 0.5),
      s('life.delayMax', 'Glints after (s): latest', 0, 30, 0.5),
      s('life.keep', 'Picked-up sparkles remembered', 1, 64, 1),
      s('life.hideSec', 'Startled critter hides (s)', 1, 30, 0.5),
    ],
  });
  t.acts.forEach((a, i) =>
    groups.push({
      title: `Act ${i + 1}: ${a.name}`,
      sliders: [
        s(`acts.${i}.hpMult`, 'Enemy HP x', 0.2, 12, 0.05),
        s(`acts.${i}.atkMult`, 'Enemy attack x', 0.2, 24, 0.05),
        s(`acts.${i}.pace`, 'Spawn interval x', 0.4, 2, 0.05),
        s(`acts.${i}.redSpeed`, 'Red speed x', 0.5, 1.5, 0.05),
      ],
    }),
  );
  for (const key of Object.keys(t.enemies)) {
    const e = t.enemies[key];
    groups.push({
      title: `Enemy: ${e.name}`,
      sliders: [
        s(`enemies.${key}.hp`, 'HP', 5, 9000, 5),
        s(`enemies.${key}.atk`, 'Attack', 0, 80, 1),
        s(`enemies.${key}.special`, 'Trap / counter dmg', 0, 150, 1),
        s(`enemies.${key}.interval`, 'Spawn every (s)', 0.2, 4, 0.05),
        s(`enemies.${key}.coins`, 'Coins', 0, 300, 1),
        ...e.specials.flatMap((sp, i) => [
          s(`enemies.${key}.specials.${i}.tell`, `${sp.id}: telegraph (s)`, 0.3, 1.5, 0.05),
          ...(sp.every !== undefined ? [s(`enemies.${key}.specials.${i}.every`, `${sp.id}: every (s)`, 1, 30, 0.5)] : []),
          ...(sp.hpBelow !== undefined ? [s(`enemies.${key}.specials.${i}.hpBelow`, `${sp.id}: below HP`, 0.05, 0.95, 0.01)] : []),
        ]),
      ],
    });
  }
  return groups;
}

export function getPath(obj: unknown, path: string): number {
  let cur: unknown = obj;
  for (const k of path.split('.')) cur = (cur as Record<string, unknown>)[k];
  return cur as number;
}

export function setPath(obj: unknown, path: string, value: number): void {
  const keys = path.split('.');
  let cur = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
}
