# Combo Quest 3: status report (M1 feel prototype, impact pass)

- **Live build:** https://chef-development.github.io/cq3/ (installable PWA, landscape). Every push deploys.
- **Branch:** `claude/eloquent-cannon-tc28lq`, PR Chef-Development/cq3#2 into `main`. It contains all of M1 (the
  old `claude/brave-ride-j1xgle` branch, PR Chef-Development/cq3#1, now marked superseded) plus this pass, so
  merging #2 merges both.
- **Stack:** Phaser 4.2.1 + TypeScript + Vite. 113 Vitest unit tests (`npm test`, runs in CI). 4 Playwright tests:
  a smoke test, a save/reload test, and pixel-exact screenshots of the title and a fight. GitHub Actions publishes
  to `gh-pages`.

## This pass (from the playtest: "pretty strong direction"; sound underwhelming, impacts should hit harder)

1. **`scene.ts` split, with no behavior change.** It went from 2.8k lines to 400. The rest moved to
   `src/engine/view/`: stage, fighters, effects, bar, hud, overlays, plus pixel primitives and shared constants.
   This was checked pixel-exact against screenshots of the old code: the title, a fight, mid-hit, and a temporary
   set covering the finisher, a kill, the boost menu, the boss, the chest and Level 2. The screenshot tests use a
   fake clock and a seeded `Math.random`, so renders repeat exactly (`npm run screens`, `EXACT=1` for zero tolerance).
2. **Impact overhaul** (top priority). Details below.
3. **Mid-run save.** The run autosaves on every phase change and on visibilitychange/pagehide. The title offers
   Continue (showing the level and stage) or New run (which needs a second tap).
