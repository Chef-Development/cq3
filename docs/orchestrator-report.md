# Combo Quest 3: status report (M3a, Region 1 "Greenmarch", plus playtest round 1)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/eloquent-cannon-tc28lq`, PR Chef-Development/cq3#2 into `main`. PR #2 had not been merged when
  M3a started, so M3a was built on the same branch: merging #2 brings in M1, the impact pass and M3a together.
- **Phone tuning:** the task said "make the tuning from the phone the defaults", but no JSON was pasted (the
  placeholder was still there). The defaults are the bot-balanced numbers below. Paste the JSON from "Copy tuning
  as JSON" and it can be applied in minutes.
- **Tests:** 207 Vitest unit tests (`npm test`, in CI), 3 Playwright smoke tests (intro, map, fight, every enemy's
  specials in the real game, reload), 5 pixel-exact screenshot tests (baselines refreshed after the visual pass).

## Playtest round 1 (after M3a)

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

## What M3a adds

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

## Balance (1,000 whole runs per player, random node choices; full report in docs/balance.md)

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

## Still unverified on the iPhone (everything was checked in headless Chromium and Node)

- Whether each telegraph reads at a glance mid-combo, and is long enough (0.6-1.0 s) without dragging. All are
  sliders.
- The Hedge Knight's guard (yellows countered): fair, or too punishing?
- The Stomp's 0.5 s cursor freeze: does it feel like a mechanic or a lag spike?
- The new difficulty: is Act 1 now relaxing, and do Acts 2-3 still ask something? Are 10+ foe fights in Act 3 too
  long? Is the foe counter readable?
- The act map and the world map on the phone: node icons, labels and tap targets at 8x; and the pace of fight,
  map, fight. The new HUD at 8x, the screen wipes (too quick or too slow?), and the ambience/music balance on the
  phone speaker.
- Story text size (the small font) and the typing speed.
- The new sounds and the map theme on the phone speaker.

## Known gaps and suggested next steps

1. **Playtest Act 1 end to end**, then tune telegraph lengths and special intervals in the panel and send back
   "Copy tuning as JSON".
2. Gear, camp and the gacha were left out on purpose (see docs/backlog.md).
3. **Events:** 6 for now, and they repeat across acts; more would add variety.
4. The Clockless King and the other 11 weights are setup for later regions (the Frostpeaks is teased).
