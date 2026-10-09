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

## Still to do (not ours, or next)

- The story before the first fight: 11 boxes, 24 s, 11 taps (story team: at most 4 boxes).
- The first relic pick is dense for minute 1 (three cards, tags, a RARE badge). A first pick of plain stat cards, or
  two cards, would read faster.
- The hero chest (the gacha reveal) first comes after the Act 1 boss (about 10 minutes in for a newcomer) and opens at
  camp; a first hero chest within the first 10 minutes would show off the chest reveal early.
- Two relic picks within 20 s around the first chest (the first fight's, then the chest's rare one).
- Each new hero's first finisher could get the same reveal (Sable's, a chest hero's): one mark per hero.
