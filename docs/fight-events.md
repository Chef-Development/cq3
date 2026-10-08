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
| a shield bash (`bash`) | a heater shield flies from the hero's guard to its foe, spinning edge-on and back with a steel streak, and lands with a clang: the foe flashes and is knocked back, steel sparks and chips, a steel number (Perfect: a bigger shield, a starburst, a ring, a brighter, bigger number; impact tier `'slam'`, `audio.shieldCounter(perfect)`) | `onsite.shieldSlam` |
| a red turning (`turn`) | the red becomes the block its perk made where it stood, no drop-in: Turnabout's red turns edge-on to a line and the keg widens out of it (a puff of smoke, an orange ring); Big Freeze's ice climbs up the red from its foot, a white flash, and it is a frozen block | `bar.turnInto` (dying styles `flip`, `iceOver`) |
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
| `zoneOn` `'land'` (Shadow Dash's landing) | a violet glow from the landing spot that deepens toward the block the dash aimed at, three chevrons pointing back against the run (braking) and closing up toward it, a bright wall where the block begins; violet corner brackets on that block while the cursor brakes; the cursor in it: a violet smear and glow (bar-kinds.ts `drawPatch`, bar.ts `drawLandTarget`). No puff when it's laid (it comes with its dash) |
| `zoneOn` slow | a frost-blue rune strip with dashed rims and glyphs pulsing one after another; bright ends only on a narrow one (so Glacier's three patches read as one slow bar); any patch kind the view doesn't know is painted like a slow patch |
| `pet` (a companion attacks) | fliers swoop, walkers dash in, the number on the target; **Sunny**: a wall of fire sweeps across every foe from the nearest to the farthest, each struck (its number) as the fire reaches it; **Newt**: its bite sets the foe burning |
| `ally` call / act `power`, act `amount` | an ally's power (`power` on call and act, from the Companion stat) shows on it: from x1.15 a soft breathing glow round each ally in its colour; a stronger Thornling's thorn comes as two bolts (from x1.2) with a bigger hit, its number full size from x1.4, a stronger Glowmoth's heal brings more stars round the hero (the act's `amount` is the number: on the foe, or the +N on the hero) |
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
| Newt | Ember Bite (burns its target) | flames lick up every foe with `burn > 0` (several can burn at once; tapered tongues, embers rising), taller the hotter its `burnDps` (up to half again at 3% of its HP a second); each `'emberBite'` tick flares them, a small orange number |
| Pip | Owl Watch, Night Watch | a streak from Pip to the trap (or red); a box there |
| Sprocket | Oil Can | (ready: the gold Perfect zones on every block) a streak from Sprocket to the block hit Perfectly; a gold box there |
| Brick | Rock Wall | (ready: its slab at the left end) a pebble from Brick to the left end; its slab takes the red |
| Flurry | Chill Bite, Snow Dash | a streak from Flurry to the red; its reds frost over (the chill's own look) and flash |

### The heroes' moments (playtest round 6)

| Hero | Moment | What shows, on what |
| --- | --- | --- |
| Hollis | Shield Slam (every block) | a shield bash from the hero into the red's foe (`bash` above), a steel number; Perfect: bigger. The "Slam!" word at most every 1.6 s (the slam itself shows each time). Heavy Slam / Retaliate: that slam lands heavier (a ground shock, a hot-steel starburst). Wide Slam: smaller shields into every other foe, small steel numbers |
| Hollis | Bulwark ready (full Guard) | the Guard tab on the bar's frame glows steel and breathes, a bright rim with a glint running round it; the cursor is armed: a steel aura round the blade and a shield bobbing over its top cap, a glint now and then (`onsite.drawReady`) |
| Hollis | Bulwark (`'bulwark'` + `'bulwarkBlow'`) | the hero slams down (a white flash, rings, a shock, dust, a big shake, tier `'bulwark'`, `audio.bulwark()`); a great shield sweeps from the hero across every foe, its wake behind it; each foe is struck as it reaches it (a big steel hit, a starburst, a ring, a ground shock, a big steel number); the whole bar flashes, a steel box on the block that set it off, the Guard tab bursts (`onsite.bulwark`, `drawWaves`). "Bulwark" in the bar's callouts (the blows have no word) |
| Neve | Glacier (`chillMult === 0`) | every red frozen solid where it is: an ice shell a size larger than the red (ink rim, a pale blue wash the red reads through, a facet, a flake, a glint), cracking in steps as it thaws (half, a third, a sixth left), dripping, blinking in its last moment (`bar-kinds` `drawSolid`; Neve's reds only); frost chips off each as it freezes. The whole bar slowed for 1.5 s (three slow patches reading as one strip), then the middle patch |
| Neve | Big Freeze | each frozen red ices over where it stands into a frozen block (`turn` above), "Ice!" |
| Tam | Turnabout | each red flips into a keg where it stood (`turn` above), "Flip!" |
| Torva | Wind-Up armed | its smash multiplier now (`windUpMult(c)`, "x2.6") rides over the cursor in hot orange, breathing (`onsite.drawWindUp`); the cursor burns as before |
| Torva | Wind-Up lands | "x2.6!" (the event's amount / 100) beside the foe it smashed, left of its damage number; the callout word is the multiplier too |
| Vesper | targets (`Block.target`) | a target green: a soft green halo behind it, a bullseye ring round its "+", corner brackets just outside that breathe in and out; at full Focus all of it turns gold and quickens, a sparkle on its corner (the shot will crit) (bar.ts `targetHalo`, `targetMarks`) |
| Vesper | Patience | a gold box on the Perfect hit that fired it, a gold starburst on the foe it struck, "Snipe!" beside "Shot!" |
| Sable | the dash lands | the `'land'` zone (events above): the brake toward the block, brackets on it |
| Moss | ally power | see `ally` power above |
| Newt | a burn per foe | see the companions |

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
| `glacier` | Neve: Glacier | every red frozen solid (frost chips off each; their ice shell while it lasts) |
| `bend` | Controller style: Bend | every red on the bar flashes |
| `rally` | Moss: Rally | its own show |
| `thornling` | Moss: Thornling | a bolt to its foe, then the hit |
| `barkback` | Moss: Barkback | the bar's left end (a blocker's slab, or a flash) |
| `glowmoth` | Moss: Glowmoth | heal stars twinkle up round the hero, +N there |
| `seedling` | Moss: Seedling | the block it made lands with a twinkle (green) |
| `fuseUp` | Tam: Fuse Up | the block it made lands with a twinkle (keg) |
| `bigBang` | Tam: Big Bang | its own show |
| `guardUp` | Guardian style: Guard stored | a mote flies from the block into the style tab |
| `shieldSlam` | Hollis: Shield Slam | a shield bashes into its foe, a steel number (Perfect: bigger) |
| `bulwark` | Guardian style: Bulwark | its own show (the great shield across every foe) |
| `bulwarkBlow` | Guardian style: Bulwark's blow | each foe struck as the great shield reaches it |
| `powerShot` | Marksman style: Power Shot | a bolt to its foe, then the hit |
| `pierce` | Vesper: Piercing Shot | a bolt from the foe just hit on to the next |
| `volley` | Vesper: Volley | its own show |
| `patience` | Vesper: Patience | a gold box on the hit; a gold starburst on its foe |
| `quake` | Torva: Quake | every red on the bar flashes |
| `windUp` | Torva: Wind-Up | a box flashes out of the block it touched; brackets close in on its foe; "x2.6!" beside it |
| `secondSwing` | Torva: Second Swing (5 stars) | sparks off the meter |
| `luckyFoot` | Bun: Lucky Foot | coins pop out of what dropped them into the coin counter (from: block) |
| `owlWatch` | Pip: Owl Watch | a streak from the companion to what it touched; a box flashes out of the block it touched |
| `emberBite` | Newt: Ember Bite | flames on every burning foe (`e.burn`), a small orange tick number |
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
| `healCap` | the fight's heals used up ("No more heals", once a fight; tuning.spam.healCap) | a ring and sparks on the hero |
| `missCap` | no more misses forgiven this fight ("No more saves", once; tuning.spam.forgiveMax) | the combo counter flashes |
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
| `bigFreeze` | skill: Big Freeze | each frozen red ices over into a frozen block where it stood |
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
| `turnabout` | skill: Turnabout | each red flips into a keg where it stood |
| `restock` | skill: Restock | a box flashes out of the block it touched; the block it made lands with a twinkle (keg) |
| `minefield` | skill: Minefield | a box flashes out of the block it touched |
| `packedPowder` | skill: Wide Blast | where the kegs blew |
| `shrapnel` | skill: Shrapnel | where the kegs blew |
| `powderLine` | skill: Powder Line | a box flashes out of the block it touched |
| `heavyPowder` | skill: Heavy Powder | where the kegs blew |
| `shockwave` | skill: Shockwave | every red on the bar flashes |
| `kaboom` | skill: Kaboom | where the kegs blew; sparks off the meter |
| `sureGuard` | skill: Sure Guard | a mote flies from the block into the style tab |
| `deepGuard` | skill: Deep Guard | a box flashes out of the block that set the Bulwark off |
| `avalanche` | skill: Avalanche | every foe is marked (and their stun stars) |
| `heavySlam` | skill: Heavy Slam | the slam lands heavier on its foe (a ground shock, a hot-steel starburst) |
| `wideSlam` | skill: Wide Slam | smaller shields bash every other foe, small steel numbers |
| `retaliate` | skill: Retaliate | the slam lands heavier on its foe, as Heavy Slam |
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
| `fireBrew` | Fizz: a fire flask (Mixed Brew) | flames lick up off the bar where it blew; every foe burning (`Enemy.burn`'s flames) |
| `frostBrew` | Fizz: a frost flask | a cold ring and shards off the bar where it blew; every red flashes (and wears the chill's frost) |
| `sparkBrew` | Fizz: a spark flask | green lightning forks out along the bar to the wide blast's edges, a white flash; where it blew |
| `brewBurn` | Fizz: a burn's tick | flames flare on the foe, a small orange number (as Newt's; Newt ticks them when he's along) |
| `toss` | Fizz: Toss | a flask in its brew's glass arcs from her hand to the foe, spinning, and shatters there (glass chips, the brew's splash), then the number |
| `fumeMask` | Fizz: Fume Mask | a ring and sparks on the hero |
| `grandReaction` | Fizz: Grand Reaction | its own show (the flasks' blasts show on the bar) |
| `slowBurn`, `hardFrost`, `wildfire`, `longArm`, `splash`, `doubleToss`, `meltdown`, `fumeHood`, `catalyst` | Fizz's skill nodes | foes / the new red / its foe / its foe / a bolt on to the next / the target / the patches melted / the combo counter / where the flasks blew |
| `toll` | Brann: Toll | a little bell swings in the bar's track where he blocked, sound rings off it; a mote into the style tab (its toll pips) |
| `tollHit` | Brann: the hit that spends the tolls | a box on the block hit; a bell's boom on its foe (more rings with more tolls) |
| `peal` | Brann: Peal | arcs of sound roll from him to each foe; each struck (a bronze ring, a number) as they reach it |
| `stillMind` | Brann: Still Mind | a mote flies from the block into the style tab |
| `greatBell` | Brann: Great Bell | its own show (each foe's stun stars) |
| `bellBoom` | Brann: Great Bell's boom on the other foes (5 stars, Echoing Bell: harder) | a bolt to its foe, then the hit |
| `loudToll`, `doubleToll`, `resound`, `longPeal`, `resonance`, `bellWard`, `unshaken`, `stunningToll`, `innerBell` | Brann's skill nodes | the block and its foe / the tab / a bolt on to the next / the cursor / the tab / the left end / the hero / the block and its foe / the tab (the Bulwark shows itself) |

## Needs from core

Things the view works out from the order of events in a batch, or approximates, that an event field would make exact.
Nothing here blocks a look; each is a robustness or precision gain.

1. ~~**Burn per foe**~~ (resolved in round 6): the view reads `Enemy.burn` (flames on every foe with `burn > 0`) and
   `burnDps` (their height). The old hold-past-the-tick fallback only runs if `burn` is missing.
2. **Which blocks a perk touched**: Quake, Bend, Parry, Long Bend, Frost Aura, Moonglow, Shockwave, Fault Line and
   Pinning Shot say nothing about the reds they pushed, slowed or pinned; the view flashes every red on the bar (Chill
   Bite: every red of its foe). A list of block ids on the perk event would mark exactly those.
3. **Where coins came from**: a `coins` event has no source. The view takes Bun's from the batch's last `hit` (the
   block just hit), Gold Hoard's from the batch's last `kill`, and the rest from the `perk` event that follows with the
   same id. A `pos` / `enemyId` on `coins` would make it independent of the order.
4. **Spawning perks** (Starlight, Seedling, Fuse Up, Restock, Parting Gift) are matched to the `spawn` events just
   before them in the batch by block kind; Turnabout's keg and Big Freeze's frozen block by kind and `pos` (the red's
   `remove` and the new block's `spawn` sit at the same spot). A block id on the perk event would make it exact.
5. ~~**Shadow Dash's landing**~~ (resolved in round 6): its own zone kind, `'land'`, is drawn as such; the old
   place-and-time guess is gone. (The landing burst itself is still detected by the cursor passing `to`.)
6. **Finisher perks** (Crescendo, Quick Draw, Death Mark) carry no targets; the view marks every foe (or the foe just
   hit). The finisher's own `targets` come in its event, after them.
7. **Heavy Slam / Retaliate** name the foe and the block but come apart from the slam they boost; the view lands the
   next slam heavier when one came within its flight (about 130 ms). A flag on the `'shieldSlam'` perk event would make
   it exact.
8. **Patience's foe**: its perk event has `pos` but no foe (`enemyId` 0); the view uses the batch's hit's foe (else the
   current target). The `'powerShot'` strike after it does name the foe.

## What the core emits for the view (playtest round 6)

What the combat core (`src/core/`) now emits or exposes for the fight's drawing and sound. Names are stable: draw
from these. Everything else about events is in `CombatEvent` (`src/core/combat.ts`). "Perk event" = `{ type: 'perk',
id, amount, enemyId, pos? }` (from `c.perkFx`); a perk's blow on a foe is a perk event followed by an `enemyHurt` with
`source: 'perk'`.

### Changed for every perk blow

- **`enemyHurt.perk?: string`** (new, optional): which perk struck (`'shieldSlam'`, `'bulwarkBlow'`, `'emberBite'`,
  `'thornling'`, `'powerShot'`...). Set on every `c.strike(...)`; absent for taps, bombs, finishers and pets. Use it to
  style a damage number per source.
- **`c.strike(e, dmg, id, crit?, pos?)`**: the perk event now carries `pos` (where on the bar it came from) when the
  caller knows it (Shield Slam, Wide Slam, Bulwark blows).
- **`{ type: 'hitStop', ms }`** now also comes from perks with their own freeze (`c.hitStopFor(ms)`): a Shield Slam
  (`tuning.juice.slamStopMs`, 35 ms) and a Bulwark (`juice.bulwarkStopMs`, 110 ms). The sim (cursor, reds) is frozen
  for `ms`; scale the scene's own freeze/shake with the impact tiers below.
- **Impact tiers** (`core/impact.ts`): new `'slam'` (weight 0.35: between block and crit) and `'bulwark'` (0.82:
  between a 5-stack finisher and a kill). `IMPACT_TIERS` has 10 entries now.

### Hollis (Guardian): the block is his moment

- **Shield Slam, every block**: after each `block` event (a plain one too; a cracked shield too), a perk event
  `'shieldSlam'` (amount = damage, enemyId = the red's owner, pos = the block) and its `enemyHurt` (`perk:
  'shieldSlam'`), then a `hitStop` (35 ms). A Perfect block's slam is bigger (`kits.hollis.slamPerfect` vs `slam`; the
  `block` event just before says `perfect`). Look: a shield-bash bolt from the hero to the owner, a chunky metal
  number (bigger/brighter for a Perfect), the tier `'slam'`. Sound: `audio.shieldCounter(perfect)` (SFX ids
  `shieldCounter`, `shieldCounterPerfect`) over the block's own clang.
- **Guard** (style readout): still `c.perk.guard` (0..`guardMax(c)`: 5, 7 at 3 stars), `'guardUp'` perk event per
  charge (amount = Guard now). Hits **no longer spend it** (the old `'guard'` "Bash!" event is gone).
- **Bulwark**: at full Guard the next block or hit sets it off. Perk event `'bulwark'` (amount = charges spent, pos =
  the block/hit) = the moment; then one `'bulwarkBlow'` strike per living foe (perk event + `enemyHurt` with `perk:
  'bulwarkBlow'`), then `hitStop` 110 ms. Look: a big shield shockwave from the hero across every foe, impact tier
  `'bulwark'` (2 white frames, music duck), Guard pips flash and empty. Sound: `audio.bulwark()` (SFX id `bulwark`).
  "Bulwark ready" = `guardOf(c) >= guardMax(c)` (from `core/styles`): worth a ready glow on the Guard tab.
- Skill nodes around it: `'deepGuard'` (perk event after a Bulwark), `'avalanche'` (a Bulwark stuns every foe: perk
  event + `stun` events), `'retaliate'` (amount = Guard stored: the slam was boosted), `'heavySlam'`, `'wideSlam'`
  (strikes on the other foes, pos = the block).

### Neve (Controller)

- **Glacier** (finisher): every red on the bar is **frozen solid where it is**, not turned to ice: each red keeps
  `kind` red/shield/bomb/speed with `chill > 0` and `chillMult === 0` for `kits.neve.glacierSec` (2.5 s); one at the
  left end and an icicle (`still`) wait too. Perk event `'glacier'` (amount = reds frozen). Look: a hard ice coat on
  each red (the current 'pin' frost style is close; make it read as frozen solid), cracking as it thaws.
- **Whole bar slowed**: Glacier lays three `'slow'` zones (`zoneOn` events): the middle patch (`slowWidth`, life
  `slowSec` 4 s) and the two ends (`[0, lo]`, `[hi, 1]`, life `glacierBarSec` 1.5 s). So the whole bar is slow for
  1.5 s, then only the middle. (5 stars: one zone over the whole bar for 4 s.)
- **Big Freeze** (skill node): after Glacier, every red becomes a frozen block (`remove` reason `'perk'`, `spawn` kind
  `'frozen'`, `iceBlock` event) to smash; perk event `'bigFreeze'` (amount = how many).
- Cold Snap no longer gives shattered ice a green's meter (no event change).

### Tam (Bomber): Turnabout (skill node)

- Big Bang with Turnabout turns every red into one of her kegs where it was: `remove` (reason `'perk'`) of the red,
  `spawn` of a `'keg'`, and a perk event `'turnabout'` (enemyId = the red's owner, pos = where) per red. Look: the
  red flips into a keg with a puff (they're her kegs: hit to blast every foe).

### Torva (Brute): Wind-Up grows with the combo

- The smash multiplier is `windUpMult(c)` (`core/kit-fx`): `windUpBase + windUpStep x combo`, up to `windUpMax`
  (1.8 + 0.04/combo, max x4). While armed (`c.perk.windUp === 1`), the bar's wind-up mark can show it live (e.g.
  "x2.6"). When it lands, the `'windUp'` perk event's **amount = the multiplier x100** (e.g. 260). Show the number.

### Vesper (Marksman): targets

- **`Block.target: boolean`** (new): `true` on every green spawned on a Marksman's bar (they come x1.35 wide:
  `styles.targetWidth`). A green fires the stored Focus as a Power Shot. Draw them as targets (a ring/reticle on the
  green; brighter when Focus is full, `focusOf(c) >= focusCap(c)` from `core/styles`).
- **Patience on a crowded bar**: at full Focus with no green on the bar (or only behind a mirror shard), a Perfect hit
  fires the shot (a crit). Perk event `'patience'` (amount = damage, pos = the hit), with the `'powerShot'` strike
  (`enemyHurt.perk: 'powerShot'`, `crit: true`).
- **Volley** now pins icicles too (`still` reds: `chill > 0`, `chillMult === 0`, their fuse waits), and a red pinned
  at the left end waits instead of striking. The arrow-pinned look should cover icicles.

### Moss (Summoner): allies scale with the Companion stat

- `allyPower(c)` (`core/styles`): 1 for a fresh hero, +`kits.moss.allyComp` per Companion point above a fresh hero's
  (as a share of it). Thornling jabs and Glowmoth heals scale with it (a Barkback still stops one red, a Seedling plants
  one green).
- **`ally` events** gain optional fields: `power` (on `'call'` and `'act'`) and `amount` (on `'act'`: a Thornling's
  damage, a Glowmoth's heal; 0 for a brace or a seed). Look: allies a bit bigger/brighter with power (e.g. a glow
  from 1.3), the act's number over the ally or its target.

### Sable (Shadow): the dash lands slow

- After a `dash` event, a `'land'` zone (`zoneOn` kind `'land'`) runs from the landing spot (`dash.to`) toward the
  block the dash aimed at, ending at its near edge; inside it the cursor runs at `kits.sable.landMult` (x0.5) for about
  `kits.sable.landSec` (0.3 s). It goes (`zoneOff`) once the cursor is through it. **New zone kind `'land'`**: today
  `drawPatch` draws nothing for it and the cursor tints as if in snow. Look: the streak's afterimage settling, a soft
  "brake" glow ahead of the cursor, the target block highlighted. (The `'dash'` zone is unchanged.)

### Newt (companion): a burn per foe

- **`Enemy.burn`** (seconds left), **`Enemy.burnDps`** (damage a second), **`Enemy.burnTick`** (seconds to the next
  tick): set by a Newt bite on its target (refreshed by the next bite), 0 when not burning. Each second a tick is an
  `'emberBite'` strike (perk event + `enemyHurt` with `perk: 'emberBite'`). Draw flames on every foe with `burn > 0`
  (bigger with `burnDps`), and the tick numbers in ember orange.
- The old `c.perk.burnFoe` / `c.perk.burnTicks` are still kept for the last foe bitten (the current flames read
  them), but move to `e.burn`: several foes can burn at once now.

## The finisher show (playtest round 7: every hero's finisher their own)

The core's `finisher` event (`damage`, `stacks`, `targets`) starts the show; the core holds the cursor for
`finisherShowMs(stacks)` and the show always fits inside it. The plan is pure (`src/core/finisher-show.ts`, tested in
`tests/unit/finisher-show.test.ts`); the drawing is `view/finishers.ts` (runs a show), `view/finisher-kits.ts` (the
eight style kits) and `view/finisher-signatures.ts` (each hero's moment, and each style's default).

- **Timeline** (`showTimeline(tier, stacks)`): the build-up, then `finisherStrikes(stacks)` strikes up to 70% of the
  show (an Epic hero strikes exactly on `finisherStrikeAt`), the last blow at `FINISHER_BLOW_AT`, the hero home after.
- **Style kit** (shared by every hero of the style): its own sky (behind the actors, over the stage's), strike, last
  blow layer, marks and sound layer (`audio.finisherFlavor`).

| Style | Sky | Strike | Last blow | Sound layer |
| --- | --- | --- | --- | --- |
| Blade | pale steel, speed lines, cut by each strike | crescent slashes, a steel glint, a cut that lingers | a cross of crescents, a long cut that splits | blade ring |
| Shadow | moonlit violet night, mist | violet afterimages beside the foe, an X cut, a rift, ink smoke | a tall rift tears open, jaws of shadow snap | whoosh, dark thud |
| Guardian | royal blue, golden rays | a shield flung edge-on into the foe, a shield arc | a steel dome of a shockwave, the tower emblem | shield clang, gong |
| Marksman | dusk, first stars, the sun low | an arrow streaks in and sticks; reticles close and tick | reticles lock gold; one great arrow pierces all | bowstring, volley |
| Brute | dust storm, rocks floating up | a heavy blow cracks the ground, debris | rock spikes burst up | rock crunch, rumble |
| Controller | aurora, snow; cold mist on the ground | an ice spike stabs up, frost shards | the foe locked in an ice crystal that shatters | ice crack, shatter |
| Summoner | deep grove, light shafts, leaves | a spirit wisp arcs in, bursts into leaves, a vine lash | vines coil up the foe, a burst of leaves | leafy rush, chime |
| Bomber | smoke over a burning horizon, embers | a bomb lobbed in an arc blows on the foe | a fireball that rolls into a smoke column | fuse, booms |

- **Signature moment** (`HERO_SIGNATURE`; a hero without one plays their style's `STYLE_DEFAULT`):

| Hero | Moment |
| --- | --- |
| Rowan | a steel whirlwind sweeps through every foe and bursts into a ring of blades |
| Sable | sinks into her shadow, it slides under the target, she bursts out of its shadow; twin fangs cross on it |
| Neve | frost creeps to the foes, a glacier rises behind them, surges over them at the blow and shatters |
| Moss | a seed flies over the foes, a great tree grows behind them; roots burst up, a leaf storm |
| Tam | a keg bigger than she is lobbed among the foes; its fuse burns down, it swells, the biggest blast |
| Hollis | a wall of stone and steel (his banner on it) rises before him and topples onto the foes |
| Vesper | one arrow up bursts into a sky of arrows over the foes; they rain down; a giant golden arrow last |
| Torva | a towering leap, a slam, the earth splits to the foes glowing with magma and erupts under them |

- **Rarity scaler** (`showScale(tier)`): a longer build-up inside the same total, more layers (the rarity's colour
  charging behind the hero and light converging on them, rings and sparkles on the strikes), a bigger flash and
  shake, darker stage edges, a fuller sky with more animated layers; Celestial adds falling stars, Divine a prism.
- The blow's hit and the counting number stay the fighters' (`heroFinisher`); with three or more targets the numbers
  are smaller and staggered. The Test lab's **Finisher gallery** (`view/finisher-gallery.ts`) plays any of it on demand.
