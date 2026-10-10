# The first 10 minutes

What a newcomer meets from New game to the first chest, measured by a bot that plays like a person
(`tests/smoke/first10.spec.ts`): a wiped profile, tips on, the world map's first-visit glide. It taps a story box
every ~2 s, reads each tip for ~2.5 s before tapping it away, looks at the map for ~1.6 s before choosing (a chest when
one is offered, else a fight, never an elite), and plays the fights at **70% accuracy** with a newcomer's reaction time
(0.38 s to notice a block, 0.27 s for a red; core/bot.ts's aim model). It swipes a finisher only once the game has
taught it (the finisher's tip). Each beat is timed (wall time since New game, the fights' own clock, taps so far) and
screenshotted.

    PORT=4178 F10_OUT=/some/dir F10_SEED=7 npx playwright test tests/smoke/first10.spec.ts   # ~2-6 min
    npx vitest run --config vitest.balance.config.ts tests/balance/first-chest.run.ts --silent=false   # chest odds

`F10_SEED` fixes the run (the act map, the fights' and loot's rolls); `F10_ACC` the newcomer's accuracy.

## Measured: before (the run branch at `99044a2`)

Three seeds. Seeds 7 and 11 happen to offer a chest early (row 2 and row 1); seed 9 is a typical unlucky map (its
first chest in reach is in row 6).

| Beat | seed 7 | seed 11 | seed 9 | what the newcomer sees |
| --- | --- | --- | --- | --- |
| New game (title tap) | 0:00 | 0:00 | 0:00 | "Tap to start!" |
| World map | 0:01 | 0:00 | 0:00 | the glide in (<2 s), "Greenmarch: Tap to begin!" over Rowan |
| Intro story | 0:04 | 0:03 | 0:03 | 6 narrator/Rowan boxes, then Pip's 5 (11 boxes, 11 taps) |
| First act map | 0:28 | 0:27 | 0:27 | the map tip; three fights to pick from |
| First fight on screen | 0:34 | 0:32 | 0:32 | "tap yellow" before TAP TO BEGIN |
| First hit | 0:39 | 0:37 | 0:37 | |
| First finisher | 1:02 | 1:00 | 0:59 | a 1-stack show over in ~0.5 s, its name a small floater |
| First win | 1:14 | 1:12 | 1:17 | 23 s of fight clock; 5 lesson tips in it |
| First chest | 2:14 | 1:22 | **4:36** (after 4 fights, a bounty board, a rest and a shop) | "Treasure! Tap the chest" |
| Map after the chest | 2:23 | 1:33 | 4:43 | |
| Taps to the chest | 127 | 65 | 344 | (bar taps included) |
| Tips before the chest | 13 | 9 | 18 | |

**The first chest over 2,000 Act 1 maps** (a newcomer who takes every chest offered, else a fight): reached in row 1
(right after the first fight) 22%, row 2 16%, row 3 12.5%, row 4 10.5%, row 5 9%, row 6 6%, and **no chest at all in
Act 1 in 24%** (the next is the act clear's, after the boss, 10+ minutes in). Each row costs a newcomer 40-60 s (the
fight, its loot and relic pick, the map), so the first chest comes at 1:20 to 6:00, or not at all.

### What a newcomer sees, beat by beat (before)

- **Title, world map (0:00-0:04).** One tap starts; the world map glides in and Rowan's plate says "Tap to begin!".
  Clear. Costs ~4 s and one tap.
- **The story (0:04-0:28): 24 s and 11 taps before anything is played** (6 intro boxes, then Pip's 5). This is the
  biggest wall before the first fight. The story team's rewrite caps it at 4 boxes (about 9 s).
- **The first map (0:28).** One tip ("Pick a path to the boss. Icons show what's there."), "Tap a glowing spot" at
  the foot, three fights to choose from. Busy (three "3 | Gear" plates, packs' red prints, the captain's banner) but it
  reads in one look.
- **The first fight (0:34-1:14).** "Tap yellow" before TAP TO BEGIN, then red, green, purple and the full meter, each
  a ~2.5 s pause. Good pace: first hit 5 s after the fight appears. **The first finisher is a non-event:** the meter is
  filled for the lesson, the swipe gives a one-stack show that's over in about half a second (one slash, a "51"), the
  name "Whirlwind!" is a small floater, and the boar charges straight after.
- **After the first win (1:14-1:28).** "Level up! Lv 2" and the loot, then **"Pick a Relic": three dense cards with
  tags (Green, Sustain, Pip, Block, RARE) and its tip**. Then the map again, and **the packs' tip** ("Red prints: a
  pack's next step...").
- **The second fight (1:28-2:05)** opens with **the relic belt's tip**, then the special's; after it **Synergy!** on
  the next pick, then on the map **"Level up! You got a skill point. Spend it in Skills at camp."**: four systems in
  under a minute that a newcomer can't use yet, between them and their first chest.
- **The chest (seed 7: 2:14; seed 9: 4:36).** "Treasure! Tap the chest", coins burst, the loot, a rare pick. On
  seed 9 the newcomer met 18 tips first (the bounty board's, the secret's, the elite's, the rest's, the shop's...).

## Changes (Team 5, round 8; docs/decisions.md F1-F6)

1. **Act 1 always offers a chest right after the first fight** (F1). `ActDef.chestRow` (Act 1: row 1): every first-row
   fight links to a chest in row 1, as few chests as that takes (one in ~45% of maps, the whole row of two in ~30%),
   never a chest straight after it. Chests per Act 1 map: about 2.5.
2. **The quiet start** (F2): a new player meets the packs' tip, the relic belt's, Synergy!, the skill point's and the
   first sparkle's only after 3 fights won (`TipDef.wins`, counted from the fights' `won` events into
   `profile.counts.wins`); a player who has cleared an act gets them as before.
3. **The first finisher is a moment** (F3): the first finisher in the game holds the fight's clock for 1.5 s
   (`App.holdUntil`): letterbox bars, the stage darkens, light gathers on Rowan, "FINISHER" and then
   **WHIRLWIND** stamp in big with what it does ("Hits all, clears reds."), then the usual show plays
   (`view/finisher-reveal.ts`; once per profile, `finisherReveal` in `profile.seen`; only with tips on, so the specs,
   which run with tips off, never meet it unasked).
4. **Test lab: "The first fight"** (F4): Rowan against Act 1's first foes with the five lessons and the reveal unseen.
5. **The spec guards it**: the first chest within 3 minutes of New game, the first finisher revealed (the clock held,
   its name up), and none of the quiet start's tips before the chest.

## Measured: after

The same three seeds, same bot, after F1-F3 (the first finisher's reveal adds 1.5 s to every beat after it).

| Beat | seed 7 | seed 11 | seed 9 |
| --- | --- | --- | --- |
| First act map | 0:27 | 0:27 | 0:28 |
| First fight on screen | 0:32 | 0:32 | 0:34 |
| First hit | 0:36 | 0:37 | 0:39 |
| First finisher (now named, 1.5 s held) | 0:59 | 1:00 | 1:02 |
| First win | 1:15 | 1:16 | 1:22 |
| **First chest** | **1:27** (was 2:14) | **1:24** (was 1:22) | **1:30** (was 4:36) |
| Map after the chest | 1:37 | 1:35 | 1:41 |
| Taps to the chest | 73 (was 127) | 69 (was 65) | 76 (was 344) |
| Tips before the chest | 7 (was 12) | 6 (was 7) | 6 (was 18) |

A struggling newcomer (`F10_ACC=0.55`, seed 7) wins the first fight too: first finisher 1:03, first win 1:21, first
chest 1:34, 86 taps.

Over 2,000 Act 1 maps the first chest is now offered right after the first fight on every map (it was 22%; 24% had
none in Act 1). A newcomer who takes it opens it at about 1:25-1:30, after one fight; the first five minutes now hold
the story, the first fight with its five lessons and the named first finisher, the first chest, and a second fight.

What a newcomer sees now, where it changed:

- **The first finisher** (`after-final/` screenshots): the swipe lands, the bars close in, the stage goes dark behind
  Rowan, light rings close on him, "FINISHER" pops up, **WHIRLWIND** stamps in big with "Hits all, clears reds."
  under it; 1.5 s later the bars open and the whirlwind plays, its name again as the title.
- **After the first win:** the loot, the relic pick (one tip), and the map offers a chest straight away (the map tip
  said "Icons show what's there": the chest icon is the first one they act on). No packs' tip, no Synergy!, no skill
  point yet.
- **The chest:** "Treasure! Tap the chest", coins, the loot, a rare pick, then the map, 1:30 in.

The spec writes a screenshot of every beat to `test-results/first10/` (or `F10_OUT`) with `first10.json` (the beats,
the tips, the phase log). The before/after runs and a contact sheet of the key beats (`first10-contact.png`: seed 9
before, seed 7 after) are in the run's scratch folder (team-first10/).

## Round 8, part 2: the story's road scene, a finisher that finishes, on to the first hero chest (F7-F13)

What changed (docs/decisions.md F7-F13):

1. **Pip's road scene** (the story team's: who Pip is, what the blank is) plays after a new player's first win, after
   its loot, before the map; on Act 1's first playthrough, once per profile. "Follow it." leads onto the map and its
   promised chest. The welcome back's id is `welcomeR8` (returning players meet the new story's welcome once).
2. **The first win has no pick of its own** (`CORE:` run.ts): the chest right after it has one. Minute one had two relic
   picks half a minute apart around a story scene; now the chest's pick is the first relic a newcomer meets.
3. **The first finisher finishes.** The reveal named WHIRLWIND, then the boar stood there at 89 of 150 (seed 7). The
   finisher's lesson now waits for the foe in front to be low enough to fall to the blow (at most 15 s).
4. **The quiet start ends one tip per fight won** (it ended in a burst of five tips over four screens before the boss).
5. **The act clear points at the hero chest:** Camp glows gold with a count bubble when a chest waits; its gains column
   no longer runs under the headline.
6. **The first hero chest is always someone new** (`CORE:` chests.ts): it was Sable's shards, a minute after Sable
   joined in the story.
7. **The spec plays on**: `F10_UNTIL=act` taps Camp at the act clear, reads Sable's scene, opens the vault and the hero
   chest; it times the first red's spawn and the boss's arc (its first special, half and a fifth of its HP).

### Measured (the same bot, 70%; seeds 7, 9, 11)

| Beat | seed 7 | seed 9 | seed 11 | before (part 1, s7 / s9 / s11) |
| --- | --- | --- | --- | --- |
| First act map | 0:15 | 0:14 | 0:14 | 0:27 / 0:28 / 0:27 (the story was 11 boxes, now 4) |
| **First fight on screen** | **0:22** | **0:19** | **0:20** | 0:32 / 0:34 / 0:32 |
| TAP TO BEGIN (after "tap yellow") | 0:26 | 0:23 | 0:24 | |
| First red: its tip at once | 0:27 | 0:25 | 0:25 | |
| First finisher (named, held 1.5 s) | 0:57 | 0:56 | 0:48 | 0:59 / 1:02 / 1:00 |
| ...and it kills the foe in front | yes | yes | yes | seed 7: no (the boar at 89 of 150) |
| First win | 1:10 | 1:11 | 1:11 | 1:15 / 1:22 / 1:16 |
| Road scene (6 boxes) | 1:14-1:28 | 1:13-1:26 | 1:13-1:26 | (new) |
| **First chest** | **1:31** | **1:29** | **1:29** | 1:27 / 1:30 / 1:24 |
| First relic pick (the chest's) | 1:38 | 1:33 | 1:32 | seed 7: 1:04 (the fight's) |
| Map after the chest | 1:43 | 1:39 | 1:38 | 1:37 / 1:41 / 1:35 |
| Taps / tips before the chest | 77 / 6 | 84 / 6 | 81 / 6 | 73 / 7, 76 / 6, 69 / 6 |
| Act 1's boss (Bandit Captain) | lost at 18% of its HP | won at 5:34 | | |
| Act clear, then Camp | | 5:40, 5:47 | | |
| **First hero chest revealed** | | **6:12** (Tam, new) | | Sable's shards (part 2's first run) |

