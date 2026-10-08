// Where each perk shows itself on the fight screen. The playtester's rule (round 6): every hero, ally, companion and
// relic effect shows itself at the moment it happens ON the thing it affects (the block, the foe, the cursor, the
// hero), not only as a word over the bar or a name in the HUD's lane. view/onsite.ts draws what this table says;
// tests/unit/perk-at.test.ts checks every perk the core fires has an entry; docs/fight-events.md ("View coverage")
// lists them. Plain data (no Phaser).
import type { BlockKind } from '../../core/combat';
import type { AllyKind } from '../../data/heroes';

/**
 * What a perk's visual lands on. Several may apply; the ones that need the event's data (a bar position, a foe) are
 * skipped when it doesn't carry it.
 */
export type PerkTarget =
  | 'bar' // the block at its event's bar position flashes: a box in the perk's colour popping out of it, sparks
  | 'tab' // a mote flies from its bar position (or the tap) into the style tab on the bar
  | 'foe' // a mark on its event's foe (brackets closing in on it, a ring)
  | 'bolt' // a bolt from the hero (or the ally that struck) to its foe, then the hit (fighters.perkFx)
  | 'bash' // a shield flies from the hero's guard into its foe and lands with a clang, a steel number (Shield Slam)
  | 'turn' // the red at its position turns into the block it made, where it stood (a keg flips in, ice climbs over)
  | 'bounce' // a bolt from the foe the tap just hit on to its foe (a ricochet, a pierce, a shatter)
  | 'hero' // a ring and sparks on the hero
  | 'heal' // a heal sparkle on the hero and a green +N there (and the HP readout's own +N)
  | 'hurt' // its cost in HP on the hero (its heroHurt event: fighters.perkHurt)
  | 'meter' // the meter (stacks banked, or filled)
  | 'combo' // the combo counter flashes
  | 'cursor' // a glow kick on the cursor
  | 'reds' // every red on the bar flashes
  | 'foeReds' // every red of its event's foe flashes
  | 'foes' // every foe is marked
  | 'target' // the foe the tap just hit (else the current target) is marked
  | 'left' // the bar's left end, where reds land (a blocker's slab: bar.blocker; else a flash there)
  | 'miss' // the spot on the bar where the miss was (smoke for a veil)
  | 'hold' // the spot on the bar where the hold was
  | 'patches' // the patches it cleared flash as they go
  | 'spawn' // the block it put on the bar (PERK_SPAWN) twinkles as it lands (flying in from its companion or ally)
  | 'blast' // where the kegs blew
  | 'cleared' // where the blocks it took off the bar were
  | 'ally' // the ally it belongs to (PERK_ALLY) gets a ring
  | 'pet' // a streak from its companion to what it touched (a block, the left end, a trap)
  | 'coins' // coins pop out of what dropped them (COIN_FROM) and fly to the coin counter
  | 'burn' // flames on its foe (they keep burning while the ticks come)
  | 'show'; // drawn by its own show (a finisher's, Shield Wall's bubble, Chain Reaction's morphs, a Rally)

/** Every perk the fight can fire (relics, skill nodes, kit parts, styles, allies, companions, gear sets), and where
 *  it shows. */
