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
| Solenne | Blade | Mythic | hero chests (round 7) |
| Wren | Shadow | Rare | hero chests (round 7) |

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

### Solenne, Dawnblade (Blade, Mythic) — round 7
- Look: a tall sun-knight in white enamel plate trimmed with gold, a short crimson half-cape, warm brown skin, a
  cropped crop of silver-white hair under a gold circlet with a sun-stone, a long sword whose blade glows like morning
  light. Palette: ivory/white plate, gold, crimson, a warm sunrise glow.
- Signature **Sunrise**: every 25 combo her blade burns for 4 s: her hits also cut every other foe for half their damage.
- Ability (green) **Gleam**: a green hit gilds the next yellow ahead (a gold block with a sun mark; with none on the
  bar, the next to come): hitting it adds +3 combo and 0.12 of a meter.
- Passive **Dawn Oath**: at 50+ combo, a miss keeps half the combo (its stacks and meter still go).
- Finisher **Sunfall**: hits every foe, +1% per combo (up to +50%); clears the reds; gilds the two yellows nearest the
  left end (where the cursor starts again).
- Mythic gift **Radiance**: while Sunrise burns, the reds on the bar (and those that come) move at x0.7.
- Strength: +20% damage to Frost foes.
- Finisher show: a sun kindles on her raised blade, shoots up, sunbeams spear the foes, then the sun falls on them.

### Wren, Rooftop Runner (Shadow, Rare) — round 7
- Look: a small, quick street runner: a charcoal hood, a long mustard scarf, bandaged hands, soft boots, a grappling
  hook on a coil of rope at her hip, a single curved knife. Palette: charcoal greys, mustard yellow, brick red.
