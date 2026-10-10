# Content bible (SPOILERS: region enemies, bosses, story, music)

The playtester wants to be surprised by region content. **Region names, enemies, mini-bosses, bosses, their
mechanics and the plot live here only** (never in PR titles or the final message). Heroes, companions and systems are
not secret; they are listed here too because the art, story and code all read from this one spec.

Tone everywhere: cheeky and light (see `src/data/story.ts`). Original names and art only.

**Round 8: the story is new.** `docs/story-bible.md` replaces the Pendulum / weights plot; where the story notes in
sections 5-6 below disagree with it (weights, ticks), the story bible wins. The mechanics here stand.

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
| Yara | Summoner | Mythic | hero chests (round 7) |
| Dell | Marksman | Rare | hero chests (round 7) |
| Fizz | Bomber | Legendary | hero chests (Part 6) |
| Brann | Guardian | Epic | hero chests (Part 6) |
| Gorm | Brute | Legendary | hero chests (round 7) |
| Tess | Controller | Epic | hero chests (round 7) |

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
- Strength: +15% damage to Beasts, takes 25% less from Frost foes; ice patches bother her half as much.

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
- Finisher **Big Bang**: hits all foes, then drops a keg on the bar. (Adds a keg.)
- Strength: +20% damage to Armored foes (shells, shields).

### Hollis, Shieldwarden (Guardian, Rare)
- Look: a tall, broad shieldwarden with dark brown skin and a short black beard, steel plate with blue cloth, a huge
  tower shield (blue, with a white tower emblem), a short broad sword. Palette: steel, royal blue, white.
