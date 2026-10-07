# Decisions log (overnight run, M5 "heroes")

The playtester was asleep; every call made without asking is logged here, newest at the bottom of each section.
Region-specific details (enemy names, bosses, plot) are in `docs/content-bible.md` (spoilers).

## Setup
1. **Branch.** `main` only has the initial commit and PR #4 (`claude/m4a-depth`) is still open, so this work is on a
   new branch `claude/m5-heroes` built on top of `claude/m4a-depth`. Its PR includes #4 and supersedes it (as #4 did
   #3): merging the new PR merges everything.

## Part 1: rarity and hero framework
2. **8 rarities, one table** (`src/data/rarity.ts`) used by gear, heroes and companions. Existing gear keeps its tiers.
   Above Mythic: Celestial gear has a second unique effect, Divine gear two effects plus an aura (a fight-wide rule).
   Celestial/Divine gear drops at tiny odds in Regions 1-3 (`tuning.gear` weights).
3. **Styles are hook sets** (`src/core/styles.ts`): each style's shared rule is a `FightHooks` object with one number in
   `tuning.styles`; heroes add their own kit hooks on top. Combat collects style, kit, stars, companions, skills and
   relics in that order.
4. **Two-cursor mode deleted**, not hidden behind a flag: every new rule (ice, holds, dashes, kegs, frozen blocks)
   would otherwise have needed a two-cursor version nobody plays. Sable keeps her art, story and name.