export const PERK_AT: Record<string, readonly PerkTarget[]> = {
  // ---- Rowan
  resolve: ['combo', 'hero'], // the hit taken kept the combo
  wideSweep: ['combo'], // +1 combo per foe the Whirlwind hit
  // ---- Sable (and the Shadow style's Chain); her Shadow Dash is the 'dash' event (bar.ts: streak, afterimages, landing)
  chain: ['tab'],
  smokeVeil: ['miss'], // the miss the smoke forgave
  afterimage: ['left'], // the afterimage took the red at the left end
  fangAndClaw: ['bolt'],
  twinFang: ['meter'],
  // ---- Neve (and the Controller style's Bend)
  flashFreeze: ['bar'], // (its iceBlock event frosts the block too)
  glacier: ['reds'], // every red frozen solid (encased in ice on the bar while it lasts: bar-kinds drawSolid)
  bend: ['reds'],
  // ---- Moss: the allies (their 'ally' events: view/party.ts and onsite.ally)
  rally: ['show'],
  thornling: ['bolt'],
  barkback: ['left'],
  glowmoth: ['heal'],
  seedling: ['spawn'],
  // ---- Tam
  fuseUp: ['spawn'],
  bigBang: ['show'],
  // ---- Hollis (and the Guardian style's Guard): every block slams; full Guard sets off a Bulwark on every foe
  guardUp: ['tab'],
  shieldSlam: ['bash'], // (Perfect: a bigger shield, a starburst, a brighter number; the 'slam' tier, shieldCounter)
  bulwark: ['show'], // the hero slams down, a great shield sweeps every foe, the Guard tab bursts ('bulwark' tier)
  bulwarkBlow: ['show'], // each foe struck as the great shield reaches it (a big steel number)
  // ---- Vesper (the Marksman style's Power Shot)
  powerShot: ['bolt'],
  pierce: ['bounce'],
  volley: ['show'],
  patience: ['bar', 'target'], // a Perfect fires the full Focus (no green in reach): gold on the hit and the foe
  // ---- Torva
  quake: ['reds'],
  windUp: ['bar', 'foe'], // (its stun event: stars over the foe)
  secondSwing: ['meter'],
  // ---- the companions
  luckyFoot: ['coins'], // Bun: a coin out of the block just hit (Bun hops)
  owlWatch: ['pet', 'bar'], // Pip pecks the trap away
  emberBite: ['burn'], // Newt's burn ticks
  oilCan: ['pet', 'bar'], // Sprocket's oiled block hit Perfectly
  rockWall: ['pet', 'left'], // Brick's wall took the red
  starlight: ['pet', 'spawn'], // Mote's star lands as a green
  mend: ['heal'], // Mote's heal
  goldHoard: ['coins'], // Sunny: gold out of the dying foe
  fireBreath: ['pet', 'cleared'], // Sunny burns the traps off the bar
  chillBite: ['pet', 'foeReds'], // Flurry: the bitten foe's reds frost over
  snowDash: ['pet', 'bar'], // Flurry: the next red frosts over
  // ---- gear sets and auras that heal
  rimewalker: ['heal'],
  sanctuary: ['heal'],
  emberwright: ['heal'],
  // ---- the Test lab's banked stacks
  testLab: ['meter'],
  // ---- the anti-spam rules (playtest round 7): the fight's heals used up; no more misses forgiven this fight
  healCap: ['hero'],
  missCap: ['combo'],
  // ---- relics: bombs
  powderKeg: ['meter'],
  shortFuse: ['bar'],
  sapper: ['bar'],
  blastWave: ['bar'],
  partingGift: ['spawn'],
  // ---- crits
  sharpshooter: ['foe'],
  glassEdge: ['foe'], // (a miss's cost: its heroHurt)
  lastStand: ['hero'],
  weakSpot: ['foe'],
  ricochet: ['bounce'],
  huntingOwl: ['foe'],
  luckyPenny: ['coins'],
  // ---- blocks
  ironRhythm: ['bolt'],
  mirrorGuard: ['bolt'],
  turtleShell: ['bar'],
  shieldbearer: ['meter'],
  nightWatch: ['pet', 'bar'], // Pip blocks the nearest red
  // ---- combo
  chainReaction: ['show'], // each yellow turning green flashes (its morph events)
  momentum: ['cursor'],
  crescendo: ['foes'],
  clutch: ['miss'], // (its HP cost: its heroHurt)
  overdrive: ['hero', 'cursor'],
  goldFever: ['coins'], // out of the combo counter
  // ---- finisher
  sweeper: ['combo'],
  hoarder: ['meter'],
  overcharge: ['meter'], // (the stack lost shatters off the meter: its comboBreak event)
  quickDraw: ['foes'],
  echoStrike: ['bolt'],
  bloodPrice: ['hurt'],
  purplePact: ['bar'],
  // ---- green
  greenhouse: ['bar'],
  verdantSurge: ['meter'],
  evergreen: ['cursor'],
  photosynthesis: ['heal'],
  // ---- Pip
  treasureNose: ['coins'],
  wingman: ['meter'],
  // ---- sustain
  vampiricFang: ['heal'],
  // ---- ice and holds (the second region)
  frostRune: ['bar', 'foe'],
  hotCocoa: ['heal'],
  icebreaker: ['bar'],
  snowplow: ['patches'],
  melt: ['bar'],
  releaseValve: ['meter'],
  luckyMitten: ['coins'],
  crampons: ['hold'],
  // ---- drift and links (the third region)
  weathervane: ['bar', 'foe'],
  warmSprings: ['heal'],
  rebound: ['bar'],
  anchorStone: ['bar'],
  flotsam: ['coins'],
  forgedBond: ['bar', 'combo'],
  hammerTongs: ['bar', 'foe'],
  spareLink: ['bar'],
  coupling: ['bar', 'meter'],
  goldRivets: ['coins'],
  snapBack: ['bar'],
  hairTrigger: ['hurt'],
  // ---- skill nodes: Rowan
  followThrough: ['bounce'],
  whetstone: ['bar', 'foe'],
  executioner: ['bar', 'foe'],
  parry: ['bar', 'reds'],
  shieldBash: ['bar', 'foe'], // (its stun event)
  shieldWall: ['show'], // the bubble round the hero (fighters.ts)
  doubleTime: ['combo'],
  chargedUp: ['meter'],
  unbroken: ['combo'],
  // ---- Sable
  sureChain: ['bar'],
  deepCuts: ['bar', 'foe'],
  deathMark: ['target'],
  lunge: ['bar', 'foe'],
  nightStep: ['bar'], // (its dash event)
  phantomRush: ['bar'],
  thickSmoke: ['cursor'],
  vanish: ['bar'],
  nightCloak: ['bar', 'foe'],
  // ---- Neve
  brittle: ['bar', 'foe'],
  bigFreeze: ['turn'], // the frozen reds iced over into blocks to smash
  iceAge: ['bar'],
  longBend: ['reds'],
  frostAura: ['reds'],
  coldShoulder: ['bar'],
  skater: ['bar', 'foe'],
  frostTrail: ['bar'],
  blackIce: ['bar'],
  // ---- Moss
  quickThorns: ['ally'],
  thornRush: ['ally', 'meter'],
  rooted: ['ally'],
  quickBrace: ['ally'],
  splinters: ['bolt'],
  rootCall: ['bar'],
  brightMoth: ['heal'],
  moonglow: ['reds'],
  pollenBurst: ['bolt'],
  // ---- Tam
  turnabout: ['turn'], // Big Bang flips each red into a keg where it stood
  restock: ['bar', 'spawn'],
  minefield: ['bar'],
  packedPowder: ['blast'],
  shrapnel: ['blast'],
  powderLine: ['bar'],
  heavyPowder: ['blast'],
  shockwave: ['reds'],
  kaboom: ['blast', 'meter'],
  // ---- Hollis
  sureGuard: ['tab'],
  deepGuard: ['bar'], // (the Bulwark hit harder: its block)
  avalanche: ['foes'], // (a Bulwark stuns every foe: their stun stars)
  heavySlam: ['show'], // the slam it made stronger lands heavier on its foe (a ground shock, a hot-steel starburst)
  wideSlam: ['bash'], // smaller shields into every other foe
  retaliate: ['show'], // (stored Guard): the slam lands heavier on its foe, like Heavy Slam
  longRampart: ['left'],
  wallUp: ['left'],
  echoWall: ['meter'],
  // ---- Vesper
  steadyHand: ['bar', 'foe'],
  fullQuiver: ['bar'],
  cleanShot: ['bar', 'foe'],
  watchful: ['tab'],
  trickShot: ['bar'],
  pinningShot: ['reds'],
  exposed: ['bar', 'foe'],
  deadfall: ['bolt'],
  // ---- Torva
  pulverize: ['bar', 'foe'],
  haymaker: ['bar', 'foe'],
  wreckingBall: ['bar', 'cursor'],
  faultLine: ['reds'],
  rupture: ['bolt'],
  landslide: ['cleared'],
  seething: ['tab', 'hero'],
  payback: ['cursor'],
  berserk: ['bar', 'foe'],
};

