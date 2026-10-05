# Combo Quest 3: status report (M3b: the camp, gear and the forge, Region 1)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/vigilant-pasteur-vlnd12`. PR Chef-Development/cq3#2 (M1 + M3a) was still open, so M3b is built on
  top of it: the new PR includes #2 and supersedes it (merge the new one; #2 can be closed).
- **Tests:** 272 Vitest unit tests (`npm test`, in CI), 4 Playwright smoke tests (now including the whole gear flow:
  loot after a win, act clear -> camp -> next act, defeat -> camp -> retry, the act picker), 8 pixel-exact screenshot
  tests (new: camp, bag, forge, the Legendary loot card, the act picker; world and map baselines refreshed).
- **Built by:** a core pass (pure TypeScript, tested), then four parallel agents for the art, the camp UI, the loot
  reveal / effects / sounds, and the menus / map / accuracy panel, merged and checked together.

## Playtester notes from Act 1 (applied first)

1. **"Is there a point to choosing a path? No reward or risk."** Nodes now differ in what they give, and the map says
   so. Under every node you can reach next there is a reward chip: Fight "50% gear", Elite "Gear+" (always an Uncommon
   or better item; shown in red with a skull: they're the risk), Treasure "Gear x1-2", Rest "+30% HP", Shop "Spend
   coins", Event "Risky", Boss "Gear x2 + signature" (x3 for the Boar King). Fights still show their foe count.
2. **"Upgrades don't seem to do much visually; hard to gauge what an upgrade did."**
   - Boost cards (and shop cards) show the real stat before and after: "ATK 14 -> 16", "Crit 9% -> 14%",
     "Max HP 120 -> 140", "Pip 6 -> 18", computed from Rowan's actual stats (gear included).
   - The fight HUD reads the real stats; any gain pulses with "+N" as the next fight starts (stats the plate doesn't
     show, like Defense or Luck, float up under it).
   - Gear is visible on Rowan: an Uncommon+ weapon colours his slashes and adds a glint to the blade; Legendary or
     Mythic gear gives him a faint glowing outline and rising motes (gold while the Tusk Crown's buff is up).
   - Every gear effect announces itself briefly in fights ("Saved!", "Powder Monkey!", "+1" hearts...).
   - At the camp, equipping shows each stat before -> after, and coming back to the fire in better gear pops
     "Gear power +N!".

## What M3b adds

### 0. Accuracy readout (gear panel and every act-clear screen)
- Measured with the balance bot's own definition: the share of plain yellow blocks the player would hit at the
  starting cursor speed. Every tap aimed at an isolated yellow (no other block or wall turn within 150 ms) gives a
  timing error; the median and spread of the recent ones are mapped through a calibration made by running bots of
  known accuracy (`npm run calibrate`), then the bot's formula gives the number. A unit test plays 55%, 70% and 85%
  bots and checks they read back within 4 points.
- **Gear panel > "Your accuracy"** (top, open by default): the number, "from N recent taps · timing spread ±S ms ·
  T ms late/early on average", a meter with the "tuned for 70%" mark, the history (one entry per act cleared) and a
  Copy button that copies a one-line summary to send back.
- **Act clear:** "Accuracy this act: 74% (212 taps)".
- **Retargeting:** the curve is set for `TYPICAL_ACCURACY = 0.7` (`src/core/bot.ts`). `ACC=0.62 npm run retarget`
  searches one multiplier per act (enemy HP and attack) so a player of that accuracy gets the same curve (Act 1
  ~99% first try, Act 2 ~87%, the Boar King ~70% of first fights), and writes docs/retarget.md with the numbers and a
  JSON snippet to paste into the gear panel. Not retuned yet: waiting for the playtester's number.

### 1. Stats (10)
HP, Attack, Defense (unblocked reds and bombs deal x100/(100+DEF)), Crit chance, Crit damage, Combo power (finisher),
Meter gain, Steady (slows how fast the cursor speeds up with combo, capped at 75%), Luck (shifts drop rarity toward the
rare end and adds coins), Companion power (Pip's pecks). The stats screen (tap Rowan at the camp, or Stats) shows HP,
Attack, Defense and Crit big, with how much comes from gear; "All stats" lists all 10 with what each does and where it
comes from (base, this run, gear).

### 2. Gear
- **6 slots:** weapon, helm, armor, boots, 2 trinkets. **6 rarities** with frame colours: Common grey, Uncommon green,
  Rare blue, Epic purple, Legendary orange, Mythic red; 0/1/2/3/3/4 bonus stats; Legendary and Mythic add a unique
  effect.
- **Base stats per slot:** weapon Attack; helm HP (+ a little Defense or Luck); armor HP + Defense; boots Defense +
  Steady; each trinket leans on one stat. Bonus stats roll from the 10 (never the item's own base stat), in ranges
  scaled by item level and rarity. Item level comes from the act: Act 1 items Lv 1-5, Act 2 Lv 10-14, Act 3 Lv 20-24.
- **28 base items** with original names and painted icons (e.g. Squire Shortsword, Hedge Saber, Thornspear, Iron Pot
  Helm, Plumed Hat, Bramble Cuirass, Marsh Waders, Owl-feather Charm, Cog Brooch, Footpad's Loaded Die).
- **Signature drops** (bad-luck protection: 20% on a kill, +10% for every kill without it, so at most 9 kills):
  - Bandit Captain: **Captain's Cutlass** (Legendary weapon): bombs you tap always crit.
  - Ruin Golem: **Golemheart Plate** (Legendary armor): blocking a red heals 1 HP.
  - Boar King: **Tusk Crown** (Legendary helm): each finisher stack spent gives +5% crit for 5 s.
  - Boar King, rare: **Pendulum Shard** (Mythic trinket; 5%, +3% per miss): every 10th combo hit spawns a green block.
  - Other Legendaries and Mythics roll one of six effects: Opening Blow (first hit on each foe crits), Leech (crits
    heal 2), Riposte (a blocked red hits back for half your attack), Golden Touch (+50% coins), Owl Eye (Pip pecks every
    3 hits), Second Wind (once a fight, under 30% HP heals 20%).
- **Sets:** Greenwarden (hood, mail, treads, sprig): 2-piece +10% max HP; 4-piece rests heal 50% and kills heal 3%.
  Footpad (shiv + loaded die): 2-piece, your first miss each fight doesn't break the combo (or hurt). Set pieces drop
  at Rare or Epic.
- **Drops** (all in tuning, with sliders): a fight 50% one item, an elite always one (Uncommon+), treasure 1-2, a
  mini-boss 2 + its signature roll, the Boar King 3 + his signature rolls. Rarity weights 55/28/12/4/0.9/0.1, shifted
  by Luck.
- **Loot feel:** after the last foe falls a ball of light swells where it died (crackling in the best item's colour
  when an Epic or better is inside); the items arc out one by one, rarest last, and land in a row under pillars of
  light in their rarity's colour (sparkles from Rare, rays from Epic, red embers and a screen pulse for Mythic), with
  NEW badges and a green arrow when one beats what Rowan wears. Epic and up play a sting. Legendary and Mythic stop for
  a full-screen reveal card (rays, the icon at 2x in an ornate frame, rarity ribbon, stats, the effect, "Signature
  drop!") with its own fanfare. On continue the items fly into Rowan's portrait.
- **Kept when you die.** Cleared acts can be replayed for drops: tapping Greenmarch on the world map opens an act
  picker (cleared acts say "Replay (farm)", the next one "Continue the story"; each row shows its gear level and the
  boss's signature drops, ticked when you own them). A replayed act starts Rowan with the boosts a run typically has
  by then (measured with the bot, `tuning.kit`) plus his gear. Signature drops only come from their own boss.

### 3. The camp
- **Reachable** from the world map (a Camp button), from every act-clear screen (Camp / Next: Act N+1) and from the
  defeat screen (Camp / Retry the act, so new loot can be equipped before a retry). Back returns where you came from.
- **Camp home:** a night clearing: Rowan and Pip on a log by the campfire, the bag tent, the forge with Mags, and the
  locked shrine; coins and scrap counters; tap a building or the buttons on the band.
- **Bag:** 60-cell grid with rarity frames (Rare+ glow, Epic+ shimmer; worn, new, locked and +N marks), the six worn
  slots, sort (Rarity / Slot / New), a compare card (name in rarity colour, kind, power and its change, "vs" the worn
  item, each stat as a green/red delta, stats you'd lose, the effect, the set and pieces worn), one-tap Equip, Lock.
  A full bag salvages new drops into scrap (and says so).
- **Forge,** run by **Mags**, an original badger blacksmith with goggles and a soot-black apron, with a short intro
  scene on the first visit. Upgrade +1 to +10 (each level +8% base stat; scrap + coins, x1.35 per level and more for
  rarer items; "+3 -> +4", every stat before -> after, two hammer blows with sparks); Reroll one bonus stat (40
  coins, doubling per reroll on that item; a slot-machine flicker, then was/now); Salvage (confirm tap); Salvage all
  Common/Uncommon (skips locked and worn items; shows count and scrap first).
- **Shrine:** locked: the padlock rattles, "The Shrine: coming soon!".
- **Coins carry over between runs** (the purse lives in the profile) and are spent at act shops and the forge.

### 4. Sound
Loot drops climbing with rarity, Epic+ stings, Legendary and Mythic reveal fanfares, the forge hammer and upgrade,
salvage, equip, lock, reroll, gear-effect cues, and a campfire-and-crickets ambience at the camp. All in the Sound lab.

### 5. Saves
- **Profile** (`cq3.profile.v2`): progress, bag, equipped gear, coins, scrap, the signature drops' bad-luck counters,
  the accuracy log, whether Mags was met. The old progress save (v1) is migrated (acts cleared and weights kept).
- **Run save v5:** a v4 save from the last build is migrated (its coins move into the purse), so a run in progress
  survives the update. The loot screen and the act's timing samples are saved too.
- Tests cover drop rolls (rarity weights and Luck, per-node counts, signatures only from their boss), bad-luck
  protection (odds rise per miss, reset on a drop, guaranteed within 9 kills), stat math (base/bonus scaling, all 10
  stats in a fight, Defense, Steady, sets and every unique effect), forge costs (upgrade, reroll doubling, salvage
  value, refusals) and the migrations (v1 profile, v4 run save, storage writes once).

## Balance (docs/balance.md: 1,000 whole runs per player; farming 333 players per row)

The bot now wears the best gear it finds. Found gear made a first playthrough much easier (the Boar King's first fight
went from 71% to 96% won for a typical player), so to keep the curve the playtester liked: gear stats were set to
0.8x the first draft, and Acts 2 and 3 hit harder and have more HP (x1.15 and x1.35). Not a retarget: same targets,
same typical player.

| Player | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 55% | 97% | 60% | 41% | 44% |
| **70%** | **100%** | **85%** | 65% | **67%** |
| 85% | 100% | 97% | 92% | 92% |
| 95% | 100% | 100% | 99% | 99% |

- **The story can be beaten with found gear alone:** 99% of typical (70%) players clear Act 3 within 6 tries (90% of
  55% players).
- **Farming the Boar King measurably raises the win rate** (each replay of Act 3 keeps all gear):

  | Player | Story (found gear) | Replay 1 | Replay 2 | Replay 3 | Replay 6 |
  |---|---|---|---|---|---|
  | 55% | 42% | 67% | 73% | 84% | 90% |
  | **70%** | **70%** | **85%** | **91%** | **95%** | **97%** |
  | 85% | 93% | 98% | 98% | 100% | 99% |

  Gear power (the bag's rating) roughly doubles over six replays (about 400 -> 750). Letting the bot also use the
  forge between replays adds only a few points (it spends most coins at shops).
- Fight lengths are unchanged (normal fights 17 / 25 / 22 s, bosses 39 / 56 / 60 s for a 70% player); no boss can be
  one-shot.

## Still unverified on the iPhone (checked in headless Chromium and Node)

- Loot feel at 8x on the phone: the beam/reveal timings, whether the full-screen card is too long or too short.
- The camp screens at 8x: grid cell size (14 px), the compare card's text size, tap targets in the forge.
- The map reward chips: on the very first screen (three stacked fights) they partly cover the next row's nodes.
- The accuracy number on a real player: it is calibrated against the bot; humans might differ a little (the panel
  shows the raw timing spread and lateness too, so it can be cross-checked).
- Whether the Defense/Steady/Meter gains feel noticeable in fights.

## Known gaps and suggested next steps

1. **Report the accuracy number** (gear panel > Your accuracy > Copy). Then `ACC=<number> npm run retarget` gives the
   act numbers for that player.
2. **The shrine (gacha)** is the next meta feature (locked at the camp). Other backlog items: docs/backlog.md.
3. The bot spends little at the forge; if upgrades should matter more for farming, lower forge prices
   (`tuning.forge`) or raise `forge.upgradeStep`.
4. Small HP upgrades round away until they cross a whole HP (the forge shows one decimal so it visibly moves).

## History

### Playtest round 1 (after M3a)

The playtester: "level one can't have a 700 hp boar, and the attacks it throws are way too hard"; the Crow's wave of
3 thin, fast reds was "almost a guaranteed hit" (one crossing, a tiny window); "you calibrated it for a machine, not
for a player"; and the world map and act map should be "a lot more lively".

1. **The bot now plays like a person.** It used to land a fixed share of taps inside any block, however thin or fast,
   so it couldn't feel what the playtester felt. Now each tap is aimed at the moment the cursor crosses the block's
   center with a human timing error in milliseconds (a normal spread set by the player's accuracy, plus 3% lapses),
   a 250 ms reaction time for blocks that pop up, and a thumb's tap rate (140 ms); the real judge decides what the
   tap hits. Re-measured with it, M3a's Act 1 was 45% first try for an 85% player (not the 75% reported before).
2. **Fairer judging:** the grace window is now a time window at the speed the cursor and the block close at, and
   blocking reds gets 40 ms a side (attacking yellows keep 20 ms, so they stay sharp). New slider: Red grace.
3. **Fair red waves:** reds are never thinner than normal, fast ones are wider, and reds in a wave are spaced so the
   cursor meets them one at a time (a data test checks every formation at 1.5x cursor speed). Crow Dive: 3 wide reds
   0.75 s apart at 1.2x (was 3 thin ones 0.22 s apart at 1.7x). Boar Charge: 1.4x and wider (was 2x). The wolves'
   Howl and the Boar King's double charge now come one after the other; the archer's volley is spread wider.
4. **Easier Act 1, gentler ramp:** see the balance section.
5. **Taps clear attacks first** (playtester request): a red, shield, bomb or speed block under the cursor always takes
   the tap, even over a nearer yellow or a trap.
6. **Fights are runs of foes** (playtester request: "multiple enemies in a row, like enemy 3/11, scaling the further
   in the act you are"). A fight node holds waves from the act's pools, one after another: Act 1 has 2 waves in the
   first row up to 4 before the boss, Act 2 3-5, Act 3 3-6 (a wave is one pool group, so later fights can be 10+
   foes). An elite comes after 1-2 escort waves; the boss fights alone. The next wave walks in 1.2 s after one falls
   (fliers drop in). The HUD shows a foe counter (skulls up to 8, "Foe 3/11" beyond), and the act map labels the
   nodes ("Fight x3"). Mid-fight saves keep the wave (save v4). Per-enemy HP, coins and kill growth were lowered to
   fit, kills heal 1%, and each act has a pace (spawn interval x1.1 / x0.85 / x0.75).
7. **Livelier maps:**
   - *World map:* animated sea, ships, a whale and fish, gulls, cloud shadows, a smoking volcano, snow, mist, a
     turning windmill, sheep and a cart. Rowan waits at Greenmarch under a "Tap to begin!" plate, with Pip once
     they've met. The Pendulum swings wider as weights come home. Tapping a region or the capital shows its plate.
   - *Act map:* a painted landscape per act (sunny meadow with a stream and windmill; mossy ruins at dusk; an
     autumn hollow at sunset) with real roads, worn boot-printed paths and shimmering next roads. Each fight node
     shows its enemy, plus campfires, chests, a market stall, a pulsing "?" and a lair per boss. Rowan walks the
     road with Pip and footsteps.
8. **"More modern, less light and empty"** (playtester): the palette was all bright mid-tones with nothing dark to
   anchor it, the fighters stood small in an empty strip, the HUD was bare numbers floating over the art, little
   moved, and there was silence between hits. Changes:
   - *Fight stage:* per-act lighting (warm sun, cool moon and rain, low sunset), vignette and darker ground,
     light pools and flickering torches, drifting mist, a dark swaying foreground frame, contact shadows and rim
     light on every fighter, ambient life, dust, sparks and rubble on hits.
   - *UI:* navy panels with bevels and gold trim, chunky HP gauges with a damage ghost, a hero portrait plate, a
     combo counter, a finisher strip with stack gems, a new title (big Rowan and Pip, chrome logo), restyled boost,
     node, story and result screens, and a quick wipe or iris between screens.
   - *Sound:* fuller music (sub bass, pads, a real drum kit, stereo echo and reverb, ducking under the kick) at the
     same peak level, and a seeded ambience bed for every place (birds and wind, rain and drips, crickets and
     torches, sea and gulls). New UI sounds: whoosh, panel, coin tick, footsteps.
9. **New home-screen icon:** a close-up of Rowan with his sword and a "3" badge (re-add the shortcut to see it).
10. **Saved tuning reset once:** the tuning key moved to v3, so changes saved against the old numbers are dropped and
    the new defaults reach the phone.

### What M3a adds

1. **Content is data** (`src/data/`): `enemies.ts` (stats, a base pattern and 0-2 special moves each),
   `greenmarch.ts` (acts, encounters, map weights), `events.ts`, `story.ts`. `tuning.ts` pulls a live copy of the
   enemies and act scaling in, so every enemy number (and each special's telegraph time, interval and HP trigger)
   has a slider.
2. **Special moves** (`src/core/specials.ts`): a telegraph (the enemy's own wind-up pose, its name over its head,
   a countdown ring, a "!", its own sound, 0.6-1.0 s; for red attacks the bar also shows blinking outlines where
   they will land) then actions. The actions are reusable and data-driven: **formation** (any blocks, at a spot,
   beside yellows, delayed, faster, wider, in pairs), **heal**, **shell** (self or an ally), **summon**, **split**,
   **cursor** (freeze it, or floor its speed), **guard**, **phase**, **protect**. One telegraph at a time, so each
   can be read. Every action has unit tests (34 in `tests/unit/specials.test.ts`).
3. **Region structure** (`src/core/map.ts`, `run.ts`): 3 acts, each a branching map 8 rows deep (2-3 nodes per row,
   links never cross, most nodes offer two ways on). Node types: fight, elite, treasure, rest (heals 30%), shop
   (boost cards, a potion, a reroll of the next 1-of-3 pick), event (a short text choice with a small risk or
   reward), and the boss. The first row is fights, the row before the boss always has a rest, and every type
   appears at least once per act.
   - Acts 1 and 2 end in a mini-boss, Act 3 in the Boar King.
   - **Save at every node** (save v3; saves from the level builds are dropped). A mid-fight save resumes with
     the summons, boss phase and used specials.
   - **Dying** sends you to the act's start with the hero and coins as you entered it, on the same map. There is
     one revive per act.
   - Rewards: a boost pick after every fight (elites and bosses guarantee a rare). Kills still add a little attack
     and max HP, and coins buy things in shops.
4. **The enemies** (each one changes how the bar plays):

   | Enemy | Special(s) | What it does to the bar |
   |---|---|---|
   | Slime | Split | Once below 50% HP, it splits into 2 Slimelets (a big enough hit kills it first) |
   | Boar | Charge | Paws the ground, then one wide red at 1.4x speed |
   | Bandit | Smoke | 2 purple traps right beside yellow blocks |
   | Crow (flies) | Dive | 3 wide reds, one after another, a little faster than usual |
   | Goblin Archer | Volley | 3 reds at once across the bar's right side |
   | Mushroom Shaman | Spores | Pink heal blocks: tap them, or it and its allies heal |
   | Shell Beetle | Shell Up | Your hits deal 50% until you break its 2 teal shell blocks |
   | Wolf (pairs) | Howl | A red from each wolf, one right after the other |
   | Big Slime (elite) | Split + Spores | Splits into 2 Slimes; spreads spores |
   | Hedge Knight (elite) | Guard | Shield up 2 s: tapping yellow is countered like a trap (yellows get a shield mark) |
   | Bandit Captain (Act 1) | Bombs, Call | Throws bomb pairs; at 50% HP calls 2 Bandits (damage can't skip it) |
   | Ruin Golem (Act 2) | Wall of Stone, Stomp, Fortify | A huge 3-tap shield block; Stomp (foot raised) freezes the cursor 0.5 s; at 50% HP Fortify: half damage until 2 plate blocks break |
   | Boar King (Act 3) | 3 phases | P1 frequent Charges. P2 (66%): 2 Piglets, he takes half damage while they live. P3 (33%): enraged, cursor never below 1.2x, Charges two at a time. A short scene at each change; damage can't skip a phase |

5. **Story**: portrait + text box, the text types out, tap to finish or advance, Skip, 6 boxes max, 2 lines each.
   Scenes: intro (the Great Pendulum, the Clockless King, Rowan asleep on watch), Act 1 (Pip: "I'm not a pet.
   I'm a consultant."), Bandit Captain (fake pendulum pieces), Act 2, Ruin Golem (guarding for a king 300 years
   dead), Act 3, Boar King (wears the first weight as a crown), his two phase changes, victory (the Pendulum ticks
   once; next stop, the Frostpeaks).
6. **Art and audio** (all original, following docs/art-style.md):
   - sprites for the 11 new enemies with idle, attack, hurt, death and telegraph poses (plus the knight's raised
     shield and the beetle's closed shell), and telegraph poses for the 4 old enemies;
   - the Act 3 backdrop (a sunset autumn hollow around the Boar King's den tree, with torches, leaves and
     fireflies);
   - the map screen (a parchment chart on a wooden board, node icons, Rowan's helmet marker);
   - portraits for Rowan, Pip, the Bandit Captain, the Ruin Golem, the Boar King (the brass pendulum weight in his
     crown), and the Great Pendulum for the narrator;
   - a map theme; a distinct telegraph sound for every special (16); sounds for the stomp, freeze, guard counter,
     shell breaks, spores, split, summons, map, shop, rest, events, dialogue and a victory fanfare. They are all
     in the Sound lab, and the audio tests check their levels.
7. **Kingdom world map** (from the playtester's screenshot of the reference's main map; our own version): a painted
   island kingdom between runs. Greenmarch is playable; four other regions (the Frostpeaks, Ashfell, Duskmire and
   Noonspire) sit behind padlocks, and tapping one rattles its padlock. The Great Pendulum's clock tower stands in
   the capital. A flag is planted on Greenmarch for each act cleared, and a "Weights home: x/12" counter tracks
   the pendulum weights recovered. This progress is kept across runs (`core/progress.ts`).
   - Flow: New run → world map → Greenmarch → intro → Act 1. After the victory you return to the map.
   - The reference's kingdom level, currencies, timed rewards and upgrade/chest/loadout/shop buttons stay in
     docs/backlog.md (gear, camp and gacha come later).
8. **Debug panel**: "Jump to" any act's map, or straight into a fight with any enemy, carrying a typical hero for
   that act. The Sound lab plays all three themes.

### Balance after playtest round 1 (before gear; superseded by the numbers above)

The bot plays like a person (see above). Targets are set for a **typical player (70%)**: that player hits 70% of plain
yellow blocks at the starting speed (a 60 ms timing spread).

| Player (timing spread) | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 55% (83 ms) | 95% | 52% | 40% | 43% |
| **70% (60 ms)** | **100%** | **85%** | 69% | **70%** |
| 85% (42 ms) | 100% | 98% | 93% | 93% |
| 95% (28 ms) | 100% | 100% | 100% | 100% |

- **Act 1 is a gentle start** for everyone; Act 2 is a step up; the Boar King is the real test. With retries, 97% of
  typical players clear Act 3.
- **No boss can be one-shot:** the Bandit Captain's call for help, the Ruin Golem's new Fortify (half damage until two
  plate blocks break) and the Boar King's phases are half-HP gates a finisher can't skip.
- **Fight length (70% player):** normal fights 17 / 26 / 22 s (2-6 waves), elites 33 / 28 / 22 s, bosses 41 / 58 / 58 s.
- **Skilled players breeze through** (85%: 100 / 98 / 93%). Taps clearing attacks first made defence much easier, so
  later acts hit harder per hit (attack x1 / x4 / x6.6) rather than sending more thin reds. If the playtester wants
  more challenge, `acts[i].atkMult` and `acts[i].pace` are the sliders to try first.
- **Numbers:** Act 1 enemies 90-190 HP (Slime 110, Crow 90, Boar 150, Bandit 190), elites 700-750, Captain 1,800;
  acts scale HP x1 / x1.8 / x2.3, +4% enemy HP per map row.