5. **Rowan gets the Blade rule (Edge) and a small passive (Knight's Resolve)** so every hero has the same five parts;
   both are small, and Region 1 was re-checked with the bot afterwards (see docs/balance.md).

## Part 2: heroes
6. **Rarities:** Rare: Rowan, Tam, Hollis. Epic: Sable, Moss, Torva. Legendary: Neve, Vesper. (3 / 3 / 2: the chest
   odds lean low, so the two Legendaries are the chase; Neve comes free through the story.)
7. Hero names and looks are original (content bible section 3).
8. **Each hero has their own base HP and attack share** (`tuning.kits.<id>.hp/atk`; Rowan's stay `tuning.hero`), so
   Sable's old "0.7x hits for two thumbs" became a plain one-cursor kit (110 HP, full attack).
9. **New hook points for bar modifiers**: cursor speed (`cursorMult`), patches (`zoneMult`), the left end (`atWall`),
   spawn spacing (`staticGap`), the refill (`minAttack`), widths (`blockWidth`), keg radius, and damage taken
   (`damageTaken`, for soft strengths). A finisher can now keep reds (freeze or pin them) or clear the whole bar
   (`FinisherCtx.reds`).
10. **Holds:** pressed at the near edge (up to 70 ms late; Perfect within 35 ms), done once the cursor passes the far
    edge; a release up to 60 ms early still counts; the cursor turning inside it (a wall, a mirror) counts if 80% was
    held. While a hold is held the finisher can't fire, and a press that starts a hold is never a swipe
    (`swipeAllowed`, unit-tested). A second finger can still block reds.
11. **Soft strengths are scaled by `tuning.hero.strengthScale`** (1 in play) so unit tests about other rules can turn
    them off and keep exact numbers.
12. **Shadow Dash lead:** the dash lands 0.3 s of travel before the next block (counted through patches), not right on
    it: closer felt like a guaranteed miss for a thumb (reaction time ~0.25 s).
13. Gear panel wording: "TUNING" became "OPTIONS", "Copy tuning as JSON" became "Copy game numbers", the foot says
    "Version" instead of "Build" (tech words out of player-facing text).
14. The bot test "farming raises the Boar King win rate" keeps farming above the story but its +10-point margin is
    loosened until Part 7's retune (Rowan's Blade rule made the story's boss a little easier).

## Part 6: the next region (details in docs/content-bible.md)
15. **One global act index** (`src/data/regions.ts`): Greenmarch is acts 0-2, the next region 3-5. Item levels, XP,
    the replay kit and coins keep growing act by act; `profile.actsCleared` counts across regions (a pre-v4 profile is
    capped at 3). The run walks `CAMPAIGN` (every region's acts), and a region's last act ends in its own victory
    scene (its weight comes home: `weights` = regions cleared).
16. **A region starts a fresh run:** entering its first act gives the replay kit for every act behind (an end-of-
    Region-1 hero) but relic picks only for acts behind *within the region* (none at a region's first act).
17. Map packs ramp within each region (its first act has the fewest), not across the whole kingdom.
18. The Ice and Hold relics (`from: 3`) are only offered in the region that has ice and holds; eight of them unlock
    through heroes' mastery milestones, the rest through the region's act clears and elites, two from the start there.
19. Region bosses get at most two moves per phase (the boss test now counts per phase); the boss's opening ice wings
    are laid once per phase even though their timer comes round again.
20. The act picker on the world map and the gear panel's "Jump to" show only Greenmarch's names until the world map's
    new landmarks are in (the next region's acts are listed by number only: spoilers).

## The fight view (rendering only)
- **Allies stand in a front row at the hero's feet** (Thornling, Barkback, Seedling left of the hero, lower on the
  ground), the **Glowmoth hovers by the hero's shoulder**; companions keep Pip's place behind (a second one 24 px
  further back; fliers hover, walkers stand). With three allies and two companions it's busy but nothing hides the hero.
- **The allies' frequent perks don't name themselves** in the lane (Thornling, Glowmoth, Seedling, Rally): they show on
  the allies (act frames, a bolt from the ally, "Rally!" over them). A Barkback's block still names itself once.
- **Telegraphs preview what a special does to the bar** (patches with a fixed spot, a mirror's spot, the yellows it will
  ice or turn into holds); an icicle's spot shows once it's chosen (the `mark` event), not during the wind-up.
- **A huge foe's special name and stun label stay below the HUD's plates** (y >= 38) and its countdown ring flattens
  instead of climbing into the HUD; the region's boss stands where every single foe stands (its top clears the plates).
- **Heals show as whole HP** in the merged heal number (HP is fractional inside: a top-up could print a long decimal).
- **Chilled reds read by who slowed them:** frost (Bend, Flurry), vines (Moss), an arrow through it (Vesper's pin);
  a frozen block is a crystal (Neve), never a red.

## Part 7: balance
21. The world map now shows the second region once Greenmarch is won (decision 20's limit lifted there): its act
    picker lists one region's acts at a time; the seven far lands stay fogged and nameless. The gear panel's
    "Jump to" still hides later regions' foes (spoilers); the Test lab covers them instead.
22. **The bot lets go of a hold like a person:** aimed at the moment the cursor leaves the far end, 25 ms late on
    average, with 1.2x its tap spread (releases are less precise than presses), and an early lift on half its lapse
    rate. Letting go more than 60 ms early drops the hold, so an 85% player drops about 1 hold in 15. Its thumb is
    busy while it holds (it doesn't tap other blocks).
23. **Region 2 is balanced from a typical end-of-Region-1 hero:** each balance run plays Greenmarch from a fresh
    profile, then visits camp the way a person would (buys every Rare chest its gems pay for, opens every chest,
    buys the camp upgrades it can afford, brings its rarest companions) and starts the next region's fresh run.
    `npm run campaign` reports it per hero; `npm run region-tune` replays one region from cached heroes to tune fast.
24. **Bar-changing finishers, which work best** (judged from the bot's fights and the fight screens):
    - Best: **Neve's Glacier** (every red freezes in place and a slow patch opens mid-bar: the bar visibly changes
      and the next few seconds are a calm, readable window) and **Tam's Big Bang** (it leaves kegs on the bar, so
      the swipe turns into new things to tap with no new input).
    - Good: **Torva's Earthsplitter** (clears the whole bar and holds reds back a moment: a clean breather) and
      **Vesper's Volley** (pins every red; strong, but it reads like a pause more than a change).
    - Weakest: **Hollis's Rampart** (reds bounce off the left end for 3 s: easy to miss what happened) and
      **Moss's Overgrowth** vines (they only slow the next reds). Both kept; if a later pass reworks one, give it a
      visible mark on the bar like Glacier's patch.
25. **Rowan's branches: none clearly the safest.** Measured per forced branch (the bot goes down one branch first),
    same seeds, 100 runs each, both regions; the changes and numbers are in docs/balance.md.
26. **A Rare chest costs 240 gems** (was 180): a story run earns about 240-300 gems in Greenmarch (achievements
    included) and 200-245 in the next region, so the shrine gives about one Rare chest per region.
27. Hero parity took four passes (Region 1 gaps to Rowan at first: Moss +20 and Hollis +12 in Act 3, Vesper -13 in
    Act 2; the second region's first numbers had Moss +21, Hollis +16, Vesper -22). Final: 40 of 42 hero-acts within
    +/-10 of Rowan; Sable (+12) and Torva (+15) still lead in the second region's Act 2, where Rowan has no edge on
    its mini-boss. The table and every change are in docs/balance.md.
29. Greenmarch after the hero rework: the Boar King's HP 4600 -> 4800 (the playtester's first fight was creeping
    past 80%); the 70% player still clears Act 3 within 6 tries more than 80% of the time (guard restored); farming
    the Boar King now adds 7-10 points (it was +10 before), so its guard asks for +5 at 60 runs.
28. **Style calls on the bounty board:** once you own two or more heroes, about a third of boards post "Win 2 fights
    as a <style> hero" for one of the styles you own (heroes can be switched at camp mid-act). It pays a relic pick
    like the other relic bounties. With one hero, boards never ask for a style.
30. **Test lab:** about 12 minutes of non-spoiler scenarios (22 items; the 30-second minimum per scenario made 10
    minutes impossible with everything new covered). "Completion: 100%" sits behind the spoiler switch, because a
    region at 100% shows the next region's name on the progress screen.
31. **Rowan gets a second soft strength: +15% damage to frost foes** (the second region's foes mostly carry that tag,
    Greenmarch's none, so Region 1 is unchanged). Without it Rowan, the hero the region is tuned on, ran 10-20 points
    behind every other hero there; with it his region numbers sit on target.
32. **First-time tips for everything new on the bar** (holds, ice, snow, mirrors, iced yellows, kegs, frozen blocks,
    and the third region's two rules) and for chests, the shrine and companions: one short tip, shown once, like the
    rest.

## Part 9: the third region (spoilers: the calls themselves are in docs/content-bible.md section 6, "Build calls")
33. Its two bar rules: how they look, their numbers, and what a miss costs.
34. How the two rules combine in this build (simpler than the design allows; a later pass can add the rest).
35. One relic renamed (its first name clashed with a hero's skill).
36. One story call the planning chat may want to confirm.
37. Its relics unlock by its act clears and elites only (no mastery milestones for it yet); 4 from the start.

## Playtest round 5 (the Test lab report on version 90968f6: 8 of 22 rated, 2 good, 6 needs work)
38. **"More enemies in earlier acts" read as more foes per fight in the first region.** Greenmarch's fights now come
    in more waves (Act 1: 3 in the first row up to 5 before the boss, was 2-4; Act 2: 4-6, was 3-5; Act 3: 4-7, was
    3-6); each foe is as tough as before, so fights run longer (85% player: 20 / 24 / 26 s, were 15 / 21 / 22). The
    extra waves made Act 2 harder for Rowan than for the others (he lost most at its mini-boss, reached with less HP),
    so the Ruin Golem has 2100 HP (was 2300): Act 2 is back to about 87% first try. The later regions are
    unchanged (the note named the earlier acts). If it meant something else (earlier foes coming back later in the
    story, or replays of cleared acts getting bigger), say so: each is a data change.
39. **Each hero's how-to card** before their first fight (a pre-fight tip, two lines: what the kit does and what to
    do; Rowan's is the basics). The Test lab shows it before each hero's fight.
40. **What heroes and companions do shows on the bar** (where the eyes are): a short word pops above the bar where
    it happened (Dash!, Freeze!, Guard 3, Rock!...), the style's store (Chain, Guard, Focus, Unstoppable, allies) has
    a small readout by the bar, and armed perks (a Barkback braced, Brick's rock ready, Torva's smash primed,
    Sprocket's wider Perfect) are marked on the bar before they act. Words only for heroes' kits, styles, allies and
    companions; relics and skill nodes keep the name lane (they weren't the complaint).
41. **Moss: more greens.** A Summoner's every 5th yellow comes as a green (`tuning.styles.callEvery`; about twice
    the greens), so allies are called and come and go often enough to notice; allies stay 6 s (was 8). To keep him
    level with Rowan: a Rally no longer re-braces a Barkback that just took a red (one red per rest), and his numbers
    are smaller (HP 95, attack share 0.62, Thornling 0.22, a Barkback rests 8 s, a Glowmoth heals 0.4%, Deep Roots +4%,
    Overgrowth +10% per ally). His allies' steady damage loses nothing at a boss's phase gates, so he still runs
    ahead at the bosses (docs/balance-heroes.md).
42. **Torva: foes hurt her again.** Quake pushes reds back about half as far (0.08 of the bar, was 0.15), Wind-Up
    stuns 1 s (was 1.5), Earthsplitter's calm is 1.2 s (was 2). Her real cushion was the Brute's wide yellows (fewer
    misses, and misses are most of the HP an 85% player loses): yellows are x1.15 wide for a Brute (was x1.3), her
    attack share 0.86 (was 0.9). Trimming her HP or Unstoppable moved the bot's numbers by less than the noise.
43. **Vesper: a Power Shot no longer wastes Focus.** What the foe didn't need (it had less HP left, or a boss's phase
    gate stopped the blow) stays stored (Marksman rule: "a green fires it (none wasted)"). With more, smaller foes per
    fight and the bosses' gates, a big stored shot lost much of itself; she had fallen 13-20 points behind Rowan in
    each region's last act. Also HP 115 (was 110), attack share 1.13 (was 1.1). Greenmarch and the second region's
    first two acts are level now; that region's last act is still about 20 points behind, and no number tried moved
    it (a known gap: docs/balance-heroes.md lists what was ruled out).
44. **Test lab, round 5:** the New section is this round's changes (the seven heroes and four companion pairs,
    reworked, and two fights with the first region's new wave counts); M5's other items moved to Earlier (still
    playable). Hero fights are six waves at Act 2's numbers, the last with an elite (an 85% bot takes 26-42 s and
    nearly always wins; at Act 3's numbers a fresh lab hero, Rowan included, lost half of them); companion fights
    four waves. A reworked item asks for a new rating: a rating given to its old version shows as "Reworked" in
    the list and as "before: ..." in the report.

## Overnight polish run (playtest round 6)
45. **Act 2's foes have more HP:** the act's HP x1.7 (was x1.4: each foe about +21%). To keep its fights about as
    long as before (and under Act 3's: "normal fights don't get shorter act over act"), its first map rows deal one
    wave fewer (3 to 6 waves, was 4 to 6; the last rows and the lab's six-wave fight are unchanged). The Ruin Golem's
    base HP 2100 -> 1900 (with the act's x1.7 it has 10% more than before, so its fight stays the act's longest).
    85% bot (the guard's seeds): Act 2 first try 81% (target 80-90%), its fights 25 s, Act 3 untouched (26 s).
46. **Neve's meter fills slower:** shattered ice now fills half a hit's meter (Cold Snap: `kits.neve.iceMeter` 0.5;
    it used to fill a green's, 1.5 hits' worth), and Glacier no longer turns the reds into ice. Most of the "too fast"
    was right after a Glacier: every red it caught came back as ice worth a green each, so the next stack was nearly
    banked at once. The bot's taps per full meter (Greenmarch, 40 runs): Neve 7.3 against Rowan 7.5; with the ice still
    worth a green's it was 7.1, and lower again while Glacier made ice (her Chill and Bend give her more Perfects, so
    she stays a touch quicker; her meter-gain node is the rest). The Controller rule (Bend) doesn't touch the meter and
    is unchanged.
47. **Glacier freezes every red solid where it is** (they stay reds: blocking one still counts) for 2.5 s
    (`glacierSec`), including one waiting at the left end and an icicle on its fuse; then they thaw and carry on. It
    also **slows the whole bar for 1.5 s** (`glacierBarSec`: the two ends get slow patches of their own), then the
    middle patch for the rest of its 4 s. Permafrost (5 stars) keeps the whole bar slow for the 4 s.
48. **Big Freeze** replaces Shatterburst in Neve's Frost branch (rule node): Glacier turns every red into ice to smash
    (Flash Freeze's frozen blocks: x2 damage, half a hit's meter). Shatterburst's area hit went: the branch is about
    making ice, Brittle and Ice Age already reward smashing it.
49. **Turnabout** replaces Stockpile in Tam's Kegs branch (rule node): Big Bang turns every red on the bar into one of
    her kegs where it was (hit it: it blasts every foe). Stockpile's one keg per wave was the weakest keg-supply node.
    (Tam is "she" in the data: "Lost her eyebrows".)
50. **Torva's smash scales with the combo:** Wind-Up's next hit deals x(1.8 + 0.04 per combo), up to x4
    (`kits.torva.windUpBase/windUpStep/windUpMax`; was a flat x2.5): x2.2 at 10 combo, x2.6 at 20, x3 at 30. It still
    stuns. The view can show the multiplier while armed (`windUpMult(c)`) and when it lands (the perk's amount x100).
51. **Vesper's crits on a busy bar:** a Marksman's greens are her targets: they come x1.35 wide
    (`styles.targetWidth`) and carry `Block.target` for the view to draw; and at full Focus with no green on the bar,
    her next Perfect hit fires the shot (a crit), so a flooded bar can't starve her. Both rather than one: wider
    targets help when greens are there, the Perfect rule when they aren't.
52. **Hollis: why he felt flat, and the block as his best moment.** Diagnosis: (1) most blocks did nothing you could
    see or hear beyond a Guard pip: only a Perfect block slammed back, and the slam was half a hit; (2) Guard was spent
    by the very next hit as a small bonus (+30% a charge), so it never built to anything: blocking never paid off in
    one moment; (3) his finisher's wall happens off to the side (decision 24). Now: **every block slams the red's
    owner** (a plain one for 40% attack, a Perfect one 80%; `kits.hollis.slam/slamPerfect`) with its own short
    hit-stop (35 ms, `juice.slamStopMs`), impact tier `'slam'` and sound (`shieldCounter`); and **Guard builds to a
    Bulwark**: hits no longer spend it; at full Guard (5, 7 at 3 stars) the next block or hit unleashes it on every
    foe (40% attack per charge, `styles.bulwarkPer`) with a big hit-stop (110 ms), impact tier `'bulwark'` and its own
    sound. His tree follows: Deep Guard = the Bulwark hits harder, Avalanche = a Bulwark stuns every foe 1 s,
    Retaliate = each Guard stored makes slams 20% harder (Retaliate's old "plain blocks slam" is now the kit), Shield
    Storm (5 stars) = every block slams as hard as a Perfect one. The bot holds its finisher while a Bulwark is ready
    (Rampart would spend that Guard on one foe). To stay level with Rowan: his base HP 95 (was 100).
53. **Moss's allies scale with the Companion stat** (the one companions' attacks use): `allyPower` = 1 + 0.15 for every
    Companion point above a fresh hero's 6, as a share of it (a typical hero: about x1.1 in Act 2, x1.3-1.4 in the
    second region; Companion gear makes it climb). Thornling jabs and Glowmoth heals scale with it; a Thornling jabs
    for 30% attack (was 22%), so it reads as a real hit. `ally` events carry `amount` and `power` for the view. Moss
    already ran ahead at the bosses, and this put him 15-20 points over Rowan there: the bot's fights showed his
    Barkback was most of it (it stops nearly every red that gets past him), not his own hits (his attack share moved
    nothing). So a Barkback rests 16 s after stopping a red (was 8; it scaled with power at first, which made it
    worse), Overgrowth's vines slow reds to 0.7 of their speed (was 0.5), his base HP is 90 (was 95), and the Glowmoth
    heals 0.4% (unchanged, but it grows with power). A Barkback and a Seedling don't scale (one red, one green).
54. **Sable's dash lands slow:** after a Shadow Dash the cursor runs at half speed (`kits.sable.landMult`) for about
    0.3 s (`landSec`), a short `'land'` patch from where it lands up to the block it dashed to, so that block can be
    read and hit (it was 0.15 s of normal travel). Her kit line and how-to card now say it plainly: a Perfect makes
    you dash; it slows at the next block; tap it.
55. **Newt's burn is per foe** (`Enemy.burn` seconds left, `burnDps`, `burnTick`): a bite sets its target burning for
    4 s (refreshed by the next bite) for half the bite's damage every second (it was a flat 3 a second for 3 s, one foe
    at a time). The bite grows with the companion's level, stars and the Companion stat, so the burn does too. Each
    tick is an `emberBite` strike.
56. **Events for the view** are listed in `docs/fight-events.md`: `enemyHurt.perk` (which perk struck), Shield Slam
    and Bulwark (perk events, hit-stops, tiers, sounds), Glacier's freeze and slows, `Block.target`, the `'land'`
    zone, `Enemy.burn`, the allies' `amount`/`power`, Wind-Up's multiplier.
57. **Vesper's last-act gap (-20) closed:** split by the boss's phase, the bot's fights showed she took about 60% more
    red damage than Rowan, mostly the first phase's icicles (still reds on a fuse): every other finisher knocks them
    off the bar, but her Volley keeps the reds to pin them and a pin couldn't hold an icicle. Now the Volley pins
    icicles too (their fuse waits; one waiting at the left end waits as well), and **the bot times a tap on a pinned or
    slowed red for where it will be when it moves again** (it used to aim at the pinned spot and be late). Act 6:
    -22 -> -3 (300 runs). Nothing else about her changed for it.
58. **Hero parity after round 6** (`npm run campaign`, two regions, 300 runs per hero: at 100 runs the same numbers
    moved 8-14 points an act): every hero within +/-10 of Rowan in every act (Moss +10 in Act 3 and Hollis +10 in Act 6
    are the edges). The table and each change are in docs/balance-heroes.md. Greenmarch's guards in `bot.test.ts`
    (Rowan) all still hold, so no guard moved.