Title to the first fight is about 20 s for a newcomer who reads every box and tip (the brief: under 45 s), and
nothing on the way waits on reading: four story boxes (a tap each, Skip on screen), the world map's glide (a tap skips
it), one map tip and "tap yellow" before TAP TO BEGIN. The road scene puts ~14 s of story between the first win and
the first chest (the chest still comes at 1:30, the first pick it gained back).

The newcomer bot lost the Bandit Captain on seed 7 (the one path through Act 1 with only three fights and two rests).
The balance bot does not see it: Act 1 first try at 62% / 70% / 75% accuracy with a newcomer's reaction time (0.38 s)
is 98% / 99% / 100% (300 runs each), and 91% / 99.5% at 62% / 70% never wearing found gear; with or without the first
fight's pick the rates are the same within noise. The spec's player is cruder than the balance bot (it never wears
gear or spends skill points, and aims at whatever comes next), so take its boss result as "close", not as a wall.

### A picky newcomer, beat by beat (part 2; screenshots in the run's scratch folder, `team-first10/r2/b3-s9/`)

- **Title** (`01-title.png`): the new logo, "Tap to start!", and three hints along the foot (yellow, red, purple).
  Clear.
- **World map** (`03-worldMap.png`): the glide from the far east reads well; the header plate says "Weights home:
  0/12" in the first second: jargon for a newcomer (and is "weights" still the story's word?).