4. **Balance bot and new defaults** (`npm run balance`, report in `docs/balance.md`). Details below.
5. **Requests from the playtester during the pass** (each describing how the reference game works, with "do what
   you deem fit, the sequel needs to build"):
   - **Varied block widths:** blocks of every kind now come in varied widths, 0.7x to 1.4x their base width, per
     spawn.
   - **Narrower blocks:** "The bars are too big, I'm a 20 year old". Blocks are about 40% narrower: yellow 0.07,
     green 0.05, trap 0.06 of the bar. Timing has to be sharper.
   - **Red attacks:** next, "the red attacks get too thin". Reds (and shields, bombs, speed) are 0.075 wide and vary
     only 0.9-1.25x, so a moving attack is never a sliver.
   - **Boss music:** boss fights have their own music, an original second loop that takes over when a boss stage
     starts and hands back afterwards. The note ("the music changes during a boss fight") was read as describing
     the reference game.
   - **Stronger reward cards.** The reference shows them as blue cards. Ours go further:
     - each card rolls common (green), rare (blue, 2x, 15%) or epic (purple and gold, 3x, 4%);
     - rare and epic cards get a gold rim, a shimmer, a RARE/EPIC tag and a sting;
     - a boss kill always offers at least one rare;
     - a new Companion Power boost makes Pip peck harder.
   - **Enemies ramp up through a level, and later levels bring more enemies:**
     - Level 1 now ramps from a quick 350-HP Slime to a 3000-HP boss.
     - Level 2 is four stages: 2 Slimes, Boar + Slime, Bandit + Boar + Slime, then the Big Slime with 2 adds.
       Enemy HP is x2.8 and attack x1.5 (per-level multipliers in tuning).
     - The hero now keeps every upgrade into the next level, healed at the chest. A retry restarts the level with
       the hero as they entered it.
     - The debug "Jump to" grants the upgrades a player would have earned on the way.

## Impact overhaul

**Diagnosis.** Hits were a musical blip plus a sine thump gliding to about 55 Hz. Phone speakers barely play
below about 300 Hz, so the body of each hit vanished on the iPhone. The old heavy sounds also clipped: crit, bomb,
finisher and kill peaked at 1.17 to 1.48.

**Layers** (`src/engine/audio.ts`, numbers in `src/core/impact.ts`):

- **Crack:** a 0-5 ms transient.
- **Body:** a 120-600 Hz pitch drop through a tanh saturator. A second oscillator an octave up feeds the saturator
  too, so the harmonics a phone can play carry the weight.
- **Tail:** band-swept noise, plus debris ticks on heavy hits.
- **Sub:** a sine routed past the compressor. It only adds on headphones.
- **Combo note:** the climbing note is now a quieter musical layer on top.

Every impact gets ±4% pitch and timing variation. A final limiter and soft clipper keep every peak under 0 dBFS.

**Tiers.** A single weight per tier drives both the sound and the visuals. Every number is editable live under
"Impact" in the tuning panel.

| Tier | Weight | Hit-stop | Shake | Knockback | Enemy flash | White impact frames | Music dip |
|---|---|---|---|---|---|---|---|
| hit | 0.10 | 34 ms | 1 px | 6 px | 50 ms | 0 | 0% |
| perfect | 0.18 | 41 ms | 1 px | 7 px | 56 ms | 0 | 0% |
| block | 0.30 | 54 ms | 2 px | 8 px | 67 ms | 0 | 0% |
| crit | 0.40 | 65 ms | 2 px | 10 px | 77 ms | 1 | 41% |
| bomb | 0.50 | 78 ms | 3 px | 11 px | 88 ms | 1 | 47% |
| finisher x1 / x3 / x5 | 0.55 / 0.67 / 0.79 | 84 / 100 / 118 ms | 3 / 4 / 5 px | 12 / 14 / 16 px | 93-122 ms | 1 / 1 / 2 | 50-63% |
| kill | 0.85 | 127 ms | 6 px | 17 px | 130 ms | 2 | 67% |
| boss kill | 1.00 | 150 ms | 7 px | 20 px | 150 ms | 2 | 75% |

- **Timing:** impact sounds now play the moment the blow lands on screen, together with its hit-stop. When the
  hero has to dash in first, a quiet swish answers the tap instantly.
- **Extra booms:** a kill adds a burst crackle. A boss kill keeps exploding in step with its shock rings.
- **Sound lab** (gear panel, open by default):
  - a button for every sound effect, impacts listed lightest first;
  - buttons to play the battle and boss themes;
  - sliders for each layer (crack, body, tail, sub, combo notes), body drive, variation and music volume.

**Measured** (OfflineAudioContext render, Node implementation; the rendered levels are also asserted in
`tests/unit/audio.test.ts`):

- **Phone loudness, old vs new** (through a 300 Hz high-pass that stands in for the speaker):
  - hit +3.3 dB
  - block +5.3 dB
  - crit +1.3 dB
  - bomb +1.9 dB
  - kill +5.2 dB
  - boss kill +6.9 dB
  - 5-stack finisher about the same, but it no longer clips
- **Phone energy** (loudness × length) is up 1.4 to 11.8 dB across the tiers.
- **What the tests guarantee:**
  - no sound clips;
  - every impact is at least as loud as both music themes, full-range and on the phone filter;
  - each tier is heavier than the last, full-range and on the phone filter;
  - removing the body costs more than 3 dB on the phone;
  - the sub changes phone loudness by less than 1 dB.

## Balance (1,000 whole runs per accuracy; full report in `docs/balance.md`)

The bot (`src/core/bot.ts`) plays the real simulation:

- It aims at the next block the cursor reaches and taps at most every 120 ms.
- Accuracy is the share of well-timed taps. The rest land 60-200 ms off, wherever that is.
- Accuracy slips 6% per 1x of cursor speed.
- It cashes in the finisher when waiting for another stack isn't worth the risk of a combo break.
- It takes the rarest boost card (Full Heal when hurt).
- It plays whole runs: it retries a lost level with the hero as they entered it, and carries upgrades into the next
  level.

| 85% player | Before (M1 numbers, same rules) | Now |
|---|---|---|
| Level 1: first-try clear | 100% | **84%** (1.2 tries on average) |
| Level 1: fight per stage | 4 / 4 / 5 / 6 s | **9 / 13 / 16 / 43 s** (a ramp from a quick Slime to the boss) |
| Level 2: first-try clear | 100% (one 5 s fight) | **68%** (1.5 tries) |
| Level 2: fight per stage | 5 s | **17 / 20 / 22 / 36 s** |
| Boss HP ÷ one max-stack finisher | 0.21 (one-shot every time) | **2.6** (Level 1) and **3.2** (Level 2), 0% one-shots |
| Finisher share of damage | 32% / 52% | 25% / 39% |

- **70% player:** 24% / 42% first-try clears, about 2.1-2.7 tries per level. **95% player:** 100% / 91%.
- **About these numbers:** the bot's accuracy is its share of well-timed taps, so the narrower blocks barely change
  its numbers. For a person, narrower blocks mean sharper timing is needed to reach the same accuracy.

- **Targets met:**
  - 85% clears Level 1 in the 80-90% band.
  - Each boss needs at least two max-stack finishers.
  - Fights get longer through each level even though the hero grows, so there is no snowball.
  - Level 2 is a step up even with carried upgrades.
- **Fight-length target:** the planning chat's 20-60 s now holds for the late fights and bosses. First fights are
  short on purpose, per the playtester.
- **Changed defaults:**
  - enemy HP 350 / 600 / 900 / 3000
  - attack 12 / 16 / 18 / 22
  - Level 2: HP x2.8, attack x1.5
  - block widths yellow 0.07, green 0.05, trap 0.06 (varied 0.7-1.4x), red attacks 0.075 (varied 0.9-1.25x)
  - stack exponent 1.7
  - combo power 5, growing from boosts only (+0.5 per boost)
  - damage boost +15%
  - heal on kill 20%
  - miss self-damage 1
  - bomb damage 40
  - group spawn interval x0.8

## Combat rules (current defaults)

- **Cursor:** 1.1 s per pass, +2% speed per combo hit, capped at 2.5x.
- **Taps:** judged by the pointer timestamp, with up to 300 ms of rewind and a calibration offset.
- **Perfect:** the center 30% of a block.
- **Block widths:** yellow 0.07, green 0.05, trap 0.06 of the bar (varied 0.7-1.4x per spawn); red attacks 0.075
  (varied 0.9-1.25x).
- **Block kinds:**
  - yellow: attack for 10
  - green: 1.5x, plus +10% crit for 3 s
  - red: block it, or it hits you
  - shield: two taps, and the first knocks it back
  - bomb: clears nearby blocks and deals 40 to all enemies
  - speed: blocking it speeds up the cursor
  - purple: a trap
- **Finisher:** about 6 hits per stack, up to 5 stacks. Damage = attack × combo power (5) × stacks^1.7, which is
  50 / 162 / 324 / 771 at 1 / 2 / 3 / 5 stacks. Any miss or hit taken loses all stacks.
- **Kill rewards:** heal 20%, coins, +1 attack, +5 max HP, then 1 of 3 boost cards (common / rare x2 / epic x3).
- **Boosts:** max HP +20, damage +15%, crit +5%, crit damage +0.5x, combo power +0.5, Companion Power +4, or Full
  Heal (rare and epic Full Heal also add max HP).
- **Level 1:** Slime 350 → Boar 600 → Bandit 900 → Big Slime 3000 (boss, boss music).
- **Level 2:** four stages with enemy HP x2.8 and attack x1.5:
  - 2 Slimes
  - Boar + Slime
  - Bandit + Boar + Slime
  - Big Slime + 2 Slimes
- **Between levels:** the hero keeps every upgrade and is healed at the chest.

## Architecture

- **`src/core`** has no Phaser or DOM, runs at 120 Hz and uses a seeded RNG.
  - `combat.ts`, `run.ts` and `tuning.ts`, plus:
  - `impact.ts`: tier weights, feel and voice parameters, finisher timing.
  - `save.ts`: snapshot, validation, restore (version 2; version 1 saves still load).
  - `bot.ts`: balance bot and summary.
- **`src/engine`:**
  - `app.ts`: time, input, save and music cues.
  - `scene.ts`: layout, layers, animation clock, event routing.
  - `view/*`: rendering and juice.
  - `audio.ts`: synth, impact layers, both themes, the SFX catalog.
  - `debug.ts`: tuning panel and Sound lab.
  - `storage.ts`: tuning diff, settings, and the run save.
- **Tests:**
  - `tests/unit`: core, impact model, saves, bot targets, and rendered audio levels via `node-web-audio-api`.
  - `tests/smoke`: Playwright, including screenshots.
  - `tests/balance`: `npm run balance`; `tune.run.ts` is a scratch harness for trying overrides.

## Still unverified on the iPhone (everything was checked in headless Chromium and Node)

- How the new impacts sound through the phone speaker, and with headphones; the sub layer only matters on headphones.
- Whether the music duck and the 1-2 frame white flash feel good or too much (both are tunable under Impact).
- The new pacing: a quick first fight ramping to a 35-40 s boss. Level 2 should feel like a step up.
- Rare and epic cards: do they show up often enough and feel special?
- Continue after iOS reloads the app.
- Boss music switching.
- Tap latency, swipe reliability, and frame rate (unchanged from M1, still not confirmed).

## Known gaps and suggested next steps

1. **Playtest the impacts on the phone and tune with the Sound lab.** If the tuned values should become defaults,
   use "Copy tuning as JSON" in the panel and paste them to the planning chat.
2. **Content is thin:** 4 enemy types that differ only in block pattern, reused across both levels. A Level 3 and
   enemies with distinct specials would carry the ramp further.
3. **70%-accuracy players need about 2-3 tries per level** in Classic mode. Relaxed mode (misses don't hurt)
   helps. An easier difficulty setting may be worth adding.
4. **Coins buy nothing yet.** The meta-game in `docs/backlog.md` is deferred at the playtester's request.
