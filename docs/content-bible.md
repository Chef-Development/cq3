# Content bible (SPOILERS: region enemies, bosses, story, music)

The playtester wants to be surprised by region content. **Region names, enemies, mini-bosses, bosses, their
mechanics and the plot live here only** (never in PR titles or the final message). Heroes, companions and systems are
not secret; they are listed here too because the art, story and code all read from this one spec.

Tone everywhere: cheeky and light (see `src/data/story.ts`). Original names and art only.

---

## 1. Rarity tiers (shared by gear, heroes and companions)

| Tier | Colour | What it adds (beyond bigger numbers) |
|---|---|---|
| Common | grey | - |
| Uncommon | green | - |
| Rare | blue | - |
| Epic | purple | - |
| Legendary | orange | gear: a unique effect |
| Mythic | red | gear: a unique effect, more bonus stats |
| Celestial | pale cyan + star sparkles | gear: **a second unique effect**; heroes/companions: an extra kit part |
| Divine | prismatic gold | gear: two unique effects **and an aura** (a fight-wide rule); heroes/companions: an aura |

Celestial and Divine are a post-story chase: tiny odds in Regions 1-3 and the shrine's top pity tier only.

---

## 2. Styles (broad archetypes; a hero = style + signature + ability + passive + finisher + tree + rarity)

Each style is a shared rule built as hooks into the core (`src/core/styles.ts`), so later heroes of the same style
reuse it. One number each in `tuning.styles`.