- **Story** (`04-intro.png`): three narrator boxes and Pip's one; quick.
- **First map** (`06-tip-map.png`, `07-firstChoice.png`): one tip, three "3 | Gear" tags, the bounty board's "!",
  the packs, the captain's banner. It reads in one look because the glowing spots are the only bright things; the
  three identical tags add little on the first step.
- **First fight** (`09`-`19`): five lessons, each at its moment; the first red's tip comes the instant it spawns.
- **First finisher** (`20`-`26`): the tip, the swipe, the letterbox and WHIRLWIND, then the whirlwind and the foe
  goes down: the payoff the reveal promises.
- **After the first win**: the loot (when one drops), the road scene (six boxes: the longest stretch of reading in
  the first five minutes), then the map and the chest.
- **The chest** (`30`-`34`): "Treasure!", the loot, then the first relic pick with its tip. Three cards with tags and
  a RARE badge are still dense for a first pick.
- **Act 1 to the boss**: fights, an event, a rest, the shop; the quiet start's tips now one per win (the packs after
  the third win, Synergy! after the fourth, the skill point at camp).
- **The Bandit Captain** (`48`-`52`): its intro scene (five boxes), then a real fight: bombs ("Boom...away!"), a call
  for help ("Lads, help!"), a newcomer down to 16 of 122 HP at half its HP. Exciting; in `49-bossSpecial.png` and
  `50-bossHalf.png` the special's shout and the damage numbers overlap at the top centre.
