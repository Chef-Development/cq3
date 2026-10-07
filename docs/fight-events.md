# Fight events

What the combat sim (`src/core`) emits as `CombatEvent`s and what the fight view draws for them. The view routes every
batch through `src/engine/scene.ts` `onEvents`.

## View coverage

The playtester's rule (round 6): **every hero, ally, companion and relic effect shows itself at the moment it happens,
ON the thing it affects** (the block, the foe, the cursor, the hero), not only as a word above the bar
(`view/callouts.ts`) or a name in the HUD's lane (`fighters.ts` `perkLabel`). The words and names stay; each effect also
shows on its target.

- `src/engine/view/perk-at.ts`: where every perk lands (`PERK_AT`), what a spawning perk makes (`PERK_SPAWN`), whose
  ally a skill node is about (`PERK_ALLY`), what coins come out of (`COIN_FROM`). Plain data.
- `src/engine/view/onsite.ts` (`scene.onsite`): draws it. It sees every event of a batch first (`onEvent`), so a perk
  later in the batch knows where the tap was, what it spawned or cleared, who died. Bar marks are screen space over the
  blocks and under the cursor; flights from the stage down to the bar are over everything; stage marks are in the world
  layer (they shake with it).
- `tests/unit/perk-at.test.ts` reads `src/core` for every perk it fires (`perkFx`, `strike`, `healPerk`, `bankStacks`,
  `loseStacks`, `strikeAll`) and every `awardCoins` source and fails if one has no entry. **A new perk: add it to
  `PERK_AT` (and this table).** Until then it still shows at run time: on its block (a `pos`), its foe (an `enemyId`),
  else a ring on the hero (`perkTargets`' fallback).

### The looks (small, short, bold; each kind throttled)

| Target | What shows | Where |
| --- | --- | --- |
| a block (`bar`) | a box in the perk's colour pops out of the block (white flash, thick rim, sparkles off its corners, chips); it follows the block while it's on the bar | `onsite.box` |
| every red (`reds`, `foeReds`) | a thin box on each red (every red, or every red of the event's foe) | `onsite.redsOf` |
| the cursor (`cursor`) | a column of light round the blade that narrows, a ring, sparks off its caps, the cursor's pulse | `onsite.cursorKick` |
| a foe (`foe`, `foes`, `target`) | four brackets closing in on its chest, a ring | `onsite.mark` |
| the hero (`hero`) | a ring, sparks and a glow on the hero | `onsite.heroRing` |
| a heal (`heal`) | green stars twinkling up round the hero, a green +N beside them (merged for a moment), the HP readout's own +N | `onsite.healOnHero` |
| the style tab (`tab`) | a mote flies from the block into the style readout's tab on the bar (Guard, Focus, Chain stored) | `onsite.toTab` |
| the combo (`combo`) | the counter swells, a ring and sparks | `onsite.combo` |
| the meter (`meter`) | sparks and a ring where it's filled to | `onsite.meter` |
| a forgiven miss (`miss`) | Smoke Veil: lilac smoke puffs where the miss was; others: a box there | `onsite.missSpot` |
| coins (`coins`) | coins pop out of what dropped them (the block hit, a foe, the dying foe, the combo counter, a bar spot) and fly to the coin counter; a "+N" pops there as they land | `onsite.coins`, `hud.dropCoins(label)` |
| a companion (`pet`) | a streak from the companion to what its perk touched; the mark there lands with it | `onsite.petStreak` |

### Events (other than perks)

| Event | What shows, on what |
| --- | --- |
| `dash` (Shadow Dash; Night Step) | a puff where the cursor leaves; a bright violet streak along its path (white-hot core at the head); three afterimages of the cursor (its own shape in violet) left where it was and a third and two thirds of the way, each fading from when it passed; a burst where it lands (a white flash narrowing on the cursor, rings, a violet starburst, sparks skidding on along the frame); then the streak's tail runs in to the landing (bar.ts `drawDashes`) |
| `zoneOn` slow (a dash's landing slow-down) | a slow patch laid within 0.8 s of a dash, over its landing spot, is Sable's: violet runes, bright ends; any patch kind the view doesn't know is painted like a slow patch; a narrow one still shows a rune and its ends (bar-kinds.ts `drawPatch`) |
| `pet` (a companion attacks) | fliers swoop, walkers dash in, the number on the target; **Sunny**: a wall of fire sweeps across every foe from the nearest to the farthest, each struck (its number) as the fire reaches it; **Newt**: its bite sets the foe burning |
| `ally` call | a leaf flies from the green that called it up to where the ally pops in (the ally pops when it lands) |
| `ally` act | Thornling: its thorn bolt to the foe (the perk); Glowmoth: a mote of light to the hero, the heal on the hero; Seedling: a seed arcs from it onto the bar and lands on the green it made; Barkback braces: a mote from it to the bar's left end, where its slab stands ready |
| `ally` block / leave / rally | the Barkback hops in front of the hero, its slab takes the red at the bar's left end; a puff; rings over every ally and "Rally!" |
| `stun` | stars circling the foe's head, a ring, "Stunned!" |
| `explode` (own keg), `iceBlock`, `deflect`, `chip`, `mirror`, `mark`, `holdStart`/`holdEnd` | on the bar where they happen (unchanged) |
| `remove` with reason `perk` | the block closes like an eye; a trap Sunny's Fire Breath burns stands until the fire reaches it, then glows white-hot, chars from the top down with flames licking off it and smokes away (the `burn` exit) |
| `coins` | see coins above |
| `heroHurt` from a perk | its HP cost on the hero in violet, its name in the lane |
| `gearFx` | each on its target (unchanged); Opening Blow now also marks its foe; Ramshorn's heal shows on the hero (it showed nothing) |

### The companions (each distinct)

| Companion | Perk | What shows |
| --- | --- | --- |
| Bun | Lucky Foot (a coin every Nth hit) | a coin, twice the size, pops up out of the block just hit with a gold glint; Bun hops (twice, once it's home from the attack that came with it) with a glint of gold over it; the coin flies to the coin counter and "+1" pops there |
| Mote | Starlight (a green every 15 combo) | a star (white heart, glittering trail) streaks from Mote down to the new green; it lands with a twinkle, a ring and sparks |
| Mote | Mend (heals 1% every few seconds at 10+ combo) | a mote of starlight drifts from Mote to the hero, then pale gold and green stars twinkle up round the hero and a green +N shows beside them |
| Sunny | its breath (attacks every foe) | a wall of fire sweeps across every foe, each struck as it reaches it |
| Sunny | Fire Breath (burns traps off the bar at 25+ combo) | a fireball flies to each trap; each burns away there (white-hot, charring, flames, smoke) with an orange box |
| Sunny | Gold Hoard (more coins from kills) | as the foe bursts: a gold starburst, gold rings, a fountain of coins to the counter, "+N" with a coin over it |
| Newt | Ember Bite (burns its target) | flames lick up the burning foe while the ticks come (tapered tongues, embers rising); each tick flares them, a small orange number |
| Pip | Owl Watch, Night Watch | a streak from Pip to the trap (or red); a box there |
| Sprocket | Oil Can | (ready: the gold Perfect zones on every block) a streak from Sprocket to the block hit Perfectly; a gold box there |
| Brick | Rock Wall | (ready: its slab at the left end) a pebble from Brick to the left end; its slab takes the red |
| Flurry | Chill Bite, Snow Dash | a streak from Flurry to the red; its reds frost over (the chill's own look) and flash |

### Every perk

| Perk | Whose | Shows on |
| --- | --- | --- |
| `resolve` | Rowan: Knight's Resolve | the combo counter swells, a ring; a ring and sparks on the hero |
| `wideSweep` | Rowan: Wide Sweep (3 stars) | the combo counter swells, a ring |
| `chain` | Shadow style: Chain | a mote flies from the block into the style tab |
| `smokeVeil` | Sable: Smoke Veil | where the miss was |
| `afterimage` | Sable: Afterimage (3 stars) | the bar's left end (a blocker's slab, or a flash) |
| `fangAndClaw` | Sable: Fang and Claw (5 stars) | a bolt to its foe, then the hit |
| `twinFang` | Sable: Twin Fang | sparks off the meter |
| `flashFreeze` | Neve: Flash Freeze | a box flashes out of the block it touched |
| `bend` | Controller style: Bend | every red on the bar flashes |
| `rally` | Moss: Rally | its own show |
| `thornling` | Moss: Thornling | a bolt to its foe, then the hit |
| `barkback` | Moss: Barkback | the bar's left end (a blocker's slab, or a flash) |
| `glowmoth` | Moss: Glowmoth | heal stars twinkle up round the hero, +N there |
| `seedling` | Moss: Seedling | the block it made lands with a twinkle (green) |
| `fuseUp` | Tam: Fuse Up | the block it made lands with a twinkle (keg) |
| `bigBang` | Tam: Big Bang | its own show |
| `guardUp` | Guardian style: Guard stored | a mote flies from the block into the style tab |
| `guard` | Guardian style: Guard spent | the foe just hit is marked |
| `shieldSlam` | Hollis: Shield Slam | a bolt to its foe, then the hit |
| `powerShot` | Marksman style: Power Shot | a bolt to its foe, then the hit |
| `pierce` | Vesper: Piercing Shot | a bolt from the foe just hit on to the next |
| `volley` | Vesper: Volley | its own show |
| `quake` | Torva: Quake | every red on the bar flashes |
| `windUp` | Torva: Wind-Up | a box flashes out of the block it touched; brackets close in on its foe |
| `secondSwing` | Torva: Second Swing (5 stars) | sparks off the meter |
| `luckyFoot` | Bun: Lucky Foot | coins pop out of what dropped them into the coin counter (from: block) |
| `owlWatch` | Pip: Owl Watch | a streak from the companion to what it touched; a box flashes out of the block it touched |
| `emberBite` | Newt: Ember Bite | flames on the foe while it burns, a small orange tick number |
| `oilCan` | Sprocket: Oil Can | a streak from the companion to what it touched; a box flashes out of the block it touched |
| `rockWall` | Brick: Rock Wall | a streak from the companion to what it touched; the bar's left end (a blocker's slab, or a flash) |
| `starlight` | Mote: Starlight | a streak from the companion to what it touched; the block it made lands with a twinkle (green) |
| `mend` | Mote: Mend | heal stars twinkle up round the hero, +N there |
| `goldHoard` | Sunny: Gold Hoard | coins pop out of what dropped them into the coin counter (from: kill) |
| `fireBreath` | Sunny: Fire Breath | a streak from the companion to what it touched; where the blocks it cleared were |
| `chillBite` | Flurry: Chill Bite | a streak from the companion to what it touched; the bitten foe's reds flash |
| `snowDash` | Flurry: Snow Dash | a streak from the companion to what it touched; a box flashes out of the block it touched |
| `rimewalker` | Rimewalker set (4) | heal stars twinkle up round the hero, +N there |
| `sanctuary` | Sanctuary aura | heal stars twinkle up round the hero, +N there |
| `emberwright` | Emberwright set (4) | heal stars twinkle up round the hero, +N there |
| `testLab` | Test lab stacks | sparks off the meter |
| `powderKeg` | relic: Powder Keg | sparks off the meter |
| `shortFuse` | relic: Short Fuse | a box flashes out of the block it touched |
| `sapper` | relic: Sapper's Fuse | a box flashes out of the block it touched |
| `blastWave` | relic: Blast Wave | a box flashes out of the block it touched |
| `partingGift` | relic: Parting Gift | the block it made lands with a twinkle (bomb) |
| `sharpshooter` | relic: Sharpshooter | brackets close in on its foe |
| `glassEdge` | relic: Glass Edge | brackets close in on its foe |
| `lastStand` | relic: Last Stand | a ring and sparks on the hero |
| `weakSpot` | relic: Weak Spot | brackets close in on its foe |
| `ricochet` | relic: Ricochet | a bolt from the foe just hit on to the next |
| `huntingOwl` | relic: Hunting Owl | brackets close in on its foe |
| `luckyPenny` | relic: Lucky Penny | coins pop out of what dropped them into the coin counter (from: foe) |
| `ironRhythm` | relic: Iron Rhythm | a bolt to its foe, then the hit |
| `mirrorGuard` | relic: Mirror Guard | a bolt to its foe, then the hit |
| `turtleShell` | relic: Turtle Shell | a box flashes out of the block it touched |
| `shieldbearer` | relic: Shieldbearer | sparks off the meter |
| `nightWatch` | relic: Night Watch | a streak from the companion to what it touched; a box flashes out of the block it touched |
| `chainReaction` | relic: Chain Reaction | its own show |
| `momentum` | relic: Momentum | the cursor kicks (a column of light, a ring) |
| `crescendo` | relic: Crescendo | every foe is marked |
| `clutch` | relic: Clutch | where the miss was |
| `overdrive` | relic: Overdrive | a ring and sparks on the hero; the cursor kicks (a column of light, a ring) |
| `goldFever` | relic: Gold Fever | coins pop out of what dropped them into the coin counter (from: combo) |
| `sweeper` | relic: Sweeper | the combo counter swells, a ring |
| `hoarder` | relic: Hoarder | sparks off the meter |
| `overcharge` | relic: Overcharge | sparks off the meter |
| `quickDraw` | relic: Quick Draw | every foe is marked |
| `echoStrike` | relic: Echo Strike | a bolt to its foe, then the hit |
| `bloodPrice` | relic: Blood Price | its HP cost on the hero (violet) |
| `purplePact` | relic: Purple Pact | a box flashes out of the block it touched |
| `greenhouse` | relic: Greenhouse | a box flashes out of the block it touched |
| `verdantSurge` | relic: Verdant Surge | sparks off the meter |
| `evergreen` | relic: Evergreen | the cursor kicks (a column of light, a ring) |
| `photosynthesis` | relic: Photosynthesis | heal stars twinkle up round the hero, +N there |
| `treasureNose` | relic: Treasure Nose | coins pop out of what dropped them into the coin counter (from: foe) |
| `wingman` | relic: Wingman | sparks off the meter |
| `vampiricFang` | relic: Vampiric Fang | heal stars twinkle up round the hero, +N there |
| `frostRune` | relic: Frost Rune | a box flashes out of the block it touched; brackets close in on its foe |
| `hotCocoa` | relic: Hot Cocoa | heal stars twinkle up round the hero, +N there |
| `icebreaker` | relic: Icebreaker | a box flashes out of the block it touched |
| `snowplow` | relic: Snowplow | the patches it cleared flash |
| `melt` | relic: Melt | a box flashes out of the block it touched |
| `releaseValve` | relic: Release Valve | sparks off the meter |
| `luckyMitten` | relic: Lucky Mitten | coins pop out of what dropped them into the coin counter (from: pos) |
| `crampons` | relic: Crampons | where the hold was |
| `weathervane` | relic: Weathervane | a box flashes out of the block it touched; brackets close in on its foe |
| `warmSprings` | relic: Warm Springs | heal stars twinkle up round the hero, +N there |
| `rebound` | relic: Rebound | a box flashes out of the block it touched |
| `anchorStone` | relic: Anchor Stone | a box flashes out of the block it touched |
| `flotsam` | relic: Flotsam | coins pop out of what dropped them into the coin counter (from: pos) |
| `forgedBond` | relic: Forged Bond | a box flashes out of the block it touched; the combo counter swells, a ring |
| `hammerTongs` | relic: Hammer & Tongs | a box flashes out of the block it touched; brackets close in on its foe |
| `spareLink` | relic: Spare Link | a box flashes out of the block it touched |
| `coupling` | relic: Coupling | a box flashes out of the block it touched; sparks off the meter |
| `goldRivets` | relic: Gold Rivets | coins pop out of what dropped them into the coin counter (from: pos) |
| `snapBack` | relic: Snap Back | a box flashes out of the block it touched |
| `hairTrigger` | relic: Hair Trigger | its HP cost on the hero (violet) |
| `followThrough` | skill: Follow-Through | a bolt from the foe just hit on to the next |
| `whetstone` | skill: Whetstone | a box flashes out of the block it touched; brackets close in on its foe |
| `executioner` | skill: Executioner | a box flashes out of the block it touched; brackets close in on its foe |
| `parry` | skill: Parry | a box flashes out of the block it touched; every red on the bar flashes |
| `shieldBash` | skill: Shield Bash | a box flashes out of the block it touched; brackets close in on its foe |
| `shieldWall` | skill: Shield Wall | its own show |
| `doubleTime` | skill: Double Time | the combo counter swells, a ring |
| `chargedUp` | skill: Charged Up | sparks off the meter |
| `unbroken` | skill: Unbroken | the combo counter swells, a ring |
| `sureChain` | skill: Sure Chain | a box flashes out of the block it touched |
| `deepCuts` | skill: Deep Cuts | a box flashes out of the block it touched; brackets close in on its foe |
| `deathMark` | skill: Death Mark | the foe just hit is marked |
| `lunge` | skill: Lunge | a box flashes out of the block it touched; brackets close in on its foe |
| `nightStep` | skill: Night Step | a box flashes out of the block it touched |
| `phantomRush` | skill: Phantom Rush | a box flashes out of the block it touched |
| `thickSmoke` | skill: Thick Smoke | the cursor kicks (a column of light, a ring) |
| `vanish` | skill: Vanish | a box flashes out of the block it touched |
| `nightCloak` | skill: Night Cloak | a box flashes out of the block it touched; brackets close in on its foe |
| `brittle` | skill: Brittle | a box flashes out of the block it touched; brackets close in on its foe |
| `shatterburst` | skill: Shatterburst | a bolt from the foe just hit on to the next |
| `iceAge` | skill: Ice Age | a box flashes out of the block it touched |
| `longBend` | skill: Long Bend | every red on the bar flashes |
| `frostAura` | skill: Frost Aura | every red on the bar flashes |
| `coldShoulder` | skill: Cold Shoulder | a box flashes out of the block it touched |
| `skater` | skill: Skater | a box flashes out of the block it touched; brackets close in on its foe |
| `frostTrail` | skill: Frost Trail | a box flashes out of the block it touched |
| `blackIce` | skill: Black Ice | a box flashes out of the block it touched |
| `quickThorns` | skill: Quick Thorns | a ring on its ally (thornling) |
| `thornRush` | skill: Thorn Rush | a ring on its ally; sparks off the meter (thornling) |
| `rooted` | skill: Rooted | a ring on its ally (thornling) |
| `quickBrace` | skill: Quick Brace | a ring on its ally (barkback) |
| `splinters` | skill: Splinters | a bolt to its foe, then the hit |
| `rootCall` | skill: Root Call | a box flashes out of the block it touched |
| `brightMoth` | skill: Bright Moth | heal stars twinkle up round the hero, +N there |
| `moonglow` | skill: Moonglow | every red on the bar flashes |
| `pollenBurst` | skill: Pollen Burst | a bolt to its foe, then the hit |
| `stockpile` | skill: Stockpile | the block it made lands with a twinkle (keg) |
| `restock` | skill: Restock | a box flashes out of the block it touched; the block it made lands with a twinkle (keg) |
| `minefield` | skill: Minefield | a box flashes out of the block it touched |
| `packedPowder` | skill: Wide Blast | where the kegs blew |
| `shrapnel` | skill: Shrapnel | where the kegs blew |
| `powderLine` | skill: Powder Line | a box flashes out of the block it touched |
| `heavyPowder` | skill: Heavy Powder | where the kegs blew |
| `shockwave` | skill: Shockwave | every red on the bar flashes |
| `kaboom` | skill: Kaboom | where the kegs blew; sparks off the meter |
| `sureGuard` | skill: Sure Guard | a mote flies from the block into the style tab |
| `deepGuard` | skill: Deep Guard | a box flashes out of the block it touched; brackets close in on its foe |
| `avalanche` | skill: Avalanche | a bolt from the foe just hit on to the next |
| `heavySlam` | skill: Heavy Slam | brackets close in on its foe |
| `wideSlam` | skill: Wide Slam | a bolt from the foe just hit on to the next |
| `retaliate` | skill: Retaliate | a bolt to its foe, then the hit |
| `longRampart` | skill: Long Rampart | the bar's left end (a blocker's slab, or a flash) |
| `wallUp` | skill: Wall Up | the bar's left end (a blocker's slab, or a flash) |
| `echoWall` | skill: Echo Wall | sparks off the meter |
| `steadyHand` | skill: Steady Hand | a box flashes out of the block it touched; brackets close in on its foe |
| `fullQuiver` | skill: Full Quiver | a box flashes out of the block it touched |
| `cleanShot` | skill: Clean Shot | a box flashes out of the block it touched; brackets close in on its foe |
| `watchful` | skill: Watchful | a mote flies from the block into the style tab |
| `trickShot` | skill: Trick Shot | a box flashes out of the block it touched |
| `pinningShot` | skill: Pinning Shot | every red on the bar flashes |
| `exposed` | skill: Exposed | a box flashes out of the block it touched; brackets close in on its foe |
| `deadfall` | skill: Deadfall | a bolt to its foe, then the hit |
| `pulverize` | skill: Pulverize | a box flashes out of the block it touched; brackets close in on its foe |
| `haymaker` | skill: Haymaker | a box flashes out of the block it touched; brackets close in on its foe |
| `wreckingBall` | skill: Wrecking Ball | a box flashes out of the block it touched; the cursor kicks (a column of light, a ring) |
| `faultLine` | skill: Fault Line | every red on the bar flashes |
| `rupture` | skill: Rupture | a bolt to its foe, then the hit |
| `landslide` | skill: Landslide | where the blocks it cleared were |
| `seething` | skill: Seething | a mote flies from the bar's left end into the style tab; a ring and sparks on the hero |
| `payback` | skill: Payback | the cursor kicks (a column of light, a ring) |
| `berserk` | skill: Berserk | a box flashes out of the block it touched; brackets close in on its foe |

