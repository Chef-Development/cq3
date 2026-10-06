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