- **Act clear** (`55-actClearOpen.png`): one headline, the line under it, the gains on the left (no longer under the
  headline), the build card, the XP, and Camp with the chest bubble.
- **Camp** (`56`-`58`): Sable's scene (six boxes) over the camp, then the camp with "Sable joined!", the Chests plate
  glowing with its "1", the skill point's tip.
- **The first hero chest** (`59`-`62`): the vault, "Tap the chest!", the build-up, **Tam, Rare**, new.

### After the container restart: found gear goes on (F14), the merged build

The runs above showed the newcomer bot dying in Act 1 more than the balance bot predicts. Two reasons:

- **It never opens the camp, so it fought Act 1 in nothing** (every item found waited in the bag), while the balance
  bot wears the best it finds after every loot. Now an item for an empty slot goes on as it drops (F14: "Worn" in
  green on the loot screen; the loot tip says so). Worth, for a newcomer who never opens the camp (balance bot, 200
  runs, 0.38 s reaction): Act 1 first try 84.5% -> 94.5% at 55% accuracy, 91.5% -> 98% at 60%.
- **Tonight's machine is loaded** (seven teams), and the bot's in-page timers jitter: the game's own accuracy readout
  on the act-clear screen measured the "70%" newcomer at 34-67%. Read its results as a struggling player's.