- Signature **Slip**: 3 Perfect hits in a row ready a dodge (one at a time; a mustard slab at the bar's left end):
  the next red that reaches her misses (smoke puffs off her).
- Ability (green) **Smoke Pop**: a green hit pops smoke over the bar for 3 s: the reds fade, and one that reaches her
  in the smoke deals half. (Built as "hit softer" rather than "fade from view": hiding the reds would only hurt the
  player.)
- Passive **Light Feet**: her Chain (and Slip's run) survives one Good hit between Perfects.
- Finisher **Rooftop Drop**: the target alone, x1.25, +12% per Chain link; clears the reds.
- Strength: +20% damage to Flyers.
- Finisher show: her hook flies up and yanks her out of sight, she races over the foes throwing knives (one per
  strike), then drops onto the target: a white cut, smoke and roof tiles.

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
| Solenne | Sunrise burns 6 s (Long Dawn) | Sunfall gilds every yellow on the bar (High Noon) |
| Wren | after a dodge, her next hit crits (Grapple) | Rooftop Drop readies a dodge (Roof Hop) |

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

#### As built (`src/engine/music.ts`, tracks `frost1..3`, `rimehorn`, `matron`, `glacia`)
Acts: calm = map, nodes, scenes (no kit); intense = fights, its base plus drums / bass / lead joining with the combo.

| Track | Key, tempo, meter | Calm | Intense |
|---|---|---|---|
| `frost1` | B minor, 116, 4/4 | celesta tune (a dotted fall, a drop to the root, back up), glockenspiel twinkles on its long notes, plucked-string harp in 8ths, low choir, sleigh bells, a sustained bass | 16th pizzicato ostinato, celesta an octave up, sleigh bells, taiko; lead: thin glassy pulse |
| `frost2` | Ab Lydian, 96, 4/4 | glass harmonica phrases climbing through the raised 4th (D), crystal notes every three 16ths, water-drop woodblocks, fretless bass sliding into its notes, long echo (0.55) | a 3-3-2 synth pulse in the echo, glass harmonica, drips, toms; 8th-note pulsing synth bass; lead: soft triangle |
| `frost3` | C# minor, 132, 4/4 | French horn call (root up to the fifth), tremolo strings, choir "ah", timpani at each phrase and a roll into the loop | brass-section ostinato (3-3-2-3-3-2), horns, tremolo strings, choir, timpani; lead: horns an octave up |
| `rimehorn` | G Mixolydian, 150, 7/8 (2+2+3) | (fight only) | hurdy-gurdy drone (G+D), fiddle on the tune, frame drum doum/tek, claps on the long beat, a low horn call per phrase; lead: a horn section |
| `matron` | F minor, 88, 3/4 waltz | (fight only) | harpsichord oom-pah-pah, a music box gone wrong (notes sag flat, octave out of tune), a cello holding the root, a ticking clock; bass: bowed cello; lead: cello on the tune, low |
| `glacia` | Eb minor, 148, 4/4; phase 3 F# minor | (fight only) | phase 1: pipe-organ chords, organ tune, string spiccato, timpani; phase 2 adds a choir and the kit with double-time hats; phase 3 goes up 3 semitones with bass (harder), lead and brass stabs |

7/8 changes (layers, crossfades, the next piece) land on the 2+2+3 pulses (`Song.pulses`). Ambience beds: `pass` (wind,
a whistle over the ridge, creaking ice, prayer flags, snow sliding off pines), `caves` (a deep stereo hum, drips and
trickles in a cave echo, crystals ringing, ice settling), `glacier` (a moaning gale, howls, distant ice cracks with a
low boom, a deep groan). Sound lab labels name acts only ("Act 4: map", "Act 6 boss, phase 2", "Ambience: act 5").
Cues (`app.ts`): global act index 3/4/5 plays `frost1/2/3` and the `pass/caves/glacier` bed (on its map too); enemy
keys `rimehorn`, `matron`, `glacia` (with `boss` in the data) bring their themes; `glacia`'s `phase` drives hers.

---

## 6. Region 3: ASHFELL (secret; written as data, not in play yet)

A land of ash, black basalt, lava rivers and caves of volcanic glass, round the great volcano in the kingdom's east
(on the world map: the volcano, the lava rivers to the sea and the black citadel). The third weight fell into the
forge of **Bellows**, a giant old smith who has been forging the longest chain in the world for four hundred years.
It makes the perfect anvil (nothing struck on it ever cools), so he hammers day and night, and every blow on it shakes
the whole land sideways: **nothing in Ashfell holds still** (drifting blocks), and his chains are on everything
(linked pairs). Mags, the camp's smith, was his apprentice. He never learned to rest; Rowan, the kingdom's finest
napper, finally teaches him.

**Data (not wired in):** `src/data/ashfell.ts` (`ASHFELL`, not in `REGIONS`), `enemies-ash.ts` (`ASH_ENEMIES`, not in
`ENEMIES`), `story-ash.ts` (`ASH_STORY`), `banter-ash.ts`, `relics-ash.ts`, `gear-ash.ts`; checked by
`tests/unit/ashfell-data.test.ts`. Global acts 6-8 once wired in.

### Bar rules (typed in `BarRules`; the core implements them)
Both rules only ever touch **yellows** (greens, reds, traps, kegs and frozen blocks never drift or link), and both
read without sound.

- **Drifting blocks** (`bar.drift: { share, fromRow, speed }`): a yellow that rolls the act's share slides slowly along
  the bar (`speed` bar widths a second, 0.05-0.07; specials 0.06-0.08, short bursts up to x1.6), in a random direction,
  turning back at the bar's ends and when it would touch another still block (it never overlaps one; reds pass over it
  as they pass over any yellow). The bar's history keeps its position, so a tap is judged where it was at the tap's
  moment, like the cursor. *Look:* still yellow (the colour code holds), with ember-orange chevrons on its leading edge
  and a faint heat shimmer behind; at a turn the chevrons flip with a puff of ash. *Fair to a thumb:* at 0.10 it closes
  at most ~11% faster than a still block, so drift stays at or under 0.10 except bursts of a few seconds.
- **Linked pairs** (`bar.links: { share, fromRow }`): a yellow that rolls the share comes with its partner: two yellows
  0.14-0.24 of the bar apart (centre to centre), both inside the bar's middle 80%, so one sweep meets both. Hit either
  half first (the hit is held: no damage or combo yet), then the other within the **beat** (`links.beat`, 0.6 s,
  counted only while the cursor moves: paused in freezes, hit-stop, the finisher's hold and tips). Both land then, the
  second x`links.bonus` (1.5) and +1 extra combo ("Linked!"). If the beat runs out, both count as misses (one combo
  break; miss hooks see two, flagged `pair`). A pair nobody starts costs nothing: it waits like any yellow. Each half
  is judged on its own (Perfects count per half). *Look:* a glowing chain of molten links under the bar between the
  halves, a link notch on each half's inner edge; once a half is hit it stays as a glowing outline and the chain burns
  down toward the partner like a fuse (what's left of the beat) while the partner pulses; both hit, the chain flashes
  white and snaps; too slow, it cools grey and both crumble ("Broken!"). At base speed the second half is 0.15-0.26 s
  away, inside a 0.6 s beat even in a slow patch (x0.6).
- **Both** (Act 3): a pair rolls the drift share once and drifts as one, its gap kept (the chain stays taut). Act 2's
  drift is light and late, so drifting pairs are rare there; if they read badly before Act 3, gate them with a flag.
- *Words:* the player-facing name is **pair** (tips, story, relic texts); the relic tag reads **Link**. Shadow's Chain
  counts "links" in Sable's skill texts: if that reads as the same thing, rename one of them.

How they ramp: **Act 1** drift from row 2 (share 0.15, speed 0.05; Hot Foot and Quake show it earlier); **Act 2** pairs
from row 1 (0.14) plus a little drift from row 3 (0.08); **Act 3** both from row 0 (drift 0.15 at 0.07, pairs 0.15),
and the boss's phases rewrite the bar (drift, then chains, then both at once with a fast cursor).

**Every hero** (one cursor each):
- Rowan: nothing special; Whirlwind clears reds, pairs and drifters stay.
- Sable: Shadow Dash aims at where the next block will be when she lands (its position plus drift over the 0.3 s
  lead); after a pair's first half the dash lands 0.3 s before the partner, inside the beat (a natural fit).
- Neve: frozen blocks never drift. Suggested (needs core): Glacier also stops every drifting block for its 4 s.
- Moss: Seedling's greens never drift. Tam: kegs never drift; suggested: a keg or bomb blast that takes one half of a
  pair takes both, as a finished pair. Hollis: unchanged. Vesper: suggested: Volley pins drifting blocks too.
  Torva: Earthsplitter clears everything; Quake only moves reds.
- The bot: aims at a drifting block where it will meet the cursor (as it does through patches); starts a pair only
  when it can reach the partner within the beat at its current speed, else lets it pass.

**New actions (needs core; typed in `src/data/types.ts`, ignored by `specials.ts` until built; each needs a unit test
in `tests/unit/specials.test.ts`):**
- `toDrift { count, speed, sec? }`: up to `count` yellows on the bar (0 = every one) start drifting at `speed` for
  `sec` s (none = for good), each away from its nearest neighbour.
- `toLink { count, drift? }`: up to `count` pairs of neighbouring yellows on the bar are chained (a partner is added
  beside a yellow when none is near), drifting together at `drift` if set.
- `driftShift { mult?, flip?, sec? }`: every drifting block turns around (`flip`) and/or moves `mult` x as fast for
  `sec` s (none = for good; `mult: 0` = they settle and stop).
- `barRule { holdEvery, driftEvery?, linkEvery? }`: like `holdEvery`, every Nth yellow this foe sends drifts / comes as a
  pair (0 = none; a later barRule replaces the earlier one).
- Formation entries `drift?: number` (a yellow placed drifting) and `link?: boolean` (two `link` yellows placed as a
  pair).

### Acts
| Act | Name | Theme (`AshTheme`) | Map look | Rules |
|---|---|---|---|---|
| 1 | Cinder Flats | `cinder` | ash plains under a smoky orange sky: hexagonal basalt columns, smoking vents and geysers, charred trees, a lava river crossed by basalt slabs, Rumbleback's half-paved road | drift (from row 2) |
| 2 | Glass Warrens | `glass` | tunnels of black obsidian and coloured volcanic glass, lava glowing behind translucent walls, chiming glass stalactites, chain bridges over a magma lake, old glassblowers' kilns | pairs (row 1) + a little drift |
| 3 | The Black Forge | `forge` | the basalt citadel on the volcano's rim: lava falls, giant anvils, glowing chains as thick as trees slung across the crater, the furnace roaring at its heart | drift + pairs; the boss rewrites the bar |

The three themes aren't in the `Theme` union yet (the engine's stage lights, map kits, lairs and critters are records
over every theme): `ashfell.ts` passes them through `look()` until the art exists. Map critters (suggested): lava
lizards, ash moths, a fire beetle; glass snails, glow bats; soot sprites, sparks rising. World map: three landmarks
(`WORLD_ACTS` 6-8) round the volcano: Rumbleback's road, a glowing cave mouth, the black citadel.

Act scaling (first guesses, each a step above the matching Frostpeaks act; Act 1 dips below Act 6 as the Frostpeaks
dipped below Greenmarch, since a region starts a fresh run): hpMult 3.6 / 4.6 / 5.8, atkMult 9 / 10.5 / 12, pace
0.82 / 0.78 / 0.74, redSpeed 1.16 / 1.18 / 1.2; waves 2-5 / 3-5 / 3-6 like the Frostpeaks; foes' base stats ~10-20%
above theirs.

### Enemies (each has a telegraphed special that changes how the bar plays)
| Enemy | Act | Tags | Look | Special |
|---|---|---|---|---|
| Cinderling | 1 | swarm, fire | a walking lump of glowing coal the size of a cat, stubby legs, ember eyes, a flame tuft | **Hot Foot!** 2 yellows drift for 6 s (needs core: `toDrift`) |
| Cinder Kite | 1 | flyer, fire | a ragged kite-shaped bird of soot-black feathers with glowing edges and a smoking tail streamer | **Ember Drop!** 2 spots marked; embers land there as still reds that strike after 1.8 s unless tapped |
| Crag Crab | 1 | armored, beast | a squat crab whose shell is a cluster of basalt columns, one big claw, steam at the joints | **Basalt Crust!** 2 yellows set in basalt: 2 taps each (a drifting one keeps drifting) |
| Obsidian Ox (elite) | 1 | brute, beast | a huge ox of black volcanic glass with glowing cracks, curved horns and a brass nose ring | **Stampede!** a fast wide red; **Quake!** every yellow on the bar drifts for 4 s (needs core) |
| Glassblower | 2 | folk, caster | a goblin glassblower in apron and goggles, cheeks puffed, a long blowpipe with a glowing glass bubble | **Blow Glass!** chains 2 pairs of yellows (needs core: `toLink`) |
| Prism Bat | 2 | flyer, beast | a bat with stained-glass wings (red, amber, green panes in black leading) that throw coloured light | **Prism Flash!** a glass pane (mirror) where the cursor is heading for 4 s, and 1 pair chained: the pane can finish the pair for you or carry you away (needs core: `toLink`) |
| Glass Mantis | 2 | beast, armored | a praying mantis of green bottle glass with see-through scythe arms | **Scissor Snap!** a pair, and a red half a second behind it: finish the pair or block first? (needs core: `link` entries) |
| Kiln Warden (elite) | 2 | construct, fire | a walking brick kiln: a glowing furnace-door mouth, glass-bottle pauldrons, chimney smoke | **Kiln Door!** a slab of hot glass where the cursor is heading: a still shield, 3 taps before it falls (3.2 s); **Firing!** chains 3 pairs (needs core) |
| Stoker Imp | 3 | caster, swarm | a little ember-red imp with smoking horns and a coal shovel bigger than itself | **Stoke!** 2 more yellows drift, and every drifting block goes x1.6 for 4 s (needs core: `toDrift`, `driftShift`) |
| Magma Eel | 3 | beast, fire | a long eel of cooling lava (black crust, glowing orange beneath) rising from a lava channel | **Undertow!** a yellow drifts, then every drifting block turns back, x1.4 for 3 s (needs core) |
| Forge Hand | 3 | folk, brute | a stocky soot-faced forge worker, scorched apron, welding mask pushed up, tongs and hammer | **Weld!** a pair that drifts as one (needs core: `link` + `drift` entries) |
| Chain Sentinel (elite) | 3 | construct, armored | an empty suit of armour made of chain links, a glowing eye slit, a chain flail | **Chain Lash!** two reds, one after the other; **Shackle!** 2 pairs chained, drifting as one (needs core) |

Every hero's soft strength has foes here (folk, caster, beast, swarm, armored, brute, flyer, construct). New foe tag:
`fire` (no hero leans on it yet).

### Mini-bosses
- **Rumbleback** (Act 1, brute, armored): a colossal armadillo with banded basalt plates, a road-worker's hard hat (a
  dented cauldron) and a striped sash; he paves the flats with basalt and rolls flat whatever is on his road (mostly
  knights). **Roll Out!** a wide red that grows as it rolls in; **Rumble!** (phase 1) every yellow drifts for 5 s;
  **Curl Up!** (below 50%, gate) he curls up (hits deal half until 3 shell plates break) and every 2nd yellow he sends
  drifts (`barRule driftEvery`); **Gravel!** (phase 2) 3 yellows crusted (2 taps).
- **Hob & Nob** (Act 2, beast, fire): the forge's two-headed lava hound, coal-black fur with glowing cracks and a collar
  of glowing chain; Hob scowls (spiked collar, the guard), Nob grins (a stick in his teeth, wants to play fetch).
  **Double Bite!** two reds, one per head; **Fetch!** (phase 1) chains 2 pairs; **Two Heads!** (below 50%, gate) every
  3rd yellow they send comes as a pair (`barRule linkEvery`); **Squabble!** (phase 2) the heads snap at anything: a
  guard for 1.4 s (a yellow tap is countered; the telegraph comes first, so you can hold off starting a pair).

### Boss: Bellows, the Forge Titan (Act 3, brute, fire) — phases rewrite the bar
A giant old smith of basalt and fire, as tall as his forge: a furnace glowing in his chest that huffs like a bellows,
a long beard of grey ash, a soot-black apron, arms like pillars, a hammer the size of a door; the brass pendulum
weight sits glowing on his anvil, his endless chain coiled behind him.
- Phase 1, the forge: **Bellows Blast!** (at the start) every yellow on the bar drifts, and every 2nd one he sends
  (`toDrift` for good + `barRule driftEvery 2`); **Hammerfall!** an anvil where the cursor is heading (a still shield,
  3 taps, 3.2 s).
- Phase 2 (66%, gate, scene `bellows2`), the chain: **Chainwork!** the drifting stops (`driftShift mult 0`), 2 pairs at
  once, and every 3rd yellow he sends is a pair; **Hammerfall!** and **Chain Lash!** (two reds).
- Phase 3 (33%, gate, scene `bellows3`), the eruption: **ERUPTION!** everything drifts again (0.08), every 2nd yellow
  drifts and every 3rd is a pair (pairs drift too), the cursor never drops below 1.3x; **Chain Lash!** and **Lava
  Rain!** (3 embers).

### Story (scene ids, `src/data/story-ash.ts`)
- `ash1` (Act 1 start): Ashfell, where nothing holds still; boulders slide past, Sable's coins wander off ("the GROUND
  is stealing from me"); the weight ticks and the land shuffles.
- `rumbleback` (mini-boss): the road-roller: "WET BASALT. KEEP OFF." It's lava. "It's a road that isn't FINISHED."
- `magsTale` (at the camp after Act 1, where the Frostpeaks had `neveJoin`; suggested trigger: the first camp visit
  after the region's first act is cleared): Mags says the forge is Old Bellows', her master, who never finished a thing
  ("one more link") and never learned to sleep; the ticking is his hammer on the weight. "Mags says hi. His tongs are
  in MY bag."
- `ash2` (Act 2 start): the Glass Warrens; Sable wants a pocket-sized wall; Neve distrusts glass (mirrors froze her);
  chains on everything; Pip: "to break a pair, hit both ends. Quick. One, two."
- `hobnob` (mini-boss): Hob guards, Nob wants to play fetch; Sable tries to send Nob after a stick past the gate.
- `ash3` (Act 3 start): the Black Forge, BANG, the mountain jumps; nobody has slept for weeks; Rowan's plan: get the
  weight, stop the banging, everybody naps.
- `bellows` (boss intro), `bellows2`, `bellows3` (phase scenes): "One more link." The anvil that never cools; "Mags
  says hi." "Little Mags? Still holding her hammer wrong?"
- `ashVictory`: Bellows has forgotten how to sit down; Rowan teaches him to nap ("tick... tock..."); he snores, the land
  holds still; the Pendulum ticks THREE times; next: Duskmire ("Swamps. Bring a towel, knight").
- New speakers (`Speaker` union, `SPEAKER_NAME`): `rumbleback`, `hobnob` ("Hob & Nob": both heads in one portrait;
  lines start "HOB:" / "NOB:"), `bellows`; Mags speaks as `smith`. Portraits needed for the three.
- Camp banter (`banter-ash.ts`): 13 lines, each waiting for a Region 3 scene (`after`) so it can't spoil it.
- Tips (suggested, fit `TIP_TEXT_W`, pausing, pointing at the block): drift "Some blocks drift along the bar. / Watch
  which way they're heading!"; pairs "A pair: hit one, then the other. / Too slow? Both count as misses."

### Relics (Drift and Link tags, `src/data/relics-ash.ts`, offered from the region's first act on: `from: 6`)
Drift: **Tailwind** (hits on drifting blocks +40%), **Weathervane** (Perfects on drifting blocks crit), **Warm Springs**
(a drifting block turning at an end heals 2 HP), **Rebound** (a drifting block turning at an end turns green), **Anchor
Stone** (blocking a red stops every drifting block for 3 s), **Slipstream** (hitting a drifting block fills the meter
like 2 hits), **Flotsam** (each drifting block hit drops a coin), **Molten Core** (epic: drifting blocks 50% faster,
hits on them double). Link: **Forged Bond** (a finished pair +2 combo), **Slow Match** (50% longer beat; renamed from Long Fuse, a skill of that name exists), **Hammer &
Tongs** (a pair's second half crits), **Spare Link** (once a fight, a broken pair doesn't break the combo), **Coupling**
(every 3rd finished pair banks a stack), **Gold Rivets** (finished pairs drop 2 coins), **Snap Back** (a finished pair
knocks the nearest red to the far end), **Hair Trigger** (epic: finished pairs deal triple, a broken one costs 5% HP;
the cautious bot's `avoid` list should take it). Unlocks: 4 from the start, the rest by Region 3's act clears and
elites. Builds: Firewalker (Drift), Chainsmith (Link), Forgemaster (Drift + Link), Wildfire (Drift + Crit), Anvil
Breaker (Link + Finisher).
New hook points they need (needs core): `driftTurn` (a drifting block turned at an end), `driftMult` (a drifter's speed
for this hero), `linked` / `linkBroken` (a pair finished / broke; the latter can forgive the break), `linkBeat` (the
beat's length), and a way to pause drift (`c.pauseDrift(sec)`). Tailwind, Weathervane, Slipstream, Flotsam and Hammer &
Tongs work with today's hooks once a block knows it drifts / which half of a pair it is.

### Gear (`src/data/gear-ash.ts`)
Bases: Obsidian Edge, Cinder Cleaver, Basalt Sledge (weapons); Ash Veil, Basalt Helm (helms); Ashcloth Coat,
Slagplate (armor); Pumice Soles, Firewalk Greaves (boots); Warm Coal, Lava Pearl (trinkets).
Set: **Emberwright** (a smith's working kit: Emberwright Cap, Apron, Clogs, Hearth Charm): 2-piece +20% damage on
drifting blocks; 4-piece finished pairs heal 2% HP.
Signature Legendaries (Bellows): **Titan's Maul** (Strike While Hot: finished pairs hit every foe), **Bellows Heart**
(Stoked: drifting blocks you hit fill double meter).

### Music (each piece: a distinct key, tempo and instruments, unlike Regions 1-2 and each other)
| Piece | Key | Tempo | Instruments / feel |
|---|---|---|---|
| Cinder Flats (calm / intense) | E Phrygian dominant | 112, half-time feel | calm: an oud-like plucked lute ostinato, a breathy reed flute (ney) with slides, a low drone on E+B, a soft ash-hiss shaker, a distant frame drum; fight: a doumbek groove (doum-tek-tek-doum-tek), a driving low-string ostinato; lead: a nasal reed (zurna-like pulse) |
| Glass Warrens | Bb Dorian | 108, in 5/4 (3+2) | calm: a kalimba ostinato on the 3+2, a bowed-glass pad, wind chimes at phrase ends, a soft sub heartbeat on 1; fight: marimba in double time, tabla-like hand drums; lead: a bright square wave |
| The Black Forge | Ab minor (raised 7th, G, at cadences) | 138 | calm: a low brass chorale (tuba, trombones), an anvil ting on 2 and 4, bellows swells (filtered noise breathing in and out), a male choir hum; fight: a brass riff in octaves, forge-hammer drums (big low toms), anvil 16ths; lead: overdriven bass and brass stabs |
| Rumbleback (mini-boss) | F# blues | 92, swung 16ths | (fight only) a road-works funk: slap bass, a wah-pulse guitar, cowbell and a clanking road-works hit, honking sax stabs, a tuba "beep, beep" reversing call each phrase |
| Hob & Nob (mini-boss) | A major | 168, a 2/4 galop | (fight only) two leads trading bars (muted trumpet = Hob, clarinet = Nob), tuba oom-pah, snare rolls, a slide whistle into each phrase; phase 2: the leads overlap and argue |
| Bellows (boss, by phase) | B Phrygian; phase 3 C Phrygian | 162 | phase 1: anvils on the backbeat, a low brass ostinato, war drums, bellows swells; phase 2 adds a male choir chant and a chain-rattle shaker in 16ths answered by horns; phase 3 lifts a semitone to C Phrygian with double-time drums, distorted bass and brass stabs, everything in |

Already used: Region 1 D major 128, E Dorian 104, C minor 140, A minor 6/8 jig, D Phrygian 74, G minor 156 (A minor),
Bb major 3/4 80 (camp), F major 100 (title); Region 2 B minor 116, Ab Lydian 96, C# minor 132, G Mixolydian 150 7/8,
F minor 88 3/4, Eb minor 148 (F# minor). Every tonic is taken by now, so each new piece differs in mode, tempo, meter
and band. New for the kingdom: a 5/4, a swung funk, a 2/4 galop, a semitone lift.
Ambience beds: `cinder` (dry wind over the ash, crackling embers, a geyser's hiss now and then, a distant low
rumble), `glass` (a deep hum, glass chiming like wind chimes, molten drips sizzling, a far crackle of cooling glass),
`forge` (lava bubbling, distant hammer blows, the bellows breathing slowly, chains clinking, the furnace's roar).
New telegraph sounds (`ASH_NEW_SOUNDS`): sizzle, embers, crust, stampede, quake, glass, snip, kiln, chain, bark,
lava, anvil, bellows, eruption (Prism Flash and Squabble reuse `mirror` and `guard`).

#### As built (`src/engine/music.ts`, tracks `ash1..3`, `rumbleback`, `hobnob`, `bellows`; not in play yet)
Acts: calm = map, nodes, scenes (no kit); intense = fights, its base plus drums / bass / lead joining with the combo.

| Track | Key, tempo, meter | Calm | Intense |
|---|---|---|---|
| `ash1` | E Phrygian dominant, 112, 4/4 with a half-time kit | a reed drone on E2, B2 and E3 under every chord, an oud ostinato in 8ths (root and chord tones, sliding into each note), a breathy ney on the tune (sliding up into its notes, vibrato on the long ones), a held bass, an ash-hiss shaker on the offbeats, a distant frame drum | the drone and a soft pad, a low-string spiccato ostinato in 16ths, the oud tremolo-picking the tune, a doumbek maqsum (doum-tek-tek-doum-tek, soft "ka"s between), the hiss shaker; kit: kick on 1, snare on 3; bass: the F leaning on the E; lead: a zurna (a thin pulse through a nasal formant, quick vibrato) |
| `ash2` | Bb Dorian, 108, 5/4 (3+2: chords change on the "2", step 12) | a kalimba ostinato in 8ths accented on 1 and 4 (alternate sides), the kalimba on the tune, a bowed-glass pad (pure sines beating slowly), a root-then-fifth bass, a sub heartbeat on 1 ("lub-dub"), wind chimes at the end of each phrase (bars 4 and 8) | a marimba in 16ths (double time), the kalimba on the tune, tabla-like strokes on the 3+2 (na, tin, a ge bending up), the chimes; kit: kick on 1, 2½ and 4, snare on 3 and 5; lead: a bright square |
| `ash3` | Ab minor (its 7th raised to G at the cadence), 138, 4/4 | a low brass chorale held on each chord (the tuba on the right, the trombones spread), a trombone on the tune, a male choir humming, an anvil ting on 2 and 4, the bellows drawing in for a bar and blowing out the next | a brass riff in octaves (trombones), the trombone on the tune, forge-hammer drums (huge low toms with an iron clang), the bellows, the hum; kit: kick and snare with anvil 16ths for hats; lead: an overdriven saw an octave down on the tune, brass stabs on the "and" of 2 and 4 |
| `rumbleback` | F# blues, 92, 4/4, a 12-bar blues, 16ths swung (0.3) | (fight only) | a wah-pulse guitar scratching 16ths with chord chucks (the pedal rocking heel to toe each beat), a tenor sax on the tune, a cowbell, a road-works clank every other bar, the tuba backing up ("beep, beep") at the end of each 4-bar phrase, a square organ pad; kit: funk (ghosted snares, swung 16th hats); bass: slap (thumb, popped octaves); lead: the honking sax section (a growl) an octave down, honks on the "and"s |
| `hobnob` | A major, 168, a 2/4 galop (16 bars); follows the phases without a key change (`phased`) | (fight only) | Hob's muted trumpet (a harmon mute, left) and Nob's clarinet (right) trading bars, the oom-pah (a tuba oom, the band's "pah" alternating sides), a calliope pad, snare rolls into each line, a slide whistle into each phrase; kit: a galop; bass: the tuba an octave down, walking into each line; lead: a xylophone on the tune; phase 2 (the stabs layer): the other head plays under each bar too, a chord tone below, from its own side |
| `bellows` | B Phrygian, 162, 4/4; phase 3 C Phrygian (`keyUp` 1) | (fight only) | phase 1: a low brass ostinato (trombone, the tuba on the strong beats) grinding on the C, horns on the tune, anvils on the backbeat, war drums (taiko), the bellows breathing; phase 2 adds the kit and, in the stabs layer, a male choir chanting short syllables, a chain-rattle shaker in 16ths and horns answering it every other bar; phase 3 goes up a semitone with double-time kick and hats, a distorted bass (a saw into an overdrive over a clean sub), the lead (horn and pulse) and brass stabs on the offbeats; the war drums keep only their big strokes |

Cues (`app.ts`): global act index 6/7/8 plays `ash1/2/3` and the `cinder/glass/forge` bed (on its map too); enemy keys
`rumbleback`, `hobnob`, `bellows` (with `boss` in the data) bring their themes, `hobnob`'s and `bellows`' `phase` drive
theirs. Until the region's acts and foes are in the data nothing asks for them. Sound lab labels name acts only ("Act
7: map", "Act 8 mini-boss, phase 2", "Act 9 boss, phase 3", "Ambience: act 7"). Beds as built: `cinder` (a dry wind and
its low body, the ground's far rumble under 100 Hz, ash blowing past; embers crackling close by, a geyser's hiss
building and falling away, a distant rumble rolling), `glass` (a deep hum at 49 Hz beating against its octave, warm
air, heat shimmer, in a tunnel echo; glass chiming like wind chimes, molten drips that plip and sizzle out, a far
crackle of cooling glass), `forge` (the furnace's flickering roar and its low roar, the hiss of the heat; lava
bubbling, distant hammer blows in threes and fours, the bellows breathing slowly, chains clinking). Telegraphs as built
(`Synth.tell*`): sizzle (a splash, then a thickening fry and a swelling hiss), embers (two falling whistles, each
landing in a crackle of sparks), crust (rock grinding, two stone knocks), stampede (three gallops nearing, glassy
hooves), quake (four low heaves with gaps), glass (a breath and a glass bubble climbing, a tink), snip (one long glass
scrape, a silence, a double snap), kiln (a creaking iron door, the fire roaring out), chain (rattles coming faster, a
whoosh, the crack of the lash), bark (a two-throated growl, two barks), lava (fat bubbles faster and faster, steam, a
surge), anvil (four strikes, the last a clang), bellows (a long breath in, a creak, the blast full of sparks), eruption
(a rumble from below, a scream of pressure, the blast and falling rocks).

### Balance targets (for later, an 85% player on a fresh first playthrough of the region)
Act 1 ~85% first try, Act 2 ~70%, Act 3 ~55%, Bellows' first fight won ~50-60%. Keep the thumb rules: reds as in
`tests/unit/data.test.ts`, drift at most 0.10 (bursts excepted), a pair's halves reachable within the beat at base
speed in a slow patch.

### Wiring it in (the core owner's checklist)
1. The two rules in combat (drift positions in the history, pairs and the beat, `tuning.links` with sliders), the new
   actions and formation fields (unit tests), the relic hook points, the bot's aim at drifters and pairs.
2. Merge: `ASHFELL` into `REGIONS`; `ASH_ENEMIES` into `ENEMIES`; `ASH_STORY` into `STORY`; relics, tags and build names
   into `relics.ts` (and the tag chips in `relic-ui.ts` / `relic-log.ts`); bases, effects, the set and signatures into
   `gear.ts`; banter (with its `after` gate); `magsTale` as a camp scene; the tips.
3. Art and sound: the three themes in `Theme` with their backdrops, stage lights, map kits, lairs and critters; foe
   sprites and telegraph poses; portraits (Rumbleback, Hob & Nob, Bellows); item icons; the three landmarks and
   `landOpen` for Ashfell; the telegraph sounds, the six pieces and the three ambience beds (Sound lab labels by act
   number only, as for the Frostpeaks: built, see Music, As built; they play once the acts and foes are in the data).

### Build calls (decisions.md 33-37, kept here: spoilers)
- **The two rules as built:** drifting blocks are yellows sliding slowly along the bar, turning at the ends and at
  their neighbours (never reds, greens, traps, kegs or frozen blocks); linked pairs are two chained yellows: the first
  tap lights one, the second within a beat of 0.8 s lands both at x1.5; too slow and both break as one miss. A pair
  nobody starts costs nothing; perks never hit half a pair; the beat is a fuse burning down the chain.
- **Pairs don't drift in this build:** a pair stays put, a single yellow drifts (simpler to read; the bot and the judge
  treat both cleanly). The design's drifting pairs in Act 3 can come later.
- **Long Fuse became Slow Match** (a hero skill already had the first name).
- **Story:** the boss is Mags's old master (a camp scene after the region's first act tells it), and the victory
  points on to the next land.
