# Combo Quest 3: status report (M1 feel prototype)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape)
- **Branch:** `claude/brave-ride-j1xgle`. The open PR Chef-Development/cq3#1 into `main` has an outdated
  title.
- **Stack:** Phaser 4.2.1 + TypeScript + Vite, 66 Vitest unit tests, a Playwright smoke test, and GitHub
  Actions publishing to `gh-pages` on every push.

## Where we are

The M1 combat loop plays end to end:

1. Title screen.
2. Level 1 (forest): Slime, Boar, Bandit, then the Big Slime boss, with a boost choice between stages.
3. Treasure chest.
4. Level 2 (moonlit ruins): a group fight against 2 Slimes and a Bandit.

Revive, defeat and retry work.

Everything is original art, sound and code. All numbers live in `src/core/tuning.ts` and can be edited
live in the in-game tuning panel (gear button).

## Combat rules (current defaults)

### Cursor and judgment

- The cursor bounces across the bar: 1.1 s per pass, +2% speed per combo hit, capped at 2.5x.
- Taps are judged by the pointer event's timestamp, with up to 300 ms of rewind and a calibration offset.
- A perfect hit is the center 30% of a block.
- Classic mode: tapping an empty bar costs 3 HP and breaks the combo.

### Blocks

| Block | Effect |
|---|---|
| Yellow | Attack for 10. |
| Green | Attack for 1.5x, plus Keen Edge: +10% crit for 3 s. |
| Red | An enemy attack. Tap to block it; if it reaches the left end, you take its damage. |
| Shield | Needs 2 taps. The first tap knocks it back 20% of the bar, then it comes again. |
| Bomb | Tapping it clears blocks in its radius and deals 15 to every enemy. |
| Speed | Blocking it speeds up the cursor. |
| Purple | A trap: never tap it. |

### Finisher stacks (Combo Quest 2 style)

- About 6 hits fill the meter. Hits add 0.16, greens 0.24, blocks 0.12, and a perfect adds 0.03.
- Each full meter banks one stack, up to 5. The meter shows "SWIPE! xN".
- A quick swipe in any direction spends every stack. Damage = attack × combo power (6) × stacks^1.9. At base
  stats that is 60, 224, 484 and 1278 for 1, 2, 3 and 5 stacks.
- Any miss, or any hit taken, loses the combo, the meter and every banked stack.
- The finisher knocks every red attack off the bar. Enemies keep attacking on their normal schedule.

### Kill rewards

- Heal 15% of max HP.
- Coins.
- Permanent +1 attack, +5 max HP and +0.5 combo power.
- Then choose 1 of 3 boosts.

### Companion

Pip the owl pecks for 6 damage every 4 hits.

## Presentation done

- **Resolution:** 327×150 game pixels shown at 8x on an iPhone 16 Pro, so pixels are chunky like Combo Quest
  2. Safe areas are handled.
- **Art:** all procedural pixel art.
  - Characters: a knight hero with a cape and poses, slimes plus a crowned boss slime, a boar, a bandit,
    Pip the owl companion, and the chest.
  - Backdrops: a painterly forest and moonlit ruins, with drifting leaves, rain and torches.
  - UI: a metal timing bar, glossy blocks, a wood-and-stone panel, a heavy outlined mixed-case pixel font,
    and a title crest.
- **Juice:**
  - Hits: hit-stop, impact stars, crescent slashes that heat up with the combo, cascading damage numbers,
    spring knockback and squash on enemies, a hero lunge with afterimages, and a camera kick.
  - Blocks never vanish: they pop, shatter, crunch or fly off.
  - The finisher show scales with stacks (number of strikes, backdrop color, a count-up number).
  - Kills: the enemy bursts into its own pixels, coins pop, and stat icons rain into the HUD. The boost
    choice waits for this to finish.
- **Audio:** synthesized. Hits climb a scale with the combo, plus finisher, stack, kill and stat sounds and a
  music loop.
- **Debug panel:**
  - A slider for every number.
  - Modes: swipe or button finisher, classic or relaxed misses, combo tiers, targeting, god mode, sound and
    music.
  - Jump to any stage.
  - Metronome calibration.
  - JSON export and import.

## Latest playtester feedback

All five points are fixed in the latest push but still need confirming on the phone.

1. **"An enemy should explode, then stat upgrades rain down."** Done: a pixel burst, coins, and stat icons
   that fly into the HUD.
2. **"The finisher is a swipe, not a button."** Swipe is now the default, and saved settings are migrated.
   The button is still available as an option.
3. **"Some taps don't register."** Three causes fixed:
   - The finisher button ate taps.
   - Taps were ignored while the next enemy walked in. A tap now starts the fight.
   - Taps were delayed while a finisher was banked. Now only a tap that would miss waits to see if it is a
     swipe.
4. **"During a finisher the reds stall and nothing new spawns."** The finisher now clears the red attacks,
   and spawns continue.
5. **"Smoother, more satisfying."** Lighter per-hit hit-stop, quicker transitions, and the new kill show.

Earlier feedback, already handled:

- Portrait changed to landscape.
- "Too slow and sparse" led to denser, faster pacing.
- "Thin" led to chunkier pixels.
- A disliked hero was redesigned.
- "Square-y and under-polished" led to a full art pass.
- Combo Quest 2-style stacked finisher and shield knockback were added.

## Architecture

- **`src/core`:** no Phaser or DOM; deterministic at 120 Hz with a seeded RNG.
  - `combat.ts`: the simulation and its events.
  - `run.ts`: levels, boosts and revives.
  - `tuning.ts`: every number, plus the slider metadata.
  - Also `clock.ts`, `calibration.ts` and `swipe.ts`.
- **`src/engine`:**
  - `app.ts`: time, input into the core, events into sound and view, and holding phase changes until
    animations finish.
  - `scene.ts`: all rendering and juice. About 3k lines, so it should be split.
  - `input.ts`.
  - `art.ts`, `backdrop.ts`, `chrome.ts`: procedural art.
  - `font.ts`, `audio.ts`, `debug.ts`.
  - `storage.ts`: tuning is saved as a diff from the defaults; settings use v2.
- **Docs:**
  - `CLAUDE.md`: project rules.
  - `docs/art-style.md`: palette and pixel-art technique guide.
  - `docs/backlog.md`: deferred meta-game.

## Known gaps and risks

- Balance is a first guess, since Combo Quest 2's numbers are unknown. A 5-stack finisher one-shots the boss,
  and kill stat growth compounds.
- Content is thin: 4 enemy types, 2 levels, and enemies differ only by block pattern.
- `scene.ts` is very large and should be split into HUD, bar, effects, finisher and kill modules before
  adding content.
- Everything was checked only in headless Chromium. Still unverified on an iPhone:
  - tap latency and swipe reliability
  - audio with the silent switch on
  - frame rate
- A run is not saved (a refresh restarts it), and coins do not buy anything yet.

## Suggested next steps

1. Confirm the 5 latest fixes on the phone, then tune swipe distance and time and hit-stop if needed.
2. Balance stacks (`meter.stackExp`, combo power, meter per hit) and kill stat growth.
3. Add content: more enemies with distinct specials, Level 3 and beyond, and a boss with phases.
4. Split `scene.ts` into modules, and add a set of reference screenshots for visual regression checks.
5. Build the meta-game from `docs/backlog.md`: heroes, companions, loot chests, map and upgrades. The
   playtester asked to defer these, so confirm before starting.
