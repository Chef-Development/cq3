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
32. **First-time tips for everything new on the bar** (holds, ice, snow, mirrors, iced yellows, kegs, frozen blocks;
    drifting blocks and pairs for the third region) and for chests, the shrine and companions: one short tip, shown
    once, like the rest.

## Part 9: the third region (details in docs/content-bible.md section 6)
33. **Its two bar rules:** drifting blocks (a share of yellows slide slowly along the bar, turning at the ends and at
    their neighbours; never reds, greens, traps, kegs or frozen blocks) and linked pairs (two yellows chained: the
    first tap lights one, the second within a beat of 0.8 s lands both at x1.5; too slow and both break as one miss).
    A pair nobody starts costs nothing. Perks never hit half a pair. The beat is a visible fuse burning down the chain.
34. **Pairs don't drift in this build** (the design allows a drifting pair in Act 3): a pair stays put, a single
    yellow drifts. Simpler to read, and the bot and the judge treat both cleanly; a later pass can add drifting pairs.
35. A Link relic was renamed **Slow Match** (its first name clashed with a hero's skill).
36. Story calls the planning chat may want to confirm: the region's boss is Mags's old master (a camp scene after its
    first act tells it), and its victory points on to the next land.
37. The region's relics unlock by its act clears and elites only (no mastery milestones for it yet); 4 from the start.
