# Decisions log (overnight runs: M5 "heroes", the round 6 polish run, the round 7 "stays fixed" run)

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

## Overnight polish run (playtest round 6: the Test lab report on build 430c962, 24 rated: 10 good, 14 needs work)
L1. **Base branch.** PR #5 (`claude/m5-heroes`) was still open and `main` has only the initial commit, so this run is
    built on `claude/m5-heroes` (branch `claude/eloquent-ptolemy-b7qwvk`); its PR includes #5 and supersedes it.
L2. **Lab fights count toward the accuracy readout.** Practice fights (the Training Dummy, every Test lab fight) now
    keep their taps' timing samples (they were thrown away: the last report said 0 taps). The lab's samples go to a
    log of its own (`cq3.lab.acc`, shared by every lab scenario and kept across reloads), and the lab report's accuracy
    line counts the real game's samples and the lab's together, then says how many came from lab fights. The real
    save is still never written by the lab.
L3. **Bar rules' first-meeting tips.** Every bar rule already had one (holds, ice, snow, mirrors, iced yellows, kegs,
    frozen reds, drifting and paired blocks); the playtester never saw them because the lab's bar-rule scenarios ran
    with every tip marked seen. Those scenarios now show their rule's tip (reworked: they ask for a new rating), and an
    icicle's mark (where it will drop) got a tip of its own.