| Run (build) | Readout | Act 1 | First hero chest |
| --- | --- | --- | --- |
| seed 9 (part 2) | 67% | cleared first try (boss won 5:34) | Tam, Rare, new (6:12) |
| seed 7 (part 2) | | lost the boss (it was at 18% of its HP) | |
| seed 7 (merged) | 51% | cleared first try (boss won 5:27) | Bun, Common, a new companion (6:04) |
| seed 11 (merged) | | three defeats in normal fights (rows 2-5); stopped at its two retries | |
| seed 7 (merged + F14) | 56% | a defeat in a row-2 fight and one at the boss; cleared on the third try (11:54) | Rare, new (12:25) |
| seed 9 (merged + F14) | 34% | cleared first try (boss won 6:03) | Moss, Epic, a new hero (6:42) |
The first five minutes hold in every run: first fight on screen at 0:19-0:22, the first finisher at 0:57-1:02 (the
next foe walks in behind it), the first chest at 1:24-1:36, the first relic pick (the chest's) a few seconds later.

## Round 8, part 3: the first pick in one look, the newcomer bot at camp, the trimmed story, the new art

1. **The first relic pick is two plain cards** (F16): two starter relics that share no tag (two ways to play; the
   chest's rare one among them), each with its name and what it does in plain words; no tag chips, no RARE badge, no
   stat card. Tags, rarity and Synergy! come from the second pick on. It was three dense cards in minute one (Blast
   Wave, about bombs Act 1 hasn't shown, beside Greenhouse, a trade-off).
2. **The newcomer bot spends skill points** (F17) from the first chest on, as the balance bot does after every loot.
3. **The story team trimmed** the road, captain and Sable scenes to four boxes each (intro 3 + 1 before the fight).

### Measured (the run branch at 49cd26a merged; load average 17-18 on 4 CPUs throughout, so not calmer)

| Beat | seed 7 | seed 9 | seed 11 | part 2 (s7 / s9 / s11) |
| --- | --- | --- | --- | --- |
| First fight on screen | 0:20 | 0:20 | 0:19 | 0:22 / 0:19 / 0:20 |
| First finisher (named; kills) | 2:06, second fight | 0:58 | 0:53 | 0:57 / 0:56 / 0:48 |
| First win | 1:09 | 1:04 | 1:03 | 1:10 / 1:11 / 1:11 |
| Road scene (now 4 boxes) | 1:13-1:24 | 1:06-1:15 | 1:05-1:13 | 1:14-1:28 (6 boxes) |
| **First chest** | **1:26** | **1:17** | **1:16** | 1:31 / 1:29 / 1:29 |
| First relic pick (two plain cards) | 1:33 | 1:21 | 1:20 | 1:38 / 1:33 / 1:32 (three) |
| Map after the chest | 1:38 | 1:27 | 1:26 | 1:43 / 1:39 / 1:38 |
| Skill point spent at camp | 1:49 | 1:40 | | |
| Act 1 | lost the boss once (at 19% of its HP), cleared 9:41 | cleared first try, 6:17 | (to the chest) | |
| First hero chest revealed | 10:08, Rare, new | 6:43, Rare, new | | |
| Readout accuracy at the act clear | 58% | 64% | | |

The trimmed story saves about 10 s before the first chest (now 1:16-1:26). Seed 7's first-fight finisher was lost to
the test itself: on the loaded box the bot's synthetic flick fired its moves 0.3-1.2 s late, past the swipe's 350 ms
(fixed in the spec after that run: the flick's first move now goes with the press; seeds 9 and 11 ran with the fix).
A player's own touches carry their own timestamps, so this isn't a game problem. The newcomer bot, now spending its
skill points, cleared Act 1 first try on seed 9 and lost the boss once on seed 7 (its weakest path: three fights and
two rests before the boss) at a 58-64% readout; the balance bot at 60% clears Act 1 first try 98% of the time.

### The first ten minutes on the new art (screenshots: `team-first10/r3/` phone and desk, `c1-s7/`)

What reads worse, for the art teams (the run branch at 49cd26a, phone 874x402 and desk 1440x900):

- **The crow on the darker Greenmarch** (`r3/phone-fight.png`, `c1-s7/11-firstHit.png`): a dark navy bird against
  the dark treeline at dusk; it's the first foe a newcomer meets (seed 7) and it nearly disappears. A rim light or a
  lighter belly would bring it back. The boar and the Bandit Captain read fine.
- **Two Rowans** (`r3/phone-camp.png`, `r3/phone-fight.png`): the fight shows the new, taller, darker Rowan, but the
  HUD portrait (top left of every fight and of the camp) and the camp's Rowan by the fire are still the round white
  chibi helmet.
- **Rowan himself** reads by his red plume, sword and cape; his dark steel and visor sit close to the background's
  values, so the bright blue owl beside him is now the first thing the eye finds. A touch more light on his helm
  and shoulders would make him the focus again.
- **The act map is still bright, saturated green** (`r3/phone-map.png`) between a dusky title, a dusky fight stage
  and a night camp: the only screen of the first ten minutes without the mood.
- Fine as they are: the bar's blocks (yellow, red, green, purple) keep their contrast on the darker stage; the title's
  key art and the world map ("The Great Atlas", "Regions restored") read in one look; the story box; the camp.

## Still to do (not ours, or next)

- The road scene is six boxes (~14 s) between the first win and the first chest; the captain's five and Sable's six
  are the other long reads of the first ten minutes (story team: four would keep the pace).
- The first relic pick (now the chest's) is still three dense cards with tags and a RARE badge for minute one.
- The world map's "Weights home: 0/12" in a newcomer's first second (world map / story: a word a newcomer knows).
- The boss fight's shouts and damage numbers overlap at the top centre (`b3-s9/49-bossSpecial.png`,
  `50-bossHalf.png`; the fight view's floaters).
- The newcomer bot is cruder than the balance bot (no gear, no skills): teaching it to wear what drops at camp would
  make its boss result comparable.
- Each new hero's first finisher now gets the same reveal (F15; Test lab: "Sable's 1st finisher").
