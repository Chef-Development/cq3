# Anti-spam balance (playtest round 7)

The playtester: "Late fights become 'spam, spam, finisher x5, spam': the bar is so full of blocks that any tap hits
something, and misses don't matter because healing (especially relic combos) undoes them." Their lab readout measured
70% accuracy (223 taps) where they guessed 80-90%, so the curve is now set for a **75% player**.

Everything below is Rowan, the same seeds before and after (`npm run spam`: the whole campaign from a fresh profile,
three regions, 150 runs per accuracy; `tests/balance/spam.run.ts`). "Before" is build 678177c (round 6's numbers, set
for an 85% player); "after" is this branch (the rules below, and the acts re-aimed at 75%). A region's rows count only
the runs that got there. Sampling noise at 150 runs: about +/-4 points on a first-try rate.

## The rules (core/combat.ts; numbers in `tuning.spam` and `tuning.judge`, sliders under "Anti-spam" and "Judgment")

| Rule | Number | What it does |
|---|---|---|
| Crowding limit | `spam.cover` 0.45 | Blocks may cover at most 45% of the bar (every block's width counted, reds and holds too). A foe's static (yellow, green, trap...) that doesn't fit isn't sent, and its pattern goes on at its normal pace (no quick skip to the next entry, so reds don't come faster). Reds always come (they can push the bar past the limit for a moment), and so do specials' formations (the tricky blocks) and the hero's own blocks (Starlight, a Seedling, Pendulum greens). A bar with no yellow or green left always takes one (the refill). |
| Each stack costs more | `spam.stackStep` 0.32 | Stack 1 costs a full meter, each next one 32% more: 6 / 8 / 10 / 12 / 14 plain hits. The meter still shows 0..1 toward the next stack (the HUD reads it as before; it fills slower). Stacks a perk banks (Charged Up, Twin Fang, the lab) are whole stacks. |
| Meter Gain diminishing | `spam.meterKnee` 0.25, `meterSoft` 0.5 | Meter Gain (gear and skills) counts in full up to +25%, then less and less, never past +75% in all. |
| Meter relics stack | `spam.meterStack` 0.33 | The first relic that adds meter in a fight counts in full, the 2nd 1/1.33, the 3rd 1/1.66... Its fills (Wingman, Slipstream), its boosts (Shieldbearer, Steady Grip) and its stacks (Powder Keg, Verdant Surge, Purple Pact, Coupling, Release Valve: a cut "stack" is that share of the next stack's meter). Kit and skill meter is never cut. |
| Heal cap | `spam.healCap` 0.35 | Heals in a fight stop at 35% of max HP: kills, relics, gear effects and sets, auras, companions, allies, Second Wind. Rests, potions, Full Heal cards, events and Field Rations are between fights; a revive isn't a heal. When it bites the fight says "No more heals" once (perk `healCap`, on the hero). |
| Heals stack | `spam.healStack` 0.33 | The 2nd source to heal in a fight heals 1/1.33 as much, the 3rd 1/1.66... A kill's heal is everyone's and isn't counted as a source. |
| Forgiven misses capped | `spam.forgiveMax` 3, `forgiveMeter` 1 | Footpad, Clutch, Smoke Veil, Crampons and Spare Link together forgive at most 3 misses a fight; after that a miss breaks the combo ("No more saves" once, perk `missCap`, on the combo). A forgiven miss still empties the meter's fill toward the next stack: a miss always costs combo progress. Hoarder and Unbroken already cost stacks and keep working. |
| A miss costs HP that matters | `judge.missHpShare` 0.006, `missStreakSec` 0.5, `missStreakMax` 4 | Classic mode: a tap on empty bar costs 0.6% of max HP (at least the old 1 HP), and a miss within 0.5 s of the last one costs one more time as much (x2, x3, up to x4: a flailing thumb). Relaxed mode is unchanged (no miss damage). |

Why the last rule: with the other rules alone the masher still won. A flat 1 HP per miss was nothing to a 500 HP hero,
and tapping ten times a second blocks every red as it passes the cursor (a red's 40 ms grace): the masher dealt as
much damage as an aiming 75% player, took no reds, and paid 5 HP a second for its misses. Now its misses cost about
10% of max HP a second, which no heal can follow.

## Max-stack finishers per fight in late acts (each region's Act 3)

A max-stack finisher is one fired with 5 stacks (the default max). Every fight of every attempt in the act; the boss
on its own.

| Player | Region 1 fights | Region 1 boss | Region 2 fights | Region 2 boss | Region 3 fights | Region 3 boss |
|---|---|---|---|---|---|---|
| 70% before | 0.01 | 0.14 | 0.00 | 0.05 | 0.01 | 0.14 |
| 70% after | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.01 |
| **75% before** | 0.02 | 0.28 | 0.01 | 0.14 | 0.01 | 0.29 |
| **75% after** | **0.00** | **0.01** | **0.00** | **0.01** | **0.00** | **0.02** |
| 85% before | 0.05 | **2.32** | 0.05 | **1.93** | 0.02 | **2.03** |
| 85% after | 0.00 | 0.16 | 0.00 | 0.07 | 0.00 | 0.18 |

The bot cashes in a finisher when waiting for one more stack isn't worth the risk of a break (`wantsFinisher`, which
now counts each stack's cost), so it rarely holds 5 stacks; a player who always waits for 5 now needs 50 hits without
a break (31 before).

Finishers per fight, stacks each, at 75%:

| | Region 1 fights / boss | Region 2 fights / boss | Region 3 fights / boss |
|---|---|---|---|
| Before: finishers per fight | 5.0 / 6.8 | 4.4 / 12.0 | 4.3 / 11.6 |
| After | 4.4 / 7.8 | 4.0 / 14.2 | 3.6 / 13.7 |
| Before: stacks per finisher | 1.4 / 2.3 | 1.5 / 1.7 | 1.5 / 2.0 |
| After | 1.1 / 1.5 | 1.1 / 1.2 | 1.1 / 1.3 |

## The bar: share covered by blocks (each region's Act 3, 75% player)

Mean over the fight / the mean of each fight's peak / the highest seen.

| | Region 1 fights | Region 1 boss | Region 2 fights | Region 2 boss | Region 3 fights | Region 3 boss |
|---|---|---|---|---|---|---|
| Before | 39% / 76% / 100% | 31% / 69% / 92% | 39% / 78% / 100% | 39% / 78% / 100% | 34% / 69% / 96% | 35% / 70% / 93% |
| After | 30% / 56% / 82% | 30% / 55% / 71% | 30% / 57% / 96% | 33% / 62% / 88% | 28% / 54% / 83% | 31% / 60% / 80% |

Statics stop at 45%; the peaks above it are reds coming in on a full bar and specials' formations (both always come).
Statics kept off the bar: 22 / 17 per Region 1 fight / boss fight, 18 / 41 in Region 2, 11 / 21 in Region 3.

## Healing per fight (share of max HP; each region's Act 3, 75% player)

| | Region 1 fights | Region 1 boss | Region 2 fights | Region 2 boss | Region 3 fights | Region 3 boss |
|---|---|---|---|---|---|---|
| Before: healed | 17% | 36% (Photosynthesis 24%) | 12% | 26% (Photosynthesis 19%) | 11% | 33% (Photosynthesis 22%) |
| After: healed | 13% | 17% (Photosynthesis 9%) | 13% | 19% (Photosynthesis 12%) | 9% | 15% (Photosynthesis 7%) |
| After: cut by the cap and stacking | 2% | 9% | 1% | 14% | 0% | 8% |

Normal fights barely heal (kills' 1% each is most of it); the boss fights are where relic heals undid misses.

## Misses forgiven per fight (forgiven / breaks softened by Hoarder or Unbroken)

| Player | Region 1 fights / boss | Region 2 fights / boss | Region 3 fights / boss |
|---|---|---|---|
| 75% before | 0.01 / 0.55, 0.02 / 4.66 | 0.05 / 2.18, 0.17 / 7.89 | 0.36 / 1.73, 0.57 / 7.85 |
| 75% after | 0.02 / 0.04, 0.01 / 0.75 | 0.07 / 2.17, 0.21 / 7.11 | 0.26 / 1.50, 0.49 / 5.63 |
| 85% before | 4.39 forgiven, 8.86 at the boss | 3.04, 9.43 | 2.80, 8.13 |
| 85% after | 1.98, 2.62 | 1.72, 2.17 | 1.44, 2.16 |

(A 75% bot leaves the relics that charge for misses alone, Clutch and Glass Edge; an 85% one takes them.)

## The masher

`core/bot.ts` `mashFrom`: from that act on the bot stops aiming and taps every 100 ms (+/-20%; two thumbs drumming)
wherever the cursor is, and the real judge decides what each tap lands on. It keeps pressing a hold its tap happened to
catch (its best shot) and swipes the finisher like the aiming bot. It starts from the hero a 75% player brings to each
region's Act 3 (the aiming bot plays everything before it). "Boss alone": the act's other fights are aimed, only the
boss is mashed. 40 runs per region.

| Region | Act 3 first try: before / after | Cleared within 6 tries: before / after | Boss alone, first fight (after) | Boss alone, every try: before / after | Misses per tap (after) |
|---|---|---|---|---|---|
| 1 | 40% / **0%** | 80% / **0%** | **2 of 40** | 54% (37 of 68) / 4% (9 of 212) | 64% |
| 2 | 68% / **0%** | 89% / **0%** | **1 of 40** | 47% (33 of 70) / 4% (8 of 205) | 64% |
| 3 | 69% / **0%** | 88% / **0%** | **0 of 40** | 54% (30 of 56) / 2% (4 of 227) | 64% |

Before, the masher cleared every region's last act about as often as an aiming 75% player (better in Regions 2 and 3).
Now it never clears one, even with 6 tries. Mashing the boss alone (from the aiming bot's boss-ready hero) still wins
now and then (3 first fights in 120): every one of those runs carries a stack-banking relic build (Powder Keg with
Sapper's bombs, Purple Pact's traps, Shieldbearer's blocks, Hoarder keeping stacks through misses), so mashed blocks and
traps bank stacks that it swipes at once. `tests/unit/bot-masher.test.ts` guards it (5 runs per region): it never
clears an Act 3 first try, never wins the boss's first fight there, and retrying the boss wins at most 1 in 10.

## Clear rates at 70 / 75 / 85% (first try per act; boss or mini-boss first fight in brackets)

| Player | Act 1 | Act 2 | Act 3 | Act 4 | Act 5 | Act 6 | Act 7 | Act 8 | Act 9 |
|---|---|---|---|---|---|---|---|---|---|
| 70% before | 99% | 69% (83%) | 29% (33%) | 85% | 76% | 68% (69%) | 59% | 48% | 44% (44%) |
| 70% after | 99% | 77% (87%) | 65% (67%) | 75% | 65% | 52% (53%) | 78% | 62% | 51% (52%) |
| **75% before** | 100% | 81% (89%) | 44% (45%) | 82% | 79% | 63% (64%) | 71% | 44% | 45% (45%) |
| **75% after** | **100%** | **85%** (90%) | **63%** (65%) | **85%** | **68%** | **59%** (60%) | **90%** | **69%** | **52%** (52%) |
| 85% before | 100% | 85% (89%) | 75% (79%) | 88% | 74% | 68% (71%) | 88% | 68% | 55% (57%) |
| 85% after | 100% | 95% (97%) | 75% (75%) | 95% | 83% | 53% (55%) | 96% | 86% | 64% (64%) |

Targets for the 75% player (CLAUDE.md, the guards in `tests/unit/bot*.test.ts`): Act 1 ~100%, Act 2 80-90%, the Boar
King's first fight 60-75%; the second region about 90 / 75 / 60%, its boss 55-65%; the third about 85 / 70 / 55%, its
boss 50-60%. All within the guards' bands.

What re-aiming at 75% changed (the acts' HP and attack multipliers; reds in each later region's last act faster):

| Act | HP x (before -> after) | Attack x | Red speed | Also |
|---|---|---|---|---|
| 2 | 1.7 -> 1.2 | 5.5 -> 6 | 1.05 | Ruin Golem 1900 -> 2300 HP (it stays more than 1.3 max finishers) |
| 3 | 3.6 -> 2 | 8.5 -> 7.2 | 1.15 | |
| 4 | 4.2 -> 3.4 | 9 -> 8 | 1.1 | |
| 5 | 7.2 -> 5.3 | 15.5 -> 13.5 | 1.12 | |
| 6 | 7.6 -> 5.6 | 14.5 -> 11.5 | 1.15 -> **1.2** | |
| 7 | 8.6 -> 6.2 | 16.5 -> 13.5 | 1.16 | its mini-boss 4000 -> 3200 HP |
| 8 | 8.8 -> 6.4 | 17 -> 13.8 | 1.18 | its mini-boss 3400 -> 2800 HP |
| 9 | 10.5 -> 7 | 24 -> 15 | 1.2 -> **1.25** | its boss 8400 -> 7600 HP |

Late difficulty now comes from speed and patterns, not from more blocks: a busier pace (`acts[i].pace`) can't put more
statics on the bar past 45%, so it sends reds sooner; the last acts' reds are faster; the specials' formations are
never held back. Fights got shorter for a 75% player (Region 1: 24 / 26 / 29 s, were 23 / 31 / 32 s; the later regions'
16-23 s).

## Relics the rules changed

- **Clutch costs 2% of max HP a miss (was 4%), Blood Price 6% a finisher (was 10%).** With misses forgiven at most 3
  a fight, a heal cap, and stacks that cost more (so finishers come smaller and more often, each paying Blood Price),
  the two risk relics sank the players who take them: an 85% bot cleared the second region's last act less often than a
  75% one (49% against 54%; avoiding Blood Price, Glass Edge and Clutch it cleared 67%). With the lower prices the 85%
  bot is level with the 75% one there again (53% against 59%: within the noise, but worth watching).

## Hero parity

Every hero against Rowan at 75%: docs/balance-heroes.md (round 7 section). Not every hero is within +/-10: the gaps at
the region bosses were already there at 75% before these rules, and the rules narrowed most of them.