## Needs from core

Things the view works out from the order of events in a batch, or approximates, that an event field would make exact.
Nothing here blocks a look; each is a robustness or precision gain.

1. **Burn per foe** (the core agent is adding `burn`, seconds left, per enemy): the view reads `enemy.burn` when it's
   there (flames while it's > 0, every burning foe). Until then it holds the flames 1.25 s past each Ember Bite tick
   (and from the bite), and `c.perk.burnFoe` (one foe at a time), so the flames can outlast the burn by up to a second.
2. **Which blocks a perk touched**: Quake, Bend, Parry, Long Bend, Frost Aura, Moonglow, Shockwave, Fault Line and
   Pinning Shot say nothing about the reds they pushed, slowed or pinned; the view flashes every red on the bar (Chill
   Bite: every red of its foe). A list of block ids on the perk event would mark exactly those.
3. **Where coins came from**: a `coins` event has no source. The view takes Bun's from the batch's last `hit` (the
   block just hit), Gold Hoard's from the batch's last `kill`, and the rest from the `perk` event that follows with the
   same id. A `pos` / `enemyId` on `coins` would make it independent of the order.
4. **Spawning perks** (Starlight, Seedling, Fuse Up, Restock, Stockpile, Parting Gift) are matched to the `spawn`
   events just before them in the batch by block kind; a block id on the perk event would make it exact.
5. **Shadow Dash's landing** is detected by the view (the cursor passing `to`); the slow patch at the landing spot is
   recognised as the dash's by place and time (a `zoneOn` slow within 0.8 s of a dash, over its `to`). A `dash` flag
   (or its own zone kind, e.g. `'slowDash'`, which `drawPatch` already paints in violet) would make it exact.
6. **Finisher perks** (Crescendo, Quick Draw, Death Mark) carry no targets; the view marks every foe (or the foe just
   hit). The finisher's own `targets` come in its event, after them.