V1. **Every effect shows on what it touched** (the playtester: "not only as a word above the bar"): one table says where
    each perk lands (`view/perk-at.ts`: the block, a foe, the cursor, the hero, the meter, the combo, the style tab, its
    coins' source...) and one module draws it (`view/onsite.ts`). The callout words and the lane's names stay. A unit
    test reads the core for every perk it fires and fails on one without an entry; at run time an unknown perk still
    shows on its block, its foe or the hero, never only as a word. The table and what each looks like are in
    docs/fight-events.md ("View coverage").
V2. Perks that change several blocks without saying which (Quake, Bend, Parry, Shockwave, Pinning Shot...) flash every
    red on the bar; Chill Bite flashes every red of the bitten foe ("Needs from core" asks for block ids).
V3. Mote's star and the Seedling's seed fly to a green that is already on the bar: hiding a block the player could
    already tap until the star lands would change the timing. The ally a green calls does wait for its leaf (200 ms;
    allies are only drawn, the sim has them at once).
V4. Bun's Lucky Foot (every 10th hit) always comes with Bun's own attack (every 5th), so Bun hops once it's home from
    it; the coin pops out of the block at twice its size so it reads where it came from, and "+1" pops by the counter.
V5. Sunny's breath: each foe's number shows as the sweep of fire reaches it (a wave, within about 0.4 s) instead of
    all at once; the damage is the core's, only when its number shows changes. Fire Breath's traps stay drawn on the bar
    until the fireball reaches them (at most 0.2 s; they're gone in the sim already, so nothing can tap them).
V6. A slow patch laid where a Shadow Dash just landed (within 0.8 s, over its landing spot) is painted in Sable's
    violet so it reads as the dash's; any patch kind the view doesn't know yet is painted like a slow patch, never
    left invisible.
V7. A heal shows a green +N on the hero too (beside the HP plate's): heals within 0.9 s merge into one number, so a
    heal on every hit (Vampiric Fang) never stacks numbers.
V8. Flights from the stage to the bar (Mote's star, seeds, leaves, companions' streaks, fireballs) draw over the
    callout words, which they would otherwise pass under.
V9. **Sable's landing is the core's `'land'` zone now** (it drew nothing, and the cursor tinted as if in snow): a
    violet brake toward the block the dash aimed at (chevrons pointing back against the run), brackets on that block,
    the dash's violet smear on the cursor inside it. V6's place-and-time guess is gone: a slow patch is always frost
    blue.
V10. **Hollis's Shield Slam comes with every block**, so its "Slam!" word shows at most every 1.6 s; the slam itself
    (a shield flying from his guard into the red's foe, a clang, a steel number) shows every time. Its number is steel
    white-blue (`enemyHurt.perk`), apart from taps' gold and Newt's orange. Heavy Slam and Retaliate show on the slam
    they boost (it lands heavier) rather than with marks of their own; Wide Slam sends smaller shields to the others.
V11. **The Bulwark's blows land as the great shield reaches each foe** (a sweep of about 0.3 s, nearest first): the
    damage is the core's at once, only its hit and number wait for the shield, as Sunny's breath (V5). "Bulwark" is
    the word; the blows have none.
V12. **"Bulwark ready" shows on the Guard tab and on the cursor** (a steel aura, a shield over its cap), where the eyes
    are; a shimmer along the bar's frame was tried and did not read against the light frame.
V13. **Frozen solid (Glacier) is an ice shell the red reads through**, cracking in steps as it thaws, for Neve's reds
    only; Vesper's pinned reds and icicles (also `chillMult === 0`) keep the arrow-pinned look, so whose doing it was
    stays readable.
V14. **Turnabout's kegs and Big Freeze's ice take the red's place where it stood** (no drop-in): the red's own exit is
    the morph (it turns edge-on and the keg widens out of it; ice climbs over it and flashes). They are matched to
    their red by kind and position in the batch ("Needs from core" 4).
V15. **Torva's multiplier rides over the cursor while Wind-Up is armed** (x1.8 at no combo, growing) and lands as
    "x2.6!" beside the foe, left of its damage number so the two don't overlap; the callout word is the multiplier
    too, not "Smash!".
V16. **Vesper's target greens**: a halo under them, a bullseye and breathing corner brackets over them, all gold and
    quicker at full Focus. A red drifting over a target draws over its marks (the red is the threat).
V17. **Moss's ally power reads from x1.15** (a soft glow round each ally); a Thornling's thorn comes as two bolts from
    x1.2 and its number is full size from x1.4; a Glowmoth's heal brings more stars. A fresh Moss looks as before.
V18. **Newt's flames burn on every foe with `burn > 0`**, up to half again as tall by `burnDps` against 3% of the
    foe's HP a second, so a weak bite on a boss still shows, smaller.
V19. **New callout words:** Glacier "Frozen!", Big Freeze "Ice!", Turnabout "Flip!", Patience "Snipe!", Bulwark
    "Bulwark", Avalanche "Stun!". Skill nodes that change a hero's own move get a word (Big Freeze, Turnabout,
    Avalanche); the other skill nodes stay in the lane.
H1. **Hero select layout.** The stage is the left 46% of the safe width (the hero centred on it by their figure,
    measured from their idle frame, so Rowan's sword or Torva's hammer don't push them off centre); the column on the
    right. The title shares the name's line; the bio, the style's rule and the soft strength moved into the sheet a tap
    on the name or the chips opens (the strength was beside the tabs). The Kit / Stars / Mastery tabs are gone: stars
    are five big stars over a shard meter, mastery four wax seals (lit when done; an arrow, a flag or a crown by goal),
    each opening its sheet. A hero not met yet keeps their real name (dim), as before; "Locked" takes the column.
H2. **Kit card labels** are one word that fits a 32 px card in bold on the phone: Special (signature), Green (the
    ability), Trait (passive), Swipe (finisher, the game's own word for it). The sheet names them in full.
H3. **Picking a hero** no longer shows the "X picked! / Same gear, their own level" toast: the hero hops, rings and
    stars burst, "Fights next!" floats up. "Each hero levels up on their own" is in the level sheet (and the heroes tip).
H4. **Swipe** works on the stage only (not the column, the arrows or Back): a press there is judged on release
    (input.ts -> scene.campPressAt/DragTo/ReleaseAt, not camp.ts, which another agent owns; a press let go in place
    still goes through camp.tap). 4 px makes it a drag (the world map's DRAG_PX); 22 px or a quick flick pages; a short
    drag snaps back.
H5. **The camp's dim over a stage.** camp.ts draws its 62% dim on gUi before every screen, and a full-screen stage
    image (drawStage, at D.ui - 0.004) sits under gUi, so the dim darkened the whole stage. `liftDim` (ui-modern.ts)
    clears gUi and draws the dim on gFront instead (under the stage, over the camp). Simpler later: camp.ts skips its dim
    for screens that paint a stage.
H6. **The silhouette** of a hero not met yet is a flat fill with a 1 px rim from the stage's light: SpritePool takes a
    `fill` colour (Phaser's tint mode set by number, 0/1, so camp-kit.ts needs no Phaser value import: unit tests
    import the hero select's module).
H7. **The style stages** (castle yard, moonlit rooftops, fortress gate, dusk forest, quarry, ice cave, glowing grove,
    sapper's workshop) are painted in art-ui-styles.ts under their own motif names (yard, rooftops, gatehouse, dusk,
    quarry, icecave, glowgrove, sapper): the companions' night theme reuses the generic 'grove' motif, so the old
    generic painters stay. Each also paints its own floor (flagstones, roof tiles, cobbles, grass, gravel, ice, moss,
    planks). Composed for the hero select (the hero's spot framed by a gate, an arch, a great tree or a lamp).
H8. **Skill tree geometry.** Five nodes and the root in 119 px of height (the phone) leave ~19 px per node, less than
    an 18 px badge plus a visible link: the branches rise in three columns that lean outward, each node stepping to
    the other side of its column, so every link is a diagonal. The branches' names are on the card only (no room on
    the tree); the branches are told apart by colour (ember, azure, leaf, left to right, the same for every hero).
H9. **Learning is instant in the profile** (saved at the tap; the smoke tests and the tips see it at once); the
    energy run (520 ms) and the node lighting are the show on top, and the points counter shows the old count until
    the energy lands. The post-learn toast (stat before > after, or the rule's new line) became a float of the stat
    gained; the card shows the before > after row before learning.
H10. **CLAUDE.md** still describes the hero select as "paged by a strip of faces; Kit / Stars / Mastery tabs" and
    doesn't list art-ui-styles.ts: left for the planning chat to update (agents don't edit CLAUDE.md).
The chests, the vault and the shrine (the playtester: menus "dated, simplistic and empty"; rewards should be exciting).

- **S1. Big chests in two parts.** Each chest is drawn at 49x46 as a lid and a base on one canvas (art-chests.ts), so
  the lid can hop, lift (light showing in the gap) and burst away; the opening shows them at 2x as its focal point.
  The camp's prop keeps its key and size (`hchest_${kind}_closed`, 35x34, the new designs at camp size), so camp.ts
  is untouched.
- **S2. A silhouette per kind.** Hero: a barrel-lidded oak chest banded in gold with a crest. Rare: a bevelled navy
  trunk with silver trim and a cluster of crystals growing out of its top. Region: a violet reliquary on gold feet
  under an arched roof with a ruby crest. Told apart at a glance, even as badges.
- **S3. None waiting = open, empty, dark.** A kind with no chest stands open and empty, dim, with dust and a cobweb;
  a tap rattles it and says where they come from (the only sentence on the vault, after a tap).
- **S4. The build-up is one step per tier.** Common gets one pulse (grey), Divine eight (to prismatic), each about
  0.6 s and quickening, harder shakes and wider cracks as they climb, then a charge (0.4 s + 70 ms per tier) and a
  silhouette hold (0.9 s + 90 ms per tier). A row of eight tier gems under the top bar lights up per step (the ones
  above stay dark: "will it go further?"). A tap jumps to the next mark (slam, a step, the charge, the burst, the
  reveal); it never skips the reveal.
- **S5. The prize as a figure, not a card.** The hero's fight idle frames at 2x (a companion's at 3x) rise out of
  the chest's light as a black silhouette with a 1 px rim of the tier's colour, then flash white and fill in. The
  banner sits under the top bar's middle (clear of the HTML gear button), the name and what it means under the feet.
- **S6. Open all rolls everything first.** All waiting chests are rolled, granted and saved up front (closing the app
  mid-chain loses nothing), then play one after another and end on a summary of tiles; chest heroes met play their
  arrival scenes after the summary, one after another.
- **S7. The shrine's Open pays and opens.** One action: a Rare chest already waiting opens free first; otherwise it
  pays the gems and opens right there (no Buy-then-Open). camp.ts's old 'openRare' route is now unused; left in
  place since camp.ts belongs to another agent.
- **S8. Staged screens clear the camp's dim.** camp.ts draws a 0.62 dim on gUi before every screen, which would
  darken a stage drawn under it (STAGE_DEPTH); the vault and the shrine clear gUi first (their stage covers the
  camp). Suggest camp.ts skip the dim for staged screens.
- **S9. The vault and the shrine paint their own floors.** Their specs set floorY 150 and the motif paints flagstones
  in perspective from VAULT_FLOOR / SHRINE_FLOOR (`flagstones()` in art-shrine.ts), rather than the plain bands.
- **S10. An image pool that sets everything.** The opening's light (seams, glows, rims, the silhouette) needs ADD
  blending and fill tints, which the kit's pools don't set; `FxImages` (chest-opening.ts) sets blend, tint mode, crop
  and angle on every draw and hides itself each frame (the scene's pre-update), so nothing lingers.
- **S11. Fanfares sized to the tier.** Common and Uncommon a ding and a little run; Rare and Epic the boost stings;
  Legendary and Mythic the reveal cards' fanfares; Celestial a choir on a major ninth under cascading bells; Divine
  the Legendary fanfare with a second brass call a fourth up, a choir and a long glitter. Every new sound peaks under
  0.8 (audio.test.ts).
- **S12. The Test lab's demo.** `camp.chests.demo(tiers, kind, now)` plays the opening at forced tiers (several
  chain like Open all) with a hero (Rare+) or companion of that tier or the closest below, always as "New": no roll,
  no grant, no scene, no achievement. Nothing above Legendary can come out yet (no Mythic+ heroes or companions), so
  the demo is the only way to see the Mythic, Celestial and Divine build-ups.
- **S13. The top pity vial has no label.** The thin cyan vial beside the Legendary one is the Celestial pity; its
  number is in the pity sheet (tap the vials). Fewer words on the screen.
C1. **Companions: a night grove, the companion at 3x on a mossy stump.** Its name, rarity and stars sit over the stage
    (the stars beside the rarity on a glass pill, drawn above the name so a "y" or a tall companion's ears never hide
    them); its kind, role and joke moved behind the "i" (a Sheet). The perks stay as cards (the attack first): the
    body is bold when every card fits, else the small face (only Sunny, with three perks, on the phone's 142 px).
    Equip is one big button that toggles (Equip / Unequip, "Along" when it's the only one along; the old "Move here"
    is gone: tap a socket to choose the slot Equip fills). The stage theme is the screen's own (`art-grove.ts`,
    registered with registerStageTheme).
C2. **A screen that paints its own stage sets `staged = true`** and the camp skips its dark dim behind it (the dim sat
    over the stage image otherwise). Other modern camp screens can use the same flag without touching camp.ts.
C3. **Completion tracker: the region as a framed parchment map** (`art-region-map.ts`: one hand-drawn map per region,
    painted on first open, not the world map's art: its acts sit too far apart to crop a window that fits), with a
    flag on each cleared act's site, crown / skull / scroll / chest seals under each site and three star seals for the
    events; empty ones are dotted sockets inked on the paper. A tap on a seal or socket names its part with the count
    ("Treasures 2/3"). A region not reached yet shows a fogged sheet and "???" (its land would spoil it). The region
    tabs moved into the top bar (after Back, like the hero tabs) instead of down the side: "Greenmarch" needs 75 px, and
    the map is the focal thing, so it gets the width. Claim is padlocked (grey, shakes, "Reach 100%") until 100%.
C4. **Camp upgrades are objects in the camp; the Upgrades screen is build mode over the live camp** (no dim). Spots
    (`art-camp-build.ts` BUILD_SPOTS, all inside the phone's safe area and above the button band): the Lucky Stone at
    the tent's left foot, the Reroll Charm hanging under the tent's peak (it turns), the Companion Perch between the
    tent and the log (a tall post: the second companion sits up high, clear of the name plates; the old second pet
    spot is gone, so the Perch and "two companions along" are one thing), the Map Table behind the fire (lantern-lit),
    the War Table between the forge and the shrine, the Training Dummy by the shrine as before. The third standing
    hero moved from (99, 111) to (110, 104) to clear the perch. Before it's built a spot shows the object's blueprint
    ghost (pale blue, pulsing; lavender when locked) under a hammer marker (gold: can build now; grey with a padlock:
    not yet); a tap opens a glass card (name, one line, Build with the coin price / the unlock line / Built /
    Practice / Companions). Build closes the card so the dust, three clangs and the object rising can be watched;
    tapping a built object (home or build mode) opens its card again; the perch opens the companions, the dummy
    practices. The Camp button glows with a gold "!" when an upgrade can be built now. No new save data: what stands
    is `profile.camp`; the build animation plays only when it's bought.
C5. **Test lab:** the four camp scenarios on the reworked screens (Companions, Camp upgrades, Completion: almost /
    100%) get `rev: 1` and new "try" lines (a rating given to the old screens asks again). They stay where they are in
    LAB_EARLIER: moving this round's items into LAB_NEW is left to the merge, since every agent this round touches it.
C6. **The camp skips its dim behind every modern screen by mode** (`STAGED_MODES` in camp.ts: heroes, skills, chests,
    shrine, pets, progress, upgrades; a screen's own `staged = true` still works too), at the lead's request: the other
    screens' workarounds (liftDim, clearing gUi) are no longer needed. The old-style screens (bag, forge, stats,
    relics) keep the dim. On this branch alone the old hero select, chests and shrine differ from their baselines by a
    few pixels (inside the screenshot tolerance); their merged versions bring their own baselines.
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
L4. **Test lab, round 6:** New holds everything this round changed. That is the seven heroes again (rev 2: the
    tuning and the effects on their targets), the two new tree options already learned (Neve's Big Freeze, Tam's
    Turnabout), the four companion pairs (rev 2), Act 2's tougher foes (rev 2), a chest opening at five rarities from
    Rare to Divine (a demo: nothing is granted; nothing above Legendary can come out of a chest yet, so it's the only
    way to see those build-ups), Open all, and a walk through every redesigned menu (rev 1). The bar rules are in New
    too, now with their tips. The single Hero and Rare chests moved to Earlier (Open all plays both kinds). It runs
    about 21 minutes without the spoilers, over the old 10-minute aim, because most of what was rated last round was
    reworked.
L5. **Save migration: replaced skill nodes.** Neve's Shatterburst became Big Freeze and Tam's Stockpile became
    Turnabout, each in the same place in its branch. A save that learned the old node now has the new one
    (`SKILL_RENAMED` in core/heroes.ts), so the rest of the branch stays learned. Nothing else in this round changes the
    shape of the profile or the run save (the camp's built objects come from `profile.camp`; the lab's accuracy has its
    own key), so `SAVE_VERSION` and the profile key are unchanged.
E1. **Text pass: one word per idea.** "Foe", never "enemy" (tips, relics, Tam's Blast Shield). Neve's ice is
    "shattered" (her kit, tip, Big Freeze, the lab line); "smash" stays Torva's (Wind-Up). "Chain" is capitalised
    like Guard and Focus when it's Sable's style meter. "Pick" for choices ("Pick a Relic", "Pick an act", the event
    tip), "Bounty" for the map's bounty stop (it said "Quest"), "Finish" for holds and pairs, "Beat" for foes. US
    spelling throughout (traveler, favorite, gray), as the UI already was (Armor, Defense).
E2. **The finisher lines lost their "Swipe:" prefix** (the hero select's kit sheet already heads them "Finisher
    (swipe)"); the gesture keeps the word "swipe" everywhere else (the finisher tip, the lab lines).
E3. **Two stat lines were wrong or too wide.** Companion Power's short name was "Pip dmg" and its line "Damage of
    Pip's pecks" (every companion, and Moss's allies, use it): now "Companion" (narrower than "Slower cursor", so it
    fits every list) and "Companions hit harder." Steady Cursor's line overflowed the stats screen's pane on the
    phone (302 px of 263): "Combo speeds the cursor up less."
E4. **The act clear and the region victory named the wrong place.** After a region's boss the act clear said "The
    road to <the next region's first act> is open" (a later region's name before its scene); it now says
    "<Region> is safe again", as it did when Greenmarch was the whole campaign. The victory said "The Kingdom is
    saved!", "The first weight is home. Eleven to go." and "Next: the Frostpeaks (coming soon)" after every region;
    it now names the region won, counts the weights from the profile and names the next region (the victory scene has
    just named it) or "More lands soon".
E5. **Left alone:** the story scenes and banter (already two short lines, in the characters' voices: only spelling
    and Pip's pair line in Ashfell, which said "to break a pair, hit both ends", the opposite of the game's "broken
    pair"); foe and special-move names (no typos found); the Sound lab and the cheat toggles in the options panel
    (testing tools); the fight-view files another agent owns (callouts, hud, bar...), and player-facing strings built
    in src/core (boost cards, completion labels), which this pass wasn't given.
E6. **Text pass, round 2 (the fight view and the strings src/core builds).** The fight view's words were already
    short game words (every callout within 7 letters, "Foe 3/7", "Perfect!", "Swipe!"): nothing changed there. In
    src/core, the Companion Power boost card no longer says "Pip" ("+4" under its name, "Companion 6 > 10" as its
    preview, like the stat's short name), and a relic's unlock line reads "Clear Act 1" (it said "for the first
    time": only a first clear can unlock one). Completion labels, build names, bounty goals and the skirmish and
    roamer code were already plain; Sound lab names stay (testing tool).

## Overnight run, playtest round 7 ("fixes that stay fixed", anti-spam, unique finishers; Test lab: 25 of 27 good)
R1. **Base branch.** PR #6 (`claude/eloquent-ptolemy-b7qwvk`) was still open and `main` has only the initial commit,
    so this run is built on #6 (branch `claude/bold-hypatia-88tmo3`); its PR includes #6 and supersedes it.
R2. **The work ran as parallel agents in their own worktrees** (one owner for the combat core: the anti-spam agent);
    each part was merged, tested and pushed on its own. Round 6's lab items moved to Earlier first; New starts empty.

### Part 5: the companions screen
C7. **Why it felt weaker than the hero select:** the right side was four stacked full-width slabs of bold text, all
    the same weight, so the eye went to the text; the stage was cramped (name, rarity, stars and "i" squeezed into its
    corner, the sockets and button over its floor), the companion stood off-centre and sank into the stump, the grove
    was murky; no paging (17 px tokens only), 3 px meters, and a token strip that couldn't hold 12 companions.
C8. **Laid out like the hero select:** the stage on the left (46%), the companion centred at 3x, big arrows and a
    swipe (it slides out; the next hops in and lands in dust, or flutters in), a glass head with the name (bold 2),
    rarity chip, stars over a shard meter, level and XP. The Along sockets and Equip sit at the stage's foot so the
    descriptions get the column's full height.
C9. **The descriptions stay as readable cards** (the attack first, then each perk: icon, name in its colour, the
    line in bold). Every description shows in full when it fits (7 of 8 on the phone); when crowded (Sunny's three
    perks) the attack shrinks to one row and each perk shows a short line with a chevron; any card opens a Sheet
    with the full line and what stars do. The words are built in one place (`view/companion-cards.ts`).
C10. **Motion:** fliers hover and flap over the stump, walkers breathe; a tap hops, plays the attack pose, chirps and
    rings; Equip hops, rings, bursts stars and flies the companion into its socket ("Comes along!"); not met is a
    rim-lit silhouette with a "?" and "Found in hero chests"; the padlocked socket rattles ("Build the Perch").
C11. **The grove got richer instead of a stage per kind** (a moon behind the companion, layered trunks, a lit
    clearing floor, the lamp light in the companion's colour). The token strip shrinks 17 -> 15 -> 13 px to fit 12.
C12. **`SwipePager` is a shared part** (`ui-modern.ts`); the hero select keeps its own paging for now. Lab
    scenarios can set companions' levels and stars (`petLevels`, `petStars`).

### Part 1: fixes that stay fixed (each with a test that would have caught it)
T1. **Why "tap yellow" came three fights in:** it is a pre-fight tip, but the view only offered it once the fight
    screen had settled (~0.8 s) while TAP TO BEGIN started the fight at once, so a quick tap skipped it and it stayed
    due until the first fight the player paused on. Also, the old order was "whatever happens first" under a cap of
    two tips a fight, so a special or the finisher often beat red and green, and Act 1's first row has no purple.
T2. **TAP TO BEGIN asks the coach first** (`TipCoach.holdBegin`): a due pre-fight tip (tap yellow, a hero's how-to,
    the relic belt) comes up and the fight waits for it.
T3. **The teaching order is data:** `TIPS` order is the teaching order and each tip lists what it waits for
    (`after`). The first fight teaches `FIRST_FIGHT`: tap yellow, block red, green, purple, finisher (red before green
    keeps round 4's "the first fight teaches blocking"); specials and combo breaks wait for the finisher, bar rules
    too, pre-fight tips for tap yellow.
T4. **The five basics are never capped** and come 2.5 s of fight time apart (`lessonGapSec`); other fight tips keep
    the 4 s gap and two a fight, so they move to fight 2. A simulated 85% new player gets all five in fight 1, in
    order, on 30 of 30 seeds (~1, 4, 6, 9 s into a ~15 s fight).
T5. **A lesson brings its block when fight 1 doesn't:** when a basic's turn comes and nothing of its kind has been on
    the bar for 1.5 s, the coach places one through combat's public `enqueue` (a red, green or purple) or fills a
    finisher stack for the finisher's tip. Only while tips are on and the tip isn't learned, never in a Coin Rush;
    Act 1's data and the core are untouched, and the balance bot never runs the coach.
T6. **Fight tips are due while their thing is on the bar** (not only the moment it spawns), so a tip waiting its turn
    still comes at the first meeting; bar-rule and hero tips (`rule`) are uncapped, first meeting only, never twice.
T7. **"Known" skips a tip:** 10 yellows hit, 3 reds blocked, 3 greens, 3 purples let pass, 1 finisher; counted into
    `profile.tipsDone` (optional: missing reads as none; counted with tips off too; "Show tips again" clears it).
P1. **Why the tracker showed 11 marks beside "13/15":** the three acts were counted but drawn as small flags on the
    act sites (not seals) and the two items left as faint dotted rings, so only 11 wax seals showed; the marks were
    also laid out apart from the counts (bounties counted by log length but lit by act), so they could disagree.
P2. **One source for every count:** `regionCompletion` lists every counted item and the parts, totals and % are
    counted from that list; the card stamps one mark per item (a row of four under each act site: the act's flag
    seal, its mini-boss or boss, bounty, treasure; plus three event seals). An empty socket shows its emblem ghosted.
P3. **The map pans:** 250x150 behind the 190x110 window, opening on the old view (all 15 seals in it); a press that
    moves more than 4 game px drags (clamped), one let go in place names the seal; gold chevrons show more map.
P4. **"Unlock all heroes and companions" leaves completion alone** (it counts what was played); the lab's
    "Completion: all" item checks every region at 15/15 with everything unlocked.
M1. **Every foe has its own act-map sprite:** the second and third regions' 29 foes (21 with a second frame; region
    bosses 18-20 px, mini-bosses 16-18), drawn from their fight art and compared side by side. All map sprites live in
    a pure file (`art-minis.ts`) so a unit test can check every foe that can stand on a map; the Coin Rush sack and
    the Training Dummy are exempt (and checked never to be on a map). They paint at boot (76 frames, ~9 ms).
M2. **One lookup, `miniKey`,** for the act map, its packs and the world map's wandering foe: a missing sprite is
    recorded (`window.__cq3.miniMisses`) and a Playwright test fails on it. The skirmish card spaces foes by their
    widths (the later regions' wide elites overlapped).
M3. **Test lab setup `map`** (an act's map to look at; scenes skipped): "Act 4 map" to "Act 9 map" (spoilers).

### Part 4: the sharper chest reveal (a test)
S1. **A separate canvas only for the reveal** (`#hd-layer`, a DOM 2D canvas laid exactly over the game canvas, sized
    from the layout every frame it draws, hidden otherwise, no input). Rendering the whole game finer was far too big.
S2. **k = 2** (654x300 fine px; 4 device px each on the phone): about the internal size of modern HD pixel-art games,
    so it still reads as pixel art; k = 4 looked like smooth art.
S3. **Hard pixels only:** filled rectangles and pre-painted canvases, never paths (canvas paths anti-alias), smoothing
    off, nearest-neighbour rotation, stepped light; particles from the time and a seed. The three chests, ribbon,
    tags, tier gems, stars, rays and bursts are drawn on the fine grid; hero and companion sprites keep the game grid
    (as asked: fighters stay on it), only their rim light is finer. Lettering: the game fonts doubled with Scale2x.
S4. **One opening, two drawings:** `ChestOpening` keeps the timeline, taps, sounds and grants; its `view` ('old',
    'hd', 'split') only picks the drawing. The setting is `cq3.chestReveal` (old unless 'hd'), not in the gear panel.
S5. **Side by side shows each reveal at full size in its own half** (shrinking would throw away the pixels being
    compared); one chest drawn twice, so they stay in sync. The lab item "Sharper chest reveal": Old / New / Both,
    Replay.
S6. **Rollout plan, if the playtester likes it:** (1) flip the default (`readChestReveal` returns 'hd' unless 'old'
    is stored) and keep the lab's Old/New/Both one more round; (2) paint the three fine chests in idle slices after
    boot like the world map (today each paints on the first tap: a small hitch); (3) next on the same layer: the loot
    screen's Legendary/Mythic cards and the act-clear chest (the ribbon, tags, lettering, rays and bursts are
    reusable); (4) later perhaps the menus' big focal names; the world, fighters, maps and HUD stay on the game grid;
    (5) each step: device-scale screenshots, a 60 fps check on the phone, the old path behind the setting until
    signed off; (6) after a round as default, delete the old reveal's drawing code and textures.
N1. **Where the long decimals came from:** HP is fractional inside (each kill adds +0.6 max HP; heals fill to max
    minus HP), and several screens still printed it raw: the Full Heal card ("61.80000000000001 -> 120": most likely
    the playtester's "healing values, upgrades"), the rest screen's "+N HP" and its floater, stat toasts after the
    forge or equipping ("x2.15 > x2.18"), the forge's crit damage ("+0.15x"), the shrine's odds ("0.54%"), relic,
    skill, kit and style texts filling `{n}` with two decimals, the foe plate's max HP, and fractional coins, XP, gems
    and scrap. Damage floaters were raw too (harmless today: combat rounds them).
N2. **One formatter, `src/core/format.ts`:** `whole` (HP, damage, heals, costs, coins, gems, scrap, XP, counts; never
    "-0", NaN or an exponent; huge values "1.2M"), `one`/`mult`/`secs` (at most one decimal, float-safe, a trailing
    ".0" dropped), `pct`/`pctOf`/`odds` (rounded percentages; under 0.1% reads "<0.1%"), `signed`/`signedPct`,
    `hpNow`/`hpOf` (current HP rounds up so a sliver reads 1), `compact` for plates ("12.4k"), `fillN` for a data
    text's `{n}`. Gear stats print through it.
N3. **Visible changes:** no trailing ".0" anywhere ("x2", not "x2.0"); the forge's crit damage reads "+15%"; HP is
    whole in every before -> after line (a change too small to show isn't listed); a heal shows at least "+1".
N4. **The safety net:** every string the game canvas draws or measures (`font.ts fontText`), the sharper reveal's
    lettering (`font-hd.ts`) and the HTML panels' text (`engine/number-guard.ts`, a MutationObserver; the tuning
    sliders' readouts are skipped: a developer tool) goes through `guardText`: a number with two or more decimals
    (`/(?<![\d.])\d+\.\d{2,}(?!\d|\.\d)/`: not versions, dates or times) is rounded to one on screen and the raw
    string recorded in `window.__cq3.textViolations` (NaN, Infinity and exponents are recorded too; bounded).
N5. **Tests that keep it fixed:** every Playwright spec imports `test` from `tests/smoke/fixtures.ts`, which fails a
    test on any violation as it happens (a unit test checks every spec imports it); `tests/smoke/numbers.spec.ts`
    walks every screen with awkward numbers (max HP 137.35, heals of 12.3456, fractional stats). Putting back five raw
    spots made it fail in 5 of its 8 tests, naming the strings.
N6. **The fight's debug line** (only while the gear panel is open) shows the cursor as a percent with one decimal.
N7. **Test lab "Heals and upgrades":** Rowan with Mote and two healing relics, four waves at Act 2's numbers, then
    three stat cards (nothing kept); lab fights can carry `relics` and end in a stat `pick`.

### Part 3: a unique finisher per hero
F1. **Structure:** a pure plan (`core/finisher-show.ts`: each style's way of moving through the show, every
    signature moment, each style's default, the rarity scaler, the timeline), eight style kits
    (`view/finisher-kits.ts`), the heroes' moments (`view/finisher-signatures.ts`, typed over every signature id so the
    build fails if one is missing), the runner (`view/finishers.ts`) and shared parts (`view/finisher-fx.ts`). A hero
    without a moment of their own plays their style's default; every show fits `finisherShowMs` (1.41 s at 5 stacks):
    the core's timing and the cursor hold are untouched.
F2. **The style kits** (each its own sky, strikes, last blow and sound layer): Blade, a pale steel sky cut by every
    strike, crescent slashes and a splitting long cut; Shadow, a moonlit violet night, afterimages blinking round the
    foe, rifts and jaws of shadow; Guardian, royal blue fanned with golden rays, shields flung edge-on and a steel dome
    shockwave; Marksman, dusk and first stars, reticles locking gold, arrows that stick, one great arrow through all;
    Brute, a dust storm with rocks floating up, cracking ground and rock spikes; Controller, aurora and cold mist, ice
    spikes and a foe locked in a crystal that shatters; Summoner, a deep grove with light shafts, spirit wisps bursting
    into leaves, vines coiling up the foe; Bomber, smoke over a burning horizon, lobbed bombs and a fireball column.
F3. **Each hero's moment:** Rowan, a steel whirlwind back and forth through every foe bursting into a ring of
    blades; Sable sinks into her shadow and bursts out of the target's, twin fangs crossing; Neve, a glacier rising
    behind the foes, surging over them and shattering; Moss, a seed that grows a great tree behind the foes, roots and a
    leaf storm; Tam, a keg bigger than she is, its fuse burning down, the biggest blast; Hollis, a banner-topped wall
    rising before him and toppling onto the foes; Vesper, one arrow up that becomes a sky of arrows and a giant golden
    arrow in a column of light; Torva, a towering leap, the earth splitting to the foes with magma, then erupting.
F4. **Rarity scales the spectacle** (`showScale`), Rare to Divine: build-up share 0.24 -> 0.46 of the same total,
    1 -> 6 layers (the rarity's colour charging behind the hero, converging light, a halo, rings and sparkles), flash
    90 -> 200 ms, more shake, darker edges, a fuller sky; Celestial adds falling stars, Divine a prism. Rarer heroes
    build up longer and strike faster inside the same envelope; the freeze per strike is capped so no show runs longer.
F5. **Readability:** titles read "<finisher> xN!"; the finisher hit no longer adds the generic star and slash (the
    style draws its own); the blow's flash is shorter and in the style's colour; with 3+ foes the numbers are big and
    staggered in two rows.
F6. **Sound:** a style layer rides on the shared finisher sounds (blade ring, shadow whoosh, shield clang, bowstring
    volley, rock crunch, ice crack, leafy rush, boom), in the SFX catalog and level-tested.
F7. **The Finisher gallery** (Test lab, Heroes): a calm practice stage (no blocks, no specials, nothing hurts or dies,
    nothing saved, the clock held between shows) with a plate to pick the hero (every hero in HEROES), stacks and
    rarity, and Play: two reds and a yellow go on the bar so what the finisher does to the bar shows too.

### Part 2: anti-spam balance (the combat core's one owner; details and tables in docs/balance-spam.md)
A1. **Crowding limit** (`tuning.spam.cover` 0.45): the widths of every block on the bar are summed; a foe's static
    block that doesn't fit isn't sent and its pattern keeps its pace (reds don't come faster). Reds, specials'
    formations and the hero's own blocks always come; a bar with no yellow or green always gets one from the refill.
    It applies in Coin Rush too (it pays a little less).
A2. **Each stack costs more** (`spam.stackStep` 0.32): 6 / 8 / 10 / 12 / 14 plain hits; `c.meter` still runs 0..1
    toward the next stack, so the HUD meter just fills slower (it doesn't show the cost yet).
A3. **Meter Gain** from gear and skills counts in full to +25%, then less and less, never above +75%; **meter relics
    stack with diminishing returns** (`meterStack` 0.33: the n-th relic to add meter in a fight counts
    1/(1+0.33(n-1))). Kit and skill meter is never cut.
A4. **Heal cap** (`healCap` 0.35): every in-fight heal goes through `gainHp` and stops at 35% of max HP per fight
    (kills, relics, gear, sets, auras, companions, allies, Second Wind); rests, potions, Full Heal cards, events and
    Field Rations are between fights; a revive isn't a heal. "No more heals" shows once (`healCap`). **Heal stacking:**
    the n-th heal source in a fight heals 1/(1+0.33(n-1)) (the kill heal isn't a source).
A5. **Forgiveness cap** (`forgiveMax` 3): Footpad, Clutch, Smoke Veil, Crampons and Spare Link together forgive at
    most 3 misses a fight (each asks `c.canForgive()`), then "No more saves" shows once; a forgiven miss still empties
    the meter's partial fill. Hoarder and Unbroken already cost stacks.
A6. **Misses cost HP that matters** (classic mode): 0.6% of max HP (at least 1), up to x4 for a miss within 0.5 s of
    the last. Without it the masher still won (ten taps a second blocks every red; 1 HP a miss was nothing). Relaxed
    mode is unchanged.
A7. **The masher bot** taps every ~100 ms with no aim (it holds any hold it catches and swipes finishers);
    `tests/unit/bot-masher.test.ts`: Act 3 never cleared first try, the boss's first fight never won, retries win at
    most 1 in 10. Result: Act 3 first try 0 / 0 / 0% in the three regions (was 40-69%); a boss mashed alone won 3 first
    fights in 120 (each with a stack-banking relic build).
A8. **Retargeted at 75%** (the lab measured 70% where the playtester guessed 80-90%): `TYPICAL_ACCURACY` 0.75; act
    HP/attack multipliers re-aimed (Act 2 1.2/6 ... Act 9 7/15), the Ruin Golem 2300 HP, the third region's mini-bosses
    3200 and 2800, its boss 7600. Late difficulty comes from speed: reds x1.2 in Act 6, x1.25 in Act 9.
A9. **Max-stack finishers per fight** (each region's Act 3, normal / boss) at 75%: before 0.02 / 0.28, 0.01 / 0.14,
    0.01 / 0.29; after 0.00 / 0.01, 0.00 / 0.01, 0.00 / 0.02 (85%: 2.3 / 1.9 / 2.0 at the bosses before, 0.16 / 0.07 /
    0.18 after). Bar covered at 75%: mean 34-39% -> 28-33%, peaks 69-78% -> 54-62%; boss-fight healing 26-36% -> 15-19%
    of max HP.
A10. **Clear rates after** (first try per act; Acts 1-9): 70%: 99 77 65 | 75 65 52 | 78 62 51; 75%: 100 85 63 | 85 68
    59 | 90 69 52; 85%: 100 95 75 | 95 83 53 | 96 86 64 (boss first fights in docs/balance-spam.md).
A11. **Two risk relics got cheaper** (Clutch 2%, Blood Price 6% of max HP): under the new rules they sank the 85%
    player below the 75% one in Act 6.
A12. **Hero nerfs for parity:** Moss (Barkback rests 32 s, HP 85), Hollis (Iron Hide 10%, Rampart wall 2 s), Tam (keg
    radius 0.09, HP 95), Torva (Heavy x1.5, Wind-Up from x1.7). Parity at 75% was not met yet (18 of 56 hero-acts
    outside +/-10, most of it from the 75% target itself: round 6's build at 75% had 30 outside): a parity pass
    follows.
A13. **Test lab "Late-game stress"** (Fights): Rowan at level 20, 3 stars, Epic gear, nine synergy relics with the heal
    relics, Pip + Mote, stacks banked, six waves of the first region's Act 3 foes at Act 9's numbers on Act 3's stage
    (no spoilers). Mash: you lose; aim: you win (guarded). Lab fights can carry `relics`, show another act's `stage` and
    wear a better kit (`profile.gear`). The lab hero-fight guard runs at 75%.

### Part 6: more heroes and companions
H11. **The eight new heroes' identities** (names, looks, rarities, kit ideas) were set by the integrator before the
    builders started, two heroes per builder: a second hero per style, rarities spread Rare 2 / Epic 2 / Legendary 2 /
    Mythic 2 (the first Mythic heroes): Solenne (Blade, Mythic), Wren (Shadow, Rare), Brann (Guardian, Epic), Dell
    (Marksman, Rare), Gorm (Brute, Legendary), Tess (Controller, Epic), Yara (Summoner, Mythic), Fizz (Bomber,
    Legendary). All come from hero chests. A Mythic hero has a fifth kit part (`HeroDef.gift`), shown as a fifth card.
H12. **Parallel builders without collisions:** slot markers (`// part6:A`-`E`) were seeded in the shared lists
    (hero and companion ids, records, tuning kits, art registries, tips, story speakers, lab), each builder adding its
    lines after its own marker. New kits use only the existing fight hooks (the combat core keeps one owner).
P5. **Four more companions (12 in all), each with an effect that shows on what it touches:** Burr (Common hedgehog;
    Prickly: a red or bomb that hurts you sends spines into the foe that threw it, 1.5x his roll; never for a red
    another perk stopped, nor traps or misses), Lark (Rare songbird; Wake-up Song: every 10 combo the next yellow in
    the cursor's path gets a note, hitting it adds 3 combo; one note at a time), Gloam (Epic black cat; Night Eyes:
    every 12 s the next trap is swatted into a yellow, the same block and width, so the bar's cover doesn't grow; it
    leaves Pip's chosen trap alone), Nimbus (Mythic sky whale; Tide: every 20 s, once a red is in the bar's near half, a
    wave crosses the bar in 0.45 s pushing each red back (icicles skipped: pushing one starts its fuse); Calm Seas: +15%
    at combo 30+, a glow on the cursor rather than a word on every hit). Numbers in `tuning.pets` with sliders; stars
    step them like the others. A Mythic companion drops at under 2% and from the shrine's top pity.
P6. **Test lab:** "Burr + Lark" and "Gloam + Nimbus" pair fights; the companions screen scenario owns the new four.

### Hero parity at 75% (after the anti-spam rules; docs/balance-heroes.md)
Q1. **Rowan, the 75% act curve and every style number stay as they are** (the eight new heroes are tuned against
    Rowan, and they share six of the styles); every change is in one hero's own kit numbers or soft strengths.
Q2. **Why the others led at 75%:** Rowan is right at the edge in boss fights (about 2.4 reds get through to him at the
    Boar King; he loses once about 3.3 do), and each leading hero had a way to let fewer reds through.
Q3. **Trimmed:** Moss (a Barkback rests 96 s after a block: about one red a fight; Thornling 20%; Overgrowth's vines
    1 s at x0.8), Hollis (slams 30% / 60%, Iron Hide 5%, Brace 1.5 s, Rampart's wall 1 s, Guard x0.4 a charge, attack
    0.82; his soft strength guards against Flyers instead of Brutes: four region bosses are brutes), Tam (Big Bang
    drops 1 keg, HP 85), Torva (Wind-Up no longer stuns: any stun cancels a boss's told special; Quake 0.03, Wind-Up
    from x1.5, calm 0.4 s, Unstoppable 4%, HP 100, attack 0.8).
Q4. **Lifted in the second region:** Neve (takes 25% less from Frost foes; Glacier x0.8) and Vesper (+25% to Frost
    foes; Flyers 20%; Piercing Shot 25%: it hit the Boar King's piglets for half of every Power Shot).
Q5. **Result on 400 runs per hero** (two seed sets: a 200-run gap moved by up to 12 between samples): 6 of 56
    hero-acts outside +/-10 (was 19), mean gap 5.2 (was 8.7), the largest +15 (was +31). Still outside: Hollis Acts 3
    and 9 (+12, +15: the Guardian style and his tree's Avalanche stun and Long Rampart), Neve Act 3 (+13: her Beast
    strength at the Boar King), Moss Act 9 (+13: Swarms before the last boss), Torva Act 5 (+13: +10 and +17 on the two
    samples), Sable Act 5 (+12: Casters in the second region). Every hero is ahead at the Boar King: closing that would
    mean changing Rowan or the boss, which would move the new heroes' reference, so it waits for the playtester's word.
H13. **Yara (Summoner, Mythic):** greens call her spirits in order (a Wolf that bites, a Tortoise whose shell softens
    the next red, Wisps that fill the meter); with all three out a call is a Rally; Kinship adds crit per spirit; her
    finisher, Spirit Stampede, charges every spirit through the foes (more per spirit) and clears the traps. Her gift,
    Great Spirit: a Rally calls a spirit stag for 4 s that strikes every foe each second. The Summoner style became
    data-driven (a summoner lists its ally kinds; blockers are marked), Moss unchanged.
H14. **Yara's Tortoise softens a red (takes 25%) instead of stopping it:** at 75% a boss red is about a third of her HP,
    and even one full block a fight kept her about 25 points ahead at the Boar King; a new Tortoise also waits out the
    last one's rest (it used to block on every call). Her soft strength is Swarms (the design's Beasts would hit all
    three region bosses).
H15. **Dell (Marksman, Rare):** Ricochet (the Power Shot bounces to the weakest other foe for 35%), Lucky Shot (a
    Perfect green crits), Pocketful (a miss keeps the meter's fill toward the next stack: a Marksman never loses Focus
    on a miss, so the design's line would have done nothing), Pebble Storm (a hail on every foe that knocks the reds
    back; one knocked past the far end leaves the bar: knocked back only, every red came again).
H16. **Parity (200 runs x two seed sets, 75%):** Yara -4.5 to +9, Dell -4.5 to +9.5 against Rowan in every act.
H17. **Fizz (Bomber, Legendary):** her kegs are flasks taken in turn from her bandolier: fire (burns every foe, 12% of
    her attack a second for 3 s), frost (every red x0.85 for 1.5 s) and spark (a 25% wider, x1.3 blast). Toss: a green
    throws the next flask at the target (x1.5) and bursts its brew there. Fume Mask: traps hurt half. Grand Reaction:
    every flask on the bar goes off with its brew, then 2 land. The design's stronger brews (half-speed reds for 3 s,
    x1.5 sparks) put her 20-31 points ahead at the Boar King. She keeps 2 flasks after her finisher (Tam's Big Bang
    went to 1 in the parity pass): she measured inside the band with them.
H18. **Brann (Guardian, Epic):** every block rings his bell (Toll: +20% to his next hit, up to 3); Peal (a green: for
    3 s each red he blocks echoes 30% of its owner's attack at every foe); Still Mind (Perfect blocks store 1 more
    Guard). Great Bell hits the target with his Guard and booms on every other foe for 90% (without the boom his fights
    ran 30% longer and he lost far more of Act 6); its stun is 0.5 s and **a boss is never stunned, only its reds
    wait** (a stun cancels the special a boss is telling: the same lesson as Torva's). Stunning Toll follows that rule.
H19. **Parity (200 runs x two seed sets, 75%):** Fizz -4 to +8.5, Brann -7 to +10 (Act 3 at the edge: the Boar King,
    where every hero leads Rowan). A seeded test chest now rolls Fizz (the Legendary pool grew).
H20. **Solenne (Blade, Mythic):** Sunrise (every 15 combo her blade burns for 3 s: hits also cut every other foe for
    50%), Gleam (a green gilds the next yellow: +1 combo and a little meter), Dawn Oath (at 30+ combo a miss keeps half
    the combo; the stacks and meter still go, so a miss is never free), Sunfall (hits every foe, +1% a combo up to +50%,
    clears the reds and gilds the next 2 yellows); her gift, Radiance: while Sunrise burns, reds move at x0.85. The
    design's 25 / 50 combo thresholds were almost never reached at 85%, so 15 / 30; at 75% she ran 27-34 points ahead
    at the bosses until Radiance and Gleam came down. HP 105 (the lab fight and Act 8's paired boss). Rekindle (a skill)
    relights Sunrise only when 6+ combo is lost, or a wild tapper's constant breaks would keep it lit.
H21. **Wren (Shadow, Rare):** Slip (4 Perfects in a row ready a dodge: the next red that reaches her misses), Smoke Pop
    (a green: for 3 s reds that reach her deal 25% less: built as "hits softer", since hiding the reds would only hurt
    the player), Light Feet (her Chain survives one Good hit), Rooftop Drop (hits the target x1.25, then each Chain link
    throws a knife at every foe: a pure single-target finisher ran her multi-foe fights long).
H22. **The hero select's fifth card, "Gift",** shows for any hero with a gift (Solenne and Yara), in a tighter
    five-card row. Parity (200 runs x two seed sets, 75%): Solenne -9 to +8, Wren -8 to +7.5.
H23. **Gorm (Brute, Legendary):** Rockfall (every 4th hit lands heavy, x1.6 on top of Heavy, and nudges the nearest
    travelling red back), Roar (a green: the foes flinch and every red runs at x0.92 for 1 s), Thick Skin (the first
    hit each wave deals 10% less), Landslide (hits every foe, clears the reds, then rubble on the bar's right quarter for
    2 s slows the reds crossing it). HP 85, attack 0.75 of Rowan's.
H24. **Tess (Controller, Epic):** Stopwatch (every 16 hits every red holds still for 0.3 s, icicle fuses wait), Slow
    Time (a green: every red at x0.9 for 1.5 s), Steady Hands (ice and snow change her cursor's speed 75% less), Rewind
    (hits every foe and winds each red back to where it came on). A second soft strength against Fire foes (Rewind keeps
    the reds, which costs her in the third region).
H25. **Why their numbers are small:** at 75%, red control compounds (a held, slowed or pushed red is easier to hit and
    keeps the next red off the bar: only 3 fit), and the first numbers put both about +30 at the Boar King; with every
    kit part off, Gorm was +5 and Tess -12. Any push restarts a red already striking, so Rockfall (and two nodes) skip a
    red at the left end (`onItsWay`); Ear Ringer delays the foes' next attack instead of stunning (a stun cancels a told
    special).
H26. **Parity (200 runs x two seed sets, 75%):** Gorm -7.5 to +8.5; Tess -5.5 to +3 except Act 3 at +13.5, about 10 of
    which is the Controller's shared Bend rule (Neve is +13 there too); style numbers stay untouched (Q1).

## Overnight run, playtest round 8 (the living map: story, art direction, Region 4+, platforms, the first 10 minutes)

Each team logs its calls in its own subsection below (ids: L lead, S story, A art, C content, Q QA, F first 10 minutes).

### Lead (integration)

L1. **Shared files through the lead.** The combat core (`src/core/combat.ts`), the save and profile formats
    (`core/save.ts`, `core/profile.ts`) and `core/tuning.ts` change only in commits titled `CORE: ...`, which the lead
    reviews at merge; teams otherwise keep to the files they own (docs/run-log.md). Screenshot baselines are
    regenerated by the lead after each merge, not by the teams (no binary conflicts).
L2. **One branch, one PR.** The run continues PR #7's branch on `claude/exciting-fermat-9rxtbl`; the final PR
    supersedes #1-#7.

(lead: end of section)


### Team 1: story

(story: end of section)


### Team 2: art direction

(art: end of section)


### Team 3: content

(content: end of section)


### Team 4: QA, polish and platforms

- **Q1 Desktop keys: one key map, two modes** (`src/engine/keys.ts`, unit-tested). In a live fight Space (or J/K)
  taps the bar, judged by the key event's `timeStamp` through the same `barTap` as a pointer (held down on a hold
  block, the key's release lets go); F (or Enter, or Up) fires the finisher; P or Escape pauses. Everywhere else (a
  paused fight too) the arrows and Tab move a focus ring, Enter/Space press, Escape goes back. Enter is the finisher
  in a fight because it is the "big confirm" key; Space stays the tap so a thumb-like rhythm is one key. A mouse click
  is a tap and a mouse drag is the swipe (pointer events already covered both: tested). Ctrl/Alt/Cmd shortcuts are
  left to the browser. Once a tap key has been used, the meter's prompt reads "PRESS F!" instead of "SWIPE!" (a phone
  never sees it).
- **Q2 The focus ring finds a screen's buttons by itself.** Every button the menus draw already asks
  `isPressed(rect)` each frame (to show sunk); once a key has been pressed that also notes the rect
  (`engine/focus.ts`), so every screen (title, world map, act map, pause, camp home and its screens, shops, events,
  the act clear, defeat...) gets keyboard navigation with no per-screen list to keep up. The act map's reachable nodes
  and the world map's landmarks and Rowan's plate are added (drawn without a button). Pressing taps the target's
  centre through the normal tap route. Escape: skips a scene, closes the world map's picker or card, presses a camp
  screen's Back (a sheet open closes first), leaves the camp home, pauses a fight. With no ring up, Enter/Space keep
  their old default (Continue, the first node, begin...). Left for later: Escape on the act map, boost cards and
  shops (they have no "back"), and the hero select's paging by arrows (Tab reaches its arrows).
- **Q3 A quiet desktop frame**: when every margin round the canvas is at least 6 game px (`layout.ts framed`), the
  page gets a dim radial night in the game's own ink/navy and the canvas an ink, navy and dark bevel with a soft
  shadow, sized in game px; never on a phone (the canvas fills it). Integer scaling stays; every resize relayouts
  (already: resize events, a ResizeObserver and the 500 ms watch); the spec resizes 1440x900 -> 1100x700 -> back.
- **Q4 Clean capture** (`cq3.cleanCapture` in `storage.ts`): the gear panel's Modes row or C hides the whole HUD
  (pause, gear, the lab's Done) and the title's Test lab button. The way back is a long press (0.8 s) where the gear
  sits (top middle), or C. Kept across launches; a toast says how to undo it.
- **Q5 Performance first: stop painting twice** (docs/perf.md, `tests/perf/perf.mjs` run by hand: CPU 4x, Fast 4G).
  The load is CPU (painting every texture at boot), not download. `main.ts` forced a second full repaint when
  Phaser said READY, after the scene had laid itself out (the title froze ~2 s before answering); and any change of
  the canvas's place (each step of a desktop window resize) repainted everything (1.2-1.4 s a step). Now READY only
  places the canvas, and `app.relayout` rebuilds the scene only when the safe areas change (`sameGameLayout`). Title
  ready 12.1 s -> 7.8 s, first fight 18.6 s -> 14.3 s, a resize settles in 28 ms instead of 1.3 s. Phaser is its own
  chunk (unchanged between deploys: a new build re-downloads only the game's 753 KB gzip, not 1.1 MB). Lazy boot
  painting and atlases are the next big wins but sit in the art files: proposed in docs/perf.md, not done.
(qa: end of section)


### Team 5: the first 10 minutes

(first10: end of section)