/** The block a 'spawn' perk puts on the bar. */
export const PERK_SPAWN: Record<string, BlockKind> = {
  seedling: 'green',
  starlight: 'green',
  fuseUp: 'keg',
  restock: 'keg',
  partingGift: 'bomb',
};

/** The ally an 'ally' perk belongs to. */
export const PERK_ALLY: Record<string, AllyKind> = {
  quickThorns: 'thornling',
  thornRush: 'thornling',
  rooted: 'thornling',
  quickBrace: 'barkback',
};

/**
 * What coins come out of: the block just hit ('block': Bun's Lucky Foot), the foe its event names or the current
 * target ('foe'), the foe that just died, at its burst ('kill'), the combo counter ('combo'), the bar position its
 * event names ('pos': a finished hold, a drifting block, a pair), the Coin Rush sack ('sack').
 */
export type CoinFrom = 'block' | 'foe' | 'kill' | 'combo' | 'pos' | 'sack';
export const COIN_FROM: Record<string, CoinFrom> = {
  luckyFoot: 'block',
  goldHoard: 'kill',
  luckyPenny: 'foe',
  treasureNose: 'foe',
  goldFever: 'combo',
  luckyMitten: 'pos',
  flotsam: 'pos',
  goldRivets: 'pos',
  rush: 'sack',
};

/** Where a perk not in the table shows: on its bar position and its foe when it names them, else on the hero. */
export function perkTargets(id: string, o: { pos?: number; enemyId?: number }): readonly PerkTarget[] {
  const t = PERK_AT[id];
  if (t) return t;
  const list: PerkTarget[] = [];
  if (o.pos !== undefined) list.push('bar');
  if (o.enemyId) list.push('foe');
  return list.length ? list : ['hero'];
}