- Signature **Shield Slam**: a Perfect block hits the red's owner for 60% of your attack.
- Ability (green) **Brace**: for 3 s, each block stores double Guard and fills the meter double.
- Passive **Iron Hide**: reds that reach you deal 25% less.
- Finisher **Rampart**: hits the target with the finisher plus all stored Guard x2; then for 3 s, reds that reach the
  left end bounce back across the bar instead of hitting you. (Changes the bar's end.)
- Strength: takes 20% less from Flyers.

### Vesper, Dusk Ranger (Marksman, Legendary)
- Look: a tall, keen-eyed ranger with pointed ears, a dusk-purple hooded cloak lined with gold, a silver longbow, a
  quiver of white-fletched arrows, dark green leathers. Palette: dusk purples, gold, silver, forest green.
- Signature **Eagle Eye**: Perfect hits store double Focus.
- Ability (green) **Piercing Shot**: the Power Shot also hits the foe behind the target for a quarter of it.
- Passive **Patience**: Focus is kept between waves; a full Focus glows (your next green crits).
- Finisher **Volley**: arrows rain on every foe and spend all Focus (x1.5); every red on the bar is pinned in place
  for 2 s. (Freezes reds.)
- Strength: +20% damage to Flyers, +25% to Frost foes.

### Torva, Hammer Brute (Brute, Epic)
- Look: a towering, muscular woman with a thick red braid, freckles, fur pauldrons over a leather harness, wrist
  wraps, tattoos on her arms, a giant stone-headed warhammer. Palette: warm skin, red hair, fur greys, stone.
- Signature **Quake**: a Perfect hit knocks every red on the bar back.
- Ability (green) **Wind-Up**: your next hit smashes (x1.5, more with a higher combo).
- Passive **Unstoppable**: each hit you take adds +8% damage for the rest of the fight (up to 5).
- Finisher **Earthsplitter**: hits all foes and clears the whole bar (every block), and no reds come for 2 s.
- Strength: +20% damage to Constructs (golems, ice knights).

### Solenne, Dawnblade (Blade, Mythic) — round 7
- Look: a tall sun-knight in white enamel plate trimmed with gold, a short crimson half-cape, warm brown skin, a
  cropped crop of silver-white hair under a gold circlet with a sun-stone, a long sword whose blade glows like morning
  light. Palette: ivory/white plate, gold, crimson, a warm sunrise glow.
- Signature **Sunrise**: every 15 combo her blade burns for 3 s: her hits also cut every other foe for half their damage.
- Ability (green) **Gleam**: a green hit gilds the next yellow ahead (a gold block with a sun mark; with none on the
  bar, the next to come): hitting it adds +1 combo and 0.12 of a meter.
- Passive **Dawn Oath**: at 30+ combo, a miss keeps half the combo (its stacks and meter still go).
- Finisher **Sunfall**: hits every foe, +1% per combo (up to +50%); clears the reds; gilds the two yellows nearest the
  left end (where the cursor starts again).
- Mythic gift **Radiance**: while Sunrise burns, the reds on the bar (and those that come) move at x0.85.
- Strength: +20% damage to Frost foes.
- Finisher show: a sun kindles on her raised blade, shoots up, sunbeams spear the foes, then the sun falls on them.

### Wren, Rooftop Runner (Shadow, Rare) — round 7
- Look: a small, quick street runner: a charcoal hood, a long mustard scarf, bandaged hands, soft boots, a grappling
  hook on a coil of rope at her hip, a single curved knife. Palette: charcoal greys, mustard yellow, brick red.
- Signature **Slip**: 4 Perfect hits in a row ready a dodge (one at a time; a mustard slab at the bar's left end):
  the next red that reaches her misses (smoke puffs off her).
- Ability (green) **Smoke Pop**: a green hit pops smoke over the bar for 3 s: the reds fade, and one that reaches her
  in the smoke deals 25% less. (Built as "hit softer" rather than "fade from view": hiding the reds would only hurt the
  player.)
- Passive **Light Feet**: her Chain (and Slip's run) survives one Good hit between Perfects.
- Finisher **Rooftop Drop**: the target alone, x1.25; then each Chain link throws a knife at every foe (12% of the
  drop's base damage per link, the target too); clears the reds.
- Strength: +20% damage to Flyers.
- Finisher show: her hook flies up and yanks her out of sight, she races over the foes throwing knives (one per
  strike), then drops onto the target: a white cut, smoke and roof tiles.

### Yara, Spirit Caller (Summoner, Mythic) — round 7
- Look: a young spirit caller with warm brown skin, dark braided hair threaded with beads, a deep-blue (indigo) shawl
  patterned with stars over a white tunic with a beaded sash, bare feet (a bead anklet), a carved staff whose ring
  holds a cyan spirit stone, charms (beads, a white feather) hanging from it, soft cyan spirit-light round her hands.
  Palette: indigo, star white, cyan spirit-light, warm bead colours.
- 80 HP, attack 0.6 of Rowan's (her spirits do much of the work).
- Spirits (called by green hits in order, like Moss's allies; they grow a little with the Companion stat; each stays
  6 s; a call with all three out is a Rally):
  - **Spirit Wolf** (attack): bites the target for 25% of her attack every 2 s.
  - **Spirit Tortoise** (block): its shell comes up 3 s after it's called and takes a quarter of the next red that
    reaches her (the rest lands: a hit); then it rests 30 s (a Tortoise called while the last one's rest runs waits it
    out). (Designed to stop the red whole: at 75% that alone put her 10-20 points over Rowan at every boss, where a red
    is a third of her HP.)
  - **Wisp Swarm** (meter): fills 30% of a hit's meter every 2 s (never heals).
- Signature **Spirit Bond**: spirits come in order; a call with all three out is a Rally.
- Ability (green) **Call**: call the next spirit.
- Passive **Kinship**: each spirit out adds +3% crit chance.
- Finisher **Spirit Stampede**: hits all foes, +8% per spirit out; knocks the reds off and tramples the traps. (Two
  things to the bar.) Its show: stars join into a stag in the sky, her spirits stampede through the foes, the great
  stag of starlight leaps down through them.
- Mythic gift **Great Spirit**: a Rally calls the great spirit stag for 4 s; it strikes every foe for 13% of her
  attack each second.
- Strength: takes 20% less from Swarms (slimes, piglets, cinderlings). (Not Beasts: all three region bosses are
  Beasts; not Casters: the second region is full of them, its Act 5 boss too.)

### Dell, Slinger (Marksman, Rare) — round 7
- Look: a freckled farm kid (a head shorter than the grown-ups) with ginger hair under a wide straw hat with a red
  band, a red neckerchief, patched denim overalls over a cream shirt, scuffed boots, a forked slingshot and a pouch
  of pebbles at his hip. Palette: straw yellow, denim blue, red, freckled skin.
- 108 HP, attack 1.14 of Rowan's.
- Signature **Ricochet**: the Power Shot bounces on to the weakest other foe (the least HP) for 35% of it.
- Ability (green, the style's Power Shot) **Lucky Shot**: a Perfect green crits, and so does the Power Shot it fires.
- Passive **Pocketful**: a miss doesn't empty the meter's fill toward the next stack (the combo and the banked
  stacks still go). (Designed as "a miss doesn't lose Focus", but a Marksman's Focus never falls on a miss.)
- Finisher **Pebble Storm**: hits all foes; every red on the bar is knocked back 0.3 of the bar, and one knocked
  past the far end flies off it (an icicle, which can't move, is knocked off). (Knocked back only, they all
  came again: at 75% he took twice Rowan's hits a second at the second and third regions' bosses.) Its show: pebbles
  ping from foe to foe, his lucky golden pebble hops through them all.
- Strength: +20% damage to Flyers.

### Fizz, Alchemist (Bomber, Legendary) — Part 6
- Look: a wiry, wild-haired alchemist: bright teal hair bursting out under a scorched leather cap with a brass-rimmed
  red lens, a stained cream lab coat with rolled sleeves, a bandolier of coloured flasks, a long-handled ladle.
  Palette: teal, lab-coat cream, glass colours (fire red, frost blue, spark green), soot.
- Kegs: her kegs (every 5th yellow, the Bomber's Powder) are flasks, in turn from her bandolier: **fire** (its blast
  sets every foe burning: 12% attack a second for 3 s), **frost** (slows every red on the bar by 15% for 1.5 s),
  **spark** (blasts 25% wider and x1.3 harder). The bar paints each flask in its brew; the tab shows the next one.
- Signature **Mixed Brew**: kegs come in three brews, each with its own effect on top of the blast.
- Ability (green) **Toss**: a green hit throws the next flask straight at the target (x1.5 attack, and its brew there:
  fire burns it, frost slows its reds, spark hits harder).
- Passive **Fume Mask**: traps hurt her 50% less.
- Finisher **Grand Reaction**: hits all foes; every flask on the bar goes off (each with its brew), then two new
  flasks land. (Two things to the bar.) Signature moment: three flasks hang over the foes, pour their brews, then
  smash together into one great bubble.
- Strength: +20% damage to Frost foes.

### Brann, Bellwarden (Guardian, Epic) — Part 6
- Look: a broad, calm monk with a shaved head, a grey beard and pale skin, saffron-and-maroon robes, prayer beads, a
  huge bronze temple bell (bosses, two bands, a striking pad) carried on his back and swung as a shield.
  Palette: bronze/brass, saffron, maroon.
- Signature **Toll**: every block rings his bell; each toll adds 20% to his next hit (up to 3; the hit spends them).
- Ability (green) **Peal**: for 3 s after a green hit, each red he blocks echoes 30% of its blow at every foe.
- Passive **Still Mind**: Perfect blocks store 1 more Guard.
- Finisher **Great Bell**: the bell drops on the target: one big hit that spends all stored Guard (+9% a Guard), its
  boom hits every other foe for 90% of it, and every foe is stunned for 0.5 s (a boss shrugs the stun off; only its
  reds wait). Signature moment: a giant temple bell comes down over the target, rings with each strike, drops on it;
  sound rolls across the stage.
- Strength: takes 20% less from Casters.
### Gorm, Stonefist (Brute, Legendary) — round 7
- Look: a huge, gentle half-giant with grey-green skin, a big jaw with two little lower teeth, a tuft of moss-green
  hair, a leather harness studded with stones, and two enormous stone gauntlets (moss on top). Palette: stone greys,
  moss green, leather browns. The broadest hero in the box: a small head on great shoulders.
- Signature **Rockfall**: every 4th hit lands heavy (x1.6 on top of Heavy) and nudges the nearest red on its way back
  (a red already striking is left alone).
- Ability (green) **Roar**: the foes flinch; every red on the bar slows a little (x0.92) for 1 s.
- Passive **Thick Skin**: the first hit you take each wave deals 10% less.
- Finisher **Landslide**: boulders hit every foe and smash every red; then rubble lies over the bar's right quarter
  for 2 s and every red crossing it slows (x0.9). (Two things to the bar.)
- Numbers: HP 85, attack 0.75 of Rowan's. Every bit of red control compounds at the 75% player (a red slowed or
  pushed back also keeps the next one off the bar), so his red numbers are small: tuned with the bot against Rowan.
- Its show: a slam sets boulders rolling through the foes; last, a great boulder drops on them; a heap of rubble.
- Strength: +20% damage to Armored foes (shells, knights).
- Meets the party out of a hero chest (`meetGorm`): napping in it, folded up "like a nice rock".

### Tess, Timekeeper (Controller, Epic) — round 7
- Look: a small, sharp old clockmaker: a grey bun pinned with a brass gear, round brass spectacles, a teal waistcoat
  over a cream blouse, a tool belt, a staff topped with a big brass pocket watch. Palette: brass, teal, cream.
- Signature **Stopwatch**: every 16 hits, time stops for the reds: they hold still for 0.3 s while the cursor moves
  (an icicle's fuse waits too).
- Ability (green) **Slow Time**: for 1.5 s, every red moves at 90% speed (the ones that come in too).
- Passive **Steady Hands**: ice and snow patches change her cursor's speed 75% less.
- Finisher **Rewind**: hits all foes and winds every red on the bar back to where it came on (an icicle's fuse to
  full).
- Its show: a great brass clock rises behind the foes, its hands spin backwards, faster and faster, and it chimes.
- Strengths: +25% damage to Constructs and to Fire foes (Rewind keeps the reds, so the third region's hard reds come
  back: the Fire edge is what keeps her level with Rowan there).
- Numbers: HP 100, attack Rowan's. Red numbers small for the same reason as Gorm's.
- Meets the party out of a hero chest (`meetTess`): "You're four minutes late."

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
| Solenne | Sunrise burns 5 s (Long Dawn) | Sunfall gilds every yellow on the bar (High Noon) |
| Wren | after a dodge, her next hit crits (Grapple) | Rooftop Drop readies a dodge (Roof Hop) |
| Yara | the Tortoise's shell takes two reds | the Great Spirit stays twice as long |
| Dell | Ricochet bounces on to one more foe | a Lucky Shot stuns its foe (1 s) |
| Fizz | brews 50% stronger (burn, chill, blast) | Grand Reaction lands a flask of every brew |
| Brann | the bell holds 5 tolls | Great Bell's boom hits the other foes for 130% (from 90%) |
| Gorm | Rockfall every 3rd hit | Landslide's rubble stays twice as long |
| Tess | the Stopwatch every 13 hits | Rewind stops time too |

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
| Burr | Common | a round brown hedgehog with a leaf stuck on his spines | rolls into the target every 6 hits | **Prickly:** when a red (or bomb) hits you, spines fly back at the foe that threw it (1.5x his roll) |
| Lark | Rare | a small yellow songbird with a red cap (a flier) | pecks every 4 hits | **Wake-up Song:** every 10 combo, the next yellow glows with a note: hitting it adds 3 more combo |
| Gloam | Epic | a slim black cat with glowing violet eyes and a moon mark | swipes every 5 hits | **Night Eyes:** every 12 s, the next trap on the bar is swatted into a yellow (where it stands: nothing is added) |
| Nimbus | Mythic | a tiny sky whale wrapped in a cloud, star freckles (a flier) | sprays every foe every 7 hits | **Tide:** every 20 s (once a red is in the bar's near half), a wave crosses the bar and pushes every red back; **Calm Seas:** at 30+ combo, hits deal 15% more |

### Toward 30: six more (DESIGNED, NOT BUILT; story team, round 8)
Six concepts for a later art and code pass, written to the living map (each wandered in from a redrawn or erased land;
docs/story-bible.md section 4) and the round's mature tone (L8: weathered, dry, no toy-like names). Each perk is in
plain words and shows on what it touches. Numbers are placeholders for the bot, kept small after round 7's lessons:
red control compounds, so nothing here stops a boss's red outright, and forgiveness counts toward the cap of 3. Per
the table's pattern, a Common to Rare companion has its first perk, and the second comes at 3 stars. When built,
each needs a look and a short line in `view/companion-cards.ts`, an entry in `view/perk-at.ts` and with/without
tests, and a bio in `companions.ts` (these bios are written).

| Companion | Rarity | Creature, look | Bio | Attack | Perks | Found |
|---|---|---|---|---|---|---|
| Thistle | Common | a wiry grey field mouse, a torn ear, a seed husk for a hat | "Slept through the blank in a grain sack. Woke up hungry, and unimpressed." | nips every 5 hits | **Stowaway:** once a fight, a miss that would break your combo doesn't (the mouse squeaks on the cursor; it counts toward the 3 forgiven misses). **Gleaning (3★):** a fight won without a miss pays a few coins (the mouse drags one to the purse). | hero chests, from Greenmarch on |
| Rook | Uncommon | a one-eyed rook, a link of chain in his beak | "Pulled one link out of his chains. Kept it. Won't say why." | pecks every 4 hits | **Loose Link:** every 12 s, when you hit one block of a linked pair, Rook pecks its partner for you (he lands on it). **Carrion (3★):** when a foe falls, Rook pecks the next foe once (on that foe). | hero chests, from Ashfell on |
| Wick | Rare | a fen moth with wings that glow like a lantern turned down low | "Lived in a fen lantern until a toad ate it. Holds a grudge against toads." | flutters at the target every 5 hits | **Lamplight:** dark blocks just ahead of the cursor are lit a moment sooner (her glow on them). **Moth's Way (3★):** after a block, the next yellow she glows over has a wider Perfect zone for that one tap. | hero chests, from the Duskmire on |
| Hask | Epic | a lean desert hare whose long ears cast the only shade around | "Her ears are the only shade on the plateau. She knows it." | kicks every 4 hits | **Shade:** a blazing block you hit while she's beside the cursor burns you half as long (her ears' shadow on the hero). **True Ground:** a mirage's ghost outline shows a moment sooner while she's out (her ears turn toward it). Off the plateau: Shade halves any burn. | hero chests, from Noonspire on |
| Bellwether | Legendary | an old ram with a cracked horn and a bell on a frayed cord | "Led a flock over the pass for twenty winters. Never once got lost. Mentions this." | butts every 6 hits | **Sure Hooves:** on ice, the cursor speeds up less while it crosses the patch he stands on (his hooves on it). **Steady Footing:** once a fight, a slipped hold keeps your combo. **Flock:** with a second companion out, both attack one hit sooner. | hero chests (rare), from the Frostpeaks on |
| Vigil | Mythic | a tall grey heron, stiff-legged, salt on her feathers | "Fishes at the very edge of the map. Has seen what lies past it. Unimpressed." | spears the target every 7 hits | **Edge Watch:** once a fight, a red that reaches the near end is speared on the bar first and hits for half (a soak, not a block). **Old Patience:** every 25 combo she stands still on the bar for 3 s: the blocks under her don't drift, hop or sink while she stands (her legs in the water). | region chests, and the shrine's Mythic pool |

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

---

## 7. Region 4: DUSKMIRE (secret; id `duskmire`; in play as global acts 9-11, on stand-in art until its own lands)

*The names here are final (decisions L3); the scenes are the story team's (`src/data/story-dusk.ts`, written to
docs/story-bible.md section 8). Bellybog and the Sluice Keeper speak in them: both need portraits.*

A marsh at dusk that never gets darker and never gets lighter: reed beds, black water, boardwalks on stilts, lanterns
on poles, a tide that comes and goes on a clock. The exiled mapmaker redrew it his way: he thought the old marsh was
"badly lit and badly drained", so he inked the sun into one lighthouse lamp (light only where *he* points it) and
penciled the shoreline in so it can be rubbed out and redrawn on a timetable (the tide). What he hasn't inked yet
stays dark: you only see what your own light reaches. That is why the bar here has **dark blocks** and **tides**.

### Bar rules (typed in `BarRules`; the core implements them: `bar.dark`, `bar.tide`)
Neither rule touches reds' readability: a red is always drawn in full, lit or not, wet or dry. Both read without
sound, and both only draw from the fight's random stream in an act that has them (the tide draws nothing at all).

- **Dark blocks** (`bar.dark: { share, fromRow, traps }`; numbers in `tuning.dark`). A yellow, green or trap that rolls
  the act's `share` comes **dark**: an unlit shape on the track (the block's size, a dim outline, two faint glints)
  that doesn't show what it is. Of the dark yellows, `traps` are traps in disguise. The cursor carries a **lantern**:
  a warm glow around it whose reach is a time, not a distance, `dark.lightSec` (0.45 s) of the cursor's travel at its
  speed right now (never less than `dark.lightMin`, 0.1 of the bar). A dark block the glow touches is **lit** (its
  colour floods in with a small spark, `lit` event) and stays lit. *Fair to a 75% thumb:* because the reach grows with
  the cursor's speed, a dark block always shows what it is at least ~0.45 s before the cursor gets there (the bot's
  reaction is 0.25 s), so nothing is a coin flip; the faster the combo, the wider the glow (it reads as "the lantern
  burns brighter"). The judge doesn't care about light: a tap is judged like any other. What darkness costs is the
  read: you can't plan a sweep you can't see, and a dark shape can be a trap (a trap that came dark bites for
  `dark.trapMult`, x0.6, of a trap's damage: it was hard to read).
  - Specials: **dim** the lantern (`snuff { mult, sec }`: the reach times `mult`, never below `dark.floorSec`, 0.32 s,
    and every lit dark block outside the glow goes dark again); **darken** yellows already on the bar (`darken
    { count }`: the ones farthest from the glow; they keep their kind, so nothing you saw as a yellow turns into a
    trap); formation entries `dark: true` (a dark yellow or a dark trap placed on purpose); `barRule darkEvery`.
- **Tides** (`bar.tide: { fromRow, low, high, period, from }`; numbers in `tuning.tide`). Water covers one end of the
  bar and rises and falls on a slow clock: from `low` (share of the bar) up to `high` and back over `period` seconds
  (a smooth swell; every fight starts at low water, so the first one teaches itself). **Under water:** a yellow,
  green, trap or any other still block whose centre is covered is **sunk**: out of reach (a tap there is a tap on
  water: a miss) until the tide falls and it surfaces again, glistening; new blocks only come on dry ground. **Reds
  wade:** a red whose centre is in the water moves at `tide.drag` (x0.8), so the shallows give a little time to block.
  So the tide trades your targets for time: hit on the dry side, block in the shallows, wait for the ebb. *Look:* a
  band of dark water at that end, its surface a moving ripple line with foam; a small high-water mark on the frame
  shows how far this tide will come; sunk blocks sit dim and wavering under the surface; wading reds leave a wake.
  The water moves at most ~0.1 of the bar a second (surges 0.25), so a block about to sink is plain to see.
  - Specials: **surge** (`tide { level, sec, from? }`: the water rushes up to `level` and holds for `sec`, then goes
    back to the act's swell; in an act with no tide it brings a flood from `from` and drains it after); `from:
    'both'` floods both ends at once (each end `level` wide).
- **Both** (Act 3): dark blocks on dry ground, the tide coming in under them; a dark block that sinks stays unlit.

How they ramp: **Act 1** dark from row 2 (share 0.3, traps 0.12; foes' specials show it earlier); **Act 2** tides from
row 1 (low 0.06, high 0.36, period 10 s, from the right: the reds come in through the water) plus a little dark from row
3 (0.15); **Act 3** both from row 0 (dark 0.3 / traps 0.15; tide 0.08 to 0.4 over 10.5 s), and the boss's phases are the
mapmaker's edits to the bar.

**Every hero** (one cursor each; `hero-kits.test.ts`, `bar-rules.test.ts`): the lantern is the cursor's, so every hero
carries it (Sable's dash carries it with her: a dash lights what it lands by). Kegs, seedlings and frozen blocks sink
like any still block; a sunk block can still be cleared by perks that clear the bar (finishers, Earthsplitter, a
keg's blast), never tapped. Suggested later (needs hooks): Neve's Glacier freezes the tide for its 4 s; Vesper's
targets glow (they light themselves).

**The bot:** sees a dark block only once it is lit (reaction from that moment, like a block that just spawned), and
misreads a dark trap now and then like a person (`(1 - accuracy) / 2` of the time it was lit less than 0.4 s ago);
leaves sunk blocks alone (and one at the waterline), except that it taps one now and then like a person who took it
for a target (`(1 - accuracy) / 4` of them).

**Probe (decisions C4):** Ashfell foes at its Act 2 numbers, a lab-strength hero, 30 fights, the 75% bot: no rules 100%
won / 62% HP lost; dark (0.3, traps 0.15) 100% / 68%; tide (0.08-0.4) 100% / 61% at drag 0.85 (48% at 0.6: wading
was a gift; 74% at 1); both 97% / 69%; the masher loses every one. Dark traps at full damage and a 0.25 share cost
+34% HP a fight (93% won): too swingy, hence trapMult and the lower shares.

### Acts
| Act | Name (working) | Theme | Map look | Rules |
|---|---|---|---|---|
| 1 | Lanternfen | `fen` | reed beds and boardwalks under a violet dusk, lantern poles, fireflies, will-o'-wisps over black pools, a sunken boat | dark (from row 2) |
| 2 | The Drowned Causeway | `causeway` | tidal flats, a half-sunk stone road, stilt houses, a tide clock tower with a painted hand, sluice gates | tides (row 1) + a little dark |
| 3 | The Gloaming Mere | `mere` | a wide black lake under a sky stuck at sunset, a lighthouse wading in the middle of it, the mapmaker's drafting stilts | dark + tides; the boss's phases are edits |

Act scaling (first guesses, each a step above the matching Ashfell act; Act 1 dips below Ashfell's Act 3 as a
region starts a fresh run): hpMult 7.2 / 7.6 / 8.4, atkMult 15.5 / 16 / 17.5, pace 0.8 / 0.76 / 0.72, redSpeed 1.2 /
1.22 / 1.28; waves 2-5 / 3-5 / 3-6; foes' base stats ~10% above Ashfell's.

### Enemies (each has a telegraphed special that changes how the bar plays)
| Enemy (key) | Act | Tags | Look | Special |
|---|---|---|---|---|
| Bog Wisp (`bogWisp`) | 1 | flyer, caster | a will-o'-wisp: a blue-green flame with a sly face and a trailing tail of sparks | **Lure!** two dark shapes land: one yellow, one trap (formation `dark`) |
| Mire Toad (`mireToad`) | 1 | beast, swarm | a fat olive toad with a lantern-orange throat sac and lazy eyes | **Gulp!** swallows the light: the lantern dims (x0.65, 4 s) and lit blocks outside it go dark |
| Reedling (`reedling`) | 1 | folk, swarm | a little reed-man, a cattail for a hat, a reed pipe | **Rustle!** 3 yellows on the bar go dark (`darken`) |
| Peat Golem (`peatGolem`, elite) | 1 | construct, armored | a hulking golem of peat and roots with a caged lantern for a heart | **Peat Slam!** a slow, wide red; **Smother!** the lantern dims (x0.6, 5 s), and 2 dark traps |
| Mudskipper (`mudskipper`) | 2 | beast, swarm | a goggle-eyed mudskipper standing on its fins, cheeky grin | **Splash!** a surge: the water rushes up to 0.45 of the bar for 3 s |
| Stilt Heron (`stiltHeron`) | 2 | flyer, folk | a tall heron in a ferryman's coat on long stilts, a punt-pole spear | **Spear Dive!** two fast reds, one behind the other (the second wades in the water) |
| Lamplighter (`lamplighter`) | 2 | folk, caster | a hunched little lamplighter with a long wick-pole and a hood like a candle snuffer | **Snuff Out!** every block outside the light goes dark, and 2 dark yellows |
| Old Snapper (`oldSnapper`, elite) | 2 | armored, beast | a mossy snapping turtle the size of a cart, a shell like a sunken island | **High Tide!** water from both ends (0.25 each) for 4 s; **Snap!** a fast, wide red |
| Ink Eel (`inkEel`) | 3 | beast, caster | a long black eel that leaves ink in the water, glowing violet spots | **Undertow!** the water floods from the other end (0.4, 4 s) |
| Dusk Moths (`duskMoths`) | 3 | swarm, flyer | a cloud of grey-violet moths around a stolen lantern | **Flutter!** the lantern dims (x0.6, 4 s) and 2 dark traps |
| Bog Hag (`bogHag`) | 3 | caster, folk | a mossy marsh hag stirring a kettle on a stick, a lantern-jaw grin | **Fog Bank!** 3 dark shapes (one a trap) and the lantern dims (x0.7, 3 s) |
| Sunken Sentinel (`sunkenSentinel`, elite) | 3 | construct, armored | a knight's armour full of marsh water, weed for a plume, a drowned lantern | **Floodgate!** a surge (0.5, 4 s); **Blackwater!** 2 dark traps and a still red |

Every hero's soft strength has foes here (folk, caster, beast, swarm, armored, flyer, construct; brute only in the
first mini-boss). New foe tag: none (`water` was considered; no hero leans on it, so it would only be a label).

### Mini-bosses
- **Old Bellybog** (`bellybog`, Act 1, beast, brute): a toad the size of a hut who swallows lanterns ("free light, just
  lying around") and glows from inside like a paper lamp. **Gulp!** (the lantern dims x0.6, 4 s, lit blocks outside go
  dark); **Tongue Lash!** a fast red; **Belly Glow!** (below 50%, gate) he burps the lanterns back up, and from then
  on every 2nd yellow he sends comes dark (`barRule darkEvery 2`); **Burp!** (phase 2) 3 dark shapes, one a trap.
- **The Sluice Keeper** (`sluiceKeeper`, Act 2, construct, folk): a beaver engineer in a brass diving helmet who runs
  the floodgates for the mapmaker on a strict timetable (a pocket watch, a clipboard). **Open the Gates!** a surge
  (0.5 for 4 s); **Dam Up!** a still shield (3 taps) where the cursor is heading; **Spillway!** (below 50%, gate) the
  water comes from both ends (0.25 each, for good: `tide` sec 0); **Overtime!** (phase
  2) two reds, one after the other.

### Boss: the Gloaming Lighthouse (`lighthouse`, Act 3, construct) — each phase is one of the mapmaker's edits
A lighthouse the mapmaker drew wading in the mere on stone legs, the sun shut in its lamp (that is why the marsh is
stuck at dusk); its beam sweeps the water, its door a mouth. The mapmaker stands on its gallery with his pen and
redraws the fight as it goes (each phase change: his scene, then the bar changes, `phaseScenes`).
- Phase 1, as drawn: **Fog Horn!** every yellow outside the light goes dark, 2 dark traps; **Breakers!** two reds.
  (Later, with a `lightSweep` action: **Beam Sweep!** the lighthouse's own beam crosses the bar, lighting every dark
  block it passes, while the lantern dims behind it.)
- Phase 2 (66%, gate, scene `lighthouse2`), edit one, "the shoreline was in the wrong place" (**Shore Redrawn!**): the
  tide comes from both ends (0.22 each, for good) on top of the act's swell; **Breakers!** and **Fog Horn!**; every
  3rd yellow it sends is dark.
- Phase 3 (33%, gate, scene `lighthouse3`), edit two, "nobody needs a sky" (**Sky Erased!**): blackout: the lantern
  dims for good (x0.7), every 2nd yellow dark, the cursor never drops below 1.3x; **Breakers!** and **Surge!** (0.45
  for 3 s, every 8 s). Beaten: the lamp cracks, the sun rolls out and up, and the marsh finally gets its night (and then its
  morning).

### Story (scene ids; written by the story team in `src/data/story-dusk.ts`)
- `dusk1` (Act 1 start), `bellybog` (mini-boss intro), `duskCamp` (a camp scene after Act 1, like `magsTale`),
  `dusk2` (Act 2 start), `sluiceKeeper` (mini-boss intro), `dusk3` (Act 3 start), `lighthouse` (boss intro),
  `lighthouse2`, `lighthouse3` (the mapmaker's two edits, mid-fight), `duskVictory` (the sun comes out; next region).
- Speakers: `bellybog`, `sluiceKeeper` (portraits needed), the Mapmaker (`mapmaker`); the lighthouse doesn't speak (he
  speaks from its gallery).

### Relics (Light and Tide tags; offered from the region's first act on: `from: 9`)
As built (`src/data/relics-dusk.ts`, hooks `core/relic-fx-dusk.ts`, with/without tests `tests/unit/relics-dusk.test.ts`;
not merged into RELICS yet). Light: **Moth Wing** (hits on dark blocks +40%), **Wick Trimmer** (rare: Perfects on dark
blocks crit), **Night Owl** (the light reaches 30% further), **Lantern Oil** (rare: lighting a dark block fills 50% of a
hit's meter), **Glow Worms** (each dark block hit drops a coin), **Ember Jar** (rare: the light burns dark traps away
before they can bite), **Blindfold** (epic: the light reaches 40% less; hits on dark blocks x3). Tide: **Wading Boots**
(blocking a red in the water heals 2 HP), **Driftwood** (rare: a block that came up out of the water in the last 1.5 s
crits), **Undertow Charm** (reds wade 25% slower), **Low Water** (rare: the water comes 25% less far), **Tidepool**
(each block that comes up drops a coin), **Spring Tide** (rare: hits within 0.08 of the waterline +50%), **Moonpull**
(epic: blocking a red in the water knocks the next red back 0.15; the tide comes 25% further).
Builds: Lamplighter (Light), Tidewalker (Tide), Marshlord (Light + Tide), Moonlit (Light + Crit), Breakwater (Tide +
Block). Hook points (core/hooks.ts, built): `lit`, `lightReach`, `surfaced` (with `Block.wet`, `Block.surfacedAt` and a
`surface` event), `wadeMult`, `tideMult`. Merging: the tags and ids into the unions in relics.ts, tag chips and glyphs
(relic-ui.ts, relic-log.ts), an icon each, numbers into `tuning.relics.n`, an entry each in view/perk-at.ts, and
`DUSK_RELIC_HOOKS` into RELIC_HOOKS; the cautious bot's `avoid` list should take Blindfold and Moonpull.

### Gear (`src/data/gear-dusk.ts`, merged into gear.ts)
Bases: Reed Spear, Lantern Mace, Peat Maul (weapons); Moss Cowl, Snapper Helm (helms); Reed Mail, Shellplate (armor);
Stilt Boots, Mud Treads (boots); Wisp Charm, Tide Pearl (trinkets).
Set: **Lamplighter's** (Wick Hood, Oilskin Coat, Waders, Firefly Jar): 2-piece +20% damage on dark blocks; 4-piece
blocking a red in the water heals 2% HP (core: `tuning.effects.lampDark`, `lampHeal`).
Signature Legendaries (the Lighthouse): **Sunlamp** (trinket, *Daybreak*: your light reaches 50% further: a
`effects.sunlamp`), **Breaker's Edge** (weapon, *Riptide*: blocks up out of the water in the last 1.5 s take x3:
`effects.riptide`, `riptideSec`).

### Camp banter (`src/data/banter-dusk.ts`, played by the camp)
10 lines, each waiting for a Region 4 scene (`after`), none naming the mapmaker until the story team names him.

### Music (each piece: a distinct key, tempo and instruments, unlike Regions 1-3 and each other)
| Piece | Key | Tempo | Instruments / feel |
|---|---|---|---|
| Lanternfen (calm / intense) | Eb Mixolydian | 84, 12/8 shuffle | calm: a slide dobro, soft banjo rolls, a harmonica on the tune, a frog-croak guiro, a cricket shaker, an upright bass walking slow; fight: a washboard groove, the bass in 8ths, the dobro on the tune; lead: a harmonica wail |
| The Drowned Causeway | G Aeolian | 100, 6/4 (3+3 against 2+2+2: a tide-like hemiola) | calm: a vibraphone with slow tremolo, a low accordion drone, a bowed saw on the tune, water lapping (filtered noise swells every bar); fight: hand claps and a talking drum on the hemiola; lead: a reedy accordion |
| The Gloaming Mere | A Phrygian | 120 | calm: a low pipe organ, a choir "oo", a tolling bell every 2 bars, a theremin-like sine with wide vibrato on the tune; fight: a driving 16th bass, taiko, the organ in stabs; lead: the theremin an octave up |
| Old Bellybog (mini-boss) | E Mixolydian | 176, a zydeco two-step | (fight only) an accordion on the tune, a washboard (frottoir) in 16ths, a fiddle, a tuba burp on each phrase end |
| The Sluice Keeper (mini-boss) | D Dorian | 112, 7/4 (4+3) | (fight only) a work song: a mallet on a pipe on every beat, a bari sax riff, a ratchet like a turning wheel, a whistle blast every 4 bars |
| The Gloaming Lighthouse (boss, by phase) | C# Phrygian; phase 3 a whole tone down to B | 152 | phase 1: a foghorn drone, a bell tower, strings in tremolo, war drums; phase 2 adds a choir and a harpsichord scratching like a pen; phase 3 drops a whole tone (the "redraw"), double-time drums, distorted bass, everything in |

Ambience beds: `fen` (frogs and crickets, reeds in a breeze, a far owl), `causeway` (water lapping on stone, the tide
clock ticking, gulls far off), `mere` (a deep still-water hum, a slow foghorn, the lighthouse's lamp humming).

#### As built (`src/engine/music.ts`, tracks `dusk1..3`, `bellybog`, `sluiceKeeper`, `lighthouse`; cued in app.ts)
| Track | Key, tempo, meter | Calm | Intense (base; the combo's drums / bass / lead; phases) |
|---|---|---|---|
| `dusk1` Lanternfen | Eb Mixolydian, 84, 12/8 (24 16ths, a dotted-quarter beat) | a dobro on each beat, banjo rolls in triplet 8ths, the harmonica on the tune, a walking upright bass, a frog-croak guiro and a cricket shaker | the dobro on the tune over banjo rolls; a washboard shuffle and a two-beat kit; the bass in 8ths; the harmonica wailing an octave up (bending into its long notes) |
| `dusk2` The Drowned Causeway | G Aeolian, **102** (100 is the title's), 6/4 (vibes in threes over an accordion drone in twos) | vibraphone with motor tremolo, a low accordion drone, a bowed saw on the tune, water lapping every bar | a talking drum and claps in threes against a kick in twos; the bass; a reedy accordion lead |
| `dusk3` The Gloaming Mere | A Phrygian, 120 | a low organ, a choir "oo", a bell tolling every 2 bars, a theremin on the tune | organ stabs, taiko, a 16th bass; the theremin an octave up |
| `bellybog` | E Mixolydian, 176, a swung two-step | (fight only) | accordion on the tune and its left hand's oom-pah, a washboard in 16ths, a tuba burp every phrase; the kit, a walking tuba, the fiddle; phase 2 (lit up): the accordion's chords stab the offbeats, the burps double |
| `sluiceKeeper` | D Dorian, **114** (112 is Act 7's), 7/4 counted 4+3 | (fight only) | a bari sax on the riff, a mallet on a pipe every beat, a ratchet on the 3, a steam whistle every 4 bars; the kit on the 4+3, the bass, the sax up an octave; phase 2 (the spillway): the whistle every bar, brass stabs on the 3 |
| `lighthouse` | C# Phrygian, 152; phase 3 B Phrygian (`keyUp: -2`, the redraw) | (fight only) | phase 1: string tremolo, a foghorn every 2 bars, a bell tower, horns on the tune, war drums; phase 2: the kit, a choir and a harpsichord scratching 16ths like a pen; phase 3: a whole tone down, double-time drums, a distorted bass, the lead (theremin and horn), brass stabs |
Sound lab labels by act number only (global 1-based: "Act 10: map", "Act 11 mini-boss, phase 2", "Act 12 boss, phase
3"). Ambience beds as built (`audio.ts`, cued by act in app.ts): `fen` (reeds in a breeze, a low hush, frogs croaking,
a cricket; the owl was too loud on a phone under the Lanternfen music), `causeway` (the tide's hush, water lapping on stone, the tide clock ticking far off,
gulls), `mere` (a deep still-water hum and the lamp humming far off, a slow foghorn out on the water, lapping, a frog).
Telegraphs (`DUSK_NEW_SOUNDS`; drafted, not in yet: the generic wind-up plays until they pass the telegraph tests): lure (sly rising bubbles, two pings), gulp (a throat swelling, a
deep glunk), rustle (three swishes of reeds), splash (a rising rush, a splash, drops), snuff (a fluttering flame, the
cup's tok, smoke), undertow (a whirl sinking and quickening, a deep pull), flutter (papery wingbeats speeding up),
fog (a kettle bubbling, a whoosh, a hollow hoo), floodgate (a windlass creaking up, water roaring through), burp (a
long rattling croak), sluice (a ratchet winding faster, the steam whistle), foghorn (a low beating blare), redraw (pen
strokes scratching back and forth, an eraser's squeak; "pen scratch" in the Sound lab).

#### Art as built
- Foes (`src/engine/art-dusk.ts`): every foe's idle0/idle1/windup/attack/hurt/flash/tell, the tell being its special
  (the wisp dangles two little lights, one a yellow; the toad's throat swells gold; the reedling's reeds fan out; the
  golem cups a hand over its lantern heart; the mudskipper leaps out of a splash; the heron crouches on its stilts,
  wings spread, spear levelled; the lamplighter caps his flame; the snapper raises its head, water pouring off its
  island; the eel rears over a whirl of ink; the moths close round their lantern; the hag swings up her kettle in a
  fog bank; the sentinel's visor opens and the marsh pours out). Old Bellybog (`bellybog2_*` past half HP: the belly
  glows gold like a paper lamp, his crown lantern blazing); the Sluice Keeper (brass diving helmet, porthole face,
  pocket watch, wrench, steam from the valve when he gives orders). The Lighthouse: lime-washed with red bands, on two
  legs of stacked stone, its door a mouth, the sun in the lamp, its beam sweeping, the mapmaker a small figure with a
  pen on its gallery (64 px tall, so its lamp stays clear of the enemy plate); `lighthouse2_*` the shoreline redrawn (water up to its knees, fresh pencil hatching and a pencil
  guide line across the stone); `lighthouse3_*` the sky erased (two broad eraser strokes rubbed back to paper, the
  bands gone to ink, the lamp shuttered to a red glare, its windows lit like eyes, no beam).
- Backdrops (`backdrop-dusk.ts`): Lanternfen (willows far off, black pools mirroring the dusk, reed beds, stilt houses
  with a lit window, a sunken boat, lantern poles with their light wavering on the water, a plank boardwalk under the
  fighters; a willow's fronds and tall cattails frame it); the Drowned Causeway (tidal flats and sandbars, the stone
  road running off half-drowned to the horizon, the tide clock tower with its one painted hand, a sluice gate, stilt
  houses; wet flagstones underfoot; mooring posts and a hung lantern frame it); the Gloaming Mere (a burning sunset
  over a wide black lake, the lighthouse far out on its legs with its beam laid across the water, the mapmaker's
  drafting stilts, dead snags; black shingle underfoot; a drowned tree and a cairn with a lantern frame it).
- Map: one painter for the three (fen pools and boardwalks; flooded flats and causeway flags; a black lake and a
  shingle path), willows, reed clumps, stilt huts and lantern poles (their light pools and pulses), snags; lairs: the
  toad's mudhole full of lanterns, the sluice gate, the lighthouse. Critters: bog frogs and a heron (fen), mud crabs
  (causeway), moths and a frog (mere).

### Balance targets (a 75% player, a fresh first playthrough of the region, from a typical end-of-Ashfell hero)
Act 1 ~85% first try, Act 2 ~68%, Act 3 ~55%, the Lighthouse's first fight won ~50-60%; Region 5 a little harder. The
masher bot loses every Act 3 and the boss's first fight (`bot-masher.test.ts`); every hero within +/-10 of Rowan. Thumb
rules: the lantern's reach never under 0.32 s, the tide never over half the bar, reds as in `tests/unit/data.test.ts`.

### Wiring it in (the core owner's checklist, as for Ashfell)
1. The two rules in combat (done: `bar.dark`, `bar.tide`, the actions `darken`, `snuff`, `tide`, formation `dark`,
   `barRule darkEvery`; `tuning.dark`, `tuning.tide` with sliders), the relic hook points, the bot.
2. Data: `DUSKMIRE` into `REGIONS` (acts 9-11), `DUSK_ENEMIES` into `ENEMIES`, story, relics, gear, banter, tips.
3. Art and sound: the three themes in `Theme`; backdrops (`backdrop-dusk.ts`), stage lights, map kits, lairs and
   critters (fireflies, a heron, frogs; crabs, gulls; moths, a catfish); foe sprites and telegraph poses (`art-dusk.ts`);
   every foe's map mini (`art-minis.ts`); portraits; the three landmarks and `landOpen`; telegraph sounds; the six
   pieces and three beds (Sound lab labels by act number only).

### As wired (round 8, team content C6-C8)
- **In play** as global acts 9-11 after Ashfell's victory (its land opens at `actsCleared >= 9`, the generic
  `landOpen`); a fresh run like every region; `duskCamp` plays at the camp after its first act (like `magsTale`).
- **Stand-ins until DUSK-ART's art lands** (each switches itself off when the real texture or track exists): foes fight
  in an earlier foe's sprite set (`SPRITE_STAND_IN` in view/fighters.ts: wisp -> aurora wisp, toad -> slime, reedling ->
  shaman, peat golem -> golem, Bellybog -> big slime, mudskipper -> slimelet, heron -> crow, lamplighter -> frost
  weaver, snapper -> glacier tortoise, Sluice Keeper -> drift troll, ink eel -> magma eel, moths -> prism bat, hag ->
  hailcaller, sentinel -> chain sentinel, the Lighthouse -> Bellows); unbuilt telegraph sounds play `charge`;
  Bellybog and the Sluice Keeper speak from an empty frame; the acts wear `DUSK_STAND_IN` themes (hollow, caves,
  glass), so backdrops, map kits and critters are those; the music clamps to `ash3` and the beds follow the stand-in
  themes. World map: `WORLD_ACTS_DUSK` (art-world-lands.ts) puts Act 10 at the drowned arch (779, 254), Act 11 at the
  stilt village (626, 254), Act 12 at the lighthouse's lamp (708, 234), placeholders for the land's art team. The region
  card has its sites (`REGION_SITES.duskmire`) on a fogged sheet until its parchment map is drawn.
- **Balance** (75%, Rowan, from a typical end-of-Ashfell hero; the guard is `tests/unit/bot-region4.test.ts`, 40
  runs of `balanceCampaign` through four regions, seed 7). The first guesses were far too easy (96% / 100% / 76% first
  try): the hero arrives at level 18-20 and wading slows reds. The mini-bosses decide each act (first try = their first
  fight), so their HP and attack and each act's red speed were the levers; act attack alone moved little. As tuned:
  hpMult 7.4 / 8 / 9.8, atkMult 20 / 24 / 25, redSpeed 1.3 / 1.42 / 1.42; Old Bellybog 4000 HP; the Sluice Keeper 5800
  HP, atk 24. Measured after merge 3 (two 40-run samples, seeds 7 and 8): Act 10 84 / 90%,
  Act 11 71 / 74%, Act 12 53 / 69% (at hpMult 9.6: 55 / 64; at 10.1: 45 / 49), the Lighthouse's first fight the same
  (the act's first try is its boss's): a little above the targets in Acts 11-12, inside the guard's bands (the Sluice
  Keeper's retag in chunk 3 takes Act 11 down about 10 points for Rowan); fights 13 / 15-16 / 19 s, boss fights ~60 / 63 / 85 s. Samples of 40 swing 10-25
  points (seed 7 vs 8), so read one run of the guard as a band, not a number. `npm run region-tune` (cached end-of-Ashfell profiles from
  before merge 3, its own seeds) read Act 11 harder than the guard (44-69% where the guard reads 70-86%): use it for
  gaps between heroes, the guard for the targets, and rebuild its cache after other teams' changes. The masher never wins the
  Lighthouse (0 of 73 tries over 15 seeds).
- **Hero parity, 100 runs a hero** (round 8, chunk 3: region-tune from end-of-Ashfell profiles cached after merge 3;
  gaps to Rowan in Acts 10 / 11 / 12; a 100-run gap moves about ±7). First read: Sable +6 / +6 / -17, Neve -8 / -34 /
  -20, Tess -27 / -10 / -28, Vesper -9 / -33 / -26, Dell -14 / -20 / -36. Three causes found and fixed, each in how a
  kit meets the region rather than in a hero's numbers: (1) the bot left everything in or near the water alone, so it
  never tapped Neve's floating ice: one rule now says what can sink (`Combat.canSink`: reds wade, ice floats, a
  Marksman's target stands on its post) and the bot asks it; (2) Marksman targets (Vesper's and Dell's greens) light
  themselves and stand above the tide (their Focus fires on greens, and the mere's dark and water took them away); (3)
  the Sluice Keeper was tagged folk, which the starting hero (the reference) hits 20% harder: now beast and armored (a
  beaver in a brass diving helmet). After: Neve -8 / 0 / -2, Dell -10 / -6 / -17, Vesper -9 / -23 / -16, Tess -27 /
  -16 / -26, Sable +6 / +16 / -11 (Rowan 84 / 57 / 59 in that sample). Left: Tess everywhere in the region (her soft
  strengths are fire and construct, and only the Lighthouse is construct here; a kit idea: her Stopwatch also holds
  the tide still), Vesper in Act 11, Sable ahead in Act 11. The other heroes weren't re-run at 100 (30-run reads were
  within noise).
- Region 5's first-guess numbers were raised to stay a step above (atkMult 21 / 25 / 26.5, redSpeed 1.32 / 1.44 /
  1.44, Act 3 hpMult 10.2).

### Build calls (decisions.md round 8, team content C1-C3; kept here: spoilers)
- **Dark blocks: the light is a time, not a distance.** The cursor's lantern reaches `dark.lightSec` (0.45 s) of
  its travel at its current speed, so it widens as the combo speeds the cursor up and a dark block always shows
  what it is well before the cursor gets there (fair to a 75% thumb); a dimmed lantern never reaches under
  `floorSec` (0.32 s). Lit blocks stay lit. Dark hides a block's kind, never its place (a shape with a rim), and
  nothing the player saw as a yellow becomes a trap (`darken` keeps kinds; traps are only ever dark from the start).
  Reds are never dark.
- **Tides: water takes targets and slows reds.** Water covers one end (or both), swelling slowly from low water at a
  fight's start; a still block whose centre is under it is out of reach (a tap there is a miss), reds wade, new blocks
  come on dry ground. The swell never moves faster than `tide.swellSpeed` (0.1 of the bar a second; the data test
  checks every act), surges at 0.25; water never covers more than 0.6 of the bar. The tide draws no random numbers
  (fights start at low water), so acts without it play exactly as before. Player word: "the tide" / "water"
  (Nimbus's companion perk is also called Tide: a wave that pushes reds; if playtests confuse them, rename Nimbus's).
- **Tuned by a bot probe** (30 fights a rule, 75%): dark traps at full damage cost +34% HP a fight, so a trap that
  came dark bites for 0.6 (`dark.trapMult`) and the trap shares are 0.12-0.15 of dark yellows; wading at 0.6 made
  the tide a gift (HP lost 48% vs 62% without), so reds wade at 0.8. The bot waits for the light, misreads a dark
  trap (1 - accuracy) / 2 of the time, and slips onto a sunk block (1 - accuracy) / 4 of the time.
- **Region 4 joined REGIONS ahead of its art** (lead's brief, round 8): stand-ins until it lands (As wired, above).

---

## 8. Region 5: NOONSPIRE (secret; id `noonspire`; wired behind a switch, out of the campaign until its art exists)

*The story is docs/story-bible.md's (section 8, "Noonspire"; the midpoint twist is there); the scenes are the story
team's (`src/data/story-noon.ts`: `noon1`-`noon3`, `noonBoss`, `noonBoss2`, `noonBoss3`, `noonVictory`); the foes,
mini-bosses and the bar are Team 3's. Its "rule hook" in the story bible (glare and mirages, blocks that blaze or lie)
is what the two rules below build.*

A high desert plateau of white towers and great sundials. The Mapmaker drove a nail through the sun and pinned it at
noon: no night, no cold, no shadows, and nobody can tell the time or the way. On the bar: **mirages** (the haze lies
about where things are) and **heat** (the glare that hits hard and burns).

### Bar rules (typed in `BarRules`; the core implements them: `bar.mirage`, `bar.heat`)
- **Mirages** (`bar.mirage: { share, fromRow, every }`; numbers in `tuning.mirage`). A yellow that rolls the share is
  a mirage: a heat shimmer rises off it, and every `every` s or so it **hops** to another spot. Its landing spot is
  chosen first and shown as a blinking ghost outline (with a dotted line of shimmer from the block) at least
  `warnSec` (0.55 s) before the hop; it never hops while the cursor is within `safeSec` (0.45 s) of travel of either
  spot (it waits), so a tap aimed at it as the cursor arrives is never stolen; it hops at least `minHop` (0.15) and
  lands on dry, free ground. Specials: `hop { count }` (yellows become mirages and hop soon, farthest first), formation
  `mirage`.
- **Heat** (`bar.heat: { share, fromRow }`; numbers in `tuning.heat`). A yellow that rolls the share **blazes** (a
  white-hot rim, rays of sun flickering over it): a hit on it lands x`mult` (1.4) and gives the hero a stack of
  **Heat** (up to `max` 3): each stack burns `dps` (0.5% of max HP a second) in ticks for `sec` (4 s; a new stack starts
  it over), never breaking the combo; a **green hit cools** every stack. On the hero: an orange glow at his feet, heat
  shimmer rising, a flame pip per stack over his head. Specials: `blaze { count }`, formation `blaze`, `barRule
  blazeEvery`. The choice it asks: take the big hit and the burn, or leave it (a green is the way out).
- *Fair to a 75% thumb:* nothing moves under the cursor at the last moment (the ghost shows first, the hop waits), and
  Heat is a slow burn (at most 6% of max HP from one full cycle) with a visible cure.
- *The bot:* leaves a mirage whose ghost shows unless it is about to reach it (closer than `safeSec`); leaves blazing
  yellows while its Heat is full and its HP under half.

*Probe* (as Region 4's: Ashfell foes at its Act 2 numbers, a lab-strength hero, 30 fights, the 75% bot): no rules
100% won / 62% HP lost; mirages (0.2, 2.5 s) 100% / 54% (the bot waits a hop out; a person reading a ghost late is
the real cost); heat (0.2) 100% / 66%; both 100% / 74%; the masher loses every one.

How they ramp: **Act 1** mirages from row 2 (0.25, every 2.8 s); **Act 2** heat from row 1 (0.2) plus a few mirages
from row 3 (0.1); **Act 3** both from row 0 (mirages 0.2 every 2.5 s, heat 0.2).

### Acts
| Act | Name | Theme (stand-in) | Map look | Rules |
|---|---|---|---|---|
| 1 | The White Road | `whiteRoad` (`pass`) | a white road across the plateau, salt pans, standing stones with no shadows, mirages of lakes | mirages (row 2) |
| 2 | The Spire Steps | `spireSteps` (`ruins`) | stairs between white towers, brass gates, sun-hot plazas, the Dawn Order's spire | heat (row 1) + a few mirages |
| 3 | The Great Sundial | `sundial` (`cinder`) | the great dial at the plateau's heart, its needle walking, the Nail through the sun above | both; the boss's phases are his edits |

Act scaling (first guesses, a step above Lanternfen's): hpMult 8.2 / 8.8 / 9.6, atkMult 17 / 18 / 19.5, pace 0.78 /
0.74 / 0.7, redSpeed 1.24 / 1.26 / 1.32.

### Enemies (`src/data/enemies-noon.ts`)
| Enemy (key) | Act | Tags | Look | Special |
|---|---|---|---|---|
| Dune Skink (`duneSkink`) | 1 | beast, swarm | a sand skink with a blue stripe, a flicking tongue | **Skitter!** 2 yellows turn to mirages |
| Glare Hawk (`glareHawk`) | 1 | flyer, beast | a pale gold hawk whose wings flash white | **Sun Dive!** two fast reds |
| Dune Bandit (`duneBandit`) | 1 | folk, caster | a veiled bandit, a curved blade, a mirror on his back | **Mirror Trick!** 2 mirage yellows land |
| Dune Colossus (`duneColossus`, elite) | 1 | construct, brute | a sandstone giant, sand pouring from its joints | **Sandslide!** a slow wide red; **Haze!** every yellow a mirage |
| Ember Scarab (`emberScarab`) | 2 | swarm, beast | a brass scarab rolling a sun-hot ball | **Scorch!** 2 yellows blaze |
| Brass Sentry (`brassSentry`) | 2 | construct, armored | a brass automaton with a sun disc for a chest | **Sunflash!** 3 yellows blaze, a red behind the glare |
| Sand Salamander (`sandSalamander`) | 2 | beast, fire | an orange salamander with flame spots | **Bask!** every 3rd yellow it sends blazes |
| Sunforged Golem (`sunforgedGolem`, elite) | 2 | construct, brute | a white-hot golem, a kiln door for a heart | **Searing Slam!** a fast wide red; **Kiln Heart!** every yellow blazes |
| Dial Warden (`dialWarden`) | 3 | folk, armored | a sun-white robed guard with a hand mirror | **Hand Mirror!** 2 yellows blaze, 2 turn to mirages |
| Heat Djinn (`heatDjinn`) | 3 | caster, flyer | a wavering column of orange air with a sly face | **Haze!** every yellow a mirage |
| Sun Vulture (`sunVulture`) | 3 | flyer, swarm | a vulture, wings bleached white, a bald red head | **Circle!** two reds |
| Noon Knight (`noonKnight`, elite) | 3 | construct, armored | white-gold armour behind a mirror shield | **Noon Blade!** two reds; **Mirror Shield!** every yellow blazes, 2 mirages |

### Mini-bosses
- **The Noon Sphinx** (`sphinx`, Act 1, beast, caster): guards the road with riddles of light. **Riddle!** (phase 1)
  every yellow a mirage; **Pounce!** a fast red; **Sun Eyes!** (below 50%, gate) every 2nd yellow she sends blazes;
  **Last Riddle!** (phase 2) a blazing mirage and a mirage land.
- **The Brass Lion** (`brassLion`, Act 2, construct, beast): the spire stairs' guardian, its mane too hot to touch.
  **Roar!** (phase 1) 3 yellows blaze; **Maul!** a fast red; **Overheat!** (below 50%, gate) every 2nd yellow it
  sends blazes; **Shimmer!** (phase 2) 3 yellows turn to mirages.

### Boss: the Gnomon (`gnomon`, Act 3, construct, armored) — each phase is one of the Mapmaker's edits
The great sundial's needle stood up as a brass sentinel; the Nail through the sun above it is the keystone. It does
not speak.
- Phase 1, the needle: **Noon Strike!** its point comes down where the cursor is heading (a still shield, 3 taps);
  **Brass Face!** 3 yellows turn to mirages.
- Phase 2 (66%, gate, scene `noonBoss2`), edit one, "Too bright to see?" (**Glare!**): every yellow blazes, and every
  2nd one it sends; **Noon Strike!** and **Sun Lance!** (two reds).
- Phase 3 (33%, gate, scene `noonBoss3`), edit two, "Closer, then." (**Sun Drawn Down!**): every yellow a mirage, the
  blaze rule stays, the cursor never drops below 1.3x; **Sun Lance!** and **Heatwave!** (every yellow a mirage, 3
  blaze).

### Story
The story team's ids above, and the mini-bosses' intros, all written in `src/data/story-noon.ts`
(`story-noon-minis.ts` is empty now), and a camp scene, `noonCamp` (after Act 1: no night to sleep in, and Pip
apart; wire it like `duskCamp` in `run.ts` `campScene`/`sableJoined` at `actsCleared >= 13`, and mark it seen in
`core/lab.ts` like `duskCamp`). `sphinx`: the Noon Sphinx keeps the White Road with a riddle (long at dawn, gone
at noon: a shadow); Rowan answers, but a traveler with no shadow is a mirage to her (she speaks: speaker `sphinx`,
plate "Noon Sphinx", portrait `portrait_sphinx` needed). `brassLion`: the Dawn Order's lion that roared the sun up
every morning, a month without one (it doesn't speak). The hints follow the rules as built: `sphinx` "strike where the
shimmer lands"; `noonBoss2` (the glare) "the blazing ones hit hard, and they burn; a green cools you off";
`noonBoss3` (the sun drawn down) "watch the outlines: that's where they'll land".

### Gear (`src/data/gear-noon.ts`; effects in the core, the items in the tables once the region is on)
Bases: Dial Spear, Sunsteel Saber, Spire Hammer (weapons); Veil Hood, Brass Visor (helms); Dust Mail, Sunplate (armor);
Dune Striders, Stair Treads (boots); Noon Pearl, Haze Glass (trinkets). Set: **Wayfarer's** (Sun Hat, Linen Robe,
Sandals, Water Skin): 2-piece +20% damage on blazing blocks; 4-piece a green cools the Heat and heals 2% HP. Signature
Legendaries (the Gnomon): **Sunstone** (trinket, *Cool Head*: the Heat burns half as fast), **Gnomon's Hand** (weapon,
*True Hour*: a mirage hit within 1 s of its hop deals x3: `Block.hoppedAt`). As built: `tuning.effects.wayBlaze`,
`wayHeal`, `sunstone`, `trueHour`, `trueHourSec` (sliders); the effect and set ids are in gear.ts's unions.

### Relics (`src/data/relics-noon.ts`; hooks `core/relic-fx-noon.ts` in RELIC_HOOKS; with/without tests `relics-noon.test.ts`)
Mirage: **Oasis Map** (hits on mirages +40%), **Haze Lens** (rare: a mirage hit right after its hop crits), **Sand
Glass** (mirages hop 30% less often), **Ghost Step** (rare: a mirage hit fills the meter like 2 hits), **Sand Dollar**
(a coin a mirage hit), **Dust Devil** (rare: a mirage hit counts 2 extra combo), **Fata Morgana** (epic: mirages hop
twice as often; hits on them x3). Heat: **Sunshade** (the Heat burns 30% slower), **Cool Spring** (a green that cools
you heals 3 HP), **Kindling** (rare: blazing hits fill 50% more meter), **Sun Shard** (rare: at full Heat every hit
crits), **Sun Purse** (a coin a blazing hit), **Shade Tree** (rare: blocking a red cools 1 Heat), **Noonday** (epic: the
Heat never burns; blazing hits deal x1.2 only). Builds: Wayfinder (Mirage), Sunborn (Heat), High Noon (Mirage +
Heat), Haze Hunter (Mirage + Crit), Sunstruck (Heat + Risk). New hook points (core/hooks.ts): `mirageEvery`,
`heatDps`, `cooled` (green / out / perk); `Block.hoppedAt`; `Combat.easeHeat(n)`. In RELICS (offered from act 12) only
once the region is on; the cautious bot's `avoid` list should take Fata Morgana and Noonday then.

### Wired behind a switch (round 8, team content chunk 3)
`src/data/flags.ts` `NOON_ON`: off in the game and the unit tests; `CQ3_REGION5=1` in the environment turns it on for
the balance tools (`CQ3_REGION5=1 REGION=4 npm run region-tune`). On: NOONSPIRE in REGIONS (acts 12-14), its scenes and
mini-boss scenes in STORY (off, they stay out: a scene in STORY lets the camp lines waiting for it show), its relics in
RELICS, its bases, set and signatures in the tables, `WORLD_ACTS_NOON` (three placeholder spots on the floating island,
art-world-lands.ts), `REGION_SITES.noonspire`. Always: its foes in ENEMIES (the Test lab's previews, labelled "Act 13
foes" etc. with an "early look" line, at Act 12's numbers with the region's bar rules), the relic hooks, the gear effects, `noonCamp`
(run.ts `campScene` at `actsCleared >= 13` once it's in STORY; the lab marks it seen), stand-in fight sprites
(`SPRITE_STAND_IN`: skink -> cinderling, hawk -> cinder kite, dune bandit -> bandit, colossus -> golem, sphinx ->
rimehorn, scarab -> beetle, brass sentry -> frost knight, salamander -> magma eel, sunforged golem -> kiln warden, brass
lion -> Hob & Nob, dial warden -> knight, heat djinn -> ice wraith, sun vulture -> crow, noon knight -> chain sentinel,
the Gnomon -> Glacia) and themes (`NOON_STAND_IN`: pass, ruins, cinder). To turn it on: set `NOON_ON = true` once its
art exists; then the region tests, the masher guard and a `bot-region5.test.ts` guard cover it.

**Balance, first pass** (`CQ3_REGION5=1 REGION=4 npm run region-tune`, Rowan, 52 end-of-Duskmire profiles at 75%;
targets a little harder than Region 4: Act 13 ~80%, Act 14 ~65%, Act 15 ~50%, the Gnomon's first fight ~45-55%). The
first guesses were far too easy (98 / 94 / 67%, fights 9 s): the hero arrives at level 22. As set: hpMult 10.5 / 11 /
12, atkMult 24 / 28 / 30 (red speeds as before, 1.32 / 1.44 / 1.44); the Sphinx 7300 HP atk 29, the Brass Lion 7000 /
28, the Gnomon 8000 / 22. Measured either side (the last two configs): Act 13 85 / 73%, Act 14 56 / 63%, Act 15 35 /
43%, fights 10 / 15 / 17 s, mini-boss fights 93-100 / 70 s, the Gnomon 70 s; the numbers set sit between them. Still to
do once it's on: a 100-run pass, a `bot-region5.test.ts` guard, the masher (its row comes free in bot-masher), hero
parity.

**For the art and music helper** (keys as the data names them): foe sprites `duneskink`, `glarehawk`, `dunebandit`,
`dunecolossus` (elite), `sphinx` (mini-boss), `emberscarab`, `brasssentry`, `sandsalamander`, `sunforgedgolem` (elite),
`brasslion` (mini-boss), `dialwarden`, `heatdjinn`, `sunvulture`, `noonknight` (elite), `gnomon` (boss: phase looks
`gnomon2_*`, `gnomon3_*`); map minis exist (art-minis.ts). Speakers: `sphinx` (`portrait_sphinx`; the brass lion and the
Gnomon don't speak). Themes for the `Theme` union: `whiteRoad`, `spireSteps`, `sundial` (backdrops, stage lights, map
kits, lairs, critters; then point `NOON_STAND_IN` at them). Music cues (app.ts): `ACT_THEMES` for global acts 12-14,
`ACT_AMBIENCE` 12-14, `BOSS_THEMES` for `sphinx`, `brassLion`, `gnomon` (`gnomon` in `PHASED_BOSSES`); telegraph sounds
`NOON_NEW_SOUNDS` (skitter, shimmer2, sunflash, scorch, roar, needle, glare, heatwave) into `TellSound`. Also: 14
relic icons and the gear's item icons, the region card's parchment map (art-region-map.ts, a fog sheet until then),
and the island's three landmarks (move `WORLD_ACTS_NOON` with them).

### Music and art (as built)
Music (`music.ts`, tracks `noon1`-`noon3`, `sphinx`, `brassLion`, `gnomon`):

| Track | Key | BPM | Meter | Calm | Fight |
|---|---|---|---|---|---|
| `noon1` The White Road | D Hijaz | 126 | 7/8 (2+2+3) | duduk over a hurdy-gurdy drone, santur on the pulses, frame drum, shaker | goblet drum, santur in 16ths, kit, bass; lead: thin square |
| `noon2` The Spire Steps | F Lydian | 98 | 6/8 | muted horns on the chords, harp, timpani into each phrase | the Dawn Order's fanfare: trombone stabs, snare and timpani, tuba; lead: open trumpet |
| `noon3` The Great Sundial | F# Phrygian | 136 | 4/4 | tick-tock on the 8ths, music-box ostinato, low organ, celesta tune | ticks in 16ths, organ, timpani, kit, 8th bass; lead: hard saw |
| `sphinx` (Act 13 mini-boss) | A Hijaz | 144 | 4/4 | | santur ostinato, duduk riddle, goblet drum; phase 2: brass stabs on the offbeats, a choir |
| `brassLion` (Act 14 mini-boss) | Bb Mixolydian | 172 | 4/4 | | low brass riffs in octaves, timpani, snare, trumpet; phase 2: brass every beat, timpani rolls |
| `gnomon` (boss) | G# minor (phase 3: A# minor) | 158 | 4/4 | | clockwork ticks, low brass ostinato, timpani, horns; phase 2: kit, choir, celesta; phase 3: up a whole tone, double-time drums, distorted bass, the lead |

Ambience beds (`audio.ts`): `dunes` (a hot wind, sand hissing, cicadas), `spire` (wind whistling round the towers,
chains, a far hammer), `dial` (the dial's hum, a clock ticking, far rumbles).

Art: the pack `pack-noon.ts` (`art-noon.ts`: every foe, `sphinx2`, `brasslion2`, `gnomon2`/`gnomon3`, `portrait_sphinx`;
`backdrop-noon.ts`: the white road, the spire steps, the great dial), the stage light and air, the act maps' land, kit,
lairs (the sphinx on her plinth by the road, the lion-headed gate, the gnomon on its dial) and critters in the shared files (decisions C-ART-7).

### Still to design and build (next chunks)
Telegraph sounds (`NOON_NEW_SOUNDS`), the music and ambience cues in app.ts (`ACT_AMBIENCE` 12-14: `dunes`, `spire`,
`dial`), and balance (a little harder than Lanternfen: Act 1 ~80%, Act 2 ~65%, Act 3 ~50%, the Gnomon's
first fight ~45-55%).
