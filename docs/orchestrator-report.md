# Combo Quest 3: status report (M3a, Region 1 "Greenmarch")

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/eloquent-cannon-tc28lq`, PR Chef-Development/cq3#2 into `main`. PR #2 had not been merged when
  M3a started, so M3a was built on the same branch: merging #2 brings in M1, the impact pass and M3a together.
- **Phone tuning:** the task said "make the tuning from the phone the defaults", but no JSON was pasted (the
  placeholder was still there). The defaults are the bot-balanced numbers below. Paste the JSON from "Copy tuning
  as JSON" and it can be applied in minutes.
- **Tests:** 185 Vitest unit tests (`npm test`, in CI), 3 Playwright smoke tests, 6 pixel-exact screenshot tests.

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
   | Boar | Charge | Paws the ground, then one red at 2x speed |
   | Bandit | Smoke | 2 purple traps right beside yellow blocks |
   | Crow (flies) | Dive | 3 small fast reds in quick succession |
   | Goblin Archer | Volley | 3 reds at once across the right half |
   | Mushroom Shaman | Spores | Pink heal blocks: tap them, or it and its allies heal |
   | Shell Beetle | Shell Up | Your hits deal 50% until you break its 2 teal shell blocks |
   | Wolf (pairs) | Howl | Both wolves' next reds arrive together, back to back |
   | Big Slime (elite) | Split + Spores | Splits into 2 Slimes; spreads spores |
   | Hedge Knight (elite) | Guard | Shield up 2 s: tapping yellow is countered like a trap (yellows get a shield mark) |
   | Bandit Captain (Act 1) | Bombs, Call | Throws bomb pairs; at 50% HP calls 2 Bandits |
   | Ruin Golem (Act 2) | Wall of Stone, Stomp | A huge 3-tap shield block; Stomp (foot raised) freezes the cursor 0.5 s |
   | Boar King (Act 3) | 3 phases | P1 frequent Charges. P2 (66%): 2 Piglets, he takes half damage while they live. P3 (33%): enraged, cursor never below 1.2x, Charges in pairs. A short scene at each change; damage can't skip a phase |

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
7. **Debug panel**: "Jump to" any act's map, or straight into a fight with any enemy, carrying a typical hero for
   that act. The Sound lab plays all three themes.

## Balance (1,000 whole runs per accuracy, random node choices; full report in docs/balance.md)

| Player | Act 1 first try | Act 2 first try | Act 3 first try | Boar King first fight won |
|---|---|---|---|---|
| 70% | 23% | 58% | 32% | 34% |
| **85%** | **75%** | **82%** | 56% | **56%** |
| 95% | 95% | 94% | 80% | 81% |

- **Targets met for an 85% player:** acts 1 and 2 land in 70-85%, and the Boar King in 40-60%. Act 3's first-try
  clear can't be higher than the boss's, so it sits at 56%. With retries, 94% clear Act 3.
- **Bosses:** each has 2.8-3.8x the HP of one max-stack finisher; none was ever one-shot.
- **Fight length (85% player):** normal fights 12-14 s, elites 18-31 s, the mini-bosses 49-55 s, the Boar King
  about 61 s.
- **Where runs end:** in Act 1 it's mostly the elites (the hero has few upgrades yet); in Act 3 it's the Boar King.
- **Changed numbers:**
  - kills heal 5% (was 20%), so HP carries from node to node and rests matter;
  - kill growth is +0.5 attack and +2 max HP (was +1 and +5), because an act has many kills;
  - enemy HP is about 1.5x the old Level 1 values;
  - acts scale HP x1 / x1.5 / x2.1 and attack x1 / x1.25 / x1.5, with +4% enemy HP per map row.
- **70% players** need about 2-3 tries per act. This is by design: the playtester asked for a challenge.

## Still unverified on the iPhone (everything was checked in headless Chromium and Node)

- Whether each telegraph reads at a glance mid-combo, and is long enough (0.6-1.0 s) without dragging. All are
  sliders.
- The Hedge Knight's guard (yellows countered): fair, or too punishing?
- The Stomp's 0.5 s cursor freeze: does it feel like a mechanic or a lag spike?
- The map on the phone: node icons and tap targets at 8x; and the pace of fight, map, fight.
- Story text size (the small font) and the typing speed.
- The new sounds and the map theme on the phone speaker.

## Known gaps and suggested next steps

1. **Playtest Act 1 end to end**, then tune telegraph lengths and special intervals in the panel and send back
   "Copy tuning as JSON".
2. Gear, camp and the gacha were left out on purpose (see docs/backlog.md).
3. **Events:** 6 for now, and they repeat across acts; more would add variety.
4. The Clockless King and the other 11 weights are setup for later regions (the Frostpeaks is teased).
