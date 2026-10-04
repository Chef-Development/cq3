# Combo Quest 3: status report (M3a, Region 1 "Greenmarch", plus playtest round 1)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/eloquent-cannon-tc28lq`, PR Chef-Development/cq3#2 into `main`. PR #2 had not been merged when
  M3a started, so M3a was built on the same branch: merging #2 brings in M1, the impact pass and M3a together.
- **Phone tuning:** the task said "make the tuning from the phone the defaults", but no JSON was pasted (the
  placeholder was still there). The defaults are the bot-balanced numbers below. Paste the JSON from "Copy tuning
  as JSON" and it can be applied in minutes.
- **Tests:** 188 Vitest unit tests (`npm test`, in CI), 3 Playwright smoke tests (intro, map, fight, every enemy's
  specials in the real game, reload), 5 pixel-exact screenshot tests.

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
5. **Livelier maps:** see "Kingdom world map" and the act map below.

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

After playtest round 1 the bot plays like a person (see above), so these are a player's odds, not a machine's.

| Player (timing spread) | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 55% (83 ms) | 85% | 49% | 18% | 18% |
| 70% (60 ms) | 96% | 76% | 37% | 37% |
| **85% (42 ms)** | **100%** | **92%** | 62% | **62%** |
| 95% (28 ms) | 100% | 99% | 89% | 89% |

- **Targets:** Act 1 is a gentle start for everyone; Act 2 is a step up (80-90% first try for an 85% player); the
  Boar King wins about 35-50% of first fights against an 85% player. With retries, 98% clear Act 3.
- **No boss can be one-shot:** the Bandit Captain's call for help and the Ruin Golem's new Fortify are half-HP
  phase gates (like the Boar King's phases), so a max-stack finisher stops at 50%.
- **Fight length (85% player):** Act 1 normal fights about 8 s, elites 20 s, the Bandit Captain 35 s; Act 2 13 / 21 /
  61 s; Act 3 10 / 14 s and the Boar King about 64 s.
- **Where runs end:** almost only at the Boar King; in Act 2 at the elites and the Golem.
- **Numbers:** Act 1 enemies have about 40% of their M3a HP and lower attack (Slime 200, Crow 170, Boar 280, Bandit 360,
  elites 700-750, Captain 1,800; attack 7-15). Acts scale HP x1 / x2.5 / x3 and attack x1 / x1.7 / x2.3, with +4% enemy
  HP per map row. Kill growth, boosts, shop prices and healing are unchanged from M3a.

## Still unverified on the iPhone (everything was checked in headless Chromium and Node)

- Whether each telegraph reads at a glance mid-combo, and is long enough (0.6-1.0 s) without dragging. All are
  sliders.
- The Hedge Knight's guard (yellows countered): fair, or too punishing?
- The Stomp's 0.5 s cursor freeze: does it feel like a mechanic or a lag spike?
- The act map and the world map on the phone: node icons, labels and tap targets at 8x; and the pace of fight,
  map, fight.
- Story text size (the small font) and the typing speed.
- The new sounds and the map theme on the phone speaker.

## Known gaps and suggested next steps

1. **Playtest Act 1 end to end**, then tune telegraph lengths and special intervals in the panel and send back
   "Copy tuning as JSON".
2. Gear, camp and the gacha were left out on purpose (see docs/backlog.md).
3. **Events:** 6 for now, and they repeat across acts; more would add variety.
4. The Clockless King and the other 11 weights are setup for later regions (the Frostpeaks is teased).