| Style | Rewards | Shared rule (in the game's words) |
|---|---|---|
| Blade | combos and finisher stacks | **Edge:** at 20+ combo, the meter fills 20% faster. |
| Shadow | chains of Perfect hits | **Chain:** each Perfect hit in a row adds +8% damage (up to 5 links); anything else resets it. |
| Guardian | blocking turns into damage | **Guard:** each red you block stores Guard; your next hit releases it as bonus damage. |
| Marksman | store power, spend it in bursts | **Focus:** hits deal 80% and store Focus; a green hit fires all Focus as a Power Shot. |
| Brute | fewer, heavier taps | **Heavy:** fewer, wider yellows; every hit deals x1.6. |
| Controller | bending the bar | **Bend:** a Perfect block slows every red on the bar for 1 s. |
| Summoner | allies that fight for you | **Call:** green hits call an ally (up to 3 at once); each stays 10 s and acts on its own. |
| Bomber | area damage from your own hazards | **Powder:** kegs appear on the bar by themselves; hit one like any block and it blasts every foe. |

## 3. Heroes (one per style; Mythic+ heroes come later)

| Hero | Style | Rarity | Joins |
|---|---|---|---|
| Rowan | Blade | Rare | the start |
| Sable | Shadow | Epic | story (after Region 1, Act 1) |
| Neve | Controller | Legendary | story (Region 2, after the Act 1 mini-boss) |
| Moss | Summoner | Epic | hero chests |
| Tam | Bomber | Rare | hero chests |
| Hollis | Guardian | Rare | hero chests |
| Vesper | Marksman | Legendary | hero chests |
| Torva | Brute | Epic | hero chests |

Higher rarity = a richer kit: Legendary heroes' finishers do two things to the bar, and their passives interact with
the region rules.

### Rowan, Junior Knight (Blade, Rare) — starter
- Look: unchanged.
- Signature **Whirlwind sweep**: his finisher strikes every foe.
- Ability (green) **Battle Focus**: +10% crit for 3 s.
- Passive **Knight's Resolve**: the first hit you take each fight doesn't break your combo.
- Finisher **Whirlwind**: hits all foes, clears every red off the bar.
- Strength: +20% damage to Folk (bandits, knights, captains...).

### Sable, Shadow Ninja (Shadow, Epic) — reworked to one cursor
- Look: unchanged (plum hood, teal scarf, two daggers).
- Signature **Shadow Dash**: a Perfect hit makes the cursor dash ahead to just before the next block, so chains of
  Perfects come fast and risky. It stops before a red (so you can block it), skips traps, lands before a hold's start,
  and counts ice patches when it picks the lead-in.
- Ability (green) **Smoke Veil**: for 3 s, a miss doesn't break your combo or your Chain.
- Passive **Silent Step**: Perfect hits fill the meter 25% more.
- Finisher **Twin Fang**: hits the target alone, harder; a kill keeps 1 stack; clears all reds.
- Strength: +20% damage to Casters.

### Neve, Frost Mage (Controller, Legendary) — joins in the Frostpeaks story
- Look: a young frost mage: a pale-blue robe with white fur trim, a deep-navy sash, silver hair in a long braid,
  frost-white boots, a staff topped by a floating ice crystal. Palette: navy, ice blue, white, silver; a cyan glow.
- Signature **Flash Freeze**: blocking a red can freeze it in place (always on a Perfect block, else 35%): it becomes a
  frozen block that sits still. Hit a frozen block and it shatters for x2 damage (it melts after 6 s).
- Ability (green) **Chill**: for 3 s, the cursor moves 25% slower.
- Passive **Cold Snap**: shattering a frozen block fills the meter like a green; ice patches speed her cursor up only
  half as much.
- Finisher **Glacier**: hits every foe (x0.8), freezes every red on the bar into frozen blocks, and lays a slow patch
  over the middle of the bar for 4 s. (Reshapes the bar.)
- Strength: +20% damage to Beasts; ice patches bother her half as much.

### Moss, Grove Caller (Summoner, Epic)
- Look: a small round grove keeper (gnome-sized), a cloak of overlapping leaves, a twig crown with two buds, a big
  soft nose, a crooked wooden staff topped by a glowing seed. Palette: leaf greens, bark browns, a warm seed-glow.
- Allies (called by green hits, in this order, up to 3 at once, each for 10 s; a 4th call refreshes them all and they
  act at once, "Rally!"):
  - **Thornling** (attack): a spiky seed-sprout; jabs the target for 40% of your attack every 1.5 s.
  - **Barkback** (block): a stump with legs; every 4 s it braces, and blocks the next red that reaches you.
  - **Glowmoth** (heal): a lantern moth; heals 2% of max HP every 3 s.
- Signature **Grove Bond**: allies come in order; a call with all three out is a Rally.
- Ability (green) **Call**: call the next ally.
- Passive **Deep Roots**: while 2+ allies are out, your hits deal +12%.
- Finisher **Overgrowth**: hits all foes, +25% per ally out; vines slow every red on the bar for 3 s.
- Strength: +25% damage to Swarms (summons, splits, little ones).

### Tam, Sapper (Bomber, Rare)
- Look: a short, wiry sapper: brass goggles pushed up on a sooty forehead, an orange bandana, a leather apron full of
  pockets, rolled sleeves, a satchel of round black kegs with fizzing fuses. Palette: soot greys, leather browns, orange.
- Kegs: a keg is a round black block with a lit fuse on the bar. Every 5th yellow comes as a keg. Hit it like any block:
  it blasts every foe for x1.2 attack and knocks the reds near it off the bar (counted as blocked).
- Signature **Chain Fuse**: a keg's blast sets off every keg near it.
- Ability (green) **Fuse Up**: a green hit drops a keg on the bar.
- Passive **Blast Shield**: enemy bombs that reach you deal half damage.
- Finisher **Big Bang**: hits all foes, then drops 3 kegs on the bar. (Fills the bar.)
- Strength: +20% damage to Armored foes (shells, shields).

### Hollis, Shieldwarden (Guardian, Rare)
- Look: a tall, broad shieldwarden with dark brown skin and a short black beard, steel plate with blue cloth, a huge
  tower shield (blue, with a white tower emblem), a short broad sword. Palette: steel, royal blue, white.
- Signature **Shield Slam**: a Perfect block hits the red's owner for 60% of your attack.
- Ability (green) **Brace**: for 3 s, each block stores double Guard and fills the meter double.
- Passive **Iron Hide**: reds that reach you deal 25% less.
- Finisher **Rampart**: hits the target with the finisher plus all stored Guard x2; then for 3 s, reds that reach the
  left end bounce back across the bar instead of hitting you. (Changes the bar's end.)
- Strength: takes 20% less from Brutes.

### Vesper, Dusk Ranger (Marksman, Legendary)
- Look: a tall, keen-eyed ranger with pointed ears, a dusk-purple hooded cloak lined with gold, a silver longbow, a
  quiver of white-fletched arrows, dark green leathers. Palette: dusk purples, gold, silver, forest green.
- Signature **Eagle Eye**: Perfect hits store double Focus.
- Ability (green) **Piercing Shot**: the Power Shot also hits the foe behind the target for half.
- Passive **Patience**: Focus is kept between waves; a full Focus glows (your next green crits).
- Finisher **Volley**: arrows rain on every foe and spend all Focus (x1.5); every red on the bar is pinned in place
  for 2 s. (Freezes reds.)
- Strength: +25% damage to Flyers.

### Torva, Hammer Brute (Brute, Epic)
- Look: a towering, muscular woman with a thick red braid, freckles, fur pauldrons over a leather harness, wrist
  wraps, tattoos on her arms, a giant stone-headed warhammer. Palette: warm skin, red hair, fur greys, stone.
- Signature **Quake**: a Perfect hit knocks every red on the bar back.
- Ability (green) **Wind-Up**: your next hit deals x2.5 and stuns its target for 1.5 s.
- Passive **Unstoppable**: each hit you take adds +8% damage for the rest of the fight (up to 5).
- Finisher **Earthsplitter**: hits all foes and clears the whole bar (every block), and no reds come for 2 s.
- Strength: +20% damage to Constructs (golems, ice knights).

### Stars (1-5, from shards of duplicates)
Every hero: 2★ +6% attack, 4★ +8% max HP. 3★ and 5★ unlock a move (data: `HERO_STARS`):

| Hero | 3★ | 5★ |
|---|---|---|
| Rowan | Whirlwind also banks 1 combo per foe hit | Battle Focus also adds +1 combo per hit |
| Sable | a dash leaves an afterimage that blocks the next red in its path | Twin Fang hits twice |
| Neve | Flash Freeze chance 35% -> 60% | Glacier's slow patch covers the whole bar |
| Moss | allies stay 14 s | a 4th ally type: **Seedling** (plants a green block every 5 s) |
| Tam | kegs every 4th yellow | kegs blast twice as wide |
| Hollis | Guard holds 7 charges | Shield Slam on every block |
| Vesper | Focus cap +50% | Volley pins reds 4 s |
| Torva | Quake also on blocks | Earthsplitter keeps 1 stack |

---

## 4. Companions (equip 1; a camp upgrade unlocks a second slot)

Each fights beside you (an attack every N of your hits) and adds a bar perk. Higher rarity = more functions. They
level up with the XP your hero earns while they are equipped (max 20, +4% damage a level) and gain stars from
duplicates (each star: +12% damage, perk numbers up a step; 3★ attacks one hit sooner).

| Companion | Rarity | Look | Attack | Perks |
|---|---|---|---|---|
| Bun | Common | a fluffy white rabbit with a tiny satchel | kicks every 5 hits | **Lucky Foot:** every 10th hit finds a coin |
| Pip | Uncommon | the owl (existing) | pecks every 4 hits | **Owl Watch:** the first trap each fight is pecked away |
| Newt | Uncommon | a small orange salamander, flame-tipped tail | bites every 4 hits | **Ember Bite:** bites burn the target (3 damage a second for 3 s) |
| Sprocket | Rare | a little clockwork robot with a wind-up key | zaps every 5 hits | **Oil Can:** every 8 s, the next block has a wider Perfect zone |
| Brick | Rare | a rock golem pup with moss on its back | headbutts every 6 hits | **Rock Wall:** every 15 s, blocks a red that reaches you |
| Flurry | Epic | a white snow fox with a frosty tail | bites every 4 hits | **Chill Bite:** bites slow the target's reds; **Snow Dash:** after a block, the next red slows for 1 s |
| Mote | Epic | a tiny star wisp | twinkles every 5 hits | **Starlight:** every 15 combo, a green block appears; **Mend:** at 10+ combo, heals 1% every 5 s |
| Sunny | Legendary | a golden drake whelp | breathes on every foe every 6 hits | **Gold Hoard:** +15% coins; **Fire Breath:** at 25+ combo, its breath burns away traps; **Warm Glow:** ice patches under you melt twice as fast |

---

## 5. Region 2: THE FROSTPEAKS (secret)

A land frozen in one endless winter. The second weight fell on the peaks and froze time there: the snow never stops,
and everyone is stuck in the same cold afternoon. A vain wyrm has piled it into her hoard.

### Bar rules, introduced gradually
- **Ice patches** (Act 1 onward): stretches of the bar where the cursor speeds up (x1.6), so blocks on ice need earlier
  taps. Drawn as pale cyan glassy strips with a sparkle; the cursor leaves a streak there.
- **Hold blocks** (Act 2 onward): long frozen blocks. Hold your finger from the block's start to its end; letting go
  early is a miss. Drawn as a long ice-blue bar with a start notch and an end notch; a fill shows how far you've held.
  A hold never triggers the finisher swipe.
- **Act 3 twist: snowdrifts** — patches where the cursor slows (x0.6), set beside ice, so one sweep goes fast-slow-fast
  and every block has to be re-timed. An Aurora makes the patches slide along the bar.

### Acts
| Act | Name | Theme | Rules |
|---|---|---|---|
| 1 | Frostbite Pass | snowy mountain pass, pines, a frozen waterfall, prayer-flag ropes | ice patches (from row 2) |
| 2 | Glimmer Caves | blue ice caverns, hanging icicles, glowing crystals, a frozen underground lake | holds + a little ice |
| 3 | Wyrm's Glacier | a glacier field under an aurora, ice spires, a wyrm's frozen hoard | ice + holds + snowdrifts |

### Enemies (each has a telegraphed special that changes how the bar plays)
| Enemy | Act | Tags | Look | Special |
|---|---|---|---|---|
| Rime Imp | 1 | caster, frost | a small blue imp with frosted horns and a puffy cloud of breath | **Frost Breath!** lays an ice patch where the cursor is heading (6 s) |
| Icicle Bat | 1 | flyer, frost | a pale bat with icicle wings | **Icicles!** marks 2 spots; icicles land there as still reds that strike after 1.6 s unless tapped |
| Yeti Cub | 1 | beast, frost | a round white yeti kid with a snowball | **Snowball!** rolls a red that starts small and grows wider as it comes |
| Snow Ogre (elite) | 1 | brute, frost | a hulking blue-grey ogre with an ice club | **Ice Club!** a wide red that leaves an ice patch when blocked; **Snow Wall!** a still red that needs 3 taps |
| Frost Weaver | 2 | beast, frost | a crystal-backed white spider | **Silk!** turns 2 yellows into holds |
| Ice Wraith | 2 | flyer, caster | a floating hooded wisp of frost with a mirror-like face | **Mirror!** sets a mirror shard on the bar: the cursor bounces back when it reaches it (5 s) |
| Hailcaller | 2 | caster, folk | a hooded goblin with a hail-orb staff | **Hail Armor!** coats up to 3 yellows in ice: they need 2 taps |
| Glacier Tortoise (elite) | 2 | armored, frost | a tortoise whose shell is a glacier | **Brr-icade!** 2 holds and an ice patch at once |
| Drift Troll | 3 | brute, frost | a shaggy snow troll with a shovel | **Snowdrift!** lays a snowdrift (slow patch) where the cursor is heading |
| Aurora Wisp | 3 | flyer, caster | a ribbon of aurora light with a small bright core | **Shimmer!** every patch on the bar slides along it for 4 s |
| Frostbound Knight (elite) | 3 | construct, armored | an armoured knight sealed in ice | **Frost Lock!** a hold on an ice patch; **Glacier Guard!** a still red needing 3 taps |

### Mini-bosses
- **Rimehorn** (Act 1, brute, beast): a colossal mountain ram who "collects the toll" (the toll is one
  headbutt). **Headlong!** a fast wide red that leaves an ice trail over the stretch it crossed; **Avalanche!**
  (below 50%, gate) three icicles at once across the bar, then Headlong comes more often.
- **The Loom Matron** (Act 2, beast, caster): a giant frost spider who weaves ice silk into tapestries of the hoard.
  **Spin!** turns 3 yellows into holds; **Web Line!** one long hold across a quarter of the bar; **Mirror Silk!** (below
  50%, gate) a mirror strand in the middle of the bar for 6 s, again every 10 s.

### Boss: Glacia, the Rime Wyrm (Act 3) — phases rewrite the bar
- Phase 1: **Frozen Wings!** ice patches over both outer fifths of the bar for the phase; **Icicle Rain!** three
  icicles; **Tail Sweep!** a fast wide red.
- Phase 2 (66%, gate, scene `glacia2`): **Hoard Hold!** every 3rd yellow now comes as a hold; **Mirror Scales!** a
  mirror in the middle of the bar for 6 s, every 10 s.
- Phase 3 (33%, gate, scene `glacia3`): **Avalanche!** the bar becomes stripes of ice and snowdrift, sliding slowly;
  the cursor never drops below 1.3x speed.

### Story (scene ids)
- `frost1` (Act 1 start): Pip, Rowan: arriving in endless snow; the clocks here are frozen at the same afternoon.
- `rimehorn` (mini-boss): the toll ram.
- `neveJoin` (after Rimehorn, before Act 2): Neve, a frost mage apprentice, was frozen in her own spell trying to stop
  the wyrm; the fight's shockwave cracks her free. Prickly, proud, secretly delighted to have company. Joins.
- `frost2` (Act 2 start): into the caves; Neve explains the wyrm wants the weight because it makes the winter last
  forever (and winter keeps her hoard shiny).
- `matron` (mini-boss): the Loom Matron weaves tapestries of the hoard; offended you walked on one.
- `frost3` (Act 3 start): the glacier under the aurora.
- `glacia` (boss intro), `glacia2`, `glacia3` (phase scenes), `frostVictory` (the weight home; the Pendulum ticks
  twice; the snow finally falls *down* instead of hanging in the air; next: Ashfell).
- New speakers: `neve`, `rimehorn`, `matron`, `glacia` (portraits).

### Relics (Ice and Hold tags)
Skate Blades, Frost Rune, Hot Cocoa, Icebreaker, Snowplow, Glacier Heart, Frostbite, Melt (Ice); Steady Grip, Long
Note, Hold Fast, Release Valve, Tether, Lucky Mitten, Crampons (Hold). Texts in `src/data/relics.ts`.

### Gear
Bases: Icicle Rapier, Frostbrand, Glacier Maul (weapons); Fur Hood, Rimeglass Visor (helms); Yak-wool Coat, Frostplate
(armor); Snowshoe Boots, Crampon Greaves (boots); Snowflake Locket, Ice Prism (trinkets).
Signature Legendaries: **Ramshorn Helm** (Rimehorn: blocking on ice heals 2 HP), **Wyrmfang** (Glacia: completed holds
deal x3). Set: **Rimewalker** (hood, coat, boots, locket): 2-piece +20% damage on ice; 4-piece each completed hold
heals 2% HP.

### Music (each piece: a distinct key, tempo and instruments, unlike Region 1 and each other)
| Piece | Key | Tempo | Instruments / feel |
|---|---|---|---|
| Frostbite Pass (calm map / intense fight) | B minor | 116 | celesta and glockenspiel lead, plucked strings, sleigh-bell shaker, low choir pad; fight: driving pizzicato + taiko |
| Glimmer Caves | Ab Lydian | 96 | glass harmonica lead, water-drip wood blocks, fretless bass, long echo; fight: pulsing synth bass + toms |
| Wyrm's Glacier | C# minor | 132 | French horns, timpani, tremolo strings, choir "ah"; fight: full brass ostinato |
| Rimehorn (mini-boss) | G Mixolydian | 150, in 7/8 | stomping folk: horn call, fiddle, frame drum |
| The Loom Matron (mini-boss) | F minor | 88, waltz 3/4 | harpsichord, music box gone wrong, low cello |
| Glacia (boss, by phase) | Eb minor | 148 | phase 1 organ + strings; phase 2 adds choir and double-time hats; phase 3 modulates up to F# minor, everything in |

Region 1 used: D major 128, E Dorian 104, C minor 140, A minor 6/8 jig, D Phrygian 74, G minor 156, Bb major 3/4.

---

## 6. Region 3: ASHFELL (secret; only if time allows)
Planned mechanics: **drifting blocks** (statics slide slowly along the bar) and **linked pairs** (two blocks joined by
a chain: hitting one without the other within a beat is a miss). Details to come if built.
